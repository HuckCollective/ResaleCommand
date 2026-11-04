import { computed, onMounted, onUnmounted, ref, type ComputedRef, type Ref } from 'vue';
import { Permission, Role } from 'appwrite';
import { databases, ID, Query } from '../lib/appwrite';
import { getDatabaseId, getItemsCollectionId, resolveCollectionId } from '../lib/appwriteEnv';
import { buildSaleOrderReference, parseRicochetExportCsv } from '../lib/ricochetPayoutParser';

// Same environment-aware IDs the working Inventory Sync uses (client SDK, logged-in session — no serverless API key)
const DATABASE_ID = getDatabaseId();
const DB_ID = DATABASE_ID;
const ITEMS_COLLECTION_ID = getItemsCollectionId();
const COLLECTION_SALES = resolveCollectionId('sales');
const SALES_COLLECTION_ID = COLLECTION_SALES;
const MANIFESTS_COLLECTION_ID = 'manifests';
/** Safe client-side write batch size (25 sales per Promise.all). */
const COMMIT_BATCH_SIZE = 25;
/** Max wait per batch before the commit stops and unfreezes the UI. */
const COMMIT_BATCH_TIMEOUT_MS = 90_000;

/** Optional `sales` attributes that may be dropped if the collection schema rejects them ("Unknown attribute"). */
const OPTIONAL_SALE_ATTRIBUTES = new Set(['tenantId', 'shippingCharged', 'shippingCost', 'orderId', 'commissionFee']);

const withTimeout = <T>(promise: Promise<T>, ms: number, message: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });

/** Stable identity of a staged Ricochet row (used to flag rows as synced locally right after a client commit). */
const rowKeyOf = (r: any): string =>
  `${r?.payoutId || r?.saleNumber || ''}|${r?.sku || r?.ricoSku || ''}|${r?.soldDate || ''}|${Number(
    r?.ricoNetPayout ?? r?.expectedNetPayout ?? 0
  ).toFixed(2)}|${r?.ticketOccurrence || r?.occurrenceIndex || 1}`;

/** Creates a `sales` document with the browser session (like Inventory Sync); drops an optional attribute the schema rejects and retries. */
const createSaleDocClient = async (inputSaleDoc: Record<string, any>, tenantId: string): Promise<any> => {
  const saleDoc: Record<string, any> = { ...inputSaleDoc };
  let permissions: string[] | undefined = tenantId
    ? [Permission.read(Role.team(tenantId)), Permission.update(Role.team(tenantId)), Permission.delete(Role.team(tenantId))]
    : undefined;
  let lastErr: any = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return permissions
        ? await databases.createDocument(DATABASE_ID, COLLECTION_SALES, ID.unique(), saleDoc, permissions)
        : await databases.createDocument(DATABASE_ID, COLLECTION_SALES, ID.unique(), saleDoc);
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message || '');
      const unknownAttr = msg.match(/Unknown attribute:?\s*"?([A-Za-z0-9_]+)"?/i)?.[1];
      if (unknownAttr && OPTIONAL_SALE_ATTRIBUTES.has(unknownAttr) && unknownAttr in saleDoc) {
        delete saleDoc[unknownAttr];
        continue;
      }
      if (permissions && [400, 401, 403].includes(Number(err?.code)) && /permission|role|team/i.test(msg)) {
        permissions = undefined;
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
};
import {
  PREVERIFIED_MD_MULTI_QTY_BINS,
  PREVERIFIED_MD_SKU_TO_UPC_OR_ID,
  buildLockedMultiBinMap,
  canonicalTicketNumber,
  cleanCatalogSku,
  flagAlreadyRecordedRows,
  isLeakedInventoryDomRow,
  isPayoutSummaryRow,
  matchMemoryDenInventoryItem,
  resolveMemoryDenSkuFromPayoutRow,
  resolvePartnerBucketForSaleRow,
  splitTrailingBoothSku,
} from '../lib/salesBucketing';
import { getLocationManifestDocIds, type LocationSettingMeta } from '../lib/warehouses';

function toPacificDateKey(rawDate: any): string {
  if (!rawDate) return '';
  const s = String(rawDate).trim();
  if (!s) return '';
  const mdy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (mdy) {
    return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  }
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return s;
  const d = new Date(/^\d{4}-\d{2}-\d{2} \d/.test(s) ? s.replace(' ', 'T') : s);
  if (!isNaN(d.getTime())) {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
    } catch {
      return d.toISOString().slice(0, 10);
    }
  }
  return s.slice(0, 10);
}

export interface UseRicochetSalesSyncOptions {
  activeCanonicalLocationMeta: ComputedRef<LocationSettingMeta>;
  inventoryItems?: ComputedRef<any[]> | Ref<any[]>;
  addToast: (toast: { type: 'success' | 'error' | 'warning' | 'info'; message: string }) => void;
  onCsvFallbackPaste: (rawCsvText: string) => void;
  onAfterLiveCommit?: () => void;
  /** Active team/tenant id stamped onto committed sales so /sales (filtered by tenantId) lists them. */
  getTenantId?: () => string;
}

function hasRealPaidDate(rawPaidDate: any): boolean {
  if (!rawPaidDate) return false;
  const s = String(rawPaidDate).trim().toLowerCase();
  if (!s || s === '—' || s === '-' || s === 'n/a' || s === 'null' || s === 'undefined' || s.includes('unpaid') || s.includes('pending')) {
    return false;
  }
  return /\d{2,4}/.test(s);
}

export function useRicochetSalesSync(options: UseRicochetSalesSyncOptions) {
  const { activeCanonicalLocationMeta, inventoryItems, addToast, onCsvFallbackPaste, onAfterLiveCommit, getTenantId } = options;

  const ricochetSyncPayload = ref<any | null>(null);
  /** RAW Ricochet Export CSV text (Payout + Payout History) staged by the bookmarklet via POST /api/sales/ricochet-sync. */
  const ricochetRawCsv = ref<{
    payout?: string;
    payoutHistory?: string;
    payoutHistoryPageCount?: number;
    capturedAt?: string;
    status?: 'staged' | 'committed';
    committed_at?: string;
    committed_count?: number;
  } | null>(null);
  /** Layer 1 progress: `{ done, total }` while a chunked Live Commit is in flight, otherwise null. */
  const ricochetCommitProgress = ref<{ done: number; total: number } | null>(null);
  const ricochetManifestStatus = computed(() => ricochetRawCsv.value?.status || '');
  const ricochetManifestCommittedCount = computed(() => Number(ricochetRawCsv.value?.committed_count || 0));
  const ricochetManifestCommittedAt = computed(() => ricochetRawCsv.value?.committed_at || null);
  const locallyCommittedRowKeys = ref<Set<string>>(new Set());
  const dynamicAppwriteItems = ref<any[]>([]);
  const dynamicAppwriteSales = ref<any[]>([]);
  const isLoadingRicochetSync = ref(false);
  const isSimulatingRicochetSync = ref(false);
  const isCommittingRicochetSync = ref(false);
  const isRicochetLiveCommitUnlocked = ref(false);
  const ricochetDryRunResult = ref<any | null>(null);
  const ricochetSubFilter = ref<'all' | 'pending_payout' | 'paid' | 'space_rental'>('all');
  const isPasteRicochetDrawerOpen = ref(false);
  const pastedRicochetSyncText = ref('');
  let lastAutoFocusFetchAt = 0;

  const fetchDynamicAppwriteInventoryItems = async () => {
    try {
      const collected: any[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < 40; page++) {
        const queries: string[] = [Query.limit(100), Query.orderDesc('$id')];
        if (cursor) queries.push(Query.cursorAfter(cursor));
        const res = await databases.listDocuments(DB_ID, ITEMS_COLLECTION_ID, queries);
        const docs = res.documents || [];
        for (const doc of docs as any[]) {
          collected.push(doc);
        }
        if (docs.length < 100) break;
        cursor = docs[docs.length - 1].$id;
      }
      if (collected.length > 0) {
        dynamicAppwriteItems.value = collected;
      }
    } catch {
      // Fall back to passed inventoryItems prop when client query is unavailable
    }
  };

  const fetchDynamicAppwriteSales = async () => {
    try {
      const collected: any[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < 60; page++) {
        const queries: string[] = [Query.limit(100), Query.orderDesc('$id')];
        if (cursor) queries.push(Query.cursorAfter(cursor));
        const res = await databases.listDocuments(DATABASE_ID, COLLECTION_SALES, queries);
        const docs = res.documents || [];
        for (const doc of docs as any[]) {
          if (String(doc?.status || '').toLowerCase() !== 'cancelled') {
            collected.push(doc);
          }
        }
        if (docs.length < 100) break;
        cursor = docs[docs.length - 1].$id;
      }
      if (collected.length > 0) {
        dynamicAppwriteSales.value = collected;
      }
    } catch {
      // Non-fatal if client sales pre-fetch fails on mount
    }
  };

  const ricochetStagedRows = computed<any[]>(() => {
    const rawList = Array.isArray(ricochetSyncPayload.value?.rows) ? ricochetSyncPayload.value.rows : [];
    const propItems = Array.isArray(inventoryItems?.value) ? inventoryItems!.value : [];
    const activeItems = propItems.length > 0 ? propItems : dynamicAppwriteItems.value;
    const claimedItemIdToSku = new Map<string, string>();
    const multiBinResolvedBySku =
      activeItems.length > 0 ? buildLockedMultiBinMap(activeItems, claimedItemIdToSku) : new Map<string, any>();

    const latestBatchPaidDate =
      rawList
        .map((r: any) => (hasRealPaidDate(r?.paidDate) ? String(r.paidDate).trim() : ''))
        .find((d: string) => Boolean(d && d !== '2026-11-03')) || '';

    const mapped = rawList
      .filter((r: any) => {
        const rawTitle = String(r?.title || r?.itemName || r?.name || '').trim();
        const rawSku = String(r?.sku || r?.ricoSku || '').trim();
        return !isPayoutSummaryRow(rawTitle) && !isPayoutSummaryRow(rawSku) && !isLeakedInventoryDomRow(r);
      })
      .map((r: any) => {
        const rawTitle = String(r?.title || r?.itemName || r?.name || '').trim();
        const trailing = splitTrailingBoothSku(rawTitle);
        const cleanTitle = trailing.sku ? trailing.title : rawTitle;
        const grossPrice = Number(r?.grossPrice ?? r?.agreedPrice ?? 0);
        let resolvedSku = cleanCatalogSku(r?.ricoSku || r?.sku || trailing.sku || '').toUpperCase();
        if (/^\d+$/.test(resolvedSku)) resolvedSku = '';
        if (!resolvedSku && cleanTitle) {
          resolvedSku = resolveMemoryDenSkuFromPayoutRow({
            extractedSku: '',
            itemName: cleanTitle,
            ticketNumber: String(r?.payoutId || r?.saleNumber || ''),
            grossPrice,
          });
        }
        let resolvedUpc = cleanCatalogSku(
          r?.matchedItemUpc || r?.upc || (resolvedSku && PREVERIFIED_MD_SKU_TO_UPC_OR_ID[resolvedSku]) || ''
        ).toUpperCase();

        // Delegate 4-tier matching to `matchMemoryDenInventoryItem` + `buildLockedMultiBinMap` from `src/lib/salesBucketing.ts`
        let matchedItem: any = null;
        if (activeItems.length > 0 && (!resolvedSku || !resolvedUpc || !r?.matchedItemId)) {
          matchedItem = matchMemoryDenInventoryItem({
            sku: resolvedSku,
            upc: resolvedUpc,
            title: cleanTitle || rawTitle,
            price: grossPrice,
            allowPrefixForPayout: true,
            activeItems,
            claimedItemIdToSku,
            multiBinResolvedBySku,
          });
        }

        if (matchedItem) {
          const itemLocSku = cleanCatalogSku(matchedItem.locationSku || matchedItem.sku).toUpperCase();
          const itemUpc = cleanCatalogSku(matchedItem.upc).toUpperCase();
          if (!resolvedSku) resolvedSku = itemLocSku || itemUpc;
          if (!resolvedUpc && itemUpc) resolvedUpc = itemUpc;
        }
        if (!resolvedSku && /dungeons.*dragons/i.test(cleanTitle) && /starter\s+set|green\s+dragon|5th\s+edition/i.test(cleanTitle)) {
          resolvedSku = '0EJ0MN';
          if (!resolvedUpc) resolvedUpc = 'HUCK-1323';
        }
        if (!resolvedUpc && resolvedSku && PREVERIFIED_MD_SKU_TO_UPC_OR_ID[resolvedSku]) {
          resolvedUpc = PREVERIFIED_MD_SKU_TO_UPC_OR_ID[resolvedSku];
        }

        const rawPayoutStatus = String(r?.payoutStatus || '').toLowerCase().trim();
        const rawStatus = String(r?.status || '').toLowerCase().trim();
        const payoutStatus: 'pending_payout' | 'paid' =
          rawPayoutStatus === 'pending_payout' || rawStatus === 'unpaid'
            ? 'pending_payout'
            : rawPayoutStatus === 'paid' || hasRealPaidDate(r?.paidDate) || rawStatus === 'paid'
              ? 'paid'
              : 'pending_payout';

        const rawSoldDate = String(r?.soldDate || r?.date || '').trim();
        const validPaid = hasRealPaidDate(r?.paidDate) && String(r.paidDate).trim() !== '2026-11-03' ? String(r.paidDate).trim() : '';
        const itemSold = matchedItem?.soldDate && String(matchedItem.soldDate).slice(0, 10) !== '2026-11-03'
          ? String(matchedItem.soldDate).slice(0, 10)
          : '';
        const fallbackPaidOrItemDate = String(
          validPaid ||
            itemSold ||
            (payoutStatus === 'paid' ? latestBatchPaidDate : '')
        ).trim();
        const resolvedSoldDate =
          payoutStatus === 'paid' && (!rawSoldDate || rawSoldDate === '2026-11-03')
            ? fallbackPaidOrItemDate || rawSoldDate
            : rawSoldDate || fallbackPaidOrItemDate;

        const isSynced = Boolean(r?.alreadySynced || r?.alreadyRecorded || r?.isAlreadyRecorded);
        let matchTier = r?.matchTier || 'unmatched';
        if (matchedItem && (!matchTier || matchTier === 'unmatched')) {
          matchTier =
            resolvedUpc && cleanCatalogSku(matchedItem.upc).toUpperCase() === resolvedUpc
              ? 'upc'
              : resolvedSku && cleanCatalogSku(matchedItem.locationSku).toUpperCase() === resolvedSku
                ? 'sku'
                : Math.abs(Number(matchedItem.boutiquePrice ?? matchedItem.resalePrice ?? matchedItem.price ?? 0) - grossPrice) < 0.05
                  ? 'title_price'
                  : 'title';
        } else if (matchTier === 'unmatched' && resolvedUpc) {
          matchTier = 'upc';
        } else if (matchTier === 'unmatched' && resolvedSku) {
          matchTier = 'sku';
        }

        const isMatched = Boolean(
          matchedItem?.$id ||
            r?.matchStatus === 'matched' ||
            r?.matchedItemId ||
            resolvedSku ||
            resolvedUpc ||
            (matchTier && matchTier !== 'unmatched')
        );
        const partnerBucket = resolvePartnerBucketForSaleRow({
          ...r,
          sku: resolvedSku || r?.sku,
          upc: resolvedUpc || r?.upc,
          matchedItemUpc: matchedItem?.upc || r?.matchedItemUpc || resolvedUpc,
          title: cleanTitle || rawTitle,
          matchedItemTitle: matchedItem?.title || r?.matchedItemTitle,
        });
        return {
          ...r,
          title: cleanTitle || rawTitle,
          sku: resolvedSku || r?.sku || '',
          ricoSku: resolvedSku || r?.ricoSku || r?.sku || '',
          upc: resolvedUpc || r?.upc || '',
          soldDate: resolvedSoldDate,
          matchedItemId: matchedItem?.$id || r?.matchedItemId,
          matchedItemUpc: matchedItem?.upc || r?.matchedItemUpc || resolvedUpc || undefined,
          matchedItemTitle: matchedItem?.title || r?.matchedItemTitle,
          matchedItemCost:
            matchedItem?.cost !== undefined ? Number(matchedItem.cost || 0) : r?.matchedItemCost,
          payoutStatus,
          alreadySynced: isSynced,
          alreadyRecorded: isSynced,
          matchTier,
          matchStatus: isMatched ? 'matched' : 'unmatched',
          partnerBucket,
        };
      });

    // Guard against any unticketed Step 3 catalog fallback row duplicating a ticketed Payout History row (keeps Paid History locked to 300 rows = $11,583.80 Net)
    const ticketedSkuPrices = new Set<string>();
    for (const row of mapped) {
      const hasRealTicket = /^\d{5,8}$/.test(String(row.payoutId || row.saleNumber || '').replace(/^#/, '').trim());
      if (hasRealTicket && row.sku) {
        ticketedSkuPrices.add(`${String(row.sku).toUpperCase()}|${Number(row.grossPrice || 0).toFixed(2)}`);
      }
    }

    // Re-run client-side ledger deduplication against live Appwrite sales & items (covers serverless staging when API key is absent)
    const liveSales = dynamicAppwriteSales.value;
    const liveTicketDateSet = new Set<string>();
    const livePosTicketSet = new Set<string>();
    const liveSkuGrossSet = new Set<string>();
    const liveSoldSingleItemIds = new Set<string>();
    const liveUnticketedDateGrossPool = new Map<string, number>();
    for (const item of activeItems as any[]) {
      const iSku = cleanCatalogSku(item?.locationSku || item?.sku).toUpperCase();
      const isMultiBin = Boolean(
        (iSku && PREVERIFIED_MD_MULTI_QTY_BINS[iSku]) ||
          item?.isMultiQty ||
          Number(item?.quantity || 1) > 1
      );
      if (!isMultiBin && (String(item?.status || '').toLowerCase() === 'sold' || Boolean(item?.saleId))) {
        liveSoldSingleItemIds.add(String(item.$id));
      }
    }
    if (liveSales.length > 0) {
      flagAlreadyRecordedRows(mapped, liveSales, {
        getSaleNumber: (r: any) => r.payoutId || r.saleNumber || r.ticket || r.ticketNumber || r.sku,
        getSoldDate: (r: any) => r.soldDate,
        getGross: (r: any) => r.grossPrice,
        getNet: (r: any) => r.ricoNetPayout,
        getSku: (r: any) => r.sku,
        getUpc: (r: any) => r.upc || r.matchedItemUpc,
        getTitle: (r: any) => r.title,
      });
      for (const sale of liveSales) {
        const ticketKey = sale.ticket || sale.orderId || sale.sale || sale.ticketNumber || sale.soNumber;
        const normTicket = canonicalTicketNumber(ticketKey) || String(ticketKey || '').trim().toUpperCase();
        const dateKey = toPacificDateKey(sale.saleDate || sale.soldDate || sale.date);
        const grossStr = Number(sale?.grossAmount ?? sale?.amount ?? 0).toFixed(2);
        const netStr = Number(sale?.netPayout ?? 0).toFixed(2);
        const sOrdSku = cleanCatalogSku(sale?.orderId).toUpperCase();
        const sSoSku = cleanCatalogSku(sale?.soNumber).toUpperCase();
        for (const skuCandidate of [sOrdSku, sSoSku]) {
          if (skuCandidate && /^(?:0EJ|HUCK-|PDXGL-|BB-)/i.test(skuCandidate)) {
            liveSkuGrossSet.add(`${skuCandidate}|${grossStr}`);
          }
        }
        if (normTicket && dateKey) {
          liveTicketDateSet.add(`${normTicket}|${dateKey}`);
        }
        if (normTicket && /^\d{4,8}$/.test(normTicket)) {
          livePosTicketSet.add(normTicket);
        } else if (dateKey && Number(grossStr) > 0) {
          // Track unticketed existing sales (e.g. historical 0EJ/HUCK records) by date + gross + net so unmatched Payouts CSV rows match 1-for-1
          const poolKey = `${dateKey}|${grossStr}|${netStr}`;
          liveUnticketedDateGrossPool.set(poolKey, (liveUnticketedDateGrossPool.get(poolKey) || 0) + 1);
        }
      }
    }

    const flagged = mapped.map((row: any) => {
      const rowTicketRaw = row.ticket || row.payoutId || row.saleNumber || row.ticketNumber || '';
      const normRowTicket = canonicalTicketNumber(rowTicketRaw) || String(rowTicketRaw).trim().toUpperCase();
      const rowDateKey = toPacificDateKey(row.soldDate);
      const grossStr = Number(row.grossPrice || 0).toFixed(2);
      const netStr = Number(row.ricoNetPayout ?? row.expectedNetPayout ?? 0).toFixed(2);
      const cleanRowSku = cleanCatalogSku(row.sku || row.ricoSku).toUpperCase();
      const cleanRowUpc = cleanCatalogSku(row.upc || row.matchedItemUpc).toUpperCase();
      const isMultiBinRow = Boolean(cleanRowSku && PREVERIFIED_MD_MULTI_QTY_BINS[cleanRowSku]);
      const poolKey = `${rowDateKey}|${grossStr}|${netStr}`;
      let matchedUnticketedPool = false;
      if (!row.isAlreadyRecorded && !cleanRowSku && rowDateKey && (liveUnticketedDateGrossPool.get(poolKey) || 0) > 0) {
        liveUnticketedDateGrossPool.set(poolKey, (liveUnticketedDateGrossPool.get(poolKey) || 0) - 1);
        matchedUnticketedPool = true;
      }
      const matchedLiveTicket =
        Boolean(normRowTicket && rowDateKey && liveTicketDateSet.has(`${normRowTicket}|${rowDateKey}`)) ||
        Boolean(normRowTicket && /^\d{4,8}$/.test(normRowTicket) && livePosTicketSet.has(normRowTicket)) ||
        Boolean(!isMultiBinRow && cleanRowSku && liveSkuGrossSet.has(`${cleanRowSku}|${grossStr}`)) ||
        Boolean(!isMultiBinRow && cleanRowUpc && liveSkuGrossSet.has(`${cleanRowUpc}|${grossStr}`)) ||
        Boolean(!isMultiBinRow && row.matchedItemId && liveSoldSingleItemIds.has(String(row.matchedItemId))) ||
        matchedUnticketedPool;
      if (
        row.isAlreadyRecorded ||
        matchedLiveTicket ||
        locallyCommittedRowKeys.value.has(rowKeyOf(row))
      ) {
        return {
          ...row,
          alreadySynced: true,
          alreadyRecorded: true,
          isAlreadyRecorded: true,
        };
      }
      return row;
    });
    return flagged.filter((row: any) => {
      const hasRealTicket = /^\d{5,8}$/.test(String(row.payoutId || row.saleNumber || '').replace(/^#/, '').trim());
      if (!hasRealTicket && row.sku && ticketedSkuPrices.has(`${String(row.sku).toUpperCase()}|${Number(row.grossPrice || 0).toFixed(2)}`)) {
        ticketedSkuPrices.delete(`${String(row.sku).toUpperCase()}|${Number(row.grossPrice || 0).toFixed(2)}`);
        return false;
      }
      return true;
    });
  });

  const ricochetSpaceRentalAdjustments = computed<any[]>(() => {
    return Array.isArray(ricochetSyncPayload.value?.spaceRentalAdjustments)
      ? ricochetSyncPayload.value.spaceRentalAdjustments
      : [];
  });

  const ricochetPendingRowsCount = computed(() => {
    return ricochetStagedRows.value.filter((r: any) => r.payoutStatus === 'pending_payout').length;
  });

  const ricochetPaidRowsCount = computed(() => {
    return ricochetStagedRows.value.filter((r: any) => r.payoutStatus !== 'pending_payout').length;
  });

  const filteredRicochetStagedRows = computed<any[]>(() => {
    if (ricochetSubFilter.value === 'pending_payout') {
      return ricochetStagedRows.value.filter((r: any) => r.payoutStatus === 'pending_payout');
    }
    if (ricochetSubFilter.value === 'paid') {
      return ricochetStagedRows.value.filter((r: any) => r.payoutStatus !== 'pending_payout');
    }
    return ricochetStagedRows.value;
  });

  const ricochetSummary = computed(() => {
    const s = ricochetSyncPayload.value?.summary;
    const rows = ricochetStagedRows.value;
    let grossSales = 0;
    let expectedCommission = 0;
    let netPayout = 0;
    let pendingPayoutCount = 0;
    let pendingPayoutNet = 0;
    let paidHistoryCount = 0;
    let paidHistoryNet = 0;
    let matchedInBooth = 0;
    let alreadySynced = 0;
    for (const r of rows) {
      const net = Number(r.ricoNetPayout ?? r.expectedNetPayout ?? 0);
      grossSales += Number(r.grossPrice || 0);
      expectedCommission += Number(r.expectedFee ?? r.expectedCommission ?? r.ricoCommission ?? 0);
      netPayout += net;
      if (r.payoutStatus === 'pending_payout') {
        pendingPayoutCount++;
        pendingPayoutNet += net;
      } else {
        paidHistoryCount++;
        paidHistoryNet += net;
      }
      if (r.matchStatus === 'matched' || r.matchedItemId || (r.matchTier && r.matchTier !== 'unmatched')) {
        matchedInBooth++;
      }
      if (r.alreadySynced || r.alreadyRecorded) alreadySynced++;
    }
    let spaceRentalTotal = 0;
    for (const adj of ricochetSpaceRentalAdjustments.value) {
      spaceRentalTotal += Number(adj.amount || 0);
    }
    const rent = Number(activeCanonicalLocationMeta.value.monthlyRent || 0);
    if (spaceRentalTotal === 0 && rent > 0) {
      spaceRentalTotal = s?.spaceRentalTotal ?? -Math.abs(rent);
    }
    const hasRows = rows.length > 0;
    return {
      soldFound: hasRows ? rows.length : (s?.soldFound ?? 0),
      grossSales: hasRows ? Number(grossSales.toFixed(2)) : (s?.grossSales ?? 0),
      expectedCommission: hasRows ? Number(expectedCommission.toFixed(2)) : (s?.expectedCommission ?? 0),
      netPayout: hasRows ? Number(netPayout.toFixed(2)) : (s?.expectedNetPayout ?? s?.netPayout ?? 0),
      pendingPayoutCount: hasRows ? pendingPayoutCount : (s?.pendingPayoutCount ?? 0),
      pendingPayoutNet: hasRows ? Number(pendingPayoutNet.toFixed(2)) : (s?.pendingPayoutNet ?? 0),
      paidHistoryCount: hasRows ? paidHistoryCount : (s?.paidHistoryCount ?? 0),
      paidHistoryNet: hasRows ? Number(paidHistoryNet.toFixed(2)) : (s?.paidHistoryNet ?? 0),
      spaceRentalTotal: Number(spaceRentalTotal.toFixed(2)),
      netAfterCommissionAndRent: hasRows
        ? Number((netPayout - rent).toFixed(2))
        : (s?.netAfterRent ?? s?.netAfterCommissionAndRent ?? 0),
      matchedInBooth: hasRows ? matchedInBooth : (s?.matchedCount ?? s?.matchedInBooth ?? 0),
      alreadySynced: hasRows ? alreadySynced : (s?.alreadySyncedCount ?? s?.alreadySynced ?? 0),
      unmatchedCount: hasRows ? Math.max(0, rows.length - matchedInBooth) : (s?.unmatchedCount ?? 0),
    };
  });

  const ricochetActionableNewCount = computed(() => {
    return ricochetStagedRows.value.filter(
      (r: any) =>
        !r.alreadySynced &&
        !r.alreadyRecorded &&
        (r.matchStatus === 'matched' ||
          r.matchedItemId ||
          (r.matchTier && r.matchTier !== 'unmatched') ||
          Number(r.grossPrice || 0) > 0)
    ).length;
  });

  const fetchStagedRicochetSales = async (manualTrigger: boolean = false) => {
    if (!activeCanonicalLocationMeta.value.usesRicochet) return;
    isLoadingRicochetSync.value = true;
    try {
      const code = encodeURIComponent(activeCanonicalLocationMeta.value.code);
      const res = await fetch(`/api/sales/ricochet-sync?location=${code}&t=${Date.now()}`);
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok && data?.payload) {
        ricochetSyncPayload.value = data.payload;
        ricochetRawCsv.value = data?.rawCsv || null;
        // Ingest the staged RAW Export CSVs (from the API payload — never cross-origin localStorage) when no rows were staged yet
        const stagedRowCount = Array.isArray(data.payload?.rows) ? data.payload.rows.length : 0;
        if (stagedRowCount === 0 && (data?.rawCsv?.payout || data?.rawCsv?.payoutHistory)) {
          const parsedStagedCsv = parseRicochetExportCsv(
            [data.rawCsv.payout, data.rawCsv.payoutHistory].filter(Boolean).join('\n')
          );
          if (parsedStagedCsv.rows.length > 0) {
            const stageRes = await fetch('/api/sales/ricochet-sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                mode: 'stage',
                dryRun: true,
                locationCode: activeCanonicalLocationMeta.value.code,
                rows: [],
                rawCsv: { payout: data.rawCsv.payout, payoutHistory: data.rawCsv.payoutHistory },
              }),
            });
            const stageData = await stageRes.json().catch(() => null);
            if (stageRes.ok && stageData?.ok && stageData?.payload) {
              ricochetSyncPayload.value = stageData.payload;
            }
          }
        }
        if (manualTrigger) {
          addToast({
            type: 'success',
            message: `🔄 Loaded ${ricochetStagedRows.value.length} staged Ricochet sales for ${activeCanonicalLocationMeta.value.shortName} (Dry-Run Preview)!`,
          });
        }
      }
    } catch (err: any) {
      if (manualTrigger) {
        addToast({
          type: 'warning',
          message: `Could not fetch staged Ricochet sales: ${err?.message || 'Network error'}`,
        });
      }
    } finally {
      isLoadingRicochetSync.value = false;
    }
  };

  const applyPastedRicochetSyncPayload = async () => {
    const raw = pastedRicochetSyncText.value.trim();
    if (!raw) return;

    if (raw.startsWith('{') || raw.startsWith('[')) {
      isLoadingRicochetSync.value = true;
      try {
        const parsed = JSON.parse(raw);
        const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.rows) ? parsed.rows : [];
        const spaceRentalAdjustments = Array.isArray(parsed?.spaceRentalAdjustments)
          ? parsed.spaceRentalAdjustments
          : [];
        const res = await fetch('/api/sales/ricochet-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'stage',
            dryRun: true,
            locationCode: activeCanonicalLocationMeta.value.code,
            rows,
            spaceRentalAdjustments,
            rawCsv: parsed?.rawCsv,
            payoutHistoryPages: Array.isArray(parsed?.payoutHistoryPages) ? parsed.payoutHistoryPages : undefined,
          }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok && data?.payload) {
          ricochetSyncPayload.value = data.payload;
          ricochetRawCsv.value = data?.rawCsv || null;
          ricochetDryRunResult.value = null;
          pastedRicochetSyncText.value = '';
          isPasteRicochetDrawerOpen.value = false;
          addToast({
            type: 'success',
            message: `🧪 Staged ${rows.length} Ricochet sold lines in Dry-Run Sandbox Mode for ${activeCanonicalLocationMeta.value.shortName}!`,
          });
        } else {
          throw new Error(data?.error || 'Failed to stage pasted JSON');
        }
      } catch (err: any) {
        addToast({
          type: 'error',
          message: `Invalid Ricochet Sync JSON: ${err?.message || 'Parse error'}`,
        });
      } finally {
        isLoadingRicochetSync.value = false;
      }
      return;
    }

    // Native dual-schema Ricochet Export CSV support (Schema A: Payout CSV + Schema B: Payout History CSV)
    const parsedExportCsv = parseRicochetExportCsv(raw);
    if (parsedExportCsv.rows.length > 0) {
      isLoadingRicochetSync.value = true;
      try {
        const res = await fetch('/api/sales/ricochet-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'stage',
            dryRun: true,
            locationCode: activeCanonicalLocationMeta.value.code,
            rows: parsedExportCsv.rows,
            spaceRentalAdjustments: parsedExportCsv.spaceRentalAdjustments,
          }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok && data?.payload) {
          ricochetSyncPayload.value = data.payload;
          ricochetDryRunResult.value = null;
          pastedRicochetSyncText.value = '';
          isPasteRicochetDrawerOpen.value = false;
          addToast({
            type: 'success',
            message: `📄 Staged ${parsedExportCsv.rows.length} Ricochet Export CSV rows in Dry-Run Sandbox Mode for ${activeCanonicalLocationMeta.value.shortName}!`,
          });
          return;
        }
      } catch {
        // Fall through to legacy CSV fallback handler
      } finally {
        isLoadingRicochetSync.value = false;
      }
    }

    pastedRicochetSyncText.value = '';
    isPasteRicochetDrawerOpen.value = false;
    onCsvFallbackPaste(raw);
    addToast({
      type: 'success',
      message: `📄 Parsed pasted CSV into ${activeCanonicalLocationMeta.value.shortName} staging table!`,
    });
  };

  const simulateStagedRicochetSales = async () => {
    if (isSimulatingRicochetSync.value || ricochetStagedRows.value.length === 0) return;
    isSimulatingRicochetSync.value = true;
    try {
      const res = await fetch('/api/sales/ricochet-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'dry_run',
          dryRun: true,
          locationCode: activeCanonicalLocationMeta.value.code,
          rows: ricochetStagedRows.value,
          spaceRentalAdjustments: ricochetSpaceRentalAdjustments.value,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        if (data.payload) {
          const updatedRows = Array.isArray(data.payload.rows)
            ? data.payload.rows.map((r: any) => {
                const isSynced = Boolean(r?.alreadySynced || r?.alreadyRecorded || r?.isAlreadyRecorded);
                return {
                  ...r,
                  alreadySynced: isSynced,
                  alreadyRecorded: isSynced,
                };
              })
            : [];
          ricochetSyncPayload.value = {
            ...data.payload,
            rows: updatedRows,
          };
        }
        ricochetDryRunResult.value = {
          wouldCommitCount: data.wouldCommitCount ?? ricochetActionableNewCount.value,
          wouldGross: data.wouldGross ?? ricochetSummary.value.grossSales,
          wouldNet: data.wouldNet ?? ricochetSummary.value.netPayout,
          skippedAlreadySynced:
            data.skippedAlreadySynced ?? data.alreadySyncedCount ?? ricochetSummary.value.alreadySynced,
        };
        addToast({
          type: 'info',
          message: `🧪 Dry-Run Simulation: Would commit ${ricochetDryRunResult.value.wouldCommitCount} sales ($${Number(ricochetDryRunResult.value.wouldNet || 0).toFixed(2)} net) with 0 DB writes!`,
        });
      } else {
        throw new Error(data?.error || 'Dry-run simulation failed');
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        message: `Dry-Run failed: ${err?.message || 'Unknown error'}`,
      });
    } finally {
      isSimulatingRicochetSync.value = false;
    }
  };

  const commitLiveSales = async () => {
    if (
      isCommittingRicochetSync.value ||
      ricochetActionableNewCount.value === 0 ||
      !isRicochetLiveCommitUnlocked.value
    ) {
      return;
    }
    // Layer 1: lock the UI synchronously so a double-click can never start a second commit
    isCommittingRicochetSync.value = true;
    const rowsToCommit = ricochetStagedRows.value;
    const totalRows = rowsToCommit.length;
    ricochetCommitProgress.value = { done: 0, total: totalRows };
    const locMeta = activeCanonicalLocationMeta.value;
    const tenantId = getTenantId?.() || '';
    const existingSaleKeys = new Set<string>();
    const preExistingTicketDates = new Set<string>();
    const preExistingUnticketedPool = new Map<string, number>();
    const saleShieldKey = (warehouseId: string, ticketRef: string, dateStr: string, amountStr?: string, occ?: number): string =>
      `${String(warehouseId || '').trim()}|${String(ticketRef || '').trim().toUpperCase()}|${toPacificDateKey(dateStr)}${amountStr ? `|${amountStr}` : ''}${occ && occ > 1 ? `#${occ}` : ''}`;
    const committedRowKeys = new Set<string>();
    let committedTotal = 0;
    let skippedTotal = 0;
    let skippedDuplicateTickets = 0;
    let failedTotal = 0;
    const batchErrors: string[] = [];

    try {
      // Layer 3 preflight: load live inventory + existing sales from Appwrite directly via the browser session cookie
      if (dynamicAppwriteItems.value.length === 0) {
        await fetchDynamicAppwriteInventoryItems();
      }
      const activeItems =
        Array.isArray(inventoryItems?.value) && inventoryItems!.value.length > 0
          ? inventoryItems!.value
          : dynamicAppwriteItems.value;
      const soldSingleItemIds = new Set<string>();
      for (const item of activeItems as any[]) {
        const iSku = cleanCatalogSku(item?.locationSku || item?.sku).toUpperCase();
        const isMultiBin = Boolean(
          (iSku && PREVERIFIED_MD_MULTI_QTY_BINS[iSku]) ||
            item?.isMultiQty ||
            Number(item?.quantity || 1) > 1
        );
        if (!isMultiBin && (String(item?.status || '').toLowerCase() === 'sold' || Boolean(item?.saleId))) {
          soldSingleItemIds.add(String(item.$id));
        }
      }

      const existingSalesDocs: any[] = [];
      try {
        let cursor: string | null = null;
        for (let page = 0; page < 60; page++) {
          const queries: string[] = [Query.limit(100), Query.orderDesc('$id')];
          if (cursor) queries.push(Query.cursorAfter(cursor));
          const res = await databases.listDocuments(DATABASE_ID, COLLECTION_SALES, queries);
          const docs = res.documents || [];
          for (const sale of docs as any[]) {
            if (String(sale?.status || '').toLowerCase() === 'cancelled') continue;
            existingSalesDocs.push(sale);
            const ticketKey = sale.ticket || sale.orderId || sale.sale || sale.ticketNumber || sale.soNumber;
            const normTicket = canonicalTicketNumber(ticketKey) || String(ticketKey || '').trim().toUpperCase();
            const saleDateKey = toPacificDateKey(sale?.saleDate || sale?.soldDate || sale?.date);
            const grossStr = Number(sale?.grossAmount ?? sale?.amount ?? 0).toFixed(2);
            const netStr = Number(sale?.netPayout ?? 0).toFixed(2);
            const sOrdSku = cleanCatalogSku(sale?.orderId).toUpperCase();
            const sSoSku = cleanCatalogSku(sale?.soNumber).toUpperCase();
            if (ticketKey) {
              existingSaleKeys.add(saleShieldKey(sale?.warehouseId || locMeta.id, String(ticketKey), saleDateKey));
              existingSaleKeys.add(saleShieldKey(locMeta.id, String(ticketKey), saleDateKey));
            }
            for (const skuCandidate of [sOrdSku, sSoSku]) {
              if (skuCandidate && /^(?:0EJ|HUCK-|PDXGL-|BB-)/i.test(skuCandidate)) {
                existingSaleKeys.add(saleShieldKey(locMeta.id, skuCandidate, saleDateKey, grossStr));
                preExistingTicketDates.add(`${skuCandidate}|${grossStr}`);
              }
            }
            if (normTicket) {
              existingSaleKeys.add(saleShieldKey(sale?.warehouseId || locMeta.id, normTicket, saleDateKey));
              existingSaleKeys.add(saleShieldKey(locMeta.id, normTicket, saleDateKey));
              existingSaleKeys.add(saleShieldKey(locMeta.id, normTicket, saleDateKey, grossStr));
              if (saleDateKey) {
                preExistingTicketDates.add(`${normTicket}|${saleDateKey}`);
              }
              if (/^\d{4,8}$/.test(normTicket)) {
                preExistingTicketDates.add(normTicket);
              } else if (saleDateKey && Number(grossStr) > 0) {
                const poolKey = `${saleDateKey}|${grossStr}|${netStr}`;
                preExistingUnticketedPool.set(poolKey, (preExistingUnticketedPool.get(poolKey) || 0) + 1);
              }
            }
          }
          if (docs.length < 100) break;
          cursor = docs[docs.length - 1].$id;
        }
        if (existingSalesDocs.length > 0) {
          dynamicAppwriteSales.value = existingSalesDocs;
          flagAlreadyRecordedRows(rowsToCommit, existingSalesDocs, {
            getSaleNumber: (r: any) => r.payoutId || r.saleNumber || r.ticket || r.ticketNumber || r.sku,
            getSoldDate: (r: any) => r.soldDate,
            getGross: (r: any) => r.grossPrice,
            getNet: (r: any) => r.ricoNetPayout,
            getSku: (r: any) => r.sku,
            getUpc: (r: any) => r.upc || r.matchedItemUpc,
            getTitle: (r: any) => r.title,
          });
        }
      } catch {
        // Proceed with row-level alreadySynced flags if initial ticket scan fails
      }

      for (let start = 0; start < totalRows; start += COMMIT_BATCH_SIZE) {
        const chunk = rowsToCommit.slice(start, start + COMMIT_BATCH_SIZE);
        const batchNo = Math.floor(start / COMMIT_BATCH_SIZE) + 1;
        const batchCount = Math.ceil(totalRows / COMMIT_BATCH_SIZE);
        let batchCommitted = 0;
        let batchFailed = 0;

        const pendingWrites: Promise<void>[] = [];
        for (const row of chunk) {
          if (row.alreadySynced || row.alreadyRecorded || row.isAlreadyRecorded) {
            skippedTotal++;
            committedRowKeys.add(rowKeyOf(row));
            continue;
          }
          if (!row.matchedItemId && !row.sku && !row.title) {
            skippedTotal++;
            continue;
          }

          const { saleIso, orderRef, soNumber } = buildSaleOrderReference(row, locMeta.code);
          const rowTicketKey = row.ticket || row.payoutId || row.saleNumber || row.ticketNumber || orderRef;
          const normRowTicket = canonicalTicketNumber(rowTicketKey) || String(rowTicketKey || '').trim().toUpperCase();
          const rowDateKey = toPacificDateKey(row.soldDate || saleIso);
          const gross = Number(row.grossPrice || 0);
          const grossStr = gross.toFixed(2);
          const net = Number(row.ricoNetPayout ?? row.expectedNetPayout ?? 0);
          const netStr = net.toFixed(2);
          const rowOcc = Math.max(1, Number(row.ticketOccurrence || row.occurrenceIndex || 1));
          const cleanRowSku = cleanCatalogSku(row.sku || row.ricoSku).toUpperCase();
          const cleanRowUpc = cleanCatalogSku(row.upc || row.matchedItemUpc).toUpperCase();
          const isMultiBinRow = Boolean(cleanRowSku && PREVERIFIED_MD_MULTI_QTY_BINS[cleanRowSku]);

          const poolKey = `${rowDateKey}|${grossStr}|${netStr}`;
          let matchedUnticketedPool = false;
          if (!cleanRowSku && rowDateKey && (preExistingUnticketedPool.get(poolKey) || 0) > 0) {
            preExistingUnticketedPool.set(poolKey, (preExistingUnticketedPool.get(poolKey) || 0) - 1);
            matchedUnticketedPool = true;
          }

          // 3-Key Sale Identity Shield: skip if matched by POS ticket, by single-qty SKU/UPC + Gross, by sold single-qty itemId, or by unticketed date+gross+net pool
          const alreadyInAppwrite =
            (normRowTicket && rowDateKey && preExistingTicketDates.has(`${normRowTicket}|${rowDateKey}`)) ||
            (normRowTicket && /^\d{4,8}$/.test(normRowTicket) && preExistingTicketDates.has(normRowTicket)) ||
            (!isMultiBinRow && cleanRowSku && preExistingTicketDates.has(`${cleanRowSku}|${grossStr}`)) ||
            (!isMultiBinRow && cleanRowUpc && preExistingTicketDates.has(`${cleanRowUpc}|${grossStr}`)) ||
            (!isMultiBinRow && row.matchedItemId && soldSingleItemIds.has(String(row.matchedItemId))) ||
            matchedUnticketedPool;

          const shieldKey = normRowTicket
            ? saleShieldKey(locMeta.id, normRowTicket, rowDateKey, grossStr, rowOcc)
            : saleShieldKey(locMeta.id, orderRef, rowDateKey, grossStr, rowOcc);

          if (alreadyInAppwrite || (shieldKey && existingSaleKeys.has(shieldKey))) {
            skippedDuplicateTickets++;
            skippedTotal++;
            committedRowKeys.add(rowKeyOf(row));
            continue;
          }
          if (shieldKey) existingSaleKeys.add(shieldKey);
          const fee = Number(row.expectedFee ?? row.expectedCommission ?? row.ricoCommission ?? 0);
          const saleDoc: Record<string, any> = {
            warehouseId: locMeta.id,
            soNumber,
            orderId: orderRef,
            saleDate: saleIso,
            grossAmount: gross,
            commissionFee: fee,
            netPayout: net,
            shippingCharged: 0,
            shippingCost: 0,
            status: 'Sold',
            tenantId: tenantId || 'system',
          };

          pendingWrites.push(
            (async () => {
              try {
                const createdSale = await createSaleDocClient(saleDoc, tenantId);
                if (row.matchedItemId) {
                  try {
                    const cleanSku = String(row.sku || row.ricoSku || '').trim().toUpperCase();
                    const binConfig = cleanSku ? PREVERIFIED_MD_MULTI_QTY_BINS[cleanSku] : undefined;
                    await databases.updateDocument(DATABASE_ID, ITEMS_COLLECTION_ID, row.matchedItemId, {
                      status: binConfig ? 'placed' : 'sold',
                      storageLocation: locMeta.code,
                      warehouseId: locMeta.id,
                      quantity: binConfig ? Math.max(1, binConfig.expectedRemainingQty) : 1,
                      resalePrice: gross,
                      soldPrice: net,
                      saleId: createdSale.$id,
                      ...(cleanSku ? { locationSku: cleanSku } : {}),
                    });
                  } catch {
                    // Item status update is best-effort once the sale ledger doc is written
                  }
                }
                batchCommitted++;
                committedTotal++;
                committedRowKeys.add(rowKeyOf(row));
              } catch (err: any) {
                if (shieldKey) existingSaleKeys.delete(shieldKey);
                batchFailed++;
                failedTotal++;
                const msg = String(err?.message || err || 'Unknown Appwrite error');
                if (!batchErrors.includes(msg)) batchErrors.push(msg);
              }
            })()
          );
        }

        if (pendingWrites.length > 0) {
          await withTimeout(
            Promise.all(pendingWrites),
            COMMIT_BATCH_TIMEOUT_MS,
            `Batch ${batchNo}/${batchCount} timed out after ${Math.round(COMMIT_BATCH_TIMEOUT_MS / 1000)}s`
          );
        }

        // Visible counter: 0 ➔ 25 ➔ 50 ➔ ... ➔ total as each batch lands
        ricochetCommitProgress.value = { done: Math.min(totalRows, start + chunk.length), total: totalRows };

        if (batchFailed > 0 && batchCommitted === 0) {
          throw new Error(`Appwrite rejected batch ${batchNo}/${batchCount}: ${batchErrors[0] || 'unknown error'}`);
        }
      }

      // Flag all committed rows in client memory so the "✅ Already Synced" badge locks immediately
      if (committedRowKeys.size > 0) {
        const nextSet = new Set(locallyCommittedRowKeys.value);
        for (const k of committedRowKeys) nextSet.add(k);
        locallyCommittedRowKeys.value = nextSet;
      }

      // Layer 2: stamp the staging manifest as committed directly via client Appwrite SDK
      if (failedTotal === 0) {
        const committedAtIso = new Date().toISOString();
        const totalCommittedCount = committedTotal + skippedTotal;
        const { rawCsvDocId } = getLocationManifestDocIds(locMeta.code);
        try {
          let existingSnap: Record<string, any> = {};
          try {
            const existingDoc: any = await databases.getDocument(DATABASE_ID, MANIFESTS_COLLECTION_ID, rawCsvDocId);
            if (existingDoc?.itemsSnapshot) {
              existingSnap = JSON.parse(existingDoc.itemsSnapshot);
            }
            const nextSnap = {
              ...existingSnap,
              ...(ricochetRawCsv.value || {}),
              status: 'committed' as const,
              committed_at: committedAtIso,
              committed_count: totalCommittedCount,
            };
            await databases.updateDocument(DATABASE_ID, MANIFESTS_COLLECTION_ID, rawCsvDocId, {
              itemsSnapshot: JSON.stringify(nextSnap),
              notes: `Committed ${totalCommittedCount} Ricochet sales at ${committedAtIso}`,
            });
          } catch {
            const nextSnap = {
              ...(ricochetRawCsv.value || {}),
              status: 'committed' as const,
              committed_at: committedAtIso,
              committed_count: totalCommittedCount,
            };
            await databases.createDocument(
              DATABASE_ID,
              MANIFESTS_COLLECTION_ID,
              rawCsvDocId,
              {
                name: `${locMeta.shortName} Ricochet Raw CSV`,
                tenantId: 'system',
                locationId: locMeta.id,
                locationName: locMeta.name,
                status: 'system_sales_sync_raw_csv',
                itemCount: totalCommittedCount,
                itemsSnapshot: JSON.stringify(nextSnap),
                notes: `Committed ${totalCommittedCount} Ricochet sales at ${committedAtIso}`,
              },
              [Permission.read(Role.any()), Permission.update(Role.any()), Permission.delete(Role.any())]
            );
          }
        } catch {
          // Local reactive manifest state still locks the UI below
        }
        ricochetRawCsv.value = {
          ...(ricochetRawCsv.value || {}),
          status: 'committed',
          committed_at: committedAtIso,
          committed_count: totalCommittedCount,
        };
      }

      ricochetDryRunResult.value = null;
      isRicochetLiveCommitUnlocked.value = false;
      addToast({
        type: failedTotal > 0 ? 'warning' : 'success',
        message:
          failedTotal > 0
            ? `⚠️ Committed ${committedTotal} sales, ${failedTotal} failed${batchErrors[0] ? ` — Appwrite: ${batchErrors[0]}` : ''}. Re-run Commit to retry (duplicates are skipped automatically).`
            : `✅ Committed ${committedTotal} verified Ricochet sales (${skippedTotal} already synced).`,
      });
      onAfterLiveCommit?.();
    } catch (err: any) {
      // Unfreeze immediately (finally resets isCommitting + progress) and surface the exact error message
      addToast({
        type: 'error',
        message: `Commit stopped at ${ricochetCommitProgress.value?.done ?? 0} / ${totalRows}: ${err?.message || 'Unknown error'} — re-run Commit to resume (already-written tickets are skipped).`,
      });
    } finally {
      isCommittingRicochetSync.value = false;
      ricochetCommitProgress.value = null;
    }
  };
  const commitStagedRicochetSales = commitLiveSales;

  const handleTabWakeOrFocus = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (!activeCanonicalLocationMeta.value.usesRicochet || isLoadingRicochetSync.value) return;
    const now = Date.now();
    if (now - lastAutoFocusFetchAt < 4000) return;
    lastAutoFocusFetchAt = now;
    void fetchStagedRicochetSales(false);
  };

  onMounted(() => {
    if (typeof window !== 'undefined') {
      if (!Array.isArray(inventoryItems?.value) || inventoryItems!.value.length === 0) {
        void fetchDynamicAppwriteInventoryItems();
      }
      void fetchDynamicAppwriteSales();
      window.addEventListener('focus', handleTabWakeOrFocus);
      document.addEventListener('visibilitychange', handleTabWakeOrFocus);
    }
  });

  onUnmounted(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', handleTabWakeOrFocus);
      document.removeEventListener('visibilitychange', handleTabWakeOrFocus);
    }
  });

  return {
    ricochetSyncPayload,
    ricochetRawCsv,
    ricochetCommitProgress,
    ricochetManifestStatus,
    ricochetManifestCommittedCount,
    ricochetManifestCommittedAt,
    isLoadingRicochetSync,
    isSimulatingRicochetSync,
    isCommittingRicochetSync,
    isRicochetLiveCommitUnlocked,
    ricochetDryRunResult,
    ricochetSubFilter,
    isPasteRicochetDrawerOpen,
    pastedRicochetSyncText,
    ricochetStagedRows,
    ricochetSpaceRentalAdjustments,
    ricochetPendingRowsCount,
    ricochetPaidRowsCount,
    filteredRicochetStagedRows,
    ricochetSummary,
    ricochetActionableNewCount,
    fetchStagedRicochetSales,
    applyPastedRicochetSyncPayload,
    simulateStagedRicochetSales,
    commitLiveSales,
    commitStagedRicochetSales,
  };
}


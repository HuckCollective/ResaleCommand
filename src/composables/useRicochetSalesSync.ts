import { computed, onMounted, onUnmounted, ref, type ComputedRef, type Ref } from 'vue';
import { databases, Query } from '../lib/appwrite';
import { parseRicochetExportCsv } from '../lib/ricochetPayoutParser';

const DB_ID = import.meta.env?.PUBLIC_APPWRITE_DB_ID || 'resale_db';
const ITEMS_COLLECTION_ID = import.meta.env?.PUBLIC_APPWRITE_ITEMS_COLLECTION_ID || 'items';
/** Safe Appwrite write batch size for chunked Live Commits (25-50 rows per request). */
const COMMIT_BATCH_SIZE = 40;
import {
  PREVERIFIED_MD_SKU_TO_UPC_OR_ID,
  buildLockedMultiBinMap,
  cleanCatalogSku,
  isLeakedInventoryDomRow,
  isPayoutSummaryRow,
  matchMemoryDenInventoryItem,
  resolveMemoryDenSkuFromPayoutRow,
  resolvePartnerBucketForSaleRow,
  splitTrailingBoothSku,
} from '../lib/salesBucketing';
import type { LocationSettingMeta } from '../lib/warehouses';

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
  const dynamicAppwriteItems = ref<any[]>([]);
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
      for (let page = 0; page < 20; page++) {
        const queries: string[] = [Query.limit(100), Query.orderDesc('$id')];
        if (cursor) queries.push(Query.cursorAfter(cursor));
        const res = await databases.listDocuments(DB_ID, ITEMS_COLLECTION_ID, queries);
        const docs = res.documents || [];
        for (const doc of docs as any[]) {
          const hasSku = Boolean(doc?.external_sku || doc?.locationSku || doc?.sku);
          const hasBarcode = Boolean(doc?.barcode || doc?.upc);
          if (hasSku || hasBarcode) {
            collected.push(doc);
          }
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
    return mapped.filter((row: any) => {
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

  const commitStagedRicochetSales = async () => {
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
    const locationCode = activeCanonicalLocationMeta.value.code;
    let committedTotal = 0;
    let skippedTotal = 0;
    let failedTotal = 0;
    try {
      for (let start = 0; start < totalRows; start += COMMIT_BATCH_SIZE) {
        const chunk = rowsToCommit.slice(start, start + COMMIT_BATCH_SIZE);
        const res = await fetch('/api/sales/ricochet-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'commit',
            dryRun: false,
            locationCode,
            tenantId: getTenantId?.() || undefined,
            batch: { index: Math.floor(start / COMMIT_BATCH_SIZE), size: COMMIT_BATCH_SIZE, total: totalRows },
            rows: chunk,
            spaceRentalAdjustments: ricochetSpaceRentalAdjustments.value,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!(res.ok && data?.ok)) {
          throw new Error(data?.error || `Commit batch ${Math.floor(start / COMMIT_BATCH_SIZE) + 1} failed`);
        }
        committedTotal += Number(data.committedCount || 0);
        skippedTotal += Number(data.skippedAlreadySynced || 0) + Number(data.skippedDuplicateTickets || 0);
        failedTotal += Number(data.failedCount || 0);
        ricochetCommitProgress.value = { done: Math.min(totalRows, start + chunk.length), total: totalRows };
      }

      // Layer 2: stamp the staging manifest as committed (only when every row landed)
      const finRes = await fetch('/api/sales/ricochet-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'finalize',
          dryRun: false,
          locationCode,
          committedCount: committedTotal + skippedTotal,
          failedCount: failedTotal,
        }),
      });
      const finData = await finRes.json().catch(() => null);
      if (finRes.ok && finData?.ok) {
        if (finData.payload) ricochetSyncPayload.value = finData.payload;
        if (finData.manifest) ricochetRawCsv.value = { ...(ricochetRawCsv.value || {}), ...finData.manifest };
      }

      ricochetDryRunResult.value = null;
      isRicochetLiveCommitUnlocked.value = false;
      addToast({
        type: failedTotal > 0 ? 'warning' : 'success',
        message:
          failedTotal > 0
            ? `⚠️ Committed ${committedTotal} sales, ${failedTotal} failed — re-run Commit to retry (duplicates are skipped automatically).`
            : `✅ Committed ${committedTotal} verified Ricochet sales (${skippedTotal} already synced).`,
      });
      onAfterLiveCommit?.();
    } catch (err: any) {
      addToast({
        type: 'error',
        message: `Failed to commit Ricochet sales: ${err?.message || 'Unknown error'} — re-run Commit to resume (already-written tickets are skipped).`,
      });
    } finally {
      isCommittingRicochetSync.value = false;
      ricochetCommitProgress.value = null;
    }
  };

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
    commitStagedRicochetSales,
  };
}


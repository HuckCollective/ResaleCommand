import type { APIRoute } from 'astro';
import {
  Client as NodeClient,
  Databases as NodeDatabases,
  ID as NodeID,
  Permission as NodePermission,
  Role as NodeRole,
  Query as NodeQuery,
} from 'node-appwrite';
import {
  PREVERIFIED_MD_MULTI_QTY_BINS,
  buildLockedMultiBinMap,
  cleanCatalogSku,
  flagAlreadyRecordedRows,
  matchMemoryDenInventoryItem,
  toSaleIso,
} from '../../../lib/salesBucketing';
import {
  getLocationManifestDocIds,
  getLocationSettingMeta,
  resolveCanonicalLocationCode,
  resolveDefaultRicochetLocationMeta,
} from '../../../lib/warehouses';

export const prerender = false;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const MANIFESTS_COL_ID = 'manifests';

export interface SpaceRentalAdjustment {
  label: string;
  date: string;
  amount: number;
}

export interface RicochetSyncSaleLine {
  ricoItemId: string;
  ricoSku?: string;
  sku: string;
  upc: string;
  title: string;
  saleNumber?: string;
  soldDate: string;
  paidDate?: string | null;
  agreedPrice?: number;
  splitPct?: string;
  agedPrice?: number;
  discounts?: string;
  grossPrice: number;
  ricoNetPayout: number;
  ricoCommission: number;
  payoutId: string;
  payoutStatus?: 'pending_payout' | 'paid';
  status: string;
  expectedFee?: number;
  expectedNetPayout?: number;
  matchedItemId?: string;
  matchedItemUpc?: string;
  matchedItemTitle?: string;
  matchedItemCost?: number;
  matchTier?: 'upc' | 'sku' | 'title_price' | 'title' | 'unmatched';
  alreadySynced?: boolean;
  ticketOccurrence?: number;
}

export interface RicochetSalesSyncPayload {
  timestamp: string;
  locationCode: string;
  locationName: string;
  commissionRate: number;
  monthlyRent: number;
  dryRun?: boolean;
  syncedAt?: string;
  spaceRentalAdjustments?: SpaceRentalAdjustment[];
  summary: {
    soldFound: number;
    pendingPayoutCount: number;
    pendingPayoutNet: number;
    paidHistoryCount: number;
    paidHistoryNet: number;
    spaceRentalTotal: number;
    grossSales: number;
    expectedCommission: number;
    expectedNetPayout: number;
    netAfterRent: number;
    matchedCount: number;
    alreadySyncedCount: number;
    unmatchedCount: number;
  };
  rows: RicochetSyncSaleLine[];
}

function getAppwriteConfig() {
  const endpoint =
    (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_APPWRITE_ENDPOINT) ||
    process.env.PUBLIC_APPWRITE_ENDPOINT ||
    'https://sfo.cloud.appwrite.io/v1';
  const project =
    (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_APPWRITE_PROJECT_ID) ||
    process.env.PUBLIC_APPWRITE_PROJECT_ID ||
    '69714b35003a8adab6bb';
  const apiKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.APPWRITE_API_KEY) ||
    process.env.APPWRITE_API_KEY ||
    '';
  const dbId =
    (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_APPWRITE_DB_ID) ||
    process.env.PUBLIC_APPWRITE_DB_ID ||
    'resale_db';
  const itemsCol =
    (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_APPWRITE_ITEMS_COLLECTION_ID) ||
    process.env.PUBLIC_APPWRITE_ITEMS_COLLECTION_ID ||
    'items';
  const salesCol =
    (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_APPWRITE_SALES_COLLECTION_ID) ||
    process.env.PUBLIC_APPWRITE_SALES_COLLECTION_ID ||
    'sales';

  let databases: NodeDatabases | null = null;
  if (endpoint && project) {
    const client = new NodeClient().setEndpoint(endpoint).setProject(project);
    if (apiKey) client.setKey(apiKey);
    databases = new NodeDatabases(client);
  }
  return { endpoint, project, apiKey, dbId, itemsCol, salesCol, databases };
}

function resolveRicochetLocation(rawLoc?: string | null) {
  const defaultMeta = resolveDefaultRicochetLocationMeta();
  if (!rawLoc || !String(rawLoc).trim()) {
    return defaultMeta;
  }
  const code = resolveCanonicalLocationCode(rawLoc) || defaultMeta.code;
  const meta = getLocationSettingMeta(code);
  return meta.usesRicochet ? meta : defaultMeta;
}

const getStoredSalesSync = (locCode: string): RicochetSalesSyncPayload | null => {
  const map = (globalThis as any).__LATEST_RICOCHET_SALES_SYNC__ || {};
  return map[locCode] || null;
};

const setStoredSalesSync = (payload: RicochetSalesSyncPayload, locCode: string) => {
  if (!(globalThis as any).__LATEST_RICOCHET_SALES_SYNC__) {
    (globalThis as any).__LATEST_RICOCHET_SALES_SYNC__ = {};
  }
  (globalThis as any).__LATEST_RICOCHET_SALES_SYNC__[locCode] = payload;
};

async function fetchAppwriteDocFallback(colId: string, docId: string): Promise<any | null> {
  const { endpoint, project, apiKey, dbId, databases } = getAppwriteConfig();
  if (databases) {
    try {
      return await databases.getDocument(dbId, colId, docId);
    } catch {}
  }
  try {
    const headers: Record<string, string> = {
      'X-Appwrite-Project': project,
      'Content-Type': 'application/json',
    };
    if (apiKey) headers['X-Appwrite-Key'] = apiKey;
    const res = await fetch(
      `${endpoint}/databases/${dbId}/collections/${colId}/documents/${docId}`,
      { method: 'GET', headers }
    );
    if (res.ok) {
      return await res.json();
    }
  } catch {}
  return null;
}

async function loadPersistedSalesSync(locCode: string): Promise<RicochetSalesSyncPayload | null> {
  const { code, salesSyncDocId } = getLocationManifestDocIds(locCode);
  try {
    const doc: any = await fetchAppwriteDocFallback(MANIFESTS_COL_ID, salesSyncDocId);
    const rawSnap = doc?.itemsSnapshot || doc?.notes_raw;
    if (rawSnap) {
      const parsed = typeof rawSnap === 'string' ? JSON.parse(rawSnap) : rawSnap;
      if (parsed && Array.isArray(parsed.rows)) {
        setStoredSalesSync(parsed, code);
        return parsed as RicochetSalesSyncPayload;
      }
    }
  } catch {}
  return getStoredSalesSync(code);
}

async function savePersistedSalesSync(payload: RicochetSalesSyncPayload, locCode: string): Promise<void> {
  const locMeta = resolveRicochetLocation(locCode);
  const { salesSyncDocId } = getLocationManifestDocIds(locMeta.code);
  setStoredSalesSync(payload, locMeta.code);

  const { databases, dbId } = getAppwriteConfig();
  if (!databases) return;

  const docPerms = [
    NodePermission.read(NodeRole.any()),
    NodePermission.update(NodeRole.any()),
    NodePermission.delete(NodeRole.any()),
  ];

  const docPayload: Record<string, any> = {
    name: `${locMeta.shortName} Live Ricochet Sales & Payout Sync`,
    tenantId: 'system',
    locationId: locMeta.id,
    locationName: locMeta.shortName,
    status: 'system_sales_sync',
    itemCount: Number(payload.rows?.length || 0),
    itemsSnapshot: JSON.stringify(payload),
    notes: JSON.stringify({
      timestamp: payload.timestamp,
      summary: payload.summary,
    }).slice(0, 4900),
  };

  try {
    await databases.updateDocument(dbId, MANIFESTS_COL_ID, salesSyncDocId, docPayload, docPerms);
  } catch (updateErr: any) {
    if (updateErr?.code === 404 || String(updateErr?.message || '').includes('not be found')) {
      try {
        await databases.createDocument(dbId, MANIFESTS_COL_ID, salesSyncDocId, docPayload, docPerms);
      } catch {}
    }
  }
}

async function fetchAllItemsAndSales() {
  const { databases, dbId, itemsCol, salesCol } = getAppwriteConfig();
  const allItems: any[] = [];
  const allSales: any[] = [];
  if (!databases) return { allItems, allSales };

  try {
    let cursor: string | null = null;
    for (let page = 0; page < 25; page++) {
      const queries: string[] = [NodeQuery.limit(100), NodeQuery.orderDesc('$id')];
      if (cursor) queries.push(NodeQuery.cursorAfter(cursor));
      const res = await databases.listDocuments(dbId, itemsCol, queries);
      const docs = res.documents || [];
      allItems.push(...docs);
      if (docs.length < 100) break;
      cursor = docs[docs.length - 1].$id;
    }
  } catch {}

  try {
    let cursor: string | null = null;
    for (let page = 0; page < 25; page++) {
      const queries: string[] = [NodeQuery.limit(100), NodeQuery.orderDesc('$id')];
      if (cursor) queries.push(NodeQuery.cursorAfter(cursor));
      const res = await databases.listDocuments(dbId, salesCol, queries);
      const docs = res.documents || [];
      allSales.push(...docs);
      if (docs.length < 100) break;
      cursor = docs[docs.length - 1].$id;
    }
  } catch {}

  return { allItems, allSales };
}

function normalizeTitleSlug(str: string): string {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function enrichAndMatchSalesRows(
  rawRows: any[],
  locCode: string,
  extraOptions?: {
    spaceRentalAdjustments?: SpaceRentalAdjustment[];
    dryRun?: boolean;
  }
): Promise<RicochetSalesSyncPayload> {
  const locMeta = resolveRicochetLocation(locCode);
  const feePct = Number(locMeta.commissionRate ?? locMeta.feePct ?? 0);
  const monthlyRent = Number(locMeta.monthlyRent ?? 0);
  const { allItems, allSales } = await fetchAllItemsAndSales();

  const eligibleItems = allItems.filter((item) => {
    const s = String(item?.status || '').toLowerCase().trim();
    return s !== 'combined' && s !== 'deconstructed' && s !== 'draft' && s !== 'tracked' && s !== 'scouted';
  });

  const byUpc = new Map<string, any>();
  const bySku = new Map<string, any>();
  const byTitlePrice = new Map<string, any>();
  const byTitle = new Map<string, any>();

  for (const item of eligibleItems) {
    const u = cleanCatalogSku(item.upc).toUpperCase();
    const s = cleanCatalogSku(item.locationSku || item.sku).toUpperCase();
    const t = normalizeTitleSlug(item.title || item.identity || '');
    const pFixed = Number(item.boutiquePrice ?? item.resalePrice ?? item.price ?? 0).toFixed(2);
    if (u && !byUpc.has(u)) byUpc.set(u, item);
    if (s && !bySku.has(s)) bySku.set(s, item);
    if (t && t.length >= 4) {
      if (!byTitlePrice.has(`${t}|${pFixed}`)) byTitlePrice.set(`${t}|${pFixed}`, item);
      if (!byTitle.has(t)) byTitle.set(t, item);
    }
  }

  const claimedItemIdToSku = new Map<string, string>();
  const multiBinResolvedBySku = buildLockedMultiBinMap(eligibleItems, claimedItemIdToSku);

  // Build existing sales fingerprint set (sku|date|gross) & orderId set for idempotency
  const existingOrderIds = new Set<string>();
  const existingSkuGrossSet = new Set<string>();
  for (const s of allSales) {
    if (s.status === 'Cancelled') continue;
    const ord = String(s.orderId || '').trim().toUpperCase();
    const so = String(s.soNumber || '').trim().toUpperCase();
    const gross = Number(s.grossAmount || 0).toFixed(2);
    if (ord) existingOrderIds.add(`${ord}|${gross}`);
    if (so) existingSkuGrossSet.add(`${so}|${gross}`);
  }

  const normalizedRows: RicochetSyncSaleLine[] = rawRows.map((r, idx) => {
    let rawTitle = String(r.title || r.itemName || r.name || '').trim();
    let rawSku = cleanCatalogSku(r.ricoSku || r.sku || r.extractedSku || '').toUpperCase();

    // Parse ` - <SKU>` suffix if present on Payout History title e.g. `"Cartographers Heros - 0EJ03C"`
    const suffixMatch = rawTitle.match(/^(.*?)\s+-\s+([A-Z0-9]{4,12})$/i);
    if (suffixMatch) {
      rawTitle = String(suffixMatch[1] || '').trim();
      if (!rawSku) rawSku = cleanCatalogSku(suffixMatch[2]).toUpperCase();
    }
    if (/^\d+$/.test(rawSku)) {
      rawSku = '';
    }

    const upc = cleanCatalogSku(r.upc || r.expectedRcUpc || '').toUpperCase();
    const soldDate = String(r.soldDate || r.date || new Date().toISOString().slice(0, 10)).trim();
    const paidDate = r.paidDate ? String(r.paidDate).trim() : null;
    const agreedPrice = Math.max(
      0,
      Number(Number(r.agreedPrice ?? r.grossPrice ?? r.listedPrice ?? r.price ?? 0).toFixed(2))
    );
    const agedPrice = Math.max(0, Number(Number(r.agedPrice ?? agreedPrice).toFixed(2)));
    const grossPrice = Math.max(
      0,
      Number(Number(r.grossPrice ?? (agedPrice > 0 ? agedPrice : agreedPrice)).toFixed(2))
    );
    const splitPct = String(r.splitPct || `${100 - feePct}.00%`).trim();
    const discounts = String(r.discounts || '').trim();
    const expectedFee = Number((grossPrice * (feePct / 100)).toFixed(2));
    const expectedNetPayout = Number((grossPrice - expectedFee).toFixed(2));
    const ricoCommission =
      r.ricoCommission !== undefined && r.ricoCommission !== null && !isNaN(Number(r.ricoCommission))
        ? Number(Number(r.ricoCommission).toFixed(2))
        : expectedFee;
    const ricoNetPayout =
      r.ricoNetPayout !== undefined && r.ricoNetPayout !== null && !isNaN(Number(r.ricoNetPayout)) && Number(r.ricoNetPayout) > 0
        ? Number(Number(r.ricoNetPayout).toFixed(2))
        : expectedNetPayout;
    const rawSaleNum = String(r.saleNumber || r.payoutId || r.ticketNumber || '').trim();
    const cleanPayoutId = rawSaleNum.replace(/^#/, '').trim();
    const saleNumber = rawSaleNum || (cleanPayoutId ? `#${cleanPayoutId}` : '');
    const payoutStatus: 'pending_payout' | 'paid' =
      r.payoutStatus === 'paid' || Boolean(paidDate) || String(r.status || '').toLowerCase() === 'paid'
        ? 'paid'
        : 'pending_payout';
    const status = payoutStatus === 'paid' ? 'Paid' : 'Sold';

    // 4-Tier Matching: 1) Mapped Custom UPC, 2) Exact Ricochet `0EJ...` SKU, 3) Normalized Title + Agreed Price, 4) Normalized Title
    let matchedItem: any = null;
    let matchTier: 'upc' | 'sku' | 'title_price' | 'title' | 'unmatched' = 'unmatched';
    const titleSlug = normalizeTitleSlug(rawTitle);
    const agreedKey = agreedPrice.toFixed(2);

    if (upc && byUpc.has(upc)) {
      matchedItem = byUpc.get(upc);
      matchTier = 'upc';
    } else if (rawSku && bySku.has(rawSku)) {
      matchedItem = bySku.get(rawSku);
      matchTier = 'sku';
    } else if (titleSlug && byTitlePrice.has(`${titleSlug}|${agreedKey}`)) {
      matchedItem = byTitlePrice.get(`${titleSlug}|${agreedKey}`);
      matchTier = 'title_price';
    } else if (titleSlug && byTitle.has(titleSlug)) {
      matchedItem = byTitle.get(titleSlug);
      matchTier = 'title';
    } else if (eligibleItems.length > 0) {
      const fuzzy = matchMemoryDenInventoryItem({
        sku: rawSku,
        upc,
        title: rawTitle,
        price: grossPrice,
        extraText: '',
        allowPrefixForPayout: true,
        activeItems: eligibleItems,
        claimedItemIdToSku,
        multiBinResolvedBySku,
      });
      if (fuzzy) {
        matchedItem = fuzzy;
        matchTier =
          rawSku && cleanCatalogSku(fuzzy.locationSku).toUpperCase() === rawSku
            ? 'sku'
            : Number(fuzzy.boutiquePrice ?? fuzzy.resalePrice ?? fuzzy.price ?? 0).toFixed(2) === agreedKey
              ? 'title_price'
              : 'title';
      }
    }

    const effectiveSku =
      rawSku || cleanCatalogSku(matchedItem?.locationSku || '').toUpperCase();
    const effectiveUpc =
      upc || cleanCatalogSku(matchedItem?.upc || '').toUpperCase();
    const effectiveTitle = rawTitle || matchedItem?.title || effectiveSku || 'Booth Sale Item';

    const grossKey = grossPrice.toFixed(2);
    const isItemAlreadySoldInDb =
      matchedItem &&
      String(matchedItem.status || '').toLowerCase() === 'sold' &&
      !PREVERIFIED_MD_MULTI_QTY_BINS[effectiveSku];
    const isSaleInLedger =
      (cleanPayoutId && existingOrderIds.has(`${cleanPayoutId.toUpperCase()}|${grossKey}`)) ||
      (cleanPayoutId && existingOrderIds.has(`TICKET #${cleanPayoutId.toUpperCase()}|${grossKey}`)) ||
      (effectiveSku && existingSkuGrossSet.has(`${effectiveSku}|${grossKey}`)) ||
      (effectiveUpc && existingSkuGrossSet.has(`${effectiveUpc}|${grossKey}`));

    return {
      ricoItemId: String(EffectiveRicoId(r, effectiveSku, cleanPayoutId, idx)),
      ricoSku: effectiveSku,
      sku: effectiveSku,
      upc: effectiveUpc,
      title: effectiveTitle,
      saleNumber,
      soldDate,
      paidDate,
      agreedPrice,
      splitPct,
      agedPrice,
      discounts,
      grossPrice,
      ricoNetPayout,
      ricoCommission,
      payoutId: cleanPayoutId || saleNumber,
      payoutStatus,
      status,
      expectedFee,
      expectedNetPayout,
      matchedItemId: matchedItem?.$id || undefined,
      matchedItemUpc: matchedItem?.upc || undefined,
      matchedItemTitle: matchedItem?.title || undefined,
      matchedItemCost: matchedItem?.cost !== undefined ? Number(matchedItem.cost || 0) : undefined,
      matchTier,
      alreadySynced: Boolean(r.alreadySynced || isItemAlreadySoldInDb || isSaleInLedger),
      ticketOccurrence: Number(r.ticketOccurrence || 1),
    };
  });

  // Also run occurrence-indexed fingerprint check against allSales
  flagAlreadyRecordedRows(normalizedRows as any[], allSales, {
    getSaleNumber: (r) => r.payoutId || r.sku,
    getSoldDate: (r) => r.soldDate,
    getGross: (r) => r.grossPrice,
    getSku: (r) => r.sku,
    getTitle: (r) => r.title,
  });

  for (const r of normalizedRows as any[]) {
    if (r.isAlreadyRecorded) {
      r.alreadySynced = true;
    }
  }

  let grossSales = 0;
  let expectedCommission = 0;
  let expectedNetPayout = 0;
  let pendingPayoutCount = 0;
  let pendingPayoutNet = 0;
  let paidHistoryCount = 0;
  let paidHistoryNet = 0;
  let matchedCount = 0;
  let alreadySyncedCount = 0;
  let unmatchedCount = 0;

  for (const r of normalizedRows) {
    const netVal = Number(r.ricoNetPayout ?? r.expectedNetPayout ?? 0);
    grossSales += Number(r.grossPrice || 0);
    expectedCommission += Number(r.expectedFee ?? r.ricoCommission ?? 0);
    expectedNetPayout += netVal;
    if (r.payoutStatus === 'paid') {
      paidHistoryCount++;
      paidHistoryNet += netVal;
    } else {
      pendingPayoutCount++;
      pendingPayoutNet += netVal;
    }
    if (r.alreadySynced) alreadySyncedCount++;
    if (r.matchedItemId || r.matchTier !== 'unmatched') matchedCount++;
    else unmatchedCount++;
  }

  const adjustments: SpaceRentalAdjustment[] = Array.isArray(extraOptions?.spaceRentalAdjustments)
    ? extraOptions!.spaceRentalAdjustments!
    : [];
  let spaceRentalTotal = 0;
  if (adjustments.length > 0) {
    for (const adj of adjustments) {
      spaceRentalTotal += Number(adj.amount || 0);
    }
  } else if (monthlyRent > 0) {
    spaceRentalTotal = -Math.abs(monthlyRent);
  }

  grossSales = Number(grossSales.toFixed(2));
  expectedCommission = Number(expectedCommission.toFixed(2));
  expectedNetPayout = Number(expectedNetPayout.toFixed(2));
  pendingPayoutNet = Number(pendingPayoutNet.toFixed(2));
  paidHistoryNet = Number(paidHistoryNet.toFixed(2));
  spaceRentalTotal = Number(spaceRentalTotal.toFixed(2));
  const netAfterRent = Number((expectedNetPayout - monthlyRent).toFixed(2));

  return {
    timestamp: new Date().toISOString(),
    locationCode: locMeta.code,
    locationName: locMeta.shortName,
    commissionRate: feePct,
    monthlyRent,
    dryRun: extraOptions?.dryRun ?? true,
    spaceRentalAdjustments: adjustments,
    summary: {
      soldFound: normalizedRows.length,
      pendingPayoutCount,
      pendingPayoutNet,
      paidHistoryCount,
      paidHistoryNet,
      spaceRentalTotal,
      grossSales,
      expectedCommission,
      expectedNetPayout,
      netAfterRent,
      matchedCount,
      alreadySyncedCount,
      unmatchedCount,
    },
    rows: normalizedRows,
  };
}

function EffectiveRicoId(r: any, effectiveSku: string, cleanPayoutId: string, idx: number): string {
  if (effectiveSku) return effectiveSku;
  if (cleanPayoutId) return cleanPayoutId;
  const rawId = String(r.ricoItemId || r.productId || r.id || '').trim();
  if (rawId && !/^\d+$/.test(rawId)) return rawId;
  return `ROW-${idx + 1}`;
}

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const GET: APIRoute = async ({ url }) => {
  try {
    const locMeta = resolveRicochetLocation(url.searchParams.get('location'));
    let payload = await loadPersistedSalesSync(locMeta.code);

    // If no staged Ricochet sales exist yet, derive sold rows from the persisted verification report if present
    if (!payload || !Array.isArray(payload.rows) || payload.rows.length === 0) {
      const { reportDocId } = getLocationManifestDocIds(locMeta.code);
      const reportDoc = await fetchAppwriteDocFallback(MANIFESTS_COL_ID, reportDocId);
      const rawReport = reportDoc?.itemsSnapshot
        ? typeof reportDoc.itemsSnapshot === 'string'
          ? JSON.parse(reportDoc.itemsSnapshot)
          : reportDoc.itemsSnapshot
        : null;
      if (rawReport && Array.isArray(rawReport.rows)) {
        const soldFromVerify = rawReport.rows
          .filter((r: any) => {
            const inv = String(r.inventory || '').toLowerCase();
            return inv.includes('sold') || inv.includes('paid') || Number(r.quantity ?? 1) === 0;
          })
          .map((r: any) => ({
            ricoItemId: String(r.productId || r.sku || ''),
            sku: cleanCatalogSku(r.sku).toUpperCase(),
            upc: cleanCatalogSku(r.upc || r.expectedRcUpc).toUpperCase(),
            title: String(r.name || r.sku || 'Booth Item'),
            soldDate: String(rawReport.timestamp || new Date().toISOString()).slice(0, 10),
            grossPrice: Number(r.agreedPrice || 0),
            status: String(r.inventory || 'Sold'),
          }));
        if (soldFromVerify.length > 0) {
          payload = await enrichAndMatchSalesRows(soldFromVerify, locMeta.code, { dryRun: true });
          await savePersistedSalesSync(payload, locMeta.code);
        }
      }
    } else {
      payload = await enrichAndMatchSalesRows(payload.rows, locMeta.code, {
        spaceRentalAdjustments: payload.spaceRentalAdjustments,
        dryRun: payload.dryRun ?? true,
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        hasStagedSales: Boolean(payload && payload.rows.length > 0),
        location: {
          code: locMeta.code,
          name: locMeta.shortName,
          fullName: locMeta.fullName,
          icon: locMeta.icon,
          usesRicochet: locMeta.usesRicochet,
          commissionRate: locMeta.commissionRate,
          monthlyRent: locMeta.monthlyRent,
        },
        payload: payload || null,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'Failed to load Ricochet sales sync' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

export const POST: APIRoute = async ({ request, url }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const rawLoc = body?.locationCode || body?.location || url.searchParams.get('location');
    const locMeta = resolveRicochetLocation(rawLoc);
    const mode = String(body?.mode || 'stage').toLowerCase();
    const isDryRunRequest =
      mode === 'dry_run' || mode === 'simulate' || Boolean(body?.dryRun && mode !== 'commit');

    if (mode === 'commit' || mode === 'dry_run' || mode === 'simulate') {
      const { databases, dbId, itemsCol, salesCol } = getAppwriteConfig();
      const persisted = await loadPersistedSalesSync(locMeta.code);
      const currentPayload =
        Array.isArray(body?.rows) && body.rows.length > 0
          ? await enrichAndMatchSalesRows(body.rows, locMeta.code, {
              spaceRentalAdjustments: body?.spaceRentalAdjustments || persisted?.spaceRentalAdjustments,
              dryRun: isDryRunRequest,
            })
          : persisted;

      if (!currentPayload || !Array.isArray(currentPayload.rows) || currentPayload.rows.length === 0) {
        return new Response(
          JSON.stringify({ ok: false, error: 'No staged Ricochet sales rows to commit.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      // Dry-Run / Simulate Commit Preview (zero production DB writes)
      if (isDryRunRequest) {
        let wouldCommitCount = 0;
        let skippedAlreadySynced = 0;
        let wouldGross = 0;
        let wouldNet = 0;
        for (const row of currentPayload.rows) {
          if (row.alreadySynced) {
            skippedAlreadySynced++;
            continue;
          }
          if (!row.matchedItemId && !row.sku && !row.title) continue;
          wouldCommitCount++;
          wouldGross += Number(row.grossPrice || 0);
          wouldNet += Number(row.ricoNetPayout ?? row.expectedNetPayout ?? 0);
        }

        await savePersistedSalesSync(currentPayload, locMeta.code);
        return new Response(
          JSON.stringify({
            ok: true,
            mode: 'dry_run',
            dryRun: true,
            wouldCommitCount,
            skippedAlreadySynced,
            wouldGross: Number(wouldGross.toFixed(2)),
            wouldNet: Number(wouldNet.toFixed(2)),
            payload: currentPayload,
          }),
          { status: 200, headers: CORS_HEADERS }
        );
      }

      let committedCount = 0;
      let skippedAlreadySynced = 0;
      const tenantId = String(body?.tenantId || '').trim();

      if (databases) {
        for (const row of currentPayload.rows) {
          if (row.alreadySynced) {
            skippedAlreadySynced++;
            continue;
          }
          if (!row.matchedItemId && !row.sku && !row.title) {
            continue;
          }

          const gross = Number(row.grossPrice || 0);
          const fee = Number(row.expectedFee ?? row.ricoCommission ?? 0);
          const net = Number(row.ricoNetPayout ?? row.expectedNetPayout ?? 0);
          const saleIso = toSaleIso(row.soldDate) || new Date().toISOString();
          const orderRef = row.payoutId || row.sku || `RICO-${locMeta.code}-${saleIso.slice(0, 10)}`;

          try {
            const saleDoc: Record<string, any> = {
              warehouseId: locMeta.id,
              soNumber: row.upc || row.matchedItemUpc || row.sku || `SO-${Date.now().toString().slice(-5)}`,
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
            const createdSale = await databases.createDocument(dbId, salesCol, NodeID.unique(), saleDoc);

            if (row.matchedItemId) {
              const binConfig = row.sku ? PREVERIFIED_MD_MULTI_QTY_BINS[row.sku.toUpperCase()] : undefined;
              const itemUpdate: Record<string, any> = {
                status: binConfig ? 'placed' : 'sold',
                storageLocation: locMeta.code,
                warehouseId: locMeta.id,
                quantity: binConfig ? Math.max(1, binConfig.expectedRemainingQty) : 1,
                resalePrice: gross,
                soldPrice: net,
                saleId: createdSale.$id,
              };
              if (row.sku) itemUpdate.locationSku = row.sku;
              await databases.updateDocument(dbId, itemsCol, row.matchedItemId, itemUpdate);
            }

            row.alreadySynced = true;
            committedCount++;
          } catch {}
        }
      }

      currentPayload.syncedAt = new Date().toISOString();
      const refreshed = await enrichAndMatchSalesRows(currentPayload.rows, locMeta.code, {
        spaceRentalAdjustments: currentPayload.spaceRentalAdjustments,
        dryRun: false,
      });
      refreshed.syncedAt = currentPayload.syncedAt;
      await savePersistedSalesSync(refreshed, locMeta.code);

      return new Response(
        JSON.stringify({
          ok: true,
          mode: 'commit',
          dryRun: false,
          committedCount,
          skippedAlreadySynced,
          payload: refreshed,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Default mode: 'stage' incoming bookmarklet sales payload (always Dry-Run preview, zero DB writes to items/sales)
    const rawRows = Array.isArray(body?.rows)
      ? body.rows
      : Array.isArray(body?.sales)
        ? body.sales
        : [];
    const rawAdjustments = Array.isArray(body?.spaceRentalAdjustments)
      ? body.spaceRentalAdjustments
      : [];
    const stagedPayload = await enrichAndMatchSalesRows(rawRows, locMeta.code, {
      spaceRentalAdjustments: rawAdjustments,
      dryRun: true,
    });
    await savePersistedSalesSync(stagedPayload, locMeta.code);

    return new Response(
      JSON.stringify({
        ok: true,
        mode: 'stage',
        dryRun: true,
        locationCode: locMeta.code,
        reconcilerPath: `/sales/import/${locMeta.code}`,
        summary: stagedPayload.summary,
        payload: stagedPayload,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'Failed to process Ricochet sales sync' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};


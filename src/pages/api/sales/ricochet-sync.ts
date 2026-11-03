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

export interface RicochetSyncSaleLine {
  ricoItemId: string;
  sku: string;
  upc: string;
  title: string;
  soldDate: string;
  grossPrice: number;
  ricoNetPayout: number;
  ricoCommission: number;
  payoutId: string;
  status: string;
  expectedFee?: number;
  expectedNetPayout?: number;
  matchedItemId?: string;
  matchedItemUpc?: string;
  matchedItemTitle?: string;
  matchedItemCost?: number;
  matchTier?: 'upc' | 'sku' | 'title' | 'unmatched';
  alreadySynced?: boolean;
  ticketOccurrence?: number;
}

export interface RicochetSalesSyncPayload {
  timestamp: string;
  locationCode: string;
  locationName: string;
  commissionRate: number;
  monthlyRent: number;
  syncedAt?: string;
  summary: {
    soldFound: number;
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
  locCode: string
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
  const byTitle = new Map<string, any>();

  for (const item of eligibleItems) {
    const u = cleanCatalogSku(item.upc).toUpperCase();
    const s = cleanCatalogSku(item.locationSku || item.sku).toUpperCase();
    const t = normalizeTitleSlug(item.title || item.identity || '');
    if (u && !byUpc.has(u)) byUpc.set(u, item);
    if (s && !bySku.has(s)) bySku.set(s, item);
    if (t && t.length >= 4 && !byTitle.has(t)) byTitle.set(t, item);
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
    const sku = cleanCatalogSku(r.sku || r.extractedSku || '').toUpperCase();
    const upc = cleanCatalogSku(r.upc || r.expectedRcUpc || '').toUpperCase();
    const title = String(r.title || r.itemName || r.name || sku || 'Booth Sale Item').trim();
    const soldDate = String(r.soldDate || r.date || new Date().toISOString().slice(0, 10)).trim();
    const grossPrice = Math.max(0, Number(Number(r.grossPrice ?? r.agreedPrice ?? r.listedPrice ?? r.price ?? 0).toFixed(2)));
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
    const payoutId = String(r.payoutId || r.ticketNumber || r.saleNumber || '').trim();
    const status = String(r.status || r.inventory || 'Sold').trim();

    // 3-Tier Matching: 1) Exact UPC, 2) Normalized SKU, 3) Normalized Title / Memory Den Matcher
    let matchedItem: any = null;
    let matchTier: 'upc' | 'sku' | 'title' | 'unmatched' = 'unmatched';

    if (upc && byUpc.has(upc)) {
      matchedItem = byUpc.get(upc);
      matchTier = 'upc';
    } else if (sku && bySku.has(sku)) {
      matchedItem = bySku.get(sku);
      matchTier = 'sku';
    } else {
      const titleSlug = normalizeTitleSlug(title);
      if (titleSlug && byTitle.has(titleSlug)) {
        matchedItem = byTitle.get(titleSlug);
        matchTier = 'title';
      } else if (eligibleItems.length > 0) {
        const fuzzy = matchMemoryDenInventoryItem({
          sku,
          upc,
          title,
          price: grossPrice,
          extraText: '',
          allowPrefixForPayout: true,
          activeItems: eligibleItems,
          claimedItemIdToSku,
          multiBinResolvedBySku,
        });
        if (fuzzy) {
          matchedItem = fuzzy;
          matchTier = sku && cleanCatalogSku(fuzzy.locationSku).toUpperCase() === sku ? 'sku' : 'title';
        }
      }
    }

    const grossKey = grossPrice.toFixed(2);
    const isItemAlreadySoldInDb =
      matchedItem &&
      String(matchedItem.status || '').toLowerCase() === 'sold' &&
      !PREVERIFIED_MD_MULTI_QTY_BINS[sku];
    const isSaleInLedger =
      (payoutId && existingOrderIds.has(`${payoutId.toUpperCase()}|${grossKey}`)) ||
      (sku && existingSkuGrossSet.add && existingSkuGrossSet.has(`${sku}|${grossKey}`)) ||
      (upc && existingSkuGrossSet.has(`${upc}|${grossKey}`)) ||
      (matchedItem?.upc && existingSkuGrossSet.has(`${String(matchedItem.upc).toUpperCase()}|${grossKey}`));

    return {
      ricoItemId: String(r.ricoItemId || r.productId || r.id || `${ idx + 1 }`),
      sku,
      upc: upc || cleanCatalogSku(matchedItem?.upc || '').toUpperCase(),
      title,
      soldDate,
      grossPrice,
      ricoNetPayout,
      ricoCommission,
      payoutId,
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
  let matchedCount = 0;
  let alreadySyncedCount = 0;
  let unmatchedCount = 0;

  for (const r of normalizedRows) {
    grossSales += Number(r.grossPrice || 0);
    expectedCommission += Number(r.expectedFee ?? r.ricoCommission ?? 0);
    expectedNetPayout += Number(r.ricoNetPayout ?? r.expectedNetPayout ?? 0);
    if (r.alreadySynced) alreadySyncedCount++;
    if (r.matchedItemId || r.matchTier !== 'unmatched') matchedCount++;
    else unmatchedCount++;
  }

  grossSales = Number(grossSales.toFixed(2));
  expectedCommission = Number(expectedCommission.toFixed(2));
  expectedNetPayout = Number(expectedNetPayout.toFixed(2));
  const netAfterRent = Number((expectedNetPayout - monthlyRent).toFixed(2));

  return {
    timestamp: new Date().toISOString(),
    locationCode: locMeta.code,
    locationName: locMeta.shortName,
    commissionRate: feePct,
    monthlyRent,
    summary: {
      soldFound: normalizedRows.length,
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
          payload = await enrichAndMatchSalesRows(soldFromVerify, locMeta.code);
          await savePersistedSalesSync(payload, locMeta.code);
        }
      }
    } else {
      payload = await enrichAndMatchSalesRows(payload.rows, locMeta.code);
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

    if (mode === 'commit') {
      const { databases, dbId, itemsCol, salesCol } = getAppwriteConfig();
      const currentPayload =
        Array.isArray(body?.rows) && body.rows.length > 0
          ? await enrichAndMatchSalesRows(body.rows, locMeta.code)
          : await loadPersistedSalesSync(locMeta.code);

      if (!currentPayload || !Array.isArray(currentPayload.rows) || currentPayload.rows.length === 0) {
        return new Response(
          JSON.stringify({ ok: false, error: 'No staged Ricochet sales rows to commit.' }),
          { status: 400, headers: CORS_HEADERS }
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
      const refreshed = await enrichAndMatchSalesRows(currentPayload.rows, locMeta.code);
      refreshed.syncedAt = currentPayload.syncedAt;
      await savePersistedSalesSync(refreshed, locMeta.code);

      return new Response(
        JSON.stringify({
          ok: true,
          mode: 'commit',
          committedCount,
          skippedAlreadySynced,
          payload: refreshed,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Default mode: 'stage' incoming bookmarklet sales payload
    const rawRows = Array.isArray(body?.rows)
      ? body.rows
      : Array.isArray(body?.sales)
        ? body.sales
        : [];
    const stagedPayload = await enrichAndMatchSalesRows(rawRows, locMeta.code);
    await savePersistedSalesSync(stagedPayload, locMeta.code);

    return new Response(
      JSON.stringify({
        ok: true,
        mode: 'stage',
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


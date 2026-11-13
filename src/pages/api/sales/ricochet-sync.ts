import type { APIRoute } from 'astro';
import {
  Client as NodeClient,
  Databases as NodeDatabases,
  ID as NodeID,
  Permission as NodePermission,
  Role as NodeRole,
  Query as NodeQuery,
} from 'node-appwrite';
import { PREVERIFIED_MD_MULTI_QTY_BINS, canonicalTicketNumber, cleanCatalogSku } from '../../../lib/salesBucketing';
import {
  type RicochetSalesSyncPayload,
  type RicochetSyncSaleLine,
  type SpaceRentalAdjustment,
  buildEnrichedRicochetSalesPayload,
  buildSaleOrderReference,
  mergeRicochetCsvRows,
  parseRicochetExportCsv,
  resolveRicochetLocation,
} from '../../../lib/ricochetPayoutParser';
import { getLocationManifestDocIds } from '../../../lib/warehouses';
import { loadLiveWarehouseDocs } from '../../../lib/locationSettingsServer';
import { BML_CORS_HEADERS, requireBookmarkletMember } from '../../../lib/bml/serverAuth';

export type { RicochetSalesSyncPayload, RicochetSyncSaleLine, SpaceRentalAdjustment };
export const prerender = false;

const CORS_HEADERS: Record<string, string> = BML_CORS_HEADERS;

const MANIFESTS_COL_ID = 'manifests';

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
    const res = await fetch(`${endpoint}/databases/${dbId}/collections/${colId}/documents/${docId}`, {
      method: 'GET',
      headers,
    });
    if (res.ok) return await res.json();
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
    notes: JSON.stringify({ timestamp: payload.timestamp, summary: payload.summary }).slice(0, 4900),
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

export interface StagedRawCsv {
  payout?: string;
  payoutHistory?: string;
  payoutHistoryPageCount?: number;
  capturedAt?: string;
  /** Layer 2 state lock: 'staged' until a full live commit succeeds, then 'committed'. */
  status?: 'staged' | 'committed';
  committed_at?: string;
  committed_count?: number;
}

const MAX_RAW_CSV_CHARS = 600_000;

function normalizeRawCsvBody(raw: any): StagedRawCsv {
  const clip = (v: any) => (typeof v === 'string' ? v.slice(0, MAX_RAW_CSV_CHARS) : '');
  if (typeof raw === 'string') return { payout: clip(raw) };
  if (!raw || typeof raw !== 'object') return {};
  return { payout: clip(raw.payout), payoutHistory: clip(raw.payoutHistory) };
}

const getStoredRawCsv = (locCode: string): StagedRawCsv | null => {
  const map = (globalThis as any).__LATEST_RICOCHET_RAW_CSV__ || {};
  return map[locCode] || null;
};

async function loadPersistedRawCsv(locCode: string): Promise<StagedRawCsv | null> {
  const { code, rawCsvDocId } = getLocationManifestDocIds(locCode);
  try {
    const doc: any = await fetchAppwriteDocFallback(MANIFESTS_COL_ID, rawCsvDocId);
    const rawSnap = doc?.itemsSnapshot;
    if (rawSnap) {
      const parsed = typeof rawSnap === 'string' ? JSON.parse(rawSnap) : rawSnap;
      if (parsed && (parsed.payout || parsed.payoutHistory || parsed.status)) {
        if (!(globalThis as any).__LATEST_RICOCHET_RAW_CSV__) (globalThis as any).__LATEST_RICOCHET_RAW_CSV__ = {};
        (globalThis as any).__LATEST_RICOCHET_RAW_CSV__[code] = parsed;
        return parsed as StagedRawCsv;
      }
    }
  } catch {}
  return getStoredRawCsv(code);
}

/** Persists the RAW Export CSV text + commit-state lock to a `manifests` staging doc (never touches items/sales). */
async function savePersistedRawCsv(
  rawCsv: StagedRawCsv,
  locCode: string,
  opts?: { force?: boolean }
): Promise<void> {
  if (!opts?.force && !rawCsv.payout && !rawCsv.payoutHistory) return;
  const locMeta = resolveRicochetLocation(locCode);
  const { code, rawCsvDocId } = getLocationManifestDocIds(locMeta.code);
  const stored: StagedRawCsv = { ...rawCsv, capturedAt: rawCsv.capturedAt || new Date().toISOString() };
  if (!(globalThis as any).__LATEST_RICOCHET_RAW_CSV__) (globalThis as any).__LATEST_RICOCHET_RAW_CSV__ = {};
  (globalThis as any).__LATEST_RICOCHET_RAW_CSV__[code] = stored;

  const { databases, dbId } = getAppwriteConfig();
  if (!databases) return;
  const docPerms = [
    NodePermission.read(NodeRole.any()),
    NodePermission.update(NodeRole.any()),
    NodePermission.delete(NodeRole.any()),
  ];
  const docPayload: Record<string, any> = {
    name: `${locMeta.shortName} Raw Ricochet Export CSVs`,
    tenantId: 'system',
    locationId: locMeta.id,
    locationName: locMeta.shortName,
    status: 'system_sales_sync_raw_csv',
    itemCount: 0,
    itemsSnapshot: JSON.stringify(stored),
    notes: JSON.stringify({ capturedAt: stored.capturedAt }).slice(0, 4900),
  };
  try {
    await databases.updateDocument(dbId, MANIFESTS_COL_ID, rawCsvDocId, docPayload, docPerms);
  } catch (updateErr: any) {
    if (updateErr?.code === 404 || String(updateErr?.message || '').includes('not be found')) {
      try {
        await databases.createDocument(dbId, MANIFESTS_COL_ID, rawCsvDocId, docPayload, docPerms);
      } catch {}
    }
  }
}

/** Layer 2: stamps the staging manifest `status: 'committed'`, `committed_at`, `committed_count`. */
async function markRawCsvManifestCommitted(locCode: string, committedCount: number): Promise<StagedRawCsv> {
  const prev = (await loadPersistedRawCsv(locCode)) || {};
  const next: StagedRawCsv = {
    ...prev,
    status: 'committed',
    committed_at: new Date().toISOString(),
    committed_count: committedCount,
  };
  await savePersistedRawCsv(next, locCode, { force: true });
  return next;
}

/**
 * Ingests `body.rawCsv` (Payout + Payout History Export CSVs) and `body.payoutHistoryPages` (every harvested
 * "N out of M" page) on top of the bookmarklet's staged rows, without double counting any sale.
 */
function ingestRawCsvAndPages(
  body: any,
  baseRows: any[],
  baseAdjustments: SpaceRentalAdjustment[] | undefined
): { rows: any[]; adjustments: SpaceRentalAdjustment[]; rawCsv: StagedRawCsv } {
  const rawCsv = normalizeRawCsvBody(body?.rawCsv);
  const csvRows: any[] = [];
  const csvAdjustments: SpaceRentalAdjustment[] = [];
  for (const text of [rawCsv.payout, rawCsv.payoutHistory]) {
    if (!text) continue;
    const parsed = parseRicochetExportCsv(text);
    csvRows.push(...parsed.rows);
    csvAdjustments.push(...parsed.spaceRentalAdjustments);
  }

  const pages: any[] = Array.isArray(body?.payoutHistoryPages) ? body.payoutHistoryPages : [];
  const pageRows: any[] = [];
  for (const p of pages) {
    if (p && Array.isArray(p.rows)) pageRows.push(...p.rows);
  }
  rawCsv.payoutHistoryPageCount = pages.length;

  let rows = mergeRicochetCsvRows(baseRows, pageRows);
  rows = mergeRicochetCsvRows(rows, csvRows);

  const seen = new Set<string>();
  const adjustments: SpaceRentalAdjustment[] = [];
  for (const a of [...(baseAdjustments || []), ...csvAdjustments]) {
    const key = `${a.label}|${a.date}|${Number(a.amount || 0).toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    adjustments.push(a);
  }
  return { rows, adjustments, rawCsv };
}

async function fetchAllItemsAndSales(opts?: { salesOnly?: boolean }) {
  const { endpoint, project, apiKey, dbId, itemsCol, salesCol, databases } = getAppwriteConfig();
  const allItems: any[] = [];
  const allSales: any[] = [];

  const targets = (
    opts?.salesOnly
      ? [[salesCol, allSales]]
      : [
          [itemsCol, allItems],
          [salesCol, allSales],
        ]
  ) as Array<readonly [string, any[]]>;

  for (const [col, target] of targets) {
    if (databases) {
      try {
        let cursor: string | null = null;
        for (let page = 0; page < 25; page++) {
          const queries: string[] = [NodeQuery.limit(100), NodeQuery.orderDesc('$id')];
          if (cursor) queries.push(NodeQuery.cursorAfter(cursor));
          const res = await databases.listDocuments(dbId, col, queries);
          const docs = res.documents || [];
          target.push(...docs);
          if (docs.length < 100) break;
          cursor = docs[docs.length - 1].$id;
        }
      } catch {}
    }
    if (target.length === 0 && endpoint && project) {
      try {
        const headers: Record<string, string> = {
          'X-Appwrite-Project': project,
          'Content-Type': 'application/json',
        };
        if (apiKey) headers['X-Appwrite-Key'] = apiKey;
        let offset = 0;
        for (let page = 0; page < 25; page++) {
          const qLimit = encodeURIComponent(JSON.stringify({ method: 'limit', values: [100] }));
          const qOffset = encodeURIComponent(JSON.stringify({ method: 'offset', values: [offset] }));
          const qOrder = encodeURIComponent(JSON.stringify({ method: 'orderDesc', attribute: '$id' }));
          const res = await fetch(
            `${endpoint}/databases/${dbId}/collections/${col}/documents?queries[]=${qLimit}&queries[]=${qOffset}&queries[]=${qOrder}`,
            { method: 'GET', headers }
          );
          if (!res.ok) break;
          const data = await res.json();
          const docs = data?.documents || [];
          target.push(...docs);
          if (docs.length < 100) break;
          offset += docs.length;
        }
      } catch {}
    }
  }

  return { allItems, allSales };
}

async function fetchLocationVerifyCatalogRows(locCode: string): Promise<any[]> {
  try {
    const { reportDocId } = getLocationManifestDocIds(locCode);
    const reportDoc = await fetchAppwriteDocFallback(MANIFESTS_COL_ID, reportDocId);
    const rawReport = reportDoc?.itemsSnapshot
      ? typeof reportDoc.itemsSnapshot === 'string'
        ? JSON.parse(reportDoc.itemsSnapshot)
        : reportDoc.itemsSnapshot
      : null;
    if (rawReport && Array.isArray(rawReport.rows)) {
      return rawReport.rows;
    }
  } catch {}
  return [];
}

async function enrichAndMatchSalesRows(
  rawRows: any[],
  locCode: string,
  extraOptions?: { spaceRentalAdjustments?: SpaceRentalAdjustment[]; dryRun?: boolean; salesSink?: any[] }
): Promise<RicochetSalesSyncPayload> {
  const [{ allItems, allSales }, catalogReportRows, liveWarehouses] = await Promise.all([
    fetchAllItemsAndSales(),
    fetchLocationVerifyCatalogRows(locCode),
    loadLiveWarehouseDocs(),
  ]);
  // Hand the already-fetched sales to the caller (commit shield) so they are not downloaded a second time
  if (extraOptions?.salesSink) extraOptions.salesSink.push(...allSales);
  return buildEnrichedRicochetSalesPayload({
    rawRows,
    locCode,
    allItems,
    allSales,
    catalogReportRows,
    liveWarehouses,
    spaceRentalAdjustments: extraOptions?.spaceRentalAdjustments,
    dryRun: extraOptions?.dryRun,
  });
}

/**
 * Creates a `sales` document and survives schema drift: if Appwrite rejects the request because an OPTIONAL attribute is not in the
 * collection schema ("Unknown attribute: tenantId" → 400), that attribute is dropped and the write is retried instead of failing the batch.
 */
const OPTIONAL_SALE_ATTRIBUTES = new Set(['tenantId', 'shippingCharged', 'shippingCost', 'orderId', 'commissionFee']);

async function createSaleDocSchemaSafe(
  databases: NodeDatabases,
  dbId: string,
  salesCol: string,
  doc: Record<string, any>
): Promise<any> {
  const payload: Record<string, any> = { ...doc };
  let lastErr: any = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await databases.createDocument(dbId, salesCol, NodeID.unique(), payload);
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message || '');
      const m = msg.match(/Unknown attribute:?\s*"?([A-Za-z0-9_]+)"?/i);
      const attr = m?.[1];
      if (attr && OPTIONAL_SALE_ATTRIBUTES.has(attr) && attr in payload) {
        delete payload[attr];
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export const OPTIONS: APIRoute = async () => new Response(null, { status: 204, headers: CORS_HEADERS });

export const GET: APIRoute = async ({ request, url }) => {
  const auth = await requireBookmarkletMember(request);
  if (!auth.ok) return auth.response;

  try {
    const liveWarehouses = await loadLiveWarehouseDocs();
    const locMeta = resolveRicochetLocation(url.searchParams.get('location'), liveWarehouses);
    let payload = await loadPersistedSalesSync(locMeta.code);
    const stagedRawCsv = await loadPersistedRawCsv(locMeta.code);

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
        rawCsv: stagedRawCsv || null,
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
  const auth = await requireBookmarkletMember(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const rawLoc = body?.locationCode || body?.location || url.searchParams.get('location');
    const liveWarehouses = await loadLiveWarehouseDocs();
    const locMeta = resolveRicochetLocation(rawLoc, liveWarehouses);
    const mode = String(body?.mode || 'stage').toLowerCase();
    const isDryRunRequest =
      mode === 'dry_run' || mode === 'simulate' || Boolean(body?.dryRun && mode !== 'commit');

    // Layer 2 (Staging Manifest State Lock): after every batch succeeded, refresh the ledger flags and stamp the manifest `committed`
    if (mode === 'finalize') {
      const failedCount = Number(body?.failedCount || 0);
      const committedCount = Math.max(0, Number(body?.committedCount || 0));
      const persisted = await loadPersistedSalesSync(locMeta.code);
      let refreshedPayload: RicochetSalesSyncPayload | null = null;
      if (persisted && Array.isArray(persisted.rows) && persisted.rows.length > 0) {
        refreshedPayload = await enrichAndMatchSalesRows(persisted.rows, locMeta.code, {
          spaceRentalAdjustments: persisted.spaceRentalAdjustments,
          dryRun: false,
        });
        refreshedPayload.syncedAt = new Date().toISOString();
        await savePersistedSalesSync(refreshedPayload, locMeta.code);
      }
      const manifest =
        failedCount === 0
          ? await markRawCsvManifestCommitted(locMeta.code, committedCount)
          : ((await loadPersistedRawCsv(locMeta.code)) || null);
      return new Response(
        JSON.stringify({
          ok: true,
          mode: 'finalize',
          dryRun: false,
          locked: failedCount === 0,
          failedCount,
          manifest,
          payload: refreshedPayload,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    if (mode === 'commit' || mode === 'dry_run' || mode === 'simulate') {
      const { databases, dbId, itemsCol, salesCol } = getAppwriteConfig();
      const isBatchedCommit = mode === 'commit' && Boolean(body?.batch);
      const persisted = await loadPersistedSalesSync(locMeta.code);
      const sourceRows =
        Array.isArray(body?.rows) && body.rows.length > 0
          ? body.rows
          : Array.isArray(persisted?.rows)
            ? persisted.rows
            : [];
      const preloadedSales: any[] = [];
      const currentPayload =
        sourceRows.length > 0
          ? await enrichAndMatchSalesRows(sourceRows, locMeta.code, {
              spaceRentalAdjustments: body?.spaceRentalAdjustments || persisted?.spaceRentalAdjustments,
              dryRun: isDryRunRequest,
              salesSink: preloadedSales,
            })
          : persisted;

      if (!currentPayload || !Array.isArray(currentPayload.rows) || currentPayload.rows.length === 0) {
        return new Response(
          JSON.stringify({ ok: false, error: 'No staged Ricochet sales rows to commit.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      if (isDryRunRequest) {
        let wouldCommitCount = 0;
        let skippedAlreadySynced = 0;
        let wouldGross = 0;
        let wouldNet = 0;
        for (const row of currentPayload.rows) {
          if (row.alreadySynced || row.alreadyRecorded) {
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
            alreadySyncedCount: skippedAlreadySynced,
            wouldGross: Number(wouldGross.toFixed(2)),
            wouldNet: Number(wouldNet.toFixed(2)),
            payload: currentPayload,
          }),
          { status: 200, headers: CORS_HEADERS }
        );
      }

      let committedCount = 0;
      let skippedAlreadySynced = 0;
      let skippedDuplicateTickets = 0;
      let failedCount = 0;
      const commitErrors: string[] = [];
      const recordCommitError = (msg: string) => {
        const clean = String(msg || '').trim();
        if (clean && !commitErrors.includes(clean) && commitErrors.length < 5) commitErrors.push(clean);
      };
      const tenantId = String(body?.tenantId || '').trim();

      // Layer 3 (Database Idempotency Shield): ticket number + sale date + location must be unique in `sales`
      const saleShieldKey = (warehouseId: string, orderRef: string, saleIso: string) =>
        `${String(warehouseId || '').trim()}|${String(orderRef || '').trim().toUpperCase()}|${String(saleIso || '').slice(0, 10)}`;
      const existingSaleKeys = new Set<string>();
      if (databases) {
        const existingSales = preloadedSales.length > 0 ? preloadedSales : (await fetchAllItemsAndSales({ salesOnly: true })).allSales;
        for (const s of existingSales) {
          if (s?.status === 'Cancelled') continue;
          existingSaleKeys.add(saleShieldKey(s?.warehouseId, s?.orderId, s?.saleDate));
        }
      }

      if (databases) {
        for (const row of currentPayload.rows) {
          if (row.alreadySynced) {
            skippedAlreadySynced++;
            continue;
          }
          if (!row.matchedItemId && !row.sku && !row.title) continue;

          const gross = Number(row.grossPrice || 0);
          const fee = Number(row.expectedFee ?? row.ricoCommission ?? 0);
          const net = Number(row.ricoNetPayout ?? row.expectedNetPayout ?? 0);
          const { saleIso, orderRef, soNumber } = buildSaleOrderReference(row, locMeta.code);
          const hasRealTicket = Boolean(canonicalTicketNumber(row.payoutId || row.saleNumber));
          const shieldKey = saleShieldKey(locMeta.id, orderRef, saleIso);
          if (hasRealTicket && existingSaleKeys.has(shieldKey)) {
            skippedDuplicateTickets++;
            row.alreadySynced = true;
            continue;
          }

          try {
            const createdSale = await createSaleDocSchemaSafe(databases, dbId, salesCol, {
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
            });

            // The sale is written; an item-update failure must not hide it (the ticket shield skips it on retry)
            row.alreadySynced = true;
            committedCount++;
            if (hasRealTicket) existingSaleKeys.add(shieldKey);

            if (row.matchedItemId) {
              try {
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
              } catch (itemErr: any) {
                recordCommitError(`Sale ${orderRef} saved but item update failed: ${itemErr?.message || itemErr}`);
              }
            }
          } catch (saleErr: any) {
            failedCount++;
            recordCommitError(String(saleErr?.message || saleErr || 'Appwrite rejected the sale document'));
          }
        }
      }

      // Batched commits (Layer 1 chunking) return a slim response and never overwrite the full staged payload
      if (isBatchedCommit) {
        return new Response(
          JSON.stringify({
            ok: true,
            mode: 'commit',
            dryRun: false,
            batch: body.batch,
            committedCount,
            skippedAlreadySynced,
            skippedDuplicateTickets,
            failedCount,
            errors: commitErrors,
          }),
          { status: 200, headers: CORS_HEADERS }
        );
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
          skippedDuplicateTickets,
          failedCount,
          payload: refreshed,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    const bodyRows = Array.isArray(body?.rows)
      ? body.rows
      : Array.isArray(body?.sales)
        ? body.sales
        : [];
    const bodyAdjustments = Array.isArray(body?.spaceRentalAdjustments)
      ? body.spaceRentalAdjustments
      : [];
    const ingested = ingestRawCsvAndPages(body, bodyRows, bodyAdjustments);
    const stagedPayload = await enrichAndMatchSalesRows(ingested.rows, locMeta.code, {
      spaceRentalAdjustments: ingested.adjustments,
      dryRun: true,
    });
    await savePersistedSalesSync(stagedPayload, locMeta.code);
    // A fresh stage re-opens the manifest lock (status back to 'staged'); only rewrite when there's CSV text or a lock to clear
    const priorRawCsv = await loadPersistedRawCsv(locMeta.code);
    const hasNewCsvText = Boolean(ingested.rawCsv.payout || ingested.rawCsv.payoutHistory);
    ingested.rawCsv.status = 'staged';
    if (hasNewCsvText || priorRawCsv?.status === 'committed') {
      await savePersistedRawCsv(ingested.rawCsv, locMeta.code, { force: true });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        mode: 'stage',
        dryRun: true,
        locationCode: locMeta.code,
        reconcilerPath: `/sales/import/${locMeta.code}`,
        summary: stagedPayload.summary,
        rawCsv: ingested.rawCsv.payout || ingested.rawCsv.payoutHistory ? ingested.rawCsv : null,
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

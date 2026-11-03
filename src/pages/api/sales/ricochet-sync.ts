import type { APIRoute } from 'astro';
import {
  Client as NodeClient,
  Databases as NodeDatabases,
  ID as NodeID,
  Permission as NodePermission,
  Role as NodeRole,
  Query as NodeQuery,
} from 'node-appwrite';
import { PREVERIFIED_MD_MULTI_QTY_BINS, cleanCatalogSku } from '../../../lib/salesBucketing';
import {
  type RicochetSalesSyncPayload,
  type RicochetSyncSaleLine,
  type SpaceRentalAdjustment,
  buildEnrichedRicochetSalesPayload,
  buildSaleOrderReference,
  resolveRicochetLocation,
} from '../../../lib/ricochetPayoutParser';
import { getLocationManifestDocIds } from '../../../lib/warehouses';

export type { RicochetSalesSyncPayload, RicochetSyncSaleLine, SpaceRentalAdjustment };
export const prerender = false;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

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

async function fetchAllItemsAndSales() {
  const { endpoint, project, apiKey, dbId, itemsCol, salesCol, databases } = getAppwriteConfig();
  const allItems: any[] = [];
  const allSales: any[] = [];

  for (const [col, target] of [
    [itemsCol, allItems],
    [salesCol, allSales],
  ] as const) {
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
  extraOptions?: { spaceRentalAdjustments?: SpaceRentalAdjustment[]; dryRun?: boolean }
): Promise<RicochetSalesSyncPayload> {
  const [{ allItems, allSales }, catalogReportRows] = await Promise.all([
    fetchAllItemsAndSales(),
    fetchLocationVerifyCatalogRows(locCode),
  ]);
  return buildEnrichedRicochetSalesPayload({
    rawRows,
    locCode,
    allItems,
    allSales,
    catalogReportRows,
    spaceRentalAdjustments: extraOptions?.spaceRentalAdjustments,
    dryRun: extraOptions?.dryRun,
  });
}

export const OPTIONS: APIRoute = async () => new Response(null, { status: 204, headers: CORS_HEADERS });

export const GET: APIRoute = async ({ url }) => {
  try {
    const locMeta = resolveRicochetLocation(url.searchParams.get('location'));
    let payload = await loadPersistedSalesSync(locMeta.code);

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
      const sourceRows =
        Array.isArray(body?.rows) && body.rows.length > 0
          ? body.rows
          : Array.isArray(persisted?.rows)
            ? persisted.rows
            : [];
      const currentPayload =
        sourceRows.length > 0
          ? await enrichAndMatchSalesRows(sourceRows, locMeta.code, {
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
      const tenantId = String(body?.tenantId || '').trim();

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

          try {
            const createdSale = await databases.createDocument(dbId, salesCol, NodeID.unique(), {
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

import type { APIRoute } from 'astro';
import {
  Client as NodeClient,
  Databases as NodeDatabases,
  Permission as NodePermission,
  Role as NodeRole,
  Query as NodeQuery,
} from 'node-appwrite';
import {
  PREVERIFIED_MD_SKU_TO_UPC_OR_ID,
  buildLockedMultiBinMap,
  cleanCatalogSku,
  isBbConsignorRow,
  matchMemoryDenInventoryItem,
  MD_CANONICAL_WAREHOUSE_ID,
} from '../../lib/salesBucketing';

export const prerender = false;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const PERSISTED_REPORT_DOC_ID = 'md_verify_report_latest';
const PERSISTED_PAYLOAD_DOC_ID = 'md_live_payload_latest';
const MANIFESTS_COL_ID = 'manifests';

export interface MdVerifyRow {
  productId: string;
  sku: string;
  upc: string;
  expectedRcUpc: string;
  verifyStatus: 'VERIFIED_MATCH' | 'MISSING_IN_MD' | 'MISMATCH_UPC' | 'UNLINKED_IN_RC';
  partner?: 'HUCK' | 'PDXGL' | 'BB' | 'UNLINKED';
  conflictReason?: string;
  name: string;
  agreedPrice: number;
  quantity: number;
  inventory: string;
}

export interface MdVerifyReportPayload {
  timestamp: string;
  source?: string;
  summary: {
    totalCatalog: number;
    verifiedMatch: number;
    missingInMd: number;
    mismatchUpc: number;
    unlinkedInRc: number;
  };
  rows: MdVerifyRow[];
}

export interface MdSkuMeta {
  upc: string;
  partner: 'HUCK' | 'PDXGL' | 'BB';
  title: string;
  price: number;
  status: string;
}

const getStoredReport = (): MdVerifyReportPayload | null => {
  return (globalThis as any).__LATEST_MD_VERIFY_REPORT__ || null;
};

const setStoredReport = (report: MdVerifyReportPayload) => {
  (globalThis as any).__LATEST_MD_VERIFY_REPORT__ = report;
};

const getStoredLivePayload = (): {
  skuToUpcMap: Record<string, string>;
  skuToMetaMap: Record<string, MdSkuMeta>;
} | null => {
  return (globalThis as any).__LATEST_MD_LIVE_PAYLOAD__ || null;
};

const setStoredLivePayload = (payload: {
  skuToUpcMap: Record<string, string>;
  skuToMetaMap: Record<string, MdSkuMeta>;
}) => {
  (globalThis as any).__LATEST_MD_LIVE_PAYLOAD__ = payload;
};

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

  let databases: NodeDatabases | null = null;
  if (endpoint && project) {
    const client = new NodeClient().setEndpoint(endpoint).setProject(project);
    if (apiKey) client.setKey(apiKey);
    databases = new NodeDatabases(client);
  }
  return { endpoint, project, apiKey, dbId, itemsCol, databases };
}

async function fetchAppwriteDocFallback(colId: string, docId: string): Promise<any | null> {
  const { endpoint, project, apiKey, dbId, databases } = getAppwriteConfig();
  if (databases) {
    try {
      return await databases.getDocument(dbId, colId, docId);
    } catch {
      // Fall through to direct REST fetch
    }
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

async function loadPersistedReportFromAppwrite(): Promise<MdVerifyReportPayload | null> {
  try {
    const doc: any = await fetchAppwriteDocFallback(MANIFESTS_COL_ID, PERSISTED_REPORT_DOC_ID);
    if (doc?.itemsSnapshot) {
      const parsed =
        typeof doc.itemsSnapshot === 'string' ? JSON.parse(doc.itemsSnapshot) : doc.itemsSnapshot;
      if (parsed && parsed.summary && Array.isArray(parsed.rows)) {
        setStoredReport(parsed);
        return parsed as MdVerifyReportPayload;
      }
    }
  } catch {
    // Document may not exist yet on first run
  }
  return getStoredReport();
}

async function getOrLoadReport(): Promise<MdVerifyReportPayload | null> {
  const loaded = await loadPersistedReportFromAppwrite();
  return loaded || getStoredReport();
}

async function savePersistedReportToAppwrite(report: MdVerifyReportPayload): Promise<void> {
  setStoredReport(report);
  const { databases, dbId } = getAppwriteConfig();
  if (!databases) return;

  const docPerms = [
    NodePermission.read(NodeRole.any()),
    NodePermission.update(NodeRole.any()),
    NodePermission.delete(NodeRole.any()),
  ];

  const docPayload: Record<string, any> = {
    name: 'Memory Den Live Barcode Verification Report',
    tenantId: 'system',
    locationId: MD_CANONICAL_WAREHOUSE_ID,
    locationName: 'Memory Den',
    status: 'system_sync_report',
    itemCount: Number(report.summary?.totalCatalog || report.rows?.length || 0),
    itemsSnapshot: JSON.stringify(report),
    notes: JSON.stringify({
      timestamp: report.timestamp,
      summary: report.summary,
    }).slice(0, 4900),
  };

  try {
    await databases.updateDocument(dbId, MANIFESTS_COL_ID, PERSISTED_REPORT_DOC_ID, docPayload, docPerms);
  } catch (updateErr: any) {
    if (updateErr?.code === 404 || String(updateErr?.message || '').includes('not be found')) {
      try {
        await databases.createDocument(
          dbId,
          MANIFESTS_COL_ID,
          PERSISTED_REPORT_DOC_ID,
          docPayload,
          docPerms
        );
      } catch (createErr) {
        console.warn('[/api/md-verify-report] Could not create persisted report doc:', (createErr as any)?.message);
      }
    } else {
      console.warn('[/api/md-verify-report] Could not update persisted report doc:', updateErr?.message);
    }
  }
}

async function loadPersistedLivePayloadFromAppwrite(): Promise<{
  skuToUpcMap: Record<string, string>;
  skuToMetaMap: Record<string, MdSkuMeta>;
} | null> {
  try {
    const doc: any = await fetchAppwriteDocFallback(MANIFESTS_COL_ID, PERSISTED_PAYLOAD_DOC_ID);
    if (doc?.itemsSnapshot) {
      const parsed =
        typeof doc.itemsSnapshot === 'string' ? JSON.parse(doc.itemsSnapshot) : doc.itemsSnapshot;
      if (parsed && parsed.skuToUpcMap && typeof parsed.skuToUpcMap === 'object') {
        const skuToUpcMap: Record<string, string> = parsed.skuToUpcMap || {};
        const skuToMetaMap: Record<string, MdSkuMeta> = parsed.skuToMetaMap || {};
        const soldSet = new Set<string>(Array.isArray(parsed.soldSkus) ? parsed.soldSkus : []);
        for (const [sku, upc] of Object.entries(skuToUpcMap)) {
          if (!skuToMetaMap[sku]) {
            skuToMetaMap[sku] = {
              upc,
              partner: detectPartnerFromUpcOrTitle(upc, ''),
              title: '',
              price: 0,
              status: soldSet.has(sku) ? 'sold' : 'placed',
            };
          }
        }
        const result = { skuToUpcMap, skuToMetaMap };
        setStoredLivePayload(result);
        return result;
      }
    }
  } catch {
    // Document may not exist yet on first run
  }
  return getStoredLivePayload();
}

async function savePersistedLivePayloadToAppwrite(payload: {
  skuToUpcMap: Record<string, string>;
  skuToMetaMap: Record<string, MdSkuMeta>;
}): Promise<void> {
  setStoredLivePayload(payload);
  const { databases, dbId } = getAppwriteConfig();
  if (!databases) return;

  const count = Object.keys(payload.skuToUpcMap || {}).length;
  if (count === 0) return;

  const soldSkus: string[] = [];
  for (const [sku, meta] of Object.entries(payload.skuToMetaMap || {})) {
    if (String(meta?.status || '').toLowerCase() === 'sold') {
      soldSkus.push(sku);
    }
  }

  const docPerms = [
    NodePermission.read(NodeRole.any()),
    NodePermission.update(NodeRole.any()),
    NodePermission.delete(NodeRole.any()),
  ];

  // Compact ~20KB snapshot so it never exceeds Appwrite's string attribute limit
  const docPayload: Record<string, any> = {
    name: 'Memory Den Live SKU-to-UPC Payload Map',
    tenantId: 'system',
    locationId: MD_CANONICAL_WAREHOUSE_ID,
    locationName: 'Memory Den',
    status: 'system_sync_payload',
    itemCount: count,
    itemsSnapshot: JSON.stringify({
      timestamp: new Date().toISOString(),
      count,
      skuToUpcMap: payload.skuToUpcMap,
      soldSkus,
    }),
    notes: JSON.stringify({
      timestamp: new Date().toISOString(),
      count,
    }).slice(0, 4900),
  };

  try {
    await databases.updateDocument(dbId, MANIFESTS_COL_ID, PERSISTED_PAYLOAD_DOC_ID, docPayload, docPerms);
  } catch (updateErr: any) {
    if (updateErr?.code === 404 || String(updateErr?.message || '').includes('not be found')) {
      try {
        await databases.createDocument(
          dbId,
          MANIFESTS_COL_ID,
          PERSISTED_PAYLOAD_DOC_ID,
          docPayload,
          docPerms
        );
      } catch (createErr) {
        console.warn('[/api/md-verify-report] Could not create persisted payload doc:', (createErr as any)?.message);
      }
    } else {
      console.warn('[/api/md-verify-report] Could not update persisted payload doc:', updateErr?.message);
    }
  }
}

function detectPartnerFromUpcOrTitle(upc: string, title = ''): 'HUCK' | 'PDXGL' | 'BB' {
  const u = cleanCatalogSku(upc).toUpperCase();
  if (u.startsWith('BB-') || isBbConsignorRow({ upc: u, title })) return 'BB';
  if (u.startsWith('PDXGL-')) return 'PDXGL';
  return 'HUCK';
}

function isValidProductionUpc(upc: string): boolean {
  const u = cleanCatalogSku(upc).toUpperCase();
  if (!u || !/^(HUCK-|PDXGL-|BB-)/i.test(u)) return false;
  if (/test|demo|sample/i.test(u)) return false;
  return true;
}

async function buildLiveMdPayloadFromAppwrite(): Promise<{
  skuToUpcMap: Record<string, string>;
  skuToMetaMap: Record<string, MdSkuMeta>;
  verifiedMdUpcBySku: Record<string, string>;
  duplicateUpcWarnings: Array<{ upc: string; skus: string[] }>;
}> {
  const skuToMetaMap: Record<string, MdSkuMeta> = {};
  const usedUpcs = new Set<string>();
  const rawUpcToSkus = new Map<string, Set<string>>();
  const finalSkuToUpcMap: Record<string, string> = {};
  const verifiedMdUpcBySku: Record<string, string> = {};

  const recordRawMapping = (sku: string, upc: string) => {
    if (!rawUpcToSkus.has(upc)) rawUpcToSkus.set(upc, new Set());
    rawUpcToSkus.get(upc)!.add(sku);
  };

  // 1. Query Appwrite resale_db.items live first (canonical dynamic source of truth — zero hardcoded collision maps)
  const { databases, apiKey, dbId, itemsCol } = getAppwriteConfig();
  const byId = new Map<string, any>();
  const allDocs: any[] = [];
  const candidatesBySku = new Map<string, any[]>();
  const allExistingUpcs = new Set<string>();
  let maxHuckNum = 9740;
  const databasesClient = apiKey && databases ? databases : null;

  if (databases) {
    try {
      let cursor: string | null = null;
      for (let page = 0; page < 25; page++) {
        const queries: string[] = [NodeQuery.limit(100), NodeQuery.orderDesc('$id')];
        if (cursor) queries.push(NodeQuery.cursorAfter(cursor));
        const res = await databases.listDocuments(dbId, itemsCol, queries);
        const docs = res.documents || [];
        for (const doc of docs as any[]) {
          if (doc?.$id) byId.set(doc.$id, doc);
          allDocs.push(doc);
          const sku = cleanCatalogSku(doc?.locationSku || doc?.sku).toUpperCase();
          const upc = cleanCatalogSku(doc?.upc).toUpperCase();
          const title = String(doc?.title || doc?.identity || '');
          if (upc) {
            allExistingUpcs.add(upc);
            const m = upc.match(/^HUCK-(\d{4})$/);
            if (m) {
              const n = parseInt(m[1], 10);
              if (n > maxHuckNum && n < 9900) maxHuckNum = n;
            }
          }
          if (!sku || !/^0EJ/i.test(sku) || !isValidProductionUpc(upc)) continue;
          if (/test|demo/i.test(title) && /test|demo/i.test(upc)) continue;

          if (!candidatesBySku.has(sku)) candidatesBySku.set(sku, []);
          candidatesBySku.get(sku)!.push(doc);
        }
        if (docs.length < 100) break;
        cursor = docs[docs.length - 1].$id;
      }
    } catch (err) {
      console.warn('[/api/md-verify-report] Live Appwrite query warning:', (err as any)?.message);
    }
  }

  const allocateUniqueHuckUpc = (preferred?: string): string => {
    if (preferred && !usedUpcs.has(preferred) && !allExistingUpcs.has(preferred)) {
      usedUpcs.add(preferred);
      allExistingUpcs.add(preferred);
      return preferred;
    }
    while (true) {
      maxHuckNum++;
      const cand = `HUCK-${String(maxHuckNum).padStart(4, '0')}`;
      if (!usedUpcs.has(cand) && !allExistingUpcs.has(cand)) {
        usedUpcs.add(cand);
        allExistingUpcs.add(cand);
        return cand;
      }
    }
  };

  // Sort SKUs so SKUs with exactly 1 DB candidate claim their UPC first, then multi-candidate SKUs pick the newest unclaimed UPC
  const sortedSkus = Array.from(candidatesBySku.keys()).sort((a, b) => {
    const lenA = candidatesBySku.get(a)!.length;
    const lenB = candidatesBySku.get(b)!.length;
    if (lenA !== lenB) return lenA - lenB;
    return a.localeCompare(b);
  });

  for (const sku of sortedSkus) {
    if (finalSkuToUpcMap[sku]) continue;
    const docsForSku = candidatesBySku.get(sku) || [];
    let chosen = docsForSku.find((d) => {
      const u = cleanCatalogSku(d?.upc).toUpperCase();
      return isValidProductionUpc(u) && !usedUpcs.has(u);
    });

    if (!chosen && docsForSku.length > 0) {
      const fallbackDoc = docsForSku[0];
      const newUniqueUpc = allocateUniqueHuckUpc();
      if (databasesClient && fallbackDoc?.$id) {
        try {
          await databasesClient.updateDocument(dbId, itemsCol, fallbackDoc.$id, {
            upc: newUniqueUpc,
            locationSku: sku,
          });
        } catch {}
      }
      fallbackDoc.upc = newUniqueUpc;
      chosen = fallbackDoc;
    }

    if (!chosen) continue;

    const upc = cleanCatalogSku(chosen.upc).toUpperCase();
    const title = String(chosen.title || chosen.identity || '');
    usedUpcs.add(upc);
    finalSkuToUpcMap[sku] = upc;
    recordRawMapping(sku, upc);
    skuToMetaMap[sku] = {
      upc,
      partner: detectPartnerFromUpcOrTitle(upc, title),
      title,
      price: Number(chosen.resalePrice || chosen.listPrice || chosen.price || chosen.soldPrice || 0),
      status: String(chosen.status || 'placed'),
    };
  }

  // 2. Merge PREVERIFIED_MD_SKU_TO_UPC_OR_ID for any SKU not yet in finalSkuToUpcMap (enforcing usedUpcs)
  for (const [rawSku, rawUpcOrId] of Object.entries(PREVERIFIED_MD_SKU_TO_UPC_OR_ID)) {
    const sku = cleanCatalogSku(rawSku).toUpperCase();
    if (!sku || !/^0EJ/i.test(sku) || finalSkuToUpcMap[sku]) continue;
    let resolvedUpc = cleanCatalogSku(rawUpcOrId).toUpperCase();
    let resolvedTitle = '';
    let resolvedPrice = 0;
    let resolvedStatus = 'placed';

    if (!/^(HUCK-|PDXGL-|BB-)/i.test(resolvedUpc)) {
      const matchedDoc = byId.get(String(rawUpcOrId).trim());
      if (matchedDoc?.upc) {
        resolvedUpc = cleanCatalogSku(matchedDoc.upc).toUpperCase();
        resolvedTitle = String(matchedDoc.title || matchedDoc.identity || '');
        resolvedPrice = Number(matchedDoc.resalePrice || matchedDoc.listPrice || matchedDoc.price || 0);
        resolvedStatus = String(matchedDoc.status || 'placed');
      } else {
        continue;
      }
    }

    if (!isValidProductionUpc(resolvedUpc)) continue;
    if (usedUpcs.has(resolvedUpc)) continue;

    usedUpcs.add(resolvedUpc);
    finalSkuToUpcMap[sku] = resolvedUpc;
    recordRawMapping(sku, resolvedUpc);
    skuToMetaMap[sku] = {
      upc: resolvedUpc,
      partner: detectPartnerFromUpcOrTitle(resolvedUpc, resolvedTitle),
      title: resolvedTitle,
      price: resolvedPrice,
      status: resolvedStatus,
    };
  }

  // 3. Merge any live payload pushed from LocationSyncView.vue or persisted in Appwrite manifests ('md_live_payload_latest')
  const cachedLive = (await loadPersistedLivePayloadFromAppwrite()) || getStoredLivePayload();
  if (cachedLive?.skuToUpcMap) {
    for (const [rawSku, rawUpc] of Object.entries(cachedLive.skuToUpcMap)) {
      const sku = cleanCatalogSku(rawSku).toUpperCase();
      const upc = cleanCatalogSku(rawUpc).toUpperCase();
      if (!sku || !/^0EJ/i.test(sku) || finalSkuToUpcMap[sku] || !isValidProductionUpc(upc)) continue;
      if (usedUpcs.has(upc)) continue;

      usedUpcs.add(upc);
      finalSkuToUpcMap[sku] = upc;
      recordRawMapping(sku, upc);
      const meta = cachedLive.skuToMetaMap?.[sku];
      skuToMetaMap[sku] = {
        upc,
        partner: meta?.partner || detectPartnerFromUpcOrTitle(upc, meta?.title || ''),
        title: meta?.title || '',
        price: Number(meta?.price || 0),
        status: meta?.status || 'placed',
      };
    }
  }

  // 4. Load persisted Verification Report from Appwrite (if RAM is cold) and extract verifiedMdUpcBySku + remaining matches
  const storedReport = await getOrLoadReport();
  if (storedReport?.rows?.length) {
    for (const r of storedReport.rows) {
      const sku = cleanCatalogSku(r.sku).toUpperCase();
      const actualMdUpc = cleanCatalogSku(r.upc).toUpperCase();
      const expUpc = cleanCatalogSku(r.expectedRcUpc).toUpperCase();
      if (sku && /^0EJ/i.test(sku) && isValidProductionUpc(actualMdUpc)) {
        verifiedMdUpcBySku[sku] = actualMdUpc;
      }
      const candidateReportUpc = isValidProductionUpc(expUpc)
        ? expUpc
        : isValidProductionUpc(actualMdUpc)
          ? actualMdUpc
          : '';
      if (sku && /^0EJ/i.test(sku) && candidateReportUpc && !finalSkuToUpcMap[sku] && !usedUpcs.has(candidateReportUpc)) {
        usedUpcs.add(candidateReportUpc);
        finalSkuToUpcMap[sku] = candidateReportUpc;
        recordRawMapping(sku, candidateReportUpc);
        skuToMetaMap[sku] = {
          upc: candidateReportUpc,
          partner: detectPartnerFromUpcOrTitle(candidateReportUpc, String(r.name || '')),
          title: String(r.name || ''),
          price: Number(r.agreedPrice || 0),
          status: String(r.inventory || '').toLowerCase().includes('sold') || String(r.inventory || '').toLowerCase().includes('paid') ? 'sold' : 'placed',
        };
      }
    }

    if (allDocs.length > 0) {
      const claimedItemIdToSku = new Map<string, string>();
      for (const doc of allDocs) {
        const dSku = cleanCatalogSku(doc?.locationSku || doc?.sku).toUpperCase();
        if (dSku && finalSkuToUpcMap[dSku] && cleanCatalogSku(doc?.upc).toUpperCase() === finalSkuToUpcMap[dSku]) {
          claimedItemIdToSku.set(doc.$id, dSku);
        }
      }
      const multiBinResolvedBySku = buildLockedMultiBinMap(allDocs, claimedItemIdToSku);
      for (const r of storedReport.rows) {
        const sku = cleanCatalogSku(r.sku).toUpperCase();
        if (!sku || !/^0EJ/i.test(sku) || finalSkuToUpcMap[sku]) continue;
        const matched = matchMemoryDenInventoryItem({
          sku,
          upc: cleanCatalogSku(r.upc || r.expectedRcUpc),
          title: String(r.name || ''),
          price: Number(r.agreedPrice || 0),
          extraText: '',
          allowPrefixForPayout: false,
          activeItems: allDocs,
          claimedItemIdToSku,
          multiBinResolvedBySku,
        });
        const matchedUpc = cleanCatalogSku(matched?.upc).toUpperCase();
        if (matched && isValidProductionUpc(matchedUpc) && !usedUpcs.has(matchedUpc)) {
          usedUpcs.add(matchedUpc);
          claimedItemIdToSku.set(matched.$id, sku);
          const title = String(matched.title || r.name || '');
          finalSkuToUpcMap[sku] = matchedUpc;
          recordRawMapping(sku, matchedUpc);
          skuToMetaMap[sku] = {
            upc: matchedUpc,
            partner: detectPartnerFromUpcOrTitle(matchedUpc, title),
            title,
            price: Number(matched.resalePrice || matched.listPrice || matched.price || r.agreedPrice || 0),
            status: String(matched.status || 'placed'),
          };
        }
      }
    }
  }

  // Persist complete payload map to Appwrite manifests if we resolved more SKUs from resale_db.items
  if (allDocs.length > 0 && Object.keys(finalSkuToUpcMap).length > ( Object.keys(cachedLive?.skuToUpcMap || {}).length )) {
    await savePersistedLivePayloadToAppwrite({
      skuToUpcMap: finalSkuToUpcMap,
      skuToMetaMap,
    });
  }

  // 5. Compute any duplicate UPC warnings (finalSkuToUpcMap is guaranteed 100% 1-to-1 unique)
  const duplicateUpcWarnings: Array<{ upc: string; skus: string[] }> = [];
  for (const [upc, skuSet] of rawUpcToSkus.entries()) {
    if (skuSet.size > 1) {
      duplicateUpcWarnings.push({ upc, skus: Array.from(skuSet) });
    }
  }

  return {
    skuToUpcMap: finalSkuToUpcMap,
    skuToMetaMap,
    verifiedMdUpcBySku,
    duplicateUpcWarnings,
  };
}

export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

export const GET: APIRoute = async ({ url }) => {
  const mode = url.searchParams.get('mode');
  if (mode === 'payload') {
    const { skuToUpcMap, skuToMetaMap, verifiedMdUpcBySku, duplicateUpcWarnings } =
      await buildLiveMdPayloadFromAppwrite();
    return new Response(
      JSON.stringify({
        ok: true,
        timestamp: new Date().toISOString(),
        count: Object.keys(skuToUpcMap).length,
        skuToUpcMap,
        skuToMetaMap,
        verifiedMdUpcBySku,
        duplicateUpcWarnings,
      }),
      {
        status: 200,
        headers: CORS_HEADERS,
      }
    );
  }

  const report = await getOrLoadReport();
  return new Response(
    JSON.stringify({
      ok: true,
      hasReport: Boolean(report),
      report,
    }),
    {
      status: 200,
      headers: CORS_HEADERS,
    }
  );
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    if (body?.mode === 'payload' && body?.skuToUpcMap) {
      await savePersistedLivePayloadToAppwrite({
        skuToUpcMap: body.skuToUpcMap || {},
        skuToMetaMap: body.skuToMetaMap || {},
      });
      return new Response(
        JSON.stringify({
          ok: true,
          count: Object.keys(body.skuToUpcMap || {}).length,
        }),
        {
          status: 200,
          headers: CORS_HEADERS,
        }
      );
    }

    const incomingRows: MdVerifyRow[] = Array.isArray(body?.rows) ? body.rows : [];
    const { skuToUpcMap, skuToMetaMap } = await buildLiveMdPayloadFromAppwrite();

    // Preserve previously verified Memory Den UPCs if Ricochet's /api/product list endpoint omitted nested item UPCs after a page refresh
    const previousReport = await getOrLoadReport();
    const prevVerifiedUpcBySku = new Map<string, string>();
    if (previousReport?.rows?.length && !body?.forceResetVerified) {
      for (const pr of previousReport.rows) {
        const pSku = cleanCatalogSku(pr.sku).toUpperCase();
        const pUpc = cleanCatalogSku(pr.upc).toUpperCase();
        if (pSku && isValidProductionUpc(pUpc)) {
          prevVerifiedUpcBySku.set(pSku, pUpc);
        }
      }
    }

    const rows: MdVerifyRow[] = incomingRows.map((r) => {
      const cleanSku = cleanCatalogSku(r.sku).toUpperCase();
      let mdUpc = cleanCatalogSku(r.upc).toUpperCase();
      const expectedRcUpc = cleanCatalogSku(r.expectedRcUpc || skuToUpcMap[cleanSku] || '').toUpperCase();
      const meta = skuToMetaMap[cleanSku];

      if (!mdUpc && cleanSku && prevVerifiedUpcBySku.has(cleanSku)) {
        mdUpc = prevVerifiedUpcBySku.get(cleanSku)!;
      }

      const invLower = String(r.inventory || '').toLowerCase();
      const isSoldRow =
        invLower.includes('sold') ||
        invLower.includes('paid') ||
        Number(r.quantity ?? 1) === 0 ||
        String(meta?.status || '').toLowerCase() === 'sold';

      let verifyStatus = r.verifyStatus;
      if (expectedRcUpc) {
        if (mdUpc === expectedRcUpc) {
          verifyStatus = 'VERIFIED_MATCH';
        } else if (!mdUpc && isSoldRow) {
          // Historical sold/paid item already linked in Resale Command
          mdUpc = expectedRcUpc;
          verifyStatus = 'VERIFIED_MATCH';
        } else if (!mdUpc) {
          verifyStatus = 'MISSING_IN_MD';
        } else {
          verifyStatus = 'MISMATCH_UPC';
        }
      } else if (mdUpc && isValidProductionUpc(mdUpc)) {
        verifyStatus = 'VERIFIED_MATCH';
      } else {
        verifyStatus = 'UNLINKED_IN_RC';
      }

      return {
        ...r,
        sku: cleanSku || r.sku,
        upc: mdUpc,
        expectedRcUpc,
        partner: meta?.partner || r.partner,
        verifyStatus,
      };
    });

    const verifiedMatch = rows.filter((r) => r.verifyStatus === 'VERIFIED_MATCH').length;
    const missingInMd = rows.filter((r) => r.verifyStatus === 'MISSING_IN_MD').length;
    const mismatchUpc = rows.filter((r) => r.verifyStatus === 'MISMATCH_UPC').length;
    const unlinkedInRc = rows.filter((r) => r.verifyStatus === 'UNLINKED_IN_RC').length;
    const totalCatalog = rows.length;

    const payload: MdVerifyReportPayload = {
      timestamp: body?.timestamp || new Date().toISOString(),
      source: body?.source || 'memoryden.ricoconsign.com',
      summary: {
        totalCatalog,
        verifiedMatch,
        missingInMd,
        mismatchUpc,
        unlinkedInRc,
      },
      rows,
    };

    await savePersistedReportToAppwrite(payload);

    return new Response(
      JSON.stringify({
        ok: true,
        summary: payload.summary,
        timestamp: payload.timestamp,
      }),
      {
        status: 200,
        headers: CORS_HEADERS,
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err?.message || 'Invalid JSON body',
      }),
      {
        status: 400,
        headers: CORS_HEADERS,
      }
    );
  }
};

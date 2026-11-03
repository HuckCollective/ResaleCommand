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
import {
  getLocationManifestDocIds,
  getLocationSettingMeta,
  resolveCanonicalLocationCode,
} from '../../lib/warehouses';

export const prerender = false;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

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

const getStoredReport = (locCode = 'MD'): MdVerifyReportPayload | null => {
  const code = (resolveCanonicalLocationCode(locCode) || 'MD').toUpperCase();
  const map = (globalThis as any).__LATEST_LOCATION_VERIFY_REPORTS__ || {};
  return map[code] || (code === 'MD' ? (globalThis as any).__LATEST_MD_VERIFY_REPORT__ || null : null);
};

const setStoredReport = (report: MdVerifyReportPayload, locCode = 'MD') => {
  const code = (resolveCanonicalLocationCode(locCode) || 'MD').toUpperCase();
  if (!(globalThis as any).__LATEST_LOCATION_VERIFY_REPORTS__) {
    (globalThis as any).__LATEST_LOCATION_VERIFY_REPORTS__ = {};
  }
  (globalThis as any).__LATEST_LOCATION_VERIFY_REPORTS__[code] = report;
  if (code === 'MD') {
    (globalThis as any).__LATEST_MD_VERIFY_REPORT__ = report;
  }
};

const getStoredLivePayload = (locCode = 'MD'): {
  skuToUpcMap: Record<string, string>;
  skuToMetaMap: Record<string, MdSkuMeta>;
} | null => {
  const code = (resolveCanonicalLocationCode(locCode) || 'MD').toUpperCase();
  const map = (globalThis as any).__LATEST_LOCATION_LIVE_PAYLOADS__ || {};
  return map[code] || (code === 'MD' ? (globalThis as any).__LATEST_MD_LIVE_PAYLOAD__ || null : null);
};

const setStoredLivePayload = (
  payload: {
    skuToUpcMap: Record<string, string>;
    skuToMetaMap: Record<string, MdSkuMeta>;
  },
  locCode = 'MD'
) => {
  const code = (resolveCanonicalLocationCode(locCode) || 'MD').toUpperCase();
  if (!(globalThis as any).__LATEST_LOCATION_LIVE_PAYLOADS__) {
    (globalThis as any).__LATEST_LOCATION_LIVE_PAYLOADS__ = {};
  }
  (globalThis as any).__LATEST_LOCATION_LIVE_PAYLOADS__[code] = payload;
  if (code === 'MD') {
    (globalThis as any).__LATEST_MD_LIVE_PAYLOAD__ = payload;
  }
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

async function loadPersistedReportFromAppwrite(locCode = 'MD'): Promise<MdVerifyReportPayload | null> {
  const { code, reportDocId } = getLocationManifestDocIds(locCode);
  try {
    const doc: any = await fetchAppwriteDocFallback(MANIFESTS_COL_ID, reportDocId);
    if (doc?.itemsSnapshot) {
      const parsed =
        typeof doc.itemsSnapshot === 'string' ? JSON.parse(doc.itemsSnapshot) : doc.itemsSnapshot;
      if (parsed && parsed.summary && Array.isArray(parsed.rows)) {
        setStoredReport(parsed, code);
        return parsed as MdVerifyReportPayload;
      }
    }
  } catch {
    // Document may not exist yet on first run
  }
  return getStoredReport(code);
}

async function getOrLoadReport(locCode = 'MD'): Promise<MdVerifyReportPayload | null> {
  const code = (resolveCanonicalLocationCode(locCode) || 'MD').toUpperCase();
  const loaded = await loadPersistedReportFromAppwrite(code);
  return loaded || getStoredReport(code);
}

async function savePersistedReportToAppwrite(report: MdVerifyReportPayload, locCode = 'MD'): Promise<void> {
  const locMeta = getLocationSettingMeta(locCode);
  const { reportDocId } = getLocationManifestDocIds(locMeta.code);
  setStoredReport(report, locMeta.code);
  const { databases, dbId } = getAppwriteConfig();
  if (!databases) return;

  const docPerms = [
    NodePermission.read(NodeRole.any()),
    NodePermission.update(NodeRole.any()),
    NodePermission.delete(NodeRole.any()),
  ];

  const docPayload: Record<string, any> = {
    name: `${locMeta.shortName} Live Barcode Verification Report`,
    tenantId: 'system',
    locationId: locMeta.id || MD_CANONICAL_WAREHOUSE_ID,
    locationName: locMeta.shortName,
    status: 'system_sync_report',
    itemCount: Number(report.summary?.totalCatalog || report.rows?.length || 0),
    itemsSnapshot: JSON.stringify(report),
    notes: JSON.stringify({
      timestamp: report.timestamp,
      summary: report.summary,
    }).slice(0, 4900),
  };

  try {
    await databases.updateDocument(dbId, MANIFESTS_COL_ID, reportDocId, docPayload, docPerms);
  } catch (updateErr: any) {
    if (updateErr?.code === 404 || String(updateErr?.message || '').includes('not be found')) {
      try {
        await databases.createDocument(
          dbId,
          MANIFESTS_COL_ID,
          reportDocId,
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

async function loadPersistedLivePayloadFromAppwrite(locCode = 'MD'): Promise<{
  skuToUpcMap: Record<string, string>;
  skuToMetaMap: Record<string, MdSkuMeta>;
} | null> {
  const { code, payloadDocId } = getLocationManifestDocIds(locCode);
  try {
    const doc: any = await fetchAppwriteDocFallback(MANIFESTS_COL_ID, payloadDocId);
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
        setStoredLivePayload(result, code);
        return result;
      }
    }
  } catch {
    // Document may not exist yet on first run
  }
  return getStoredLivePayload(code);
}

async function savePersistedLivePayloadToAppwrite(
  payload: {
    skuToUpcMap: Record<string, string>;
    skuToMetaMap: Record<string, MdSkuMeta>;
  },
  locCode = 'MD'
): Promise<void> {
  const locMeta = getLocationSettingMeta(locCode);
  const { payloadDocId } = getLocationManifestDocIds(locMeta.code);
  setStoredLivePayload(payload, locMeta.code);
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
    name: `${locMeta.shortName} Live SKU-to-UPC Payload Map`,
    tenantId: 'system',
    locationId: locMeta.id || MD_CANONICAL_WAREHOUSE_ID,
    locationName: locMeta.shortName,
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
    await databases.updateDocument(dbId, MANIFESTS_COL_ID, payloadDocId, docPayload, docPerms);
  } catch (updateErr: any) {
    if (updateErr?.code === 404 || String(updateErr?.message || '').includes('not be found')) {
      try {
        await databases.createDocument(
          dbId,
          MANIFESTS_COL_ID,
          payloadDocId,
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

export async function buildLiveMdPayloadFromAppwrite(locCode = 'MD'): Promise<{
  skuToUpcMap: Record<string, string>;
  skuToMetaMap: Record<string, MdSkuMeta>;
  verifiedMdUpcBySku: Record<string, string>;
  duplicateUpcWarnings: Array<{ upc: string; skus: string[] }>;
}> {
  const activeLocCode = (resolveCanonicalLocationCode(locCode) || 'MD').toUpperCase();
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

  // 2. Merge live payload persisted in Appwrite manifests BEFORE static baseline
  // so adopted booth tags (adopt_md_upc) and soldSkus status are NEVER reverted by PREVERIFIED_MD_SKU_TO_UPC_OR_ID!
  const cachedLive = (await loadPersistedLivePayloadFromAppwrite(activeLocCode)) || getStoredLivePayload(activeLocCode);
  if (cachedLive?.skuToUpcMap) {
    for (const [rawSku, rawUpc] of Object.entries(cachedLive.skuToUpcMap)) {
      const sku = cleanCatalogSku(rawSku).toUpperCase();
      const upc = cleanCatalogSku(rawUpc).toUpperCase();
      const meta = cachedLive.skuToMetaMap?.[sku];
      if (sku && skuToMetaMap[sku] && meta?.status === 'sold') {
        skuToMetaMap[sku].status = 'sold';
      }
      if (!sku || !/^0EJ/i.test(sku) || finalSkuToUpcMap[sku] || !isValidProductionUpc(upc)) continue;
      if (usedUpcs.has(upc)) continue;

      usedUpcs.add(upc);
      finalSkuToUpcMap[sku] = upc;
      recordRawMapping(sku, upc);
      skuToMetaMap[sku] = {
        upc,
        partner: meta?.partner || detectPartnerFromUpcOrTitle(upc, meta?.title || ''),
        title: meta?.title || '',
        price: Number(meta?.price || 0),
        status: meta?.status || 'placed',
      };
    }
  }

  // 3. Load persisted Verification Report from Appwrite and extract verifiedMdUpcBySku + sold status
  const storedReport = await getOrLoadReport(activeLocCode);
  if (storedReport?.rows?.length) {
    for (const r of storedReport.rows) {
      const sku = cleanCatalogSku(r.sku).toUpperCase();
      const actualMdUpc = cleanCatalogSku(r.upc).toUpperCase();
      const expUpc = cleanCatalogSku(r.expectedRcUpc).toUpperCase();
      const isRowSold =
        String(r.inventory || '').toLowerCase().includes('sold') ||
        String(r.inventory || '').toLowerCase().includes('paid') ||
        Number(r.quantity ?? 1) === 0;

      if (sku && /^0EJ/i.test(sku) && isValidProductionUpc(actualMdUpc)) {
        verifiedMdUpcBySku[sku] = actualMdUpc;
      }
      if (sku && skuToMetaMap[sku] && isRowSold) {
        skuToMetaMap[sku].status = 'sold';
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
          status: isRowSold ? 'sold' : 'placed',
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

  // 4. Fallback: Merge PREVERIFIED_MD_SKU_TO_UPC_OR_ID for any SKU not yet in finalSkuToUpcMap (enforcing usedUpcs)
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

  // Ensure every mapped SKU in finalSkuToUpcMap is also present in verifiedMdUpcBySku so the bookmarklet
  // always resolves the verified barcode when Ricochet /api/product list omits nested item upc_code fields
  for (const [sku, upc] of Object.entries(finalSkuToUpcMap)) {
    if (!verifiedMdUpcBySku[sku] && isValidProductionUpc(upc)) {
      verifiedMdUpcBySku[sku] = upc;
    }
  }

  // Persist complete payload map to Appwrite manifests if we resolved more SKUs from resale_db.items
  if (allDocs.length > 0 && Object.keys(finalSkuToUpcMap).length > ( Object.keys(cachedLive?.skuToUpcMap || {}).length )) {
    await savePersistedLivePayloadToAppwrite(
      {
        skuToUpcMap: finalSkuToUpcMap,
        skuToMetaMap,
      },
      activeLocCode
    );
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
  const locCode = (resolveCanonicalLocationCode(url.searchParams.get('location') || 'MD') || 'MD').toUpperCase();
  if (mode === 'payload') {
    const { skuToUpcMap, skuToMetaMap, verifiedMdUpcBySku, duplicateUpcWarnings } =
      await buildLiveMdPayloadFromAppwrite(locCode);
    return new Response(
      JSON.stringify({
        ok: true,
        location: locCode,
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

  const report = await getOrLoadReport(locCode);
  return new Response(
    JSON.stringify({
      ok: true,
      location: locCode,
      hasReport: Boolean(report),
      report,
    }),
    {
      status: 200,
      headers: CORS_HEADERS,
    }
  );
};

export const POST: APIRoute = async ({ request, url }) => {
  try {
    const body = await request.json();
    const locCode = (
      resolveCanonicalLocationCode(body?.location || url.searchParams.get('location') || 'MD') || 'MD'
    ).toUpperCase();

    if (body?.mode === 'payload' && body?.skuToUpcMap) {
      // Merge incoming client payload into existing cloud payload so partial browser maps (e.g. 498 items)
      // NEVER wipe out the full 808-item cloud map or strip soldSkus status!
      const existingPayload = (await loadPersistedLivePayloadFromAppwrite(locCode)) || getStoredLivePayload(locCode) || {
        skuToUpcMap: {},
        skuToMetaMap: {},
      };
      const mergedSkuToUpcMap: Record<string, string> = { ...(existingPayload.skuToUpcMap || {}) };
      const mergedSkuToMetaMap: Record<string, MdSkuMeta> = { ...(existingPayload.skuToMetaMap || {}) };
      const incomingMap = body.skuToUpcMap || {};
      const incomingMeta = body.skuToMetaMap || {};

      for (const [rawSku, rawUpc] of Object.entries(incomingMap)) {
        const s = cleanCatalogSku(rawSku).toUpperCase();
        const u = cleanCatalogSku(rawUpc).toUpperCase();
        if (!s || !/^0EJ/i.test(s) || !isValidProductionUpc(u)) continue;
        // Do not overwrite an existing cloud mapping unless it is a brand-new SKU not yet in the cloud map
        if (!mergedSkuToUpcMap[s]) {
          mergedSkuToUpcMap[s] = u;
        }
        const prevStatus = mergedSkuToMetaMap[s]?.status;
        const incMeta = incomingMeta[s];
        mergedSkuToMetaMap[s] = {
          upc: mergedSkuToUpcMap[s],
          partner: incMeta?.partner || mergedSkuToMetaMap[s]?.partner || detectPartnerFromUpcOrTitle(mergedSkuToUpcMap[s], incMeta?.title || ''),
          title: incMeta?.title || mergedSkuToMetaMap[s]?.title || '',
          price: Number(incMeta?.price ?? mergedSkuToMetaMap[s]?.price ?? 0),
          status: prevStatus === 'sold' ? 'sold' : (incMeta?.status || prevStatus || 'placed'),
        };
      }

      await savePersistedLivePayloadToAppwrite(
        {
          skuToUpcMap: mergedSkuToUpcMap,
          skuToMetaMap: mergedSkuToMetaMap,
        },
        locCode
      );
      return new Response(
        JSON.stringify({
          ok: true,
          location: locCode,
          count: Object.keys(mergedSkuToUpcMap).length,
        }),
        {
          status: 200,
          headers: CORS_HEADERS,
        }
      );
    }

    // Physical Sticker Wins ("Adopt Booth Tag"): Update RC DB + Live Payload to adopt Ricochet's existing physical UPC
    // Supports automatic 2-way criss-cross barcode swaps (e.g. 0EJ0GF <-> 0EJ0GG) so usedUpcs never drops either item!
    if (body?.mode === 'adopt_md_upc') {
      const targetSku = cleanCatalogSku(body?.sku).toUpperCase();
      const adoptedUpc = cleanCatalogSku(body?.mdUpc).toUpperCase();
      if (!targetSku || !/^0EJ/i.test(targetSku) || !isValidProductionUpc(adoptedUpc)) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: `Invalid SKU (${targetSku}) or Booth UPC (${adoptedUpc}).`,
          }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const cachedPayload = (await loadPersistedLivePayloadFromAppwrite(locCode)) || getStoredLivePayload(locCode) || {
        skuToUpcMap: {},
        skuToMetaMap: {},
      };
      const previousTargetUpc = cleanCatalogSku(cachedPayload.skuToUpcMap[targetSku] || '').toUpperCase();

      const { databases, dbId, itemsCol } = getAppwriteConfig();
      let updatedDocId: string | null = null;
      let conflictingSku: string | null = null;
      let swappedUpcForConflict: string | null = null;

      // Check if another SKU in cachedPayload currently holds adoptedUpc
      for (const [kSku, kUpc] of Object.entries(cachedPayload.skuToUpcMap)) {
        if (kSku !== targetSku && cleanCatalogSku(kUpc).toUpperCase() === adoptedUpc) {
          conflictingSku = kSku;
          break;
        }
      }

      if (databases) {
        try {
          let cursor: string | null = null;
          let targetDoc: any = null;
          let conflictingDoc: any = null;
          const existingUpcSet = new Set<string>(Object.values(cachedPayload.skuToUpcMap));
          let maxHuck = 9750;

          for (let page = 0; page < 25; page++) {
            const queries: string[] = [NodeQuery.limit(100), NodeQuery.orderDesc('$id')];
            if (cursor) queries.push(NodeQuery.cursorAfter(cursor));
            const res = await databases.listDocuments(dbId, itemsCol, queries);
            const docs = res.documents || [];
            for (const d of docs as any[]) {
              const dSku = cleanCatalogSku(d?.locationSku || d?.sku).toUpperCase();
              const dUpc = cleanCatalogSku(d?.upc).toUpperCase();
              if (dUpc) {
                existingUpcSet.add(dUpc);
                const m = dUpc.match(/^HUCK-(\d{4})$/);
                if (m) {
                  const n = parseInt(m[1], 10);
                  if (n > maxHuck && n < 9900) maxHuck = n;
                }
              }
              if (dSku === targetSku && !targetDoc) {
                targetDoc = d;
              } else if (dUpc === adoptedUpc && dSku && /^0EJ/i.test(dSku) && dSku !== targetSku) {
                conflictingSku = dSku;
                conflictingDoc = d;
              } else if (conflictingSku && dSku === conflictingSku && !conflictingDoc) {
                conflictingDoc = d;
              }
            }
            if (docs.length < 100) break;
            cursor = docs[docs.length - 1].$id;
          }

          const targetOldUpc = cleanCatalogSku(targetDoc?.upc || previousTargetUpc).toUpperCase();
          if (conflictingSku) {
            if (targetOldUpc && targetOldUpc !== adoptedUpc && isValidProductionUpc(targetOldUpc)) {
              swappedUpcForConflict = targetOldUpc;
            } else {
              while (true) {
                maxHuck++;
                const cand = `HUCK-${String(maxHuck).padStart(4, '0')}`;
                if (!existingUpcSet.has(cand)) {
                  swappedUpcForConflict = cand;
                  break;
                }
              }
            }

            if (conflictingDoc?.$id && swappedUpcForConflict) {
              await databases.updateDocument(dbId, itemsCol, conflictingDoc.$id, {
                upc: swappedUpcForConflict,
                locationSku: conflictingSku,
                storageLocation: 'MD',
              });
            }
          }

          if (targetDoc?.$id) {
            await databases.updateDocument(dbId, itemsCol, targetDoc.$id, {
              upc: adoptedUpc,
              locationSku: targetSku,
              storageLocation: 'MD',
            });
            updatedDocId = targetDoc.$id;
          }
        } catch (dbErr: any) {
          console.warn('[/api/md-verify-report] adopt_md_upc items update warning:', dbErr?.message);
        }
      }

      // If conflictingSku was found in cachedPayload even if not in client-visible DB docs, assign its swapped UPC
      if (conflictingSku && !swappedUpcForConflict) {
        if (previousTargetUpc && previousTargetUpc !== adoptedUpc && isValidProductionUpc(previousTargetUpc)) {
          swappedUpcForConflict = previousTargetUpc;
        }
      }

      if (conflictingSku && swappedUpcForConflict) {
        cachedPayload.skuToUpcMap[conflictingSku] = swappedUpcForConflict;
        if (cachedPayload.skuToMetaMap[conflictingSku]) {
          cachedPayload.skuToMetaMap[conflictingSku].upc = swappedUpcForConflict;
        }
      }

      // Update persisted live payload map
      cachedPayload.skuToUpcMap[targetSku] = adoptedUpc;
      if (cachedPayload.skuToMetaMap[targetSku]) {
        cachedPayload.skuToMetaMap[targetSku].upc = adoptedUpc;
        cachedPayload.skuToMetaMap[targetSku].partner = detectPartnerFromUpcOrTitle(
          adoptedUpc,
          cachedPayload.skuToMetaMap[targetSku].title || ''
        );
      }
      await savePersistedLivePayloadToAppwrite(cachedPayload, locCode);

      // Update persisted verification report so both tabs reflect VERIFIED_MATCH immediately
      const currentReport = await getOrLoadReport(locCode);
      if (currentReport?.rows?.length) {
        for (const r of currentReport.rows) {
          const rSku = cleanCatalogSku(r.sku).toUpperCase();
          if (rSku === targetSku) {
            r.upc = adoptedUpc;
            r.expectedRcUpc = adoptedUpc;
            r.verifyStatus = 'VERIFIED_MATCH';
          } else if (conflictingSku && swappedUpcForConflict && rSku === conflictingSku) {
            r.expectedRcUpc = swappedUpcForConflict;
            if (cleanCatalogSku(r.upc).toUpperCase() === swappedUpcForConflict || !r.upc) {
              r.upc = swappedUpcForConflict;
              r.verifyStatus = 'VERIFIED_MATCH';
            }
          }
        }
        currentReport.summary = {
          totalCatalog: currentReport.rows.length,
          verifiedMatch: currentReport.rows.filter((r) => r.verifyStatus === 'VERIFIED_MATCH').length,
          missingInMd: currentReport.rows.filter((r) => r.verifyStatus === 'MISSING_IN_MD').length,
          mismatchUpc: currentReport.rows.filter((r) => r.verifyStatus === 'MISMATCH_UPC').length,
          unlinkedInRc: currentReport.rows.filter((r) => r.verifyStatus === 'UNLINKED_IN_RC').length,
        };
        currentReport.timestamp = new Date().toISOString();
        await savePersistedReportToAppwrite(currentReport, locCode);
      }

      return new Response(
        JSON.stringify({
          ok: true,
          location: locCode,
          sku: targetSku,
          adoptedUpc,
          swappedSku: conflictingSku,
          swappedUpc: swappedUpcForConflict,
          updatedDocId,
          summary: currentReport?.summary || null,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    const incomingRows: MdVerifyRow[] = Array.isArray(body?.rows) ? body.rows : [];
    const { skuToUpcMap, skuToMetaMap } = await buildLiveMdPayloadFromAppwrite(locCode);

    // Preserve previously verified Memory Den UPCs if Ricochet's /api/product list endpoint omitted nested item UPCs after a page refresh
    const previousReport = await getOrLoadReport(locCode);
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

    // Build set of active In-Stock UPCs in Ricochet so on-the-fly phone booth entries with an unclaimed HUCK-XXXX tag auto-adopt cleanly
    const activeInStockSkusByUpc = new Map<string, Set<string>>();
    for (const ir of incomingRows) {
      const iSku = cleanCatalogSku(ir.sku).toUpperCase();
      const iUpc = cleanCatalogSku(ir.upc || prevVerifiedUpcBySku.get(iSku) || '').toUpperCase();
      const iInv = String(ir.inventory || '').toLowerCase();
      const iSold = iInv.includes('sold') || iInv.includes('paid') || Number(ir.quantity ?? 1) === 0;
      if (!iSold && iSku && isValidProductionUpc(iUpc)) {
        if (!activeInStockSkusByUpc.has(iUpc)) activeInStockSkusByUpc.set(iUpc, new Set());
        activeInStockSkusByUpc.get(iUpc)!.add(iSku);
      }
    }

    const onTheFlyAdoptedPairs: Array<{ sku: string; upc: string; title: string; price: number; qty: number }> = [];

    const rows: MdVerifyRow[] = incomingRows.map((r) => {
      const cleanSku = cleanCatalogSku(r.sku).toUpperCase();
      let mdUpc = cleanCatalogSku(r.upc).toUpperCase();
      let expectedRcUpc = cleanCatalogSku(r.expectedRcUpc || skuToUpcMap[cleanSku] || '').toUpperCase();
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

      // Check if an active In-Stock item was tagged on the fly at the booth with a valid HUCK-/PDXGL-/BB- barcode
      // that is NOT claimed by any other active In-Stock 0EJ SKU
      const otherInStockClaimants = mdUpc ? Array.from(activeInStockSkusByUpc.get(mdUpc) || []).filter((s) => s !== cleanSku) : [];
      const canAutoAdoptOnTheFlyUpc =
        !isSoldRow &&
        Boolean(cleanSku && /^0EJ/i.test(cleanSku)) &&
        Boolean(mdUpc && isValidProductionUpc(mdUpc)) &&
        otherInStockClaimants.length === 0;

      let verifyStatus = r.verifyStatus;
      if (isSoldRow && (expectedRcUpc || (mdUpc && isValidProductionUpc(mdUpc)))) {
        // Historical Sold/Paid items that have already left the shelf are ALWAYS VERIFIED_MATCH (never MISMATCH_UPC)
        if (!mdUpc) mdUpc = expectedRcUpc;
        if (!expectedRcUpc) expectedRcUpc = mdUpc;
        verifyStatus = 'VERIFIED_MATCH';
      } else if (canAutoAdoptOnTheFlyUpc && (!expectedRcUpc || mdUpc !== expectedRcUpc)) {
        // On-the-Fly Booth Addition / Physical Tag Wins: automatically adopt unclaimed HUCK-XXXX tag entered on phone in Ricochet
        expectedRcUpc = mdUpc;
        skuToUpcMap[cleanSku] = mdUpc;
        skuToMetaMap[cleanSku] = {
          upc: mdUpc,
          partner: detectPartnerFromUpcOrTitle(mdUpc, String(r.name || '')),
          title: String(r.name || ''),
          price: Number(r.agreedPrice || 0),
          status: 'placed',
        };
        onTheFlyAdoptedPairs.push({
          sku: cleanSku,
          upc: mdUpc,
          title: String(r.name || cleanSku),
          price: Number(r.agreedPrice || 0),
          qty: Math.max(1, Number(r.quantity || 1)),
        });
        verifyStatus = 'VERIFIED_MATCH';
      } else if (expectedRcUpc) {
        if (mdUpc === expectedRcUpc) {
          verifyStatus = 'VERIFIED_MATCH';
        } else if (!mdUpc) {
          verifyStatus = 'MISSING_IN_MD';
        } else {
          verifyStatus = 'MISMATCH_UPC';
        }
      } else if (mdUpc && isValidProductionUpc(mdUpc)) {
        expectedRcUpc = mdUpc;
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

    // Persist any on-the-fly booth additions / adopted phone tags to resale_db.items and live payload doc
    if (onTheFlyAdoptedPairs.length > 0) {
      await savePersistedLivePayloadToAppwrite(
        {
          skuToUpcMap,
          skuToMetaMap,
        },
        locCode
      );
      const { databases, dbId, itemsCol } = getAppwriteConfig();
      if (databases) {
        for (const pair of onTheFlyAdoptedPairs) {
          try {
            const byUpcRes = await databases.listDocuments(dbId, itemsCol, [
              NodeQuery.equal('upc', pair.upc),
              NodeQuery.limit(5),
            ]);
            const existingByUpc = byUpcRes.documents?.[0] as any;
            if (existingByUpc?.$id) {
              await databases.updateDocument(dbId, itemsCol, existingByUpc.$id, {
                locationSku: pair.sku,
                storageLocation: 'MD',
                status: 'placed',
              });
            } else {
              const bySkuRes = await databases.listDocuments(dbId, itemsCol, [
                NodeQuery.equal('locationSku', pair.sku),
                NodeQuery.limit(5),
              ]);
              const existingBySku = bySkuRes.documents?.[0] as any;
              if (existingBySku?.$id) {
                await databases.updateDocument(dbId, itemsCol, existingBySku.$id, {
                  upc: pair.upc,
                  locationSku: pair.sku,
                  storageLocation: 'MD',
                  status: 'placed',
                });
              }
            }
          } catch {}
        }
      }
    }

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

    await savePersistedReportToAppwrite(payload, locCode);

    return new Response(
      JSON.stringify({
        ok: true,
        location: locCode,
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

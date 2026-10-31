import type { APIRoute } from 'astro';
import { Client as NodeClient, Databases as NodeDatabases, Query as NodeQuery } from 'node-appwrite';
import {
  PREVERIFIED_MD_SKU_TO_UPC_OR_ID,
  buildLockedMultiBinMap,
  cleanCatalogSku,
  isBbConsignorRow,
  matchMemoryDenInventoryItem,
} from '../../lib/salesBucketing';

export const prerender = false;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

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
  duplicateUpcWarnings: Array<{ upc: string; skus: string[] }>;
}> {
  const skuToUpcMap: Record<string, string> = {};
  const skuToMetaMap: Record<string, MdSkuMeta> = {};
  const usedUpcs = new Set<string>();
  const rawUpcToSkus = new Map<string, Set<string>>();

  const recordRawMapping = (sku: string, upc: string) => {
    if (!rawUpcToSkus.has(upc)) rawUpcToSkus.set(upc, new Set());
    rawUpcToSkus.get(upc)!.add(sku);
  };

  // 1. Query Appwrite resale_db.items live first (canonical source of truth)
  const endpoint =
    (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_APPWRITE_ENDPOINT) ||
    process.env.PUBLIC_APPWRITE_ENDPOINT ||
    'https://sfo.cloud.appwrite.io/v1';
  const project =
    (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_APPWRITE_PROJECT_ID) ||
    process.env.PUBLIC_APPWRITE_PROJECT_ID ||
    '';
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

  const byId = new Map<string, any>();
  const allDocs: any[] = [];
  const candidatesBySku = new Map<string, any[]>();

  if (endpoint && project) {
    try {
      const client = new NodeClient().setEndpoint(endpoint).setProject(project);
      if (apiKey) {
        client.setKey(apiKey);
      }
      const databases = new NodeDatabases(client);
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
          if (!sku || !/^0EJ/i.test(sku) || !isValidProductionUpc(upc)) continue;
          if (/test|demo/i.test(title) && /test|demo/i.test(upc)) continue;

          if (!candidatesBySku.has(sku)) candidatesBySku.set(sku, []);
          candidatesBySku.get(sku)!.push(doc);
          recordRawMapping(sku, upc);
        }
        if (docs.length < 100) break;
        cursor = docs[docs.length - 1].$id;
      }
    } catch (err) {
      console.warn('[/api/md-verify-report] Live Appwrite query warning:', (err as any)?.message);
    }
  }

  // Sort SKUs so SKUs with exactly 1 DB candidate claim their UPC first, then multi-candidate SKUs pick the newest unclaimed UPC
  const sortedSkus = Array.from(candidatesBySku.keys()).sort((a, b) => {
    const lenA = candidatesBySku.get(a)!.length;
    const lenB = candidatesBySku.get(b)!.length;
    if (lenA !== lenB) return lenA - lenB;
    return a.localeCompare(b);
  });

  for (const sku of sortedSkus) {
    const docsForSku = candidatesBySku.get(sku) || [];
    // docsForSku is already in orderDesc('$id') (newest first). Prefer newest candidate whose UPC is not yet in usedUpcs!
    const chosen = docsForSku.find((d) => {
      const u = cleanCatalogSku(d?.upc).toUpperCase();
      return isValidProductionUpc(u) && !usedUpcs.has(u);
    });
    if (!chosen) continue;

    const upc = cleanCatalogSku(chosen.upc).toUpperCase();
    const title = String(chosen.title || chosen.identity || '');
    usedUpcs.add(upc);
    skuToUpcMap[sku] = upc;
    skuToMetaMap[sku] = {
      upc,
      partner: detectPartnerFromUpcOrTitle(upc, title),
      title,
      price: Number(chosen.resalePrice || chosen.listPrice || chosen.price || chosen.soldPrice || 0),
      status: String(chosen.status || 'placed'),
    };
  }

  // 2. Merge PREVERIFIED_MD_SKU_TO_UPC_OR_ID for any SKU not yet in skuToUpcMap (enforcing usedUpcs)
  for (const [rawSku, rawUpcOrId] of Object.entries(PREVERIFIED_MD_SKU_TO_UPC_OR_ID)) {
    const sku = cleanCatalogSku(rawSku).toUpperCase();
    if (!sku || !/^0EJ/i.test(sku) || skuToUpcMap[sku]) continue;
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
    recordRawMapping(sku, resolvedUpc);
    if (usedUpcs.has(resolvedUpc)) continue;

    usedUpcs.add(resolvedUpc);
    skuToUpcMap[sku] = resolvedUpc;
    skuToMetaMap[sku] = {
      upc: resolvedUpc,
      partner: detectPartnerFromUpcOrTitle(resolvedUpc, resolvedTitle),
      title: resolvedTitle,
      price: resolvedPrice,
      status: resolvedStatus,
    };
  }

  // 3. Merge any live payload pushed from LocationSyncView.vue session for remaining SKUs (enforcing usedUpcs)
  const cachedLive = getStoredLivePayload();
  if (cachedLive?.skuToUpcMap) {
    for (const [rawSku, rawUpc] of Object.entries(cachedLive.skuToUpcMap)) {
      const sku = cleanCatalogSku(rawSku).toUpperCase();
      const upc = cleanCatalogSku(rawUpc).toUpperCase();
      if (!sku || !/^0EJ/i.test(sku) || skuToUpcMap[sku] || !isValidProductionUpc(upc)) continue;
      recordRawMapping(sku, upc);
      if (usedUpcs.has(upc)) continue;

      usedUpcs.add(upc);
      skuToUpcMap[sku] = upc;
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

  // 4. Fallback: if a Verification Report is stored in memory, run matchMemoryDenInventoryItem for any remaining report rows
  const storedReport = getStoredReport();
  if (storedReport?.rows?.length && allDocs.length > 0) {
    const claimedItemIdToSku = new Map<string, string>();
    for (const doc of allDocs) {
      const dSku = cleanCatalogSku(doc?.locationSku || doc?.sku).toUpperCase();
      if (dSku && skuToUpcMap[dSku] && cleanCatalogSku(doc?.upc).toUpperCase() === skuToUpcMap[dSku]) {
        claimedItemIdToSku.set(doc.$id, dSku);
      }
    }
    const multiBinResolvedBySku = buildLockedMultiBinMap(allDocs, claimedItemIdToSku);
    for (const r of storedReport.rows) {
      const sku = cleanCatalogSku(r.sku).toUpperCase();
      if (!sku || !/^0EJ/i.test(sku) || skuToUpcMap[sku]) continue;
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
        skuToUpcMap[sku] = matchedUpc;
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

  // 5. Compute any historical duplicate UPC warnings (though skuToUpcMap is now guaranteed 100% duplicate-free)
  const duplicateUpcWarnings: Array<{ upc: string; skus: string[] }> = [];
  for (const [upc, skuSet] of rawUpcToSkus.entries()) {
    if (skuSet.size > 1) {
      duplicateUpcWarnings.push({ upc, skus: Array.from(skuSet) });
    }
  }

  return { skuToUpcMap, skuToMetaMap, duplicateUpcWarnings };
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
    const { skuToUpcMap, skuToMetaMap, duplicateUpcWarnings } = await buildLiveMdPayloadFromAppwrite();
    return new Response(
      JSON.stringify({
        ok: true,
        timestamp: new Date().toISOString(),
        count: Object.keys(skuToUpcMap).length,
        skuToUpcMap,
        skuToMetaMap,
        duplicateUpcWarnings,
      }),
      {
        status: 200,
        headers: CORS_HEADERS,
      }
    );
  }

  const report = getStoredReport();
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
      setStoredLivePayload({
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

    const rows: MdVerifyRow[] = Array.isArray(body?.rows) ? body.rows : [];
    const summaryInput = body?.summary || {};

    const verifiedMatch =
      typeof summaryInput.verifiedMatch === 'number'
        ? summaryInput.verifiedMatch
        : rows.filter((r) => r.verifyStatus === 'VERIFIED_MATCH').length;
    const missingInMd =
      typeof summaryInput.missingInMd === 'number'
        ? summaryInput.missingInMd
        : rows.filter((r) => r.verifyStatus === 'MISSING_IN_MD').length;
    const mismatchUpc =
      typeof summaryInput.mismatchUpc === 'number'
        ? summaryInput.mismatchUpc
        : rows.filter((r) => r.verifyStatus === 'MISMATCH_UPC').length;
    const unlinkedInRc =
      typeof summaryInput.unlinkedInRc === 'number'
        ? summaryInput.unlinkedInRc
        : rows.filter((r) => r.verifyStatus === 'UNLINKED_IN_RC').length;
    const totalCatalog =
      typeof summaryInput.totalCatalog === 'number' ? summaryInput.totalCatalog : rows.length;

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

    setStoredReport(payload);

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

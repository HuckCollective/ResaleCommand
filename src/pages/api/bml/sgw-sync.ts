import type { APIRoute } from 'astro';
import {
  Client as NodeClient,
  Databases as NodeDatabases,
  ID as NodeID,
  Permission as NodePermission,
  Query as NodeQuery,
  Role as NodeRole,
} from 'node-appwrite';
import { BML_CORS_HEADERS, requireBookmarkletMember } from '../../../lib/bml/serverAuth';
import {
  isRefundedOrCancelledTracking,
  isRefundedPurchaseOrder,
  parseTrackingNumbers,
} from '../../../lib/shipmentTracking';
import { parsePacificDateToIso } from '../../../lib/dateTimeUtils';
import { formatReadableSellerLabel } from '../../../lib/shipping-rules';

export const prerender = false;

function getAppwriteServer() {
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
    (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_APPWRITE_ITEMS_COL) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_APPWRITE_ITEMS_COLLECTION_ID) ||
    process.env.PUBLIC_APPWRITE_ITEMS_COL ||
    'items';
  const purchasesCol =
    (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_APPWRITE_PURCHASES_COL) ||
    process.env.PUBLIC_APPWRITE_PURCHASES_COL ||
    'purchases';

  const client = new NodeClient().setEndpoint(endpoint).setProject(project);
  if (apiKey) client.setKey(apiKey);
  const databases = new NodeDatabases(client);

  return { databases, dbId, itemsCol, purchasesCol };
}

function extractSgwItemIdFromDoc(doc: any): string | null {
  if (!doc) return null;
  const rawObj = parseRawAnalysisJson(doc.rawAnalysis);
  if (rawObj.sgwItemId && /^\d{7,10}$/.test(String(rawObj.sgwItemId).trim())) {
    return String(rawObj.sgwItemId).trim();
  }
  const candidates = [
    doc.sourcingLocation,
    doc.orderId,
    doc.identity,
    doc.title,
    doc.conditionNotes,
    doc.marketDescription,
  ];
  for (const raw of candidates) {
    if (!raw || typeof raw !== 'string') continue;
    const urlMatch = raw.match(/\/item\/(\d{7,10})/i);
    if (urlMatch && urlMatch[1]) return urlMatch[1];
    const bareMatch = raw.match(/\b(2\d{8})\b/);
    if (bareMatch && bareMatch[1]) return bareMatch[1];
  }
  return null;
}

function parseRawAnalysisJson(raw: any): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'object') return { ...raw };
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
  }
  return {};
}

function serializeRawAnalysisJson(obj: Record<string, any>): string {
  const json = JSON.stringify(obj);
  return json.length > 60000 ? json.slice(0, 60000) : json;
}

function extractBoutiquePriceFromDoc(doc: any, rawObj: Record<string, any>): number {
  if (Number(rawObj.boutiquePrice) > 0) return Number(rawObj.boutiquePrice);
  const notes = String(doc?.conditionNotes || '');
  const m = notes.match(/\[Boutique:\s*\$([\d.]+)\]/i);
  if (m && m[1] && Number(m[1]) > 0) return Number(m[1]);
  return Number(doc?.resalePrice || 0);
}

function buildConditionNotesWithMeta(
  baseNotes: string | undefined,
  existingNotes: string | undefined,
  boutiquePrice: number,
  primaryImageUrl?: string
): string | undefined {
  let clean = String(baseNotes !== undefined ? baseNotes : existingNotes || '')
    .replace(/\[Boutique:\s*\$[\d.]+\]/gi, '')
    .trim();
  const imgUrl =
    primaryImageUrl && /^https?:\/\//i.test(primaryImageUrl)
      ? primaryImageUrl.trim()
      : (() => {
          const m = String(existingNotes || '').match(/\[EXTERNAL_IMAGE:\s*(https?:\/\/[^\]\s]+)\]/i);
          return m ? m[1] : '';
        })();
  clean = clean.replace(/\[EXTERNAL_IMAGE:\s*https?:\/\/[^\]]+\]/gi, '').trim();

  const tags: string[] = [];
  if (boutiquePrice > 0) tags.push(`[Boutique: $${boutiquePrice.toFixed(2)}]`);
  if (imgUrl) tags.push(`[EXTERNAL_IMAGE: ${imgUrl}]`);
  const combined = [clean, ...tags].filter(Boolean).join(' ').trim();
  return combined ? combined.slice(0, 2000) : undefined;
}

function buildDocPermissions(teamId?: string, userId?: string): string[] {
  const perms: string[] = [
    NodePermission.read(NodeRole.any()),
    NodePermission.update(NodeRole.any()),
    NodePermission.delete(NodeRole.any()),
  ];
  if (teamId && teamId !== 'huck_collective') {
    const tRole = NodeRole.team(teamId);
    perms.push(NodePermission.read(tRole), NodePermission.update(tRole), NodePermission.delete(tRole));
  }
  if (userId && userId !== 'same_origin_member') {
    const uRole = NodeRole.user(userId);
    perms.push(NodePermission.read(uRole), NodePermission.update(uRole), NodePermission.delete(uRole));
  }
  return Array.from(new Set(perms));
}

function resolvePurchaseTenantId(teamId?: string, userId?: string, recentPurchases: any[] = []): string {
  if (teamId && teamId !== 'huck_collective') return teamId;
  for (const p of recentPurchases) {
    const tid = String(p?.tenantId || '').trim();
    if (tid) return tid;
  }
  if (userId && userId !== 'same_origin_member') return userId;
  return 'huck_collective';
}

function isDraftTrackerPurchase(p: any): boolean {
  if (!p) return false;
  const st = String(p?.status || '').trim().toLowerCase();
  const oid = String(p?.orderId || '').trim().toUpperCase();
  const vendor = String(p?.vendor || '').trim().toLowerCase();
  if (st === 'draft') return true;
  if (oid.startsWith('SC-') && (st === 'draft' || st === 'pending')) return true;
  if (vendor === 'auctions' && st === 'draft') return true;
  return false;
}

async function scanRecentInventoryAndMaxUpc(
  databases: NodeDatabases,
  dbId: string,
  itemsCol: string,
  prefix = 'HUCK-'
) {
  const normPrefix = prefix.toUpperCase().endsWith('-') ? prefix.toUpperCase() : `${prefix.toUpperCase()}-`;
  const bySgwItemId = new Map<string, any>();
  let maxSeq = normPrefix === 'HUCK-' ? 9750 : 1000;
  let cursor: string | null = null;

  for (let page = 0; page < 15; page++) {
    const queries: string[] = [NodeQuery.limit(100), NodeQuery.orderDesc('$id')];
    if (cursor) queries.push(NodeQuery.cursorAfter(cursor));
    const res = await databases.listDocuments(dbId, itemsCol, queries);
    const docs = res.documents || [];
    for (const d of docs as any[]) {
      const upc = String(d?.upc || '').trim().toUpperCase();
      if (upc.startsWith(normPrefix)) {
        const numPart = parseInt(upc.slice(normPrefix.length), 10);
        if (!isNaN(numPart) && numPart < 99999 && numPart > maxSeq) {
          maxSeq = numPart;
        }
      }
      const sgwId = extractSgwItemIdFromDoc(d);
      if (sgwId && !bySgwItemId.has(sgwId)) {
        bySgwItemId.set(sgwId, d);
      }
    }
    if (docs.length < 100) break;
    cursor = docs[docs.length - 1].$id;
  }

  const nextUpc = () => {
    maxSeq += 1;
    return `${normPrefix}${String(maxSeq).padStart(4, '0')}`;
  };

  return { bySgwItemId, nextUpc };
}

function findBestActiveSgwTracker(purchases: any[]): any | null {
  const drafts = (purchases || []).filter((p: any) => isDraftTrackerPurchase(p));
  // 1. Prefer an existing 'Auctions' or 'ShopGoodwill' SC- Draft tracker (e.g., SC-579892 | Auctions)
  const exactAuction = drafts.find((p: any) => {
    const vendor = String(p?.vendor || '').trim().toLowerCase();
    return vendor === 'auctions' || vendor.includes('goodwill') || vendor.includes('auction');
  });
  if (exactAuction) return exactAuction;
  // 2. Any SC- draft tracker
  const scDraft = drafts.find((p: any) => String(p?.orderId || '').trim().toUpperCase().startsWith('SC-'));
  if (scDraft) return scDraft;
  return drafts[0] || null;
}

async function ensureActiveSgwBuyTracker(
  databases: NodeDatabases,
  dbId: string,
  purchasesCol: string,
  teamId: string,
  userId: string,
  recentPurchases?: any[]
): Promise<any> {
  const docs =
    recentPurchases ||
    (
      await databases.listDocuments(dbId, purchasesCol, [
        NodeQuery.limit(100),
        NodeQuery.orderDesc('$id'),
      ])
    ).documents ||
    [];

  const existing = findBestActiveSgwTracker(docs);
  if (existing) return existing;

  const shortSuffix = String(Date.now()).slice(-6);
  const resolvedTenantId = resolvePurchaseTenantId(teamId, userId, docs);
  return await databases.createDocument(
    dbId,
    purchasesCol,
    NodeID.unique(),
    {
      poNumber: `PO-${shortSuffix}`,
      orderId: `SC-${shortSuffix}`,
      vendor: 'Auctions',
      purchaseDate: new Date().toISOString().split('T')[0],
      status: 'Draft',
      subtotal: 0,
      shippingTotal: 0,
      handlingTotal: 0,
      taxTotal: 0,
      feeTotal: 0,
      grandTotal: 0,
      notes: 'Active ShopGoodwill & Online Auction Buy Tracker',
      tenantId: resolvedTenantId,
    },
    buildDocPermissions(teamId, userId)
  );
}

async function syncTrackerTotals(
  databases: NodeDatabases,
  dbId: string,
  purchasesCol: string,
  itemsCol: string,
  trackerPoId: string | null | undefined
) {
  if (!trackerPoId) return;
  try {
    const [byPurchase, byCart] = await Promise.all([
      databases.listDocuments(dbId, itemsCol, [
        NodeQuery.equal('purchaseId', trackerPoId),
        NodeQuery.limit(100),
      ]),
      databases.listDocuments(dbId, itemsCol, [
        NodeQuery.equal('cartId', trackerPoId),
        NodeQuery.limit(100),
      ]),
    ]);
    const map = new Map<string, any>();
    for (const d of [...(byPurchase.documents || []), ...(byCart.documents || [])]) {
      map.set(d.$id, d);
    }
    let subtotal = 0;
    for (const item of map.values()) {
      const price = Number(item.cost || item.currentBid || item.maxBid || item.maxBuyPrice || 0);
      subtotal += price;
    }
    const cleanSub = Number(subtotal.toFixed(2));
    await databases.updateDocument(dbId, purchasesCol, trackerPoId, {
      subtotal: cleanSub,
      grandTotal: cleanSub,
    });
  } catch (e) {
    console.warn('[sgw-sync] Failed to sync tracker totals for', trackerPoId, e);
  }
}

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: BML_CORS_HEADERS });
};

export const GET: APIRoute = async ({ request }) => {
  const auth = await requireBookmarkletMember(request);
  if (!auth.ok) return auth.response;

  try {
    const { databases, dbId, itemsCol, purchasesCol } = getAppwriteServer();
    const [{ bySgwItemId }, poRes] = await Promise.all([
      scanRecentInventoryAndMaxUpc(databases, dbId, itemsCol, auth.member.prefix),
      databases.listDocuments(dbId, purchasesCol, [
        NodeQuery.limit(100),
        NodeQuery.orderDesc('$id'),
      ]),
    ]);

    const poDocs = (poRes.documents || []) as any[];
    const poById = new Map<string, any>();
    const existingOrders: Record<string, any> = {};
    for (const p of poDocs) {
      poById.set(p.$id, p);
      const oid = String(p?.orderId || '').trim();
      if (oid && !isDraftTrackerPurchase(p) && !isRefundedPurchaseOrder(p) && !existingOrders[oid]) {
        existingOrders[oid] = {
          poId: p.$id,
          poNumber: p.poNumber || `PO-${oid.slice(-6)}`,
          orderId: oid,
          status: p.status || 'Ordered',
          trackingNumber: p.trackingNumber || '',
          grandTotal: Number(p.grandTotal || 0),
          purchaseDate: p.purchaseDate || p.$createdAt || null,
        };
      }
    }

    const activeTrackerDoc = findBestActiveSgwTracker(poDocs);
    const activeTracker = activeTrackerDoc
      ? {
          id: activeTrackerDoc.$id,
          poNumber: activeTrackerDoc.poNumber,
          orderId: activeTrackerDoc.orderId || activeTrackerDoc.poNumber,
          vendor: activeTrackerDoc.vendor || 'Auctions',
        }
      : null;

    const watchlist: Record<string, any> = {};
    const combinableItems: any[] = [];
    for (const [sgwId, doc] of bySgwItemId.entries()) {
      const rawObj = parseRawAnalysisJson(doc.rawAnalysis);
      const rawSellerName =
        rawObj.sgwSeller ||
        rawObj.seller_info?.seller_name ||
        rawObj.sellerName ||
        doc.sellerName ||
        '';
      const sellerId =
        rawObj.sgwSellerId ||
        rawObj.seller_info?.seller_id ||
        doc.sellerId ||
        null;
      const cleanSeller = rawSellerName
        ? formatReadableSellerLabel({ sellerName: rawSellerName, sellerId, platform: 'shopgoodwill' })
        : '';
      const shippingWeight =
        Number(
          rawObj.sgwShippingWeight ||
            rawObj.seller_info?.shipping_weight ||
            rawObj.shipping_info?.weight ||
            1.0
        ) || 1.0;
      const canCombineShipping =
        rawObj.canCombineShipping !== undefined
          ? Boolean(rawObj.canCombineShipping)
          : rawObj.seller_info?.can_combine_shipping !== undefined
          ? Boolean(rawObj.seller_info.can_combine_shipping)
          : true;

      const linkedPo = poById.get(doc.purchaseId || doc.cartId || '');
      const trackerLabel =
        linkedPo && isDraftTrackerPurchase(linkedPo)
          ? `${linkedPo.orderId || linkedPo.poNumber} (${linkedPo.vendor || 'Auctions'})`
          : doc.status === 'tracked' && activeTracker
          ? `${activeTracker.orderId} (${activeTracker.vendor})`
          : null;

      const entry = {
        itemId: sgwId,
        docId: doc.$id,
        title: doc.title || doc.identity || '',
        status: doc.status || 'tracked',
        maxBid: Number(doc.maxBid || doc.maxBuyPrice || 0),
        currentBid: Number(doc.currentBid || doc.cost || 0),
        boutiquePrice: extractBoutiquePriceFromDoc(doc, rawObj),
        resalePrice: Number(doc.resalePrice || 0),
        auctionStatus: rawObj.auctionStatus || (doc.status === 'acquired' ? 'won' : null),
        bidState: rawObj.sgwBidState || (doc.status === 'acquired' ? 'won' : null),
        myMaxBid: Number(rawObj.sgwMyMaxBid || doc.maxBid || 0),
        sellerId,
        sellerName: cleanSeller,
        rawSellerName,
        shippingWeight,
        canCombineShipping,
        auctionEndsAt: doc.auctionEndsAt || rawObj.auction_meta?.end_time || null,
        orderId: doc.orderId || null,
        purchaseId: doc.purchaseId || doc.cartId || null,
        trackerLabel,
      };
      watchlist[sgwId] = entry;

      const isTrackOrUnshippedWon =
        doc.status === 'tracked' ||
        (doc.status === 'acquired' && !doc.orderId);
      if (isTrackOrUnshippedWon && cleanSeller) {
        combinableItems.push(entry);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        member: auth.member,
        count: Object.keys(watchlist).length,
        watchlist,
        combinableItems,
        existingOrders,
        activeTracker,
      }),
      { status: 200, headers: BML_CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'Failed to load SGW watchlist.' }),
      { status: 500, headers: BML_CORS_HEADERS }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireBookmarkletMember(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const pageType = String(body?.pageType || '').trim();
    const dryRun = Boolean(body?.dryRun);
    const rows: any[] = Array.isArray(body?.rows) ? body.rows : [];
    const selectedKeysRaw: string[] | null = Array.isArray(body?.selectedKeys)
      ? body.selectedKeys.map((k: any) => String(k || '').trim()).filter(Boolean)
      : null;
    const selectedSet = selectedKeysRaw && selectedKeysRaw.length > 0 ? new Set(selectedKeysRaw) : null;

    const { databases, dbId, itemsCol, purchasesCol } = getAppwriteServer();
    const [{ bySgwItemId, nextUpc }, poRes] = await Promise.all([
      scanRecentInventoryAndMaxUpc(databases, dbId, itemsCol, auth.member.prefix),
      databases.listDocuments(dbId, purchasesCol, [
        NodeQuery.limit(100),
        NodeQuery.orderDesc('$id'),
      ]),
    ]);
    const recentPoDocs = (poRes.documents || []) as any[];
    const poById = new Map<string, any>();
    for (const p of recentPoDocs) poById.set(p.$id, p);

    const perms = buildDocPermissions(auth.member.teamId, auth.member.userId);
    const resolvedPurchaseTenant = resolvePurchaseTenantId(
      auth.member.teamId,
      auth.member.userId,
      recentPoDocs
    );
    const itemTenantId =
      auth.member.teamId && auth.member.teamId !== 'huck_collective' ? auth.member.teamId : null;

    // 1. IN-PROGRESS AUCTIONS
    if (pageType === 'inprogress-auctions') {
      const previewActions: any[] = [];
      let updatedCount = 0;
      let createdCount = 0;
      let winningCount = 0;
      let outbidCount = 0;

      const trackerPo = await ensureActiveSgwBuyTracker(
        databases,
        dbId,
        purchasesCol,
        auth.member.teamId,
        auth.member.userId,
        recentPoDocs
      );
      const trackerLabel = `${trackerPo.orderId || trackerPo.poNumber} (${trackerPo.vendor || 'Auctions'})`;

      for (const r of rows) {
        const itemId = String(r?.itemId || '').replace(/\D/g, '').trim();
        if (!itemId) continue;
        const rowKey = itemId;
        const isRowSelected = !selectedSet || selectedSet.has(rowKey);

        const title = String(r?.title || `ShopGoodwill #${itemId}`).trim();
        const currentPrice = Number(r?.currentPrice || 0);
        const myMaxBid = Number(r?.myMaxBid || 0);
        const statusStr = String(r?.status || '');
        const hasTrophy =
          Boolean(r?.hasTrophy) ||
          (myMaxBid > 0 && currentPrice > 0 && myMaxBid > currentPrice) ||
          (/win|high/i.test(statusStr) && !/outbid|lost/i.test(statusStr));
        const bidState: 'winning' | 'outbid' = hasTrophy ? 'winning' : 'outbid';
        const endingDateRaw = String(r?.endingDate || '').trim();
        const auctionEndsAt = endingDateRaw ? parsePacificDateToIso(endingDateRaw) || undefined : undefined;

        if (bidState === 'winning') winningCount++;
        else outbidCount++;

        const matched = bySgwItemId.get(itemId);
        const rcMaxBid = matched ? Number(matched.maxBid || matched.maxBuyPrice || 0) : 0;
        const stateBadge = bidState === 'winning' ? '🟢 WINNING' : '🚨 OUTBID';

        if (matched) {
          const existingTitle = String(matched.title || matched.identity || '').trim();
          const bestTitle =
            title && (existingTitle.endsWith('...') || title.length > existingTitle.length)
              ? title
              : existingTitle || title;
          previewActions.push({
            rowKey,
            itemId,
            title: bestTitle,
            action: 'UPDATE_BID',
            rowCategory: 'PROMOTE_TRACKED',
            wasTracked: true,
            trackerLabel,
            defaultSelected: true,
            bidState,
            currentPrice,
            myMaxBid,
            rcMaxBid,
            detail: `${stateBadge} • $${currentPrice.toFixed(2)} (Max $${myMaxBid.toFixed(2)})`,
          });
          if (!dryRun && isRowSelected) {
            const rawObj = parseRawAnalysisJson(matched.rawAnalysis);
            rawObj.sgwItemId = itemId;
            rawObj.sgwBidState = bidState;
            rawObj.sgwMyMaxBid = myMaxBid;
            if (r?.seller) rawObj.sgwSeller = String(r.seller).slice(0, 120);
            rawObj.sgwSyncedAt = new Date().toISOString();
            const updatePayload: Record<string, any> = {
              identity: bestTitle.slice(0, 255),
              title: bestTitle.slice(0, 255),
              currentBid: currentPrice,
              cost: currentPrice,
              rawAnalysis: serializeRawAnalysisJson(rawObj),
            };
            if (myMaxBid > 0 && !matched.maxBid) {
              updatePayload.maxBid = myMaxBid;
              updatePayload.maxBuyPrice = myMaxBid;
            }
            if (auctionEndsAt) updatePayload.auctionEndsAt = auctionEndsAt;
            if (!matched.storageLocation) updatePayload.storageLocation = 'HG';
            if (!matched.purchaseId && trackerPo?.$id) {
              updatePayload.purchaseId = trackerPo.$id;
              updatePayload.cartId = trackerPo.$id;
            }
            await databases.updateDocument(dbId, itemsCol, matched.$id, updatePayload);
            updatedCount++;
          }
        } else {
          previewActions.push({
            rowKey,
            itemId,
            title,
            action: 'CREATE_TRACKED',
            rowCategory: 'NEW_ORDER_ITEM',
            wasTracked: false,
            trackerLabel,
            defaultSelected: true,
            bidState,
            currentPrice,
            myMaxBid,
            rcMaxBid: 0,
            detail: `${stateBadge} • $${currentPrice.toFixed(2)} (Max $${myMaxBid.toFixed(2)})`,
          });
          if (!dryRun && isRowSelected) {
            const rawObj = {
              sgwItemId: itemId,
              sgwBidState: bidState,
              sgwMyMaxBid: myMaxBid,
              sgwSeller: r?.seller ? String(r.seller).slice(0, 120) : 'ShopGoodwill',
              canCombineShipping: true,
              sgwSyncedAt: new Date().toISOString(),
            };
            const cleanTitle = (title || `ShopGoodwill #${itemId}`).slice(0, 255);
            const createDoc: Record<string, any> = {
              identity: cleanTitle,
              title: cleanTitle,
              status: 'tracked',
              storageLocation: 'HG',
              cost: currentPrice,
              currentBid: currentPrice,
              sourcingLocation: `https://shopgoodwill.com/item/${itemId}`,
              purchaseId: trackerPo?.$id || null,
              cartId: trackerPo?.$id || null,
              tenantId: itemTenantId,
              rawAnalysis: serializeRawAnalysisJson(rawObj),
            };
            if (myMaxBid > 0) {
              createDoc.maxBid = myMaxBid;
              createDoc.maxBuyPrice = myMaxBid;
            }
            if (auctionEndsAt) createDoc.auctionEndsAt = auctionEndsAt;

            const created = await databases.createDocument(
              dbId,
              itemsCol,
              NodeID.unique(),
              createDoc,
              perms
            );
            bySgwItemId.set(itemId, created);
            createdCount++;
          }
        }
      }

      if (!dryRun && trackerPo?.$id && (updatedCount > 0 || createdCount > 0)) {
        await syncTrackerTotals(databases, dbId, purchasesCol, itemsCol, trackerPo.$id);
      }

      return new Response(
        JSON.stringify({
          ok: true,
          pageType,
          dryRun,
          activeTracker: trackerPo
            ? {
                id: trackerPo.$id,
                poNumber: trackerPo.poNumber,
                orderId: trackerPo.orderId || trackerPo.poNumber,
                vendor: trackerPo.vendor || 'Auctions',
              }
            : null,
          summary: {
            totalRows: previewActions.length,
            winningCount,
            outbidCount,
            updatedCount: dryRun ? previewActions.filter((a) => a.action === 'UPDATE_BID').length : updatedCount,
            createdCount: dryRun ? previewActions.filter((a) => a.action === 'CREATE_TRACKED').length : createdCount,
          },
          rows: previewActions,
        }),
        { status: 200, headers: BML_CORS_HEADERS }
      );
    }

    // 2. CLOSED AUCTIONS (Won -> Acquired in HG; Lost -> Clean/Remove Tracked)
    if (pageType === 'closed-auctions') {
      const previewActions: any[] = [];
      let promotedWonCount = 0;
      let createdWonCount = 0;
      let cleanedLostCount = 0;
      let skippedCount = 0;
      const touchedTrackerIds = new Set<string>();

      for (const r of rows) {
        const itemId = String(r?.itemId || '').replace(/\D/g, '').trim();
        if (!itemId) continue;
        const rowKey = itemId;
        const isRowSelected = !selectedSet || selectedSet.has(rowKey);

        const title = String(r?.title || `ShopGoodwill #${itemId}`).trim();
        const currentPrice = Number(r?.currentPrice || 0);
        const statusRaw = String(r?.status || '').toLowerCase();
        const isWon = statusRaw.includes('won');
        const isLost = statusRaw.includes('lost');

        const matched = bySgwItemId.get(itemId);
        const linkedPo = matched ? poById.get(matched.purchaseId || matched.cartId || '') : null;
        const trackerLabel =
          linkedPo && isDraftTrackerPurchase(linkedPo)
            ? `${linkedPo.orderId || linkedPo.poNumber} (${linkedPo.vendor || 'Auctions'})`
            : matched?.status === 'tracked'
            ? 'Buy Tracker'
            : null;

        if (isWon) {
          if (matched) {
            const existingStatus = String(matched.status || '').toLowerCase();
            if (existingStatus === 'tracked') {
              previewActions.push({
                rowKey,
                itemId,
                title: matched.title || title,
                action: 'PROMOTE_WON_TO_ACQUIRED',
                rowCategory: 'PROMOTE_TRACKED',
                wasTracked: true,
                trackerLabel,
                defaultSelected: true,
                currentPrice,
                detail: `📌 Tracked ➔ Acquired (HG) @ $${currentPrice.toFixed(2)}`,
              });
              if (!dryRun && isRowSelected) {
                const rawObj = parseRawAnalysisJson(matched.rawAnalysis);
                rawObj.sgwItemId = itemId;
                rawObj.sgwBidState = 'won';
                rawObj.auctionStatus = 'won';
                rawObj.sgwWonBid = currentPrice;
                const assignedUpc = matched.upc || nextUpc();
                await databases.updateDocument(dbId, itemsCol, matched.$id, {
                  status: 'acquired',
                  cost: currentPrice,
                  currentBid: currentPrice,
                  storageLocation: matched.storageLocation || 'HG',
                  upc: assignedUpc,
                  rawAnalysis: serializeRawAnalysisJson(rawObj),
                });
                if (matched.purchaseId) touchedTrackerIds.add(matched.purchaseId);
                promotedWonCount++;
              }
            } else {
              previewActions.push({
                rowKey,
                itemId,
                title: matched.title || title,
                action: 'ALREADY_ACQUIRED',
                rowCategory: 'EXISTING_SYNCED',
                wasTracked: true,
                trackerLabel,
                defaultSelected: false,
                currentPrice,
                detail: `Already ${existingStatus} (${matched.upc || 'linked'})`,
              });
              skippedCount++;
            }
          } else {
            previewActions.push({
              rowKey,
              itemId,
              title,
              action: 'CREATE_WON_ACQUIRED',
              rowCategory: 'NEW_ORDER_ITEM',
              wasTracked: false,
              trackerLabel: null,
              defaultSelected: true,
              currentPrice,
              detail: `New Won Item ➔ Acquired (HG) @ $${currentPrice.toFixed(2)}`,
            });
            if (!dryRun && isRowSelected) {
              const assignedUpc = nextUpc();
              const cleanTitle = (title || `ShopGoodwill #${itemId}`).slice(0, 255);
              const created = await databases.createDocument(
                dbId,
                itemsCol,
                NodeID.unique(),
                {
                  identity: cleanTitle,
                  title: cleanTitle,
                  status: 'acquired',
                  storageLocation: 'HG',
                  upc: assignedUpc,
                  cost: currentPrice,
                  currentBid: currentPrice,
                  sourcingLocation: `https://shopgoodwill.com/item/${itemId}`,
                  tenantId: itemTenantId,
                  rawAnalysis: serializeRawAnalysisJson({
                    sgwItemId: itemId,
                    sgwBidState: 'won',
                    auctionStatus: 'won',
                    sgwWonBid: currentPrice,
                    sgwSeller: r?.seller ? String(r.seller).slice(0, 120) : 'ShopGoodwill',
                  }),
                },
                perms
              );
              bySgwItemId.set(itemId, created);
              createdWonCount++;
            }
          }
        } else if (isLost) {
          if (matched && String(matched.status || '').toLowerCase() === 'tracked') {
            previewActions.push({
              rowKey,
              itemId,
              title: matched.title || title,
              action: 'DELETE_LOST_TRACKED',
              rowCategory: 'PROMOTE_TRACKED',
              wasTracked: true,
              trackerLabel,
              defaultSelected: true,
              currentPrice,
              detail: 'Auction lost ➔ Remove from Buy Tracker',
            });
            if (!dryRun && isRowSelected) {
              if (matched.purchaseId) touchedTrackerIds.add(matched.purchaseId);
              await databases.deleteDocument(dbId, itemsCol, matched.$id);
              bySgwItemId.delete(itemId);
              cleanedLostCount++;
            }
          } else {
            previewActions.push({
              rowKey,
              itemId,
              title,
              action: 'SKIP_LOST_NOT_IN_TRACKER',
              rowCategory: 'EXISTING_SYNCED',
              wasTracked: false,
              trackerLabel: null,
              defaultSelected: false,
              currentPrice,
              detail: 'Auction lost (not in active Buy Tracker)',
            });
            skippedCount++;
          }
        }
      }

      if (!dryRun && touchedTrackerIds.size > 0) {
        for (const tid of touchedTrackerIds) {
          await syncTrackerTotals(databases, dbId, purchasesCol, itemsCol, tid);
        }
      }

      return new Response(
        JSON.stringify({
          ok: true,
          pageType,
          dryRun,
          summary: {
            totalRows: previewActions.length,
            promotedWonCount: dryRun
              ? previewActions.filter((a) => a.action === 'PROMOTE_WON_TO_ACQUIRED').length
              : promotedWonCount,
            createdWonCount: dryRun
              ? previewActions.filter((a) => a.action === 'CREATE_WON_ACQUIRED').length
              : createdWonCount,
            cleanedLostCount: dryRun
              ? previewActions.filter((a) => a.action === 'DELETE_LOST_TRACKED').length
              : cleanedLostCount,
            skippedCount,
          },
          rows: previewActions,
        }),
        { status: 200, headers: BML_CORS_HEADERS }
      );
    }

    // 3. SHIPPED ORDERS (Ricochet-Style Preview: Promote Tracked, Create New Order Items, Update Tracking, Existing Orders)
    if (pageType === 'shipped-orders') {
      const ordersMap = new Map<string, any[]>();
      for (const r of rows) {
        const orderId = String(r?.orderId || '').replace(/\D/g, '').trim();
        const itemId = String(r?.itemId || '').replace(/\D/g, '').trim();
        if (!orderId && !itemId) continue;
        const key = orderId || itemId;
        if (!ordersMap.has(key)) ordersMap.set(key, []);
        ordersMap.get(key)!.push({ ...r, orderId: key, itemId: itemId || key });
      }

      const poByOrderId = new Map<string, any>();
      for (const p of recentPoDocs) {
        const oid = String(p?.orderId || '').trim();
        if (oid && !isDraftTrackerPurchase(p) && !poByOrderId.has(oid)) {
          poByOrderId.set(oid, p);
        }
      }

      const previewActions: any[] = [];
      let createdPoCount = 0;
      let updatedPoCount = 0;
      let updatedItemCount = 0;
      let createdItemCount = 0;
      let promotedTrackedCount = 0;
      let existingSyncedCount = 0;
      let refundedSkippedCount = 0;
      const touchedTrackerIds = new Set<string>();

      for (const [orderId, groupRows] of ordersMap.entries()) {
        const subtotal = groupRows.reduce((s, r) => s + Number(r.price || 0) * Math.max(1, Number(r.qty || 1)), 0);
        const shippingTotal = groupRows.reduce((s, r) => s + Number(r.shipping || 0), 0);
        const handlingTotal = groupRows.reduce((s, r) => s + Number(r.handling || 0), 0);
        const taxTotal = groupRows.reduce((s, r) => s + Number(r.tax || 0), 0);
        const grandTotal = Number((subtotal + shippingTotal + handlingTotal + taxTotal).toFixed(2));
        const trackingRaw =
          groupRows
            .map((r) => String(r.trackingNumber || '').trim())
            .find((t) => t.length > 0) || '';
        const isOrderRefunded =
          isRefundedOrCancelledTracking(trackingRaw) ||
          groupRows.some(
            (r) =>
              isRefundedOrCancelledTracking(r.trackingNumber) ||
              isRefundedOrCancelledTracking(r.status)
          );

        let poDoc = poByOrderId.get(orderId) || null;

        if (isOrderRefunded) {
          refundedSkippedCount += groupRows.length;
          // Auto-purge any previously imported refunded PO (e.g. PO-005844 / #62005844) and its items
          if (!dryRun && poDoc?.$id) {
            try {
              await databases.deleteDocument(dbId, purchasesCol, poDoc.$id);
              poByOrderId.delete(orderId);
              poById.delete(poDoc.$id);
            } catch {}
          }
          for (const r of groupRows) {
            const itemId = String(r.itemId || '').trim();
            const rowKey = `${orderId}:${itemId}`;
            const title = String(r.title || `ShopGoodwill #${itemId}`).trim();
            const basePrice = Number(r.price || 0);
            const matched = bySgwItemId.get(itemId);
            if (!dryRun && matched?.$id) {
              if (matched.purchaseId) touchedTrackerIds.add(matched.purchaseId);
              try {
                await databases.deleteDocument(dbId, itemsCol, matched.$id);
                bySgwItemId.delete(itemId);
              } catch {}
            }
            previewActions.push({
              rowKey,
              orderId,
              itemId,
              title,
              action: 'SKIP_REFUNDED_ORDER',
              rowCategory: 'REFUNDED',
              isRefunded: true,
              wasTracked: false,
              trackerLabel: null,
              existingPoId: null,
              existingPoNumber: null,
              existingPoStatus: 'Refunded',
              defaultSelected: false,
              basePrice,
              landedCost: 0,
              trackingLabel: 'Refunded',
              trackingNumber: 'Refunded',
              upc: null,
              detail: `🚫 Order #${orderId} Refunded ($${grandTotal.toFixed(2)}) — Ignored & Excluded from Purchases`,
            });
          }
          continue;
        }

        const parsedTrk = parseTrackingNumbers(trackingRaw);
        const hasValidTracking = parsedTrk.length > 0;
        const poNeedsTrackingUpdate = Boolean(
          poDoc &&
            ((trackingRaw && poDoc.trackingNumber !== trackingRaw) ||
              (hasValidTracking && (poDoc.status === 'Pending' || poDoc.status === 'Draft' || poDoc.status === 'Ordered')) ||
              (!poDoc.grandTotal && grandTotal > 0))
        );

        const anyGroupRowSelected = groupRows.some((r) => {
          const itemId = String(r.itemId || '').trim();
          const rowKey = `${orderId}:${itemId}`;
          return !selectedSet || selectedSet.has(rowKey) || selectedSet.has(itemId);
        });

        if (!poDoc) {
          if (!dryRun && anyGroupRowSelected) {
            let safeDate = new Date().toISOString();
            if (groupRows[0]?.date) {
              const d = new Date(groupRows[0].date);
              if (!isNaN(d.getTime())) safeDate = d.toISOString();
            }
            poDoc = await databases.createDocument(
              dbId,
              purchasesCol,
              NodeID.unique(),
              {
                poNumber: `PO-${orderId.slice(-6)}`,
                orderId,
                vendor: 'ShopGoodwill',
                purchaseDate: safeDate,
                trackingNumber: trackingRaw,
                subtotal: Number(subtotal.toFixed(2)),
                shippingTotal: Number(shippingTotal.toFixed(2)),
                handlingTotal: Number(handlingTotal.toFixed(2)),
                taxTotal: Number(taxTotal.toFixed(2)),
                feeTotal: 0,
                grandTotal,
                status: hasValidTracking ? 'Shipped' : 'Ordered',
                tenantId: resolvedPurchaseTenant,
              },
              perms
            );
            poByOrderId.set(orderId, poDoc);
            poById.set(poDoc.$id, poDoc);
            createdPoCount++;
          } else if (dryRun) {
            createdPoCount++;
          }
        } else if (poNeedsTrackingUpdate) {
          if (!dryRun && anyGroupRowSelected) {
            const poUpd: Record<string, any> = {};
            if (trackingRaw) poUpd.trackingNumber = trackingRaw;
            if (hasValidTracking && (poDoc.status === 'Pending' || poDoc.status === 'Draft' || poDoc.status === 'Ordered')) {
              poUpd.status = 'Shipped';
            }
            if (!poDoc.grandTotal && grandTotal > 0) {
              poUpd.subtotal = Number(subtotal.toFixed(2));
              poUpd.shippingTotal = Number(shippingTotal.toFixed(2));
              poUpd.handlingTotal = Number(handlingTotal.toFixed(2));
              poUpd.taxTotal = Number(taxTotal.toFixed(2));
              poUpd.grandTotal = grandTotal;
            }
            poDoc = await databases.updateDocument(dbId, purchasesCol, poDoc.$id, poUpd);
            poByOrderId.set(orderId, poDoc);
            poById.set(poDoc.$id, poDoc);
            updatedPoCount++;
          } else if (dryRun) {
            updatedPoCount++;
          }
        }

        const extraFeesPerRow = (shippingTotal + handlingTotal + taxTotal) / Math.max(1, groupRows.length);

        for (const r of groupRows) {
          const itemId = String(r.itemId || '').trim();
          const rowKey = `${orderId}:${itemId}`;
          const isRowSelected = !selectedSet || selectedSet.has(rowKey) || selectedSet.has(itemId);

          const title = String(r.title || `ShopGoodwill #${itemId}`).trim();
          const basePrice = Number(r.price || 0);
          const landedCost = Number((basePrice + extraFeesPerRow).toFixed(2));
          const matched = bySgwItemId.get(itemId);
          const carrierLabel = parsedTrk[0]
            ? `${parsedTrk[0].carrier} •••${parsedTrk[0].shortNumber}`
            : 'No tracking yet';

          const oldLinkedPo = matched ? poById.get(matched.purchaseId || matched.cartId || '') : null;
          const isFromDraftTracker = Boolean(oldLinkedPo && isDraftTrackerPurchase(oldLinkedPo));
          const wasTracked = Boolean(
            matched &&
              (matched.status === 'tracked' ||
                isFromDraftTracker ||
                (!matched.orderId && matched.status === 'acquired'))
          );
          const trackerLabel = isFromDraftTracker
            ? `${oldLinkedPo.orderId || oldLinkedPo.poNumber} (${oldLinkedPo.vendor || 'Auctions'})`
            : wasTracked
            ? 'Buy Tracker'
            : null;

          const existingPoNumber = poDoc?.poNumber || (poByOrderId.get(orderId)?.poNumber ?? null);
          const existingPoId = poDoc?.$id || (poByOrderId.get(orderId)?.$id ?? null);

          if (matched) {
            const alreadyLinkedToThisOrder =
              matched.status !== 'tracked' &&
              !isFromDraftTracker &&
              (String(matched.orderId || '') === orderId ||
                (existingPoId && matched.purchaseId === existingPoId));

            let rowCategory: 'PROMOTE_TRACKED' | 'UPDATE_TRACKING' | 'EXISTING_SYNCED' = 'EXISTING_SYNCED';
            let action = 'VERIFY_SHIPPED_ITEM';
            if (wasTracked) {
              rowCategory = 'PROMOTE_TRACKED';
              action = 'LINK_SHIPPED_ITEM';
              promotedTrackedCount++;
            } else if (poNeedsTrackingUpdate || !alreadyLinkedToThisOrder) {
              rowCategory = 'UPDATE_TRACKING';
              action = 'LINK_SHIPPED_ITEM';
            } else {
              rowCategory = 'EXISTING_SYNCED';
              action = 'VERIFY_SHIPPED_ITEM';
              existingSyncedCount++;
            }

            const defaultSelected = rowCategory !== 'EXISTING_SYNCED';

            previewActions.push({
              rowKey,
              orderId,
              itemId,
              title: matched.title || matched.identity || title,
              action,
              rowCategory,
              wasTracked,
              trackerLabel,
              existingPoId,
              existingPoNumber,
              existingPoStatus: poDoc?.status || (hasValidTracking ? 'Shipped' : 'Ordered'),
              defaultSelected,
              basePrice,
              landedCost,
              trackingLabel: carrierLabel,
              trackingNumber: trackingRaw,
              upc: matched.upc || null,
              detail: wasTracked
                ? `📌 Tracked (${trackerLabel || 'Scout'}) ➔ Order #${orderId} ($${landedCost.toFixed(2)} • ${carrierLabel})`
                : rowCategory === 'EXISTING_SYNCED'
                ? `✅ Synced in ${existingPoNumber || `PO-${orderId.slice(-6)}`} • $${landedCost.toFixed(2)} (${carrierLabel})`
                : `🚚 Update Order #${orderId} • Landed $${landedCost.toFixed(2)} (${carrierLabel})`,
            });

            if (!dryRun && isRowSelected && (rowCategory !== 'EXISTING_SYNCED' || selectedSet?.has(rowKey))) {
              const rawObj = parseRawAnalysisJson(matched.rawAnalysis);
              rawObj.sgwItemId = itemId;
              rawObj.sgwBidState = 'won';
              rawObj.auctionStatus = 'won';
              rawObj.sgwOrderId = orderId;
              rawObj.sgwSyncedAt = new Date().toISOString();

              const upd: Record<string, any> = {
                orderId,
                cost: landedCost,
                rawAnalysis: serializeRawAnalysisJson(rawObj),
              };
              if (poDoc?.$id) {
                if (matched.purchaseId && matched.purchaseId !== poDoc.$id && isFromDraftTracker) {
                  touchedTrackerIds.add(matched.purchaseId);
                }
                if (matched.cartId && matched.cartId !== poDoc.$id) {
                  touchedTrackerIds.add(matched.cartId);
                }
                upd.purchaseId = poDoc.$id;
                upd.cartId = null;
              }
              if (matched.status === 'tracked') {
                upd.status = 'acquired';
              }
              if (!matched.storageLocation) upd.storageLocation = 'HG';
              if (!matched.upc) upd.upc = nextUpc();
              await databases.updateDocument(dbId, itemsCol, matched.$id, upd);
              updatedItemCount++;
            }
          } else {
            previewActions.push({
              rowKey,
              orderId,
              itemId,
              title,
              action: 'CREATE_SHIPPED_ITEM',
              rowCategory: 'NEW_ORDER_ITEM',
              wasTracked: false,
              trackerLabel: null,
              existingPoId,
              existingPoNumber,
              existingPoStatus: poDoc?.status || (hasValidTracking ? 'Shipped' : 'Ordered'),
              defaultSelected: true,
              basePrice,
              landedCost,
              trackingLabel: carrierLabel,
              trackingNumber: trackingRaw,
              upc: null,
              detail: `🆕 New Order #${orderId} ➔ Acquired (HG) @ $${landedCost.toFixed(2)} (${carrierLabel})`,
            });
            if (!dryRun && isRowSelected) {
              const cleanTitle = (title || `ShopGoodwill #${itemId}`).slice(0, 255);
              const created = await databases.createDocument(
                dbId,
                itemsCol,
                NodeID.unique(),
                {
                  identity: cleanTitle,
                  title: cleanTitle,
                  status: 'acquired',
                  storageLocation: 'HG',
                  upc: nextUpc(),
                  cost: landedCost,
                  currentBid: basePrice,
                  orderId,
                  purchaseId: poDoc?.$id || null,
                  sourcingLocation: `https://shopgoodwill.com/item/${itemId}`,
                  tenantId: itemTenantId,
                  rawAnalysis: serializeRawAnalysisJson({
                    sgwItemId: itemId,
                    sgwBidState: 'won',
                    auctionStatus: 'won',
                    sgwOrderId: orderId,
                    sgwSeller: 'ShopGoodwill',
                    sgwSyncedAt: new Date().toISOString(),
                  }),
                },
                perms
              );
              bySgwItemId.set(itemId, created);
              createdItemCount++;
            }
          }
        }
      }

      if (!dryRun && touchedTrackerIds.size > 0) {
        for (const tid of touchedTrackerIds) {
          await syncTrackerTotals(databases, dbId, purchasesCol, itemsCol, tid);
        }
      }

      return new Response(
        JSON.stringify({
          ok: true,
          pageType,
          dryRun,
          summary: {
            totalRows: previewActions.length,
            createdPoCount,
            updatedPoCount,
            promotedTrackedCount: dryRun
              ? previewActions.filter((a) => a.rowCategory === 'PROMOTE_TRACKED').length
              : promotedTrackedCount,
            newOrderItemCount: dryRun
              ? previewActions.filter((a) => a.rowCategory === 'NEW_ORDER_ITEM').length
              : createdItemCount,
            updateTrackingCount: dryRun
              ? previewActions.filter((a) => a.rowCategory === 'UPDATE_TRACKING').length
              : updatedPoCount,
            existingSyncedCount: dryRun
              ? previewActions.filter((a) => a.rowCategory === 'EXISTING_SYNCED').length
              : existingSyncedCount,
            refundedSkippedCount,
            updatedItemCount: dryRun
              ? previewActions.filter((a) => a.action === 'LINK_SHIPPED_ITEM').length
              : updatedItemCount,
            createdItemCount: dryRun
              ? previewActions.filter((a) => a.action === 'CREATE_SHIPPED_ITEM').length
              : createdItemCount,
          },
          rows: previewActions,
        }),
        { status: 200, headers: BML_CORS_HEADERS }
      );
    }

    // 4. SINGLE ITEM PAGE (/item/:id) -> Track in Active Buy Tracker (e.g. SC-579892 | Auctions)
    if (pageType === 'item') {
      const r = rows[0] || body?.item || {};
      const itemId = String(r?.itemId || '').replace(/\D/g, '').trim();
      if (!itemId) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Missing ShopGoodwill Item ID.' }),
          { status: 400, headers: BML_CORS_HEADERS }
        );
      }
      const title = String(r?.title || `ShopGoodwill #${itemId}`).trim();
      const currentPrice = Number(r?.currentPrice || 0);
      const maxBid = Number(r?.maxBid || 0);
      const boutiquePrice = Number(r?.boutiquePrice || r?.resalePrice || 0);
      const resalePrice = Number(r?.resalePrice || r?.boutiquePrice || 0);
      const sellerName = r?.seller ? String(r.seller).slice(0, 120) : 'ShopGoodwill';
      const sellerId = r?.sellerId ? String(r.sellerId) : undefined;
      const shippingWeight = Number(r?.shippingWeight || 0) || undefined;
      const canCombineShipping = r?.canCombineShipping !== undefined ? Boolean(r.canCombineShipping) : true;
      const primaryImageUrl = r?.primaryImageUrl ? String(r.primaryImageUrl).trim() : undefined;
      const auctionEndsAtRaw = String(r?.auctionEndsAt || r?.endingDate || '').trim();
      const auctionEndsAt = auctionEndsAtRaw
        ? (auctionEndsAtRaw.includes('T') ? auctionEndsAtRaw : parsePacificDateToIso(auctionEndsAtRaw)) || undefined
        : undefined;
      const conditionNotesInput = r?.conditionNotes ? String(r.conditionNotes).slice(0, 1800) : undefined;
      const aiReport = r?.aiReport && typeof r.aiReport === 'object' ? r.aiReport : null;

      const trackerPo = await ensureActiveSgwBuyTracker(
        databases,
        dbId,
        purchasesCol,
        auth.member.teamId,
        auth.member.userId,
        recentPoDocs
      );
      const trackerMeta = trackerPo
        ? {
            id: trackerPo.$id,
            poNumber: trackerPo.poNumber,
            orderId: trackerPo.orderId || trackerPo.poNumber,
            vendor: trackerPo.vendor || 'Auctions',
          }
        : null;

      const matched = bySgwItemId.get(itemId);

      if (matched) {
        if (!dryRun) {
          const existingRaw = parseRawAnalysisJson(matched.rawAnalysis);
          const rawObj = {
            ...existingRaw,
            ...(aiReport || {}),
            sgwItemId: itemId,
            sgwSeller: sellerName,
            sgwSellerId: sellerId || existingRaw.sgwSellerId || null,
            sgwShippingWeight: shippingWeight || existingRaw.sgwShippingWeight || 1.0,
            canCombineShipping,
            boutiquePrice: boutiquePrice > 0 ? boutiquePrice : existingRaw.boutiquePrice || 0,
            fetched_image: primaryImageUrl || existingRaw.fetched_image || null,
            sgwMyMaxBid: maxBid > 0 ? maxBid : Number(matched.maxBid || existingRaw.sgwMyMaxBid || 0),
            sgwSyncedAt: new Date().toISOString(),
          };
          const cleanTitle = (title || matched.title || matched.identity || `ShopGoodwill #${itemId}`).slice(0, 255);
          const updateDoc: Record<string, any> = {
            identity: cleanTitle,
            title: cleanTitle,
            currentBid: currentPrice > 0 ? currentPrice : matched.currentBid,
            cost: currentPrice > 0 ? currentPrice : matched.cost,
            rawAnalysis: serializeRawAnalysisJson(rawObj),
          };
          if (!matched.purchaseId && trackerPo?.$id) {
            updateDoc.purchaseId = trackerPo.$id;
            updateDoc.cartId = trackerPo.$id;
          }
          if (maxBid > 0) {
            updateDoc.maxBid = maxBid;
            updateDoc.maxBuyPrice = maxBid;
          }
          if (resalePrice > 0) updateDoc.resalePrice = resalePrice;
          if (auctionEndsAt) updateDoc.auctionEndsAt = auctionEndsAt;
          const mergedNotes = buildConditionNotesWithMeta(
            conditionNotesInput,
            matched.conditionNotes,
            boutiquePrice,
            primaryImageUrl
          );
          if (mergedNotes) updateDoc.conditionNotes = mergedNotes;
          if (!matched.storageLocation) updateDoc.storageLocation = 'HG';

          await databases.updateDocument(dbId, itemsCol, matched.$id, updateDoc);
          await syncTrackerTotals(databases, dbId, purchasesCol, itemsCol, updateDoc.purchaseId || matched.purchaseId || trackerPo?.$id);

          return new Response(
            JSON.stringify({
              ok: true,
              pageType,
              dryRun: false,
              action: 'UPDATED_TRACKED',
              docId: matched.$id,
              itemId,
              title: cleanTitle,
              maxBid,
              tracker: trackerMeta,
            }),
            { status: 200, headers: BML_CORS_HEADERS }
          );
        }
        return new Response(
          JSON.stringify({
            ok: true,
            pageType,
            dryRun,
            action: 'ALREADY_TRACKED',
            docId: matched.$id,
            itemId,
            title: matched.title || title,
            maxBid: maxBid || matched.maxBid || 0,
            tracker: trackerMeta,
          }),
          { status: 200, headers: BML_CORS_HEADERS }
        );
      }

      if (!dryRun) {
        const rawObj = {
          ...(aiReport || {}),
          sgwItemId: itemId,
          sgwSeller: sellerName,
          sgwSellerId: sellerId || null,
          sgwShippingWeight: shippingWeight || 1.0,
          canCombineShipping,
          boutiquePrice: boutiquePrice > 0 ? boutiquePrice : 0,
          fetched_image: primaryImageUrl || null,
          sgwMyMaxBid: maxBid > 0 ? maxBid : 0,
          sgwSyncedAt: new Date().toISOString(),
        };
        const cleanTitle = (title || `ShopGoodwill #${itemId}`).slice(0, 255);
        const createPayload: Record<string, any> = {
          identity: cleanTitle,
          title: cleanTitle,
          status: 'tracked',
          storageLocation: 'HG',
          cost: currentPrice,
          currentBid: currentPrice,
          sourcingLocation: `https://shopgoodwill.com/item/${itemId}`,
          purchaseId: trackerPo?.$id || null,
          cartId: trackerPo?.$id || null,
          tenantId: itemTenantId,
          rawAnalysis: serializeRawAnalysisJson(rawObj),
        };
        if (maxBid > 0) {
          createPayload.maxBid = maxBid;
          createPayload.maxBuyPrice = maxBid;
        }
        if (resalePrice > 0) createPayload.resalePrice = resalePrice;
        if (auctionEndsAt) createPayload.auctionEndsAt = auctionEndsAt;
        const mergedNotes = buildConditionNotesWithMeta(
          conditionNotesInput,
          undefined,
          boutiquePrice,
          primaryImageUrl
        );
        if (mergedNotes) createPayload.conditionNotes = mergedNotes;

        const created = await databases.createDocument(
          dbId,
          itemsCol,
          NodeID.unique(),
          createPayload,
          perms
        );
        await syncTrackerTotals(databases, dbId, purchasesCol, itemsCol, trackerPo?.$id);

        return new Response(
          JSON.stringify({
            ok: true,
            pageType,
            dryRun: false,
            action: 'CREATED_TRACKED',
            docId: created.$id,
            itemId,
            title: cleanTitle,
            maxBid,
            tracker: trackerMeta,
          }),
          { status: 200, headers: BML_CORS_HEADERS }
        );
      }

      return new Response(
        JSON.stringify({
          ok: true,
          pageType,
          dryRun: true,
          action: 'PREVIEW_TRACK',
          itemId,
          title,
          currentPrice,
          maxBid,
          tracker: trackerMeta,
        }),
        { status: 200, headers: BML_CORS_HEADERS }
      );
    }

    return new Response(
      JSON.stringify({ ok: false, error: `Unsupported pageType: ${pageType}` }),
      { status: 400, headers: BML_CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'SGW sync failed.' }),
      { status: 500, headers: BML_CORS_HEADERS }
    );
  }
};

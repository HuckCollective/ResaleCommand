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
import { parseTrackingNumbers } from '../../../lib/shipmentTracking';
import { parsePacificDateToIso } from '../../../lib/dateTimeUtils';

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

async function ensureActiveSgwBuyTracker(
  databases: NodeDatabases,
  dbId: string,
  purchasesCol: string,
  teamId: string,
  userId: string
): Promise<any> {
  const res = await databases.listDocuments(dbId, purchasesCol, [
    NodeQuery.limit(50),
    NodeQuery.orderDesc('$id'),
  ]);
  const existing = (res.documents || []).find((p: any) => {
    const st = String(p?.status || '').toLowerCase();
    const vendor = String(p?.vendor || '').toLowerCase();
    return (st === 'draft' || st === 'pending') && vendor.includes('goodwill');
  });
  if (existing) return existing;

  const poNum = `PO-SGW-${String(Date.now()).slice(-5)}`;
  return await databases.createDocument(
    dbId,
    purchasesCol,
    NodeID.unique(),
    {
      poNumber: poNum,
      vendor: 'ShopGoodwill (Active Bids)',
      purchaseDate: new Date().toISOString(),
      status: 'Draft',
      subtotal: 0,
      shippingTotal: 0,
      handlingTotal: 0,
      taxTotal: 0,
      feeTotal: 0,
      grandTotal: 0,
      tenantId: teamId && teamId !== 'huck_collective' ? teamId : null,
    },
    buildDocPermissions(teamId, userId)
  );
}

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: BML_CORS_HEADERS });
};

export const GET: APIRoute = async ({ request }) => {
  const auth = await requireBookmarkletMember(request);
  if (!auth.ok) return auth.response;

  try {
    const { databases, dbId, itemsCol } = getAppwriteServer();
    const { bySgwItemId } = await scanRecentInventoryAndMaxUpc(databases, dbId, itemsCol, auth.member.prefix);

    const watchlist: Record<string, any> = {};
    for (const [sgwId, doc] of bySgwItemId.entries()) {
      const rawObj = parseRawAnalysisJson(doc.rawAnalysis);
      watchlist[sgwId] = {
        itemId: sgwId,
        docId: doc.$id,
        title: doc.title || '',
        status: doc.status || 'tracked',
        maxBid: Number(doc.maxBid || doc.maxBuyPrice || 0),
        currentBid: Number(doc.currentBid || doc.cost || 0),
        boutiquePrice: Number(doc.boutiquePrice || doc.resalePrice || 0),
        auctionStatus: doc.auctionStatus || null,
        bidState: rawObj.sgwBidState || null,
        myMaxBid: Number(rawObj.sgwMyMaxBid || 0),
      };
    }

    return new Response(
      JSON.stringify({
        ok: true,
        member: auth.member,
        count: Object.keys(watchlist).length,
        watchlist,
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

    const { databases, dbId, itemsCol, purchasesCol } = getAppwriteServer();
    const { bySgwItemId, nextUpc } = await scanRecentInventoryAndMaxUpc(
      databases,
      dbId,
      itemsCol,
      auth.member.prefix
    );
    const perms = buildDocPermissions(auth.member.teamId, auth.member.userId);

    // 1. IN-PROGRESS AUCTIONS
    if (pageType === 'inprogress-auctions') {
      const previewActions: any[] = [];
      let updatedCount = 0;
      let createdCount = 0;
      let winningCount = 0;
      let outbidCount = 0;

      let trackerPo: any = null;
      if (!dryRun && rows.length > 0) {
        trackerPo = await ensureActiveSgwBuyTracker(
          databases,
          dbId,
          purchasesCol,
          auth.member.teamId,
          auth.member.userId
        );
      }

      for (const r of rows) {
        const itemId = String(r?.itemId || '').replace(/\D/g, '').trim();
        if (!itemId) continue;
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
          const existingTitle = String(matched.title || '').trim();
          const bestTitle =
            title && (existingTitle.endsWith('...') || title.length > existingTitle.length)
              ? title
              : existingTitle || title;
          previewActions.push({
            itemId,
            title: bestTitle,
            action: 'UPDATE_BID',
            bidState,
            currentPrice,
            myMaxBid,
            rcMaxBid,
            detail: `${stateBadge} • $${currentPrice.toFixed(2)} (Max $${myMaxBid.toFixed(2)})`,
          });
          if (!dryRun) {
            const rawObj = parseRawAnalysisJson(matched.rawAnalysis);
            rawObj.sgwBidState = bidState;
            rawObj.sgwMyMaxBid = myMaxBid;
            rawObj.sgwSyncedAt = new Date().toISOString();
            const updatePayload: Record<string, any> = {
              title: bestTitle,
              currentBid: currentPrice,
              rawAnalysis: serializeRawAnalysisJson(rawObj),
            };
            if (auctionEndsAt) updatePayload.auctionEndsAt = auctionEndsAt;
            if (!matched.storageLocation) updatePayload.storageLocation = 'HG';
            await databases.updateDocument(dbId, itemsCol, matched.$id, updatePayload);
            updatedCount++;
          }
        } else {
          previewActions.push({
            itemId,
            title,
            action: 'CREATE_TRACKED',
            bidState,
            currentPrice,
            myMaxBid,
            rcMaxBid: 0,
            detail: `${stateBadge} • $${currentPrice.toFixed(2)} (Max $${myMaxBid.toFixed(2)})`,
          });
          if (!dryRun) {
            const rawObj = {
              sgwItemId: itemId,
              sgwBidState: bidState,
              sgwMyMaxBid: myMaxBid,
              sgwSeller: r?.seller || '',
              sgwSyncedAt: new Date().toISOString(),
            };
            const created = await databases.createDocument(
              dbId,
              itemsCol,
              NodeID.unique(),
              {
                title,
                status: 'tracked',
                storageLocation: 'HG',
                cost: currentPrice,
                currentBid: currentPrice,
                maxBid: myMaxBid > 0 ? myMaxBid : undefined,
                auctionEndsAt,
                sourcingLocation: `https://shopgoodwill.com/item/${itemId}`,
                sellerName: r?.seller ? String(r.seller).slice(0, 120) : 'ShopGoodwill',
                purchaseId: trackerPo?.$id || null,
                cartId: trackerPo?.$id || null,
                tenantId: auth.member.teamId !== 'huck_collective' ? auth.member.teamId : null,
                rawAnalysis: serializeRawAnalysisJson(rawObj),
              },
              perms
            );
            bySgwItemId.set(itemId, created);
            createdCount++;
          }
        }
      }

      return new Response(
        JSON.stringify({
          ok: true,
          pageType,
          dryRun,
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

      for (const r of rows) {
        const itemId = String(r?.itemId || '').replace(/\D/g, '').trim();
        if (!itemId) continue;
        const title = String(r?.title || `ShopGoodwill #${itemId}`).trim();
        const currentPrice = Number(r?.currentPrice || 0);
        const statusRaw = String(r?.status || '').toLowerCase();
        const isWon = statusRaw.includes('won');
        const isLost = statusRaw.includes('lost');

        const matched = bySgwItemId.get(itemId);

        if (isWon) {
          if (matched) {
            const existingStatus = String(matched.status || '').toLowerCase();
            if (existingStatus === 'tracked') {
              previewActions.push({
                itemId,
                title: matched.title || title,
                action: 'PROMOTE_WON_TO_ACQUIRED',
                currentPrice,
                detail: `Tracked ➔ Acquired (HG) @ $${currentPrice.toFixed(2)}`,
              });
              if (!dryRun) {
                const rawObj = parseRawAnalysisJson(matched.rawAnalysis);
                rawObj.sgwBidState = 'won';
                rawObj.sgwWonBid = currentPrice;
                const assignedUpc = matched.upc || nextUpc();
                await databases.updateDocument(dbId, itemsCol, matched.$id, {
                  status: 'acquired',
                  auctionStatus: 'won',
                  cost: currentPrice,
                  currentBid: currentPrice,
                  storageLocation: matched.storageLocation || 'HG',
                  upc: assignedUpc,
                  rawAnalysis: serializeRawAnalysisJson(rawObj),
                });
                promotedWonCount++;
              }
            } else {
              previewActions.push({
                itemId,
                title: matched.title || title,
                action: 'ALREADY_ACQUIRED',
                currentPrice,
                detail: `Already ${existingStatus} (${matched.upc || 'linked'})`,
              });
              skippedCount++;
            }
          } else {
            previewActions.push({
              itemId,
              title,
              action: 'CREATE_WON_ACQUIRED',
              currentPrice,
              detail: `New Won Item ➔ Acquired (HG) @ $${currentPrice.toFixed(2)}`,
            });
            if (!dryRun) {
              const assignedUpc = nextUpc();
              const created = await databases.createDocument(
                dbId,
                itemsCol,
                NodeID.unique(),
                {
                  title,
                  status: 'acquired',
                  auctionStatus: 'won',
                  storageLocation: 'HG',
                  upc: assignedUpc,
                  cost: currentPrice,
                  currentBid: currentPrice,
                  sourcingLocation: `https://shopgoodwill.com/item/${itemId}`,
                  sellerName: r?.seller ? String(r.seller).slice(0, 120) : 'ShopGoodwill',
                  tenantId: auth.member.teamId !== 'huck_collective' ? auth.member.teamId : null,
                  rawAnalysis: serializeRawAnalysisJson({
                    sgwItemId: itemId,
                    sgwBidState: 'won',
                    sgwWonBid: currentPrice,
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
              itemId,
              title: matched.title || title,
              action: 'DELETE_LOST_TRACKED',
              currentPrice,
              detail: 'Auction lost ➔ Remove from Buy Tracker',
            });
            if (!dryRun) {
              await databases.deleteDocument(dbId, itemsCol, matched.$id);
              bySgwItemId.delete(itemId);
              cleanedLostCount++;
            }
          } else {
            previewActions.push({
              itemId,
              title,
              action: 'SKIP_LOST_NOT_IN_TRACKER',
              currentPrice,
              detail: 'Auction lost (not in active Buy Tracker)',
            });
            skippedCount++;
          }
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

    // 3. SHIPPED ORDERS (Group by Order #, Upsert PO with Tracking, Allocate True Landed Cost)
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

      // Fetch recent POs to match by orderId
      const poRes = await databases.listDocuments(dbId, purchasesCol, [
        NodeQuery.limit(100),
        NodeQuery.orderDesc('$id'),
      ]);
      const poByOrderId = new Map<string, any>();
      for (const p of (poRes.documents || []) as any[]) {
        const oid = String(p?.orderId || '').trim();
        if (oid && !poByOrderId.has(oid)) poByOrderId.set(oid, p);
      }

      const previewActions: any[] = [];
      let createdPoCount = 0;
      let updatedPoCount = 0;
      let updatedItemCount = 0;
      let createdItemCount = 0;

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
        const parsedTrk = parseTrackingNumbers(trackingRaw);
        const hasValidTracking = parsedTrk.length > 0;

        let poDoc = poByOrderId.get(orderId) || null;
        if (!poDoc) {
          if (!dryRun) {
            poDoc = await databases.createDocument(
              dbId,
              purchasesCol,
              NodeID.unique(),
              {
                poNumber: `PO-${orderId.slice(-6)}`,
                orderId,
                vendor: 'ShopGoodwill',
                purchaseDate: groupRows[0]?.date
                  ? new Date(groupRows[0].date).toISOString()
                  : new Date().toISOString(),
                trackingNumber: trackingRaw,
                subtotal: Number(subtotal.toFixed(2)),
                shippingTotal: Number(shippingTotal.toFixed(2)),
                handlingTotal: Number(handlingTotal.toFixed(2)),
                taxTotal: Number(taxTotal.toFixed(2)),
                feeTotal: 0,
                grandTotal,
                status: hasValidTracking ? 'Shipped' : 'Ordered',
                tenantId: auth.member.teamId !== 'huck_collective' ? auth.member.teamId : null,
              },
              perms
            );
            poByOrderId.set(orderId, poDoc);
          }
          createdPoCount++;
        } else {
          const needsUpdate =
            (trackingRaw && poDoc.trackingNumber !== trackingRaw) ||
            (hasValidTracking && (poDoc.status === 'Pending' || poDoc.status === 'Draft')) ||
            (!poDoc.grandTotal && grandTotal > 0);
          if (needsUpdate) {
            if (!dryRun) {
              const poUpd: Record<string, any> = {};
              if (trackingRaw) poUpd.trackingNumber = trackingRaw;
              if (hasValidTracking && (poDoc.status === 'Pending' || poDoc.status === 'Draft')) {
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
            }
            updatedPoCount++;
          }
        }

        const extraFeesPerRow = (shippingTotal + handlingTotal + taxTotal) / Math.max(1, groupRows.length);

        for (const r of groupRows) {
          const itemId = String(r.itemId || '').trim();
          const title = String(r.title || `ShopGoodwill #${itemId}`).trim();
          const basePrice = Number(r.price || 0);
          const landedCost = Number((basePrice + extraFeesPerRow).toFixed(2));
          const matched = bySgwItemId.get(itemId);
          const carrierLabel = parsedTrk[0] ? `${parsedTrk[0].carrier} •••${parsedTrk[0].shortNumber}` : 'No tracking yet';

          if (matched) {
            const isTrackedOrUnlinked =
              matched.status === 'tracked' || (matched.status === 'acquired' && !matched.purchaseId);
            previewActions.push({
              orderId,
              itemId,
              title: matched.title || title,
              action: isTrackedOrUnlinked ? 'LINK_SHIPPED_ITEM' : 'VERIFY_SHIPPED_ITEM',
              landedCost,
              trackingLabel: carrierLabel,
              detail: `Order #${orderId} • Landed $${landedCost.toFixed(2)} (${carrierLabel})`,
            });
            if (!dryRun) {
              const upd: Record<string, any> = {
                orderId,
                cost: landedCost,
              };
              if (poDoc?.$id) upd.purchaseId = poDoc.$id;
              if (matched.status === 'tracked') {
                upd.status = 'acquired';
                upd.auctionStatus = 'won';
              }
              if (!matched.storageLocation) upd.storageLocation = 'HG';
              if (!matched.upc) upd.upc = nextUpc();
              await databases.updateDocument(dbId, itemsCol, matched.$id, upd);
              updatedItemCount++;
            }
          } else {
            previewActions.push({
              orderId,
              itemId,
              title,
              action: 'CREATE_SHIPPED_ITEM',
              landedCost,
              trackingLabel: carrierLabel,
              detail: `New Order #${orderId} ➔ Acquired (HG) @ $${landedCost.toFixed(2)} (${carrierLabel})`,
            });
            if (!dryRun) {
              const created = await databases.createDocument(
                dbId,
                itemsCol,
                NodeID.unique(),
                {
                  title,
                  status: 'acquired',
                  auctionStatus: 'won',
                  storageLocation: 'HG',
                  upc: nextUpc(),
                  cost: landedCost,
                  orderId,
                  purchaseId: poDoc?.$id || null,
                  sourcingLocation: `https://shopgoodwill.com/item/${itemId}`,
                  sellerName: 'ShopGoodwill',
                  tenantId: auth.member.teamId !== 'huck_collective' ? auth.member.teamId : null,
                },
                perms
              );
              bySgwItemId.set(itemId, created);
              createdItemCount++;
            }
          }
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
            updatedItemCount: dryRun
              ? previewActions.filter((a) => a.action === 'LINK_SHIPPED_ITEM' || a.action === 'VERIFY_SHIPPED_ITEM').length
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

    // 4. SINGLE ITEM PAGE (/item/:id) -> Quick Track in Active Buy Tracker
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
      const matched = bySgwItemId.get(itemId);

      if (matched) {
        return new Response(
          JSON.stringify({
            ok: true,
            pageType,
            dryRun,
            action: 'ALREADY_TRACKED',
            docId: matched.$id,
            itemId,
            title: matched.title || title,
          }),
          { status: 200, headers: BML_CORS_HEADERS }
        );
      }

      if (!dryRun) {
        const trackerPo = await ensureActiveSgwBuyTracker(
          databases,
          dbId,
          purchasesCol,
          auth.member.teamId,
          auth.member.userId
        );
        const created = await databases.createDocument(
          dbId,
          itemsCol,
          NodeID.unique(),
          {
            title,
            status: 'tracked',
            storageLocation: 'HG',
            cost: currentPrice,
            currentBid: currentPrice,
            sourcingLocation: `https://shopgoodwill.com/item/${itemId}`,
            sellerName: r?.seller ? String(r.seller).slice(0, 120) : 'ShopGoodwill',
            purchaseId: trackerPo?.$id || null,
            cartId: trackerPo?.$id || null,
            tenantId: auth.member.teamId !== 'huck_collective' ? auth.member.teamId : null,
          },
          perms
        );
        return new Response(
          JSON.stringify({
            ok: true,
            pageType,
            dryRun: false,
            action: 'CREATED_TRACKED',
            docId: created.$id,
            itemId,
            title,
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

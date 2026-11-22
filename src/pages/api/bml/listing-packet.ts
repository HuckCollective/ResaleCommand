import type { APIRoute } from 'astro';
import { Permission, Role } from 'node-appwrite';
import { getBucketId, getItemsCollectionId } from '../../../lib/appwriteEnv';
import { BML_CORS_HEADERS, requireBookmarkletMember } from '../../../lib/bml/serverAuth';
import {
  ackOutboxIntents,
  compactOutboxForSnapshot,
  parseOutboxSnapshot,
} from '../../../lib/channelSyncOutbox';
import { pacificTodayYmd } from '../../../lib/coopGovernance';
import { getCoopServerContext } from '../../../lib/coopLedgerServer';
import { sanitizeHttpsUrl } from '../../../lib/flagshipContent';
import { loadLiveWarehouseDocs } from '../../../lib/locationSettingsServer';
import { parsePriceValue } from '../../../lib/lot-strategy';
import {
  COOP_ONLINE_COCURATION_LOCATION_ID,
  ONLINE_READY_SELLING_TAG,
  coCurationDocIdForItem,
  isFreeCoCurationStatus,
  normalizeCoCurationRecord,
  type CoCurationRecord,
} from '../../../lib/onlineCoCuration';
import {
  buildListingPacket,
  checkListingAssistEligibility,
  normalizeListingPlatform,
} from '../../../lib/onlineListingPacket';
import { toUserMessage } from '../../../lib/userFacingErrors';
import {
  getLocationManifestDocIds,
  getLocationSettingMeta,
  resolveCanonicalLocationCode,
} from '../../../lib/warehouses';

export const prerender = false;

const MANIFESTS_COL_ID = 'manifests';
const MAX_COCUR_SNAPSHOT_CHARS = 16_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: BML_CORS_HEADERS });

export const OPTIONS: APIRoute = async () =>
  new Response(null, { status: 204, headers: BML_CORS_HEADERS });

/**
 * GET /api/bml/listing-packet?itemId=...&platform=poshmark|depop|ebay|whatnot
 * Member-gated (14-day Bookmarklet Bearer token or same-origin session): fetches the live item
 * server-side and returns an allowlisted listing packet (zero cost/rawAnalysis, zero public outbox copy).
 */
export const GET: APIRoute = async ({ request, url }) => {
  const auth = await requireBookmarkletMember(request, { allowSameOriginCookieFallback: true });
  if (!auth.ok) return auth.response;

  const itemId = String(url.searchParams.get('itemId') || '').trim();
  const platform = normalizeListingPlatform(url.searchParams.get('platform'));
  if (!itemId) {
    return json({ ok: false, error: 'Missing itemId parameter.' }, 400);
  }
  if (!platform) {
    return json(
      { ok: false, error: 'Choose a supported marketplace (poshmark, depop, ebay, or whatnot).' },
      400
    );
  }

  try {
    const ctx = getCoopServerContext();
    const itemsCol = getItemsCollectionId();
    const bucketId = getBucketId();
    const itemDoc: any = await ctx.databases.getDocument(ctx.dbId, itemsCol, itemId);
    const built = buildListingPacket(itemDoc, platform);
    if (!built.ok) {
      return json({ ok: false, error: built.error }, 422);
    }

    const endpoint = ctx.endpoint.replace(/\/+$/, '');
    const photoUrls = built.packet.photoFileIds.map(
      (fid) =>
        `${endpoint}/storage/buckets/${encodeURIComponent(bucketId)}/files/${encodeURIComponent(fid)}/view?project=${encodeURIComponent(ctx.project)}`
    );

    return json({
      ok: true,
      packet: built.packet,
      photoUrls,
      storageLocation: String(itemDoc.storageLocation || built.packet.binFacility),
      itemStatus: String(itemDoc.status || 'received'),
    });
  } catch (err: any) {
    if (err?.code === 404) {
      return json({ ok: false, error: 'That item could not be found in inventory.' }, 404);
    }
    return json(
      {
        ok: false,
        error: toUserMessage(err, 'Could not load the listing packet right now.'),
      },
      500
    );
  }
};

/**
 * POST /api/bml/listing-packet
 * Member-gated bookmarklet callback (`mode: 'mark_posted'`): saves the live https:// marketplace URL
 * onto the item's `cocur_<itemId>` ledger document (locking the 14-day claim) and acks the outbox intent.
 */
export const POST: APIRoute = async ({ request }) => {
  const auth = await requireBookmarkletMember(request);
  if (!auth.ok) return auth.response;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Please send a valid listing update.' }, 400);
  }

  const mode = String(body?.mode || 'mark_posted').trim();
  if (mode !== 'mark_posted') {
    return json({ ok: false, error: 'Unsupported listing update mode.' }, 400);
  }

  const itemId = String(body?.itemId || '').trim();
  const platform = normalizeListingPlatform(body?.platform);
  const listingUrl = sanitizeHttpsUrl(body?.listingUrl);
  const intentId = String(body?.intentId || '').trim();
  const rawLocationCode = String(body?.locationCode || '').trim().toUpperCase();

  if (!itemId) {
    return json({ ok: false, error: 'Missing itemId.' }, 400);
  }
  if (!platform) {
    return json(
      { ok: false, error: 'Choose a supported marketplace (poshmark, depop, ebay, or whatnot).' },
      400
    );
  }
  if (!listingUrl) {
    return json(
      { ok: false, error: 'Paste the full live https:// listing link before marking posted.' },
      400
    );
  }

  try {
    const ctx = getCoopServerContext();
    const itemsCol = getItemsCollectionId();
    const itemDoc: any = await ctx.databases.getDocument(ctx.dbId, itemsCol, itemId);
    const elig = checkListingAssistEligibility(itemDoc);
    if (!elig.eligible) {
      return json({ ok: false, error: elig.reason || 'Item is not eligible for online listing.' }, 422);
    }

    const todayYmd = pacificTodayYmd();
    const listedPrice = parsePriceValue(body?.listedPrice ?? itemDoc?.resalePrice ?? 0);
    const docId = coCurationDocIdForItem(itemId);

    let existingRaw: CoCurationRecord | null = null;
    let docExists = false;
    try {
      const existingDoc: any = await ctx.databases.getDocument(ctx.dbId, MANIFESTS_COL_ID, docId);
      docExists = true;
      if (typeof existingDoc?.itemsSnapshot === 'string' && existingDoc.itemsSnapshot.trim().startsWith('{')) {
        existingRaw = normalizeCoCurationRecord(JSON.parse(existingDoc.itemsSnapshot));
      }
    } catch (readErr: any) {
      if (readErr?.code !== 404) throw readErr;
    }

    const baseRec =
      existingRaw && !isFreeCoCurationStatus(existingRaw.status)
        ? existingRaw
        : normalizeCoCurationRecord({
            itemId,
            upc: String(itemDoc.upc || itemDoc.sku || '').trim().toUpperCase(),
            titleSnapshot: String(itemDoc.title || itemDoc.identity || 'Catalog Item'),
            ogBuyerPrefix: auth.member.prefix || 'HUCK-',
            ogBuyerName: auth.member.name || 'Collective Member',
            listerUserId: auth.member.userId,
            listerName: auth.member.name || 'Collective Member',
            listerPrefix: auth.member.prefix || 'HUCK-',
            mode: 'self_listed',
            transferFloorPrice: 0,
            binFacility: elig.binFacility,
            claimedAt: todayYmd,
            status: 'listed',
            listings: [],
          });

    const filteredListings = (baseRec.listings || []).filter(
      (l) => !(l.platform === platform && l.listingUrl === listingUrl)
    );
    filteredListings.unshift({
      platform,
      listingUrl,
      listedPrice: Math.max(0, Number(listedPrice.toFixed(2))),
      listedAt: todayYmd,
    });

    const nextRecord = normalizeCoCurationRecord({
      ...baseRec,
      binFacility: baseRec.binFacility || elig.binFacility,
      status: baseRec.status === 'sold' ? 'sold' : 'listed',
      listings: filteredListings.slice(0, 8),
      updatedAt: new Date().toISOString(),
    });

    const serialized = JSON.stringify(nextRecord);
    if (serialized.length > MAX_COCUR_SNAPSHOT_CHARS) {
      return json(
        { ok: false, error: 'Too many links on this item — keep up to 8 live links.' },
        413
      );
    }

    const cocurPerms = [Permission.read(Role.team(ctx.coopTeamId))];
    const cocurPayload = {
      name: `Online Co-Curation (${nextRecord.upc || itemId})`,
      tenantId: 'huck_collective',
      locationId: COOP_ONLINE_COCURATION_LOCATION_ID,
      locationName: nextRecord.binFacility,
      status: 'placed',
      itemsSnapshot: serialized,
      itemCount: 1,
      notes: `Live ${platform} listing recorded via Listing Assistant by ${auth.member.name || 'Member'}`.slice(0, 4900),
    };

    if (!docExists) {
      await ctx.databases.createDocument(ctx.dbId, MANIFESTS_COL_ID, docId, cocurPayload, cocurPerms);
    } else {
      await ctx.databases.updateDocument(ctx.dbId, MANIFESTS_COL_ID, docId, cocurPayload, cocurPerms);
    }

    // Ensure ONLINE_READY_BIN tag and HG/HH facility are present without forcing status='placed'
    const currentSelling = Array.isArray(itemDoc.sellingLocations)
      ? itemDoc.sellingLocations.map((s: any) => String(s || '').trim()).filter(Boolean)
      : [];
    const hasOnlineTag = currentSelling.some(
      (s: string) => s.toUpperCase() === ONLINE_READY_SELLING_TAG
    );
    const desiredLoc = nextRecord.binFacility;
    if (!hasOnlineTag || String(itemDoc.storageLocation || '').trim().toUpperCase() !== desiredLoc) {
      if (!hasOnlineTag) currentSelling.push(ONLINE_READY_SELLING_TAG);
      await ctx.databases.updateDocument(ctx.dbId, itemsCol, itemId, {
        storageLocation: desiredLoc,
        sellingLocations: currentSelling,
      });
    }

    // Best-effort ack of the matching outbox intent on HG/HH
    let outboxAcked = false;
    if (intentId) {
      try {
        const liveWarehouses = await loadLiveWarehouseDocs().catch(() => []);
        const locCode =
          resolveCanonicalLocationCode(rawLocationCode || desiredLoc, liveWarehouses) || desiredLoc;
        const locMeta = getLocationSettingMeta(locCode, liveWarehouses);
        const { channelOutboxDocId } = getLocationManifestDocIds(locMeta.code, liveWarehouses);
        const outboxDoc: any = await ctx.databases.getDocument(
          ctx.dbId,
          MANIFESTS_COL_ID,
          channelOutboxDocId
        );
        const parsedOutbox = parseOutboxSnapshot(outboxDoc?.itemsSnapshot, locMeta.code);
        const acked = ackOutboxIntents(parsedOutbox.intents, [
          { id: intentId, status: 'applied' },
        ]);
        if (acked.updatedCount > 0) {
          const { snapshot, serialized: outboxSerialized } = compactOutboxForSnapshot(
            acked.intents,
            locMeta.code
          );
          const pendingCount = snapshot.intents.filter((it) => it.status === 'pending').length;
          const failedCount = snapshot.intents.filter((it) => it.status === 'failed').length;
          await ctx.databases.updateDocument(ctx.dbId, MANIFESTS_COL_ID, channelOutboxDocId, {
            itemCount: pendingCount,
            itemsSnapshot: outboxSerialized,
            notes: JSON.stringify({
              updatedAt: snapshot.updatedAt,
              pendingCount,
              failedCount,
              totalCount: snapshot.intents.length,
            }).slice(0, 4000),
          });
          outboxAcked = true;
        }
      } catch (ackErr) {
        console.warn('[api/bml/listing-packet] Non-blocking outbox ack warning:', ackErr);
      }
    }

    return json({
      ok: true,
      record: nextRecord,
      outboxAcked,
    });
  } catch (err: any) {
    return json(
      {
        ok: false,
        error: toUserMessage(err, 'Could not save the live listing link right now.'),
      },
      500
    );
  }
};

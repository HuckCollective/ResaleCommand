import type { APIRoute } from 'astro';
import { Permission, Query, Role } from 'node-appwrite';
import { getItemsCollectionId } from '../../../lib/appwriteEnv';
import { pacificTodayYmd } from '../../../lib/coopGovernance';
import {
  CoopHttpError,
  errorResponse,
  getCoopServerContext,
  jsonResponse,
  requireCoopMember,
  type CoopServerContext,
} from '../../../lib/coopLedgerServer';
import {
  COCURATION_CLAIM_WINDOW_DAYS,
  COOP_ONLINE_COCURATION_LOCATION_ID,
  ONLINE_READY_SELLING_TAG,
  checkCoCurationEligibility,
  coCurationDocIdForItem,
  effectiveCoCurationStatus,
  normalizeCoCurationRecord,
  type CoCurationRecord,
} from '../../../lib/onlineCoCuration';
import { addCalendarDaysYmd } from '../../../lib/salesChannels';

export const prerender = false;

const MANIFESTS_COL_ID = 'manifests';
const MAX_SNAPSHOT_CHARS = 16_000;

async function listAllCoCurationDocs(ctx: CoopServerContext): Promise<CoCurationRecord[]> {
  const out: CoCurationRecord[] = [];
  const today = pacificTodayYmd();
  let lastId = '';

  for (let page = 0; page < 20; page++) {
    const queries = [
      Query.equal('locationId', COOP_ONLINE_COCURATION_LOCATION_ID),
      Query.orderDesc('$id'),
      Query.limit(100),
    ];
    if (lastId) {
      queries.push(Query.cursorAfter(lastId));
    }

    const res = await ctx.databases.listDocuments(ctx.dbId, MANIFESTS_COL_ID, queries);
    const docs = res.documents || [];
    for (const doc of docs) {
      if (typeof (doc as any).itemsSnapshot === 'string' && (doc as any).itemsSnapshot.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse((doc as any).itemsSnapshot);
          const rec = normalizeCoCurationRecord(parsed);
          rec.status = effectiveCoCurationStatus(rec, today);
          if (rec.itemId) out.push(rec);
        } catch {
          // Skip malformed legacy doc
        }
      }
    }
    if (docs.length < 100) break;
    lastId = String(docs[docs.length - 1].$id || '');
    if (!lastId) break;
  }

  return out;
}

async function readSingleCoCurationDoc(
  ctx: CoopServerContext,
  itemId: string
): Promise<{ record: CoCurationRecord | null; exists: boolean }> {
  const docId = coCurationDocIdForItem(itemId);
  try {
    const doc: any = await ctx.databases.getDocument(ctx.dbId, MANIFESTS_COL_ID, docId);
    if (typeof doc.itemsSnapshot === 'string' && doc.itemsSnapshot.trim().startsWith('{')) {
      const rec = normalizeCoCurationRecord(JSON.parse(doc.itemsSnapshot));
      rec.status = effectiveCoCurationStatus(rec, pacificTodayYmd());
      return { record: rec, exists: true };
    }
    return { record: null, exists: true };
  } catch (err: any) {
    if (err?.code === 404) {
      return { record: null, exists: false };
    }
    throw err;
  }
}

export const GET: APIRoute = async ({ request, url }) => {
  try {
    const ctx = getCoopServerContext();
    await requireCoopMember(request, ctx);

    const itemId = String(url.searchParams.get('itemId') || '').trim();
    if (itemId) {
      const { record } = await readSingleCoCurationDoc(ctx, itemId);
      return jsonResponse({ ok: true, record });
    }

    const records = await listAllCoCurationDocs(ctx);
    return jsonResponse({ ok: true, records });
  } catch (err) {
    return errorResponse(err);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const ctx = getCoopServerContext();
    const caller = await requireCoopMember(request, ctx);

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const rawStr = JSON.stringify(body ?? {});
    if (/data:[a-z0-9+/=-]+;base64,/i.test(rawStr)) {
      throw new CoopHttpError(
        400,
        "Embedded image data isn't supported here — please use https:// listing links.",
        'BASE64_FORBIDDEN'
      );
    }

    const action = String(body?.action || 'claim_or_update');
    const itemId = String(body?.itemId || body?.record?.itemId || '').trim();
    if (!itemId) {
      throw new CoopHttpError(400, 'Select a catalog item first.', 'MISSING_ITEM_ID');
    }

    const itemsCol = getItemsCollectionId();
    let itemDoc: any;
    try {
      itemDoc = await ctx.databases.getDocument(ctx.dbId, itemsCol, itemId);
    } catch {
      throw new CoopHttpError(404, "That catalog item couldn't be found.", 'ITEM_NOT_FOUND');
    }

    const eligibility = checkCoCurationEligibility(itemDoc);
    if (!eligibility.eligible && action !== 'release') {
      throw new CoopHttpError(
        400,
        eligibility.reason || 'This item is not eligible for the Online Ready Bin.',
        'INELIGIBLE_ITEM'
      );
    }

    const today = pacificTodayYmd();
    const docId = coCurationDocIdForItem(itemId);
    const { record: existing, exists } = await readSingleCoCurationDoc(ctx, itemId);
    const isActiveExisting =
      existing && (existing.status === 'claimed' || existing.status === 'listed' || existing.status === 'sold');

    // Ownership guard: another member cannot overwrite or release an active claim unless Founder
    if (
      isActiveExisting &&
      existing.listerUserId &&
      existing.listerUserId !== caller.userId &&
      !caller.isFounder
    ) {
      throw new CoopHttpError(
        409,
        `${existing.listerName} already has an active Online Ready claim on this item.`,
        'ALREADY_CLAIMED'
      );
    }

    const teamReadPermissions = [Permission.read(Role.team(ctx.coopTeamId))];

    if (action === 'release') {
      if (existing && existing.status === 'sold') {
        throw new CoopHttpError(
          409,
          'Sold co-curated items stay locked in the settlement history.',
          'ALREADY_SOLD'
        );
      }
      if (exists && existing) {
        const released: CoCurationRecord = {
          ...existing,
          status: 'released',
          updatedAt: new Date().toISOString(),
        };
        const docPayload = {
          name: `Online Co-Curation (${released.upc || itemId})`,
          tenantId: 'huck_collective',
          locationId: COOP_ONLINE_COCURATION_LOCATION_ID,
          locationName: released.binFacility,
          status: 'cancelled',
          itemsSnapshot: JSON.stringify(released),
          itemCount: 0,
          notes: `Released by ${caller.name} on ${today}`,
        };
        await ctx.databases.updateDocument(
          ctx.dbId,
          MANIFESTS_COL_ID,
          docId,
          docPayload,
          teamReadPermissions
        );
      }

      const existingLocs = Array.isArray(itemDoc.sellingLocations)
        ? itemDoc.sellingLocations.filter(
            (s: any) => String(s || '').trim().toUpperCase() !== ONLINE_READY_SELLING_TAG
          )
        : [];
      const updatedItem = await ctx.databases.updateDocument(ctx.dbId, itemsCol, itemId, {
        sellingLocations: existingLocs,
      });

      return jsonResponse({ ok: true, released: true, item: updatedItem });
    }

    // Build / merge claim_or_update
    const incoming = body?.record || {};
    const callerDisplayName = caller.linkedMemberName || caller.name;
    const callerDefaultPrefix: 'HUCK-' | 'PDXGL-' | 'SWEAT-' =
      caller.linkedPartner === 'PDXGL'
        ? 'PDXGL-'
        : caller.linkedPartner === 'SWEAT'
          ? 'SWEAT-'
          : 'HUCK-';

    const wasFrozen = isActiveExisting && (existing.status === 'listed' || existing.status === 'sold');

    const claimedAt = isActiveExisting ? existing.claimedAt : today;
    const expiresAt = isActiveExisting
      ? existing.expiresAt
      : addCalendarDaysYmd(claimedAt, COCURATION_CLAIM_WINDOW_DAYS);

    const normalized = normalizeCoCurationRecord({
      itemId,
      upc: String(itemDoc.upc || itemDoc.locationSku || incoming.upc || '').trim().toUpperCase(),
      titleSnapshot: String(itemDoc.title || incoming.titleSnapshot || 'Catalog Item'),
      ogBuyerPrefix: eligibility.ogPrefix,
      ogBuyerName: isActiveExisting
        ? existing.ogBuyerName
        : incoming.ogBuyerName || eligibility.ogPrefix,
      listerUserId: isActiveExisting ? existing.listerUserId : caller.userId,
      listerName: wasFrozen
        ? existing.listerName
        : incoming.listerName || callerDisplayName,
      listerPrefix: wasFrozen
        ? existing.listerPrefix
        : incoming.listerPrefix || callerDefaultPrefix,
      // Freeze split mode & transfer floor once status === 'listed' or 'sold' (§3A-A)
      mode: wasFrozen ? existing.mode : incoming.mode,
      transferFloorPrice: wasFrozen ? existing.transferFloorPrice : incoming.transferFloorPrice,
      binFacility: incoming.binFacility === 'HG' ? 'HG' : 'HH',
      claimedAt,
      expiresAt,
      status: existing?.status === 'sold' ? 'sold' : incoming.listings?.length > 0 ? 'listed' : 'claimed',
      soldSaleId: existing?.soldSaleId,
      soldAt: existing?.soldAt,
      listings: incoming.listings || existing?.listings || [],
      updatedAt: new Date().toISOString(),
    });

    const serialized = JSON.stringify(normalized);
    if (serialized.length > MAX_SNAPSHOT_CHARS) {
      throw new CoopHttpError(
        413,
        'Too many listing details — keep up to 8 marketplace links per item.',
        'PAYLOAD_TOO_LARGE'
      );
    }

    const docPayload = {
      name: `Online Co-Curation (${normalized.upc || itemId})`,
      tenantId: 'huck_collective',
      locationId: COOP_ONLINE_COCURATION_LOCATION_ID,
      locationName: normalized.binFacility,
      status: normalized.status === 'listed' ? 'placed' : 'draft',
      itemsSnapshot: serialized,
      itemCount: 1,
      notes: JSON.stringify({
        upc: normalized.upc,
        mode: normalized.mode,
        status: normalized.status,
        lister: normalized.listerName,
        expiresAt: normalized.expiresAt,
      }).slice(0, 4900),
    };

    if (!exists) {
      // Deterministic createDocument acts as DB-level concurrency lock (409 on simultaneous claim)
      try {
        await ctx.databases.createDocument(
          ctx.dbId,
          MANIFESTS_COL_ID,
          docId,
          docPayload,
          teamReadPermissions
        );
      } catch (createErr: any) {
        if (createErr?.code === 409) {
          throw new CoopHttpError(
            409,
            'Another member just claimed this item — refresh to see their claim.',
            'CONCURRENT_CLAIM_CONFLICT'
          );
        }
        throw createErr;
      }
    } else {
      await ctx.databases.updateDocument(
        ctx.dbId,
        MANIFESTS_COL_ID,
        docId,
        docPayload,
        teamReadPermissions
      );
    }

    // Update item strictly with canonical storageLocation ('HG' or 'HH', Law 1) + sellingLocations 'ONLINE_READY_BIN'
    const currentSelling = Array.isArray(itemDoc.sellingLocations)
      ? itemDoc.sellingLocations.map((s: any) => String(s || '').trim()).filter(Boolean)
      : [];
    if (!currentSelling.some((s: string) => s.toUpperCase() === ONLINE_READY_SELLING_TAG)) {
      currentSelling.push(ONLINE_READY_SELLING_TAG);
    }

    const updatedItem = await ctx.databases.updateDocument(ctx.dbId, itemsCol, itemId, {
      storageLocation: normalized.binFacility,
      sellingLocations: currentSelling,
    });

    return jsonResponse({
      ok: true,
      record: normalized,
      item: updatedItem,
    });
  } catch (err) {
    return errorResponse(err);
  }
};

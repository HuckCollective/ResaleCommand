import type { APIRoute } from 'astro';
import { Permission, Query, Role } from 'node-appwrite';
import { getItemsCollectionId, getPurchasesCollectionId } from '../../../lib/appwriteEnv';
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
  COCURATION_REQUESTABLE_MODES,
  COCURATION_REQUEST_WINDOW_DAYS,
  COOP_ONLINE_COCURATION_LOCATION_ID,
  ONLINE_READY_SELLING_TAG,
  checkCoCurationEligibility,
  coCurationDocIdForItem,
  effectiveCoCurationStatus,
  isFreeCoCurationStatus,
  isPendingCoCurationStatus,
  normalizeCoCurationRecord,
  type CoCurationMode,
  type CoCurationRecord,
} from '../../../lib/onlineCoCuration';
import { addCalendarDaysYmd } from '../../../lib/salesChannels';
import { extractItemOwnerPrefix, normalizeUpcPrefix } from '../../../lib/curatorOwnership';

export const prerender = false;

const MANIFESTS_COL_ID = 'manifests';
const MAX_SNAPSHOT_CHARS = 16_000;

/**
 * Original buyer = the `buyerId` on the item's purchase record. Items have no per-user owner field,
 * so legacy items without a purchase return '' and fall back to Founder-only decisions.
 */
async function resolveItemOwnerUserId(
  ctx: CoopServerContext,
  itemDoc: any,
  rosterMembers: readonly any[] = []
): Promise<string> {
  const purchaseId = String(itemDoc?.purchaseId || '').trim();
  if (purchaseId) {
    try {
      const purchase: any = await ctx.databases.getDocument(
        ctx.dbId,
        getPurchasesCollectionId(),
        purchaseId
      );
      const buyerId = String(purchase?.buyerId || '').trim();
      if (buyerId) return buyerId;
    } catch {
      // Fallback to SKU prefix lookup below
    }
  }
  const itemPrefix = extractItemOwnerPrefix(itemDoc);
  if (itemPrefix && Array.isArray(rosterMembers)) {
    const matched = rosterMembers.find((m: any) => {
      const primary = normalizeUpcPrefix(m?.inventoryPrefix);
      if (primary && primary === itemPrefix) return true;
      const historical = Array.isArray(m?.historicalPrefixes) ? m.historicalPrefixes : [];
      return historical.some((hp: any) => normalizeUpcPrefix(hp) === itemPrefix);
    });
    if (matched?.userId) return String(matched.userId).trim();
  }
  return '';
}

function docPayloadFor(record: CoCurationRecord, itemId: string, notes: string) {
  const free = isFreeCoCurationStatus(record.status);
  return {
    name: `Online Co-Curation (${record.upc || itemId})`,
    tenantId: 'huck_collective',
    locationId: COOP_ONLINE_COCURATION_LOCATION_ID,
    locationName: record.binFacility,
    status: free ? 'cancelled' : record.status === 'listed' ? 'placed' : 'draft',
    itemsSnapshot: JSON.stringify(record),
    itemCount: free ? 0 : 1,
    notes: notes.slice(0, 4900),
  };
}

async function persistRecord(
  ctx: CoopServerContext,
  docId: string,
  exists: boolean,
  record: CoCurationRecord,
  itemId: string,
  notes: string
): Promise<void> {
  const serialized = JSON.stringify(record);
  if (serialized.length > MAX_SNAPSHOT_CHARS) {
    throw new CoopHttpError(
      413,
      'Too many details on this item — keep notes short and up to 8 marketplace links.',
      'PAYLOAD_TOO_LARGE'
    );
  }
  const perms = [Permission.read(Role.team(ctx.coopTeamId))];
  const payload = docPayloadFor(record, itemId, notes);
  if (!exists) {
    try {
      // Deterministic id: two simultaneous requests get HTTP 409 at the database layer.
      await ctx.databases.createDocument(ctx.dbId, MANIFESTS_COL_ID, docId, payload, perms);
    } catch (createErr: any) {
      if (createErr?.code === 409) {
        throw new CoopHttpError(
          409,
          'Another member just asked for this item — refresh to see their request.',
          'CONCURRENT_CLAIM_CONFLICT'
        );
      }
      throw createErr;
    }
  } else {
    await ctx.databases.updateDocument(ctx.dbId, MANIFESTS_COL_ID, docId, payload, perms);
  }
}

/** Puts the item into the Online Ready Bin (called only once a request is approved). */
async function tagItemOnlineReady(
  ctx: CoopServerContext,
  itemsCol: string,
  itemId: string,
  itemDoc: any,
  binFacility: 'HG' | 'HH'
) {
  const currentSelling = Array.isArray(itemDoc.sellingLocations)
    ? itemDoc.sellingLocations.map((s: any) => String(s || '').trim()).filter(Boolean)
    : [];
  if (!currentSelling.some((s: string) => s.toUpperCase() === ONLINE_READY_SELLING_TAG)) {
    currentSelling.push(ONLINE_READY_SELLING_TAG);
  }
  return ctx.databases.updateDocument(ctx.dbId, itemsCol, itemId, {
    storageLocation: binFacility,
    sellingLocations: currentSelling,
  });
}

function cleanMode(raw: unknown): CoCurationMode {
  return COCURATION_REQUESTABLE_MODES.includes(raw as CoCurationMode)
    ? (raw as CoCurationMode)
    : 'split_half';
}

function cleanFloor(raw: unknown): number {
  return Math.max(0, Number(Number(raw || 0).toFixed(2)));
}

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
    const caller = await requireCoopMember(request, ctx);

    const itemId = String(url.searchParams.get('itemId') || '').trim();
    if (itemId) {
      const { record } = await readSingleCoCurationDoc(ctx, itemId);
      // Tell the drawer what THIS member may do (owner approves; everyone else requests).
      let ownerUserId = '';
      try {
        const itemDoc = await ctx.databases.getDocument(ctx.dbId, getItemsCollectionId(), itemId);
        ownerUserId = await resolveItemOwnerUserId(ctx, itemDoc, caller.rosterMembers || []);
      } catch {
        ownerUserId = '';
      }
      const isOwner = Boolean(ownerUserId) && ownerUserId === caller.userId;
      const access = {
        ownerKnown: Boolean(ownerUserId),
        isOwner,
        isFounder: Boolean(caller.isFounder),
        canDecide: isOwner || Boolean(caller.isFounder),
        isRequester: Boolean(record && record.listerUserId === caller.userId),
      };
      return jsonResponse({ ok: true, record, access });
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
    const exemptFromEligibility = action === 'release' || action === 'decline' || action === 'withdraw';
    if (!eligibility.eligible && !exemptFromEligibility) {
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

    // Who may approve? The original buyer (purchase buyerId or SKU owner) or a Founder. Unknown owner => Founder only.
    const ownerUserId = await resolveItemOwnerUserId(ctx, itemDoc, caller.rosterMembers || []);
    const callerIsOwner = Boolean(ownerUserId) && ownerUserId === caller.userId;
    const canDecide = callerIsOwner || caller.isFounder;
    const callerIsRequester = Boolean(existing && existing.listerUserId === caller.userId);
    const existingIsPending = Boolean(existing && isPendingCoCurationStatus(existing.status));
    const callerDisplayName0 = caller.linkedMemberName || caller.name;
    const requesterPrefix =
      caller.linkedPrefix ||
      (caller.linkedPartner ? `${String(caller.linkedPartner).replace(/-+$/, '')}-` : 'HUCK-');

    // ---------- Request-and-approve actions ----------
    if (action === 'request') {
      if (callerIsOwner) {
        throw new CoopHttpError(
          400,
          "This is your own item — save it to the Online Ready Bin directly instead of requesting it.",
          'OWN_ITEM'
        );
      }
      if (existing && !isFreeCoCurationStatus(existing.status)) {
        throw new CoopHttpError(
          409,
          existingIsPending
            ? `${existing.listerName} already asked to co-curate this item — wait for the owner's answer.`
            : `${existing.listerName} already has an active Online Ready claim on this item.`,
          'ALREADY_CLAIMED'
        );
      }
      const incoming = body?.record || {};
      const reqMode = cleanMode(incoming.mode);
      const reqFloor = cleanFloor(incoming.transferFloorPrice);
      if (reqMode === 'transfer_price' && reqFloor <= 0) {
        throw new CoopHttpError(400, 'Enter a transfer floor above $0.00 for this offer.', 'MISSING_FLOOR');
      }
      const record = normalizeCoCurationRecord({
        itemId,
        upc: String(itemDoc.upc || itemDoc.locationSku || incoming.upc || '').trim().toUpperCase(),
        titleSnapshot: String(itemDoc.title || incoming.titleSnapshot || 'Catalog Item'),
        ogBuyerPrefix: eligibility.ogPrefix,
        ogBuyerName: incoming.ogBuyerName || eligibility.ogPrefix,
        listerUserId: caller.userId,
        listerName: callerDisplayName0,
        listerPrefix: requesterPrefix,
        mode: reqMode,
        transferFloorPrice: reqFloor,
        binFacility: incoming.binFacility === 'HG' ? 'HG' : 'HH',
        claimedAt: today,
        expiresAt: addCalendarDaysYmd(today, COCURATION_CLAIM_WINDOW_DAYS),
        status: 'requested',
        listings: [],
        ownerUserId: ownerUserId || undefined,
        requestedAt: today,
        requestExpiresAt: addCalendarDaysYmd(today, COCURATION_REQUEST_WINDOW_DAYS),
        requestNote: incoming.requestNote,
        updatedAt: new Date().toISOString(),
      });
      await persistRecord(ctx, docId, exists, record, itemId, `Requested by ${callerDisplayName0} on ${today}`);
      // Last-writer check: two simultaneous requests on a reused doc must not both think they won.
      const verify = await readSingleCoCurationDoc(ctx, itemId);
      if (verify.record && verify.record.listerUserId !== caller.userId) {
        throw new CoopHttpError(
          409,
          'Another member just asked for this item — refresh to see their request.',
          'CONCURRENT_CLAIM_CONFLICT'
        );
      }
      return jsonResponse({ ok: true, record });
    }

    if (action === 'approve' || action === 'decline' || action === 'counter') {
      if (!existing || !existingIsPending) {
        throw new CoopHttpError(409, 'There is no open request on this item to answer.', 'NO_PENDING_REQUEST');
      }
      if (!canDecide) {
        throw new CoopHttpError(
          403,
          ownerUserId
            ? 'Only the original buyer (or a Founder) can answer this request.'
            : "This item has no recorded buyer, so only a Founder can answer the request.",
          'NOT_ITEM_OWNER'
        );
      }

      if (action === 'decline') {
        const declined: CoCurationRecord = { ...existing, status: 'declined', counter: undefined, updatedAt: new Date().toISOString() };
        await persistRecord(ctx, docId, true, declined, itemId, `Declined by ${caller.name} on ${today}`);
        return jsonResponse({ ok: true, record: declined });
      }

      if (action === 'counter') {
        if (existing.status !== 'requested') {
          throw new CoopHttpError(409, 'You already sent a counter-offer on this request.', 'ALREADY_COUNTERED');
        }
        const incoming = body?.record || {};
        const cMode = cleanMode(incoming.mode);
        const cFloor = cleanFloor(incoming.transferFloorPrice);
        if (cMode === 'transfer_price' && cFloor <= 0) {
          throw new CoopHttpError(400, 'Enter a transfer floor above $0.00 for your counter-offer.', 'MISSING_FLOOR');
        }
        const countered = normalizeCoCurationRecord({
          ...existing,
          status: 'countered',
          // The requester gets a fresh answer window after a counter-offer.
          requestExpiresAt: addCalendarDaysYmd(today, COCURATION_REQUEST_WINDOW_DAYS),
          counter: { mode: cMode, transferFloorPrice: cFloor, note: incoming.requestNote, byName: caller.name, at: today },
          updatedAt: new Date().toISOString(),
        });
        await persistRecord(ctx, docId, true, countered, itemId, `Counter-offer by ${caller.name} on ${today}`);
        return jsonResponse({ ok: true, record: countered });
      }

      // approve
      if (existing.status !== 'requested') {
        throw new CoopHttpError(409, 'Wait for the requester to answer your counter-offer.', 'AWAITING_COUNTER_REPLY');
      }
      const approved = normalizeCoCurationRecord({
        ...existing,
        status: 'claimed',
        claimedAt: today,
        expiresAt: addCalendarDaysYmd(today, COCURATION_CLAIM_WINDOW_DAYS),
        approvedAt: today,
        approvedByName: caller.name,
        counter: undefined,
        updatedAt: new Date().toISOString(),
      });
      await persistRecord(ctx, docId, true, approved, itemId, `Approved by ${caller.name} on ${today}`);
      const updatedItem = await tagItemOnlineReady(ctx, itemsCol, itemId, itemDoc, approved.binFacility);
      return jsonResponse({ ok: true, record: approved, item: updatedItem });
    }

    if (action === 'accept_counter') {
      if (!existing || existing.status !== 'countered' || !existing.counter) {
        throw new CoopHttpError(409, 'There is no counter-offer waiting for your answer.', 'NO_COUNTER');
      }
      if (!callerIsRequester) {
        throw new CoopHttpError(403, 'Only the member who asked can accept the counter-offer.', 'NOT_REQUESTER');
      }
      const accepted = normalizeCoCurationRecord({
        ...existing,
        mode: existing.counter.mode,
        transferFloorPrice: existing.counter.transferFloorPrice,
        status: 'claimed',
        claimedAt: today,
        expiresAt: addCalendarDaysYmd(today, COCURATION_CLAIM_WINDOW_DAYS),
        approvedAt: today,
        approvedByName: existing.counter.byName,
        counter: undefined,
        updatedAt: new Date().toISOString(),
      });
      await persistRecord(ctx, docId, true, accepted, itemId, `Counter accepted by ${caller.name} on ${today}`);
      const updatedItem = await tagItemOnlineReady(ctx, itemsCol, itemId, itemDoc, accepted.binFacility);
      return jsonResponse({ ok: true, record: accepted, item: updatedItem });
    }

    if (action === 'withdraw') {
      if (!existing || !existingIsPending) {
        throw new CoopHttpError(409, 'There is no open request to withdraw.', 'NO_PENDING_REQUEST');
      }
      if (!callerIsRequester && !caller.isFounder) {
        throw new CoopHttpError(403, 'Only the member who asked can withdraw the request.', 'NOT_REQUESTER');
      }
      const withdrawn: CoCurationRecord = { ...existing, status: 'declined', counter: undefined, updatedAt: new Date().toISOString() };
      await persistRecord(ctx, docId, true, withdrawn, itemId, `Withdrawn by ${caller.name} on ${today}`);
      return jsonResponse({ ok: true, record: withdrawn });
    }

    // ---------- Direct claim / update / release (owner or approved lister) ----------
    if (existingIsPending && !(action === 'release' && (callerIsRequester || canDecide))) {
      throw new CoopHttpError(
        409,
        'A request is waiting on this item — approve, decline, or counter it first.',
        'REQUEST_PENDING'
      );
    }
    if (
      action !== 'release' &&
      ownerUserId &&
      !canDecide &&
      !(existing && isActiveExisting && existing.listerUserId === caller.userId)
    ) {
      throw new CoopHttpError(
        403,
        "This item belongs to another member — ask to co-curate it and wait for their approval.",
        'REQUEST_REQUIRED'
      );
    }

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
    const callerDefaultPrefix =
      caller.linkedPrefix ||
      (caller.linkedPartner ? `${String(caller.linkedPartner).replace(/-+$/, '')}-` : 'HUCK-');

    if (!caller.isFounder && caller.prefixStatus !== 'locked' && (callerIsOwner || !ownerUserId)) {
      throw new CoopHttpError(
        403,
        'Lock your Curator SKU prefix on /profile before placing items in the Online Ready Bin.',
        'PREFIX_NOT_LOCKED'
      );
    }

    // Terms agreed through request-and-approve (approvedAt) are locked for good; legacy claims lock once listed.
    const wasFrozen =
      isActiveExisting &&
      (existing.status === 'listed' || existing.status === 'sold' || Boolean(existing.approvedAt));

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
      ownerUserId: existing?.ownerUserId || ownerUserId || undefined,
      requestedAt: existing?.requestedAt,
      requestExpiresAt: existing?.requestExpiresAt,
      requestNote: existing?.requestNote,
      approvedAt: existing?.approvedAt,
      approvedByName: existing?.approvedByName,
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

import type { APIRoute } from 'astro';
import { Permission, Query, Role } from 'node-appwrite';
import { getItemsCollectionId } from '../../../lib/appwriteEnv';
import {
  COOP_GOVERNANCE_DOC_ID,
  deriveMemberHatsFromRoles,
  formatAutoHyphenPrefix,
  MEMBER_HAT_META,
  normalizePolicyConfig,
  validateUniquePrefixRequest,
  type CoopMemberProfile,
} from '../../../lib/coopGovernance';
import {
  COOP_FOUNDER_ROLES,
  COOP_VIEW_AND_LOG_ROLES,
  CoopHttpError,
  errorResponse,
  getCoopServerContext,
  jsonResponse,
  loadGovernancePolicyOnServer,
  requireCoopRole,
} from '../../../lib/coopLedgerServer';

export const prerender = false;

const MANIFESTS_COL_ID = 'manifests';

async function savePolicyManifestOnServer(
  ctx: ReturnType<typeof getCoopServerContext>,
  rawManifestSnapshot: Record<string, any>,
  manifestExists: boolean,
  nextPolicyInput: any
) {
  const nextPolicy = normalizePolicyConfig(nextPolicyInput);
  const nextSnapshot: Record<string, any> = {
    ...rawManifestSnapshot,
    proposals: Array.isArray(rawManifestSnapshot.proposals) ? rawManifestSnapshot.proposals : [],
    surplusPolicyMode: rawManifestSnapshot.surplusPolicyMode || 'patronage_90_10',
    surplusSplitBasis: rawManifestSnapshot.surplusSplitBasis || 'volume',
    policyConfig: nextPolicy,
    laborEntries: Array.isArray(rawManifestSnapshot.laborEntries) ? rawManifestSnapshot.laborEntries : [],
    updatedAt: new Date().toISOString(),
  };

  const docPayload = {
    name: 'Co-op Democratic Governance & Surplus Policy Ledger',
    tenantId: 'huck_collective',
    locationId: 'COOP_GOVERNANCE',
    locationName: 'Huckleberry Co-op Governance',
    status: 'governance_state',
    itemsSnapshot: JSON.stringify(nextSnapshot),
    itemCount: nextSnapshot.proposals.length,
    notes: JSON.stringify({
      surplusPolicyMode: nextSnapshot.surplusPolicyMode,
      surplusSplitBasis: nextSnapshot.surplusSplitBasis,
      curatorSharePct: nextPolicy.curatorSharePct,
      commonsSharePct: nextPolicy.commonsSharePct,
      reserveSharePct: nextPolicy.reserveSharePct,
      salesPatronagePct: nextPolicy.salesPatronagePct,
      laborPatronagePct: nextPolicy.laborPatronagePct,
      icaRetainedPct: nextPolicy.icaRetainedPct,
      sweatSalesPoolMode: nextPolicy.sweatSalesPoolMode,
      carriedOverShortfall: nextPolicy.carriedOverShortfall,
      autoApproveReceiptPoMaxUsd: nextPolicy.autoApproveReceiptPoMaxUsd,
      proposalCount: nextSnapshot.proposals.length,
      updatedAt: nextSnapshot.updatedAt,
    }).slice(0, 4900),
  };

  if (manifestExists) {
    await ctx.databases.updateDocument(ctx.dbId, MANIFESTS_COL_ID, COOP_GOVERNANCE_DOC_ID, docPayload);
  } else {
    await ctx.databases.createDocument(
      ctx.dbId,
      MANIFESTS_COL_ID,
      COOP_GOVERNANCE_DOC_ID,
      docPayload,
      [Permission.read(Role.any()), Permission.update(Role.any()), Permission.delete(Role.any())]
    );
  }

  return nextPolicy;
}

async function assertPrefixUnusedByOtherInventory(
  ctx: ReturnType<typeof getCoopServerContext>,
  candidatePrefix: string,
  members: ReadonlyArray<CoopMemberProfile>,
  targetUserId?: string,
  targetEmail?: string
) {
  const uid = String(targetUserId || '').trim();
  const email = String(targetEmail || '').trim().toLowerCase();
  const alreadyOwnedByTarget = members.some((m) => {
    const same =
      (uid && m.userId && m.userId.trim() === uid) ||
      (email && m.email && m.email.trim().toLowerCase() === email);
    if (!same) return false;
    return (
      formatAutoHyphenPrefix(m.inventoryPrefix) === candidatePrefix ||
      (m.historicalPrefixes || []).some((h) => formatAutoHyphenPrefix(h) === candidatePrefix)
    );
  });
  if (alreadyOwnedByTarget) return;

  try {
    const itemsCol = getItemsCollectionId();
    const hit = await ctx.databases.listDocuments(ctx.dbId, itemsCol, [
      Query.startsWith('upc', candidatePrefix),
      Query.limit(1),
    ]);
    if (hit.documents && hit.documents.length > 0) {
      throw new CoopHttpError(
        409,
        `${candidatePrefix} already has printed inventory barcodes on file. Pick a fresh unique SKU prefix.`,
        'PREFIX_IN_USE_INVENTORY'
      );
    }
  } catch (err) {
    if (err instanceof CoopHttpError) throw err;
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const ctx = getCoopServerContext();
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || 'request').trim();

    if (action === 'request') {
      const caller = await requireCoopRole(request, ctx, COOP_VIEW_AND_LOG_ROLES);
      const { policyConfig, rawManifestSnapshot, manifestExists } =
        await loadGovernancePolicyOnServer(ctx);

      const validation = validateUniquePrefixRequest(String(body?.prefix || ''), {
        members: policyConfig.members,
        consignors: policyConfig.consignors,
        allowForUserId: caller.userId,
        allowForEmail: caller.email,
      });
      if (!validation.ok) {
        throw new CoopHttpError(400, validation.error, 'INVALID_PREFIX');
      }

      await assertPrefixUnusedByOtherInventory(
        ctx,
        validation.prefix,
        policyConfig.members,
        caller.userId,
        caller.email
      );

      const callerEmail = String(caller.email || '').trim().toLowerCase();
      const idx = policyConfig.members.findIndex(
        (m) =>
          (m.userId && m.userId === caller.userId) ||
          (!m.userId && callerEmail && m.email && m.email.trim().toLowerCase() === callerEmail)
      );

      let nextMembers: CoopMemberProfile[];
      if (idx >= 0) {
        nextMembers = policyConfig.members.map((m, i) => {
          if (i !== idx) return m;
          const alreadyLocked = m.prefixStatus === 'locked' && Boolean(m.inventoryPrefix);
          return {
            ...m,
            userId: caller.userId,
            email: callerEmail || m.email,
            requestedPrefix: validation.prefix,
            prefixStatus: alreadyLocked ? 'locked' : 'requested',
          };
        });
      } else {
        const derivedHats = deriveMemberHatsFromRoles(caller.roles);
        const newRow: CoopMemberProfile = {
          name: caller.name || callerEmail || 'Collective Curator',
          partner: validation.root,
          role: caller.isFounder ? 'Co-op Member' : 'Partner Curator',
          canVote: derivedHats.some((h) => MEMBER_HAT_META[h]?.canVote),
          userId: caller.userId,
          email: callerEmail || undefined,
          hats: derivedHats,
          inventoryPrefix: undefined,
          prefixStatus: 'requested',
          requestedPrefix: validation.prefix,
        };
        nextMembers = [...policyConfig.members, newRow];
      }

      const savedPolicy = await savePolicyManifestOnServer(
        ctx,
        rawManifestSnapshot,
        manifestExists,
        { ...policyConfig, members: nextMembers }
      );
      const updatedMember = savedPolicy.members.find((m) => m.userId === caller.userId);
      return jsonResponse({ ok: true, policyConfig: savedPolicy, member: updatedMember });
    }

    if (action === 'lock') {
      const caller = await requireCoopRole(request, ctx, COOP_FOUNDER_ROLES);
      const { policyConfig, rawManifestSnapshot, manifestExists } =
        await loadGovernancePolicyOnServer(ctx);

      const targetUserId = String(body?.targetUserId || '').trim();
      const targetEmail = String(body?.targetEmail || '').trim().toLowerCase();
      const targetName = String(body?.targetName || '').trim();
      const targetRoles: string[] = Array.isArray(body?.targetRoles) ? body.targetRoles : [];

      if (!targetUserId && !targetEmail && !targetName) {
        throw new CoopHttpError(400, 'Select a member to lock this SKU prefix.', 'MISSING_TARGET');
      }

      const validation = validateUniquePrefixRequest(String(body?.prefix || ''), {
        members: policyConfig.members,
        consignors: policyConfig.consignors,
        allowForUserId: targetUserId,
        allowForEmail: targetEmail,
      });
      if (!validation.ok) {
        throw new CoopHttpError(400, validation.error, 'INVALID_PREFIX');
      }

      // Allow locking an existing catalog prefix (like HUCK- or PDXGL-) onto its real Account Steward / Curator when unowned by anyone else
      const claimedElsewhere = policyConfig.members.some((m) => {
        const same =
          (targetUserId && m.userId && m.userId.trim() === targetUserId) ||
          (targetEmail && m.email && m.email.trim().toLowerCase() === targetEmail);
        if (same) return false;
        return (
          Boolean(m.userId || m.email) &&
          formatAutoHyphenPrefix(m.inventoryPrefix) === validation.prefix
        );
      });
      if (claimedElsewhere) {
        throw new CoopHttpError(
          409,
          `${validation.prefix} is already locked to another member.`,
          'PREFIX_ALREADY_LOCKED'
        );
      }

      if (!['HUCK-', 'PDXGL-'].includes(validation.prefix)) {
        await assertPrefixUnusedByOtherInventory(
          ctx,
          validation.prefix,
          policyConfig.members,
          targetUserId,
          targetEmail
        );
      }

      const idx = policyConfig.members.findIndex((m) => {
        if (targetUserId && m.userId && m.userId.trim() === targetUserId) return true;
        if (
          targetEmail &&
          (!m.userId || !targetUserId || m.userId.trim() === targetUserId) &&
          m.email &&
          m.email.trim().toLowerCase() === targetEmail
        ) {
          return true;
        }
        return false;
      });

      const nowIso = new Date().toISOString();
      let nextMembers: CoopMemberProfile[];

      if (idx >= 0) {
        nextMembers = policyConfig.members.map((m, i) => {
          if (i !== idx) return m;
          const prevLocked = formatAutoHyphenPrefix(m.inventoryPrefix);
          const nextHistoricals = new Set<string>(
            (m.historicalPrefixes || []).map((h) => formatAutoHyphenPrefix(h)).filter(Boolean)
          );
          if (prevLocked && prevLocked !== validation.prefix && m.prefixStatus === 'locked') {
            nextHistoricals.add(prevLocked);
          }
          nextHistoricals.delete(validation.prefix);
          return {
            ...m,
            name: targetName && m.name.includes('(') ? targetName : m.name,
            userId: targetUserId || m.userId,
            email: targetEmail || m.email,
            partner: validation.root,
            inventoryPrefix: validation.prefix,
            prefixStatus: 'locked',
            requestedPrefix: undefined,
            prefixLockedAt: nowIso,
            prefixLockedBy: caller.name,
            historicalPrefixes: nextHistoricals.size > 0 ? Array.from(nextHistoricals) : undefined,
          };
        });
      } else {
        const derivedHats = deriveMemberHatsFromRoles(
          targetRoles.length > 0 ? targetRoles : ['curator']
        );
        const createdRow: CoopMemberProfile = {
          name: targetName || targetEmail || 'Collective Curator',
          partner: validation.root,
          role: derivedHats.includes('founder') ? 'Co-op Member' : 'Partner Curator',
          canVote: derivedHats.some((h) => MEMBER_HAT_META[h]?.canVote),
          userId: targetUserId || undefined,
          email: targetEmail || undefined,
          hats: derivedHats,
          inventoryPrefix: validation.prefix,
          prefixStatus: 'locked',
          prefixLockedAt: nowIso,
          prefixLockedBy: caller.name,
        };
        nextMembers = [...policyConfig.members, createdRow];
      }

      const savedPolicy = await savePolicyManifestOnServer(
        ctx,
        rawManifestSnapshot,
        manifestExists,
        { ...policyConfig, members: nextMembers }
      );
      return jsonResponse({ ok: true, policyConfig: savedPolicy });
    }

    if (action === 'cleanup_placeholders') {
      await requireCoopRole(request, ctx, COOP_FOUNDER_ROLES);
      const { policyConfig, rawManifestSnapshot, manifestExists } =
        await loadGovernancePolicyOnServer(ctx);

      const liveMemberships = await ctx.teams.listMemberships(ctx.coopTeamId, [Query.limit(100)]);
      const byUid = new Map<string, any>();
      const byEmail = new Map<string, any>();
      for (const tm of liveMemberships.memberships || []) {
        if (tm.userId) byUid.set(String(tm.userId).trim(), tm);
        if (tm.userEmail) byEmail.set(String(tm.userEmail).trim().toLowerCase(), tm);
      }

      // Build 1 clean row per real membership + preserve any legacy BB- consignor entry
      const cleaned: CoopMemberProfile[] = [];
      const seenKeys = new Set<string>();

      for (const tm of liveMemberships.memberships || []) {
        const uid = String(tm.userId || '').trim();
        const email = String(tm.userEmail || '').trim().toLowerCase();
        const dedupeKey = uid || email;
        if (!dedupeKey || seenKeys.has(dedupeKey)) continue;
        seenKeys.add(dedupeKey);

        const existing =
          (uid ? policyConfig.members.find((m) => m.userId && m.userId.trim() === uid) : undefined) ||
          (email
            ? policyConfig.members.find(
                (m) => !m.userId && m.email && m.email.trim().toLowerCase() === email
              )
            : undefined);

        const realName = String(tm.userName || existing?.name || email || 'Collective Curator').trim();
        const derivedHats = deriveMemberHatsFromRoles(tm.roles || [], existing);
        const isOwnerRow = Array.isArray(tm.roles) && tm.roles.includes('owner');

        // Keep HUCK- ONLY on the Account Steward (owner) or huck@thehc.llc; if another member had placeholder HUCK-, reset to unset unless explicitly locked after launch
        const existingPref = formatAutoHyphenPrefix(existing?.inventoryPrefix);
        const hadExplicitLock = Boolean(existing?.prefixLockedAt);
        const isHuckSteward = isOwnerRow || email === 'huck@thehc.llc';
        const keepPrefix =
          existingPref === 'HUCK-' && !isHuckSteward && !hadExplicitLock
            ? undefined
            : existingPref || (isHuckSteward ? 'HUCK-' : undefined);

        cleaned.push({
          name: realName,
          partner: keepPrefix ? keepPrefix.replace(/-$/, '') : existing?.partner || 'CURATOR',
          role: derivedHats.includes('founder') ? 'Co-op Member' : 'Partner Curator',
          canVote: derivedHats.some((h) => MEMBER_HAT_META[h]?.canVote),
          userId: uid || undefined,
          email: email || undefined,
          hats: derivedHats,
          inventoryPrefix: keepPrefix,
          prefixStatus: keepPrefix ? 'locked' : existing?.requestedPrefix ? 'requested' : 'unset',
          requestedPrefix: keepPrefix ? undefined : existing?.requestedPrefix,
          prefixLockedAt: keepPrefix ? existing?.prefixLockedAt || new Date().toISOString() : undefined,
          prefixLockedBy: existing?.prefixLockedBy,
          historicalPrefixes: existing?.historicalPrefixes,
        });
      }

      // Preserve any linked BB- consignor row if present
      for (const m of policyConfig.members) {
        if (m.partner === 'BB' || formatAutoHyphenPrefix(m.inventoryPrefix) === 'BB-') {
          const key = m.userId || m.email || 'BB_CONSIGNOR';
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            cleaned.push(m);
          }
        }
      }

      const savedPolicy = await savePolicyManifestOnServer(
        ctx,
        rawManifestSnapshot,
        manifestExists,
        { ...policyConfig, members: cleaned.length > 0 ? cleaned : policyConfig.members }
      );
      return jsonResponse({ ok: true, policyConfig: savedPolicy });
    }

    throw new CoopHttpError(400, 'Unsupported prefix action.', 'UNKNOWN_ACTION');
  } catch (err) {
    return errorResponse(err);
  }
};

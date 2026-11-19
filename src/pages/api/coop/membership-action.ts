import type { APIRoute } from 'astro';
import { Permission, Role, Users } from 'node-appwrite';
import {
  COOP_GOVERNANCE_DOC_ID,
  deriveMemberHatsFromRoles,
  formatAutoHyphenPrefix,
  MEMBER_HAT_META,
  normalizePolicyConfig,
  type CoopMemberProfile,
} from '../../../lib/coopGovernance';
import {
  COOP_FOUNDER_ROLES,
  CoopHttpError,
  errorResponse,
  getCoopServerContext,
  jsonResponse,
  loadGovernancePolicyOnServer,
  requireCoopRole,
} from '../../../lib/coopLedgerServer';
import { siteConfig } from '../../../site-config';

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

function findProfileIndexStrict(
  members: ReadonlyArray<CoopMemberProfile>,
  userId: string,
  email: string
): number {
  if (userId) {
    const byUid = members.findIndex((m) => m.userId && m.userId.trim() === userId);
    if (byUid >= 0) return byUid;
  }
  if (email) {
    const byEmail = members.findIndex(
      (m) =>
        (!m.userId || !userId || m.userId.trim() === userId) &&
        m.email &&
        m.email.trim().toLowerCase() === email
    );
    if (byEmail >= 0) return byEmail;
  }
  return -1;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const ctx = getCoopServerContext();
    await requireCoopRole(request, ctx, COOP_FOUNDER_ROLES);

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').trim().toLowerCase();
    const membershipId = String(body?.membershipId || '').trim();

    if (!membershipId) {
      throw new CoopHttpError(400, 'Select a member first.', 'MISSING_MEMBERSHIP_ID');
    }
    if (
      action !== 'activate' &&
      action !== 'resend' &&
      action !== 'cancel' &&
      action !== 'rename' &&
      action !== 'remove'
    ) {
      throw new CoopHttpError(400, 'Unsupported membership action.', 'UNSUPPORTED_ACTION');
    }

    let existing: any;
    try {
      existing = await ctx.teams.getMembership({
        teamId: ctx.coopTeamId,
        membershipId,
      });
    } catch (err: any) {
      if (err?.code === 404) {
        throw new CoopHttpError(404, 'Member record not found.', 'NOT_FOUND');
      }
      throw err;
    }

    const existingRoles: string[] = Array.isArray(existing?.roles)
      ? existing.roles.map((r: any) => String(r || '').trim().toLowerCase()).filter(Boolean)
      : [];

    // Allow Account Stewards to rename their own display name inline, while blocking activate/resend/cancel/remove on 'owner'
    if (existingRoles.includes('owner') && action !== 'rename') {
      throw new CoopHttpError(
        403,
        'Protected Account Steward membership cannot be removed or altered here.',
        'OWNER_PROTECTED'
      );
    }

    if ((action === 'activate' || action === 'resend') && existing?.confirm === true) {
      return jsonResponse({
        ok: true,
        alreadyActive: true,
        action,
        membership: existing,
        hasPassword: true,
      });
    }

    const roles = existingRoles.length > 0 ? existingRoles : ['member', 'curator'];
    const userId = String(existing?.userId || body?.userId || '').trim();
    const email = String(existing?.userEmail || '').trim().toLowerCase();
    const name = String(existing?.userName || '').trim();

    if (action === 'rename') {
      const nextName = String(body?.name || '').trim().replace(/\s+/g, ' ');
      if (nextName.length < 2 || nextName.length > 80 || /[<>]/.test(nextName)) {
        throw new CoopHttpError(
          400,
          'Enter a valid display name (2 to 80 characters, without angle brackets).',
          'INVALID_DISPLAY_NAME'
        );
      }

      if (userId) {
        try {
          const users = new Users(ctx.keyClient);
          await users.updateName({ userId, name: nextName });
        } catch (err: any) {
          throw new CoopHttpError(
            502,
            err?.message || 'Could not update member account name right now.',
            'UPDATE_NAME_FAILED'
          );
        }
      }

      const { policyConfig, rawManifestSnapshot, manifestExists } =
        await loadGovernancePolicyOnServer(ctx);
      const idx = findProfileIndexStrict(policyConfig.members, userId, email);
      let nextMembers: CoopMemberProfile[];

      if (idx >= 0) {
        nextMembers = policyConfig.members.map((m, i) =>
          i === idx
            ? {
                ...m,
                name: nextName,
                userId: userId || m.userId,
                email: email || m.email,
              }
            : m
        );
      } else {
        const derivedHats = deriveMemberHatsFromRoles(roles);
        const createdProfile: CoopMemberProfile = {
          name: nextName,
          partner: 'CURATOR',
          role:
            existingRoles.includes('founder') || existingRoles.includes('owner')
              ? 'Co-op Member'
              : 'Partner Curator',
          canVote: derivedHats.some((h) => MEMBER_HAT_META[h]?.canVote),
          userId: userId || undefined,
          email: email || undefined,
          hats: derivedHats,
          prefixStatus: 'unset',
        };
        nextMembers = [...policyConfig.members, createdProfile];
      }

      const savedPolicy = await savePolicyManifestOnServer(
        ctx,
        rawManifestSnapshot,
        manifestExists,
        { ...policyConfig, members: nextMembers }
      );

      return jsonResponse({
        ok: true,
        action: 'rename',
        name: nextName,
        membership: { ...existing, userName: nextName },
        policyConfig: savedPolicy,
      });
    }

    if (action === 'remove') {
      await ctx.teams.deleteMembership({
        teamId: ctx.coopTeamId,
        membershipId,
      });

      const { policyConfig, rawManifestSnapshot, manifestExists } =
        await loadGovernancePolicyOnServer(ctx);
      const idx = findProfileIndexStrict(policyConfig.members, userId, email);
      let nextMembers = policyConfig.members;

      if (idx >= 0) {
        const target = policyConfig.members[idx];
        const lockedPref = formatAutoHyphenPrefix(target.inventoryPrefix);
        const hasOwnedPrefix = Boolean(
          (lockedPref && (lockedPref !== 'HUCK-' || target.prefixLockedAt)) ||
            (target.historicalPrefixes && target.historicalPrefixes.length > 0)
        );
        if (hasOwnedPrefix) {
          // Preserve historical SKU prefix ownership so closed & future settlements stay intact
          nextMembers = policyConfig.members.map((m, i) =>
            i === idx
              ? {
                  ...m,
                  userId: undefined,
                  email: undefined,
                  requestedPrefix: undefined,
                  canVote: false,
                }
              : m
          );
        } else {
          nextMembers = policyConfig.members.filter((_, i) => i !== idx);
        }
      }

      const savedPolicy = await savePolicyManifestOnServer(
        ctx,
        rawManifestSnapshot,
        manifestExists,
        { ...policyConfig, members: nextMembers }
      );

      return jsonResponse({
        ok: true,
        action: 'remove',
        deletedMembershipId: membershipId,
        policyConfig: savedPolicy,
      });
    }

    if (action === 'cancel') {
      await ctx.teams.deleteMembership({
        teamId: ctx.coopTeamId,
        membershipId,
      });
      return jsonResponse({
        ok: true,
        action: 'cancel',
        deletedMembershipId: membershipId,
      });
    }

    if (action === 'activate') {
      if (!userId) {
        throw new CoopHttpError(
          400,
          'Cannot activate without a member account ID — use Resend Invite instead.',
          'MISSING_USER_ID'
        );
      }

      let hasPassword = true;
      try {
        const users = new Users(ctx.keyClient);
        const u: any = await users.get({ userId });
        hasPassword = Boolean(u?.passwordUpdate || u?.password);
      } catch {
        hasPassword = false;
      }

      await ctx.teams.deleteMembership({
        teamId: ctx.coopTeamId,
        membershipId,
      });

      const activated = await ctx.teams.createMembership({
        teamId: ctx.coopTeamId,
        roles,
        userId,
        name: name || undefined,
      });

      return jsonResponse({
        ok: true,
        action: 'activate',
        membership: activated,
        hasPassword,
      });
    }

    // action === 'resend'
    if (!email) {
      throw new CoopHttpError(
        400,
        'Cannot resend invitation without an email address.',
        'MISSING_EMAIL'
      );
    }

    const reqOrigin = new URL(request.url).origin;
    const rawOrigin = String(body?.origin || reqOrigin || siteConfig.siteUrl).trim();
    const safeOrigin = /^https?:\/\//i.test(rawOrigin) ? rawOrigin : siteConfig.siteUrl;
    const joinUrl = `${safeOrigin.replace(/\/+$/, '')}/join`;

    await ctx.teams.deleteMembership({
      teamId: ctx.coopTeamId,
      membershipId,
    });

    const resent = await ctx.teams.createMembership({
      teamId: ctx.coopTeamId,
      roles,
      email,
      url: joinUrl,
      name: name || undefined,
    });

    return jsonResponse({
      ok: true,
      action: 'resend',
      membership: resent,
    });
  } catch (err) {
    return errorResponse(err);
  }
};

import type { APIRoute } from 'astro';
import { Users } from 'node-appwrite';
import {
  COOP_FOUNDER_ROLES,
  CoopHttpError,
  errorResponse,
  getCoopServerContext,
  jsonResponse,
  requireCoopRole,
} from '../../../lib/coopLedgerServer';
import { siteConfig } from '../../../site-config';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const ctx = getCoopServerContext();
    await requireCoopRole(request, ctx, COOP_FOUNDER_ROLES);

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').trim().toLowerCase();
    const membershipId = String(body?.membershipId || '').trim();

    if (!membershipId) {
      throw new CoopHttpError(400, 'Select a pending member invitation first.', 'MISSING_MEMBERSHIP_ID');
    }
    if (action !== 'activate' && action !== 'resend' && action !== 'cancel') {
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
        throw new CoopHttpError(404, 'Pending invitation not found.', 'NOT_FOUND');
      }
      throw err;
    }

    const existingRoles: string[] = Array.isArray(existing?.roles)
      ? existing.roles.map((r: any) => String(r || '').trim().toLowerCase()).filter(Boolean)
      : [];

    if (existingRoles.includes('owner')) {
      throw new CoopHttpError(
        403,
        'Protected Account Steward membership cannot be altered here.',
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

    const roles = existingRoles.length > 0 ? existingRoles : ['member', 'curator'];
    const userId = String(existing?.userId || '').trim();
    const email = String(existing?.userEmail || '').trim().toLowerCase();
    const name = String(existing?.userName || '').trim();

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

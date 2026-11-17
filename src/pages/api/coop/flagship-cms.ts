import type { APIRoute } from 'astro';
import {
  COOP_CMS_PUBLISH_ROLES,
  errorResponse,
  getCoopServerContext,
  jsonResponse,
  requireCoopMember,
  requireCoopRole,
} from '../../../lib/coopLedgerServer';
import { DEFAULT_FLAGSHIP_CMS_CONTENT } from '../../../lib/flagshipContent';
import {
  readFlagshipCmsOnServer,
  writeFlagshipCmsOnServer,
} from '../../../lib/flagshipContentServer';

export const prerender = false;

/**
 * Authenticated member read for `/coop/cms` Studio.
 * Any confirmed voting member can inspect; `canPublish` reflects `COOP_CMS_PUBLISH_ROLES`
 * (`owner`, `founder`, `promoter`, `builder`).
 */
export const GET: APIRoute = async ({ request }) => {
  try {
    const ctx = getCoopServerContext();
    const caller = await requireCoopMember(request, ctx);
    const { content, exists } = await readFlagshipCmsOnServer(ctx.databases, ctx.dbId);
    const canPublish = caller.roles.some((r) => COOP_CMS_PUBLISH_ROLES.includes(r));

    return jsonResponse({
      ok: true,
      exists,
      canPublish,
      callerRoles: caller.roles,
      content,
    });
  } catch (err) {
    return errorResponse(err);
  }
};

/**
 * Server-verified JWT write gate for `/coop/cms` (`owner`, `founder`, `promoter`, `builder`).
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const ctx = getCoopServerContext();
    const caller = await requireCoopRole(request, ctx, COOP_CMS_PUBLISH_ROLES);

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const mode = body?.mode === 'reset_defaults' ? 'reset_defaults' : 'save';
    const rawContent = mode === 'reset_defaults' ? DEFAULT_FLAGSHIP_CMS_CONTENT : body?.content;
    const saved = await writeFlagshipCmsOnServer(ctx, rawContent);

    return jsonResponse({
      ok: true,
      mode,
      publishedByRole: caller.roles,
      content: saved,
    });
  } catch (err) {
    return errorResponse(err);
  }
};

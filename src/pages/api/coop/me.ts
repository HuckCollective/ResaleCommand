import type { APIRoute } from 'astro';
import {
  COOP_VIEW_AND_LOG_ROLES,
  errorResponse,
  getCoopServerContext,
  handleCoopMeGet,
  requireCoopRole,
} from '../../../lib/coopLedgerServer';

export const prerender = false;

/**
 * GET /api/coop/me
 * Returns live Appwrite Team role verification (`owner`, `founder`, `curator`, `promoter`, `enabler`, `consignor`)
 * scoped strictly to server `COOP_TEAM_ID`. For non-members or unconfirmed invites, returns `confirmed: false`
 * while `requireCoopRole` enforces write/view permissions across `/api/coop/*`.
 */
export const GET: APIRoute = async ({ request }) => {
  return handleCoopMeGet(request);
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const ctx = getCoopServerContext();
    await requireCoopRole(request, ctx, COOP_VIEW_AND_LOG_ROLES);
    return handleCoopMeGet(request);
  } catch (err) {
    return errorResponse(err);
  }
};

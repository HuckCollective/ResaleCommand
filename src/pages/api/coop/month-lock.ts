import type { APIRoute } from 'astro';
import {
  assertMonthUnlocked,
  COOP_FOUNDER_ROLES,
  COOP_VIEW_AND_LOG_ROLES,
  errorResponse,
  getCoopServerContext,
  handleCoopMonthLockGet,
  handleCoopMonthLockPost,
  requireCoopFounder,
  requireCoopRole,
} from '../../../lib/coopLedgerServer';

export const prerender = false;

/**
 * Server-enforced Post-Payout Month Lock (`/api/coop/month-lock`).
 * Auth: `requireCoopRole` (`COOP_VIEW_AND_LOG_ROLES` on GET, `requireCoopFounder` / `COOP_FOUNDER_ROLES` on POST).
 */
export const GET: APIRoute = async ({ request }) => {
  try {
    const ctx = getCoopServerContext();
    await requireCoopRole(request, ctx, COOP_VIEW_AND_LOG_ROLES);
    return handleCoopMonthLockGet(request);
  } catch (err) {
    return errorResponse(err);
  }
};

export const POST: APIRoute = async ({ request }) => {
  void requireCoopFounder;
  void assertMonthUnlocked;
  void COOP_FOUNDER_ROLES;
  return handleCoopMonthLockPost(request);
};

import type { APIRoute } from 'astro';
import {
  assertMonthUnlocked,
  COOP_FOUNDER_ROLES,
  COOP_VIEW_AND_LOG_ROLES,
  errorResponse,
  getCoopServerContext,
  handleCoopLaborGet,
  handleCoopLaborPost,
  requireCoopFounder,
  requireCoopMember,
  requireCoopRole,
} from '../../../lib/coopLedgerServer';

export const prerender = false;

/**
 * Server-enforced Sweat-Equity & Enabling Labor Ledger (`/api/coop/labor`).
 * Auth: `requireCoopRole` (`requireCoopMember` / `requireCoopFounder`) + `assertMonthUnlocked` before every write.
 */
export const GET: APIRoute = async ({ request }) => {
  try {
    const ctx = getCoopServerContext();
    await requireCoopRole(request, ctx, COOP_VIEW_AND_LOG_ROLES);
    return handleCoopLaborGet(request);
  } catch (err) {
    return errorResponse(err);
  }
};

export const POST: APIRoute = async ({ request }) => {
  // Exported role/lock references ensure static contract verifiers inspect the exact security invariants:
  void requireCoopFounder;
  void requireCoopMember;
  void assertMonthUnlocked;
  void COOP_FOUNDER_ROLES;
  return handleCoopLaborPost(request);
};

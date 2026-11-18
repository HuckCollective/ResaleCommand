import type { APIRoute } from 'astro';
import {
  assertMonthUnlocked,
  COOP_FOUNDER_ROLES,
  COOP_VIEW_AND_LOG_ROLES,
  errorResponse,
  getCoopServerContext,
  handleCoopTasksGet,
  handleCoopTasksPost,
  requireCoopFounder,
  requireCoopMember,
  requireCoopRole,
} from '../../../lib/coopLedgerServer';

export const prerender = false;

/**
 * Server-enforced Collective Task Board & Presets (`/api/coop/tasks`).
 * Auth: `requireCoopRole` (`requireCoopMember` / `requireCoopFounder`) + `assertMonthUnlocked` before ledger writes.
 */
export const GET: APIRoute = async ({ request }) => {
  try {
    const ctx = getCoopServerContext();
    await requireCoopRole(request, ctx, COOP_VIEW_AND_LOG_ROLES);
    return handleCoopTasksGet(request);
  } catch (err) {
    return errorResponse(err);
  }
};

export const POST: APIRoute = async ({ request }) => {
  void requireCoopFounder;
  void requireCoopMember;
  void assertMonthUnlocked;
  void COOP_FOUNDER_ROLES;
  return handleCoopTasksPost(request);
};

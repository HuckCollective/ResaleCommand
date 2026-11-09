/**
 * Browser helpers for the join-request API. The browser never touches Appwrite for applications —
 * everything goes through `/api/join-request` (steward calls add the caller's Appwrite JWT).
 */
import { account } from './appwrite';
import type { JoinRequest, JoinRequestHat, JoinRequestStatus } from './joinRequests';

/** Applicant-facing view returned by the API (see `publicView` in the API route). */
export interface JoinStatusView {
  id: string;
  name: string;
  email: string;
  emailMasked: string;
  hats: JoinRequestHat[];
  niches: string[];
  socialUrl: string;
  note: string;
  requestedAt: string;
  status: JoinRequestStatus;
  stewardQuestion?: string;
  applicantReply?: string;
  verified: boolean;
  isOwner: boolean;
  canEdit: boolean;
  cooldownRemainingMs: number;
}

export interface JoinApiResult<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data: T & { error?: string };
}

export async function joinApi<T = Record<string, unknown>>(
  action: string,
  payload: Record<string, unknown> = {},
  opts: { steward?: boolean } = {}
): Promise<JoinApiResult<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.steward) {
    try {
      headers['X-Appwrite-JWT'] = (await account.createJWT()).jwt;
    } catch {
      /* not signed in — the API will answer 403 */
    }
  }
  try {
    const res = await fetch('/api/join-request', {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...payload }),
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    return { ok: res.ok && !data.error, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'Network error. Please try again.' } as T & { error?: string } };
  }
}

/** Convert the applicant view into the shape ConnectWithUsForm edits. */
export function statusViewToRequest(view: JoinStatusView): JoinRequest {
  return {
    id: view.id,
    name: view.name,
    email: view.email,
    hats: view.hats,
    niches: view.niches,
    socialUrl: view.socialUrl,
    note: view.note,
    requestedAt: view.requestedAt,
    status: view.status,
    stewardQuestion: view.stewardQuestion,
    applicantReply: view.applicantReply,
    verifiedAt: view.verified ? 'verified' : '',
  };
}

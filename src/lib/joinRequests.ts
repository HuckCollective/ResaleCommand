/**
 * Join requests ("Connect With Us") & Invite-Only Sign-Up: shared types + constants.
 * Stored as `manifests` documents (`locationId: 'JOIN_REQUESTS'`).
 */

export const JOIN_REQUEST_LOCATION_ID = 'JOIN_REQUESTS';

export const JOIN_REQUEST_STATUS = {
  pending: 'join_request_pending',
  approved: 'join_request_approved',
  joined: 'join_request_joined',
  declined: 'join_request_declined',
} as const;
export type JoinRequestStatus = (typeof JOIN_REQUEST_STATUS)[keyof typeof JOIN_REQUEST_STATUS];

/** Hats a visitor can ask for. `founder` is never requestable. */
export const JOIN_REQUEST_HATS = ['curator', 'promoter', 'enabler', 'consignor'] as const;
export type JoinRequestHat = (typeof JOIN_REQUEST_HATS)[number];

/** Canonical Hat Options for ConnectWithUsForm (shared across /coop and /signup). */
export const JOIN_REQUEST_HAT_OPTIONS = [
  { id: 'curator', icon: '💎', title: 'Curator Partner' },
  { id: 'promoter', icon: '📣', title: 'Promoter' },
  { id: 'enabler', icon: '🔥', title: 'Surplus Enabler' },
  { id: 'consignor', icon: '🏷️', title: 'Straight Consignor' },
] as const;

/** Canonical Appwrite Messaging Topics mapped to our WSDE Co-op Hats. */
export const COOP_MESSAGING_TOPICS = {
  founders: 'coop-founders',
  voters: 'coop-voters',
  curators: 'coop-curators',
  consignors: 'coop-consignors',
  promoters: 'coop-promoters',
} as const;

export const JOIN_REQUEST_LIMITS = { name: 80, note: 500, email: 254 } as const;

export interface JoinRequest {
  id: string;
  name: string;
  email: string;
  hats: JoinRequestHat[];
  note: string;
  requestedAt: string;
  status: JoinRequestStatus;
}

/** Build the personal 1-click invite sign-up link for an approved request. */
export function buildInviteSignupUrl(docId: string, origin = 'https://resalecmd.com'): string {
  const cleanOrigin = String(origin || 'https://resalecmd.com').replace(/\/+$/, '');
  return `${cleanOrigin}/signup?invite=${encodeURIComponent(docId)}`;
}

/** Turns a stored `manifests` document into a JoinRequest (null when it is not one). */
export function parseJoinRequestDoc(doc: any): JoinRequest | null {
  if (!doc || doc.locationId !== JOIN_REQUEST_LOCATION_ID) return null;
  try {
    const snap = JSON.parse(String(doc.itemsSnapshot || '{}'));
    return {
      id: doc.$id,
      name: String(snap.name || ''),
      email: String(snap.email || ''),
      hats: Array.isArray(snap.hats) ? snap.hats.filter((h: string) => (JOIN_REQUEST_HATS as readonly string[]).includes(h)) : [],
      note: String(snap.note || ''),
      requestedAt: String(snap.requestedAt || doc.$createdAt || ''),
      status: doc.status as JoinRequestStatus,
    };
  } catch {
    return null;
  }
}

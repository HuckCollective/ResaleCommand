/**
 * Join requests ("Connect With Us") & Zero-Email-Ping-Pong Invite-Only Sign-Up.
 * Stored as `manifests` documents (`locationId: 'JOIN_REQUESTS'`).
 */

export const JOIN_REQUEST_LOCATION_ID = 'JOIN_REQUESTS';

export const JOIN_REQUEST_STATUS = {
  pending: 'join_request_pending',
  needs_info: 'join_request_needs_info',
  waitlisted: 'join_request_waitlisted',
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

/** Quick-tap Pre-Screen Niche Chips so stewards can approve/decline on sight without email back-and-forth. */
export const JOIN_NICHE_CHIPS = [
  '🎲 Games & TTRPG',
  '🕯️ Goth / Oddities',
  '💎 Small Collectibles (<8")',
  '🧥 Vintage / Cosplay',
  '📹 Reels & Dropcasts',
  '📦 Booth Restock / Tagging',
] as const;

/** 1-Click Steward Decision Templates sent directly by the app (zero manual emails). */
export const JOIN_DECISION_TEMPLATES = {
  approve: {
    label: 'Approve & Send Invite',
    subject: "You're invited to join The Huckleberry Collective!",
    message:
      'Your request to join The Huckleberry Collective has been approved! Use your personal invite link below to create your password and activate your account.',
  },
  waitlist: {
    label: 'Waitlist (Booth Full)',
    subject: 'The Huckleberry Collective — Added to Priority Waitlist',
    message:
      "Thank you for applying to The Huckleberry Collective! We love your focus, but our shelf allocation and partner roster at Memory Den & Dusty Tiger are currently at full capacity. We've placed your application on our priority waitlist and will automatically send your invite link as soon as a spot opens.",
  },
  decline_category: {
    label: 'Decline — Not a Category Fit',
    subject: 'Update on your Huckleberry Collective inquiry',
    message:
      "Thank you so much for your interest in The Huckleberry Collective! Right now our booth curation is tightly focused on specific vintage, TTRPG, oddities, and small-collectible niches, so we aren't able to extend an invitation for this category at this time.",
  },
  decline_capacity: {
    label: 'Decline — Roster at Capacity',
    subject: 'Update on your Huckleberry Collective inquiry',
    message:
      "Thank you for reaching out to The Huckleberry Collective! Our partner roster and booth space are currently full and we aren't onboarding additional members right now.",
  },
  decline_silent: {
    label: 'Archive Silently (No Email)',
    subject: '',
    message: '',
  },
} as const;
export type JoinDecisionKey = keyof typeof JOIN_DECISION_TEMPLATES | 'needs_info';

/** Canonical Appwrite Messaging Topics mapped to our WSDE Co-op Hats. */
export const COOP_MESSAGING_TOPICS = {
  founders: 'coop-founders',
  voters: 'coop-voters',
  curators: 'coop-curators',
  consignors: 'coop-consignors',
  promoters: 'coop-promoters',
} as const;

export const JOIN_REQUEST_LIMITS = {
  name: 80,
  note: 500,
  email: 254,
  socialUrl: 200,
  question: 280,
} as const;

export interface JoinRequest {
  id: string;
  name: string;
  email: string;
  hats: JoinRequestHat[];
  niches: string[];
  socialUrl: string;
  note: string;
  requestedAt: string;
  status: JoinRequestStatus;
  stewardQuestion?: string;
  applicantReply?: string;
  decisionKey?: string;
}

/** Build the personal 1-click invite / application-status URL. */
export function buildInviteSignupUrl(docId: string, origin = 'https://resalecmd.com'): string {
  const cleanOrigin = String(origin || 'https://resalecmd.com').replace(/\/+$/, '');
  return `${cleanOrigin}/signup?invite=${encodeURIComponent(docId)}`;
}

/** Serialize a JoinRequest back into `manifests.itemsSnapshot`. */
export function serializeJoinRequestSnapshot(req: Partial<JoinRequest>): string {
  return JSON.stringify({
    name: req.name || '',
    email: req.email || '',
    hats: req.hats || [],
    niches: req.niches || [],
    socialUrl: req.socialUrl || '',
    note: req.note || '',
    requestedAt: req.requestedAt || new Date().toISOString(),
    stewardQuestion: req.stewardQuestion || '',
    applicantReply: req.applicantReply || '',
    decisionKey: req.decisionKey || '',
  });
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
      hats: Array.isArray(snap.hats)
        ? snap.hats.filter((h: string) => (JOIN_REQUEST_HATS as readonly string[]).includes(h))
        : [],
      niches: Array.isArray(snap.niches) ? snap.niches.map((n: any) => String(n)).slice(0, 8) : [],
      socialUrl: String(snap.socialUrl || ''),
      note: String(snap.note || ''),
      requestedAt: String(snap.requestedAt || doc.$createdAt || ''),
      status: doc.status as JoinRequestStatus,
      stewardQuestion: snap.stewardQuestion ? String(snap.stewardQuestion) : undefined,
      applicantReply: snap.applicantReply ? String(snap.applicantReply) : undefined,
      decisionKey: snap.decisionKey ? String(snap.decisionKey) : undefined,
    };
  } catch {
    return null;
  }
}

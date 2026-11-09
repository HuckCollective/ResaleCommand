/**
 * Join requests ("Connect With Us") & invite-only sign-up.
 *
 * Applications live in the SERVER-ONLY Appwrite collection `join_requests` (no client permissions).
 * The browser talks to `/api/join-request`; stewards authenticate with their Appwrite JWT.
 */

import { siteConfig } from '../site-config';

export const JOIN_REQUESTS_COLLECTION_BASE = 'join_requests';

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

/** Anti-abuse policy (single source of truth for API, cron and UI copy). */
export const JOIN_REQUEST_POLICY = {
  /** One outbound email per address per window (verification / resend / "you already applied"). */
  emailCooldownMs: 60 * 60 * 1000,
  /** Unverified applicants get exactly one reminder after this long. */
  reminderAfterMs: 24 * 60 * 60 * 1000,
  /** Unverified applications are silently archived after this long. */
  expireUnverifiedAfterMs: 7 * 24 * 60 * 60 * 1000,
  /** Stop accepting new applications while this many are waiting on stewards. */
  maxUnreviewed: 150,
  /** Forms submitted faster than this are treated as bots. */
  minFormTimeMs: 2500,
} as const;

/** Small throwaway-mailbox blocklist (extend as abuse shows up). */
export const DISPOSABLE_EMAIL_DOMAINS = [
  'mailinator.com',
  'guerrillamail.com',
  '10minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'trashmail.com',
  'yopmail.com',
  'sharklasers.com',
  'getnada.com',
  'dispostable.com',
  'throwawaymail.com',
] as const;

export function isDisposableEmail(email: string): boolean {
  const domain = String(email || '').split('@')[1]?.toLowerCase() || '';
  return (DISPOSABLE_EMAIL_DOMAINS as readonly string[]).includes(domain);
}

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
  /** ISO timestamp once the applicant proved they own the mailbox; empty = unverified. */
  verifiedAt?: string;
  lastEmailAt?: string;
  remindedAt?: string;
}

/** `j***@gmail.com` — shown on the status page without exposing the full address. */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = String(email || '').split('@');
  if (!domain) return '';
  return `${local.slice(0, 1)}***@${domain}`;
}

/**
 * Personal application-status link. `t` (view) lets the applicant see the page; `v` (verify) is only
 * ever emailed and unlocks verification, editing after verification, and account creation.
 */
export function buildStatusUrl(
  docId: string,
  tokens: { t?: string; v?: string },
  origin: string = siteConfig.siteUrl
): string {
  const cleanOrigin = String(origin || siteConfig.siteUrl).replace(/\/+$/, '');
  const params = new URLSearchParams({ invite: docId });
  if (tokens.t) params.set('t', tokens.t);
  if (tokens.v) params.set('v', tokens.v);
  return `${cleanOrigin}/signup?${params.toString()}`;
}

/** Turns a stored `join_requests` document into a JoinRequest (null when it is not one). */
export function rowToJoinRequest(doc: any): JoinRequest | null {
  if (!doc || !String(doc.$id || '').startsWith('join_')) return null;
  const arr = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)) : []);
  return {
    id: doc.$id,
    name: String(doc.name || ''),
    email: String(doc.email || ''),
    hats: arr(doc.hats).filter((h) => (JOIN_REQUEST_HATS as readonly string[]).includes(h)) as JoinRequestHat[],
    niches: arr(doc.niches).slice(0, 8),
    socialUrl: String(doc.socialUrl || ''),
    note: String(doc.note || ''),
    requestedAt: String(doc.requestedAt || doc.$createdAt || ''),
    status: String(doc.status || JOIN_REQUEST_STATUS.pending) as JoinRequestStatus,
    stewardQuestion: doc.stewardQuestion ? String(doc.stewardQuestion) : undefined,
    applicantReply: doc.applicantReply ? String(doc.applicantReply) : undefined,
    decisionKey: doc.decisionKey ? String(doc.decisionKey) : undefined,
    verifiedAt: doc.verifiedAt ? String(doc.verifiedAt) : '',
    lastEmailAt: doc.lastEmailAt ? String(doc.lastEmailAt) : '',
    remindedAt: doc.remindedAt ? String(doc.remindedAt) : '',
  };
}

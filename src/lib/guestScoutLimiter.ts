import { createHash } from 'node:crypto';

/**
 * Fair-use limiter for the public Guest Preview of Scout (/scout, logged out).
 *
 * NOTE: this is a fair-use / cost-protection limiter, not an authentication
 * boundary. Members are recognised by the `auth_session_indicator` hint cookie;
 * the limiter stores only a SHA-256 of (network address + UTC date) in memory —
 * never raw IPs and never a database write.
 */
export const GUEST_DAILY_SCAN_LIMIT = 5;
export const GUEST_MAX_PHOTOS_PER_SCAN = 2;
export const GUEST_QUOTA_COOKIE = 'rc_guest_scout';

const ipCounts = new Map<string, number>();
let lastPruneDay = '';

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function readCookie(request: Request, name: string): string {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}

export function isGuestRequest(request: Request): boolean {
  return !readCookie(request, 'auth_session_indicator');
}

function clientKey(request: Request, day: string): string {
  const fwd = request.headers.get('x-forwarded-for') || '';
  const ip = fwd.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
  return createHash('sha256').update(`${ip}|${day}`).digest('hex');
}

export interface GuestQuotaResult {
  allowed: boolean;
  used: number;
  remaining: number;
  limit: number;
}

/** Checks (and on success consumes) one guest scan. */
export function consumeGuestScan(request: Request): GuestQuotaResult {
  const day = utcDay();
  if (lastPruneDay !== day) {
    ipCounts.clear();
    lastPruneDay = day;
  }

  const key = clientKey(request, day);
  const ipUsed = ipCounts.get(key) || 0;

  // Cookie format: YYYY-MM-DD:N (set by the client after each successful scan)
  const [cookieDay, cookieN] = readCookie(request, GUEST_QUOTA_COOKIE).split(':');
  const cookieUsed = cookieDay === day ? Math.max(0, parseInt(cookieN || '0', 10) || 0) : 0;

  const used = Math.max(ipUsed, cookieUsed);
  if (used >= GUEST_DAILY_SCAN_LIMIT) {
    return { allowed: false, used, remaining: 0, limit: GUEST_DAILY_SCAN_LIMIT };
  }

  ipCounts.set(key, ipUsed + 1);
  const nextUsed = used + 1;
  return {
    allowed: true,
    used: nextUsed,
    remaining: GUEST_DAILY_SCAN_LIMIT - nextUsed,
    limit: GUEST_DAILY_SCAN_LIMIT,
  };
}


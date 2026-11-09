/**
 * Signed, unguessable links for the applicant status page (SERVER-ONLY — uses node:crypto).
 *
 *   t = view token   = HMAC(secret, `${docId}:view`)     (proves "I got the link from the submit response / email")
 *   v = verify token = HMAC(secret, `${docId}:verify`)   (proves "I read the email" — only ever sent by email)
 *
 * Secret: JOIN_LINK_SECRET (recommended). Falls back to a key derived from APPWRITE_API_KEY so the
 * feature never breaks before the env var is added, but set JOIN_LINK_SECRET in Vercel.
 */
import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
import { getEnvVar } from './appwriteEnv';

export type JoinTokenPurpose = 'view' | 'verify';

function getSecret(): string {
  const explicit = getEnvVar('JOIN_LINK_SECRET');
  if (explicit) return explicit;
  const apiKey = getEnvVar('APPWRITE_API_KEY');
  if (!apiKey) throw new Error('JOIN_LINK_SECRET (or APPWRITE_API_KEY) is not configured.');
  return createHash('sha256').update(`join-link:${apiKey}`).digest('hex');
}

export function signJoinToken(docId: string, purpose: JoinTokenPurpose): string {
  return createHmac('sha256', getSecret()).update(`${docId}:${purpose}`).digest('hex').slice(0, 40);
}

export function verifyJoinToken(docId: string, purpose: JoinTokenPurpose, token: unknown): boolean {
  const given = String(token || '');
  if (!docId || given.length !== 40) return false;
  const expected = signJoinToken(docId, purpose);
  try {
    return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function hashEmail(email: string): string {
  return createHash('sha256').update(String(email || '').trim().toLowerCase()).digest('hex');
}


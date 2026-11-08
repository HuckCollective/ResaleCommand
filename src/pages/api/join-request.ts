import type { APIRoute } from 'astro';
import { createHash } from 'node:crypto';
import { Account, Client, Databases, ID, Users, Permission, Role } from 'node-appwrite';
import {
  JOIN_REQUEST_HATS,
  JOIN_REQUEST_LIMITS,
  JOIN_REQUEST_LOCATION_ID,
  JOIN_REQUEST_STATUS,
} from '../../lib/joinRequests';

export const prerender = false;

const MANIFESTS_COL_ID = 'manifests';
const DAILY_LIMIT_PER_NETWORK = 10;

const attempts = new Map<string, number>();
let lastPruneDay = '';

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const env = (key: string): string =>
  (typeof import.meta !== 'undefined' && (import.meta.env as any)?.[key]) || process.env[key] || '';

function allowAttempt(request: Request): boolean {
  const day = new Date().toISOString().slice(0, 10);
  if (lastPruneDay !== day) {
    attempts.clear();
    lastPruneDay = day;
  }
  const fwd = request.headers.get('x-forwarded-for') || '';
  const ip = fwd.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
  const key = createHash('sha256').update(`${ip}|${day}`).digest('hex');
  const used = attempts.get(key) || 0;
  if (used >= DAILY_LIMIT_PER_NETWORK) return false;
  attempts.set(key, used + 1);
  return true;
}

/**
 * Two-step server-side Email OTP join request flow:
 * 1) `action: 'send_code'` -> calls Appwrite `account.createEmailToken` from the server (bypasses browser CORS
 *    on preview/alpha domains and never collides with an active browser session).
 * 2) Default / `action: 'verify'` -> verifies the 6-digit `code` via a stateless server `account.createSession`
 *    (or checks `tempUser.emailVerification`), writes the `JOIN_REQUESTS` manifest doc, and cleans up any
 *    temporary 0-team user.
 */
export const POST: APIRoute = async ({ request }) => {
  if (!allowAttempt(request)) return json({ error: 'Too many requests today. Please try again tomorrow.' }, 429);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const endpoint = env('PUBLIC_APPWRITE_ENDPOINT');
  const project = env('PUBLIC_APPWRITE_PROJECT_ID');
  const apiKey = env('APPWRITE_API_KEY');
  const dbId = env('PUBLIC_APPWRITE_DB_ID');
  if (!endpoint || !project || !apiKey || !dbId) return json({ error: 'Server is not configured.' }, 500);

  if (body?.action === 'send_code') {
    const rawEmail = String(body?.email || '').trim().toLowerCase().slice(0, JOIN_REQUEST_LIMITS.email);
    if (!/^\S+@\S+\.\S+$/.test(rawEmail)) {
      return json({ error: 'Please enter a valid email address.' }, 400);
    }
    try {
      const anonClient = new Client().setEndpoint(endpoint).setProject(project);
      const anonAccount = new Account(anonClient);
      const token = await anonAccount.createEmailToken({ userId: ID.unique(), email: rawEmail });
      return json({ ok: true, userId: token.userId });
    } catch (err: any) {
      console.error('[join-request send_code]', err?.message || err);
      return json({ error: err?.message || 'Could not send verification email. Please check the address and try again.' }, 400);
    }
  }

  const userId = String(body?.userId || '').trim();
  const code = String(body?.code || '').trim();
  const name = String(body?.name || '').trim().slice(0, JOIN_REQUEST_LIMITS.name);
  const note = String(body?.note || '').trim().slice(0, JOIN_REQUEST_LIMITS.note);
  const hats = (Array.isArray(body?.hats) ? body.hats : []).filter((h: string) =>
    (JOIN_REQUEST_HATS as readonly string[]).includes(h)
  );
  if (!userId || !name || hats.length === 0) {
    return json({ error: 'Please add your name and pick at least one hat.' }, 400);
  }

  const client = new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey);
  const users = new Users(client);
  const databases = new Databases(client);

  try {
    if (code) {
      const anonClient = new Client().setEndpoint(endpoint).setProject(project);
      const anonAccount = new Account(anonClient);
      try {
        await anonAccount.createSession({ userId, secret: code });
      } catch (err: any) {
        return json({ error: 'That 6-digit code did not match or expired. Please request a new code.' }, 401);
      }
    }

    const tempUser = await users.get(userId);
    if (!code && !tempUser.emailVerification) {
      return json({ error: 'Email was not verified. Please request a new code.' }, 401);
    }
    const email = String(tempUser.email || '').trim().toLowerCase().slice(0, JOIN_REQUEST_LIMITS.email);
    if (!email) return json({ error: 'Email was not verified.' }, 401);

    const docId = `join_${createHash('sha256').update(email).digest('hex').slice(0, 28)}`;
    const snapshot = JSON.stringify({ name, email, hats, note, requestedAt: new Date().toISOString() });
    const docData = {
      name: `Join request: ${name}`.slice(0, 120),
      tenantId: 'system',
      locationId: JOIN_REQUEST_LOCATION_ID,
      locationName: 'Join Requests',
      status: JOIN_REQUEST_STATUS.pending,
      itemCount: 0,
      itemsSnapshot: snapshot,
      notes: '',
    };

    let alreadyReviewed = false;
    try {
      await databases.createDocument(dbId, MANIFESTS_COL_ID, docId, docData, [
        Permission.read(Role.users()),
        Permission.update(Role.users()),
        Permission.delete(Role.users()),
      ]);
    } catch (err: any) {
      if (err?.code !== 409) throw err;
      const existing: any = await databases.getDocument(dbId, MANIFESTS_COL_ID, docId);
      if (existing.status === JOIN_REQUEST_STATUS.pending) {
        await databases.updateDocument(dbId, MANIFESTS_COL_ID, docId, docData);
      } else {
        alreadyReviewed = true;
      }
    }

    // The temp user only carried the email code. Never delete anyone who belongs to a team.
    try {
      const memberships = await users.listMemberships({ userId });
      if (memberships.total === 0) await users.delete({ userId });
    } catch (cleanupErr) {
      console.warn('[join-request] Temp user cleanup skipped:', cleanupErr);
    }

    return json({ ok: true, alreadyReviewed });
  } catch (err: any) {
    console.error('[join-request] Failed:', err);
    return json({ error: 'Could not save your request. Please try again.' }, 500);
  }
};


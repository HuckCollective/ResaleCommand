import type { APIRoute } from 'astro';
import { createHash } from 'node:crypto';
import { Client, Databases, Permission, Role } from 'node-appwrite';
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
 * Direct 1-click "Connect With Us" join request endpoint.
 * Does not depend on external SMTP/Email OTP providers (which are unconfigured in Appwrite Cloud);
 * uses honeypot + per-network rate limiting + deterministic SHA-256 email doc IDs (`join_<hash>`)
 * so every inquiry lands directly in the Founder's JoinRequestsPanel and Dashboard Alert #20.
 */
export const POST: APIRoute = async ({ request }) => {
  if (!allowAttempt(request)) return json({ error: 'Too many requests today. Please try again tomorrow.' }, 429);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  // Honeypot trap for bots
  if (String(body?.website || '').trim()) {
    return json({ ok: true, alreadyReviewed: false });
  }

  const endpoint = env('PUBLIC_APPWRITE_ENDPOINT');
  const project = env('PUBLIC_APPWRITE_PROJECT_ID');
  const apiKey = env('APPWRITE_API_KEY');
  const dbId = env('PUBLIC_APPWRITE_DB_ID');
  if (!endpoint || !project || !apiKey || !dbId) return json({ error: 'Server is not configured.' }, 500);

  const name = String(body?.name || '').trim().slice(0, JOIN_REQUEST_LIMITS.name);
  const email = String(body?.email || '').trim().toLowerCase().slice(0, JOIN_REQUEST_LIMITS.email);
  const note = String(body?.note || '').trim().slice(0, JOIN_REQUEST_LIMITS.note);
  const hats = (Array.isArray(body?.hats) ? body.hats : []).filter((h: string) =>
    (JOIN_REQUEST_HATS as readonly string[]).includes(h)
  );
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || hats.length === 0) {
    return json({ error: 'Please enter your name, a valid email, and pick at least one hat.' }, 400);
  }

  const client = new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey);
  const databases = new Databases(client);

  try {
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

    try {
      await databases.createDocument(dbId, MANIFESTS_COL_ID, docId, docData, [
        Permission.read(Role.users()),
        Permission.update(Role.users()),
        Permission.delete(Role.users()),
      ]);
    } catch (err: any) {
      if (err?.code !== 409) throw err;
      await databases.updateDocument(dbId, MANIFESTS_COL_ID, docId, docData);
    }

    return json({ ok: true, alreadyReviewed: false });
  } catch (err: any) {
    console.error('[join-request]', err?.message || err);
    return json({ error: 'Could not save your request. Please try again.' }, 500);
  }
};

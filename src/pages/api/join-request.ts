import type { APIRoute } from 'astro';
import { createHash } from 'node:crypto';
import { Client, Databases, ID, Messaging } from 'node-appwrite';
import {
  COOP_MESSAGING_TOPICS,
  JOIN_REQUEST_HATS,
  JOIN_REQUEST_LIMITS,
  JOIN_REQUEST_LOCATION_ID,
  JOIN_REQUEST_STATUS,
} from '../../lib/joinRequests';
import { getDatabaseId, getEnvVar } from '../../lib/appwriteEnv';

export const prerender = false;

const MANIFESTS_COL_ID = 'manifests';
const DAILY_LIMIT_PER_NETWORK = 15;

const attempts = new Map<string, number>();
let lastPruneDay = '';

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

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

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Direct 1-click "Connect With Us" join request endpoint.
 * 1) Saves the request to `manifests` (`locationId: 'JOIN_REQUESTS'`) using public project credentials
 *    so it works on every deployment (even if `APPWRITE_API_KEY` is unset on a preview branch).
 * 2) When `APPWRITE_API_KEY` is configured, publishes an instant email to `coop-founders` via Appwrite Messaging.
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

  const endpoint = getEnvVar('PUBLIC_APPWRITE_ENDPOINT');
  const project = getEnvVar('PUBLIC_APPWRITE_PROJECT_ID');
  const apiKey = getEnvVar('APPWRITE_API_KEY');
  const dbId = getDatabaseId();
  if (!endpoint || !project || !dbId) {
    return json({ error: 'Appwrite endpoint or project ID is not configured.' }, 500);
  }

  const name = String(body?.name || '').trim().slice(0, JOIN_REQUEST_LIMITS.name);
  const email = String(body?.email || '').trim().toLowerCase().slice(0, JOIN_REQUEST_LIMITS.email);
  const note = String(body?.note || '').trim().slice(0, JOIN_REQUEST_LIMITS.note);
  const hats = (Array.isArray(body?.hats) ? body.hats : []).filter((h: string) =>
    (JOIN_REQUEST_HATS as readonly string[]).includes(h)
  );
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || hats.length === 0) {
    return json({ error: 'Please enter your name, a valid email, and pick at least one hat.' }, 400);
  }

  const publicClient = new Client().setEndpoint(endpoint).setProject(project);
  const databases = new Databases(publicClient);

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
      await databases.createDocument(dbId, MANIFESTS_COL_ID, docId, docData);
    } catch (err: any) {
      if (err?.code !== 409) throw err;
      await databases.updateDocument(dbId, MANIFESTS_COL_ID, docId, docData);
    }

    // Best-effort instant email alert to the `coop-founders` Topic when APPWRITE_API_KEY is available
    if (apiKey) {
      try {
        const keyClient = new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey);
        const messaging = new Messaging(keyClient);
        await messaging.createEmail({
          messageId: ID.unique(),
          subject: `New Co-op Join Request: ${name} (${hats.join(', ')})`,
          content: [
            `<p><strong>${escapeHtml(name)}</strong> (<code>${escapeHtml(email)}</code>) submitted a <strong>Connect With Us</strong> request on the Co-op Charter.</p>`,
            `<p><strong>Hats:</strong> ${escapeHtml(hats.join(', '))}</p>`,
            note ? `<p><strong>Note:</strong><br/>${escapeHtml(note)}</p>` : '',
            `<p><a href="https://resalecmd.com/coop/governance">Open Co-op Governance to Approve or Reply</a></p>`,
          ].join(''),
          topics: [COOP_MESSAGING_TOPICS.founders],
          html: true,
        });
      } catch (mailErr: any) {
        console.warn('[join-request] Messaging topic notification skipped:', mailErr?.message || mailErr);
      }
    }

    return json({ ok: true, alreadyReviewed: false });
  } catch (err: any) {
    console.error('[join-request]', err?.message || err);
    return json({ error: err?.message || 'Could not save your request. Please try again.' }, 500);
  }
};

import type { APIRoute } from 'astro';
import { createHash } from 'node:crypto';
import { Client, Databases, ID, Messaging, Users } from 'node-appwrite';
import {
  COOP_MESSAGING_TOPICS,
  JOIN_DECISION_TEMPLATES,
  JOIN_REQUEST_HATS,
  JOIN_REQUEST_LIMITS,
  JOIN_REQUEST_LOCATION_ID,
  JOIN_REQUEST_STATUS,
  buildInviteSignupUrl,
  parseJoinRequestDoc,
  serializeJoinRequestSnapshot,
  type JoinDecisionKey,
  type JoinRequestStatus,
} from '../../lib/joinRequests';
import { getDatabaseId, getEnvVar } from '../../lib/appwriteEnv';

export const prerender = false;

const MANIFESTS_COL_ID = 'manifests';
const DAILY_LIMIT_PER_NETWORK = 30;

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
 * Resolve or create an Appwrite Messaging email target for an applicant so
 * Porkbun SMTP can deliver automated 1-way status templates (Approve, Waitlist, Decline, Needs Info).
 */
async function ensureEmailTargetId(keyClient: Client, email: string): Promise<string | null> {
  try {
    const users = new Users(keyClient);
    const list = await users.list();
    const hostUser = list.users.find((u) => u.labels?.includes('admin')) || list.users[0];
    if (!hostUser) return null;

    const existing = await users.listTargets(hostUser.$id);
    const match = existing.targets.find(
      (t) => t.providerType === 'email' && String(t.identifier || '').toLowerCase() === email.toLowerCase()
    );
    if (match) return match.$id;

    const targetId = `inv_${createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 24)}`;
    try {
      const created = await users.createTarget(hostUser.$id, targetId, 'email', email.toLowerCase());
      return created.$id;
    } catch {
      return targetId;
    }
  } catch (err: any) {
    console.warn('[join-request] ensureEmailTargetId skipped:', err?.message || err);
    return null;
  }
}

export const POST: APIRoute = async ({ request }) => {
  if (!allowAttempt(request)) return json({ error: 'Too many requests today. Please try again tomorrow.' }, 429);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const endpoint = getEnvVar('PUBLIC_APPWRITE_ENDPOINT');
  const project = getEnvVar('PUBLIC_APPWRITE_PROJECT_ID');
  const apiKey = getEnvVar('APPWRITE_API_KEY');
  const dbId = getDatabaseId();
  if (!endpoint || !project || !dbId) {
    return json({ error: 'Appwrite endpoint or project ID is not configured.' }, 500);
  }

  const publicClient = new Client().setEndpoint(endpoint).setProject(project);
  const databases = new Databases(publicClient);

  // Branch A: Steward 1-Click Decision (Approve, Waitlist, Polite Decline, or Ask 1 On-Page Question)
  if (body?.action === 'decide' || body?.action === 'approve') {
    const docId = String(body?.id || '').trim();
    const decision: JoinDecisionKey =
      body?.action === 'approve' ? 'approve' : (body?.decision as JoinDecisionKey) || 'approve';
    const question = String(body?.question || '').trim().slice(0, JOIN_REQUEST_LIMITS.question);

    if (!docId.startsWith('join_')) {
      return json({ error: 'Invalid join request ID.' }, 400);
    }

    try {
      const doc = await databases.getDocument(dbId, MANIFESTS_COL_ID, docId);
      const req = parseJoinRequestDoc(doc);
      if (!req) return json({ error: 'Join request not found.' }, 404);

      let nextStatus: JoinRequestStatus = JOIN_REQUEST_STATUS.approved;
      if (decision === 'waitlist') nextStatus = JOIN_REQUEST_STATUS.waitlisted;
      else if (decision === 'needs_info') nextStatus = JOIN_REQUEST_STATUS.needs_info;
      else if (decision.startsWith('decline_')) nextStatus = JOIN_REQUEST_STATUS.declined;

      const updatedSnapshot = serializeJoinRequestSnapshot({
        ...req,
        stewardQuestion: decision === 'needs_info' ? question : req.stewardQuestion,
        decisionKey: decision,
      });

      await databases.updateDocument(dbId, MANIFESTS_COL_ID, docId, {
        status: nextStatus,
        itemsSnapshot: updatedSnapshot,
      });

      const origin = new URL(request.url).origin;
      const statusUrl = buildInviteSignupUrl(docId, origin);
      let emailSent = false;

      if (apiKey && decision !== 'decline_silent') {
        try {
          const keyClient = new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey);
          const targetId = await ensureEmailTargetId(keyClient, req.email);
          if (targetId) {
            const messaging = new Messaging(keyClient);
            let subject = '';
            let htmlBody = '';

            if (decision === 'approve') {
              subject = JOIN_DECISION_TEMPLATES.approve.subject;
              htmlBody = [
                `<p>Hi <strong>${escapeHtml(req.name)}</strong>,</p>`,
                `<p>${escapeHtml(JOIN_DECISION_TEMPLATES.approve.message)}</p>`,
                `<p style="margin:20px 0;"><a href="${escapeHtml(statusUrl)}" style="background:#10b981;color:#ffffff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold;display:inline-block;">Accept Invitation &amp; Create Account</a></p>`,
                `<p style="font-size:12px;color:#666;">Or copy this link into your browser:<br/><code>${escapeHtml(statusUrl)}</code></p>`,
                `<hr style="border:none;border-top:1px solid #eee;margin:20px 0;"/>`,
                `<p style="font-size:11px;color:#888;">Automated notification from The Huckleberry Collective. No email reply is needed.</p>`,
              ].join('');
            } else if (decision === 'needs_info') {
              subject = 'Quick question about your Huckleberry Collective application';
              htmlBody = [
                `<p>Hi <strong>${escapeHtml(req.name)}</strong>,</p>`,
                `<p>A co-op steward reviewed your application and posted a quick question for you:</p>`,
                `<blockquote style="border-left:4px solid #0ea5e9;padding:10px 14px;background:#f8fafc;margin:16px 0;"><strong>${escapeHtml(question || 'Could you share a bit more detail about what you curate or want to help with?')}</strong></blockquote>`,
                `<p>Please answer directly on your application status page (do not reply by email):</p>`,
                `<p style="margin:20px 0;"><a href="${escapeHtml(statusUrl)}" style="background:#0ea5e9;color:#ffffff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold;display:inline-block;">Answer on Application Page</a></p>`,
                `<hr style="border:none;border-top:1px solid #eee;margin:20px 0;"/>`,
                `<p style="font-size:11px;color:#888;">Automated notification from The Huckleberry Collective. Please use the button above rather than replying by email.</p>`,
              ].join('');
            } else {
              const tpl =
                JOIN_DECISION_TEMPLATES[decision as keyof typeof JOIN_DECISION_TEMPLATES] ||
                JOIN_DECISION_TEMPLATES.decline_category;
              subject = tpl.subject;
              htmlBody = [
                `<p>Hi <strong>${escapeHtml(req.name)}</strong>,</p>`,
                `<p>${escapeHtml(tpl.message)}</p>`,
                `<p style="font-size:12px;color:#666;">You can check your application status anytime at:<br/><a href="${escapeHtml(statusUrl)}">${escapeHtml(statusUrl)}</a></p>`,
                `<hr style="border:none;border-top:1px solid #eee;margin:20px 0;"/>`,
                `<p style="font-size:11px;color:#888;">Automated status update from The Huckleberry Collective. No email reply is needed.</p>`,
              ].join('');
            }

            await messaging.createEmail({
              messageId: ID.unique(),
              subject,
              content: htmlBody,
              targets: [targetId],
              html: true,
            });
            emailSent = true;
          }
        } catch (mailErr: any) {
          console.warn('[join-request] Decision email skipped:', mailErr?.message || mailErr);
        }
      }

      return json({ ok: true, inviteUrl: statusUrl, emailSent, status: nextStatus });
    } catch (err: any) {
      return json({ error: err?.message || 'Could not update request.' }, 500);
    }
  }

  // Branch B: Visitor submits a "Connect With Us" / Invite Request
  if (String(body?.website || '').trim()) {
    return json({ ok: true, alreadyReviewed: false });
  }

  const name = String(body?.name || '').trim().slice(0, JOIN_REQUEST_LIMITS.name);
  const email = String(body?.email || '').trim().toLowerCase().slice(0, JOIN_REQUEST_LIMITS.email);
  const note = String(body?.note || '').trim().slice(0, JOIN_REQUEST_LIMITS.note);
  const socialUrl = String(body?.socialUrl || '').trim().slice(0, JOIN_REQUEST_LIMITS.socialUrl);
  const niches = (Array.isArray(body?.niches) ? body.niches : []).map((n: any) => String(n)).slice(0, 8);
  const hats = (Array.isArray(body?.hats) ? body.hats : []).filter((h: string) =>
    (JOIN_REQUEST_HATS as readonly string[]).includes(h)
  );
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || hats.length === 0) {
    return json({ error: 'Please enter your name, a valid email, and pick at least one hat.' }, 400);
  }

  try {
    const docId = `join_${createHash('sha256').update(email).digest('hex').slice(0, 28)}`;
    const snapshot = serializeJoinRequestSnapshot({
      name,
      email,
      hats,
      niches,
      socialUrl,
      note,
      requestedAt: new Date().toISOString(),
    });
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

    if (apiKey) {
      try {
        const keyClient = new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey);
        const messaging = new Messaging(keyClient);
        await messaging.createEmail({
          messageId: ID.unique(),
          subject: `New Co-op Join Request: ${name} (${hats.join(', ')})`,
          content: [
            `<p><strong>${escapeHtml(name)}</strong> (<code>${escapeHtml(email)}</code>) requested an invitation to join the Collective.</p>`,
            `<p><strong>Hats:</strong> ${escapeHtml(hats.join(', '))}</p>`,
            niches.length ? `<p><strong>Niches:</strong> ${escapeHtml(niches.join(', '))}</p>` : '',
            socialUrl ? `<p><strong>Shop / Social Link:</strong> ${escapeHtml(socialUrl)}</p>` : '',
            note ? `<p><strong>Note:</strong><br/>${escapeHtml(note)}</p>` : '',
            `<p><a href="https://resalecmd.com/dashboard">Open Command Center for 1-Click Approve / Waitlist / Decline</a></p>`,
          ].join(''),
          topics: [COOP_MESSAGING_TOPICS.founders],
          html: true,
        });
      } catch (mailErr: any) {
        console.warn('[join-request] Messaging topic notification skipped:', mailErr?.message || mailErr);
      }
    }

    return json({ ok: true, id: docId, alreadyReviewed: false });
  } catch (err: any) {
    console.error('[join-request]', err?.message || err);
    return json({ error: err?.message || 'Could not save your request. Please try again.' }, 500);
  }
};

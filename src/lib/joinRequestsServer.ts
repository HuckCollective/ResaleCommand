/**
 * Server-only helpers for the join-request API + reminder cron
 * (Appwrite admin client, steward auth, applicant/steward email templates).
 */
import { Account, Client, Databases, ID, Messaging, Query, Teams, Users } from 'node-appwrite';
import { createHash } from 'node:crypto';
import { getDatabaseId, getEnvVar, resolveCollectionId } from './appwriteEnv';
import {
  COOP_MESSAGING_TOPICS,
  JOIN_DECISION_TEMPLATES,
  JOIN_REQUESTS_COLLECTION_BASE,
  buildStatusUrl,
  type JoinDecisionKey,
  type JoinRequest,
} from './joinRequests';
import { signJoinToken } from './joinLinkTokens';
import { siteConfig } from '../site-config';

export interface JoinServerContext {
  endpoint: string;
  project: string;
  apiKey: string;
  dbId: string;
  collectionId: string;
  databases: Databases;
  messaging: Messaging;
  keyClient: Client;
}

export function getJoinServerContext(): JoinServerContext | null {
  const endpoint = getEnvVar('PUBLIC_APPWRITE_ENDPOINT');
  const project = getEnvVar('PUBLIC_APPWRITE_PROJECT_ID');
  const apiKey = getEnvVar('APPWRITE_API_KEY');
  if (!endpoint || !project || !apiKey) return null;
  const keyClient = new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey);
  return {
    endpoint,
    project,
    apiKey,
    dbId: getDatabaseId(),
    collectionId: resolveCollectionId(JOIN_REQUESTS_COLLECTION_BASE),
    databases: new Databases(keyClient),
    messaging: new Messaging(keyClient),
    keyClient,
  };
}

export const escapeHtml = (s: string) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Full steward link (t + v) — only ever emailed to the verified applicant. */
export function ownerStatusUrl(docId: string, origin: string): string {
  return buildStatusUrl(docId, { t: signJoinToken(docId, 'view'), v: signJoinToken(docId, 'verify') }, origin);
}

/** View-only link (t) — returned straight to the submitting browser. */
export function viewerStatusUrl(docId: string, origin: string): string {
  return buildStatusUrl(docId, { t: signJoinToken(docId, 'view') }, origin);
}

/**
 * Resolve or create an Appwrite Messaging email target for an applicant so Google Workspace SMTP
 * can deliver automated 1-way status templates.
 */
async function ensureEmailTargetId(ctx: JoinServerContext, email: string): Promise<string | null> {
  try {
    const users = new Users(ctx.keyClient);
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

export async function sendApplicantEmail(
  ctx: JoinServerContext,
  email: string,
  subject: string,
  html: string
): Promise<boolean> {
  try {
    const targetId = await ensureEmailTargetId(ctx, email);
    if (!targetId) return false;
    await ctx.messaging.createEmail({
      messageId: ID.unique(),
      subject,
      content: html,
      targets: [targetId],
      html: true,
    });
    return true;
  } catch (err: any) {
    console.warn('[join-request] Applicant email skipped:', err?.message || err);
    return false;
  }
}

export async function sendStewardEmail(ctx: JoinServerContext, subject: string, html: string): Promise<boolean> {
  try {
    await ctx.messaging.createEmail({
      messageId: ID.unique(),
      subject,
      content: html,
      topics: [COOP_MESSAGING_TOPICS.founders],
      html: true,
    });
    return true;
  } catch (err: any) {
    console.warn('[join-request] Steward topic notification skipped:', err?.message || err);
    return false;
  }
}

/**
 * Steward gate: caller must present a valid Appwrite JWT (`X-Appwrite-JWT`) and be a team owner
 * or carry the `admin` label. Returns the user id, or null when not authorised.
 */
export async function requireSteward(request: Request, ctx: JoinServerContext): Promise<string | null> {
  const jwt = request.headers.get('X-Appwrite-JWT');
  if (!jwt) return null;
  try {
    const userClient = new Client().setEndpoint(ctx.endpoint).setProject(ctx.project).setJWT(jwt);
    const me = await new Account(userClient).get();
    if (me.labels?.includes('admin')) return me.$id;

    const teams = new Teams(ctx.keyClient);
    const list = await teams.list();
    for (const team of list.teams) {
      const memberships = await teams.listMemberships(team.$id, [Query.equal('userId', me.$id), Query.limit(1)]);
      if (memberships.memberships.some((m) => m.roles?.includes('owner'))) return me.$id;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

const FOOTER = (note: string) =>
  `<hr style="border:none;border-top:1px solid #eee;margin:20px 0;"/><p style="font-size:11px;color:#888;">${note} — ${escapeHtml(siteConfig.title)} (${escapeHtml(siteConfig.organization)}). No email reply is needed.</p>`;

const BUTTON = (href: string, label: string, color = '#10b981') =>
  `<p style="margin:20px 0;"><a href="${escapeHtml(href)}" style="background:${color};color:#ffffff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold;display:inline-block;">${escapeHtml(label)}</a></p>`;

const LINK_FALLBACK = (href: string) =>
  `<p style="font-size:12px;color:#666;">Or copy this link into your browser:<br/><code>${escapeHtml(href)}</code></p>`;

function applicationSummaryHtml(req: Pick<JoinRequest, 'hats' | 'niches' | 'socialUrl' | 'note'>): string {
  return [
    `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin:16px 0;font-size:13px;">`,
    `<p style="margin:0 0 6px 0;"><strong>Requested Hat(s):</strong> ${escapeHtml(req.hats.join(', '))}</p>`,
    req.niches.length ? `<p style="margin:0 0 6px 0;"><strong>Specialty Focus:</strong> ${escapeHtml(req.niches.join(', '))}</p>` : '',
    req.socialUrl ? `<p style="margin:0 0 6px 0;"><strong>Shop / Social:</strong> ${escapeHtml(req.socialUrl)}</p>` : '',
    req.note ? `<p style="margin:0;"><strong>Notes:</strong> ${escapeHtml(req.note)}</p>` : '',
    `</div>`,
  ].join('');
}

export function verificationEmail(req: JoinRequest, origin: string, reminder = false) {
  const link = ownerStatusUrl(req.id, origin);
  return {
    subject: reminder
      ? 'Finish your Huckleberry Collective application — verify your email'
      : 'Verify your email to finish your Huckleberry Collective application',
    html: [
      `<p>Hi <strong>${escapeHtml(req.name)}</strong>,</p>`,
      reminder
        ? `<p>Your Huckleberry Collective application is saved but our stewards can't see it yet — please confirm your email so we can review it.</p>`
        : `<p>Thanks for connecting with <strong>The Huckleberry Collective</strong>! Please confirm this is your email so our stewards can review your application.</p>`,
      applicationSummaryHtml(req),
      BUTTON(link, 'Verify Email & View My Application'),
      LINK_FALLBACK(link),
      `<p style="font-size:12px;color:#666;">If you didn't apply, you can ignore this message — nothing happens unless you click.</p>`,
      FOOTER('Automated message'),
    ].join(''),
  };
}

export function statusLinkEmail(req: JoinRequest, origin: string) {
  const link = ownerStatusUrl(req.id, origin);
  return {
    subject: 'Your Huckleberry Collective application link',
    html: [
      `<p>Hi <strong>${escapeHtml(req.name)}</strong>,</p>`,
      `<p>Here is your personal link to check on your application, answer any steward question, or update your selections.</p>`,
      BUTTON(link, 'View My Application'),
      LINK_FALLBACK(link),
      FOOTER('Automated message'),
    ].join(''),
  };
}

export function stewardNewRequestEmail(req: JoinRequest, origin: string, isUpdate: boolean) {
  return {
    subject: `${isUpdate ? 'Updated' : 'New'} Co-op Join Request: ${req.name} (${req.hats.join(', ')})`,
    html: [
      `<p><strong>${escapeHtml(req.name)}</strong> (<code>${escapeHtml(req.email)}</code>) ${isUpdate ? 'updated their application to join' : 'requested an invitation to join'} the Collective (email verified).</p>`,
      applicationSummaryHtml(req),
      BUTTON(`${origin.replace(/\/+$/, '')}/dashboard`, `Open ${siteConfig.title} Command Center (1-Click Review)`),
    ].join(''),
  };
}

export function decisionEmail(req: JoinRequest, decision: JoinDecisionKey, question: string, origin: string) {
  const link = ownerStatusUrl(req.id, origin);
  if (decision === 'approve') {
    return {
      subject: JOIN_DECISION_TEMPLATES.approve.subject,
      html: [
        `<p>Hi <strong>${escapeHtml(req.name)}</strong>,</p>`,
        `<p>${escapeHtml(JOIN_DECISION_TEMPLATES.approve.message)}</p>`,
        BUTTON(link, 'Accept Invitation & Create Account'),
        LINK_FALLBACK(link),
        FOOTER('Automated notification'),
      ].join(''),
    };
  }
  if (decision === 'needs_info') {
    return {
      subject: 'Quick question about your Huckleberry Collective application',
      html: [
        `<p>Hi <strong>${escapeHtml(req.name)}</strong>,</p>`,
        `<p>A co-op steward reviewed your application and posted a quick question for you:</p>`,
        `<blockquote style="border-left:4px solid #0ea5e9;padding:10px 14px;background:#f8fafc;margin:16px 0;"><strong>${escapeHtml(question || 'Could you share a bit more detail about what you curate or want to help with?')}</strong></blockquote>`,
        `<p>Please answer directly on your application status page (do not reply by email):</p>`,
        BUTTON(link, 'Answer on Application Page', '#0ea5e9'),
        FOOTER('Automated notification'),
      ].join(''),
    };
  }
  const tpl =
    JOIN_DECISION_TEMPLATES[decision as keyof typeof JOIN_DECISION_TEMPLATES] || JOIN_DECISION_TEMPLATES.decline_category;
  return {
    subject: tpl.subject,
    html: [
      `<p>Hi <strong>${escapeHtml(req.name)}</strong>,</p>`,
      `<p>${escapeHtml(tpl.message)}</p>`,
      `<p style="font-size:12px;color:#666;">You can check your application status anytime at:<br/><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>`,
      FOOTER('Automated status update'),
    ].join(''),
  };
}

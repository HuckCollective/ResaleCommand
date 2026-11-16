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
import {
  COOP_GOVERNANCE_DOC_ID,
  DEFAULT_COOP_POLICY_CONFIG,
  MEMBER_HAT_META,
  ensureCuratorBaseRoles,
  normalizePolicyConfig,
  type CoopMemberProfile,
  type MemberHat,
} from './coopGovernance';
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

const SAFE_ACCEPT_HATS: ReadonlySet<MemberHat> = new Set<MemberHat>([
  'curator',
  'promoter',
  'enabler',
  'builder',
  'consignor',
]);

const MANIFESTS_COL_ID = 'manifests';

/**
 * 1-Click Server Auto-Provisioning (`SignupView.vue` -> `/api/join-request` `action: 'accept'`):
 * 1. Filters `req.hats` strictly through `SAFE_ACCEPT_HATS` (never `founder`/`owner`) and auto-pairs
 *    `'curator'` on initial onboarding for voting provider roles (`ensureCuratorBaseRoles`).
 * 2. Resolves the registered Appwrite `userId` (verifying email ownership) and adds the user directly
 *    to `COOP_TEAM_ID` via `node-appwrite` `Teams.createMembership({ teamId, roles, userId, name })`
 *    (automatic confirmation, zero duplicate invite email; idempotent `409` fallback via `updateMembership`).
 * 3. Upserts and links their `CoopMemberProfile` row inside `manifests/coop_governance_proposals_v1`.
 */
export async function provisionAcceptedJoinMember(
  ctx: JoinServerContext,
  req: JoinRequest,
  hintUserId?: string
): Promise<{ teamProvisioned: boolean; rosterLinked: boolean; resolvedUserId: string }> {
  const cleanEmail = String(req.email || '').trim().toLowerCase();
  const cleanName = String(req.name || 'Co-op Member').trim().slice(0, 128);

  const allowlistedHats = (Array.isArray(req.hats) ? req.hats : [])
    .map((h) => String(h || '').trim().toLowerCase() as MemberHat)
    .filter((h) => SAFE_ACCEPT_HATS.has(h));

  const baseHats: MemberHat[] = allowlistedHats.length > 0 ? allowlistedHats : ['curator'];
  const pairedHats = ensureCuratorBaseRoles(baseHats) as MemberHat[];
  const teamRoles = Array.from(new Set(['member', ...pairedHats]));

  const users = new Users(ctx.keyClient);
  let resolvedUserId = '';

  const candidateId = String(hintUserId || '').trim();
  if (candidateId) {
    try {
      const u = await users.get(candidateId);
      if (String(u.email || '').trim().toLowerCase() === cleanEmail) {
        resolvedUserId = String(u.$id);
      }
    } catch {
      // Fall back to email lookup below
    }
  }

  if (!resolvedUserId && cleanEmail) {
    const found = await users.list([Query.equal('email', [cleanEmail]), Query.limit(1)]);
    if (found.users.length > 0) {
      resolvedUserId = String(found.users[0].$id);
    }
  }

  let teamProvisioned = false;
  const coopTeamId = getEnvVar('COOP_TEAM_ID');
  if (coopTeamId && resolvedUserId) {
    const teams = new Teams(ctx.keyClient);
    try {
      await teams.createMembership({
        teamId: coopTeamId,
        roles: teamRoles,
        userId: resolvedUserId,
        name: cleanName,
      });
      teamProvisioned = true;
    } catch (teamErr: any) {
      if (
        teamErr?.code === 409 ||
        /already|conflict|invited|member/i.test(String(teamErr?.message || ''))
      ) {
        const list = await teams.listMemberships(coopTeamId, [Query.limit(100)]);
        const existing = (list.memberships || []).find(
          (m: any) =>
            m.userId === resolvedUserId ||
            String(m.userEmail || '').trim().toLowerCase() === cleanEmail
        );
        if (existing) {
          const mergedRoles = Array.from(new Set([...(existing.roles || []), ...teamRoles]));
          await teams.updateMembership({
            teamId: coopTeamId,
            membershipId: existing.$id,
            roles: mergedRoles,
          });
          teamProvisioned = true;
        }
      } else {
        throw teamErr;
      }
    }
  }

  let rosterLinked = false;
  if (ctx.dbId) {
    const manifestCol = resolveCollectionId(MANIFESTS_COL_ID);
    let rawSnap: Record<string, any> = {};
    let docExists = false;

    try {
      const doc: any = await ctx.databases.getDocument(ctx.dbId, manifestCol, COOP_GOVERNANCE_DOC_ID);
      docExists = true;
      if (typeof doc.itemsSnapshot === 'string' && doc.itemsSnapshot.trim().startsWith('{')) {
        rawSnap = JSON.parse(doc.itemsSnapshot);
      }
    } catch (err: any) {
      if (err?.code !== 404) throw err;
    }

    const policyConfig = normalizePolicyConfig(rawSnap.policyConfig || DEFAULT_COOP_POLICY_CONFIG);
    const members = [...policyConfig.members];

    const matchIdx = members.findIndex(
      (m) =>
        (resolvedUserId && m.userId && m.userId === resolvedUserId) ||
        (cleanEmail && m.email && m.email.trim().toLowerCase() === cleanEmail) ||
        m.name.trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (matchIdx >= 0) {
      const prev = members[matchIdx];
      const mergedHats = Array.from(new Set([...(prev.hats || []), ...pairedHats])) as MemberHat[];
      const usesPrefix = mergedHats.some((h) => MEMBER_HAT_META[h]?.usesPrefix);
      const nextPartner = prev.partner;
      members[matchIdx] = {
        ...prev,
        userId: resolvedUserId || prev.userId,
        email: cleanEmail || prev.email,
        hats: mergedHats,
        inventoryPrefix: usesPrefix
          ? prev.inventoryPrefix || (nextPartner === 'SWEAT' ? 'HUCK-' : `${nextPartner}-`)
          : undefined,
        canVote: mergedHats.some((h) => MEMBER_HAT_META[h]?.canVote),
      };
    } else {
      const isConsignorOnly = pairedHats.length === 1 && pairedHats[0] === 'consignor';
      const explicitlyPickedCurator = allowlistedHats.includes('curator');
      const partner: CoopMemberProfile['partner'] = isConsignorOnly
        ? 'BB'
        : explicitlyPickedCurator
          ? 'HUCK'
          : 'SWEAT';
      const role: CoopMemberProfile['role'] = isConsignorOnly
        ? 'Consignor'
        : explicitlyPickedCurator
          ? 'Partner Curator'
          : 'Marketing & Social Enabler';
      const usesPrefix = pairedHats.some((h) => MEMBER_HAT_META[h]?.usesPrefix);

      members.push({
        name: cleanName,
        partner,
        role,
        canVote: pairedHats.some((h) => MEMBER_HAT_META[h]?.canVote),
        userId: resolvedUserId || undefined,
        email: cleanEmail || undefined,
        hats: pairedHats,
        inventoryPrefix: usesPrefix
          ? isConsignorOnly
            ? 'BB-'
            : 'HUCK-'
          : undefined,
      });
    }

    const nowIso = new Date().toISOString();
    const nextSnapshotStr = JSON.stringify({
      ...rawSnap,
      policyConfig: {
        ...policyConfig,
        members,
      },
      updatedAt: nowIso,
    });

    if (docExists) {
      await ctx.databases.updateDocument(ctx.dbId, manifestCol, COOP_GOVERNANCE_DOC_ID, {
        itemsSnapshot: nextSnapshotStr,
      });
    } else {
      await ctx.databases.createDocument(ctx.dbId, manifestCol, COOP_GOVERNANCE_DOC_ID, {
        manifestType: 'system_coop_governance',
        tenantId: 'huck_collective',
        itemsSnapshot: nextSnapshotStr,
      });
    }
    rosterLinked = true;
  }

  return { teamProvisioned, rosterLinked, resolvedUserId };
}


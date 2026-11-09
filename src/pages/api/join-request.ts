import type { APIRoute } from 'astro';
import { createHash, randomBytes } from 'node:crypto';
import { Query } from 'node-appwrite';
import {
  JOIN_REQUEST_HATS,
  JOIN_REQUEST_LIMITS,
  JOIN_REQUEST_POLICY,
  JOIN_REQUEST_STATUS,
  isDisposableEmail,
  maskEmail,
  rowToJoinRequest,
  type JoinDecisionKey,
  type JoinRequest,
  type JoinRequestStatus,
} from '../../lib/joinRequests';
import { hashEmail, verifyJoinToken } from '../../lib/joinLinkTokens';
import { siteConfig } from '../../site-config';
import {
  decisionEmail,
  getJoinServerContext,
  requireSteward,
  sendApplicantEmail,
  sendStewardEmail,
  statusLinkEmail,
  stewardNewRequestEmail,
  verificationEmail,
  viewerStatusUrl,
  ownerStatusUrl,
  type JoinServerContext,
} from '../../lib/joinRequestsServer';

export const prerender = false;

const DAILY_LIMIT_PER_NETWORK = 30;
const attempts = new Map<string, number>();
let lastPruneDay = '';

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const NOT_FOUND = () => json({ error: 'Application not found.' }, 404);

/** Best-effort per-instance throttle (the real limits are per-email cooldowns + the pending cap). */
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

async function loadRequest(ctx: JoinServerContext, id: string): Promise<JoinRequest | null> {
  if (!/^join_[a-f0-9]{10,64}$/i.test(id)) return null;
  try {
    return rowToJoinRequest(await ctx.databases.getDocument(ctx.dbId, ctx.collectionId, id));
  } catch {
    return null;
  }
}

const saveRow = (ctx: JoinServerContext, id: string, data: Record<string, unknown>) =>
  ctx.databases.updateDocument(ctx.dbId, ctx.collectionId, id, data);

const cooldownRemaining = (req: JoinRequest) => {
  const last = req.lastEmailAt ? Date.parse(req.lastEmailAt) : 0;
  return Math.max(0, last + JOIN_REQUEST_POLICY.emailCooldownMs - Date.now());
};

/** Applicant-facing payload (never leaks internal fields). */
function publicView(req: JoinRequest, isOwner: boolean) {
  const verified = !!req.verifiedAt;
  const open = req.status === JOIN_REQUEST_STATUS.pending || req.status === JOIN_REQUEST_STATUS.waitlisted;
  return {
    id: req.id,
    name: req.name,
    email: !verified || isOwner ? req.email : '',
    emailMasked: maskEmail(req.email),
    hats: req.hats,
    niches: req.niches,
    socialUrl: req.socialUrl,
    note: req.note,
    requestedAt: req.requestedAt,
    status: req.status,
    stewardQuestion: req.stewardQuestion,
    applicantReply: req.applicantReply,
    verified,
    isOwner,
    canEdit: open && (isOwner || !verified),
    cooldownRemainingMs: cooldownRemaining(req),
  };
}

function cleanFields(body: any) {
  const name = String(body?.name || '').trim().slice(0, JOIN_REQUEST_LIMITS.name);
  const email = String(body?.email || '').trim().toLowerCase().slice(0, JOIN_REQUEST_LIMITS.email);
  const note = String(body?.note || '').trim().slice(0, JOIN_REQUEST_LIMITS.note);
  const socialUrl = String(body?.socialUrl || '').trim().slice(0, JOIN_REQUEST_LIMITS.socialUrl);
  const niches = (Array.isArray(body?.niches) ? body.niches : []).map((n: any) => String(n).slice(0, 60)).slice(0, 8);
  const hats = (Array.isArray(body?.hats) ? body.hats : []).filter((h: string) =>
    (JOIN_REQUEST_HATS as readonly string[]).includes(h)
  );
  const valid = !!name && /^\S+@\S+\.\S+$/.test(email) && hats.length > 0;
  return { name, email, note, socialUrl, niches, hats, valid };
}

async function notifyStewards(ctx: JoinServerContext, req: JoinRequest, origin: string, isUpdate: boolean) {
  const mail = stewardNewRequestEmail(req, origin, isUpdate);
  await sendStewardEmail(ctx, mail.subject, mail.html);
}

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const ctx = getJoinServerContext();
  if (!ctx || !ctx.dbId) return json({ error: 'Appwrite is not configured.' }, 500);

  const action = String(body?.action || '');
  const reqOrigin = new URL(request.url).origin;
  const emailOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(reqOrigin)
    ? siteConfig.siteUrl
    : reqOrigin;
  const id = String(body?.id || '').trim();

  try {
    // -----------------------------------------------------------------------
    // Steward actions (Appwrite JWT required)
    // -----------------------------------------------------------------------
    if (action === 'list' || action === 'count' || action === 'decide' || action === 'link') {
      const stewardId = await requireSteward(request, ctx);
      if (!stewardId) return json({ error: 'Steward access required.' }, 403);

      if (action === 'link') {
        const target = await loadRequest(ctx, id);
        if (!target || !target.verifiedAt) return NOT_FOUND();
        return json({ ok: true, inviteUrl: ownerStatusUrl(id, emailOrigin) });
      }

      if (action === 'list' || action === 'count') {
        const res = await ctx.databases.listDocuments(ctx.dbId, ctx.collectionId, [
          Query.orderDesc('$createdAt'),
          Query.limit(100),
        ]);
        const all = res.documents.map(rowToJoinRequest).filter((r): r is JoinRequest => !!r);
        const verified = all.filter((r) => !!r.verifiedAt);
        const unverifiedCount = all.filter(
          (r) => !r.verifiedAt && r.status === JOIN_REQUEST_STATUS.pending
        ).length;
        if (action === 'count') {
          return json({
            ok: true,
            pending: verified.filter((r) => r.status === JOIN_REQUEST_STATUS.pending).length,
            unverifiedCount,
          });
        }
        return json({ ok: true, requests: verified, unverifiedCount });
      }

      // decide
      const req = await loadRequest(ctx, id);
      if (!req) return NOT_FOUND();
      if (!req.verifiedAt) return json({ error: 'This applicant has not verified their email yet.' }, 409);

      const decision: JoinDecisionKey = (body?.decision as JoinDecisionKey) || 'approve';
      const question = String(body?.question || '').trim().slice(0, JOIN_REQUEST_LIMITS.question);

      let nextStatus: JoinRequestStatus = JOIN_REQUEST_STATUS.approved;
      if (decision === 'waitlist') nextStatus = JOIN_REQUEST_STATUS.waitlisted;
      else if (decision === 'needs_info') nextStatus = JOIN_REQUEST_STATUS.needs_info;
      else if (decision === 'reopen') nextStatus = JOIN_REQUEST_STATUS.pending;
      else if (String(decision).startsWith('decline_')) nextStatus = JOIN_REQUEST_STATUS.declined;

      await saveRow(ctx, id, {
        status: nextStatus,
        decisionKey: decision,
        stewardQuestion: decision === 'needs_info' ? question : req.stewardQuestion || '',
      });

      let emailSent = false;
      if (decision !== 'decline_silent' && decision !== 'reopen') {
        const mail = decisionEmail(req, decision, question, emailOrigin);
        emailSent = await sendApplicantEmail(ctx, req.email, mail.subject, mail.html);
      }
      return json({ ok: true, inviteUrl: ownerStatusUrl(id, emailOrigin), emailSent, status: nextStatus });
    }

    // -----------------------------------------------------------------------
    // Public: submit a new application
    // -----------------------------------------------------------------------
    if (action === 'submit') {
      if (!allowAttempt(request)) return json({ error: 'Too many requests today. Please try again tomorrow.' }, 429);

      // Bot traps answer with the same generic success so they learn nothing.
      const openedAt = Number(body?.formOpenedAt || 0);
      const elapsed = Date.now() - openedAt;
      if (
        String(body?.website || '').trim() ||
        !Number.isFinite(openedAt) ||
        elapsed < JOIN_REQUEST_POLICY.minFormTimeMs ||
        elapsed > 24 * 60 * 60 * 1000
      ) {
        return json({ ok: true, existing: true });
      }

      const f = cleanFields(body);
      if (!f.valid) {
        return json({ error: 'Please enter your name, a valid email, and pick at least one hat.' }, 400);
      }
      if (isDisposableEmail(f.email)) {
        return json({ error: 'Please use a permanent email address (not a temporary inbox).' }, 400);
      }

      const emailHash = hashEmail(f.email);
      const dup = await ctx.databases.listDocuments(ctx.dbId, ctx.collectionId, [
        Query.equal('emailHash', emailHash),
        Query.limit(1),
      ]);

      // Same email already applied: never touch the record; just re-send the owner their link (cooldown-limited).
      if (dup.total > 0) {
        const existing = rowToJoinRequest(dup.documents[0]);
        if (existing && cooldownRemaining(existing) === 0) {
          const mail = existing.verifiedAt ? statusLinkEmail(existing, emailOrigin) : verificationEmail(existing, emailOrigin);
          await sendApplicantEmail(ctx, existing.email, mail.subject, mail.html);
          await saveRow(ctx, existing.id, { lastEmailAt: new Date().toISOString() });
        }
        return json({ ok: true, existing: true });
      }

      const waiting = await ctx.databases.listDocuments(ctx.dbId, ctx.collectionId, [
        Query.equal('status', JOIN_REQUEST_STATUS.pending),
        Query.limit(1),
      ]);
      if (waiting.total >= JOIN_REQUEST_POLICY.maxUnreviewed) {
        return json({ error: 'We are not accepting new applications right now. Please check back soon.' }, 503);
      }

      const newId = `join_${randomBytes(14).toString('hex')}`;
      const now = new Date().toISOString();
      const row = {
        email: f.email,
        emailHash,
        name: f.name,
        hats: f.hats,
        niches: f.niches,
        socialUrl: f.socialUrl,
        note: f.note,
        status: JOIN_REQUEST_STATUS.pending,
        stewardQuestion: '',
        applicantReply: '',
        decisionKey: '',
        requestedAt: now,
        verifiedAt: '',
        lastEmailAt: now,
        remindedAt: '',
      };
      await ctx.databases.createDocument(ctx.dbId, ctx.collectionId, newId, row);
      const created = rowToJoinRequest({ ...row, $id: newId });
      if (created) {
        const mail = verificationEmail(created, emailOrigin);
        await sendApplicantEmail(ctx, created.email, mail.subject, mail.html);
      }
      return json({ ok: true, id: newId, statusUrl: viewerStatusUrl(newId, reqOrigin) });
    }

    // -----------------------------------------------------------------------
    // Public actions that act on one application (id + signed token)
    // -----------------------------------------------------------------------
    if (['status', 'verify', 'update', 'resend', 'reply', 'accept'].includes(action)) {
      const t = body?.t;
      const v = body?.v;
      const ownerOk = verifyJoinToken(id, 'verify', v);
      const viewOk = verifyJoinToken(id, 'view', t);
      // A valid verify token also proves access to the mailbox; otherwise a view token is required.
      if (!viewOk && !(action === 'verify' && ownerOk)) return NOT_FOUND();

      const req = await loadRequest(ctx, id);
      if (!req) return NOT_FOUND();

      if (action === 'status') return json({ ok: true, request: publicView(req, ownerOk) });

      if (action === 'verify') {
        if (!ownerOk) return NOT_FOUND();
        if (!req.verifiedAt && req.status === JOIN_REQUEST_STATUS.pending) {
          const verifiedAt = new Date().toISOString();
          await saveRow(ctx, id, { verifiedAt });
          await notifyStewards(ctx, { ...req, verifiedAt }, emailOrigin, false);
          return json({ ok: true, justVerified: true, request: publicView({ ...req, verifiedAt }, true) });
        }
        return json({ ok: true, justVerified: false, request: publicView(req, true) });
      }

      if (action === 'resend') {
        if (!allowAttempt(request)) return json({ error: 'Too many requests today.' }, 429);
        if (req.verifiedAt) return json({ error: 'Your email is already verified.' }, 400);
        const wait = cooldownRemaining(req);
        if (wait > 0) return json({ ok: false, cooldownRemainingMs: wait }, 429);
        const mail = verificationEmail(req, emailOrigin);
        await sendApplicantEmail(ctx, req.email, mail.subject, mail.html);
        const lastEmailAt = new Date().toISOString();
        await saveRow(ctx, id, { lastEmailAt });
        return json({ ok: true, cooldownRemainingMs: JOIN_REQUEST_POLICY.emailCooldownMs });
      }

      if (action === 'update') {
        const open = req.status === JOIN_REQUEST_STATUS.pending || req.status === JOIN_REQUEST_STATUS.waitlisted;
        if (!open) return json({ error: 'This application can no longer be edited.' }, 409);
        if (req.verifiedAt && !ownerOk) {
          return json({ error: 'Open the link from your verification email to edit a verified application.' }, 403);
        }
        const f = cleanFields(body);
        if (!f.valid) return json({ error: 'Please enter your name, a valid email, and pick at least one hat.' }, 400);

        const patch: Record<string, unknown> = {
          name: f.name,
          hats: f.hats,
          niches: f.niches,
          socialUrl: f.socialUrl,
          note: f.note,
        };
        let emailChanged = false;
        if (f.email !== req.email) {
          if (req.verifiedAt) return json({ error: 'Email cannot be changed after verification.' }, 409);
          if (isDisposableEmail(f.email)) return json({ error: 'Please use a permanent email address.' }, 400);
          const emailHash = hashEmail(f.email);
          const clash = await ctx.databases.listDocuments(ctx.dbId, ctx.collectionId, [
            Query.equal('emailHash', emailHash),
            Query.limit(1),
          ]);
          if (clash.total > 0) return json({ error: "That email can't be used for this application." }, 409);
          patch.email = f.email;
          patch.emailHash = emailHash;
          emailChanged = true;
        }
        if (emailChanged) patch.lastEmailAt = new Date().toISOString();
        await saveRow(ctx, id, patch);
        const updated = rowToJoinRequest({ ...req, ...patch, $id: id }) as JoinRequest;
        if (emailChanged) {
          const mail = verificationEmail(updated, emailOrigin);
          await sendApplicantEmail(ctx, updated.email, mail.subject, mail.html);
        }
        if (updated.verifiedAt) await notifyStewards(ctx, updated, emailOrigin, true);
        return json({ ok: true, request: publicView(updated, ownerOk) });
      }

      // reply / accept need proof of mailbox ownership (v)
      if (!ownerOk) return json({ error: 'Open the link from your email to continue.' }, 403);

      if (action === 'reply') {
        if (req.status !== JOIN_REQUEST_STATUS.needs_info) return json({ error: 'No question is waiting for an answer.' }, 409);
        const reply = String(body?.reply || '').trim().slice(0, JOIN_REQUEST_LIMITS.note);
        if (!reply) return json({ error: 'Please type your answer.' }, 400);
        await saveRow(ctx, id, { applicantReply: reply, status: JOIN_REQUEST_STATUS.pending });
        return json({
          ok: true,
          request: publicView({ ...req, applicantReply: reply, status: JOIN_REQUEST_STATUS.pending }, true),
        });
      }

      if (action === 'accept') {
        if (req.status !== JOIN_REQUEST_STATUS.approved) return json({ error: 'This invitation is not approved.' }, 409);
        await saveRow(ctx, id, { status: JOIN_REQUEST_STATUS.joined });
        return json({ ok: true });
      }
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (err: any) {
    console.error('[join-request]', action, err?.message || err);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
};

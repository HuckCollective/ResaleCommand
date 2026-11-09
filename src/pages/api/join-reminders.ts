import type { APIRoute } from 'astro';
import { Query } from 'node-appwrite';
import { getEnvVar } from '../../lib/appwriteEnv';
import { JOIN_REQUEST_POLICY, JOIN_REQUEST_STATUS, rowToJoinRequest, type JoinRequest } from '../../lib/joinRequests';
import { getJoinServerContext, sendApplicantEmail, verificationEmail } from '../../lib/joinRequestsServer';
import { siteConfig } from '../../site-config';

export const prerender = false;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

/**
 * Daily Vercel Cron: reminds unverified applicants once (after 24h) and silently archives
 * unverified applications after 7 days. Protected by `Authorization: Bearer $CRON_SECRET`
 * (Vercel adds this header automatically to cron calls when CRON_SECRET is set).
 */
export const GET: APIRoute = async ({ request }) => {
  const secret = getEnvVar('CRON_SECRET');
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const ctx = getJoinServerContext();
  if (!ctx) return json({ error: 'Appwrite is not configured.' }, 500);

  const res = await ctx.databases.listDocuments(ctx.dbId, ctx.collectionId, [
    Query.equal('status', JOIN_REQUEST_STATUS.pending),
    Query.limit(100),
  ]);

  let reminded = 0;
  let expired = 0;
  const now = Date.now();

  for (const doc of res.documents) {
    const req = rowToJoinRequest(doc) as JoinRequest | null;
    if (!req || req.verifiedAt) continue;
    const age = now - (Date.parse(req.requestedAt) || now);

    if (age >= JOIN_REQUEST_POLICY.expireUnverifiedAfterMs) {
      await ctx.databases.updateDocument(ctx.dbId, ctx.collectionId, req.id, {
        status: JOIN_REQUEST_STATUS.declined,
        decisionKey: 'expired_unverified',
      });
      expired++;
    } else if (age >= JOIN_REQUEST_POLICY.reminderAfterMs && !req.remindedAt) {
      const mail = verificationEmail(req, siteConfig.siteUrl, true);
      await sendApplicantEmail(ctx, req.email, mail.subject, mail.html);
      const stamp = new Date().toISOString();
      await ctx.databases.updateDocument(ctx.dbId, ctx.collectionId, req.id, { remindedAt: stamp, lastEmailAt: stamp });
      reminded++;
    }
  }

  return json({ ok: true, scanned: res.documents.length, reminded, expired });
};

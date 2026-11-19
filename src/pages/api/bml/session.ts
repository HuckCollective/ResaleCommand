import type { APIRoute } from 'astro';
import {
  BML_CORS_HEADERS,
  mintBookmarkletToken,
  requireBookmarkletMember,
  verifyAppwriteJwtToMember,
} from '../../../lib/bml/serverAuth';
import { capabilitiesForRole } from '../../../lib/memberAccess';

export const prerender = false;

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: BML_CORS_HEADERS });
};

/**
 * GET /api/bml/session — Verifies an existing Bookmarklet Bearer token (`Authorization: Bearer rcbml_v1...`)
 * or Appwrite JWT (`X-Appwrite-JWT`) and returns resolved role + capabilities.
 */
export const GET: APIRoute = async ({ request }) => {
  const auth = await requireBookmarkletMember(request);
  if (!auth.ok) {
    if (auth.response.status === 403) {
      const resolvedPrefix = auth.prefix || (auth.isConsignor ? 'BB-' : 'SWEAT-');
      const isConsignor = Boolean(auth.isConsignor);
      return new Response(
        JSON.stringify({
          ok: false,
          allowed: false,
          role: 'restricted',
          prefix: resolvedPrefix,
          isConsignor,
          capabilities: capabilitiesForRole('restricted', resolvedPrefix, {
            forceConsignor: isConsignor,
          }),
          message:
            '🔒 Founder or Curator Hat Required: Bookmarklets, Purchases, and Sales Ledger are restricted to Collective Founders (👑) and Curators (💎).',
        }),
        { status: 403, headers: BML_CORS_HEADERS }
      );
    }
    return auth.response;
  }

  return new Response(
    JSON.stringify({
      ok: true,
      allowed: true,
      member: auth.member,
      capabilities: capabilitiesForRole(auth.member.role, auth.member.prefix, {
        prefixStatus: auth.member.prefixStatus,
        requestedPrefix: auth.member.requestedPrefix,
        ownedPrefixes: auth.member.ownedPrefixes,
      }),
    }),
    { status: 200, headers: BML_CORS_HEADERS }
  );
};

/**
 * POST /api/bml/session — Exchanges an active Appwrite JWT (`X-Appwrite-JWT`) from `/bml/connect`
 * for a 14-day HMAC-SHA256 signed Bookmarklet Member Token (restricted to Founders 👑 and Curators 💎).
 */
export const POST: APIRoute = async ({ request }) => {
  const jwt = request.headers.get('X-Appwrite-JWT') || '';
  if (!jwt) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Missing X-Appwrite-JWT header.' }),
      { status: 401, headers: BML_CORS_HEADERS }
    );
  }

  const verified = await verifyAppwriteJwtToMember(jwt);
  if (!verified.ok) {
    const resolvedPrefix =
      verified.prefix || (verified.isConsignor ? 'BB-' : 'SWEAT-');
    const isConsignor = Boolean(verified.isConsignor);
    return new Response(
      JSON.stringify({
        ok: false,
        allowed: false,
        role: verified.status === 403 ? 'restricted' : undefined,
        prefix: verified.status === 403 ? resolvedPrefix : undefined,
        isConsignor: verified.status === 403 ? isConsignor : undefined,
        capabilities:
          verified.status === 403
            ? capabilitiesForRole('restricted', resolvedPrefix, {
                forceConsignor: isConsignor,
              })
            : undefined,
        error: verified.error,
        message: verified.message,
      }),
      { status: verified.status, headers: BML_CORS_HEADERS }
    );
  }

  const { token, session } = mintBookmarkletToken({
    userId: verified.member.userId,
    teamId: verified.member.teamId,
    name: verified.member.name,
    email: verified.member.email,
    prefix: verified.member.prefix,
    role: verified.member.role,
    roleBadge: verified.member.roleBadge,
  });

  return new Response(
    JSON.stringify({
      ok: true,
      allowed: true,
      token,
      member: session,
      capabilities: capabilitiesForRole(session.role, session.prefix),
    }),
    { status: 200, headers: BML_CORS_HEADERS }
  );
};

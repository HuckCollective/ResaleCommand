import type { APIRoute } from 'astro';
import {
  BML_CORS_HEADERS,
  mintBookmarkletToken,
  requireBookmarkletMember,
  verifyAppwriteJwtToMember,
} from '../../../lib/bml/serverAuth';

export const prerender = false;

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: BML_CORS_HEADERS });
};

/**
 * GET /api/bml/session — Verifies an existing Bookmarklet Bearer token (`Authorization: Bearer rcbml_v1...`).
 */
export const GET: APIRoute = async ({ request }) => {
  const auth = await requireBookmarkletMember(request);
  if (!auth.ok) return auth.response;

  return new Response(
    JSON.stringify({
      ok: true,
      member: auth.member,
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
    return new Response(
      JSON.stringify({
        ok: false,
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
      token,
      member: session,
    }),
    { status: 200, headers: BML_CORS_HEADERS }
  );
};

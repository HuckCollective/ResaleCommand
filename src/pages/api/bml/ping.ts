import type { APIRoute } from 'astro';
import { BML_CORS_HEADERS, verifyBookmarkletToken } from '../../../lib/bml/serverAuth';

export const prerender = false;

const NO_STORE_CORS_HEADERS: Record<string, string> = {
  ...BML_CORS_HEADERS,
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: NO_STORE_CORS_HEADERS });
};

/**
 * Lightweight diagnostic ping endpoint for `🧪 BML Test` (`/scripts/bml-test.js`).
 * Confirms that a third-party page's Content-Security-Policy (`connect-src`) and CORS
 * allow `fetch()` calls back to Works@TheHC, and optionally echoes whether an attached
 * `rcbml_v1` Bearer token is valid. Never reads or stores third-party credentials.
 */
export const GET: APIRoute = async ({ request, url }) => {
  const bearer =
    request.headers.get('Authorization') ||
    request.headers.get('X-RC-BML-Token') ||
    url.searchParams.get('bmlToken') ||
    '';
  const verified = bearer ? verifyBookmarkletToken(bearer) : null;

  return new Response(
    JSON.stringify({
      ok: true,
      t: new Date().toISOString(),
      serverOrigin: url.origin,
      requestOrigin: request.headers.get('origin') || null,
      auth: verified
        ? {
            valid: true,
            name: verified.name,
            prefix: verified.prefix,
            role: verified.role,
            roleBadge: verified.roleBadge,
          }
        : {
            valid: false,
          },
    }),
    {
      status: 200,
      headers: NO_STORE_CORS_HEADERS,
    }
  );
};

import type { APIRoute } from 'astro';
import { loadPublicFlagshipBundle } from '../../../lib/flagshipContentServer';

export const prerender = false;

const PUBLIC_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: PUBLIC_CORS_HEADERS,
  });
};

/**
 * Public read-only Headless CMS feed for `https://thehc.llc` and in-app checkout Event Chips.
 * Constructs its own `Response` with `s-maxage=60` (never `jsonResponse()`'s `no-store`)
 * and exposes strictly zero internal user IDs, emails, or residential addresses.
 */
export const GET: APIRoute = async () => {
  const bundle = await loadPublicFlagshipBundle();
  return new Response(JSON.stringify(bundle), {
    status: 200,
    headers: {
      ...PUBLIC_CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600',
    },
  });
};

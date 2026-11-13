import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import { ALPHA_SITE_URL, siteConfig, SYNC_FALLBACK_ORIGINS } from '../../site-config';
import { buildInjectableBmlAuthRuntimeJs } from '../../lib/bml/clientCore';
import { loadServerBmlToolConfig } from '../../lib/bml/serverAuth';

export const prerender = false;

const CORS_NO_STORE_HEADERS = {
  'Content-Type': 'application/javascript; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-RC-BML-Token',
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: CORS_NO_STORE_HEADERS });
};

export const GET: APIRoute = async ({ url }) => {
  try {
    const bmlToolConfig = await loadServerBmlToolConfig('auction_scout');
    const scriptPath = path.join(process.cwd(), 'public', 'auction-scout-sync.user.js');
    const source = fs.readFileSync(scriptPath, 'utf-8');

    const activeOrigins = Array.from(new Set([url.origin, ALPHA_SITE_URL, ...SYNC_FALLBACK_ORIGINS]));
    const authRuntimeJs = buildInjectableBmlAuthRuntimeJs(activeOrigins, url.origin);

    const injectedBootstrap = `window.__RC_ORIGIN__ = ${JSON.stringify(url.origin)};\nwindow.__RC_ORIGINS__ = ${JSON.stringify(activeOrigins)};\nwindow.__RC_BML_TOOL_CONFIG__ = ${JSON.stringify(bmlToolConfig || null)};\n${authRuntimeJs}`;

    return new Response(injectedBootstrap + source, {
      status: 200,
      headers: CORS_NO_STORE_HEADERS,
    });
  } catch {
    const fallbackOrigin = url?.origin || siteConfig.siteUrl;
    const fallbackOrigins = Array.from(new Set([fallbackOrigin, ALPHA_SITE_URL, ...SYNC_FALLBACK_ORIGINS]));
    const fallbackAuth = buildInjectableBmlAuthRuntimeJs(fallbackOrigins, fallbackOrigin);
    const fallbackLoader = `${fallbackAuth}(function(){window.__RC_ORIGIN__=${JSON.stringify(fallbackOrigin)};var s=document.createElement('script');s.src=${JSON.stringify(fallbackOrigin)}+'/auction-scout-sync.user.js?t='+Date.now();document.body.appendChild(s);})();`;
    return new Response(fallbackLoader, {
      status: 200,
      headers: CORS_NO_STORE_HEADERS,
    });
  }
};

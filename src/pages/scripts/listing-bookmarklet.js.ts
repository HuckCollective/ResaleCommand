import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import { ALPHA_SITE_URL, BML_SCRIPT_VERSION, siteConfig, SYNC_FALLBACK_ORIGINS } from '../../site-config';
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

/** Reads `public/listing-assist.user.js` from disk when available (local dev). Returns null on Vercel Serverless (CDN serves public/). */
function readPublicScriptOrNull(fileName: string): string | null {
  const candidates = [
    path.join(process.cwd(), 'public', fileName),
    path.join(process.cwd(), 'dist', 'client', fileName),
    path.join(process.cwd(), '.vercel', 'output', 'static', fileName),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8');
    } catch {}
  }
  return null;
}

export const GET: APIRoute = async ({ url }) => {
  const origin = url?.origin || siteConfig.siteUrl;
  const activeOrigins = Array.from(new Set([origin, ALPHA_SITE_URL, ...SYNC_FALLBACK_ORIGINS].filter(Boolean)));

  let bmlToolConfig: any = null;
  try {
    bmlToolConfig = (await loadServerBmlToolConfig('listing_assist')) || null;
  } catch {}

  let authRuntimeJs = '';
  try {
    authRuntimeJs = buildInjectableBmlAuthRuntimeJs(activeOrigins, origin);
  } catch {}

  const injectedBootstrap = `window.__RC_BOOKMARKLET_CLICKED__ = true;\nwindow.__RC_BML_CLICK_SEQ__ = (window.__RC_BML_CLICK_SEQ__ || 0) + 1;\nwindow.__RC_BML_CLICK_TOOL__ = "listing_assist";\nwindow.__RC_ORIGIN__ = ${JSON.stringify(origin)};\nwindow.__RC_ORIGINS__ = ${JSON.stringify(activeOrigins)};\nwindow.__RC_BML_TOOL_CONFIG__ = ${JSON.stringify(bmlToolConfig)};\nwindow.__RC_SCRIPT_VERSION__ = ${JSON.stringify(BML_SCRIPT_VERSION)};\n${authRuntimeJs}\n`;

  const source = readPublicScriptOrNull('listing-assist.user.js');
  if (source) {
    return new Response(injectedBootstrap + source, { status: 200, headers: CORS_NO_STORE_HEADERS });
  }

  const cdnLoader = `(function(){var lv=window.__RC_LISTING_LIVE__;if(lv&&lv.version===${JSON.stringify(BML_SCRIPT_VERSION)}&&typeof lv.onBookmarkletClick==='function'){lv.onBookmarkletClick();return;}var h=${JSON.stringify(activeOrigins)},i=0;function l(){if(i>=h.length)return;var s=document.createElement('script');s.src=h[i++]+'/listing-assist.user.js?t='+Date.now();s.onerror=l;document.body.appendChild(s);}l();})();`;
  return new Response(injectedBootstrap + cdnLoader, { status: 200, headers: CORS_NO_STORE_HEADERS });
};

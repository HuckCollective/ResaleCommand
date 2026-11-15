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

/** Reads `public/auction-scout-sync.user.js` from disk when available (local dev / bundled FS). Returns null on Vercel Serverless (public/ lives on the CDN). */
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
  // Bootstrap globals are ALWAYS injected — independent of whether the script source can be read from disk.
  const origin = url?.origin || siteConfig.siteUrl;
  const activeOrigins = Array.from(new Set([origin, ALPHA_SITE_URL, ...SYNC_FALLBACK_ORIGINS].filter(Boolean)));

  let bmlToolConfig: any = null;
  try {
    bmlToolConfig = (await loadServerBmlToolConfig('auction_scout')) || null;
  } catch {}

  let authRuntimeJs = '';
  try {
    authRuntimeJs = buildInjectableBmlAuthRuntimeJs(activeOrigins, origin);
  } catch {}

  const injectedBootstrap = `window.__RC_BOOKMARKLET_CLICKED__ = true;\nwindow.__RC_BML_CLICK_SEQ__ = (window.__RC_BML_CLICK_SEQ__ || 0) + 1;\nwindow.__RC_BML_CLICK_TOOL__ = "auction_scout";\nwindow.__RC_ORIGIN__ = ${JSON.stringify(origin)};\nwindow.__RC_ORIGINS__ = ${JSON.stringify(activeOrigins)};\nwindow.__RC_BML_TOOL_CONFIG__ = ${JSON.stringify(bmlToolConfig)};\nwindow.__RC_SCRIPT_VERSION__ = ${JSON.stringify(BML_SCRIPT_VERSION)};\n${authRuntimeJs}\n`;

  const source = readPublicScriptOrNull('auction-scout-sync.user.js');
  if (source) {
    return new Response(injectedBootstrap + source, { status: 200, headers: CORS_NO_STORE_HEADERS });
  }

  // Vercel Serverless: short-circuit to in-page toggle if same version is already live; otherwise chain-load CDN copy.
  const cdnLoader = `(function(){var lv=window.__RC_SCOUT_LIVE__;if(lv&&lv.version===${JSON.stringify(BML_SCRIPT_VERSION)}&&typeof lv.onBookmarkletClick==='function'){lv.onBookmarkletClick();return;}var h=${JSON.stringify(activeOrigins)},i=0;function l(){if(i>=h.length)return;var s=document.createElement('script');s.src=h[i++]+'/auction-scout-sync.user.js?t='+Date.now();s.onerror=l;document.body.appendChild(s);}l();})();`;
  return new Response(injectedBootstrap + cdnLoader, { status: 200, headers: CORS_NO_STORE_HEADERS });
};

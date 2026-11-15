import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import {
  getLocationSettingMeta,
  resolveCanonicalLocationCode,
  resolveDefaultRicochetLocationMeta,
} from '../../lib/warehouses';
import { loadLiveWarehouseDocs } from '../../lib/locationSettingsServer';
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

/**
 * Thin live-loader: serves `public/ricochet-upc-sync.user.js` fresh on every open with only the active
 * location identity/settings (read from central Location Settings in `src/lib/warehouses.ts`) plus the
 * Universal Bookmarklet Member Auth runtime (`window.__RC_BML_AUTH__`).
 * No SKU/UPC dictionaries and no static JSON snapshots are baked into the script —
 * the userscript fetches live SKU/UPC data from `/api/md-verify-report` and captures Ricochet's native Export CSVs itself.
 */
/** Reads a `public/` script from disk when available. Returns null on Vercel Serverless (public/ lives on the CDN). */
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

  let liveWarehouses: any[] = [];
  let bmlToolConfig: any = null;
  try {
    // Fee / rent resolve from the live Appwrite `warehouses` document for this location code (not static code)
    [liveWarehouses, bmlToolConfig] = await Promise.all([
      loadLiveWarehouseDocs().catch(() => []),
      loadServerBmlToolConfig('ricochet_sync').catch(() => null),
    ]);
  } catch {}

  const defaultRicoMeta = resolveDefaultRicochetLocationMeta(liveWarehouses);
  const rawLocParam = url.searchParams.get('location');
  const resolvedParam = rawLocParam ? resolveCanonicalLocationCode(rawLocParam, liveWarehouses) : '';
  const locCode = (resolvedParam || defaultRicoMeta.code).toUpperCase();
  const locMeta = getLocationSettingMeta(locCode, liveWarehouses);

  let authRuntimeJs = '';
  try {
    authRuntimeJs = buildInjectableBmlAuthRuntimeJs(activeOrigins, origin);
  } catch {}

  const injectedBootstrap = `window.__RC_BOOKMARKLET_CLICKED__ = true;\nwindow.__RC_ORIGIN__ = ${JSON.stringify(origin)};\nwindow.__RC_ORIGINS__ = ${JSON.stringify(activeOrigins)};\nwindow.__RC_BML_TOOL_CONFIG__ = ${JSON.stringify(bmlToolConfig || null)};\nwindow.__RC_SCRIPT_VERSION__ = ${JSON.stringify(BML_SCRIPT_VERSION)};\nwindow.__RC_ACTIVE_LOCATION_CODE__ = ${JSON.stringify(locCode)};\nwindow.__RC_ACTIVE_LOCATION_META__ = ${JSON.stringify({
    code: locMeta.code,
    name: locMeta.shortName,
    fullName: locMeta.name,
    icon: locMeta.icon,
    skuPrefix: locMeta.skuPrefix,
    usesRicochet: locMeta.usesRicochet,
    commissionRate: locMeta.commissionRate,
    feePct: locMeta.feePct,
    monthlyRent: locMeta.monthlyRent,
  })};\n${authRuntimeJs}\n`;

  const source = readPublicScriptOrNull('ricochet-upc-sync.user.js');
  if (source) {
    return new Response(injectedBootstrap + source, { status: 200, headers: CORS_NO_STORE_HEADERS });
  }

  // Vercel Serverless: script lives on the Edge CDN → globals are injected above, then chain-load the CDN copy.
  const cdnLoader = `(function(){var h=${JSON.stringify(activeOrigins)},i=0;function l(){if(i>=h.length)return;var s=document.createElement('script');s.src=h[i++]+'/ricochet-upc-sync.user.js?t='+Date.now();s.onerror=l;document.body.appendChild(s);}l();})();`;
  return new Response(injectedBootstrap + cdnLoader, { status: 200, headers: CORS_NO_STORE_HEADERS });
};

import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import {
  getLocationSettingMeta,
  resolveCanonicalLocationCode,
  resolveDefaultRicochetLocationMeta,
} from '../../lib/warehouses';
import { loadLiveWarehouseDocs } from '../../lib/locationSettingsServer';
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

/**
 * Thin live-loader: serves `public/ricochet-upc-sync.user.js` fresh on every open with only the active
 * location identity/settings (read from central Location Settings in `src/lib/warehouses.ts`) plus the
 * Universal Bookmarklet Member Auth runtime (`window.__RC_BML_AUTH__`).
 * No SKU/UPC dictionaries and no static JSON snapshots are baked into the script —
 * the userscript fetches live SKU/UPC data from `/api/md-verify-report` and captures Ricochet's native Export CSVs itself.
 */
export const GET: APIRoute = async ({ url }) => {
  try {
    // Fee / rent resolve from the live Appwrite `warehouses` document for this location code (not static code)
    const [liveWarehouses, bmlToolConfig] = await Promise.all([
      loadLiveWarehouseDocs(),
      loadServerBmlToolConfig('ricochet_sync'),
    ]);
    const defaultRicoMeta = resolveDefaultRicochetLocationMeta(liveWarehouses);
    const rawLocParam = url.searchParams.get('location');
    const resolvedParam = rawLocParam ? resolveCanonicalLocationCode(rawLocParam, liveWarehouses) : '';
    const locCode = (resolvedParam || defaultRicoMeta.code).toUpperCase();
    const locMeta = getLocationSettingMeta(locCode, liveWarehouses);
    const scriptPath = path.join(process.cwd(), 'public', 'ricochet-upc-sync.user.js');
    const source = fs.readFileSync(scriptPath, 'utf-8');

    const activeOrigins = Array.from(new Set([url.origin, ALPHA_SITE_URL, ...SYNC_FALLBACK_ORIGINS]));
    const authRuntimeJs = buildInjectableBmlAuthRuntimeJs(activeOrigins, url.origin);

    const injectedBootstrap = `window.__RC_ORIGIN__ = ${JSON.stringify(url.origin)};\nwindow.__RC_ORIGINS__ = ${JSON.stringify(activeOrigins)};\nwindow.__RC_BML_TOOL_CONFIG__ = ${JSON.stringify(bmlToolConfig || null)};\nwindow.__RC_ACTIVE_LOCATION_CODE__ = ${JSON.stringify(locCode)};\nwindow.__RC_ACTIVE_LOCATION_META__ = ${JSON.stringify({
      code: locMeta.code,
      name: locMeta.shortName,
      fullName: locMeta.name,
      icon: locMeta.icon,
      skuPrefix: locMeta.skuPrefix,
      usesRicochet: locMeta.usesRicochet,
      commissionRate: locMeta.commissionRate,
      feePct: locMeta.feePct,
      monthlyRent: locMeta.monthlyRent,
    })};\n${authRuntimeJs}`;

    return new Response(injectedBootstrap + source, {
      status: 200,
      headers: CORS_NO_STORE_HEADERS,
    });
  } catch (err: any) {
    const fallbackOrigin = url?.origin || siteConfig.siteUrl;
    const fallbackOrigins = Array.from(new Set([fallbackOrigin, ALPHA_SITE_URL, ...SYNC_FALLBACK_ORIGINS]));
    const fallbackAuth = buildInjectableBmlAuthRuntimeJs(fallbackOrigins, fallbackOrigin);
    const fallbackLoader = `${fallbackAuth}(function(){window.__RC_ORIGIN__=${JSON.stringify(fallbackOrigin)};var s=document.createElement('script');s.src=${JSON.stringify(fallbackOrigin)}+'/ricochet-upc-sync.user.js?t='+Date.now();document.body.appendChild(s);})();`;
    return new Response(fallbackLoader, {
      status: 200,
      headers: CORS_NO_STORE_HEADERS,
    });
  }
};

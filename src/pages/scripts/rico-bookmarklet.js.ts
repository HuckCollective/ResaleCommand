import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import {
  getLocationSettingMeta,
  resolveCanonicalLocationCode,
  resolveDefaultRicochetLocationMeta,
} from '../../lib/warehouses';

export const prerender = false;

const CORS_NO_STORE_HEADERS = {
  'Content-Type': 'application/javascript; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: CORS_NO_STORE_HEADERS });
};

/**
 * Thin live-loader: serves `public/ricochet-upc-sync.user.js` fresh on every open with only the active
 * location identity/settings (read from central Location Settings in `src/lib/warehouses.ts`).
 * No SKU/UPC dictionaries and no static JSON snapshots are baked into the script —
 * the userscript fetches live SKU/UPC data from `/api/md-verify-report` and captures Ricochet's native Export CSVs itself.
 */
export const GET: APIRoute = async ({ url }) => {
  try {
    const defaultRicoMeta = resolveDefaultRicochetLocationMeta();
    const rawLocParam = url.searchParams.get('location');
    const resolvedParam = rawLocParam ? resolveCanonicalLocationCode(rawLocParam) : '';
    const locCode = (resolvedParam || defaultRicoMeta.code).toUpperCase();
    const locMeta = getLocationSettingMeta(locCode);
    const scriptPath = path.join(process.cwd(), 'public', 'ricochet-upc-sync.user.js');
    const source = fs.readFileSync(scriptPath, 'utf-8');

    const injectedBootstrap = `window.__RC_ACTIVE_LOCATION_CODE__ = ${JSON.stringify(locCode)};\nwindow.__RC_ACTIVE_LOCATION_META__ = ${JSON.stringify({
      code: locMeta.code,
      name: locMeta.shortName,
      fullName: locMeta.name,
      icon: locMeta.icon,
      skuPrefix: locMeta.skuPrefix,
      usesRicochet: locMeta.usesRicochet,
      commissionRate: locMeta.commissionRate,
      feePct: locMeta.feePct,
      monthlyRent: locMeta.monthlyRent,
    })};\n`;

    return new Response(injectedBootstrap + source, {
      status: 200,
      headers: CORS_NO_STORE_HEADERS,
    });
  } catch (err: any) {
    const fallbackLoader = `(function(){var s=document.createElement('script');s.src='https://resalecmd.com/ricochet-upc-sync.user.js?t='+Date.now();document.body.appendChild(s);})();`;
    return new Response(fallbackLoader, {
      status: 200,
      headers: CORS_NO_STORE_HEADERS,
    });
  }
};

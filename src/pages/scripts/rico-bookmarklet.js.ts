import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';

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

export const GET: APIRoute = async () => {
  try {
    const scriptPath = path.join(process.cwd(), 'public', 'ricochet-upc-sync.user.js');
    const source = fs.readFileSync(scriptPath, 'utf-8');
    return new Response(source, {
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


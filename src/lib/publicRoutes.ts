/**
 * Single source of truth for which PAGE routes are reachable without an account.
 * Used by BOTH the server middleware (src/middleware.ts) and the client session
 * guard (initAuth in src/lib/store.ts). Everything NOT listed here is member-only
 * (default-deny). API routes are guarded individually and bypass this list.
 */
export const PUBLIC_EXACT_PATHS: ReadonlySet<string> = new Set([
  '/',
  '/coop',
  '/coop/charter',
  '/scout', // Guest Preview Mode when logged out (limited, see ScoutView.vue)
  '/login',
  '/logout',
  '/join',
  '/signup',
  '/404',
]);

export const PUBLIC_PREFIXES: readonly string[] = [
  '/subsite', // public customer storefront (tenant rewrite target)
  '/scripts/', // live-loader bookmarklet served to the Ricochet domain
  '/_astro',
  '/_server-islands',
  '/_image',
];

const STATIC_FILE_RE = /\.[a-z0-9]{2,5}$/i;

export function isPublicPagePath(pathname: string): boolean {
  if (!pathname) return false;
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (PUBLIC_EXACT_PATHS.has(clean)) return true;
  if (PUBLIC_PREFIXES.some((p) => clean === p || clean.startsWith(p.endsWith('/') ? p : p + '/'))) {
    return true;
  }
  // Static assets (favicon.svg, robots.txt, sitemap-index.xml, *.js, images...)
  return STATIC_FILE_RE.test(clean);
}

export function buildLoginRedirect(pathname: string, search = ''): string {
  return `/login?redirect=${encodeURIComponent(pathname + search)}`;
}

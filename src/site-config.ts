// Central Brand & Multi-Domain Single Source of Truth (Works@TheHC / The Huckleberry Collective)
const readEnv = (key: string): string =>
  (typeof import.meta !== "undefined" && (import.meta.env as Record<string, string | undefined>)?.[key]) ||
  (typeof process !== "undefined" && process.env?.[key]) ||
  "";

const envSiteUrl = readEnv("PUBLIC_SITE_URL") || "https://works.thehc.llc";
const envBrandName = readEnv("PUBLIC_BRAND_NAME") || "Works@TheHC";

// Every origin the app answers on (bookmarklet/userscript failover order + "primary app host" check).
// Override with PUBLIC_SITE_ORIGINS="https://a.example,https://b.example" — no code change needed for a new domain.
const DEFAULT_SITE_ORIGINS = [
  "https://works.thehc.llc",
  "https://works.thehc.coop",
  "https://www.resalecmd.com",
  "https://resalecmd.com",
];
const envOrigins = readEnv("PUBLIC_SITE_ORIGINS")
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);

export const SYNC_FALLBACK_ORIGINS: readonly string[] = envOrigins.length ? envOrigins : DEFAULT_SITE_ORIGINS;

// Root domain whose subdomains are tenant sites (e.g. retro.<root>); www/alpha/dev/etc. stay on the main app.
export const TENANT_ROOT_DOMAIN = readEnv("PUBLIC_TENANT_ROOT_DOMAIN") || "resalecmd.com";

// Alpha/QA deployment (branch preview) used in internal QA prompts.
export const ALPHA_SITE_URL = (readEnv("PUBLIC_ALPHA_SITE_URL") || `https://alpha.${TENANT_ROOT_DOMAIN}`).replace(/\/+$/, "");

export const siteConfig = {
  title: envBrandName,
  shortTitle: "The Works",
  badgeText: "@TheHC",
  fullName: "The Huckleberry Works",
  organization: "The Huckleberry Collective",
  legalEntity: "Huckleberry Collective LLC",
  parentSiteUrl: "https://thehc.llc",
  futureCoopSiteUrl: "https://works.thehc.coop",
  tagline: "Where the collective builds, sources, and operates.",
  subtitle: "Cooperative Operations & Inventory",
  description:
    "Works@TheHC (The Huckleberry Works) — Where The Huckleberry Collective builds, sources, and operates multi-channel resale, booth sync, and cooperative settlements.",
  siteUrl: envSiteUrl.replace(/\/+$/, ""),
  fallbackOrigins: SYNC_FALLBACK_ORIGINS,
  tenantRootDomain: TENANT_ROOT_DOMAIN,
  alphaSiteUrl: ALPHA_SITE_URL,
  githubRepo: "webvpro/resale-command",
};

// Navigation menu items
export const nav = [
  {
    text: "Dashboard",
    url: "/",
  },
  {
    text: "Inventory",
    url: "/inventory",
  },
];

// Central Brand & Multi-Domain Single Source of Truth (Works@TheHC / The Huckleberry Collective)
const envSiteUrl =
  (typeof import.meta !== "undefined" && import.meta.env?.PUBLIC_SITE_URL) ||
  (typeof process !== "undefined" && process.env?.PUBLIC_SITE_URL) ||
  "https://works.thehc.llc";

const envBrandName =
  (typeof import.meta !== "undefined" && import.meta.env?.PUBLIC_BRAND_NAME) ||
  (typeof process !== "undefined" && process.env?.PUBLIC_BRAND_NAME) ||
  "Works@TheHC";

export const SYNC_FALLBACK_ORIGINS = [
  "https://works.thehc.llc",
  "https://works.thehuckleberry.coop",
  "https://www.resalecmd.com",
  "https://resalecmd.com",
] as const;

export const siteConfig = {
  title: envBrandName,
  shortTitle: "The Works",
  badgeText: "@TheHC",
  fullName: "The Huckleberry Works",
  organization: "The Huckleberry Collective",
  legalEntity: "Huckleberry Collective LLC",
  parentSiteUrl: "https://thehc.llc",
  futureCoopSiteUrl: "https://works.thehuckleberry.coop",
  tagline: "Where the collective builds, sources, and operates.",
  subtitle: "Cooperative Operations & Inventory",
  description:
    "Works@TheHC (The Huckleberry Works) — Where The Huckleberry Collective builds, sources, and operates multi-channel resale, booth sync, and cooperative settlements.",
  siteUrl: envSiteUrl.replace(/\/+$/, ""),
  fallbackOrigins: SYNC_FALLBACK_ORIGINS,
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

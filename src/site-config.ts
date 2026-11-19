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

// Bookmarklet/userscript runtime version — shown as `v4.6 • <host>` in the tray header so stale tabs are obvious.
export const BML_SCRIPT_VERSION = "v4.6";

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
    "Works@TheHC (The Huckleberry Works) — Where The Huckleberry Collective builds, sources, and operates multi-channel sales across online marketplaces, live drops, pop-ups & hosted events, retail booths, and cooperative settlements.",
  siteUrl: envSiteUrl.replace(/\/+$/, ""),
  fallbackOrigins: SYNC_FALLBACK_ORIGINS,
  tenantRootDomain: TENANT_ROOT_DOMAIN,
  alphaSiteUrl: ALPHA_SITE_URL,
  githubRepo: "webvpro/resale-command",
  supportEmail: "hello@thehc.llc",

  // Configurable Social Thumbnails (Open Graph / Discord / iMessage / Twitter Cards & On-Page Share Cards)
  socialMeta: {
    defaultImage: "/images/mt-hoodoutline-sign.png",
    defaultImageAlt: "The Huckleberry Collective — Multi-Channel Vintage, Events, Online Drops & Works@TheHC",
    logoImage: "/images/badge-qr-sticker-fullname.png",
    themeColor: "#D4672A",
    pages: {
      home: {
        title: "The Huckleberry Collective | PNW Co-op, Live Drops, Events & Works@TheHC",
        description:
          "The Huckleberry Collective is a Pacific Northwest cooperative powering online drops, live auctions, pop-ups & community events, Portland retail booths, and The Works (works.thehc.llc).",
        image: "/images/mt-hoodoutline-sign.png",
        imageAlt: "The Huckleberry Collective — Built on the road, rooted in the PNW",
      },
      works: {
        title: "The Huckleberry Works (Works@TheHC) — Multi-Channel Sales, Events & Co-op OS",
        description:
          "AI Quick Scout, Multi-Item Photo Slicer, Online + Pop-Up + Event Checkout, Retail Booth Sync & Democratic 70/30 Co-op OS at works.thehc.llc.",
        image: "/images/mt-hoodoutline-sign.png",
        badgeImage: "/images/SpaceHCBadge.png",
        imageAlt: "The Huckleberry Works (Works@TheHC) — From Haul to Every Way We Sell",
        shareUrl: "https://works.thehc.llc",
        shareText:
          "Explore Works@TheHC by The Huckleberry Collective — Multi-Channel Sales, Pop-Ups & Events, AI Quick Scout & 70/30 Co-op OS:",
      },
      huckfinds: {
        title: "HuckFinds & Huck's Adventures Outfitter | The Huckleberry Collective",
        description:
          "HuckFinds is the multi-channel reselling & Adventurer Outfitter arm of The Huckleberry Collective—shop our live online drops, Portland pop-ups & partner events, or Booth #0EJ at The Memory Den.",
        image: "/images/hucks-sign.png",
        imageAlt: "HuckFinds & Huck's Adventures Outfitter — Online Drops, Pop-Ups & Booth #0EJ",
      },
    },
  },

  socialProfiles: [
    "https://works.thehc.llc",
    "https://www.tiktok.com/@stormbringer288",
    "https://www.instagram.com/huckleberryfind",
    "https://www.facebook.com/profile.php?id=61588276871946",
    "https://www.youtube.com/channel/UCcfa92ZxvDRqyOLmZtoW1Vw",
    "https://whatnot.com/invite/huckfinds",
    "https://www.depop.com/huckfinds/",
    "https://district.net/u/pdxstormbringer",
  ],
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

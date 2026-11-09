---
name: huckleberry-brand-and-domain-identity
description: Canonical brand architecture, nomenclature ('The Works' / 'Works@TheHC' / 'The Huckleberry Collective'), 3-tier multi-domain failover standard (works.thehc.llc, works.thehuckleberry.coop, resalecmd.com), and Google Workspace (@thehc.llc) Appwrite SMTP configuration. Use whenever touching siteConfig, headers, SEO metadata, bookmarklets, or domain/email settings.
---

# Huckleberry Brand & Multi-Domain Identity Standard (`Works@TheHC`)

## 1. Brand Hierarchy & Nomenclature

All brand strings resolve from [`src/site-config.ts`](file:///c:/Users/15034/Projects/ResaleCommand/src/site-config.ts)—never hardcode legacy `"Resale Command"` in UI templates, emails, or metadata.

| Role | Value | Usage |
| :--- | :--- | :--- |
| **Short App Name (`siteConfig.shortTitle`)** | `The Works` | Navbar primary text (`The Works` + `@TheHC` badge) |
| **Compact Handle (`siteConfig.title`)** | `Works@TheHC` | Browser tab `<title>`, OpenGraph, toast & email headers |
| **Full Workshop Name (`siteConfig.fullName`)** | `The Huckleberry Works` | Formal sign-in & SMTP sender display name |
| **Parent Cooperative (`siteConfig.organization`)** | `The Huckleberry Collective` | Public charter (`/coop`), WSDE governance, partner statements |
| **Legal Entity (`siteConfig.legalEntity`)** | `Huckleberry Collective LLC` | Footer copyright, tax/expense ledgers, Google Cloud billing |
| **Tagline (`siteConfig.tagline`)** | *"Where the collective builds, sources, and operates."* | Hero & SEO description |
| **Sign-in Subtitle (`siteConfig.subtitle`)** | *"Cooperative Operations & Inventory"* | `/login` subtitle |

---

## 2. Multi-Domain Roadmap & Failover Invariant (`.llc` ➔ `.coop` ➔ `.com`)

Our cooperative operates across a 3-tier domain lifecycle:
1. **Active Production Domain (`.llc`):** `https://works.thehc.llc` (Parent site: `https://thehc.llc`)
2. **Future Cooperative Registry Domain (`.coop` via DotCoop / NCBA CLUSA):** `https://works.thehuckleberry.coop` (Parent site: `https://thehuckleberry.coop`)
3. **Legacy Fallback Domain (`.com`):** `https://resalecmd.com` (`https://www.resalecmd.com`)

### The Multi-Domain Bookmarklet & Userscript Law
- Every bookmarklet (`bookmarkletHref` in [`LocationSyncView.vue`](file:///c:/Users/15034/Projects/ResaleCommand/src/components/warehouses/LocationSyncView.vue)) and userscript ([`public/ricochet-upc-sync.user.js`](file:///c:/Users/15034/Projects/ResaleCommand/public/ricochet-upc-sync.user.js)) MUST use an ordered multi-origin failover list:
  `[window.__RC_ORIGIN__, 'https://works.thehc.llc', 'https://works.thehuckleberry.coop', 'https://www.resalecmd.com', 'https://resalecmd.com']`
- [`src/pages/scripts/rico-bookmarklet.js.ts`](file:///c:/Users/15034/Projects/ResaleCommand/src/pages/scripts/rico-bookmarklet.js.ts) dynamically injects `window.__RC_ORIGIN__ = url.origin` on every request so whichever domain served the bookmarklet is always tried first, and if a domain ever changes or redirects, `s.onerror` automatically loads from the next domain without any user ever needing to re-drag their bookmarklet.

---

## 3. Domain & Google Workspace (`@thehc.llc`) SMTP Reference Checklist

1. **Porkbun DNS (`thehc.llc`):**
   - `CNAME` record: Host `works` ➔ `cname.vercel-dns.com`.
   - **Never** click `"Setup Now"` on Porkbun's Email Hosting banner—`@thehc.llc` uses **Google Workspace** `MX` records.
2. **Vercel Domains:**
   - Keep `works.thehc.llc`, `resalecmd.com`, and future `works.thehuckleberry.coop` attached to the Vercel project.
3. **Appwrite Console (`sfo.cloud.appwrite.io`) ➔ Overview ➔ Platforms (Web App):**
   - Register every active hostname (`works.thehc.llc`, `resalecmd.com`, and `works.thehuckleberry.coop`) so Appwrite session cookies and CORS work on all domains simultaneously.
4. **Appwrite Google Workspace SMTP (`smtp.gmail.com`):**
   - Generate a 16-character App Password at `https://myaccount.google.com/apppasswords` under your `@thehc.llc` Google Workspace account.
   - Configure in **BOTH**:
     - **Appwrite Settings ➔ SMTP** (System Auth, password recovery, invites): Host `smtp.gmail.com`, Port `465` (`SSL`), Username `you@thehc.llc`, Password `<16-char App Password>`, Sender Name `The Works @ TheHC`.
     - **Appwrite Messaging ➔ Providers ➔ SMTP** (Powers [`/api/join-request.ts`](file:///c:/Users/15034/Projects/ResaleCommand/src/pages/api/join-request.ts) applicant & `coop-founders` topic emails).


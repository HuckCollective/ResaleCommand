---
trigger: glob
globs: "**/public/*.user.js, **/src/pages/scripts/*.ts, **/src/lib/bml/**/*.ts"
description: "ES5 bookmarklet safety, clientCore.ts Pill-to-100dvh Frozen-Top Drawer shell, 3-domain failover, and Physical Retail Tag Safety Laws."
---

# Bookmarklet ES5, Shared Shell (`clientCore.ts`) & Retail Tag Safety Guardrails

1. **Strict ES5 Syntax in `public/*.user.js` (`validate-templates.mjs` §10):**
   - `public/ricochet-upc-sync.user.js` and `public/auction-scout-sync.user.js` run directly inside third-party retail/auction DOMs without transpilation.
   - Use strict ES5 (`var`, `function () {}`, string concatenation) — avoid modern syntax or unguarded browser APIs that fail `validate-templates.mjs` §10, and **NEVER** call `window.alert()`, `window.confirm()`, or `window.prompt()` (render inline drawers, banners, and two-click confirmation pills).

2. **Canonical Shared BML Shell (`src/lib/bml/clientCore.ts`):**
   - Both bookmarklets MUST load via thin evergreen live-loaders (`/scripts/rico-bookmarklet.js?location=${code}&t=` and `/scripts/auction-bookmarklet.js?t=`) with **3-tier multi-domain failover**: `https://works.thehc.llc` ➔ `https://works.thehc.coop` ➔ `https://resalecmd.com`. Never bake static JSON or single-origin `resalecmd.com` URLs into bookmarklet `href`s.
   - **Mutually-Exclusive Shell Geometry**:
     - **Collapsed**: Compact bottom-right floating **Pill Bar** (`z-index: 2147483646`).
     - **Expanded**: Full-height **`100dvh` Right-Side Slide-Over Drawer** (`top: 0; right: 0; bottom: 0`) with a **Frozen Sticky Top Header** (`.rc-bml-drawer-header`) and scrollable `.rc-bml-drawer-body`. While the Drawer is open, the floating Pill MUST hide (`display: none`).
   - **URL-Driven 1st Click & SPA Tracking**: Auto-detect page context on 1st click (`/products` ➔ Catalog Sync, `/payouts` ➔ Sales Harvest; single lot vs. catalog grid on Auction Scout) and re-evaluate route changes via `watchSpaLocation()`.

3. **The 3 Physical Retail Tag Safety Laws (`ricochet-upc-sync.user.js`):**
   - **Law #1 (Blank-Only Auto-Fill)**: `🚀 Fill Missing` MUST ONLY count and write to items where Ricochet's current UPC is genuinely blank (`verifyStatus === 'MISSING_IN_MD'`). NEVER overwrite `MISMATCH_UPC`, and abort `PUT /api/product/items` if `GET /api/product/show/{id}` shows `targetItem.upc_code` is already non-empty.
   - **Law #2 (Mandatory Pre-Flight Queue Preview)**: Always render `#rc-preflight-details` listing the exact `N` blank items (`0EJ... | Blank ➔ HUCK-XXXX | 🏷️ Pre-Tagged vs 🆕 Virtual (9740+)`) before running `🚀 Fill Missing (N)`.
   - **Law #3 (Physical Sticker Wins / 1-Click `🏷️ Adopt Booth Tag`)**: For `MISMATCH_UPC`, offer 1-click `🏷️ Adopt Booth Tag ([mdUpc])` (`POST /api/md-verify-report` `mode: 'adopt_md_upc'`) so physical shelf stickers at the booth never have to be reprinted.

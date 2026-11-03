---
name: resale-booth-sync
description: Memory Den (#0EJ) & Ricochet POS 2-way barcode sync, Evergreen Live-Loader bookmarklet architecture, 1-to-1 0EJ SKU <-> UPC bijection, Physical Retail Tag Safety Laws (Zero Overwrite of Existing Booth Barcodes, Pre-Flight Queue Preview, 1-Click Adopt Booth Tag), High-Confidence UX Pro Reconciliation, multi-partner bucketing (HUCK / PDXGL / B&B), and UX/IA empathy guardrails.
---

# Resale Booth Sync & UX/IA Empathy Guardrails (`resale-booth-sync`)

This skill governs all 2-way catalog & barcode synchronization between **Resale Command** (`resalecmd.com`) and retail booth POS systems (specifically **Memory Den Booth `#0EJ`** on `memoryden.ricoconsign.com`), along with mandatory UX & Information Architecture Empathy Guardrails and **Physical Retail Tag Safety Laws**.

---

## 1. Physical Booth Tag & Production Safety Guardrails (The 3 Physical Retail Tag Laws)

In physical retail booth operations, a barcode (`HUCK-XXXX`, `PDXGL-XXXX`, `BB-XXXX`) is **NOT** a disposable virtual database ID—it is a **physical thermal sticker printed and attached to a price tag on a shelf at Memory Den**. Treating physical booth barcodes like virtual IDs breaks register scanning at the mall! Every AI agent, script, and sync tool MUST obey these 3 laws without exception:

1. **Law #1 — Never Auto-Overwrite an Existing Barcode in Ricochet (`MISSING_IN_MD` Only, Never `MISMATCH_UPC`)**:
   - The `🚀 Fill Missing` batch action in [`public/ricochet-upc-sync.user.js`](file:///c:/Users/15034/Projects/ResaleCommand/public/ricochet-upc-sync.user.js) must **STRICTLY** filter to items where Ricochet's current UPC is genuinely blank (`verifyStatus === 'MISSING_IN_MD'`, i.e., `!mdUpc`).
   - It must **NEVER** count or overwrite an item that already has a non-blank barcode in Ricochet (`verifyStatus === 'MISMATCH_UPC'`), and must also perform a deep variant guard after `GET /api/product/show/{id}` so that if `targetItem.upc_code` is already populated in Ricochet, the `PUT /api/product/items` overwrite is aborted and logged as protected.
   - If `14` items are `Missing UPC` and `1` item is `Mismatch`, the button MUST say `🚀 Fill Missing (14)` — **never** `(15)`.

2. **Law #2 — Mandatory Visible Pre-Flight Queue Preview Before Any Production Sync**:
   - Never ask the user to click a blind batch button in production.
   - Whenever `missingInMd > 0`, the Memory Den widget (`#rc-preflight-details`) must render a visible, scrollable **Pre-Flight Queue Preview** listing the exact `N` items queued (`0EJ... | Blank ➔ HUCK-XXXX | Title | In Stock/Sold`) and explicitly badging each target barcode's physical origin:
     - `🏷️ Pre-Tagged` (`HUCK-0001..9739`, `PDXGL-`, `BB-`): Existing inventory barcode from your collection.
     - `🆕 Virtual (9740+)`: Newly minted virtual barcode from database reconciliation (safe to write to Ricochet if the booth tag has no HUCK barcode sticker; if the item at the booth already has a physical `HUCK-XXXX` sticker attached, adopt that physical sticker instead).

3. **Law #3 — Physical Sticker Wins (`🏷️ Adopt Booth Tag ([mdUpc]) in RC`), Clean 4-Digit `HUCK-XXXX` Standard, & On-the-Fly Phone Booth Additions**:
   - Whenever an item has `verifyStatus === 'MISMATCH_UPC'` (Ricochet has `mdUpc` on the booth tag while Resale Command DB has `expectedRcUpc`), the physical tag at the booth is the source of truth unless proven to be a duplicate collision.
   - Both the Memory Den widget (`#rc-mismatch-box` in `public/ricochet-upc-sync.user.js`) and [`LocationSyncView.vue`](file:///c:/Users/15034/Projects/ResaleCommand/src/components/warehouses/LocationSyncView.vue) provide a 1-click **`🏷️ Adopt Booth Tag ([mdUpc])`** button (`POST /api/md-verify-report` with `{ mode: 'adopt_md_upc', sku, mdUpc }`) that updates `resale_db.items`, `md_live_payload_latest`, and `md_verify_report_latest` to match Ricochet's existing physical barcode so no tag at the booth ever needs to be reprinted or re-stickered.
   - **Clean 4-Digit `HUCK-XXXX` Standard (No `-A`/`-B`/`-C` Suffixes)**: Split-lot children and booth items must ALWAYS receive a clean sequential 4-digit `HUCK-XXXX` barcode (using `parentLotId` for lot lineage, never `-A`/`-B`/`-C` suffixes). Historical `Sold`/`Paid` (`Qty: 0`) items linked in Resale Command are always classified as `VERIFIED_MATCH` (never `MISMATCH_UPC`) since they have already left the physical shelf.
   - **On-the-Fly Phone Booth Additions**: When an item is added on the fly at Memory Den via phone:
     - If an active `In Stock` `0EJ...` item has a valid `HUCK-XXXX` / `PDXGL-XXXX` / `BB-XXXX` barcode typed into Ricochet (`mdUpc`) that is not claimed by any other active `In Stock` `0EJ...` SKU, `/api/md-verify-report` and `public/ricochet-upc-sync.user.js` automatically adopt `mdUpc`, link `locationSku = 0EJ...` (`placed @ MD`) in `resale_db.items`, and mark it `VERIFIED_MATCH` (never inventing a competing `HUCK-9xxx` virtual code).
     - If a brand-new `0EJ...` item is added on the fly in Ricochet with a blank UPC, `LocationSyncView.vue` surfaces it with a `🆕 New Booth Item` badge and a 1-click `+ Import to RC (HUCK-XXXX)` button.

---

## 2. UX & Information Architecture Empathy Guardrails

1. **Never Ask User for Manual Browser Plumbing**:
   - Always wire solutions directly into the native Resale Command UI (such as the Drag-and-Drop Permanent Live-Loader Bookmarklet `⚡ Memory Den Sync` in [`LocationSyncView.vue`](file:///c:/Users/15034/Projects/ResaleCommand/src/components/warehouses/LocationSyncView.vue)) rather than asking the user to manually edit bookmark URLs, paste raw payloads, or configure external browser extensions.
   - Use plain-English operational labels (`⚡ Memory Den Sync`, `🔄 Live Fetch`, `📡 Send Report to RC`, `📥 Download CSV`, `🔧 Assign Unique Barcode`, `🔗 Confirm Link`, `✂️ Split Piece from Lot`) instead of developer jargon (`PUT /api/product/items`, `JSON Payload`, `Userscript`).

2. **No Stale Client Snapshots, Zero Hardcoded Collision Maps, & Zero Hardcoded Locations (Single Source of Truth)**:
   - Bookmarklets and sync tools must be **thin permanent live-loaders** that dynamically load the latest script (`/scripts/rico-bookmarklet.js?location=${code}&t=` + `Date.now()`) and fetch live `locationSku` (`0EJ...`) ➔ `HUCK-XXXX` mappings from `/api/md-verify-report?mode=payload&location=${code}` on every open.
   - **Golden Rule #2 (Zero Hardcoded Locations — 100% Driven by Location Settings)**: Never duplicate `CANONICAL_LOCATION_CARDS`, `KNOWN_CODES`, hardcoded `"Memory Den"` / `"15%"` strings, or static `'md_verify_report_latest'` / `'md_live_payload_latest'` keys inside Vue components (`LocationSyncView.vue`, `SalesImporter.vue`, `ItemDetailsTab.vue`, `InventorySpatialBar.vue`). Always resolve location metadata and manifest document IDs dynamically via `src/lib/warehouses.ts` (`getAllLocationSettingMetas`, `getLocationSettingMeta`, `resolveCanonicalLocationCode`, `getLocationManifestDocIds`).
   - **Prohibition of Baked-In Bookmark Payloads & Hardcoded Collision Maps**: Never bake static `window.__RC_PRELOADED_BARCODES__` JSON snapshots into the `href` of a draggable bookmarklet (`bookmarkletHref`), and never hardcode static collision maps (`EXPLICIT_COLLISION_PAIRS` / `CANONICAL_COLLISION_OVERRIDES`) in API routes or client scripts. Rely strictly on dynamic Appwrite state (`resale_db.items` with `usedUpcs` Set + newest-candidate priority).

3. **Confidence First — Zero Blind Writes**:
   - Never auto-commit AI or heuristic matches without explicit user approval.
   - Stage every recommendation visually with its photo thumbnail, calibrated confidence badge (`🟢 High 88%+`, `🟡 Review 60–87%`, `⚪ New Booth Item`), match reason, and 1-click confirmation action (`🔗 Confirm Link`, `✂️ Split Piece from Lot & Link`, or `✅ Approve Selected Matches`).

4. **Booth Operations, Multi-Qty Bin SKUs, & Multi-Piece Parent Lot Splitting**:
   - Always link Memory Den `0EJ...` SKUs in `items.locationSku` on the backend (`resale_db.items`) and respect physical booth workflows:
     - **Multi-Quantity Booth Bins (`📦 Booth Bin (Multi-Qty)`)**: Bin SKUs (`0EJ0FR`, `0EJ0H5`, `0EJ0FQ`, `0EJ0M8`, `0EJ0EC`, `0EJ0JK`, `0EJ0MN`, `0EJ0NQ`, `0EJ09E`) represent a single `0EJ...` SKU with `quantity > 1` that legitimately sells multiple times across tickets.
     - **Multi-Piece Parent Lots (`✂️ Split Piece from Lot & Link to MD`)**: Unsplit backstock lots (`isParentLotCandidate(item)` in `src/lib/salesBucketing.ts`: `quantity > 1`, `components.length > 1`, or titles matching `/\b(lot\s+of\s+\d+|\d+\s*(pcs|pc|pack|lot|set|issues|books|mags|magazines|figures|wands|pins|cards))\b/i`) are **NEVER** ruled out after 1 piece is linked! Remaining pieces from that Parent Lot stay matchable across multiple booth rows, and clicking `✂️ Split Piece from Lot & Link` (or `✂️ Split & Link All N Pieces` in the Match Drawer) creates a child item with `parentLotId`, proportional cost share (`lotCost / pieceCount`), inherited `purchaseId`/`orderId`/photos, `locationSku: '0EJ...'`, `storageLocation: 'MD'`, `warehouseId: '6a7e70050009db0e1857'`, and a fresh sequential `HUCK-XXXX` barcode.

---

## 2. Permanent Live-Loader, 1-Call AI Stager, & Live Tab Connection (`LocationSyncView.vue` ➔ `ricochet-upc-sync.user.js` ➔ `/api/md-verify-report` & `/api/ai-match-booth-items`)

1. **Drag-Once Live-Loader Bookmarklet (`bookmarkletHref` in `LocationSyncView.vue`)**:
   ```javascript
   javascript:(function(){delete window.__RC_PRELOADED_BARCODES__;var s=document.createElement('script');s.src='https://resalecmd.com/ricochet-upc-sync.user.js?v='+Date.now();document.body.appendChild(s);})();
   ```
2. **Single-File Astro Rest Route (`src/pages/warehouse/sync/[...location].astro`) & Clean Slash URLs (`/warehouse/sync/MD`)**:
   - Handles `/warehouse/sync` and `/warehouse/sync/MD` (`DT`, `HG`, `HH`) in one route file and normalizes the browser address bar to `/warehouse/sync/${code}` via `window.history.replaceState` with zero `?location=` query strings.
3. **1-Call AI Smart-Match Stager (`src/pages/api/ai-match-booth-items.ts`)**:
   - Uses a single compact `gemini-2.5-flash` text call (`getModel('gemini-2.5-flash')` + `generateContentWithBackoff`) to score unlinked booth rows against unclaimed inventory & parent lots (`action: 'link' | 'split_lot' | 'create_new'`, `candidateId`, `confidence: 0-100`, `reason`, `estimatedLotPieces`), staging recommendations in `LocationSyncView.vue` for 1-click user review.
4. **Appwrite Persistence (`resale_db.manifests` doc `'md_verify_report_latest'`), Appwrite Realtime, & Verified UPC Retention**:
   - `/api/md-verify-report` persists the latest `MdVerifyReportPayload` in Appwrite (`resale_db.manifests` document `'md_verify_report_latest'`, `status: 'completed'`) so reports survive Vercel cold starts and deployments, and returns `verifiedMdUpcBySku` in `GET ?mode=payload`.
   - Because Ricochet's summary list endpoint (`GET /api/product?store=1&limit=100`) omits nested `items[0].upc_code`, `public/ricochet-upc-sync.user.js` caches verified UPCs in `localStorage` (`rc_md_verified_upcs_v1`) and hydrates `verifiedMdUpcBySku` from `/api/md-verify-report?mode=payload` so refreshing `memoryden.ricoconsign.com` never drops verified counts back to `0`.
   - `LocationSyncView.vue` subscribes to Appwrite Realtime (`client.subscribe('databases.resale_db.collections.manifests.documents.md_verify_report_latest', ...)`) as well as `BroadcastChannel('resale_command_sync')` and `focus` / `visibilitychange` listeners, updating the scorecard live across domains without requiring a page reload.
5. **Chrome Gemini Sidebar (`4 Argon`) Live QA Testing Protocol & Compact IDE Output Rule**:
   - **Chrome Sidebar (`4 Argon`) QA Prompts**: So the user never has to take screenshots or switch tabs to remember test steps, every QA prompt generated by the Lead Architect for the Chrome Gemini Sidebar MUST include:
     a) The exact **Page & Location Slash URL** at the top (`https://resalecmd.com/warehouse/sync/MD`).
     b) **Step-by-Step Pre-Click Instructions inside the Sidebar Prompt** reminding the user to open any table/modal/drawer on the page **FIRST** before pressing `Enter` in the sidebar (since the sidebar snapshots the DOM when `Enter` is pressed).
     c) A **Compact 4-to-5 Line QA Status Report template** at the bottom for 1-click copy-pasting back to the Lead Architect.
   - **Compact Antigravity IDE Output Rule**: Antigravity IDE responses must stay under **8 short bullet lines max**, ending with **ONE single PowerShell code block** (`npm run verify; if ($LASTEXITCODE -eq 0) { ... }`) and the mandatory `🔔 **ADHD MODEL CHECK:**` 1-liner.

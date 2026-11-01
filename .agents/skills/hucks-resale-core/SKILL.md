---
name: hucks-resale-core
description: Master system DNA, 3 Golden Rules, canonical Appwrite warehouse IDs (MD, DT, HG, HH), co-op waterfall rules, and active session pointers for Resale Command.
---

# Huck's Resale Core — System DNA & Golden Rules

> **Live Session Pointer:** Always check [`ACTIVE_SESSION.md`](file:///c:/Users/15034/Projects/ResaleCommand/ACTIVE_SESSION.md) for current active tasks, recent database migrations, and seasonal booth drop targets, and [`docs/AI_STUDIO_PLAYBOOK.md`](file:///c:/Users/15034/Projects/ResaleCommand/docs/AI_STUDIO_PLAYBOOK.md) for the multi-chat AI Studio workflow.

---

## 1. Universal Core DNA

You are the Principal Architect & UX Co-Pilot for **Resale Command** (Astro SSR, Vue 3.5, DaisyUI v5, Tailwind v4, Appwrite Cloud `resale_db` in `sfo.cloud.appwrite.io`, deployed on Vercel at `resalecmd.com`).

### BUSINESS & CO-OP CONTEXT
- **Organization:** The Huckleberry Collective (`HUCK-`) & PDX Game Library (`PDXGL-`) + consignors (`BB-`).
- **Primary Retail Venue:** Memory Den Vintage Mall Booth #0EJ (Portland, OR — Ricochet POS, 15% fee, $382.50/mo rent) and Dusty Tiger (`DT` — small collectibles/jewelry/wands <8", NO apparel, 10% fee, $75.00/mo rent).
- **Backstock Facilities:** `HG` (Huck's Garage) and `HH` (Huck's Hideout).
- **Co-op Waterfall:** 1) Venue Fee (15% Memory Den / 10% Dusty Tiger) -> 2) 100% Curator Cost Basis Recouped -> 3) Net Surplus split 70% Curator / 30% Commons Pool (covers $382.50 rent & tech/supplies).

### STRICT SYSTEM INVARIANTS
1. **IDE Prompt & Model Routing Standard (Google AI Ultra Pool):** Default 90–95% of Antigravity IDE work to **`Gemini 4 Argon Medium`** (multi-file Vue/TS features & refactors) and **`Gemini 3.8 Flash`** (8x lower quota draw for file inspections, doc/session syncs, and single-file edits) so sessions stay inside the Google AI Ultra Gemini quota pool; reserve `Claude Sonnet 5.5` / `Opus 5.5` strictly for isolated 5–10% complex coding/debugging turns (`Enable AI Credit Overages` kept `OFF`). Never use multi-line PowerShell blocks to write files—always instruct the IDE to use native file tools.
2. **ADHD-Friendly Model Picker Guardrail:**
   - **Rule for Gemini Web**: Whenever generating a copy-paste prompt box for Antigravity IDE, always place a bold header immediately above the code block specifying which model to select in Antigravity IDE:
     - `🟢 PICK IN ANTIGRAVITY: Gemini 4 Argon Medium` (for standard code/refactor prompts)
     - `⚡ PICK IN ANTIGRAVITY: Gemini 3.8 Flash` (for file reads, doc updates, and `ACTIVE_SESSION.md` / `GEMINI.md` syncs)
     - `🟣 PICK IN ANTIGRAVITY: Claude Sonnet 5.5 (⚠️ Switch back to Gemini right after!)` (only for complex, unguided bug-fixing or architecture)
   - **Rule for Antigravity IDE**: At the very end of every response in Antigravity IDE, always print this exact 1-line footer right above the chat input box:
     `🔔 **ADHD MODEL CHECK:** Keep picker on **Gemini 4 Argon Medium / 3.8 Flash** — if you used Claude for this turn, switch back to **Gemini 3.8 Flash** now before syncing docs!`
3. **NO Local `astro build`:** Every IDE prompt MUST forbid running `astro build` or `npm run build` locally (hangs Windows PC). Only run `node scripts/validate-templates.mjs` locally; let Vercel build in the cloud.
4. **95% / 5% Hybrid Terminal Rule:** Antigravity IDE must NEVER run terminal commands (the Windows sandbox fails with `CreateProcessSecurityEnvironment` and local `astro build` hangs the PC). Antigravity must do 100% of file inspections, code edits, and script creation using ONLY native `read_file` and `write_file` tools. For the 5% of tasks that require execution (running `node scripts/validate-templates.mjs` via `npm run lint`, running `npm run skills:sync`, or executing a one-time Appwrite `.mjs` script), Antigravity will write the script file with `write_file` and instruct the user to run the single 1-line command in their own terminal.
5. **End-of-Task Session & Skill Sync Reminder:** Whenever a feature, refactor, or bug fix reaches a working milestone, ALWAYS update `ACTIVE_SESSION.md` using `write_file` to log what was completed and what is next, and remind the user to run `npm run lint` and `npm run skills:sync` in their terminal.
6. **Plain-English Vocabulary:** Use `✂️ Split Lot`, `📦 Booth Bin (Multi-Qty)`, `➕ Restock Bin`, `↩️ Undo Combine`, `🔍 Deep Scan`, `⚡ Quick Scout`, `📦 Combine Similar`, `🎁 Build Bundle`.
7. **Appwrite Schema & Media Fallback Laws:** Never write `quantity: 0` (mark `status: 'sold'` or `'combined'` with `quantity >= 1`), never send `isMultiQty` to Appwrite, never store Base64 `data:` URLs in `imageId`/`rawAnalysis`/`components`, paginate with `Query.orderDesc('$id')`, and always attach an `@error` fallback on Appwrite image `<img :src=".../preview...">` elements (`PhotoGalleryManager.vue`, `ItemCard.vue`) that automatically retries raw `/view` (`getAssetUrl(id, { preview: false })`) and falls back to the next valid ID in `galleryImageIds`.
8. **3 Memory Den CSV Formats & 1-to-1 `0EJ...` ↔ `UPC` Bijection:**
   - `Products-*.csv`: Catalog/Stock sync (`'0EJ...` SKU + `Quantity` + `Inventory: In Stock|Paid|Sold`). Updates `items` ONLY—NEVER creates `sales` records! Every `0EJ...` `locationSku` MUST map 1-to-1 to a unique `HUCK-`, `PDXGL-`, or `BB-` `upc` (`EXPLICIT_COLLISION_PAIRS` + `usedUpcs` self-healing in `/api/md-verify-report` and `public/ricochet-upc-sync.user.js`).
   - `Payouts *.csv`: Interim current-month sales (`Sale#` + `Sold Date`). Deduplicates by 6-digit ticket # + occurrence.
   - `Payout History *.csv`: Settled monthly checks (`Sale` + `Sold` + ` - 0EJXXX` suffix).

### UX & INFORMATION ARCHITECTURE EMPATHY GUARDRAILS
1. **Never Ask User for Manual Browser Plumbing:** Always wire solutions directly into the native UI (such as the Drag-and-Drop Permanent Live-Loader bookmarklet `⚡ Memory Den Sync` in `LocationSyncView.vue`) rather than asking the user to manually edit bookmark URLs or install extra extensions.
2. **No Stale Client Snapshots (Single Source of Truth):** Bookmarklets and sync tools must be thin live-loaders (`https://resalecmd.com/ricochet-upc-sync.user.js?v=' + Date.now()`) that fetch fresh code and fresh `locationSku` (`0EJ...`) ➔ `HUCK-XXXX` mappings from the cloud (`/api/md-verify-report?mode=payload`) on open, displaying `"✅ Live Auto-Updated Script"`. Never bake static JSON snapshots into bookmarklet `href`s.
3. **Booth Operations & Bin SKU Awareness:** Always link Memory Den `0EJ...` SKUs in `locationSku` on the backend and respect physical booth workflows (distinguishing legitimate multi-qty Booth Bin SKUs from true duplicate barcode collision pairs).

---

## 2. The 3 Golden Rules

1. **`storageLocation` must NEVER be blank/unassigned:** Every physical item (`received`, `placed`, etc.) must have an explicit location code (`MD`, `DT`, `HG`, `HH`). Default unplaced intake items to `HG` (or `HH` when specified).
2. **Never create duplicate warehouse records:** Always query or reference the canonical `resale_db.warehouses` document IDs below instead of creating new warehouse documents.
3. **Never modify `.vue` files or run local builds on read-only tasks:** When running inspections, pull lists, database audits, or documentation syncs, keep `.vue` files untouched and never invoke `astro build` or `npm run build`.

---

## 3. Canonical Warehouse & Location IDs (`resale_db.warehouses`)

| Code | Name | Document `$id` | Type | Commission | Monthly Rent | Notes / Vibes & Exclusions |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`MD`** | Memory Den - Huck's Adventures Outfitters | `6a7e70050009db0e1857` | On-Site Booth (`#0EJ`) | `15%` | `$382.50/mo` | Goth, Whimsigoth, TTRPG, metaphysical, eclectic, punk, sci-fi, adventure, horror, cos-play |
| **`DT`** | Dusty Tiger | `6a7e71eb001f53734a86` | Consignment Booth | `10%` | `$75.00/mo` | Small Collectibles, Jewelry, Pins, Pocket Items, Wands & Arcana `<8"`. **NO Clothes, NO Large Toys, NO Bulky Playsets** |
| **`HG`** | Huck's Garage | `6a7e6f73003a5a2a7c34` | Warehouse / Backstock | `0%` | `$0.00/mo` | Primary backstock facility (hardgoods, toys, decor, bulk) |
| **`HH`** | Huck's Hideout | `6ae3afbd0030a7eb8a9c` | Warehouse / Backstock | `0%` | `$0.00/mo` | Climate-controlled backstock & staging (`HH` — apparel, books, media, electronics, jewelry) |

---

## 4. Live Active Session Summary (Auto-Synced from `ACTIVE_SESSION.md`)

# Active Session Summary (Updated Nov 1, 2026)

## Completed & Live on Production (`resalecmd.com`)
1. **AI Scout & Vision Pipeline**: Modular schemas, Buy-Target Authority Law, physical substrate priority (`art_decor` before `books`), and Appwrite `/preview` aspect-ratio fix for `bounding_box` auto-cropping.
2. **ItemDrawer & Playbook Performance**: Lazy-mounted `ItemLotTab`/`ItemVerifyTab` (`v-if`), `.toFixed()` null-safety guards, unlocked `isSold` (`status === 'sold'` only) on active Multi-Qty Booth Bins, unified `resolveMultiQtyCost`, and fixed Playbook tab component extraction (`getLotComponents` JSON array parsing + reactive `form.rawAnalysis` / `form.components` hydration).
3. **COGS-Audited `➕ Restock Bin`**: Mode A (`📥 Pull from Backstock (HG/HH)` preserving PO lineage via `status: 'combined'`) and Mode B (`💵 Direct Cash` auto-creating `PO-RST-...`) with live Before ➔ After pooled cost & profit preview.
4. **All-Months Sales Reconciliation (`Apr–Oct 2026`) & 3 Ricochet CSV Formats**:
   - All 7 months reconciled to penny-exact parity with Memory Den checks (including October 2026 through evening sales: **`63` items = `$2,462.99` Gross | `$369.45` Venue Fee | `$2,093.54` Net Payout**).
   - `Products-*.csv` locked to Inventory/Stock Sync only (never creates fake sales).
   - `Payouts-*.csv` & `Payout History-*.csv` unified on 6-digit Ticket # + line-item occurrence idempotency (`Ticket #225210`, `Ticket #225210 #2`, etc.), preserving multi-line same-ticket bin sales (`2x` `0EJ0M8` / `HUCK-1498` on `#225210`) and exact cents (`$9.99` Gross / `$8.49` Net on `Sale# 220406`).
   - `/sales` upgraded with Partner Filter pills (`HUCK-`, `BB-`, `PDXGL-`), Cost/Profit columns, and Member-First Settlement statements.
5. **Command Center (`/dashboard`) & Workbench (`/inventory`) Smart Queues, Triage & Stable Sort**:
   - Created pure domain vibe & triage engine (`src/lib/inventoryVibes.ts`) with whole-word regex matching (`matchesMdRestockVibe`, `matchesDtRestockVibe`), `0EJ` booth SKU awareness (`hasZeroEjSku`, `needsMdSync`), strict physical `storageLocation` matching (`matchesPhysicalStorageCode`, never matching `purchaseLocation`), and 100% working-stock count parity (`isWorkingStockItem`).
   - Built customizable `OperationsRadarGrid.vue` & `useOperationsRadar.ts` on `/dashboard` with 1-click Restock & Triage queues (`🚨 Unassigned`, `🔮 Pull for MD`, `🐯 Pull for DT`, `🔄 0EJ Not Marked MD`, `⚠️ MD Missing 0EJ`, `📦 Booth Bins`), 2x2 mobile financial bento grid, and default `Inventory Alerts` insights tab.
   - Upgraded `/inventory` with a non-clipping 2-row `InventorySpatialBar.vue`, 1-click **Sort Selector** (defaulting to stable `🆕 Newest Added ($createdAt DESC)`), **1-Click Unassigned Location Triage Bar** (`🏠 HG`, `🏡 HH`, `🛋️ HD`, `🔮 MD`, `🐯 DT`), last-used warehouse memory (`getDefaultStorageLocation`), in-place `shallowRef` updates with a `2.5s` emerald `"✓ Saved"` highlight ring (`recentlySavedId` — zero jumping cards on edit), single-checkbox card discipline, and graceful broken-image fallback.
6. **Verified Oct 2026 Memory Den CSV Sync Ported to Live App UI (`LocationSyncView.vue` & `SalesImporter.vue`)**:
   - Ported verified dry-run rules from `scripts/reconcile-md-oct2026.mjs` into `src/lib/salesBucketing.ts`, `src/components/warehouses/LocationSyncView.vue`, and `src/components/sales/SalesImporter.vue`.
   - Added RFC-4180 multiline CSV parser (`parseCsvRfc4180Rows`), locked Multi-Qty Booth Bin priority (`buildLockedMultiBinMap`: `0EJ0FR` -> `HUCK-1309`, `0EJ0H5` -> `HUCK-1425`/`HUCK-1380` `qty: 3` over sold split children `HUCK-9515`), strict `B&B` (`BB-`) namespace isolation + auto-creation (`cost: 0`), trap guards (`0EJ0NY` -> `HUCK-9459` sold, `0EJ0O0` -> `HUCK-9458` stays `placed`, `0EJ0MU` -> `HUCK-8968` sold, `0EJ0N3` -> `HUCK-1501` sold), and per-unit cost basis (`resolveMdUnitCostBasis`: `$2.61`, `$0.81`, `$4.46`, `$4.16`, `$0.04`, etc.).
7. **Slide-Over Inventory Match Drawer & High-Confidence UX Pro Reconciliation (`LocationSyncView.vue`, `src/lib/salesBucketing.ts`, `src/pages/api/ai-match-booth-items.ts`)**:
   - Eliminated cramped inline table-cell search dropdowns and replaced them with the **Inline #1 High-Confidence Staged Preview Card** + **Slide-Over Inventory Match Drawer**.
   - **Confidence First (Zero Blind Writes)**: Stages every recommendation visually with its photo thumbnail, calibrated confidence badge (`🟢 High 88%+`, `📦 Lot Split`, `🟡 Review 60–87%`, `⚪ New Booth Item`), match reason, and 1-click actions (`🔗 Confirm Link`, `✂️ Split Piece from Lot & Link`, `🔍 Drawer`, `+ Add New`), plus a **Staged Match Confidence Triage Bar** with `✅ Approve Selected Matches (N)` and **`✨ AI Smart-Stage Unlinked`** (powered by 1-call `gemini-2.5-flash` in `src/pages/api/ai-match-booth-items.ts`).
   - **Multi-Piece Parent Lot Splitting (`isParentLotCandidate` & `extractEstimatedLotPieceCount`)**: Parent Lots (`quantity > 1`, `components.length > 1`, or titles matching `/\b(lot\s+of\s+\d+|\d+\s*(pcs|pc|pack|lot|set|issues|books|mags|magazines|figures|wands|pins|cards))\b/i`) are **never** ruled out after 1 piece is linked so remaining pieces stay matchable; includes `✂️ Split from Lot & Link to MD` and a **Multi-Piece Sibling Lot Checklist** inside the Match Drawer to split & link all matching booth pieces from the same lot in 1 click (inheriting `parentLotId`, proportional cost share, PO/photos, `locationSku`, `storageLocation: 'MD'`, and a fresh `HUCK-XXXX`).
8. **Permanent Live-Loader Bookmarklet (`⚡ Memory Den Sync`), Zero-Hardcoding Dynamic 1-to-1 Bijection, & Live Tab Connection (`LocationSyncView.vue`, `public/ricochet-upc-sync.user.js` v4.0, `/api/md-verify-report`)**:
   - Upgraded `src/pages/api/md-verify-report.ts` (`GET ?mode=payload`) and `public/ricochet-upc-sync.user.js` to rely **100% on dynamic Appwrite state** (`Query.orderDesc('$id')` + `usedUpcs` Set with zero hardcoded collision overrides) and converted the drag-and-drop bookmarklet (`bookmarkletHref`) in `LocationSyncView.vue` to a pure permanent **Live-Loader** (`https://resalecmd.com/ricochet-upc-sync.user.js?v=' + Date.now()`).
   - Wired `BroadcastChannel('resale_command_sync')` and `visibilitychange` / `focus` listeners across `LocationSyncView.vue` and `public/ricochet-upc-sync.user.js` so Resale Command and the Memory Den widget auto-refresh in real time when syncing or linking barcodes.
   - Added automatic `/preview` -> `/view` -> next-gallery-photo fallback on `@error` in `PhotoGalleryManager.vue` and `ItemCard.vue`.

## Next Up:
1. **`🎯 Theme Puller & Location-Vibe Drop Builder`** (Grouping unplaced `HH` and `HG` items by Location Vibe & Season: `🎃 Witchy/Halloween` -> `🎁 Nov 1 Holiday Rush`).
2. **Simplify `✂️ Split Lot` Tray (4 Steps -> 2 Steps)**.

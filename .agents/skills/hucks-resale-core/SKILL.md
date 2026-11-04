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

1. **`storageLocation` must NEVER be blank/unassigned & 4 Canonical Locations Only:** Every physical item (`received`, `placed`, etc.) must have an explicit canonical location code (`MD`, `DT`, `HG`, `HH`). Default unplaced intake items to `HG` (or `HH` when specified), and never create duplicate warehouse records.
2. **Zero Hardcoded Locations (100% Driven by Central Location Settings):** Never hardcode location codes, names, fees, or static manifest keys in UI components, API routes, or bookmarklets—always read dynamically from `src/lib/warehouses.ts` (`usesRicochet`, `supportsPaperSalesSheet`, `salesIntakeMode`, `commissionRate`, `monthlyRent`).
3. **Reuse Canonical Pipelines (`src/lib/salesBucketing.ts`), Break Down Monoliths, & Keep Read-Only Audits Clean:** Never reinvent duplicate matching/deduplication pipelines or bloat giant monolithic files—always delegate to `src/lib/salesBucketing.ts` (`splitTrailingBoothSku`, `isPayoutSummaryRow`, `assignOccurrenceFingerprints`, `flagAlreadyRecordedRows`, `matchMemoryDenInventoryItem`, `buildLockedMultiBinMap`), extract focused composables/panels (`src/lib/ricochetPayoutParser.ts`, `src/composables/useRicochetSalesSync.ts`, `src/components/sales/RicochetLiveSalesPanel.vue`), and never modify `.vue` files or run local builds on read-only tasks.

---

## 3. Canonical Warehouse & Location IDs (`resale_db.warehouses`)

| Code | Name | Document `$id` | Type | Commission | Monthly Rent | Notes / Vibes & Exclusions |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`MD`** | Memory Den - Huck's Adventures Outfitters | `6a7e70050009db0e1857` | On-Site Booth (`#0EJ`) | `15%` | `$382.50/mo` | Goth, Whimsigoth, TTRPG, metaphysical, eclectic, punk, sci-fi, adventure, horror, cos-play |
| **`DT`** | Dusty Tiger | `6a7e71eb001f53734a86` | Consignment Booth | `10%` | `$75.00/mo` | Small Collectibles, Jewelry, Pins, Pocket Items, Wands & Arcana `<8"`. **NO Clothes, NO Large Toys, NO Bulky Playsets** |
| **`HG`** | Huck's Garage | `6a7e6f73003a5a2a7c34` | Warehouse / Backstock | `0%` | `$0.00/mo` | Primary backstock facility (hardgoods, toys, decor, bulk) |
| **`HH`** | Huck's Hideout | `6ae3afbd0030a7eb8a9c` | Warehouse / Backstock | `0%` | `$0.00/mo` | Climate-controlled backstock & staging (`HH` — apparel, books, media, electronics, jewelry) |

---

## Resale Command — 7 Immutable Architecture Laws

> **Source of truth.** This file is embedded verbatim into `GEMINI.md` and the `hucks-resale-core` skill by `npm run skills:sync` (`scripts/sync-ai-context.mjs`). `scripts/validate-templates.mjs` fails the build if any law below is removed.

1. **LAW 1 — 4 Locations Only (`HG`, `HH`, `MD`, `DT`).**
   Every physical item and every sale belongs to exactly one of these four canonical `resale_db.warehouses` documents. Never invent a fifth location code, never create duplicate warehouse records, never leave `storageLocation` blank.

2. **LAW 2 — Zero Hardcoding.**
   No fallback dates (never stamp "today" or a past check date onto a missing sold/paid date), no rent amounts, no commission/fee percentages, no account/project IDs inside UI components, composables, API routes, or bookmarklets. Fee, rent, `usesRicochet`, `salesIntakeMode` etc. always resolve from the live Appwrite `warehouses` document via `src/lib/warehouses.ts` (+ `src/lib/locationSettingsServer.ts` on the server).

3. **LAW 3 — 100% Shared Matching via `src/lib/salesBucketing.ts`.**
   SKU/UPC/title matching, ticket parsing, partner bucketing, occurrence fingerprints, ledger de-duplication and month bucketing are implemented ONCE in `src/lib/salesBucketing.ts` (`matchMemoryDenInventoryItem`, `buildLockedMultiBinMap`, `splitTrailingBoothSku`, `canonicalTicketNumber`, `flagAlreadyRecordedRows`, `pacificMonthKey`, `calendarMonthKeyFromDateString`). Components, composables and API routes delegate to it — never re-implement matching or bucketing.

4. **LAW 4 — Appwrite-First Persistence.**
   Zero static lookup dictionaries (no `0EJxxx -> HUCK-xxxx` tables, no baked JSON snapshots) in code. Lookup maps are built at runtime, in memory, from live `resale_db` documents: `items`, `warehouses`, `sales`, `manifests`. Staging/commit state lives in `manifests`; seed historical mappings into Appwrite documents (`scripts/seed-md-booth-skus.mjs`), never into source files.

5. **LAW 5 — Enterprise UX/IA Pattern.**
   Primary canvas = Top KPIs ➔ full DataTable ➔ Sticky Bottom Action Bar (`BottomActionDock`, `fixed bottom-0`, `backdrop-blur`, `z-50`, page clearance `pb-36 sm:pb-44`, Astro page passes `hideFooter={true}`). Secondary inputs (manual CSV upload, demo loaders, paste drawers) live in right-edge Slide-Over Trays (`SalesImportTray.vue` pattern), triggered from the top toolbar — never as large cards in the page body.

6. **LAW 6 — 3-Tier Commit Idempotency.**
   Every money-moving commit must be safe to click twice, retry, or resume:
   - **Layer 1 — UI button lock:** the commit button disables synchronously on click (`isSubmitting`/`isCommitting = true`) and shows batch progress; writes are chunked (25–50 rows per request).
   - **Layer 2 — Manifest status transition:** on success the Appwrite staging manifest moves `staged ➔ committed` (`committed_at`, `committed_count`); a committed manifest hides Commit and shows "✅ Already Synced".
   - **Layer 3 — Database ticket de-duplication:** the server checks `ticket_number + sale date + location` against `sales` before every insert and skips anything already present (0 duplicate sales, ever).

7. **LAW 7 — Date Bucketing Standard.**
   Group sales by the **calendar `sold_date`** as written — never by payout/check/paid dates. Month keys are one-indexed `YYYY-MM` strings produced by string parsing (`calendarMonthKeyFromDateString`, `pacificMonthKey`) and labeled by `monthKeyToLabel` (`2026-11` ➔ `November 2026`). Never derive a month from `Date#getMonth()` (0-indexed), and never convert a date-only/UTC-midnight sold date through a time zone. `11-02-2026` and `11-03-2026` must render as "November 2026".

---

## 4. Live Active Session Summary (Auto-Synced from `ACTIVE_SESSION.md`)

# Active Session Summary (Updated Nov 3, 2026)

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
   - **Confidence First (Zero Blind Writes & Calibrated Distinctive-Token Scoring)**:
     - Separated generic category/form/brand tokens (`lot`, `set`, `boxed`, `campaign`, `setting`, `edition`, `hardcover`, `book`, `blouse`, `shirt`, `print`, `d&d`, `ad&d`, `banana`, `republic`, etc.) from specific identifying tokens (`planescape`, `eberron`, `fiendish`, `codex`, `corvus`, `belli`, `infinity`, `n4`, `red`, `animal`, `navy`, `dash`, etc.) in `getUnclaimedMatchCandidatesForRow`.
     - Added strict attribute conflict guards (`COLOR_CONFLICT_TOKENS`, `PATTERN_CONFLICT_TOKENS`, `RPG_SETTING_CONFLICT_TOKENS`, `EDITION_CONFLICT_TOKENS`, `GARMENT_TYPE_CONFLICT_TOKENS`) and enumerated-lot guards so conflicting items (e.g., `Navy Dash Print Blouse` for `0EJ0CU Red Black Animal Print Blouse`, or `HUCK-0467 D&D 3.5e Eberron...` for `0EJ07J/0EJ0CQ AD&D Planescape Boxed Set`) are heavily penalized (`< 50%`) and excluded in `'suggested'` mode, while `HUCK-0790` ("Lot Of 5 Pcs Dungeons And Dragons Boxed Sets Fantasy RPG Campaign Books") ranks #1 (`76%` Review / Lot Split) for `0EJ07J` and `0EJ0CQ` (plus automatic `0EJ0CQ` `parentLotId` healing to `HUCK-0790` in `LocationSyncView.vue` and `scripts/fix-0ej0cq-parent-lot.mjs`).
     - Upgraded `✨ AI Smart-Stage Unlinked` to process in reliable batches of 20 rows (`⏳ AI Analyzing 1–20 of 32...`), prioritizing the active filter view (`displayedRows`), building a targeted candidate + Parent Lot pool per batch, overriding both the inline preview card (`getTopStagedCandidateForRow`) and #1 in the Match Drawer (`mergeStagedCandidateAtTop`), and cleanly setting `⚪ New Booth Item` (without falling back to heuristic) when AI recommends `create_new`.
   - **Multi-Piece Parent Lot Splitting (`isParentLotCandidate` & `extractEstimatedLotPieceCount`)**: Parent Lots (`quantity > 1`, `components.length > 1`, or titles matching `/\b(lot\s+of\s+\d+|\d+\s*(pcs|pc|pack|lot|set|issues|books|mags|magazines|figures|wands|pins|cards))\b/i`) are **never** ruled out after 1 piece is linked so remaining pieces stay matchable; includes `✂️ Split from Lot & Link to MD` and a **Multi-Piece Sibling Lot Checklist** inside the Match Drawer to split & link all matching booth pieces from the same lot in 1 click (inheriting `parentLotId`, proportional cost share, PO/photos, `locationSku`, `storageLocation: 'MD'`, and a fresh `HUCK-XXXX`).
8. **Permanent Live-Loader Bookmarklet (`⚡ Memory Den Sync`), Zero-Hardcoding Dynamic 1-to-1 Bijection, Appwrite-Persisted Verification Report, & Appwrite Realtime (`LocationSyncView.vue`, `public/ricochet-upc-sync.user.js` v4.0, `/api/md-verify-report`)**:
   - Upgraded `src/pages/api/md-verify-report.ts` (`GET ?mode=payload`) and `public/ricochet-upc-sync.user.js` to rely **100% on dynamic Appwrite state** (`Query.orderDesc('$id')` + `usedUpcs` Set with zero hardcoded collision overrides) and converted the drag-and-drop bookmarklet (`bookmarkletHref`) in `LocationSyncView.vue` to a pure permanent **Live-Loader** (`https://resalecmd.com/ricochet-upc-sync.user.js?v=' + Date.now()`).
   - **Appwrite Persistence + Appwrite Realtime + Verified UPC Retention Across Page Refreshes**:
     - `/api/md-verify-report` now persists BOTH the latest `MdVerifyReportPayload` (`resale_db.manifests` doc `'md_verify_report_latest'`) AND the full 808-item `skuToUpcMap` / `skuToMetaMap` (`resale_db.manifests` doc `'md_live_payload_latest'` with `Permission.read(Role.any())`) so Vercel cold starts and unauthenticated `/api/md-verify-report?mode=payload` calls always serve all 808 `0EJ...` mappings (including `sold` items and partner `PDXGL-`/`BB-` items), and automatically enriches `expectedRcUpc` on `POST`.
     - `public/ricochet-upc-sync.user.js` caches verified Memory Den UPCs in `localStorage` (`rc_md_verified_upcs_v1`), awaits `fetchLivePayloadFromCloud` in `loadConsignorCatalog` when `parsedMap` is empty, marks historical `Sold`/`Paid` items that have `expectedRcUpc` as `VERIFIED_MATCH`, and hydrates `verifiedMdUpcBySku` from Appwrite cloud so refreshing `memoryden.ricoconsign.com` never forgets verified UPCs.
     - `LocationSyncView.vue` subscribes to Appwrite Realtime (`client.subscribe('databases.resale_db.collections.manifests.documents.md_verify_report_latest', ...)`) plus `BroadcastChannel('resale_command_sync')` and `visibilitychange` / `focus` listeners so Resale Command updates live in real time across domains.
   - **Physical Booth Tag & Production Safety Guardrails (The 3 Physical Retail Tag Laws)**:
     - **Law #1 (Never Auto-Overwrite Existing Ricochet Barcodes):** `🚀 Fill Missing` in `public/ricochet-upc-sync.user.js` ONLY counts and processes items where Ricochet's current UPC is genuinely blank (`verifyStatus === 'MISSING_IN_MD'`). It never includes or overwrites `MISMATCH_UPC` items (`🚀 Fill Missing (14)`, never `15`), and includes a deep variant guard after `GET /api/product/show/{id}` so any non-blank `targetItem.upc_code` in Ricochet is protected from overwrite.
     - **Law #2 (Visible Pre-Flight Queue Preview):** Renders a collapsible/scrollable `#rc-preflight-details` box inside the Memory Den widget listing the exact `N` blank items queued (`0EJ... | Blank ➔ HUCK-XXXX | 🏷️ Pre-Tagged vs 🆕 Virtual (9740+)`) before clicking `🚀 Fill Missing (N)`.
     - **Law #3 (Physical Sticker Wins / 1-Click `🏷️ Adopt Booth Tag`, 2-Way Criss-Cross Swaps, Clean `HUCK-XXXX` Standard, & On-the-Fly Phone Booth Additions):** Added 1-click **`🏷️ Adopt Booth Tag ([mdUpc])`** button in both the Memory Den widget (`#rc-mismatch-box`) and `LocationSyncView.vue` (`POST /api/md-verify-report` with `mode: 'adopt_md_upc'`) that updates `resale_db.items`, `md_live_payload_latest`, and `md_verify_report_latest` to adopt Ricochet's existing physical barcode (including automatic 2-way criss-cross barcode swaps when another SKU held `mdUpc`) so no tag at the booth ever needs to be re-stickered. Enforced clean 4-digit `HUCK-XXXX` barcodes (zero `-A`/`-B`/`-C` suffixes; `parentLotId` tracks lot lineage), resolved all 5 remaining mismatches (`0EJ0H5` ➔ `HUCK-1425`, `0EJ0GF` ➔ `HUCK-1341`, `0EJ0GG` ➔ `HUCK-9562`, and historical sold `0EJ0ES`/`0EJ0ET`/`0EJ0EU` ➔ `VERIFIED_MATCH`) to reach **`808 / 808 Verified (0 Missing, 0 Mismatch, 0 Unlinked)`**, prioritized `md_live_payload_latest` over static baseline in `/api/md-verify-report` with non-destructive payload merges, enabled hot-swap widget reloading on bookmarklet clicks, and purged all one-off scripts from `scripts/` with an allowlist guard in `scripts/validate-templates.mjs`.
9. **Golden Rule #3 Unified 4-Tier Sales & Inventory Matching (`src/lib/salesBucketing.ts`, `src/lib/ricochetPayoutParser.ts`, `src/composables/useRicochetSalesSync.ts`, `src/components/sales/RicochetLiveSalesPanel.vue`, `public/ricochet-upc-sync.user.js`)**:
   - Unified all Ricochet Live Sales & Payout Sync matching (`useRicochetSalesSync.ts`, `ricochetPayoutParser.ts`, `/api/sales/ricochet-sync`, and `public/ricochet-upc-sync.user.js`) onto the single 4-tier `matchMemoryDenInventoryItem` + `buildLockedMultiBinMap` pipeline in `src/lib/salesBucketing.ts` (1. Exact SKU/UPC/trailing SKU via `splitTrailingBoothSku`, 2. Normalized/core title match stripping `"Board Game"` / `"The"`, 3. Token/prefix/fuzzy title + gross price match including short titles `>= 5` chars like `"Blackbeard"`, `"Board Game Stop Thief"`, `"Castles of Burgundy"`, and `"Advanced Dungeons & Dragons"`, 4. Locked multi-bin lot match).
   - Reused Tab 1's (`📦 Inventory & UPC Audit`) 808-item catalog and 499+ Resale Core barcode mappings inside Tab 2 (`💰 Sales & Payout Sync`) of `public/ricochet-upc-sync.user.js` so Paid History / catalog-sold rows missing a SKU inherit their Ricochet `0EJ...` SKU, Resale Core `HUCK-`/`PDXGL-`/`BB-` UPC, and actual sold/paid date (never defaulting to `'2026-11-03'`), and automatically stages the Dry-Run batch to Resale Core (`pushSalesToResaleCore({ silent: true })`) as soon as harvesting completes.
   - Added `window` `focus` / `visibilitychange` auto-refresh in `useRicochetSalesSync.ts` plus 1-click manual item bind (`🔍 Match` / `🔄 Change`) and auto-create (`+ Add` per row and `✨ Auto-Create All N as Sold`) in `RicochetLiveSalesPanel.vue` and `SalesImporter.vue`.
10. **Permanent Antigravity IDE Workflow & Gemini Web Anti-Glitch Rules (`scripts/sync-ai-context.mjs`, `scripts/validate-templates.mjs`)**:
   - **Rule 1 (Exact Antigravity IDE Model + Level Lock):** Every IDE prompt must specify one of the exact Antigravity IDE dropdown choices + thinking level: `Gemini 3.8 Flash` (`Low` or `Medium`), `Gemini 4 Argon` (`Medium` or `High`), `Claude Sonnet 5.5` (`Medium` or `High`), `Claude Opus 5.5` (`High`), or `GPT-OSS 120B` (`Medium`).
   - **Rule 2 (Mandatory Turn-1 Self-Check Gatekeeper):** Every Gemini-locked IDE prompt must instruct the agent to check its own model identity before any tool call—if `Claude Sonnet 5.5` or `Claude Opus 5.5` is active, abort with 0 tool calls; otherwise begin Line 1 with `Executed by: [Model Identity]`.
   - **Rule 3 (Exact File Paths Only Rule):** Never use `run_command` (0 terminal calls) or directory searches; use ONLY `read_file`, `edit_file`, and `write_file` on explicit file paths.
   - **Rule 4 (Clean Single Code Block Rule for Gemini Web):** When generating an Antigravity IDE copy-paste prompt in Gemini Web, output ONE single fenced code block (` ```text ... ``` `) and zero inline backticks, emojis, or horizontal dividers anywhere outside the code block to prevent streaming splice glitches.

## Next Up:
1. **`🎯 Theme Puller & Location-Vibe Drop Builder`** (Grouping unplaced `HH` and `HG` items by Location Vibe & Season: `🎃 Witchy/Halloween` -> `🎁 Nov 1 Holiday Rush`).
2. **Simplify `✂️ Split Lot` Tray (4 Steps -> 2 Steps)**.

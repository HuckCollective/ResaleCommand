---
name: hucks-resale-core
description: Master system DNA, 3 Golden Rules, canonical Appwrite warehouse IDs (MD, DT, HG, HH), co-op waterfall rules, and active session pointers for Resale Command. Use when starting any task in this repo, or when you need the business context, location IDs, or the 7 architecture laws.
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
4. **1-Click `run_command` (`BypassSandbox: true`) Auto-Verify & Push Standard:** On Windows, standard sandboxed terminal calls (`BypassSandbox: false`) fail with `CreateProcessSecurityEnvironment` and local `astro build` hangs the PC. Antigravity must do all file inspections and code edits using native `read_file`, `edit_file`, and `write_file` tools, and whenever running `npm run verify`, `git commit`, and `git push` (or executing a `scratch/` script), Antigravity MUST invoke `run_command` with **`BypassSandbox: true`** so the user gets a 1-click Run button in chat and Antigravity monitors the terminal output directly without manual copy-pasting.
5. **End-of-Task Session & Skill Sync Reminder:** Whenever a feature, refactor, or bug fix reaches a working milestone, ALWAYS update `ACTIVE_SESSION.md` using `write_file` to log what was completed and what is next, and run `npm run verify` + `git push` via `run_command` (`BypassSandbox: true`).
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

1. **LAW 1 — 4 Locations Only (`HG`, `HH`, `MD`, `DT`).**
   Every physical item and every sale belongs to exactly one of these four canonical `resale_db.warehouses` documents. Never invent a fifth location code, never create duplicate warehouse records, never leave `storageLocation` blank.

2. **LAW 2 — Zero Hardcoding.**
   No fallback dates (never stamp "today" or a past check date onto a missing sold/paid date), no rent amounts, no commission/fee percentages, no account/project IDs inside UI components, composables, API routes, or bookmarklets. Fee, rent, `usesRicochet`, `salesIntakeMode` etc. always resolve from the live Appwrite `warehouses` document via `src/lib/warehouses.ts` (+ `src/lib/locationSettingsServer.ts` on the server). The fee/rent figures in the Canonical Warehouse table are reference documentation only — never copy them into code.

3. **LAW 3 — 100% Shared Matching via `src/lib/salesBucketing.ts`.**
   SKU/UPC/title matching, ticket parsing, partner bucketing, occurrence fingerprints, ledger de-duplication and month bucketing are implemented ONCE in `src/lib/salesBucketing.ts` (`matchMemoryDenInventoryItem`, `buildLockedMultiBinMap`, `splitTrailingBoothSku`, `canonicalTicketNumber`, `flagAlreadyRecordedRows`, `pacificMonthKey`, `calendarMonthKeyFromDateString`). Components, composables and API routes delegate to it — never re-implement matching or bucketing.

4. **LAW 4 — Appwrite-First Persistence.**
   Zero static lookup dictionaries (no `0EJxxx -> HUCK-xxxx` tables, no baked JSON snapshots) in code. Lookup maps are built at runtime, in memory, from live `resale_db` documents: `items`, `warehouses`, `sales`, `manifests`. Staging/commit state lives in `manifests`; seed historical mappings into Appwrite documents (`scripts/seed-md-booth-skus.mjs`), never into source files. Never send an attribute that is not in the collection schema (Appwrite rejects unknown attributes with 400).

5. **LAW 5 — Enterprise UX/IA Pattern.**
   Primary canvas = Top KPIs ➔ full DataTable ➔ Sticky Bottom Action Bar (`BottomActionDock`, `fixed bottom-0`, `backdrop-blur`, `z-50`, page clearance `pb-36 sm:pb-44`, Astro page passes `hideFooter={true}`). Secondary inputs (manual CSV upload, demo loaders, paste drawers) live in right-edge Slide-Over Trays (`SalesImportTray.vue` pattern), triggered from the top toolbar — never as large cards in the page body.

6. **LAW 6 — 3-Tier Commit Idempotency.**
   Every money-moving commit must be safe to click twice, retry, or resume:
   - **Layer 1 — UI button lock:** the commit button disables synchronously on click (`isSubmitting`/`isCommitting = true`) and shows batch progress; writes are chunked (25–50 rows per request); any failure unlocks the UI and surfaces the exact Appwrite error in a toast.
   - **Layer 2 — Manifest status transition:** on success the Appwrite staging manifest moves `staged ➔ committed` (`committed_at`, `committed_count`); a committed manifest hides Commit and shows "✅ Already Synced".
   - **Layer 3 — Database ticket de-duplication:** the server checks `ticket_number + sale date + location` against `sales` before every insert and skips anything already present (0 duplicate sales, ever).

7. **LAW 7 — Date Bucketing Standard.**
   Group sales by the **calendar `sold_date`** as written — never by payout/check/paid dates. Month keys are one-indexed `YYYY-MM` strings produced by string parsing (`calendarMonthKeyFromDateString`, `pacificMonthKey`) and labeled by `monthKeyToLabel` (`2026-11` ➔ `November 2026`). Never derive a month from `Date#getMonth()` (0-indexed), and never convert a date-only/UTC-midnight sold date through a time zone. `11-02-2026` and `11-03-2026` must render as "November 2026".

**READ-FIRST pointer (applies to every agent):** before editing sales or inventory-sync code (Ricochet Sales Sync, Commit, dedupe, payout/CSV imports, any script touching `sales`), read `.agents/rules/sales-reconciliation-and-payout-invariants.md` and the Booth Bin rules (`resale-booth-sync` §2.4). SKU + price is never an identity; one sale line = ticket # + gross + net.

---

## 4. Live Active Session Summary (Auto-Synced from `ACTIVE_SESSION.md`)

# Active Session Summary (Updated Nov 5, 2026)

## 📌 UP NEXT (Saved Before Restart — Reply `all` or `1`/`2`/`3`/`4` When Back)
1. **Social Studio ➔ 1-Click `SWEAT-` Labor Log**: Wire a 1-click button in Social Dropcast Studio (`/marketing`) to log `SWEAT-` Marketing & Social hours + `deliverableRef` directly into `CoopLaborView.vue` (`/coop/labor`).
2. **Dusty Tiger (`DT`) Sales & Drop Polish**: Add a 1-click Dusty Tiger (`10%` fee, `$75/mo` rent) quick-entry & settlement filter in `SalesList.vue` and `CoopSettlementView.vue`.
3. **Booth Bin Stock Depletion Guardrail**: Lock in the canonical rule in `useRicochetSalesSync.ts` so Multi-Qty Booth Bins (`HUCK-0113`, `HUCK-1498`, etc.) never double-deplete when both `Payouts` and `Products` syncs run.
4. **Repo Housekeeping**: Clean up any duplicate script in `public/scripts/` and point `git remote origin` to `https://github.com/HuckCollective/ResaleCommand.git`.

## Nov 5, 2026 — `alpha-1` Branch (Merged to `main` at `957bf27`): UX/IA Navbar Refactor, Appwrite Co-op Voting & Surplus Policy, and Unlinked Ticket Reconciliation
- **UX/IA Master Navbar (`src/components/nav/Navbar.vue`) & Subdomain Middleware (`src/middleware.ts`)**:
  - Treated `alpha.resalecmd.com`, `dev.resalecmd.com`, and `*.vercel.app` as primary app domains in `src/middleware.ts` (`RESERVED_APP_SUBDOMAINS`).
  - Refactored `Navbar.vue` with 5-Pillar Desktop Lifecycle Navigation (`Command`, `Purchases`, `Inventory`, `Locations ▾` dynamically driven by `getAllLocationSettingMetas()`, `Finance ▾`, `Studios ▾`), separated Workspace Switcher, unified Mobile Drawer with SSR-safe `<Teleport :disabled="!isMounted">`, and eliminated double scrollbars.
- **Co-op Operating-Cost Breakeven & Appwrite Governance Voting (`src/lib/coopGovernance.ts`, `CoopGovernanceView.vue`, `CoopSettlementView.vue`)**:
  - Upgraded Co-op Proposals, Loomio 4-Signal Votes (`agree` / `abstain` / `disagree` / `block`), and active Surplus Policy (`patronage_90_10` | `cap_100` | `reserve_100`) from `localStorage` to live Appwrite Cloud (`resale_db.manifests` doc `coop_governance_proposals_v1`).
  - Added Gate 3 ➔ Gate 4 Operating Costs Breakeven Progress Bar and Partner Bonus Surplus Dividend calculator in `CoopSettlementView.vue`.
- **Unlinked Ticket Inventory Matcher & Commons Pool Sweep (`LinkTicketInventoryModal.vue`, `SalesList.vue`, `CoopSettlementView.vue`)**:
  - Wired canonical 4-tier `matchMemoryDenInventoryItem` + `splitTrailingBoothSku` into `SalesList.vue`, added the Top Unlinked Tickets Quick-Filter Banner, and created `LinkTicketInventoryModal.vue` (`[Link Inventory]`, `⇄ Reassign`, and `[Assign to Commons Pool (100% Margin)]` setting curator split to `$0.00` and sweeping 100% of net margin to the Commons Pool).
- **Pure 4-Gate Co-op Settlement Engine & Operating Charter (`src/types/coop.ts`, `src/lib/coop/settlementEngine.ts`, `docs/coop/WSDE_OPERATING_CHARTER.md`)**:
  - Created strongly typed `PartnerCode`, `PartnerRole`, `SettlementConfig`, `PartnerSummary`, and `SettlementResult` interfaces plus pure `runCoopSettlement(partners, config)` implementing Gate 1 (15% venue fee), Gate 2 (Consignor `BB-` fixed rent offset reducing gross rent `$382.50 -> $297.09`), Gate 3 (100% cost basis recoupment + 70/30 split), Gate 4A (`$523.26` operating breakeven & carried-over shortfall repayment priority), and Gate 4B (50% Sales Margin pro-rata / 50% Labor Bounties pro-rata).
  - Authored `docs/coop/WSDE_OPERATING_CHARTER.md` documenting Enterprise Structure (`HUCK-`, `PDXGL-`, `SWEAT-`, `BB-`), the 4-Gate Financial Waterfall across Physical Booths (`MD` 15% / `DT` 10%), Online Marketplaces (`eBay` 13% / `Poshmark` 20% + 100% Outbound Postage Recoupment), and Pop-Ups (`2.9%` Card / `0%` Cash), the 5 Democratic Dials via Loomio 4-signal consent, and the 30-Day Orphan Ticket Rule.
- **Unified Master Co-op Plan: WSDE/Mondragon Skill Ingestion, Multi-Channel & `SWEAT-` Marketing Worker Model, and Personal vs. Co-op Shared Expense Separation (`CoopExpensesLedger.vue`, `CoopSettlementView.vue`, `CoopLaborView.vue`, `CoopGovernanceView.vue`, `CoopCharterView.vue`, `src/lib/coopExpenses.ts`, `src/lib/coopGovernance.ts`)**:
  - **Neutral Institutional WSDE & Mondragon Reference**: Created `.agents/skills/democracy-at-work-cooperative/references/WSDE_MONDRAGON_SELC_REFERENCE.md` and updated `.agents/skills/democracy-at-work-cooperative/SKILL.md` + `.agents/skills/tax-and-expense-compliance/SKILL.md` with zero personal names, Producers vs. Enablers of Surplus, Mondragon `10/45/45` Waterfall & Internal Capital Accounts (`7%` target yield, `4.5:1` / `6.5:1` pay ratio cap), and ICA/Rochdale & SELC Bylaws.
  - **Personal Schedule C Write-Off vs. Co-op Shared Commons Expense Separation (`coop_shared` | `personal_write_off` | `split`)**: Added `scope` and `coopSharePct` in `src/lib/coopExpenses.ts`, inline 1-click Scope switcher + KPI cards + separate `Co-op Commons CSV` vs. `Personal Schedule C CSV` exports in `CoopExpensesLedger.vue`, and strictly excluded `personal_write_off` items from Gate 4A operating costs and member reimbursements in `CoopSettlementView.vue`.
  - **Marketing, Social Media & Enabling Worker-Member Model (`SWEAT-` — `$0` Inventory Required)**: Added `'SWEAT'` partner prefix, `'Marketing & Social Enabler'` role, `'Online Fulfillment & Shipping'` and `'Pop-Up & Event Staffing'` categories, `deliverableRef` proof links, and individual worker pro-rata Gate 4B Labor Pool share + Mondragon ICA `7%/yr` target yield in `CoopLaborView.vue`, `CoopSettlementView.vue`, `CoopGovernanceView.vue` (including 1-click `⚡ Enact Passed Proposal`), and `CoopCharterView.vue` (including live multi-channel + outbound shipping postage simulator).
  - **Online (`eBay` / `Poshmark` / `Direct` + Gate 2 Postage Recoupment) & Pop-Up Sales Intake + Unlinked Ticket Audit (`SaleEditor.vue`, `SalesList.vue`, `CoopSettlementView.vue`)**:
    - Added 1-click Sales Channel & Marketplace Preset Selector (`🏪 Retail Booth`, `📦 eBay Online 13.25% + Label`, `👗 Poshmark 20%`, `💳 Direct / Social 2.9% + Postage`, `🎪 Pop-Up Event 2.9% Card / 0% Cash`), URL `?channel=online|popup` support, and real-time Gate 2 Postage + Cost Basis & Gate 3 70/30 Waterfall preview in `SaleEditor.vue`.
    - Wired 100% Outbound Label Postage (`shippingCost`) recoupment into Gate 2 of `CoopSettlementView.vue` and hardened `isUnlinkedTicketSale` + fallback item matching in `SalesList.vue` (verified `378/378` sales linked, `0` `SO-` rows, and `0` dangling `saleId` pointers in Appwrite).
    - Promoted and merged `alpha-1` into production `main` (`resalecmd.com`).
  - **UX/IA Master Pattern Alignment Across Co-op Suite (`src/pages/expenses.astro`, `src/pages/coop/charter.astro`, `CoopExpensesLedger.vue`, `CoopCharterView.vue`, `CoopLaborView.vue`, `CoopGovernanceView.vue`)**:
    - Added `<CoopSubNav client:only="vue" activeTab="expenses" />`, `hideFooter={true}`, and `max-w-7xl` layout to `/expenses` (`src/pages/expenses.astro`), and created `src/pages/coop/charter.astro`.
    - Refactored `CoopExpensesLedger.vue` to the canonical **Ledger Archetype** (`SalesList.vue`): unboxed header + 4 standalone Icon-Badge KPI cards (`grid-cols-2 lg:grid-cols-4`), single Omnibox Search + Month + Status + Scope toolbar (`bg-base-100/90 border-base-200/80 rounded-2xl`), responsive Mobile Card View + zero-clipping Desktop Table (combining Description + Condensed Category Badge + Member/Partner into `Expense & Category`), and 2-tier `<PaginationDock>` (`src/components/common/PaginationDock.vue`).
    - Upgraded `CoopLaborView.vue` and `CoopGovernanceView.vue` headers to the canonical unboxed header + 4 standalone Icon-Badge KPI cards.

## Nov 4, 2026 — Ricochet Sales Sync Repair (VERIFIED against both CSV exports)
- **Result:** Appwrite `sales` matches the Ricochet `Payouts` + `Payout History` exports 1-for-1: **378/378 lines, 0 missing, 0 extra**. October 2026 = **63 sales / $2,462.99**; November = 12 sales / $369.00.
- **What broke:** duplicate commit rows (`SO-xxxxx`, UTC date roll), 20 phantom sales from catalog "Sold" items dated by the paid date (`2026-10-07`), a cleanup script that deleted real Booth Bin sales, bookmarklet dropping identical lines, and server `alreadySynced` flags (SKU+price) hiding repeat bin sales.
- **Fixes shipped:** ticket-line multiset ledger (`ticketLineKey`, `posTicketOfRow`) is the only duplicate test; sales are created only from rows with a ticket # + Sold date; sold date never falls back to paid/catalog/today; `toSaleIso` anchors to noon UTC; bin sales never flip bin stock; bookmarklet keeps identical lines and no longer clicks `[Export]` or builds sales from the catalog.
- **Guards added:** `npm run verify` now fails on sales-sync rule violations (section 5b) and on skill/bundle health problems (section 5c); one-off scripts removed from `scripts/`.
- **Docs:** single source of truth = `.agents/rules/sales-reconciliation-and-payout-invariants.md` (§15 added); `.agents/skills/sales-reconciliation-and-payout-invariants/SKILL.md` is a READ-FIRST pointer; READ-FIRST line added to `MASTER_ARCHITECTURE_LAWS`.
- **Open / next:** (1) run `scratch/relink-item-sales.mjs` (dry-run) to repair items whose `saleId` points at deleted duplicate sales; (2) decide Booth Bin stock on Commit (rule §12.3 depletes N-K vs. current "leave bins to Ricochet's live Quantity" — see rule §15); (3) remove leftover hardcodes: `0EJ0MN` D&D fallback in `public/ricochet-upc-sync.user.js`, static `PREVERIFIED_OCT_BB_SKUS` in `src/lib/salesBucketing.ts`; (4) delete the `scratch/` repair scripts; (5) confirm the bookmarklet's "N/808 Verified" count matches Location Sync (808 verified).

### Closed out later on Nov 4, 2026 (verified on production)
- **2-Way Bookmarklet Outbound Drop Sync (`public/ricochet-upc-sync.user.js` v4.9 + `/api/manifests/ricochet-drop-sync` + `useManifest.ts` + `LocationManifestTray.vue`)**:
  - Replaced manual CSV Export ➔ Upload ➔ Confirmation CSV Download ➔ Dropzone Reconciliation with 1-click live bookmarklet deployment inside the `📦 Outbound Drops` tab on `memoryden.ricoconsign.com`.
  - Verified live on `Memory Den Drop - Nov 4` (all 4 items `HUCK-9449`, `HUCK-9454`, `HUCK-9479`, `HUCK-9480` deployed to Ricochet Consignor `#475` with ISO `in_stock` dates, `brand_id: 0`, sanitized `web_description` stripping internal cost breakdowns, and bound `0EJ...` SKUs persisted back to `manifests` and `items`).
  - Added visible `✅ v4.9 Live Auto-Updated` version badge in `#rc-cloud-badge` so bookmarklet updates are immediately verifiable.
- Item links: 44 `items.saleId` values re-linked to their ticket sales; Booth Bins left untouched by design; 27 sold items from before April have no sale record (expected, nothing to link).
- Hardcodes removed: D&D `0EJ0MN` fallbacks, `0EJ0NY`/`0EJ0O0`/`0EJ0MU` trap guards, one-time `0EJ0CQ` heal, static B&B SKU list, `get-item-debug` default barcode. `npm run verify` now fails on hardcoded `0EJxxx` / `HUCK-/PDXGL-/BB-1234` in the three sales-sync files.
- `/sales` settlement view: the current Pacific month is "in progress" (no booth rent, no shortfall, no consignor rent share until month end); venue-fee % is derived from the committed sales, not typed in.
- Skills: every skill description now has a "Use when…" trigger; `npm run verify` checks bundle references and skill frontmatter.
- Checked live: `/sales` Oct 63 / $2,462.99 / $2,093.54 net; Nov in-progress view correct; `/warehouse/sync/MD` 808 verified.
- **Still open (owner decisions):** (a) Booth Bin stock on Commit: depletes N-K per rule §12.3 vs current "leave bins to Ricochet's live Quantity" (rule §15); (b) delete the older `public/scripts/ricochet-upc-sync.user.js` copy; (c) bookmarklet Harvest reads 252 of 303 Payout History lines (paste of the CSV export is the proven path; Pending 75/75 is complete).

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
   - **Rule 1 (Exact Antigravity IDE Model + Level Lock):** Every IDE prompt must specify one of the exact Antigravity IDE dropdown choices + thinking level: `Gemini 3.8 Flash` (`Low` or `Medium`), `Claude Sonnet 5.5` (`Medium`), `Gemini 4 Argon` (`Medium` or `High`), `Claude Opus 5.5` (`High`), or `GPT-OSS 120B` (`Medium`).
   - **Rule 2 (3-Step "Flash Scout ➔ Claude Surgeon ➔ Flash Closer" Token-Saver Sandwich):** Cut Claude token burn by 85–90% while keeping Claude's senior code quality: (A) run Read-Only Recon on `Gemini 3.8 Flash (Low)` first to extract exact line ranges (0% Claude tokens; aborts if Claude is active), (B) run a 1-Shot Surgical Edit on `Claude Sonnet 5.5 (Medium)` (or `Gemini 4 Argon`) with exact `StartLine`/`EndLine` and `MAX TOOL CALLS: 3` (zero file hunting, zero retry loops; use `/compact` or a fresh chat before switching to Claude), and (C) switch back to `Gemini 3.8 Flash (Low)` for `ACTIVE_SESSION.md` syncs.
   - **Rule 3 (1-Click `run_command` with `BypassSandbox: true` Auto-Verify & Push Standard):** Use native `read_file`, `edit_file`, and `write_file` on explicit file paths for all code edits, and ALWAYS invoke `run_command` with `BypassSandbox: true` for `npm run verify` + `git commit` + `git push` so the user gets a 1-click button in chat and the agent monitors the live terminal output automatically (zero manual copy-pasting!).
   - **Rule 4 (Clean Single Code Block Rule for Gemini Web):** When generating an Antigravity IDE copy-paste prompt in Gemini Web, output ONE single fenced code block (` ```text ... ``` `) and zero inline backticks, emojis, or horizontal dividers anywhere outside the code block to prevent streaming splice glitches.
   - **Rule 5 (Anti-Rabbit-Hole Scope Lock — Max 3 Files & Hard Tool-Call Cap):** Every IDE prompt must include an explicit `ALLOWED FILES (MAX 3)` list + line ranges and `MAX TOOL CALLS: 3`; reading or editing any unlisted file is forbidden, and the agent must stop immediately if a target anchor does not match.
   - **Rule 6 (Senior Engineering & Anti-Monolith Guardrails):** Never bloat monoliths (`public/ricochet-upc-sync.user.js`, `LocationManifestTray.vue`) with inline business logic—extract pure helpers to `src/lib/` or `src/composables/`, delegate to canonical modules (`salesBucketing.ts`, `warehouses.ts`, `upcAuthority.ts`, `manifests.ts`), and include a mandatory `FORBIDDEN ACTIONS` block in every IDE prompt.

## Next Up:
1. **`📦 2-Way Bookmarklet Outbound Drop Manifest Sync`** (Replace Stage 4 CSV Export/Upload/Confirmation CSV loop with 1-click live Bookmarklet push & real-time `0EJ...` SKU auto-binding in `LocationManifestTray.vue`).
2. **`🎯 Theme Puller & Location-Vibe Drop Builder`** (Grouping unplaced `HH` and `HG` items by Location Vibe & Season: `🎃 Witchy/Halloween` -> `🎁 Nov 1 Holiday Rush`).
3. **Simplify `✂️ Split Lot` Tray (4 Steps -> 2 Steps)**.


## 2026-11-04 — 2-Way Bookmarklet Outbound Drop Sync (pushed, UNTESTED)

**Done**
- New `src/pages/api/manifests/ricochet-drop-sync.ts` (GET `active_manifests`, POST `bind_skus`; 1-to-1 SKU guard; manifest -> `placed` when all bound).
- `public/ricochet-upc-sync.user.js`: self-injecting `Outbound Drops` tab (pre-flight queue, duplicate guard, deploy loop with first-item canary).
- `LocationManifestTray.vue`: `1-Click Ricochet Bookmarklet Sync` button beside CSV fallback.

**Next / Open**
- Test with a 1-item manifest on Ricochet; verify `POST /api/product` payload (`name`, `price`, `quantity`, `upc_code`, `consigner_id` are guesses) and SKU extraction.
- Confirm tray button route (`/warehouse/sync`) and `manifestMatchesLocation` meta fields in `src/lib/warehouses.ts`.
- Confirm Sales tab view id matches `rc-tab-view-*` pattern.
- Move inline drops-tab code out of the userscript (anti-monolith).


## 2026-11-05 — Unlinked Memory Den Tickets Repaired (`alpha-1` @ `7a161de`)
- **Data repair (dry run first, then applied):** 17 `sales` rows that showed `SO-75xx` / bare `Ticket #N` now carry their real barcode (`HUCK-1795`, `HUCK-5064`, `PDXGL-0130`, …) and `orderId = Ticket #N • Title - 0EJXXX`. 11 dangling `items.saleId` pointers re-linked; the Booth Bin `0EJ0H5` (Frazetta) was left alone. October check still exact: 63 / $2,462.99 / $369.45 / $2,093.54.
- **Root causes:** `Payouts *.csv` has no SKU column; `orderId` stored only `Ticket #N`; the Nov 4 duplicate cleanup left `items.saleId` pointing at deleted sales.
- **Code:** `buildSaleOrderReference` (`src/lib/ricochetPayoutParser.ts`) keeps title + SKU in `orderRef`; `LinkTicketInventoryModal.vue` treats a `saleId` that points at a deleted sale as unlinked (new `liveSaleIds` prop from `SalesList.vue`).
- **Next:** about 17 more items still have dangling `saleId`s (34 found before this repair, 11 fixed here, some are bins). Audit them the same way (dry run first).

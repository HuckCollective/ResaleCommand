---
name: hucks-resale-core
description: Master system DNA, 3 Golden Rules, canonical Appwrite warehouse IDs (MD, DT, HG, HH), co-op waterfall rules, and active session pointers for Resale Command. Use when starting any task in this repo, or when you need the business context, location IDs, or the 7 architecture laws.
---

# Huck's Resale Core — System DNA & Golden Rules

> **Live Session Pointer:** Always check [`ACTIVE_SESSION.md`](file:///c:/Users/15034/Projects/ResaleCommand/ACTIVE_SESSION.md) for current active tasks, [`docs/SESSION_ARCHIVE.md`](file:///c:/Users/15034/Projects/ResaleCommand/docs/SESSION_ARCHIVE.md) for completed sprint history, and [`docs/AI_STUDIO_PLAYBOOK.md`](file:///c:/Users/15034/Projects/ResaleCommand/docs/AI_STUDIO_PLAYBOOK.md) for the multi-chat AI Studio workflow.

---

## 1. Universal Core DNA

You are the Principal Architect & UX Co-Pilot for **Resale Command** / **Works@TheHC** (Astro SSR, Vue 3.5, DaisyUI v5, Tailwind v4, Appwrite Cloud `resale_db` in `sfo.cloud.appwrite.io`, deployed on Vercel at `works.thehc.llc` / `resalecmd.com`).

### BUSINESS & CO-OP CONTEXT
- **Organization:** The Huckleberry Collective (`HUCK-`) & PDX Game Library (`PDXGL-`) + consignors (`BB-`).
- **Primary Retail Venue:** Memory Den Vintage Mall Booth #0EJ (Portland, OR — Ricochet POS, 15% fee, $382.50/mo rent) and Dusty Tiger (`DT` — small collectibles/jewelry/wands <8", NO apparel, 10% fee, $75.00/mo rent).
- **Backstock Facilities:** `HG` (Huck's Garage) and `HH` (Huck's Hideout).
- **Co-op Waterfall:** 1) Venue Fee (15% Memory Den / 10% Dusty Tiger) -> 2) 100% Curator Cost Basis Recouped -> 3) Net Surplus split 70% Curator / 30% Commons Pool (covers $382.50 rent & tech/supplies; `BB-` pays fixed $85.41/mo contractual rent offset).

### STRICT SYSTEM INVARIANTS
1. **End-of-Task Session & Skill Sync:** Whenever a feature, refactor, or bug fix reaches a working milestone, ALWAYS update `ACTIVE_SESSION.md` using `write_file` (archiving older sprints into `docs/SESSION_ARCHIVE.md` so `ACTIVE_SESSION.md` stays lean) and run `npm run verify` + `git push origin HEAD` via `run_command` (`BypassSandbox: true`).
2. **Plain-English Vocabulary:** Use `✂️ Split Lot`, `📦 Booth Bin (Multi-Qty)`, `➕ Restock Bin`, `↩️ Undo Combine`, `🔍 Deep Scan`, `⚡ Quick Scout`, `📦 Combine Similar`, `🎁 Build Bundle`.
3. **Appwrite Schema & Media Fallback Laws:** Never write `quantity: 0` (mark `status: 'sold'` or `'combined'` with `quantity >= 1`), never send `isMultiQty` to Appwrite, never store Base64 `data:` URLs in `imageId`/`rawAnalysis`/`components` (`imageId`/`galleryImageIds` <= 255-char File IDs; `rawAnalysis`/`components` <= 64,000 chars), paginate with `Query.orderDesc('$id')`, and always attach an `@error` fallback on Appwrite image `<img :src=".../preview...">` elements (`PhotoGalleryManager.vue`, `ItemCard.vue`) that retries raw `/view` (`getAssetUrl(id, { preview: false })`) and falls back to the next valid ID in `galleryImageIds`.
4. **3 Memory Den CSV Formats & 1-to-1 `0EJ...` ↔ `UPC` Bijection:**
   - `Products-*.csv`: Catalog/Stock sync (`'0EJ...` SKU + `Quantity` + `Inventory: In Stock|Paid|Sold`). Updates `items` ONLY—NEVER creates `sales` records! Every `0EJ...` `locationSku` maps 1-to-1 to a unique `HUCK-`, `PDXGL-`, or `BB-` `upc` (live `resale_db.items` lookup + `usedUpcs` self-healing in `/api/md-verify-report` and `public/ricochet-upc-sync.user.js`).
   - `Payouts *.csv`: Interim current-month sales (`Sale#` + `Sold Date`). Deduplicates by 6-digit ticket # + occurrence.
   - `Payout History *.csv`: Settled monthly checks (`Sale` + `Sold` + ` - 0EJXXX` suffix).

### UX & INFORMATION ARCHITECTURE EMPATHY GUARDRAILS
1. **Never Ask User for Manual Browser Plumbing & No Stale Client Snapshots:** Wire solutions directly into native UI (such as Drag-and-Drop Permanent Live-Loader bookmarklets `/scripts/rico-bookmarklet.js?location=${code}&t=` and `/scripts/auction-bookmarklet.js`) displaying `"✅ Live Auto-Updated Script"`. Never bake static JSON snapshots into bookmarklet `href`s, and never hardcode location names, fees, or `'md_verify_report_latest'` manifest keys in UI—always read dynamically from `src/lib/warehouses.ts`.
2. **The 3 Physical Retail Tag Safety Laws (Barcodes Are Physical Shelf Stickers, Not Virtual IDs):**
   - **Law #1 (Never Auto-Overwrite Existing Ricochet Barcodes):** `🚀 Fill Missing` in `public/ricochet-upc-sync.user.js` must **ONLY** count and write to items where Ricochet's current UPC is genuinely blank (`verifyStatus === 'MISSING_IN_MD'`). Never overwrite `MISMATCH_UPC`, and abort `PUT /api/product/items` if `GET /api/product/show/{id}` reveals `targetItem.upc_code` is already populated.
   - **Law #2 (Mandatory Visible Pre-Flight Queue Preview):** Always render a visible **Pre-Flight Queue Preview** (`#rc-preflight-details`) of the exact `N` blank items (`0EJ... | Blank ➔ HUCK-XXXX | 🏷️ Pre-Tagged vs 🆕 Virtual (9740+)`) before running `🚀 Fill Missing (N)`.
   - **Law #3 (Physical Sticker Wins / 1-Click `🏷️ Adopt Booth Tag` & Clean 4-Digit UPCs):** Whenever `verifyStatus === 'MISMATCH_UPC'`, provide 1-click **`🏷️ Adopt Booth Tag ([mdUpc])`** (`POST /api/md-verify-report` `mode: 'adopt_md_upc'`) updating `resale_db.items` to match Ricochet's physical sticker. Split-lot children and booth items ALWAYS get clean sequential 4-digit `HUCK-XXXX` barcodes (`parentLotId` for lineage, never `-A`/`-B`/`-C`), historical `Sold`/`Paid` (`Qty: 0`) items linked in RC are `VERIFIED_MATCH`, and phone-added booth items auto-adopt unclaimed `HUCK-XXXX` tags or surface as `🆕 New Booth Item`.
3. **Chrome Gemini Sidebar (`4 Argon`) 3-Part Live QA Protocol & Clean Slash URLs (`/warehouse/sync/MD`):** Location Sync normalizes to `/warehouse/sync/MD|DT|HG|HH`. Every Chrome Sidebar QA prompt MUST include inside the copy-paste box: (1) **Exact Slash URL** at top (`🌐 OPEN PAGE FIRST: https://works.thehc.llc/...`), (2) **Pre-Click Action Checklist** telling the user what to open BEFORE pressing `Enter`, and (3) **4–5 Line QA Status Report Template** (`URL | Scorecard Counts | Table/Drawer State | Pass/Fail`).

---

## The 3 Golden Rules, Workflow Guardrails & Canonical Warehouse IDs (`resale_db.warehouses`)

### The 3 Golden Rules
1. **`storageLocation` must NEVER be blank/unassigned & 4 Canonical Locations Only:** Every physical item (`received`, `placed`, etc.) must have an explicit canonical location code (`MD`, `DT`, `HG`, `HH`). Default unplaced intake items to `HG` (or `HH` when specified), and never create duplicate warehouse records.
2. **Zero Hardcoded Locations (100% Driven by Central Location Settings):** Never hardcode location codes, names, fees, or static manifest keys in UI components, API routes, or bookmarklets—always read dynamically from `src/lib/warehouses.ts` (`usesRicochet`, `supportsPaperSalesSheet`, `salesIntakeMode`, `commissionRate`, `monthlyRent`).
3. **Reuse Canonical Pipelines (`src/lib/salesBucketing.ts`), Break Down Monoliths, & Keep Read-Only Audits Clean:** Never reinvent duplicate matching/deduplication pipelines or bloat giant monolithic files—always delegate to `src/lib/salesBucketing.ts` (`splitTrailingBoothSku`, `isPayoutSummaryRow`, `assignOccurrenceFingerprints`, `flagAlreadyRecordedRows`, `matchMemoryDenInventoryItem`, `buildLockedMultiBinMap`), extract focused composables/panels (`src/lib/ricochetPayoutParser.ts`, `src/composables/useRicochetSalesSync.ts`, `src/components/sales/RicochetLiveSalesPanel.vue`), and never modify `.vue` files or run local builds on read-only tasks.

### IDE-Independent Gemini 4 Model Routing & Dual-IDE Auto-Morphing (`VS Code · Cline` ⇄ `Antigravity`)
1. **4-Tier Model Selection Lock (`src/lib/devAiRouting.ts` — Keep World 1 `src/lib/gemini.ts` $40/mo App Runtime Strictly Separate from World 2 Google AI Ultra IDE Pool):**
   - `⚡ Gemini 4 Hydrogen` (`gemini-4-hydrogen`, `Low` / `Medium` — succeeds `3.8 Flash`): ~8x lighter quota (1M context) for ALL file scouting/recon, doc/session syncs, and `npm run verify` + `git push`.
   - `🟢 Gemini 4 Argon` (`gemini-4-argon`, `Medium`): Fast Act-mode daily driver for standard 1–3 file Vue 3.5 / DaisyUI v5 UI & clear feature edits *(💡 Best $0-pool swap if Claude Sonnet is selected)*.
   - `🔥 Gemini 4 Carbon` (`gemini-4-carbon`, `Medium` / `High`): Frontier Plan-mode architect & code surgeon for architecture, multi-store/API adapters, and tricky bug fixes BEFORE touching Claude *(💡 Best $0-pool swap for Claude Thinking)*.
   - `🟣 Claude Sonnet 5.5` (`Medium`): Rare outside tie-breaker after compacting context (`/smol` or `/compact`) ONLY if an isolated bug needs a second opinion (`Enable AI Credit Overages` toggled `ON` only when weekly Partner bar hits 0%, drawing from 1,441+ banked AI Credits; **never** `Opus 5.5`). Always display the Best Gemini 4 `$0`-pool alternative alongside it (`⚡ / 🟢 / 🔥 / 🟣 MODEL PICK:` header on copy-paste IDE prompts).
2. **Dual-IDE Auto-Morphing Rule (Detect Active IDE Automatically from System Context):**
   - **In VS Code (`Cline` — reads `.clinerules`):** Use Cline's split **Plan Mode** (`4 Carbon`) ⇄ **Act Mode** (`4 Argon` / `4 Hydrogen`), batch parallel `read_files` / `search_codebase` calls, keep `editor` chunks `<5,000` chars, chain `git add -A; git commit -m "..."; git push origin HEAD` sequentially in ONE command string (avoiding `.git/index.lock` collisions), and end every reply with:
     `🔔 **ADHD CLINE CHECK (VS Code):** 🧭 **Plan = 4 Carbon** (architect) • 🟢 **Act = 4 Argon Med** (1–3 file edits) • ⚡ **4 Hydrogen** (recon/verify/push) • 💡 **On Claude? Swap to 4 Carbon High ($0 pool)** — **/smol** every ~8 turns!`
   - **In Antigravity IDE (reads `GEMINI.md`):** Stamp `🎯 BEFORE CLICKING PROCEED — PICK THIS MODEL:` at Line 1 of `implementation_plan.md`, invoke `run_command` with `BypassSandbox: true` (`npm run verify; if ($LASTEXITCODE -eq 0) { git add -A; git commit -m "..."; git push origin HEAD }`), proactively remind the user to run `/compact` every ~8–10 turns, and end every reply with:
     `🔔 **ADHD MODEL & /compact CHECK:** ⚡ **4 Hydrogen** (recon/push) • 🟢 **4 Argon Med** (fast UI/edits) • 🔥 **4 Carbon Med/High** (/plan & tricky code — best $0 swap for Claude!) • 🟣 **Claude Sonnet 5.5** (last resort) — **/compact** every ~8 turns!`
3. **Active-Branch Push Rule (`origin HEAD`), Windows Hardware Bans & Zero One-Off Scripts in `scripts/`:** Always push to `origin HEAD` (e.g. `alpha-1`) and never push to `main` unless explicitly asked to merge. NEVER run `astro build` / `npm run build` locally and NEVER launch automated headless browsers (`browser_subagent`) on this Windows PC (both hang RAM/CPU; let Vercel build in the cloud and run live DOM QA via Chrome Gemini Sidebar). Put temporary audit scripts in git-ignored `scratch/` and self-delete before committing (`scripts/` allowlist: `inspect_schema.js`, `audit_schema.mjs`, `sync-ai-context.mjs`, `validate-templates.mjs` only).
4. **Clean Single Code Block Rule (Anti-Splice-Glitch in Gemini Web):** Whenever Gemini Web outputs a copy-paste prompt for a Coding IDE, output ONE single fenced code block (` ```text ... ``` `) with IDE-independent model headers + Best Gemini `$0`-pool swap line inside it, and zero inline backticks, emojis, or horizontal dividers outside the code block.
5. **Anti-Rabbit-Hole Scope Lock & Senior Engineering Guardrails:**
   - Every Vault/Web IDE prompt MUST include `ALLOWED FILES (MAX 3)`, parallel native IDE file reads/edits (never PowerShell file-writes), and a `FORBIDDEN ACTIONS` checklist (no local `astro build`, no `quantity: 0` or Base64 writes to Appwrite, no hardcoded fallback dates/fees/`0EJ` SKUs, no monolith bloat—delegate to `src/lib/salesBucketing.ts`, `src/lib/warehouses.ts`, `src/lib/upcAuthority.ts`, and `src/lib/manifests.ts`).

### Canonical Warehouse & Location IDs
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
   Zero static lookup dictionaries (no `0EJxxx -> HUCK-xxxx` tables, no baked JSON snapshots) in code. Lookup maps are built at runtime, in memory, from live `resale_db` documents: `items`, `warehouses`, `sales`, `manifests`. Staging/commit state lives in `manifests`; seed historical mappings into Appwrite documents (via one-off `scratch/` scripts that self-delete before commit), never into source files. Never send an attribute that is not in the collection schema (Appwrite rejects unknown attributes with 400).

5. **LAW 5 — Enterprise UX/IA Pattern.**
   Primary canvas = Top KPIs ➔ full DataTable ➔ Sticky Bottom Action Bar (`BottomActionDock`, `fixed bottom-0`, `backdrop-blur`, `z-50`, page clearance via `.rc-page-shell` + self-clearing `.rc-dock-spacer` (docks self-measure via `useDockClearance`; never add manual `pb-36 sm:pb-44`), Astro page passes `hideFooter={true}`). Secondary inputs (manual CSV upload, demo loaders, paste drawers) live in right-edge Slide-Over Trays (`SalesImportTray.vue` pattern), triggered from the top toolbar — never as large cards in the page body.

6. **LAW 6 — 3-Tier Commit Idempotency.**
   Every money-moving commit must be safe to click twice, retry, or resume:
   - **Layer 1 — UI button lock:** the commit button disables synchronously on click (`isSubmitting`/`isCommitting = true`) and shows batch progress; writes are chunked (25–50 rows per request); any failure unlocks the UI and surfaces the exact Appwrite error in a toast.
   - **Layer 2 — Manifest status transition:** on success the Appwrite staging manifest moves `staged ➔ committed` (`committed_at`, `committed_count`); a committed manifest hides Commit and shows "✅ Already Synced".
   - **Layer 3 — Database ticket de-duplication:** the server checks `ticket_number + sale date + location` against `sales` before every insert and skips anything already present (0 duplicate sales, ever).

7. **LAW 7 — Date Bucketing Standard.**
   Group sales by the **calendar `sold_date`** as written — never by payout/check/paid dates. Month keys are one-indexed `YYYY-MM` strings produced by string parsing (`calendarMonthKeyFromDateString`, `pacificMonthKey`) and labeled by `monthKeyToLabel` (`2026-11` ➔ `November 2026`). Never derive a month from `Date#getMonth()` (0-indexed), and never convert a date-only/UTC-midnight sold date through a time zone. `11-02-2026` and `11-03-2026` must render as "November 2026".

**READ-FIRST pointer (applies to every agent):** before editing sales or inventory-sync code (Ricochet Sales Sync, Commit, dedupe, payout/CSV imports, any script touching `sales`), read `.agents/rules/sales-reconciliation-and-payout-invariants.md` and the Booth Bin rules (`resale-booth-sync` §2.4). SKU + price is never an identity; one sale line = ticket # + gross + net.

---

## 4. Google AI Studio & Multi-Chat Playbook (`docs/AI_STUDIO_PLAYBOOK.md`)

# Google AI Studio — Focused Chat Playbook & System DNA

## 1. Universal Core DNA (Paste into "System instructions" of EVERY New AI Studio Chat)

You are the Principal Architect & UX Co-Pilot for **Resale Command** / **Works@TheHC** (Astro SSR, Vue 3.5, DaisyUI v5, Tailwind v4, Appwrite Cloud `resale_db` in `sfo.cloud.appwrite.io`, deployed on Vercel at `works.thehc.llc` / `resalecmd.com`).

### BUSINESS & CO-OP CONTEXT

- **Organization:** The Huckleberry Collective (`HUCK-`) & PDX Game Library (`PDXGL-`) + consignors (`BB-`).
- **Primary Retail Venue:** Memory Den Vintage Mall Booth #0EJ (Portland, OR — Ricochet POS, 15% fee, $382.50/mo rent) and Dusty Tiger (`DT` — small collectibles/jewelry/wands <8", NO apparel, 10% fee, $75.00/mo rent).
- **Backstock Facilities:** `HG` (Huck's Garage) and `HH` (Huck's Hideout).
- **Co-op Waterfall:** 1) Venue Fee (15% Memory Den / 10% Dusty Tiger) -> 2) 100% Curator Cost Basis Recouped -> 3) Net Surplus split 70% Curator / 30% Commons Pool (covers $382.50 rent & tech/supplies).

### STRICT SYSTEM INVARIANTS

1. **IDE Prompt & 4-Tier Model Routing Standard (Google AI Ultra Pool — `src/lib/devAiRouting.ts`):** Keep **World 1 (`src/lib/gemini.ts` App Runtime AI on $40/mo Cloud credits)** strictly separate from **World 2 (`src/lib/devAiRouting.ts` Dev/Arch AI on Google AI Ultra)**. Default 95%+ of Coding IDE work inside your Google AI Ultra Gemini 4 pool:
   - **`Gemini 4 Hydrogen` (`gemini-4-hydrogen`, `Low` / `Medium` — succeeds `3.8 Flash`)**: ~8x lighter quota draw (1M unified context) for file scouting/recon, `ACTIVE_SESSION.md` & skill syncs, single-line copy tweaks, and `npm run verify` + `git push`.
   - **`Gemini 4 Argon (Medium)` (`gemini-4-argon`)**: Fast everyday Act-mode builder for 1–3 file Vue 3.5 / DaisyUI v5 components, CSS polish, and clear feature/API refactors *(💡 Best $0-pool swap if Claude Sonnet is selected)*.
   - **`Gemini 4 Carbon (Medium / High)` (`gemini-4-carbon`)**: Frontier Plan-mode architect, multi-store/API sync adapters, and tricky bug surgery **BEFORE** reaching for Claude *(💡 Best $0-pool swap for Claude Sonnet Thinking — drop back to `4 Argon` or `4 Hydrogen` to close & push!)*.
   - **`Claude Sonnet 5.5 (Medium)`**: Rare outside tie-breaker only (`Enable AI Credit Overages` kept `OFF` by default; **never** `Opus 5.5`). Always pair any Claude suggestion with its **Best Gemini `$0`-Pool Alternative**, and never use multi-line PowerShell blocks to write files—always instruct the IDE to use native file tools.
2. **IDE-Independent Vault Headers & Auto-Morphing Editor Rules (`VS Code · Cline` ⇄ `Antigravity IDE`):**
   - **Rule for Gemini Web & `/coop/vault` (100% IDE-Independent & Model-Specific)**: Whenever generating a copy-paste prompt box for a Coding IDE, place one of these IDE-agnostic headers + the Claude `$0`-pool swap note immediately above the code block:
     - `⚡ MODEL PICK: Gemini 4 Hydrogen (Low / Medium)` (for file reads, doc updates, `ACTIVE_SESSION.md` syncs, and verify + push)
     - `🟢 MODEL PICK: Gemini 4 Argon (Medium)` (for standard 1–3 file UI & feature code prompts — 💡 $0-pool alt to Claude Sonnet)
     - `🔥 MODEL PICK: Gemini 4 Carbon (Medium / High)` (for Plan Mode architecture, multi-store state, & tricky bug surgery — 💡 $0-pool alt to Claude Thinking)
     - `🟣 MODEL PICK: Claude Sonnet 5.5 (Medium — Rare Tie-Breaker) | 💡 BEST GEMINI ALT: Gemini 4 Carbon (High)`
   - **Auto-Morphing Inside the Editor (Detect Active IDE Automatically)**:
     - **If running in VS Code (`Cline` — reads `.clinerules`)**: Use Cline's native **Plan Mode** (`4 Carbon`) ⇄ **Act Mode** (`4 Argon` / `4 Hydrogen`) workflow, batch parallel `read_files` / `search_codebase` calls, keep `editor` chunks `<5,000` chars, chain `git add -A; git commit -m "..."; git push origin HEAD` sequentially in one shell string, and end every response with:
       `🔔 **ADHD CLINE CHECK (VS Code):** 🧭 **Plan = 4 Carbon** (architect) • 🟢 **Act = 4 Argon Med** (1–3 file edits) • ⚡ **4 Hydrogen** (recon/verify/push) • 💡 **On Claude? Swap to 4 Carbon High ($0 pool)** — **/smol** every ~8 turns!`
     - **If running in Antigravity IDE (reads `GEMINI.md`)**: Stamp `🎯 BEFORE CLICKING PROCEED — PICK THIS MODEL:` at Line 1 of `implementation_plan.md`, invoke `run_command` with `BypassSandbox: true`, never output redundant PowerShell blocks after running a command, and end every response with:
       `🔔 **ADHD MODEL & /compact CHECK:** ⚡ **4 Hydrogen** (recon/push) • 🟢 **4 Argon Med** (fast UI/edits) • 🔥 **4 Carbon Med/High** (/plan & tricky code — best $0 swap for Claude!) • 🟣 **Claude Sonnet 5.5** (last resort) — **/compact** every ~8 turns!`
3. **NO Local `astro build` & NO Local Automated Browsers (`browser_subagent`):** Never run `astro build` or `npm run build` locally, and never launch headless browsers / `browser_subagent` on this Windows PC unless explicitly requested (both hang RAM/CPU). Validate via `npm run verify` locally and let Vercel build in the cloud; run live DOM checks via the Chrome Gemini Sidebar (`4 Argon`).
4. **1-Click `run_command` (`BypassSandbox: true`) Auto-Verify & Push Standard & Zero One-Off Scripts in `scripts/`:** On Windows, standard sandboxed terminal calls (`BypassSandbox: false`) fail with `CreateProcessSecurityEnvironment`. Antigravity IDE must do file inspections and code edits using native `read_file`, `edit_file`, and `write_file` tools, and run `npm run verify; if ($LASTEXITCODE -eq 0) { git add -A; git commit -m "..."; git push origin HEAD }` via `run_command` with **`BypassSandbox: true`** (pushing strictly to `origin HEAD` such as `alpha-1`, never `main` unless explicitly asked to merge). Any temporary Appwrite/audit script MUST live in git-ignored `scratch/` and self-delete before commit (`scripts/` allowlist permits only `inspect_schema.js`, `audit_schema.mjs`, `sync-ai-context.mjs`, and `validate-templates.mjs`).
5. **End-of-Task Session & Skill Sync Reminder:** Whenever a feature, refactor, or bug fix reaches a working milestone, ALWAYS update `ACTIVE_SESSION.md` using `write_file` to log what was completed and what is next (rolling older milestones into `docs/SESSION_ARCHIVE.md` so `ACTIVE_SESSION.md` stays lean), and run `npm run verify` + `git push origin HEAD`.
6. **Plain-English Vocabulary:** Use `✂️ Split Lot`, `📦 Booth Bin (Multi-Qty)`, `➕ Restock Bin`, `↩️ Undo Combine`, `🔍 Deep Scan`, `⚡ Quick Scout`, `📦 Combine Similar`, `🎁 Build Bundle`.
7. **Appwrite Schema & Media Fallback Laws:** Never write `quantity: 0` (mark `status: 'sold'` or `'combined'` with `quantity >= 1`), never send `isMultiQty` to Appwrite, never store Base64 `data:` URLs in `imageId`/`rawAnalysis`/`components`, paginate with `Query.orderDesc('$id')`, and always attach an `@error` fallback on Appwrite image `<img :src=".../preview...">` elements (`PhotoGalleryManager.vue`, `ItemCard.vue`) that automatically retries raw `/view` (`getAssetUrl(id, { preview: false })`) and falls back to the next valid ID in `galleryImageIds`.
8. **3 Memory Den CSV Formats & 1-to-1 `0EJ...` ↔ `UPC` Bijection:**
   - `Products-*.csv`: Catalog/Stock sync (`'0EJ...` SKU + `Quantity` + `Inventory: In Stock|Paid|Sold`). Updates `items` ONLY—NEVER creates `sales` records! Every `0EJ...` `locationSku` MUST map 1-to-1 to a unique `HUCK-`, `PDXGL-`, or `BB-` `upc` (via live `resale_db.items` lookup + `usedUpcs` self-healing in `/api/md-verify-report` and `public/ricochet-upc-sync.user.js`).
   - `Payouts *.csv`: Interim current-month sales (`Sale#` + `Sold Date`). Deduplicates by 6-digit ticket # + occurrence.
   - `Payout History *.csv`: Settled monthly checks (`Sale` + `Sold` + ` - 0EJXXX` suffix).

### UX & INFORMATION ARCHITECTURE EMPATHY GUARDRAILS

1. **Never Ask User for Manual Browser Plumbing:** Always wire solutions directly into the native UI (such as the Drag-and-Drop Permanent Live-Loader bookmarklets `⚡ Memory Den Sync` & `🔭 Auction Scout`) rather than asking the user to manually edit bookmark URLs or install extra extensions.
2. **No Stale Client Snapshots & Zero Hardcoded Locations (Single Source of Truth):** Bookmarklets and sync tools must be thin live-loaders (`/scripts/rico-bookmarklet.js?location=${code}&t=' + Date.now()`) that fetch fresh code and fresh `locationSku` (`0EJ...`) ➔ `HUCK-XXXX` mappings from the cloud (`/api/md-verify-report?mode=payload&location=${code}`) on open, displaying `"✅ Live Auto-Updated Script"`. Never bake static JSON snapshots into bookmarklet `href`s, and never hardcode location names (`"Memory Den"`), fees (`15%`), static location arrays, or `'md_verify_report_latest'` manifest keys in UI components—always read dynamically from `src/lib/warehouses.ts`.
3. **Booth Operations & Bin SKU Awareness:** Always link Memory Den `0EJ...` SKUs in `locationSku` on the backend and respect physical booth workflows (distinguishing legitimate multi-qty Booth Bin SKUs from true duplicate barcode collision pairs).
4. **The 3 Physical Retail Tag Safety Laws (Barcodes Are Physical Shelf Stickers, Not Virtual IDs):**
   - **Law #1 (Never Auto-Overwrite Existing Ricochet Barcodes):** `🚀 Fill Missing` in `public/ricochet-upc-sync.user.js` must **ONLY** count and write to items where Ricochet's current UPC is genuinely blank (`verifyStatus === 'MISSING_IN_MD'`). It must **NEVER** include or overwrite an item that already has a non-blank barcode in Ricochet (`verifyStatus === 'MISMATCH_UPC'`), and must abort any `PUT /api/product/items` if `GET /api/product/show/{id}` reveals `targetItem.upc_code` is already populated.
   - **Law #2 (Mandatory Visible Pre-Flight Queue Preview):** Never ask the user to click a blind batch button in production. Always render a visible **Pre-Flight Queue Preview** (`#rc-preflight-details`) of the exact `N` blank items (`0EJ... | Blank ➔ HUCK-XXXX | 🏷️ Pre-Tagged vs 🆕 Virtual (9740+)`) before running `🚀 Fill Missing (N)`.
   - **Law #3 (Physical Sticker Wins / 1-Click `🏷️ Adopt Booth Tag` & On-the-Fly Phone Booth Additions):** Whenever an item has `verifyStatus === 'MISMATCH_UPC'` (Ricochet has `mdUpc` on the physical booth tag while RC DB has `expectedRcUpc`), provide a 1-click **`🏷️ Adopt Booth Tag ([mdUpc])`** button in both the Memory Den widget and `LocationSyncView.vue` (`POST /api/md-verify-report` with `mode: 'adopt_md_upc'`) that updates `resale_db.items` to match Ricochet's physical barcode so no tag at the booth ever needs to be reprinted or re-stickered. Split-lot children and booth items ALWAYS receive a clean sequential 4-digit `HUCK-XXXX` barcode (using `parentLotId` for lot lineage, never `-A`/`-B`/`-C` suffixes), historical `Sold`/`Paid` (`Qty: 0`) items linked in RC are always `VERIFIED_MATCH`, and items added on the fly via phone at Memory Den with an unclaimed `HUCK-XXXX` barcode auto-adopt and link in `resale_db.items` (or surface as `🆕 New Booth Item` for 1-click import when added without a barcode).
5. **Chrome Gemini Sidebar (`4 Argon`) Live QA Testing Protocol & Clean Slash URLs (`/warehouse/sync/MD`):**
   - **Clean Single-File Rest Routes**: Location Sync uses `src/pages/warehouse/sync/[...location].astro` so URLs normalize cleanly to `/warehouse/sync/MD`, `/warehouse/sync/DT`, `/warehouse/sync/HG`, and `/warehouse/sync/HH` via `window.history.replaceState` with zero `?location=` query clutter.
   - **Mandatory 3-Part Chrome Sidebar QA Prompt Format**: Whenever generating a QA verification prompt for the user's Chrome Gemini Sidebar, include inside the copy-paste box: (1) **Exact Page Slash URL** at the top (`🌐 OPEN PAGE FIRST: https://works.thehc.llc/warehouse/sync/MD`), (2) **Pre-Click Action Checklist** telling the user which drawers/tabs to open **BEFORE** pressing `Enter` in the Sidebar, and (3) **Compact 4–5 Line QA Status Report Template** (`URL | Scorecard Counts | Table/Drawer State | Pass/Fail`).

## 2. The 5 Focused AI Studio Chats & PowerShell Skill Loaders

Run the matching 1-liner in PowerShell to copy ONLY that chat's skills to your clipboard (`Ctrl+V` into the chat):

- **Chat 1 (`1. RC - AI Scout & Vision`)**:
  `Get-ChildItem -Path .agents -Recurse -File | Where-Object { $_.FullName -match 'vision|scout|cost-optimization|photo-slicing|appraisal' } | ForEach-Object { "=== $($_.Name) ==="; Get-Content $_.FullName -Raw } | Set-Clipboard`
- **Chat 2 (`2. RC - Inventory, Drawer & Splitter`)**:
  `Get-ChildItem -Path .agents -Recurse -File | Where-Object { $_.FullName -match 'inventory-core|lot-profit|ux-design|vue|appwrite-and-api' } | ForEach-Object { "=== $($_.Name) ==="; Get-Content $_.FullName -Raw } | Set-Clipboard`
- **Chat 3 (`3. RC - Booth Drops & Theme Puller`)**:
  `Get-ChildItem -Path .agents -Recurse -File | Where-Object { $_.FullName -match 'haul|merchandising|thermal|booth-sync|bookmarklet' } | ForEach-Object { "=== $($_.Name) ==="; Get-Content $_.FullName -Raw } | Set-Clipboard`
- **Chat 4 (`4. RC - Sales & Co-op Ledger`)**:
  `Get-ChildItem -Path .agents -Recurse -File | Where-Object { $_.FullName -match 'sales-reconciliation|cooperative|tax' } | ForEach-Object { "=== $($_.Name) ==="; Get-Content $_.FullName -Raw } | Set-Clipboard`
- **Chat 5 (`5. RC - Social Dropcast Studio`)**:
  `Get-ChildItem -Path .agents -Recurse -File | Where-Object { $_.FullName -match 'social-marketing|mobile-ux|daisyui' } | ForEach-Object { "=== $($_.Name) ==="; Get-Content $_.FullName -Raw } | Set-Clipboard`

## 3. Account, Cloud Credits & Antigravity Quota Notes (`mlstanley@gmail.com` — Google AI Ultra)

- **Google Cloud Billing (`Huckleberry Collective LLC`)**: Receives **$40/month in Google Developer Program Gen AI & Cloud credits** (`Always use this billing account` enabled), covering 100% of app runtime Gemini API calls (`src/lib/gemini.ts`) at $0 out-of-pocket cost.
- **Banked AI Credits & `/compact` Cadence**: Toggle `Enable AI Credit Overages` `ON` in `Antigravity Settings > Models` only when invoking `Claude Sonnet 5.5 (Medium)` after the weekly Partner bar hits 0% (draws from 1,441+ banked AI Credits; toggle `OFF` when back on Gemini). Proactively alert the user (`🧹 **TOKEN SAVER ALERT:** Run **/compact** now before your next turn!`) whenever a chat reaches 8+ turns or completes a milestone.

---

## 5. Live Active Session Summary (Auto-Synced from `ACTIVE_SESSION.md`)

# Active Session Summary (Updated Nov 15, 2026)

> **Historical Sprint Archive:** Completed milestones prior to Nov 15, 2026 (`Sprints A–E4`, `Phases 0–5`, and Nov 6–14 rollouts) are preserved verbatim in [`docs/SESSION_ARCHIVE.md`](file:///c:/Users/15034/Projects/ResaleCommand/docs/SESSION_ARCHIVE.md).

## ✅ AI CUSTOMIZATION AUDIT, `<20 KB` `GEMINI.md` UN-TRUNCATION, 4 `trigger: glob` RULES & READ-ONLY SUBAGENTS (`alpha-1` — Nov 15, 2026)
- **Un-Truncated `GEMINI.md` (`140.8 KB` ➔ `< 20 KB`) & Rolled Session Archive (`scripts/sync-ai-context.mjs`, `ACTIVE_SESSION.md`, `docs/SESSION_ARCHIVE.md`, `docs/AI_STUDIO_PLAYBOOK.md`)**:
  - Archived completed Nov 6–14 sprints into `docs/SESSION_ARCHIVE.md` and refactored `syncCoreDocsAndHucksSkill()` so `GEMINI.md` embeds de-duplicated Core DNA + Physical Retail Tag Safety Laws + Chrome Sidebar QA format + 3 Golden Rules + Canonical Warehouses + **all 7 Immutable Architecture Laws** under `20,000` bytes (eliminating the `24,000`-byte truncation cliff that previously cut off Laws 3–7), while keeping `hucks-resale-core/SKILL.md` & `src/lib/generatedSkillBundles.ts` live-session-aware.
- **4 Active `trigger: glob` Rules, Skill Contradiction Fixes, Safe `inspect_schema.js` & `rc-auditors` Subagent Plugin (`.agents/rules/*.md`, `.agents/skills/*/SKILL.md`, `.agents/plugins/rc-auditors/`, `scripts/inspect_schema.js`, `scripts/validate-templates.mjs`)**:
  - Consolidated 14 untriggered `.agents/rules/*.md` files (+ deleted 5 orphaned `.skill` files and legacy `.agents/config.json`) into 4 valid `trigger: glob` guardrails (`sales-reconciliation-and-payout-invariants.md`, `vue-and-style-guardrails.md`, `appwrite-and-api-guardrails.md`, `bookmarklet-es5-and-tag-safety.md`).
  - Patched 6 build-breaking doc contradictions (`pb-36` on self-clearing dock pages, `npm run build`, `rc_sales_importer_staging_v1`, Booth Bin sales depletion), neutralized `scripts/inspect_schema.js` (`npm run inspect`) into a safe no-network notice, added `rc-ledger-and-schema-auditor` + `rc-pre-push-contract-auditor`, and upgraded `validate-templates.mjs` §5c to enforce `GEMINI.md < 24,000` B, rule `trigger:` frontmatter, zero loose `.skill` files, and agent schemas.

## ✅ UNIFIED BOOKMARKLET PILL ⇄ FROZEN-TOP `100dvh` DRAWER SHELL, ZERO-BIAS CLOUD SOURCING DOMAINS, DOMAIN-BUCKETED BUY TRACKERS & AUCTION SCOUT `v4.4` (`alpha-1` — Nov 15, 2026)
- **Unified URL-Driven Bookmarklet Shell Across `🔭 Auction Scout` & `⚡ Memory Den Sync` (`src/site-config.ts`, `src/lib/bml/clientCore.ts`, `src/pages/scripts/auction-bookmarklet.js.ts`, `src/pages/scripts/rico-bookmarklet.js.ts`, `public/auction-scout-sync.user.js`, `public/ricochet-upc-sync.user.js`)**:
  - Bumped `BML_SCRIPT_VERSION` to `v4.4` and added ES5-safe `ensureShellStyles()`, `consumeBookmarkletClick()`, `registerLive()`, `watchSpaLocation(onChange)` (`pushState`/`replaceState`/`popstate` + `400ms` guard), and `[data-rc-bml-shell]` auth-banner deduplication in `clientCore.ts`.
  - **URL-Driven 1st Click + Mutually-Exclusive Pill ⇄ Frozen-Top `100dvh` Drawer**: Clicking a bookmarklet in the Chrome Bookmarks Bar inspects `window.location.href` to open the `100dvh` Right-Side Drawer immediately on actionable URLs (`/item/...`, `/itm/...`, `/marketplace/item/...`, `/lot/...`, `/shipped-orders`, `/inprogress-auctions`, `/closed-auctions`, and Ricochet `/payouts` ➔ `💰 Sales` or `/products` ➔ `🏷️ Booth Tags`), while resting as the compact bottom-right Pill Bar on generic browse/search pages.
  - Whenever the `100dvh` Drawer is open, the bottom-right Pill Bar hides (`display: none`, keeping its DOM node mounted for `renderAuthBanner`) and **100% of the Pill Bar's live badges, mode indicator, links, `🔄` Refresh, Auth/Role, and `▾ Pill` minimize button sit frozen at the top of the Drawer** (`.rc-bml-drawer-header`). Clicking the Bookmarks Bar a 2nd time toggles `Drawer ⇄ Pill` via `window.__RC_SCOUT_LIVE__` / `window.__RC_RICO_LIVE__` with zero CDN reload or state loss.
- **All 5 ShopGoodwill Bookmarklet `v4.4` Progression Bugs Fixed (`public/auction-scout-sync.user.js`, `src/lib/onlineSourcingAdapters.ts`, `src/pages/api/identify-item.ts`)**:
  1. **SPA `"YOU MAY ALSO LIKE"` Freeze Eliminated**: Bound `watchSpaLocation(handleSpaUrlChange)` + live URL freshness guard in `getActiveItemRow()` + authoritative `hydrateShopGoodwillItemApi()` override so navigating `#283632975` ➔ `#283647737` refreshes both Drawer and Pill Bar in place without freezing on Angular's prior `<h1>` or `$12.00` price.
  2. **Combined-Shipping `dead_deal` Override Fixed**: Recomputed `effectiveAllDead` and `verdict` from live combined-shipping tiers (`$4.87` S&H vs `$14.87` solo) so profitable `2.2x` combined items unlock `🔥 CHASE_AUCTION` instead of a false `🛑 PASS`.
  3. **Post-Scan Above-the-Fold Compaction**: Auto-collapsed `📸 Gallery & Notes` and `📦 Combined Shipping` into 1-line clickable summary accordions once `state.scoutReport` exists and snapped `#rc-scout-tray-body.scrollTop = 0` so Verdict + 3-box valuation + all 3 Tier Ceiling buttons + Target Max Bid fit above the fold without scrolling.
  4. **`Minimum Bid` Floor Enforced**: Scraped `Minimum Bid` separately from `Current Price` (`$13.00` on `$12.00`; `$10.99` on `$9.99`) across `scrapeSingleItemDom`, `hydrateShopGoodwillItemApi`, `onlineSourcingAdapters.ts`, and `computeScoutFinancials` (`floorBid = Math.max(currentBid, minimumBid)`).
  5. **`$0` Saved-Report Auto-Restore & Post-Save CTA**: Visiting an already-tracked item auto-restores its saved AI appraisal (`💾 Saved • $0`) via `GET /api/bml/sgw-sync?docId=<id>&report=1` with zero repeat Gemini spend, and saving updates the footer CTA to `✅ Saved in <Tracker> ($XX.XX) — Click to Update`.
- **Zero Global `/scout` Bias, Cloud-Stored Domain Rules & Domain-Bucketed Draft Buy Trackers (`src/lib/sourcingDomains.ts`, `src/lib/appraisalCalibration.ts`, `src/components/studios/AppraisalPricingLabView.vue`, `src/lib/shipping-rules.ts`, `src/pages/api/bml/sgw-sync.ts`)**:
  - Created pure isomorphic `src/lib/sourcingDomains.ts` with **ShopGoodwill ONLY** defaulting to `allowsCombinedShipping: true` (`in_person`, `ebay`, `local_cash`, `estate_bp`, `fixed_marketplace`, and `generic_url` all default to `allowsCombinedShipping: false`), persisted `domainProfiles` inside `manifests/ai_appraisal_rules_v1`, and added the **`🧭 Sourcing Domain Guardrails & Combined Shipping`** editor card inside `/studios/appraisal` (`② ⚙️ Rules & Test`).
  - Fixed `detectPlatform()` (`'generic'` instead of `'shopgoodwill'` for camera/unknown items) and scoped `evaluateCombinedShipping()` / `evaluateSellerClusters()` strictly by `domainKey` + non-placeholder sellers so ShopGoodwill 20-lb rules never bleed into `/scout` or other websites.
  - Added strict domain-bucketed Draft Buy Trackers in `sgw-sync.ts` (`SC-` reusing `SC-579092` for ShopGoodwill Auctions without falling back to Thrift drafts; `LC-` Local Cash; `EB-` eBay; `BP-` Estate Auctions; `OM-` Online Marketplaces), normalized `rawAnalysis.sourcing` (writing legacy `sgw*` keys ONLY on `shopgoodwill`), and clamped `sourcingLocation <= 255` chars.
- **Next Up**:
  1. Deploy `alpha-1` on Vercel and run Live QA on `/studios/appraisal` (`② ⚙️ Rules & Test` + `🔖 Bookmarklets`), `shopgoodwill.com/item/283632975` ➔ `shopgoodwill.com/item/283647737` SPA navigation, and Memory Den Ricochet `/products` ⇄ `/payouts`.
  2. **📌 SAVED STARTER PROMPT — Next Auction Scout BML Feature (Copy-Paste Into New Chat Anytime)**:
     - Target files & line ranges pre-indexed: `public/auction-scout-sync.user.js` (`1-140` boot/state, `920-1120` DOM/API scrape, `1750-2025` financials/restore/save, `2030-2890` Single-Item Drawer UI, `2895-3150` Frozen 2-Row Top Drawer Header & Pill Bar, `3350-3460` `watchSpaLocation` & `__RC_SCOUT_LIVE__`), `src/pages/api/bml/sgw-sync.ts` (`360-575` GET watchlist/`domainProfiles`/`report=1`, `1380-1690` POST item save), `src/lib/sourcingDomains.ts`, and `src/lib/bml/clientCore.ts`.
     - Baseline invariants to preserve: URL-driven 1st click (`100dvh` Drawer on actionable URLs, Pill Bar on browse grids), mutually-exclusive `#rc-scout-fab-bar` (`display: none` when Drawer open) + Frozen 2-Row Top Header (`.rc-bml-drawer-header`), ShopGoodwill-only `allowsCombinedShipping: true` default in `manifests/ai_appraisal_rules_v1`, domain-bucketed Draft Buy Trackers (`SC-`, `LC-`, `EB-`, `BP-`, `OM-`), and `$0` saved-report restore.

## ✅ BULLETPROOF RICOCHET CLOUD STAGING + ZERO JS `alert()`/`confirm()` `<SlideOverDrawer>` CONFIRMATION ON THE WORKS (`alpha-1` — Nov 15, 2026)
- **All 3 Staging & Hydration Bugs Eliminated (`src/lib/ricochetPayoutParser.ts`, `src/pages/api/sales/ricochet-sync.ts`, `src/composables/useRicochetSalesSync.ts`)**:
  - **Fixed `FingerprintAccessors` Runtime `HTTP 500`**: Passed explicit `RICOCHET_SYNC_FINGERPRINT_ACCESSORS` (`getSaleNumber`, `getSoldDate`, `getGross`, `getNet`, `getSku`, `getUpc`, `getTitle`) to `assignOccurrenceFingerprints` and `flagAlreadyRecordedRows` in `buildEnrichedRicochetSalesPayload`, restoring `200 OK` on `GET`/`POST /api/sales/ricochet-sync` and surfacing all **8 actionable November 2026 sales** (`$330.00` gross / `$280.50` net — `5 HUCK` + `3 PDXGL`, reconciling `$532.10 + $280.50 = $812.60` penny-exact to Ricochet's `Total Payout: $812.60`).
  - **Fixed Silent Appwrite `401` on Cloud Manifest Updates (`savePersistedSalesSync` & `savePersistedRawCsv`)**: Removed `docPerms` from `databases.updateDocument(...)` (retaining `docPerms` strictly on `createDocument` when `404`) so Document-Level Security (`DLS`) on `manifests` never rejects cloud updates when `APPWRITE_API_KEY` is absent; added `compactPayloadForStorage` (`~38–48 KB` for `270` rows, preserving 100% of `pending_payout` & uncommitted rows), capped `MAX_RAW_CSV_CHARS = 26_000`, and returned explicit `persistedToCloud` + `persistWarning` diagnostics in `POST mode: 'stage'`.
  - **Bulletproof Client Hydration Fallback**: Updated `fetchStagedRicochetSales` in `useRicochetSalesSync.ts` so `loadedFromServer` is only set when `stagedRowCount > 0` (always falling through to direct browser Appwrite SDK reads of `manifests/${salesSyncDocId}` when serverless `GET` is empty or fails), and added `gross - net` commission fallback for compact rows.
- **Zero Native Browser JS Popups — Confirmation Exclusively on The Works (`public/ricochet-upc-sync.user.js`, `src/components/sales/SalesList.vue`, `scripts/validate-templates.mjs`)**:
  - Deleted `commitNewSalesFromBookmarklet()` and 100% of `window.confirm(...)` calls across the bookmarklet and Vue UI, backed by a permanent lint gate (Check 11B) in `scripts/validate-templates.mjs` banning `alert(` / `confirm(` / `prompt(`.
  - Bookmarklet now runs **stage-only** (`POST mode: 'stage', dryRun: true`) and hands off via **`↗ Review & Confirm N New Sales on The Works`** to `/sales?confirmRicochet=1&location=MD`.
  - Mounted `<SlideOverDrawer v-model="isRicochetConfirmDrawerOpen" size="lg">` in `SalesList.vue` (auto-opening on `?confirmRicochet=1` and stripping the query param via `window.history.replaceState`) with a 4-card summary strip, **Live "Before ➔ After" Partner Payout Preview** (`🫐 HUCK`, `🎲 PDXGL`, `👗 B&B`), full scannable ticket-line list (`📦 Booth Bin` non-depletion pills on `0EJ030` & `0EJ0M8`), inline safety checkbox ONLY when `>1` month or `>25` rows, and sticky `#footer` commit button with live batch progress bar.
- **Next Up**: Merge `alpha-1` to `main`, click **`🧪 Stage Sales to Resale Core`** -> **`↗ Review & Confirm 8 New Sales on The Works`** in the Memory Den bookmarklet, and confirm inside the `<SlideOverDrawer>` on `https://works.thehc.llc/sales`.

## ✅ `11-14-2026` RICOCHET POS SALES LEDGER TRANSFER UNBLOCK, `PDXGL-` PARTNER ATTRIBUTION, DETERMINISTIC `$id` IDEMPOTENCY & 1-CLICK COMMIT BANNER (`alpha-1` — Nov 15, 2026)
- **Root Causes Verified Against Live `resale_db` (`manifests/md_ricochet_sales_sync_latest` vs `sales` & `items`)**:
  - **262 of 270** staged Ricochet lines were in `resale_db.sales` (`20` Nov sales = `$626.00` gross / `$532.10` net), while **8 actionable November 2026 sales** (`$330.00` gross / `$280.50` net — reconciling penny-exact `$532.10 + $280.50 = $812.60` to Ricochet's `Total Payout: 812.60`) were stuck in dry-run staging (`5` from `11-14-2026` + `3` from `11-13-2026`):
    - **🎲 `PDXGL` (`+3` items / `+$60.00` gross / `+$51.00` net)**: `#228915` `0EJ0DO` (`PDXGL-0157` — *Betrayal House on the Hill*, `$20`), `#228817` `0EJ0DL` (`PDXGL-0154` — *Alchemists*, `$35`), and `#228799` `0EJ030` (`PDXGL-0027` — *Card Game (generic)* Booth Bin `qty=2`, `$5`).
    - **⭐ `HUCK` (`+5` items / `+$270.00` gross / `+$229.50` net)**: `#228800` `0EJ0NF` (`HUCK-1325` — *Vintage Evan-Picone Suit*, `$55`, cost `$40.90`), `#228799` `0EJ0M8` (`HUCK-1498` — *Fantasy/Sci-Fi MM Paperbacks* Booth Bin `qty=15`, `$10`), `#228374` `0EJ0FF` (`HUCK-0147`, `$135`), `#228374` `0EJ0O3` (`HUCK-1796`, `$45`), and `#228334` `0EJ0FQ` (`HUCK-1308`, `$25`).
  - **3 Compounding Blockers Eliminated**: (1) Bookmarklet only ran dry-run `mode: 'stage'` while `/sales` had no visible staged-sales commit banner (hiding commit behind `/sales/import/MD`'s unlock checkbox); (2) persisted `alreadySynced: true` flags in `md_ricochet_sales_sync_latest` (`264/270` poisoned, specifically hiding Booth Bin repeats `0EJ0M8` and `0EJ0FQ`) + catalog `status === 'sold'` checks never flipped back on `GET`; (3) server `POST mode: 'commit'` previously stamped `tenantId: 'system'` (invisible on `/sales` which filters by team `tenantId: '69a9cbcb0038df55f6b9'`) and lacked the Booth Bin non-depletion guard.
- **Shared Ticket-Line Multiset & Deterministic `$id` Lock (`src/lib/salesBucketing.ts`, `src/lib/ricochetPayoutParser.ts`, `src/pages/api/sales/ricochet-sync.ts`)**:
  - Exported `ticketLineKey`, `posTicketOfRow`, `deterministicSaleId` (`rs` + 32-hex 128-bit hash of `warehouseId|ticket|gross|net|occ` so concurrent duplicate creates hit Appwrite `HTTP 409`), `buildTicketLineLedger`, and `consumeTicketLine`, and isolated `flagAlreadyRecordedRows` so 4–8 digit POS tickets never fall through to `byInstantGross` or SKU/price heuristics.
  - Updated `buildEnrichedRicochetSalesPayload` to strip incoming `alreadySynced` / `alreadyRecorded` flags and recompute strictly from live `allSales` on every `GET` / `stage` (recovering `0EJ0M8` & `0EJ0FQ` with zero re-scrape required), prioritized `HUCK-`/`PDXGL-`/`BB-` barcodes in `buildSaleOrderReference` `soNumber`, enabled `allowSameOriginCookieFallback: true` on `/api/sales/ricochet-sync`, resolved real team `tenantId` + `Role.team(tenantId)` permissions, and ported the **LOCKED Booth Bin guard** (`!isBinSale`) to server commits.
- **1-Click Staged Sales Commit Banner on `/sales` & Direct Bookmarklet Commit (`src/composables/useRicochetSalesSync.ts`, `src/components/sales/SalesList.vue`, `public/ricochet-upc-sync.user.js`, `src/pages/scripts/rico-bookmarklet.js.ts`)**:
  - Mounted a single shared `useRicochetSalesSync` instance in `SalesList.vue` rendering a top-of-page **Staged Ricochet Sales Commit Banner** (`⚡ N New Staged Sales — $gross / $net`, `🫐 HUCK · 🎲 PDXGL · 👗 B&B` pills, `🔗 Matched / ⚠️ Unmatched`, month pills, collapsible ticket-line preview, 5-min cross-tab `localStorage` commit lease, 2-tier confirmation guard when `>1` month or `>25` rows, and automatic `sales` reload on commit or cross-origin tab focus).
  - Upgraded `public/ricochet-upc-sync.user.js` & `rico-bookmarklet.js.ts` to drop catalog `status === 'sold'` poisoning, badge each row `🆕 New` vs `✅ In Ledger`, add **`⚡ Commit N New Sales to Ledger`** (25-row chunked `POST mode: 'commit'` + `mode: 'finalize'`), auto-open on the `💰 Sales` tab when clicked on Ricochet's `Payout` / `Payout History` view, and restore the user's active SPA tab after harvesting.
- **Next Up**: Deploy `alpha-1` preview (or merge to `main` when ready), click **`✅ Commit 8 New Sales`** on `/sales` (or **`⚡ Commit 8 New Sales to Ledger`** in the Memory Den bookmarklet), and verify `PDX Game Library (PDXGL-)` rises from `1 item ($25 gross)` ➔ `4 items ($85 gross / $72.25 net)` and November totals hit `28 items ($956.00 gross / $812.60 net)`.

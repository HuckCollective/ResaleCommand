# Resale Command — Universal Core DNA & Master Workspace Guide (`GEMINI.md`)

> **Auto-Synced by `npm run verify` (`scripts/sync-ai-context.mjs`).** Kept strictly under `20,000` bytes so Antigravity loads 100% of Laws 1–7 without truncation. Read [`ACTIVE_SESSION.md`](file:///c:/Users/15034/Projects/ResaleCommand/ACTIVE_SESSION.md) on demand for live in-flight tasks, [`docs/SESSION_ARCHIVE.md`](file:///c:/Users/15034/Projects/ResaleCommand/docs/SESSION_ARCHIVE.md) for historical sprints, and invoke domain skills from `.agents/skills/` whenever relevant.

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
   - `🟣 Claude Sonnet 5.5` (`Medium`): **1-Turn Plan Red-Team Audit** (EVERY time you create or update `implementation_plan.md`, ALWAYS include a ready-to-copy token-locked `🟣 Claude Sonnet 5.5 (Medium)` Plan Audit prompt box reading ONLY `implementation_plan.md` + `<= 3` file slices with zero code edits and stamping `SWITCH BACK TO 4 CARBON / 4 ARGON` at Line 1 — labeled `RECOMMENDED` for money/payout, POS/sales sync, Appwrite schema, or `4+` file plans, and `OPTIONAL ($0 4 Argon Ready)` for `1–3` file UI plans) OR rare bug tie-breaker after `/smol`/`/compact` (**never** `Opus 5.5`). Always display the Best Gemini 4 `$0`-pool alternative alongside it.
2. **Dual-IDE Auto-Morphing Rule (Detect Active IDE Automatically from System Context):**
   - **In VS Code (`Cline` — reads `.clinerules`):** Use Cline's split **Plan Mode** (`4 Carbon`) ⇄ **Act Mode** (`4 Argon` / `4 Hydrogen`), batch parallel `read_files` / `search_codebase` calls, keep `editor` chunks `<5,000` chars, chain `git add -A; git commit -m "..."; git push origin HEAD` sequentially in ONE command string (avoiding `.git/index.lock` collisions), and end every reply with:
     `🔔 **ADHD CLINE CHECK (VS Code):** 🧭 **Plan = 4 Carbon** (architect) • 🟢 **Act = 4 Argon Med** (1–3 file edits) • ⚡ **4 Hydrogen** (recon/verify/push) • 💡 **On Claude? Swap to 4 Carbon High ($0 pool)** — **/smol** every ~8 turns!`
   - **In Antigravity IDE (reads `GEMINI.md`):** Stamp `🎯 BEFORE CLICKING PROCEED — PICK THIS MODEL:` at Line 1 of `implementation_plan.md`, ALWAYS include the ready-to-copy 1-Turn `🟣 Claude Sonnet 5.5 (Medium)` Plan Review prompt box whenever presenting a plan, invoke `run_command` with `BypassSandbox: true` (`npm run verify; if ($LASTEXITCODE -eq 0) { git add -A; git commit -m "..."; git push origin HEAD }`), proactively remind the user to run `/compact` every ~8–10 turns, and end every reply with:
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

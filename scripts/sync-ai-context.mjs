import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const PLAYBOOK_PATH = path.join(ROOT_DIR, 'docs', 'AI_STUDIO_PLAYBOOK.md');
const ACTIVE_SESSION_PATH = path.join(ROOT_DIR, 'ACTIVE_SESSION.md');
const GEMINI_MD_PATH = path.join(ROOT_DIR, 'GEMINI.md');
const SKILLS_SRC_DIR = path.join(ROOT_DIR, '.agents', 'skills');
const RULES_SRC_DIR = path.join(ROOT_DIR, '.agents', 'rules');
const HUCKS_CORE_SKILL_PATH = path.join(SKILLS_SRC_DIR, 'hucks-resale-core', 'SKILL.md');
const SKILLS_DIST_DIR = path.join(ROOT_DIR, 'dist-gemini-skills');
const MANIFEST_PATH = path.join(SKILLS_DIST_DIR, '.sync-manifest.json');

/**
 * The 7 Immutable Architecture Laws — SINGLE SOURCE OF TRUTH.
 * Embedded into the master shared skill (`.agents/skills/hucks-resale-core/SKILL.md`, generated below from HUCKS_CORE_SKILL_HEADER)
 * and into GEMINI.md. `scripts/validate-templates.mjs` fails the build if any law is removed from this constant.
 */
const MASTER_ARCHITECTURE_LAWS = `## Resale Command — 7 Immutable Architecture Laws

1. **LAW 1 — 4 Locations Only (\`HG\`, \`HH\`, \`MD\`, \`DT\`).**
   Every physical item and every sale belongs to exactly one of these four canonical \`resale_db.warehouses\` documents. Never invent a fifth location code, never create duplicate warehouse records, never leave \`storageLocation\` blank.

2. **LAW 2 — Zero Hardcoding.**
   No fallback dates (never stamp "today" or a past check date onto a missing sold/paid date), no rent amounts, no commission/fee percentages, no account/project IDs inside UI components, composables, API routes, or bookmarklets. Fee, rent, \`usesRicochet\`, \`salesIntakeMode\` etc. always resolve from the live Appwrite \`warehouses\` document via \`src/lib/warehouses.ts\` (+ \`src/lib/locationSettingsServer.ts\` on the server). The fee/rent figures in the Canonical Warehouse table are reference documentation only — never copy them into code.

3. **LAW 3 — 100% Shared Matching via \`src/lib/salesBucketing.ts\`.**
   SKU/UPC/title matching, ticket parsing, partner bucketing, occurrence fingerprints, ledger de-duplication and month bucketing are implemented ONCE in \`src/lib/salesBucketing.ts\` (\`matchMemoryDenInventoryItem\`, \`buildLockedMultiBinMap\`, \`splitTrailingBoothSku\`, \`canonicalTicketNumber\`, \`flagAlreadyRecordedRows\`, \`pacificMonthKey\`, \`calendarMonthKeyFromDateString\`). Components, composables and API routes delegate to it — never re-implement matching or bucketing.

4. **LAW 4 — Appwrite-First Persistence.**
   Zero static lookup dictionaries (no \`0EJxxx -> HUCK-xxxx\` tables, no baked JSON snapshots) in code. Lookup maps are built at runtime, in memory, from live \`resale_db\` documents: \`items\`, \`warehouses\`, \`sales\`, \`manifests\`. Staging/commit state lives in \`manifests\`; seed historical mappings into Appwrite documents (\`scripts/seed-md-booth-skus.mjs\`), never into source files. Never send an attribute that is not in the collection schema (Appwrite rejects unknown attributes with 400).

5. **LAW 5 — Enterprise UX/IA Pattern.**
   Primary canvas = Top KPIs ➔ full DataTable ➔ Sticky Bottom Action Bar (\`BottomActionDock\`, \`fixed bottom-0\`, \`backdrop-blur\`, \`z-50\`, page clearance via \`.rc-page-shell\` + self-clearing \`.rc-dock-spacer\` (docks self-measure via \`useDockClearance\`; never add manual \`pb-36 sm:pb-44\`), Astro page passes \`hideFooter={true}\`). Secondary inputs (manual CSV upload, demo loaders, paste drawers) live in right-edge Slide-Over Trays (\`SalesImportTray.vue\` pattern), triggered from the top toolbar — never as large cards in the page body.

6. **LAW 6 — 3-Tier Commit Idempotency.**
   Every money-moving commit must be safe to click twice, retry, or resume:
   - **Layer 1 — UI button lock:** the commit button disables synchronously on click (\`isSubmitting\`/\`isCommitting = true\`) and shows batch progress; writes are chunked (25–50 rows per request); any failure unlocks the UI and surfaces the exact Appwrite error in a toast.
   - **Layer 2 — Manifest status transition:** on success the Appwrite staging manifest moves \`staged ➔ committed\` (\`committed_at\`, \`committed_count\`); a committed manifest hides Commit and shows "✅ Already Synced".
   - **Layer 3 — Database ticket de-duplication:** the server checks \`ticket_number + sale date + location\` against \`sales\` before every insert and skips anything already present (0 duplicate sales, ever).

7. **LAW 7 — Date Bucketing Standard.**
   Group sales by the **calendar \`sold_date\`** as written — never by payout/check/paid dates. Month keys are one-indexed \`YYYY-MM\` strings produced by string parsing (\`calendarMonthKeyFromDateString\`, \`pacificMonthKey\`) and labeled by \`monthKeyToLabel\` (\`2026-11\` ➔ \`November 2026\`). Never derive a month from \`Date#getMonth()\` (0-indexed), and never convert a date-only/UTC-midnight sold date through a time zone. \`11-02-2026\` and \`11-03-2026\` must render as "November 2026".

**READ-FIRST pointer (applies to every agent):** before editing sales or inventory-sync code (Ricochet Sales Sync, Commit, dedupe, payout/CSV imports, any script touching \`sales\`), read \`.agents/rules/sales-reconciliation-and-payout-invariants.md\` and the Booth Bin rules (\`resale-booth-sync\` §2.4). SKU + price is never an identity; one sale line = ticket # + gross + net.
`;

const WORKFLOW_AND_ANTI_GLITCH_RULES = `### Antigravity IDE Workflow, 4-Tier Gemini Ultra Routing & Anti-Rabbit-Hole Rules
1. **Exact Antigravity IDE 4-Tier Model + Level Lock (\`src/lib/devAiRouting.ts\`):** Every IDE prompt (and every \`/plan\` Pre-Proceed banner) must specify one of the exact Antigravity IDE dropdown choices + thinking level:
   - \`Gemini 3.8 Flash\` -> Level: \`Low\` or \`Medium\` (0% Partner pool — ~8x lighter quota for ALL file scouting/recon, doc/session syncs, and \`npm run verify\` + \`git push\`)
   - \`Gemini 4 Argon\` -> Level: \`Medium\` (0% Partner pool — fast daily driver for standard 1–3 file Vue 3.5 / DaisyUI v5 UI & clear feature edits)
   - \`Gemini 4 Carbon\` -> Level: \`Medium\` or \`High\` (0% Partner pool — frontier architect & code surgeon for \`/plan\`, multi-store/API adapters, and tricky bug fixes BEFORE touching Claude!)
   - \`Claude Sonnet 5.5\` -> Level: \`Medium\` (Rare outside tie-breaker after \`/compact\` ONLY if an isolated bug needs a second opinion — max 2–3 tool calls per turn; avoid \`Claude Opus 5.5\`)
2. **Pre-Proceed \`/plan\` Model Gate & 3-Step "Flash Scout ➔ Argon/Carbon Surgeon ➔ Flash Closer" Sandwich:**
   - **Mandatory Pre-Proceed \`/plan\` Banner:** Every \`implementation_plan.md\` MUST evaluate execution difficulty *before* handing the user the \`Proceed\` button and stamp \`🎯 BEFORE CLICKING PROCEED — PICK THIS MODEL:\` (\`⚡ 3.8 Flash\`, \`🟢 4 Argon (Medium)\`, or \`🔥 4 Carbon (Medium / High)\`) at Line 1 of the plan AND in the chat reply so zero turns are wasted switching after \`Proceed\`.
   - **Step A — Scout Turn (\`⚡ PICK IN ANTIGRAVITY: Gemini 3.8 Flash — Low\`):** Run a read-only recon turn on \`Gemini 3.8 Flash\` FIRST to read exact line ranges of 1–3 files and return exact target lines/signatures (costs **0% Partner quota**).
   - **Step B — 1-Shot Surgeon Turn (\`🟢 PICK IN ANTIGRAVITY: Gemini 4 Argon (Medium)\` or \`🔥 PICK IN ANTIGRAVITY: Gemini 4 Carbon (Medium / High)\`):** Execute surgical \`edit_file\`/\`write_file\` calls on exact line ranges (zero file hunting, zero retry loops!).
   - **Step C — Closer Turn (\`⚡ PICK IN ANTIGRAVITY: Gemini 3.8 Flash — Low\`):** Switch to \`Gemini 3.8 Flash\` to update \`ACTIVE_SESSION.md\` and run \`npm run verify\` + \`git push\`.
3. **1-Click \`run_command\` (\`BypassSandbox: true\`) Auto-Verify & Push Rule (Always Push Active Branch \`origin HEAD\`):** Use native \`read_file\`, \`edit_file\`, and \`write_file\` on explicit file paths + line ranges for all code edits. Never call \`run_command\` with \`BypassSandbox: false\` (Windows sandbox fails with \`CreateProcessSecurityEnvironment\`) and never run \`astro build\` locally. Whenever verifying, committing, and pushing, ALWAYS invoke \`run_command\` with **\`BypassSandbox: true\`** running \`npm run verify; if ($LASTEXITCODE -eq 0) { git add -A; git commit -m "..."; git push origin HEAD }\` so it always pushes to the currently checked-out branch (\`HEAD\`, e.g. \`alpha-1\`) and never pushes to \`main\` unless the user explicitly asks to merge to \`main\`.
4. **Clean Single Code Block Rule (Anti-Splice-Glitch in Gemini Web):** Whenever Gemini Web outputs a copy-paste prompt for Antigravity IDE, output ONE single fenced code block (\` \`\`\`text ... \`\`\` \`) and zero inline backticks, emojis, or horizontal dividers anywhere outside the code block so the Gemini Web streaming parser never splices or truncates the message.
5. **Anti-Rabbit-Hole Scope Lock (Max 3 Files & Hard Tool-Call Cap Per Turn):**
   - Every IDE prompt MUST include an explicit \`ALLOWED FILES (MAX 3)\` list with exact \`StartLine\`–\`EndLine\` ranges and a \`MAX TOOL CALLS: 3\` cap.
   - The IDE agent is strictly forbidden from reading or editing any file outside \`ALLOWED FILES\`, and must stop immediately (0 extra tool calls) and report to the user if an expected target anchor does not match—never loop or guess!
6. **Senior Engineering & Anti-Monolith Guardrails (Zero Bad Coding Practices):**
   - **Never Bloat Monoliths:** Never dump 100+ lines of inline business/matching logic into large files (\`public/ricochet-upc-sync.user.js\`, \`LocationManifestTray.vue\`, \`LocationSyncView.vue\`, \`SalesImporter.vue\`). Extract pure, reusable functions into \`src/lib/...\` or focused composables (\`src/composables/...\`).
   - **Never Reinvent Canonical Pipelines or Hardcode Fallbacks:** Always delegate to \`src/lib/salesBucketing.ts\`, \`src/lib/warehouses.ts\`, \`src/lib/upcAuthority.ts\`, and \`src/lib/manifests.ts\`. Never write silent empty \`catch {}\` blocks on DB writes, never mutate unrelated functions, never use untyped \`any\` spaghetti when an interface exists, and never hardcode fallback dates, fees, \`0EJ...\` SKUs, or \`HUCK-...\` barcodes.
   - **Mandatory \`FORBIDDEN ACTIONS\` Block:** Every IDE prompt generated by Gemini Web must include a \`FORBIDDEN ACTIONS\` checklist locking out refactors of unrelated code, extra file reads, and schema violations.
`;

const GOLDEN_RULES_AND_WAREHOUSES = `---

## The 3 Golden Rules, Workflow Guardrails & Canonical Warehouse IDs (\`resale_db.warehouses\`)

### The 3 Golden Rules
1. **\`storageLocation\` must NEVER be blank/unassigned & 4 Canonical Locations Only:** Every physical item (\`received\`, \`placed\`, etc.) must have an explicit canonical location code (\`MD\`, \`DT\`, \`HG\`, \`HH\`). Default unplaced intake items to \`HG\` (or \`HH\` when specified), and never create duplicate warehouse records.
2. **Zero Hardcoded Locations (100% Driven by Central Location Settings):** Never hardcode location codes, names, fees, or static manifest keys in UI components, API routes, or bookmarklets—always read dynamically from \`src/lib/warehouses.ts\` (\`usesRicochet\`, \`supportsPaperSalesSheet\`, \`salesIntakeMode\`, \`commissionRate\`, \`monthlyRent\`).
3. **Reuse Canonical Pipelines (\`src/lib/salesBucketing.ts\`), Break Down Monoliths, & Keep Read-Only Audits Clean:** Never reinvent duplicate matching/deduplication pipelines or bloat giant monolithic files—always delegate to \`src/lib/salesBucketing.ts\` (\`splitTrailingBoothSku\`, \`isPayoutSummaryRow\`, \`assignOccurrenceFingerprints\`, \`flagAlreadyRecordedRows\`, \`matchMemoryDenInventoryItem\`, \`buildLockedMultiBinMap\`), extract focused composables/panels (\`src/lib/ricochetPayoutParser.ts\`, \`src/composables/useRicochetSalesSync.ts\`, \`src/components/sales/RicochetLiveSalesPanel.vue\`), and never modify \`.vue\` files or run local builds on read-only tasks.

${WORKFLOW_AND_ANTI_GLITCH_RULES}
### Canonical Warehouse & Location IDs
| Code | Name | Document \`$id\` | Type | Commission | Monthly Rent | Notes / Vibes & Exclusions |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **\`MD\`** | Memory Den - Huck's Adventures Outfitters | \`6a7e70050009db0e1857\` | On-Site Booth (\`#0EJ\`) | \`15%\` | \`$382.50/mo\` | Goth, Whimsigoth, TTRPG, metaphysical, eclectic, punk, sci-fi, adventure, horror, cos-play |
| **\`DT\`** | Dusty Tiger | \`6a7e71eb001f53734a86\` | Consignment Booth | \`10%\` | \`$75.00/mo\` | Small Collectibles, Jewelry, Pins, Pocket Items, Wands & Arcana \`<8"\`. **NO Clothes, NO Large Toys, NO Bulky Playsets** |
| **\`HG\`** | Huck's Garage | \`6a7e6f73003a5a2a7c34\` | Warehouse / Backstock | \`0%\` | \`$0.00/mo\` | Primary backstock facility (hardgoods, toys, decor, bulk) |
| **\`HH\`** | Huck's Hideout | \`6ae3afbd0030a7eb8a9c\` | Warehouse / Backstock | \`0%\` | \`$0.00/mo\` | Climate-controlled backstock & staging (\`HH\` — apparel, books, media, electronics, jewelry) |
`;

const HUCKS_CORE_SKILL_HEADER = `---
name: hucks-resale-core
description: Master system DNA, 3 Golden Rules, canonical Appwrite warehouse IDs (MD, DT, HG, HH), co-op waterfall rules, and active session pointers for Resale Command. Use when starting any task in this repo, or when you need the business context, location IDs, or the 7 architecture laws.
---

# Huck's Resale Core — System DNA & Golden Rules

> **Live Session Pointer:** Always check [\`ACTIVE_SESSION.md\`](file:///c:/Users/15034/Projects/ResaleCommand/ACTIVE_SESSION.md) for current active tasks, recent database migrations, and seasonal booth drop targets, and [\`docs/AI_STUDIO_PLAYBOOK.md\`](file:///c:/Users/15034/Projects/ResaleCommand/docs/AI_STUDIO_PLAYBOOK.md) for the multi-chat AI Studio workflow.

---

## 1. Universal Core DNA

You are the Principal Architect & UX Co-Pilot for **Resale Command** (Astro SSR, Vue 3.5, DaisyUI v5, Tailwind v4, Appwrite Cloud \`resale_db\` in \`sfo.cloud.appwrite.io\`, deployed on Vercel at \`resalecmd.com\`).

### BUSINESS & CO-OP CONTEXT
- **Organization:** The Huckleberry Collective (\`HUCK-\`) & PDX Game Library (\`PDXGL-\`) + consignors (\`BB-\`).
- **Primary Retail Venue:** Memory Den Vintage Mall Booth #0EJ (Portland, OR — Ricochet POS, 15% fee, $382.50/mo rent) and Dusty Tiger (\`DT\` — small collectibles/jewelry/wands <8", NO apparel, 10% fee, $75.00/mo rent).
- **Backstock Facilities:** \`HG\` (Huck's Garage) and \`HH\` (Huck's Hideout).
- **Co-op Waterfall:** 1) Venue Fee (15% Memory Den / 10% Dusty Tiger) -> 2) 100% Curator Cost Basis Recouped -> 3) Net Surplus split 70% Curator / 30% Commons Pool (covers $382.50 rent & tech/supplies).

### STRICT SYSTEM INVARIANTS
1. **IDE Prompt & 4-Tier Model Routing Standard (Google AI Ultra Pool — \`src/lib/devAiRouting.ts\`):** Keep **World 1 (\`src/lib/gemini.ts\` App Runtime AI on $40/mo Cloud credits)** strictly separate from **World 2 (\`src/lib/devAiRouting.ts\` Dev/Arch AI on Google AI Ultra)**. Default 95%+ of Antigravity IDE work inside the Google AI Ultra Gemini pool: **\`Gemini 3.8 Flash\`** (~8x lower quota draw for file inspections, doc/session syncs, and verify + push), **\`Gemini 4 Argon (Medium)\`** (fast 1–3 file Vue/TS UI & feature edits), and **\`Gemini 4 Carbon (Medium / High)\`** (\`/plan\` architecture, multi-store/API adapters, and tricky bug surgery BEFORE touching Claude); reserve \`Claude Sonnet 5.5 (Medium)\` strictly as a rare outside tie-breaker (\`Enable AI Credit Overages\` kept \`OFF\`; never \`Opus 5.5\`). Never use multi-line PowerShell blocks to write files—always instruct the IDE to use native file tools.
2. **ADHD-Friendly Model Picker Guardrail & Pre-Proceed \`/plan\` Model Gate:**
   - **Rule for Gemini Web & \`/coop/vault\`**: Whenever generating a copy-paste prompt box for Antigravity IDE, always place one of these bold headers immediately above the code block:
     - \`⚡ PICK IN ANTIGRAVITY: Gemini 3.8 Flash\` (for file reads, doc updates, \`ACTIVE_SESSION.md\` / \`GEMINI.md\` syncs, and verify + push)
     - \`🟢 PICK IN ANTIGRAVITY: Gemini 4 Argon (Medium)\` (for standard 1–3 file UI & feature code/refactor prompts)
     - \`🔥 PICK IN ANTIGRAVITY: Gemini 4 Carbon (Medium / High)\` (for \`/plan\` architecture, multi-store/API adapters, & tricky bug surgery)
     - \`🟣 PICK IN ANTIGRAVITY: Claude Sonnet 5.5 (⚠️ Switch back to Gemini right after!)\` (rare fallback only)
   - **Mandatory Pre-Proceed \`/plan\` Model Gate**: Every \`implementation_plan.md\` must evaluate execution difficulty *before* handing the user the \`Proceed\` button and stamp \`🎯 BEFORE CLICKING PROCEED — PICK THIS MODEL:\` at Line 1 of the plan AND in the chat reply.
   - **Rule for Antigravity IDE**: At the very end of every response in Antigravity IDE, always print this exact 1-line footer right above the chat input box:
     \`🔔 **ADHD MODEL & /compact CHECK:** ⚡ **3.8 Flash** (recon/push) • 🟢 **4 Argon Med** (fast UI/edits) • 🔥 **4 Carbon Med/High** (/plan & tricky code) • 🟣 **Claude Sonnet 5.5** (last resort) — **/compact** every ~8 turns!\`
3. **NO Local \`astro build\`:** Every IDE prompt MUST forbid running \`astro build\` or \`npm run build\` locally (hangs Windows PC). Only run \`node scripts/validate-templates.mjs\` locally; let Vercel build in the cloud.
4. **1-Click \`run_command\` (\`BypassSandbox: true\`) Auto-Verify & Push Standard:** On Windows, standard sandboxed terminal calls (\`BypassSandbox: false\`) fail with \`CreateProcessSecurityEnvironment\` and local \`astro build\` hangs the PC. Antigravity must do all file inspections and code edits using native \`read_file\`, \`edit_file\`, and \`write_file\` tools, and whenever running \`npm run verify\`, \`git commit\`, and \`git push\` (or executing a \`scratch/\` script), Antigravity MUST invoke \`run_command\` with **\`BypassSandbox: true\`** so the user gets a 1-click Run button in chat and Antigravity monitors the terminal output directly without manual copy-pasting.
5. **End-of-Task Session & Skill Sync Reminder:** Whenever a feature, refactor, or bug fix reaches a working milestone, ALWAYS update \`ACTIVE_SESSION.md\` using \`write_file\` to log what was completed and what is next, and run \`npm run verify\` + \`git push\` via \`run_command\` (\`BypassSandbox: true\`).
6. **Plain-English Vocabulary:** Use \`✂️ Split Lot\`, \`📦 Booth Bin (Multi-Qty)\`, \`➕ Restock Bin\`, \`↩️ Undo Combine\`, \`🔍 Deep Scan\`, \`⚡ Quick Scout\`, \`📦 Combine Similar\`, \`🎁 Build Bundle\`.
7. **Appwrite Schema & Media Fallback Laws:** Never write \`quantity: 0\` (mark \`status: 'sold'\` or \`'combined'\` with \`quantity >= 1\`), never send \`isMultiQty\` to Appwrite, never store Base64 \`data:\` URLs in \`imageId\`/\`rawAnalysis\`/\`components\`, paginate with \`Query.orderDesc('$id')\`, and always attach an \`@error\` fallback on Appwrite image \`<img :src=".../preview...">\` elements (\`PhotoGalleryManager.vue\`, \`ItemCard.vue\`) that automatically retries raw \`/view\` (\`getAssetUrl(id, { preview: false })\`) and falls back to the next valid ID in \`galleryImageIds\`.
8. **3 Memory Den CSV Formats & 1-to-1 \`0EJ...\` ↔ \`UPC\` Bijection:**
   - \`Products-*.csv\`: Catalog/Stock sync (\`'0EJ...\` SKU + \`Quantity\` + \`Inventory: In Stock|Paid|Sold\`). Updates \`items\` ONLY—NEVER creates \`sales\` records! Every \`0EJ...\` \`locationSku\` MUST map 1-to-1 to a unique \`HUCK-\`, \`PDXGL-\`, or \`BB-\` \`upc\` (\`EXPLICIT_COLLISION_PAIRS\` + \`usedUpcs\` self-healing in \`/api/md-verify-report\` and \`public/ricochet-upc-sync.user.js\`).
   - \`Payouts *.csv\`: Interim current-month sales (\`Sale#\` + \`Sold Date\`). Deduplicates by 6-digit ticket # + occurrence.
   - \`Payout History *.csv\`: Settled monthly checks (\`Sale\` + \`Sold\` + \` - 0EJXXX\` suffix).

### UX & INFORMATION ARCHITECTURE EMPATHY GUARDRAILS
1. **Never Ask User for Manual Browser Plumbing:** Always wire solutions directly into the native UI (such as the Drag-and-Drop Permanent Live-Loader bookmarklet \`⚡ Memory Den Sync\` in \`LocationSyncView.vue\`) rather than asking the user to manually edit bookmark URLs or install extra extensions.
2. **No Stale Client Snapshots (Single Source of Truth):** Bookmarklets and sync tools must be thin live-loaders (\`https://resalecmd.com/ricochet-upc-sync.user.js?v=' + Date.now()\`) that fetch fresh code and fresh \`locationSku\` (\`0EJ...\`) ➔ \`HUCK-XXXX\` mappings from the cloud (\`/api/md-verify-report?mode=payload\`) on open, displaying \`"✅ Live Auto-Updated Script"\`. Never bake static JSON snapshots into bookmarklet \`href\`s.
3. **Booth Operations & Bin SKU Awareness:** Always link Memory Den \`0EJ...\` SKUs in \`locationSku\` on the backend and respect physical booth workflows (distinguishing legitimate multi-qty Booth Bin SKUs from true duplicate barcode collision pairs).

---

## 2. The 3 Golden Rules

1. **\`storageLocation\` must NEVER be blank/unassigned & 4 Canonical Locations Only:** Every physical item (\`received\`, \`placed\`, etc.) must have an explicit canonical location code (\`MD\`, \`DT\`, \`HG\`, \`HH\`). Default unplaced intake items to \`HG\` (or \`HH\` when specified), and never create duplicate warehouse records.
2. **Zero Hardcoded Locations (100% Driven by Central Location Settings):** Never hardcode location codes, names, fees, or static manifest keys in UI components, API routes, or bookmarklets—always read dynamically from \`src/lib/warehouses.ts\` (\`usesRicochet\`, \`supportsPaperSalesSheet\`, \`salesIntakeMode\`, \`commissionRate\`, \`monthlyRent\`).
3. **Reuse Canonical Pipelines (\`src/lib/salesBucketing.ts\`), Break Down Monoliths, & Keep Read-Only Audits Clean:** Never reinvent duplicate matching/deduplication pipelines or bloat giant monolithic files—always delegate to \`src/lib/salesBucketing.ts\` (\`splitTrailingBoothSku\`, \`isPayoutSummaryRow\`, \`assignOccurrenceFingerprints\`, \`flagAlreadyRecordedRows\`, \`matchMemoryDenInventoryItem\`, \`buildLockedMultiBinMap\`), extract focused composables/panels (\`src/lib/ricochetPayoutParser.ts\`, \`src/composables/useRicochetSalesSync.ts\`, \`src/components/sales/RicochetLiveSalesPanel.vue\`), and never modify \`.vue\` files or run local builds on read-only tasks.

---

## 3. Canonical Warehouse & Location IDs (\`resale_db.warehouses\`)

| Code | Name | Document \`$id\` | Type | Commission | Monthly Rent | Notes / Vibes & Exclusions |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **\`MD\`** | Memory Den - Huck's Adventures Outfitters | \`6a7e70050009db0e1857\` | On-Site Booth (\`#0EJ\`) | \`15%\` | \`$382.50/mo\` | Goth, Whimsigoth, TTRPG, metaphysical, eclectic, punk, sci-fi, adventure, horror, cos-play |
| **\`DT\`** | Dusty Tiger | \`6a7e71eb001f53734a86\` | Consignment Booth | \`10%\` | \`$75.00/mo\` | Small Collectibles, Jewelry, Pins, Pocket Items, Wands & Arcana \`<8"\`. **NO Clothes, NO Large Toys, NO Bulky Playsets** |
| **\`HG\`** | Huck's Garage | \`6a7e6f73003a5a2a7c34\` | Warehouse / Backstock | \`0%\` | \`$0.00/mo\` | Primary backstock facility (hardgoods, toys, decor, bulk) |
| **\`HH\`** | Huck's Hideout | \`6ae3afbd0030a7eb8a9c\` | Warehouse / Backstock | \`0%\` | \`$0.00/mo\` | Climate-controlled backstock & staging (\`HH\` — apparel, books, media, electronics, jewelry) |

---

${MASTER_ARCHITECTURE_LAWS}
`;

/**
 * The 6 Bundled Gemini Web Skills (matching docs/AI_STUDIO_PLAYBOOK.md)
 */
const GEMINI_WEB_BUNDLES = [
  {
    id: 'hucks-resale-core',
    description:
      'Master system DNA, Works@TheHC brand & multi-domain identity (works.thehc.llc / .coop / .com), 3 Golden Rules, canonical Appwrite warehouse IDs (MD, DT, HG, HH), co-op waterfall rules, and live ACTIVE_SESSION.md summary.',
    sources: [
      { type: 'skill', name: 'hucks-resale-core' },
      { type: 'skill', name: 'huckleberry-brand-and-domain-identity' },
    ],
  },
  {
    id: 'rc-1-scout-vision',
    description:
      'Chat 1 (AI Scout & Vision) bundle: AI architecture & cost optimization, Speed Scout & Deep Scan validation, multi-angle photo slicing, secondary market valuation, and sourcing enrichment.',
    sources: [
      { type: 'skill', name: 'ai-architecture-and-cost-optimization' },
      { type: 'skill', name: 'ai-scout-and-deep-scan-validation' },
      { type: 'skill', name: 'multi-angle-photo-slicing' },
      { type: 'skill', name: 'secondary-market-appraisal-and-valuation' },
      { type: 'skill', name: 'sourcing-and-ai-enrichment' },
    ],
  },
  {
    id: 'rc-2-inventory-splitter',
    description:
      'Chat 2 (Inventory, Drawer & Splitter) bundle: core inventory lifecycle & SKU bucketing, lot profit & exit strategy, UX design system taxonomy, and Vue 3 SFC standards.',
    sources: [
      { type: 'skill', name: 'resale-inventory-core' },
      { type: 'skill', name: 'lot-profit-and-exit-strategy' },
      { type: 'skill', name: 'ux-design-system-taxonomy' },
      { type: 'skill', name: 'vue-component-standards' },
    ],
  },
  {
    id: 'rc-3-booth-drops',
    description:
      'Chat 3 (Booth Drops & Theme Puller) bundle: haul ingestion SOP, booth sync & UX empathy guardrails, booth merchandising & bundling, and direct thermal label printing (Ricochet POS & Dusty Tiger).',
    sources: [
      { type: 'skill', name: 'haul-ingestion' },
      { type: 'skill', name: 'resale-booth-sync' },
      { type: 'skill', name: 'resale-merchandising-and-bundling' },
      { type: 'skill', name: 'thermal-label-printing' },
    ],
  },
  {
    id: 'rc-4-sales-coop',
    description:
      'Chat 4 (Sales & Co-op Ledger) bundle: Ricochet POS CSV sales reconciliation & payout invariants, cooperative economics & WSDE waterfall, and IRS tax & expense compliance.',
    sources: [
      { type: 'rule', name: 'sales-reconciliation-and-payout-invariants' },
      { type: 'skill', name: 'democracy-at-work-cooperative' },
      { type: 'skill', name: 'tax-and-expense-compliance' },
    ],
  },
  {
    id: 'rc-5-social-studio',
    description:
      'Chat 5 (Social Dropcast Studio) bundle: social media drop broadcasting & IP guardrails, mobile UX standards (HIG/M3), and DaisyUI v5 + Tailwind v4 component patterns.',
    sources: [
      { type: 'skill', name: 'social-marketing-and-drop-broadcasting' },
      { type: 'skill', name: 'mobile-ux-standards' },
      { type: 'skill', name: 'daisyui' },
    ],
  },
];

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Strips YAML frontmatter from a markdown file so multiple files can be cleanly combined.
 */
function stripFrontmatter(rawContent) {
  const normalized = rawContent.replace(/\r\n/g, '\n');
  const fmMatch = normalized.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return (fmMatch ? fmMatch[1] : normalized).trim();
}

function syncCoreDocsAndHucksSkill() {
  const playbook = fs.existsSync(PLAYBOOK_PATH)
    ? fs.readFileSync(PLAYBOOK_PATH, 'utf8').trim()
    : '# Google AI Studio — Focused Chat Playbook & System DNA\n\n*(Missing docs/AI_STUDIO_PLAYBOOK.md)*';

  const activeSession = fs.existsSync(ACTIVE_SESSION_PATH)
    ? fs.readFileSync(ACTIVE_SESSION_PATH, 'utf8').trim()
    : '# Active Session State\n\n*(Missing ACTIVE_SESSION.md)*';

  // 1. Write root GEMINI.md with Playbook + Golden Rules/Warehouses + Active Session
  const combinedGeminiMd = [
    '# Resale Command — Universal Core DNA & Master Workspace Guide (`GEMINI.md`)',
    '',
    '> **Auto-Synced Context:** Generated by `npm run skills:sync` (`scripts/sync-ai-context.mjs`) from [`docs/AI_STUDIO_PLAYBOOK.md`](file:///c:/Users/15034/Projects/ResaleCommand/docs/AI_STUDIO_PLAYBOOK.md) and [`ACTIVE_SESSION.md`](file:///c:/Users/15034/Projects/ResaleCommand/ACTIVE_SESSION.md).',
    '',
    playbook,
    '',
    GOLDEN_RULES_AND_WAREHOUSES.trim(),
    '',
    '---',
    '',
    MASTER_ARCHITECTURE_LAWS.trim(),
    '',
    '---',
    '',
    activeSession,
    '',
  ].join('\n');

  fs.writeFileSync(GEMINI_MD_PATH, combinedGeminiMd, 'utf8');
  console.log(`✅ Updated root GEMINI.md (${Buffer.byteLength(combinedGeminiMd, 'utf8')} bytes)`);

  // 2. Embed live AI_STUDIO_PLAYBOOK.md + ACTIVE_SESSION.md into .agents/skills/hucks-resale-core/SKILL.md
  fs.mkdirSync(path.dirname(HUCKS_CORE_SKILL_PATH), { recursive: true });
  const hucksCoreSkillContent = [
    HUCKS_CORE_SKILL_HEADER.trim(),
    '',
    '---',
    '',
    '## 4. Google AI Studio & Multi-Chat Playbook (`docs/AI_STUDIO_PLAYBOOK.md`)',
    '',
    playbook,
    '',
    '---',
    '',
    '## 5. Live Active Session Summary (Auto-Synced from `ACTIVE_SESSION.md`)',
    '',
    activeSession,
    '',
  ].join('\n');

  fs.writeFileSync(HUCKS_CORE_SKILL_PATH, hucksCoreSkillContent, 'utf8');
  console.log(
    `✅ Updated .agents/skills/hucks-resale-core/SKILL.md with live ACTIVE_SESSION.md (${Buffer.byteLength(hucksCoreSkillContent, 'utf8')} bytes)`
  );
}

function loadPreviousManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return { skills: {} };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    return parsed && typeof parsed.skills === 'object' ? parsed : { skills: {} };
  } catch {
    return { skills: {} };
  }
}

function resolveSourceFilePath(source) {
  if (source.type === 'rule') {
    return path.join(RULES_SRC_DIR, `${source.name}.md`);
  }
  return path.join(SKILLS_SRC_DIR, source.name, 'SKILL.md');
}

/**
 * Keyword router used by the in-app Prompt Maker to auto-pick specialist bundles.
 * The core bundle (hucks-resale-core) is always included at runtime.
 */
const BUNDLE_ROUTER_KEYWORDS = {
  'hucks-resale-core': [],
  'rc-1-scout-vision': ['scout', 'deep scan', 'vision', 'ocr', 'appraisal', 'valuation', 'price', 'auction', 'shopgoodwill', 'hibid', 'ebay', 'fbmp', 'facebook', 'marketplace', 'negotiat', 'offer', 'estate', 'deal', 'sourcing', 'bid'],
  'rc-2-inventory-splitter': ['inventory', 'lot', 'split', 'splitter', 'drawer', 'sku', 'status', 'vue', 'component', 'ui', 'bundle profit', 'playbook', 'anchor', 'hero'],
  'rc-3-booth-drops': ['booth', 'haul', 'ricochet', 'barcode', 'label', 'thermal', 'merchandis', 'bundle', 'combine', 'shelf', 'sync'],
  'rc-4-sales-coop': ['sales', 'payout', 'co-op', 'coop', 'collective', 'waterfall', 'tax', 'expense', 'member', 'hat', 'promoter', 'enabler', 'consignor', 'settlement', 'governance', 'trial', 'preview'],
  'rc-5-social-studio': ['social', 'post', 'instagram', 'dropcast', 'mobile', 'phone', 'marketing', 'daisyui', 'tailwind', 'layout'],
};

/**
 * Writes src/lib/generatedSkillBundles.ts — a static, Git-committed module so serverless
 * routes can read the 6 skill bundles from memory (Vercel never reads .agents/ or writes files at runtime).
 */
function writeGeneratedSkillBundlesModule(bundles) {
  const outPath = path.join(ROOT_DIR, 'src', 'lib', 'generatedSkillBundles.ts');
  const header = [
    '/* AUTO-GENERATED by scripts/sync-ai-context.mjs (npm run verify). DO NOT EDIT BY HAND. */',
    '',
    'export interface SkillBundle {',
    '  id: string;',
    '  description: string;',
    '  modules: string[];',
    '  keywords: string[];',
    '  content: string;',
    '}',
    '',
  ].join('\n');
  const body = `export const SKILL_BUNDLES: SkillBundle[] = ${JSON.stringify(bundles, null, 2)};\n`;
  const router = [
    '',
    "export const CORE_BUNDLE_ID = 'hucks-resale-core';",
    '',
    '/** Returns up to `max` specialist bundle ids whose keywords appear in the text (core is always added by callers). */',
    'export function matchSkillBundlesForIdea(text: string, max = 2): string[] {',
    '  const hay = (text || \'\').toLowerCase();',
    '  return SKILL_BUNDLES',
    '    .filter((b) => b.id !== CORE_BUNDLE_ID)',
    '    .map((b) => ({ id: b.id, score: b.keywords.filter((k) => hay.includes(k)).length }))',
    '    .filter((b) => b.score > 0)',
    '    .sort((a, b) => b.score - a.score)',
    '    .slice(0, max)',
    '    .map((b) => b.id);',
    '}',
    '',
  ].join('\n');
  const next = header + body + router;
  const prev = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
  if (prev !== next) {
    fs.writeFileSync(outPath, next, 'utf8');
  }
  console.log(`✅ Updated src/lib/generatedSkillBundles.ts (${Buffer.byteLength(next, 'utf8')} bytes, ${bundles.length} bundles)`);
}

function syncBundledSkills() {
  // Read previous manifest BEFORE wiping dist-gemini-skills/
  const prevManifest = loadPreviousManifest();

  // Wipe dist-gemini-skills/ completely so only the 6 bundled folders exist
  if (fs.existsSync(SKILLS_DIST_DIR)) {
    fs.rmSync(SKILLS_DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(SKILLS_DIST_DIR, { recursive: true });

  const nextManifestSkills = {};
  const syncedBundles = [];
  const changedBundles = [];
  const generatedModuleBundles = [];

  for (const bundle of GEMINI_WEB_BUNDLES) {
    const sections = [];
    const includedNames = [];

    for (const src of bundle.sources) {
      const filePath = resolveSourceFilePath(src);
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Missing source for bundle ${bundle.id}: ${filePath}`);
        continue;
      }
      const raw = fs.readFileSync(filePath, 'utf8');
      const body = stripFrontmatter(raw);
      includedNames.push(src.name);

      if (bundle.sources.length === 1) {
        sections.push(body);
      } else {
        sections.push(`<!-- ==================== SOURCE: ${src.type.toUpperCase()} / ${src.name} ==================== -->\n\n${body}`);
      }
    }

    const frontmatter = [
      '---',
      `name: ${bundle.id}`,
      `description: ${bundle.description}`,
      '---',
      '',
    ].join('\n');

    const bundleHeader =
      bundle.sources.length > 1
        ? [
            `# ${bundle.id} — Bundled Gemini Web Skill`,
            '',
            `> **Bundled Modules (${includedNames.length}):** ${includedNames.map(n => `\`${n}\``).join(', ')}`,
            '',
            '---',
            '',
          ].join('\n')
        : '';

    const lawsBlock = bundle.id === 'hucks-resale-core' ? '' : `${MASTER_ARCHITECTURE_LAWS.trim()}\n\n---\n\n`;
    const fullContent = `${frontmatter}${bundleHeader}${sections.join('\n\n---\n\n')}\n\n---\n\n${lawsBlock}${WORKFLOW_AND_ANTI_GLITCH_RULES}\n`;

    const targetDir = path.join(SKILLS_DIST_DIR, bundle.id);
    fs.mkdirSync(targetDir, { recursive: true });

    const destSkillPath = path.join(targetDir, 'SKILL.md');
    fs.writeFileSync(destSkillPath, fullContent, 'utf8');

    const currentHash = sha256(fullContent);
    const previousHash = prevManifest.skills?.[bundle.id]?.sha256 || null;
    const isChanged = previousHash !== currentHash;

    nextManifestSkills[bundle.id] = {
      name: bundle.id,
      modules: includedNames,
      sha256: currentHash,
      bytes: Buffer.byteLength(fullContent, 'utf8'),
      updatedAt: isChanged
        ? new Date().toISOString()
        : (prevManifest.skills?.[bundle.id]?.updatedAt || new Date().toISOString()),
    };

    const bundleRecord = {
      id: bundle.id,
      modules: includedNames,
      bytes: Buffer.byteLength(fullContent, 'utf8'),
      sha256: currentHash,
      status: !previousHash ? 'NEW' : (isChanged ? 'MODIFIED' : 'UNCHANGED'),
      distPath: `dist-gemini-skills/${bundle.id}/SKILL.md`,
    };

    generatedModuleBundles.push({
      id: bundle.id,
      description: bundle.description,
      modules: includedNames,
      keywords: BUNDLE_ROUTER_KEYWORDS[bundle.id] || [],
      content: fullContent,
    });

    syncedBundles.push(bundleRecord);
    if (isChanged) {
      changedBundles.push(bundleRecord);
    }
  }

  writeGeneratedSkillBundlesModule(generatedModuleBundles);

  const nextManifest = {
    lastSyncedAt: new Date().toISOString(),
    totalBundles: syncedBundles.length,
    skills: nextManifestSkills,
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(nextManifest, null, 2) + '\n', 'utf8');

  return { syncedBundles, changedBundles };
}

function checkDevAiRosterFreshness() {
  const routingPath = path.join(ROOT_DIR, 'src', 'lib', 'devAiRouting.ts');
  if (!fs.existsSync(routingPath)) return;
  const src = fs.readFileSync(routingPath, 'utf8');
  const reviewedMatch = src.match(/DEV_AI_ROSTER_LAST_REVIEWED\s*=\s*['"]([^'"]+)['"]/);
  const intervalMatch = src.match(/DEV_AI_REVIEW_INTERVAL_DAYS\s*=\s*(\d+)/);
  const lastReviewed = reviewedMatch?.[1] || '';
  const maxDays = Number(intervalMatch?.[1] || 30);
  const parsedMs = Date.parse(`${lastReviewed}T00:00:00Z`);
  if (!Number.isFinite(parsedMs)) return;
  const daysOld = Math.max(0, Math.floor((Date.now() - parsedMs) / (1000 * 60 * 60 * 24)));
  if (daysOld > maxDays) {
    console.log(
      `\n💡 [Dev AI Roster Check] src/lib/devAiRouting.ts was last reviewed ${daysOld}d ago (${lastReviewed}) — check the Antigravity Model Picker for newer Gemini models!`
    );
  } else {
    console.log(`\n✅ [Dev AI Roster Check] Active 4-tier roster fresh (reviewed ${lastReviewed}, ${daysOld}d ago).`);
  }
}

function main() {
  console.log('🔄 Syncing Resale Command AI Context & 6 Bundled Gemini Web Skills...\n');
  syncCoreDocsAndHucksSkill();

  const { syncedBundles, changedBundles } = syncBundledSkills();
  console.log(`\n📦 Exported ${syncedBundles.length} bundled skill folders to dist-gemini-skills/<bundle-name>/SKILL.md:\n`);

  for (const b of syncedBundles) {
    console.log(
      `  • ${b.id.padEnd(26)} (${String(b.bytes).padStart(6)} B) — [${b.modules.length} module${b.modules.length === 1 ? '' : 's'}]: ${b.modules.join(', ')}`
    );
  }

  console.log('\n🔔 GEMINI WEB UPLOAD CHECKLIST (Changed Since Last Sync):');
  if (changedBundles.length === 0) {
    console.log(`  ✅ All ${syncedBundles.length} bundled skills are already up to date — nothing to re-upload!`);
  } else {
    for (const c of changedBundles) {
      console.log(`  ⬆️ [${c.status}] ${c.id} -> ${c.distPath} (${c.bytes} B)`);
    }
  }

  checkDevAiRosterFreshness();
  console.log('\n✨ AI context & 6 bundled Gemini Web skills sync complete!');

  // Tandem Mirror to sibling repo `thehcllc` (if present on disk)
  const siblingHubDir = path.resolve(ROOT_DIR, '..', 'thehcllc');
  const siblingSyncScript = path.join(siblingHubDir, 'scripts', 'sync-ai-context.mjs');
  if (fs.existsSync(siblingSyncScript)) {
    try {
      execFileSync(process.execPath, [siblingSyncScript], { stdio: 'inherit', cwd: siblingHubDir });
    } catch (err) {
      console.warn('⚠️ Could not auto-mirror to sibling thehcllc repo:', err.message);
    }
  }
}

main();

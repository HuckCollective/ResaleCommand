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
const CLINERULES_PATH = path.join(ROOT_DIR, '.clinerules');
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

const WORKFLOW_AND_ANTI_GLITCH_RULES = `### IDE-Independent Gemini 4 Model Routing & Dual-IDE Auto-Morphing (\`VS Code · Cline\` ⇄ \`Antigravity\`)
1. **4-Tier Model Selection Lock (\`src/lib/devAiRouting.ts\` — IDE-Independent in \`/coop/vault\`):**
   - \`⚡ Gemini 4 Hydrogen\` (\`gemini-4-hydrogen\`, \`Low\` / \`Medium\` — succeeds \`3.8 Flash\`): ~8x lighter quota (1M context) for ALL file scouting/recon, doc/session syncs, and \`npm run verify\` + \`git push\`.
   - \`🟢 Gemini 4 Argon\` (\`gemini-4-argon\`, \`Medium\`): Fast Act-mode daily driver for standard 1–3 file Vue 3.5 / DaisyUI v5 UI & clear feature edits *(💡 Best $0-pool swap if Claude Sonnet is selected)*.
   - \`🔥 Gemini 4 Carbon\` (\`gemini-4-carbon\`, \`Medium\` / \`High\`): Frontier Plan-mode architect & code surgeon for architecture, multi-store/API adapters, and tricky bug fixes BEFORE touching Claude *(💡 Best $0-pool swap for Claude Thinking)*.
   - \`🟣 Claude Sonnet 5.5\` (\`Medium\`): Rare outside tie-breaker after compacting context (\`/smol\` or \`/compact\`) ONLY if an isolated bug needs a second opinion — always display the Best Gemini 4 \`$0\`-pool alternative alongside it, and never use \`Opus 5.5\` on routine work.
2. **Dual-IDE Auto-Morphing Rule (Detect Active IDE Automatically from System Context):**
   - **In VS Code (\`Cline\` — reads \`.clinerules\`):** Use Cline's split **Plan Mode** (\`4 Carbon\`) ⇄ **Act Mode** (\`4 Argon\` / \`4 Hydrogen\`), batch parallel \`read_files\` / \`search_codebase\` calls, keep \`editor\` chunks \`<5,000\` chars, chain \`git add -A; git commit -m "..."; git push origin HEAD\` sequentially in ONE command string (avoiding \`.git/index.lock\` collisions), and end every reply with:
     \`🔔 **ADHD CLINE CHECK (VS Code):** 🧭 **Plan = 4 Carbon** (architect) • 🟢 **Act = 4 Argon Med** (1–3 file edits) • ⚡ **4 Hydrogen** (recon/verify/push) • 💡 **On Claude? Swap to 4 Carbon High ($0 pool)** — **/smol** every ~8 turns!\`
   - **In Antigravity IDE (reads \`GEMINI.md\`):** Stamp \`🎯 BEFORE CLICKING PROCEED — PICK THIS MODEL:\` at Line 1 of \`implementation_plan.md\`, invoke \`run_command\` with \`BypassSandbox: true\` (\`npm run verify; if ($LASTEXITCODE -eq 0) { git add -A; git commit -m "..."; git push origin HEAD }\`), and end every reply with:
     \`🔔 **ADHD MODEL & /compact CHECK:** ⚡ **4 Hydrogen** (recon/push) • 🟢 **4 Argon Med** (fast UI/edits) • 🔥 **4 Carbon Med/High** (/plan & tricky code — best $0 swap for Claude!) • 🟣 **Claude Sonnet 5.5** (last resort) — **/compact** every ~8 turns!\`
3. **Active-Branch Push Rule (\`origin HEAD\`) & Zero One-Off Scripts in \`scripts/\`:** Always push to \`origin HEAD\` (e.g. \`alpha-1\`) and never push to \`main\` unless explicitly asked to merge. Put temporary audit scripts in git-ignored \`scratch/\` and delete before committing.
4. **Clean Single Code Block Rule (Anti-Splice-Glitch in Gemini Web):** Whenever Gemini Web outputs a copy-paste prompt for a Coding IDE, output ONE single fenced code block (\` \`\`\`text ... \`\`\` \`) with IDE-independent model headers + Best Gemini \`$0\`-pool swap line inside it, and zero inline backticks, emojis, or horizontal dividers outside the code block.
5. **Anti-Rabbit-Hole Scope Lock & Senior Engineering Guardrails:**
   - Every Vault/Web IDE prompt MUST include \`ALLOWED FILES (MAX 3)\`, parallel native IDE file reads/edits (never PowerShell file-writes), and a \`FORBIDDEN ACTIONS\` checklist (no local \`astro build\` unless explicitly requested, no \`quantity: 0\` or Base64 writes to Appwrite, no hardcoded fallback dates/fees/\`0EJ\` SKUs, no monolith bloat—delegate to \`src/lib/salesBucketing.ts\`, \`src/lib/warehouses.ts\`, \`src/lib/upcAuthority.ts\`, and \`src/lib/manifests.ts\`).
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
1. **IDE Prompt & 4-Tier Gemini 4 Routing Standard (Google AI Ultra Pool — \`src/lib/devAiRouting.ts\`):** Keep **World 1 (\`src/lib/gemini.ts\` App Runtime AI on $40/mo Cloud credits)** strictly separate from **World 2 (\`src/lib/devAiRouting.ts\` Dev/Arch AI on Google AI Ultra)**. Default 95%+ of Coding IDE work inside the Google AI Ultra Gemini 4 pool: **\`Gemini 4 Hydrogen\`** (\`gemini-4-hydrogen\`, ~8x lighter quota draw for file inspections, doc/session syncs, and verify + push; succeeds \`3.8 Flash\`), **\`Gemini 4 Argon (Medium)\`** (\`gemini-4-argon\`, fast 1–3 file Vue/TS UI & feature edits — best $0-pool swap for Claude Sonnet), and **\`Gemini 4 Carbon (Medium / High)\`** (\`gemini-4-carbon\`, Plan-mode architecture, multi-store/API adapters, and tricky bug surgery BEFORE touching Claude — best $0-pool swap for Claude Thinking); reserve \`Claude Sonnet 5.5 (Medium)\` strictly as a rare outside tie-breaker (never \`Opus 5.5\`). Never use multi-line PowerShell blocks to write files—always instruct the IDE to use native file tools.
2. **IDE-Independent Vault Prompts & Dual-IDE Auto-Morphing (\`VS Code · Cline\` ⇄ \`Antigravity IDE\`):**
   - **Rule for Gemini Web & \`/coop/vault\` (100% IDE-Independent & Model-Specific)**: Whenever generating a copy-paste prompt box for a Coding IDE, always place one of these IDE-agnostic model headers + a \`💡 Best Gemini $0-Pool Swap\` line immediately above/inside the code block:
     - \`⚡ MODEL PICK: Gemini 4 Hydrogen (Low / Medium)\` (for file reads, doc updates, \`ACTIVE_SESSION.md\` syncs, and verify + push)
     - \`🟢 MODEL PICK: Gemini 4 Argon (Medium)\` (for standard 1–3 file UI & feature code/refactor prompts — 💡 $0-pool alt to Claude Sonnet)
     - \`🔥 MODEL PICK: Gemini 4 Carbon (Medium / High)\` (for Plan-mode architecture, multi-store/API adapters, & tricky bug surgery — 💡 $0-pool alt to Claude Thinking)
     - \`🟣 MODEL PICK: Claude Sonnet 5.5 (Medium — Rare Tie-Breaker) | 💡 BEST GEMINI ALT: Gemini 4 Carbon (High)\`
   - **Auto-Morphing Inside the Editor (Detect Active IDE Automatically)**:
     - **In VS Code (\`Cline\` — reads \`.clinerules\`):** Use Cline's **Plan Mode** (\`4 Carbon\`) ⇄ **Act Mode** (\`4 Argon\` / \`4 Hydrogen\`), batch parallel \`read_files\` / \`search_codebase\` calls, keep \`editor\` chunks \`<5,000\` chars, chain \`git add -A; git commit -m "..."; git push origin HEAD\` sequentially in one command string, and print at the bottom of every reply:
       \`🔔 **ADHD CLINE CHECK (VS Code):** 🧭 **Plan = 4 Carbon** (architect) • 🟢 **Act = 4 Argon Med** (1–3 file edits) • ⚡ **4 Hydrogen** (recon/verify/push) • 💡 **On Claude? Swap to 4 Carbon High ($0 pool)** — **/smol** every ~8 turns!\`
     - **In Antigravity IDE (reads \`GEMINI.md\`):** Stamp \`🎯 BEFORE CLICKING PROCEED — PICK THIS MODEL:\` at Line 1 of \`implementation_plan.md\`, invoke \`run_command\` with \`BypassSandbox: true\`, and print at the bottom of every reply:
       \`🔔 **ADHD MODEL & /compact CHECK:** ⚡ **4 Hydrogen** (recon/push) • 🟢 **4 Argon Med** (fast UI/edits) • 🔥 **4 Carbon Med/High** (/plan & tricky code — best $0 swap for Claude!) • 🟣 **Claude Sonnet 5.5** (last resort) — **/compact** every ~8 turns!\`
3. **NO Routine Local \`astro build\`:** Default local verification is \`npm run verify\` (\`node scripts/validate-templates.mjs && node scripts/sync-ai-context.mjs\`); let Vercel build in the cloud unless explicitly asked to test a build.
4. **Native IDE File Tools & Active-Branch Push (\`origin HEAD\`):** Use native IDE file tools (\`read_files\`/\`editor\` in Cline; \`read_file\`/\`edit_file\`/\`write_file\` + \`run_command\` \`BypassSandbox: true\` in Antigravity). Always push to \`origin HEAD\` (e.g. \`alpha-1\`) and never push to \`main\` unless explicitly asked to merge.
5. **End-of-Task Session & Skill Sync Reminder:** Whenever a feature, refactor, or bug fix reaches a working milestone, ALWAYS update \`ACTIVE_SESSION.md\` to log what was completed and what is next, and run \`npm run verify\` + \`git push origin HEAD\`.
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

  // 1b. Write lean, token-efficient root .clinerules for VS Code (Cline) — ignored by Antigravity IDE
  const clineRulesContent = [
    '# Resale Command — VS Code (Cline) Workspace Rules (`.clinerules`)',
    '',
    '> **Auto-Synced by `npm run verify` (`scripts/sync-ai-context.mjs`).** Antigravity IDE reads `GEMINI.md`; Cline in VS Code reads `.clinerules`. Check `ACTIVE_SESSION.md` for live task state and invoke domain skills from `.agents/skills/` via the `skills` tool whenever relevant.',
    '',
    '## 1. Cline (VS Code) Workflow, Tooling & Gemini 4 Model Slots',
    '- **Recommended Split Plan/Act Model Setup in Cline:**',
    '  - **Plan Mode Slot:** `🔥 Gemini 4 Carbon` (`gemini-4-carbon`, Medium/High) — frontier architecture, multi-store sync & tricky bug diagnosis (*$0-pool swap for Claude Thinking*).',
    '  - **Act Mode Slot:** `🟢 Gemini 4 Argon` (`gemini-4-argon`, Medium) for standard 1–3 file Vue 3.5 / DaisyUI v5 / TS edits (*$0-pool swap for Claude Sonnet*), or `⚡ Gemini 4 Hydrogen` (`gemini-4-hydrogen`, Low/Med) for fast recon, docs, `npm run verify` & `git push`.',
    '  - **Claude Guardrail:** Reserve `Claude Sonnet 5.5 (Medium)` strictly as a rare tie-breaker after `/smol` (never `Opus 5.5` on routine tasks). If running on Claude, always remind the user of the Best Gemini 4 `$0`-pool swap.',
    '- **Cline Tooling Mechanics (Windows PowerShell):**',
    '  - **Parallel Reads/Searches:** Batch independent `read_files` and `search_codebase` calls in a single turn.',
    '  - **Surgical `<5,000`-Char Edits:** Keep `editor` `old_text` / `new_text` chunks under 5,000 characters to avoid streaming timeouts; never write files via multi-line PowerShell blocks.',
    '  - **Sequential Git Commands (Prevent `.git/index.lock`):** Because `run_commands` executes array items concurrently, ALWAYS chain dependent git steps inside ONE command string separated by `;`: `npm run verify; if ($LASTEXITCODE -eq 0) { git add -A; git commit -m "..."; git push origin HEAD }` (always push `origin HEAD`, never `main` unless explicitly asked).',
    '  - **No Routine Local `astro build`:** Run `npm run verify` (`validate-templates.mjs` + `sync-ai-context.mjs`) locally; let Vercel build in the cloud unless explicitly asked.',
    '  - **1-Line Footer (Print at the very end of every Cline reply):**',
    '    `🔔 **ADHD CLINE CHECK (VS Code):** 🧭 **Plan = 4 Carbon** (architect) • 🟢 **Act = 4 Argon Med** (1–3 file edits) • ⚡ **4 Hydrogen** (recon/verify/push) • 💡 **On Claude? Swap to 4 Carbon High ($0 pool)** — **/smol** every ~8 turns!`',
    '',
    GOLDEN_RULES_AND_WAREHOUSES.trim(),
    '',
    '---',
    '',
    MASTER_ARCHITECTURE_LAWS.trim(),
    '',
  ].join('\n');

  fs.writeFileSync(CLINERULES_PATH, clineRulesContent, 'utf8');
  console.log(`✅ Updated root .clinerules (${Buffer.byteLength(clineRulesContent, 'utf8')} bytes)`);

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

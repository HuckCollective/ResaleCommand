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
   Primary canvas = Top KPIs ➔ full DataTable ➔ Sticky Bottom Action Bar (\`BottomActionDock\`, \`fixed bottom-0\`, \`backdrop-blur\`, \`z-50\`, page clearance \`pb-36 sm:pb-44\`, Astro page passes \`hideFooter={true}\`). Secondary inputs (manual CSV upload, demo loaders, paste drawers) live in right-edge Slide-Over Trays (\`SalesImportTray.vue\` pattern), triggered from the top toolbar — never as large cards in the page body.

6. **LAW 6 — 3-Tier Commit Idempotency.**
   Every money-moving commit must be safe to click twice, retry, or resume:
   - **Layer 1 — UI button lock:** the commit button disables synchronously on click (\`isSubmitting\`/\`isCommitting = true\`) and shows batch progress; writes are chunked (25–50 rows per request); any failure unlocks the UI and surfaces the exact Appwrite error in a toast.
   - **Layer 2 — Manifest status transition:** on success the Appwrite staging manifest moves \`staged ➔ committed\` (\`committed_at\`, \`committed_count\`); a committed manifest hides Commit and shows "✅ Already Synced".
   - **Layer 3 — Database ticket de-duplication:** the server checks \`ticket_number + sale date + location\` against \`sales\` before every insert and skips anything already present (0 duplicate sales, ever).

7. **LAW 7 — Date Bucketing Standard.**
   Group sales by the **calendar \`sold_date\`** as written — never by payout/check/paid dates. Month keys are one-indexed \`YYYY-MM\` strings produced by string parsing (\`calendarMonthKeyFromDateString\`, \`pacificMonthKey\`) and labeled by \`monthKeyToLabel\` (\`2026-11\` ➔ \`November 2026\`). Never derive a month from \`Date#getMonth()\` (0-indexed), and never convert a date-only/UTC-midnight sold date through a time zone. \`11-02-2026\` and \`11-03-2026\` must render as "November 2026".
`;

const WORKFLOW_AND_ANTI_GLITCH_RULES = `### Antigravity IDE Workflow & Gemini Web Anti-Glitch Rules
1. **Exact Antigravity IDE Model + Level Lock:** Every IDE prompt must specify one of the exact Antigravity IDE dropdown choices + thinking level:
   - \`Gemini 3.8 Flash\` -> Level: \`Low\` or \`Medium\` (fast reads, doc/session syncs, single-file edits)
   - \`Gemini 4 Argon\` -> Level: \`Medium\` or \`High\` (default daily driver for multi-file Vue/TS features & refactors)
   - \`Claude Sonnet 5.5\` -> Level: \`Medium\` or \`High\` (isolated 5-10% specialist turns only)
   - \`Claude Opus 5.5\` -> Level: \`High\` (isolated deep architecture escalation only)
   - \`GPT-OSS 120B\` -> Level: \`Medium\`
2. **Mandatory Turn-1 Self-Check Gatekeeper:** Every Gemini-locked IDE prompt must instruct the agent to verify its own model identity before making any tool call. If \`Claude Sonnet 5.5\` or \`Claude Opus 5.5\` is active on a Gemini-locked prompt, abort immediately with 0 tool calls and output: \`WRONG MODEL ACTIVE: Switch the IDE dropdown from Claude to Gemini 4 Argon (Level: High/Medium) and re-run.\` Otherwise, begin Line 1 of the reply with \`Executed by: [Your Model Identity]\`.
3. **Exact File Paths Only Rule (Zero Terminal Approvals & Zero Directory Searches):** Never invoke \`run_command\` (0 terminal calls) and never search directories. Use ONLY \`read_file\`, \`edit_file\`, and \`write_file\` on explicit file paths listed in the prompt, and output ONE single PowerShell command block at the bottom for the user to run manually.
4. **Clean Single Code Block Rule (Anti-Splice-Glitch in Gemini Web):** Whenever Gemini Web outputs a copy-paste prompt for Antigravity IDE, output ONE single fenced code block (\` \`\`\`text ... \`\`\` \`) and zero inline backticks, emojis, or horizontal dividers anywhere outside the code block so the Gemini Web streaming parser never splices or truncates the message.
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
description: Master system DNA, 3 Golden Rules, canonical Appwrite warehouse IDs (MD, DT, HG, HH), co-op waterfall rules, and active session pointers for Resale Command.
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
1. **IDE Prompt & Model Routing Standard (Google AI Ultra Pool):** Default 90–95% of Antigravity IDE work to **\`Gemini 4 Argon Medium\`** (multi-file Vue/TS features & refactors) and **\`Gemini 3.8 Flash\`** (8x lower quota draw for file inspections, doc/session syncs, and single-file edits) so sessions stay inside the Google AI Ultra Gemini quota pool; reserve \`Claude Sonnet 5.5\` / \`Opus 5.5\` strictly for isolated 5–10% complex coding/debugging turns (\`Enable AI Credit Overages\` kept \`OFF\`). Never use multi-line PowerShell blocks to write files—always instruct the IDE to use native file tools.
2. **ADHD-Friendly Model Picker Guardrail:**
   - **Rule for Gemini Web**: Whenever generating a copy-paste prompt box for Antigravity IDE, always place a bold header immediately above the code block specifying which model to select in Antigravity IDE:
     - \`🟢 PICK IN ANTIGRAVITY: Gemini 4 Argon Medium\` (for standard code/refactor prompts)
     - \`⚡ PICK IN ANTIGRAVITY: Gemini 3.8 Flash\` (for file reads, doc updates, and \`ACTIVE_SESSION.md\` / \`GEMINI.md\` syncs)
     - \`🟣 PICK IN ANTIGRAVITY: Claude Sonnet 5.5 (⚠️ Switch back to Gemini right after!)\` (only for complex, unguided bug-fixing or architecture)
   - **Rule for Antigravity IDE**: At the very end of every response in Antigravity IDE, always print this exact 1-line footer right above the chat input box:
     \`🔔 **ADHD MODEL CHECK:** Keep picker on **Gemini 4 Argon Medium / 3.8 Flash** — if you used Claude for this turn, switch back to **Gemini 3.8 Flash** now before syncing docs!\`
3. **NO Local \`astro build\`:** Every IDE prompt MUST forbid running \`astro build\` or \`npm run build\` locally (hangs Windows PC). Only run \`node scripts/validate-templates.mjs\` locally; let Vercel build in the cloud.
4. **95% / 5% Hybrid Terminal Rule:** Antigravity IDE must NEVER run terminal commands (the Windows sandbox fails with \`CreateProcessSecurityEnvironment\` and local \`astro build\` hangs the PC). Antigravity must do 100% of file inspections, code edits, and script creation using ONLY native \`read_file\` and \`write_file\` tools. For the 5% of tasks that require execution (running \`node scripts/validate-templates.mjs\` via \`npm run lint\`, running \`npm run skills:sync\`, or executing a one-time Appwrite \`.mjs\` script), Antigravity will write the script file with \`write_file\` and instruct the user to run the single 1-line command in their own terminal.
5. **End-of-Task Session & Skill Sync Reminder:** Whenever a feature, refactor, or bug fix reaches a working milestone, ALWAYS update \`ACTIVE_SESSION.md\` using \`write_file\` to log what was completed and what is next, and remind the user to run \`npm run lint\` and \`npm run skills:sync\` in their terminal.
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
      'Master system DNA, 3 Golden Rules, canonical Appwrite warehouse IDs (MD, DT, HG, HD, HH), co-op waterfall rules, and live ACTIVE_SESSION.md summary for Resale Command.',
    sources: [{ type: 'skill', name: 'hucks-resale-core' }],
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

  // 2. Embed live ACTIVE_SESSION.md into .agents/skills/hucks-resale-core/SKILL.md
  fs.mkdirSync(path.dirname(HUCKS_CORE_SKILL_PATH), { recursive: true });
  const hucksCoreSkillContent = [
    HUCKS_CORE_SKILL_HEADER.trim(),
    '',
    '---',
    '',
    '## 4. Live Active Session Summary (Auto-Synced from `ACTIVE_SESSION.md`)',
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

    const fullContent = `${frontmatter}${bundleHeader}${sections.join('\n\n---\n\n')}\n\n---\n\n${WORKFLOW_AND_ANTI_GLITCH_RULES}\n`;

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

    syncedBundles.push(bundleRecord);
    if (isChanged) {
      changedBundles.push(bundleRecord);
    }
  }

  const nextManifest = {
    lastSyncedAt: new Date().toISOString(),
    totalBundles: syncedBundles.length,
    skills: nextManifestSkills,
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(nextManifest, null, 2) + '\n', 'utf8');

  return { syncedBundles, changedBundles };
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

  console.log('\n✨ AI context & 6 bundled Gemini Web skills sync complete!');
}

main();

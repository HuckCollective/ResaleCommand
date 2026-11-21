# Prompt 01 — Audit, Deduplicate, Slim & Modernize ResaleCommand Skills Into `thehc-platform`

Paste the block below into the IDE window opened on `thehc-platform`. Attach or allow read-only access to the sibling `ResaleCommand` folder first.

```text
RECOMMENDED MODEL: Gemini 4 Carbon (High) or Orchestrator (Carbon) (or Claude Sonnet for the initial Phase 1 audit)
BEST GEMINI $0-POOL SWAP: Gemini 4 Neon (High) or Orchestrator (Neon)

TASK: Audit, Deduplicate, Slim & Modernize ResaleCommand Skills Into `thehc-platform` (Cross-OS + Cross-IDE)

PRE-FLIGHT — READ-ONLY SIBLING ACCESS CHECK (DO NOT SKIP):
1. Confirm your active workspace is `thehc-platform` (`packages/core`, `packages/ui`, `packages/lint-kit`, `apps/works`, `apps/flagship`, `functions/*`, `tools/plugins/huckleberry-agent-kit`).
2. Test read-only access to `../ResaleCommand/.agents/skills`, `../ResaleCommand/.agents/rules`, and `../ResaleCommand/.agents/plugins`.
3. If your sandbox blocks reading `../ResaleCommand/.agents`, STOP IMMEDIATELY and ask me to attach `../ResaleCommand` as a read-only workspace folder (`Add Folder to Workspace...`) or approve read access. NEVER guess legacy skill contents and NEVER edit, write, or run scripts inside `../ResaleCommand`.

FORBIDDEN ACTIONS:
- ZERO file edits, deletes, or shell commands mutating `../ResaleCommand` or `../thehcllc`.
- On Windows (`win32`), NEVER run `astro build`, `vite build`, Playwright, Puppeteer, or headless browsers.
- ZERO `.cmd` suffixes inside any `package.json` script (use bare cross-OS binary names inside `package.json`; use `pnpm.cmd` only when running PowerShell commands directly on Windows).
- ZERO `@google/generative-ai` imports, `PUBLIC_*` secret env vars, or DaisyUI v4 CSS shorthands (`var(--b1)`, `var(--p)`).
- ZERO hardcoded drive-letter paths, `/Users/` paths, or local file URIs in any skill, rule, agent, or config file.
- ZERO duplicate skill names or competing subagent names between `tools/plugins/huckleberry-agent-kit/` and `.agents/skills/`.

PHASE 1 — AUDIT `thehc-platform` ARCHITECTURE FIRST:
Read our existing monorepo structure (`AGENTS.md`, `package.json`, `pnpm-workspace.yaml`, `packages/core`, `packages/ui`, `packages/lint-kit/scripts/validate-templates.mjs`, `packages/lint-kit/scripts/guard-local-build.mjs`, `apps/works`, `apps/flagship`, `functions/*`, `tools/scripts/link-global-plugin.mjs`, `tools/scripts/export-gemini-web.mjs`, and all files inside `tools/plugins/huckleberry-agent-kit/`).
Then review all 23 skills, 4 rules, and 2 auditor agents in `../ResaleCommand/.agents/` against our actual monorepo stack (Astro 7, @astrojs/vercel, @astrojs/vue, Vue 3.5 `<script setup lang="ts">`, Tailwind v4, DaisyUI v5 29-token `huckleberry` theme, Zod 4, TypeScript `~6.0.3`, `@google/genai`, Appwrite `resale_db` + Node 24 Cloud Functions, `pnpm verify`, and integer-cent co-op waterfall math).

PHASE 2 — TIER 1: UPGRADE GLOBAL PLATFORM KIT (`tools/plugins/huckleberry-agent-kit/`) — KEEP 4 SKILLS + 3 AGENTS LEAN:
Do NOT dump domain-specific resale SOPs into the global plugin (`pnpm agent:link` exposes this kit globally across projects). Instead, upgrade the 4 existing universal skills and 3 `hc-*` agents with battle-tested invariants from `ResaleCommand`:
1. `skills/huckleberry-design-system/`:
   - Merge `daisyui` + `vue-component-standards` here (do NOT copy `daisyui` or `vue-component-standards` as separate skills).
   - Keep `SKILL.md` <= 5 KB (29-token `huckleberry` theme, Tailwind v4 `@reference`, `@thehc/ui` primitives, Vue 3.5 `<script setup lang="ts">` + TS `~6.0.3`).
   - Move detailed patterns into `references/daisyui-v5-patterns.md` and `references/vue-35-sfc-and-camera-rules.md`: Fragment/`<Teleport>` explicit `defineProps` & `defineEmits`, `client:only="vue"` for global overlays, WebRTC `v-show` zero-blackout rule, never combine `line-clamp-*` with vertical padding (`p-*/py-*/pb-*`) on the same element, `<BottomActionDock>` / `<PaginationDock>` `.rc-dock-spacer` `ResizeObserver` clearance (never add manual `pb-28+`), Appwrite `<img>` `/preview` to `/view` `@error` fallback, `askConfirm`/`addToast` (zero `window.alert/confirm/prompt`), and Rule-of-Two primitive extraction.
2. `skills/gemini-genai-patterns/`:
   - Merge universal runtime AI architecture rules from `ai-architecture-and-cost-optimization`: Two-World strict boundary (`@google/genai` runtime in `@thehc/core/ai` vs IDE model routing), evergreen models + `ThinkingLevel`, `calibrationBlock` vs `authoritativeUserNotes` prompt isolation, Vercel Fluid Compute `/api/*` streaming vs Appwrite Cloud Functions (`timeout: 300..900`), and Zod 4 structured JSON schemas. Strip all mentions of `@google/generative-ai`.
3. `skills/appwrite-schema-ops/`:
   - Merge production `resale_db` safety invariants from `rules/appwrite-and-api-guardrails.md`: never write `quantity: 0` (use `status: 'sold' | 'combined'` with `quantity >= 1`), never send derived `isMultiQty` to Appwrite, cap `imageId`/`galleryImageIds` to <= 255-char File IDs (zero Base64 in DB), cap `rawAnalysis`/`components` <= 64,000 chars, mandate `Query.limit(100)` + `Query.orderDesc('$id')` cursor pagination (prevent silent 25-row truncation), and enforce `parsePriceValue()` (anti-range concatenation) + integer-cent storage conventions alongside `@thehc/core`.
4. `skills/fast-local-verify/`:
   - Document `pnpm.cmd verify` (`win32`) vs `pnpm verify` (`darwin`/`linux`), cloud Vercel builds (`VERCEL=1`), plus `pnpm agent:link` and `pnpm agent:export-web` after modifying skills/plugins.
5. `agents/hc-appwrite-architect.md`, `agents/hc-ui-steward.md`, `agents/hc-migration-auditor.md`:
   - Fold the read-only checklists from `rc-ledger-and-schema-auditor` and `rc-pre-push-contract-auditor` into these 3 existing `hc-*` agents (3 Ricochet CSV formats where `Products-*.csv` NEVER creates `sales`, ticket-line multiset identity, LOCKED Booth Bin rule, Law 7 calendar `YYYY-MM` `sold_date` bucketing, ES5 bookmarklets + 3 Physical Retail Tag Safety Laws, `astro:actions` vs `/api/*` CORS boundary, and case-exact cross-OS imports). Do NOT copy `rc-*` agents as duplicates.

PHASE 3 — TIER 2: SLIM & MODERNIZE DOMAIN SKILLS & RULES (`.agents/skills/` & `.agents/rules/`):
Keep every copied file focused, progressive-disclosure friendly (`SKILL.md` <= 6–8 KB max; move bulky lookup tables, examples, and incident histories into `references/*.md`), with crisp third-person `"Use when..."` YAML descriptions (`name` + `description`), zero hardcoded Windows paths, and all symbol/file paths remapped to `@thehc/core`, `@thehc/ui`, `apps/works`, `apps/flagship`, `functions/fn-coop-waterfall-ledger`, `astro:actions` vs `/api/*`, Zod 4, and `pnpm verify`:
1. SKIP / RETIRE legacy single-repo glue: `hucks-resale-core` (replaced by root `AGENTS.md`) and `ai-context-sync` (replaced by monorepo packages + `tools/scripts/link-global-plugin.mjs` + `tools/scripts/export-gemini-web.mjs`).
2. UNIFY `sales-reconciliation-and-payout-invariants`: Merge the 1.6 KB pointer skill and 16 KB rule into `.agents/skills/sales-reconciliation-and-payout-invariants/SKILL.md` (<= 4 KB actionable checklist) + `references/ticket-ledger-and-incident-history.md`, backed by a concise `.agents/rules/sales-and-ledger-guardrails.md`.
3. SLIM, DEDUPLICATE & MODERNIZE the remaining 16 domain/UX skills into `.agents/skills/<name>/`:
   - UX & UI Domain (3):
     * `ux-design-system-taxonomy`: Break the 42.9 KB monolith into `SKILL.md` (<= 5 KB: 4 View Archetypes, Plain-English Collective Voice + banned jargon rule, `@thehc/ui` primitive index) + `references/view-archetypes-and-collective-voice.md`, `references/docks-drawers-and-trays.md`, `references/photo-media-and-tabs.md`.
     * `laws-of-ux`: Slim `SKILL.md` from 18.6 KB to ~5 KB router pointing to its 6 `references/00..05-*.md` files, updated for `@thehc/ui` DaisyUI v5 / Tailwind v4 tokens and `.rc-page-shell`.
     * `mobile-ux-standards`: Keep concise (<= 6 KB) aligned to `@thehc/ui` touch targets (`44x44px` mobile floor + `md:` table carve-out).
   - AI Vision & Valuation Domain (4):
     * `ai-scout-and-deep-scan-validation`: Fold in 3 Scout Archetypes, Auction vs Straight Sale format detection, and Shipping Drag math from `ai-architecture-and-cost-optimization`; update schemas to Zod 4 + `@thehc/core/ai` + `apps/works` `astro:actions` / `/api/*`.
     * `multi-angle-photo-slicing`: Map `/api/proxy-image` and Lot Splitter gallery logic to `apps/works`.
     * `sourcing-and-ai-enrichment`: Map ShopGoodwill, Auction Scout bookmarklet, and receipt OCR to `@thehc/core` + `apps/works`.
     * `secondary-market-appraisal-and-valuation`: Keep cash-cleared comp hierarchy & fee schedules aligned to `@thehc/core` integer-cent math.
   - Inventory, Booth & Labels Domain (5):
     * `resale-inventory-core`: Split 18.7 KB into `SKILL.md` (<= 6 KB) + `references/status-and-org-bucketing.md` referencing `@thehc/core` (`warehouses`, `salesBucketing`).
     * `lot-profit-and-exit-strategy`: Keep 4-Tier Exit heuristics & `parsePriceValue` anti-concatenation rules.
     * `haul-ingestion` & `thermal-label-printing`: Deduplicate overlapping Rollo/Code128 content — keep hardware DPI/layout specs in `thermal-label-printing` and link to it from `haul-ingestion`.
     * `resale-booth-sync`: Keep 1-to-1 `0EJ` <-> `UPC` bijection, 3 Physical Retail Tag Safety Laws (`MISSING_IN_MD` blank-only writes, mandatory Pre-Flight Queue Preview, 1-click `Adopt Booth Tag`), and map to `apps/works/public/ricochet-upc-sync.user.js` + `@thehc/core`.
     * `resale-merchandising-and-bundling`: Keep Combines vs Bundles + 2-stage deterministic/LLM retrieval rules.
   - Cooperative, Brand, Tax & Social Domain (4 — Shared `apps/works` + `apps/flagship`):
     * `democracy-at-work-cooperative` (+ `references/WSDE_MONDRAGON_SELC_REFERENCE.md`): Map 70/30 waterfall, integer cents, and governance to `@thehc/core`, `functions/fn-coop-waterfall-ledger`, and `apps/flagship`.
     * `huckleberry-brand-and-domain-identity`: Preserve `Works@TheHC` / `The Huckleberry Collective`, 3-tier failover domains (`works.thehc.llc`, `works.thehc.coop`, `resalecmd.com`, `thehc.llc`, `thehc.coop`), and `@thehc.llc` Appwrite SMTP rules mapped to `@thehc/core` brand config.
     * `tax-and-expense-compliance`: Preserve IRS Schedule C / Form 1065 statutory categories, proof-of-payment invariants, and Commons vs Personal separation.
     * `social-marketing-and-drop-broadcasting`: Map DropCast (`apps/works`) and public announcements (`apps/flagship`) with IP/trademark guardrails.
4. MODERNIZE 4 monorepo workspace rules in `.agents/rules/`:
   - `appwrite-and-core-guardrails.md` (`packages/core/**/*.ts`, `functions/*/src/**/*.ts`, `apps/*/src/actions/**/*.ts`, `apps/*/src/pages/api/**/*.ts`)
   - `sales-and-ledger-guardrails.md` (`packages/core/src/**/sales*`, `packages/core/src/**/coop*`, `functions/fn-coop-waterfall-ledger/**/*.ts`, `apps/works/src/**/*sales*`, `apps/works/src/**/*coop*`)
   - `vue-and-style-guardrails.md` (`packages/ui/src/**/*.{vue,css}`, `apps/*/src/**/*.{vue,astro,css}`)
   - `bookmarklet-es5-and-tag-safety.md` (`apps/works/public/*.user.js`, `apps/works/src/pages/scripts/*.ts`, `packages/core/src/bml/**/*.ts`)

PHASE 4 — CROSS-IDE & CROSS-OS DISCOVERY + AUTOMATED GUARDRAILS + VERIFY:
1. Create `.agents/skills.json` so Antigravity IDE / `agy` CLI discovers both `.agents/skills/*` AND `tools/plugins/huckleberry-agent-kit/skills/*` natively without copying files:
   { "entries": [{ "path": "tools/plugins/huckleberry-agent-kit/skills" }] }
2. Create `.vscode/settings.json` (if missing, or merge carefully) so VS Code, Cursor, Codex, and Antigravity share identical LF endings, AGENTS.md, skills, rules, and watcher exclusions on Windows, macOS, and Linux:
   - "files.eol": "\n"
   - "chat.useAgentsMdFile": true
   - "chat.useAgentSkills": true
   - "chat.skillsLocations": { ".agents/skills": true, "tools/plugins/huckleberry-agent-kit/skills": true }
   - "chat.instructionsFilesLocations": { ".agents/rules": true, "tools/plugins/huckleberry-agent-kit/rules": true }
   - "files.watcherExclude": exclude **/node_modules/**, **/.turbo/**, **/.astro/**, **/dist/**, **/.vercel/**
3. Update `tools/scripts/export-gemini-web.mjs` (`pnpm agent:export-web`) so it packages both `tools/plugins/huckleberry-agent-kit` and `.agents/skills` cleanly into modular topic Markdown bundles under `dist/gemini-web/` (respecting gitignore so `dist/` is never committed).
4. Extend `packages/lint-kit/scripts/validate-templates.mjs` (plus `--self-test` coverage) to validate `.agents/skills/*/SKILL.md` and `tools/plugins/huckleberry-agent-kit/skills/*/SKILL.md`:
   - Require valid YAML frontmatter (`name` + non-empty `description`).
   - Enforce `SKILL.md` progressive-disclosure size limit (e.g. `<= 10240` bytes; bulky examples belong in `references/`).
   - Forbid drive-letter paths, `/Users/` paths, local file URIs, `../ResaleCommand`, `@google/generative-ai`, or `npm run` inside skill/rule files.
5. Run final cross-platform verification using our OS-appropriate CLI (`pnpm.cmd` in Windows PowerShell; `pnpm` on macOS/Linux):
   - `node tools/scripts/link-global-plugin.mjs` (must run on Windows so NTFS hardlinks pick up newly added `references/*.md` files inside `huckleberry-agent-kit`; runs dir symlink on macOS/Linux)
   - `node tools/scripts/export-gemini-web.mjs`
   - `pnpm.cmd verify` (Windows) / `pnpm verify` (macOS/Linux) — must pass with ZERO errors (and ZERO local Vite/Astro builds on Windows).

OUTPUT AT THE END:
Show a concise audit summary table comparing Legacy `ResaleCommand/.agents` vs Upgraded `thehc-platform` (`Merged`, `Modernized & Slimmed`, `Retired`, total KB before vs after, and verification results).
```

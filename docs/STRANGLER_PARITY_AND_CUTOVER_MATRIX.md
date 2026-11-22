# Strangler Feature Parity & ASAP Cutover Matrix (`ResaleCommand` ➔ `thehc-platform`)

> **Status:** `ResaleCommand` is under an official **Feature Freeze** (critical production bug, security, or ledger fixes ONLY).
> **Shared Database Advantage:** Both repositories connect to the **exact same Appwrite Cloud project (`69714b35003a8adab6bb`) and `resale_db` database** (`https://sfo.cloud.appwrite.io/v1`). Switching production domains requires **zero database migration and zero downtime**.

---

## 1. Executive Cutover Rules (Anti-Rabbit-Hole Contract)

1. **Strictly One Wave at a Time:** Work exclusively on `thehc-platform` branch `dev` using the ordered prompts in [`docs/prompts/README.md`](prompts/README.md). Never start Wave `N+1` until Wave `N` passes `pnpm.cmd verify` (Windows) / `pnpm verify` (macOS/Linux) and shadow QA on `works-dev.thehc.llc`.
2. **Never Mutate Sibling Repos:** From `thehc-platform`, read `ResaleCommand` strictly **read-only** to extract fixtures, business logic, and UX contracts. Never edit `ResaleCommand` during migration waves.
3. **Security Lockdown First (`Wave 1` Gate):** Currently `thehc-platform/apps/works` exposes 5 `astro:actions` (`queryInventory`, `quickCreateItem`, `updateItemStage`, etc.) using the admin Appwrite key with zero session middleware and a hardcoded fallback `tenantId`. **Do NOT expose `works-dev.thehc.llc` or `works-main.thehc.llc` publicly until Wave 1 locks `/_actions/*`, `/api/*`, and SSR pages behind verified Appwrite sessions + `Member Hats & Access`.**
4. **Core Engine Before Booth & Sales UI (`Wave 4` Gate):** Memory Den Booth Sync (`Wave 4`) depends on `matchMemoryDenInventoryItem`, `buildLockedMultiBinMap`, `splitTrailingBoothSku`, and `usedUpcs` self-healing. Therefore, the full Law 3 & Law 7 `salesBucketing.ts` + `ricochetPayoutParser.ts` port (replacing `thehc-platform`'s current 44-line UTC-converting stub) happens **at the start of Wave 4** with Vitest golden tests, before Booth Sync UI and `Wave 5` Sales Commit.
5. **Permanent Marketplace Safety Ban:** Never port or build third-party seller-portal DOM-injection bookmarklets (`whatnot.com`, `poshmark.com`, `depop.com`, `ebay.com`, `mercari.com`). Keep ONLY the two sanctioned bookmarklet families:
   - **Memory Den / Ricochet POS Sync** (`/scripts/rico-bookmarklet.js` + `public/ricochet-upc-sync.user.js` — strict ES5 + 3 Physical Retail Tag Safety Laws).
   - **Auction & ShopGoodwill Sourcing Clipper** (`/scripts/auction-bookmarklet.js` — reads sourcing lots into our intake queue).
   - Online selling uses **In-App Split-Screen Copy Kit + Official Seller Hub CSVs** (`Wave 2`) and **Appwrite Cloud Functions + Official eBay / Whatnot REST APIs** (`Post-Cutover Waves 7–8`).

---

## 2. Already Complete in `thehc-platform` (Foundation `Phase 0–2A`)

| Area | Status in `thehc-platform` | Notes |
| :--- | :--- | :--- |
| **Monorepo & Tooling** | ✅ Complete | Node 24, `pnpm@12.21.0`, Turborepo, Astro 7, `@astrojs/vercel` 11, Vue 3.5, Tailwind CSS v4, DaisyUI v5 29-token `huckleberry`, Zod 4, TS `~6.0.3`, `oxlint`, `vitest`, Windows `guard-local-build.mjs`. |
| **Agent Skills & Rules (`Prompt 01`)** | ✅ Complete | `tools/plugins/huckleberry-agent-kit` (4 agents, 4 universal skills, rules, host guardrail) + `.agents/skills/*` (18 domain skills incl. `strangler-migration`) + `.agents/rules/*` + `.agents/skills.json`. |
| **Appwrite `TablesDB` & Types** | ✅ Complete | `appwrite.config.json`, `packages/core/src/appwrite/*`, `resolveAppwriteEnv` (`*_dev` mirrors), generated `appwrite.d.ts`, `toUserMessage`. |
| **Runtime Gemini (`@thehc/core/ai`)** | ✅ Base Complete | `@google/genai` client + `ai_telemetry` (`dev:` prefix in dev). Needs Wave 3 vision schemas/prompts ported. |
| **UI Primitives (`@thehc/ui`)** | ✅ Base Complete | `huckleberry.css`, `HcBottomActionDock`, `HcConfirmContainer`, `HcKpiStatGrid`, `HcStatusBadge`, `HcToastContainer`, `contrast.ts`, `uiFeedback.ts`. |
| **Waterfall Cloud Function** | ✅ Base Complete | `functions/fn-coop-waterfall-ledger` + `@thehc/fn-harness` (`tsdown` Node 24 bundle + Vitest). |

---

## 3. Route-by-Route Parity Ledger (All 50 `ResaleCommand` UI Pages)

| Legacy `ResaleCommand` Page | Target App in `thehc-platform` | Cutover Wave | Disposition & Migration Notes |
| :--- | :--- | :---: | :--- |
| `/login` | `apps/works` | **W1** | SSR cookie + Appwrite session login. |
| `/logout` | `apps/works` | **W1** | Clears SSR session cookie + redirects to `/login`. |
| `/signup` | `apps/works` | **W1** | New member account registration + invite/join-request link. |
| `/join` | `apps/works` + `apps/flagship` | **W1 / W6** | Member onboarding intake (`W1` operator accept + `W6` public flagship intake). |
| `/profile` | `apps/works` | **W1** | Member profile, active prefix (`HUCK-` / `PDXGL-` / `BB-`), hats. |
| `/settings` | `apps/works` | **W1** | Personal operator preferences & printer/camera defaults. |
| `/org/settings` | `apps/works` | **W1** | `Member Hats & Access`, `Account Steward` controls, live `warehouses` config (`usesRicochet`, `salesIntakeMode`, `commissionRate`, `monthlyRent`). |
| `/bml/connect` | `apps/works` | **W1** | Bookmarklet Bearer token pairing UI (paired with `/api/bml/session` & `/api/bml/ping` in `W1`). |
| `/` & `/dashboard` | `apps/works` | **W1** | Authenticated Operator Dashboard & Alerts (`dashboardAlerts`, KPI summary, quick actions). |
| `/404` | `apps/works` + `apps/flagship` | **W1** | Branded operator & editorial 404 pages. |
| `/inventory` | `apps/works` | **W2** | Unified Table + Card workbench, `matchesTokenizedFields` search, reactive local updates, bulk actions, full **Item Drawer** (Overview, Photos with `/preview`➔`/view` fallback, `✂️ Split Lot`, `📦 Combine Similar`, `🎁 Build Bundle`, `↩️ Undo Combine`, and Online Bin **In-App Copy Kit + Official eBay/Whatnot/Poshmark CSVs**). |
| `/item/[id]` | `apps/works` | **W2** | Deep-link item view / drawer launcher. |
| `/scan` | `apps/works` | **W2** | Mobile WebRTC barcode / QR floor scanner (`upcAuthority` routing). |
| `/labels/studio` | `apps/works` | **W2** | Direct thermal printing (Rollo, Zebra, Dymo, Jewelry Butterfly tags, Booth Bins). |
| `/labels/test` | `apps/works` | **W2** | Hardware calibration test sheet inside `/labels/studio?tab=calibration` (or `/labels/test`). |
| `/purchases` | `apps/works` | **W3** | Purchases / Hauls ledger (`matchesTokenizedFields` search + KPIs + Slide-Over Import Tray). |
| `/purchases/new` | `apps/works` | **W3** | New purchase order / cash / barter haul creation. |
| `/purchases/speed-entry` | `apps/works` | **W3** | Fast multi-row haul entry (`HG` / `HH` default location Law 1). |
| `/purchases/ingest` | `apps/works` | **W3** | Receipt OCR + AI unboxing / lot decomposition workflow. |
| `/purchases/import` | `apps/works` | **W3** | ShopGoodwill CSV & order manifest import. |
| `/purchases/[id]` | `apps/works` | **W3** | Purchase detail, cost allocation, and `✂️ Split Lot` launch. |
| `/scout/[...view]` | `apps/works` | **W3** | `⚡ Quick Scout`, `🔍 Deep Scan`, Buy Trackers, and Auction Sweep review. |
| `/warehouse` | `apps/works` | **W4** | 4 canonical facilities (`MD`, `DT`, `HG`, `HH`) overview & capacity KPIs. |
| `/warehouse/[id]` | `apps/works` | **W4** | Per-facility inventory, bin breakdown, and dynamic fee/rent display. |
| `/warehouse/sync/[...location]` | `apps/works` | **W4** | `/warehouse/sync/MD|DT|HG|HH` — Ricochet 2-way catalog verify, `808 / 808` live `locationSyncScorecard`, Realtime manifest sync, 1-click `🏷️ Adopt Booth Tag`. |
| `/sales` | `apps/works` | **W5** | Official Sales Ledger (Law 7 calendar `sold_date` `YYYY-MM` bucketing, partner tabs, tokenized search). |
| `/sales/new` | `apps/works` | **W5** | Manual / pop-up / online sale recording with `salesBucketing` link. |
| `/sales/[id]` | `apps/works` | **W5** | Sale ticket breakdown, waterfall audit, item provenance link. |
| `/sales/import/[...location]` | `apps/works` | **W5** | Ricochet Live Sales Sync (`Payouts *.csv` + `Payout History *.csv`), Dusty Tiger paper sheet OCR, Law 6 3-Tier Commit Idempotency. |
| `/expenses` | `apps/works` | **W5** | IRS Schedule C / Form 1065 ledger + Personal Write-Off vs. Co-op Commons separation + receipt attachment. |
| `/coop` | `apps/works` | **W5** | Co-op Hub overview, Commons Pool health, active month status. |
| `/coop/settlements` | `apps/works` | **W5** | 4-Gate Monthly Waterfall Settlements (`HUCK-`, `PDXGL-`, `BB-` `$85.41` offset, `SWEAT-` Gate 4B), Month Lock, PDF statement export. |
| `/coop/labor` | `apps/works` | **W5** | Sweat-equity labor log & task board (`SWEAT-` hours). |
| `/coop/governance` & `/[id]` | `apps/works` | **W5** | Loomio-style 1-member-1-vote consent proposals & voting. |
| `/coop/charter` & `/docs/[slug]` | `apps/works` + `apps/flagship` | **W5 / W6** | Operating charter & co-op SOP docs via Astro 7 Content Layer. |
| `/coop/cms` | `apps/works` | **W6** | Headless Flagship CMS editor publishing to `apps/flagship`. |
| `/subsite` & `/subsite/item/[id]` | `apps/flagship` (`/shop`) | **W8 (Retired in Works)** | **Do NOT port `/subsite` to `apps/works`.** Replaced cleanly by `apps/flagship` `/shop` & `/shop/[id]` backed by sharded zero-PII Cloud Function catalog (`W7`–`W8`). |
| `/social` & `/social/[id]` | `apps/works` | **W9 (Post-Cutover)** | Drop Broadcast & Social Campaign Studio — fast-follow right after domain cutover. |
| `/coop/vault` | `apps/works` | **W9 (Post-Cutover)** | Founder / Steward prompt & ops vault — optional fast-follow. |
| `/studios/*` (`index`, `appraisal`, `bookmarklets`) | `apps/works` | **W9 / Consolidated** | Bookmarklet setup lives in `/bml/connect` (`W1`) + `/warehouse/sync/MD` (`W4`); standalone studios optional in `W9`. |
| `/inventory-table` | `apps/works` | **Redirect (`W2`)** | `301` redirect ➔ `/inventory?view=table` (single unified workbench). |
| `/inventory/sync` | `apps/works` | **Redirect (`W4`)** | `302` redirect ➔ `/warehouse/sync`. |
| `/demo` | — | **Retired** | Retired; `thehc-platform` uses live `*_dev` Appwrite Sandbox Mode (`envMode === 'dev'`). |

---

## 4. API, `astro:actions` & Bookmarklet Contract Matrix

Per `thehc-platform/AGENTS.md`, **first-party UI mutations move to `astro:actions` + Zod 4**, while **external bookmarklets, CORS clippers, public feeds, image proxies, and streaming AI endpoints stay at exact `/api/*` + `/scripts/*` paths**:

| Endpoint Group | Exact Paths Preserved in `/api/*` or `/scripts/*` | Moved to Typed `astro:actions` | Wave |
| :--- | :--- | :--- | :---: |
| **Health & Auth Gate** | `/api/health`, `src/middleware.ts` (guards `/_actions/*`, `/api/*`, pages) | `auth.*`, `orgSettings.*`, `memberAccess.*`, `joinRequests.*` | **W1** |
| **Bookmarklet Core Pairing** | `/api/bml/session`, `/api/bml/ping`, `/scripts/bml-test.js` (CORS `OPTIONS` + Bearer token) | — | **W1** |
| **Inventory, Media & Outbox** | `/api/proxy-image`, `/api/upload-remote-image` | `inventory.*` (`bulkUpdate`, `bulkDelete`, `splitLot`, `combineItems`, `undoCombine`), `channelOutbox.*` | **W2** |
| **AI Vision & Sourcing Bookmarklet** | `/api/identify-item`, `/api/inspect-lot`, `/api/parse-receipt`, `/api/estimate-price`, `/api/extract-components`, `/api/extract-images`, `/api/detect-watermarks`, `/api/generate-description`, `/api/scout-and-save`, `/api/proxy-item-details`, `/scripts/auction-bookmarklet.js`, `/api/bml/auction-sweep`, `/api/bml/sgw-sync` | `purchases.*` (`create`, `speedEntry`, `importSgwCsv`, `allocateCosts`) | **W3** |
| **Ricochet / Memory Den Booth Sync** | `/scripts/rico-bookmarklet.js`, `public/ricochet-upc-sync.user.js` (**strict ES5**), `/api/md-verify-report` (incl. `adopt_md_upc`), `/api/manifests/ricochet-drop-sync`, `/api/ai-match-booth-items`, `/api/match-inventory`, `/api/suggest-lot-matches` | `warehouses.*`, `manifests.*` | **W4** |
| **Sales, Payouts, Expenses & Co-op** | `/api/sales/ricochet-sync`, `/api/sales/sync-memoryden-payouts`, `/api/sales/default-payout`, `/api/sales/parse-sheet` | `sales.*` (Law 6 3-tier idempotent commit), `expenses.*`, `coop.*` (`settlements`, `monthLock`, `labor`, `tasks`, `proposals`, `membershipAction`, `prefixRequest`) | **W5** |
| **Public Flagship CMS & Join** | `/api/public/flagship-content`, `/api/join-request`, `/api/join-reminders` | `flagshipCms.*` | **W6** |
| **Retired Legacy Endpoints** | `/api/v1/items` (unused), any `listing-assist` bookmarklet routes (permanently banned) | — | **Retired** |

---

## 5. Core Domain Modules Parity (`packages/core/src/domain/`)

| Module | Current `thehc-platform` State | Target Wave & Required Upgrade |
| :--- | :--- | :--- |
| `auth`, `memberAccess`, `memberHats`, `curatorOwnership` | Missing (hardcoded `tenantId` in `actions/index.ts`) | **W1:** Port session verification, dynamic `tenantId` resolution (Law 2), hat permissions, and prefix ownership (`HUCK-`, `PDXGL-`, `BB-`). |
| `warehouses.ts` | Base fields (`code`, `commissionRate`, `monthlyRent`) | **W1:** Parse `labelConfig` JSON (`usesRicochet`, `supportsPaperSalesSheet`, `salesIntakeMode`, dynamic manifest keys). |
| `upcAuthority.ts`, `searchEngine.ts`, `onlineListingPacket.ts`, `exportUtils.ts` | Missing | **W2:** Port clean 4-digit `HUCK-XXXX` allocation, `matchesTokenizedFields`, `parsePriceValue`-safe eBay/Whatnot/Poshmark CSV generators, Depop `3.3%` fee, and zero-injection Copy Kit packet builder. |
| `ai/*` (`schemas`, `prompt-builders`, `verify-inspection`, `appraisalCalibration`) | Base `genai.ts` + `telemetry.ts` | **W3:** Port Zod 4 structured schemas (`speed-scout`, `lot-inspection`), OCR grounding rules, and secondary-market fee calibration. |
| `salesBucketing.ts` & `ricochetPayoutParser.ts` | **44-line stub (`new Date().toISOString()` violates Law 7!)** | **W4 (Start of Wave):** Replace stub with full Law 3 & Law 7 engine (`splitTrailingBoothSku`, `canonicalTicketNumber`, `isPayoutSummaryRow`, `assignOccurrenceFingerprints`, `flagAlreadyRecordedRows`, `matchMemoryDenInventoryItem`, `buildLockedMultiBinMap`, `calendarMonthKeyFromDateString`, `pacificMonthKey`, `monthKeyToLabel`) + all 3 Memory Den CSV parsers + Vitest golden tests (`11-02-2026` ➔ `"November 2026"`, zero UTC shift). |
| `coopWaterfall.ts` & `settlementEngine.ts` | Base waterfall + 4-Gate scaffold | **W5:** Full 4-Gate monthly settlement engine (`BB-` `$85.41` contractual rent offset, `SWEAT-` Gate 4B labor pool, Mondragon reserve split, `coop_ledger` lock). |

---

## 6. Zero-Downtime Vercel Cutover Runbook (`Wave 6`)

1. **Shadow Dev Verification (`works-dev.thehc.llc` & `dev.thehc.llc`):**
   - Environment variables point `APPWRITE_ENV_MODE=dev` (`*_dev` staging mirrors).
   - Verify Waves `W1`–`W6` end-to-end: Login ➔ Item Intake & Label Print ➔ AI Scout ➔ Memory Den Pre-Flight Preview ➔ Ricochet Payout Staging & Idempotent Commit ➔ 4-Gate Settlement Preview.
2. **Pre-Cutover Live Read/Write Smoke (`works-main.thehc.llc` & `main.thehc.llc`):**
   - Merge `dev` ➔ `main` inside `thehc-platform` ONLY after user approval.
   - Verify against live `resale_db`: `808 / 808` Memory Den scorecard parity, live sales month totals match `ResaleCommand` to the exact cent, and Ricochet bookmarklet `/api/bml/ping` returns `200` with CORS headers.
3. **Instant Domain Alias Flip (Zero DB Downtime):**
   - Attach `legacy.resalecmd.com` to the frozen `ResaleCommand` Vercel project (`prj_Z5UbbHQPjViiiJbNviLuvwWiqQet`) for a 14-day instant rollback safety net.
   - Move `works.thehc.llc`, `works.thehc.coop`, and `resalecmd.com` to `@thehc/works`.
   - Move `thehc.llc` and `thehc.coop` to `@thehc/flagship`.
4. **Post-Cutover Growth (`Waves 7–9` in `thehc-platform`):**
   - Run [`02-thehc-platform-storefront-cloud-functions.md`](prompts/02-thehc-platform-storefront-cloud-functions.md) (`Wave 7` — sharded zero-PII catalog + official eBay & Whatnot APIs) and [`03-flagship-storefront-ui-and-checkout.md`](prompts/03-flagship-storefront-ui-and-checkout.md) (`Wave 8` — public `/shop` & checkout).

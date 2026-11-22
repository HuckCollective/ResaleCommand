# Saved Cross-Repo IDE Prompts (`thehc-platform` Cutover Queue)

Self-contained copy-paste prompts for the IDE window opened on **`thehc-platform`** (working on branch **`dev`**). Each prompt file holds **exactly one** fenced `text` block. Execute strictly **one wave at a time** so `ResaleCommand` stays frozen and you reach production cutover ASAP without splitting focus.

Master parity & cutover reference: [`docs/STRANGLER_PARITY_AND_CUTOVER_MATRIX.md`](../STRANGLER_PARITY_AND_CUTOVER_MATRIX.md).

## Pre-Cutover Parity Queue (`Waves 0–6` — Reach Domain Switch ASAP)

| Order | File | Scope in `thehc-platform` | Recommended Model | Status |
| :-: | :--- | :--- | :--- | :--- |
| 0 | [`01-thehc-platform-skills-migration.md`](01-thehc-platform-skills-migration.md) | Agent skills, rules & `huckleberry-agent-kit` consolidation | Gemini 4 Carbon (High) | ✅ **Completed in `thehc-platform`** |
| **1** | [`W1-thehc-platform-auth-and-shell.md`](W1-thehc-platform-auth-and-shell.md) | **Security Lockdown First:** SSR `middleware.ts` (`/_actions/*`, `/api/*`, pages), dynamic `tenantId` & `Member Hats & Access`, `warehouses` `labelConfig`, `/login`, `/org/settings`, `/dashboard`, `/bml/connect` + `/api/bml/session` & `/ping` | Orchestrator (Carbon) or Gemini 4 Carbon (High) | ⏭️ **Next Up (Wave 1)** |
| **2** | [`W2-thehc-platform-inventory-drawer-and-labels.md`](W2-thehc-platform-inventory-drawer-and-labels.md) | Unified `/inventory` (Table + Cards + tokenized search + bulk), `upcAuthority`, full **Item Drawer** (Photos `/preview`➔`/view`, `✂️ Split Lot`, Combines, Safe Copy Kit + Official CSVs), `/scan`, `/labels/studio` | Orchestrator (Carbon) or Gemini 4 Carbon (High) | Parked (after W1) |
| **3** | [`W3-thehc-platform-purchases-ai-and-scout.md`](W3-thehc-platform-purchases-ai-and-scout.md) | `@thehc/core/ai` vision schemas/prompts, `/purchases/*` (Speed Entry, Receipt OCR Ingest, SGW CSV), `/scout/[...view]`, and Auction Sourcing Bookmarklet (`/scripts/auction-bookmarklet.js`) | Orchestrator (Carbon) or Gemini 4 Carbon (High) | Parked (after W2) |
| **4** | [`W4-thehc-platform-booth-sync-and-ricochet.md`](W4-thehc-platform-booth-sync-and-ricochet.md) | **Upfront full Law 3 & Law 7 `salesBucketing.ts` + `ricochetPayoutParser.ts` + golden tests**, `/warehouse/sync/MD|DT|HG|HH`, live `808 / 808` scorecard, strict ES5 `ricochet-upc-sync.user.js` + 3 Tag Safety Laws | Orchestrator (Carbon) or Gemini 4 Carbon (High) | Parked (after W3) |
| **5** | [`W5-thehc-platform-sales-and-coop-settlements.md`](W5-thehc-platform-sales-and-coop-settlements.md) | `/sales/*` + Ricochet Payout Sync (`/api/sales/*`, Law 6 3-Tier Commit Idempotency), `/expenses` (Schedule C / Form 1065), `/coop/settlements` (4-Gate + `SWEAT-` + `$85.41` offset + Month Lock + PDF), `/coop/governance` | Orchestrator (Carbon) or Gemini 4 Carbon (High) | Parked (after W4) |
| **6** | [`W6-thehc-platform-flagship-parity-and-cutover.md`](W6-thehc-platform-flagship-parity-and-cutover.md) | `/coop/cms` + `apps/flagship` live CMS/Charter/Booths/`/join`, shadow QA (`works-dev` ➔ `works-main`), `legacy.resalecmd.com` safety net, and **Zero-Downtime Production Domain Flip** | Orchestrator (Argon / Carbon) | Parked (after W5) |

## Post-Cutover Growth Queue (`Waves 7–8` — Pick Up in the New Platform!)

Storefront architecture reference: [`docs/ONLINE_STOREFRONT_AND_CHANNEL_ARCHITECTURE.md`](../ONLINE_STOREFRONT_AND_CHANNEL_ARCHITECTURE.md).

| Order | File | Scope in `thehc-platform` | Recommended Model | Status |
| :-: | :--- | :--- | :--- | :--- |
| **7** | [`02-thehc-platform-storefront-cloud-functions.md`](02-thehc-platform-storefront-cloud-functions.md) | Sharded zero-PII public catalog (`fn-storefront-catalog-sync` `<= 54 KB`/page, `syncHash` loop guard) + Official **eBay** & **Whatnot** Seller API workers | Orchestrator (Carbon) or Gemini 4 Carbon (High) | Parked (Post-Cutover) |
| **8** | [`03-flagship-storefront-ui-and-checkout.md`](03-flagship-storefront-ui-and-checkout.md) | Public `apps/flagship` `/shop` & `/shop/[id]` + Checkout (replaces retired legacy `/subsite`) | Orchestrator (Argon) or Gemini 4 Argon (Medium) | Parked (after W7) |

## Rules for Every Prompt
- Work on branch **`dev`** inside `thehc-platform`; never push to `main` until explicitly approved in Wave 6.
- Read sibling `ResaleCommand` strictly **read-only** for source contracts and golden test fixtures — never edit `ResaleCommand`.
- On Windows (`win32`), never run `astro build`, `vite build`, Playwright, Puppeteer, or headless browsers; verify every wave with `pnpm.cmd verify` and `pnpm.cmd bundle:functions`.
- Zero hardcoded drive-letter paths or local file URIs inside any file.
- Update the **Status** column here (or in `thehc-platform` session notes) as each wave completes.

# Active Session Summary (Updated Nov 22, 2026)

> 🧊 **OFFICIAL REPOSITORY FEATURE FREEZE (`ResaleCommand` — Maintenance Only):**
> - **Status:** `ResaleCommand` is officially frozen to new feature work so focus stays 100% on reaching ASAP production cutover in `thehc-platform`.
> - **Allowed in `ResaleCommand`:** Critical production bug fixes, security patches, or urgent ledger hotfixes ONLY.
> - **Master Cutover Roadmap & Ordered IDE Prompts:** Follow [`docs/STRANGLER_PARITY_AND_CUTOVER_MATRIX.md`](docs/STRANGLER_PARITY_AND_CUTOVER_MATRIX.md) and paste **one wave at a time** from [`docs/prompts/README.md`](docs/prompts/README.md) (`W1` ➔ `W6` Pre-Cutover Parity, then `W7`–`W9` Post-Cutover Storefront & Growth) inside the `thehc-platform` IDE window.
> - **Historical Sprint Archive:** Completed milestones prior to the freeze are preserved in [`docs/SESSION_ARCHIVE.md`](docs/SESSION_ARCHIVE.md).

## ✅ FEATURE FREEZE & `thehc-platform` ASAP CUTOVER ROADMAP (`alpha-1` — Nov 22, 2026)
- **Feature Freeze Guardrails ([`AGENTS.md`](AGENTS.md), [`ACTIVE_SESSION.md`](ACTIVE_SESSION.md))**: Locked `ResaleCommand` against scope creep and new feature branches while keeping all 7 Immutable Architecture Laws and template checks active for emergency maintenance.
- **Complete Route/API/Domain Parity Ledger ([`STRANGLER_PARITY_AND_CUTOVER_MATRIX.md`](docs/STRANGLER_PARITY_AND_CUTOVER_MATRIX.md))**: Audited all 50 UI routes, 44 API endpoints, 3 bookmarklet loaders, and core libraries against `thehc-platform`; resolved hidden cross-wave dependencies (`W1` SSR `/_actions/*` + `/api/*` auth lockdown & `/bml/*` pairing, `W4` upfront full Law 3/7 `salesBucketing` + `ricochetPayoutParser` port with golden tests before Booth Sync, `W5` explicit sales commit/import routes, and retired legacy bloat).
- **Ordered 1-Wave-At-A-Time `thehc-platform` Prompt Queue ([`docs/prompts/`](docs/prompts/README.md))**: Marked `01-thehc-platform-skills-migration.md` as `✅ Completed in thehc-platform` and added self-contained prompts `W1` through `W6` ahead of Post-Cutover Storefront prompts `02` (`W7`) and `03` (`W8`).

## ✅ `/subsite` SECURITY PATCH & SAFE IN-APP COPY KIT (`alpha-1` — Nov 21, 2026)
- **Zero-PII `/subsite` Server Patch ([`publicStorefrontItem.ts`](src/lib/publicStorefrontItem.ts), [`subsite/index.astro`](src/pages/subsite/index.astro), [`subsite/item/[id].astro`](src/pages/subsite/item/%5Bid%5D.astro))**: Switched public storefront pages to server `node-appwrite` cursor pagination (`Query.limit(100)` + `Query.orderDesc('$id')`) with allowlist sanitization (stripping `cost`, `rawAnalysis`, `purchaseId`, and private fields) and `siteConfig` branding. *(Ready to fast-forward merge `alpha-1` ➔ `main` whenever requested.)*
- **CSV Price Hardening, Whatnot Bulk Export & Depop `3.3%` Fee ([`exportUtils.ts`](src/lib/exportUtils.ts), [`onlineCoCuration.ts`](src/lib/onlineCoCuration.ts), [`salesChannels.ts`](src/lib/salesChannels.ts))**: Replaced regex price stripping with `parsePriceValue()`, added public Storage `PicURL`s in eBay CSV + `generateWhatnotCsv()`, and updated Depop US fee hint from `10%` to `3.3%`.
- **Zero-Injection Cross-List Copy Kit ([`onlineListingPacket.ts`](src/lib/onlineListingPacket.ts), [`ListingQueueActions.vue`](src/components/common/drawer/ListingQueueActions.vue), [`ONLINE_STOREFRONT_AND_CHANNEL_ARCHITECTURE.md`](docs/ONLINE_STOREFRONT_AND_CHANNEL_ARCHITECTURE.md))**: Permanently banned third-party seller-portal bookmarklets and shipped a 100% zero-injection in-app Copy Kit (Poshmark, Depop 3.3%, eBay, Whatnot) + official Seller Hub CSV exports + 1-click **Copy Sidebar Prompt** (human-click Submit guardrail) & **Download Photos** pack inside `ItemOnlineTab.vue` on `alpha-1`.

## ✅ CROSS-OS PORTABILITY, VERCEL MCP & STOREFRONT BLUEPRINT (`alpha-1` — Nov 21, 2026)
- **Cloud-Function-First Blueprint ([`ONLINE_STOREFRONT_AND_CHANNEL_ARCHITECTURE.md`](docs/ONLINE_STOREFRONT_AND_CHANNEL_ARCHITECTURE.md))**: Documented sharded zero-PII public catalog (`<= 54 KB`/page), mandatory event-loop guards (`syncHash`), per-platform outbox dedupe, and official eBay/Whatnot server API lanes for `Wave 7–8` in `thehc-platform`.
- **Cross-OS & Skill Portability ([`.gitattributes`](.gitattributes), [`tsconfig.json`](tsconfig.json), [`validate-templates.mjs`](scripts/validate-templates.mjs), [`.agents/skills/`](.agents/skills/ai-context-sync/SKILL.md))**: Added Windows `<10ms` build guard (`--guard-build`), `forceConsistentCasingInFileNames: true`, LF line-ending rules, and scrubbed all hardcoded Windows drive URIs across `.agents/`.

## ✅ DEPLOYED TO `main`: REACTIVITY, SEARCH & UX/IA UNIFICATION SPRINT (`main` @ `f066ca0` — Nov 21, 2026)
- **Phases 1–4 Live in Production**: Evergreen `gemini-flash-latest` fast-path, reactive `shallowRef` inventory store helpers (`upsertLocalItems`, `patchLocalItems`, `beginInventoryWrite`), unified `/inventory` Table & Card UX/IA, live `/warehouse/sync/MD` `808 / 808` scorecard parity, and `matchesTokenizedFields` search across all ledgers.

## Next Up (In `thehc-platform` IDE Window Only)
1. Optional here in `ResaleCommand`: fast-forward merge `alpha-1` ➔ `main` so live `/subsite` gets the zero-PII patch as the final frozen baseline.
2. Open `thehc-platform` on branch `dev` and run **Wave 1** ([`docs/prompts/W1-thehc-platform-auth-and-shell.md`](docs/prompts/W1-thehc-platform-auth-and-shell.md)), advancing strictly **one wave at a time** through `W6` domain cutover.

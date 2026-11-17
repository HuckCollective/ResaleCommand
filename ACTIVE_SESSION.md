# Active Session Summary (Updated Nov 17, 2026)

> **Historical Sprint Archive:** Completed milestones prior to Nov 17, 2026 (`Headless Flagship CMS`, `Universal Curator & Builder Onboarding`, `SWEAT-` Gate 4B Waterfall, `Auction Sweep v4.5`, and earlier sprints) are preserved verbatim in [`docs/SESSION_ARCHIVE.md`](file:///c:/Users/15034/Projects/ResaleCommand/docs/SESSION_ARCHIVE.md).

## ✅ WAVE 2 (P1) KRUG & LAWS OF UX OVERHAUL: LAW 1/2/4 DE-HARDCODING, JAKOB'S LAW `<SlideOverDrawer>` + `useBodyScrollLock()` UNIFICATION, AND POSTEL'S LAW INPUT LENIENCE (`alpha-1` — Nov 17, 2026)
- **Track 1 — Purge Stale Hardcoded Locations, Fees, Rent & Tenant Maps (Laws 1, 2 & 4)**:
  - Rewired `RolloLabelTestWorkbench.vue` to `getAllLocationSettingMetas()` + `siteConfig.domain` (removing `"Booth #42"`, `'PDX-0441'` ➔ `'PDXGL-0441'`, `'Dusty Tiger Jacket'` ➔ `'Obsidian Wand (DT <8")'`, and `resalecommand.com`).
  - Removed the Law-1-violating `"Add Selling Location / Booth"` drawer in `LocationSyncView.vue` and free-text `"Standard Placed Locations"` list in `OrgSettingsView.vue`.
  - Replaced hardcoded `"15% Venue Fee"` / `$382.50` / `20%` / `$50` fallbacks across `SalesImporter.vue`, `LocationDetailView.vue` (including `getAssetUrl(imageId, { preview: false })` in `handleImageError`), `CoopCharterView.vue`, `CharterPayoutSimulator.vue`, `CoopSettlementView.vue`, `SettingsManager.vue`, and `HaulIngestionWizard.vue`, and removed static `MOCK_TENANTS` / `DB_TENANT_MAP` dictionaries from `src/pages/subsite/index.astro` & `src/pages/subsite/item/[id].astro`.
- **Track 2 — Jakob's Law `<SlideOverDrawer>` + `useBodyScrollLock()` Unification**:
  - Migrated raw `<dialog class="modal">` and custom modal overlays to `<SlideOverDrawer>` (with `Esc`, backdrop click, and ref-counted scroll lock) across `OrgSettingsView.vue`, `PurchaseEditor.vue`, `SpeedEntryForm.vue`, `CoopSettlementView.vue`, `ScoutPurchaseList.vue`, `ScoutPurchaseTray.vue`, `CoopExpensesLedger.vue`, `JoinApplicantDrawer.vue`, `SocialItemPickerModal.vue`, `LocationDetailView.vue`, `SalesImporter.vue`, and `StoreCatalog.vue`.
  - Attached ref-counted `useBodyScrollLock()` across `DashboardCommandDock.vue`, `PurchaseItemsTray.vue` (removing raw `document.body.style.overflow`), `SalesImportTray.vue`, `JoinRequestsPanel.vue`, `ScoutView.vue`, `ScoutPurchaseTray.vue`, `VaultNoteDrawer.vue` (+ `Esc` listener), `CoopExpensesLedger.vue`, `LocationSyncView.vue`, and `SalesImporter.vue`.
- **Track 3 — Postel's Law Input Lenience (`inputmode="decimal"` + Auth Email Normalization) & §19 Guard**:
  - Normalized `email.value.trim().toLowerCase()` + `autocomplete="email" autocapitalize="none"` in `LoginView.vue`, `SignupView.vue`, `ConnectWithUsForm.vue`, `OrgSettingsView.vue`, and `ProfileView.vue` (keeping zero `.trim()` on passwords + `autocomplete="current-password"` / `"new-password"`).
  - Converted `type="number"` scroll-wheel currency, fee, and hours inputs to `type="text" inputmode="decimal"` across 15 components and locked Wave 2 invariants in `scripts/validate-templates.mjs` **§19**.

## ✅ WAVE 1 (P0) KRUG & LAWS OF UX OVERHAUL: TWO-WAY ROLE ISOLATION (`CollectiveAccessGate`), STEWARD-LOCKED VOTING, `$0`-INVENTORY SETTLEMENTS UNBLOCK, ZERO NATIVE BROWSER DIALOGS, AND 2-STAGE `<ItemThumbnail>` FALLBACK (`c49685c` on `alpha-1` — Nov 17, 2026)
- Shipped two-way role isolation (`CollectiveAccessGate.vue`, `serverAuth.ts`, `session.ts`, `memberAccess.ts`, `SalesList.vue`), fixed broken handlers + `/scan` ➔ `/scout` 302 redirect + `StoreHeaderCart.astro`, eliminated native browser `confirm`/`prompt` dialogs, upgraded `<ItemThumbnail>` with 2-stage `/preview` ➔ `/view` + `galleryImageIds` fallback, and added `validate-templates.mjs` **§18**.

- **Next Up**:
  1. Run live DOM QA on `https://alpha.resalecmd.com` for Wave 1 (P0) & Wave 2 (P1) surfaces.
  2. Kick off **Wave 3 (P2)** from [`docs/UX_KRUG_AUDIT_BACKLOG.md`](file:///c:/Users/15034/Projects/ResaleCommand/docs/UX_KRUG_AUDIT_BACKLOG.md) (Hick's Law single-CPA docks & `<= 7` chips, Krug #5 Trunk Test `<h1>` landmarks, and mobile `44px` touch floor + `.skeleton` loaders).
  3. Lock `coopGovernance.ts` (`manifests/coop_governance_proposals_v1`) behind a dedicated server-verified `/api/coop/*` route and wire `https://thehc.llc/#works` to `GET /api/public/flagship-content`.

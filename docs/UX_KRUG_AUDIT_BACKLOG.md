# Resale Command — Living UX & Steve Krug Usability Backlog (`docs/UX_KRUG_AUDIT_BACKLOG.md`)

> **100% Repo-Persisted Across Chats & IDEs (`Antigravity`, `VS Code · Cline`, `Gemini Web`):**
> Generated Nov 17, 2026 via a 100% read-only audit against [`.agents/skills/laws-of-ux/SKILL.md`](../.agents/skills/laws-of-ux/SKILL.md) (**30 Laws of UX + Steve Krug's 6 *Don't Make Me Think* Usability Rules**) and [`.agents/rules/vue-and-style-guardrails.md`](../.agents/rules/vue-and-style-guardrails.md).
> Check off `[x]` items as each wave lands on `alpha-1` / `main`.

---

## 🚀 How to Resume in Any New Chat (Copy-Paste Kickoff)

```text
/plan Read docs/UX_KRUG_AUDIT_BACKLOG.md and .agents/skills/laws-of-ux/SKILL.md, then draft an implementation plan for Wave 1 (P0).
```

*(Swap `Wave 1 (P0)` for `Wave 2 (P1)` or `Wave 3 (P2)` as each wave is completed.)*

---

## ✅ Baseline Already Completed (`5/5` Buckets Passing — Nov 17, 2026)

- [x] **Skill Upgrade:** Steve Krug's 6 *Don't Make Me Think* rules fused into `.agents/skills/laws-of-ux/SKILL.md` (`references/00..05-*.md`), `ux-design-system-taxonomy`, and `vue-and-style-guardrails.md` (`GEMINI.md` = `17,864 B < 20,000 B`).
- [x] **Surface 1 (`ItemDrawer.vue` + `ItemOnlineTab.vue`):** Zero stacked right-edge drawers (`validate-templates.mjs` §16), inline lazy Tab 4 `🌐 Online Bin`, ref-counted `useBodyScrollLock()`, `<ItemThumbnail>` header, single filled CPA.
- [x] **Surface 2 (`BookmarkletRegistryPanel.vue` + `/studios/bookmarklets` + `BmlConnectPopup.vue`):** 100% device-agnostic mobile shortcut copy (zero `"Pixel 8"`), `<details>` `"First-time phone setup"`, 14-day server-secret token signing, iOS Safari / Chrome iOS WebKit ITP same-tab redirect + strict target-host allowlist.
- [x] **Surface 3 (`Navbar.vue` + `studiosCatalog.ts`):** `<= 5` top pillars + `<= 7` dropdown items (`validate-templates.mjs` §17), single `/settings` link, `<SlideOverDrawer>` org/invite sheets, `44px` mobile touch floor.
- [x] **Surface 4 (`/warehouse` `WarehouseManager.vue`):** Honest `Booths & Storage` `<h1>`, `<KpiStatGrid>`, **🏪 Selling Booths** (`MD`, `DT`) vs. **📦 Backstock Storage** (`HG`, `HH`) split, `<SlideOverDrawer>` editor + `confirmDialog`.
- [x] **Surface 5 (`/studios` `StudiosHubView.vue`):** Scannable 4-workbench Billboard hub (`56px` rows, dynamic Ricochet sync href via `warehouses.ts`, single filled CPA).
- [x] **Surface 6 (`/inventory` `InventoryHeader` + `InventorySpatialBar` + `InventoryQueuesTray` + `InventoryValuationStrip`):** Calm 2-row sticky header, Storage vs. Booths bar, collapsible 1-line valuation strip, interactive bottom-sheet `⚡ Queues & Lists` tray, single `activeInventorySurface` lock.

---

## 🚨 Wave 1 (P0) — Role Isolation, Broken Clicks, Native Browser Dialogs & Media Fallbacks

- [ ] **1. Two-Way Role Visibility Isolation (`Consignor` Leaks vs. `Sweat-Only` Lockout):**
  - Gate `src/components/coop/CoopLaborView.vue:2`, `src/components/coop/CoopGovernanceView.vue:2`, `src/components/coop/FounderVaultView.vue:2`, `src/components/settings/SettingsManager.vue:64-75`, and `src/components/social/SocialCrossPostView.vue:2` behind `canSeeCollectiveFinancials` / `!isConsignor` so Straight Consignors (`BB-`) redirect cleanly to `/dashboard` and never see Collective labor, member rosters, or other consignors' contracts.
  - Lock `Voting As` (`src/components/coop/CoopGovernanceView.vue:186-193`) to stewards only.
  - Unblock `$0`-inventory Voting Collective members (`Promoter`, `Enabler`, `Builder`) on `/coop/settlements` (`src/components/sales/SalesList.vue:2`, `src/lib/memberAccess.ts:27-40`) and give `/coop/settlements` an honest `<h1>Monthly Settlements</h1>` Trunk Test header.
- [ ] **2. Broken Runtime Handlers, Orphaned `/scan` Split-Brain & Storefront `/cart` Leak:**
  - Fix undefined `@click="loadLabSnapshot"` ➔ `@click="loadAllLabData(true)"` in `src/components/studios/AppraisalPricingLabView.vue:1515`.
  - 302-redirect orphaned `src/pages/scan.astro:1-19` (`src/components/CameraCapture.astro:751` banned `alert()` + stale `13%` fee) to `/scout`.
  - Fix `src/components/store/StoreHeaderCart.astro:9-39` linking public shoppers to internal `/cart` (`CartView.vue` sourcing tracker) with hardcoded `cartCount = 2` and dead `<a>` links.
- [ ] **3. Eliminate Remaining `window.confirm` / `alert` / `prompt` & Unconfirmed 1-Click Deletions:**
  - Replace native `confirm` / `window.confirm` / `prompt` in `src/components/warehouses/LocationDetailView.vue:1987`, `src/components/coop/FounderVaultView.vue:892`, `src/components/settings/SettingsManager.vue:624`, and `src/components/inventory/CartView.vue:290` with `askConfirm()` / `<SlideOverDrawer>`.
  - Add `askConfirm()` guards before 1-click deletions in `src/components/coop/CoopLaborView.vue:1165`, `src/components/coop/CoopGovernanceView.vue:569,690`, `src/components/settings/SettingsManager.vue:152,224`, and `src/components/org/OrgSettingsView.vue:170`.
- [ ] **4. Standardize `<ItemThumbnail>` (`/preview` ➔ `/view` `@error` Fallback — System Invariant #3):**
  - Replace raw `<img>` tags missing `/view` retry + `galleryImageIds` fallback across `src/components/sales/SalesImporter.vue:764-770,1048-1054,1847-1853`, `src/components/warehouses/LocationSyncView.vue:1001-1006,1128-1133,1623-1628`, `src/components/purchases/PurchaseEditor.vue:609-614,700,720-725`, `src/components/purchases/HaulIngestionWizard.vue:293,522`, `src/components/scout/ScoutPurchaseTray.vue:447`, `src/components/social/SocialItemPickerModal.vue:128-134`, `src/components/sales/LinkTicketInventoryModal.vue:150`, and `src/components/store/StoreCatalog.vue:134-139,268-273`.

---

## 🧱 Wave 2 (P1) — Law 1/2 De-Hardcoding, `<SlideOverDrawer>` Migration & Postel's Law Inputs

- [ ] **1. Purge Stale Hardcoded Locations, Fees, Rent & Tenant Maps (Laws 1, 2 & 4):**
  - Rewire `src/components/labels/RolloLabelTestWorkbench.vue:759-853,1050-1086` to `warehouses.ts` + `siteConfig` (removing `"Booth #42"`, `PDX-0441`, `"Dusty Tiger Jacket"` violating DT's NO Clothes rule, and `resalecommand.com`).
  - Remove Law-1-violating `"Add Selling Location / Booth"` drawer in `src/components/warehouses/LocationSyncView.vue:269-310` and free-text `"Placed Locations"` in `src/components/org/OrgSettingsView.vue:153-182`.
  - Replace hardcoded `"15% Venue Fee"` / `$382.50` / `20%` / `$50` fallbacks in `SalesImporter.vue:322,1214,1295,1383,1405,1587`, `LocationDetailView.vue:1345,1829`, `CoopCharterView.vue:323`, `CharterPayoutSimulator.vue:221`, `CoopSettlementView.vue:1855-1856`, `SettingsManager.vue:538-539`, `HaulIngestionWizard.vue:281-286`, and static `MOCK_TENANTS` / `DB_TENANT_MAP` in `src/pages/subsite/index.astro:19-34` & `src/pages/subsite/item/[id].astro:19-31`.
- [ ] **2. Jakob's Law `<SlideOverDrawer>` + `useBodyScrollLock()` Unification:**
  - Migrate raw `<dialog class="modal">` and custom `<Teleport>` drawers (missing `Esc` or ref-counted scroll lock) in `CoopExpensesLedger.vue:643,766,940,986`, `CoopSettlementView.vue:1028`, `ScoutPurchaseList.vue:235`, `ScoutPurchaseTray.vue:390-588`, `LocationDetailView.vue:1013,1057,1130`, `LocationSyncView.vue:239,1418,1780`, `SalesImporter.vue:1509,1931`, `VaultNoteDrawer.vue:2`, `JoinApplicantDrawer.vue:148`, `PurchaseEditor.vue:922`, `OrgSettingsView.vue:247`, `SocialItemPickerModal.vue:2`, and `StoreCatalog.vue:185,259`.
  - Attach `useBodyScrollLock()` to `DashboardCommandDock.vue:8` (`useDashboardCommandTray.ts`), `PurchaseItemsTray.vue:538` (removing raw `document.body.style.overflow`), `SalesImportTray.vue`, `JoinRequestsPanel.vue:75`, and `ScoutView.vue:97` / `ScoutPurchaseTray.vue:4`.
- [ ] **3. Postel's Law Input Lenience (`inputmode="decimal"` + Auth Email Normalization):**
  - Normalize `email.value.trim().toLowerCase()` + `autocomplete="email" autocapitalize="none"` in `LoginView.vue:111`, `SignupView.vue:179`, `ConnectWithUsForm.vue:56`, `OrgSettingsView.vue:507`, and `ProfileView.vue:93` (keeping zero `.trim()` on passwords + `autocomplete="current-password"` / `"new-password"`).
  - Convert `type="number"` scroll-wheel currency/fee/hours inputs to `type="text" inputmode="decimal"` + `parsePriceValue()` across `PurchaseEditor`, `SpeedEntryForm`, `PurchaseItemsTray`, `HaulIngestionWizard`, `SalesImporter`, `RecordSaleDrawer`, `CoopExpensesLedger`, `CoopSettlementView`, `CoopLaborView`, `CoopGovernanceView`, `SettingsManager`, `ScoutView`, `ScoutPurchaseTray`, `AppraisalPricingLabView`, and `LocationDetailView`.

---

## ✨ Wave 3 (P2) — Mobile `44px` Touch Floor, Single-CPA Docks, Trunk Test `<h1>`s & Goodwill

- [ ] **1. Hick's Law Single-CPA Discipline (`<= 1` Filled Primary CTA) & `<= 7` Inline Chips:**
  - Demote competing filled dock/header buttons in `LocationSyncView.vue:1328-1409` (5 colored buttons), `RicochetLiveSalesPanel.vue:568-603`, `SalesImporter.vue:930,1474-1495`, `PurchaseEditor.vue:1046-1072`, `PurchaseItemsTray.vue:262-281`, `CoopExpensesLedger.vue:16-43`, `ScoutView.vue:1192-1385`, `AiUsageCard.vue:95-117`, `SocialCrossPostView.vue:32,569`, `CoopCharterView.vue:17,72,128,285`, `CoopGovernanceView.vue:68,928`, `FounderVaultView.vue:56,599`, `OrgSettingsView.vue`, and `ProfileView.vue`.
  - Group `8–15` inline filter chips in `RicochetLiveSalesPanel.vue:218`, `CoopExpensesLedger.vue:171`, `ScoutPurchaseList.vue:249`, `SocialCrossPostView.vue:313`, `FounderVaultView.vue:322`, and `StoreCatalog.vue:58`.
- [ ] **2. Krug #5 Trunk Test `<h1>` Landmarks, `.rc-dock-spacer` Cleanup & `/join` Recovery:**
  - Add `<h1>` landmarks on `/login`, `/signup`, `/join`, `/purchases/speed-entry`, `/sales/import/[...location]`, `/scout/trackers`, `/subsite`, and mount `<CoopSubNav>` on `/coop` for signed-in members; add `/studios` breadcrumb on `/labels/studio`.
  - Add 1-click `Sign In` / `Request Fresh Invite` recovery on `src/pages/join.astro:44,80` and replace light-only `bg-gray-50`/`text-gray-900` (`join.astro:6-15`, `LocationSyncView.vue:70`, `ProfileView.vue:30`, `OrgSettingsView.vue:191`) + `data-theme="luxury"` (`/subsite/*`) with `huckleberry` tokens.
  - Remove manual `pb-60`/`pb-44`/`pb-24` padding on `ScoutView.vue:19,127` and `CoopGovernanceView.vue:2`, and promote `SettingsManager.vue:368` Save bar to `<BottomActionDock>`.
- [ ] **3. Mobile `<768px` `44px` Touch Floor (`h-11 md:h-*`), `.skeleton` Loaders & Plain-English Scrub:**
  - Upgrade remaining `<768px` `btn-xs`/`btn-sm` controls to `h-11 md:h-8`, replace bare spinners with `.skeleton` placeholders (`PurchasesList`, `PurchaseEditor`, `SalesList`, `CoopExpensesLedger`, `CoopLaborView`, `FounderVaultView`, `OrgSettingsView`, `ProfileView`, `AppraisalPricingLabView`, `LocationDetailView`), remove fake `subtotal * 4` retail math in `ScoutPurchaseList.vue:204,567`, scrub remaining internal IDs (`items_dev`, `ai_appraisal_rules_v1`, `unlockHistory`, `src/lib/devAiRouting.ts`, `currentTeam.$id`), add `whitespace-nowrap shrink-0` to `.badge` pills, and wrap raw `err.message` toasts in `toUserMessage()`.

---

## 📊 Route-by-Route Baseline Scorecards (14 Untouched Route Groups)

| # | Route Group | Baseline Score | Trunk Test | Primary Files |
| :--- | :--- | :---: | :---: | :--- |
| **A1** | `/dashboard` | `1/5` | `PASS` | `DashboardShell.vue`, `DashboardCommandDock.vue`, `AiUsageCard.vue`, `LaborWeekCard.vue` |
| **A2** | `/purchases/*` | `0/5` | `FAIL` | `PurchasesList.vue`, `PurchaseEditor.vue`, `PurchaseItemsTray.vue`, `SpeedEntryForm.vue`, `HaulIngestionWizard.vue` |
| **A3** | `/sales` & `/sales/import/*` | `0/5` | `WARN` | `SalesList.vue`, `RicochetLiveSalesPanel.vue`, `SalesImporter.vue`, `RecordSaleDrawer.vue`, `SalesImportTray.vue` |
| **A4** | `/expenses` | `0/5` | `PASS` | `CoopExpensesLedger.vue` |
| **A5** | `/scout/*` & `/scan` | `0/5` | `FAIL` | `ScoutView.vue`, `ScoutPurchaseList.vue`, `ScoutPurchaseTray.vue`, `scan.astro`, `CameraCapture.astro` |
| **A6** | `/labels/studio` & `/studios/appraisal` | `0/5` | `WARN` | `RolloLabelTestWorkbench.vue`, `AppraisalPricingLabView.vue` |
| **A7** | `/warehouse/[id]` & `/warehouse/sync/*` | `0/5` | `PASS` | `LocationDetailView.vue`, `LocationSyncView.vue` |
| **B1** | `/social` & `/social/[id]` | `1/5` | `FAIL` | `SocialCrossPostView.vue`, `SocialItemPickerModal.vue`, `SocialHubView.vue` |
| **B2** | `/coop`, `/coop/charter` & `/coop/docs/*` | `1/5` | `FAIL` | `CoopCharterView.vue`, `CharterPayoutSimulator.vue`, `ConnectWithUsForm.vue`, `CoopSubNav.vue` |
| **B3** | `/coop/settlements` & `/coop/labor` | `0/5` | `FAIL` | `CoopSettlementView.vue`, `CoopLaborView.vue`, `CoopSweatEquityDrawer.vue`, `CoopMonthLockBar.vue` |
| **B4** | `/coop/governance`, `/coop/cms` (`4/5`) & `/coop/vault` | `0/5` | `FAIL` | `CoopGovernanceView.vue`, `FounderVaultView.vue`, `VaultNoteDrawer.vue`, `JoinApplicantDrawer.vue` |
| **B5** | `/settings`, `/org/settings` & `/profile` | `0/5` | `FAIL` | `SettingsManager.vue`, `OrgSettingsView.vue`, `ProfileView.vue` |
| **B6** | `/login`, `/signup` & `/join` | `1/5` | `FAIL` | `LoginView.vue`, `SignupView.vue`, `join.astro` |
| **B7** | `/`, `/demo` (`5/5`) & `/subsite/*` | `1/5` | `FAIL` | `index.astro`, `demo.astro`, `subsite/index.astro`, `StoreCatalog.vue`, `StoreHeaderCart.astro` |

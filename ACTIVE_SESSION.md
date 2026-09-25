# Resale Command - Active Session & Continuity State

**Last Updated:** September 23, 2026 (1:17 PM)
**Current Milestone Completed:** Lot Profit Playbook Architecture, Sourcing Guardrail, and Tab 3 ("Playbook") System.

---

## 1. What Was Just Implemented & Delivered

### A. Formalized Agent Skills & Maintainability Standards:
1. **[.agents/skills/lot-profit-and-exit-strategy/SKILL.md](file:///c:/Users/15034/Projects/ResaleCommand/.agents/skills/lot-profit-and-exit-strategy/SKILL.md)**:
   - Full SOP codifying Anchor/Hero singles (recovering 100% of purchase cost on first sale), Themed Combines ($25–$45 target sweet-spot), and Floor Fillers ($10–$15 impulse grab bags for booth grazing).
2. **[.agents/skills/ai-scout-and-deep-scan-validation/SKILL.md](file:///c:/Users/15034/Projects/ResaleCommand/.agents/skills/ai-scout-and-deep-scan-validation/SKILL.md)**:
   - Codified the **Sourcing Lifecycle Guardrail**: Unacquired items (`status !== 'acquired'` / scouting drafts) strictly use Speed Scout AI (`/api/identify-item.ts`) to conserve API tokens and prevent clutter; full AI Deep Scan and the Profit Playbook unlock post-acquisition.
3. **[.agents/skills/resale-merchandising-and-bundling/SKILL.md](file:///c:/Users/15034/Projects/ResaleCommand/.agents/skills/resale-merchandising-and-bundling/SKILL.md)**:
   - Added **Playbook** to the Non-Developer UX Invariants table.

### B. Codebase & UI Implementation:
1. **[src/lib/lot-strategy.ts](file:///c:/Users/15034/Projects/ResaleCommand/src/lib/lot-strategy.ts)**:
   - Deterministic and AI-assisted exit playbook generator that computes hero singles, themed combines, floor fillers, and margin boost percentages.
2. **[src/lib/ai-inspection.ts](file:///c:/Users/15034/Projects/ResaleCommand/src/lib/ai-inspection.ts)**:
   - Added `exit_strategy` schema and multimodal prompt generation to Deep Scan.
3. **[ItemDetailsTab.vue](file:///c:/Users/15034/Projects/ResaleCommand/src/components/common/drawer/ItemDetailsTab.vue)**:
   - Replaced obsolete pre-buy verdict (`BUY_NOW / PASS`) on acquired inventory with the **Exit Playbook Summary Banner** (+margin boost % and 1-click jump to Playbook).
   - Preserved visual condition and grade assessment notes.
4. **[ItemLotTab.vue](file:///c:/Users/15034/Projects/ResaleCommand/src/components/common/drawer/ItemLotTab.vue)**:
   - Added the **🎯 Profit Exit Playbook** card at the top with financial comparisons (`Bulk Liquidation` vs `Sliced Playbook Yield`), hero items, combines, and floor fillers.
   - Added `[Apply in Splitter]` button connecting directly to the Lot Splitter wizard.
   - Added the **`🔒 Original Pre-Buy Sourcing Audit`** locked/collapsible card at the bottom preserving intake verdict, asking price, and max bid limit.
5. **[ItemDrawer.vue](file:///c:/Users/15034/Projects/ResaleCommand/src/components/common/ItemDrawer.vue)**:
   - Renamed Tab 3 to **`Playbook`** (`solar:clipboard-check-bold`).
   - Wired props (`scoutResult`, `scoutPurchaseStrategy`, `isAcquiredItem`).
   - Guarded AI endpoint execution: Unacquired items run Speed Scout, acquired items run Deep Scan.
6. **[ItemDrawerFooter.vue](file:///c:/Users/15034/Projects/ResaleCommand/src/components/common/drawer/ItemDrawerFooter.vue)**:
   - Dynamic button: `⚡ Speed Scout AI` / `⚡ Re-Scout (Fast)` for unacquired items vs `✨ AI Deep Research` for acquired inventory.

---

## 2. Test Candidate: `HUCK-0843`
- URL: `http://localhost:4321/inventory?upc=HUCK-0843`
- Status: Acquired / Received.
- Title: *"Lot Of Mixed Star Wars Action Figures - Yoda, Holiday C-3PO, More"*
- Landed Cost: $25.00
- Exit Playbook:
  - Hero Singles: Holiday C-3PO ($35.00, recoups 100% cost basis) + Yoda ($28.00).
  - Themed Combine: Clone Trooper & Shadow Trooper 2-Pack ($30.00).
  - Booth Grab Bag: Micro-Figures ($15.00).
  - Profit Increase: +50% margin boost over untouched bulk liquidation.

## 3. Bug Diagnosis & Resolution ("it is broken")
- **Root Cause Identified**:
  1. **Missing Deep-Link Listener in Table View**: On desktop, `InventoryViewHub.vue` renders `InventoryTableView.vue` by default. While `InventoryManager.vue` had `checkUrlForDirectItemOpen()`, `InventoryTableView.vue` was completely missing the URL search parameter handler. Navigating directly to `http://localhost:4321/inventory?upc=HUCK-0843` left the drawer closed.
  2. **Missing Drawer Props in Table View**: `InventoryTableView.vue` was not passing `:inventoryItems="inventoryItems"` or `@selectItem="openItem"` to `<ItemDrawer>`, depriving `ItemLotTab` of global inventory context.
  3. **Null-Safety & Currency String Hazards**: `item.cost` or `item.resalePrice` could arrive with `$` signs or non-numeric tokens resulting in `NaN`, and `sibling.$id === item.$id` was vulnerable if `item` was null.
- **Fixes Applied**:
  - Implemented `checkUrlForDirectItemOpen()` and `syncUrlWithDrawer()` in `InventoryTableView.vue`.
  - Added `:inventoryItems="inventoryItems"` and `@selectItem="openItem"` to `<ItemDrawer>` in `InventoryTableView.vue`.
  - Added robust `parseNumeric` helper in `src/lib/lot-strategy.ts` to guarantee clean non-NaN floats.
  - Made number formatting in `ItemLotTab.vue` and `ItemDetailsTab.vue` fully defensive with `Number(... || 0).toFixed()` and `Math.round()`.
  - Added optional chaining `item?.$id` in `ItemLotTab.vue`.
  - Verified with `npm run build` (14.18s, 0 errors).

---

## 4. Real-World Ricochet Batches
- `ricochet_import_clean.csv`: 7 remaining Cyberpunk 2020 items ready for intake.

---

## 5. Companion Bundle Search & AI Seed Matching Fix
- **Issue**: User typed `"gi joe"` into the search box in the **Create Companion Bundle** modal to find companion items for `"Vintage Hasbro G.I Joe..."`, but:
  1. The AI Match button completely ignored the typed query (`workbenchQuery`), only checking the already-selected item's title.
  2. The word filter `w.length > 3` discarded `"gi"` (2 chars) and `"joe"` (3 chars), while keeping `"vintage"`, causing D&D books to match instead.
  3. The manual search used strict `.includes(q)`, failing on punctuation mismatch (`"gi joe"` vs `"G.I. Joe"`).
  4. An empty search result rendered nothing with no feedback.
- **Fix in [BottomActionTray.vue](file:///c:/Users/15034/Projects/ResaleCommand/src/components/inventory/BottomActionTray.vue)**:
  - Added `normalizeSearchText` to normalize `"G.I."` -> `"gi"` and strip punctuation.
  - Added `RESALE_STOP_WORDS` blacklist (`vintage`, `retro`, `rare`, `classic`, `collectible`, etc.) so generic adjectives don't trigger companion matches.
  - Added `DOMAIN_SHORT_TOKENS` whitelist (`gi`, `joe`, `d&d`, `rpg`, `tsr`, `dc`, `tv`) to allow short brand tokens.
  - Wired `workbenchQuery` directly into `runTrayAiMatches` as a +15 score seed boost.
  - Dynamic button label (`Match Seed` vs `AI Matches`) and explicit empty state in the search dropdown.

---

## 6. Canonical List Item Pattern & Tap-to-Edit in Tray Actions
- **Issue**: Combine and Bundle subviews used stripped-down plain text strips (no image thumbnail, no UPC badge, no price, and no way to open the item drawer to view or edit). Furthermore, the 1-item selected footer lacked a direct `Bundle (1)` button.
- **Fix in [BottomActionTray.vue](file:///c:/Users/15034/Projects/ResaleCommand/src/components/inventory/BottomActionTray.vue)**:
  - Upgraded both **Combine** and **Bundle** item lists to the **Canonical List Item Pattern** (`<ItemThumbnail>`, status & UPC badges, retail tag and cost basis, and remove button).
  - Wired `@click="openItemDrawer(item)"` on thumbnails, titles, and added a dedicated pencil edit icon to all tray rows so items can be inspected and edited in the drawer directly from within Combine, Bundle, and Restock subviews.
  - Added a direct **`🎁 Bundle (1)`** button to the 1-item selected merchandising dock.
  - Made Companion Bundle automatically execute companion synergy matching on open when an item is selected.
  - Added typo-tolerance (`git joe` -> `gi joe`) and multi-token matching to the catalog search.

---

## 7. Two-Tier Hybrid Lot Splitter & Inventory Tray Architecture
- **Issue**: Lot Splitter was trapped inside `ItemDrawer.vue` as a nested modal, forcing users to click an item -> open drawer -> navigate to Playbook tab -> click Splitter, creating an anti-pattern of modal-on-drawer stacking. Furthermore, selecting an item in the catalog gave no direct access to split or deconstruct from the action tray.
- **Solution (Two-Tier Hybrid Pattern)**:
  1. **Singleton Composable ([useLotSplitter.ts](file:///c:/Users/15034/Projects/ResaleCommand/src/composables/useLotSplitter.ts))**:
     - Mirrors `useItemDrawer.ts`: provides global reactive `isLotSplitterOpen`, `activeLotItem`, `openLotSplitter(item)`, and `closeLotSplitter()`.
  2. **Root-Level Mounting ([InventoryManager.vue](file:///c:/Users/15034/Projects/ResaleCommand/src/components/inventory/InventoryManager.vue) & [InventoryTableView.vue](file:///c:/Users/15034/Projects/ResaleCommand/src/components/inventory/InventoryTableView.vue))**:
     - Mounted `<LotSplitterWizard>` at the top level alongside `<ItemDrawer>`.
     - Removed nested `<LotSplitterWizard>` from [ItemDrawer.vue](file:///c:/Users/15034/Projects/ResaleCommand/src/components/common/ItemDrawer.vue). When clicking "Splitter" in the drawer, it closes the drawer cleanly and launches the full wizard with zero modal stacking.
  3. **Direct Tray Access & Rich Subview ([BottomActionTray.vue](file:///c:/Users/15034/Projects/ResaleCommand/src/components/inventory/BottomActionTray.vue))**:
     - **4-Action Merchandising Row**: Shows `Restock`, `Combine`, `Bundle (1)`, and `Split Lot (1)` symmetrically when 1 item is selected.
     - **Rich Split Sub-View (`currentSubView === 'split'`)**:
       - Selected item card with canonical list item pattern (`<ItemThumbnail>`, status/UPC badges, cost, tap-to-edit drawer).
       - **Hero Curation CTA**: *"Launch 4-Step Lot Splitter Wizard"* (1-click launch via `openLotSplitter`).
       - **Quick Actions**: *"⚡ Split Off 1 Unit"* (calls `handleDockSplitOneUnit` in `InventoryManager.vue` to create a dedicated child SKU with cloned media in storage) and *"↩️ Rollback / Deconstruct"* (uncombines parent lots).
  4. **Dynamic AI Exit Playbook Pre-Seeding ([LotSplitterWizard.vue](file:///c:/Users/15034/Projects/ResaleCommand/src/components/inventory/LotSplitterWizard.vue) & [ItemLotTab.vue](file:///c:/Users/15034/Projects/ResaleCommand/src/components/common/drawer/ItemLotTab.vue))**:
     - `ItemLotTab.vue` passes `{ exitPlaybook }` when emitting `open-splitter`.
     - `LotSplitterWizard.vue` automatically pre-configures custom tiers (`🌟 Hero Singles`, `🎁 Themed Combine`, `⚡ Floor Fillers`) directly from the AI Exit Playbook strategy.

---

## 8. In-Tray Embedded Lot Splitter (Zero Modal Dialogs) & Template End-Tag Fix
- **Root Causes Identified**:
  1. **Duplicate Declaration**: In [LotSplitterWizard.vue](file:///c:/Users/15034/Projects/ResaleCommand/src/components/inventory/LotSplitterWizard.vue), `function closeWizard()` was declared twice (lines 607 and 914), triggering `[vue/compiler-sfc] Identifier 'closeWizard' has already been declared`.
  2. **End Tag Error**: In [LotSplitterWizard.vue](file:///c:/Users/15034/Projects/ResaleCommand/src/components/inventory/LotSplitterWizard.vue), an extra trailing `</div>` was left at the end of `<template>` after removing the outer `<dialog>` markup, causing the Vue SFC compiler to throw an end-tag mismatch error.
  3. **Script Ordering / TDZ**: In [BottomActionTray.vue](file:///c:/Users/15034/Projects/ResaleCommand/src/components/inventory/BottomActionTray.vue), `handleLaunchLotSplitter` and `closeTray` referenced `props` and `emit` prior to their `defineProps` and `defineEmits` declarations.
- **Fixes Applied**:
  - Removed duplicate `closeWizard()` in [LotSplitterWizard.vue](file:///c:/Users/15034/Projects/ResaleCommand/src/components/inventory/LotSplitterWizard.vue).
  - Removed extra `</div>` at the end of `<template>` in [LotSplitterWizard.vue](file:///c:/Users/15034/Projects/ResaleCommand/src/components/inventory/LotSplitterWizard.vue).
  - Hoisted `defineProps` and `defineEmits` to the top of `<script setup>` in [BottomActionTray.vue](file:///c:/Users/15034/Projects/ResaleCommand/src/components/inventory/BottomActionTray.vue).
  - Directly embedded `<LotSplitterWizard>` into `currentSubView === 'split'` inside [BottomActionTray.vue](file:///c:/Users/15034/Projects/ResaleCommand/src/components/inventory/BottomActionTray.vue) and configured dynamic tray expansion (`max-w-4xl h-[90vh] sm:h-[780px]`).
  - Removed redundant root `<LotSplitterWizard>` instances from [InventoryManager.vue](file:///c:/Users/15034/Projects/ResaleCommand/src/components/inventory/InventoryManager.vue) and [InventoryTableView.vue](file:///c:/Users/15034/Projects/ResaleCommand/src/components/inventory/InventoryTableView.vue), wiring drawer `@open-splitter` directly to `dockRef.openSplit(target)`.

---


## 9. Location Niches, Exclusion Rules & Watch Tags (Booth Routing)
- **Features Implemented**:
  1. **Exclusion Rules & Presets**: In [WarehouseManager.vue](file:///c:/Users/15034/Projects/ResaleCommand/src/components/warehouses/WarehouseManager.vue) and [LocationDetailView.vue](file:///c:/Users/15034/Projects/ResaleCommand/src/components/warehouses/LocationDetailView.vue), added one-click quick rule buttons (`⛔ NO Clothes`, `⛔ NO Large Toys`, `📏 Under 8" Only`, `⛔ NO Bulky Playsets`).
  2. **Tags & Brands to Watch**: Built chip-tag editor with add/remove chips and quick suggestions (`Small Collectibles`, `Vintage Jewelry`, `Enamel Pins`, `Pocket Knives`, `Sterling 925`, `Star Trek`, `Miniatures`, `Trading Cards`, etc.).
  3. **Metadata Serialization**: Parsed and serialized smoothly via `\nWatch Tags: ...` into `warehouse.categories` for backward-compatible storage.
  4. **AI Scout Integration ([identify-item.ts](file:///c:/Users/15034/Projects/ResaleCommand/src/pages/api/identify-item.ts))**:
     - Auto-loads organization warehouse documents with niches & watch tags.
     - Enforces strict negative exclusions: never assigns clothes or bulky playsets to compact collectible booths (DustyTiger); correctly routes apparel to Memory Den / Poshmark and jewelry/small collectibles to DustyTiger.

---

## 10. AI Scout UI Integration & Sticky URL Bugfix ([ScoutView.vue](file:///c:/Users/15034/Projects/ResaleCommand/src/components/scout/ScoutView.vue))
- **Features Implemented & Fixed**:
  1. **Recommended Sales Channel & Booth Banner**: Added the dedicated channel banner (`solar:shop-2-bold`) displaying `best_platform`, `platform_rationale`, sell-through velocity, and channel comparisons/trade-offs in the scouting report.
  2. **Active Locations Delivery**: Injected `warehousesApi.listWarehouses()` so `availableWarehouses` (with custom rules and watch tags) are passed directly to `/api/identify-item` across both link and photo/notes scouting.
  3. **Sticky URL Hijack Bugfix**: Refactored `handleAnalyze` so an old `sourcingLocation` URL never overrides newly entered item notes or photos.
  4. **Verified Live**: Successfully tested and verified apparel routing and exclusion rules in browser.

---

## Current Status & Next Steps
- **Build Status**: Verified clean build (`npm run build` exited with code 0).
- **Session State**: All changes tested, verified, and ready to push to remote.

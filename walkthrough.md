# Walkthrough: Tabbed Bottom Command Tray & UX Design System Architecture

We have codified the **UX Design System Taxonomy** and delivered the **Tabbed Bottom Command Tray Pattern** across Resale Command, completely resolving the horizontal clipping on mobile bulk actions and elevating the interaction design to professional HCI standards (Apple HIG, Google Material Design 3, Nielsen Norman Group).

---

## 1. Canonical UX Terminology & Design System Codification

We established a permanent, formal skill at [.agents/skills/ux-design-system-taxonomy/SKILL.md](file:///c:/Users/15034/Projects/ResaleCommand/.agents/skills/ux-design-system-taxonomy/SKILL.md) and expanded [.agents/skills/mobile-ux-standards/SKILL.md](file:///c:/Users/15034/Projects/ResaleCommand/.agents/skills/mobile-ux-standards/SKILL.md).

### The 4 View Archetypes of Resale Command:
1. **Catalog Archetype** (`/inventory`, `/warehouse`): Browse, multi-attribute filter, and batch-manage active floor and online stock.
2. **Prep & Merchandising Archetype** (`/purchases/ingest`, Lot Split & Combine Tools): The "Prepare for Sale" phase—lot splitting, bundling, combining, AI tagging, and channel allocation.
3. **Ledger Archetype** (`/sales`, `/purchases`): Financial records, platform commissions, net payouts, P&L.
4. **Terminal Archetype** (`/scout`, `/scan`): High-speed, focused single-task execution (camera receipt scanning, barcode HUD).

---

## 2. Key Achievements in the Command Dock & Interactive Tray

### A. The Floating Command Dock (Resting Capsule)
- Suspended in the bottom 60px thumb zone with glassmorphism (`backdrop-blur-2xl`, luminous border, ambient shadow).
- **Left Group (Telemetry & Navigation)**: Scroll-to-top (`↑`), Previous (`<`), Tactile Page Indicator (`1 / 38`), Next (`>`), Page Size selector (`48/pg ▾`).
- **Right Group (Action Tabs)**:
  - **`[ ⚙ Filters (N) ]`**: Opens the Filters sheet.
  - **`[ ⚡ N Sel Actions ▾ ]`**: Replaces `+ Add` dynamically when items are checked/selected.
  - **`[ + Add ]`**: Contextual Primary Action when no items are selected.
- **Zero Horizontal Clipping**: Fits within 375px–412px viewports without horizontal scrolling or truncation.

### B. The Interactive Bottom Sheet (Expanded Tray)
- **Physics & Motion**: Deceleration spring curve (`cubic-bezier(0.16, 1, 0.3, 1)` over 300ms) with backdrop scrim blur (`bg-black/60 backdrop-blur-xs`).
- **Top Affordance**: Centered rounded drag handle pill.
- **Sticky Tab Bar (Top)**: Pinned at top of sheet allowing instant switching between `Filters`, `Actions & Prep`, and `+ Add` directly inside the tray, plus a quick `✕` close button.
- **Pane 1 (Filters)**: All filter accordions (Status Pipeline, Locations & Channels, Exclusions, AI Insights, Barcodes) with sticky `Reset All` and `Show N Items` footer.
- **Pane 2 (Prep & Actions)**: Full-width, comfortable inputs ($\ge 44\text{px}$ touch targets):
  - **Move Location**: Full-width selector + `Apply` button.
  - **Update Status**: Full-width selector + `Apply` button.
  - **Prep for Sale Tools**: `Bundle` and `Combine Lot`.
  - **Export Channels**: 2x2 grid of channel buttons (`Memory Den`, `eBay Hub`, `Poshmark`, `Generic CSV`).
  - **Sticky Footer**: `Clear Selection` + `Done`.

---

## 3. Visual Verification (Google Pixel 8: 412 × 915)

### 1. Resting Command Dock (Cards View)
The floating capsule sits comfortably at the bottom with zero text wrapping or clipping:
![Resting Command Dock](file:///C:/Users/15034/.gemini/antigravity-ide/brain/18ee255e-a2af-442a-b43a-0d37ad95176e/resting_command_dock_1789066500253.png)

---

### 2. Selected Item State & Dynamic Dock Morphing
Selecting an item causes `+ Add` to morph into `[ ⚡ 1 Sel ]`:
![Selected Item in Command Dock](file:///C:/Users/15034/.gemini/antigravity-ide/brain/18ee255e-a2af-442a-b43a-0d37ad95176e/selected_command_dock_1789066562614.png)

---

### 3. Open Actions & Prep for Sale Tray
Spacious, unclipped layout for location moves, pipeline status, bundling, and channel exports:
![Open Actions & Prep Tray](file:///C:/Users/15034/.gemini/antigravity-ide/brain/18ee255e-a2af-442a-b43a-0d37ad95176e/open_actions_prep_tray_1789066636729.png)

---

### 4. Open Filters Tray
Sticky header with tabs, collapsible accordions, and sticky `Show Items` footer:
![Open Filters Tray](file:///C:/Users/15034/.gemini/antigravity-ide/brain/18ee255e-a2af-442a-b43a-0d37ad95176e/open_filters_tray_1789066541842.png)

---

### 5. Table (Spreadsheet) View Integration
The exact same Command Dock is fully mounted and functional in Table View:
![Table View Command Dock](file:///C:/Users/15034/.gemini/antigravity-ide/brain/18ee255e-a2af-442a-b43a-0d37ad95176e/table_view_command_dock_1789066671120.png)

---

## 4. Drop Tray Menu Auto-Fit Width & Badge Integrity
- **Problem**: In [LocationManifestTray.vue](file:///c:/Users/15034/Projects/ResaleCommand/src/components/inventory/LocationManifestTray.vue), the `Drops (N)` popup menu had a hardcoded `w-64` (256px), which caused longer manifest titles (`Memory Den Drop 2- Sep 18, 2026`) to push the `[draft]` badge out of the container bounds.
- **Solution**:
  1. Replaced `w-64` with `w-max min-w-[280px] max-w-[calc(100vw-2rem)] sm:max-w-md`, enabling the container to dynamically auto-fit width to the content while respecting mobile viewport constraints.
  2. Applied `flex-1 min-w-0 font-medium` to the manifest title, ensuring graceful text truncation (`...`) if the title ever exceeds the maximum width.
  3. Added `shrink-0` to the badge element to guarantee that status pills are never squished or forced outside the card boundaries.

---

## 5. Selection & Drop Manifest Auto-Staging Fix
- **Problem**: Selecting an item (e.g. `HUCK-2404`) did not add it to the bottom selection bar or stage it into the active Drop manifest.
- **Root Cause**:
  1. `nextTick` was missing from the `import { ... } from 'vue'` import in [InventoryManager.vue](file:///c:/Users/15034/Projects/ResaleCommand/src/components/inventory/InventoryManager.vue), causing an unhandled `ReferenceError` during initial manifest load. This permanently left `isInternalSync` set to `true`, causing `watch(selectedItems)` to immediately abort before staging items.
  2. In horizontal card mode, [ItemCard.vue](file:///c:/Users/15034/Projects/ResaleCommand/src/components/common/ItemCard.vue) lacked the `#absolute-top-left` slot for the checkbox.
- **Fix Applied**:
  1. Imported `nextTick` in `InventoryManager.vue`.
  2. Wrapped all `isInternalSync` operations in `try ... finally { isInternalSync = false; }` across both `InventoryManager.vue` and `InventoryTableView.vue`.
  3. Supported the `#absolute-top-left` slot inside horizontal card thumbnails so checkboxes render and receive taps consistently across both horizontal and vertical modes.


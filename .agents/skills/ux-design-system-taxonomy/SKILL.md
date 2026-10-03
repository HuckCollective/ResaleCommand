---
name: ux-design-system-taxonomy
description: Canonical UX/UI patterns, design system taxonomy, reusable UI primitive catalog (BottomActionDock, ItemDrawer, ScannerWidget, PhotoGalleryManager, etc.), and view archetypes for Resale Command. Use this skill whenever designing, building, or refactoring UI components, pages, docks, modals, or trays to identify and reuse existing patterns.
---

# Resale Command UX Taxonomy & UI Pattern Architecture

This standard codifies the human-centered design language, interaction patterns, view archetypes, and reusable component catalog for Resale Command. **Before building or refactoring any interface**, consult this catalog to reuse existing pattern primitives rather than inventing one-off UI.

---

## 1. Canonical UI Pattern Catalog & Opportunity Radar

Whenever you are about to create or modify UI, consult this decision matrix:

| If You Need To... | Reusable UI Pattern Primitive | Implementation / Component | Key Capability |
| :--- | :--- | :--- | :--- |
| **Pin action buttons or telemetry** to page, modal, drawer, or tray | **Contextual Command Dock** | [`BottomActionDock.vue`](file:///c:/Users/15034/Projects/ResaleCommand/src/components/common/BottomActionDock.vue) | Glassmorphic surface, iOS safe-area, auto-teleport or sticky placement (`placement="viewport"` vs `"container"`). |
| **Inspect or edit full item details** without leaving the view | **Slide-Over Item Drawer** | [`ItemDrawer.vue`](file:///c:/Users/15034/Projects/ResaleCommand/src/components/common/ItemDrawer.vue) | Standard 400px side panel, photos, pricing, venue sync, Rollo barcode printing. |
| **Capture photos via live webcam / mobile camera** | **Camera Viewfinder HUD** | [`ScannerWidget.vue`](file:///c:/Users/15034/Projects/ResaleCommand/src/components/common/ScannerWidget.vue) | Zero-blackout WebRTC lifecycle, camera flip, multi-shot gallery buffering. |
| **Upload, reorder, preview, and delete photos** | **Photo Gallery Manager** | [`PhotoGalleryManager.vue`](file:///c:/Users/15034/Projects/ResaleCommand/src/components/common/PhotoGalleryManager.vue) | Drag-drop upload, thumbnail strip, primary photo selection. |
| **Display an inventory SKU card in grids or lists** | **Item Card / Thumbnail** | [`ItemCard.vue`](file:///c:/Users/15034/Projects/ResaleCommand/src/components/common/ItemCard.vue) / [`ItemThumbnail.vue`](file:///c:/Users/15034/Projects/ResaleCommand/src/components/common/ItemThumbnail.vue) | Standard resale badges, status color coding, venue location badge. |
| **Select single or multiple categories/bins** | **Filter Dropdowns** | [`SingleSelectDropdown.vue`](file:///c:/Users/15034/Projects/ResaleCommand/src/components/common/SingleSelectDropdown.vue) / [`MultiSelectDropdown.vue`](file:///c:/Users/15034/Projects/ResaleCommand/src/components/common/MultiSelectDropdown.vue) | DaisyUI dropdown shell, search filter inside dropdown, keyboard accessible. |
| **Add and remove tags or keywords** | **Tag Input Pill Group** | [`TagInput.vue`](file:///c:/Users/15034/Projects/ResaleCommand/src/components/common/TagInput.vue) | Chip tags with auto-suggest, Enter/Comma creation, delete chip buttons. |
| **Paginate through large database tables** | **Pagination Dock** | [`PaginationDock.vue`](file:///c:/Users/15034/Projects/ResaleCommand/src/components/common/PaginationDock.vue) | Numeric jump pill, First/Prev/Next/Last controls, rows-per-page selector. |
| **Slide up deep filters or batch operations** | **Interactive Bottom Sheet / Detent Tray** | [`DropcastStagingTray.vue`](file:///c:/Users/15034/Projects/ResaleCommand/src/components/social/DropcastStagingTray.vue) pattern | Rounded-t-3xl card, drag pill, sticky header tabs, sticky dock footer. |
| **Full-bleed visual editing or media previews** | **Fullscreen Studio Workspace** | `SlideImageEditorModal.vue` pattern | Header filmstrip toolbar, centered preview canvas, sticky `BottomActionDock`. |

### ⚠️ Opportunity Radar (Code Smell Detection):
Watch out for these red flags in existing or new code, and refactor them to use the catalog:
1. **Red Flag: Writing `fixed bottom-0 inset-x-0` manually**
   👉 *Refactor To*: `<BottomActionDock placement="viewport">`.
2. **Red Flag: Writing an action button bar at the bottom of a modal or drawer**
   👉 *Refactor To*: `<BottomActionDock placement="container">`.
3. **Red Flag: Writing a `<video ref="...">` camera loop**
   👉 *Refactor To*: `<ScannerWidget>`.
4. **Red Flag: Astro page with a dock showing a footer gap**
   👉 *Fix*: Add `hideFooter={true}` to `<Layout>` and `pb-36 sm:pb-44` to the content container.

---

## 2. Canonical UX Terminology vs. Implementation Jargon

To ensure design-led, maintainable systems, use formal UX/HCI terms rather than raw implementation language:

| Engineering Jargon | Canonical UX Term | Interaction Definition |
| :--- | :--- | :--- |
| *Component* | **UX Interaction Pattern** (or **Pattern Primitive**) | A reusable behavioral archetype solving a specific user task across multiple screens. |
| *Page Tool Dock* | **Contextual Command Dock** | A persistent, thumb-anchored floating bar providing telemetry, navigation, and trigger tabs. |
| *Drawer / Tray* | **Interactive Bottom Sheet** (or **Detent Tray**) | A vertically expandable surface revealing deep controls (Filters, Batch Ops) without losing page context. |
| *Page / Screen* | **View Archetype** | A standardized UI paradigm governed by a specific behavioral contract. |
| *Add Button* | **Contextual Primary Action (CPA)** | The single highest-value affirmative action for the active view, which adapts or hides per archetype. |
| *Props / State* | **Behavioral Contract** | The rules governing how a pattern responds to user input, selection counts, and screen density. |

---

## 2. The 4 Canonical View Archetypes

Every interface in Resale Command belongs to one of four distinct View Archetypes:

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                           THE RESALE COMMAND LIFECYCLE                            │
│                                                                                   │
│  [1. Sourcing] ──> [2. Receiving] ──> [3. Prep & Merch] ──> [4. Catalog] ──> [5. Sales] │
│      Terminal          In-Transit        Prep Archetype       Catalog       Ledger│
└───────────────────────────────────────────────────────────────────────────────────┘
```

### Archetype 1: Catalog Archetype (`/inventory`, `/warehouse`)
- **User Goal**: Manage, filter, organize, and batch-update active, ready-to-sell stock across bins, booths, and channels.
- **Dominant Patterns**:
  - Top Omnibox Search + Horizontal Status Pipeline Pills.
  - View Switcher (`Table` spreadsheet vs. `Cards` visual feed).
  - **Contextual Command Dock** with `[ ⚙ Filters ]`, `[ ⚡ Actions ]` (when selected), and `[ + Add ]` CPA.

### Archetype 2: Prep & Merchandising Archetype (`/purchases/ingest`, Lot Split & Combine Tools)
- **User Goal**: Transform raw sourced hauls and unboxed auction orders into sellable units.
- **Core Operations**:
  - **Lot Splitting**: Deconstructing bulk auction lots into individual grail SKUs vs. common bundles.
  - **Bundling & Combining**: Merging accessories or comic runs into single sellable master lots.
  - **Pricing & Thermal Tagging**: Rollo barcode labels for DustyTiger, Ricochet tags for Memory Den.
  - **Channel Allocation**: Routing items to booth shelves, backstock totes, or eBay drafts.
- **Dominant Patterns**: Step-by-step Merchandising Workspace + Interactive Bottom Tray.

### Archetype 3: Ledger Archetype (`/sales`, `/purchases`)
- **User Goal**: Review financial health, gross sales vs. net payouts, booth commissions, and landed shipping allocations.
- **Dominant Patterns**:
  - Summary KPI Metrics Cards (Gross, Net, Fees, Items Sold).
  - Date & Platform Omnibox Filter.
  - Command Dock with `[ ⟳ Sync POS ]` or `[ 📥 Export CSV ]`; **removes/omits** creation CPA on read-only feeds.

### Archetype 4: Terminal Archetype (`/scout`, `/scan`, POS Terminal)
- **User Goal**: High-speed, focused single-task execution (live camera receipt OCR, real-time barcode lookup, quick checkout).
- **Dominant Patterns**:
  - Fullscreen Camera HUD / Viewfinder.
  - Minimalist floating speed pill (`[ 📷 Scan ]`, `[ ⚡ Checkout ]`).

---

## 3. The Contextual Command Dock & Tray Pattern

### A. Closed State: The Command Dock
A sleek, floating glassmorphic capsule anchored in the bottom 60px thumb zone:
- **Styling**: `bg-base-100/90 dark:bg-base-200/90 backdrop-blur-2xl border border-base-content/15 shadow-[0_-8px_30px_rgba(0,0,0,0.15)] rounded-2xl sm:rounded-full`.
- **Navigation Group (Left)**: Scroll-to-top (`↑`), Previous (`<`), Tactile Page Indicator (`1 / 38`), Next (`>`), Page Size (`48/pg ▾`).
- **Interactive Action Tabs (Right)**:
  - `[ ⚙ Filters (N) ]`: Displays live active filter counter.
  - `[ ⚡ N Actions ]` / `[ ✓ N Selected ]`: Appears dynamically when items are selected.
  - `[ + Add ]`: Contextual Primary Action when `selectedCount === 0`.

### B. Expanded State: The Interactive Bottom Sheet
Tapping any tab triggers a smooth upward expansion:
- **Motion Curve**: Deceleration spring `cubic-bezier(0.16, 1, 0.3, 1)` over 300ms.
- **Scrim Backdrop**: `bg-black/50 backdrop-blur-xs` with tap-outside dismiss.
- **Drag Handle**: Centered pill affordance (`w-12 h-1.5 rounded-full bg-base-content/25`).
- **Sticky Tab Bar (Top)**: Pinned at top of sheet with tabs and `[ ✕ ]` close button.
- **Spacious Content Body**: Full-width inputs ($\ge 44\text{px}$ touch targets), zero horizontal clipping on 375px–412px viewports.
### C. Reusable Implementation Primitive: `BottomActionDock.vue`
To ensure all pages implement this pattern identically with zero layout collisions or ancestor overflow traps:
- **Canonical Component**: [`BottomActionDock.vue`](file:///c:/Users/15034/Projects/ResaleCommand/src/components/common/BottomActionDock.vue) (`src/components/common/BottomActionDock.vue`)
- **Built-in Capabilities**:
  1. **Direct Root Teleportation**: Wraps in `<Teleport to="body">` (immune to nested page margins, transforms, or overflow constraints).
  2. **Canonical Styling**: `fixed bottom-0 inset-x-0 z-40 bg-base-100/95 dark:bg-base-200/95 backdrop-blur-2xl border-t border-base-300 shadow-[0_-4px_25px_rgba(0,0,0,0.18)] select-none pointer-events-auto flex flex-col pb-[env(safe-area-inset-bottom,0px)]`.
  3. **Safe-Area Inset Handling**: Automatically incorporates iOS home-indicator clearances via `env(safe-area-inset-bottom)`.
  4. **Semantic Slot Contract**:
     - `#top`: Optional slim telemetry or status bar (e.g. Manifest status, active Buy tracker, or bulk selection counter).
     - `#left`: View telemetry, icon, title, item counts, or retail values.
     - `#center`: Optional paginator pill or segmented view switcher.
     - `#right`: Action buttons dock (CPA, AI tools, export, save) with horizontal scroll protection.
     - `#default`: Unconstrained custom layout when custom row structures are needed.
- **Page Layout Invariant**: Any Astro page using a bottom action dock MUST:
  1. Pass `hideFooter={true}` to `<Layout>` so the static footer does not render.
  2. Add bottom padding clearance to its content container (`pb-36 sm:pb-44`) so scrolled items are never obscured.

---

## 4. The Bottom Action Tray & Command Dock Pattern

A standardized two-tier mobile-first interaction pattern synthesizing the Scout Purchase Tray and Catalog Inventory Dock:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [↑]  [< Prev]              [ Page 1 / 38 ]             [Next >]   [48/pg ▾] │  <-- Tier 1: Pager Bar
├─────────────────────────────────────────────────────────────────────────────┤
│     [ ⚙ Filters (N) ]        [ ⚡ Actions (N) ]        [ ✦ Add & Prep ]     │  <-- Tier 2: Action Tabs (Thumb Zone)
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            ▼                         ▼                         ▼
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│     FILTERS TRAY      │ │   BULK ACTIONS TRAY   │ │    ADD & PREP TRAY    │
│ • Status Pipeline     │ │ • Move Location       │ │ ⚡ Scout Quick Add    │
│ • Locations & Channel │ │ • Update Status       │ │    (/scout?quick=true)│
│ • Exclusions          │ │ • Export Channels     │ │ ➕ Add Item (Drawer)  │
│ • AI Insights         │ │   (Ricochet, eBay,    │ │    (opens ItemDrawer) │
│ • [Reset] [Show N]    │ │    Poshmark, CSV)     │ │ 📦 Combine Lots       │
│                       │ │ • [Clear Selection]   │ │ 🎁 Bundle into Lot    │
└───────────────────────┘ └───────────────────────┘ └───────────────────────┘
```

### Anatomical Rules:
1. **Tier 1 (Top): Status / Telemetry Strip**:
   - In Catalog views: Pager navigation bar (Scroll-to-top `↑`, First/Previous, `Page 1 / 38`, Next/Last, Page Size selector).
   - In Terminal / Scout views: Active or Paused Buy Tracker telemetry strip (`[ 🚚 Goodwill 3 items $37.00 ] [ MANIFEST ⌃ ]`).
2. **Tier 2 (Bottom): Action Buttons Strip (Thumb Zone)**:
   - Built on the semantic **DaisyUI `.dock.dock-sm`** component inside a fixed glassmorphic container (`fixed bottom-0 inset-x-0 z-40 bg-base-100/95 dark:bg-base-200/95 backdrop-blur-2xl border-t border-base-300 pb-[env(safe-area-inset-bottom,0px)]`).
   - Center action is the **Contextual Primary Action (CPA)**, styled as a **solid elevated tactile pill**:
     - *Identify / Create*: `bg-primary text-primary-content font-black shadow-md border border-primary-content/25 active:scale-95 hover:brightness-110`.
     - *Re-Identify / Attention*: `bg-warning text-warning-content font-black shadow-md border border-warning-content/25 active:scale-95 hover:brightness-110`.
     - *Add / Commit*: `bg-success text-success-content font-black shadow-md border border-success-content/25 active:scale-95 hover:brightness-110`.
     - *Disabled State*: `bg-base-300/40 text-base-content/30 border border-base-content/10 cursor-not-allowed shadow-none`.
   - Never use transparent text or duotone icons with 40% opacity for CTAs, which wash out in light mode. Always use solid bold icons (`solar:*-bold`).
3. **Bottom Action Tray (Slide-up Drawer)**:
   - Follows Scout's detent drawer pattern with backdrop blur (`bg-black/60 backdrop-blur-xs`), rounded top (`rounded-t-3xl`), drag handle, segmented top tab switcher, and symmetrical footer buttons.

---

## 5. Contextual Primary Action (CPA) Behavioral Contract

1. **Hierarchy**: A view must feature at most **one** Contextual Primary Action in the dock.
2. **Dynamic Morphing**: When items are checked/selected in a Catalog view, the CPA (`+ Add`) smoothly yields to the **Contextual Batch Action** (`⚡ N Actions`), focusing user intent on resolving the selection.
3. **Graceful Degradation**: If a view is read-only (e.g. historical sales report), the creation action must be cleanly removed, leaving navigation and filters perfectly balanced.

---

## 6. Outbound Manifest Tray & Staging Interaction Contract

The **Outbound Manifest Tray** governs the preparation, export, and in-store verification of inventory moving to physical booths or online channels. All implementations must adhere to these five architectural rules:

1. **Single Source of Truth (Zero Modal Duplication)**:
   - The Manifest Tray is the **sole interactive surface** for Staging, Reviewing, Exporting, and Verifying.
   - **Anti-Pattern**: NEVER pop up an auxiliary modal window (e.g. a "Verify Stock Checklist modal") on top of or alongside the Tray. The Tray itself contains the checklist, checkboxes, thumbnails, and placement actions.
2. **Pause = Clean Hide (Clutter-Free Workspace)**:
   - When a user pauses an active manifest, the app updates its status in Appwrite and **completely hides the Tray and the bottom floating tracker bar from the viewport**.
   - Resuming is cleanly initiated from the **Locations Hub** (`/warehouse`), the booth cockpit (`/warehouse/:code`), or a subtle nav indicator.
3. **Upfront Destination Context**:
   - Creating a manifest mandates selecting the target destination up front (e.g., *Memory Den [Ricochet POS]*, *Dusty Tiger [Manual Tagging]*, *Online [Warehouse Backstock]*).
   - This selection dynamically adapts the Tray's action buttons (CSV export vs. Tagging sheet vs. Bin assignment).
4. **Main Catalog Staging Telemetry**:
   - Items included in an active or paused draft manifest MUST render an unmistakable visual pill in the main Inventory catalog table (e.g., `📦 Staged: Memory Den`).
   - This prevents accidental double-staging, duplicate exports, or confusion over unplaced items.
5. **The In-Store "Sticker & Shelf" Mobile Pattern**:
   - At physical booths, the user holds physical items in one hand and printed thermal barcode stickers in the other.
   - The mobile Tray must render **large, high-contrast UPC/SKU barcodes and prices** next to the image thumbnail for rapid 1-to-1 visual matching.
   - Each row supports one-tap verification checkoff.
   - Tapping an item's edit button immediately slides open the **ItemDrawer** for on-the-fly price reductions or condition adjustments without losing verify-stock progress.

---

## 7. Canonical Photo Intake Pattern (`PhotoGalleryManager.vue`)

All photo capture, image ingestion, and gallery curation across Resale Command must use the single canonical component: `src/components/common/PhotoGalleryManager.vue`.

### A. Two Image Paradigms in Resale Command
Across the entire application, there are strictly two types of visual assets:
1. **Item Images**: Photos tied directly to an inventory SKU / product listing. Managed via `ItemDrawer.vue` (which embeds `PhotoGalleryManager.vue`) or quick-attached by dropping onto an item card.
2. **User-Provided (Booth / Context / Vibe) Images**: Real photos of booth shelving, store displays, aisle signage, or haul unboxing. Managed directly via `PhotoGalleryManager.vue` at the view's top intake shelf.

### B. Strict Anti-Pattern: Zero Ad-Hoc Photo Rails & Zero Fragmented Buttons
* **FORBIDDEN**: NEVER create custom, ad-hoc photo rails or split image ingestion across multiple disjointed buttons (e.g. having `[Snap Booth Photo]` next to `[Upload Real Booth Photo]` next to a custom card `[+ Snap Photo]`).
* **MANDATORY**: Always embed `<PhotoGalleryManager>`. It encapsulates all upload, camera, drag-drop, cover-starring, thumbnail reordering, and full-resolution lightbox viewing into a single cohesive, accessible widget.

### C. Anatomical States:
1. **Empty State (`totalCount === 0`)**:
   - Large tactile dashed dropzone (`border-2 border-dashed border-base-300`).
   - Primary icon + title: *"Tap to upload or drag photos here"*.
   - Contextual subtitle (`dropzone-subtitle` prop).
   - Full-width prominent Contextual Action Button: `[ 📷 Add Photo with Camera ]` ($\ge 48\text{px}$ touch target) wired to `ScannerWidget.vue`.
2. **Populated State (`totalCount > 0`)**:
   - **Hero Main Cover Photo Card**: Large top preview featuring the `⭐ Main Cover Photo` badge, full-resolution zoom lightbox trigger (`[ 🔍 ]`), and delete button (`[ 🗑 ]`).
   - **Supporting Photos Grid**: Zero-side-scroll, responsive wrapping thumbnail grid with index pills, tap-to-set-as-main ⭐ button, and an inline dashed `[ + Add ]` upload tile.
   - **Dropzone Area**: The entire populated container actively accepts drag & drop file uploads.
   - **Bottom Action Button**: Clean `[ 📷 Add with Camera ]` button for continuous multi-shot capture.

### D. Integration Signature:
```vue
<PhotoGalleryManager 
  v-model:new-photos="galleryPhotos"
  v-model:main-selection="mainPhotoSelection"
  :existing-images="itemExistingAppwriteIds"
  :scanner-widget="scannerWidgetRef"
  output-format="object"
  :show-header="false"
  :allow-camera="true"
  :allow-upload="true"
  dropzone-subtitle="High-res photos or booth displays will attach to this post"
  title="Booth Displays"
  @open-camera="handleOpenCamera"
  @photos-added="handlePhotosAdded"
  @photo-removed="handlePhotoRemoved"
/>
```


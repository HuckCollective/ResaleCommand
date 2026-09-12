---
name: ux-design-system-taxonomy
description: Canonical UX terminology, design system taxonomy, and view archetypes (Catalog, Prep & Merchandising, Ledger, Terminal) for Resale Command, synthesizing Nielsen Norman Group (NN/g), Apple Human Interface Guidelines (HIG), and Google Material Design 3 (M3).
---

# Resale Command UX Taxonomy & Design System Architecture

This standard codifies the human-centered design language, interaction patterns, and view archetypes for Resale Command. All AI agents, contributors, and features must adhere to this taxonomy to maintain visual harmony and predictable user interactions across desktop, tablet, and mobile.

---

## 1. Canonical UX Terminology vs. Implementation Jargon

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
- **Sticky Action Footer (Bottom)**: Primary affirmative CTA (`Show N Items` / `Apply Location`) permanently pinned in thumb reach.

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

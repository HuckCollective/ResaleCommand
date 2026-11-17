# Bucket 2: Visual Grouping & Layout (`7 Laws`)

> **Parent Skill:** [`.agents/skills/laws-of-ux/SKILL.md`](../SKILL.md) • **Sibling Authorities:** [`daisyui`](../../daisyui/SKILL.md) & [`ux-design-system-taxonomy`](../../ux-design-system-taxonomy/SKILL.md)

---

## 2.1 Law of Proximity `[LINT]` — Relational 3-Tier Spacing Rhythm
*Objects that are closer to each other are perceived as more closely related than objects farther apart.*

### Concrete Tailwind CSS v4 Checks
Enforce **inter-section gap `>= 2×` intra-group field gap** so form labels bind unmistakably to their own input rather than floating equidistant between two inputs:

| Relationship | Tailwind Utilities | Pixel Equivalent |
| :--- | :--- | :--- |
| **1. Intra-Field (`Label ➔ Input ➔ Help Hint`)** | `flex flex-col gap-1` or `gap-1.5` (`py-0.5` on `.label`) | `4px – 6px` |
| **2. Sibling Fields Inside One Group** | `space-y-3` / `gap-2.5` to `gap-4` | `10px – 16px` |
| **3. Distinct Logical Sections / Page Shells** | `space-y-5 sm:space-y-6` (matching `.rc-page-shell` `20px` mobile floor ➔ `24px` at `sm:`+) | `20px – 24px+` |

```html
<!-- ❌ WARN: Uniform space-y-3 (12px) for both sections and fields flattens Gestalt grouping -->
<form class="space-y-3">
  <div class="space-y-3">...</div>
  <div class="space-y-3">...</div>
</form>

<!-- ✅ PASS: 4px label-input coupling, 12px field stack, 20px/24px section separation -->
<form class="space-y-5 sm:space-y-6">
  <section class="space-y-3">
    <div class="flex flex-col gap-1">
      <label for="item-title" class="text-xs font-bold text-base-content/80">Item Title</label>
      <textarea id="item-title" rows="2" class="textarea textarea-bordered leading-snug resize-none w-full"></textarea>
    </div>
  </section>
  <section class="space-y-3 pt-4 border-t border-base-200">...</section>
</form>
```

---

## 2.2 Law of Common Region `[LINT]` — Surface Containment Without Border Bloat
*Elements tend to be perceived into groups if they are sharing an area with a clearly defined boundary.*

### Concrete DaisyUI v5 Checks
- **3-Tier Semantic Surface Stack:**
  1. Page canvas: `bg-base-100` inside `.rc-page-shell` or `.rc-page-shell-narrow`.
  2. Grouped section card: `bg-base-200/60 border border-base-300 rounded-2xl p-4`.
  3. Deep inset well / stat tile: `bg-base-100` or `bg-base-300/60 rounded-xl p-3`.
- **Nesting Cap (`<= 2`):** Avoid stacking 3+ concentric bordered cards (`card > bordered box > bordered sub-box`). Use subtle `border-t border-base-200` dividers inside a single card instead.
- **Zero Hardcoded Neutral Colors:** Never use `bg-white`, `bg-gray-50`, or `border-gray-200`; always use theme-adaptive `base-100/200/300` tokens.

---

## 2.3 Law of Similarity `[LINT]` — Semantic Token & Affordance Consistency
*The human eye perceives elements with shared visual characteristics (color, shape, typography) as related or equally interactive.*

### Concrete Checks
- **Static Badges vs. Interactive Buttons:** Static `.badge` telemetry (`badge-sm font-bold whitespace-nowrap shrink-0`) must stay visually distinct from interactive `.btn` triggers (`shadow-xs`, hover brightness, `:active` scale). Clickable filter pills must use `<button type="button" class="btn ...">` with clear active/inactive borders.
- **Semantic Role Invariance:**
  - `primary` (`text-primary-content`): Create, Identify, Active Lens/Filter.
  - `success` (`text-success-content`): Commit, Money In, Verified Match, Placed.
  - `warning` (`text-warning-content`): Needs Review, Unverified/Pending, Re-Scan.
  - `error` (`text-error-content`): Destructive Action, Mismatch/Collision, Blocked.
  - `font-mono`: Reserved consistently for SKUs/UPCs (`HUCK-1234`), ticket numbers, currency deltas, and hashes.

---

## 2.4 Law of Uniform Connectedness `[LINT]` — Visually Fused Pairs & Flows
*Elements that are visually connected are perceived as more related than elements with no connection.*

### Concrete Checks
- **Input + Action Bars:** Fuse coupled search/URL/barcode inputs and their action buttons using DaisyUI `.join` (`<div class="join w-full">` with `join-item` children).
- **State Transition Connectors:** Connect multi-stage financial or stock previews explicitly (`Current: 4 units ➔ + Adding: 2 units ➔ New Total: 6 units`).

---

## 2.5 Law of Prägnanz `[LINT]` & Krug #4 *Billboard Design (Scan, Don't Read)* `[LINT]`/`[REVIEW]`
*People interpret ambiguous visuals in the simplest form possible (Prägnanz), and real users scan pages at `60 mph` looking to "satisfice" rather than reading prose line-by-line (Krug #4).*

### Concrete Checks (Enforced by `validate-templates.mjs` §12, §14D & §16)
- **3-Tier Billboard Hierarchy `[LINT]`:** Bold `font-black`/`font-extrabold` headings ➔ scannable key-value pills/columns ➔ subdued `text-base-content/70` metadata; flag walls of unchunked prose (`> 2` consecutive prose lines in operational cards/tables) `[REVIEW]`.
- **Zero Stacked Right-Edge Drawers (§16) `[LINT]`:** Never render a second `<SlideOverDrawer>` or `z-class` override on top of `ItemDrawer.vue` or another right-edge `<SlideOverDrawer>`; use inline lazy `v-if` drawer tabs or mutually exclusive sibling drawers instead.
- **Line-Clamp + Padding Separation (§12B) `[LINT]`:** **NEVER** place `line-clamp-*` and vertical padding (`p-*`, `py-*`, `pb-*`) on the same HTML element (bottom padding exposes the sliced top half of line `N+1`). Put padding/border/bg on an outer `<div>` and `line-clamp-*` on an inner unpadded `<p>`/`<span>`.
- **Dashboard Full-Wrap Invariant (§14D) `[LINT]`:** **NEVER** use `truncate` or `line-clamp-*` in any component under `src/components/dashboard/**` — dashboard alert and metric text must wrap naturally in full.
- **Self-Clearing Dock Spacer (§12D) `[LINT]`:** Pages mounting `<BottomActionDock>` or `<PaginationDock>` pass `hideFooter={true}` to `<Layout>` inside `.rc-page-shell` and rely on `.rc-dock-spacer` (`useDockClearance.ts`) — **never** add manual `pb-28..pb-48` or arbitrary pixel shells (`h-[72px]`, `max-w-[1600px]`).

---

## 2.6 Von Restorff Effect `[LINT]` — Focal Isolation & De-Duplication
*When multiple similar objects are present, the one that differs from the rest is most likely to be noticed and remembered.*

### Concrete Checks
- **Protect Signal Contrast:** Keep 85%+ of surface area in calm `base-100`/`base-200` neutrals so the single `btn-primary`/`btn-success` CPA or `badge-warning` alert pops immediately.
- **Badge Deduplication:** Never repeat the same status pill (e.g. `Combine Eligible` or venue code) in both the header bar and an immediately adjacent sub-card.
- **No Double Icons in Headings:** Use either an `<Icon icon="solar:..." />` OR a single leading emoji per heading — never `<Icon icon="solar:fire-bold" /> 🔥 WHY BUY` (`ux-design-system-taxonomy` §8E).

---

## 2.7 Selective Attention `[REVIEW]` — Task-Scoped Filtering
*Users focus only on stimuli directly tied to their active goal and tune out irrelevant surrounding UI (including banner blindness).*

### Concrete Checks
- **Context-Aware Grid Auto-Filtering:** When an Outbound Manifest Tray or Dropcast Tray is active, automatically filter the main catalog grid to valid candidates and suppress unrelated bulk actions (`Bulk Delete`, `Quick Export`) from the bottom dock (`ux-design-system-taxonomy` §8B–8C).
- **Actionable Inline Alerts Only:** Render warning/info banners (`v-if`) only when an anomaly actually exists (e.g., `pendingHours > 0` or `isVenueScopedPreview`), paired with a direct 1-click resolution button (`Switch to All Venues`, `Review & Approve ➔`).

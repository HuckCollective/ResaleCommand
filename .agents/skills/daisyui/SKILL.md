---
name: daisyui
description: Expert guidelines and best practices for building modern, responsive, and semantic UI components with daisyUI v5 and Tailwind CSS v4 in Astro and Vue. Use when building or editing any Vue component, modal, tray, table, or page styling.
---

# daisyUI v5 & Tailwind CSS Expert Skill

## Context & Principles
- **Library Version**: daisyUI v5 + Tailwind CSS v4.
- **Goal**: Write clean, semantic, component-first CSS utilizing daisyUI's design system tokens rather than repetitive raw Tailwind utility classes or hardcoded color values.
- **Theme Awareness**: Always design with semantic color tokens (`base-100`, `base-200`, `base-300`, `base-content`, `primary`, `secondary`, `accent`, `neutral`, `info`, `success`, `warning`, `error`) so that light and dark themes adapt naturally without broken contrast.

---

## 1. Semantic Color & Background Rules
- **NEVER** use hardcoded arbitrary colors like `bg-gray-100`, `bg-white`, `text-black`, `border-gray-300` when semantic tokens apply.
- **Card / Surface Backgrounds**:
  - Main background: `bg-base-100`
  - Subtle secondary card / panel: `bg-base-200`
  - Deep container / inset tray: `bg-base-300`
  - High contrast card headers / dividers: `border-base-300` or `border-base-200`
- **Text**:
  - Primary text: `text-base-content`
  - Subdued / muted text: `text-base-content/70` or `opacity-60`
  - Accent / highlight text: `text-primary`, `text-secondary`, `text-accent`
- **Status & Feedback**:
  - Success: `badge-success`, `text-success`, `bg-success/15`
  - Warning / Attention: `badge-warning`, `text-warning`, `bg-warning/15`
  - Danger / Error: `badge-error`, `text-error`, `bg-error/15`

---

## 2. Common daisyUI v5 Component Patterns

### Buttons (`btn`)
```html
<!-- Sizes: btn-xs, btn-sm, btn-md (default), btn-lg -->
<button class="btn btn-primary btn-sm gap-1.5 font-bold shadow-xs">
  <Icon icon="solar:check-circle-bold" class="w-4 h-4" /> Save Item
</button>

<!-- Outlined / Ghost / Soft -->
<button class="btn btn-outline btn-sm">Cancel</button>
<button class="btn btn-ghost btn-xs btn-circle">✕</button>
<button class="btn btn-warning btn-sm gap-1">Warning Action</button>
```

### Form Controls & Join Groups (`join`, `input`, `select`)
```html
<!-- Input + Button Combo with .join -->
<div class="join w-full shadow-xs">
  <input 
    type="text" 
    placeholder="Search items..." 
    class="input input-bordered input-sm join-item grow bg-base-100 text-xs" 
  />
  <button class="btn btn-primary btn-sm join-item font-bold">Search</button>
</div>

<!-- Standard Form Group -->
<div class="form-control w-full">
  <label class="label py-1">
    <span class="label-text text-xs font-bold text-base-content/80">Item Title</span>
  </label>
  <input type="text" class="input input-bordered input-sm w-full bg-base-100" />
</div>
```

### Cards & Panels (`card`)
```html
<div class="card bg-base-100 border border-base-300 shadow-sm rounded-2xl overflow-hidden">
  <div class="card-body p-4 sm:p-5 space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="card-title text-base font-bold text-base-content">Card Title</h3>
      <span class="badge badge-primary badge-sm font-semibold">Active</span>
    </div>
    <p class="text-xs text-base-content/70">Card description or metadata goes here.</p>
    <div class="card-actions justify-end pt-2">
      <button class="btn btn-primary btn-sm">Action</button>
    </div>
  </div>
</div>
```

### Modals (`modal`)
```html
<!-- daisyUI v5 dialog modal pattern -->
<dialog id="my_modal" class="modal modal-bottom sm:modal-middle">
  <div class="modal-box bg-base-100 border border-base-300 rounded-2xl shadow-xl">
    <h3 class="font-bold text-lg text-base-content">Modal Title</h3>
    <p class="py-4 text-sm text-base-content/80">Modal body content.</p>
    <div class="modal-action">
      <form method="dialog" class="flex gap-2">
        <button class="btn btn-sm btn-ghost">Cancel</button>
        <button class="btn btn-sm btn-primary">Confirm</button>
      </form>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button>close</button>
  </form>
</dialog>
```

### Bottom Navigation & Button Docks (`<BottomActionDock>` & `<PaginationDock>`)
daisyUI v5 replaces `btm-nav` with the semantic `.dock` component. In Resale Command, **never hand-roll raw `<div class="fixed bottom-0...">` dock wrappers**—always consume the canonical [`BottomActionDock.vue`](file:///c:/Users/15034/Projects/ResaleCommand/src/components/common/BottomActionDock.vue) and [`PaginationDock.vue`](file:///c:/Users/15034/Projects/ResaleCommand/src/components/common/PaginationDock.vue) primitives (`#top`, `#left`, `#center`, `#right` slots), which encapsulate `<Teleport to="body">`, safe-area insets, and automatic `ResizeObserver` `.rc-dock-spacer` clearance (`src/composables/useDockClearance.ts`):

```vue
<BottomActionDock>
  <template #top>
    <div class="text-xs font-bold">12 items staged • Ready to Sync</div>
  </template>
  <template #center>
    <!-- Primary Hero CTA: Solid High-Contrast Pill -->
    <button type="button" class="btn btn-sm sm:btn-md btn-primary text-primary-content font-black rounded-2xl shadow-md">
      <Icon icon="solar:magic-stick-3-bold" class="w-4.5 h-4.5" />
      <span>Identify Item</span>
    </button>
    <!-- Success Action (Save / Commit): Solid Green Pill -->
    <button type="button" class="btn btn-sm sm:btn-md btn-success text-success-content font-black rounded-2xl shadow-md">
      <Icon icon="lucide:truck" class="w-4.5 h-4.5" />
      <span>+ Add Item</span>
    </button>
  </template>
</BottomActionDock>
```
- **Modifiers**: `dock-xs`, `dock-sm`, `dock-md` (default), `dock-lg`, `dock-xl`.
- **Parts**: `.dock-label` for standard tab text, `.dock-active` for active selection indicator bar.
- **Hero Actions Rule**: Center actions in a dock must NEVER be flat transparent text with duotone icons (which wash out at 40% opacity in light themes). Always use **Solid Elevated Pills** (`bg-primary text-primary-content font-black shadow-md`, `bg-warning text-warning-content font-black shadow-md`) with **solid bold icons** (`solar:*-bold`).

### Badges, Tooltips & Loaders
```html
<!-- Badges (CRITICAL: Always use whitespace-nowrap and explicit *-content contrast tokens) -->
<span class="badge badge-sm badge-primary text-primary-content font-extrabold whitespace-nowrap px-2">AI Powered</span>
<span class="badge badge-sm badge-success text-success-content gap-1 font-bold whitespace-nowrap">In Stock</span>
<span class="badge badge-xs badge-neutral text-neutral-content whitespace-nowrap">Draft</span>

<!-- Loading Spinners -->
<span class="loading loading-spinner loading-xs text-primary"></span>
<span class="loading loading-dots loading-sm"></span>

<!-- Tooltips -->
<div class="tooltip tooltip-bottom" data-tip="Click to edit">
  <button class="btn btn-xs btn-ghost">Edit</button>
</div>
```

---

## 3. Best Practices & Pro Tips
1. **CRITICAL BADGE RULE**: Badges & small pills MUST always include `whitespace-nowrap` and explicit contrast tokens (`text-primary-content` on `badge-primary`, `text-secondary-content` on `badge-secondary`, `text-warning-content` on `badge-warning`). Never let multi-word badge text wrap inside fixed-height pills (`badge-xs`/`badge-sm`).
2. **BUTTON THEME CONTRAST RULE**: Primary and colored action buttons MUST include explicit matching content tokens (`btn-primary text-primary-content font-black`, `btn-success text-success-content font-black`). This guarantees bold, high-contrast readability across all 35 DaisyUI themes (including pastel/neon themes like `synthwave`, `valentine`, `cyberpunk`, `retro`, and `dracula`).
3. **DISABLED STATE ACCESSIBILITY**: Never rely on browser default disabled styles which create muddy/unreadable text on dark themes. Use explicit theme-adaptive tokens: `bg-base-300/40 text-base-content/40 border border-base-content/10 cursor-not-allowed` to ensure $\ge 3:1$ contrast ratio.
4. **BOTTOM DOCK ERGONOMIC SPACING**: Group bottom action bar buttons into centered containers (`max-w-md mx-auto` for 2 buttons, `max-w-2xl mx-auto` for 3 buttons) to prevent buttons from stretching into massive empty slabs on wide desktop screens.
5. **Responsive Modifiers**: Use `sm:`, `md:`, `lg:` with daisyUI classes (e.g. `modal-bottom sm:modal-middle`, `btn-block sm:btn-wide`).
6. **Icon Alignment**: Combine daisyUI buttons with Iconify icons using `gap-1.5` or `gap-2` and `items-center`.
7. **Avoid Duplicating Utilities**: Do not apply `border border-solid` when daisyUI components like `input-bordered` or `table` already provide baseline structure.
8. **Theme Transitions**: Allow CSS variables to handle dark/light toggles smoothly without manual class toggles like `dark:bg-black`.
9. **DROPDOWN & POPOVER AUTO-FIT RULE**: When rendering dropdown menus (`.dropdown-content .menu`) containing dynamic labels and trailing badges, NEVER use fixed narrow widths like `w-64`. Always use `w-max min-w-[280px] max-w-[calc(100vw-2rem)] sm:max-w-md` with `flex-1 min-w-0 truncate` on text and `shrink-0` on badges to guarantee zero pill breakout or text clipping across screen sizes.
10. **GLOBAL BADGE NOWRAP & MICRO-BADGE UTILITIES (`.badge` + `.badge-2xs` in `src/styles/global.css` — Enforced by `validate-templates.mjs`)**: DaisyUI v5 does not include `badge-2xs`/`btn-2xs`/`input-2xs` or `white-space: nowrap` on `.badge` by default. `src/styles/global.css` enforces `.badge { white-space: nowrap; flex-shrink: 0; }` globally and defines `.badge-2xs`, `.btn-2xs`, `.input-2xs`, and `.select-2xs` so badges never wrap onto 2 lines or overflow into card titles below them. Never cram rich multi-badge/multi-button cards into `xl:grid-cols-5` (use `xl:grid-cols-3` max for action cards).
11. **LINE-CLAMP + PADDING SEPARATION RULE (Enforced by `validate-templates.mjs`)**: NEVER put `line-clamp-*` and vertical padding (`p-*`, `py-*`, `pb-*`) on the same HTML element! Because `line-clamp-*` sets `overflow: hidden` (which clips at the border edge, not the content edge), any bottom padding reveals the top half of line `N+1` sliced horizontally in half. Always place `p-* bg-* border rounded-*` on an outer `<div>` wrapper and put `line-clamp-*` on an inner `<p>`/`<div>` with zero vertical padding.
12. **SELF-CLEARING BOTTOM DOCK SPACER RULE (`.rc-dock-spacer` / `useDockClearance` — Enforced by `validate-templates.mjs` §8)**: Both `<BottomActionDock>` and `<PaginationDock>` automatically measure their live pixel height via `ResizeObserver` and update `.rc-dock-spacer` (`--rc-dock-clearance`) inside `.rc-page-shell`. **NEVER** add manual `pb-28`..`pb-48` bottom padding to page wrappers (`validate-templates.mjs` §8 fails the build on `pb-28+`); keep normal `px-4 pt-4 sm:px-6 sm:pt-6 md:px-8 md:pt-8 pb-6 sm:pb-8` and pass `hideFooter={true}` to `<Layout>`.
13. **THE 29-TOKEN DAISYUI V5 THEME SPEC (`src/styles/theme.css` — Enforced by `validate-templates.mjs`)**: Custom themes in `@plugin "daisyui/theme"` do NOT inherit structural tokens from `light`. Every custom theme MUST define all 29 official tokens: `--border: 1px`, `--size-selector: 0.25rem`, `--size-field: 0.25rem`, `--depth: 1`, `--noise: 0`, 3 `--radius-*` tokens, and 20 semantic color tokens (including `--color-info/content`, `--color-success/content`, `--color-warning/content`, `--color-error/content`). Missing `--border: 1px` invalidates DaisyUI v5's `calc(var(--size) / 2 - var(--border))` formula, collapsing badge horizontal padding to 0px across the entire app!
14. **TAILWIND V4 & VITE PIPELINE VS. POSTCSS & `@apply` (`@reference` RULE — Enforced by `validate-templates.mjs`)**:
    - Our stack uses `@tailwindcss/vite` (Rust Oxide + Lightning CSS). Never create `postcss.config.*` or `tailwind.config.*` files in the project root.
    - Custom utilities in `src/styles/global.css` MUST live inside `@layer utilities` or `@layer components` (zero un-layered utility rules).
    - If any `.vue` or `.astro` `<style>` block uses `@apply`, it MUST declare `@reference "../../styles/global.css";` at line 1 so Vite can resolve utility classes without duplicating the bundle. Never use `@import "tailwindcss"` inside a component `<style>`. Never put `p-0` or `px-0` on a `.badge` element.
15. **INLINE TOOLBAR `<select>` WIDTH RULE (DaisyUI v5 `.select` defaults to `20rem` / `320px`)**: DaisyUI v5 sets `width: clamp(3rem, 20rem, 100%)` on `.select`. Inside any horizontal flex toolbar (`InventorySpatialBar.vue`, header filters, etc.), ALWAYS add `w-auto min-w-0 max-w-full shrink-0 pl-2 pr-7` to inline `<select class="select ...">` elements (never omit `w-auto` or multi-select toolbars will demand 320px per dropdown and wrap across stacked rows!).

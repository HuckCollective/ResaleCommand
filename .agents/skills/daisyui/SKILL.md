---
name: daisyui
description: Expert guidelines and best practices for building modern, responsive, and semantic UI components with daisyUI v5 and Tailwind CSS v4 in Astro and Vue.
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

### Bottom Navigation & Button Docks (`dock`)
daisyUI v5 replaces `btm-nav` with the official semantic `.dock` component. In Resale Command, all bottom docks follow the **Unified Frozen Command Dock Pattern**:

```html
<!-- Base frozen 2-tier dock pinned at bottom with safe-area insets -->
<div class="fixed bottom-0 inset-x-0 z-40 bg-base-100/95 dark:bg-base-200/95 backdrop-blur-2xl border-t border-base-300 shadow-[0_-4px_25px_rgba(0,0,0,0.18)] select-none pointer-events-auto flex flex-col pb-[env(safe-area-inset-bottom,0px)]">
  
  <!-- Tier 1: Slim Contextual Telemetry / Pager / Manifest Status Strip -->
  <div class="border-b border-base-content/15 bg-base-200 dark:bg-base-300 py-1 px-3 flex items-center justify-center text-xs shadow-2xs">
    <div class="max-w-xl w-full mx-auto flex items-center justify-between sm:justify-center gap-1 sm:gap-2">
      <!-- Pager items or active tracker pill -->
    </div>
  </div>

  <!-- Tier 2: DaisyUI Semantic Dock (Thumb Zone) with Solid Tactile Hero Buttons -->
  <div class="max-w-xl w-full mx-auto">
    <div class="dock dock-sm !static !bg-transparent !border-t-0 !shadow-none !h-14 px-2 py-1 gap-2">
      <!-- Neutral Action: New Scout / Cancel -->
      <button type="button" class="h-11 sm:h-12 my-auto px-2 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 bg-base-200/80 hover:bg-base-300 text-base-content font-bold border border-base-content/15 shadow-xs active:scale-95">
        <Icon icon="solar:restart-bold" class="w-4.5 h-4.5" />
        <span class="font-extrabold uppercase text-[10px] tracking-tight">New Scout</span>
      </button>

      <!-- Primary Hero CTA (Enabled): Solid High-Contrast Pill -->
      <button type="button" class="h-11 sm:h-12 my-auto px-4 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 bg-primary text-primary-content font-black shadow-md border border-primary-content/25 active:scale-95 hover:brightness-110">
        <Icon icon="solar:magic-stick-3-bold" class="w-4.5 h-4.5 drop-shadow-xs" />
        <span class="font-black uppercase text-[11px] tracking-wide leading-none">Identify Item</span>
      </button>

      <!-- Warning Hero CTA (Attention / Re-Action / Re-Identify): Solid Amber Pill -->
      <button type="button" class="h-11 sm:h-12 my-auto px-4 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 bg-warning text-warning-content font-black shadow-md border border-warning-content/25 active:scale-95 hover:brightness-110">
        <Icon icon="solar:magic-stick-3-bold" class="w-4.5 h-4.5 drop-shadow-xs" />
        <span class="font-black uppercase text-[11px] tracking-wide leading-none">Re-Identify</span>
      </button>

      <!-- Success Action (Save / Commit): Solid Green Pill -->
      <button type="button" class="h-11 sm:h-12 my-auto px-3 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 bg-success text-success-content font-black shadow-md border border-success-content/25 active:scale-95 hover:brightness-110">
        <Icon icon="lucide:truck" class="w-4.5 h-4.5" />
        <span class="font-black uppercase text-[10px] truncate max-w-[100px] leading-none">+ Add Item</span>
      </button>
    </div>
  </div>
</div>
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

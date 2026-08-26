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

### Badges, Tooltips & Loaders
```html
<!-- Badges -->
<span class="badge badge-sm badge-success gap-1 font-bold">In Stock</span>
<span class="badge badge-xs badge-neutral">Draft</span>

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
1. **Responsive Modifiers**: Use `sm:`, `md:`, `lg:` with daisyUI classes (e.g. `modal-bottom sm:modal-middle`, `btn-block sm:btn-wide`).
2. **Icon Alignment**: Combine daisyUI buttons with Iconify icons using `gap-1.5` or `gap-2` and `items-center`.
3. **Avoid Duplicating Utilities**: Do not apply `border border-solid` when daisyUI components like `input-bordered` or `table` already provide baseline structure.
4. **Theme Transitions**: Allow CSS variables to handle dark/light toggles smoothly without manual class toggles like `dark:bg-black`.

---
name: mobile-ux-standards
description: Industry-standard mobile UX/UI rules for Resale Command, synthesizing Nielsen Norman Group (NN/g), Apple Human Interface Guidelines (HIG), and Google Material Design 3 (M3).
---

# Mobile UX & Component Standards (NN/g, Apple HIG, Material 3)

## 1. Persistent Bottom Docks vs. Page Footers (NN/g & Apple HIG)
- **Task & Tool Views** (e.g. `/scout`, `/purchases/speed-entry`, `/inventory` scanners):
  - The **Bottom Dock IS the definitive bottom boundary of the screen**.
  - **NEVER** render a traditional page-level website footer (`Copyright © ... Made by ...`) directly above a fixed bottom action dock.
  - Set `hideFooter: true` on tool/app routes in Astro layouts.
- **Application Metadata & Copyright Location**:
  - Copyright notices, app version, and legal links belong at the bottom of the **Modal Navigation Drawer** (`Navbar.vue` / `app-drawer` sidebar) or Settings modal.

## 2. Text Inputs & Description Auto-Wrapping
- **No Clipped Text**: Long product/item titles (e.g. *"360 Stretch Active Mesh - Zones with Breathable Fabric"*) must NEVER be placed in single-line fixed-width inputs that horizontally clip or truncate text.
- **Mobile Card Inputs**: Use 2-row auto-wrapping `textarea` (`textarea textarea-bordered leading-snug resize-none`) with full width (`w-full`) so the entire title is legible and easily editable without scrolling inside the box.

## 3. Badges, Pills & High-Contrast Tokens (DaisyUI & M3)
- **Zero Text Stacking**: Badges & small pills (`badge-xs`, `badge-sm`) MUST include `whitespace-nowrap` so multi-word text (*e.g. "AI POWERED"*) never line-breaks and stacks on top of itself inside fixed-height pills.
- **Explicit Contrast Tokens**: Always pair colored badge backgrounds with their matching semantic content color token:
  - `badge-primary` $\to$ `text-primary-content`
  - `badge-secondary` $\to$ `text-secondary-content`
  - `badge-warning` $\to$ `text-warning-content`
  - `badge-error` $\to$ `text-error-content`
  - `badge-neutral` $\to$ `text-neutral-content`

## 4. Touch Targets & Safe-Area Padding (Apple HIG & Material 3)
- **Touch Target Size**: All interactive buttons, icon triggers, and form pills must have a minimum touch target of **44×44px** (or generous padding) to prevent tap errors.
- **Viewport Safe Areas**: All fixed bottom bars, modals, and camera viewfinders must include `pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]` for iOS home indicators and Android navigation bars.
- **Scroll Clearance with Fixed Docks**: When a fixed bottom dock is present, the scrollable page container must have **`pb-36` to `pb-44` (9rem–11rem) bottom padding**. This guarantees that the bottom-most list items or table rows scroll completely above the dock with generous breathing room and are never covered or clipped.
- **Floating Action Pills (Scroll-to-Top / Counts)**: Floating badges must sit at **`bottom-22` to `bottom-24`** centered (`left-1/2 -translate-x-1/2 z-40`) so they hover cleanly above the dock without overlapping table text or colliding with the dock buttons. Must use high-contrast backgrounds (`bg-base-200/95` or `bg-base-300`) with visible borders (`border border-base-content/20`).

## 5. Theme-Adaptive Button Contrast & Disabled States (DaisyUI & WCAG 2.1 AA)
- **Explicit Content Contrast**: Action buttons must pair `btn-primary` with `text-primary-content font-black` and `btn-success` with `text-success-content font-black` to guarantee legibility across all 35 DaisyUI light, dark, pastel, and neon themes (e.g. `synthwave`, `valentine`, `dracula`, `cyberpunk`).
- **Accessible Disabled States**: Never use browser default disabled styling on dark backgrounds. Use `bg-base-300/40 text-base-content/40 border border-base-content/10 cursor-not-allowed` to maintain a visible $\ge 3:1$ contrast ratio.
- **Ergonomic Dock Clustering**: Use `max-w-md mx-auto` for 2-button docks and `max-w-2xl mx-auto` for 3-button docks so buttons do not stretch into massive empty slabs on wide desktop screens.

## 6. Strict Zero Native Browser Dialogs (NN/g & Modern Web Standards)
- **NEVER Use Native Dialogs**: `window.confirm()`, `window.alert()`, and `window.prompt()` are strictly forbidden across the codebase. They block the single JS execution thread, look outdated, and destroy mobile PWA experiences.
- **Confirmation Modals**: Always use `confirmDialog(message, title, confirmText, cancelText, confirmClass)` from `@stores/confirm` (rendered globally via `ConfirmContainer.vue`).
- **Notifications & Errors**: Always use `addToast(message, type)` from `@stores/toast` for non-blocking feedback.


---
trigger: glob
globs: "**/src/**/*.vue, **/src/**/*.astro, **/src/styles/**/*.css"
description: "Vue 3.5 SFC, Astro SSR, Tailwind v4, DaisyUI v5, dock spacer, media fallback, and async loader guardrails."
---

# Vue 3.5, Astro SSR, Tailwind v4 & DaisyUI v5 Guardrails

1. **Fragment & Teleport SFC Safety (Zero `[Vue warn]`):**
   - Any `.vue` component with multi-root Fragment templates (`v-if` + `<Teleport to="body">`, sibling modals, or unwrapped roots) MUST explicitly declare `defineProps` and `defineEmits` for every attribute/listener passed by a parent (`class`, `id`, `@saved`, `@updated`, `@deleted`), or wrap inside a single root `<div>`.
   - Global body-teleported overlays (`CoopMessagesTray`, `ToastContainer`, `ConfirmContainer`, `HuckleberryLoader`) in `Layout.astro` MUST use `client:only="vue"` (never `client:load` / `client:idle`, which cause SSR hydration mismatches).

2. **Sticky Docks & Self-Clearing `.rc-dock-spacer` (`useDockClearance`):**
   - Always use `<BottomActionDock>` and `<PaginationDock>` (`fixed bottom-0`, `z-50`, `backdrop-blur`) inside `.rc-page-shell` with `hideFooter={true}` on `<Layout>`.
   - Both docks automatically measure height via `ResizeObserver` (`src/composables/useDockClearance.ts`) and expand `.rc-dock-spacer` (`--rc-dock-clearance`). **NEVER** add manual `pb-28`..`pb-48` bottom padding to pages (`validate-templates.mjs` §8 fails on `pb-28+`); keep normal `pb-6 sm:pb-8`.

3. **Tailwind CSS v4 & DaisyUI v5 Rendering Rules:**
   - Inside `<style>` / `<style scoped>` blocks that use `@apply`, ALWAYS declare `@reference "../../styles/global.css";` (relative to file depth) — **NEVER** `@import "tailwindcss";` inside component styles (duplicates the entire CSS bundle).
   - **Never combine `line-clamp-*` with vertical padding (`p-*`, `py-*`, `pb-*`) on the same element** (`overflow: hidden` does not clip the padding box, exposing bled lines below). Put padding on an outer wrapper and `line-clamp-*` on an unpadded inner `<span>`/`<p>`.
   - Never strip horizontal padding (`p-0` / `px-0`) on DaisyUI v5 `.badge` elements (`validate-templates.mjs` §9).

4. **Appwrite Thumbnails & `/preview` ➔ `/view` Media Fallback:**
   - Every table rendering `resale_db.items` rows MUST include `<ItemThumbnail>` (`src/components/inventory/ItemThumbnail.vue`).
   - Every Appwrite `<img :src="getAssetUrl(id, ...)">` element MUST attach an `@error` handler that retries raw `/view` (`getAssetUrl(id, { preview: false })`) before falling back to the next valid ID in `galleryImageIds` (handles Appwrite Cloud image-transform/format rejections).

5. **Zero Native Browser Dialogs & NN/g 3-Bucket Loader Standard (`src/lib/useLoader.ts`):**
   - **NEVER** call `window.alert()`, `window.confirm()`, or `window.prompt()` — always use `askConfirm()` (`src/stores/confirm.ts` — noting relative imports `../../stores/*` since `tsconfig.json` only aliases `@lib/*`) and `addToast()` (`src/stores/toast.ts`).
   - Match async feedback to NN/g response-time buckets:
     - `< 1s` (toggles/Deletes): Optimistic UI + toast (no full-screen loader).
     - `1s – 3s` (filters/drawer saves): Local button spinner (`setScopedLoading` / `loading="true"`).
     - `> 3s` (AI Deep Scan, batch sync/import, bulk split): Global `HuckleberryLoader.vue` via `withFullPageLoader(title, subtitle, fn, { cancelable: true })` wired to `AbortController`.

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
   - Both docks automatically measure height via `ResizeObserver` (`src/composables/useDockClearance.ts`) and expand `.rc-dock-spacer` (`--rc-dock-height`). **NEVER** add manual `pb-28`..`pb-48` bottom padding to pages (`validate-templates.mjs` §12D fails on `pb-28+`); keep normal `pb-6 sm:pb-8`.

3. **Tailwind CSS v4 & DaisyUI v5 Rendering Rules:**
   - Inside `<style>` / `<style scoped>` blocks that use `@apply`, ALWAYS declare `@reference "../../styles/global.css";` (relative to file depth) — **NEVER** `@import "tailwindcss";` inside component styles (duplicates the entire CSS bundle).
   - **Never combine `line-clamp-*` with vertical padding (`p-*`, `py-*`, `pb-*`) on the same element** (`overflow: hidden` does not clip the padding box, exposing bled lines below; `validate-templates.mjs` §12B). Put padding on an outer wrapper and `line-clamp-*` on an unpadded inner `<span>`/`<p>`.
   - Never strip horizontal padding (`p-0` / `px-0`) on DaisyUI v5 `.badge` elements (`validate-templates.mjs` §12F), and never use `truncate` or `line-clamp-*` inside `src/components/dashboard/**` (§14D).

4. **Appwrite Thumbnails & `/preview` ➔ `/view` Media Fallback:**
   - Every table rendering `resale_db.items` rows MUST include `<ItemThumbnail>` (`src/components/common/ItemThumbnail.vue`).
   - Every Appwrite `<img :src="getAssetUrl(id, ...)">` element MUST attach an `@error` handler that retries raw `/view` (`getAssetUrl(id, { preview: false })`) before falling back to the next valid ID in `galleryImageIds` (handles Appwrite Cloud image-transform/format rejections).

5. **Zero Native Browser Dialogs & NN/g 3-Bucket Loader Standard (`src/composables/useLoader.ts`):**
   - **NEVER** call `window.alert()`, `window.confirm()`, or `window.prompt()` — always use `askConfirm()` (`src/stores/confirm.ts` — noting relative imports `../../stores/*` since `tsconfig.json` only aliases `@lib/*`) and `addToast()` (`src/stores/toast.ts`).
   - Match async feedback to NN/g response-time buckets:
     - `< 1s` (reversible non-money toggles): Optimistic UI + toast (money/stock commits obey Law 6 button lock + progress).
     - `1s – 3s` (filters/drawer saves/initial hydration): Geometry-matched `.skeleton` blocks / local spinner (`setScopedLoading`).
     - `> 3s` (AI Deep Scan, batch sync/import, bulk split): Global `HuckleberryLoader.vue` (`showLoader` with `150ms` anti-strobe debounce & `5s` cancel safety wired to `AbortController`).

6. **30 Laws of UX Design & Read-Only UI Audit Skill:**
   - When designing, refactoring, or auditing layouts, spacing rhythm, forms, CTA focus, tap targets, or flows, load `.agents/skills/laws-of-ux/SKILL.md` (and only the relevant `references/01..05-*.md` bucket file).

7. **Collective Voice & Zero Infrastructure Jargon in UI (`validate-templates.mjs` §15):**
   - Applies **ONLY** to strings a member or shopper can read (templates, badges, toasts, loader steps, error messages)—code identifiers, file names (`lib/appwrite.ts`), comments, AI docs/rules, and `console.*` keep technical names.
   - Use plain Collective language: `"Saving sales to ledger…"`, `"Saving hours…"`, `"✅ Saved"`, `"🔒 Official Ledger"`, `"Member Hats & Access"`, `"Invite to the Collective"`, `"Account Steward"`, and `toUserMessage(err, fallback)` (`src/lib/userFacingErrors.ts`). Never render `Appwrite`, `Vercel`, `Astro`, `DaisyUI`, `Tailwind`, `resale_db`, `coop_ledger`, `coop_proposals`, `JWT`, or `localStorage` in user-facing UI (mark legitimate SaaS vendor receipt examples with `data-vendor-ok` / `// rc-vendor-ok`).

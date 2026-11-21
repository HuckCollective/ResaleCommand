# Bucket 1: Decision & Choice (`6 Laws`)

> **Parent Skill:** [`.agents/skills/laws-of-ux/SKILL.md`](../SKILL.md) • **Sibling Authorities:** [`ux-design-system-taxonomy`](../../ux-design-system-taxonomy/SKILL.md) & [`mobile-ux-standards`](../../mobile-ux-standards/SKILL.md)

---

## 1.1 Hick's Law `[LINT]` & Krug's 2nd Law *(Mindless, Unambiguous Clicks)* `[REVIEW]`
*The time it takes to make a decision increases logarithmically with simultaneous action choices (Hick), and users don't count clicks as long as every click is painless and self-evident (Krug #2).*

### Concrete Vue 3.5 & DaisyUI v5 Checks
- **One Filled CPA Per Surface Layer `[LINT]`:** Each active surface layer (page `<BottomActionDock>` vs. stacked `<SlideOverDrawer>` `#footer`) MUST render at most **1** solid high-contrast Contextual Primary Action (`btn-primary text-primary-content font-black` or `btn-success text-success-content font-black`).
- **Action Hierarchy Demotion `[LINT]`:** Secondary actions use `btn-outline` or `btn-ghost border border-base-300`; destructive/rare utilities (`Delete`, `Unlink`, `Export Raw CSV`) move into overflow menus or contextual batch mode.
- **Dynamic CPA Morphing `[LINT]`:** In Catalog views, `+ Add` yields cleanly to `⚡ Actions (N)` when rows are checked (`ux-design-system-taxonomy` §5).
- **Krug #2 — Verb + Object Labels Over Mystery Meat `[REVIEW]`:** Flag vague links/buttons (`"Manage"`, `"Process"`, `"Submit"`, `"Execute"`, `"Go"`) where the user has to pause and guess what happens next; require unambiguous **Verb + Object** labels (`"Save Hours to Official Ledger"`, `"Copy Mobile Name"`, `"Open Ricochet POS Sync"`).

```html
<!-- ❌ FAIL: 3 competing filled semantic buttons in one footer bar -->
<div class="flex gap-2">
  <button type="button" class="btn btn-secondary">Import CSV</button>
  <button type="button" class="btn btn-accent">Load Demo</button>
  <button type="button" class="btn btn-primary">Commit Sync</button>
</div>

<!-- ✅ PASS: 1 solid CPA + neutral ghost/outline secondary trigger -->
<div class="flex items-center justify-end gap-2">
  <button type="button" class="btn btn-sm md:btn-md btn-ghost border border-base-300" @click="openImportDrawer">
    Manual CSV &amp; Demo
  </button>
  <button type="button" class="btn h-11 px-4 btn-success text-success-content font-black rounded-xl shadow-md" :disabled="isCommitting">
    Commit {{ readyCount }} Sales
  </button>
</div>
```

---

## 1.2 Choice Overload `[LINT]` — Bounded Option Lists & Chips
*Users become overwhelmed and abandon or mis-select when presented with too many peer options in an unfiltered list.*

### Concrete Vue 3.5 & DaisyUI v5 Checks
- **Inline Pill/Chip Ceiling (`<= 7`):** Keep visible inline radio/filter/hat/niche pill sets to `<= 7` options. When options exceed `7`, switch to [`SingleSelectDropdown.vue`](src/components/common/SingleSelectDropdown.vue) or [`MultiSelectDropdown.vue`](src/components/common/MultiSelectDropdown.vue) with an internal search input, or collapse extras behind a `+N More` toggle / Bottom Sheet Tray.
- **Pre-Ranked Candidate Caps:** Inventory Match Drawers surface the **Top 5–8** unclaimed candidates before typing (`getUnclaimedMatchCandidatesForRow`), and Dashboard Operations Radar caps on-canvas alert rows at **Top 6** (`OperationsRadarGrid.vue`), delegating full queues to a tray.

---

## 1.3 Fitts's Law `[LINT]` — Touch Floor & Ergonomic Distance
*The time to acquire a target is a function of the distance to and size of the target.*

### Exact DaisyUI v5 Sizing Facts & Mobile Floor
In DaisyUI v5 (`--size-field: 0.25rem` in [`src/styles/theme.css`](src/styles/theme.css)):
- `btn-lg` = `48px` (`3rem`) — **Mobile Touch Compliant**
- `btn-md` (default) ≈ `40px` (`2.5rem`) — *`4px` short of `44px` floor!*
- `btn-sm` = `32px` (`2rem`)
- `btn-xs` = `24px` (`1.5rem`)
- `.btn-2xs` = `22px` (`1.375rem` in [`src/styles/global.css`](src/styles/global.css))

> **CSS Pitfall:** Because DaisyUI v5 sets explicit `height: var(--size)` on `.btn`, adding `min-h-11` alone may not grow a `btn-xs`/`btn-sm` consistently across browsers. Use `btn-lg`, explicit `h-11` (`2.75rem` = `44px`), or `h-11 md:h-auto` (deferring to [`mobile-ux-standards`](../../mobile-ux-standards/SKILL.md) §4 for the `md:` `>=768px` desktop dense-table carve-out).

### Concrete Checks
- **Mobile (`<768px`) Interactive Targets:** Must achieve `>= 44×44px` (`h-11 min-w-11` or `btn-lg`) with `touch-action: manipulation` (set globally in `global.css`).
- **Desktop (`md:` `>=768px`) Table Controls:** Dense table rows/toolbars may step down (`h-11 md:h-7 px-3 md:px-2` or `<label class="inline-flex items-center justify-center min-w-11 min-h-11 md:min-w-0 md:min-h-0 cursor-pointer">` around `checkbox-xs`).
- **Thumb-Zone Anchoring & Destructive Spacing:** Anchor primary page actions inside `<BottomActionDock>` (`fixed bottom-0`, `pb-[env(safe-area-inset-bottom,0px)]`) and enforce `>= 8px` (`gap-2`) between affirmative and destructive triggers.

---

## 1.4 Jakob's Law `[LINT]` — Familiar Web & Overlay Conventions
*Users spend most of their time on other apps and expect controls, drawers, and keyboard shortcuts to work the standard way.*

### Concrete Vue 3.5 & DaisyUI v5 Checks
- **Forms Use `<SlideOverDrawer>`:** Short/medium create & edit forms open inside [`SlideOverDrawer.vue`](src/components/common/SlideOverDrawer.vue) (`Esc` key close, backdrop scrim click close, `document.body.style.overflow = 'hidden'`, auto-focus into panel, sticky `#footer`) rather than centered `<dialog>` modals.
- **Sanctioned Carve-Outs:**
  1. **Destructive / Emailing Confirmations:** Use `askConfirm()` (`src/stores/confirm.ts` ➔ `ConfirmContainer.vue`) or confirmation modals with email previews (`ux-design-system-taxonomy` §9).
  2. **`SalesImportTray.vue` Exception:** Sanctioned by `AGENTS.md` Law 5 and `validate-templates.mjs` §11 as a right-edge intake tray — flag as `WARN`-only if missing focus lock, and **never rename** the component file.
- **Native `<select>` Popups:** Preserve `global.css`'s `appearance: none !important` override on `select.select` so DaisyUI v5's experimental `base-select` never renders transparent, overlapping menus.

---

## 1.5 Mental Model `[LINT]` & Krug's 1st Law *(Eliminate "Question Marks": Self-Evident > Self-Explanatory)* `[LINT]`/`[REVIEW]`
*Interfaces must mirror the physical reality of resellers holding barcode stickers, tote bins, and antique-mall payout sheets—never make the user stop and wonder what a label means or whether an element is clickable.*

### Concrete Checks
- **Self-Evident Affordance & Plain Reseller Nouns:** Interactive controls must look unmistakably clickable vs. static `.badge` pills (cross-referencing Similarity in `02`) `[LINT]`; replace clever/internal labels (`Phase 2 Ready` ➔ `Coming Soon`, `Handshake Page` ➔ `Open Sign-In Page`) `[REVIEW]` and distinguish **🏪 Selling Booths** (`MD`, `DT`) honestly from **📦 Backstock Storage** (`HG`, `HH`).
- **Plain-English Vocabulary (`validate-templates.mjs` §15 `[LINT]`):** Always use canonical labels: `✂️ Split Lot`, `📦 Booth Bin (Multi-Qty)`, `➕ Restock Bin`, `↩️ Undo Combine`, `🔍 Deep Scan`, `⚡ Quick Scout`, `📦 Combine Similar`, `🎁 Build Bundle`, and `🏷️ Adopt Booth Tag`.
- **Dynamic Venue Identity (Law 2 `[LINT]`):** Never hardcode venue names, commission rates, or rent strings in templates — render `{{ locationMeta.shortName }}` and `{{ locationMeta.feePct }}%` resolved from `src/lib/warehouses.ts`.

---

## 1.6 Occam's Razor `[REVIEW]` — Minimal Competing Chrome
*Among competing UI layouts that accomplish the same user task, the one with fewer visual elements and fewer steps wins.*

### Concrete Checks
- Keep primary operational routes aligned to **Law 5**: `Top KPIs ➔ Full DataTable / Card Grid ➔ Sticky BottomActionDock`.
- Omit creation CPAs cleanly on read-only ledger views; avoid redundant wrapper cards, duplicate toolbars, or decorative icons that carry zero operational status.

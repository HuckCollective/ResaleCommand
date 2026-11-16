---
name: laws-of-ux
description: Reusable UX design and read-only UI audit skill grounded in all 30 Laws of UX across 5 operational buckets, mapped to Tailwind CSS v4, DaisyUI v5, Astro SSR, and Vue 3.5 checks. Use when designing, refactoring, or auditing any layout, form, button, modal, drawer, tray, or loading/error flow.
---

# Laws of UX — 5-Bucket Design & Read-Only UI Audit Skill

This skill translates all **30 Laws of UX** into concrete **Tailwind CSS v4**, **DaisyUI v5**, **Astro SSR**, and **Vue 3.5** engineering checks for **Works@TheHC** (`Resale Command`).

---

## 1. Layer-of-Authority Contract (Zero Rule Collisions)

To prevent conflicting instructions, each workspace customization owns one strict layer:

| Layer | Canonical File | Scope of Authority |
| :--- | :--- | :--- |
| **Immutable Architecture Laws** | [`GEMINI.md`](file:///c:/Users/15034/Projects/ResaleCommand/GEMINI.md) | Laws 1–7 (`4` locations only, zero hardcoding, `salesBucketing.ts`, Appwrite-first, Law 5 Enterprise UX/IA, Law 6 3-Tier Commit Idempotency, Law 7 calendar `sold_date`). |
| **Auto-Injected SFC/CSS Guardrails** | [`.agents/rules/vue-and-style-guardrails.md`](file:///c:/Users/15034/Projects/ResaleCommand/.agents/rules/vue-and-style-guardrails.md) | Fragment/`<Teleport>` prop/emit safety, `client:only="vue"` overlays, `.rc-dock-spacer`, `@reference`, `line-clamp` separation, `/preview` ➔ `/view` fallback, `useLoader.ts` buckets. |
| **UX Psychology & Heuristics (This Skill)** | [`.agents/skills/laws-of-ux/SKILL.md`](file:///c:/Users/15034/Projects/ResaleCommand/.agents/skills/laws-of-ux/SKILL.md) | *Why & Quantitative Heuristics*: 30 Laws of UX in 5 buckets (`[LINT]` vs. `[REVIEW]`) + On-Demand 5-Point UI Audit Runner. |
| **Domain Pattern Primitive Catalog** | [`.agents/skills/ux-design-system-taxonomy/SKILL.md`](file:///c:/Users/15034/Projects/ResaleCommand/.agents/skills/ux-design-system-taxonomy/SKILL.md) | *What to Mount*: `BottomActionDock`, `SlideOverDrawer`, `ItemDrawer`, `PaginationDock`, `PhotoGalleryManager`, `KpiStatGrid`, and the 4 View Archetypes. |
| **Mobile Touch & Viewport Authority** | [`.agents/skills/mobile-ux-standards/SKILL.md`](file:///c:/Users/15034/Projects/ResaleCommand/.agents/skills/mobile-ux-standards/SKILL.md) | `375px–420px` viewport rules, `44×44px` mobile floor (`<768px`) + `md:` desktop dense-table carve-out (§4), badge nowrap, and contrast tokens. |
| **CSS Tokens & Vue SFC Mechanics** | [`daisyui/SKILL.md`](file:///c:/Users/15034/Projects/ResaleCommand/.agents/skills/daisyui/SKILL.md) & [`vue-component-standards/SKILL.md`](file:///c:/Users/15034/Projects/ResaleCommand/.agents/skills/vue-component-standards/SKILL.md) | 29-token `huckleberry` theme spec (`--border: 1px`), `@layer utilities/components`, WebRTC camera lifecycle, and Rule-of-Two extraction. |

---

## 2. Master 30-Law Index & Progressive-Disclosure Router

Every law is tagged **`[LINT]`** (deterministic DOM/class/AST check — eligible for `FAIL` or `WARN`) or **`[REVIEW]`** (contextual human-factors judgment — defaults to `WARN` unless breaking a core invariant). Open ONLY the bucket reference file(s) needed for your task:

1. **[`references/01-decision-and-choice.md`](./references/01-decision-and-choice.md) (`6 Laws`):**
   - Hick's Law `[LINT]` • Choice Overload `[LINT]` • Fitts's Law `[LINT]` • Jakob's Law `[LINT]` • Mental Model `[REVIEW]` • Occam's Razor `[REVIEW]`
2. **[`references/02-visual-grouping-and-layout.md`](./references/02-visual-grouping-and-layout.md) (`7 Laws`):**
   - Law of Proximity `[LINT]` • Law of Common Region `[LINT]` • Law of Similarity `[LINT]` • Law of Uniform Connectedness `[LINT]` • Law of Prägnanz `[LINT]` • Von Restorff Effect `[LINT]` • Selective Attention `[REVIEW]`
3. **[`references/03-memory-and-cognitive-load.md`](./references/03-memory-and-cognitive-load.md) (`7 Laws`):**
   - Chunking `[LINT]` • Miller's Law `[LINT]` • Working Memory `[LINT]` • Cognitive Load `[REVIEW]` • Postel's Law `[LINT]` • Tesler's Law `[REVIEW]` • Paradox of the Active User `[LINT]`
4. **[`references/04-speed-momentum-and-focus.md`](./references/04-speed-momentum-and-focus.md) (`6 Laws`):**
   - Doherty Threshold (`<= 400ms`) `[LINT]` • Flow `[LINT]` • Goal-Gradient Effect `[REVIEW]` • Zeigarnik Effect `[REVIEW]` • Pareto Principle `[REVIEW]` • Parkinson's Law `[REVIEW]`
5. **[`references/05-perception-and-emotional-impression.md`](./references/05-perception-and-emotional-impression.md) (`4 Laws`):**
   - Aesthetic-Usability Effect `[LINT]` • Peak-End Rule `[LINT]` • Serial Position Effect `[LINT]` • Cognitive Bias `[REVIEW]`

---

## 3. 5-Bucket Quick-Enforcement Matrix (Tailwind v4 / DaisyUI v5 / Vue 3.5)

### Bucket 1 — Decision & Choice
- **Hick's Law `[LINT]` *(Simultaneous Actions)*:** Render `<= 1` filled Contextual Primary Action (`btn-primary` or `btn-success` with `text-*-content font-black`) **per active surface layer** (e.g., 1 CPA in `<BottomActionDock>`, 1 submit CPA inside an open `<SlideOverDrawer>` `#footer`). Demote secondary siblings to `btn-outline` or `btn-ghost`.
- **Choice Overload `[LINT]` *(Option Sets & Chips)*:** Cap inline filter/role/niche chip groups at `<= 7` visible pills. Above `7`, switch to `<SingleSelectDropdown>` / `<MultiSelectDropdown>` with search or progressive disclosure (`Top 5–8` unclaimed match candidates; `Top 6` radar alerts).
- **Fitts's Law `[LINT]` *(Exact DaisyUI v5 Sizing)*:** In DaisyUI v5 (`--size-field: 0.25rem`), `btn-lg` = `48px`, `btn-md` ≈ `40px`, `btn-sm` = `32px`, `btn-xs` = `24px`, and `.btn-2xs` = `22px` (`min-h-11` alone may not override DaisyUI's `height` calc). Deferring to `mobile-ux-standards` §4: mobile (`<768px`) & primary targets MUST use `btn-lg`, `h-11` (`44px`), or `h-11 md:h-auto`, with `>= 8px` (`gap-2`) clearance adjacent to destructive buttons.
- **Jakob's Law `[LINT]`:** Create/edit forms open in `<SlideOverDrawer>` (`Esc` + backdrop close, body scroll lock, focus move). *Carve-outs*: `askConfirm()` (`ConfirmContainer.vue`) is sanctioned for destructive/email confirmations; `SalesImportTray.vue` is a Law 5 / `validate-templates.mjs` §11 sanctioned right-edge intake tray (`WARN`-only in audits; never rename).
- **Mental Model `[REVIEW]` & Occam's Razor `[REVIEW]`:** Use plain-English physical retail labels (`✂️ Split Lot`, `📦 Booth Bin (Multi-Qty)`, `➕ Restock Bin`, `🏷️ Adopt Booth Tag`), dynamic `{{ locationMeta.shortName }}` lookups (Law 2), and move secondary upload/demo tools out of the primary page body into slide-over trays/drawers.

### Bucket 2 — Visual Grouping & Layout
- **Law of Proximity `[LINT]` *(Relational Spacing)*:** Enforce **inter-section gap `>= 2×` intra-group gap**:
  - Label ➔ Input / Hint coupling: `4–6px` (`gap-1` / `gap-1.5`).
  - Sibling fields inside one group: `10–16px` (`gap-2.5` to `space-y-4`).
  - Major sections / page shells: `>= 20px` floor on mobile (`space-y-5`, matching `.rc-page-shell`) and `>= 24px` at `sm:`+ (`sm:space-y-6`).
- **Common Region `[LINT]` & Prägnanz `[LINT]`:** Contain groups via `bg-base-100` ➔ `bg-base-200/60 border border-base-300 rounded-2xl` ➔ `bg-base-300` (`<= 2` nested bordered wrappers). Never combine `line-clamp-*` + vertical padding (`p-*/py-*/pb-*`) on the same element (`validate-templates.mjs` §12B), and never use `truncate` or `line-clamp-*` inside `src/components/dashboard/**` (§14D — dashboard text wraps fully).
- **Similarity `[LINT]` & Uniform Connectedness `[LINT]`:** Keep semantic color roles invariant across views; never style static `.badge` pills like clickable `.btn` controls; join coupled input+action bars with `.join` (`join-item`).
- **Von Restorff `[LINT]` & Selective Attention `[REVIEW]`:** Deduplicate status badges across adjacent zones, ban `<Icon>` + emoji doubling in headers, and auto-filter catalog grids when a selection tray is active (`ux-design-system-taxonomy` §8B).

### Bucket 3 — Memory & Cognitive Load
- **Chunking `[LINT]` & Miller's Law (`7±2`) `[LINT]`:** Mount `<KpiStatGrid :columns="2 | 3 | 4" />` for summary strips, keep top nav pillars `<= 5`, format currency with `.toFixed(2)`, and format month labels via `monthKeyToLabel` (Law 7).
- **Working Memory `[LINT]` & Cognitive Load `[REVIEW]`:** Pin target-row context banners (thumbnail + title + SKU + price) inside match/edit drawers, show live `"Before ➔ After"` math previews before stock/money confirmation, collapse non-lead hat sections (`useCollapsibleSection`), and lazy-mount heavy drawer tabs with `v-if`.
- **Postel's Law `[LINT]` *(Safe Input Lenience)*:**
  - Emails: normalize with `.trim().toLowerCase()` on submit + `type="email" autocomplete="email" autocapitalize="none"`.
  - Passwords: **NEVER** `.trim()` or mutate password strings (`autocomplete="current-password"` / `"new-password"`).
  - Prices/Currency: use `type="text" inputmode="decimal"` parsed via `parsePriceValue()` from `src/lib/lot-strategy.ts` (never `type="number"` scroll-wheel traps or raw regex stripping).
  - Handles/UPCs: accept `@handle` or full `https://` URLs and normalize scanned barcodes (`huck-1234` ➔ `HUCK-1234`).
- **Tesler's Law `[REVIEW]` & Paradox of the Active User `[LINT]`:** Auto-resolve venue fees/rent from `src/lib/warehouses.ts` and CSV schemas in code; ban multi-paragraph workflow explainer cards on operational canvases in favor of self-evident `<PhotoGalleryManager>` / dropzone empty states.

### Bucket 4 — Speed, Momentum & Focus
- **Doherty Threshold (`<= 400ms`) `[LINT]`:** Enforced as a **first-visible-feedback latency target (`<= 400ms`)** layered onto [`src/composables/useLoader.ts`](file:///c:/Users/15034/Projects/ResaleCommand/src/composables/useLoader.ts):
  - Immediate (`<100ms`): global `.btn:active` `scale(0.97)` + synchronous `:disabled="isSubmitting"` button lock.
  - Bucket 1 (`< 1s`): Optimistic UI **strictly for reversible, non-money UI toggles** (lens switch, filter chip, star cover photo). **Money- and stock-moving commits NEVER fake optimistic completion** — they strictly follow **Law 6** (button lock, chunked batch progress, exact Appwrite error toast). Note: `150ms` anti-strobe debounce applies strictly to global `showLoader()`.
  - Bucket 2 (`1s – 3s`): Geometry-matched DaisyUI `.skeleton` placeholders + `setScopedLoading(key, true)` instead of collapsing layout height into a bare spinner.
  - Bucket 3 (`> 3s`): `HuckleberryLoader.vue` with live step text, `%` progress, and `5s` safety cancel (`AbortController`).
- **Flow `[LINT]`:** Zero `window.alert/confirm/prompt`; preserve scroll/filter state across drawer edits; enforce Selection Tray mutual exclusivity; flag (`WARN`) fixed bottom-right toasts if they risk colliding with `<BottomActionDock>` CTAs.
- **Goal-Gradient `[REVIEW]`, Zeigarnik `[REVIEW]`, Pareto `[REVIEW]` & Parkinson's `[REVIEW]`:** Surface live batch/verify progress (`14 / 18`) and unfinished staging pills (`📦 Staged`), vanish cleanly on pause/completion, keep 80/20 daily tools on frame 0, and pre-fill smart defaults on quick-intake forms.

### Bucket 5 — Perception & Emotional Impression
- **Aesthetic-Usability Effect `[LINT]`:** Enforce the 29-token `huckleberry` theme (`--border: 1px`), `whitespace-nowrap shrink-0` + explicit `*-content` contrast (never `p-0`/`px-0` on `.badge`), `/preview` ➔ `/view` `@error` fallback (`<ItemThumbnail>`), and zero-flash SSR session/theme scripts.
- **Peak-End Rule `[LINT]`:** Render visible Pre-Flight Queue Previews + calm progress at the **Peak** of batch commits, and clear affirmative closure (`✅ Already Synced`) + human-readable retry cards at the **End**.
- **Serial Position Effect `[LINT]`:** Place primary identity (`<ItemThumbnail>` + Title, or `#1 👑 Hero Anchor`) in the first slot and net payout / Contextual Primary Action in the final slot.
- **Cognitive Bias `[REVIEW]`:** Prevent MSRP anchoring and pricing drift — lock Bidding Bar, Channel Comparison, and Target Resale to one `.toFixed(2)` numerical truth and pair `Why Buy (Catalyst)` with `Watch Out (Risks)` in a balanced 2-column grid.

---

## 4. On-Demand 5-Point Read-Only UI Audit Runner

When asked to **audit** a `.vue` or `.astro` view with `laws-of-ux`:
1. **Stay 100% Read-Only:** Inspect the target file(s) with `read_file` — never modify `.vue`/`.astro` files or run local `astro build` during an audit.
2. **Evaluate All 5 Buckets:** Score each bucket `PASS`, `WARN`, or `FAIL` (`[LINT]` violations with user-facing friction = `FAIL`; documented exceptions like `SalesImportTray.vue` or `[REVIEW]` heuristics = `WARN`).
3. **Return Concise Findings (`<= 25` lines):**

```text
UX AUDIT SUMMARY: <Component / Route> — Score: X/5 Buckets Passing
1. Decision & Choice: PASS | WARN | FAIL
2. Visual Grouping & Layout: PASS | WARN | FAIL
3. Memory & Cognitive Load: PASS | WARN | FAIL
4. Speed, Momentum & Focus: PASS | WARN | FAIL
5. Perception & Emotional Impression: PASS | WARN | FAIL

FINDINGS:
- [FAIL | Bucket 1 · Fitts's Law [LINT]] src/components/.../Example.vue:42 — Mobile pill uses `btn-xs` (24px < 44px floor); use `h-11 md:h-auto` or `btn-lg md:btn-xs`.
- [WARN | Bucket 2 · Proximity [LINT]] src/components/.../Example.vue:68 — Outer section stack (`space-y-3` = 12px) is < 2x field gap (`gap-2.5` = 10px); widen sections to `space-y-5 sm:space-y-6`.
- [FAIL | Bucket 3 · Postel's Law [LINT]] src/components/.../Example.vue:111 — Email submitted un-normalized; apply `.trim().toLowerCase()` (never trim password).
```

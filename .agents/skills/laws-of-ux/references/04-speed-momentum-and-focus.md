# Bucket 4: Speed, Momentum & Focus (`6 Laws`)

> **Parent Skill:** [`.agents/skills/laws-of-ux/SKILL.md`](../SKILL.md) • **Sibling Authorities:** [`src/composables/useLoader.ts`](src/composables/useLoader.ts) & [`AGENTS.md`](AGENTS.md) Law 6

---

## 4.1 Doherty Threshold (`<= 400ms`) `[LINT]` — Layered onto the 3-Bucket Loader Standard
*Productivity soars when every user action produces visible system feedback within `<= 400ms` without jarring layout shifts or screen strobing.*

### Layering onto `src/composables/useLoader.ts` (Zero Bucket Contradictions)
Do **not** invent custom timer scales; guarantee `<= 400ms` first-response feedback on top of the canonical 3-bucket contract:

1. **Immediate Tactile Ack (`0 – 100ms`):**
   - Global CSS `.btn:active { transform: scale(0.97) }` (`src/styles/global.css`) + synchronous button disable (`isSubmitting = true`) + inline `loading-spinner loading-xs` on click.
2. **Bucket 1 (`< 1s` Micro-Actions):**
   - **Optimistic UI Scope Guard:** Apply optimistic state updates **strictly to reversible, non-money UI toggles** (role-lens switch, filter chip, star cover photo, collapse section), rolling back with `addToast(err.message, 'error')` on failure.
   - **Law 6 Money/Stock Exception:** Money-moving or inventory-depleting commits (Ricochet Sales Commit, Month Lock, Bulk Split/Delete) **MUST NEVER fake optimistic completion** — they strictly follow **Law 6** (Layer 1 synchronous button lock + chunked 25-row progress ➔ Layer 2 manifest `committed` transition ➔ Layer 3 server ticket deduplication).
   - *Note:* The `150ms` anti-strobe debounce in `useLoader.ts` applies strictly to the global `showLoader()` overlay so fast operations never flash full-screen berries.
3. **Bucket 2 (`1s – 3s` Scoped / Initial Data Hydration):**
   - Track card/row fetches via `setScopedLoading(key, true)` / `isScopedLoading(key)`.
   - Render **geometry-matched DaisyUI v5 `.skeleton` blocks** matching the height of `<KpiStatGrid>` cards or table rows instead of collapsing a `600px` container down to a single centered `loading-spinner` (eliminates Cumulative Layout Shift).
4. **Bucket 3 (`> 3s` Heavy AI Vision, Auto-Crop, Multi-Page Sync):**
   - Trigger `HuckleberryLoader.vue` via `showLoader(msg, { step, progress, cancelable: true, onCancel })` wired to an `AbortController` (`useLoader.ts` automatically unlocks the `Cancel` button at `5s`).

```html
<!-- ❌ WARN: Collapses dashboard/table height during initial load, causing layout jump -->
<div v-if="loading" class="flex justify-center py-16">
  <span class="loading loading-spinner loading-lg text-primary"></span>
</div>

<!-- ✅ PASS: Preserves approximate KPI + card geometry with DaisyUI v5 skeletons -->
<div v-if="loading" class="space-y-5" aria-busy="true" aria-label="Loading view">
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
    <div v-for="n in 4" :key="n" class="skeleton h-24 w-full rounded-xl"></div>
  </div>
  <div class="skeleton h-64 w-full rounded-2xl"></div>
</div>
```

---

## 4.2 Flow `[LINT]` — Uninterrupted Operational Continuity
*Keep resellers in continuous, distraction-free focus while scanning, pricing, and verifying booth stock.*

### Concrete Checks
- **Zero Native Blocking Dialogs:** `window.alert()`, `window.confirm()`, and `window.prompt()` are strictly banned (`validate-templates.mjs` §11B). Use `addToast()` (`../../stores/toast`) and `askConfirm()` (`../../stores/confirm`).
- **Context-Preserving Inspection:** Opening `ItemDrawer` or `SlideOverDrawer` from a filtered/paginated table or manifest verify list MUST preserve scroll position, active filter chips, and verified checkoffs on close.
- **Selection Tray Mutual Exclusivity:** Never mount two competing bottom selection trays simultaneously (`LocationManifestTray` auto-pauses `DropcastStagingTray`, and vice versa — `ux-design-system-taxonomy` §8A).
- **Bottom Dock vs. Toast Clearance (`WARN` Check):** Flag fixed bottom-right notifications (`ToastContainer.vue`) or floating scroll pills if positioned where they cover `<BottomActionDock>` `#right` CTAs (`mobile-ux-standards` §4 specifies `bottom-22` to `bottom-24` for floating pills).

---

## 4.3 Goal-Gradient Effect `[REVIEW]` — Visible Momentum Toward Completion
*Motivation and speed increase as users see measurable progress toward finishing a batch.*

### Concrete Checks
- Display explicit numerator/denominator counters on multi-item workflows:
  - Booth Verify Checklist: `14 / 18 Verified` + progress bar.
  - Chunked Sales/Item Commits: `Committing batch (25 / 63)...`.
  - Co-op Commons Breakeven: Rent coverage progress bar toward dynamic `monthlyRent`.

---

## 4.4 Zeigarnik Effect `[REVIEW]` — Clear Unfinished-Loop Signals & Clean Pause
*People remember uncompleted tasks better than completed ones — surface open loops clearly, and silence them when intentionally paused or finished.*

### Concrete Checks
- **Active Open-Loop Pills:** Render `📦 Staged: {{ locationMeta.shortName }}` pills in the catalog table for items inside an active/paused draft manifest, `⚠️ N pending labor log(s)` banners on unlocked settlement months, and unread cross-hat alert count badges (`badge-2xs badge-warning`) on inactive role-lens buttons (`DashboardShell.vue`).
- **Pause = Clean Hide:** When a user explicitly pauses an active manifest, hide the bottom tracker bar from the main viewport and let them resume calmly from `/warehouse` (`ux-design-system-taxonomy` §6.2).

---

## 4.5 Pareto Principle (`80/20` Rule) `[REVIEW]` — Frame-0 Priority for Daily Drivers
*80% of operational throughput comes from 20% of controls.*

### Concrete Checks
- Keep high-frequency controls (`Omnibox Search + Barcode Scan`, `Status Pipeline Pills`, `Table/Grid Switcher`, and the `BottomActionDock` CPA) visible immediately without opening menus.
- Tuck 20% setup/recovery utilities (`Manual CSV & Demo`, `Hardware Label Calibration /labels/test`, `Legacy Log Migration`) into toolbar-triggered drawers or dedicated studio routes.

---

## 4.6 Parkinson's Law `[REVIEW]` — Time-Bounded Quick Intake
*Work expands to fill the complexity of the form presented — keep fast-path intake tight and pre-filled.*

### Concrete Checks
- Pre-populate smart defaults on intake surfaces (`storageLocation` defaulting to canonical `HG` backstock per Golden Rule #1, active Buy Tracker sticky across `⚡ Quick Scout` scans, and 1-pass `🕸️ Auction Sweep` triage capping sleeper vision thumbnails so grid triage finishes in seconds).

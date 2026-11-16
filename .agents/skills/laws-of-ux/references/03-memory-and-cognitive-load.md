# Bucket 3: Memory & Cognitive Load (`7 Laws`)

> **Parent Skill:** [`.agents/skills/laws-of-ux/SKILL.md`](../SKILL.md) • **Sibling Authorities:** [`ux-design-system-taxonomy`](../../ux-design-system-taxonomy/SKILL.md) & [`vue-component-standards`](../../vue-component-standards/SKILL.md)

---

## 3.1 Chunking `[LINT]` — Scannable Data & Number Formatting
*Breaking dense strings and metrics into structured, meaningful groups makes scanning fast and error-free.*

### Concrete Checks
- **Currency & Delta Precision:** Format all currency amounts, spreads, and profit deltas to 2 decimals (`.toFixed(2)` or standard `Intl.NumberFormat`) so floating-point artifacts like `+$46.370000000000005` never reach the DOM.
- **Structured Identifiers & Dates:** Render barcodes in `font-mono` pills (`HUCK-1498`, `PDXGL-0157`) and format `YYYY-MM` month keys exclusively via `monthKeyToLabel` / `calendarMonthKeyFromDateString` (`src/lib/salesBucketing.ts`, Law 7 — never `Date#getMonth()`).
- **Card Grid Density Cap:** Actionable multi-badge/multi-button cards use at most `xl:grid-cols-3` (or `.rc-card-grid` for compact SKU thumbnails) so pills never crush or wrap awkwardly.

---

## 3.2 Miller's Law (`7±2`) `[LINT]` — Bounded KPI Strips & Navigation
*The average person can hold roughly `7 (±2)` items in immediate working focus; summary strips should stay even leaner (`2–4`).*

### Concrete Checks
- **Canonical `<KpiStatGrid>`:** Render top KPI summary strips via [`KpiStatGrid.vue`](file:///c:/Users/15034/Projects/ResaleCommand/src/components/common/KpiStatGrid.vue) (`:columns="2 | 3 | 4"`) rather than sprawling 6–8 stat boxes across the top of a page.
- **5-Pillar Navigation:** Keep primary top-bar navigation bounded to `<= 5` pillars (`Navbar.vue`) and drawer tab bars to `<= 4` tabs.

---

## 3.3 Working Memory `[LINT]` — Recognition Over Recall Across Surfaces
*Never force the user to remember an item's price, SKU, or current quantity after opening an overlay.*

### Concrete Checks
- **Pinned Target Banner in Drawers:** Every match or inspector drawer (`LocationSyncView.vue`, `SalesImporter.vue`, `CoopSweatEquityDrawer.vue`) MUST pin the target row's key identity (thumbnail, untruncated title, booth SKU / UPC, and price/hours) at the top of the drawer.
- **Live `"Before ➔ After"` Financial Preview:** Any restock, lot split, combine, or payout-lock confirmation MUST display a live `"Current ➔ + Delta ➔ New Total"` summary before the Confirm button; when required input is missing, hide placeholder zeros and prompt for selection (`ux-design-system-taxonomy` §8).

---

## 3.4 Cognitive Load `[REVIEW]` — Progressive Disclosure & Lazy Tabs
*Minimize extraneous mental effort by showing only what the active role and step require.*

### Concrete Checks
- **Role-Lens Progressive Disclosure:** Default multi-hat dashboards to a focused single-hat lens (`curator`, `promoter`, `enabler`, `founder`, `consignor`) with opt-in `✨ All Hats`, collapsing secondary sections on non-lead hats via `useCollapsibleSection` (`ux-design-system-taxonomy` §10).
- **Lazy-Mounted Heavy Drawer Tabs:** Heavy secondary tabs inside `ItemDrawer` (`Verify`, `Playbook` / `Lot`) MUST mount lazily with `v-if` (zero background network/compute cost until clicked), while the primary `Listing Details` form tab uses `v-show` to preserve unsaved input state.

---

## 3.5 Postel's Law `[LINT]` — Be Liberal in What You Accept, Conservative in What You Send
*Accept human-typed variations, mobile keyboard quirks, and pasted strings gracefully; normalize into strict canonical schemas before API/Appwrite writes.*

### Concrete Vue 3.5 Input Normalization Rules
1. **Emails (`.trim().toLowerCase()`):**
   - Always pair email inputs with `type="email" autocomplete="email" autocapitalize="none" spellcheck="false"`.
   - Normalize `email.value.trim().toLowerCase()` before calling `auth.login()`, signup, or API endpoints so trailing iOS keyboard spaces never cause false auth rejections.
2. **Passwords (STRICT NO-TRIM INVARIANT):**
   - **NEVER** call `.trim()` or `.toLowerCase()` on password inputs — leading/trailing spaces and casing may be intentional user characters. Pair with `type="password"` and `autocomplete="current-password"` or `"new-password"`.
3. **Prices & Currency (`inputmode="decimal"` + `parsePriceValue()`):**
   - Prefer `type="text" inputmode="decimal"` over `type="number"` (avoids accidental trackpad/scroll-wheel value mutation and scientific notation `e` input).
   - Parse user-entered or pasted currency strings (`"$24.50"`, `"1,200.00"`) via `parsePriceValue()` from `src/lib/lot-strategy.ts` (enforced by `validate-templates.mjs` §3 — never strip characters with raw `.replace(/[^0-9.-]/g, '')` on price ranges).
4. **Barcodes, Handles & URLs:**
   - Normalize scanned/typed partner tags (`huck-1498` or whitespace-padded scanner bursts ➔ `HUCK-1498`), and accept either `@handle` or full `https://...` profile links on social inputs.
5. **Accessible Label Binding:**
   - Bind `<label for="...">` to `<input id="...">` (or wrap the control inside `<label>`) so tapping the label focuses the input.

---

## 3.6 Tesler's Law `[REVIEW]` — Conservation of Complexity
*Every domain has irreducible complexity (pos commissions, 4-gate waterfalls, 3 Ricochet CSV formats); shift that burden from the user into composables and server helpers.*

### Concrete Checks
- **Auto-Resolved Venue Math:** Resolve commission rates, monthly rent, `usesRicochet`, and manifest document IDs automatically from `src/lib/warehouses.ts` — never ask the user to type venue fee percentages.
- **Self-Diagnosing File Intake:** Auto-detect whether a dropped CSV is `Products-*.csv` vs. `Payouts *.csv` vs. `Payout History *.csv` (`SalesImportTray.vue` / `parseRicochetExportCsv`) and display a plain-English routing hint if the user drops a catalog file into Sales Import.
- **Zero Manual Browser Plumbing:** Deliver 1-drag Live-Loader bookmarklets (`/scripts/rico-bookmarklet.js?location=${code}&t=...`) rather than asking users to paste console snippets or edit JSON.

---

## 3.7 Paradox of the Active User `[LINT]` — Actionable Empty States Over Manuals
*Users never read long inline instruction manuals; they start clicking immediately.*

### Concrete Checks
- **Ban Inline Workflow Explainer Cards:** Never place multi-paragraph "How This Page Works" cards above operational tables (`validate-templates.mjs` §11 enforces this on `SalesImporter.vue`).
- **Self-Evident Empty States:** Empty tables and photo dropzones (`PhotoGalleryManager.vue`, `InventoryTableView.vue`) must state what is empty in `<= 1` short line and offer an immediate 1-click action (`Reset Filters`, `📷 Add Photo with Camera`). Store deep policy/tax documentation in Astro Markdown Content Collections (`src/content/**`) surfaced via `<SlideOverDrawer>`.

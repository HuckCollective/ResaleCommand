# Bucket 5: Perception & Emotional Impression (`4 Laws`)

> **Parent Skill:** [`.agents/skills/laws-of-ux/SKILL.md`](../SKILL.md) • **Sibling Authorities:** [`daisyui`](../../daisyui/SKILL.md), [`resale-booth-sync`](../../resale-booth-sync/SKILL.md) & [`secondary-market-appraisal-and-valuation`](../../secondary-market-appraisal-and-valuation/SKILL.md)

---

## 5.1 Aesthetic-Usability Effect `[LINT]` — Craft Polish Builds Operational Trust
*Users perceive crisp, visually consistent interfaces as more accurate and trustworthy — especially when handling co-op payouts and inventory valuations.*

### Concrete Tailwind v4, DaisyUI v5 & Astro Checks
- **29-Token Theme Integrity (`validate-templates.mjs` §12A):** Custom themes in `src/styles/theme.css` MUST define `--border: 1px`, `--size-selector: 0.25rem`, `--size-field: 0.25rem`, `--depth: 1`, `--noise: 0`, all 3 `--radius-*` tokens, and all 20 semantic color tokens so badge/button `calc()` padding never collapses.
- **Unbroken Badge & Button Contrast:** Always pair semantic backgrounds with explicit `*-content` tokens (`badge-primary text-primary-content`, `btn-success text-success-content font-black`), enforce `whitespace-nowrap shrink-0` on badges, and **never** apply `p-0` or `px-0` to `.badge` (§12F).
- **Zero Broken Thumbnails:** Every item table row mounts [`ItemThumbnail.vue`](file:///c:/Users/15034/Projects/ResaleCommand/src/components/common/ItemThumbnail.vue) (`src/components/common/ItemThumbnail.vue`), and every Appwrite `<img :src="getAssetUrl(id, ...)">` attaches an `@error` handler retrying raw `/view` (`getAssetUrl(id, { preview: false })`) before advancing through `galleryImageIds`.
- **Zero Frame-0 Flash:** Preserve synchronous `<head>` `data-theme` restoration (`Layout.astro`) and `initialAuthenticated={hasSessionHint}` (`SessionRouter.astro` + `Navbar.vue`) so signed-in members never see a guest-to-member layout jump.

---

## 5.2 Peak-End Rule `[LINT]` — Reassurance at the Peak, Clarity at the End
*People judge an experience largely by how they felt at its most intense moment (Peak) and at its conclusion (End).*

### Concrete Checks
- **At the Peak (High-Stakes Money, Sync, or Tag Actions):**
  - **Pre-Flight Transparency:** Always render a visible **Pre-Flight Queue Preview** before batch writes (`Law #2`: exact `N` blank items `0EJ... | Blank ➔ HUCK-XXXX` before `🚀 Fill Missing`; live `"Before ➔ After"` payout/snapshot summary before `🔒 Lock Month`).
  - **Actionable Error Recovery:** If an Appwrite batch or child component fails, unlock the UI and surface the exact human-readable reason + a `Reload` / `Retry` action (`InventoryViewHub.vue` `onErrorCaptured` pattern) — never fail silently or dump raw stack traces.
- **At the End (Workflow Closure):**
  - Transition committed manifests cleanly to a permanent affirmative state (`✅ Already Synced ({{ lockedItemCount }} items committed)`, or `🔒 Locked · snapshot #xxxxxxxx`), hiding the Commit button so the user knows with 100% certainty the job is done (`Law 6` Layer 2).

---

## 5.3 Serial Position Effect `[LINT]` — First & Final Slot Anchoring
*Items at the beginning (Primacy) and end (Recency) of a sequence are scanned fastest and remembered best.*

### Concrete Checks
- **Data Tables:** Anchor primary visual identity (`Checkbox` + `<ItemThumbnail>` + `Item Title / UPC`) in the **first** columns and net financial outcome (`Net Payout` / `ROI %`) + row action trigger in the **final** right-aligned columns.
- **Lot Decomposition Lists:** Sort extracted components descending by Boutique value with the **`#1 👑 Hero Anchor`** guaranteed at index `0` (`ux-design-system-taxonomy` §8E).
- **Bottom Docks & Drawer Footers:** Anchor live status/telemetry in `#left` (start) and the single Contextual Primary Action in `#right` / footer end (`justify-end`), with `Cancel`/`Close` placed immediately to the left of the primary submit button.

---

## 5.4 Cognitive Bias `[REVIEW]` — Anti-Anchoring & Honest Financial Framing
*Protect curators and co-op stewards from MSRP anchoring, optimism bias, and accidental tag overwrites.*

### Concrete Checks
- **Single Source of Numerical Truth (Zero Pricing Drift):** On `ScoutView.vue` and `ItemLotTab.vue`, lock the Top Bidding Bar (`Est. Resale`), Channel Comparison (`Gross Tag Price`), and `Target Resale` input to the exact same `.toFixed(2)` calculation (sum of child Boutique values on multi-item lots).
- **Balanced Catalyst vs. Risk Framing:** Render `Why Buy (Catalyst)` and `Watch Out (Risks)` side-by-side in an equal-weight `grid-cols-1 md:grid-cols-2` layout rather than burying condition/shipping risks below the fold.
- **Cash-Cleared Comps Over Retail MSRP:** Frame valuations around realistic secondary cash-cleared comps net of venue/platform fees (`secondary-market-appraisal-and-valuation`) and honor **Physical Sticker Wins** (`1-click 🏷️ Adopt Booth Tag` on `MISMATCH_UPC` rather than nudging users toward destructive overwrites).

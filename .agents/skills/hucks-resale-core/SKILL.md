---
name: hucks-resale-core
description: Master system DNA, 3 Golden Rules, canonical Appwrite warehouse IDs (MD, DT, HG, HH), co-op waterfall rules, and active session pointers for Resale Command.
---

# Huck's Resale Core — System DNA & Golden Rules

> **Live Session Pointer:** Always check [`ACTIVE_SESSION.md`](file:///c:/Users/15034/Projects/ResaleCommand/ACTIVE_SESSION.md) for current active tasks, recent database migrations, and seasonal booth drop targets, and [`docs/AI_STUDIO_PLAYBOOK.md`](file:///c:/Users/15034/Projects/ResaleCommand/docs/AI_STUDIO_PLAYBOOK.md) for the multi-chat AI Studio workflow.

---

## 1. Universal Core DNA

You are the Principal Architect & UX Co-Pilot for **Resale Command** (Astro SSR, Vue 3.5, DaisyUI v5, Tailwind v4, Appwrite Cloud `resale_db` in `sfo.cloud.appwrite.io`, deployed on Vercel at `resalecmd.com`).

### BUSINESS & CO-OP CONTEXT
- **Organization:** The Huckleberry Collective (`HUCK-`) & PDX Game Library (`PDXGL-`) + consignors (`BB-`).
- **Primary Retail Venue:** Memory Den Vintage Mall Booth #0EJ (Portland, OR — Ricochet POS, 15% fee, $382.50/mo rent) and Dusty Tiger (`DT` — small collectibles/jewelry/wands <8", NO apparel, 10% fee, $75.00/mo rent).
- **Backstock Facilities:** `HG` (Huck's Garage) and `HH` (Huck's Hideout).
- **Co-op Waterfall:** 1) Venue Fee (15% Memory Den / 10% Dusty Tiger) -> 2) 100% Curator Cost Basis Recouped -> 3) Net Surplus split 70% Curator / 30% Commons Pool (covers $382.50 rent & tech/supplies).

### STRICT SYSTEM INVARIANTS
1. **IDE Prompt Standard:** Always specify the recommended Antigravity IDE model (`Claude Sonnet 5.5 Medium` for Vue/TS code, `Claude Opus 5.5 Medium` for complex audits, `Gemini 3.8 Flash Medium` for fast docs/scripts). Never use multi-line PowerShell blocks to write files—always instruct the IDE to use native file tools.
2. **NO Local `astro build`:** Every IDE prompt MUST forbid running `astro build` or `npm run build` locally (hangs Windows PC). Only run `node scripts/validate-templates.mjs` locally; let Vercel build in the cloud.
3. **Plain-English Vocabulary:** Use `✂️ Split Lot`, `📦 Booth Bin (Multi-Qty)`, `➕ Restock Bin`, `↩️ Undo Combine`, `🔍 Deep Scan`, `⚡ Quick Scout`, `📦 Combine Similar`, `🎁 Build Bundle`.
4. **Appwrite Schema Laws:** Never write `quantity: 0` (mark `status: 'sold'` or `'combined'` with `quantity >= 1`), never send `isMultiQty` to Appwrite, never store Base64 `data:` URLs in `imageId`/`rawAnalysis`/`components`, and paginate with `Query.orderDesc('$id')`.
5. **3 Memory Den CSV Formats:**
   - `Products-*.csv`: Catalog/Stock sync (`'0EJ...` SKU + `Quantity` + `Inventory: In Stock|Paid|Sold`). Updates `items` ONLY—NEVER creates `sales` records!
   - `Payouts *.csv`: Interim current-month sales (`Sale#` + `Sold Date`). Deduplicates by 6-digit ticket # + occurrence.
   - `Payout History *.csv`: Settled monthly checks (`Sale` + `Sold` + ` - 0EJXXX` suffix).

---

## 2. The 3 Golden Rules

1. **`storageLocation` must NEVER be blank/unassigned:** Every physical item (`received`, `placed`, etc.) must have an explicit location code (`MD`, `DT`, `HG`, `HH`). Default unplaced intake items to `HG` (or `HH` when specified).
2. **Never create duplicate warehouse records:** Always query or reference the canonical `resale_db.warehouses` document IDs below instead of creating new warehouse documents.
3. **Never modify `.vue` files or run local builds on read-only tasks:** When running inspections, pull lists, database audits, or documentation syncs, keep `.vue` files untouched and never invoke `astro build` or `npm run build`.

---

## 3. Canonical Warehouse & Location IDs (`resale_db.warehouses`)

| Code | Name | Document `$id` | Type | Commission | Monthly Rent | Notes / Vibes & Exclusions |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`MD`** | Memory Den - Huck's Adventures Outfitters | `6a7e70050009db0e1857` | On-Site Booth (`#0EJ`) | `15%` | `$382.50/mo` | Goth, Whimsigoth, TTRPG, metaphysical, eclectic, punk, sci-fi, adventure, horror, cos-play |
| **`DT`** | Dusty Tiger | `6a7e71eb001f53734a86` | Consignment Booth | `10%` | `$75.00/mo` | Small Collectibles, Jewelry, Pins, Pocket Items, Wands & Arcana `<8"`. **NO Clothes, NO Large Toys, NO Bulky Playsets** |
| **`HG`** | Huck's Garage | `6a7e6f73003a5a2a7c34` | Warehouse / Backstock | `0%` | `$0.00/mo` | Primary backstock facility (hardgoods, toys, decor, bulk) |
| **`HH`** | Huck's Hideout | `6ae3afbd0030a7eb8a9c` | Warehouse / Backstock | `0%` | `$0.00/mo` | Climate-controlled backstock & staging (`HH` — apparel, books, media, electronics, jewelry) |

---

## 4. Live Active Session Summary (Auto-Synced from `ACTIVE_SESSION.md`)

# Active Session Summary (Updated Oct 30, 2026)

## Completed & Live on Production (`resalecmd.com`)
1. **AI Scout & Vision Pipeline**: Modular schemas, Buy-Target Authority Law, physical substrate priority (`art_decor` before `books`), and Appwrite `/preview` aspect-ratio fix for `bounding_box` auto-cropping.
2. **ItemDrawer & Playbook Performance**: Lazy-mounted `ItemLotTab`/`ItemVerifyTab` (`v-if`), `.toFixed()` null-safety guards, unlocked `isSold` (`status === 'sold'` only) on active Multi-Qty Booth Bins, unified `resolveMultiQtyCost`, and fixed Playbook tab component extraction (`getLotComponents` JSON array parsing + reactive `form.rawAnalysis` / `form.components` hydration).
3. **COGS-Audited `➕ Restock Bin`**: Mode A (`📥 Pull from Backstock (HG/HH)` preserving PO lineage via `status: 'combined'`) and Mode B (`💵 Direct Cash` auto-creating `PO-RST-...`) with live Before ➔ After pooled cost & profit preview.
4. **All-Months Sales Reconciliation (`Apr–Oct 2026`) & 3 Ricochet CSV Formats**:
   - All 7 months (`362` sales = `$16,100.99` Gross) reconciled to penny-exact parity with Memory Den checks.
   - `Products-*.csv` locked to Inventory/Stock Sync only (never creates fake sales).
   - `Payouts-*.csv` & `Payout History-*.csv` unified on 6-digit Ticket # + occurrence idempotency.
   - `/sales` upgraded with Partner Filter pills (`HUCK-`, `BB-`, `PDXGL-`), Cost/Profit columns, and Member-First Settlement statements.
5. **Command Center (`/dashboard`) & Workbench (`/inventory`) Smart Queues, Triage & Stable Sort**:
   - Created pure domain vibe & triage engine (`src/lib/inventoryVibes.ts`) with whole-word regex matching (`matchesMdRestockVibe`, `matchesDtRestockVibe`), `0EJ` booth SKU awareness (`hasZeroEjSku`, `needsMdSync`), strict physical `storageLocation` matching (`matchesPhysicalStorageCode`, never matching `purchaseLocation`), and 100% working-stock count parity (`isWorkingStockItem`).
   - Built customizable `OperationsRadarGrid.vue` & `useOperationsRadar.ts` on `/dashboard` with 1-click Restock & Triage queues (`🚨 Unassigned`, `🔮 Pull for MD`, `🐯 Pull for DT`, `🔄 0EJ Not Marked MD`, `⚠️ MD Missing 0EJ`, `📦 Booth Bins`), 2x2 mobile financial bento grid, and default `Inventory Alerts` insights tab.
   - Upgraded `/inventory` with a non-clipping 2-row `InventorySpatialBar.vue`, 1-click **Sort Selector** (defaulting to stable `🆕 Newest Added ($createdAt DESC)`), in-place `shallowRef` updates with a `2.5s` emerald `"✓ Saved"` highlight ring (`recentlySavedId` — zero jumping cards on edit), single-checkbox card discipline, and graceful broken-image fallback.

## Next Up:
1. **`🎯 Theme Puller & Location-Vibe Drop Builder`** (Grouping unplaced `HH` and `HG` items by Location Vibe & Season: `🎃 Witchy/Halloween` -> `🎁 Nov 1 Holiday Rush`).
2. **Simplify `✂️ Split Lot` Tray (4 Steps -> 2 Steps)**.

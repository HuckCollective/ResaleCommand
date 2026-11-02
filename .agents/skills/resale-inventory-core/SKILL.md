---
name: resale-inventory-core
description: Master lifecycle rules, status invariants, multi-org UPC/SKU sales bucketing, and scan-routing standards for Resale Command. Use when creating, receiving, reconciling, or scanning inventory items.
---

# Resale Inventory Core Standards & Lifecycle Engine

This skill documents the master architectural invariants, status lifecycle stages, multi-org barcode bucketing, and AI scan routing standards for Resale Command.

---

## 1. The Canonical 5-Stage Resale Lifecycle

Every inventory item in Resale Command transitions through a strict 5-stage physical lifecycle:

```
[tracked]  -->  [acquired]  -->  [received]  -->  [placed]  -->  [sold]
(Pre-Buy)      (In-Transit)     (HG Backstock)    (Booth/Shelf)    (Terminal)
                                      |
                           [combined] / [deconstructed]
                                  (Lineage)
```

| Canonical Status | Stage Name | Physical Meaning | Storage Location Default | Available AI Engine |
| :--- | :--- | :--- | :--- | :--- |
| `tracked` | **1. Pre-Buy / Watch** | Unacquired items in online auction watchlists, shopping cart, or scout drafts. | `null` / URL | **Speed Scout AI** (`/api/identify-item`) |
| `acquired` | **2. In-Transit / Won** | Auction won, online order paid, or PO finalized. Awaiting delivery. | `In-Transit` | **Speed Scout AI** |
| `received` | **3. Backstock Intake** | Physically unboxed, inspected, on-hand at warehouse backstock. | **`HG`** (Huck's Garage) | **AI Deep Scan** (`src/lib/ai-inspection.ts`) |
| `placed` | **4. Retail Active** | Priced, barcoded with physical thermal tag, placed in retail booth or live e-commerce. | **`MD`**, **`DT`**, Booth # | **AI Deep Scan** |
| `sold` | **5. Terminal Sale** | POS sale completed (Ricochet, Cash, Online) and payout recorded. | Historical | Post-sale Analytics |

### Lineage States:
- `combined`: Absorbed into a multi-item bundle, master lot, or mystery pack. Child status is set to 'combined' with parentLotId pointing to the parent lot (never write quantity: 0 in Appwrite; keep quantity >= 1); parent lot holds the combined cost basis and retail price.
- `deconstructed`: Split parent lot whose individual components have been cataloged and extracted into standalone active inventory items.

---

## 2. Status Invariants & Compatibility Laws

### A. The Zero Data Loss Normalization Law
Legacy documents in Appwrite may contain legacy status synonyms (`'in-stock'`, `'in_stock'`, `'active'`, `'staged'`).
- The database reader MUST normalize these using `normalizeInventoryStatus()`:
  - `['in-stock', 'in_stock', 'instock', 'active', 'staged']` $\longrightarrow$ **`received`**
  - `['scouted', 'draft', 'pending_bid', 'watching']` $\longrightarrow$ **`tracked`**
  - `['won', 'purchased', 'ordered']` $\longrightarrow$ **`acquired`**
  - `['listed']` $\longrightarrow$ **`placed`**
- All writes from purchase intake, unboxing wizards, and trip finishers MUST explicitly save the canonical status **`received`**.

### B. The Storage Location Invariant
- Any item received into physical inventory without an explicit location MUST automatically be assigned **`HG`** (Huck's Garage Backstock).
- Never write `undefined` or `null` for `storageLocation` when transitioning an item to `received` or `placed`.

### C. The Auction Alert Suppression Law
- An item that has been `acquired`, `received`, `placed`, or `sold` **MUST NEVER** display live bidding warnings (e.g. `🛑 STOP BIDDING (OUTBID)` or `🎯 IN PLAY: Bidding headroom`).
- Live bidding evaluation is strictly restricted to pre-acquisition items (`isLiveAuctionActive(item)` is true only if `status === 'tracked'` and `auctionStatus !== 'won'`).
- For acquired/received items that were won at auction, display a static **`🏆 Won & Received`** badge with the landed purchase cost.

### D. The AI Vision Routing Guardrail
- **Pre-Acquisition (`status === 'tracked'`)**:
  - Exclusively routed to **Speed Scout AI** (`/api/identify-item`). Deep Scan is locked to conserve tokens and prevent cluttering the database with unpurchased goods.
- **Post-Acquisition (`status === 'received' | 'placed' | 'acquired'`)**:
  - Unlocks full multi-photo **AI Deep Scan** (`src/lib/ai-inspection.ts`) and **Lot Profit Playbook** (`/api/inspect-lot`).

### E. The Storage File ID Invariant (`imageId` & `galleryImageIds`)
- **Database Schema Limit**: In Appwrite, `imageId` and elements of `galleryImageIds` are constrained to String(255).
- **Storage File IDs Only**: These fields are reserved strictly for Appwrite Storage File IDs (e.g. `660a1f...`).
- **Prohibition of Data URIs**: Under no circumstances may in-memory Data URLs (`data:image/...`), blobs, or raw strings exceeding 255 characters be written into `items` or `purchases` collections.
- **Pre-Save Protocol**: All inventory saving (direct, scout, batch intake, or Buy Tracker) must route images through Storage first and defensively sanitize `imageId` and `galleryImageIds` prior to database document creation.

### F. Zero Premature Database Splitting in `/scout` (Pre-Buy Lot Conservation)
- `/scout` must **never** split multi-item lots into multiple database records during scouting or intake.
- In `/scout`, the interface displays the read-only **Bundle Components** list and the **`⚡ Recommended Play`** badge (`Split vs. Bundle`).
- The intake item is saved strictly as **1 Master Lot document** with child `components` safely persisted in metadata (`bundle_components` / `lot_items`).
- All physical deconstruction and database splitting (`⚡ Deconstruct Lot`) is strictly delegated to [`ItemDrawer.vue`](file:///c:/Users/15034/Projects/ResaleCommand/src/components/common/ItemDrawer.vue) once the inventory has been physically acquired, unboxed, and received.

---

## 3. Multi-Org UPC & Sales Bucketing Standards

Resale Command operates across multiple vendor and partner organizations. Barcode formats strictly follow `{ORG_PREFIX}-{NUMBER}`:
- **`HUCK-`**: Huck Collective primary inventory (e.g. `HUCK-1460`).
- **`PDXGL-`**: PDX Game Library & curated tabletop partners (e.g. `PDXGL-0024`).

### Payout & Reconciliation Bucketing Rules:
When processing sales reports from Ricochet POS, Memory Den, or external retail venues:
1. **Primary Org Bucket (`HUCK-`)**: All line items with `HUCK-` barcodes or mapped to Huck items.
2. **Partner Org Buckets (`PDXGL-`, etc.)**: Explicitly partitioned partner sales with distinct commission and payout ledgers.
3. **Unassigned / Store SKU Bucket**: Items with third-party store barcodes (e.g. `0EJ08G`), raw numeric UPCs, or missing tags.
   - **Rule**: NEVER drop, ignore, or silently skip unassigned sales rows (`nonOrgSkipped`).
   - All unassigned rows must appear in an Unassigned Review Tray with a **1-click "Assign to HUCK-" or "Assign to Partner"** button to auto-mint the next sequential barcode and link the sale.

---

## 4. Engineering Module Architecture

The inventory domain is modularized into focused libraries with `inventory.ts` serving as the central backwards-compatible facade:

```
src/lib/
├── inventoryStatus.ts   <-- Lifecycle constants, normalizer, auction active check, scan guards
├── inventoryUpc.ts      <-- Multi-org prefix registry, auto-UPC generation, barcode validation
├── salesBucketing.ts    <-- Multi-org CSV sales partitioning & reconciliation engine
└── inventory.ts         <-- Central facade re-exporting all modules with zero breaking changes
```

---

## 5. Single-Unit SKU Uniqueness & Terminal Sale Anti-Duplication Law

### The Cardinal Resale Rule:
In secondhand, antique, vintage, and booth inventory:
**1 SKU = 1 Unique Physical Unit = AT MOST 1 Realized Sale** (Unless explicitly flagged with `isMultiQty: true` or `quantity > 1`).

1. **Terminal State Immutability**:
   - Once an inventory item transitions to `status: 'sold'`, it has reached its terminal lifecycle stage.
   - It can **NEVER be sold again**.
2. **Sales Ledger Deduplication**:
   - Any sales ledger, co-op settlement calculator, or payout reconciler MUST enforce single-sale uniqueness per SKU.
   - If multiple sale documents in the database reference the same single-quantity SKU, the system must deduplicate them and count only the single canonical sale.
3. **Importer Idempotency**:
   - Payout CSV importers and reconciliation tools must check existing sales and sold items by Ticket # and SKU before creating records.
   - If a SKU or Ticket has already been committed, subsequent re-imports or batch runs must skip creating duplicate records.
4. **Auto-Create Inventory Guard**:
   - When auto-creating items from sales rows, the system must first check if an inventory item with that `locationSku` already exists before generating a new record. Zero duplicate inventory documents may be created.
5. **Multi-Quantity Batch Stock & Appwrite Schema Law**:
   - Multi-quantity items (batch stock, $10 book packs `0EJ0F9`, felt hats `0EJ0DC`, stickers) can legitimately sell across distinct tickets.
   - **Appwrite Schema Law**: In Appwrite's `items` collection, the supported integer attribute is `quantity`, NOT `isMultiQty`. NEVER send `isMultiQty` in document payloads to Appwrite; instead, set `quantity: isMulti ? Math.max(2, repeatCount) : 1` in Appwrite, and hydrate `isMultiQty: true` in frontend reactive memory whenever `quantity > 1`.

---

## 6. Multi-Venue Configuration & Software-Agnostic Payout Architecture

### The Anti-Hardcoding Invariant:
Never hardcode venue-specific file paths, hardcoded venue names, or static booth rents into API routes or backend services. Different antique malls, flea markets, and consignment locations use different POS software, charge different commissions, and deduct different booth rents.

### The Configurable Venue Entity (`warehouses` Collection):
All venue-specific ingestion and settlement logic must be driven dynamically by the venue's record in the `warehouses` collection:
- **`code`**: Location abbreviation (`MD`, `DT`, and backstock locations `HG` (Huck's Garage) and `HH` (Huck's Hideout)).
- **`commissionRate`**: Venue cut percentage (e.g. `0.15` for Memory Den 15%, `0.10` for Dusty Tiger 10%, `0.18` for 18% antique malls, `0.00` for own backstock/garage/events `HG`/`HH`).
- **`fixedMonthlyRent`**: Fixed monthly booth rent deducted by mall (e.g. `$382.50/mo` for Memory Den (15% commission), `$75.00/mo` (10% commission) for Dusty Tiger, `$0.00/mo` for `HG` and `HH` backstock locations).
- **`payoutDayOfMonth`**: Day of the month checks clear/disburse (e.g. `15` for Memory Den, `1` for first of month).
- **`posSoftware`**: The POS system format used by that venue:
  - `'ricochet'`: Ricochet Consignment POS (`Item, Sale, Agreed, Cost/Split, Aged Price, Discounts, Paid, Sold, Amount, Check#`).
  - `'square'`: Square / Clover retail POS (`Transaction ID, Date, Time, Gross Sales, Fees, Net Sales`).
  - `'simpleconsign'`: Traxia SimpleConsign (`Account, Inventory #, Description, Date Sold, Price, Split, Payable`).
  - `'generic_csv'`: Universal fallback with custom column mappings.




## 7. COGS-Audited Booth Bin Restocking (`➕ Restock Bin`)

Every dollar added to a Booth Bin's (multi-qty SKU) cost basis MUST be backed by an auditable Purchase Order. The `➕ Restock Bin` panel (`ItemDetailsTab.vue`, handler `restockQuantity` in `ItemDrawer.vue`) has two source modes:

### Mode A: `📥 Pull from Backstock (HG) Item` (Absorb Existing Purchase)
* Candidates are active, unplaced items (`status` `acquired` / `received`, or `storageLocation` starting with `HG`), excluding the target bin itself. Sold / combined / deconstructed / archived items never appear.
* Candidate matching uses keywords from the bin's `title`, `tagTitle`, `keywords[]`, and the first line of `conditionNotes`. With an empty search box, only items sharing at least 1 meaningful keyword are listed; otherwise show a prompt to search all HG items. Never dump the whole backstock list.
* Until a Backstock item is selected, the manual `+ Units to Add` / `+ Added Cost Basis ($)` inputs and the pooled-cost preview are hidden. Selecting an item auto-fills units (item quantity) and cost (item total cost).
* On confirm: pool quantity and cost into the bin, copy the source item's photos into the bin's `galleryImageIds`, and **NEVER delete the source item** (that breaks Purchase Order lineage). Instead update the source to `status: 'combined'` and `parentLotId: <bin.$id>`, re-sync its PO status, and log the absorbed UPC and `orderId` / `purchaseId` in the bin's restock note.

### Mode B: `💵 Direct Cash / Walk-In Buy` (New Unlogged Purchase)
* Optional `Vendor / Source` (default `"Walk-In / Thrift Restock"`).
* If `addedCostBasis > 0`, automatically create a `Received` Purchase Order (`PO-RST-<timestamp>`) via `purchasesAPI.createPurchase`, plus a `status: 'combined'` audit line item linked to the bin, and log the PO number in the restock note.

## 8. The `isSold` Unlock Rule
* An item is locked as sold **only** when `status === 'sold'`.
* **NEVER** use `|| !!item.saleId`: multi-qty bins keep a `saleId` after partial sales and must stay editable and restockable.

## 9. Multi-Qty Cost Parity (`resolveMultiQtyCost`)
* `item.cost` on multi-qty items may be saved as a per-unit or a total value. `resolveMultiQtyCost(rawCost, qty, unitResale)` (`src/composables/useItemDrawerForm.ts`) uses the same ROI heuristic as `ItemCard.vue` (`isDetectedUnitCost`) and returns `{ totalCost, unitCost }`.
* Every surface (`ItemCard`, drawer Acquisition card, Est. Margin badge, Restock preview, Playbook `ItemLotTab`) MUST use it so one item shows the same `$X/ea` (`$Y total`) everywhere. Never divide `item.cost / quantity` directly.

## 10. 1-to-1 `locationSku` (`0EJ...`) ↔ `HUCK-XXXX` Barcode Bijection & Collision Self-Healing
* **Strict 1-to-1 Bijection Law**: Every Memory Den Ricochet SKU (`0EJ...` stored in `items.locationSku`) MUST map 1-to-1 to a unique `HUCK-XXXX`, `PDXGL-XXXX`, or `BB-...` barcode (`items.upc`). Two distinct `0EJ...` SKUs may NEVER share the same `upc` (Ricochet POS rejects duplicate `upc_code` values with HTTP `422 Unprocessable Entity`).
* **Collision Self-Healing (`src/pages/api/md-verify-report.ts` & `public/ricochet-upc-sync.user.js`)**:
  - `GET /api/md-verify-report?mode=payload` enforces `EXPLICIT_COLLISION_PAIRS` (`0EJ0MQ` ➔ `HUCK-0334` / `0EJ09A` ➔ `HUCK-9716`, `0EJ0HE` ➔ `HUCK-1379` / `0EJ0MW` ➔ `HUCK-9724`, `0EJ0JJ` ➔ `HUCK-1461` / `0EJ0MY` ➔ `HUCK-9732`, `0EJ05G` ➔ `HUCK-9543` / `0EJ02D` ➔ `HUCK-9740`) and a global `usedUpcs` Set. If any secondary `0EJ...` SKU in `resale_db.items` collides on an already-claimed `upc`, the endpoint auto-allocates the next available `HUCK-XXXX`, persists it to Appwrite (`databases.updateDocument`), and returns a 100% conflict-free map.
  - In `public/ricochet-upc-sync.user.js`, `sanitizeBarcodeMap()` applies `CANONICAL_COLLISION_OVERRIDES` and `usedUpcs` deduplication, and `fetchLivePayloadFromCloud()` resets `runtime422Conflicts = {}` and prevents stale preloaded keys from re-introducing duplicate UPCs.

## 11. Appwrite Image `/preview` ➔ `/view` Fallback Invariant (`PhotoGalleryManager.vue` & `ItemCard.vue`)
* Appwrite Storage `/preview?...&output=webp` transformations can fail on certain source image formats or transformation limits even when the underlying file exists in `item_images`.
* Every `<img>` rendering an existing Appwrite Storage file ID (`PhotoGalleryManager.vue` cover & supporting thumbnails, `ItemCard.vue` card thumbnail) MUST attach an `@error` handler that:
  1. Automatically falls back from `/preview` to raw `/view` (`getAssetUrl(id, { preview: false })`).
  2. Falls back to the next valid photo ID in `galleryImageIds` (`ItemCard.vue`, `actualMainPhoto` in `PhotoGalleryManager.vue`).
  3. Surfaces a clear `"⚠️ Missing in Storage"` indicator tile in `PhotoGalleryManager.vue` only if `/view` also fails (404 in Appwrite Storage).

## 12. UX & Information Architecture Empathy Guardrails
1. **Never Ask User for Manual Browser Plumbing**:
   * Always wire solutions into the native UI (such as the Drag-and-Drop Permanent Live-Loader bookmarklet `⚡ Memory Den Sync` in `LocationSyncView.vue`) rather than asking the user to manually edit bookmark URLs or install extra extensions.
2. **No Stale Client Snapshots (Single Source of Truth)**:
   * Bookmarklets and sync tools must be thin live-loaders (`https://resalecmd.com/ricochet-upc-sync.user.js?v=' + Date.now()`) that fetch fresh code and fresh `locationSku` (`0EJ...`) ➔ `HUCK-XXXX` mappings from the cloud (`/api/md-verify-report?mode=payload`) on open, showing `"✅ Live Auto-Updated Script"`. Never bake static JSON snapshots into bookmarklet `href`s.
3. **Booth Operations & Bin SKU Awareness**:
   * Always link Memory Den `0EJ...` SKUs in `locationSku` on the backend and respect physical booth workflows (distinguishing legitimate multi-qty Booth Bin SKUs from true duplicate barcode collision pairs).

## 13. Physical Booth Tag & Production Safety Guardrails (The 3 Physical Retail Tag Laws)
In physical retail booth operations, a barcode (`HUCK-XXXX`, `PDXGL-XXXX`, `BB-XXXX`) is a **physical thermal sticker printed and attached to a price tag on a shelf at Memory Den**—never treat it as a disposable virtual database ID!
1. **Law #1 — Never Auto-Overwrite an Existing Barcode in Ricochet (`MISSING_IN_MD` Only, Never `MISMATCH_UPC`)**:
   * `🚀 Fill Missing` in `public/ricochet-upc-sync.user.js` must ONLY count and write to items where Ricochet's current UPC is genuinely blank (`verifyStatus === 'MISSING_IN_MD'`). It must NEVER include or overwrite an item that already has a non-blank UPC in Ricochet (`verifyStatus === 'MISMATCH_UPC'`), and must abort any `PUT /api/product/items` if `GET /api/product/show/{id}` reveals `targetItem.upc_code` is already populated.
2. **Law #2 — Mandatory Visible Pre-Flight Queue Preview**:
   * Never ask the user to click a blind batch button in production. Always render a visible Pre-Flight Queue Preview (`#rc-preflight-details`) of the exact `N` blank items (`0EJ... | Blank ➔ HUCK-XXXX | 🏷️ Pre-Tagged vs 🆕 Virtual (9740+)`) before running `🚀 Fill Missing (N)`.
3. **Law #3 — Physical Sticker Wins (`🏷️ Adopt Booth Tag ([mdUpc]) in RC`)**:
   * When an item has `verifyStatus === 'MISMATCH_UPC'` (Ricochet has `mdUpc` on the physical booth tag while RC DB has `expectedRcUpc`), provide a 1-click **`🏷️ Adopt Booth Tag ([mdUpc])`** button in both the Memory Den widget and `LocationSyncView.vue` (`POST /api/md-verify-report` with `mode: 'adopt_md_upc'`) that updates `resale_db.items` to match Ricochet's physical barcode instead of overwriting the booth tag.

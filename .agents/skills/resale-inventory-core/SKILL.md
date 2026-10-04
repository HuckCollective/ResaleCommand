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
- `combined`: Absorbed into a multi-item bundle, master lot, or mystery pack. Inventory count is zeroed on the child; parent lot holds the combined cost basis and retail price.
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

---

## 3. Multi-Org UPC & Sales Bucketing Standards

Resale Command operates across multiple vendor and partner organizations. Barcode formats strictly follow `{ORG_PREFIX}-{NUMBER}`:
- **`HUCK-`**: Huck Collective primary inventory (e.g. `HUCK-1460`).
- **`PDXGL-`**: PDX Glass & curated partners (e.g. `PDXGL-0024`).

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

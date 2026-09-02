---
name: haul-ingestion
description: Standard Operating Procedure (SOP) for sourcing, unboxing, AI photo enrichment, lot splitting, and multi-channel deployment (Memory Den Ricochet POS, DustyTiger, Backstock, Online) in Resale Command.
---

# Haul Ingestion & Multi-Channel Sourcing SOP

## 1. User Sourcing Channels & Sourcing Persona
1. **In-Person Thrift Runs (Goodwill, Estate Sales, Garage Sales)**:
   - Sourced via live camera receipt OCR in **Speed Entry** (`/purchases/speed-entry`).
   - Generates a Purchase Order with raw line items and costs.
2. **Daily Online Auction Shipments (ShopGoodwill, eBay, HiBid)**:
   - Imported via daily **Shipped Report CSVs** into Purchase Orders (`status: 'ordered'` or `'in-transit'`).
   - Tracks tracking numbers, purchase dates, and landed shipping/handling allocations.
3. **Co-Op & Shared Booth Operations (PDXGL "Portland Gaming Library")**:
   - Manages personal inventory alongside shared booth co-founders (e.g. PDXGL) with segregated inventory ownership and partner consignment reconciliation.

---

## 2. The 4-Stage ERP Lifecycle (Zero Inventory Clutter)

```mermaid
flowchart LR
    A[Scout Scan / Daily SGW Shipped CSV] --> B[1. Draft / In-Transit PO]
    B -->|Package Arrives / Haul Brought Home| C[2. Haul Ingestion Wizard]
    C -->|Physical Quality Check & Lot Split| D{Multi-Channel Routing}
    D -->|Memory Den| E[Ricochet CSV Export]
    D -->|DustyTiger| F[Rollo Manual Tag Stickers]
    D -->|Warehouse Storage| G[Backstock Bin / Tote]
    D -->|Online Resale| H[eBay / Poshmark Drafts]
    E & F & G & H --> I[3. Active In-Stock Inventory]
```

### Stage Rules:
- **Rule 1: Never Clutter Active Inventory**: Items in `draft`, `ordered`, or `in-transit` status must **NEVER** appear in the main active inventory table. They reside exclusively in **Purchases** (`/purchases`).
- **Rule 2: Pre-Arrival Intelligence**: While an online auction order is in-transit, Gemini AI pre-identifies items from the auction photos, pre-calculates target margins, and drafts 30–42 character tag titles.
- **Rule 3: Unboxing Verification & Lot Splitting**:
  - When the physical box arrives, the user opens the **Haul Ingestion Wizard**.
  - High-ticket "grail" items are split out as individual single SKUs ($35–$150+).
  - Mid-tier runs are combined into multi-quantity SKUs ($12–$25/ea).
  - Common/filler copies are bundled into grab-bags or floor bins ($4–$8/ea).
- **Rule 4: Multi-Channel Destination Routing**:
  1. **Memory Den**: Exports 1-Click **Ricochet POS CSV** (`SKU, Item Title, Description, Price, Quantity, Category, Brand`) to upload and print in Ricochet POS.
  2. **DustyTiger**: Prints direct **Rollo Thermal Stickers** (`DUSTY`, Title, Price, SKU) to stick directly onto DustyTiger's manual cardstock tags.
  3. **Backstock Storage**: Assigns physical storage bin/tote (e.g. *Bin A1, Tote 4*) for items waiting for booth shelf space.
  4. **Online Marketplaces (eBay/Poshmark)**: Generates 80-char SEO titles, condition notes, keywords, and market comps.

---

## 3. Physical Thermal Label & Tag Standards (Rollo & Ricochet)
- **Memory Den Tag Titles**: Strictly 30–42 characters max for thermal price tag compatibility:
  - *Vintage Magazines*: `Heavy Metal Mag - Oct 1977 #7`
  - *Vintage Apparel*: `Carhartt Detroit Jacket (L)`
  - *Toys/Figures*: `Kenner Star Wars Boba Fett 1979`
  - *Music/Media*: `Def Leppard Rock of Ages (2-CD)`
- **Multi-Disc Sets**: A 2-CD or double LP set is **1 single inventory SKU**, not 2 separate items.

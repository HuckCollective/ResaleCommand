# Universal Physical Booth Operations & Multi-Item Lot Curation SOP

This rule defines the core domain logic, accounting integrity, and standard operating procedures for managing physical antique mall booths (e.g., **Memory Den**) and multi-item lot curation across **all resale categories** in **Resale Command**.

---

## 1. Universal Multi-Category Merchandising

This framework applies universally across any bulk collectible or inventory category:

| Category | 🌟 Tier 1: Standout Keys (Single High-Ticket) | 📦 Tier 2: Mid-Tier Runs (Multi-Qty Bulk SKU) | 🛒 Tier 3: Floor / Reader / Parts (Impulse & Grab-Bags) |
| :--- | :--- | :--- | :--- |
| **Vintage Magazines / Comics** | Key Issues (Oct 1977 Tim Leary, #1s, Moebius/Frazetta covers) @ $35–$65+ | 80s/90s Complete Runs @ $14–$20/ea (Multi-Qty Qty: 30) | Reader Copies / Floor Bins @ $6–$8/ea or 3-Packs |
| **Action Figures & Toys** | Rare Grail / Complete Figures (Boba Fett, J97, Mint on Card) @ $45–$150+ | Loose Complete Figures @ $12–$18/ea (Multi-Qty Qty: 25) | Beater Figures / Incomplete / Parts Bins @ $4–$6/ea |
| **Miniatures & Tabletop** *(Warhammer, D&D)* | Rare OOP Lead Characters / Pro-Painted HQ Units @ $35–$80+ | Standard Squad Units @ $8–$14/ea (Multi-Qty Qty: 40) | Unpainted Sprues / Bits Box / Grab-Bags @ $5/ea |
| **Model Airplanes & Die-Cast** | Mint-in-Box 1:72 Diecast Bombers / Rare Liveries @ $45–$120+ | Loose Complete Display Fighters @ $15–$25/ea (Multi-Qty) | Minor Flawed / Scratch-and-Dent / Parts @ $6–$8/ea |
| **Video Games & Cartridges** | CIB Rare RPGs / 1st Party Classics @ $40–$100+ | Loose Popular Cartridges @ $15–$25/ea (Multi-Qty Qty: 30) | Sports Games / Filler / As-Is Discs @ $3–$5/ea |
| **Vintage Apparel & Denim** | Selvedge / Big E / Carhartt Detroit / 90s Tees @ $45–$150+ | Standard Flannels / Vintage Western Shirts @ $18–$28/ea | Clearance Rack / Minor Stain Bargains @ $8–$12/ea |

1. **Immutable PO Cost Basis**:
   - The original landed purchase cost from the supplier/auction invoice (PO) is **immutable and locked**.
   - When a master lot is deconstructed, the sum of child unit costs must reconcile 100% to the original PO cost.
   - The master lot's original cost is never zeroed out or corrupted.

2. **Every Child Item Retains Full Lineage**:
   - Every split item (single, multi-quantity SKU, or bundle) must retain:
     * `purchaseId` $\to$ Link to original Purchase Order
     * `orderId` $\to$ Link to original sourcing order/invoice
     * `parentLotId` $\to$ Link to the master lot document

3. **Multi-Quantity vs. Single Item Merchandising**:
   - High-ticket key items are split into **Individual Singles** (for bagged & boarded showcase display).
   - Mid-tier runs and reader copies are split into **Multi-Quantity SKUs** (Qty: N @ $X.XX/ea) so the seller only creates 1 listing in Memory Den POS and prints identical bulk stickers.

---

## 2. Standard 5-Step Operating Procedure (Golden Path)

```mermaid
graph TD
    A[1. Ingest PO / Landed Cost] --> B[2. Snap Grid Photos & Run AI Deep Scan]
    B --> C[3. Launch Dynamic Lot Splitter Wizard]
    C --> D[4. Fast Bulk Sticker Tagging in 3 Min]
    D --> E[5. Weekly Memory Den Sales Sync]
```

### Step 1: Purchase Order (PO) Ingestion
- Upload the ShopGoodwill invoice CSV or use **Speed Entry** to log the purchase.
- Total landed invoice cost (item + tax + shipping) is permanently anchored as the cost basis.

### Step 2: Parallel AI Inspection
- Lay out items in 2–4 grid overview photos (15–20 items per photo).
- Tap **`⚡ AI Deep Search`** $\to$ Google Gemini scans covers in parallel, transcribes artist/feature blurbs (*Moebius, Frazetta, Tim Leary, Frezzato*), and creates the catalog list.

### Step 3: Dynamic Lot Splitter Wizard (`⚡ Deconstruct Lot`)
- Launch the **Lot Splitter Wizard**.
- Configure N-Tiers:
  * **🌟 Tier 1: Standouts / Keys** $\to$ `Single Items` mode ($35 – $65+ each).
  * **📦 Tier 2: Mid-Tier Runs** $\to$ `Multi-Qty SKU` mode ($16.00/ea, Qty: N).
  * **🛒 Tier 3: Floor Readers** $\to$ `Multi-Qty SKU` mode ($8.00/ea, Qty: N) or `Bundled Set` mode.
- Use mobile 1-tap pills to reassign items if needed.
- Select cost allocation (Equal Split or Value-Weighted).
- Click **`Create SKUs`**.

### Step 4: Physical Booth Stocking & Rapid Tagging
- For Tier 2 and Tier 3, create **1 listing per tier** in Memory Den software.
- Print identical bulk barcode stickers (e.g. 30x $16 stickers).
- Tag entire stack in 2–3 minutes.
- For Tier 1 keys, tag individually with custom barcode labels for the locked glass showcase.

### Step 5: Sales Reconciliation & Inventory Sync
- Upload weekly Memory Den sales payout CSV via **Sales Importer**.
- Memory Den register sales automatically decrement multi-quantity inventory quantities (e.g. 30 $\to$ 26) and mark sold singles as `Sold`.
- Exact profit margins and net payouts (after the 12% booth commission) are calculated and recorded automatically.

---

## 3. Official Ricochet POS / Memory Den Upload Specifications

When exporting inventory to Ricochet POS (`memoryden_ricochet_import.csv`), the file must adhere strictly to these 9 columns and constraints:

### Required CSV Columns & Rules:

| Column Header | Strict Constraints | Purpose & Behavior in Ricochet POS |
| :--- | :--- | :--- |
| **`SKU`** | Required, Unique, Alphanumeric (e.g. `HUCK-1303`). | Generates the scannable Code 128 / UPC barcode on physical price stickers. |
| **`Item Title`** | **Max 40–45 characters**. No trailing spaces. Clean word boundary. | **Printed on the physical 1" x 2" thermal barcode sticker**. Must be concise and readable so it never truncates on physical labels. |
| **`Description`** | Max 250 characters. No raw newlines. | Printed on customer sales receipts and consignor inventory audit reports. |
| **`Web Description`**| Up to 500+ characters. Full keywords & SEO. | Uploaded to Memory Den's online store / Shopify web catalog. |
| **`Price`** | Numeric decimal only (e.g. `65.00`). No `$` or commas. | Retail sale price at the register. |
| **`Quantity`** | Integer $\ge 1$. | Stock level count (1 for singles, N for bulk choice bins). |
| **`In-Stock Date`** | Date format `M/D/YYYY` (e.g. `9/1/2026`). | Tracks consignment aging and markdown schedules. |
| **`Category`** | Leave blank string `""` unless mapping exact store taxonomy. | Avoids store taxonomy mismatch rejections on bulk import. |
| **`Brand`** | Text string (e.g. `Heavy Metal`, `Carhartt`, `Kenner`). | Brand/maker filter in Ricochet inventory search. |

### Golden Label Formatting Standard:
- **Keys / Singles**: `[Brand/Item] - [Date/Issue/Model] [Key Modifier]` (e.g. `Heavy Metal Mag - Oct 1977 #7` or `Carhartt Detroit Jacket L`)
- **Bulk Choice Bins**: `[Brand/Item] - Choice ($XX)` (e.g. `Heavy Metal Mag - 80s-90s Choice`)
- **Clearance / Readers**: `[Brand/Item] - Reader / Clearance ($XX)` (e.g. `Heavy Metal Mag - Reader Copy`)

### 4. Official Ricochet POS SKU vs. UPC Rule (Permanent Knowledge)
- **Ricochet Auto-Generates SKU**: In Ricochet Consign, SKUs are automatically created/managed by Ricochet and cannot be directly customized or overwritten by consignors.
- **CSV `SKU` Column Maps Directly to UPC in Ricochet**: Per Ricochet's official import specification: *"Ricochet automatically generates SKUs for your items. If you include a pre-existing SKU in your template, the system will assign that value to the **UPC field** instead."*
- **Exact Behavior**: When we put our `item.upc` (`HUCK-1303`, `HUCK-1304`, etc.) under the CSV column header `SKU`, Ricochet imports our barcode directly into the item's **UPC field** in Ricochet, allowing Memory Den's barcode scanner to read our exact `HUCK-` barcodes at checkout.
- **Template Compatibility**: The CSV header must remain `SKU` so Ricochet's CSV parser accepts the file and maps it into the Ricochet UPC field.

### 5. Co-Op & Shared Booth Partners (Memory Den)
- **The Huckleberry Co. (`HUCK-` Prefix)**: Primary vendor / founder inventory spanning curated vintage, apparel, comics, pop culture collectibles, music/CDs, and oddities.
- **Portland Gaming Library (`PDXGL-` Prefix)**: Shared booth co-founder partner specializing in tabletop RPGs (AD&D modules, D&D books), tabletop games, board games, video games, and gaming memorabilia.
- **Unified Inventory & Filtered Exports**: Both partners share the booth footprint while maintaining clear inventory ownership through distinct barcode prefixes (`HUCK-` and `PDXGL-`) and unified Ricochet POS exports.





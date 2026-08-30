# ResaleCommand Schema & Database Architecture

This document defines the complete Appwrite database schemas, collections, indexes, storage buckets, and security rules across all environments (Production & Development).

---

## 🗄️ Database Schemas (`resale_db`)

### 1. `items` / `items_dev` Collections
Primary collections storing inventory items, lots, pricing, barcodes, and location allocations.

| Attribute | Type | Size / Options | Required | Description |
|---|---|---|---|---|
| `title` | String | 255 | Yes | Item title / name |
| `identity` | String | 1000 | Yes | Unique ID (e.g. ShopGoodwill Item ID, external order item #) |
| `conditionNotes` | String | 1000 | No | Condition assessment, notes, and file metadata tags |
| `status` | String | 255 | No | Lifecycle status (`scouted`, `acquired`, `received`, `placed`, `sold`) |
| `tenantId` | String | 255 | No | Team / tenant owner ID for multi-tenant isolation |
| `upc` | String | 255 | No | Auto-generated sequential or custom barcode (e.g. `HUCK-0013`) |
| `locationSku` | String | 255 | No | External SKU assigned by antique mall / consignment booth |
| `storageLocation` | String | 255 | No | Physical bin, shelf, or warehouse identifier |
| `sellingLocations` | String[] | 255 | No | List of locations/booths where item is actively placed for sale |
| `warehouseId` | String | 255 | No | Primary linked warehouse document ID |
| `saleId` | String | 255 | No | Linked `sales` document ID when sold |
| `cost` | Float | - | No | Total landed acquisition cost (base + shipping + tax + fees) |
| `resalePrice` | Float | - | No | Target listing resale price |
| `soldPrice` | Float | - | No | Actual realized sale price |
| `maxBuyPrice` | Float | - | No | Maximum recommended acquisition price target |
| `parentLotId` | String | 255 | No | Parent lot item document ID (for split bundle children) |
| `quantity` | Integer | - | No | Item quantity (defaults to 1) |
| `components` | String | 1000 | No | Included accessories, parts, or missing components |
| `imageId` | String | 255 | No | Storage File ID for the primary cropped display photo |
| `galleryImageIds` | String[] | 255 | No | Storage File IDs for secondary / high-res photos |
| `receiptImageId` | String | 255 | No | Storage File ID for sourcing receipt |
| `keywords` | String[] | 255 | No | Tags, search keywords, and categorization |
| `marketDescription` | String | 65000 | No | AI-generated SEO listing description |
| `rawAnalysis` | String | 65000 | No | Raw JSON data from Gemini AI Scout analysis |
| `cartId` | String | 255 | No | Associated purchase / cart batch ID |
| `sourcingLocation` | String | 255 | No | Source URL or store name where item was acquired |

---

### 2. `sales` / `sales_dev` Collections
Stores individual sales orders, location-attributed revenue, and net payouts.

| Attribute | Type | Required | Description |
|---|---|---|---|
| `soNumber` | String | Yes | Sequential Sales Order Number (e.g. `SO-1001`) |
| `warehouseId` | String | Yes | Linked `warehouses` document ID (e.g. Memory Den, Dusty Tiger) |
| `orderId` | String | No | External booth sale / SKU transaction reference |
| `saleDate` | String / ISO | No | Date and time the sale occurred |
| `status` | String | No | Order status (`Sold`, `Paid`, `Draft`, `Returned`) |
| `grossAmount` | Float | Yes | Total gross transaction price before fees |
| `commissionFee` | Float | No | Platform/consignment commission fee deducted |
| `shippingCost` | Float | No | Outbound shipping expense |
| `shippingCharged`| Float | No | Shipping collected from customer |
| `netPayout` | Float | Yes | Final realized payout (`gross - commission - shippingCost`) |
| `tenantId` | String | Yes | Team / tenant owner ID |

---

### 3. `warehouses` Collection
Stores physical booth, warehouse, and consignment selling locations with commission structures.

| Attribute | Type | Required | Description |
|---|---|---|---|
| `name` | String | Yes | Location name (e.g. `Memory Den`, `Dusty Tiger`) |
| `type` | String | No | Location type (`Booth`, `Warehouse`, `Online`, `Storage`) |
| `commissionRate`| Float | No | Percentage taken by location (e.g. `10` for 10%) |
| `monthlyRent` | Float | No | Fixed monthly booth/space rental expense |
| `tenantId` | String | Yes | Team / tenant owner ID |

---

### 4. `purchases` / `purchases_dev` Collections
Stores Purchase Orders (POs) and vendor lot receipts.

| Attribute | Type | Required | Description |
|---|---|---|---|
| `poNumber` | String | Yes | Generated identifier (e.g. `PO-10492`) |
| `vendor` | String | No | Sourcing vendor (e.g. `ShopGoodwill`, `Estate Sale`, `Garage Sale`) |
| `orderId` | String | No | External Vendor Order # |
| `purchaseDate` | Datetime | No | Purchase timestamp |
| `subtotal` | Float | No | Base purchase price |
| `shippingTotal` | Float | No | Inbound shipping total |
| `handlingTotal` | Float | No | Handling charges |
| `taxTotal` | Float | No | Sales tax paid |
| `feeTotal` | Float | No | Platform / buyer premiums |
| `grandTotal` | Float | No | Total Landed Cost |
| `status` | String | No | `Ordered`, `Shipped`, `Received`, `Processed` |
| `tenantId` | String | Yes | Team / tenant owner ID |
| `buyerId` | String | No | User ID who initiated purchase |

---

### 5. `carts` & `expenses` Collections
- **`carts`**: Batches of items being scouted, acquired, or processed concurrently.
- **`expenses`**: Miscellaneous business overhead, mileage, and supplies linked to purchases or teams.

---

## 🗂️ Appwrite Storage Buckets

| Bucket Name | Bucket ID | Purpose | Permissions |
|---|---|---|---|
| **Item Images** | `item_images` | Cropped primary and gallery product photos | Read: `Any`, Write: `Users` |
| **Reports** | `reports` | AI Scout reports (`scout.json`, `scout.md`) | Read: `Any`, Write: `Users` |
| **Receipts** | `receipts` | Sourcing order invoices and PDF receipts | Read: `Users`, Write: `Users` |

---

## 🔒 Security & RBAC Configuration

1. **Document Level Security (DLS)**:
   - Enabled on all data collections (`items`, `sales`, `warehouses`, `purchases`, `expenses`).
   - Every document created receives explicit RBAC team permissions:
     ```typescript
     const role = Role.team(teamId);
     const permissions = [
       Permission.read(role),
       Permission.update(role),
       Permission.delete(role),
     ];
     ```
2. **Collection-Level Permissions**:
   - `read("any")` (Allows the Web SDK to perform DLS-filtered queries).
   - `create("users")`, `update("users")`, `delete("users")`.

---

## ⚡ Required Database Indexes

### `items` / `items_dev` Indexes:
- `tenantId` (type: `key`, order: `ASC`)
- `status` (type: `key`, order: `ASC`)
- `parentLotId` (type: `key`, order: `ASC`)
- `upc` (type: `key`, order: `ASC`)
- `locationSku` (type: `key`, order: `ASC`)
- `$createdAt` (type: `key`, order: `DESC`)

### `sales` Indexes:
- `tenantId` (type: `key`, order: `ASC`)
- `warehouseId` (type: `key`, order: `ASC`)
- `saleDate` (type: `key`, order: `DESC`)
- `soNumber` (type: `key`, order: `DESC`)

### `warehouses` Indexes:
- `tenantId` (type: `key`, order: `ASC`)
- `name` (type: `key`, order: `ASC`)

---

## 📜 Schema Changelog & Migration History

| Date | Collection | Change / Migration | Details |
|---|---|---|---|
| **2026-08-30** | `items` & `items_dev` | **Added Index `parentLotId_idx`** | Created `key` index on `parentLotId` to support real-time lot hierarchy lookups, child deconstruction tracking, and duplicate prevention. |
| **2026-08-30** | `items` & `items_dev` | **PO Traceability & Cost Anchoring** | Linked `purchaseId` and `parentLotId` across all split child SKUs to guarantee immutable landed PO cost basis. |
| **2026-08-29** | `sales` & `sales_dev` | **Added Index `idx_warehouseId` & `idx_saleId`** | Enabled fast sales order grouping and consignment payout reconciliation per booth location. |

---

## 📚 Related Documentation
- [Booth Operations & Lot Splitting SOP](file:///c:/Users/15034/Projects/ResaleCommand/docs/BOOTH_OPERATIONS_SOP.md)
- [Location Sync & Consignment Mapping Guide](file:///c:/Users/15034/Projects/ResaleCommand/docs/LOCATION_SYNC_GUIDE.md)
- [Data Ingestion Guide](file:///c:/Users/15034/Projects/ResaleCommand/docs/DATA_INGESTION.md)
- [Inventory Workflow](file:///c:/Users/15034/Projects/ResaleCommand/docs/INVENTORY_WORKFLOW.md)
- [Pricing Logic](file:///c:/Users/15034/Projects/ResaleCommand/docs/pricing_logic.md)


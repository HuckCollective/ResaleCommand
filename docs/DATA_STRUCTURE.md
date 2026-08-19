# System Data Structure Documentation

This document outlines the expected CSV structure for bulk imports and the database schema for the Inventory items.

## 1. ShopGoodwill CSV Import Rules

The bulk importer (`CsvImporter.vue`) includes specific logic to handle ShopGoodwill export formats, particularly resolving the ambiguity between "Item Name" and "Item ID" columns.

### strict Column Mapping Logic

The system uses **Content-Aware Mapping** to distinguish columns. It checks the _data_ in the first row to confirm the mapping.

| System Field | Logic & Keywords                                           | Content Validation Rule                                                                                                       |
| :----------- | :--------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| **Title**    | `description`, `title`, `item name`, `product`, **`item`** | **MUST be Text.** <br>If a column matches "Item" but contains only numbers (e.g. `251710005`), it is **REJECTED** as a Title. |
| **Item ID**  | `item #`, `item id`, `order #`, `listing id`, **`item`**   | **MUST be Numeric.**<br>If a column matches "Item" but contains text (e.g. "Red Shoes"), it is **REJECTED** as an ID.         |
| **Price**    | `price`, `amount`, `winning bid`, `cost`, `paid`           | -                                                                                                                             |
| **Shipping** | `shipping`, `handling`, `s&h`, `ship`                      | -                                                                                                                             |
| **Order ID** | `order #`, `order number`, `invoice`, `order`              | Defaults to Item ID if not found.                                                                                             |

### Ambiguity Resolution Example

If your CSV has two columns named similarly:

| Column A Header: **"Item"**       | Column B Header: **"Item"**      |
| :-------------------------------- | :------------------------------- |
| Data: `251710005`                 | Data: `Vintage Nike Air Jordans` |
| **Result:** Mapped to **Item ID** | **Result:** Mapped to **Title**  |

### Import Features

- **Smart Fallback:** If no Title column is found, the system automatically selects the **column with the longest average text length** as the Description/Title.
- **ID Scanning:** If no ID column is found, the system scans all columns for a 9-10 digit number (standard ShopGoodwill ID format).
- **Safe Mode:** If database schema mismatches occur, data is saved into `conditionNotes` to prevent loss.

---

---

## 2. Database Structure (Appwrite)

**Database ID:** `inventory_db` (or from env `PUBLIC_APPWRITE_DB_ID`)  
**Main Items Collection ID:** `items` (or from env `PUBLIC_APPWRITE_COLLECTION_ID`)

### Core Schema (`items` Collection)

| Attribute Name       | Type     | Size/Constraints       | Required | Description                                                                          |
| :------------------- | :------- | :--------------------- | :------- | :----------------------------------------------------------------------------------- |
| `title`              | String   | 255                    | **Yes**  | Item title/headline.                                                                 |
| `identity`           | String   | 255                    | No       | Unique identifier or system hash.                                                    |
| `status`             | String   | 50                     | No       | `scouted`, `acquired`, `received`, `placed`, `sold`                                  |
| `conditionNotes`     | String   | 1000+ (max 800 parsed) | No       | Condition details, import tags, and analytics safe mode.                             |
| `cost`               | Float    | -                      | No       | Purchase / unit cost paid.                                                           |
| `resalePrice`        | Float    | -                      | No       | Listed / gross agreed sticker price.                                                 |
| `soldPrice`          | Float    | -                      | No       | **Net take-home payout** after consignment commission fees.                          |
| `maxBuyPrice`        | Float    | -                      | No       | Max buy price limit (for scouting).                                                  |
| `quantity`           | Integer  | **min: 1, max: 100000**| No       | In-stock quantity. **Note: Appwrite rejects 0. Mark sold with status: 'sold'.**      |
| `upc`                | String   | 255                    | No       | Barcode identifier (e.g. `HUCK-0042`, `PDXGL-0001`).                                 |
| `locationSku`        | String   | 255                    | No       | External booth SKU (e.g. `0EJ001` for Memory Den).                                   |
| `parentLotId`        | String   | 255                    | No       | Parent item ID if split from a multi-quantity lot.                                   |
| `sellingLocations`   | String[] | Array of Strings       | No       | Physical booth / selling channel tags (e.g. `["MemoryDen", "DustyTiger"]`).           |
| `sourcingLocation`   | String   | 255                    | No       | Source store, thrift shop, or URL link.                                              |
| `storageLocation`    | String   | 255                    | No       | Physical storage bin / location.                                                     |
| `marketDescription`  | String   | 5000                   | No       | AI-generated product description & comparables.                                      |
| `saleId`             | String   | 255                    | No       | Associated sales collection record ID.                                               |
| `purchaseId`         | String   | 255                    | No       | Associated purchase order record ID.                                                 |
| `tenantId`           | String   | 255                    | No       | Organization / Team ID.                                                              |

### Images & Media

| Attribute Name    | Type     | Description                                     |
| :---------------- | :------- | :---------------------------------------------- |
| `imageId`         | String   | ID of the **Main Photo** in the Storage Bucket. |
| `galleryImageIds` | String[] | Array of IDs for additional photos.             |
| `receiptImageId`  | String   | ID of the purchase receipt image.               |

### `sales` Collection

| Attribute Name     | Type   | Description                                                              |
| :----------------- | :----- | :----------------------------------------------------------------------- |
| `soNumber`         | String | Sales order number (e.g. `SO-1042`).                                     |
| `warehouseId`      | String | Warehouse / booth location ID where item sold.                           |
| `orderId`          | String | Linked item UPC or external SKU.                                         |
| `saleDate`         | String | ISO timestamp of the sale.                                               |
| `status`           | String | `Sold`, `Completed`, `Pending`.                                          |
| `grossAmount`      | Float  | Total customer purchase amount.                                          |
| `commissionFee`    | Float  | Location consignment commission fee charged.                             |
| `netPayout`        | Float  | Actual take-home amount received.                                        |
| `tenantId`         | String | Team / tenant owner.                                                     |

### `warehouses` Collection

| Attribute Name     | Type    | Description                                                             |
| :----------------- | :------ | :---------------------------------------------------------------------- |
| `name`             | String  | Location name (e.g. `MemoryDen`).                                       |
| `type`             | String  | `Consignment Booth`, `On-Site`, `Online`, `Warehouse`.                  |
| `commissionRate`   | Float   | Default commission % fee (e.g. `15` for 15%).                            |
| `monthlyRent`      | Float   | Fixed monthly space rent fee ($).                                       |
| `categories`       | String  | Allowed niche / category keywords.                                      |
| `isDefault`        | Boolean | Default location flag.                                                  |
| `tenantId`         | String  | Team / tenant owner.                                                     |

### Critical Schema Rules:
1. **Quantity Constraints**: The `quantity` integer attribute strictly enforces `1 <= quantity <= 100,000`. Never write `0` to `quantity`; items are retired/sold by updating `status: 'sold'`.
2. **Notes Truncation**: `conditionNotes` are capped at 800 characters before payload submission to prevent byte-length overflow from multi-byte unicode characters.
3. **UPC Uniqueness**: Barcodes increment sequentially per prefix stream (`HUCK-XXXX`, `PDXGL-XXXX`) and expand to 5+ digits as needed.

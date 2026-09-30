# Ricochet POS In-Browser UPC Barcode Sync — Standard Operating Procedure (SOP)

This document records the exact architecture, API mechanics, common pitfalls, and execution procedure for synchronizing physical `HUCK-XXXX` barcode UPCs into **Ricochet POS** (`memoryden.ricoconsign.com`).

---

## 1. Why This Is Necessary

1. **Ricochet CSV Import Limitations**:
   - When importing a new inventory CSV into Ricochet Consign, Ricochet accepts the item names, descriptions, and prices, but often assigns its own internal consignor SKU (e.g., `0EJ0NP`, `OEJDW`) and **leaves `upc_code` blank**.
2. **CSV Re-Imports Are Blocked**:
   - Ricochet POS strictly **blocks CSV re-imports** for existing inventory SKUs. Any attempt to upload a modified CSV with barcodes results in duplicate SKU rejection errors.
3. **Register Checkout Behavior**:
   - When a customer purchases an item at the Memory Den checkout counter, the cashier scans the physical barcode sticker (`HUCK-XXXX`).
   - Ricochet POS queries the `upc_code` field on barcode scan. If `upc_code` is empty, the scanner beeps `"Item Not Found"`.

---

## 2. API Architecture & Mechanics

Because re-import is blocked, Resale Command utilizes your active authenticated browser session in Ricochet to update inventory directly via Ricochet's internal REST API.

### Key Endpoints:
| Endpoint | Method | Purpose | Key Parameters |
| :--- | :---: | :--- | :--- |
| `/api/product` | `GET` | Catalog search & pagination | `store=1`, `limit=100`, `offset=N`, `order_by=id`, `direction=desc`, `consignor_id=475` |
| `/api/product/show/{id}` | `GET` | Full product & variant items detail | Product ID |
| `/api/product/items` | `PUT` | Update specific item/variant UPC & store | Body: `{ ...item, store: 1, upc_code: "HUCK-XXXX" }` |

---

## 3. Critical Rules & Gotchas (Lessons Learned)

> [!CAUTION]
> ### 1. Strict Consignor Scoping (Avoiding HTTP 422)
> In a multi-vendor mall like Memory Den, `/api/product?store=1` returns products from **all consignors across the entire mall**.
> - Attempting to call `PUT /api/product/items` on another consignor's item triggers an **HTTP 422: `The given data was invalid` (Unauthorized)** error.
> - **Always filter** by the active consignor ID (e.g. `p.consignor_id === 475`).

> [!IMPORTANT]
> ### 2. Always Sort Newest-First (`order_by=id&direction=desc`)
> Memory Den has tens of thousands of catalog records. Scanning with default ascending order starts at items from years ago.
> - By passing `order_by=id&direction=desc`, newly imported drop items appear immediately in the first 100–200 items.

> [!TIP]
> ### 3. 4-Tier Matching Hierarchy
> Ricochet frequently rewrites SKUs on CSV import. Do not rely solely on SKU lookup:
> 1. **Exact Product ID** (if pre-known)
> 2. **SKU Match** (against `p.sku` or `p.sku_quantities`)
> 3. **Exact Title Match** (alphanumeric normalized, case-insensitive)
> 4. **Key Phrase / Prefix Title Match** (first 2 significant words, e.g. `"william gibson"`, `"glass skull"`)

> [!NOTE]
> ### 4. Idempotent Execution
> Before issuing a `PUT` request, check if `targetItem.upc_code === item.upc`. If it already matches, skip the request to save bandwidth and prevent rate-limiting.

---

## 4. Standard Execution Workflow

### Step 1: Export & Import into Ricochet
1. In Resale Command, open the drop manifest or warehouse sync page (`/warehouse/sync`).
2. Export the drop CSV formatted for Ricochet.
3. In Ricochet Consign (`memoryden.ricoconsign.com`), upload the CSV under **Inventory ➔ Add New ➔ Import**.

### Step 2: Generate & Run the Sync Script
1. On Resale Command (`/warehouse/sync`), drag & drop the drop CSV (or click **⚡ Ricochet Sync Guide** in the top header).
2. Click **⚡ Copy All (N Items)**. The pre-bundled script is copied to your clipboard.
3. Switch to your active Ricochet tab (`memoryden.ricoconsign.com/dashboard#`).
4. Press <kbd>F12</kbd> (or right click ➔ **Inspect**) and click **Console**.
5. Paste (<kbd>Ctrl + V</kbd>) and press <kbd>Enter</kbd>.
6. Watch the green checkmarks:
   ```
   ✓ [William Gibson - Pattern Recognition] ➔ Set UPC: HUCK-1506 (Ricochet SKU: 0EJ0P2)
   ✓ [Glass Skull Bottle - Small Decor] ➔ Set UPC: HUCK-1488 (Ricochet SKU: 0EJ0P3)
   ✓ [Gothic Black Rose Floral Decor] ➔ Set UPC: HUCK-1507 (Ricochet SKU: 0EJ0P4)
   🎉 Sync Finished! 7 items verified/updated in Ricochet.
   ```
7. Refresh the Ricochet inventory table to see the barcodes populated.

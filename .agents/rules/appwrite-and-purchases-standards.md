# Appwrite Timestamps & Centralized Purchases Standards

## 1. Appwrite Automatic Timestamps ($createdAt & $updatedAt)
- **Do not reinvent the wheel**: Every document in Appwrite across all collections (`items`, `purchases`, `expenses`, `users`, etc.) automatically receives:
  - `$createdAt`: The exact ISO creation timestamp (e.g. `2026-09-04T19:35:12.000Z`).
  - `$updatedAt`: The exact ISO last-modified timestamp.
- **Sorting**: Always sort by Appwrite's native `$createdAt` for newest-first order:
  - Query: `Query.orderDesc('$createdAt')`
  - Client sort: `new Date(b.$createdAt || 0).getTime() - new Date(a.$createdAt || 0).getTime()`
- **UI Display**: For creation date columns, badges, or relative times ("Just now", "5m ago"), always use `$createdAt`.
- **Receipt/Trip Date vs Created Date**:
  - `purchaseDate`: The date printed on the receipt or invoice (business date of transaction).
  - `$createdAt`: The exact system timestamp when the purchase order was entered/scanned into Resale Command.

## 2. Centralized Purchase Order & Line Item Saving
- **Single Source of Truth**: All purchase order and line item saves MUST use:
  ```typescript
  purchasesAPI.savePurchaseOrder(payload)
  ```
  in `src/lib/purchases.ts`.
- **Never duplicate saving logic in Vue components**: `SpeedEntryForm.vue`, `PurchaseEditor.vue`, or any future entry screen must delegate to `purchasesAPI.savePurchaseOrder()`.
- What `purchasesAPI.savePurchaseOrder()` handles automatically:
  1. Generates timestamped `poNumber` / `orderId` if omitted.
  2. Uploads receipt image to Appwrite storage if a new file is provided.
  3. Creates or updates the purchase order in Appwrite.
  4. Saves resale items via `saveItemToInventory` with sequential unique identities (`${poNumber}-01`, `${poNumber}-02`).
  5. Records operating expense lines into the `expenses` collection.

## 3. Inventory Deduplication & Identity Rules
- In `saveItemToInventory` (`src/lib/inventory.ts`):
  - **NEVER deduplicate on `sourcingLocation`**: Multiple items from the same store (e.g. "Goodwill - Happy Valley") share `sourcingLocation`. Matching on `sourcingLocation` falsely blocks valid items as duplicates.
  - **Deduplicate only on unique identities**: Skip creation only if a non-generic `identity` already exists for the tenant.
  - **Automatic Timestamped Identity**: If `itemData.identity` is ever omitted or blank, `saveItemToInventory` automatically generates a timestamped identity (`PO-${timestamp}-${rand}` or `ITEM-${timestamp}-${rand}`) across the board so no save ever crashes.

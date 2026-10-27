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

## 4. Image Storage, Asset ID Invariants & JSON Sanitization (`imageId`, `galleryImageIds`, `rawAnalysis`, `components`)
- **Strict Decoupling of Binaries and Database Attributes**:
  - The Appwrite schema defines `imageId` (and each entry of `galleryImageIds`) as a `String` with a **maximum size of 255 characters**.
  - These fields exist **strictly** to store **Appwrite Storage File IDs** (e.g. `660a1f2e003b41d8e12a`), NEVER raw binary image data, Data URIs (`data:image/...`), or temporary object/blob URLs (`blob:...`).
- **Zero Raw Base64 in Database**:
  - In-memory Base64 strings are 100,000 to 2,000,000+ characters. Writing them into `databases.createDocument()` or `databases.updateDocument()` triggers fatal Appwrite schema violation errors (`Attribute "imageId" has invalid size`).
- **Zero Raw Base64 in JSON Attributes (`rawAnalysis` & `components`)**:
  - The Appwrite schema defines `rawAnalysis` and `components` as strings with a maximum size of 65,000 characters.
  - Both `rawAnalysis` and `components` must **strip any "data:image/..." or "blob:..." base64 strings** out of the object before calling `JSON.stringify()` (via `stripBase64AndBlob()`, `getSafeRawAnalysis()`, and `getSafeComponents()`).
  - Storing base64 inside JSON objects causes payloads to explode past 65,000 characters, throwing fatal Appwrite errors: `Attribute "rawAnalysis" must be no longer than 65000 chars`.
  - Only store uploaded Appwrite Storage File IDs or short remote URLs (< 500 characters).
  - Both `rawAnalysis` and `components` must be strictly capped at **64,000 characters max** before database insertion/updates.
- **Ingestion Order of Operations**:
  1. **Upload First**: Any local photo capture, pasted image, or remote scrape must be uploaded to the Appwrite Storage bucket (`BUCKET_ID || 'item_images'`) *before* document creation.
  2. **Fallbacks Must Use Server Admin API, Never Base64 Strings**: If client-side upload to storage fails or hits browser CORS/timeout, the frontend must fall back to `/api/upload-remote-image` (which uploads to storage using server-side Admin credentials). It must **never** fall back to saving the raw in-memory Base64 data string to the database.
  3. **Defensive Pre-Flight Sanitization**: Any function creating or updating `items` or `purchases` documents (`saveDirectToInventory`, `addItemToPurchase`, `addLotToPurchase`, `saveItemToInventory`) MUST sanitize `imageId`, `galleryImageIds`, `rawAnalysis`, and `components` before making DB calls:
     - Strip any value starting with `data:` or `blob:`.
     - Strip any `imageId` / `galleryImageIds` value longer than 255 characters.
     - Extract clean File IDs from Appwrite URLs via `getFileIdFromUrl()`.
     - Strip base64 and cap `rawAnalysis` and `components` at 64,000 characters max via `getSafeRawAnalysis()` and `getSafeComponents()`.

## 5. Appwrite Collection Schema Rigidity & Unindexed Attribute Protection
- **Strict Schema Enforcement**:
  - Appwrite enforces strict server-side validation against defined collection attributes on both `databases.createDocument()` and `databases.updateDocument()`.
  - Sending any attribute not explicitly declared in the collection schema will throw a fatal `AppwriteException`:
    `Invalid document structure: Attribute "[attributeName]" not found in collection`.
- **Multi-Quantity Attributes (`quantity` vs `isMultiQty`)**:
  - The Appwrite `items` collection defines **`quantity`** as an integer attribute (min 1, default 1).
  - It does **NOT** contain an `isMultiQty` boolean attribute.
  - **NEVER** include `isMultiQty` in document creation or update payloads sent to Appwrite.
  - **Standard Pattern**:
    ```typescript
    // In database payload:
    const docPayload = {
      ...itemData,
      quantity: isMulti ? Math.max(2, itemData.quantity || 2) : 1
    };
    delete (docPayload as any).isMultiQty; // Guard against schema rejection
    
    // In reactive frontend memory:
    createdDoc.isMultiQty = (createdDoc.quantity > 1) || isMulti;
    ```


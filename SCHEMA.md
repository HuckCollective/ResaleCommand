# ResaleCommand Schema & Architecture

## Appwrite Database Schemas

### `items` Collection
This collection stores all inventory items.

| Attribute | Type | Required | Description |
|---|---|---|---|
| `title` | String | Yes | Name of the item |
| `identity` | String | Yes | Unique ID (often the ShopGoodwill Item ID) |
| `conditionNotes` | String | No | Notes, descriptions, and Landed Cost breakdowns (Max 1000 chars) |
| `status` | String | No | Current status (e.g., 'acquired', 'listed', 'sold') |
| `tenantId` | String | No | Team/User ID who owns the item |
| `imageId` | String | No | Appwrite Storage File ID for the main image |
| `galleryImageIds` | String[] | No | Appwrite Storage File IDs for gallery images |
| `receiptImageId` | String | No | Appwrite Storage File ID for the receipt |
| `cost` | Float | No | The total landed cost (Base + Shipping + Handling + Tax + Fees) |
| `resalePrice` | Float | No | Expected or listed resale price |
| `soldPrice` | Float | No | Final sold price |
| `maxBuyPrice` | Float | No | Maximum amount willing to pay |
| `sourcingLocation` | String | No | URL or location where the item was acquired |
| `storageLocation` | String | No | Physical bin or shelf location |
| `cartId` | String | No | Cart ID if part of a batch |
| `marketDescription` | String | No | Generated listing description |
| `keywords` | String[] | No | Tags or SEO keywords |
| `components` | String | No | Missing or included parts |
| `quantity` | Integer | No | Number of identical items |
| `parentLotId` | String | No | ID of a lot this item belongs to |
| `rawAnalysis` | String | No | Raw JSON data from AI scouting |

### `purchases` Collection
This collection stores Purchase Orders (POs) which can contain multiple items.

| Attribute | Type | Required | Description |
|---|---|---|---|
| `poNumber` | String | Yes | Generated identifier (e.g., PO-123456) |
| `vendor` | String | No | Vendor Name (e.g., ShopGoodwill) |
| `orderId` | String | No | External Order ID from Vendor |
| `purchaseDate` | Datetime | No | Date the purchase was made |
| `subtotal` | Float | No | Sum of line items / base costs |
| `shippingTotal` | Float | No | Total shipping cost |
| `handlingTotal` | Float | No | Total handling cost |
| `taxTotal` | Float | No | Total tax |
| `feeTotal` | Float | No | Total fees |
| `grandTotal` | Float | No | Subtotal + Shipping + Handling + Tax + Fees |
| `status` | String | No | Status (Draft, Ordered, Shipped, Received, Cancelled, Returned) |
| `tenantId` | String | No | Team/User ID who owns the purchase |
| `buyerId` | String | No | User ID who made the purchase |

---

## 🔒 Security & Permissions Rules

When deploying to a new environment (e.g. from dev to prod), the frontend will completely fail to load records if collection permissions and indexes are not identical.

**If the Web SDK returns `401 Unauthorized` or `400 Index Not Found` with zero records, verify the following:**

### 1. Document Level Security (DLS)
- Both `items` and `purchases` collections **MUST** have Document Level Security toggled **ON** (`documentSecurity: true`).
- The frontend code natively grants read/update/delete permissions at the document level to the user's `tenantId` (Team ID). This ensures that only users in the Team can read their own data.

### 2. Collection-Level Permissions
Even with Document Security enabled, Appwrite requires the collection itself to permit those API actions generally.
The collections (`items`, `purchases`, `expenses`) must have the following configuration:
- `read("any")` - Required so that the Web SDK can query the collection (DLS handles the actual row-level filtering).
- `create("users")` - Only authenticated users can create documents.
- `update("users")` - Only authenticated users can update.
- `delete("users")` - Only authenticated users can delete.

> [!WARNING]
> If a collection has `permissions: []` (empty array), the Web Client will return `401 Unauthorized` for all users—even if the user owns the individual document!

---

## 🚀 Required Database Indexes

The frontend relies heavily on database indexes for sorting and filtering (`Query.orderDesc`, `Query.equal`, etc.). **If a requested index does not exist, the query completely fails and returns 0 results.**

### `purchases` Index Requirements:
- `purchaseDate` (type: `key`, order: `DESC`) -> used for sorting Purchases by date.
- `grandTotal` (type: `key`, order: `DESC`) -> used for sorting Purchases by amount.
- `poNumber` (type: `key`, order: `ASC`) -> used for filtering/searching POs.
- `orderId` (type: `key`, order: `ASC`) -> used for filtering/searching.
- `vendor` (type: `key`, order: `ASC`) -> used for filtering/searching.

### `items` Index Requirements:
*(Note: These must be verified when setting up new environments as well)*
- `identity` (type: `key`)
- `status` (type: `key`)
- `purchaseId` / `cartId` (type: `key`) -> used to lookup items linked to a specific Purchase.

---

## Core File Structure

### Frontend (`/src`)
- **`components/inventory/BulkImport.vue`**
  - Handles parsing `.csv`, `.xls`, and `.xlsx` files.
  - Groups items by Order ID and distributes shipping/handling/tax/fees evenly across items to calculate True Landed Cost.
  - Skips fetching data from ShopGoodwill for items that already exist in the database (to prevent IP bans).
- **`components/purchases/PurchasesList.vue`**
  - Displays PO history. Relies heavily on the indexes defined above.
- **`lib/inventory.ts` & `lib/purchases.ts`**
  - Main wrappers around the Appwrite Web SDK.
  - Generates Team/Tenant level permissions upon document creation.

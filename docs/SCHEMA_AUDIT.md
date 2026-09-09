# 🛡️ Appwrite Complete Schema & Storage Audit Report

> **Audit Type:** 100% Read-Only Full Database Inspection (Zero changes made)
> **Last Audited:** Wednesday, September 9, 2026 at 8:35:58 AM PDT
> **Endpoint:** `https://sfo.cloud.appwrite.io/v1`
> **Project ID:** `69714b35003a8adab6bb`
> **Database ID:** `resale_db`

---

## 1. Database Collections Overview

Found **15** total collections in database `resale_db`:

| Collection ID | Name | Document Security | Status |
|---|---|---|---|
| `alpha_items` | alpha_items | DLS Enabled | ✅ Active |
| `tags` | tags | Standard | ✅ Active |
| `org_settings` | Organization Settings | DLS Enabled | ✅ Active |
| `carts` | Carts | DLS Enabled | ✅ Active |
| `expenses` | Expenses | DLS Enabled | ✅ Active |
| `items` | Resale Items | DLS Enabled | ✅ Active |
| `api_keys` | API Keys | DLS Enabled | ✅ Active |
| `items_dev` | Resale Dev Items | DLS Enabled | ✅ Active |
| `tenant_domains` | Tenant Domains | DLS Enabled | ✅ Active |
| `purchases_dev` | Purchases (Dev) | Standard | ✅ Active |
| `sales_dev` | Sales | Standard | ✅ Active |
| `locations_dev` | Locations | Standard | ✅ Active |
| `purchases` | Purchases | DLS Enabled | ✅ Active |
| `sales` | Sales | DLS Enabled | ✅ Active |
| `warehouses` | Warehouses | DLS Enabled | ✅ Active |

---

## 2. Detailed Schemas & Collection Inspection

### 📁 Collection: `items_dev` (Resale Dev Items)

| Attribute Key | Expected Type | Expected Size / Array | Live Appwrite Status | Action Needed |
|---|---|---|---|---|
| `title` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `identity` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `conditionNotes` | `string` | 5000 | ✅ Active (Status: available) | ⚪ Synced |
| `status` | `string` | 50 | ✅ Active (Status: available) | ⚪ Synced |
| `tenantId` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `upc` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `locationSku` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `storageLocation` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `sellingLocations` | `string[]` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `warehouseId` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `saleId` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `cost` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `resalePrice` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `soldPrice` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `maxBuyPrice` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `parentLotId` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `quantity` | `integer` | - | ✅ Active (Status: available) | ⚪ Synced |
| `components` | `string` | 65000 | ✅ Active (Status: available) | ⚪ Synced |
| `imageId` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `galleryImageIds` | `string[]` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `receiptImageId` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `keywords` | `string[]` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `marketDescription` | `string` | 65000 | ✅ Active (Status: available) | ⚪ Synced |
| `rawAnalysis` | `string` | 65000 | ✅ Active (Status: available) | ⚪ Synced |
| `cartId` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `sourcingLocation` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `redFlags` | `string[]` | 255 | ℹ️ *Extra DB Field* | ⚪ Keep (Existing) |
| `commissionPaid` | `double` | - | ℹ️ *Extra DB Field* | ⚪ Keep (Existing) |
| `purchasePrice` | `double` | - | ℹ️ *Extra DB Field* | ⚪ Keep (Existing) |
| `salesChannel` | `string[]` | 255 | ℹ️ *Extra DB Field* | ⚪ Keep (Existing) |
| `condition` | `string` | 255 | ℹ️ *Extra DB Field* | ⚪ Keep (Existing) |
| `countryOfOrigin` | `string` | 50 | ℹ️ *Extra DB Field* | ⚪ Keep (Existing) |
| `purchaseId` | `string` | 255 | ℹ️ *Extra DB Field* | ⚪ Keep (Existing) |
| `locationId` | `string` | 255 | ℹ️ *Extra DB Field* | ⚪ Keep (Existing) |

**Collection Summary:** ✅ **26** matched | ➕ **0** missing | ℹ️ **8** extra custom attributes

**Indexes (5 active):**

| Index Key | Type | Attributes | Status |
|---|---|---|---|
| `idx_identity` | `key` | `identity` | ✅ available |
| `purchaseId_idx` | `key` | `purchaseId` | ✅ available |
| `idx_saleId` | `key` | `saleId` | ✅ available |
| `idx_warehouseId` | `key` | `warehouseId` | ✅ available |
| `parentLotId_idx` | `key` | `parentLotId` | ✅ available |

---

### 📁 Collection: `items` (Resale Items)

| Attribute Key | Expected Type | Expected Size / Array | Live Appwrite Status | Action Needed |
|---|---|---|---|---|
| `title` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `identity` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `conditionNotes` | `string` | 5000 | ✅ Active (Status: available) | ⚪ Synced |
| `status` | `string` | 50 | ✅ Active (Status: available) | ⚪ Synced |
| `tenantId` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `upc` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `locationSku` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `storageLocation` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `sellingLocations` | `string[]` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `warehouseId` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `saleId` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `cost` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `resalePrice` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `soldPrice` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `maxBuyPrice` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `parentLotId` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `quantity` | `integer` | - | ✅ Active (Status: available) | ⚪ Synced |
| `components` | `string` | 65000 | ✅ Active (Status: available) | ⚪ Synced |
| `imageId` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `galleryImageIds` | `string[]` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `receiptImageId` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `keywords` | `string[]` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `marketDescription` | `string` | 65000 | ✅ Active (Status: available) | ⚪ Synced |
| `rawAnalysis` | `string` | 65000 | ✅ Active (Status: available) | ⚪ Synced |
| `cartId` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `sourcingLocation` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `redFlags` | `string[]` | 255 | ℹ️ *Extra DB Field* | ⚪ Keep (Existing) |
| `commissionPaid` | `double` | - | ℹ️ *Extra DB Field* | ⚪ Keep (Existing) |
| `purchasePrice` | `double` | - | ℹ️ *Extra DB Field* | ⚪ Keep (Existing) |
| `salesChannel` | `string[]` | 255 | ℹ️ *Extra DB Field* | ⚪ Keep (Existing) |
| `condition` | `string` | 255 | ℹ️ *Extra DB Field* | ⚪ Keep (Existing) |
| `purchaseId` | `string` | 64 | ℹ️ *Extra DB Field* | ⚪ Keep (Existing) |
| `countryOfOrigin` | `string` | 50 | ℹ️ *Extra DB Field* | ⚪ Keep (Existing) |
| `locationId` | `string` | 255 | ℹ️ *Extra DB Field* | ⚪ Keep (Existing) |

**Collection Summary:** ✅ **26** matched | ➕ **0** missing | ℹ️ **8** extra custom attributes

**Indexes (3 active):**

| Index Key | Type | Attributes | Status |
|---|---|---|---|
| `idx_identity` | `key` | `identity` | ✅ available |
| `purchaseId_idx` | `key` | `purchaseId` | ✅ available |
| `parentLotId_idx` | `key` | `parentLotId` | ✅ available |

---

### 📁 Collection: `sales_dev` (Sales)

| Attribute Key | Expected Type | Expected Size / Array | Live Appwrite Status | Action Needed |
|---|---|---|---|---|
| `soNumber` | `string` | 255 | ❌ **Missing in DB** | ➕ Can add safely |
| `warehouseId` | `string` | 255 | ❌ **Missing in DB** | ➕ Can add safely |
| `orderId` | `string` | 255 | ❌ **Missing in DB** | ➕ Can add safely |
| `saleDate` | `datetime` | - | ✅ Active (Status: available) | ⚪ Synced |
| `status` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `grossAmount` | `float` | - | ❌ **Missing in DB** | ➕ Can add safely |
| `commissionFee` | `float` | - | ❌ **Missing in DB** | ➕ Can add safely |
| `shippingCost` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `shippingCharged` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `netPayout` | `float` | - | ❌ **Missing in DB** | ➕ Can add safely |
| `tenantId` | `string` | 255 | ❌ **Missing in DB** | ➕ Can add safely |
| `saleId` | `string` | 255 | ℹ️ *Extra DB Field* | ⚪ Keep (Existing) |
| `platform` | `string` | 255 | ℹ️ *Extra DB Field* | ⚪ Keep (Existing) |
| `salePrice` | `double` | - | ℹ️ *Extra DB Field* | ⚪ Keep (Existing) |
| `platformFees` | `double` | - | ℹ️ *Extra DB Field* | ⚪ Keep (Existing) |
| `netProfit` | `double` | - | ℹ️ *Extra DB Field* | ⚪ Keep (Existing) |
| `customerTracking` | `string` | 255 | ℹ️ *Extra DB Field* | ⚪ Keep (Existing) |

**Collection Summary:** ✅ **4** matched | ➕ **7** missing | ℹ️ **6** extra custom attributes

*No custom indexes configured for this collection.*

---

### 📁 Collection: `sales` (Sales)

| Attribute Key | Expected Type | Expected Size / Array | Live Appwrite Status | Action Needed |
|---|---|---|---|---|
| `soNumber` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `warehouseId` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `orderId` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `saleDate` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `status` | `string` | 50 | ✅ Active (Status: available) | ⚪ Synced |
| `grossAmount` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `commissionFee` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `shippingCost` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `shippingCharged` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `netPayout` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `tenantId` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |

**Collection Summary:** ✅ **11** matched | ➕ **0** missing | ℹ️ **0** extra custom attributes

**Indexes (3 active):**

| Index Key | Type | Attributes | Status |
|---|---|---|---|
| `idx_soNumber` | `key` | `soNumber` | ✅ available |
| `idx_saleDate` | `key` | `saleDate` | ✅ available |
| `idx_warehouseId` | `key` | `warehouseId` | ✅ available |

---

### 📁 Collection: `purchases_dev` (Purchases (Dev))

| Attribute Key | Expected Type | Expected Size / Array | Live Appwrite Status | Action Needed |
|---|---|---|---|---|
| `poNumber` | `string` | 50 | ✅ Active (Status: available) | ⚪ Synced |
| `vendor` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `orderId` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `purchaseDate` | `datetime` | - | ✅ Active (Status: available) | ⚪ Synced |
| `subtotal` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `shippingTotal` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `handlingTotal` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `taxTotal` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `feeTotal` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `grandTotal` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `status` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `tenantId` | `string` | 128 | ✅ Active (Status: available) | ⚪ Synced |
| `buyerId` | `string` | 128 | ✅ Active (Status: available) | ⚪ Synced |
| `trackingNumber` | `string` | 255 | ℹ️ *Extra DB Field* | ⚪ Keep (Existing) |
| `receiptImageId` | `string` | 255 | ℹ️ *Extra DB Field* | ⚪ Keep (Existing) |

**Collection Summary:** ✅ **13** matched | ➕ **0** missing | ℹ️ **2** extra custom attributes

*No custom indexes configured for this collection.*

---

### 📁 Collection: `purchases` (Purchases)

| Attribute Key | Expected Type | Expected Size / Array | Live Appwrite Status | Action Needed |
|---|---|---|---|---|
| `poNumber` | `string` | 50 | ✅ Active (Status: available) | ⚪ Synced |
| `vendor` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `orderId` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `purchaseDate` | `datetime` | - | ✅ Active (Status: available) | ⚪ Synced |
| `subtotal` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `shippingTotal` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `handlingTotal` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `taxTotal` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `feeTotal` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `grandTotal` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `status` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `tenantId` | `string` | 128 | ✅ Active (Status: available) | ⚪ Synced |
| `buyerId` | `string` | 128 | ✅ Active (Status: available) | ⚪ Synced |
| `trackingNumber` | `string` | 255 | ℹ️ *Extra DB Field* | ⚪ Keep (Existing) |
| `receiptImageId` | `string` | 255 | ℹ️ *Extra DB Field* | ⚪ Keep (Existing) |

**Collection Summary:** ✅ **13** matched | ➕ **0** missing | ℹ️ **2** extra custom attributes

**Indexes (5 active):**

| Index Key | Type | Attributes | Status |
|---|---|---|---|
| `purchaseDate` | `key` | `purchaseDate` | ✅ available |
| `grandTotal` | `key` | `grandTotal` | ✅ available |
| `poNumber` | `key` | `poNumber` | ✅ available |
| `orderId` | `key` | `orderId` | ✅ available |
| `vendor` | `key` | `vendor` | ✅ available |

---

### 📁 Collection: `warehouses` (Warehouses)

| Attribute Key | Expected Type | Expected Size / Array | Live Appwrite Status | Action Needed |
|---|---|---|---|---|
| `name` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |
| `type` | `string` | 50 | ✅ Active (Status: available) | ⚪ Synced |
| `commissionRate` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `monthlyRent` | `double` | - | ✅ Active (Status: available) | ⚪ Synced |
| `tenantId` | `string` | 255 | ✅ Active (Status: available) | ⚪ Synced |

**Collection Summary:** ✅ **5** matched | ➕ **0** missing | ℹ️ **0** extra custom attributes

**Indexes (1 active):**

| Index Key | Type | Attributes | Status |
|---|---|---|---|
| `idx_name` | `key` | `name` | ✅ available |

---

### 📁 Collection: `alpha_items` (alpha_items)

*Auxiliary / Custom Collection (No strict blueprint assigned)*

| Attribute Key | Live Type | Size / Format | Required | Status |
|---|---|---|---|---|
| `title` | `string` | 255 | Yes | ✅ available |
| `receiptImageId` | `string` | 255 | No | ✅ available |
| `status` | `string` | 50 | No | ✅ available |
| `red_flags` | `string[]` | 255 | No | ✅ available |
| `galleryImageIds` | `string[]` | 255 | No | ✅ available |
| `marketDescription` | `string` | 65000 | No | ✅ available |
| `cost` | `double` | - | No | ✅ available |
| `resalePrice` | `double` | - | No | ✅ available |
| `maxBuyPrice` | `double` | - | No | ✅ available |
| `cartId` | `string` | 36 | No | ✅ available |
| `identity` | `string` | 2000 | No | ✅ available |
| `conditionNotes` | `string` | 5000 | No | ✅ available |
| `tenantId` | `string` | 255 | No | ✅ available |
| `imageId` | `string` | 255 | No | ✅ available |
| `salesChannel` | `string[]` | 255 | No | ✅ available |
| `keywords` | `string[]` | 255 | No | ✅ available |
| `parentLotId` | `string` | 255 | No | ✅ available |
| `quantity` | `integer` | - | No | ✅ available |
| `components` | `string` | 65535 | No | ✅ available |
| `rawAnalysis` | `string` | 65000 | No | ✅ available |
| `condition` | `string` | 255 | No | ✅ available |
| `sellingLocations` | `string[]` | 100 | No | ✅ available |
| `storageLocation` | `string` | 255 | No | ✅ available |
| `sourcingLocation` | `string` | 512 | No | ✅ available |
| `redFlags` | `string[]` | 255 | No | ✅ available |
| `upc` | `string` | 255 | No | ✅ available |
| `locationSku` | `string` | 255 | No | ✅ available |

**Total Attributes:** 27

**Indexes (1 active):**

| Index Key | Type | Attributes | Status |
|---|---|---|---|
| `idx_title` | `key` | `title` | ✅ available |

---

### 📁 Collection: `tags` (tags)

*Auxiliary / Custom Collection (No strict blueprint assigned)*

| Attribute Key | Live Type | Size / Format | Required | Status |
|---|---|---|---|---|
| `label` | `string` | 255 | Yes | ✅ available |
| `type` | `string` | 50 | Yes | ✅ available |
| `tenantId` | `string` | 50 | No | ✅ available |

**Total Attributes:** 3

**Indexes (2 active):**

| Index Key | Type | Attributes | Status |
|---|---|---|---|
| `idx_label` | `key` | `label` | ✅ available |
| `idx_type` | `key` | `type` | ✅ available |

---

### 📁 Collection: `org_settings` (Organization Settings)

*Auxiliary / Custom Collection (No strict blueprint assigned)*

| Attribute Key | Live Type | Size / Format | Required | Status |
|---|---|---|---|---|
| `tenantId` | `string` | 255 | Yes | ✅ available |
| `placedLocations` | `string[]` | 255 | No | ✅ available |
| `allowedDomains` | `string[]` | 255 | No | ✅ available |

**Total Attributes:** 3

*No custom indexes configured for this collection.*

---

### 📁 Collection: `carts` (Carts)

*Auxiliary / Custom Collection (No strict blueprint assigned)*

| Attribute Key | Live Type | Size / Format | Required | Status |
|---|---|---|---|---|
| `source` | `string` | 255 | Yes | ✅ available |
| `tenantId` | `string` | 255 | Yes | ✅ available |
| `buyerId` | `string` | 255 | Yes | ✅ available |
| `status` | `string` | 50 | No | ✅ available |
| `itemCount` | `integer` | - | No | ✅ available |
| `totalCost` | `double` | - | No | ✅ available |
| `projectedRevenue` | `double` | - | No | ✅ available |
| `potentialProfit` | `double` | - | No | ✅ available |
| `date` | `datetime` | - | No | ✅ available |
| `completedAt` | `datetime` | - | No | ✅ available |
| `processedAt` | `datetime` | - | No | ✅ available |

**Total Attributes:** 11

*No custom indexes configured for this collection.*

---

### 📁 Collection: `expenses` (Expenses)

*Auxiliary / Custom Collection (No strict blueprint assigned)*

| Attribute Key | Live Type | Size / Format | Required | Status |
|---|---|---|---|---|
| `cartId` | `string` | 255 | Yes | ✅ available |
| `tenantId` | `string` | 255 | Yes | ✅ available |
| `amount` | `double` | - | Yes | ✅ available |
| `note` | `string` | 1000 | No | ✅ available |
| `receiptImageId` | `string` | 255 | No | ✅ available |
| `date` | `datetime` | - | Yes | ✅ available |
| `purchaseId` | `string` | 128 | No | ✅ available |

**Total Attributes:** 7

*No custom indexes configured for this collection.*

---

### 📁 Collection: `api_keys` (API Keys)

*Auxiliary / Custom Collection (No strict blueprint assigned)*

| Attribute Key | Live Type | Size / Format | Required | Status |
|---|---|---|---|---|
| `key` | `string` | 255 | Yes | ✅ available |
| `name` | `string` | 255 | Yes | ✅ available |
| `userId` | `string` | 255 | Yes | ✅ available |
| `tenantId` | `string` | 255 | Yes | ✅ available |
| `isActive` | `boolean` | - | No | ✅ available |

**Total Attributes:** 5

*No custom indexes configured for this collection.*

---

### 📁 Collection: `tenant_domains` (Tenant Domains)

*Auxiliary / Custom Collection (No strict blueprint assigned)*

| Attribute Key | Live Type | Size / Format | Required | Status |
|---|---|---|---|---|
| `domain` | `string` | 255 | Yes | ✅ available |
| `tenantId` | `string` | 255 | Yes | ✅ available |
| `isActive` | `boolean` | - | No | ✅ available |
| `storeName` | `string` | 255 | No | ✅ available |

**Total Attributes:** 4

*No custom indexes configured for this collection.*

---

### 📁 Collection: `locations_dev` (Locations)

*Auxiliary / Custom Collection (No strict blueprint assigned)*

| Attribute Key | Live Type | Size / Format | Required | Status |
|---|---|---|---|---|
| `locationId` | `string` | 255 | Yes | ✅ available |
| `type` | `string` | 255 | No | ✅ available |
| `parentId` | `string` | 255 | No | ✅ available |
| `barcode` | `string` | 255 | No | ✅ available |
| `description` | `string` | 255 | No | ✅ available |

**Total Attributes:** 5

*No custom indexes configured for this collection.*

---

## 3. Storage Buckets Audit

| Bucket ID | Description | Live Cloud Status | File Security | Allowed Extensions |
|---|---|---|---|---|
| `item_images` | Item Images (Production) | ✅ Online (Enabled: true) | Public Read | `jpg, jpeg, png, webp, gif, json, txt` |
| `item_images_dev` | Item Images (Development) | ✅ Online (Enabled: true) | Public Read | `jpg, jpeg, png, webp, gif, json, txt` |
| `reports` | Scout Reports (Production) | ✅ Online (Enabled: true) | Public Read | `md, json, txt, html` |
| `reports_dev` | Scout Reports (Development) | ✅ Online (Enabled: true) | Public Read | `json, md, txt` |

---

### 💡 Audit Summary & Recommendations

1. **Zero Data Risk:** This audit is completely read-only. No documents, attributes, or files were modified.
2. **Non-Destructive Synchronization:** When running a sync, only missing attributes (`➕`) are created. No existing fields or data are ever deleted.
3. **Storage Health:** All primary product and scout report buckets are online and accepting standard image and document formats.

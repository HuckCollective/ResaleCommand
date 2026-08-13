# Data Ingestion Quirks & Edge Cases

When importing data from external marketplaces or auction sites, ResaleCommand handles several known formatting quirks to ensure robust parsing. This document outlines those edge cases for future developers.

## 1. ShopGoodwill CSV Imports (Byte Order Marks)

When users export their "All Shipped Orders" from ShopGoodwill as a CSV via Microsoft Excel, the resulting file often contains an invisible **Byte Order Mark (BOM)** character (`\uFEFF`) at the very beginning of the file. 

Because ShopGoodwill places the `Order #` column as the very first column in their export format, this invisible character gets permanently prepended to the column header string (making it `\uFEFFOrder #` instead of just `Order #`).

### The Bug It Caused
Historically, our exact-string matching algorithm in `findCol` would fail to recognize the `Order #` column because `'Order #'` does not strictly equal `'\uFEFFOrder #'`. 

When this exact match failed, the algorithm would fall back to a "fuzzy includes" match. If a column like `Order Date` happened to be evaluated by the fuzzy matcher first, it would accidentally match the keyword `'order'` and the importer would assign the wrong column to `orderId`, leading to downstream logic defaulting the Purchase Order's `orderId` to the `Item Id` instead. This resulted in the creation of many "fake" Purchase Orders (one for each item).

### The Fix
To guarantee we correctly extract headers from ShopGoodwill and other external CSVs, our column finding utility now actively scans for and strips any invisible BOM characters before evaluating matches:

```javascript
const cleanHeader = rawHeader.toLowerCase().replace(/\ufeff/g, '').trim();
```

This ensures that `\uFEFFOrder #` correctly maps to our `orderId` data models without relying on dangerous fuzzy fallback matches.

*(Note: Both `BulkImport.vue` and `CsvImporter.vue` have been hardened against this specific edge case).*

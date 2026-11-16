---
trigger: glob
globs: "**/src/**/sales/**, **/src/lib/sales*, **/src/lib/ricochet*, **/src/composables/useRicochetSalesSync.ts, **/public/ricochet-upc-sync.user.js"
description: "Mandatory Ricochet POS CSV, ticket-line multiset deduplication, Booth Bin lock, and sold-date invariants."
---

# Sales Reconciliation, Payout Sync & Settlement Invariants

This rule defines the strict accounting invariants, venue isolation laws, and data-protection guardrails for sales imports, payout reconciliations, and co-op settlements in **Resale Command**.

---

## 1. The Sale Date Authority Law (Anti-Timestamp Hallucination)
1. **The Venue Register is the Sole Date Authority**:
   - The `saleDate` of any sold item MUST originate directly from the POS register transaction timestamp (e.g. the `Sold` column `MM-DD-YYYY` or `Sold Date` in Ricochet CSVs).
2. **Absolute Prohibition of Database Creation Timestamps**:
   - **NEVER** use `item.$createdAt`, `item.$updatedAt`, `Paid` check dates, or `new Date()` as a sale date.
   - Database creation timestamps only indicate when a row was inserted into Appwrite, NOT when money changed hands at the retail counter.

---

## 2. Prohibition of Synthetic Sales from Raw Inventory
1. **Only Official Sales Collection Documents are Real Sales**:
   - Financial ledgers, realized revenue KPI cards, and partner settlement statements must **ONLY** aggregate verified documents from the `sales` collection.
2. **No Fabricated Fallbacks**:
   - Never synthesize temporary or fake sale rows out of unlinked inventory items simply because `status === 'sold'`.
   - If an inventory item is marked `sold` but has no corresponding `sales` document, flag it for reconciliation in the Sync workbench — NEVER silently dump it into realized revenue.

---

## 3. Strict Multi-Month Cycle Partitioning
1. **Never Mash Multiple Months into a Single Settlement**:
   - Venue payout reports (such as Memory Den Payout History) frequently contain 3 to 12 months of historical data in a single CSV.
   - Importer and settlement views MUST group records into discrete 1-indexed `YYYY-MM` monthly cycles based strictly on the calendar `Sold` date (`calendarMonthKeyFromDateString` / `pacificMonthKey` in `src/lib/salesBucketing.ts`).
2. **One Month's Rent per Monthly Cycle**:
   - Monthly booth rent (resolved dynamically from `warehouses.monthlyRent`, e.g. `$382.50/mo` at Memory Den) applies strictly to its respective calendar month cycle.
   - Never subtract a single month's rent from a multi-month cumulative gross total.

---

## 4. Strict Venue Attribution vs. Partner Prefix Separation
1. **Prefix = Consignor / Curator (Who Curated It)**:
   - `HUCK-`, `PDXGL-`, and `BB-` identify the partner organization or consignor associated with the item.
2. **Location / Warehouse = Physical Selling Channel (Where It Sold)**:
   - A sale is attributed to a booth (`MD`, `DT`, etc.) **ONLY** if the sale record explicitly links to that canonical warehouse document / location code.
   - Having a `HUCK-`, `BB-`, or `PDXGL-` barcode prefix **NEVER** implies the item sold at Memory Den — it could sell online, at Dusty Tiger, or via pop-up.

---

## 5. Live Production Dataset Protection (Zero Data Corruption)
When syncing or importing into live `items` and `sales` collections:
1. **Idempotent Imports (No Double-Counting)**:
   - Deduplicate strictly via POS ticket-line multiset counting (`ticketLineKey(ticket, gross, net)` — see §15) and Layer 3 database ticket + date + location checks.
2. **Non-Destructive Inventory Updates**:
   - Matching a single-unit (`quantity === 1`) sale updates `status: 'sold'`, `saleId`, and `soldPrice`. (Multi-quantity Booth Bins follow the §15 LOCKED DECISION and are never depleted by Sales Commit.)
   - **Immutable Fields**: Landed purchase cost (`cost`), purchase order ID (`purchaseId`), barcodes (`upc`, `sku`), and lineage (`parentLotId`) are **LOCKED and IMMUTABLE**.
3. **Dry-Run Review Before Database Commit**:
   - Always present matched items, unmatched count, and expected net totals in the confirmation UI (`SlideOverDrawer`) before committing writes.

---

## 6. Booth Overhead & Consignor Sub-Lease Rent Law (Aligned with `src/lib/coopGovernance.ts`)
1. **Contractual Consignor Sub-Lease Offset First**:
   - Outside consignors (`BB-`) are governed by configurable `ConsignorAgreementConfig` in `src/lib/coopGovernance.ts`. By default, `BB-` is an external sub-tenant paying a **fixed `$85.41/mo` contractual rent offset** (`85%` gross less venue fee, minus `$85.41/mo`, `0%` Commons Pool split), reducing the Co-op's net booth rent burden (e.g. `$382.50 - $85.41 = $297.09` Net Co-op Rent).
   - If a consignor's agreement is configured to proportional rent mode instead of fixed sub-lease mode, deduct their configured share per `coopGovernance.ts` — never pay an unencumbered `85%` gross payout with `$0` rent contribution.
2. **Co-op Commons Waterfall (`HUCK-` & `PDXGL-`)**:
   - Co-op member sales follow the WSDE waterfall: 1) Venue Fee (`warehouses.commissionRate`) ➔ 2) `100%` verified Curator Cost Basis Recouped ➔ 3) Net Surplus split `70%` Curator / `30%` Co-op Commons Pool (which funds Net Co-op Rent and shared supplies).

---

## 7. Zero-Cost Basis Rule (No Cost = Straight Net Split)
1. **Documented Receipts Required for Capital Recoupment**:
   - `100%` cost recoupment applies ONLY when an item has a verified landed purchase cost (`cost > 0`).
2. **Fallback for Uncosted Goods**:
   - If `cost === 0` or omitted, zero phantom cost basis may be invented; net proceeds flow directly into the applicable partner/co-op split.

---

## 8. The 100% Sales Recording Mandate
1. **Every Register Transaction Must Be Preserved**:
   - Every real sale line on a POS payout statement reflects an actual retail customer transaction; unmatched rows must NEVER be dropped or omitted.
2. **Auto-Create on Commit**:
   - Any sale row not mapped to existing inventory is auto-created as a sold catalog item (`quantity: 1`, `cost: 0`, `status: 'sold'`) with an official sequential barcode (`HUCK-`, `PDXGL-`, or `BB-`) and linked to the `sales` record.

---

## 9. Multi-Quantity Batch Stock Invariant & Appwrite Schema Law
1. **1 SKU = 1 Unit Terminal Rule (Unless Multi-Qty Booth Bin)**:
   - Single-unit vintage goods (`quantity === 1`) sell at most **ONCE**.
   - Multi-qty Booth Bins (`$10` book packs, felt hats, choice bins with `quantity > 1`) legitimately sell across many tickets.
2. **Strict Appwrite Schema Compliance (No `isMultiQty` or `quantity: 0` in Database)**:
   - Appwrite's `items` collection uses integer `quantity >= 1`, NOT `isMultiQty`.
   - **NEVER** send `isMultiQty` or `quantity: 0` in Appwrite payloads; derive `isMultiQty` in memory (`quantity > 1`).

---

## 10. Location-Scoped Staging Persistence & Manifest Archive Law
1. **Location-Scoped Local + Cloud Persistence**:
   - Always scope client staging storage by canonical location code via `getScopedStagingStorageKey(code)` (NEVER use unscoped legacy keys like `rc_sales_importer_staging_v1`, which cross-contaminate booths).
   - Cloud staging/commit state lives in Appwrite `manifests` (`staged ➔ committed` with `committed_at` and `committed_count`).
2. **Historic Settlement Archive**:
   - Committed sales live permanently in `resale_db.sales`, grouped dynamically by calendar `Sold` month for historical inspection and statements.

---

## 11. Exact-to-the-Penny Mathematical Payout Ground Truth Law
1. **Penny-Exact Matching Mandate**:
   - Gross register sales, venue commissions (`warehouses.commissionRate`), space rental deductions, and net check payouts MUST match the venue's physical payout statement to the exact penny (`Number(val.toFixed(2))`).

---

## 12. Combined Lot Dereferencing & Booth Bin Non-Depletion Alignment
1. **The Lineage Absorption Law (Anti-Child Zombie Attribution)**:
   - Items merged into a combined lot carry `status: 'combined'` and `parentLotId` pointing to the active Parent Lot.
   - **Title Search Exclusion**: Items with `status === 'combined'` or `'deconstructed'` must NEVER match by title or keyword in sales reconciliation.
   - **SKU/UPC Dereferencing**: If a register sale matches the `upc` or `locationSku` of a `status === 'combined'` child, dereference `parentLotId` to bind the sale to the active Parent Lot.
2. **Booth Bin Matching & Lock (`buildLockedMultiBinMap`)**:
   - Reconcilers MUST NOT exhaust a multi-qty Booth Bin (`quantity > 1`, `isMultiQty`, or locked via `buildLockedMultiBinMap` in `src/lib/salesBucketing.ts`) after a single ticket match; all repeat ticket lines bind to that Booth Bin SKU.
3. **Commit Stock Rule (Aligned with §15 LOCKED DECISION)**:
   - **Single-Unit Items (`!isBinSale`, `quantity === 1`)**: Mark `status: 'sold'`, `quantity: 1` (never `0`), `saleId`, and `soldPrice`.
   - **Multi-Qty Booth Bins (`isBinSale`)**: Sales Commit writes **ONLY** the `sales` documents and **NEVER** decrements `items.quantity` or flips a Booth Bin to `status: 'sold'` (see §15 — live Booth Bin stock counts are governed solely by Ricochet `Products-*.csv` catalog sync and `➕ Restock Bin` to prevent double-depletion).
4. **Booth Assortment SKUs & Physical Substrate Grounding**:
   - Create strictly **ONE** Appwrite document (`quantity: N`, `resalePrice: unitPrice`) per Multi-Qty Booth Bin — never loop-create `N` separate single-unit rows.
   - Keep booth tag `title` concise (`30–40` chars) and classify physical plaques/prints/frames (`physical_substrate === "WALL_ART"`) as Wall Art & Decor before genre keywords.

---

## Duplicate Sale Cleanup: Re-link `items.saleId` Before Deleting

When removing duplicate sale records, always repair item links first:
1. Choose the surviving canonical `sales` document.
2. Re-link every `items.saleId` pointing at a duplicate to the canonical sale's `$id`.
3. Only then delete the duplicate `sales` documents (never leave dangling `saleId` references).

---

## 13. The 3 Memory Den (Ricochet) CSV Schemas

Classify strictly by headers (`isProductCatalogHeaders` in `src/lib/salesBucketing.ts`), never by filename. Use an RFC 4180 parser; booth SKUs `0EJXXX` map to `items.locationSku`.

| # | File | Headers | Creates `sales`? |
|---|------|---------|------------------|
| 1 | `Products-*.csv` — **Catalog / Stock Sync** | `"Product ID",SKU,UPC,Name,Category,Collections,Brand,"Split / Cost","Agreed Price","Aged Price","Tax Rate","Short description","Online Description",Consignor,Department,"In stock",Quantity,Inventory,"Consignor %"` | **NEVER** |
| 2 | `Payouts *.csv` — **Interim Sales** (current month) | `Item,Sale#,Agreed,Cost/Split,Aged Price,Discounts,Sold Date,Amount` | Yes |
| 3 | `Payout History *.csv` — **Settled Monthly Checks** | `Item,Sale,Agreed,Cost/Split,"Aged Price",Discounts,Paid,Sold,Amount,Check#` | Yes |

1. **`Products-*.csv` (Catalog & Stock Sync — `items` ONLY)**:
   - `In stock` is the date added to stock (NOT a sale date or quantity); live count is `Quantity`. Strip leading apostrophe on `'0EJ001` (`cleanCatalogSku`).
   - **NEVER create `sales` documents from `Products-*.csv`!** Updates `items` only (`Inventory === 'In Stock'` & `Quantity >= 1` ➔ `status: 'placed'`, `quantity: Number(Quantity)`; `Paid`/`Sold` ➔ normalize `locationSku` only).
2. **`Payouts *.csv` (Interim Sales)**:
   - `Sale#` + `Sold Date` (`YYYY-MM-DD HH:mm:ss` Pacific); `Amount` = net, `Agreed` = gross; no ` - 0EJXXX` suffix on `Item`.
3. **`Payout History *.csv` (Settled Monthly Checks)**:
   - `Sale` + `Sold` (`MM-DD-YYYY` stored as noon UTC of that calendar day); `Paid` = check date; `Item` ends with ` - 0EJXXX` (`splitTrailingBoothSku` matches `items.locationSku` first).
4. **Rows to Skip in Sales Files**:
   - `(Credit) Space Rental …`, `Total for payout`, `Total Paid:`, and rows missing `Sale`/`Agreed`/`Amount` (`isPayoutSummaryRow`).

---

## 14. Evergreen Live-Fetch Bookmarklet (`⚡ Memory Den Sync`) & 1-to-1 `0EJ...` ↔ `UPC` Bijection Law
1. **Strict 1-to-1 `0EJ...` SKU ↔ `UPC` Uniqueness**:
   - Every Ricochet SKU (`0EJ...` in `items.locationSku`) MUST map 1-to-1 to a unique barcode (`items.upc`: `HUCK-XXXX`, `PDXGL-XXXX`, or `BB-...`). Two `0EJ...` SKUs may NEVER share a `upc` (Ricochet returns `HTTP 422` on duplicate `upc_code`).
2. **Dynamic Appwrite Bijection & `usedUpcs` Self-Healing (Zero Hardcoded Collision Maps)**:
   - `GET /api/md-verify-report?mode=payload&location=${code}` builds the `0EJ... ➔ UPC` bijection dynamically from live `resale_db.items` documents using a `usedUpcs` Set, self-healing collisions in Appwrite without hardcoded `0EJ` lookup tables (Law 4).
   - `public/ricochet-upc-sync.user.js` fetches live cloud mappings on open and enforces the 3 Physical Retail Tag Safety Laws (`MISSING_IN_MD` blank-only writes, `#rc-preflight-details` preview, and 1-click `🏷️ Adopt Booth Tag` for `MISMATCH_UPC`).

---

## 15. Ticket-Line Ledger Identity & the 2026-11-04 / 2026-11-15 Incidents

### Identity of one sale line
- **One sale line = POS ticket # + gross + net**, counted as a **multiset** (`ticketLineKey` / `posTicketOfRow` in `src/composables/useRicochetSalesSync.ts`). Each existing `sales` document with that key consumes one matching CSV line; remaining lines are new. **SKU, UPC, title, price-only, or date-only is NEVER an identity.**
- Server `alreadySynced` / `isAlreadyRecorded` SKU+price shortcuts are **untrusted** for Commit filtering because they hide repeat Booth Bin sales.
- `orderId` = `Ticket #<n>` (`Ticket #<n> #<k>` for the k-th identical line). `soNumber` = UPC, else SKU, else ticket ref (never `SO-<timestamp>`).

### Sale creation, date & 15th-of-month check schedule
- Create `sales` ONLY from Payouts / Payout History rows with a **ticket # and Sold date** (`toSaleIso` stores noon UTC of that calendar day; never use `Paid` check date). If preflight `sales` read fails, abort Commit and write nothing.
- Memory Den cuts monthly checks on the **15th of the following month**; bucketing strictly by calendar `Sold` date (Law 7) + `ticketLineKey` multiset dedupe prevents cross-month drift or post-15th duplicates.
- Known ground truth: October 2026 = **63 sales / `$2,462.99` gross / `$369.45` fee / `$2,093.54` net**.

### LOCKED DECISION (owner: Mike) — Bin stock on Commit
- A Booth Bin (`quantity > 1`, `isMultiQty`, appearing on `>1` staged ticket line, or in `buildLockedMultiBinMap`) is **NEVER** depleted or flipped to `sold / qty 1` by Sales Commit (`useRicochetSalesSync.ts`). Sales Commit writes ONLY the `sales` ledger document; physical bin `quantity` is governed exclusively by Ricochet `Products-*.csv` catalog sync and `➕ Restock Bin`.

### Incident log — never repeat
| Date | What happened | Root cause |
|---|---|---|
| 2026-10-28 | 292 bogus sales | `Products-*.csv` created sales dated "today" |
| 2026-11-04 | 45 duplicate Oct sales after Commit | SKU/price heuristics + unlinked `SO-xxxxx` placeholders + UTC date roll |
| 2026-11-04 | Cleanup script deleted real bin sales | Treated "same price within 2 days" as duplicate; ignored Booth Bins |
| 2026-11-04 | 20 phantom sales dated 10-07 | Catalog "Sold" fallback + paid date used as sold date |
| 2026-11-04 | Bookmarklet dropped identical lines | Content-hash dedupe dropped repeat items on the same ticket |
| 2026-11-04 | Repeat bin sales never committed | Trusted server `alreadySynced` SKU+price shortcut |
| 2026-11-04 | ~49 items left with dangling `saleId` | Deleted duplicate sales before re-linking `items.saleId` |
| 2026-11-15 | 8 Nov sales never reached `sales` | Dry-run staging had no visible `/sales` Commit banner + `alreadySynced` hid repeat bin sales (`0EJ0M8`, `0EJ0FQ`) |

### Bookmarklet / paste path
- `🔄 Harvest` ➔ stage to cloud manifest ➔ review & commit via `SlideOverDrawer` on `/sales` (never trigger Ricochet's native `[Export]` download dialog; `📋 Paste Sync JSON / CSV` remains the manual fallback).

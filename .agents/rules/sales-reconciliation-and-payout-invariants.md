# Sales Reconciliation, Payout Sync & Settlement Invariants

This rule defines the strict accounting invariants, venue isolation laws, and data-protection guardrails for sales imports, payout reconciliations, and co-op settlements in **Resale Command**.

---

## 1. The Sale Date Authority Law (Anti-Timestamp Hallucination)
1. **The Venue Register is the Sole Date Authority**:
   - The `saleDate` of any sold item MUST originate directly from the POS register transaction timestamp (e.g. the `Sold` column `MM-DD-YYYY` in Memory Den Ricochet CSVs).
2. **Absolute Prohibition of Database Creation Timestamps**:
   - **NEVER** use `item.$createdAt`, `item.$updatedAt`, or `new Date()` as a sale date.
   - Database record creation timestamps only indicate when a row was inserted into Appwrite, NOT when money changed hands at the retail counter.

---

## 2. Prohibition of Synthetic Sales from Raw Inventory
1. **Only Official Sales Collection Documents are Real Sales**:
   - Financial ledgers, realized revenue KPI cards, and partner settlement statements must **ONLY** aggregate verified documents from the `sales` collection.
2. **No Fabricated Fallbacks**:
   - Never synthesize temporary or fake sale rows out of unlinked inventory items simply because `status === 'sold'`.
   - If an inventory item is marked `sold` but has no corresponding `sales` document, it must be flagged for reconciliation in the Sync workbench, NEVER silently dumped into realized revenue.

---

## 3. Strict Multi-Month Cycle Partitioning
1. **Never Mash Multiple Months into a Single Settlement**:
   - Venue payout reports (such as Memory Den Payout History) frequently contain 3 to 12 months of historical data in a single CSV.
   - The importer and settlement views MUST group records into discrete monthly cycles based on the `Sold` date.
2. **One Month's Rent per Monthly Cycle**:
   - Fixed monthly booth rent ($382.50 at Memory Den) applies strictly to its respective calendar month cycle.
   - Never subtract a single month's rent from a multi-month cumulative gross total.

---

## 4. Strict Venue Attribution vs. Partner Prefix Separation
1. **Prefix = Consignor / Curator (Who Curated It)**:
   - `HUCK-`, `PDXGL-`, and `BB-` identify the partner organization who sourced the item and is owed curator profit.
2. **Location / Warehouse = Physical Selling Channel (Where It Sold)**:
   - A sale is attributed to Memory Den **ONLY** if the sale record explicitly links to the Memory Den warehouse document, contains `Booth 0EJ`, or originated from an `MD-PAYOUT` ticket.
   - Having a `HUCK-`, `BB-`, or `PDXGL-` barcode prefix **NEVER** implies the item sold at Memory Den. It could have sold online, at Dusty Tiger, or through private cash sale.

---

## 5. Live Production Dataset Protection (Zero Data Corruption)
When syncing or importing into the live production environment (`items`, `sales` collections):
1. **Idempotent Imports (No Double-Counting)**:
   - Check every incoming sale row against existing database sales using a 2-point fingerprint:
     - `orderId` / Ticket Number
     - Exact `saleDate` + Gross Price + Sku
   - Duplicate sales must be safely bypassed with an informational notice.
2. **Non-Destructive Inventory Updates**:
   - Matching a sale to an inventory item updates:
     - `status: 'sold'`
     - `saleId: orderRef`
     - `soldPrice: netPrice`
   - **Immutable Fields**: Landed purchase cost (`cost`), purchase order ID (`purchaseId`), barcodes (`upc`, `sku`), and lineage (`parentLotId`) are **LOCKED and IMMUTABLE**.
3. **Dry-Run Review Before Database Commit**:
   - The user must always be presented with the matched items, unmatched count, and expected net check in the importer UI before any writes are committed.

---

## 6. Proportional Booth Overhead Sharing Law (Anti-Host Subsidy)
1. **Shared Floor Space Requires Shared Rent**:
   - All goods housed and sold within a shared retail booth (e.g., Memory Den Booth 0EJ) MUST contribute proportionally to fixed booth rent ($382.50) and verified tech operational expenses based on their share of gross revenue:
     $$\text{Partner Rent Share} = \left( \frac{\text{Partner Gross Sales}}{\text{Total Booth Gross Sales}} \right) \times \text{Fixed Booth Rent}$$
2. **Absolute Prohibition of Unencumbered Consignor Payouts**:
   - Never pay an outside consignor (e.g., B&B) a flat 85% net cut without deducting their proportional share of booth rent.
   - If a consignor receives 85% and the mall takes 15%, 0% remains to pay the physical booth rent. The managing operator would be subsidizing other people's inventory at a personal loss.

---

## 7. Zero-Cost Basis Rule (No Cost = Straight Net Split)
1. **Documented Receipts Required for Capital Recoupment**:
   - A 100% cost recoupment check is paid ONLY if an item has a verified, documented out-of-pocket landed purchase cost (`cost > 0`).
2. **Fallback for Uncosted or Historical Goods**:
   - If `cost === 0` or cost is omitted, the curator or partner receives their agreed net profit split after their proportional share of booth overhead. Zero phantom cost basis may be invented.

---

## 8. The 100% Sales Recording Mandate
1. **Every Register Transaction Must Be Preserved**:
   - Every line item on a POS payout statement reflects an actual retail customer transaction.
   - Unmatched rows must NEVER be dropped, skipped, or omitted from the database.
2. **Auto-Create on Commit**:
   - Any sale row not mapped to existing inventory must be auto-created as a sold catalog item with an official sequential barcode (`HUCK-`, `PDXGL-`, or `BB-`), landed cost 0, and marked `status: 'sold'`.
   - 100% of sales must be recorded in the `sales` collection and linked to inventory for IRS Schedule C and co-op compliance.

---

## 9. Multi-Quantity Batch Stock Invariant & Appwrite Schema Law
1. **1 SKU = 1 Unit Terminal Rule (Unless Flagged Multi-Qty)**:
   - For single-unit vintage goods, an item can sell at most **ONCE**. Once sold, it is terminal and can never sell again.
   - For batch stock ($10 book packs `0EJ0F9`, felt hats `0EJ0DC`, stickers), items legitimately sell multiple times across tickets.
2. **Strict Appwrite Schema Compliance (No `isMultiQty` in Database)**:
   - In Appwrite's `items` collection, the supported integer attribute is **`quantity`**, NOT `isMultiQty`.
   - **NEVER** send `isMultiQty` in document creation or update payloads to Appwrite; Appwrite will crash with:
     `Invalid document structure: Attribute "isMultiQty" not found in collection`.
   - Instead, set `quantity: isMulti ? Math.max(2, repeatCount) : 1` in Appwrite, and hydrate `isMultiQty` in frontend reactive memory whenever `quantity > 1`.

---

## 10. Reconciliation Workspace Auto-Save & Receipt Archive Law
1. **Continuous Local Persistence**:
   - Reconciling multi-month payout files requires matching dozens or hundreds of items.
   - The importer workspace must continuously auto-save staging state to `localStorage` (`rc_sales_importer_staging_v1`) on every parse, link, unlink, month switch, and commit.
   - Page reloads, server restarts, and tab switching must **NEVER** wipe in-progress reconciliation matches.
2. **Historic Settlement Archive**:
   - Committed settlements must be permanently stored in persistent history (`rc_sales_reconciliation_history_v1`).
   - Resellers and co-op partners must be able to view historic statement breakdowns and re-download PDF settlement reports at any time.

---

## 11. Exact-to-the-Penny Mathematical Payout Ground Truth Law
1. **Penny-Exact Matching Mandate**:
   - Payout reconciliations are legal and tax-binding financial accounting documents.
   - Gross register sales, venue commissions (15%), space rental deductions, and net check payouts MUST match the venue's physical check and payout statement down to the exact penny:
     $$\text{Net Check Payout} = \text{Gross Register Sales} - \text{Mall Commission (15\%)} - \text{Space Rental}$$
2. **No Approximation or Rounding Drift**:
   - Every financial metric must use standard two-decimal cash accounting (`Number(val.toFixed(2))`). Zero mathematical drift is tolerated.

---

## 12. Combined Lot Dereferencing & Multi-Quantity Partial Depletion Law

1. **The Lineage Absorption Law (Anti-Child Zombie Attribution)**:
   - When items are merged into a combined lot, the original component items are set to `status: 'combined'` with their `parentLotId` pointing to the active Parent Lot.
   - **Title Search Exclusion**: Items with `status === 'combined'` or `'deconstructed'` must NEVER be matched by title, name, or keyword searches in any reconciliation or sales import workflow.
   - **SKU/UPC Dereferencing**: If an incoming register sale row matches the exact `upc` or `locationSku` of a `status === 'combined'` child item, the system MUST automatically dereference `parentLotId` and bind the sale to the active Parent Lot document. Child items must NEVER be directly marked `sold`.

2. **Stateful Stock Capacity Counter (`remainingStockMap`)**:
   - Reconcilers and CSV matchers MUST NOT lock or exhaust an item after a single match if `item.quantity > 1` or `item.isMultiQty`.
   - Maintain a stateful capacity counter initialized to `remainingStock = Math.max(1, Number(item.quantity || 1))`.
   - When multiple sales rows match the same multi-quantity lot (e.g. 4 copies of "Frank Frazetta Fantasy Art" sold across different tickets), all rows bind to that Parent Lot while decrementing its `remainingStock` counter ($9 \to 8 \to 7 \to 6 \to 5$).
   - When resolving title matches, active Parent Lots (`quantity > 1`, `status === 'placed'`) take strict precedence over single-unit items.

3. **Partial vs. Full Multi-Quantity Depletion on Commit (Appwrite Schema Safe)**:
   - When committing $K$ sales against an item with quantity $N$:
     * **Sales Collection**: Create all $K$ verified sale records in the `sales` collection linked to the Parent Lot's UPC/SKU.
     * **Partial Depletion ($K < N$)**:
       - Update the Parent Lot's `quantity` to $N - K$ (e.g. 5 remaining).
       - Maintain active status (`status: 'placed'` or `'in-stock'`). **NEVER** mark a Parent Lot `'sold'` while units remain in stock!
       - Adjust remaining inventory cost basis proportionally:
         $$\text{Unit Cost} = \frac{\text{Total Cost}}{N}, \quad \text{Remaining Cost} = \text{Unit Cost} \times (N - K)$$
       - Credit $\text{Unit Cost} \times K$ to the current monthly settlement's recouped basis.
     * **Full Depletion ($K \ge N$)**:
       - Set `status: 'sold'`.
       - Set `quantity: 1` (never 0, strictly respecting Appwrite's integer validation constraint `quantity >= 1`).




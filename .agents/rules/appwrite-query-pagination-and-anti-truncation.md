# Appwrite Query Pagination & Anti-Truncation Invariants

## 1. The Anti-Truncation Invariant
- **Never Hardcode Low Arbitrary Limits on Datasets That Feed Ledgers or Settlements**:
  - Collections like `sales`, `expenses`, `inventory`, `purchases`, and `manifests` feed financial ledgers, co-op partner splits, tax totals, and monthly settlement statements.
  - In Appwrite SDK:
    - If no limit is specified, Appwrite defaults to **25 records**.
    - If `Query.limit(100)` is hardcoded, results are silently capped at **100 records**.
  - **The Silent Failure Trap**: During initial development with only 20 test items, `Query.limit(100)` appears to work. But once a store operates across 6–12 months and passes 100 sales, earlier months silently disappear from dropdowns, metrics, and partner statements without throwing any error!

## 2. Mandatory Pagination Pattern for API Wrappers
All centralized API listing methods (`salesApi.listSales`, `coopExpensesApi.listExpenses`, `purchasesAPI.listPurchases`, etc.) MUST implement auto-pagination up to `maxItems` (defaulting to 5,000):

```typescript
async listSales(tenantId: string, maxItems: number = 5000): Promise<SaleDocument[]> {
    if (!tenantId) throw new Error("tenantId is required");
    
    let allDocs: SaleDocument[] = [];
    let offset = 0;
    const pageSize = Math.min(maxItems, 1000);

    while (allDocs.length < maxItems) {
        const queries = [
            Query.equal('tenantId', tenantId),
            Query.orderDesc('saleDate'),
            Query.limit(Math.min(pageSize, maxItems - allDocs.length))
        ];
        if (offset > 0) {
            queries.push(Query.offset(offset));
        }

        const response = await databases.listDocuments(
            DB_ID,
            getSalesCol(),
            queries
        );

        const docs = response.documents as SaleDocument[];
        if (docs.length === 0) break;
        allDocs.push(...docs);
        offset += docs.length;

        if (allDocs.length >= response.total || docs.length < pageSize) {
            break;
        }
    }
    return allDocs;
}
```

## 3. UI Truth in Metrics & Dropdowns
- **Never Label Capped Data as "All Time"**:
  - If a query is capped at 100 items, the UI must NEVER display `"All Time Realized (100 sales)"` unless the database total is actually 100.
  - All monthly cycle dropdowns (`availableMonths` in `CoopSettlementView.vue`) must have access to the full historical transaction scope, so historical months (e.g. September, August, July, June, May, April) are never masked by recent sales.

## 4. Multi-Month & Enterprise Scale Invariants
- Resale Command is built for multi-partner cooperative booths, consignors, and antique malls operating across multiple years with thousands of items.
- All ledger algorithms, cost-basis calculations, partner surplus distributions, and CSV imports must handle batches of 1,000 to 10,000+ items without performance degradation, memory leaks, or silent truncations.

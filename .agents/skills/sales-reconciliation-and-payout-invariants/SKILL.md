---
name: sales-reconciliation-and-payout-invariants
description: READ FIRST before touching the Ricochet Sales Sync, the Commit button, sales de-duplication, payout CSV imports, sold-date logic, or any script that deletes/edits `sales`. Booth Bin (multi-qty) sales, the exact ticket ledger, sold-date rules, and the incident history that must never repeat.
---

# Sales Sync - READ FIRST (pointer skill)

**The full rules live in ONE place: [`.agents/rules/sales-reconciliation-and-payout-invariants.md`](file:///c:/Users/15034/Projects/ResaleCommand/.agents/rules/sales-reconciliation-and-payout-invariants.md).**
Read it before editing anything below. Do not copy its rules into this file (copies drift).

## 30-second checklist
1. **Booth Bins:** one SKU sells many times (rule file §9, §12; `resale-booth-sync` §2.4). SKU + price is NEVER an identity.
2. **Identity of one sale line = ticket # + gross + net, counted as a multiset** (rule file §15). Never SKU/title/price/date alone, never server `alreadySynced` flags.
3. **Sold date = the Ricochet Sold column** (rule file §1, §15). Never paid date, catalog date, `$createdAt` or `new Date()`.
4. **Catalog `Products-*.csv` / `/api/product` "Sold" items NEVER create sales** (rule file §13).
5. **Before deleting any sale:** re-link `items.saleId` first (rule file "Duplicate Sale Cleanup").
6. **Every script that edits/deletes `sales`:** lives in git-ignored `scratch/`, runs DRY-RUN first, and is verified against the user's two CSV exports (Payouts + Payout History).
7. `npm run verify` (`scripts/validate-templates.mjs` section 5b) fails if sold-date/hardcoding/SO-timestamp rules are broken.

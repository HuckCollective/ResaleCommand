---
name: tax-and-expense-compliance
description: Standard Operating Procedure (SOP), IRS Schedule C / Form 1065 statutory tax categories, strict proof-of-payment invariants, anti-phantom expense rules, and cooperative fiduciary standards for Resale Command.
---

# Resale Command: Tax & Expense Compliance Standards

This skill defines the accounting invariants, IRS substantiation requirements, statutory expense categorization, and cooperative reimbursement rules for **Resale Command** and the **Huckleberry Collective**.

---

## 1. The Core Tax Problem: The "Phantom Expense" Law

Under **Internal Revenue Code (IRC) § 162** (Trade or Business Expenses), a business deduction is strictly allowed only for expenses that are **ordinary, necessary, and actually paid or incurred**.

```
┌────────────────────────────────────────────────────────┐
│              DOCUMENTARY TAX SUBSTANTIATION            │
├──────────────────────────┬─────────────────────────────┤
│  STATUS ON DOCUMENT      │  IRS LEGAL TAX STATUS       │
├──────────────────────────┼─────────────────────────────┤
│  "Paid" / "Settled"      │  ✅ Deductible Expense       │
│  "Declined"              │  ❌ ILLEGAL / PHANTOM DEDUCTION │
│  "Failed"                │  ❌ ILLEGAL / PHANTOM DEDUCTION │
│  "Pending"               │  ⏳ Unconfirmed (Not Settled)│
│  "Void" / "Cancelled"    │  ❌ Zero Cost Basis         │
│  "Refunded" / "Reversed" │  🔄 Offset / Credit Memo    │
└──────────────────────────┴─────────────────────────────┘
```

### The 4 High-Risk Tax Violations
1. **Deducting Declined / Failed Transactions**:
   - If a credit card or bank declines a charge, **$0.00 left the business or taxpayer's possession**.
   - Claiming a declined transaction on IRS Schedule C (or Form 1065 / 1120-S) creates a **phantom deduction**.
   - In an IRS audit, claiming unpaid or declined charges triggers immediate disallowance and **IRC § 6662 Accuracy-Related Penalties** (20% penalty on underpayment) or fraud penalties.
2. **Billing Retry Multi-Counting**:
   - Subscription services (Google Cloud, Google One, Appwrite, Vercel) automatically retry failed cards multiple times per cycle (e.g. Oct 14 retry #1, Oct 14 retry #2).
   - Counting each failed attempt as a separate $99.99 purchase multiplies a single $99.99 bill into an artificial $399.96 deduction.
3. **Audit Evidence Deficit (IRS Pub 583 & Rev. Proc. 92-71)**:
   - For an audit, the taxpayer must provide **proof of payment**:
     - Canceled check or bank statement showing charge cleared.
     - Credit card statement showing settled charge.
     - Merchant invoice marked **"PAID - $XX.XX - Balance Due: $0.00"**.
   - Submitting an invoice or screenshot marked **"Declined"** serves as documentary evidence **proving the taxpayer did not pay**.
4. **Cooperative Commons Pool Embezzlement Risk**:
   - In the Huckleberry Collective (and any WSDE or multi-member group), expenses logged in the Commons Ledger are reimbursed **dollar-for-dollar** from the 30% Shared Commons Pool.
   - If a member logs a $399.96 declined screenshot and receives a payout check, they have taken cash from the collective without paying out of pocket.

---

## 2. Statutory IRS Tax Expense Categories

Resale Command must **never** record generic "Expense" line items without mapping them to statutory tax buckets. Every expense must be classified into one of the following IRS Schedule C / Form 1065 categories:

| Tax Bucket | IRS Schedule C Line | Resale Command Usage Examples | Audit Requirement |
| :--- | :--- | :--- | :--- |
| **`COGS`** (Cost of Goods Sold) | Part III, Line 36 | Goodwill hauls, estate sale lots, ShopGoodwill auctions, garage sale inventory. | Landed receipt / manifest with unit cost basis. |
| **`SOFTWARE_SAAS`** | Line 27a (Other Expenses) | Google AI / Gemini API, Appwrite, Vercel, Shopify, Airtable, Ricochet POS software fees. | Monthly invoice showing paid amount. |
| **`BOOTH_RENT`** | Line 20b (Rent on Business Property) | Memory Den monthly booth rent ($382.50), DustyTiger booth fee, pop-up market table fees. | Venue settlement payout slip showing rent deduction. |
| **`SUPPLIES`** | Line 22 (Supplies) | Direct thermal label rolls (Rollo, Zebra), jewelry tags, barcode ribbons, hangers, display crates. | Retail / Amazon invoice showing paid items. |
| **`SHIPPING_POSTAGE`** | Line 18 (Office Exp) or Line 27a | USPS postage, Pirate Ship, poly mailers, bubble wrap, tape. | Carrier shipping receipt / Pirate Ship ledger. |
| **`FEES_COMMISSIONS`** | Line 10 (Commissions) or Line 27a | Memory Den 15% register cut, eBay final value fees, Stripe 2.9% + 30¢ processing fees. | Settlement report showing withheld commission. |
| **`TRAVEL_MILEAGE`** | Line 9 (Car and Truck Expenses) | Driving between thrift stores, estate sales, auction pickups (IRS standard mileage rate). | Mileage log with date, destination, business purpose, odometer start/stop. |
| **`REPAIRS_MAINT`** | Line 21 (Repairs & Maintenance) | Vintage apparel dry cleaning, wood furniture refinishing wax, leather dye, sewing repairs. | Service invoice / materials receipt. |

---

## 3. Mixed-Use Business vs. Personal Allocation (IRC § 280A & § 274)

Certain recurring subscriptions and assets have inherent **mixed-use** characteristics:
- **Google One / Google AI Ultra (20 TB)**: Bundles personal Google Photos, personal Gmail storage, and business Gemini API / Drive assets.
- **Mobile Phone / Cellular Plan**: Used for live Speed Scout thrift sourcing AND personal calls.
- **Home Internet**: Used for Resale Command development AND household entertainment.

### The Proration Standard
1. Tax regulations require establishing a reasonable, consistent **Business Use Percentage** (e.g. 50% or 75%).
2. Only the business percentage can be deducted on Schedule C or reimbursed from the Co-op Commons Pool.
3. Resale Command's expense entry models must allow entering an optional **Proration / Business %** (default 100% for dedicated business purchases like thermal labels or booth rent; configurable for software/hardware).

---

## 4. AI Receipt / Invoice Scanner Anti-Phantom Invariants

When `/api/parse-receipt.ts` analyzes invoices, receipts, or account statements:

### A. Mandatory Status Extraction
Every line item extracted MUST include a `status` field:
- `PAID`: Confirmed settled transaction.
- `DECLINED`: Card declined, insufficient funds, or failed payment attempt.
- `FAILED`: Processing failure.
- `PENDING`: Unsettled pre-authorization.
- `REFUNDED`: Reversal of previous charge.

### B. Anti-Phantom Filtering Law
- **Zero Dollar Rule for Non-Paid**: If an item's status is `DECLINED`, `FAILED`, `PENDING`, or `CANCELLED`, its deductible cost is legally **$0.00**.
- **Sum Only Settled**: The invoice `total` MUST reflect ONLY the sum of `PAID` items. It must NEVER sum declined lines.
- **Statement-Wide Declines**: If an entire statement consists solely of declined attempts, `items` should be empty `[]`, `total` should be `0.00`, and `hasDeclinedTransactions` must be flagged `true` with an explicit tax compliance alert.

### C. Retry Deduplication
- If multiple transaction rows share the exact same dollar amount, description, and date (e.g. two $99.99 charges on `10/14/2026`), the scanner must check if one was a failed attempt followed by a successful retry.
- Only the **single successful settlement** is captured as an expense.

---

## 5. Co-op Settlement & Expense Reimbursement Workflow

In the **Huckleberry Collective**:
1. **Curator Expense Submission**:
   - A member fronts an expense (e.g. buying $50 of thermal labels or paying the $382.50 booth rent).
   - Member submits receipt via `/expenses` or `/purchases/speed-entry?mode=all_expense`.
2. **Proof-of-Payment Verification**:
   - Receipt must show proof of settled payment.
   - Status is logged as `PENDING_REIMBURSEMENT`.
3. **Monthly Settlement Recoupment**:
   - During the monthly Ricochet POS settlement run, pending reimbursements are paid out dollar-for-dollar from the **30% Commons Pool**.
   - The member receives their reimbursement check, and the expense status transitions to `REIMBURSED`.
   - The Co-op maintains an audit-proof exportable CSV ledger of all reimbursed receipts and attached image URLs.

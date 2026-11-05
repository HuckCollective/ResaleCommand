# The Huckleberry Collective — WSDE Cooperative Operating Charter

> **Worker Self-Directed Enterprise (WSDE) Living Charter**
> Built on *Democracy at Work* cooperative economics and the international Rochdale Cooperative Principles, adapted for multi-partner vintage, games, and collectibles retail at **Memory Den Vintage Mall (Booth #0EJ)** and **Resale Command (`resalecmd.com`)**.

---

## 1. Enterprise Structure & Member Roles

Our collective operates as a transparent, flat-hierarchy **Worker Self-Directed Enterprise (WSDE)** where every active co-op partner has an equal voice in governance and 100% visibility into the shared ledger.

| Member / Entity | Barcode Prefix | Role | Governance & Financial Standing |
| :--- | :--- | :--- | :--- |
| **The Huckleberry Collective LLC** | `HUCK-` | **Anchor Tenant & Co-op Partner** | Holds the master lease and bank settlement account; equal `1 Member = 1 Vote` partner in the WSDE; participates in the 70/30 waterfall and Gate 4B patronage dividends. |
| **PDX Game Library** | `PDXGL-` | **Equal Voting Co-op Partner** | Full co-op partner with equal `1 Member = 1 Vote` authority on all collective decisions; participates in the 70/30 waterfall and Gate 4B patronage dividends. |
| **B&B Consignment** | `BB-` | **Rent-Offsetting Consignor** | Independent booth consignor; pays a fixed monthly sub-lease rent offset (**$85.41/mo**) after the 15% venue fee and retains 100% of remaining net sales. Does not pay into the 30% Commons Pool, does not absorb co-op operating shortfalls, and does not vote on WSDE surplus governance. |

---

## 2. The 4-Gate Monthly Financial Waterfall

Every dollar of realized revenue at **Memory Den Booth #0EJ** flows through four strict, automated accounting gates in [`src/lib/coop/settlementEngine.ts`](file:///c:/Users/15034/Projects/ResaleCommand/src/lib/coop/settlementEngine.ts) before bonus dividends are distributed:

### Gate 1 — Venue Commission (15%)
- Memory Den deducts its standard **15% venue fee** from Gross Sales at the point of sale (`Net After Venue = Gross Sales × 85%`).

### Gate 2 — Consignor Fixed-Rent Offset (`BB-`)
- Before calculating the co-op’s net booth rent, **B&B Consignment (`BB-`)** contributes its fixed **$85.41/mo** space share from its net sales.
- This directly reduces the collective’s gross booth rent from **$382.50/mo** down to **$297.09/mo Net Co-op Rent**.

### Gate 3 — 100% Cost-Basis Recoupment & 70/30 Base Split (`HUCK-`, `PDXGL-`)
- **Step 3A (Zero-Penalty Cost Recoupment):** Co-op partners first recoup **100% of their documented out-of-pocket item Cost Basis** tax-free from `Net After Venue`. Nobody shares a profit split until the member who bought the item is made whole on what they paid for it.
- **Step 3B (70% Curator / 30% Commons Split):** Only the true **Net Margin** (`Net After Venue - Cost Basis`) is split:
  - **70% Curator Base Profit:** Paid directly to the partner who sourced, prepped, and priced the item.
  - **30% Shared Commons Pool:** Flows into the collective’s operating pool to pay shared booth overhead.

### Gate 4A — The $523.26 Monthly Operating Hurdle & Shortfall Priority
- All **30% Commons Pool** contributions are combined to pay the co-op’s verified monthly operating baseline (**$523.26/mo**):
  - **Net Booth Rent:** `$297.09` (`$382.50` gross rent minus `$85.41` `BB-` offset)
  - **Tech & AI Ops:** `$219.99` (Resale Command cloud infrastructure, barcode/label services & AI inspection)
  - **Booth Supplies & Thermal Tags:** `$6.18`
- **Carried-Over Shortfall Repayment Priority:** If the 30% Commons Pool falls short of `$523.26` in a slow month, the deficit (e.g., **`-$132.97`**) is recorded as a **Carried-Over Shortfall** fronted by the anchor account. In subsequent profitable months, **100% of any prior carried-over shortfall must be repaid first** before Gate 4B Excess Surplus dividends can unlock.

### Gate 4B — 50/50 Dual-Patronage Surplus Dividends
- Once the **$523.26** monthly operating hurdle is met **and** any carried-over shortfall is repaid to `$0.00`, every dollar above breakeven is **Excess Distributable Surplus**.
- After any voted contribution to the **Co-op Emergency Reserve Fund**, the **Partner Bonus Pool** is returned to active Co-op Partners (`HUCK-` and `PDXGL-`) via a **50/50 Dual-Patronage Formula**:
  1. **50% Sales Margin Patronage (Pro-Rata):** Distributed in proportion to each co-op partner’s net margin generated that month.
  2. **50% Sweat-Equity Labor Bounties (Pro-Rata):** Distributed in proportion to each partner’s logged and verified booth resets, haul intake, tagging, and merchandising hours/bounties.

---

## 3. The 5 Democratic Dials & Loomio Consent Voting

Co-op Partners (`HUCK-` and `PDXGL-`) govern the collective democratically on `/coop` using **4-Signal Loomio Consent Voting**:

- **✅ Agree:** I support this proposal and am ready to enact it.
- **➖ Abstain:** I defer to the group and will support whatever is decided.
- **⚠️ Disagree (Stand Aside):** I have reservations and want them noted in the record, but I will not block the collective from moving forward.
- **🛑 Block (Principled Veto):** I believe this proposal violates our core cooperative charter or puts the enterprise at severe financial risk; triggers mandatory revision and discussion before passage.

### The 5 Configurable Democratic Dials
Any co-op partner may submit a proposal at any time to adjust the collective’s five core economic dials:
1. **Base Waterfall Split Ratio** (Default: `70% Curator / 30% Commons Pool`).
2. **Surplus Distribution Mode** (`90% Bonus / 10% Reserve`, `100% Bonus Above Reserve Cap`, or `100% Reserve Builder`).
3. **Co-op Emergency Reserve Cap** (Default: `$523.26` — 1 full month of net operating expenses).
4. **Gate 4B Dual-Patronage Weights** (Default: `50% Sales Margin Pro-Rata / 50% Sweat-Equity Labor Bounties Pro-Rata`).
5. **Approved Shared Expense & Labor Bounty Schedule** (Monthly tech/supplies budgets and hourly/task credit rates for booth work).

---

## 4. The 30-Day Orphan Ticket Rule

When Memory Den’s Ricochet POS records a hand-written or untagged register sale (such as **`Ticket #219403`** or an unlinked `SO-...` line item), the sale initially enters Resale Command with a **`⚠️ Unlinked Ticket`** badge.

1. **Active Claim Window (Days 1–30):**
   - Any partner (`HUCK-`, `PDXGL-`, or `BB-`) can click **`[Link Inventory]`** on `/sales` to match the ticket to their physical booth item (by price, title, or `0EJ...` SKU), restoring their **100% Cost Basis recoupment** and assigning the sale to their partner ledger.
2. **30-Day Commons Sweep (Day 31+):**
   - If an unlinked mystery ticket remains unclaimed **30 days after the sale date** (or at the close of monthly settlement reconciliation after all partners have reviewed the Unlinked Tickets banner), a partner clicks **`[Assign to Commons Pool]`** (`COMMONS-`).
   - **Commons Sweep Accounting:** Curator split is set to **`$0.00`** and **100% of the Net Margin** (`Gross Sales - 15% Venue Fee`) is swept directly into the **Shared Commons Pool** to help pay down booth rent, tech ops, or carried-over shortfalls for the benefit of the entire collective.


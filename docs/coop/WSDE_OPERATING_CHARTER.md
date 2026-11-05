# The Huckleberry Collective — WSDE Cooperative Operating Charter

> **Worker Self-Directed Enterprise (WSDE) Living Charter**
> Built on *Democracy at Work* cooperative economics, the **Mondragon Federation (`10/45/45`)** capital framework, and **ICA / Rochdale & SELC Cooperative Bylaws**, adapted for multi-channel vintage, games, and collectibles retail across **Memory Den Vintage Mall (Booth #0EJ)**, **Dusty Tiger (`DT`)**, **Online Marketplaces**, and **Pop-Up Events**.

---

## 1. Enterprise Structure & The 3 Member Archetypes

Our collective operates as a transparent, flat-hierarchy **Worker Self-Directed Enterprise (WSDE)** where **Producers of Surplus** (curators/merchants) and **Enablers of Surplus** (marketing, social media, photography, fulfillment, and tech/booth ops) co-govern the collective on an equal `1 Member = 1 Vote` basis.

| Member / Archetype | Prefix | Capital & Inventory Requirement | Governance & Financial Standing |
| :--- | :--- | :--- | :--- |
| **1. The Huckleberry Collective LLC** *(Anchor Curator Partner)* | `HUCK-` | Holds master lease, bank account & `HUCK-` inventory | Equal `1 Member = 1 Vote` WSDE partner; recoups `100%` item COGS first + `70/30` base split + Gate 4B Sales & Sweat-Equity dividends. |
| **2. PDX Game Library** *(Equal Curator Partner)* | `PDXGL-` | Owns `PDXGL-` tabletop games & RPG inventory | Equal `1 Member = 1 Vote` WSDE partner; recoups `100%` item COGS first + `70/30` base split + Gate 4B Sales & Sweat-Equity dividends. |
| **3. Marketing, Social Media & Ops Workers** *(Enabling Worker-Members)* | `SWEAT-` | **`$0` Inventory Required** (Contributes Dropcast Reels, social media, staging, online shipping, pop-up staffing) | Equal `1 Member = 1 Vote` WSDE partner once active monthly hours are met; earns direct **Individual Worker Sweat-Equity Dividends** (`30%–45%` Gate 4B labor pool) based on verified hours & deliverable links in `/coop/labor`. |
| **4. B&B Consignment** *(Rent-Offsetting Consignor)* | `BB-` | Independent consigned booth stock | Contractual sub-lease tier; pays `15%` venue fee + fixed **`$85.41/mo`** sub-lease rent offset and retains `100%` of remaining net sales. Does not pay into `30%` Commons Pool or vote on WSDE surplus. |

---

## 2. Multi-Channel 4-Gate Monthly Financial Waterfall

Every dollar of realized revenue—whether at **Memory Den (`MD`)**, **Dusty Tiger (`DT`)**, **Online (`eBay`, `Poshmark`, `Whatnot`, `resalecmd.com`)**, or **Pop-Up Markets & Conventions**—flows through four strict accounting gates in [`src/lib/coop/settlementEngine.ts`](file:///c:/Users/15034/Projects/ResaleCommand/src/lib/coop/settlementEngine.ts):

### Gate 1 — Channel Fee & Outbound Postage
- **Physical Mall Booths:** Deducts venue commission (`15%` at Memory Den, `10%` at Dusty Tiger).
- **Online Marketplaces & Direct Storefront:** Deducts platform commission (`13%` eBay, `20%` Poshmark, `2.9%` Stripe) **plus `100%` of actual outbound shipping label postage** (`Pirate Ship` / USPS).
- **Pop-Up Markets & Conventions:** Deducts card reader fee (`2.9%` tap; `0%` on cash sales).

### Gate 2 — Consignor Fixed-Rent Offset (`BB-`)
- **B&B Consignment (`BB-`)** contributes its fixed **`$85.41/mo`** space share from its net sales, reducing the collective’s gross Memory Den booth rent from **`$382.50/mo`** down to **`$297.09/mo` Net Co-op Rent**.

### Gate 3 — 100% Cost-Basis Recoupment & 70/30 Base Split (`HUCK-`, `PDXGL-`)
- **Step 3A (Zero-Penalty Cost Recoupment):** Curators recoup **100% of their documented out-of-pocket item Cost Basis** tax-free before any profit is split.
- **Step 3B (70% Curator / 30% Subsumed Commons Split):** Remaining Net Margin splits **70% Curator Base Profit** / **30% Shared Commons Pool**.

### Gate 4A — Shared Operating Hurdle, Expense Scope Separation & Shortfall Carryover
- **Personal Write-Off vs. Co-op Shared Expense Separation (`/expenses`):**
  - Only **`🤝 Co-op Shared (`coop_shared`)`** expenses (and the `coopSharePct%` portion of **`⚖️ Split`** expenses) are charged to the **30% Commons Pool** (`$297.09` Net Booth Rent + Pop-Up Table Fees + `$219.99` Tech Ops + `$6.18` Booth/Shipping Supplies = `$523.26/mo` baseline).
  - **`👤 Personal Write-Off (`personal_write_off`)`** expenses (thrift sourcing mileage/gas, home office/garage storage, personal phone/camera gear) charge **`$0.00` to the Co-op Commons Pool** and are tracked `100%` in the member's Personal IRS Schedule C Write-Off Ledger.
- **Shortfall Carryover Priority:** Any monthly operating deficit (e.g., **`-$132.97`**) is carried forward (`carriedOverShortfall`) and must be repaid **100% first** before Gate 4B bonus dividends unlock.

### Gate 4B — WSDE & Mondragon (`10 / 45 / 45` or `10 / 60 / 30`) Excess Surplus & ICAs
- Once the monthly operating hurdle and any carried-over shortfall are `100%` covered, Excess Distributable Surplus splits across:
  1. **Inter-Co-op / Rainy-Day Reserve Slice (`10%`, capped at `$500`–`$523.26`):** Builds the collective buffer.
  2. **Enterprise Reserve & Sales Patronage (`45%` Mondragon or `60%` WSDE):** Credited to Curator Partners (`HUCK-`, `PDXGL-`).
  3. **Sweat-Equity Enabling Labor & Member ICA Ledger (`45%` Mondragon or `30%` WSDE):** Distributed directly to **Individual Worker-Members (`HUCK-`, `PDXGL-`, and `SWEAT-` Marketing/Social Enablers)** based on verified hours logged in `/coop/labor`, with retained Mondragon Internal Capital Account (ICA) balances targeting a **7% annual cash yield/bonus**.

---

## 3. Mondragon Structural Guardrails & Loomio Consent Voting

- **4-Signal Loomio Consent Protocol (`/coop/governance`):** `🟢 Agree`, `🟡 Abstain`, `🟠 Disagree`, `🔴 Block (Principled Veto)`.
- **Mondragon Federation Guardrails:**
  1. **Reversed Hierarchy (`1M1V`):** General Assembly evaluates operational leads; financial prep & reconciliation meetings count as credited enabling labor.
  2. **Pay Ratio Cap (`4.5:1` Standard / `6.5:1` Max):** Labor bounty tiers are compressed to `4.5:1`.
  3. **Open Procurement:** Competitive sourcing for thermal labels, packaging, and software inputs with `100%` receipt transparency.
  4. **Complementary Niche Non-Competition:** Partner units curate complementary niches (`HUCK-` vintage/apparel/oddities vs. `PDXGL-` tabletop games/RPGs).

---

## 4. The 30-Day Orphan Ticket Rule

Unlinked register tickets (`Ticket #<n>`) have a configurable **30-Day Active Claim Window** (`orphanClaimWindowDays`) for partners to match via **`[Link Inventory]`** on `/sales`. Unclaimed tickets after 30 days can be swept **`100%` (after the `15%` venue fee)** into the **Shared Commons Pool (`COMMONS-`)**.

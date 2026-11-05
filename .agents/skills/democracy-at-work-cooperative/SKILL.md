---
name: democracy-at-work-cooperative
description: Cooperative economics, Worker Self-Directed Enterprise (WSDE) surplus theory (Producers vs. Enablers of Surplus, Marketing/Social Sweat-Equity Workers), Multi-Channel Waterfall (Booths, Online + Postage, Pop-Ups), Mondragon 10/45/45 & ICAs, Personal Write-Off vs. Co-op Commons Expense Separation, and Loomio consent governance. Use when working on co-op settlements, `/coop/*` routes, `/expenses`, the 70/30 waterfall, partner payouts, sweat-equity labor, or the Commons Pool.
---

# Huckleberry Collective — WSDE, Mondragon & SELC Cooperative Architecture

This skill defines the cooperative economic engine, 4-Gate multi-channel financial waterfall, Marketing/Social Enabling Worker-Member model (`SWEAT-`), Personal Schedule C vs. Co-op Commons expense separation, Mondragon `10/45/45` capital account rules, SELC/Rochdale bylaw tiers, and Loomio consent governance for **The Huckleberry Collective** (`HUCK-`), **PDX Game Library** (`PDXGL-`), **Marketing & Ops Enablers** (`SWEAT-`), and consignors (`BB-`) on Resale Command (`resalecmd.com`).

> **Deep Reference:** See [`.agents/skills/democracy-at-work-cooperative/references/WSDE_MONDRAGON_SELC_REFERENCE.md`](file:///c:/Users/15034/Projects/ResaleCommand/.agents/skills/democracy-at-work-cooperative/references/WSDE_MONDRAGON_SELC_REFERENCE.md) and [`docs/coop/WSDE_OPERATING_CHARTER.md`](file:///c:/Users/15034/Projects/ResaleCommand/docs/coop/WSDE_OPERATING_CHARTER.md).
> **UI Wording Rule:** Always use institutional WSDE/Mondragon/cooperative terminology (`Worker Self-Directed Enterprise`, `Producers & Enablers of Surplus`, `Mondragon 10/45/45`, `Indivisible Commons Reserve`) in UI components—never cite individual economists by personal name in user-facing UI text.

---

## 1. WSDE Surplus Theory & The 3 Member Archetypes

1. **Curator Worker-Members (`HUCK-`, `PDXGL-` — Producers of Surplus):**
   - Source and own inventory (`UPC` prefix). Recoup `100%` of item cost basis first, keep `70%` Curator Base Profit (Gate 3), and share in Gate 4B Sales Patronage (`45%–60%`) + Sweat-Equity Labor (`30%–45%`). Full `1 Member = 1 Vote` rights.
2. **Marketing, Social Media & Ops Worker-Members (`SWEAT-` — Enablers of Surplus):**
   - **`$0` Inventory Required.** Contribute Dropcast Reels, social media campaigns, photography, online order packing/shipping, booth restocking, and pop-up staffing.
   - Earn direct **Individual Worker Sweat-Equity Dividends** from the Gate 4B Labor Pool (`30%–45%` of excess surplus) proportional to their verified hours (`getLaborHoursByMemberForMonth`) and deliverable proof links (`deliverableRef`) logged in `/coop/labor`. Hold full `1 Member = 1 Vote` rights.
3. **External Consignors (`BB-` — Contractual Sub-Lease):**
   - Pay `15%` Venue Fee (Gate 1) + **`$85.41/mo`** fixed sub-lease rent offset (Gate 2, reducing gross `$382.50` booth rent to `$297.09` Net Co-op Rent) and keep `100%` of remaining net sales. Do not pay into the `30%` Commons Pool or vote on WSDE surplus.

---

## 2. Multi-Channel Co-op Economics (Physical Booths + Online + Pop-Ups)

- **Physical Mall Booths (`MD` 15% / `DT` 10%):** Venue fee deducted in Gate 1; Net Booth Rent (`$297.09` at `MD`, `$75` at `DT`) covered by the `30%` Commons Pool in Gate 4A.
- **Online Marketplaces & Storefront (`eBay` 13% / `Poshmark` 20% / `Stripe` 2.9%):** Marketplace fee **+ `100%` of Actual Outbound Shipping Label Cost (`Pirate Ship` / USPS)** recouped first before the `70/30` split; shipping supplies and packing hours (`Online Fulfillment & Shipping`) covered by Commons & `/coop/labor`.
- **Pop-Up Markets & Conventions (`2.9%` Card / `0%` Cash):** Weekend Table/Tent Fee reimbursed `100%` from the `30%` Commons Pool; load-in and booth staffing logged under `Pop-Up & Event Staffing` in `/coop/labor`.

---

## 3. Mondragon 10/45/45 Waterfall, ICAs & Stabilization Rules

1. **Indivisible Collective Reserve & Shortfall Carryover (`carriedOverShortfall`):**
   - Funded by the **30% Shared Commons Pool** (`commonsSharePct`). Covers fixed monthly operating costs (`$297.09` Net Rent + `$219.99` Tech Ops + `$6.18` Supplies = `$523.26/mo`). Any monthly operating deficit (e.g., `-$132.97`) is carried forward and repaid **100% first** before Gate 4B bonus patronage dividends unlock.
2. **The Mondragon 10 / 45 / 45 Net Revenue Waterfall:**
   - **10% Inter-Co-op Coordination & Reserve Fund:** Shared administration, infrastructure, and mutual rainy-day reserve.
   - **45% Enterprise Collective Reserve / Sales Patronage:** Working capital, inventory expansion, and pro-rata sales patronage.
   - **45% Member Capital / Sweat-Equity Ledger (ICAs):** Credited to individual worker-member accounts by verified patronage and enabling labor hours (targeting a **7% annual cash yield/bonus** on retained member capital balances).
3. **Mondragon Governance & Pay Guardrails:**
   - **Reversed Hierarchy (`1M1V`)**, **Open Procurement**, **`4.5:1` Standard (`6.5:1` Max) Pay Ratio Cap**, and **Complementary Niche Non-Competition** (`HUCK-` vintage/apparel/oddities vs. `PDXGL-` tabletop games/RPGs).

---

## 4. Personal Schedule C Write-Off vs. Shared Co-op Commons Expense Separation

Every expense in `src/lib/coopExpenses.ts` (`/expenses`) has an explicit `scope`:
- **`coop_shared` (`🤝 Co-op Shared 100%`):** Reimbursed from the 30% Commons Pool in Gate 4A (Booth Rent, shared Rollo tags, shared AI/cloud ops, pop-up table fees).
- **`personal_write_off` (`👤 Personal Write-Off 100%`):** **`$0.00` charged to the Co-op Commons Pool** (strictly excluded from `CoopSettlementView.vue`); tracked `100%` in the member's **Personal IRS Schedule C Write-Off Ledger & CSV Export** (thrift mileage/gas, home office/garage storage, personal phone/camera gear).
- **`split` (`⚖️ Split %`):** Charges `coopSharePct%` to Gate 4A Co-op Commons and `(100 - coopSharePct)%` to Personal Schedule C Write-Offs.

---

## 5. Canonical `/coop/*` Routes & Cloud Persistence

- `/coop/settlements` ([`src/pages/coop/settlements.astro`](file:///c:/Users/15034/Projects/ResaleCommand/src/pages/coop/settlements.astro)) — 4-Gate Monthly Settlement Workbench (`CoopSettlementView.vue`)
- `/coop/governance` ([`src/pages/coop/governance.astro`](file:///c:/Users/15034/Projects/ResaleCommand/src/pages/coop/governance.astro)) — 3-Tab Loomio Proposals, 6 Democratic Dials & Sliders, and Voter Roster (`CoopGovernanceView.vue`)
- `/coop/labor` ([`src/pages/coop/labor.astro`](file:///c:/Users/15034/Projects/ResaleCommand/src/pages/coop/labor.astro)) — Cloud-Synced Sweat-Equity & Enabling Labor Ledger (`CoopLaborView.vue`)
- `/expenses` ([`src/pages/expenses.astro`](file:///c:/Users/15034/Projects/ResaleCommand/src/pages/expenses.astro)) — Co-op Shared Commons vs. Personal Schedule C Write-Off Ledger (`CoopExpensesLedger.vue`)
- `/coop` ([`src/pages/coop.astro`](file:///c:/Users/15034/Projects/ResaleCommand/src/pages/coop.astro)) — Interactive WSDE Operating Charter & Multi-Channel Simulator (`CoopCharterView.vue`)

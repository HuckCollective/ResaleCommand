---
name: democracy-at-work-cooperative
description: Cooperative economics, Worker Self-Directed Enterprise (WSDE) surplus theory (Producers vs. Enablers of Surplus), Mondragon Internal Capital Accounts (ICAs) & Indivisible Reserves, ICA/Rochdale & SELC bylaw rules, 4-Gate waterfall accounting, and Loomio consent governance for the Huckleberry Collective. Use when working on co-op settlements, `/coop/*` routes, the 70/30 waterfall, partner payouts, sweat-equity labor, or the Commons Pool.
---

# Huckleberry Collective — WSDE, Mondragon & SELC Cooperative Architecture

This skill defines the cooperative economic engine, 4-Gate financial waterfall, Mondragon reserve/capital account rules, SELC/Rochdale bylaw tiers, and Loomio consent governance for **The Huckleberry Collective** (`HUCK-`), **PDX Game Library** (`PDXGL-`), and consignors (`BB-`) on Resale Command (`resalecmd.com`).

> **Deep Reference:** See [`.agents/skills/democracy-at-work-cooperative/references/WSDE_MONDRAGON_SELC_REFERENCE.md`](file:///c:/Users/15034/Projects/ResaleCommand/.agents/skills/democracy-at-work-cooperative/references/WSDE_MONDRAGON_SELC_REFERENCE.md) and [`docs/coop/WSDE_OPERATING_CHARTER.md`](file:///c:/Users/15034/Projects/ResaleCommand/docs/coop/WSDE_OPERATING_CHARTER.md).
> **UI Wording Rule:** Always use institutional WSDE/cooperative terminology (`Worker Self-Directed Enterprise`, `Producers & Enablers of Surplus`, `Indivisible Commons Reserve`) in UI components—never cite individual economists by personal name in user-facing UI text.

---

## 1. WSDE Surplus Theory: Producers vs. Enablers of Surplus

1. **Producers of Surplus:** Direct labor generating revenue through sourcing, restoration, pricing, merchandising, and floor/online sales.
2. **Enablers of Surplus:** Infrastructure, software/AI automation, bookkeeping, thermal barcode tagging, Dropcast social reels, and retail space management that make surplus production possible.
3. **Surplus Appropriation (Subsumed Class Distribution):**
   - Both **Producers** and **Enablers** co-govern the collective surplus on an equal `1 Member = 1 Vote` basis.
   - Enabler costs and fixed overhead (**Net Booth Rent**, **Tech & AI Ops**, **Supplies**) are funded via a **Subsumed Class Distribution** (**30% Shared Commons Pool / Indivisible Collective Reserve**) prior to bonus patronage payouts.

---

## 2. Mondragon Internal Capital Accounts (ICAs) & Indivisible Reserves

1. **Indivisible Collective Reserve (Commons Pool):**
   - Funded by the **30% Shared Commons Pool** (`commonsSharePct` in `CoopPolicyConfig`).
   - Covers fixed monthly operating costs (`$297.09` Net Booth Rent + `$219.99` Tech Ops + `$6.18` Supplies = `$523.26/mo`) and absorbs monthly operating shortfalls.
   - **Shortfall Carryover Invariant:** In slow months, any operating deficit (e.g., `-$132.97`) is carried forward and must be repaid **100% first** before Gate 4B bonus patronage dividends unlock.
2. **Individual Capital & Patronage Accounts:**
   - Net surplus remaining after the Collective Reserve covers operating costs and shortfall carryover is credited to active Worker-Member Partners (`HUCK-`, `PDXGL-`) via the configurable **3-Way Gate 4B WSDE Split** (`reserveSharePct` / `salesPatronagePct` / `laborPatronagePct`, default `10% / 60% / 30%`).

---

## 3. ICA / Rochdale & SELC Bylaw Rules

1. **1 Member = 1 Vote:** Governance is decoupled from capital or inventory volume. Proposals on `/coop/governance` use the **4-Signal Loomio Consent Protocol** (`🟢 Agree`, `🟡 Abstain`, `🟠 Disagree`, `🔴 Block`).
2. **Partner Tiers (Worker-Members vs. Consignors):**
   - **Worker-Members (`HUCK-`, `PDXGL-`):** Full governance voting rights + `100%` cost basis recoupment + `70/30` base margin split + Gate 4B Sales & Sweat-Equity Labor patronage dividends.
   - **Consignors (`BB-`):** Contractual split only. Pays `15%` Venue Fee (Gate 1) + fixed monthly sub-lease rent offset (`$85.41/mo` in Gate 2, reducing gross `$382.50` booth rent to `$297.09` Net Co-op Rent) and keeps `100%` of remaining net sales. Does not pay into the `30%` Commons Pool, does not absorb co-op shortfalls, and does not vote on WSDE surplus governance.
3. **30-Day Orphan Ticket Sweep (`orphanClaimWindowDays`):**
   - Unlinked register tickets (`Ticket #<n>`) have a configurable claim window (default `30` days) for partners to link via `[Link Inventory]`. Unclaimed tickets after 30 days can be swept `100%` (after the `15%` venue fee) into the Shared Commons Pool (`COMMONS-`).

---

## 4. The 4-Gate Waterfall Accounting Engine (`src/lib/coop/settlementEngine.ts`)

```
[ Gross Venue Revenue ]
          │
          ▼
┌──────────────────────────────────────────────────────────────┐
│ Gate 1: Venue Commission (15% Memory Den Fee)                │
│   Net After Venue = Gross Sales × 85%                        │
└──────────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────┐
│ Gate 2: Consignor Fixed-Rent Offset (BB- = $85.41/mo)        │
│   Reduces Gross Booth Rent ($382.50) -> $297.09 Net Co-op    │
│   BB- Payout = Net After Venue - $85.41                      │
└──────────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────┐
│ Gate 3: Worker-Member Cost Recoupment & 70/30 Split          │
│   1. 100% Documented Item Cost Basis (COGS) returned first   │
│   2. Net Margin = Net After Venue - Cost Basis               │
│   3. 70% Curator Base Profit / 30% Shared Commons Pool       │
└──────────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────┐
│ Gate 4A & 4B: Operating Hurdle, Shortfall & 3-Way Surplus    │
│   • 4A Operating Hurdle: $297.09 Net Rent + $219.99 Tech     │
│     + $6.18 Supplies = $523.26/mo + Prior Shortfall Carryover│
│   • 4B Excess Surplus (when 30% Commons > Hurdle):           │
│     - Rainy-Day Reserve Slice (default 10%, capped at $500)  │
│     - Sales Patronage Dividend (default 60% pro-rata/equal)  │
│     - Sweat-Equity Labor Dividend (default 30% by hours)     │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Canonical `/coop/*` Routes & Cloud Persistence

- **Routes:**
  - `/coop/settlements` ([`src/pages/coop/settlements.astro`](file:///c:/Users/15034/Projects/ResaleCommand/src/pages/coop/settlements.astro)) — 4-Gate Monthly Settlement Workbench (`CoopSettlementView.vue`)
  - `/coop/governance` ([`src/pages/coop/governance.astro`](file:///c:/Users/15034/Projects/ResaleCommand/src/pages/coop/governance.astro)) — 3-Tab Loomio Proposals, 5 Democratic Dials & 3-Way Sliders, and Voter Roster (`CoopGovernanceView.vue`)
  - `/coop/labor` ([`src/pages/coop/labor.astro`](file:///c:/Users/15034/Projects/ResaleCommand/src/pages/coop/labor.astro)) — Cloud-Synced Sweat-Equity & Enabling Labor Ledger (`CoopLaborView.vue`)
  - `/coop` ([`src/pages/coop.astro`](file:///c:/Users/15034/Projects/ResaleCommand/src/pages/coop.astro)) — Interactive WSDE Operating Charter & 70/30 Simulator (`CoopCharterView.vue`)
- **Appwrite Cloud Persistence (`src/lib/coopGovernance.ts`):**
  - Stored in `resale_db.manifests` document `coop_governance_proposals_v1` (`itemsSnapshot` JSON containing `proposals`, `surplusPolicyMode`, `surplusSplitBasis`, `policyConfig`, and `laborEntries`).

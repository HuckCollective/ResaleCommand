---
name: democracy-at-work-cooperative
description: Cooperative economics, worker-directed enterprise (WSDE) standards, shared overhead pools, patronage dividend formulas, and multi-org consensus governance for the Huckleberry Collective.
---

# Huckleberry Collective - Democracy at Work & Cooperative Architecture

This skill defines the cooperative economic engine, financial formulas, transparent ledger standards, monthly settlement cadences, legal structure, and democratic governance rules for the **Huckleberry Collective** and partner organizations on Resale Command.

---

## 1. Foundational Principles: Worker Self-Directed Enterprise (WSDE)

The Huckleberry Collective operates on the principles of **Democracy at Work** (as formulated by cooperative economics and Richard Wolff) and the international **Rochdale Cooperative Principles**:

1. **Democratic Member Equality**: 1 member = 1 vote. Decisions affecting the collective are made democratically by the workers and creators who produce the value.
2. **Total Financial Transparency**: No hidden markups or opaque cuts. All venue costs (e.g. Memory Den 15% commission, booth rent, storage) and gross revenues are auditable by every active member.
3. **100% Capital Basis Protection**: Personal funds spent by members on inventory, raw materials, or supplies are recouped dollar-for-dollar before net profits are distributed.
4. **Purchaser Curation Rewards**: Sourcing winners takes taste, effort, and capital risk. The member who sources an item takes home 100% of their cost basis plus 50% of the net profit on that item.
5. **Equitable Surplus Sharing (Patronage Dividends)**: Net profits (surplus) are distributed equitably based on transparent criteria: contributed inventory sales (50%), sweat equity / labor hours (40%), and collective reserve (10%).
6. **Autonomy of Partner Organizations**: Partner collectives and curators (e.g. **PDX Game Library**) maintain autonomous identity, separate prefixes (`PDXGL-`), and independent inventory ownership while sharing the collective commons.

---

## 2. The 3-Tier Co-op Financial Distribution Formula

Every dollar entering the collective from retail venues (Memory Den, Ricochet POS, online stores, pop-ups) flows through the strict 3-tier cooperative waterfall:

```
[ Gross Venue Revenue ]
          │
          ▼
┌────────────────────────────────────────────────────────┐
│  Tier 1: Shared Commons Pool (Covered First)           │
│  - Retail POS Commissions (e.g. 15% Memory Den fee)    │
│  - Monthly Shared Booth Rent ($382.50 at Memory Den)   │
│  - Shared Operational Supplies (Labels, boxes, bins)   │
│  - Tech Commons: Hosting, Appwrite, & 100% repayment  │
│    for fronted AI scouting credits ($100 Google Prepay)│
└────────────────────────────────────────────────────────┘
          │
          ▼
┌────────────────────────────────────────────────────────┐
│  Tier 2: Member Capital Basis Recoupment               │
│  - 100% return of member out-of-pocket inventory cost  │
│  - Reimbursed approved member expenses (receipt-logged)│
│  - Zero risk of taking a loss on sold inventory        │
└────────────────────────────────────────────────────────┘
          │
          ▼
┌────────────────────────────────────────────────────────┐
│  Tier 3: Net Operating Surplus & Patronage Dividends   │
│  1. Collective Reserve (10% cushion for slow months)   │
│  2. Contributed Sales Share (50% to the item curator)  │
│  3. Labor / Sweat Equity Share (40% to hours worked)   │
└────────────────────────────────────────────────────────┘
```

### The Math:

$$\text{Net Operating Surplus} = \text{Gross Venue Revenue} - \text{Tier 1 Shared Overhead} - \sum \text{Member Cost Basis}$$

$$\text{Distributable Surplus} = \text{Net Operating Surplus} \times 0.90 \quad (\text{after 10\% reserve})$$

$$\text{Curator Payout} = \text{Recouped Basis} + (\text{Net Profit on Curator Items} \times 0.50) + \text{Labor Patronage Dividend}$$

---

## 3. Monthly Settlement Cadence & Booth Rent Accounting

### A. The Monthly Check Reality
Memory Den pays **once a month**. The venue automatically withholds their 15% commission and the **$382.50 fixed booth rent** directly off the top before delivering the net payout.
Cooperative settlements are therefore run **monthly** matching the venue payout CSV:

$$\text{Net Check from Venue} = \text{Gross Sales} - \text{15\% Venue Fee} - \text{\$382.50 Rent}$$

### B. Booth Rent Allocation
- **Option A (Standard — Top-Line Pool)**: Rent is absorbed out of Tier 1 gross sales before profit split. Members absorb rent proportional to their sales volume. Slow months never generate an out-of-pocket cash call.
- **Option B (Footprint Model)**: Fixed monthly shelf allocation (e.g. 25% footprint = $95.63/mo deducted from partner gross earnings).

### C. The 10% Reserve Cushion
The 10% Collective Reserve accumulated during peak months covers rent deficits during slow retail periods (e.g. post-holiday lulls).

---

## 4. Legal Structure: The Cooperative Consortium Model

### Why We Use Consortium Membership (Form 1099-NEC)
- **Huckleberry Collective LLC** serves as the anchor entity (holds the Memory Den lease, insurance, bank account, and software).
- Partners join as **Contractual Cooperative Associates / Consortium Curators**:
  - **Zero Tax Hassle**: Avoids mandatory IRS Form 1065 (Partnership Return) and Schedule K-1s ($1,500+ CPA fee).
  - **Form 1099-NEC**: Net partner earnings over $600 reported simply via 1099-NEC.
  - **Partner Brand Autonomy**: Partners retain independent brand identity (`PDXGL-`) and complete inventory ownership.
  - **Fluid Exits**: Partners can exit anytime with their inventory and final payout with zero legal dissolution filings.
  - **Democratic Voting**: 1 Member = 1 Vote guaranteed contractually under the Charter.
- **1-Year Candidacy Path**: Core members who work actively for 12 months can be voted by unanimous consent to become formal LLC equity owners.

---

## 5. Marketing, Photography & Social Media Labor Standards

1. **Recognized Labor**: Photographing inventory, staging displays, publishing dropcasts, creating Reels/TikToks, and answering buyer inquiries earn **Tier 3 Labor Patronage Dividends**.
2. **Deliverable-Based Gauging**: Every logged marketing hour links to a published Dropcast record, before/after booth photos, or tracked sales velocity.
3. **Weekly Allocation**: Standard recommendation is 2 to 4 hours per week for social marketing and booth maintenance.

---

## 6. Democratic Governance & Consent Protocol (Loomio Standard)

| Signal | Meaning | Actionable Rule |
| :--- | :--- | :--- |
| 🟢 **Agree** | "I support this proposal." | Counted toward positive consensus. |
| 🟡 **Abstain** | "I trust the collective to proceed without my input." | Neutral; does not block progress. |
| 🟠 **Disagree** | "I have reservations, but I won't block the group." | Logged for discussion; does not veto. |
| 🔴 **Block** | "This violates our collective principles or endangers the co-op." | Triggers mandatory deliberation before proceeding. |

---

## 7. Architectural Standards for Developers & Agents

1. **Zero Data Loss**: Never merge or delete partner inventory during syncs. Partner items belong to their respective organization.
2. **Dynamic Over Hardcoded**: Never hardcode org prefixes to just `HUCK` and `PDXGL`. Always read from `team.prefs.upcPrefix` and `team.prefs.partnerPrefixes`.
3. **Transparent Ledgers**: Every financial summary must report Gross Revenue, Venue Fee, Net Payout, Member Basis, and Surplus Dividends separately.

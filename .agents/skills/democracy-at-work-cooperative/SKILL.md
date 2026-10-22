---
name: democracy-at-work-cooperative
description: Cooperative economics, worker-directed enterprise (WSDE) standards, shared overhead pools, patronage dividend formulas, and multi-org consensus governance for the Huckleberry Collective.
---

# Huckleberry Collective - Democracy at Work & Cooperative Architecture

This skill defines the cooperative economic engine, financial formulas, transparent ledger standards, and democratic governance rules for the **Huckleberry Collective** and partner organizations on Resale Command.

---

## 1. Foundational Principles: Worker Self-Directed Enterprise (WSDE)

The Huckleberry Collective operates on the principles of **Democracy at Work** (as formulated by cooperative economics and Richard Wolff) and the international **Rochdale Cooperative Principles**:

1. **Democratic Member Equality**: 1 member = 1 vote. Decisions affecting the collective are made democratically by the workers and creators who produce the value.
2. **Total Financial Transparency**: No hidden markups or opaque cuts. All venue costs (e.g. Memory Den 15% commission, booth rent, storage) and gross revenues are auditable by every active member.
3. **100% Capital Basis Protection**: Personal funds spent by members on inventory, raw materials, or supplies are recouped dollar-for-dollar before net profits are distributed.
4. **Equitable Surplus Sharing (Patronage Dividends)**: Net profits (surplus) are distributed equitably based on transparent criteria: contributed inventory sales, sweat equity (labor hours), and equal baseline member dividends.
5. **Autonomy of Partner Organizations**: Partner collectives and curators (e.g. **PDX Game Library**) maintain autonomous identity, separate prefixes (`PDXGL-`), and independent inventory ownership while sharing the collective commons.

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
│  - Monthly Shared Booth Rent                           │
│  - Shared Operational Supplies (Labels, boxes, bins)   │
└────────────────────────────────────────────────────────┘
          │
          ▼
┌────────────────────────────────────────────────────────┐
│  Tier 2: Member Capital Basis Recoupment               │
│  - 100% return of member out-of-pocket inventory cost  │
│  - Reimbursed approved member expenses (receipt-logged)│
└────────────────────────────────────────────────────────┘
          │
          ▼
┌────────────────────────────────────────────────────────┐
│  Tier 3: Net Operating Surplus & Patronage Dividends   │
│  1. Collective Reserve (e.g. 10% for future equipment) │
│  2. Contributed Sales Share (e.g. 50% based on sales)  │
│  3. Labor / Sweat Equity Share (e.g. 40% based on time)│
└────────────────────────────────────────────────────────┘
```

### The Math:

$$\text{Net Operating Surplus} = \text{Gross Venue Revenue} - \text{Shared Overhead} - \sum \text{Member Cost Basis}$$

$$\text{Distributable Surplus} = \text{Net Operating Surplus} \times (1 - \text{Reserve Rate})$$

$$\text{Member Payout} = \text{Recouped Capital Basis} + \text{Sales Patronage Dividend} + \text{Labor Patronage Dividend}$$

---

## 3. Multi-Org Co-op Ledger Standards

### A. Independent Prefix Attribution
Each member or partner organization owns a distinct barcode prefix:
- **`HUCK-`**: Huck Collective primary curated vintage, apparel, and oddities.
- **`PDXGL-`**: PDX Game Library curated tabletop board games, card games, and expansions.
- **`{ORG}-`**: Configured dynamically in **Settings > Partner & Vendor Prefixes**.

### B. Shared Venue Representation
When selling at a shared venue (e.g. Memory Den Booth #0EJ):
- The physical tag displays both the **Venue SKU** (for register checkout) and the **Co-op Prefix** (`HUCK-XXXX` or `PDXGL-XXXX`).
- The POS payout report is parsed by the multi-org reconciliation engine, partitioning sales into distinct partner ledgers with zero cross-contamination.

### C. The Expense Reimbursement Flow (Open Collective Standard)
1. Any member who incurs an out-of-pocket operational expense (e.g. buying a roll of thermal tags, booth display hardware) logs an expense with an attached receipt.
2. The expense is marked `pending_reimbursement`.
3. The expense is reimbursed out of the **Shared Commons Pool** upon the next venue payout, before dividends are calculated.

---

## 4. Democratic Governance & Consent Protocol (Loomio Standard)

For major operational decisions (e.g. acquiring expensive lots, renting new retail spaces, admitting new partners), the collective uses a **4-Signal Consent Protocol**:

| Signal | Meaning | Actionable Rule |
| :--- | :--- | :--- |
| 🟢 **Agree** | "I support this proposal." | Counted toward positive consensus. |
| 🟡 **Abstain** | "I trust the collective to proceed without my input." | Neutral; does not block progress. |
| 🟠 **Disagree** | "I have reservations, but I won't block the group." | Logged for discussion; does not veto. |
| 🔴 **Block** | "This violates our collective principles or endangers the co-op." | Triggers mandatory deliberation before proceeding. |

---

## 5. Architectural Standards for Developers & Agents

1. **Zero Data Loss**: Never merge or delete partner inventory during syncs. Partner items belong to their respective organization.
2. **Dynamic Over Hardcoded**: Never hardcode org prefixes to just `HUCK` and `PDXGL`. Always read from `team.prefs.upcPrefix` and `team.prefs.partnerPrefixes`.
3. **Transparent Ledgers**: Every financial summary must report Gross Revenue, Venue Fee, Net Payout, and Member Basis separately.

---
name: democracy-at-work-cooperative
description: Cooperative economics, Worker Self-Directed Enterprise (WSDE) surplus theory (Producers vs. Enablers of Surplus, Marketing/Social Sweat-Equity Workers), Multi-Channel Waterfall (Booths, Online + Postage, Pop-Ups), Mondragon 10/45/45 & ICAs, Personal Write-Off vs. Co-op Commons Expense Separation, and Loomio consent governance. Use when working on co-op settlements, `/coop/*` routes, `/expenses`, the 70/30 waterfall, partner payouts, sweat-equity labor, or the Commons Pool.
---

# Huckleberry Collective — WSDE, Mondragon & SELC Cooperative Architecture

This skill defines the cooperative economic engine, Multi-Founder LLC governance, Universal Curator foundation, 4-Gate multi-channel financial waterfall, Dual-Option Co-Curation (`35/35` & `Transfer Price`), Shared Online Storefront rules, Personal Schedule C vs. Co-op Commons expense separation, Mondragon `10/45/45` capital account rules, and Loomio consent governance for **The Huckleberry Collective** (`HUCK-`), **PDX Game Library** (`PDXGL-`), **Promoters, Enablers & Builders** (`SWEAT-`), and consignors (`BB-`) on **Works@TheHC** / **Resale Command** (`works.thehc.llc` / `works.thehc.coop` / `resalecmd.com`).

> **Deep Reference:** See [`.agents/skills/democracy-at-work-cooperative/references/WSDE_MONDRAGON_SELC_REFERENCE.md`](.agents/skills/democracy-at-work-cooperative/references/WSDE_MONDRAGON_SELC_REFERENCE.md), [`src/content/coop/shared-online-storefronts.md`](src/content/coop/shared-online-storefronts.md), and [`docs/coop/WSDE_OPERATING_CHARTER.md`](docs/coop/WSDE_OPERATING_CHARTER.md).
> **UI Wording Rule:** Always use institutional WSDE/Mondragon/cooperative terminology (`Worker Self-Directed Enterprise`, `Producers & Enablers of Surplus`, `Mondragon 10/45/45`, `Indivisible Commons Reserve`) in UI components—never cite individual economists by personal name in user-facing UI text.

---

## 1. Multi-Founder LLC Stewardship, Universal Curator Foundation & Member Archetypes

1. **Multi-Founder LLC & Open-Book Equality (`1 Member = 1 Vote`):**
   - `thehc.llc` operates as a multi-founder cooperative steward entity. Every confirmed voting member (`founder`, `curator`, `promoter`, `enabler`, `builder`) shares **one identical information class** (`canSeeCollectiveFinancials === true`)—you cannot vote on numbers you cannot see. Founders differ strictly in fiduciary execution authority (enacting voted splits, locking settled months, approving labor, managing booth leases), never in financial visibility or voting weight.
2. **Universal Curator Base Role (`ensureCuratorBaseRoles`):**
   - Every initial voting/provider invite (`founder`, `promoter`, `enabler`, `builder`) **automatically includes `💎 Curator`** on onboarding so any worker-member can source, tag, or co-curate inventory whenever they choose without waiting on an admin role change (Founders can still intentionally uncheck `curator` later if desired).
   - **`🏷️ Consignor` Strict Isolation:** External consignors (`BB-`) are never auto-paired with `curator` or voting roles and only ever see their own contractual statement and inventory.
3. **The 4 Active Participation Archetypes:**
   - **Curator Worker-Members (`HUCK-`, `PDXGL-` — Producers of Surplus):** Source and own inventory (`UPC` prefix). Recoup `100%` of item cost basis first, keep `70%` Curator Base Profit (Gate 3), and share in Gate 4B Sales Patronage (`45%–60%`) + Sweat-Equity Labor (`30%–45%`). Full `1M1V` rights.
   - **Promoters & Surplus Enablers (`SWEAT-` — Enablers of Surplus):** **`$0` Inventory Required.** Contribute Dropcast Reels, social campaigns, photography, online order packing/shipping, booth restocking, and POS reconciliation. Earn direct **Individual Worker Sweat-Equity Dividends** from the Gate 4B Labor Pool (`30%–45%` of excess surplus) proportional to verified hours (`1h = 1h`) logged in `/coop/labor`. Full `1M1V` rights.
   - **Builders (`🛠️ Builder` — Dev, Design & Physical Displays):** **`$0` Inventory Required.** Contribute web/app engineering, AI workflow tooling, brand/label design, custom woodworking/shelving fixtures, and lighting/display builds for physical booths. Verified Commons hours earn equal `1h = 1h` Gate 4B Labor Pool dividends alongside full `1M1V` rights.
   - **External Consignors (`BB-` — Contractual Sub-Lease):** Pay `15%` Venue Fee (Gate 1) + contractual rent/commission (e.g., `$85.41/mo` fixed sub-lease rent offset in Gate 2) and keep `100%` of remaining net sales. No Commons Pool duties or WSDE voting.

---

## 2. Dual-Option Backstock & Online Co-Curation (`HG` / `HH`) + Shared Storefront Rules

1. **Dual-Option Co-Curation (Chosen Per Lot or Item Between Members):**
   - **Mode A — `35% / 35%` Co-Curator Split:** Original (`OG`) Buyer recoups `100%` of landed item cost basis first in Gate 2; the `70%` Gate 3 Curator share splits **`35%` OG Buyer / `35%` Active Lister** (who cleans, photographs, lists, and ships/merchandises), with `30%` to the Shared Commons Pool.
   - **Mode B — Agreed Fair Transfer Price:** Parties agree on a fixed wholesale transfer floor upfront. On sale, OG Buyer receives `100%` of that agreed transfer floor first in Gate 2; Active Lister earns the full `70%` Curator share on all net margin above that floor (`30%` to Commons Pool).
2. **Shared "Digital Booth `#0EJ`" Online Storefront (`eBay` + `Pirate Ship`):**
   - **eBay Business Account (`thehc.llc` EIN + LLC Bank) + Multi-User Account Access (`MUAA`):** Invite Curators via `Account Settings -> Permissions` (*Create/edit drafts, Publish listings, Print labels* — zero access to LLC banking or payouts).
   - **Pirate Ship (`$0/mo`) + `Custom SKU` Attribution:** Connected to the Co-op eBay account with `Print Custom SKU on Label` enabled (`HUCK-1042`) so outbound postage maps `1:1` to the exact item SKU.
   - **Cost Waterfall:** `<= 250` eBay listings/mo = `$0/mo` fixed subscription; per-order eBay fee (`~13.25%`) + actual Pirate Ship outbound label postage recouped `100%` first in Gate 1/2 before the `70/30` split; shared packing supplies (boxes, poly mailers, tape, Rollo `4×6` thermal labels) & optional `$21.95/mo` Basic Store (`> 250` listings/mo) reimbursed from the **`30%` Commons Pool (Gate 4A)**.
3. **The 4 Mandatory Operational Safeguards:**
   - **No Double-Dipping:** Work performed on a member's own inventory or a co-curated (`35/35` or `Transfer Price`) item is compensated by Gate 3 Curator profit—**never** log own-item prep/listing hours to `/coop/labor`. `/coop/labor` (`1h = 1h`) is strictly for shared Collective Commons work (whole-booth resets, shared software/fixtures, collective Dropcasts, consignor/commons fulfillment).
   - **Online Returns = Next-Month Adjustment:** Never unlock a locked prior settlement month for an eBay/online return; record refunded margin + return label postage as a **Next-Month Adjustment** against the original partner split.
   - **14-Day Co-Curation Claim Clock:** Claimed backstock items in `HG`/`HH` must be photographed and listed within **14 days**, or the claim automatically releases so an OG Buyer's capital is never frozen.
   - **Physical Floor Separation (`📦 Online Ready Bin`):** Items actively listed on eBay/Poshmark MUST be stored in a clearly marked **`📦 Online Ready Bin` in `HH` or `HG`**—never left loose on the `#0EJ` or `DT` retail floor where walk-in shoppers could buy the same item simultaneously.

---

## 3. Multi-Channel Co-op Economics & Mondragon 10/45/45 Waterfall

- **Physical Mall Booths (`MD` 15% / `DT` 10%):** Venue fee deducted in Gate 1; Net Booth Rent covered by the `30%` Commons Pool in Gate 4A.
- **Pop-Up Markets & Conventions (`2.9%` Card / `0%` Cash):** Weekend Table/Tent Fee reimbursed `100%` from the `30%` Commons Pool; load-in and booth staffing logged under `Pop-Up & Event Staffing` in `/coop/labor`.
- **Indivisible Collective Reserve & Shortfall Carryover (`carriedOverShortfall`):** Funded by the `30%` Shared Commons Pool (`commonsSharePct`). Any monthly operating deficit is carried forward and repaid **100% first** before Gate 4B bonus patronage dividends unlock.
- **Mondragon `10 / 45 / 45` Net Surplus Waterfall:** `10%` Inter-Co-op Reserve • `45%` Enterprise / Sales Patronage • `45%` Member Capital / Sweat-Equity Ledger (ICAs, targeting a `7%` annual yield on retained balances), governed by `1M1V`, `4.5:1` Standard (`6.5:1` Max) Pay Ratio Cap, and Complementary Niche Non-Competition (`HUCK-` vs. `PDXGL-`).

---

## 4. Personal Schedule C Write-Off vs. Shared Co-op Commons Expense Separation

Every expense in `src/lib/coopExpenses.ts` (`/expenses`) has an explicit `scope`:
- **`coop_shared` (`🤝 Co-op Shared 100%`):** Reimbursed from the `30%` Commons Pool in Gate 4A (Booth Rent, shared Rollo tags, shared shipping mailers/boxes, shared AI/cloud ops, display lumber/hardware, pop-up table fees).
- **`personal_write_off` (`👤 Personal Write-Off 100%`):** **`$0.00` charged to the Co-op Commons Pool** (strictly excluded from `CoopSettlementView.vue`); tracked `100%` in the member's **Personal IRS Schedule C Write-Off Ledger & CSV Export** (thrift mileage/gas, home office/garage storage, personal phone/camera gear).
- **`split` (`⚖️ Split %`):** Charges `coopSharePct%` to Gate 4A Co-op Commons and `(100 - coopSharePct)%` to Personal Schedule C Write-Offs.

---

## 5. Canonical `/coop/*` Routes & Cloud Persistence

- `/coop/settlements` ([`src/pages/coop/settlements.astro`](src/pages/coop/settlements.astro)) — 4-Gate Monthly Settlement Workbench (`CoopSettlementView.vue`)
- `/coop/governance` ([`src/pages/coop/governance.astro`](src/pages/coop/governance.astro)) — 3-Tab Loomio Proposals, 6 Democratic Dials & Sliders, and Voter Roster (`CoopGovernanceView.vue`)
- `/coop/labor` ([`src/pages/coop/labor.astro`](src/pages/coop/labor.astro)) — Cloud-Synced Sweat-Equity & Enabling Labor Ledger (`CoopLaborView.vue`)
- `/coop/cms` ([`src/pages/coop/cms.astro`](src/pages/coop/cms.astro)) — Headless Flagship Copy (`thehc.llc/#works`), Storefront Directory & Multi-Channel Events Studio (`CoopFlagshipCmsView.vue` ➔ `GET /api/public/flagship-content` + 1-tap `RecordSaleDrawer.vue` Event Chips)
- `/expenses` ([`src/pages/expenses.astro`](src/pages/expenses.astro)) — Co-op Shared Commons vs. Personal Schedule C Write-Off Ledger (`CoopExpensesLedger.vue`)
- `/coop` ([`src/pages/coop.astro`](src/pages/coop.astro)) — Interactive WSDE Operating Charter & Multi-Channel Simulator (`CoopCharterView.vue`)

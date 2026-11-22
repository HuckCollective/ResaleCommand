```text
MODEL: Orchestrator (Carbon) or Gemini 4 Carbon (High)
BEST GEMINI $0-POOL SWAP: Gemini 4 Neon (High) for 1-turn financial/idempotency audit

WAVE 5 OF 6 (CUTOVER BLOCKER #5 — SALES LEDGER, RICOCHET PAYOUT COMMIT, EXPENSES & 4-GATE CO-OP SETTLEMENTS)
TARGET WORKSPACE: thehc-platform (branch: dev — requires Waves 1–4 complete, including @thehc/core salesBucketing & ricochetPayoutParser)
READ-ONLY REFERENCE SIBLING: ResaleCommand (attach read-only; NEVER edit ResaleCommand)

GOAL
Port the complete financial spine into @thehc/core, functions/fn-coop-waterfall-ledger, and apps/works: Official Sales Ledger, Ricochet Live Sales Sync & Dusty Tiger Paper Sheet OCR with Law 6 3-Tier Commit Idempotency, IRS Schedule C / Form 1065 Expenses, 4-Gate Monthly Co-op Settlements (incl. BB- $85.41 offset, SWEAT- Gate 4B labor pool, Month Lock, PDF export), Sweat-Equity Labor, and Co-op Governance.

CRITICAL FINANCIAL & IDEMPOTENCY INVARIANTS
1. READ-FIRST SALES LEDGER INVARIANTS:
   - Read ResaleCommand/.agents/rules/sales-reconciliation-and-payout-invariants.md first.
   - SKU + price is NEVER a sale identity; one sale line = ticket # + occurrence + gross + net.
   - Multi-Qty Booth Bins decrement quantity down to >= 1 (mark status: 'sold' only when depleted, never quantity: 0) and preserve historical bin matching via buildLockedMultiBinMap.
2. LAW 6 — 3-TIER COMMIT IDEMPOTENCY (Every Money-Moving Commit Safe to Click Twice):
   - Layer 1 (UI Lock): Commit button disables synchronously on click (isCommitting = true) with chunked batch progress (25–50 rows/request); any error unlocks UI and shows toUserMessage toast.
   - Layer 2 (Manifest Transition): Appwrite staging manifest transitions staged -> committed (committed_at, committed_count); committed manifests hide Commit and render "✅ Already Synced".
   - Layer 3 (Server Ticket Dedupe): Server checks ticket_number + calendar sold_date + location against sales before every insert and skips duplicates (0 duplicate sales, ever).
3. CO-OP 4-GATE WATERFALL & CLOUD FUNCTION LOOP GUARD:
   - Gate 1: Dynamic Venue Fee (from warehouses row — never hardcoded) + Outbound Postage.
   - Gate 2: 100% Curator Verified Cost Basis Recouped.
   - Gate 3 & 4: Net Surplus split 70% Curator / 30% Commons Pool; BB- consignor $85.41/mo contractual rent offset; Gate 4B SWEAT- labor pool & Mondragon 10/45/45 excess reserve math — all integer cents (allocateLargestRemainder, zero float penny drift).
   - In functions/fn-coop-waterfall-ledger: enforce strict idempotency guard (early-exit if waterfallComputedAt is already set and matching, execute: [] permissions) and verify via @thehc/fn-harness.
4. EXPENSES & TAX SEPARATION:
   - Preserve IRS Schedule C / Form 1065 statutory categories, proof-of-payment invariants, and strict separation between Personal Member Write-Offs vs. Co-op Commons Pool Expenses.

READ-ONLY SOURCE FILES IN SIBLING ResaleCommand
- .agents/rules/sales-reconciliation-and-payout-invariants.md
- src/lib/sales.ts, src/composables/useRicochetSalesSync.ts
- src/lib/coop/settlementEngine.ts, src/lib/coop/settlementInputs.ts, src/lib/coopLedgerServer.ts, src/lib/coopLedgerClient.ts, src/lib/coopSettlementPdf.ts
- src/lib/coopExpenses.ts, src/lib/taxCms.ts, src/lib/coopTaskBoard.ts, src/lib/coopGovernance.ts, src/lib/charterCms.ts
- src/pages/sales.astro, src/pages/sales/new.astro, src/pages/sales/[id].astro, src/pages/sales/import/[...location].astro
- src/pages/api/sales/ricochet-sync.ts, src/pages/api/sales/sync-memoryden-payouts.ts, src/pages/api/sales/default-payout.ts, src/pages/api/sales/parse-sheet.ts
- src/pages/expenses.astro
- src/pages/coop.astro, src/pages/coop/settlements.astro, src/pages/coop/labor.astro, src/pages/coop/governance.astro, src/pages/coop/governance/[id].astro, src/pages/coop/charter.astro, src/pages/coop/docs/[slug].astro
- src/pages/api/coop/month-lock.ts, labor.ts, tasks.ts, membership-action.ts, prefix-request.ts, format-coop-proposal.ts

DELIVERABLES IN thehc-platform
1. packages/core & functions/fn-coop-waterfall-ledger:
   - Complete 4-Gate settlementEngine + SWEAT- labor + expense/tax helpers in @thehc/core + golden snapshot tests matching legacy settlement cent outputs.
   - Finalize fn-coop-waterfall-ledger persistence + loop guard + @thehc/fn-harness tests.
2. apps/works:
   - Sales routes & endpoints: /sales, /sales/new, /sales/[id], /sales/import/[...location] (Slide-Over Import Tray per Law 5 + RicochetLiveSalesPanel + Dusty Tiger paper sheet OCR), plus /api/sales/ricochet-sync, /api/sales/sync-memoryden-payouts, /api/sales/default-payout, /api/sales/parse-sheet (and typed astro:actions where appropriate).
   - Expenses & Co-op routes: /expenses, /coop, /coop/settlements (4-Gate + Month Lock + PDF export), /coop/labor, /coop/governance, /coop/governance/[id], /coop/charter, /coop/docs/[slug] (Astro 7 Content Layer).

FORBIDDEN ACTIONS
- NEVER edit ResaleCommand or mutate live production sales/coop_ledger records during tests.
- NEVER run astro build, vite build, Playwright, Puppeteer, or headless browsers on Windows.
- NEVER stamp "today" or check/payout dates onto sold_date (Law 2 & Law 7).

VERIFICATION GATE
1. Start with /plan (implementation_plan.md stamped at Line 1) before writing code.
2. Add Vitest golden tests verifying:
   - Law 6 3-tier idempotency (re-submitting identical Ricochet payout batch inserts 0 duplicate sales and transitions manifest staged -> committed).
   - Cent-exact parity across HUCK-, PDXGL-, BB- ($85.41 offset), and SWEAT- 4-Gate settlements.
   - fn-coop-waterfall-ledger early-return loop guard when waterfallComputedAt is already present.
3. Run pnpm.cmd verify AND pnpm.cmd bundle:functions — both must exit 0.
4. Run read-only hc-design-critic on /sales, /expenses, and /coop/settlements before committing to dev.
```

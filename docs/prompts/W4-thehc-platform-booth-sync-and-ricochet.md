```text
MODEL: Orchestrator (Carbon) or Gemini 4 Carbon (High)
BEST GEMINI $0-POOL SWAP: Gemini 4 Neon (High) for 1-turn plan audit & Law 3/7 math verification

WAVE 4 OF 6 (CUTOVER BLOCKER #4 — UPFRONT LAW 3/7 SALES BUCKETING ENGINE + WAREHOUSES & MEMORY DEN #0EJ BOOTH SYNC)
TARGET WORKSPACE: thehc-platform (branch: dev — requires Waves 1–3 complete)
READ-ONLY REFERENCE SIBLING: ResaleCommand (attach read-only; NEVER edit ResaleCommand)

GOAL
1) FIRST replace the 44-line stub packages/core/src/domain/salesBucketing.ts (which currently violates Law 7 via new Date().toISOString().slice(0, 7)) with the full battle-tested Law 3 & Law 7 matching/bucketing engine + ricochetPayoutParser.ts + Vitest golden tests (because Booth Sync depends on matchMemoryDenInventoryItem, buildLockedMultiBinMap, splitTrailingBoothSku, and usedUpcs self-healing).
2) Ship /warehouse, /warehouse/[id], and /warehouse/sync/[...location] (/MD, /DT, /HG, /HH) with live 808/808 scorecard parity, strict ES5 Ricochet bookmarklet compatibility, and all 3 Physical Retail Tag Safety Laws.

CRITICAL ARCHITECTURE & PHYSICAL TAG SAFETY INVARIANTS
1. STEP 1 — REPLACE STUB salesBucketing.ts & PORT ricochetPayoutParser.ts (Laws 3, 4, 7):
   - Port full salesBucketing.ts into @thehc/core: splitTrailingBoothSku, canonicalTicketNumber, isPayoutSummaryRow, assignOccurrenceFingerprints, flagAlreadyRecordedRows, matchMemoryDenInventoryItem, buildLockedMultiBinMap, calendarMonthKeyFromDateString, pacificMonthKey, monthKeyToLabel.
   - LAW 7 DATE INVARIANT: Group strictly by calendar sold_date string parsing (1-indexed YYYY-MM). NEVER call Date#getMonth() or convert date-only/UTC-midnight sold dates through UTC/timezone. Assert in Vitest that "11-02-2026" and "11-03-2026" -> "2026-11" ("November 2026") with zero UTC shift!
   - Port all 3 Memory Den CSV parsers (Products-*.csv catalog/stock ONLY — NEVER creates sales rows!; Payouts *.csv interim ticket + Sold Date; Payout History *.csv settled check w/ trailing " - 0EJXXX").
2. THE 3 PHYSICAL RETAIL TAG SAFETY LAWS (Barcodes Are Physical Shelf Stickers):
   - Law #1 (Never Auto-Overwrite Existing Ricochet Barcodes): "🚀 Fill Missing" in public/ricochet-upc-sync.user.js MUST ONLY count and write to items where Ricochet's current UPC is genuinely blank (verifyStatus === 'MISSING_IN_MD'). Never overwrite MISMATCH_UPC, and abort PUT /api/product/items if GET /api/product/show/{id} reveals targetItem.upc_code is already populated.
   - Law #2 (Mandatory Visible Pre-Flight Queue Preview): Render visible #rc-preflight-details listing exact N blank items ("0EJ... | Blank ➔ HUCK-XXXX | 🏷️ Pre-Tagged vs 🆕 Virtual (9740+)") before running "🚀 Fill Missing (N)".
   - Law #3 (Physical Sticker Wins / 1-Click "🏷️ Adopt Booth Tag"): Whenever verifyStatus === 'MISMATCH_UPC', provide 1-click "🏷️ Adopt Booth Tag ([mdUpc])" (POST /api/md-verify-report mode: 'adopt_md_upc'); historical Sold/Paid (Qty: 0) items linked in resale_db are VERIFIED_MATCH; phone-added booth items auto-adopt unclaimed HUCK-XXXX tags or surface as "🆕 New Booth Item".
3. ZERO HARDCODED LOCATIONS OR SNAPSHOTS:
   - Never hardcode 'md_verify_report_latest' or venue fees — read dynamically from warehouses.ts.
   - Keep bookmarklet live-loader URL exact: /scripts/rico-bookmarklet.js?location=${code}&t= displaying "✅ Live Auto-Updated Script", and keep public/ricochet-upc-sync.user.js strict ES5 (zero const/let/arrow functions/template literals).

READ-ONLY SOURCE FILES IN SIBLING ResaleCommand
- .agents/rules/sales-reconciliation-and-payout-invariants.md (READ FIRST!)
- src/lib/salesBucketing.ts, src/lib/ricochetPayoutParser.ts, src/lib/manifests.ts, src/lib/manifestReconciliation.ts, src/lib/reconciliation.ts, src/lib/locationSyncScorecard.ts, src/lib/syncHistory.ts
- src/pages/warehouse.astro, src/pages/warehouse/[id].astro, src/pages/warehouse/sync/[...location].astro, src/pages/inventory/sync.astro (302 redirect -> /warehouse/sync)
- src/pages/scripts/rico-bookmarklet.js.ts, public/ricochet-upc-sync.user.js
- src/pages/api/md-verify-report.ts, src/pages/api/manifests/ricochet-drop-sync.ts, src/pages/api/ai-match-booth-items.ts, src/pages/api/match-inventory.ts, src/pages/api/suggest-lot-matches.ts
- src/components/warehouses/*

DELIVERABLES IN thehc-platform
1. packages/core:
   - Full salesBucketing.ts (deleting the Law-7-violating stub), ricochetPayoutParser.ts, manifests.ts, locationSyncScorecard.ts + comprehensive Vitest golden tests in packages/core/test/.
2. apps/works:
   - Pages: /warehouse, /warehouse/[id], /warehouse/sync/[...location] (/warehouse/sync/MD|DT|HG|HH), plus 302 redirect /inventory/sync -> /warehouse/sync.
   - Exact bookmarklet & sync endpoints (CORS OPTIONS + Bearer/session auth): /scripts/rico-bookmarklet.js, public/ricochet-upc-sync.user.js (strict ES5), /api/md-verify-report, /api/manifests/ricochet-drop-sync, /api/ai-match-booth-items, /api/match-inventory, /api/suggest-lot-matches.

FORBIDDEN ACTIONS
- NEVER edit ResaleCommand or mutate live production resale_db records during local tests.
- NEVER run astro build, vite build, Playwright, Puppeteer, or headless browsers on Windows.
- NEVER allow Products-*.csv catalog sync to create sales records or overwrite populated Ricochet UPCs.

VERIFICATION GATE
1. Start with /plan (implementation_plan.md stamped at Line 1) before writing code.
2. Add Vitest contract tests verifying:
   - Law 7 date parsing ("11-02-2026" & "11-03-2026" -> "2026-11" / "November 2026", zero UTC conversion).
   - 1-to-1 0EJ <-> UPC bijection + usedUpcs self-healing + locked Multi-Qty Booth Bin matching.
   - Strict ES5 syntax check on apps/works/public/ricochet-upc-sync.user.js, identical /scripts/rico-bookmarklet.js loader contract, CORS OPTIONS headers, and all 3 Physical Retail Tag Safety Laws.
3. Run pnpm.cmd verify (Windows) or pnpm verify (macOS/Linux) — must exit 0.
4. Run read-only hc-design-critic on /warehouse and /warehouse/sync/[...location] before committing to dev.
```

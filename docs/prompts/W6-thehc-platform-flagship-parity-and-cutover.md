```text
MODEL: Orchestrator (Argon) or Orchestrator (Carbon)
BEST GEMINI $0-POOL SWAP: Gemini 4 Argon (Medium) for Flagship UI; Gemini 4 Neon (High) for pre-cutover contract audit (hc-migration-auditor)

WAVE 6 OF 6 (SWITCH-OVER WAVE — FLAGSHIP CMS PARITY, SHADOW VERIFICATION & ZERO-DOWNTIME DOMAIN CUTOVER)
TARGET WORKSPACE: thehc-platform (branch: dev -> user-approved promotion to main)
READ-ONLY REFERENCE SIBLING: ResaleCommand (attach read-only; NEVER edit ResaleCommand)

GOAL
Complete Headless Flagship CMS & public onboarding parity across apps/works (/coop/cms) and apps/flagship (live CMS home, Charter, Booths, /join), run the full hc-migration-auditor pre-cutover verification suite on works-dev.thehc.llc and works-main.thehc.llc, park legacy ResaleCommand on legacy.resalecmd.com as a 14-day instant rollback safety net, and flip canonical production domains to thehc-platform with zero downtime.

CRITICAL CUTOVER & PUBLIC ZERO-PII INVARIANTS
1. ZERO-PII PUBLIC BOUNDARY IN apps/flagship:
   - Public pages and /api/public/flagship-content MUST NEVER expose item cost, purchasePrice, maxBuyPrice, purchaseId, buyerId, rawAnalysis, tenantId, or internal member emails.
   - Note: Do NOT port legacy /subsite/* to apps/works — the full sharded Cloud Function public shop (/shop) ships cleanly right after cutover in Wave 7 (Prompt 02) & Wave 8 (Prompt 03)!
2. EDITORIAL VS OPERATOR VISUAL REGISTERS:
   - apps/works uses <html data-theme="huckleberry" data-register="operator">.
   - apps/flagship uses <html data-theme="huckleberry" data-register="editorial">.
3. EXPLICIT USER APPROVAL BEFORE main MERGE OR DOMAIN FLIP:
   - Commit all code to dev first, verify on works-dev.thehc.llc / dev.thehc.llc (*_dev staging mirrors), and STOP for explicit user sign-off before merging dev -> main or moving production Vercel domain aliases.

READ-ONLY SOURCE FILES IN SIBLING ResaleCommand
- src/lib/flagshipContent.ts, src/lib/flagshipContentServer.ts, src/lib/publicStorefrontItem.ts
- src/pages/coop/cms.astro, src/pages/api/coop/flagship-cms.ts, src/pages/api/public/flagship-content.ts
- src/pages/join.astro, src/pages/api/join-request.ts, src/pages/api/join-reminders.ts
- docs/HUCKLEBERRY_COLLECTIVE_COOP_CHARTER.md, docs/coop/WSDE_OPERATING_CHARTER.md
- docs/STRANGLER_PARITY_AND_CUTOVER_MATRIX.md (§6 Zero-Downtime Vercel Cutover Runbook)

DELIVERABLES IN thehc-platform
1. packages/core:
   - Port flagshipContent schemas/helpers and publicStorefrontItem allowlist sanitizer + Vitest tests asserting zero private fields leak.
2. apps/works:
   - Build /coop/cms (Headless Flagship CMS editor via typed astro:actions) + /api/public/flagship-content.
3. apps/flagship:
   - Upgrade src/pages/index.astro to render live CMS blocks from resale_db (with graceful fallback), add dedicated Charter & Booths sections/pages via Astro 7 Content Layer, and add /join + join-request submission action.
4. Pre-Cutover Audit & Domain Cutover Checklist:
   - Invoke hc-migration-auditor (read-only) across apps/works, apps/flagship, packages/core, packages/ui, and functions/* checking:
     a) SSR auth gate covers 100% of operator pages, /_actions/*, and non-public /api/*.
     b) Zero hardcoded venue fees, rents, fallback dates, or tenantIds.
     c) Ricochet & Auction bookmarklet URLs, CORS OPTIONS headers, ES5 syntax, and 3 Physical Retail Tag Safety Laws match 100%.
     d) Live read-only parity check on works-main.thehc.llc against live resale_db confirms identical Memory Den scorecard counts and cent-exact monthly sales/settlement totals vs ResaleCommand.
   - Present the 4-step Vercel Domain Swap Checklist for user approval:
     1) Bind legacy.resalecmd.com to frozen ResaleCommand project (14-day instant rollback).
     2) Point works.thehc.llc, works.thehc.coop, and resalecmd.com -> @thehc/works.
     3) Point thehc.llc and thehc.coop -> @thehc/flagship.
     4) Proceed to Post-Cutover Wave 7 (02-thehc-platform-storefront-cloud-functions.md) & Wave 8 (03-flagship-storefront-ui-and-checkout.md) in the new platform!

FORBIDDEN ACTIONS
- NEVER edit ResaleCommand or read .env files.
- NEVER run astro build, vite build, Playwright, Puppeteer, or headless browsers on Windows.
- NEVER merge dev -> main or re-assign production Vercel domains without explicit user confirmation in chat.

VERIFICATION GATE
1. Start with /plan (implementation_plan.md stamped at Line 1) before writing code.
2. Run pnpm.cmd verify AND pnpm.cmd bundle:functions — both must exit 0.
3. Run hc-design-critic on apps/flagship (Editorial register) and /coop/cms (Operator register), then run hc-migration-auditor and present the final Cutover Go/No-Go report.
```

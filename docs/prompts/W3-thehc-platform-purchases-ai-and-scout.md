```text
MODEL: Orchestrator (Carbon) or Gemini 4 Carbon (High)
BEST GEMINI $0-POOL SWAP: Gemini 4 Neon (High) for 1-turn plan audit; Gemini 4 Hydrogen (Medium) for recon & pnpm.cmd verify

WAVE 3 OF 6 (CUTOVER BLOCKER #3 — PURCHASES, HAUL INGESTION, AI VISION SUITE & AUCTION BOOKMARKLET)
TARGET WORKSPACE: thehc-platform (branch: dev — requires Waves 1–2 complete)
READ-ONLY REFERENCE SIBLING: ResaleCommand (attach read-only; NEVER edit ResaleCommand)

GOAL
Port the complete sourcing, haul intake, receipt OCR, AI Quick Scout / Deep Scan vision suite, and the sanctioned Auction & ShopGoodwill Sourcing Bookmarklet into @thehc/core/ai and apps/works.

CRITICAL AI, SCHEMA & BOOKMARKLET INVARIANTS
1. UNIFIED GEMINI SDK & TWO-WORLD ISOLATION:
   - All runtime Gemini calls live in @thehc/core/ai using @google/genai (GEMINI_API_KEY) + Zod 4 structured JSON schemas + fire-and-forget ai_telemetry (dev: prefix in dev).
   - Never import legacy @google/generative-ai or expose PUBLIC_GEMINI_*.
   - Enforce strict physical OCR grounding, user note authority, and cash-cleared secondary market fee modeling (Poshmark 20%, Depop 3.3%, eBay, Memory Den/Dusty Tiger dynamic venue fee — zero retail MSRP anchoring!).
2. LAW 1 DEFAULT LOCATION ON INTAKE:
   - Every received/intake item MUST receive an explicit canonical storageLocation ('HG' default, or 'HH' when selected) — never leave storageLocation blank.
3. SANCTIONED SOURCING BOOKMARKLET PRESERVATION:
   - Preserve exact external URLs, strict ES5 client loader compatibility, 3-domain failover (works.thehc.llc, works.thehc.coop, resalecmd.com), Bearer auth, and CORS OPTIONS preflight headers for:
     - /scripts/auction-bookmarklet.js + public/auction-scout-sync.user.js
     - /api/bml/auction-sweep
     - /api/bml/sgw-sync
   - Remember: sourcing clippers read public auction/ShopGoodwill lot metadata into OUR intake queue; NEVER build seller-portal listing injectors.

READ-ONLY SOURCE FILES IN SIBLING ResaleCommand
- src/lib/ai/schemas/common.schema.ts, speed-scout.schema.ts, lot-inspection.schema.ts
- src/lib/ai/instructions/system-instructions.ts, prompt-builders.ts
- src/lib/ai/verification/verify-inspection.ts, src/lib/ai-inspection.ts, src/lib/appraisalCalibration.ts
- src/lib/purchases.ts, src/lib/auctionSweep.ts, src/lib/onlineSourcingAdapters.ts, src/lib/sourcingDomains.ts, src/lib/shipmentTracking.ts
- src/pages/purchases/index.astro, new.astro, speed-entry.astro, ingest.astro, import.astro, [id].astro
- src/pages/scout/[...view].astro
- src/pages/api/identify-item.ts, inspect-lot.ts, parse-receipt.ts, estimate-price.ts, extract-components.ts, extract-images.ts, detect-watermarks.ts, generate-description.ts, scout-and-save.ts, proxy-item-details.ts
- src/pages/scripts/auction-bookmarklet.js.ts, public/auction-scout-sync.user.js, src/pages/api/bml/auction-sweep.ts, src/pages/api/bml/sgw-sync.ts

DELIVERABLES IN thehc-platform
1. packages/core/src/ai & domain:
   - Port speed-scout & lot-inspection Zod 4 schemas, OCR grounding prompts, verify-inspection post-checks, appraisalCalibration, purchases math, and ShopGoodwill CSV/order parsers + Vitest tests.
2. apps/works:
   - Typed astro:actions for purchase CRUD, speed-entry haul batch creation (Law 1 HG/HH default), ShopGoodwill CSV import, and purchase-to-items cost allocation.
   - Vision & sourcing API routes in src/pages/api/*: identify-item, inspect-lot, parse-receipt, estimate-price, extract-components, extract-images, detect-watermarks, generate-description, scout-and-save, proxy-item-details, bml/auction-sweep, bml/sgw-sync.
   - Bookmarklet live-loader: src/pages/scripts/auction-bookmarklet.js.ts + apps/works/public/auction-scout-sync.user.js (strict ES5).
   - Pages: /purchases, /purchases/new, /purchases/speed-entry, /purchases/ingest, /purchases/import, /purchases/[id], and /scout/[...view] ("⚡ Quick Scout", "🔍 Deep Scan", Buy Trackers).

FORBIDDEN ACTIONS
- NEVER edit ResaleCommand or read .env files.
- NEVER run astro build, vite build, Playwright, Puppeteer, or headless browsers on Windows.
- NEVER store Base64 images in resale_db item documents.

VERIFICATION GATE
1. Start with /plan (implementation_plan.md stamped at Line 1) before writing code.
2. Add Vitest tests for Zod 4 AI schema validation, verify-inspection math/OCR gates, ShopGoodwill CSV cost allocation, and strict ES5 syntax + CORS OPTIONS contract on /scripts/auction-bookmarklet.js & /api/bml/*.
3. Run pnpm.cmd verify (Windows) or pnpm verify (macOS/Linux) — must exit 0.
4. Run read-only hc-design-critic on /purchases/* and /scout/* views before committing to dev.
```

```text
MODEL: Orchestrator (Carbon) or Gemini 4 Carbon (High)
BEST GEMINI $0-POOL SWAP: Gemini 4 Neon (High) for 1-turn plan audit; Gemini 4 Argon (Medium) for Vue 3.5 drawer/label UI

WAVE 2 OF 6 (CUTOVER BLOCKER #2 — INVENTORY WORKBENCH, ITEM DRAWER, LOT SPLITTER, COPY KIT & THERMAL LABELS)
TARGET WORKSPACE: thehc-platform (branch: dev — requires Wave 1 complete)
READ-ONLY REFERENCE SIBLING: ResaleCommand (attach read-only; NEVER edit ResaleCommand)

GOAL
Upgrade apps/works from the starter WorksInventoryWorkbench table into 100% daily floor parity: unified Table + Card /inventory with tokenized search & reactive local updates, clean 4-digit UPC allocation (upcAuthority), the complete multi-tab Item Drawer (Photos, Split Lot, Combines, and safe Online Copy Kit + Official CSVs), WebRTC /scan, and /labels/studio direct thermal label printing.

CRITICAL ARCHITECTURE & SAFETY INVARIANTS
1. APPWRITE SCHEMA & MEDIA FALLBACK LAWS:
   - Never write quantity: 0 (mark status: 'sold' or 'combined' with quantity >= 1).
   - Never send isMultiQty to Appwrite; never store Base64 data: URLs in imageId, rawAnalysis, or components (imageId/galleryImageIds <= 255-char File IDs; rawAnalysis/components <= 64,000 chars).
   - Paginate cursor queries with Query.orderDesc('$id').
   - Every Appwrite Storage image <img :src=".../preview..."> MUST attach an @error fallback that retries raw /view and falls back to the next valid ID in galleryImageIds.
2. CLEAN 4-DIGIT UPC AUTHORITY:
   - Port upcAuthority.ts into @thehc/core: split-lot children and booth items ALWAYS receive clean sequential 4-digit HUCK-XXXX / PDXGL-XXXX / BB-XXXX barcodes (use parentLotId for lineage, never -A/-B/-C suffixes).
3. PERMANENT MARKETPLACE ANTI-INJECTION BAN:
   - Port the Online Bin tab inside the Item Drawer using ONLY the zero-injection In-App Split-Screen Copy Kit (onlineListingPacket.ts — Poshmark, Depop 3.3% US fee, eBay, Whatnot) + Official Seller Hub CSV exports (exportUtils.ts using parsePriceValue() — NEVER regex .replace(/[^0-9.]/g, '')!) + channelSyncOutbox.ts ('publish_listing' action + per-platform dedupe key).
   - NEVER create any bookmarklet or script that injects into whatnot.com, ebay.com, poshmark.com, depop.com, or mercari.com.
4. COLLECTIVE VOICE LABELS:
   - Preserve exact member-friendly labels: "✂️ Split Lot", "📦 Booth Bin (Multi-Qty)", "➕ Restock Bin", "↩️ Undo Combine", "📦 Combine Similar", "🎁 Build Bundle".

READ-ONLY SOURCE FILES IN SIBLING ResaleCommand
- src/lib/upcAuthority.ts, src/lib/inventoryUpc.ts, src/lib/searchEngine.ts, src/lib/inventoryKpiStats.ts, src/lib/inventoryHealthAudit.ts
- src/lib/photoSlicing.ts, src/lib/lot-strategy.ts, src/lib/bundle-pricing.ts
- src/lib/exportUtils.ts, src/lib/onlineCoCuration.ts, src/lib/onlineListingPacket.ts, src/lib/channelSyncOutbox.ts, src/lib/salesChannels.ts
- src/lib/barcode128.ts, src/lib/rolloLabelPrint.ts, src/lib/pdfLabelGenerator.ts, src/lib/qrCodeHelper.ts
- src/pages/inventory.astro, src/pages/item/[id].astro, src/pages/scan.astro, src/pages/labels/studio.astro, src/pages/labels/test.astro
- src/pages/api/proxy-image.ts, src/pages/api/upload-remote-image.ts
- src/components/inventory/*, src/components/common/drawer/* (incl. ListingQueueActions.vue & ItemOnlineTab.vue), src/components/labels/*

DELIVERABLES IN thehc-platform
1. packages/core:
   - Port upcAuthority, searchEngine (matchesTokenizedFields), exportUtils (eBay w/ PicURL, Whatnot, Poshmark CSVs via parsePriceValue), onlineListingPacket (Depop 3.3%), channelSyncOutbox, barcode128, and lot/combine math + Vitest unit tests.
2. packages/ui:
   - Add reusable HcSlideOverTray.vue and HcStorageImage.vue (enforcing the /preview -> /view -> galleryImageIds fallback law in one canonical component).
3. apps/works:
   - Typed astro:actions (Zod 4, session-gated) for item update, bulkUpdate, bulkDelete, splitLot, combineSimilar, buildBundle, undoCombine, restockBin, and channelOutbox queue/mark-listed.
   - API endpoints: /api/proxy-image (CORS-safe canvas cropping for multi-angle photo slicing) and /api/upload-remote-image.
   - Pages: /inventory (unified Table + Card view, KPI bar, bulk dock), 301 redirect /inventory-table -> /inventory?view=table, /item/[id], /scan (WebRTC camera barcode/QR scanner with proper track stop cleanup on unmount), /labels/studio, and /labels/test.

FORBIDDEN ACTIONS
- NEVER edit ResaleCommand or read .env files.
- NEVER run astro build, vite build, Playwright, Puppeteer, or headless browsers on Windows.
- NEVER write quantity: 0, isMultiQty, or Base64 data: URLs to Appwrite.

VERIFICATION GATE
1. Start with /plan (implementation_plan.md stamped at Line 1) before writing code.
2. Add Vitest tests for upcAuthority clean 4-digit allocation, matchesTokenizedFields, parsePriceValue CSV exports ($1,250.50 -> 1250.50), Depop 3.3% fee math, and channelSyncOutbox per-platform dedupe.
3. Run pnpm.cmd verify (Windows) or pnpm verify (macOS/Linux) — must exit 0.
4. Run read-only hc-design-critic on /inventory, Item Drawer, and /labels/studio before committing to dev.
```

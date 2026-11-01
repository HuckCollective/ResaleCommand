---
name: resale-booth-sync
description: Memory Den (#0EJ) & Ricochet POS 2-way barcode sync, Evergreen Live-Loader bookmarklet architecture, 1-to-1 0EJ SKU <-> UPC bijection, High-Confidence UX Pro Reconciliation (Inline #1 Preview, Multi-Piece Lot Split, 1-Call AI Stager, Live Tab Auto-Refresh), multi-partner bucketing (HUCK / PDXGL / B&B), and UX/IA empathy guardrails.
---

# Resale Booth Sync & UX/IA Empathy Guardrails (`resale-booth-sync`)

This skill governs all 2-way catalog & barcode synchronization between **Resale Command** (`resalecmd.com`) and retail booth POS systems (specifically **Memory Den Booth `#0EJ`** on `memoryden.ricoconsign.com`), along with mandatory UX & Information Architecture Empathy Guardrails.

---

## 1. UX & Information Architecture Empathy Guardrails

1. **Never Ask User for Manual Browser Plumbing**:
   - Always wire solutions directly into the native Resale Command UI (such as the Drag-and-Drop Permanent Live-Loader Bookmarklet `⚡ Memory Den Sync` in [`LocationSyncView.vue`](file:///c:/Users/15034/Projects/ResaleCommand/src/components/warehouses/LocationSyncView.vue)) rather than asking the user to manually edit bookmark URLs, paste raw payloads, or configure external browser extensions.
   - Use plain-English operational labels (`⚡ Memory Den Sync`, `🔄 Live Fetch`, `📡 Send Report to RC`, `📥 Download CSV`, `🔧 Assign Unique Barcode`, `🔗 Confirm Link`, `✂️ Split Piece from Lot`) instead of developer jargon (`PUT /api/product/items`, `JSON Payload`, `Userscript`).

2. **No Stale Client Snapshots & Zero Hardcoded Collision Maps (Single Source of Truth)**:
   - Bookmarklets and sync tools must be **thin permanent live-loaders** that dynamically load the latest script (`https://resalecmd.com/ricochet-upc-sync.user.js?v=' + Date.now()`) and fetch live `locationSku` (`0EJ...`) ➔ `HUCK-XXXX` mappings from `/api/md-verify-report?mode=payload` on every open.
   - **Prohibition of Baked-In Bookmark Payloads & Hardcoded Collision Maps**: Never bake static `window.__RC_PRELOADED_BARCODES__` JSON snapshots into the `href` of a draggable bookmarklet (`bookmarkletHref`), and never hardcode static collision maps (`EXPLICIT_COLLISION_PAIRS` / `CANONICAL_COLLISION_OVERRIDES`) in API routes or client scripts. Rely strictly on dynamic Appwrite state (`resale_db.items` with `usedUpcs` Set + newest-candidate priority).

3. **Confidence First — Zero Blind Writes**:
   - Never auto-commit AI or heuristic matches without explicit user approval.
   - Stage every recommendation visually with its photo thumbnail, calibrated confidence badge (`🟢 High 88%+`, `🟡 Review 60–87%`, `⚪ New Booth Item`), match reason, and 1-click confirmation action (`🔗 Confirm Link`, `✂️ Split Piece from Lot & Link`, or `✅ Approve Selected Matches`).

4. **Booth Operations, Multi-Qty Bin SKUs, & Multi-Piece Parent Lot Splitting**:
   - Always link Memory Den `0EJ...` SKUs in `items.locationSku` on the backend (`resale_db.items`) and respect physical booth workflows:
     - **Multi-Quantity Booth Bins (`📦 Booth Bin (Multi-Qty)`)**: Bin SKUs (`0EJ0FR`, `0EJ0H5`, `0EJ0FQ`, `0EJ0M8`, `0EJ0EC`, `0EJ0JK`, `0EJ0MN`, `0EJ0NQ`, `0EJ09E`) represent a single `0EJ...` SKU with `quantity > 1` that legitimately sells multiple times across tickets.
     - **Multi-Piece Parent Lots (`✂️ Split Piece from Lot & Link to MD`)**: Unsplit backstock lots (`isParentLotCandidate(item)` in `src/lib/salesBucketing.ts`: `quantity > 1`, `components.length > 1`, or titles matching `/\b(lot\s+of\s+\d+|\d+\s*(pcs|pc|pack|lot|set|issues|books|mags|magazines|figures|wands|pins|cards))\b/i`) are **NEVER** ruled out after 1 piece is linked! Remaining pieces from that Parent Lot stay matchable across multiple booth rows, and clicking `✂️ Split Piece from Lot & Link` (or `✂️ Split & Link All N Pieces` in the Match Drawer) creates a child item with `parentLotId`, proportional cost share (`lotCost / pieceCount`), inherited `purchaseId`/`orderId`/photos, `locationSku: '0EJ...'`, `storageLocation: 'MD'`, `warehouseId: '6a7e70050009db0e1857'`, and a fresh sequential `HUCK-XXXX` barcode.

---

## 2. Permanent Live-Loader, 1-Call AI Stager, & Live Tab Connection (`LocationSyncView.vue` ➔ `ricochet-upc-sync.user.js` ➔ `/api/md-verify-report` & `/api/ai-match-booth-items`)

1. **Drag-Once Live-Loader Bookmarklet (`bookmarkletHref` in `LocationSyncView.vue`)**:
   ```javascript
   javascript:(function(){delete window.__RC_PRELOADED_BARCODES__;if(window.__RC_REFRESH_FROM_CLOUD__){window.__RC_REFRESH_FROM_CLOUD__();return;}var s=document.createElement('script');s.src='https://resalecmd.com/ricochet-upc-sync.user.js?v='+Date.now();document.body.appendChild(s);})();
   ```
2. **1-Call AI Smart-Match Stager (`src/pages/api/ai-match-booth-items.ts`)**:
   - Uses a single compact `gemini-2.5-flash` text call (`getModel('gemini-2.5-flash')` + `generateContentWithBackoff`) to score unlinked booth rows against unclaimed inventory & parent lots (`action: 'link' | 'split_lot' | 'create_new'`, `candidateId`, `confidence: 0-100`, `reason`, `estimatedLotPieces`), staging recommendations in `LocationSyncView.vue` for 1-click user review.
3. **Appwrite Persistence (`resale_db.manifests` doc `'md_verify_report_latest'`), Appwrite Realtime, & Verified UPC Retention**:
   - `/api/md-verify-report` persists the latest `MdVerifyReportPayload` in Appwrite (`resale_db.manifests` document `'md_verify_report_latest'`, `status: 'system_sync_report'`) so reports survive Vercel cold starts and deployments, and returns `verifiedMdUpcBySku` in `GET ?mode=payload`.
   - Because Ricochet's summary list endpoint (`GET /api/product?store=1&limit=100`) omits nested `items[0].upc_code`, `public/ricochet-upc-sync.user.js` caches verified UPCs in `localStorage` (`rc_md_verified_upcs_v1`) and hydrates `verifiedMdUpcBySku` from `/api/md-verify-report?mode=payload` so refreshing `memoryden.ricoconsign.com` never drops verified counts back to `0`.
   - `LocationSyncView.vue` subscribes to Appwrite Realtime (`client.subscribe('databases.resale_db.collections.manifests.documents.md_verify_report_latest', ...)`) as well as `BroadcastChannel('resale_command_sync')` and `focus` / `visibilitychange` listeners, updating the scorecard live across domains without requiring a page reload.

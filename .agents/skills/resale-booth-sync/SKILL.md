---
name: resale-booth-sync
description: Memory Den (#0EJ) & Ricochet POS 2-way barcode sync, Evergreen Live-Loader bookmarklet architecture, 1-to-1 0EJ SKU <-> UPC bijection, multi-partner bucketing (HUCK / PDXGL / B&B), and UX/IA empathy guardrails.
---

# Resale Booth Sync & UX/IA Empathy Guardrails (`resale-booth-sync`)

This skill governs all 2-way catalog & barcode synchronization between **Resale Command** (`resalecmd.com`) and retail booth POS systems (specifically **Memory Den Booth `#0EJ`** on `memoryden.ricoconsign.com`), along with mandatory UX & Information Architecture Empathy Guardrails.

---

## 1. UX & Information Architecture Empathy Guardrails

1. **Never Ask User for Manual Browser Plumbing**:
   - Always wire solutions directly into the native Resale Command UI (such as the Drag-and-Drop Permanent Live-Loader Bookmarklet `⚡ Memory Den Sync` in [`LocationSyncView.vue`](file:///c:/Users/15034/Projects/ResaleCommand/src/components/warehouses/LocationSyncView.vue)) rather than asking the user to manually edit bookmark URLs, paste raw payloads, or configure external browser extensions.
   - Use plain-English operational labels (`⚡ Memory Den Sync`, `🔄 Live Fetch`, `📡 Send Report to RC`, `📥 Download CSV`, `🔧 Assign Unique Barcode`) instead of developer jargon (`PUT /api/product/items`, `JSON Payload`, `Userscript`).

2. **No Stale Client Snapshots (Single Source of Truth)**:
   - Bookmarklets and sync tools must be **thin permanent live-loaders** that dynamically load the latest script (`https://resalecmd.com/ricochet-upc-sync.user.js?v=' + Date.now()`) and fetch live `locationSku` (`0EJ...`) ➔ `HUCK-XXXX` mappings from `/api/md-verify-report?mode=payload` on every open.
   - **Prohibition of Baked-In Bookmark Payloads**: Never bake static `window.__RC_PRELOADED_BARCODES__` JSON snapshots into the `href` of a draggable bookmarklet (`bookmarkletHref`). The user drags the bookmark **once forever**, and the widget displays **`✅ Live Auto-Updated Script`** (`✅ Live Auto-Updated (N)`) to confirm it is running live code and live cloud data.

3. **Booth Operations & Bin SKU Awareness**:
   - Always link Memory Den `0EJ...` SKUs in `items.locationSku` on the backend (`resale_db.items`) and respect physical booth workflows:
     - **Multi-Quantity Booth Bins (`📦 Booth Bin (Multi-Qty)`)**: Bin SKUs (`0EJ0FR` ➔ `HUCK-1309`, `0EJ0H5` ➔ `HUCK-1425`, `0EJ0FQ` ➔ `HUCK-1308`, `0EJ0M8` ➔ `HUCK-1498`, `0EJ0EC` ➔ `HUCK-0113`, `0EJ0JK` ➔ `HUCK-1460`, `0EJ0MN` ➔ `HUCK-1323`, `0EJ0NQ` ➔ `HUCK-9455`, `0EJ09E` ➔ `HUCK-0296`) represent a single `0EJ...` SKU with `quantity > 1` that legitimately sells multiple times across tickets.
     - **True Duplicate SKU Collisions (1-to-1 Bijection)**: Two *different* `0EJ...` SKUs in Ricochet POS may **NEVER** share the same `upc` (`422 Unprocessable Entity`). True collision pairs (`0EJ0MQ` ➔ `HUCK-0334` / `0EJ09A` ➔ `HUCK-9716`, `0EJ0HE` ➔ `HUCK-1379` / `0EJ0MW` ➔ `HUCK-9724`, `0EJ0JJ` ➔ `HUCK-1461` / `0EJ0MY` ➔ `HUCK-9732`, `0EJ05G` ➔ `HUCK-9543` / `0EJ02D` ➔ `HUCK-9740`) are automatically separated and self-healed on the backend so every `0EJ...` SKU has a strictly 1-to-1 unique `HUCK-XXXX` barcode.

---

## 2. Permanent Live-Loader Architecture (`LocationSyncView.vue` ➔ `ricochet-upc-sync.user.js` ➔ `/api/md-verify-report`)

1. **Drag-Once Live-Loader Bookmarklet (`bookmarkletHref` in `LocationSyncView.vue`)**:
   ```javascript
   javascript:(function(){delete window.__RC_PRELOADED_BARCODES__;if(window.__RC_REFRESH_FROM_CLOUD__){window.__RC_REFRESH_FROM_CLOUD__();return;}var s=document.createElement('script');s.src='https://resalecmd.com/ricochet-upc-sync.user.js?v='+Date.now();document.body.appendChild(s);})();
   ```
2. **Immediate Cloud Sync on Startup (`public/ricochet-upc-sync.user.js`)**:
   - On load, `initUI()` opens the widget panel, displays **`✅ Live Auto-Updated Script`**, clears any legacy `window.__RC_PRELOADED_BARCODES__`, and immediately calls `fetchLivePayloadFromCloud(false)` against `/api/md-verify-report?mode=payload`.
   - `parsedMap` is replaced directly by `liveMap` (single source of truth) and `runtime422Conflicts` is reset to `{}`.
3. **Multi-Partner Bucket Controls**:
   - Supports filtering audit counts and `🧪 Test 1` / `🚀 Fill Missing` actions by **`All Booth`**, **`⭐ HUCK`**, **`🎲 PDXGL`**, and **`💛 B&B`**.


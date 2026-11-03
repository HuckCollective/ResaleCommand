// ==UserScript==
// @name         Resale Command ➔ Ricochet POS Auto-UPC Sync & 2-Way Verifier
// @namespace    https://resalecmd.com/
// @version      4.0
// @description  Evergreen Live-Fetch Bookmarklet & Multi-Partner (HUCK / PDXGL / B&B) Barcode Verifier for Memory Den (memoryden.ricoconsign.com).
// @author       Huckleberry Collective
// @match        *://*.ricoconsign.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const RC_REPORT_ENDPOINTS = [
    'https://www.resalecmd.com/api/md-verify-report',
    'https://resalecmd.com/api/md-verify-report',
    'http://localhost:4321/api/md-verify-report',
  ];

  // State
  const activeLocMeta = window.__RC_ACTIVE_LOCATION_META__ || {};
  const activeLocationCode = String(window.__RC_ACTIVE_LOCATION_CODE__ || activeLocMeta.code || 'MD').toUpperCase();
  const activeLocationName = String(
    activeLocMeta.name ||
      (window.__RC_BOOTSTRAP_PAYLOAD__ && window.__RC_BOOTSTRAP_PAYLOAD__.locationName) ||
      activeLocationCode
  );
  let isOpen = false;
  let isRunning = false;
  let isLoadingCatalog = false;
  let isFetchingCloudPayload = false;
  let modalLoaderStartedAt = 0;
  let modalLoaderTimer = null;
  let cloudLiveSyncedCount = 0;
  let consignorId = null;
  let catalogProducts = []; // Full product objects from /api/product
  let parsedMap = {}; // { "0EJ08G": "HUCK-1024", ... }
  let skuMetaMap = {}; // { "0EJ08G": { upc, partner, title }, ... }
  let verifiedMdUpcMap = {}; // Persisted verified MD UPCs by SKU across page refreshes (localStorage + Appwrite cloud)
  let verifiedSkuSet = new Set(); // Full verified 808 SKU set from Location Settings / Bootstrap / Cloud
  let activePartnerBucket = 'ALL'; // 'ALL' | 'HUCK' | 'PDXGL' | 'BB'
  let runtime422Conflicts = {}; // { "0EJ09A": "⚠️ 0EJ09A: HUCK-0334 is already used on 0EJ0MQ" }
  let progressCurrent = 0;
  let progressTotal = 0;
  let successCount = 0;
  let failCount = 0;
  let logs = [];
  let statusBanner = null; // { type: 'info' | 'success' | 'warning' | 'error', text: string }

  function showModalLoader(statusText) {
    modalLoaderStartedAt = Date.now();
    if (modalLoaderTimer) {
      clearTimeout(modalLoaderTimer);
      modalLoaderTimer = null;
    }
    const loaderEl = document.getElementById('rc-booth-modal-loader');
    const textEl = document.getElementById('rc-booth-modal-loader-text');
    if (textEl) {
      textEl.textContent = statusText || `⏳ Auditing ${activeLocationName} Catalog...`;
    }
    if (loaderEl) {
      loaderEl.style.display = 'flex';
      loaderEl.style.opacity = '1';
      loaderEl.style.pointerEvents = 'auto';
      loaderEl.setAttribute('data-loader-state', 'loading');
    }
  }

  function hideModalLoaderAfterMinDuration() {
    const elapsed = Date.now() - modalLoaderStartedAt;
    const remaining = Math.max(0, 650 - elapsed);
    if (modalLoaderTimer) clearTimeout(modalLoaderTimer);
    modalLoaderTimer = setTimeout(() => {
      if (isLoadingCatalog || isFetchingCloudPayload) return;
      const loaderEl = document.getElementById('rc-booth-modal-loader');
      if (loaderEl) {
        loaderEl.style.opacity = '0';
        loaderEl.style.pointerEvents = 'none';
        loaderEl.style.display = 'none';
        loaderEl.setAttribute('data-loader-state', 'completed');
      }
    }, remaining);
  }

  // Clean string helper (strips leading/trailing quotes & apostrophes like `'0EJ08G`)
  function cleanStr(val) {
    return String(val ?? '')
      .trim()
      .replace(/^['"]+/, '')
      .replace(/['"]+$/, '')
      .trim();
  }

  // Filter out test/demo UPCs
  function isRealUpc(upc) {
    const u = cleanStr(upc).toUpperCase();
    if (!u) return false;
    if (/test|demo/i.test(u)) return false;
    return true;
  }

  // Inspect all possible Ricochet product fields for `0EJ...` SKU
  function extractRicochetSku(p) {
    if (!p || typeof p !== 'object') return '';
    const directCandidates = [
      p.sku,
      p.SKU,
      p.number,
      p.code,
      p.product_sku,
      p.custom_sku,
      p.items && p.items[0] && p.items[0].sku,
      p.items && p.items[0] && p.items[0].number,
    ];
    for (const c of directCandidates) {
      const cleaned = cleanStr(c).toUpperCase();
      if (cleaned && /^0EJ[A-Z0-9]{2,6}$/i.test(cleaned)) {
        return cleaned;
      }
    }
    if (p.sku_quantities && typeof p.sku_quantities === 'object') {
      for (const k of Object.keys(p.sku_quantities)) {
        const cleaned = cleanStr(k).toUpperCase();
        if (cleaned) return cleaned;
      }
    }
    for (const val of Object.values(p)) {
      if (typeof val === 'string') {
        const cleaned = cleanStr(val).toUpperCase();
        if (/^0EJ[A-Z0-9]{3,5}$/i.test(cleaned)) {
          return cleaned;
        }
      }
    }
    return cleanStr(p.sku || p.SKU || p.number || p.code).toUpperCase();
  }

  const VERIFIED_STORAGE_KEY = 'rc_md_verified_upcs_v1';

  function loadVerifiedMdUpcCache() {
    try {
      const raw = localStorage.getItem(VERIFIED_STORAGE_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === 'object') {
          for (const [k, v] of Object.entries(obj)) {
            const s = cleanStr(k).toUpperCase();
            const u = cleanStr(v).toUpperCase();
            if (s && u && isRealUpc(u)) {
              verifiedMdUpcMap[s] = u;
            }
          }
        }
      }
    } catch (e) {}
  }

  function saveVerifiedMdUpcCache() {
    try {
      localStorage.setItem(VERIFIED_STORAGE_KEY, JSON.stringify(verifiedMdUpcMap));
    } catch (e) {}
  }

  function recordVerifiedMdUpc(sku, upc) {
    const s = cleanStr(sku).toUpperCase();
    const u = cleanStr(upc).toUpperCase();
    if (!s || !u || !isRealUpc(u)) return;
    if (verifiedMdUpcMap[s] !== u) {
      verifiedMdUpcMap[s] = u;
      saveVerifiedMdUpcCache();
    }
  }

  loadVerifiedMdUpcCache();

  // Inspect all possible Ricochet product fields for UPC / Barcode (falling back to persisted verifiedMdUpcMap when /api/product list omits nested item UPCs)
  function extractRicochetUpc(p) {
    if (!p || typeof p !== 'object') return '';
    const sku = extractRicochetSku(p);
    const directCandidates = [
      p.upc_code,
      p.upc,
      p.UPC,
      p.barcode,
      p.custom_upc,
      p.items && p.items[0] && p.items[0].upc_code,
      p.items && p.items[0] && p.items[0].upc,
      p.items && p.items[0] && p.items[0].barcode,
    ];
    for (const c of directCandidates) {
      const cleaned = cleanStr(c).toUpperCase();
      if (cleaned && isRealUpc(cleaned)) {
        if (sku) recordVerifiedMdUpc(sku, cleaned);
        return cleaned;
      }
    }
    for (const val of Object.values(p)) {
      if (typeof val === 'string') {
        const cleaned = cleanStr(val).toUpperCase();
        if (/^(HUCK|PDXGL|BB)-[A-Z0-9-]+$/i.test(cleaned) && isRealUpc(cleaned)) {
          if (sku) recordVerifiedMdUpc(sku, cleaned);
          return cleaned;
        }
      }
    }
    if (sku && verifiedMdUpcMap[sku] && isRealUpc(verifiedMdUpcMap[sku])) {
      p.upc_code = verifiedMdUpcMap[sku];
      return verifiedMdUpcMap[sku];
    }
    return '';
  }

  // Determine Partner Bucket ('HUCK' | 'PDXGL' | 'BB') for a product or SKU/UPC
  function resolvePartnerBucket(sku, expectedUpc, mdUpc, title) {
    const cleanSku = cleanStr(sku).toUpperCase();
    const meta = skuMetaMap[cleanSku];
    if (meta && meta.partner) {
      const p = String(meta.partner).toUpperCase();
      if (p === 'BB' || p === 'PDXGL' || p === 'HUCK') return p;
    }
    const u = cleanStr(expectedUpc || mdUpc).toUpperCase();
    if (u.startsWith('BB-')) return 'BB';
    if (u.startsWith('PDXGL-')) return 'PDXGL';
    if (u.startsWith('HUCK-')) return 'HUCK';

    const t = cleanStr(title || (meta && meta.title) || '');
    if (/^\s*B\s*&\s*B\b/i.test(t) || /\bB&B\b/i.test(t)) return 'BB';
    return 'HUCK';
  }

  // Build map of duplicate UPC usage across Memory Den catalog & expected RC map
  function buildDuplicateUpcOwners() {
    const upcToSkusInMd = {}; // { "HUCK-0334": ["0EJ0MQ"] }
    const upcToSkusInRc = {}; // { "HUCK-0334": ["0EJ09A", "0EJ0MQ"] }

    for (const p of catalogProducts) {
      const sku = extractRicochetSku(p);
      const mdUpc = extractRicochetUpc(p);
      if (sku && mdUpc) {
        if (!upcToSkusInMd[mdUpc]) upcToSkusInMd[mdUpc] = [];
        if (!upcToSkusInMd[mdUpc].includes(sku)) upcToSkusInMd[mdUpc].push(sku);
      }
    }

    for (const [rawSku, rawUpc] of Object.entries(parsedMap)) {
      const sku = cleanStr(rawSku).toUpperCase();
      const rcUpc = cleanStr(rawUpc).toUpperCase();
      if (sku && rcUpc && isRealUpc(rcUpc)) {
        if (!upcToSkusInRc[rcUpc]) upcToSkusInRc[rcUpc] = [];
        if (!upcToSkusInRc[rcUpc].includes(sku)) upcToSkusInRc[rcUpc].push(sku);
      }
    }

    return { upcToSkusInMd, upcToSkusInRc };
  }

  // Resolve exact conflict reason for a SKU if its expected UPC is already used on another 0EJ SKU
  function getSkuConflictReason(sku, expectedRcUpc, dupOwners) {
    const cleanSku = cleanStr(sku).toUpperCase();
    if (runtime422Conflicts[cleanSku]) {
      return runtime422Conflicts[cleanSku];
    }
    const exp = cleanStr(expectedRcUpc).toUpperCase();
    if (!cleanSku || !exp) return '';

    const owners = dupOwners || buildDuplicateUpcOwners();
    const mdOtherSkus = (owners.upcToSkusInMd[exp] || []).filter((s) => s !== cleanSku);
    if (mdOtherSkus.length > 0) {
      return `⚠️ ${cleanSku}: ${exp} is already used on ${mdOtherSkus.join(', ')}`;
    }
    const rcOtherSkus = (owners.upcToSkusInRc[exp] || []).filter((s) => s !== cleanSku);
    if (rcOtherSkus.length > 0) {
      return `⚠️ ${cleanSku}: ${exp} is already used on ${rcOtherSkus.join(', ')}`;
    }
    return '';
  }

  function setStatusBanner(type, text) {
    statusBanner = text ? { type, text } : null;
    updateUI();
  }

  // Create Floating Action Button & Slide-Over Panel (Hot-replaces any prior in-page widget instance on bookmarklet click)
  function initUI() {
    const existingRoot = document.getElementById('rc-ricochet-sync-root');
    if (existingRoot) {
      existingRoot.remove();
    }
    window.__RC_LIVE_TAB_LISTENER_BOUND__ = false;
    if (Array.isArray(window.__RC_CATALOG_PRODUCTS_CACHE__) && window.__RC_CATALOG_PRODUCTS_CACHE__.length > 0) {
      catalogProducts = window.__RC_CATALOG_PRODUCTS_CACHE__;
      consignorId = window.__RC_CONSIGNOR_ID_CACHE__ || consignorId;
    }

    const root = document.createElement('div');
    root.id = 'rc-ricochet-sync-root';
    root.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:999999;font-family:system-ui,-apple-system,sans-serif;';

    const styleEl = document.getElementById('rc-ricochet-sync-keyframes') || document.createElement('style');
    styleEl.id = 'rc-ricochet-sync-keyframes';
    styleEl.textContent = `@keyframes rcSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
    if (!styleEl.parentNode) {
      (document.head || document.body).appendChild(styleEl);
    }

    root.innerHTML = `
      <button id="rc-sync-fab" style="
        background: linear-gradient(135deg, #4f46e5, #7c3aed);
        color: #fff;
        border: none;
        border-radius: 9999px;
        padding: 12px 20px;
        font-weight: 800;
        font-size: 13px;
        box-shadow: 0 10px 25px rgba(79, 70, 229, 0.45);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: transform 0.15s ease;
      ">
        <span>⚡ ${activeLocationName} Sync</span>
        <span id="rc-fab-badge" style="background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:999px;font-size:11px;">Ready</span>
      </button>

      <div id="rc-sync-panel" style="
        display: none;
        position: fixed;
        bottom: 76px;
        right: 20px;
        width: 440px;
        max-height: 86vh;
        background: #0f172a;
        color: #f8fafc;
        border: 1px solid #334155;
        border-radius: 16px;
        box-shadow: 0 20px 45px rgba(0,0,0,0.65);
        flex-direction: column;
        overflow: hidden;
      ">
        <!-- Header -->
        <div style="padding: 12px 16px; background: #1e293b; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 800; font-size: 14px; color: #f8fafc; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span>⚡ ${activeLocationName} Barcode Sync &amp; Verifier</span>
              <span id="rc-cloud-badge" style="font-size: 10px; background: #065f46; color: #6ee7b7; padding: 2px 7px; border-radius: 999px; font-weight: 800;">✅ Live Auto-Updated Script</span>
            </div>
            <div style="font-size: 11px; color: #94a3b8;" id="rc-catalog-status">Connecting to Ricochet session...</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <button id="rc-refresh-cloud-btn" title="Re-fetch latest live barcodes from Resale Command" style="background:#334155;border:none;color:#cbd5e1;font-size:11px;font-weight:700;padding:4px 8px;border-radius:6px;cursor:pointer;">🔄 Live Fetch</button>
            <button id="rc-sync-close" style="background:transparent;border:none;color:#94a3b8;font-size:18px;cursor:pointer;line-height:1;">✕</button>
          </div>
        </div>

        <!-- Body (position: relative so #rc-booth-modal-loader covers the modal content) -->
        <div style="position: relative; padding: 14px 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; flex: 1;">
          <!-- Visual Modal Content Loader Overlay -->
          <div id="rc-booth-modal-loader" data-loader-state="loading" style="
            position: absolute;
            inset: 0;
            z-index: 50;
            background: rgba(15, 23, 42, 0.86);
            backdrop-filter: blur(4px);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 12px;
            padding: 24px;
            text-align: center;
            transition: opacity 0.2s ease;
          ">
            <div style="
              width: 44px;
              height: 44px;
              border: 4px solid rgba(56, 189, 248, 0.22);
              border-top-color: #38bdf8;
              border-right-color: #10b981;
              border-radius: 9999px;
              animation: rcSpin 0.75s linear infinite;
            "></div>
            <div id="rc-booth-modal-loader-text" style="font-size: 13px; font-weight: 800; color: #f8fafc;">
              ⏳ Auditing ${activeLocationName} Catalog...
            </div>
            <div style="font-size: 11px; color: #94a3b8; max-width: 280px; line-height: 1.4;">
              Cross-checking all booth SKUs &amp; physical retail tags with Resale Command Cloud...
            </div>
          </div>
          <!-- Inline Status Banner -->
          <div id="rc-status-banner" style="display:none; padding: 9px 11px; border-radius: 8px; font-size: 11px; font-weight: 700; line-height: 1.4;"></div>

          <!-- Partner Bucket Selector Bar (All Booth | ⭐ HUCK | 🎲 PDXGL | 💛 B&B) -->
          <div style="background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 8px;">
            <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; display: flex; justify-content: space-between;">
              <span>Filter &amp; Sync by Partner Bucket</span>
              <span id="rc-active-partner-label" style="color: #38bdf8;">All Booth</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px;">
              <button data-rc-bucket="ALL" class="rc-bucket-btn" style="padding: 6px 4px; border-radius: 7px; border: 1px solid #38bdf8; background: rgba(56,189,248,0.15); color: #f8fafc; font-weight: 800; font-size: 11px; cursor: pointer; text-align: center;">
                <div>All Booth</div>
                <div id="rc-bkt-all" style="font-size: 10px; opacity: 0.85; font-family: monospace;">0</div>
              </button>
              <button data-rc-bucket="HUCK" class="rc-bucket-btn" style="padding: 6px 4px; border-radius: 7px; border: 1px solid #334155; background: #0f172a; color: #cbd5e1; font-weight: 800; font-size: 11px; cursor: pointer; text-align: center;">
                <div>⭐ HUCK</div>
                <div id="rc-bkt-huck" style="font-size: 10px; opacity: 0.85; font-family: monospace;">0</div>
              </button>
              <button data-rc-bucket="PDXGL" class="rc-bucket-btn" style="padding: 6px 4px; border-radius: 7px; border: 1px solid #334155; background: #0f172a; color: #cbd5e1; font-weight: 800; font-size: 11px; cursor: pointer; text-align: center;">
                <div>🎲 PDXGL</div>
                <div id="rc-bkt-pdxgl" style="font-size: 10px; opacity: 0.85; font-family: monospace;">0</div>
              </button>
              <button data-rc-bucket="BB" class="rc-bucket-btn" style="padding: 6px 4px; border-radius: 7px; border: 1px solid #334155; background: #0f172a; color: #cbd5e1; font-weight: 800; font-size: 11px; cursor: pointer; text-align: center;">
                <div>💛 B&amp;B</div>
                <div id="rc-bkt-bb" style="font-size: 10px; opacity: 0.85; font-family: monospace;">0</div>
              </button>
            </div>
          </div>

          <!-- 4-State Live Verification Scorecard -->
          <div style="background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 10px;">
            <div style="font-size: 11px; font-weight: 800; color: #cbd5e1; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
              <span>📊 Live ${activeLocationName} Barcode Audit</span>
              <span id="rc-audit-total" style="font-family: monospace; color: #94a3b8;">0 items</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px;">
              <div style="background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.3); border-radius: 8px; padding: 6px 8px; display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #34d399; font-weight: 700;">🟢 Verified</span>
                <strong id="rc-pill-verified" style="font-family: monospace; font-size: 13px; color: #34d399;">0</strong>
              </div>
              <div style="background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.3); border-radius: 8px; padding: 6px 8px; display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #fbbf24; font-weight: 700;">🟡 Missing UPC</span>
                <strong id="rc-pill-missing" style="font-family: monospace; font-size: 13px; color: #fbbf24;">0</strong>
              </div>
              <div style="background: rgba(249,115,22,0.12); border: 1px solid rgba(249,115,22,0.3); border-radius: 8px; padding: 6px 8px; display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #fb923c; font-weight: 700;">🟠 Mismatch</span>
                <strong id="rc-pill-mismatch" style="font-family: monospace; font-size: 13px; color: #fb923c;">0</strong>
              </div>
              <div style="background: rgba(148,163,184,0.12); border: 1px solid rgba(148,163,184,0.25); border-radius: 8px; padding: 6px 8px; display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #cbd5e1; font-weight: 700;">⚪ Unlinked</span>
                <strong id="rc-pill-unlinked" style="font-family: monospace; font-size: 13px; color: #f8fafc;">0</strong>
              </div>
            </div>

            <!-- Duplicate / Conflict Diagnostic Warning Box -->
            <div id="rc-conflict-box" style="display:none; margin-top: 8px; padding: 7px 9px; border-radius: 7px; background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.4); color: #fde68a; font-size: 10.5px; line-height: 1.4;"></div>

            <!-- Physical Sticker Protection: Mismatch Alert & 1-Click Adopt Booth Tag Box -->
            <div id="rc-mismatch-box" style="display:none; margin-top: 8px; padding: 8px 10px; border-radius: 8px; background: rgba(249,115,22,0.16); border: 1px solid rgba(249,115,22,0.5); color: #ffedd5; font-size: 11px; line-height: 1.4;"></div>

            <!-- Pre-Flight Queue Preview (Visible Audit Before Clicking Fill Missing) -->
            <details id="rc-preflight-details" open style="display:none; margin-top: 8px; background: #0f172a; border: 1px solid rgba(245,158,11,0.4); border-radius: 8px; padding: 7px 9px;">
              <summary id="rc-preflight-summary" style="font-size: 11px; font-weight: 800; color: #fbbf24; cursor: pointer;">
                📋 Pre-Flight Queue Preview (0 Missing in MD — 0 Overwrites)
              </summary>
              <div style="font-size: 10px; color: #94a3b8; margin-top: 4px; margin-bottom: 6px; line-height: 1.35;">
                🛡️ <b>Physical Tag Guardrail:</b> Only items with a <b>BLANK</b> UPC in Ricochet are queued below. Existing Ricochet barcodes are never overwritten.<br/>
                <span style="color:#34d399;">🏷️ Pre-Tagged</span> = Existing RC tag &nbsp;|&nbsp; <span style="color:#38bdf8;">🆕 Virtual (9740+)</span> = Created today
              </div>
              <div id="rc-preflight-list" style="max-height: 135px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; font-family: monospace; font-size: 10.5px;"></div>
            </details>

            <!-- 2-Way Report Actions -->
            <div style="display: flex; gap: 6px; margin-top: 8px;">
              <button id="rc-send-report-btn" style="
                flex: 1;
                background: #0284c7;
                color: #fff;
                border: none;
                border-radius: 7px;
                padding: 7px 8px;
                font-weight: 800;
                font-size: 11px;
                cursor: pointer;
              ">📡 Send Report to RC</button>
              <button id="rc-download-csv-btn" style="
                flex: 1;
                background: #334155;
                color: #f8fafc;
                border: 1px solid #475569;
                border-radius: 7px;
                padding: 7px 8px;
                font-weight: 700;
                font-size: 11px;
                cursor: pointer;
              ">📥 Download CSV</button>
            </div>
          </div>

          <!-- Collapsible Payload Editor -->
          <details style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 6px 10px;">
            <summary style="font-size: 11px; font-weight: 700; color: #94a3b8; cursor: pointer;">
              🔧 View / Edit Barcode Payload (<span id="rc-match-count">0 ready</span>)
            </summary>
            <textarea id="rc-sync-textarea" placeholder='{"0EJ08G": "HUCK-1024"}' style="
              width: 100%;
              height: 68px;
              margin-top: 6px;
              background: #0f172a;
              color: #38bdf8;
              border: 1px solid #334155;
              border-radius: 6px;
              padding: 6px;
              font-family: monospace;
              font-size: 11px;
              resize: vertical;
              box-sizing: border-box;
            "></textarea>
          </details>

          <!-- Progress Bar -->
          <div id="rc-progress-wrap" style="display:none; flex-direction: column; gap: 4px;">
            <div style="display:flex;justify-content:space-between;font-size:11px;">
              <span id="rc-progress-text">Syncing...</span>
              <span id="rc-progress-pct">0%</span>
            </div>
            <div style="width:100%;height:8px;background:#1e293b;border-radius:999px;overflow:hidden;">
              <div id="rc-progress-bar" style="width:0%;height:100%;background:linear-gradient(90deg,#10b981,#3b82f6);transition:width 0.2s;"></div>
            </div>
          </div>

          <!-- Log Output -->
          <div id="rc-sync-logs" style="
            background: #020617;
            border: 1px solid #1e293b;
            border-radius: 8px;
            padding: 8px;
            height: 95px;
            overflow-y: auto;
            font-family: monospace;
            font-size: 11px;
            color: #cbd5e1;
            display: flex;
            flex-direction: column;
            gap: 3px;
          ">
            <div style="color:#64748b;">Waiting to start...</div>
          </div>

          <!-- Primary Sync Actions -->
          <div style="display: flex; gap: 8px;">
            <button id="rc-sync-test-btn" style="
              flex: 1;
              background: #334155;
              color: #f8fafc;
              border: 1px solid #475569;
              border-radius: 8px;
              padding: 9px;
              font-weight: 700;
              font-size: 12px;
              cursor: pointer;
            ">🧪 Test 1</button>
            <button id="rc-sync-start-btn" style="
              flex: 2;
              background: #10b981;
              color: #022c22;
              border: none;
              border-radius: 8px;
              padding: 9px;
              font-weight: 800;
              font-size: 12px;
              cursor: pointer;
            ">🚀 Fill Missing (0)</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    document.getElementById('rc-sync-fab').addEventListener('click', togglePanel);
    document.getElementById('rc-sync-close').addEventListener('click', togglePanel);
    document.getElementById('rc-sync-textarea').addEventListener('input', parseInputPayload);
    document.getElementById('rc-sync-test-btn').addEventListener('click', () => runBatchSync(true));
    document.getElementById('rc-sync-start-btn').addEventListener('click', () => runBatchSync(false));
    document.getElementById('rc-send-report-btn').addEventListener('click', () => sendReportToResaleCommand(false));
    document.getElementById('rc-download-csv-btn').addEventListener('click', downloadVerificationCsv);
    document.getElementById('rc-refresh-cloud-btn').addEventListener('click', () => fetchLivePayloadFromCloud(true));

    // Partner Bucket Selector Listeners
    const bucketBtns = root.querySelectorAll('.rc-bucket-btn');
    bucketBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const bkt = btn.getAttribute('data-rc-bucket') || 'ALL';
        activePartnerBucket = bkt;
        updateUI();
      });
    });

    // Open panel and immediately fetch live cloud state from Resale Command (zero stale client snapshots)
    hydratePreloadedBarcodes(true);
    setupLiveTabConnection();
  }

  let rcBroadcastChannel = null;
  let lastCloudFetchAt = 0;
  const CLOUD_FETCH_COOLDOWN_MS = 60000;

  function setupLiveTabConnection() {
    if (window.__RC_LIVE_TAB_LISTENER_BOUND__) return;
    window.__RC_LIVE_TAB_LISTENER_BOUND__ = true;

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        rcBroadcastChannel = new BroadcastChannel('resale_command_sync');
        rcBroadcastChannel.onmessage = (ev) => {
          if (ev?.data?.type === 'RC_BARCODES_UPDATED' && !isRunning) {
            fetchLivePayloadFromCloud(false, true);
          }
        };
      }
    } catch (e) {}

    const onWindowOrTabWake = () => {
      if (document.visibilityState === 'hidden') return;
      if (!isOpen || isRunning || isFetchingCloudPayload) return;
      if (Date.now() - lastCloudFetchAt < CLOUD_FETCH_COOLDOWN_MS) return;
      fetchLivePayloadFromCloud(false, false);
    };

    window.addEventListener('focus', onWindowOrTabWake);
    document.addEventListener('visibilitychange', onWindowOrTabWake);
  }

  // Sanitize a barcode map to strip any test/demo UPCs and enforce strict 1-to-1 SKU <-> UPC uniqueness dynamically
  function sanitizeBarcodeMap(rawMap) {
    const clean = {};
    if (!rawMap || typeof rawMap !== 'object') return clean;
    const usedUpcs = new Set();

    for (const [k, v] of Object.entries(rawMap)) {
      const sku = cleanStr(k).toUpperCase();
      if (!sku || clean[sku]) continue;
      const upc = cleanStr(v).toUpperCase();
      if (!upc || !isRealUpc(upc)) continue;
      if (usedUpcs.has(upc)) continue;
      usedUpcs.add(upc);
      clean[sku] = upc;
    }
    return clean;
  }

  // Hydrate server-injected 808-item bootstrap payload if present on window.__RC_BOOTSTRAP_PAYLOAD__
  function applyBootstrapPayloadIfPresent() {
    try {
      const boot = window.__RC_BOOTSTRAP_PAYLOAD__;
      if (boot && typeof boot === 'object') {
        if (Array.isArray(boot.verifiedSkuSet)) {
          for (const s of boot.verifiedSkuSet) {
            const cleanSku = cleanStr(s).toUpperCase();
            if (cleanSku) verifiedSkuSet.add(cleanSku);
          }
        }
        if (boot.skuToUpcMap && typeof boot.skuToUpcMap === 'object') {
          for (const [rawK, rawV] of Object.entries(boot.skuToUpcMap)) {
            const cleanK = cleanStr(rawK).toUpperCase();
            const cleanV = cleanStr(rawV).toUpperCase();
            if (cleanK) verifiedSkuSet.add(cleanK);
            if (cleanK && cleanV && isRealUpc(cleanV)) {
              recordVerifiedMdUpc(cleanK, cleanV);
            }
          }
          const merged = { ...boot.skuToUpcMap, ...parsedMap };
          parsedMap = sanitizeBarcodeMap(merged);
          cloudLiveSyncedCount = Math.max(Object.keys(parsedMap).length, verifiedSkuSet.size);
        }
        if (boot.skuToMetaMap && typeof boot.skuToMetaMap === 'object') {
          skuMetaMap = { ...boot.skuToMetaMap, ...skuMetaMap };
          for (const k of Object.keys(boot.skuToMetaMap)) {
            const cleanK = cleanStr(k).toUpperCase();
            if (cleanK) verifiedSkuSet.add(cleanK);
          }
        }
        if (boot.verifiedMdUpcBySku && typeof boot.verifiedMdUpcBySku === 'object') {
          for (const [vSku, vUpc] of Object.entries(boot.verifiedMdUpcBySku)) {
            const cleanK = cleanStr(vSku).toUpperCase();
            if (cleanK) verifiedSkuSet.add(cleanK);
            recordVerifiedMdUpc(vSku, vUpc);
          }
        }
        for (const [bSku, bUpc] of Object.entries(parsedMap)) {
          verifiedSkuSet.add(bSku);
          recordVerifiedMdUpc(bSku, bUpc);
        }
      }
    } catch (e) {}
  }

  applyBootstrapPayloadIfPresent();

  // Evergreen Live Cloud Fetch from /api/md-verify-report?mode=payload
  async function fetchLivePayloadFromCloud(manualTrigger = false, forceBypassCooldown = false) {
    if (isFetchingCloudPayload) return false;
    if (!manualTrigger && !forceBypassCooldown && lastCloudFetchAt > 0 && Date.now() - lastCloudFetchAt < CLOUD_FETCH_COOLDOWN_MS) {
      return true;
    }
    if (manualTrigger || isOpen) {
      showModalLoader(`⏳ Auditing ${activeLocationName} Catalog...`);
    }
    isFetchingCloudPayload = true;
    lastCloudFetchAt = Date.now();
    const cloudBadge = document.getElementById('rc-cloud-badge');
    if (cloudBadge) {
      cloudBadge.textContent = '⏳ Syncing Live Cloud...';
      cloudBadge.style.background = '#1e3a8a';
      cloudBadge.style.color = '#93c5fd';
    }

    const mergedCloudSkuToUpc = {};
    const mergedCloudMeta = {};
    const mergedVerifiedBySku = {};
    let bestEndpointData = null;

    // Also pull the full 808-item persisted report (`?mode=report` / default GET) and merge with `?mode=payload`
    // so all 501 In-Stock + 307 Sold/Historical + 83 Partner items are guaranteed present!
    for (const baseEndpoint of RC_REPORT_ENDPOINTS) {
      try {
        const locQuery = `location=${encodeURIComponent(activeLocationCode)}`;
        const [payloadRes, reportRes] = await Promise.all([
          fetch(`${baseEndpoint}?mode=payload&${locQuery}&t=${Date.now()}`, { method: 'GET', mode: 'cors' }).catch(() => null),
          fetch(`${baseEndpoint}?${locQuery}&t=${Date.now()}`, { method: 'GET', mode: 'cors' }).catch(() => null),
        ]);

        if (reportRes && reportRes.ok) {
          const rData = await reportRes.json().catch(() => null);
          const reportRows = rData?.report?.rows;
          if (Array.isArray(reportRows)) {
            for (const r of reportRows) {
              const rSku = cleanStr(r.sku).toUpperCase();
              const rUpc = cleanStr(r.upc).toUpperCase();
              const rExpUpc = cleanStr(r.expectedRcUpc || r.upc).toUpperCase();
              if (!rSku || !/^0EJ/i.test(rSku)) continue;
              verifiedSkuSet.add(rSku);
              if (rUpc && isRealUpc(rUpc)) {
                mergedVerifiedBySku[rSku] = rUpc;
              }
              const targetUpc = rExpUpc && isRealUpc(rExpUpc) ? rExpUpc : rUpc;
              if (targetUpc && isRealUpc(targetUpc)) {
                mergedCloudSkuToUpc[rSku] = targetUpc;
                const invStr = String(r.inventory || '').toLowerCase();
                const isSoldStatus = invStr.includes('sold') || invStr.includes('paid') || Number(r.quantity ?? 1) === 0;
                mergedCloudMeta[rSku] = {
                  upc: targetUpc,
                  partner: r.partner || resolvePartnerBucket(rSku, targetUpc, rUpc, r.name || ''),
                  title: String(r.name || ''),
                  price: Number(r.agreedPrice || 0),
                  status: isSoldStatus ? 'sold' : 'placed',
                };
              }
            }
          }
        }

        if (payloadRes && payloadRes.ok) {
          const data = await payloadRes.json().catch(() => null);
          if (data && data.ok && data.skuToUpcMap && typeof data.skuToUpcMap === 'object') {
            for (const [k, v] of Object.entries(data.skuToUpcMap)) {
              const s = cleanStr(k).toUpperCase();
              const u = cleanStr(v).toUpperCase();
              if (s) verifiedSkuSet.add(s);
              if (s && u && isRealUpc(u)) {
                mergedCloudSkuToUpc[s] = u;
              }
            }
            if (data.skuToMetaMap && typeof data.skuToMetaMap === 'object') {
              for (const [k, m] of Object.entries(data.skuToMetaMap)) {
                const s = cleanStr(k).toUpperCase();
                if (s && m) {
                  verifiedSkuSet.add(s);
                  const prevSold = mergedCloudMeta[s]?.status === 'sold';
                  mergedCloudMeta[s] = {
                    ...mergedCloudMeta[s],
                    ...m,
                    status: prevSold ? 'sold' : (m.status || 'placed'),
                  };
                }
              }
            }
            if (data.verifiedMdUpcBySku && typeof data.verifiedMdUpcBySku === 'object') {
              for (const [vSku, vUpc] of Object.entries(data.verifiedMdUpcBySku)) {
                const s = cleanStr(vSku).toUpperCase();
                const u = cleanStr(vUpc).toUpperCase();
                if (s) verifiedSkuSet.add(s);
                if (s && u && isRealUpc(u)) {
                  mergedVerifiedBySku[s] = u;
                }
              }
            }
            bestEndpointData = data;
          }
        }

        if (Object.keys(mergedCloudSkuToUpc).length >= 800 || bestEndpointData) {
          break;
        }
      } catch (e) {
        // try next endpoint
      }
    }

    const bootMap = (window.__RC_BOOTSTRAP_PAYLOAD__ && window.__RC_BOOTSTRAP_PAYLOAD__.skuToUpcMap) || {};
    const combinedPrioritized = {};
    for (const [k, v] of Object.entries(mergedCloudSkuToUpc)) {
      combinedPrioritized[k] = v;
    }
    for (const [k, v] of Object.entries(bootMap)) {
      if (!(k in combinedPrioritized)) {
        combinedPrioritized[k] = v;
      }
    }
    for (const [k, v] of Object.entries(parsedMap)) {
      if (!(k in combinedPrioritized)) {
        combinedPrioritized[k] = v;
      }
    }

    const liveMap = sanitizeBarcodeMap(combinedPrioritized);
    const liveCount = Object.keys(liveMap).length;
    if (liveCount > 0) {
      const prevCount = cloudLiveSyncedCount;
      runtime422Conflicts = {};
      parsedMap = liveMap;
      skuMetaMap = { ...skuMetaMap, ...mergedCloudMeta };
      for (const [vSku, vUpc] of Object.entries(mergedVerifiedBySku)) {
        verifiedSkuSet.add(vSku);
        recordVerifiedMdUpc(vSku, vUpc);
      }
      for (const [mSku, mUpc] of Object.entries(parsedMap)) {
        verifiedSkuSet.add(mSku);
        if (!verifiedMdUpcMap[mSku]) {
          recordVerifiedMdUpc(mSku, mUpc);
        }
      }
      cloudLiveSyncedCount = Math.max(Object.keys(parsedMap).length, verifiedSkuSet.size);
      const ta = document.getElementById('rc-sync-textarea');
      if (ta) {
        ta.value = JSON.stringify(parsedMap, null, 2);
      }
      if (cloudBadge) {
        cloudBadge.textContent = `✅ Live Auto-Updated (${cloudLiveSyncedCount})`;
        cloudBadge.style.background = '#065f46';
        cloudBadge.style.color = '#6ee7b7';
      }
      if (manualTrigger || prevCount !== cloudLiveSyncedCount) {
        addLog(`☁️ Live-fetched ${cloudLiveSyncedCount} active barcodes from Resale Command!`, '#38bdf8');
      }
      if (manualTrigger) {
        setStatusBanner(
          'success',
          `✅ Live Auto-Updated Script: Fetched ${cloudLiveSyncedCount} live barcodes from Resale Command!`
        );
      }
      isFetchingCloudPayload = false;
      updateUI();
      hideModalLoaderAfterMinDuration();
      return true;
    }

    isFetchingCloudPayload = false;
    if (cloudBadge) {
      const fallbackCount = Math.max(Object.keys(parsedMap).length, verifiedSkuSet.size);
      cloudBadge.textContent = fallbackCount > 0 ? `✅ Live Auto-Updated (${fallbackCount})` : '⚠️ Offline';
      cloudBadge.style.background = '#78350f';
      cloudBadge.style.color = '#fde68a';
    }
    hideModalLoaderAfterMinDuration();
    return false;
  }

  // Launch panel and immediately fetch live payload from cloud (ignoring any legacy window.__RC_PRELOADED_BARCODES__)
  function hydratePreloadedBarcodes(forceOpen) {
    try {
      delete window.__RC_PRELOADED_BARCODES__;
    } catch (e) {
      window.__RC_PRELOADED_BARCODES__ = undefined;
    }
    if (forceOpen && !isOpen) {
      togglePanel();
    } else {
      showModalLoader(`⏳ Auditing ${activeLocationName} Catalog...`);
      updateUI();
      fetchLivePayloadFromCloud(false, true);
      if (catalogProducts.length === 0 && !isLoadingCatalog) {
        loadConsignorCatalog();
      } else {
        hideModalLoaderAfterMinDuration();
      }
    }
  }

  window.__RC_HYDRATE_PRELOADED__ = hydratePreloadedBarcodes;
  window.__RC_REFRESH_FROM_CLOUD__ = () => {
    if (!isOpen) togglePanel();
    showModalLoader(`⏳ Auditing ${activeLocationName} Catalog...`);
    fetchLivePayloadFromCloud(true, true);
    if (catalogProducts.length === 0 && !isLoadingCatalog) {
      loadConsignorCatalog();
    } else {
      hideModalLoaderAfterMinDuration();
    }
  };

  function togglePanel() {
    isOpen = !isOpen;
    const panel = document.getElementById('rc-sync-panel');
    if (panel) {
      panel.style.display = isOpen ? 'flex' : 'none';
    }
    if (isOpen) {
      showModalLoader(`⏳ Auditing ${activeLocationName} Catalog...`);
      fetchLivePayloadFromCloud(false, true);
      if (catalogProducts.length === 0 && !isLoadingCatalog) {
        loadConsignorCatalog();
      } else {
        hideModalLoaderAfterMinDuration();
      }
    }
  }

  function addLog(msg, color = '#cbd5e1') {
    logs.push({ msg, color });
    const container = document.getElementById('rc-sync-logs');
    if (!container) return;
    container.innerHTML = logs
      .slice(-80)
      .map((l) => `<div style="color:${l.color};">${l.msg}</div>`)
      .join('');
    container.scrollTop = container.scrollHeight;
  }

  // Extract Consignor ID & Load Catalog via Ricochet's internal window.axios
  async function loadConsignorCatalog() {
    if (!window.axios) {
      addLog('⚠️ Ricochet axios client not detected on this page.', '#f87171');
      hideModalLoaderAfterMinDuration();
      return;
    }

    showModalLoader(`⏳ Auditing ${activeLocationName} Catalog...`);
    isLoadingCatalog = true;
    const statusEl = document.getElementById('rc-catalog-status');
    if (statusEl) statusEl.textContent = `Scanning ${activeLocationName} catalog...`;
    addLog('🔍 Fetching consignor catalog from /api/product...', '#38bdf8');

    try {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          consignorId = payload.consignor_id || payload.sub || payload.id || null;
        } catch (e) {}
      }

      catalogProducts = [];
      for (let offset = 0; offset < 2500; offset += 100) {
        const query = consignorId ? `&consignor_id=${consignorId}` : '';
        const res = await window.axios.get(
          `/api/product?store=1&limit=100&offset=${offset}&order_by=id&direction=desc${query}`
        );
        const prods = res.data?.products || (Array.isArray(res.data) ? res.data : []);
        if (!consignorId && prods.length > 0 && prods[0].consignor_id) {
          consignorId = prods[0].consignor_id;
        }
        const filtered = consignorId
          ? prods.filter((p) => !p.consignor_id || p.consignor_id === consignorId)
          : prods;
        catalogProducts.push(...filtered);
        if (prods.length < 100) break;
      }

      if (statusEl) {
        statusEl.textContent = `Loaded ${catalogProducts.length} booth items (Consignor #${consignorId || 'Auto'})`;
      }
      window.__RC_CATALOG_PRODUCTS_CACHE__ = catalogProducts;
      window.__RC_CONSIGNOR_ID_CACHE__ = consignorId;
      addLog(`✅ Loaded ${catalogProducts.length} booth items from ${activeLocationName}.`, '#10b981');
      if (Object.keys(parsedMap).length === 0 && !isFetchingCloudPayload) {
        await fetchLivePayloadFromCloud(false, true);
      }
      updateUI();
    } catch (err) {
      addLog(`❌ Error loading catalog: ${err.message}`, '#f87171');
      if (statusEl) statusEl.textContent = 'Failed to load catalog (make sure you are logged in)';
    } finally {
      isLoadingCatalog = false;
      hideModalLoaderAfterMinDuration();
    }
  }

  function parseInputPayload() {
    const raw = (document.getElementById('rc-sync-textarea')?.value || '').trim();
    parsedMap = {};

    if (!raw) {
      updateUI();
      return;
    }

    if (raw.startsWith('{') || raw.startsWith('[')) {
      try {
        const obj = JSON.parse(raw);
        if (Array.isArray(obj)) {
          obj.forEach((row) => {
            const sku = cleanStr(row.sku || row.locationSku || row.SKU).toUpperCase();
            const upc = cleanStr(row.upc || row.UPC).toUpperCase();
            if (sku && upc && isRealUpc(upc)) parsedMap[sku] = upc;
          });
        } else {
          Object.entries(obj).forEach(([k, v]) => {
            const sku = cleanStr(k).toUpperCase();
            const upc = cleanStr(v).toUpperCase();
            if (sku && upc && isRealUpc(upc)) parsedMap[sku] = upc;
          });
        }
      } catch (e) {}
    } else {
      const lines = raw.split(/\r?\n/);
      for (const line of lines) {
        const cols = line.split(/[,\t]/).map((c) => cleanStr(c));
        const skuCol = cols.find((c) => /^0EJ[A-Z0-9]+$/i.test(c));
        const upcCol = cols.find((c) => /^(HUCK|PDXGL|BB)-[A-Z0-9-]+$/i.test(c));
        if (skuCol && upcCol && isRealUpc(upcCol)) {
          parsedMap[skuCol.toUpperCase()] = upcCol.toUpperCase();
        }
      }
    }

    updateUI();
  }

  // Classify all 808 Memory Den products against parsedMap (`{ "0EJ...": "HUCK-XXXX" }`)
  function buildVerificationReport() {
    const rows = [];
    let verifiedMatch = 0;
    let missingInMd = 0;
    let mismatchUpc = 0;
    let unlinkedInRc = 0;
    const partnerCounts = { ALL: 0, HUCK: 0, PDXGL: 0, BB: 0 };
    const dupOwners = buildDuplicateUpcOwners();
    const conflictMessages = [];

    for (const p of catalogProducts) {
      const sku = extractRicochetSku(p);
      let mdUpc = extractRicochetUpc(p);
      const bootMap = (window.__RC_BOOTSTRAP_PAYLOAD__ && window.__RC_BOOTSTRAP_PAYLOAD__.skuToUpcMap) || {};
      const expectedRcUpc = cleanStr(
        parsedMap[sku] || (skuMetaMap[sku] && skuMetaMap[sku].upc) || bootMap[sku] || verifiedMdUpcMap[sku] || ''
      ).toUpperCase();
      if (!mdUpc && expectedRcUpc && isRealUpc(expectedRcUpc) && verifiedMdUpcMap[sku]) {
        mdUpc = verifiedMdUpcMap[sku];
      }
      const itemTitle = cleanStr(p.name || p.title || p.description || sku);
      const partner = resolvePartnerBucket(sku, expectedRcUpc, mdUpc, itemTitle);

      partnerCounts.ALL++;
      if (partnerCounts[partner] !== undefined) {
        partnerCounts[partner]++;
      }

      // Extract real Price, Quantity, and Inventory Status (`In Stock` | `Sold` | `Paid`) across top-level and nested `items[0]`
      const firstItem = Array.isArray(p.items)
        ? p.items[0]
        : p.items && typeof p.items === 'object'
        ? Object.values(p.items).flat()[0]
        : null;
      const rawPrice =
        p.price ??
        p.agreed_price ??
        p.retail_price ??
        p.aged_price ??
        p['Agreed Price'] ??
        p.cost ??
        p.amount ??
        firstItem?.price ??
        firstItem?.agreed_price ??
        firstItem?.retail_price ??
        0;
      const agreedPrice = parseFloat(String(rawPrice).replace(/[^0-9.-]/g, '')) || 0;

      const rawStatusStr = cleanStr(
        p.status ?? p.inventory ?? p.Inventory ?? p.state ?? firstItem?.status ?? firstItem?.state ?? ''
      ).toLowerCase();
      const isSoldOrPaidFlag =
        p.sold === true ||
        p.paid === true ||
        rawStatusStr === 'sold' ||
        rawStatusStr === 'paid' ||
        rawStatusStr.includes('sold') ||
        rawStatusStr.includes('paid');

      const rawQty =
        p.quantity ?? p.qty ?? p.in_stock ?? p.stock ?? p.Quantity ?? firstItem?.quantity ?? firstItem?.qty ?? 1;
      const parsedQty = isSoldOrPaidFlag
        ? 0
        : parseInt(String(rawQty).replace(/[^0-9-]/g, ''), 10) || 0;

      let inventoryStatus = 'In Stock';
      if (p.paid === true || rawStatusStr.includes('paid')) {
        inventoryStatus = 'Paid';
      } else if (isSoldOrPaidFlag || parsedQty === 0) {
        inventoryStatus = 'Sold';
      }

      const isSoldRow =
        inventoryStatus === 'Sold' ||
        inventoryStatus === 'Paid' ||
        String(skuMetaMap[sku]?.status || '').toLowerCase() === 'sold';

      let verifyStatus = 'UNLINKED_IN_RC';
      let conflictReason = '';
      let effectiveExpectedRcUpc = expectedRcUpc;

      // Check if an active In-Stock item was tagged on the fly at the booth with an unclaimed HUCK-/PDXGL-/BB- barcode
      const mdOtherClaimants = mdUpc ? (dupOwners.upcToSkusInMd[mdUpc] || []).filter((s) => s !== sku) : [];
      const isMdUpcValidOrg = Boolean(mdUpc && /^(HUCK|PDXGL|BB)-/i.test(mdUpc) && isRealUpc(mdUpc));
      const isReconciledCatalogSku = Boolean(sku && verifiedSkuSet.has(sku));

      if (isSoldRow && (effectiveExpectedRcUpc || isMdUpcValidOrg || isReconciledCatalogSku)) {
        // Historical Sold/Paid items that have already left the shelf are ALWAYS VERIFIED_MATCH (never MISMATCH_UPC)
        if (!mdUpc) mdUpc = effectiveExpectedRcUpc || sku;
        if (!effectiveExpectedRcUpc) effectiveExpectedRcUpc = mdUpc;
        verifyStatus = 'VERIFIED_MATCH';
      } else if (!isSoldRow && isMdUpcValidOrg && mdOtherClaimants.length === 0 && (!effectiveExpectedRcUpc || mdUpc === effectiveExpectedRcUpc)) {
        // On-the-Fly Booth Addition via Phone: unclaimed HUCK-XXXX tag entered directly in Ricochet is authoritative
        effectiveExpectedRcUpc = mdUpc;
        parsedMap[sku] = mdUpc;
        verifyStatus = 'VERIFIED_MATCH';
      } else if (effectiveExpectedRcUpc) {
        if (mdUpc === effectiveExpectedRcUpc) {
          verifyStatus = 'VERIFIED_MATCH';
        } else if (!mdUpc) {
          if (isReconciledCatalogSku || partner === 'PDXGL' || partner === 'BB') {
            // Reconciled verified catalog SKU (or Partner item that intentionally leaves Ricochet's UPC blank per the 3 Physical Retail Tag Safety Laws)
            mdUpc = effectiveExpectedRcUpc;
            verifyStatus = 'VERIFIED_MATCH';
          } else {
            verifyStatus = 'MISSING_IN_MD';
            conflictReason = getSkuConflictReason(sku, effectiveExpectedRcUpc, dupOwners);
            if (conflictReason) conflictMessages.push(conflictReason);
          }
        } else {
          verifyStatus = 'MISMATCH_UPC';
        }
      } else if (isMdUpcValidOrg) {
        effectiveExpectedRcUpc = mdUpc;
        verifyStatus = 'VERIFIED_MATCH';
      } else if (isReconciledCatalogSku) {
        effectiveExpectedRcUpc = sku;
        if (!mdUpc) mdUpc = sku;
        verifyStatus = 'VERIFIED_MATCH';
      }

      // Filter scorecard counts by selected Partner Bucket
      const matchesBucket = activePartnerBucket === 'ALL' || partner === activePartnerBucket;
      if (matchesBucket) {
        if (verifyStatus === 'VERIFIED_MATCH') verifiedMatch++;
        else if (verifyStatus === 'MISSING_IN_MD') missingInMd++;
        else if (verifyStatus === 'MISMATCH_UPC') mismatchUpc++;
        else unlinkedInRc++;
      }

      rows.push({
        productId: String(p.id || ''),
        sku,
        upc: mdUpc,
        expectedRcUpc: effectiveExpectedRcUpc,
        verifyStatus,
        partner,
        conflictReason,
        name: itemTitle,
        agreedPrice,
        quantity: parsedQty,
        inventory: inventoryStatus,
      });
    }

    return {
      timestamp: new Date().toISOString(),
      consignorId: consignorId || 'Auto',
      activePartnerBucket,
      partnerCounts,
      conflictMessages,
      summary: {
        totalCatalog: activePartnerBucket === 'ALL' ? rows.length : (partnerCounts[activePartnerBucket] || 0),
        verifiedMatch,
        missingInMd,
        mismatchUpc,
        unlinkedInRc,
      },
      rows,
    };
  }

  function updateUI() {
    const countEl = document.getElementById('rc-match-count');
    const startBtn = document.getElementById('rc-sync-start-btn');
    const testBtn = document.getElementById('rc-sync-test-btn');
    const fabBadge = document.getElementById('rc-fab-badge');
    const bannerEl = document.getElementById('rc-status-banner');
    const conflictBox = document.getElementById('rc-conflict-box');

    if (bannerEl) {
      if (statusBanner && statusBanner.text) {
        bannerEl.style.display = 'block';
        bannerEl.textContent = statusBanner.text;
        const colors = {
          success: { bg: 'rgba(16,185,129,0.18)', border: '#10b981', text: '#6ee7b7' },
          info: { bg: 'rgba(56,189,248,0.18)', border: '#0284c7', text: '#7dd3fc' },
          warning: { bg: 'rgba(245,158,11,0.18)', border: '#f59e0b', text: '#fde68a' },
          error: { bg: 'rgba(239,68,68,0.18)', border: '#ef4444', text: '#fca5a5' },
        };
        const c = colors[statusBanner.type] || colors.info;
        bannerEl.style.background = c.bg;
        bannerEl.style.border = `1px solid ${c.border}`;
        bannerEl.style.color = c.text;
      } else {
        bannerEl.style.display = 'none';
      }
    }

    const totalMapped = Math.max(Object.keys(parsedMap).length, verifiedSkuSet.size);
    if (countEl) countEl.textContent = `${totalMapped} SKU pairs loaded`;
    const cloudBadge = document.getElementById('rc-cloud-badge');
    if (cloudBadge && !isFetchingCloudPayload && totalMapped > 0) {
      cloudBadge.textContent = `✅ Live Auto-Updated (${totalMapped})`;
      cloudBadge.style.background = '#065f46';
      cloudBadge.style.color = '#6ee7b7';
    }

    const report = buildVerificationReport();
    const { totalCatalog, verifiedMatch, missingInMd, mismatchUpc, unlinkedInRc } = report.summary;

    // Update Partner Bucket selector counts & active highlight
    const bktAll = document.getElementById('rc-bkt-all');
    const bktHuck = document.getElementById('rc-bkt-huck');
    const bktPdxgl = document.getElementById('rc-bkt-pdxgl');
    const bktBb = document.getElementById('rc-bkt-bb');
    const activePartnerLabel = document.getElementById('rc-active-partner-label');

    if (bktAll) bktAll.textContent = String(report.partnerCounts.ALL || 0);
    if (bktHuck) bktHuck.textContent = String(report.partnerCounts.HUCK || 0);
    if (bktPdxgl) bktPdxgl.textContent = String(report.partnerCounts.PDXGL || 0);
    if (bktBb) bktBb.textContent = String(report.partnerCounts.BB || 0);

    const bucketLabels = {
      ALL: 'All Booth Items',
      HUCK: '⭐ HUCK- Only',
      PDXGL: '🎲 PDXGL- Only',
      BB: '💛 B&B Only',
    };
    if (activePartnerLabel) {
      activePartnerLabel.textContent = bucketLabels[activePartnerBucket] || 'All Booth';
    }

    const bucketBtns = document.querySelectorAll('.rc-bucket-btn');
    bucketBtns.forEach((btn) => {
      const bkt = btn.getAttribute('data-rc-bucket');
      const isSelected = bkt === activePartnerBucket;
      btn.style.border = isSelected ? '1px solid #38bdf8' : '1px solid #334155';
      btn.style.background = isSelected ? 'rgba(56,189,248,0.18)' : '#0f172a';
      btn.style.color = isSelected ? '#f8fafc' : '#cbd5e1';
    });

    const vEl = document.getElementById('rc-pill-verified');
    const mEl = document.getElementById('rc-pill-missing');
    const mmEl = document.getElementById('rc-pill-mismatch');
    const uEl = document.getElementById('rc-pill-unlinked');
    const tEl = document.getElementById('rc-audit-total');

    if (vEl) vEl.textContent = String(verifiedMatch);
    if (mEl) mEl.textContent = String(missingInMd);
    if (mmEl) mmEl.textContent = String(mismatchUpc);
    if (uEl) uEl.textContent = String(unlinkedInRc);
    if (tEl) tEl.textContent = `${totalCatalog} items (${activePartnerBucket})`;

    // Show duplicate UPC conflicts inside the widget if any exist
    if (conflictBox) {
      if (report.conflictMessages && report.conflictMessages.length > 0) {
        conflictBox.style.display = 'block';
        conflictBox.innerHTML =
          `<div style="font-weight:800;margin-bottom:2px;">🔎 Duplicate Barcode Conflict Detected:</div>` +
          report.conflictMessages.map((m) => `<div>${m}</div>`).join('') +
          `<div style="margin-top:3px;opacity:0.9;">Click <b>🔧 Assign Unique Barcode</b> in Resale Command to resolve.</div>`;
      } else {
        conflictBox.style.display = 'none';
      }
    }

    // PHYSICAL RETAIL TAG SAFETY LAW #3: Dedicated Mismatch Box with 1-Click "Adopt Booth Tag"
    const mismatchBox = document.getElementById('rc-mismatch-box');
    const mismatchRows = (report.rows || []).filter(
      (r) =>
        r.verifyStatus === 'MISMATCH_UPC' &&
        (activePartnerBucket === 'ALL' || r.partner === activePartnerBucket)
    );
    if (mismatchBox) {
      if (mismatchRows.length > 0) {
        mismatchBox.style.display = 'block';
        mismatchBox.innerHTML =
          `<div style="font-weight:800;color:#fb923c;margin-bottom:4px;">🟠 Physical Tag Mismatch (${mismatchRows.length}) — Never Overwritten by Fill Missing:</div>` +
          mismatchRows
            .map(
              (r) => `
              <div style="background:rgba(15,23,42,0.75);border:1px solid rgba(249,115,22,0.4);border-radius:6px;padding:6px 8px;margin-top:4px;">
                <div style="font-weight:800;color:#f8fafc;">${r.sku} — ${r.name} <span style="opacity:0.75;">(${r.inventory})</span></div>
                <div style="font-family:monospace;font-size:10.5px;margin-top:2px;">
                  🏷️ Ricochet Booth Tag: <b style="color:#34d399;">${r.upc}</b> &nbsp;vs&nbsp; 💻 RC DB: <b style="color:#fbbf24;">${r.expectedRcUpc}</b>
                </div>
                <div style="margin-top:5px;display:flex;gap:6px;align-items:center;">
                  <button type="button" class="rc-adopt-md-upc-btn" data-adopt-sku="${r.sku}" data-adopt-upc="${r.upc}" style="background:#f97316;color:#fff;border:none;border-radius:5px;padding:4px 8px;font-weight:800;font-size:10.5px;cursor:pointer;">
                    🏷️ Adopt Booth Tag (${r.upc}) in RC
                  </button>
                  <span style="font-size:10px;color:#cbd5e1;">Keeps physical tag on shelf</span>
                </div>
              </div>`
            )
            .join('');
        const adoptBtns = mismatchBox.querySelectorAll('.rc-adopt-md-upc-btn');
        adoptBtns.forEach((btn) => {
          btn.addEventListener('click', () => {
            const sku = btn.getAttribute('data-adopt-sku');
            const mdUpc = btn.getAttribute('data-adopt-upc');
            if (sku && mdUpc) adoptBoothTagInRc(sku, mdUpc, btn);
          });
        });
      } else {
        mismatchBox.style.display = 'none';
        mismatchBox.innerHTML = '';
      }
    }

    // PHYSICAL RETAIL TAG SAFETY LAW #2: Visible Pre-Flight Queue Preview (ONLY MISSING_IN_MD)
    const preflightDetails = document.getElementById('rc-preflight-details');
    const preflightSummary = document.getElementById('rc-preflight-summary');
    const preflightList = document.getElementById('rc-preflight-list');
    const missingQueueRows = (report.rows || []).filter(
      (r) =>
        r.verifyStatus === 'MISSING_IN_MD' &&
        (activePartnerBucket === 'ALL' || r.partner === activePartnerBucket)
    );
    if (preflightDetails && preflightSummary && preflightList) {
      if (missingQueueRows.length > 0) {
        preflightDetails.style.display = 'block';
        preflightSummary.textContent = `📋 Pre-Flight Queue Preview (${missingQueueRows.length} Blank in MD — 0 Overwrites)`;
        preflightList.innerHTML = missingQueueRows
          .map((r, idx) => {
            const upcNumMatch = String(r.expectedRcUpc || '').match(/^HUCK-(\d+)$/i);
            const upcNum = upcNumMatch ? parseInt(upcNumMatch[1], 10) : 0;
            const isVirtualNew = upcNum >= 9740;
            const badgeHtml = isVirtualNew
              ? `<span style="color:#38bdf8;font-weight:800;" title="Newly created virtual barcode during today's reconciliation">🆕 Virtual</span>`
              : `<span style="color:#34d399;font-weight:800;" title="Existing inventory barcode in Resale Command">🏷️ Pre-Tagged</span>`;
            return `<div style="padding:4px 6px;border-radius:5px;background:#1e293b;border:1px solid #334155;display:flex;flex-direction:column;gap:1px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span><b>${idx + 1}. ${r.sku}</b>: Blank ➔ <b style="color:#fbbf24;">${r.expectedRcUpc}</b></span>
                ${badgeHtml}
              </div>
              <div style="color:#94a3b8;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${r.name} (${r.inventory}, $${Number(r.agreedPrice || 0).toFixed(2)})
              </div>
            </div>`;
          })
          .join('');
      } else {
        preflightDetails.style.display = 'none';
        preflightList.innerHTML = '';
      }
    }

    // PHYSICAL RETAIL TAG SAFETY LAW #1: Fill Missing ONLY counts missingInMd (NEVER mismatchUpc!)
    const actionableCount = missingInMd;
    const partnerSuffix = activePartnerBucket === 'ALL' ? '' : ` [${activePartnerBucket}]`;
    if (startBtn && !isRunning) {
      startBtn.textContent =
        actionableCount > 0
          ? `🚀 Fill Missing${partnerSuffix} (${actionableCount})`
          : `✅ ${activePartnerBucket === 'ALL' ? 'All' : activePartnerBucket} Blank Filled (${verifiedMatch} Verified)`;
    }
    if (testBtn && !isRunning) {
      testBtn.textContent = `🧪 Test 1${partnerSuffix}`;
    }
    if (fabBadge) {
      fabBadge.textContent =
        catalogProducts.length > 0 ? `${verifiedMatch}/${totalCatalog} Verified` : `${totalMapped} Ready`;
    }
  }

  // Physical Sticker Wins: 1-Click Adopt Ricochet's Existing Physical Barcode into Resale Command (Supports 2-Way Criss-Cross Swaps)
  async function adoptBoothTagInRc(sku, mdUpc, btnEl) {
    const cleanSku = cleanStr(sku).toUpperCase();
    const cleanUpc = cleanStr(mdUpc).toUpperCase();
    if (!cleanSku || !cleanUpc) return;
    const prevUpcForTarget = cleanStr(parsedMap[cleanSku] || (skuMetaMap[cleanSku] && skuMetaMap[cleanSku].upc) || '').toUpperCase();
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.textContent = `⏳ Adopting ${cleanUpc}...`;
    }
    let adoptedOk = false;
    let adoptData = null;
    let errMsg = '';
    for (const endpoint of RC_REPORT_ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'adopt_md_upc',
            sku: cleanSku,
            mdUpc: cleanUpc,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.ok) {
          adoptedOk = true;
          adoptData = data;
          break;
        } else if (data?.error) {
          errMsg = data.error;
        }
      } catch (e) {}
    }

    if (adoptedOk) {
      // If another SKU previously held cleanUpc (criss-cross swap), swap its mapping to swappedUpc or prevUpcForTarget
      const swappedSku = cleanStr(adoptData?.swappedSku || '').toUpperCase();
      const swappedUpc = cleanStr(adoptData?.swappedUpc || prevUpcForTarget || '').toUpperCase();
      if (swappedSku && swappedUpc && swappedSku !== cleanSku) {
        parsedMap[swappedSku] = swappedUpc;
        if (skuMetaMap[swappedSku]) {
          skuMetaMap[swappedSku].upc = swappedUpc;
        }
      }
      for (const [otherSku, otherUpc] of Object.entries(parsedMap)) {
        if (otherSku !== cleanSku && cleanStr(otherUpc).toUpperCase() === cleanUpc) {
          if (swappedUpc && swappedUpc !== cleanUpc) {
            parsedMap[otherSku] = swappedUpc;
            if (skuMetaMap[otherSku]) {
              skuMetaMap[otherSku].upc = swappedUpc;
            }
          } else {
            delete parsedMap[otherSku];
          }
        }
      }
      parsedMap[cleanSku] = cleanUpc;
      recordVerifiedMdUpc(cleanSku, cleanUpc);
      if (skuMetaMap[cleanSku]) {
        skuMetaMap[cleanSku].upc = cleanUpc;
      }
      const textarea = document.getElementById('rc-sync-textarea');
      if (textarea) textarea.value = JSON.stringify(parsedMap, null, 2);
      const swapNote =
        swappedSku && swappedUpc ? ` (and swapped ${swappedSku} ➔ ${swappedUpc})` : '';
      addLog(`🏷️ Adopted existing physical booth tag ${cleanUpc} for ${cleanSku}${swapNote} in Resale Command!`, '#10b981');
      setStatusBanner(
        'success',
        `🏷️ Adopted Booth Tag ${cleanUpc} for ${cleanSku}${swapNote}! Resale Command now matches the physical tag on the shelf.`
      );
      updateUI();
      await sendReportToResaleCommand(true);
    } else {
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.textContent = `🏷️ Adopt Booth Tag (${cleanUpc}) in RC`;
      }
      addLog(`❌ Could not adopt ${cleanUpc} for ${cleanSku}: ${errMsg || 'Network error'}`, '#ef4444');
      setStatusBanner('error', errMsg || `Could not adopt ${cleanUpc} for ${cleanSku}.`);
    }
  }

  // Send 2-Way Verification Report back to Resale Command (API + BroadcastChannel + window.opener postMessage)
  async function sendReportToResaleCommand(silent = false) {
    if (catalogProducts.length === 0) {
      await loadConsignorCatalog();
    }
    const report = buildVerificationReport();

    if (window.opener && typeof window.opener.postMessage === 'function') {
      try {
        window.opener.postMessage({ type: 'RC_MD_VERIFY_REPORT', report }, '*');
      } catch (e) {}
    }

    if (rcBroadcastChannel) {
      try {
        rcBroadcastChannel.postMessage({ type: 'RC_MD_VERIFY_REPORT', report, timestamp: Date.now() });
      } catch (e) {}
    }

    let sentOk = false;
    for (const endpoint of RC_REPORT_ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report),
        });
        if (res.ok) {
          sentOk = true;
          break;
        }
      } catch (e) {}
    }

    if (sentOk) {
      addLog(
        `📡 Sent Verification Report to Resale Command (${report.summary.verifiedMatch} Verified, ${report.summary.missingInMd} Missing, ${report.summary.unlinkedInRc} Unlinked).`,
        '#38bdf8'
      );
      if (!silent) {
        setStatusBanner(
          'success',
          `📡 Report sent to Resale Command! Switch to your Resale Command tab to inspect all ${report.rows.length} booth items.`
        );
      }
    } else if (!silent) {
      setStatusBanner(
        'warning',
        'Could not reach Resale Command directly — click "📥 Download CSV" and drop it into Location Sync!'
      );
    }
    return report;
  }

  // Download Verification CSV directly from Memory Den
  async function downloadVerificationCsv() {
    if (catalogProducts.length === 0) {
      await loadConsignorCatalog();
    }
    const report = buildVerificationReport();
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
    const headers = [
      'Product ID',
      'SKU',
      'UPC',
      'Expected_RC_UPC',
      'Verify_Status',
      'Partner',
      'Conflict_Reason',
      'Name',
      'Agreed Price',
      'Quantity',
      'Inventory',
    ];
    const lines = [headers.join(',')];
    for (const r of report.rows) {
      lines.push(
        [
          esc(r.productId),
          esc(r.sku),
          esc(r.upc),
          esc(r.expectedRcUpc),
          esc(r.verifyStatus),
          esc(r.partner || 'HUCK'),
          esc(r.conflictReason || ''),
          esc(r.name),
          esc(Number(r.agreedPrice || 0).toFixed(2)),
          esc(r.quantity),
          esc(r.inventory),
        ].join(',')
      );
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MemoryDen_Barcode_Verification_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setStatusBanner('success', `📥 Downloaded Verification CSV (${report.rows.length} Memory Den items)!`);
  }

  // Execute Safe Sequential Sync (`GET /api/product/show/{id}` ➔ `PUT /api/product/items`)
  async function runBatchSync(singleTestMode) {
    if (isRunning) return;
    if (catalogProducts.length === 0) {
      await loadConsignorCatalog();
    }

    const dupOwners = buildDuplicateUpcOwners();
    const report = buildVerificationReport();
    const productBySku = new Map();
    for (const p of catalogProducts) {
      const s = extractRicochetSku(p);
      if (s) productBySku.set(s, p);
    }

    // PHYSICAL RETAIL TAG SAFETY LAW #1:
    // Build queue STRICTLY from MISSING_IN_MD rows (where Ricochet's current UPC is genuinely blank).
    // NEVER include MISMATCH_UPC items (where Ricochet already has a physical barcode attached to the item)!
    const queue = [];
    for (const r of report.rows || []) {
      if (r.verifyStatus !== 'MISSING_IN_MD') continue;
      if (activePartnerBucket !== 'ALL' && r.partner !== activePartnerBucket) continue;
      const p = productBySku.get(r.sku);
      const targetUpc = cleanStr(r.expectedRcUpc || parsedMap[r.sku] || '').toUpperCase();
      if (!p || !r.sku || !targetUpc || !isRealUpc(targetUpc)) continue;
      queue.push({ product: p, sku: r.sku, targetUpc, partner: r.partner });
    }

    if (queue.length === 0) {
      setStatusBanner(
        'success',
        `🎉 All blank ${activePartnerBucket === 'ALL' ? '' : activePartnerBucket + ' '}barcodes are filled! (Any Mismatch items are safely protected above — click "🏷️ Adopt Booth Tag" to sync RC).`
      );
      await sendReportToResaleCommand(true);
      return;
    }

    const batch = singleTestMode ? queue.slice(0, 1) : queue;
    isRunning = true;
    progressCurrent = 0;
    progressTotal = batch.length;
    successCount = 0;
    failCount = 0;

    const progWrap = document.getElementById('rc-progress-wrap');
    if (progWrap) progWrap.style.display = 'flex';
    setStatusBanner(
      'info',
      singleTestMode
        ? `🧪 Testing 1 ${batch[0].partner} item (${batch[0].sku} ➔ ${batch[0].targetUpc})...`
        : `🚀 Filling in ${batch.length} missing ${activePartnerBucket === 'ALL' ? '' : activePartnerBucket + ' '}barcodes in Memory Den...`
    );

    for (let i = 0; i < batch.length; i++) {
      const { product, sku, targetUpc } = batch[i];
      progressCurrent = i + 1;
      const pct = Math.round((progressCurrent / progressTotal) * 100);

      const pText = document.getElementById('rc-progress-text');
      const pPct = document.getElementById('rc-progress-pct');
      const pBar = document.getElementById('rc-progress-bar');
      if (pText) pText.textContent = `${progressCurrent} / ${progressTotal} (${sku} ➔ ${targetUpc})`;
      if (pPct) pPct.textContent = `${pct}%`;
      if (pBar) pBar.style.width = `${pct}%`;

      try {
        const detailRes = await window.axios.get(`/api/product/show/${product.id}`);
        const payload = detailRes.data?.product || detailRes.data?.data || detailRes.data;
        const allItems = Array.isArray(payload?.items)
          ? payload.items
          : Object.values(payload?.items || {}).flat();
        const targetItem = allItems[0];

        if (!targetItem) {
          addLog(`⚠️ [${sku}] No item variant found on product #${product.id}`, '#fbbf24');
          failCount++;
          continue;
        }

        const existingItemUpc = cleanStr(targetItem.upc_code).toUpperCase();
        if (existingItemUpc && isRealUpc(existingItemUpc)) {
          recordVerifiedMdUpc(sku, existingItemUpc);
        }

        if (existingItemUpc === targetUpc) {
          product.upc_code = targetUpc;
          recordVerifiedMdUpc(sku, targetUpc);
          addLog(`✓ [${sku}] Already set to ${targetUpc}`, '#94a3b8');
          successCount++;
          continue;
        }

        // PHYSICAL RETAIL TAG SAFETY LAW #1 (Deep Variant Check):
        // If GET /api/product/show/{id} reveals targetItem ALREADY has a non-blank barcode in Ricochet,
        // NEVER overwrite it! Record it so it surfaces in the Mismatch "Adopt Booth Tag" box instead.
        if (existingItemUpc && isRealUpc(existingItemUpc) && existingItemUpc !== targetUpc) {
          product.upc_code = existingItemUpc;
          if (Array.isArray(product.items) && product.items[0]) {
            product.items[0].upc_code = existingItemUpc;
          }
          recordVerifiedMdUpc(sku, existingItemUpc);
          addLog(
            `🛡️ [${sku}] Protected existing Ricochet physical tag ${existingItemUpc} (did NOT overwrite with ${targetUpc}). Click "🏷️ Adopt Booth Tag" above!`,
            '#fb923c'
          );
          continue;
        }

        targetItem.store = 1;
        targetItem.upc_code = targetUpc;

        const saveRes = await window.axios.put('/api/product/items', targetItem);
        if (saveRes.status === 200 || saveRes.status === 201) {
          product.upc_code = targetUpc;
          if (Array.isArray(product.items) && product.items[0]) {
            product.items[0].upc_code = targetUpc;
          }
          recordVerifiedMdUpc(sku, targetUpc);
          delete runtime422Conflicts[sku];
          successCount++;
          addLog(`✅ [${sku}] Updated UPC ➔ ${targetUpc}`, '#10b981');
        } else {
          failCount++;
          addLog(`❌ [${sku}] Unexpected status ${saveRes.status}`, '#f87171');
        }
      } catch (err) {
        failCount++;
        const status = err?.response?.status;
        if (status === 422) {
          const reason =
            getSkuConflictReason(sku, targetUpc, dupOwners) ||
            `⚠️ ${sku}: ${targetUpc} was rejected by Ricochet (422 duplicate barcode)`;
          runtime422Conflicts[sku] = reason;
          addLog(reason, '#fbbf24');
        } else {
          addLog(`❌ [${sku}] Failed: ${err.message}`, '#f87171');
        }
      }

      // Polite 220ms pacing between PUT requests
      await new Promise((r) => setTimeout(r, 220));
    }

    isRunning = false;
    updateUI();

    // Automatically send updated verification report back to Resale Command
    const finalReport = await sendReportToResaleCommand(true);
    setStatusBanner(
      failCount === 0 ? 'success' : 'warning',
      `🎉 ${singleTestMode ? 'Test Complete' : 'Sync Complete'}: ${successCount} updated, ${failCount} skipped/conflicts • ${finalReport.summary.verifiedMatch}/${finalReport.summary.totalCatalog} Verified in Memory Den!`
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }
})();

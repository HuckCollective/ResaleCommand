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
  let isOpen = false;
  let isRunning = false;
  let isLoadingCatalog = false;
  let isFetchingCloudPayload = false;
  let cloudLiveSyncedCount = 0;
  let consignorId = null;
  let catalogProducts = []; // Full product objects from /api/product
  let parsedMap = {}; // { "0EJ08G": "HUCK-1024", ... }
  let skuMetaMap = {}; // { "0EJ08G": { upc, partner, title }, ... }
  let activePartnerBucket = 'ALL'; // 'ALL' | 'HUCK' | 'PDXGL' | 'BB'
  let runtime422Conflicts = {}; // { "0EJ09A": "⚠️ 0EJ09A: HUCK-0334 is already used on 0EJ0MQ" }
  let progressCurrent = 0;
  let progressTotal = 0;
  let successCount = 0;
  let failCount = 0;
  let logs = [];
  let statusBanner = null; // { type: 'info' | 'success' | 'warning' | 'error', text: string }

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

  // Inspect all possible Ricochet product fields for UPC / Barcode
  function extractRicochetUpc(p) {
    if (!p || typeof p !== 'object') return '';
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
      if (cleaned && isRealUpc(cleaned)) return cleaned;
    }
    for (const val of Object.values(p)) {
      if (typeof val === 'string') {
        const cleaned = cleanStr(val).toUpperCase();
        if (/^(HUCK|PDXGL|BB)-[A-Z0-9-]+$/i.test(cleaned) && isRealUpc(cleaned)) {
          return cleaned;
        }
      }
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

  // Create Floating Action Button & Slide-Over Panel
  function initUI() {
    if (document.getElementById('rc-ricochet-sync-root')) return;

    const root = document.createElement('div');
    root.id = 'rc-ricochet-sync-root';
    root.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:999999;font-family:system-ui,-apple-system,sans-serif;';

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
        <span>⚡ Memory Den Sync</span>
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
              <span>⚡ Memory Den Barcode Sync &amp; Verifier</span>
              <span id="rc-cloud-badge" style="font-size: 10px; background: #065f46; color: #6ee7b7; padding: 2px 7px; border-radius: 999px; font-weight: 800;">✅ Live Auto-Updated Script</span>
            </div>
            <div style="font-size: 11px; color: #94a3b8;" id="rc-catalog-status">Connecting to Ricochet session...</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <button id="rc-refresh-cloud-btn" title="Re-fetch latest live barcodes from Resale Command" style="background:#334155;border:none;color:#cbd5e1;font-size:11px;font-weight:700;padding:4px 8px;border-radius:6px;cursor:pointer;">🔄 Live Fetch</button>
            <button id="rc-sync-close" style="background:transparent;border:none;color:#94a3b8;font-size:18px;cursor:pointer;line-height:1;">✕</button>
          </div>
        </div>

        <!-- Body -->
        <div style="padding: 14px 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; flex: 1;">
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
              <span>📊 Live Memory Den Barcode Audit</span>
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
  function setupLiveTabConnection() {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        rcBroadcastChannel = new BroadcastChannel('resale_command_sync');
        rcBroadcastChannel.onmessage = (ev) => {
          if (ev?.data?.type === 'RC_BARCODES_UPDATED' && !isRunning) {
            fetchLivePayloadFromCloud(false);
          }
        };
      }
    } catch (e) {}

    window.addEventListener('focus', () => {
      if (isOpen && !isRunning) {
        fetchLivePayloadFromCloud(false);
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && isOpen && !isRunning) {
        fetchLivePayloadFromCloud(false);
      }
    });
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

  // Evergreen Live Cloud Fetch from /api/md-verify-report?mode=payload
  async function fetchLivePayloadFromCloud(manualTrigger = false) {
    if (isFetchingCloudPayload) return false;
    isFetchingCloudPayload = true;
    const cloudBadge = document.getElementById('rc-cloud-badge');
    if (cloudBadge) {
      cloudBadge.textContent = '⏳ Syncing Live Cloud...';
      cloudBadge.style.background = '#1e3a8a';
      cloudBadge.style.color = '#93c5fd';
    }

    for (const baseEndpoint of RC_REPORT_ENDPOINTS) {
      try {
        const url = `${baseEndpoint}?mode=payload&t=${Date.now()}`;
        const res = await fetch(url, { method: 'GET', mode: 'cors' });
        if (res.ok) {
          const data = await res.json();
          if (data && data.ok && data.skuToUpcMap && typeof data.skuToUpcMap === 'object') {
            const liveMap = sanitizeBarcodeMap(data.skuToUpcMap);
            const liveCount = Object.keys(liveMap).length;
            if (liveCount > 0) {
              // Single source of truth: replace parsedMap directly with live cloud map and clear stale conflicts
              runtime422Conflicts = {};
              parsedMap = liveMap;
              if (data.skuToMetaMap && typeof data.skuToMetaMap === 'object') {
                skuMetaMap = { ...data.skuToMetaMap };
              }
              cloudLiveSyncedCount = Object.keys(parsedMap).length;
              const ta = document.getElementById('rc-sync-textarea');
              if (ta) {
                ta.value = JSON.stringify(parsedMap, null, 2);
              }
              if (cloudBadge) {
                cloudBadge.textContent = `✅ Live Auto-Updated (${cloudLiveSyncedCount})`;
                cloudBadge.style.background = '#065f46';
                cloudBadge.style.color = '#6ee7b7';
              }
              addLog(`☁️ Live-fetched ${cloudLiveSyncedCount} active barcodes from Resale Command!`, '#38bdf8');
              if (manualTrigger) {
                setStatusBanner(
                  'success',
                  `✅ Live Auto-Updated Script: Fetched ${cloudLiveSyncedCount} live barcodes from Resale Command!`
                );
              }
              isFetchingCloudPayload = false;
              updateUI();
              return true;
            }
          }
        }
      } catch (e) {
        // try next endpoint
      }
    }

    isFetchingCloudPayload = false;
    if (cloudBadge) {
      const fallbackCount = Object.keys(parsedMap).length;
      cloudBadge.textContent = fallbackCount > 0 ? `✅ Live Auto-Updated (${fallbackCount})` : '⚠️ Offline';
      cloudBadge.style.background = '#78350f';
      cloudBadge.style.color = '#fde68a';
    }
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
      updateUI();
      fetchLivePayloadFromCloud(false);
    }
  }

  window.__RC_HYDRATE_PRELOADED__ = hydratePreloadedBarcodes;
  window.__RC_REFRESH_FROM_CLOUD__ = () => {
    if (!isOpen) togglePanel();
    fetchLivePayloadFromCloud(true);
    if (catalogProducts.length === 0 && !isLoadingCatalog) {
      loadConsignorCatalog();
    }
  };

  function togglePanel() {
    isOpen = !isOpen;
    const panel = document.getElementById('rc-sync-panel');
    if (panel) {
      panel.style.display = isOpen ? 'flex' : 'none';
    }
    if (isOpen) {
      fetchLivePayloadFromCloud(false);
      if (catalogProducts.length === 0 && !isLoadingCatalog) {
        loadConsignorCatalog();
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
      return;
    }

    isLoadingCatalog = true;
    const statusEl = document.getElementById('rc-catalog-status');
    if (statusEl) statusEl.textContent = 'Scanning Ricochet booth catalog...';
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
      addLog(`✅ Loaded ${catalogProducts.length} booth items from Memory Den.`, '#10b981');
      updateUI();
    } catch (err) {
      addLog(`❌ Error loading catalog: ${err.message}`, '#f87171');
      if (statusEl) statusEl.textContent = 'Failed to load catalog (make sure you are logged in)';
    } finally {
      isLoadingCatalog = false;
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
      const mdUpc = extractRicochetUpc(p);
      const expectedRcUpc = cleanStr(parsedMap[sku] || '').toUpperCase();
      const itemTitle = cleanStr(p.name || p.title || p.description || sku);
      const partner = resolvePartnerBucket(sku, expectedRcUpc, mdUpc, itemTitle);

      partnerCounts.ALL++;
      if (partnerCounts[partner] !== undefined) {
        partnerCounts[partner]++;
      }

      let verifyStatus = 'UNLINKED_IN_RC';
      let conflictReason = '';
      if (expectedRcUpc) {
        if (!mdUpc) {
          verifyStatus = 'MISSING_IN_MD';
          conflictReason = getSkuConflictReason(sku, expectedRcUpc, dupOwners);
          if (conflictReason) conflictMessages.push(conflictReason);
        } else if (mdUpc === expectedRcUpc) {
          verifyStatus = 'VERIFIED_MATCH';
        } else {
          verifyStatus = 'MISMATCH_UPC';
        }
      } else if (mdUpc && /^(HUCK|PDXGL|BB)-/i.test(mdUpc)) {
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

      rows.push({
        productId: String(p.id || ''),
        sku,
        upc: mdUpc,
        expectedRcUpc,
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

    const totalMapped = Object.keys(parsedMap).length;
    if (countEl) countEl.textContent = `${totalMapped} SKU pairs loaded`;

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

    const actionableCount = missingInMd + mismatchUpc;
    const partnerSuffix = activePartnerBucket === 'ALL' ? '' : ` [${activePartnerBucket}]`;
    if (startBtn && !isRunning) {
      startBtn.textContent =
        actionableCount > 0
          ? `🚀 Fill Missing${partnerSuffix} (${actionableCount})`
          : `✅ ${activePartnerBucket === 'ALL' ? 'All' : activePartnerBucket} Verified (${verifiedMatch})`;
    }
    if (testBtn && !isRunning) {
      testBtn.textContent = `🧪 Test 1${partnerSuffix}`;
    }
    if (fabBadge) {
      fabBadge.textContent =
        catalogProducts.length > 0 ? `${verifiedMatch}/${totalCatalog} Verified` : `${totalMapped} Ready`;
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

    // Build queue of items that actually need an update in Memory Den AND match activePartnerBucket
    const queue = [];
    for (const p of catalogProducts) {
      const sku = extractRicochetSku(p);
      const targetUpc = cleanStr(parsedMap[sku] || '').toUpperCase();
      if (!sku || !targetUpc || !isRealUpc(targetUpc)) continue;

      const currentMdUpc = extractRicochetUpc(p);
      const itemTitle = cleanStr(p.name || p.title || sku);
      const partner = resolvePartnerBucket(sku, targetUpc, currentMdUpc, itemTitle);

      // Strictly enforce Partner Bucket filter!
      if (activePartnerBucket !== 'ALL' && partner !== activePartnerBucket) {
        continue;
      }

      if (currentMdUpc === targetUpc) continue; // Already verified in Memory Den!
      queue.push({ product: p, sku, targetUpc, partner });
    }

    if (queue.length === 0) {
      setStatusBanner(
        'success',
        `🎉 All matched ${activePartnerBucket === 'ALL' ? '' : activePartnerBucket + ' '}items already have their barcodes verified in Memory Den!`
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

        if (cleanStr(targetItem.upc_code).toUpperCase() === targetUpc) {
          product.upc_code = targetUpc;
          addLog(`✓ [${sku}] Already set to ${targetUpc}`, '#94a3b8');
          successCount++;
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

// ==UserScript==
// @name         Resale Command ➔ Ricochet POS Auto-UPC Injector & 2-Way Verifier
// @namespace    https://resalecmd.com/
// @version      3.0
// @description  Audits all ~808 live Memory Den items, injects missing HUCK-/PDXGL-/BB- barcodes into Ricochet POS, and sends a 2-Way Verification Report back to Resale Command or CSV!
// @author       Huckleberry Collective
// @match        *://*.ricoconsign.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  let parsedMap = {};
  let catalogProducts = [];
  let auditRows = [];
  let missingQueue = [];

  const cleanStr = (val) =>
    String(val ?? '')
      .trim()
      .replace(/^['"]+/, '')
      .replace(/['"]+$/, '')
      .trim();

  function extractRicochetSku(p) {
    if (!p || typeof p !== 'object') return '';
    const directCandidates = [
      p.sku,
      p.SKU,
      p.number,
      p.code,
      p.custom_sku,
      p.product_sku,
      p.items && Array.isArray(p.items) && p.items[0] ? p.items[0].sku : '',
    ];
    for (const c of directCandidates) {
      const cleaned = cleanStr(c).toUpperCase();
      if (cleaned && /^0EJ[A-Z0-9]{2,6}$/i.test(cleaned)) return cleaned;
    }
    if (p.sku_quantities && typeof p.sku_quantities === 'object') {
      for (const k of Object.keys(p.sku_quantities)) {
        const cleaned = cleanStr(k).toUpperCase();
        if (cleaned) return cleaned;
      }
    }
    for (const c of directCandidates) {
      const cleaned = cleanStr(c).toUpperCase();
      if (cleaned) return cleaned;
    }
    for (const v of Object.values(p)) {
      if (typeof v === 'string') {
        const cleaned = cleanStr(v).toUpperCase();
        if (/^0EJ[A-Z0-9]{3,5}$/i.test(cleaned)) return cleaned;
      }
    }
    return '';
  }

  function extractRicochetUpc(p) {
    if (!p || typeof p !== 'object') return '';
    const directCandidates = [
      p.upc_code,
      p.upc,
      p.UPC,
      p.barcode,
      p.items && Array.isArray(p.items) && p.items[0] ? p.items[0].upc_code || p.items[0].upc : '',
    ];
    for (const c of directCandidates) {
      const cleaned = cleanStr(c).toUpperCase();
      if (cleaned) return cleaned;
    }
    if (p.items && typeof p.items === 'object' && !Array.isArray(p.items)) {
      const flat = Object.values(p.items).flat();
      if (flat[0]) {
        const cleaned = cleanStr(flat[0].upc_code || flat[0].upc).toUpperCase();
        if (cleaned) return cleaned;
      }
    }
    for (const v of Object.values(p)) {
      if (typeof v === 'string') {
        const cleaned = cleanStr(v).toUpperCase();
        if (/^(HUCK|PDXGL|BB)-[A-Z0-9-]+$/i.test(cleaned)) return cleaned;
      }
    }
    return '';
  }

  function extractRicochetQuantity(p) {
    if (!p || typeof p !== 'object') return 0;
    if (typeof p.quantity === 'number') return p.quantity;
    if (typeof p.qty === 'number') return p.qty;
    if (p.sku_quantities && typeof p.sku_quantities === 'object') {
      const vals = Object.values(p.sku_quantities).map((n) => Number(n) || 0);
      if (vals.length > 0) return vals.reduce((a, b) => a + b, 0);
    }
    const parsed = parseInt(String(p.quantity ?? p.qty ?? '1'), 10);
    return isNaN(parsed) ? 1 : parsed;
  }

  function extractRicochetPrice(p) {
    if (!p || typeof p !== 'object') return 0;
    const raw = p.agreed_price ?? p.price ?? p.retail_price ?? p.aged_price ?? p.amount ?? 0;
    const num = parseFloat(String(raw).replace(/[^0-9.-]/g, ''));
    return isNaN(num) ? 0 : Number(num.toFixed(2));
  }

  function extractRicochetInventoryState(p, qty) {
    if (!p || typeof p !== 'object') return qty > 0 ? 'In Stock' : 'Sold';
    const rawStatus = cleanStr(p.inventory || p.status || p.state || '');
    if (rawStatus) return rawStatus;
    return qty > 0 ? 'In Stock' : 'Sold';
  }

  function setInlineBanner(message, tone = 'info') {
    const banner = document.getElementById('rc-inline-banner');
    if (!banner) return;
    if (!message) {
      banner.style.display = 'none';
      banner.textContent = '';
      return;
    }
    const styles = {
      info: { bg: 'rgba(59,130,246,0.18)', border: 'rgba(96,165,250,0.45)', color: '#bfdbfe' },
      success: { bg: 'rgba(16,185,129,0.2)', border: 'rgba(52,211,153,0.5)', color: '#a7f3d0' },
      warning: { bg: 'rgba(245,158,11,0.2)', border: 'rgba(251,191,36,0.5)', color: '#fde68a' },
      error: { bg: 'rgba(239,68,68,0.22)', border: 'rgba(248,113,113,0.55)', color: '#fecaca' },
    };
    const s = styles[tone] || styles.info;
    banner.style.display = 'block';
    banner.style.background = s.bg;
    banner.style.border = `1px solid ${s.border}`;
    banner.style.color = s.color;
    banner.textContent = message;
  }

  function injectWidget() {
    if (document.getElementById('rc-upc-sync-widget')) return;

    const container = document.createElement('div');
    container.id = 'rc-upc-sync-widget';
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      background: #0f172a;
      color: #f8fafc;
      border: 2px solid #f59e0b;
      border-radius: 16px;
      padding: 16px;
      width: 390px;
      max-width: calc(100vw - 32px);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.75);
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
    `;

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #334155; padding-bottom:8px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:18px;">⚡</span>
          <div>
            <div style="font-weight:800; font-size:14px; color:#f8fafc;">Resale Command Barcode Verifier</div>
            <div style="font-size:10px; color:#94a3b8;">Memory Den (0EJ) ➔ HUCK / PDXGL / BB Sync</div>
          </div>
        </div>
        <button id="rc-close-btn" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:16px; padding:2px 6px;">✕</button>
      </div>

      <!-- Inline Status Banner (Zero native window.alert calls) -->
      <div id="rc-inline-banner" style="display:none; margin-bottom:10px; padding:8px 10px; border-radius:10px; font-size:11px; font-weight:600; line-height:1.4;"></div>

      <!-- Preloaded Status Banner -->
      <div id="rc-preloaded-banner" style="display:none; margin-bottom:10px; padding:9px 11px; border-radius:10px; background:rgba(16,185,129,0.14); border:1px solid rgba(16,185,129,0.4); color:#a7f3d0; font-size:11px; line-height:1.35;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
          <span>✅ <strong id="rc-preloaded-count">0</strong> barcodes pre-loaded from Resale Command</span>
          <button id="rc-toggle-manual" style="background:none; border:none; color:#6ee7b7; text-decoration:underline; font-size:10px; cursor:pointer; padding:0;">Edit JSON</button>
        </div>
      </div>

      <!-- Manual Fallback Input Section -->
      <div id="rc-input-section">
        <div style="font-size:11px; color:#cbd5e1; margin-bottom:8px; line-height:1.4;">
          Paste your <b>SKU ➔ UPC JSON</b> or upload your synced CSV:
        </div>

        <textarea id="rc-json-input" rows="2" placeholder='Paste { "0EJ08G": "HUCK-1021", ... } here' style="width:100%; background:#1e293b; color:#f8fafc; border:1px solid #475569; border-radius:8px; padding:6px 8px; font-family:monospace; font-size:11px; margin-bottom:8px; resize:vertical;"></textarea>

        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
          <label style="background:#334155; hover:background:#475569; color:#e2e8f0; padding:5px 10px; border-radius:6px; cursor:pointer; font-size:11px; font-weight:600; display:inline-block;">
            📂 Or Choose CSV
            <input type="file" id="rc-csv-file" accept=".csv" style="display:none;" />
          </label>
          <span id="rc-match-count" style="font-size:11px; color:#38bdf8; font-weight:700;">0 UPCs queued</span>
        </div>
      </div>

      <!-- Live Verification Summary Pills (4 States) -->
      <div id="rc-audit-card" style="background:#1e293b; border:1px solid #334155; border-radius:10px; padding:10px; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-size:11px; font-weight:800; color:#e2e8f0;">📊 Live Memory Den Audit (<span id="rc-total-catalog">0</span> items)</span>
          <button id="rc-rescan-btn" style="background:#334155; color:#cbd5e1; border:none; border-radius:6px; padding:3px 8px; font-size:10px; font-weight:700; cursor:pointer;">🔄 Re-Scan</button>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:11px;">
          <div style="background:rgba(16,185,129,0.14); border:1px solid rgba(16,185,129,0.35); border-radius:8px; padding:6px 8px; color:#a7f3d0; display:flex; justify-content:space-between; align-items:center;">
            <span>🟢 Verified</span>
            <strong id="rc-pill-verified" style="font-family:monospace; font-size:12px;">0</strong>
          </div>
          <div style="background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.38); border-radius:8px; padding:6px 8px; color:#fde68a; display:flex; justify-content:space-between; align-items:center;">
            <span>🟡 Missing UPC</span>
            <strong id="rc-pill-missing" style="font-family:monospace; font-size:12px;">0</strong>
          </div>
          <div style="background:rgba(249,115,22,0.15); border:1px solid rgba(249,115,22,0.38); border-radius:8px; padding:6px 8px; color:#fed7aa; display:flex; justify-content:space-between; align-items:center;">
            <span>🟠 Mismatch</span>
            <strong id="rc-pill-mismatch" style="font-family:monospace; font-size:12px;">0</strong>
          </div>
          <div style="background:rgba(148,163,184,0.15); border:1px solid rgba(148,163,184,0.35); border-radius:8px; padding:6px 8px; color:#e2e8f0; display:flex; justify-content:space-between; align-items:center;">
            <span>⚪ Unlinked RC</span>
            <strong id="rc-pill-unlinked" style="font-family:monospace; font-size:12px;">0</strong>
          </div>
        </div>
      </div>

      <!-- Sync Progress Section -->
      <div id="rc-progress-section" style="display:none; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px;">
          <span id="rc-status-text">Scanning Memory Den...</span>
          <span id="rc-progress-num" style="font-family:monospace; font-weight:700;">0/0</span>
        </div>
        <div style="width:100%; background:#334155; height:7px; border-radius:4px; overflow:hidden;">
          <div id="rc-progress-bar" style="width:0%; background:#10b981; height:100%; transition:width 0.2s;"></div>
        </div>
        <div id="rc-log-box" style="margin-top:6px; max-height:95px; overflow-y:auto; background:#020617; padding:6px; border-radius:6px; font-family:monospace; font-size:10px; color:#94a3b8;"></div>
      </div>

      <!-- Primary Sync Buttons (Test 1 Missing vs Fill All Missing) -->
      <div style="display:flex; gap:8px; margin-bottom:8px;">
        <button id="rc-test-one-btn" disabled style="flex:1; background:#3b82f6; color:#ffffff; font-weight:700; border:none; padding:9px 8px; border-radius:8px; cursor:pointer; font-size:11px; opacity:0.5;">
          🧪 Test 1 Missing
        </button>
        <button id="rc-start-btn" disabled style="flex:1.4; background:#f59e0b; color:#0f172a; font-weight:800; border:none; padding:9px 8px; border-radius:8px; cursor:pointer; font-size:11px; opacity:0.5;">
          🚀 Fill All Missing
        </button>
      </div>

      <!-- 2-Way Verification Report Export Buttons -->
      <div style="display:flex; gap:6px; padding-top:8px; border-top:1px solid #334155;">
        <button id="rc-send-report-btn" disabled style="flex:1.15; background:#10b981; color:#052e16; font-weight:800; border:none; padding:8px 6px; border-radius:8px; cursor:pointer; font-size:11px; opacity:0.5;">
          📡 Send Report to RC
        </button>
        <button id="rc-download-csv-btn" disabled style="flex:1; background:#1e293b; color:#e2e8f0; border:1px solid #475569; font-weight:700; padding:8px 6px; border-radius:8px; cursor:pointer; font-size:11px; opacity:0.5;">
          📥 Download CSV
        </button>
      </div>
    `;

    document.body.appendChild(container);

    const closeBtn = document.getElementById('rc-close-btn');
    const jsonInput = document.getElementById('rc-json-input');
    const csvFile = document.getElementById('rc-csv-file');
    const matchCount = document.getElementById('rc-match-count');
    const startBtn = document.getElementById('rc-start-btn');
    const testOneBtn = document.getElementById('rc-test-one-btn');
    const rescanBtn = document.getElementById('rc-rescan-btn');
    const sendReportBtn = document.getElementById('rc-send-report-btn');
    const downloadCsvBtn = document.getElementById('rc-download-csv-btn');
    const preloadedBanner = document.getElementById('rc-preloaded-banner');
    const preloadedCount = document.getElementById('rc-preloaded-count');
    const inputSection = document.getElementById('rc-input-section');
    const toggleManualBtn = document.getElementById('rc-toggle-manual');

    closeBtn.onclick = () => container.remove();

    toggleManualBtn.onclick = () => {
      if (inputSection.style.display === 'none') {
        inputSection.style.display = 'block';
        toggleManualBtn.textContent = 'Hide JSON';
      } else {
        inputSection.style.display = 'none';
        toggleManualBtn.textContent = 'Edit JSON';
      }
    };

    function updateCounter(isPreloaded = false) {
      const count = Object.keys(parsedMap).length;
      matchCount.textContent = `${count} SKU ➔ UPC pairs loaded`;
      if (isPreloaded && count > 0) {
        preloadedCount.textContent = String(count);
        preloadedBanner.style.display = 'block';
        inputSection.style.display = 'none';
      }
      if (catalogProducts.length > 0) {
        recomputeAuditFromCatalog();
      } else {
        updateActionButtons();
      }
    }

    function updateActionButtons() {
      const actionableCount = missingQueue.length;
      const mapCount = Object.keys(parsedMap).length;
      const canSync = catalogProducts.length > 0 ? actionableCount > 0 : mapCount > 0;

      startBtn.disabled = !canSync;
      startBtn.style.opacity = canSync ? '1' : '0.5';
      startBtn.textContent =
        catalogProducts.length > 0
          ? `🚀 Fill All Missing (${actionableCount})`
          : `🚀 Fill All (${mapCount})`;

      testOneBtn.disabled = !canSync;
      testOneBtn.style.opacity = canSync ? '1' : '0.5';
      if (actionableCount > 0) {
        const first = missingQueue[0];
        testOneBtn.textContent = `🧪 Test 1 (${first.sku} ➔ ${first.expectedRcUpc})`;
      } else if (mapCount > 0 && catalogProducts.length === 0) {
        const firstSku = Object.keys(parsedMap)[0];
        testOneBtn.textContent = `🧪 Test 1 (${firstSku} ➔ ${parsedMap[firstSku]})`;
      } else {
        testOneBtn.textContent = '🧪 Test 1 Missing (0)';
      }

      const hasReport = auditRows.length > 0;
      sendReportBtn.disabled = !hasReport;
      sendReportBtn.style.opacity = hasReport ? '1' : '0.5';
      downloadCsvBtn.disabled = !hasReport;
      downloadCsvBtn.style.opacity = hasReport ? '1' : '0.5';
    }

    function recomputeAuditFromCatalog() {
      let verifiedMatch = 0;
      let missingInMd = 0;
      let mismatchUpc = 0;
      let unlinkedInRc = 0;
      auditRows = [];
      missingQueue = [];

      for (const p of catalogProducts) {
        const sku = extractRicochetSku(p);
        const liveUpc = extractRicochetUpc(p);
        const expectedRcUpc = sku && parsedMap[sku] ? cleanStr(parsedMap[sku]).toUpperCase() : '';
        const qty = extractRicochetQuantity(p);
        const agreedPrice = extractRicochetPrice(p);
        const invState = extractRicochetInventoryState(p, qty);
        const name = cleanStr(p.name || p.title || p.description || sku || `Product #${p.id}`);

        let verifyStatus = 'UNLINKED_IN_RC';
        if (expectedRcUpc) {
          if (!liveUpc) {
            verifyStatus = 'MISSING_IN_MD';
            missingInMd++;
          } else if (liveUpc.toUpperCase() === expectedRcUpc.toUpperCase()) {
            verifyStatus = 'VERIFIED_MATCH';
            verifiedMatch++;
          } else {
            verifyStatus = 'MISMATCH_UPC';
            mismatchUpc++;
          }
        } else {
          if (liveUpc && /^(HUCK|PDXGL|BB)-/i.test(liveUpc)) {
            verifyStatus = 'VERIFIED_MATCH';
            verifiedMatch++;
          } else {
            verifyStatus = 'UNLINKED_IN_RC';
            unlinkedInRc++;
          }
        }

        const rowObj = {
          productId: String(p.id ?? ''),
          sku: sku || String(p.id ?? ''),
          upc: liveUpc,
          expectedRcUpc: expectedRcUpc || (liveUpc && /^(HUCK|PDXGL|BB)-/i.test(liveUpc) ? liveUpc : ''),
          verifyStatus,
          name,
          agreedPrice,
          quantity: qty,
          inventory: invState,
          rawProduct: p,
        };
        auditRows.push(rowObj);

        if (verifyStatus === 'MISSING_IN_MD' || verifyStatus === 'MISMATCH_UPC') {
          missingQueue.push(rowObj);
        }
      }

      const elTotal = document.getElementById('rc-total-catalog');
      const elVerified = document.getElementById('rc-pill-verified');
      const elMissing = document.getElementById('rc-pill-missing');
      const elMismatch = document.getElementById('rc-pill-mismatch');
      const elUnlinked = document.getElementById('rc-pill-unlinked');

      if (elTotal) elTotal.textContent = String(catalogProducts.length);
      if (elVerified) elVerified.textContent = String(verifiedMatch);
      if (elMissing) elMissing.textContent = String(missingInMd);
      if (elMismatch) elMismatch.textContent = String(mismatchUpc);
      if (elUnlinked) elUnlinked.textContent = String(unlinkedInRc);

      updateActionButtons();
    }

    async function runCatalogAudit() {
      if (!window.axios) {
        setInlineBanner(
          '⚠️ Ricochet session (window.axios) not detected. Make sure you are logged into memoryden.ricoconsign.com.',
          'warning'
        );
        return;
      }

      setInlineBanner('🔍 Scanning live Memory Den catalog...', 'info');
      rescanBtn.disabled = true;
      rescanBtn.textContent = '⏳ Scanning...';

      try {
        const fetched = [];
        let consignorId = null;

        for (let offset = 0; offset < 2000; offset += 100) {
          const q = consignorId ? `&consignor_id=${consignorId}` : '';
          const res = await window.axios.get(
            `/api/product?store=1&limit=100&offset=${offset}&order_by=id&direction=desc${q}`
          );
          const prods = res.data?.products || (Array.isArray(res.data) ? res.data : []);
          if (!consignorId && prods[0]?.consignor_id) {
            consignorId = prods[0].consignor_id;
          }
          const myProds = consignorId
            ? prods.filter((p) => !p.consignor_id || p.consignor_id === consignorId)
            : prods;
          fetched.push(...myProds);
          if (prods.length < 100) break;
        }

        catalogProducts = fetched;
        recomputeAuditFromCatalog();

        const verified = auditRows.filter((r) => r.verifyStatus === 'VERIFIED_MATCH').length;
        const missing = auditRows.filter((r) => r.verifyStatus === 'MISSING_IN_MD').length;
        const unlinked = auditRows.filter((r) => r.verifyStatus === 'UNLINKED_IN_RC').length;

        setInlineBanner(
          `✅ Audited ${catalogProducts.length} Memory Den items: ${verified} Verified, ${missing} Missing UPC, ${unlinked} Unlinked in RC.`,
          'success'
        );
      } catch (err) {
        setInlineBanner(
          `✕ Failed to scan Memory Den catalog: ${err?.response?.status || err?.message || 'Unknown error'}`,
          'error'
        );
      } finally {
        rescanBtn.disabled = false;
        rescanBtn.textContent = '🔄 Re-Scan';
      }
    }

    function hydratePreloaded(fromBookmarklet = false) {
      const preloaded = window.__RC_PRELOADED_BARCODES__;
      if (preloaded && typeof preloaded === 'object') {
        const nextMap = {};
        for (const [k, v] of Object.entries(preloaded)) {
          const cleanK = cleanStr(k).toUpperCase();
          const cleanV = cleanStr(v).toUpperCase();
          if (cleanK && cleanV) nextMap[cleanK] = cleanV;
        }
        if (Object.keys(nextMap).length > 0) {
          parsedMap = nextMap;
          jsonInput.value = JSON.stringify(parsedMap, null, 2);
          updateCounter(true);
          if (fromBookmarklet || catalogProducts.length === 0) {
            runCatalogAudit();
          }
        }
      }
    }

    window.__RC_HYDRATE_PRELOADED__ = hydratePreloaded;
    hydratePreloaded(false);

    jsonInput.addEventListener('input', () => {
      try {
        const raw = jsonInput.value.trim();
        if (!raw) {
          parsedMap = {};
          updateCounter(false);
          return;
        }
        const obj = JSON.parse(raw);
        parsedMap = {};
        for (const [k, v] of Object.entries(obj)) {
          const cleanK = cleanStr(k).toUpperCase();
          const cleanV = cleanStr(v).toUpperCase();
          if (cleanK && cleanV) parsedMap[cleanK] = cleanV;
        }
        updateCounter(false);
      } catch {
        matchCount.textContent = 'Invalid JSON format';
      }
    });

    csvFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = String(ev.target.result || '');
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) return;

        const headers = lines[0].split(',').map((h) => cleanStr(h).toLowerCase());
        const skuIdx = headers.findIndex((h) => h === 'sku' || h.includes('sku'));
        const upcIdx = headers.findIndex((h) => h === 'upc' || h.includes('upc') || h === 'expected_rc_upc');
        if (skuIdx === -1 || upcIdx === -1) {
          setInlineBanner('CSV must contain both SKU and UPC columns.', 'error');
          return;
        }

        parsedMap = {};
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => cleanStr(c));
          const sku = (cols[skuIdx] || '').toUpperCase();
          const upc = (cols[upcIdx] || '').toUpperCase();
          if (sku && upc && sku !== upc) {
            parsedMap[sku] = upc;
          }
        }
        jsonInput.value = JSON.stringify(parsedMap, null, 2);
        updateCounter(false);
        if (catalogProducts.length === 0) {
          runCatalogAudit();
        }
      };
      reader.readAsText(file);
    });

    rescanBtn.onclick = () => runCatalogAudit();

    function buildVerificationReportPayload() {
      const rows = auditRows.map((r) => ({
        productId: r.productId,
        sku: r.sku,
        upc: r.upc,
        expectedRcUpc: r.expectedRcUpc,
        verifyStatus: r.verifyStatus,
        name: r.name,
        agreedPrice: r.agreedPrice,
        quantity: r.quantity,
        inventory: r.inventory,
      }));
      return {
        timestamp: new Date().toISOString(),
        source: window.location.hostname || 'memoryden.ricoconsign.com',
        summary: {
          totalCatalog: rows.length,
          verifiedMatch: rows.filter((r) => r.verifyStatus === 'VERIFIED_MATCH').length,
          missingInMd: rows.filter((r) => r.verifyStatus === 'MISSING_IN_MD').length,
          mismatchUpc: rows.filter((r) => r.verifyStatus === 'MISMATCH_UPC').length,
          unlinkedInRc: rows.filter((r) => r.verifyStatus === 'UNLINKED_IN_RC').length,
        },
        rows,
      };
    }

    downloadCsvBtn.onclick = () => {
      if (auditRows.length === 0) {
        setInlineBanner('Run a catalog scan first before downloading CSV.', 'warning');
        return;
      }
      const esc = (val) => `"${String(val ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
      const header = `"Product ID",SKU,UPC,Expected_RC_UPC,Verify_Status,Name,"Agreed Price",Quantity,Inventory`;
      const lines = [header];
      for (const r of auditRows) {
        lines.push(
          [
            esc(r.productId),
            esc(r.sku),
            esc(r.upc),
            esc(r.expectedRcUpc),
            esc(r.verifyStatus),
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
      a.download = `MD-Barcode-Verification-Report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setInlineBanner(
        `📥 Downloaded MD-Barcode-Verification-Report.csv (${auditRows.length} items). You can also drop this CSV right into Resale Command!`,
        'success'
      );
    };

    sendReportBtn.onclick = async () => {
      if (auditRows.length === 0) {
        setInlineBanner('Run a catalog scan first before sending report.', 'warning');
        return;
      }
      const payload = buildVerificationReportPayload();
      sendReportBtn.disabled = true;
      sendReportBtn.textContent = '⏳ Sending...';

      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: 'RC_MD_VERIFY_REPORT', report: payload }, '*');
        }
      } catch {}

      const endpoints = [
        'https://www.resalecmd.com/api/md-verify-report',
        'https://resalecmd.com/api/md-verify-report',
      ];
      let sentOk = false;

      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            sentOk = true;
            break;
          }
        } catch {}
      }

      sendReportBtn.disabled = false;
      sendReportBtn.textContent = '📡 Send Report to RC';

      if (sentOk) {
        setInlineBanner(
          `📡 Sent Live Verification Report (${payload.summary.verifiedMatch} Verified, ${payload.summary.missingInMd} Missing, ${payload.summary.unlinkedInRc} Unlinked) to Resale Command!`,
          'success'
        );
      } else {
        setInlineBanner(
          '⚠️ Could not reach resalecmd.com directly (browser CORS/network). Click "📥 Download CSV" and drop it into Resale Command!',
          'warning'
        );
      }
    };

    async function executeBarcodeSync(testSingleOnly = false) {
      if (!window.axios) {
        setInlineBanner('⚠️ Ricochet session not detected. Please refresh memoryden.ricoconsign.com.', 'error');
        return;
      }

      if (catalogProducts.length === 0) {
        await runCatalogAudit();
      }

      const targets = testSingleOnly ? missingQueue.slice(0, 1) : [...missingQueue];
      if (targets.length === 0) {
        setInlineBanner('🎉 All linked Memory Den items already have verified UPC barcodes!', 'success');
        return;
      }

      startBtn.disabled = true;
      testOneBtn.disabled = true;
      startBtn.style.opacity = '0.5';
      testOneBtn.style.opacity = '0.5';

      const progSec = document.getElementById('rc-progress-section');
      const statusTxt = document.getElementById('rc-status-text');
      const progNum = document.getElementById('rc-progress-num');
      const progBar = document.getElementById('rc-progress-bar');
      const logBox = document.getElementById('rc-log-box');

      progSec.style.display = 'block';
      logBox.innerHTML = '';

      const log = (msg, color = '#94a3b8') => {
        const div = document.createElement('div');
        div.style.color = color;
        div.textContent = msg;
        logBox.appendChild(div);
        logBox.scrollTop = logBox.scrollHeight;
      };

      let updatedCount = 0;
      let alreadyMatchedCount = 0;
      let failedCount = 0;

      for (let i = 0; i < targets.length; i++) {
        const row = targets[i];
        const prod = row.rawProduct;
        const targetUpc = row.expectedRcUpc;

        statusTxt.textContent = `${testSingleOnly ? 'Testing' : 'Syncing'} ${row.sku} ➔ ${targetUpc}...`;
        progNum.textContent = `${i + 1}/${targets.length}`;
        progBar.style.width = `${Math.round(((i + 1) / targets.length) * 100)}%`;

        try {
          const detailRes = await window.axios.get(`/api/product/show/${prod.id}`);
          const payload = detailRes.data?.product || detailRes.data?.data || detailRes.data;
          const allItems = Array.isArray(payload?.items)
            ? payload.items
            : Object.values(payload?.items || {}).flat();
          const targetItem = allItems[0];

          if (!targetItem) {
            log(`✕ ${row.sku}: No editable item payload in Ricochet`, '#ef4444');
            failedCount++;
            continue;
          }

          const existingDetailUpc = cleanStr(targetItem.upc_code || targetItem.upc).toUpperCase();
          if (existingDetailUpc === targetUpc) {
            prod.upc_code = targetUpc;
            alreadyMatchedCount++;
            log(`✓ ${row.sku}: Already had ${targetUpc}`, '#38bdf8');
            recomputeAuditFromCatalog();
            continue;
          }

          targetItem.store = 1;
          targetItem.upc_code = targetUpc;

          const saveRes = await window.axios.put('/api/product/items', targetItem);
          if (saveRes.status === 200 || saveRes.status === 201) {
            prod.upc_code = targetUpc;
            updatedCount++;
            log(`✓ ${row.sku} (${row.name.slice(0, 22)}) ➔ ${targetUpc}`, '#10b981');
            recomputeAuditFromCatalog();
          } else {
            log(`✕ ${row.sku}: HTTP ${saveRes.status}`, '#ef4444');
            failedCount++;
          }
        } catch (err) {
          log(`✕ ${row.sku}: ${err?.response?.status || err?.message || 'Error'}`, '#ef4444');
          failedCount++;
        }

        await new Promise((r) => setTimeout(r, 220));
      }

      recomputeAuditFromCatalog();
      statusTxt.textContent = testSingleOnly ? '🎉 1-Item Test Complete!' : '🎉 Barcode Sync Complete!';
      setInlineBanner(
        `✅ ${updatedCount} updated, ${alreadyMatchedCount} already matched, ${failedCount} failed. Click "📡 Send Report to RC" or "📥 Download CSV" below!`,
        failedCount > 0 ? 'warning' : 'success'
      );
    }

    testOneBtn.onclick = () => executeBarcodeSync(true);
    startBtn.onclick = () => executeBarcodeSync(false);

    if (window.axios && catalogProducts.length === 0) {
      runCatalogAudit();
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(injectWidget, 400);
  } else {
    window.addEventListener('DOMContentLoaded', () => setTimeout(injectWidget, 400));
  }
})();


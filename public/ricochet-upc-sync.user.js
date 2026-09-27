// ==UserScript==
// @name         Resale Command ➔ Ricochet UPC Auto-Sync
// @namespace    https://resalecommand.com/
// @version      1.0.0
// @description  Bulk-sync custom HUCK-XXXX UPC barcodes into Ricochet POS without manual entry
// @author       Resale Command
// @match        *://*.ricoconsign.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // Prevent multiple injections
  if (window.__RC_RICOCHET_SYNC_LOADED__) return;
  window.__RC_RICOCHET_SYNC_LOADED__ = true;

  console.log('⚡ [Resale Command] Ricochet UPC Sync Helper Loaded');

  // --- UI Injection ---
  const container = document.createElement('div');
  container.id = 'rc-sync-root';
  container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:999999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
  document.body.appendChild(container);

  // Floating Launcher Pill Button
  const launcher = document.createElement('button');
  launcher.id = 'rc-sync-launcher';
  launcher.innerHTML = `
    <span style="font-size:16px;">⚡</span>
    <span style="font-weight:700;font-size:13px;letter-spacing:-0.2px;">Resale Command UPC Sync</span>
    <span id="rc-badge" style="background:rgba(255,255,255,0.25);border-radius:10px;padding:1px 7px;font-size:11px;font-weight:800;display:none;">0</span>
  `;
  launcher.style.cssText = `
    display:flex;align-items:center;gap:8px;padding:10px 16px;
    background:linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    color:#fff;border:none;border-radius:9999px;box-shadow:0 10px 25px -5px rgba(79,70,229,0.5),0 8px 10px -6px rgba(79,70,229,0.5);
    cursor:pointer;transition:all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  `;
  launcher.onmouseover = () => { launcher.style.transform = 'translateY(-2px) scale(1.02)'; };
  launcher.onmouseout = () => { launcher.style.transform = 'translateY(0) scale(1)'; };
  container.appendChild(launcher);

  // Modal Overlay
  const modal = document.createElement('div');
  modal.id = 'rc-sync-modal';
  modal.style.cssText = `
    display:none;position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);
    width:560px;max-width:92vw;max-height:88vh;overflow-y:auto;
    background:#18181b;color:#f4f4f5;border:1px solid #27272a;
    border-radius:24px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.7);
    padding:24px;box-sizing:border-box;z-index:1000000;
  `;
  container.appendChild(modal);

  // Backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'rc-sync-backdrop';
  backdrop.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);z-index:999998;';
  container.appendChild(backdrop);

  let isModalOpen = false;
  const toggleModal = (open) => {
    isModalOpen = typeof open === 'boolean' ? open : !isModalOpen;
    modal.style.display = isModalOpen ? 'block' : 'none';
    backdrop.style.display = isModalOpen ? 'block' : 'none';
  };
  launcher.onclick = () => toggleModal();
  backdrop.onclick = () => toggleModal(false);

  // --- State ---
  let itemsToSync = []; // [{ id, sku, upc, title }]
  let isSyncing = false;
  let isPaused = false;
  let capturedEndpoint = null; // { url, method, bodyTemplate }

  // Listen for native Ricochet Save requests to auto-learn the endpoint
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = args[0] ? String(args[0]) : '';
    const opts = args[1] || {};
    const method = (opts.method || 'GET').toUpperCase();

    if (method === 'PUT' || method === 'POST' || method === 'PATCH') {
      try {
        let parsedBody = null;
        if (typeof opts.body === 'string') {
          parsedBody = JSON.parse(opts.body);
        }

        // If it looks like a product update
        if (url.includes('/product') || (parsedBody && (parsedBody.product || parsedBody.upc || parsedBody.sku))) {
          capturedEndpoint = {
            urlPattern: url,
            method: method,
            headers: opts.headers || {},
            sampleBody: parsedBody
          };
          updateCapturedBanner();
        }
      } catch (e) {}
    }
    return originalFetch.apply(this, args);
  };

  // --- Render Modal Content ---
  function renderModal() {
    modal.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #27272a;padding-bottom:16px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="background:rgba(124,58,237,0.2);color:#a78bfa;padding:8px 10px;border-radius:12px;font-size:18px;">⚡</div>
          <div>
            <h2 style="margin:0;font-size:16px;font-weight:800;letter-spacing:-0.3px;">Ricochet UPC Auto-Sync</h2>
            <p style="margin:2px 0 0;font-size:11px;color:#a1a1aa;">Sync custom HUCK-XXXX barcodes directly into Ricochet POS</p>
          </div>
        </div>
        <button id="rc-close-btn" style="background:transparent;border:none;color:#71717a;cursor:pointer;font-size:18px;padding:4px 8px;">✕</button>
      </div>

      <!-- Endpoint Status Banner -->
      <div id="rc-endpoint-banner" style="background:#27272a;border-radius:12px;padding:10px 14px;margin-bottom:16px;font-size:11px;display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span id="rc-endpoint-dot" style="width:8px;height:8px;border-radius:50%;background:#eab308;display:inline-block;"></span>
          <span id="rc-endpoint-text" style="color:#d4d4d8;">Endpoint Detector: <b>Click Save on 1 item in Ricochet</b> or use Default API.</span>
        </div>
        <button id="rc-use-default-api" style="background:#3f3f46;color:#f4f4f5;border:none;padding:3px 8px;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;">Use Default</button>
      </div>

      <!-- File Drop & Load Area -->
      <div id="rc-drop-zone" style="border:2px dashed #3f3f46;background:rgba(39,39,42,0.4);border-radius:16px;padding:20px;text-align:center;cursor:pointer;transition:all 0.2s;margin-bottom:16px;">
        <div style="font-size:24px;margin-bottom:6px;">📄</div>
        <div style="font-size:13px;font-weight:700;margin-bottom:2px;">Drop Synced CSV from Resale Command</div>
        <div style="font-size:11px;color:#a1a1aa;margin-bottom:12px;">Or click to select 'Products-Synced-*.csv'</div>
        <input type="file" id="rc-file-input" accept=".csv,.json" style="display:none;" />
        <button type="button" id="rc-browse-btn" style="background:#4f46e5;color:#fff;border:none;padding:6px 14px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;">Browse Files</button>
      </div>

      <!-- Summary Stats & Actions -->
      <div id="rc-sync-controls" style="display:none;background:#27272a;border-radius:16px;padding:16px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div>
            <div style="font-size:12px;font-weight:800;color:#f4f4f5;" id="rc-matched-title">0 Items Ready to Sync</div>
            <div style="font-size:10px;color:#a1a1aa;" id="rc-matched-subtitle">Matched by Ricochet SKU & Product ID</div>
          </div>
          <div style="display:flex;gap:6px;">
            <button id="rc-start-sync-btn" style="background:#10b981;color:#fff;border:none;padding:8px 16px;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:6px;">
              <span>🚀</span> Start Auto-Sync
            </button>
            <button id="rc-pause-sync-btn" style="display:none;background:#eab308;color:#000;border:none;padding:8px 14px;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer;">
              Pause
            </button>
          </div>
        </div>

        <!-- Progress Bar -->
        <div style="width:100%;height:8px;background:#3f3f46;border-radius:9999px;overflow:hidden;margin-bottom:8px;">
          <div id="rc-progress-bar" style="width:0%;height:100%;background:linear-gradient(90deg, #10b981, #06b6d4);transition:width 0.2s;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:#a1a1aa;font-family:monospace;">
          <span id="rc-progress-count">0 / 0 updated</span>
          <span id="rc-progress-percent">0%</span>
        </div>
      </div>

      <!-- Live Terminal / Audit Log -->
      <div style="background:#09090b;border:1px solid #27272a;border-radius:12px;padding:12px;max-height:140px;overflow-y:auto;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:10px;color:#a1a1aa;line-height:1.5;" id="rc-terminal-log">
        <div>Ready. Drop a CSV export from Resale Command to begin.</div>
      </div>
    `;

    // Bind Event Listeners
    modal.querySelector('#rc-close-btn').onclick = () => toggleModal(false);

    const fileInput = modal.querySelector('#rc-file-input');
    const browseBtn = modal.querySelector('#rc-browse-btn');
    const dropZone = modal.querySelector('#rc-drop-zone');

    browseBtn.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
      if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
    };

    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = '#6366f1'; dropZone.style.background = 'rgba(99,102,241,0.1)'; };
    dropZone.ondragleave = () => { dropZone.style.borderColor = '#3f3f46'; dropZone.style.background = 'rgba(39,39,42,0.4)'; };
    dropZone.ondrop = (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#3f3f46';
      dropZone.style.background = 'rgba(39,39,42,0.4)';
      if (e.dataTransfer?.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    };

    modal.querySelector('#rc-use-default-api').onclick = () => {
      capturedEndpoint = {
        urlPattern: '/api/v1/products/{id}',
        method: 'PUT',
        isDefault: true
      };
      updateCapturedBanner();
      log('⚙️ Default Ricochet API endpoint configured: PUT /api/v1/products/{id}');
    };

    modal.querySelector('#rc-start-sync-btn').onclick = startSync;
    modal.querySelector('#rc-pause-sync-btn').onclick = togglePause;
  }

  function log(msg, color = '#a1a1aa') {
    const term = modal.querySelector('#rc-terminal-log');
    if (!term) return;
    const line = document.createElement('div');
    line.style.color = color;
    line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    term.appendChild(line);
    term.scrollTop = term.scrollHeight;
  }

  function updateCapturedBanner() {
    const banner = modal.querySelector('#rc-endpoint-banner');
    const dot = modal.querySelector('#rc-endpoint-dot');
    const text = modal.querySelector('#rc-endpoint-text');
    if (!banner || !capturedEndpoint) return;

    dot.style.background = '#10b981';
    text.innerHTML = `Active Endpoint: <b style="color:#10b981;">${capturedEndpoint.method}</b> <span style="font-family:monospace;color:#a5f3fc;">${capturedEndpoint.urlPattern}</span>`;
    log(`🎯 Captured Ricochet save endpoint: ${capturedEndpoint.method} ${capturedEndpoint.urlPattern}`, '#10b981');
  }

  // --- CSV / JSON Parser ---
  function handleFile(file) {
    log(`Reading ${file.name}...`);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      if (file.name.endsWith('.json')) {
        try {
          const parsed = JSON.parse(text);
          itemsToSync = Array.isArray(parsed) ? parsed : Object.entries(parsed).map(([sku, upc]) => ({ sku, upc }));
          showLoadedItems();
        } catch (err) {
          log('❌ Invalid JSON file: ' + err.message, '#ef4444');
        }
      } else {
        parseCsv(text);
      }
    };
    reader.readAsText(file);
  }

  function parseCsv(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) {
      log('❌ CSV file is empty or invalid.', '#ef4444');
      return;
    }

    const headers = splitCsv(lines[0]).map(h => h.toLowerCase().replace(/["']/g, '').trim());
    const prodIdIdx = headers.findIndex(h => h === 'product id' || h.includes('product id') || h === 'id');
    const skuIdx = headers.findIndex(h => h === 'sku' || h.includes('sku'));
    const upcIdx = headers.findIndex(h => h === 'upc' || h.includes('upc'));
    const nameIdx = headers.findIndex(h => h === 'name' || h === 'title' || h.includes('item'));

    if (upcIdx === -1) {
      log('❌ Could not find a UPC column in this CSV.', '#ef4444');
      return;
    }

    const list = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsv(lines[i]);
      if (cols.length === 0) continue;

      const upc = (cols[upcIdx] || '').trim().replace(/^['"]+/, '').replace(/['"]+$/, '');
      const sku = skuIdx !== -1 ? (cols[skuIdx] || '').trim().replace(/^['"]+/, '').replace(/['"]+$/, '') : '';
      const prodId = prodIdIdx !== -1 ? (cols[prodIdIdx] || '').trim().replace(/[^0-9]/g, '') : '';
      const title = nameIdx !== -1 ? (cols[nameIdx] || '').trim() : '';

      // Only items that have a target UPC (e.g. HUCK-*)
      if (upc && upc.toUpperCase().startsWith('HUCK')) {
        list.push({
          id: prodId,
          sku: sku,
          upc: upc,
          title: title || sku || `Item ${i}`
        });
      }
    }

    itemsToSync = list;
    showLoadedItems();
  }

  function showLoadedItems() {
    const controls = modal.querySelector('#rc-sync-controls');
    const title = modal.querySelector('#rc-matched-title');
    const subtitle = modal.querySelector('#rc-matched-subtitle');
    const badge = launcher.querySelector('#rc-badge');

    if (itemsToSync.length > 0) {
      controls.style.display = 'block';
      title.textContent = `${itemsToSync.length} Items Ready to Sync`;
      subtitle.textContent = `Target UPCs formatted as ${itemsToSync[0].upc || 'HUCK-XXXX'}`;
      badge.style.display = 'inline-block';
      badge.textContent = itemsToSync.length;
      log(`✅ Successfully loaded ${itemsToSync.length} items with HUCK UPCs!`, '#10b981');
    } else {
      controls.style.display = 'none';
      log('⚠️ No items found with HUCK UPCs in this file.', '#eab308');
    }
  }

  function splitCsv(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  // --- Auto-Sync Execution ---
  async function startSync() {
    if (isSyncing) return;
    if (itemsToSync.length === 0) {
      log('⚠️ Please load items to sync first.', '#eab308');
      return;
    }

    isSyncing = true;
    isPaused = false;

    const startBtn = modal.querySelector('#rc-start-sync-btn');
    const pauseBtn = modal.querySelector('#rc-pause-sync-btn');
    const progressBar = modal.querySelector('#rc-progress-bar');
    const progressCount = modal.querySelector('#rc-progress-count');
    const progressPercent = modal.querySelector('#rc-progress-percent');

    startBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';

    log(`🚀 Starting sync of ${itemsToSync.length} items...`, '#60a5fa');

    let successCount = 0;
    let failCount = 0;
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

    for (let i = 0; i < itemsToSync.length; i++) {
      while (isPaused) {
        await new Promise(r => setTimeout(r, 200));
      }

      const item = itemsToSync[i];
      const percent = Math.round(((i + 1) / itemsToSync.length) * 100);
      progressBar.style.width = percent + '%';
      progressCount.textContent = `${i + 1} / ${itemsToSync.length} (${item.sku || item.upc})`;
      progressPercent.textContent = percent + '%';

      try {
        const ok = await updateSingleItem(item, csrfToken);
        if (ok) {
          successCount++;
          log(`✓ [${item.sku || item.id}] Set UPC ➔ ${item.upc}`, '#34d399');
        } else {
          failCount++;
          log(`✕ [${item.sku || item.id}] Failed to update`, '#f87171');
        }
      } catch (err) {
        failCount++;
        log(`✕ [${item.sku || item.id}] Error: ${err.message}`, '#f87171');
      }

      // Safe rate-limiting delay between requests (200ms)
      await new Promise(r => setTimeout(r, 200));
    }

    isSyncing = false;
    startBtn.style.display = 'inline-block';
    startBtn.innerHTML = '<span>🔄</span> Sync Again';
    pauseBtn.style.display = 'none';

    log(`🎉 Sync Completed! ${successCount} updated successfully, ${failCount} errors.`, '#10b981');
    alert(`🎉 Resale Command Sync Finished!\n\nSuccessfully updated ${successCount} items in Ricochet.\nRefresh your page to verify.`);
  }

  function togglePause() {
    isPaused = !isPaused;
    const pauseBtn = modal.querySelector('#rc-pause-sync-btn');
    pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
    log(isPaused ? '⏸ Sync paused.' : '▶️ Resuming sync...');
  }

  // Update a single product in Ricochet
  async function updateSingleItem(item, csrfToken) {
    const targetId = item.id;
    if (!targetId && !item.sku) return false;

    // 1. Primary: Use Ricochet's pre-configured Axios instance
    if (window.axios) {
      try {
        const detailRes = await window.axios.get('/api/product/show/' + targetId);
        const payload = detailRes.data.product || detailRes.data.data || detailRes.data;
        const allItems = Array.isArray(payload.items) ? payload.items : Object.values(payload.items).flat();
        const targetItem = allItems.find(it => it.sku === item.sku) || allItems[0];
        if (!targetItem) return false;

        targetItem.store = 1;
        targetItem.upc_code = item.upc;
        const saveRes = await window.axios.put('/api/product/items', targetItem);
        return saveRes.status === 201 || saveRes.status === 200;
      } catch (e) {
        console.error('Axios update error on item ' + (item.sku || targetId), e);
        return false;
      }
    }

    // 2. Fallback: Fetch with X-CSRF-Token
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*'
    };
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

    try {
      const getRes = await fetch(`/api/product/show/${targetId}`, { headers });
      const data = await getRes.json();
      const payload = data.product || data.data || data;
      const allItems = Array.isArray(payload.items) ? payload.items : Object.values(payload.items).flat();
      const targetItem = allItems.find(it => it.sku === item.sku) || allItems[0];
      if (!targetItem) return false;

      targetItem.store = 1;
      targetItem.upc_code = item.upc;
      const putRes = await fetch('/api/product/items', {
        method: 'PUT',
        headers,
        body: JSON.stringify(targetItem)
      });
      return putRes.ok;
    } catch (err) {
      console.error('Fetch update error on item ' + (item.sku || targetId), err);
      return false;
    }
  }

  // Initialize UI
  renderModal();
})();

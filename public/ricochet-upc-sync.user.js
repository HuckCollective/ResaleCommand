// ==UserScript==
// @name         Resale Command ➔ Ricochet UPC Auto-Sync
// @namespace    https://resalecmd.com/
// @version      2.0.0
// @description  Bulk-sync custom HUCK-XXXX / PDXGL- / BB- UPC barcodes into Ricochet POS with zero manual entry
// @author       Resale Command
// @match        *://*.ricoconsign.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // If already loaded and user clicked the Bookmarklet again with fresh preloaded barcodes, hydrate and open modal
  if (window.__RC_RICOCHET_SYNC_LOADED__ && typeof window.__RC_HYDRATE_PRELOADED__ === 'function') {
    window.__RC_HYDRATE_PRELOADED__(true);
    return;
  }
  window.__RC_RICOCHET_SYNC_LOADED__ = true;

  console.log('⚡ [Resale Command] Ricochet UPC Sync Helper v2.0 Loaded');

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
    <span style="font-weight:700;font-size:13px;letter-spacing:-0.2px;">Resale Command Barcode Sync</span>
    <span id="rc-badge" style="background:rgba(255,255,255,0.25);border-radius:10px;padding:1px 7px;font-size:11px;font-weight:800;display:none;">0</span>
  `;
  launcher.style.cssText = `
    display:flex;align-items:center;gap:8px;padding:10px 16px;
    background:linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    color:#fff;border:none;border-radius:9999px;box-shadow:0 10px 25px -5px rgba(79,70,229,0.5),0 8px 10px -6px rgba(79,70,229,0.5);
    cursor:pointer;transition:all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  `;
  container.appendChild(launcher);

  // Modal Overlay
  const modal = document.createElement('div');
  modal.id = 'rc-sync-modal';
  modal.style.cssText = `
    display:none;position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);
    width:580px;max-width:94vw;max-height:88vh;overflow-y:auto;
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
  let cachedCatalog = null;

  function renderModal() {
    modal.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #27272a;padding-bottom:14px;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="background:rgba(234,179,8,0.2);color:#facc15;padding:8px 10px;border-radius:12px;font-size:18px;">🏷️</div>
          <div>
            <h2 style="margin:0;font-size:16px;font-weight:800;letter-spacing:-0.3px;">Memory Den Barcode Auto-Filler</h2>
            <p style="margin:2px 0 0;font-size:11px;color:#a1a1aa;">Automatically fills in your HUCK-, PDXGL-, and BB- barcodes on Memory Den</p>
          </div>
        </div>
        <button id="rc-close-btn" style="background:transparent;border:none;color:#a1a1aa;cursor:pointer;font-size:18px;padding:4px 8px;">✕</button>
      </div>

      <!-- Summary Stats & Primary Actions -->
      <div id="rc-sync-controls" style="display:none;background:#27272a;border:1px solid #3f3f46;border-radius:16px;padding:16px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
          <div>
            <div style="font-size:14px;font-weight:800;color:#4ade80;" id="rc-matched-title">0 Items Pre-Loaded & Ready</div>
            <div style="font-size:11px;color:#d4d4d8;margin-top:2px;" id="rc-matched-subtitle">Matched by Memory Den 0EJ... Booth SKU</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button id="rc-test-one-btn" style="background:#3f3f46;color:#fde047;border:1px solid #52525b;padding:8px 13px;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer;">
              🧪 Test 1 Item
            </button>
            <button id="rc-start-sync-btn" style="background:#10b981;color:#052e16;border:none;padding:8px 16px;border-radius:10px;font-size:12px;font-weight:900;cursor:pointer;">
              🚀 Start Sync
            </button>
            <button id="rc-pause-sync-btn" style="display:none;background:#eab308;color:#000;border:none;padding:8px 14px;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer;">
              Pause
            </button>
          </div>
        </div>

        <!-- Progress Bar -->
        <div style="width:100%;height:8px;background:#18181b;border-radius:9999px;overflow:hidden;margin-bottom:6px;">
          <div id="rc-progress-bar" style="width:0%;height:100%;background:linear-gradient(90deg, #10b981, #06b6d4);transition:width 0.2s;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:#a1a1aa;font-family:monospace;">
          <span id="rc-progress-count">0 / 0 updated</span>
          <span id="rc-progress-percent">0%</span>
        </div>
      </div>

      <!-- Fallback Paste / File Loader (Collapsible if already preloaded) -->
      <details id="rc-fallback-details" style="background:rgba(39,39,42,0.5);border:1px solid #27272a;border-radius:14px;padding:10px 14px;margin-bottom:14px;font-size:11px;">
        <summary style="cursor:pointer;font-weight:700;color:#d4d4d8;">📋 Optional: Paste JSON or Drop CSV File</summary>
        <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px;">
          <textarea id="rc-json-paste" rows="3" placeholder='Paste { "0EJ0FR": "HUCK-1309", ... } JSON here if needed' style="width:100%;box-sizing:border-box;background:#09090b;color:#f4f4f5;border:1px solid #3f3f46;border-radius:8px;padding:8px;font-family:monospace;font-size:11px;"></textarea>
          <div style="display:flex;gap:8px;">
            <button type="button" id="rc-load-json-btn" style="background:#4f46e5;color:#fff;border:none;padding:6px 12px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;">Load Pasted JSON</button>
            <button type="button" id="rc-browse-btn" style="background:#3f3f46;color:#fff;border:none;padding:6px 12px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;">Or Select CSV/JSON File</button>
            <input type="file" id="rc-file-input" accept=".csv,.json" style="display:none;" />
          </div>
        </div>
      </details>

      <!-- Live Terminal / Audit Log -->
      <div style="background:#09090b;border:1px solid #27272a;border-radius:12px;padding:12px;max-height:150px;overflow-y:auto;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:10px;color:#a1a1aa;line-height:1.5;" id="rc-terminal-log">
        <div>Ready to fill in Memory Den barcodes.</div>
      </div>
    `;

    modal.querySelector('#rc-close-btn').onclick = () => toggleModal(false);
    const fileInput = modal.querySelector('#rc-file-input');
    modal.querySelector('#rc-browse-btn').onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
      if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
    };

    modal.querySelector('#rc-load-json-btn').onclick = () => {
      const raw = (modal.querySelector('#rc-json-paste')?.value || '').trim();
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        loadFromObjectOrArray(parsed);
      } catch (err) {
        log('❌ Invalid JSON: ' + err.message, '#ef4444');
      }
    };

    modal.querySelector('#rc-test-one-btn').onclick = () => startSync(true);
    modal.querySelector('#rc-start-sync-btn').onclick = () => startSync(false);
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

  function loadFromObjectOrArray(data) {
    if (Array.isArray(data)) {
      itemsToSync = data
        .filter(x => x && x.upc)
        .map(x => ({
          id: x.id || '',
          sku: String(x.sku || '').trim().replace(/^'+/, '').toUpperCase(),
          upc: String(x.upc || '').trim().toUpperCase(),
          title: x.title || x.sku || '',
        }));
    } else if (data && typeof data === 'object') {
      itemsToSync = Object.entries(data)
        .filter(([sku, upc]) => sku && upc)
        .map(([sku, upc]) => ({
          id: '',
          sku: String(sku).trim().replace(/^'+/, '').toUpperCase(),
          upc: String(upc).trim().toUpperCase(),
          title: String(sku).trim().toUpperCase(),
        }));
    }
    showLoadedItems();
  }

  function handleFile(file) {
    log(`Reading ${file.name}...`);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      if (file.name.endsWith('.json')) {
        try {
          loadFromObjectOrArray(JSON.parse(text));
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
    if (lines.length < 2) return;
    const headers = lines[0].split(',').map(h => h.toLowerCase().replace(/["']/g, '').trim());
    const prodIdIdx = headers.findIndex(h => h === 'product id' || h.includes('product id') || h === 'id');
    const skuIdx = headers.findIndex(h => h === 'sku' || h.includes('sku'));
    const upcIdx = headers.findIndex(h => h === 'upc' || h.includes('upc'));
    const nameIdx = headers.findIndex(h => h === 'name' || h === 'title' || h.includes('item'));
    if (upcIdx === -1) return;

    const list = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const upc = (cols[upcIdx] || '').trim().replace(/^['"]+/, '').replace(/['"]+$/, '');
      const sku = skuIdx !== -1 ? (cols[skuIdx] || '').trim().replace(/^['"]+/, '').replace(/['"]+$/, '') : '';
      const prodId = prodIdIdx !== -1 ? (cols[prodIdIdx] || '').trim().replace(/[^0-9]/g, '') : '';
      const title = nameIdx !== -1 ? (cols[nameIdx] || '').trim() : '';
      if (upc && /^(HUCK|PDXGL|BB)/i.test(upc)) {
        list.push({ id: prodId, sku: sku.toUpperCase(), upc: upc.toUpperCase(), title: title || sku });
      }
    }
    itemsToSync = list;
    showLoadedItems();
  }

  function showLoadedItems() {
    const controls = modal.querySelector('#rc-sync-controls');
    const title = modal.querySelector('#rc-matched-title');
    const subtitle = modal.querySelector('#rc-matched-subtitle');
    const testBtn = modal.querySelector('#rc-test-one-btn');
    const startBtn = modal.querySelector('#rc-start-sync-btn');
    const badge = launcher.querySelector('#rc-badge');

    if (itemsToSync.length > 0) {
      const first = itemsToSync[0];
      controls.style.display = 'block';
      title.textContent = `✅ ${itemsToSync.length} Memory Den Barcodes Pre-Loaded!`;
      subtitle.textContent = `First item: ${first.sku || 'Item'} → ${first.upc}`;
      if (testBtn) testBtn.textContent = `🧪 Test 1 Item (${first.sku} → ${first.upc})`;
      if (startBtn) startBtn.textContent = `🚀 Start Sync (${itemsToSync.length})`;
      badge.style.display = 'inline-block';
      badge.textContent = itemsToSync.length;
      log(`✅ Pre-loaded ${itemsToSync.length} Memory Den SKU → UPC pairs! Click "Test 1 Item" or "Start Sync".`, '#10b981');
    } else {
      controls.style.display = 'none';
    }
  }

  async function ensureCatalogLoaded() {
    if (cachedCatalog && cachedCatalog.length > 0) return cachedCatalog;
    if (!window.axios) {
      log('⚠️ Please run this on memoryden.ricoconsign.com while logged in.', '#eab308');
      return [];
    }
    log('📡 Loading your Memory Den inventory catalog...', '#60a5fa');
    const catalog = [];
    let consignorId = null;
    for (let offset = 0; offset < 900; offset += 100) {
      try {
        const q = consignorId ? '&consignor_id=' + consignorId : '';
        const catRes = await window.axios.get('/api/product?store=1&limit=100&offset=' + offset + '&order_by=id&direction=desc' + q);
        const prods = catRes.data.products || (Array.isArray(catRes.data) ? catRes.data : []);
        if (!consignorId && prods[0]?.consignor_id) consignorId = prods[0].consignor_id;
        const myProds = consignorId ? prods.filter(p => !p.consignor_id || p.consignor_id === consignorId) : prods;
        catalog.push(...myProds);
        if (prods.length < 100) break;
      } catch (e) {
        break;
      }
    }
    cachedCatalog = catalog;
    log(`📡 Loaded ${catalog.length} products from Memory Den.`, '#10b981');
    return catalog;
  }

  async function startSync(testSingleOnly = false) {
    if (isSyncing) return;
    if (itemsToSync.length === 0) {
      log('⚠️ No items loaded yet.', '#eab308');
      return;
    }

    const batch = testSingleOnly ? itemsToSync.slice(0, 1) : itemsToSync;
    isSyncing = true;
    isPaused = false;

    const startBtn = modal.querySelector('#rc-start-sync-btn');
    const testBtn = modal.querySelector('#rc-test-one-btn');
    const pauseBtn = modal.querySelector('#rc-pause-sync-btn');
    const progressBar = modal.querySelector('#rc-progress-bar');
    const progressCount = modal.querySelector('#rc-progress-count');
    const progressPercent = modal.querySelector('#rc-progress-percent');

    startBtn.style.display = 'none';
    testBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';

    const catalog = await ensureCatalogLoaded();
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < batch.length; i++) {
      while (isPaused) {
        await new Promise(r => setTimeout(r, 200));
      }

      const item = batch[i];
      const percent = Math.round(((i + 1) / batch.length) * 100);
      progressBar.style.width = percent + '%';
      progressCount.textContent = `${i + 1} / ${batch.length} (${item.sku} → ${item.upc})`;
      progressPercent.textContent = percent + '%';

      try {
        const cleanSku = (item.sku || '').trim().toUpperCase();
        let prod = null;
        if (item.id) prod = catalog.find(p => String(p.id) === String(item.id));
        if (!prod && cleanSku) {
          prod = catalog.find(p => {
            if (p.sku && p.sku.trim().toUpperCase() === cleanSku) return true;
            if (p.sku_quantities && Object.keys(p.sku_quantities).some(s => s.trim().toUpperCase() === cleanSku)) return true;
            return false;
          });
        }

        if (!prod) {
          failCount++;
          log(`✕ [${cleanSku}] Not found in current Memory Den catalog`, '#f87171');
          continue;
        }

        const detailRes = await window.axios.get('/api/product/show/' + prod.id);
        const payload = detailRes.data.product || detailRes.data.data || detailRes.data;
        const allItems = Array.isArray(payload.items) ? payload.items : Object.values(payload.items || {}).flat();
        const targetItem = allItems.find(it => (it.sku || '').trim().toUpperCase() === cleanSku) || allItems[0];

        if (!targetItem) {
          failCount++;
          continue;
        }

        if (targetItem.upc_code === item.upc) {
          successCount++;
          log(`ℹ️ [${cleanSku}] Already has barcode ${item.upc}`, '#34d399');
          continue;
        }

        targetItem.store = 1;
        targetItem.upc_code = item.upc;
        const saveRes = await window.axios.put('/api/product/items', targetItem);
        if (saveRes.status === 200 || saveRes.status === 201) {
          successCount++;
          log(`✓ [${cleanSku}] Filled in barcode ➔ ${item.upc}`, '#34d399');
        } else {
          failCount++;
          log(`✕ [${cleanSku}] HTTP ${saveRes.status}`, '#f87171');
        }
      } catch (err) {
        failCount++;
        log(`✕ [${item.sku}] Error: ${err.message}`, '#f87171');
      }

      await new Promise(r => setTimeout(r, 200));
    }

    isSyncing = false;
    startBtn.style.display = 'inline-block';
    testBtn.style.display = 'inline-block';
    pauseBtn.style.display = 'none';

    log(`🎉 Done! ${successCount} updated/verified, ${failCount} skipped.`, '#10b981');
    alert(`🎉 Memory Den Barcode Sync Complete!\n\n${successCount} item(s) updated/verified.\nRefresh your Memory Den page to see the new barcodes!`);
  }

  function togglePause() {
    isPaused = !isPaused;
    const pauseBtn = modal.querySelector('#rc-pause-sync-btn');
    pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
    log(isPaused ? '⏸ Sync paused.' : '▶️ Resuming sync...');
  }

  window.__RC_HYDRATE_PRELOADED__ = function (autoOpen = false) {
    if (window.__RC_PRELOADED_BARCODES__) {
      loadFromObjectOrArray(window.__RC_PRELOADED_BARCODES__);
      if (autoOpen) toggleModal(true);
    } else if (autoOpen) {
      toggleModal(true);
    }
  };

  renderModal();
  window.__RC_HYDRATE_PRELOADED__(Boolean(window.__RC_PRELOADED_BARCODES__));
})();

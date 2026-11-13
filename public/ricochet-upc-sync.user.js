// ==UserScript==
// @name         Works@TheHC ➔ Ricochet POS Auto-UPC Sync & Live Sales Reconciler
// @namespace    https://works.thehc.llc/
// @version      5.0
// @description  Multi-Domain (.llc / .coop / .com) Evergreen Live-Fetch Bookmarklet, Multi-Partner (HUCK / PDXGL / B&B) Barcode Verifier & Live Sales/Payout Sync for Ricochet POS Booths.
// @author       The Huckleberry Collective
// @match        *://*.ricoconsign.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const RC_ORIGINS = Array.from(
    new Set(
      [
        typeof window !== 'undefined' ? window.__RC_ORIGIN__ : '',
        // Live list of brand domains injected by /scripts/rico-bookmarklet.js (from src/site-config.ts)
        ...(typeof window !== 'undefined' && Array.isArray(window.__RC_ORIGINS__) ? window.__RC_ORIGINS__ : []),
        'http://localhost:4321',
      ]
        .map((o) => String(o || '').trim().replace(/\/+$/, ''))
        .filter(Boolean)
    )
  );

  const RC_REPORT_ENDPOINTS = RC_ORIGINS.map((o) => o + '/api/md-verify-report');
  const RC_SALES_SYNC_ENDPOINTS = RC_ORIGINS.map((o) => o + '/api/sales/ricochet-sync');

  const RC_SCRIPT_VERSION = 'v5.0';

  // State (100% driven by central Location Settings injected by /scripts/rico-bookmarklet.js)
  const activeLocMeta = window.__RC_ACTIVE_LOCATION_META__ || {};
  const activeBmlTool = window.__RC_BML_TOOL_CONFIG__ || {};
  const activeLocationCode = String(window.__RC_ACTIVE_LOCATION_CODE__ || activeLocMeta.code || '').toUpperCase();
  const activeLocationName = String(activeLocMeta.name || activeLocMeta.fullName || 'Ricochet Booth');
  const activeBmlIcon = String(activeBmlTool.icon || '⚡').trim() || '⚡';
  const activeHudTitle = String(activeBmlTool.hudTitle || `${activeLocationName} Barcode Sync & Verifier`).trim();
  const getBmlMemberSession = () => {
    try {
      return window.__RC_BML_AUTH__ && typeof window.__RC_BML_AUTH__.getSession === 'function'
        ? window.__RC_BML_AUTH__.getSession()
        : null;
    } catch (e) {
      return null;
    }
  };
  // Fee / rent come ONLY from central Location Settings (injected as __RC_ACTIVE_LOCATION_META__) — no literal fallbacks
  const activeCommissionRate = Number(activeLocMeta.commissionRate ?? activeLocMeta.feePct ?? 0) || 0;
  const activeMonthlyRent = Number(activeLocMeta.monthlyRent ?? 0) || 0;
  let activeModalTab = 'inventory'; // 'inventory' | 'sales' | 'drops'

  // ===== 📦 Outbound Drops tab (2-way manifest sync) =====
  // Self-injecting: adds a 3rd tab + view when the modal's tab bar mounts, so the existing
  // inventory / sales tab code is untouched. All location data comes from activeLocationCode.
  const RC_DROP_SYNC_ENDPOINTS = RC_ORIGINS.map((o) => o + '/api/manifests/ricochet-drop-sync');
  let dropManifests = [];
  let dropSelectedId = '';
  let dropStatus = { loading: false, deploying: false, done: 0, total: 0, error: '', finished: false };

  const rcDropEsc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Falls through to the next endpoint ONLY on network failure; HTTP errors are surfaced (no double-writes).
  async function rcDropApi(method, query, body) {
    let netErr = null;
    for (const base of RC_DROP_SYNC_ENDPOINTS) {
      let res;
      try {
        res = await fetch(base + (query || ''), {
          method,
          headers: body ? { 'Content-Type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (e) {
        netErr = e;
        continue;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Resale Command HTTP ' + res.status);
      return data;
    }
    throw netErr || new Error('Resale Command unreachable');
  }

  // NOTE: payload field names for Ricochet's POST /api/product are unverified; the deploy loop
  // aborts after the first item (canary) if no SKU comes back, so a wrong shape cannot mass-create.
  let cachedTemplateProduct = null;

  async function getRicochetProductTemplate() {
    if (cachedTemplateProduct) return cachedTemplateProduct;
    if (!window.axios) return null;
    try {
      const sample = (catalogProducts || []).find((p) => p && p.id);
      if (!sample) return null;
      const detailRes = await window.axios.get('/api/product/show/' + sample.id);
      cachedTemplateProduct = detailRes.data?.product || detailRes.data?.data || detailRes.data || null;
      return cachedTemplateProduct;
    } catch (e) {
      return null;
    }
  }

  function formatAxiosError(err) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    if (data && typeof data === 'object') {
      if (data.errors && typeof data.errors === 'object') {
        const parts = Object.entries(data.errors).map(
          ([k, v]) => k + ': ' + (Array.isArray(v) ? v.join(', ') : String(v))
        );
        if (parts.length) return 'HTTP ' + (status || 422) + ' — ' + parts.join(' | ');
      }
      if (data.message || data.error) {
        return 'HTTP ' + (status || 422) + ' — ' + String(data.message || data.error);
      }
      try {
        return 'HTTP ' + (status || 422) + ' — ' + JSON.stringify(data).slice(0, 260);
      } catch (e) {}
    }
    return err?.message || String(err);
  }

  async function rcCreateRicochetProduct(item) {
    const shortTagTitle = item.tagTitle || item.title;
    const fullPosDescription = item.posDescription || item.title;
    const webDesc = item.webDescription || fullPosDescription;
    const tmpl = await getRicochetProductTemplate();
    const tmplItem =
      tmpl && Array.isArray(tmpl.items)
        ? tmpl.items[0]
        : tmpl && tmpl.items && typeof tmpl.items === 'object'
        ? Object.values(tmpl.items).flat()[0]
        : null;

    const cid = consignorId || tmpl?.consignor_id || tmplItem?.consignor_id || 475;
    const storeId = tmpl?.store_id || tmpl?.store || tmplItem?.store_id || tmplItem?.store || 1;
    const priceNum = Number(item.price || 0);
    const qtyNum = Number(item.quantity || 1) || 1;
    const now = new Date();
    const todayIso =
      now.getFullYear() +
      '-' +
      String(now.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(now.getDate()).padStart(2, '0');

    // Build payload matching Ricochet's exact `products` + `items` schema from GET /api/product/show/{id}
    // Never send null for brand_id or category_id (MySQL NOT NULL columns default to 0 when omitted or 0)
    const payload = {
      store: storeId,
      store_id: storeId,
      consignor_id: cid,
      name: shortTagTitle,
      description: fullPosDescription,
      web_description: webDesc,
      note: '',
      brand_id: tmpl?.brand_id || 0,
      category_id: tmpl?.category_id || 0,
      split: tmpl?.split ?? 85,
      split_id: tmpl?.split_id ?? 5,
      tax_rate_id: tmpl?.tax_rate_id ?? 1,
      price: priceNum,
      agreed_price: priceNum,
      quantity: qtyNum,
      upc_code: item.upc,
      status: 'In Stock',
      in_stock: todayIso,
      auto_discount: false,
      item_fee: false,
      track_inventory: true,
      sell_online: false,
      featured_online: false,
      items: [
        {
          store: storeId,
          consignor_id: cid,
          name: shortTagTitle,
          description: fullPosDescription,
          web_description: webDesc,
          price: priceNum,
          aged_price: priceNum,
          cost: 0,
          weight: 0,
          threshold: 0,
          fee: 0,
          attributes_enabled: 0,
          quantity: qtyNum,
          sku: '',
          upc_code: item.upc,
          in_stock: todayIso,
        },
      ],
    };

    try {
      let createdData;
      if (window.axios) {
        const r = await window.axios.post('/api/product', payload);
        createdData = r.data;
      } else {
        const r = await fetch('/api/product', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!r.ok) {
          const errBody = await r.json().catch(() => ({}));
          const e = new Error('Ricochet HTTP ' + r.status);
          e.response = { status: r.status, data: errBody };
          throw e;
        }
        createdData = await r.json();
      }

      // Ensure nested item variant also has upc_code saved via PUT /api/product/items if needed
      const createdProd = createdData?.product || createdData?.data?.product || createdData?.data || createdData;
      const newProdId = createdProd?.id || createdData?.id;
      if (newProdId && window.axios) {
        try {
          const detailRes = await window.axios.get('/api/product/show/' + newProdId);
          const fullProd = detailRes.data?.product || detailRes.data?.data || detailRes.data;
          const targetItem = extractFirstRicochetItemVariant(fullProd);
          if (item.upc && targetItem && cleanStr(targetItem.upc_code).toUpperCase() !== cleanStr(item.upc).toUpperCase()) {
            targetItem.store = storeId;
            targetItem.upc_code = item.upc;
            await window.axios.put('/api/product/items', targetItem);
          }
          const resolvedSku =
            extractRicochetSku(targetItem) ||
            extractRicochetSku(fullProd) ||
            rcDropSkuFromResponse(createdData);
          if (resolvedSku) return { sku: resolvedSku };
          if (fullProd) return fullProd;
        } catch (e) {}
      }
      // If POST /api/product returned 200 without the product object, look up the newly created SKU by UPC/title
      const directSku = rcDropSkuFromResponse(createdData);
      if (!directSku) {
        const lookedUpSku = await findExistingRicochetSkuForDropItem(item);
        if (lookedUpSku) return { sku: lookedUpSku };
      }
      return createdData;
    } catch (err) {
      const errText = formatAxiosError(err);
      // If Ricochet says "The UPC Code already exists", find that existing product's 0EJ SKU (or create with blank UPC & attach)
      if (/upc.*already\s+exists|already\s+been\s+taken/i.test(errText)) {
        const existingSku = await findExistingRicochetSkuForDropItem(item);
        if (existingSku) {
          return { sku: existingSku, reusedExisting: true };
        }
        // If UPC exists on a historical/archived item not in active catalog, create product shell cleanly with blank upc_code so it still gets its 0EJ SKU!
        try {
          const fallbackPayload = {
            ...payload,
            upc_code: '',
            items: [{ ...payload.items[0], upc_code: '' }],
          };
          const r2 = await window.axios.post('/api/product', fallbackPayload);
          const d2 = r2.data;
          const sku2 = rcDropSkuFromResponse(d2) || (await findExistingRicochetSkuForDropItem(item));
          if (sku2) return { sku: sku2 };
        } catch (e2) {}
      }
      throw new Error(errText);
    }
  }

  function extractFirstRicochetItemVariant(p) {
    if (!p || typeof p !== 'object') return null;
    if (Array.isArray(p.items) && p.items.length > 0) return p.items[0];
    if (p.items && typeof p.items === 'object') {
      const flat = Object.values(p.items).flat().filter(Boolean);
      if (flat.length > 0) return flat[0];
    }
    return null;
  }

  function rcDropSkuFromResponse(data) {
    if (!data || typeof data !== 'object') return '';
    if (data.sku && /^0EJ/i.test(cleanStr(data.sku))) return cleanStr(data.sku).toUpperCase();
    const candidates = [
      data,
      data.product,
      data.data,
      data.data && data.data.product,
      extractFirstRicochetItemVariant(data),
      extractFirstRicochetItemVariant(data.product),
      extractFirstRicochetItemVariant(data.data),
    ];
    for (const c of candidates) {
      if (!c) continue;
      const sku = extractRicochetSku(c);
      if (sku && /^0EJ/i.test(sku)) return sku;
      const vItem = extractFirstRicochetItemVariant(c);
      if (vItem) {
        const vSku = extractRicochetSku(vItem);
        if (vSku && /^0EJ/i.test(vSku)) return vSku;
      }
    }
    return '';
  }

  // Find a product's 0EJ SKU in Ricochet by UPC or Title (handles newly created items & 422 "UPC Code already exists")
  async function findExistingRicochetSkuForDropItem(item, preCheckOnly = false) {
    const targetUpc = cleanStr(item.upc).toUpperCase();
    const shortName = cleanStr(item.tagTitle || item.title).toLowerCase();
    const fullName = cleanStr(item.title).toLowerCase();
    const posDesc = cleanStr(item.posDescription || '').toLowerCase();

    const matchesName = (rawName) => {
      const n = cleanStr(rawName).toLowerCase();
      if (!n) return false;
      return n === shortName || n === fullName || (posDesc && n === posDesc);
    };

    // 1. Fast 0ms check against in-memory catalogProducts (809 items) by UPC or exact Tag Title / Full Title!
    for (const p of catalogProducts || []) {
      const sku = extractRicochetSku(p);
      if (!sku) continue;
      const upc = extractRicochetUpc(p);
      if (targetUpc && upc === targetUpc) {
        recordVerifiedMdUpc(sku, targetUpc);
        return sku;
      }
      if (matchesName(p.name || p.title)) {
        if (window.axios && p.id && targetUpc) {
          try {
            const detailRes = await window.axios.get('/api/product/show/' + p.id);
            const fullProd = detailRes.data?.product || detailRes.data?.data || detailRes.data;
            const targetItem = extractFirstRicochetItemVariant(fullProd);
            const existingUpc = cleanStr(targetItem?.upc_code || fullProd?.upc_code || '').toUpperCase();
            if (!existingUpc || existingUpc === targetUpc) {
              if (!existingUpc && targetItem) {
                targetItem.store = 1;
                targetItem.upc_code = targetUpc;
                await window.axios.put('/api/product/items', targetItem).catch(() => {});
              }
              recordVerifiedMdUpc(sku, targetUpc);
              return sku;
            }
          } catch (e) {}
        }
        recordVerifiedMdUpc(sku, targetUpc);
        return sku;
      }
    }

    if (preCheckOnly || !window.axios) return '';
    const cid = consignorId || 475;

    // 2. Fetch newest 10 products + search by UPC in Ricochet
    const candidateProducts = [];
    const addCandidates = (arr) => {
      for (const rp of arr || []) {
        if (rp && rp.id && !candidateProducts.some((cp) => cp.id === rp.id)) {
          candidateProducts.push(rp);
        }
      }
    };

    try {
      const recentRes = await window.axios.get(
        `/api/product?store=1&limit=10&offset=0&order_by=id&direction=desc&consignor_id=${cid}`
      );
      addCandidates(recentRes.data?.products || (Array.isArray(recentRes.data) ? recentRes.data : []));
    } catch (e) {}

    if (targetUpc) {
      try {
        const searchRes = await window.axios.get(
          `/api/product?store=1&limit=10&offset=0&order_by=id&direction=desc&search=${encodeURIComponent(targetUpc)}`
        );
        addCandidates(searchRes.data?.products || (Array.isArray(searchRes.data) ? searchRes.data : []));
      } catch (e) {}
    }

    // 3. Check top-level fields first (including name match!)
    for (const p of candidateProducts) {
      const sku = extractRicochetSku(p);
      const upc = extractRicochetUpc(p);
      if (sku && ((targetUpc && upc === targetUpc) || matchesName(p.name || p.title))) {
        if (targetUpc) recordVerifiedMdUpc(sku, targetUpc);
        return sku;
      }
    }

    // 4. Deep check top 4 newest candidates via `/api/product/show/{id}` using `extractFirstRicochetItemVariant`
    for (const p of candidateProducts.slice(0, 4)) {
      if (!p || !p.id) continue;
      try {
        const detailRes = await window.axios.get('/api/product/show/' + p.id);
        const fullProd = detailRes.data?.product || detailRes.data?.data || detailRes.data;
        if (!fullProd) continue;
        const targetItem = extractFirstRicochetItemVariant(fullProd);
        const sku =
          extractRicochetSku(targetItem) ||
          extractRicochetSku(fullProd) ||
          extractRicochetSku(p);
        const itemUpc = cleanStr(
          targetItem?.upc_code || targetItem?.upc || fullProd.upc_code || ''
        ).toUpperCase();
        if (sku && ((targetUpc && itemUpc === targetUpc) || matchesName(fullProd.name || p.name))) {
          if (targetUpc) recordVerifiedMdUpc(sku, targetUpc);
          return sku;
        }
      } catch (e) {}
    }

    return '';
  }

  function rcDropActiveManifest() {
    return dropManifests.find((m) => m.manifestId === dropSelectedId) || dropManifests[0] || null;
  }

  function renderDropsView() {
    const view = document.getElementById('rc-tab-view-drops');
    if (!view) return;
    view.style.overflowX = 'hidden';
    const badge = document.getElementById('rc-tab-drops-badge');
    const m = rcDropActiveManifest();
    if (badge) badge.textContent = String(dropManifests.reduce((n, x) => n + x.items.filter((i) => !i.bound).length, 0));
    const origin = new URL(RC_DROP_SYNC_ENDPOINTS[0]).origin;
    let html = '';
    if (dropStatus.loading) {
      html += '<div style="padding:12px;border-radius:10px;background:#1e293b;border:1px solid #334155;color:#94a3b8;font-size:11.5px;display:flex;align-items:center;gap:8px;">⏳ Loading active outbound drops from Resale Command...</div>';
    }
    if (dropStatus.error) {
      html += '<div style="padding:10px 12px;border-radius:10px;background:rgba(239,68,68,0.14);border:1px solid rgba(239,68,68,0.45);color:#fecaca;font-size:11.5px;font-weight:700;line-height:1.45;word-break:break-word;overflow-wrap:anywhere;">' + rcDropEsc(dropStatus.error) + '</div>';
    }
    if (!dropStatus.loading && !m) {
      html += '<div style="padding:14px;border-radius:10px;background:#1e293b;border:1px solid #334155;color:#94a3b8;font-size:11.5px;text-align:center;">No open outbound drops for ' + rcDropEsc(activeLocationName) + '. Stage items into a manifest in Resale Command first.</div>';
    }
    if (m) {
      html += '<div style="display:flex;gap:6px;align-items:center;min-width:0;">' +
        '<select id="rc-drops-select" style="flex:1;min-width:0;background:#1e293b;color:#f8fafc;border:1px solid #38bdf8;border-radius:10px;padding:8px 10px;font-size:12px;font-weight:800;outline:none;">' +
        dropManifests.map((x) => '<option value="' + rcDropEsc(x.manifestId) + '"' + (x.manifestId === m.manifestId ? ' selected' : '') + '>📦 ' + rcDropEsc(x.name) + ' (' + x.items.length + ' items — ' + rcDropEsc(x.status) + ')</option>').join('') +
        '</select>' +
        '<button id="rc-drops-refresh-btn" type="button" title="Refresh drops from Resale Command" style="background:#1e293b;color:#38bdf8;border:1px solid #334155;border-radius:10px;padding:8px 11px;font-size:12px;font-weight:800;cursor:pointer;flex-shrink:0;">🔄</button>' +
        '</div>';
      const todo = m.items.filter((i) => !i.bound);
      const boundCount = m.items.length - todo.length;
      html += '<div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px;min-width:0;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">' +
          '<span style="font-size:11.5px;font-weight:800;color:#f8fafc;">📋 Pre-Flight Queue Preview</span>' +
          '<span style="font-size:10.5px;font-family:monospace;padding:2px 8px;border-radius:999px;background:rgba(56,189,248,0.16);color:#38bdf8;font-weight:800;">' + todo.length + ' Staged • ' + boundCount + ' Bound</span>' +
        '</div>' +
        '<div style="max-height:210px;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:6px;padding-right:2px;">' +
        m.items.map((i) => '<div style="padding:8px 10px;border-radius:9px;background:#0f172a;border:1px solid ' + (i.bound ? 'rgba(16,185,129,0.45)' : '#334155') + ';display:flex;flex-direction:column;gap:4px;min-width:0;">' +
          '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;min-width:0;">' +
            '<strong style="color:#f8fafc;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;" title="Thermal Tag Title (<=38 chars)">🏷️ ' + rcDropEsc(i.tagTitle || i.title) + '</strong>' +
            '<span style="color:#fbbf24;font-family:monospace;font-size:11.5px;font-weight:800;flex-shrink:0;">$' + Number(i.price || 0).toFixed(2) + '</span>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;gap:6px;align-items:center;font-family:monospace;font-size:10px;min-width:0;">' +
            '<span style="color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;" title="' + rcDropEsc(i.posDescription || i.title) + '">' + rcDropEsc(i.posDescription || i.title) + '</span>' +
            '<span style="padding:1px 6px;border-radius:5px;background:rgba(56,189,248,0.14);color:#38bdf8;font-weight:800;flex-shrink:0;">' + rcDropEsc(i.upc || 'NO UPC') + '</span>' +
            '<span style="padding:1px 6px;border-radius:5px;background:' + (i.bound ? 'rgba(16,185,129,0.18);color:#34d399;' : 'rgba(148,163,184,0.15);color:#cbd5e1;') + 'font-weight:800;flex-shrink:0;">' + (i.bound ? '✅ ' + rcDropEsc(i.locationSku) : '🕓 Staged') + '</span>' +
          '</div>' +
        '</div>').join('') +
        '</div></div>';
      const blocked = dropStatus.deploying || todo.length === 0 || todo.some((i) => !i.upc);
      html += '<button id="rc-drops-deploy-btn"' + (blocked ? ' disabled' : '') + ' style="background:' + (blocked ? '#334155' : 'linear-gradient(135deg,#10b981,#059669)') + ';color:' + (blocked ? '#94a3b8' : '#022c22') + ';border:none;border-radius:10px;padding:11px;font-weight:900;font-size:12.5px;cursor:' + (blocked ? 'not-allowed' : 'pointer') + ';box-shadow:' + (blocked ? 'none' : '0 4px 14px rgba(16,185,129,0.3)') + ';">' + (dropStatus.deploying ? '⏳ Deploying to Ricochet (' + dropStatus.done + '/' + dropStatus.total + ')...' : (todo.length === 0 ? '✅ All ' + m.items.length + ' Items Bound in Ricochet' : '🚀 Deploy Drop to Ricochet (' + todo.length + ')')) + '</button>';
      if (todo.some((i) => !i.upc)) html += '<div style="font-size:10.5px;color:#fbbf24;">⚠️ Some items have no HUCK-/PDXGL-/BB- barcode yet — assign barcodes in Resale Command first.</div>';
      if (dropStatus.deploying || dropStatus.total) {
        const pct = dropStatus.total ? Math.round((dropStatus.done / dropStatus.total) * 100) : 0;
        html += '<div style="font-size:11px;display:flex;justify-content:space-between;color:#cbd5e1;font-weight:700;"><span>Progress: ' + dropStatus.done + ' of ' + dropStatus.total + ' Bound</span><span>' + pct + '%</span></div>' +
          '<div style="width:100%;height:8px;background:#1e293b;border-radius:999px;overflow:hidden;"><div style="width:' + pct + '%;height:100%;background:linear-gradient(90deg,#10b981,#38bdf8);transition:width 0.25s ease;"></div></div>';
      }
      if (dropStatus.finished) {
        html += '<div style="padding:10px 12px;border-radius:10px;background:rgba(16,185,129,0.16);border:1px solid rgba(16,185,129,0.5);color:#a7f3d0;font-size:11.5px;font-weight:800;display:flex;justify-content:space-between;align-items:center;"><span>🎉 All ' + m.items.length + ' items deployed &amp; bound!</span><a href="' + origin + '/warehouse/sync/' + encodeURIComponent(activeLocationCode) + '" target="_blank" style="color:#38bdf8;text-decoration:none;">Open RC ➔</a></div>';
      }
    }
    view.innerHTML = html;
    const sel = document.getElementById('rc-drops-select');
    if (sel) sel.onchange = () => { dropSelectedId = sel.value; renderDropsView(); };
    const refBtn = document.getElementById('rc-drops-refresh-btn');
    if (refBtn) refBtn.onclick = () => { loadDrops(); };
    const btn = document.getElementById('rc-drops-deploy-btn');
    if (btn) btn.onclick = deployActiveDrop;
  }

  async function loadDrops() {
    dropStatus.loading = true;
    dropStatus.error = '';
    renderDropsView();
    try {
      const data = await rcDropApi('GET', '?mode=active_manifests&location=' + encodeURIComponent(activeLocationCode));
      dropManifests = data.manifests || [];
      if (!dropManifests.some((x) => x.manifestId === dropSelectedId)) dropSelectedId = dropManifests[0] ? dropManifests[0].manifestId : '';
    } catch (e) {
      dropStatus.error = '❌ Could not load drops: ' + (e && e.message ? e.message : e);
    }
    dropStatus.loading = false;
    renderDropsView();
  }

  async function deployActiveDrop() {
    const m = rcDropActiveManifest();
    if (!m || dropStatus.deploying) return;
    const todo = m.items.filter((i) => !i.bound && i.upc);
    dropStatus = { loading: false, deploying: true, done: 0, total: todo.length, error: '', finished: false };
    renderDropsView();
    try {
      for (let idx = 0; idx < todo.length; idx++) {
        const item = todo[idx];
        // 1. Fast 0ms duplicate guard: check in-memory catalogProducts first
        let sku = await findExistingRicochetSkuForDropItem(item, true);
        // 2. Otherwise create the product in Ricochet and extract its new 0EJ... SKU
        if (!sku) {
          const created = await rcCreateRicochetProduct(item);
          sku = rcDropSkuFromResponse(created) || (await findExistingRicochetSkuForDropItem(item, false));
        }
        if (!sku) {
          throw new Error('Ricochet created "' + (item.tagTitle || item.title) + '" but did not return its 0EJ SKU yet — click 🔄 and Deploy again to bind it.');
        }
        const res = await rcDropApi('POST', '', { mode: 'bind_skus', manifestId: m.manifestId, location: activeLocationCode, mappings: [{ itemId: item.itemId, locationSku: sku }] });
        if (res.rejected && res.rejected.length) throw new Error(res.rejected[0].reason);
        item.bound = true;
        item.locationSku = sku;
        dropStatus.done = idx + 1;
        renderDropsView();
      }
      dropStatus.finished = true;
      await loadConsignorCatalog();
    } catch (e) {
      dropStatus.error = '❌ ' + (e && e.message ? e.message : e);
    }
    dropStatus.deploying = false;
    renderDropsView();
  }

  function setDropsTabActive(active) {
    const btn = document.getElementById('rc-tab-btn-drops');
    const view = document.getElementById('rc-tab-view-drops');
    if (active) {
      activeModalTab = 'drops';
      document.querySelectorAll('[id^="rc-tab-view-"]').forEach((el) => { el.style.display = el.id === 'rc-tab-view-drops' ? 'flex' : 'none'; });
      document.querySelectorAll('[id^="rc-tab-btn-"]').forEach((el) => {
        const on = el.id === 'rc-tab-btn-drops';
        el.style.border = on ? '1px solid #38bdf8' : '1px solid #334155';
        el.style.background = on ? 'rgba(56, 189, 248, 0.18)' : '#1e293b';
        el.style.color = on ? '#f8fafc' : '#cbd5e1';
      });
      loadDrops();
    } else if (view) {
      view.style.display = 'none';
      if (btn) { btn.style.border = '1px solid #334155'; btn.style.background = '#1e293b'; btn.style.color = '#cbd5e1'; }
    }
  }

  function ensureDropsTab() {
    const salesBtn = document.getElementById('rc-tab-btn-sales');
    if (!salesBtn || document.getElementById('rc-tab-btn-drops')) return;
    const btn = salesBtn.cloneNode(false);
    btn.id = 'rc-tab-btn-drops';
    btn.innerHTML = '<span>🚚 New Drops</span><span id="rc-tab-drops-badge" style="background: rgba(56, 189, 248, 0.25); color: #7dd3fc; padding: 1px 6px; border-radius: 999px; font-size: 10px; font-family: monospace;">0</span>';
    salesBtn.parentNode.insertBefore(btn, salesBtn);
    salesBtn.parentNode.style.gridTemplateColumns = '1fr 1fr 1fr';
    const invView = document.getElementById('rc-tab-view-inventory');
    if (invView && !document.getElementById('rc-tab-view-drops')) {
      const view = document.createElement('div');
      view.id = 'rc-tab-view-drops';
      view.style.cssText = 'display: none; flex-direction: column; gap: 10px;';
      invView.parentNode.insertBefore(view, invView);
    }
    if (location.hash.indexOf('tab=drops') !== -1) setDropsTabActive(true);
  }

  if (window.__RC_DROPS_TAB_CLICK_HANDLER__) {
    document.removeEventListener('click', window.__RC_DROPS_TAB_CLICK_HANDLER__);
  }
  window.__RC_DROPS_TAB_CLICK_HANDLER__ = (e) => {
    const tabBtn = e.target && e.target.closest ? e.target.closest('[id^="rc-tab-btn-"]') : null;
    if (!tabBtn) return;
    setDropsTabActive(tabBtn.id === 'rc-tab-btn-drops');
  };
  document.addEventListener('click', window.__RC_DROPS_TAB_CLICK_HANDLER__);
  if (window.__RC_DROPS_MUTATION_OBSERVER__) {
    try { window.__RC_DROPS_MUTATION_OBSERVER__.disconnect(); } catch (e) {}
  }
  window.__RC_DROPS_MUTATION_OBSERVER__ = new MutationObserver(ensureDropsTab);
  window.__RC_DROPS_MUTATION_OBSERVER__.observe(document.documentElement, { childList: true, subtree: true });
  let activeSalesSubFilter = 'all'; // 'all' | 'pending_payout' | 'paid' | 'space_rental'
  let isPushingSales = false;
  let isHarvestingPayoutPages = false;
  let hasHarvestedPayoutPages = false;
  let harvestedPendingPayoutRows = [];
  let harvestedPaidHistoryRows = [];
  let cachedPayoutDomRows = [];
  let cachedPayoutHistoryDomRows = [];
  let spaceRentalAdjustments = [];
  let harvestedPendingTotalPayout = 0;
  let harvestedPaidHistoryTotalPayout = 0;
  let lastExtractedSalesRows = [];
  let capturedRawPayoutCsv = ''; // RAW Export CSV text captured in memory from the Payout tab
  let capturedRawPayoutHistoryCsv = ''; // RAW Export CSV text captured in memory from the Payout History tab
  let harvestedPaidHistoryPages = []; // [{ page, rows }] one entry per traversed "N out of M" Payout History page
  let alreadySyncedRicoKeys = new Set();
  let salesPushSuccessUrl = '';
  let isOpen = false;
  let isRunning = false;
  let isLoadingCatalog = false;
  let isFetchingCloudPayload = false;
  let modalLoaderStartedAt = 0;
  let modalLoaderTimer = null;
  let cloudLiveSyncedCount = 0;
  let consignorId = null;
  let catalogProducts = []; // Full product objects from /api/product
  let parsedMap = {}; // Runtime cloud SKU -> UPC map
  let skuMetaMap = {}; // Runtime cloud SKU -> metadata map
  let verifiedMdUpcMap = {}; // Persisted verified MD UPCs by SKU across page refreshes (localStorage + Appwrite cloud)
  let verifiedSkuSet = new Set(); // Full verified 808 SKU set from Location Settings / Bootstrap / Cloud
  let activePartnerBucket = 'ALL'; // 'ALL' | 'HUCK' | 'PDXGL' | 'BB'
  let activeSalesPartnerBucket = 'ALL'; // Sales tab Partner Payout Split: 'ALL' | 'HUCK' | 'PDXGL' | 'BB'
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
      <div id="rc-fab-bar" style="
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: linear-gradient(135deg, #312e81, #4f46e5, #6d28d9);
        color: #fff;
        border: 1px solid rgba(167, 139, 250, 0.45);
        border-radius: 9999px;
        padding: 6px 10px 6px 14px;
        box-shadow: 0 12px 28px rgba(15, 23, 42, 0.65);
      ">
        <button id="rc-sync-fab" type="button" style="
          background: transparent;
          color: #fff;
          border: none;
          padding: 3px 2px;
          font-weight: 800;
          font-size: 12.5px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          white-space: nowrap;
        ">
          <span>${rcDropEsc(activeBmlIcon)} ${rcDropEsc(activeLocationName)} Sync</span>
          <span id="rc-fab-auth" style="background:rgba(245,158,11,0.28);border:1px solid rgba(251,191,36,0.65);color:#fef08a;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:800;">🔐 Sign In</span>
          <span id="rc-fab-badge" style="background:rgba(15,23,42,0.45);border:1px solid rgba(255,255,255,0.2);padding:2px 8px;border-radius:999px;font-size:11px;font-family:monospace;">Ready</span>
        </button>
        <button id="rc-fab-logout" type="button" title="Log Out / Reset Bookmarklet Session" style="
          display: none;
          background: rgba(239, 68, 68, 0.24);
          border: 1px solid rgba(248, 113, 113, 0.55);
          color: #fecaca;
          border-radius: 9999px;
          padding: 3px 8px;
          font-size: 10.5px;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
        ">🚪 Log Out</button>
      </div>

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
        <div style="padding: 11px 14px; background: #1e293b; border-bottom: 1px solid #334155; display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <div style="font-weight: 800; font-size: 13.5px; color: #f8fafc; display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              <span style="overflow:hidden;text-overflow:ellipsis;">${rcDropEsc(activeBmlIcon)} ${rcDropEsc(activeHudTitle)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
              <button id="rc-refresh-cloud-btn" type="button" title="Refresh booth catalog & cloud tags" style="background:#334155;border:1px solid #475569;color:#f8fafc;font-size:11px;font-weight:800;padding:4px 9px;border-radius:7px;cursor:pointer;white-space:nowrap;">🔄 Refresh</button>
              <button id="rc-sync-close" type="button" title="Minimize to bottom pill" style="background:transparent;border:none;color:#94a3b8;font-size:18px;cursor:pointer;line-height:1;padding:2px 4px;">✕</button>
            </div>
          </div>
          <div style="font-size: 11px; color: #94a3b8; display: flex; align-items: center; justify-content: space-between; gap: 6px; flex-wrap: wrap;">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span id="rc-cloud-badge" style="font-size: 10px; background: #065f46; color: #6ee7b7; padding: 2px 7px; border-radius: 999px; font-weight: 800; white-space: nowrap;">✅ ${RC_SCRIPT_VERSION} Ready</span>
              <span id="rc-catalog-status" style="font-size:10.5px;color:#cbd5e1;font-weight:600;">Scanning booth catalog...</span>
            </div>
            <div style="display:flex;align-items:center;gap:4px;">
              <button id="rc-bml-member-btn" type="button" title="Works@TheHC Founder / Curator Session" style="background:rgba(124,58,237,0.22);border:1px solid rgba(167,139,250,0.45);color:#ddd6fe;font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;cursor:pointer;white-space:nowrap;">🔐 Sign In</button>
              <button id="rc-bml-logout-btn" type="button" title="Log Out / Reset Bookmarklet Session" style="display:none;background:rgba(239,68,68,0.18);border:1px solid rgba(248,113,113,0.45);color:#fca5a5;font-size:10px;font-weight:800;padding:2px 7px;border-radius:999px;cursor:pointer;white-space:nowrap;">🚪 Log Out</button>
            </div>
          </div>
        </div>

        <!-- 3-Tab Mode Switcher (🏷️ Booth Tags | 🚚 New Drops | 💰 Sales) -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 8px 14px; background: #0f172a; border-bottom: 1px solid #334155;">
          <button id="rc-tab-btn-inventory" type="button" style="
            padding: 7px 8px;
            border-radius: 8px;
            border: 1px solid #38bdf8;
            background: rgba(56, 189, 248, 0.18);
            color: #f8fafc;
            font-weight: 800;
            font-size: 11.5px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            white-space: nowrap;
          ">
            <span>🏷️ Booth Tags</span>
          </button>
          <button id="rc-tab-btn-sales" type="button" style="
            padding: 7px 8px;
            border-radius: 8px;
            border: 1px solid #334155;
            background: #1e293b;
            color: #cbd5e1;
            font-weight: 800;
            font-size: 11.5px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            white-space: nowrap;
          ">
            <span>💰 Sales</span>
            <span id="rc-tab-sales-badge" style="background: rgba(16, 185, 129, 0.25); color: #6ee7b7; padding: 1px 6px; border-radius: 999px; font-size: 10px; font-family: monospace;">0</span>
          </button>
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

          <!-- TAB 1: 📦 INVENTORY & UPC AUDIT -->
          <div id="rc-tab-view-inventory" style="display: flex; flex-direction: column; gap: 10px;">
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
                <span>🏷️ ${activeLocationName} Tag Health</span>
                <span id="rc-audit-total" style="font-family: monospace; color: #94a3b8;">0 items</span>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px;">
                <div title="Physical barcode in Ricochet matches The Works database" style="background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.3); border-radius: 8px; padding: 6px 8px; display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #34d399; font-weight: 700;">🟢 Tags Matched</span>
                  <strong id="rc-pill-verified" style="font-family: monospace; font-size: 13px; color: #34d399;">0</strong>
                </div>
                <div title="Item is blank in Ricochet and ready to fill with its barcode" style="background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.3); border-radius: 8px; padding: 6px 8px; display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #fbbf24; font-weight: 700;">🟡 Blank in Rico</span>
                  <strong id="rc-pill-missing" style="font-family: monospace; font-size: 13px; color: #fbbf24;">0</strong>
                </div>
                <div title="Ricochet has a different physical sticker than The Works database" style="background: rgba(249,115,22,0.12); border: 1px solid rgba(249,115,22,0.3); border-radius: 8px; padding: 6px 8px; display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #fb923c; font-weight: 700;">🟠 Tag Mismatch</span>
                  <strong id="rc-pill-mismatch" style="font-family: monospace; font-size: 13px; color: #fb923c;">0</strong>
                </div>
                <div title="Past/Sold booth items or new items not yet linked in The Works" style="background: rgba(148,163,184,0.12); border: 1px solid rgba(148,163,184,0.25); border-radius: 8px; padding: 6px 8px; display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #cbd5e1; font-weight: 700;">⚪ Sold / Past</span>
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
                  📋 Pre-Flight Queue Preview (0 Missing — 0 Overwrites)
                </summary>
                <div style="font-size: 10px; color: #94a3b8; margin-top: 4px; margin-bottom: 6px; line-height: 1.35;">
                  🛡️ <b>Physical Tag Guardrail:</b> Only items with a <b>BLANK</b> UPC in Ricochet are queued below. Existing Ricochet barcodes are never overwritten.<br/>
                  <span style="color:#34d399;">🏷️ Pre-Tagged</span> = Existing tag &nbsp;|&nbsp; <span style="color:#38bdf8;">🆕 Virtual (9740+)</span> = Created today
                </div>
                <div id="rc-preflight-list" style="max-height: 135px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; font-family: monospace; font-size: 10.5px;"></div>
              </details>

              <!-- Progress Bar -->
              <div id="rc-progress-wrap" style="display:none; flex-direction: column; gap: 4px; margin-top: 8px;">
                <div style="display:flex;justify-content:space-between;font-size:11px;">
                  <span id="rc-progress-text">Syncing...</span>
                  <span id="rc-progress-pct">0%</span>
                </div>
                <div style="width:100%;height:8px;background:#0f172a;border-radius:999px;overflow:hidden;">
                  <div id="rc-progress-bar" style="width:0%;height:100%;background:linear-gradient(90deg,#10b981,#3b82f6);transition:width 0.2s;"></div>
                </div>
              </div>

              <!-- Primary Reseller Action Bar (Always Visible Without Scrolling Past Logs) -->
              <div style="display: flex; gap: 6px; margin-top: 10px;">
                <button id="rc-send-report-btn" type="button" style="
                  flex: 1;
                  background: #0284c7;
                  color: #fff;
                  border: none;
                  border-radius: 8px;
                  padding: 9px 8px;
                  font-weight: 800;
                  font-size: 11.5px;
                  cursor: pointer;
                ">📡 Sync to The Works</button>
                <button id="rc-sync-start-btn" type="button" style="
                  flex: 1.25;
                  background: #10b981;
                  color: #022c22;
                  border: none;
                  border-radius: 8px;
                  padding: 9px 8px;
                  font-weight: 800;
                  font-size: 11.5px;
                  cursor: pointer;
                ">🚀 Fill Missing (0)</button>
              </div>
              <div style="display: flex; gap: 6px; margin-top: 6px;">
                <button id="rc-sync-test-btn" type="button" style="
                  flex: 1;
                  background: #334155;
                  color: #f8fafc;
                  border: 1px solid #475569;
                  border-radius: 7px;
                  padding: 6px 8px;
                  font-weight: 700;
                  font-size: 11px;
                  cursor: pointer;
                ">🧪 Test 1 Blank</button>
                <button id="rc-download-csv-btn" type="button" style="
                  flex: 1;
                  background: #334155;
                  color: #f8fafc;
                  border: 1px solid #475569;
                  border-radius: 7px;
                  padding: 6px 8px;
                  font-weight: 700;
                  font-size: 11px;
                  cursor: pointer;
                ">📥 Download CSV</button>
              </div>
            </div>

            <!-- Collapsed Advanced Payload & Activity Log Accordion (Hidden from Low-Tech View by Default) -->
            <details style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 6px 10px;">
              <summary style="font-size: 10.5px; font-weight: 700; color: #94a3b8; cursor: pointer;">
                🛠️ Advanced Payload &amp; Activity Log (<span id="rc-match-count">0 ready</span>)
              </summary>
              <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 6px;">
                <textarea id="rc-sync-textarea" placeholder='{"0EJ08G": "HUCK-1024"}' style="
                  width: 100%;
                  height: 60px;
                  background: #0f172a;
                  color: #38bdf8;
                  border: 1px solid #334155;
                  border-radius: 6px;
                  padding: 6px;
                  font-family: monospace;
                  font-size: 10.5px;
                  resize: vertical;
                  box-sizing: border-box;
                "></textarea>
                <div id="rc-booth-log" style="display:none;"></div>
                <div id="rc-sync-logs" style="
                  background: #020617;
                  border: 1px solid #1e293b;
                  border-radius: 6px;
                  padding: 6px;
                  height: 75px;
                  overflow-y: auto;
                  font-family: monospace;
                  font-size: 10.5px;
                  color: #cbd5e1;
                  display: flex;
                  flex-direction: column;
                  gap: 2px;
                ">
                  <div style="color:#64748b;">Ready.</div>
                </div>
              </div>
            </details>
          </div>

          <!-- TAB 2: 💰 SALES & PAYOUT SYNC -->
          <div id="rc-tab-view-sales" style="display: none; flex-direction: column; gap: 10px;">
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: 6px; flex-wrap: wrap;">
                <span style="font-size: 11px; font-weight: 800; color: #cbd5e1;">💰 Live ${activeLocationName} Sales &amp; Payout Extractor</span>
                <div style="display: flex; align-items: center; gap: 5px;">
                  <span style="font-size: 10px; font-family: monospace; color: #38bdf8; background: rgba(56,189,248,0.14); padding: 2px 6px; border-radius: 999px;">
                    Fee: ${activeCommissionRate}% | Rent: $${activeMonthlyRent.toFixed(2)}
                  </span>
                  <button id="rc-harvest-payouts-btn" type="button" title="Re-harvest /payouts & /payout_history" style="background:#334155;border:none;color:#e2e8f0;font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;cursor:pointer;">🔄 Harvest</button>
                </div>
              </div>
              <div id="rc-sales-xhr-subtitle" style="font-size: 9.5px; font-family: monospace; color: #94a3b8; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">📡 XHR: /api/product • SPA Payout &amp; Payout History</div>

              <!-- Partner Payout Split Pills (All Booth | ⭐ HUCK | 🎲 PDXGL | 💛 B&B) -->
              <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Partner Payout Split</div>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px; margin-bottom: 8px;">
                <button type="button" data-rc-sales-bucket="ALL" class="rc-sales-bucket-btn" style="padding: 5px 6px; border-radius: 7px; border: 1px solid #38bdf8; background: rgba(56,189,248,0.16); color: #f8fafc; font-weight: 800; font-size: 10.5px; cursor: pointer; text-align: left;">
                  <div>All Booth</div><div id="rc-sbkt-ALL" style="font-family: monospace; font-size: 10px; opacity: 0.9;">0 • $0.00</div>
                </button>
                <button type="button" data-rc-sales-bucket="HUCK" class="rc-sales-bucket-btn" style="padding: 5px 6px; border-radius: 7px; border: 1px solid #334155; background: #0f172a; color: #cbd5e1; font-weight: 800; font-size: 10.5px; cursor: pointer; text-align: left;">
                  <div>⭐ HUCK</div><div id="rc-sbkt-HUCK" style="font-family: monospace; font-size: 10px; opacity: 0.9;">0 • $0.00</div>
                </button>
                <button type="button" data-rc-sales-bucket="PDXGL" class="rc-sales-bucket-btn" style="padding: 5px 6px; border-radius: 7px; border: 1px solid #334155; background: #0f172a; color: #cbd5e1; font-weight: 800; font-size: 10.5px; cursor: pointer; text-align: left;">
                  <div>🎲 PDXGL</div><div id="rc-sbkt-PDXGL" style="font-family: monospace; font-size: 10px; opacity: 0.9;">0 • $0.00</div>
                </button>
                <button type="button" data-rc-sales-bucket="BB" class="rc-sales-bucket-btn" style="padding: 5px 6px; border-radius: 7px; border: 1px solid #334155; background: #0f172a; color: #cbd5e1; font-weight: 800; font-size: 10.5px; cursor: pointer; text-align: left;">
                  <div>💛 B&amp;B</div><div id="rc-sbkt-BB" style="font-family: monospace; font-size: 10px; opacity: 0.9;">0 • $0.00</div>
                </button>
              </div>

              <!-- Sub-Filter Pills Inside 💰 Sales & Payout Sync Modal Tab -->
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px; margin-bottom: 8px;">
                <button type="button" data-rc-sales-filter="all" class="rc-sales-filter-btn" style="padding: 5px 6px; border-radius: 7px; border: 1px solid #38bdf8; background: rgba(56,189,248,0.16); color: #f8fafc; font-weight: 800; font-size: 10.5px; cursor: pointer; text-align: left; display: flex; justify-content: space-between; align-items: center;">
                  <span>All Sold</span>
                  <span id="rc-sflt-all" style="font-family: monospace; opacity: 0.9;">0</span>
                </button>
                <button type="button" data-rc-sales-filter="pending_payout" class="rc-sales-filter-btn" style="padding: 5px 6px; border-radius: 7px; border: 1px solid #334155; background: #0f172a; color: #cbd5e1; font-weight: 800; font-size: 10.5px; cursor: pointer; text-align: left; display: flex; justify-content: space-between; align-items: center;">
                  <span>⏳ Pending (/payouts)</span>
                  <span id="rc-sflt-pending" style="font-family: monospace; opacity: 0.9;">0</span>
                </button>
                <button type="button" data-rc-sales-filter="paid" class="rc-sales-filter-btn" style="padding: 5px 6px; border-radius: 7px; border: 1px solid #334155; background: #0f172a; color: #cbd5e1; font-weight: 800; font-size: 10.5px; cursor: pointer; text-align: left; display: flex; justify-content: space-between; align-items: center;">
                  <span>✅ Paid (/payout_history)</span>
                  <span id="rc-sflt-paid" style="font-family: monospace; opacity: 0.9;">0</span>
                </button>
                <button type="button" data-rc-sales-filter="space_rental" class="rc-sales-filter-btn" style="padding: 5px 6px; border-radius: 7px; border: 1px solid #334155; background: #0f172a; color: #cbd5e1; font-weight: 800; font-size: 10.5px; cursor: pointer; text-align: left; display: flex; justify-content: space-between; align-items: center;">
                  <span>🏢 Space Rental &amp; Credits</span>
                  <span id="rc-sflt-rent" style="font-family: monospace; opacity: 0.9;">0</span>
                </button>
              </div>

              <!-- 5 Live Sales KPI Pills (Pending Payout, Space Rental / Credits, Paid History, Matched in Booth, Unmatched) -->
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; font-size: 10.5px; margin-bottom: 6px;">
                <div style="background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.3); border-radius: 8px; padding: 6px 8px;">
                  <div style="color: #fbbf24; font-weight: 700;">Pending Payout ($)</div>
                  <strong id="rc-sales-kpi-pending" style="font-family: monospace; font-size: 12.5px; color: #fde68a;">$0.00</strong>
                </div>
                <div style="background: rgba(244,63,94,0.12); border: 1px solid rgba(244,63,94,0.3); border-radius: 8px; padding: 6px 8px;">
                  <div style="color: #fda4af; font-weight: 700;">Space Rental / Credits</div>
                  <strong id="rc-sales-kpi-rent" style="font-family: monospace; font-size: 12.5px; color: #fecdd3;">$0.00</strong>
                </div>
                <div style="background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.3); border-radius: 8px; padding: 6px 8px;">
                  <div style="color: #34d399; font-weight: 700;">Paid History ($)</div>
                  <strong id="rc-sales-kpi-paid" style="font-family: monospace; font-size: 12.5px; color: #6ee7b7;">$0.00</strong>
                </div>
              </div>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; font-size: 10.5px;">
                <div style="background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.25); border-radius: 8px; padding: 6px 8px; display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #7dd3fc; font-weight: 700;">Sold Found</span>
                  <strong id="rc-sales-kpi-found" style="font-family: monospace; font-size: 12px; color: #f8fafc;">0</strong>
                </div>
                <div style="background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25); border-radius: 8px; padding: 6px 8px; display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #6ee7b7; font-weight: 700;">🔗 Matched</span>
                  <strong id="rc-sales-kpi-matched" style="font-family: monospace; font-size: 12px; color: #34d399;">0</strong>
                </div>
                <div style="background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.28); border-radius: 8px; padding: 6px 8px; display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #fde68a; font-weight: 700;">⚪ Unmatched</span>
                  <strong id="rc-sales-kpi-unmatched" style="font-family: monospace; font-size: 12px; color: #fbbf24;">0</strong>
                </div>
              </div>
              <div style="display:none;">
                <span id="rc-sales-kpi-gross">$0.00</span>
                <span id="rc-sales-kpi-net">$0.00</span>
                <span id="rc-sales-kpi-synced">0</span>
              </div>
            </div>

            <!-- Success Banner with ↗ Open Sales Reconciler Link -->
            <div id="rc-sales-sync-banner" style="display: none; padding: 10px 12px; border-radius: 9px; background: rgba(16,185,129,0.18); border: 1px solid #10b981; color: #ecfdf5; font-size: 11px; line-height: 1.45;"></div>

            <!-- Scrollable Sold Lines Preview -->
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 8px;">
              <div style="font-size: 10.5px; font-weight: 800; color: #94a3b8; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
                <span id="rc-sales-preview-title">Extracted Sold &amp; Payout Lines (0EJ... SKU Cross-Linked)</span>
                <span id="rc-sales-preview-count" style="font-family: monospace; color: #38bdf8;">0 lines</span>
              </div>
              <div id="rc-sales-preview-list" style="max-height: 175px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; font-family: monospace; font-size: 10.5px;">
                <div style="color: #64748b; padding: 6px;">Harvesting /payouts, /payout_history &amp; /api/product...</div>
              </div>
            </div>

            <!-- Primary Sales Sync Action Buttons (Default Dry-Run Stage) -->
            <div style="display: flex; gap: 8px;">
              <button id="rc-push-sales-btn" type="button" style="
                flex: 2;
                background: linear-gradient(135deg, #10b981, #059669);
                color: #022c22;
                border: none;
                border-radius: 8px;
                padding: 10px;
                font-weight: 800;
                font-size: 12px;
                cursor: pointer;
              ">🧪 Stage Sales to Resale Core (Dry-Run)</button>
              <button id="rc-copy-sales-json-btn" type="button" style="
                flex: 1;
                background: #334155;
                color: #f8fafc;
                border: 1px solid #475569;
                border-radius: 8px;
                padding: 10px;
                font-weight: 700;
                font-size: 11.5px;
                cursor: pointer;
              ">📋 Copy Sales Sync JSON</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    document.getElementById('rc-sync-fab').addEventListener('click', () => {
      const sess = getBmlMemberSession();
      if (!sess) {
        window.__RC_OPEN_PANEL_AFTER_AUTH__ = true;
        if (window.__RC_BML_AUTH__ && typeof window.__RC_BML_AUTH__.openConnectFlow === 'function') {
          window.__RC_BML_AUTH__.openConnectFlow();
        }
        return;
      }
      togglePanel();
    });
    document.getElementById('rc-sync-close').addEventListener('click', togglePanel);
    document.getElementById('rc-sync-textarea').addEventListener('input', parseInputPayload);
    document.getElementById('rc-sync-test-btn').addEventListener('click', () => runBatchSync(true));
    document.getElementById('rc-sync-start-btn').addEventListener('click', () => runBatchSync(false));
    document.getElementById('rc-send-report-btn').addEventListener('click', () => sendReportToResaleCommand(false));
    document.getElementById('rc-download-csv-btn').addEventListener('click', downloadVerificationCsv);
    document.getElementById('rc-refresh-cloud-btn').addEventListener('click', () => {
      fetchLivePayloadFromCloud(true);
      harvestLiveSpaPayoutTables(true);
    });
    const refreshMemberBtnState = () => {
      const mBtn = document.getElementById('rc-bml-member-btn');
      const mOutBtn = document.getElementById('rc-bml-logout-btn');
      const fabAuth = document.getElementById('rc-fab-auth');
      const fabLogout = document.getElementById('rc-fab-logout');
      const sess = getBmlMemberSession();
      const roleIcon = sess && sess.role === 'curator' ? '💎' : '👑';
      if (mBtn) {
        if (sess) {
          mBtn.textContent = `${roleIcon} ${sess.name || 'Member'} (${sess.prefix || 'HUCK-'})`;
          mBtn.style.background = 'rgba(16,185,129,0.2)';
          mBtn.style.borderColor = 'rgba(52,211,153,0.45)';
          mBtn.style.color = '#6ee7b7';
        } else {
          mBtn.textContent = '🔐 Sign In';
          mBtn.style.background = 'rgba(245,158,11,0.22)';
          mBtn.style.borderColor = 'rgba(251,191,36,0.5)';
          mBtn.style.color = '#fde68a';
        }
      }
      if (mOutBtn) {
        mOutBtn.style.display = sess ? 'inline-block' : 'none';
      }
      if (fabAuth) {
        if (sess) {
          fabAuth.textContent = `${roleIcon} ${sess.name || 'Member'}`;
          fabAuth.style.background = 'rgba(16,185,129,0.28)';
          fabAuth.style.borderColor = 'rgba(52,211,153,0.6)';
          fabAuth.style.color = '#a7f3d0';
        } else {
          fabAuth.textContent = '🔐 Sign In';
          fabAuth.style.background = 'rgba(245,158,11,0.28)';
          fabAuth.style.borderColor = 'rgba(251,191,36,0.65)';
          fabAuth.style.color = '#fef08a';
        }
      }
      if (fabLogout) {
        fabLogout.style.display = sess ? 'inline-block' : 'none';
      }
    };
    const disconnectBmlMember = (ev) => {
      if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
      if (window.__RC_BML_AUTH__ && typeof window.__RC_BML_AUTH__.clearSession === 'function') {
        window.__RC_BML_AUTH__.clearSession();
      }
      parsedMap = {};
      skuMetaMap = {};
      verifiedSkuSet.clear();
      cloudLiveSyncedCount = 0;
      const ta = document.getElementById('rc-sync-textarea');
      if (ta) ta.value = '';
      if (isOpen) {
        isOpen = false;
        const panel = document.getElementById('rc-sync-panel');
        if (panel) panel.style.display = 'none';
      }
      refreshMemberBtnState();
      updateUI();
    };
    const memberBtn = document.getElementById('rc-bml-member-btn');
    if (memberBtn) {
      memberBtn.addEventListener('click', () => {
        if (window.__RC_BML_AUTH__ && typeof window.__RC_BML_AUTH__.openConnectFlow === 'function') {
          window.__RC_BML_AUTH__.openConnectFlow();
        }
      });
    }
    const headerLogoutBtn = document.getElementById('rc-bml-logout-btn');
    if (headerLogoutBtn) {
      headerLogoutBtn.addEventListener('click', disconnectBmlMember);
    }
    const fabLogoutBtn = document.getElementById('rc-fab-logout');
    if (fabLogoutBtn) {
      fabLogoutBtn.addEventListener('click', disconnectBmlMember);
    }
    window.addEventListener('rc-bml-authenticated', refreshMemberBtnState);
    window.addEventListener('rc-bml-cleared', refreshMemberBtnState);
    refreshMemberBtnState();
    document.getElementById('rc-tab-btn-inventory').addEventListener('click', () => switchModalTab('inventory'));
    document.getElementById('rc-tab-btn-sales').addEventListener('click', () => switchModalTab('sales'));
    document.getElementById('rc-push-sales-btn').addEventListener('click', () => pushSalesToResaleCore({ silent: false }));
    document.getElementById('rc-copy-sales-json-btn').addEventListener('click', copySalesSyncJson);
    const harvestBtn = document.getElementById('rc-harvest-payouts-btn');
    if (harvestBtn) {
      harvestBtn.addEventListener('click', () => harvestLiveSpaPayoutTables(true));
    }

    const salesFilterBtns = root.querySelectorAll('.rc-sales-filter-btn');
    salesFilterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        activeSalesSubFilter = btn.getAttribute('data-rc-sales-filter') || 'all';
        updateSalesSyncTabUI();
      });
    });

    const salesBucketBtns = root.querySelectorAll('.rc-sales-bucket-btn');
    salesBucketBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        activeSalesPartnerBucket = btn.getAttribute('data-rc-sales-bucket') || 'ALL';
        updateSalesSyncTabUI();
      });
    });

    // Partner Bucket Selector Listeners
    const bucketBtns = root.querySelectorAll('.rc-bucket-btn');
    bucketBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const bkt = btn.getAttribute('data-rc-bucket') || 'ALL';
        activePartnerBucket = bkt;
        updateUI();
      });
    });

    // Keep modal CLOSED by default on load — bottom-right pill shows Login Status + Counts until clicked!
    hydratePreloadedBarcodes(false);
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

  // Evergreen Live Cloud Fetch from /api/md-verify-report?mode=payload
  async function fetchLivePayloadFromCloud(manualTrigger = false, forceBypassCooldown = false) {
    if (isFetchingCloudPayload) return false;
    const activeSession = getBmlMemberSession();
    const cloudBadge = document.getElementById('rc-cloud-badge');
    if (!activeSession) {
      if (cloudBadge) {
        cloudBadge.textContent = '🔐 Sign In Required';
        cloudBadge.style.background = '#78350f';
        cloudBadge.style.color = '#fde68a';
        cloudBadge.style.cursor = 'pointer';
        cloudBadge.onclick = () => {
          if (window.__RC_BML_AUTH__ && typeof window.__RC_BML_AUTH__.openConnectFlow === 'function') {
            window.__RC_BML_AUTH__.openConnectFlow();
          }
        };
      }
      updateUI();
      hideModalLoaderAfterMinDuration();
      return false;
    }
    if (!manualTrigger && !forceBypassCooldown && lastCloudFetchAt > 0 && Date.now() - lastCloudFetchAt < CLOUD_FETCH_COOLDOWN_MS) {
      return true;
    }
    if (manualTrigger || isOpen) {
      showModalLoader(`⏳ Auditing ${activeLocationName} Catalog...`);
    }
    isFetchingCloudPayload = true;
    lastCloudFetchAt = Date.now();
    if (cloudBadge) {
      cloudBadge.textContent = '⏳ Syncing Live Cloud...';
      cloudBadge.style.background = '#1e3a8a';
      cloudBadge.style.color = '#93c5fd';
    }

    const mergedCloudSkuToUpc = {};
    const mergedCloudMeta = {};
    const mergedVerifiedBySku = {};
    let bestEndpointData = null;
    let sawAuthRequired = false;

    // Also pull the full 808-item persisted report (`?mode=report` / default GET) and merge with `?mode=payload`
    // so all 501 In-Stock + 307 Sold/Historical + 83 Partner items are guaranteed present!
    for (const baseEndpoint of RC_REPORT_ENDPOINTS) {
      try {
        const locQuery = `location=${encodeURIComponent(activeLocationCode)}`;
        const [payloadRes, reportRes] = await Promise.all([
          fetch(`${baseEndpoint}?mode=payload&${locQuery}&t=${Date.now()}`, { method: 'GET', mode: 'cors' }).catch(() => null),
          fetch(`${baseEndpoint}?${locQuery}&t=${Date.now()}`, { method: 'GET', mode: 'cors' }).catch(() => null),
        ]);
        if (
          (payloadRes && (payloadRes.status === 401 || payloadRes.status === 403)) ||
          (reportRes && (reportRes.status === 401 || reportRes.status === 403))
        ) {
          sawAuthRequired = true;
          break;
        }

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
              const invStr = String(r.inventory || '').toLowerCase();
              const isSoldStatus = invStr.includes('sold') || invStr.includes('paid') || Number(r.quantity ?? 1) === 0;
              if (targetUpc && isRealUpc(targetUpc)) {
                mergedCloudSkuToUpc[rSku] = targetUpc;
              }
              mergedCloudMeta[rSku] = {
                upc: targetUpc && isRealUpc(targetUpc) ? targetUpc : '',
                partner: r.partner || resolvePartnerBucket(rSku, targetUpc, rUpc, r.name || ''),
                title: String(r.name || ''),
                price: Number(r.agreedPrice || 0),
                soldDate: cleanStr(r.soldDate || r.paidDate || ''),
                status: isSoldStatus ? 'sold' : 'placed',
              };
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

    const combinedPrioritized = {};
    for (const [k, v] of Object.entries(mergedCloudSkuToUpc)) {
      combinedPrioritized[k] = v;
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
        cloudBadge.textContent = `✅ ${RC_SCRIPT_VERSION} Live Auto-Updated (${cloudLiveSyncedCount})`;
        cloudBadge.style.background = '#065f46';
        cloudBadge.style.color = '#6ee7b7';
      }
      if (manualTrigger || prevCount !== cloudLiveSyncedCount) {
        addLog(`☁️ Live-fetched ${cloudLiveSyncedCount} active barcodes from Resale Command!`, '#38bdf8');
      }
      if (manualTrigger) {
        setStatusBanner(
          'success',
          `✅ ${RC_SCRIPT_VERSION} Live Auto-Updated Script: Fetched ${cloudLiveSyncedCount} live barcodes from Resale Command!`
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
      if (sawAuthRequired && fallbackCount === 0) {
        cloudBadge.textContent = '🔐 Sign In Required';
        cloudBadge.style.background = '#78350f';
        cloudBadge.style.color = '#fde68a';
        cloudBadge.style.cursor = 'pointer';
        cloudBadge.onclick = () => {
          if (window.__RC_BML_AUTH__ && typeof window.__RC_BML_AUTH__.openConnectFlow === 'function') {
            window.__RC_BML_AUTH__.openConnectFlow();
          }
        };
      } else {
        cloudBadge.textContent = fallbackCount > 0 ? `✅ ${RC_SCRIPT_VERSION} Live Auto-Updated (${fallbackCount})` : '⚠️ Offline';
        cloudBadge.style.background = '#78350f';
        cloudBadge.style.color = '#fde68a';
      }
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
    if (!isOpen && window.__RC_OPEN_PANEL_AFTER_AUTH__) {
      window.__RC_OPEN_PANEL_AFTER_AUTH__ = false;
      togglePanel();
      return;
    }
    if (isOpen) {
      showModalLoader(`⏳ Auditing ${activeLocationName} Catalog...`);
    }
    fetchLivePayloadFromCloud(true, true);
    harvestLiveSpaPayoutTables(false);
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
        if (!hasHarvestedPayoutPages && !isHarvestingPayoutPages) {
          harvestLiveSpaPayoutTables(false);
        }
        hideModalLoaderAfterMinDuration();
      }
    }
  }

  function addLog(msg, color = '#cbd5e1') {
    logs.push({ msg, color });
    const html = logs
      .slice(-80)
      .map((l) => `<div style="color:${l.color};">${l.msg}</div>`)
      .join('');
    const container = document.getElementById('rc-sync-logs');
    if (container) {
      container.innerHTML = html;
      container.scrollTop = container.scrollHeight;
    }
    const boothLog = document.getElementById('rc-booth-log');
    if (boothLog) {
      boothLog.innerHTML = html;
    }
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
      await harvestLiveSpaPayoutTables(false);
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
      const expectedRcUpc = cleanStr(
        parsedMap[sku] || (skuMetaMap[sku] && skuMetaMap[sku].upc) || verifiedMdUpcMap[sku] || ''
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

      const rawSoldDate = cleanStr(
        p.sold_date ||
          p.sold_at ||
          p.paid_date ||
          firstItem?.sold_date ||
          firstItem?.sold_at ||
          firstItem?.paid_date ||
          p.updated_at ||
          firstItem?.updated_at ||
          p.in_stock ||
          p.created_at ||
          ''
      ).slice(0, 10);
      const rawPaidDate = cleanStr(
        p.paid_date || firstItem?.paid_date || (inventoryStatus === 'Paid' ? rawSoldDate : '') || ''
      ).slice(0, 10);

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
        soldDate: rawSoldDate,
        paidDate: rawPaidDate || null,
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
    const sess = getBmlMemberSession();
    const cloudBadge = document.getElementById('rc-cloud-badge');
    if (cloudBadge && !isFetchingCloudPayload) {
      if (sess && totalMapped > 0) {
        cloudBadge.textContent = `✅ ${totalMapped} Cloud Tags`;
        cloudBadge.style.background = '#065f46';
        cloudBadge.style.color = '#6ee7b7';
      } else if (!sess) {
        cloudBadge.textContent = '🔐 Sign In Required';
        cloudBadge.style.background = '#78350f';
        cloudBadge.style.color = '#fde68a';
      }
    }
    const statusEl = document.getElementById('rc-catalog-status');
    if (statusEl && catalogProducts.length > 0 && !isLoadingCatalog) {
      statusEl.textContent = `✅ ${catalogProducts.length} Booth Items Ready`;
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
      testBtn.textContent = `🧪 Test 1 Blank${partnerSuffix}`;
    }
    const fabAuth = document.getElementById('rc-fab-auth');
    const fabLogout = document.getElementById('rc-fab-logout');
    const roleIcon = sess && sess.role === 'curator' ? '💎' : '👑';
    if (fabAuth) {
      if (sess) {
        fabAuth.textContent = `${roleIcon} ${sess.name || 'Member'}`;
        fabAuth.style.background = 'rgba(16,185,129,0.28)';
        fabAuth.style.borderColor = 'rgba(52,211,153,0.6)';
        fabAuth.style.color = '#a7f3d0';
      } else {
        fabAuth.textContent = '🔐 Sign In';
        fabAuth.style.background = 'rgba(245,158,11,0.28)';
        fabAuth.style.borderColor = 'rgba(251,191,36,0.65)';
        fabAuth.style.color = '#fef08a';
      }
    }
    if (fabLogout) {
      fabLogout.style.display = sess ? 'inline-block' : 'none';
    }
    if (fabBadge) {
      if (!sess) {
        fabBadge.textContent =
          catalogProducts.length > 0 ? `${catalogProducts.length} Booth Items` : 'Click to Sign In';
      } else {
        const fixHint = mismatchUpc > 0 ? ` • 🟠 ${mismatchUpc} Fix` : '';
        fabBadge.textContent =
          catalogProducts.length > 0
            ? `${verifiedMatch}/${totalCatalog} Matched${fixHint}`
            : `${totalMapped} Ready`;
      }
    }

    updateSalesSyncTabUI();
  }

  // Switch between Tab 1 (📦 Inventory & UPC Audit) and Tab 2 (💰 Sales & Payout Sync)
  function switchModalTab(tabName) {
    activeModalTab = tabName === 'sales' ? 'sales' : 'inventory';
    const invView = document.getElementById('rc-tab-view-inventory');
    const salesView = document.getElementById('rc-tab-view-sales');
    const invBtn = document.getElementById('rc-tab-btn-inventory');
    const salesBtn = document.getElementById('rc-tab-btn-sales');

    if (invView) invView.style.display = activeModalTab === 'inventory' ? 'flex' : 'none';
    if (salesView) salesView.style.display = activeModalTab === 'sales' ? 'flex' : 'none';

    if (invBtn) {
      invBtn.style.border = activeModalTab === 'inventory' ? '1px solid #38bdf8' : '1px solid #334155';
      invBtn.style.background = activeModalTab === 'inventory' ? 'rgba(56, 189, 248, 0.18)' : '#1e293b';
      invBtn.style.color = activeModalTab === 'inventory' ? '#f8fafc' : '#cbd5e1';
    }
    if (salesBtn) {
      salesBtn.style.border = activeModalTab === 'sales' ? '1px solid #10b981' : '1px solid #334155';
      salesBtn.style.background = activeModalTab === 'sales' ? 'rgba(16, 185, 129, 0.18)' : '#1e293b';
      salesBtn.style.color = activeModalTab === 'sales' ? '#f8fafc' : '#cbd5e1';
    }

    if (activeModalTab === 'sales') {
      if (!hasHarvestedPayoutPages && !isHarvestingPayoutPages) {
        harvestLiveSpaPayoutTables(false);
      }
      updateSalesSyncTabUI();
    }
  }

  function normalizeTitleKey(str) {
    return cleanStr(str)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function parseCurrencyFloat(val) {
    const raw = cleanStr(val);
    if (!raw) return 0;
    const isNeg = raw.includes('-') || /^\(.*\)$/.test(raw);
    const num = parseFloat(raw.replace(/[^0-9.]/g, '')) || 0;
    return isNeg ? -Math.abs(num) : num;
  }

  function collectTableHeaders(doc, table) {
    const localThs = Array.from(table.querySelectorAll('thead th, tr:first-child th, tr:first-child td')).map((el) =>
      cleanStr(el.textContent).toLowerCase()
    );
    if (localThs.some((h) => h.length > 0)) {
      return localThs;
    }
    const wrapper = table.closest && table.closest('.dataTables_wrapper, .table-responsive, .card');
    const scopedThs = wrapper
      ? Array.from(wrapper.querySelectorAll('thead th, .dataTables_scrollHead th')).map((el) =>
          cleanStr(el.textContent).toLowerCase()
        )
      : [];
    return scopedThs;
  }

  // Guard against scraping Ricochet's `Inventory` DOM table (`Name`, `Category`, `Price`, `Qty`, `Consignor`, `Status`)
  function isInventoryDomTable(thTexts) {
    if (!Array.isArray(thTexts) || thTexts.length === 0) return false;
    return thTexts.some(
      (h) =>
        h === 'name' ||
        h === 'category' ||
        h === 'qty' ||
        h === 'quantity' ||
        h === 'consignor' ||
        h === 'status' ||
        h.includes('in stock') ||
        h.includes('upc') ||
        h.includes('barcode')
    );
  }

  // Guard against rows where the `Sale #` column is a non-numeric product name or Inventory Qty/Price columns leaked
  function isBogusInventoryDomRow(rawTitle, rawSku, rawSale, grossPrice, splitPct) {
    const cleanSale = cleanStr(rawSale).replace(/^#/, '').trim();
    const titleStr = cleanStr(rawTitle);
    const skuStr = cleanStr(rawSku).toUpperCase();
    const isGenericTitle = !titleStr || /^booth\s+sale\s+item$/i.test(titleStr);
    if (cleanSale && !/^\d{3,10}$/.test(cleanSale)) {
      if (isGenericTitle || /[a-z]{3,}/i.test(cleanSale)) {
        return true;
      }
    }
    const splitStr = cleanStr(splitPct);
    const splitNum = parseFloat(splitStr.replace(/[^0-9.]/g, '')) || 0;
    const isWeirdSplit =
      splitStr.startsWith('$') ||
      (splitNum > 20 && Math.abs(splitNum - 85) > 0.5 && Math.abs(splitNum - 90) > 0.5 && Math.abs(splitNum - 70) > 0.5);
    if ((grossPrice === 0 || grossPrice === 1) && !/^0EJ[A-Z0-9]+$/i.test(skuStr) && (isGenericTitle || isWeirdSplit)) {
      return true;
    }
    return false;
  }

  // Parse `/payouts` (Current Unpaid Payout) 9-column HTML table:
  // [Item, SKU, Sale, Agreed, Cost/Split, Aged Price, Discounts, Sold, Amount]
  function parsePayoutsHtmlDocument(doc) {
    const rows = [];
    const adjustments = [];
    let totalPayout = 0;
    if (!doc) return { rows, adjustments, totalPayout };

    const tables = Array.from(doc.querySelectorAll('table'));
    for (const table of tables) {
      if (table.closest && table.closest('#rc-ricochet-sync-root')) continue;
      const thTexts = collectTableHeaders(doc, table);
      const hasPaidHeader = thTexts.some((h) => h === 'paid' || h.startsWith('paid'));
      if (hasPaidHeader || isInventoryDomTable(thTexts)) continue;

      const trs = Array.from(table.querySelectorAll('tbody tr, tr'));
      for (const tr of trs) {
        if (tr.querySelector('th')) continue;
        const cells = Array.from(tr.querySelectorAll('td')).map((td) => cleanStr(td.textContent));
        if (cells.length === 0) continue;
        const joinedText = cells.join(' ').trim();
        if (!joinedText) continue;

        // Capture Total Payout summary row
        if (/total\s+payout/i.test(joinedText)) {
          const lastVal = parseCurrencyFloat(cells[cells.length - 1]);
          if (lastVal !== 0) totalPayout = lastVal;
          continue;
        }

        // Capture Space Rental / Credit adjustments e.g. `(Credit) Space Rental 10/31/2026 | -382.50`
        if (/space\s+rental|\(credit\)/i.test(joinedText)) {
          const amt = parseCurrencyFloat(cells[cells.length - 1]);
          const dateMatch = joinedText.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/);
          const label = cells.find((c) => /space\s+rental|\(credit\)/i.test(c)) || cells[0] || 'Space Rental';
          adjustments.push({
            label,
            date: dateMatch ? dateMatch[1] : '',
            amount: Number(amt.toFixed(2)),
          });
          continue;
        }

        if (cells.length >= 8) {
          // Guard against Payout History rows (where cell 6 and cell 7 are both dates)
          const cell6IsDate = /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$|^\d{4}-\d{2}-\d{2}$/.test(cells[6] || '');
          const cell7IsDate = /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$|^\d{4}-\d{2}-\d{2}$/.test(cells[7] || '');
          if (cell6IsDate && cell7IsDate && !/^0EJ/i.test(cells[1] || '')) continue;

          const rawTitle = cells[0] || '';
          const rawSku = cleanStr(cells[1] || '').toUpperCase();
          const rawSale = cleanStr(cells[2] || '');
          const agreedPrice = Number(Math.abs(parseCurrencyFloat(cells[3])).toFixed(2));
          const splitPct = cleanStr(cells[4] || '');
          const agedPrice = Number(Math.abs(parseCurrencyFloat(cells[5])).toFixed(2));
          const discounts = cleanStr(cells[6] || '');
          const soldDate = cleanStr(cells[7] || '');
          const ricoNetPayout = Number(parseCurrencyFloat(cells[8] ?? cells[cells.length - 1]).toFixed(2));

          if (!rawTitle && !rawSku && !rawSale) continue;
          if (/^(item|total)\b/i.test(rawTitle) && /sku|sale/i.test(rawSku + ' ' + rawSale)) continue;
          if (/^total\b/i.test(rawTitle)) continue;

          const cleanSaleNum = rawSale.replace(/^#/, '').trim();
          const grossPrice = agedPrice > 0 ? agedPrice : agreedPrice;
          if (isBogusInventoryDomRow(rawTitle, rawSku, rawSale, grossPrice, splitPct)) continue;

          const ricoCommission = Math.max(0, Number((grossPrice - ricoNetPayout).toFixed(2)));

          rows.push({
            title: rawTitle || rawSku || 'Booth Sale Item',
            ricoSku: rawSku,
            sku: rawSku,
            saleNumber: rawSale || (cleanSaleNum ? `#${cleanSaleNum}` : ''),
            payoutId: cleanSaleNum || rawSale,
            agreedPrice,
            splitPct,
            agedPrice,
            discounts,
            soldDate,
            paidDate: null,
            grossPrice,
            ricoNetPayout,
            ricoCommission,
            payoutStatus: 'pending_payout',
            status: 'Sold',
          });
        }
      }
    }

    return { rows, adjustments, totalPayout };
  }

  // Parse `/payout_history` (Paid History) 9-column HTML table:
  // [Item, Sale, Agreed, Cost/Split, Aged Price, Discounts, Paid, Sold, Amount]
  // Where Item has ` - <SKU>` suffix e.g. `Cartographers Heros - 0EJ03C`
  function parsePayoutHistoryHtmlDocument(doc) {
    const rows = [];
    const adjustments = [];
    let totalPayout = 0;
    if (!doc) return { rows, adjustments, totalPayout };

    const tables = Array.from(doc.querySelectorAll('table'));
    for (const table of tables) {
      if (table.closest && table.closest('#rc-ricochet-sync-root')) continue;
      const thTexts = collectTableHeaders(doc, table);
      const hasSkuHeader = thTexts.some((h) => h === 'sku');
      const hasPaidHeader = thTexts.some((h) => h === 'paid' || h.startsWith('paid'));
      if ((hasSkuHeader && !hasPaidHeader) || isInventoryDomTable(thTexts)) continue;

      const trs = Array.from(table.querySelectorAll('tbody tr, tr'));
      for (const tr of trs) {
        if (tr.querySelector('th')) continue;
        const cells = Array.from(tr.querySelectorAll('td')).map((td) => cleanStr(td.textContent));
        if (cells.length === 0) continue;
        const joinedText = cells.join(' ').trim();
        if (!joinedText) continue;

        if (/total\s+payout/i.test(joinedText)) {
          const lastVal = parseCurrencyFloat(cells[cells.length - 1]);
          if (lastVal !== 0) totalPayout += lastVal;
          continue;
        }

        if (/space\s+rental|\(credit\)/i.test(joinedText)) {
          const amt = parseCurrencyFloat(cells[cells.length - 1]);
          const dateMatch = joinedText.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/);
          const label = cells.find((c) => /space\s+rental|\(credit\)/i.test(c)) || cells[0] || 'Space Rental';
          adjustments.push({
            label,
            date: dateMatch ? dateMatch[1] : '',
            amount: Number(amt.toFixed(2)),
          });
          continue;
        }

        if (cells.length >= 8) {
          // Guard against Pending Payout rows where cell[1] is a standalone `0EJ...` SKU column and cell[6] is Discounts (not a Paid date)
          const cell6IsDate = /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$|^\d{4}-\d{2}-\d{2}$/.test(cells[6] || '');
          if (/^0EJ[A-Z0-9]+$/i.test(cells[1] || '') && !cell6IsDate) continue;

          const rawItemCell = cells[0] || '';
          if (/^(item|total)\b/i.test(rawItemCell) && /sale|agreed/i.test(cells[1] + ' ' + cells[2])) continue;
          if (/^total\b/i.test(rawItemCell)) continue;

          // Parse `Item` using `/^(.*?)\s+-\s+((?:0EJ|HUCK|PDXGL|BB)[A-Z0-9-]{2,14})$/i` so `"Cartographers Heros - 0EJ03C"` yields `title: "Cartographers Heros"` and `ricoSku: "0EJ03C"`
          let parsedTitle = rawItemCell;
          let parsedSku = '';
          const suffixMatch = rawItemCell.match(/^(.*?)\s+-\s+((?:0EJ|HUCK|PDXGL|BB)[A-Z0-9-]{2,14})$/i);
          if (suffixMatch) {
            parsedTitle = cleanStr(suffixMatch[1]);
            parsedSku = cleanStr(suffixMatch[2]).toUpperCase();
          }

          const rawSale = cleanStr(cells[1] || '');
          const agreedPrice = Number(Math.abs(parseCurrencyFloat(cells[2])).toFixed(2));
          const splitPct = cleanStr(cells[3] || '');
          const agedPrice = Number(Math.abs(parseCurrencyFloat(cells[4])).toFixed(2));
          const discounts = cleanStr(cells[5] || '');
          const paidDate = cleanStr(cells[6] || '') || null;
          const soldDate = cleanStr(cells[7] || '');
          const ricoNetPayout = Number(parseCurrencyFloat(cells[8] ?? cells[cells.length - 1]).toFixed(2));

          if (!parsedTitle && !parsedSku && !rawSale) continue;
          const cleanSaleNum = rawSale.replace(/^#/, '').trim();
          const grossPrice = agedPrice > 0 ? agedPrice : agreedPrice;
          if (isBogusInventoryDomRow(parsedTitle, parsedSku, rawSale, grossPrice, splitPct)) continue;

          const ricoCommission = Math.max(0, Number((grossPrice - ricoNetPayout).toFixed(2)));

          rows.push({
            title: parsedTitle || parsedSku || 'Booth Sale Item',
            ricoSku: parsedSku,
            sku: parsedSku,
            saleNumber: rawSale || cleanSaleNum,
            payoutId: cleanSaleNum || rawSale,
            agreedPrice,
            splitPct,
            agedPrice,
            discounts,
            paidDate,
            soldDate,
            grossPrice,
            ricoNetPayout,
            ricoCommission,
            payoutStatus: 'paid',
            status: 'Paid',
          });
        }
      }
    }

    return { rows, adjustments, totalPayout };
  }

  // RFC-4180 CSV parser + Dual-Schema Ricochet Native "Export" CSV parser:
  // Schema A (Payout Export CSV): `Item,SKU,Sale,Agreed,Cost/Split,Aged Price,Discounts,Sold,Amount`
  // Schema B (Payout History Export CSV): `Item,Sale,Agreed,Cost/Split,Aged Price,Discounts,Paid,Sold,Amount`
  function parseCsvRowsRfc4180(csvText) {
    const src = String(csvText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const out = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (inQuotes) {
        if (ch === '"') {
          if (src[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n') {
        row.push(field);
        out.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      out.push(row);
    }
    return out;
  }

  function parseRicochetExportCsvText(csvText, defaultStatus = 'pending_payout') {
    const rows = [];
    const adjustments = [];
    let totalPayout = 0;
    const matrix = parseCsvRowsRfc4180(csvText);
    if (matrix.length === 0) return { rows, adjustments, totalPayout };

    let activeSchema = null;
    for (const rawCells of matrix) {
      const cells = rawCells.map((c) => cleanStr(c));
      if (cells.every((c) => !c)) continue;
      const lower = cells.map((c) => c.toLowerCase().replace(/^['"]+|['"]+$/g, '').trim());
      const hasItemHeader = lower[0] === 'item' || lower.includes('item');
      const hasAgreedOrAmount =
        lower.includes('agreed') ||
        lower.includes('amount') ||
        lower.some((h) => h.includes('cost/split') || h === 'sold');

      if (hasItemHeader && hasAgreedOrAmount) {
        const itemIdx = Math.max(0, lower.indexOf('item'));
        const skuIdx = lower.indexOf('sku');
        const saleIdx = lower.findIndex((h) => h === 'sale' || h === 'sale#' || h === 'sale #');
        const agreedIdx = lower.findIndex((h) => h === 'agreed' || h === 'agreed price');
        const splitIdx = lower.findIndex((h) => h.includes('cost/split') || h === 'split');
        const agedIdx = lower.findIndex((h) => h.includes('aged'));
        const discountsIdx = lower.findIndex((h) => h.includes('discount'));
        const paidIdx = lower.findIndex((h) => h === 'paid' || h === 'paid date');
        const soldIdx = lower.findIndex((h) => h === 'sold' || h === 'sold date');
        const amountIdx = lower.findIndex((h) => h === 'amount' || h === 'net' || h === 'payout');

        if (paidIdx >= 0 && skuIdx === -1) {
          activeSchema = {
            kind: 'payout_history',
            itemIdx,
            skuIdx: -1,
            saleIdx: saleIdx >= 0 ? saleIdx : 1,
            agreedIdx: agreedIdx >= 0 ? agreedIdx : 2,
            splitIdx: splitIdx >= 0 ? splitIdx : 3,
            agedIdx: agedIdx >= 0 ? agedIdx : 4,
            discountsIdx: discountsIdx >= 0 ? discountsIdx : 5,
            paidIdx,
            soldIdx: soldIdx >= 0 ? soldIdx : 7,
            amountIdx: amountIdx >= 0 ? amountIdx : 8,
          };
        } else {
          activeSchema = {
            kind: 'payout_pending',
            itemIdx,
            skuIdx: skuIdx >= 0 ? skuIdx : 1,
            saleIdx: saleIdx >= 0 ? saleIdx : 2,
            agreedIdx: agreedIdx >= 0 ? agreedIdx : 3,
            splitIdx: splitIdx >= 0 ? splitIdx : 4,
            agedIdx: agedIdx >= 0 ? agedIdx : 5,
            discountsIdx: discountsIdx >= 0 ? discountsIdx : 6,
            paidIdx,
            soldIdx: soldIdx >= 0 ? soldIdx : 7,
            amountIdx: amountIdx >= 0 ? amountIdx : 8,
          };
        }
        continue;
      }

      if (!activeSchema) {
        activeSchema =
          defaultStatus === 'paid'
            ? {
                kind: 'payout_history',
                itemIdx: 0,
                skuIdx: -1,
                saleIdx: 1,
                agreedIdx: 2,
                splitIdx: 3,
                agedIdx: 4,
                discountsIdx: 5,
                paidIdx: 6,
                soldIdx: 7,
                amountIdx: 8,
              }
            : {
                kind: 'payout_pending',
                itemIdx: 0,
                skuIdx: 1,
                saleIdx: 2,
                agreedIdx: 3,
                splitIdx: 4,
                agedIdx: 5,
                discountsIdx: 6,
                paidIdx: -1,
                soldIdx: 7,
                amountIdx: 8,
              };
      }

      const joinedText = cells.join(' ').trim();
      if (!joinedText) continue;

      if (/total\s+payout|total\s+for\s+payout|^total\b/i.test(joinedText)) {
        const lastVal = parseCurrencyFloat(cells[activeSchema.amountIdx] ?? cells[cells.length - 1]);
        if (lastVal !== 0) totalPayout += lastVal;
        continue;
      }

      if (/space\s+rental|\(credit\)/i.test(joinedText)) {
        const amt = parseCurrencyFloat(cells[activeSchema.amountIdx] ?? cells[cells.length - 1]);
        const dateMatch = joinedText.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/);
        const label = cells.find((c) => /space\s+rental|\(credit\)/i.test(c)) || cells[0] || 'Space Rental';
        adjustments.push({
          label,
          date: dateMatch ? dateMatch[1] : '',
          amount: Number(amt.toFixed(2)),
        });
        continue;
      }

      const rawItemCell = cells[activeSchema.itemIdx] || '';
      const rawSkuCell =
        activeSchema.skuIdx >= 0
          ? cleanStr(String(cells[activeSchema.skuIdx] || '').replace(/^['"]+|['"]+$/g, '')).toUpperCase()
          : '';
      if (/^total\b/i.test(rawItemCell) || /^total\b/i.test(rawSkuCell)) continue;

      let parsedTitle = rawItemCell;
      let parsedSku = rawSkuCell;
      const suffixMatch = rawItemCell.match(/^(.*?)\s+-\s+((?:0EJ|HUCK|PDXGL|BB)[A-Z0-9-]{2,14})$/i);
      if (suffixMatch) {
        parsedTitle = cleanStr(suffixMatch[1]);
        if (!parsedSku) parsedSku = cleanStr(suffixMatch[2]).toUpperCase();
      }

      const rawSale = cleanStr(cells[activeSchema.saleIdx] || '');
      const cleanSaleNum = rawSale.replace(/^#/, '').trim();
      const agreedPrice = Number(Math.abs(parseCurrencyFloat(cells[activeSchema.agreedIdx])).toFixed(2));
      const splitPct = cleanStr(cells[activeSchema.splitIdx] || '');
      const agedPrice = Number(Math.abs(parseCurrencyFloat(cells[activeSchema.agedIdx])).toFixed(2));
      const discounts = cleanStr(cells[activeSchema.discountsIdx] || '');
      const paidDate =
        activeSchema.paidIdx >= 0 ? cleanStr(cells[activeSchema.paidIdx] || '') || null : null;
      const soldDate = cleanStr(cells[activeSchema.soldIdx] || '') || paidDate || '';
      const ricoNetPayout = Number(
        parseCurrencyFloat(cells[activeSchema.amountIdx] ?? cells[cells.length - 1]).toFixed(2)
      );

      if (!parsedTitle && !parsedSku && !cleanSaleNum) continue;
      const grossPrice = agedPrice > 0 ? agedPrice : agreedPrice;
      if (isBogusInventoryDomRow(parsedTitle, parsedSku, rawSale, grossPrice, splitPct)) continue;

      const ricoCommission = Math.max(0, Number((grossPrice - ricoNetPayout).toFixed(2)));
      const payoutStatus =
        activeSchema.kind === 'payout_history' || Boolean(paidDate) ? 'paid' : 'pending_payout';

      rows.push({
        title: parsedTitle || parsedSku || 'Booth Sale Item',
        ricoSku: parsedSku,
        sku: parsedSku,
        saleNumber: rawSale || (cleanSaleNum ? `#${cleanSaleNum}` : ''),
        payoutId: cleanSaleNum || rawSale,
        agreedPrice,
        splitPct,
        agedPrice,
        discounts,
        paidDate,
        soldDate,
        grossPrice,
        ricoNetPayout,
        ricoCommission,
        payoutStatus,
        status: payoutStatus === 'paid' ? 'Paid' : 'Sold',
      });
    }

    return { rows, adjustments, totalPayout };
  }

  // Persist the RAW captured Export CSV text plus harvested payout table rows into localStorage (keyed per canonical location)
  // so the Resale Command import flow can ingest the unmodified Ricochet data.
  function persistRicochetCaptureToLocalStorage(kind, rawCsv, tableRows) {
    try {
      const storageKey = `rc_ricochet_export_capture_v1_${activeLocationCode || 'LOC'}`;
      let store = {};
      try {
        store = JSON.parse(localStorage.getItem(storageKey) || '{}') || {};
      } catch (e) {
        store = {};
      }
      store.locationCode = activeLocationCode;
      store.capturedAt = new Date().toISOString();
      store[kind] = {
        rawCsv: typeof rawCsv === 'string' && rawCsv ? rawCsv : (store[kind] && store[kind].rawCsv) || '',
        rows: Array.isArray(tableRows) && tableRows.length > 0 ? tableRows : (store[kind] && store[kind].rows) || [],
      };
      localStorage.setItem(storageKey, JSON.stringify(store));
    } catch (e) {
      // localStorage may be full or unavailable; harvesting continues in memory
    }
  }

  // Safely capture Ricochet's native "Export" / "[Export]" CSV button in memory (hooking Blob, URL.createObjectURL, and HTMLAnchorElement.prototype.click so no browser download dialog triggers)
  async function captureSpaExportCsvInMemory(defaultStatus = 'pending_payout') {
    const candidates = Array.from(document.querySelectorAll('button, a, input[type="button"]')).filter((el) => {
      if (!el || (el.closest && el.closest('#rc-ricochet-sync-root'))) return false;
      const text = cleanStr(el.textContent || el.value || '').replace(/^\[+|\]+$/g, '').trim();
      const blob = `${text} ${el.className || ''} ${el.id || ''} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('href') || ''}`;
      if (/log\s*out|sign\s*out|exit|profile/i.test(blob)) return false;
      return /^export(?:\s+csv)?$/i.test(text);
    });
    if (candidates.length === 0) return null;

    const exportBtn = candidates[0];
    let capturedCsvText = '';
    const capturedBlobs = [];
    const OriginalBlob = window.Blob;
    const origCreateObjectURL = URL.createObjectURL;
    const origAnchorClick = HTMLAnchorElement.prototype.click;

    try {
      window.Blob = function (blobParts, options) {
        const instance = new OriginalBlob(blobParts, options);
        try {
          if (Array.isArray(blobParts)) {
            const joined = blobParts.map((p) => (typeof p === 'string' ? p : '')).join('');
            if (joined && (/item\s*,/i.test(joined) || (options && /csv/i.test(String(options.type || ''))))) {
              capturedCsvText = joined;
            }
          }
          capturedBlobs.push(instance);
        } catch (e) {}
        return instance;
      };
      window.Blob.prototype = OriginalBlob.prototype;

      URL.createObjectURL = function (obj) {
        try {
          if (obj && typeof obj.text === 'function') {
            capturedBlobs.push(obj);
          }
        } catch (e) {}
        return origCreateObjectURL.apply(this, arguments);
      };

      HTMLAnchorElement.prototype.click = function () {
        try {
          const href = String(this.getAttribute('href') || this.href || '');
          const hasDownload = this.hasAttribute('download');
          if (href.startsWith('data:text/csv') || (hasDownload && href.startsWith('data:'))) {
            const commaIdx = href.indexOf(',');
            if (commaIdx >= 0) {
              const rawPayload = href.slice(commaIdx + 1);
              capturedCsvText = href.includes(';base64,')
                ? atob(rawPayload)
                : decodeURIComponent(rawPayload);
            }
            return;
          }
          if (hasDownload || href.startsWith('blob:')) {
            return;
          }
        } catch (e) {}
        return origAnchorClick.apply(this, arguments);
      };

      const hrefAttr = String(exportBtn.getAttribute('href') || '').trim();
      if (exportBtn.tagName === 'A' && hrefAttr && hrefAttr !== '#' && !hrefAttr.startsWith('javascript:')) {
        if (hrefAttr.startsWith('data:text/csv')) {
          const commaIdx = hrefAttr.indexOf(',');
          if (commaIdx >= 0) {
            capturedCsvText = decodeURIComponent(hrefAttr.slice(commaIdx + 1));
          }
        }
      } else {
        exportBtn.click();
      }

      const waitStart = Date.now();
      while (!capturedCsvText && Date.now() - waitStart < 700) {
        for (const b of capturedBlobs) {
          if (b && typeof b.text === 'function') {
            const txt = await b.text().catch(() => '');
            if (txt && /item\s*,/i.test(txt)) {
              capturedCsvText = txt;
              break;
            }
          }
        }
        if (capturedCsvText) break;
        await new Promise((r) => setTimeout(r, 80));
      }
    } catch (e) {
      // ignore interceptor errors
    } finally {
      window.Blob = OriginalBlob;
      URL.createObjectURL = origCreateObjectURL;
      HTMLAnchorElement.prototype.click = origAnchorClick;
    }

    if (!capturedCsvText || !/item\s*,/i.test(capturedCsvText)) return null;
    const parsed = parseRicochetExportCsvText(capturedCsvText, defaultStatus);
    if (parsed.rows.length === 0) return null;
    parsed.rawCsv = capturedCsvText;
    return parsed;
  }

  // Safely step through multi-page Payout History ("1 out of 2" -> "2 out of 2") so all 300 Paid History rows are harvested with their real `- 0EJxxx` SKU, 6-digit Sale #, Paid date, and Sold date
  async function harvestAllPayoutHistoryTablePages(waitForSpaTableRows) {
    const mergedRows = [];
    const mergedAdjustments = [];
    let totalPayout = 0;
    const pages = [];
    const seenPageSignatures = new Set();

    const mergeParsedPage = (parsed) => {
      if (!parsed) return;
      const pageRows = parsed.rows || [];
      // A ticket can hold several IDENTICAL lines (e.g. 4x the same $15 book), so rows are NEVER collapsed by their own content.
      // Only a repeat capture of the very same page is skipped (identified by the full ordered list of its row keys).
      const keyOf = (r) =>
        `${r.payoutId || r.saleNumber}|${r.ricoSku || r.sku}|${r.title}|${r.paidDate || ''}|${r.soldDate || ''}|${Number(r.ricoNetPayout || 0).toFixed(2)}`;
      const signature = pageRows.map(keyOf).join('~');
      const newRowsThisPage = [];
      if (signature && !seenPageSignatures.has(signature)) {
        seenPageSignatures.add(signature);
        for (const r of pageRows) {
          mergedRows.push(r);
          newRowsThisPage.push(r);
        }
      }
      if (newRowsThisPage.length > 0) {
        pages.push({ page: pages.length + 1, rows: newRowsThisPage });
      }
      for (const a of parsed.adjustments || []) {
        mergedAdjustments.push(a);
      }
      if (parsed.totalPayout) totalPayout += parsed.totalPayout;
    };

    const getPaginationState = () => {
      const candidates = Array.from(document.querySelectorAll('span, div, p, li, td'));
      for (const el of candidates) {
        if (el.closest && el.closest('#rc-ricochet-sync-root')) continue;
        if (el.children && el.children.length > 3) continue;
        const txt = cleanStr(el.textContent);
        const m = txt.match(/\b(\d+)\s+out\s+of\s+(\d+)\b/i);
        if (m) {
          return {
            currentPage: parseInt(m[1], 10) || 1,
            totalPages: parseInt(m[2], 10) || 1,
            indicatorEl: el,
          };
        }
      }
      return { currentPage: 1, totalPages: 1, indicatorEl: null };
    };

    const findSafeNextPageButton = (indicatorEl) => {
      const scope =
        (indicatorEl && (indicatorEl.parentElement?.parentElement || indicatorEl.parentElement)) || document;
      const btns = Array.from(scope.querySelectorAll('button, a, li'));
      for (const btn of btns) {
        if (!btn || (btn.closest && btn.closest('#rc-ricochet-sync-root'))) continue;
        if (btn.closest && btn.closest('nav, header')) continue;
        const txt = cleanStr(btn.textContent);
        const blob = `${txt} ${btn.className || ''} ${btn.id || ''} ${btn.getAttribute('aria-label') || ''} ${btn.getAttribute('title') || ''}`;
        if (/log\s*out|sign\s*out|exit|profile|inventory|payout/i.test(blob)) continue;
        if (btn.disabled || /disabled/i.test(btn.className || '')) continue;
        const hasRightIcon = Boolean(
          btn.querySelector &&
            btn.querySelector('[class*="right"], [class*="next"], [class*="chevron-right"], [class*="angle-right"], [class*="arrow-right"]')
        );
        if (
          /^(?:next|>|›|»|→)$/i.test(txt) ||
          /next/i.test(btn.getAttribute('aria-label') || '') ||
          hasRightIcon
        ) {
          return btn;
        }
      }
      return null;
    };

    const firstPage = await waitForSpaTableRows(parsePayoutHistoryHtmlDocument, 6000, true);
    mergeParsedPage(firstPage);

    const pag = getPaginationState();
    for (let step = pag.currentPage; step < Math.min(pag.totalPages, 10); step++) {
      const currentPag = getPaginationState();
      const nextBtn = findSafeNextPageButton(currentPag.indicatorEl);
      if (!nextBtn) break;
      const prevFirstTicket = firstPage.rows[0] ? `${firstPage.rows[0].payoutId}|${firstPage.rows[0].title}` : '';
      nextBtn.click();
      const waitStart = Date.now();
      while (Date.now() - waitStart < 3500) {
        await new Promise((r) => setTimeout(r, 250));
        const nowPag = getPaginationState();
        const candidate = parsePayoutHistoryHtmlDocument(document);
        const nowFirstTicket = candidate.rows[0] ? `${candidate.rows[0].payoutId}|${candidate.rows[0].title}` : '';
        if (
          (nowPag.currentPage > step && candidate.rows.length > 0) ||
          (candidate.rows.length > 0 && nowFirstTicket && nowFirstTicket !== prevFirstTicket)
        ) {
          mergeParsedPage(candidate);
          break;
        }
      }
    }

    return { rows: mergedRows, adjustments: mergedAdjustments, totalPayout, pages };
  }

  // Safely Auto-Click ONLY Top-Nav `<a href="#">Payout</a>`, `<a href="#">Payout History</a>`, and `<a href="#">Inventory</a>` Tabs (Plus In-Memory Export CSV Capture & Multi-Page "1 out of 2" Traversal)
  async function harvestLiveSpaPayoutTables(manualTrigger = false) {
    if (isHarvestingPayoutPages) return;
    isHarvestingPayoutPages = true;
    const harvestBtn = document.getElementById('rc-harvest-payouts-btn');
    if (harvestBtn) {
      harvestBtn.disabled = true;
      harvestBtn.textContent = '⏳ Harvesting...';
    }

    try {
      const mergedAdjustments = [];
      const seenAdjKeys = new Set();
      const addAdj = (a) => {
        const key = `${a.label}|${a.date}|${Number(a.amount || 0).toFixed(2)}`;
        if (!seenAdjKeys.has(key)) {
          seenAdjKeys.add(key);
          mergedAdjustments.push(a);
        }
      };

      const ALLOWED_SPA_TAB_LABELS = new Set(['payout', 'payout history', 'inventory']);

      const findSafeSpaNavLink = (exactLabel) => {
        const target = cleanStr(exactLabel).toLowerCase();
        if (!ALLOWED_SPA_TAB_LABELS.has(target)) return null;
        const anchors = Array.from(document.querySelectorAll('a[href="#"]'));
        return (
          anchors.find((el) => {
            if (!el || typeof el.getAttribute !== 'function') return false;
            if (el.closest && el.closest('#rc-ricochet-sync-root')) return false;
            const rawHref = String(el.getAttribute('href') || '').trim();
            if (rawHref !== '#') return false;
            const text = cleanStr(el.textContent);
            const checkBlob = `${text} ${el.className || ''} ${el.id || ''} ${el.getAttribute('aria-label') || ''}`;
            if (/log\s*out|sign\s*out|exit|profile/i.test(checkBlob)) return false;
            return text.toLowerCase() === target;
          }) || null
        );
      };

      const safeClickSpaTab = (el) => {
        if (!el || typeof el.click !== 'function') return false;
        if (String(el.tagName || '').toUpperCase() !== 'A') return false;
        if (String(el.getAttribute('href') || '').trim() !== '#') return false;
        const text = cleanStr(el.textContent);
        const checkBlob = `${text} ${el.className || ''} ${el.id || ''} ${el.getAttribute('aria-label') || ''}`;
        if (/log\s*out|sign\s*out|exit|profile/i.test(checkBlob)) return false;
        if (!ALLOWED_SPA_TAB_LABELS.has(text.toLowerCase())) return false;
        el.click();
        return true;
      };

      // Set any `items / page` <select> (Ricochet defaults to 10) to the highest numeric / All option so every row renders (select change only — never a button click)
      const expandPageSizeSelects = () => {
        let changed = false;
        try {
          for (const sel of Array.from(document.querySelectorAll('select'))) {
            if (sel.closest && sel.closest('#rc-ricochet-sync-root')) continue;
            const opts = Array.from(sel.options || []);
            const numericOpts = opts
              .map((o) => ({ o, n: parseInt(String(o.value), 10) || parseInt(cleanStr(o.textContent), 10) || 0 }))
              .filter((x) => x.n > 0);
            const looksLikePageSize =
              /item|page|show|entries|length/i.test(`${sel.name || ''} ${sel.id || ''} ${sel.className || ''} ${cleanStr(sel.parentElement && sel.parentElement.textContent)}`) ||
              numericOpts.length >= 2;
            if (!looksLikePageSize) continue;
            const allOpt = opts.find((o) => String(o.value) === '-1' || /^all$/i.test(cleanStr(o.textContent)));
            const maxNumeric = numericOpts.sort((a, b) => b.n - a.n)[0];
            const target = allOpt || (maxNumeric && maxNumeric.o);
            if (target && sel.value !== target.value) {
              sel.value = target.value;
              sel.dispatchEvent(new Event('change', { bubbles: true }));
              sel.dispatchEvent(new Event('input', { bubbles: true }));
              changed = true;
            }
          }
        } catch (e) {}
        return changed;
      };

      const documentHasPaidHeaderTable = () =>
        Array.from(document.querySelectorAll('table')).some((t) => {
          if (t.closest && t.closest('#rc-ricochet-sync-root')) return false;
          return collectTableHeaders(document, t).some((h) => h === 'paid' || h.startsWith('paid'));
        });

      const waitForSpaTableRows = async (parseFn, maxMs = 4000, requirePaidHeader = false) => {
        const start = Date.now();
        let lastCount = -1;
        let stablePolls = 0;
        let bestParsed = { rows: [], adjustments: [], totalPayout: 0 };

        while (Date.now() - start < maxMs) {
          if (expandPageSizeSelects()) {
            lastCount = -1;
            stablePolls = 0;
            await new Promise((r) => setTimeout(r, 250));
          }
          const candidate = parseFn(document);
          const count = (candidate.rows || []).length;
          const headerOk = !requirePaidHeader || documentHasPaidHeaderTable();
          if (count > 0 && headerOk) {
            bestParsed = candidate;
            if (count === lastCount) {
              stablePolls++;
              if (stablePolls >= 1) return bestParsed; // 2 consecutive identical 250ms checks
            } else {
              lastCount = count;
              stablePolls = 0;
            }
          } else {
            lastCount = -1;
            stablePolls = 0;
          }
          await new Promise((r) => setTimeout(r, 250));
        }

        const finalPass = parseFn(document);
        return (finalPass.rows || []).length >= (bestParsed.rows || []).length ? finalPass : bestParsed;
      };

      const payoutLink = findSafeSpaNavLink('Payout');
      const payoutHistoryLink = findSafeSpaNavLink('Payout History');
      const inventoryLink = findSafeSpaNavLink('Inventory');

      // 1. Safely click `<a href="#">Payout</a>` and harvest Pending Payout table rows + Space Rental adjustments directly from the live SPA DOM (zero native [Export] button clicks or OS file download dialogs!)
      if (safeClickSpaTab(payoutLink)) {
        try {
          const parsedPayouts = await waitForSpaTableRows(parsePayoutsHtmlDocument, 4000, false);
          if (parsedPayouts.rows.length > 0) {
            harvestedPendingPayoutRows = parsedPayouts.rows;
            cachedPayoutDomRows = parsedPayouts.rows;
          }
          persistRicochetCaptureToLocalStorage('payout', '', parsedPayouts.rows);
          if (parsedPayouts.totalPayout !== 0) {
            harvestedPendingTotalPayout = parsedPayouts.totalPayout;
          }
          (parsedPayouts.adjustments || []).forEach(addAdj);
        } catch (e) {}
      }

      // 2. Safely click `<a href="#">Payout History</a>` and traverse all table pages ("1 out of 2" -> "2 out of 2") directly from the live SPA DOM (zero native [Export] button clicks or OS file download dialogs!)
      if (safeClickSpaTab(payoutHistoryLink)) {
        try {
          let parsedHistory = await harvestAllPayoutHistoryTablePages(waitForSpaTableRows);
          if (parsedHistory.rows.length === 0 && safeClickSpaTab(payoutHistoryLink)) {
            parsedHistory = await harvestAllPayoutHistoryTablePages(waitForSpaTableRows);
          }
          if (parsedHistory.rows.length > 0) {
            harvestedPaidHistoryRows = parsedHistory.rows;
            cachedPayoutHistoryDomRows = parsedHistory.rows;
            persistRicochetCaptureToLocalStorage('payout_history', '', parsedHistory.rows);
            if (Array.isArray(parsedHistory.pages) && parsedHistory.pages.length > 0) {
              harvestedPaidHistoryPages = parsedHistory.pages;
            }
            addLog(`💰 Paid History: ${parsedHistory.rows.length} rows`, '#10b981');
          } else {
            addLog('⚠️ Paid History returned 0 rows after retry', '#f59e0b');
          }
          if (parsedHistory.totalPayout !== 0) {
            harvestedPaidHistoryTotalPayout = parsedHistory.totalPayout;
          }
          (parsedHistory.adjustments || []).forEach(addAdj);
        } catch (e) {}
      }

      // 3. Safely restore `<a href="#">Inventory</a>` tab ONLY after both waits finish
      safeClickSpaTab(inventoryLink);

      if (mergedAdjustments.length > 0) {
        spaceRentalAdjustments = mergedAdjustments;
      }

      hasHarvestedPayoutPages = true;
      extractRicochetSoldLines();
      if (manualTrigger || harvestedPendingPayoutRows.length > 0 || harvestedPaidHistoryRows.length > 0) {
        addLog(
          `💰 Harvested ${harvestedPendingPayoutRows.length} Pending Payout rows, ${harvestedPaidHistoryRows.length} Paid History rows, and ${spaceRentalAdjustments.length} Space Rental adjustments.`,
          '#10b981'
        );
      }
      // Auto-stage Dry-Run sales batch to Resale Core in the background (0 production DB writes)
      void pushSalesToResaleCore({ silent: !manualTrigger });
    } catch (e) {
      // ignore harvest error
    } finally {
      isHarvestingPayoutPages = false;
      if (harvestBtn) {
        harvestBtn.disabled = false;
        harvestBtn.textContent = '🔄 Harvest';
      }
      updateSalesSyncTabUI();
    }
  }

  async function harvestRicochetPayoutPages(manualTrigger = false) {
    return harvestLiveSpaPayoutTables(manualTrigger);
  }

  // Build 4-tier lookup & cross-link `0EJ...` SKU <-> Custom UPC <-> Booth Item, reusing Tab 1's `buildVerificationReport()` map and merging `/payouts`, `/payout_history`, and `/api/product`
  function extractRicochetSoldLines() {
    const feeRate = Number(activeCommissionRate || 0) / 100;

    // Reuse Tab 1 (`📦 Inventory & UPC Audit`) canonical verification report & SKU/UPC resolution map (Golden Rule #3)
    const tab1AuditReport = buildVerificationReport();
    const tab1AuditRows = (tab1AuditReport && tab1AuditReport.rows) || [];
    const tab1BySku = new Map();
    const tab1ByProductId = new Map();

    const stripCoreTitle = (normStr) =>
      String(normStr || '')
        .replace(/^(?:the|vintage|vtg|board\s+game|card\s+game|rpg|ttrpg|d\s*&\s*d|ad\s*&\s*d|advanced\s+dungeons\s+(?:and\s+)?dragons|dungeons\s+(?:and\s+)?dragons)\s+/i, '')
        .replace(/\s+(?:board\s+game|card\s+game|rpg|ttrpg|game|book|rulebook|hardcover|hc|softcover|sc|boxed\s+set|box\s+set)$/i, '')
        .trim();

    const tokenizeTitleWords = (rawStr) =>
      cleanStr(rawStr)
        .toLowerCase()
        .replace(/\badvanced\s+dungeons\s*(?:&|and)?\s*dragons\b/g, ' add dnd dungeons dragons ')
        .replace(/\bdungeons\s*(?:&|and)\s*dragons\b/g, ' dnd dungeons dragons ')
        .replace(/\bad\s*&\s*d\b/g, ' add ')
        .replace(/\bd\s*&\s*d\b/g, ' dnd ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter((w) => w.length >= 2 && w !== 'the' && w !== 'and' && w !== 'with' && w !== 'for' && w !== 'from');

    // Build lookup indexes across Tab 1's `buildVerificationReport()`, `/api/product`, `/inventory`, and cloud metadata
    const skuByNumericId = new Map();
    const productBySku = new Map();
    const skuByTitlePrice = new Map();
    const skuByTitleOnly = new Map();
    const upcToSkuMap = new Map();
    const candidateEntries = [];

    const registerCandidateEntry = (skuVal, rawTitle, rawPrice, soldDateStr, isSoldOrPaid) => {
      const s = cleanStr(skuVal).toUpperCase();
      const tKey = normalizeTitleKey(rawTitle);
      if (!s || !tKey) return;
      const coreKey = stripCoreTitle(tKey);
      const pNum = Number(rawPrice || 0);
      const pVal = pNum.toFixed(2);
      // Prefer Sold/Paid catalog entries over In-Stock entries when titles collide so Step 3 (`tab1AuditRows`) never emits a duplicate 301st Paid row
      for (const k of [tKey, coreKey]) {
        if (k && k.length >= 4) {
          if (isSoldOrPaid || !skuByTitlePrice.has(`${k}|${pVal}`)) {
            skuByTitlePrice.set(`${k}|${pVal}`, s);
          }
          if (isSoldOrPaid || !skuByTitleOnly.has(k)) {
            skuByTitleOnly.set(k, s);
          }
        }
      }
      candidateEntries.push({
        sku: s,
        normTitle: tKey,
        coreTitle: coreKey,
        tokens: tokenizeTitleWords(rawTitle),
        price: pNum,
        soldDate: cleanStr(soldDateStr),
        isSoldOrPaid: Boolean(isSoldOrPaid),
      });
    };

    for (const auditRow of tab1AuditRows) {
      const s = cleanStr(auditRow.sku).toUpperCase();
      const pid = cleanStr(auditRow.productId);
      const u = cleanStr(auditRow.expectedRcUpc || auditRow.upc).toUpperCase();
      if (s) {
        tab1BySku.set(s, auditRow);
        if (pid) {
          tab1ByProductId.set(pid, auditRow);
          skuByNumericId.set(pid, s);
        }
        if (u && isRealUpc(u)) {
          upcToSkuMap.set(u, s);
        }
        registerCandidateEntry(
          s,
          auditRow.name,
          auditRow.agreedPrice,
          auditRow.soldDate || auditRow.paidDate || '',
          auditRow.inventory === 'Sold' || auditRow.inventory === 'Paid'
        );
      }
    }

    for (const [kSku, kUpc] of Object.entries(parsedMap)) {
      const s = cleanStr(kSku).toUpperCase();
      const u = cleanStr(kUpc).toUpperCase();
      if (s && u) upcToSkuMap.set(u, s);
    }
    for (const [kSku, meta] of Object.entries(skuMetaMap)) {
      const s = cleanStr(kSku).toUpperCase();
      if (!s || !meta) continue;
      const u = cleanStr(meta.upc).toUpperCase();
      if (u) upcToSkuMap.set(u, s);
      registerCandidateEntry(
        s,
        meta.title,
        meta.price,
        meta.soldDate || '',
        String(meta.status || '').toLowerCase() === 'sold'
      );
    }

    for (const p of catalogProducts) {
      const s = extractRicochetSku(p);
      const numId = cleanStr(p.id);
      const firstItem = Array.isArray(p.items)
        ? p.items[0]
        : p.items && typeof p.items === 'object'
        ? Object.values(p.items).flat()[0]
        : null;
      const itemNumId = cleanStr(firstItem?.id);
      if (s) {
        productBySku.set(s, p);
        if (numId) skuByNumericId.set(numId, s);
        if (itemNumId) skuByNumericId.set(itemNumId, s);
        const pTitle = p.name || p.title || p.description || '';
        const rawPrice =
          p.price ??
          p.agreed_price ??
          p.retail_price ??
          p.aged_price ??
          firstItem?.price ??
          firstItem?.agreed_price ??
          0;
        const pPrice = parseFloat(String(rawPrice).replace(/[^0-9.-]/g, '')) || 0;
        const pSoldDate = cleanStr(
          p.sold_date || p.sold_at || p.paid_date || firstItem?.sold_date || p.updated_at || ''
        ).slice(0, 10);
        registerCandidateEntry(s, pTitle, pPrice, pSoldDate, Boolean(p.sold || p.paid));
      }
    }

    // Helper: 4-tier resolution of `ricoSku` (`0EJ...`), `upc` (`HUCK-XXXX` / `PDXGL-` / `BB-`), and `soldDate`, reusing Tab 1's audit rows
    const resolveCrossLinkedIdentity = (rawRow) => {
      const rawTitleInput = cleanStr(rawRow.title || '');
      const suffixMatch = rawTitleInput.match(/^(.*?)\s+-\s+((?:0EJ|HUCK|PDXGL|BB)[A-Z0-9-]{2,14})$/i);
      const strippedTitle = suffixMatch ? cleanStr(suffixMatch[1]) : rawTitleInput;
      const trailingCode = suffixMatch ? cleanStr(suffixMatch[2]).toUpperCase() : '';

      let candidateSku = cleanStr(rawRow.ricoSku || rawRow.sku || trailingCode || '').toUpperCase();
      let candidateUpc = cleanStr(rawRow.upc || '').toUpperCase();
      if (/^(?:HUCK|PDXGL|BB)-/i.test(candidateSku)) {
        if (!candidateUpc) candidateUpc = candidateSku;
        candidateSku = upcToSkuMap.get(candidateUpc) || '';
      }
      if (candidateSku === 'UNLINKED-SKU' || /^\d+$/.test(candidateSku)) {
        candidateSku = skuByNumericId.get(candidateSku) || '';
      }
      const rawIdStr = cleanStr(rawRow.ricoItemId || rawRow.productId || '');
      if (!candidateSku && rawIdStr && skuByNumericId.has(rawIdStr)) {
        candidateSku = skuByNumericId.get(rawIdStr) || '';
      }
      if (!candidateSku && candidateUpc && upcToSkuMap.has(candidateUpc)) {
        candidateSku = upcToSkuMap.get(candidateUpc) || '';
      }

      const normTitle = normalizeTitleKey(strippedTitle);
      const coreTitle = stripCoreTitle(normTitle);
      const rowPriceNum = Number(rawRow.agreedPrice ?? rawRow.grossPrice ?? 0);
      const agreedFixed = rowPriceNum.toFixed(2);
      let matchedViaFuzzy = false;

      // Tier 2: Normalized / Core Item Title + Agreed Price, or Exact Normalized / Core Title
      if (!candidateSku && normTitle) {
        candidateSku =
          skuByTitlePrice.get(`${normTitle}|${agreedFixed}`) ||
          (coreTitle ? skuByTitlePrice.get(`${coreTitle}|${agreedFixed}`) : '') ||
          skuByTitleOnly.get(normTitle) ||
          (coreTitle && coreTitle.length >= 5 ? skuByTitleOnly.get(coreTitle) : '') ||
          '';
      }

      // Tier 3: Token / Prefix / Fuzzy Title + Gross Price match for Paid History rows missing a SKU (e.g. Blackbeard, Board Game Stop Thief, Castles of Burgundy, Advanced Dungeons & Dragons, Demonia 518, Feelhappy, Forever 21 Kuromi, Tripp NYC, D&D 5e Starter Set)
      if (!candidateSku && normTitle && normTitle.length >= 5) {
        const rowWords = tokenizeTitleWords(strippedTitle);
        let bestEntry = null;
        let bestScore = 0;

        for (const entry of candidateEntries) {
          const priceDiff = rowPriceNum > 0 && entry.price > 0 ? Math.abs(entry.price - rowPriceNum) : 0;
          const isExactPrice = rowPriceNum > 0 && entry.price > 0 && priceDiff < 0.05;
          const isClosePrice = rowPriceNum === 0 || entry.price === 0 || priceDiff <= 5.01;

          const isPrefix =
            isClosePrice &&
            ((normTitle.length >= 8 &&
              entry.normTitle.length >= 8 &&
              (entry.normTitle.startsWith(normTitle) || normTitle.startsWith(entry.normTitle))) ||
              (coreTitle.length >= 6 &&
                entry.coreTitle.length >= 6 &&
                (entry.coreTitle.startsWith(coreTitle) || coreTitle.startsWith(entry.coreTitle))));

          let tokenScore = 0;
          if (rowWords.length > 0 && entry.tokens.length > 0) {
            const candSet = new Set(entry.tokens);
            const matched = rowWords.filter((w) => candSet.has(w));
            const rowCov = matched.length / rowWords.length;
            const minCov = matched.length / Math.min(rowWords.length, entry.tokens.length);
            if (rowCov === 1 && (isExactPrice || minCov >= 0.5)) {
              tokenScore = isExactPrice ? 0.94 : 0.88;
            } else if (matched.length >= 3 && (rowCov >= 0.5 || minCov >= 0.6)) {
              tokenScore = isExactPrice ? 0.91 : isClosePrice ? 0.88 : 0.86;
            } else if (rowCov >= 0.75 && minCov >= 0.75 && isClosePrice && matched.length >= 2) {
              tokenScore = 0.89;
            }
          }

          if (isPrefix || tokenScore >= 0.85) {
            const score =
              (isPrefix ? 0.9 : tokenScore) +
              (isExactPrice ? 0.06 : isClosePrice ? 0.02 : 0) +
              (entry.isSoldOrPaid ? 0.05 : 0);
            if (score > bestScore) {
              bestScore = score;
              bestEntry = entry;
            }
          }
        }

        if (bestEntry) {
          candidateSku = bestEntry.sku;
          matchedViaFuzzy = true;
        }
      }

      const tab1Row =
        (candidateSku && tab1BySku.get(candidateSku)) ||
        (rawIdStr && tab1ByProductId.get(rawIdStr)) ||
        null;
      const prod = candidateSku ? productBySku.get(candidateSku) : null;
      const prodUpc = prod ? extractRicochetUpc(prod) : '';
      const mappedUpc = cleanStr(
        candidateUpc ||
          (tab1Row && (tab1Row.expectedRcUpc || tab1Row.upc)) ||
          prodUpc ||
          (candidateSku &&
            (parsedMap[candidateSku] ||
              (skuMetaMap[candidateSku] && skuMetaMap[candidateSku].upc) ||
              verifiedMdUpcMap[candidateSku])) ||
          ''
      ).toUpperCase();

      // Determine 4-tier match status against Tab 1's `buildVerificationReport()` + all Ricochet Catalog SKUs + HUCK-/PDXGL-/BB- UPCs
      const hasValidSaleTicket = Boolean(cleanStr(rawRow.saleNumber || rawRow.payoutId || ''));
      const isCatalogZeroEjSku = Boolean(
        candidateSku &&
          (tab1Row ||
            parsedMap[candidateSku] ||
            skuMetaMap[candidateSku] ||
            verifiedSkuSet.has(candidateSku) ||
            productBySku.has(candidateSku) ||
            (/^0EJ[A-Z0-9]+$/i.test(candidateSku) && hasValidSaleTicket))
      );

      let matchTier = 'unmatched';
      if (mappedUpc && isRealUpc(mappedUpc)) {
        matchTier = 'upc';
      } else if (isCatalogZeroEjSku) {
        matchTier = 'sku';
      } else if (normTitle && skuByTitlePrice.has(`${normTitle}|${agreedFixed}`)) {
        matchTier = 'title_price';
      } else if ((normTitle && skuByTitleOnly.has(normTitle)) || matchedViaFuzzy) {
        matchTier = 'title';
      }

      const isMatchedInBooth = matchTier !== 'unmatched';
      const resolvedTitle =
        strippedTitle ||
        (tab1Row && cleanStr(tab1Row.name)) ||
        (candidateSku && skuMetaMap[candidateSku] && skuMetaMap[candidateSku].title) ||
        (prod && cleanStr(prod.name || prod.title)) ||
        candidateSku ||
        'Booth Sale Item';

      const inheritedSoldDate = cleanStr(
        rawRow.soldDate ||
          rawRow.paidDate ||
          (tab1Row && (tab1Row.soldDate || tab1Row.paidDate)) ||
          (candidateSku && skuMetaMap[candidateSku] && skuMetaMap[candidateSku].soldDate) ||
          ''
      );

      return {
        ricoSku: candidateSku,
        sku: candidateSku,
        upc: mappedUpc,
        title: resolvedTitle,
        soldDate: inheritedSoldDate,
        matchTier,
        isMatchedInBooth,
        matchedInBooth: isMatchedInBooth,
      };
    };

    const soldRows = [];
    const seenPayoutSignatureCounts = new Map();
    const seenPayoutSkuCounts = new Map();
    const seenPayoutTitlePriceCounts = new Map();

    const pushNormalizedSoldRow = (raw, isFromPayoutTable = false) => {
      if (isBogusInventoryDomRow(raw.title, raw.sku || raw.ricoSku, raw.saleNumber || raw.payoutId, Number(raw.grossPrice ?? raw.agreedPrice ?? 0), raw.splitPct)) {
        return;
      }
      const linked = resolveCrossLinkedIdentity(raw);
      const ricoSku = linked.ricoSku || '';
      const saleNumber = cleanStr(raw.saleNumber || raw.payoutId || '');
      const cleanTicket = saleNumber.replace(/^#/, '').trim();
      const paidDate = raw.paidDate ? cleanStr(raw.paidDate) : null;
      const soldDate = cleanStr(raw.soldDate || linked.soldDate || paidDate || '');
      const agreedPrice = Number(Number(raw.agreedPrice ?? raw.grossPrice ?? 0).toFixed(2));
      const agedPrice = Number(Number(raw.agedPrice ?? agreedPrice).toFixed(2));
      const grossPrice = Number(Number(raw.grossPrice ?? (agedPrice > 0 ? agedPrice : agreedPrice)).toFixed(2));
      const ricoNetPayout = Number(
        Number(raw.ricoNetPayout ?? Math.max(0, grossPrice - grossPrice * feeRate)).toFixed(2)
      );
      const ricoCommission = Math.max(0, Number((grossPrice - ricoNetPayout).toFixed(2)));
      const payoutStatus = raw.payoutStatus || (paidDate ? 'paid' : 'pending_payout');
      const normTitle = normalizeTitleKey(linked.title || raw.title || '');

      const baseSig = `${cleanTicket.toUpperCase()}|${ricoSku.toUpperCase()}|${normTitle}|${soldDate}|${ricoNetPayout.toFixed(2)}`;
      const occIdx = (seenPayoutSignatureCounts.get(baseSig) || 0) + 1;
      seenPayoutSignatureCounts.set(baseSig, occIdx);

      // Multiset 1-for-1 counters for `/api/product` fallback deduplication (never collapse repeat sales!)
      if (isFromPayoutTable) {
        if (ricoSku) {
          seenPayoutSkuCounts.set(ricoSku, (seenPayoutSkuCounts.get(ricoSku) || 0) + 1);
        }
        const rawNormT = normalizeTitleKey(raw.title || '');
        const coreNormT = stripCoreTitle(normTitle);
        for (const tCandidate of new Set([normTitle, rawNormT, coreNormT])) {
          if (tCandidate) {
            const tpKey = `${tCandidate}|${agreedPrice.toFixed(2)}`;
            seenPayoutTitlePriceCounts.set(tpKey, (seenPayoutTitlePriceCounts.get(tpKey) || 0) + 1);
            if (grossPrice !== agreedPrice) {
              const gpKey = `${tCandidate}|${grossPrice.toFixed(2)}`;
              seenPayoutTitlePriceCounts.set(gpKey, (seenPayoutTitlePriceCounts.get(gpKey) || 0) + 1);
            }
          }
        }
      }

      const syncLookupKey = `${cleanTicket.toUpperCase()}|${ricoSku.toUpperCase()}|${soldDate}|${ricoNetPayout.toFixed(2)}`;
      const isAlreadySynced = Boolean(
        alreadySyncedRicoKeys.has(syncLookupKey) ||
          (ricoSku && String(skuMetaMap[ricoSku]?.status || '').toLowerCase() === 'sold')
      );

      const partnerBucket = resolvePartnerBucket(ricoSku, linked.upc, '', linked.title || raw.title);
      const isPartnerBucketedZeroEj = Boolean(/^0EJ[A-Z0-9]+$/i.test(ricoSku) && partnerBucket);
      const rowMatched = linked.isMatchedInBooth || isPartnerBucketedZeroEj;

      const fallbackInternalId = cleanStr(raw.ricoItemId || raw.productId || cleanTicket || `row-${soldRows.length + 1}`);
      soldRows.push({
        partner: partnerBucket,
        partnerBucket,
        ricoItemId: ricoSku || fallbackInternalId,
        ricoSku: ricoSku || '',
        sku: ricoSku || '',
        upc: linked.upc || '',
        title: linked.title,
        saleNumber: saleNumber || (cleanTicket ? `#${cleanTicket}` : ''),
        payoutId: cleanTicket || saleNumber,
        occurrenceIndex: occIdx,
        agreedPrice,
        splitPct: cleanStr(raw.splitPct || `${100 - activeCommissionRate}%`),
        agedPrice,
        discounts: cleanStr(raw.discounts || ''),
        soldDate,
        paidDate,
        grossPrice,
        ricoNetPayout,
        ricoCommission,
        payoutStatus,
        status: payoutStatus === 'paid' ? 'Paid' : 'Sold',
        matchTier: linked.matchTier,
        isMatchedInBooth: rowMatched,
        matchedInBooth: rowMatched,
        alreadySynced: isAlreadySynced,
      });
    };

    const pendingSourceRows =
      cachedPayoutDomRows.length > 0 ? cachedPayoutDomRows : harvestedPendingPayoutRows;
    const paidHistorySourceRows =
      cachedPayoutHistoryDomRows.length > 0 ? cachedPayoutHistoryDomRows : harvestedPaidHistoryRows;

    // 1. Keep 100% of rows harvested from `Payout` (Current Unpaid Payout)
    for (const r of pendingSourceRows) {
      pushNormalizedSoldRow(r, true);
    }

    // 2. Keep 100% of rows harvested from `Payout History` (Settled Paid History across all paginated pages)
    for (const r of paidHistorySourceRows) {
      pushNormalizedSoldRow(r, true);
    }

    // 3. Merge any remaining sold items from Tab 1's `buildVerificationReport()` (`tab1AuditRows` / `/api/product`)
    // via 1-for-1 multiset counters (`seenPayoutSkuCounts` + `seenPayoutTitlePriceCounts`) so all `~367` sold items resolve cleanly without touching pagination buttons!
    // Catalog "Sold" items must NEVER create sales (Products sync is stock-only). Sales come ONLY from real Payout / Payout History rows
    // that carry a Ricochet ticket # and a real Sold date, so this catalog fallback loop is intentionally disabled.
    for (const auditRow of []) {
      if (auditRow.inventory !== 'Sold' && auditRow.inventory !== 'Paid') continue;

      const resolvedSku = cleanStr(auditRow.sku).toUpperCase();
      const agreedPrice = Number(Number(auditRow.agreedPrice || 0).toFixed(2));
      const prodTitle = cleanStr(auditRow.name || resolvedSku || 'Booth Sale Item');
      const resolvedUpc = cleanStr(auditRow.expectedRcUpc || auditRow.upc).toUpperCase();

      if (resolvedSku) {
        const remSkuCount = seenPayoutSkuCounts.get(resolvedSku) || 0;
        if (remSkuCount > 0) {
          seenPayoutSkuCounts.set(resolvedSku, remSkuCount - 1);
          const normT = normalizeTitleKey(prodTitle);
          if (normT) {
            const tpKey = `${normT}|${agreedPrice.toFixed(2)}`;
            const remTp = seenPayoutTitlePriceCounts.get(tpKey) || 0;
            if (remTp > 0) seenPayoutTitlePriceCounts.set(tpKey, remTp - 1);
          }
          continue;
        }
      }

      const normProdTitle = normalizeTitleKey(prodTitle);
      const coreProdTitle = stripCoreTitle(normProdTitle);
      if (normProdTitle) {
        const tpKey = `${normProdTitle}|${agreedPrice.toFixed(2)}`;
        const remTp = seenPayoutTitlePriceCounts.get(tpKey) || 0;
        if (remTp > 0) {
          seenPayoutTitlePriceCounts.set(tpKey, remTp - 1);
          continue;
        }
        if (coreProdTitle && coreProdTitle !== normProdTitle) {
          const coreTpKey = `${coreProdTitle}|${agreedPrice.toFixed(2)}`;
          const remCoreTp = seenPayoutTitlePriceCounts.get(coreTpKey) || 0;
          if (remCoreTp > 0) {
            seenPayoutTitlePriceCounts.set(coreTpKey, remCoreTp - 1);
            continue;
          }
        }
      }

      const p = resolvedSku ? productBySku.get(resolvedSku) : null;
      const firstItem =
        p && Array.isArray(p.items)
          ? p.items[0]
          : p && p.items && typeof p.items === 'object'
          ? Object.values(p.items).flat()[0]
          : null;
      const ricoCommission = Number((agreedPrice * feeRate).toFixed(2));
      const ricoNetPayout = Number(
        (
          parseFloat(String(p?.net ?? p?.net_payout ?? p?.payout ?? firstItem?.net ?? '').replace(/[^0-9.-]/g, '')) ||
          Math.max(0, agreedPrice - ricoCommission)
        ).toFixed(2)
      );
      const rawSoldDate = cleanStr(
        p?.sold_date ||
          p?.sold_at ||
          p?.paid_date ||
          p?.updated_at ||
          firstItem?.sold_date ||
          firstItem?.sold_at ||
          firstItem?.updated_at ||
          ''
      ).slice(0, 10);
      const isPaid = auditRow.inventory === 'Paid';
      const lastKnownPaidDate =
        (paidHistorySourceRows.find((r) => r && r.paidDate) || {}).paidDate || '';
      const fallbackPaidDate = isPaid ? cleanStr(p?.paid_date || rawSoldDate || lastKnownPaidDate) : null;

      pushNormalizedSoldRow({
        ricoItemId: resolvedSku || cleanStr(auditRow.productId) || `sold-item-${soldRows.length + 1}`,
        ricoSku: resolvedSku,
        sku: resolvedSku,
        upc: resolvedUpc,
        title: prodTitle,
        saleNumber: cleanStr(p?.sale_id || p?.ticket_number || firstItem?.sale_id || ''),
        agreedPrice,
        agedPrice: agreedPrice,
        splitPct: `${100 - activeCommissionRate}.00%`,
        soldDate: rawSoldDate || (isPaid ? fallbackPaidDate : ''),
        paidDate: fallbackPaidDate,
        grossPrice: agreedPrice,
        ricoNetPayout,
        ricoCommission,
        payoutStatus: isPaid ? 'paid' : 'pending_payout',
      }, false);
    }

    lastExtractedSalesRows = soldRows;
    return soldRows;
  }

  function getPartnerScopedSalesRows(rows) {
    if (activeSalesPartnerBucket === 'ALL') return rows;
    return rows.filter((r) => (r.partnerBucket || r.partner) === activeSalesPartnerBucket);
  }

  function updateSalesSyncTabUI() {
    const unscopedRows = extractRicochetSoldLines();

    // Partner Payout Split pills always show unfiltered per-bucket totals
    const bucketTotals = { ALL: { n: 0, net: 0 }, HUCK: { n: 0, net: 0 }, PDXGL: { n: 0, net: 0 }, BB: { n: 0, net: 0 } };
    for (const r of unscopedRows) {
      const b = r.partnerBucket || r.partner || 'HUCK';
      const net = Number(r.ricoNetPayout || 0);
      bucketTotals.ALL.n++;
      bucketTotals.ALL.net += net;
      if (bucketTotals[b]) {
        bucketTotals[b].n++;
        bucketTotals[b].net += net;
      }
    }
    for (const key of Object.keys(bucketTotals)) {
      const el = document.getElementById(`rc-sbkt-${key}`);
      if (el) el.textContent = `${bucketTotals[key].n} • $${bucketTotals[key].net.toFixed(2)}`;
    }
    document.querySelectorAll('.rc-sales-bucket-btn').forEach((btn) => {
      const sel = btn.getAttribute('data-rc-sales-bucket') === activeSalesPartnerBucket;
      btn.style.border = sel ? '1px solid #38bdf8' : '1px solid #334155';
      btn.style.background = sel ? 'rgba(56,189,248,0.16)' : '#0f172a';
      btn.style.color = sel ? '#f8fafc' : '#cbd5e1';
    });

    const allRows = getPartnerScopedSalesRows(unscopedRows);
    const tabBadge = document.getElementById('rc-tab-sales-badge');
    if (tabBadge) tabBadge.textContent = String(allRows.length);

    const pendingRows = allRows.filter((r) => r.payoutStatus === 'pending_payout');
    const paidRows = allRows.filter((r) => r.payoutStatus === 'paid');

    let pendingNetSum = 0;
    let paidNetSum = 0;
    let grossSum = 0;
    let netSum = 0;
    let matchedCount = 0;
    let unmatchedCount = 0;
    let syncedCount = 0;

    for (const r of allRows) {
      grossSum += Number(r.grossPrice || 0);
      netSum += Number(r.ricoNetPayout || 0);
      if (r.payoutStatus === 'pending_payout') pendingNetSum += Number(r.ricoNetPayout || 0);
      else paidNetSum += Number(r.ricoNetPayout || 0);
      if (r.isMatchedInBooth) matchedCount++;
      else unmatchedCount++;
      if (r.alreadySynced) syncedCount++;
    }

    let rentCreditsSum = 0;
    const scopedRentalAdjustments = activeSalesPartnerBucket === 'ALL' ? spaceRentalAdjustments : [];
    for (const adj of scopedRentalAdjustments) {
      rentCreditsSum += Number(adj.amount || 0);
    }
    if (scopedRentalAdjustments.length === 0 && activeSalesPartnerBucket === 'ALL' && activeMonthlyRent > 0) {
      rentCreditsSum = -Math.abs(activeMonthlyRent);
    }

    // Update Sub-Filter Pill Counts & Active Highlight
    const sfltAll = document.getElementById('rc-sflt-all');
    const sfltPending = document.getElementById('rc-sflt-pending');
    const sfltPaid = document.getElementById('rc-sflt-paid');
    const sfltRent = document.getElementById('rc-sflt-rent');
    if (sfltAll) sfltAll.textContent = String(allRows.length);
    if (sfltPending) sfltPending.textContent = String(pendingRows.length);
    if (sfltPaid) sfltPaid.textContent = String(paidRows.length);
    if (sfltRent) sfltRent.textContent = String(activeSalesPartnerBucket === 'ALL' ? spaceRentalAdjustments.length : 0);

    const filterBtns = document.querySelectorAll('.rc-sales-filter-btn');
    filterBtns.forEach((btn) => {
      const f = btn.getAttribute('data-rc-sales-filter');
      const isSelected = f === activeSalesSubFilter;
      btn.style.border = isSelected ? '1px solid #38bdf8' : '1px solid #334155';
      btn.style.background = isSelected ? 'rgba(56,189,248,0.16)' : '#0f172a';
      btn.style.color = isSelected ? '#f8fafc' : '#cbd5e1';
    });

    // Update KPI Pills
    const pendingEl = document.getElementById('rc-sales-kpi-pending');
    const rentEl = document.getElementById('rc-sales-kpi-rent');
    const paidEl = document.getElementById('rc-sales-kpi-paid');
    const foundEl = document.getElementById('rc-sales-kpi-found');
    const grossEl = document.getElementById('rc-sales-kpi-gross');
    const netEl = document.getElementById('rc-sales-kpi-net');
    const matchedEl = document.getElementById('rc-sales-kpi-matched');
    const unmatchedEl = document.getElementById('rc-sales-kpi-unmatched');
    const syncedEl = document.getElementById('rc-sales-kpi-synced');
    const previewCountEl = document.getElementById('rc-sales-preview-count');
    const previewListEl = document.getElementById('rc-sales-preview-list');
    const pushBtn = document.getElementById('rc-push-sales-btn');

    if (pendingEl) pendingEl.textContent = `$${pendingNetSum.toFixed(2)}`;
    if (rentEl) rentEl.textContent = `${rentCreditsSum < 0 ? '-' : ''}$${Math.abs(rentCreditsSum).toFixed(2)}`;
    if (paidEl) paidEl.textContent = `$${paidNetSum.toFixed(2)}`;
    if (foundEl) foundEl.textContent = String(allRows.length);
    if (grossEl) grossEl.textContent = `$${grossSum.toFixed(2)}`;
    if (netEl) netEl.textContent = `$${netSum.toFixed(2)}`;
    if (matchedEl) matchedEl.textContent = String(matchedCount);
    if (unmatchedEl) unmatchedEl.textContent = String(unmatchedCount);
    if (syncedEl) syncedEl.textContent = String(syncedCount);
    if (pushBtn && !isPushingSales) {
      pushBtn.textContent = `🧪 Stage Sales to Resale Core (${allRows.length} Dry-Run)`;
    }

    if (!previewListEl) return;

    if (activeSalesSubFilter === 'space_rental') {
      if (activeSalesPartnerBucket !== 'ALL') {
        if (previewCountEl) previewCountEl.textContent = '0 adjustments';
        previewListEl.innerHTML = `<div style="color:#94a3b8;padding:6px;">Space Rental &amp; Credits are not partner items — select <b>All Booth</b> to view them.</div>`;
        return;
      }
      if (previewCountEl) previewCountEl.textContent = `${spaceRentalAdjustments.length} adjustments`;
      if (spaceRentalAdjustments.length === 0) {
        previewListEl.innerHTML = `<div style="color:#94a3b8;padding:6px;">Configured Monthly Booth Rent: <b>-$${activeMonthlyRent.toFixed(2)}/mo</b> (No extra credit rows on /payouts).</div>`;
      } else {
        previewListEl.innerHTML = spaceRentalAdjustments
          .map(
            (adj) => `<div style="padding:6px 8px;border-radius:6px;background:#0f172a;border:1px solid rgba(244,63,94,0.35);display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="color:#fecdd3;font-weight:800;">🏢 ${adj.label}</div>
                <div style="color:#94a3b8;font-size:10px;">Date: ${adj.date || 'Current Cycle'}</div>
              </div>
              <strong style="color:#fda4af;font-family:monospace;">${adj.amount < 0 ? '-' : ''}$${Math.abs(Number(adj.amount || 0)).toFixed(2)}</strong>
            </div>`
          )
          .join('');
      }
      return;
    }

    const filteredRows =
      activeSalesSubFilter === 'pending_payout'
        ? pendingRows
        : activeSalesSubFilter === 'paid'
        ? paidRows
        : allRows;

    if (previewCountEl) previewCountEl.textContent = `${filteredRows.length} lines`;

    if (filteredRows.length === 0) {
      previewListEl.innerHTML = `<div style="color:#64748b;padding:6px;">${
        isHarvestingPayoutPages
          ? '⏳ Harvesting /payouts & /payout_history...'
          : 'No sold lines in this filter. Click 🔄 Harvest to re-scan.'
      }</div>`;
    } else {
      previewListEl.innerHTML = filteredRows
        .slice(0, 80)
        .map((r) => {
          const skuDisplay = r.sku || r.ricoSku || `#${r.ricoItemId}`;
          const upcDisplay = r.upc ? `• <span style="color:#38bdf8;">${r.upc}</span>` : '';
          const saleDisplay = r.saleNumber ? `<span style="color:#c084fc;">${r.saleNumber}</span> • ` : '';
          const statusPill =
            r.payoutStatus === 'pending_payout'
              ? `<span style="color:#fbbf24;">⏳ Pending</span>`
              : `<span style="color:#34d399;">✅ Paid ${r.paidDate || ''}</span>`;
          const matchBadge = r.isMatchedInBooth
            ? `<span style="color:#34d399;font-weight:800;" title="Matched via ${r.matchTier}">🔗 ${r.matchTier.toUpperCase()}</span>`
            : `<span style="color:#fbbf24;font-weight:800;">⚪ Unmatched</span>`;
          const partnerBadge =
            (r.partnerBucket || r.partner) === 'PDXGL'
              ? '🎲 PDXGL'
              : (r.partnerBucket || r.partner) === 'BB'
              ? '💛 B&amp;B'
              : '⭐ HUCK';
          return `<div style="padding:5px 7px;border-radius:6px;background:#0f172a;border:1px solid #334155;display:flex;justify-content:space-between;align-items:center;gap:6px;">
            <div style="min-width:0;flex:1;">
              <div style="color:#f8fafc;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                <span style="color:#a5b4fc;font-size:9.5px;">${partnerBadge}</span> <span style="color:#fbbf24;">${skuDisplay}</span> ${upcDisplay} — ${r.title}
              </div>
              <div style="color:#94a3b8;font-size:10px;">
                ${saleDisplay}Sold ${r.soldDate || '—'} • ${statusPill} • Agreed $${Number(r.agreedPrice || r.grossPrice || 0).toFixed(2)} ➔ Net <b>$${Number(r.ricoNetPayout || 0).toFixed(2)}</b>
              </div>
            </div>
            <div>${matchBadge}</div>
          </div>`;
        })
        .join('');
    }
  }

  async function pushSalesToResaleCore(options = {}) {
    const silent = Boolean(options && options.silent);
    if (isPushingSales) return;
    if (catalogProducts.length === 0) {
      await loadConsignorCatalog();
    }
    if (!hasHarvestedPayoutPages && !isHarvestingPayoutPages) {
      await harvestRicochetPayoutPages(false);
    }
    const rows = getPartnerScopedSalesRows(extractRicochetSoldLines());
    if (rows.length === 0 && silent) return;
    const pushBtn = document.getElementById('rc-push-sales-btn');
    const syncBanner = document.getElementById('rc-sales-sync-banner');
    isPushingSales = true;
    if (pushBtn && !silent) {
      pushBtn.disabled = true;
      pushBtn.textContent = `⏳ Staging ${rows.length} Sales (Dry-Run)...`;
    }

    let pushedData = null;
    let targetOrigin = RC_ORIGINS[0] || '';
    for (const endpoint of RC_SALES_SYNC_ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'stage',
            dryRun: true,
            locationCode: activeLocationCode,
            spaceRentalAdjustments: activeSalesPartnerBucket === 'ALL' ? spaceRentalAdjustments : [],
            partnerScope: activeSalesPartnerBucket,
            pendingTotalPayout: harvestedPendingTotalPayout,
            paidHistoryTotalPayout: harvestedPaidHistoryTotalPayout,
            // Cross-origin transport: RAW Export CSV text + every harvested Payout History page ride along in the POST
            // (only for the unscoped "All Booth" view so partner-filtered pushes never re-add other partners' rows)
            rawCsv:
              activeSalesPartnerBucket === 'ALL' && (capturedRawPayoutCsv || capturedRawPayoutHistoryCsv)
                ? { payout: capturedRawPayoutCsv, payoutHistory: capturedRawPayoutHistoryCsv }
                : undefined,
            payoutHistoryPages: activeSalesPartnerBucket === 'ALL' ? harvestedPaidHistoryPages : undefined,
            rows,
          }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data && data.ok) {
          pushedData = data.payload || data;
          try {
            targetOrigin = new URL(endpoint).origin;
          } catch (e) {}
          break;
        }
        if (res.status === 401 || res.status === 403) {
          break;
        }
      } catch (e) {}
    }

    isPushingSales = false;
    if (pushBtn) {
      pushBtn.disabled = false;
      pushBtn.textContent = `🧪 Stage Sales to Resale Core (${rows.length} Dry-Run)`;
    }

    const resolvedCode = (pushedData && pushedData.locationCode) || activeLocationCode;
    const reconcilerUrl = `${targetOrigin}/sales/import/${encodeURIComponent(resolvedCode)}`;
    salesPushSuccessUrl = reconcilerUrl;

    if (pushedData) {
      if (Array.isArray(pushedData.rows)) {
        for (const pr of pushedData.rows) {
          if (pr.alreadySynced) {
            const cleanTkt = cleanStr(pr.saleNumber || pr.payoutId || '').replace(/^#/, '');
            alreadySyncedRicoKeys.add(
              `${cleanTkt.toUpperCase()}|${cleanStr(pr.ricoSku || pr.sku).toUpperCase()}|${pr.soldDate}|${Number(pr.ricoNetPayout || 0).toFixed(2)}`
            );
          }
        }
      }
      if (rcBroadcastChannel) {
        try {
          rcBroadcastChannel.postMessage({
            type: 'RC_RICOCHET_SALES_SYNCED',
            locationCode: resolvedCode,
            payload: pushedData,
            timestamp: Date.now(),
          });
        } catch (e) {}
      }
      updateSalesSyncTabUI();
      if (syncBanner) {
        syncBanner.style.display = 'block';
        syncBanner.innerHTML = `
          <div style="font-weight:800;color:#6ee7b7;margin-bottom:4px;">
            🧪 Dry-Run Staged ${rows.length} sold lines to ${activeLocationName} Sales Reconciler (Zero DB writes until you approve)!
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
            <span>Matched: <b>${pushedData.summary?.matchedCount ?? pushedData.summary?.matchedInBooth ?? rows.length}</b> • Net Payout: <b>$${Number(pushedData.summary?.expectedNetPayout ?? pushedData.summary?.netPayout ?? 0).toFixed(2)}</b></span>
            <a href="${reconcilerUrl}" target="_blank" rel="noopener noreferrer" style="background:#10b981;color:#022c22;font-weight:800;padding:4px 10px;border-radius:6px;text-decoration:none;display:inline-flex;align-items:center;gap:4px;">
              ↗ Open Sales Reconciler
            </a>
          </div>
        `;
      }
      addLog(`🧪 Dry-Run Staged ${rows.length} sold lines to ${reconcilerUrl}`, '#10b981');
    } else {
      if (syncBanner) {
        syncBanner.style.display = 'block';
        syncBanner.innerHTML = `
          <div style="font-weight:800;color:#fde68a;margin-bottom:4px;">
            ⚠️ Cloud endpoint unreachable — click "📋 Copy Sales Sync JSON" below and paste into:
          </div>
          <a href="${reconcilerUrl}" target="_blank" rel="noopener noreferrer" style="color:#38bdf8;font-weight:800;text-decoration:underline;">
            ↗ Open Sales Reconciler (${reconcilerUrl})
          </a>
        `;
      }
    }
  }

  async function copySalesSyncJson() {
    if (!hasHarvestedPayoutPages) {
      await harvestRicochetPayoutPages(false);
    }
    const rows = extractRicochetSoldLines();
    const payloadStr = JSON.stringify(
      {
        locationCode: activeLocationCode,
        locationName: activeLocationName,
        syncedAt: new Date().toISOString(),
        dryRun: true,
        spaceRentalAdjustments,
        pendingTotalPayout: harvestedPendingTotalPayout,
        paidHistoryTotalPayout: harvestedPaidHistoryTotalPayout,
        rawCsv:
          capturedRawPayoutCsv || capturedRawPayoutHistoryCsv
            ? { payout: capturedRawPayoutCsv, payoutHistory: capturedRawPayoutHistoryCsv }
            : undefined,
        payoutHistoryPages: harvestedPaidHistoryPages,
        rows,
      },
      null,
      2
    );
    try {
      await navigator.clipboard.writeText(payloadStr);
      setStatusBanner('success', `📋 Copied ${rows.length} sold lines + ${spaceRentalAdjustments.length} rental adjustments as JSON!`);
    } catch (e) {
      const ta = document.getElementById('rc-sync-textarea');
      if (ta) {
        ta.value = payloadStr;
        ta.select();
        document.execCommand('copy');
      }
      setStatusBanner('success', `📋 Copied ${rows.length} sold lines as JSON!`);
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
        } else if (res.status === 401 || res.status === 403) {
          errMsg = data?.message || 'Sign in as a Founder (👑) or Curator (💎) to adopt booth tags.';
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
        if (res.status === 401 || res.status === 403) {
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
    a.download = `${activeLocationName.replace(/\s+/g, '')}_Barcode_Verification_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setStatusBanner('success', `📥 Downloaded Verification CSV (${report.rows.length} ${activeLocationName} items)!`);
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
        : `🚀 Filling in ${batch.length} missing ${activePartnerBucket === 'ALL' ? '' : activePartnerBucket + ' '}barcodes in ${activeLocationName}...`
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
      `🎉 ${singleTestMode ? 'Test Complete' : 'Sync Complete'}: ${successCount} updated, ${failCount} skipped/conflicts • ${finalReport.summary.verifiedMatch}/${finalReport.summary.totalCatalog} Verified in ${activeLocationName}!`
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }
})();

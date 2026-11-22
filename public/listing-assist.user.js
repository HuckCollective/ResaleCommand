// ==UserScript==
// @name         Works@TheHC — Listing Assistant (Poshmark · Depop · eBay · Whatnot)
// @namespace    https://works.thehc.llc
// @version      4.6.0
// @description  Guided browser cross-lister pulling queued Online Ready items, filling titles/copy/price/SKU/photos with 1-tap copy chips, and saving live listing links after human Submit.
// @match        https://*.poshmark.com/*
// @match        https://*.depop.com/*
// @match        https://*.ebay.com/*
// @match        https://*.whatnot.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  var SCRIPT_VERSION = window.__RC_SCRIPT_VERSION__ || 'v4.6';
  var PILL_ID = 'rc-list-assist-pill';
  var DRAWER_ID = 'rc-list-assist-drawer';

  // If same version is already mounted, just re-open & refresh instead of duplicating DOM
  if (
    window.__RC_LISTING_LIVE__ &&
    window.__RC_LISTING_LIVE__.version === SCRIPT_VERSION &&
    typeof window.__RC_LISTING_LIVE__.onBookmarkletClick === 'function'
  ) {
    window.__RC_LISTING_LIVE__.onBookmarkletClick();
    return;
  }

  var CORE = window.__RC_BML_CORE__ || null;
  var AUTH = window.__RC_BML_AUTH__ || null;

  if (CORE && typeof CORE.ensureShellStyles === 'function') {
    try { CORE.ensureShellStyles(); } catch (_e0) {}
  }

  var ORIGINS = (function () {
    var raw = window.__RC_ORIGINS__;
    if (raw && raw.length) return raw.slice();
    var one = window.__RC_ORIGIN__ || 'https://works.thehc.llc';
    return [one, 'https://works.thehc.llc', 'https://works.thehc.coop', 'https://resalecmd.com'];
  })();

  var PLATFORMS = {
    poshmark: {
      id: 'poshmark',
      label: 'Poshmark',
      emoji: '\uD83D\uDC57',
      hosts: ['poshmark.com'],
      createUrl: 'https://poshmark.com/create-listing',
      selectors: {
        title: [
          'input[data-vv-name="title"]',
          'input[placeholder*="What are you selling"]',
          'input[maxlength="80"]'
        ],
        description: [
          'textarea[data-vv-name="description"]',
          'textarea[placeholder*="Describe"]',
          'textarea'
        ],
        price: [
          'input[data-vv-name="listingPrice"]',
          'input[data-vv-name="price"]',
          'input[placeholder*="Listing Price"]'
        ],
        sku: [
          'input[data-vv-name="sku"]',
          'input[placeholder*="SKU"]'
        ],
        fileInput: ['input[type="file"][accept*="image"]', 'input[type="file"]']
      }
    },
    depop: {
      id: 'depop',
      label: 'Depop',
      emoji: '\uD83D\uDC55',
      hosts: ['depop.com'],
      createUrl: 'https://www.depop.com/products/create/',
      selectors: {
        title: ['input[name="title"]', 'input[data-testid*="title"]'],
        description: [
          'textarea[name="description"]',
          'textarea[data-testid*="description"]',
          'textarea'
        ],
        price: [
          'input[name="priceAmount"]',
          'input[name="price"]',
          'input[data-testid*="price"]'
        ],
        sku: ['input[name="sku"]'],
        fileInput: ['input[type="file"][accept*="image"]', 'input[type="file"]']
      }
    },
    ebay: {
      id: 'ebay',
      label: 'eBay',
      emoji: '\uD83D\uDCE6',
      hosts: ['ebay.com'],
      createUrl: 'https://www.ebay.com/sl/prelist/suggest',
      selectors: {
        title: [
          'input[name="title"]',
          'input[id*="title"]',
          'input[aria-label*="Title"]'
        ],
        description: [
          'textarea[name="description"]',
          'textarea[aria-label*="Description"]',
          'div[contenteditable="true"][role="textbox"]'
        ],
        price: [
          'input[name="price"]',
          'input[id*="price"]',
          'input[aria-label*="Buy It Now price"]'
        ],
        sku: [
          'input[name="customLabel"]',
          'input[aria-label*="Custom label"]',
          'input[aria-label*="SKU"]'
        ],
        fileInput: ['input[type="file"][accept*="image"]', 'input[type="file"]']
      }
    },
    whatnot: {
      id: 'whatnot',
      label: 'Whatnot',
      emoji: '\uD83D\uDCE1',
      hosts: ['whatnot.com'],
      createUrl: 'https://www.whatnot.com/dashboard/inventory',
      selectors: {
        title: [
          'input[name="name"]',
          'input[name="title"]',
          'input[placeholder*="Title"]'
        ],
        description: [
          'textarea[name="description"]',
          'textarea[placeholder*="Description"]',
          'textarea'
        ],
        price: [
          'input[name="price"]',
          'input[placeholder*="Price"]'
        ],
        sku: [
          'input[name="sku"]',
          'input[placeholder*="SKU"]'
        ],
        fileInput: ['input[type="file"][accept*="image"]', 'input[type="file"]']
      }
    }
  };

  var PLATFORM_ORDER = ['poshmark', 'depop', 'ebay', 'whatnot'];

  var state = {
    open: true,
    detectedPlatform: null,
    activePlatform: 'poshmark',
    loadingQueue: false,
    loadingPacket: false,
    fillingForm: false,
    savingPosted: false,
    queue: [],
    selectedIntent: null,
    packet: null,
    photoUrls: [],
    postedUrlInput: '',
    statusText: '',
    statusTone: 'info',
    fillReport: null,
    lastUrl: window.location.href
  };

  function detectPlatform(hostname) {
    var h = String(hostname || window.location.hostname || '').toLowerCase();
    for (var i = 0; i < PLATFORM_ORDER.length; i++) {
      var id = PLATFORM_ORDER[i];
      var hosts = PLATFORMS[id].hosts;
      for (var j = 0; j < hosts.length; j++) {
        if (h === hosts[j] || h.slice(-(hosts[j].length + 1)) === '.' + hosts[j]) {
          return id;
        }
      }
    }
    return null;
  }

  function getSession() {
    if (AUTH && typeof AUTH.getSession === 'function') {
      return AUTH.getSession();
    }
    return null;
  }

  function escHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setStatus(text, tone) {
    state.statusText = text || '';
    state.statusTone = tone || 'info';
    render();
  }

  function apiFetch(path, options, cb) {
    var sess = getSession();
    var opts = options || {};
    var headers = {};
    if (opts.headers) {
      for (var k in opts.headers) {
        if (Object.prototype.hasOwnProperty.call(opts.headers, k)) {
          headers[k] = opts.headers[k];
        }
      }
    }
    if (sess && sess.token) {
      headers['Authorization'] = 'Bearer ' + sess.token;
    }

    var idx = 0;
    function tryNext(lastErr) {
      if (idx >= ORIGINS.length) {
        cb(lastErr || new Error('Could not reach Works@TheHC right now.'), null);
        return;
      }
      var base = String(ORIGINS[idx++] || '').replace(/\/+$/, '');
      if (!base) {
        tryNext(lastErr);
        return;
      }
      fetch(base + path, {
        method: opts.method || 'GET',
        headers: headers,
        body: opts.body
      })
        .then(function (resp) {
          return resp.text().then(function (txt) {
            var parsed = null;
            try { parsed = txt ? JSON.parse(txt) : null; } catch (_pe) {}
            if (resp.status === 401 || resp.status === 403) {
              cb(new Error((parsed && (parsed.error || parsed.message)) || 'Please connect your 14-day member pass first.'), null);
              return;
            }
            if (!resp.ok) {
              cb(new Error((parsed && parsed.error) || ('Request failed (' + resp.status + ')')), parsed);
              return;
            }
            cb(null, parsed);
          });
        })
        .catch(function (err) {
          tryNext(err);
        });
    }
    tryNext(null);
  }

  function loadQueues() {
    var sess = getSession();
    if (!sess || !sess.token) {
      state.queue = [];
      state.loadingQueue = false;
      render();
      return;
    }

    state.loadingQueue = true;
    state.statusText = '';
    render();

    var locations = ['HH', 'HG'];
    var collected = [];
    var doneCount = 0;
    var firstErr = null;

    function finishOne() {
      doneCount += 1;
      if (doneCount < locations.length) return;
      state.loadingQueue = false;
      if (firstErr && collected.length === 0) {
        setStatus(firstErr.message || 'Could not load queued items.', 'error');
        return;
      }
      state.queue = collected;
      // Preserve selection if still present, else pick first matching active platform
      if (state.selectedIntent) {
        var stillThere = false;
        for (var k = 0; k < collected.length; k++) {
          if (collected[k].id === state.selectedIntent.id) {
            stillThere = true;
            break;
          }
        }
        if (!stillThere) {
          state.selectedIntent = null;
          state.packet = null;
          state.photoUrls = [];
        }
      }
      render();
    }

    for (var i = 0; i < locations.length; i++) {
      (function (locCode) {
        apiFetch('/api/sync/channel-outbox?location=' + encodeURIComponent(locCode), { method: 'GET' }, function (err, data) {
          if (err) {
            if (!firstErr) firstErr = err;
          } else if (data && data.pendingIntents && data.pendingIntents.length) {
            for (var j = 0; j < data.pendingIntents.length; j++) {
              var it = data.pendingIntents[j];
              if (it && it.action === 'publish_listing') {
                var plat = String(it.platform || (it.payload && it.payload.platform) || '').toLowerCase();
                if (PLATFORMS[plat]) {
                  collected.push({
                    id: it.id,
                    locationCode: it.locationCode || locCode,
                    platform: plat,
                    rcItemId: it.rcItemId || '',
                    rcUpc: it.rcUpc || '',
                    title: it.title || 'Untitled Item',
                    createdAt: it.createdAt || ''
                  });
                }
              }
            }
          }
          finishOne();
        });
      })(locations[i]);
    }
  }

  function selectIntent(intent) {
    state.selectedIntent = intent;
    state.packet = null;
    state.photoUrls = [];
    state.fillReport = null;
    state.postedUrlInput = looksLikeListingUrl(window.location.href, intent.platform) ? window.location.href : '';
    state.loadingPacket = true;
    state.statusText = '';
    render();

    var qs = '?itemId=' + encodeURIComponent(intent.rcItemId) + '&platform=' + encodeURIComponent(intent.platform);
    apiFetch('/api/bml/listing-packet' + qs, { method: 'GET' }, function (err, data) {
      state.loadingPacket = false;
      if (err || !data || !data.ok || !data.packet) {
        setStatus((err && err.message) || 'Could not load listing packet.', 'error');
        return;
      }
      state.packet = data.packet;
      state.photoUrls = data.photoUrls || [];
      render();
    });
  }

  function looksLikeListingUrl(href, platformId) {
    var u = String(href || '');
    if (u.indexOf('https://') !== 0) return false;
    if (u.indexOf('/create') !== -1 || u.indexOf('/prelist') !== -1 || u.indexOf('/dashboard') !== -1) return false;
    var meta = PLATFORMS[platformId];
    if (!meta) return false;
    for (var i = 0; i < meta.hosts.length; i++) {
      if (u.toLowerCase().indexOf(meta.hosts[i]) !== -1) return true;
    }
    return false;
  }

  function getMergedSelectors(platformId) {
    var base = PLATFORMS[platformId] ? PLATFORMS[platformId].selectors : {};
    var srv = window.__RC_BML_TOOL_CONFIG__ && window.__RC_BML_TOOL_CONFIG__.selectors && window.__RC_BML_TOOL_CONFIG__.selectors[platformId];
    if (!srv) return base;
    var merged = {};
    var keys = ['title', 'description', 'price', 'sku', 'fileInput'];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      merged[k] = (srv[k] && srv[k].length) ? srv[k].concat(base[k] || []) : (base[k] || []);
    }
    return merged;
  }

  function findFirstVisible(selectorList) {
    if (!selectorList) return null;
    for (var i = 0; i < selectorList.length; i++) {
      try {
        var el = document.querySelector(selectorList[i]);
        if (el) return el;
      } catch (_se) {}
    }
    return null;
  }

  function setNativeFieldValue(el, val) {
    if (!el) return false;
    try {
      if (el.getAttribute && el.getAttribute('contenteditable') === 'true') {
        el.focus();
        el.textContent = String(val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
        return true;
      }
      var tag = String(el.tagName || '').toUpperCase();
      var proto = tag === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      var desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) {
        desc.set.call(el, String(val));
      } else {
        el.value = String(val);
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
      return true;
    } catch (_ve) {
      return false;
    }
  }

  function attachPhotosToInput(fileInput, photoUrls, sku, cb) {
    if (!fileInput || !photoUrls || !photoUrls.length || typeof window.DataTransfer === 'undefined') {
      cb(0, photoUrls ? photoUrls.length : 0);
      return;
    }
    var primaryOrigin = String(ORIGINS[0] || 'https://works.thehc.llc').replace(/\/+$/, '');
    var limit = Math.min(photoUrls.length, 8);
    var files = [];
    var idx = 0;

    function fetchNext() {
      if (idx >= limit) {
        if (!files.length) {
          cb(0, limit);
          return;
        }
        try {
          var dt = new window.DataTransfer();
          for (var j = 0; j < files.length; j++) dt.items.add(files[j]);
          fileInput.files = dt.files;
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
          fileInput.dispatchEvent(new Event('input', { bubbles: true }));
          cb(files.length, limit);
        } catch (_dtErr) {
          cb(0, limit);
        }
        return;
      }
      var currentIdx = idx++;
      var proxyUrl = primaryOrigin + '/api/proxy-image?url=' + encodeURIComponent(photoUrls[currentIdx]);
      fetch(proxyUrl)
        .then(function (r) {
          if (!r.ok) throw new Error('photo fetch failed');
          return r.blob();
        })
        .then(function (blob) {
          var mime = blob.type || 'image/jpeg';
          var ext = mime.indexOf('png') !== -1 ? 'png' : mime.indexOf('webp') !== -1 ? 'webp' : 'jpg';
          var fname = (sku || 'item') + '-' + (currentIdx + 1) + '.' + ext;
          files.push(new File([blob], fname, { type: mime }));
          fetchNext();
        })
        .catch(function () {
          fetchNext();
        });
    }
    fetchNext();
  }

  function runGuidedFill() {
    if (!state.packet || state.fillingForm) return;
    var pkt = state.packet;
    var sel = getMergedSelectors(pkt.platform);
    state.fillingForm = true;
    state.fillReport = null;
    setStatus('Filling form fields and attaching photos...', 'info');

    var filled = [];
    var manual = [];

    if (pkt.title) {
      var tEl = findFirstVisible(sel.title);
      if (tEl && setNativeFieldValue(tEl, pkt.title)) filled.push('Title');
      else manual.push('Title');
    }
    if (pkt.description) {
      var dEl = findFirstVisible(sel.description);
      if (dEl && setNativeFieldValue(dEl, pkt.description)) filled.push('Description');
      else manual.push('Description');
    }
    if (pkt.priceFormatted) {
      var pEl = findFirstVisible(sel.price);
      if (pEl && setNativeFieldValue(pEl, pkt.priceFormatted)) filled.push('Price');
      else manual.push('Price');
    }
    if (pkt.sku) {
      var sEl = findFirstVisible(sel.sku);
      if (sEl && setNativeFieldValue(sEl, pkt.sku)) filled.push('SKU');
      else manual.push('SKU');
    }

    var fEl = findFirstVisible(sel.fileInput);
    attachPhotosToInput(fEl, state.photoUrls, pkt.sku, function (attachedCount, totalCount) {
      state.fillingForm = false;
      if (totalCount > 0) {
        if (attachedCount > 0) filled.push('Photos (' + attachedCount + '/' + totalCount + ')');
        else manual.push('Photos (' + totalCount + ' links below)');
      }
      state.fillReport = { filled: filled, manual: manual };
      setStatus(
        'Filled ' + filled.length + ' field(s). Pick category/size dropdowns and press Submit on this page yourself.',
        filled.length > 0 ? 'success' : 'warning'
      );
    });
  }

  function copyText(label, text) {
    var value = String(text || '');
    if (!value) {
      setStatus('Nothing to copy for ' + label + '.', 'warning');
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(
        function () { setStatus('Copied ' + label + '!', 'success'); },
        function () { fallbackCopy(label, value); }
      );
    } else {
      fallbackCopy(label, value);
    }
  }

  function fallbackCopy(label, value) {
    try {
      var ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setStatus('Copied ' + label + '!', 'success');
    } catch (_ce) {
      setStatus('Could not copy ' + label + ' automatically.', 'error');
    }
  }

  function markPostedAndSave() {
    if (!state.selectedIntent || !state.packet || state.savingPosted) return;
    var urlVal = String(state.postedUrlInput || '').trim();
    if (urlVal.indexOf('https://') !== 0) {
      setStatus('Paste the full live https:// listing URL before clicking Mark Posted.', 'warning');
      return;
    }

    state.savingPosted = true;
    setStatus('Saving live listing link to Official Ledger...', 'info');

    var payload = {
      mode: 'mark_posted',
      itemId: state.selectedIntent.rcItemId,
      platform: state.selectedIntent.platform,
      listingUrl: urlVal,
      listedPrice: state.packet.priceFormatted || '',
      intentId: state.selectedIntent.id,
      locationCode: state.selectedIntent.locationCode
    };

    apiFetch(
      '/api/bml/listing-packet',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      },
      function (err, data) {
        state.savingPosted = false;
        if (err || !data || !data.ok) {
          setStatus((err && err.message) || 'Could not save live listing link.', 'error');
          return;
        }
        if (CORE && typeof CORE.notifyTabsUpdated === 'function') {
          CORE.notifyTabsUpdated('RC_LISTING_POSTED', {
            itemId: payload.itemId,
            platform: payload.platform,
            listingUrl: urlVal
          });
        }
        state.selectedIntent = null;
        state.packet = null;
        state.photoUrls = [];
        state.postedUrlInput = '';
        state.fillReport = null;
        setStatus('Saved live link and cleared item from browser queue!', 'success');
        loadQueues();
      }
    );
  }

  function getFilteredQueue() {
    var out = [];
    for (var i = 0; i < state.queue.length; i++) {
      if (state.queue[i].platform === state.activePlatform) {
        out.push(state.queue[i]);
      }
    }
    return out;
  }

  function countForPlatform(platId) {
    var c = 0;
    for (var i = 0; i < state.queue.length; i++) {
      if (state.queue[i].platform === platId) c += 1;
    }
    return c;
  }

  function ensureShellDom() {
    var pill = document.getElementById(PILL_ID);
    if (!pill) {
      pill = document.createElement('button');
      pill.id = PILL_ID;
      pill.type = 'button';
      pill.setAttribute(
        'style',
        'position:fixed;bottom:16px;right:16px;z-index:2147483646;display:none;align-items:center;gap:8px;padding:10px 14px;border-radius:999px;border:1px solid rgba(255,255,255,0.22);background:#1b1f2a;color:#fff;font:700 13px/1.2 system-ui,-apple-system,sans-serif;box-shadow:0 10px 26px rgba(0,0,0,0.35);cursor:pointer;'
      );
      pill.onclick = function () {
        state.open = true;
        render();
      };
      document.body.appendChild(pill);
    }

    var drawer = document.getElementById(DRAWER_ID);
    if (!drawer) {
      drawer = document.createElement('aside');
      drawer.id = DRAWER_ID;
      drawer.setAttribute(
        'style',
        'position:fixed;top:0;right:0;bottom:0;height:100dvh;width:410px;max-width:96vw;z-index:2147483647;display:flex;flex-direction:column;background:#141821;color:#f3f4f6;border-left:1px solid rgba(255,255,255,0.12);box-shadow:-12px 0 36px rgba(0,0,0,0.45);font:400 13px/1.45 system-ui,-apple-system,sans-serif;box-sizing:border-box;'
      );
      document.body.appendChild(drawer);
    }
    return { pill: pill, drawer: drawer };
  }

  function render() {
    var dom = ensureShellDom();
    var pill = dom.pill;
    var drawer = dom.drawer;
    var sess = getSession();
    var totalCount = state.queue.length;
    var activeMeta = PLATFORMS[state.activePlatform] || PLATFORMS.poshmark;

    // Mutually-exclusive Pill <-> Drawer geometry
    if (!state.open) {
      drawer.style.display = 'none';
      pill.style.display = 'inline-flex';
      pill.textContent = '\uD83D\uDE80 Listing Assistant' + (totalCount > 0 ? ' (' + totalCount + ')' : '');
      return;
    }

    pill.style.display = 'none';
    drawer.style.display = 'flex';

    var headerHtml =
      '<div class="rc-bml-drawer-header" style="flex:0 0 auto;padding:12px 14px;background:#1c2230;border-bottom:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
        '<div>' +
          '<div style="font-weight:800;font-size:14px;color:#fff;">\uD83D\uDE80 Works@TheHC Listing Assistant</div>' +
          '<div style="font-size:11px;color:#9ca3af;">' +
            (sess ? 'Signed in: ' + escHtml(sess.name) + ' (' + escHtml(sess.prefix) + ')' : 'Connect 14-day member pass to load queue') +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:6px;">' +
          '<button type="button" data-rc-act="refresh" style="padding:6px 9px;border-radius:8px;border:1px solid rgba(255,255,255,0.18);background:#252d3f;color:#fff;font-weight:700;font-size:11px;cursor:pointer;">Refresh</button>' +
          '<button type="button" data-rc-act="minimize" style="padding:6px 9px;border-radius:8px;border:1px solid rgba(255,255,255,0.18);background:#252d3f;color:#fff;font-weight:700;font-size:11px;cursor:pointer;">Hide</button>' +
        '</div>' +
      '</div>';

    var bodyParts = [];

    if (!sess || !sess.token) {
      bodyParts.push(
        '<div style="padding:14px;border-radius:12px;background:#1f2738;border:1px solid rgba(251,191,36,0.35);margin-bottom:12px;">' +
          '<div style="font-weight:800;margin-bottom:6px;color:#fde68a;">Connect Your 14-Day Member Pass</div>' +
          '<div style="font-size:12px;color:#d1d5db;margin-bottom:10px;">Tap below once on this browser to link your Collective pass without typing passwords into third-party pages.</div>' +
          '<button type="button" data-rc-act="connect" style="width:100%;padding:10px;border-radius:10px;border:none;background:#6366f1;color:#fff;font-weight:800;cursor:pointer;">Connect Works@TheHC</button>' +
        '</div>'
      );
    } else {
      // Platform switcher tabs
      var tabsHtml = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px;">';
      for (var t = 0; t < PLATFORM_ORDER.length; t++) {
        var pid = PLATFORM_ORDER[t];
        var pm = PLATFORMS[pid];
        var cnt = countForPlatform(pid);
        var isAct = pid === state.activePlatform;
        tabsHtml +=
          '<button type="button" data-rc-plat="' + pid + '" style="padding:7px 4px;border-radius:10px;border:1px solid ' +
          (isAct ? '#818cf8' : 'rgba(255,255,255,0.12)') +
          ';background:' + (isAct ? 'rgba(99,102,241,0.28)' : '#1c2230') +
          ';color:#fff;font-weight:700;font-size:11px;cursor:pointer;text-align:center;">' +
          pm.emoji + ' ' + escHtml(pm.label) + (cnt > 0 ? ' (' + cnt + ')' : '') +
          '</button>';
      }
      tabsHtml += '</div>';
      bodyParts.push(tabsHtml);

      if (state.detectedPlatform && state.detectedPlatform !== state.activePlatform) {
        bodyParts.push(
          '<div style="padding:8px 10px;border-radius:10px;background:rgba(59,130,246,0.16);border:1px solid rgba(59,130,246,0.35);font-size:11px;margin-bottom:10px;">' +
            'Viewing <strong>' + escHtml(activeMeta.label) + '</strong> queue. ' +
            '<a href="' + escHtml(activeMeta.createUrl) + '" target="_blank" rel="noopener" style="color:#93c5fd;font-weight:700;text-decoration:underline;">Open ' + escHtml(activeMeta.label) + ' Create Page \u2197</a>' +
          '</div>'
        );
      }

      if (state.statusText) {
        var bg = state.statusTone === 'error'
          ? 'rgba(239,68,68,0.18)'
          : state.statusTone === 'success'
            ? 'rgba(16,185,129,0.18)'
            : state.statusTone === 'warning'
              ? 'rgba(245,158,11,0.18)'
              : 'rgba(99,102,241,0.18)';
        bodyParts.push(
          '<div style="padding:9px 11px;border-radius:10px;background:' + bg + ';border:1px solid rgba(255,255,255,0.14);font-size:12px;margin-bottom:10px;">' +
            escHtml(state.statusText) +
          '</div>'
        );
      }

      if (state.loadingQueue) {
        bodyParts.push('<div style="padding:18px;text-align:center;color:#9ca3af;">Loading browser queue...</div>');
      } else if (state.selectedIntent) {
        bodyParts.push(
          '<button type="button" data-rc-act="back" style="margin-bottom:10px;padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.16);background:#1c2230;color:#e5e7eb;font-weight:700;font-size:11px;cursor:pointer;">\u2190 Back to ' + escHtml(activeMeta.label) + ' Queue</button>'
        );
        if (state.loadingPacket) {
          bodyParts.push('<div style="padding:18px;text-align:center;color:#9ca3af;">Loading listing packet...</div>');
        } else if (state.packet) {
          var pkt = state.packet;
          bodyParts.push(
            '<div style="padding:12px;border-radius:12px;background:#1c2230;border:1px solid rgba(255,255,255,0.12);margin-bottom:10px;">' +
              '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;">' +
                '<span style="font-family:monospace;font-weight:800;font-size:11px;padding:2px 7px;border-radius:6px;background:rgba(99,102,241,0.3);color:#c7d2fe;">' + escHtml(pkt.sku || 'NO-SKU') + '</span>' +
                '<span style="font-family:monospace;font-weight:800;font-size:13px;color:#6ee7b7;">' + (pkt.priceFormatted ? '$' + escHtml(pkt.priceFormatted) : 'No price set') + '</span>' +
              '</div>' +
              '<div style="font-weight:800;font-size:13px;color:#fff;margin-bottom:4px;">' + escHtml(pkt.title) + '</div>' +
              '<div style="font-size:11px;color:#9ca3af;margin-bottom:8px;">' + escHtml(pkt.condition) + ' \u2022 ' + state.photoUrls.length + ' photo(s) \u2022 ' + escHtml(pkt.feeSummary) + '</div>' +
              '<button type="button" data-rc-act="fill" ' + (state.fillingForm ? 'disabled ' : '') + 'style="width:100%;padding:10px;border-radius:10px;border:none;background:#4f46e5;color:#fff;font-weight:800;font-size:13px;cursor:pointer;">' +
                (state.fillingForm ? 'Filling form...' : '\u26A1 Fill Form & Attach Photos') +
              '</button>' +
              '<div style="font-size:11px;color:#fcd34d;margin-top:8px;">Review category/size dropdowns &amp; click Submit on this site yourself \u2014 we never auto-post.</div>' +
            '</div>'
          );

          // 1-Tap Copy Chips (always available if selectors miss or for dropdowns)
          bodyParts.push(
            '<div style="padding:11px;border-radius:12px;background:#1c2230;border:1px solid rgba(255,255,255,0.1);margin-bottom:10px;">' +
              '<div style="font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#9ca3af;margin-bottom:8px;">1-Tap Copy Chips</div>' +
              '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
                '<button type="button" data-rc-copy="title" style="padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.18);background:#252d3f;color:#fff;font-weight:700;font-size:11px;cursor:pointer;">Copy Title</button>' +
                '<button type="button" data-rc-copy="description" style="padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.18);background:#252d3f;color:#fff;font-weight:700;font-size:11px;cursor:pointer;">Copy Description</button>' +
                '<button type="button" data-rc-copy="price" style="padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.18);background:#252d3f;color:#fff;font-weight:700;font-size:11px;cursor:pointer;">Copy Price</button>' +
                '<button type="button" data-rc-copy="sku" style="padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.18);background:#252d3f;color:#fff;font-weight:700;font-size:11px;cursor:pointer;">Copy SKU</button>' +
                '<button type="button" data-rc-copy="condition" style="padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.18);background:#252d3f;color:#fff;font-weight:700;font-size:11px;cursor:pointer;">Copy Condition</button>' +
                (pkt.hashtags && pkt.hashtags.length
                  ? '<button type="button" data-rc-copy="hashtags" style="padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.18);background:#252d3f;color:#fff;font-weight:700;font-size:11px;cursor:pointer;">Copy Hashtags</button>'
                  : '') +
              '</div>' +
            '</div>'
          );

          // Photo preview links (fallback if site blocks DataTransfer file input)
          if (state.photoUrls.length > 0) {
            var photoLinks = '<div style="padding:10px;border-radius:12px;background:#1c2230;border:1px solid rgba(255,255,255,0.1);margin-bottom:10px;"><div style="font-weight:800;font-size:11px;text-transform:uppercase;color:#9ca3af;margin-bottom:6px;">Photos (' + state.photoUrls.length + ')</div><div style="display:flex;gap:6px;flex-wrap:wrap;">';
            for (var p = 0; p < state.photoUrls.length; p++) {
              photoLinks += '<a href="' + escHtml(state.photoUrls[p]) + '" target="_blank" rel="noopener" style="font-size:11px;padding:4px 8px;border-radius:6px;background:#252d3f;color:#93c5fd;text-decoration:none;font-weight:700;">Photo ' + (p + 1) + ' \u2197</a>';
            }
            photoLinks += '</div></div>';
            bodyParts.push(photoLinks);
          }

          // Mark Posted & Save Live URL
          bodyParts.push(
            '<div style="padding:12px;border-radius:12px;background:#1c2230;border:1px solid rgba(16,185,129,0.35);">' +
              '<div style="font-weight:800;font-size:12px;color:#6ee7b7;margin-bottom:6px;">After You Click Submit</div>' +
              '<div style="display:flex;gap:6px;margin-bottom:8px;">' +
                '<input id="rc-posted-url-input" type="url" value="' + escHtml(state.postedUrlInput) + '" placeholder="https://..." style="flex:1;min-width:0;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:#0f131c;color:#fff;font-family:monospace;font-size:11px;" />' +
                '<button type="button" data-rc-act="use-page-url" style="padding:6px 8px;border-radius:8px;border:1px solid rgba(255,255,255,0.18);background:#252d3f;color:#fff;font-weight:700;font-size:11px;cursor:pointer;white-space:nowrap;">Use Tab URL</button>' +
              '</div>' +
              '<button type="button" data-rc-act="mark-posted" ' + (state.savingPosted ? 'disabled ' : '') + 'style="width:100%;padding:9px;border-radius:10px;border:none;background:#059669;color:#fff;font-weight:800;font-size:12px;cursor:pointer;">' +
                (state.savingPosted ? 'Saving live link...' : '\u2705 Mark Posted & Save Live URL') +
              '</button>' +
            '</div>'
          );
        }
      } else {
        var list = getFilteredQueue();
        if (list.length === 0) {
          bodyParts.push(
            '<div style="padding:18px;border-radius:12px;background:#1c2230;border:1px dashed rgba(255,255,255,0.18);text-align:center;">' +
              '<div style="font-weight:800;margin-bottom:4px;">No ' + escHtml(activeMeta.label) + ' items queued yet</div>' +
              '<div style="font-size:12px;color:#9ca3af;margin-bottom:10px;">Open any item in Works@TheHC \u2192 Online tab and click Queue ' + escHtml(activeMeta.label) + '.</div>' +
              '<a href="' + escHtml(activeMeta.createUrl) + '" target="_blank" rel="noopener" style="display:inline-block;padding:8px 12px;border-radius:8px;background:#252d3f;color:#93c5fd;font-weight:700;font-size:12px;text-decoration:none;">Open ' + escHtml(activeMeta.label) + ' Create Page \u2197</a>' +
            '</div>'
          );
        } else {
          for (var q = 0; q < list.length; q++) {
            var qItem = list[q];
            bodyParts.push(
              '<button type="button" data-rc-intent-idx="' + q + '" style="width:100%;text-align:left;padding:11px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);background:#1c2230;color:#fff;margin-bottom:8px;cursor:pointer;display:block;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:4px;">' +
                  '<span style="font-family:monospace;font-weight:800;font-size:11px;color:#a5b4fc;">' + escHtml(qItem.rcUpc || 'NO-SKU') + '</span>' +
                  '<span style="font-size:10px;color:#9ca3af;">' + escHtml(qItem.locationCode) + ' Online Bin</span>' +
                '</div>' +
                '<div style="font-weight:700;font-size:12px;color:#f9fafb;">' + escHtml(qItem.title) + '</div>' +
              '</button>'
            );
          }
        }
      }
    }

    drawer.innerHTML =
      headerHtml +
      '<div class="rc-bml-drawer-body" style="flex:1 1 auto;overflow-y:auto;padding:12px 14px;">' +
        bodyParts.join('') +
      '</div>';

    bindDrawerEvents(drawer);
  }

  function bindDrawerEvents(drawer) {
    var btns = drawer.querySelectorAll('[data-rc-act]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].onclick = function () {
        var act = this.getAttribute('data-rc-act');
        if (act === 'minimize') {
          state.open = false;
          render();
        } else if (act === 'refresh') {
          loadQueues();
        } else if (act === 'connect') {
          if (AUTH && typeof AUTH.openConnectFlow === 'function') {
            AUTH.openConnectFlow();
          }
        } else if (act === 'back') {
          state.selectedIntent = null;
          state.packet = null;
          state.photoUrls = [];
          state.fillReport = null;
          state.statusText = '';
          render();
        } else if (act === 'fill') {
          runGuidedFill();
        } else if (act === 'use-page-url') {
          state.postedUrlInput = window.location.href;
          render();
        } else if (act === 'mark-posted') {
          markPostedAndSave();
        }
      };
    }

    var platBtns = drawer.querySelectorAll('[data-rc-plat]');
    for (var p = 0; p < platBtns.length; p++) {
      platBtns[p].onclick = function () {
        state.activePlatform = this.getAttribute('data-rc-plat') || 'poshmark';
        state.selectedIntent = null;
        state.packet = null;
        state.photoUrls = [];
        state.statusText = '';
        render();
      };
    }

    var intentBtns = drawer.querySelectorAll('[data-rc-intent-idx]');
    var filtered = getFilteredQueue();
    for (var q = 0; q < intentBtns.length; q++) {
      intentBtns[q].onclick = function () {
        var idx = parseInt(this.getAttribute('data-rc-intent-idx'), 10);
        if (!isNaN(idx) && filtered[idx]) {
          selectIntent(filtered[idx]);
        }
      };
    }

    var copyBtns = drawer.querySelectorAll('[data-rc-copy]');
    for (var c = 0; c < copyBtns.length; c++) {
      copyBtns[c].onclick = function () {
        if (!state.packet) return;
        var field = this.getAttribute('data-rc-copy');
        if (field === 'title') copyText('Title', state.packet.title);
        else if (field === 'description') copyText('Description', state.packet.description);
        else if (field === 'price') copyText('Price', state.packet.priceFormatted);
        else if (field === 'sku') copyText('SKU', state.packet.sku);
        else if (field === 'condition') copyText('Condition', state.packet.condition);
        else if (field === 'hashtags') copyText('Hashtags', (state.packet.hashtags || []).join(' '));
      };
    }

    var urlInput = drawer.querySelector('#rc-posted-url-input');
    if (urlInput) {
      urlInput.oninput = function () {
        state.postedUrlInput = this.value;
      };
    }
  }

  function onBookmarkletClick() {
    var detected = detectPlatform(window.location.hostname);
    state.detectedPlatform = detected;
    if (detected) state.activePlatform = detected;
    state.open = true;
    render();
    loadQueues();
  }

  window.__RC_LISTING_LIVE__ = {
    version: SCRIPT_VERSION,
    onBookmarkletClick: onBookmarkletClick
  };

  if (CORE && typeof CORE.registerLive === 'function') {
    try { CORE.registerLive('listing_assist', window.__RC_LISTING_LIVE__); } catch (_re) {}
  }

  // Watch SPA navigation so switching pages inside Poshmark/Depop/eBay/Whatnot updates detected URL
  if (CORE && typeof CORE.watchSpaLocation === 'function') {
    CORE.watchSpaLocation(function (newHref) {
      state.lastUrl = newHref;
      var det = detectPlatform(window.location.hostname);
      if (det) state.detectedPlatform = det;
      if (state.selectedIntent && looksLikeListingUrl(newHref, state.selectedIntent.platform) && !state.postedUrlInput) {
        state.postedUrlInput = newHref;
        render();
      }
    });
  }

  window.addEventListener('rc-bml-connected', function () {
    loadQueues();
  });

  onBookmarkletClick();
})();

import type { APIRoute } from 'astro';
import { SYNC_FALLBACK_ORIGINS } from '../../site-config';
import { buildInjectableBmlAuthRuntimeJs } from '../../lib/bml/clientCore';

export const prerender = false;

const CORS_NO_STORE_HEADERS = {
  'Content-Type': 'application/javascript; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-RC-BML-Token',
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: CORS_NO_STORE_HEADERS });
};

export const GET: APIRoute = async ({ url }) => {
  const activeOrigins = Array.from(new Set([url.origin, ...SYNC_FALLBACK_ORIGINS]));
  const authRuntimeJs = buildInjectableBmlAuthRuntimeJs(activeOrigins, url.origin);

  const diagnosticBodyJs = `
(function() {
  var ORIGIN = window.__RC_ORIGIN__ || ${JSON.stringify(url.origin)};
  var ORIGINS = window.__RC_ORIGINS__ || ${JSON.stringify(activeOrigins)};

  // Remove any legacy auth banner since the diagnostic pill handles auth inline
  var oldBanner = document.getElementById('rc-bml-auth-guard-bar');
  if (oldBanner) oldBanner.remove();

  var state = {
    modalOpen: false,
    scriptLoaded: true,
    pingOk: null,
    pingMs: null,
    pingServerOrigin: null,
    pingAuthValid: false,
    pingError: null,
    storageOk: false,
    popupFnOk: typeof window.open === 'function',
    pageType: 'unknown',
    pageDetail: '',
    domSummary: '',
    headersFound: [],
    sampleRow: '',
    rowCount: 0,
    itemLinkCount: 0
  };

  function testStorage() {
    try {
      var k = '__rc_bml_diag_test__';
      localStorage.setItem(k, '1');
      var v = localStorage.getItem(k);
      localStorage.removeItem(k);
      state.storageOk = v === '1';
    } catch (_e) {
      state.storageOk = false;
    }
  }

  function cleanText(s) {
    return String(s || '').replace(/\\s+/g, ' ').trim();
  }

  function inspectPageDom() {
    var host = (window.location.hostname || '').toLowerCase();
    var path = (window.location.pathname || '').toLowerCase();

    if (host.indexOf('shopgoodwill.com') !== -1) {
      if (path.indexOf('/item/') !== -1) {
        state.pageType = 'sgw:item';
      } else if (path.indexOf('inprogress-auctions') !== -1 || path.indexOf('in-progress') !== -1) {
        state.pageType = 'sgw:inprogress-auctions';
      } else if (path.indexOf('closed-auctions') !== -1) {
        state.pageType = 'sgw:closed-auctions';
      } else if (path.indexOf('shipped-orders') !== -1 || path.indexOf('open-orders') !== -1) {
        state.pageType = 'sgw:shipped-orders';
      } else {
        state.pageType = 'sgw:other (' + path + ')';
      }
    } else if (host.indexOf('ricoconsign.com') !== -1) {
      state.pageType = 'ricochet:' + path;
    } else {
      state.pageType = 'other (' + host + path + ')';
    }

    // Count item links (/item/123456789)
    var itemLinks = Array.prototype.slice.call(document.querySelectorAll('a[href*="/item/"]'));
    var uniqueItemIds = {};
    itemLinks.forEach(function(a) {
      var m = String(a.getAttribute('href') || '').match(/\\/item\\/(\\d+)/);
      if (m && m[1]) uniqueItemIds[m[1]] = cleanText(a.textContent) || uniqueItemIds[m[1]] || m[1];
    });
    var itemIdList = Object.keys(uniqueItemIds);
    state.itemLinkCount = itemIdList.length;

    // Collect table headers if any table is present
    var ths = Array.prototype.slice.call(document.querySelectorAll('table thead th, table tr:first-child th, [role="columnheader"]'));
    var headers = [];
    ths.forEach(function(th) {
      var t = cleanText(th.textContent);
      if (t && headers.indexOf(t) === -1 && headers.length < 15) headers.push(t);
    });
    state.headersFound = headers;

    // Count table body rows or card blocks
    var trs = Array.prototype.slice.call(document.querySelectorAll('table tbody tr'));
    var cards = Array.prototype.slice.call(document.querySelectorAll('app-item-card, .item-card, [class*="auction-item"], [class*="order-row"]'));
    state.rowCount = trs.length > 0 ? trs.length : cards.length;

    if (state.pageType === 'sgw:item') {
      var urlIdMatch = path.match(/\\/item\\/(\\d+)/);
      var itemId = urlIdMatch ? urlIdMatch[1] : 'unknown';
      var h1 = cleanText((document.querySelector('h1') || {}).textContent || '');
      var bodyText = cleanText((document.body || {}).innerText || '');
      var priceMatch = bodyText.match(/(?:Current Price|Minimum Bid|Buy Now Price)\\s*:?\\s*\\$([0-9,.]+)/i);
      var shipMatch = bodyText.match(/(?:Shipping|Est\\. Shipping|Handling)\\s*:?\\s*\\$([0-9,.]+)/i);
      var sellerMatch = bodyText.match(/Seller\\s*:?\\s*([^\\n\\r]{3,60})/i);
      var imgCount = document.querySelectorAll('img[src*="shopgoodwill"], img[src*="azureedge"], img[src*="cloudfront"]').length;
      state.domSummary = 'Item #' + itemId + ' | Title: ' + (h1 ? 'YES (' + h1.slice(0, 32) + '...)' : 'NO') + ' | Price: ' + (priceMatch ? '$' + priceMatch[1] : 'n/a') + ' | Imgs: ' + imgCount;
      state.sampleRow = 'Seller: ' + (sellerMatch ? cleanText(sellerMatch[1]).slice(0, 40) : 'n/a') + ' | ShipText: ' + (shipMatch ? '$' + shipMatch[1] : 'n/a');
    } else {
      var bodyStr = cleanText((document.body || {}).innerText || '');
      var hasOutbidWord = /\\b(outbid|winning|high bidder|won|lost)\\b/i.test(bodyStr);
      var hasTrackingWord = /\\b(tracking|fedex|usps|ups|shipped)\\b/i.test(bodyStr);
      state.domSummary = 'TRs: ' + trs.length + ' | ItemLinks: ' + state.itemLinkCount + ' | BidStatusText: ' + (hasOutbidWord ? 'YES' : 'NO') + ' | TrackText: ' + (hasTrackingWord ? 'YES' : 'NO');

      if (trs.length > 0) {
        var firstCells = Array.prototype.slice.call(trs[0].querySelectorAll('td')).map(function(td) {
          return cleanText(td.textContent).slice(0, 28);
        }).filter(Boolean);
        state.sampleRow = firstCells.slice(0, 6).join(' | ').replace(/\\$[0-9,.]+/g, '$X.XX');
      } else if (itemIdList.length > 0) {
        var firstId = itemIdList[0];
        state.sampleRow = 'Item #' + firstId + ': ' + String(uniqueItemIds[firstId] || '').slice(0, 45);
      } else {
        state.sampleRow = 'No table rows or /item/ links found in DOM yet';
      }
    }
  }

  function runPing() {
    state.pingOk = null;
    state.pingError = null;
    var t0 = Date.now();
    var idx = 0;

    function tryNext() {
      if (idx >= ORIGINS.length) {
        state.pingOk = false;
        state.pingError = 'All origins failed (CSP connect-src or CORS blocked)';
        renderUI();
        return;
      }
      var targetOrigin = ORIGINS[idx++];
      fetch(targetOrigin + '/api/bml/ping?t=' + Date.now(), {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit'
      })
        .then(function(res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function(data) {
          state.pingOk = Boolean(data && data.ok);
          state.pingMs = Date.now() - t0;
          state.pingServerOrigin = (data && data.serverOrigin) || targetOrigin;
          state.pingAuthValid = Boolean(data && data.auth && data.auth.valid);
          renderUI();
        })
        .catch(function(err) {
          state.pingError = err && err.message ? err.message : String(err);
          tryNext();
        });
    }

    tryNext();
  }

  function buildReportText() {
    var auth = window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.getSession ? window.__RC_BML_AUTH__.getSession() : null;
    var roleStr = auth ? (auth.roleBadge || auth.role || 'member') + ' (' + (auth.prefix || 'HUCK-') + ') [ServerVerified=' + (state.pingAuthValid ? 'YES' : 'NO') + ']' : 'Not signed in';
    var lines = [
      '🧪 BML TEST REPORT — ' + window.location.origin + window.location.pathname,
      '1. Script & Ping: Script=PASS | Ping=' + (state.pingOk ? 'PASS (' + state.pingMs + 'ms via ' + state.pingServerOrigin + ')' : 'FAIL (' + (state.pingError || 'pending') + ')'),
      '2. Storage & Popup: localStorage=' + (state.storageOk ? 'PASS' : 'FAIL') + ' | window.open=' + (state.popupFnOk ? 'PASS' : 'FAIL') + ' | Auth=' + roleStr,
      '3. Page Detected: ' + state.pageType + ' | ' + state.domSummary,
      '4. Table Headers: ' + (state.headersFound.length > 0 ? state.headersFound.join(' | ') : '(none)'),
      '5. Sample Row: ' + (state.sampleRow || '(none)')
    ];
    return lines.join('\\n');
  }

  function copyReport(btnEl) {
    inspectPageDom();
    var text = buildReportText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        flashButton(btnEl, '✅ Copied Report!');
      }).catch(function() {
        fallbackCopy(text, btnEl);
      });
    } else {
      fallbackCopy(text, btnEl);
    }
  }

  function fallbackCopy(text, btnEl) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      flashButton(btnEl, '✅ Copied Report!');
    } catch (_e) {
      window.prompt('Copy this BML Test Report:', text);
    }
  }

  function flashButton(btnEl, msg) {
    if (!btnEl) return;
    var orig = btnEl.getAttribute('data-orig-label') || btnEl.textContent;
    btnEl.setAttribute('data-orig-label', orig);
    btnEl.textContent = msg;
    setTimeout(function() {
      btnEl.textContent = orig;
    }, 2000);
  }

  function renderUI() {
    var auth = window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.getSession ? window.__RC_BML_AUTH__.getSession() : null;
    var passCount =
      (state.scriptLoaded ? 1 : 0) +
      (state.pingOk ? 1 : 0) +
      (state.storageOk ? 1 : 0) +
      (state.popupFnOk ? 1 : 0) +
      (state.pageType !== 'unknown' ? 1 : 0) +
      (state.rowCount > 0 || state.itemLinkCount > 0 || state.pageType === 'sgw:item' ? 1 : 0);

    // 1. Ensure bottom-right pill bar exists (also sets #rc-sync-fab alias so clientCore never spawns duplicate banner)
    var bar = document.getElementById('rc-bml-test-fab-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'rc-bml-test-fab-bar';
      bar.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:2147483646;display:flex;align-items:center;gap:6px;background:linear-gradient(135deg,#0f172a,#1e293b);color:#f8fafc;border:2px solid #38bdf8;border-radius:999px;padding:6px 10px 6px 14px;box-shadow:0 16px 32px rgba(0,0,0,0.45);font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:700;';
      document.body.appendChild(bar);
    }

    var pingBadge = state.pingOk === null
      ? '⏳ Pinging...'
      : state.pingOk
        ? '✅ ' + passCount + '/6 Checks (' + state.pingMs + 'ms)'
        : '❌ Ping Blocked';

    var authChip = auth
      ? '<span style="background:#065f46;color:#d1fae5;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:800;">' +
          (auth.roleBadge || '👑 Member') + ' • ' + (auth.name || 'Connected') +
        '</span>'
      : '<button id="rc-bml-test-signin" style="background:#f59e0b;color:#1e1b18;border:0;border-radius:999px;padding:4px 10px;font-size:11px;font-weight:900;cursor:pointer;">🔐 Sign In</button>';

    var logoutBtn = auth
      ? '<button id="rc-bml-test-logout" title="Log Out of Bookmarklet" style="background:#334155;color:#fca5a5;border:1px solid rgba(248,113,113,0.4);border-radius:999px;padding:4px 9px;font-size:11px;font-weight:800;cursor:pointer;">🚪 Log Out</button>'
      : '';

    bar.innerHTML =
      '<span id="rc-sync-fab" style="display:none;"></span>' +
      '<button id="rc-bml-test-toggle" style="background:transparent;border:0;color:#f8fafc;cursor:pointer;display:flex;align-items:center;gap:8px;padding:2px 4px;font-weight:800;font-size:12px;">' +
        '<span>🧪 BML Test</span>' +
        '<span style="background:#0284c7;color:#e0f2fe;padding:2px 8px;border-radius:999px;font-family:monospace;font-size:11px;">' + state.pageType + '</span>' +
        '<span style="background:rgba(255,255,255,0.1);padding:2px 8px;border-radius:999px;font-size:11px;">' + pingBadge + '</span>' +
      '</button>' +
      authChip +
      '<button id="rc-bml-test-copy-pill" style="background:#38bdf8;color:#0f172a;border:0;border-radius:999px;padding:5px 11px;font-size:11px;font-weight:900;cursor:pointer;">📋 Copy Report</button>' +
      logoutBtn;

    var toggleBtn = document.getElementById('rc-bml-test-toggle');
    if (toggleBtn) {
      toggleBtn.onclick = function() {
        state.modalOpen = !state.modalOpen;
        inspectPageDom();
        renderUI();
      };
    }

    var copyPillBtn = document.getElementById('rc-bml-test-copy-pill');
    if (copyPillBtn) {
      copyPillBtn.onclick = function(e) {
        e.stopPropagation();
        copyReport(copyPillBtn);
      };
    }

    var signInBtn = document.getElementById('rc-bml-test-signin');
    if (signInBtn) {
      signInBtn.onclick = function(e) {
        e.stopPropagation();
        if (window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.openConnectFlow) {
          window.__RC_BML_AUTH__.openConnectFlow(false);
        }
      };
    }

    var logoutPillBtn = document.getElementById('rc-bml-test-logout');
    if (logoutPillBtn) {
      logoutPillBtn.onclick = function(e) {
        e.stopPropagation();
        if (window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.clearSession) {
          window.__RC_BML_AUTH__.clearSession();
        }
        state.pingAuthValid = false;
        renderUI();
      };
    }

    // 2. Render or hide detailed checklist modal
    var modal = document.getElementById('rc-bml-test-modal');
    if (!state.modalOpen) {
      if (modal) modal.remove();
      return;
    }

    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'rc-bml-test-modal';
      modal.style.cssText = 'position:fixed;bottom:68px;right:16px;z-index:2147483646;width:430px;max-width:calc(100vw - 24px);background:#0f172a;color:#f8fafc;border:2px solid #38bdf8;border-radius:20px;padding:16px;box-shadow:0 24px 48px rgba(0,0,0,0.6);font-family:system-ui,-apple-system,sans-serif;font-size:12px;line-height:1.45;';
      document.body.appendChild(modal);
    }

    var rowItem = function(ok, label, val) {
      var icon = ok === null ? '⏳' : ok ? '✅' : '❌';
      return '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);">' +
        '<span style="font-weight:700;color:#cbd5e1;">' + icon + ' ' + label + '</span>' +
        '<span style="font-family:monospace;font-size:11px;color:#f8fafc;text-align:right;word-break:break-word;max-width:235px;">' + val + '</span>' +
      '</div>';
    };

    modal.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">' +
        '<div>' +
          '<div style="font-size:14px;font-weight:900;color:#38bdf8;">🧪 Works@TheHC — Bookmarklet Diagnostic</div>' +
          '<div style="font-size:11px;color:#94a3b8;">Zero third-party cookies or tokens are ever read or sent.</div>' +
        '</div>' +
        '<button id="rc-bml-test-close" style="background:#1e293b;border:1px solid #334155;color:#f8fafc;border-radius:8px;padding:4px 8px;cursor:pointer;font-weight:800;">✕</button>' +
      '</div>' +
      '<div style="background:#1e293b;border-radius:12px;padding:8px 12px;margin-bottom:10px;">' +
        rowItem(true, '1. Script Injected (CSP)', ORIGIN) +
        rowItem(state.pingOk, '2. Server Ping (CORS)', state.pingOk === null ? 'Checking...' : state.pingOk ? 'OK (' + state.pingMs + 'ms)' : (state.pingError || 'Blocked')) +
        rowItem(state.storageOk, '3. Browser localStorage', state.storageOk ? 'Writable' : 'Blocked') +
        rowItem(state.popupFnOk, '4. Handshake Popup', state.popupFnOk ? 'Ready (/bml/connect)' : 'Blocked') +
        rowItem(state.pageType !== 'unknown', '5. Page Detected', state.pageType) +
        rowItem(state.rowCount > 0 || state.itemLinkCount > 0 || state.pageType === 'sgw:item', '6. Visible DOM Data', state.domSummary) +
        rowItem(Boolean(auth), '7. Member Role', auth ? (auth.roleBadge + ' (' + auth.prefix + ')') : 'Not Connected') +
      '</div>' +
      '<div style="background:#020617;border:1px solid #1e293b;border-radius:10px;padding:8px 10px;font-family:monospace;font-size:10.5px;color:#94a3b8;margin-bottom:12px;white-space:pre-wrap;max-height:120px;overflow-y:auto;">' +
        buildReportText().replace(/</g, '&lt;') +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button id="rc-bml-test-rescan" style="background:#334155;color:#f8fafc;border:0;border-radius:10px;padding:8px 12px;font-weight:800;cursor:pointer;font-size:12px;">🔄 Re-Scan Page</button>' +
        '<button id="rc-bml-test-copy-modal" style="flex:1;background:#38bdf8;color:#0f172a;border:0;border-radius:10px;padding:8px 12px;font-weight:900;cursor:pointer;font-size:12px;">📋 Copy Report to Clipboard</button>' +
      '</div>';

    var closeBtn = document.getElementById('rc-bml-test-close');
    if (closeBtn) {
      closeBtn.onclick = function() {
        state.modalOpen = false;
        renderUI();
      };
    }

    var rescanBtn = document.getElementById('rc-bml-test-rescan');
    if (rescanBtn) {
      rescanBtn.onclick = function() {
        testStorage();
        inspectPageDom();
        runPing();
      };
    }

    var copyModalBtn = document.getElementById('rc-bml-test-copy-modal');
    if (copyModalBtn) {
      copyModalBtn.onclick = function() {
        copyReport(copyModalBtn);
      };
    }
  }

  window.addEventListener('rc-bml-authenticated', function() {
    runPing();
  });

  window.__RC_REFRESH_FROM_CLOUD__ = function() {
    runPing();
  };

  testStorage();
  inspectPageDom();
  renderUI();
  runPing();
})();
`;

  return new Response(
    `window.__RC_ORIGIN__ = ${JSON.stringify(url.origin)};\nwindow.__RC_ORIGINS__ = ${JSON.stringify(activeOrigins)};\n${authRuntimeJs}\n${diagnosticBodyJs}`,
    {
      status: 200,
      headers: CORS_NO_STORE_HEADERS,
    }
  );
};

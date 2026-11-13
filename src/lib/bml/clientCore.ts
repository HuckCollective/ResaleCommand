export function buildInjectableBmlAuthRuntimeJs(origins: string[], primaryOrigin: string): string {
  return `(function(){
  var STORAGE_KEY = 'rc_bml_session_v1';
  var ORIGINS = ${JSON.stringify(origins)};
  var PRIMARY_ORIGIN = ${JSON.stringify(primaryOrigin)};

  try {
    var hash = window.location.hash || '';
    var m = hash.match(/(?:^|[#&])rc_bml_token=([^&]+)/);
    if (m && m[1]) {
      var rawToken = decodeURIComponent(m[1]);
      var nameMatch = hash.match(/(?:^|[#&])rc_bml_name=([^&]+)/);
      var prefixMatch = hash.match(/(?:^|[#&])rc_bml_prefix=([^&]+)/);
      var sess = {
        token: rawToken,
        name: nameMatch ? decodeURIComponent(nameMatch[1]) : 'Member',
        prefix: prefixMatch ? decodeURIComponent(prefixMatch[1]) : 'HUCK-',
        savedAt: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sess));
      var cleanHash = hash
        .replace(/([#&])rc_bml_(?:token|name|prefix)=[^&]+/g, '')
        .replace(/^#&/, '#')
        .replace(/^#$/, '');
      window.history.replaceState(null, '', window.location.pathname + window.location.search + cleanHash);
    }
  } catch (_e) {}

  function decodeBase64UrlUtf8(seg) {
    var b64 = String(seg || '').replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) b64 += '=';
    var bin = atob(b64);
    if (typeof TextDecoder !== 'undefined') {
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder('utf-8').decode(bytes);
    }
    return decodeURIComponent(escape(bin));
  }

  function getSession() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.token) return null;
      var parts = String(parsed.token).split('.');
      if (parts.length === 3) {
        var payloadJson = decodeBase64UrlUtf8(parts[1]);
        var payload = JSON.parse(payloadJson);
        if (payload && payload.exp && payload.exp * 1000 < Date.now()) {
          localStorage.removeItem(STORAGE_KEY);
          return null;
        }
        parsed.name = payload.name || parsed.name || 'Member';
        parsed.prefix = payload.prefix || parsed.prefix || 'HUCK-';
      }
      return parsed;
    } catch (_e) {
      return null;
    }
  }

  function saveSession(token, member) {
    try {
      var sess = {
        token: token,
        name: (member && member.name) || 'Member',
        prefix: (member && member.prefix) || 'HUCK-',
        savedAt: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sess));
      renderAuthBanner(false);
      return sess;
    } catch (_e) {
      return null;
    }
  }
  function clearSession() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_e) {}
    renderAuthBanner(true);
  }

  function openConnectFlow() {
    var returnUrl = window.location.href.split('#')[0];
    var connectUrl = PRIMARY_ORIGIN + '/bml/connect?origin=' + encodeURIComponent(window.location.origin) + '&returnUrl=' + encodeURIComponent(returnUrl);
    var isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
    if (isMobile) {
      window.location.href = connectUrl;
      return;
    }
    var w = 440, h = 600;
    var left = Math.max(0, Math.round(window.screenX + (window.outerWidth - w) / 2));
    var top = Math.max(0, Math.round(window.screenY + (window.outerHeight - h) / 2));
    window.open(connectUrl, 'rc_bml_connect', 'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top + ',resizable=yes,scrollbars=yes');
  }

  window.addEventListener('message', function(ev) {
    if (!ev || !ev.data || ev.data.type !== 'RC_BML_AUTH_SUCCESS') return;
    if (ev.origin && ORIGINS.indexOf(ev.origin) === -1) return;
    if (ev.data.token) {
      var sess = saveSession(ev.data.token, ev.data.member || {});
      try {
        window.dispatchEvent(new CustomEvent('rc-bml-authenticated', { detail: sess }));
      } catch (_e) {}
      if (typeof window.__RC_REFRESH_FROM_CLOUD__ === 'function') {
        window.__RC_REFRESH_FROM_CLOUD__();
      }
    }
  });

  function renderAuthBanner(needsLogin) {
    var id = 'rc-bml-auth-guard-bar';
    var existing = document.getElementById(id);
    var sess = getSession();
    if (!needsLogin && sess) {
      if (existing) existing.remove();
      return;
    }
    if (!existing) {
      existing = document.createElement('div');
      existing.id = id;
      existing.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;background:#1e1b18;color:#fdfaf6;border:2px solid #f59e0b;border-radius:16px;padding:12px 16px;box-shadow:0 20px 35px rgba(0,0,0,0.45);font-family:system-ui,-apple-system,sans-serif;max-width:360px;font-size:12px;line-height:1.4;';
      document.body.appendChild(existing);
    }
    existing.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">' +
        '<strong style="font-size:13px;color:#fbbf24;">🔐 Works@TheHC Member Sign-In Required</strong>' +
        '<button id="rc-bml-auth-close" style="background:transparent;border:0;color:#fdfaf6;opacity:0.7;cursor:pointer;font-size:14px;">✕</button>' +
      '</div>' +
      '<div style="opacity:0.85;margin-bottom:10px;">Bookmarklets are protected for signed-in Collective members. Connect once (stays active 14 days on Desktop &amp; Pixel 8).</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
        '<button id="rc-bml-auth-btn" style="flex:1;background:#7c3aed;color:#fff;border:0;border-radius:10px;padding:8px 12px;font-weight:800;cursor:pointer;font-size:12px;">⚡ Connect Works@TheHC</button>' +
      '</div>';
    var btn = document.getElementById('rc-bml-auth-btn');
    if (btn) btn.onclick = openConnectFlow;
    var cls = document.getElementById('rc-bml-auth-close');
    if (cls) cls.onclick = function() { existing.remove(); };
  }

  if (!window.__RC_BML_FETCH_WRAPPED__) {
    window.__RC_BML_FETCH_WRAPPED__ = true;
    var origFetch = window.fetch.bind(window);
    window.fetch = function(input, init) {
      var urlStr = typeof input === 'string' ? input : (input && (input.url || input.href)) || String(input || '');
      var isRcApi = ORIGINS.some(function(o) { return o && urlStr.indexOf(o + '/api/') === 0; });
      if (isRcApi) {
        var sess = getSession();
        init = Object.assign({}, init || {});
        var headers = new Headers(init.headers || {});
        if (sess && sess.token && !headers.has('Authorization')) {
          headers.set('Authorization', 'Bearer ' + sess.token);
        }
        init.headers = headers;
        return origFetch(input, init).then(function(res) {
          if (res.status === 401) {
            renderAuthBanner(true);
          }
          return res;
        });
      }
      return origFetch(input, init);
    };
  }

  window.__RC_BML_AUTH__ = {
    getSession: getSession,
    saveSession: saveSession,
    clearSession: clearSession,
    openConnectFlow: openConnectFlow,
    renderAuthBanner: renderAuthBanner
  };

  if (!getSession()) {
    setTimeout(function() { renderAuthBanner(true); }, 250);
  }
})();\n`;
}

(function () {
  var ORIGIN = window.__RC_ORIGIN__ || 'https://resalecmd.com';
  var ORIGINS = window.__RC_ORIGINS__ || [ORIGIN, 'https://alpha.resalecmd.com', 'https://resalecmd.com'];

  function cleanText(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  function parseDollar(s) {
    var m = String(s || '').match(/\$([0-9,]+(?:\.[0-9]{1,2})?)/);
    if (!m) {
      var m2 = String(s || '').replace(/^[A-Za-z\s#:]+/, '').match(/([0-9,]+(?:\.[0-9]{1,2})?)/);
      return m2 ? parseFloat(m2[1].replace(/,/g, '')) || 0 : 0;
    }
    return parseFloat(m[1].replace(/,/g, '')) || 0;
  }

  function stripCellPrefix(raw, prefixes) {
    var t = cleanText(raw);
    for (var i = 0; i < prefixes.length; i++) {
      var re = new RegExp('^' + prefixes[i] + '\\s*:?\\s*', 'i');
      if (re.test(t)) {
        return cleanText(t.replace(re, ''));
      }
    }
    return t;
  }

  // RFC-4180 CSV parser (handles quoted commas, newlines, and escaped "" quotes)
  function parseCsvRows(csvText) {
    var text = String(csvText || '').replace(/^\uFEFF/, '').trim();
    if (!text) return [];
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;

    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      var next = text[i + 1];
      if (inQuotes) {
        if (ch === '"' && next === '"') {
          field += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          row.push(field);
          field = '';
        } else if (ch === '\r' && next === '\n') {
          row.push(field);
          rows.push(row);
          row = [];
          field = '';
          i++;
        } else if (ch === '\n' || ch === '\r') {
          row.push(field);
          rows.push(row);
          row = [];
          field = '';
        } else {
          field += ch;
        }
      }
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    if (rows.length < 2) return [];

    var headers = rows[0].map(function (h) {
      return cleanText(h).toLowerCase();
    });
    var objects = [];
    for (var rIdx = 1; rIdx < rows.length; rIdx++) {
      var cells = rows[rIdx];
      if (!cells || cells.length === 0 || (cells.length === 1 && !cleanText(cells[0]))) continue;
      var obj = {};
      for (var cIdx = 0; cIdx < headers.length; cIdx++) {
        obj[headers[cIdx]] = cleanText(cells[cIdx] || '');
      }
      objects.push(obj);
    }
    return objects;
  }

  function getCsvField(obj, candidateKeys) {
    if (!obj) return '';
    for (var i = 0; i < candidateKeys.length; i++) {
      var k = candidateKeys[i].toLowerCase();
      if (obj[k] !== undefined && obj[k] !== '') return obj[k];
    }
    var keys = Object.keys(obj);
    for (var j = 0; j < candidateKeys.length; j++) {
      var needle = candidateKeys[j].toLowerCase();
      for (var m = 0; m < keys.length; m++) {
        if (keys[m].indexOf(needle) !== -1 && obj[keys[m]] !== '') {
          return obj[keys[m]];
        }
      }
    }
    return '';
  }

  var state = {
    pageType: 'unknown',
    rows: [],
    csvRows: [],
    csvHarvested: false,
    capturingCsv: false,
    watchlist: {},
    modalOpen: false,
    loadingPreview: false,
    committing: false,
    previewData: null,
    commitResult: null,
    errorMsg: null,
    activeOrigin: ORIGIN
  };

  // Install one-time silent CSV interceptor (hooks Blob + Anchor click so clicking SGW's CSV button during harvest captures CSV in memory without saving a file)
  function installCsvInterceptor() {
    if (window.__RC_SGW_CSV_HOOKED__) return;
    window.__RC_SGW_CSV_HOOKED__ = true;

    var OrigBlob = window.Blob;
    if (typeof OrigBlob === 'function') {
      var WrappedBlob = function (parts, options) {
        try {
          if (Array.isArray(parts) && parts.length > 0) {
            var joined = parts
              .map(function (p) {
                return typeof p === 'string' ? p : '';
              })
              .join('');
            var mime = (options && options.type ? String(options.type) : '').toLowerCase();
            var looksLikeSgwCsv =
              mime.indexOf('csv') !== -1 ||
              (joined.indexOf(',') !== -1 &&
                (/item\s*id/i.test(joined) || /order\s*#/i.test(joined)) &&
                (/current\s*price|tracking\s*#/i.test(joined)));
            if (state.capturingCsv || looksLikeSgwCsv) {
              window.__RC_CAPTURED_SGW_CSV__ = joined;
              if (typeof window.__RC_ON_SGW_CSV__ === 'function') {
                window.__RC_ON_SGW_CSV__(joined);
              }
            }
          }
        } catch (e) {}
        return new OrigBlob(parts, options);
      };
      WrappedBlob.prototype = OrigBlob.prototype;
      try {
        window.Blob = WrappedBlob;
      } catch (e) {}
    }

    var origAnchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      try {
        var href = String(this.getAttribute('href') || this.href || '');
        var dl = String(this.getAttribute('download') || '');
        if (href.indexOf('data:text/csv') === 0 || href.indexOf('data:application/csv') === 0) {
          var commaIdx = href.indexOf(',');
          if (commaIdx !== -1) {
            var rawPayload = href.slice(commaIdx + 1);
            var decoded = '';
            try {
              decoded = decodeURIComponent(rawPayload);
            } catch (e) {
              decoded = rawPayload;
            }
            if (decoded) {
              window.__RC_CAPTURED_SGW_CSV__ = decoded;
              if (typeof window.__RC_ON_SGW_CSV__ === 'function') {
                window.__RC_ON_SGW_CSV__(decoded);
              }
            }
          }
        }
        if (
          state.capturingCsv &&
          (dl.toLowerCase().indexOf('.csv') !== -1 ||
            href.indexOf('blob:') === 0 ||
            href.indexOf('data:text/csv') === 0 ||
            href.indexOf('data:application/csv') === 0)
        ) {
          // Suppress browser file-save dialog during silent in-memory harvest!
          return;
        }
      } catch (e) {}
      return origAnchorClick.apply(this, arguments);
    };
  }

  function detectCellHasTrophy(maxBidTd, currentPrice, myMaxBid, statusText) {
    // 1. Price Math Invariant: In ShopGoodwill proxy bidding, if My Max Bid > Current Price, you are 100% the high bidder!
    if (myMaxBid > 0 && currentPrice > 0 && myMaxBid > currentPrice) {
      return true;
    }
    // 2. Explicit Status Text
    if (/won|winning|high\s*bidder/i.test(statusText || '') && !/outbid|lost/i.test(statusText || '')) {
      return true;
    }
    if (/outbid|lost/i.test(statusText || '')) {
      return false;
    }
    // 3. DOM Trophy Icon inside My Max Bid cell (ShopGoodwill only renders the yellow high-bidder trophy icon in tds[5])
    if (maxBidTd) {
      var clone = maxBidTd.cloneNode(true);
      var injected = clone.querySelectorAll('.rc-sgw-inline-badge');
      for (var i = 0; i < injected.length; i++) {
        injected[i].remove();
      }
      var hasIconEl = Boolean(
        clone.querySelector(
          'img, svg, i, [class*="trophy" i], [class*="award" i], [class*="win" i], [title*="high" i], [alt*="high" i]'
        ) || /🏆/.test(clone.textContent || '')
      );
      if (hasIconEl) return true;
      // If we have the live DOM cell and myMaxBid <= currentPrice with NO icon element inside maxBidTd, you are outbid
      if (currentPrice > 0 && myMaxBid > 0 && myMaxBid <= currentPrice) {
        return false;
      }
    }
    // 4. Pure CSV fallback when DOM row is on another page: if myMaxBid >= currentPrice, treat as Winning; if currentPrice > myMaxBid, treat as Outbid
    if (myMaxBid > 0 && currentPrice > 0) {
      return myMaxBid >= currentPrice;
    }
    return false;
  }

  function convertParsedCsvObjectsToRows(csvObjects, domByItemId) {
    var out = [];
    if (!Array.isArray(csvObjects) || csvObjects.length === 0) return out;

    if (state.pageType === 'inprogress-auctions' || state.pageType === 'closed-auctions') {
      csvObjects.forEach(function (obj) {
        var rawId = getCsvField(obj, ['item id', 'itemid', 'item #']);
        var itemId = (String(rawId).match(/(\d{7,10})/) || [])[1] || '';
        if (!itemId) return;

        var domRow = domByItemId[itemId] || null;
        var csvTitle = getCsvField(obj, ['item', 'title', 'description']);
        var seller = getCsvField(obj, ['seller', 'store']) || (domRow ? domRow.seller : '');
        var currentPrice = parseDollar(getCsvField(obj, ['current price', 'price', 'winning bid']));
        if (!currentPrice && domRow) currentPrice = domRow.currentPrice;
        var myMaxBid = parseDollar(getCsvField(obj, ['my max bid', 'max bid']));
        if (!myMaxBid && domRow) myMaxBid = domRow.myMaxBid;
        var endingDate = getCsvField(obj, ['ending date (pt)', 'ending date', 'end date']) || (domRow ? domRow.endingDate : '');
        var statusText = getCsvField(obj, ['status']) || (domRow ? domRow.statusText : '');

        var hasTrophy = detectCellHasTrophy(
          domRow ? domRow.maxBidTd : null,
          currentPrice,
          myMaxBid,
          statusText
        );

        out.push({
          trEl: domRow ? domRow.trEl : null,
          maxBidTd: domRow ? domRow.maxBidTd : null,
          statusTd: domRow ? domRow.statusTd : null,
          itemId: itemId,
          title: csvTitle || (domRow ? domRow.title : 'ShopGoodwill #' + itemId),
          seller: seller,
          currentPrice: currentPrice,
          myMaxBid: myMaxBid,
          hasTrophy: hasTrophy,
          endingDate: endingDate,
          status: statusText || (hasTrophy ? 'Winning' : 'Outbid'),
          fromCsv: true
        });
      });
    } else if (state.pageType === 'shipped-orders') {
      csvObjects.forEach(function (obj) {
        var rawOrder = getCsvField(obj, ['order #', 'order id', 'order']);
        var orderId = (String(rawOrder).match(/(\d{6,10})/) || [])[1] || '';
        var rawItem = getCsvField(obj, ['item id', 'itemid', 'item #']);
        var itemId = (String(rawItem).match(/(\d{7,10})/) || [])[1] || '';
        if (!orderId && !itemId) return;

        var domRow = domByItemId[itemId || orderId] || null;
        var csvTitle = getCsvField(obj, ['item', 'title', 'description']);
        var qty = parseInt(getCsvField(obj, ['quantity', 'qty']) || '1', 10) || 1;
        var price = parseDollar(getCsvField(obj, ['price', 'current price']));
        var dateStr = getCsvField(obj, ['date', 'shipped date']);
        var trackingRaw = getCsvField(obj, ['tracking #', 'tracking number', 'tracking']);
        var tax = parseDollar(getCsvField(obj, ['tax']));
        var shipping = parseDollar(getCsvField(obj, ['shipping']));
        var handling = parseDollar(getCsvField(obj, ['handling']));

        out.push({
          trEl: domRow ? domRow.trEl : null,
          orderId: orderId || itemId,
          itemId: itemId || orderId,
          title: csvTitle || (domRow ? domRow.title : 'ShopGoodwill #' + (itemId || orderId)),
          qty: qty,
          price: price,
          date: dateStr,
          trackingNumber: trackingRaw,
          tax: tax,
          shipping: shipping,
          handling: handling,
          fromCsv: true
        });
      });
    }
    return out;
  }

  function detectPageAndRows() {
    var path = (window.location.pathname || '').toLowerCase();
    var domRows = [];
    var domByItemId = {};

    if (path.indexOf('/item/') !== -1) {
      state.pageType = 'item';
      var idMatch = path.match(/\/item\/(\d+)/);
      var itemId = idMatch ? idMatch[1] : '';
      var h1 = cleanText((document.querySelector('h1') || {}).textContent || '');
      var bodyText = cleanText((document.body || {}).innerText || '');
      var priceMatch = bodyText.match(/(?:Current Price|Minimum Bid|Buy Now Price)\s*:?\s*\$([0-9,.]+)/i);
      var sellerMatch = bodyText.match(/Seller\s*:?\s*([^\n\r|]{3,55})/i);
      domRows.push({
        itemId: itemId,
        title: h1 || ('ShopGoodwill #' + itemId),
        currentPrice: priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) || 0 : 0,
        seller: sellerMatch ? cleanText(sellerMatch[1]) : 'ShopGoodwill'
      });
      state.rows = domRows;
      return;
    }

    if (path.indexOf('inprogress-auctions') !== -1 || path.indexOf('in-progress') !== -1) {
      state.pageType = 'inprogress-auctions';
    } else if (path.indexOf('closed-auctions') !== -1) {
      state.pageType = 'closed-auctions';
    } else if (path.indexOf('shipped-orders') !== -1 || path.indexOf('open-orders') !== -1) {
      state.pageType = 'shipped-orders';
    } else {
      state.pageType = 'other';
    }

    var trs = Array.prototype.slice.call(document.querySelectorAll('table tbody tr'));

    if (state.pageType === 'inprogress-auctions' || state.pageType === 'closed-auctions') {
      trs.forEach(function (tr) {
        var tds = Array.prototype.slice.call(tr.querySelectorAll('td'));
        if (tds.length < 5) return;
        var itemLink = tr.querySelector('a[href*="/item/"]');
        var linkHref = itemLink ? String(itemLink.getAttribute('href') || '') : '';
        var idFromHref = (linkHref.match(/\/item\/(\d+)/) || [])[1] || '';
        var rawIdCell = stripCellPrefix(tds[1] ? tds[1].textContent : '', ['Item ID', 'Item Id']);
        var itemId = idFromHref || (rawIdCell.match(/(\d{7,10})/) || [])[1] || '';
        if (!itemId) return;

        var title = stripCellPrefix(tds[2] ? tds[2].textContent : '', ['Item']);
        var seller = stripCellPrefix(tds[3] ? tds[3].textContent : '', ['Seller']);
        var currentPrice = parseDollar(tds[4] ? tds[4].textContent : '');
        var maxBidTd = tds[5];
        var myMaxBid = parseDollar(maxBidTd ? maxBidTd.textContent : '');
        var endingDate = stripCellPrefix(tds[7] ? tds[7].textContent : '', ['Ending Date \\(PT\\)', 'Ending Date']);
        var statusText = stripCellPrefix(tds[8] ? tds[8].textContent : '', ['Status']);
        var hasTrophy = detectCellHasTrophy(maxBidTd, currentPrice, myMaxBid, statusText);

        var rowObj = {
          trEl: tr,
          maxBidTd: maxBidTd,
          statusTd: tds[8] || maxBidTd,
          itemId: itemId,
          title: title || ('ShopGoodwill #' + itemId),
          seller: seller,
          currentPrice: currentPrice,
          myMaxBid: myMaxBid,
          hasTrophy: hasTrophy,
          endingDate: endingDate,
          statusText: statusText,
          status: statusText || (hasTrophy ? 'Winning' : 'Outbid')
        };
        domRows.push(rowObj);
        domByItemId[itemId] = rowObj;
      });
    } else if (state.pageType === 'shipped-orders') {
      trs.forEach(function (tr) {
        var tds = Array.prototype.slice.call(tr.querySelectorAll('td'));
        if (tds.length < 7) return;
        var orderCell = stripCellPrefix(tds[2] ? tds[2].textContent : '', ['Order #', 'Order ID', 'Order']);
        var orderId = (orderCell.match(/(\d{6,10})/) || [])[1] || '';
        var itemLink = tr.querySelector('a[href*="/item/"]');
        var linkHref = itemLink ? String(itemLink.getAttribute('href') || '') : '';
        var idFromHref = (linkHref.match(/\/item\/(\d+)/) || [])[1] || '';
        var itemCell = stripCellPrefix(tds[3] ? tds[3].textContent : '', ['Item Id', 'Item ID']);
        var itemId = idFromHref || (itemCell.match(/(\d{7,10})/) || [])[1] || '';
        if (!orderId && !itemId) return;

        var title = stripCellPrefix(tds[1] ? tds[1].textContent : '', ['Item']);
        if (!title || /^item$/i.test(title)) {
          title = itemLink ? cleanText(itemLink.textContent) : ('ShopGoodwill #' + (itemId || orderId));
        }
        var qtyRaw = stripCellPrefix(tds[4] ? tds[4].textContent : '1', ['Quantity', 'Qty']);
        var qty = parseInt(qtyRaw, 10) || 1;
        var price = parseDollar(tds[5] ? tds[5].textContent : '');
        var dateStr = stripCellPrefix(tds[6] ? tds[6].textContent : '', ['Date', 'Shipped Date']);
        var trackingRaw = stripCellPrefix(tds[7] ? tds[7].textContent : '', ['Tracking #', 'Tracking']);
        var tax = parseDollar(tds[8] ? tds[8].textContent : '');
        var shipping = parseDollar(tds[9] ? tds[9].textContent : '');
        var handling = parseDollar(tds[10] ? tds[10].textContent : '');

        var rowObj = {
          trEl: tr,
          orderId: orderId || itemId,
          itemId: itemId || orderId,
          title: title,
          qty: qty,
          price: price,
          date: dateStr,
          trackingNumber: trackingRaw,
          tax: tax,
          shipping: shipping,
          handling: handling
        };
        domRows.push(rowObj);
        domByItemId[itemId || orderId] = rowObj;
      });
    }

    if (state.csvRows && state.csvRows.length > 0) {
      var merged = convertParsedCsvObjectsToRows(state.csvRows, domByItemId);
      if (merged.length > 0) {
        state.rows = merged;
        state.csvHarvested = true;
        return;
      }
    }

    state.rows = domRows;
  }

  // Silently trigger ShopGoodwill's native CSV export button and capture the full CSV in memory (like Rico!)
  function harvestPageCsvSilently(callback) {
    installCsvInterceptor();
    if (
      state.pageType !== 'inprogress-auctions' &&
      state.pageType !== 'closed-auctions' &&
      state.pageType !== 'shipped-orders'
    ) {
      if (callback) callback(false);
      return;
    }

    var csvBtn = Array.prototype.slice
      .call(document.querySelectorAll('button, a'))
      .find(function (el) {
        return /^csv$/i.test(cleanText(el.textContent));
      });

    if (!csvBtn) {
      if (callback) callback(false);
      return;
    }

    var settled = false;
    window.__RC_ON_SGW_CSV__ = function (rawCsv) {
      if (settled) return;
      settled = true;
      state.capturingCsv = false;
      var parsed = parseCsvRows(rawCsv);
      if (parsed.length > 0) {
        state.csvRows = parsed;
        state.csvHarvested = true;
        detectPageAndRows();
        decoratePageRows();
        renderUI();
        if (callback) callback(true);
      } else {
        if (callback) callback(false);
      }
    };

    try {
      state.capturingCsv = true;
      csvBtn.click();
    } catch (e) {
      state.capturingCsv = false;
    }

    setTimeout(function () {
      if (!settled) {
        settled = true;
        state.capturingCsv = false;
        if (callback) callback(false);
      }
    }, 650);
  }

  function decoratePageRows() {
    if (state.pageType === 'inprogress-auctions') {
      state.rows.forEach(function (r) {
        if (!r.maxBidTd) return;
        var oldBadge = r.maxBidTd.querySelector('.rc-sgw-inline-badge');
        if (oldBadge) oldBadge.remove();

        var badgeWrap = document.createElement('div');
        badgeWrap.className = 'rc-sgw-inline-badge';
        badgeWrap.style.cssText = 'margin-top:4px;display:flex;flex-wrap:wrap;gap:4px;align-items:center;font-family:system-ui,-apple-system,sans-serif;';

        var statusPill = document.createElement('span');
        if (r.hasTrophy) {
          statusPill.style.cssText = 'background:#065f46;color:#d1fae5;padding:2px 6px;border-radius:6px;font-size:10px;font-weight:800;';
          statusPill.textContent = '🟢 WINNING';
        } else {
          statusPill.style.cssText = 'background:#991b1b;color:#fee2e2;padding:2px 6px;border-radius:6px;font-size:10px;font-weight:800;';
          statusPill.textContent = '🚨 OUTBID';
        }
        badgeWrap.appendChild(statusPill);

        var wl = state.watchlist[r.itemId];
        if (wl && wl.maxBid > 0) {
          var ceilingPill = document.createElement('span');
          var overCeiling = r.currentPrice > wl.maxBid;
          ceilingPill.style.cssText = overCeiling
            ? 'background:#7c2d12;color:#ffedd5;padding:2px 6px;border-radius:6px;font-size:10px;font-weight:800;'
            : 'background:#1e3a8a;color:#dbeafe;padding:2px 6px;border-radius:6px;font-size:10px;font-weight:800;';
          ceilingPill.textContent = '🎯 RC Max: $' + Number(wl.maxBid).toFixed(2);
          badgeWrap.appendChild(ceilingPill);
        }

        r.maxBidTd.appendChild(badgeWrap);
      });
    } else if (state.pageType === 'closed-auctions') {
      state.rows.forEach(function (r) {
        if (!r.statusTd) return;
        var oldBadge = r.statusTd.querySelector('.rc-sgw-inline-badge');
        if (oldBadge) oldBadge.remove();

        var isWon = /won/i.test(r.status || '');
        var isLost = /lost/i.test(r.status || '');
        if (!isWon && !isLost) return;

        var badgeWrap = document.createElement('div');
        badgeWrap.className = 'rc-sgw-inline-badge';
        badgeWrap.style.cssText = 'margin-top:4px;font-family:system-ui,-apple-system,sans-serif;';

        var pill = document.createElement('span');
        if (isWon) {
          pill.style.cssText = 'background:#065f46;color:#d1fae5;padding:2px 6px;border-radius:6px;font-size:10px;font-weight:800;';
          pill.textContent = '🏆 WON ➔ Acquired (HG)';
        } else {
          pill.style.cssText = 'background:#334155;color:#cbd5e1;padding:2px 6px;border-radius:6px;font-size:10px;font-weight:800;';
          pill.textContent = '🧹 LOST ➔ Clean Tracker';
        }
        badgeWrap.appendChild(pill);
        r.statusTd.appendChild(badgeWrap);
      });
    }
  }

  function callSgwSyncApi(method, pathSuffix, bodyObj) {
    var idx = 0;
    function tryOrigin() {
      if (idx >= ORIGINS.length) {
        return Promise.reject(new Error('Could not reach Works@TheHC server.'));
      }
      var targetOrigin = ORIGINS[idx++];
      var init = {
        method: method,
        mode: 'cors',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' }
      };
      if (bodyObj) init.body = JSON.stringify(bodyObj);
      return fetch(targetOrigin + pathSuffix, init).then(function (res) {
        state.activeOrigin = targetOrigin;
        return res.json().then(function (data) {
          if (!res.ok || (data && data.ok === false)) {
            var err = new Error((data && (data.message || data.error)) || ('HTTP ' + res.status));
            err.status = res.status;
            throw err;
          }
          return data;
        });
      }).catch(function (err) {
        if (err && (err.status === 401 || err.status === 403)) {
          throw err;
        }
        return tryOrigin();
      });
    }
    return tryOrigin();
  }

  function fetchWatchlist() {
    var auth = window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.getSession ? window.__RC_BML_AUTH__.getSession() : null;
    if (!auth) return;
    callSgwSyncApi('GET', '/api/bml/sgw-sync?mode=watchlist&t=' + Date.now(), null)
      .then(function (data) {
        if (data && data.watchlist) {
          state.watchlist = data.watchlist;
          decoratePageRows();
          renderUI();
        }
      })
      .catch(function () {});
  }

  function executeSyncCall(dryRun) {
    detectPageAndRows();
    state.errorMsg = null;
    state.modalOpen = true;
    if (dryRun) {
      state.loadingPreview = true;
      state.commitResult = null;
    } else {
      state.committing = true;
    }
    renderUI();

    var cleanRows = state.rows.map(function (r) {
      return {
        orderId: r.orderId,
        itemId: r.itemId,
        title: r.title,
        seller: r.seller,
        currentPrice: r.currentPrice,
        myMaxBid: r.myMaxBid,
        hasTrophy: r.hasTrophy,
        endingDate: r.endingDate,
        status: r.status,
        qty: r.qty,
        price: r.price,
        date: r.date,
        trackingNumber: r.trackingNumber,
        tax: r.tax,
        shipping: r.shipping,
        handling: r.handling
      };
    });

    callSgwSyncApi('POST', '/api/bml/sgw-sync', {
      pageType: state.pageType,
      dryRun: Boolean(dryRun),
      rows: cleanRows
    })
      .then(function (data) {
        state.loadingPreview = false;
        state.committing = false;
        if (dryRun) {
          state.previewData = data;
        } else {
          state.commitResult = data;
          state.previewData = data;
          fetchWatchlist();
        }
        renderUI();
      })
      .catch(function (err) {
        state.loadingPreview = false;
        state.committing = false;
        state.errorMsg = (err && err.message) || 'Sync failed.';
        renderUI();
      });
  }

  function runPreviewOrSync(dryRun) {
    var auth = window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.getSession ? window.__RC_BML_AUTH__.getSession() : null;
    if (!auth) {
      if (window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.openConnectFlow) {
        window.__RC_BML_AUTH__.openConnectFlow(false);
      }
      return;
    }

    if (!state.csvHarvested && state.pageType !== 'item') {
      harvestPageCsvSilently(function () {
        executeSyncCall(dryRun);
      });
    } else {
      executeSyncCall(dryRun);
    }
  }

  function primaryActionLabel() {
    var count = state.rows.length;
    var suffix = state.csvHarvested ? ' CSV' : '';
    if (state.pageType === 'inprogress-auctions') return '🔄 Sync Bids (' + count + suffix + ')';
    if (state.pageType === 'closed-auctions') return '🏆 Reconcile Won/Lost (' + count + suffix + ')';
    if (state.pageType === 'shipped-orders') return '🚚 Sync Shipped (' + count + suffix + ')';
    if (state.pageType === 'item') return '➕ Track Item in RC';
    return '🔭 Open Scout';
  }

  function renderUI() {
    var auth = window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.getSession ? window.__RC_BML_AUTH__.getSession() : null;

    var bar = document.getElementById('rc-scout-fab-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'rc-scout-fab-bar';
      bar.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:2147483646;display:flex;align-items:center;gap:6px;background:linear-gradient(135deg,#1e1b4b,#0f172a);color:#f8fafc;border:2px solid #818cf8;border-radius:999px;padding:6px 10px 6px 14px;box-shadow:0 16px 32px rgba(0,0,0,0.5);font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:700;flex-wrap:wrap;';
      document.body.appendChild(bar);
    }

    var authChip = auth
      ? '<span style="background:#065f46;color:#d1fae5;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:800;">' +
          (auth.roleBadge || '👑 Member') + ' • ' + (auth.name || 'Connected') +
        '</span>'
      : '<button id="rc-scout-signin-btn" style="background:#f59e0b;color:#1e1b18;border:0;border-radius:999px;padding:4px 10px;font-size:11px;font-weight:900;cursor:pointer;">🔐 Sign In</button>';

    var logoutBtn = auth
      ? '<button id="rc-scout-logout-btn" title="Log Out of Bookmarklet" style="background:#334155;color:#fca5a5;border:1px solid rgba(248,113,113,0.4);border-radius:999px;padding:4px 9px;font-size:11px;font-weight:800;cursor:pointer;">🚪</button>'
      : '';

    var quickScoutBtn = state.pageType === 'item'
      ? '<button id="rc-scout-open-ai-btn" style="background:#10b981;color:#052e16;border:0;border-radius:999px;padding:5px 11px;font-size:11px;font-weight:900;cursor:pointer;">⚡ AI Scout URL</button>'
      : '';

    bar.innerHTML =
      '<span id="rc-sync-fab" style="display:none;"></span>' +
      '<button id="rc-scout-toggle-btn" style="background:transparent;border:0;color:#f8fafc;cursor:pointer;display:flex;align-items:center;gap:6px;padding:2px 4px;font-weight:800;font-size:12px;">' +
        '<span>🔭 RC Scout</span>' +
        '<span style="background:#312e81;color:#e0e7ff;padding:2px 8px;border-radius:999px;font-family:monospace;font-size:11px;">' + state.pageType + '</span>' +
      '</button>' +
      authChip +
      quickScoutBtn +
      '<button id="rc-scout-action-btn" style="background:#818cf8;color:#0f172a;border:0;border-radius:999px;padding:5px 12px;font-size:11px;font-weight:900;cursor:pointer;">' +
        primaryActionLabel() +
      '</button>' +
      logoutBtn;

    var toggleBtn = document.getElementById('rc-scout-toggle-btn');
    if (toggleBtn) {
      toggleBtn.onclick = function () {
        state.modalOpen = !state.modalOpen;
        renderUI();
      };
    }

    var signInBtn = document.getElementById('rc-scout-signin-btn');
    if (signInBtn) {
      signInBtn.onclick = function (e) {
        e.stopPropagation();
        if (window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.openConnectFlow) {
          window.__RC_BML_AUTH__.openConnectFlow(false);
        }
      };
    }

    var logoutEl = document.getElementById('rc-scout-logout-btn');
    if (logoutEl) {
      logoutEl.onclick = function (e) {
        e.stopPropagation();
        if (window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.clearSession) {
          window.__RC_BML_AUTH__.clearSession();
        }
        renderUI();
      };
    }

    var openAiBtn = document.getElementById('rc-scout-open-ai-btn');
    if (openAiBtn) {
      openAiBtn.onclick = function (e) {
        e.stopPropagation();
        window.open(state.activeOrigin + '/scout?url=' + encodeURIComponent(window.location.href), '_blank');
      };
    }

    var actionBtn = document.getElementById('rc-scout-action-btn');
    if (actionBtn) {
      actionBtn.onclick = function (e) {
        e.stopPropagation();
        runPreviewOrSync(true);
      };
    }

    var modal = document.getElementById('rc-scout-preview-modal');
    if (!state.modalOpen) {
      if (modal) modal.remove();
      return;
    }

    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'rc-scout-preview-modal';
      modal.style.cssText = 'position:fixed;bottom:68px;right:16px;z-index:2147483646;width:460px;max-width:calc(100vw - 24px);background:#0f172a;color:#f8fafc;border:2px solid #818cf8;border-radius:20px;padding:16px;box-shadow:0 24px 48px rgba(0,0,0,0.65);font-family:system-ui,-apple-system,sans-serif;font-size:12px;line-height:1.45;';
      document.body.appendChild(modal);
    }

    var sourceBadge = state.csvHarvested
      ? '<span style="background:#065f46;color:#d1fae5;padding:2px 7px;border-radius:6px;font-size:10px;font-weight:800;">📄 Full CSV Harvested (' + state.rows.length + ' rows)</span>'
      : '<span style="background:#1e293b;color:#cbd5e1;padding:2px 7px;border-radius:6px;font-size:10px;font-weight:800;">📄 DOM Table (' + state.rows.length + ' rows)</span>';

    var harvestCsvBtnHtml = state.pageType !== 'item'
      ? '<button id="rc-scout-harvest-csv-btn" title="Silently harvest ShopGoodwill CSV in memory (full titles & all rows, no file download)" style="background:#334155;border:1px solid #475569;color:#f8fafc;border-radius:8px;padding:4px 8px;cursor:pointer;font-size:10.5px;font-weight:800;">📥 Harvest CSV</button>'
      : '';

    var bodyHtml = '';
    if (state.loadingPreview) {
      bodyHtml = '<div style="padding:18px;text-align:center;color:#cbd5e1;font-weight:700;">⏳ Building Pre-Flight Queue Preview...</div>';
    } else if (state.errorMsg) {
      bodyHtml = '<div style="background:#7f1d1d;color:#fecaca;padding:10px 12px;border-radius:10px;margin-bottom:10px;font-weight:700;">❌ ' + state.errorMsg + '</div>';
    } else if (state.previewData) {
      var pRows = state.previewData.rows || [];
      var sum = state.previewData.summary || {};
      var bannerText = state.commitResult
        ? '✅ Sync Committed Successfully!'
        : '🔍 Pre-Flight Queue Preview (Review before committing)';
      var bannerBg = state.commitResult ? '#065f46' : '#1e1b4b';

      bodyHtml += '<div style="background:' + bannerBg + ';padding:8px 12px;border-radius:10px;margin-bottom:10px;font-weight:800;font-size:12px;">' + bannerText + '</div>';

      if (state.pageType === 'inprogress-auctions') {
        bodyHtml += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;font-size:11px;">' +
          '<span style="background:#065f46;padding:3px 8px;border-radius:6px;font-weight:800;">🟢 Winning: ' + (sum.winningCount || 0) + '</span>' +
          '<span style="background:#991b1b;padding:3px 8px;border-radius:6px;font-weight:800;">🚨 Outbid: ' + (sum.outbidCount || 0) + '</span>' +
          '<span style="background:#1e293b;padding:3px 8px;border-radius:6px;font-weight:800;">Update: ' + (sum.updatedCount || 0) + ' | New: ' + (sum.createdCount || 0) + '</span>' +
        '</div>';
      } else if (state.pageType === 'closed-auctions') {
        bodyHtml += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;font-size:11px;">' +
          '<span style="background:#065f46;padding:3px 8px;border-radius:6px;font-weight:800;">🏆 Won ➔ Acquired: ' + ((sum.promotedWonCount || 0) + (sum.createdWonCount || 0)) + '</span>' +
          '<span style="background:#7c2d12;padding:3px 8px;border-radius:6px;font-weight:800;">🧹 Lost Cleaned: ' + (sum.cleanedLostCount || 0) + '</span>' +
        '</div>';
      } else if (state.pageType === 'shipped-orders') {
        bodyHtml += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;font-size:11px;">' +
          '<span style="background:#0284c7;padding:3px 8px;border-radius:6px;font-weight:800;">🧾 POs: +' + (sum.createdPoCount || 0) + ' / ↻' + (sum.updatedPoCount || 0) + '</span>' +
          '<span style="background:#065f46;padding:3px 8px;border-radius:6px;font-weight:800;">📦 Items Linked: ' + ((sum.updatedItemCount || 0) + (sum.createdItemCount || 0)) + '</span>' +
        '</div>';
      }

      if (pRows.length > 0) {
        bodyHtml += '<div style="max-height:200px;overflow-y-auto;background:#020617;border:1px solid #1e293b;border-radius:10px;padding:6px 8px;margin-bottom:10px;">';
        pRows.forEach(function (pr) {
          var rightText = pr.detail || ('$' + Number(pr.currentPrice || pr.landedCost || 0).toFixed(2) + ' • ' + pr.action);
          bodyHtml += '<div style="padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;gap:8px;font-size:11px;">' +
            '<span style="font-weight:700;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:225px;" title="' + String(pr.title || '').replace(/"/g, '&quot;') + '">#' + pr.itemId + ' ' + pr.title + '</span>' +
            '<span style="font-family:monospace;font-size:10.5px;color:#93c5fd;text-align:right;white-space:nowrap;">' + rightText + '</span>' +
          '</div>';
        });
        bodyHtml += '</div>';
      }
    } else {
      bodyHtml = '<div style="padding:10px;background:#1e293b;border-radius:10px;margin-bottom:10px;color:#cbd5e1;">Detected <strong>' + state.rows.length + '</strong> row(s) on <code>' + state.pageType + '</code> (' + (state.csvHarvested ? 'from Full CSV with complete titles' : 'from visible table') + '). Click Preview to inspect changes before syncing.</div>';
    }

    var commitBtnHtml = state.previewData && !state.commitResult
      ? '<button id="rc-scout-commit-btn" style="flex:1;background:#10b981;color:#052e16;border:0;border-radius:10px;padding:9px 12px;font-weight:900;cursor:pointer;font-size:12px;">' +
          (state.committing ? '⏳ Committing...' : '🚀 Commit Sync to Works@TheHC') +
        '</button>'
      : '<button id="rc-scout-preview-btn" style="flex:1;background:#818cf8;color:#0f172a;border:0;border-radius:10px;padding:9px 12px;font-weight:900;cursor:pointer;font-size:12px;">🔍 Preview Queue (' + state.rows.length + ')</button>';

    modal.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">' +
        '<div>' +
          '<div style="font-size:14px;font-weight:900;color:#818cf8;">🔭 Works@TheHC — ShopGoodwill Sync</div>' +
          '<div style="font-size:11px;color:#94a3b8;display:flex;align-items:center;gap:6px;margin-top:2px;">' +
            '<span>Page: ' + state.pageType + '</span>' +
            sourceBadge +
          '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:6px;">' +
          harvestCsvBtnHtml +
          '<button id="rc-scout-close-modal" style="background:#1e293b;border:1px solid #334155;color:#f8fafc;border-radius:8px;padding:4px 8px;cursor:pointer;font-weight:800;">✕</button>' +
        '</div>' +
      '</div>' +
      bodyHtml +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        commitBtnHtml +
        '<a href="' + state.activeOrigin + '/purchases" target="_blank" style="background:#1e293b;color:#e2e8f0;text-decoration:none;border-radius:10px;padding:9px 12px;font-weight:800;font-size:11px;">Open /purchases ↗</a>' +
      '</div>';

    var closeModalBtn = document.getElementById('rc-scout-close-modal');
    if (closeModalBtn) {
      closeModalBtn.onclick = function () {
        state.modalOpen = false;
        renderUI();
      };
    }

    var harvestCsvBtn = document.getElementById('rc-scout-harvest-csv-btn');
    if (harvestCsvBtn) {
      harvestCsvBtn.onclick = function () {
        harvestPageCsvSilently(function () {
          if (state.previewData) {
            executeSyncCall(true);
          }
        });
      };
    }

    var previewBtn = document.getElementById('rc-scout-preview-btn');
    if (previewBtn) {
      previewBtn.onclick = function () {
        runPreviewOrSync(true);
      };
    }

    var commitBtn = document.getElementById('rc-scout-commit-btn');
    if (commitBtn && !state.committing) {
      commitBtn.onclick = function () {
        runPreviewOrSync(false);
      };
    }
  }

  window.addEventListener('rc-bml-authenticated', function () {
    fetchWatchlist();
    renderUI();
  });

  window.__RC_REFRESH_FROM_CLOUD__ = function () {
    detectPageAndRows();
    harvestPageCsvSilently(function () {
      fetchWatchlist();
      renderUI();
    });
  };

  installCsvInterceptor();
  detectPageAndRows();
  decoratePageRows();
  renderUI();
  fetchWatchlist();
  // Auto-harvest full CSV silently in memory on table pages (just like Rico!)
  harvestPageCsvSilently();
})();

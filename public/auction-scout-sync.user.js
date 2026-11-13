(function () {
  var ORIGIN = window.__RC_ORIGIN__ || 'https://resalecmd.com';
  var ORIGINS = window.__RC_ORIGINS__ || [ORIGIN, 'https://alpha.resalecmd.com', 'https://resalecmd.com'];

  function cleanText(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function parseDollar(s) {
    var m = String(s || '').match(/\$([0-9,]+(?:\.[0-9]{1,2})?)/);
    if (!m) {
      var m2 = String(s || '').replace(/^[A-Za-z\s#:]+/, '').match(/([0-9,]+(?:\.[0-9]{1,2})?)/);
      return m2 ? parseFloat(m2[1].replace(/,/g, '')) || 0 : 0;
    }
    return parseFloat(m[1].replace(/,/g, '')) || 0;
  }

  function parseMidpointPrice(val) {
    if (!val) return 0;
    var nums = String(val).match(/[0-9]+(?:\.[0-9]{1,2})?/g);
    if (!nums || !nums.length) return 0;
    if (nums.length >= 2) {
      return Math.round(((parseFloat(nums[0]) + parseFloat(nums[1])) / 2) * 100) / 100;
    }
    return parseFloat(nums[0]) || 0;
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

  function normalizeSellerKey(raw) {
    return cleanText(raw)
      .toLowerCase()
      .replace(/^goodwill\s+industries\s+of\s+(?:the\s+)?/i, 'goodwill ')
      .replace(/^goodwill\s+of\s+(?:the\s+)?/i, 'goodwill ')
      .replace(/\([^)]*\)/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  // RFC-4180 CSV parser
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

  var savedZip = '97206';
  try {
    savedZip = localStorage.getItem('rc_sgw_zip') || localStorage.getItem('scout_zip_code') || '97206';
  } catch (e) {}

  var state = {
    pageType: 'unknown',
    rows: [],
    csvRows: [],
    csvHarvested: false,
    capturingCsv: false,
    watchlist: {},
    combinableItems: [],
    trayOpen: false,
    loadingPreview: false,
    committing: false,
    previewData: null,
    commitResult: null,
    errorMsg: null,
    statusToast: null,
    activeOrigin: ORIGIN,
    // Item Scout state
    zipCode: savedZip,
    scoutingItem: false,
    scoutReport: null,
    selectedTier: 'balanced',
    useProxyCents: true,
    useCombineBonus: true,
    customMaxBid: '',
    savingTrack: false,
    trackedSavedMsg: null
  };

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
          return;
        }
      } catch (e) {}
      return origAnchorClick.apply(this, arguments);
    };
  }

  function detectCellHasTrophy(maxBidTd, currentPrice, myMaxBid, statusText) {
    if (myMaxBid > 0 && currentPrice > 0 && myMaxBid > currentPrice) {
      return true;
    }
    if (/won|winning|high\s*bidder/i.test(statusText || '') && !/outbid|lost/i.test(statusText || '')) {
      return true;
    }
    if (/outbid|lost/i.test(statusText || '')) {
      return false;
    }
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
      if (currentPrice > 0 && myMaxBid > 0 && myMaxBid <= currentPrice) {
        return false;
      }
    }
    if (myMaxBid > 0 && currentPrice > 0) {
      return myMaxBid >= currentPrice;
    }
    return false;
  }

  // Evaluate ShopGoodwill Combined Shipping Synergy (20-lb limit, 20-item limit, 7-day window, ~$12 base freight savings)
  function evaluateSellerSynergy(candidateSeller, candidateWeight, candidateItemId) {
    var sellerClean = cleanText(candidateSeller);
    var normKey = normalizeSellerKey(sellerClean);
    if (!normKey || normKey === 'shopgoodwill' || normKey.length < 4) return null;

    var pool = Array.isArray(state.combinableItems) ? state.combinableItems : [];
    var matches = pool.filter(function (entry) {
      if (!entry || String(entry.itemId) === String(candidateItemId || '')) return false;
      var entryKey = normalizeSellerKey(entry.sellerName || entry.rawSellerName || '');
      if (!entryKey) return false;
      return entryKey === normKey || entryKey.indexOf(normKey) !== -1 || normKey.indexOf(entryKey) !== -1;
    });

    if (matches.length === 0) return null;

    var candW = Number(candidateWeight || 1.5) || 1.5;
    var existingW = 0;
    matches.forEach(function (m) {
      existingW += Number(m.shippingWeight || 1.5) || 1.5;
    });
    existingW = Math.round(existingW * 10) / 10;
    var totalW = Math.round((existingW + candW) * 10) / 10;
    var weightLimit = 20.0;
    var itemLimit = 20;
    var totalItems = matches.length + 1;
    var overWeight = totalW > weightLimit;
    var overCount = totalItems > itemLimit;
    var isEligible = !overWeight && !overCount;
    var estSavings = isEligible ? 10.0 : 0;

    return {
      sellerName: matches[0].sellerName || sellerClean,
      matches: matches,
      matchCount: matches.length,
      candidateWeight: candW,
      existingWeight: existingW,
      totalWeight: totalW,
      weightLimit: weightLimit,
      totalItems: totalItems,
      itemLimit: itemLimit,
      overWeight: overWeight,
      overCount: overCount,
      isEligible: isEligible,
      estSavings: estSavings
    };
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

  function scrapeSingleItemDom() {
    var path = window.location.pathname || '';
    var idMatch = path.match(/\/item\/(\d+)/i);
    var itemId = idMatch ? idMatch[1] : '';
    var h1 = cleanText((document.querySelector('h1') || {}).textContent || '');
    var bodyText = cleanText((document.body || {}).innerText || '');

    var priceMatch = bodyText.match(/(?:Current Price|Minimum Bid|Buy Now Price)\s*:?\s*\$([0-9,.]+)/i);
    var currentPrice = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) || 0 : 0;

    var seller = '';
    var sellerMatch = bodyText.match(/Seller\s*:?\s*(Goodwill[^\n\r|]{3,65}|[^\n\r|]{3,50}?Goodwill[^\n\r|]{0,30})/i);
    if (sellerMatch) {
      seller = cleanText(sellerMatch[1]).replace(/\s+(?:Print Page|Share|Location| Seller).*$/i, '');
    }

    var weightMatch = bodyText.match(/(?:Shipping Weight|Weight)\s*:?\s*([0-9.]+)\s*(?:lbs?|pounds?)/i);
    var shippingWeight = weightMatch ? parseFloat(weightMatch[1]) || 1.5 : 1.5;

    var endMatch = bodyText.match(/(?:Ends On|Ending Date)\s*:?\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4}\s+[0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?\s*(?:AM|PM)?)/i);
    var endingDate = endMatch ? cleanText(endMatch[1]) : '';

    var imgs = [];
    var seen = {};
    Array.prototype.slice.call(document.querySelectorAll('img')).forEach(function (img) {
      var src = String(img.getAttribute('src') || img.src || '').trim();
      if (!src || !/^https?:\/\//i.test(src)) return;
      if (/logo|icon|avatar|banner|badge|pixel|analytics|rokt|doubleclick/i.test(src)) return;
      if (src.indexOf('shopgoodwillimages') !== -1 || src.indexOf('azureedge') !== -1 || (img.width >= 140 && img.height >= 140)) {
        var hiRes = src.replace(/-thumb\b|-small\b/i, '');
        if (!seen[hiRes]) {
          seen[hiRes] = true;
          imgs.push(hiRes);
        }
      }
    });

    return {
      itemId: itemId,
      title: h1 || ('ShopGoodwill #' + itemId),
      currentPrice: currentPrice,
      seller: seller || 'ShopGoodwill',
      shippingWeight: shippingWeight,
      endingDate: endingDate,
      images: imgs.slice(0, 12)
    };
  }

  function detectPageAndRows() {
    var path = (window.location.pathname || '').toLowerCase();
    var domRows = [];
    var domByItemId = {};

    if (path.indexOf('/item/') !== -1) {
      state.pageType = 'item';
      domRows.push(scrapeSingleItemDom());
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

        var syn = evaluateSellerSynergy(r.seller, 1.5, r.itemId);
        if (syn && syn.isEligible) {
          var synPill = document.createElement('span');
          synPill.style.cssText = 'background:#0f766e;color:#ccfbf1;padding:2px 6px;border-radius:6px;font-size:10px;font-weight:800;';
          synPill.textContent = '📦 Combine (+' + syn.matchCount + ')';
          badgeWrap.appendChild(synPill);
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

  function callRcApi(method, pathSuffix, bodyObj) {
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
            var err = new Error((data && (data.details || data.message || data.error)) || ('HTTP ' + res.status));
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
    callRcApi('GET', '/api/bml/sgw-sync?mode=watchlist&t=' + Date.now(), null)
      .then(function (data) {
        if (data) {
          if (data.watchlist) state.watchlist = data.watchlist;
          if (Array.isArray(data.combinableItems)) state.combinableItems = data.combinableItems;
          decoratePageRows();
          renderUI();
        }
      })
      .catch(function () {});
  }

  // Run full AI Speed Scout inside the Slide-Over Tray on /item/:id
  function runInTrayAiScout() {
    var auth = window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.getSession ? window.__RC_BML_AUTH__.getSession() : null;
    if (!auth) {
      if (window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.openConnectFlow) {
        window.__RC_BML_AUTH__.openConnectFlow(false);
      }
      return;
    }

    detectPageAndRows();
    var itemRow = state.rows[0] || scrapeSingleItemDom();
    state.scoutingItem = true;
    state.errorMsg = null;
    state.trackedSavedMsg = null;
    state.trayOpen = true;
    renderUI();

    callRcApi('POST', '/api/identify-item', {
      notes: window.location.href + '\nTitle: ' + itemRow.title + '\nCurrent Price: $' + itemRow.currentPrice + '\nSeller: ' + itemRow.seller,
      zipCode: state.zipCode || '97206',
      remoteImageUrls: itemRow.images || []
    })
      .then(function (data) {
        state.scoutingItem = false;
        var firstItem = (data && Array.isArray(data.items) && data.items[0]) ? data.items[0] : data;
        if (!firstItem) {
          throw new Error('AI Scout returned an empty report.');
        }
        state.scoutReport = firstItem;
        if (firstItem.seller_info && firstItem.seller_info.seller_name && state.rows[0]) {
          state.rows[0].seller = firstItem.seller_info.seller_name;
        }
        if (firstItem.seller_info && firstItem.seller_info.shipping_weight && state.rows[0]) {
          state.rows[0].shippingWeight = Number(firstItem.seller_info.shipping_weight) || state.rows[0].shippingWeight;
        }
        state.selectedTier = 'balanced';
        state.customMaxBid = String(computeActiveMaxBid().toFixed(2));
        renderUI();
      })
      .catch(function (err) {
        state.scoutingItem = false;
        state.errorMsg = (err && err.message) || 'AI Speed Scout failed.';
        renderUI();
      });
  }

  function computeScoutFinancials() {
    var itemRow = state.rows[0] || {};
    var rep = state.scoutReport;
    if (!rep) return null;

    var currentBid = Number(
      itemRow.currentPrice ||
        rep.currentBid ||
        (rep.auction_meta && rep.auction_meta.current_bid) ||
        parseDollar(rep.purchase_strategy && rep.purchase_strategy.current_asking_price) ||
        0
    );
    var shipInfo = rep.shipping_info || {};
    var shipTotal = Number(shipInfo.total || (rep.auction_meta && rep.auction_meta.estimated_shipping) || 10.5);
    var shipBase = Number(shipInfo.shipping || Math.max(0, shipTotal - 3));
    var shipHandling = Number(shipInfo.handling || Math.max(0, shipTotal - shipBase));
    var weight = Number((rep.seller_info && rep.seller_info.shipping_weight) || itemRow.shippingWeight || 1.5);
    var sellerName = cleanText((rep.seller_info && rep.seller_info.seller_name) || itemRow.seller || 'ShopGoodwill');
    var sellerId = (rep.seller_info && rep.seller_info.seller_id) || null;
    var canCombine = rep.seller_info && rep.seller_info.can_combine_shipping !== undefined ? Boolean(rep.seller_info.can_combine_shipping) : true;

    var boutiqueStr = (rep.pricing_potential && rep.pricing_potential.boutique) || (rep.price_breakdown && rep.price_breakdown.boutique_premium) || '$24 - $38';
    var fairStr = (rep.pricing_potential && rep.pricing_potential.fair) || (rep.price_breakdown && rep.price_breakdown.fair) || '$16 - $26';

    var boutiqueMid = parseMidpointPrice(boutiqueStr) || 28;
    var fairMid = parseMidpointPrice(fairStr) || 20;
    var targetResale = boutiqueMid > 0 ? boutiqueMid : fairMid;
    var netPayout = Math.round(targetResale * 0.85 * 100) / 100;

    var synergy = canCombine ? evaluateSellerSynergy(sellerName, weight, itemRow.itemId) : null;
    var combineSavings = (synergy && synergy.isEligible && state.useCombineBonus) ? Math.min(12, Math.max(5, Math.round(shipBase * 0.85))) : 0;
    var effectiveShip = Math.max(shipHandling || 2, shipTotal - combineSavings);

    function calcTier(roiMultiple) {
      var targetLanded = Math.round((targetResale / roiMultiple) * 100) / 100;
      var rawMax = Math.max(0, Math.floor(targetLanded - effectiveShip));
      var finalMax = rawMax > 0 && state.useProxyCents ? Number((rawMax + 0.87).toFixed(2)) : rawMax;
      var netProfit = Math.max(0, Math.round(netPayout - (finalMax + effectiveShip)));
      return {
        roi: roiMultiple.toFixed(1) + 'x',
        maxBid: finalMax,
        targetLanded: targetLanded,
        netProfit: netProfit,
        passed: currentBid > finalMax
      };
    }

    return {
      currentBid: currentBid,
      shipTotal: shipTotal,
      shipBase: shipBase,
      shipHandling: shipHandling,
      effectiveShip: effectiveShip,
      combineSavings: combineSavings,
      synergy: synergy,
      weight: weight,
      sellerName: sellerName,
      sellerId: sellerId,
      canCombine: canCombine,
      boutiqueStr: boutiqueStr,
      fairStr: fairStr,
      boutiqueMid: boutiqueMid,
      fairMid: fairMid,
      netPayout: netPayout,
      verdict: (rep.purchase_strategy && rep.purchase_strategy.verdict) || 'WATCH',
      bestPlatform: (rep.market_report && rep.market_report.best_platform) || "Memory Den - Huck's Adventures Outfitters",
      whyPayUp: rep.why_pay_up || (rep.purchase_strategy && rep.purchase_strategy.advice) || '',
      whyPass: rep.why_pass || '',
      lotItems: Array.isArray(rep.lot_items) ? rep.lot_items : [],
      tiers: {
        conservative: calcTier(3.0),
        balanced: calcTier(2.2),
        aggressive: calcTier(1.7)
      }
    };
  }

  function computeActiveMaxBid() {
    var fin = computeScoutFinancials();
    if (!fin) return 0;
    var chosen = fin.tiers[state.selectedTier] || fin.tiers.balanced;
    return chosen ? chosen.maxBid : 0;
  }

  function saveItemToSgwTracker(withAiReport) {
    var auth = window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.getSession ? window.__RC_BML_AUTH__.getSession() : null;
    if (!auth) {
      if (window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.openConnectFlow) {
        window.__RC_BML_AUTH__.openConnectFlow(false);
      }
      return;
    }

    detectPageAndRows();
    var itemRow = state.rows[0] || scrapeSingleItemDom();
    var fin = withAiReport ? computeScoutFinancials() : null;
    var targetMaxBid = parseFloat(state.customMaxBid) || (fin ? computeActiveMaxBid() : 0);

    // Copy targetMaxBid to clipboard if > 0 so user can immediately paste into ShopGoodwill's Max Bid input!
    if (targetMaxBid > 0 && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        navigator.clipboard.writeText(targetMaxBid.toFixed(2));
      } catch (e) {}
    }

    state.savingTrack = true;
    state.errorMsg = null;
    state.trackedSavedMsg = null;
    renderUI();

    var payloadRow = {
      itemId: itemRow.itemId,
      title: (state.scoutReport && (state.scoutReport.title || state.scoutReport.identity)) || itemRow.title,
      currentPrice: fin ? fin.currentBid : itemRow.currentPrice,
      maxBid: targetMaxBid,
      boutiquePrice: fin ? fin.boutiqueMid : 0,
      resalePrice: fin ? fin.fairMid : 0,
      seller: fin ? fin.sellerName : itemRow.seller,
      sellerId: fin ? fin.sellerId : null,
      shippingWeight: fin ? fin.weight : itemRow.shippingWeight,
      canCombineShipping: fin ? fin.canCombine : true,
      endingDate: itemRow.endingDate || '',
      conditionNotes: fin ? fin.whyPayUp : '',
      aiReport: withAiReport && state.scoutReport ? state.scoutReport : null
    };

    callRcApi('POST', '/api/bml/sgw-sync', {
      pageType: 'item',
      dryRun: false,
      rows: [payloadRow]
    })
      .then(function () {
        state.savingTrack = false;
        state.trackedSavedMsg =
          targetMaxBid > 0
            ? '✅ Saved to SGW Tracker & Copied $' + targetMaxBid.toFixed(2) + ' Max Bid to Clipboard!'
            : '✅ Saved to ShopGoodwill Buy Tracker!';
        fetchWatchlist();
        renderUI();
      })
      .catch(function (err) {
        state.savingTrack = false;
        state.errorMsg = (err && err.message) || 'Failed to save item to tracker.';
        renderUI();
      });
  }

  function executeSyncCall(dryRun) {
    detectPageAndRows();
    state.errorMsg = null;
    state.trayOpen = true;
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

    callRcApi('POST', '/api/bml/sgw-sync', {
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

  function renderCombineBannerHtml(synergy) {
    if (!synergy) return '';
    if (synergy.isEligible) {
      var matchList = synergy.matches
        .slice(0, 3)
        .map(function (m) {
          var badge = m.status === 'acquired' ? '🏆 Won' : m.bidState === 'winning' ? '🟢 Winning' : '📌 Tracked';
          return '<div style="font-size:10.5px;color:#d1fae5;margin-top:2px;">• ' + badge + ': #' + escHtml(m.itemId) + ' ' + escHtml(String(m.title || '').slice(0, 38)) + '</div>';
        })
        .join('');
      return (
        '<div style="background:linear-gradient(135deg,#064e3b,#0f766e);border:1px solid #34d399;border-radius:12px;padding:10px 12px;margin-bottom:10px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">' +
            '<span style="font-weight:900;font-size:11.5px;color:#ecfdf5;">📦 COMBINED SHIPPING MATCH (' + synergy.matchCount + ' at ' + escHtml(synergy.sellerName) + ')</span>' +
            '<span style="background:#022c22;color:#6ee7b7;padding:2px 7px;border-radius:999px;font-size:10px;font-family:monospace;font-weight:800;">' +
              synergy.totalWeight + ' / 20.0 lbs • Saves ~$' + synergy.estSavings.toFixed(0) +
            '</span>' +
          '</div>' +
          matchList +
        '</div>'
      );
    }
    return (
      '<div style="background:#7f1d1d;border:1px solid #f87171;border-radius:12px;padding:10px 12px;margin-bottom:10px;color:#fecaca;font-size:11px;font-weight:700;">' +
        '⚠️ 20-LB COMBINED WEIGHT WARNING (' + escHtml(synergy.sellerName) + '): Adding this item brings total weight to ' +
        synergy.totalWeight + ' / 20.0 lbs and will trigger a 2nd shipping box!' +
      '</div>'
    );
  }

  function renderItemTrayBody() {
    var itemRow = state.rows[0] || scrapeSingleItemDom();
    var existingWl = state.watchlist[itemRow.itemId] || null;
    var preSynergy = evaluateSellerSynergy(itemRow.seller, itemRow.shippingWeight, itemRow.itemId);
    var fin = computeScoutFinancials();
    var activeSynergy = fin && fin.synergy ? fin.synergy : preSynergy;

    var html = '';

    // 1. Live Item Summary Header Card
    html +=
      '<div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:10px 12px;margin-bottom:10px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">' +
          '<div style="min-width:0;flex:1;">' +
            '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:3px;">' +
              '<span style="background:#312e81;color:#e0e7ff;padding:2px 7px;border-radius:6px;font-family:monospace;font-size:10.5px;font-weight:800;">#' + escHtml(itemRow.itemId) + '</span>' +
              '<span style="color:#94a3b8;font-size:11px;font-weight:700;">📍 ' + escHtml((fin && fin.sellerName) || itemRow.seller) + '</span>' +
              (existingWl
                ? '<span style="background:#065f46;color:#d1fae5;padding:2px 7px;border-radius:6px;font-size:10px;font-weight:800;">📌 Tracked (Max $' + Number(existingWl.maxBid || 0).toFixed(2) + ')</span>'
                : '') +
            '</div>' +
            '<div style="font-weight:800;font-size:12.5px;color:#f8fafc;line-height:1.35;">' + escHtml(itemRow.title) + '</div>' +
          '</div>' +
          '<div style="text-align:right;flex-shrink:0;">' +
            '<div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:800;">Current Bid</div>' +
            '<div style="font-size:16px;font-weight:900;color:#38bdf8;font-family:monospace;">$' + Number(itemRow.currentPrice || 0).toFixed(2) + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08);font-size:11px;">' +
          '<span style="color:#cbd5e1;">⚖️ Est. Weight: <strong>' + Number((fin && fin.weight) || itemRow.shippingWeight || 1.5).toFixed(1) + ' lbs</strong></span>' +
          '<label style="display:flex;align-items:center;gap:5px;color:#cbd5e1;font-weight:700;">' +
            '<span>Ship ZIP:</span>' +
            '<input id="rc-scout-zip-input" type="text" maxlength="5" value="' + escHtml(state.zipCode) + '" style="width:62px;background:#0f172a;color:#f8fafc;border:1px solid #475569;border-radius:6px;padding:2px 6px;font-family:monospace;font-size:11px;text-align:center;" />' +
          '</label>' +
        '</div>' +
      '</div>';

    // 2. Combined Shipping Synergy Banner (works both before and after running AI Scout!)
    html += renderCombineBannerHtml(activeSynergy);

    if (state.trackedSavedMsg) {
      html += '<div style="background:#065f46;color:#ecfdf5;border:1px solid #34d399;padding:9px 12px;border-radius:10px;margin-bottom:10px;font-weight:800;font-size:11.5px;">' + escHtml(state.trackedSavedMsg) + '</div>';
    }
    if (state.errorMsg) {
      html += '<div style="background:#7f1d1d;color:#fecaca;padding:9px 12px;border-radius:10px;margin-bottom:10px;font-weight:700;font-size:11.5px;">❌ ' + escHtml(state.errorMsg) + '</div>';
    }

    if (state.scoutingItem) {
      html +=
        '<div style="background:#1e1b4b;border:1px solid #818cf8;border-radius:14px;padding:22px 14px;text-align:center;margin-bottom:10px;">' +
          '<div style="font-size:14px;font-weight:900;color:#e0e7ff;margin-bottom:4px;">⚡ Running AI Speed Scout...</div>' +
          '<div style="font-size:11px;color:#a5b4fc;">Fetching ShopGoodwill shipping quote (ZIP ' + escHtml(state.zipCode) + '), inspecting listing photos, and calculating 3-Tier Max Bid ceilings...</div>' +
        '</div>';
      return html;
    }

    if (!fin) {
      html +=
        '<div style="background:#020617;border:1px dashed #334155;border-radius:12px;padding:16px 14px;text-align:center;margin-bottom:10px;color:#94a3b8;">' +
          '<div style="font-size:13px;font-weight:800;color:#e2e8f0;margin-bottom:4px;">Scout First — Only Track What Is Worth Chasing</div>' +
          '<div style="font-size:11px;line-height:1.45;">Click <strong>⚡ Run AI Speed Scout</strong> below to appraise Boutique vs. Online value, live S&amp;H, and your 3.0x / 2.2x / 1.7x Max Bid ceiling right inside this tray.</div>' +
        '</div>';
      return html;
    }

    // 3. AI Speed Scout Report Card
    var verdictBg = fin.verdict === 'CHASE_AUCTION' || fin.verdict === 'BUY_NOW'
      ? '#065f46'
      : fin.verdict === 'PASS'
      ? '#991b1b'
      : '#78350f';
    var verdictIcon = fin.verdict === 'CHASE_AUCTION' || fin.verdict === 'BUY_NOW'
      ? '🔥 '
      : fin.verdict === 'PASS'
      ? '🛑 '
      : '⚠️ ';

    html +=
      '<div style="background:#020617;border:1px solid #334155;border-radius:12px;padding:11px 12px;margin-bottom:10px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px;">' +
          '<span style="background:' + verdictBg + ';color:#fff;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:900;">' +
            verdictIcon + escHtml(fin.verdict) +
          '</span>' +
          '<span style="background:#1e293b;color:#cbd5e1;padding:3px 8px;border-radius:8px;font-size:10.5px;font-weight:800;">' +
            '🏆 Best Venue: ' + escHtml(fin.bestPlatform) +
          '</span>' +
        '</div>' +

        // Valuation + S&H 3-box strip
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px;">' +
          '<div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:6px 8px;">' +
            '<div style="font-size:9.5px;color:#94a3b8;font-weight:800;text-transform:uppercase;">Boutique (MD)</div>' +
            '<div style="font-size:12.5px;font-weight:900;color:#34d399;font-family:monospace;">' + escHtml(fin.boutiqueStr) + '</div>' +
            '<div style="font-size:9.5px;color:#64748b;">Net ~$' + fin.netPayout.toFixed(0) + ' (after 15%)</div>' +
          '</div>' +
          '<div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:6px 8px;">' +
            '<div style="font-size:9.5px;color:#94a3b8;font-weight:800;text-transform:uppercase;">Fair Online</div>' +
            '<div style="font-size:12.5px;font-weight:900;color:#93c5fd;font-family:monospace;">' + escHtml(fin.fairStr) + '</div>' +
            '<div style="font-size:9.5px;color:#64748b;">eBay / Comps</div>' +
          '</div>' +
          '<div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:6px 8px;">' +
            '<div style="font-size:9.5px;color:#94a3b8;font-weight:800;text-transform:uppercase;">Est. S&amp;H</div>' +
            '<div style="font-size:12.5px;font-weight:900;color:#fbbf24;font-family:monospace;">$' + fin.effectiveShip.toFixed(2) + '</div>' +
            '<div style="font-size:9.5px;color:#64748b;">' +
              (fin.combineSavings > 0 ? 'Saved ~$' + fin.combineSavings + ' combine!' : '$' + fin.shipBase.toFixed(2) + ' + $' + fin.shipHandling.toFixed(2) + ' hdl') +
            '</div>' +
          '</div>' +
        '</div>';

    // Interactive 3-Tier Max Bid Selector
    var tierKeys = [
      { key: 'conservative', label: '🛡️ Conservative', sub: '3.0x ROI' },
      { key: 'balanced', label: '⚖️ Balanced', sub: '2.2x Target' },
      { key: 'aggressive', label: '🔥 Aggressive', sub: '1.7x Fast' }
    ];

    html += '<div style="font-size:10.5px;font-weight:800;color:#cbd5e1;margin-bottom:5px;display:flex;justify-content:space-between;align-items:center;">' +
      '<span>🎯 Click a Tier to Set Your Max Bid Ceiling:</span>' +
      '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:10px;color:#a5b4fc;">' +
        '<input type="checkbox" id="rc-scout-proxy-cents" ' + (state.useProxyCents ? 'checked' : '') + ' />' +
        '<span>+.87 Sniper Cents</span>' +
      '</label>' +
    '</div>';

    if (fin.synergy && fin.synergy.isEligible) {
      html += '<label style="display:flex;align-items:center;gap:6px;background:#064e3b;color:#d1fae5;padding:5px 8px;border-radius:8px;margin-bottom:6px;cursor:pointer;font-size:10.5px;font-weight:800;">' +
        '<input type="checkbox" id="rc-scout-combine-bonus" ' + (state.useCombineBonus ? 'checked' : '') + ' />' +
        '<span>📦 Apply Combined Shipping Bonus (+$' + Math.min(12, Math.max(5, Math.round(fin.shipBase * 0.85))) + ' higher Max Bid ceiling)</span>' +
      '</label>';
    }

    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px;">';
    tierKeys.forEach(function (tk) {
      var tObj = fin.tiers[tk.key];
      var isSel = state.selectedTier === tk.key;
      var borderCol = isSel ? '#818cf8' : '#334155';
      var bgCol = isSel ? '#1e1b4b' : '#0f172a';
      html +=
        '<button type="button" class="rc-tier-pick-btn" data-tier="' + tk.key + '" style="background:' + bgCol + ';border:2px solid ' + borderCol + ';border-radius:10px;padding:7px 6px;text-align:center;cursor:pointer;color:#f8fafc;">' +
          '<div style="font-size:10px;font-weight:800;color:#cbd5e1;">' + tk.label + '</div>' +
          '<div style="font-size:14px;font-weight:900;color:' + (tObj.passed ? '#f87171' : '#a5b4fc') + ';font-family:monospace;margin:2px 0;">$' + tObj.maxBid.toFixed(2) + '</div>' +
          '<div style="font-size:9.5px;color:#34d399;font-weight:700;">+$' + tObj.netProfit + ' Net (' + tk.sub + ')</div>' +
        '</button>';
    });
    html += '</div>';

    // Editable Target Max Bid Input
    html +=
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;background:#0f172a;border:1px solid #334155;border-radius:10px;padding:7px 10px;margin-bottom:8px;">' +
        '<span style="font-size:11px;font-weight:800;color:#e2e8f0;">🎯 My Target Max Bid ($):</span>' +
        '<input id="rc-scout-custom-maxbid" type="number" step="0.01" value="' + escHtml(state.customMaxBid || computeActiveMaxBid().toFixed(2)) + '" style="width:105px;background:#1e293b;color:#34d399;border:1px solid #475569;border-radius:8px;padding:4px 8px;font-family:monospace;font-size:13px;font-weight:900;text-align:right;" />' +
      '</div>';

    if (fin.whyPayUp) {
      html += '<div style="font-size:11px;color:#cbd5e1;background:#0f172a;border-left:3px solid #34d399;padding:6px 9px;border-radius:6px;margin-bottom:6px;"><strong>💡 Why Buy:</strong> ' + escHtml(fin.whyPayUp) + '</div>';
    }
    if (fin.whyPass) {
      html += '<div style="font-size:10.5px;color:#fca5a5;background:#0f172a;border-left:3px solid #f87171;padding:6px 9px;border-radius:6px;margin-bottom:6px;"><strong>⚠️ Watch Out:</strong> ' + escHtml(fin.whyPass) + '</div>';
    }

    if (fin.lotItems && fin.lotItems.length > 1) {
      html += '<div style="margin-top:8px;border-top:1px solid #1e293b;padding-top:6px;">' +
        '<div style="font-size:10.5px;font-weight:800;color:#a5b4fc;margin-bottom:4px;">🧩 Multi-Item Lot Breakdown (' + fin.lotItems.length + ' pcs):</div>';
      fin.lotItems.slice(0, 8).forEach(function (li, idx) {
        var liTitle = li.name || li.identity || li.title || ('Piece #' + (idx + 1));
        var liVal = (li.pricing_potential && li.pricing_potential.boutique) || (li.price_breakdown && li.price_breakdown.boutique_premium) || li.estimated_value || '';
        html += '<div style="display:flex;justify-content:space-between;font-size:10.5px;padding:2px 0;color:#cbd5e1;">' +
          '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px;">' + (idx + 1) + '. ' + escHtml(liTitle) + '</span>' +
          '<span style="font-family:monospace;color:#34d399;font-weight:700;">' + escHtml(liVal) + '</span>' +
        '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  function renderTableTrayBody() {
    var bodyHtml = '';
    if (state.loadingPreview) {
      return '<div style="padding:24px;text-align:center;color:#cbd5e1;font-weight:700;">⏳ Building Pre-Flight Queue Preview...</div>';
    }
    if (state.errorMsg) {
      bodyHtml += '<div style="background:#7f1d1d;color:#fecaca;padding:10px 12px;border-radius:10px;margin-bottom:10px;font-weight:700;">❌ ' + escHtml(state.errorMsg) + '</div>';
    }
    if (state.previewData) {
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
        bodyHtml += '<div style="background:#020617;border:1px solid #1e293b;border-radius:10px;padding:6px 8px;margin-bottom:10px;">';
        pRows.forEach(function (pr) {
          var rightText = pr.detail || ('$' + Number(pr.currentPrice || pr.landedCost || 0).toFixed(2) + ' • ' + pr.action);
          bodyHtml += '<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;gap:8px;font-size:11px;">' +
            '<span style="font-weight:700;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:230px;" title="' + escHtml(pr.title) + '">#' + escHtml(pr.itemId) + ' ' + escHtml(pr.title) + '</span>' +
            '<span style="font-family:monospace;font-size:10.5px;color:#93c5fd;text-align:right;white-space:nowrap;">' + escHtml(rightText) + '</span>' +
          '</div>';
        });
        bodyHtml += '</div>';
      }
      return bodyHtml;
    }

    return (
      '<div style="padding:14px;background:#1e293b;border-radius:12px;margin-bottom:10px;color:#cbd5e1;">' +
        'Detected <strong>' + state.rows.length + '</strong> row(s) on <code>' + escHtml(state.pageType) + '</code> (' +
        (state.csvHarvested ? 'from Full CSV with complete titles' : 'from visible table') +
        '). Click <strong>🔍 Preview Queue</strong> below to inspect changes before syncing to Works@TheHC.' +
      '</div>'
    );
  }

  function renderUI() {
    var auth = window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.getSession ? window.__RC_BML_AUTH__.getSession() : null;

    // 1. Minimal Bottom-Right Trigger Pill (#rc-scout-fab-bar)
    var bar = document.getElementById('rc-scout-fab-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'rc-scout-fab-bar';
      bar.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:2147483645;display:flex;align-items:center;gap:6px;background:linear-gradient(135deg,#1e1b4b,#0f172a);color:#f8fafc;border:2px solid #818cf8;border-radius:999px;padding:6px 12px;box-shadow:0 16px 32px rgba(0,0,0,0.55);font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:800;';
      document.body.appendChild(bar);
    }

    var itemRow = state.pageType === 'item' ? (state.rows[0] || scrapeSingleItemDom()) : null;
    var pillSynergy = itemRow ? evaluateSellerSynergy(itemRow.seller, itemRow.shippingWeight, itemRow.itemId) : null;
    var combinePillBadge = pillSynergy && pillSynergy.isEligible
      ? '<span style="background:#065f46;color:#6ee7b7;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:900;">📦 Combine (+' + pillSynergy.matchCount + ')</span>'
      : '';

    var pillCountBadge = state.pageType === 'item'
      ? '<span style="background:#312e81;color:#e0e7ff;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:800;">⚡ AI Scout Tray</span>'
      : '<span style="background:#312e81;color:#e0e7ff;padding:2px 8px;border-radius:999px;font-size:10.5px;font-family:monospace;">' + state.rows.length + (state.csvHarvested ? ' CSV' : '') + '</span>';

    var signInOrRolePill = auth
      ? '<span style="color:#a5b4fc;font-size:11px;">' + escHtml(auth.roleBadge || '👑') + '</span>'
      : '<button id="rc-scout-signin-btn" style="background:#f59e0b;color:#1e1b18;border:0;border-radius:999px;padding:3px 9px;font-size:11px;font-weight:900;cursor:pointer;">🔐 Sign In</button>';

    bar.innerHTML =
      '<span id="rc-sync-fab" style="display:none;"></span>' +
      '<button id="rc-scout-toggle-btn" style="background:transparent;border:0;color:#f8fafc;cursor:pointer;display:flex;align-items:center;gap:6px;padding:2px 4px;font-weight:800;font-size:12px;">' +
        '<span>🔭 RC Scout</span>' +
        pillCountBadge +
        combinePillBadge +
      '</button>' +
      signInOrRolePill;

    var toggleBtn = document.getElementById('rc-scout-toggle-btn');
    if (toggleBtn) {
      toggleBtn.onclick = function () {
        state.trayOpen = !state.trayOpen;
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

    // 2. Full-Height Right-Side Slide-Over Tray (#rc-scout-tray)
    var tray = document.getElementById('rc-scout-tray');
    if (!state.trayOpen) {
      if (tray) tray.remove();
      return;
    }

    if (!tray) {
      tray = document.createElement('div');
      tray.id = 'rc-scout-tray';
      tray.style.cssText = 'position:fixed;top:0;right:0;bottom:0;height:100dvh;width:450px;max-width:94vw;z-index:2147483646;background:#0f172a;color:#f8fafc;border-left:2px solid #818cf8;box-shadow:-16px 0 48px rgba(0,0,0,0.65);display:flex;flex-direction:column;font-family:system-ui,-apple-system,sans-serif;font-size:12px;line-height:1.45;';
      document.body.appendChild(tray);
    }

    var sourceBadge = state.pageType === 'item'
      ? '<span style="background:#312e81;color:#e0e7ff;padding:2px 7px;border-radius:6px;font-size:10px;font-weight:800;">⚡ Single Item Scout</span>'
      : state.csvHarvested
      ? '<span style="background:#065f46;color:#d1fae5;padding:2px 7px;border-radius:6px;font-size:10px;font-weight:800;">📄 Full CSV (' + state.rows.length + ' rows)</span>'
      : '<span style="background:#1e293b;color:#cbd5e1;padding:2px 7px;border-radius:6px;font-size:10px;font-weight:800;">📄 DOM Table (' + state.rows.length + ' rows)</span>';

    var harvestCsvBtnHtml = state.pageType !== 'item'
      ? '<button id="rc-scout-harvest-csv-btn" title="Silently harvest ShopGoodwill CSV in memory" style="background:#334155;border:1px solid #475569;color:#f8fafc;border-radius:8px;padding:4px 8px;cursor:pointer;font-size:10.5px;font-weight:800;">📥 Harvest CSV</button>'
      : '';

    var logoutBtnHtml = auth
      ? '<button id="rc-scout-logout-btn" title="Log Out of Bookmarklet" style="background:#334155;color:#fca5a5;border:1px solid rgba(248,113,113,0.4);border-radius:8px;padding:4px 8px;font-size:10.5px;font-weight:800;cursor:pointer;">🚪</button>'
      : '';

    var footerHtml = '';
    if (state.pageType === 'item') {
      var activeMax = parseFloat(state.customMaxBid) || computeActiveMaxBid();
      if (!state.scoutReport) {
        footerHtml =
          '<div style="display:flex;flex-direction:column;gap:6px;">' +
            '<button id="rc-scout-run-ai-btn" style="width:100%;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:0;border-radius:10px;padding:11px 14px;font-weight:900;cursor:pointer;font-size:13px;box-shadow:0 4px 14px rgba(99,102,241,0.4);">' +
              (state.scoutingItem ? '⏳ Scouting Item...' : '⚡ Run AI Speed Scout (In-Tray)') +
            '</button>' +
            '<div style="display:flex;gap:6px;">' +
              '<button id="rc-scout-quick-track-btn" style="flex:1;background:#1e293b;color:#cbd5e1;border:1px solid #334155;border-radius:8px;padding:7px 10px;font-weight:800;cursor:pointer;font-size:11px;">📌 Quick-Track Without AI</button>' +
              '<a href="' + state.activeOrigin + '/purchases" target="_blank" style="background:#1e293b;color:#93c5fd;text-decoration:none;border:1px solid #334155;border-radius:8px;padding:7px 10px;font-weight:800;font-size:11px;">/purchases ↗</a>' +
            '</div>' +
          '</div>';
      } else {
        footerHtml =
          '<div style="display:flex;flex-direction:column;gap:6px;">' +
            '<button id="rc-scout-save-track-btn" style="width:100%;background:#10b981;color:#052e16;border:0;border-radius:10px;padding:11px 14px;font-weight:900;cursor:pointer;font-size:13px;">' +
              (state.savingTrack
                ? '⏳ Saving to SGW Tracker...'
                : '📌 Track & Copy Max Bid ($' + Number(activeMax || 0).toFixed(2) + ')') +
            '</button>' +
            '<div style="display:flex;gap:6px;">' +
              '<button id="rc-scout-run-ai-btn" style="flex:1;background:#1e293b;color:#cbd5e1;border:1px solid #334155;border-radius:8px;padding:7px 10px;font-weight:800;cursor:pointer;font-size:11px;">🔄 Re-Run AI Scout</button>' +
              '<a href="' + state.activeOrigin + '/scout?url=' + encodeURIComponent(window.location.href) + '" target="_blank" style="background:#1e293b;color:#93c5fd;text-decoration:none;border:1px solid #334155;border-radius:8px;padding:7px 10px;font-weight:800;font-size:11px;">Full /scout ↗</a>' +
            '</div>' +
          '</div>';
      }
    } else {
      var commitBtnHtml = state.previewData && !state.commitResult
        ? '<button id="rc-scout-commit-btn" style="flex:1;background:#10b981;color:#052e16;border:0;border-radius:10px;padding:10px 12px;font-weight:900;cursor:pointer;font-size:12.5px;">' +
            (state.committing ? '⏳ Committing...' : '🚀 Commit Sync to Works@TheHC') +
          '</button>'
        : '<button id="rc-scout-preview-btn" style="flex:1;background:#818cf8;color:#0f172a;border:0;border-radius:10px;padding:10px 12px;font-weight:900;cursor:pointer;font-size:12.5px;">🔍 Preview Queue (' + state.rows.length + ')</button>';

      footerHtml =
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          commitBtnHtml +
          '<a href="' + state.activeOrigin + '/purchases" target="_blank" style="background:#1e293b;color:#e2e8f0;text-decoration:none;border-radius:10px;padding:10px 12px;font-weight:800;font-size:11px;">/purchases ↗</a>' +
        '</div>';
    }

    tray.innerHTML =
      // Pinned Tray Header
      '<div style="padding:12px 14px;background:#1e293b;border-bottom:1px solid #334155;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-shrink:0;">' +
        '<div>' +
          '<div style="font-size:13.5px;font-weight:900;color:#818cf8;">🔭 Works@TheHC — ShopGoodwill Tray</div>' +
          '<div style="font-size:11px;color:#94a3b8;display:flex;align-items:center;gap:6px;margin-top:2px;">' +
            sourceBadge +
            (auth ? '<span style="color:#6ee7b7;font-weight:800;">' + escHtml(auth.roleBadge || '👑') + ' ' + escHtml(auth.name || '') + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:5px;">' +
          harvestCsvBtnHtml +
          logoutBtnHtml +
          '<button id="rc-scout-close-tray" title="Minimize to corner pill" style="background:#0f172a;border:1px solid #334155;color:#f8fafc;border-radius:8px;padding:4px 9px;cursor:pointer;font-weight:900;">✕</button>' +
        '</div>' +
      '</div>' +
      // Scrollable Tray Body
      '<div style="flex:1;overflow-y:auto;padding:12px 14px;">' +
        (state.pageType === 'item' ? renderItemTrayBody() : renderTableTrayBody()) +
      '</div>' +
      // Pinned Tray Footer
      '<div style="padding:10px 14px;background:#1e293b;border-top:1px solid #334155;flex-shrink:0;">' +
        footerHtml +
      '</div>';

    // Wire Tray event listeners
    var closeTrayBtn = document.getElementById('rc-scout-close-tray');
    if (closeTrayBtn) {
      closeTrayBtn.onclick = function () {
        state.trayOpen = false;
        renderUI();
      };
    }

    var logoutEl = document.getElementById('rc-scout-logout-btn');
    if (logoutEl) {
      logoutEl.onclick = function () {
        if (window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.clearSession) {
          window.__RC_BML_AUTH__.clearSession();
        }
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

    var zipInput = document.getElementById('rc-scout-zip-input');
    if (zipInput) {
      zipInput.onchange = function () {
        var cleanZip = String(zipInput.value || '').replace(/\D/g, '').slice(0, 5);
        if (cleanZip.length === 5) {
          state.zipCode = cleanZip;
          try {
            localStorage.setItem('rc_sgw_zip', cleanZip);
          } catch (e) {}
        }
      };
    }

    var proxyCentsCheckbox = document.getElementById('rc-scout-proxy-cents');
    if (proxyCentsCheckbox) {
      proxyCentsCheckbox.onchange = function () {
        state.useProxyCents = Boolean(proxyCentsCheckbox.checked);
        state.customMaxBid = String(computeActiveMaxBid().toFixed(2));
        renderUI();
      };
    }

    var combineBonusCheckbox = document.getElementById('rc-scout-combine-bonus');
    if (combineBonusCheckbox) {
      combineBonusCheckbox.onchange = function () {
        state.useCombineBonus = Boolean(combineBonusCheckbox.checked);
        state.customMaxBid = String(computeActiveMaxBid().toFixed(2));
        renderUI();
      };
    }

    var tierBtns = tray.querySelectorAll('.rc-tier-pick-btn');
    Array.prototype.slice.call(tierBtns).forEach(function (btn) {
      btn.onclick = function () {
        var tier = btn.getAttribute('data-tier') || 'balanced';
        state.selectedTier = tier;
        state.customMaxBid = String(computeActiveMaxBid().toFixed(2));
        renderUI();
      };
    });

    var customMaxBidInput = document.getElementById('rc-scout-custom-maxbid');
    if (customMaxBidInput) {
      customMaxBidInput.oninput = function () {
        state.customMaxBid = customMaxBidInput.value;
        var saveBtn = document.getElementById('rc-scout-save-track-btn');
        if (saveBtn && !state.savingTrack) {
          var v = parseFloat(state.customMaxBid) || 0;
          saveBtn.textContent = '📌 Track & Copy Max Bid ($' + v.toFixed(2) + ')';
        }
      };
    }

    var runAiBtn = document.getElementById('rc-scout-run-ai-btn');
    if (runAiBtn && !state.scoutingItem) {
      runAiBtn.onclick = function () {
        runInTrayAiScout();
      };
    }

    var quickTrackBtn = document.getElementById('rc-scout-quick-track-btn');
    if (quickTrackBtn && !state.savingTrack) {
      quickTrackBtn.onclick = function () {
        saveItemToSgwTracker(false);
      };
    }

    var saveTrackBtn = document.getElementById('rc-scout-save-track-btn');
    if (saveTrackBtn && !state.savingTrack) {
      saveTrackBtn.onclick = function () {
        saveItemToSgwTracker(true);
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
    if (state.pageType === 'item') {
      state.trayOpen = true;
    }
    harvestPageCsvSilently(function () {
      fetchWatchlist();
      renderUI();
    });
  };

  installCsvInterceptor();
  detectPageAndRows();
  if (state.pageType === 'item') {
    state.trayOpen = true;
  }
  decoratePageRows();
  renderUI();
  fetchWatchlist();
  harvestPageCsvSilently();
})();

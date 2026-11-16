(function () {
  var FILE_BUILD = 'v4.5.0';
  var SCRIPT_VERSION = window.__RC_SCRIPT_VERSION__ || 'v4.5';

  // Same-version 2nd Bookmarks Bar click: toggle Drawer <-> Pill in place without wiping state!
  try {
    if (
      window.__RC_SCOUT_LIVE__ &&
      window.__RC_SCOUT_LIVE__.version === SCRIPT_VERSION &&
      window.__RC_SCOUT_LIVE__.build === FILE_BUILD &&
      typeof window.__RC_SCOUT_LIVE__.onBookmarkletClick === 'function'
    ) {
      window.__RC_SCOUT_LIVE__.onBookmarkletClick();
      return;
    }
  } catch (e) {}

  // Hot-swap: if an older tray version is mounted on this tab, tear it down cleanly (preserving same-URL hot state)
  try {
    if (typeof window.__RC_SCOUT_TEARDOWN__ === 'function') window.__RC_SCOUT_TEARDOWN__();
  } catch (e) {}

  try {
    if (window.__RC_BML_CORE__ && typeof window.__RC_BML_CORE__.ensureShellStyles === 'function') {
      window.__RC_BML_CORE__.ensureShellStyles();
    }
  } catch (e) {}

  var ORIGIN = window.__RC_ORIGIN__ || 'https://resalecmd.com';
  var ORIGINS = window.__RC_ORIGINS__ || [ORIGIN, 'https://alpha.resalecmd.com', 'https://resalecmd.com'];
  var ORIGIN_HOST = (function () {
    try { return new URL(ORIGIN).host; } catch (e) { return String(ORIGIN || ''); }
  })();

  function getBmlToolConfig() {
    var def = {
      title: '🔭 RC Scout',
      icon: '🔭',
      trayTitle: 'Works@TheHC — ShopGoodwill Tray'
    };
    try {
      if (window.__RC_BML_CORE__ && typeof window.__RC_BML_CORE__.getToolConfig === 'function') {
        return window.__RC_BML_CORE__.getToolConfig('auction_scout', def);
      }
    } catch (e) {}
    return def;
  }

  function notifyRcTabs(detail) {
    try {
      if (window.__RC_BML_CORE__ && typeof window.__RC_BML_CORE__.notifyTabsUpdated === 'function') {
        window.__RC_BML_CORE__.notifyTabsUpdated(detail || { tool: 'auction_scout' });
      }
    } catch (e) {}
  }

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
    existingOrders: {},
    activeTracker: null,
    domainProfiles: null,
    roiTargets: null,
    domainTrackers: null,
    trayOpen: false,
    loadingPreview: false,
    committing: false,
    previewData: null,
    commitResult: null,
    selectedRowKeys: {},
    tableFilter: 'ALL',
    errorMsg: null,
    statusToast: null,
    activeOrigin: ORIGIN,
    // Item Scout state
    zipCode: savedZip,
    scoutingItem: false,
    scoutReport: null,
    isRestoredSavedReport: false,
    restoredDocId: '',
    loadingRestoredDocId: '',
    selectedTier: 'balanced',
    useProxyCents: true,
    useCombineBonus: true,
    customMaxBid: '',
    savingTrack: false,
    trackedSavedMsg: null,
    lastSavedTracker: null,
    lastSavedForItemId: '',
    galleryUrls: [],
    selectedPhotoUrls: {},
    hasManualPhotoToggles: false,
    coverPhotoUrl: '',
    resellerNotes: '',
    detailsOpen: false,
    galleryExpandedPostScan: false,
    combineExpandedPostScan: false,
    justFinishedScan: false,
    lastSyncedItemId: '',
    lastObservedHref: String(window.location.href || ''),
    lastHandledClickSeq: Number(window.__RC_BML_CLICK_SEQ__ || 0),
    sgwApi: {},
    sgwApiLoading: '',
    // Auction Sweep (v4.5) grid triage state
    gridCards: [],
    sweepingGrid: false,
    sweepProgressMsg: '',
    sweepData: null,
    sweepByKey: {},
    sweepFilter: 'HITS',
    dimPassedCards: true,
    quickTrackingKey: '',
    inspectingGridItem: null
  };

  // Rehydrate hot state if an older build was hot-swapped on the exact same URL within 30 minutes
  try {
    var hot = window.__RC_SCOUT_HOT_STATE__;
    if (hot && hot.href === String(window.location.href || '') && (Date.now() - Number(hot.ts || 0)) < 30 * 60 * 1000) {
      if (hot.scoutReport) state.scoutReport = hot.scoutReport;
      if (Array.isArray(hot.galleryUrls)) state.galleryUrls = hot.galleryUrls;
      if (hot.selectedPhotoUrls) state.selectedPhotoUrls = hot.selectedPhotoUrls;
      if (hot.hasManualPhotoToggles) state.hasManualPhotoToggles = Boolean(hot.hasManualPhotoToggles);
      if (hot.coverPhotoUrl) state.coverPhotoUrl = hot.coverPhotoUrl;
      if (hot.resellerNotes) state.resellerNotes = hot.resellerNotes;
      if (hot.watchlist) state.watchlist = hot.watchlist;
      if (Array.isArray(hot.combinableItems)) state.combinableItems = hot.combinableItems;
      if (hot.sgwApi) state.sgwApi = hot.sgwApi;
      if (hot.domainProfiles) state.domainProfiles = hot.domainProfiles;
      if (hot.roiTargets) state.roiTargets = hot.roiTargets;
      if (hot.sweepData) state.sweepData = hot.sweepData;
      if (hot.sweepByKey) state.sweepByKey = hot.sweepByKey;
      if (hot.sweepFilter) state.sweepFilter = hot.sweepFilter;
      if (hot.dimPassedCards !== undefined) state.dimPassedCards = Boolean(hot.dimPassedCards);
    }
    window.__RC_SCOUT_HOT_STATE__ = null;
  } catch (e) {}

  var CLIENT_PLACEHOLDER_SELLERS = {
    'shopgoodwill': 1,
    'shopgoodwill com': 1,
    'ebay': 1,
    'fb marketplace': 1,
    'facebook marketplace': 1,
    'facebook': 1,
    'craigslist': 1,
    'offerup': 1,
    'hibid': 1,
    'ctbids': 1,
    'liveauctioneers': 1,
    'proxibid': 1,
    'maxsold': 1,
    'estatesales net': 1,
    'poshmark': 1,
    'mercari': 1,
    'depop': 1,
    'etsy': 1,
    'whatnot': 1,
    'online listing': 1,
    'seller': 1,
    'unknown': 1,
    'unknown seller': 1
  };

  function isPlaceholderSeller(raw) {
    var k = cleanText(raw).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!k || k.length < 3) return true;
    return Boolean(CLIENT_PLACEHOLDER_SELLERS[k]);
  }

  function resolveClientDomainKey(itemRow) {
    if (isShopGoodwillHost()) return 'shopgoodwill';
    var host = String(window.location.hostname || '').toLowerCase();
    var fam = String((itemRow && itemRow.domainFamily) || '').toLowerCase();
    var mode = String((itemRow && itemRow.listingMode) || '').toLowerCase();
    if (/(^|\.)ebay\./i.test(host)) return 'ebay';
    if (fam === 'local_cash' || mode === 'local_cash' || /facebook\.com|craigslist\.org|offerup\.com/i.test(host)) {
      return 'local_cash';
    }
    if (fam === 'buyers_premium_auction' || mode === 'soft_close_auction' || /hibid\.com|ctbids\.com|liveauctioneers\.com|proxibid\.com|maxsold\.com/i.test(host)) {
      return 'estate_bp';
    }
    if (/poshmark\.com|mercari\.com|depop\.com|etsy\.com|whatnot\.com/i.test(host)) {
      return 'fixed_marketplace';
    }
    return 'generic_url';
  }

  function getActiveDomainProfile(domainKey) {
    var key = domainKey || 'generic_url';
    var defaults = {
      shopgoodwill: { allowsCombinedShipping: true, maxWeightLbs: 20, maxItemCount: 20, combineWindowDays: 7, combineSavingsEstimate: 10, trackerPrefix: 'SC' },
      ebay: { allowsCombinedShipping: false, maxWeightLbs: 0, maxItemCount: 0, combineWindowDays: 0, combineSavingsEstimate: 0, trackerPrefix: 'EB' },
      local_cash: { allowsCombinedShipping: false, maxWeightLbs: 0, maxItemCount: 0, combineWindowDays: 0, combineSavingsEstimate: 0, trackerPrefix: 'LC' },
      estate_bp: { allowsCombinedShipping: false, maxWeightLbs: 0, maxItemCount: 0, combineWindowDays: 0, combineSavingsEstimate: 0, trackerPrefix: 'BP' },
      fixed_marketplace: { allowsCombinedShipping: false, maxWeightLbs: 0, maxItemCount: 0, combineWindowDays: 0, combineSavingsEstimate: 0, trackerPrefix: 'OM' },
      generic_url: { allowsCombinedShipping: false, maxWeightLbs: 0, maxItemCount: 0, combineWindowDays: 0, combineSavingsEstimate: 0, trackerPrefix: 'OM' }
    };
    var base = defaults[key] || defaults.generic_url;
    var cloud = state.domainProfiles && state.domainProfiles[key];
    if (!cloud || typeof cloud !== 'object') return base;
    return {
      allowsCombinedShipping: cloud.allowsCombinedShipping !== undefined ? Boolean(cloud.allowsCombinedShipping) : base.allowsCombinedShipping,
      maxWeightLbs: Number(cloud.maxWeightLbs !== undefined ? cloud.maxWeightLbs : base.maxWeightLbs) || 0,
      maxItemCount: Number(cloud.maxItemCount !== undefined ? cloud.maxItemCount : base.maxItemCount) || 0,
      combineWindowDays: Number(cloud.combineWindowDays !== undefined ? cloud.combineWindowDays : base.combineWindowDays) || 0,
      combineSavingsEstimate: Number(cloud.combineSavingsEstimate !== undefined ? cloud.combineSavingsEstimate : base.combineSavingsEstimate) || base.combineSavingsEstimate,
      trackerPrefix: String(cloud.trackerPrefix || base.trackerPrefix || 'OM')
    };
  }

  function isShopGoodwillHost() {
    return /(^|\.)shopgoodwill\.com$/i.test(String(window.location.hostname || ''));
  }

  function isItemScoutMode() {
    return state.pageType === 'item' || state.pageType === 'external-item' || Boolean(state.inspectingGridItem);
  }

  function isAuctionSweepMode() {
    return state.pageType === 'auction-grid' && !state.inspectingGridItem;
  }

  function normalizeUrlWatchlistKey(rawUrl) {
    try {
      var u = new URL(String(rawUrl || window.location.href));
      return (u.origin + u.pathname).replace(/\/+$/, '').toLowerCase();
    } catch (e) {
      return String(rawUrl || '').trim().toLowerCase();
    }
  }

  function lookupWatchlistForItem(itemRow) {
    if (!itemRow || !state.watchlist) return null;
    if (itemRow.itemId && state.watchlist[itemRow.itemId]) return state.watchlist[itemRow.itemId];
    if (itemRow.externalItemId && state.watchlist[itemRow.externalItemId]) return state.watchlist[itemRow.externalItemId];
    var urlKey = normalizeUrlWatchlistKey(itemRow.sourceUrl || window.location.href);
    if (urlKey && state.watchlist[urlKey]) return state.watchlist[urlKey];
    return null;
  }

  function installCsvInterceptor() {
    if (!isShopGoodwillHost()) return;
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

  // Domain-Scoped Combined Shipping Synergy (ShopGoodwill-only by default; respects cloud domainProfiles from /studios/appraisal)
  function evaluateSellerSynergy(candidateSeller, candidateWeight, candidateItemId, domainKeyOpt) {
    var dKey = domainKeyOpt || (isShopGoodwillHost() ? 'shopgoodwill' : resolveClientDomainKey(state.rows && state.rows[0]));
    var prof = getActiveDomainProfile(dKey);
    if (!prof || !prof.allowsCombinedShipping) return null;

    var sellerClean = cleanText(candidateSeller);
    if (isPlaceholderSeller(sellerClean)) return null;
    var normKey = normalizeSellerKey(sellerClean);
    if (!normKey || normKey === 'shopgoodwill' || normKey.length < 4) return null;

    var pool = Array.isArray(state.combinableItems) ? state.combinableItems : [];
    var matches = pool.filter(function (entry) {
      if (!entry || String(entry.itemId) === String(candidateItemId || '')) return false;
      var entryDomain = entry.domainKey || 'shopgoodwill';
      if (entryDomain !== dKey) return false;
      var rawEntrySeller = entry.sellerName || entry.rawSellerName || '';
      if (isPlaceholderSeller(rawEntrySeller)) return false;
      var entryKey = normalizeSellerKey(rawEntrySeller);
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
    var weightLimit = Number(prof.maxWeightLbs) > 0 ? Number(prof.maxWeightLbs) : 20.0;
    var itemLimit = Number(prof.maxItemCount) > 0 ? Number(prof.maxItemCount) : 20;
    var totalItems = matches.length + 1;
    var overWeight = prof.maxWeightLbs > 0 && totalW > weightLimit;
    var overCount = prof.maxItemCount > 0 && totalItems > itemLimit;
    var isEligible = !overWeight && !overCount;
    var estSavings = isEligible ? (Number(prof.combineSavingsEstimate) > 0 ? Number(prof.combineSavingsEstimate) : 10.0) : 0;

    return {
      domainKey: dKey,
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
          titleTd: domRow ? domRow.titleTd : null,
          orderTd: domRow ? domRow.orderTd : null,
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

  function isElementInsideRelatedSection(el) {
    if (!el || !el.closest) return false;
    if (
      el.closest(
        'app-related-items, app-featured-items, .you-may-also-like, [class*="related-item" i], [class*="also-like" i], [class*="recommend" i], [class*="similar-item" i], [aria-label*="similar" i], [aria-label*="sponsored" i], [aria-label*="advertisement" i], [id*="taboola" i], [class*="taboola" i], [id*="outbrain" i], [class*="outbrain" i], [id*="google_ads" i], [id*="ad_unit" i], [class*="ad-container" i], ins, footer, header, nav'
      )
    ) {
      return true;
    }
    // On /item/:id, reject any image inside a link or card pointing to a DIFFERENT /item/<otherId>
    var pageItemMatch = String(window.location.pathname || '').match(/\/item\/(\d+)/i);
    var pageItemId = pageItemMatch ? pageItemMatch[1] : '';
    var parentLink = el.closest('a[href]');
    if (parentLink) {
      var href = String(parentLink.getAttribute('href') || '');
      var linkItemMatch = href.match(/\/item\/(\d+)/i);
      if (pageItemId && linkItemMatch && linkItemMatch[1] !== pageItemId) {
        return true;
      }
      if (/doubleclick|googlesyndication|adservice|taboola|outbrain|rokt|tiktok/i.test(href)) {
        return true;
      }
    }
    // Check if inside a "Report Ad", "You May Also Like", or "Similar items" container
    var cur = el;
    var depth = 0;
    while (cur && cur !== document.body && depth < 7) {
      var txt = String(cur.textContent || '').trim();
      if (txt.length < 1200) {
        if (/^(?:you\s+may\s+also\s+like|similar\s+(?:items|listings|sponsored)|people\s+also\s+viewed|today'?s\s+picks|more\s+from\s+this\s+seller)/i.test(txt)) {
          return true;
        }
        if (/\breport\s+ad\b|\bsponsored\s+links\b/i.test(txt) && txt.length < 400) {
          return true;
        }
      }
      cur = cur.parentElement;
      depth++;
    }
    return false;
  }

  function extractJsonLdListingHints() {
    var result = {
      title: '',
      description: '',
      price: 0,
      seller: '',
      images: []
    };
    var scripts = Array.prototype.slice.call(document.querySelectorAll('script[type="application/ld+json"]'));
    function visitNode(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        node.forEach(visitNode);
        return;
      }
      if (node['@graph']) visitNode(node['@graph']);
      var t = String(node['@type'] || '').toLowerCase();
      if (t.indexOf('product') !== -1 || t.indexOf('individualproduct') !== -1 || t.indexOf('offer') !== -1) {
        if (!result.title && node.name) result.title = cleanText(node.name);
        if (!result.description && node.description) result.description = cleanText(node.description).slice(0, 1800);
        var imgs = node.image;
        if (typeof imgs === 'string') result.images.push(imgs);
        else if (Array.isArray(imgs)) {
          imgs.forEach(function (it) {
            if (typeof it === 'string') result.images.push(it);
            else if (it && typeof it.url === 'string') result.images.push(it.url);
            else if (it && typeof it.contentUrl === 'string') result.images.push(it.contentUrl);
          });
        } else if (imgs && typeof imgs.url === 'string') {
          result.images.push(imgs.url);
        }
        var offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
        if (offers && typeof offers === 'object') {
          var rawP = offers.price || offers.lowPrice || offers.highPrice;
          if (!result.price && rawP !== undefined) {
            var numP = parseFloat(String(rawP).replace(/[^0-9.]/g, ''));
            if (numP > 0) result.price = numP;
          }
          if (!result.seller && offers.seller && offers.seller.name) {
            result.seller = cleanText(offers.seller.name);
          }
        }
        if (!result.seller && node.brand && node.brand.name) {
          result.seller = cleanText(node.brand.name);
        }
      }
    }
    scripts.forEach(function (sc) {
      try {
        var parsed = JSON.parse(sc.textContent || '');
        visitNode(parsed);
      } catch (e) {}
    });
    return result;
  }

  function upgradeAndKeyExternalImage(rawUrl, host) {
    var u = String(rawUrl || '').trim();
    if (!u) return null;
    if (u.indexOf('//') === 0) u = window.location.protocol + u;
    if (!/^https?:\/\//i.test(u)) return null;
    if (/logo|icon|avatar|sprite|badge|pixel|analytics|rokt|doubleclick|blank\.gif|spacer|spinner|loading|placeholder/i.test(u)) {
      return null;
    }
    if (/\.svg(?:\?|$)/i.test(u)) return null;

    var hiRes = u;
    var dedupeKey = u.split('#')[0];

    // eBay high-res upgrade + /images/g/<HASH>/ deduplication
    if (/ebayimg\.com/i.test(u)) {
      var hashMatch = u.match(/\/images\/g\/([^/]+)\//i);
      if (hashMatch && hashMatch[1]) {
        dedupeKey = 'ebayimg:' + hashMatch[1];
      }
      hiRes = u.replace(/\/s-l\d+\.(jpg|jpeg|png|webp)/i, '/s-l1600.$1');
    } else if (/hibid\.com/i.test(u) || /hibid\.com/i.test(host)) {
      hiRes = u.replace(/_thumb\b/i, '').replace(/([?&])(?:w|width|h|height)=\d+/gi, '$1width=1400');
      dedupeKey = hiRes.split('?')[0];
    } else if (/liveauctioneers\.com/i.test(u)) {
      hiRes = u.replace(/([?&])width=\d+/i, '$1width=1600');
      dedupeKey = hiRes.split('?')[0];
    } else {
      dedupeKey = hiRes.replace(/([?&])(?:w|width|h|height|size|impolicy)=[^&]+/gi, '');
    }

    return { url: hiRes, key: dedupeKey };
  }

  function scrapeExternalListingDom() {
    var href = String(window.location.href || '');
    var host = String(window.location.hostname || '').toLowerCase();
    var path = String(window.location.pathname || '');
    var ld = extractJsonLdListingHints();

    var platformName = host.replace(/^www\./i, '') || 'Online Listing';
    var domainFamily = 'generic_online';
    var listingMode = 'fixed_online';
    var isAuction = false;
    var isSoftClose = false;
    var isLocalPickupOnly = false;
    var buyersPremiumPct = 0;
    var shippingCost = null;
    var externalItemId = '';

    if (/(^|\.)ebay\./i.test(host)) {
      platformName = 'eBay';
      domainFamily = 'national_marketplace';
      var ebMatch = href.match(/\/itm\/(?:[^/?#]+\/)?(\d{9,15})/i) || href.match(/[?&]item=(\d{9,15})/i);
      if (ebMatch && ebMatch[1]) externalItemId = 'ebay:' + ebMatch[1];
    } else if (/facebook\.com/i.test(host) && /\/marketplace\//i.test(path)) {
      platformName = 'FB Marketplace';
      domainFamily = 'local_cash';
      listingMode = 'local_cash';
      isLocalPickupOnly = true;
      shippingCost = 0;
      var fbMatch = path.match(/\/marketplace\/item\/(\d+)/i);
      if (fbMatch && fbMatch[1]) externalItemId = 'fbm:' + fbMatch[1];
    } else if (/hibid\.com/i.test(host)) {
      platformName = 'HiBid';
      domainFamily = 'buyers_premium_auction';
      listingMode = 'soft_close_auction';
      isAuction = true;
      isSoftClose = true;
      buyersPremiumPct = 15;
      var hbMatch = path.match(/\/lot\/(\d+)/i);
      if (hbMatch && hbMatch[1]) externalItemId = 'hibid:' + hbMatch[1];
    } else if (/ctbids\.com/i.test(host)) {
      platformName = 'CTBids';
      domainFamily = 'buyers_premium_auction';
      listingMode = 'soft_close_auction';
      isAuction = true;
      isSoftClose = true;
      buyersPremiumPct = 15;
      var ctMatch = path.match(/\/item\/(\d+)/i) || href.match(/item[_-]?id=(\d+)/i);
      if (ctMatch && ctMatch[1]) externalItemId = 'ctbids:' + ctMatch[1];
    } else if (/liveauctioneers\.com/i.test(host)) {
      platformName = 'LiveAuctioneers';
      domainFamily = 'buyers_premium_auction';
      listingMode = 'soft_close_auction';
      isAuction = true;
      isSoftClose = true;
      buyersPremiumPct = 20;
      var laMatch = path.match(/\/item\/(\d+)/i);
      if (laMatch && laMatch[1]) externalItemId = 'liveauc:' + laMatch[1];
    } else if (/proxibid\.com/i.test(host) || /maxsold\.com/i.test(host)) {
      platformName = /maxsold/i.test(host) ? 'MaxSold' : 'Proxibid';
      domainFamily = 'buyers_premium_auction';
      listingMode = 'soft_close_auction';
      isAuction = true;
      isSoftClose = true;
      buyersPremiumPct = 15;
    } else if (/estatesales\.net/i.test(host)) {
      platformName = 'EstateSales.net';
      if (/\/marketplace\//i.test(path)) {
        domainFamily = 'buyers_premium_auction';
        listingMode = 'soft_close_auction';
        isAuction = true;
        isSoftClose = true;
        buyersPremiumPct = 15;
      } else {
        domainFamily = 'local_cash';
        listingMode = 'local_cash';
        isLocalPickupOnly = true;
        shippingCost = 0;
      }
    } else if (/craigslist\.org/i.test(host) || /offerup\.com/i.test(host)) {
      platformName = /craigslist/i.test(host) ? 'Craigslist' : 'OfferUp';
      domainFamily = 'local_cash';
      listingMode = 'local_cash';
      isLocalPickupOnly = true;
      shippingCost = 0;
    } else if (/poshmark\.com|mercari\.com|depop\.com|etsy\.com|whatnot\.com/i.test(host)) {
      platformName = /poshmark/i.test(host)
        ? 'Poshmark'
        : /mercari/i.test(host)
        ? 'Mercari'
        : /depop/i.test(host)
        ? 'Depop'
        : /whatnot/i.test(host)
        ? 'Whatnot'
        : 'Etsy';
      domainFamily = 'national_marketplace';
      listingMode = /whatnot/i.test(host) ? 'auction' : 'fixed_online';
      isAuction = /whatnot/i.test(host);
    }

    var mainRoot =
      (platformName === 'FB Marketplace' && document.querySelector('[role="main"]')) ||
      document.querySelector('main, [role="main"], #mainContent') ||
      document.body;

    var ogTitleEl = document.querySelector('meta[property="og:title"], meta[name="twitter:title"]');
    var ogTitle = ogTitleEl ? cleanText(ogTitleEl.getAttribute('content') || '') : '';
    var eBayTitleEl = document.querySelector('.x-item-title__mainTitle');
    var h1El = (mainRoot && mainRoot.querySelector('h1')) || document.querySelector('h1');
    var rawTitle = cleanText((eBayTitleEl && eBayTitleEl.textContent) || (h1El && h1El.textContent) || ld.title || ogTitle || document.title || '');
    rawTitle = rawTitle.replace(/\s*[|\-–]\s*(?:eBay|Facebook|Poshmark|Mercari|HiBid.*|CTBids.*)$/i, '').trim();

    var mainText = cleanText((mainRoot && mainRoot.innerText) || (document.body && document.body.innerText) || '');
    var topSlice = mainText.slice(0, 6500);

    // Price extraction
    var currentPrice = ld.price || 0;
    if (platformName === 'eBay') {
      var ebPriceEl = document.querySelector('.x-price-primary span, .x-bid-price__content span');
      if (ebPriceEl) {
        var ebP = parseDollar(ebPriceEl.textContent);
        if (ebP > 0) currentPrice = ebP;
      }
      if (document.querySelector('[data-testid="x-bid-action"], #bidBtn_btn') || /\bplace\s+bid\b|\bbids?\s*·\s*time\s+left\b/i.test(topSlice.slice(0, 2500))) {
        isAuction = true;
        listingMode = 'auction';
      }
      var ebShipEl = document.querySelector('.ux-labels-values--shipping');
      var ebShipTxt = cleanText((ebShipEl && ebShipEl.textContent) || '');
      if (/local\s+pickup\s+only|free\s+local\s+pickup/i.test(ebShipTxt) && !/\$\d/.test(ebShipTxt)) {
        isLocalPickupOnly = true;
        shippingCost = 0;
      } else if (/free\s+(?:standard\s+|expedited\s+|economy\s+)?shipping|free\s+delivery/i.test(ebShipTxt)) {
        shippingCost = 0;
      } else if (ebShipTxt) {
        var ebShipM = ebShipTxt.match(/\$([0-9,]+(?:\.[0-9]{1,2})?)/);
        if (ebShipM) shippingCost = parseFloat(ebShipM[1].replace(/,/g, '')) || 0;
      }
    }

    if (!currentPrice) {
      var metaPriceEl = document.querySelector('meta[property="product:price:amount"], meta[property="og:price:amount"]');
      if (metaPriceEl) {
        var mp = parseFloat(String(metaPriceEl.getAttribute('content') || '').replace(/[^0-9.]/g, ''));
        if (mp > 0) currentPrice = mp;
      }
    }
    if (!currentPrice) {
      var askMatch = topSlice.match(/(?:Current\s+Bid|High\s+Bid|Winning\s+Bid|Starting\s+Bid|Current\s+Price|Asking\s+Price|Price)\s*:?\s*\$([0-9,]+(?:\.[0-9]{1,2})?)/i) ||
        topSlice.slice(0, 1600).match(/\$([0-9,]+(?:\.[0-9]{1,2})?)/);
      if (askMatch && askMatch[1]) {
        currentPrice = parseFloat(askMatch[1].replace(/,/g, '')) || 0;
      }
    }

    // Buyer's Premium & Soft-Close detection from visible terms
    var bpMatch =
      mainText.match(/(\d{1,2}(?:\.\d{1,2})?)\s*%\s*buyer'?s?\s*premium/i) ||
      mainText.match(/buyer'?s?\s*premium[^0-9\n]{0,30}(\d{1,2}(?:\.\d{1,2})?)\s*%/i);
    if (bpMatch && bpMatch[1]) {
      var parsedBp = parseFloat(bpMatch[1]);
      if (parsedBp >= 1 && parsedBp <= 40) {
        buyersPremiumPct = parsedBp;
        isAuction = true;
        if (domainFamily === 'generic_online') domainFamily = 'buyers_premium_auction';
        if (listingMode === 'fixed_online') listingMode = 'soft_close_auction';
      }
    }
    if (/soft[\s-]*close|staggered\s+close|auto[\s-]*extend|popcorn\s+bidding/i.test(mainText)) {
      isSoftClose = true;
      isAuction = true;
      listingMode = 'soft_close_auction';
    }
    if (/local\s+pick[\s-]*up\s+only|no\s+shipping\s+available|shipping\s*:?\s*not\s+available|in[\s-]*person\s+pick[\s-]*up\s+only/i.test(mainText)) {
      isLocalPickupOnly = true;
      shippingCost = 0;
    }

    // Location & Seller hints
    var locationText = '';
    var fbLocMatch = topSlice.match(/Listed\s+[^in\n]{0,35}\bin\s+([A-Z][A-Za-z .'-]+,\s*[A-Z]{2})\b/);
    if (fbLocMatch && fbLocMatch[1]) locationText = cleanText(fbLocMatch[1]);

    var seller = ld.seller || locationText || platformName;
    var description = ld.description || topSlice.slice(0, 1800);
    var termsMatch = mainText.match(/([^\n.]{0,80}(?:buyer'?s?\s*premium|pick[\s-]*up\s+only|soft[\s-]*close)[^\n.]{0,120})/i);
    var termsText = termsMatch ? cleanText(termsMatch[1]).slice(0, 260) : '';

    // Gallery harvesting (official JSON-LD + og:image + high-res DOM product images)
    var imgs = [];
    var seenKeys = {};
    function addCandidate(rawSrc) {
      var upg = upgradeAndKeyExternalImage(rawSrc, host);
      if (!upg || seenKeys[upg.key]) return;
      seenKeys[upg.key] = true;
      imgs.push(upg.url);
    }

    // On eBay, inspect carousel/filmstrip first for exact gallery order
    if (platformName === 'eBay') {
      Array.prototype.slice
        .call(document.querySelectorAll('.ux-image-carousel img, .ux-image-filmstrip img, [data-testid*="ux-image"] img'))
        .forEach(function (img) {
          var s = img.getAttribute('data-zoom-src') || img.getAttribute('data-src') || img.getAttribute('src') || img.src;
          addCandidate(s);
        });
    }

    (ld.images || []).forEach(addCandidate);
    var ogImgEl = document.querySelector('meta[property="og:image"]');
    if (ogImgEl) addCandidate(ogImgEl.getAttribute('content'));

    var domImgs = Array.prototype.slice.call((mainRoot || document).querySelectorAll('img'));
    domImgs.forEach(function (img) {
      if (imgs.length >= 24) return;
      if (isElementInsideRelatedSection(img)) return;
      if (platformName === 'FB Marketplace' && img.closest && img.closest('a[href*="/marketplace/profile/"], a[href*="/marketplace/item/"]')) {
        return;
      }
      var nw = Number(img.naturalWidth || 0);
      var nh = Number(img.naturalHeight || 0);
      var rw = Number(img.width || 0);
      var rh = Number(img.height || 0);
      if (img.complete && nw > 0 && nh > 0 && (nw < 130 || nh < 130)) return;
      if (rw > 0 && rh > 0 && rw < 90 && rh < 90 && nw < 200) return;

      var bestSrc =
        img.getAttribute('data-zoom-src') ||
        img.getAttribute('data-zoom-image') ||
        img.getAttribute('data-large_image') ||
        img.getAttribute('data-src') ||
        img.currentSrc ||
        img.getAttribute('src') ||
        img.src ||
        '';
      addCandidate(bestSrc);
    });

    if (!externalItemId) {
      externalItemId = normalizeUrlWatchlistKey(href);
    }
    var shortDisplayId = externalItemId.length > 22 ? platformName : externalItemId;

    return {
      itemId: externalItemId,
      externalItemId: externalItemId,
      displayBadgeId: shortDisplayId,
      sourceUrl: href,
      platformName: platformName,
      domainFamily: domainFamily,
      listingMode: listingMode,
      isAuction: isAuction,
      isSoftClose: isSoftClose,
      isLocalPickupOnly: isLocalPickupOnly,
      buyersPremiumPct: buyersPremiumPct,
      shippingCost: shippingCost,
      locationText: locationText,
      termsText: termsText,
      description: description,
      title: rawTitle || (platformName + ' Listing'),
      currentPrice: currentPrice,
      seller: seller,
      shippingWeight: 1.5,
      endingDate: '',
      images: imgs.slice(0, 24)
    };
  }

  function isGenericExternalBrowseUrl() {
    if (isShopGoodwillHost()) return false;
    var href = String(window.location.href || '');
    var host = String(window.location.hostname || '').toLowerCase();
    var path = String(window.location.pathname || '/');
    if (/(^|\.)ebay\./i.test(host)) {
      return !(/\/itm\//i.test(path) || /[?&]item=\d{9,15}/i.test(href));
    }
    if (/facebook\.com/i.test(host)) {
      return !/\/marketplace\/item\/\d+/i.test(path);
    }
    if (/hibid\.com/i.test(host)) {
      return !/\/lot\/\d+/i.test(path);
    }
    if (/ctbids\.com|liveauctioneers\.com/i.test(host)) {
      return !(/\/item\/\d+/i.test(path) || /item[_-]?id=\d+/i.test(href));
    }
    if (path === '/' || path === '') {
      var ld = extractJsonLdListingHints();
      var ogTypeEl = document.querySelector('meta[property="og:type"]');
      var ogType = ogTypeEl ? String(ogTypeEl.getAttribute('content') || '').toLowerCase() : '';
      if (!ld.title && ogType.indexOf('product') === -1) return true;
    }
    return false;
  }

  function buildItemRowFromGridCard(card) {
    var c = card || {};
    var isSgwCard = c.domainKey === 'shopgoodwill' || (isShopGoodwillHost() && /^\d{6,12}$/.test(String(c.itemId || '')));
    var apiHit = isSgwCard && state.sgwApi && c.itemId ? state.sgwApi[c.itemId] : null;
    var imgs = [];
    if (apiHit && !apiHit.failed && Array.isArray(apiHit.images) && apiHit.images.length > 0) {
      imgs = apiHit.images.slice(0, 24);
    } else if (c.thumbnailUrl) {
      imgs = [c.thumbnailUrl];
    }
    var curPrice = Number((apiHit && apiHit.currentPrice > 0 ? apiHit.currentPrice : c.currentPrice) || 0);
    var minBid = Number((apiHit && apiHit.minimumBid > 0 ? apiHit.minimumBid : c.minimumBid) || curPrice);
    if (minBid < curPrice) minBid = curPrice;
    var seller = cleanText((apiHit && apiHit.seller) || c.seller || (isSgwCard ? 'ShopGoodwill' : (c.platformName || 'Seller')));
    var weight = Number((apiHit && apiHit.shippingWeight > 0 ? apiHit.shippingWeight : c.shippingWeightLbs) || 1.5);
    return {
      lotKey: c.lotKey || c.itemId,
      itemId: c.itemId || c.externalItemId || '',
      externalItemId: c.externalItemId || c.itemId || '',
      displayBadgeId: isSgwCard ? ('#' + c.itemId) : (c.platformName || 'Lot'),
      sourceUrl: c.sourceUrl || (isSgwCard ? ('https://shopgoodwill.com/item/' + c.itemId) : window.location.href),
      domainKey: c.domainKey || (isSgwCard ? 'shopgoodwill' : resolveClientDomainKey(c)),
      platformName: c.platformName || (isSgwCard ? 'ShopGoodwill' : 'Online Listing'),
      domainFamily: isSgwCard ? 'shopgoodwill' : (c.domainFamily || ''),
      listingMode: c.isAuction === false ? 'fixed_online' : (c.isSoftClose ? 'soft_close_auction' : 'auction'),
      isAuction: c.isAuction !== false,
      isSoftClose: Boolean(c.isSoftClose),
      isLocalPickupOnly: Boolean(c.isLocalPickupOnly),
      buyersPremiumPct: Number(c.buyersPremiumPct || 0),
      shippingCost: c.shippingCost !== undefined ? c.shippingCost : null,
      title: (apiHit && apiHit.title) || c.title || ('Listing #' + (c.itemId || '')),
      currentPrice: curPrice,
      minimumBid: minBid,
      seller: seller,
      sellerId: (apiHit && apiHit.sellerId) || c.sellerId || null,
      canCombineShipping: apiHit && apiHit.canCombineShipping !== undefined ? Boolean(apiHit.canCombineShipping) : isSgwCard,
      shippingWeight: weight,
      endingDate: (apiHit && apiHit.endingDate) || c.timeLeft || '',
      description: (apiHit && apiHit.description) || '',
      images: imgs
    };
  }

  function getActiveItemRow() {
    if (state.inspectingGridItem) {
      return buildItemRowFromGridCard(state.inspectingGridItem);
    }
    if (state.rows && state.rows[0]) {
      if (isShopGoodwillHost()) {
        var curId = (String(window.location.pathname || '').match(/\/item\/(\d+)/i) || [])[1] || '';
        if (!curId || String(state.rows[0].itemId || '') === curId) {
          return state.rows[0];
        }
      } else if (String(state.rows[0].sourceUrl || '') === String(window.location.href || '')) {
        return state.rows[0];
      }
    }
    var fresh = isShopGoodwillHost() ? scrapeSingleItemDom() : scrapeExternalListingDom();
    if (isItemScoutMode() && !state.inspectingGridItem) state.rows = [fresh];
    return fresh;
  }

  function scrapeSingleItemDom() {
    var path = window.location.pathname || '';
    var idMatch = path.match(/\/item\/(\d+)/i);
    var itemId = idMatch ? idMatch[1] : '';
    var h1 = cleanText((document.querySelector('h1') || {}).textContent || '');
    var bodyText = cleanText((document.body || {}).innerText || '');

    var curPriceMatch = bodyText.match(/(?:Current\s+Price|Buy\s+Now\s+Price)\s*:?\s*\$([0-9,.]+)/i);
    var minBidMatch = bodyText.match(/Minimum\s+Bid\s*:?\s*\$([0-9,.]+)/i);
    var currentPrice = curPriceMatch ? parseFloat(curPriceMatch[1].replace(/,/g, '')) || 0 : 0;
    var minimumBid = minBidMatch ? parseFloat(minBidMatch[1].replace(/,/g, '')) || 0 : 0;
    if (!currentPrice && minimumBid > 0) currentPrice = minimumBid;

    var seller = '';
    var sellerMatch = bodyText.match(/Seller\s*:?\s*(Goodwill[^\n\r|]{3,65}|[^\n\r|]{3,50}?Goodwill[^\n\r|]{0,30})/i);
    if (sellerMatch) {
      seller = cleanText(sellerMatch[1])
        .replace(/\s+(?:Report\s+Ad|Item\s+Description|Item\s+Info|Shipping|Seller\s+Info|Bid\s+History|Print\s+Page|Share|Location|Seller).*$/i, '')
        .trim();
    }

    var weightMatch = bodyText.match(/(?:Shipping Weight|Weight)\s*:?\s*([0-9.]+)\s*(?:lbs?|pounds?)/i);
    var shippingWeight = weightMatch ? parseFloat(weightMatch[1]) || 1.5 : 1.5;

    var endMatch = bodyText.match(/(?:Ends On|Ending Date)\s*:?\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4}\s+[0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?\s*(?:AM|PM)?)/i);
    var endingDate = endMatch ? cleanText(endMatch[1]) : '';

    var imgs = [];
    var seen = {};
    var primaryFolderPrefix = null;
    var SGW_CDN_RE = /shopgoodwillimages|azureedge|azurefd|blob\.core\.windows\.net|shopgoodwill\.com/i;
    var BAD_IMG_RE = /logo|icon|avatar|banner|badge|pixel|analytics|rokt|doubleclick|sprite|placeholder|paypal|tiktok/i;

    function pickImgSrc(img) {
      var cand = [
        img.getAttribute('data-src'),
        img.getAttribute('data-lazy-src'),
        img.getAttribute('data-original'),
        img.getAttribute('src'),
        img.currentSrc,
        img.src
      ];
      var ss = img.getAttribute('srcset') || img.getAttribute('data-srcset');
      if (ss) {
        var parts = ss.split(',');
        var last = parts[parts.length - 1] || '';
        cand.unshift(cleanText(last).split(' ')[0]);
      }
      for (var i = 0; i < cand.length; i++) {
        var s = String(cand[i] || '').trim();
        if (s && /^https?:\/\//i.test(s) && s.indexOf('data:') !== 0) return s;
      }
      return '';
    }

    function hiResSgwUrl(src) {
      // Strip thumbnail suffixes (-thumb / -small / -t1 / _t2 / -tn) and legacy /t1. folders
      return src
        .replace(/[-_](?:thumb|small|t1|t2|tn)(?=\.(?:jpe?g|png|webp|gif)(?:\?|$))/i, '')
        .replace(/\/t1\.(?=[^/]+$)/i, '/');
    }

    function pushImg(src) {
      var hiRes = hiResSgwUrl(src);
      if (!seen[hiRes]) {
        seen[hiRes] = true;
        imgs.push(hiRes);
      }
    }

    // Pass 1 — strict: images under the item's own Azure folder prefix (blocks "YOU MAY ALSO LIKE" & "Report Ad" bleed)
    Array.prototype.slice.call(document.querySelectorAll('img')).forEach(function (img) {
      if (isElementInsideRelatedSection(img)) return;
      var src = pickImgSrc(img);
      if (!src || BAD_IMG_RE.test(src) || !SGW_CDN_RE.test(src)) return;

      var folderMatch = src.match(/(\/Items\/\d{1,2}-\d{1,2}-\d{4}\/[^/]+\/)/i);
      if (folderMatch && folderMatch[1]) {
        if (!primaryFolderPrefix) {
          primaryFolderPrefix = folderMatch[1].toLowerCase();
        } else if (folderMatch[1].toLowerCase() !== primaryFolderPrefix) {
          return;
        }
      } else if (primaryFolderPrefix) {
        return;
      }
      pushImg(src);
    });

    // Pass 2 — scoped SGW CDN gallery fallback (still requires SGW_CDN_RE so "Report Ad" third-party ad strips are NEVER scraped)
    if (imgs.length === 0) {
      var galleryImgs = document.querySelectorAll(
        'app-item-detail img, [class*="item-image" i] img, [class*="product-image" i] img, [class*="gallery" i] img, [id*="gallery" i] img'
      );
      Array.prototype.slice.call(galleryImgs).forEach(function (img) {
        if (isElementInsideRelatedSection(img)) return;
        var src = pickImgSrc(img);
        if (!src || BAD_IMG_RE.test(src) || !SGW_CDN_RE.test(src)) return;
        pushImg(src);
      });
    }

    // Browser-direct Buyer API (hydrateShopGoodwillItemApi) is authoritative over stale mid-transition Angular DOM!
    var apiHit = state.sgwApi && itemId ? state.sgwApi[itemId] : null;
    if (apiHit && !apiHit.failed) {
      if (apiHit.images && apiHit.images.length) imgs = apiHit.images.slice(0, 24);
      if (apiHit.title) h1 = apiHit.title;
      if (apiHit.currentPrice > 0) currentPrice = apiHit.currentPrice;
      if (apiHit.minimumBid > 0) minimumBid = apiHit.minimumBid;
      if (apiHit.shippingWeight > 0) shippingWeight = apiHit.shippingWeight;
      if (apiHit.seller) seller = apiHit.seller;
      if (apiHit.endingDate && !endingDate) endingDate = apiHit.endingDate;
    }
    if (minimumBid < currentPrice) minimumBid = currentPrice;

    return {
      itemId: itemId,
      title: h1 || ('ShopGoodwill #' + itemId),
      currentPrice: currentPrice,
      minimumBid: minimumBid,
      seller: seller || 'ShopGoodwill',
      sellerId: apiHit && apiHit.sellerId ? apiHit.sellerId : null,
      canCombineShipping: apiHit && apiHit.canCombineShipping !== undefined ? Boolean(apiHit.canCombineShipping) : true,
      shippingWeight: shippingWeight,
      endingDate: endingDate,
      description: apiHit && apiHit.description ? apiHit.description : '',
      images: imgs.slice(0, 24)
    };
  }

  // Browser-direct ShopGoodwill Buyer API pre-fetch: authoritative for SPA transitions, grid seller combine checks & in-drawer Full Scout.
  function hydrateShopGoodwillItemApi(forceRefresh, explicitItemIdOpt, silentGridOnly) {
    if (!isShopGoodwillHost() && !explicitItemIdOpt) return Promise.resolve(null);
    var m = String(window.location.pathname || '').match(/\/item\/(\d+)/i);
    var inspectedSgwId = (state.inspectingGridItem && state.inspectingGridItem.domainKey === 'shopgoodwill')
      ? String(state.inspectingGridItem.itemId || '')
      : '';
    var itemId = String(explicitItemIdOpt || (m && m[1]) || inspectedSgwId || '').trim();
    if (!itemId || !/^\d{6,12}$/.test(itemId)) return Promise.resolve(null);
    state.sgwApi = state.sgwApi || {};
    var existingHit = state.sgwApi[itemId];
    if (existingHit && !forceRefresh && (Date.now() - Number(existingHit.fetchedAt || 0) < 120000)) {
      return Promise.resolve(existingHit);
    }
    if (!silentGridOnly && state.sgwApiLoading === itemId && state.sgwApiPromise && !forceRefresh) return state.sgwApiPromise;
    if (!silentGridOnly) state.sgwApiLoading = itemId;
    try {
      var reqPromise = fetch('https://buyerapi.shopgoodwill.com/api/ItemDetail/GetItemDetailModelByItemId/' + itemId, {
        method: 'GET',
        headers: { Accept: 'application/json, text/plain, */*' }
      })
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (json) {
          if (!silentGridOnly && state.sgwApiLoading === itemId) state.sgwApiLoading = '';
          if (!json || !(json.title || json.itemName)) {
            state.sgwApi[itemId] = { images: [], failed: true, fetchedAt: Date.now() };
            return state.sgwApi[itemId];
          }
          var server = String(json.imageServer || 'https://shopgoodwillimages.azureedge.net/production/');
          if (!/^https?:\/\//i.test(server)) server = 'https://' + server.replace(/^\/+/, '');
          server = server.replace(/\/+$/, '') + '/';
          var urls = [];
          String(json.imageUrlString || '')
            .split(';')
            .forEach(function (p) {
              var clean = String(p || '').trim().replace(/\\/g, '/');
              if (!clean) return;
              var full = /^https?:\/\//i.test(clean)
                ? clean
                : clean.indexOf('//') === 0
                ? 'https:' + clean
                : server + clean.replace(/^\/+/, '');
              if (urls.indexOf(full) === -1) urls.push(full);
            });
          var cleanUrls = urls.slice(0, 24);
          var rawCur = parseFloat(json.currentPrice) || 0;
          var rawMin = parseFloat(json.minimumBid) || 0;
          var curPrice = rawCur > 0 ? rawCur : rawMin;
          var minBid = Math.max(curPrice, rawMin);
          state.sgwApi[itemId] = {
            fetchedAt: Date.now(),
            images: cleanUrls,
            currentPrice: curPrice,
            minimumBid: minBid,
            shippingWeight: parseFloat(json.shippingWeight || json.weight || 0) || 0,
            seller: cleanText(String(json.sellerCompanyName || json.sellerName || '')),
            sellerId: json.sellerId || null,
            canCombineShipping: json.canCombineShipping !== undefined ? Boolean(json.canCombineShipping) : true,
            endingDate: cleanText(String(json.endTime || json.endingDate || '')),
            title: cleanText(String(json.title || json.itemName || '')),
            description: cleanText(String(json.description || '').replace(/<[^>]*>/g, ' ')).slice(0, 4000)
          };
          if (silentGridOnly) {
            return state.sgwApi[itemId];
          }
          // Mutate active UI gallery if user is on this /item/:id OR inspecting this exact grid card
          var activeMatch = String(window.location.pathname || '').match(/\/item\/(\d+)/i);
          var isInspectingThis = Boolean(state.inspectingGridItem && String(state.inspectingGridItem.itemId || '') === itemId);
          if ((activeMatch && activeMatch[1] === itemId) || isInspectingThis) {
            if (cleanUrls.length > 0) {
              state.galleryUrls = cleanUrls.slice();
              var allowed = {};
              cleanUrls.forEach(function (u) { allowed[u] = true; });
              if (state.hasManualPhotoToggles) {
                var nextSel = {};
                Object.keys(state.selectedPhotoUrls || {}).forEach(function (k) {
                  if (allowed[k] && state.selectedPhotoUrls[k]) nextSel[k] = true;
                });
                state.selectedPhotoUrls = nextSel;
              } else {
                var initMap = {};
                cleanUrls.slice(0, 12).forEach(function (u) { initMap[u] = true; });
                state.selectedPhotoUrls = initMap;
              }
              if (!state.coverPhotoUrl || !allowed[state.coverPhotoUrl]) {
                state.coverPhotoUrl = cleanUrls[0] || '';
              }
            }
            if (!isInspectingThis) detectPageAndRows();
            syncGalleryStateForItem(getActiveItemRow());
            maybeRestoreSavedReport();
            renderUI();
          }
          return state.sgwApi[itemId];
        })
        .catch(function () {
          if (!silentGridOnly && state.sgwApiLoading === itemId) state.sgwApiLoading = '';
          state.sgwApi[itemId] = { images: [], failed: true, fetchedAt: Date.now() };
          return state.sgwApi[itemId];
        });
      if (!silentGridOnly) state.sgwApiPromise = reqPromise;
      return reqPromise;
    } catch (e) {
      if (!silentGridOnly) state.sgwApiLoading = '';
      return Promise.resolve(null);
    }
  }

  function syncGalleryStateForItem(itemRow, extraUrls) {
    var row = itemRow || {};
    var currentItemId = String(row.itemId || window.location.pathname || '');
    if (currentItemId && state.lastSyncedItemId && state.lastSyncedItemId !== currentItemId) {
      state.galleryUrls = [];
      state.selectedPhotoUrls = {};
      state.hasManualPhotoToggles = false;
      state.coverPhotoUrl = '';
      state.resellerNotes = '';
      state.scoutReport = null;
      state.detailsOpen = false;
    }
    if (currentItemId) state.lastSyncedItemId = currentItemId;

    var merged = [];
    var seen = {};
    function pushUrl(u) {
      var s = String(u || '').trim();
      if (!s || !/^https?:\/\//i.test(s)) return;
      if (!seen[s]) {
        seen[s] = true;
        merged.push(s);
      }
    }

    (state.galleryUrls || []).forEach(pushUrl);
    (row.images || []).forEach(pushUrl);
    if (Array.isArray(extraUrls)) extraUrls.forEach(pushUrl);
    if (state.scoutReport) {
      if (state.scoutReport.fetched_image) pushUrl(state.scoutReport.fetched_image);
      if (Array.isArray(state.scoutReport.fetched_images)) state.scoutReport.fetched_images.forEach(pushUrl);
      if (Array.isArray(state.scoutReport.image_urls)) state.scoutReport.image_urls.forEach(pushUrl);
    }

    state.galleryUrls = merged.slice(0, 24);
    if (!state.coverPhotoUrl && state.galleryUrls.length > 0) {
      state.coverPhotoUrl = state.galleryUrls[0];
    }

    var selectedCount = 0;
    Object.keys(state.selectedPhotoUrls || {}).forEach(function (k) {
      if (state.selectedPhotoUrls[k]) selectedCount++;
    });

    if (!state.hasManualPhotoToggles && selectedCount === 0 && state.galleryUrls.length > 0) {
      var initMap = {};
      state.galleryUrls.slice(0, 12).forEach(function (u) {
        initMap[u] = true;
      });
      state.selectedPhotoUrls = initMap;
    }
  }

  function getSelectedGalleryUrls() {
    var out = [];
    var cover = state.coverPhotoUrl;
    if (cover && state.selectedPhotoUrls[cover]) {
      out.push(cover);
    }
    (state.galleryUrls || []).forEach(function (u) {
      if (u === cover) return;
      if (state.selectedPhotoUrls[u] && out.length < 12) {
        out.push(u);
      }
    });
    return out;
  }

  // Universal Active Auction Grid / Table / List Harvester (ShopGoodwill, eBay, HiBid, CTBids, LiveAuctioneers, MaxSold, Proxibid)
  function scrapeActiveAuctionGridDom() {
    var host = String(window.location.hostname || '').toLowerCase();
    var isSgw = isShopGoodwillHost();
    var isEbay = /(^|\.)ebay\./i.test(host);
    var isHibid = /hibid\.com/i.test(host);
    var isCtbids = /ctbids\.com/i.test(host);
    var isLiveAuc = /liveauctioneers\.com/i.test(host);
    var isMaxSold = /maxsold\.com/i.test(host);
    var isProxibid = /proxibid\.com/i.test(host);
    var isEstateHost = isHibid || isCtbids || isLiveAuc || isMaxSold || isProxibid || /estatesales\.net/i.test(host);

    var domainKey = isSgw
      ? 'shopgoodwill'
      : isEbay
      ? 'ebay'
      : isEstateHost
      ? 'estate_bp'
      : /facebook\.com|craigslist\.org|offerup\.com/i.test(host)
      ? 'local_cash'
      : /poshmark\.com|mercari\.com|depop\.com|etsy\.com|whatnot\.com/i.test(host)
      ? 'fixed_marketplace'
      : 'generic_url';

    var platformName = isSgw
      ? 'ShopGoodwill'
      : isEbay
      ? 'eBay'
      : isHibid
      ? 'HiBid'
      : isCtbids
      ? 'CTBids'
      : isLiveAuc
      ? 'LiveAuctioneers'
      : isMaxSold
      ? 'MaxSold'
      : isProxibid
      ? 'Proxibid'
      : host.replace(/^www\./i, '');

    function extractCardIdentityFromHref(rawHref) {
      var h = String(rawHref || '').trim();
      if (!h || h.indexOf('javascript:') === 0 || h === '#') return null;
      var absUrl = '';
      try {
        absUrl = new URL(h, window.location.origin).toString();
      } catch (e) {
        absUrl = h;
      }
      if (isSgw) {
        var sgwM = absUrl.match(/\/item\/(\d{6,12})(?:[/?#]|$)/i);
        if (!sgwM) return null;
        return {
          lotKey: sgwM[1],
          itemId: sgwM[1],
          externalItemId: sgwM[1],
          sourceUrl: 'https://shopgoodwill.com/item/' + sgwM[1]
        };
      }
      if (isEbay) {
        var ebM = absUrl.match(/\/itm\/(?:[^/?#]+\/)?(\d{9,15})/i) || absUrl.match(/[?&]item=(\d{9,15})/i);
        if (!ebM || ebM[1] === '123456') return null;
        return {
          lotKey: 'ebay:' + ebM[1],
          itemId: 'ebay:' + ebM[1],
          externalItemId: 'ebay:' + ebM[1],
          sourceUrl: 'https://www.ebay.com/itm/' + ebM[1]
        };
      }
      if (isHibid) {
        var hbM = absUrl.match(/\/lot\/(\d{4,15})/i);
        if (!hbM) return null;
        return {
          lotKey: 'hibid:' + hbM[1],
          itemId: 'hibid:' + hbM[1],
          externalItemId: 'hibid:' + hbM[1],
          sourceUrl: absUrl.split('#')[0]
        };
      }
      if (isCtbids) {
        var ctM = absUrl.match(/\/item\/(\d{4,15})/i) || absUrl.match(/item[_-]?id=(\d{4,15})/i);
        if (!ctM) return null;
        return {
          lotKey: 'ctbids:' + ctM[1],
          itemId: 'ctbids:' + ctM[1],
          externalItemId: 'ctbids:' + ctM[1],
          sourceUrl: absUrl.split('#')[0]
        };
      }
      if (isLiveAuc) {
        var laM = absUrl.match(/\/item\/(\d{4,15})/i);
        if (!laM) return null;
        return {
          lotKey: 'liveauc:' + laM[1],
          itemId: 'liveauc:' + laM[1],
          externalItemId: 'liveauc:' + laM[1],
          sourceUrl: absUrl.split('#')[0]
        };
      }
      var genM = absUrl.match(/\/(?:lot|item|itm|listing|products?|marketplace\/item)\/([A-Za-z0-9_-]*\d{4,15})/i);
      if (!genM) return null;
      var genKey = platformName.toLowerCase().replace(/[^a-z0-9]+/g, '') + ':' + genM[1];
      return {
        lotKey: genKey,
        itemId: genKey,
        externalItemId: genKey,
        sourceUrl: absUrl.split('#')[0]
      };
    }

    function isInsideIgnoredChrome(el) {
      if (!el || !el.closest) return false;
      return Boolean(
        el.closest('header, footer, nav, #rc-scout-tray, #rc-scout-fab-bar, [data-rc-bml-shell]')
      );
    }

    // Climb DOM up to 8 levels to find the highest card container that ONLY links to this single lotKey
    function findSingleCardContainer(anchorEl, selfLotKey) {
      var best = anchorEl;
      var cur = anchorEl.parentElement;
      var depth = 0;
      while (cur && cur !== document.body && cur.tagName !== 'MAIN' && cur.tagName !== 'TBODY' && depth < 8) {
        var links = cur.querySelectorAll('a[href]');
        var hasForeignLot = false;
        for (var i = 0; i < links.length; i++) {
          var ident = extractCardIdentityFromHref(links[i].getAttribute('href') || links[i].href || '');
          if (ident && ident.lotKey !== selfLotKey) {
            hasForeignLot = true;
            break;
          }
        }
        if (hasForeignLot) break;
        best = cur;
        cur = cur.parentElement;
        depth++;
      }
      return best;
    }

    // Page-level hints (Seller Storefront on ShopGoodwill; Buyer's Premium % on Estate catalogs)
    var pageTextTop = cleanText(((document.querySelector('main') || document.body || {}).innerText || '').slice(0, 4500));
    var pageSellerHint = '';
    if (isSgw) {
      var sgwStoreM = pageTextTop.match(/(?:Seller|Location|Store)\s*:\s*(Goodwill[^\n\r|×✕]{4,68})/i);
      if (sgwStoreM && sgwStoreM[1]) {
        pageSellerHint = cleanText(sgwStoreM[1]).replace(/\s*(?:Clear\s+All|Filter|Sort\s+By).*$/i, '').trim();
      }
    }
    var pageBpPct = isLiveAuc ? 20 : isEstateHost ? 15 : 0;
    var bpM =
      pageTextTop.match(/(\d{1,2}(?:\.\d{1,2})?)\s*%\s*buyer'?s?\s*premium/i) ||
      pageTextTop.match(/buyer'?s?\s*premium[^0-9\n]{0,25}(\d{1,2}(?:\.\d{1,2})?)\s*%/i);
    if (bpM && bpM[1]) {
      var parsedBp = parseFloat(bpM[1]);
      if (parsedBp >= 1 && parsedBp <= 40) pageBpPct = parsedBp;
    }
    var pageLocalPickupHint = /\blocal\s+pick[\s-]*up\s+only\b|\bno\s+shipping\s+available\b/i.test(pageTextTop);

    var anchors = Array.prototype.slice.call(document.querySelectorAll('a[href]'));
    var byKey = {};
    var orderKeys = [];

    anchors.forEach(function (a) {
      if (isInsideIgnoredChrome(a)) return;
      var ident = extractCardIdentityFromHref(a.getAttribute('href') || a.href || '');
      if (!ident) return;
      if (!byKey[ident.lotKey]) {
        byKey[ident.lotKey] = { ident: ident, anchors: [] };
        orderKeys.push(ident.lotKey);
      }
      byKey[ident.lotKey].anchors.push(a);
    });

    var cards = [];
    orderKeys.forEach(function (key) {
      if (cards.length >= 48) return;
      var group = byKey[key];
      var primaryAnchor = group.anchors[0];
      var cardEl = findSingleCardContainer(primaryAnchor, key);
      if (!cardEl) return;

      // Clone text without our own injected sweep badge so re-scrapes stay clean
      var cloneEl = cardEl.cloneNode(true);
      var oldInjected = cloneEl.querySelectorAll('.rc-sweep-card-bar, .rc-sgw-inline-badge');
      for (var rIdx = 0; rIdx < oldInjected.length; rIdx++) {
        oldInjected[rIdx].remove();
      }
      var cardText = cleanText(cloneEl.textContent || '');
      if (!cardText || cardText.length < 6) return;

      // Skip ended/closed lots so we only triage active opportunities
      if (/\b(?:auction\s+ended|bidding\s+closed|lot\s+closed|sold\s+for)\b/i.test(cardText)) return;

      // Title extraction
      var title = '';
      if (isEbay) {
        var ebTitleNode = cloneEl.querySelector('.s-item__title, [class*="s-item__title"], h3');
        if (ebTitleNode) title = cleanText(ebTitleNode.textContent || '');
        title = title
          .replace(/^New\s+Listing\s*/i, '')
          .replace(/^Sponsored\s*/i, '')
          .replace(/\s*Opens in a new window or tab.*$/i, '')
          .trim();
        if (/^shop\s+on\s+ebay$/i.test(title)) return;
      }
      if (!title) {
        var titleNodes = cloneEl.querySelectorAll('h2, h3, h4, h5, [class*="title" i], [class*="item-name" i], [class*="product-name" i], [class*="lot-name" i]');
        for (var tIdx = 0; tIdx < titleNodes.length; tIdx++) {
          var candT = cleanText(titleNodes[tIdx].textContent || '');
          if (candT.length >= 6 && !/^\$[0-9,.]+$/.test(candT) && !/^(?:quick\s*view|place\s*bid|buy\s*now|watch)$/i.test(candT)) {
            if (candT.length > title.length) title = candT;
          }
        }
      }
      if (!title) {
        group.anchors.forEach(function (anc) {
          var at = cleanText(anc.getAttribute('title') || anc.textContent || '');
          if (at.length > title.length && !/^\$[0-9,.]+$/.test(at) && !/^(?:view|quick\s*view|bid|place\s*bid|buy\s*now|details)$/i.test(at)) {
            title = at;
          }
        });
      }
      var imgEl = cardEl.querySelector('img');
      if (!title && imgEl) {
        var altT = cleanText(imgEl.getAttribute('alt') || '');
        if (altT.length >= 6) title = altT;
      }
      title = title.replace(/^(?:Item\s*#?\s*\d+\s*[-:|]\s*)/i, '').trim();
      if (!title || title.length < 3) return;

      // Thumbnail extraction
      var thumbUrl = '';
      var cardImgs = cardEl.querySelectorAll('img');
      for (var mIdx = 0; mIdx < cardImgs.length; mIdx++) {
        var im = cardImgs[mIdx];
        var rawSrc =
          im.getAttribute('data-zoom-src') ||
          im.getAttribute('data-src') ||
          im.getAttribute('data-lazy-src') ||
          im.getAttribute('data-original') ||
          im.currentSrc ||
          im.getAttribute('src') ||
          im.src ||
          '';
        rawSrc = String(rawSrc || '').trim();
        if (!rawSrc || rawSrc.indexOf('data:') === 0) continue;
        if (/logo|icon|avatar|badge|sprite|spinner|placeholder|blank\.gif|\.svg(?:\?|$)/i.test(rawSrc)) continue;
        if (rawSrc.indexOf('//') === 0) rawSrc = window.location.protocol + rawSrc;
        if (!/^https?:\/\//i.test(rawSrc)) continue;
        if (isSgw) {
          thumbUrl = rawSrc
            .replace(/[-_](?:thumb|small|t1|t2|tn)(?=\.(?:jpe?g|png|webp|gif)(?:\?|$))/i, '')
            .replace(/\/t1\.(?=[^/]+$)/i, '/');
        } else {
          var upg = upgradeAndKeyExternalImage(rawSrc, host);
          thumbUrl = upg ? upg.url : rawSrc;
        }
        if (thumbUrl) break;
      }

      // Price, Shipping, Bid Count & Format extraction
      var currentPrice = 0;
      var minimumBid = 0;
      var shippingCost = null;
      var isLocalPickupOnly = Boolean(pageLocalPickupHint);
      var isBuyItNow = false;
      var isAuction = domainKey === 'shopgoodwill' || domainKey === 'estate_bp';

      if (isEbay) {
        var ebPriceNode = cloneEl.querySelector('.s-item__price, [class*="s-item__price"]');
        if (ebPriceNode) currentPrice = parseDollar(ebPriceNode.textContent || '');
        var ebShipNode = cloneEl.querySelector('.s-item__shipping, .s-item__logisticsCost, [class*="shipping" i]');
        var ebShipTxt = cleanText((ebShipNode && ebShipNode.textContent) || '');
        if (/free\s+(?:shipping|delivery)/i.test(ebShipTxt)) {
          shippingCost = 0;
        } else if (/local\s+pickup/i.test(ebShipTxt) && !/\$\d/.test(ebShipTxt)) {
          isLocalPickupOnly = true;
          shippingCost = 0;
        } else if (ebShipTxt) {
          var ebShipM = ebShipTxt.match(/\$([0-9,]+(?:\.[0-9]{1,2})?)/);
          if (ebShipM) shippingCost = parseFloat(ebShipM[1].replace(/,/g, '')) || 0;
        }
        if (/\b\d+\s*bids?\b/i.test(cardText)) {
          isAuction = true;
        } else {
          isAuction = false;
          isBuyItNow = true;
        }
      } else {
        var namedPriceM = cardText.match(/(?:Current\s+(?:Price|Bid)|High\s+Bid|Starting\s+Bid|Winning\s+Bid|Price|Buy\s+Now)\s*:?\s*\$([0-9,]+(?:\.[0-9]{1,2})?)/i);
        if (namedPriceM && namedPriceM[1]) {
          currentPrice = parseFloat(namedPriceM[1].replace(/,/g, '')) || 0;
        } else {
          currentPrice = parseDollar(cardText);
        }
        var minM = cardText.match(/Min(?:imum)?\s+Bid\s*:?\s*\$([0-9,]+(?:\.[0-9]{1,2})?)/i);
        if (minM && minM[1]) {
          minimumBid = parseFloat(minM[1].replace(/,/g, '')) || 0;
        }
        if (/\bbuy\s+it\s+now\b|\bbuy\s+now\s+only\b/i.test(cardText) && !/\bbids?\b/i.test(cardText)) {
          isBuyItNow = true;
          isAuction = false;
        }
        if (/\blocal\s+pick[\s-]*up\s+only\b|\bno\s+shipping\b/i.test(cardText)) {
          isLocalPickupOnly = true;
          shippingCost = 0;
        } else if (/\bfree\s+shipping\b/i.test(cardText)) {
          shippingCost = 0;
        } else {
          var shipCardM = cardText.match(/(?:\+|Shipping\s*:?\s*)\s*\$([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:shipping|s&h|ship)/i);
          if (shipCardM && shipCardM[1]) {
            shippingCost = parseFloat(shipCardM[1].replace(/,/g, '')) || 0;
          }
        }
      }

      var bidCount = null;
      var bidM = cardText.match(/\b(\d{1,3})\s*bids?\b/i);
      if (bidM && bidM[1] !== undefined) {
        bidCount = parseInt(bidM[1], 10);
      }

      var timeLeft = '';
      var timeM =
        cardText.match(/(?:Time\s+Left|Remaining|Ends\s+in)\s*:?\s*([0-9dhms\s:]{2,22})/i) ||
        cardText.match(/\b(\d{1,2}d\s*\d{1,2}h|\d{1,2}h\s*\d{1,2}m|\d{1,2}m\s*\d{1,2}s|\d{1,2}h\s+left|\d{1,2}d\s+left)\b/i);
      if (timeM && timeM[1]) {
        timeLeft = cleanText(timeM[1]).slice(0, 28);
      }

      var seller = pageSellerHint || '';
      var shippingWeightLbs = null;
      var sellerId = null;

      // Merge cached ShopGoodwill Buyer API metadata whenever already hydrated
      if (isSgw && state.sgwApi && state.sgwApi[group.ident.itemId] && !state.sgwApi[group.ident.itemId].failed) {
        var hit = state.sgwApi[group.ident.itemId];
        if (hit.seller) seller = hit.seller;
        if (hit.sellerId) sellerId = hit.sellerId;
        if (hit.shippingWeight > 0) shippingWeightLbs = hit.shippingWeight;
        if (hit.currentPrice > 0) currentPrice = hit.currentPrice;
        if (hit.minimumBid > 0) minimumBid = hit.minimumBid;
        if (!thumbUrl && hit.images && hit.images[0]) thumbUrl = hit.images[0];
      }

      if (minimumBid < currentPrice) minimumBid = currentPrice;
      if (currentPrice <= 0 && minimumBid <= 0) return;

      cards.push({
        lotKey: group.ident.lotKey,
        itemId: group.ident.itemId,
        externalItemId: group.ident.externalItemId,
        sourceUrl: group.ident.sourceUrl,
        domainKey: domainKey,
        platformName: platformName,
        title: title,
        currentPrice: currentPrice,
        minimumBid: minimumBid,
        shippingCost: shippingCost,
        shippingWeightLbs: shippingWeightLbs,
        buyersPremiumPct: pageBpPct,
        isAuction: isAuction,
        isSoftClose: isEstateHost,
        isBuyItNow: isBuyItNow,
        isLocalPickupOnly: isLocalPickupOnly,
        bidCount: bidCount,
        timeLeft: timeLeft,
        seller: seller,
        sellerId: sellerId,
        thumbnailUrl: thumbUrl,
        cardEl: cardEl
      });
    });

    return cards;
  }

  function detectPageAndRows() {
    var path = (window.location.pathname || '').toLowerCase();
    var domRows = [];
    var domByItemId = {};

    if (!isShopGoodwillHost()) {
      if (isGenericExternalBrowseUrl()) {
        var extGridCards = scrapeActiveAuctionGridDom();
        state.gridCards = extGridCards;
        state.pageType = extGridCards.length >= 2 ? 'auction-grid' : 'other';
        state.rows = [];
        return;
      }
      state.gridCards = [];
      state.pageType = 'external-item';
      var extRow = scrapeExternalListingDom();
      if (extRow.isSoftClose || !extRow.isAuction || Number(extRow.buyersPremiumPct || 0) > 0) {
        state.useProxyCents = false;
      }
      domRows.push(extRow);
      state.rows = domRows;
      return;
    }

    if (path.indexOf('/item/') !== -1) {
      state.gridCards = [];
      state.pageType = 'item';
      domRows.push(scrapeSingleItemDom());
      state.rows = domRows;
      return;
    }

    if (path.indexOf('inprogress-auctions') !== -1 || path.indexOf('in-progress') !== -1) {
      state.gridCards = [];
      state.pageType = 'inprogress-auctions';
    } else if (path.indexOf('closed-auctions') !== -1 || path.indexOf('won-auctions') !== -1) {
      state.gridCards = [];
      state.pageType = 'closed-auctions';
    } else if (path.indexOf('shipped-orders') !== -1 || path.indexOf('open-orders') !== -1) {
      state.gridCards = [];
      state.pageType = 'shipped-orders';
    } else {
      var sgwGridCards = scrapeActiveAuctionGridDom();
      state.gridCards = sgwGridCards;
      state.pageType = sgwGridCards.length >= 2 ? 'auction-grid' : 'other';
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
          titleTd: tds[1] || null,
          orderTd: tds[2] || null,
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
    if (!isShopGoodwillHost()) return;
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
        if (wl) {
          var trackedPill = document.createElement('span');
          var overCeiling = wl.maxBid > 0 && r.currentPrice > wl.maxBid;
          trackedPill.style.cssText = overCeiling
            ? 'background:#7c2d12;color:#ffedd5;padding:2px 6px;border-radius:6px;font-size:10px;font-weight:800;'
            : 'background:#1e3a8a;color:#dbeafe;padding:2px 6px;border-radius:6px;font-size:10px;font-weight:800;';
          trackedPill.textContent = wl.maxBid > 0
            ? '📌 Tracked (Max $' + Number(wl.maxBid).toFixed(2) + ')'
            : '📌 In Tracker';
          badgeWrap.appendChild(trackedPill);
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
        badgeWrap.style.cssText = 'margin-top:4px;display:flex;flex-wrap:wrap;gap:4px;font-family:system-ui,-apple-system,sans-serif;';

        var wl = state.watchlist[r.itemId];
        if (wl) {
          var trk = document.createElement('span');
          trk.style.cssText = 'background:#312e81;color:#e0e7ff;padding:2px 6px;border-radius:6px;font-size:10px;font-weight:800;';
          trk.textContent = '📌 Was Tracked';
          badgeWrap.appendChild(trk);
        }

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
    } else if (state.pageType === 'shipped-orders') {
      state.rows.forEach(function (r) {
        var targetTd = r.orderTd || r.titleTd;
        if (!targetTd) return;
        var oldBadge = targetTd.querySelector('.rc-sgw-inline-badge');
        if (oldBadge) oldBadge.remove();

        var wl = state.watchlist[r.itemId];
        var existingOrder = state.existingOrders[r.orderId];
        var badgeWrap = document.createElement('div');
        badgeWrap.className = 'rc-sgw-inline-badge';
        badgeWrap.style.cssText = 'margin-top:4px;display:flex;flex-wrap:wrap;gap:4px;align-items:center;font-family:system-ui,-apple-system,sans-serif;';

        if (wl && (wl.status === 'tracked' || !wl.orderId)) {
          var trkPill = document.createElement('span');
          trkPill.style.cssText = 'background:#4f46e5;color:#e0e7ff;padding:2px 6px;border-radius:6px;font-size:10px;font-weight:800;';
          trkPill.textContent = '📌 FROM TRACKER' + (wl.trackerLabel ? ' (' + wl.trackerLabel.split(' ')[0] + ')' : '');
          badgeWrap.appendChild(trkPill);
        }

        if (existingOrder) {
          var poPill = document.createElement('a');
          poPill.href = state.activeOrigin + '/purchases/' + existingOrder.poId;
          poPill.target = '_blank';
          poPill.style.cssText = 'background:#065f46;color:#d1fae5;padding:2px 6px;border-radius:6px;font-size:10px;font-weight:800;text-decoration:none;';
          poPill.textContent = '✅ ' + (existingOrder.poNumber || 'Synced') + ' ↗';
          badgeWrap.appendChild(poPill);
        } else {
          var newPill = document.createElement('span');
          newPill.style.cssText = 'background:#78350f;color:#fef3c7;padding:2px 6px;border-radius:6px;font-size:10px;font-weight:800;';
          newPill.textContent = '🆕 Needs Order Sync';
          badgeWrap.appendChild(newPill);
        }

        targetTd.appendChild(badgeWrap);
      });
    }
    decorateAuctionGridCards();
  }

  function clearAuctionGridDecorations() {
    var oldBars = document.querySelectorAll('.rc-sweep-card-bar');
    for (var i = 0; i < oldBars.length; i++) {
      oldBars[i].remove();
    }
    var decorated = document.querySelectorAll('[data-rc-sweep-card]');
    for (var j = 0; j < decorated.length; j++) {
      decorated[j].removeAttribute('data-rc-sweep-card');
      decorated[j].classList.remove('rc-sweep-dimmed');
      decorated[j].style.outline = '';
      decorated[j].style.outlineOffset = '';
      decorated[j].style.opacity = '';
    }
  }

  function decorateAuctionGridCards() {
    if (state.pageType !== 'auction-grid') {
      clearAuctionGridDecorations();
      return;
    }
    var cards = state.gridCards || [];
    cards.forEach(function (c) {
      var el = c.cardEl;
      if (!el) return;
      var prevBar = el.querySelector('.rc-sweep-card-bar');
      if (prevBar) prevBar.remove();

      el.setAttribute('data-rc-sweep-card', c.lotKey);
      el.classList.remove('rc-sweep-dimmed');
      el.style.outline = '';
      el.style.outlineOffset = '';
      el.style.opacity = '';

      var wl = lookupWatchlistForItem(c);
      var syn = c.seller ? evaluateSellerSynergy(c.seller, c.shippingWeightLbs || 1.5, c.itemId, c.domainKey) : null;
      var swept = state.sweepByKey && state.sweepByKey[c.lotKey] ? state.sweepByKey[c.lotKey] : null;

      if (!wl && !(syn && syn.isEligible) && !swept) return;

      var bar = document.createElement('div');
      bar.className = 'rc-sweep-card-bar';
      var bg = '#0f172a';
      var border = '#334155';
      if (swept) {
        if (swept.verdictBucket === 'HOT_FLIP') {
          bg = '#064e3b';
          border = '#10b981';
          el.style.outline = '2px solid #10b981';
          el.style.outlineOffset = '2px';
        } else if (swept.verdictBucket === 'COMBINE_PLAY') {
          bg = '#134e4a';
          border = '#2dd4bf';
          el.style.outline = '2px solid #14b8a6';
          el.style.outlineOffset = '2px';
        } else if (swept.verdictBucket === 'SLEEPER') {
          bg = '#1e1b4b';
          border = '#818cf8';
          el.style.outline = '2px dashed #818cf8';
          el.style.outlineOffset = '2px';
        } else {
          bg = '#1e293b';
          border = '#475569';
          if (state.dimPassedCards && !wl) {
            el.classList.add('rc-sweep-dimmed');
            el.style.opacity = '0.45';
          }
        }
      } else if (syn && syn.isEligible) {
        bg = '#064e3b';
        border = '#34d399';
      } else if (wl) {
        bg = '#1e1b4b';
        border = '#818cf8';
      }

      bar.style.cssText =
        'margin-top:6px;padding:5px 7px;border-radius:8px;background:' +
        bg +
        ';border:1px solid ' +
        border +
        ';color:#f8fafc;font-family:system-ui,-apple-system,sans-serif;font-size:10.5px;line-height:1.25;display:flex;align-items:center;justify-content:space-between;gap:5px;position:relative;z-index:5;';

      var leftBits = [];
      if (swept) {
        var netSign = swept.netProfitAtCurrentUsd >= 0
          ? '+$' + Math.round(swept.netProfitAtCurrentUsd)
          : '-$' + Math.round(Math.abs(swept.netProfitAtCurrentUsd));
        var chShort = swept.bestChannel === 'MD' ? '🔮 MD' : swept.bestChannel === 'DT' ? '🐯 DT' : swept.bestChannel === 'Poshmark' ? '👗 Posh' : '🌐 eBay';
        if (swept.verdictBucket === 'PASS') {
          leftBits.push('<span style="color:#fca5a5;font-weight:800;">' + escHtml(swept.verdictLabel) + ' (' + netSign + ')</span>');
        } else {
          leftBits.push(
            '<span style="font-weight:900;color:#ecfdf5;">' +
              escHtml(swept.verdictBucket === 'HOT_FLIP' ? '🔥' : swept.verdictBucket === 'COMBINE_PLAY' ? '📦' : '👀') +
              ' ' +
              netSign +
              ' Net • ' +
              chShort +
              (swept.balancedMaxBidUsd > 0 ? ' • Max $' + swept.balancedMaxBidUsd.toFixed(2) : '') +
            '</span>'
          );
        }
      } else {
        if (syn && syn.isEligible) {
          leftBits.push('<span style="color:#6ee7b7;font-weight:900;">📦 Combine (+' + syn.matchCount + ')</span>');
        }
        if (wl) {
          leftBits.push(
            '<span style="color:#c7d2fe;font-weight:800;">📌 Tracked' +
              (wl.maxBid > 0 ? ' ($' + Number(wl.maxBid).toFixed(2) + ')' : '') +
            '</span>'
          );
        }
      }

      bar.innerHTML =
        '<div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
          leftBits.join(' • ') +
        '</div>' +
        '<button type="button" class="rc-sweep-inline-inspect-btn" data-lotkey="' +
          escHtml(c.lotKey) +
          '" title="Open Full 12-Photo AI Speed Scout inside Drawer" style="background:#312e81;color:#e0e7ff;border:1px solid #6366f1;border-radius:5px;padding:2px 6px;font-size:10px;font-weight:900;cursor:pointer;flex-shrink:0;white-space:nowrap;">⚡ Scout</button>';

      var inspectBtn = bar.querySelector('.rc-sweep-inline-inspect-btn');
      if (inspectBtn) {
        inspectBtn.onclick = function (ev) {
          if (ev && ev.preventDefault) ev.preventDefault();
          if (ev && ev.stopPropagation) ev.stopPropagation();
          openSweepLotFullScout(c.lotKey, true);
        };
      }

      el.appendChild(bar);
    });
  }

  // Gently pre-hydrates seller/weight/minBid on mixed ShopGoodwill search grids (4 concurrent, max 24 cards, 2.2s cap)
  function hydrateSweepGridSgwCards(cards, doneCallback) {
    if (!isShopGoodwillHost() || !Array.isArray(cards) || cards.length === 0) {
      doneCallback();
      return;
    }
    var toFetch = [];
    for (var i = 0; i < cards.length && toFetch.length < 24; i++) {
      var c = cards[i];
      if (!c || !c.itemId || !/^\d{6,12}$/.test(String(c.itemId))) continue;
      if (c.seller && c.shippingWeightLbs) continue;
      var cached = state.sgwApi && state.sgwApi[c.itemId];
      if (cached && (Date.now() - Number(cached.fetchedAt || 0) < 120000)) continue;
      toFetch.push(String(c.itemId));
    }
    if (toFetch.length === 0) {
      doneCallback();
      return;
    }

    var finished = false;
    var cursor = 0;
    var activeWorkers = 0;
    var safetyTimer = setTimeout(function () {
      if (!finished) {
        finished = true;
        doneCallback();
      }
    }, 2400);

    function pump() {
      if (finished) return;
      if (cursor >= toFetch.length && activeWorkers === 0) {
        finished = true;
        clearTimeout(safetyTimer);
        doneCallback();
        return;
      }
      while (activeWorkers < 4 && cursor < toFetch.length) {
        var nextId = toFetch[cursor++];
        activeWorkers++;
        hydrateShopGoodwillItemApi(false, nextId, true)
          .then(function () {
            activeWorkers--;
            pump();
          })
          .catch(function () {
            activeWorkers--;
            pump();
          });
      }
    }
    pump();
  }

  function runAuctionSweep() {
    var auth = window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.getSession ? window.__RC_BML_AUTH__.getSession() : null;
    if (!auth) {
      if (window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.openConnectFlow) {
        window.__RC_BML_AUTH__.openConnectFlow(false);
      }
      return;
    }
    if (state.sweepingGrid) return;

    detectPageAndRows();
    if (!state.gridCards || state.gridCards.length === 0) {
      state.errorMsg = 'No active auction cards were detected on this page yet. Scroll until listings load and tap 🔄.';
      state.trayOpen = true;
      renderUI();
      return;
    }

    state.trayOpen = true;
    state.inspectingGridItem = null;
    state.sweepingGrid = true;
    state.errorMsg = null;
    state.sweepProgressMsg = isShopGoodwillHost()
      ? '🔍 Checking seller combine branches & min bids...'
      : '🕸️ Harvesting active auction grid...';
    renderUI();

    hydrateSweepGridSgwCards(state.gridCards, function () {
      detectPageAndRows();
      var candidates = (state.gridCards || []).slice(0, 40).map(function (c) {
        var syn = c.seller ? evaluateSellerSynergy(c.seller, c.shippingWeightLbs || 1.5, c.itemId, c.domainKey) : null;
        return {
          lotKey: c.lotKey,
          itemId: c.itemId,
          externalItemId: c.externalItemId,
          sourceUrl: c.sourceUrl,
          domainKey: c.domainKey,
          platformName: c.platformName,
          title: c.title,
          currentPrice: c.currentPrice,
          minimumBid: c.minimumBid,
          shippingCost: c.shippingCost,
          shippingWeightLbs: c.shippingWeightLbs,
          buyersPremiumPct: c.buyersPremiumPct,
          isAuction: c.isAuction,
          isSoftClose: c.isSoftClose,
          isBuyItNow: c.isBuyItNow,
          isLocalPickupOnly: c.isLocalPickupOnly,
          bidCount: c.bidCount,
          timeLeft: c.timeLeft,
          seller: c.seller,
          sellerId: c.sellerId,
          combineEligible: Boolean(syn && syn.isEligible),
          combineMatchCount: syn && syn.isEligible ? syn.matchCount : 0,
          thumbnailUrl: c.thumbnailUrl
        };
      });

      state.sweepProgressMsg = '🕸️ Triaging ' + candidates.length + ' lots across MD / DT / Online...';
      renderUI();

      callRcApi('POST', '/api/bml/auction-sweep', {
        pageUrl: window.location.href,
        useVisionOnSleepers: true,
        candidates: candidates
      })
        .then(function (res) {
          state.sweepingGrid = false;
          state.sweepProgressMsg = '';
          var lots = (res && Array.isArray(res.lots)) ? res.lots : [];
          var byKey = {};
          lots.forEach(function (l) {
            byKey[l.lotKey] = l;
          });
          var sum = (res && res.summary) || {
            totalEvaluated: lots.length,
            hotFlipCount: 0,
            combinePlayCount: 0,
            sleeperCount: 0,
            passCount: 0,
            visionThumbnailsUsed: 0
          };
          var hitTotal = Number(sum.hotFlipCount || 0) + Number(sum.combinePlayCount || 0) + Number(sum.sleeperCount || 0);
          state.sweepData = {
            summary: sum,
            lots: lots,
            sweptCount: candidates.length,
            sweptAt: Date.now()
          };
          state.sweepByKey = byKey;
          state.sweepFilter = hitTotal > 0 ? 'HITS' : 'ALL';
          state.justFinishedScan = true;
          decorateAuctionGridCards();
          renderUI();
        })
        .catch(function (err) {
          state.sweepingGrid = false;
          state.sweepProgressMsg = '';
          state.errorMsg = (err && err.message) || 'Auction Sweep failed.';
          renderUI();
        });
    });
  }

  function findGridCardByLotKey(lotKey) {
    var list = state.gridCards || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].lotKey === lotKey) return list[i];
    }
    return null;
  }

  function openSweepLotFullScout(lotKey, autoRunAi) {
    var gridCard = findGridCardByLotKey(lotKey);
    var sweptLot = state.sweepByKey && state.sweepByKey[lotKey] ? state.sweepByKey[lotKey] : null;
    if (!gridCard && !sweptLot) return;

    var merged = gridCard
      ? {
          lotKey: gridCard.lotKey,
          itemId: gridCard.itemId,
          externalItemId: gridCard.externalItemId,
          sourceUrl: gridCard.sourceUrl,
          domainKey: gridCard.domainKey,
          platformName: gridCard.platformName,
          title: gridCard.title,
          currentPrice: gridCard.currentPrice,
          minimumBid: gridCard.minimumBid,
          shippingCost: gridCard.shippingCost,
          shippingWeightLbs: gridCard.shippingWeightLbs || (sweptLot ? sweptLot.estWeightLbs : null),
          buyersPremiumPct: gridCard.buyersPremiumPct,
          isAuction: gridCard.isAuction,
          isSoftClose: gridCard.isSoftClose,
          isLocalPickupOnly: gridCard.isLocalPickupOnly,
          timeLeft: gridCard.timeLeft,
          seller: gridCard.seller || (sweptLot ? sweptLot.seller : ''),
          sellerId: gridCard.sellerId,
          thumbnailUrl: gridCard.thumbnailUrl
        }
      : {
          lotKey: sweptLot.lotKey,
          itemId: sweptLot.itemId,
          externalItemId: sweptLot.externalItemId,
          sourceUrl: sweptLot.sourceUrl,
          domainKey: sweptLot.domainKey,
          platformName: sweptLot.platformName,
          title: sweptLot.title,
          currentPrice: sweptLot.currentPrice,
          minimumBid: sweptLot.minimumBid,
          shippingCost: sweptLot.soloShipUsd,
          shippingWeightLbs: sweptLot.estWeightLbs,
          buyersPremiumPct: sweptLot.buyersPremiumPct,
          isAuction: sweptLot.isAuction,
          isSoftClose: sweptLot.isSoftClose,
          isLocalPickupOnly: sweptLot.isLocalPickupOnly,
          timeLeft: sweptLot.timeLeft,
          seller: sweptLot.seller,
          sellerId: null,
          thumbnailUrl: sweptLot.thumbnailUrl
        };

    // Reset per-item scout state while preserving state.sweepData & state.sweepByKey intact!
    state.inspectingGridItem = merged;
    state.trayOpen = true;
    state.scoutReport = null;
    state.isRestoredSavedReport = false;
    state.restoredDocId = '';
    state.loadingRestoredDocId = '';
    state.customMaxBid = '';
    state.trackedSavedMsg = null;
    state.lastSavedForItemId = '';
    state.errorMsg = null;
    state.galleryUrls = merged.thumbnailUrl ? [merged.thumbnailUrl] : [];
    state.selectedPhotoUrls = {};
    state.hasManualPhotoToggles = false;
    state.coverPhotoUrl = merged.thumbnailUrl || '';
    state.resellerNotes = '';
    state.detailsOpen = false;
    state.galleryExpandedPostScan = false;
    state.combineExpandedPostScan = false;
    state.lastSyncedItemId = String(merged.itemId || '');
    state.justFinishedScan = true;

    syncGalleryStateForItem(getActiveItemRow());
    renderUI();

    var existingWl = lookupWatchlistForItem(getActiveItemRow());
    if (existingWl && existingWl.hasReport && existingWl.docId) {
      if (merged.domainKey === 'shopgoodwill') {
        hydrateShopGoodwillItemApi(false, merged.itemId, false);
      }
      maybeRestoreSavedReport();
      return;
    }

    if (merged.domainKey === 'shopgoodwill') {
      hydrateShopGoodwillItemApi(false, merged.itemId, false).then(function () {
        if (autoRunAi && state.inspectingGridItem && state.inspectingGridItem.lotKey === lotKey && !state.scoutReport) {
          runInTrayAiScout();
        }
      });
    } else if (autoRunAi) {
      runInTrayAiScout();
    }
  }

  function closeSweepLotFullScout() {
    state.inspectingGridItem = null;
    state.scoutingItem = false;
    state.scoutReport = null;
    state.isRestoredSavedReport = false;
    state.restoredDocId = '';
    state.loadingRestoredDocId = '';
    state.errorMsg = null;
    state.trackedSavedMsg = null;
    decorateAuctionGridCards();
    renderUI();
  }

  function scrollToSweepGridCard(lotKey) {
    var card = findGridCardByLotKey(lotKey);
    var el = (card && card.cardEl) || document.querySelector('[data-rc-sweep-card="' + String(lotKey).replace(/"/g, '') + '"]');
    if (!el || !el.scrollIntoView) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    var prevTransition = el.style.transition || '';
    var prevBoxShadow = el.style.boxShadow || '';
    el.style.transition = 'box-shadow 0.25s ease';
    el.style.boxShadow = '0 0 0 4px #34d399, 0 0 28px rgba(16,185,129,0.65)';
    setTimeout(function () {
      el.style.boxShadow = prevBoxShadow;
      el.style.transition = prevTransition;
    }, 1800);
  }

  function quickTrackSweepLot(lotKey) {
    var auth = window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.getSession ? window.__RC_BML_AUTH__.getSession() : null;
    if (!auth) {
      if (window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.openConnectFlow) {
        window.__RC_BML_AUTH__.openConnectFlow(false);
      }
      return;
    }
    var swept = state.sweepByKey && state.sweepByKey[lotKey] ? state.sweepByKey[lotKey] : null;
    var card = findGridCardByLotKey(lotKey);
    if (!swept && !card) return;

    var maxBid = swept && swept.balancedMaxBidUsd > 0 ? swept.balancedMaxBidUsd : 0;
    if (maxBid > 0 && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        navigator.clipboard.writeText(maxBid.toFixed(2));
      } catch (e) {}
    }

    var dKey = (swept && swept.domainKey) || (card && card.domainKey) || 'generic_url';
    var isSgwLot = dKey === 'shopgoodwill';
    var itemId = (swept && swept.itemId) || (card && card.itemId) || '';
    var extId = (swept && swept.externalItemId) || (card && card.externalItemId) || itemId;
    var srcUrl = (swept && swept.sourceUrl) || (card && card.sourceUrl) || window.location.href;
    var thumb = (swept && swept.thumbnailUrl) || (card && card.thumbnailUrl) || null;
    var noteStr = swept
      ? ('[🕸️ AUCTION SWEEP] ' + swept.verdictLabel + ' • ' + swept.bestChannelLabel + ' — ' + swept.oneLineWhy)
      : '[🕸️ AUCTION SWEEP] Quick-Tracked from active grid';

    state.quickTrackingKey = lotKey;
    state.errorMsg = null;
    renderUI();

    callRcApi('POST', '/api/bml/sgw-sync', {
      pageType: isSgwLot ? 'item' : 'external-item',
      dryRun: false,
      rows: [
        {
          itemId: itemId,
          externalItemId: extId,
          sourceUrl: srcUrl,
          domainKey: dKey,
          platformName: (swept && swept.platformName) || (card && card.platformName) || '',
          listingMode: (swept && !swept.isAuction) ? 'fixed_online' : 'auction',
          buyersPremiumPct: Number((swept && swept.buyersPremiumPct) || (card && card.buyersPremiumPct) || 0),
          title: (swept && swept.title) || (card && card.title) || ('Listing #' + itemId),
          currentPrice: Number((swept && swept.currentPrice) || (card && card.currentPrice) || 0),
          minimumBid: Number((swept && swept.minimumBid) || (card && card.minimumBid) || 0),
          maxBid: maxBid,
          boutiquePrice: swept ? swept.estGrossMid : 0,
          resalePrice: swept ? swept.estGrossLow : 0,
          seller: (swept && swept.seller) || (card && card.seller) || '',
          shippingWeight: Number((swept && swept.estWeightLbs) || (card && card.shippingWeightLbs) || 1.5),
          canCombineShipping: isSgwLot,
          primaryImageUrl: thumb,
          imageUrls: thumb ? [thumb] : [],
          endingDate: (swept && swept.timeLeft) || (card && card.timeLeft) || '',
          conditionNotes: noteStr,
          aiReport: null
        }
      ]
    })
      .then(function () {
        state.quickTrackingKey = '';
        notifyRcTabs({ tool: 'auction_scout', action: 'tracked_item', itemId: itemId });
        fetchWatchlist(function () {
          decorateAuctionGridCards();
          renderUI();
        });
      })
      .catch(function (err) {
        state.quickTrackingKey = '';
        state.errorMsg = (err && err.message) || 'Failed to quick-track lot.';
        renderUI();
      });
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

  // $0 Auto-Restore of Saved AI Appraisal when revisiting an already-tracked item
  function maybeRestoreSavedReport() {
    if (!isItemScoutMode()) return;
    if (state.scoutReport || state.scoutingItem) return;
    var auth = window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.getSession ? window.__RC_BML_AUTH__.getSession() : null;
    if (!auth) return;
    var itemRow = getActiveItemRow();
    var existingWl = lookupWatchlistForItem(itemRow);
    if (!existingWl || !existingWl.hasReport || !existingWl.docId) return;
    var targetDocId = String(existingWl.docId);
    if (state.restoredDocId === targetDocId || state.loadingRestoredDocId === targetDocId) return;

    state.loadingRestoredDocId = targetDocId;
    callRcApi('GET', '/api/bml/sgw-sync?docId=' + encodeURIComponent(targetDocId) + '&report=1', null)
      .then(function (res) {
        if (state.loadingRestoredDocId === targetDocId) state.loadingRestoredDocId = '';
        if (!isItemScoutMode() || state.scoutReport || state.scoutingItem) return;
        var curRow = getActiveItemRow();
        var curWl = lookupWatchlistForItem(curRow);
        if (!curWl || String(curWl.docId) !== targetDocId) return;
        if (!res || !res.report) {
          state.restoredDocId = targetDocId;
          return;
        }
        state.restoredDocId = targetDocId;
        state.scoutReport = res.report;
        state.isRestoredSavedReport = true;
        state.justFinishedScan = true;
        syncGalleryStateForItem(curRow, res.report.fetched_images || res.report.image_urls || []);
        state.selectedTier = 'balanced';
        var wlMax = Number(curWl.maxBid || 0);
        state.customMaxBid = wlMax > 0 ? wlMax.toFixed(2) : String(computeActiveMaxBid().toFixed(2));
        renderUI();
      })
      .catch(function () {
        if (state.loadingRestoredDocId === targetDocId) state.loadingRestoredDocId = '';
      });
  }

  function fetchWatchlist(afterCallback) {
    var auth = window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.getSession ? window.__RC_BML_AUTH__.getSession() : null;
    if (!auth) {
      if (afterCallback) afterCallback();
      return;
    }
    callRcApi('GET', '/api/bml/sgw-sync?mode=watchlist&t=' + Date.now(), null)
      .then(function (data) {
        if (data) {
          if (data.watchlist) state.watchlist = data.watchlist;
          if (Array.isArray(data.combinableItems)) state.combinableItems = data.combinableItems;
          if (data.existingOrders) state.existingOrders = data.existingOrders;
          if (data.activeTracker) state.activeTracker = data.activeTracker;
          if (data.domainTrackers) state.domainTrackers = data.domainTrackers;
          if (data.domainProfiles) state.domainProfiles = data.domainProfiles;
          if (data.roiTargets) state.roiTargets = data.roiTargets;
          decoratePageRows();
          maybeRestoreSavedReport();
          renderUI();
        }
        if (afterCallback) afterCallback();
      })
      .catch(function () {
        if (afterCallback) afterCallback();
      });
  }

  // Run full AI Speed Scout inside the Slide-Over Tray on /item/:id or any external listing page
  function runInTrayAiScout() {
    var auth = window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.getSession ? window.__RC_BML_AUTH__.getSession() : null;
    if (!auth) {
      if (window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.openConnectFlow) {
        window.__RC_BML_AUTH__.openConnectFlow(false);
      }
      return;
    }

    state.scoutingItem = true;
    state.errorMsg = null;
    state.trackedSavedMsg = null;
    state.trayOpen = true;
    renderUI();

    var inspectedSgwId = (state.inspectingGridItem && state.inspectingGridItem.domainKey === 'shopgoodwill')
      ? String(state.inspectingGridItem.itemId || '')
      : '';
    var sgwIdMatch = isShopGoodwillHost() ? String(window.location.pathname || '').match(/\/item\/(\d+)/i) : null;
    var targetSgwId = inspectedSgwId || (sgwIdMatch ? sgwIdMatch[1] : '');
    var sgwWaitPromise = targetSgwId && (!state.sgwApi || !state.sgwApi[targetSgwId])
      ? Promise.race([
          Promise.resolve(hydrateShopGoodwillItemApi(false, targetSgwId, false)),
          new Promise(function (resolve) { setTimeout(resolve, 2200); })
        ])
      : Promise.resolve(null);

    sgwWaitPromise.then(function () {
      if (!state.inspectingGridItem) detectPageAndRows();
      var itemRow = getActiveItemRow();
      syncGalleryStateForItem(itemRow);
      var selectedUrls = getSelectedGalleryUrls();

      var humanNotes = state.resellerNotes && cleanText(state.resellerNotes)
        ? 'USER GROUND-TRUTH NOTES: ' + cleanText(state.resellerNotes)
        : '';

      // ALWAYS send clientDomListing + selected photo URLs (even on ShopGoodwill) so Vercel is never empty-handed
      // if Cloudflare / WAF throttles buyerapi.shopgoodwill.com for the server's datacenter IP.
      var targetSourceUrl = itemRow.sourceUrl || window.location.href;
      var isSgwItem = Boolean(
        itemRow.domainKey === 'shopgoodwill' ||
          (isShopGoodwillHost() && /^\d{6,12}$/.test(String(itemRow.itemId || '')))
      );
      var clientDomPayload = {
        sourceUrl: targetSourceUrl,
        platformName: isSgwItem ? 'ShopGoodwill' : (itemRow.platformName || ''),
        domainFamily: isSgwItem ? 'shopgoodwill' : (itemRow.domainFamily || ''),
        listingMode: isSgwItem ? 'auction' : (itemRow.listingMode || ''),
        externalItemId: itemRow.externalItemId || itemRow.itemId || '',
        title: itemRow.title || '',
        description: itemRow.description || '',
        currentPrice: Number(itemRow.currentPrice || 0),
        minimumBid: Number(itemRow.minimumBid || itemRow.currentPrice || 0) || undefined,
        buyersPremiumPct: isSgwItem ? 0 : Number(itemRow.buyersPremiumPct || 0),
        shippingCost: !isSgwItem && itemRow.shippingCost !== undefined && itemRow.shippingCost !== null ? Number(itemRow.shippingCost) : undefined,
        shippingWeight: Number(itemRow.shippingWeight || 0) || undefined,
        isLocalPickupOnly: Boolean(itemRow.isLocalPickupOnly),
        isAuction: isSgwItem ? true : Boolean(itemRow.isAuction),
        isSoftClose: isSgwItem ? false : Boolean(itemRow.isSoftClose),
        termsText: itemRow.termsText || '',
        sellerName: itemRow.seller || '',
        locationText: itemRow.locationText || '',
        endingDate: itemRow.endingDate || '',
        imageUrls: selectedUrls.length > 0 ? selectedUrls : (itemRow.images || [])
      };

      var reqBody = {
        url: targetSourceUrl,
        notes: humanNotes,
        zipCode: state.zipCode || '97206',
        selectedRemoteImageUrls: selectedUrls,
        remoteImageUrls: selectedUrls.length > 0 ? selectedUrls : (itemRow.images || []).slice(0, 12),
        clientDomListing: clientDomPayload
      };

      return callRcApi('POST', '/api/identify-item', reqBody)
        .then(function (data) {
          state.scoutingItem = false;
          var firstItem = (data && Array.isArray(data.items) && data.items[0]) ? data.items[0] : data;
          if (!firstItem) {
            throw new Error('AI Scout returned an empty report.');
          }
          state.scoutReport = firstItem;
          state.isRestoredSavedReport = false;
          state.justFinishedScan = true;
          state.lastSavedForItemId = '';
          // Auto-expand Sold Comps / OCR / Condition details when the call is a PASS or a >= $100 item
          try {
            var _verdict = firstItem.purchase_strategy && firstItem.purchase_strategy.verdict;
            var _bid = Number(firstItem.currentBid || (firstItem.auction_meta && firstItem.auction_meta.current_bid) || itemRow.currentPrice || 0);
            state.detailsOpen = _verdict === 'PASS' || _bid >= 100;
          } catch (e) {}
          syncGalleryStateForItem(itemRow, firstItem.fetched_images || firstItem.image_urls || []);
          if (firstItem.seller_info && firstItem.seller_info.seller_name && state.rows[0]) {
            state.rows[0].seller = firstItem.seller_info.seller_name;
          }
          if (firstItem.seller_info && firstItem.seller_info.shipping_weight && state.rows[0]) {
            state.rows[0].shippingWeight = Number(firstItem.seller_info.shipping_weight) || state.rows[0].shippingWeight;
          }
          if (firstItem.auction_meta && state.rows[0]) {
            if (firstItem.auction_meta.buyers_premium_pct !== undefined) {
              state.rows[0].buyersPremiumPct = Number(firstItem.auction_meta.buyers_premium_pct) || 0;
            }
            if (firstItem.auction_meta.is_soft_close !== undefined) {
              state.rows[0].isSoftClose = Boolean(firstItem.auction_meta.is_soft_close);
            }
            if (firstItem.auction_meta.listing_mode) {
              state.rows[0].listingMode = firstItem.auction_meta.listing_mode;
            }
            if (state.rows[0].isSoftClose || Number(state.rows[0].buyersPremiumPct || 0) > 0) {
              state.useProxyCents = false;
            }
          }
          state.selectedTier = 'balanced';
          state.customMaxBid = String(computeActiveMaxBid().toFixed(2));
          renderUI();
        });
    }).catch(function (err) {
      state.scoutingItem = false;
      state.errorMsg = (err && err.message) || 'AI Speed Scout failed.';
      renderUI();
    });
  }

  function getPieceQty(li) {
    if (!li || typeof li !== 'object') return 1;
    var explicit = Number(li.quantity || li.qty || 0);
    if (explicit > 1 && explicit <= 99) return Math.round(explicit);
    var txt = String((li.name || '') + ' ' + (li.title || '') + ' ' + (li.identity || '') + ' ' + (li.tag_title || ''));
    var pm = txt.match(/[\(\[]\s*(?:x\s*(\d{1,2})|(\d{1,2})\s*x|(?:lot|set|pack|bundle|qty)\s*(?:of|:)?\s*(\d{1,2}))\s*[\)\]]/i);
    if (pm) {
      var n = parseInt(pm[1] || pm[2] || pm[3] || '1', 10);
      if (n > 1 && n <= 99) return n;
    }
    var tm = txt.match(/(?:^|\s)(?:x\s*(\d{1,2})|(\d{1,2})\s*x)(?=\s*$|\s*[-–—|])/i);
    if (tm) {
      var n2 = parseInt(tm[1] || tm[2] || '1', 10);
      if (n2 > 1 && n2 <= 99) return n2;
    }
    return 1;
  }

  function getPieceBoutiqueMid(li) {
    if (!li) return 0;
    var bStr =
      (li.pricing_potential && li.pricing_potential.boutique) ||
      (li.price_breakdown && li.price_breakdown.boutique_premium) ||
      li.estimated_value ||
      '';
    return parseMidpointPrice(bStr);
  }

  function getPieceFairMid(li) {
    if (!li) return 0;
    var fStr =
      (li.pricing_potential && li.pricing_potential.fair) ||
      (li.price_breakdown && li.price_breakdown.fair) ||
      li.estimated_value ||
      '';
    return parseMidpointPrice(fStr);
  }

  function computeScoutFinancials() {
    var itemRow = getActiveItemRow() || {};
    var rep = state.scoutReport;
    if (!rep) return null;

    var isSgw = isShopGoodwillHost();
    var auctionMeta = rep.auction_meta || {};
    var purchaseStrat = rep.purchase_strategy || {};
    var shipInfo = rep.shipping_info || {};

    var listingMode =
      auctionMeta.listing_mode ||
      purchaseStrat.listing_mode ||
      itemRow.listingMode ||
      (isSgw ? 'auction' : 'auction');
    var buyersPremiumPct = Number(
      auctionMeta.buyers_premium_pct !== undefined
        ? auctionMeta.buyers_premium_pct
        : purchaseStrat.buyers_premium_pct !== undefined
        ? purchaseStrat.buyers_premium_pct
        : itemRow.buyersPremiumPct || 0
    ) || 0;
    var isSoftClose = Boolean(
      auctionMeta.is_soft_close ||
        itemRow.isSoftClose ||
        listingMode === 'soft_close_auction'
    );
    var isAuction =
      isSgw ||
      listingMode === 'auction' ||
      listingMode === 'soft_close_auction' ||
      Boolean(itemRow.isAuction);
    var isLocalPickupOnly = Boolean(
      shipInfo.isLocalPickupOnly ||
        auctionMeta.is_local_pickup_only ||
        itemRow.isLocalPickupOnly ||
        listingMode === 'local_cash'
    );

    var currentBid = Number(
      itemRow.currentPrice ||
        rep.currentBid ||
        auctionMeta.current_bid ||
        parseDollar(purchaseStrat.current_asking_price) ||
        0
    );
    var rawMinimumBid = Number(
      itemRow.minimumBid ||
        auctionMeta.minimum_bid ||
        0
    );
    var minimumBid = rawMinimumBid > currentBid ? rawMinimumBid : currentBid;
    var floorBid = isAuction ? Math.max(currentBid, minimumBid) : currentBid;

    var rawShipFallback = isLocalPickupOnly ? 0 : (isSgw ? 10.5 : Number(itemRow.shippingCost || 0));
    var shipTotal = isLocalPickupOnly
      ? 0
      : Number(
          shipInfo.total !== undefined && shipInfo.total !== null
            ? shipInfo.total
            : auctionMeta.estimated_shipping !== undefined && auctionMeta.estimated_shipping !== null
            ? auctionMeta.estimated_shipping
            : rawShipFallback
        );
    var shipBase = isLocalPickupOnly ? 0 : Number(shipInfo.shipping !== undefined ? shipInfo.shipping : (isSgw ? Math.max(0, shipTotal - 3) : shipTotal));
    var shipHandling = isLocalPickupOnly ? 0 : Number(shipInfo.handling !== undefined ? shipInfo.handling : Math.max(0, shipTotal - shipBase));
    var weight = Number((rep.seller_info && rep.seller_info.shipping_weight) || itemRow.shippingWeight || 1.5);
    var sellerName = cleanText((rep.seller_info && rep.seller_info.seller_name) || itemRow.seller || itemRow.platformName || (isSgw ? 'ShopGoodwill' : 'Seller'));
    var sellerId = (rep.seller_info && rep.seller_info.seller_id) || itemRow.sellerId || null;
    var domainKey = resolveClientDomainKey(itemRow);
    var domainProfile = getActiveDomainProfile(domainKey);
    var sellerAllowsCombine = rep.seller_info && rep.seller_info.can_combine_shipping !== undefined
      ? Boolean(rep.seller_info.can_combine_shipping)
      : (itemRow.canCombineShipping !== undefined ? Boolean(itemRow.canCombineShipping) : true);
    var canCombine = Boolean(domainProfile.allowsCombinedShipping && sellerAllowsCombine);

    var boutiqueStr = (rep.pricing_potential && rep.pricing_potential.boutique) || (rep.price_breakdown && rep.price_breakdown.boutique_premium) || '$24 - $38';
    var fairStr = (rep.pricing_potential && rep.pricing_potential.fair) || (rep.price_breakdown && rep.price_breakdown.fair) || '$16 - $26';

    var boutiqueMid = parseMidpointPrice(boutiqueStr) || 28;
    var fairMid = parseMidpointPrice(fairStr) || 20;

    // Numerical Unity Standard: On multi-item lots, sum of piece Boutique midpoints is Single Source of Truth
    var lotItems = Array.isArray(rep.lot_items) ? rep.lot_items : [];
    var sumPieceBoutique = 0;
    var sumPieceFair = 0;
    if (lotItems.length > 1) {
      lotItems.forEach(function (li) {
        sumPieceBoutique += getPieceBoutiqueMid(li);
        sumPieceFair += getPieceFairMid(li);
      });
      if (sumPieceBoutique > boutiqueMid) {
        boutiqueMid = Math.round(sumPieceBoutique * 100) / 100;
        boutiqueStr = '$' + Math.round(sumPieceBoutique) + ' (Σ ' + lotItems.length + ' pcs)';
      }
      if (sumPieceFair > fairMid) {
        fairMid = Math.round(sumPieceFair * 100) / 100;
        fairStr = '$' + Math.round(sumPieceFair) + ' (Σ ' + lotItems.length + ' pcs)';
      }
    }

    var targetResale = boutiqueMid > 0 ? boutiqueMid : fairMid;
    var netPayout = Math.round(targetResale * 0.85 * 100) / 100;

    var synergy = canCombine ? evaluateSellerSynergy(sellerName, weight, itemRow.itemId, domainKey) : null;
    var maxSavCap = Number(domainProfile.combineSavingsEstimate) > 0 ? Math.max(12, Number(domainProfile.combineSavingsEstimate)) : 12;
    var combineSavings = (synergy && synergy.isEligible && state.useCombineBonus)
      ? Math.min(maxSavCap, Math.max(5, Math.round(shipBase * 0.85)))
      : 0;
    var effectiveShip = isLocalPickupOnly ? 0 : Math.max(isSgw ? (shipHandling || 2) : 0, shipTotal - combineSavings);
    var allowSniperCents = Boolean(isAuction && !isSoftClose && buyersPremiumPct <= 0);

    // Mirrors src/lib/scoutReportSections.ts#computeCanonicalAuctionTiers + Minimum Bid floor & Combined Shipping unlock
    var bpMultTier = 1 + (buyersPremiumPct > 0 ? buyersPremiumPct / 100 : 0);
    function landedAtBid(bid) {
      return Math.round((bid * bpMultTier + effectiveShip) * 100) / 100;
    }
    var netAtCurrentBid = floorBid > 0 ? Math.round(netPayout - landedAtBid(floorBid)) : null;

    function calcTier(roiMultiple) {
      var targetLanded = Math.round((targetResale / roiMultiple) * 100) / 100;
      var availAfterShip = targetLanded - effectiveShip;
      var rawHammer = availAfterShip / bpMultTier;
      var baseMax = availAfterShip <= 0
        ? 0
        : isAuction ? Math.max(0, Math.floor(rawHammer)) : Math.max(0, Math.round(rawHammer * 100) / 100);
      var candidateMax = baseMax > 0 && allowSniperCents && state.useProxyCents
        ? Number((baseMax + 0.87).toFixed(2))
        : baseMax;
      var status = 'active';
      var statusLabel = '';
      if (baseMax <= 0) {
        baseMax = 0;
        candidateMax = 0;
        status = 'ship_exceeds_cap';
        statusLabel = '🛑 S&H > $' + Math.round(targetLanded) + ' Cap';
      } else if (floorBid > 0 && floorBid > candidateMax) {
        status = 'outbid';
        statusLabel = minimumBid > currentBid
          ? ('🚫 Min $' + floorBid.toFixed(2) + ' > $' + Math.round(baseMax))
          : ('🚫 Outbid ($' + Math.round(currentBid) + ' > $' + Math.round(baseMax) + ')');
      }
      var finalMax = status === 'active' ? candidateMax : baseMax;
      var bpDollars = buyersPremiumPct > 0 ? Math.round(finalMax * buyersPremiumPct) / 100 : 0;
      var estLanded = Math.round((finalMax + bpDollars + effectiveShip) * 100) / 100;
      return {
        roi: roiMultiple.toFixed(1) + 'x',
        maxBid: finalMax,
        bpDollars: bpDollars,
        estLanded: estLanded,
        targetLanded: targetLanded,
        // SIGNED P&L — never clamped at 0. Dead tiers report the real at-floor-bid result.
        netProfit: status !== 'active' && netAtCurrentBid !== null ? netAtCurrentBid : Math.round(netPayout - estLanded),
        status: status,
        statusLabel: statusLabel,
        passed: status !== 'active'
      };
    }

    var roiCons = Number((state.roiTargets && state.roiTargets.conservative) || 3.0) || 3.0;
    var roiBal = Number((state.roiTargets && state.roiTargets.balanced) || 2.2) || 2.2;
    var roiAgg = Number((state.roiTargets && state.roiTargets.aggressive) || 1.7) || 1.7;

    var tiers = {
      conservative: calcTier(roiCons),
      balanced: calcTier(roiBal),
      aggressive: calcTier(roiAgg)
    };
    var allDead = tiers.conservative.passed && tiers.balanced.passed && tiers.aggressive.passed;
    var allShipDead = tiers.conservative.status === 'ship_exceeds_cap' && tiers.balanced.status === 'ship_exceeds_cap' && tiers.aggressive.status === 'ship_exceeds_cap';
    var forcePass = allDead && (isAuction || allShipDead);
    // CRITICAL FIX: Server dead_deal was computed against solo S&H ($14.87); when Combined Shipping ($4.87) unlocks profitable tiers, do NOT force PASS!
    var serverDead = Boolean(purchaseStrat.dead_deal) && !(combineSavings > 0 && !allDead);
    var effectiveAllDead = allDead || serverDead;
    var resolvedVerdict;
    if (forcePass || effectiveAllDead) {
      resolvedVerdict = 'PASS';
    } else if (combineSavings > 0 && (purchaseStrat.dead_deal || purchaseStrat.verdict === 'PASS')) {
      resolvedVerdict = !tiers.balanced.passed ? (isAuction ? 'CHASE_AUCTION' : 'BUY_NOW') : 'WATCH';
    } else {
      resolvedVerdict = purchaseStrat.verdict || 'WATCH';
    }

    var freightBaseForTrap = effectiveShip > 0 ? effectiveShip : shipTotal;
    var freightPct = targetResale > 0 ? Math.round((freightBaseForTrap / targetResale) * 100) : 0;
    var isFreightTrap = freightBaseForTrap > 0 && targetResale > 0 && (freightBaseForTrap >= 0.45 * targetResale || (freightBaseForTrap >= 65 && freightBaseForTrap >= 0.35 * targetResale));
    var atCurrentBid = floorBid > 0
      ? { bidRef: floorBid, hasMinFloor: minimumBid > currentBid, landed: landedAtBid(floorBid), netProfit: netAtCurrentBid }
      : null;

    var targetCashOfferStr = purchaseStrat.target_cash_offer || '';
    if (!targetCashOfferStr && listingMode === 'local_cash') {
      var offerHigh = tiers.balanced.maxBid > 0 ? Math.round(tiers.balanced.maxBid) : 0;
      var offerLow = tiers.conservative.maxBid > 0 ? Math.round(tiers.conservative.maxBid) : Math.max(5, Math.round(offerHigh * 0.8));
      if (currentBid > 0) {
        offerHigh = Math.min(offerHigh || Math.round(currentBid * 0.8), Math.round(currentBid * 0.85));
        offerLow = Math.min(offerLow, Math.max(5, Math.round(currentBid * 0.65)));
      }
      if (offerHigh > 0) {
        targetCashOfferStr = offerLow > 0 && offerLow < offerHigh ? ('$' + offerLow + ' – $' + offerHigh) : ('$' + offerHigh);
      }
    }

    var actionLabel =
      purchaseStrat.action_label ||
      (listingMode === 'local_cash'
        ? 'Target Cash Offer'
        : !isAuction
        ? 'Max Offer / Buy Price'
        : buyersPremiumPct > 0
        ? 'Max Hammer Bid (Excl. +' + buyersPremiumPct + '% BP)'
        : 'Target Max Bid');

    return {
      domainKey: domainKey,
      currentBid: currentBid,
      minimumBid: minimumBid,
      floorBid: floorBid,
      listingMode: listingMode,
      isAuction: isAuction,
      isSoftClose: isSoftClose,
      isLocalPickupOnly: isLocalPickupOnly,
      buyersPremiumPct: buyersPremiumPct,
      allowSniperCents: allowSniperCents && !effectiveAllDead,
      actionLabel: actionLabel,
      targetCashOfferStr: targetCashOfferStr,
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
      sumPieceBoutique: Math.round(sumPieceBoutique * 100) / 100,
      verdict: resolvedVerdict,
      allDead: effectiveAllDead,
      isFreightTrap: isFreightTrap || (combineSavings <= 0 && Boolean(rep.is_freight_trap)),
      freightPct: freightPct,
      atCurrentBid: atCurrentBid,
      visionPhotosScanned: rep.vision_photos_scanned !== undefined && rep.vision_photos_scanned !== null ? Number(rep.vision_photos_scanned) : null,
      ocrText: cleanText(rep.ocr_detected_text || ''),
      bestPlatform: (rep.market_report && rep.market_report.best_platform) || '',
      whyPayUp: rep.why_pay_up || purchaseStrat.advice || '',
      whyPass: rep.why_pass || '',
      roiTargets: { conservative: roiCons, balanced: roiBal, aggressive: roiAgg },
      lotItems: lotItems,
      tiers: tiers
    };
  }

  function computeActiveMaxBid() {
    var fin = computeScoutFinancials();
    if (!fin) return 0;
    if (fin.allDead) return 0;
    var chosen = fin.tiers[state.selectedTier] || fin.tiers.balanced;
    if (!chosen || chosen.passed) return 0;
    return chosen.maxBid;
  }

  function saveItemToSgwTracker(withAiReport) {
    var auth = window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.getSession ? window.__RC_BML_AUTH__.getSession() : null;
    if (!auth) {
      if (window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.openConnectFlow) {
        window.__RC_BML_AUTH__.openConnectFlow(false);
      }
      return;
    }

    if (!state.inspectingGridItem) detectPageAndRows();
    var itemRow = getActiveItemRow();
    syncGalleryStateForItem(itemRow);
    var selectedUrls = getSelectedGalleryUrls();
    var fin = withAiReport ? computeScoutFinancials() : null;
    var targetMaxBid = parseFloat(state.customMaxBid) || (fin ? computeActiveMaxBid() : 0);

    if (targetMaxBid > 0 && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        navigator.clipboard.writeText(targetMaxBid.toFixed(2));
      } catch (e) {}
    }

    state.savingTrack = true;
    state.errorMsg = null;
    state.trackedSavedMsg = null;
    renderUI();

    var primaryImageUrl =
      state.coverPhotoUrl ||
      selectedUrls[0] ||
      (state.scoutReport && state.scoutReport.fetched_image) ||
      (itemRow.images && itemRow.images[0]) ||
      null;

    var combinedNotes = [];
    if (state.resellerNotes && cleanText(state.resellerNotes)) {
      combinedNotes.push('[RESELLER NOTE: ' + cleanText(state.resellerNotes) + ']');
    }
    if (fin && fin.whyPayUp) {
      combinedNotes.push(fin.whyPayUp);
    }

    var resolvedDomainKey = (fin && fin.domainKey) || itemRow.domainKey || resolveClientDomainKey(itemRow);
    var isSgw = resolvedDomainKey === 'shopgoodwill' || (isShopGoodwillHost() && /^\d{6,12}$/.test(String(itemRow.itemId || '')));
    var targetSourceUrl = itemRow.sourceUrl || window.location.href;
    var payloadRow = {
      itemId: itemRow.itemId,
      externalItemId: itemRow.externalItemId || itemRow.itemId,
      sourceUrl: targetSourceUrl,
      domainKey: resolvedDomainKey,
      platformName: itemRow.platformName || (isSgw ? 'ShopGoodwill' : ''),
      domainFamily: itemRow.domainFamily || '',
      listingMode: (fin && fin.listingMode) || itemRow.listingMode || '',
      buyersPremiumPct: fin ? fin.buyersPremiumPct : Number(itemRow.buyersPremiumPct || 0),
      title: (state.scoutReport && (state.scoutReport.title || state.scoutReport.identity)) || itemRow.title,
      currentPrice: fin ? fin.currentBid : itemRow.currentPrice,
      minimumBid: fin ? fin.minimumBid : Number(itemRow.minimumBid || itemRow.currentPrice || 0),
      maxBid: targetMaxBid,
      boutiquePrice: fin ? fin.boutiqueMid : 0,
      resalePrice: fin ? fin.fairMid : 0,
      seller: fin ? fin.sellerName : itemRow.seller,
      sellerId: fin ? fin.sellerId : (itemRow.sellerId || null),
      shippingWeight: fin ? fin.weight : itemRow.shippingWeight,
      canCombineShipping: fin ? fin.canCombine : (resolvedDomainKey === 'shopgoodwill'),
      primaryImageUrl: primaryImageUrl,
      imageUrls: selectedUrls,
      endingDate: itemRow.endingDate || '',
      conditionNotes: combinedNotes.join(' | '),
      aiReport: withAiReport && state.scoutReport ? state.scoutReport : null
    };

    callRcApi('POST', '/api/bml/sgw-sync', {
      pageType: isSgw ? 'item' : 'external-item',
      dryRun: false,
      rows: [payloadRow]
    })
      .then(function (resData) {
        state.savingTrack = false;
        state.lastSavedTracker = (resData && resData.tracker) || state.activeTracker || null;
        state.lastSavedForItemId = String(itemRow.itemId || '');
        var trkName = state.lastSavedTracker
          ? state.lastSavedTracker.orderId + ' (' + state.lastSavedTracker.vendor + ')'
          : 'Buy Tracker';
        var archivedCount = Number((resData && resData.uploadedPhotosCount) || 0);
        var archivedNote = archivedCount > 0 ? ' • 📸 ' + archivedCount + ' Archived' : '';
        state.trackedSavedMsg =
          targetMaxBid > 0
            ? '✅ Saved to ' + trkName + archivedNote + ' & Copied $' + targetMaxBid.toFixed(2) + '!'
            : '✅ Saved to ' + trkName + archivedNote + '!';
        notifyRcTabs({ tool: 'auction_scout', action: 'tracked_item', itemId: itemRow.itemId });
        fetchWatchlist();
        renderUI();
      })
      .catch(function (err) {
        state.savingTrack = false;
        state.errorMsg = (err && err.message) || 'Failed to save item to tracker.';
        renderUI();
      });
  }

  function getSelectedRowKeysArray() {
    var keys = [];
    var map = state.selectedRowKeys || {};
    Object.keys(map).forEach(function (k) {
      if (map[k]) keys.push(k);
    });
    return keys;
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

    var reqPayload = {
      pageType: state.pageType,
      dryRun: Boolean(dryRun),
      rows: cleanRows
    };
    if (!dryRun) {
      reqPayload.selectedKeys = getSelectedRowKeysArray();
    }

    callRcApi('POST', '/api/bml/sgw-sync', reqPayload)
      .then(function (data) {
        state.loadingPreview = false;
        state.committing = false;
        if (dryRun) {
          state.previewData = data;
          var selMap = {};
          ((data && data.rows) || []).forEach(function (pr) {
            var rk = pr.rowKey || (pr.orderId ? pr.orderId + ':' + pr.itemId : pr.itemId);
            selMap[rk] = pr.defaultSelected !== false;
          });
          state.selectedRowKeys = selMap;
        } else {
          state.commitResult = data;
          state.previewData = data;
          notifyRcTabs({ tool: 'auction_scout', action: 'committed_sync', pageType: state.pageType });
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

    if (!state.csvHarvested && !isItemScoutMode()) {
      harvestPageCsvSilently(function () {
        executeSyncCall(dryRun);
      });
    } else {
      executeSyncCall(dryRun);
    }
  }

  function renderCombineBannerHtml(synergy) {
    if (!synergy) return '';
    var hasReport = Boolean(state.scoutReport);
    var wLim = Number(synergy.weightLimit || 20).toFixed(1);
    if (hasReport && !state.combineExpandedPostScan) {
      if (synergy.isEligible) {
        return (
          '<button type="button" id="rc-toggle-combine-accordion" style="width:100%;background:linear-gradient(135deg,#064e3b,#0f766e);border:1px solid #34d399;border-radius:9px;padding:6px 10px;margin-bottom:7px;display:flex;justify-content:space-between;align-items:center;gap:6px;cursor:pointer;color:#ecfdf5;font-size:10.5px;font-weight:800;text-align:left;">' +
            '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">📦 Combined Match (+' + synergy.matchCount + ' at ' + escHtml(synergy.sellerName) + ')</span>' +
            '<span style="background:#022c22;color:#6ee7b7;padding:1px 7px;border-radius:999px;font-size:9.5px;font-family:monospace;font-weight:900;white-space:nowrap;flex-shrink:0;">' +
              synergy.totalWeight + '/' + wLim + ' lbs • Saves ~$' + synergy.estSavings.toFixed(0) + ' ▾' +
            '</span>' +
          '</button>'
        );
      }
      return (
        '<button type="button" id="rc-toggle-combine-accordion" style="width:100%;background:#7f1d1d;border:1px solid #f87171;border-radius:9px;padding:6px 10px;margin-bottom:7px;display:flex;justify-content:space-between;align-items:center;gap:6px;cursor:pointer;color:#fecaca;font-size:10.5px;font-weight:800;text-align:left;">' +
          '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">⚠️ Combined Weight Cap Warning (' + escHtml(synergy.sellerName) + ')</span>' +
          '<span style="font-family:monospace;font-size:9.5px;white-space:nowrap;flex-shrink:0;">' + synergy.totalWeight + '/' + wLim + ' lbs (2nd Box) ▾</span>' +
        '</button>'
      );
    }

    var collapseHint = hasReport
      ? '<button type="button" id="rc-toggle-combine-accordion" style="background:rgba(2,44,34,0.75);color:#a7f3d0;border:1px solid rgba(110,231,183,0.4);border-radius:6px;padding:1px 6px;font-size:9.5px;font-weight:800;cursor:pointer;">▴ Collapse</button>'
      : '';

    if (synergy.isEligible) {
      var matchList = synergy.matches
        .slice(0, 3)
        .map(function (m) {
          var badge = m.status === 'acquired' ? '🏆 Won' : m.bidState === 'winning' ? '🟢 Winning' : '📌 Tracked';
          return '<div style="font-size:10.5px;color:#d1fae5;margin-top:2px;">• ' + badge + ': #' + escHtml(m.itemId) + ' ' + escHtml(String(m.title || '').slice(0, 38)) + '</div>';
        })
        .join('');
      return (
        '<div style="background:linear-gradient(135deg,#064e3b,#0f766e);border:1px solid #34d399;border-radius:12px;padding:10px 12px;margin-bottom:8px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">' +
            '<span style="font-weight:900;font-size:11.5px;color:#ecfdf5;">📦 COMBINED SHIPPING MATCH (' + synergy.matchCount + ' at ' + escHtml(synergy.sellerName) + ')</span>' +
            '<div style="display:flex;align-items:center;gap:5px;">' +
              '<span style="background:#022c22;color:#6ee7b7;padding:2px 7px;border-radius:999px;font-size:10px;font-family:monospace;font-weight:800;">' +
                synergy.totalWeight + ' / ' + wLim + ' lbs • Saves ~$' + synergy.estSavings.toFixed(0) +
              '</span>' +
              collapseHint +
            '</div>' +
          '</div>' +
          matchList +
        '</div>'
      );
    }
    return (
      '<div style="background:#7f1d1d;border:1px solid #f87171;border-radius:12px;padding:10px 12px;margin-bottom:8px;color:#fecaca;font-size:11px;font-weight:700;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">' +
          '<span>⚠️ COMBINED WEIGHT WARNING (' + escHtml(synergy.sellerName) + '): ' + synergy.totalWeight + ' / ' + wLim + ' lbs triggers a 2nd shipping box!</span>' +
          collapseHint +
        '</div>' +
      '</div>'
    );
  }

  function renderPhotoStripAndNotesSection(itemRow) {
    syncGalleryStateForItem(itemRow);
    var allUrls = state.galleryUrls || [];
    var selUrls = getSelectedGalleryUrls();
    var hasReport = Boolean(state.scoutReport);

    if (hasReport && !state.galleryExpandedPostScan) {
      var noteHint = state.resellerNotes && cleanText(state.resellerNotes)
        ? ' • 📝 Note'
        : '';
      return (
        '<button type="button" id="rc-toggle-gallery-accordion" style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:9px;padding:6px 10px;margin-bottom:7px;display:flex;justify-content:space-between;align-items:center;gap:6px;cursor:pointer;color:#e2e8f0;font-size:10.5px;font-weight:800;text-align:left;">' +
          '<span>📸 Gallery &amp; Notes: <strong style="color:#34d399;">' + selUrls.length + '</strong> / ' + allUrls.length + ' selected' + noteHint + '</span>' +
          '<span style="color:#a5b4fc;font-size:9.5px;font-weight:800;white-space:nowrap;">Edit Photos / Notes ▾</span>' +
        '</button>'
      );
    }

    var thumbsHtml = '';
    if (allUrls.length > 0) {
      thumbsHtml +=
        '<div class="rc-scout-scroll" style="display:flex;gap:6px;overflow-x:auto;padding:2px 0 6px 0;">';
      allUrls.forEach(function (url, idx) {
        var isChecked = Boolean(state.selectedPhotoUrls[url]);
        var isCover = state.coverPhotoUrl === url;
        var borderCol = isCover ? '#fbbf24' : isChecked ? '#34d399' : '#334155';
        var lensHref = 'https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(url);
        thumbsHtml +=
          '<div style="position:relative;width:58px;height:58px;flex-shrink:0;border-radius:8px;overflow:hidden;border:2px solid ' + borderCol + ';background:#020617;' + (isChecked ? '' : 'opacity:0.48;') + '">' +
            '<img src="' + escHtml(url) + '" alt="Photo ' + (idx + 1) + '" class="rc-photo-toggle-btn" data-url="' + escHtml(url) + '" style="width:100%;height:100%;object-fit:cover;cursor:pointer;display:block;" />' +
            '<button type="button" class="rc-photo-toggle-btn" data-url="' + escHtml(url) + '" title="Include/exclude photo in AI scan (max 12)" style="position:absolute;top:2px;left:2px;background:' + (isChecked ? '#059669' : 'rgba(15,23,42,0.85)') + ';color:#fff;border:0;border-radius:4px;padding:1px 4px;font-size:9px;font-weight:900;cursor:pointer;line-height:1.1;">' +
              (isChecked ? '✓' + (idx + 1) : '#' + (idx + 1)) +
            '</button>' +
            '<button type="button" class="rc-photo-star-btn" data-url="' + escHtml(url) + '" title="Set as primary cover photo" style="position:absolute;bottom:2px;left:2px;background:rgba(15,23,42,0.85);color:' + (isCover ? '#fbbf24' : '#94a3b8') + ';border:0;border-radius:4px;padding:1px 3px;font-size:9px;cursor:pointer;line-height:1.1;">★</button>' +
            '<a href="' + escHtml(lensHref) + '" target="_blank" rel="noopener noreferrer" class="rc-photo-lens-link" title="Inspect in Google Lens" style="position:absolute;bottom:2px;right:2px;background:rgba(15,23,42,0.85);color:#93c5fd;border-radius:4px;padding:1px 3px;font-size:9px;text-decoration:none;line-height:1.1;">🔎</a>' +
          '</div>';
      });
      thumbsHtml += '</div>';
    } else {
      thumbsHtml =
        '<div style="font-size:10.5px;color:#94a3b8;padding:4px 0;">Official gallery thumbnails will attach automatically when AI Speed Scout runs.</div>';
    }

    return (
      '<div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:9px 11px;margin-bottom:8px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:5px;">' +
          '<span style="font-size:10.5px;font-weight:900;color:#e2e8f0;">📸 Gallery for AI Scan &amp; Save: <strong style="color:#34d399;">' + selUrls.length + '</strong> / ' + allUrls.length + ' (Max 12)</span>' +
          '<div style="display:flex;align-items:center;gap:5px;">' +
            (allUrls.length > 0
              ? '<button type="button" id="rc-photo-select-top12" style="background:#1e293b;color:#a5b4fc;border:1px solid #334155;border-radius:5px;padding:2px 6px;font-size:9.5px;font-weight:800;cursor:pointer;">Top 12</button>'
              : '') +
            (hasReport
              ? '<button type="button" id="rc-toggle-gallery-accordion" style="background:#1e293b;color:#cbd5e1;border:1px solid #334155;border-radius:5px;padding:2px 6px;font-size:9.5px;font-weight:800;cursor:pointer;">▴ Collapse</button>'
              : '') +
          '</div>' +
        '</div>' +
        thumbsHtml +
        '<div style="margin-top:5px;">' +
          '<input id="rc-scout-reseller-notes" type="text" maxlength="240" value="' + escHtml(state.resellerNotes) + '" placeholder="📝 Reseller Notes (e.g. &quot;Lot of 9 modules&quot;, &quot;1st print&quot;, &quot;missing cord&quot;)..." style="width:100%;background:#020617;color:#f8fafc;border:1px solid #334155;border-radius:7px;padding:5px 8px;font-size:11px;" />' +
        '</div>' +
      '</div>'
    );
  }

  function renderLotBreakdownSection(fin, rep, activeLanded) {
    var lotItems = (fin && Array.isArray(fin.lotItems)) ? fin.lotItems : [];
    if (lotItems.length <= 1) {
      if (rep && rep.lot_breakdown_unavailable) {
        return (
          '<div style="background:#451a03;border:1px solid #f59e0b;color:#fef3c7;border-radius:12px;padding:9px 11px;margin-bottom:10px;font-size:10.5px;font-weight:800;line-height:1.4;">' +
            '⚠️ Lot Not Itemized — valued as unbroken bulk (low confidence). Select clear spine/detail photos above and tap 🔄 Re-Scan Selected.' +
          '</div>'
        );
      }
      return '';
    }

    var maxBoutique = 0;
    lotItems.forEach(function (li) {
      var v = getPieceBoutiqueMid(li);
      if (v > maxBoutique) maxBoutique = v;
    });

    function isHeroPiece(li) {
      if (!li) return false;
      if (li.anchor || li.hero || li.is_anchor || li.is_hero) return true;
      var v = getPieceBoutiqueMid(li);
      return v > 0 && v === maxBoutique;
    }

    var sorted = lotItems.slice().sort(function (a, b) {
      var aHero = isHeroPiece(a);
      var bHero = isHeroPiece(b);
      if (aHero && !bHero) return -1;
      if (!aHero && bHero) return 1;
      var diffB = getPieceBoutiqueMid(b) - getPieceBoutiqueMid(a);
      if (diffB !== 0) return diffB;
      return getPieceFairMid(b) - getPieceFairMid(a);
    });

    var sumBoutique = 0;
    sorted.forEach(function (li) {
      sumBoutique += getPieceBoutiqueMid(li);
    });
    if (sumBoutique <= 0) sumBoutique = fin.boutiqueMid || 1;

    var heroPiece = sorted[0];
    var heroVal = getPieceBoutiqueMid(heroPiece);
    var heroNet = Math.round(heroVal * 0.85 * 100) / 100;
    var landedRef = activeLanded > 0 ? activeLanded : (fin.currentBid + fin.effectiveShip);
    var heroRecoupPct = landedRef > 0 ? Math.min(999, Math.round((heroNet / landedRef) * 100)) : 0;

    var rawStrategy = String(rep.lot_strategy || (rep.market_report && rep.market_report.lot_strategy) || '').toLowerCase();
    var shouldSplit = rawStrategy.indexOf('bundle') === -1 && (heroVal >= 16 || sumBoutique / sorted.length >= 10);
    var strategyPill = shouldSplit
      ? '<span style="background:#312e81;color:#e0e7ff;padding:2px 7px;border-radius:6px;font-size:9.5px;font-weight:900;white-space:nowrap;">✂️ Split Individual</span>'
      : '<span style="background:#0f766e;color:#ccfbf1;padding:2px 7px;border-radius:6px;font-size:9.5px;font-weight:900;white-space:nowrap;">📦 Bundle / Booth Bin</span>';

    var totalPhysicalUnits = 0;
    sorted.forEach(function (li) {
      totalPhysicalUnits += getPieceQty(li);
    });
    var breakdownHeaderLabel = totalPhysicalUnits > sorted.length
      ? '🧩 Lot Breakdown (' + sorted.length + ' Lines • ' + totalPhysicalUnits + ' Total Units — 100% Shown)'
      : '🧩 Lot Breakdown (' + sorted.length + ' Pieces — 100% Shown)';
    var avgUnitLandedStr = totalPhysicalUnits > 1 && landedRef > 0
      ? (' ($' + (landedRef / totalPhysicalUnits).toFixed(2) + '/unit avg)')
      : '';
    var mismatchHtml = (rep && rep.lot_quantity_mismatch)
      ? '<div style="background:#451a03;border:1px solid #f59e0b;color:#fde68a;border-radius:6px;padding:3px 7px;margin-bottom:6px;font-size:9.5px;font-weight:800;">' +
          '⚠️ Itemized ' + escHtml(String(rep.lot_quantity_mismatch.itemized)) + ' of ' + escHtml(String(rep.lot_quantity_mismatch.declared)) + ' declared units' +
        '</div>'
      : '';

    var out =
      '<div style="background:#090d1f;border:1.5px solid #6366f1;border-radius:12px;padding:10px 11px;margin-bottom:10px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px;">' +
          '<span style="font-size:11.5px;font-weight:900;color:#e0e7ff;">' + escHtml(breakdownHeaderLabel) + '</span>' +
          strategyPill +
        '</div>' +
        mismatchHtml +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;background:#1e1b4b;border:1px solid rgba(129,140,248,0.35);border-radius:8px;padding:6px 8px;margin-bottom:8px;font-size:10.5px;">' +
          '<span style="color:#c7d2fe;font-weight:800;">Σ Boutique: <strong style="color:#34d399;font-family:monospace;">$' + sumBoutique.toFixed(0) + '</strong> vs Landed <strong style="color:#fbbf24;font-family:monospace;">$' + landedRef.toFixed(2) + '</strong><span style="color:#a5b4fc;font-family:monospace;font-size:9.5px;">' + escHtml(avgUnitLandedStr) + '</span></span>' +
          (heroRecoupPct > 0
            ? '<span style="background:#065f46;color:#6ee7b7;padding:1px 6px;border-radius:999px;font-size:9.5px;font-weight:900;font-family:monospace;">👑 Hero Recoups ' + heroRecoupPct + '%</span>'
            : '') +
        '</div>' +
        '<div class="rc-scout-scroll" style="max-height:290px;overflow-y:auto;display:flex;flex-direction:column;gap:5px;padding-right:2px;">';

    sorted.forEach(function (li, idx) {
      var isHero = idx === 0 && heroVal > 0;
      var pTitle = li.name || li.title || li.identity || ('Piece #' + (idx + 1));
      var pQty = getPieceQty(li);
      var pBoutiqueStr =
        (li.pricing_potential && li.pricing_potential.boutique) ||
        (li.price_breakdown && li.price_breakdown.boutique_premium) ||
        li.estimated_value ||
        '-';
      var pFairStr =
        (li.pricing_potential && li.pricing_potential.fair) ||
        (li.price_breakdown && li.price_breakdown.fair) ||
        '-';
      var pBuyStr =
        (li.buy_range && li.buy_range.formatted) ||
        (li.buy_range && li.buy_range.max !== undefined ? ('$' + Number(li.buy_range.max).toFixed(0)) : '');
      var pVal = getPieceBoutiqueMid(li);
      var allocCost = landedRef > 0 && sumBoutique > 0 ? (pVal / sumBoutique) * landedRef : (Number(li.split_cost_basis) || 0);
      var unitCost = pQty > 1 ? allocCost / pQty : allocCost;
      var unitBoutique = pQty > 1 && pVal > 0 ? pVal / pQty : 0;
      var unitBoutiqueHint = unitBoutique > 0 ? (' (~$' + (unitBoutique % 1 === 0 ? unitBoutique.toFixed(0) : unitBoutique.toFixed(2)) + '/ea)') : '';
      var costHtml = pQty > 1
        ? '<span style="color:#fbbf24;font-weight:800;">Cost/Item: $' + unitCost.toFixed(2) + '/ea <span style="color:#cbd5e1;font-weight:600;">(Split $' + allocCost.toFixed(2) + ' ÷ ' + pQty + ')</span></span>'
        : '<span style="color:#fbbf24;">Split Cost: $' + allocCost.toFixed(2) + '</span>';
      var condTxt = cleanText(li.condition || '');

      out +=
        '<div style="background:' + (isHero ? 'rgba(6,95,70,0.28)' : '#0f172a') + ';border:1px solid ' + (isHero ? '#34d399' : '#1e293b') + ';border-radius:8px;padding:6px 8px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;">' +
            '<div style="font-size:11px;font-weight:800;color:#f8fafc;line-height:1.3;">' +
              '<span style="color:#94a3b8;font-family:monospace;margin-right:4px;">#' + (idx + 1) + '</span>' +
              (isHero ? '<span style="background:#f59e0b;color:#1e1b18;padding:1px 5px;border-radius:4px;font-size:9px;font-weight:900;margin-right:4px;">👑 HERO</span>' : '') +
              (li.is_key_issue ? '<span style="background:#7c3aed;color:#f3e8ff;padding:1px 5px;border-radius:4px;font-size:9px;font-weight:900;margin-right:4px;">🔑 KEY</span>' : '') +
              (pQty > 1 ? '<span style="background:#0f766e;color:#ccfbf1;padding:1px 5px;border-radius:4px;font-size:9px;font-weight:900;margin-right:4px;">📦 ×' + pQty + ' Qty</span>' : '') +
              escHtml(pTitle) +
            '</div>' +
            (condTxt ? '<span style="background:#1e293b;color:#cbd5e1;padding:1px 5px;border-radius:4px;font-size:9px;font-weight:700;white-space:nowrap;flex-shrink:0;">' + escHtml(condTxt.slice(0, 18)) + '</span>' : '') +
          '</div>' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;margin-top:4px;font-family:monospace;font-size:10px;">' +
            '<span style="color:#34d399;font-weight:800;">Boutique: ' + escHtml(pBoutiqueStr + unitBoutiqueHint) + '</span>' +
            '<span style="color:#93c5fd;">Fair: ' + escHtml(pFairStr) + '</span>' +
            (pBuyStr ? '<span style="color:#c4b5fd;">Buy: ' + escHtml(pBuyStr) + '</span>' : '') +
            costHtml +
          '</div>' +
        '</div>';
    });

    out += '</div></div>';
    return out;
  }

  function renderExitChannelsSection(fin, rep, activeLanded) {
    var mkt = (rep && rep.market_report) || {};
    var rawChannels = Array.isArray(mkt.channels) && mkt.channels.length > 0 ? mkt.channels : null;
    var hasLot = fin.lotItems && fin.lotItems.length > 1;
    var currentLanded = fin.atCurrentBid ? fin.atCurrentBid.landed : (fin.currentBid + fin.effectiveShip);
    var useCurrentBidBasis = Boolean(fin.currentBid > 0 && (fin.allDead || activeLanded <= 0 || activeLanded < currentLanded));
    var costRef = useCurrentBidBasis ? currentLanded : (activeLanded > 0 ? activeLanded : currentLanded);

    var repTitleAndOcr = String((rep && (rep.title || rep.identity || '')) + ' ' + (fin.ocrText || ''));
    var disallowDt =
      Number(fin.weight || 0) >= 2.0 ||
      String(rep && rep.physical_substrate) === 'APPAREL_GARMENT' ||
      /\b(?:\d{3,5}\s*(?:pcs|pieces|pzs)|sealed\s+set|playset|board\s*game|castle|joust|display\s+case|framed)\b/i.test(repTitleAndOcr);

    var channels = [];
    if (rawChannels) {
      rawChannels.forEach(function (ch) {
        var cName = String(ch.name || 'Channel');
        if (disallowDt && /\bdusty\s*tiger\b|\(\s*DT\s*\)/i.test(cName)) return;
        var isBooth = /memory\s*den|booth/i.test(cName);
        var isEbay = /ebay/i.test(cName);
        var gross = isBooth && hasLot ? fin.boutiqueMid : (parseMidpointPrice(ch.est_price) || (isBooth ? fin.boutiqueMid : fin.fairMid));
        var net = isBooth && hasLot
          ? Math.round(gross * 0.85 * 100) / 100
          : (parseMidpointPrice(ch.net_payout) || Math.round(gross * (isEbay ? 0.865 : 0.85) * 100) / 100);
        channels.push({
          name: cName,
          gross: gross,
          net: net,
          note: cleanText(ch.recommendation || ''),
          isBest: String(fin.bestPlatform || '').toLowerCase().indexOf(cName.toLowerCase().split(' ')[0]) !== -1
        });
      });
    }
    if (channels.length === 0) {
      channels = [
        {
          name: "Memory Den (#0EJ)",
          gross: fin.boutiqueMid,
          net: Math.round(fin.boutiqueMid * 0.85 * 100) / 100,
          note: 'Curated booth shelf showcase (15% fee)',
          isBest: /memory\s*den|booth/i.test(fin.bestPlatform || '')
        },
        {
          name: 'eBay (Online)',
          gross: fin.fairMid,
          net: Math.round(fin.fairMid * 0.865 * 100) / 100,
          note: 'National sold-comp velocity (~13.5% fee)',
          isBest: /ebay/i.test(fin.bestPlatform || '')
        }
      ];
    }

    var velocity = cleanText(mkt.sell_through_velocity || '');
    var out =
      '<div style="background:#020617;border:1px solid #334155;border-radius:12px;padding:9px 11px;margin-bottom:10px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:6px;">' +
          '<span style="font-size:10.5px;font-weight:900;color:#cbd5e1;text-transform:uppercase;">🏪 Exit Play &amp; Channel Net</span>' +
          (velocity ? '<span style="background:#1e293b;color:#38bdf8;padding:1px 7px;border-radius:999px;font-size:9.5px;font-weight:800;">⚡ ' + escHtml(velocity) + '</span>' : '') +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">';

    channels.slice(0, 4).forEach(function (ch) {
      var profit = Math.round((ch.net - costRef) * 100) / 100;
      var roi = costRef > 0 ? Math.round((profit / costRef) * 100) : 0;
      var basisNote = useCurrentBidBasis ? (' at $' + Math.round(fin.currentBid) + ' bid') : '';
      out +=
        '<div style="background:#0f172a;border:1px solid ' + (ch.isBest ? '#34d399' : '#1e293b') + ';border-radius:8px;padding:6px 8px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:4px;margin-bottom:2px;">' +
            '<span style="font-size:10px;font-weight:900;color:#f8fafc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHtml(ch.name) + '</span>' +
            (ch.isBest ? '<span style="background:#065f46;color:#6ee7b7;padding:0 5px;border-radius:4px;font-size:8.5px;font-weight:900;">BEST</span>' : '') +
          '</div>' +
          '<div style="font-family:monospace;font-size:11px;font-weight:800;color:#e2e8f0;">Tag $' + ch.gross.toFixed(0) + ' ➔ <span style="color:#34d399;">Net $' + ch.net.toFixed(2) + '</span></div>' +
          '<div style="font-family:monospace;font-size:9.5px;color:' + (profit < 0 ? '#fca5a5' : fin.allDead ? '#fcd34d' : '#6ee7b7') + ';margin-top:1px;">' +
            (profit >= 0 ? '+$' + profit.toFixed(2) : '-$' + Math.abs(profit).toFixed(2)) + ' (' + roi + '% ROI' + escHtml(basisNote) + ')' +
          '</div>' +
          (ch.note ? '<div style="font-size:9.5px;color:#94a3b8;margin-top:3px;line-height:1.25;">' + escHtml(ch.note.slice(0, 80)) + '</div>' : '') +
        '</div>';
    });

    out += '</div></div>';
    return out;
  }

  function renderCatalystsSection(fin) {
    var html = '';
    if (fin.ocrText) {
      html += '<div style="font-size:10.5px;color:#bae6fd;background:#0f172a;border-left:3px solid #38bdf8;padding:6px 9px;border-radius:6px;margin-bottom:6px;"><strong>🔎 OCR / Signature Read:</strong> ' + escHtml(fin.ocrText.slice(0, 300)) + '</div>';
    }
    if (fin.whyPayUp) {
      html += '<div style="font-size:11px;color:#cbd5e1;background:#0f172a;border-left:3px solid #34d399;padding:6px 9px;border-radius:6px;margin-bottom:6px;"><strong>💡 Why Buy:</strong> ' + escHtml(fin.whyPayUp) + '</div>';
    }
    if (fin.whyPass) {
      html += '<div style="font-size:10.5px;color:#fca5a5;background:#0f172a;border-left:3px solid #f87171;padding:6px 9px;border-radius:6px;margin-bottom:8px;"><strong>⚠️ Watch Out:</strong> ' + escHtml(fin.whyPass) + '</div>';
    }
    return html;
  }

  function renderConditionCompsSection(rep) {
    if (!rep) return '';
    var flags = Array.isArray(rep.red_flags) ? rep.red_flags : [];
    var comps = Array.isArray(rep.comparables)
      ? rep.comparables
      : Array.isArray(rep.comparable_sales)
      ? rep.comparable_sales
      : [];
    var cond = cleanText(rep.condition_notes || '');
    var reasoning = cleanText(rep.price_reasoning || '');
    var era = cleanText(rep.era_and_origin || '');

    if (!flags.length && !comps.length && !cond && !reasoning && !era) return '';

    var digestBits = [];
    if (flags.length > 0) digestBits.push('🚩 ' + flags.length + ' Flag' + (flags.length === 1 ? '' : 's'));
    if (comps.length > 0) digestBits.push('💬 ' + comps.length + ' Comp' + (comps.length === 1 ? '' : 's'));
    if (cond) digestBits.push('🔍 Condition');

    var bodyHtml = '';
    if (state.detailsOpen) {
      bodyHtml += '<div class="rc-scout-scroll" style="max-height:220px;overflow-y:auto;padding:8px 10px;border-top:1px solid #1e293b;font-size:10.5px;color:#cbd5e1;display:flex;flex-direction:column;gap:6px;">';
      if (cond) {
        bodyHtml += '<div><strong style="color:#93c5fd;">🔍 Condition:</strong> ' + escHtml(cond) + '</div>';
      }
      if (era) {
        bodyHtml += '<div><strong style="color:#c4b5fd;">🏛️ Era / Origin:</strong> ' + escHtml(era) + '</div>';
      }
      if (flags.length > 0) {
        bodyHtml += '<div><strong style="color:#fca5a5;">🚩 Red Flags:</strong><ul style="margin:3px 0 0 16px;padding:0;">' +
          flags.map(function (f) { return '<li style="margin-bottom:2px;color:#fecaca;">' + escHtml(f) + '</li>'; }).join('') +
          '</ul></div>';
      }
      if (comps.length > 0) {
        bodyHtml += '<div><strong style="color:#6ee7b7;">💬 Market Comparables:</strong>' +
          comps.slice(0, 6).map(function (c) {
            var cName = c.name || c.title || 'Comp';
            var cPrice = c.price || c.sold_price || '';
            var cStatus = c.status || 'Sold';
            return '<div style="display:flex;justify-content:space-between;gap:6px;padding:2px 0;border-bottom:1px dashed rgba(255,255,255,0.06);">' +
              '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHtml(cName) + '</span>' +
              '<span style="font-family:monospace;color:#34d399;white-space:nowrap;">' + escHtml(cPrice) + ' [' + escHtml(cStatus) + ']</span>' +
            '</div>';
          }).join('') +
        '</div>';
      }
      if (reasoning) {
        bodyHtml += '<div style="color:#94a3b8;"><strong>📐 Pricing Logic:</strong> ' + escHtml(reasoning) + '</div>';
      }
      bodyHtml += '</div>';
    }

    return (
      '<div style="background:#020617;border:1px solid #334155;border-radius:10px;overflow:hidden;margin-bottom:8px;">' +
        '<button type="button" id="rc-scout-details-toggle" style="width:100%;background:#0f172a;color:#e2e8f0;border:0;padding:8px 10px;display:flex;justify-content:space-between;align-items:center;gap:6px;cursor:pointer;font-size:10.5px;font-weight:800;">' +
          '<span>🔍 Deep Scout Details</span>' +
          '<span style="color:#a5b4fc;font-family:monospace;font-size:10px;">' + escHtml(digestBits.join(' • ')) + ' ' + (state.detailsOpen ? '▴' : '▾') + '</span>' +
        '</button>' +
        bodyHtml +
      '</div>'
    );
  }

  function renderItemTrayBody() {
    var itemRow = getActiveItemRow();
    var isSgw = Boolean(
      itemRow.domainKey === 'shopgoodwill' ||
        (isShopGoodwillHost() && /^\d{6,12}$/.test(String(itemRow.itemId || '')))
    );
    var existingWl = lookupWatchlistForItem(itemRow);
    var preSynergy = evaluateSellerSynergy(itemRow.seller, itemRow.shippingWeight, itemRow.itemId, itemRow.domainKey);
    var fin = computeScoutFinancials();
    var activeSynergy = fin && fin.synergy ? fin.synergy : preSynergy;

    var dispBpPct = fin ? fin.buyersPremiumPct : Number(itemRow.buyersPremiumPct || 0);
    var dispLocal = fin ? fin.isLocalPickupOnly : Boolean(itemRow.isLocalPickupOnly);
    var dispSoft = fin ? fin.isSoftClose : Boolean(itemRow.isSoftClose);
    var dispMode = (fin && fin.listingMode) || itemRow.listingMode || (isSgw ? 'auction' : 'auction');
    var dispIsAuction = fin ? fin.isAuction : (isSgw || Boolean(itemRow.isAuction));
    var badgeIdText = isSgw ? ('#' + itemRow.itemId) : (itemRow.displayBadgeId || itemRow.platformName || 'Listing');
    var priceHeading = (!dispIsAuction || dispMode === 'local_cash' || dispMode === 'fixed_online') ? 'Asking Price' : 'Current Bid';

    var domainPillsHtml = '';
    if (dispBpPct > 0) {
      domainPillsHtml += '<span style="background:#7c2d12;color:#ffedd5;padding:2px 7px;border-radius:6px;font-size:10px;font-weight:900;">⚠️ +' + dispBpPct + '% Buyer\'s Premium</span>';
    }
    if (dispSoft) {
      domainPillsHtml += '<span style="background:#3730a3;color:#e0e7ff;padding:2px 7px;border-radius:6px;font-size:10px;font-weight:800;">⏱️ Soft-Close (No .87)</span>';
    }
    if (dispLocal) {
      domainPillsHtml += '<span style="background:#065f46;color:#d1fae5;padding:2px 7px;border-radius:6px;font-size:10px;font-weight:800;">🚗 Local Pickup ($0 Ship)</span>';
    }

    var html = '';

    if (state.inspectingGridItem) {
      var sumBack = (state.sweepData && state.sweepData.summary) || null;
      var backHits = sumBack
        ? Number(sumBack.hotFlipCount || 0) + Number(sumBack.combinePlayCount || 0) + Number(sumBack.sleeperCount || 0)
        : 0;
      var backLabel = state.sweepData
        ? ('← Back to 🕸️ Auction Sweep (' + backHits + ' Hit' + (backHits === 1 ? '' : 's') + ')')
        : ('← Back to 🕸️ Grid (' + (state.gridCards ? state.gridCards.length : 0) + ' Lots)');
      html +=
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;background:#1e1b4b;border:1px solid #6366f1;border-radius:10px;padding:6px 9px;margin-bottom:8px;">' +
          '<button type="button" id="rc-back-to-sweep-btn" style="background:#312e81;color:#e0e7ff;border:1px solid #818cf8;border-radius:7px;padding:4px 9px;font-size:11px;font-weight:900;cursor:pointer;">' +
            escHtml(backLabel) +
          '</button>' +
          '<div style="display:flex;align-items:center;gap:5px;">' +
            '<button type="button" id="rc-focus-inspected-card-btn" title="Scroll webpage to this card" style="background:#0f172a;color:#6ee7b7;border:1px solid #334155;border-radius:7px;padding:4px 7px;font-size:10.5px;font-weight:800;cursor:pointer;">🎯 Card</button>' +
            (itemRow.sourceUrl
              ? '<a href="' + escHtml(itemRow.sourceUrl) + '" target="_blank" rel="noopener noreferrer" style="background:#0f172a;color:#93c5fd;border:1px solid #334155;border-radius:7px;padding:4px 8px;font-size:10.5px;font-weight:800;text-decoration:none;">Open ↗</a>'
              : '') +
          '</div>' +
        '</div>';
    }

    var dispCurBid = Number((fin && fin.currentBid) || itemRow.currentPrice || 0);
    var dispMinBid = Number((fin && fin.minimumBid) || itemRow.minimumBid || dispCurBid);
    var showMinFloor = dispIsAuction && dispMinBid > dispCurBid;

    // 1. Live Item Summary Header Card
    html +=
      '<div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:9px 11px;margin-bottom:8px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">' +
          '<div style="min-width:0;flex:1;">' +
            '<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:3px;">' +
              '<span style="background:#312e81;color:#e0e7ff;padding:2px 7px;border-radius:6px;font-family:monospace;font-size:10.5px;font-weight:800;">' + escHtml(badgeIdText) + '</span>' +
              '<span style="color:#94a3b8;font-size:11px;font-weight:700;">📍 ' + escHtml((fin && fin.sellerName) || itemRow.seller) + '</span>' +
              (existingWl
                ? '<span style="background:#065f46;color:#d1fae5;padding:2px 7px;border-radius:6px;font-size:10px;font-weight:800;">📌 Tracked (Max $' + Number(existingWl.maxBid || 0).toFixed(2) + ')' + (existingWl.trackerLabel ? ' • ' + escHtml(existingWl.trackerLabel.split(' ')[0]) : '') + '</span>'
                : '') +
              domainPillsHtml +
            '</div>' +
            '<div style="font-weight:800;font-size:12px;color:#f8fafc;line-height:1.3;">' + escHtml(itemRow.title) + '</div>' +
          '</div>' +
          '<div style="text-align:right;flex-shrink:0;">' +
            '<div style="font-size:9.5px;color:#94a3b8;text-transform:uppercase;font-weight:800;">' + priceHeading + '</div>' +
            '<div style="font-size:15px;font-weight:900;color:#38bdf8;font-family:monospace;line-height:1.15;">$' + dispCurBid.toFixed(2) + '</div>' +
            (showMinFloor
              ? '<div style="font-size:10px;font-weight:900;color:#fbbf24;font-family:monospace;margin-top:1px;">Min Bid $' + dispMinBid.toFixed(2) + '</div>'
              : '') +
          '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.08);font-size:10.5px;">' +
          '<span style="color:#cbd5e1;">' +
            (dispLocal ? '🚗 Pickup: <strong>In-Person ($0 S&amp;H)</strong>' : '⚖️ Est. Weight: <strong>' + Number((fin && fin.weight) || itemRow.shippingWeight || 1.5).toFixed(1) + ' lbs</strong>') +
          '</span>' +
          '<label style="display:flex;align-items:center;gap:5px;color:#cbd5e1;font-weight:700;">' +
            '<span>Ship ZIP:</span>' +
            '<input id="rc-scout-zip-input" type="text" maxlength="5" value="' + escHtml(state.zipCode) + '" style="width:60px;background:#0f172a;color:#f8fafc;border:1px solid #475569;border-radius:6px;padding:2px 5px;font-family:monospace;font-size:10.5px;text-align:center;" />' +
          '</label>' +
        '</div>' +
      '</div>';

    // 2. Selectable Photo Strip + Authoritative Reseller Notes (Auto-compacts into 1-line summary after scan!)
    html += renderPhotoStripAndNotesSection(itemRow);

    // 3. Domain-Scoped Combined Shipping Synergy Banner (Auto-compacts into 1-line summary after scan!)
    html += renderCombineBannerHtml(activeSynergy);

    if (state.trackedSavedMsg) {
      html +=
        '<div style="background:#065f46;color:#ecfdf5;border:1px solid #34d399;padding:7px 10px;border-radius:9px;margin-bottom:7px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;font-weight:800;font-size:11px;">' +
          '<span>' + escHtml(state.trackedSavedMsg) + '</span>' +
          '<a href="' + state.activeOrigin + '/scout/trackers" target="_blank" style="background:#022c22;color:#6ee7b7;padding:2px 7px;border-radius:6px;text-decoration:none;font-size:10px;font-weight:900;">Open /scout/trackers ↗</a>' +
        '</div>';
    }
    if (state.errorMsg) {
      html += '<div style="background:#7f1d1d;color:#fecaca;padding:8px 10px;border-radius:9px;margin-bottom:7px;font-weight:700;font-size:11px;">❌ ' + escHtml(state.errorMsg) + '</div>';
    }

    if (state.scoutingItem) {
      html +=
        '<div style="background:#1e1b4b;border:1px solid #818cf8;border-radius:14px;padding:22px 14px;text-align:center;margin-bottom:10px;">' +
          '<div style="font-size:14px;font-weight:900;color:#e0e7ff;margin-bottom:4px;">⚡ Running AI Speed Scout...</div>' +
          '<div style="font-size:11px;color:#a5b4fc;">Analyzing selected gallery photos, domain fee/BP rules, Hero-Anchor lot pieces &amp; 3-Tier ceilings...</div>' +
        '</div>';
      return html;
    }

    if (state.loadingRestoredDocId) {
      html +=
        '<div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:14px 12px;text-align:center;margin-bottom:10px;color:#a5b4fc;font-size:11.5px;font-weight:800;">' +
          '💾 Restoring saved AI appraisal ($0)...' +
        '</div>';
      return html;
    }

    if (!fin) {
      html +=
        '<div style="background:#020617;border:1px dashed #334155;border-radius:12px;padding:14px 12px;text-align:center;margin-bottom:10px;color:#94a3b8;">' +
          '<div style="font-size:12.5px;font-weight:800;color:#e2e8f0;margin-bottom:4px;">Check Best Close-Up Photos Above ➔ Run AI Speed Scout</div>' +
          '<div style="font-size:11px;line-height:1.45;">Uncheck filler/ruler shots if >12 photos, add optional Reseller Notes, then click <strong>⚡ Run AI Speed Scout</strong> below for full Hero-Anchor Lot Breakdown &amp; Max Bid / Offer math.</div>' +
        '</div>';
      return html;
    }

    // 4. AI Speed Scout Verdict + 3-Tier Bid Matrix Card (Above-the-Fold Compact Layout)
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

    var activeBidNum = parseFloat(state.customMaxBid) || computeActiveMaxBid();
    var activeBpDollars = fin.buyersPremiumPct > 0 ? Math.round(activeBidNum * fin.buyersPremiumPct) / 100 : 0;
    var activeLanded = Math.round((activeBidNum + activeBpDollars + fin.effectiveShip) * 100) / 100;

    var thirdBoxTitle = fin.buyersPremiumPct > 0 ? ('BP (' + fin.buyersPremiumPct + '%) + S&amp;H') : (fin.isLocalPickupOnly ? 'Local Pickup' : 'Est. S&amp;H');
    var thirdBoxVal = fin.buyersPremiumPct > 0
      ? ('$' + (activeBpDollars + fin.effectiveShip).toFixed(2))
      : ('$' + fin.effectiveShip.toFixed(2));
    var thirdBoxSub = fin.buyersPremiumPct > 0
      ? ('+$' + activeBpDollars.toFixed(2) + ' BP + $' + fin.effectiveShip.toFixed(2) + ' ship')
      : fin.isLocalPickupOnly
      ? 'In-Person ($0 S&amp;H)'
      : (fin.combineSavings > 0 ? 'Saved ~$' + fin.combineSavings + ' combine!' : '$' + fin.shipBase.toFixed(2) + ' + $' + fin.shipHandling.toFixed(2) + ' hdl');

    if (fin.visionPhotosScanned === 0) {
      html += '<div style="background:#450a0a;border:1px solid #f87171;color:#fecaca;border-radius:8px;padding:6px 9px;margin-bottom:7px;font-size:10.5px;font-weight:800;line-height:1.35;">⚠️ 0 Photos Reached AI — this report is TEXT-ONLY. Expand Gallery above and tap 🔄 Re-Scan Selected.</div>';
    }

    var inlineVisionPill = (fin.visionPhotosScanned !== null && fin.visionPhotosScanned !== undefined && fin.visionPhotosScanned > 0)
      ? '<span style="background:#052e2b;border:1px solid #34d399;color:#6ee7b7;padding:2px 7px;border-radius:999px;font-size:9.5px;font-weight:800;">📸 ' + fin.visionPhotosScanned + ' Photo' + (fin.visionPhotosScanned === 1 ? '' : 's') + '</span>'
      : '';
    var restoredPill = state.isRestoredSavedReport
      ? '<span style="background:#312e81;border:1px solid #818cf8;color:#e0e7ff;padding:2px 7px;border-radius:999px;font-size:9.5px;font-weight:800;" title="Restored from saved tracker item with zero Gemini API spend">💾 Saved • $0</span>'
      : '';

    html +=
      '<div style="background:#020617;border:1px solid #334155;border-radius:12px;padding:10px 11px;margin-bottom:9px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:7px;">' +
          '<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">' +
            '<span style="background:' + verdictBg + ';color:#fff;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:900;">' +
              verdictIcon + escHtml(fin.verdict) +
            '</span>' +
            inlineVisionPill +
            restoredPill +
          '</div>' +
          (fin.bestPlatform
            ? '<span style="background:#1e293b;color:#cbd5e1;padding:2px 7px;border-radius:7px;font-size:10px;font-weight:800;">' +
                '🏆 ' + escHtml(fin.bestPlatform) +
              '</span>'
            : '') +
        '</div>' +

        // Valuation + S&H / BP 3-box strip
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px;">' +
          '<div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:5px 7px;">' +
            '<div style="font-size:9px;color:#94a3b8;font-weight:800;text-transform:uppercase;">Boutique (Booth)</div>' +
            '<div style="font-size:12px;font-weight:900;color:#34d399;font-family:monospace;">' + escHtml(fin.boutiqueStr) + '</div>' +
            '<div style="font-size:9px;color:#64748b;">Net ~$' + fin.netPayout.toFixed(0) + ' (after 15%)</div>' +
          '</div>' +
          '<div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:5px 7px;">' +
            '<div style="font-size:9px;color:#94a3b8;font-weight:800;text-transform:uppercase;">Fair Online</div>' +
            '<div style="font-size:12px;font-weight:900;color:#93c5fd;font-family:monospace;">' + escHtml(fin.fairStr) + '</div>' +
            '<div style="font-size:9px;color:#64748b;">Sold Comps</div>' +
          '</div>' +
          '<div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:5px 7px;">' +
            '<div style="font-size:9px;color:#94a3b8;font-weight:800;text-transform:uppercase;">' + thirdBoxTitle + '</div>' +
            '<div style="font-size:12px;font-weight:900;color:#fbbf24;font-family:monospace;">' + thirdBoxVal + '</div>' +
            '<div style="font-size:9px;color:#64748b;">' + thirdBoxSub + '</div>' +
          '</div>' +
        '</div>';

    // "At Min/Current Bid" signed P&L strip — 3-state honest color: Red Loss (<0), Amber Thin Margin (<1.7x / allDead), Emerald Active
    if (fin.atCurrentBid) {
      var acbNet = Number(fin.atCurrentBid.netProfit || 0);
      var acbLoss = acbNet < 0;
      var acbThin = !acbLoss && Boolean(fin.allDead);
      var acbBg = acbLoss ? 'rgba(127,29,29,0.35)' : acbThin ? 'rgba(120,53,15,0.38)' : 'rgba(6,95,70,0.32)';
      var acbBorder = acbLoss ? '#f87171' : acbThin ? '#fbbf24' : '#34d399';
      var acbTextCol = acbLoss ? '#fecaca' : acbThin ? '#fef3c7' : '#d1fae5';
      var acbRightCol = acbLoss ? '#f87171' : acbThin ? '#fcd34d' : '#6ee7b7';
      var acbRightLabel = acbLoss
        ? ('-$' + Math.abs(acbNet) + ' Loss')
        : acbThin
        ? ('⚠️ +$' + acbNet + ' Thin (<' + (fin.roiTargets ? fin.roiTargets.aggressive.toFixed(1) : '1.7') + 'x Floor)')
        : ('+$' + acbNet + ' Net');
      var repObj = state.scoutReport || {};
      var unitLandedInline = (Number(repObj.declared_unit_count) >= 2 && Number(repObj.landed_cost_per_unit) > 0)
        ? (' ($' + Number(repObj.landed_cost_per_unit).toFixed(2) + '/unit × ' + Number(repObj.declared_unit_count) + ')')
        : '';
      var bidRefAmt = Number(fin.atCurrentBid.bidRef || fin.floorBid || fin.currentBid || 0);
      var bidRefTitle = fin.atCurrentBid.hasMinFloor ? 'At Min Bid $' : 'At Current Bid $';
      html +=
        '<div style="background:' + acbBg + ';border:1px solid ' + acbBorder + ';border-radius:8px;padding:5px 8px;margin-bottom:7px;display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:10.5px;">' +
          '<span style="color:' + acbTextCol + ';font-weight:800;">' + bidRefTitle + bidRefAmt.toFixed(2) + ' + $' + fin.effectiveShip.toFixed(2) + ' S&amp;H = $' + fin.atCurrentBid.landed.toFixed(2) + ' landed' + escHtml(unitLandedInline) + '</span>' +
          '<span style="font-family:monospace;font-weight:900;color:' + acbRightCol + ';white-space:nowrap;">' + acbRightLabel + '</span>' +
        '</div>';
    }
    if (fin.isFreightTrap) {
      html +=
        '<div style="background:#431407;border:1px solid #fb923c;color:#fed7aa;border-radius:8px;padding:5px 9px;margin-bottom:7px;font-size:10.5px;font-weight:800;line-height:1.35;">' +
          '🚚 Freight Killer: S&amp;H $' + fin.shipTotal.toFixed(2) + ' = ' + fin.freightPct + '% of resale value' +
        '</div>';
    }

    if (fin.targetCashOfferStr) {
      html +=
        '<div style="background:rgba(6,95,70,0.32);border:1px solid #34d399;border-radius:8px;padding:5px 9px;margin-bottom:7px;display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:11px;">' +
          '<span style="color:#d1fae5;font-weight:800;">💵 Cash Negotiation Window:</span>' +
          '<span style="font-family:monospace;font-weight:900;color:#6ee7b7;">' + escHtml(fin.targetCashOfferStr) + '</span>' +
        '</div>';
    }

    var rTargets = fin.roiTargets || { conservative: 3.0, balanced: 2.2, aggressive: 1.7 };
    var tierKeys = [
      { key: 'conservative', label: '🛡️ Conservative', sub: rTargets.conservative.toFixed(1) + 'x ROI' },
      { key: 'balanced', label: '⚖️ Balanced', sub: rTargets.balanced.toFixed(1) + 'x Target' },
      { key: 'aggressive', label: '🔥 Aggressive', sub: rTargets.aggressive.toFixed(1) + 'x Fast' }
    ];

    var rightModeHint = fin.allowSniperCents
      ? '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:10px;color:#a5b4fc;">' +
          '<input type="checkbox" id="rc-scout-proxy-cents" ' + (state.useProxyCents ? 'checked' : '') + ' />' +
          '<span>+.87 Sniper Cents</span>' +
        '</label>'
      : '<span style="font-size:9.5px;color:#fbbf24;font-weight:800;">' +
          (fin.allDead
            ? '🛑 No Profitable Bid'
            : fin.buyersPremiumPct > 0
            ? ('⚡ Auto-Deducts +' + fin.buyersPremiumPct + '% BP')
            : fin.listingMode === 'local_cash'
            ? '💵 Local Cash Tiers'
            : '⏱️ Exact Ceiling') +
        '</span>';

    html += '<div style="font-size:10.5px;font-weight:800;color:#cbd5e1;margin-bottom:5px;display:flex;justify-content:space-between;align-items:center;gap:6px;">' +
      '<span>🎯 Click a Tier Ceiling:</span>' +
      rightModeHint +
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
      var tierLine;
      if (tObj.status === 'ship_exceeds_cap' || tObj.status === 'outbid') {
        tierLine = '<div style="font-size:9.5px;color:#f87171;font-weight:800;line-height:1.25;">' + escHtml(tObj.statusLabel) + '</div>';
      } else {
        tierLine = '<div style="font-size:9.5px;color:' + (tObj.netProfit < 0 ? '#f87171' : '#34d399') + ';font-weight:700;">' +
          (tObj.netProfit < 0 ? '-$' + Math.abs(tObj.netProfit) + ' Loss' : '+$' + tObj.netProfit + ' Net') + ' (' + tk.sub + ')</div>';
      }
      html +=
        '<button type="button" class="rc-tier-pick-btn" data-tier="' + tk.key + '" style="background:' + bgCol + ';border:2px solid ' + borderCol + ';border-radius:10px;padding:7px 6px;text-align:center;cursor:pointer;color:#f8fafc;' + (tObj.passed ? 'opacity:0.88;' : '') + '">' +
          '<div style="font-size:10px;font-weight:800;color:#cbd5e1;">' + tk.label + '</div>' +
          '<div style="font-size:14px;font-weight:900;color:' + (tObj.passed ? '#f87171' : '#a5b4fc') + ';font-family:monospace;margin:2px 0;">' + (tObj.status === 'ship_exceeds_cap' ? 'PASS ($0)' : '$' + tObj.maxBid.toFixed(2)) + '</div>' +
          tierLine +
        '</button>';
    });
    html += '</div>';

    html +=
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;background:#0f172a;border:1px solid #334155;border-radius:10px;padding:7px 10px;">' +
        '<span style="font-size:11px;font-weight:800;color:#e2e8f0;">🎯 ' + escHtml(fin.actionLabel || 'My Target Max Bid') + ' ($):</span>' +
        '<input id="rc-scout-custom-maxbid" type="number" step="0.01" value="' + escHtml(state.customMaxBid || computeActiveMaxBid().toFixed(2)) + '" style="width:105px;background:#1e293b;color:#34d399;border:1px solid #475569;border-radius:8px;padding:4px 8px;font-family:monospace;font-size:13px;font-weight:900;text-align:right;" />' +
      '</div>' +
    '</div>';

    // 5. Make-or-Break Hero-Anchor Lot Breakdown Card (Always Visible When Multi-Item Lot!)
    html += renderLotBreakdownSection(fin, state.scoutReport, activeLanded);

    // 6. Tactical Exit Play & Channel Comparison Card
    html += renderExitChannelsSection(fin, state.scoutReport, activeLanded);

    // 7. Catalyst & Risk Highlights
    html += renderCatalystsSection(fin);

    // 8. Collapsed-by-Default Deep Scout Details (Condition, Red Flags & Comps)
    html += renderConditionCompsSection(state.scoutReport);

    return html;
  }

  function renderTableTrayBody() {
    var bodyHtml = '';
    if (state.loadingPreview) {
      return '<div style="padding:28px 16px;text-align:center;color:#cbd5e1;font-weight:800;background:#1e1b4b;border:1px solid #818cf8;border-radius:12px;">⏳ Building Pre-Flight Reconciliation Queue...</div>';
    }
    if (state.errorMsg) {
      bodyHtml += '<div style="background:#7f1d1d;color:#fecaca;padding:10px 12px;border-radius:10px;margin-bottom:10px;font-weight:700;">❌ ' + escHtml(state.errorMsg) + '</div>';
    }
    if (state.previewData) {
      var pRows = state.previewData.rows || [];
      var trackedCount = 0;
      var newCount = 0;
      var updateCount = 0;
      var existingCount = 0;
      var refundedCount = 0;
      pRows.forEach(function (pr) {
        if (pr.isRefunded || pr.rowCategory === 'REFUNDED') {
          refundedCount++;
          return;
        }
        if (pr.wasTracked || pr.rowCategory === 'PROMOTE_TRACKED') trackedCount++;
        if (pr.rowCategory === 'NEW_ORDER_ITEM') newCount++;
        if (pr.rowCategory === 'UPDATE_TRACKING') updateCount++;
        if (pr.rowCategory === 'EXISTING_SYNCED') existingCount++;
      });
      var validCount = Math.max(0, pRows.length - refundedCount);

      var bannerTitle = state.commitResult
        ? '✅ Sync Committed to Works@TheHC'
        : '🔍 Pre-Flight Reconciliation Queue';
      var bannerBg = state.commitResult ? '#064e3b' : '#1e293b';
      var bannerBorder = state.commitResult ? '#34d399' : '#334155';
      var countPillText = validCount + ' valid' + (refundedCount > 0 ? ' • ' + refundedCount + ' refunded' : '');

      bodyHtml +=
        '<div style="background:' + bannerBg + ';border:1px solid ' + bannerBorder + ';border-radius:10px;padding:9px 10px;margin-bottom:8px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;">' +
            '<span style="font-weight:900;font-size:12px;color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + bannerTitle + '</span>' +
            '<span style="background:#0f172a;color:#cbd5e1;border:1px solid #334155;padding:2px 8px;border-radius:999px;font-family:monospace;font-size:10px;font-weight:800;white-space:nowrap;flex-shrink:0;">' + escHtml(countPillText) + '</span>' +
          '</div>';

      // Ricochet-Style 4-Box Scorecard (Clickable Filter Cards — Never wraps)
      var filters = [
        { key: 'ALL', label: '📋 All', count: pRows.length, color: '#a5b4fc' },
        { key: 'TRACKED', label: '📌 Tracked', count: trackedCount, color: '#34d399' },
        { key: 'ACTIONABLE', label: '🆕 New/Upd', count: newCount + updateCount, color: '#fbbf24' },
        { key: 'EXISTING', label: '✅ Synced', count: existingCount, color: '#38bdf8' }
      ];

      bodyHtml += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:8px;">';
      filters.forEach(function (f) {
        var active = state.tableFilter === f.key;
        bodyHtml +=
          '<button type="button" class="rc-table-filter-btn" data-filter="' + f.key + '" style="background:' + (active ? '#1e1b4b' : '#0f172a') + ';border:1.5px solid ' + (active ? '#818cf8' : '#334155') + ';border-radius:8px;padding:6px 4px;text-align:center;cursor:pointer;color:#f8fafc;min-width:0;">' +
            '<div style="font-size:9.5px;color:#cbd5e1;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + f.label + '</div>' +
            '<div style="font-size:14px;font-weight:900;color:' + f.color + ';font-family:monospace;margin-top:2px;line-height:1.1;">' + f.count + '</div>' +
          '</button>';
      });
      bodyHtml += '</div>';

      // Quick Selection Toolbar inside Pre-Flight Card
      var selectedCount = getSelectedRowKeysArray().length;
      bodyHtml +=
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;background:#0f172a;border:1px solid #1e293b;padding:5px 8px;border-radius:7px;font-size:10.5px;">' +
          '<span style="font-weight:800;color:#e2e8f0;white-space:nowrap;">☑️ Selected: <strong style="color:#34d399;">' + selectedCount + '</strong> / ' + validCount + '</span>' +
          '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">' +
            '<button type="button" id="rc-select-tracked-btn" style="background:#312e81;color:#e0e7ff;border:0;border-radius:5px;padding:3px 7px;font-size:10px;font-weight:800;cursor:pointer;white-space:nowrap;">📌 Tracked</button>' +
            '<button type="button" id="rc-select-actionable-btn" style="background:#065f46;color:#d1fae5;border:0;border-radius:5px;padding:3px 7px;font-size:10px;font-weight:800;cursor:pointer;white-space:nowrap;">⚡ Actionable</button>' +
            '<button type="button" id="rc-select-none-btn" style="background:#334155;color:#cbd5e1;border:0;border-radius:5px;padding:3px 7px;font-size:10px;font-weight:800;cursor:pointer;white-space:nowrap;">Clear</button>' +
          '</div>' +
        '</div>' +
      '</div>';

      var visibleRows = pRows.filter(function (pr) {
        if (state.tableFilter === 'TRACKED') return Boolean(pr.wasTracked || pr.rowCategory === 'PROMOTE_TRACKED');
        if (state.tableFilter === 'ACTIONABLE') return pr.rowCategory !== 'EXISTING_SYNCED' && pr.rowCategory !== 'REFUNDED' && !pr.isRefunded;
        if (state.tableFilter === 'EXISTING') return pr.rowCategory === 'EXISTING_SYNCED';
        return true;
      });

      if (visibleRows.length === 0) {
        bodyHtml += '<div style="padding:18px;text-align:center;color:#94a3b8;background:#020617;border-radius:10px;border:1px dashed #334155;">No rows match the selected filter.</div>';
      } else {
        bodyHtml += '<div style="background:#020617;border:1px solid #1e293b;border-radius:10px;padding:4px 8px;margin-bottom:10px;">';
        visibleRows.forEach(function (pr) {
          var rk = pr.rowKey || (pr.orderId ? pr.orderId + ':' + pr.itemId : pr.itemId);
          var isRefunded = Boolean(pr.isRefunded || pr.rowCategory === 'REFUNDED');
          var isChecked = !isRefunded && Boolean(state.selectedRowKeys[rk]);
          var badgesHtml = '';
          if (isRefunded) {
            badgesHtml += '<span style="background:#7f1d1d;color:#fecaca;border:1px solid #f87171;padding:1px 6px;border-radius:5px;font-size:9.5px;font-weight:800;white-space:nowrap;">🚫 REFUNDED — IGNORED</span> ';
          } else {
            if (pr.wasTracked) {
              badgesHtml += '<span style="background:#4f46e5;color:#e0e7ff;padding:1px 6px;border-radius:5px;font-size:9.5px;font-weight:800;white-space:nowrap;">📌 FROM TRACKER' + (pr.trackerLabel ? ' (' + escHtml(pr.trackerLabel) + ')' : '') + '</span> ';
            }
            if (pr.rowCategory === 'EXISTING_SYNCED') {
              var poLabel = pr.existingPoNumber || (pr.orderId ? 'PO-' + String(pr.orderId).slice(-6) : 'Synced');
              if (pr.existingPoId) {
                badgesHtml += '<a href="' + state.activeOrigin + '/purchases/' + escHtml(pr.existingPoId) + '" target="_blank" style="background:#065f46;color:#d1fae5;padding:1px 6px;border-radius:5px;font-size:9.5px;font-weight:800;text-decoration:none;white-space:nowrap;">✅ ' + escHtml(poLabel) + ' ↗</a> ';
              } else {
                badgesHtml += '<span style="background:#065f46;color:#d1fae5;padding:1px 6px;border-radius:5px;font-size:9.5px;font-weight:800;white-space:nowrap;">✅ ' + escHtml(poLabel) + '</span> ';
              }
            } else if (pr.rowCategory === 'NEW_ORDER_ITEM') {
              badgesHtml += '<span style="background:#78350f;color:#fef3c7;padding:1px 6px;border-radius:5px;font-size:9.5px;font-weight:800;white-space:nowrap;">🆕 NEW ITEM</span> ';
            } else if (pr.rowCategory === 'UPDATE_TRACKING') {
              badgesHtml += '<span style="background:#0369a1;color:#e0f2fe;padding:1px 6px;border-radius:5px;font-size:9.5px;font-weight:800;white-space:nowrap;">🚚 TRACKING UPD</span> ';
            }
          }

          var rightText = pr.detail || ('$' + Number(pr.currentPrice || pr.landedCost || 0).toFixed(2) + ' • ' + pr.action);
          bodyHtml +=
            '<label style="padding:7px 2px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:flex-start;gap:8px;font-size:11px;cursor:' + (isRefunded ? 'not-allowed' : 'pointer') + ';' + (isRefunded ? 'opacity:0.55;' : '') + '">' +
              '<input type="checkbox" class="rc-row-select-cb" data-rowkey="' + escHtml(rk) + '" ' + (isChecked ? 'checked ' : '') + (isRefunded ? 'disabled ' : '') + 'style="margin-top:3px;cursor:' + (isRefunded ? 'not-allowed' : 'pointer') + ';flex-shrink:0;" />' +
              '<div style="min-width:0;flex:1;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:2px;">' +
                  '<span style="font-family:monospace;font-size:10px;color:#94a3b8;white-space:nowrap;">#' + escHtml(pr.itemId) + (pr.orderId && pr.orderId !== pr.itemId ? ' • Order #' + escHtml(pr.orderId) : '') + '</span>' +
                  '<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">' + badgesHtml + '</div>' +
                '</div>' +
                '<div style="font-weight:800;color:' + (isRefunded ? '#fca5a5;text-decoration:line-through' : '#f8fafc') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escHtml(pr.title) + '">' + escHtml(pr.title) + '</div>' +
                '<div style="font-family:monospace;font-size:10px;color:' + (isRefunded ? '#fca5a5' : '#93c5fd') + ';margin-top:2px;">' + escHtml(rightText) + '</div>' +
              '</div>' +
            '</label>';
        });
        bodyHtml += '</div>';
      }
      return bodyHtml;
    }

    return (
      '<div style="padding:14px;background:#1e293b;border-radius:12px;margin-bottom:10px;color:#cbd5e1;">' +
        'Detected <strong>' + state.rows.length + '</strong> row(s) on <code>' + escHtml(state.pageType) + '</code> (' +
        (state.csvHarvested ? 'from Full CSV with complete titles' : 'from visible table') +
        '). Click <strong>🔍 Preview Queue</strong> below to inspect tracked items and existing orders before syncing to Works@TheHC.' +
      '</div>'
    );
  }

  function isSgwTableSyncMode() {
    return (
      !state.inspectingGridItem &&
      (state.pageType === 'shipped-orders' ||
        state.pageType === 'inprogress-auctions' ||
        state.pageType === 'closed-auctions')
    );
  }

  function isActionableUrlMode() {
    return isItemScoutMode() || isSgwTableSyncMode();
  }

  function countGridLocalSynergies() {
    var combineCount = 0;
    var trackedCount = 0;
    (state.gridCards || []).forEach(function (c) {
      if (lookupWatchlistForItem(c)) trackedCount++;
      if (c.seller) {
        var syn = evaluateSellerSynergy(c.seller, c.shippingWeightLbs || 1.5, c.itemId, c.domainKey);
        if (syn && syn.isEligible) combineCount++;
      }
    });
    return { combineCount: combineCount, trackedCount: trackedCount };
  }

  function renderAuctionSweepTrayBody() {
    var html = '';
    if (state.errorMsg) {
      html += '<div style="background:#7f1d1d;color:#fecaca;padding:9px 11px;border-radius:10px;margin-bottom:9px;font-weight:700;font-size:11px;">❌ ' + escHtml(state.errorMsg) + '</div>';
    }

    if (state.sweepingGrid) {
      html +=
        '<div style="background:#1e1b4b;border:1.5px solid #818cf8;border-radius:14px;padding:22px 14px;text-align:center;margin-bottom:10px;">' +
          '<div style="font-size:22px;margin-bottom:6px;">🕸️</div>' +
          '<div style="font-size:13.5px;font-weight:900;color:#e0e7ff;margin-bottom:4px;">' +
            escHtml(state.sweepProgressMsg || 'Sweeping Active Auction Grid...') +
          '</div>' +
          '<div style="font-size:11px;color:#a5b4fc;line-height:1.45;">Evaluating live channel net margins (🔮 Memory Den, 🐯 Dusty Tiger &lt;8&quot; smalls, 🌐 eBay / Poshmark), 📦 Combined Shipping &amp; 👀 Sleeper lot thumbnails...</div>' +
        '</div>';
      return html;
    }

    var cards = state.gridCards || [];
    var localCounts = countGridLocalSynergies();

    if (!state.sweepData || !Array.isArray(state.sweepData.lots)) {
      var platLabel = (cards[0] && cards[0].platformName) || (isShopGoodwillHost() ? 'ShopGoodwill' : 'Active Grid');
      var sweepCapCount = Math.min(40, cards.length);
      var sampleHtml = cards
        .slice(0, 4)
        .map(function (c) {
          var wl = lookupWatchlistForItem(c);
          var syn = c.seller ? evaluateSellerSynergy(c.seller, c.shippingWeightLbs || 1.5, c.itemId, c.domainKey) : null;
          return (
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;padding:5px 0;border-bottom:1px dashed rgba(255,255,255,0.06);font-size:10.5px;">' +
              '<span style="color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1;">' +
                (wl ? '📌 ' : (syn && syn.isEligible ? '📦 ' : '• ')) +
                escHtml(c.title) +
              '</span>' +
              '<span style="font-family:monospace;color:#38bdf8;font-weight:800;white-space:nowrap;">$' + Number(c.currentPrice || c.minimumBid || 0).toFixed(2) + '</span>' +
            '</div>'
          );
        })
        .join('');

      html +=
        '<div style="background:linear-gradient(145deg,#1e1b4b,#0f172a);border:1px solid #4f46e5;border-radius:12px;padding:13px 12px;margin-bottom:10px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:6px;">' +
            '<span style="font-size:13px;font-weight:900;color:#f8fafc;">🕸️ Auction Sweep Ready</span>' +
            '<span style="background:#312e81;color:#e0e7ff;padding:2px 8px;border-radius:999px;font-family:monospace;font-size:10.5px;font-weight:900;">' +
              cards.length + ' Active Lots' +
            '</span>' +
          '</div>' +
          '<div style="font-size:11px;color:#cbd5e1;line-height:1.45;margin-bottom:8px;">' +
            'Detected <strong>' + cards.length + '</strong> live ' + escHtml(platLabel) + ' listings. One sweep triages up to <strong>' + sweepCapCount + '</strong> lots against your booth &amp; online fees, combined-shipping branches, and sleeper cover photos.' +
          '</div>' +
          ((localCounts.combineCount > 0 || localCounts.trackedCount > 0)
            ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">' +
                (localCounts.combineCount > 0
                  ? '<span style="background:#064e3b;color:#6ee7b7;border:1px solid #34d399;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:900;">📦 ' + localCounts.combineCount + ' Combine Match' + (localCounts.combineCount === 1 ? '' : 'es') + ' ($0 Instant)</span>'
                  : '') +
                (localCounts.trackedCount > 0
                  ? '<span style="background:#312e81;color:#c7d2fe;border:1px solid #818cf8;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:900;">📌 ' + localCounts.trackedCount + ' Already Tracked</span>'
                  : '') +
              '</div>'
            : '') +
          (sampleHtml
            ? '<div style="background:#020617;border:1px solid #1e293b;border-radius:8px;padding:6px 9px;">' +
                '<div style="font-size:9.5px;font-weight:800;color:#94a3b8;text-transform:uppercase;margin-bottom:3px;">Detected Page Sample</div>' +
                sampleHtml +
              '</div>'
            : '') +
        '</div>';
      return html;
    }

    var sum = state.sweepData.summary || {};
    var allLots = state.sweepData.lots || [];
    var hotCount = Number(sum.hotFlipCount || 0);
    var combCount = Number(sum.combinePlayCount || 0);
    var sleepCount = Number(sum.sleeperCount || 0);
    var hitCount = hotCount + combCount + sleepCount;

    var sweepFilters = [
      { key: 'HITS', label: '🎯 Hits', count: hitCount, color: '#34d399' },
      { key: 'HOT', label: '🔥 Hot', count: hotCount, color: '#fbbf24' },
      { key: 'COMBINE', label: '📦 Combine', count: combCount, color: '#2dd4bf' },
      { key: 'ALL', label: '📋 All', count: allLots.length, color: '#a5b4fc' }
    ];

    var extraLoadedCount = Math.max(0, cards.length - Number(state.sweepData.sweptCount || allLots.length));

    html +=
      '<div style="background:#1e293b;border:1px solid #334155;border-radius:11px;padding:9px 10px;margin-bottom:8px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:7px;">' +
          '<span style="font-weight:900;font-size:12px;color:#f8fafc;">🕸️ Sweep Leaderboard</span>' +
          '<div style="display:flex;align-items:center;gap:5px;">' +
            (Number(sum.visionThumbnailsUsed || 0) > 0
              ? '<span style="background:#052e2b;color:#6ee7b7;border:1px solid #34d399;padding:1px 7px;border-radius:999px;font-size:9.5px;font-weight:800;">📸 ' + sum.visionThumbnailsUsed + ' Sleeper Thumbs</span>'
              : '') +
            '<span style="background:#0f172a;color:#cbd5e1;border:1px solid #334155;padding:1px 7px;border-radius:999px;font-family:monospace;font-size:10px;font-weight:800;">' +
              allLots.length + ' Scored' +
            '</span>' +
          '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:7px;">';

    sweepFilters.forEach(function (sf) {
      var isAct = state.sweepFilter === sf.key;
      html +=
        '<button type="button" class="rc-sweep-filter-btn" data-sfilter="' + sf.key + '" style="background:' + (isAct ? '#1e1b4b' : '#0f172a') + ';border:1.5px solid ' + (isAct ? '#818cf8' : '#334155') + ';border-radius:8px;padding:6px 4px;text-align:center;cursor:pointer;color:#f8fafc;min-width:0;">' +
          '<div style="font-size:9.5px;color:#cbd5e1;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + sf.label + '</div>' +
          '<div style="font-size:14px;font-weight:900;color:' + sf.color + ';font-family:monospace;margin-top:2px;line-height:1.1;">' + sf.count + '</div>' +
        '</button>';
    });

    html +=
        '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;background:#0f172a;border:1px solid #1e293b;padding:5px 8px;border-radius:7px;font-size:10.5px;">' +
          '<label style="display:inline-flex;align-items:center;gap:5px;cursor:pointer;color:#cbd5e1;font-weight:800;">' +
            '<input type="checkbox" id="rc-sweep-dim-toggle" ' + (state.dimPassedCards ? 'checked' : '') + ' />' +
            '<span>🌘 Dim Passed Lots on Webpage (' + Number(sum.passCount || 0) + ')</span>' +
          '</label>' +
          (extraLoadedCount > 0
            ? '<span style="color:#fbbf24;font-weight:800;font-size:10px;white-space:nowrap;">+' + extraLoadedCount + ' scrolled</span>'
            : '') +
        '</div>' +
      '</div>';

    var visibleLots = allLots.filter(function (l) {
      if (state.sweepFilter === 'HITS') return l.verdictBucket !== 'PASS';
      if (state.sweepFilter === 'HOT') return l.verdictBucket === 'HOT_FLIP';
      if (state.sweepFilter === 'COMBINE') return l.verdictBucket === 'COMBINE_PLAY';
      return true;
    });

    if (visibleLots.length === 0) {
      html +=
        '<div style="padding:18px 12px;text-align:center;color:#94a3b8;background:#020617;border-radius:10px;border:1px dashed #334155;margin-bottom:8px;">' +
          '<div style="font-weight:800;color:#e2e8f0;margin-bottom:3px;">No lots in this filter bucket.</div>' +
          '<div style="font-size:10.5px;">Click <strong>📋 All (' + allLots.length + ')</strong> above to inspect why items were skipped, or navigate to the next page of auctions.</div>' +
        '</div>';
      return html;
    }

    html += '<div style="display:flex;flex-direction:column;gap:7px;margin-bottom:8px;">';
    visibleLots.forEach(function (lot) {
      var wl = lookupWatchlistForItem(lot);
      var isHot = lot.verdictBucket === 'HOT_FLIP';
      var isComb = lot.verdictBucket === 'COMBINE_PLAY';
      var isSleep = lot.verdictBucket === 'SLEEPER';
      var cardBorder = isHot ? '#10b981' : isComb ? '#2dd4bf' : isSleep ? '#818cf8' : '#334155';
      var badgeBg = isHot ? '#065f46' : isComb ? '#115e59' : isSleep ? '#312e81' : '#334155';
      var badgeCol = isHot ? '#d1fae5' : isComb ? '#ccfbf1' : isSleep ? '#e0e7ff' : '#cbd5e1';

      var netNum = Number(lot.netProfitAtCurrentUsd || 0);
      var netCol = netNum < 0 ? '#f87171' : lot.verdictBucket === 'PASS' ? '#fcd34d' : '#34d399';
      var netTxt = (netNum >= 0 ? '+$' : '-$') + Math.round(Math.abs(netNum)) + ' Net';

      var shipSummary = lot.isLocalPickupOnly
        ? '$0 Pickup'
        : (lot.combineSavingsUsd > 0
          ? ('$' + lot.effectiveShipUsd.toFixed(2) + ' S&amp;H (Saved $' + lot.combineSavingsUsd + '!)')
          : ('$' + lot.effectiveShipUsd.toFixed(2) + ' S&amp;H'));
      var bpNote = lot.buyersPremiumPct > 0 ? (' +' + lot.buyersPremiumPct + '% BP') : '';
      var priceRefLabel = lot.minimumBid > lot.currentPrice ? ('Min $' + lot.floorBid.toFixed(2)) : ('$' + lot.floorBid.toFixed(2));
      var metaRightBits = [];
      if (lot.bidCount !== null && lot.bidCount !== undefined) metaRightBits.push(lot.bidCount + ' bid' + (lot.bidCount === 1 ? '' : 's'));
      if (lot.timeLeft) metaRightBits.push(lot.timeLeft);

      var isSavingThis = state.quickTrackingKey === lot.lotKey;
      var trackBtnLabel = isSavingThis
        ? '⏳ Saving...'
        : wl
        ? ('✅ Tracked' + (wl.maxBid > 0 ? ' ($' + Number(wl.maxBid).toFixed(2) + ')' : ''))
        : (lot.balancedMaxBidUsd > 0 ? ('📌 Track ($' + lot.balancedMaxBidUsd.toFixed(2) + ')') : '📌 Watch');

      html +=
        '<div style="background:#020617;border:1.5px solid ' + cardBorder + ';border-radius:11px;padding:8px 9px;">' +
          '<div style="display:flex;gap:8px;align-items:flex-start;">' +
            (lot.thumbnailUrl
              ? '<img src="' + escHtml(lot.thumbnailUrl) + '" alt="" style="width:48px;height:48px;border-radius:7px;object-fit:cover;background:#0f172a;border:1px solid #1e293b;flex-shrink:0;" />'
              : '<div style="width:48px;height:48px;border-radius:7px;background:#0f172a;border:1px solid #1e293b;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">📦</div>') +
            '<div style="min-width:0;flex:1;">' +
              '<div style="display:flex;justify-content:space-between;align-items:center;gap:4px;flex-wrap:wrap;margin-bottom:3px;">' +
                '<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">' +
                  '<span style="background:' + badgeBg + ';color:' + badgeCol + ';padding:1px 6px;border-radius:999px;font-size:9.5px;font-weight:900;white-space:nowrap;">' + escHtml(lot.verdictLabel) + '</span>' +
                  '<span style="background:#1e293b;color:#e2e8f0;padding:1px 6px;border-radius:6px;font-size:9.5px;font-weight:800;white-space:nowrap;">' + escHtml(lot.bestChannelLabel) + '</span>' +
                  (lot.visionThumbUsed ? '<span title="Thumbnail analyzed by Gemini Vision" style="background:#052e2b;color:#6ee7b7;padding:1px 5px;border-radius:5px;font-size:9px;font-weight:800;">📸</span>' : '') +
                '</div>' +
                (metaRightBits.length > 0
                  ? '<span style="font-size:9.5px;color:#94a3b8;font-family:monospace;white-space:nowrap;">' + escHtml(metaRightBits.join(' • ')) + '</span>'
                  : '') +
              '</div>' +
              '<a href="' + escHtml(lot.sourceUrl) + '" target="_blank" rel="noopener noreferrer" style="display:block;font-weight:800;font-size:11.5px;color:#f8fafc;text-decoration:none;line-height:1.3;">' +
                escHtml(lot.title) + ' <span style="color:#818cf8;font-size:10px;">↗</span>' +
              '</a>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;background:#0f172a;border:1px solid #1e293b;border-radius:7px;padding:4px 7px;margin-top:6px;font-family:monospace;font-size:10px;">' +
            '<span style="color:#cbd5e1;">' + escHtml(priceRefLabel + bpNote) + ' + ' + shipSummary + '</span>' +
            '<span style="font-weight:900;color:' + netCol + ';white-space:nowrap;">Est. ~$' + Math.round(lot.estGrossMid) + ' ➔ ' + netTxt + (lot.balancedMaxBidUsd > 0 ? ' • Max $' + lot.balancedMaxBidUsd.toFixed(2) : '') + '</span>' +
          '</div>' +
          (lot.splitPlayHint
            ? '<div style="font-size:10px;color:#fde68a;margin-top:4px;font-weight:800;">👑 ' + escHtml(lot.splitPlayHint) + '</div>'
            : '') +
          (lot.oneLineWhy
            ? '<div style="font-size:10px;color:#94a3b8;margin-top:3px;line-height:1.3;">💡 ' + escHtml(lot.oneLineWhy) + '</div>'
            : '') +
          '<div style="display:flex;align-items:center;gap:5px;margin-top:6px;">' +
            '<button type="button" class="rc-sweep-open-scout-btn" data-lotkey="' + escHtml(lot.lotKey) + '" style="flex:1.15;background:#4f46e5;color:#fff;border:0;border-radius:7px;padding:5px 7px;font-size:10.5px;font-weight:900;cursor:pointer;white-space:nowrap;">⚡ Full Scout</button>' +
            '<button type="button" class="rc-sweep-quick-track-btn" data-lotkey="' + escHtml(lot.lotKey) + '" ' + (isSavingThis ? 'disabled ' : '') + 'style="flex:1.15;background:' + (wl ? '#065f46' : '#0f766e') + ';color:#ecfdf5;border:1px solid #34d399;border-radius:7px;padding:5px 7px;font-size:10.5px;font-weight:900;cursor:pointer;white-space:nowrap;">' + escHtml(trackBtnLabel) + '</button>' +
            '<button type="button" class="rc-sweep-find-card-btn" data-lotkey="' + escHtml(lot.lotKey) + '" title="Scroll webpage to this lot card" style="background:#1e293b;color:#cbd5e1;border:1px solid #334155;border-radius:7px;padding:5px 8px;font-size:10.5px;font-weight:800;cursor:pointer;white-space:nowrap;">🎯 Find</button>' +
          '</div>' +
        '</div>';
    });
    html += '</div>';
    return html;
  }

  function renderBrowseIdleBody() {
    return (
      '<div style="padding:18px 14px;background:#1e293b;border:1px solid #334155;border-radius:12px;margin-bottom:10px;color:#cbd5e1;text-align:center;">' +
        '<div style="font-size:22px;margin-bottom:6px;">🧭</div>' +
        '<div style="font-size:13px;font-weight:900;color:#f8fafc;margin-bottom:4px;">Browse Mode — Watching URL Changes</div>' +
        '<div style="font-size:11px;line-height:1.45;color:#94a3b8;">Click any item listing (ShopGoodwill, eBay, FB Marketplace, HiBid, CTBids, Poshmark) or open ShopGoodwill <strong>Shipped Orders</strong> / <strong>In-Progress Auctions</strong> — this drawer (or the <strong>▾ Pill</strong> bar) will switch modes automatically!</div>' +
      '</div>'
    );
  }

  function renderUI() {
    var auth = window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.getSession ? window.__RC_BML_AUTH__.getSession() : null;
    var toolCfg = getBmlToolConfig();

    var itemRow = isItemScoutMode() ? getActiveItemRow() : null;
    var existingWl = itemRow ? lookupWatchlistForItem(itemRow) : null;
    var pillSynergy = itemRow ? evaluateSellerSynergy(itemRow.seller, itemRow.shippingWeight, itemRow.itemId, itemRow.domainKey) : null;
    var gridLocalCounts = isAuctionSweepMode() ? countGridLocalSynergies() : { combineCount: 0, trackedCount: 0 };

    var curPriceNum = itemRow ? Number(itemRow.currentPrice || 0) : 0;
    var minBidNum = itemRow ? Number(itemRow.minimumBid || curPriceNum) : 0;
    var hasMinFloorPill = Boolean(itemRow && minBidNum > curPriceNum && (isShopGoodwillHost() || itemRow.isAuction));
    var livePriceChipText = curPriceNum > 0
      ? ('$' + curPriceNum.toFixed(2) + (hasMinFloorPill ? ' • Min $' + minBidNum.toFixed(2) : ''))
      : '';

    // 1. Mutually-Exclusive Bottom-Right Trigger Pill (#rc-scout-fab-bar) — Hidden via display:none whenever Drawer is open!
    var bar = document.getElementById('rc-scout-fab-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'rc-scout-fab-bar';
      bar.className = 'rc-bml-pill-bar';
      bar.setAttribute('data-rc-bml-shell', 'auction_scout');
      bar.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:2147483647;display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#1e1b4b,#0f172a);color:#f8fafc;border:2px solid #818cf8;border-radius:999px;padding:6px 12px;box-shadow:0 16px 32px rgba(0,0,0,0.55);font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:800;';
      document.body.appendChild(bar);
    }

    var combinePillBadge = pillSynergy && pillSynergy.isEligible
      ? '<span style="background:#065f46;color:#6ee7b7;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:900;white-space:nowrap;">📦 Combine (+' + pillSynergy.matchCount + ')</span>'
      : (isAuctionSweepMode() && gridLocalCounts.combineCount > 0)
      ? '<span style="background:#065f46;color:#6ee7b7;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:900;white-space:nowrap;">📦 ' + gridLocalCounts.combineCount + ' Combine</span>'
      : '';

    var trackedPillBadge = existingWl
      ? '<span style="background:#065f46;color:#d1fae5;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:800;white-space:nowrap;">📌 Tracked</span>'
      : (isAuctionSweepMode() && gridLocalCounts.trackedCount > 0)
      ? '<span style="background:#312e81;color:#c7d2fe;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:800;white-space:nowrap;">📌 ' + gridLocalCounts.trackedCount + '</span>'
      : '';

    var sweepHitsTotal = (state.sweepData && state.sweepData.summary)
      ? (Number(state.sweepData.summary.hotFlipCount || 0) + Number(state.sweepData.summary.combinePlayCount || 0) + Number(state.sweepData.summary.sleeperCount || 0))
      : 0;

    var pillCountBadge = isItemScoutMode()
      ? '<span style="background:#312e81;color:#e0e7ff;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:800;font-family:monospace;white-space:nowrap;">' +
          (livePriceChipText ? escHtml(livePriceChipText) : ('⚡ ' + escHtml(!isShopGoodwillHost() && itemRow && itemRow.platformName ? itemRow.platformName : 'Scout'))) +
        '</span>'
      : isAuctionSweepMode()
      ? (state.sweepData
          ? '<span style="background:#065f46;color:#6ee7b7;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:900;font-family:monospace;white-space:nowrap;">🎯 ' + sweepHitsTotal + ' Hit' + (sweepHitsTotal === 1 ? '' : 's') + '</span>'
          : '<span style="background:#312e81;color:#e0e7ff;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:800;font-family:monospace;white-space:nowrap;">🕸️ ' + (state.gridCards ? state.gridCards.length : 0) + ' Lots</span>')
      : state.pageType === 'other'
      ? '<span style="background:#1e293b;color:#cbd5e1;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:800;white-space:nowrap;">🧭 Browse</span>'
      : '<span style="background:#312e81;color:#e0e7ff;padding:2px 8px;border-radius:999px;font-size:10.5px;font-family:monospace;white-space:nowrap;">' + state.rows.length + (state.csvHarvested ? ' CSV' : ' Rows') + '</span>';

    var pillSweepQuickBtn = isAuctionSweepMode() && !state.sweepData
      ? '<button id="rc-pill-run-sweep-btn" title="Sweep Page for Profitable Flips" style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:0;border-radius:999px;padding:3px 9px;font-size:10.5px;font-weight:900;cursor:pointer;white-space:nowrap;">' +
          (state.sweepingGrid ? '⏳ Sweeping...' : '🕸️ Sweep') +
        '</button>'
      : '';

    var signInOrRolePill = auth
      ? '<span style="color:#a5b4fc;font-size:11px;white-space:nowrap;">' + escHtml(auth.roleBadge || '👑') + '</span>' +
        '<button id="rc-scout-pill-logout-btn" title="Log Out of Bookmarklet" style="background:transparent;color:#fca5a5;border:0;padding:2px 4px;font-size:11px;cursor:pointer;">🚪</button>'
      : '<button id="rc-scout-signin-btn" style="background:#f59e0b;color:#1e1b18;border:0;border-radius:999px;padding:3px 9px;font-size:11px;font-weight:900;cursor:pointer;white-space:nowrap;">🔐 Sign In</button>';

    bar.innerHTML =
      '<span id="rc-sync-fab" style="display:none;"></span>' +
      '<button id="rc-scout-toggle-btn" title="Open 100dvh Auction Scout Drawer" style="background:transparent;border:0;color:#f8fafc;cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:2px 4px;font-weight:800;font-size:12px;">' +
        '<span>' + escHtml(toolCfg.title || '🔭 RC Scout') + ' ▴</span>' +
        pillCountBadge +
        combinePillBadge +
        trackedPillBadge +
      '</button>' +
      pillSweepQuickBtn +
      signInOrRolePill;

    // Enforce strict mutual exclusivity: hide bottom-right Pill Bar when Drawer is open (keeping DOM node mounted for clientCore auth guard)
    bar.style.display = state.trayOpen ? 'none' : 'inline-flex';
    bar.setAttribute('data-drawer-open', state.trayOpen ? 'true' : 'false');

    var toggleBtn = document.getElementById('rc-scout-toggle-btn');
    if (toggleBtn) {
      toggleBtn.onclick = function () {
        state.trayOpen = true;
        if (isSgwTableSyncMode() && !state.previewData && !state.loadingPreview) {
          runPreviewOrSync(true);
          return;
        }
        renderUI();
      };
    }

    var pillSweepBtn = document.getElementById('rc-pill-run-sweep-btn');
    if (pillSweepBtn && !state.sweepingGrid) {
      pillSweepBtn.onclick = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        runAuctionSweep();
      };
    }

    var pillLogoutBtn = document.getElementById('rc-scout-pill-logout-btn');
    if (pillLogoutBtn) {
      pillLogoutBtn.onclick = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        if (window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.clearSession) {
          window.__RC_BML_AUTH__.clearSession();
        }
        renderUI();
      };
    }

    var signInBtn = document.getElementById('rc-scout-signin-btn');
    if (signInBtn) {
      signInBtn.onclick = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        if (window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.openConnectFlow) {
          window.__RC_BML_AUTH__.openConnectFlow(false);
        }
      };
    }

    // 2. Full-Height Right-Side Slide-Over Drawer (#rc-scout-tray — 100dvh, Frozen Top Header)
    var tray = document.getElementById('rc-scout-tray');
    if (!state.trayOpen) {
      if (tray) tray.remove();
      return;
    }

    if (!document.getElementById('rc-scout-tray-styles')) {
      var styleEl = document.createElement('style');
      styleEl.id = 'rc-scout-tray-styles';
      styleEl.textContent =
        '#rc-scout-tray, #rc-scout-tray * { box-sizing: border-box; }' +
        '#rc-scout-tray-body, #rc-scout-tray .rc-scout-scroll { scrollbar-width: thin; scrollbar-color: #334155 transparent; }' +
        '#rc-scout-tray-body::-webkit-scrollbar, #rc-scout-tray .rc-scout-scroll::-webkit-scrollbar { width: 5px; height: 5px; }' +
        '#rc-scout-tray-body::-webkit-scrollbar-track, #rc-scout-tray .rc-scout-scroll::-webkit-scrollbar-track { background: transparent; }' +
        '#rc-scout-tray-body::-webkit-scrollbar-thumb, #rc-scout-tray .rc-scout-scroll::-webkit-scrollbar-thumb { background: #334155; border-radius: 999px; }' +
        '#rc-scout-tray .rc-btn-pill { display: inline-flex; align-items: center; justify-content: center; gap: 4px; white-space: nowrap; flex-shrink: 0; height: 27px; padding: 0 8px; border-radius: 7px; font-size: 10.5px; font-weight: 800; line-height: 1; text-decoration: none; cursor: pointer; }' +
        '.rc-sweep-dimmed:hover { opacity: 0.94 !important; transition: opacity 0.15s ease; }';
      document.head.appendChild(styleEl);
    }

    if (!tray) {
      tray = document.createElement('div');
      tray.id = 'rc-scout-tray';
      tray.className = 'rc-bml-drawer';
      tray.setAttribute('data-rc-bml-shell', 'auction_scout');
      tray.style.cssText = 'position:fixed;top:0;right:0;bottom:0;height:100dvh;width:456px;max-width:95vw;z-index:2147483646;background:#0f172a;color:#f8fafc;border-left:2px solid #818cf8;box-shadow:-16px 0 48px rgba(0,0,0,0.65);display:flex;flex-direction:column;font-family:system-ui,-apple-system,sans-serif;font-size:12px;line-height:1.45;';
      document.body.appendChild(tray);
    }

    var sourceBadge = state.inspectingGridItem
      ? '<span style="background:#312e81;color:#e0e7ff;padding:2px 7px;border-radius:6px;font-size:10px;font-weight:800;white-space:nowrap;flex-shrink:0;">⚡ Grid Scout ' + escHtml((itemRow && itemRow.displayBadgeId) || '') + '</span>'
      : state.pageType === 'external-item'
      ? '<span style="background:#312e81;color:#e0e7ff;padding:2px 7px;border-radius:6px;font-size:10px;font-weight:800;white-space:nowrap;flex-shrink:0;">🌐 ' + escHtml((itemRow && itemRow.platformName) || 'Web Listing') + '</span>'
      : state.pageType === 'item'
      ? '<span style="background:#312e81;color:#e0e7ff;padding:2px 7px;border-radius:6px;font-size:10px;font-weight:800;white-space:nowrap;flex-shrink:0;">⚡ SGW #' + escHtml((itemRow && itemRow.itemId) || '') + '</span>'
      : isAuctionSweepMode()
      ? '<span style="background:#312e81;color:#e0e7ff;padding:2px 7px;border-radius:6px;font-size:10px;font-weight:900;white-space:nowrap;flex-shrink:0;">🕸️ Auction Sweep (' + (state.gridCards ? state.gridCards.length : 0) + ')</span>'
      : state.pageType === 'other'
      ? '<span style="background:#1e293b;color:#cbd5e1;padding:2px 7px;border-radius:6px;font-size:10px;font-weight:800;white-space:nowrap;flex-shrink:0;">🧭 Browse Watcher</span>'
      : state.csvHarvested
      ? '<span style="background:#065f46;color:#d1fae5;padding:2px 7px;border-radius:6px;font-size:10px;font-weight:800;white-space:nowrap;flex-shrink:0;">📄 ' + state.rows.length + ' CSV Rows</span>'
      : '<span style="background:#1e293b;color:#cbd5e1;padding:2px 7px;border-radius:6px;font-size:10px;font-weight:800;white-space:nowrap;flex-shrink:0;">📄 ' + state.rows.length + ' DOM Rows</span>';

    var headerPriceChip = isItemScoutMode() && livePriceChipText
      ? '<span style="background:#0f172a;color:#38bdf8;border:1px solid #334155;padding:1px 7px;border-radius:999px;font-family:monospace;font-size:10px;font-weight:900;white-space:nowrap;flex-shrink:0;">' + escHtml(livePriceChipText) + '</span>'
      : '';

    var headerCombineChip = pillSynergy && pillSynergy.isEligible
      ? '<button type="button" id="rc-header-combine-chip" title="Toggle Combined Shipping details" style="background:#065f46;color:#6ee7b7;border:1px solid #34d399;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:900;cursor:pointer;white-space:nowrap;flex-shrink:0;">📦 +' + pillSynergy.matchCount + ' (~$' + pillSynergy.estSavings.toFixed(0) + ')</button>'
      : (isAuctionSweepMode() && gridLocalCounts.combineCount > 0)
      ? '<span style="background:#065f46;color:#6ee7b7;border:1px solid #34d399;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:900;white-space:nowrap;flex-shrink:0;">📦 ' + gridLocalCounts.combineCount + ' Combine</span>'
      : '';

    var headerTrackedChip = existingWl
      ? '<span style="background:#065f46;color:#d1fae5;padding:1px 6px;border-radius:999px;font-size:9.5px;font-weight:800;white-space:nowrap;flex-shrink:0;">📌 Tracked</span>'
      : (isAuctionSweepMode() && gridLocalCounts.trackedCount > 0)
      ? '<span style="background:#312e81;color:#c7d2fe;padding:1px 6px;border-radius:999px;font-size:9.5px;font-weight:800;white-space:nowrap;flex-shrink:0;">📌 ' + gridLocalCounts.trackedCount + ' Tracked</span>'
      : '';

    var trackersHeaderLink =
      '<a href="' + state.activeOrigin + '/scout/trackers" target="_blank" class="rc-btn-pill" title="Open Scout Buy Trackers (/scout/trackers)" style="background:#312e81;border:1px solid #4f46e5;color:#e0e7ff;">📌 Trackers ↗</a>';

    var haulsHeaderLink =
      '<a href="' + state.activeOrigin + '/purchases" target="_blank" class="rc-btn-pill" title="Open Purchases &amp; Hauls (/purchases)" style="background:#1e293b;border:1px solid #334155;color:#93c5fd;">📦 Hauls ↗</a>';

    var refreshBtnHtml =
      '<button id="rc-scout-refresh-btn" class="rc-btn-pill" title="Refresh live item / bid / watchlist data" style="background:#0f172a;border:1px solid #334155;color:#e2e8f0;">🔄</button>';

    var harvestCsvBtnHtml = isSgwTableSyncMode() && isShopGoodwillHost()
      ? '<button id="rc-scout-harvest-csv-btn" class="rc-btn-pill" title="Silently harvest ShopGoodwill CSV in memory" style="background:#334155;border:1px solid #475569;color:#f8fafc;">🔄 CSV</button>'
      : '';

    var headerAuthControl = auth
      ? '<button id="rc-scout-logout-btn" class="rc-btn-pill" title="Log Out of Bookmarklet" style="background:#334155;color:#fca5a5;border:1px solid rgba(248,113,113,0.4);">🚪</button>'
      : '<button id="rc-scout-drawer-signin-btn" class="rc-btn-pill" style="background:#f59e0b;color:#1e1b18;border:0;">🔐 Sign In</button>';

    var saveActionBtnPrefix = itemRow && itemRow.listingMode === 'local_cash'
      ? '📌 Track & Copy Cash Offer'
      : itemRow && !itemRow.isAuction && !isShopGoodwillHost()
      ? '📌 Track & Copy Max Offer'
      : '📌 Track & Copy Max Bid';

    // Dead-deal detection (every tier is S&H-capped or outbid) → "Watch Only" CTA, never copy $0.00 to the clipboard
    var finForCta = (isItemScoutMode() && state.scoutReport) ? computeScoutFinancials() : null;
    var isDeadDeal = Boolean(finForCta && finForCta.allDead && !(parseFloat(state.customMaxBid) > 0));

    var footerHtml = '';
    if (isItemScoutMode()) {
      if (itemRow) syncGalleryStateForItem(itemRow);
      var selPhotoCount = getSelectedGalleryUrls().length;
      var photoCountSuffix = selPhotoCount > 0
        ? ' (' + selPhotoCount + ' Photo' + (selPhotoCount === 1 ? '' : 's') + ')'
        : ' (In-Tray)';
      var activeMax = parseFloat(state.customMaxBid) || computeActiveMaxBid();
      var curItemKey = itemRow ? String(itemRow.itemId || '') : '';
      var isJustSaved = Boolean(curItemKey && state.lastSavedForItemId === curItemKey);
      var savedTrackerCode = (state.lastSavedTracker && state.lastSavedTracker.orderId)
        ? state.lastSavedTracker.orderId
        : (existingWl && existingWl.trackerLabel ? existingWl.trackerLabel.split(' ')[0] : 'Tracker');

      if (!state.scoutReport) {
        footerHtml =
          '<div style="display:flex;flex-direction:column;gap:6px;">' +
            '<button id="rc-scout-run-ai-btn" style="width:100%;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:0;border-radius:10px;padding:11px 14px;font-weight:900;cursor:pointer;font-size:13px;box-shadow:0 4px 14px rgba(99,102,241,0.4);">' +
              (state.scoutingItem ? '⏳ Scouting' + photoCountSuffix + '...' : '⚡ Run AI Speed Scout' + photoCountSuffix) +
            '</button>' +
            '<div style="display:flex;gap:6px;">' +
              '<button id="rc-scout-quick-track-btn" style="flex:1;background:#1e293b;color:#cbd5e1;border:1px solid #334155;border-radius:8px;padding:7px 10px;font-weight:800;cursor:pointer;font-size:11px;">' +
                (isJustSaved ? ('✅ Saved in ' + escHtml(savedTrackerCode) + ' — Click to Update') : '📌 Quick-Track + Save Photos') +
              '</button>' +
              '<a href="' + state.activeOrigin + '/scout/trackers" target="_blank" style="background:#1e293b;color:#a5b4fc;text-decoration:none;border:1px solid #334155;border-radius:8px;padding:7px 10px;font-weight:800;font-size:11px;">📌 Trackers ↗</a>' +
            '</div>' +
          '</div>';
      } else {
        var saveBtnLabel = state.savingTrack
          ? '⏳ Archiving Photos & Saving to Tracker...'
          : isJustSaved
          ? ('✅ Saved in ' + savedTrackerCode + ' ($' + Number(activeMax || 0).toFixed(2) + ') — Click to Update')
          : isDeadDeal
          ? '📌 Log Pass / Watch Only ($0 Bid)'
          : (existingWl ? ('📌 Update ' + (existingWl.trackerLabel ? existingWl.trackerLabel.split(' ')[0] : 'Tracked') + ' & Copy ($' + Number(activeMax || 0).toFixed(2) + ')') : (saveActionBtnPrefix + ' ($' + Number(activeMax || 0).toFixed(2) + ')'));

        footerHtml =
          '<div style="display:flex;flex-direction:column;gap:6px;">' +
            '<button id="rc-scout-save-track-btn" style="width:100%;background:' + (isJustSaved ? '#059669' : '#10b981') + ';color:#052e16;border:0;border-radius:10px;padding:11px 14px;font-weight:900;cursor:pointer;font-size:12.5px;">' +
              escHtml(saveBtnLabel) +
            '</button>' +
            '<div style="display:flex;gap:6px;">' +
              '<button id="rc-scout-run-ai-btn" style="flex:1;background:#1e293b;color:#cbd5e1;border:1px solid #334155;border-radius:8px;padding:7px 10px;font-weight:800;cursor:pointer;font-size:11px;">' +
                '🔄 Re-Scan Selected' + (selPhotoCount > 0 ? ' (' + selPhotoCount + ')' : '') +
              '</button>' +
              '<a href="' + state.activeOrigin + '/scout/trackers" target="_blank" style="background:#1e293b;color:#a5b4fc;text-decoration:none;border:1px solid #334155;border-radius:8px;padding:7px 10px;font-weight:800;font-size:11px;">📌 Trackers ↗</a>' +
            '</div>' +
          '</div>';
      }
    } else if (isAuctionSweepMode()) {
      var gridCount = state.gridCards ? Math.min(40, state.gridCards.length) : 0;
      var sweepCtaLabel = state.sweepingGrid
        ? '⏳ Sweeping Active Lots...'
        : state.sweepData
        ? ('🕸️ Re-Sweep Page for Flips (' + gridCount + ' Lots)')
        : ('🕸️ Sweep Page for Flips (' + gridCount + ' Lots)');
      footerHtml =
        '<div style="display:flex;flex-direction:column;gap:6px;">' +
          '<button id="rc-sweep-run-btn" ' + (state.sweepingGrid ? 'disabled ' : '') + 'style="width:100%;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:0;border-radius:10px;padding:11px 14px;font-weight:900;cursor:' + (state.sweepingGrid ? 'wait' : 'pointer') + ';font-size:13px;box-shadow:0 4px 14px rgba(99,102,241,0.4);">' +
            escHtml(sweepCtaLabel) +
          '</button>' +
          '<div style="display:flex;gap:6px;">' +
            '<a href="' + state.activeOrigin + '/scout/trackers" target="_blank" style="flex:1;text-align:center;background:#1e293b;color:#a5b4fc;text-decoration:none;border:1px solid #334155;border-radius:8px;padding:7px 10px;font-weight:800;font-size:11px;">📌 Buy Trackers ↗</a>' +
            '<a href="' + state.activeOrigin + '/purchases" target="_blank" style="flex:1;text-align:center;background:#1e293b;color:#e2e8f0;text-decoration:none;border:1px solid #334155;border-radius:8px;padding:7px 10px;font-weight:800;font-size:11px;">📦 /purchases ↗</a>' +
          '</div>' +
        '</div>';
    } else if (state.pageType === 'other') {
      footerHtml =
        '<div style="display:flex;gap:6px;">' +
          '<a href="' + state.activeOrigin + '/scout/trackers" target="_blank" style="flex:1;text-align:center;background:#312e81;color:#e0e7ff;text-decoration:none;border:1px solid #4f46e5;border-radius:10px;padding:10px 10px;font-weight:800;font-size:11.5px;">📌 Open Buy Trackers ↗</a>' +
          '<a href="' + state.activeOrigin + '/purchases" target="_blank" style="flex:1;text-align:center;background:#1e293b;color:#e2e8f0;text-decoration:none;border:1px solid #334155;border-radius:10px;padding:10px 10px;font-weight:800;font-size:11.5px;">📦 Open /purchases ↗</a>' +
        '</div>';
    } else {
      var selCount = getSelectedRowKeysArray().length;
      var commitBtnHtml = state.previewData && !state.commitResult
        ? '<button id="rc-scout-commit-btn" ' + (selCount === 0 ? 'disabled' : '') + ' style="flex:1;background:' + (selCount === 0 ? '#334155' : '#10b981') + ';color:' + (selCount === 0 ? '#94a3b8' : '#052e16') + ';border:0;border-radius:10px;padding:10px 12px;font-weight:900;cursor:' + (selCount === 0 ? 'not-allowed' : 'pointer') + ';font-size:12.5px;">' +
            (state.committing ? '⏳ Committing...' : '🚀 Commit Selected (' + selCount + ')') +
          '</button>'
        : '<button id="rc-scout-preview-btn" style="flex:1;background:#818cf8;color:#0f172a;border:0;border-radius:10px;padding:10px 12px;font-weight:900;cursor:pointer;font-size:12.5px;">🔍 Preview Queue (' + state.rows.length + ')</button>';

      footerHtml =
        '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
          commitBtnHtml +
          '<a href="' + state.activeOrigin + '/scout/trackers" target="_blank" style="background:#1e293b;color:#a5b4fc;text-decoration:none;border:1px solid #334155;border-radius:10px;padding:10px 10px;font-weight:800;font-size:11px;">📌 Trackers ↗</a>' +
          '<a href="' + state.activeOrigin + '/purchases" target="_blank" style="background:#1e293b;color:#e2e8f0;text-decoration:none;border:1px solid #334155;border-radius:10px;padding:10px 10px;font-weight:800;font-size:11px;">/purchases ↗</a>' +
        '</div>';
    }

    var activeGridPlat = (isAuctionSweepMode() && state.gridCards && state.gridCards[0] && state.gridCards[0].platformName)
      ? state.gridCards[0].platformName
      : '';
    var trayHeaderTitle = (isShopGoodwillHost()
      ? '🔭 RC Scout'
      : ('🔭 ' + escHtml((itemRow && itemRow.platformName) || activeGridPlat || 'RC Scout'))) +
      ' <span title="Script version • serving host" style="background:#1e1b4b;color:#a5b4fc;border:1px solid #4338ca;padding:1px 5px;border-radius:6px;font-size:9px;font-weight:800;font-family:monospace;vertical-align:middle;">' +
      escHtml(SCRIPT_VERSION) + ' • ' + escHtml(ORIGIN_HOST) + '</span>';

    var prevTrayBody = document.getElementById('rc-scout-tray-body');
    var prevScrollTop = prevTrayBody ? prevTrayBody.scrollTop : 0;

    tray.innerHTML =
      // Frozen 2-Row Top Command Header (.rc-bml-drawer-header — contains 100% of Pill Bar badges, links, Refresh, Auth & ▾ Pill minimize)
      '<div class="rc-bml-drawer-header" style="padding:9px 12px;background:#1e293b;border-bottom:1px solid #334155;flex-shrink:0;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">' +
          '<div style="font-size:13px;font-weight:900;color:#818cf8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;">' + trayHeaderTitle + '</div>' +
          '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">' +
            refreshBtnHtml +
            trackersHeaderLink +
            haulsHeaderLink +
            harvestCsvBtnHtml +
            headerAuthControl +
            '<button id="rc-scout-close-tray" class="rc-btn-pill" title="Minimize Drawer to bottom-right Pill Bar" style="background:#0f172a;border:1px solid #475569;color:#f8fafc;">▾ Pill</button>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.07);font-size:10px;">' +
          '<div style="display:flex;align-items:center;gap:5px;min-width:0;overflow-x:auto;" class="rc-scout-scroll">' +
            sourceBadge +
            headerPriceChip +
            headerCombineChip +
            headerTrackedChip +
          '</div>' +
          (auth
            ? '<span style="color:#6ee7b7;font-weight:800;white-space:nowrap;flex-shrink:0;">' + escHtml(auth.roleBadge || '👑') + ' ' + escHtml((auth.name || '').split(' ')[0]) + '</span>'
            : '<span style="color:#fbbf24;font-weight:800;white-space:nowrap;flex-shrink:0;">Not Signed In</span>') +
        '</div>' +
      '</div>' +
      // Scrollable Drawer Body
      '<div id="rc-scout-tray-body" class="rc-bml-drawer-body" style="flex:1;overflow-y:auto;padding:10px 12px;">' +
        (isItemScoutMode()
          ? renderItemTrayBody()
          : isAuctionSweepMode()
          ? renderAuctionSweepTrayBody()
          : state.pageType === 'other'
          ? renderBrowseIdleBody()
          : renderTableTrayBody()) +
      '</div>' +
      // Pinned Drawer Footer
      '<div class="rc-bml-drawer-footer" style="padding:9px 12px;background:#1e293b;border-top:1px solid #334155;flex-shrink:0;">' +
        footerHtml +
      '</div>';

    var nextTrayBody = document.getElementById('rc-scout-tray-body');
    if (nextTrayBody) {
      if (state.justFinishedScan) {
        nextTrayBody.scrollTop = 0;
        state.justFinishedScan = false;
      } else if (prevScrollTop > 0) {
        nextTrayBody.scrollTop = prevScrollTop;
      }
    }

    // Wire Drawer event listeners
    var closeTrayBtn = document.getElementById('rc-scout-close-tray');
    if (closeTrayBtn) {
      closeTrayBtn.onclick = function () {
        state.trayOpen = false;
        renderUI();
      };
    }

    var refreshBtnEl = document.getElementById('rc-scout-refresh-btn');
    if (refreshBtnEl) {
      refreshBtnEl.onclick = function () {
        state.errorMsg = null;
        detectPageAndRows();
        decoratePageRows();
        hydrateShopGoodwillItemApi(true);
        fetchWatchlist(function () {
          if (isSgwTableSyncMode()) {
            runPreviewOrSync(true);
          } else {
            renderUI();
          }
        });
      };
    }

    var drawerSignInBtn = document.getElementById('rc-scout-drawer-signin-btn');
    if (drawerSignInBtn) {
      drawerSignInBtn.onclick = function () {
        if (window.__RC_BML_AUTH__ && window.__RC_BML_AUTH__.openConnectFlow) {
          window.__RC_BML_AUTH__.openConnectFlow(false);
        }
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
          executeSyncCall(true);
        });
      };
    }

    var toggleGalleryAcc = document.getElementById('rc-toggle-gallery-accordion');
    if (toggleGalleryAcc) {
      toggleGalleryAcc.onclick = function () {
        state.galleryExpandedPostScan = !state.galleryExpandedPostScan;
        renderUI();
      };
    }

    var toggleCombineAcc = document.getElementById('rc-toggle-combine-accordion');
    if (toggleCombineAcc) {
      toggleCombineAcc.onclick = function () {
        state.combineExpandedPostScan = !state.combineExpandedPostScan;
        renderUI();
      };
    }

    var headerCombineBtn = document.getElementById('rc-header-combine-chip');
    if (headerCombineBtn) {
      headerCombineBtn.onclick = function () {
        if (state.scoutReport) {
          state.combineExpandedPostScan = !state.combineExpandedPostScan;
          renderUI();
        }
      };
    }

    // Table filter buttons & row checkboxes
    var filterBtns = tray.querySelectorAll('.rc-table-filter-btn');
    Array.prototype.slice.call(filterBtns).forEach(function (btn) {
      btn.onclick = function () {
        state.tableFilter = btn.getAttribute('data-filter') || 'ALL';
        renderUI();
      };
    });

    var rowCheckboxes = tray.querySelectorAll('.rc-row-select-cb');
    Array.prototype.slice.call(rowCheckboxes).forEach(function (cb) {
      cb.onchange = function () {
        var rk = cb.getAttribute('data-rowkey');
        if (rk) {
          state.selectedRowKeys[rk] = Boolean(cb.checked);
          renderUI();
        }
      };
    });

    var selTrackedBtn = document.getElementById('rc-select-tracked-btn');
    if (selTrackedBtn && state.previewData) {
      selTrackedBtn.onclick = function () {
        var next = {};
        (state.previewData.rows || []).forEach(function (pr) {
          var rk = pr.rowKey || (pr.orderId ? pr.orderId + ':' + pr.itemId : pr.itemId);
          next[rk] = Boolean(pr.wasTracked || pr.rowCategory === 'PROMOTE_TRACKED');
        });
        state.selectedRowKeys = next;
        renderUI();
      };
    }

    var selActionableBtn = document.getElementById('rc-select-actionable-btn');
    if (selActionableBtn && state.previewData) {
      selActionableBtn.onclick = function () {
        var next = {};
        (state.previewData.rows || []).forEach(function (pr) {
          var rk = pr.rowKey || (pr.orderId ? pr.orderId + ':' + pr.itemId : pr.itemId);
          next[rk] = pr.rowCategory !== 'EXISTING_SYNCED' && pr.rowCategory !== 'REFUNDED' && !pr.isRefunded;
        });
        state.selectedRowKeys = next;
        renderUI();
      };
    }

    var selNoneBtn = document.getElementById('rc-select-none-btn');
    if (selNoneBtn) {
      selNoneBtn.onclick = function () {
        state.selectedRowKeys = {};
        renderUI();
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
        state.lastSavedForItemId = '';
        state.customMaxBid = String(computeActiveMaxBid().toFixed(2));
        renderUI();
      };
    }

    var combineBonusCheckbox = document.getElementById('rc-scout-combine-bonus');
    if (combineBonusCheckbox) {
      combineBonusCheckbox.onchange = function () {
        state.useCombineBonus = Boolean(combineBonusCheckbox.checked);
        state.lastSavedForItemId = '';
        state.customMaxBid = String(computeActiveMaxBid().toFixed(2));
        renderUI();
      };
    }

    var tierBtns = tray.querySelectorAll('.rc-tier-pick-btn');
    Array.prototype.slice.call(tierBtns).forEach(function (btn) {
      btn.onclick = function () {
        var tier = btn.getAttribute('data-tier') || 'balanced';
        state.selectedTier = tier;
        state.lastSavedForItemId = '';
        state.customMaxBid = String(computeActiveMaxBid().toFixed(2));
        renderUI();
      };
    });

    var customMaxBidInput = document.getElementById('rc-scout-custom-maxbid');
    if (customMaxBidInput) {
      customMaxBidInput.oninput = function () {
        state.customMaxBid = customMaxBidInput.value;
        state.lastSavedForItemId = '';
        var saveBtn = document.getElementById('rc-scout-save-track-btn');
        if (saveBtn && !state.savingTrack) {
          var v = parseFloat(state.customMaxBid) || 0;
          saveBtn.textContent = saveActionBtnPrefix + ' ($' + v.toFixed(2) + ')';
        }
      };
    }

    var photoToggleBtns = tray.querySelectorAll('.rc-photo-toggle-btn');
    Array.prototype.slice.call(photoToggleBtns).forEach(function (btn) {
      btn.onclick = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        var url = btn.getAttribute('data-url');
        if (!url) return;
        var currentlyChecked = Boolean(state.selectedPhotoUrls[url]);
        if (currentlyChecked) {
          state.selectedPhotoUrls[url] = false;
          if (state.coverPhotoUrl === url) {
            var remaining = getSelectedGalleryUrls();
            state.coverPhotoUrl = remaining[0] || state.galleryUrls[0] || '';
          }
          state.errorMsg = '';
        } else {
          var currentCount = getSelectedGalleryUrls().length;
          if (currentCount >= 12) {
            state.errorMsg = 'Maximum 12 photos per AI Speed Scout scan — uncheck a filler photo first.';
            renderUI();
            return;
          }
          state.selectedPhotoUrls[url] = true;
          if (!state.coverPhotoUrl) state.coverPhotoUrl = url;
          state.errorMsg = '';
        }
        state.hasManualPhotoToggles = true;
        renderUI();
      };
    });

    var photoStarBtns = tray.querySelectorAll('.rc-photo-star-btn');
    Array.prototype.slice.call(photoStarBtns).forEach(function (btn) {
      btn.onclick = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        var url = btn.getAttribute('data-url');
        if (!url) return;
        if (!state.selectedPhotoUrls[url] && getSelectedGalleryUrls().length >= 12) {
          var curSel = getSelectedGalleryUrls();
          var dropUrl = curSel[curSel.length - 1];
          if (dropUrl) state.selectedPhotoUrls[dropUrl] = false;
        }
        state.selectedPhotoUrls[url] = true;
        state.coverPhotoUrl = url;
        state.hasManualPhotoToggles = true;
        state.errorMsg = '';
        renderUI();
      };
    });

    var photoLensLinks = tray.querySelectorAll('.rc-photo-lens-link');
    Array.prototype.slice.call(photoLensLinks).forEach(function (lnk) {
      lnk.onclick = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
      };
    });

    var selectTop12Btn = document.getElementById('rc-photo-select-top12');
    if (selectTop12Btn) {
      selectTop12Btn.onclick = function () {
        var nextSel = {};
        (state.galleryUrls || []).slice(0, 12).forEach(function (u) {
          nextSel[u] = true;
        });
        state.selectedPhotoUrls = nextSel;
        if (!state.coverPhotoUrl || !nextSel[state.coverPhotoUrl]) {
          state.coverPhotoUrl = (state.galleryUrls || [])[0] || '';
        }
        state.hasManualPhotoToggles = true;
        state.errorMsg = '';
        renderUI();
      };
    }

    var resellerNotesInput = document.getElementById('rc-scout-reseller-notes');
    if (resellerNotesInput) {
      resellerNotesInput.oninput = function () {
        state.resellerNotes = resellerNotesInput.value;
      };
    }

    var detailsToggleBtn = document.getElementById('rc-scout-details-toggle');
    if (detailsToggleBtn) {
      detailsToggleBtn.onclick = function () {
        state.detailsOpen = !state.detailsOpen;
        renderUI();
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

    // Wire Auction Sweep (v4.5) Drawer & In-Drawer Drill-Down listeners
    var sweepRunBtn = document.getElementById('rc-sweep-run-btn');
    if (sweepRunBtn && !state.sweepingGrid) {
      sweepRunBtn.onclick = function () {
        runAuctionSweep();
      };
    }

    var sweepFilterBtns = tray.querySelectorAll('.rc-sweep-filter-btn');
    Array.prototype.slice.call(sweepFilterBtns).forEach(function (btn) {
      btn.onclick = function () {
        state.sweepFilter = btn.getAttribute('data-sfilter') || 'HITS';
        renderUI();
      };
    });

    var sweepDimToggle = document.getElementById('rc-sweep-dim-toggle');
    if (sweepDimToggle) {
      sweepDimToggle.onchange = function () {
        state.dimPassedCards = Boolean(sweepDimToggle.checked);
        decorateAuctionGridCards();
        renderUI();
      };
    }

    var sweepOpenScoutBtns = tray.querySelectorAll('.rc-sweep-open-scout-btn');
    Array.prototype.slice.call(sweepOpenScoutBtns).forEach(function (btn) {
      btn.onclick = function () {
        var lk = btn.getAttribute('data-lotkey');
        if (lk) openSweepLotFullScout(lk, true);
      };
    });

    var sweepQuickTrackBtns = tray.querySelectorAll('.rc-sweep-quick-track-btn');
    Array.prototype.slice.call(sweepQuickTrackBtns).forEach(function (btn) {
      btn.onclick = function () {
        var lk = btn.getAttribute('data-lotkey');
        if (lk && !state.quickTrackingKey) quickTrackSweepLot(lk);
      };
    });

    var sweepFindCardBtns = tray.querySelectorAll('.rc-sweep-find-card-btn');
    Array.prototype.slice.call(sweepFindCardBtns).forEach(function (btn) {
      btn.onclick = function () {
        var lk = btn.getAttribute('data-lotkey');
        if (lk) scrollToSweepGridCard(lk);
      };
    });

    var backToSweepBtn = document.getElementById('rc-back-to-sweep-btn');
    if (backToSweepBtn) {
      backToSweepBtn.onclick = function () {
        closeSweepLotFullScout();
      };
    }

    var focusInspectedBtn = document.getElementById('rc-focus-inspected-card-btn');
    if (focusInspectedBtn && state.inspectingGridItem) {
      focusInspectedBtn.onclick = function () {
        scrollToSweepGridCard(state.inspectingGridItem.lotKey);
      };
    }
  }

  // SPA URL Watcher (Fixes "YOU MAY ALSO LIKE" & SPA Route Transition Freezes Across Both Drawer & Pill Bar)
  var spaSettleTimers = [];
  function clearSpaSettleTimers() {
    while (spaSettleTimers.length > 0) {
      clearTimeout(spaSettleTimers.pop());
    }
  }

  function handleSpaUrlChange(nextHref) {
    var cleanNext = String(nextHref || window.location.href || '');
    if (!cleanNext || cleanNext === state.lastObservedHref) return;
    state.lastObservedHref = cleanNext;
    clearSpaSettleTimers();
    clearAuctionGridDecorations();

    // Reset per-URL transient state while keeping auth/watchlist/combinableItems/sgwApi caches intact
    state.rows = [];
    state.gridCards = [];
    state.sweepingGrid = false;
    state.sweepProgressMsg = '';
    state.sweepData = null;
    state.sweepByKey = {};
    state.quickTrackingKey = '';
    state.inspectingGridItem = null;
    state.csvRows = [];
    state.csvHarvested = false;
    state.previewData = null;
    state.commitResult = null;
    state.selectedRowKeys = {};
    state.scoutingItem = false;
    state.scoutReport = null;
    state.isRestoredSavedReport = false;
    state.restoredDocId = '';
    state.loadingRestoredDocId = '';
    state.customMaxBid = '';
    state.trackedSavedMsg = null;
    state.lastSavedForItemId = '';
    state.errorMsg = null;
    state.galleryUrls = [];
    state.selectedPhotoUrls = {};
    state.hasManualPhotoToggles = false;
    state.coverPhotoUrl = '';
    state.resellerNotes = '';
    state.detailsOpen = false;
    state.galleryExpandedPostScan = false;
    state.combineExpandedPostScan = false;
    state.lastSyncedItemId = '';

    function settlePass(isFinal) {
      detectPageAndRows();
      decoratePageRows();
      if (isItemScoutMode()) {
        hydrateShopGoodwillItemApi(false);
        maybeRestoreSavedReport();
      } else if (isFinal && state.trayOpen && isSgwTableSyncMode() && !state.previewData && !state.loadingPreview) {
        runPreviewOrSync(true);
        return;
      }
      renderUI();
    }

    settlePass(false);
    spaSettleTimers.push(setTimeout(function () { settlePass(false); }, 350));
    spaSettleTimers.push(setTimeout(function () { settlePass(true); }, 950));
  }

  var unwatchSpa = null;
  try {
    if (window.__RC_BML_CORE__ && typeof window.__RC_BML_CORE__.watchSpaLocation === 'function') {
      unwatchSpa = window.__RC_BML_CORE__.watchSpaLocation(handleSpaUrlChange);
    } else {
      var fallbackSpaTimer = setInterval(function () {
        var cur = String(window.location.href || '');
        if (cur !== state.lastObservedHref) handleSpaUrlChange(cur);
      }, 450);
      unwatchSpa = function () { clearInterval(fallbackSpaTimer); };
    }
  } catch (e) {}

  function toggleFromBookmarkletBarClick() {
    state.lastHandledClickSeq = Number(window.__RC_BML_CLICK_SEQ__ || 0);
    window.__RC_BOOKMARKLET_CLICKED__ = false;
    state.trayOpen = !state.trayOpen;
    if (state.trayOpen && isSgwTableSyncMode() && !state.previewData && !state.loadingPreview) {
      runPreviewOrSync(true);
      return;
    }
    renderUI();
  }

  var liveHandle = {
    version: SCRIPT_VERSION,
    build: FILE_BUILD,
    onBookmarkletClick: toggleFromBookmarkletBarClick,
    toggle: toggleFromBookmarkletBarClick
  };
  window.__RC_SCOUT_LIVE__ = liveHandle;
  try {
    if (window.__RC_BML_CORE__ && typeof window.__RC_BML_CORE__.registerLive === 'function') {
      window.__RC_BML_CORE__.registerLive('auction_scout', liveHandle);
    }
  } catch (e) {}

  function onBmlAuthenticated() {
    fetchWatchlist(function () {
      if (state.trayOpen && isSgwTableSyncMode()) {
        runPreviewOrSync(true);
      } else {
        maybeRestoreSavedReport();
        renderUI();
      }
    });
  }
  window.addEventListener('rc-bml-authenticated', onBmlAuthenticated);

  window.__RC_SCOUT_TEARDOWN__ = function () {
    try {
      window.__RC_SCOUT_HOT_STATE__ = {
        href: String(window.location.href || ''),
        ts: Date.now(),
        scoutReport: state.scoutReport,
        galleryUrls: state.galleryUrls,
        selectedPhotoUrls: state.selectedPhotoUrls,
        hasManualPhotoToggles: state.hasManualPhotoToggles,
        coverPhotoUrl: state.coverPhotoUrl,
        resellerNotes: state.resellerNotes,
        watchlist: state.watchlist,
        combinableItems: state.combinableItems,
        sgwApi: state.sgwApi,
        domainProfiles: state.domainProfiles,
        roiTargets: state.roiTargets,
        sweepData: state.sweepData,
        sweepByKey: state.sweepByKey,
        sweepFilter: state.sweepFilter,
        dimPassedCards: state.dimPassedCards
      };
    } catch (e) {}
    clearSpaSettleTimers();
    clearAuctionGridDecorations();
    try { if (typeof unwatchSpa === 'function') unwatchSpa(); } catch (e) {}
    try { window.removeEventListener('rc-bml-authenticated', onBmlAuthenticated); } catch (e) {}
    ['rc-scout-tray', 'rc-scout-fab-bar', 'rc-scout-tray-styles'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    if (window.__RC_SCOUT_LIVE__ === liveHandle) {
      window.__RC_SCOUT_LIVE__ = null;
    }
    window.__RC_SCOUT_TEARDOWN__ = null;
  };

  window.__RC_REFRESH_FROM_CLOUD__ = function () {
    detectPageAndRows();
    state.trayOpen = true;
    harvestPageCsvSilently(function () {
      fetchWatchlist(function () {
        if (isSgwTableSyncMode()) {
          runPreviewOrSync(true);
        } else {
          maybeRestoreSavedReport();
          renderUI();
        }
      });
    });
  };

  window.__RC_BOOKMARKLET_CLICKED__ = false;
  installCsvInterceptor();
  detectPageAndRows();
  // URL-Driven 1st-Click Mode Auto-Detection: open 100dvh Drawer on actionable item/sync URLs; rest as Pill Bar on browse/grid URLs!
  if (isActionableUrlMode()) {
    state.trayOpen = true;
  }
  decoratePageRows();
  renderUI();
  // Re-check grid cards once SPA frameworks finish painting search results
  if (state.pageType === 'other' || state.pageType === 'auction-grid') {
    spaSettleTimers.push(setTimeout(function () {
      detectPageAndRows();
      decoratePageRows();
      renderUI();
    }, 550));
  }
  // Immediately hydrate the full 10-24 photo gallery from SGW's Buyer API (browser-direct) so the strip is full BEFORE Scan
  hydrateShopGoodwillItemApi(false);
  fetchWatchlist(function () {
    harvestPageCsvSilently(function () {
      if (state.trayOpen && isSgwTableSyncMode() && !state.previewData && !state.loadingPreview) {
        runPreviewOrSync(true);
      }
    });
  });
})();

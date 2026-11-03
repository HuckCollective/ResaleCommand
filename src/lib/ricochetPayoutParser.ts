import {
  PREVERIFIED_MD_MULTI_QTY_BINS,
  PREVERIFIED_MD_SKU_TO_UPC_OR_ID,
  assignOccurrenceFingerprints,
  buildLockedMultiBinMap,
  canonicalTicketNumber,
  cleanCatalogSku,
  flagAlreadyRecordedRows,
  isBbConsignorRow,
  isLeakedInventoryDomRow,
  isPayoutSummaryRow,
  matchMemoryDenInventoryItem,
  normalizeTitleForMdMatch,
  pacificMonthKey,
  resolveMemoryDenSkuFromPayoutRow,
  resolvePartnerBucketForSaleRow,
  splitTrailingBoothSku,
  toSaleIso,
} from './salesBucketing';
import { getLocationSettingMeta, resolveCanonicalLocationCode, resolveDefaultRicochetLocationMeta } from './warehouses';

export interface SpaceRentalAdjustment {
  label: string;
  date: string;
  amount: number;
}

export interface RicochetSyncSaleLine {
  ricoItemId: string;
  ricoSku?: string;
  sku: string;
  upc: string;
  title: string;
  saleNumber?: string;
  soldDate: string;
  paidDate?: string | null;
  agreedPrice?: number;
  splitPct?: string;
  agedPrice?: number;
  discounts?: string;
  grossPrice: number;
  ricoNetPayout: number;
  ricoCommission: number;
  payoutId: string;
  payoutStatus?: 'pending_payout' | 'paid';
  status: string;
  expectedFee?: number;
  expectedNetPayout?: number;
  matchedItemId?: string;
  matchedItemUpc?: string;
  matchedItemTitle?: string;
  matchedItemCost?: number;
  matchTier?: 'upc' | 'sku' | 'title_price' | 'title' | 'unmatched';
  matchStatus?: 'matched' | 'unmatched';
  partnerBucket?: 'HUCK' | 'PDXGL' | 'BB';
  alreadySynced?: boolean;
  alreadyRecorded?: boolean;
  ticketOccurrence?: number;
}

export interface RicochetSalesSyncPayload {
  timestamp: string;
  locationCode: string;
  locationName: string;
  commissionRate: number;
  monthlyRent: number;
  dryRun?: boolean;
  syncedAt?: string;
  spaceRentalAdjustments?: SpaceRentalAdjustment[];
  summary: {
    soldFound: number;
    pendingPayoutCount: number;
    pendingPayoutNet: number;
    paidHistoryCount: number;
    paidHistoryNet: number;
    spaceRentalTotal: number;
    grossSales: number;
    expectedCommission: number;
    expectedNetPayout: number;
    netAfterRent: number;
    matchedCount: number;
    alreadySyncedCount: number;
    unmatchedCount: number;
  };
  rows: RicochetSyncSaleLine[];
}

export function resolveRicochetLocation(rawLoc?: string | null) {
  const defaultMeta = resolveDefaultRicochetLocationMeta();
  if (!rawLoc || !String(rawLoc).trim()) {
    return defaultMeta;
  }
  const code = resolveCanonicalLocationCode(rawLoc) || defaultMeta.code;
  const meta = getLocationSettingMeta(code);
  return meta.usesRicochet ? meta : defaultMeta;
}

function resolveEffectiveRicoId(r: any, effectiveSku: string, cleanPayoutId: string, idx: number): string {
  if (effectiveSku) return effectiveSku;
  if (cleanPayoutId) return cleanPayoutId;
  const rawId = String(r.ricoItemId || r.productId || r.id || '').trim();
  if (rawId && !/^\d+$/.test(rawId)) return rawId;
  return `ROW-${idx + 1}`;
}

function normalizeValidPaidDate(rawPaidDate: any): string | null {
  if (!rawPaidDate) return null;
  const s = String(rawPaidDate).trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (
    lower === '—' ||
    lower === '-' ||
    lower === 'n/a' ||
    lower === 'na' ||
    lower === 'none' ||
    lower === 'null' ||
    lower === 'undefined' ||
    lower.includes('unpaid') ||
    lower.includes('pending')
  ) {
    return null;
  }
  return /\d{2,4}/.test(s) ? s : null;
}

/**
 * Reuses canonical `src/lib/salesBucketing.ts` helpers (`splitTrailingBoothSku`, `isPayoutSummaryRow`,
 * `resolveMemoryDenSkuFromPayoutRow`, `matchMemoryDenInventoryItem`, `buildLockedMultiBinMap`,
 * `assignOccurrenceFingerprints`, and `flagAlreadyRecordedRows`) to normalize, deduplicate, and match
 * Ricochet `/payouts`, `/payout_history`, and `/api/product` sold rows.
 */
export function buildEnrichedRicochetSalesPayload(params: {
  rawRows: any[];
  locCode: string;
  allItems: any[];
  allSales: any[];
  catalogReportRows?: any[];
  spaceRentalAdjustments?: SpaceRentalAdjustment[];
  dryRun?: boolean;
}): RicochetSalesSyncPayload {
  const locMeta = resolveRicochetLocation(params.locCode);
  const feePct = Number(locMeta.commissionRate ?? locMeta.feePct ?? 0);
  const monthlyRent = Number(locMeta.monthlyRent ?? 0);
  const allItems = params.allItems || [];
  const allSales = params.allSales || [];
  const catalogReportRows = params.catalogReportRows || [];

  const eligibleItems = allItems.filter((item) => {
    const s = String(item?.status || '').toLowerCase().trim();
    return s !== 'combined' && s !== 'deconstructed' && s !== 'draft' && s !== 'tracked' && s !== 'scouted';
  });

  const byUpc = new Map<string, any>();
  const bySku = new Map<string, any>();
  const byTitlePrice = new Map<string, any>();
  const byTitle = new Map<string, any>();

  for (const item of eligibleItems) {
    const u = cleanCatalogSku(item.upc).toUpperCase();
    const s = cleanCatalogSku(item.locationSku || item.sku).toUpperCase();
    const pFixed = Number(item.boutiquePrice ?? item.resalePrice ?? item.price ?? 0).toFixed(2);
    if (u && !byUpc.has(u)) byUpc.set(u, item);
    if (s && !bySku.has(s)) bySku.set(s, item);
    const titlesToIndex = [
      normalizeTitleForMdMatch(item.tagTitle || ''),
      normalizeTitleForMdMatch(item.title || item.identity || ''),
    ].filter((t) => t && t.length >= 4);
    for (const t of titlesToIndex) {
      if (!byTitlePrice.has(`${t}|${pFixed}`)) byTitlePrice.set(`${t}|${pFixed}`, item);
      if (!byTitle.has(t)) byTitle.set(t, item);
    }
  }

  // Index Ricochet Catalog Verify Report rows (`md_verify_report_latest`) so `/payouts` rows without a SKU column resolve their 0EJ SKU & UPC
  const catalogBySku = new Map<string, any>();
  const catalogByTitlePrice = new Map<string, any>();
  const catalogByTitle = new Map<string, any>();
  for (const cr of catalogReportRows) {
    const cSku = cleanCatalogSku(cr?.sku).toUpperCase();
    const cName = normalizeTitleForMdMatch(cr?.name || cr?.title || '');
    const cPrice = Number(cr?.agreedPrice ?? cr?.price ?? 0).toFixed(2);
    if (cSku && !catalogBySku.has(cSku)) catalogBySku.set(cSku, cr);
    if (cName && cName.length >= 4) {
      if (!catalogByTitlePrice.has(`${cName}|${cPrice}`)) catalogByTitlePrice.set(`${cName}|${cPrice}`, cr);
      if (!catalogByTitle.has(cName)) catalogByTitle.set(cName, cr);
    }
  }

  const claimedItemIdToSku = new Map<string, string>();
  const multiBinResolvedBySku = buildLockedMultiBinMap(eligibleItems, claimedItemIdToSku);

  const existingOrderIds = new Set<string>();
  const existingSkuGrossSet = new Set<string>();
  const existingSkuNetSet = new Set<string>();
  const existingTitleMonthSet = new Set<string>();
  for (const s of allSales) {
    if (s.status === 'Cancelled') continue;
    const ord = cleanCatalogSku(s.orderId).toUpperCase();
    const so = cleanCatalogSku(s.soNumber).toUpperCase();
    const gross = Number(s.grossAmount || 0).toFixed(2);
    const net = Number(s.netPayout ?? (Number(s.grossAmount || 0) - Number(s.commissionFee || 0))).toFixed(2);
    const sMonth = pacificMonthKey(s.saleDate);
    if (ord) {
      existingOrderIds.add(`${ord}|${gross}`);
      existingOrderIds.add(`${ord}|${net}`);
      existingOrderIds.add(ord);
    }
    if (so) {
      existingSkuGrossSet.add(`${so}|${gross}`);
      existingSkuNetSet.add(`${so}|${net}`);
      if (sMonth) existingSkuGrossSet.add(`${so}|${sMonth}`);
    }
    const sTitle = normalizeTitleForMdMatch(s.itemTitle || s.title || '');
    if (sTitle && sMonth) {
      existingTitleMonthSet.add(`${sTitle}|${sMonth}|${gross}`);
      existingTitleMonthSet.add(`${sTitle}|${sMonth}|${net}`);
    }
  }

  const filteredRawRows = (params.rawRows || []).filter((r) => {
    const rawTitle = String(r.title || r.itemName || r.name || '').trim();
    const rawSkuText = String(r.sku || r.ricoSku || '').trim();
    if (isPayoutSummaryRow(rawTitle) || isPayoutSummaryRow(rawSkuText) || isLeakedInventoryDomRow(r)) return false;
    return Boolean(rawTitle || rawSkuText);
  });

  // Preserve 100% of `/payouts` (Pending Payout) and `/payout_history` (Paid History) register lines.
  // Only skip unticketed `/api/product` catalog fallback rows when already covered by payout rows.
  const dedupedRawRows: any[] = [];
  const seenFallbackKeys = new Set<string>();
  const seenPayoutSkus = new Set<string>();
  const seenPayoutTitlePriceCount = new Map<string, number>();

  for (const r of filteredRawRows) {
    const rawTitleInput = String(r.title || r.itemName || r.name || '').trim();
    const trailing = splitTrailingBoothSku(rawTitleInput);
    const cleanTitle = trailing.sku ? trailing.title : rawTitleInput;
    let rawSku = cleanCatalogSku(r.ricoSku || r.sku || r.extractedSku || trailing.sku || '').toUpperCase();
    if (/^\d+$/.test(rawSku)) rawSku = '';

    let extractedPartnerUpc = '';
    if (/^(?:HUCK|PDXGL|BB)-/i.test(rawSku)) {
      extractedPartnerUpc = rawSku;
      rawSku = '';
    }

    const rawSaleNum = String(r.saleNumber || r.payoutId || r.ticketNumber || '').trim();
    const cleanTicket = canonicalTicketNumber(rawSaleNum) || rawSaleNum.replace(/^#/, '').trim();
    const agreedPrice = Math.max(
      0,
      Number(Number(r.agreedPrice ?? r.grossPrice ?? r.listedPrice ?? r.price ?? 0).toFixed(2))
    );
    const agedPrice = Math.max(0, Number(Number(r.agedPrice ?? agreedPrice).toFixed(2)));
    const grossPrice = Math.max(
      0,
      Number(Number(r.grossPrice ?? (agedPrice > 0 ? agedPrice : agreedPrice)).toFixed(2))
    );

    if (!rawSku) {
      rawSku = resolveMemoryDenSkuFromPayoutRow({
        extractedSku: '',
        itemName: cleanTitle,
        ticketNumber: cleanTicket,
        grossPrice,
      });
    }
    const normTitle = normalizeTitleForMdMatch(cleanTitle);
    const titlePriceKey = `${normTitle}|${grossPrice.toFixed(2)}`;
    if (!rawSku && normTitle) {
      const fromCatalog = catalogByTitlePrice.get(titlePriceKey) || catalogByTitle.get(normTitle);
      if (fromCatalog?.sku) {
        rawSku = cleanCatalogSku(fromCatalog.sku).toUpperCase();
      }
    }
    if (!rawSku && normTitle) {
      const fromTitlePrice = byTitlePrice.get(titlePriceKey) || byTitle.get(normTitle);
      if (fromTitlePrice?.locationSku) {
        rawSku = cleanCatalogSku(fromTitlePrice.locationSku).toUpperCase();
      }
    }

    const validPaidDate = normalizeValidPaidDate(r.paidDate);
    const isExplicitPayoutRow = Boolean(
      r.payoutStatus === 'pending_payout' ||
        r.payoutStatus === 'paid' ||
        cleanTicket ||
        validPaidDate ||
        r.ricoNetPayout !== undefined ||
        (r.source && r.source !== 'product_catalog')
    );

    if (isExplicitPayoutRow) {
      if (rawSku) seenPayoutSkus.add(rawSku);
      if (normTitle) {
        seenPayoutTitlePriceCount.set(titlePriceKey, (seenPayoutTitlePriceCount.get(titlePriceKey) || 0) + 1);
      }
      dedupedRawRows.push({
        ...r,
        _resolvedTitle: cleanTitle,
        _resolvedSku: rawSku,
        _extractedPartnerUpc: extractedPartnerUpc,
        _cleanTicket: cleanTicket,
      });
    } else {
      // Fallback row from `/api/product` without a sale ticket: skip if already covered by `/payouts` or `/payout_history`
      if (rawSku && seenPayoutSkus.has(rawSku)) continue;
      const remaining = seenPayoutTitlePriceCount.get(titlePriceKey) || 0;
      if (normTitle && remaining > 0) {
        seenPayoutTitlePriceCount.set(titlePriceKey, remaining - 1);
        continue;
      }
      const fallbackDedupKey = `FALLBACK|${rawSku}|${normTitle}|${grossPrice.toFixed(2)}`;
      if (seenFallbackKeys.has(fallbackDedupKey)) continue;
      seenFallbackKeys.add(fallbackDedupKey);
      dedupedRawRows.push({
        ...r,
        _resolvedTitle: cleanTitle,
        _resolvedSku: rawSku,
        _extractedPartnerUpc: extractedPartnerUpc,
        _cleanTicket: '',
      });
    }
  }

  const normalizedRows: RicochetSyncSaleLine[] = dedupedRawRows.map((r, idx) => {
    const rawTitle = String(r._resolvedTitle || r.title || r.itemName || r.name || '').trim();
    const rawSku = String(r._resolvedSku || '').toUpperCase();
    const cleanPayoutId = String(r._cleanTicket || '').trim();
    const saleNumber = r.saleNumber || (cleanPayoutId ? `#${cleanPayoutId}` : '');

    const catalogRow = rawSku ? catalogBySku.get(rawSku) : null;
    const preMappedUpc = rawSku && PREVERIFIED_MD_SKU_TO_UPC_OR_ID[rawSku] ? PREVERIFIED_MD_SKU_TO_UPC_OR_ID[rawSku] : '';
    const upc = cleanCatalogSku(
      r.upc ||
        r.matchedItemUpc ||
        r.expectedRcUpc ||
        r._extractedPartnerUpc ||
        catalogRow?.upc ||
        catalogRow?.expectedRcUpc ||
        preMappedUpc ||
        ''
    ).toUpperCase();
    const soldDate = String(r.soldDate || r.date || new Date().toISOString().slice(0, 10)).trim();
    const paidDate = normalizeValidPaidDate(r.paidDate);

    // Preserve all `/payouts` rows as `pending_payout` — never reclassify an unpaid row as `paid` when paidDate is empty or placeholder
    const rawPayoutStatus = String(r.payoutStatus || '').toLowerCase().trim();
    const rawRowStatus = String(r.status || '').toLowerCase().trim();
    const payoutStatus: 'pending_payout' | 'paid' =
      rawPayoutStatus === 'pending_payout' || rawRowStatus === 'unpaid'
        ? 'pending_payout'
        : rawPayoutStatus === 'paid' || Boolean(paidDate) || rawRowStatus === 'paid'
          ? 'paid'
          : 'pending_payout';
    const status = payoutStatus === 'paid' ? 'Paid' : 'Sold';

    const rawNetInput =
      r.ricoNetPayout !== undefined && r.ricoNetPayout !== null && !isNaN(Number(r.ricoNetPayout))
        ? Number(Number(r.ricoNetPayout).toFixed(2))
        : 0;
    const splitPctNum = parseFloat(String(r.splitPct || `${100 - feePct}`).replace(/[^0-9.]/g, '')) || 100 - feePct;
    let agreedPrice = Math.max(
      0,
      Number(Number(r.agreedPrice ?? r.grossPrice ?? r.listedPrice ?? r.price ?? 0).toFixed(2))
    );
    // If Paid History only provided Net (`Cost/Split`) or set gross === net on an 85% split, derive sticker gross when needed
    if (agreedPrice === 0 && rawNetInput > 0 && splitPctNum > 0 && splitPctNum < 100) {
      agreedPrice = Number((rawNetInput / (splitPctNum / 100)).toFixed(2));
    }
    const agedPrice = Math.max(0, Number(Number(r.agedPrice ?? agreedPrice).toFixed(2)));
    const grossPrice = Math.max(
      0,
      Number(Number(r.grossPrice ?? (agedPrice > 0 ? agedPrice : agreedPrice)).toFixed(2))
    );
    const splitPct = String(r.splitPct || `${100 - feePct}.00%`).trim();
    const discounts = String(r.discounts || '').trim();
    const expectedFee = Number((grossPrice * (feePct / 100)).toFixed(2));
    const expectedNetPayout = Number((grossPrice - expectedFee).toFixed(2));
    const ricoCommission =
      r.ricoCommission !== undefined && r.ricoCommission !== null && !isNaN(Number(r.ricoCommission))
        ? Number(Number(r.ricoCommission).toFixed(2))
        : expectedFee;
    const ricoNetPayout = rawNetInput > 0 ? rawNetInput : expectedNetPayout;

    // Delegate matching directly to canonical `matchMemoryDenInventoryItem` + 4-tier index
    let matchedItem: any = null;
    let matchTier: 'upc' | 'sku' | 'title_price' | 'title' | 'unmatched' = 'unmatched';
    const titleSlug = normalizeTitleForMdMatch(rawTitle);
    const agreedKey = grossPrice.toFixed(2);

    if (upc && byUpc.has(upc)) {
      matchedItem = byUpc.get(upc);
      matchTier = 'upc';
    } else if (rawSku && bySku.has(rawSku)) {
      matchedItem = bySku.get(rawSku);
      matchTier = 'sku';
    } else if (eligibleItems.length > 0) {
      const canonicalHit = matchMemoryDenInventoryItem({
        sku: rawSku,
        upc,
        title: rawTitle,
        price: grossPrice,
        extraText: '',
        allowPrefixForPayout: true,
        activeItems: eligibleItems,
        claimedItemIdToSku,
        multiBinResolvedBySku,
      });
      if (canonicalHit) {
        matchedItem = canonicalHit;
        matchTier =
          upc && cleanCatalogSku(canonicalHit.upc).toUpperCase() === upc
            ? 'upc'
            : rawSku && cleanCatalogSku(canonicalHit.locationSku).toUpperCase() === rawSku
              ? 'sku'
              : Number(canonicalHit.boutiquePrice ?? canonicalHit.resalePrice ?? canonicalHit.price ?? 0).toFixed(2) === agreedKey
                ? 'title_price'
                : 'title';
      }
    }

    if (!matchedItem && titleSlug && byTitlePrice.has(`${titleSlug}|${agreedKey}`)) {
      matchedItem = byTitlePrice.get(`${titleSlug}|${agreedKey}`);
      matchTier = 'title_price';
    } else if (!matchedItem && titleSlug && byTitle.has(titleSlug)) {
      matchedItem = byTitle.get(titleSlug);
      matchTier = 'title';
    } else if (!matchedItem && titleSlug && titleSlug.length >= 10) {
      // Prefix containment fallback for Ricochet truncated titles
      for (const [indexedTitle, candItem] of byTitle.entries()) {
        if (indexedTitle.length >= 10 && (indexedTitle.startsWith(titleSlug) || titleSlug.startsWith(indexedTitle))) {
          matchedItem = candItem;
          matchTier = 'title';
          break;
        }
      }
    }

    const effectiveSku =
      rawSku ||
      cleanCatalogSku(matchedItem?.locationSku || catalogRow?.sku || '').toUpperCase();
    let effectiveUpc =
      upc ||
      cleanCatalogSku(matchedItem?.upc || catalogRow?.upc || catalogRow?.expectedRcUpc || '').toUpperCase() ||
      (effectiveSku && PREVERIFIED_MD_SKU_TO_UPC_OR_ID[effectiveSku]) ||
      '';

    const rowIsBb = isBbConsignorRow({ sku: effectiveSku, upc: effectiveUpc, title: rawTitle });
    if (rowIsBb && !effectiveUpc) {
      effectiveUpc = effectiveSku ? `BB-${effectiveSku}` : 'BB-CONSIGNOR';
    }

    const isZeroEjCatalogSku = Boolean(
      effectiveSku &&
        (PREVERIFIED_MD_SKU_TO_UPC_OR_ID[effectiveSku] ||
          bySku.has(effectiveSku) ||
          catalogBySku.has(effectiveSku) ||
          (/^0EJ[A-Z0-9]+$/i.test(effectiveSku) && Boolean(cleanPayoutId || saleNumber || soldDate)))
    );
    if (matchTier === 'unmatched' && effectiveUpc) {
      matchTier = 'upc';
    } else if (matchTier === 'unmatched' && (effectiveSku || isZeroEjCatalogSku || rowIsBb)) {
      matchTier = 'sku';
    } else if (matchTier === 'unmatched' && (r.isMatchedInBooth || r.matchStatus === 'matched')) {
      matchTier = (r.matchTier && r.matchTier !== 'unmatched' ? r.matchTier : 'sku') as any;
    }

    const effectiveTitle = rawTitle || matchedItem?.title || catalogRow?.name || effectiveSku || 'Booth Sale Item';
    const grossKey = grossPrice.toFixed(2);
    const netKey = ricoNetPayout.toFixed(2);
    const rowMonth = pacificMonthKey(soldDate);
    const isItemAlreadySoldInDb =
      matchedItem &&
      (String(matchedItem.status || '').toLowerCase() === 'sold' || Boolean(matchedItem.saleId)) &&
      !PREVERIFIED_MD_MULTI_QTY_BINS[effectiveSku];
    const isSaleInLedger =
      (cleanPayoutId && existingOrderIds.has(`${cleanPayoutId.toUpperCase()}|${grossKey}`)) ||
      (cleanPayoutId && existingOrderIds.has(`${cleanPayoutId.toUpperCase()}|${netKey}`)) ||
      (cleanPayoutId && existingOrderIds.has(`TICKET #${cleanPayoutId.toUpperCase()}|${grossKey}`)) ||
      (cleanPayoutId && existingOrderIds.has(`TICKET #${cleanPayoutId.toUpperCase()}|${netKey}`)) ||
      (cleanPayoutId && existingOrderIds.has(`TICKET #${cleanPayoutId.toUpperCase()}`)) ||
      (effectiveSku && existingSkuGrossSet.has(`${effectiveSku}|${grossKey}`)) ||
      (effectiveSku && existingSkuNetSet.has(`${effectiveSku}|${netKey}`)) ||
      (effectiveSku && rowMonth && existingSkuGrossSet.has(`${effectiveSku}|${rowMonth}`)) ||
      (effectiveUpc && existingSkuGrossSet.has(`${effectiveUpc}|${grossKey}`)) ||
      (effectiveUpc && existingSkuNetSet.has(`${effectiveUpc}|${netKey}`)) ||
      (effectiveUpc && rowMonth && existingSkuGrossSet.has(`${effectiveUpc}|${rowMonth}`)) ||
      (titleSlug && rowMonth && existingTitleMonthSet.has(`${titleSlug}|${rowMonth}|${grossKey}`)) ||
      (titleSlug && rowMonth && existingTitleMonthSet.has(`${titleSlug}|${rowMonth}|${netKey}`));

    const isMatched = Boolean(matchedItem?.$id || matchTier !== 'unmatched');
    const partnerBucket = resolvePartnerBucketForSaleRow({
      ricoSku: effectiveSku,
      sku: effectiveSku,
      upc: effectiveUpc,
      matchedItemUpc: matchedItem?.upc || effectiveUpc,
      title: effectiveTitle,
      matchedItemTitle: matchedItem?.title,
    });
    const isSynced = Boolean(r.alreadySynced || r.alreadyRecorded || isItemAlreadySoldInDb || isSaleInLedger);

    return {
      ricoItemId: resolveEffectiveRicoId(r, effectiveSku, cleanPayoutId, idx),
      ricoSku: effectiveSku,
      sku: effectiveSku,
      upc: effectiveUpc,
      title: effectiveTitle,
      saleNumber,
      soldDate,
      paidDate,
      agreedPrice,
      splitPct,
      agedPrice,
      discounts,
      grossPrice,
      ricoNetPayout,
      ricoCommission,
      payoutId: cleanPayoutId || saleNumber,
      payoutStatus,
      status,
      expectedFee,
      expectedNetPayout,
      matchedItemId: matchedItem?.$id || r.matchedItemId || undefined,
      matchedItemUpc: matchedItem?.upc || effectiveUpc || undefined,
      matchedItemTitle: matchedItem?.title || r.matchedItemTitle || undefined,
      matchedItemCost: matchedItem?.cost !== undefined ? Number(matchedItem.cost || 0) : r.matchedItemCost,
      matchTier,
      matchStatus: isMatched ? 'matched' : 'unmatched',
      partnerBucket,
      alreadySynced: isSynced,
      alreadyRecorded: isSynced,
      ticketOccurrence: Number(r.ticketOccurrence || 1),
    };
  });

  // Canonical occurrence-indexed fingerprint & ledger idempotency from `salesBucketing.ts`
  assignOccurrenceFingerprints(normalizedRows as any[], {
    getSaleNumber: (r) => r.payoutId || r.saleNumber || r.sku,
    getSoldDate: (r) => r.soldDate,
    getGross: (r) => r.grossPrice,
    getNet: (r) => r.ricoNetPayout,
    getSku: (r) => r.sku,
    getUpc: (r) => r.upc || r.matchedItemUpc,
    getTitle: (r) => r.title,
  });

  flagAlreadyRecordedRows(normalizedRows as any[], allSales, {
    getSaleNumber: (r) => r.payoutId || r.saleNumber || r.sku,
    getSoldDate: (r) => r.soldDate,
    getGross: (r) => r.grossPrice,
    getNet: (r) => r.ricoNetPayout,
    getSku: (r) => r.sku,
    getUpc: (r) => r.upc || r.matchedItemUpc,
    getTitle: (r) => r.title,
  });

  for (const r of normalizedRows as any[]) {
    if (r.isAlreadyRecorded || r.alreadySynced) {
      r.alreadySynced = true;
      r.alreadyRecorded = true;
      r.isAlreadyRecorded = true;
    }
    if (r.occurrenceIndex) {
      r.ticketOccurrence = r.occurrenceIndex;
    }
  }

  let grossSales = 0;
  let expectedCommission = 0;
  let expectedNetPayout = 0;
  let pendingPayoutCount = 0;
  let pendingPayoutNet = 0;
  let paidHistoryCount = 0;
  let paidHistoryNet = 0;
  let matchedCount = 0;
  let alreadySyncedCount = 0;
  let unmatchedCount = 0;

  for (const r of normalizedRows) {
    const netVal = Number(r.ricoNetPayout ?? r.expectedNetPayout ?? 0);
    grossSales += Number(r.grossPrice || 0);
    expectedCommission += Number(r.expectedFee ?? r.ricoCommission ?? 0);
    expectedNetPayout += netVal;
    if (r.payoutStatus === 'paid') {
      paidHistoryCount++;
      paidHistoryNet += netVal;
    } else {
      pendingPayoutCount++;
      pendingPayoutNet += netVal;
    }
    if (r.alreadySynced) alreadySyncedCount++;
    if (r.matchedItemId || r.matchTier !== 'unmatched') matchedCount++;
    else unmatchedCount++;
  }

  const adjustments: SpaceRentalAdjustment[] = Array.isArray(params.spaceRentalAdjustments)
    ? params.spaceRentalAdjustments
    : [];
  let spaceRentalTotal = 0;
  if (adjustments.length > 0) {
    for (const adj of adjustments) {
      spaceRentalTotal += Number(adj.amount || 0);
    }
  } else if (monthlyRent > 0) {
    spaceRentalTotal = -Math.abs(monthlyRent);
  }

  grossSales = Number(grossSales.toFixed(2));
  expectedCommission = Number(expectedCommission.toFixed(2));
  expectedNetPayout = Number(expectedNetPayout.toFixed(2));
  pendingPayoutNet = Number(pendingPayoutNet.toFixed(2));
  paidHistoryNet = Number(paidHistoryNet.toFixed(2));
  spaceRentalTotal = Number(spaceRentalTotal.toFixed(2));
  const netAfterRent = Number((expectedNetPayout - monthlyRent).toFixed(2));

  return {
    timestamp: new Date().toISOString(),
    locationCode: locMeta.code,
    locationName: locMeta.shortName,
    commissionRate: feePct,
    monthlyRent,
    dryRun: params.dryRun ?? true,
    spaceRentalAdjustments: adjustments,
    summary: {
      soldFound: normalizedRows.length,
      pendingPayoutCount,
      pendingPayoutNet,
      paidHistoryCount,
      paidHistoryNet,
      spaceRentalTotal,
      grossSales,
      expectedCommission,
      expectedNetPayout,
      netAfterRent,
      matchedCount,
      alreadySyncedCount,
      unmatchedCount,
    },
    rows: normalizedRows,
  };
}

export function buildSaleOrderReference(row: RicochetSyncSaleLine, locCode: string): {
  saleIso: string;
  orderRef: string;
  soNumber: string;
} {
  const saleIso = toSaleIso(row.soldDate) || new Date().toISOString();
  const ticket = canonicalTicketNumber(row.payoutId || row.saleNumber);
  const occ = Math.max(1, Number(row.ticketOccurrence || 1));
  const formattedTicket = ticket ? (occ > 1 ? `Ticket #${ticket} #${occ}` : `Ticket #${ticket}`) : '';
  const orderRef = formattedTicket || row.payoutId || row.sku || `RICO-${locCode}-${saleIso.slice(0, 10)}`;
  const soNumber =
    row.upc || row.matchedItemUpc || row.sku || `SO-${Date.now().toString().slice(-5)}`;
  return { saleIso, orderRef, soNumber };
}


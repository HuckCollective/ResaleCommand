import { parsePriceRange } from './bundle-pricing';
import { buildLockedMultiBinMap, cleanCatalogSku } from './salesBucketing';
import {
  getAllLocationSettingMetas,
  getLocationSettingMeta,
  resolveCanonicalLocationCode,
  type LocationSettingMeta,
} from './warehouses';

export const MANIFESTS_COL = 'manifests';
export const AI_APPRAISAL_RULES_DOC_ID = 'ai_appraisal_rules_v1';

export type ScanKind = 'scout' | 'deep';

export interface ScoutPriorSummary {
  scoutedAt: string;
  estimatedLow: number;
  estimatedHigh: number;
  midpoint: number;
  boutiquePrice: number | null;
  fairPrice: number | null;
  maxTargetBid: number | null;
  verdict: string | null;
  recommendedVenue: string | null;
}

export interface AppraisalCategoryNote {
  key: string;
  label: string;
  keywords: string[];
  note: string; // <= 120 chars
}

export interface AppraisalRulesConfig {
  version: number;
  updatedAt: string;
  roiTargets: {
    conservative: number;
    balanced: number;
    aggressive: number;
  };
  /** Multipliers (0.5 - 1.5) keyed strictly by canonical location code (Law 2: names/fees/rent come from warehouses.ts) */
  venueBias: Record<string, number>;
  channelFees: {
    ebayPct: number;
    ebayFixedUsd: number;
    poshmarkPct: number;
    poshmarkUnder15FlatUsd: number;
  };
  categoryNotes: AppraisalCategoryNote[];
}

export type AccuracyChip = 'on_target' | 'under_priced_gem' | 'over_estimated';

export interface CalibrationScoredRow {
  id: string;
  itemId: string;
  kind: 'single_item' | 'split_lot';
  title: string;
  upc: string;
  locationSku: string;
  venueCode: string;
  venueLabel: string;
  category: string;
  scoutLow: number;
  scoutHigh: number;
  scoutMidpoint: number;
  taggedPrice: number;
  soldUnitGross: number;
  soldUnitNet: number;
  realizationPct: number;
  tagVsScoutPct: number | null;
  chip: AccuracyChip;
  soldDate: string | null;
  daysToSell: number | null;
  childCount?: number;
  soldChildCount?: number;
  imageId?: string;
  galleryImageIds?: string[];
}

export interface BinSellThroughRow {
  itemId: string;
  sku: string;
  upc: string;
  title: string;
  venueCode: string;
  venueLabel: string;
  unitsStocked: number;
  unitsSold: number;
  sellThroughPct: number;
  grossSold: number;
  medianUnitPrice: number;
  imageId?: string;
  galleryImageIds?: string[];
}

export interface AgedUnsoldCandidate {
  itemId: string;
  title: string;
  upc: string;
  venueCode: string;
  venueLabel: string;
  category: string;
  ageDays: number;
  scoutMidpoint: number | null;
  taggedPrice: number;
  cost: number;
  imageId?: string;
  galleryImageIds?: string[];
}

export interface SegmentAccuracySummary {
  key: string;
  label: string;
  sampleSize: number;
  suppressed: boolean;
  neededMoreCount: number;
  medianRealizationPct: number | null;
  iqrLowPct: number | null;
  iqrHighPct: number | null;
  medianNetUsd: number | null;
  medianDaysToSell: number | null;
  suggestedMultiplier: number | null;
}

export interface EstimateVsSoldScorecard {
  windowDays: number;
  generatedAt: string;
  headline: {
    sampleSize: number;
    medianRealizationPct: number | null;
    iqrLowPct: number | null;
    iqrHighPct: number | null;
    onTargetCount: number;
    underPricedGemCount: number;
    overEstimatedCount: number;
    medianDaysToSell: number | null;
    linkCoveragePct: number;
    lowConfidence: boolean;
    eligibleSoldItems: number;
    totalLinkedSoldItems: number;
  };
  excludedBreakdown: {
    boothBinUnits: number;
    unlinkedTickets: number;
    missingPreBuyEstimate: number;
    inProgressSplitLots: number;
    outsideDateWindow: number;
    invalidDateClamped: number;
  };
  rows: CalibrationScoredRow[];
  byVenue: SegmentAccuracySummary[];
  byCategory: SegmentAccuracySummary[];
  binSellThrough: BinSellThroughRow[];
  agedUnsoldCandidates: AgedUnsoldCandidate[];
}

/**
 * Safely normalizes any stored `rawAnalysis` value (JSON string, object, array wrapper, or null)
 * into a shallow-cloned plain object. Never throws.
 */
export function parseRawAnalysis(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const first = parsed[0];
        return first && typeof first === 'object' && !Array.isArray(first)
          ? { ...first, lot_items: parsed }
          : {};
      }
      if (parsed && typeof parsed === 'object') {
        return { ...(parsed as Record<string, any>) };
      }
    } catch {
      return {};
    }
    return {};
  }
  if (Array.isArray(raw)) {
    const first = raw[0];
    return first && typeof first === 'object' && !Array.isArray(first)
      ? { ...first, lot_items: raw }
      : {};
  }
  if (typeof raw === 'object') {
    return { ...(raw as Record<string, any>) };
  }
  return {};
}

function stripBlobAndDataUrls(val: any): any {
  if (!val) return val;
  if (typeof val === 'string') {
    if (val.startsWith('data:') || val.startsWith('blob:')) return undefined;
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(stripBlobAndDataUrls).filter((v) => v !== undefined);
  }
  if (typeof val === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      const cleaned = stripBlobAndDataUrls(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  return val;
}

function extractBoutiqueTagFromNotes(notes?: string | null): number {
  if (!notes || typeof notes !== 'string') return 0;
  const m = /\[Boutique:\s*\$([\d.]+)\]/i.exec(notes);
  return m && m[1] ? Math.max(0, parseFloat(m[1]) || 0) : 0;
}

function unwrapPrimaryAnalysisItem(obj: Record<string, any>): Record<string, any> {
  if (
    Array.isArray(obj.items) &&
    obj.items.length > 0 &&
    obj.items[0] &&
    typeof obj.items[0] === 'object' &&
    !obj.pricing_potential &&
    !obj.price_breakdown
  ) {
    return obj.items[0] as Record<string, any>;
  }
  return obj;
}

/**
 * Extracts a compact (<400 byte) `ScoutPriorSummary` from modern or legacy `rawAnalysis` shapes.
 * Uses `parsePriceRange` to guarantee zero digit-concatenation bugs on "$35 - $55" strings.
 */
export function extractScoutPriorSummary(
  rawInput: unknown,
  conditionNotes?: string | null
): ScoutPriorSummary | null {
  const outer = parseRawAnalysis(rawInput);
  if (
    outer.scoutPrior &&
    typeof outer.scoutPrior === 'object' &&
    Number(outer.scoutPrior.midpoint) > 0
  ) {
    const sp = outer.scoutPrior;
    return {
      scoutedAt: String(sp.scoutedAt || new Date().toISOString()).slice(0, 32),
      estimatedLow: Number(sp.estimatedLow) || Number(sp.midpoint) || 0,
      estimatedHigh: Number(sp.estimatedHigh) || Number(sp.midpoint) || 0,
      midpoint: Number(sp.midpoint) || 0,
      boutiquePrice: sp.boutiquePrice != null ? Number(sp.boutiquePrice) || null : null,
      fairPrice: sp.fairPrice != null ? Number(sp.fairPrice) || null : null,
      maxTargetBid: sp.maxTargetBid != null ? Number(sp.maxTargetBid) || null : null,
      verdict: sp.verdict ? String(sp.verdict).slice(0, 24) : null,
      recommendedVenue: sp.recommendedVenue ? String(sp.recommendedVenue).slice(0, 40) : null,
    };
  }

  const core = unwrapPrimaryAnalysisItem(outer);

  const fairRange = parsePriceRange(
    core.pricing_potential?.fair ??
      core.price_breakdown?.fair ??
      core.estimated_value ??
      (core.estimatedValueLow !== undefined || core.estimatedValueHigh !== undefined
        ? {
            low: core.estimatedValueLow ?? core.estimatedValueHigh ?? 0,
            high: core.estimatedValueHigh ?? core.estimatedValueLow ?? 0,
          }
        : core.fairPrice ?? 0)
  );

  const boutiqueRange = parsePriceRange(
    core.pricing_potential?.boutique ??
      core.price_breakdown?.boutique_premium ??
      core.boutiquePrice ??
      outer.boutiquePrice ??
      0
  );

  const notesBoutique = extractBoutiqueTagFromNotes(conditionNotes);
  const totalLotResale = Number(core.total_lot_resale || outer.total_lot_resale || 0);

  const fairMid =
    fairRange.high > 0 ? Number(((fairRange.low + fairRange.high) / 2).toFixed(2)) : fairRange.low;
  const boutiqueVal =
    boutiqueRange.high > 0
      ? Number(((boutiqueRange.low + boutiqueRange.high) / 2).toFixed(2))
      : notesBoutique > 0
        ? notesBoutique
        : 0;

  let low = fairRange.low > 0 ? fairRange.low : boutiqueRange.low > 0 ? boutiqueRange.low : 0;
  let high = fairRange.high > 0 ? fairRange.high : boutiqueRange.high > 0 ? boutiqueRange.high : 0;
  if (low <= 0 && totalLotResale > 0) {
    low = totalLotResale;
    high = totalLotResale;
  }
  if (low <= 0 && notesBoutique > 0) {
    low = notesBoutique;
    high = notesBoutique;
  }

  const midpoint =
    low > 0 && high > 0 ? Number(((low + high) / 2).toFixed(2)) : Math.max(low, high, boutiqueVal);

  if (midpoint <= 0) return null;

  const maxBidCandidate = Number(
    core.maxBid ??
      outer.maxBid ??
      core.max_target_bid ??
      core.purchase_strategy?.max_bid ??
      core.purchase_strategy?.max_landed_cost ??
      0
  );

  const verdictRaw =
    core.buy_recommendation ||
    core.verdict ||
    outer.buy_recommendation ||
    outer.verdict ||
    core.tier ||
    null;

  const venueRaw =
    core.market_report?.best_platform ||
    core.recommendedVenue ||
    outer.recommendedVenue ||
    null;

  const summary: ScoutPriorSummary = {
    scoutedAt: String(
      outer.scannedAt || core.scannedAt || outer.scoutedAt || new Date().toISOString()
    ).slice(0, 32),
    estimatedLow: Number(low.toFixed(2)),
    estimatedHigh: Number(high.toFixed(2)),
    midpoint: Number(midpoint.toFixed(2)),
    boutiquePrice: boutiqueVal > 0 ? Number(boutiqueVal.toFixed(2)) : null,
    fairPrice: fairMid > 0 ? Number(fairMid.toFixed(2)) : null,
    maxTargetBid: maxBidCandidate > 0 ? Number(maxBidCandidate.toFixed(2)) : null,
    verdict: verdictRaw ? String(verdictRaw).slice(0, 24) : null,
    recommendedVenue: venueRaw ? String(venueRaw).slice(0, 40) : null,
  };

  return summary;
}

/**
 * Non-destructive `rawAnalysis` lineage merger (Section 2b-B):
 * 1. Normalizes string/object inputs and ALWAYS returns a plain object (never double-stringifies).
 * 2. Carries forward unknown & bookmarklet keys (`sgwItemId`, `boutiquePrice`, `sellerId`, etc.) so SGW dedupe never breaks.
 * 3. `scoutPrior` is strictly write-once: preserved from existing Speed Scout, never overwritten by 2nd/3rd Deep Scans.
 * 4. Caps heavy arrays (`comparable_sales` <= 5, `red_flags` <= 6) and enforces <= 40,000 char serialized budget without slicing JSON.
 */
export function mergeAppraisalHistory(
  existingRaw: unknown,
  nextRaw: unknown,
  options?: {
    conditionNotes?: string | null;
    isPostBuyScan?: boolean;
    scanKind?: ScanKind;
  }
): Record<string, any> {
  const existingObj = stripBlobAndDataUrls(parseRawAnalysis(existingRaw)) || {};
  const nextObj = stripBlobAndDataUrls(parseRawAnalysis(nextRaw)) || {};

  if (Object.keys(nextObj).length === 0) {
    return typeof existingObj === 'object' && !Array.isArray(existingObj) ? existingObj : {};
  }

  const resolvedScanKind: ScanKind =
    options?.scanKind ||
    (nextObj.scanKind === 'deep' || options?.isPostBuyScan ? 'deep' : 'scout');

  // Write-once scoutPrior resolution
  let scoutPrior: ScoutPriorSummary | null = null;
  if (
    existingObj.scoutPrior &&
    typeof existingObj.scoutPrior === 'object' &&
    Number(existingObj.scoutPrior.midpoint) > 0
  ) {
    scoutPrior = extractScoutPriorSummary(existingObj, options?.conditionNotes);
  } else if (Object.keys(existingObj).length > 0 && existingObj.scanKind !== 'deep') {
    scoutPrior = extractScoutPriorSummary(existingObj, options?.conditionNotes);
  }

  if (!scoutPrior && resolvedScanKind === 'scout') {
    scoutPrior = extractScoutPriorSummary(nextObj, options?.conditionNotes);
  }

  // Carry forward all existing keys first, then overlay nextObj
  const merged: Record<string, any> = {
    ...existingObj,
    ...nextObj,
    scanKind: resolvedScanKind,
    scannedAt: String(nextObj.scannedAt || new Date().toISOString()).slice(0, 32),
  };

  // Protect critical sourcing & deduplication keys if nextObj lacked or nulled them
  const protectedLineageKeys = [
    'sgwItemId',
    'boutiquePrice',
    'sellerId',
    'sellerName',
    'shippingWeight',
    'canCombineShipping',
    'sourcingLocation',
    'auctionStatus',
  ];
  for (const key of protectedLineageKeys) {
    if (
      existingObj[key] !== undefined &&
      existingObj[key] !== null &&
      existingObj[key] !== '' &&
      (nextObj[key] === undefined || nextObj[key] === null || nextObj[key] === '')
    ) {
      merged[key] = existingObj[key];
    }
  }

  if (scoutPrior) {
    merged.scoutPrior = scoutPrior;
  }

  // Cap comparable_sales / comparables (max 5) and red_flags (max 6)
  const capScanArrays = (target: Record<string, any>) => {
    if (Array.isArray(target.comparable_sales)) {
      target.comparable_sales = target.comparable_sales.slice(0, 5);
    }
    if (Array.isArray(target.comparables)) {
      target.comparables = target.comparables.slice(0, 5);
    }
    if (Array.isArray(target.red_flags)) {
      target.red_flags = target.red_flags.slice(0, 6);
    }
  };

  capScanArrays(merged);
  if (Array.isArray(merged.items)) {
    merged.items = merged.items.map((it: any) => {
      if (it && typeof it === 'object') {
        const clone = { ...it };
        capScanArrays(clone);
        return clone;
      }
      return it;
    });
  }

  // Structured size guard (<= 40,000 chars) — NEVER slice a JSON string!
  const checkLen = () => JSON.stringify(merged).length;
  if (checkLen() > 40_000) {
    delete merged.original_scout_analysis;
    delete merged.fetched_images;
  }
  if (checkLen() > 40_000) {
    delete merged.comparables;
    delete merged.comparable_sales;
    if (Array.isArray(merged.items)) {
      merged.items.forEach((it: any) => {
        if (it && typeof it === 'object') {
          delete it.comparables;
          delete it.comparable_sales;
        }
      });
    }
  }
  if (checkLen() > 40_000 && Array.isArray(merged.lot_items)) {
    merged.lot_items = merged.lot_items.map((li: any) => {
      if (!li || typeof li !== 'object') return li;
      const { price_breakdown, image, image_url, ...rest } = li;
      return rest;
    });
  }
  if (checkLen() > 40_000) {
    delete merged.market_report;
    delete merged.keywords;
    delete merged.shipping_info;
  }

  return typeof merged === 'object' && !Array.isArray(merged) ? merged : {};
}

// ============================================================================
// SECTION D: LIVE CALIBRATION RULES (`ai_appraisal_rules_v1`) & <=600 CHAR PROMPT
// ============================================================================

export function getDefaultAppraisalRules(): AppraisalRulesConfig {
  const boothVenueBias: Record<string, number> = {};
  for (const meta of getAllLocationSettingMetas()) {
    if (meta.commissionRate > 0) {
      boothVenueBias[meta.code] = 1.0;
    }
  }

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    roiTargets: {
      conservative: 3.0,
      balanced: 2.2,
      aggressive: 1.7,
    },
    venueBias: boothVenueBias,
    channelFees: {
      ebayPct: 13.5,
      ebayFixedUsd: 0.4,
      poshmarkPct: 20.0,
      poshmarkUnder15FlatUsd: 2.95,
    },
    categoryNotes: [
      {
        key: 'ttrpg_games',
        label: 'TTRPG & Board Games',
        keywords: ['rpg', 'd&d', 'dungeons', 'warhammer', 'board game', 'magic', 'mtg', 'pathfinder'],
        note: 'Verify completeness; unpunched/boxed sets carry strong booth demand; incomplete games drop 45%.',
      },
      {
        key: 'apparel_outerwear',
        label: 'Vintage Apparel & Leather',
        keywords: ['jacket', 'leather', 'coat', 'shirt', 'tee', 'dress', 'denim', 'velvet', 'goth'],
        note: 'Anchor strictly to cleared sold comps (never MSRP). Extended sizes XL-XXL carry +15% liquidity.',
      },
      {
        key: 'jewelry_curios',
        label: 'Jewelry, Pins & Small Curios',
        keywords: ['ring', 'necklace', 'brooch', 'pin', 'sterling', '925', 'wand', 'tarot', 'pendant'],
        note: 'Small pocket items <8" fit low-fee curio cases; verify precious metal hallmarks before premium pricing.',
      },
      {
        key: 'vintage_media_paper',
        label: 'Books, Zines & Media',
        keywords: ['book', 'magazine', 'comic', 'vinyl', 'cassette', 'vhs', 'dvd', 'zine', 'manual'],
        note: 'Value from sold comps per line; extract standout titles as singles (quantity 1) and group like series/author/format items with a quantity.',
      },
    ],
  };
}

export function sanitizeRuleNote(input: unknown): string {
  const raw = String(input || '')
    .replace(/[\u0000-\u001F\u007F`<>]/g, ' ')
    .replace(
      /\b(?:ignore\s+(?:all\s+)?previous|disregard\s+instructions|system\s+prompt|override\s+schema)\b/gi,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();
  return raw.slice(0, 120);
}

export function sanitizeAppraisalRulesInput(
  patch: Partial<AppraisalRulesConfig>,
  current: AppraisalRulesConfig = getDefaultAppraisalRules()
): AppraisalRulesConfig {
  const clamp = (val: unknown, min: number, max: number, fallback: number): number => {
    const n = Number(val);
    if (isNaN(n)) return fallback;
    return Number(Math.min(max, Math.max(min, n)).toFixed(2));
  };

  const validCodes = new Set(getAllLocationSettingMetas().map((m) => m.code));
  const nextVenueBias: Record<string, number> = { ...current.venueBias };
  if (patch.venueBias && typeof patch.venueBias === 'object') {
    for (const [rawCode, mult] of Object.entries(patch.venueBias)) {
      const code = resolveCanonicalLocationCode(rawCode);
      if (code && validCodes.has(code)) {
        nextVenueBias[code] = clamp(mult, 0.5, 1.5, 1.0);
      }
    }
  }

  const nextNotes: AppraisalCategoryNote[] = Array.isArray(patch.categoryNotes)
    ? patch.categoryNotes
        .slice(0, 5)
        .map((n, idx) => ({
          key:
            String(n?.key || `cat_${idx + 1}`)
              .toLowerCase()
              .replace(/[^a-z0-9_]/g, '')
              .slice(0, 32) || `cat_${idx + 1}`,
          label: sanitizeRuleNote(n?.label || 'Category Rule').slice(0, 48),
          keywords: Array.isArray(n?.keywords)
            ? n.keywords
                .map((k) => sanitizeRuleNote(k).toLowerCase().slice(0, 24))
                .filter(Boolean)
                .slice(0, 10)
            : [],
          note: sanitizeRuleNote(n?.note || ''),
        }))
        .filter((n) => n.note.length > 0)
    : current.categoryNotes;

  return {
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
    roiTargets: {
      conservative: clamp(
        patch.roiTargets?.conservative,
        1.2,
        10.0,
        current.roiTargets.conservative
      ),
      balanced: clamp(patch.roiTargets?.balanced, 1.1, 8.0, current.roiTargets.balanced),
      aggressive: clamp(patch.roiTargets?.aggressive, 1.05, 6.0, current.roiTargets.aggressive),
    },
    venueBias: nextVenueBias,
    channelFees: {
      ebayPct: clamp(patch.channelFees?.ebayPct, 0, 40, current.channelFees.ebayPct),
      ebayFixedUsd: clamp(patch.channelFees?.ebayFixedUsd, 0, 5, current.channelFees.ebayFixedUsd),
      poshmarkPct: clamp(patch.channelFees?.poshmarkPct, 0, 40, current.channelFees.poshmarkPct),
      poshmarkUnder15FlatUsd: clamp(
        patch.channelFees?.poshmarkUnder15FlatUsd,
        0,
        10,
        current.channelFees.poshmarkUnder15FlatUsd
      ),
    },
    categoryNotes: nextNotes,
  };
}

/**
 * Compiles live calibration rules + dynamic `warehouses.ts` fees into a single prompt block
 * strictly <= 600 characters (~150 tokens), truncated only on complete rule lines (Section 2b-D).
 */
export function compileRulesPrompt(
  rules: AppraisalRulesConfig,
  liveWarehouses?: any[],
  itemHintText?: string
): string {
  const metas: LocationSettingMeta[] = getAllLocationSettingMetas(liveWarehouses);
  const retailBooths = metas.filter((m) => m.commissionRate > 0);

  const boothParts = retailBooths.map((m) => {
    const mult = rules.venueBias?.[m.code] ?? 1.0;
    const biasTag = mult !== 1.0 ? ` x${mult.toFixed(2)}` : '';
    return `${m.shortName}(${m.code}:${m.commissionRate}%fee${biasTag})`;
  });

  const headerLine = `[CALIBRATION v${rules.version}] ROI:${rules.roiTargets.conservative}x/${rules.roiTargets.balanced}x/${rules.roiTargets.aggressive}x | Booths:${boothParts.join(', ')} | Online:eBay ${rules.channelFees.ebayPct}%+$${rules.channelFees.ebayFixedUsd.toFixed(2)}, Posh ${rules.channelFees.poshmarkPct}%($${rules.channelFees.poshmarkUnder15FlatUsd.toFixed(2)}<$15).`;

  const hintLower = String(itemHintText || '').toLowerCase();
  const matchedNotes = (rules.categoryNotes || []).filter((cn) =>
    hintLower && cn.keywords?.length > 0
      ? cn.keywords.some((kw) => kw && hintLower.includes(kw.toLowerCase()))
      : false
  );
  const notesToEmit = matchedNotes.length > 0 ? matchedNotes.slice(0, 2) : [];

  const lines: string[] = [headerLine];
  for (const cn of notesToEmit) {
    if (!cn.note) continue;
    lines.push(`- ${cn.label}: ${sanitizeRuleNote(cn.note)}`);
  }

  // Enforce hard 600-character ceiling at complete line boundaries (never mid-sentence)
  let acc = '';
  for (const line of lines) {
    const candidate = acc ? `${acc}\n${line}` : line;
    if (candidate.length <= 600) {
      acc = candidate;
    } else if (!acc) {
      acc = line.slice(0, 597) + '...';
      break;
    } else {
      break;
    }
  }
  return acc;
}

const RULES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes per serverless instance
let cachedRules: { expiresAt: number; data: AppraisalRulesConfig } | null = null;

async function getServerDatabases() {
  if (typeof window !== 'undefined') return { databases: null, dbId: 'resale_db' };
  const endpoint =
    (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_APPWRITE_ENDPOINT) ||
    (typeof process !== 'undefined' && process.env?.PUBLIC_APPWRITE_ENDPOINT) ||
    'https://sfo.cloud.appwrite.io/v1';
  const project =
    (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_APPWRITE_PROJECT_ID) ||
    (typeof process !== 'undefined' && process.env?.PUBLIC_APPWRITE_PROJECT_ID) ||
    '69714b35003a8adab6bb';
  const apiKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.APPWRITE_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.APPWRITE_API_KEY) ||
    '';
  const dbId =
    (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_APPWRITE_DB_ID) ||
    (typeof process !== 'undefined' && process.env?.PUBLIC_APPWRITE_DB_ID) ||
    'resale_db';

  if (!endpoint || !project || !apiKey) return { databases: null, dbId };
  const { Client, Databases } = await import('node-appwrite');
  const client = new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey);
  return { databases: new Databases(client), dbId };
}

export async function loadAppraisalRules(forceRefresh = false): Promise<AppraisalRulesConfig> {
  if (!forceRefresh && cachedRules && cachedRules.expiresAt > Date.now()) {
    return cachedRules.data;
  }

  const defaults = getDefaultAppraisalRules();
  try {
    const { databases, dbId } = await getServerDatabases();
    if (!databases) return defaults;

    const doc: any = await databases.getDocument(dbId, MANIFESTS_COL, AI_APPRAISAL_RULES_DOC_ID);
    const raw = doc?.itemsSnapshot || doc?.notes;
    if (raw && typeof raw === 'string') {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const sanitized = sanitizeAppraisalRulesInput(parsed, {
          ...defaults,
          version: Math.max(0, (Number(parsed.version) || 1) - 1),
        });
        const cleanMediaNote =
          defaults.categoryNotes.find((cn) => cn.key === 'vintage_media_paper')?.note ||
          'Value from sold comps per line; extract standout titles as singles (quantity 1) and group like series/author/format items with a quantity.';
        sanitized.categoryNotes = (sanitized.categoryNotes || []).map((cn) => {
          if (/\$\s*10\s*[-–—]\s*\$?\s*15|common\s+issues\s+belong/i.test(String(cn.note || ''))) {
            return { ...cn, note: cleanMediaNote };
          }
          return cn;
        });
        sanitized.updatedAt = String(parsed.updatedAt || doc.$updatedAt || defaults.updatedAt);
        cachedRules = { expiresAt: Date.now() + RULES_CACHE_TTL_MS, data: sanitized };
        return sanitized;
      }
    }
  } catch {
    // Missing or unreadable rules doc -> safe built-in defaults (Speed Scout must never fail)
  }

  cachedRules = { expiresAt: Date.now() + RULES_CACHE_TTL_MS, data: defaults };
  return defaults;
}

export async function saveAppraisalRules(
  patch: Partial<AppraisalRulesConfig> & { expectedVersion?: number; resetToDefaults?: boolean }
): Promise<AppraisalRulesConfig> {
  const current = await loadAppraisalRules(true);
  if (
    typeof patch.expectedVersion === 'number' &&
    patch.expectedVersion !== current.version
  ) {
    throw new Error(
      `Calibration rules version conflict (expected v${patch.expectedVersion}, found v${current.version}). Refresh and try again.`
    );
  }

  const next: AppraisalRulesConfig = patch.resetToDefaults
    ? {
        ...getDefaultAppraisalRules(),
        version: current.version + 1,
        updatedAt: new Date().toISOString(),
      }
    : sanitizeAppraisalRulesInput(patch, current);

  const serialized = JSON.stringify(next);
  if (serialized.length > 30_000) {
    throw new Error('Appraisal rules payload exceeds 30KB safety limit.');
  }

  const { databases, dbId } = await getServerDatabases();
  if (databases) {
    const { Permission, Role } = await import('node-appwrite');
    const payload = {
      name: 'AI Appraisal & Pricing Calibration Rules',
      tenantId: 'huck_collective',
      locationId: 'HG',
      locationName: 'System Calibration',
      status: 'placed',
      itemsSnapshot: serialized,
      notes: `v${next.version} updated ${next.updatedAt}`,
    };

    try {
      await databases.updateDocument(dbId, MANIFESTS_COL, AI_APPRAISAL_RULES_DOC_ID, payload);
    } catch {
      await databases.createDocument(
        dbId,
        MANIFESTS_COL,
        AI_APPRAISAL_RULES_DOC_ID,
        payload,
        [
          Permission.read(Role.any()),
          Permission.update(Role.any()),
          Permission.delete(Role.any()),
        ]
      );
    }
  }

  cachedRules = { expiresAt: Date.now() + RULES_CACHE_TTL_MS, data: next };
  return next;
}

// ============================================================================
// SECTION C: 10-RULE ESTIMATE-VS-SOLD CALIBRATION SCORECARD (`items` ⇄ `sales`)
// ============================================================================

function computeQuantile(sortedAsc: number[], q: number): number | null {
  if (!sortedAsc.length) return null;
  if (sortedAsc.length === 1) return Number(sortedAsc[0].toFixed(1));
  const pos = (sortedAsc.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sortedAsc[base + 1] !== undefined ? sortedAsc[base + 1] : sortedAsc[base];
  return Number((sortedAsc[base] + rest * (next - sortedAsc[base])).toFixed(1));
}

export function inferCalibrationCategory(item: any): string {
  const hay = [
    item?.title,
    item?.identity,
    item?.category,
    Array.isArray(item?.keywords) ? item.keywords.join(' ') : '',
    item?.conditionNotes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const isExplicitGameHardware = /\b(board\s*game|card\s*game|dice\s*set|polyhedral\s*dice|miniatures?|warhammer\s*40k|booster\s*box|starter\s*deck)\b/.test(
    hay
  );
  const isBookOrMedia = /\b(books?|hardcovers?|hardbacks?|paperbacks?|softcovers?|novels?|trilog(?:y|ies)|antholog(?:y|ies)|folios?|1st\s*ed(?:ition)?|first\s*edition|first\s*printing|dust\s*jacket|tomes?|almanacs?|guidebooks?|handbooks?|encyclopedias?|atlas|biograph(?:y|ies)|memoirs?|poetry|literature|fiction|non-?fiction|textbooks?|cookbooks?|artbooks?|magazines?|comics?|manga|graphic\s*novels?|zines?|vinyl|lps?|cassettes?|vhs|dvds?|cds?|blu-?rays?|audiobooks?|isbn|rulebook|sourcebook|pb|hc)\b/.test(
    hay
  );

  if (isBookOrMedia && !isExplicitGameHardware) {
    return 'Books & Media';
  }
  if (/\b(rpg|d&d|dungeons|warhammer|board\s*game|card\s*game|mtg|pathfinder|dice|miniature|ttrpg)\b/.test(hay)) {
    return 'TTRPG & Games';
  }
  if (/\b(jacket|coat|leather|shirt|tee|dress|skirt|boots|shoes|denim|jeans|sweater|hoodie|corset|velvet|blouse|vest|cardigan|pants|trousers|hat|cap|scarf|gloves|belt|apparel|clothing)\b/.test(hay)) {
    return 'Apparel & Outerwear';
  }
  if (/\b(ring|necklace|pendant|brooch|pin|earring|bracelet|sterling|925|wand|tarot|crystal|cameo|locket|cufflinks|jewelry)\b/.test(hay)) {
    return 'Jewelry & Curios';
  }
  if (/\b(camera|console|nintendo|sony|walkman|turntable|synth|audio|lens|electronic|gameboy|playstation|xbox|sega|atari|vcr|stereo|receiver)\b/.test(hay)) {
    return 'Electronics & Gear';
  }
  return 'Decor & Collectibles';
}

function parseTrueSoldTimestamp(dateStr: unknown): number | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  const ms = Date.parse(trimmed);
  return isNaN(ms) ? null : ms;
}

/**
 * Computes the Estimate-vs-Sold Truth Scorecard enforcing all 10 Red-Team Calibration Rules (Section 2b-C):
 * - C1: Per-unit normalization (`gross / qtySold`).
 * - C2: Multi-Qty Booth Bins excluded from accuracy %; reported separately in `binSellThrough`.
 * - C3: Split lots (`parentLotId`) scored once at lot level (>=75% children sold) without double-counting parent & children.
 * - C4: Unlinked register tickets excluded; reported as `linkCoveragePct` (`lowConfidence` if <70%).
 * - C5: Aged unsold >90 days surfaced as over-estimate candidates (not blended into sold realization %).
 * - C6: Median + IQR realization %, outliers at >130% / <70%, segment results suppressed until n >= 8.
 * - C7: Explicit eligibility counts (`eligibleSoldItems` vs `totalLinkedSoldItems`).
 * - C8: Net realized uses dynamic `warehouses.ts` commission rates (Law 2); rent never allocated per item.
 * - C9: True sold date only (`sale.saleDate` / `item.soldDate`); negative days-to-sell clamped & excluded.
 * - C10: Date-windowed (default 180 days).
 */
export function computeEstimateVsSoldScorecard(
  items: any[],
  sales: any[],
  liveWarehouses?: any[],
  options?: { windowDays?: number; now?: Date }
): EstimateVsSoldScorecard {
  const windowDays = options?.windowDays !== undefined ? options.windowDays : 180;
  const now = options?.now || new Date();
  const nowMs = now.getTime();
  const cutoffMs = windowDays > 0 ? nowMs - windowDays * 86_400_000 : 0;

  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  const safeSales = Array.isArray(sales) ? sales.filter(Boolean) : [];

  // Identify Multi-Qty Booth Bins via canonical salesBucketing helper + quantity > 1 check
  const multiBinMap = buildLockedMultiBinMap(safeItems);
  const binSkus = new Set<string>(Array.from(multiBinMap.keys()).map((s) => s.toUpperCase()));
  const binItemIds = new Set<string>();

  for (const it of safeItems) {
    const sku = cleanCatalogSku(it.locationSku || it.sku).toUpperCase();
    const qty = Number(it.quantity ?? 1);
    const notes = String(it.conditionNotes || '');
    const isSoldUnitClone = /\(sold unit\)/i.test(String(it.title || ''));
    if (
      !isSoldUnitClone &&
      (binSkus.has(sku) ||
        (qty > 1 && String(it.status || '').toLowerCase() !== 'sold' && Boolean(sku)) ||
        /booth\s*bin/i.test(notes))
    ) {
      binItemIds.add(it.$id);
      if (sku) binSkus.add(sku);
    }
  }

  // Map items by $id, saleId, UPC, and non-bin locationSku
  const itemById = new Map<string, any>();
  const itemsBySaleId = new Map<string, any[]>();
  const itemByCode = new Map<string, any>();
  const childrenByParentId = new Map<string, any[]>();

  for (const it of safeItems) {
    if (!it.$id) continue;
    itemById.set(it.$id, it);

    if (it.saleId) {
      const sid = String(it.saleId).trim();
      if (!itemsBySaleId.has(sid)) itemsBySaleId.set(sid, []);
      itemsBySaleId.get(sid)!.push(it);
    }

    const upc = cleanCatalogSku(it.upc).toUpperCase();
    if (upc && !binItemIds.has(it.$id)) {
      itemByCode.set(upc, it);
    }
    const locSku = cleanCatalogSku(it.locationSku).toUpperCase();
    if (locSku && !binSkus.has(locSku) && !binItemIds.has(it.$id)) {
      itemByCode.set(locSku, it);
    }

    if (it.parentLotId) {
      const pid = String(it.parentLotId).trim();
      if (!childrenByParentId.has(pid)) childrenByParentId.set(pid, []);
      childrenByParentId.get(pid)!.push(it);
    }
  }

  let boothBinUnits = 0;
  let unlinkedTickets = 0;
  let missingPreBuyEstimate = 0;
  let inProgressSplitLots = 0;
  let outsideDateWindow = 0;
  let invalidDateClamped = 0;

  let totalWindowSalesCount = 0;
  let linkedWindowSalesCount = 0;

  // Track bin unit sales
  const binStatsById = new Map<
    string,
    { item: any; unitsSold: number; grossSold: number; unitPrices: number[] }
  >();
  for (const bid of binItemIds) {
    const bit = itemById.get(bid);
    if (bit) {
      binStatsById.set(bid, { item: bit, unitsSold: 0, grossSold: 0, unitPrices: [] });
    }
  }

  // Map matched itemId -> realized sale info
  interface RealizedSaleInfo {
    unitGross: number;
    unitNet: number;
    soldDateIso: string | null;
    soldMs: number | null;
    venueCode: string;
  }
  const realizedByItemId = new Map<string, RealizedSaleInfo>();

  for (const sale of safeSales) {
    const st = String(sale.status || '').toLowerCase();
    if (st === 'cancelled' || st === 'refunded' || st === 'void') continue;

    const soldMs = parseTrueSoldTimestamp(sale.saleDate);
    if (cutoffMs > 0 && soldMs !== null && soldMs < cutoffMs) {
      outsideDateWindow++;
      continue;
    }

    totalWindowSalesCount++;

    const linkedItems = itemsBySaleId.get(sale.$id) || [];
    let matchedItem = linkedItems[0] || null;
    if (!matchedItem) {
      const ordCode = cleanCatalogSku(sale.orderId || sale.soNumber).toUpperCase();
      if (ordCode && itemByCode.has(ordCode)) {
        matchedItem = itemByCode.get(ordCode);
      }
    }

    if (!matchedItem) {
      // Check if orderId/soNumber references a known Booth Bin SKU
      const rawRef = String(sale.orderId || sale.soNumber || '').toUpperCase();
      let matchedBinId: string | null = null;
      for (const [bid, entry] of binStatsById.entries()) {
        const bSku = cleanCatalogSku(entry.item.locationSku).toUpperCase();
        const bUpc = cleanCatalogSku(entry.item.upc).toUpperCase();
        if ((bSku && rawRef.includes(bSku)) || (bUpc && rawRef.includes(bUpc))) {
          matchedBinId = bid;
          break;
        }
      }
      if (matchedBinId) {
        linkedWindowSalesCount++;
        boothBinUnits++;
        const entry = binStatsById.get(matchedBinId)!;
        const gross = Math.max(0, Number(sale.grossAmount) || 0);
        entry.unitsSold += 1;
        entry.grossSold += gross;
        if (gross > 0) entry.unitPrices.push(gross);
        continue;
      }

      unlinkedTickets++;
      continue;
    }

    linkedWindowSalesCount++;

    // Check if matched item IS a Booth Bin or a `(Sold Unit)` child of a Booth Bin
    const isSoldUnitClone = /\(sold unit\)/i.test(String(matchedItem.title || ''));
    const binOwnerId = binItemIds.has(matchedItem.$id)
      ? matchedItem.$id
      : matchedItem.parentLotId && binItemIds.has(matchedItem.parentLotId)
        ? matchedItem.parentLotId
        : null;

    if (binOwnerId || isSoldUnitClone) {
      boothBinUnits++;
      if (binOwnerId && binStatsById.has(binOwnerId)) {
        const entry = binStatsById.get(binOwnerId)!;
        const gross = Math.max(0, Number(sale.grossAmount) || Number(matchedItem.soldPrice) || 0);
        entry.unitsSold += 1;
        entry.grossSold += gross;
        if (gross > 0) entry.unitPrices.push(gross);
      }
      continue;
    }

    // Per-unit normalization (C1) + Dynamic venue commission net (C8)
    const itemCountOnTicket = Math.max(1, linkedItems.length);
    const grossShare = Math.max(0, Number(sale.grossAmount) || 0) / itemCountOnTicket;
    const venueCode =
      resolveCanonicalLocationCode(
        sale.warehouseId || matchedItem.storageLocation,
        liveWarehouses
      ) || 'ONLINE';
    const locMeta =
      venueCode !== 'ONLINE' ? getLocationSettingMeta(venueCode, liveWarehouses) : null;
    const commPct = locMeta ? locMeta.commissionRate : 13.5;

    const netShare =
      Number(sale.netPayout) > 0
        ? Number(sale.netPayout) / itemCountOnTicket
        : Number((grossShare * (1 - commPct / 100)).toFixed(2));

    for (const li of linkedItems.length > 0 ? linkedItems : [matchedItem]) {
      if (binItemIds.has(li.$id) || /\(sold unit\)/i.test(String(li.title || ''))) continue;
      const qtySold = 1; // Non-bin physical items sell as single units
      realizedByItemId.set(li.$id, {
        unitGross: Number((grossShare / qtySold).toFixed(2)),
        unitNet: Number((netShare / qtySold).toFixed(2)),
        soldDateIso: sale.saleDate || li.soldDate || null,
        soldMs: soldMs ?? parseTrueSoldTimestamp(li.soldDate),
        venueCode,
      });
    }
  }

  // Also capture items marked `status: 'sold'` with `soldPrice > 0` whose sale doc wasn't linked by saleId
  for (const it of safeItems) {
    if (realizedByItemId.has(it.$id)) continue;
    if (binItemIds.has(it.$id) || /\(sold unit\)/i.test(String(it.title || ''))) continue;
    if (String(it.status || '').toLowerCase() !== 'sold') continue;
    const soldPrice = Number(it.soldPrice) || 0;
    if (soldPrice <= 0) continue;

    const soldMs = parseTrueSoldTimestamp(it.soldDate);
    if (cutoffMs > 0 && soldMs !== null && soldMs < cutoffMs) continue;

    const venueCode =
      resolveCanonicalLocationCode(it.warehouseId || it.storageLocation, liveWarehouses) ||
      'ONLINE';
    const locMeta =
      venueCode !== 'ONLINE' ? getLocationSettingMeta(venueCode, liveWarehouses) : null;
    const commPct = locMeta ? locMeta.commissionRate : 13.5;
    const unitNet =
      Number(it.commissionPaid) > 0
        ? Math.max(0, soldPrice - Number(it.commissionPaid))
        : Number((soldPrice * (1 - commPct / 100)).toFixed(2));

    realizedByItemId.set(it.$id, {
      unitGross: Number(soldPrice.toFixed(2)),
      unitNet,
      soldDateIso: it.soldDate || null,
      soldMs,
      venueCode,
    });
  }

  const scoredRows: CalibrationScoredRow[] = [];
  const parentLotsHandledChildren = new Set<string>();
  let totalLinkedSoldItems = 0;
  let eligibleSoldItems = 0;

  // C3: Evaluate Split Lots at lot level (never double-count parent & children)
  for (const [parentId, rawChildren] of childrenByParentId.entries()) {
    if (binItemIds.has(parentId)) continue;
    const parent = itemById.get(parentId);
    if (!parent) continue;

    const validChildren = rawChildren.filter(
      (c) => !/\(sold unit\)/i.test(String(c.title || '')) && !binItemIds.has(c.$id)
    );
    if (validChildren.length === 0) continue;

    const soldChildren = validChildren.filter((c) => realizedByItemId.has(c.$id));
    if (soldChildren.length === 0) continue;

    const parentPrior = extractScoutPriorSummary(parent.rawAnalysis, parent.conditionNotes);
    if (!parentPrior || parentPrior.midpoint <= 0) {
      continue;
    }

    // Require >= 75% of split children sold to roll up at lot level; otherwise score sold children individually
    if (soldChildren.length / validChildren.length < 0.75) {
      inProgressSplitLots += 1;
      continue;
    }

    for (const c of validChildren) {
      parentLotsHandledChildren.add(c.$id);
    }

    totalLinkedSoldItems += 1;
    eligibleSoldItems += 1;
    const totalChildTagged = validChildren.reduce(
      (s, c) => s + (Number(c.resalePrice) || 0),
      0
    );
    const totalChildGross = soldChildren.reduce(
      (s, c) => s + (realizedByItemId.get(c.$id)?.unitGross || 0),
      0
    );
    const totalChildNet = soldChildren.reduce(
      (s, c) => s + (realizedByItemId.get(c.$id)?.unitNet || 0),
      0
    );

    const realizationPct = Number(
      ((totalChildGross / parentPrior.midpoint) * 100).toFixed(1)
    );
    const tagVsScoutPct =
      totalChildTagged > 0
        ? Number(((totalChildTagged / parentPrior.midpoint) * 100).toFixed(1))
        : null;

    const latestSoldInfo = soldChildren
      .map((c) => realizedByItemId.get(c.$id)!)
      .sort((a, b) => (b.soldMs || 0) - (a.soldMs || 0))[0];

    const createdMs = Date.parse(parent.$createdAt || '');
    let daysToSell: number | null = null;
    if (latestSoldInfo?.soldMs && !isNaN(createdMs)) {
      const rawDays = Math.round((latestSoldInfo.soldMs - createdMs) / 86_400_000);
      if (rawDays < 0) {
        invalidDateClamped += 1;
      } else {
        daysToSell = rawDays;
      }
    }

    const venueCode = latestSoldInfo?.venueCode || 'MD';
    const venueLabel =
      venueCode === 'ONLINE'
        ? 'Online Channels'
        : getLocationSettingMeta(venueCode, liveWarehouses).shortName;

    const chip: AccuracyChip =
      realizationPct > 130
        ? 'under_priced_gem'
        : realizationPct < 70
          ? 'over_estimated'
          : 'on_target';

    scoredRows.push({
      id: `lot_${parent.$id}`,
      itemId: parent.$id,
      kind: 'split_lot',
      title: String(parent.title || parent.identity || 'Split Lot'),
      upc: String(parent.upc || ''),
      locationSku: String(parent.locationSku || ''),
      venueCode,
      venueLabel,
      category: inferCalibrationCategory(parent),
      scoutLow: parentPrior.estimatedLow,
      scoutHigh: parentPrior.estimatedHigh,
      scoutMidpoint: parentPrior.midpoint,
      taggedPrice: Number(totalChildTagged.toFixed(2)),
      soldUnitGross: Number(totalChildGross.toFixed(2)),
      soldUnitNet: Number(totalChildNet.toFixed(2)),
      realizationPct,
      tagVsScoutPct,
      chip,
      soldDate: latestSoldInfo?.soldDateIso || null,
      daysToSell,
      childCount: validChildren.length,
      soldChildCount: soldChildren.length,
      imageId: String(parent.imageId || soldChildren[0]?.imageId || ''),
      galleryImageIds: Array.isArray(parent.galleryImageIds) ? parent.galleryImageIds : [],
    });
  }

  // Evaluate standalone single items (excluding split parents, split children already rolled up, and Booth Bins)
  for (const [itemId, saleInfo] of realizedByItemId.entries()) {
    if (parentLotsHandledChildren.has(itemId)) continue;
    if (childrenByParentId.has(itemId)) continue; // Split parent lot is never scored standalone
    if (binItemIds.has(itemId)) continue;

    const item = itemById.get(itemId);
    if (!item) continue;
    const st = String(item.status || '').toLowerCase();
    if (st === 'deconstructed' || st === 'combined') continue;

    totalLinkedSoldItems += 1;
    const taggedPrice = Number(item.resalePrice) || 0;
    let prior = extractScoutPriorSummary(item.rawAnalysis, item.conditionNotes);
    if ((!prior || prior.midpoint <= 0) && taggedPrice > 0) {
      // Fallback to shelf tag baseline when an older booth item or split-lot book was priced without saving rawAnalysis JSON
      prior = {
        estimatedLow: Number((taggedPrice * 0.85).toFixed(2)),
        estimatedHigh: Number((taggedPrice * 1.15).toFixed(2)),
        midpoint: Number(taggedPrice.toFixed(2)),
        boutiquePrice: Number(taggedPrice.toFixed(2)),
        recommendedVenue: saleInfo.venueCode,
        scanKind: 'tag_baseline',
        scannedAt: String(item.$createdAt || new Date().toISOString()),
        rulesVersion: 1,
      };
    }
    if (!prior || prior.midpoint <= 0) {
      missingPreBuyEstimate += 1;
      continue;
    }

    eligibleSoldItems += 1;
    const realizationPct = Number(((saleInfo.unitGross / prior.midpoint) * 100).toFixed(1));
    const tagVsScoutPct =
      taggedPrice > 0 ? Number(((taggedPrice / prior.midpoint) * 100).toFixed(1)) : null;

    const createdMs = Date.parse(item.$createdAt || '');
    let daysToSell: number | null = null;
    if (saleInfo.soldMs && !isNaN(createdMs)) {
      const rawDays = Math.round((saleInfo.soldMs - createdMs) / 86_400_000);
      if (rawDays < 0) {
        invalidDateClamped += 1;
      } else {
        daysToSell = rawDays;
      }
    }

    const venueLabel =
      saleInfo.venueCode === 'ONLINE'
        ? 'Online Channels'
        : getLocationSettingMeta(saleInfo.venueCode, liveWarehouses).shortName;

    const chip: AccuracyChip =
      realizationPct > 130
        ? 'under_priced_gem'
        : realizationPct < 70
          ? 'over_estimated'
          : 'on_target';

    scoredRows.push({
      id: item.$id,
      itemId: item.$id,
      kind: 'single_item',
      title: String(item.title || item.identity || 'Untitled Item'),
      upc: String(item.upc || ''),
      locationSku: String(item.locationSku || ''),
      venueCode: saleInfo.venueCode,
      venueLabel,
      category: inferCalibrationCategory(item),
      scoutLow: prior.estimatedLow,
      scoutHigh: prior.estimatedHigh,
      scoutMidpoint: prior.midpoint,
      taggedPrice: Number(taggedPrice.toFixed(2)),
      soldUnitGross: saleInfo.unitGross,
      soldUnitNet: saleInfo.unitNet,
      realizationPct,
      tagVsScoutPct,
      chip,
      soldDate: saleInfo.soldDateIso,
      daysToSell,
      imageId: String(item.imageId || ''),
      galleryImageIds: Array.isArray(item.galleryImageIds) ? item.galleryImageIds : [],
    });
  }

  // Default sort: biggest absolute miss first (`|realizationPct - 100|`) per Section 2b-E
  scoredRows.sort(
    (a, b) => Math.abs(b.realizationPct - 100) - Math.abs(a.realizationPct - 100)
  );

  // Robust headline stats (C6: Median + IQR)
  const sortedPcts = scoredRows.map((r) => r.realizationPct).sort((a, b) => a - b);
  const sortedDays = scoredRows
    .map((r) => r.daysToSell)
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b);

  const onTargetCount = scoredRows.filter((r) => r.chip === 'on_target').length;
  const underPricedGemCount = scoredRows.filter((r) => r.chip === 'under_priced_gem').length;
  const overEstimatedCount = scoredRows.filter((r) => r.chip === 'over_estimated').length;

  const linkCoveragePct =
    totalWindowSalesCount > 0
      ? Math.round((linkedWindowSalesCount / totalWindowSalesCount) * 100)
      : 100;

  // Segment builder with n >= 8 suppression (C6)
  const buildSegments = (
    groupFn: (r: CalibrationScoredRow) => { key: string; label: string }
  ): SegmentAccuracySummary[] => {
    const groups = new Map<string, { label: string; rows: CalibrationScoredRow[] }>();
    for (const r of scoredRows) {
      const { key, label } = groupFn(r);
      if (!groups.has(key)) groups.set(key, { label, rows: [] });
      groups.get(key)!.rows.push(r);
    }

    return Array.from(groups.entries())
      .map(([key, g]) => {
        const n = g.rows.length;
        const suppressed = n < 8;
        const pcts = g.rows.map((x) => x.realizationPct).sort((a, b) => a - b);
        const nets = g.rows.map((x) => x.soldUnitNet).sort((a, b) => a - b);
        const days = g.rows
          .map((x) => x.daysToSell)
          .filter((d): d is number => d !== null)
          .sort((a, b) => a - b);

        const medPct = suppressed ? null : computeQuantile(pcts, 0.5);
        const suggestedMultiplier =
          !suppressed && medPct !== null && (medPct < 85 || medPct > 115)
            ? Number(Math.min(1.5, Math.max(0.5, medPct / 100)).toFixed(2))
            : null;

        return {
          key,
          label: g.label,
          sampleSize: n,
          suppressed,
          neededMoreCount: Math.max(0, 8 - n),
          medianRealizationPct: medPct,
          iqrLowPct: suppressed ? null : computeQuantile(pcts, 0.25),
          iqrHighPct: suppressed ? null : computeQuantile(pcts, 0.75),
          medianNetUsd: suppressed ? null : computeQuantile(nets, 0.5),
          medianDaysToSell: suppressed ? null : computeQuantile(days, 0.5),
          suggestedMultiplier,
        };
      })
      .sort((a, b) => b.sampleSize - a.sampleSize);
  };

  const byVenue = buildSegments((r) => ({ key: r.venueCode, label: r.venueLabel }));
  const byCategory = buildSegments((r) => ({ key: r.category, label: r.category }));

  // C2: Booth Bin Sell-Through summary
  const binSellThrough: BinSellThroughRow[] = Array.from(binStatsById.values())
    .map(({ item, unitsSold, grossSold, unitPrices }) => {
      const remaining = Math.max(1, Number(item.quantity ?? 1));
      const totalStocked = remaining + unitsSold;
      const sortedUnits = [...unitPrices].sort((a, b) => a - b);
      const vCode =
        resolveCanonicalLocationCode(item.storageLocation, liveWarehouses) || 'MD';
      const vMeta = getLocationSettingMeta(vCode, liveWarehouses);
      return {
        itemId: item.$id,
        sku: String(item.locationSku || ''),
        upc: String(item.upc || ''),
        title: String(item.title || 'Booth Bin'),
        venueCode: vCode,
        venueLabel: vMeta.shortName,
        unitsStocked: totalStocked,
        unitsSold,
        sellThroughPct:
          totalStocked > 0 ? Math.round((unitsSold / totalStocked) * 100) : 0,
        grossSold: Number(grossSold.toFixed(2)),
        medianUnitPrice:
          computeQuantile(sortedUnits, 0.5) ?? (Number(item.resalePrice) || 0),
        imageId: String(item.imageId || ''),
        galleryImageIds: Array.isArray(item.galleryImageIds) ? item.galleryImageIds : [],
      };
    })
    .filter((b) => b.unitsSold > 0 || b.unitsStocked > 1)
    .sort((a, b) => b.unitsSold - a.unitsSold);

  // C5: Aged Unsold >90 Days (censoring / survivorship guard)
  const agedUnsoldCandidates: AgedUnsoldCandidate[] = [];
  for (const it of safeItems) {
    if (!it.$id || binItemIds.has(it.$id) || childrenByParentId.has(it.$id)) continue;
    const st = String(it.status || '').toLowerCase();
    if (st !== 'placed' && st !== 'received' && st !== 'acquired' && st !== 'listed') continue;

    const createdMs = Date.parse(it.$createdAt || '');
    if (isNaN(createdMs)) continue;
    const ageDays = Math.floor((nowMs - createdMs) / 86_400_000);
    if (ageDays <= 90) continue;

    const prior = extractScoutPriorSummary(it.rawAnalysis, it.conditionNotes);
    const tagged = Number(it.resalePrice) || 0;
    if (!prior && tagged <= 0) continue;

    const vCode = resolveCanonicalLocationCode(it.storageLocation, liveWarehouses) || 'HG';
    const vMeta = getLocationSettingMeta(vCode, liveWarehouses);

    agedUnsoldCandidates.push({
      itemId: it.$id,
      title: String(it.title || it.identity || 'Aged Inventory Item'),
      upc: String(it.upc || ''),
      venueCode: vCode,
      venueLabel: vMeta.shortName,
      category: inferCalibrationCategory(it),
      ageDays,
      scoutMidpoint: prior ? prior.midpoint : null,
      taggedPrice: Number(tagged.toFixed(2)),
      cost: Number((Number(it.cost) || 0).toFixed(2)),
      imageId: String(it.imageId || ''),
      galleryImageIds: Array.isArray(it.galleryImageIds) ? it.galleryImageIds : [],
    });
  }
  agedUnsoldCandidates.sort((a, b) => b.ageDays - a.ageDays);

  return {
    windowDays,
    generatedAt: now.toISOString(),
    headline: {
      sampleSize: scoredRows.length,
      medianRealizationPct: computeQuantile(sortedPcts, 0.5),
      iqrLowPct: computeQuantile(sortedPcts, 0.25),
      iqrHighPct: computeQuantile(sortedPcts, 0.75),
      onTargetCount,
      underPricedGemCount,
      overEstimatedCount,
      medianDaysToSell: computeQuantile(sortedDays, 0.5),
      linkCoveragePct,
      lowConfidence: totalWindowSalesCount > 0 && linkCoveragePct < 70,
      eligibleSoldItems,
      totalLinkedSoldItems,
    },
    excludedBreakdown: {
      boothBinUnits,
      unlinkedTickets,
      missingPreBuyEstimate,
      inProgressSplitLots,
      outsideDateWindow,
      invalidDateClamped,
    },
    rows: scoredRows,
    byVenue,
    byCategory,
    binSellThrough,
    agedUnsoldCandidates: agedUnsoldCandidates.slice(0, 100),
  };
}

/**
 * Server-side cursor-paginated loader (`Query.orderDesc('$id')`) for the Truth Scorecard (Rule C10).
 */
export async function buildLiveEstimateVsSoldScorecardServer(
  windowDays = 180
): Promise<EstimateVsSoldScorecard> {
  const { databases, dbId } = await getServerDatabases();
  if (!databases) {
    return computeEstimateVsSoldScorecard([], [], [], { windowDays });
  }

  const { Query } = await import('node-appwrite');

  const paginateCollection = async (colId: string, maxPages = 30, selectFields?: string[]) => {
    const out: any[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < maxPages; page++) {
      const queries: string[] = [Query.orderDesc('$id'), Query.limit(100)];
      if (selectFields && selectFields.length > 0) {
        queries.push(Query.select(selectFields));
      }
      if (cursor) queries.push(Query.cursorAfter(cursor));
      const res = await databases.listDocuments(dbId, colId, queries);
      const docs = res.documents || [];
      out.push(...docs);
      if (docs.length < 100) break;
      cursor = docs[docs.length - 1].$id;
    }
    return out;
  };

  const [items, sales, warehousesRes] = await Promise.all([
    paginateCollection('items', 30, [
      '$id',
      '$createdAt',
      'title',
      'identity',
      'upc',
      'locationSku',
      'storageLocation',
      'warehouseId',
      'saleId',
      'parentLotId',
      'status',
      'quantity',
      'cost',
      'resalePrice',
      'soldPrice',
      'commissionPaid',
      'conditionNotes',
      'keywords',
      'rawAnalysis',
      'imageId',
    ]),
    paginateCollection('sales', 30),
    databases.listDocuments(dbId, 'warehouses', [Query.limit(50)]).catch(() => ({ documents: [] })),
  ]);

  return computeEstimateVsSoldScorecard(items, sales, warehousesRes.documents || [], {
    windowDays,
  });
}

import type { AppraisalRulesConfig } from './appraisalCalibration';
import {
  getDomainProfile,
  isPlaceholderSellerName,
  resolveSourcingDomain,
  type SourcingDomainKey,
} from './sourcingDomains';
import { getLocationSettingMeta } from './warehouses';

export const MAX_SWEEP_LOTS = 40;
export const MAX_SLEEPER_THUMBS = 8;

export type SweepVerdictBucket = 'HOT_FLIP' | 'COMBINE_PLAY' | 'SLEEPER' | 'PASS';
export type SweepChannelCode = 'MD' | 'DT' | 'eBay' | 'Poshmark';

export interface SweepCandidateInput {
  lotKey: string;
  itemId: string;
  externalItemId?: string;
  sourceUrl: string;
  domainKey?: SourcingDomainKey;
  platformName?: string;
  title: string;
  currentPrice: number;
  minimumBid?: number;
  shippingCost?: number | null;
  shippingWeightLbs?: number | null;
  buyersPremiumPct?: number;
  isAuction?: boolean;
  isSoftClose?: boolean;
  isBuyItNow?: boolean;
  isLocalPickupOnly?: boolean;
  bidCount?: number | null;
  timeLeft?: string;
  seller?: string;
  sellerId?: string | null;
  combineEligible?: boolean;
  combineMatchCount?: number;
  thumbnailUrl?: string;
}

export interface SweepAiLotAssessment {
  index: number;
  estBoutiqueLow: number;
  estBoutiqueHigh: number;
  estOnlineLow: number;
  estOnlineHigh: number;
  bestChannel: SweepChannelCode;
  isMultiItemLot?: boolean;
  isApparelOrBulky?: boolean;
  isSmallCollectibleUnder8In?: boolean;
  estWeightLbs?: number;
  needsDeepVision?: boolean;
  splitPlayHint?: string;
  oneLineWhy?: string;
}

export interface ScoredSweepLot {
  lotKey: string;
  itemId: string;
  externalItemId: string;
  sourceUrl: string;
  domainKey: SourcingDomainKey;
  platformName: string;
  title: string;
  thumbnailUrl: string;
  seller: string;
  currentPrice: number;
  minimumBid: number;
  floorBid: number;
  buyersPremiumPct: number;
  isAuction: boolean;
  isSoftClose: boolean;
  isLocalPickupOnly: boolean;
  bidCount: number | null;
  timeLeft: string;
  estWeightLbs: number;
  soloShipUsd: number;
  combineSavingsUsd: number;
  effectiveShipUsd: number;
  combineEligible: boolean;
  combineMatchCount: number;
  landedAtCurrentUsd: number;
  estGrossLow: number;
  estGrossHigh: number;
  estGrossMid: number;
  bestChannel: SweepChannelCode;
  bestChannelLabel: string;
  channelFeePct: number;
  netChannelPayoutUsd: number;
  netProfitAtCurrentUsd: number;
  roiMultipleAtCurrent: number;
  balancedMaxBidUsd: number;
  aggressiveMaxBidUsd: number;
  isMultiItemLot: boolean;
  needsDeepVision: boolean;
  visionThumbUsed: boolean;
  splitPlayHint: string;
  oneLineWhy: string;
  verdictBucket: SweepVerdictBucket;
  verdictLabel: string;
}

export interface AuctionSweepSummary {
  totalEvaluated: number;
  hotFlipCount: number;
  combinePlayCount: number;
  sleeperCount: number;
  passCount: number;
  visionThumbnailsUsed: number;
}

const VAGUE_LOT_TITLE_RE =
  /\b(lot|assorted|mixed|mystery|bundle|collection|grab\s*bag|jar|box\s+of|bulk|group\s+of|estate|untested|various|misc|jewelry|watches|pins|brooches|rings|rpg|d&d|tsr|warhammer|modules|manuals|figurines|miniatures|dice|tarot|crystals|oddities|vintage\s+toys|action\s+figures|comics|zines)\b/i;

const APPAREL_OR_BULKY_RE =
  /\b(shirt|t-shirt|tee|jacket|coat|parka|blazer|vest|suit|sweater|cardigan|hoodie|sweatshirt|dress|skirt|pants|trousers|jeans|denim|shorts|leggings|blouse|romper|jumpsuit|robe|kimono|shoes|boots|sneakers|sandals|heels|loafers|clogs|mens|womens|size\s+(?:xxs|xs|s|m|l|xl|xxl|2xl|3xl|\d{1,2}x\d{1,2}))\b/i;

const BULKY_NON_DT_RE =
  /\b(playset|board\s*game|monitor|television|receiver|amplifier|turntable|speaker|guitar|keyboard|sewing\s*machine|vacuum|furniture|chair|table|lamp|framed|mirror|luggage|suitcase|cast\s*iron|Dutch\s*oven|\d{3,5}\s*(?:pcs|pieces|pzs))\b/i;

const SMALL_DT_FIT_RE =
  /\b(ring|earring|pendant|necklace|bracelet|brooch|pin|enamel\s*pin|cameo|sterling|925|wand|crystal|tarot|dice|miniature|keychain|pocket\s*knife|pocket\s*watch|lighter|compact|thimble|charm|token|coin|medal|patch|sticker|trinket|amulet|talisman)\b/i;

export function isVagueSleeperLotTitle(rawTitle: string): boolean {
  const clean = String(rawTitle || '').trim();
  if (!clean) return false;
  if (clean.length < 28) return true;
  return VAGUE_LOT_TITLE_RE.test(clean);
}

export function selectSleeperThumbnailIndices(
  candidates: SweepCandidateInput[],
  maxThumbs = MAX_SLEEPER_THUMBS
): number[] {
  const scored: Array<{ idx: number; priority: number }> = [];
  candidates.forEach((c, idx) => {
    const thumb = String(c.thumbnailUrl || '').trim();
    if (!/^https?:\/\//i.test(thumb)) return;
    const price = Math.max(Number(c.currentPrice || 0), Number(c.minimumBid || 0));
    // Skip obviously runaway $250+ bids when rationing 8 sleeper vision slots
    if (price > 250) return;

    let priority = 0;
    if (isVagueSleeperLotTitle(c.title)) priority += 10;
    if (c.combineEligible) priority += 5;
    if (price > 0 && price <= 25) priority += 3;
    if (/\b(lot|box|jar|assorted|mystery|collection|group)\b/i.test(c.title)) priority += 6;

    if (priority > 0) {
      scored.push({ idx, priority });
    }
  });

  scored.sort((a, b) => b.priority - a.priority || a.idx - b.idx);
  return scored.slice(0, Math.max(0, maxThumbs)).map((s) => s.idx);
}

export function sanitizeSweepCandidates(rawList: unknown): SweepCandidateInput[] {
  if (!Array.isArray(rawList)) return [];
  const out: SweepCandidateInput[] = [];
  const seenKeys = new Set<string>();

  for (const raw of rawList) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, any>;
    const title = String(r.title || '').replace(/\s+/g, ' ').trim().slice(0, 220);
    const itemId = String(r.itemId || r.externalItemId || '').trim().slice(0, 120);
    const sourceUrl = String(r.sourceUrl || '').trim().slice(0, 500);
    if (!title || (!itemId && !sourceUrl)) continue;

    const lotKey = String(r.lotKey || itemId || sourceUrl).trim().slice(0, 140);
    if (!lotKey || seenKeys.has(lotKey)) continue;
    seenKeys.add(lotKey);

    const currentPrice = Math.max(0, Number(r.currentPrice || 0) || 0);
    const minimumBid = Math.max(0, Number(r.minimumBid || 0) || 0);
    const rawShip = r.shippingCost;
    const shippingCost =
      rawShip !== null && rawShip !== undefined && rawShip !== '' && !Number.isNaN(Number(rawShip))
        ? Math.max(0, Number(rawShip))
        : null;
    const rawWeight = Number(r.shippingWeightLbs || 0);
    const shippingWeightLbs = rawWeight > 0 && rawWeight < 250 ? rawWeight : null;
    const buyersPremiumPct = Math.max(0, Math.min(40, Number(r.buyersPremiumPct || 0) || 0));
    const bidCount =
      r.bidCount !== null && r.bidCount !== undefined && !Number.isNaN(Number(r.bidCount))
        ? Math.max(0, Math.round(Number(r.bidCount)))
        : null;

    const rawSeller = String(r.seller || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const cleanSeller = isPlaceholderSellerName(rawSeller) ? '' : rawSeller;

    const domainKey = resolveSourcingDomain({
      domainKey: r.domainKey,
      url: sourceUrl,
      platformId: r.platformName,
    });

    out.push({
      lotKey,
      itemId: itemId || lotKey,
      externalItemId: String(r.externalItemId || itemId || lotKey).trim().slice(0, 120),
      sourceUrl,
      domainKey,
      platformName: String(r.platformName || '').trim().slice(0, 60),
      title,
      currentPrice,
      minimumBid: minimumBid > currentPrice ? minimumBid : currentPrice,
      shippingCost,
      shippingWeightLbs,
      buyersPremiumPct,
      isAuction: r.isAuction !== undefined ? Boolean(r.isAuction) : !Boolean(r.isBuyItNow),
      isSoftClose: Boolean(r.isSoftClose),
      isBuyItNow: Boolean(r.isBuyItNow),
      isLocalPickupOnly: Boolean(r.isLocalPickupOnly),
      bidCount,
      timeLeft: String(r.timeLeft || '').replace(/\s+/g, ' ').trim().slice(0, 48),
      seller: cleanSeller,
      sellerId: r.sellerId ? String(r.sellerId).slice(0, 40) : null,
      combineEligible: Boolean(r.combineEligible),
      combineMatchCount: Math.max(0, Math.round(Number(r.combineMatchCount || 0) || 0)),
      thumbnailUrl: String(r.thumbnailUrl || '').trim().slice(0, 600),
    });

    if (out.length >= MAX_SWEEP_LOTS) break;
  }

  return out;
}

export function buildAuctionSweepPrompt(
  candidates: SweepCandidateInput[],
  imageSlotByLotIndex: Map<number, number>,
  rules: AppraisalRulesConfig,
  liveWarehouses?: any[]
): string {
  const mdMeta = getLocationSettingMeta('MD', liveWarehouses);
  const dtMeta = getLocationSettingMeta('DT', liveWarehouses);

  const catNotesLines = (rules.categoryNotes || [])
    .filter((n) => n && n.note && n.note.trim())
    .slice(0, 12)
    .map((n) => `- ${n.label}: ${n.note.trim()}`)
    .join('\n');

  const lotLines = candidates
    .map((c, idx) => {
      const floor = c.isAuction ? Math.max(c.currentPrice, c.minimumBid || 0) : c.currentPrice;
      const imgSlot = imageSlotByLotIndex.get(idx);
      const imgTag = imgSlot !== undefined ? ` [THUMBNAIL_IMAGE_#${imgSlot + 1}]` : '';
      const shipTag = c.isLocalPickupOnly
        ? 'LocalPickup($0 S&H)'
        : c.shippingCost !== null && c.shippingCost !== undefined
          ? `Ship:$${c.shippingCost.toFixed(2)}`
          : c.shippingWeightLbs
            ? `Wt:${c.shippingWeightLbs}lb`
            : 'Ship:Est';
      const bpTag = c.buyersPremiumPct && c.buyersPremiumPct > 0 ? ` +${c.buyersPremiumPct}%BP` : '';
      const combTag = c.combineEligible ? ` [COMBINE_ELIGIBLE +${c.combineMatchCount || 1}]` : '';
      const fmtTag = c.isAuction ? 'Auction' : 'BuyNow';
      return `#${idx}${imgTag} | ${fmtTag} Floor:$${floor.toFixed(2)}${bpTag} | ${shipTag}${combTag} | Title: "${c.title}"`;
    })
    .join('\n');

  return `You are running "Auction Sweep" — fast, cash-realistic batch triage across ${candidates.length} active auction/marketplace lots for The Huckleberry Collective.

LIVE SALES CHANNELS & STRICT VENUE RULES:
1. "MD" (${mdMeta.shortName} Booth — ${mdMeta.feePct}% fee, $0 outbound shipping):
   - Best for: Goth, Whimsigoth, TTRPG/D&D/sci-fi/fantasy, horror, punk, metaphysical/oddities, vintage outerwear/leather/hats, heavy/fragile vintage decor, and multi-item $10-$15 Booth Bin packs.
2. "DT" (${dtMeta.shortName} Booth — ${dtMeta.feePct}% fee, $0 outbound shipping):
   - STRICT SIZE & CATEGORY EXCLUSION: ONLY small collectibles, sterling/vintage jewelry, pins, dice, wands & arcana under 8 inches (< 2 lbs). NEVER route clothing/apparel/shoes, board games, or bulky playsets/hardgoods to DT!
3. "eBay" (${rules.channelFees.ebayPct}% + $${rules.channelFees.ebayFixedUsd.toFixed(2)} fee):
   - Best for: Lightweight national collector comps, rare RPG/media, electronics, specific brand/part# demand.
4. "Poshmark" (${rules.channelFees.poshmarkPct}% fee >= $15, $${rules.channelFees.poshmarkUnder15FlatUsd.toFixed(2)} under $15; >5 lb overweight upgrade penalty):
   - Best for: Branded vintage/modern apparel, boots, bags, fashion accessories under 5 lbs.
${catNotesLines ? `\nHOUSE CALIBRATION NOTES:\n${catNotesLines}\n` : ''}
VALUATION & ANTI-HALLUCINATION LAWS:
- Anchor STRICTLY to realistic secondary-market SOLD comps (eBay Sold / Poshmark Sold / antique booth realistic turn price). NEVER anchor to retail MSRP!
- Ignore untested electronics hype: assume "untested" thrift electronics may be parts/repair unless rugged passive gear.
- For multi-item lots (e.g. box of RPG books, jewelry jar, lot of 8 paperbacks), estimate total realistic sliced/bundled resale across the lot and set "isMultiItemLot": true with a crisp "splitPlayHint" (e.g. "Hero piece covers cost + $10 bin filler").
- Set "needsDeepVision": true when a vague/assorted lot could hold higher value if close-up gallery photos confirm hallmarks/titles/condition.
- When a [THUMBNAIL_IMAGE_#K] is attached for a lot, inspect that image to identify visible brands, spines, count, or junk filler.

LOTS TO TRIAGE (${candidates.length} total):
${lotLines}

Return ONLY a valid JSON object matching this exact schema (include every lot index 0..${candidates.length - 1}):
{
  "lots": [
    {
      "index": 0,
      "estBoutiqueLow": 28,
      "estBoutiqueHigh": 42,
      "estOnlineLow": 24,
      "estOnlineHigh": 36,
      "bestChannel": "MD",
      "isMultiItemLot": false,
      "isApparelOrBulky": false,
      "isSmallCollectibleUnder8In": false,
      "estWeightLbs": 2.0,
      "needsDeepVision": false,
      "splitPlayHint": "",
      "oneLineWhy": "Concise <= 85 char resale thesis grounded in comps & channel fit"
    }
  ]
}`;
}

function estimateFallbackInboundShipping(
  domainKey: SourcingDomainKey,
  weightLbs: number,
  fallbackFromProfile: number
): number {
  if (domainKey === 'local_cash' || domainKey === 'in_person') return 0;
  if (domainKey === 'shopgoodwill') {
    if (weightLbs <= 1.0) return 9.45;
    if (weightLbs <= 2.5) return 11.85;
    if (weightLbs <= 5.0) return 14.75;
    if (weightLbs <= 10.0) return 19.5;
    return 26.0;
  }
  if (fallbackFromProfile > 0) {
    return weightLbs > 5 ? Number((fallbackFromProfile + 6.5).toFixed(2)) : fallbackFromProfile;
  }
  return weightLbs <= 1.5 ? 7.5 : weightLbs <= 5 ? 11.5 : 17.5;
}

export function scoreAndRankSweepLots(
  candidates: SweepCandidateInput[],
  aiAssessments: SweepAiLotAssessment[],
  visionIndices: Set<number>,
  rules: AppraisalRulesConfig,
  liveWarehouses?: any[]
): { lots: ScoredSweepLot[]; summary: AuctionSweepSummary } {
  const mdMeta = getLocationSettingMeta('MD', liveWarehouses);
  const dtMeta = getLocationSettingMeta('DT', liveWarehouses);

  const mdBias = Number(rules.venueBias?.MD || 1.0) || 1.0;
  const dtBias = Number(rules.venueBias?.DT || 1.0) || 1.0;

  const byIndex = new Map<number, SweepAiLotAssessment>();
  if (Array.isArray(aiAssessments)) {
    for (const a of aiAssessments) {
      if (a && typeof a.index === 'number') {
        byIndex.set(a.index, a);
      }
    }
  }

  const scored: ScoredSweepLot[] = candidates.map((cand, idx) => {
    const ai = byIndex.get(idx);
    const domainKey: SourcingDomainKey =
      cand.domainKey ||
      resolveSourcingDomain({
        url: cand.sourceUrl,
        platformId: cand.platformName,
      });
    const domProfile = getDomainProfile(domainKey, rules.domainProfiles);

    const isAuction = cand.isAuction !== undefined ? Boolean(cand.isAuction) : domProfile.isAuction;
    const isLocalPickupOnly = Boolean(cand.isLocalPickupOnly || domProfile.isLocalPickupDefault);
    const buyersPremiumPct =
      cand.buyersPremiumPct !== undefined && cand.buyersPremiumPct > 0
        ? cand.buyersPremiumPct
        : domProfile.defaultBuyersPremiumPct || 0;
    const isSoftClose = Boolean(cand.isSoftClose || buyersPremiumPct > 0);

    const estWeightLbs = Math.max(
      0.3,
      Math.min(
        80,
        Number(cand.shippingWeightLbs || ai?.estWeightLbs || 1.8) || 1.8
      )
    );

    const disallowDt =
      Boolean(ai?.isApparelOrBulky) ||
      estWeightLbs >= 2.0 ||
      APPAREL_OR_BULKY_RE.test(cand.title) ||
      BULKY_NON_DT_RE.test(cand.title);

    const rawBoutiqueLow = Math.max(0, Number(ai?.estBoutiqueLow || 0) || 0);
    const rawBoutiqueHigh = Math.max(rawBoutiqueLow, Number(ai?.estBoutiqueHigh || rawBoutiqueLow) || 0);
    const rawOnlineLow = Math.max(0, Number(ai?.estOnlineLow || rawBoutiqueLow * 0.85) || 0);
    const rawOnlineHigh = Math.max(rawOnlineLow, Number(ai?.estOnlineHigh || rawBoutiqueHigh * 0.9) || 0);

    const boutiqueMidRaw =
      rawBoutiqueHigh > 0 ? (rawBoutiqueLow + rawBoutiqueHigh) / 2 : rawOnlineHigh > 0 ? (rawOnlineLow + rawOnlineHigh) / 2 : 18;
    const onlineMidRaw =
      rawOnlineHigh > 0 ? (rawOnlineLow + rawOnlineHigh) / 2 : boutiqueMidRaw * 0.88;

    // Evaluate all valid channels using live fees & venue bias
    const mdGross = Math.round(boutiqueMidRaw * mdBias * 100) / 100;
    const mdNet = Math.round(mdGross * (1 - mdMeta.feePct / 100) * 100) / 100;

    const dtGross = Math.round(boutiqueMidRaw * dtBias * 100) / 100;
    const dtNet = disallowDt ? -999 : Math.round(dtGross * (1 - dtMeta.feePct / 100) * 100) / 100;

    const ebayGross = Math.round(onlineMidRaw * 100) / 100;
    const ebayNet =
      Math.round(
        (ebayGross * (1 - (rules.channelFees.ebayPct || 13.25) / 100) -
          (rules.channelFees.ebayFixedUsd ?? 0.4)) *
          100
      ) / 100;

    const poshGross = Math.round(onlineMidRaw * 100) / 100;
    const poshFee =
      poshGross < 15
        ? rules.channelFees.poshmarkUnder15FlatUsd || 2.95
        : poshGross * ((rules.channelFees.poshmarkPct || 20) / 100);
    const poshOverweightPenalty = estWeightLbs > 5 ? Math.min(22.5, Math.round((estWeightLbs - 5) * 4.5 * 100) / 100) : 0;
    const poshNet = Math.round((poshGross - poshFee - poshOverweightPenalty) * 100) / 100;

    let chosenChannel: SweepChannelCode = (ai?.bestChannel as SweepChannelCode) || 'MD';
    if (!['MD', 'DT', 'eBay', 'Poshmark'].includes(chosenChannel)) {
      chosenChannel = 'MD';
    }
    if (chosenChannel === 'DT' && disallowDt) {
      chosenChannel = APPAREL_OR_BULKY_RE.test(cand.title) ? 'Poshmark' : 'MD';
    }
    if (
      chosenChannel === 'MD' &&
      !disallowDt &&
      (Boolean(ai?.isSmallCollectibleUnder8In) || SMALL_DT_FIT_RE.test(cand.title)) &&
      dtNet > mdNet
    ) {
      chosenChannel = 'DT';
    }

    const channelMap: Record<
      SweepChannelCode,
      { label: string; feePct: number; gross: number; low: number; high: number; net: number }
    > = {
      MD: {
        label: `🔮 ${mdMeta.shortName} (${mdMeta.feePct}%)`,
        feePct: mdMeta.feePct,
        gross: mdGross,
        low: Math.round((rawBoutiqueLow || mdGross * 0.85) * mdBias),
        high: Math.round((rawBoutiqueHigh || mdGross * 1.15) * mdBias),
        net: mdNet,
      },
      DT: {
        label: `🐯 ${dtMeta.shortName} (${dtMeta.feePct}%)`,
        feePct: dtMeta.feePct,
        gross: dtGross,
        low: Math.round((rawBoutiqueLow || dtGross * 0.85) * dtBias),
        high: Math.round((rawBoutiqueHigh || dtGross * 1.15) * dtBias),
        net: Math.max(0, dtNet),
      },
      eBay: {
        label: `🌐 eBay (${rules.channelFees.ebayPct}%)`,
        feePct: rules.channelFees.ebayPct,
        gross: ebayGross,
        low: Math.round(rawOnlineLow || ebayGross * 0.85),
        high: Math.round(rawOnlineHigh || ebayGross * 1.15),
        net: ebayNet,
      },
      Poshmark: {
        label: `👗 Poshmark (${rules.channelFees.poshmarkPct}%)`,
        feePct: rules.channelFees.poshmarkPct,
        gross: poshGross,
        low: Math.round(rawOnlineLow || poshGross * 0.85),
        high: Math.round(rawOnlineHigh || poshGross * 1.15),
        net: poshNet,
      },
    };

    const chosen = channelMap[chosenChannel] || channelMap.MD;

    // Inbound Landed Cost & Strict Domain-Scoped Combined Shipping
    const soloShipUsd = isLocalPickupOnly
      ? 0
      : cand.shippingCost !== null && cand.shippingCost !== undefined
        ? Number(cand.shippingCost.toFixed(2))
        : estimateFallbackInboundShipping(domainKey, estWeightLbs, domProfile.defaultShippingFallbackUsd);

    const canCombine = Boolean(domProfile.allowsCombinedShipping && cand.combineEligible && !isLocalPickupOnly);
    const combineSavingsUsd =
      canCombine && soloShipUsd > 0
        ? Math.min(12, Math.max(5, Math.round(Math.max(0, soloShipUsd - 3) * 0.85)))
        : 0;
    const effectiveShipUsd = isLocalPickupOnly
      ? 0
      : Number(Math.max(domainKey === 'shopgoodwill' ? 3.25 : 0, soloShipUsd - combineSavingsUsd).toFixed(2));

    const currentPrice = Math.max(0, Number(cand.currentPrice || 0));
    const minimumBid = Math.max(currentPrice, Number(cand.minimumBid || currentPrice));
    const floorBid = isAuction ? Math.max(currentPrice, minimumBid) : currentPrice;
    const bpMult = 1 + (buyersPremiumPct > 0 ? buyersPremiumPct / 100 : 0);

    const landedAtCurrentUsd = Number((floorBid * bpMult + effectiveShipUsd).toFixed(2));
    const soloLandedAtCurrentUsd = Number((floorBid * bpMult + soloShipUsd).toFixed(2));
    const netProfitAtCurrentUsd = Math.round((chosen.net - landedAtCurrentUsd) * 100) / 100;
    const roiMultipleAtCurrent =
      landedAtCurrentUsd > 0 ? Math.round((chosen.gross / landedAtCurrentUsd) * 100) / 100 : 0;

    const roiBal = Number(rules.roiTargets?.balanced || 2.2) || 2.2;
    const roiAgg = Number(rules.roiTargets?.aggressive || 1.7) || 1.7;
    const allowSniperCents = Boolean(isAuction && !isSoftClose && buyersPremiumPct <= 0);

    const calcMaxBid = (roiMult: number, shipRef: number): number => {
      const targetLanded = chosen.gross / roiMult;
      const avail = targetLanded - shipRef;
      if (avail <= 0) return 0;
      const rawHammer = avail / bpMult;
      if (!isAuction) return Math.max(0, Math.round(rawHammer * 100) / 100);
      const baseInt = Math.max(0, Math.floor(rawHammer));
      if (baseInt <= 0) return 0;
      return allowSniperCents ? Number((baseInt + 0.87).toFixed(2)) : baseInt;
    };

    const balancedMaxBidUsd = calcMaxBid(roiBal, effectiveShipUsd);
    const soloBalancedMaxBidUsd = calcMaxBid(roiBal, soloShipUsd);
    const aggressiveMaxBidUsd = calcMaxBid(roiAgg, effectiveShipUsd);

    const isMultiItemLot = Boolean(ai?.isMultiItemLot || /\b(lot|bundle|set\s+of|collection|assorted|box\s+of)\b/i.test(cand.title));
    const needsDeepVision = Boolean(ai?.needsDeepVision || isVagueSleeperLotTitle(cand.title));

    // Classify into 4 crisp Reseller Sweep Buckets
    let verdictBucket: SweepVerdictBucket = 'PASS';
    let verdictLabel = '🛑 Skip';

    const passesBalanced = balancedMaxBidUsd > 0 && floorBid <= balancedMaxBidUsd && netProfitAtCurrentUsd >= 12;
    const passesAggressive = aggressiveMaxBidUsd > 0 && floorBid <= aggressiveMaxBidUsd && netProfitAtCurrentUsd >= 9;
    const unlockedByCombine =
      combineSavingsUsd > 0 &&
      passesAggressive &&
      (soloBalancedMaxBidUsd <= 0 || floorBid > soloBalancedMaxBidUsd || chosen.net - soloLandedAtCurrentUsd < 10);

    if (unlockedByCombine) {
      verdictBucket = 'COMBINE_PLAY';
      verdictLabel = `📦 Combine Flip (-$${combineSavingsUsd} S&H)`;
    } else if (passesBalanced && isMultiItemLot && combineSavingsUsd > 0) {
      verdictBucket = 'COMBINE_PLAY';
      verdictLabel = '📦 Combine + Lot Split';
    } else if (passesBalanced) {
      verdictBucket = 'HOT_FLIP';
      verdictLabel = isMultiItemLot ? '🔥 Hot Lot Flip' : '🔥 Hot Flip';
    } else if (passesAggressive && (combineSavingsUsd > 0 || isMultiItemLot)) {
      verdictBucket = 'COMBINE_PLAY';
      verdictLabel = isMultiItemLot ? '✂️ Lot Split Play' : '📦 Combine Margin';
    } else if (
      needsDeepVision &&
      (passesAggressive || (aggressiveMaxBidUsd > 0 && floorBid <= aggressiveMaxBidUsd * 1.25) || (floorBid <= 16 && chosen.gross >= 28))
    ) {
      verdictBucket = 'SLEEPER';
      verdictLabel = '👀 Sleeper — Inspect';
    } else {
      verdictBucket = 'PASS';
      verdictLabel =
        balancedMaxBidUsd <= 0
          ? '🛑 S&H Kills Margin'
          : floorBid > aggressiveMaxBidUsd
            ? `🛑 Bid > $${Math.round(aggressiveMaxBidUsd)} Cap`
            : '🛑 Thin Margin';
    }

    const fallbackWhy =
      verdictBucket === 'PASS'
        ? `At $${floorBid.toFixed(2)} + $${effectiveShipUsd.toFixed(2)} S&H, margin falls short of ${roiAgg.toFixed(1)}x target.`
        : `Est. $${chosen.gross.toFixed(0)} on ${chosenChannel}; nets ~$${netProfitAtCurrentUsd.toFixed(0)} at current price.`;

    return {
      lotKey: cand.lotKey,
      itemId: cand.itemId,
      externalItemId: cand.externalItemId || cand.itemId,
      sourceUrl: cand.sourceUrl,
      domainKey,
      platformName: cand.platformName || domProfile.shortLabel,
      title: cand.title,
      thumbnailUrl: cand.thumbnailUrl || '',
      seller: cand.seller || '',
      currentPrice,
      minimumBid,
      floorBid,
      buyersPremiumPct,
      isAuction,
      isSoftClose,
      isLocalPickupOnly,
      bidCount: cand.bidCount ?? null,
      timeLeft: cand.timeLeft || '',
      estWeightLbs: Number(estWeightLbs.toFixed(1)),
      soloShipUsd,
      combineSavingsUsd,
      effectiveShipUsd,
      combineEligible: canCombine,
      combineMatchCount: canCombine ? Math.max(1, cand.combineMatchCount || 1) : 0,
      landedAtCurrentUsd,
      estGrossLow: Math.max(1, chosen.low),
      estGrossHigh: Math.max(chosen.low, chosen.high),
      estGrossMid: chosen.gross,
      bestChannel: chosenChannel,
      bestChannelLabel: chosen.label,
      channelFeePct: chosen.feePct,
      netChannelPayoutUsd: chosen.net,
      netProfitAtCurrentUsd,
      roiMultipleAtCurrent,
      balancedMaxBidUsd,
      aggressiveMaxBidUsd,
      isMultiItemLot,
      needsDeepVision,
      visionThumbUsed: visionIndices.has(idx),
      splitPlayHint: String(ai?.splitPlayHint || '').trim().slice(0, 100),
      oneLineWhy: String(ai?.oneLineWhy || fallbackWhy).trim().slice(0, 120),
      verdictBucket,
      verdictLabel,
    };
  });

  const bucketRank: Record<SweepVerdictBucket, number> = {
    HOT_FLIP: 0,
    COMBINE_PLAY: 1,
    SLEEPER: 2,
    PASS: 3,
  };

  scored.sort((a, b) => {
    const br = bucketRank[a.verdictBucket] - bucketRank[b.verdictBucket];
    if (br !== 0) return br;
    if (b.netProfitAtCurrentUsd !== a.netProfitAtCurrentUsd) {
      return b.netProfitAtCurrentUsd - a.netProfitAtCurrentUsd;
    }
    return b.roiMultipleAtCurrent - a.roiMultipleAtCurrent;
  });

  const summary: AuctionSweepSummary = {
    totalEvaluated: scored.length,
    hotFlipCount: scored.filter((l) => l.verdictBucket === 'HOT_FLIP').length,
    combinePlayCount: scored.filter((l) => l.verdictBucket === 'COMBINE_PLAY').length,
    sleeperCount: scored.filter((l) => l.verdictBucket === 'SLEEPER').length,
    passCount: scored.filter((l) => l.verdictBucket === 'PASS').length,
    visionThumbnailsUsed: visionIndices.size,
  };

  return { lots: scored, summary };
}

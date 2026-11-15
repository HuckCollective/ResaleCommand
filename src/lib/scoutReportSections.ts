/**
 * scoutReportSections.ts — Canonical Appraisal & Auction Tier Math Engine + Composable Report Section Registry.
 *
 * ISOMORPHIC: zero Appwrite / Node imports (safe in Astro API routes, Vue components, and tests).
 * Callers resolve warehouses via `getAllLocationSettingMetas(...)` in `src/lib/warehouses.ts` and pass the
 * resulting metas in (Law 1 & Law 2: never hardcode location names, codes or fees here).
 *
 * Single Source of Truth for:
 *   - sanitizeBestVenue()                 → bans 0%-fee backstock warehouses from "Best Venue"
 *   - enforceSingleItemValuationSanity()  → mint >= boutique >= fair >= poor + 1.35x / 1.15x oversize boutique cap
 *   - computeCanonicalAuctionTiers()      → signed P&L, S&H-cap vs outbid vs active tier states, PASS override
 *   - applyScoutReportGuardrails()        → one call used by /api/identify-item
 *   - renderScoutReportMarkdown()         → BML_TRAY | DRAWER_MD | TESTBENCH | PARTNER_BRIEF section profiles
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VenueMetaLike {
    code: string;
    name: string;
    shortName?: string;
    fullName?: string;
    type?: string;
    subtitle?: string;
    commissionRate?: number;
    aliases?: string[];
}

export type ScoutTierStatus = 'active' | 'outbid' | 'ship_exceeds_cap';
export type ScoutReportProfile = 'BML_TRAY' | 'DRAWER_MD' | 'TESTBENCH' | 'PARTNER_BRIEF';

export interface CanonicalTier {
    key: 'conservative' | 'balanced' | 'aggressive';
    roi: number;
    roiLabel: string;
    targetLanded: number;
    maxBid: number;
    bpDollars: number;
    estLanded: number;
    /** Signed P&L if you win at this tier's max bid (never clamped at 0). */
    netProfit: number;
    /** Signed P&L if you win at the CURRENT bid (never clamped at 0). Null when no bid is known. */
    netProfitAtCurrentBid: number | null;
    status: ScoutTierStatus;
    statusLabel: string;
    passed: boolean;
}

export interface CanonicalTierInput {
    /** Resale anchor used for ROI division (boutique midpoint, falling back to fair midpoint). */
    targetResale: number;
    /** Seller-side fee % applied to resale (e.g. venue commission). Defaults to 15. */
    feePct?: number;
    currentBid?: number;
    shippingTotal?: number;
    /** Seller handling portion (floor for S&H when combine savings apply). */
    shipHandling?: number;
    combineSavings?: number;
    buyersPremiumPct?: number;
    isAuction?: boolean;
    isSoftClose?: boolean;
    isLocalPickupOnly?: boolean;
    useProxyCents?: boolean;
    roiMultiples?: [number, number, number];
}

export interface CanonicalTierResult {
    targetResale: number;
    netPayout: number;
    effectiveShip: number;
    isFreightTrap: boolean;
    freightPctOfResale: number;
    sniperCentsAllowed: boolean;
    tiers: { conservative: CanonicalTier; balanced: CanonicalTier; aggressive: CanonicalTier };
    atCurrentBid: { landed: number; netProfit: number; roiX: number | null } | null;
    allDead: boolean;
    anyShipExceedsCap: boolean;
    verdictOverride: 'PASS' | null;
    primaryCta: 'track' | 'watch_only';
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

const NUM_RE = /\d[\d,]*(?:\.\d+)?/g;

export function parseRange(input: any): { low: number; high: number } {
    if (input === null || input === undefined) return { low: 0, high: 0 };
    if (typeof input === 'number') return { low: input, high: input };
    const nums = (String(input).match(NUM_RE) || [])
        .map((n) => parseFloat(n.replace(/,/g, '')))
        .filter((n) => Number.isFinite(n));
    if (nums.length === 0) return { low: 0, high: 0 };
    if (nums.length === 1) return { low: nums[0], high: nums[0] };
    return { low: Math.min(nums[0], nums[1]), high: Math.max(nums[0], nums[1]) };
}

export function rangeMid(input: any): number {
    const r = parseRange(input);
    return r.high > 0 ? (r.low + r.high) / 2 : r.low;
}

export function formatRange(low: number, high: number): string {
    const l = Math.max(0, Math.round(low));
    const h = Math.max(l, Math.round(high));
    return l === h ? `$${l}` : `$${l} - $${h}`;
}

function scaleRange(input: any, factor: number): string {
    const r = parseRange(input);
    return formatRange(r.low * factor, r.high * factor);
}

const money = (n: number): string => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, '')}`;
const moneyWhole = (n: number): string => `${n < 0 ? '-' : '+'}$${Math.abs(Math.round(n))}`;

/** Largest inch dimension mentioned in listing text (e.g. `65" tall`, `65 inches`, `40 x 30 in`). */
export function extractLongestDimensionInches(...texts: any[]): number {
    const blob = texts.filter(Boolean).map(String).join(' \n ');
    let longest = 0;
    const single = /(\d{1,3}(?:\.\d+)?)\s*(?:"|”|″|''|in\b|inch(?:es)?\b)/gi;
    let m: RegExpExecArray | null;
    while ((m = single.exec(blob))) {
        const n = parseFloat(m[1]);
        if (n > longest && n < 200) longest = n;
    }
    const dims = /(\d{1,3}(?:\.\d+)?)\s*(?:"|”|in\.?)?\s*[xX×]\s*(\d{1,3}(?:\.\d+)?)\s*(?:"|”|in\b|inch)/g;
    while ((m = dims.exec(blob))) {
        const n = Math.max(parseFloat(m[1]), parseFloat(m[2]));
        if (n > longest && n < 200) longest = n;
    }
    return longest;
}

export interface FreightProfile {
    shippingTotal: number;
    weightLbs: number;
    longestInches: number;
    /** shippingTotal >= 60 || weight >= 20 || longest >= 40 — tightens boutique cap to 1.15x. */
    isFreightHeavy: boolean;
    /** weight >= 18 || shippingTotal >= 55 || (>= 30" framed wall art / furniture) — disables combine shipping. */
    isOversizedFreight: boolean;
}

export function getFreightProfile(item: any, shippingTotal: number): FreightProfile {
    const weightLbs = Number(item?.seller_info?.shipping_weight ?? item?.shippingWeight ?? item?.shipping_info?.weight ?? 0) || 0;
    const longestInches = extractLongestDimensionInches(
        item?.title,
        item?.identity,
        item?.condition_notes,
        item?.why_pay_up,
        item?.why_pass,
        item?.listing_description
    );
    const ship = Number(shippingTotal) || 0;
    const substrate = String(item?.physical_substrate || '');
    const bigWallArt = longestInches >= 30 && (substrate === 'WALL_ART' || /frame|painting|canvas|mirror|furniture|cabinet|table|dresser/i.test(String(item?.title || '')));
    return {
        shippingTotal: ship,
        weightLbs,
        longestInches,
        isFreightHeavy: ship >= 60 || weightLbs >= 20 || longestInches >= 40,
        isOversizedFreight: weightLbs >= 18 || ship >= 55 || bigWallArt,
    };
}

// ---------------------------------------------------------------------------
// (a) Best Venue sanitizer — Law 1 & Law 2 (metas supplied by caller, never hardcoded)
// ---------------------------------------------------------------------------

export const LOCAL_CASH_VENUE = 'Local Cash / FB Marketplace (0% Fee)';

function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isBackstockMeta(m: VenueMetaLike): boolean {
    return Number(m.commissionRate || 0) === 0 || /warehouse|backstock/i.test(String(m.type || ''));
}

function buildNamePatterns(m: VenueMetaLike): RegExp[] {
    const names = [m.name, m.shortName, m.fullName, ...(m.aliases || [])]
        .filter((n): n is string => typeof n === 'string' && n.trim().length >= 4)
        .map((n) => new RegExp(escapeRe(n.trim()).replace(/'/g, "['’]?"), 'i'));
    if (m.code) names.push(new RegExp(`(?:\\(|\\b)${escapeRe(m.code)}(?:\\)|\\b)`)); // codes are case-sensitive (HG / HH / DT)
    return names;
}

export interface SanitizeVenueOptions {
    longestInches?: number;
    shippingTotal?: number;
    isApparel?: boolean;
    /** True when the item is on-brand for a niche booth (Goth / TTRPG / sci-fi / metaphysical). */
    isNicheBoothFit?: boolean;
    /** True when item is a small curio / jewelry / pocket-size item (<8"). */
    isSmallCurio?: boolean;
}

export function sanitizeBestVenue(
    rawBestPlatform: any,
    metas: VenueMetaLike[],
    options: SanitizeVenueOptions = {}
): { value: string; changed: boolean; removed: string[] } {
    const raw = String(rawBestPlatform || '').trim();
    const list = Array.isArray(metas) ? metas : [];
    const backstock = list.filter(isBackstockMeta);
    const retail = list.filter((m) => !isBackstockMeta(m));
    const backstockPatterns = backstock.flatMap(buildNamePatterns);
    const genericBackstock = /booth\s*staging|back\s*stock|warehouse|staging/i;
    const isBackstockToken = (t: string) => backstockPatterns.some((re) => re.test(t)) || genericBackstock.test(t);

    // Curio rule: dusty-tiger-style booths (small collectibles, no apparel) — derived from live subtitle/type data, not names.
    const smallBooths = retail.filter((m) => /<\s*8|small|curio|jewelry/i.test(`${m.type || ''} ${m.subtitle || ''}`));
    const oversize = (options.longestInches || 0) >= 40 || (options.shippingTotal || 0) >= 65;

    const removed: string[] = [];
    const tokens = raw
        .replace(/\be\.g\.,?/gi, '')
        .split(/[\/,;|()]| or | and | & /i)
        .map((t) => t.trim())
        .filter(Boolean);
    const kept: string[] = [];
    for (const t of tokens) {
        if (isBackstockToken(t)) {
            removed.push(t);
            continue;
        }
        // Small-booth rule: no apparel / no >= 8" items in curio-only booths
        if (smallBooths.some((m) => buildNamePatterns(m).some((re) => re.test(t))) && (options.isApparel || (options.longestInches || 0) >= 8 || !options.isSmallCurio)) {
            removed.push(t);
            continue;
        }
        if (!/^(local\s+consignment|consignment|booth|\d+%\s*fee)$/i.test(t) && !kept.includes(t)) kept.push(t);
    }

    // Nothing banned and no oversize override → leave the AI's venue text untouched
    let value = removed.length === 0 && raw ? raw : kept.join(' / ');
    // Oversize / freight-heavy non-niche items do not belong on a physical booth wall
    const keptIsBooth = retail.some((m) => buildNamePatterns(m).some((re) => re.test(value)));
    if (oversize && !options.isNicheBoothFit && (!value || keptIsBooth)) {
        value = LOCAL_CASH_VENUE;
    }
    if (!value) {
        if (oversize) value = LOCAL_CASH_VENUE;
        else if (options.isSmallCurio && !options.isApparel && smallBooths[0]) value = smallBooths[0].name;
        else {
            const primary = retail.slice().sort((a, b) => Number(b.commissionRate || 0) - Number(a.commissionRate || 0))[0];
            value = primary ? primary.name : 'eBay';
        }
    }
    return { value, changed: value !== raw, removed };
}

// ---------------------------------------------------------------------------
// (b) Single-item valuation sanity — hierarchy + boutique/fair cap
// ---------------------------------------------------------------------------

export function extractDeclaredUnitCount(textOrItem: any): number {
    if (!textOrItem) return 1;
    if (typeof textOrItem === 'object') {
        const explicit = Number(textOrItem.declared_unit_count || textOrItem.detected_unit_count || 0);
        if (Number.isFinite(explicit) && explicit >= 2 && explicit <= 150) return Math.round(explicit);
    }
    const rawText =
        typeof textOrItem === 'string'
            ? textOrItem
            : `${textOrItem.title || ''} ${textOrItem.identity || ''}`;
    const text = String(rawText || '').trim();
    if (!text) return 1;

    // 1. Explicit "Lot of 25", "Bundle of 8", "Set of 4", "Collection of 12"
    const lotOfMatch = text.match(/\b(?:lot|bundle|set|collection|group|pack)\s+of\s+(\d{1,3})\b/i);
    if (lotOfMatch) {
        const n = parseInt(lotOfMatch[1], 10);
        if (n >= 2 && n <= 150) return n;
    }

    // 2. Parenthetical "(x6)", "[x10]", "(Lot of 12)"
    const parenMatch = text.match(/[\(\[]\s*(?:x\s*(\d{1,3})|(\d{1,3})\s*x|(?:lot|set|pack|bundle)\s+of\s+(\d{1,3}))\s*[\)\]]/i);
    if (parenMatch) {
        const n = parseInt(parenMatch[1] || parenMatch[2] || parenMatch[3] || '1', 10);
        if (n >= 2 && n <= 150) return n;
    }

    // 3. "25 Vintage Star Trek ... Paperback Novels", "14 Hardcover Books", "8 Comic Books" (excluding LEGO/jigsaw piece counts)
    if (!/\b(?:lego|duplo|mega\s*bloks|jigsaw|puzzle)\b/i.test(text)) {
        const nounMatch = text.match(
            /\b(\d{1,3})\s+(?:[a-z0-9&'-]+\s+){0,5}?(?:books|paperbacks|novels|hardcovers|comics|magazines|zines|manuals|sourcebooks|modules|figures|action\s+figures|dolls|vinyl\s+records|records|lps|cassettes|cds|dvds|vhs|cartridges|video\s+games)\b/i
        );
        if (nounMatch) {
            const n = parseInt(nounMatch[1], 10);
            if (n >= 2 && n <= 150) return n;
        }
    }

    return 1;
}

export function enforceSingleItemValuationSanity(
    item: any,
    shippingTotal: number
): { adjusted: boolean; notes: string[]; boutiqueToFairCap: number } {
    const notes: string[] = [];
    if (!item || typeof item !== 'object') return { adjusted: false, notes, boutiqueToFairCap: 0 };
    if (Array.isArray(item.lot_items) && item.lot_items.length > 1) return { adjusted: false, notes, boutiqueToFairCap: 0 };
    if (extractDeclaredUnitCount(item) >= 2) return { adjusted: false, notes, boutiqueToFairCap: 0 };

    const pb = item.price_breakdown && typeof item.price_breakdown === 'object' ? item.price_breakdown : (item.price_breakdown = {});
    const pp = item.pricing_potential && typeof item.pricing_potential === 'object' ? item.pricing_potential : (item.pricing_potential = {});

    const fairStr = pb.fair || pp.fair;
    const boutiqueStr = pb.boutique_premium || pp.boutique;
    const fairMid = rangeMid(fairStr);
    let boutiqueMid = rangeMid(boutiqueStr);
    if (fairMid <= 0) return { adjusted: false, notes, boutiqueToFairCap: 0 };

    const freight = getFreightProfile(item, shippingTotal);
    const cap = freight.isFreightHeavy ? 1.15 : 1.35;

    let newBoutique = boutiqueStr as string;
    if (boutiqueMid > fairMid * cap) {
        const factor = (fairMid * cap) / boutiqueMid;
        newBoutique = scaleRange(boutiqueStr, factor);
        boutiqueMid = rangeMid(newBoutique);
        notes.push(`Boutique capped at ${cap.toFixed(2)}x of Fair Online${freight.isFreightHeavy ? ' (oversize / freight-heavy)' : ''}`);
    }
    if (boutiqueMid > 0 && boutiqueMid < fairMid) {
        newBoutique = String(fairStr);
        boutiqueMid = fairMid;
        notes.push('Boutique raised to Fair Online floor');
    }
    if (newBoutique && newBoutique !== boutiqueStr) {
        pb.boutique_premium = newBoutique;
        pp.boutique = newBoutique;
    }

    const mintStr = pb.mint;
    if (mintStr && rangeMid(mintStr) < boutiqueMid) {
        pb.mint = scaleRange(newBoutique || boutiqueStr, 1.1);
        notes.push('Mint raised to sit above Boutique');
    }
    const poorStr = pb.poor;
    if (poorStr && rangeMid(poorStr) > fairMid) {
        pb.poor = scaleRange(fairStr, 0.5);
        notes.push('Poor lowered to sit below Fair');
    }
    if (notes.length) item.valuation_adjustments = notes;
    return { adjusted: notes.length > 0, notes, boutiqueToFairCap: cap };
}

// ---------------------------------------------------------------------------
// (c) Canonical auction / offer tiers — signed P&L, honest dead-deal states
// ---------------------------------------------------------------------------

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeCanonicalAuctionTiers(input: CanonicalTierInput): CanonicalTierResult {
    const targetResale = Math.max(0, Number(input.targetResale) || 0);
    const feePct = input.feePct !== undefined && input.feePct !== null ? Number(input.feePct) : 15;
    const netPayout = r2(targetResale * (1 - feePct / 100));
    const currentBid = Math.max(0, Number(input.currentBid) || 0);
    const bpPct = Math.max(0, Number(input.buyersPremiumPct) || 0);
    const isAuction = Boolean(input.isAuction);
    const shippingTotal = input.isLocalPickupOnly ? 0 : Math.max(0, Number(input.shippingTotal) || 0);
    const combineSavings = input.isLocalPickupOnly ? 0 : Math.max(0, Number(input.combineSavings) || 0);
    const shipFloor = input.isLocalPickupOnly ? 0 : Math.max(0, Number(input.shipHandling) || 0);
    const effectiveShip = input.isLocalPickupOnly ? 0 : Math.max(shipFloor > 0 ? shipFloor : 0, shippingTotal - combineSavings);
    const sniperCentsAllowed = Boolean(isAuction && !input.isSoftClose && bpPct <= 0);
    const multiples = input.roiMultiples || [3.0, 2.2, 1.7];
    const keys: Array<CanonicalTier['key']> = ['conservative', 'balanced', 'aggressive'];
    const bpMult = 1 + bpPct / 100;

    const landedAt = (bid: number) => r2(bid * bpMult + effectiveShip);
    const netProfitAtCurrentBid = currentBid > 0 ? Math.round(netPayout - landedAt(currentBid)) : null;

    const build = (key: CanonicalTier['key'], roi: number): CanonicalTier => {
        const targetLanded = r2(targetResale / roi);
        const availAfterShip = targetLanded - effectiveShip;
        const rawHammer = availAfterShip / bpMult;
        let maxBid = availAfterShip <= 0 ? 0 : isAuction ? Math.max(0, Math.floor(rawHammer)) : Math.max(0, r2(rawHammer));
        let status: ScoutTierStatus = 'active';
        let statusLabel = '';
        if (maxBid <= 0) {
            maxBid = 0;
            status = 'ship_exceeds_cap';
            statusLabel = `🛑 S&H > $${Math.round(targetLanded)} Cap`;
        } else if (currentBid > 0 && currentBid > maxBid) {
            status = 'outbid';
            statusLabel = `🚫 Outbid ($${Math.round(currentBid)} > $${Math.round(maxBid)})`;
        }
        if (status === 'active' && sniperCentsAllowed && input.useProxyCents) maxBid = Number((maxBid + 0.87).toFixed(2));
        const bpDollars = bpPct > 0 ? r2((maxBid * bpPct) / 100) : 0;
        const estLanded = r2(maxBid + bpDollars + effectiveShip);
        return {
            key,
            roi,
            roiLabel: `${roi.toFixed(1)}x`,
            targetLanded,
            maxBid,
            bpDollars,
            estLanded,
            netProfit: status !== 'active' && netProfitAtCurrentBid !== null ? netProfitAtCurrentBid : Math.round(netPayout - estLanded), // SIGNED — never Math.max(0, …); dead tiers report the real at-current-bid result
            netProfitAtCurrentBid,
            status,
            statusLabel,
            passed: status !== 'active',
        };
    };

    const tiers = {
        conservative: build(keys[0], multiples[0]),
        balanced: build(keys[1], multiples[1]),
        aggressive: build(keys[2], multiples[2]),
    };
    const list = [tiers.conservative, tiers.balanced, tiers.aggressive];
    const allDead = list.every((t) => t.status !== 'active');
    const anyShipExceedsCap = list.some((t) => t.status === 'ship_exceeds_cap');
    const allShipExceedsCap = list.every((t) => t.status === 'ship_exceeds_cap');
    const freightPct = targetResale > 0 ? shippingTotal / targetResale : 0;
    const isFreightTrap =
        shippingTotal > 0 && targetResale > 0 && (shippingTotal >= 0.45 * targetResale || (shippingTotal >= 65 && shippingTotal >= 0.35 * targetResale));

    const verdictOverride: 'PASS' | null = allDead && (isAuction || allShipExceedsCap) ? 'PASS' : null;

    return {
        targetResale,
        netPayout,
        effectiveShip,
        isFreightTrap,
        freightPctOfResale: Math.round(freightPct * 100),
        sniperCentsAllowed: sniperCentsAllowed && !allDead,
        tiers,
        atCurrentBid:
            currentBid > 0
                ? {
                      landed: landedAt(currentBid),
                      netProfit: netProfitAtCurrentBid as number,
                      roiX: landedAt(currentBid) > 0 ? r2(netPayout / landedAt(currentBid)) : null,
                  }
                : null,
        allDead,
        anyShipExceedsCap,
        verdictOverride,
        primaryCta: allDead ? 'watch_only' : 'track',
    };
}

// ---------------------------------------------------------------------------
// One-call guardrail pipeline used by /api/identify-item
// ---------------------------------------------------------------------------

export interface GuardrailContext {
    venueMetas: VenueMetaLike[];
    shippingTotal: number;
    shippingWeightLbs?: number;
    currentBid: number;
    buyersPremiumPct: number;
    isAuction: boolean;
    isSoftClose: boolean;
    isLocalPickupOnly: boolean;
    boothFeePct?: number;
    visionPhotosScanned?: number;
    visionPhotoUrls?: string[];
}

function extractLotItemQty(li: any): number {
    if (!li || typeof li !== 'object') return 1;
    const explicit = Number(li.quantity ?? li.qty ?? 0);
    if (Number.isFinite(explicit) && explicit > 1 && explicit <= 99) return Math.round(explicit);
    const text = `${li.name || ''} ${li.title || ''} ${li.identity || ''} ${li.tag_title || ''}`;
    const pm = text.match(/[\(\[]\s*(?:x\s*(\d{1,2})|(\d{1,2})\s*x|(?:lot|set|pack|bundle|qty)\s*(?:of|:)?\s*(\d{1,2}))\s*[\)\]]/i);
    if (pm) {
        const n = parseInt(pm[1] || pm[2] || pm[3] || '1', 10);
        if (n > 1 && n <= 99) return n;
    }
    const tm = text.match(/(?:^|\s)(?:x\s*(\d{1,2})|(\d{1,2})\s*x)(?=\s*$|\s*[-–—|])/i);
    if (tm) {
        const n = parseInt(tm[1] || tm[2] || '1', 10);
        if (n > 1 && n <= 99) return n;
    }
    return 1;
}

export function applyScoutReportGuardrails(item: any, ctx: GuardrailContext): void {
    if (!item || typeof item !== 'object') return;

    // 1) Valuation sanity (single items only)
    enforceSingleItemValuationSanity(item, ctx.shippingTotal);

    // 2) Freight profile → combine shipping off for oversized freight
    const freight = getFreightProfile(item, ctx.shippingTotal);
    if (freight.isOversizedFreight) {
        if (item.seller_info) item.seller_info.can_combine_shipping = false;
        item.canCombineShipping = false;
        item.is_oversized_freight = true;
    }

    // 3) Best Venue — never a 0%-fee backstock warehouse, and never DT on >=2 lb / >=8" / bulky playset / apparel items
    const mr = item.market_report && typeof item.market_report === 'object' ? item.market_report : null;
    const substrate = String(item.physical_substrate || '');
    const isApparel = substrate === 'APPAREL_GARMENT';
    const weightLbs = Number(ctx.shippingWeightLbs ?? item?.seller_info?.shipping_weight ?? item?.shippingWeight ?? freight.weightLbs ?? 0);
    const bulkyPlaysetOrBoxedSet = /\b(?:\d{3,5}\s*(?:pcs|pieces|pzs)|sealed\s+set|playset|board\s*game|castle|joust|display\s+case|framed)\b/i.test(
        `${item?.title || ''} ${item?.identity || ''} ${item?.ocr_detected_text || ''}`
    );
    const isSmallCurio =
        !isApparel &&
        !bulkyPlaysetOrBoxedSet &&
        (weightLbs <= 0 || weightLbs < 2.0) &&
        (freight.longestInches > 0 ? freight.longestInches < 8 : /JEWELRY_METAL|TOY_FIGURE|POTTERY_DRINKWARE/.test(substrate));
    if (mr) {
        const venue = sanitizeBestVenue(mr.best_platform, ctx.venueMetas, {
            longestInches: freight.longestInches,
            shippingTotal: ctx.shippingTotal,
            isApparel,
            isSmallCurio,
        });
        if (venue.changed) {
            mr.best_platform = venue.value;
            mr.best_platform_sanitized = true;
        }
        if (Array.isArray(mr.channels)) {
            const backstockMetas = ctx.venueMetas.filter(isBackstockMeta);
            const dtDisqualifiedMetas =
                isApparel || !isSmallCurio ? ctx.venueMetas.filter((m) => String(m.code || '').toUpperCase() === 'DT') : [];
            const pats = [...backstockMetas, ...dtDisqualifiedMetas].flatMap(buildNamePatterns);
            const fallbackDtRe = isApparel || !isSmallCurio ? /\bdusty\s*tiger\b|\(\s*DT\s*\)/i : null;
            mr.channels = mr.channels.filter((c: any) => {
                const cName = String(c?.name || '');
                if (pats.some((re) => re.test(cName))) return false;
                if (fallbackDtRe && fallbackDtRe.test(cName)) return false;
                return true;
            });
        }
    }

    // 4) Canonical tiers + deterministic PASS
    const boutiqueMid = rangeMid(item.price_breakdown?.boutique_premium || item.pricing_potential?.boutique);
    const fairMid = rangeMid(item.price_breakdown?.fair || item.pricing_potential?.fair);
    const lotSum =
        Array.isArray(item.lot_items) && item.lot_items.length > 1
            ? item.lot_items.reduce((s: number, li: any) => s + rangeMid(li?.price_breakdown?.boutique_premium || li?.pricing_potential?.boutique || li?.estimated_value), 0)
            : 0;
    const targetResale = Math.max(lotSum, boutiqueMid > 0 ? boutiqueMid : fairMid);
    if (targetResale > 0) {
        const result = computeCanonicalAuctionTiers({
            targetResale,
            feePct: ctx.boothFeePct,
            currentBid: ctx.currentBid,
            shippingTotal: ctx.shippingTotal,
            buyersPremiumPct: ctx.buyersPremiumPct,
            isAuction: ctx.isAuction,
            isSoftClose: ctx.isSoftClose,
            isLocalPickupOnly: ctx.isLocalPickupOnly,
        });
        item.canonical_tiers = result;
        item.is_freight_trap = result.isFreightTrap;
        if (result.verdictOverride === 'PASS') {
            item.purchase_strategy = item.purchase_strategy || {};
            item.purchase_strategy.verdict = 'PASS';
            item.purchase_strategy.dead_deal = true;
            item.purchase_strategy.max_bid = result.tiers.balanced.maxBid;
            item.maxBid = result.tiers.balanced.maxBid;
        }

        const itemLotUnits =
            Array.isArray(item.lot_items) && item.lot_items.length > 0
                ? item.lot_items.reduce((s: number, li: any) => s + extractLotItemQty(li), 0)
                : 0;
        const declaredUnits = Math.max(extractDeclaredUnitCount(item), itemLotUnits);
        if (declaredUnits >= 2) {
            item.declared_unit_count = declaredUnits;
            const refLanded =
                result.atCurrentBid?.landed ||
                (result.tiers.balanced.status === 'active' ? result.tiers.balanced.estLanded : 0) ||
                Number(item.purchase_strategy?.max_landed_cost || 0);
            if (refLanded > 0) {
                item.landed_cost_per_unit = r2(refLanded / declaredUnits);
            }
        }
    }

    // 5) Vision proof
    if (ctx.visionPhotosScanned !== undefined) item.vision_photos_scanned = ctx.visionPhotosScanned;
    if (ctx.visionPhotoUrls) item.vision_photo_urls = ctx.visionPhotoUrls;
}

// ---------------------------------------------------------------------------
// (d) Composable report section registry
// ---------------------------------------------------------------------------

type SectionBuilder = (t: any) => string;

const joinList = (v: any) => (Array.isArray(v) ? v.join(', ') : String(v || ''));

export const SCOUT_SECTION_BUILDERS: Record<string, SectionBuilder> = {
    header: () => `### 🕵️ Speed Scout Appraisal Report\n\n`,
    tier: (t) => {
        if (!(t.tier_label || t.tier)) return '';
        const name = t.tier_label || (t.tier === 'showcase' ? '🌟 Showcase' : t.tier === 'quick_turn' ? '⚡ Quick Turn' : '📦 Core');
        return `**Inventory Tier:** ${name}\n\n`;
    },
    title: (t) => (t.title ? `**Title:** ${String(t.title).replace(/\[Tier \d[^\]]*\]\s*/i, '').trim()}\n\n` : ''),
    vision: (t) => {
        if (t.vision_photos_scanned === undefined || t.vision_photos_scanned === null) return '';
        return Number(t.vision_photos_scanned) > 0
            ? `**📸 AI Inspected:** ${t.vision_photos_scanned} photo${Number(t.vision_photos_scanned) === 1 ? '' : 's'}\n\n`
            : `**⚠️ 0 Photos Reached AI** — this report is text-only. Re-run with photos selected.\n\n`;
    },
    why: (t) => (t.why_pay_up ? `**💎 Sourcing Catalyst (Why Pay Up):** ${t.why_pay_up}\n\n` : ''),
    risk: (t) => (t.why_pass ? `**⚠️ Risk Rationale (Why Pass):** ${t.why_pass}\n\n` : ''),
    ocr: (t) => (t.ocr_detected_text ? `**🔎 OCR / Signature Read:** ${t.ocr_detected_text}\n\n` : ''),
    condition: (t) => (t.condition_notes ? `**Condition:** ${t.condition_notes}\n\n` : ''),
    redflags: (t) => (t.red_flags && t.red_flags.length ? `**🚩 Red Flags:** ${joinList(t.red_flags)}\n\n` : ''),
    valuation: (t) => {
        if (!(t.pricing_potential || t.price_breakdown)) return '';
        let s = `**Valuation Breakdown:**\n`;
        const fair = t.pricing_potential?.fair || t.price_breakdown?.fair;
        const boutique = t.pricing_potential?.boutique || t.price_breakdown?.boutique_premium;
        if (fair) s += `- **Fair Market:** ${fair}\n`;
        if (boutique) s += `- **Boutique Booth:** ${boutique}\n`;
        if (t.price_breakdown?.mint) s += `- **Mint / New:** ${t.price_breakdown.mint}\n`;
        if (t.price_breakdown?.poor) s += `- **Poor / As-Is:** ${t.price_breakdown.poor}\n`;
        return s + `\n`;
    },
    strategy: (t) => {
        const ps = t.purchase_strategy;
        if (!ps) return '';
        let s = `**Sourcing Strategy:**\n`;
        if (ps.verdict) s += `- **Verdict:** ${ps.verdict}\n`;
        const dead = t.canonical_tiers?.allDead;
        if (ps.max_bid !== undefined && ps.max_bid !== null) {
            s += dead && Number(ps.max_bid) <= 0 ? `- **Max Bid Target:** $0.00 (no profitable bid — watch only)\n` : `- **Max Bid Target:** $${Number(ps.max_bid).toFixed(2)}\n`;
        }
        if (ps.max_landed_cost !== undefined && ps.max_landed_cost !== null) s += `- **Max Landed Cost:** $${Number(ps.max_landed_cost).toFixed(2)}\n`;
        const acb = t.canonical_tiers?.atCurrentBid;
        if (acb) {
            const acbTxt =
                acb.netProfit < 0
                    ? `**${money(acb.netProfit)} loss**`
                    : dead
                      ? `⚠️ ${moneyWhole(acb.netProfit)} thin margin (below 1.7x floor)`
                      : `${moneyWhole(acb.netProfit)} net`;
            s += `- **At Current Bid:** landed $${acb.landed.toFixed(2)} → ${acbTxt}\n`;
        }
        if (t.declared_unit_count >= 2 && Number(t.landed_cost_per_unit) > 0) {
            s += `- **Landed Cost / Unit:** $${Number(t.landed_cost_per_unit).toFixed(2)}/unit across ${t.declared_unit_count} units\n`;
        }
        if (t.is_freight_trap) s += `- **🚚 Freight Killer:** S&H is ${t.canonical_tiers?.freightPctOfResale ?? '?'}% of resale value\n`;
        if (ps.advice) s += `- **Advice:** ${ps.advice}\n`;
        return s + `\n`;
    },
    market: (t) => {
        const mr = t.market_report;
        if (!mr) return '';
        let s = `**Market & Channels:**\n`;
        if (mr.best_platform) s += `- **Best Platform:** ${mr.best_platform}\n`;
        if (mr.sell_through_velocity) s += `- **Velocity:** ${mr.sell_through_velocity}\n`;
        if (mr.platform_rationale) s += `- **Rationale:** ${mr.platform_rationale}\n`;
        if (Array.isArray(mr.channels)) {
            mr.channels.forEach((ch: any) => {
                s += `  - *${ch.name}*: ${ch.est_price || ''} (Payout: ${ch.net_payout || ''}) ${ch.recommendation ? `[${ch.recommendation}]` : ''}\n`;
            });
        }
        return s + `\n`;
    },
    comparables: (t) => {
        if (!(t.comparables && t.comparables.length > 0)) return '';
        let s = `**💬 Sold Comps:**\n`;
        t.comparables.forEach((c: any) => (s += `- ${c.name} (${c.price}) [${c.status || 'Sold'}]\n`));
        return s + `\n`;
    },
    lot: (t) => {
        if (t.lot_breakdown_unavailable && !(t.lot_items && t.lot_items.length > 1)) {
            return `**⚠️ Lot Not Itemized:** Valued as unbroken bulk (low confidence — re-scan with spine/detail photos selected).\n\n`;
        }
        if (!(t.lot_items && t.lot_items.length > 0)) return '';
        const totalUnits = t.lot_items.reduce((sum: number, li: any) => sum + extractLotItemQty(li), 0);
        const mismatchNote = t.lot_quantity_mismatch
            ? ` *(⚠️ Itemized ${t.lot_quantity_mismatch.itemized} of ${t.lot_quantity_mismatch.declared} declared units)*`
            : '';
        let s = `**📦 Lot Items (${t.lot_items.length} Lines • ${totalUnits} Total Units):**${mismatchNote}\n`;
        t.lot_items.forEach((li: any, idx: number) => {
            const qty = extractLotItemQty(li);
            const splitCost = Number(li.split_cost_basis || 0);
            const unitCost = qty > 1 && splitCost > 0 ? (splitCost / qty).toFixed(2) : '';
            const costSuffix =
                splitCost > 0
                    ? qty > 1
                        ? ` | Cost/Item: **$${unitCost}/ea** (Split $${splitCost.toFixed(2)} ÷ ${qty})`
                        : ` | Split Cost: $${splitCost.toFixed(2)}`
                    : '';
            s += `${idx + 1}. **${li.name || li.title || li.identity}**${qty > 1 ? ` *(×${qty} Qty)*` : ''} — Boutique: ${li.pricing_potential?.boutique || li.price_breakdown?.boutique_premium || li.estimated_value || '-'}${costSuffix}\n`;
        });
        return s + `\n`;
    },
    diagnostics: (t) => {
        const bits: string[] = [];
        if (t.valuation_adjustments?.length) bits.push(`Adjustments: ${t.valuation_adjustments.join('; ')}`);
        if (t.market_report?.best_platform_sanitized) bits.push('Best Venue sanitized (backstock removed)');
        if (t.vision_photo_urls?.length) bits.push(`Photos: ${t.vision_photo_urls.length}`);
        if (t.rulesVersion) bits.push(`Rules v${t.rulesVersion}`);
        return bits.length ? `**🧪 Diagnostics:** ${bits.join(' • ')}\n\n` : '';
    },
};

export const SCOUT_PROFILE_SECTIONS: Record<ScoutReportProfile, string[]> = {
    DRAWER_MD: ['header', 'tier', 'title', 'vision', 'why', 'risk', 'ocr', 'condition', 'redflags', 'valuation', 'strategy', 'market', 'comparables', 'lot'],
    BML_TRAY: ['title', 'vision', 'why', 'risk', 'ocr', 'valuation', 'strategy', 'comparables'],
    TESTBENCH: ['header', 'tier', 'title', 'vision', 'why', 'risk', 'ocr', 'condition', 'redflags', 'valuation', 'strategy', 'market', 'comparables', 'lot', 'diagnostics'],
    PARTNER_BRIEF: ['title', 'why', 'valuation', 'strategy', 'comparables'],
};

function unwrapScoutItem(item: any): any {
    if (!item) return null;
    const obj = typeof item === 'string' ? (() => { try { return JSON.parse(item); } catch { return null; } })() : item;
    if (!obj) return null;
    return Array.isArray(obj) ? obj[0] : obj.items ? obj.items[0] : obj;
}

export function renderScoutReportMarkdown(item: any, profile: ScoutReportProfile = 'DRAWER_MD'): string {
    const target = unwrapScoutItem(item);
    if (!target) return '';
    const ids = SCOUT_PROFILE_SECTIONS[profile] || SCOUT_PROFILE_SECTIONS.DRAWER_MD;
    return ids
        .map((id) => (SCOUT_SECTION_BUILDERS[id] ? SCOUT_SECTION_BUILDERS[id](target) : ''))
        .join('')
        .trim();
}

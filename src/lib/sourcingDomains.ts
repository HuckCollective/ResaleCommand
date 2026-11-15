/**
 * Sourcing Domain Registry & Normalized Envelope (`src/lib/sourcingDomains.ts`)
 *
 * Pure isomorphic module (safe for Astro SSR routes, browser Vue SFCs, and unit checks).
 * Eliminates ShopGoodwill prompt/shipping bias from global `/scout` camera scans and
 * non-SGW online marketplaces while providing a canonical domain profile schema that
 * persists inside `resale_db.manifests/ai_appraisal_rules_v1`.
 */

export const SOURCING_DOMAIN_KEYS = [
    'in_person',
    'shopgoodwill',
    'ebay',
    'local_cash',
    'estate_bp',
    'fixed_marketplace',
    'generic_url',
] as const;

export type SourcingDomainKey = (typeof SOURCING_DOMAIN_KEYS)[number];

export type TrackerPrefix = 'SC' | 'LC' | 'EB' | 'BP' | 'OM';

export interface SourcingDomainProfile {
    key: SourcingDomainKey;
    label: string;
    shortLabel: string;
    icon: string;
    hostPatterns: string[];
    trackerPrefix: TrackerPrefix;
    trackerVendor: string;
    allowsCombinedShipping: boolean;
    maxWeightLbs: number;
    maxItemCount: number;
    combineWindowDays: number;
    defaultBuyersPremiumPct: number;
    isAuction: boolean;
    isLocalPickupDefault: boolean;
    defaultShippingFallbackUsd: number;
    guardrailNote: string;
}

export interface NormalizedSourcingMeta {
    domainKey: SourcingDomainKey;
    platformLabel: string;
    itemId: string;
    sourceUrl: string;
    seller: string;
    sellerId: string;
    shippingWeightLbs: number;
    estimatedShippingUsd: number;
    currentBidUsd: number;
    minimumBidUsd: number;
    myMaxBidUsd: number;
    buyersPremiumPct: number;
    auctionEndsAt: string;
    syncedAt: string;
}

export const DEFAULT_SOURCING_DOMAIN_PROFILES: Record<SourcingDomainKey, SourcingDomainProfile> = {
    in_person: {
        key: 'in_person',
        label: 'In-Person / Camera Scout',
        shortLabel: 'In-Person',
        icon: '📷',
        hostPatterns: [],
        trackerPrefix: 'SC',
        trackerVendor: 'Thrift / In-Person',
        allowsCombinedShipping: false,
        maxWeightLbs: 0,
        maxItemCount: 0,
        combineWindowDays: 0,
        defaultBuyersPremiumPct: 0,
        isAuction: false,
        isLocalPickupDefault: true,
        defaultShippingFallbackUsd: 0,
        guardrailNote: '',
    },
    shopgoodwill: {
        key: 'shopgoodwill',
        label: 'ShopGoodwill Auctions',
        shortLabel: 'ShopGoodwill',
        icon: '🏛️',
        hostPatterns: ['shopgoodwill.com'],
        trackerPrefix: 'SC',
        trackerVendor: 'Auctions',
        allowsCombinedShipping: true,
        maxWeightLbs: 20,
        maxItemCount: 20,
        combineWindowDays: 7,
        defaultBuyersPremiumPct: 0,
        isAuction: true,
        isLocalPickupDefault: false,
        defaultShippingFallbackUsd: 11.5,
        guardrailNote: 'Untested thrift donation auction; factor regional S&H + handling and Minimum Bid floor.',
    },
    ebay: {
        key: 'ebay',
        label: 'eBay Listings & Auctions',
        shortLabel: 'eBay',
        icon: '🏷️',
        hostPatterns: ['ebay.com', 'ebay.ca', 'ebay.co.uk'],
        trackerPrefix: 'EB',
        trackerVendor: 'eBay',
        allowsCombinedShipping: false,
        maxWeightLbs: 50,
        maxItemCount: 40,
        combineWindowDays: 5,
        defaultBuyersPremiumPct: 0,
        isAuction: true,
        isLocalPickupDefault: false,
        defaultShippingFallbackUsd: 9.5,
        guardrailNote: 'Distinguish Buy-It-Now / Best Offer vs live auction bid; use stated shipping only.',
    },
    local_cash: {
        key: 'local_cash',
        label: 'Local Cash (FB / CL / OfferUp)',
        shortLabel: 'Local Cash',
        icon: '🤝',
        hostPatterns: ['facebook.com', 'craigslist.org', 'offerup.com', 'nextdoor.com'],
        trackerPrefix: 'LC',
        trackerVendor: 'Local Cash',
        allowsCombinedShipping: false,
        maxWeightLbs: 0,
        maxItemCount: 0,
        combineWindowDays: 0,
        defaultBuyersPremiumPct: 0,
        isAuction: false,
        isLocalPickupDefault: true,
        defaultShippingFallbackUsd: 0,
        guardrailNote: 'Local cash pickup ($0 S&H unless shipped); factor bundle/cash negotiation discount.',
    },
    estate_bp: {
        key: 'estate_bp',
        label: 'Estate & BP Auctions (HiBid / CTBids)',
        shortLabel: 'Estate BP',
        icon: '🔨',
        hostPatterns: ['hibid.com', 'ctbids.com', 'liveauctioneers.com', 'maxsold.com', 'estatesales.net', 'proxibid.com'],
        trackerPrefix: 'BP',
        trackerVendor: 'Estate Auctions',
        allowsCombinedShipping: false,
        maxWeightLbs: 0,
        maxItemCount: 0,
        combineWindowDays: 0,
        defaultBuyersPremiumPct: 15,
        isAuction: true,
        isLocalPickupDefault: true,
        defaultShippingFallbackUsd: 0,
        guardrailNote: 'Include Buyer Premium (typically 15-18%) on top of hammer bid; verify pickup window.',
    },
    fixed_marketplace: {
        key: 'fixed_marketplace',
        label: 'Peer Marketplaces (Poshmark / Mercari / Etsy)',
        shortLabel: 'Marketplaces',
        icon: '🛍️',
        hostPatterns: ['poshmark.com', 'mercari.com', 'depop.com', 'etsy.com', 'grailed.com', 'whatnot.com'],
        trackerPrefix: 'OM',
        trackerVendor: 'Online Marketplaces',
        allowsCombinedShipping: false,
        maxWeightLbs: 5,
        maxItemCount: 10,
        combineWindowDays: 0,
        defaultBuyersPremiumPct: 0,
        isAuction: false,
        isLocalPickupDefault: false,
        defaultShippingFallbackUsd: 8.27,
        guardrailNote: 'Fixed-price peer listing; evaluate offer target (15-25% off ask) + stated shipping.',
    },
    generic_url: {
        key: 'generic_url',
        label: 'Other Online URLs',
        shortLabel: 'Web URL',
        icon: '🌐',
        hostPatterns: [],
        trackerPrefix: 'OM',
        trackerVendor: 'Online Marketplaces',
        allowsCombinedShipping: false,
        maxWeightLbs: 0,
        maxItemCount: 0,
        combineWindowDays: 0,
        defaultBuyersPremiumPct: 0,
        isAuction: false,
        isLocalPickupDefault: false,
        defaultShippingFallbackUsd: 0,
        guardrailNote: 'External online listing; rely strictly on stated price and shipping.',
    },
};

const PLACEHOLDER_SELLER_SET = new Set([
    '',
    'unknown',
    'unknown seller',
    'n/a',
    'na',
    'none',
    'online listing',
    'web listing',
    'external listing',
    'shopgoodwill',
    'shopgoodwill.com',
    'goodwill',
    'ebay',
    'ebay.com',
    'facebook',
    'facebook marketplace',
    'fb marketplace',
    'craigslist',
    'offerup',
    'nextdoor',
    'poshmark',
    'mercari',
    'depop',
    'etsy',
    'grailed',
    'whatnot',
    'hibid',
    'ctbids',
    'liveauctioneers',
    'maxsold',
    'estatesales.net',
    'proxibid',
]);

export function isValidSourcingDomainKey(val: unknown): val is SourcingDomainKey {
    return typeof val === 'string' && (SOURCING_DOMAIN_KEYS as readonly string[]).includes(val);
}

export function cloneDefaultDomainProfiles(): Record<SourcingDomainKey, SourcingDomainProfile> {
    const out = {} as Record<SourcingDomainKey, SourcingDomainProfile>;
    for (const key of SOURCING_DOMAIN_KEYS) {
        const base = DEFAULT_SOURCING_DOMAIN_PROFILES[key];
        out[key] = {
            ...base,
            hostPatterns: [...base.hostPatterns],
        };
    }
    return out;
}

/**
 * Returns true if `seller` is blank or just a generic platform fallback name
 * (e.g. `'Facebook Marketplace'`, `'eBay'`, `'Online Listing'`).
 * Real regional chapters like `'Goodwill Industries of Greater Cleveland'` return `false`.
 */
export function isPlaceholderSellerName(seller?: string | null): boolean {
    const clean = String(seller || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
    if (!clean || clean.length < 2) return true;
    return PLACEHOLDER_SELLER_SET.has(clean);
}

const STRIP_QUERY_PARAMS = new Set([
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'fbclid',
    'gclid',
    'mkcid',
    'mkrid',
    'campid',
    'customid',
    'toolid',
    'mkevt',
    'igshid',
    'si',
]);

/**
 * Strips noisy ad/tracking query params while keeping item identifiers intact,
 * and clamps length so Appwrite attributes never overflow.
 */
export function normalizeSourceListingUrl(rawUrl?: string | null, maxLen = 500): string {
    const trimmed = String(rawUrl || '').trim();
    if (!trimmed) return '';
    if (!/^https?:\/\//i.test(trimmed)) {
        return trimmed.slice(0, maxLen);
    }
    try {
        const parsed = new URL(trimmed);
        parsed.hash = '';
        for (const key of Array.from(parsed.searchParams.keys())) {
            if (STRIP_QUERY_PARAMS.has(key.toLowerCase())) {
                parsed.searchParams.delete(key);
            }
        }
        const normalized = parsed.toString();
        if (normalized.length <= maxLen) return normalized;
        // If query string is still huge (e.g. Facebook Marketplace tracking blobs), keep origin + pathname
        const originAndPath = `${parsed.origin}${parsed.pathname}`;
        return originAndPath.slice(0, maxLen);
    } catch {
        return trimmed.slice(0, maxLen);
    }
}

/**
 * Appwrite `resale_db.items.sourcingLocation` has a strict 255-char schema limit.
 */
export function clampSourcingLocationAttr(rawUrlOrLoc?: string | null): string {
    return normalizeSourceListingUrl(rawUrlOrLoc, 255).slice(0, 255);
}

function classifyHostOrUrl(rawUrlOrHost: string): SourcingDomainKey | null {
    const lower = String(rawUrlOrHost || '').trim().toLowerCase();
    if (!lower) return null;

    let host = lower;
    let full = lower;
    if (/^https?:\/\//i.test(lower)) {
        try {
            const u = new URL(lower);
            host = u.hostname.toLowerCase();
            full = `${host}${u.pathname.toLowerCase()}`;
        } catch {
            host = lower;
        }
    }

    if (host.includes('shopgoodwill.com')) return 'shopgoodwill';
    if (/(?:^|\.)ebay\.(?:com|ca|co\.uk|de|com\.au)$/.test(host) || full.includes('ebay.com/')) return 'ebay';
    if (
        host.includes('craigslist.org') ||
        host.includes('offerup.com') ||
        host.includes('nextdoor.com') ||
        (host.includes('facebook.com') && (full.includes('/marketplace') || full.includes('/commerce') || full.includes('/groups'))) ||
        host === 'facebook.com' ||
        host === 'www.facebook.com' ||
        host === 'm.facebook.com'
    ) {
        return 'local_cash';
    }
    if (
        host.includes('hibid.com') ||
        host.includes('ctbids.com') ||
        host.includes('liveauctioneers.com') ||
        host.includes('maxsold.com') ||
        host.includes('estatesales.net') ||
        host.includes('proxibid.com')
    ) {
        return 'estate_bp';
    }
    if (
        host.includes('poshmark.') ||
        host.includes('mercari.') ||
        host.includes('depop.') ||
        host.includes('etsy.') ||
        host.includes('grailed.') ||
        host.includes('whatnot.')
    ) {
        return 'fixed_marketplace';
    }
    if (/^https?:\/\//i.test(lower)) {
        return 'generic_url';
    }
    return null;
}

function parseRawAnalysisObject(raw: unknown): Record<string, any> | null {
    if (!raw) return null;
    if (typeof raw === 'object') return raw as Record<string, any>;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            return null;
        }
    }
    return null;
}

export interface SourcingDomainLookupInput {
    domainKey?: string | null;
    url?: string | null;
    sourceUrl?: string | null;
    hostname?: string | null;
    platformId?: string | null;
    sourcingLocation?: string | null;
    vendor?: string | null;
    rawAnalysis?: unknown;
}

/**
 * Resolves the canonical `SourcingDomainKey` for any item, listing envelope, or URL.
 * When no URL or online platform signal is present (e.g. Global `/scout` camera scan),
 * ALWAYS returns `'in_person'` — never `'shopgoodwill'`.
 */
export function resolveSourcingDomain(
    input?: SourcingDomainLookupInput | string | null
): SourcingDomainKey {
    if (!input) return 'in_person';
    if (typeof input === 'string') {
        if (isValidSourcingDomainKey(input)) return input;
        return classifyHostOrUrl(input) || 'in_person';
    }

    if (isValidSourcingDomainKey(input.domainKey)) {
        return input.domainKey;
    }

    const rawObj = parseRawAnalysisObject(input.rawAnalysis);
    const savedDomainKey = rawObj?.sourcing?.domainKey;
    if (isValidSourcingDomainKey(savedDomainKey)) {
        return savedDomainKey;
    }

    const urlCandidates = [
        input.url,
        input.sourceUrl,
        rawObj?.sourcing?.sourceUrl,
        input.hostname,
        input.sourcingLocation,
    ];
    for (const candidate of urlCandidates) {
        if (!candidate) continue;
        const matched = classifyHostOrUrl(String(candidate));
        if (matched) return matched;
    }

    const platformHint = String(input.platformId || rawObj?.sourcing?.platformLabel || '').trim().toLowerCase();
    if (platformHint) {
        if (platformHint.includes('shopgoodwill') || platformHint === 'sgw') return 'shopgoodwill';
        if (platformHint.includes('ebay')) return 'ebay';
        if (
            platformHint.includes('facebook') ||
            platformHint.includes('craigslist') ||
            platformHint.includes('offerup') ||
            platformHint.includes('local')
        ) {
            return 'local_cash';
        }
        if (
            platformHint.includes('hibid') ||
            platformHint.includes('ctbids') ||
            platformHint.includes('liveauctioneers') ||
            platformHint.includes('estate')
        ) {
            return 'estate_bp';
        }
        if (
            platformHint.includes('poshmark') ||
            platformHint.includes('mercari') ||
            platformHint.includes('depop') ||
            platformHint.includes('etsy') ||
            platformHint.includes('grailed')
        ) {
            return 'fixed_marketplace';
        }
    }

    // Legacy ShopGoodwill item records saved prior to v4.4
    if (rawObj?.sgwItemId || rawObj?.sgwOrderNumber || rawObj?.sgwSellerId) {
        return 'shopgoodwill';
    }
    const locLower = String(input.sourcingLocation || '').trim().toLowerCase();
    if (locLower.includes('shopgoodwill')) {
        return 'shopgoodwill';
    }

    return 'in_person';
}

export function getDomainProfile(
    domainKey: SourcingDomainKey,
    overrides?: Partial<Record<SourcingDomainKey, Partial<SourcingDomainProfile>>> | null
): SourcingDomainProfile {
    const base = DEFAULT_SOURCING_DOMAIN_PROFILES[domainKey] || DEFAULT_SOURCING_DOMAIN_PROFILES.in_person;
    const patch = overrides?.[domainKey];
    if (!patch || typeof patch !== 'object') {
        return { ...base, hostPatterns: [...base.hostPatterns] };
    }
    return sanitizeSingleDomainProfile(patch, base);
}

function clampNum(val: unknown, fallback: number, min: number, max: number): number {
    const n = Number(val);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n * 100) / 100));
}

const VALID_TRACKER_PREFIXES = new Set<TrackerPrefix>(['SC', 'LC', 'EB', 'BP', 'OM']);

function sanitizeSingleDomainProfile(
    patch: Partial<SourcingDomainProfile> | Record<string, any>,
    base: SourcingDomainProfile
): SourcingDomainProfile {
    const rawPrefix = String(patch.trackerPrefix || base.trackerPrefix).toUpperCase() as TrackerPrefix;
    return {
        key: base.key,
        label: String(patch.label ?? base.label).trim().slice(0, 60) || base.label,
        shortLabel: String(patch.shortLabel ?? base.shortLabel).trim().slice(0, 28) || base.shortLabel,
        icon: String(patch.icon ?? base.icon).trim().slice(0, 8) || base.icon,
        hostPatterns: Array.isArray(patch.hostPatterns)
            ? patch.hostPatterns.map((h: any) => String(h || '').trim().toLowerCase()).filter(Boolean).slice(0, 12)
            : [...base.hostPatterns],
        trackerPrefix: VALID_TRACKER_PREFIXES.has(rawPrefix) ? rawPrefix : base.trackerPrefix,
        trackerVendor: String(patch.trackerVendor ?? base.trackerVendor).trim().slice(0, 48) || base.trackerVendor,
        allowsCombinedShipping:
            typeof patch.allowsCombinedShipping === 'boolean'
                ? patch.allowsCombinedShipping
                : base.allowsCombinedShipping,
        maxWeightLbs: clampNum(patch.maxWeightLbs, base.maxWeightLbs, 0, 200),
        maxItemCount: Math.round(clampNum(patch.maxItemCount, base.maxItemCount, 0, 200)),
        combineWindowDays: Math.round(clampNum(patch.combineWindowDays, base.combineWindowDays, 0, 60)),
        defaultBuyersPremiumPct: clampNum(patch.defaultBuyersPremiumPct, base.defaultBuyersPremiumPct, 0, 50),
        isAuction: typeof patch.isAuction === 'boolean' ? patch.isAuction : base.isAuction,
        isLocalPickupDefault:
            typeof patch.isLocalPickupDefault === 'boolean'
                ? patch.isLocalPickupDefault
                : base.isLocalPickupDefault,
        defaultShippingFallbackUsd: clampNum(
            patch.defaultShippingFallbackUsd,
            base.defaultShippingFallbackUsd,
            0,
            250
        ),
        guardrailNote: String(patch.guardrailNote ?? base.guardrailNote)
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 160),
    };
}

export function sanitizeDomainProfilesInput(
    patch: unknown,
    fallback?: Partial<Record<SourcingDomainKey, SourcingDomainProfile>> | null
): Record<SourcingDomainKey, SourcingDomainProfile> {
    const out = cloneDefaultDomainProfiles();
    const pObj = patch && typeof patch === 'object' ? (patch as Record<string, any>) : {};
    for (const key of SOURCING_DOMAIN_KEYS) {
        const base = fallback?.[key]
            ? sanitizeSingleDomainProfile(fallback[key]!, DEFAULT_SOURCING_DOMAIN_PROFILES[key])
            : DEFAULT_SOURCING_DOMAIN_PROFILES[key];
        const incoming = pObj[key];
        out[key] = incoming && typeof incoming === 'object' ? sanitizeSingleDomainProfile(incoming, base) : base;
    }
    return out;
}

export function buildNormalizedSourcingMeta(input: {
    domainKey: SourcingDomainKey;
    platformLabel?: string;
    itemId?: string;
    sourceUrl?: string;
    seller?: string;
    sellerId?: string;
    shippingWeightLbs?: number;
    estimatedShippingUsd?: number;
    currentBidUsd?: number;
    minimumBidUsd?: number;
    myMaxBidUsd?: number;
    buyersPremiumPct?: number;
    auctionEndsAt?: string;
    syncedAt?: string;
}): NormalizedSourcingMeta {
    const profile = DEFAULT_SOURCING_DOMAIN_PROFILES[input.domainKey] || DEFAULT_SOURCING_DOMAIN_PROFILES.generic_url;
    const rawSeller = String(input.seller || '').trim();
    const cleanSeller = isPlaceholderSellerName(rawSeller) ? '' : rawSeller.slice(0, 140);
    return {
        domainKey: input.domainKey,
        platformLabel: String(input.platformLabel || profile.shortLabel).trim().slice(0, 48),
        itemId: String(input.itemId || '').trim().slice(0, 80),
        sourceUrl: normalizeSourceListingUrl(input.sourceUrl, 500),
        seller: cleanSeller,
        sellerId: String(input.sellerId || '').trim().slice(0, 64),
        shippingWeightLbs: clampNum(input.shippingWeightLbs, 0, 0, 500),
        estimatedShippingUsd: clampNum(input.estimatedShippingUsd, 0, 0, 2000),
        currentBidUsd: clampNum(input.currentBidUsd, 0, 0, 100000),
        minimumBidUsd: clampNum(input.minimumBidUsd, 0, 0, 100000),
        myMaxBidUsd: clampNum(input.myMaxBidUsd, 0, 0, 100000),
        buyersPremiumPct: clampNum(
            input.buyersPremiumPct,
            profile.defaultBuyersPremiumPct,
            0,
            50
        ),
        auctionEndsAt: String(input.auctionEndsAt || '').trim().slice(0, 64),
        syncedAt: String(input.syncedAt || new Date().toISOString()).slice(0, 40),
    };
}

/**
 * Reads normalized sourcing metadata from an item document or parsed `rawAnalysis`,
 * seamlessly bridging legacy `sgw*` fields when reading older ShopGoodwill records.
 */
export function readNormalizedSourcingMeta(docOrRaw: any): NormalizedSourcingMeta {
    const isDoc = Boolean(docOrRaw && (docOrRaw.$id || docOrRaw.rawAnalysis !== undefined || docOrRaw.sourcingLocation !== undefined));
    const rawObj = parseRawAnalysisObject(isDoc ? docOrRaw.rawAnalysis : docOrRaw) || {};
    const src = rawObj.sourcing && typeof rawObj.sourcing === 'object' ? rawObj.sourcing : null;
    const domainKey = resolveSourcingDomain({
        domainKey: src?.domainKey,
        sourceUrl: src?.sourceUrl,
        sourcingLocation: isDoc ? docOrRaw.sourcingLocation : undefined,
        rawAnalysis: rawObj,
    });
    const rawSeller = String(
        src?.seller ||
        rawObj?.sgwSeller ||
        rawObj?.seller_info?.name ||
        (isDoc ? docOrRaw.sellerName || docOrRaw.seller : '') ||
        ''
    ).trim();

    return buildNormalizedSourcingMeta({
        domainKey,
        platformLabel: src?.platformLabel,
        itemId: src?.itemId || rawObj?.sgwItemId || '',
        sourceUrl: src?.sourceUrl || (isDoc && /^https?:\/\//i.test(String(docOrRaw.sourcingLocation || '')) ? docOrRaw.sourcingLocation : ''),
        seller: isPlaceholderSellerName(rawSeller) ? '' : rawSeller,
        sellerId: String(src?.sellerId || rawObj?.sgwSellerId || ''),
        shippingWeightLbs: Number(
            src?.shippingWeightLbs ??
            rawObj?.sgwShippingWeight ??
            rawObj?.shipping_info?.weight_lbs ??
            (isDoc ? docOrRaw.shippingWeightLbs : 0) ??
            0
        ) || 0,
        estimatedShippingUsd: Number(
            src?.estimatedShippingUsd ??
            rawObj?.shipping_info?.estimated_shipping ??
            (isDoc ? docOrRaw.estimatedShipping : 0) ??
            0
        ) || 0,
        currentBidUsd: Number(
            src?.currentBidUsd ??
            rawObj?.auction_meta?.current_bid ??
            0
        ) || 0,
        minimumBidUsd: Number(
            src?.minimumBidUsd ??
            rawObj?.auction_meta?.minimum_bid ??
            0
        ) || 0,
        myMaxBidUsd: Number(
            src?.myMaxBidUsd ??
            rawObj?.sgwMyMaxBid ??
            (isDoc ? docOrRaw.maxBuyPrice : 0) ??
            0
        ) || 0,
        buyersPremiumPct: Number(src?.buyersPremiumPct ?? DEFAULT_SOURCING_DOMAIN_PROFILES[domainKey].defaultBuyersPremiumPct) || 0,
        auctionEndsAt: String(src?.auctionEndsAt || rawObj?.sgwEndTime || rawObj?.auction_meta?.ends_at || ''),
        syncedAt: String(src?.syncedAt || rawObj?.sgwSyncedAt || ''),
    });
}

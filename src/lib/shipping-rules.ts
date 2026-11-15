/**
 * Marketplace Shipping Rules & Combined Shipping Synergy Engine
 * 
 * Centralized, declarative rules for ShopGoodwill, CTBids, HiBid, and eBay.
 * Decouples platform constraints (20-lb caps, 7-day windows, 20-item limits, 1-cent shipping)
 * from Vue components to maintain clean architecture.
 */

import {
    getDomainProfile,
    isPlaceholderSellerName,
    resolveSourcingDomain,
    type SourcingDomainKey,
    type SourcingDomainProfile,
} from './sourcingDomains';

export type MarketplacePlatform = 'shopgoodwill' | 'ctbids' | 'hibid' | 'ebay' | 'generic';

export interface MarketplaceShippingPolicy {
    platform: MarketplacePlatform;
    displayName: string;
    allowsCombinedShipping: boolean;
    maxWeightLbs?: number;
    maxItemCount?: number;
    combineWindowDays?: number;
    allowsAuctionWithBuyNow: boolean;
    requiresSameCarrier: boolean;
    supportsPennyShipping: boolean;
    baseCarrierSavingsPerItem: number;
    defaultBuyerPremiumPercent: number;
}

export const MARKETPLACE_POLICIES: Record<MarketplacePlatform, MarketplaceShippingPolicy> = {
    shopgoodwill: {
        platform: 'shopgoodwill',
        displayName: 'ShopGoodwill',
        allowsCombinedShipping: true,
        maxWeightLbs: 20.0,
        maxItemCount: 20,
        combineWindowDays: 7,
        allowsAuctionWithBuyNow: false,
        requiresSameCarrier: true,
        supportsPennyShipping: true,
        baseCarrierSavingsPerItem: 12.00,
        defaultBuyerPremiumPercent: 0
    },
    ctbids: {
        platform: 'ctbids',
        displayName: 'CTBids',
        allowsCombinedShipping: false, // Individual estate auctions; mostly local pickup
        maxWeightLbs: undefined,
        maxItemCount: undefined,
        combineWindowDays: 0,
        allowsAuctionWithBuyNow: true,
        requiresSameCarrier: false,
        supportsPennyShipping: false,
        baseCarrierSavingsPerItem: 0,
        defaultBuyerPremiumPercent: 15
    },
    hibid: {
        platform: 'hibid',
        displayName: 'HiBid',
        allowsCombinedShipping: false, // Per auctioneer discretion
        maxWeightLbs: undefined,
        maxItemCount: undefined,
        combineWindowDays: 0,
        allowsAuctionWithBuyNow: true,
        requiresSameCarrier: false,
        supportsPennyShipping: false,
        baseCarrierSavingsPerItem: 0,
        defaultBuyerPremiumPercent: 15
    },
    ebay: {
        platform: 'ebay',
        displayName: 'eBay',
        allowsCombinedShipping: false, // Locked default: ShopGoodwill ONLY unless enabled in Appraisal Lab
        maxWeightLbs: 50.0,
        maxItemCount: 40,
        combineWindowDays: 5,
        allowsAuctionWithBuyNow: true,
        requiresSameCarrier: true,
        supportsPennyShipping: false,
        baseCarrierSavingsPerItem: 6.00,
        defaultBuyerPremiumPercent: 0
    },
    generic: {
        platform: 'generic',
        displayName: 'General Marketplace',
        allowsCombinedShipping: false,
        maxWeightLbs: 50.0,
        maxItemCount: 50,
        combineWindowDays: 14,
        allowsAuctionWithBuyNow: true,
        requiresSameCarrier: false,
        supportsPennyShipping: false,
        baseCarrierSavingsPerItem: 0,
        defaultBuyerPremiumPercent: 0
    }
};

export interface SynergyEvaluationResult {
    platform: MarketplacePlatform;
    policy: MarketplaceShippingPolicy;
    sellerId: string | number | null;
    sellerName: string;
    matchingCount: number;

    // Eligibility flags
    isEligible: boolean;
    isSellerCombinable: boolean;

    // Weight Guard (20-lb hard limit on SGW)
    candidateWeight: number;
    existingWeight: number;
    totalWeight: number;
    weightLimit: number;
    remainingWeight: number;
    weightPercentage: number;
    isOverWeightLimit: boolean;

    // Item Count Limit (20-item hard limit on SGW)
    totalItemCount: number;
    itemLimit: number;
    isOverItemLimit: boolean;

    // Date Window Guard (7-day window on SGW)
    isWithinDateWindow: boolean;
    dateSpreadDays: number;
    combineWindowDays: number;
    earliestDate?: string;
    latestDate?: string;

    // Format Restriction (Buy It Now vs Auction)
    isFormatConflict: boolean;

    // 1-Cent Shipping Synergy & Trap
    isCandidatePenny: boolean;
    allPennyShipping: boolean;
    hasPennyShippingItem: boolean;
    pennyNotice?: string;

    // Financials & Guidance
    estimatedSavings: number;
    warnings: string[];
    noticeBadge: {
        type: 'success' | 'warning' | 'error' | 'info';
        title: string;
        message: string;
        badgeClass: string;
    };
}

export interface SellerCluster {
    sellerKey: string;
    sellerName: string;
    platform: MarketplacePlatform;
    items: any[];
    totalWeight: number;
    weightLimit: number;
    remainingWeight: number;
    weightPercentage: number;
    isOverWeightLimit: boolean;
    totalItemCount: number;
    itemLimit: number;
    isOverItemLimit: boolean;
    isWithinDateWindow: boolean;
    dateSpreadDays: number;
    allPennyShipping: boolean;
    hasPennyShipping: boolean;
    canCombine: boolean;
    estSavings: number;
    warnings: string[];
}

/**
 * Formats ShopGoodwill / auction seller metadata into a clean, human-readable regional store label
 * (e.g. "Goodwill of the Columbia Willamette" + "Hillsboro", "OR" -> "Goodwill Columbia Willamette (Hillsboro, OR)").
 */
export function formatReadableSellerLabel(input: {
    sellerName?: string | null;
    sellerCompanyName?: string | null;
    pickupCity?: string | null;
    pickupState?: string | null;
    location?: string | null;
    sourcingLocation?: string | null;
    sellerId?: string | number | null;
    platform?: MarketplacePlatform;
}): string {
    const rawCompany = String(
        input.sellerCompanyName ||
        input.sellerName ||
        input.location ||
        ''
    ).trim();

    // Ignore generic placeholder strings like "ShopGoodwill" or "Seller #123" when richer info exists
    const isGenericLabel =
        !rawCompany ||
        /^seller\s*#?\d+$/i.test(rawCompany) ||
        /^shopgoodwill(?:\.com)?$/i.test(rawCompany);

    const city = String(input.pickupCity || '').trim();
    const state = String(input.pickupState || '').trim();
    const cityState = city && state ? `${city}, ${state}` : city || state;

    if (!isGenericLabel) {
        const shortened = rawCompany
            .replace(/^Goodwill\s+Industries\s+of\s+(?:the\s+)?/i, 'Goodwill ')
            .replace(/^Goodwill\s+of\s+(?:the\s+)?/i, 'Goodwill ')
            .replace(/,\s*Inc\.?$/i, '')
            .trim();
        if (cityState && !shortened.toLowerCase().includes(city.toLowerCase() || '__none__')) {
            return `${shortened} (${cityState})`;
        }
        return shortened;
    }

    if (cityState) {
        return `Goodwill — ${cityState}`;
    }

    const srcLoc = String(input.sourcingLocation || '').trim();
    if (srcLoc && !/^shopgoodwill(?:\.com)?$/i.test(srcLoc) && !/^https?:/i.test(srcLoc)) {
        return srcLoc;
    }

    if (input.sellerId) {
        const platPrefix = input.platform === 'shopgoodwill' || !input.platform ? 'Goodwill Store' : 'Seller';
        return `${platPrefix} #${input.sellerId}`;
    }

    return 'Regional Goodwill Store';
}

/**
 * Detect platform from item URL, normalized sourcing envelope, or explicit source metadata.
 * NEVER defaults camera `/scout` or non-SGW listings to `'shopgoodwill'`.
 */
export function detectPlatform(item: any): MarketplacePlatform {
    const url = String(item?.source_url || item?.url || item?.listing_url || item?.sourcing?.sourceUrl || '').toLowerCase();
    if (url.includes('shopgoodwill.com')) return 'shopgoodwill';
    if (url.includes('ctbids.com')) return 'ctbids';
    if (url.includes('hibid.com')) return 'hibid';
    if (url.includes('ebay.')) return 'ebay';

    const domainKey = resolveSourcingDomain({
        domainKey: item?.domainKey || item?.sourcing?.domainKey,
        url,
        sourcingLocation: item?.sourcingLocation,
        platformId: item?.source || item?.platform,
        rawAnalysis: item?.rawAnalysis,
    });
    if (domainKey === 'shopgoodwill') return 'shopgoodwill';
    if (domainKey === 'ebay') return 'ebay';

    const source = String(item?.sourcingLocation || item?.source || item?.platform || '').toLowerCase();
    if (source.includes('shopgoodwill') || source === 'sgw') return 'shopgoodwill';
    if (source.includes('ctbids') || source.includes('caring transitions')) return 'ctbids';
    if (source.includes('hibid')) return 'hibid';
    if (source.includes('ebay')) return 'ebay';

    return 'generic';
}

/**
 * Check if an item has 1-cent shipping
 */
export function isPennyShippingItem(item: any): boolean {
    if (!item) return false;
    const shipping = item.shipping_info?.shipping !== undefined 
        ? Number(item.shipping_info.shipping) 
        : (item.scrapedShipping?.shipping !== undefined ? Number(item.scrapedShipping.shipping) : null);
    if (shipping !== null && !isNaN(shipping) && shipping <= 0.01) {
        return true;
    }
    const notes = (item.condition_notes || item.rawAnalysis || '').toLowerCase();
    return notes.includes('1 cent shipping') || notes.includes('penny shipping') || notes.includes('$0.01 shipping');
}

/**
 * Extract weight in lbs from item
 */
export function getItemWeight(item: any): number {
    if (!item) return 1.0;
    const w = Number(item.shippingWeight || item.seller_info?.shipping_weight || item.shipping_info?.weight || item.scrapedShipping?.weight);
    return (!isNaN(w) && w > 0) ? Math.round(w * 10) / 10 : 1.0;
}

/**
 * Check if item is Buy It Now vs Auction
 */
export function isBuyNowItem(item: any): boolean {
    if (!item) return false;
    if (item.isBuyNow === true || item.format === 'buy_now') return true;
    if (item.purchase_strategy?.format === 'FIXED_PRICE' || item.purchase_strategy?.format === 'BUY_IT_NOW') return true;
    const title = (item.title || item.identity || '').toLowerCase();
    return title.includes('buy it now') || title.includes('[buy now]');
}

function resolveItemDomainKey(item: any): SourcingDomainKey {
    return resolveSourcingDomain({
        domainKey: item?.domainKey || item?.sourcing?.domainKey,
        url: item?.source_url || item?.url || item?.listing_url || item?.sourcing?.sourceUrl,
        sourcingLocation: item?.sourcingLocation,
        platformId: item?.source || item?.platform,
        rawAnalysis: item?.rawAnalysis,
    });
}

/**
 * Pure evaluator for a scouted candidate item against existing tracker items.
 * Scoped strictly by `SourcingDomainKey` and `allowsCombinedShipping` so global `/scout`
 * and non-combinable domains never inherit ShopGoodwill 20-lb shipping synergy.
 */
export function evaluateCombinedShipping(
    candidateItem: any,
    existingTrackerItems: any[],
    domainProfilesOverride?: Partial<Record<SourcingDomainKey, Partial<SourcingDomainProfile>>> | null
): SynergyEvaluationResult | null {
    if (!candidateItem) return null;

    const candidateDomain = resolveItemDomainKey(candidateItem);
    const domainProfile = getDomainProfile(candidateDomain, domainProfilesOverride);
    if (!domainProfile.allowsCombinedShipping) return null;

    const sellerId = candidateItem.sellerId || candidateItem.seller_info?.seller_id;
    const rawSellerName = candidateItem.sellerName || candidateItem.seller_info?.seller_name || '';
    const sellerName = isPlaceholderSellerName(rawSellerName) ? '' : String(rawSellerName).trim();
    if (!sellerId && !sellerName) return null;

    // Filter items in active tracker sharing BOTH the exact same domainKey AND the same real seller
    const matches = (existingTrackerItems || []).filter(item => {
        if (!item) return false;
        if (resolveItemDomainKey(item) !== candidateDomain) return false;
        if (sellerId && item.sellerId && String(item.sellerId) === String(sellerId)) return true;
        const itemSeller = isPlaceholderSellerName(item.sellerName) ? '' : String(item.sellerName || '').trim();
        if (sellerName && itemSeller && itemSeller.toLowerCase() === sellerName.toLowerCase()) return true;
        return false;
    });

    if (matches.length === 0) return null;

    const platform = detectPlatform(candidateItem);
    const basePolicy = MARKETPLACE_POLICIES[platform] || MARKETPLACE_POLICIES.generic;
    const policy: MarketplaceShippingPolicy = {
        ...basePolicy,
        allowsCombinedShipping: domainProfile.allowsCombinedShipping,
        maxWeightLbs: domainProfile.maxWeightLbs || basePolicy.maxWeightLbs || 20.0,
        maxItemCount: domainProfile.maxItemCount || basePolicy.maxItemCount || 20,
        combineWindowDays: domainProfile.combineWindowDays || basePolicy.combineWindowDays || 7,
        baseCarrierSavingsPerItem:
            basePolicy.baseCarrierSavingsPerItem > 0
                ? basePolicy.baseCarrierSavingsPerItem
                : (candidateDomain === 'shopgoodwill' ? 12.0 : 6.0),
    };

    // 1. Weight Evaluation
    const candidateWeight = getItemWeight(candidateItem);
    const existingWeight = Math.round(matches.reduce((sum, i) => sum + getItemWeight(i), 0) * 10) / 10;
    const totalWeight = Math.round((existingWeight + candidateWeight) * 10) / 10;
    const weightLimit = policy.maxWeightLbs || 20.0;
    const remainingWeight = Math.max(0, Math.round((weightLimit - totalWeight) * 10) / 10);
    const weightPercentage = Math.min(100, Math.round((totalWeight / weightLimit) * 100));
    const isOverWeightLimit = totalWeight > weightLimit;

    // 2. Item Count Evaluation
    const totalItemCount = matches.length + 1;
    const itemLimit = policy.maxItemCount || 20;
    const isOverItemLimit = totalItemCount > itemLimit;

    // 3. Date Window Evaluation
    const allEndTimes: number[] = [];
    const candidateEndTime = candidateItem.auctionEndsAt || candidateItem.auction_meta?.end_time;
    if (candidateEndTime) {
        const t = new Date(candidateEndTime).getTime();
        if (!isNaN(t)) allEndTimes.push(t);
    }
    for (const m of matches) {
        const mEndTime = m.auctionEndsAt || m.auction_meta?.end_time;
        if (mEndTime) {
            const t = new Date(mEndTime).getTime();
            if (!isNaN(t)) allEndTimes.push(t);
        }
    }

    let isWithinDateWindow = true;
    let dateSpreadDays = 0;
    let earliestDate: string | undefined;
    let latestDate: string | undefined;

    if (allEndTimes.length >= 2 && policy.combineWindowDays) {
        const minTime = Math.min(...allEndTimes);
        const maxTime = Math.max(...allEndTimes);
        dateSpreadDays = Math.ceil((maxTime - minTime) / (1000 * 60 * 60 * 24));
        earliestDate = new Date(minTime).toLocaleDateString();
        latestDate = new Date(maxTime).toLocaleDateString();
        if (dateSpreadDays > policy.combineWindowDays) {
            isWithinDateWindow = false;
        }
    }

    // 4. Format Conflict Evaluation (Buy It Now vs Auction)
    const candidateIsBuyNow = isBuyNowItem(candidateItem);
    const hasBuyNowInMatches = matches.some(isBuyNowItem);
    const hasAuctionInMatches = matches.some(m => !isBuyNowItem(m));
    let isFormatConflict = false;

    if (!policy.allowsAuctionWithBuyNow) {
        if (candidateIsBuyNow && hasAuctionInMatches) {
            isFormatConflict = true;
        } else if (!candidateIsBuyNow && hasBuyNowInMatches) {
            isFormatConflict = true;
        }
    }

    // 5. Penny (1-Cent) Shipping Evaluation
    const isCandidatePenny = policy.supportsPennyShipping && isPennyShippingItem(candidateItem);
    const existingPennyCount = policy.supportsPennyShipping ? matches.filter(isPennyShippingItem).length : 0;
    const allPennyShipping = isCandidatePenny && existingPennyCount === matches.length;
    const hasPennyShippingItem = isCandidatePenny || existingPennyCount > 0;

    let pennyNotice: string | undefined;
    if (isCandidatePenny && !allPennyShipping) {
        pennyNotice = "1¢ Shipping Note: Combining this with standard-shipping items will void the 1¢ rate and bill normal carrier freight ($15+).";
    } else if (allPennyShipping) {
        pennyNotice = "Penny Bundle: All combined items qualify for 1¢ base freight! (Individual handling fees still apply).";
    }

    // 6. Seller Ineligibility Flag
    const candidateCannotCombine = candidateItem.canCombineShipping === false || candidateItem.seller_info?.can_combine_shipping === false;
    const matchCannotCombine = matches.some(m => m.canCombineShipping === false);
    const isSellerCombinable = !candidateCannotCombine && !matchCannotCombine;

    // 7. Overall Eligibility & Savings
    const isEligible = isSellerCombinable && !isOverWeightLimit && !isOverItemLimit && isWithinDateWindow && !isFormatConflict;
    const estimatedSavings = isEligible && !allPennyShipping 
        ? matches.length * policy.baseCarrierSavingsPerItem 
        : 0;

    // 8. Warning Generation (Policy-Driven — zero hardcoded Goodwill labels on other domains)
    const warnings: string[] = [];
    if (!isSellerCombinable) {
        warnings.push("Seller marked listing as non-combinable (fragile/oversized). Must ship in its own box.");
    }
    if (isOverWeightLimit) {
        warnings.push(`Combined weight (${totalWeight} lbs) exceeds ${policy.displayName}'s ${weightLimit}-lb box limit and will split into separate shipments.`);
    }
    if (isOverItemLimit) {
        warnings.push(`Combined order has ${totalItemCount} items, exceeding ${policy.displayName}'s ${itemLimit}-item maximum.`);
    }
    if (!isWithinDateWindow) {
        warnings.push(`Listings close ${dateSpreadDays} days apart, exceeding ${policy.displayName}'s ${policy.combineWindowDays}-day combine window (${earliestDate} - ${latestDate}).`);
    }
    if (isFormatConflict) {
        warnings.push(`${policy.displayName} does not permit combining 'Buy It Now' (fixed-price) listings with auction items.`);
    }
    if (pennyNotice) {
        warnings.push(pennyNotice);
    }

    // 9. Structured Notification Badge for UI
    let noticeBadge: SynergyEvaluationResult['noticeBadge'];
    if (!isEligible) {
        noticeBadge = {
            type: 'error',
            title: isOverWeightLimit ? `${weightLimit}-lb Weight Cap Exceeded!` : (isOverItemLimit ? `${itemLimit}-Item Limit Exceeded!` : 'Ineligible for Combined Shipping'),
            message: warnings[0] || 'Items cannot be combined under platform rules.',
            badgeClass: 'badge-error text-error-content'
        };
    } else if (allPennyShipping) {
        noticeBadge = {
            type: 'success',
            title: '1¢ Penny Bundle Synergy!',
            message: `All items qualify for 1¢ base freight from ${sellerName || policy.displayName}!`,
            badgeClass: 'badge-accent text-accent-content'
        };
    } else {
        noticeBadge = {
            type: 'success',
            title: 'Combined Shipping Match!',
            message: `Estimated base shipping savings: ~$${estimatedSavings.toFixed(2)} from ${sellerName || policy.displayName}.`,
            badgeClass: 'badge-success text-success-content'
        };
    }

    return {
        platform,
        policy,
        sellerId: sellerId ?? null,
        sellerName: sellerName || matches[0]?.sellerName || `${policy.displayName} Seller`,
        matchingCount: matches.length,
        isEligible,
        isSellerCombinable,
        candidateWeight,
        existingWeight,
        totalWeight,
        weightLimit,
        remainingWeight,
        weightPercentage,
        isOverWeightLimit,
        totalItemCount,
        itemLimit,
        isOverItemLimit,
        isWithinDateWindow,
        dateSpreadDays,
        combineWindowDays: policy.combineWindowDays || 7,
        earliestDate,
        latestDate,
        isFormatConflict,
        isCandidatePenny,
        allPennyShipping,
        hasPennyShippingItem,
        pennyNotice,
        estimatedSavings,
        warnings,
        noticeBadge
    };
}

/**
 * Cluster evaluator for Buy Tracker Tray manifest (scoped per combinable SourcingDomainKey)
 */
export function evaluateSellerClusters(
    items: any[],
    domainProfilesOverride?: Partial<Record<SourcingDomainKey, Partial<SourcingDomainProfile>>> | null
): SellerCluster[] {
    const map = new Map<string, { domainKey: SourcingDomainKey; domainProfile: SourcingDomainProfile; items: any[] }>();
    for (const item of items || []) {
        if (!item) continue;
        const domainKey = resolveItemDomainKey(item);
        const domainProfile = getDomainProfile(domainKey, domainProfilesOverride);
        if (!domainProfile.allowsCombinedShipping) continue;

        const cleanSeller = isPlaceholderSellerName(item.sellerName) ? '' : String(item.sellerName || '').trim().toLowerCase();
        const rawSellerKey = item.sellerId ? String(item.sellerId) : (cleanSeller || null);
        if (!rawSellerKey) continue;

        const compositeKey = `${domainKey}::${rawSellerKey}`;
        if (!map.has(compositeKey)) {
            map.set(compositeKey, { domainKey, domainProfile, items: [] });
        }
        map.get(compositeKey)!.items.push(item);
    }

    const clusters: SellerCluster[] = [];
    for (const [key, entry] of map.entries()) {
        const { domainKey, domainProfile, items: clusterItems } = entry;
        const platform = detectPlatform(clusterItems[0]);
        const basePolicy = MARKETPLACE_POLICIES[platform] || MARKETPLACE_POLICIES.generic;
        const policy: MarketplaceShippingPolicy = {
            ...basePolicy,
            allowsCombinedShipping: domainProfile.allowsCombinedShipping,
            maxWeightLbs: domainProfile.maxWeightLbs || basePolicy.maxWeightLbs || 20.0,
            maxItemCount: domainProfile.maxItemCount || basePolicy.maxItemCount || 20,
            combineWindowDays: domainProfile.combineWindowDays || basePolicy.combineWindowDays || 7,
            baseCarrierSavingsPerItem:
                basePolicy.baseCarrierSavingsPerItem > 0
                    ? basePolicy.baseCarrierSavingsPerItem
                    : (domainKey === 'shopgoodwill' ? 12.0 : 6.0),
        };
        const namedItem = clusterItems.find(
            (i) => i.sellerName && !isPlaceholderSellerName(i.sellerName) && !/^seller\s*#?\d+$/i.test(String(i.sellerName).trim())
        );
        const displayName = formatReadableSellerLabel({
            sellerName: namedItem?.sellerName || clusterItems[0].sellerName,
            sourcingLocation: clusterItems[0].sourcingLocation,
            sellerId: clusterItems[0].sellerId || key.split('::')[1],
            platform,
        });
        
        const totalWeight = Math.round(clusterItems.reduce((sum, i) => sum + getItemWeight(i), 0) * 10) / 10;
        const weightLimit = policy.maxWeightLbs || 20.0;
        const remainingWeight = Math.max(0, Math.round((weightLimit - totalWeight) * 10) / 10);
        const weightPercentage = Math.min(100, Math.round((totalWeight / weightLimit) * 100));
        const isOverWeightLimit = totalWeight > weightLimit;

        const totalItemCount = clusterItems.length;
        const itemLimit = policy.maxItemCount || 20;
        const isOverItemLimit = totalItemCount > itemLimit;

        // Date spread
        const endTimes = clusterItems
            .map(i => i.auctionEndsAt ? new Date(i.auctionEndsAt).getTime() : NaN)
            .filter(t => !isNaN(t));
        let dateSpreadDays = 0;
        let isWithinDateWindow = true;
        if (endTimes.length >= 2 && policy.combineWindowDays) {
            dateSpreadDays = Math.ceil((Math.max(...endTimes) - Math.min(...endTimes)) / (1000 * 60 * 60 * 24));
            if (dateSpreadDays > policy.combineWindowDays) {
                isWithinDateWindow = false;
            }
        }

        const pennyCount = policy.supportsPennyShipping ? clusterItems.filter(isPennyShippingItem).length : 0;
        const allPennyShipping = pennyCount === clusterItems.length && pennyCount > 0;
        const hasPennyShipping = pennyCount > 0;
        const canCombine = !clusterItems.some(i => i.canCombineShipping === false) && !isOverWeightLimit && !isOverItemLimit && isWithinDateWindow;
        const estSavings = canCombine && !allPennyShipping ? Math.max(0, (totalItemCount - 1) * policy.baseCarrierSavingsPerItem) : 0;

        const warnings: string[] = [];
        if (isOverWeightLimit) {
            warnings.push(`Weight (${totalWeight} lbs) exceeds ${policy.displayName}'s ${weightLimit}-lb limit and will split into 2 shipments!`);
        }
        if (isOverItemLimit) {
            warnings.push(`Item count (${totalItemCount}) exceeds ${itemLimit}-item cap.`);
        }
        if (!isWithinDateWindow) {
            warnings.push(`Listings close ${dateSpreadDays} days apart (> ${policy.combineWindowDays} days).`);
        }
        if (hasPennyShipping && !allPennyShipping) {
            warnings.push("Contains both 1¢ and regular items — 1¢ rate will be voided for standard freight.");
        }

        clusters.push({
            sellerKey: key,
            sellerName: displayName,
            platform,
            items: clusterItems,
            totalWeight,
            weightLimit,
            remainingWeight,
            weightPercentage,
            isOverWeightLimit,
            totalItemCount,
            itemLimit,
            isOverItemLimit,
            isWithinDateWindow,
            dateSpreadDays,
            allPennyShipping,
            hasPennyShipping,
            canCombine,
            estSavings,
            warnings
        });
    }

    // Sort multi-item bundles and overweight/warning boxes first
    return clusters.sort((a, b) => {
        if (b.totalItemCount !== a.totalItemCount) return b.totalItemCount - a.totalItemCount;
        if (a.isOverWeightLimit !== b.isOverWeightLimit) return a.isOverWeightLimit ? -1 : 1;
        return b.totalWeight - a.totalWeight;
    });
}

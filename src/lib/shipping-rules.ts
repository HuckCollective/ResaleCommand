/**
 * Marketplace Shipping Rules & Combined Shipping Synergy Engine
 * 
 * Centralized, declarative rules for ShopGoodwill, CTBids, HiBid, and eBay.
 * Decouples platform constraints (20-lb caps, 7-day windows, 20-item limits, 1-cent shipping)
 * from Vue components to maintain clean architecture.
 */

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
        allowsCombinedShipping: true,
        maxWeightLbs: 70.0,
        maxItemCount: 40,
        combineWindowDays: 30,
        allowsAuctionWithBuyNow: true,
        requiresSameCarrier: true,
        supportsPennyShipping: false,
        baseCarrierSavingsPerItem: 6.00,
        defaultBuyerPremiumPercent: 0
    },
    generic: {
        platform: 'generic',
        displayName: 'General Marketplace',
        allowsCombinedShipping: true,
        maxWeightLbs: 50.0,
        maxItemCount: 50,
        combineWindowDays: 14,
        allowsAuctionWithBuyNow: true,
        requiresSameCarrier: false,
        supportsPennyShipping: false,
        baseCarrierSavingsPerItem: 8.00,
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
 * Detect platform from item URL, seller info, or raw data
 */
export function detectPlatform(item: any): MarketplacePlatform {
    const url = (item?.source_url || item?.url || item?.listing_url || '').toLowerCase();
    if (url.includes('shopgoodwill.com')) return 'shopgoodwill';
    if (url.includes('ctbids.com')) return 'ctbids';
    if (url.includes('hibid.com')) return 'hibid';
    if (url.includes('ebay.com')) return 'ebay';

    const source = (item?.sourcingLocation || item?.source || item?.platform || '').toLowerCase();
    if (source.includes('goodwill') || source.includes('sgw')) return 'shopgoodwill';
    if (source.includes('ctbids') || source.includes('caring transitions')) return 'ctbids';
    if (source.includes('hibid')) return 'hibid';
    if (source.includes('ebay')) return 'ebay';

    return 'shopgoodwill'; // Default to shopgoodwill when seller info exists
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

/**
 * Pure evaluator for a scouted candidate item against existing tracker items
 */
export function evaluateCombinedShipping(candidateItem: any, existingTrackerItems: any[]): SynergyEvaluationResult | null {
    if (!candidateItem) return null;

    const sellerId = candidateItem.sellerId || candidateItem.seller_info?.seller_id;
    const sellerName = candidateItem.sellerName || candidateItem.seller_info?.seller_name;
    if (!sellerId && !sellerName) return null;

    // Filter items in active tracker sharing the same seller
    const matches = (existingTrackerItems || []).filter(item => {
        if (!item) return false;
        if (sellerId && item.sellerId && String(item.sellerId) === String(sellerId)) return true;
        if (sellerName && item.sellerName && item.sellerName.trim().toLowerCase() === sellerName.trim().toLowerCase()) return true;
        return false;
    });

    if (matches.length === 0) return null;

    const platform = detectPlatform(candidateItem);
    const policy = MARKETPLACE_POLICIES[platform] || MARKETPLACE_POLICIES.shopgoodwill;

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

    // 3. 7-Day Date Window Evaluation
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
    const isCandidatePenny = isPennyShippingItem(candidateItem);
    const existingPennyCount = matches.filter(isPennyShippingItem).length;
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

    // 8. Warning Generation
    const warnings: string[] = [];
    if (!isSellerCombinable) {
        warnings.push("Seller marked listing as non-combinable (fragile/oversized). Must ship in its own box.");
    }
    if (isOverWeightLimit) {
        warnings.push(`Combined weight (${totalWeight} lbs) exceeds the ${weightLimit}-lb limit. Goodwill will split this order into two separate shipments and charge a second base shipping fee ($15+).`);
    }
    if (isOverItemLimit) {
        warnings.push(`Combined order has ${totalItemCount} items, exceeding the ${itemLimit}-item maximum. Extra items will be split into a separate shipment.`);
    }
    if (!isWithinDateWindow) {
        warnings.push(`Auctions close ${dateSpreadDays} days apart, exceeding ShopGoodwill's ${policy.combineWindowDays}-day closing window (${earliestDate} - ${latestDate}).`);
    }
    if (isFormatConflict) {
        warnings.push("ShopGoodwill does not permit combining 'Buy It Now' (fixed-price) listings with auction items.");
    }
    if (pennyNotice) {
        warnings.push(pennyNotice);
    }

    // 9. Structured Notification Badge for UI
    let noticeBadge: SynergyEvaluationResult['noticeBadge'];
    if (!isEligible) {
        noticeBadge = {
            type: 'error',
            title: isOverWeightLimit ? '20-lb Weight Cap Exceeded!' : (isOverItemLimit ? '20-Item Limit Exceeded!' : 'Ineligible for Combined Shipping'),
            message: warnings[0] || 'Items cannot be combined under platform rules.',
            badgeClass: 'badge-error text-error-content'
        };
    } else if (allPennyShipping) {
        noticeBadge = {
            type: 'success',
            title: '1¢ Penny Bundle Synergy!',
            message: `All items qualify for 1¢ base freight from ${sellerName}!`,
            badgeClass: 'badge-accent text-accent-content'
        };
    } else {
        noticeBadge = {
            type: 'success',
            title: 'Combined Shipping Match!',
            message: `Estimated base shipping savings: ~$${estimatedSavings.toFixed(2)} from ${sellerName}.`,
            badgeClass: 'badge-success text-success-content'
        };
    }

    return {
        platform,
        policy,
        sellerId: sellerId ?? null,
        sellerName: sellerName || matches[0]?.sellerName || 'Regional Goodwill Seller',
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
 * Cluster evaluator for Buy Tracker Tray manifest
 */
export function evaluateSellerClusters(items: any[]): SellerCluster[] {
    const map = new Map<string, any[]>();
    for (const item of items || []) {
        if (!item) continue;
        const key = item.sellerId ? String(item.sellerId) : (item.sellerName ? item.sellerName.trim().toLowerCase() : null);
        if (key) {
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(item);
        }
    }

    const clusters: SellerCluster[] = [];
    for (const [key, clusterItems] of map.entries()) {
        const platform = detectPlatform(clusterItems[0]);
        const policy = MARKETPLACE_POLICIES[platform] || MARKETPLACE_POLICIES.shopgoodwill;
        const displayName = clusterItems[0].sellerName || `Seller #${key}`;
        
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

        const pennyCount = clusterItems.filter(isPennyShippingItem).length;
        const allPennyShipping = pennyCount === clusterItems.length && pennyCount > 0;
        const hasPennyShipping = pennyCount > 0;
        const canCombine = !clusterItems.some(i => i.canCombineShipping === false) && !isOverWeightLimit && !isOverItemLimit && isWithinDateWindow;
        const estSavings = canCombine && !allPennyShipping ? Math.max(0, (totalItemCount - 1) * policy.baseCarrierSavingsPerItem) : 0;

        const warnings: string[] = [];
        if (isOverWeightLimit) {
            warnings.push(`Weight (${totalWeight} lbs) exceeds 20-lb limit. Goodwill will split into 2 shipments!`);
        }
        if (isOverItemLimit) {
            warnings.push(`Item count (${totalItemCount}) exceeds 20-item cap.`);
        }
        if (!isWithinDateWindow) {
            warnings.push(`Auctions close ${dateSpreadDays} days apart (> 7 days).`);
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

    return clusters;
}

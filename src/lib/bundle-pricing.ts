/**
 * Resale Command - Centralized Bundle & Component Pricing Utility
 * 
 * Provides unified, deterministic valuation, markup thresholds, and cost basis
 * calculations across the Deep Search AI pipeline, Scout Scanner, and Inventory Drawer.
 */

export interface PriceRange {
    low: number;
    high: number;
}

/**
 * Robustly parses strings ("$8 - $15", "$12.50", "[8, 15]"), arrays, and objects
 * into a numerical low/high range. Never throws.
 */
export function parsePriceRange(val: any): PriceRange {
    if (!val && val !== 0) return { low: 0, high: 0 };

    if (typeof val === 'number') {
        return { low: val, high: val };
    }

    if (Array.isArray(val)) {
        const l = parseFloat(String(val[0])) || 0;
        const h = parseFloat(String(val[1])) || l;
        return { low: l, high: h >= l ? h : l };
    }

    if (typeof val === 'object') {
        if (val.min !== undefined && val.max !== undefined) {
            const l = parseFloat(String(val.min)) || 0;
            const h = parseFloat(String(val.max)) || l;
            return { low: l, high: h >= l ? h : l };
        }
        if (val.low !== undefined && val.high !== undefined) {
            const l = parseFloat(String(val.low)) || 0;
            const h = parseFloat(String(val.high)) || l;
            return { low: l, high: h >= l ? h : l };
        }
        if (val.formatted) {
            return parsePriceRange(val.formatted);
        }
    }

    const str = String(val).replace(/[$,]/g, '').trim();

    // Match range like "8 - 15" or "8 to 15"
    const rangeMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:[-–—−to]+)\s*(\d+(?:\.\d+)?)/i);
    if (rangeMatch) {
        const l = parseFloat(rangeMatch[1]) || 0;
        const h = parseFloat(rangeMatch[2]) || l;
        return { low: l, high: h >= l ? h : l };
    }

    // Match single number like "12.50"
    const singleMatch = str.match(/(\d+(?:\.\d+)?)/);
    if (singleMatch) {
        const n = parseFloat(singleMatch[1]) || 0;
        return { low: n, high: n };
    }

    return { low: 0, high: 0 };
}

/**
 * Formats a low/high range into clean "$X - $Y" or "$X".
 */
export function formatPriceRange(val: any): string {
    const { low, high } = parsePriceRange(val);
    if (low === 0 && high === 0) return '-';
    if (low === high) return `$${low % 1 === 0 ? low : low.toFixed(2)}`;
    return `$${low % 1 === 0 ? low : low.toFixed(2)} - $${high % 1 === 0 ? high : high.toFixed(2)}`;
}

/**
 * Higher Boutique Range:
 * Curated physical retail / antique mall booth pricing tier (e.g. Memory Den / DustyTiger).
 * Defaults to +35% to +50% above fair market comps if not explicitly provided.
 */
export function getSubItemBoutique(subItem: any): string {
    if (!subItem) return '-';
    const explicit = subItem.pricing_potential?.boutique || subItem.price_breakdown?.boutique_premium || subItem.boutique;
    if (explicit) {
        const formatted = formatPriceRange(explicit);
        if (formatted !== '-') return formatted;
    }

    // Derive markup from fair range
    const fair = parsePriceRange(subItem.pricing_potential?.fair || subItem.price_breakdown?.fair || subItem.estimated_value);
    if (fair.low > 0 || fair.high > 0) {
        const bLow = Math.max(fair.low + 2, Math.round(fair.low * 1.35));
        const bHigh = Math.max(fair.high + 5, Math.round(fair.high * 1.50));
        return formatPriceRange({ low: bLow, high: bHigh });
    }

    return '-';
}

/**
 * Fair Range:
 * Realistic online secondary / eBay comp range.
 */
export function getSubItemFair(subItem: any): string {
    if (!subItem) return '-';
    const fairVal = subItem.pricing_potential?.fair || subItem.price_breakdown?.fair || subItem.estimated_value;
    return formatPriceRange(fairVal);
}

/**
 * Min-Max Buy Range:
 * Conservative minimum purchase target to maximum profitable buy threshold (25% to 40% of fair comps).
 * Guaranteed to never return "$0" when resale value is present.
 */
export function getSubItemBuyRange(subItem: any): string {
    if (!subItem) return '-';

    // 1. Check explicit buy_range object or string
    if (subItem.buy_range) {
        if (typeof subItem.buy_range === 'string' && subItem.buy_range.trim() !== '$0' && subItem.buy_range.trim() !== '$0 - $0') {
            return subItem.buy_range;
        }
        if (subItem.buy_range.formatted && subItem.buy_range.formatted !== '$0' && subItem.buy_range.formatted !== '$0 - $0') {
            return subItem.buy_range.formatted;
        }
        if (typeof subItem.buy_range.min === 'number' && typeof subItem.buy_range.max === 'number' && subItem.buy_range.max > 0) {
            return `$${subItem.buy_range.min} - $${subItem.buy_range.max}`;
        }
    }

    // 2. Derive buy threshold from fair comps:
    // Conservative low: 25% of fair low (min $1 if item has value)
    // Aggressive max: 40% of fair high
    const fair = parsePriceRange(subItem.pricing_potential?.fair || subItem.price_breakdown?.fair || subItem.estimated_value);
    if (fair.low > 0 || fair.high > 0) {
        const buyMin = Math.max(1, Math.floor(fair.low * 0.25));
        const buyMax = Math.max(buyMin, Math.round(fair.high * 0.40));
        return `$${buyMin} - $${buyMax}`;
    }

    return '-';
}

/**
 * Split Cost Basis:
 * Shows the individual acquisition cost of that specific component (Total Cost ÷ Lot Count).
 * Always returns a valid string (e.g. "$6.67", or "$0.00" if cost is unassigned). Never disappears.
 */
export function getSubItemCostBasis(subItem: any, totalCount: number, totalCost?: number | string | null): string {
    const count = Math.max(1, totalCount || 1);

    // 1. If explicit total cost is passed from form or lot parent
    let costNum = 0;
    if (totalCost !== undefined && totalCost !== null) {
        costNum = typeof totalCost === 'number' ? totalCost : parseFloat(String(totalCost).replace(/[$,]/g, '')) || 0;
    }

    // 2. Check if subItem already has an explicit split_cost_basis
    if (costNum <= 0 && subItem?.split_cost_basis !== undefined && subItem?.split_cost_basis !== null) {
        const subCost = parseFloat(String(subItem.split_cost_basis)) || 0;
        if (subCost > 0) {
            return `$${subCost.toFixed(2)}`;
        }
    }

    if (costNum > 0) {
        const perItem = (costNum / count).toFixed(2);
        return `$${perItem}`;
    }

    return '$0.00';
}

/**
 * Calculates max buy for single item or subItem using 40% rule.
 * Handles string ranges, objects, or numbers cleanly without evaluating to 0.
 */
export function calculateMaxBuyPrice(itemOrVal: any): number {
    if (!itemOrVal) return 0;

    if (itemOrVal?.purchase_strategy?.max_landed_cost) {
        return Math.floor(itemOrVal.purchase_strategy.max_landed_cost);
    }

    const fairObj = parsePriceRange(
        itemOrVal?.pricing_potential?.fair ||
        itemOrVal?.price_breakdown?.fair ||
        itemOrVal?.estimated_value ||
        itemOrVal
    );

    const mid = fairObj.high > 0 ? (fairObj.low + fairObj.high) / 2 : fairObj.low;
    return mid > 0 ? Math.max(1, Math.floor(mid * 0.40)) : 0;
}

/**
 * Calculates max bid for auction sub-item taking shipping into account.
 */
export function calculateSubItemMaxBidPrice(subItem: any, parentItem?: any): number {
    const maxBuy = calculateMaxBuyPrice(subItem);
    const shippingTotal = parentItem?.shipping_info?.total || 0;
    const itemsCount = parentItem?.lot_items?.length || 1;
    const shippingPerItem = shippingTotal / itemsCount;
    const maxBid = maxBuy - shippingPerItem;
    return maxBid > 0 ? Math.floor(maxBid) : maxBuy;
}

/**
 * Server-Side Normalizer:
 * Takes raw AI `lot_items` array and guarantees that every component has
 * complete, consistent pricing fields (Boutique, Fair, Buy Range, Split Cost Basis)
 * before the response is returned to the client.
 */
export function normalizeBundleComponents(lotItems: any[], totalCost?: number | string | null): any[] {
    if (!Array.isArray(lotItems) || lotItems.length === 0) return [];

    const count = lotItems.length;
    let costNum = 0;
    if (totalCost !== undefined && totalCost !== null) {
        costNum = typeof totalCost === 'number' ? totalCost : parseFloat(String(totalCost).replace(/[$,]/g, '')) || 0;
    }
    const splitCost = count > 0 && costNum > 0 ? parseFloat((costNum / count).toFixed(2)) : 0.0;

    return lotItems.map((item, idx) => {
        if (!item || typeof item !== 'object') {
            return {
                name: `Item #${idx + 1}`,
                estimated_value: '$10 - $18',
                pricing_potential: { boutique: '$15 - $26', fair: '$10 - $18' },
                buy_range: { min: 2, max: 7, formatted: '$2 - $7' },
                price_breakdown: { fair: '$10 - $18', boutique_premium: '$15 - $26' },
                split_cost_basis: splitCost
            };
        }

        const fair = parsePriceRange(item.pricing_potential?.fair || item.price_breakdown?.fair || item.estimated_value);
        const fairLow = fair.low > 0 ? fair.low : 10;
        const fairHigh = fair.high >= fairLow ? fair.high : fairLow + 5;
        const fairStr = `$${fairLow} - $${fairHigh}`;

        // Boutique tier (+35% to +50%)
        const bParsed = parsePriceRange(item.pricing_potential?.boutique || item.price_breakdown?.boutique_premium);
        const bLow = bParsed.low > 0 ? bParsed.low : Math.max(fairLow + 2, Math.round(fairLow * 1.35));
        const bHigh = bParsed.high >= bLow ? bParsed.high : Math.max(fairHigh + 5, Math.round(fairHigh * 1.50));
        const boutiqueStr = `$${bLow} - $${bHigh}`;

        // Buy range (25% to 40%)
        let buyMin = 0, buyMax = 0;
        if (item.buy_range && typeof item.buy_range.min === 'number' && typeof item.buy_range.max === 'number' && item.buy_range.max > 0) {
            buyMin = item.buy_range.min;
            buyMax = item.buy_range.max;
        } else {
            buyMin = Math.max(1, Math.floor(fairLow * 0.25));
            buyMax = Math.max(buyMin, Math.round(fairHigh * 0.40));
        }
        const buyRangeStr = `$${buyMin} - $${buyMax}`;

        return {
            ...item,
            name: (item.name || item.title || item.identity || `Item #${idx + 1}`).trim(),
            estimated_value: item.estimated_value || fairStr,
            pricing_potential: {
                fair: fairStr,
                boutique: boutiqueStr,
                ...(item.pricing_potential || {})
            },
            price_breakdown: {
                mint: item.price_breakdown?.mint || `$${Math.round(fairHigh * 1.25)} - $${Math.round(fairHigh * 1.45)}`,
                fair: fairStr,
                poor: item.price_breakdown?.poor || `$${Math.max(1, Math.round(fairLow * 0.3))} - $${Math.round(fairLow * 0.5)}`,
                boutique_premium: boutiqueStr,
                ...(item.price_breakdown || {})
            },
            buy_range: {
                min: buyMin,
                max: buyMax,
                formatted: buyRangeStr
            },
            split_cost_basis: splitCost
        };
    });
}

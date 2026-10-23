/**
 * Resale Command - Lot Profit & Exit Playbook Engine
 * 
 * Implements the heuristics codified in .agents/skills/lot-profit-and-exit-strategy/SKILL.md:
 * 1. Anchor / Hero Singles (100% cost recovery on first sale)
 * 2. Themed Combines (Troop builders, sequels, matching sets)
 * 3. Remainder Floor & Grab Bags ($10-$15 impulse packs for booth grazing)
 * 4. Multi-Channel Routing
 */

export interface ExitStrategyHeroSingle {
    name: string;
    estPrice: string;
    numericPrice: number;
    targetChannel: string;
    reason: string;
    recoupsCost: boolean;
}

export interface ExitStrategyCombine {
    name: string;
    estPrice: string;
    numericPrice: number;
    items: string[];
    reason: string;
}

export interface ExitStrategyFloorFillers {
    name: string;
    estPrice: string;
    numericPrice: number;
    count: number;
    targetChannel: string;
}

export interface LotExitPlaybook {
    summary: string;
    projectedBulkYield: number;
    projectedSplitYield: number;
    profitIncreasePct: number;
    totalCost: number;
    heroSingles: ExitStrategyHeroSingle[];
    themedCombines: ExitStrategyCombine[];
    floorFillers: ExitStrategyFloorFillers | null;
    rawStrategy?: any;
}

/**
 * Safely parses a numeric value from strings like "$25.50", "30", etc.
 * If multiple numbers exist (e.g. a range "$40 - $60"), extracts the numbers
 * and returns the requested bound or midpoint rather than concatenating digits.
 */
export function parsePriceValue(val: any, mode: 'midpoint' | 'low' | 'high' | 'first' = 'first', fallback: number = 0): number {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'number') return isNaN(val) ? fallback : val;
    
    const str = String(val).trim();
    if (!str) return fallback;

    // Normalize comma thousands separators e.g. "$1,200.00" -> "$1200.00"
    const normalized = str.replace(/,/g, '');

    // 1. If explicit dollar amounts exist (e.g. "$45 - $60", "D&D 3.5 ($35)"), extract dollar-anchored numbers first
    // This prevents non-price numbers like editions ("3.5", "1st") or quantities ("3-pack") from polluting price math
    const dollarMatches = [...normalized.matchAll(/\$\s*(\d+(?:\.\d+)?)/g)]
        .map(m => parseFloat(m[1]))
        .filter(n => !isNaN(n));

    let numbers = dollarMatches;

    // 2. If no dollar signs found, fall back to matching discrete numbers (including decimals), preventing "$40 - $60" -> "4060"
    if (numbers.length === 0) {
        const rawMatches = normalized.match(/\d+(?:\.\d+)?/g);
        if (rawMatches && rawMatches.length > 0) {
            numbers = rawMatches.map(n => parseFloat(n)).filter(n => !isNaN(n));
        }
    }

    if (numbers.length === 0) return fallback;
    if (numbers.length === 1) return numbers[0];

    // Range handling e.g. "$40 - $60"
    if (mode === 'low') return Math.min(...numbers);
    if (mode === 'high') return Math.max(...numbers);
    if (mode === 'midpoint') {
        const sum = numbers.reduce((a, b) => a + b, 0);
        return Math.round(sum / numbers.length);
    }
    return numbers[0];
}

function parseNumeric(val: any, fallback: number = 0): number {
    return parsePriceValue(val, 'midpoint', fallback);
}

function calculateRoiPct(netProfit: number, costBasis: number): number {
    if (costBasis <= 0) return 0;
    return Math.round((netProfit / costBasis) * 100);
}

/**
 * Derives a comprehensive Exit Playbook from existing AI scout data,
 * lot components, or item metadata.
 */
export function deriveLotExitPlaybook(item: any, scoutData?: any): LotExitPlaybook | null {
    if (!item) return null;

    let totalCost = parseNumeric(item.cost ?? item.purchasePrice, 0);
    if (totalCost <= 0) {
        const currentBid = Number(item.currentBid || item.auction_meta?.current_bid || parseNumeric(item.purchase_strategy?.current_asking_price, 0));
        const shipping = Number(item.shipping_info?.total || item.auction_meta?.estimated_shipping || item.shippingPrice || 0);
        const bp = currentBid * (Number(item.auction_meta?.buyers_premium_percent || 0) / 100);
        const auctionLanded = currentBid > 0 ? Math.round((currentBid + bp + shipping) * 100) / 100 : 0;
        const asking = parseNumeric(item.purchase_strategy?.current_asking_price || item.askingPrice || item.price, 0);
        const maxLanded = parseNumeric(item.purchase_strategy?.max_buy_price || item.maxLandedCost || item.maxBid, 0);
        totalCost = auctionLanded > 0 ? auctionLanded : (asking > 0 ? Math.round((asking + shipping) * 100) / 100 : (maxLanded > 0 ? maxLanded : 0));
    }
    const bulkPrice = parseNumeric(item.resalePrice ?? item.boutiquePrice, 0);

    // If explicit exit_strategy is already in scoutData or rawAnalysis, use it
    let aiStrategy = scoutData?.exit_strategy;
    if (!aiStrategy && Array.isArray(scoutData) && scoutData[0]?.exit_strategy) {
        aiStrategy = scoutData[0].exit_strategy;
    }
    if (!aiStrategy && item.rawAnalysis) {
        try {
            const parsed = typeof item.rawAnalysis === 'string' ? JSON.parse(item.rawAnalysis) : item.rawAnalysis;
            const obj = Array.isArray(parsed) ? parsed[0] : parsed;
            if (obj?.exit_strategy) aiStrategy = obj.exit_strategy;
        } catch (e) {}
    }

    if (typeof aiStrategy === 'string') {
        try { aiStrategy = JSON.parse(aiStrategy); } catch (e) { aiStrategy = null; }
    }

    if (aiStrategy && typeof aiStrategy === 'object' && (aiStrategy.hero_singles || aiStrategy.heroSingles)) {
        const rawHeroes = Array.isArray(aiStrategy.hero_singles) 
            ? aiStrategy.hero_singles 
            : (Array.isArray(aiStrategy.heroSingles) ? aiStrategy.heroSingles : []);
        const heroes: ExitStrategyHeroSingle[] = rawHeroes.map((h: any) => {
            const num = parseNumeric(h.est_price ?? h.estPrice ?? h.numericPrice, 0);
            return {
                name: h.name || 'Hero Item',
                estPrice: h.est_price || h.estPrice || `$${num.toFixed(2)}`,
                numericPrice: num,
                targetChannel: h.target_channel || h.targetChannel || 'Online / Showcase',
                reason: h.reason || (num >= totalCost && totalCost > 0 ? 'Recoups 100% of purchase cost' : 'High margin standout'),
                recoupsCost: totalCost > 0 && num >= totalCost * 0.8
            };
        });

        const rawCombines = Array.isArray(aiStrategy.themed_combines) 
            ? aiStrategy.themed_combines 
            : (Array.isArray(aiStrategy.themedCombines) ? aiStrategy.themedCombines : []);
        const combines: ExitStrategyCombine[] = rawCombines.map((c: any) => {
            const num = parseNumeric(c.est_price ?? c.estPrice ?? c.numericPrice, 0);
            return {
                name: c.name || 'Themed Combine Lot',
                estPrice: c.est_price || c.estPrice || `$${num.toFixed(2)}`,
                numericPrice: num,
                items: Array.isArray(c.items) ? c.items : [c.name],
                reason: c.reason || 'Thematic grouping creates sweet-spot price point'
            };
        });

        let floorFillers: ExitStrategyFloorFillers | null = null;
        const rawFloor = aiStrategy.floor_fillers || aiStrategy.floorFillers;
        if (rawFloor && typeof rawFloor === 'object') {
            const num = parseNumeric(rawFloor.est_price ?? rawFloor.estPrice ?? rawFloor.numericPrice, 12);
            floorFillers = {
                name: rawFloor.name || 'Booth Grab Bag / Impulse Pack',
                estPrice: rawFloor.est_price || rawFloor.estPrice || `$${num.toFixed(2)}`,
                numericPrice: num,
                count: Math.max(1, parseNumeric(rawFloor.count, 1)),
                targetChannel: rawFloor.target_channel || rawFloor.targetChannel || 'Memory Den Booth Basket'
            };
        }

        const floorTotal = (floorFillers?.numericPrice || 0) * (floorFillers?.count && floorFillers.name?.includes('/ea') ? floorFillers.count : 1);
        const calcSplit = heroes.reduce((s, h) => s + (h.numericPrice || 0), 0) + 
                          combines.reduce((s, c) => s + (c.numericPrice || 0), 0) + 
                          floorTotal;

        // Ground financial math: if AI returned dummy sample values (180/275), calculate dynamically from real detected pieces
        const isPromptArtifact = (aiStrategy.projected_bulk_yield === 180 && aiStrategy.projected_split_yield === 275);
        const splitYield = (calcSplit > 0) ? calcSplit : parseNumeric(aiStrategy.projected_split_yield ?? aiStrategy.projectedSplitYield, 150);
        const bulkYield = (isPromptArtifact && bulkPrice > 0) 
            ? bulkPrice 
            : parseNumeric(aiStrategy.projected_bulk_yield ?? aiStrategy.projectedBulkYield ?? bulkPrice, Math.round(splitYield * 0.65));
        
        const pct = bulkYield > 0 ? Math.round(((splitYield - bulkYield) / bulkYield) * 100) : 35;

        return {
            summary: aiStrategy.summary || 'Execute tiered exit to recover cost immediately and maximize margin.',
            projectedBulkYield: bulkYield,
            projectedSplitYield: splitYield,
            profitIncreasePct: Math.max(10, pct),
            totalCost,
            heroSingles: heroes,
            themedCombines: combines,
            floorFillers,
            rawStrategy: aiStrategy
        };
    }

    // Otherwise, generate heuristic exit playbook from components or item identity
    let components: any[] = [];
    if (Array.isArray(scoutData?.lot_items)) components = scoutData.lot_items;
    else if (Array.isArray(scoutData?.items)) components = scoutData.items;
    else if (Array.isArray(scoutData)) {
        components = Array.isArray(scoutData[0]?.lot_items) 
            ? scoutData[0].lot_items 
            : (Array.isArray(scoutData[0]?.items) ? scoutData[0].items : scoutData);
    } else if (item.components) {
        if (Array.isArray(item.components)) components = item.components;
        else if (typeof item.components === 'string') {
            try { components = JSON.parse(item.components); } catch (e) {}
        }
    }

    const title = (item.title || '').trim();
    let qty = parseNumeric(item.quantity, 0);
    if (qty <= 0) {
        const qtyMatch = title.match(/^(\d+)\s+/i) || 
                         title.match(/\b(?:lot of|pack of|set of|box of)\s*(\d+)\b/i) || 
                         title.match(/\b(\d+)\s*(?:pack|pk|pcs|pieces|books|volumes|vols|items|figures)\b/i);
        if (qtyMatch) {
            qty = parseInt(qtyMatch[1], 10);
        }
    }
    if (qty <= 0) qty = 1;

    // Check if item is a lot or has keywords indicating multiple pieces
    const isLotLike = qty > 1 || 
                      components.length > 1 || 
                      /\b(lot of|collection of|set of|bundle of|box lot|bulk lot)\b/i.test(title);

    if (!isLotLike && components.length <= 1) {
        return null;
    }

    // Heuristic extraction for lot or multi-piece sets
    const heroes: ExitStrategyHeroSingle[] = [];
    const combines: ExitStrategyCombine[] = [];
    let floorFillers: ExitStrategyFloorFillers | null = null;

    if (components.length > 1) {
        // We have discrete parsed components
        const sorted = [...components].sort((a, b) => {
            const pa = parsePriceValue(a.val || a.resalePrice || a.price_breakdown?.fair, 'midpoint', 0);
            const pb = parsePriceValue(b.val || b.resalePrice || b.price_breakdown?.fair, 'midpoint', 0);
            return pb - pa;
        });

        // Top 1-2 are heroes
        const top1 = sorted[0];
        const rawP1 = top1?.val || top1?.resalePrice || top1?.price_breakdown?.fair;
        const p1 = parsePriceValue(rawP1, 'midpoint', 25);
        heroes.push({
            name: top1.name || top1.title || top1.identity || 'Showcase Anchor Item',
            estPrice: (typeof rawP1 === 'string' && rawP1.trim().startsWith('$')) ? rawP1.trim() : `$${p1.toFixed(2)}`,
            numericPrice: p1,
            targetChannel: 'Online / Showcase',
            reason: totalCost > 0 && p1 >= totalCost ? 'Recoups 100% of entire lot purchase cost' : 'High demand collector piece',
            recoupsCost: totalCost > 0 && p1 >= totalCost * 0.8
        });

        if (sorted.length > 1) {
            const top2 = sorted[1];
            const rawP2 = top2?.val || top2?.resalePrice || top2?.price_breakdown?.fair;
            const p2 = parsePriceValue(rawP2, 'midpoint', 20);
            heroes.push({
                name: top2.name || top2.title || top2.identity || 'Secondary Anchor Item',
                estPrice: (typeof rawP2 === 'string' && rawP2.trim().startsWith('$')) ? rawP2.trim() : `$${p2.toFixed(2)}`,
                numericPrice: p2,
                targetChannel: 'Booth Showcase',
                reason: 'Instant pure profit contributor',
                recoupsCost: totalCost > 0 && (p1 + p2) >= totalCost
            });
        }

        // Remaining middle pieces form a combine
        if (sorted.length > 2) {
            const midPieces = sorted.slice(2, Math.min(sorted.length, 5));
            if (midPieces.length > 0) {
                const midTotal = midPieces.reduce((sum, p) => {
                    const val = parsePriceValue(p?.val || p?.resalePrice || p?.price_breakdown?.fair, 'midpoint', 12);
                    return sum + val;
                }, 0);
                combines.push({
                    name: 'Themed Core Combine Lot',
                    estPrice: `$${midTotal.toFixed(2)}`,
                    numericPrice: midTotal,
                    items: midPieces.map(p => p.name || p.title || 'Core Item'),
                    reason: 'Grouped companion pieces hit sweet-spot ticket price'
                });
            }
        }

        // Leftovers become booth floor fillers
        if (sorted.length > 5) {
            floorFillers = {
                name: 'Impulse Floor Grab Bag / Starter Lot',
                estPrice: '$15.00',
                numericPrice: 15,
                count: sorted.length - 5,
                targetChannel: 'Memory Den Booth Basket'
            };
        }
    } else {
        // Derive proportionally from detected quantity and bulk resale value
        const targetBulk = bulkPrice > 0 ? bulkPrice : (totalCost > 0 ? Math.round(totalCost * 1.8) : 50);
        const targetSplit = Math.round(targetBulk * 1.15); // ~15% elevation by splitting
        const isBookOrMedia = /book|novel|rpg|hardcover|paperback|comic|vhs|vinyl|game/i.test(title);

        if (qty === 2) {
            const heroVal = Math.round(Math.max(totalCost * 1.05, targetSplit * 0.58));
            const companionVal = Math.max(10, targetSplit - heroVal);
            
            heroes.push({
                name: isBookOrMedia ? 'Key Volume 1 (Hero Anchor)' : 'Standout Anchor Piece',
                estPrice: `$${heroVal.toFixed(2)}`,
                numericPrice: heroVal,
                targetChannel: 'Online / Showcase',
                reason: totalCost > 0 && heroVal >= totalCost ? 'Recoups 100% cost basis on first sale' : 'High margin standout',
                recoupsCost: totalCost > 0 && heroVal >= totalCost * 0.85
            });
            combines.push({
                name: isBookOrMedia ? 'Companion Volume 2' : 'Secondary Companion Piece',
                estPrice: `$${companionVal.toFixed(2)}`,
                numericPrice: companionVal,
                items: [isBookOrMedia ? 'Volume 2' : 'Piece 2'],
                reason: 'Pure profit contributor'
            });
            floorFillers = null;
        } else if (qty === 3) {
            const heroVal = Math.round(Math.max(totalCost * 1.05, targetSplit * 0.50));
            const pairVal = Math.max(15, targetSplit - heroVal);

            heroes.push({
                name: isBookOrMedia ? 'Key Volume 1 (Hero Anchor)' : 'Standout Anchor Piece',
                estPrice: `$${heroVal.toFixed(2)}`,
                numericPrice: heroVal,
                targetChannel: 'Online / Showcase',
                reason: totalCost > 0 && heroVal >= totalCost ? 'Recoups 100% cost basis on first sale' : 'High margin standout',
                recoupsCost: totalCost > 0 && heroVal >= totalCost * 0.85
            });
            combines.push({
                name: isBookOrMedia ? 'Companion 2-Volume Pair' : 'Companion 2-Pack',
                estPrice: `$${pairVal.toFixed(2)}`,
                numericPrice: pairVal,
                items: ['Companion 1', 'Companion 2'],
                reason: 'High AOV companion pairing'
            });
            floorFillers = null;
        } else if (qty === 4) {
            const heroVal = Math.round(Math.max(totalCost * 1.05, targetSplit * 0.45));
            const combineVal = Math.round((targetSplit - heroVal) * 0.65);
            const floorVal = Math.max(8, targetSplit - heroVal - combineVal);

            heroes.push({
                name: isBookOrMedia ? 'Key Volume 1 (Hero Anchor)' : 'Standout Anchor Piece',
                estPrice: `$${heroVal.toFixed(2)}`,
                numericPrice: heroVal,
                targetChannel: 'Online / Showcase',
                reason: totalCost > 0 && heroVal >= totalCost ? 'Recoups 100% cost basis on first sale' : 'High margin standout',
                recoupsCost: totalCost > 0 && heroVal >= totalCost * 0.85
            });
            combines.push({
                name: isBookOrMedia ? 'Companion 2-Pack Set' : 'Themed Companion 2-Pack',
                estPrice: `$${combineVal.toFixed(2)}`,
                numericPrice: combineVal,
                items: ['Companion Piece A', 'Companion Piece B'],
                reason: 'Elevated basket size'
            });
            floorFillers = {
                name: isBookOrMedia ? 'Booth Grazing Single' : 'Floor Clearance Piece',
                estPrice: `$${floorVal.toFixed(2)}`,
                numericPrice: floorVal,
                count: 1,
                targetChannel: 'Memory Den Booth Basket'
            };
        } else {
            // qty >= 5
            const heroVal = Math.round(Math.max(totalCost * 1.05, targetSplit * 0.40));
            const combineVal = Math.round((targetSplit - heroVal) * 0.50);
            const floorTotal = Math.max(10, targetSplit - heroVal - combineVal);
            const floorCount = Math.max(1, qty - 3);
            const floorPerItem = Math.max(3, Math.round(floorTotal / floorCount));

            heroes.push({
                name: isBookOrMedia ? 'Key Standout Volume' : 'Standout Anchor Piece',
                estPrice: `$${heroVal.toFixed(2)}`,
                numericPrice: heroVal,
                targetChannel: 'Online / Showcase',
                reason: totalCost > 0 && heroVal >= totalCost ? 'Recoups 100% cost basis on first sale' : 'High margin standout',
                recoupsCost: totalCost > 0 && heroVal >= totalCost * 0.85
            });
            combines.push({
                name: isBookOrMedia ? 'Curated Companion 2-Pack' : 'Themed Companion 2-Pack',
                estPrice: `$${combineVal.toFixed(2)}`,
                numericPrice: combineVal,
                items: ['Companion Piece A', 'Companion Piece B'],
                reason: 'High AOV companion pairing'
            });
            floorFillers = {
                name: isBookOrMedia ? `Reader Copy Impulse Pack (${floorCount}x)` : `Booth Floor Grab Bag (${floorCount}x)`,
                estPrice: `$${(floorPerItem * floorCount).toFixed(2)}`,
                numericPrice: floorPerItem * floorCount,
                count: floorCount,
                targetChannel: 'Memory Den Booth Basket'
            };
        }
    }

    const heroSum = heroes.reduce((s, h) => s + parseNumeric(h.numericPrice, 0), 0);
    const combineSum = combines.reduce((s, c) => s + parseNumeric(c.numericPrice, 0), 0);
    const fillerSum = floorFillers ? parseNumeric(floorFillers.numericPrice, 0) : 0;
    const calculatedSum = heroSum + combineSum + fillerSum;
    const projectedSplit = calculatedSum > 0 
        ? calculatedSum 
        : (bulkPrice > 0 ? Math.round(bulkPrice * 1.35) : Math.round(Math.max(45, totalCost * 1.8)));
    const projectedBulk = bulkPrice > 0 
        ? bulkPrice 
        : Math.round(projectedSplit * 0.65);
    const pct = projectedBulk > 0 ? Math.round(((projectedSplit - projectedBulk) / projectedBulk) * 100) : 35;

    return {
        summary: `Recover entire cost with ${heroes.length} hero single(s), bundle matching sets, and clear remainders with booth impulse bags.`,
        projectedBulkYield: projectedBulk,
        projectedSplitYield: projectedSplit,
        profitIncreasePct: Math.max(25, isNaN(pct) ? 35 : pct),
        totalCost,
        heroSingles: heroes,
        themedCombines: combines,
        floorFillers,
        rawStrategy: null
    };
}

// =========================================================================
// MULTI-PLAY PLAYBOOK SELECTION ENGINE
// Codifies selectable strategic plays for both multi-piece lots and singles
// =========================================================================

export interface ResalePlayTier {
    title: string;
    price: string;
    numericPrice: number;
    channel: string;
    count: number;
    purpose: string;
}

export interface ResalePlay {
    id: string;
    name: string;
    tagline: string;
    strategyType: 'lot_split' | 'single_channel' | 'bundle_combine' | 'liquidation' | 'volume_combine' | 'restock';
    badge: string;
    badgeClass: string;
    icon: string;
    targetChannels: string[];
    targetPrice?: number;
    projectedYield: number; // Gross sticker / sale price
    estFees: number; // Estimated channel / POS fee overhead
    netPayout: number; // Take-home cash after fees (projectedYield - estFees)
    totalCost: number;
    netProfit: number; // Clean cash profit (netPayout - totalCost)
    roiPct: number;
    velocityDays: string;
    laborEffort: 'Low' | 'Medium' | 'High';
    summary: string;
    tiersBreakdown: ResalePlayTier[];
    isRecommended: boolean;
    recommendationReason?: string;
    score: number;
    lotExitPlaybook?: LotExitPlaybook;
    executionAction: {
        type: 'open_splitter' | 'open_bundle' | 'open_combine' | 'open_restock' | 'apply_channel_price';
        payload?: any;
    };
}

/**
 * Detect item category for playbook heuristics and synergy matching
 */
function detectPlaybookCategory(item: any): string {
    if (!item) return 'general';
    const text = `${item.title || ''} ${item.tags || ''} ${item.channel || ''} ${item.storageLocation || ''}`.toLowerCase();
    if (/\b(book|books|hardcover|paperback|novel|author|reading|guide|manual|rpg|d&d|tsr|sci-fi|scifi|star trek)\b/.test(text)) return 'books';
    if (/\b(garment|jacket|shirt|dress|coat|jeans|pants|sherwani|blazer|sweater|hat|fedora|cap|apparel|clothing|shoes|boots)\b/.test(text)) return 'apparel';
    if (/\b(figure|action figure|star wars|hasbro|kenner|funko|toy|doll|plush|lego|model kit)\b/.test(text)) return 'toys_collectibles';
    if (/\b(comic|comics|graphic novel|manga|marvel|dc|bronze age|silver age)\b/.test(text)) return 'comics';
    if (/\b(cassette|vinyl|record|cd|vhs|tape|dvd|laserdisc|music)\b/.test(text)) return 'media';
    if (/\b(vintage|antique|brass|oddity|skull|decor|plate|glass|porcelain|clock)\b/.test(text)) return 'vintage_decor';
    return 'general';
}

/**
 * Identifies existing active batch or lot SKUs in inventory that could absorb incoming units
 */
function findMatchingBatchLot(targetItem: any, candidates: any[]): any | null {
    if (!targetItem || !Array.isArray(candidates) || candidates.length === 0) return null;
    const itemTitle = (targetItem.title || '').toLowerCase();
    const itemCat = detectPlaybookCategory(targetItem).toLowerCase();
    
    const batchCandidates = candidates.filter(c => {
        if (!c || c.$id === targetItem.$id || c.status === 'sold' || c.status === 'archived') return false;
        const qty = Number(c.quantity || 1);
        return qty > 1 || c.status === 'combined' || c.isLot || /\b(lot|pack|bundle|collection|set)\b/i.test(c.title || '');
    });

    for (const batch of batchCandidates) {
        const bTitle = (batch.title || '').toLowerCase();
        const bCat = detectPlaybookCategory(batch).toLowerCase();
        
        if (itemCat && bCat && itemCat === bCat && itemCat !== 'general') {
            return batch;
        }

        const itemWords = itemTitle.split(/[\s,./\-_]+/).filter(w => w.length >= 4 && !['vintage', 'used', 'brand', 'unknown', 'with', 'from', 'blue', 'multi'].includes(w));
        if (itemWords.some(w => bTitle.includes(w))) {
            return batch;
        }
    }
    return null;
}

/**
 * Derives a curated list of selectable Plays for an inventory item.
 * Evaluates whether item is a multi-piece lot vs a single piece,
 * calculates financial returns, velocity, and labor trade-offs,
 * scans catalog for batch restock & combine opportunities,
 * and incorporates user learning affinities.
 */
export function deriveInventoryPlays(
    item: any, 
    scoutData?: any, 
    learnedAffinities?: Record<string, number>,
    inventoryItems?: any[]
): ResalePlay[] {
    if (!item) return [];

    let totalCost = parsePriceValue(item.cost ?? item.purchasePrice, 'midpoint', 0);
    // If cost basis is not recorded yet (e.g. unacquired item being scouted / evaluated),
    // derive a realistic landed cost basis from active auction or sticker asking price
    if (totalCost <= 0) {
        const currentBid = Number(item.currentBid || item.auction_meta?.current_bid || parsePriceValue(item.purchase_strategy?.current_asking_price, 'midpoint', 0));
        const shipping = Number(item.shipping_info?.total || item.auction_meta?.estimated_shipping || item.shippingPrice || 0);
        const bp = currentBid * (Number(item.auction_meta?.buyers_premium_percent || 0) / 100);
        const auctionLanded = currentBid > 0 ? Math.round((currentBid + bp + shipping) * 100) / 100 : 0;
        
        const askingPrice = parsePriceValue(item.purchase_strategy?.current_asking_price || item.askingPrice || item.price, 'midpoint', 0);
        const maxLanded = parsePriceValue(item.purchase_strategy?.max_buy_price || item.maxLandedCost || item.maxBid, 'midpoint', 0);

        totalCost = auctionLanded > 0 ? auctionLanded : (askingPrice > 0 ? Math.round((askingPrice + shipping) * 100) / 100 : (maxLanded > 0 ? maxLanded : 0));
    }

    const bulkPrice = parsePriceValue(item.resalePrice ?? item.boutiquePrice, 'midpoint', 0);
    const title = (item.title || '').trim();
    let qty = parsePriceValue(item.quantity, 'first', 0);
    if (qty <= 0) {
        const qtyMatch = title.match(/^(\d+)\s+/i) || 
                         title.match(/\b(?:lot of|pack of|set of|box of)\s*(\d+)\b/i) || 
                         title.match(/\b(\d+)\s*(?:pack|pk|pcs|pieces|books|volumes|vols|items|figures)\b/i);
        if (qtyMatch) {
            qty = parseInt(qtyMatch[1], 10);
        }
    }
    if (qty <= 0) qty = 1;

    const activeInventory = Array.isArray(inventoryItems) ? inventoryItems : [];

    // Check if item is a lot or has components / lot characteristics
    const isLot = qty > 1 || 
                  item.status === 'combined' || 
                  item.isLot || 
                  (Array.isArray(item.components) && item.components.length > 1) ||
                  /\b(lot of|collection of|set of|bundle of|box lot|bulk lot)\b/i.test(title);

    const plays: ResalePlay[] = [];

    if (isLot) {
        // -------------------------------------------------------------
        // LOT & BUNDLE PLAYS
        // -------------------------------------------------------------
        const baseLotStrategy = deriveLotExitPlaybook(item, scoutData) || {
            summary: 'Decompose lot into profit tiers to recoup capital and clear remainder.',
            projectedBulkYield: bulkPrice > 0 ? bulkPrice : (totalCost > 0 ? Math.round(totalCost * 1.8) : 50),
            projectedSplitYield: bulkPrice > 0 ? Math.round(bulkPrice * 1.15) : (totalCost > 0 ? Math.round(totalCost * 2.1) : 60),
            profitIncreasePct: 35,
            totalCost,
            heroSingles: [{
                name: 'Standout Anchor Piece',
                estPrice: `$${Math.max(25, totalCost > 0 ? totalCost * 1.05 : 30).toFixed(2)}`,
                numericPrice: Math.max(25, totalCost > 0 ? totalCost * 1.05 : 30),
                targetChannel: 'Online / Showcase',
                reason: 'Recoups 100% cost basis',
                recoupsCost: true
            }],
            themedCombines: [{
                name: 'Core Volume Set',
                estPrice: '$24.00',
                numericPrice: 24,
                items: ['Piece A', 'Piece B'],
                reason: 'High AOV companion pairing'
            }],
            floorFillers: {
                name: 'Booth Grazing Grab Bag',
                estPrice: '$10.00',
                numericPrice: 10,
                count: Math.max(1, qty - 2),
                targetChannel: 'Memory Den Booth Basket'
            }
        };

        const totalPieces = Math.max(qty, item.components?.length || 5);

        // Play 1: Anchor Skim & Floor Fill (Balanced / 100% Cost Recovery)
        const p1Gross = baseLotStrategy.projectedSplitYield;
        const p1Fees = Math.round(p1Gross * 0.11 * 100) / 100; // ~11% blended fee
        const p1Payout = Math.round((p1Gross - p1Fees) * 100) / 100;
        const p1Net = Math.round((p1Payout - totalCost) * 100) / 100;
        plays.push({
            id: 'anchor_skim',
            name: 'Anchor Skim & Floor Fill',
            tagline: 'Recoup 100% cost on day 1 from hero singles, clear remainder in booth basket',
            strategyType: 'lot_split',
            badge: 'Cost Protected',
            badgeClass: 'badge-success',
            icon: 'solar:shield-check-bold',
            targetChannels: ['eBay / Showcase', 'Memory Den Booth Basket'],
            projectedYield: p1Gross,
            estFees: p1Fees,
            netPayout: p1Payout,
            totalCost,
            netProfit: p1Net,
            roiPct: calculateRoiPct(p1Net, totalCost),
            velocityDays: '7 - 14 days',
            laborEffort: 'Medium',
            summary: `Extract ${baseLotStrategy.heroSingles?.length || 1} hero item(s) to recover $${totalCost > 0 ? totalCost.toFixed(2) : 'landed'} cost basis immediately. Place remainder pieces into low-friction booth impulse packs.`,
            tiersBreakdown: [
                ...((baseLotStrategy.heroSingles || []).map(h => ({
                    title: `🌟 Hero: ${h.name}`,
                    price: h.estPrice,
                    numericPrice: h.numericPrice,
                    channel: h.targetChannel,
                    count: 1,
                    purpose: '100% Capital Recovery'
                }))),
                ...((baseLotStrategy.themedCombines || []).map(c => ({
                    title: `🎁 Combine: ${c.name}`,
                    price: c.estPrice,
                    numericPrice: c.numericPrice,
                    channel: 'Online / Boutique Display',
                    count: c.items?.length || 2,
                    purpose: 'Elevated AOV'
                }))),
                ...(baseLotStrategy.floorFillers ? [{
                    title: `⚡ Floor: ${baseLotStrategy.floorFillers.name}`,
                    price: baseLotStrategy.floorFillers.estPrice,
                    numericPrice: baseLotStrategy.floorFillers.numericPrice,
                    channel: baseLotStrategy.floorFillers.targetChannel,
                    count: baseLotStrategy.floorFillers.count,
                    purpose: 'Zero-Friction Liquidation'
                }] : [])
            ],
            isRecommended: false,
            score: 80,
            lotExitPlaybook: baseLotStrategy,
            executionAction: {
                type: 'open_splitter',
                payload: { exitPlaybook: baseLotStrategy }
            }
        });

        // Play 2: Curated Thematic Batches (High AOV / Shipping Leverage)
        const p2Gross = Math.round(p1Gross * 1.08);
        const p2Fees = Math.round(p2Gross * 0.12 * 100) / 100;
        const p2Payout = Math.round((p2Gross - p2Fees) * 100) / 100;
        const p2Net = Math.round((p2Payout - totalCost) * 100) / 100;
        plays.push({
            id: 'themed_combines',
            name: 'Curated Thematic Batches',
            tagline: 'Package into multi-item batch sets to escape single-item shipping traps',
            strategyType: 'lot_split',
            badge: 'Max Profit',
            badgeClass: 'badge-primary',
            icon: 'solar:layers-bold',
            targetChannels: ['Online / Etsy / eBay', 'Boutique Shelves'],
            projectedYield: p2Gross,
            estFees: p2Fees,
            netPayout: p2Payout,
            totalCost,
            netProfit: p2Net,
            roiPct: calculateRoiPct(p2Net, totalCost),
            velocityDays: '14 - 30 days',
            laborEffort: 'Medium',
            summary: `Group like-with-like items into $25 – $45 sweet-spot bundles. Eliminates individual packing labor and leverages Media Mail / flat rate shipping.`,
            tiersBreakdown: [
                {
                    title: '🎁 Themed Companion 2-3 Packs',
                    price: '$28.00 – $42.00',
                    numericPrice: 35,
                    channel: 'Etsy / eBay / Booth Shelf',
                    count: Math.max(2, Math.floor(totalPieces * 0.7)),
                    purpose: 'High AOV & zero shipping trap'
                },
                {
                    title: '📦 Remainder Mystery / Starter Lot',
                    price: '$18.00',
                    numericPrice: 18,
                    channel: 'Memory Den / DustyTiger',
                    count: Math.max(1, Math.ceil(totalPieces * 0.3)),
                    purpose: 'Quick clearance set'
                }
            ],
            isRecommended: false,
            score: 75,
            lotExitPlaybook: baseLotStrategy,
            executionAction: {
                type: 'open_splitter',
                payload: { exitPlaybook: baseLotStrategy }
            }
        });

        // Play 3: Booth Grazing Blitz (Velocity / Zero Shipping)
        const grazingPerItem = totalPieces > 10 ? 8 : 10;
        const p3Gross = totalPieces * grazingPerItem;
        const p3Fees = Math.round(p3Gross * 0.10 * 100) / 100;
        const p3Payout = Math.round((p3Gross - p3Fees) * 100) / 100;
        const p3Net = Math.round((p3Payout - totalCost) * 100) / 100;
        plays.push({
            id: 'booth_grazing',
            name: 'Booth Grazing Blitz',
            tagline: 'Flat-rate tag all pieces at $10 in booth impulse basket for rapid physical turns',
            strategyType: 'lot_split',
            badge: 'Fast Velocity',
            badgeClass: 'badge-warning',
            icon: 'solar:bag-3-bold',
            targetChannels: ['Memory Den Booth Basket', 'DustyTiger'],
            projectedYield: p3Gross,
            estFees: p3Fees,
            netPayout: p3Payout,
            totalCost,
            netProfit: p3Net,
            roiPct: calculateRoiPct(p3Net, totalCost),
            velocityDays: '3 - 7 days',
            laborEffort: 'Low',
            summary: `Print quick Ricochet barcode tags at $${grazingPerItem}.00 each and drop into high-traffic booth baskets. Zero online photography, zero packaging, immediate cash flow.`,
            tiersBreakdown: [
                {
                    title: `🏷️ ${totalPieces} x $${grazingPerItem}.00 Flat Price Tags`,
                    price: `$${grazingPerItem}.00 / ea`,
                    numericPrice: grazingPerItem,
                    channel: 'Memory Den Ricochet POS',
                    count: totalPieces,
                    purpose: 'Zero-effort weekend foot-traffic velocity'
                }
            ],
            isRecommended: false,
            score: 70,
            lotExitPlaybook: baseLotStrategy,
            executionAction: {
                type: 'open_splitter',
                payload: { exitPlaybook: baseLotStrategy }
            }
        });

        // Play 4: Quick-Turn Complete Lot (Zero Labor Liquidation)
        const p4Gross = Math.round(Math.max(totalCost * 1.35, baseLotStrategy.projectedBulkYield || 65));
        const p4Fees = Math.round(p4Gross * 0.135 * 100) / 100;
        const p4Payout = Math.round((p4Gross - p4Fees) * 100) / 100;
        const p4Net = Math.round((p4Payout - totalCost) * 100) / 100;
        plays.push({
            id: 'quick_lot',
            name: 'Quick-Turn Complete Lot',
            tagline: 'Flip intact collection in 1 listing to lock in fast cash with zero prep time',
            strategyType: 'liquidation',
            badge: 'Zero Labor',
            badgeClass: 'badge-ghost',
            icon: 'solar:box-minimalistic-bold',
            targetChannels: ['eBay Wholesale Auction', 'Local Marketplace'],
            projectedYield: p4Gross,
            estFees: p4Fees,
            netPayout: p4Payout,
            totalCost,
            netProfit: p4Net,
            roiPct: calculateRoiPct(p4Net, totalCost),
            velocityDays: '1 - 3 days',
            laborEffort: 'Low',
            summary: `List entire box as 1 bulk lot. Ideal when shop floor space is constrained or you need capital immediately for incoming hauls.`,
            tiersBreakdown: [
                {
                    title: '📦 Complete Untouched Bulk Lot',
                    price: `$${p4Gross}.00`,
                    numericPrice: p4Gross,
                    channel: 'eBay / Wholesale',
                    count: 1,
                    purpose: 'Instant capital liquidation'
                }
            ],
            isRecommended: false,
            score: 50,
            executionAction: {
                type: 'apply_channel_price',
                payload: { channel: 'eBay', price: p4Gross }
            }
        });

        // Play 5: Restock / Replenish Batch Units
        const restockYield = bulkPrice > 0 ? bulkPrice : Math.round(totalCost * 2);
        const restockFees = Math.round(restockYield * 0.10 * 100) / 100;
        const restockPayout = Math.round((restockYield - restockFees) * 100) / 100;
        const restockNet = Math.round((restockPayout - totalCost) * 100) / 100;
        plays.push({
            id: 'restock_units',
            name: 'Restock Batch Units',
            tagline: `Add incoming units to this active SKU (currently Qty: ${qty}) and re-average cost basis`,
            strategyType: 'restock',
            badge: 'Batch Growth',
            badgeClass: 'badge-warning',
            icon: 'solar:box-minimalistic-bold',
            targetChannels: [item.storageLocation || 'Memory Den Booth'],
            targetPrice: restockYield,
            projectedYield: restockYield,
            estFees: restockFees,
            netPayout: restockPayout,
            totalCost,
            netProfit: restockNet,
            roiPct: calculateRoiPct(restockNet, totalCost),
            velocityDays: '1 - 7 days',
            laborEffort: 'Low',
            summary: `Physical unit replenishment: Add newly acquired copies to this active SKU crate and recalculate average cost basis without writing a new price tag. (To batch with other items in your catalog, use AI Batch Catalog).`,
            tiersBreakdown: [
                {
                    title: `📦 Active Inventory Batch`,
                    price: `$${restockYield}.00`,
                    numericPrice: restockYield,
                    channel: item.storageLocation || 'Memory Den',
                    count: qty,
                    purpose: 'Zero tag friction replenishment'
                }
            ],
            isRecommended: false,
            score: 55,
            executionAction: {
                type: 'open_restock',
                payload: { targetItem: item }
            }
        });
    } else {
        // -------------------------------------------------------------
        // SINGLE ITEM PLAYS (e.g. HUCK-0879 Sherwani Garment, Single Hats, Collectibles)
        // -------------------------------------------------------------
        let compFair = 0;
        let compHigh = 0;
        let compFloor = 0;

        const pb = item.price_breakdown || scoutData?.price_breakdown || item.pricing_potential || scoutData?.pricing_potential;
        if (pb) {
            compFair = parsePriceValue(pb.fair || pb.fair_price || pb.estimated_resale, 'midpoint', 0);
            compHigh = parsePriceValue(pb.high || pb.boutique || pb.boutique_premium, 'high', 0);
            compFloor = parsePriceValue(pb.floor || pb.thrift_quick || pb.low, 'low', 0);
        }
        if (compFair <= 0 && (item.resalePrice || item.boutiquePrice || item.selected_resale_price)) {
            compFair = parsePriceValue(item.selected_resale_price || item.boutiquePrice || item.resalePrice, 'midpoint', 0);
        }
        if (compFair <= 0 && item.estimated_resale) {
            compFair = parsePriceValue(item.estimated_resale, 'midpoint', 0);
        }

        // Realistic fallbacks based on landed cost
        if (compFair <= 0) {
            compFair = totalCost > 0 ? Math.round(totalCost * 2.2) : 48;
        }
        if (compHigh <= compFair) {
            compHigh = Math.round(compFair * 1.35);
        }
        if (compFloor <= 0 || compFloor >= compFair) {
            compFloor = Math.max(Math.round(totalCost * 1.35), Math.round(compFair * 0.75));
        }

        // Clamp safeguards: prevent corrupted AI outputs or wild multipliers
        if (totalCost > 0 && compHigh > totalCost * 7) {
            compHigh = Math.round(totalCost * 4.0);
            compFair = Math.round(totalCost * 2.6);
            compFloor = Math.max(Math.round(totalCost * 1.4), Math.round(compFair * 0.65));
        }

        // Ensure floor is always above landed cost so "Fast Cash" never recommends selling at a loss!
        if (totalCost > 0 && compFloor < totalCost * 1.15) {
            compFloor = Math.round(totalCost * 1.35);
        }

        const itemCategory = detectPlaybookCategory(item);
        let boothSummary = `Eye-catching items draw shoppers into the booth. Physical shoppers pay a premium when they can inspect authenticity, condition, and craftsmanship in person with zero shipping wait.`;
        if (itemCategory === 'books' || itemCategory === 'comics') {
            boothSummary = `Eye-catching items draw shoppers into the booth. In-person collectors pay a premium when they can inspect completeness, binding, and physical condition without shipping costs.`;
        } else if (itemCategory === 'toys_collectibles') {
            boothSummary = `High-demand collector pieces stop aisle foot traffic. In-person buyers pay a premium when they can verify physical condition, packaging, and authenticity firsthand.`;
        } else if (itemCategory === 'apparel') {
            boothSummary = `Eye-catching garments draw shoppers into the booth. Physical shoppers pay a premium when they can inspect fabric quality, fit, and craftsmanship in person.`;
        } else if (itemCategory === 'media') {
            boothSummary = `Niche media draws dedicated crate-diggers into the booth. Shoppers pay a premium to inspect disc and sleeve condition in person without shipping risk.`;
        } else if (itemCategory === 'vintage_decor') {
            boothSummary = `Tactile vintage decor acts as an anchor display that stops foot traffic. Shoppers pay a premium to see scale, weight, and patina in person.`;
        }

        // Play 1: Booth Anchor Centerpiece (Physical Foot-Traffic Magnet)
        // Memory Den 10% consignment fee, zero shipping overhead
        const p1Gross = Math.round(compFair);
        const p1Fees = Math.round(p1Gross * 0.10 * 100) / 100;
        const p1Payout = Math.round((p1Gross - p1Fees) * 100) / 100;
        const p1Net = Math.round((p1Payout - totalCost) * 100) / 100;
        plays.push({
            id: 'booth_showcase',
            name: 'Booth Anchor Centerpiece',
            tagline: 'Showcase in Memory Den booth for tactile visual impact with zero shipping risk',
            strategyType: 'single_channel',
            badge: 'Zero Shipping',
            badgeClass: 'badge-success',
            icon: 'solar:shop-2-bold',
            targetChannels: ['Memory Den Showcase', 'Mannequin / Wall Rack'],
            targetPrice: p1Gross,
            projectedYield: p1Gross,
            estFees: p1Fees,
            netPayout: p1Payout,
            totalCost,
            netProfit: p1Net,
            roiPct: calculateRoiPct(p1Net, totalCost),
            velocityDays: '7 - 21 days',
            laborEffort: 'Low',
            summary: boothSummary,
            tiersBreakdown: [
                {
                    title: `🏬 Memory Den Showcase Tag`,
                    price: `$${p1Gross}.00`,
                    numericPrice: p1Gross,
                    channel: 'Memory Den',
                    count: 1,
                    purpose: 'High-visibility booth attractor with immediate POS checkout'
                }
            ],
            isRecommended: false,
            score: 80,
            executionAction: {
                type: 'apply_channel_price',
                payload: { channel: 'Memory Den', price: p1Gross, status: 'placed' }
            }
        });

        // Play 2: High-Yield Online Long-Tail (Full Comp Ceiling)
        // eBay ~13.5% + $0.40 fee
        const p2Gross = Math.round(compHigh);
        const p2Fees = Math.round((p2Gross * 0.135 + 0.40) * 100) / 100;
        const p2Payout = Math.round((p2Gross - p2Fees) * 100) / 100;
        const p2Net = Math.round((p2Payout - totalCost) * 100) / 100;
        plays.push({
            id: 'online_showcase',
            name: 'High-Ticket Online Long-Tail',
            tagline: 'Target national niche collectors on eBay / Poshmark at peak comp ceiling',
            strategyType: 'single_channel',
            badge: 'Max Dollar Yield',
            badgeClass: 'badge-primary',
            icon: 'solar:globe-bold',
            targetChannels: ['eBay', 'Poshmark'],
            targetPrice: p2Gross,
            projectedYield: p2Gross,
            estFees: p2Fees,
            netPayout: p2Payout,
            totalCost,
            netProfit: p2Net,
            roiPct: calculateRoiPct(p2Net, totalCost),
            velocityDays: '30 - 60 days',
            laborEffort: 'Medium',
            summary: `Specialty items with distinct aesthetics or niche demand command the highest dollar return online. Allow a 30-60 day tail to connect with the right buyer.`,
            tiersBreakdown: [
                {
                    title: `🌟 Dedicated Marketplace Listing`,
                    price: `$${p2Gross}.00`,
                    numericPrice: p2Gross,
                    channel: 'eBay / Poshmark',
                    count: 1,
                    purpose: 'Captures full collector comp ceiling'
                }
            ],
            isRecommended: false,
            score: 75,
            executionAction: {
                type: 'apply_channel_price',
                payload: { channel: 'eBay', price: p2Gross, status: 'active' }
            }
        });

        // Play 3: Fast Cash Liquidation (Capital Recoup Blitz)
        // Respect location niches: DustyTiger strictly for smalls/jewelry/collectibles; Memory Den for clothing; eBay for large/bulky
        const titleAndCat = `${item?.title || ''} ${item?.category || ''}`.toLowerCase();
        const isClothingOrApparel = /\b(shirt|pant|pants|dress|jacket|coat|vest|sweater|hoodie|clothing|apparel|blouse|garment|sherwani|skirt|scarf|jeans|tshirt|tee|boots|shoes|hat|cap)\b/i.test(titleAndCat);
        const isLargeBulky = /\b(playset|vehicle|large|oversized|bulk|furniture|heavy|crate|box set)\b/i.test(titleAndCat);

        let fastChannel = 'DustyTiger';
        let fastChannelLabel = 'DustyTiger / Flash Rack';
        let fastTargetChannels = ['DustyTiger', 'Weekend Flash Sale'];

        if (isClothingOrApparel) {
            fastChannel = 'Memory Den';
            fastChannelLabel = 'Memory Den Flash Rack / Poshmark';
            fastTargetChannels = ['Memory Den', 'Poshmark Flash Sale'];
        } else if (isLargeBulky) {
            fastChannel = 'eBay';
            fastChannelLabel = 'eBay Flash Sale / Quick Flip';
            fastTargetChannels = ['eBay', 'Local Pick-Up'];
        }

        const p3Gross = Math.round(compFloor);
        const p3Fees = Math.round(p3Gross * 0.10 * 100) / 100;
        const p3Payout = Math.round((p3Gross - p3Fees) * 100) / 100;
        const p3Net = Math.round((p3Payout - totalCost) * 100) / 100;
        plays.push({
            id: 'fast_liquidation',
            name: 'Fast Cash Turnaround',
            tagline: 'Price for a rapid sub-7-day impulse sale to recover capital immediately',
            strategyType: 'liquidation',
            badge: 'Fast Cash',
            badgeClass: 'badge-warning',
            icon: 'solar:bolt-bold',
            targetChannels: fastTargetChannels,
            targetPrice: p3Gross,
            projectedYield: p3Gross,
            estFees: p3Fees,
            netPayout: p3Payout,
            totalCost,
            netProfit: p3Net,
            roiPct: calculateRoiPct(p3Net, totalCost),
            velocityDays: '1 - 7 days',
            laborEffort: 'Low',
            summary: totalCost > 0 ? `Priced at an irresistible impulse point that guarantees rapid turn. Recoups 100% of your $${totalCost.toFixed(2)} cost basis in the first weekend.` : `Priced at an irresistible impulse point for rapid sub-7-day turn.`,
            tiersBreakdown: [
                {
                    title: `⚡ Flash Impulse Tag`,
                    price: `$${p3Gross}.00`,
                    numericPrice: p3Gross,
                    channel: fastChannelLabel,
                    count: 1,
                    purpose: 'Guaranteed quick cash turnaround in < 7 days'
                }
            ],
            isRecommended: false,
            score: 65,
            executionAction: {
                type: 'apply_channel_price',
                payload: { channel: fastChannel, price: p3Gross, status: 'placed' }
            }
        });

        // Play 4: Curated Companion Bundle (Cross-Sell Elevate)
        const p4Gross = Math.round(compFair * 1.55);
        const p4Fees = Math.round(p4Gross * 0.10 * 100) / 100;
        const p4Payout = Math.round((p4Gross - p4Fees) * 100) / 100;
        const p4Net = Math.round((p4Payout - totalCost) * 100) / 100;
        plays.push({
            id: 'bundle_combine',
            name: 'Curated Companion Set',
            tagline: 'Pair with complementary inventory accessories to create a lifestyle gift set',
            strategyType: 'bundle_combine',
            badge: 'Elevated AOV',
            badgeClass: 'badge-secondary',
            icon: 'solar:gift-bold',
            targetChannels: ['Curated Boutique Set', 'Memory Den'],
            targetPrice: p4Gross,
            projectedYield: p4Gross,
            estFees: p4Fees,
            netPayout: p4Payout,
            totalCost,
            netProfit: p4Net,
            roiPct: calculateRoiPct(p4Net, totalCost),
            velocityDays: '14 - 30 days',
            laborEffort: 'Medium',
            summary: `Pair this item with matching accessories (e.g. scarf, jewelry, hat, or companion media) to escape direct comp price competition.`,
            tiersBreakdown: [
                {
                    title: `🎁 Thematic Companion Bundle`,
                    price: `$${p4Gross}.00`,
                    numericPrice: p4Gross,
                    channel: 'Memory Den / Online',
                    count: 2,
                    purpose: 'Elevates basket size and creates unique gift appeal'
                }
            ],
            isRecommended: false,
            score: 60,
            executionAction: {
                type: 'open_bundle',
                payload: { item }
            }
        });

        // Play 5: Format Volume Batch (Like-with-Like)
        const pCombineGross = Math.round(compFair * 2.2);
        const pCombineFees = Math.round(pCombineGross * 0.10 * 100) / 100;
        const pCombinePayout = Math.round((pCombineGross - pCombineFees) * 100) / 100;
        const pCombineNet = Math.round((pCombinePayout - totalCost * 2) * 100) / 100;
        plays.push({
            id: 'volume_combine',
            name: 'Format Volume Batch',
            tagline: 'Stack with matching format inventory into a fast-moving batch lot',
            strategyType: 'volume_combine',
            badge: 'Batch Pack',
            badgeClass: 'badge-info',
            icon: 'solar:layers-bold',
            targetChannels: ['Memory Den Impulse Basket', 'Media Mail Online'],
            targetPrice: pCombineGross,
            projectedYield: pCombineGross,
            estFees: pCombineFees,
            netPayout: pCombinePayout,
            totalCost: totalCost * 2,
            netProfit: pCombineNet,
            roiPct: calculateRoiPct(pCombineNet, totalCost * 2),
            velocityDays: '3 - 10 days',
            laborEffort: 'Low',
            summary: `Batch identical format items (e.g. 4 paperbacks for $15, 2 wool hats for $25) to hit fast-turn impulse price points at the booth or escape single-item shipping traps online with USPS Media Mail.`,
            tiersBreakdown: [
                {
                    title: `📦 Volume Batch Pack`,
                    price: `$${pCombineGross}.00`,
                    numericPrice: pCombineGross,
                    channel: 'Memory Den / Online',
                    count: 3,
                    purpose: 'High-turnover impulse batching'
                }
            ],
            isRecommended: false,
            score: 62,
            executionAction: {
                type: 'open_combine',
                payload: { item }
            }
        });

        // Play 6: Restock into Matching Batch Lot (if matching batch exists in inventory)
        const matchingBatch = findMatchingBatchLot(item, activeInventory);
        if (matchingBatch) {
            const bPrice = parsePriceValue(matchingBatch.resalePrice || matchingBatch.boutiquePrice, 'midpoint', compFair);
            const bFees = Math.round(bPrice * 0.10 * 100) / 100;
            const bPayout = Math.round((bPrice - bFees) * 100) / 100;
            const bNet = Math.round((bPayout - totalCost) * 100) / 100;
            plays.push({
                id: 'restock_merge',
                name: 'Restock into Batch',
                tagline: `Merge into active lot "${matchingBatch.title.substring(0, 24)}..." (Qty: ${matchingBatch.quantity || 1})`,
                strategyType: 'restock',
                badge: 'Fast Merge',
                badgeClass: 'badge-secondary',
                icon: 'solar:box-minimalistic-bold',
                targetChannels: [matchingBatch.storageLocation || 'Memory Den Booth'],
                targetPrice: bPrice,
                projectedYield: bPrice,
                estFees: bFees,
                netPayout: bPayout,
                totalCost,
                netProfit: bNet,
                roiPct: calculateRoiPct(bNet, totalCost),
                velocityDays: '1 - 7 days',
                laborEffort: 'Low',
                summary: `Found an existing active batch SKU in stock ("${matchingBatch.title}"). Instead of writing a new tag and creating a separate listing, merge these units directly into that batch to save booth shelf space and admin overhead.`,
                tiersBreakdown: [
                    {
                        title: `📥 Merge into ${matchingBatch.title.substring(0, 28)}`,
                        price: `$${bPrice}.00`,
                        numericPrice: bPrice,
                        channel: matchingBatch.storageLocation || 'Memory Den',
                        count: qty,
                        purpose: 'Zero-tag batch expansion'
                    }
                ],
                isRecommended: false,
                score: 72,
                executionAction: {
                    type: 'open_restock',
                    payload: { targetItem: matchingBatch, sourceItem: item }
                }
            });
        }
    }

    // Apply learning affinities to boost score
    if (learnedAffinities) {
        plays.forEach(p => {
            const count = learnedAffinities[p.id] || 0;
            if (count > 0) {
                p.score += count * 25; // 25 points per past execution
            }
        });
    }

    // Sort by score descending and set top play as recommended
    plays.sort((a, b) => b.score - a.score);

    if (plays.length > 0) {
        plays[0].isRecommended = true;
        if (learnedAffinities && (learnedAffinities[plays[0].id] || 0) > 0) {
            plays[0].recommendationReason = '✨ AI Recommended • Matches your past successful plays';
        } else {
            plays[0].recommendationReason = '✨ AI Recommended • Optimal margin-to-velocity ratio';
        }
    }

    return plays;
}


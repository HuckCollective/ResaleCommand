import type { APIRoute } from 'astro';
import { model, generateContentWithBackoff, DEFAULT_GEMINI_MODEL, parseAiJson } from '../../lib/gemini';
import { normalizeBundleComponents, parsePriceRange } from '../../lib/bundle-pricing';
import { speedScoutResponseSchema } from '../../lib/ai/schemas/speed-scout.schema';
import { SPEED_SCOUT_SYSTEM_INSTRUCTION } from '../../lib/ai/instructions/system-instructions';
import { buildSpeedScoutUserPrompt } from '../../lib/ai/instructions/prompt-builders';
import { parsePriceValue } from '../../lib/lot-strategy';

export const prerender = false;
export const maxDuration = 300;

// Helper to parse eBay listing HTML
function parseEbay(html: string) {
    const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) || 
                       html.match(/<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i);
    const title = titleMatch ? titleMatch[1].replace(/ \| eBay$/i, '').trim() : '';

    // Extract price from various formats
    const priceMatch = html.match(/itemprop="price"\s+content=["']([^"']+)["']/i) ||
                       html.match(/"price"\s*:\s*"([^"]+)"/i) || 
                       html.match(/class="x-price-primary">.*?<span[^>]*>\s*([^<]+)<\/span>/is) ||
                       html.match(/class="x-price-primary">.*?class="ux-textspans">([^<]+)/is);
    const price = priceMatch ? priceMatch[1].trim() : '';

    // Extract currency
    const currencyMatch = html.match(/itemprop="priceCurrency"\s+content=["']([^"']+)["']/i) ||
                          html.match(/"priceCurrency"\s*:\s*"([^"]+)"/i);
    const currency = currencyMatch ? currencyMatch[1].trim() : 'USD';

    // Extract description
    const descMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
                      html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1].trim() : '';

    // Extract images
    const imageUrls = new Set<string>();
    const ogImg = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (ogImg) imageUrls.add(ogImg[1]);

    const imgRegex = /<img[^>]+src=["'](https:\/\/i\.ebayimg\.com\/[^"'\s]+)["'][^>]*>/gi;
    let match;
    let count = 0;
    while ((match = imgRegex.exec(html)) !== null && count < 10) {
        imageUrls.add(match[1]);
        count++;
    }

    // Extract shipping
    let shippingCost = '';
    const shipMatch = html.match(/id=["']shipCost["'][^>]*>\s*([^<]+)/i) || 
                      html.match(/class=["']ux-labels-values__labels-content["']>\s*Shipping:\s*([^<]+)/is) ||
                      html.match(/class=["']ux-labels-values__labels-content["'].*?Shipping:.*?class=["']ux-textspans--bold["']>\s*([^<]+)/is) ||
                      html.match(/class=["']ux-labels-values__values-content["'].*?class=["']ux-textspans--bold["']>\s*(Free|[^<]+)/is) ||
                      html.match(/class=["']ux-labels-values__values-content["']>\s*(Free|[^<]+)/is);
    if (shipMatch) {
        shippingCost = shipMatch[1].replace(/<[^>]*>/g, '').trim();
    }

    return {
        platform: 'eBay',
        title,
        price: price ? `${currency} ${price}` : '',
        description,
        images: Array.from(imageUrls).slice(0, 5),
        shipping: shippingCost
    };
}

// Helper to parse Facebook Marketplace listing HTML
function parseFacebookMarketplace(html: string) {
    const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
                       html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const rawTitle = titleMatch ? titleMatch[1].trim() : '';

    let title = rawTitle;
    let price = '';
    let location = '';

    if (rawTitle.includes(' - ')) {
        const parts = rawTitle.split(' - ');
        if (parts.length >= 3) {
            title = parts[0];
            if (parts[1].trim().startsWith('$')) {
                price = parts[1].trim();
                location = parts[2].trim();
            } else if (parts[2].trim().startsWith('$')) {
                price = parts[2].trim();
                location = parts[1].trim();
            } else {
                location = parts[1].trim();
                price = parts[2].trim();
            }
        } else if (parts.length === 2) {
            title = parts[0];
            if (parts[1].trim().startsWith('$')) {
                price = parts[1].trim();
            } else {
                location = parts[1].trim();
            }
        }
    }

    const descMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
                      html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1].trim() : '';

    const imageUrls = new Set<string>();
    const ogImg = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (ogImg) imageUrls.add(ogImg[1]);

    return {
        platform: 'Facebook Marketplace',
        title,
        price,
        location,
        description,
        images: Array.from(imageUrls).slice(0, 3)
    };
}

// Helper to parse Poshmark listing HTML
function parsePoshmark(html: string) {
    const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    const priceMatch = html.match(/<meta\s+property=["']product:price:amount["']\s+content=["']([^"']+)["']/i) ||
                       html.match(/"price"\s*:\s*"([^"]+)"/i);
    const price = priceMatch ? `$${priceMatch[1].trim()}` : '';

    const brandMatch = html.match(/<meta\s+property=["']product:brand["']\s+content=["']([^"']+)["']/i) ||
                       html.match(/"brand"\s*:\s*{\s*"name"\s*:\s*"([^"]+)"/i);
    const brand = brandMatch ? brandMatch[1].trim() : '';

    const descMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
                      html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1].trim() : '';

    const imageUrls = new Set<string>();
    const ogImg = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (ogImg) imageUrls.add(ogImg[1]);

    const imgRegex = /<img[^>]+src=["'](https:\/\/images\.poshmark\.com\/[^"'\s]+)["'][^>]*>/gi;
    let match;
    let count = 0;
    while ((match = imgRegex.exec(html)) !== null && count < 10) {
        imageUrls.add(match[1]);
        count++;
    }

    return {
        platform: 'Poshmark',
        title,
        price,
        brand,
        description,
        images: Array.from(imageUrls).slice(0, 5)
    };
}

// Helper to parse Mercari listing HTML
function parseMercari(html: string) {
    const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    const priceMatch = html.match(/<meta\s+property=["']product:price:amount["']\s+content=["']([^"']+)["']/i) ||
                       html.match(/"price"\s*:\s*"([^"]+)"/i);
    const price = priceMatch ? `$${priceMatch[1].trim()}` : '';

    const descMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
                      html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1].trim() : '';

    const imageUrls = new Set<string>();
    const ogImg = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (ogImg) imageUrls.add(ogImg[1]);

    return {
        platform: 'Mercari',
        title,
        price,
        description,
        images: Array.from(imageUrls).slice(0, 5)
    };
}

// Helper to parse CTBids (Caring Transitions) listing HTML
function parseCTBids(html: string) {
    const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
                       html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/ \| CTBids$/i, '').trim() : '';

    // Price / Current Bid
    let price = '';
    const bidMatch = html.match(/(?:current\s*bid|starting\s*bid|price):\s*\$?([0-9.,]+)/i) ||
                     html.match(/class=["'][^"']*current-bid[^"']*["'][^>]*>\s*\$?([0-9.,]+)/i) ||
                     html.match(/itemprop=["']price["']\s+content=["']([^"']+)["']/i);
    if (bidMatch) {
        price = `$${bidMatch[1].trim()}`;
    }

    // Time Remaining / End Time
    let timeLeft = '';
    const timeMatch = html.match(/(?:time\s*remaining|ends|closing\s*in):\s*([^<\n\r]+)/i) ||
                      html.match(/class=["'][^"']*(?:countdown|timer|time-left)[^"']*["'][^>]*>([^<]+)/i);
    if (timeMatch) {
        timeLeft = timeMatch[1].replace(/<[^>]*>/g, '').trim();
    }

    // Buyer's Premium (default 15% for CTBids)
    let buyersPremium = '15%';
    const bpMatch = html.match(/buyer'?s?\s*premium:?\s*(\d+)%/i);
    if (bpMatch) {
        buyersPremium = `${bpMatch[1]}%`;
    }

    // Pickup vs Shipping
    let terms = 'Local Pickup';
    if (/shipping\s*available/i.test(html) && !/no\s*shipping/i.test(html)) {
        terms = 'Shipping Available (or Local Pickup)';
    } else if (/local\s*pick\s*up\s*only/i.test(html)) {
        terms = 'Local Pickup Only';
    }

    // Description
    const descMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
                      html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1].trim() : '';

    // Images
    const imageUrls = new Set<string>();
    const ogImg = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (ogImg) imageUrls.add(ogImg[1]);

    const imgRegex = /<img[^>]+src=["'](https:\/\/[^"'\s]+)["'][^>]*>/gi;
    let match;
    let count = 0;
    while ((match = imgRegex.exec(html)) !== null && count < 10) {
        const src = match[1];
        if (src.includes('ctbids') || src.includes('azure') || src.includes('s3') || src.includes('cloudinary')) {
            imageUrls.add(src);
        }
        count++;
    }

    return {
        platform: 'CTBids',
        title,
        price,
        timeLeft,
        buyersPremium,
        terms,
        description,
        images: Array.from(imageUrls).slice(0, 5)
    };
}

// Helper to parse HiBid listing HTML
function parseHiBid(html: string) {
    const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
                       html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/ \| HiBid$/i, '').trim() : '';

    // Current / Internet Bid
    let price = '';
    const bidMatch = html.match(/(?:internet\s*bid|current\s*bid|lead\s*bid):\s*\$?([0-9.,]+)/i) ||
                     html.match(/class=["'][^"']*lot-bid[^"']*["'][^>]*>\s*\$?([0-9.,]+)/i) ||
                     html.match(/itemprop=["']price["']\s+content=["']([^"']+)["']/i);
    if (bidMatch) {
        price = `$${bidMatch[1].trim()}`;
    }

    // Time Left
    let timeLeft = '';
    const timeMatch = html.match(/(?:time\s*remaining|bidding\s*closes|ends):\s*([^<\n\r]+)/i) ||
                      html.match(/class=["'][^"']*(?:countdown|time-left)[^"']*["'][^>]*>([^<]+)/i);
    if (timeMatch) {
        timeLeft = timeMatch[1].replace(/<[^>]*>/g, '').trim();
    }

    // Buyer's Premium (typically 10% - 18%)
    let buyersPremium = '15%';
    const bpMatch = html.match(/buyer'?s?\s*premium:?\s*(\d+)%/i) ||
                    html.match(/(\d+)%\s*buyer'?s?\s*premium/i);
    if (bpMatch) {
        buyersPremium = `${bpMatch[1]}%`;
    }

    // Shipping vs Pickup
    let terms = 'Check Listing';
    if (/shipping\s*available/i.test(html) && !/no\s*shipping/i.test(html)) {
        terms = 'Shipping Available';
    } else if (/local\s*pickup\s*only/i.test(html) || /no\s*shipping/i.test(html)) {
        terms = 'Local Pickup Only';
    }

    const descMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
                      html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1].trim() : '';

    const imageUrls = new Set<string>();
    const ogImg = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (ogImg) imageUrls.add(ogImg[1]);

    const imgRegex = /<img[^>]+src=["'](https:\/\/[^"'\s]+hibid[^"'\s]+)["'][^>]*>/gi;
    let match;
    let count = 0;
    while ((match = imgRegex.exec(html)) !== null && count < 10) {
        imageUrls.add(match[1]);
        count++;
    }

    return {
        platform: 'HiBid',
        title,
        price,
        timeLeft,
        buyersPremium,
        terms,
        description,
        images: Array.from(imageUrls).slice(0, 5)
    };
}

// Sanitize listing description to strip copyright notices, boilerplate legal text, and store policies that trigger Gemini RECITATION safety blocks
function sanitizeListingDescription(rawHtml: string): string {
    if (!rawHtml) return '';
    let text = rawHtml.replace(/<[^>]*>?/gm, ' ');
    text = text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const filteredLines = lines.filter(line => {
        const lower = line.toLowerCase();
        if (lower.includes('all rights reserved') || lower.includes('copyright') || lower.includes('©') || lower.includes('(c) 19') || lower.includes('(c) 20') || lower.includes('trademark') || lower.includes('tm &')) {
            return false;
        }
        if (lower.includes('shipping & handling policy') || lower.includes('return policy') || lower.includes('seller warranty') || lower.includes('terms of purchase')) {
            return false;
        }
        return true;
    });
    return filteredLines.join('\n').substring(0, 1000);
}

// Resilient Fallback Factory: Synthesizes a 100% complete scouting report directly from verified listing API data
function createListingFallback(parsedListingData: any, scrapedShipping: any, successfulImageUrl: string | null, scrapedImages: string[]) {
    const title = parsedListingData.title || parsedListingData.itemName || 'Online Listing Item';
    const rawPrice = parseFloat(parsedListingData.currentPrice) || parseFloat(parsedListingData.startingPrice) || 0;
    const currentPrice = isNaN(rawPrice) ? 0 : rawPrice;

    // Detect lot count from title / notes (e.g. "10pc", "Lot of 10", "10 book")
    const lotMatch = title.match(/(\d+)\s*(?:pc|pcs|piece|pieces|item|items|book|books|mag|mags|magazine|magazines|vol|pack|lot)/i) || 
                     title.match(/lot\s*(?:of)?\s*(\d+)/i);
    const lotCount = lotMatch ? Math.max(2, parseInt(lotMatch[1])) : 1;

    // Ensure valid shipping object (never $0 / missing for online lots)
    const effectiveShipping = scrapedShipping || {
        shipping: 8.50,
        handling: 3.00,
        total: 11.50,
        carrier: 'Estimated FedEx/USPS',
        zipCode: 'Estimated'
    };
    const shipTotal = effectiveShipping.total;
    
    // Universal resale baseline heuristics (Never anchor down to a low $9.99 auction starting bid)
    const baseFairLow = 12;
    const baseFairHigh = 22;
    const baseBoutiqueLow = 18;
    const baseBoutiqueHigh = 30;

    // Per-unit resale heuristics: Universal floors without fragile category hardcoding
    const isMultiLot = lotCount > 1;
    const perItemFairLow = isMultiLot ? baseFairLow : Math.max(baseFairLow, Math.round(currentPrice * 1.5));
    const perItemFairHigh = isMultiLot ? baseFairHigh : Math.max(baseFairHigh, Math.round(currentPrice * 2.5));
    const perItemBoutiqueLow = isMultiLot ? baseBoutiqueLow : Math.max(baseBoutiqueLow, Math.round(currentPrice * 2.0));
    const perItemBoutiqueHigh = isMultiLot ? baseBoutiqueHigh : Math.max(baseBoutiqueHigh, Math.round(currentPrice * 3.2));

    const fairLow = perItemFairLow * lotCount;
    const fairHigh = perItemFairHigh * lotCount;
    const boutiqueLow = perItemBoutiqueLow * lotCount;
    const boutiqueHigh = perItemBoutiqueHigh * lotCount;

    // Detect if this listing is an active auction (bidCount, endTime, or platform is ShopGoodwill/CTBids/HiBid)
    const isAuction = Boolean(
        parsedListingData.is_auction || 
        parsedListingData.bidCount !== undefined || 
        parsedListingData.endTime || 
        parsedListingData.isAuction
    );

    // Midpoint boutique & fair resale potentials
    const boutiqueMid = Math.round((boutiqueLow + boutiqueHigh) / 2);
    const fairMid = Math.round((fairLow + fairHigh) / 2);
    const targetResale = boutiqueMid > 0 ? boutiqueMid : fairMid;
    const netPayout = Math.round(targetResale * 0.85); // 15% standard consignment overhead

    // Multi-Tier Reseller Profit Curve:
    // 1. Conservative (3.0x ROI / ~33% Landed Ceiling)
    const consTargetLanded = Math.max(10, Math.round(targetResale / 3.0));
    const consMaxBid = Math.max(0, Math.floor(consTargetLanded - shipTotal));
    const consProfit = Math.max(0, netPayout - (consMaxBid + shipTotal));

    // 2. Balanced (2.2x ROI / ~45% Landed Ceiling)
    const balTargetLanded = Math.max(15, Math.round(targetResale / 2.2));
    const balMaxBid = Math.max(0, Math.floor(balTargetLanded - shipTotal));
    const balProfit = Math.max(0, netPayout - (balMaxBid + shipTotal));

    // 3. Aggressive / Fast-Turn / High-Ticket (1.7x ROI / ~59% Landed Ceiling)
    const aggTargetLanded = Math.max(20, Math.round(targetResale / 1.7));
    const aggMaxBid = Math.max(0, Math.floor(aggTargetLanded - shipTotal));
    const aggProfit = Math.max(0, netPayout - (aggMaxBid + shipTotal));

    const currentLanded = Math.round((currentPrice + shipTotal) * 100) / 100;
    const currentProfit = Math.max(0, Math.round(netPayout - currentLanded));

    // Standardized ceilings (Balanced target is primary)
    const maxLandedCost = balTargetLanded;
    const maxBid = balMaxBid;
    const currentAskingStr = `$${currentPrice.toFixed(2)}`;

    let verdict = 'WATCH';
    let advice = '';

    if (isAuction) {
        if (currentLanded > aggTargetLanded) {
            verdict = 'PASS';
            advice = `Live auction currently at $${currentPrice.toFixed(2)}. Landed cost ($${currentLanded.toFixed(2)}) exceeds aggressive 1.7x ceiling ($${aggTargetLanded}). Margin exhausted — recommend passing.`;
        } else if (currentLanded > balTargetLanded) {
            verdict = 'WATCH';
            advice = `Live auction currently at $${currentPrice.toFixed(2)}. Current landed ($${currentLanded.toFixed(2)}) leaves ~$${currentProfit} cash profit. Room up to $${aggMaxBid} max bid for an aggressive 1.7x fast-turn flip netting ~$${aggProfit}.`;
        } else {
            verdict = 'CHASE_AUCTION';
            advice = `Live auction with healthy margin. At active bid ($${currentPrice.toFixed(2)}), landed is $${currentLanded.toFixed(2)} netting ~$${currentProfit} cash profit. Balanced bid up to $${balMaxBid} (2.2x ROI / +$${balProfit} profit), or up to $${aggMaxBid} (1.7x ROI / +$${aggProfit} profit).`;
        }
    } else {
        if (currentLanded <= balTargetLanded) {
            verdict = 'BUY_NOW';
            advice = `Acquire if landed cost stays under $${balTargetLanded} (Asking: $${currentPrice.toFixed(2)}) for healthy ~2.2x profit (netting ~$${balProfit} cash) in a boutique setting.`;
        } else if (currentLanded <= aggTargetLanded) {
            verdict = 'NEGOTIATE';
            advice = `Asking price ($${currentPrice.toFixed(2)}) yields tighter 1.7x ROI netting ~$${currentProfit} cash. Negotiate or offer $${balMaxBid} to hit standard ~2.2x margin.`;
        } else {
            verdict = 'PASS';
            advice = `Asking price ($${currentPrice.toFixed(2)}) plus shipping exceeds allowable ceiling ($${aggTargetLanded}). Pass unless priced lower.`;
        }
    }
    
    const bestChannel = "Memory Den - Huck's Adventures Outfitters";

    // Build lot items breakdown if multi-piece lot
    const lotItems = isMultiLot ? Array.from({ length: Math.min(lotCount, 20) }).map((_, idx) => {
        const itemName = `${title} - Item #${idx + 1}`;
        return {
            name: itemName,
            identity: itemName,
            tag_title: `Piece #${idx + 1} - ${title}`.slice(0, 40).trim(),
            condition: 'Good',
            tier: idx === 0 ? 'showcase' : 'core',
            split_cost_basis: `$${(maxLandedCost / lotCount).toFixed(2)}`,
            pricing_potential: {
                boutique: `$${perItemBoutiqueLow} - $${perItemBoutiqueHigh}`,
                fair: `$${perItemFairLow} - $${perItemFairHigh}`
            },
            price_breakdown: {
                fair: `$${perItemFairLow} - $${perItemFairHigh}`,
                boutique_premium: `$${perItemBoutiqueLow} - $${perItemBoutiqueHigh}`,
                mint: `$${Math.round(perItemBoutiqueHigh * 1.25)}`,
                poor: `$${Math.round(perItemFairLow * 0.4)}`
            },
            buy_range: `$${Math.max(1, Math.floor(perItemFairLow * 0.25))} - $${Math.max(2, Math.round(perItemFairHigh * 0.40))}`,
            estimated_value: `$${perItemFairLow} - $${perItemFairHigh}`
        };
    }) : undefined;

    const fallbackItem = {
        identity: title,
        title: title,
        category: parsedListingData.categoryParentList || parsedListingData.category || 'Collectibles & Memorabilia',
        tag_title: title.slice(0, 40),
        condition: 'Good',
        tier: currentPrice > 50 || isMultiLot ? 'core' : 'quick_turn',
        purchase_strategy: {
            verdict: verdict,
            current_asking_price: currentAskingStr,
            max_landed_cost: maxLandedCost,
            max_bid: maxBid,
            advice: advice,
            bidding_tiers: {
                conservative: { roi: 3.0, max_bid: consMaxBid, max_landed: consTargetLanded, net_profit: consProfit },
                balanced: { roi: 2.2, max_bid: balMaxBid, max_landed: balTargetLanded, net_profit: balProfit },
                aggressive: { roi: 1.7, max_bid: aggMaxBid, max_landed: aggTargetLanded, net_profit: aggProfit }
            }
        },
        why_pay_up: `Sourced directly from verified listing: ${title}. ${lotCount > 1 ? `Multi-item ${lotCount}-piece lot offers high aggregate retail yield when split into individual booth inventory ($${(maxLandedCost / lotCount).toFixed(2)}/item max cost basis).` : 'Strong demand for authentic collectibles in physical boutique booths and online channels.'}`,
        why_pass: `Inspect all listing photos carefully for condition, signatures, or wear before bidding.`,
        pricing_potential: {
            boutique: `$${boutiqueLow} - $${boutiqueHigh}`,
            fair: `$${fairLow} - $${fairHigh}`
        },
        price_breakdown: {
            fair: `$${fairLow} - $${fairHigh}`,
            boutique_premium: `$${boutiqueLow} - $${boutiqueHigh}`,
            mint: `$${boutiqueHigh} - $${Math.round(boutiqueHigh * 1.3)}`,
            poor: `$${Math.round(fairLow * 0.4)} - $${fairLow}`
        },
        market_report: {
            best_platform: bestChannel,
            sell_through_velocity: isMultiLot ? 'Fast (< 7 days)' : 'Moderate (2-4 weeks)',
            platform_rationale: isMultiLot ? `Splitting this ${lotCount}-piece collection into individual $${perItemBoutiqueLow}-$${perItemBoutiqueHigh} booth pieces yields 3x-4x aggregate return at Memory Den.` : 'Physical boutique booth audience appreciates vintage and curated collectibles with immediate shelf appeal.',
            channels: [
                {
                    name: "Memory Den - Huck's Adventures Outfitters",
                    est_price: `$${boutiqueLow} - $${boutiqueHigh}`,
                    recommendation: isMultiLot ? `Split into ${lotCount} Booth Singles` : 'Best Physical Channel / Boutique Premium',
                    net_payout: `$${Math.round(boutiqueLow * 0.85)} - $${Math.round(boutiqueHigh * 0.85)} (after 15% comm.)`
                },
                {
                    name: 'eBay',
                    est_price: `$${fairLow} - $${fairHigh}`,
                    recommendation: 'Wider Audience Reach / Fair Market Value',
                    net_payout: `$${Math.round(fairLow * 0.87)} - $${Math.round(fairHigh * 0.87)} (after fees/shipping)`
                }
            ]
        },
        lot_items: lotItems,
        fetched_image: successfulImageUrl || (scrapedImages.length > 0 ? scrapedImages[0] : null),
        fetched_images: scrapedImages,
        shipping_info: effectiveShipping,
        notes: `Imported from verified listing: ${title}${lotCount > 1 ? ` (${lotCount}-piece lot)` : ''}`
    };

    return {
        items: [fallbackItem],
        summary: `Listing imported: ${title}`
    };
}

// Resilient General Fallback Factory: Ensures an intake report is ALWAYS usable even if Gemini vision fails or blocks
function createGenericFallback(notes: string, successfulImageUrl: string | null, scrapedImages: string[], warningReason?: string) {
    // Strip all internal system annotations across newlines (e.g. [Organization Sales Channels...], [Deep Parse...], [Shipping...])
    const sanitizedNotes = (notes || '')
        .replace(/\[Organization Sales Channels:[\s\S]*?\]/gi, '')
        .replace(/\[Deep Parse[\s\S]*?\]/gi, '')
        .replace(/\[Shipping:[\s\S]*?\]/gi, '')
        .trim();
    const rawNoteFirstLine = sanitizedNotes ? sanitizedNotes.split('\n')[0].replace(/https?:\/\/[^\s]+/g, '').replace(/\[[^\]]*\]/g, '').trim() : '';
    const cleanTitle = (rawNoteFirstLine && rawNoteFirstLine.length > 2 && !rawNoteFirstLine.startsWith('[')) 
        ? rawNoteFirstLine.slice(0, 50) 
        : 'Unidentified Item (Photo Draft)';
    return {
        warning: warningReason || undefined,
        items: [{
            identity: cleanTitle,
            title: cleanTitle,
            category: 'Uncategorized',
            tag_title: cleanTitle.slice(0, 40),
            condition: 'Good',
            tier: 'core',
            purchase_strategy: {
                verdict: 'WATCH',
                current_asking_price: '',
                max_landed_cost: 0,
                max_bid: 0,
                advice: warningReason 
                    ? `⚠️ ${warningReason} Photo preserved. Enter your title and price manually.`
                    : 'AI vision was unable to appraise this item automatically. Photo preserved for manual pricing.'
            },
            why_pay_up: 'Inspect physical markings, tags, or hallmarks on the item to verify value.',
            why_pass: 'Manual verification recommended before committing.',
            pricing_potential: {
                boutique: '',
                fair: ''
            },
            price_breakdown: {
                fair: '',
                boutique_premium: '',
                mint: '',
                poor: ''
            },
            market_report: {
                best_platform: "Memory Den - Huck's Adventures Outfitters",
                sell_through_velocity: 'Moderate (2-4 weeks)',
                platform_rationale: 'Review item category and assign appropriate sales channel.',
                channels: []
            },
            fetched_image: successfulImageUrl || (scrapedImages.length > 0 ? scrapedImages[0] : null),
            fetched_images: scrapedImages,
            notes: sanitizedNotes || ''
        }],
        summary: `Item drafted: ${cleanTitle}`
    };
}

// Handle both POST and PUT, plus OPTIONS for CORS
export const ALL: APIRoute = async ({ request }) => {
    
    // 1. Handle Preflight / CORS
    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, PUT, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, X-Client-Claim",
            }
        });
    }

    if (request.method !== "POST" && request.method !== "PUT") {
         return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
    }

    // SCOPED OUTSIDE TRY: Accessible in both try and catch blocks
    let imageParts: Array<{ inlineData: { data: string; mimeType: string } }> = [];
    let successfulImageUrl: string | null = null;
    let scrapedImages: string[] = [];
    let scrapedShipping: any = null;
    let scrapedAuctionMeta: any = null;
    let zipCode: string | null = null;
    let parsedListingData: any = null;
    let userNotes = "";
    let scrapedListingContext = "";
    let shippingSummary = "";

    try {
        if (!model) {
            console.error("Gemini model not initialized.");
            return new Response(JSON.stringify({ error: 'Gemini not configured', details: 'Missing GEMINI_API_KEY' }), { 
                status: 500,
                headers: { "Access-Control-Allow-Origin": "*" } 
            });
        }

        // Debug logging
        const urlObj = new URL(request.url);
        const expectedLen = urlObj.searchParams.get("len");
        console.log(`Debug - URL Received: ${request.url}`);
        console.log(`Debug - Using Model: ${DEFAULT_GEMINI_MODEL}`);
        // Helper 3b: Fetch Image from URL and add to parts
        const fetchAndAddImage = async (imgUrl: string) => {
             if(!imgUrl) return;
             try {
                console.log(`Debug - Fetching Image: ${imgUrl}`);
                
                // Spoof referer matching the image host to bypass hotlink prevention
                let referer = undefined;
                try {
                    const u = new URL(imgUrl);
                    referer = u.origin + '/';
                } catch(e){}
                
                const headers: Record<string, string> = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
                };
                if (referer) {
                    headers['Referer'] = referer;
                }

                const isAppwrite = imgUrl.includes('/storage/buckets/');
                const candidateUrls: string[] = [];

                if (isAppwrite) {
                    const projectId = process.env.PUBLIC_APPWRITE_PROJECT_ID || '69714b35003a8adab6bb';
                    const apiKey = process.env.APPWRITE_API_KEY;
                    if (projectId) headers['X-Appwrite-Project'] = projectId;
                    // Do NOT pass X-Appwrite-Key by default for public storage!

                    try {
                        const parsed = new URL(imgUrl);
                        const existingProj = parsed.searchParams.get('project') || projectId;
                        // Optimized 1000px preview first to stay well within Gemini 20MB payload limit
                        const preview = new URL(parsed.toString());
                        preview.pathname = preview.pathname.replace(/\/view$/, '/preview');
                        preview.searchParams.set('width', '1000');
                        preview.searchParams.set('height', '1000');
                        preview.searchParams.set('output', 'webp');
                        preview.searchParams.set('quality', '80');
                        preview.searchParams.set('project', existingProj);
                        candidateUrls.push(preview.toString());

                        // View fallback
                        const view = new URL(parsed.toString());
                        view.searchParams.set('project', existingProj);
                        candidateUrls.push(view.toString());
                    } catch {
                        candidateUrls.push(imgUrl);
                    }
                } else {
                    candidateUrls.push(imgUrl);
                }
                
                let res: Response | null = null;
                for (const cUrl of candidateUrls) {
                    try {
                        const attempt = await fetch(cUrl, { headers, signal: AbortSignal.timeout(10000) });
                        if (attempt.ok) {
                            res = attempt;
                            break;
                        } else if ((attempt.status === 401 || attempt.status === 403) && isAppwrite && process.env.APPWRITE_API_KEY) {
                            try {
                                const authAttempt = await fetch(cUrl, {
                                    headers: { ...headers, 'X-Appwrite-Key': process.env.APPWRITE_API_KEY },
                                    signal: AbortSignal.timeout(10000)
                                });
                                if (authAttempt.ok) {
                                    res = authAttempt;
                                    break;
                                }
                            } catch {}
                        }
                    } catch (e) {}
                }
                
                if(res && res.ok) {
                    const arrayBuffer = await res.arrayBuffer();
                    
                    // Robust helper to converting ArrayBuffer to Base64 in any env
                    const toBase64 = (buffer: ArrayBuffer) => {
                        let binary = '';
                        const bytes = new Uint8Array(buffer);
                        const len = bytes.byteLength;
                        for (let i = 0; i < len; i++) {
                            binary += String.fromCharCode(bytes[i]);
                        }
                        if (typeof btoa === 'function') {
                            return btoa(binary);
                        }
                        if (typeof globalThis.Buffer !== 'undefined') {
                            // @ts-ignore
                            return globalThis.Buffer.from(buffer).toString('base64');
                        }
                        return '';
                    };

                    const base64 = toBase64(arrayBuffer);
                    
                    if (base64) {
                        // Detect mime
                        let mime = res.headers.get('content-type');
                        
                        // Forcefully validate mime before pushing
                        if (!mime || mime === 'application/octet-stream' || !mime.startsWith('image/')) {
                             // Attempt to infer or default
                             console.log("Debug - Forcing octet-stream to image/jpeg");
                             mime = 'image/jpeg';
                        }
                        
                        // Double check
                        if (!mime.startsWith('image/')) {
                             console.warn(`Debug - Invalid Mime for Gemini: ${mime}, skipping.`);
                             return; // Skip adding this part
                        }
                        
                        imageParts.push({
                            inlineData: {
                                data: base64,
                                mimeType: mime
                            }
                        });
                        successfulImageUrl = imgUrl; // Track success
                        console.log(`Debug - Successfully added image part. Mime: ${mime}, Length: ${base64.length}`);
                    }
                } else {
                    console.warn(`Debug - Image fetch status: ${res.status}`);
                }
             } catch(e) {
                 console.warn(`Failed to fetch external image: ${imgUrl}`, e);
             }
        };

        // 2. Read Body
        let rawBody = "";
        userNotes = "";

        try {
            const ab = await request.arrayBuffer();
            if (ab.byteLength > 0) {
                rawBody = new TextDecoder().decode(ab);
            } else {
                // Fallback attempt
                rawBody = await request.text();
            }
        } catch (readError: any) {
            console.error("Debug - Failed to read request body:", readError);
            return new Response(JSON.stringify({ 
                error: "Read Failed", 
                details: `Server could not read request stream: ${readError.message}` 
            }), { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
        }

        console.log(`Debug - Body Length Read: ${rawBody ? rawBody.length : 0} | Expected: ${expectedLen}`);

        if (!rawBody || rawBody.length === 0) {
            return new Response(JSON.stringify({ 
                error: "Empty Body", 
                details: `Server received 0 bytes. (Expected: ${expectedLen}). URL: ${request.url}` 
            }), { 
                status: 400,
                headers: { "Access-Control-Allow-Origin": "*" } 
            });
        }
        
        // imageParts already declared at top of file

        if (rawBody.trim().startsWith("data:")) {
            // Option 1: Raw Data URL string (text/plain) - Single Image
            const parts = rawBody.split(",");
            const match = parts[0].match(/:(.*?);/);
            const mime = match ? match[1] : "image/jpeg";
            imageParts.push({
                inlineData: {
                    data: parts[1],
                    mimeType: mime
                }
            });
        } else if (rawBody.trim().startsWith("{")) {
            // Option 2: JSON payload
            try {
                const json = JSON.parse(rawBody);
                
                // Extract User Notes if present
                if (json.notes) {
                    userNotes = json.notes;
                }

                if (json.zipCode) {
                    zipCode = String(json.zipCode).trim();
                }
                
                // Helper to process a single data-url string
                const processDataUrl = (url: string) => {
                     if (url.startsWith("data:")) {
                         const parts = url.split(",");
                         const match = parts[0].match(/:(.*?);/);
                         let mime = match ? match[1] : "image/jpeg";
                         
                         // Robust Mime Validation (prevent 500s)
                         if (!mime || mime === 'application/octet-stream' || !mime.startsWith('image/')) {
                             mime = 'image/jpeg';
                         }
                         
                         return {
                             inlineData: {
                                 data: parts[1],
                                 mimeType: mime
                             }
                         };
                     }
                     return null;
                };

                // Check for 'images' array
                if (Array.isArray(json.images)) {
                    json.images.forEach((img: string) => {
                        const part = processDataUrl(img);
                        if (part) imageParts.push(part);
                    });
                } 
                // Fallback check for single 'image'
                else if (json.image) {
                     const part = processDataUrl(json.image);
                     if (part) imageParts.push(part);
                }
                
                // NEW: Allow passing direct 'imageUrl'
                if (json.imageUrl && imageParts.length === 0) {
                    scrapedImages = [json.imageUrl];
                    await fetchAndAddImage(json.imageUrl);
                }
                
                // Allow passing an array of remote URLs (e.g. from Appwrite) - Full Lot Support up to 40 photos
                if (Array.isArray(json.remoteImageUrls)) {
                    scrapedImages = json.remoteImageUrls.slice(0, 40);
                    const promises = json.remoteImageUrls.slice(0, 40 - imageParts.length).map((imgUrl: string) => fetchAndAddImage(imgUrl));
                    await Promise.all(promises);
                }
                
                // Auto-load organization locations with niches & watch tags (e.g. Memory Den, DustyTiger)
                let targetLocations = Array.isArray(json.locations) && json.locations.length > 0 ? json.locations : [];
                if (targetLocations.length === 0) {
                    try {
                        const endpoint = process.env.PUBLIC_APPWRITE_ENDPOINT || import.meta.env.PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
                        const projectId = process.env.PUBLIC_APPWRITE_PROJECT_ID || import.meta.env.PUBLIC_APPWRITE_PROJECT_ID || '';
                        const dbId = process.env.PUBLIC_APPWRITE_DB_ID || import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
                        const apiKey = process.env.APPWRITE_API_KEY || import.meta.env.APPWRITE_API_KEY;

                        if (projectId && apiKey) {
                            const { Client, Databases } = await import('node-appwrite');
                            const serverClient = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
                            const serverDb = new Databases(serverClient);
                            const whRes = await serverDb.listDocuments(dbId, 'warehouses');
                            if (whRes.documents && whRes.documents.length > 0) {
                                targetLocations = whRes.documents;
                            }
                        }
                    } catch (whErr) {
                        console.warn('[identify-item] Auto-load warehouses fallback failed:', whErr);
                    }
                }

                if (targetLocations.length > 0) {
                    const locNames = targetLocations.map((l: any) => {
                        let desc = `${l.name} (Type: ${l.type || 'Physical'}`;
                        if (l.commissionRate !== undefined) desc += `, ${l.commissionRate}% comm.`;
                        if (l.categories || l.niche) desc += `, Niche/Specialties: "${l.categories || l.niche}"`;
                        desc += `)`;
                        return desc;
                    }).join('; ');
                    userNotes = userNotes ? `${userNotes}\n\n[Organization Sales Channels: ${locNames}]` : `[Organization Sales Channels: ${locNames}]`;
                }

            } catch (e) {
                console.error("JSON parse failed", e);
            }
        } 

        // 3. Smart URL Handling (The "Scout Link" Feature)
        // 3. Smart URL Handling (Deep Listing Analysis)
        if (userNotes) {
            const urlMatch = userNotes.match(/https?:\/\/[^\s]+/);
            if (urlMatch) {
                let targetUrl = urlMatch[0];
                console.log(`Debug - Found URL for Deep Parse: ${targetUrl}`);
                
                // Resolve eBay short URL redirects
                if (/ebay\.io/i.test(targetUrl)) {
                    try {
                        console.log(`Debug - Resolving eBay short URL redirect: ${targetUrl}`);
                        const redirectRes = await fetch(targetUrl, { method: 'GET', redirect: 'manual' });
                        const location = redirectRes.headers.get('location');
                        if (location) {
                            targetUrl = location;
                            console.log(`Debug - Resolved eBay short URL to: ${targetUrl}`);
                        }
                    } catch (e) {
                        console.error("Failed to resolve eBay short URL redirect", e);
                    }
                }
                
                const isEbay = /ebay\.(com|io|ca|co\.uk|com\.au|de|fr|it|es|nl|be|ch|at|pl|ie)/i.test(targetUrl);
                
                if (isEbay) {
                    if (imageParts.length === 0) {
                        return new Response(JSON.stringify({ 
                            error: "eBay Link Scouting Unsupported", 
                            details: "eBay blocks automated requests. To scout this item, please capture/upload a photo of the item, or describe it in the 'Additional Details' box." 
                        }), { 
                            status: 400,
                            headers: { 
                                "Access-Control-Allow-Origin": "*",
                                "Content-Type": "application/json"
                            } 
                        });
                    } else {
                        console.log("Debug - eBay URL with images, skipping fetch and using image-based analysis.");
                    }
                } else {
                    // A. ShopGoodwill API Strategy (High Fidelity)
                    const sgwMatch = targetUrl.match(/shopgoodwill\.com\/(?:item|viewitem)\/(\d+)/i);
                    if (sgwMatch) {
                        const itemId = sgwMatch[1];
                        let parsedData: any = null;
                        try {
                             const apiRes = await fetch(`https://buyerapi.shopgoodwill.com/api/ItemDetail/GetItemDetailModelByItemId/${itemId}`, {
                                 headers: { 
                                     'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                                     'Origin': 'https://shopgoodwill.com',
                                     'Referer': 'https://shopgoodwill.com/'
                                 }
                             });
                             if (apiRes.ok) {
                                 const itemData = await apiRes.json();
                                 if (itemData && (itemData.title || itemData.itemName)) {
                                      parsedData = itemData;
                                      parsedListingData = itemData;
                                 }
                             }
                        } catch (err) {
                            console.error("Failed Deep SGW Parse", err);
                        }

                        if (parsedData) {
                             const sellerId = parsedData.sellerId || parsedData.seller_id || null;
                             const sellerName = parsedData.sellerName || parsedData.seller_name || parsedData.location || null;
                             const canCombineShipping = parsedData.canCombineShipping !== undefined ? Boolean(parsedData.canCombineShipping) : true;
                             const shippingWeight = parseFloat(parsedData.shippingWeight || parsedData.weight || parsedData.dimensionalWeight || 0) || 0;

                             // Parse multiple images
                             const imgServer = parsedData.imageServer || 'https://shopgoodwillimages.azureedge.net/production/';
                             const imgUrls: string[] = [];
                             if (parsedData.imageUrlString) {
                                 parsedData.imageUrlString.split(';').forEach((p: string) => {
                                     const clean = p.trim().replace(/\\/g, '/');
                                     if (clean) imgUrls.push(imgServer + clean);
                                 });
                             } else if (parsedData.imageURL) {
                                 const fixUrl = (u: string) => u ? (u.startsWith('//') ? 'https:' + u : u) : '';
                                 imgUrls.push(fixUrl(parsedData.imageURL));
                             }
                             
                             if (imgUrls.length > 0) {
                                 successfulImageUrl = imgUrls[0];
                                 scrapedImages = imgUrls.slice(0, 40);
                             }

                             // Calculate Shipping if zipCode is provided
                             if (zipCode) {
                                 try {
                                     console.log(`[Deep Parse - SGW] Calculating shipping to ZIP: ${zipCode}`);
                                     const calcRes = await fetch(`https://buyerapi.shopgoodwill.com/api/ItemDetail/CalculateShipping`, {
                                         method: 'POST',
                                         headers: {
                                             'Content-Type': 'application/json',
                                             'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                                             'Origin': 'https://shopgoodwill.com',
                                             'Referer': 'https://shopgoodwill.com/'
                                         },
                                         body: JSON.stringify({
                                             itemId: parseInt(itemId),
                                             country: "US",
                                             province: null,
                                             zipCode: zipCode,
                                             quantity: 1,
                                             clientIP: "0.0.0.3"
                                         })
                                     });
                                     if (calcRes.ok) {
                                         const htmlText = await calcRes.text();
                                         const shipMatch = htmlText.match(/id=['"]shipping-span['"]>\$([0-9.]+)/i);
                                         const handMatch = htmlText.match(/Handling:\s*\$([0-9.]+)/i);
                                         const totalMatch = htmlText.match(/Total Shipping and Handling:\s*\$([0-9.]+)/i) || 
                                                            htmlText.match(/Total Shipping and Handling:.*?\$([0-9.]+)/is);
                                         const carrierMatch = htmlText.match(/Shipping Carrier:\s*([^<]+)/i);
                                         
                                         if (totalMatch) {
                                             scrapedShipping = {
                                                 shipping: shipMatch ? parseFloat(shipMatch[1]) : 0,
                                                 handling: handMatch ? parseFloat(handMatch[1]) : 0,
                                                 total: parseFloat(totalMatch[1]),
                                                 carrier: carrierMatch ? carrierMatch[1].trim() : 'FedEx',
                                                 zipCode: zipCode,
                                                 weight: shippingWeight,
                                                 sellerId: sellerId,
                                                 sellerName: sellerName,
                                                 canCombineShipping: canCombineShipping
                                             };
                                             console.log(`[Deep Parse - SGW] Calculated Shipping Total: $${scrapedShipping.total}`);
                                         }
                                     }
                                 } catch (calcErr) {
                                     console.error("Failed SGW CalculateShipping", calcErr);
                                 }
                             }

                             let contextText = `[Deep Parse - ShopGoodwill]\n`;
                             contextText += `Title: ${parsedData.title || parsedData.itemName}\n`;
                             contextText += `Seller: ${sellerName || 'Goodwill Regional'} (ID: ${sellerId || 'N/A'})\n`;
                             contextText += `Weight: ${shippingWeight} lbs | Combined Shipping: ${canCombineShipping ? 'Eligible' : 'Ineligible'}\n`;
                             contextText += `Current Bid: $${parsedData.currentPrice} | Bids: ${parsedData.bidCount} | Ends: ${parsedData.endTime}\n`;
                             if (scrapedShipping) {
                                 shippingSummary = `Estimated Shipping: $${scrapedShipping.total} (${scrapedShipping.carrier}) to ZIP ${scrapedShipping.zipCode} (Shipping: $${scrapedShipping.shipping}, Handling: $${scrapedShipping.handling})`;
                                 contextText += shippingSummary + "\n";
                             }
                             
                             if (parsedData.endTime) {
                                 let parsedIso: string | null = null;
                                 try {
                                     const d = new Date(parsedData.endTime);
                                     if (!isNaN(d.getTime())) {
                                         parsedIso = d.toISOString();
                                     }
                                 } catch {}
                                 scrapedAuctionMeta = {
                                     is_auction: true,
                                     end_time: parsedIso,
                                     time_left_text: parsedData.endTime,
                                     current_bid: parseFloat(parsedData.currentPrice) || null,
                                     platform: 'ShopGoodwill',
                                     seller_id: sellerId,
                                     seller_name: sellerName,
                                     shipping_weight: shippingWeight,
                                     can_combine_shipping: canCombineShipping
                                 };
                             }

                             const rawDesc = parsedData.description || "";
                             const cleanDesc = sanitizeListingDescription(rawDesc);
                             if (cleanDesc) {
                                 contextText += `Description: ${cleanDesc}\n\n`;
                             }
                             
                             // Append to scraped listing context (preserving authoritative user notes separation)
                             scrapedListingContext += contextText + "\n";
                             
                             // Fetch all external lot photos up to 40 images for deep multi-issue analysis
                             if (imageParts.length === 0 && imgUrls.length > 0) {
                                 const promises = imgUrls.slice(0, 40).map(u => fetchAndAddImage(u));
                                 await Promise.all(promises);
                             }
                        } else {
                             // Fallback: Fetch public page HTML and parse
                             console.log(`[Deep Parse - SGW] API failed for ${itemId}, falling back to generic page parse.`);
                             try {
                                 const pageRes = await fetch(targetUrl, {
                                     headers: {
                                         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
                                     }
                                 });
                                 if (pageRes.ok) {
                                     const html = await pageRes.text();
                                     const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                                     const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) || 
                                                       html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
                                     
                                     let contextText = `[Deep Parse - ShopGoodwill Generic]\n`;
                                     if (titleMatch) contextText += `Title: ${titleMatch[1].replace('| ShopGoodwill.com', '').trim()}\n`;
                                     if (descMatch) contextText += `Description: ${descMatch[1].substring(0, 1000)}\n`;
                                     
                                     scrapedListingContext += contextText + "\n";
                                     
                                     // Try to extract images from page
                                     if (imageParts.length === 0) {
                                         const imageUrls = new Set<string>();
                                         const ogMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
                                         const fixUrl = (u: string) => u ? (u.startsWith('//') ? 'https:' + u : u) : '';
                                         if (ogMatch) imageUrls.add(fixUrl(ogMatch[1]));
                                         
                                         const imgRegex = /src=["'](https?:\/\/[^"']*\.azureedge\.net\/[^"']*)["']/g;
                                         let match;
                                         let count = 0;
                                         while ((match = imgRegex.exec(html)) !== null && count < 10) {
                                             const src = fixUrl(match[1]);
                                             // Clean backslashes to forward slashes for the remote image url
                                             const cleanSrc = src.replace(/\\/g, '/');
                                             if (!cleanSrc.includes('Logo.svg') && !cleanSrc.includes('General/')) {
                                                 imageUrls.add(cleanSrc);
                                             }
                                             count++;
                                         }
                                         
                                         const topImages = Array.from(imageUrls).slice(0, 5);
                                         if (topImages.length > 0) {
                                             if (!successfulImageUrl) successfulImageUrl = topImages[0];
                                             scrapedImages = topImages;
                                         }
                                         
                                         if (imageParts.length === 0) {
                                             const promises = topImages.slice(0, 3).map(imgUrl => fetchAndAddImage(imgUrl));
                                             await Promise.all(promises);
                                         }
                                     }
                                 }
                             } catch (e) {
                                 console.error("Failed SGW fallback parse", e);
                             }
                        }
                    }
                    // B. Other Platform-Specific or Generic Scrapes
                    else {
                         try {
                            const pageRes = await fetch(targetUrl, { 
                                headers: { 
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36' 
                                } 
                            });
                            if (pageRes.ok) {
                                const html = await pageRes.text();
                                
                                let scrapedData: any = null;
                                const finalUrl = (pageRes.url || targetUrl).toLowerCase();
                                
                                if (finalUrl.includes('ctbids.com') || targetUrl.includes('ctbids.com')) {
                                    scrapedData = parseCTBids(html);
                                } else if (finalUrl.includes('hibid.com') || targetUrl.includes('hibid.com')) {
                                    scrapedData = parseHiBid(html);
                                } else if (finalUrl.includes('facebook.com') || targetUrl.includes('facebook.com')) {
                                    scrapedData = parseFacebookMarketplace(html);
                                } else if (finalUrl.includes('poshmark.com') || targetUrl.includes('poshmark.com')) {
                                    scrapedData = parsePoshmark(html);
                                } else if (finalUrl.includes('mercari.com') || targetUrl.includes('mercari.com')) {
                                    scrapedData = parseMercari(html);
                                }
                                
                                let contextText = '';
                                const imageUrls = new Set<string>();
                                
                                if (scrapedData) {
                                    contextText = `[Deep Parse - ${scrapedData.platform}]\n`;
                                    contextText += `Title: ${scrapedData.title}\n`;
                                    if (scrapedData.price) contextText += `Asking/Current Price: ${scrapedData.price}\n`;
                                    if (scrapedData.timeLeft) contextText += `Time Left / Ending: ${scrapedData.timeLeft}\n`;
                                    if (scrapedData.buyersPremium) contextText += `Buyer's Premium: ${scrapedData.buyersPremium}\n`;
                                    if (scrapedData.terms) contextText += `Terms: ${scrapedData.terms}\n`;
                                    if (scrapedData.brand) contextText += `Brand: ${scrapedData.brand}\n`;
                                    if (scrapedData.location) contextText += `Location: ${scrapedData.location}\n`;

                                    if (scrapedData.platform === 'CTBids' || scrapedData.platform === 'HiBid') {
                                        scrapedAuctionMeta = {
                                            is_auction: true,
                                            platform: scrapedData.platform,
                                            time_left_text: scrapedData.timeLeft || null,
                                            buyers_premium_pct: parseFloat(scrapedData.buyersPremium) || 15,
                                            current_bid: scrapedData.price ? parseFloat(scrapedData.price.replace(/[^0-9.]/g, '')) || null : null,
                                            is_local_pickup_only: String(scrapedData.terms).toLowerCase().includes('local pickup only')
                                        };
                                    }
                                    if (scrapedData.shipping) {
                                        contextText += `Shipping: ${scrapedData.shipping}\n`;
                                        
                                        const rawShip = scrapedData.shipping;
                                        if (rawShip.toLowerCase().includes('free')) {
                                            scrapedShipping = { shipping: 0, handling: 0, total: 0, carrier: 'eBay logistics', message: 'Free Shipping' };
                                        } else {
                                            const matches = rawShip.match(/[0-9.]+/);
                                            if (matches) {
                                                const amt = parseFloat(matches[0]);
                                                scrapedShipping = { shipping: amt, handling: 0, total: amt, carrier: 'eBay logistics', message: rawShip };
                                            }
                                        }
                                    }
                                    if (scrapedData.description) contextText += `Description: ${scrapedData.description.substring(0, 1500)}\n`;
                                    contextText += `\n`;
                                    
                                    scrapedData.images.forEach((img: string) => imageUrls.add(img));
                                } else {
                                    // C. Generic Full-Page Scrape (Fallback)
                                    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                                    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
                                    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) || 
                                                      html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) || 
                                                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
                                    
                                    contextText = `[Deep Parse - Generic URL]\n`;
                                    if (ogTitleMatch) contextText += `Title: ${ogTitleMatch[1]}\n`;
                                    else if (titleMatch) contextText += `Title: ${titleMatch[1]}\n`;
                                    if (descMatch) contextText += `Description: ${descMatch[1].substring(0, 1000)}\n`;
                                    
                                    // Extract Structured JSON-LD Data (Critical for Pricing/Bids on obscure platforms)
                                    const ldRegex = /<script type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
                                    let ldMatch;
                                    let structuredData = '';
                                    while ((ldMatch = ldRegex.exec(html)) !== null) {
                                        structuredData += ldMatch[1] + '\n';
                                    }
                                    if (structuredData) {
                                        // Keep the first 1500 characters of structured data to prevent prompt bloat while grabbing price metadata
                                        contextText += `Structured Data: ${structuredData.substring(0, 1500)}\n`;
                                    }
                                    
                                    // Extract Images (Max 5)
                                    const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
                                    const fixUrl = (u: string) => {
                                        if (!u) return '';
                                        let fixed = u.replace(/&amp;/g, '&');
                                        return fixed.startsWith('//') ? 'https:' + fixed : fixed;
                                    };
                                    
                                    if(ogMatch) imageUrls.add(fixUrl(ogMatch[1]));
                                    
                                    // Extract SGW app-image-gallery (High Quality Gallery fallback for Angular)
                                    const galleryRegex = /<app-image-gallery[^>]*\[itemImages\]=["']([^"']*)["']/i; 
                                    const galleryMatch = html.match(galleryRegex);
                                    if (galleryMatch) {
                                        try {
                                            const jsonStr = galleryMatch[1].replace(/&quot;/g, '"');
                                            const parsed = JSON.parse(jsonStr);
                                            if (Array.isArray(parsed)) {
                                                parsed.forEach((img: any) => {
                                                     const u = img.imageURL || img.url || img;
                                                     if (u && typeof u === 'string') imageUrls.add(fixUrl(u));
                                                });
                                            }
                                        } catch (e) {}
                                    }

                                    const imgRegex = /<img[^>]+src=["'](https:\/\/[^"'\s]+|\/\/[^"'\s]+)["'][^>]*>/gi;
                                    let match;
                                    let count = 0;
                                    while ((match = imgRegex.exec(html)) !== null && count < 20) {
                                        const src = fixUrl(match[1]);
                                        if (src.match(/\.(jpg|jpeg|png|webp)(\?|&|$)/i) && !src.includes('logo') && !src.includes('icon')) {
                                             imageUrls.add(src);
                                        }
                                        count++;
                                    }
                                }
                                
                                scrapedListingContext += contextText + "\n";

                                scrapedImages = Array.from(imageUrls).slice(0, 5);
                                if (scrapedImages.length > 0 && !successfulImageUrl) {
                                    successfulImageUrl = scrapedImages[0];
                                }

                                // ONLY fetch external images if the client didn't provide any
                                if (imageParts.length === 0) {
                                    const topImages = scrapedImages.slice(0, 3);
                                    const promises = topImages.map(imgUrl => fetchAndAddImage(imgUrl));
                                    await Promise.all(promises);
                                }
                            } else {
                                if (imageParts.length === 0) {
                                    return new Response(JSON.stringify({ 
                                        error: "Scouting Failed", 
                                        details: `Unable to access URL (Status: ${pageRes.status}). Please upload a photo or enter details manually.` 
                                    }), { 
                                        status: 400,
                                        headers: { 
                                            "Access-Control-Allow-Origin": "*",
                                            "Content-Type": "application/json"
                                        } 
                                    });
                                }
                            }
                         } catch(e: any) { 
                             console.warn("Deep Scrape failed", e);
                             if (imageParts.length === 0) {
                                 return new Response(JSON.stringify({ 
                                     error: "Scouting Failed", 
                                     details: `Failed to connect to the provided URL. Please upload a photo or enter details manually.` 
                                 }), { 
                                     status: 400,
                                     headers: { 
                                         "Access-Control-Allow-Origin": "*",
                                         "Content-Type": "application/json"
                                     } 
                                 });
                             }
                         }
                    }
                }
            }
        }

        // Relaxed Check: Allow if images exist OR if we have notes or scraped listing context
        if (imageParts.length === 0 && !userNotes && !scrapedListingContext) {
                 return new Response(JSON.stringify({ error: "Parsing Failed", details: "No image data AND no notes found in body." }), { 
                    status: 400,
                    headers: { "Access-Control-Allow-Origin": "*" }
                });
        }

        const promptText = buildSpeedScoutUserPrompt({
            authoritativeUserNotes: userNotes,
            scrapedListingContext: scrapedListingContext || undefined,
            shippingSummary: shippingSummary || (scrapedShipping ? `Estimated Shipping: $${scrapedShipping.total} (${scrapedShipping.carrier}) to ZIP ${scrapedShipping.zipCode || 'Local'}` : undefined),
            organizationChannels: "Memory Den Booth #0EJ (Vintage Apparel, RPGs, Books, Media, Collectibles); DustyTiger (Small Collectibles, Jewelry, Pins, Wands); eBay; Poshmark."
        });

        const contentParts: any[] = [{ text: promptText }];
        if (imageParts.length > 0) {
            // Cap to top 5 images for Speed Scout to keep payload < 5MB and prevent API payload limits or timeouts
            contentParts.push(...imageParts.slice(0, 5));
        }

        const result = await generateContentWithBackoff({
            systemInstruction: SPEED_SCOUT_SYSTEM_INSTRUCTION,
            contents: [{ role: 'user', parts: contentParts }],
            generationConfig: { 
                responseMimeType: "application/json",
                responseSchema: speedScoutResponseSchema
            }
        }, 3, 2000); // Only retry 3 times for real-time frontend calls to prevent 2.5 minute UI hangs
        
        const response = await result.response;
        
        let taskResponse = '';
        try {
            taskResponse = response.text();
        } catch (textErr: any) {
            console.warn('[Gemini] response.text() failed, inspecting candidate parts:', textErr);
            const candidate = response.candidates?.[0];
            const parts = (candidate?.content?.parts || []) as any[];
            taskResponse = parts.map((p: any) => p.text || '').join('').trim();
            if (!taskResponse) {
                if (parsedListingData) {
                    console.warn(`[Gemini] Model response blocked (${candidate?.finishReason || 'Unknown'}). Utilizing verified listing fallback.`);
                    const fallbackData = createListingFallback(parsedListingData, scrapedShipping, successfulImageUrl, scrapedImages);
                    taskResponse = JSON.stringify(fallbackData);
                } else {
                    console.warn(`[Gemini] Model response blocked (${candidate?.finishReason || 'Unknown'}). Utilizing generic fallback.`);
                    const fallbackData = createGenericFallback(userNotes, successfulImageUrl, scrapedImages);
                    taskResponse = JSON.stringify(fallbackData);
                }
            }
        }
        
        // Clean up potential markdown code blocks ```json ... ```
        let cleanedResponse = taskResponse.replace(/```json|```/g, '').trim();

        // Inject fetched image URLs, shipping info, and auction metadata into response if available
        try {
            const jsonObj = JSON.parse(cleanedResponse);

            const normalizeAuctionFields = (target: any) => {
                if (!target) return;
                if (scrapedAuctionMeta) {
                    target.auction_meta = { ...target.auction_meta, ...scrapedAuctionMeta };
                }
                if (target.auction_meta) {
                    if (target.auction_meta.end_time) {
                        target.auctionEndsAt = target.auction_meta.end_time;
                    }
                    if (target.auction_meta.current_bid !== undefined && target.auction_meta.current_bid !== null) {
                        target.currentBid = target.auction_meta.current_bid;
                    }
                }
                if (target.purchase_strategy?.max_bid) {
                    target.maxBid = target.purchase_strategy.max_bid;
                }
                if (target.lot_items && Array.isArray(target.lot_items) && target.lot_items.length > 1) {
                    const lotResaleSum = target.lot_items.reduce((s: number, it: any) => {
                        return s + parsePriceValue(it.price_breakdown?.boutique_premium || it.price_breakdown?.fair || it.estimated_value, 'midpoint', 0);
                    }, 0);
                    if (lotResaleSum > 0) {
                        target.total_lot_resale = lotResaleSum;
                    }

                    // The Buy-Target Authority Law: Stop overwriting AI condition-adjusted buy targets with blind Boutique divisors!
                    let compBuyMax = 0;
                    let compBuyMin = 0;
                    let lotFairSum = 0;
                    let hasConditionDefects = false;

                    for (const it of target.lot_items) {
                        const br = it.buy_range;
                        if (br && typeof br.max === 'number' && br.max > 0) {
                            compBuyMax += br.max;
                            compBuyMin += (typeof br.min === 'number' ? br.min : 0);
                        } else {
                            const parsedBr = parsePriceRange(it.buy_range?.formatted || it.buy_range);
                            compBuyMax += parsedBr.high;
                            compBuyMin += parsedBr.low;
                        }

                        const fair = parsePriceRange(it.pricing_potential?.fair || it.price_breakdown?.fair || it.estimated_value);
                        const fairMid = fair.high > 0 ? (fair.low + fair.high) / 2 : fair.low;
                        lotFairSum += fairMid;

                        const cond = String(it.condition || '').toLowerCase();
                        const notes = String(it.condition_notes || it.name || it.identity || '').toLowerCase();
                        if (
                            cond.includes('fair') || cond.includes('poor') || cond.includes('damaged') ||
                            notes.includes('empty') || notes.includes('box only') || notes.includes('parts') ||
                            notes.includes('writing') || notes.includes('ink') || notes.includes('defect')
                        ) {
                            hasConditionDefects = true;
                        }
                    }

                    // Condition defect ceiling: Never exceed 50% of eBay Fair Market value when items have defects
                    const defectCeiling = hasConditionDefects && lotFairSum > 0 ? Math.round(lotFairSum * 0.50) : Infinity;

                    // Extract explicit target from advice if present (e.g. "Make a cash offer of $40-$45" -> 45)
                    const adviceText = target.purchase_strategy?.advice || '';
                    const adviceMatch = adviceText.match(/(?:cash\s+offer\s+of|offer\s+of|offer|pay\s+up\s+to|target\s+of|buy\s+at|ceiling\s+of|max\s+bid\s+of)\s+\$(?:(\d+(?:\.\d+)?)\s*[-–—to]\s*\$)?(\d+(?:\.\d+)?)/i);
                    const adviceCeiling = adviceMatch ? parseFloat(adviceMatch[2]) : 0;

                    let resolvedMaxBuy = adviceCeiling > 0 ? adviceCeiling : (target.purchase_strategy?.max_landed_cost || target.purchase_strategy?.max_bid || 0);
                    if (resolvedMaxBuy <= 0 && compBuyMax > 0) {
                        resolvedMaxBuy = compBuyMax;
                    }

                    // Clamping: Never exceed defect ceiling if defects exist
                    if (defectCeiling < Infinity && resolvedMaxBuy > defectCeiling) {
                        resolvedMaxBuy = defectCeiling;
                    }

                    // Never allow ungrounded inflation above compBuyMax
                    if (compBuyMax > 0 && resolvedMaxBuy > compBuyMax * 1.15) {
                        resolvedMaxBuy = compBuyMax;
                    }

                    const isAuction = Boolean(target.auction_meta?.is_auction || target.auctionEndsAt || target.auction_meta?.end_time);
                    const shipTotal = Number(target.shipping_info?.total || scrapedShipping?.total || 0);

                    if (target.purchase_strategy) {
                        target.purchase_strategy.max_landed_cost = resolvedMaxBuy;
                        if (isAuction) {
                            const maxBidNet = Math.max(0, Math.floor(resolvedMaxBuy - shipTotal));
                            target.purchase_strategy.max_bid = maxBidNet;
                            target.maxBid = maxBidNet;
                            const proxyCeiling = maxBidNet > 0 ? maxBidNet + 0.87 : 0;
                            if (target.purchase_strategy.advice && proxyCeiling > 0) {
                                target.purchase_strategy.advice = target.purchase_strategy.advice.replace(
                                    /(?:do not chase past|chase past|bid up to|max bid of|ceiling of|cap of|do not exceed)\s+\$\d+(?:\.\d+)?/gi,
                                    `do not chase past $${proxyCeiling.toFixed(2)}`
                                );
                            }
                        } else {
                            target.purchase_strategy.max_bid = resolvedMaxBuy;
                            target.maxBid = resolvedMaxBuy;
                        }
                    }
                }
                if (scrapedAuctionMeta?.seller_name || scrapedAuctionMeta?.seller_id || target.seller_info) {
                    target.seller_info = {
                        seller_id: scrapedAuctionMeta?.seller_id || target.seller_info?.seller_id || null,
                        seller_name: scrapedAuctionMeta?.seller_name || target.seller_info?.seller_name || null,
                        shipping_weight: scrapedAuctionMeta?.shipping_weight || target.seller_info?.shipping_weight || target.shipping_info?.weight || 0,
                        can_combine_shipping: scrapedAuctionMeta?.can_combine_shipping !== undefined ? scrapedAuctionMeta.can_combine_shipping : (target.seller_info?.can_combine_shipping !== false)
                    };
                    target.sellerId = target.seller_info.seller_id;
                    target.sellerName = target.seller_info.seller_name;
                    target.shippingWeight = target.seller_info.shipping_weight;
                    target.canCombineShipping = target.seller_info.can_combine_shipping;
                }
            };

            if (jsonObj.items && jsonObj.items.length > 0) {
                jsonObj.items.forEach((item: any, idx: number) => {
                    // Normalize bundle lot items so pricing fields are 100% complete and consistent
                    if (item.lot_items && Array.isArray(item.lot_items)) {
                        const targetCost = item.purchase_strategy?.max_landed_cost || item.purchase_strategy?.max_bid || item.purchase_strategy?.current_asking_price || null;
                        item.lot_items = normalizeBundleComponents(item.lot_items, targetCost);
                    }

                    if (idx === 0) {
                        if (successfulImageUrl) {
                            item.fetched_image = successfulImageUrl;
                        }
                        if (scrapedImages && scrapedImages.length > 0) {
                            item.fetched_images = scrapedImages;
                        }
                        if (!scrapedShipping && parsedListingData) {
                            scrapedShipping = {
                                shipping: 8.50,
                                handling: 3.00,
                                total: 11.50,
                                carrier: 'Estimated FedEx/USPS',
                                zipCode: zipCode || 'Estimated',
                                isEstimated: true
                            };
                        }
                        if (scrapedShipping) {
                            item.shipping_info = scrapedShipping;
                        }
                        normalizeAuctionFields(item);
                    }
                });
            } else if (jsonObj.identity || jsonObj.title) {
                if (successfulImageUrl) jsonObj.fetched_image = successfulImageUrl;
                if (scrapedImages && scrapedImages.length > 0) jsonObj.fetched_images = scrapedImages;
                if (scrapedShipping) jsonObj.shipping_info = scrapedShipping;
                normalizeAuctionFields(jsonObj);
            }

            if (jsonObj.lot_items && Array.isArray(jsonObj.lot_items)) {
                jsonObj.lot_items = normalizeBundleComponents(jsonObj.lot_items);
            }
            cleanedResponse = JSON.stringify(jsonObj);
        } catch (e) {
            console.warn("Could not parse Gemini response to inject scraped metadata", e);
        }

        return new Response(cleanedResponse, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                "Access-Control-Allow-Origin": "*"
            }
        });
    } catch (error: any) {
        console.error("Detailed Gemini Analysis Error:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
        let errorMessage = error instanceof Error ? error.message : (error?.message || 'Unknown error');

        const isBillingError = error?.status === 402 || errorMessage.includes('prepayment credits') || errorMessage.includes('Payment Required') || errorMessage.includes('402');
        const isAuthError = error?.status === 401 || errorMessage.includes('API key') || errorMessage.includes('401');

        let warningReason = '';
        if (isBillingError) {
            warningReason = 'Google Gemini credits depleted or billing required (402).';
        } else if (isAuthError) {
            warningReason = 'Gemini API key unauthorized (401).';
        } else {
            warningReason = `AI Vision unavailable (${errorMessage}).`;
        }

        // Graceful fallback if AI fails on a parsed web link
        if (parsedListingData) {
            console.warn('[identify-item] AI call failed. Falling back to verified listing data:', errorMessage);
            const fallbackData = createListingFallback(parsedListingData, scrapedShipping, successfulImageUrl, scrapedImages);
            return new Response(JSON.stringify(fallbackData), { 
                status: 200, 
                headers: { 'Content-Type': 'application/json', "Access-Control-Allow-Origin": "*" } 
            });
        }

        // Resilient fallback: ensure Speed Scout never presents a breaking red 500 error for transient network/format glitches
        console.warn('[identify-item] AI call failed without listing data. Falling back to generic draft item:', errorMessage);
        const fallbackData = createGenericFallback(userNotes, successfulImageUrl, scrapedImages, warningReason);
        return new Response(JSON.stringify(fallbackData), { 
            status: 200, 
            headers: { 'Content-Type': 'application/json', "Access-Control-Allow-Origin": "*" } 
        });
    }
};

import type { APIRoute } from 'astro';
import { model, generateContentWithBackoff, DEFAULT_GEMINI_MODEL } from '../../lib/gemini';
import { normalizeBundleComponents, parsePriceRange } from '../../lib/bundle-pricing';
import { speedScoutResponseSchema } from '../../lib/ai/schemas/speed-scout.schema';
import { SPEED_SCOUT_SYSTEM_INSTRUCTION } from '../../lib/ai/instructions/system-instructions';
import { buildSpeedScoutUserPrompt } from '../../lib/ai/instructions/prompt-builders';
import { parsePriceValue } from '../../lib/lot-strategy';
import { isGuestRequest, consumeGuestScan, GUEST_MAX_PHOTOS_PER_SCAN } from '../../lib/guestScoutLimiter';
import { parsePacificDateToIso } from '../../lib/dateTimeUtils';
import { verifyAppwriteJwtToMember, requireBookmarkletMember } from '../../lib/bml/serverAuth';
import type { AiSurface } from '../../lib/aiTelemetry';
import { loadAppraisalRules, compileRulesPrompt } from '../../lib/appraisalCalibration';
import { getAllLocationSettingMetas } from '../../lib/warehouses';
import {
    fetchAndResolveOnlineListing,
    buildDomainAcquisitionLens,
    computeDomainAdjustedMaxBid,
    selectVerifiedListingImages,
    type OnlineListingEnvelope,
    type ClientDomListingPayload,
} from '../../lib/onlineSourcingAdapters';

export const prerender = false;
export const maxDuration = 300;

const MAX_SCOUT_VISION_PHOTOS = 12;
const MAX_DEEP_VISION_PHOTOS = 16;

function resolvePrimaryBoothMeta(warehouses: any[]) {
    const metas = getAllLocationSettingMetas(warehouses || []);
    const primary = metas.find((m) => m.commissionRate > 0) || metas[0];
    const name = primary?.name || 'Primary Retail Booth';
    const commissionPct = primary?.commissionRate && primary.commissionRate > 0 ? primary.commissionRate : 15;
    const netFactor = Math.max(0.5, 1 - commissionPct / 100);
    return { name, commissionPct, netFactor };
}

// Resilient Fallback Factory: Synthesizes a 100% complete scouting report directly from verified listing API data
function createListingFallback(
    parsedListingData: any,
    scrapedShipping: any,
    successfulImageUrl: string | null,
    scrapedImages: string[],
    warehouses: any[] = []
) {
    const boothMeta = resolvePrimaryBoothMeta(warehouses);
    const title = parsedListingData.title || parsedListingData.itemName || 'Online Listing Item';
    const rawPrice = parseFloat(parsedListingData.currentPrice) || parseFloat(parsedListingData.startingPrice) || 0;
    const currentPrice = isNaN(rawPrice) ? 0 : rawPrice;
    const bpPct = Number(parsedListingData.buyersPremiumPct || parsedListingData.buyers_premium_pct || 0);
    const isLocalPickupOnly = Boolean(parsedListingData.isLocalPickupOnly || parsedListingData.domainFamily === 'local_cash');

    // Detect lot count from title / notes (e.g. "10pc", "Lot of 10", "10 book")
    const lotMatch =
        title.match(/(\d+)\s*(?:pc|pcs|piece|pieces|item|items|book|books|mag|mags|magazine|magazines|vol|pack|lot)/i) ||
        title.match(/lot\s*(?:of)?\s*(\d+)/i);
    const lotCount = lotMatch ? Math.max(2, parseInt(lotMatch[1], 10)) : 1;

    // Ensure valid shipping object ($0 for local pickup / local cash, else estimated FedEx/USPS)
    const effectiveShipping =
        scrapedShipping ||
        (isLocalPickupOnly
            ? {
                  shipping: 0,
                  handling: 0,
                  total: 0,
                  carrier: 'Local Pickup',
                  zipCode: 'Local',
                  isLocalPickupOnly: true,
              }
            : {
                  shipping: 8.5,
                  handling: 3.0,
                  total: 11.5,
                  carrier: 'Estimated FedEx/USPS',
                  zipCode: 'Estimated',
              });
    const shipTotal = effectiveShipping.total;

    // Universal resale baseline heuristics (Never anchor down to a low $9.99 auction starting bid)
    const baseFairLow = 12;
    const baseFairHigh = 22;
    const baseBoutiqueLow = 18;
    const baseBoutiqueHigh = 30;

    const isMultiLot = lotCount > 1;
    const perItemFairLow = isMultiLot ? baseFairLow : Math.max(baseFairLow, Math.round(currentPrice * 1.5));
    const perItemFairHigh = isMultiLot ? baseFairHigh : Math.max(baseFairHigh, Math.round(currentPrice * 2.5));
    const perItemBoutiqueLow = isMultiLot ? baseBoutiqueLow : Math.max(baseBoutiqueLow, Math.round(currentPrice * 2.0));
    const perItemBoutiqueHigh = isMultiLot ? baseBoutiqueHigh : Math.max(baseBoutiqueHigh, Math.round(currentPrice * 3.2));

    const fairLow = perItemFairLow * lotCount;
    const fairHigh = perItemFairHigh * lotCount;
    const boutiqueLow = perItemBoutiqueLow * lotCount;
    const boutiqueHigh = perItemBoutiqueHigh * lotCount;

    const isAuction = Boolean(
        parsedListingData.is_auction ||
            parsedListingData.bidCount !== undefined ||
            parsedListingData.endTime ||
            parsedListingData.isAuction
    );
    const isSoftClose = Boolean(parsedListingData.isSoftClose || bpPct > 0);
    const listingMode = parsedListingData.listingMode || (isSoftClose ? 'soft_close_auction' : isAuction ? 'auction' : 'fixed_online');

    const boutiqueMid = Math.round((boutiqueLow + boutiqueHigh) / 2);
    const fairMid = parsePriceValue(`$${fairLow} - $${fairHigh}`, 'midpoint', Math.round((fairLow + fairHigh) / 2));
    const targetResale = boutiqueMid > 0 ? boutiqueMid : fairMid;
    const netPayout = Math.round(targetResale * boothMeta.netFactor);

    const consTargetLanded = Math.max(10, Math.round(targetResale / 3.0));
    const consAdj = computeDomainAdjustedMaxBid({
        targetLandedCost: consTargetLanded,
        shippingTotal: shipTotal,
        buyersPremiumPct: bpPct,
        listingMode,
        isAuction,
        isSoftClose,
        currentAskingPrice: currentPrice,
    });
    const consMaxBid = consAdj.maxHammerBid;
    const consProfit = Math.max(0, Math.round(netPayout - consAdj.effectiveLandedAtMaxBid));

    const balTargetLanded = Math.max(15, Math.round(targetResale / 2.2));
    const balAdj = computeDomainAdjustedMaxBid({
        targetLandedCost: balTargetLanded,
        shippingTotal: shipTotal,
        buyersPremiumPct: bpPct,
        listingMode,
        isAuction,
        isSoftClose,
        currentAskingPrice: currentPrice,
    });
    const balMaxBid = balAdj.maxHammerBid;
    const balProfit = Math.max(0, Math.round(netPayout - balAdj.effectiveLandedAtMaxBid));

    const aggTargetLanded = Math.max(20, Math.round(targetResale / 1.7));
    const aggAdj = computeDomainAdjustedMaxBid({
        targetLandedCost: aggTargetLanded,
        shippingTotal: shipTotal,
        buyersPremiumPct: bpPct,
        listingMode,
        isAuction,
        isSoftClose,
        currentAskingPrice: currentPrice,
    });
    const aggMaxBid = aggAdj.maxHammerBid;
    const aggProfit = Math.max(0, Math.round(netPayout - aggAdj.effectiveLandedAtMaxBid));

    const currentBpDollars = bpPct > 0 ? (currentPrice * bpPct) / 100 : 0;
    const currentLanded = Math.round((currentPrice + currentBpDollars + shipTotal) * 100) / 100;
    const currentProfit = Math.max(0, Math.round(netPayout - currentLanded));

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

    const bestChannel = boothMeta.name;

    const lotItems = isMultiLot
        ? Array.from({ length: Math.min(lotCount, 20) }).map((_, idx) => {
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
                      fair: `$${perItemFairLow} - $${perItemFairHigh}`,
                  },
                  price_breakdown: {
                      fair: `$${perItemFairLow} - $${perItemFairHigh}`,
                      boutique_premium: `$${perItemBoutiqueLow} - $${perItemBoutiqueHigh}`,
                      mint: `$${Math.round(perItemBoutiqueHigh * 1.25)}`,
                      poor: `$${Math.round(perItemFairLow * 0.4)}`,
                  },
                  buy_range: `$${Math.max(1, Math.floor(perItemFairLow * 0.25))} - $${Math.max(2, Math.round(perItemFairHigh * 0.4))}`,
                  estimated_value: `$${perItemFairLow} - $${perItemFairHigh}`,
              };
          })
        : undefined;

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
            buyers_premium_pct: bpPct,
            buyers_premium_dollars: balAdj.buyersPremiumDollars,
            listing_mode: listingMode,
            action_label: balAdj.actionLabel,
            target_cash_offer: balAdj.targetCashOfferHigh
                ? `$${balAdj.targetCashOfferLow} - $${balAdj.targetCashOfferHigh}`
                : undefined,
            advice: advice,
            bidding_tiers: {
                conservative: { roi: 3.0, max_bid: consMaxBid, max_landed: consTargetLanded, net_profit: consProfit },
                balanced: { roi: 2.2, max_bid: balMaxBid, max_landed: balTargetLanded, net_profit: balProfit },
                aggressive: { roi: 1.7, max_bid: aggMaxBid, max_landed: aggTargetLanded, net_profit: aggProfit },
            },
        },
        why_pay_up: `Sourced directly from verified listing: ${title}. ${lotCount > 1 ? `Multi-item ${lotCount}-piece lot offers high aggregate retail yield when split into individual booth inventory ($${(maxLandedCost / lotCount).toFixed(2)}/item max cost basis).` : 'Strong demand for authentic collectibles in physical boutique booths and online channels.'}`,
        why_pass: `Inspect all listing photos carefully for condition, signatures, or wear before bidding.`,
        pricing_potential: {
            boutique: `$${boutiqueLow} - $${boutiqueHigh}`,
            fair: `$${fairLow} - $${fairHigh}`,
        },
        price_breakdown: {
            fair: `$${fairLow} - $${fairHigh}`,
            boutique_premium: `$${boutiqueLow} - $${boutiqueHigh}`,
            mint: `$${boutiqueHigh} - $${Math.round(boutiqueHigh * 1.3)}`,
            poor: `$${Math.round(fairLow * 0.4)} - $${fairLow}`,
        },
        market_report: {
            best_platform: bestChannel,
            sell_through_velocity: isMultiLot ? 'Fast (< 7 days)' : 'Moderate (2-4 weeks)',
            platform_rationale: isMultiLot
                ? `Splitting this ${lotCount}-piece collection into individual $${perItemBoutiqueLow}-$${perItemBoutiqueHigh} booth pieces yields 3x-4x aggregate return at ${bestChannel}.`
                : 'Physical boutique booth audience appreciates vintage and curated collectibles with immediate shelf appeal.',
            channels: [
                {
                    name: bestChannel,
                    est_price: `$${boutiqueLow} - $${boutiqueHigh}`,
                    recommendation: isMultiLot ? `Split into ${lotCount} Booth Singles` : 'Best Physical Channel / Boutique Premium',
                    net_payout: `$${Math.round(boutiqueLow * boothMeta.netFactor)} - $${Math.round(boutiqueHigh * boothMeta.netFactor)} (after ${boothMeta.commissionPct}% comm.)`,
                },
                {
                    name: 'eBay',
                    est_price: `$${fairLow} - $${fairHigh}`,
                    recommendation: 'Wider Audience Reach / Fair Market Value',
                    net_payout: `$${Math.round(fairLow * 0.87)} - $${Math.round(fairHigh * 0.87)} (after fees/shipping)`,
                },
            ],
        },
        lot_items: lotItems,
        fetched_image: successfulImageUrl || (scrapedImages.length > 0 ? scrapedImages[0] : null),
        fetched_images: scrapedImages,
        shipping_info: effectiveShipping,
        notes: `Imported from verified listing: ${title}${lotCount > 1 ? ` (${lotCount}-piece lot)` : ''}`,
    };

    return {
        items: [fallbackItem],
        summary: `Listing imported: ${title}`,
    };
}

// Resilient General Fallback Factory: Ensures an intake report is ALWAYS usable even if Gemini vision fails or blocks
function createGenericFallback(
    notes: string,
    successfulImageUrl: string | null,
    scrapedImages: string[],
    warningReason?: string,
    warehouses: any[] = []
) {
    const boothMeta = resolvePrimaryBoothMeta(warehouses);
    const sanitizedNotes = (notes || '')
        .replace(/\[Organization Sales Channels:[\s\S]*?\]/gi, '')
        .replace(/\[Deep Parse[\s\S]*?\]/gi, '')
        .replace(/\[Shipping:[\s\S]*?\]/gi, '')
        .trim();
    const rawNoteFirstLine = sanitizedNotes
        ? sanitizedNotes
              .split('\n')[0]
              .replace(/https?:\/\/[^\s]+/g, '')
              .replace(/\[[^\]]*\]/g, '')
              .trim()
        : '';
    const cleanTitle =
        rawNoteFirstLine && rawNoteFirstLine.length > 2 && !rawNoteFirstLine.startsWith('[')
            ? rawNoteFirstLine.slice(0, 50)
            : 'Unidentified Item (Photo Draft)';
    return {
        warning: warningReason || undefined,
        items: [
            {
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
                        : 'AI vision was unable to appraise this item automatically. Photo preserved for manual pricing.',
                },
                why_pay_up: 'Inspect physical markings, tags, or hallmarks on the item to verify value.',
                why_pass: 'Manual verification recommended before committing.',
                pricing_potential: {
                    boutique: '',
                    fair: '',
                },
                price_breakdown: {
                    fair: '',
                    boutique_premium: '',
                    mint: '',
                    poor: '',
                },
                market_report: {
                    best_platform: boothMeta.name,
                    sell_through_velocity: 'Moderate (2-4 weeks)',
                    platform_rationale: 'Review item category and assign appropriate sales channel.',
                    channels: [],
                },
                fetched_image: successfulImageUrl || (scrapedImages.length > 0 ? scrapedImages[0] : null),
                fetched_images: scrapedImages,
                notes: sanitizedNotes || '',
            },
        ],
        summary: `Item drafted: ${cleanTitle}`,
    };
}

// Handle both POST and PUT, plus OPTIONS for CORS
export const ALL: APIRoute = async ({ request }) => {
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Appwrite-JWT, X-Client-Claim, X-RC-BML-Token',
            },
        });
    }

    if (request.method !== 'POST' && request.method !== 'PUT') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    let imageParts: Array<{ inlineData: { data: string; mimeType: string } }> = [];
    let successfulImageUrl: string | null = null;
    let scrapedImages: string[] = [];
    let scrapedShipping: any = null;
    let scrapedAuctionMeta: any = null;
    let outerResolvedEnvelope: OnlineListingEnvelope | null = null;
    let zipCode: string | null = null;
    let parsedListingData: any = null;
    let userNotes = '';
    let scrapedListingContext = '';
    let shippingSummary = '';
    let requestMode: 'scout' | 'deep' = 'scout';
    let requestItemId: string | undefined = undefined;
    let outerTargetLocations: any[] = [];

    // Verify signed Bookmarklet Bearer token (rcbml_v1) if sent from universal Scout bookmarklet
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization') || '';
    const bmlTokenHeader = request.headers.get('x-rc-bml-token') || request.headers.get('X-RC-BML-Token') || '';
    let hasValidBmlBearer = false;
    if (/^Bearer\s+\S+/i.test(authHeader) || bmlTokenHeader.trim().length > 0) {
        const bmlAuth = await requireBookmarkletMember(request);
        if (!bmlAuth.ok) return bmlAuth.response;
        hasValidBmlBearer = true;
    }

    // GUEST PREVIEW: unauthenticated visitors get a limited scan (daily quota, max photos, no URLs/locations).
    const isGuest = !hasValidBmlBearer && isGuestRequest(request);
    if (isGuest) {
        const quota = consumeGuestScan(request);
        if (!quota.allowed) {
            return new Response(
                JSON.stringify({
                    error: 'Guest preview limit reached',
                    details: `You've used all ${quota.limit} free preview scans for today. Log in as a Collective member for unlimited scouting, or come back tomorrow.`,
                    guest: quota,
                }),
                { status: 429, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
            );
        }
    }
    const guestBlocked = (details: string) =>
        new Response(
            JSON.stringify({
                error: 'Members only',
                details,
            }),
            { status: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );

    try {
        if (!model) {
            console.error('Gemini model not initialized.');
            return new Response(JSON.stringify({ error: 'Gemini not configured', details: 'Missing GEMINI_API_KEY' }), {
                status: 500,
                headers: { 'Access-Control-Allow-Origin': '*' },
            });
        }

        const urlObj = new URL(request.url);
        const expectedLen = urlObj.searchParams.get('len');
        console.log(`Debug - URL Received: ${request.url}`);
        console.log(`Debug - Using Model: ${DEFAULT_GEMINI_MODEL}`);

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

        // Fetch a single remote image into a Gemini inlineData part (order-safe)
        const fetchSingleImagePart = async (
            imgUrl: string
        ): Promise<{ url: string; part: { inlineData: { data: string; mimeType: string } } } | null> => {
            if (!imgUrl) return null;
            try {
                let referer: string | undefined = undefined;
                try {
                    const u = new URL(imgUrl);
                    referer = u.origin + '/';
                } catch {}

                const headers: Record<string, string> = {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                };
                if (referer) {
                    headers['Referer'] = referer;
                }

                const isAppwrite = imgUrl.includes('/storage/buckets/');
                const candidateUrls: string[] = [];

                if (isAppwrite) {
                    const projectId = process.env.PUBLIC_APPWRITE_PROJECT_ID || '69714b35003a8adab6bb';
                    if (projectId) headers['X-Appwrite-Project'] = projectId;

                    try {
                        const parsed = new URL(imgUrl);
                        const existingProj = parsed.searchParams.get('project') || projectId;
                        const preview = new URL(parsed.toString());
                        preview.pathname = preview.pathname.replace(/\/view$/, '/preview');
                        preview.searchParams.set('width', '1000');
                        preview.searchParams.set('height', '1000');
                        preview.searchParams.set('output', 'webp');
                        preview.searchParams.set('quality', '80');
                        preview.searchParams.set('project', existingProj);
                        candidateUrls.push(preview.toString());

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
                        const attempt = await fetch(cUrl, { headers, signal: AbortSignal.timeout(9000) });
                        if (attempt.ok) {
                            res = attempt;
                            break;
                        } else if ((attempt.status === 401 || attempt.status === 403) && isAppwrite && process.env.APPWRITE_API_KEY) {
                            try {
                                const authAttempt = await fetch(cUrl, {
                                    headers: { ...headers, 'X-Appwrite-Key': process.env.APPWRITE_API_KEY },
                                    signal: AbortSignal.timeout(9000),
                                });
                                if (authAttempt.ok) {
                                    res = authAttempt;
                                    break;
                                }
                            } catch {}
                        }
                    } catch {}
                }

                if (res && res.ok) {
                    const arrayBuffer = await res.arrayBuffer();
                    const base64 = toBase64(arrayBuffer);
                    if (base64) {
                        let mime = res.headers.get('content-type');
                        if (!mime || mime === 'application/octet-stream' || !mime.startsWith('image/')) {
                            mime = 'image/jpeg';
                        }
                        if (!mime.startsWith('image/')) return null;
                        return {
                            url: imgUrl,
                            part: {
                                inlineData: {
                                    data: base64,
                                    mimeType: mime,
                                },
                            },
                        };
                    }
                }
            } catch (e) {
                console.warn(`Failed to fetch external image: ${imgUrl}`, e);
            }
            return null;
        };

        // Fetches remote images in parallel while strictly preserving 0..N gallery index order
        const fetchOrderedImageParts = async (urls: string[], maxCount: number) => {
            if (!Array.isArray(urls) || urls.length === 0 || maxCount <= 0) return;
            const targetSlice = urls.slice(0, maxCount);
            const results = await Promise.all(targetSlice.map((u) => fetchSingleImagePart(u)));
            for (const r of results) {
                if (r && r.part) {
                    imageParts.push(r.part);
                    if (!successfulImageUrl) successfulImageUrl = r.url;
                }
            }
        };

        // 2. Read Body
        let rawBody = '';
        userNotes = '';
        let explicitUrl = '';
        let preferredRemoteUrls: string[] = [];
        let clientDomListing: ClientDomListingPayload | null = null;

        try {
            const ab = await request.arrayBuffer();
            if (ab.byteLength > 0) {
                rawBody = new TextDecoder().decode(ab);
            } else {
                rawBody = await request.text();
            }
        } catch (readError: any) {
            console.error('Debug - Failed to read request body:', readError);
            return new Response(
                JSON.stringify({
                    error: 'Read Failed',
                    details: `Server could not read request stream: ${readError.message}`,
                }),
                { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
            );
        }

        if (!rawBody || rawBody.length === 0) {
            return new Response(
                JSON.stringify({
                    error: 'Empty Body',
                    details: `Server received 0 bytes. (Expected: ${expectedLen}). URL: ${request.url}`,
                }),
                {
                    status: 400,
                    headers: { 'Access-Control-Allow-Origin': '*' },
                }
            );
        }

        if (rawBody.trim().startsWith('data:')) {
            const parts = rawBody.split(',');
            const match = parts[0].match(/:(.*?);/);
            const mime = match ? match[1] : 'image/jpeg';
            imageParts.push({
                inlineData: {
                    data: parts[1],
                    mimeType: mime,
                },
            });
        } else if (rawBody.trim().startsWith('{')) {
            try {
                const json = JSON.parse(rawBody);

                const hasRemote =
                    Boolean(json.url) ||
                    Boolean(json.imageUrl) ||
                    Boolean(json.clientDomListing) ||
                    (Array.isArray(json.selectedRemoteImageUrls) && json.selectedRemoteImageUrls.length > 0) ||
                    (Array.isArray(json.remoteImageUrls) && json.remoteImageUrls.length > 0);

                if (isGuest) {
                    if (hasRemote || /https?:\/\//i.test(String(json.notes || ''))) {
                        return guestBlocked(
                            'Online listing / auction URL scouting is reserved for Collective members. Upload up to 2 photos instead.'
                        );
                    }
                    if (Array.isArray(json.images)) {
                        json.images = json.images.slice(0, GUEST_MAX_PHOTOS_PER_SCAN);
                    }
                } else {
                    const hasRemoteUrl = hasRemote || /https?:\/\//i.test(String(json.notes || ''));
                    const jwtHeader = request.headers.get('X-Appwrite-JWT') || '';
                    if (hasRemoteUrl && jwtHeader) {
                        const verifiedMember = await verifyAppwriteJwtToMember(jwtHeader);
                        if (!verifiedMember.ok && verifiedMember.status === 403) {
                            return new Response(
                                JSON.stringify({
                                    error: 'URL scouting restricted',
                                    details:
                                        '🔒 Web link & auction URL scouting is reserved for Collective Founders (👑) and Curators (💎). Please use Camera or Photo Scout instead.',
                                }),
                                { status: 403, headers: { 'Content-Type': 'application/json' } }
                            );
                        }
                    }
                }

                if (json.notes) {
                    userNotes = String(json.notes);
                }
                if (typeof json.url === 'string' && json.url.trim()) {
                    explicitUrl = json.url.trim();
                }
                if (json.mode === 'deep') {
                    requestMode = 'deep';
                }
                if (json.itemId) {
                    requestItemId = String(json.itemId).slice(0, 64);
                }
                if (json.zipCode) {
                    zipCode = String(json.zipCode).trim();
                }
                if (json.clientDomListing && typeof json.clientDomListing === 'object') {
                    clientDomListing = json.clientDomListing as ClientDomListingPayload;
                }

                const processDataUrl = (url: string) => {
                    if (typeof url === 'string' && url.startsWith('data:')) {
                        const parts = url.split(',');
                        const match = parts[0].match(/:(.*?);/);
                        let mime = match ? match[1] : 'image/jpeg';
                        if (!mime || mime === 'application/octet-stream' || !mime.startsWith('image/')) {
                            mime = 'image/jpeg';
                        }
                        return {
                            inlineData: {
                                data: parts[1],
                                mimeType: mime,
                            },
                        };
                    }
                    return null;
                };

                if (Array.isArray(json.images)) {
                    json.images.forEach((img: string) => {
                        const part = processDataUrl(img);
                        if (part) imageParts.push(part);
                    });
                } else if (json.image) {
                    const part = processDataUrl(json.image);
                    if (part) imageParts.push(part);
                }

                // Prioritize explicit photo selection from #rc-scout-tray / ScoutView (up to 40 gallery URLs)
                if (Array.isArray(json.selectedRemoteImageUrls) && json.selectedRemoteImageUrls.length > 0) {
                    preferredRemoteUrls = json.selectedRemoteImageUrls
                        .map((u: any) => String(u || '').trim())
                        .filter(Boolean)
                        .slice(0, 40);
                } else if (Array.isArray(json.remoteImageUrls) && json.remoteImageUrls.length > 0) {
                    preferredRemoteUrls = json.remoteImageUrls
                        .map((u: any) => String(u || '').trim())
                        .filter(Boolean)
                        .slice(0, 40);
                } else if (typeof json.imageUrl === 'string' && json.imageUrl.trim()) {
                    preferredRemoteUrls = [json.imageUrl.trim()];
                }

                // Auto-load organization locations from warehouses collection (Law 2 — Single Source of Truth)
                let targetLocations = !isGuest && Array.isArray(json.locations) && json.locations.length > 0 ? json.locations : [];
                if (!isGuest && targetLocations.length === 0) {
                    try {
                        const endpoint =
                            process.env.PUBLIC_APPWRITE_ENDPOINT ||
                            import.meta.env.PUBLIC_APPWRITE_ENDPOINT ||
                            'https://sfo.cloud.appwrite.io/v1';
                        const projectId =
                            process.env.PUBLIC_APPWRITE_PROJECT_ID || import.meta.env.PUBLIC_APPWRITE_PROJECT_ID || '';
                        const dbId =
                            process.env.PUBLIC_APPWRITE_DB_ID || import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
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
                    outerTargetLocations = targetLocations;
                }
            } catch (e) {
                console.error('JSON parse failed', e);
            }
        }

        const maxVisionPhotos = isGuest
            ? GUEST_MAX_PHOTOS_PER_SCAN
            : requestMode === 'deep'
              ? MAX_DEEP_VISION_PHOTOS
              : MAX_SCOUT_VISION_PHOTOS;

        if (isGuest) {
            imageParts = imageParts.slice(0, GUEST_MAX_PHOTOS_PER_SCAN);
            if (/https?:\/\//i.test(userNotes)) {
                return guestBlocked('Online listing / auction URL scouting is reserved for Collective members.');
            }
        }

        // 3. Smart Multi-Domain URL & Client-DOM Resolution (SGW, eBay, FB Marketplace, HiBid, CTBids, EstateSales.net, Generic)
        const notesUrlMatch = userNotes ? userNotes.match(/https?:\/\/[^\s]+/) : null;
        const targetUrl = explicitUrl || clientDomListing?.sourceUrl || (notesUrlMatch ? notesUrlMatch[0] : '');

        if (targetUrl || clientDomListing) {
            const resolvedEnvelope = await fetchAndResolveOnlineListing({
                url: targetUrl,
                zipCode,
                clientDomListing,
            });
            outerResolvedEnvelope = resolvedEnvelope;

            if (resolvedEnvelope) {
                parsedListingData = resolvedEnvelope.rawVendorData
                    ? { ...resolvedEnvelope.rawVendorData, ...resolvedEnvelope }
                    : resolvedEnvelope;

                if (resolvedEnvelope.shippingQuote) {
                    scrapedShipping = resolvedEnvelope.shippingQuote;
                    if (scrapedShipping.isLocalPickupOnly) {
                        shippingSummary = `Local Pickup Only ($0 carrier shipping — verify local pickup window & drive radius)`;
                    } else {
                        shippingSummary = `Estimated Shipping: $${Number(scrapedShipping.total || 0).toFixed(2)} (${scrapedShipping.carrier}) to ZIP ${scrapedShipping.zipCode || zipCode || '97206'}${scrapedShipping.handling ? ` (Shipping: $${scrapedShipping.shipping}, Handling: $${scrapedShipping.handling})` : ''}`;
                    }
                }

                scrapedAuctionMeta = {
                    is_auction: resolvedEnvelope.isAuction,
                    is_soft_close: resolvedEnvelope.isSoftClose,
                    listing_mode: resolvedEnvelope.listingMode,
                    domain_family: resolvedEnvelope.domainFamily,
                    platform: resolvedEnvelope.platformName,
                    external_item_id: resolvedEnvelope.externalItemId,
                    end_time: resolvedEnvelope.endTimeIso,
                    time_left_text: resolvedEnvelope.timeLeftText,
                    current_bid: resolvedEnvelope.currentPrice > 0 ? resolvedEnvelope.currentPrice : null,
                    buyers_premium_pct: resolvedEnvelope.buyersPremiumPct,
                    is_local_pickup_only: resolvedEnvelope.isLocalPickupOnly,
                    seller_id: resolvedEnvelope.sellerId,
                    seller_name: resolvedEnvelope.sellerName,
                    shipping_weight: resolvedEnvelope.shippingWeight,
                    can_combine_shipping: resolvedEnvelope.canCombineShipping,
                };

                const domainLens = buildDomainAcquisitionLens(resolvedEnvelope);
                scrapedListingContext +=
                    resolvedEnvelope.contextBlock + (domainLens ? `\n${domainLens}` : '') + '\n';

                const verifiedGallery = selectVerifiedListingImages(preferredRemoteUrls, resolvedEnvelope, 40);
                if (verifiedGallery.length > 0) {
                    scrapedImages = verifiedGallery;
                    if (!successfulImageUrl) successfulImageUrl = verifiedGallery[0];
                    const remainingSlots = Math.max(0, maxVisionPhotos - imageParts.length);
                    if (remainingSlots > 0) {
                        await fetchOrderedImageParts(verifiedGallery, remainingSlots);
                    }
                }
            } else {
                // Server scrape blocked (e.g. direct URL paste without bookmarklet DOM harvest) — still honor any remoteImageUrls or uploaded photos
                if (preferredRemoteUrls.length > 0) {
                    scrapedImages = preferredRemoteUrls;
                    if (!successfulImageUrl) successfulImageUrl = preferredRemoteUrls[0];
                    const remainingSlots = Math.max(0, maxVisionPhotos - imageParts.length);
                    if (remainingSlots > 0) {
                        await fetchOrderedImageParts(preferredRemoteUrls, remainingSlots);
                    }
                }

                const bareNotesWithoutUrl = userNotes.replace(/https?:\/\/[^\s]+/g, '').trim();
                if (imageParts.length === 0 && !bareNotesWithoutUrl) {
                    return new Response(
                        JSON.stringify({
                            error: 'Scouting Blocked by Remote Site',
                            details:
                                "This site blocked cloud URL fetching. Open the listing tab and click your '🔭 RC Scout' bookmarklet (which reads the live page directly), or upload screenshots/photos here.",
                        }),
                        {
                            status: 400,
                            headers: {
                                'Access-Control-Allow-Origin': '*',
                                'Content-Type': 'application/json',
                            },
                        }
                    );
                }
            }
        } else if (preferredRemoteUrls.length > 0) {
            // Non-URL remote gallery scan (e.g. Appwrite Storage galleryImageIds in ItemDrawer Deep Scan)
            scrapedImages = preferredRemoteUrls;
            if (!successfulImageUrl) successfulImageUrl = preferredRemoteUrls[0];
            const remainingSlots = Math.max(0, maxVisionPhotos - imageParts.length);
            if (remainingSlots > 0) {
                await fetchOrderedImageParts(preferredRemoteUrls, remainingSlots);
            }
        }

        if (imageParts.length === 0 && !userNotes && !scrapedListingContext) {
            return new Response(JSON.stringify({ error: 'Parsing Failed', details: 'No image data AND no notes found in body.' }), {
                status: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
            });
        }

        const appraisalRules = await loadAppraisalRules();
        const calibrationBlock = compileRulesPrompt(
            appraisalRules,
            outerTargetLocations,
            `${userNotes} ${scrapedListingContext}`
        );
        const notesWithCalibration = calibrationBlock
            ? userNotes
                ? `${userNotes}\n\n${calibrationBlock}`
                : calibrationBlock
            : userNotes;

        const dynamicBoothChannels = getAllLocationSettingMetas(outerTargetLocations)
            .filter((m) => m.commissionRate > 0)
            .map((m) => `${m.name} (${m.code}, ${m.commissionRate}% fee${m.vibesAndNotes ? ` — ${m.vibesAndNotes}` : ''})`)
            .join('; ');
        const organizationChannelsStr = dynamicBoothChannels
            ? `${dynamicBoothChannels}; eBay; Poshmark.`
            : 'Physical Retail Booths; eBay; Poshmark.';

        const detectedSurface: AiSurface = hasValidBmlBearer
            ? 'bml_sgw_tray'
            : requestMode === 'deep'
              ? 'deep_scan_drawer'
              : Boolean(scrapedListingContext) || Boolean(parsedListingData) || /https?:\/\//i.test(userNotes)
                ? 'scout_url'
                : 'scout_camera';

        const promptText = buildSpeedScoutUserPrompt({
            authoritativeUserNotes: notesWithCalibration,
            scrapedListingContext: scrapedListingContext || undefined,
            shippingSummary:
                shippingSummary ||
                (scrapedShipping
                    ? `Estimated Shipping: $${scrapedShipping.total} (${scrapedShipping.carrier}) to ZIP ${scrapedShipping.zipCode || 'Local'}`
                    : undefined),
            organizationChannels: organizationChannelsStr,
        });

        const contentParts: any[] = [{ text: promptText }];
        if (imageParts.length > 0) {
            // Up to 12 selected gallery photos for Speed Scout (16 for Deep Scan; 2 for Guest Preview)
            contentParts.push(...imageParts.slice(0, maxVisionPhotos));
        }

        const result = await generateContentWithBackoff(
            {
                systemInstruction: SPEED_SCOUT_SYSTEM_INSTRUCTION,
                contents: [{ role: 'user', parts: contentParts }],
                generationConfig: {
                    responseMimeType: 'application/json',
                    responseSchema: speedScoutResponseSchema,
                },
                telemetryContext: {
                    surface: detectedSurface,
                    itemId: requestItemId,
                    rulesVersion: appraisalRules.version,
                },
            },
            3,
            2000
        );

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
                    console.warn(
                        `[Gemini] Model response blocked (${candidate?.finishReason || 'Unknown'}). Utilizing verified listing fallback.`
                    );
                    const fallbackData = createListingFallback(
                        parsedListingData,
                        scrapedShipping,
                        successfulImageUrl,
                        scrapedImages,
                        outerTargetLocations
                    );
                    taskResponse = JSON.stringify(fallbackData);
                } else {
                    console.warn(
                        `[Gemini] Model response blocked (${candidate?.finishReason || 'Unknown'}). Utilizing generic fallback.`
                    );
                    const fallbackData = createGenericFallback(
                        userNotes,
                        successfulImageUrl,
                        scrapedImages,
                        undefined,
                        outerTargetLocations
                    );
                    taskResponse = JSON.stringify(fallbackData);
                }
            }
        }

        let cleanedResponse = taskResponse.replace(/```json|```/g, '').trim();

        // Inject fetched image URLs, shipping info, Buyer's Premium hammer-bid math, and auction metadata into response
        try {
            const jsonObj = JSON.parse(cleanedResponse);

            const normalizeAuctionFields = (target: any) => {
                if (!target) return;
                if (scrapedAuctionMeta) {
                    target.auction_meta = { ...target.auction_meta, ...scrapedAuctionMeta };
                }
                if (target.auction_meta) {
                    if (target.auction_meta.end_time) {
                        const normalizedIso =
                            parsePacificDateToIso(target.auction_meta.end_time) || target.auction_meta.end_time;
                        target.auction_meta.end_time = normalizedIso;
                        target.auctionEndsAt = normalizedIso;
                    }
                    if (target.auction_meta.current_bid !== undefined && target.auction_meta.current_bid !== null) {
                        target.currentBid = target.auction_meta.current_bid;
                    }
                }
                if (target.purchase_strategy?.max_bid) {
                    target.maxBid = target.purchase_strategy.max_bid;
                }

                const bpPct = Number(
                    target.auction_meta?.buyers_premium_pct ?? outerResolvedEnvelope?.buyersPremiumPct ?? 0
                );
                const isLocalPickupOnly = Boolean(
                    target.auction_meta?.is_local_pickup_only ??
                        outerResolvedEnvelope?.isLocalPickupOnly ??
                        scrapedShipping?.isLocalPickupOnly
                );
                const listingMode =
                    target.auction_meta?.listing_mode ||
                    outerResolvedEnvelope?.listingMode ||
                    (bpPct > 0
                        ? 'soft_close_auction'
                        : target.auction_meta?.is_auction || target.auctionEndsAt
                          ? 'auction'
                          : 'fixed_online');
                const isSoftClose = Boolean(
                    target.auction_meta?.is_soft_close ??
                        outerResolvedEnvelope?.isSoftClose ??
                        (bpPct > 0 || listingMode === 'soft_close_auction')
                );
                const isAuction = Boolean(
                    target.auction_meta?.is_auction ||
                        target.auctionEndsAt ||
                        target.auction_meta?.end_time ||
                        listingMode === 'auction' ||
                        listingMode === 'soft_close_auction'
                );
                const shipTotal =
                    isLocalPickupOnly || listingMode === 'local_cash'
                        ? 0
                        : Number(target.shipping_info?.total ?? scrapedShipping?.total ?? 0);
                const currentAskNum = Number(
                    target.currentBid ??
                        outerResolvedEnvelope?.currentPrice ??
                        parsePriceValue(target.purchase_strategy?.current_asking_price, 'midpoint', 0)
                );

                if (target.lot_items && Array.isArray(target.lot_items) && target.lot_items.length > 1) {
                    const lotResaleSum = target.lot_items.reduce((s: number, it: any) => {
                        return (
                            s +
                            parsePriceValue(
                                it.price_breakdown?.boutique_premium || it.price_breakdown?.fair || it.estimated_value,
                                'midpoint',
                                0
                            )
                        );
                    }, 0);
                    if (lotResaleSum > 0) {
                        target.total_lot_resale = lotResaleSum;
                    }

                    // The Buy-Target Authority Law: Stop overwriting AI condition-adjusted buy targets with blind Boutique divisors!
                    let compBuyMax = 0;
                    let lotFairSum = 0;
                    let hasConditionDefects = false;

                    for (const it of target.lot_items) {
                        const br = it.buy_range;
                        if (br && typeof br.max === 'number' && br.max > 0) {
                            compBuyMax += br.max;
                        } else {
                            const parsedBr = parsePriceRange(it.buy_range?.formatted || it.buy_range);
                            compBuyMax += parsedBr.high;
                        }

                        const fair = parsePriceRange(
                            it.pricing_potential?.fair || it.price_breakdown?.fair || it.estimated_value
                        );
                        const fairMid = fair.high > 0 ? (fair.low + fair.high) / 2 : fair.low;
                        lotFairSum += fairMid;

                        const cond = String(it.condition || '').toLowerCase();
                        const notes = String(it.condition_notes || it.name || it.identity || '').toLowerCase();
                        if (
                            cond.includes('fair') ||
                            cond.includes('poor') ||
                            cond.includes('damaged') ||
                            notes.includes('empty') ||
                            notes.includes('box only') ||
                            notes.includes('parts') ||
                            notes.includes('writing') ||
                            notes.includes('ink') ||
                            notes.includes('defect')
                        ) {
                            hasConditionDefects = true;
                        }
                    }

                    const defectCeiling = hasConditionDefects && lotFairSum > 0 ? Math.round(lotFairSum * 0.5) : Infinity;

                    const adviceText = target.purchase_strategy?.advice || '';
                    const adviceMatch = adviceText.match(
                        /(?:cash\s+offer\s+of|offer\s+of|offer|pay\s+up\s+to|target\s+of|buy\s+at|ceiling\s+of|max\s+bid\s+of)\s+\$(?:(\d+(?:\.\d+)?)\s*[-–—to]\s*\$)?(\d+(?:\.\d+)?)/i
                    );
                    const adviceCeiling = adviceMatch ? parseFloat(adviceMatch[2]) : 0;

                    let resolvedMaxBuy =
                        adviceCeiling > 0
                            ? adviceCeiling
                            : target.purchase_strategy?.max_landed_cost || target.purchase_strategy?.max_bid || 0;
                    if (resolvedMaxBuy <= 0 && compBuyMax > 0) {
                        resolvedMaxBuy = compBuyMax;
                    }
                    if (defectCeiling < Infinity && resolvedMaxBuy > defectCeiling) {
                        resolvedMaxBuy = defectCeiling;
                    }
                    if (compBuyMax > 0 && resolvedMaxBuy > compBuyMax * 1.15) {
                        resolvedMaxBuy = compBuyMax;
                    }

                    if (target.purchase_strategy) {
                        const domainBid = computeDomainAdjustedMaxBid({
                            targetLandedCost: resolvedMaxBuy,
                            shippingTotal: shipTotal,
                            buyersPremiumPct: bpPct,
                            listingMode,
                            isAuction,
                            isSoftClose,
                            currentAskingPrice: currentAskNum,
                        });
                        target.purchase_strategy.max_landed_cost = resolvedMaxBuy;
                        target.purchase_strategy.max_bid = domainBid.maxHammerBid;
                        target.purchase_strategy.buyers_premium_pct = domainBid.buyersPremiumPct;
                        target.purchase_strategy.buyers_premium_dollars = domainBid.buyersPremiumDollars;
                        target.purchase_strategy.listing_mode = domainBid.listingMode;
                        target.purchase_strategy.action_label = domainBid.actionLabel;
                        if (domainBid.targetCashOfferHigh) {
                            target.purchase_strategy.target_cash_offer = `$${domainBid.targetCashOfferLow} - $${domainBid.targetCashOfferHigh}`;
                        }
                        target.maxBid = domainBid.maxHammerBid;

                        if (isAuction && target.purchase_strategy.advice && domainBid.maxHammerBid > 0) {
                            const formattedCap = domainBid.allowProxySniperCents
                                ? `$${domainBid.proxySniperBid.toFixed(2)}`
                                : bpPct > 0
                                  ? `$${domainBid.maxHammerBid.toFixed(2)} hammer ($${domainBid.effectiveLandedAtMaxBid.toFixed(2)} w/ ${bpPct}% BP)`
                                  : `$${domainBid.maxHammerBid.toFixed(2)}`;
                            target.purchase_strategy.advice = target.purchase_strategy.advice.replace(
                                /(?:do not chase past|chase past|bid up to|max bid of|ceiling of|cap of|do not exceed)\s+\$\d+(?:\.\d+)?/gi,
                                `do not chase past ${formattedCap}`
                            );
                        }
                    }
                } else if (target.purchase_strategy && (bpPct > 0 || listingMode === 'local_cash' || isAuction)) {
                    const rawLanded = Number(target.purchase_strategy.max_landed_cost || 0);
                    const rawMaxBid = Number(target.purchase_strategy.max_bid || 0);
                    const baseLanded = rawLanded > 0 ? rawLanded : rawMaxBid > 0 ? rawMaxBid + shipTotal : 0;

                    if (baseLanded > 0) {
                        const domainBid = computeDomainAdjustedMaxBid({
                            targetLandedCost: baseLanded,
                            shippingTotal: shipTotal,
                            buyersPremiumPct: bpPct,
                            listingMode,
                            isAuction,
                            isSoftClose,
                            currentAskingPrice: currentAskNum,
                        });
                        if (
                            bpPct > 0 &&
                            (rawLanded <= 0 || rawMaxBid * (1 + bpPct / 100) + shipTotal > baseLanded * 1.04)
                        ) {
                            target.purchase_strategy.max_bid = domainBid.maxHammerBid;
                            target.maxBid = domainBid.maxHammerBid;
                        } else if (!target.purchase_strategy.max_bid && domainBid.maxHammerBid > 0) {
                            target.purchase_strategy.max_bid = domainBid.maxHammerBid;
                            target.maxBid = domainBid.maxHammerBid;
                        }
                        target.purchase_strategy.max_landed_cost = baseLanded;
                        target.purchase_strategy.buyers_premium_pct = domainBid.buyersPremiumPct;
                        target.purchase_strategy.buyers_premium_dollars = domainBid.buyersPremiumDollars;
                        target.purchase_strategy.listing_mode = domainBid.listingMode;
                        target.purchase_strategy.action_label = domainBid.actionLabel;
                        if (domainBid.targetCashOfferHigh) {
                            target.purchase_strategy.target_cash_offer = `$${domainBid.targetCashOfferLow} - $${domainBid.targetCashOfferHigh}`;
                        }
                    }
                }

                if (scrapedAuctionMeta?.seller_name || scrapedAuctionMeta?.seller_id || target.seller_info) {
                    target.seller_info = {
                        seller_id: scrapedAuctionMeta?.seller_id || target.seller_info?.seller_id || null,
                        seller_name: scrapedAuctionMeta?.seller_name || target.seller_info?.seller_name || null,
                        shipping_weight:
                            scrapedAuctionMeta?.shipping_weight ||
                            target.seller_info?.shipping_weight ||
                            target.shipping_info?.weight ||
                            0,
                        can_combine_shipping:
                            scrapedAuctionMeta?.can_combine_shipping !== undefined
                                ? scrapedAuctionMeta.can_combine_shipping
                                : target.seller_info?.can_combine_shipping !== false,
                    };
                    target.sellerId = target.seller_info.seller_id;
                    target.sellerName = target.seller_info.seller_name;
                    target.shippingWeight = target.seller_info.shipping_weight;
                    target.canCombineShipping = target.seller_info.can_combine_shipping;
                }
            };

            if (jsonObj.items && jsonObj.items.length > 0) {
                jsonObj.items.forEach((item: any, idx: number) => {
                    if (item.lot_items && Array.isArray(item.lot_items)) {
                        const targetCost =
                            item.purchase_strategy?.max_landed_cost ||
                            item.purchase_strategy?.max_bid ||
                            item.purchase_strategy?.current_asking_price ||
                            null;
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
                            const noCarrierShip = Boolean(
                                outerResolvedEnvelope?.isLocalPickupOnly ||
                                    outerResolvedEnvelope?.domainFamily === 'local_cash'
                            );
                            if (noCarrierShip) {
                                scrapedShipping = {
                                    shipping: 0,
                                    handling: 0,
                                    total: 0,
                                    carrier: 'Local Pickup',
                                    zipCode: 'Local',
                                    isLocalPickupOnly: true,
                                };
                            } else if (
                                outerResolvedEnvelope?.domainFamily === 'shopgoodwill' ||
                                outerResolvedEnvelope?.isAuction
                            ) {
                                scrapedShipping = {
                                    shipping: 8.5,
                                    handling: 3.0,
                                    total: 11.5,
                                    carrier: 'Estimated FedEx/USPS',
                                    zipCode: zipCode || 'Estimated',
                                    isEstimated: true,
                                };
                            }
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

            const scannedAtIso = new Date().toISOString();
            jsonObj.scanKind = requestMode;
            jsonObj.scannedAt = scannedAtIso;
            jsonObj.rulesVersion = appraisalRules.version;
            if (Array.isArray(jsonObj.items) && jsonObj.items[0] && typeof jsonObj.items[0] === 'object') {
                jsonObj.items[0].scanKind = requestMode;
                jsonObj.items[0].scannedAt = scannedAtIso;
                jsonObj.items[0].rulesVersion = appraisalRules.version;
            }
            cleanedResponse = JSON.stringify(jsonObj);
        } catch (e) {
            console.warn('Could not parse Gemini response to inject scraped metadata', e);
        }

        return new Response(cleanedResponse, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    } catch (error: any) {
        console.error('Detailed Gemini Analysis Error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        const errorMessage = error instanceof Error ? error.message : error?.message || 'Unknown error';

        const isBillingError =
            error?.status === 402 ||
            errorMessage.includes('prepayment credits') ||
            errorMessage.includes('Payment Required') ||
            errorMessage.includes('402');
        const isAuthError = error?.status === 401 || errorMessage.includes('API key') || errorMessage.includes('401');

        let warningReason = '';
        if (isBillingError) {
            warningReason = 'Google Gemini credits depleted or billing required (402).';
        } else if (isAuthError) {
            warningReason = 'Gemini API key unauthorized (401).';
        } else {
            warningReason = `AI Vision unavailable (${errorMessage}).`;
        }

        if (parsedListingData) {
            console.warn('[identify-item] AI call failed. Falling back to verified listing data:', errorMessage);
            const fallbackData = createListingFallback(
                parsedListingData,
                scrapedShipping,
                successfulImageUrl,
                scrapedImages,
                outerTargetLocations
            );
            return new Response(JSON.stringify(fallbackData), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        }

        console.warn('[identify-item] AI call failed without listing data. Falling back to generic draft item:', errorMessage);
        const fallbackData = createGenericFallback(
            userNotes,
            successfulImageUrl,
            scrapedImages,
            warningReason,
            outerTargetLocations
        );
        return new Response(JSON.stringify(fallbackData), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
    }
};

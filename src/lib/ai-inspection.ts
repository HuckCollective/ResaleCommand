import { model, generateContentWithBackoff } from './gemini';

export interface InspectionImage {
    url?: string;
    base64?: string;
    mimeType?: string;
    index: number;
}

export interface InspectionContext {
    title?: string;
    notes?: string;
    cost?: number;
    quantity?: number;
    sourcingLocation?: string;
    locations?: Array<{ id?: string; name: string; niche?: string; categories?: string; type?: string; commissionRate?: number }>;
    existingItems?: Array<{ id?: string; title: string; upc?: string; price?: number | string; condition?: string; description?: string }>;
}

export interface ComponentItem {
    name: string;
    identity: string;
    quantity?: number;
    estimated_value: string;
    condition: string;
    image_index: number;
    image_url?: string;
    bounding_box?: [number, number, number, number];
    tier?: 'showcase' | 'core' | 'quick_turn';
    tier_label?: string;
    tier_number?: number;
    is_key_issue?: boolean;
    price_breakdown?: {
        mint?: string;
        fair?: string;
        poor?: string;
        boutique_premium?: string;
    };
    red_flags?: string[];
    ocr_detected_text?: string;
}

export interface MarketChannel {
    name: string;
    est_price: string;
    net_payout: string;
    speed: string;
    recommendation: string;
}

export interface MarketReport {
    best_platform: string;
    platform_rationale: string;
    sell_through_velocity: string;
    target_buyer?: string;
    channels: MarketChannel[];
}

export interface LotInspectionResult {
    identity: string;
    title: string;
    keywords: string[];
    condition_notes: string;
    country_of_origin?: string;
    red_flags: string[];
    price_breakdown: {
        mint: string;
        fair: string;
        poor: string;
        boutique_premium: string;
        confidence: string;
    };
    market_report: MarketReport;
    lot_items: ComponentItem[];
    purchase_strategy?: {
        verdict: string;
        current_asking_price?: string;
        max_bid: number;
        max_landed_cost: number;
        advice: string;
    };
}

function cleanAndParseJSON(rawText: string): any {
    let cleaned = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    try {
        return JSON.parse(cleaned);
    } catch (err) {
        const firstOpen = cleaned.indexOf('{');
        const lastClose = cleaned.lastIndexOf('}');
        if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
            const candidate = cleaned.slice(firstOpen, lastClose + 1);
            try {
                return JSON.parse(candidate);
            } catch (e) {
                const fixed = candidate.replace(/,\s*([\}\]])/g, '$1');
                return JSON.parse(fixed);
            }
        }
        throw err;
    }
}

/**
 * Inspect a single photo with high-precision OCR and visual feature extraction.
 */
export async function inspectSinglePhoto(
    image: InspectionImage,
    context?: InspectionContext
): Promise<any> {
    let imagePart: any = null;

    if (image.base64) {
        const cleanBase64 = image.base64.replace(/^data:image\/\w+;base64,/, '');
        imagePart = {
            inlineData: {
                data: cleanBase64,
                mimeType: image.mimeType || 'image/jpeg'
            }
        };
    } else if (image.url) {
        try {
            let fetchUrl = image.url.startsWith('http') ? image.url : `http://localhost:4321${image.url}`;
            // High-speed Appwrite image pipeline: fetch optimized 1400px WebP preview instead of 8MB raw file
            if (fetchUrl.includes('/storage/buckets/') && fetchUrl.includes('/view')) {
                fetchUrl = fetchUrl.replace(/\/view(\?.*)?$/, '/preview?width=1400&height=1400&output=webp&quality=85');
            }

            const headers: Record<string, string> = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            };
            if (fetchUrl.includes('/storage/buckets/')) {
                const projectId = (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_APPWRITE_PROJECT_ID) || process.env.PUBLIC_APPWRITE_PROJECT_ID;
                const apiKey = (typeof import.meta !== 'undefined' && import.meta.env?.APPWRITE_API_KEY) || process.env.APPWRITE_API_KEY;
                if (projectId) headers['X-Appwrite-Project'] = projectId;
                if (apiKey) headers['X-Appwrite-Key'] = apiKey;
            }
            const res = await fetch(fetchUrl, { 
                headers,
                signal: AbortSignal.timeout(6000)
            });
            if (!res.ok) {
                console.error(`[ai-inspection] Failed to fetch image ${image.url} - Status ${res.status}`);
                return null;
            }
            const arrayBuffer = await res.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            let mime = res.headers.get('content-type') || 'image/jpeg';
            if (!mime.startsWith('image/') || mime === 'application/octet-stream') {
                mime = 'image/jpeg';
            }
            imagePart = {
                inlineData: {
                    data: base64,
                    mimeType: mime
                }
            };
        } catch (e: any) {
            console.error(`[ai-inspection] Failed to fetch image ${image.url}:`, e.message);
            return null;
        }
    }

    if (!imagePart) return null;

    const knownItemsContext = context?.existingItems && context.existingItems.length > 0
        ? `\nKNOWN CONSTITUENT ITEMS IN THIS BUNDLE (${context.existingItems.length} verified listings):\n` +
          context.existingItems.map(i => `- [${i.upc || 'ITEM'}] ${i.title}${i.price ? ` ($${i.price})` : ''}`).join('\n') +
          `\nCRITICAL: The seller has ALREADY split and verified these items! If this photo shows one or more of these items, match them directly rather than guessing new categories, books, or magazines!\n`
        : '';

    const prompt = `
You are a master resale appraiser and multi-category inventory expert performing high-precision inspection of Photo #${image.index + 1}.

Lot Context:
${context?.title ? `Lot Title: ${context.title}` : ''}
${context?.notes ? `Lot Notes & Prior Research: ${context.notes}` : ''}
${knownItemsContext}

TASK:
1. PHYSICAL MEDIUM & SUBSTRATE VERIFICATION (CRITICAL FIRST STEP):
   Inspect the physical construction and substrate of the item(s) before categorizing:
   - **Art Prints, Wood Plaques & Wall Decor**:
     * Visual cues: Flat printed art, lithograph, or fantasy illustration adhered or laminated to a solid wooden board, beveled timber plaque, rustic bark-edge wood slab, or masonite panel. Look for routed/beveled edges, wood grain on edges or reverse, clear protective varnish/lacquer coating (decoupage), hanging brackets/sawtooth hooks on back, or framed borders.
     * **STRICT ANTI-HALLUCINATION RULE**:
       Items mounted on wooden boards/plaques or framed wall art are **WALL ART / MOUNTED WOOD PLAQUES**. They are NEVER books, comic books, or magazines! DO NOT hallucinate issue numbers, volume numbers, publication dates, or book series when looking at art plaques or wall decor.
       Even if the art depicts famous fantasy/sci-fi artists (Frank Frazetta, Boris Vallejo, Ken Kelly, Giger), identify them as:
       '[Artist] - Vintage Wood Plaque Art Print - [Artwork Title]' (e.g. 'Frank Frazetta - Vintage Wood Plaque Art Print - Death Dealer').
   - **Books & Magazines**:
     * Only classify as a book or magazine if physical paper pages, a bound spine, or staple binding are clearly and visibly present.
   - **Apparel, Workwear & Footwear**:
     * Fabric weave, stitched seams, inner brand tags, wash tags, shoe silhouettes.
   - **Collectibles, Toys, Electronics, Home Goods**:
     * Action figures, pottery, cameras, games, audio equipment.

2. READ ALL VISIBLE TEXT, TITLES & MARKINGS (OCR):
   - Read artist signatures (e.g. "Frank Frazetta", "Boris", "Ken Kelly", "Michael Whelan", "Giger"), artwork titles, copyright years, brand names, model numbers, tags, hallmarks, and labels.
   - For Art & Decor: Identify the specific artwork title (e.g. "Death Dealer", "The Berserker", "Silver Warrior", "Conan", "Cat Girl", "Egyptian Queen", "Brain", "Dark Kingdom").

3. MULTI-CATEGORY VALUE & STANDOUT IDENTIFICATION:
   - **Art Prints, Wood Plaques & Wall Decor**:
     * Renowned fantasy/sci-fi artists: Frank Frazetta, Boris Vallejo, Ken Kelly, H.R. Giger, Michael Whelan, Moebius, Rodney Matthews.
     * Medium: Vintage wood plaque decoupage, lithographs, framed fantasy art, gallery prints, screenprints.
     * Vintage 1960s-1980s fantasy art plaques are highly collectible retro decor ($25 - $85+ each; multi-piece sets $120 - $350+).
   - **Apparel & Workwear Standouts**: Carhartt (Detroit jackets, double-knee), Levi's (Made in USA, Big E, Orange Tab, 501), Patagonia (Synchilla, Retro-X), The North Face (1996 Nuptse), Pendleton (100% Virgin Wool), Filson (Mackinaw), Arc'teryx, Stüssy.
   - **Footwear & Shoes Standouts**: Dr. Martens (Made in England, 1460, Mary Janes), Birkenstock (Boston, Arizona), Red Wing Heritage, Blundstone, Salomon (XT-6), New Balance (990v3/v6), Nike (Jordan 1/4, Dunk, ACG).
   - **Media, Books & Periodicals** (ONLY if physical pages/spines visible): Vintage RPGs (D&D TSR 1st/2nd/3.5e), vintage sci-fi paperbacks, vintage magazines.
   - **Electronics, Audio & Collectibles**: Vintage 35mm cameras (Canon AE-1, Olympus Mju, Leica), Sony Walkman, retro video games (NES/SNES/N64, Sega, PS1/PS2, Game Boy), LEGO modulars/titans.

4. EXTRACT EVERY DISTINCT VISIBLE ITEM & ASSIGN TO ONE OF 3 TIERS:
   - If this image shows multiple distinct items, extract each one into the "items" array.
   - If an item is a high-demand trend or key collectible, mark 'is_key_issue: true'.
   - Assign 'tier': 'showcase' | 'core' | 'quick_turn'.
     * 'showcase': High-ticket grails, rare vintage, centerpieces, top trending items ($35 - $85+)
     * 'core': Solid staples, regular run pieces, matching set members ($16 - $32)
     * 'quick_turn': Common shelf-fillers, smaller pieces, impulse grab picks ($8 - $15)
   - Format "name" CLEANLY WITHOUT any bracket prefixes like '[Tier 1]':
     * For Art/Plaques: '[Artist/Maker] - [Medium: Wood Plaque / Art Print / Wall Art] - [Artwork Title]' (e.g. 'Frank Frazetta - Vintage Wood Plaque Art Print - The Berserker')
     * For Apparel: '[Brand] - [Model/Era] - [Garment Type]' (e.g. 'Carhartt - 1990s Detroit Jacket - Duck Canvas')
     * For Media: '[Series/Title] - [Edition/Issue] - [Key Feature]'
     * For Collectibles: '[Brand/Maker] - [Model/Character] - [Item Type]'

OUTPUT STRICT JSON:
{
  "is_group_overview": false,
  "items": [
    {
      "name": "Frank Frazetta - Vintage Wood Plaque Art Print - Death Dealer",
      "identity": "Frank Frazetta Vintage Wood Plaque Art Print",
      "tier": "showcase",
      "is_key_issue": true,
      "detected_text": "Text read from plaques, labels, art signatures, tags, or hallmarks",
      "condition": "Used/Good, Minor edge wear, etc.",
      "estimated_value": "$45 - $85",
      "price_breakdown": {
         "mint": "$75 - $110",
         "fair": "$45 - $85",
         "poor": "$20 - $35",
         "boutique_premium": "$65 - $95"
      },
      "red_flags": []
    }
  ]
}
`;

    try {
        const result = await generateContentWithBackoff({
            contents: [{ role: 'user', parts: [{ text: prompt }, imagePart] }],
            generationConfig: { responseMimeType: "application/json" }
        }, 3, 1500);

        const text = result.response.text();
        const parsed = cleanAndParseJSON(text);
        const rawItems = Array.isArray(parsed.items) ? parsed.items : (parsed.name ? [parsed] : []);
        
        return {
            image_index: image.index,
            image_url: image.url,
            items: rawItems.map((item: any) => {
                const cleanName = (item.name || item.identity || "Inspected Piece").replace(/\[Tier \d[^\]]*\]\s*/i, '').trim();
                const isKey = item.tier === 'showcase' || item.is_key_issue || item.name?.includes('Tier 1') || false;
                const isQuickTurn = item.tier === 'quick_turn' || item.name?.includes('Tier 3') || false;
                const tierVal: 'showcase' | 'core' | 'quick_turn' = isKey ? 'showcase' : (isQuickTurn ? 'quick_turn' : 'core');
                const tierLabel = isKey ? '🌟 Showcase' : (isQuickTurn ? '⚡ Quick Turn' : '📦 Core');
                const tierNum = isKey ? 1 : (isQuickTurn ? 3 : 2);

                return {
                    name: cleanName,
                    identity: (item.identity || cleanName).replace(/\[Tier \d[^\]]*\]\s*/i, '').trim(),
                    tier: tierVal,
                    tier_label: tierLabel,
                    tier_number: tierNum,
                    is_key_issue: isKey,
                    detected_text: item.detected_text || "",
                    condition: item.condition || "Used/Good",
                    estimated_value: item.estimated_value || (isKey ? "$35 - $65" : isQuickTurn ? "$6 - $10" : "$14 - $22"),
                    price_breakdown: item.price_breakdown || {
                        mint: isKey ? "$60 - $95" : isQuickTurn ? "$10 - $15" : "$20 - $30",
                        fair: isKey ? "$35 - $60" : isQuickTurn ? "$6 - $10" : "$14 - $22",
                        poor: isKey ? "$18 - $30" : isQuickTurn ? "$3 - $5" : "$8 - $12",
                        boutique_premium: isKey ? "$45 - $75" : isQuickTurn ? "$8 - $12" : "$16 - $25"
                    },
                    red_flags: item.red_flags || [],
                    image_index: image.index,
                    image_url: image.url
                };
            })
        };
    } catch (e: any) {
        console.error(`[ai-inspection] Single photo extraction failed on img ${image.index}:`, e.message);
        return null;
    }
}

export const inspectPhotoGallery = inspectLotWithGemini;

/**
 * Inspect a full multi-item lot, performing parallel photo scanning,
 * strict item deduplication, and overarching Memory Den 3-tier synthesis.
 */
export async function inspectLotWithGemini(
    images: InspectionImage[],
    context?: InspectionContext,
    onProgress?: (step: string, percent?: number) => void
): Promise<LotInspectionResult> {
    if (!images || images.length === 0) {
        throw new Error("No images provided for inspection");
    }

    if (onProgress) onProgress(`Step 1 of 3: Scanning ${images.length} photos with per-item OCR & tier classification...`, 15);

    // 1. Inspect all photos concurrently in full parallel batches of 25 for maximum speed
    const inspectionResults: any[] = [];
    const batchSize = 25;
    for (let i = 0; i < images.length; i += batchSize) {
        const batch = images.slice(i, i + batchSize);
        const batchPromises = batch.map(img => inspectSinglePhoto(img, context));
        const batchResults = await Promise.all(batchPromises);
        inspectionResults.push(...batchResults.filter(Boolean));
        if (onProgress) {
            const pct = Math.round(15 + ((i + batch.length) / images.length) * 55);
            onProgress(`Step 1 of 3: Analyzed photo ${Math.min(i + batch.length, images.length)} of ${images.length}...`, pct);
        }
    }

    if (onProgress) onProgress(`Step 2 of 3: Cataloging distinct issues into 3 profitability tiers...`, 75);

    // Flatten all extracted items from all photos
    const allExtractedItems: any[] = [];
    for (const res of inspectionResults) {
        if (res.items && Array.isArray(res.items)) {
            allExtractedItems.push(...res.items);
        }
    }

    // Deduplicate only truly identical items/issues
    const uniqueComponents: ComponentItem[] = [];
    const seenIssueKeys = new Set<string>();

    for (const comp of allExtractedItems) {
        const issueKey = (comp.name || comp.identity || '')
            .toLowerCase()
            .replace(/\[tier \d[^\]]*\]/i, '')
            .replace(/[^a-z0-9]/g, '');
            
        if (issueKey.length > 2 && !seenIssueKeys.has(issueKey)) {
            seenIssueKeys.add(issueKey);
            uniqueComponents.push({
                name: comp.name || comp.identity,
                identity: comp.identity || comp.name,
                estimated_value: comp.estimated_value || "$15 - $25",
                condition: comp.condition || "Used/Good",
                image_index: comp.image_index,
                image_url: comp.image_url,
                price_breakdown: comp.price_breakdown,
                red_flags: comp.red_flags || [],
                ocr_detected_text: comp.detected_text
            });
        }
    }

    if (onProgress) onProgress(`Step 3 of 3: Synthesizing Memory Den booth pricing & liquidation strategy...`, 90);

    // 2. Synthesize overarching lot report & strategy with lightweight output (Fast & Cost-Effective)
    const locationsSummary = context?.locations?.length 
        ? context.locations.map(loc => `- ${loc.name}: ${loc.niche || loc.categories || 'All Categories'}`).join('\n')
        : "None provided";

    const candidateSummary = uniqueComponents.map((c, i) => ({
        index: i + 1,
        title: c.name || c.identity,
        is_standout_key: c.is_key_issue || c.name?.includes('Tier 1') || false,
        condition: c.condition,
        estimated_value: c.estimated_value,
        detected_text: c.detected_text || ''
    }));

    let targetQuantity: number | undefined = context?.quantity;
    if (!targetQuantity || targetQuantity <= 1) {
        const titleMatch = (context?.title || '').match(/\b(?:lot|set|pack|box)\s+of\s+(\d+)\b/i);
        if (titleMatch) {
            targetQuantity = parseInt(titleMatch[1], 10);
        } else if (context?.existingItems && context.existingItems.length > 0) {
            targetQuantity = context.existingItems.length;
        }
    }

    const countInstruction = targetQuantity && targetQuantity > 1
        ? `Physical Lot Stated Count: EXACTLY ${targetQuantity} items. You MUST consolidate and merge multi-photo detections down to EXACTLY ${targetQuantity} distinct items.`
        : `Physical Lot Stated Count: Auto-detect distinct items based on unique visible pieces across photos.`;

    const verifiedExistingContext = context?.existingItems && context.existingItems.length > 0
        ? `\nVERIFIED CONSTITUENT ITEMS IN THIS LOT (${context.existingItems.length} verified items):\n` +
          JSON.stringify(context.existingItems, null, 2) +
          `\nCRITICAL CONSTITUENT INSTRUCTION:\nThe seller has ALREADY split, cataloged, and verified these items! Use these verified items as the definitive catalog for this lot. Do NOT invent new items or hallucinate different categories (e.g., do NOT call art plaques "books" or "magazines"). Synthesize the overarching lot appraisal, valuation, and sales strategy based on these verified items!\n`
        : '';

    const synthesisPrompt = `
You are a master multi-category resale appraiser and inventory valuation expert performing overarching lot consolidation, deduplication, and physical booth pricing strategy for Memory Den and online marketplaces.

ORIGINAL LISTING & LOT CONTEXT:
- Listing Title: "${context?.title || 'Multi-Item Lot'}"
- ${countInstruction}
- Sourcing Location / URL: "${context?.sourcingLocation || 'N/A'}"
- Total Landed Purchase Cost: ${context?.cost ? `$${context.cost}` : 'Not provided'}
${verifiedExistingContext}

RAW CANDIDATE DETECTIONS ACROSS ALL PHOTOS (${uniqueComponents.length} raw photo detections):
${JSON.stringify(candidateSummary, null, 2)}

Organization Physical Booths & Locations:
${locationsSummary}

CRITICAL RECONCILIATION & TIER SORTING RULES:
1. PRESERVE DETECTED ITEMS & ARTIST IDENTITIES:
   - You MUST preserve all specific artwork titles, artists, brands, and markings detected in the raw photo scans. Do NOT replace them with generic placeholder text.
   - DO NOT downgrade items marked 'is_standout_key: true' into Quick Turn!
   - Every piece with famous artists (e.g. Frank Frazetta, Boris Vallejo), iconic subjects, rare vintage, or top condition MUST be kept in **[Showcase]** ($35 - $85+).
2. MERGE DUPLICATE PHOTO DETECTIONS TO EXACT PHYSICAL COUNT:
   - Consolidate and merge multi-photo duplicates down to the EXACT physical count of distinct items (${targetQuantity && targetQuantity > 1 ? `EXACTLY ${targetQuantity} items` : 'the unique distinct items'}).
3. PHYSICAL MEDIUM FIDELITY (ANTI-HALLUCINATION):
   - Respect the true physical medium of the items (e.g. Art Prints mounted on handmade wooden plaques, framed wall decor, clothing, electronics).
   - NEVER refer to art prints or wooden wall plaques as books, paperbacks, or magazines!
4. STRICT 3-TIER GROUPING (RETURN "lot_items" SORTED IN THIS EXACT ORDER):
   - **FIRST: Showcase (Tier 1)** (Rare vintage, iconic artists, top condition centerpieces -> $35 - $85+ each).
   - **SECOND: Core (Tier 2)** (Solid standard pieces, matching set members -> $16 - $32 each).
   - **THIRD: Quick Turn (Tier 3)** (Smaller pieces, common items, impulse picks -> $8 - $15 each).
5. STANDARDIZED TITLE FORMAT:
   - Every item name in "lot_items" must be clean WITHOUT ANY tier prefixes like '[Tier 1]': e.g. '[Artist/Brand] - [Medium] - [Title/Model]'.

OUTPUT STRICT JSON:
{
  "identity": "Unified lot identity (e.g. Vintage Frank Frazetta Fantasy Art Wood Plaque Collection)",
  "title": "Comprehensive SEO title incorporating artist highlights, medium, and lot count",
  "keywords": ["Vintage", "Collectibles", "Wall Decor", "Art Prints"],
  "condition_notes": "Summary of overall condition across the collection",
  "country_of_origin": "USA",
  "red_flags": [],
  "price_breakdown": {
    "mint": "$350 - $480",
    "fair": "$240 - $340",
    "poor": "$120 - $180",
    "boutique_premium": "$290 - $390",
    "confidence": "High"
  },
  "purchase_strategy": {
    "verdict": "BUY_NOW",
    "current_asking_price": "${context?.cost ? `$${context.cost}` : '$77.05'}",
    "max_bid": 150,
    "max_landed_cost": 180,
    "advice": "High profit potential: sell standout pieces individually in booth showcase, multi-tag matching sets, or bundle as a premium gallery wall lot."
  },
  "market_report": {
    "best_platform": "Memory Den Physical Booth & eBay / Etsy",
    "platform_rationale": "Vintage pop culture art decor moves exceptionally well in curated physical booths, with strong national collector demand online.",
    "sell_through_velocity": "Fast (1-2 weeks)",
    "target_buyer": "Vintage pop culture collectors, fantasy art fans, retro decor enthusiasts",
    "channels": [
       { "name": "Memory Den Booth", "est_price": "$320.00", "net_payout": "~$260.00 after booth fees", "speed": "Fast", "recommendation": "Primary Sales Channel" },
       { "name": "eBay / Online", "est_price": "$290.00", "net_payout": "~$235.00 after fees/shipping", "speed": "Medium", "recommendation": "Best for Nationwide Reach" }
    ]
  },
  "lot_items": [
    {
      "title": "Frank Frazetta - Vintage Wood Plaque Art Print - Death Dealer",
      "tier": "showcase",
      "val": "$55 - $85",
      "cond": "Good",
      "img": 0
    }
  ]
}
`;

    try {
        const synthResult = await generateContentWithBackoff({
            contents: [{ role: 'user', parts: [{ text: synthesisPrompt }] }],
            generationConfig: { responseMimeType: "application/json" }
        }, 3, 1500);

        const synthText = synthResult.response.text();
        const parsedSynth = cleanAndParseJSON(synthText);

        // Map reconciled items and ensure image_url and tier sorting
        const finalLotItems: ComponentItem[] = (parsedSynth.lot_items && Array.isArray(parsedSynth.lot_items) && parsedSynth.lot_items.length > 0)
            ? parsedSynth.lot_items.map((item: any) => {
                let rawTitle = item.title || item.name || item.identity || "Component Item";
                const cleanTitle = rawTitle.replace(/\[Tier \d[^\]]*\]\s*/i, '').trim();
                const imgIdx = (typeof item.img === 'number' && item.img >= 0 && item.img < images.length)
                    ? item.img
                    : (typeof item.image_index === 'number' && item.image_index >= 0 && item.image_index < images.length ? item.image_index : 0);

                // Match with raw component detection to ensure zero standout loss
                const rawMatch = uniqueComponents.find((c: any) => c.image_index === imgIdx) || uniqueComponents[imgIdx];
                const rawWasKey = rawMatch?.tier === 'showcase' || rawMatch?.is_key_issue || rawMatch?.name?.includes('Tier 1');
                
                let isKey = item.tier === 'showcase' || rawTitle.includes('Tier 1') || item.is_key_issue || rawWasKey || false;
                let isQuickTurn = !isKey && (item.tier === 'quick_turn' || rawTitle.includes('Tier 3') || false);
                const tierVal: 'showcase' | 'core' | 'quick_turn' = isKey ? 'showcase' : (isQuickTurn ? 'quick_turn' : 'core');
                const tierLabel = isKey ? '🌟 Showcase' : (isQuickTurn ? '⚡ Quick Turn' : '📦 Core');
                const tierNum = isKey ? 1 : (isQuickTurn ? 3 : 2);

                let valStr = item.val || item.estimated_value || (isKey ? (rawMatch?.estimated_value || "$35 - $65") : isQuickTurn ? "$6 - $12" : "$14 - $24");
                const condStr = item.cond || item.condition || rawMatch?.condition || "Used/Good";

                let pb = item.price_breakdown;
                if (!pb) {
                    const matches = valStr.match(/\$?(\d+)\s*-\s*\$?(\d+)/);
                    if (matches) {
                        const low = parseInt(matches[1], 10);
                        const high = parseInt(matches[2], 10);
                        pb = {
                            fair: `$${low} - $${high}`,
                            mint: `$${Math.round(high * 1.35)} - $${Math.round(high * 1.6)}`,
                            poor: `$${Math.max(1, Math.round(low * 0.5))} - $${Math.round(low * 0.75)}`,
                            boutique_premium: `$${Math.round(high * 1.15)} - $${Math.round(high * 1.35)}`
                        };
                    } else {
                        pb = {
                            fair: valStr,
                            mint: isKey ? "$65 - $95" : isQuickTurn ? "$10 - $15" : "$20 - $30",
                            poor: isKey ? "$18 - $30" : isQuickTurn ? "$3 - $5" : "$8 - $12",
                            boutique_premium: isKey ? "$45 - $75" : isQuickTurn ? "$8 - $14" : "$16 - $25"
                        };
                    }
                }

                return {
                    name: cleanTitle,
                    identity: cleanTitle,
                    tier: tierVal,
                    tier_label: tierLabel,
                    tier_number: tierNum,
                    is_key_issue: isKey,
                    estimated_value: valStr,
                    condition: condStr,
                    image_index: imgIdx,
                    image_url: images[imgIdx]?.url || images[imgIdx]?.base64 || undefined,
                    price_breakdown: pb,
                    red_flags: item.red_flags || []
                };
            })
            : uniqueComponents.map(c => {
                const cName = (c.name || c.identity || "Inspected Piece").replace(/\[Tier \d[^\]]*\]\s*/i, '').trim();
                const isKey = c.tier === 'showcase' || c.is_key_issue || c.name?.includes('Tier 1') || false;
                const isQuickTurn = c.tier === 'quick_turn' || c.name?.includes('Tier 3') || false;
                return {
                    name: cName,
                    identity: cName,
                    tier: isKey ? 'showcase' : (isQuickTurn ? 'quick_turn' : 'core') as 'showcase' | 'core' | 'quick_turn',
                    tier_label: isKey ? '🌟 Showcase' : (isQuickTurn ? '⚡ Quick Turn' : '📦 Core'),
                    tier_number: isKey ? 1 : (isQuickTurn ? 3 : 2),
                    is_key_issue: isKey,
                    estimated_value: c.estimated_value || "$15 - $25",
                    condition: c.condition || "Used/Good",
                    image_index: c.image_index,
                    image_url: images[c.image_index]?.url || images[c.image_index]?.base64 || undefined,
                    price_breakdown: c.price_breakdown,
                    red_flags: c.red_flags || []
                };
            });

        // Sort items by Tier order: Showcase (1) -> Core (2) -> Quick Turn (3)
        finalLotItems.sort((a, b) => {
            return (a.tier_number || 2) - (b.tier_number || 2);
        });

        return {
            ...parsedSynth,
            lot_items: finalLotItems
        };
    } catch (e: any) {
        console.error("[ai-inspection] Synthesis pass fallback:", e.message);
        return {
            identity: context?.title || "Multi-Item Lot",
            title: context?.title || "Multi-Item Lot",
            keywords: ["Lot", "Collectibles"],
            condition_notes: "Multiple items inspected individually.",
            red_flags: [],
            price_breakdown: {
                mint: "$120 - $180",
                fair: "$80 - $120",
                poor: "$30 - $60",
                boutique_premium: "$140 - $200",
                confidence: "Medium"
            },
            market_report: {
                best_platform: "Memory Den Booth & eBay",
                platform_rationale: "Online marketplaces and physical booths provide strong reach for individual component items.",
                sell_through_velocity: "Moderate (2-4 weeks)",
                channels: [
                    { name: "Memory Den Booth", est_price: "$120.00", net_payout: "~$95.00", speed: "Fast", recommendation: "Recommended" },
                    { name: "eBay Online", est_price: "$100.00", net_payout: "~$80.00", speed: "Medium", recommendation: "Online Channel" }
                ]
            },
            lot_items: uniqueComponents.map(c => ({
                name: c.name || c.identity,
                identity: c.identity || c.name,
                estimated_value: c.estimated_value || "$15 - $25",
                condition: c.condition || "Used/Good",
                image_index: c.image_index,
                image_url: images[c.image_index]?.url || images[c.image_index]?.base64 || undefined,
                price_breakdown: c.price_breakdown,
                red_flags: c.red_flags || []
            }))
        };
    }
}

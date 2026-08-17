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
    locations?: Array<{ id: string; name: string; niche?: string; categories?: string }>;
}

export interface ComponentItem {
    name: string;
    identity: string;
    estimated_value: string;
    condition: string;
    image_index: number;
    image_url?: string;
    bounding_box?: [number, number, number, number];
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
            const fetchUrl = image.url.startsWith('http') ? image.url : `http://localhost:4321${image.url}`;
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
            const res = await fetch(fetchUrl, { headers });
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

    const prompt = `
You are a master resale appraiser performing high-precision inspection of a SINGLE photo (Photo #${image.index + 1}).

Item context (if available):
${context?.title ? `Title: ${context.title}` : ''}
${context?.notes ? `Notes/Listing: ${context.notes}` : ''}

TASK:
1. READ ALL VISIBLE TEXT (OCR): Read box names, character titles, barcodes, brand tags, copyright years, model numbers.
2. IDENTIFY THE SPECIFIC PHYSICAL OBJECT:
   - If it's a Harry Potter / Wizarding World wand: identify the EXACT character (Hermione Granger Illuminating Wand, Ron Weasley Wand, Dumbledore Elder Wand, Sirius Black, Snape, Harry Potter, etc.) by reading box labels and examining the handle/shaft carvings.
   - If it's a boxed DVD/Media set: read the exact title (e.g. "Harry Potter Complete 8-Film Collection DVD Set").
   - If it's clothing/action figure/game: identify exact brand, character, or edition.
3. IS THIS AN OVERVIEW / PILE SHOT?
   - If this image shows multiple different items laid out together in a group pile, set "is_group_overview": true.
   - If this image is a dedicated close-up of ONE specific item or boxed unit, set "is_group_overview": false.

OUTPUT STRICT JSON:
{
  "is_group_overview": false,
  "detected_text": "Exact text read from box/tag",
  "name": "Full specific name of the item (e.g. Hermione Granger's Wand with Illuminating Tip)",
  "identity": "Distinct identity",
  "condition": "Used/Good, Mint in Box, Damaged packaging, etc.",
  "estimated_value": "$25 - $35",
  "price_breakdown": {
     "mint": "$35 - $50",
     "fair": "$25 - $35",
     "poor": "$10 - $20",
     "boutique_premium": "$40 - $60"
  },
  "red_flags": ["Untested illuminating tip", "Box creasing"]
}
`;

    try {
        const result = await generateContentWithBackoff({
            contents: [{ role: 'user', parts: [{ text: prompt }, imagePart] }],
            generationConfig: { responseMimeType: "application/json" }
        }, 3, 1500);

        const text = result.response.text();
        const parsed = cleanAndParseJSON(text);
        parsed.image_index = image.index;
        parsed.image_url = image.url;
        return parsed;
    } catch (e: any) {
        console.error(`[ai-inspection] Error inspecting photo #${image.index + 1}:`, e.message);
        return null;
    }
}

/**
 * Inspect an entire gallery of photos, deduplicating overview shots and matching each distinct component item to its best photo.
 */
export async function inspectPhotoGallery(
    images: InspectionImage[],
    context?: InspectionContext,
    onProgress?: (step: string, percent?: number) => void
): Promise<LotInspectionResult> {
    if (!images || images.length === 0) {
        throw new Error("No images provided for inspection");
    }

    if (onProgress) onProgress(`Step 1 of 3: Scanning ${images.length} photos with per-item OCR...`, 15);

    // 1. Inspect each photo individually (in parallel batches of 3 to optimize speed & prevent rate limits)
    const inspectionResults: any[] = [];
    const batchSize = 3;
    for (let i = 0; i < images.length; i += batchSize) {
        const batch = images.slice(i, i + batchSize);
        const batchPromises = batch.map(img => inspectSinglePhoto(img, context));
        const batchResults = await Promise.all(batchPromises);
        inspectionResults.push(...batchResults.filter(Boolean));
        if (onProgress) {
            const pct = Math.round(15 + ((i + batch.length) / images.length) * 50);
            onProgress(`Step 1 of 3: Analyzed photo ${Math.min(i + batch.length, images.length)} of ${images.length}...`, pct);
        }
    }

    if (onProgress) onProgress(`Step 2 of 3: Synthesizing lot components & verifying 1:1 photo matches...`, 70);

    // Filter out pure group overview shots if we have dedicated close-up shots
    const closeUpShots = inspectionResults.filter(r => !r.is_group_overview);
    const candidateComponents = closeUpShots.length > 0 ? closeUpShots : inspectionResults;

    // Deduplicate any items that might have been photographed twice (e.g. front and back)
    const uniqueComponents: ComponentItem[] = [];
    const seenNames = new Set<string>();

    for (const comp of candidateComponents) {
        const simplifiedKey = (comp.name || comp.identity || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!seenNames.has(simplifiedKey) && simplifiedKey.length > 0) {
            seenNames.add(simplifiedKey);
            uniqueComponents.push({
                name: comp.name || comp.identity,
                identity: comp.identity || comp.name,
                estimated_value: comp.estimated_value || comp.price_breakdown?.fair || "$15 - $25",
                condition: comp.condition || "Used/Good",
                image_index: comp.image_index,
                image_url: comp.image_url,
                price_breakdown: comp.price_breakdown,
                red_flags: comp.red_flags || [],
                ocr_detected_text: comp.detected_text
            });
        }
    }

    if (onProgress) onProgress(`Step 3 of 3: Computing market strategy & platform payouts...`, 85);

    // 2. Synthesize overarching lot report, platform recommendations, and perform strict item deduplication
    const locationsSummary = context?.locations?.length 
        ? context.locations.map(loc => `- ${loc.name}: ${loc.niche || loc.categories || 'All Categories'}`).join('\n')
        : "None provided";

    const candidateSummary = candidateComponents.map(c => ({
        photo_index: c.image_index,
        detected_text: c.detected_text || c.ocr_detected_text || "",
        name: c.name || c.identity,
        condition: c.condition,
        estimated_value: c.estimated_value,
        is_group_overview: c.is_group_overview
    }));

    const synthesisPrompt = `
You are a master resale appraiser performing multi-item lot reconciliation and pricing.

ORIGINAL LISTING & LOT CONTEXT:
- Listing Title: "${context?.title || 'Multi-Item Lot'}"
- Explicit Stated Quantity: ${context?.quantity || 'Not specified'}
- Sourcing Location / URL: "${context?.sourcingLocation || 'N/A'}"
- Lot Notes / Sourcing Breakdown: "${context?.notes || 'N/A'}"
- Total Landed Cost: ${context?.cost ? `$${context.cost}` : 'Unknown'}

PHOTO INSPECTION CANDIDATES (${images.length} photos scanned):
${JSON.stringify(candidateSummary, null, 2)}

Organization Physical Booths & Locations:
${locationsSummary}

CRITICAL RULES FOR "lot_items" DEDUPLICATION & RECONCILIATION:
1. STRICT PHYSICAL COUNT MATCHING:
   - Check the listing title, notes, and stated quantity (e.g. if the title is "Dungeons & Dragons 4th Edition 4 Book Lot", the lot has EXACTLY 4 distinct books).
   - If the listing specifies an exact count (e.g. 4 books, 3 wands + 1 DVD set), the output "lot_items" list MUST match the true distinct physical items (e.g. exactly 4 distinct books).
2. PHOTO DEDUPLICATION (MULTI-ANGLE / SPINE / BACK COVER SHOTS):
   - Multiple photos often show the SAME physical object from different perspectives (e.g. Photo 1: front cover of Book A, Photo 2: back cover of Book A, Photo 3: spine of Book A, Photo 4: group pile).
   - Consolidate all photos of the same physical book/object into ONE entry.
   - For each distinct item, assign "image_index" to the SINGLE BEST representative front/cover photo index (0 to ${images.length - 1}).
3. PRESERVE BASE COST SPLITTING:
   - Returning false duplicates or phantom items will divide the user's base purchase cost across non-existent items. Every item in "lot_items" MUST be a genuine, distinct, physically separate unit.

OUTPUT STRICT JSON format:
{
  "identity": "Unified lot identity",
  "title": "Comprehensive SEO title accurately listing the distinct items",
  "keywords": ["Dungeons & Dragons", "4th Edition", "D&D", "Books", "Wizards of the Coast"],
  "condition_notes": "Summary of overall condition across the distinct items",
  "country_of_origin": "Unknown",
  "red_flags": [],
  "price_breakdown": {
    "mint": "$120 - $160",
    "fair": "$80 - $120",
    "poor": "$40 - $60",
    "boutique_premium": "$130 - $180",
    "confidence": "High"
  },
  "purchase_strategy": {
    "verdict": "CHASE_AUCTION",
    "current_asking_price": "${context?.cost ? `$${context.cost}` : '$25.00'}",
    "max_bid": 60,
    "max_landed_cost": 85,
    "advice": "Solid profit margin when split into individual sales."
  },
  "market_report": {
    "best_platform": "Physical Booth or eBay",
    "platform_rationale": "Detailed comparison of physical booth vs online liquidity and net profit.",
    "sell_through_velocity": "Moderate (2-4 weeks)",
    "target_buyer": "Target customer description",
    "channels": [
       { "name": "eBay Online", "est_price": "$110.00", "net_payout": "~$88.00 after fees/shipping", "speed": "Fast", "recommendation": "Fastest Liquidity" },
       { "name": "Physical Booth", "est_price": "$130.00", "net_payout": "~$104.00 after commission", "speed": "Medium", "recommendation": "Highest Net Profit" }
    ]
  },
  "lot_items": [
    {
      "name": "Exact distinct item name (e.g. D&D 4e Dungeon Master's Guide)",
      "identity": "Distinct book/item title",
      "condition": "Used/Good",
      "estimated_value": "$25 - $35",
      "image_index": 0,
      "price_breakdown": {
        "mint": "$35 - $45",
        "fair": "$25 - $35",
        "poor": "$15 - $20",
        "boutique_premium": "$40 - $50"
      },
      "red_flags": []
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

        // Ensure image_url is populated for each lot item from the image_index
        const finalLotItems: ComponentItem[] = (parsedSynth.lot_items && Array.isArray(parsedSynth.lot_items) && parsedSynth.lot_items.length > 0)
            ? parsedSynth.lot_items.map((item: any) => {
                const imgIdx = (typeof item.image_index === 'number' && item.image_index >= 0 && item.image_index < images.length) ? item.image_index : 0;
                return {
                    name: item.name || item.identity || "Component Item",
                    identity: item.identity || item.name || "Component Item",
                    estimated_value: item.estimated_value || item.price_breakdown?.fair || "$15 - $25",
                    condition: item.condition || "Used/Good",
                    image_index: imgIdx,
                    image_url: images[imgIdx]?.url || images[imgIdx]?.base64 || undefined,
                    price_breakdown: item.price_breakdown,
                    red_flags: item.red_flags || []
                };
            })
            : candidateComponents.map(c => ({
                name: c.name || c.identity,
                identity: c.identity || c.name,
                estimated_value: c.estimated_value || "$15 - $25",
                condition: c.condition || "Used/Good",
                image_index: c.image_index,
                image_url: images[c.image_index]?.url || images[c.image_index]?.base64 || undefined,
                price_breakdown: c.price_breakdown,
                red_flags: c.red_flags || []
            }));

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
                best_platform: "eBay Online",
                platform_rationale: "Online marketplaces provide strong reach for individual component items.",
                sell_through_velocity: "Moderate (2-4 weeks)",
                channels: [
                    { name: "eBay Online", est_price: "$100.00", net_payout: "~$80.00", speed: "Medium", recommendation: "Recommended" }
                ]
            },
            lot_items: candidateComponents
        };
    }
}

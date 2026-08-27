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
    quantity?: number;
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

    const prompt = `
You are a master resale appraiser and multi-category inventory expert performing high-precision inspection of Photo #${image.index + 1}.

Lot Context:
${context?.title ? `Lot Title: ${context.title}` : ''}
${context?.notes ? `Lot Notes & Prior Research: ${context.notes}` : ''}

TASK:
1. READ ALL VISIBLE TEXT (OCR):
   - Brand names, clothing tags, labels, sizes, materials (e.g. 100% Cotton, Leather, Silk, Gore-Tex), model numbers, dates, titles, barcodes, and maker signatures.
2. EXTRACT EVERY DISTINCT VISIBLE ITEM:
   - If this image shows multiple items (e.g. clothing garments, magazines, tools, video games, toys, jewelry, collectibles), extract EVERY SINGLE VISIBLE PIECE as an entry in the "items" array.
   - For EACH individual item, pinpoint:
     * Full specific title (e.g. "Vintage Nike Embroidered Swoosh Hoodie Size L", "Heavy Metal Magazine April 1977 Vol 1 #1", "Levi's 501 Made in USA Denim Jeans 34x32")
     * Identity / Short Name (e.g. "Nike Hoodie L", "Heavy Metal Apr 1977", "Levi's 501 Jeans")
     * Key Attributes (brand, size, model, year, material, color)
     * Is this a Key / High-Value Standout Item? (Rare vintage, designer brand, premiere issue, discontinued classic)
     * Individual estimated resale value.
   - If this image is a close-up of a single item or garment tag, return that single item in the "items" array.
3. If this is an overall overview photo showing a group or pile of items, extract all distinguishable pieces with best estimates.

OUTPUT STRICT JSON:
{
  "is_group_overview": false,
  "items": [
    {
      "name": "Full descriptive title with brand/model/size/date",
      "identity": "Short recognizable name",
      "is_key_issue": true,
      "detected_text": "Text read from tags, labels, or covers",
      "condition": "Used/Good, NWT, Minor flaw, etc.",
      "estimated_value": "$25 - $45",
      "price_breakdown": {
         "mint": "$50 - $75",
         "fair": "$25 - $40",
         "poor": "$12 - $20",
         "boutique_premium": "$35 - $55"
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
            is_group_overview: parsed.is_group_overview || false,
            items: rawItems.map((it: any) => ({
                ...it,
                image_index: image.index,
                image_url: image.url
            }))
        };
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

    // 1. Inspect each photo in parallel batches of 8 for high throughput
    const inspectionResults: any[] = [];
    const batchSize = 8;
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

    if (onProgress) onProgress(`Step 2 of 3: Cataloging all distinct issues & identifying key collectibles...`, 70);

    // Flatten all extracted items from all photos
    const allExtractedItems: any[] = [];
    for (const res of inspectionResults) {
        if (res.items && Array.isArray(res.items)) {
            allExtractedItems.push(...res.items);
        }
    }

    // Deduplicate only truly identical items/issues (e.g. front and back of the exact same month/year)
    const uniqueComponents: ComponentItem[] = [];
    const seenIssueKeys = new Set<string>();

    for (const comp of allExtractedItems) {
        // Construct a unique key based on title + issue date / number
        const issueKey = (comp.name || comp.identity || '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
            
        if (issueKey.length > 2 && !seenIssueKeys.has(issueKey)) {
            seenIssueKeys.add(issueKey);
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

    if (onProgress) onProgress(`Step 3 of 3: Structuring lot valuation & memory den booth pricing...`, 85);

    // 2. Synthesize overarching lot report, platform recommendations, and perform strict item deduplication
    const locationsSummary = context?.locations?.length 
        ? context.locations.map(loc => `- ${loc.name}: ${loc.niche || loc.categories || 'All Categories'}`).join('\n')
        : "None provided";

    const candidateSummary = uniqueComponents.map(c => ({
        photo_index: c.image_index,
        detected_text: c.detected_text || c.ocr_detected_text || "",
        name: c.name || c.identity,
        condition: c.condition,
        estimated_value: c.estimated_value,
        is_key_issue: (c as any).is_key_issue || false
    }));

    const synthesisPrompt = `
You are a master multi-category resale appraiser and inventory valuation expert performing lot cataloging, individual piece identification, and pricing strategy for modern & vintage lots (apparel/clothing bundles, electronics, collectibles, media, jewelry, antiques, etc.).

ORIGINAL LISTING & LOT CONTEXT:
- Listing Title: "${context?.title || 'Multi-Item Lot'}"
- Explicit Stated Quantity: ${context?.quantity || 'Not specified'}
- Sourcing Location / URL: "${context?.sourcingLocation || 'N/A'}"
- Prior Research & Lot Notes: "${context?.notes || 'N/A'}"
- Total Landed Cost: ${context?.cost ? `$${context.cost}` : 'Unknown'}

DISCOVERED ITEMS ACROSS PHOTOS (${uniqueComponents.length} distinct items identified):
${JSON.stringify(candidateSummary, null, 2)}

Organization Physical Booths & Locations:
${locationsSummary}

CRITICAL RULES FOR "lot_items" STRUCTURING:
0. FULL RECONCILIATION & ITEM CATALOGING:
   - You MUST include EVERY distinct discovered piece/item in the "lot_items" array (${uniqueComponents.length} items identified).
   - Every individual item MUST have its own entry in "lot_items" with its exact name/brand/size/model/date (e.g. "Vintage Nike Swoosh Hoodie (Size L)", "Levi's 501 Made in USA Denim Jeans 34x32", "Heavy Metal Magazine Spring 2005", etc.), estimated value, price_breakdown, condition, and image_index.
   - NEVER omit or collapse items from the "lot_items" array — all ${uniqueComponents.length} items must be present so they appear in the Bundle Components interface.
1. STANDOUT HIGH-VALUE KEYS:
   - Accurately identify standout high-value items (e.g. designer or vintage clothing, rare premiere issues, high-end electronics) and reflect their premium boutique price.
2. ACCURATE PRICING & SALES STRATEGY:
   - Provide realistic sold-comp prices for physical booths/antique malls (e.g. Memory Den), online marketplaces (eBay/Poshmark/Mercari), and storefronts.

OUTPUT STRICT JSON format:
{
  "identity": "Unified lot identity (e.g. Vintage 90s Nike & Streetwear Apparel Collection)",
  "title": "Comprehensive SEO title accurately listing key brand highlights, sizes, and lot count",
  "keywords": ["Vintage", "Apparel", "Streetwear", "Collectibles", "Fashion"],
  "condition_notes": "Summary of overall condition across the collection",
  "country_of_origin": "USA",
  "red_flags": [],
  "price_breakdown": {
    "mint": "$280 - $380",
    "fair": "$180 - $260",
    "poor": "$90 - $140",
    "boutique_premium": "$220 - $320",
    "confidence": "High"
  },
  "purchase_strategy": {
    "verdict": "CHASE_AUCTION",
    "current_asking_price": "${context?.cost ? `$${context.cost}` : '$50.00'}",
    "max_bid": 120,
    "max_landed_cost": 150,
    "advice": "High profit potential by selling standout brand pieces individually and bundling basics."
  },
  "market_report": {
    "best_platform": "Memory Den Physical Booth & eBay / Poshmark",
    "platform_rationale": "Standout brand pieces sell best individually in a booth or online; basics move fastest in curated bundles.",
    "sell_through_velocity": "Fast to Moderate (1-3 weeks)",
    "target_buyer": "Vintage fashion collectors, everyday buyers, retro enthusiasts",
    "channels": [
       { "name": "Memory Den Booth", "est_price": "$240.00", "net_payout": "~$195.00 after booth fees", "speed": "Fast", "recommendation": "Primary Sales Channel" },
       { "name": "eBay / Poshmark", "est_price": "$210.00", "net_payout": "~$165.00 after fees/shipping", "speed": "Medium", "recommendation": "Best for Top Standalone Items" }
    ]
  },
  "lot_items": [
    {
      "name": "Vintage Nike Embroidered Swoosh Hoodie (Size L)",
      "identity": "Nike Hoodie L",
      "condition": "Used/Good",
      "estimated_value": "$45 - $65",
      "image_index": 0,
      "price_breakdown": {
        "mint": "$75 - $100",
        "fair": "$45 - $65",
        "poor": "$20 - $35",
        "boutique_premium": "$60 - $80"
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
            : uniqueComponents.map(c => ({
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

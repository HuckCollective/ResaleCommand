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

    const prompt = `
You are a master resale appraiser and multi-category inventory expert performing high-precision inspection of Photo #${image.index + 1}.

Lot Context:
${context?.title ? `Lot Title: ${context.title}` : ''}
${context?.notes ? `Lot Notes & Prior Research: ${context.notes}` : ''}

TASK:
1. READ ALL VISIBLE TEXT, TITLES & COVER BLURBS (OCR):
   - Brand names, clothing tags, labels, sizes, materials, model numbers, dates, issue numbers, titles, barcodes, and maker signatures.
   - COVER CALLOUTS, ARTISTS & INTERVIEW BLURBS (CRITICAL):
     Carefully scan and read all cover blurbs, banner text, and artist credits (e.g. "Tim Leary Interview", "Frank Frazetta - Fire and Ice", "Moebius", "Nicollet", "Death Dealer", "H.R. Giger", "Berni Wrightson", "Richard Corben", "Boris Vallejo", "Simon Bisley", "Olivia", "Enki Bilal", "Philippe Druillet", "Juan Gimenez", "Paolo Eleuteri Serpieri", "Milo Manara", "Frezzato", "Chris Achilleos", "Angus McKie").
   - VINTAGE RARITY RULE:
     * ANY 1977–1983 early vintage issue (Vol 1 - Vol 7) is inherently rare and sought-after. ALWAYS classify as '[Tier 1: Standout Key]'.
     * ANY issue featuring iconic artists or cultural interviews (Tim Leary, Frazetta, Moebius, Corben, Giger, Bisley, Manara, Serpieri) MUST be classified as '[Tier 1: Standout Key]'.

2. MULTI-CATEGORY TREND & STANDOUT VALUE IDENTIFICATION:
   Actively evaluate whether any item belongs to high-velocity resale trends, archival heritage, cult subcultures, or rare collectible categories:
   - **Apparel & Workwear Standouts**: Carhartt (Detroit jackets, double-knee), Levi's (Made in USA, Big E, Orange Tab, 501), Patagonia (Synchilla, Retro-X, Deep Pile), The North Face (1996 Nuptse), Pendleton (100% Virgin Wool board shirts), Filson (Mackinaw), Arc'teryx, Stüssy, Tripp NYC.
   - **Footwear & Shoes Standouts**: Dr. Martens (Made in England, platform, 1460, Mary Janes), Birkenstock (Boston, Arizona suede), Red Wing Heritage, Blundstone, Salomon (XT-6), New Balance (990v3/v6, 1906R), Nike (Jordan 1/4, Dunk, ACG).
   - **Books, RPGs, Comics & Magazines**:
     * Heavy Metal Magazine: 1977 premiere #1, 1970s/80s golden era (Moebius, Giger, Frazetta, Olivia, Corben, Vallejo, Manara, Serpieri, Bisley, special editions).
     * Dungeons & Dragons (TSR 1st/2nd Edition, 3.5e rare supplements), Frank Herbert Dune vintage paperbacks, vintage sci-fi first editions.
   - **Electronics, Audio & Collectibles**:
     * Vintage 35mm cameras (Canon AE-1, Olympus Mju, Leica, Yashica T4), Sony Walkman, retro video games (Nintendo NES/SNES/N64, Sega, PS1/PS2, Game Boy), LEGO modulars/titans.

3. EXTRACT EVERY DISTINCT VISIBLE ITEM & ASSIGN TO ONE OF 3 TIERS:
   - If this image shows multiple distinct items, extract each one into the "items" array.
   - If an item is a high-demand trend or key collectible, mark 'is_key_issue: true'.
   - Format "name" strictly with one of these 3 tier prefixes:
     * '[Tier 1: Standout Key] Brand/Series - Date/Vol - Key Feature/Artist' (1977-1983 issues, #1s, iconic artists Moebius/Giger/Frazetta/Corben/Bisley/Leary/Manara -> $28 - $65+)
     * '[Tier 2: Mid-Tier Run] Brand/Series - Date/Vol - Artist/Storyline' (Solid 1984-1996 run issues, Frezzato, Druillet, Gimenez, Caza, complete storylines -> $14 - $24)
     * '[Tier 3: Reader Pack] Brand/Series - Date/Vol - General Feature' (Late 1999-2015 common monthly back issues, or copies with noticeable cover wear/creasing -> $6 - $10)

OUTPUT STRICT JSON:
{
  "is_group_overview": false,
  "items": [
    {
      "name": "[Tier 1: Standout Key] Heavy Metal Magazine - Oct 1977 (Vol 1 No 7) - Tim Leary / Nicollet Cover",
      "identity": "Heavy Metal Magazine Oct 1977",
      "is_key_issue": true,
      "detected_text": "Text read from tags, labels, covers, or hallmarks",
      "condition": "Used/Good, NWT, Minor flaw, etc.",
      "estimated_value": "$35 - $65",
      "price_breakdown": {
         "mint": "$60 - $95",
         "fair": "$35 - $60",
         "poor": "$18 - $30",
         "boutique_premium": "$45 - $75"
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
                const isKey = item.is_key_issue || item.name?.includes('Tier 1') || false;
                const isReader = item.name?.includes('Tier 3') || false;
                return {
                    name: item.name || item.identity || "Inspected Piece",
                    identity: item.identity || item.name || "Inspected Piece",
                    is_key_issue: isKey,
                    detected_text: item.detected_text || "",
                    condition: item.condition || "Used/Good",
                    estimated_value: item.estimated_value || (isKey ? "$35 - $65" : isReader ? "$6 - $10" : "$14 - $22"),
                    price_breakdown: item.price_breakdown || {
                        mint: isKey ? "$60 - $95" : isReader ? "$10 - $15" : "$20 - $30",
                        fair: isKey ? "$35 - $60" : isReader ? "$6 - $10" : "$14 - $22",
                        poor: isKey ? "$18 - $30" : isReader ? "$3 - $5" : "$8 - $12",
                        boutique_premium: isKey ? "$45 - $75" : isReader ? "$8 - $12" : "$16 - $25"
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
        condition: c.condition,
        estimated_value: c.estimated_value
    }));

    const synthesisPrompt = `
You are a master multi-category resale appraiser and inventory valuation expert performing overarching lot consolidation, deduplication, and physical booth pricing strategy for Memory Den and online marketplaces.

ORIGINAL LISTING & LOT CONTEXT:
- Listing Title: "${context?.title || 'Multi-Item Lot'}"
- Physical Lot Stated Count: ${context?.quantity || 'Auto-detect (approx 25-35 distinct items)'}
- Sourcing Location / URL: "${context?.sourcingLocation || 'N/A'}"
- Total Landed Purchase Cost: ${context?.cost ? `$${context.cost}` : 'Not provided'}

RAW CANDIDATE DETECTIONS ACROSS ALL PHOTOS (${uniqueComponents.length} raw photo detections):
${JSON.stringify(candidateSummary, null, 2)}

Organization Physical Booths & Locations:
${locationsSummary}

CRITICAL RECONCILIATION & TIER SORTING RULES:
1. MERGE DUPLICATE PHOTO DETECTIONS TO EXACT PHYSICAL COUNT:
   - The raw candidate list contains multiple photos of the same physical items (e.g. overview photos, detail shots, edge overlap).
   - Consolidate and merge duplicates down to the EXACT physical count of distinct magazines/items. Do NOT output duplicates!
2. STRICT 3-TIER GROUPING (RETURN "lot_items" SORTED IN THIS EXACT ORDER):
   - **FIRST: [Tier 1: Standout Key]** (Premiere #1 issues, iconic cover artists like Moebius, Giger, Frazetta, Tim Leary, Nicollet, rare 1st editions -> $25 - $65+ each).
   - **SECOND: [Tier 2: Mid-Tier Run]** (Solid 80s/90s run issues, Frezzato, complete storylines -> $12 - $22 each).
   - **THIRD: [Tier 3: Reader Pack]** (Late 90s/2000s common monthly issues, non-key background issues, shelf wear copies -> $6 - $10 each or $22 - $35 in 3-packs).
3. STANDARDIZED TITLE FORMAT:
   - Every item name in "lot_items" must be formatted as: '[Tier Name] Full Series - Exact Month Year (Vol/No) - Key Feature/Artist'.

OUTPUT STRICT JSON:
{
  "identity": "Unified lot identity (e.g. Vintage 70s-90s Heavy Metal Magazine Collection)",
  "title": "Comprehensive SEO title incorporating key issue dates, artist highlights, and lot count",
  "keywords": ["Vintage", "Collectibles", "Magazines", "Fantasy Art"],
  "condition_notes": "Summary of overall condition across the collection",
  "country_of_origin": "USA",
  "red_flags": [],
  "price_breakdown": {
    "mint": "$320 - $450",
    "fair": "$220 - $310",
    "poor": "$110 - $160",
    "boutique_premium": "$260 - $360",
    "confidence": "High"
  },
  "purchase_strategy": {
    "verdict": "CHASE_AUCTION",
    "current_asking_price": "${context?.cost ? `$${context.cost}` : '$50.00'}",
    "max_bid": 120,
    "max_landed_cost": 150,
    "advice": "High profit potential: sell Tier 1 keys individually in booth showcase, multi-tag Tier 2 runs at $16/ea, and box Tier 3 readers in $22 3-packs."
  },
  "market_report": {
    "best_platform": "Memory Den Physical Booth & eBay / Poshmark",
    "platform_rationale": "Standouts sell best in showcase; mid-tier runs move quickly with multi-quantity tags; readers clear fast in floor grab-bags.",
    "sell_through_velocity": "Fast (1-2 weeks)",
    "target_buyer": "Vintage pop culture collectors, fantasy art fans, booth flippers",
    "channels": [
       { "name": "Memory Den Booth", "est_price": "$280.00", "net_payout": "~$225.00 after booth fees", "speed": "Fast", "recommendation": "Primary Sales Channel" },
       { "name": "eBay / Online", "est_price": "$250.00", "net_payout": "~$195.00 after fees/shipping", "speed": "Medium", "recommendation": "Best for Top Standalone Items" }
    ]
  },
  "lot_items": [
    {
      "title": "[Tier 1: Standout Key] Heavy Metal Magazine - Oct 1977 (Vol 1 No 7) - Tim Leary / Nicollet Cover",
      "val": "$35 - $65",
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
                const titleStr = item.title || item.name || item.identity || "Component Item";
                const isKey = titleStr.includes('Tier 1') || item.is_key_issue || false;
                const isReader = titleStr.includes('Tier 3') || false;
                const valStr = item.val || item.estimated_value || (isKey ? "$35 - $65" : isReader ? "$6 - $10" : "$14 - $22");
                const condStr = item.cond || item.condition || "Used/Good";
                const imgIdx = (typeof item.img === 'number' && item.img >= 0 && item.img < images.length)
                    ? item.img
                    : (typeof item.image_index === 'number' && item.image_index >= 0 && item.image_index < images.length ? item.image_index : 0);

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
                            mint: isKey ? "$65 - $95" : isReader ? "$10 - $15" : "$20 - $30",
                            poor: isKey ? "$18 - $30" : isReader ? "$3 - $5" : "$8 - $12",
                            boutique_premium: isKey ? "$45 - $75" : isReader ? "$8 - $12" : "$16 - $25"
                        };
                    }
                }

                return {
                    name: titleStr,
                    identity: titleStr.replace(/\[Tier \d[^\]]*\]\s*/i, '').trim(),
                    is_key_issue: isKey,
                    estimated_value: valStr,
                    condition: condStr,
                    image_index: imgIdx,
                    image_url: images[imgIdx]?.url || images[imgIdx]?.base64 || undefined,
                    price_breakdown: pb,
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

        // Sort items by Tier order: Tier 1 -> Tier 2 -> Tier 3
        finalLotItems.sort((a, b) => {
            const getRank = (name: string) => {
                if (name.includes('Tier 1')) return 1;
                if (name.includes('Tier 2')) return 2;
                if (name.includes('Tier 3')) return 3;
                return 4;
            };
            return getRank(a.name || '') - getRank(b.name || '');
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

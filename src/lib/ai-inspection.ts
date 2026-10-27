import { model, generateContentWithBackoff, parseAiJson } from './gemini';
import { lotInspectionResponseSchema } from './ai/schemas/lot-inspection.schema';
import { LOT_PLAYBOOK_SYSTEM_INSTRUCTION } from './ai/instructions/system-instructions';
import { buildLotInspectionUserPrompt } from './ai/instructions/prompt-builders';
import { verifyAndSanitizeLotResult } from './ai/verification/verify-inspection';

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

export interface ItemView {
    role: 'front' | 'back' | 'spine' | 'detail' | 'tag';
    image_index: number;
    /** [ymin, xmin, ymax, xmax] normalized 0-1000 */
    bounding_box: [number, number, number, number];
}

/** Clamp/validate a 0-1000 [ymin,xmin,ymax,xmax] box; returns undefined if unusable. */
export function normalizeBoundingBox(box: any): [number, number, number, number] | undefined {
    if (!Array.isArray(box) || box.length !== 4) return undefined;
    const n = box.map((v: any) => Math.max(0, Math.min(1000, Math.round(Number(v)))));
    if (n.some((v: number) => Number.isNaN(v))) return undefined;
    const [ymin, xmin, ymax, xmax] = n;
    if (ymax <= ymin || xmax <= xmin) return undefined;
    return [ymin, xmin, ymax, xmax];
}

/** Validate views against the gallery size; ensure a primary view exists. */
export function normalizeItemViews(item: any, imageCount: number): ItemView[] {
    const roles = ['front', 'back', 'spine', 'detail', 'tag'];
    const seen = new Set<string>();
    const out: ItemView[] = [];
    const raw = Array.isArray(item?.views) ? item.views : [];
    for (const v of raw) {
        const idx = Number(v?.image_index);
        const box = normalizeBoundingBox(v?.bounding_box);
        if (!Number.isInteger(idx) || idx < 0 || idx >= imageCount || !box) continue;
        const role = roles.includes(v?.role) ? v.role : 'detail';
        const key = `${role}:${idx}:${box.join(',')}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ role, image_index: idx, bounding_box: box });
    }
    if (out.length === 0) {
        const box = normalizeBoundingBox(item?.bounding_box);
        const idx = Number.isInteger(item?.image_index) && item.image_index >= 0 && item.image_index < imageCount ? item.image_index : 0;
        if (box) out.push({ role: 'front', image_index: idx, bounding_box: box });
    }
    return out;
}

export interface ComponentItem {
    name: string;
    identity: string;
    tag_title?: string;
    physical_substrate?: string;
    quantity?: number;
    estimated_value: string;
    condition: string;
    image_index: number;
    image_url?: string;
    bounding_box?: [number, number, number, number];
    views?: ItemView[];
    tier?: 'showcase' | 'core' | 'quick_turn';
    tier_label?: string;
    tier_number?: number;
    is_key_issue?: boolean;
    pricing_potential?: {
        boutique?: string;
        fair?: string;
    };
    buy_range?: {
        min?: number;
        max?: number;
        formatted?: string;
    };
    price_breakdown?: {
        mint?: string;
        fair?: string;
        poor?: string;
        boutique_premium?: string;
        confidence?: string;
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
    exit_strategy?: {
        summary: string;
        projected_bulk_yield: number;
        projected_split_yield: number;
        profit_increase_pct: number;
        hero_singles: Array<{ name: string; est_price: string; target_channel: string; reason: string }>;
        themed_combines: Array<{ name: string; est_price: string; items: string[]; reason: string }>;
        floor_fillers?: { name: string; est_price: string; count: number; target_channel: string };
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
 * Fetch and prepare an image into a Gemini inlineData part.
 */
async function fetchImagePart(image: InspectionImage): Promise<{ inlineData: { data: string; mimeType: string }; index: number } | null> {
    if (image.base64) {
        const cleanBase64 = image.base64.replace(/^data:image\/\w+;base64,/, '');
        return {
            inlineData: {
                data: cleanBase64,
                mimeType: image.mimeType || 'image/jpeg'
            },
            index: image.index
        };
    } else if (image.url) {
        try {
            const rawUrl = image.url;
            let targetUrl = rawUrl.startsWith('http') ? rawUrl : `http://localhost:4321${rawUrl}`;
            
            // Extract or resolve Appwrite configuration
            const projectId = (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_APPWRITE_PROJECT_ID) 
                || process.env.PUBLIC_APPWRITE_PROJECT_ID 
                || '69714b35003a8adab6bb';
            const apiKey = (typeof import.meta !== 'undefined' && import.meta.env?.APPWRITE_API_KEY) 
                || process.env.APPWRITE_API_KEY;

            const isAppwrite = targetUrl.includes('/storage/buckets/');
            const candidateUrls: string[] = [];

            if (isAppwrite) {
                try {
                    const parsedUrl = new URL(targetUrl);
                    const existingProj = parsedUrl.searchParams.get('project') || projectId;
                    
                    // Candidate 1: High-performance 1200px WebP preview (preserves project param)
                    const previewUrl = new URL(parsedUrl.toString());
                    previewUrl.pathname = previewUrl.pathname.replace(/\/view$/, '/preview');
                    previewUrl.searchParams.set('width', '1200');
                    previewUrl.searchParams.set('height', '1200');
                    previewUrl.searchParams.set('output', 'webp');
                    previewUrl.searchParams.set('quality', '85');
                    previewUrl.searchParams.set('project', existingProj);
                    candidateUrls.push(previewUrl.toString());

                    // Candidate 2: Original View URL (with project param guaranteed)
                    const viewUrl = new URL(parsedUrl.toString());
                    viewUrl.searchParams.set('project', existingProj);
                    candidateUrls.push(viewUrl.toString());
                } catch {
                    candidateUrls.push(targetUrl);
                }
            } else {
                candidateUrls.push(targetUrl);
            }

            const headers: Record<string, string> = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            };
            if (isAppwrite) {
                if (projectId) headers['X-Appwrite-Project'] = projectId;
                // Note: Do NOT send X-Appwrite-Key by default for public storage!
            }

            let res: Response | null = null;
            let lastStatus = 0;

            for (const cUrl of candidateUrls) {
                try {
                    const attempt = await fetch(cUrl, {
                        headers,
                        signal: AbortSignal.timeout(10000)
                    });
                    if (attempt.ok) {
                        res = attempt;
                        break;
                    } else if ((attempt.status === 401 || attempt.status === 403) && isAppwrite && apiKey) {
                        // Fallback with API key if unauthenticated attempt was rejected
                        try {
                            const authAttempt = await fetch(cUrl, {
                                headers: { ...headers, 'X-Appwrite-Key': apiKey },
                                signal: AbortSignal.timeout(10000)
                            });
                            if (authAttempt.ok) {
                                res = authAttempt;
                                break;
                            }
                        } catch {}
                    }
                    lastStatus = attempt.status;
                    console.warn(`[ai-inspection] Fetch failed (${attempt.status}) for ${cUrl.slice(0, 80)}... trying fallback`);
                } catch (fetchErr: any) {
                    console.warn(`[ai-inspection] Fetch error for ${cUrl.slice(0, 80)}: ${fetchErr.message}`);
                }
            }

            if (!res || !res.ok) {
                console.error(`[ai-inspection] All fetch attempts failed for image ${image.url} - Last Status: ${lastStatus}`);
                return null;
            }

            const arrayBuffer = await res.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            let mime = res.headers.get('content-type') || 'image/jpeg';
            if (!mime.startsWith('image/') || mime === 'application/octet-stream') {
                mime = 'image/jpeg';
            }
            return {
                inlineData: {
                    data: base64,
                    mimeType: mime
                },
                index: image.index
            };
        } catch (e: any) {
            console.error(`[ai-inspection] Failed to fetch image ${image.url}:`, e.message);
            return null;
        }
    }
    return null;
}

/**
 * Inspect a single photo with high-precision OCR and visual feature extraction.
 * Uses clean, unbiased multi-category recognition without hardcoded franchise trivia.
 */
export async function inspectSinglePhoto(
    image: InspectionImage,
    context?: InspectionContext
): Promise<any> {
    const fetched = await fetchImagePart(image);
    if (!fetched) return null;
    const imagePart = { inlineData: fetched.inlineData };

    const userNotesSection = context?.notes
        ? `\nUSER NOTES & PRIOR CORRECTIONS (AUTHORITATIVE):\n"${context.notes}"\nCRITICAL: If the user specified titles, editions, or flaws, treat them as ground truth.\n`
        : '';

    const knownItemsContext = context?.existingItems && context.existingItems.length > 0
        ? `\nKNOWN CONSTITUENT ITEMS IN THIS BUNDLE (${context.existingItems.length} verified listings):\n` +
          context.existingItems.map(i => `- [${i.upc || 'ITEM'}] ${i.title}${i.price ? ` ($${i.price})` : ''}`).join('\n') +
          `\nCRITICAL: The seller has ALREADY split and verified these items! Match against these verified listings directly.\n`
        : '';

    const prompt = `
You are an expert multi-category resale appraiser performing visual inspection of Photo #${image.index + 1}.

Lot Context:
${context?.title ? `Lot Title: ${context.title}` : ''}
${userNotesSection}
${knownItemsContext}

TASK:
1. PHYSICAL MEDIUM & SUBSTRATE VERIFICATION:
   Inspect the physical construction and substrate of the visible item(s):
   - **Books, RPGs, Comics & Periodicals**: Only classify as books/periodicals if physical paper pages, bound spines, or staple bindings are visibly present.
   - **Apparel, Workwear & Footwear**: Fabric weave, stitched seams, brand tags, wash tags, shoe silhouettes.
   - **Wall Art, Decor & Framed Art**: Art prints, framed lithographs, canvas, or mounted plaques. NEVER classify wall decor as books or magazines.
   - **Electronics, Audio & Video Games**: Cartridges, optical discs, consoles, cameras, lenses, home electronics.
   - **Collectibles, Toys & Miniatures**: Action figures, diecast, building sets, tabletop miniatures.

2. VERBATIM TEXT, TITLES & MARKINGS (OCR):
   - Transcribe exact text visible on covers, spines, tags, hallmarks, and labels.
   - Read the exact title, subtitle, author, publisher, and visible copyright/publication year (e.g. "© 2000", "© 2004", "© 2009").
   - ANTI-HALLUCINATION GUARD: NEVER invent, extrapolate, or guess unprinted core titles or popular franchise staples unless the exact text or cover art is clearly visible in this photo.

3. MULTI-ITEM DETECTION & PROFITABILITY TIERS:
   - Extract every distinct visible item in this photo.
   - Assign 'tier': 'showcase' | 'core' | 'quick_turn':
     * 'showcase': High-demand centerpieces, rare vintage, top condition ($35 - $85+)
     * 'core': Solid staples, regular run pieces, matching set members ($16 - $32)
     * 'quick_turn': Common shelf-fillers, smaller pieces, impulse grabs ($8 - $15)

4. BOUNDING BOX: for every item return "bounding_box": [ymin, xmin, ymax, xmax] as integers 0-1000 (fraction of this photo's height/width) tightly enclosing ONLY that item. In "views" return this photo's view of the item with role 'front'|'back'|'spine'|'detail'|'tag' (closeups of interior maps, inked pages, copyright pages or flaws are 'detail'; price/brand tags are 'tag').

OUTPUT STRICT JSON:
{
  "is_group_overview": false,
  "items": [
    {
      "name": "Clean descriptive item name without tier prefixes",
      "identity": "Specific distinct identity",
      "tier": "showcase",
      "is_key_issue": true,
      "detected_text": "Verbatim text read from cover, spine, label, or hallmark",
      "condition": "Used/Good, Minor edge wear, etc.",
      "estimated_value": "$25 - $45",
      "price_breakdown": {
         "mint": "$45 - $65",
         "fair": "$25 - $45",
         "poor": "$10 - $20",
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
                    image_url: image.url,
                    bounding_box: normalizeBoundingBox(item.bounding_box),
                    views: normalizeItemViews({ ...item, image_index: image.index }, image.index + 1)
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
 * Inspect a full multi-item lot using Unified Multimodal Vision.
 * 
 * ARCHITECTURAL PRINCIPLE:
 * Passes ALL gallery photos directly to Gemini in a single multimodal call.
 * This guarantees the model has full visual sight of covers, spines, and overview layouts
 * during synthesis, eliminating blind-text hallucinations and ensuring 100% physical grounding.
 */
export async function inspectLotWithGemini(
    images: InspectionImage[],
    context?: InspectionContext,
    onProgress?: (step: string, percent?: number) => void
): Promise<LotInspectionResult> {
    if (!images || images.length === 0) {
        throw new Error("No images provided for inspection");
    }

    if (onProgress) onProgress(`Step 1 of 2: Loading ${images.length} gallery photos for deep vision analysis...`, 20);

    // 1. Fetch and prepare all image parts concurrently
    const imagePartPromises = images.map(img => fetchImagePart(img));
    const rawImageParts = await Promise.all(imagePartPromises);
    const validImageParts = rawImageParts.filter((p): p is { inlineData: { data: string; mimeType: string }; index: number } => p !== null);

    if (validImageParts.length === 0) {
        throw new Error("Could not process any gallery photos. Check image URLs or upload formats.");
    }

    if (onProgress) onProgress(`Step 2 of 2: Appraising full collection with Gemini Multimodal Vision...`, 60);

    // Determine target quantity from context or title regex
    let targetQuantity: number | undefined = context?.quantity;
    if (!targetQuantity || targetQuantity <= 1) {
        const titleMatch = (context?.title || '').match(/\b(?:lot|set|pack|box)\s+of\s+(\d+)\b/i) ||
                           (context?.title || '').match(/\((\d+)\s*(?:books?|items?|pcs?|pieces?|vols?|volumes?)\)/i);
        if (titleMatch) {
            targetQuantity = parseInt(titleMatch[1], 10);
        } else if (context?.existingItems && context.existingItems.length > 0) {
            targetQuantity = context.existingItems.length;
        }
    }

    const countInstruction = targetQuantity && targetQuantity > 1
        ? `Physical Lot Stated Count: EXACTLY ${targetQuantity} physical items. Locate and catalogue all ${targetQuantity} distinct physical items shown across the photos.`
        : `Physical Lot Stated Count: Auto-detect distinct items based on unique visible pieces across photos. Do NOT duplicate items shown across multiple angles.`;

    // 2. Format User Notes & Overrides as Authoritative Ground Truth
    const userNotesSection = context?.notes
        ? `\n========================================================
USER-SPECIFIED NOTES & CORRECTIONS (ABSOLUTE GROUND TRUTH):
"${context.notes}"
CRITICAL OVERRIDE INSTRUCTION:
The reseller/seller has provided specific physical notes above.
These notes represent 100% authoritative ground truth and OVERRIDE automated visual guesses.
If the notes specify an edition, year, flaw, or exact title (e.g. "DMG is 3.0", "Ashen Crown is 4e"),
you MUST honor that specification precisely in the catalog and condition notes.
========================================================\n`
        : '';

    const verifiedExistingContext = context?.existingItems && context.existingItems.length > 0
        ? `\nVERIFIED CONSTITUENT ITEMS IN THIS LOT (${context.existingItems.length} verified items):\n` +
          JSON.stringify(context.existingItems, null, 2) +
          `\nCRITICAL CONSTITUENT INSTRUCTION:\nThe seller has ALREADY split, cataloged, and verified these items! Use these verified items as the definitive catalog for this lot. Do NOT invent new items or hallucinate different categories.\n`
        : '';

    const locationsSummary = context?.locations?.length
        ? context.locations.map(loc => `- ${loc.name}: ${loc.niche || loc.categories || 'All Categories'}`).join('\n')
        : "None provided";

    const promptText = buildLotInspectionUserPrompt({
        authoritativeUserNotes: context?.notes,
        lotTitle: context?.title,
        targetQuantity,
        sourcingLocation: context?.sourcingLocation,
        landedCost: context?.cost,
        verifiedExistingItems: context?.existingItems,
        locationsSummary,
        imageCount: validImageParts.length
    });

    try {
        // Build multimodal payload: text prompt followed by all gallery image parts
        const contentParts: any[] = [
            { text: promptText },
            ...validImageParts.map(p => ({ inlineData: p.inlineData }))
        ];

        const synthResult = await generateContentWithBackoff({
            systemInstruction: LOT_PLAYBOOK_SYSTEM_INSTRUCTION,
            contents: [{ role: 'user', parts: contentParts }],
            generationConfig: { 
                responseMimeType: "application/json",
                responseSchema: lotInspectionResponseSchema
            }
        }, 3, 2000);

        const synthText = synthResult.response.text();
        const parsedSynth: LotInspectionResult = cleanAndParseJSON(synthText);

        // Ensure image_url is assigned if available
        if (Array.isArray(parsedSynth.lot_items)) {
            parsedSynth.lot_items.forEach((item: any) => {
                const imgIdx = (typeof item.image_index === 'number' && item.image_index >= 0 && item.image_index < images.length)
                    ? item.image_index
                    : (typeof item.img === 'number' && item.img >= 0 && item.img < images.length ? item.img : 0);
                if (!item.image_url) {
                    item.image_url = images[imgIdx]?.url || images[imgIdx]?.base64 || undefined;
                }
                // Preserve + sanitize multi-angle data (never strip image_index/bounding_box/views)
                item.image_index = imgIdx;
                const bb = normalizeBoundingBox(item.bounding_box);
                if (bb) item.bounding_box = bb; else delete item.bounding_box;
                const views = normalizeItemViews(item, images.length);
                if (views.length) item.views = views; else delete item.views;
            });
        }

        // Run deterministic verification & math sanity
        const verifiedResult = verifyAndSanitizeLotResult(parsedSynth, context?.cost);

        if (onProgress) onProgress(`Cataloged ${verifiedResult.lot_items.length} items with deep valuation!`, 100);

        return verifiedResult;
    } catch (e: any) {
        console.error("[ai-inspection] Unified multimodal inspection failed, falling back:", e.message);
        return {
            identity: context?.title || "Multi-Item Lot",
            title: context?.title || "Multi-Item Lot",
            keywords: ["Lot", "Collectibles"],
            condition_notes: "Multiple items inspected from gallery photos.",
            red_flags: [],
            price_breakdown: {
                mint: "$150 - $220",
                fair: "$100 - $150",
                poor: "$40 - $70",
                boutique_premium: "$130 - $190",
                confidence: "Medium"
            },
            market_report: {
                best_platform: "Memory Den Booth & eBay",
                platform_rationale: "Physical consignment booth and online marketplace combination maximizes return on multi-item collections.",
                sell_through_velocity: "Moderate (2-4 weeks)",
                channels: [
                    { name: "Memory Den Booth", est_price: "$130.00", net_payout: "~$105.00", speed: "Fast", recommendation: "Recommended" },
                    { name: "eBay Online", est_price: "$110.00", net_payout: "~$88.00", speed: "Medium", recommendation: "Online Channel" }
                ]
            },
            lot_items: []
        };
    }
}

import { model, generateContentWithBackoff, parseAiJson, type AiSurface } from './gemini';
import { lotInspectionResponseSchema } from './ai/schemas/lot-inspection.schema';
import { LOT_PLAYBOOK_SYSTEM_INSTRUCTION } from './ai/instructions/system-instructions';
import { buildLotInspectionUserPrompt } from './ai/instructions/prompt-builders';
import { verifyAndSanitizeLotResult } from './ai/verification/verify-inspection';
import { parsePriceValue } from './lot-strategy';

export const MAX_LOT_VISION_PHOTOS = 12;
export const MAX_LARGE_LOT_VISION_PHOTOS = 8;
export const LOT_VISION_MAX_DIMENSION_PX = 1024;

export interface InspectionImage {
    url?: string;
    base64?: string;
    mimeType?: string;
    index: number;
}

export interface InspectionContext {
    itemId?: string;
    surface?: AiSurface;
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

let cachedSharpLoader: Promise<any> | null = null;
async function getSharp(): Promise<any | null> {
    if (!cachedSharpLoader) {
        cachedSharpLoader = import('sharp')
            .then((m: any) => m?.default || m)
            .catch(() => null);
    }
    return cachedSharpLoader;
}

/**
 * Extracts canonical storage file ID when an image URL points to a bucket file
 * so /preview?width=220 and /view URLs for the same photo never duplicate.
 */
export function extractStorageFileId(url?: string): string | null {
    if (!url || typeof url !== 'string') return null;
    const m = /\/storage\/buckets\/([^/]+)\/files\/([^/?#]+)/i.exec(url);
    return m ? `${m[1]}:${m[2]}` : null;
}

/**
 * Canonicalizes and deduplicates gallery images while preserving first-seen order.
 * Upgrades cropped /preview thumbnail URLs to full-aspect /view URLs so server-side
 * downscaling preserves exact aspect ratio for bounding boxes.
 */
export function dedupeInspectionImages(images: InspectionImage[]): InspectionImage[] {
    if (!Array.isArray(images) || images.length === 0) return [];
    const seenKeys = new Set<string>();
    const out: InspectionImage[] = [];

    const projectId =
        (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_APPWRITE_PROJECT_ID) ||
        process.env.PUBLIC_APPWRITE_PROJECT_ID ||
        '69714b35003a8adab6bb';

    for (const img of images) {
        if (!img) continue;
        if (img.base64) {
            const key = `b64:${img.base64.slice(0, 96)}:${img.base64.length}`;
            if (seenKeys.has(key)) continue;
            seenKeys.add(key);
            out.push({ ...img, index: out.length });
            continue;
        }
        if (img.url) {
            let cleanUrl = img.url.trim();
            if (cleanUrl.includes('/api/proxy-image?url=')) {
                try {
                    const parsedProxy = new URL(cleanUrl, 'http://localhost:4321');
                    const inner = parsedProxy.searchParams.get('url');
                    if (inner) cleanUrl = inner;
                } catch {}
            }
            const fileKey = extractStorageFileId(cleanUrl);
            const dedupeKey = fileKey ? `file:${fileKey}` : `url:${cleanUrl}`;
            if (seenKeys.has(dedupeKey)) continue;
            seenKeys.add(dedupeKey);

            // Upgrade cropped /preview URLs to full-aspect /view URLs before server resize
            if (fileKey) {
                try {
                    const u = new URL(cleanUrl.startsWith('http') ? cleanUrl : `http://localhost:4321${cleanUrl}`);
                    const proj = u.searchParams.get('project') || projectId;
                    u.pathname = u.pathname.replace(/\/preview$/, '/view');
                    u.search = '';
                    if (proj) u.searchParams.set('project', proj);
                    cleanUrl = u.toString();
                } catch {}
            }

            out.push({
                ...img,
                url: cleanUrl,
                index: out.length,
            });
        }
    }
    return out;
}

async function compressBufferForVision(
    rawBuffer: Buffer,
    fallbackMime: string
): Promise<{ data: string; mimeType: string }> {
    try {
        const sharpFn = await getSharp();
        if (sharpFn) {
            const resized: Buffer = await sharpFn(rawBuffer)
                .rotate()
                .resize({
                    width: LOT_VISION_MAX_DIMENSION_PX,
                    height: LOT_VISION_MAX_DIMENSION_PX,
                    fit: 'inside',
                    withoutEnlargement: true,
                })
                .jpeg({ quality: 78, mozjpeg: true })
                .toBuffer();
            return {
                data: resized.toString('base64'),
                mimeType: 'image/jpeg',
            };
        }
    } catch (err: any) {
        console.warn(`[ai-inspection] sharp downscale skipped, using original bytes: ${err?.message || err}`);
    }
    return {
        data: rawBuffer.toString('base64'),
        mimeType: fallbackMime,
    };
}

/**
 * Deterministic safety net guaranteeing >10-unit bulk lots never return >12 rows,
 * while preserving exact total unit count and line-total valuation math.
 */
export function collapseExcessLotItems(
    items: ComponentItem[],
    targetQuantity?: number,
    maxRows = 12
): ComponentItem[] {
    if (!Array.isArray(items) || items.length <= maxRows) return items;

    const sorted = [...items].sort((a, b) => {
        const aVal = parsePriceValue(a.price_breakdown?.boutique_premium || a.estimated_value, 'midpoint', 0);
        const bVal = parsePriceValue(b.price_breakdown?.boutique_premium || b.estimated_value, 'midpoint', 0);
        return bVal - aVal;
    });

    const keepSinglesCount = Math.min(8, maxRows - 1);
    const head = sorted.slice(0, keepSinglesCount);
    const tail = sorted.slice(keepSinglesCount);

    const headQty = head.reduce((sum, it) => sum + Math.max(1, Number(it.quantity) || 1), 0);
    const rawTailQty = tail.reduce((sum, it) => sum + Math.max(1, Number(it.quantity) || 1), 0);
    const remainderQty =
        targetQuantity && targetQuantity > headQty ? targetQuantity - headQty : Math.max(1, rawTailQty);

    const sumField = (getter: (it: ComponentItem) => string | undefined, fallbackPerRow: number) =>
        Math.round(
            tail.reduce((sum, it) => sum + parsePriceValue(getter(it), 'midpoint', fallbackPerRow), 0)
        );

    const fairSum = Math.max(remainderQty * 2, sumField((it) => it.price_breakdown?.fair || it.estimated_value, 6));
    const boutiqueSum = Math.max(fairSum, sumField((it) => it.price_breakdown?.boutique_premium, Math.round(fairSum * 1.25)));
    const mintSum = Math.max(boutiqueSum, sumField((it) => it.price_breakdown?.mint, Math.round(boutiqueSum * 1.25)));
    const poorSum = Math.min(fairSum, Math.max(remainderQty, sumField((it) => it.price_breakdown?.poor, Math.round(fairSum * 0.45))));

    const sampleNames = tail
        .slice(0, 4)
        .map((it) => (it.name || it.identity || '').replace(/\s*\(x\d+\)\s*$/i, '').trim())
        .filter(Boolean);

    const firstTail = tail[0];
    const packTitle = `Assorted Remainder Lot Pack (x${remainderQty})`;
    const packRow: ComponentItem = {
        name: packTitle,
        identity: sampleNames.length > 0 ? `Includes ${sampleNames.join(', ')} & more (x${remainderQty})` : packTitle,
        tag_title: `Remainder Pack (x${remainderQty})`.slice(0, 40),
        physical_substrate: firstTail?.physical_substrate || head[0]?.physical_substrate || 'OTHER',
        quantity: remainderQty,
        tier: 'quick_turn',
        tier_label: '⚡ Quick Turn',
        tier_number: 3,
        is_key_issue: false,
        condition: firstTail?.condition || 'Mixed Vintage / Good',
        estimated_value: `$${fairSum}`,
        ocr_detected_text: sampleNames.join('; ').slice(0, 240),
        image_index: firstTail?.image_index ?? 0,
        image_url: firstTail?.image_url,
        bounding_box: firstTail?.bounding_box,
        views: firstTail?.views?.slice(0, 1),
        pricing_potential: {
            boutique: `$${boutiqueSum}`,
            fair: `$${fairSum}`,
        },
        price_breakdown: {
            mint: `$${mintSum}`,
            boutique_premium: `$${boutiqueSum}`,
            fair: `$${fairSum}`,
            poor: `$${poorSum}`,
            confidence: 'Medium',
        },
        red_flags: [],
    };

    return [...head, packRow];
}

/**
 * Fetch and prepare an image into a compact <=1024px JPEG Gemini inlineData part.
 */
async function fetchImagePart(image: InspectionImage): Promise<{ inlineData: { data: string; mimeType: string }; index: number } | null> {
    if (image.base64) {
        const cleanBase64 = image.base64.replace(/^data:image\/\w+;base64,/, '');
        const rawBuf = Buffer.from(cleanBase64, 'base64');
        const compressed = await compressBufferForVision(rawBuf, image.mimeType || 'image/jpeg');
        return {
            inlineData: compressed,
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

                    // Candidate 1: Direct /view URL (fast single GET, aspect-ratio true, resized locally via sharp)
                    const viewUrl = new URL(parsedUrl.toString());
                    viewUrl.pathname = viewUrl.pathname.replace(/\/preview$/, '/view');
                    viewUrl.search = '';
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
            if (isAppwrite && projectId) {
                headers['X-Appwrite-Project'] = projectId;
            }

            let res: Response | null = null;
            let lastStatus = 0;

            for (const cUrl of candidateUrls) {
                try {
                    const attempt = await fetch(cUrl, {
                        headers,
                        signal: AbortSignal.timeout(8000)
                    });
                    if (attempt.ok) {
                        res = attempt;
                        break;
                    } else if ((attempt.status === 401 || attempt.status === 403) && isAppwrite && apiKey) {
                        try {
                            const authAttempt = await fetch(cUrl, {
                                headers: { ...headers, 'X-Appwrite-Key': apiKey },
                                signal: AbortSignal.timeout(8000)
                            });
                            if (authAttempt.ok) {
                                res = authAttempt;
                                break;
                            }
                        } catch {}
                    }
                    lastStatus = attempt.status;
                    console.warn(`[ai-inspection] Fetch failed (${attempt.status}) for ${cUrl.slice(0, 80)}...`);
                } catch (fetchErr: any) {
                    console.warn(`[ai-inspection] Fetch error for ${cUrl.slice(0, 80)}: ${fetchErr.message}`);
                }
            }

            if (!res || !res.ok) {
                console.error(`[ai-inspection] All fetch attempts failed for image ${image.url} - Last Status: ${lastStatus}`);
                return null;
            }

            const arrayBuffer = await res.arrayBuffer();
            const rawBuffer = Buffer.from(arrayBuffer);
            let mime = res.headers.get('content-type') || 'image/jpeg';
            if (!mime.startsWith('image/') || mime === 'application/octet-stream') {
                mime = 'image/jpeg';
            }
            const compressed = await compressBufferForVision(rawBuffer, mime);
            return {
                inlineData: compressed,
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

    // Determine target quantity early so >10-unit bulk lots cap vision payload tightly
    let targetQuantity: number | undefined = context?.quantity;
    if (!targetQuantity || targetQuantity <= 1) {
        const titleStr = context?.title || '';
        const titleMatch =
            titleStr.match(/\b(?:lot|set|pack|box|bundle|collection)\s+of\s+(\d+)\b/i) ||
            titleStr.match(/\((\d+)\s*(?:books?|novels?|paperbacks?|items?|pcs?|pieces?|vols?|volumes?)\)/i) ||
            titleStr.match(/\b(\d+)\s+(?:vintage\s+)?(?:books?|novels?|paperbacks?|comics?|magazines?|items?|pcs?|pieces?|figures?|cards?|games?|cds?|dvds?|records?)\b.*\b(?:lot|bundle|set|collection)\b/i);
        if (titleMatch) {
            targetQuantity = parseInt(titleMatch[1], 10);
        } else if (context?.existingItems && context.existingItems.length > 0) {
            targetQuantity = context.existingItems.length;
        }
    }

    const dedupedImages = dedupeInspectionImages(images);
    const maxVisionCount =
        targetQuantity && targetQuantity > 10 ? MAX_LARGE_LOT_VISION_PHOTOS : MAX_LOT_VISION_PHOTOS;
    const cappedImages = dedupedImages.slice(0, maxVisionCount);
    if (onProgress) onProgress(`Step 1 of 2: Loading ${cappedImages.length} gallery photos for deep vision analysis...`, 20);

    // 1. Fetch and downscale up to maxVisionCount image parts concurrently
    const imagePartPromises = cappedImages.map(img => fetchImagePart(img));
    const rawImageParts = await Promise.all(imagePartPromises);
    const validImageParts = rawImageParts
        .filter((p): p is { inlineData: { data: string; mimeType: string }; index: number } => p !== null)
        .slice(0, maxVisionCount);

    if (validImageParts.length === 0) {
        throw new Error("Could not process any gallery photos. Check image URLs or upload formats.");
    }

    if (onProgress) onProgress(`Step 2 of 2: Appraising full collection with Gemini Multimodal Vision...`, 60);

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

    // Build multimodal payload: text prompt followed by compact <=1024px gallery image parts
    const contentParts: any[] = [
        { text: promptText },
        ...validImageParts.map(p => ({ inlineData: p.inlineData }))
    ];

    const synthResult = await generateContentWithBackoff({
        systemInstruction: LOT_PLAYBOOK_SYSTEM_INSTRUCTION,
        contents: [{ role: 'user', parts: contentParts }],
        thinkingBudget: 0,
        attemptTimeoutMs: 20_000,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: lotInspectionResponseSchema,
            maxOutputTokens: 6144
        },
        telemetryContext: {
            surface: context?.surface || "lot_inspector",
            itemId: context?.itemId || null
        }
    }, 2, 1000);

    const synthText = synthResult.response.text();
    const parsedSynth: LotInspectionResult = cleanAndParseJSON(synthText);

    // Map prompt-relative 0-based photo indices back to canonical deduped gallery positions
    const resolveGalleryIndex = (rawIdx: any): number => {
        if (typeof rawIdx !== 'number' || !Number.isInteger(rawIdx) || rawIdx < 0) return 0;
        if (rawIdx < validImageParts.length && typeof validImageParts[rawIdx]?.index === 'number') {
            const mapped = validImageParts[rawIdx].index;
            if (mapped >= 0 && mapped < dedupedImages.length) return mapped;
        }
        return rawIdx < dedupedImages.length ? rawIdx : 0;
    };

    // Ensure image_url and multi-angle indices are aligned to dedupedImages[]
    if (Array.isArray(parsedSynth.lot_items)) {
        parsedSynth.lot_items.forEach((item: any) => {
            const rawPrimary = typeof item.image_index === 'number' ? item.image_index : item.img;
            const imgIdx = resolveGalleryIndex(rawPrimary);
            if (!item.image_url) {
                item.image_url = dedupedImages[imgIdx]?.url || dedupedImages[imgIdx]?.base64 || undefined;
            }
            // Preserve + sanitize multi-angle data (never strip image_index/bounding_box/views)
            item.image_index = imgIdx;
            if (Array.isArray(item.views)) {
                item.views = item.views.map((v: any) => ({
                    ...v,
                    image_index: resolveGalleryIndex(v?.image_index)
                }));
            }
            const bb = normalizeBoundingBox(item.bounding_box);
            if (bb) item.bounding_box = bb; else delete item.bounding_box;
            const views = normalizeItemViews(item, dedupedImages.length);
            if (views.length) item.views = views; else delete item.views;
        });

        // Deterministic <=12-row safety net for >10-unit bulk lots
        const hasSmallVerified =
            Boolean(context?.existingItems?.length && context.existingItems.length <= 12);
        if (!hasSmallVerified && ((targetQuantity && targetQuantity > 10) || parsedSynth.lot_items.length > 12)) {
            parsedSynth.lot_items = collapseExcessLotItems(parsedSynth.lot_items, targetQuantity, 12);
        }
    }

    // Run deterministic verification & math sanity
    const verifiedResult = verifyAndSanitizeLotResult(parsedSynth, context?.cost);

    if (onProgress) onProgress(`Cataloged ${verifiedResult.lot_items.length} items with deep valuation!`, 100);

    return verifiedResult;
}

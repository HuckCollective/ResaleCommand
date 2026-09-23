import type { APIRoute } from 'astro';
import { model, generateContentWithBackoff } from '../../lib/gemini';

export const prerender = false;
export const maxDuration = 60;

export const POST: APIRoute = async ({ request }) => {
    try {
        if (!model) {
            return new Response(JSON.stringify({ error: 'AI model not configured. Missing GEMINI_API_KEY.' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const body = await request.json();
        const { mode, mainLot, existingChildren, candidates, item, mainLots } = body;

        // MODE 1: Find best inventory items to add into a Main Lot
        if (mode === 'find_items_for_lot') {
            if (!mainLot || !Array.isArray(candidates) || candidates.length === 0) {
                return new Response(JSON.stringify({ matches: [], message: 'No candidate items to evaluate.' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const excludedSet = new Set<string>();
            if (mainLot?.id) excludedSet.add(mainLot.id);
            if (mainLot?.parentLotId) excludedSet.add(mainLot.parentLotId);
            if (Array.isArray(body.excludedIds)) {
                body.excludedIds.forEach((id: string) => { if (id) excludedSet.add(id); });
            }

            // Strictly filter out sold, combined, deconstructed, current lot pieces, parent haul, and siblings
            const validCandidates = candidates.filter((c: any) => {
                const cid = c.$id || c.id;
                if (!cid || excludedSet.has(cid)) return false;
                const status = (c.status || '').toLowerCase().trim();
                if (['sold', 'combined', 'deconstructed'].includes(status)) return false;
                if (c.quantity !== undefined && Number(c.quantity) <= 0) return false;
                if (mainLot?.id && c.parentLotId === mainLot.id) return false;
                if (mainLot?.parentLotId && c.parentLotId && c.parentLotId === mainLot.parentLotId) return false;
                return true;
            });

            if (validCandidates.length === 0) {
                return new Response(JSON.stringify({ matches: [], message: 'No eligible candidate items to evaluate.' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Limit candidate items to 50 compact objects to conserve tokens
            const compactCandidates = validCandidates.slice(0, 50).map((c: any) => ({
                id: c.$id || c.id,
                title: (c.title || '').slice(0, 120),
                upc: c.upc || '',
                cost: Number(c.cost || 0),
                resalePrice: Number(c.resalePrice || c.price || 0),
                location: c.storageLocation || '',
                keywords: Array.isArray(c.keywords) ? c.keywords.slice(0, 8) : [],
                category: c.category || c.subCategory || '',
                notes: (c.condition_notes || c.conditionNotes || '').slice(0, 120)
            }));

            const existingList = Array.isArray(existingChildren) 
                ? existingChildren.map((e: any) => e.title || e).slice(0, 30)
                : [];

            const unitPrice = Number(mainLot.unitResalePrice || mainLot.resalePrice || 10);

            const prompt = `You are an expert multi-channel resale inventory curator and merchandising strategist for antique mall booths (Memory Den, Dusty Tiger) and online e-commerce (eBay, Etsy, Shopify).
A merchant is managing an active Main Lot and wants to add matching items from current inventory.

MAIN LOT TO ENRICH:
- Title: "${mainLot.title}"
- Target Unit Resale Price: $${unitPrice.toFixed(2)} / each
- Current Pieces (${existingList.length}): ${existingList.join(', ') || 'None cataloged yet'}
- Storage Location: "${mainLot.storageLocation || 'Unassigned'}"
- Tags / Keywords: "${Array.isArray(mainLot.keywords) ? mainLot.keywords.join(', ') : 'None'}"
- Curation Notes / Merchant Guidance: "${(mainLot.conditionNotes || '').slice(0, 300)}"

CANDIDATE IN-STOCK INVENTORY ITEMS:
${JSON.stringify(compactCandidates, null, 2)}

TASK:
Identify candidate items that have high merchandising synergy with this Main Lot, distinguishing between:
1. "combine": FORMAT / VOLUME COMBINE (Like-with-Like). Items of the exact same format/genre to build volume deals (e.g. 4 Fantasy paperbacks for $10 in a booth, or 5 books via Media Mail online).
2. "bundle": THEMATIC COMPANION BUNDLE (Cross-Category Lifestyle Curation). Complementary accessories, companion gear, or thematic artifacts that elevate the main item into an attractive, turnkey set (e.g. polyhedral dice bag or miniatures with D&D books; tooled leather belt with a felt western hat).

EVALUATION RULES & COMMERCIAL GUARDRAILS:
- COMMERCIAL PRICE-CLASS GUARDRAIL (CRITICAL):
  - The Main Lot's target unit price is ~$${unitPrice.toFixed(2)} each.
  - For "combine" matches: ONLY match individual items with comparable price points ($3 to $20) and matching physical format (e.g. single paperback novels with single paperback novels).
  - NEVER suggest merging expensive multi-item lots ($50 - $400), collector hardcovers, or large board game sets into a single paperback crate.
- MERCHANT GUIDANCE AUTHORITY:
  - If "Curation Notes / Merchant Guidance" mentions specific authors (e.g. Dragonlance, Forgotten Realms, Salvatore, Anne McCaffrey, Weis & Hickman) or formats, prioritize those matches above generic keyword overlap.
- Thematic Tag & Aesthetic Matching: Heavily weigh shared tags, genres, eras, subcultures, and franchises.
- Physical Location Affinity: Prefer items stored at the same location ("${mainLot.storageLocation || 'any'}") or unassigned backstock over items located at a different physical retail booth.
- Strict Zero-Hallucination & Rejection:
  - If candidate items do NOT share genuine format synergy or companion utility, DO NOT match them. Return {"matches": []}.
  - Only include items with matchScore >= 75.
  - Return at most 6 top items.

Return ONLY a valid JSON object in this exact format:
{
  "matches": [
    {
      "id": "item_id_from_candidates",
      "matchType": "combine" | "bundle",
      "matchScore": 95,
      "synergyReason": "Concise 1-sentence explanation of why this item fits as a combine or companion bundle",
      "estimatedValueBoost": 15.00
    }
  ]
}
Do NOT include markdown formatting or backticks. Return only valid JSON.`;

            const result = await generateContentWithBackoff(prompt);
            const text = result.response.text().trim();
            let cleanJson = text;
            if (cleanJson.startsWith('```json')) {
                cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleanJson.startsWith('```')) {
                cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }

            const parsed = JSON.parse(cleanJson);
            if (Array.isArray(parsed?.matches)) {
                parsed.matches = parsed.matches.filter((m: any) => m?.id && !excludedSet.has(m.id));
            }
            return new Response(JSON.stringify(parsed), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // MODE 2: Find best Main Lot for a loose item (vice versa)
        if (mode === 'find_lots_for_item') {
            if (!item || !Array.isArray(mainLots) || mainLots.length === 0) {
                return new Response(JSON.stringify({ matches: [], message: 'No active Main Lots available.' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const compactLots = mainLots.slice(0, 30).map((l: any) => ({
                id: l.$id || l.id,
                title: (l.title || '').slice(0, 120),
                itemCount: l.quantity || 1,
                cost: Number(l.cost || 0),
                resalePrice: Number(l.resalePrice || l.price || 0),
                location: l.storageLocation || '',
                keywords: Array.isArray(l.keywords) ? l.keywords.slice(0, 8) : [],
                notes: (l.conditionNotes || '').slice(0, 150)
            }));

            const prompt = `You are an expert multi-channel resale inventory curator and merchandising strategist.
A merchant has an individual item and wants to find the best existing Main Lot to fold it into as either a format combine or companion accessory bundle.

ITEM TO MERGE:
- Title: "${item.title}"
- Location: "${item.storageLocation || 'Unassigned'}"
- Tags / Keywords: "${Array.isArray(item.keywords) ? item.keywords.join(', ') : 'None'}"
- Notes / Context: "${(item.conditionNotes || '').slice(0, 200)}"

ACTIVE MAIN LOTS:
${JSON.stringify(compactLots, null, 2)}

TASK:
Identify Main Lots where this item has genuine merchandising synergy (either as a like-for-like combine or as a thematic companion bundle).
STRICT REJECTION CONSTRAINT:
- If this item does NOT genuinely belong with any of the active Main Lots (different category, format, or genre), RETURN AN EMPTY MATCHES ARRAY: {"matches": []}.
- Never force an item into an unrelated lot (e.g. do not put a shirt into a book lot).
- Only include matches with matchScore >= 75 (max 3 matches).

Return ONLY a valid JSON object in this exact format:
{
  "matches": [
    {
      "lotId": "lot_id_from_main_lots",
      "matchType": "combine" | "bundle",
      "matchScore": 92,
      "synergyReason": "Concise 1-sentence reason why this item belongs in this Main Lot"
    }
  ]
}
Do NOT include markdown formatting or backticks. Return only valid JSON.`;

            const result = await generateContentWithBackoff(prompt);
            const text = result.response.text().trim();
            let cleanJson = text;
            if (cleanJson.startsWith('```json')) {
                cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleanJson.startsWith('```')) {
                cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }

            const parsed = JSON.parse(cleanJson);
            return new Response(JSON.stringify(parsed), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ error: 'Invalid mode. Use "find_items_for_lot" or "find_lots_for_item".' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e: any) {
        console.error('[suggest-lot-matches] Error:', e);
        return new Response(JSON.stringify({ error: e.message || 'Failed to generate lot suggestions' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

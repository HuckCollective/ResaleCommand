import type { APIRoute } from 'astro';
import { getModel, generateContentWithBackoff, parseAiJson } from '../../lib/gemini';

export const prerender = false;

export interface AiBoothRowInput {
  sku: string;
  title: string;
  price: number;
  status?: string;
}

export interface AiInventoryCandidateInput {
  id: string;
  upc: string;
  title: string;
  price: number;
  cost: number;
  quantity: number;
  isParentLot: boolean;
  estimatedLotCount?: number;
  storageLocation: string;
}

export interface AiStagedMatchResult {
  sku: string;
  action: 'link' | 'split_lot' | 'create_new';
  candidateId: string | null;
  confidence: number;
  reason: string;
  estimatedLotPieces?: number;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const rows: AiBoothRowInput[] = Array.isArray(body?.rows) ? body.rows : [];
    const candidates: AiInventoryCandidateInput[] = Array.isArray(body?.candidates)
      ? body.candidates
      : [];

    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, matches: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const compactRows = rows.slice(0, 25).map((r) => ({
      sku: String(r.sku || '').trim(),
      title: String(r.title || '').trim(),
      price: Number(r.price || 0),
    }));

    const compactCandidates = candidates.slice(0, 120).map((c) => ({
      id: String(c.id || '').trim(),
      upc: String(c.upc || '').trim(),
      title: String(c.title || '').trim(),
      price: Number(c.price || 0),
      cost: Number(c.cost || 0),
      qty: Number(c.quantity || 1),
      isLot: Boolean(c.isParentLot),
      lotPcs: Number(c.estimatedLotCount || c.quantity || 1),
      loc: String(c.storageLocation || 'HG'),
    }));

    const prompt = `You are the Principal Inventory Reconciliation Architect for Resale Command (Memory Den Vintage Mall Booth #0EJ).
Your job is to evaluate each unlinked Memory Den booth row ("rows") against unclaimed Resale Command inventory & multi-piece backstock lots ("candidates").

STRICT ANTI-HALLUCINATION & CONFIDENCE CALIBRATION RULES:
1. DISTINCTIVE TOKENS REQUIRED FOR HIGH CONFIDENCE (88-99):
   - Only assign "confidence" >= 88 when specific identifying titles, franchises, model numbers, or explicitly named lot components match (e.g., "Corvus Belli Infinity N4" matching "HUCK-0453 Corvus Belli Infinity N4", or "D&D 3.5e Dungeon Master's Guide" matching "HUCK-0467 Lot of 5: D&D 3.5e Eberron Campaign Setting, Player's Handbook, Dungeon Master's Guide, Monster Manual").
2. COLOR, PRINT & EDITION CONFLICTS MUST BE REJECTED ("create_new"):
   - NEVER match apparel/accessories that share only a brand and garment type when their color or print conflicts! For example, "Banana Republic Women's Red Black Animal Print Long Sleeve Blouse" MUST NOT match "Banana Republic Navy Dash Print Blouse" -> set "action": "create_new", "candidateId": null.
3. ENUMERATED LOTS vs UN-ENUMERATED BOXED SET / CATEGORY LOTS ("split_lot"):
   - NEVER match a specific RPG book/boxed set (like "AD&D Planescape Campaign Setting Boxed Set") to a lot that explicitly enumerates DIFFERENT books/settings (like "HUCK-0467 Lot of 5: D&D 3.5e Eberron Campaign Setting, Player's Handbook, Dungeon Master's Guide, Monster Manual").
   - Instead, if there is a generic un-enumerated lot of the matching form factor (such as "HUCK-0790" "Lot Of 5 Pcs Dungeons And Dragons Boxed Sets Fantasy RPG Campaign Books" for "AD&D Planescape Campaign Setting Boxed Set"), recommend "action": "split_lot" with "candidateId" set to that generic Boxed Sets lot's "id" and "confidence": 76 (Review tier, < 88).
4. TRULY NEW BOOTH ITEMS ("create_new"):
   - If no candidate is a genuine match or plausible parent lot, set "action": "create_new", "candidateId": null, "confidence": 95, and give a concise reason (e.g. "No matching Red Black Animal Print blouse in inventory — add as new booth item").
5. Return ONLY valid JSON matching this exact schema (include an entry for EVERY row in "rows"):
{
  "matches": [
    {
      "sku": "0EJ...",
      "action": "link" | "split_lot" | "create_new",
      "candidateId": "<exact candidate.id string or null>",
      "confidence": 76,
      "reason": "Short 1-line explanation",
      "estimatedLotPieces": 5
    }
  ]
}

UNLINKED BOOTH ROWS:
${JSON.stringify(compactRows)}

UNCLAIMED INVENTORY & PARENT LOT CANDIDATES:
${JSON.stringify(compactCandidates)}`;

    const model = getModel('gemini-2.5-flash');
    const result = await generateContentWithBackoff(model, prompt);
    const responseText = result.response.text();
    const parsed = parseAiJson<{ matches?: AiStagedMatchResult[] }>(
      responseText,
      'ai-match-booth-items'
    );
    const matches = Array.isArray(parsed?.matches) ? parsed.matches : [];

    return new Response(
      JSON.stringify({
        ok: true,
        matches,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('[/api/ai-match-booth-items] Error:', err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: err?.message || 'AI Smart-Stage failed',
        matches: [],
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

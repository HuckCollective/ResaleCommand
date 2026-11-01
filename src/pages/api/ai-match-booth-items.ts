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

    const compactRows = rows.slice(0, 60).map((r) => ({
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
Your job is to stage high-confidence recommendations matching unlinked Memory Den booth rows ("rows") against unclaimed Resale Command inventory & multi-piece backstock lots ("candidates").

CRITICAL RULES:
1. SINGLE ITEMS ("link"): If a booth row clearly matches a single-piece candidate (by brand, noun, edition, subject, or exact/close price), set "action": "link", "candidateId": "<candidate.id>", and "confidence" (0-100). A single-piece candidate ("isLot": false and "qty": 1) can only be linked to AT MOST ONE booth row.
2. MULTI-PIECE PARENT LOTS ("split_lot"): Many backstock items are unsplit bulk lots (e.g., "Lot of 5 Heavy Metal Magazines", "18 Pcs Vintage Pins Lot", "Lot of 4 RPG Sourcebooks", "isLot": true or "qty" > 1). Multiple booth rows CAN match the SAME Parent Lot! When a booth row is one piece from a Parent Lot, set "action": "split_lot", "candidateId": "<lot.id>", "estimatedLotPieces": <number of pieces in lot>, and "confidence" (0-100).
3. TRULY NEW BOOTH ITEMS ("create_new"): If no candidate is a plausible match (confidence < 50), set "action": "create_new", "candidateId": null, "confidence": 95, and explain why it should be added as a new booth item.
4. Return ONLY valid JSON matching this schema:
{
  "matches": [
    {
      "sku": "0EJ...",
      "action": "link" | "split_lot" | "create_new",
      "candidateId": "string or null",
      "confidence": 85,
      "reason": "Short 1-line explanation (e.g. 'Exact brand + title match ($28)' or '1 piece from Lot of 5 Heavy Metal Mags ($2.40/ea cost)')",
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
    const parsed = parseAiJson<{ matches?: AiStagedMatchResult[] }>(responseText, 'ai-match-booth-items');
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


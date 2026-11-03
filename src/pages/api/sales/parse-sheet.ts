import type { APIRoute } from 'astro';
import { getModel, generateContentWithBackoff, parseAiJson } from '../../../lib/gemini';
import { getLocationSettingMeta } from '../../../lib/warehouses';

export const prerender = false;
export const maxDuration = 120;

export interface ParsedSalesSheetLine {
    date: string;
    title: string;
    upc: string;
    soldPrice: number;
    qty: number;
    ticketNumber?: string;
    notes?: string;
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const rawImageBase64: string = String(body?.imageBase64 || '').trim();
        const locationCodeInput: string = String(body?.locationCode || '').trim();
        const locMeta = getLocationSettingMeta(locationCodeInput);

        if (!rawImageBase64) {
            return new Response(
                JSON.stringify({ ok: false, error: 'Missing imageBase64 payload', rows: [] }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        let mimeType = String(body?.mimeType || 'image/jpeg').trim();
        let base64Data = rawImageBase64;
        if (rawImageBase64.startsWith('data:')) {
            const match = rawImageBase64.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
                mimeType = match[1] || 'image/jpeg';
                base64Data = match[2];
            } else {
                const commaIdx = rawImageBase64.indexOf(',');
                if (commaIdx !== -1) {
                    base64Data = rawImageBase64.slice(commaIdx + 1);
                }
            }
        }

        const todayIso = new Date().toISOString().slice(0, 10);

        const prompt = `You are the Principal Accounting & OCR Extraction Engine for Resale Command at ${locMeta.fullName} (${locMeta.code}, ${locMeta.feePct}% booth commission).
Inspect this photograph of a handwritten or printed consignment booth sales sheet / tally ledger.

STRICT EXTRACTION RULES:
1. Extract every individual sold item line written or printed on the sheet.
2. Ignore blank lines, crossed-out/voided lines, page headers, column headers, and bottom summary/total lines (unless a rent deduction is explicitly noted).
3. For each sold line extract:
   - "date": Date of sale in YYYY-MM-DD format if visible (if only month/day like "10/28" is written, assume current year ${new Date().getFullYear()}; if no date is written on the row, use the sheet header date or "${todayIso}").
   - "title": Full legible item description/title as written on the sheet (e.g., "Vintage Brass Dragon Pin", "Obsidian Crystal Wand", "Sterling Silver Ring").
   - "upc": Any barcode, tag number, or booth SKU written on the line (e.g., "HUCK-0412", "PDXGL-0105", "${locMeta.skuPrefix}12", or "" if none is written).
   - "soldPrice": Gross unit or line sale price as a number (e.g. 18.00). Never concatenate price ranges.
   - "qty": Quantity sold as an integer >= 1 (default 1).
   - "ticketNumber": Optional receipt/line/ticket number if written, otherwise "".
4. If the sheet explicitly lists a booth rent deduction amount, return it in "detectedRent" (number, or 0 if not listed).
5. Return ONLY valid JSON matching this exact schema:
{
  "sheetTitle": "Optional header/month label from sheet",
  "detectedRent": 0,
  "rows": [
    {
      "date": "${todayIso}",
      "title": "Handwritten item description",
      "upc": "HUCK-0123",
      "soldPrice": 15.00,
      "qty": 1,
      "ticketNumber": ""
    }
  ]
}`;

        const model = getModel('gemini-2.5-flash');
        const result = await generateContentWithBackoff(model, [
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType,
                },
            },
        ]);

        const responseText = result.response.text();
        const parsed = parseAiJson<{
            sheetTitle?: string;
            detectedRent?: number;
            rows?: ParsedSalesSheetLine[];
        }>(responseText, 'sales-parse-sheet');

        const rawRows = Array.isArray(parsed?.rows) ? parsed.rows : [];
        const cleanRows: ParsedSalesSheetLine[] = rawRows
            .filter((r) => r && (String(r.title || '').trim() || Number(r.soldPrice) > 0))
            .map((r) => ({
                date: String(r.date || todayIso).trim() || todayIso,
                title: String(r.title || 'Booth Sale Item').trim(),
                upc: String(r.upc || '').trim().toUpperCase(),
                soldPrice: Math.max(0, Number(Number(r.soldPrice || 0).toFixed(2))),
                qty: Math.max(1, Math.round(Number(r.qty || 1))),
                ticketNumber: String(r.ticketNumber || '').trim(),
            }));

        return new Response(
            JSON.stringify({
                ok: true,
                sheetTitle: parsed?.sheetTitle || `${locMeta.shortName} Sales Sheet`,
                detectedRent: Number(parsed?.detectedRent || 0),
                rows: cleanRows,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (err: any) {
        console.error('[/api/sales/parse-sheet] Error:', err);
        return new Response(
            JSON.stringify({
                ok: false,
                error: err?.message || 'Failed to parse sales sheet photo',
                rows: [],
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};


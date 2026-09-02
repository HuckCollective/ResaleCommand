import type { APIRoute } from 'astro';
import { model, generateContentWithBackoff } from '../../lib/gemini';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const rawImages: string[] = Array.isArray(body.images) ? body.images : (body.image ? [body.image] : []);

        if (rawImages.length === 0) {
            return new Response(JSON.stringify({ error: "Missing image data" }), { status: 400 });
        }

        const imageParts = rawImages.map(imgStr => {
            const matches = imgStr.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/s);
            let mimeType = "image/jpeg";
            let base64Data = imgStr;
            if (matches) {
                mimeType = matches[1];
                base64Data = matches[2];
            } else {
                base64Data = imgStr.replace(/^data:image\/[^;]+;base64,/, '');
            }
            return {
                inlineData: {
                    data: base64Data.trim(),
                    mimeType
                }
            };
        });

        const prompt = `
You are an expert OCR receipt and financial transaction parser specializing in thrift stores (Goodwill, Salvation Army, Savers, St. Vincent de Paul), estate sales, and retail invoices.

Analyze the receipt image(s) with extreme precision. Extract:
1. STORE / VENDOR: The store name at top (e.g. "Goodwill - Happy Valley" or "Goodwill").
2. DATE: Transaction date in YYYY-MM-DD format (or estimate if faded).
3. TOTAL SPENT: The final printed GRAND TOTAL charged.
4. PURCHASED LINE ITEMS:
   - STRICT PAIRING: Pair every item description EXACTLY with the price printed on that same line.
   - DO NOT extract header text, customer rewards status, cashier greetings, or membership banners as items (e.g., "New Goodwill Plus Enrollee", "GP1017791401", "Rewards Member", "Cashier: 44202" are NOT purchased items).
   - Ignore disclaimer sub-lines (e.g. "Item Sold As Is. No Returns").
   - Ignore discounts/coupons from the items list (e.g. "5% off $20 ($3.35)") so only actual purchased items are listed, but ensure the final "total" reflects the net GRAND TOTAL paid.
   - For every purchased item, output:
     * title: Clean description (e.g. "Decor Glass/Metal - Yellow", "360 Stretch Active Mesh - Zones", "Books - Purple", "Paper Bag").
     * cost: Exact dollar cost for that specific line item (e.g. 24.99, 12.99, 2.99, 0.10).
     * quantity: Number of units (default 1).

Return a STRICT JSON object:
{
    "vendor": "Goodwill - Happy Valley",
    "date": "2026-08-16",
    "total": 63.66,
    "items": [
        {
            "title": "Decor Glass/Metal - Yellow",
            "cost": 24.99,
            "quantity": 1
        },
        {
            "title": "360 Stretch Active Mesh - Zones",
            "cost": 12.99,
            "quantity": 1
        }
    ]
}
`;

        const result = await generateContentWithBackoff([prompt, ...imageParts]);
        
        let responseText = '';
        try {
            responseText = result.response.text();
        } catch (textErr) {
            const candidate = result.response?.candidates?.[0];
            const part = candidate?.content?.parts?.[0];
            if (part && 'text' in part && part.text) {
                responseText = part.text;
            } else {
                throw new Error("Receipt image content could not be read.");
            }
        }
        
        // Clean up markdown formatting
        responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        let parsedJson;
        try {
            parsedJson = JSON.parse(responseText);
        } catch (e) {
            // Attempt to find JSON object substring
            const firstBrace = responseText.indexOf('{');
            const lastBrace = responseText.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace > firstBrace) {
                try {
                    parsedJson = JSON.parse(responseText.substring(firstBrace, lastBrace + 1));
                } catch (subErr) {
                    console.error("Failed to parse extracted JSON substring:", responseText);
                    return new Response(JSON.stringify({ error: "Failed to parse receipt correctly. Please try again." }), { status: 500 });
                }
            } else {
                console.error("Gemini did not return valid JSON:", responseText);
                return new Response(JSON.stringify({ error: "Failed to parse receipt correctly. Please try again." }), { status: 500 });
            }
        }

        return new Response(JSON.stringify(parsedJson), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        console.error('Error parsing receipt:', err);
        return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), { status: 500 });
    }
};

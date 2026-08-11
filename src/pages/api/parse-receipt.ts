import type { APIRoute } from 'astro';
import { model, generateContentWithBackoff } from '../../lib/gemini';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const base64Image = body.image;

        if (!base64Image) {
            return new Response(JSON.stringify({ error: "Missing image data" }), { status: 400 });
        }

        // Clean base64 string
        const base64Data = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
        let mimeType = "image/jpeg";
        if (base64Image.startsWith("data:image/png")) mimeType = "image/png";
        else if (base64Image.startsWith("data:image/webp")) mimeType = "image/webp";

        const prompt = `
You are an expert OCR receipt parser. Read the provided receipt image and extract the purchased line items.
Focus on extracting the items that are likely products or merchandise. Ignore taxes, totals, discounts, or payment details.

Return a STRICT JSON object with the following structure:
{
    "vendor": "Name of the store (e.g. Goodwill, Salvation Army)",
    "date": "Date of purchase in YYYY-MM-DD format (if found)",
    "items": [
        {
            "title": "Exact text of the line item (e.g. MENS L/S, HH BRIC A BRAC)",
            "cost": 4.99,
            "quantity": 1
        }
    ]
}

Only return the raw JSON object, no markdown formatting like \`\`\`json.
`;

        const imagePart = {
            inlineData: {
                data: base64Data,
                mimeType
            }
        };

        const result = await generateContentWithBackoff(model, [prompt, imagePart]);
        let responseText = result.response.text();
        
        // Clean up markdown if model accidentally adds it
        responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        let parsedJson;
        try {
            parsedJson = JSON.parse(responseText);
        } catch (e) {
            console.error("Gemini did not return valid JSON:", responseText);
            return new Response(JSON.stringify({ error: "Failed to parse receipt correctly. Please try again." }), { status: 500 });
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

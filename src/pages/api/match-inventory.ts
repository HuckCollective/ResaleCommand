import type { APIRoute } from 'astro';
import { genAI, model, generateContentWithBackoff } from '../../lib/gemini';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { unmatchedCsvItems, availableDbItems } = body;

        if (!unmatchedCsvItems || !availableDbItems) {
            return new Response(JSON.stringify({ error: 'Missing required arrays' }), { status: 400 });
        }

        if (!model) {
            return new Response(JSON.stringify({ error: 'AI model not configured.' }), { status: 500 });
        }

        const prompt = `
You are an expert data mapping assistant for a resale business.
I have two lists of inventory items. The first list is from a CSV export from a point-of-sale system, and the second list is from our internal database.
Because of typos, abbreviations, or missing words, standard exact-string matching failed.

Your task is to intelligently match the CSV items to the correct Database items based on their titles.

List 1: Unmatched CSV Items
${JSON.stringify(unmatchedCsvItems, null, 2)}

List 2: Available Database Items
${JSON.stringify(availableDbItems, null, 2)}

Return a JSON array of mappings. Only include confident matches. 
Format:
[
  { "csvIndex": number, "dbId": "string_id_from_db" }
]
Do not return any markdown formatting, only raw JSON.
`;

        const result = await generateContentWithBackoff(prompt);
        const text = result.response.text();
        
        // Try to parse out the JSON, stripping backticks if Gemini added them
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        const parsedMappings = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

        return new Response(JSON.stringify({ mappings: parsedMappings }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        console.error("AI Matching Error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};

import type { APIRoute } from 'astro';
import { model, generateContentWithBackoff } from '../../lib/gemini';

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

        // Limit payloads to avoid token overflow
        const csvSubset = unmatchedCsvItems.slice(0, 100);
        const dbSubset = availableDbItems.slice(0, 300);

        const prompt = `
You are an expert resale inventory data mapping assistant.
I have two lists of inventory items:
List 1 is from an external consignment booth / POS CSV export.
List 2 is our internal ResaleCommand database catalog.

Many items could not be matched by simple string comparison due to:
- Abbreviations: "L5R" = "Legend of the Five Rings", "DnD" / "D&D" = "Dungeons & Dragons", "AD&D" = "Advanced Dungeons & Dragons", "ETB" = "Elite Trainer Box", "MtG" = "Magic: The Gathering", "CCG" = "Collectible Card Game", "PHB" = "Player's Handbook", "DMG" = "Dungeon Master's Guide", "MM" = "Monster Manual", "SC" = "Softcover", "HC" = "Hardcover", "AEG" = "Alderac Entertainment Group".
- Subtitle/edition variations: "Sourcebook: Secrets of the Crab" vs "Secrets of the Crab SC AEG RPG Supplement".
- Brand abbreviations: "Doc Martens" / "Dr. Martens", "FP" = "Free People", "WH40K" = "Warhammer 40,000", "LotR" = "Lord of the Rings".
- Truncated names or minor typos.

List 1 (CSV Items):
${JSON.stringify(csvSubset, null, 2)}

List 2 (Database Catalog Items):
${JSON.stringify(dbSubset, null, 2)}

Match each CSV item to its corresponding Database item if you are confident they are the same product.
Return ONLY a valid JSON array of matches:
[
  { 
    "csvIndex": 0, 
    "dbId": "database_document_id",
    "confidence": 0.95,
    "reason": "Matched 'L5R Crab' to 'Legend of the Five Rings: Secrets of the Crab'"
  }
]
Do NOT include markdown formatting or backticks. Return only pure JSON array.
`;

        const result = await generateContentWithBackoff(prompt);
        const text = result.response.text().trim();
        
        // Clean out possible markdown code blocks
        let cleanJson = text;
        if (cleanJson.startsWith('```json')) {
            cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanJson.startsWith('```')) {
            cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        const jsonMatch = cleanJson.match(/\[[\s\S]*\]/);
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

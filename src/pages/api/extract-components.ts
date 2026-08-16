import type { APIRoute } from 'astro';
import { model, generateContentWithBackoff } from '../../lib/gemini';

export const prerender = false;

export const ALL: APIRoute = async ({ request }) => {
    // 1. Handle Preflight / CORS
    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, PUT, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, X-Client-Claim",
            }
        });
    }

    if (request.method !== "POST" && request.method !== "PUT") {
         return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
    }

    try {
        if (!model) {
            return new Response(JSON.stringify({ error: 'Gemini not configured' }), { 
                status: 500, headers: { "Access-Control-Allow-Origin": "*" } 
            });
        }

        let imageParts: Array<{ inlineData: { data: string; mimeType: string } }> = [];
        
        let rawBody = "";
        try {
            const ab = await request.arrayBuffer();
            if (ab.byteLength > 0) rawBody = new TextDecoder().decode(ab);
            else rawBody = await request.text();
        } catch (e) {
            return new Response(JSON.stringify({ error: "Read Failed" }), { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
        }

        if (!rawBody || rawBody.length === 0) {
            return new Response(JSON.stringify({ error: "Empty Body" }), { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
        }

        if (rawBody.trim().startsWith("data:")) {
            const parts = rawBody.split(",");
            const match = parts[0].match(/:(.*?);/);
            const mime = match ? match[1] : "image/jpeg";
            imageParts.push({ inlineData: { data: parts[1], mimeType: mime } });
        } else if (rawBody.trim().startsWith("{")) {
            try {
                const json = JSON.parse(rawBody);
                let userNotes = "";
                if (json.notes) {
                    userNotes = json.notes;
                }

                const processDataUrl = (url: string) => {
                     if (url.startsWith("data:")) {
                         const parts = url.split(",");
                         const match = parts[0].match(/:(.*?);/);
                         let mime = match ? match[1] : "image/jpeg";
                         if (!mime || mime === 'application/octet-stream' || !mime.startsWith('image/')) {
                             mime = 'image/jpeg';
                         }
                         return { inlineData: { data: parts[1], mimeType: mime } };
                     }
                     return null;
                };

                if (Array.isArray(json.images)) {
                    json.images.forEach((img: string) => {
                        const part = processDataUrl(img);
                        if (part) imageParts.push(part);
                    });
                } else if (json.image) {
                     const part = processDataUrl(json.image);
                     if (part) imageParts.push(part);
                }
            } catch (e) {}
        } 

        if (imageParts.length === 0) {
            return new Response(JSON.stringify({ error: "Parsing Failed", details: "No image data found." }), { 
                status: 400, headers: { "Access-Control-Allow-Origin": "*" }
            });
        }

        let promptContext = "";
        if (rawBody.trim().startsWith("{")) {
            try {
                const json = JSON.parse(rawBody);
                if (json.notes) {
                    promptContext = `\nCONTEXT / USER NOTES: "${json.notes}"\n`;
                }
            } catch(e) {}
        }

        const prompt = `
          Analyze this image to extract a comprehensive inventory of components. 
          Usually this represents the back of a board game box, a TTRPG set, or an electronics bundle detailing its "Contents".
          ${promptContext}
          TASK:
          Extract every distinct component listed and its expected quantity. 
          If the image is NOT the back of a box, but rather a pile of physical items laid out, try your best to identify and count each distinct item you see.
          If both a box list and loose items are visible, prefer the stated contents list on the box as the source of truth.
          
          OUTPUT FORMAT:
          Return strictly a JSON object with a single property "components" which is an array of objects.
          
          Object structure:
          - 'name': The name of the component (e.g. "Game Board", "Red Tokens", "Rulebook").
          - 'expected': The quantity expected (integer).
          - 'found': Set to 0.
          - 'verified': Set to false.
          
          Example:
          {
             "components": [
                { "name": "Game Board", "expected": 1, "found": 0, "verified": false },
                { "name": "Character Cards", "expected": 50, "found": 0, "verified": false }
             ]
          }
        `;

        const contentParts: any[] = [{ text: prompt }, ...imageParts];
        
        const result = await generateContentWithBackoff({
            contents: [{ role: 'user', parts: contentParts }],
            generationConfig: { responseMimeType: "application/json" }
        });
        const response = await result.response;
        const taskResponse = response.text();
        
        // Clean up markdown array if any
        let cleanedResponse = taskResponse.replace(/```json|```/g, '').trim();

        return new Response(cleanedResponse, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                "Access-Control-Allow-Origin": "*"
            }
        });

    } catch (error: any) {
        console.error("Contents Verification Error:", error);
        return new Response(JSON.stringify({ error: 'Verification failed', details: error.message }), { 
            status: 500, headers: { "Access-Control-Allow-Origin": "*" }
        });
    }
}

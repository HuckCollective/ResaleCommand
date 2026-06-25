import type { APIRoute } from 'astro';
import { Client, Databases, Query, ID, Storage, Permission, Role } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { model, generateContentWithBackoff } from '../../lib/gemini';

export const prerender = false;

// Initialize Server-Side Appwrite Client
const ENDPOINT = import.meta.env.PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = import.meta.env.PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = import.meta.env.APPWRITE_API_KEY || process.env.APPWRITE_API_KEY;

const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID);

if (API_KEY) {
    client.setKey(API_KEY as string);
}

const db = new Databases(client);
const storage = new Storage(client);

const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || "resale_db";
const ITEMS_COL = import.meta.env.PUBLIC_APPWRITE_COLLECTION_ID || "items";
const BUCKET_ID = import.meta.env.PUBLIC_APPWRITE_BUCKET_ID || "item_images";
const API_KEYS_COL = "api_keys";

export const ALL: APIRoute = async ({ request }) => {
    // 1. CORS Preflight
    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            }
        });
    }

    if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
    }

    try {
        // 2. Headless API Key Auth Check
        const authHeader = request.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return new Response(JSON.stringify({ error: "Unauthorized", details: "Missing or invalid Authorization header" }), { status: 401 });
        }
        
        const providedKey = authHeader.split(" ")[1];
        
        const keysList = await db.listDocuments(DB_ID, API_KEYS_COL, [
            Query.equal("key", providedKey),
            Query.equal("isActive", true)
        ]);
        
        if (keysList.total === 0) {
            return new Response(JSON.stringify({ error: "Forbidden", details: "Invalid or inactive API Key" }), { status: 403 });
        }
        
        const apiKeyDoc = keysList.documents[0];
        const tenantId = apiKeyDoc.tenantId;

        if (!tenantId) {
             return new Response(JSON.stringify({ error: "Server Configuration Error", details: "API Key lacks a valid tenantId" }), { status: 500 });
        }

        if (!model) {
            return new Response(JSON.stringify({ error: "Service Unavailable", details: "Gemini AI not configured on server" }), { status: 500 });
        }

        // 3. Parse JSON Body Payload
        const body = await request.json().catch(() => ({}));
        const imageUrl = body.imageUrl;
        const notes = body.notes || "";
        const givenTitle = body.title || ""; // Optional user title override

        if (!imageUrl) {
             return new Response(JSON.stringify({ error: "Bad Request", details: "Missing strictly required 'imageUrl' property in JSON body." }), { status: 400 });
        }

        // 4. Fetch the remote image to buffer
        console.log(`[Headless] Fetching image: ${imageUrl}`);
        const imgRes = await fetch(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0 ResaleCommand/Headless' } });
        if (!imgRes.ok) {
            throw new Error(`Failed to fetch image: ${imgRes.status} ${imgRes.statusText}`);
        }
        
        const arrayBuffer = await imgRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mime = imgRes.headers.get('content-type') || 'image/jpeg';
        
        // Ensure image fits Gemini rules
        if (!mime.startsWith('image/')) {
             throw new Error("Target URL is not a valid image format for AI processing.");
        }

        const base64 = buffer.toString('base64');
        const imagePart = { inlineData: { data: base64, mimeType: mime } };

        // 5. Ask Gemini to analyze the image
        const prompt = `
          Analyze this item for resale purposes.
          
          USER SUPPLIED CONTEXT OR TITLE: "${notes || givenTitle}"
          
          TASK:
          1. Specifically identify the main item in the image.
          2. Estimate the resale price in USD based on general secondary market knowledge.
          3. Determine the condition based on the image (if visible) or default to 'used'.
          
          Return strictly a JSON object with this exact structure:
          {
            "identity": "Brief specific identifier (e.g. Sony Walkman WM-F1)",
            "title": "Optimized SEO listing title",
            "keywords": ["tag1", "tag2", "tag3", "Sony"],
            "conditionNotes": "Visible condition observations",
            "resalePrice": 25.00
          }
        `;

        console.log("[Headless] Sending to Gemini...");
        const result = await generateContentWithBackoff([prompt, imagePart]);
        const responseText = result.response.text();
        const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
        
        let aiData;
        try {
            aiData = JSON.parse(cleanedResponse);
        } catch (e) {
            throw new Error(`Failed to parse AI response: ${cleanedResponse}`);
        }

        // 6. Upload Photo to Appwrite Storage
        console.log("[Headless] Uploading image to Appwrite...");
        let imageId: string | null = null;
        try {
            const inputFile = InputFile.fromBuffer(buffer, `scouted_${Date.now()}.jpg`);
            const uploadRes = await storage.createFile(
                BUCKET_ID,
                ID.unique(),
                inputFile
            );
            imageId = uploadRes.$id;
        } catch (uploadErr) {
            console.error("Headless upload failed:", uploadErr);
             // We'll continue even if upload fails, just won't have the image
        }

        // 7. Save to Appwrite Inventory (Items Collection)
        console.log("[Headless] Saving Document to Database...");
        
        // Safely extract boutique price
        const btqNum = parseFloat(aiData.price_breakdown?.boutique_premium);
        const btqStr = !isNaN(btqNum) && btqNum > 0 ? `\nBoutique: $${btqNum.toFixed(2)}` : '';

        // Define data per schema with 'scouted' default
        const itemDocument = {
            identity: aiData.identity || givenTitle || "Unidentified Item",
            title: givenTitle || aiData.title || "New Item",
            keywords: aiData.keywords || [],
            conditionNotes: (notes ? `Import notes: ${notes}\n` : "") + (aiData.conditionNotes || "") + btqStr,
            redFlags: [],
            paidPrice: 0.0,
            resalePrice: parseFloat(aiData.resalePrice) || parseFloat(aiData.price_breakdown?.fair) || 0.0,
            maxBuyPrice: 0.0,
            sourcingLocation: "Headless Import",
            storageLocation: "To Be Processed",
            status: "scouted", // The new initial status
            tenantId: tenantId, 
            imageId: imageId || "",
        };

        const permissions = [
            Permission.read(Role.team(tenantId)),
            Permission.update(Role.team(tenantId)),
            Permission.delete(Role.team(tenantId)),
            Permission.read(Role.user(tenantId)),
            Permission.update(Role.user(tenantId)),
            Permission.delete(Role.user(tenantId))
        ];

        const createdItem = await db.createDocument(
             DB_ID,
             ITEMS_COL,
             ID.unique(),
             itemDocument,
             permissions
        );

        console.log(`[Headless] Success! Item ${createdItem.$id} created.`);

        // 8. Return Success Payload
        return new Response(JSON.stringify({ 
            success: true, 
             message: "Item scouted and saved successfully.",
            itemId: createdItem.$id,
            aiAnalysis: aiData
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                "Access-Control-Allow-Origin": "*"
            }
        });

    } catch (error: any) {
        console.error("Headless API Error:", error);
        return new Response(JSON.stringify({ 
            error: 'Server Error', 
            details: error instanceof Error ? error.message : "Unknown error processing request" 
        }), { 
            status: 500,
            headers: { "Access-Control-Allow-Origin": "*" }
        });
    }
}

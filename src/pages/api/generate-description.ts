export const prerender = false;

import { Client, Databases, Storage } from 'node-appwrite';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Buffer } from 'node:buffer';
import type { APIRoute } from 'astro';
import { generateContentWithBackoff } from '../../lib/gemini';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { itemId } = body;
        
        console.log(`[API] generating description for item: ${itemId}`);

        if (!itemId) {
            return new Response(JSON.stringify({ error: 'Item ID is required' }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check Env
        const apiKey = import.meta.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('[API] Missing GEMINI_API_KEY');
            return new Response(JSON.stringify({ error: 'Server configuration error: Missing Gemini API Key' }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Initialize Appwrite (Server-side)
        const client = new Client();
        client
            .setEndpoint(import.meta.env.PUBLIC_APPWRITE_ENDPOINT)
            .setProject(import.meta.env.PUBLIC_APPWRITE_PROJECT_ID);

        const jwt = request.headers.get('X-Appwrite-JWT');
        if (jwt) {
            console.log('[API] Using client JWT for authentication');
            client.setJWT(jwt);
        } else if (import.meta.env.APPWRITE_API_KEY) {
            console.log('[API] Using server API key for authentication');
            client.setKey(import.meta.env.APPWRITE_API_KEY);
        }

        const databases = new Databases(client);
        const storage = new Storage(client);

        // Helper to run read operations with fallback to guest client if the primary client is unauthorized (401)
        const executeRead = async <T>(operation: (db: Databases, stor: Storage) => Promise<T>): Promise<T> => {
            try {
                return await operation(databases, storage);
            } catch (err: any) {
                if (err.code === 401) {
                    console.warn('[API] Appwrite read failed with 401 (unauthorized). Retrying with anonymous/guest access...');
                    const guestClient = new Client()
                        .setEndpoint(import.meta.env.PUBLIC_APPWRITE_ENDPOINT)
                        .setProject(import.meta.env.PUBLIC_APPWRITE_PROJECT_ID);
                    const guestDatabases = new Databases(guestClient);
                    const guestStorage = new Storage(guestClient);
                    return await operation(guestDatabases, guestStorage);
                }
                throw err;
            }
        };

        const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID;
        let COLLECTION_ID = import.meta.env.PUBLIC_APPWRITE_COLLECTION_ID as string;
        const ALPHA_COLLECTION_ID = import.meta.env.PUBLIC_APPWRITE_ALPHA_COLLECTION_ID as string;
        const BUCKET_ID = import.meta.env.PUBLIC_APPWRITE_BUCKET_ID as string;

        // 1. Fetch Item Data
        console.log('[API] Fetching item document...');
        let item;
        try {
            item = await executeRead((db) => db.getDocument(DB_ID as string, COLLECTION_ID, itemId));
        } catch (e: any) {
            if (e.code === 404 && ALPHA_COLLECTION_ID) {
                console.log('[API] Not found in standard collection, checking alpha collection...');
                COLLECTION_ID = ALPHA_COLLECTION_ID;
                item = await executeRead((db) => db.getDocument(DB_ID as string, COLLECTION_ID, itemId));
            } else {
                throw e;
            }
        }

        // 2. Collect Image Ids
        const imageIds: string[] = [];
        if (item.imageId) imageIds.push(item.imageId);
        if (item.galleryImageIds && Array.isArray(item.galleryImageIds)) {
            imageIds.push(...item.galleryImageIds);
        }

        if (imageIds.length === 0) {
            console.warn('[API] No images found for item, proceeding with text-only generation.');
        }

        // 3. Download Images & Prepare for Gemini
        console.log(`[API] Downloading ${imageIds.length} images...`);
        const imageParts = await Promise.all(imageIds.map(async (id) => {
            try {
                // getFileDownload returns an ArrayBuffer in node-appwrite (check version, usually ArrayBuffer or Buffer)
                const buffer = await executeRead((db, stor) => stor.getFileDownload(BUCKET_ID, id));
                return {
                    inlineData: {
                        data: Buffer.from(buffer).toString('base64'),
                        mimeType: 'image/jpeg' // Assuming JPEG for now, or check file extension/mime
                    }
                };
            } catch (e: any) {
                console.error(`[API] Failed to download image ${id}:`, e.message || e);
                return null;
            }
        }));

        const validImageParts = imageParts.filter(p => p !== null);

        if (imageIds.length > 0 && validImageParts.length === 0) {
            console.warn('[API] Image downloads failed, falling back to text only');
        }

        // 4. Call Gemini
        console.log('[API] Calling Gemini...');

        const prompt = `
        You are an expert eBay reseller. Write a compelling, SEO-friendly product description for this item${validImageParts.length > 0 ? ' based on the provided photos.' : '.'}
        
        Item Title: ${item.title}
        Brand/Keywords: ${item.keywords || 'N/A'}
        Details: ${item.conditionNotes || 'N/A'}
        
        The description MUST be written in plain text (no HTML, no Markdown) and include:
        - A catchy headline.
        - Key features bullet points.
        - Condition assessment ${validImageParts.length > 0 ? 'based on photos and notes' : 'based on provided notes'} (be honest but highlighting value).
        - Measurements if visible (estimate if possible or state "See photos for measurements").
        - "Why buy this?" section.
        
        Format the description so it looks clean and readable when pasted into an eBay listing. Do NOT use HTML tags or markdown formatting like asterisks or hashtags. Do not include placeholder text like "[Insert size here]". If you don't know, omit it or describe what you see.
        
        CRITICAL: Return ONLY the plain text string. Do NOT wrap the output in any code blocks.
        `;

        const result = await generateContentWithBackoff([prompt, ...validImageParts], 3, 2000);
        const response = await result.response;
        const text = response.text();
        console.log('[API] Gemini response received');

        // 5. Update Item
        console.log('[API] Updating item with description...');
        let saved = false;
        let saveError = null;
        try {
            await databases.updateDocument(DB_ID, COLLECTION_ID, itemId, {
                marketDescription: text
            });
            saved = true;
        } catch (dbErr: any) {
            console.error('[API] Failed to save description to DB:', dbErr);
            saveError = dbErr.message || 'Database update failed';
            // We do NOT throw here, we return the text anyway
        }

        return new Response(JSON.stringify({ 
            success: true, 
            description: text,
            saved: saved,
            warning: saveError ? `Generated but failed to save: ${saveError}` : null
        }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('[API] Error generating description:', error);
        
        let errorMessage = error.message || 'Unknown server error';
        let statusCode = 500;
        
        if (error?.status === 429 || errorMessage.includes('429 Too Many Requests')) {
            errorMessage = "AI Rate Limit Reached (15 requests/min). Please wait 60 seconds and try again.";
            statusCode = 429;
        }

        // Ensure we return JSON even on error
        return new Response(JSON.stringify({ 
            error: errorMessage,
            isRateLimit: statusCode === 429,
            stack: import.meta.env.DEV ? error.stack : undefined 
        }), { 
            status: statusCode,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

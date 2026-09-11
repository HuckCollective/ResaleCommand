import type { APIRoute } from 'astro';
import { Client, Databases } from 'node-appwrite';

export const prerender = false;

const ENDPOINT = import.meta.env.PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = import.meta.env.PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = import.meta.env.APPWRITE_API_KEY || process.env.APPWRITE_API_KEY;
const DEFAULT_DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
const DEFAULT_COLLECTION_ID = import.meta.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items';

export const POST: APIRoute = async ({ request }) => {
    try {
        if (!API_KEY || !ENDPOINT || !PROJECT_ID) {
            return new Response(JSON.stringify({ 
                error: 'Server configuration missing', 
                details: 'Appwrite API Key, Endpoint, or Project ID is not configured on server.' 
            }), { status: 503, headers: { 'Content-Type': 'application/json' } });
        }

        const body = await request.json();
        const { itemIds, collectionId, dbId } = body;

        if (!Array.isArray(itemIds) || itemIds.length === 0) {
            return new Response(JSON.stringify({ error: 'itemIds array is required and cannot be empty' }), { 
                status: 400, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        const targetDbId = dbId || DEFAULT_DB_ID;
        const targetCollectionId = collectionId || DEFAULT_COLLECTION_ID;

        const client = new Client()
            .setEndpoint(ENDPOINT)
            .setProject(PROJECT_ID)
            .setKey(API_KEY);

        const db = new Databases(client);

        let deletedCount = 0;
        let failedCount = 0;
        const errors: string[] = [];

        const CHUNK_SIZE = 20;
        for (let i = 0; i < itemIds.length; i += CHUNK_SIZE) {
            const chunk = itemIds.slice(i, i + CHUNK_SIZE);
            const promises = chunk.map(async (id: string) => {
                try {
                    await db.deleteDocument(targetDbId, targetCollectionId, id);
                    return { success: true, id };
                } catch (err: any) {
                    return { success: false, id, error: err?.message || 'Delete failed' };
                }
            });

            const results = await Promise.all(promises);
            for (const res of results) {
                if (res.success) {
                    deletedCount++;
                } else {
                    failedCount++;
                    if (errors.length < 5) errors.push(`Item ${res.id}: ${res.error}`);
                }
            }

            if (i + CHUNK_SIZE < itemIds.length) {
                await new Promise(r => setTimeout(r, 60));
            }
        }

        return new Response(JSON.stringify({
            success: true,
            total: itemIds.length,
            deletedCount,
            failedCount,
            errors: errors.length > 0 ? errors : undefined
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        console.error('Server bulk-delete error:', err);
        return new Response(JSON.stringify({
            error: 'Bulk delete failed',
            details: err?.message || String(err)
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

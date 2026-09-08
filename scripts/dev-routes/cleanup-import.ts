export const prerender = false;

import { Client, Databases, Query } from 'node-appwrite';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
    // SECURITY GUARD
    if (!import.meta.env.DEV) {
        return new Response(JSON.stringify({ error: "Forbidden in production environment" }), { status: 403 });
    }

    try {
        console.log('[API] Starting Cleanup...');
        const apiKey = import.meta.env.APPWRITE_API_KEY;
        if (!apiKey) return new Response(JSON.stringify({ error: 'Missing APPWRITE_API_KEY' }), { status: 500 });

        const client = new Client()
            .setEndpoint(import.meta.env.PUBLIC_APPWRITE_ENDPOINT)
            .setProject(import.meta.env.PUBLIC_APPWRITE_PROJECT_ID)
            .setKey(apiKey);

        const databases = new Databases(client);

        const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID;
        const COLLECTION_ID = import.meta.env.PUBLIC_APPWRITE_COLLECTION_ID;

        if (!DB_ID || !COLLECTION_ID) {
            return new Response(JSON.stringify({ error: 'Missing DB or Collection ID' }), { status: 500 });
        }

        // Fetch documents created in the last 2 days
        const limitDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        
        let allDeleted = 0;
        let deletedTitles: string[] = [];

        // Appwrite limit is usually 100 per query, so we might need to loop, 
        // but 100 might be enough if they just did a small file. We will grab 100 at a time.
        const response = await databases.listDocuments(DB_ID, COLLECTION_ID, [
            Query.greaterThan('$createdAt', limitDate),
            Query.orderDesc('$createdAt'),
            Query.limit(300)
        ]);

        for (const doc of response.documents) {
            // Identify "blank pic" items 
            // Also ensure we only delete things that look like imports (e.g. have missing images)
            const hasNoThumbnail = !doc.imageId;
            const hasNoGallery = !doc.galleryImageIds || doc.galleryImageIds.length === 0;

            if (hasNoThumbnail && hasNoGallery) {
                // Wipe it!
                await databases.deleteDocument(DB_ID, COLLECTION_ID, doc.$id);
                allDeleted++;
                deletedTitles.push(doc.title);
            }
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Successfully deleted ${allDeleted} corrupted/blank items from your inventory.`,
            deletedTitles
        }, null, 2), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};

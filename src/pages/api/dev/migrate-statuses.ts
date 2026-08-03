import { Client, Databases, Query } from 'node-appwrite';

export const prerender = false;

export async function GET({ request }) {
    console.log("Starting Status Migration: 'scouted' -> 'acquired'");
    
    try {
        const client = new Client()
            .setEndpoint(import.meta.env.PUBLIC_APPWRITE_ENDPOINT)
            .setProject(import.meta.env.PUBLIC_APPWRITE_PROJECT_ID)
            .setKey(import.meta.env.APPWRITE_API_KEY!);

        const databases = new Databases(client);
        
        const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
        const isAlpha = import.meta.env.PUBLIC_APPWRITE_ENVIRONMENT === 'alpha';
        const COLLECTION_ID = isAlpha
            ? (import.meta.env.PUBLIC_APPWRITE_ALPHA_COLLECTION_ID || 'alpha_items')
            : (import.meta.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items');

        // 1. Fetch all docs with old status
        let documentsToUpdate = [];
        let hasMore = true;
        let lastId: string | null = null;
        let totalUpdated = 0;

        while (hasMore) {
            const queries = [
                Query.equal('status', 'scouted'),
                Query.limit(100)
            ];
            
            if (lastId) {
                queries.push(Query.cursorAfter(lastId));
            }

            const response = await databases.listDocuments(DB_ID, COLLECTION_ID, queries);
            
            if (response.documents.length === 0) {
                hasMore = false;
                break;
            }

            for (const doc of response.documents) {
                console.log(`Migrating Item: ${doc.title || doc.$id}`);
                await databases.updateDocument(DB_ID, COLLECTION_ID, doc.$id, {
                    status: 'acquired'
                });
                totalUpdated++;
            }
            
            lastId = response.documents[response.documents.length - 1].$id;
            
            // If we got less than 100, we're done
            if (response.documents.length < 100) {
                hasMore = false;
            }
        }
        
        return new Response(JSON.stringify({ 
            success: true, 
            message: `Migration complete! Successfully updated ${totalUpdated} items from 'scouted' to 'acquired'.` 
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error("Migration Error:", e);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

import { Client, Databases } from 'node-appwrite';

export const prerender = false;

export async function GET({ request }) {
    console.log("Starting Keywords Attribute Migration");
    
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

        await databases.createStringAttribute(
            DB_ID,
            COLLECTION_ID,
            'keywords',
            64,
            false,
            undefined,
            true // isArray = true
        );
        
        return new Response(JSON.stringify({ success: true, message: "Keywords attribute created successfully!" }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e: any) {
        if (e.message.includes('already exists')) {
            return new Response(JSON.stringify({ success: true, message: "Keywords attribute already existed." }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

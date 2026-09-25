import type { APIRoute } from 'astro';
import { Client, Databases, Query } from 'node-appwrite';

export const GET: APIRoute = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const q = (url.searchParams.get('q') || '').toLowerCase();

        const client = new Client()
            .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1')
            .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID || '69714b35003a8adab6bb');

        if (process.env.APPWRITE_API_KEY) {
            client.setKey(process.env.APPWRITE_API_KEY);
        }

        const db = new Databases(client);
        const dbId = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

        let allDocs: any[] = [];
        for (const coll of ['items', 'items_dev']) {
            try {
                let cursor = null;
                while (allDocs.length < 2000) {
                    const qList = [Query.limit(100), Query.orderDesc('$createdAt')];
                    if (cursor) qList.push(Query.cursorAfter(cursor));
                    const res = await db.listDocuments(dbId, coll, qList);
                    allDocs.push(...res.documents);
                    if (res.documents.length < 100) break;
                    cursor = res.documents[res.documents.length - 1].$id;
                }
            } catch (e) {}
        }
        const filtered = q 
            ? allDocs.filter(d => (d.title || '').toLowerCase().includes(q) || String(d.cost || '').includes(q) || String(d.resalePrice || '').includes(q))
            : allDocs;

        return new Response(JSON.stringify({
            totalFound: filtered.length,
            items: filtered.slice(0, 20).map(d => ({
                id: d.$id,
                upc: d.upc,
                title: d.title,
                category: d.category,
                status: d.status,
                cost: d.cost,
                price: d.resalePrice
            }))
        }, null, 2), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};

import type { APIRoute } from 'astro';
import { Client, Databases, Query } from 'node-appwrite';

export const GET: APIRoute = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const upc = url.searchParams.get('upc') || 'HUCK-0843';

        const client = new Client()
            .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1')
            .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID || '69714b35003a8adab6bb');

        if (process.env.APPWRITE_API_KEY) {
            client.setKey(process.env.APPWRITE_API_KEY);
        }

        const db = new Databases(client);
        const dbId = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
        const collId = process.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items_dev';

        // Try searching items_dev first, then items
        let item = null;
        let matchedColl = collId;

        const res = await db.listDocuments(dbId, collId, [
            Query.equal('upc', upc),
            Query.limit(1)
        ]);

        if (res.documents.length > 0) {
            item = res.documents[0];
        } else {
            const res2 = await db.listDocuments(dbId, 'items', [
                Query.equal('upc', upc),
                Query.limit(1)
            ]);
            if (res2.documents.length > 0) {
                item = res2.documents[0];
                matchedColl = 'items';
            }
        }

        if (!item) {
            return new Response(JSON.stringify({ error: 'Not found', upc }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Also check if this item has children or siblings
        const children = await db.listDocuments(dbId, matchedColl, [
            Query.equal('parentLotId', item.$id),
            Query.limit(50)
        ]);

        let parent = null;
        if (item.parentLotId) {
            try {
                parent = await db.getDocument(dbId, matchedColl, item.parentLotId);
            } catch (e) {}
        }

        let siblings = [];
        if (item.parentLotId) {
            const sibRes = await db.listDocuments(dbId, matchedColl, [
                Query.equal('parentLotId', item.parentLotId),
                Query.limit(50)
            ]);
            siblings = sibRes.documents.filter(d => d.$id !== item.$id);
        }

        return new Response(JSON.stringify({
            collection: matchedColl,
            item: {
                $id: item.$id,
                title: item.title,
                upc: item.upc,
                quantity: item.quantity,
                cost: item.cost,
                resalePrice: item.resalePrice,
                status: item.status,
                category: item.category,
                sourcingChannel: item.sourcingChannel,
                vendor: item.vendor,
                source: item.source,
                storageLocation: item.storageLocation,
                conditionNotes: item.conditionNotes,
                parentLotId: item.parentLotId,
                rawAnalysis: item.rawAnalysis ? item.rawAnalysis.slice(0, 300) : null
            },
            childrenCount: children.total,
            children: children.documents.map(c => ({ $id: c.$id, upc: c.upc, title: c.title, resalePrice: c.resalePrice, cost: c.cost, quantity: c.quantity, status: c.status })),
            parent: parent ? { $id: parent.$id, upc: parent.upc, title: parent.title } : null,
            siblingsCount: siblings.length,
            siblings: siblings.map(s => ({ $id: s.$id, upc: s.upc, title: s.title, resalePrice: s.resalePrice }))
        }, null, 2), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message, stack: e.stack }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

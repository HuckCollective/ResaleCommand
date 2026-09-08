import type { APIRoute } from 'astro';
import { Client, Databases, Query } from 'node-appwrite';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
    const client = new Client()
        .setEndpoint(import.meta.env.PUBLIC_APPWRITE_ENDPOINT)
        .setProject(import.meta.env.PUBLIC_APPWRITE_PROJECT_ID)
        .setKey(import.meta.env.APPWRITE_API_KEY!);

    const databases = new Databases(client);
    const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID!;
    const COL_ID = import.meta.env.PUBLIC_APPWRITE_COLLECTION_ID!;
    const ALPHA_COL_ID = import.meta.env.PUBLIC_APPWRITE_ALPHA_COLLECTION_ID || 'alpha_items';
    const CARTS_COL = 'carts';

    const results: any = {};

    try {
        const itemsRes = await databases.listDocuments(DB_ID, COL_ID, [
            Query.orderDesc('$createdAt'),
            Query.limit(10)
        ]);
        results.standardItems = itemsRes.documents.map(d => ({id: d.$id, title: d.title, status: d.status, cartId: d.cartId}));
    } catch {}

    try {
        const alphaRes = await databases.listDocuments(DB_ID, ALPHA_COL_ID, [
            Query.orderDesc('$createdAt'),
            Query.limit(10)
        ]);
        results.alphaItems = alphaRes.documents.map(d => ({id: d.$id, title: d.title, status: d.status, cartId: d.cartId}));
    } catch {}

    try {
        const purchasesRes = await databases.listDocuments(DB_ID, 'purchases_dev', [
            Query.orderDesc('$createdAt'),
            Query.limit(5000)
        ]);
        results.purchases = purchasesRes.documents.map(d => ({
            id: d.$id,
            poNumber: d.poNumber,
            vendor: d.vendor,
            status: d.status,
            tenantId: d.tenantId,
            buyerId: d.buyerId,
            subtotal: d.subtotal,
            grandTotal: d.grandTotal
        }));
    } catch (e: any) {
        results.purchasesError = e.message;
    }

    return new Response(JSON.stringify(results, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
};

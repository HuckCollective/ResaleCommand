import { Client, Databases, Query } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client();
const ENDPOINT = process.env.PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
const ITEMS_COL = process.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items';
const PURCHASES_COL = process.env.PUBLIC_APPWRITE_PURCHASES_COLLECTION_ID || 'purchases';

client.setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const databases = new Databases(client);

async function checkSpecificPurchases() {
    const ids = ['6a7b6f330022a5cbacf1', '6a7b6f480017980c9900', '6a7b6e8e0018179a8d60'];
    for (const id of ids) {
        try {
            const p = await databases.getDocument(DB_ID, PURCHASES_COL, id);
            console.log(`Purchase ${id}: PO: [${p.poNumber}] OrderId: ${p.orderId} Vendor: ${p.vendor} Status: ${p.status} $createdAt: ${p.$createdAt}`);
        } catch(e) {
            console.log(`Purchase ${id} not found in DB!`);
        }
    }

    // Now let's see why PurchasesList.vue computes 0 items for purchases:
    // Let's count how many items exist per purchaseId across all items
    let offset = 0;
    const purchaseCountMap = {};
    while (offset < 2000) {
        const res = await databases.listDocuments(DB_ID, ITEMS_COL, [Query.limit(100), Query.offset(offset)]);
        if (res.documents.length === 0) break;
        res.documents.forEach(doc => {
            if (doc.purchaseId) {
                purchaseCountMap[doc.purchaseId] = (purchaseCountMap[doc.purchaseId] || 0) + 1;
            }
        });
        offset += res.documents.length;
    }
    console.log(`Total unique purchaseIds across ${offset} items: ${Object.keys(purchaseCountMap).length}`);

    // Now let's check purchases: how many purchases have these IDs vs how many don't?
    const pRes = await databases.listDocuments(DB_ID, PURCHASES_COL, [Query.limit(100), Query.orderDesc('$createdAt')]);
    console.log(`\nChecking the newest 50 purchases:`);
    let foundWithItems = 0;
    pRes.documents.slice(0, 50).forEach(p => {
        const count = purchaseCountMap[p.$id] || 0;
        if (count > 0) foundWithItems++;
        console.log(`- PO: [${p.poNumber || 'N/A'}] ID: ${p.$id} | itemsCount: ${count} | Status: ${p.status} | Vendor: ${p.vendor} | Created: ${p.$createdAt}`);
    });
    console.log(`Newest 50 purchases with items: ${foundWithItems} / 50`);
}

checkSpecificPurchases();

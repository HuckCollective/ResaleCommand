import { Client, Databases, Query } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client();
const ENDPOINT = process.env.PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
const ITEMS_COL = process.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items';

client.setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const databases = new Databases(client);

async function checkItemPurchaseTargets() {
    const res = await databases.listDocuments(DB_ID, ITEMS_COL, [Query.limit(50)]);
    let inPurchases = 0;
    let inPurchasesDev = 0;
    let notFound = 0;

    for (const it of res.documents) {
        if (!it.purchaseId) continue;
        let found = false;
        try {
            await databases.getDocument(DB_ID, 'purchases', it.purchaseId);
            inPurchases++;
            found = true;
        } catch(e) {}

        try {
            await databases.getDocument(DB_ID, 'purchases_dev', it.purchaseId);
            inPurchasesDev++;
            found = true;
        } catch(e) {}

        if (!found) notFound++;
    }

    console.log(`Sample of ${res.documents.length} items:`);
    console.log(`- Linked to 'purchases' collection: ${inPurchases}`);
    console.log(`- Linked to 'purchases_dev' collection: ${inPurchasesDev}`);
    console.log(`- Not found in either: ${notFound}`);
}

checkItemPurchaseTargets();

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

async function countPerTenant() {
    const teams = [
        { name: "Partners", id: "6979614d00281d143bbe" },
        { name: "The Huckleberry Collective", id: "69a9cbcb0038df55f6b9" }
    ];

    for (const t of teams) {
        const itemRes = await databases.listDocuments(DB_ID, ITEMS_COL, [Query.equal('tenantId', t.id), Query.limit(1)]);
        const purchaseRes = await databases.listDocuments(DB_ID, PURCHASES_COL, [Query.equal('tenantId', t.id), Query.limit(1)]);
        console.log(`Team "${t.name}" (${t.id}):`);
        console.log(`  - Items: ${itemRes.total}`);
        console.log(`  - Purchases: ${purchaseRes.total}`);
    }

    const noTenantItems = await databases.listDocuments(DB_ID, ITEMS_COL, [Query.isNull('tenantId'), Query.limit(1)]).catch(() => ({ total: 'N/A' }));
    console.log(`  - Items with null tenantId: ${noTenantItems.total}`);
}

countPerTenant();

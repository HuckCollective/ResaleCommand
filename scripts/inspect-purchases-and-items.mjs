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

async function inspect() {
    console.log(`Endpoint: ${ENDPOINT}`);
    console.log(`Project: ${PROJECT_ID}`);
    console.log(`Database: ${DB_ID}`);
    console.log(`Items Collection: ${ITEMS_COL}`);
    console.log(`Purchases Collection: ${PURCHASES_COL}`);

    try {
        const purchasesRes = await databases.listDocuments(DB_ID, PURCHASES_COL, [Query.limit(50)]);
        console.log(`\nTotal Purchases in DB: ${purchasesRes.total}`);
        console.log(`Loaded ${purchasesRes.documents.length} sample purchases:`);
        purchasesRes.documents.slice(0, 10).forEach(p => {
            console.log(`- PO: [${p.poNumber}] ID: ${p.$id} OrderId: ${p.orderId} Vendor: ${p.vendor} Status: ${p.status} itemCount: ${p.itemCount}`);
        });

        const itemsRes = await databases.listDocuments(DB_ID, ITEMS_COL, [Query.limit(100)]);
        console.log(`\nTotal Items in DB: ${itemsRes.total}`);
        let withPurchaseId = 0;
        let withCartId = 0;
        let withPoNumber = 0;
        itemsRes.documents.forEach(it => {
            if (it.purchaseId) withPurchaseId++;
            if (it.cartId) withCartId++;
            if (it.poNumber) withPoNumber++;
        });
        console.log(`Out of ${itemsRes.documents.length} sampled items:`);
        console.log(`- Items with purchaseId: ${withPurchaseId}`);
        console.log(`- Items with cartId: ${withCartId}`);
        console.log(`- Items with poNumber: ${withPoNumber}`);

        console.log('\nSample items:');
        itemsRes.documents.slice(0, 10).forEach(it => {
            console.log(`- Item: "${it.title}" | ID: ${it.$id} | status: ${it.status} | purchaseId: ${it.purchaseId} | cartId: ${it.cartId} | poNumber: ${it.poNumber} | identity: ${it.identity}`);
        });

    } catch (e) {
        console.error('Inspection failed:', e);
    }
}

inspect();

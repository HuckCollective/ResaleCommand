import { Client, Databases, Query } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client();
const ENDPOINT = process.env.PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

client.setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const databases = new Databases(client);

async function checkDevPurchases() {
    try {
        const devRes = await databases.listDocuments(DB_ID, 'purchases_dev', [Query.limit(20)]);
        console.log(`purchases_dev exists! Total documents: ${devRes.total}`);
        devRes.documents.forEach(d => {
            console.log(`- Dev PO: [${d.poNumber}] ID: ${d.$id} OrderId: ${d.orderId} Vendor: ${d.vendor}`);
        });
    } catch (e) {
        console.log(`purchases_dev query failed: ${e.message}`);
    }

    try {
        const prodRes = await databases.listDocuments(DB_ID, 'purchases', [Query.limit(20)]);
        console.log(`purchases exists! Total documents: ${prodRes.total}`);
    } catch(e) {
        console.log(`purchases query failed: ${e.message}`);
    }
}

checkDevPurchases();

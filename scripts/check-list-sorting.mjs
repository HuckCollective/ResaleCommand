import { Client, Databases, Query } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client();
const ENDPOINT = process.env.PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
const PURCHASES_COL = process.env.PUBLIC_APPWRITE_PURCHASES_COLLECTION_ID || 'purchases';

client.setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const databases = new Databases(client);

async function checkListSorting() {
    const res = await databases.listDocuments(DB_ID, PURCHASES_COL, [
        Query.orderDesc('$createdAt'),
        Query.limit(20)
    ]);
    console.log(`Top 20 purchases by $createdAt DESC:`);
    res.documents.forEach((p, i) => {
        console.log(`${i+1}. [${p.poNumber}] OrderId: ${p.orderId} | Status: ${p.status} | Vendor: ${p.vendor} | $createdAt: ${p.$createdAt}`);
    });
}

checkListSorting();

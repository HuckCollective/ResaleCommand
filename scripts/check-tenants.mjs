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

async function checkTenants() {
    const res = await databases.listDocuments(DB_ID, ITEMS_COL, [Query.limit(20)]);
    console.log("Checking tenantId on items:");
    res.documents.forEach(doc => {
        console.log(`- Item: "${doc.title.slice(0, 30)}" | tenantId: ${doc.tenantId}`);
    });

    const pRes = await databases.listDocuments(DB_ID, PURCHASES_COL, [Query.limit(20)]);
    console.log("\nChecking tenantId on purchases:");
    pRes.documents.forEach(doc => {
        console.log(`- PO: [${doc.poNumber}] | tenantId: ${doc.tenantId}`);
    });
}

checkTenants();

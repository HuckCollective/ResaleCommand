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

async function testItemLoad() {
    const pId = '6ac1341c0038a2036fb7';
    const res = await databases.listDocuments(DB_ID, ITEMS_COL, [Query.equal('purchaseId', pId)]);
    console.log(`PO-684906 (ID: ${pId}) has ${res.documents.length} items:`);
    res.documents.forEach(it => {
        console.log(`- Item: "${it.title}" | Cost: $${it.cost} | Status: ${it.status} | Location: ${it.storageLocation}`);
    });

    const pId2 = '6ab154ba001b54d34709';
    const res2 = await databases.listDocuments(DB_ID, ITEMS_COL, [Query.equal('purchaseId', pId2)]);
    console.log(`\nPO-457845 (ID: ${pId2}) has ${res2.documents.length} items:`);
    res2.documents.forEach(it => {
        console.log(`- Item: "${it.title}" | Cost: $${it.cost} | Status: ${it.status} | Location: ${it.storageLocation}`);
    });
}

testItemLoad();

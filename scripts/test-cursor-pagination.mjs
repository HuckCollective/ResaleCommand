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

async function testFetchInventoryLoop() {
    console.log("Simulating fetchInventory pagination loop...");
    let cursor = null;
    let accumulated = 0;
    let batchNum = 1;
    let total = 0;
    while (batchNum <= 20) {
        const queries = [
            Query.orderDesc('$createdAt'),
            Query.limit(100)
        ];
        if (cursor) {
            queries.push(Query.cursorAfter(cursor));
        }

        try {
            const res = await databases.listDocuments(DB_ID, ITEMS_COL, queries);
            total = res.total;
            accumulated += res.documents.length;
            console.log(`Batch ${batchNum}: fetched ${res.documents.length} docs. Total in collection: ${total}. Accumulated: ${accumulated}`);
            if (res.documents.length === 0 || accumulated >= total) {
                console.log("Finished all documents!");
                break;
            }
            cursor = res.documents[res.documents.length - 1].$id;
            batchNum++;
        } catch(e) {
            console.error(`Batch ${batchNum} failed:`, e.message);
            break;
        }
    }
}

testFetchInventoryLoop();

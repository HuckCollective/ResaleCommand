import { Client, Databases } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
const ITEMS_COL = process.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items_dev';

async function listItems() {
    try {
        const response = await databases.listDocuments(DB_ID, ITEMS_COL, []);
        console.log(`Found ${response.documents.length} items in collection ${ITEMS_COL}:`);
        response.documents.forEach((d, idx) => {
            console.log(`${idx + 1}. Title: "${d.title}" | TenantID: "${d.tenantId}" | Status: "${d.status}" | Location: "${d.storageLocation}" | Selling: ${JSON.stringify(d.sellingLocations)}`);
        });
    } catch (e) {
        console.error('Error listing items:', e.message);
    }
}

listItems();

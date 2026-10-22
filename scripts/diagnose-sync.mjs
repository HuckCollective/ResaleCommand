import dotenv from 'dotenv';
dotenv.config();
import { Client, Databases, Query } from 'node-appwrite';

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1')
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID || '69714b35003a8adab6bb')
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const dbId = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
const colId = process.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items_dev';

async function main() {
    console.log(`Connecting to Appwrite DB: ${dbId}, Collection: ${colId}...`);
    try {
        // Query items updated today
        const res = await databases.listDocuments(dbId, colId, [
            Query.orderDesc('$updatedAt'),
            Query.limit(30)
        ]);

        console.log(`Found ${res.total} total items. Recent 30:`);
        for (const doc of res.documents) {
            console.log(`- [${doc.$id}] [${doc.$updatedAt}] Status: ${doc.status} | Loc: ${doc.storageLocation} | LocSku: ${doc.locationSku} | UPC: ${doc.upc} | EndsAt: ${doc.auctionEndsAt} | Title: "${doc.title?.slice(0, 45)}"`);
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}
main();

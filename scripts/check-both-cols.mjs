import dotenv from 'dotenv';
dotenv.config();
import { Client, Databases, Query } from 'node-appwrite';

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1')
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID || '69714b35003a8adab6bb')
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const dbId = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

async function checkCol(col) {
    try {
        const res = await databases.listDocuments(dbId, col, [
            Query.orderDesc('$updatedAt'),
            Query.limit(10)
        ]);
        console.log(`\n=== Collection: ${col} (Total: ${res.total}) ===`);
        for (const doc of res.documents) {
            console.log(`- [${doc.$id}] [${doc.$updatedAt}] Status: ${doc.status} | Loc: ${doc.storageLocation} | EndsAt: ${doc.auctionEndsAt} | Title: "${doc.title?.slice(0, 40)}"`);
        }
    } catch (e) {
        console.log(`Collection ${col}: ${e.message}`);
    }
}

async function main() {
    await checkCol('items');
    await checkCol('items_dev');
}
main();

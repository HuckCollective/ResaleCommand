import dotenv from 'dotenv';
dotenv.config();
import { Client, Databases, Query } from 'node-appwrite';

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1')
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID || '69714b35003a8adab6bb')
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const dbId = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

async function main() {
    const res = await databases.listDocuments(dbId, 'items', [
        Query.isNotNull('auctionEndsAt'),
        Query.limit(25)
    ]);
    console.log(`Found ${res.total} items with auctionEndsAt in 'items':`);
    for (const doc of res.documents) {
        console.log(`- ID: ${doc.$id} | status: ${doc.status} | loc: ${doc.storageLocation} | endsAt: ${doc.auctionEndsAt} | title: "${doc.title?.slice(0, 45)}"`);
    }
}
main();

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
        Query.greaterThanEqual('$updatedAt', '2026-10-21T18:50:00.000+00:00'),
        Query.limit(100)
    ]);
    console.log(`Updated in 'items' between 18:50 and now: ${res.total}`);
    for (const doc of res.documents) {
        console.log(`- ID: ${doc.$id} | updatedAt: ${doc.$updatedAt} | status: ${doc.status} | loc: ${doc.storageLocation} | sellingLocs: ${JSON.stringify(doc.sellingLocations)} | endsAt: ${doc.auctionEndsAt} | title: "${doc.title}"`);
    }
}
main();

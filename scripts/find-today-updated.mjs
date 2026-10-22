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
        Query.greaterThanEqual('$updatedAt', '2026-10-21T18:00:00.000+00:00'),
        Query.limit(100)
    ]);
    console.log(`Total items updated in 'items' today after 18:00 UTC: ${res.total}`);
    for (const doc of res.documents) {
        console.log(`- [${doc.$id}] [${doc.$updatedAt}] Status: ${doc.status} | Loc: ${doc.storageLocation} | UPC: ${doc.upc} | EndsAt: ${doc.auctionEndsAt} | Title: "${doc.title}"`);
    }
}
main();

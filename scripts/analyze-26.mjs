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
        Query.limit(50)
    ]);
    console.log(`Analyzing ${res.documents.length} items:`);
    for (const d of res.documents) {
        console.log(`ID: ${d.$id} | Title: "${d.title}" | UPC: ${d.upc} | locationSku: ${d.locationSku} | auctionEndsAt: ${d.auctionEndsAt} | auctionStatus: ${d.auctionStatus} | source: ${d.source || d.platform}`);
    }
}
main();

import { Client, Databases, Storage, Query } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const db = new Databases(client);

async function run() {
    let offset = 0;
    const limit = 100;
    while(true) {
        const res = await db.listDocuments(process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db', 'items_dev', [
            Query.limit(limit),
            Query.offset(offset)
        ]);
        
        for (const doc of res.documents) {
            if (doc.title && doc.title.includes('Koston')) {
                console.log(JSON.stringify(doc, null, 2));
                return;
            }
        }
        
        if (res.documents.length < limit) break;
        offset += limit;
    }
    console.log("Not found.");
}
run();

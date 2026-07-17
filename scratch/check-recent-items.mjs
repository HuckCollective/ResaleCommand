import { Client, Databases, Query } from 'node-appwrite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
const COLLECTION_ID = process.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items';

async function check() {
    try {
        const response = await databases.listDocuments(DB_ID, COLLECTION_ID, [
            Query.orderDesc('$createdAt'),
            Query.limit(5)
        ]);
        
        console.log("Recent items:");
        response.documents.forEach(doc => {
            console.log(`\nID: ${doc.$id}`);
            console.log(`Title: ${doc.title}`);
            console.log(`Has rawAnalysis: ${!!doc.rawAnalysis}`);
            if (doc.rawAnalysis) {
                console.log(`rawAnalysis preview: ${doc.rawAnalysis.substring(0, 100)}...`);
            }
            console.log(`ConditionNotes: ${doc.conditionNotes?.substring(0, 100)}`);
        });
    } catch (e) {
        console.error(e);
    }
}
check();

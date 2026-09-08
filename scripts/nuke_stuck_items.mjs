import { Client, Databases, Query } from 'node-appwrite';

import dotenv from 'dotenv';
dotenv.config();

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1')
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID || '69714b35003a8adab6bb')
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

// Appwrite collections
const DB_ID = 'resale_db';
const ALPHA_COL = 'alpha_items';
const ITEMS_COL = 'items';

async function nukeStuckItems() {
    try {
        console.log("Searching for stuck scouted items...");
        
        // Search in alpha
        const alphaResponse = await databases.listDocuments(DB_ID, ALPHA_COL, [
            Query.equal('status', 'scouted'),
            Query.limit(50)
        ]);
        
        const alphaDocs = alphaResponse.documents;
        console.log(`Found ${alphaDocs.length} scouted items in alpha_items`);
        
        for (const doc of alphaDocs) {
            console.log(`Deleting ${doc.title || doc.$id}...`);
            await databases.deleteDocument(DB_ID, ALPHA_COL, doc.$id);
        }

        // Search in normal
        const normalResponse = await databases.listDocuments(DB_ID, ITEMS_COL, [
            Query.equal('status', 'scouted'),
            Query.limit(50)
        ]);

        const normalDocs = normalResponse.documents;
        console.log(`Found ${normalDocs.length} scouted items in items`);

        for (const doc of normalDocs) {
            console.log(`Deleting ${doc.title || doc.$id}...`);
            await databases.deleteDocument(DB_ID, ITEMS_COL, doc.$id);
        }

        console.log("Cleanup complete!");
    } catch (e) {
        console.error("Failed to delete stuck items:", e);
    }
}

nukeStuckItems();

/**
 * add-raw-analysis.mjs
 * Frees attribute slots by removing dead legacy attributes (binLocation, purchaseLocation)
 * then adds rawAnalysis (5000-char string) to all item collections.
 * Safe: binLocation and purchaseLocation are not referenced anywhere in the codebase.
 */
import { Client, Databases } from 'node-appwrite';
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
const COLLECTIONS = ['items', 'items_dev', 'alpha_items'];

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function migrate(collectionId) {
    console.log(`\n--- Processing ${collectionId} ---`);

    // 1. Delete dead legacy attributes to free up slots
    for (const key of ['binLocation', 'purchaseLocation']) {
        try {
            await databases.deleteAttribute(DB_ID, collectionId, key);
            console.log(`🗑️  Deleted legacy attribute '${key}' from ${collectionId}`);
            await wait(1500); // wait for deletion to propagate
        } catch (e) {
            console.log(`ℹ️  '${key}' not found or already deleted on ${collectionId}: ${e.message}`);
        }
    }

    await wait(2000); // extra wait before creating

    // 2. Add rawAnalysis
    try {
        await databases.createStringAttribute(DB_ID, collectionId, 'rawAnalysis', 1000, false);
        console.log(`✅ Created 'rawAnalysis' on ${collectionId}`);
    } catch (e) {
        console.log(`ℹ️  'rawAnalysis' on ${collectionId}: ${e.message}`);
    }
}

async function run() {
    console.log('=== add-raw-analysis migration ===');
    for (const col of COLLECTIONS) {
        await migrate(col);
    }
    console.log('\n✅ Migration complete. Appwrite may take 1-2 min to index new attributes.');
}

run();

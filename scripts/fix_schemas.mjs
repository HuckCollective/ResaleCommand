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

async function addAttributes(collectionId) {
    console.log(`Checking Attributes for ${DB_ID}/${collectionId}...`);
    
    // parentLotId (String)
    try {
        await databases.createStringAttribute(DB_ID, collectionId, 'parentLotId', 255, false);
        console.log(`✅ Created 'parentLotId' attribute on ${collectionId}`);
    } catch (e) {
        console.log(`ℹ️ 'parentLotId' attribute likely exists or failed on ${collectionId}:`, e.message);
    }

    // quantity (Integer)
    try {
        await databases.createIntegerAttribute(DB_ID, collectionId, 'quantity', false, 1, 10000, 1);
        console.log(`✅ Created 'quantity' attribute on ${collectionId}`);
    } catch (e) {
        console.log(`ℹ️ 'quantity' attribute likely exists or failed on ${collectionId}:`, e.message);
    }
    
    // components (String)
    try {
        // Appwrite limit is typically 65535 for large text, let's use 65535
        await databases.createStringAttribute(DB_ID, collectionId, 'components', 65535, false);
        console.log(`✅ Created 'components' attribute on ${collectionId}`);
    } catch (e) {
        console.log(`ℹ️ 'components' attribute likely exists or failed on ${collectionId}:`, e.message);
    }

    // idx_identity (Index)
    try {
        await databases.createIndex(DB_ID, collectionId, 'idx_identity', 'key', ['identity'], ['asc']);
        console.log(`✅ Created 'idx_identity' index on ${collectionId}`);
    } catch (e) {
        console.log(`ℹ️ 'idx_identity' index likely exists or failed on ${collectionId}:`, e.message);
    }
}

async function run() {
    console.log('--- STARTING SCHEMA UPDATE ---');
    for (const collection of COLLECTIONS) {
        try {
            await addAttributes(collection);
        } catch (e) {
            console.error(`Failed to process collection ${collection}:`, e.message);
        }
    }
    console.log('--- SCHEMA UPDATE COMPLETE ---');
    console.log('Please note: Appwrite may take a few seconds to finish indexing these attributes in the background.');
    
    // We should probably sleep a bit to let it index if we want to run queries right after
    console.log('Waiting 5 seconds for Appwrite indexing...');
    await new Promise(resolve => setTimeout(resolve, 5000));
}

run();


import { Client, Databases } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client();

const ENDPOINT = process.env.PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID;
const COLLECTION_ID = process.env.PUBLIC_APPWRITE_COLLECTION_ID;

if (!API_KEY) {
    console.error("Missing APPWRITE_API_KEY in .env");
    process.exit(1);
}

client
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

const databases = new Databases(client);

// Helper to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function deleteAttribute(collectionId, key) {
    try {
        await databases.deleteAttribute(DB_ID, collectionId, key);
        console.log(`Deleted attribute: ${key}`);
        await wait(500); // Wait for deletion to propagate
    } catch (e) {
        // Ignore if doesn't exist
    }
}

async function createAttribute(collectionId, key, type, size = 255, required = false, array = false) {
    try {
        console.log(`Creating attribute: ${key}...`);
        
        switch (type) {
            case 'string':
                await databases.createStringAttribute(DB_ID, collectionId, key, size, required, undefined, array);
                break;
            case 'integer':
                await databases.createIntegerAttribute(DB_ID, collectionId, key, required, undefined, undefined, undefined, array);
                break;
            case 'float':
                await databases.createFloatAttribute(DB_ID, collectionId, key, required, undefined, undefined, undefined, array);
                break;
            case 'boolean':
                await databases.createBooleanAttribute(DB_ID, collectionId, key, required, undefined, array);
                break;
            case 'datetime':
                await databases.createDatetimeAttribute(DB_ID, collectionId, key, required, undefined, array);
                break;
            default:
                console.error("Unknown type");
        }
        
        console.log(`Attribute ${key} creation requested.`);
        await wait(500); 
    } catch (error) {
        if (error.code === 409) {
            console.log(`Attribute ${key} already exists.`);
        } else {
            console.error(`Error creating ${key}:`, error.message);
        }
    }
}

async function run() {
    console.log("Starting Optimized Schema Update on Both Collections...");

    const collectionsToUpdate = [
        process.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items',
        process.env.PUBLIC_APPWRITE_ALPHA_COLLECTION_ID || 'alpha_items'
    ];

    for (const collectionId of collectionsToUpdate) {
        console.log(`\n===========================================`)
        console.log(`Applying to Collection: ${collectionId}`)
        console.log(`===========================================\n`)
        
        // 1. DELETE OVERSIZED OR WRONG-TYPE ATTRIBUTES
        // Warning: This deletes data in these columns, but needed to fix the DB.
        console.log("Optimizing table size and fixing types...");
        await deleteAttribute(collectionId, 'identity'); 
        await deleteAttribute(collectionId, 'conditionNotes');
        // Fix: Strings are needed for ranges (e.g. "100-150"), but DB has them as floats.
        await deleteAttribute(collectionId, 'priceMint');
        await deleteAttribute(collectionId, 'priceFair');
        await deleteAttribute(collectionId, 'pricePoor');
        
        // 2. RECREATE CORE ATTRIBUTES (Smaller)
        await createAttribute(collectionId, 'title', 'string', 255, true); 
        await createAttribute(collectionId, 'identity', 'string', 2000, false); // Reduced to 2000
        await createAttribute(collectionId, 'conditionNotes', 'string', 1000, false); // Reduced to 1000

        // 3. Price Breakdown & Metadata - ALIGNED WITH ACTUAL DB
        // Note: The UI uses 'resalePrice' mostly, but we keep these if they exist for legacy or detailed records.
        // If 'resalePrice' is the main one, we ensure it exists.
        
        // 4. Sourcing & Cart Fields 
        await createAttribute(collectionId, 'cost', 'float', null, false); // float matches useInventory
        await createAttribute(collectionId, 'purchaseLocation', 'string', 255, false);
        await createAttribute(collectionId, 'resalePrice', 'float', null, false); // float matches useInventory
        await createAttribute(collectionId, 'maxBuyPrice', 'float', null, false);
        await createAttribute(collectionId, 'binLocation', 'string', 255, false);
        
        // 5. New Fields
        await createAttribute(collectionId, 'receiptImageId', 'string', 255, false); // Retry
        await createAttribute(collectionId, 'status', 'string', 50, false); 
        await createAttribute(collectionId, 'red_flags', 'string', 255, false, true); 
        await createAttribute(collectionId, 'cartId', 'string', 36, false); // Link to Cart
        await createAttribute(collectionId, 'tenantId', 'string', 255, false);
        await createAttribute(collectionId, 'imageId', 'string', 255, false);
        
        // 6. Multi-Image Support
        await createAttribute(collectionId, 'galleryImageIds', 'string', 255, false, true); // Array for extra photos

        // 7. AI Description
        await createAttribute(collectionId, 'marketDescription', 'string', 5000, false);

        // 8. INDEXES (Crucial for Queries)
        console.log("Creating Indexes...");
        try {
            await databases.createIndex(DB_ID, collectionId, 'idx_title', 'key', ['title'], ['asc']);
            console.log("Created index: idx_title");
        } catch (e) { console.log("Index idx_title might already exist or error:", e.message); }

        try {
            await databases.createIndex(DB_ID, collectionId, 'idx_purchaseLocation', 'key', ['purchaseLocation'], ['asc']);
            console.log("Created index: idx_purchaseLocation");
        } catch (e) { console.log("Index idx_purchaseLocation might already exist or error:", e.message); }

        try {
            await databases.createIndex(DB_ID, collectionId, 'idx_cartId', 'key', ['cartId'], ['asc']);
            console.log("Created index: idx_cartId");
        } catch (e) { console.log("Index idx_cartId might already exist or error:", e.message); }

        try {
            await databases.createIndex(DB_ID, collectionId, 'idx_tenantId', 'key', ['tenantId'], ['asc']);
            console.log("Created index: idx_tenantId");
        } catch (e) { console.log("Index idx_tenantId might already exist or error:", e.message); }

        try {
            await databases.createIndex(DB_ID, collectionId, 'idx_identity', 'key', ['identity'], ['asc']);
            console.log("Created index: idx_identity");
        } catch (e) { console.log("Index idx_identity might already exist or error:", e.message); }
    }

    console.log("\nSchema Update Requests Sent. Please wait 1-2 minutes for Appwrite to process deletions and additions.");
}

run();

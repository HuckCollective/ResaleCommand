import { Client, Databases } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client();

const ENDPOINT = process.env.PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID;
// Force this to the alpha collection
const COLLECTION_ID = 'alpha_items'; 

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

async function createAttribute(key, type, size = 255, required = false, array = false) {
    try {
        console.log(`Creating attribute: ${key}...`);
        
        switch (type) {
            case 'string':
                await databases.createStringAttribute(DB_ID, COLLECTION_ID, key, size, required, null, array);
                break;
            case 'integer':
                await databases.createIntegerAttribute(DB_ID, COLLECTION_ID, key, required, null, null, array);
                break;
            case 'float':
                await databases.createFloatAttribute(DB_ID, COLLECTION_ID, key, required, null, null, array);
                break;
            case 'boolean':
                await databases.createBooleanAttribute(DB_ID, COLLECTION_ID, key, required, null, array);
                break;
            case 'datetime':
                await databases.createDatetimeAttribute(DB_ID, COLLECTION_ID, key, required, null, array);
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
    console.log("Setting up Alpha Items Collection...");

    // 0. Create the collection if it doesn't exist
    try {
        await databases.createCollection(DB_ID, COLLECTION_ID, 'Alpha Items');
        console.log(`Created collection: ${COLLECTION_ID}`);
        // Add basic permissions for the alpha collection if needed, or leave it configurable
        // by default it will be protected.
        await wait(1000); // Give appwrite time
    } catch (e) {
        if (e.code === 409) {
            console.log(`Collection ${COLLECTION_ID} already exists.`);
        } else {
            console.error("Failed to create collection:", e);
            return;
        }
    }

    // 2. RECREATE CORE ATTRIBUTES
    await createAttribute('title', 'string', 255, true); 
    await createAttribute('identity', 'string', 2000, false);
    await createAttribute('conditionNotes', 'string', 1000, false);

    // 4. Sourcing & Cart Fields 
    await createAttribute('paidPrice', 'float', 0, false);
    await createAttribute('purchaseLocation', 'string', 255, false);
    await createAttribute('resalePrice', 'float', 0, false);
    await createAttribute('maxBuyPrice', 'float', 0, false);
    await createAttribute('binLocation', 'string', 255, false);
    
    // 5. New Fields
    await createAttribute('receiptImageId', 'string', 255, false);
    await createAttribute('status', 'string', 50, false); 
    await createAttribute('red_flags', 'string', 255, false, true); 
    
    // 6. Multi-Image Support
    await createAttribute('galleryImageIds', 'string', 255, false, true);

    // 7. AI Description
    await createAttribute('marketDescription', 'string', 5000, false);
    await createAttribute('rawAnalysis', 'string', 5000, false);
    await createAttribute('condition', 'string', 255, false);

    // 8. INDEXES
    console.log("Creating Indexes...");
    try {
        await databases.createIndex(DB_ID, COLLECTION_ID, 'idx_title', 'key', ['title'], ['asc']);
        console.log("Created index: idx_title");
    } catch (e) { console.log("Index idx_title might already exist or error:", e.message); }

    try {
        await databases.createIndex(DB_ID, COLLECTION_ID, 'idx_purchaseLocation', 'key', ['purchaseLocation'], ['asc']);
        console.log("Created index: idx_purchaseLocation");
    } catch (e) { console.log("Index idx_purchaseLocation might already exist or error:", e.message); }

    try {
        await databases.createIndex(DB_ID, COLLECTION_ID, 'idx_identity', 'key', ['identity'], ['asc']);
        console.log("Created index: idx_identity");
    } catch (e) { console.log("Index idx_identity might already exist or error:", e.message); }

    console.log("Alpha Schema Update Complete!");
}

run();

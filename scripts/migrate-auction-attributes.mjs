import { Client, Databases } from 'node-appwrite';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const ENDPOINT = process.env.PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || "resale_db";
const COLLECTION_ID = process.env.PUBLIC_APPWRITE_COLLECTION_ID || "items";

async function run() {
    if (!API_KEY) {
        console.error("APPWRITE_API_KEY is not defined in .env. Cannot modify collection schema.");
        process.exit(1);
    }

    const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
    const db = new Databases(client);

    try {
        console.log(`Checking existing attributes in collection '${COLLECTION_ID}' (db: '${DB_ID}')...`);
        const col = await db.getCollection(DB_ID, COLLECTION_ID);
        const existingKeys = new Set(col.attributes.map(a => a.key));

        // 1. auctionEndsAt (string or datetime)
        if (!existingKeys.has('auctionEndsAt')) {
            console.log("Creating attribute 'auctionEndsAt' (string/ISO-8601)...");
            await db.createStringAttribute(DB_ID, COLLECTION_ID, 'auctionEndsAt', 64, false);
            console.log("✓ 'auctionEndsAt' attribute created.");
        } else {
            console.log("- 'auctionEndsAt' already exists.");
        }

        // 2. maxBid (float)
        if (!existingKeys.has('maxBid')) {
            console.log("Creating attribute 'maxBid' (float)...");
            await db.createFloatAttribute(DB_ID, COLLECTION_ID, 'maxBid', false);
            console.log("✓ 'maxBid' attribute created.");
        } else {
            console.log("- 'maxBid' already exists.");
        }

        // 3. currentBid (float)
        if (!existingKeys.has('currentBid')) {
            console.log("Creating attribute 'currentBid' (float)...");
            await db.createFloatAttribute(DB_ID, COLLECTION_ID, 'currentBid', false);
            console.log("✓ 'currentBid' attribute created.");
        } else {
            console.log("- 'currentBid' already exists.");
        }

        console.log("\nMigration complete! All auction sniper attributes are provisioned.");
    } catch (e) {
        console.error("Error running migration:", e.message);
    }
}

run();

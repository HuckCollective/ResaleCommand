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
    const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
    const db = new Databases(client);

    try {
        console.log(`Fetching collection: ${COLLECTION_ID} attributes in database: ${DB_ID}...`);
        const col = await db.getCollection(DB_ID, COLLECTION_ID);
        console.log("Attributes:");
        for (const attr of col.attributes) {
            console.log(`- ${attr.key} (${attr.type})`);
        }
    } catch (e) {
        console.error("Error fetching collection:", e.message);
    }
}
run();

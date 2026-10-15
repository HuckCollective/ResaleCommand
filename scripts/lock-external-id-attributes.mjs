import { Client, Databases } from 'node-appwrite';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const ENDPOINT = process.env.PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1';
const PROJECT_ID = process.env.PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

const COLLECTIONS = ['items_dev', 'items'];

async function run() {
    if (!API_KEY) {
        console.error("❌ APPWRITE_API_KEY is missing from .env");
        process.exit(1);
    }

    const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
    const db = new Databases(client);

    console.log("🔒 Locking External ID & SKU Attributes in Appwrite...");
    console.log(`Endpoint: ${ENDPOINT} | Project: ${PROJECT_ID} | DB: ${DB_ID}\n`);

    for (const col of COLLECTIONS) {
        console.log(`\n========================================`);
        console.log(`📦 Checking Collection: [${col}]`);
        console.log(`========================================`);

        try {
            const colData = await db.getCollection(DB_ID, col);
            const existingAttrs = new Set(colData.attributes.map(a => a.key));
            const existingIndexes = new Set(colData.indexes.map(i => i.key));

            console.log(`Found ${existingAttrs.size} existing attributes, ${existingIndexes.size} existing indexes.`);

            // 1. Attribute: orderId (String, 255, optional)
            if (!existingAttrs.has('orderId')) {
                console.log(`  ➕ Adding 'orderId' string attribute (size 255)...`);
                try {
                    await db.createStringAttribute(DB_ID, col, 'orderId', 255, false);
                    console.log(`  ✅ Successfully created 'orderId' attribute.`);
                } catch (err) {
                    console.error(`  ❌ Failed to create 'orderId': ${err.message}`);
                }
            } else {
                console.log(`  ✓ 'orderId' attribute already exists.`);
            }

            // 2. Index: idx_orderId (Type: key, Attributes: ['orderId'])
            if (!existingIndexes.has('idx_orderId') && !existingIndexes.has('orderId_idx')) {
                console.log(`  ➕ Creating index 'idx_orderId' for instant Order # search...`);
                try {
                    await db.createIndex(DB_ID, col, 'idx_orderId', 'key', ['orderId'], ['ASC']);
                    console.log(`  ✅ Successfully created 'idx_orderId' index.`);
                } catch (err) {
                    console.log(`  ℹ️ Index note for 'idx_orderId': ${err.message}`);
                }
            } else {
                console.log(`  ✓ 'orderId' index already exists.`);
            }

            // 3. Index: idx_locationSku (Type: key, Attributes: ['locationSku'])
            if (!existingIndexes.has('idx_locationSku') && !existingIndexes.has('locationSku_idx')) {
                console.log(`  ➕ Creating index 'idx_locationSku' for Ricochet POS barcode sync...`);
                try {
                    await db.createIndex(DB_ID, col, 'idx_locationSku', 'key', ['locationSku'], ['ASC']);
                    console.log(`  ✅ Successfully created 'idx_locationSku' index.`);
                } catch (err) {
                    console.log(`  ℹ️ Index note for 'idx_locationSku': ${err.message}`);
                }
            } else {
                console.log(`  ✓ 'locationSku' index already exists.`);
            }

            // 4. Index: idx_upc (Type: key, Attributes: ['upc'])
            if (!existingIndexes.has('idx_upc') && !existingIndexes.has('upc_idx')) {
                console.log(`  ➕ Creating index 'idx_upc' for scannable tag search...`);
                try {
                    await db.createIndex(DB_ID, col, 'idx_upc', 'key', ['upc'], ['ASC']);
                    console.log(`  ✅ Successfully created 'idx_upc' index.`);
                } catch (err) {
                    console.log(`  ℹ️ Index note for 'idx_upc': ${err.message}`);
                }
            } else {
                console.log(`  ✓ 'upc' index already exists.`);
            }

        } catch (err) {
            console.error(`❌ Error accessing collection [${col}]: ${err.message}`);
        }
    }

    console.log(`\n🎉 Schema lockdown finished successfully!`);
}

run();

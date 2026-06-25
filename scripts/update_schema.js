import { Client, Databases, Query } from 'node-appwrite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID;

const COLLECTIONS = ['items', 'items_dev', 'alpha_items'];

async function checkAndUpdateSchema() {
    for (const col of COLLECTIONS) {
        console.log(`\n==================================================`);
        console.log(`Checking Collection Schema for Collection ID: ${col}`);
        console.log(`==================================================`);
        
        try {
            const attributes = await databases.listAttributes(DB_ID, col, [Query.limit(100)]);
            const attributeMap = new Map(attributes.attributes.map(a => [a.key, a]));

            // Check rawAnalysis
            if (!attributeMap.has('rawAnalysis')) {
                console.log(`🔴 rawAnalysis is MISSING on ${col}. Adding it now...`);
                try {
                    await databases.createStringAttribute(DB_ID, col, 'rawAnalysis', 5000, false);
                    console.log(`✅ Created rawAnalysis attribute request sent for ${col}.`);
                } catch (e) {
                    console.error(`❌ Failed to create rawAnalysis on ${col}:`, e.message);
                }
            } else {
                const attr = attributeMap.get('rawAnalysis');
                console.log(`🟢 rawAnalysis exists on ${col}. Status: ${attr.status}`);
            }

            // Check condition
            if (!attributeMap.has('condition')) {
                console.log(`🔴 condition is MISSING on ${col}. Adding it now...`);
                try {
                    await databases.createStringAttribute(DB_ID, col, 'condition', 255, false);
                    console.log(`✅ Created condition attribute request sent for ${col}.`);
                } catch (e) {
                    console.error(`❌ Failed to create condition on ${col}:`, e.message);
                }
            } else {
                 const attr = attributeMap.get('condition');
                 console.log(`🟢 condition exists on ${col}. Status: ${attr.status}`);
            }

        } catch (e) {
            console.error(`Schema Check Failed for ${col}:`, e.message);
        }
    }
    console.log('\nProcessing complete. If you just added attributes, please wait a minute for them to become "available".');
}

checkAndUpdateSchema();

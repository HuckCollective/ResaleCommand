import { Client, Databases } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

async function audit() {
    console.log(`Auditing database: ${DB_ID}`);

    // 1. Check manifests collection
    try {
        const manifestsCol = await databases.getCollection(DB_ID, 'manifests');
        console.log(`✅ Collection 'manifests' exists (${manifestsCol.name}). Total attributes: ${manifestsCol.attributes.length}`);
        manifestsCol.attributes.forEach(a => console.log(`   - ${a.key} [${a.type}]`));
    } catch (e) {
        console.error(`❌ Collection 'manifests' missing or inaccessible:`, e.message);
    }

    // 2. Compare items_dev vs items
    try {
        const devItems = await databases.getCollection(DB_ID, 'items_dev');
        const prodItems = await databases.getCollection(DB_ID, 'items');
        const devKeys = new Set(devItems.attributes.map(a => a.key));
        const prodKeys = new Set(prodItems.attributes.map(a => a.key));
        
        const missingInProd = [...devKeys].filter(k => !prodKeys.has(k));
        if (missingInProd.length === 0) {
            console.log(`✅ 'items' (prod) has all ${prodKeys.size} attributes matching 'items_dev'.`);
        } else {
            console.warn(`⚠️ 'items' (prod) is MISSING attributes:`, missingInProd);
        }
    } catch (e) {
        console.error(`Error comparing items schemas:`, e.message);
    }

    // 3. Compare purchases_dev vs purchases
    try {
        const devPurchases = await databases.getCollection(DB_ID, 'purchases_dev');
        const prodPurchases = await databases.getCollection(DB_ID, 'purchases');
        const devKeys = new Set(devPurchases.attributes.map(a => a.key));
        const prodKeys = new Set(prodPurchases.attributes.map(a => a.key));
        
        const missingInProd = [...devKeys].filter(k => !prodKeys.has(k));
        if (missingInProd.length === 0) {
            console.log(`✅ 'purchases' (prod) has all ${prodKeys.size} attributes matching 'purchases_dev'.`);
        } else {
            console.warn(`⚠️ 'purchases' (prod) is MISSING attributes:`, missingInProd);
        }
    } catch (e) {
        console.error(`Error comparing purchases schemas:`, e.message);
    }
}

audit();

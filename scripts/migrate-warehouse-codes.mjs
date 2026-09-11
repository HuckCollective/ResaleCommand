import { Client, Databases, Query } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const ENDPOINT = process.env.PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

if (!API_KEY || !ENDPOINT || !PROJECT_ID) {
    console.error("Missing required Appwrite environment variables in .env");
    process.exit(1);
}

const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

const databases = new Databases(client);

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
    console.log("=== Step 1: Checking/Adding 'code' attribute to 'warehouses' ===");
    try {
        const coll = await databases.getCollection(DB_ID, 'warehouses');
        const hasCode = coll.attributes.some(a => a.key === 'code');
        
        if (!hasCode) {
            console.log("Creating 'code' string attribute on 'warehouses' collection...");
            await databases.createStringAttribute(DB_ID, 'warehouses', 'code', 16, false);
            
            // Poll until attribute is available
            console.log("Waiting for attribute to become available in Appwrite...");
            for (let i = 0; i < 20; i++) {
                await wait(1000);
                const updatedColl = await databases.getCollection(DB_ID, 'warehouses');
                const attr = updatedColl.attributes.find(a => a.key === 'code');
                if (attr && attr.status === 'available') {
                    console.log("Attribute 'code' is now available!");
                    break;
                }
            }
        } else {
            console.log("Attribute 'code' already exists on 'warehouses'.");
        }
    } catch (e) {
        console.error("Error inspecting/creating 'code' attribute:", e.message);
        process.exit(1);
    }

    console.log("\n=== Step 2: Updating existing Warehouse documents with standardized Names & Codes ===");
    try {
        const res = await databases.listDocuments(DB_ID, 'warehouses');
        console.log(`Found ${res.total} warehouse documents.`);

        for (const doc of res.documents) {
            const rawName = (doc.name || '').toLowerCase().replace(/[\s\-_]/g, '');
            let targetName = doc.name;
            let targetCode = doc.code || '';
            let targetType = doc.type || 'Warehouse';

            if (rawName.includes('memory') || rawName.includes('den') || rawName.includes('adventures') || rawName.includes('outfitters')) {
                targetName = "Memory Den - Huck's Adventures Outfitters";
                targetCode = 'MD';
                targetType = 'Consignment Booth';
            } else if (rawName.includes('dusty') || rawName.includes('tiger')) {
                targetName = 'Dusty Tiger';
                targetCode = 'DT';
                targetType = 'Consignment Booth';
            } else if (rawName.includes('hide')) {
                targetName = 'Hideout';
                targetCode = 'HD';
                targetType = 'Warehouse';
            } else if (rawName.includes('huck') || rawName.includes('garage')) {
                targetName = "Huck's Garage";
                targetCode = 'HG';
                targetType = 'Warehouse';
            }

            if (targetCode && (doc.code !== targetCode || doc.name !== targetName || doc.type !== targetType)) {
                console.log(`Updating document ${doc.$id}: "${doc.name}" -> "${targetName}" [${targetCode}] (${targetType})`);
                await databases.updateDocument(DB_ID, 'warehouses', doc.$id, {
                    name: targetName,
                    code: targetCode,
                    type: targetType
                });
            } else {
                console.log(`Document ${doc.$id} is already up to date: "${doc.name}" [${doc.code}]`);
            }
        }

        console.log("\n=== Step 3: Verification of Warehouses ===");
        const verifyRes = await databases.listDocuments(DB_ID, 'warehouses');
        verifyRes.documents.forEach(d => {
            console.log(`✓ ID: ${d.$id} | Name: "${d.name}" | Code: "${d.code}" | Type: "${d.type}"`);
        });

        console.log("\nWarehouse code migration completed successfully!");
    } catch (e) {
        console.error("Failed to migrate warehouse documents:", e.message);
        process.exit(1);
    }
}

run();

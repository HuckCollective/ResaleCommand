import { Client, Databases, Query } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

async function inspect() {
    console.log("=== WAREHOUSES ===");
    try {
        const whRes = await databases.listDocuments(DB_ID, 'warehouses');
        for (const w of whRes.documents) {
            console.log(`[${w.$id}] name: "${w.name}", code: "${w.code}", type: "${w.type}", address: "${w.address || ''}"`);
        }
    } catch(e) {
        console.error("Error reading warehouses:", e.message);
    }

    async function summarizeCol(colName) {
        let offset = 0;
        const storageCounts = {};
        const sellingCounts = {};
        while (true) {
            const res = await databases.listDocuments(DB_ID, colName, [
                Query.limit(100),
                Query.offset(offset),
                Query.select(['storageLocation', 'sellingLocations', 'status'])
            ]);
            if (res.documents.length === 0) break;
            for (const d of res.documents) {
                let sl = (d.storageLocation || '(null)').trim();
                if (sl.startsWith('[SCOUT_REPORT_ID') || sl.startsWith('[GALLERY IDS')) {
                    sl = '[CORRUPTED_NOTE_TAG]';
                }
                storageCounts[sl] = (storageCounts[sl] || 0) + 1;
                if (Array.isArray(d.sellingLocations)) {
                    for (const sell of d.sellingLocations) {
                        sellingCounts[sell] = (sellingCounts[sell] || 0) + 1;
                    }
                }
            }
            offset += res.documents.length;
            if (offset >= res.total) break;
        }
        console.log(`\n=== ${colName.toUpperCase()} SUMMARY ===`);
        console.log("Storage Locations:", storageCounts);
        console.log("Selling Locations:", sellingCounts);
    }

    await summarizeCol('items_dev');
    await summarizeCol('items');
}

inspect().catch(console.error);

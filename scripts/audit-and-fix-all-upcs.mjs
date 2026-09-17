import dotenv from 'dotenv';
import { Client, Databases, Query } from 'node-appwrite';
dotenv.config();

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

function isValidUpc(u) {
    if (!u || typeof u !== 'string') return false;
    const trimmed = u.trim();
    if (trimmed.length < 5 || trimmed.length > 18) return false;
    if (/^[0-9a-f]{20}$/i.test(trimmed)) return false; // Raw Appwrite doc ID
    return /^[A-Z]{2,8}-\d+$/i.test(trimmed);
}

async function audit() {
    console.log('--- Auditing All Inventory Items for Missing or Invalid UPCs ---');
    let allItems = [];
    let offset = 0;
    while (true) {
        const batch = await databases.listDocuments('resale_db', 'items', [
            Query.limit(100),
            Query.offset(offset)
        ]);
        allItems.push(...batch.documents);
        if (batch.documents.length < 100) break;
        offset += 100;
    }
    console.log(`Total inventory items in database: ${allItems.length}`);

    // Track existing valid UPCs
    const existingUpcs = new Set();
    const numbers = [];
    allItems.forEach(i => {
        if (isValidUpc(i.upc)) {
            const upc = i.upc.trim().toUpperCase();
            existingUpcs.add(upc);
            const m = upc.match(/HUCK-(\d+)/i);
            if (m) numbers.push(parseInt(m[1], 10));
        }
    });

    let maxNum = numbers.length > 0 ? Math.max(...numbers) : 1467;
    console.log(`Current highest HUCK number in database: ${maxNum}`);

    // Find items without valid UPCs
    const itemsNeedingUpc = allItems.filter(i => !isValidUpc(i.upc));
    console.log(`Items missing or having invalid UPC: ${itemsNeedingUpc.length}`);

    itemsNeedingUpc.forEach(i => {
        console.log(` - [${i.$id}] "${i.title?.substring(0, 40)}" | Current UPC: "${i.upc}" | Status: ${i.status}`);
    });

    // Check duplicates
    const counts = {};
    allItems.forEach(i => {
        if (isValidUpc(i.upc)) {
            const upc = i.upc.trim().toUpperCase();
            counts[upc] = (counts[upc] || 0) + 1;
        }
    });
    const dupes = Object.entries(counts).filter(([k, v]) => v > 1);
    console.log(`Duplicate UPCs in DB:`, dupes);
}

audit().catch(console.error);

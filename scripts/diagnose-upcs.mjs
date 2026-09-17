import dotenv from 'dotenv';
import { Client, Databases, Query } from 'node-appwrite';
dotenv.config();

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

async function check() {
    // 1. Search for HUCK-1464
    const res1464 = await databases.listDocuments('resale_db', 'items', [
        Query.equal('upc', 'HUCK-1464')
    ]);
    console.log('Items with HUCK-1464:', res1464.documents.map(d => ({ id: d.$id, title: d.title, upc: d.upc, createdAt: d.$createdAt })));

    // 2. Search for HUCK-1465 and HUCK-1466
    const res1465 = await databases.listDocuments('resale_db', 'items', [
        Query.equal('upc', 'HUCK-1465')
    ]);
    console.log('Items with HUCK-1465:', res1465.documents.map(d => ({ id: d.$id, title: d.title, upc: d.upc, createdAt: d.$createdAt })));

    const res1466 = await databases.listDocuments('resale_db', 'items', [
        Query.equal('upc', 'HUCK-1466')
    ]);
    console.log('Items with HUCK-1466:', res1466.documents.map(d => ({ id: d.$id, title: d.title, upc: d.upc, createdAt: d.$createdAt })));

    // 3. Find highest HUCK- upcs across all items
    let allHuck = [];
    let offset = 0;
    while (true) {
        const batch = await databases.listDocuments('resale_db', 'items', [
            Query.startsWith('upc', 'HUCK-'),
            Query.limit(100),
            Query.offset(offset)
        ]);
        allHuck.push(...batch.documents);
        if (batch.documents.length < 100) break;
        offset += 100;
    }
    console.log('Total HUCK items in database:', allHuck.length);

    // Extract all numbers
    const numbers = allHuck.map(d => {
        const m = (d.upc || '').match(/HUCK-(\d+)/i);
        return m ? parseInt(m[1], 10) : 0;
    }).filter(n => n > 0);

    const maxNum = Math.max(...numbers);
    console.log('Max HUCK number in DB:', maxNum);

    // Check for any other duplicates
    const counts = {};
    const itemsByUpc = {};
    for (const d of allHuck) {
        const u = d.upc.trim().toUpperCase();
        counts[u] = (counts[u] || 0) + 1;
        if (!itemsByUpc[u]) itemsByUpc[u] = [];
        itemsByByUpcOrPush(itemsByUpc, u, d);
    }
    const dupes = Object.entries(counts).filter(([k, v]) => v > 1);
    console.log('\nAll duplicate UPCs in DB:', dupes);
    for (const [upc] of dupes) {
        console.log(`\nDuplicate: ${upc}`);
        for (const it of itemsByUpc[upc]) {
            console.log(`  - [${it.$id}] "${it.title}" (created: ${it.$createdAt})`);
        }
    }
}

function itemsByByUpcOrPush(map, key, val) {
    if (!map[key]) map[key] = [];
    map[key].push({ id: val.$id, title: val.title, createdAt: val.$createdAt });
}

check().catch(console.error);

import 'dotenv/config';
import { Client, Databases, ID, Query } from 'node-appwrite';

const ENDPOINT = process.env.PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1';
const PROJECT_ID = process.env.PUBLIC_APPWRITE_PROJECT_ID || '69714b35003a8adab6bb';
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

if (!API_KEY) {
    console.error('❌ Missing APPWRITE_API_KEY in .env');
    process.exit(1);
}

const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

const db = new Databases(client);

const CANONICAL_IDS = new Set([
    '6a7e70050009db0e1857', // MD
    '6a7e71eb001f53734a86', // DT
    '6a7e6f73003a5a2a7c34', // HG
    '6a7e6f900015297279a5', // HD
    '6ae3afbd0030a7eb8a9c', // HH
]);

const DUPLICATE_IDS = [
    '6a83686e0008cde59dc7',
    '6ab5c54300343ee0d6d6',
    '6ab9a37500233d76d580',
];

async function main() {
    console.log('🔍 Auditing resale_db.warehouses...\n');

    const res = await db.listDocuments(DB_ID, 'warehouses', [Query.limit(100)]);
    console.log(`Found ${res.documents.length} warehouse document(s):`);
    for (const w of res.documents) {
        console.log(`  • [${w.$id}] code=${w.code || '-'} | name="${w.name}" | type=${w.type} | comm=${w.commissionRate}% | rent=$${w.monthlyRent}`);
    }

    // 1. Check and remove duplicate warehouse IDs after verifying zero item references
    for (const dupId of DUPLICATE_IDS) {
        const exists = res.documents.find(d => d.$id === dupId);
        if (!exists) {
            console.log(`✅ Duplicate warehouse ${dupId} is already deleted.`);
            continue;
        }

        const itemRefs = await db.listDocuments(DB_ID, 'items', [
            Query.or([
                Query.equal('warehouseId', dupId),
                Query.equal('locationId', dupId),
            ]),
            Query.limit(10),
        ]).catch(() => ({ total: 0, documents: [] }));

        if (itemRefs.total > 0) {
            console.warn(`⚠️ Skipping delete of ${dupId}: ${itemRefs.total} item(s) still reference it.`);
            continue;
        }

        await db.deleteDocument(DB_ID, 'warehouses', dupId);
        console.log(`🗑️ Deleted duplicate warehouse document ${dupId} ("${exists.name}")`);
    }

    // 2. Ensure HH warehouse exists
    const refreshed = await db.listDocuments(DB_ID, 'warehouses', [Query.limit(100)]);
    const existingHh = refreshed.documents.find(
        w => w.$id === '6ae3afbd0030a7eb8a9c' || String(w.code || '').toUpperCase() === 'HH'
    );

    if (existingHh) {
        console.log(`✅ Warehouse HH already exists: [${existingHh.$id}] "${existingHh.name}" (code=${existingHh.code})`);
    } else {
        const sampleTenant = refreshed.documents.find(w => w.tenantId)?.tenantId || '';
        const created = await db.createDocument(DB_ID, 'warehouses', '6ae3afbd0030a7eb8a9c', {
            name: "Huck's Hideout",
            code: 'HH',
            type: 'Warehouse',
            commissionRate: 0,
            monthlyRent: 0,
            ...(sampleTenant ? { tenantId: sampleTenant } : {}),
        });
        console.log(`✨ Created HH warehouse document: [${created.$id}] "${created.name}"`);
    }

    // 3. Final summary
    const finalRes = await db.listDocuments(DB_ID, 'warehouses', [Query.limit(100)]);
    console.log(`\n✨ Final resale_db.warehouses (${finalRes.documents.length} canonical records):`);
    for (const w of finalRes.documents) {
        const badge = CANONICAL_IDS.has(w.$id) ? '✅' : 'ℹ️';
        console.log(`  ${badge} [${w.$id}] ${(w.code || '').padEnd(4)} — ${w.name} (${w.type}, ${w.commissionRate}% fee, $${w.monthlyRent}/mo)`);
    }
}

main().catch(err => {
    console.error('❌ Warehouse cleanup failed:', err);
    process.exit(1);
});


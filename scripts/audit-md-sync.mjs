import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { Client, Databases, Query } from 'node-appwrite';

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

async function fetchAllDocuments(collectionId) {
    const all = [];
    let cursor = null;
    while (true) {
        const queries = [Query.orderDesc('$id'), Query.limit(100)];
        if (cursor) queries.push(Query.cursorAfter(cursor));
        const res = await db.listDocuments(DB_ID, collectionId, queries);
        if (!res.documents || res.documents.length === 0) break;
        all.push(...res.documents);
        cursor = res.documents[res.documents.length - 1].$id;
        if (res.documents.length < 100 || all.length >= res.total) break;
    }
    return all;
}

const KNOWN_WAREHOUSE_IDS = [
    '6a7e70050009db0e1857', // MD
    '6a7e71eb001f53734a86', // DT
    '6a7e6f73003a5a2a7c34', // HG
    '6a7e6f900015297279a5', // HD
    '6ae3afbd0030a7eb8a9c', // HH
    '6a83686e0008cde59dc7', // Duplicate
    '6ab5c54300343ee0d6d6', // Duplicate
    '6ab9a37500233d76d580', // Duplicate MD
];

function inc(map, key) {
    const k = key === undefined || key === null || key === '' ? '(empty)' : String(key);
    map.set(k, (map.get(k) || 0) + 1);
}

function printSortedMap(title, map, limit = 30) {
    console.log(`\n=== ${title} ===`);
    const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    for (const [k, v] of sorted.slice(0, limit)) {
        console.log(`  ${String(v).padStart(5)}  ${k}`);
    }
    if (sorted.length > limit) {
        console.log(`  ... and ${sorted.length - limit} more distinct values`);
    }
}

async function main() {
    console.log('🔎 [READ-ONLY AUDIT] Inspecting resale_db.items, warehouses, manifests, and sync sources...\n');

    // 1. Fetch all items (read-only)
    const items = await fetchAllDocuments('items');
    console.log(`📦 Total documents in resale_db.items: ${items.length}`);

    // Collect all attribute names present on items
    const attrKeys = new Set();
    const statusMap = new Map();
    const storageLocMap = new Map();
    const warehouseIdMap = new Map();
    const locationIdMap = new Map();
    const sellingLocMap = new Map();
    const salesChannelMap = new Map();
    const statusByStorageMap = new Map();

    let has0EjSkuCount = 0;
    let has0EjButNotMdLoc = 0;
    let has0EjButNotPlacedStatus = 0;
    let placedButHgOrEmpty = 0;
    let mdLocButNotPlaced = 0;
    let sellingLocMdButStorageNotMd = 0;
    let conditionNotesHasMd = 0;

    const sample0EjMismatch = [];
    const samplePlacedButHg = [];
    const sampleSellingLocMdMismatch = [];

    for (const item of items) {
        for (const k of Object.keys(item)) {
            if (!k.startsWith('$')) attrKeys.add(k);
        }

        const st = String(item.status || '').trim();
        const loc = String(item.storageLocation || '').trim();
        const locUpper = loc.toUpperCase();
        const sku = String(item.locationSku || '').trim().toUpperCase();
        const upc = String(item.upc || '').trim().toUpperCase();
        const isWorkingStock = !['sold', 'combined', 'deconstructed', 'archived', 'tracked', 'draft', 'scouted'].includes(st.toLowerCase());

        inc(statusMap, st);
        inc(storageLocMap, loc);
        inc(warehouseIdMap, item.warehouseId);
        inc(locationIdMap, item.locationId);
        inc(statusByStorageMap, `status=${st || '(empty)'} | storageLocation=${loc || '(empty)'}`);

        if (Array.isArray(item.sellingLocations)) {
            if (item.sellingLocations.length === 0) inc(sellingLocMap, '(empty array)');
            for (const sl of item.sellingLocations) inc(sellingLocMap, sl);
        } else {
            inc(sellingLocMap, item.sellingLocations);
        }

        if (Array.isArray(item.salesChannel)) {
            if (item.salesChannel.length === 0) inc(salesChannelMap, '(empty array)');
            for (const sc of item.salesChannel) inc(salesChannelMap, sc);
        } else {
            inc(salesChannelMap, item.salesChannel);
        }

        const isMdStorage =
            locUpper === 'MD' ||
            locUpper.startsWith('MD-') ||
            locUpper.startsWith('MD ') ||
            locUpper.includes('MEMORY DEN') ||
            locUpper.includes('0EJ');

        const has0Ej = sku.startsWith('0EJ') || upc.startsWith('0EJ');
        if (has0Ej) {
            has0EjSkuCount++;
            if (isWorkingStock && !isMdStorage) {
                has0EjButNotMdLoc++;
                if (sample0EjMismatch.length < 12) {
                    sample0EjMismatch.push({
                        $id: item.$id,
                        upc: item.upc,
                        locationSku: item.locationSku,
                        status: item.status,
                        storageLocation: item.storageLocation,
                        sellingLocations: item.sellingLocations,
                        title: String(item.title || '').slice(0, 55),
                    });
                }
            }
            if (isWorkingStock && st.toLowerCase() !== 'placed') {
                has0EjButNotPlacedStatus++;
            }
        }

        if (st.toLowerCase() === 'placed' && (!isMdStorage && !locUpper.startsWith('DT') && !locUpper.includes('DUSTY TIGER'))) {
            placedButHgOrEmpty++;
            if (samplePlacedButHg.length < 12) {
                samplePlacedButHg.push({
                    $id: item.$id,
                    upc: item.upc,
                    locationSku: item.locationSku,
                    status: item.status,
                    storageLocation: item.storageLocation,
                    sellingLocations: item.sellingLocations,
                    title: String(item.title || '').slice(0, 55),
                });
            }
        }

        if (isWorkingStock && isMdStorage && st.toLowerCase() !== 'placed') {
            mdLocButNotPlaced++;
        }

        const sellingHasMd = Array.isArray(item.sellingLocations) &&
            item.sellingLocations.some(s => /memory den|\bmd\b|0ej/i.test(String(s)));
        if (isWorkingStock && sellingHasMd && !isMdStorage) {
            sellingLocMdButStorageNotMd++;
            if (sampleSellingLocMdMismatch.length < 10) {
                sampleSellingLocMdMismatch.push({
                    $id: item.$id,
                    upc: item.upc,
                    locationSku: item.locationSku,
                    status: item.status,
                    storageLocation: item.storageLocation,
                    sellingLocations: item.sellingLocations,
                    title: String(item.title || '').slice(0, 55),
                });
            }
        }

        if (isWorkingStock && !isMdStorage && /memory den|0ej/i.test(String(item.conditionNotes || ''))) {
            conditionNotesHasMd++;
        }
    }

    console.log(`\n📋 Attributes on resale_db.items (${attrKeys.size}):`);
    console.log('  ' + Array.from(attrKeys).sort().join(', '));

    printSortedMap('Distinct status Values (All Items)', statusMap);
    printSortedMap('Distinct storageLocation Values (Top 35)', storageLocMap, 35);
    printSortedMap('Distinct status x storageLocation Combinations (Top 35)', statusByStorageMap, 35);
    printSortedMap('Distinct warehouseId Values', warehouseIdMap);
    printSortedMap('Distinct locationId Values', locationIdMap);
    printSortedMap('Distinct sellingLocations Array Entries', sellingLocMap);
    printSortedMap('Distinct salesChannel Array Entries', salesChannelMap);

    console.log('\n=== 🔍 MEMORY DEN (MD) SYNC MISMATCH DIAGNOSTICS ===');
    console.log(`  • Total items with 0EJ... in locationSku or upc:                   ${has0EjSkuCount}`);
    console.log(`  • Working-stock items with 0EJ... SKU where storageLocation != MD: ${has0EjButNotMdLoc}`);
    console.log(`  • Working-stock items with 0EJ... SKU where status != 'placed':    ${has0EjButNotPlacedStatus}`);
    console.log(`  • Items with status='placed' where storageLocation is HG/HD/empty: ${placedButHgOrEmpty}`);
    console.log(`  • Working-stock items with storageLocation=MD where status!='placed': ${mdLocButNotPlaced}`);
    console.log(`  • Working-stock items with sellingLocations=[Memory Den] but storage!=MD: ${sellingLocMdButStorageNotMd}`);
    console.log(`  • Working-stock items mentioning Memory Den/0EJ in conditionNotes: ${conditionNotesHasMd}`);

    if (sample0EjMismatch.length > 0) {
        console.log('\n--- Sample Working-Stock Items with 0EJ SKU but Non-MD storageLocation ---');
        console.table(sample0EjMismatch);
    }

    if (samplePlacedButHg.length > 0) {
        console.log('\n--- Sample Items with status="placed" but storageLocation is HG/HD/Unassigned ---');
        console.table(samplePlacedButHg);
    }

    if (sampleSellingLocMdMismatch.length > 0) {
        console.log('\n--- Sample Items with sellingLocations containing Memory Den but storageLocation != MD ---');
        console.table(sampleSellingLocMdMismatch);
    }

    // Check Outbound Manifests collection
    try {
        const manifests = await fetchAllDocuments('manifests');
        console.log(`\n=== 📋 Outbound Manifests in resale_db.manifests (${manifests.length}) ===`);
        for (const m of manifests) {
            console.log(`  • [${m.$id}] "${m.name}" | locationName="${m.locationName}" | status=${m.status} | itemCount=${m.itemCount} | exportedAt=${m.exportedAt || '-'}`);
        }
    } catch (e) {
        console.log('\n⚠️ Could not read manifests collection:', e.message);
    }

    // Check local CSV files in workspace
    const rootFiles = fs.readdirSync(process.cwd()).filter(f => /\.(csv|json)$/i.test(f));
    console.log(`\n=== 📁 Root Workspace CSV/JSON Files ===`);
    console.log('  ' + (rootFiles.join(', ') || '(none)'));
}

main().catch(err => {
    console.error('❌ Audit script failed:', err);
    process.exit(1);
});


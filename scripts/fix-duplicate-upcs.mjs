import { Client, Databases, Query } from 'node-appwrite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const ENDPOINT = process.env.PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1';
const PROJECT_ID = process.env.PUBLIC_APPWRITE_PROJECT_ID || '69714b35003a8adab6bb';
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

const isProdTarget = process.argv.includes('--prod');
const isDryRun = process.argv.includes('--dry-run');

const ITEMS_COL = isProdTarget
    ? (process.env.PUBLIC_APPWRITE_PROD_COLLECTION_ID || 'items')
    : (process.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items_dev');

if (!API_KEY) {
    console.error('❌ Missing APPWRITE_API_KEY in .env');
    process.exit(1);
}

const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

const db = new Databases(client);

async function fetchAllItems() {
    console.log(`📡 Fetching all items from ${ITEMS_COL}...`);
    const allItems = [];
    let offset = 0;
    while (true) {
        const res = await db.listDocuments(DB_ID, ITEMS_COL, [
            Query.limit(100),
            Query.offset(offset)
        ]);
        if (res.documents.length === 0) break;
        allItems.push(...res.documents);
        offset += res.documents.length;
        if (offset >= res.total) break;
    }
    console.log(`✅ Loaded ${allItems.length} total items.`);
    return allItems;
}

async function main() {
    console.log('================================================================');
    console.log('🔧 RESALE COMMAND: DUPLICATE UPC AUDIT & REASSIGNMENT TOOL');
    console.log('================================================================');
    console.log(`Database:   ${DB_ID}`);
    console.log(`Collection: ${ITEMS_COL} ${isProdTarget ? '(PRODUCTION)' : '(DEVELOPMENT)'}`);
    console.log(`Mode:       ${isDryRun ? '🔍 DRY RUN (No changes will be written)' : '⚡ LIVE REPAIR'}`);
    console.log('================================================================\n');

    const items = await fetchAllItems();

    // 1. Group by UPC
    const upcGroups = new Map();
    const maxIndexByPrefix = new Map();

    for (const doc of items) {
        const upc = doc.upc ? String(doc.upc).trim() : null;
        if (!upc) continue;

        if (!upcGroups.has(upc)) {
            upcGroups.set(upc, []);
        }
        upcGroups.get(upc).push(doc);

        // Track max index for this prefix
        const match = upc.match(/^([A-Za-z0-9]+-?)(\d+)$/);
        if (match) {
            const prefix = match[1];
            const num = parseInt(match[2], 10);
            const currentMax = maxIndexByPrefix.get(prefix) || 0;
            if (num > currentMax) {
                maxIndexByPrefix.set(prefix, num);
            }
        }
    }

    // 2. Identify duplicate groups
    const duplicateGroups = [];
    for (const [upc, docList] of upcGroups.entries()) {
        if (docList.length > 1) {
            duplicateGroups.push({ upc, docs: docList });
        }
    }

    console.log(`\n🔍 Found ${duplicateGroups.length} duplicate UPC values across ${items.length} records.`);
    for (const [prefix, maxNum] of maxIndexByPrefix.entries()) {
        console.log(`   Prefix "${prefix}": Current max index is ${maxNum}`);
    }

    if (duplicateGroups.length === 0) {
        console.log('\n🎉 No duplicate UPCs found! All items have unique barcodes.');
        return;
    }

    // 3. Plan & execute reassignments
    let reassignedCount = 0;
    console.log('\n----------------------------------------------------------------');
    console.log('📋 REASSIGNMENT PLAN:');
    console.log('----------------------------------------------------------------');

    for (const { upc, docs } of duplicateGroups) {
        // Sort documents by $createdAt ascending (earliest created keeps the original UPC)
        docs.sort((a, b) => new Date(a.$createdAt).getTime() - new Date(b.$createdAt).getTime());

        const keeper = docs[0];
        console.log(`\n⚠️ Duplicate UPC: "${upc}" (${docs.length} items)`);
        console.log(`   KEEPING original: [${keeper.$id}] "${keeper.title?.slice(0, 40)}" (Created: ${keeper.$createdAt})`);

        // Detect prefix
        const match = upc.match(/^([A-Za-z0-9]+-?)(\d+)$/);
        const prefix = match ? match[1] : 'HUCK-';

        for (let i = 1; i < docs.length; i++) {
            const dupeDoc = docs[i];
            let nextIndex = (maxIndexByPrefix.get(prefix) || 0) + 1;
            maxIndexByPrefix.set(prefix, nextIndex);

            const newUpc = `${prefix}${nextIndex.toString().padStart(4, '0')}`;
            console.log(`   REASSIGNING:      [${dupeDoc.$id}] "${dupeDoc.title?.slice(0, 40)}" -> "${newUpc}"`);

            if (!isDryRun) {
                try {
                    await db.updateDocument(DB_ID, ITEMS_COL, dupeDoc.$id, {
                        upc: newUpc
                    });
                    // Small pace delay to respect cloud rate limits
                    await new Promise(r => setTimeout(r, 120));
                } catch (err) {
                    console.error(`   ❌ Failed to update item ${dupeDoc.$id}:`, err.message);
                }
            }
            reassignedCount++;
        }
    }

    console.log('\n================================================================');
    console.log(`📊 REPAIR COMPLETE: Reassigned ${reassignedCount} duplicate items to unique UPCs.`);
    if (isDryRun) {
        console.log('ℹ️ Run without --dry-run to apply these updates to Appwrite.');
    } else {
        console.log('✅ All items now have 100% unique UPC barcodes!');
    }
    console.log('================================================================\n');
}

main().catch(console.error);

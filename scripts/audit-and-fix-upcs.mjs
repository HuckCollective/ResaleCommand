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
const isApply = process.argv.includes('--apply');

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

/**
 * Checks if an item is placed at Memory Den or sold.
 * These items have physical printed tags or registered POS sales and MUST NOT have their UPC changed.
 */
function isPlacedAtDenOrSold(doc) {
    const status = String(doc.status || '').toLowerCase().trim();
    const storageLoc = String(doc.storageLocation || '').toUpperCase().trim();
    const sellingLocs = Array.isArray(doc.sellingLocations) 
        ? doc.sellingLocations.map(l => String(l).toUpperCase().trim()) 
        : [];
    
    if (status === 'sold') return true;
    if (status === 'placed') return true;
    if (storageLoc === 'MD' || storageLoc.includes('MEMORY DEN')) return true;
    if (sellingLocs.includes('MD') || sellingLocs.some(l => l.includes('MEMORY DEN'))) return true;
    return false;
}

async function fetchAllItems() {
    console.log(`📡 Fetching all items from collection "${ITEMS_COL}"...`);
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
    console.log(`✅ Loaded ${allItems.length} total items from "${ITEMS_COL}".\n`);
    return allItems;
}

async function main() {
    console.log('================================================================');
    console.log('🔍 RESALE COMMAND: SAFE UPC AUDIT & REASSIGNMENT ENGINE');
    console.log('================================================================');
    console.log(`Database:   ${DB_ID}`);
    console.log(`Collection: ${ITEMS_COL} ${isProdTarget ? '(🔴 PRODUCTION)' : '(🟡 DEVELOPMENT)'}`);
    console.log(`Execution:  ${isApply ? '⚡ LIVE APPLY (Writing changes)' : '👀 DRY RUN AUDIT ONLY'}`);
    console.log('================================================================\n');

    const items = await fetchAllItems();

    // 1. Group by UPC and calculate highest index per prefix
    const upcGroups = new Map();
    const maxIndexByPrefix = new Map();

    for (const doc of items) {
        const upc = doc.upc ? String(doc.upc).trim() : null;
        if (!upc) continue;

        if (!upcGroups.has(upc)) {
            upcGroups.set(upc, []);
        }
        upcGroups.get(upc).push(doc);

        const match = upc.match(/^([A-Za-z0-9]+-?)(\d+)$/);
        if (match) {
            const prefix = match[1];
            const num = parseInt(match[2], 10);
            const curMax = maxIndexByPrefix.get(prefix) || 0;
            if (num > curMax) {
                maxIndexByPrefix.set(prefix, num);
            }
        }
    }

    console.log('📊 CURRENT MAXIMUM UPC BARCODES:');
    for (const [prefix, maxNum] of maxIndexByPrefix.entries()) {
        console.log(`   ${prefix}: Max number is ${maxNum} (Next: ${prefix}${String(maxNum + 1).padStart(4, '0')})`);
    }

    // 2. Filter for duplicate groups
    const duplicateGroups = [];
    for (const [upc, docList] of upcGroups.entries()) {
        if (docList.length > 1) {
            duplicateGroups.push({ upc, docs: docList });
        }
    }

    console.log(`\n🔍 Total unique UPC barcodes:  ${upcGroups.size}`);
    console.log(`⚠️  Total duplicate barcode sets: ${duplicateGroups.length}`);

    if (duplicateGroups.length === 0) {
        console.log('\n🎉 ALL UPC BARCODES ARE 100% UNIQUE! No duplicates exist.');
        return;
    }

    // 3. Analyze each duplicate set with Placed/Sold preservation rules
    let safeToReassignCount = 0;
    let conflictWarningCount = 0;
    const reassignPlan = [];

    console.log('\n----------------------------------------------------------------');
    console.log('📋 AUDIT REPORT BY DUPLICATE BARCODE:');
    console.log('----------------------------------------------------------------');

    for (const { upc, docs } of duplicateGroups) {
        const lockedDocs = docs.filter(isPlacedAtDenOrSold);
        const movableDocs = docs.filter(d => !isPlacedAtDenOrSold(d));

        console.log(`\n🏷️  Barcode: "${upc}" (Shared by ${docs.length} items)`);

        let keeperDoc = null;

        if (lockedDocs.length === 1) {
            keeperDoc = lockedDocs[0];
            console.log(`   🔒 KEPT (PLACED/SOLD AT DEN): [${keeperDoc.$id}] "${keeperDoc.title?.slice(0, 45)}" (Status: ${keeperDoc.status}, Loc: ${keeperDoc.storageLocation || 'N/A'})`);
        } else if (lockedDocs.length > 1) {
            // Multiple items placed/sold share the same UPC!
            conflictWarningCount++;
            console.log(`   🚨 CRITICAL CONFLICT: Multiple placed/sold items share this UPC!`);
            lockedDocs.forEach(d => {
                console.log(`      - [${d.$id}] "${d.title?.slice(0, 40)}" (Status: ${d.status}, Loc: ${d.storageLocation || 'N/A'}, Created: ${d.$createdAt})`);
            });
            // We keep the earliest placed/sold item on this UPC
            lockedDocs.sort((a, b) => new Date(a.$createdAt).getTime() - new Date(b.$createdAt).getTime());
            keeperDoc = lockedDocs[0];
            console.log(`      🛡️ Keeping earliest placed/sold: [${keeperDoc.$id}]`);
        } else {
            // Neither item is placed or sold (both are acquired/received/backstock)
            docs.sort((a, b) => new Date(a.$createdAt).getTime() - new Date(b.$createdAt).getTime());
            keeperDoc = docs[0];
            console.log(`   📦 KEPT (EARLIEST UNPLACED): [${keeperDoc.$id}] "${keeperDoc.title?.slice(0, 45)}" (Status: ${keeperDoc.status}, Loc: ${keeperDoc.storageLocation || 'N/A'})`);
        }

        // All other movable items get new unique UPCs
        // (If multiple locked items existed, user instructed "dont fix items that have been place ad the den or sold", so we DO NOT touch other locked items unless instructed)
        const itemsToReassign = movableDocs.filter(d => d.$id !== keeperDoc.$id);

        const match = upc.match(/^([A-Za-z0-9]+-?)(\d+)$/);
        const prefix = match ? match[1] : 'HUCK-';

        for (const item of itemsToReassign) {
            let nextIndex = (maxIndexByPrefix.get(prefix) || 0) + 1;
            maxIndexByPrefix.set(prefix, nextIndex);
            const newUpc = `${prefix}${String(nextIndex).padStart(4, '0')}`;

            console.log(`   ➡️  REASSIGNING UNPLACED: [${item.$id}] "${item.title?.slice(0, 40)}" (Status: ${item.status}) -> "${newUpc}"`);
            reassignPlan.push({ doc: item, oldUpc: upc, newUpc });
            safeToReassignCount++;
        }
    }

    console.log('\n================================================================');
    console.log('📊 AUDIT SUMMARY:');
    console.log('================================================================');
    console.log(`Total Duplicate Barcodes:       ${duplicateGroups.length}`);
    console.log(`Safe Unplaced Items to Fix:     ${safeToReassignCount}`);
    console.log(`Locked (Placed/Sold) Protected: Preserved without changes`);
    console.log(`Placed/Sold Multi-Conflicts:    ${conflictWarningCount}`);
    console.log('================================================================\n');

    if (!isApply) {
        console.log('💡 This was a DRY RUN audit. To apply these safe reassignments to the database, run:');
        console.log(`   node scripts/audit-and-fix-upcs.mjs ${isProdTarget ? '--prod ' : ''}--apply\n`);
        return;
    }

    // 4. Apply reassignments
    console.log(`🚀 Applying ${reassignPlan.length} safe UPC updates to ${ITEMS_COL}...`);
    let successCount = 0;

    for (const { doc, oldUpc, newUpc } of reassignPlan) {
        try {
            await db.updateDocument(DB_ID, ITEMS_COL, doc.$id, {
                upc: newUpc
            });
            successCount++;
            console.log(`   ✅ Updated [${doc.$id}] from "${oldUpc}" to "${newUpc}"`);
            // Pace updates to stay well clear of cloud rate limits
            await new Promise(r => setTimeout(r, 120));
        } catch (err) {
            console.error(`   ❌ Failed to update [${doc.$id}]:`, err.message);
        }
    }

    console.log(`\n🎉 Successfully updated ${successCount} unplaced items to unique UPCs!`);
}

main().catch(console.error);

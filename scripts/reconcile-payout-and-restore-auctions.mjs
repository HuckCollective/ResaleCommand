import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import { Client, Databases, Query } from 'node-appwrite';

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1')
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID || '69714b35003a8adab6bb')
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const dbId = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
const colId = 'items'; // Target production collection as seen on resalecmd.com

// The 26 items corrupted at 18:55 UTC
const CORRUPTED_IDS = [
    '6ac089d30026240a4440',
    '6ac1337d001dfd77a610',
    '6ac13391003aaa0fee2e',
    '6ac1339c003382d419bd',
    '6ac133bb0006155f9082',
    '6ac133c40013201d7765',
    '6ac133cc003e32eca0b3',
    '6ac133d500382b1c97a9',
    '6ac1340b00211e8a169a',
    '6ac13414001efc5ca55a',
    '6acadfc6000a2866c978',
    '6acadfdc003c7f1bb8d7',
    '6ad10741001d6bf6773d',
    '6ad10741002fc0411a57',
    '6ad107420002061b3ee8',
    '6ad1074200148d9913cc',
    '6ad12acd001f560660a7',
    '6ad12acd0033a9eca347',
    '6ad12ace0006f9095ec0',
    '6ad12c54001905812e03',
    '6ad12c54002b91a931bf',
    '6ad12c54003d02736b43',
    '6ad4099600275cd91478',
    '6ad40996002e086d578e',
    '6ad43d0e0026c4b2b902',
    '6ad43d0f0001e6cc5d2e'
];

function splitCsvLine(line) {
    const regex = /(?:^|,)(?:"([^"]*)"|([^,]*))/g;
    const result = [];
    let match;
    while ((match = regex.exec(line)) !== null) {
        if (match[1] !== undefined) result.push(match[1]);
        else if (match[2] !== undefined) result.push(match[2]);
        if (regex.lastIndex === match.index) regex.lastIndex++;
    }
    if (line.endsWith(',')) result.push('');
    return result;
}

async function run(applyChanges = false) {
    console.log(`\n======================================================`);
    console.log(`  RECONCILIATION & AUCTION RESTORATION ENGINE`);
    console.log(`  Mode: ${applyChanges ? '🚀 LIVE APPLY' : '🔍 DRY RUN ONLY'}`);
    console.log(`======================================================\n`);

    // 1. Restore the 26 Corrupted Items
    console.log(`--- Step 1: Restoring 26 Corrupted Auction/Draft Items ---`);
    for (const id of CORRUPTED_IDS) {
        try {
            const doc = await databases.getDocument(dbId, colId, id);
            
            // Check if it has an orderId (meaning it was a won order)
            const isWonOrder = Boolean(doc.orderId || doc.purchaseId);
            const targetStatus = isWonOrder ? 'acquired' : 'draft';
            const targetAuctionStatus = isWonOrder ? 'won' : (doc.auctionEndsAt ? null : null);
            const targetLoc = isWonOrder ? 'HG' : null;

            console.log(`[Item ${id}] "${doc.title?.slice(0, 35)}..."`);
            console.log(`  Current -> Status: ${doc.status}, Loc: ${doc.storageLocation}, LocSku: ${doc.locationSku}`);
            console.log(`  Target  -> Status: ${targetStatus}, Loc: ${targetLoc}, LocSku: null, SellingLocs: []`);

            if (applyChanges) {
                await databases.updateDocument(dbId, colId, id, {
                    status: targetStatus,
                    auctionStatus: targetAuctionStatus,
                    storageLocation: targetLoc,
                    sellingLocations: [],
                    locationSku: null
                });
                console.log(`  ✓ Restored item ${id}`);
            }
        } catch (e) {
            console.warn(`  ✕ Error on ${id}: ${e.message}`);
        }
    }

    // 2. Parse User Payout CSV and Reconcile Sales
    const csvPath = 'C:/Users/15034/.gemini/antigravity-ide/brain/5b6b8ec3-1e31-4274-9203-263f9a4a6672/.user_uploaded/media_1792608877871.csv';
    if (!fs.existsSync(csvPath)) {
        console.error(`CSV file not found at: ${csvPath}`);
        return;
    }

    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split(/\r?\n/).filter(l => l.trim().length > 0);
    console.log(`\n--- Step 2: Processing ${lines.length - 1} Payout Rows from CSV ---`);

    const headers = splitCsvLine(lines[0]).map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const upcIdx = headers.findIndex(h => h === 'upc');
    const itemIdx = headers.findIndex(h => h === 'item');
    const agreedIdx = headers.findIndex(h => h === 'agreed');
    const amountIdx = headers.findIndex(h => h === 'amount');
    const soldDateIdx = headers.findIndex(h => h === 'sold');

    // Index all active inventory items in collection
    console.log(`Fetching active inventory from Appwrite collection '${colId}'...`);
    const allItems = [];
    let cursor = null;
    let hasMore = true;
    while (hasMore) {
        const queries = [Query.limit(100)];
        if (cursor) queries.push(Query.cursorAfter(cursor));
        const res = await databases.listDocuments(dbId, colId, queries);
        allItems.push(...res.documents);
        if (res.documents.length < 100) hasMore = false;
        else cursor = res.documents[res.documents.length - 1].$id;
    }
    console.log(`Loaded ${allItems.length} inventory documents.`);

    const byUpc = new Map();
    allItems.forEach(item => {
        if (item.upc) byUpc.set(item.upc.trim().toUpperCase(), item);
    });

    const buckets = {
        HUCK: { name: 'Huck Collective (HUCK-)', count: 0, gross: 0, payout: 0, items: [] },
        PDXGL: { name: 'PDX Game Library (PDXGL-)', count: 0, gross: 0, payout: 0, items: [] },
        OTHER: { name: 'Other / Unassigned', count: 0, gross: 0, payout: 0, items: [] }
    };

    for (let i = 1; i < lines.length; i++) {
        const cols = splitCsvLine(lines[i]);
        const rawUpc = (cols[upcIdx] || '').trim().replace(/^['"]+/, '').toUpperCase();
        const itemName = (cols[itemIdx] || '').trim();
        const rawAmount = (cols[amountIdx] || '').replace(/[^0-9.]/g, '');
        const amount = parseFloat(rawAmount) || 0;
        const agreed = parseFloat((cols[agreedIdx] || '').replace(/[^0-9.]/g, '')) || 0;
        const soldDate = cols[soldDateIdx] || '';

        // Extract SKU suffix if present (e.g. "Item Title - 0EJ03C")
        const skuMatch = itemName.match(/-\s*([0-9A-Z]{5,8})$/i);
        const extractedSku = skuMatch ? skuMatch[1].trim() : null;

        if (itemName.startsWith('(Credit)') || itemName.startsWith('Total')) continue;

        let matched = null;
        if (rawUpc && byUpc.has(rawUpc)) {
            matched = byUpc.get(rawUpc);
        }

        if (matched) {
            const org = rawUpc.startsWith('PDXGL') ? 'PDXGL' : (rawUpc.startsWith('HUCK') ? 'HUCK' : 'OTHER');
            const targetBucket = buckets[org];
            targetBucket.count++;
            targetBucket.payout += amount;
            targetBucket.gross += (agreed > 0 ? agreed : amount);
            targetBucket.items.push({ upc: rawUpc, title: matched.title, amount, agreed, date: soldDate });

            console.log(`[Line ${i}] ✓ [${org}] UPC Match: ${rawUpc} ➔ "${matched.title?.slice(0, 30)}" | Net: $${amount.toFixed(2)} | Date: ${soldDate}`);
            
            if (applyChanges) {
                const updates = {
                    status: 'sold',
                    soldPrice: amount,
                    storageLocation: 'MD'
                };
                if (agreed > 0) updates.resalePrice = agreed;
                if (extractedSku) updates.locationSku = extractedSku;

                await databases.updateDocument(dbId, colId, matched.$id, updates);
            }
        }
    }

    console.log(`\n======================================================`);
    console.log(`  MULTI-ORG RECONCILIATION SUMMARY`);
    console.log(`======================================================`);
    
    for (const [key, b] of Object.entries(buckets)) {
        console.log(`\n📦 ${b.name}:`);
        console.log(`   - Sold Items: ${b.count}`);
        console.log(`   - Gross Sales: $${b.gross.toFixed(2)}`);
        console.log(`   - Consignor Take-Home Payout: $${b.payout.toFixed(2)}`);
        console.log(`   - Store Commission Retained: $${(b.gross - b.payout).toFixed(2)}`);
    }

    const totalSold = buckets.HUCK.count + buckets.PDXGL.count + buckets.OTHER.count;
    const totalPayout = buckets.HUCK.payout + buckets.PDXGL.payout + buckets.OTHER.payout;
    const totalGross = buckets.HUCK.gross + buckets.PDXGL.gross + buckets.OTHER.gross;

    console.log(`\n------------------------------------------------------`);
    console.log(`🌟 GRAND TOTALS:`);
    console.log(`   - Total Items Reconciled: ${totalSold}`);
    console.log(`   - Total Gross Revenue: $${totalGross.toFixed(2)}`);
    console.log(`   - Combined Payout: $${totalPayout.toFixed(2)}`);
    console.log(`   - Corrupted Auction Items Restored: ${CORRUPTED_IDS.length}`);
    console.log(`======================================================\n`);
}

const isApply = process.argv.includes('--apply');
run(isApply);

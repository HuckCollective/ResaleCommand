import { Client, Databases, Query } from 'node-appwrite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const ENDPOINT = process.env.PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1';
const PROJECT_ID = process.env.PUBLIC_APPWRITE_PROJECT_ID || '69714b35003a8adab6bb';
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

const isProdTarget = process.argv.includes('--prod');
const isDryRun = process.argv.includes('--dry-run');

const PURCHASES_COL = isProdTarget 
    ? (process.env.PUBLIC_APPWRITE_PROD_PURCHASES_COLLECTION_ID || 'purchases')
    : (process.env.PUBLIC_APPWRITE_PURCHASES_COLLECTION_ID || 'purchases_dev');

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

const isReceivedStatus = (st) => {
    const s = String(st || '').toLowerCase().trim();
    return ['received', 'in-stock', 'placed', 'sold'].includes(s);
};

async function getItemsForPurchase(poDoc) {
    const itemMap = new Map();

    // 1. Query by purchaseId
    try {
        const res = await db.listDocuments(DB_ID, ITEMS_COL, [
            Query.equal('purchaseId', poDoc.$id),
            Query.limit(200)
        ]);
        res.documents.forEach(d => itemMap.set(d.$id, d));
    } catch (e) {
        // Ignored
    }

    // 2. Query by poNumber if exists
    if (poDoc.poNumber) {
        try {
            const resPo = await db.listDocuments(DB_ID, ITEMS_COL, [
                Query.equal('purchaseId', poDoc.poNumber),
                Query.limit(200)
            ]);
            resPo.documents.forEach(d => itemMap.set(d.$id, d));
        } catch (e) {}
    }

    // 3. Query by cartId / orderId if present
    if (poDoc.orderId) {
        const cleanOrder = String(poDoc.orderId).trim();
        try {
            const resCart = await db.listDocuments(DB_ID, ITEMS_COL, [
                Query.equal('cartId', cleanOrder),
                Query.limit(200)
            ]);
            resCart.documents.forEach(d => itemMap.set(d.$id, d));
        } catch (e) {}
    }

    // 4. Also scan recent items if orderId is embedded in conditionNotes
    if (itemMap.size === 0 && poDoc.orderId) {
        try {
            const resNotes = await db.listDocuments(DB_ID, ITEMS_COL, [
                Query.search('conditionNotes', poDoc.orderId),
                Query.limit(100)
            ]);
            resNotes.documents.forEach(d => itemMap.set(d.$id, d));
        } catch (e) {}
    }

    return Array.from(itemMap.values());
}

async function main() {
    console.log('================================================================');
    console.log('🔄 RESALE COMMAND: ALL PURCHASES STATUS SYNCHRONIZER');
    console.log('================================================================');
    console.log(`📡 Endpoint:    ${ENDPOINT}`);
    console.log(`🗄️  Database:    ${DB_ID}`);
    console.log(`📦 Purchases:   ${PURCHASES_COL} ${isProdTarget ? '(PRODUCTION)' : '(DEVELOPMENT)'}`);
    console.log(`🏷️  Items:       ${ITEMS_COL}`);
    console.log(`🔍 Mode:        ${isDryRun ? 'DRY-RUN (No changes applied)' : 'LIVE SYNC'}`);
    console.log('----------------------------------------------------------------\n');

    let offset = 0;
    const limit = 50;
    let hasMore = true;
    const allPurchases = [];

    while (hasMore) {
        const res = await db.listDocuments(DB_ID, PURCHASES_COL, [
            Query.orderDesc('$createdAt'),
            Query.limit(limit),
            Query.offset(offset)
        ]);

        allPurchases.push(...res.documents);
        if (res.documents.length < limit) {
            hasMore = false;
        } else {
            offset += limit;
        }
    }

    console.log(`Found ${allPurchases.length} total purchase orders to evaluate.\n`);

    const stats = {
        total: allPurchases.length,
        alreadyCorrect: 0,
        updatedToReceived: 0,
        updatedToPartial: 0,
        updatedToPending: 0,
        skippedTerminal: 0,
        noItemsFound: 0,
        errors: 0
    };

    for (let i = 0; i < allPurchases.length; i++) {
        const po = allPurchases[i];
        const poIdentifier = po.poNumber || po.orderId || po.$id;
        const currentStatus = po.status || 'Draft';

        // Skip terminal statuses
        if (currentStatus === 'Cancelled' || currentStatus === 'Returned') {
            console.log(`[${i + 1}/${allPurchases.length}] ⏭️  ${poIdentifier}: Kept "${currentStatus}" (Terminal status protected)`);
            stats.skippedTerminal++;
            continue;
        }

        try {
            const items = await getItemsForPurchase(po);

            if (items.length === 0) {
                console.log(`[${i + 1}/${allPurchases.length}] ⚪ ${poIdentifier}: No linked inventory items found. Status kept: "${currentStatus}".`);
                stats.noItemsFound++;
                continue;
            }

            const totalCount = items.length;
            const receivedItems = items.filter(it => isReceivedStatus(it.status));
            const receivedCount = receivedItems.length;

            let targetStatus = currentStatus;
            if (receivedCount === totalCount) {
                targetStatus = 'Received';
            } else if (receivedCount > 0) {
                targetStatus = 'Partial';
            } else if (['Received', 'Partial', 'Partially Received'].includes(currentStatus)) {
                targetStatus = 'Pending';
            }

            if (targetStatus !== currentStatus) {
                if (!isDryRun) {
                    await db.updateDocument(DB_ID, PURCHASES_COL, po.$id, {
                        status: targetStatus
                    });
                }

                console.log(`[${i + 1}/${allPurchases.length}] 🚀 ${poIdentifier}: "${currentStatus}" ➔ "${targetStatus}" (${receivedCount}/${totalCount} items received)`);

                if (targetStatus === 'Received') stats.updatedToReceived++;
                else if (targetStatus === 'Partial') stats.updatedToPartial++;
                else if (targetStatus === 'Pending') stats.updatedToPending++;
            } else {
                console.log(`[${i + 1}/${allPurchases.length}] ✅ ${poIdentifier}: "${currentStatus}" (${receivedCount}/${totalCount} items received - in sync)`);
                stats.alreadyCorrect++;
            }
        } catch (err) {
            console.error(`[${i + 1}/${allPurchases.length}] ❌ Error evaluating ${poIdentifier}:`, err.message);
            stats.errors++;
        }
    }

    console.log('\n================================================================');
    console.log('📊 SYNCHRONIZATION COMPLETE');
    console.log('================================================================');
    console.log(`Total POs Inspected:        ${stats.total}`);
    console.log(`Already In Sync:            ${stats.alreadyCorrect}`);
    console.log(`Updated to "Received":      ${stats.updatedToReceived}`);
    console.log(`Updated to "Partial":       ${stats.updatedToPartial}`);
    console.log(`Reverted to "Pending":      ${stats.updatedToPending}`);
    console.log(`Protected (Cancelled/Ret):  ${stats.skippedTerminal}`);
    console.log(`No Items Linked:            ${stats.noItemsFound}`);
    console.log(`Errors Encountered:         ${stats.errors}`);
    console.log('================================================================\n');
}

main().catch(err => {
    console.error('Fatal error in sync-all-purchases:', err);
    process.exit(1);
});

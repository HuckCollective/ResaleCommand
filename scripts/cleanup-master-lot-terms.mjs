import { Client, Databases, Query } from 'node-appwrite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const targetCollections = args.includes('--all')
    ? ['items_dev', 'items']
    : args.includes('--prod')
        ? ['items']
        : [process.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items_dev'];

async function cleanupCollection(collId) {
    console.log(`\n======================================================`);
    console.log(`🔍 Scanning collection: [${collId}] (DB: ${DB_ID})`);
    console.log(`Mode: ${isApply ? '🚀 LIVE UPDATE (--apply)' : '👀 DRY RUN (pass --apply to execute)'}`);
    console.log(`======================================================`);

    let allItems = [];
    let cursor = null;
    let keepGoing = true;

    while (keepGoing) {
        const queries = [Query.limit(100), Query.orderDesc('$createdAt')];
        if (cursor) queries.push(Query.cursorAfter(cursor));

        const res = await databases.listDocuments(DB_ID, collId, queries);
        allItems.push(...res.documents);

        if (res.documents.length < 100) keepGoing = false;
        else cursor = res.documents[res.documents.length - 1].$id;
    }

    console.log(`Fetched ${allItems.length} total items from ${collId}.`);

    let updatedCount = 0;
    const itemsToUpdate = [];

    for (const item of allItems) {
        let hasChanges = false;
        let newTitle = item.title;
        let newNotes = item.conditionNotes;

        // 1. Check title for "Master Lot"
        if (typeof item.title === 'string' && /\bmaster\s+lot\b/i.test(item.title)) {
            newTitle = item.title.replace(/\bMaster\s+Lot\b/gi, 'Main Lot');
            hasChanges = true;
        }

        // 2. Check condition notes for "Split from master lot:" or "Merged in Master Lot"
        if (typeof item.conditionNotes === 'string') {
            let updatedNotes = item.conditionNotes;
            if (/\bsplit\s+from\s+master\s+lot:\s*/i.test(updatedNotes)) {
                updatedNotes = updatedNotes.replace(/\bsplit\s+from\s+master\s+lot:\s*/gi, 'Deconstructed from: ');
                hasChanges = true;
            }
            if (/\bmerged\s+in\s+master\s+lot\b/i.test(updatedNotes)) {
                updatedNotes = updatedNotes.replace(/\bmerged\s+in\s+master\s+lot\b/gi, 'Part of Main Lot');
                hasChanges = true;
            }
            newNotes = updatedNotes;
        }

        if (hasChanges) {
            itemsToUpdate.push({
                id: item.$id,
                oldTitle: item.title,
                newTitle: newTitle,
                oldNotes: item.conditionNotes,
                newNotes: newNotes
            });
        }
    }

    console.log(`\nFound ${itemsToUpdate.length} items needing cosmetic cleanup in [${collId}].`);

    for (const entry of itemsToUpdate) {
        console.log(`\n------------------------------------------------------`);
        console.log(`Item ID: ${entry.id}`);
        if (entry.oldTitle !== entry.newTitle) {
            console.log(`  Title Change:`);
            console.log(`    FROM: "${entry.oldTitle}"`);
            console.log(`    TO:   "${entry.newTitle}"`);
        }
        if (entry.oldNotes !== entry.newNotes) {
            console.log(`  Notes Change:`);
            console.log(`    FROM: "${entry.oldNotes?.slice(0, 100)}..."`);
            console.log(`    TO:   "${entry.newNotes?.slice(0, 100)}..."`);
        }

        if (isApply) {
            try {
                const payload = {};
                if (entry.oldTitle !== entry.newTitle) payload.title = entry.newTitle;
                if (entry.oldNotes !== entry.newNotes) payload.conditionNotes = entry.newNotes;

                await databases.updateDocument(DB_ID, collId, entry.id, payload);
                console.log(`  ✅ Updated in database.`);
                updatedCount++;
            } catch (e) {
                console.error(`  ❌ Failed to update ${entry.id}:`, e.message);
            }
        }
    }

    if (isApply) {
        console.log(`\n🎉 Successfully updated ${updatedCount} items in [${collId}].`);
    } else {
        console.log(`\n👀 Dry run complete. No database changes were made.`);
        console.log(`Run with --apply to apply these changes (e.g.: node scripts/cleanup-master-lot-terms.mjs --apply)`);
    }
}

async function main() {
    for (const coll of targetCollections) {
        await cleanupCollection(coll);
    }
}

main().catch(err => console.error('Script error:', err));

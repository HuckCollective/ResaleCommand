import { Client, Databases, Query } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const ENDPOINT = process.env.PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

if (!API_KEY || !ENDPOINT || !PROJECT_ID) {
    console.error("Missing required Appwrite environment variables in .env");
    process.exit(1);
}

const args = process.argv.slice(2);
const isProd = args.includes('--prod');
const isDryRun = args.includes('--dry-run');
const targetCol = isProd ? 'items' : 'items_dev';

console.log("==================================================");
console.log(` STORAGE LOCATION MIGRATION`);
console.log(` Target Collection : ${targetCol} (${isProd ? 'PRODUCTION' : 'DEVELOPMENT'})`);
console.log(` Mode              : ${isDryRun ? 'DRY RUN (No changes saved)' : 'LIVE EXECUTION'}`);
console.log("==================================================\n");

const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

const databases = new Databases(client);

async function run() {
    let offset = 0;
    const limit = 100;
    let totalExamined = 0;
    const candidates = [];

    while (true) {
        const res = await databases.listDocuments(DB_ID, targetCol, [
            Query.limit(limit),
            Query.offset(offset)
        ]);

        if (res.documents.length === 0) break;

        for (const doc of res.documents) {
            totalExamined++;
            const currentLoc = (doc.storageLocation || '').trim();
            let newLoc = null;

            // 1. Memory Den (Booth: Huck's Adventures Outfitters)
            if (['memory den', 'memoryden', 'memory_den'].includes(currentLoc.toLowerCase())) {
                newLoc = 'MD';
            }
            // 2. Dusty Tiger
            else if (['dusty tiger', 'dustytiger', 'dusty_tiger', 'tiger'].includes(currentLoc.toLowerCase())) {
                newLoc = 'DT';
            }
            // 3. Huck's Garage variations
            else if (['hucksgarage', "huck's garage", 'hucks garage'].includes(currentLoc.toLowerCase())) {
                newLoc = 'HG';
            }
            // 4. Generic Backstock
            else if (currentLoc.toLowerCase() === 'backstock') {
                newLoc = 'HG';
            }
            // 5. Corrupted note strings dumped into storageLocation
            else if (
                currentLoc.startsWith('Order #') || 
                currentLoc.startsWith('Location:') || 
                currentLoc.startsWith('[SCOUT_REPORT_ID') || 
                currentLoc.startsWith('[GALLERY IDS') || 
                currentLoc.startsWith('--- COST BREAKDOWN') || 
                currentLoc.startsWith('Est. Low:') || 
                currentLoc.startsWith('Sold:')
            ) {
                newLoc = 'HG';
            }

            // Also check sellingLocations normalization
            const currentSelling = Array.isArray(doc.sellingLocations) ? doc.sellingLocations : [];
            const newSellingSet = new Set();
            let sellingChanged = false;

            for (const ch of currentSelling) {
                const clean = String(ch).trim();
                const lower = clean.toLowerCase();
                if (['memoryden', 'memory den', 'memory_den', 'hao', 'hucks adventures outfitters'].includes(lower)) {
                    newSellingSet.add('Memory Den');
                    if (clean !== 'Memory Den') sellingChanged = true;
                } else if (['dustytiger', 'dusty tiger', 'dusty_tiger', 'tiger'].includes(lower)) {
                    newSellingSet.add('Dusty Tiger');
                    if (clean !== 'Dusty Tiger') sellingChanged = true;
                } else if (['backstock', 'split', 'home'].includes(lower)) {
                    // Non-channel tags to clean out
                    sellingChanged = true;
                } else if (clean) {
                    newSellingSet.add(clean);
                }
            }

            // If item is placed in Memory Den or Dusty Tiger, ensure channel is listed
            const finalLoc = newLoc || currentLoc;
            if (finalLoc === 'MD' && !newSellingSet.has('Memory Den')) {
                newSellingSet.add('Memory Den');
                sellingChanged = true;
            }
            if (finalLoc === 'DT' && !newSellingSet.has('Dusty Tiger')) {
                newSellingSet.add('Dusty Tiger');
                sellingChanged = true;
            }

            const locChanged = newLoc !== null && newLoc !== currentLoc;
            if (locChanged || sellingChanged) {
                const payload = {};
                if (locChanged) payload.storageLocation = newLoc;
                if (sellingChanged) payload.sellingLocations = Array.from(newSellingSet);

                candidates.push({
                    id: doc.$id,
                    title: (doc.title || 'Untitled').substring(0, 35),
                    locFrom: currentLoc || '(null/blank)',
                    locTo: newLoc || currentLoc,
                    locChanged,
                    sellingFrom: currentSelling,
                    sellingTo: Array.from(newSellingSet),
                    sellingChanged,
                    payload
                });
            }
        }

        offset += res.documents.length;
        if (offset >= res.total) break;
    }

    console.log(`Total records examined: ${totalExamined}`);
    console.log(`Records needing migration / normalization: ${candidates.length}\n`);

    if (candidates.length === 0) {
        console.log("No records need migration. Everything is already up to date!");
        return;
    }

    // Display sample
    console.log("Sample of changes:");
    candidates.slice(0, 10).forEach((c, idx) => {
        let desc = `  ${idx + 1}. [${c.id}] "${c.title}"`;
        if (c.locChanged) desc += ` | Storage: "${c.locFrom}" -> "${c.locTo}"`;
        if (c.sellingChanged) desc += ` | Channels: [${c.sellingFrom.join(', ')}] -> [${c.sellingTo.join(', ')}]`;
        console.log(desc);
    });
    if (candidates.length > 10) {
        console.log(`  ... and ${candidates.length - 10} more records.`);
    }

    if (isDryRun) {
        console.log("\n[DRY RUN COMPLETE] No records were modified. Run without --dry-run to commit changes.");
        return;
    }

    // Execute updates in batches
    console.log("\nApplying updates to database...");
    let updated = 0;
    let failed = 0;
    const CHUNK = 20;
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const updateWithRetry = async (col, id, payload, maxRetries = 4) => {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await databases.updateDocument(DB_ID, col, id, payload);
            } catch (e) {
                if (e.code === 429 || e.message?.includes('Rate limit')) {
                    const backoff = 1000 * Math.pow(2, attempt);
                    await wait(backoff);
                    continue;
                }
                throw e;
            }
        }
    };

    for (let i = 0; i < candidates.length; i += CHUNK) {
        const chunk = candidates.slice(i, i + CHUNK);
        await Promise.all(chunk.map(async (c) => {
            try {
                await updateWithRetry(targetCol, c.id, c.payload);
                updated++;
            } catch (e) {
                failed++;
                console.error(`Failed to update ${c.id}:`, e.message);
            }
        }));

        process.stdout.write(`Updated ${updated}/${candidates.length} records...\r`);
        await wait(150);
    }

    console.log(`\n\nMigration finished! Updated: ${updated} | Failed: ${failed}`);
}

run().catch(e => {
    console.error("Migration error:", e);
    process.exit(1);
});

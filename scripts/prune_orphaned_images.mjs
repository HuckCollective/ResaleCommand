import { Client, Databases, Storage, Query } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const db = new Databases(client);
const storage = new Storage(client);

const isDev = (process.env.PUBLIC_APPWRITE_COLLECTION_ID || '').endsWith('_dev');
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
const ITEMS_COL = process.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items';
const IMAGES_BUCKET = isDev ? 'item_images_dev' : (process.env.PUBLIC_APPWRITE_BUCKET_ID || 'item_images');

const DRY_RUN = false; // Set to false to actually delete images

// Mirror of the extraction logic in inventory.ts to ensure 100% accuracy
function getAssociatedFileIds(doc) {
    const ids = new Set();
    if (doc.imageId) ids.add(doc.imageId);
    if (doc.galleryImageIds) {
        doc.galleryImageIds.forEach(id => ids.add(id));
    }
    if (doc.receiptImageId) ids.add(doc.receiptImageId);
    
    if (doc.conditionNotes) {
        const mainMatch = doc.conditionNotes.match(/\[MAIN IMAGE ID: ([^\]]+)\]/i);
        if (mainMatch) ids.add(mainMatch[1].trim());
        
        const galleryMatch = doc.conditionNotes.match(/\[GALLERY IDS: ([^\]]+)\]/i);
        if (galleryMatch) {
            galleryMatch[1].split(',').forEach(id => {
                const trimmed = id.trim();
                if (trimmed) ids.add(trimmed);
            });
        }
        
        const scoutMatch = doc.conditionNotes.match(/\[SCOUT_REPORT_ID: ([^\]]+)\]/i);
        if (scoutMatch) ids.add(scoutMatch[1].trim());
    }
    return ids;
}

async function run() {
    console.log(`Starting Orphaned Image Prune on ${ITEMS_COL} and ${IMAGES_BUCKET}...`);
    if (DRY_RUN) console.log("--- DRY RUN MODE (No files will be deleted) ---");

    console.log('Fetching all active image references from items...');
    const referencedImageIds = new Set();
    
    let offset = 0;
    const limit = 100;
    while (true) {
        process.stdout.write(`Fetching items offset ${offset}...\r`);
        const res = await db.listDocuments(DB_ID, ITEMS_COL, [
            Query.limit(limit),
            Query.offset(offset)
        ]);
        
        for (const doc of res.documents) {
            const ids = getAssociatedFileIds(doc);
            ids.forEach(id => referencedImageIds.add(id));
        }
        
        if (res.documents.length < limit) break;
        offset += limit;
    }
    
    console.log(`\nFound ${referencedImageIds.size} unique referenced images.`);
    
    console.log('Scanning bucket for orphaned images...');
    let totalScanned = 0;
    let cursor = null;
    const orphansToDelete = [];
    
    while (true) {
        const queries = [Query.limit(100)];
        if (cursor) queries.push(Query.cursorAfter(cursor));
        
        const fileList = await storage.listFiles(IMAGES_BUCKET, queries);
        if (fileList.files.length === 0) break;
        
        for (const file of fileList.files) {
            totalScanned++;
            if (!referencedImageIds.has(file.$id)) {
                orphansToDelete.push({ id: file.$id, name: file.name });
            }
        }
        
        cursor = fileList.files[fileList.files.length - 1].$id;
        process.stdout.write(`Scanned ${totalScanned} files...\r`);
    }
    
    console.log(`\nScan complete.`);
    console.log(`Total Files in Bucket: ${totalScanned}`);
    console.log(`Total Orphaned Files: ${orphansToDelete.length}`);
    
    if (orphansToDelete.length > 0) {
        if (!DRY_RUN) {
            console.log(`\nDeleting ${orphansToDelete.length} orphaned files...`);
            let deleted = 0;
            for (const orphan of orphansToDelete) {
                try {
                    await storage.deleteFile(IMAGES_BUCKET, orphan.id);
                    console.log(`[DELETED] Orphaned image: ${orphan.id} (${orphan.name})`);
                    deleted++;
                } catch (e) {
                    console.error(`[ERROR] Failed to delete ${orphan.id}: ${e.message}`);
                }
            }
            console.log(`Successfully deleted ${deleted} orphaned files.`);
        } else {
            console.log(`\nTo actually delete these ${orphansToDelete.length} orphaned images, set DRY_RUN = false in the script.`);
        }
    }
}

run().catch(console.error);

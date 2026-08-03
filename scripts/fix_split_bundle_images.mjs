import { Client, Databases, Storage, Query, ID } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const db = new Databases(client);
const storage = new Storage(client);

// Default to dev environment if configured, otherwise production
const isDev = (process.env.PUBLIC_APPWRITE_COLLECTION_ID || '').endsWith('_dev');
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
const ITEMS_COL = process.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items';
const IMAGES_BUCKET = isDev ? 'item_images_dev' : (process.env.PUBLIC_APPWRITE_BUCKET_ID || 'item_images');

const DRY_RUN = false; // Set to false to actually update items and create images

async function run() {
    console.log(`Starting bundle image fix in ${ITEMS_COL} (Bucket: ${IMAGES_BUCKET})`);
    if (DRY_RUN) console.log("--- DRY RUN MODE (No changes will be made) ---");

    const missingImageItems = [];
    let offset = 0;
    const limit = 100;
    
    // 1. Fetch all items (We have to filter locally for parentLotId since it might not be indexed)
    while (true) {
        process.stdout.write(`Fetching items offset ${offset}...\r`);
        const res = await db.listDocuments(DB_ID, ITEMS_COL, [
            Query.limit(limit),
            Query.offset(offset),
            Query.orderDesc('$createdAt')
        ]);
        
        for (const item of res.documents) {
            // Looking for items that HAVE a parentLotId, but DO NOT have an imageId
            if (item.parentLotId && !item.imageId) {
                // Also check if they lack gallery images just to be sure they are totally imageless
                if (!item.galleryImageIds || item.galleryImageIds.length === 0) {
                    missingImageItems.push(item);
                }
            }
        }

        if (res.documents.length < limit) break;
        offset += limit;
    }

    console.log(`\nFound ${missingImageItems.length} child items missing images.`);
    if (missingImageItems.length === 0) return;

    // Cache parent items to avoid redundant lookups
    const parentCache = new Map();

    for (const item of missingImageItems) {
        console.log(`Processing item: ${item.title} (ID: ${item.$id}, Parent: ${item.parentLotId})`);
        
        let parentItem = parentCache.get(item.parentLotId);
        
        if (!parentItem) {
            try {
                parentItem = await db.getDocument(DB_ID, ITEMS_COL, item.parentLotId);
                parentCache.set(item.parentLotId, parentItem);
            } catch (e) {
                console.log(`  ❌ Parent lot ${item.parentLotId} not found in database. Skipping.`);
                continue;
            }
        }

        let parentImageId = parentItem.imageId;
        if (!parentImageId && parentItem.galleryImageIds && parentItem.galleryImageIds.length > 0) {
            parentImageId = parentItem.galleryImageIds[0];
        }

        if (!parentImageId && parentItem.conditionNotes) {
            const match = parentItem.conditionNotes.match(/\[MAIN IMAGE ID: ([^\]]+)\]/i);
            if (match) parentImageId = match[1].trim();
        }

        if (!parentImageId) {
            console.log(`  ❌ Parent lot ${item.parentLotId} also has no image. Cannot duplicate.`);
            continue;
        }

        console.log(`  ✅ Found parent image: ${parentImageId}.`);
        
        if (!DRY_RUN) {
            try {
                // Download from Appwrite
                const buffer = await storage.getFileDownload(IMAGES_BUCKET, parentImageId);
                
                // Appwrite might return a JSON object with error code if file is missing
                if (buffer && typeof buffer === 'object' && !(buffer instanceof ArrayBuffer) && !Buffer.isBuffer(buffer)) {
                     if (buffer.code) {
                         console.log(`  ❌ Parent image file missing from bucket (Code: ${buffer.code}). Skipping.`);
                         continue;
                     }
                }
                
                // Create a new file in storage
                const inputFile = InputFile.fromBuffer(Buffer.from(buffer), `split-copy-${parentImageId}.jpg`);
                const newUpload = await storage.createFile(IMAGES_BUCKET, ID.unique(), inputFile);
                
                console.log(`  ✅ Duplicated image as ${newUpload.$id}. Updating child item...`);
                
                // Update the child document
                await db.updateDocument(DB_ID, ITEMS_COL, item.$id, {
                    imageId: newUpload.$id,
                    conditionNotes: (item.conditionNotes || '') + `\n\n[MAIN IMAGE ID: ${newUpload.$id}]`
                });
                
                console.log(`  🎉 Successfully fixed ${item.$id}.`);
            } catch (e) {
                console.error(`  ❌ Failed to fix item ${item.$id}:`, e.message);
            }
        }
    }
    
    console.log("Done.");
}

run().catch(console.error);

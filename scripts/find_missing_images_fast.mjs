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

async function checkMissingImagesFast() {
    console.log(`Fetching all files in bucket ${IMAGES_BUCKET}...`);
    const allFiles = new Set();
    let cursor = null;
    while (true) {
        const queries = [Query.limit(100)];
        if (cursor) queries.push(Query.cursorAfter(cursor));
        const fileList = await storage.listFiles(IMAGES_BUCKET, queries);
        if (fileList.files.length === 0) break;
        for (const f of fileList.files) allFiles.add(f.$id);
        cursor = fileList.files[fileList.files.length - 1].$id;
    }
    
    console.log(`Found ${allFiles.size} files in bucket.`);
    console.log(`Checking items in ${ITEMS_COL}...`);
    
    let offset = 0;
    const limit = 100;
    const missingImagesItems = [];
    
    while(true) {
        const res = await db.listDocuments(DB_ID, ITEMS_COL, [
            Query.limit(limit),
            Query.offset(offset)
        ]);
        
        for (const doc of res.documents) {
            const imageIds = [];
            if (doc.imageId) imageIds.push(doc.imageId);
            if (doc.galleryImageIds) imageIds.push(...doc.galleryImageIds);
            
            let missingCount = 0;
            for (const id of imageIds) {
                if (!allFiles.has(id)) {
                    missingCount++;
                }
            }
            
            if (missingCount > 0) {
                missingImagesItems.push({
                    id: doc.$id,
                    title: doc.title,
                    missing: missingCount,
                    total: imageIds.length
                });
            }
        }
        
        if (res.documents.length < limit) break;
        offset += limit;
    }
    
    console.log(`\nFound ${missingImagesItems.length} items with missing image files:`);
    for (const item of missingImagesItems) {
        console.log(`- ${item.title} (ID: ${item.id}) [Missing ${item.missing}/${item.total} images]`);
    }
}
checkMissingImagesFast().catch(console.error);

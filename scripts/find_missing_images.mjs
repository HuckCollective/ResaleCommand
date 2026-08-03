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

async function checkMissingImages() {
    console.log(`Checking items in ${ITEMS_COL} for missing images in bucket ${IMAGES_BUCKET}...`);
    let offset = 0;
    const limit = 100;
    const missingImagesItems = [];
    
    while(true) {
        process.stdout.write(`Fetching items offset ${offset}...\r`);
        const res = await db.listDocuments(DB_ID, ITEMS_COL, [
            Query.limit(limit),
            Query.offset(offset)
        ]);
        
        for (const doc of res.documents) {
            const imageIds = [];
            if (doc.imageId) imageIds.push(doc.imageId);
            if (doc.galleryImageIds) imageIds.push(...doc.galleryImageIds);
            
            if (imageIds.length > 0) {
                let missingCount = 0;
                for (const id of imageIds) {
                    try {
                        await storage.getFile(IMAGES_BUCKET, id);
                    } catch (e) {
                        if (e.code === 404) {
                            missingCount++;
                        }
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
        }
        
        if (res.documents.length < limit) break;
        offset += limit;
    }
    
    console.log(`\n\nFound ${missingImagesItems.length} items with missing image files:`);
    for (const item of missingImagesItems) {
        console.log(`- ${item.title} (ID: ${item.id}) [Missing ${item.missing}/${item.total} images]`);
    }
}
checkMissingImages().catch(console.error);

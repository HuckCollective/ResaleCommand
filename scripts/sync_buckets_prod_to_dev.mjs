import { Client, Databases, Storage, Query } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import dotenv from 'dotenv';
dotenv.config();

const endpoint = process.env.PUBLIC_APPWRITE_ENDPOINT;
const projectId = process.env.PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const dbId = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

if (!endpoint || !projectId || !apiKey) {
    console.error("Missing credentials in .env");
    process.exit(1);
}

const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

const db = new Databases(client);
const storage = new Storage(client);

const DEV_COL = 'items_dev';
const PROD_IMAGES_BUCKET = 'item_images';
const DEV_IMAGES_BUCKET = 'item_images_dev';
const PROD_REPORTS_BUCKET = 'reports';
const DEV_REPORTS_BUCKET = 'reports_dev';

async function copyFile(sourceBucket, targetBucket, fileId, name) {
    if (!fileId) return;
    try {
        // Check if it already exists in dev
        await storage.getFile(targetBucket, fileId);
        return; // Exists, skip
    } catch (e) {
        if (e.code === 404) {
            try {
                // Fetch from prod
                const buffer = await storage.getFileDownload(sourceBucket, fileId);
                
                let finalBuffer = buffer;
                if (buffer && typeof buffer === 'object' && !(buffer instanceof ArrayBuffer) && !Buffer.isBuffer(buffer)) {
                    if (buffer.code) {
                        if (buffer.code === 404) {
                            process.stdout.write('x');
                            return;
                        }
                        console.error(`\nAppwrite returned error for ${fileId}:`, buffer);
                        process.stdout.write('!');
                        return;
                    }
                    // It's an auto-parsed JSON file from the SDK!
                    finalBuffer = Buffer.from(JSON.stringify(buffer));
                } else if (buffer instanceof ArrayBuffer) {
                    finalBuffer = Buffer.from(buffer);
                }

                const inputFile = InputFile.fromBuffer(finalBuffer, name);
                
                // Upload to dev with SAME ID
                await storage.createFile(targetBucket, fileId, inputFile);
                process.stdout.write('+');
            } catch (err) {
                process.stdout.write('!');
                if (err.code !== 404) {
                    console.error(`\nFailed to copy file ${fileId}:`, err.message);
                }
            }
        } else {
             console.error(`\nError checking file ${fileId}:`, e.message);
        }
    }
}

async function run() {
    console.log("Starting bucket sync for DEV items...");
    
    let offset = 0;
    let limit = 100;
    let hasMore = true;
    
    while (hasMore) {
        console.log(`Fetching DEV items offset ${offset}...`);
        const res = await db.listDocuments(dbId, DEV_COL, [
            Query.limit(limit),
            Query.offset(offset)
        ]);
        
        if (res.documents.length === 0) {
            hasMore = false;
            break;
        }
        
        for (const doc of res.documents) {
            // Images
            if (doc.imageId) {
                await copyFile(PROD_IMAGES_BUCKET, DEV_IMAGES_BUCKET, doc.imageId, `${doc.imageId}.jpg`);
            }
            if (doc.galleryImageIds) {
                for (const gId of doc.galleryImageIds) {
                    await copyFile(PROD_IMAGES_BUCKET, DEV_IMAGES_BUCKET, gId, `${gId}.jpg`);
                }
            }
            
            // Reports
            if (doc.conditionNotes) {
                const jsonMatch = doc.conditionNotes.match(/\[SCOUT_REPORT_ID:\s*([^\]]+)\]/);
                if (jsonMatch) await copyFile(PROD_REPORTS_BUCKET, DEV_REPORTS_BUCKET, jsonMatch[1].trim(), 'scout.json');
                
                const mdMatch = doc.conditionNotes.match(/\[SCOUT_REPORT_MD:\s*([^\]]+)\]/);
                if (mdMatch) await copyFile(PROD_REPORTS_BUCKET, DEV_REPORTS_BUCKET, mdMatch[1].trim(), 'scout.md');
            }
        }
        offset += limit;
    }
    
    console.log("\nDone syncing files.");
}

run();

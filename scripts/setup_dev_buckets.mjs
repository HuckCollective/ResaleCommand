import { Client, Storage, Permission, Role } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const endpoint = process.env.PUBLIC_APPWRITE_ENDPOINT;
const projectId = process.env.PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;

if (!endpoint || !projectId || !apiKey) {
    console.error("Missing credentials in .env");
    process.exit(1);
}

const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

const storage = new Storage(client);

async function ensureBucket(bucketId, name, exts) {
    console.log(`🔧 Checking Bucket: ${bucketId}...`);
    try {
        await storage.updateBucket(
            bucketId, 
            name, 
            [
                Permission.read(Role.any()),
                Permission.create(Role.any()),
                Permission.update(Role.any()),
                Permission.delete(Role.any())
            ],
            false, // File Security
            true,  // Enabled
            undefined, // Max Size
            exts
        );
        console.log(`✅ Bucket ${bucketId} exists and permissions updated.`);
    } catch (e) {
        if (e.code === 404) {
             console.log(`Bucket ${bucketId} not found, creating new...`);
             await storage.createBucket(
                bucketId, 
                name, 
                [
                    Permission.read(Role.any()),
                    Permission.create(Role.any()),
                    Permission.update(Role.any()),
                    Permission.delete(Role.any())
                ], 
                false, 
                true, 
                undefined, 
                exts
             );
             console.log(`✅ Created bucket ${bucketId}.`);
        } else {
             console.error(`❌ Failed to process bucket ${bucketId}:`, e.message);
        }
    }
}

async function run() {
    await ensureBucket('item_images_dev', 'Item Images (DEV)', ['jpg', 'jpeg', 'png', 'webp', 'gif', 'json', 'txt']);
    await ensureBucket('reports_dev', 'Scout Reports (DEV)', ['json', 'md', 'txt']);
    console.log("Done.");
}

run();

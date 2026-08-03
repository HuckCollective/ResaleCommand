import { Client, Storage, ID } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const storage = new Storage(client);
const IMAGES_BUCKET = 'item_images_dev';

async function seedOrphans() {
    console.log("Creating 5 fake orphaned images in dev bucket...");
    for (let i = 0; i < 5; i++) {
        const dummyText = `This is fake orphan image ${i}`;
        const file = InputFile.fromBuffer(Buffer.from(dummyText), `fake-orphan-${i}.jpg`);
        const upload = await storage.createFile(IMAGES_BUCKET, ID.unique(), file);
        console.log(`Uploaded fake orphan: ${upload.$id}`);
    }
    console.log("Done! You can now run the purge script to see it find and delete these 5 orphans.");
}

seedOrphans().catch(console.error);

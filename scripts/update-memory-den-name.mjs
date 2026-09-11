import { Client, Databases } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

async function update() {
    console.log(`Updating warehouse 6a7e70050009db0e1857 to "Memory Den - Huck's Adventures Outfitters" [MD]`);
    await databases.updateDocument(DB_ID, 'warehouses', '6a7e70050009db0e1857', {
        name: "Memory Den - Huck's Adventures Outfitters",
        code: "MD",
        type: "Consignment Booth"
    });
    console.log("Done updating warehouse names!");
}

update().catch(console.error);

import { Client, Databases } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

async function run() {
    const updates = [
        { id: '6aa6df24002ea4c5e34b', upc: 'HUCK-1464' },
        { id: '6aa6e07b0006aaebd817', upc: 'HUCK-1465' },
        { id: '6aa6e00e0036f24d2be8', upc: 'HUCK-1466' }
    ];

    for (const u of updates) {
        try {
            await databases.updateDocument('resale_db', 'items', u.id, { upc: u.upc });
            console.log(`✅ Updated ${u.id} with UPC: ${u.upc}`);
        } catch (e) {
            console.error(`❌ Failed to update ${u.id}:`, e.message);
        }
    }
}

run();

import { Client, Databases } from 'appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client();
client
  .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID);

const databases = new Databases(client);
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
const ITEMS_COL = process.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items_dev';

async function run() {
  try {
    const res = await databases.listDocuments(DB_ID, ITEMS_COL, []);
    const tenantIds = new Set();
    res.documents.forEach(doc => {
      tenantIds.add(doc.tenantId);
    });
    console.log("Unique tenantIds in first batch of items_dev:", Array.from(tenantIds));
  } catch (err) {
    console.error("❌ Failed to query items:", err.message);
  }
}

run();

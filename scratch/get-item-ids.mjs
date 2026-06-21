import { Client, Databases, Query } from 'appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client();
client
  .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID);

const databases = new Databases(client);
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
const ITEMS_COL = process.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items_dev';
const SEED_TENANT = '6979614d00281d143bbe';

async function run() {
  try {
    const res = await databases.listDocuments(DB_ID, ITEMS_COL, [
      Query.equal('tenantId', SEED_TENANT),
      Query.limit(3)
    ]);
    console.log("Found item IDs:");
    res.documents.forEach(doc => {
      console.log(`- ID: ${doc.$id} | Title: ${doc.title}`);
    });
  } catch (err) {
    console.error("❌ Failed to query items:", err.message);
  }
}

run();

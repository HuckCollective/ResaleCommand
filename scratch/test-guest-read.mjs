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
  console.log("Using endpoint:", process.env.PUBLIC_APPWRITE_ENDPOINT);
  console.log("Using project:", process.env.PUBLIC_APPWRITE_PROJECT_ID);
  console.log("Testing guest read on items collection:", ITEMS_COL);
  try {
    const itemsRes = await databases.listDocuments(DB_ID, ITEMS_COL);
    console.log(`✅ Success! Found ${itemsRes.total} items in ${ITEMS_COL}.`);
  } catch (err) {
    console.error("❌ Failed to query items collection:", err.message, err);
  }

  console.log("\nTesting guest read on tenant_domains collection...");
  try {
    const tenantRes = await databases.listDocuments(DB_ID, "tenant_domains");
    console.log(`✅ Success! Found ${tenantRes.total} tenant domains.`);
  } catch (err) {
    console.error("❌ Failed to query tenant_domains collection:", err.message, err);
  }
}

run();

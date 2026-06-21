import { Client, Databases } from 'node-appwrite';
import 'dotenv/config';

const ENDPOINT = process.env.PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
const ITEMS_COL = process.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items_dev';

async function check() {
  if (!API_KEY) {
    console.error("Missing APPWRITE_API_KEY");
    process.exit(1);
  }

  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

  const db = new Databases(client);

  try {
    console.log("Querying database items...");
    const res = await db.listDocuments(DB_ID, ITEMS_COL, []);
    console.log(`Total items found: ${res.total}`);
    
    const tenants = new Set();
    res.documents.forEach(doc => {
      tenants.add(doc.tenantId);
    });

    console.log("\nTenant IDs present in your database items:");
    tenants.forEach(t => {
      console.log(`- ${t}`);
    });
    
    if (res.total > 0) {
      console.log("\nSample item titles & their tenant IDs:");
      res.documents.slice(0, 5).forEach(doc => {
        console.log(`* "${doc.title}" (Tenant ID: ${doc.tenantId})`);
      });
    }

  } catch (err) {
    console.error("Error:", err.message);
  }
}

check();

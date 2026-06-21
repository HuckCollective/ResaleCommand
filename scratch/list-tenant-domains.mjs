import { Client, Databases } from 'appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client();
client
  .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID);

const databases = new Databases(client);
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
const DOMAINS_COL = 'tenant_domains';

async function run() {
  try {
    const res = await databases.listDocuments(DB_ID, DOMAINS_COL, []);
    console.log(`Registered Tenant Domains (${res.total} total):`);
    res.documents.forEach(doc => {
      console.log(`- Domain: "${doc.domain}" | Tenant ID: "${doc.tenantId}" | Active: ${doc.isActive}`);
    });
  } catch (err) {
    if (err.type === "collection_not_found" || err.code === 404) {
      console.log("ℹ️ 'tenant_domains' collection does not exist yet.");
    } else {
      console.error("❌ Failed to query tenant domains:", err.message);
    }
  }
}

run();

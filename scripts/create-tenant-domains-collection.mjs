import { Client, Databases, Permission, Role } from "node-appwrite";
import 'dotenv/config';

const ENDPOINT = process.env.PUBLIC_APPWRITE_ENDPOINT || process.env.VITE_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.PUBLIC_APPWRITE_PROJECT_ID || process.env.VITE_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || process.env.VITE_PUBLIC_APPWRITE_DB_ID || "resale_db";
const TENANT_DOMAINS_COL = "tenant_domains";

async function ensureStringAttr(db, dbId, colId, key, size, required = false, defaultVal = undefined, array = false) {
  try {
    await db.createStringAttribute(dbId, colId, key, size, required, defaultVal, array);
    console.log(`[${colId}] Created string attribute: ${key}`);
  } catch (e) {
    if (e.code === 409) {
      console.log(`[${colId}] Attribute ${key} already exists.`);
    } else {
      console.error(`[${colId}] Failed to create string ${key}:`, e.message);
    }
  }
}

async function ensureBooleanAttr(db, dbId, colId, key, required = false, defaultVal = undefined, array = false) {
  try {
    await db.createBooleanAttribute(dbId, colId, key, required, defaultVal, array);
    console.log(`[${colId}] Created boolean attribute: ${key}`);
  } catch (e) {
    if (e.code === 409) {
      console.log(`[${colId}] Attribute ${key} already exists.`);
    } else {
      console.error(`[${colId}] Failed to create boolean ${key}:`, e.message);
    }
  }
}

async function run() {
  if (!API_KEY) {
    console.error("❌ APPWRITE_API_KEY not found in environment.");
    process.exit(1);
  }

  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

  const db = new Databases(client);

  try {
    console.log(`Creating Collection: ${TENANT_DOMAINS_COL}...`);
    await db.createCollection(DB_ID, TENANT_DOMAINS_COL, "Tenant Domains", [
      Permission.read(Role.any()), // Public lookup allowed
      Permission.create(Role.users()),
      Permission.update(Role.users()),
      Permission.delete(Role.users()),
    ], true);
    console.log(`Created Collection: ${TENANT_DOMAINS_COL}.`);
  } catch (e) {
    if (e.code === 409) {
      console.log("ℹ️ Collection already exists.");
    } else if (e.code === 401 || e.message.includes("authorized")) {
      console.warn("\n⚠️  [Appwrite Permission Warning] The provided API key does not have database/collection creation scopes.");
      console.warn("👉 Please create the collection manually in your Appwrite Console:");
      console.warn(`   - Database ID: ${DB_ID}`);
      console.warn(`   - Collection ID: ${TENANT_DOMAINS_COL}`);
      console.warn(`   - Name: Tenant Domains`);
      console.warn("   - Document Permissions: Add Role 'Any' with Read permission.");
      console.warn("\n👉 And create the following attributes in that collection:");
      console.warn("   - domain: String, size 255 (Required)");
      console.warn("   - tenantId: String, size 255 (Required)");
      console.warn("   - isActive: Boolean (Required, Default: true)");
      console.warn("   - storeName: String, size 255 (Optional)\n");
      process.exit(0); // Exit successfully since manual setup instruction is logged
    } else {
      console.error("❌ Error setting up collection:", e.message);
      process.exit(1);
    }
  }

  // Create Attributes
  await ensureStringAttr(db, DB_ID, TENANT_DOMAINS_COL, "domain", 255, true);
  await ensureStringAttr(db, DB_ID, TENANT_DOMAINS_COL, "tenantId", 255, true);
  await ensureBooleanAttr(db, DB_ID, TENANT_DOMAINS_COL, "isActive", false, true);
  await ensureStringAttr(db, DB_ID, TENANT_DOMAINS_COL, "storeName", 255, false);

  console.log("✅ Tenant Domains Collection setup complete!");
  process.exit(0);
}

run();

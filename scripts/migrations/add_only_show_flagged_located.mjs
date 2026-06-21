import { Client, Databases } from "node-appwrite";
import dotenv from 'dotenv';
dotenv.config();

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const db = new Databases(client);
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || "resale_db";
const ORG_SETTINGS_COL = "org_settings";

async function runMigration() {
    console.log("Starting Schema Migration for onlyShowFlaggedLocated...");
    try {
        console.log(`Adding 'onlyShowFlaggedLocated' attribute to ${ORG_SETTINGS_COL}...`);
        await db.createBooleanAttribute(DB_ID, ORG_SETTINGS_COL, "onlyShowFlaggedLocated", false, false);
        console.log("✅ Added onlyShowFlaggedLocated attribute.");
    } catch (e) {
        if (e.message.includes("already exists") || e.code === 409) {
            console.log("⚠️ onlyShowFlaggedLocated attribute already exists.");
        } else {
            console.error("❌ Failed to add onlyShowFlaggedLocated attribute:", e.message);
        }
    }
}
runMigration();

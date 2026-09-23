
import { Client, Databases } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client();

const ENDPOINT = process.env.PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID;
const COLLECTION_ID = process.env.PUBLIC_APPWRITE_COLLECTION_ID;

if (!API_KEY) {
    console.error("Missing APPWRITE_API_KEY in .env");
    process.exit(1);
}

client
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

const databases = new Databases(client);

import { Query } from 'node-appwrite';
async function listAttributes() {
    try {
        const response = await databases.listAttributes(DB_ID, COLLECTION_ID, [Query.limit(100)]);
        console.log("Existing Attributes:");
        response.attributes.forEach(attr => {
            console.log(`- ${attr.key} [${attr.type}] (Size: ${attr.size}, Array: ${attr.array}, Status: ${attr.status})`);
        });
        console.log(`Total Attributes: ${response.total}`);
    } catch (error) {
        console.error("Error listing attributes:", error);
    }
}

listAttributes();

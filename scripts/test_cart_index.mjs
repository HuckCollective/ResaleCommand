import { Client, Databases, Query } from 'node-appwrite';

import dotenv from 'dotenv';
dotenv.config();

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1')
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID || '69714b35003a8adab6bb')
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

async function testIndex() {
    try {
        console.log("Testing cartId index query...");
        const response = await databases.listDocuments(
            'resale_db',
            'alpha_items',
            [Query.equal('cartId', 'stub-id-123')]
        );
        console.log("Query Successful! Found:", response.documents.length);
    } catch (e) {
        console.error("Query Failed:", e.message);
    }
}

testIndex();

import {
    Client,
    Databases,
    Query
} from "node-appwrite";
import 'dotenv/config';

function log(msg) {
    console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

const ENDPOINT = process.env.PUBLIC_APPWRITE_ENDPOINT || process.env.VITE_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.PUBLIC_APPWRITE_PROJECT_ID || process.env.VITE_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || process.env.VITE_PUBLIC_APPWRITE_DB_ID || "resale_db";

const PROD_COL = "items";
const DEV_COL = "items_dev";

async function run() {
    if (!API_KEY) {
        log("ERROR: APPWRITE_API_KEY not found in environment variables.");
        process.exit(1);
    }

    try {
        const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
        const db = new Databases(client);

        log(`Target Database: ${DB_ID}`);
        log(`Syncing from ${PROD_COL} to ${DEV_COL}...`);

        let offset = 0;
        let limit = 100;
        let hasMore = true;
        let totalProcessed = 0;
        let totalCreated = 0;
        let totalUpdated = 0;
        let totalFailed = 0;

        while (hasMore) {
            log(`Fetching ${limit} items from offset ${offset}...`);
            const res = await db.listDocuments(DB_ID, PROD_COL, [
                Query.limit(limit),
                Query.offset(offset)
            ]);

            if (res.documents.length === 0) {
                hasMore = false;
                break;
            }

            for (const doc of res.documents) {
                const docId = doc.$id;
                
                // Strip system attributes from the payload
                const payload = { ...doc };
                delete payload.$id;
                delete payload.$createdAt;
                delete payload.$updatedAt;
                delete payload.$permissions;
                delete payload.$databaseId;
                delete payload.$collectionId;

                try {
                    // Try to create the document in dev
                    await db.createDocument(DB_ID, DEV_COL, docId, payload, doc.$permissions);
                    totalCreated++;
                    process.stdout.write('+');
                } catch (e) {
                    if (e.code === 409) {
                        // Already exists, update it instead
                        try {
                            await db.updateDocument(DB_ID, DEV_COL, docId, payload, doc.$permissions);
                            totalUpdated++;
                            process.stdout.write('~');
                        } catch (updateErr) {
                            totalFailed++;
                            process.stdout.write('!');
                            console.error(`\nFailed to update ${docId}:`, updateErr.message);
                        }
                    } else {
                        totalFailed++;
                        process.stdout.write('!');
                        console.error(`\nFailed to create ${docId}:`, e.message);
                    }
                }
                totalProcessed++;
            }

            offset += limit;
        }

        log(`\n\n--- SYNC COMPLETE ---`);
        log(`Total Processed: ${totalProcessed}`);
        log(`Total Created:   ${totalCreated}`);
        log(`Total Updated:   ${totalUpdated}`);
        log(`Total Failed:    ${totalFailed}`);
        
        process.exit(0);
    } catch (e) {
        log(`FATAL ERROR: ${e.message}`);
        console.error(e);
        process.exit(1);
    }
}

run();

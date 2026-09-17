import dotenv from 'dotenv';
import { Client, Databases, Query } from 'node-appwrite';
dotenv.config();

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

async function fix() {
    const skirtId = '6aab36c3002836101065';
    const newUpc = 'HUCK-1467';

    // Verify HUCK-1467 does not exist
    const existing = await databases.listDocuments('resale_db', 'items', [
        Query.equal('upc', newUpc)
    ]);
    if (existing.documents.length > 0) {
        console.error(`ERROR: ${newUpc} already exists on item ${existing.documents[0].$id}!`);
        process.exit(1);
    }

    // Update the skirt to HUCK-1467
    const updated = await databases.updateDocument('resale_db', 'items', skirtId, {
        upc: newUpc
    });

    console.log(`✅ Successfully updated Tripp NYC Skirt (${skirtId}) to UPC: ${updated.upc}`);

    // Verify HUCK-1464 now only belongs to 1 item (Treasure & Bond hat)
    const check1464 = await databases.listDocuments('resale_db', 'items', [
        Query.equal('upc', 'HUCK-1464')
    ]);
    console.log(`✅ Items with HUCK-1464: ${check1464.documents.length} item(s)`);
    check1464.documents.forEach(d => console.log(`   - [${d.$id}] ${d.title}`));

    // Verify HUCK-1467
    const check1467 = await databases.listDocuments('resale_db', 'items', [
        Query.equal('upc', 'HUCK-1467')
    ]);
    console.log(`✅ Items with HUCK-1467: ${check1467.documents.length} item(s)`);
    check1467.documents.forEach(d => console.log(`   - [${d.$id}] ${d.title}`));
}

fix().catch(err => {
    console.error('Failed to fix UPC:', err);
    process.exit(1);
});

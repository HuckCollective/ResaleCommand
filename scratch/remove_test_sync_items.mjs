import { Client, Databases, Query } from 'node-appwrite';

const client = new Client()
    .setEndpoint('https://sfo.cloud.appwrite.io/v1')
    .setProject('69714b35003a8adab6bb')
    .setKey('standard_7f468ae83deeee6b932fd40312e1be602c94a4d75922ad72d895e677dff7a06b7715984f93fb5c3bebc1a5a174996039c7db6f03f81c21085e5bf01a3aa23c62caa66f8df87b2662ddaef338661cab157e1b4d74d07e4bb1ddf36868cd69ce66c3014450d88ec69029a7716cbcea45ee66c8533a2776a5b522cfc213820e0034');

const databases = new Databases(client);

async function removeTestSyncItems() {
    let offset = 0;
    let itemsToDelete = [];

    while (true) {
        const res = await databases.listDocuments('resale_db', 'items_dev', [
            Query.limit(100),
            Query.offset(offset)
        ]);
        if (res.documents.length === 0) break;

        for (const doc of res.documents) {
            const notes = doc.conditionNotes || '';
            const isTestSyncCreated = notes.includes('Partner: PDXGL') || 
                                     (notes.includes('Added from') && (notes.includes('Sync') || notes.includes('MemoryDen') || notes.includes('Booth')));
            
            if (isTestSyncCreated) {
                itemsToDelete.push(doc);
            }
        }
        offset += res.documents.length;
        if (offset >= res.total) break;
    }

    console.log(`Found ${itemsToDelete.length} test sync items to permanently remove.`);

    let deleted = 0;
    for (const doc of itemsToDelete) {
        try {
            await databases.deleteDocument('resale_db', 'items_dev', doc.$id);
            deleted++;
            if (deleted % 25 === 0 || deleted === itemsToDelete.length) {
                console.log(`Deleted ${deleted} / ${itemsToDelete.length}...`);
            }
        } catch (e) {
            console.error(`Failed to delete ${doc.$id}:`, e.message);
        }
    }

    console.log(`Successfully removed ${deleted} test items from database.`);
}

removeTestSyncItems().catch(console.error);

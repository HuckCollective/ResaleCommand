import { Client, Databases, Query } from 'node-appwrite';

const client = new Client()
    .setEndpoint('https://sfo.cloud.appwrite.io/v1')
    .setProject('69714b35003a8adab6bb')
    .setKey('standard_7f468ae83deeee6b932fd40312e1be602c94a4d75922ad72d895e677dff7a06b7715984f93fb5c3bebc1a5a174996039c7db6f03f81c21085e5bf01a3aa23c62caa66f8df87b2662ddaef338661cab157e1b4d74d07e4bb1ddf36868cd69ce66c3014450d88ec69029a7716cbcea45ee66c8533a2776a5b522cfc213820e0034');

const databases = new Databases(client);

async function removeTestSales() {
    let offset = 0;
    let salesToDelete = [];

    while (true) {
        const res = await databases.listDocuments('resale_db', 'sales', [
            Query.limit(100),
            Query.offset(offset)
        ]).catch(() => ({ documents: [], total: 0 }));
        
        if (res.documents.length === 0) break;

        for (const doc of res.documents) {
            const orderId = doc.orderId || '';
            if (orderId.startsWith('PDXGL') || orderId.startsWith('SYNC-')) {
                salesToDelete.push(doc);
            }
        }
        offset += res.documents.length;
        if (offset >= res.total) break;
    }

    console.log(`Found ${salesToDelete.length} test sync sales to remove.`);

    for (const doc of salesToDelete) {
        try {
            await databases.deleteDocument('resale_db', 'sales', doc.$id);
        } catch (e) {
            console.error(`Failed to delete sale ${doc.$id}:`, e.message);
        }
    }

    console.log(`Successfully cleaned up test sales!`);
}

removeTestSales().catch(console.error);

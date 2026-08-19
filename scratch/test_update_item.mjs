import { Client, Databases, Query } from 'node-appwrite';

const client = new Client()
    .setEndpoint('https://sfo.cloud.appwrite.io/v1')
    .setProject('69714b35003a8adab6bb')
    .setKey('standard_7f468ae83deeee6b932fd40312e1be602c94a4d75922ad72d895e677dff7a06b7715984f93fb5c3bebc1a5a174996039c7db6f03f81c21085e5bf01a3aa23c62caa66f8df87b2662ddaef338661cab157e1b4d74d07e4bb1ddf36868cd69ce66c3014450d88ec69029a7716cbcea45ee66c8533a2776a5b522cfc213820e0034');

const databases = new Databases(client);

async function testUpdate() {
    const list = await databases.listDocuments('resale_db', 'items_dev', [Query.limit(1)]);
    if (list.documents.length === 0) return console.log('No docs found');
    const doc = list.documents[0];
    console.log('Testing update on item:', doc.$id, doc.title);
    try {
        const res = await databases.updateDocument('resale_db', 'items_dev', doc.$id, {
            locationSku: '0EJ01A',
            sellingLocations: ['Memory Den'],
            resalePrice: 45.00,
            soldPrice: 38.25,
            status: 'placed'
        });
        console.log('Update SUCCESS:', res.$id);
    } catch (err) {
        console.error('Update FAILED:', err);
    }
}
testUpdate().catch(console.error);

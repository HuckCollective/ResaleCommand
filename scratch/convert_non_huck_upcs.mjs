import { Client, Databases, Query } from 'node-appwrite';

const client = new Client()
    .setEndpoint('https://sfo.cloud.appwrite.io/v1')
    .setProject('69714b35003a8adab6bb')
    .setKey('standard_7f468ae83deeee6b932fd40312e1be602c94a4d75922ad72d895e677dff7a06b7715984f93fb5c3bebc1a5a174996039c7db6f03f81c21085e5bf01a3aa23c62caa66f8df87b2662ddaef338661cab157e1b4d74d07e4bb1ddf36868cd69ce66c3014450d88ec69029a7716cbcea45ee66c8533a2776a5b522cfc213820e0034');

const databases = new Databases(client);

async function inspectAndClean() {
    let offset = 0;
    let allNonHuck = [];
    let maxHuckIndex = 0;

    while (true) {
        const res = await databases.listDocuments('resale_db', 'items_dev', [
            Query.limit(100),
            Query.offset(offset)
        ]);
        if (res.documents.length === 0) break;

        for (const doc of res.documents) {
            if (doc.upc) {
                if (doc.upc.startsWith('HUCK-')) {
                    const num = parseInt(doc.upc.replace('HUCK-', ''), 10);
                    if (!isNaN(num) && num > maxHuckIndex) {
                        maxHuckIndex = num;
                    }
                } else {
                    allNonHuck.push(doc);
                }
            }
        }
        offset += res.documents.length;
        if (offset >= res.total) break;
    }

    console.log(`Found ${allNonHuck.length} items with non-HUCK UPCs. Current max HUCK index: ${maxHuckIndex}`);
    
    for (const doc of allNonHuck) {
        maxHuckIndex++;
        const newUpc = `HUCK-${maxHuckIndex.toString().padStart(4, '0')}`;
        console.log(`Reassigning: "${doc.title.substring(0, 30)}" (${doc.upc}) -> ${newUpc}`);
        await databases.updateDocument('resale_db', 'items_dev', doc.$id, {
            upc: newUpc
        });
    }

    console.log('Finished updating non-HUCK UPCs to HUCK-!');
}

inspectAndClean().catch(console.error);

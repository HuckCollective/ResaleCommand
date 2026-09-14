import { Client, Databases, Query } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client()
  .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1')
  .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID || '69714b35003a8adab6bb');

if (process.env.APPWRITE_API_KEY) client.setKey(process.env.APPWRITE_API_KEY);

const db = new Databases(client);

async function run() {
  const res = await db.listDocuments('resale_db', 'items', [
    Query.equal('upc', 'HUCK-1331'),
    Query.limit(1)
  ]);
  if (res.documents.length > 0) {
    const it = res.documents[0];
    console.log('ITEM FOUND:', {
      id: it.$id,
      title: it.title,
      upc: it.upc,
      cost: it.cost,
      sourcingLocation: it.sourcingLocation,
      images: it.images,
      galleryImageIds: it.galleryImageIds
    });
  } else {
    console.log('Not found by upc, searching orderId 64974963');
    const res2 = await db.listDocuments('resale_db', 'items', [
      Query.equal('orderId', '64974963'),
      Query.limit(1)
    ]);
    console.log('Found by orderId:', res2.documents.map(d => ({ id: d.$id, upc: d.upc, title: d.title })));
  }
}

run().catch(console.error);

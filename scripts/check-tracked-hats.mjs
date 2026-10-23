import { Client, Databases, Query } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const db = new Databases(client);
const dbId = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

async function checkHatDoc() {
  const res = await db.listDocuments(dbId, 'items', [
    Query.equal('status', 'tracked'),
    Query.limit(5)
  ]);
  res.documents.forEach(d => {
    console.log('ID:', d.$id);
    console.log('Title:', d.title);
    console.log('createdAt:', d.$createdAt, 'updatedAt:', d.$updatedAt);
    console.log('conditionNotes:', d.conditionNotes);
    console.log('sourceUrl:', d.sourceUrl);
    console.log('-----------------------------------');
  });
}
checkHatDoc();

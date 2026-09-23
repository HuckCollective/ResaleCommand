import { Client, Databases, Query } from 'node-appwrite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
const COLL_ID = process.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items_dev';

async function check() {
    console.log(`Checking database: ${DB_ID}, collection: ${COLL_ID}`);
    const res = await databases.listDocuments(DB_ID, COLL_ID, [
        Query.limit(100),
        Query.orderDesc('$createdAt')
    ]);
    console.log(`First 5 items returned by simple query:`);
    res.documents.slice(0, 5).forEach(d => console.log(`- [${d.$id}] ${d.title} (Category: ${d.category || 'none'}, Status: ${d.status})`));

    console.log(`\nNow searching for book/fantasy/novel items across all items:`);
    let all = [];
    let cursor = null;
    let keepGoing = true;
    while (keepGoing && all.length < 500) {
        const q = [Query.limit(100), Query.orderDesc('$createdAt')];
        if (cursor) q.push(Query.cursorAfter(cursor));
        const batch = await databases.listDocuments(DB_ID, COLL_ID, q);
        all.push(...batch.documents);
        if (batch.documents.length < 100) keepGoing = false;
        else cursor = batch.documents[batch.documents.length - 1].$id;
    }

    const books = all.filter(d => /\b(book|paperback|novel|fantasy|tolkien|dragonlance|sci-fi|fiction)\b/i.test(`${d.title} ${d.conditionNotes || ''} ${d.category || ''}`));
    console.log(`Found ${books.length} matching book/fantasy items:`);
    books.slice(0, 15).forEach(b => console.log(`  * [${b.$id}] ${b.title} (Status: ${b.status}, Qty: ${b.quantity})`));
}

check().catch(console.error);

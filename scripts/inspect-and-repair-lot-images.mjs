import { Client, Databases, Storage, Query, ID, Permission, Role } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const ENDPOINT = process.env.PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1';
const PROJECT_ID = process.env.PUBLIC_APPWRITE_PROJECT_ID || '69714b35003a8adab6bb';
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

const isProd = process.argv.includes('--prod');
const isApply = process.argv.includes('--apply');
const targetUpcArg = process.argv.find(a => a.startsWith('--upc='));
const targetUpc = targetUpcArg ? targetUpcArg.replace('--upc=', '').trim() : 'HUCK-1455';

const COLLECTION_ID = isProd ? 'items' : (process.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items');
const BUCKET_ID = isProd ? 'item_images' : (process.env.PUBLIC_APPWRITE_BUCKET_ID || 'item_images');

if (!API_KEY) {
    console.error('❌ Missing APPWRITE_API_KEY in .env');
    process.exit(1);
}

const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

const databases = new Databases(client);
const storage = new Storage(client);

async function run() {
    console.log(`\n🔍 Searching for ${targetUpc} in [${DB_ID} / ${COLLECTION_ID}]...`);
    const res = await databases.listDocuments(DB_ID, COLLECTION_ID, [
        Query.equal('upc', targetUpc),
        Query.limit(1)
    ]);

    if (res.documents.length === 0) {
        console.error(`❌ Item ${targetUpc} not found in ${COLLECTION_ID}!`);
        return;
    }

    const item = res.documents[0];
    console.log(`✅ Found Item: ${item.title} (ID: ${item.$id}, UPC: ${item.upc})`);
    console.log(`   Status: ${item.status}, Sourcing: ${item.sourcingLocation}`);
    console.log(`   Primary imageId: ${item.imageId || 'NONE'}`);
    
    let currentGallery = Array.isArray(item.galleryImageIds) ? item.galleryImageIds : [];
    console.log(`   Gallery photo count: ${currentGallery.length}`);

    // 1. Audit which images currently exist in Appwrite storage
    console.log(`\n📦 Checking Appwrite Storage [${BUCKET_ID}] for all referenced file IDs...`);
    const validIds = [];
    const deadIds = [];

    const allCandidateIds = Array.from(new Set([
        ...(item.imageId ? [item.imageId] : []),
        ...currentGallery
    ]));

    for (const fileId of allCandidateIds) {
        if (!fileId || typeof fileId !== 'string') continue;
        try {
            const meta = await storage.getFile(BUCKET_ID, fileId);
            validIds.push({ id: fileId, size: meta.sizeOriginal, name: meta.name });
            console.log(`   🟢 VALID: ${fileId} (${meta.sizeOriginal} bytes, ${meta.name})`);
        } catch (err) {
            deadIds.push(fileId);
            console.log(`   🔴 DEAD/404: ${fileId} (${err.message})`);
        }
    }

    console.log(`\n📊 Summary: ${validIds.length} valid images found, ${deadIds.length} dead/ghost images.`);

    // 2. Also check if there are original merged child items for this combined lot
    console.log(`\n🔗 Checking for original merged items linked via parentLotId = ${item.$id}...`);
    const childDocs = await databases.listDocuments(DB_ID, COLLECTION_ID, [
        Query.equal('parentLotId', item.$id),
        Query.limit(100)
    ]);
    console.log(`   Found ${childDocs.documents.length} child items merged into this lot.`);

    // Check if any child item has valid images not yet in our list
    for (const child of childDocs.documents) {
        const childIds = [
            ...(child.imageId ? [child.imageId] : []),
            ...(Array.isArray(child.galleryImageIds) ? child.galleryImageIds : [])
        ];
        for (const cId of childIds) {
            if (!allCandidateIds.includes(cId)) {
                try {
                    const meta = await storage.getFile(BUCKET_ID, cId);
                    validIds.push({ id: cId, size: meta.sizeOriginal, name: meta.name, source: `child: ${child.title}` });
                    console.log(`   🟢 Found valid photo on child item: ${cId} (${child.title})`);
                } catch {}
            }
        }
    }

    if (!isApply) {
        console.log(`\n⚠️ DRY RUN ONLY. To create dedicated image copies and update the document, run with --apply:`);
        console.log(`   node scripts/inspect-and-repair-lot-images.mjs --prod --apply`);
        return;
    }

    // 3. APPLY: Duplicate each valid file so the combined lot has its OWN dedicated copies
    console.log(`\n🚀 DUPLICATING IMAGES: Creating dedicated copies in Appwrite Storage for ${item.upc}...`);
    const newClonedIds = [];

    for (const itemMeta of validIds) {
        try {
            console.log(`   Downloading ${itemMeta.id}...`);
            const arrayBuffer = await storage.getFileDownload(BUCKET_ID, itemMeta.id);
            const buffer = Buffer.from(arrayBuffer);

            const inputFile = InputFile.fromBuffer(buffer, `combined-${item.upc}-${itemMeta.id}.jpg`);
            const newFile = await storage.createFile(
                BUCKET_ID,
                ID.unique(),
                inputFile,
                [
                    Permission.read(Role.any()),
                    Permission.write(Role.users()),
                    Permission.update(Role.users()),
                    Permission.delete(Role.users())
                ]
            );
            newClonedIds.push(newFile.$id);
            console.log(`   ✨ Created dedicated file copy: ${newFile.$id}`);
        } catch (e) {
            console.error(`   ❌ Failed to duplicate ${itemMeta.id}:`, e.message);
            // Fallback to original valid ID
            newClonedIds.push(itemMeta.id);
        }
    }

    if (newClonedIds.length === 0) {
        console.warn('⚠️ No valid images could be duplicated.');
        return;
    }

    const newMainPhotoId = newClonedIds[0];
    console.log(`\n📝 Updating ${item.title} (${item.$id}):`);
    console.log(`   New imageId: ${newMainPhotoId}`);
    console.log(`   New galleryImageIds: ${newClonedIds.length} photos`);

    await databases.updateDocument(DB_ID, COLLECTION_ID, item.$id, {
        imageId: newMainPhotoId,
        galleryImageIds: newClonedIds
    });

    console.log(`\n🎉 SUCCESS! Combined lot ${item.upc} now owns its own dedicated ${newClonedIds.length} photos in Appwrite Storage!`);
}

run().catch(console.error);

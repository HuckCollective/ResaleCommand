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
const targetUpc = targetUpcArg ? targetUpcArg.replace('--upc=', '').trim() : null;

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
    console.log(`\n🔍 Auditing Split Items in [${DB_ID} / ${COLLECTION_ID}] (Storage Bucket: ${BUCKET_ID})...`);
    if (targetUpc) console.log(`   Targeting specific UPC: ${targetUpc}`);
    console.log(`   Mode: ${isApply ? '🚀 APPLY (Will duplicate files and update records)' : '⚠️ DRY RUN (Audit only)'}`);

    // 1. Fetch items with pagination or by UPC
    let splitItems = [];

    if (targetUpc) {
        const res = await databases.listDocuments(DB_ID, COLLECTION_ID, [
            Query.equal('upc', targetUpc),
            Query.limit(1)
        ]);
        if (res.documents.length === 0) {
            console.error(`❌ Item with UPC ${targetUpc} not found in ${COLLECTION_ID}!`);
            return;
        }
        splitItems = res.documents;
    } else {
        let offset = 0;
        const limit = 100;
        while (true) {
            process.stdout.write(`   Fetching items (offset ${offset})...\r`);
            const res = await databases.listDocuments(DB_ID, COLLECTION_ID, [
                Query.limit(limit),
                Query.offset(offset),
                Query.orderDesc('$createdAt')
            ]);

            for (const doc of res.documents) {
                if (doc.parentLotId) {
                    splitItems.push(doc);
                }
            }

            if (res.documents.length < limit) break;
            offset += limit;
        }
    }

    console.log(`\n✅ Scanned total items. Found ${splitItems.length} split items (have parentLotId).\n`);

    if (splitItems.length === 0) {
        console.log('No split items found.');
        return;
    }

    // 2. Cache parent lots to avoid repeated queries
    const parentCache = new Map();
    async function getParent(parentId) {
        if (!parentId) return null;
        if (parentCache.has(parentId)) return parentCache.get(parentId);
        try {
            const parent = await databases.getDocument(DB_ID, COLLECTION_ID, parentId);
            parentCache.set(parentId, parent);
            return parent;
        } catch {
            parentCache.set(parentId, null);
            return null;
        }
    }

    // Cache file existence in storage
    const storageFileCache = new Map();
    async function fileExistsInStorage(fileId) {
        if (!fileId) return false;
        if (storageFileCache.has(fileId)) return storageFileCache.get(fileId);
        try {
            await storage.getFile(BUCKET_ID, fileId);
            storageFileCache.set(fileId, true);
            return true;
        } catch {
            storageFileCache.set(fileId, false);
            return false;
        }
    }

    const itemsToFix = [];

    for (const item of splitItems) {
        const parent = await getParent(item.parentLotId);
        const parentImageId = parent?.imageId || parent?.galleryImageIds?.[0] || null;

        const hasNoImage = !item.imageId && (!item.galleryImageIds || item.galleryImageIds.length === 0);
        const sharesParentImage = Boolean(item.imageId && parentImageId && item.imageId === parentImageId);

        let imageIsDead = false;
        if (item.imageId) {
            const exists = await fileExistsInStorage(item.imageId);
            if (!exists) imageIsDead = true;
        }

        if (hasNoImage || sharesParentImage || imageIsDead) {
            itemsToFix.push({
                item,
                parent,
                parentImageId,
                reason: hasNoImage ? 'MISSING_IMAGE' : (sharesParentImage ? 'SHARED_PARENT_IMAGE' : 'DEAD_IMAGE_404')
            });
            console.log(`   ⚠️ [${item.upc || item.$id}] "${item.title?.slice(0, 40)}" -> ${sharesParentImage ? 'SHARES parent image (' + item.imageId + ')' : (hasNoImage ? 'NO image' : 'DEAD image (' + item.imageId + ')')}`);
        }
    }

    console.log(`\n📊 Audit Summary: ${itemsToFix.length} split items need dedicated image copies out of ${splitItems.length} total split items.`);

    if (itemsToFix.length === 0) {
        console.log('🎉 All split items already have their own valid dedicated image files!');
        return;
    }

    if (!isApply) {
        console.log(`\n⚠️ DRY RUN ONLY. To create dedicated storage files and update these ${itemsToFix.length} items, re-run with:`);
        console.log(`   node scripts/audit-and-fix-split-images.mjs ${isProd ? '--prod ' : ''}--apply\n`);
        return;
    }

    // 3. APPLY FIX: Download source image and duplicate for each split item
    console.log(`\n🚀 DUPLICATING IMAGES: Creating dedicated physical files in Appwrite Storage...`);
    let fixedCount = 0;

    for (const { item, parent, parentImageId, reason } of itemsToFix) {
        // Resolve best source image to clone
        let sourceFileId = null;
        if (item.imageId && await fileExistsInStorage(item.imageId) && reason === 'SHARED_PARENT_IMAGE') {
            sourceFileId = item.imageId;
        } else if (parentImageId && await fileExistsInStorage(parentImageId)) {
            sourceFileId = parentImageId;
        } else if (parent?.galleryImageIds) {
            for (const gId of parent.galleryImageIds) {
                if (await fileExistsInStorage(gId)) {
                    sourceFileId = gId;
                    break;
                }
            }
        }

        if (!sourceFileId) {
            console.warn(`   ❌ [${item.upc || item.$id}] No valid parent or source image available to duplicate. Skipping.`);
            continue;
        }

        try {
            console.log(`   📥 Downloading source ${sourceFileId} for split item ${item.upc || item.$id}...`);
            const arrayBuffer = await storage.getFileDownload(BUCKET_ID, sourceFileId);
            const buffer = Buffer.from(arrayBuffer);

            const filename = `split-${item.upc || item.$id}-${sourceFileId}.jpg`;
            const inputFile = InputFile.fromBuffer(buffer, filename);

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

            await databases.updateDocument(DB_ID, COLLECTION_ID, item.$id, {
                imageId: newFile.$id,
                galleryImageIds: [newFile.$id]
            });

            console.log(`   ✨ [${item.upc || item.$id}] Fixed! Assigned dedicated file: ${newFile.$id}`);
            fixedCount++;
        } catch (err) {
            console.error(`   ❌ Failed to duplicate for ${item.upc || item.$id}:`, err.message);
        }
    }

    console.log(`\n🎉 COMPLETED! Successfully created dedicated image files for ${fixedCount} split items.`);
}

run().catch(console.error);

import { Client, Databases, Storage, Query } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const db = new Databases(client);
const storage = new Storage(client);

const isDev = (process.env.PUBLIC_APPWRITE_COLLECTION_ID || '').endsWith('_dev');
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
const ITEMS_COL = process.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items';
const REPORTS_BUCKET = isDev ? 'reports_dev' : 'reports';

const DRY_RUN = false; // Set to false to actually delete reports

// Only extract report IDs
function getAssociatedFileIds(doc) {
    const ids = new Set();
    
    if (doc.conditionNotes) {
        const scoutMatch = doc.conditionNotes.match(/\[SCOUT_REPORT_ID: ([^\]]+)\]/i);
        if (scoutMatch) ids.add(scoutMatch[1].trim());
        
        const mdMatch = doc.conditionNotes.match(/\[SCOUT_REPORT_MD: ([^\]]+)\]/i);
        if (mdMatch) ids.add(mdMatch[1].trim());
    }
    return ids;
}

async function run() {
    console.log(`Starting Orphaned Report Prune on ${ITEMS_COL} and ${REPORTS_BUCKET}...`);
    if (DRY_RUN) console.log("--- DRY RUN MODE (No files will be deleted) ---");

    console.log('Fetching all active report references from items...');
    const referencedReportIds = new Set();
    
    let offset = 0;
    const limit = 100;
    while (true) {
        process.stdout.write(`Fetching items offset ${offset}...\r`);
        const res = await db.listDocuments(DB_ID, ITEMS_COL, [
            Query.limit(limit),
            Query.offset(offset)
        ]);
        
        for (const doc of res.documents) {
            const ids = getAssociatedFileIds(doc);
            ids.forEach(id => referencedReportIds.add(id));
        }
        
        if (res.documents.length < limit) break;
        offset += limit;
    }
    
    console.log(`\nFound ${referencedReportIds.size} unique referenced reports.`);
    
    console.log('Scanning bucket for orphaned reports...');
    let totalScanned = 0;
    let cursor = null;
    const orphansToDelete = [];
    
    while (true) {
        const queries = [Query.limit(100)];
        if (cursor) queries.push(Query.cursorAfter(cursor));
        
        const fileList = await storage.listFiles(REPORTS_BUCKET, queries);
        if (fileList.files.length === 0) break;
        
        for (const file of fileList.files) {
            totalScanned++;
            if (!referencedReportIds.has(file.$id)) {
                orphansToDelete.push({ id: file.$id, name: file.name });
            }
        }
        
        cursor = fileList.files[fileList.files.length - 1].$id;
        process.stdout.write(`Scanned ${totalScanned} files...\r`);
    }
    
    console.log(`\nScan complete.`);
    console.log(`Total Files in Bucket: ${totalScanned}`);
    console.log(`Total Orphaned Files: ${orphansToDelete.length}`);
    
    if (orphansToDelete.length > 0) {
        if (!DRY_RUN) {
            console.log(`\nDeleting ${orphansToDelete.length} orphaned reports...`);
            let deleted = 0;
            for (const orphan of orphansToDelete) {
                try {
                    await storage.deleteFile(REPORTS_BUCKET, orphan.id);
                    console.log(`[DELETED] Orphaned report: ${orphan.id} (${orphan.name})`);
                    deleted++;
                } catch (e) {
                    console.error(`[ERROR] Failed to delete ${orphan.id}: ${e.message}`);
                }
            }
            console.log(`Successfully deleted ${deleted} orphaned reports.`);
        } else {
            console.log(`\nTo actually delete these ${orphansToDelete.length} orphaned reports, set DRY_RUN = false in the script.`);
        }
    }
}

run().catch(console.error);

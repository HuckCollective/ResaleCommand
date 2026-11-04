import { Client, Databases, Query } from 'node-appwrite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sanitizeHistoricalSkuMappings } from './seed-md-booth-skus.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MD_CANONICAL_WAREHOUSE_ID = '6a7e70050009db0e1857';

function extractTicketNumber(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return '';
    const m = s.match(/(?:ticket\s*#|sale\s*#|T-)\s*(\d{4,8})/i) || s.match(/^#?(\d{4,8})(?:\s*#\d+)?$/);
    return m ? m[1] : '';
}

function extractExplicitOccurrence(raw) {
    const s = String(raw ?? '').trim();
    const m = s.match(/#\d{4,8}\s*#(\d+)/i) || s.match(/^\d{4,8}\s*#(\d+)$/);
    return m ? parseInt(m[1], 10) : 1;
}

function cleanCode(raw) {
    return String(raw ?? '').replace(/^'+/, '').trim().toUpperCase();
}

function isPlaceholderSo(code) {
    if (!code) return true;
    return /^(?:SO-|ROW-|RICO-|MD-PAYOUT-|SOLD-ITEM-)/i.test(code);
}

function toPacificDateKey(rawDate) {
    if (!rawDate) return '';
    const s = String(rawDate).trim();
    if (!s) return '';
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
        try {
            return new Intl.DateTimeFormat('en-CA', {
                timeZone: 'America/Los_Angeles',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            }).format(d);
        } catch {
            return d.toISOString().slice(0, 10);
        }
    }
    return s.slice(0, 10);
}

async function fetchAllDocuments(databases, dbId, colId, queriesBase = []) {
    const all = [];
    let cursor = null;
    for (let page = 0; page < 100; page++) {
        const queries = [...queriesBase, Query.limit(100)];
        if (cursor) queries.push(Query.cursorAfter(cursor));
        const res = await databases.listDocuments(dbId, colId, queries);
        const docs = res.documents || [];
        all.push(...docs);
        if (docs.length < 100) break;
        cursor = docs[docs.length - 1].$id;
    }
    return all;
}

async function dedupeSalesCollection() {
    const endpoint = process.env.PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1';
    const projectId = process.env.PUBLIC_APPWRITE_PROJECT_ID;
    const apiKey = process.env.APPWRITE_API_KEY;
    const dbId = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
    const salesCol = process.env.PUBLIC_APPWRITE_SALES_COLLECTION_ID || 'sales';
    const itemsCol = process.env.PUBLIC_APPWRITE_ITEMS_COLLECTION_ID || process.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items';

    if (!endpoint || !projectId || !apiKey) {
        console.error('❌ Missing Appwrite credentials in .env (PUBLIC_APPWRITE_ENDPOINT, PUBLIC_APPWRITE_PROJECT_ID, APPWRITE_API_KEY)');
        process.exit(1);
    }

    const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
    const databases = new Databases(client);

    // 1. Build 0EJxxx <-> HUCK/PDXGL/BB canonical SKU map so identical sales with 0EJ vs UPC match
    const skuAliasMap = new Map();
    const historicalMap = sanitizeHistoricalSkuMappings();
    for (const [boothSku, upc] of Object.entries(historicalMap)) {
        skuAliasMap.set(boothSku.toUpperCase(), upc.toUpperCase());
    }
    try {
        const itemDocs = await fetchAllDocuments(databases, dbId, itemsCol, [Query.orderDesc('$id')]);
        for (const item of itemDocs) {
            const locSku = cleanCode(item.locationSku || item.external_sku || item.sku);
            const upc = cleanCode(item.upc || item.barcode);
            if (locSku && upc) {
                skuAliasMap.set(locSku, upc);
            }
        }
    } catch {
        // Proceed with historical map if items query fails
    }

    const canonicalizeSku = (raw) => {
        const c = cleanCode(raw);
        if (!c || isPlaceholderSo(c)) return '';
        if (/^(?:TICKET\s*#|SALE\s*#|T-\d)/i.test(c) || /^\d{4,8}$/.test(c)) return '';
        return skuAliasMap.get(c) || c;
    };

    // 2. Query all documents in `sales` collection for location = 'MD'
    const allSalesDocs = await fetchAllDocuments(databases, dbId, salesCol, [Query.orderAsc('$createdAt')]);
    const mdSalesDocs = allSalesDocs.filter((doc) => {
        if (String(doc.status || '').toLowerCase() === 'cancelled') return false;
        const wh = String(doc.warehouseId || doc.location || '').trim();
        return wh === MD_CANONICAL_WAREHOUSE_ID || wh.toUpperCase() === 'MD';
    });

    // Sort so original documents (real tenantId !== 'system', then earliest $createdAt) always come first
    mdSalesDocs.sort((a, b) => {
        const aSys = !a.tenantId || a.tenantId === 'system' ? 1 : 0;
        const bSys = !b.tenantId || b.tenantId === 'system' ? 1 : 0;
        if (aSys !== bSys) return aSys - bSys;
        return String(a.$createdAt || '').localeCompare(String(b.$createdAt || ''));
    });

    // Pre-index real SKUs by (ticketNum|amount) and ticketNums by (sku|amount|month) to heal placeholder SO- numbers
    const realSkuByTicketAmount = new Map();
    const ticketBySkuAmountMonth = new Map();
    const baseDocCreatedAtByTicketSkuAmount = new Map();

    for (const rawDoc of mdSalesDocs) {
        const rawTicketField = rawDoc.ticket || rawDoc.orderId || rawDoc.sale || rawDoc.ticketNumber || '';
        const ticketNum = extractTicketNumber(rawTicketField) || extractTicketNumber(rawDoc.soNumber);
        const occ = extractExplicitOccurrence(rawTicketField);
        const amount = Number(rawDoc.amount ?? rawDoc.grossAmount ?? rawDoc.netPayout ?? 0).toFixed(2);
        const sku =
            canonicalizeSku(rawDoc.sku) ||
            canonicalizeSku(rawDoc.soNumber) ||
            canonicalizeSku(rawDoc.upc) ||
            canonicalizeSku(rawDoc.orderId);
        const dateKey = toPacificDateKey(rawDoc.saleDate || rawDoc.soldDate || rawDoc.date);
        const monthKey = dateKey.slice(0, 7);

        if (ticketNum && sku) {
            const taKey = `${ticketNum}|${amount}`;
            if (!realSkuByTicketAmount.has(taKey)) realSkuByTicketAmount.set(taKey, sku);
        }
        if (ticketNum && sku && monthKey) {
            const samKey = `${sku}|${amount}|${monthKey}`;
            if (!ticketBySkuAmountMonth.has(samKey)) ticketBySkuAmountMonth.set(samKey, ticketNum);
        }
        if (ticketNum && occ === 1) {
            const tsaKey = `${ticketNum}|${sku}|${amount}`;
            const createdMs = Date.parse(rawDoc.$createdAt || '') || 0;
            if (!baseDocCreatedAtByTicketSkuAmount.has(tsaKey)) {
                baseDocCreatedAtByTicketSkuAmount.set(tsaKey, createdMs);
            }
        }
    }

    // 3. Group by composite key: `${doc.warehouseId || doc.location}_${doc.ticket || doc.orderId || doc.saleDate}_${doc.sku}_${doc.amount}`
    const groups = new Map();
    for (const rawDoc of mdSalesDocs) {
        const rawTicketField = rawDoc.ticket || rawDoc.orderId || rawDoc.sale || rawDoc.ticketNumber || '';
        const amount = Number(rawDoc.amount ?? rawDoc.grossAmount ?? rawDoc.netPayout ?? 0).toFixed(2);
        const dateKey = toPacificDateKey(rawDoc.saleDate || rawDoc.soldDate || rawDoc.date);
        const monthKey = dateKey.slice(0, 7);

        let ticketNum = extractTicketNumber(rawTicketField) || extractTicketNumber(rawDoc.soNumber);
        let sku =
            canonicalizeSku(rawDoc.sku) ||
            canonicalizeSku(rawDoc.soNumber) ||
            canonicalizeSku(rawDoc.upc) ||
            canonicalizeSku(rawDoc.orderId);

        if (ticketNum && !sku) {
            sku = realSkuByTicketAmount.get(`${ticketNum}|${amount}`) || '';
        }
        if (!ticketNum && sku && monthKey) {
            ticketNum = ticketBySkuAmountMonth.get(`${sku}|${amount}|${monthKey}`) || '';
        }

        // Preserve explicit #2/#3 occurrence ONLY when an identical (ticketNum, sku, amount) #1 doc was created in the same import batch
        const explicitOcc = extractExplicitOccurrence(rawTicketField);
        let effectiveTicket = ticketNum || dateKey || String(rawDoc.orderId || rawDoc.saleDate || '').trim();
        if (ticketNum && explicitOcc > 1) {
            const tsaKey = `${ticketNum}|${sku}|${amount}`;
            const baseMs = baseDocCreatedAtByTicketSkuAmount.get(tsaKey) || 0;
            const docMs = Date.parse(rawDoc.$createdAt || '') || 0;
            if (baseMs > 0 && docMs > 0 && Math.abs(docMs - baseMs) < 5 * 60 * 1000) {
                effectiveTicket = `${ticketNum}#${explicitOcc}`;
            }
        }

        const doc = {
            ...rawDoc,
            warehouseId: MD_CANONICAL_WAREHOUSE_ID,
            location: 'MD',
            ticket: effectiveTicket,
            sku: sku || 'UNMATCHED',
            amount,
        };

        const compositeKey = `${doc.warehouseId || doc.location}_${doc.ticket || doc.orderId || doc.saleDate}_${doc.sku}_${doc.amount}`;
        if (!groups.has(compositeKey)) {
            groups.set(compositeKey, []);
        }
        groups.get(compositeKey).push(doc);
    }

    // 4. Keep first document per composite key and delete duplicates
    let deletedCount = 0;
    let duplicateGroupCount = 0;
    for (const [key, docs] of groups.entries()) {
        if (docs.length <= 1) continue;
        duplicateGroupCount++;
        const [keepDoc, ...duplicates] = docs;
        for (const dup of duplicates) {
            await databases.deleteDocument(dbId, salesCol, dup.$id);
            deletedCount++;
            console.log(
                `🗑️ Deleted duplicate sale ${dup.$id} [key=${key}] (orderId="${dup.orderId || ''}", soNumber="${dup.soNumber || ''}", saleDate="${String(dup.saleDate || '').slice(0, 10)}", gross=$${dup.amount}) — kept ${keepDoc.$id}`
            );
        }
    }

    console.log(
        `✅ Sales deduplication complete for MD: scanned ${mdSalesDocs.length} documents across ${groups.size} unique keys (${duplicateGroupCount} duplicate groups). Deleted ${deletedCount} duplicate sales documents.`
    );
}

dedupeSalesCollection().catch((err) => {
    console.error('❌ Sales deduplication failed:', err?.message || err);
    process.exit(1);
});


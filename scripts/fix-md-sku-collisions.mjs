import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Client, Databases, ID, Query } from 'node-appwrite';

const ENDPOINT = process.env.PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1';
const PROJECT_ID = process.env.PUBLIC_APPWRITE_PROJECT_ID || '69714b35003a8adab6bb';
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

const MD_WAREHOUSE_ID = '6a7e70050009db0e1857';
const MD_CODE = 'MD';
const DRY_RUN = process.argv.includes('--dry-run');

if (!API_KEY) {
    console.error('❌ Missing APPWRITE_API_KEY in .env');
    process.exit(1);
}

const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

const db = new Databases(client);

// ============================================================================
// 1. RFC-4180 MULTILINE-AWARE CSV PARSER & FILE DISCOVERY
// ============================================================================
function parseCsvRfc4180(content) {
    const text = content.replace(/^\uFEFF/, '');
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const next = text[i + 1];

        if (inQuotes) {
            if (ch === '"' && next === '"') {
                currentField += '"';
                i++;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                currentField += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                currentRow.push(currentField);
                currentField = '';
            } else if (ch === '\r' && next === '\n') {
                currentRow.push(currentField);
                rows.push(currentRow);
                currentRow = [];
                currentField = '';
                i++;
            } else if (ch === '\n' || ch === '\r') {
                currentRow.push(currentField);
                rows.push(currentRow);
                currentRow = [];
                currentField = '';
            } else {
                currentField += ch;
            }
        }
    }

    if (currentField.length > 0 || currentRow.length > 0) {
        currentRow.push(currentField);
        rows.push(currentRow);
    }

    const nonEmptyRows = rows.filter(r => r.some(cell => String(cell).trim() !== ''));
    if (nonEmptyRows.length === 0) return [];

    const headers = nonEmptyRows[0].map(h => String(h).trim());
    const records = [];

    for (let r = 1; r < nonEmptyRows.length; r++) {
        const row = nonEmptyRows[r];
        const obj = {};
        for (let c = 0; c < headers.length; c++) {
            const key = headers[c] || `col_${c}`;
            obj[key] = row[c] !== undefined ? String(row[c]).trim() : '';
        }
        records.push(obj);
    }

    return records;
}

function findCsvFile(exactName, prefixPattern) {
    const searchDirs = [
        process.cwd(),
        path.join(process.cwd(), 'data'),
        path.join(process.cwd(), 'csv'),
        path.join(process.cwd(), 'exports'),
        path.join(process.cwd(), 'scripts'),
        path.join(os.homedir(), 'Downloads'),
    ];

    for (const dir of searchDirs) {
        if (!fs.existsSync(dir)) continue;
        const candidate = path.join(dir, exactName);
        if (fs.existsSync(candidate)) return candidate;
    }

    for (const dir of searchDirs) {
        if (!fs.existsSync(dir)) continue;
        const entries = fs.readdirSync(dir);
        const matches = entries
            .filter(name => name.endsWith('.csv') && prefixPattern.test(name))
            .map(name => {
                const full = path.join(dir, name);
                const stat = fs.statSync(full);
                return { full, mtimeMs: stat.mtimeMs, name };
            })
            .sort((a, b) => b.mtimeMs - a.mtimeMs);
        if (matches.length > 0) return matches[0].full;
    }

    return null;
}

// ============================================================================
// 2. PRE-VERIFIED MEMORY DEN MAPPINGS & COLLISION GUARDRAILS
// ============================================================================
const PREVERIFIED_OCT_BB_SKUS = new Set([
    '0EJ0HN', '0EJ0HQ', '0EJ0HX', '0EJ0IH', '0EJ0IJ', '0EJ0IL', '0EJ0IN',
    '0EJ0IT', '0EJ0IU', '0EJ0IV', '0EJ0J5', '0EJ0J8', '0EJ0KA', '0EJ0LM',
]);

const PREVERIFIED_MULTI_QTY_BINS = {
    '0EJ0H5': { upc: 'HUCK-1425', altUpc: 'HUCK-1380', expectedRemainingQty: 3, label: 'Frank Frazetta Fantasy Art' },
    '0EJ0FR': { upc: 'HUCK-1309', expectedRemainingQty: 12, label: 'HMM Reader' },
    '0EJ0FQ': { upc: 'HUCK-1308', expectedRemainingQty: 10, label: 'HMM Mid-Tier' },
    '0EJ0MN': { upc: 'HUCK-1323', expectedRemainingQty: 3, label: 'Assorted TTRPG Dungeons & Dragons 5e Rules Hardcover.' },
    '0EJ0EC': { upc: 'HUCK-0113', expectedRemainingQty: 14, label: "Huck's TTRPG Themed Paperback Novels" },
    '0EJ0JK': { upc: 'HUCK-1460', expectedRemainingQty: 43, label: 'Startrek/SciFi Paperbacks' },
    '0EJ0NQ': { upc: 'HUCK-9455', expectedRemainingQty: 8, label: 'Vintage Star Trek Book & Mag Lot' },
    '0EJ07M': { upc: null, expectedRemainingQty: 33, label: 'Shadowrun RPG 2e/3e Source book' },
    '0EJ09E': { upc: 'HUCK-0296', expectedRemainingQty: 2, label: 'Vintage Paperback Books J.R.R. Tolkien' },
    '0EJ0M8': { upc: 'HUCK-1498', expectedRemainingQty: 15, label: 'Fantasy/Sci-Fi MM Paperbacks' },
};

const PREVERIFIED_SKU_TO_UPC = {
    '0EJ0H5': 'HUCK-1425',
    '0EJ0FR': 'HUCK-1309',
    '0EJ0FQ': 'HUCK-1308',
    '0EJ0MN': 'HUCK-1323',
    '0EJ0EC': 'HUCK-0113',
    '0EJ0JK': 'HUCK-1460',
    '0EJ0NQ': 'HUCK-9455',
    '0EJ09E': 'HUCK-0296',
    '0EJ0M8': 'HUCK-1498',
    '0EJ06K': 'HUCK-1206',
    '0EJ0NY': 'HUCK-9459',
    '0EJ0O0': 'HUCK-9458',
    '0EJ0N8': 'HUCK-1440',
    '0EJ0O1': 'HUCK-9456',
    '0EJ0N6': 'HUCK-1502',
    '0EJ0NZ': 'HUCK-9457',
    '0EJ0OE': 'HUCK-1787',
    '0EJ0O7': 'HUCK-1794',
    '0EJ0H9': 'HUCK-1389',
    '0EJ0NX': 'HUCK-1795',
    '0EJ0NI': 'HUCK-1405',
    '0EJ0N1': 'HUCK-0158',
    '0EJ0MU': 'HUCK-8968',
    '0EJ0NO': 'HUCK-1508',
    '0EJ0ET': 'HUCK-1249-c',
    '0EJ0JN': 'HUCK-1422',
    '0EJ0JQ': 'HUCK-1409',
    '0EJ0NA': 'HUCK-1504',
    '0EJ0N3': 'HUCK-1501',
    '0EJ0EV': 'HUCK-1248',
    '0EJ0N2': 'HUCK-0374',
    '0EJ0N0': 'HUCK-5064',
    '0EJ0GV': 'HUCK-1369',
    '0EJ0NE': 'HUCK-0025',
    '0EJ0MP': 'HUCK-2808',
    '0EJ0JR': 'HUCK-1262',
    // Explicit 1-to-1 primary owners for the 4 collision pairs:
    '0EJ0MQ': 'HUCK-0334',
    '0EJ0HE': 'HUCK-1379',
    '0EJ0JJ': 'HUCK-1461',
    '0EJ05G': 'HUCK-9543',
};

// The 4 explicit collision pairs:
// primarySku keeps primaryUpc; secondarySku must get its own unique HUCK- item & barcode!
const EXPLICIT_COLLISION_PAIRS = [
    { primarySku: '0EJ0MQ', primaryUpc: 'HUCK-0334', secondarySku: '0EJ09A', preferredSecondaryUpc: 'HUCK-9716' },
    { primarySku: '0EJ0HE', primaryUpc: 'HUCK-1379', secondarySku: '0EJ0MW', preferredSecondaryUpc: 'HUCK-9724' },
    { primarySku: '0EJ0JJ', primaryUpc: 'HUCK-1461', secondarySku: '0EJ0MY', preferredSecondaryUpc: 'HUCK-9732' },
    { primarySku: '0EJ05G', primaryUpc: 'HUCK-9543', secondarySku: '0EJ02D', preferredSecondaryUpc: null },
];

function normalizeSku(raw) {
    return String(raw || '').trim().replace(/^'+/, '').toUpperCase();
}

function normalizeUpc(raw) {
    return String(raw || '').trim().replace(/^'+/, '').toUpperCase();
}

function parseMoney(raw) {
    if (raw === undefined || raw === null || raw === '') return 0;
    const cleaned = String(raw).replace(/[^0-9.-]/g, '');
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
}

function normalizeTitleForMatch(str) {
    return String(str || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function computeTitleSimilarity(normA, normB) {
    if (!normA || !normB) return 0;
    if (normA === normB) return 1.0;
    const tokensA = normA.split(' ').filter(Boolean);
    const tokensB = normB.split(' ').filter(Boolean);
    if (tokensA.length === 0 || tokensB.length === 0) return 0;
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    let intersection = 0;
    for (const t of setA) {
        if (setB.has(t)) intersection++;
    }
    const union = new Set([...setA, ...setB]).size;
    return union > 0 ? intersection / union : 0;
}

function isBbRow({ sku, upc, title, raw }) {
    const normSku = normalizeSku(sku);
    const normUpc = normalizeUpc(upc);
    const rawTitle = String(title || '').trim();
    if (PREVERIFIED_OCT_BB_SKUS.has(normSku)) return true;
    if (normUpc.startsWith('BB-') || normSku.startsWith('BB-')) return true;
    if (/^B\s*&\s*B\b/i.test(rawTitle) || /^BB[\s-]/i.test(rawTitle)) return true;
    if (raw) {
        const blob = `${raw['Category'] || ''} ${raw['Brand'] || ''} ${raw['Description'] || ''} ${raw['Vendor'] || ''}`;
        if (/biggie/i.test(blob)) return true;
    }
    return false;
}

function isBbDbItem(item) {
    if (!item) return false;
    const upc = normalizeUpc(item.upc);
    if (upc.startsWith('HUCK-') || upc.startsWith('PDXGL-')) return false;
    if (upc.startsWith('BB-') || item.isSubClient) return true;
    const title = String(item.title || item.identity || '').trim();
    if (/^B\s*&\s*B\b/i.test(title)) return true;
    const sku = normalizeSku(item.locationSku || item.sku);
    if (PREVERIFIED_OCT_BB_SKUS.has(sku)) return true;
    return false;
}

async function fetchAllItems() {
    const all = [];
    let cursor = null;
    while (true) {
        const queries = [Query.orderDesc('$id'), Query.limit(100)];
        if (cursor) queries.push(Query.cursorAfter(cursor));
        const res = await db.listDocuments(DB_ID, 'items', queries);
        if (!res.documents || res.documents.length === 0) break;
        all.push(...res.documents);
        cursor = res.documents[res.documents.length - 1].$id;
        if (res.documents.length < 100 || all.length >= res.total) break;
    }
    return all;
}

async function main() {
    console.log('================================================================================');
    console.log(`🔧 MEMORY DEN (#0EJ) SKU COLLISION CLEANUP & FULL 0EJ STAMP (${DRY_RUN ? 'DRY-RUN' : 'LIVE APPLY'})`);
    console.log('================================================================================\n');

    const productsPath = findCsvFile('Products-2026-10-30 22_34_38.csv', /^Products-.*\.csv$/i);
    if (!productsPath) {
        console.error('❌ Could not locate Products-*.csv in workspace or ~/Downloads.');
        process.exit(1);
    }
    console.log(`📄 Products CSV: ${productsPath}`);
    const productsRows = parseCsvRfc4180(fs.readFileSync(productsPath, 'utf8'));
    console.log(`📊 Parsed Products CSV rows: ${productsRows.length}`);

    const productsBySku = new Map();
    const productsList = [];
    for (const row of productsRows) {
        const sku = normalizeSku(row['SKU'] || row['sku']);
        const title = String(row['Item'] || row['Title'] || row['Name'] || '').trim();
        const upc = normalizeUpc(row['UPC'] || row['upc']);
        const invState = String(row['Inventory'] || row['Status'] || '').trim();
        const qtyRaw = Number(row['Quantity'] ?? row['Qty'] ?? 1);
        const price = parseMoney(row['Price'] ?? row['Aged Price'] ?? row['Agreed Price']);
        const isBb = isBbRow({ sku, upc, title, raw: row });
        const rec = {
            raw: row,
            sku,
            title,
            normTitle: normalizeTitleForMatch(title),
            upc,
            inventoryState: invState,
            quantity: Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1,
            price,
            isBb,
        };
        if (sku) productsBySku.set(sku, rec);
        productsList.push(rec);
    }

    let dbItems = await fetchAllItems();
    console.log(`🗄️  Loaded resale_db.items: ${dbItems.length}\n`);

    // Track all existing numeric HUCK- barcodes so we can allocate clean sequential UPCs
    const allUsedUpcs = new Set();
    let maxHuckNum = 9700;
    for (const item of dbItems) {
        const u = normalizeUpc(item.upc);
        if (u) {
            allUsedUpcs.add(u);
            const m = u.match(/^HUCK-(\d{4})$/);
            if (m) {
                const n = parseInt(m[1], 10);
                if (n > maxHuckNum && n < 9900) maxHuckNum = n;
            }
        }
    }

    const allocateNextHuckUpc = (preferredUpc = null) => {
        if (preferredUpc && !allUsedUpcs.has(preferredUpc)) {
            allUsedUpcs.add(preferredUpc);
            return preferredUpc;
        }
        while (true) {
            maxHuckNum++;
            const cand = `HUCK-${String(maxHuckNum).padStart(4, '0')}`;
            if (!allUsedUpcs.has(cand)) {
                allUsedUpcs.add(cand);
                return cand;
            }
        }
    };

    // ============================================================================
    // STEP 1: CLEAN UP EXTRA DUPLICATE HUCK-9713..HUCK-9739 ITEMS
    // ============================================================================
    console.log('🧹 STEP 1: Auditing HUCK-9713..HUCK-9739 items created by repeated Assign Unique Barcode clicks...');
    const range9713To9739 = dbItems.filter(i => {
        const u = normalizeUpc(i.upc);
        const m = u.match(/^HUCK-(\d{4})$/);
        if (!m) return false;
        const num = parseInt(m[1], 10);
        return num >= 9713 && num <= 9739;
    });

    console.log(`   Found ${range9713To9739.length} item(s) in HUCK-9713..HUCK-9739:`);
    for (const it of range9713To9739) {
        console.log(`   - $id=${it.$id} | upc=${it.upc} | locationSku="${it.locationSku || ''}" | status=${it.status} | title="${it.title}"`);
    }

    // Group HUCK-9713..9739 items by normalized locationSku or normalized title so we keep at most ONE per secondary collision SKU
    const keptIdsInRange = new Set();
    const groupsInRange = new Map();
    for (const it of range9713To9739) {
        const skuKey = normalizeSku(it.locationSku);
        const titleKey = normalizeTitleForMatch(it.title || it.identity);
        const key = skuKey || titleKey || it.$id;
        if (!groupsInRange.has(key)) groupsInRange.set(key, []);
        groupsInRange.get(key).push(it);
    }

    let deletedDuplicatesCount = 0;
    for (const [key, list] of groupsInRange.entries()) {
        if (list.length <= 1) {
            keptIdsInRange.add(list[0].$id);
            continue;
        }
        // Prefer preferred UPCs (HUCK-9716, HUCK-9724, HUCK-9732) or the one with a saleId, otherwise newest (list[0])
        const preferredSet = new Set(['HUCK-9716', 'HUCK-9724', 'HUCK-9732']);
        const keeper =
            list.find(x => x.saleId) ||
            list.find(x => preferredSet.has(normalizeUpc(x.upc))) ||
            list[0];
        keptIdsInRange.add(keeper.$id);

        for (const dup of list) {
            if (dup.$id === keeper.$id || dup.saleId) continue;
            console.log(`   🗑️  Deleting extra duplicate item $id=${dup.$id} (upc=${dup.upc}, sku=${dup.locationSku}, title="${dup.title}")`);
            if (!DRY_RUN) {
                await db.deleteDocument(DB_ID, 'items', dup.$id);
            }
            deletedDuplicatesCount++;
        }
    }

    if (deletedDuplicatesCount > 0 && !DRY_RUN) {
        dbItems = await fetchAllItems();
    }
    console.log(`   ✅ Cleaned up ${deletedDuplicatesCount} extra duplicate item(s).\n`);

    // ============================================================================
    // STEP 2: RESOLVE THE 4 EXPLICIT COLLISION PAIRS (0EJ0MQ/0EJ09A, 0EJ0HE/0EJ0MW, 0EJ0JJ/0EJ0MY, 0EJ05G/0EJ02D)
    // ============================================================================
    console.log('🔒 STEP 2: Resolving the 4 Explicit Collision Pairs (1-to-1 SKU <-> UPC)...');
    const lockedSkuToItem = new Map(); // sku -> dbItem
    const lockedItemIds = new Set();

    for (const pair of EXPLICIT_COLLISION_PAIRS) {
        const { primarySku, primaryUpc, secondarySku, preferredSecondaryUpc } = pair;
        const primaryCsv = productsBySku.get(primarySku);
        const secondaryCsv = productsBySku.get(secondarySku);

        // 2a. Lock Primary Item (e.g., 0EJ0MQ -> HUCK-0334, 0EJ0HE -> HUCK-1379, 0EJ0JJ -> HUCK-1461, 0EJ05G -> HUCK-9543)
        let primaryDoc = dbItems.find(i => normalizeUpc(i.upc) === primaryUpc);
        if (!primaryDoc) {
            primaryDoc = dbItems.find(i => normalizeSku(i.locationSku) === primarySku && !lockedItemIds.has(i.$id));
        }

        if (primaryDoc) {
            const pInv = String(primaryCsv?.inventoryState || '').toLowerCase();
            const pSold = pInv === 'sold' || pInv === 'paid' || String(primaryDoc.status || '').toLowerCase() === 'sold';
            const pStatus = pSold ? 'sold' : 'placed';
            const pQty = pSold ? 1 : Math.max(1, Number(primaryCsv?.quantity || primaryDoc.quantity || 1));
            const pUpdate = {};
            if (normalizeSku(primaryDoc.locationSku) !== primarySku) pUpdate.locationSku = primarySku;
            if (normalizeUpc(primaryDoc.upc) !== primaryUpc) pUpdate.upc = primaryUpc;
            if (primaryDoc.storageLocation !== MD_CODE) pUpdate.storageLocation = MD_CODE;
            if (primaryDoc.warehouseId !== MD_WAREHOUSE_ID) pUpdate.warehouseId = MD_WAREHOUSE_ID;
            if (primaryDoc.status !== pStatus) pUpdate.status = pStatus;
            if (Number(primaryDoc.quantity ?? 1) !== pQty) pUpdate.quantity = pQty;

            if (Object.keys(pUpdate).length > 0) {
                console.log(`   • [PRIMARY ${primarySku}] Updating $id=${primaryDoc.$id} (${primaryUpc}) -> ${JSON.stringify(pUpdate)}`);
                if (!DRY_RUN) {
                    await db.updateDocument(DB_ID, 'items', primaryDoc.$id, pUpdate);
                }
                Object.assign(primaryDoc, pUpdate);
            } else {
                console.log(`   • [PRIMARY ${primarySku}] Verified $id=${primaryDoc.$id} (${primaryUpc}) already locked to ${primarySku}`);
            }
            lockedSkuToItem.set(primarySku, primaryDoc);
            lockedItemIds.add(primaryDoc.$id);
            allUsedUpcs.add(primaryUpc);
        }

        // 2b. Lock or Create Secondary Item (0EJ09A, 0EJ0MW, 0EJ0MY, 0EJ02D) — MUST NOT be primaryDoc and MUST NOT use primaryUpc!
        let secondaryCandidates = dbItems.filter(i => {
            if (lockedItemIds.has(i.$id)) return false;
            if (primaryDoc && i.$id === primaryDoc.$id) return false;
            const iSku = normalizeSku(i.locationSku);
            const iUpc = normalizeUpc(i.upc);
            if (preferredSecondaryUpc && iUpc === preferredSecondaryUpc) return true;
            if (iSku === secondarySku) return true;
            return false;
        });

        // If no candidate has locationSku === secondarySku yet, check if there is a second unclaimed copy with the same normalized title
        if (secondaryCandidates.length === 0 && secondaryCsv?.normTitle) {
            secondaryCandidates = dbItems.filter(i => {
                if (lockedItemIds.has(i.$id)) return false;
                if (primaryDoc && i.$id === primaryDoc.$id) return false;
                const iSku = normalizeSku(i.locationSku);
                if (iSku && /^0EJ/i.test(iSku) && iSku !== secondarySku) return false;
                return normalizeTitleForMatch(i.title || i.identity) === secondaryCsv.normTitle;
            });
        }

        let secondaryDoc = secondaryCandidates[0] || null;

        // Clear locationSku on any extra secondary candidates beyond secondaryDoc
        if (secondaryCandidates.length > 1) {
            for (const extra of secondaryCandidates.slice(1)) {
                if (extra.saleId) continue;
                const isExtraIn9713Range = /^HUCK-97[1-3]\d$/.test(normalizeUpc(extra.upc));
                if (isExtraIn9713Range) {
                    console.log(`   🗑️  Deleting extra secondary duplicate $id=${extra.$id} (${extra.upc}) for ${secondarySku}`);
                    if (!DRY_RUN) {
                        await db.deleteDocument(DB_ID, 'items', extra.$id);
                    }
                    dbItems = dbItems.filter(x => x.$id !== extra.$id);
                } else if (normalizeSku(extra.locationSku) === secondarySku) {
                    console.log(`   🧹 Clearing stale locationSku="${extra.locationSku}" on $id=${extra.$id} (${extra.upc})`);
                    if (!DRY_RUN) {
                        await db.updateDocument(DB_ID, 'items', extra.$id, { locationSku: '' });
                    }
                    extra.locationSku = '';
                }
            }
        }

        const sInv = String(secondaryCsv?.inventoryState || 'In Stock').toLowerCase();
        const sSold = sInv === 'sold' || sInv === 'paid';
        const sStatus = sSold ? 'sold' : 'placed';
        const sQty = sSold ? 1 : Math.max(1, Number(secondaryCsv?.quantity || 1));
        const sPrice = Number(secondaryCsv?.price || primaryDoc?.resalePrice || 0);
        const sTitle = secondaryCsv?.title || primaryDoc?.title || `Memory Den Item ${secondarySku}`;

        if (secondaryDoc) {
            let sUpc = normalizeUpc(secondaryDoc.upc);
            if (!sUpc || sUpc === primaryUpc || (preferredSecondaryUpc && sUpc !== preferredSecondaryUpc && !allUsedUpcs.has(preferredSecondaryUpc))) {
                sUpc = allocateNextHuckUpc(preferredSecondaryUpc);
            } else {
                allUsedUpcs.add(sUpc);
            }

            const sUpdate = {};
            if (normalizeSku(secondaryDoc.locationSku) !== secondarySku) sUpdate.locationSku = secondarySku;
            if (normalizeUpc(secondaryDoc.upc) !== sUpc) sUpdate.upc = sUpc;
            if (secondaryDoc.storageLocation !== MD_CODE) sUpdate.storageLocation = MD_CODE;
            if (secondaryDoc.warehouseId !== MD_WAREHOUSE_ID) sUpdate.warehouseId = MD_WAREHOUSE_ID;
            if (secondaryDoc.status !== sStatus) sUpdate.status = sStatus;
            if (Number(secondaryDoc.quantity ?? 1) !== sQty) sUpdate.quantity = sQty;
            if (sPrice > 0 && Math.abs(Number(secondaryDoc.resalePrice || 0) - sPrice) > 0.01) {
                sUpdate.resalePrice = sPrice;
            }

            if (Object.keys(sUpdate).length > 0) {
                console.log(`   • [SECONDARY ${secondarySku}] Updating $id=${secondaryDoc.$id} -> upc=${sUpc}, ${JSON.stringify(sUpdate)}`);
                if (!DRY_RUN) {
                    await db.updateDocument(DB_ID, 'items', secondaryDoc.$id, sUpdate);
                }
                Object.assign(secondaryDoc, sUpdate);
            } else {
                console.log(`   • [SECONDARY ${secondarySku}] Verified $id=${secondaryDoc.$id} (${sUpc}) already locked to ${secondarySku}`);
            }
            lockedSkuToItem.set(secondarySku, secondaryDoc);
            lockedItemIds.add(secondaryDoc.$id);
        } else {
            const newUpc = allocateNextHuckUpc(preferredSecondaryUpc);
            const createPayload = {
                title: sTitle,
                identity: sTitle,
                upc: newUpc,
                locationSku: secondarySku,
                storageLocation: MD_CODE,
                warehouseId: MD_WAREHOUSE_ID,
                status: sStatus,
                quantity: sQty,
                cost: Number(primaryDoc?.cost ?? 0),
                resalePrice: sPrice,
                tenantId: primaryDoc?.tenantId || 'huck',
            };
            console.log(`   • [SECONDARY ${secondarySku}] Creating dedicated item with upc=${newUpc}, title="${sTitle}" ($${sPrice})`);
            if (!DRY_RUN) {
                const created = await db.createDocument(DB_ID, 'items', ID.unique(), createPayload);
                dbItems.unshift(created);
                lockedSkuToItem.set(secondarySku, created);
                lockedItemIds.add(created.$id);
            }
        }
    }
    console.log('');

    // ============================================================================
    // STEP 3: MATCH ALL 808 ROWS OF Products-*.csv & STAMP locationSku ON EVERY MATCHED ITEM
    // ============================================================================
    console.log('🏷️  STEP 3: Matching all 808 rows of Products-*.csv & stamping missing 0EJ... locationSkus...');

    const claimedItemIdToSku = new Map();
    for (const [sku, doc] of lockedSkuToItem.entries()) {
        if (doc?.$id) claimedItemIdToSku.set(doc.$id, sku);
    }

    // Lock Multi-Qty Booth Bins
    const multiBinResolvedBySku = new Map();
    const isSoldUnitSplitChild = (it) => /\(sold unit\)/i.test(String(it?.title || ''));
    for (const [binSku, binConfig] of Object.entries(PREVERIFIED_MULTI_QTY_BINS)) {
        let foundBin = null;
        if (binConfig.upc) {
            foundBin = dbItems.find(i => normalizeUpc(i.upc) === binConfig.upc && !isSoldUnitSplitChild(i));
        }
        if (!foundBin && binConfig.altUpc) {
            foundBin = dbItems.find(i => normalizeUpc(i.upc) === binConfig.altUpc && !isSoldUnitSplitChild(i));
        }
        if (!foundBin) {
            const cands = dbItems.filter(i => normalizeSku(i.locationSku) === binSku && !isSoldUnitSplitChild(i));
            foundBin = cands.find(c => c.status === 'placed' && Number(c.quantity ?? 1) > 1) || cands.find(c => c.status === 'placed') || cands[0] || null;
        }
        if (!foundBin) {
            const normLabel = normalizeTitleForMatch(binConfig.label);
            const cands = dbItems.filter(i => {
                if (isSoldUnitSplitChild(i)) return false;
                const t = normalizeTitleForMatch(i.title || i.identity);
                return t && (t === normLabel || t.startsWith(normLabel) || normLabel.startsWith(t));
            });
            foundBin = cands.find(c => c.status === 'placed' && Number(c.quantity ?? 1) > 1) || cands[0] || null;
        }
        if (foundBin) {
            multiBinResolvedBySku.set(binSku, foundBin);
            claimedItemIdToSku.set(foundBin.$id, binSku);
        }
    }

    const dereferenceParent = (itm) => {
        if (!itm) return null;
        const s = String(itm.status || '').toLowerCase().trim();
        if ((s === 'combined' || s === 'deconstructed') && itm.parentLotId) {
            const parent = dbItems.find(p => p.$id === itm.parentLotId);
            if (parent) return dereferenceParent(parent);
        }
        return itm;
    };

    function matchRowToDbItem(prod) {
        const normSku = prod.sku;
        const normUpc = prod.upc;
        const price = prod.price;
        const rowIsBb = prod.isBb;

        if (lockedSkuToItem.has(normSku)) return lockedSkuToItem.get(normSku);
        if (multiBinResolvedBySku.has(normSku)) return multiBinResolvedBySku.get(normSku);

        const canUseCandidate = (cand) => {
            if (!cand) return false;
            const s = String(cand.status || '').toLowerCase().trim();
            if (s === 'tracked' || s === 'draft' || s === 'scouted') return false;
            if (isSoldUnitSplitChild(cand)) return false;
            if (isBbDbItem(cand) !== rowIsBb) return false;
            const existingClaim = claimedItemIdToSku.get(cand.$id);
            if (existingClaim && existingClaim !== normSku) return false;
            const candLocSku = normalizeSku(cand.locationSku || cand.sku);
            if (normSku && /^0EJ/i.test(normSku) && /^0EJ/i.test(candLocSku) && candLocSku !== normSku) {
                return false;
            }
            return true;
        };

        // 1. Pre-verified SKU -> UPC map
        const preTarget = PREVERIFIED_SKU_TO_UPC[normSku];
        if (preTarget) {
            const byPre = dbItems.find(i => normalizeUpc(i.upc) === preTarget.toUpperCase() && canUseCandidate(i));
            if (byPre) return dereferenceParent(byPre);
        }

        // 2. Direct UPC match
        if (normUpc) {
            const byUpc = dbItems.find(i => normalizeUpc(i.upc) === normUpc && canUseCandidate(i));
            if (byUpc) return dereferenceParent(byUpc);
        }

        // 3. Direct locationSku match
        if (normSku) {
            const skuHits = dbItems.filter(i => {
                const lSku = normalizeSku(i.locationSku || i.sku);
                return lSku === normSku && canUseCandidate(i);
            });
            if (skuHits.length > 0) {
                const chosen =
                    skuHits.find(it => it.status === 'placed' && Number(it.quantity ?? 1) > 1) ||
                    skuHits.find(it => String(it.status || '').toLowerCase() !== 'sold') ||
                    skuHits[0];
                return dereferenceParent(chosen);
            }
        }

        // 4. Strict Title Matching (>= 15 chars)
        const normTitle = prod.normTitle;
        if (!normTitle || normTitle.length < 15) return null;

        const titleEligible = dbItems.filter(i => {
            const s = String(i.status || '').toLowerCase().trim();
            if (s === 'combined' || s === 'deconstructed') return false;
            return canUseCandidate(i);
        });

        const exactMatch = titleEligible.find(c => {
            const candTitle = normalizeTitleForMatch(c.title || c.identity);
            if (candTitle !== normTitle) return false;
            const dbPrice = Number(c.resalePrice ?? 0);
            if (price > 0 && dbPrice > 0 && !preTarget && Math.abs(dbPrice - price) > 5.01) return false;
            return true;
        });
        if (exactMatch) return dereferenceParent(exactMatch);

        let bestCand = null;
        let bestScore = 0;
        for (const c of titleEligible) {
            const candTitle = normalizeTitleForMatch(c.title || c.identity);
            if (candTitle.length < 15) continue;
            const sim = computeTitleSimilarity(normTitle, candTitle);
            if (sim >= 0.85) {
                const dbPrice = Number(c.resalePrice ?? 0);
                if (price > 0 && dbPrice > 0 && !preTarget && Math.abs(dbPrice - price) > 5.01) continue;
                if (sim > bestScore) {
                    bestScore = sim;
                    bestCand = c;
                }
            }
        }

        return bestCand ? dereferenceParent(bestCand) : null;
    }

    // Sort products so preverified/locked SKUs claim their items first
    const sortedProducts = [...productsList].sort((a, b) => {
        const pA = lockedSkuToItem.has(a.sku) ? 0 : (PREVERIFIED_MULTI_QTY_BINS[a.sku] ? 1 : (PREVERIFIED_SKU_TO_UPC[a.sku] ? 2 : 3));
        const pB = lockedSkuToItem.has(b.sku) ? 0 : (PREVERIFIED_MULTI_QTY_BINS[b.sku] ? 1 : (PREVERIFIED_SKU_TO_UPC[b.sku] ? 2 : 3));
        return pA - pB;
    });

    let matchedCsvCount = 0;
    let newlyStampedSkuCount = 0;
    let createdBbCount = 0;

    for (const prod of sortedProducts) {
        if (!prod.sku) continue;
        let matched = matchRowToDbItem(prod);

        if (!matched && prod.isBb) {
            const inv = prod.inventoryState.toLowerCase();
            const isSold = inv === 'sold' || inv === 'paid' || PREVERIFIED_OCT_BB_SKUS.has(prod.sku);
            const bbUpc = prod.upc && prod.upc.startsWith('BB-') ? prod.upc : `BB-${prod.sku}`;
            const bbPayload = {
                title: prod.title,
                identity: prod.title,
                upc: bbUpc,
                locationSku: prod.sku,
                storageLocation: MD_CODE,
                warehouseId: MD_WAREHOUSE_ID,
                status: isSold ? 'sold' : 'placed',
                quantity: isSold ? 1 : Math.max(1, prod.quantity),
                cost: 0,
                resalePrice: prod.price,
                tenantId: 'huck',
            };
            console.log(`   🆕 Creating missing B&B item [${prod.sku}] -> ${bbUpc} ("${prod.title}")`);
            if (!DRY_RUN) {
                matched = await db.createDocument(DB_ID, 'items', ID.unique(), bbPayload);
                dbItems.unshift(matched);
            } else {
                matched = { $id: `dry_bb_${prod.sku}`, ...bbPayload };
            }
            createdBbCount++;
        }

        if (!matched) continue;

        matchedCsvCount++;
        claimedItemIdToSku.set(matched.$id, prod.sku);

        const updatePayload = {};
        if (normalizeSku(matched.locationSku) !== prod.sku) {
            updatePayload.locationSku = prod.sku;
        }
        if (matched.storageLocation !== MD_CODE) {
            updatePayload.storageLocation = MD_CODE;
        }
        if (matched.warehouseId !== MD_WAREHOUSE_ID) {
            updatePayload.warehouseId = MD_WAREHOUSE_ID;
        }
        if (!normalizeUpc(matched.upc)) {
            const generatedUpc = prod.isBb ? `BB-${prod.sku}` : allocateNextHuckUpc();
            updatePayload.upc = generatedUpc;
        }

        if (Object.keys(updatePayload).length > 0) {
            if (!DRY_RUN) {
                await db.updateDocument(DB_ID, 'items', matched.$id, updatePayload);
            }
            Object.assign(matched, updatePayload);
            newlyStampedSkuCount++;
            if (newlyStampedSkuCount % 25 === 0) {
                console.log(`   ... stamped ${newlyStampedSkuCount} items so far`);
            }
        }
    }

    console.log(`   ✅ Matched ${matchedCsvCount} / ${productsList.length} CSV rows (${newlyStampedSkuCount} items stamped/updated, ${createdBbCount} B&B created).\n`);

    // ============================================================================
    // STEP 4: GLOBAL 1-TO-1 BIJECTION AUDIT (ZERO DUPLICATE 0EJ SKUS & ZERO DUPLICATE UPCS)
    // ============================================================================
    console.log('🛡️  STEP 4: Enforcing 100% 1-to-1 unique 0EJ... <-> UPC bijection across resale_db.items...');
    if (!DRY_RUN) {
        dbItems = await fetchAllItems();
    }

    // 4a. Ensure each 0EJ... SKU belongs to at most ONE DB item
    const itemsByZeroEjSku = new Map();
    for (const item of dbItems) {
        const sku = normalizeSku(item.locationSku || item.sku);
        if (!sku || !/^0EJ/i.test(sku)) continue;
        if (!itemsByZeroEjSku.has(sku)) itemsByZeroEjSku.set(sku, []);
        itemsByZeroEjSku.get(sku).push(item);
    }

    let clearedDuplicateSkuCount = 0;
    const canonicalItemBySku = new Map();

    for (const [sku, list] of itemsByZeroEjSku.entries()) {
        if (list.length === 1) {
            canonicalItemBySku.set(sku, list[0]);
            continue;
        }

        // Pick canonical winner: lockedSkuToItem > claimedItemIdToSku > placed multi-qty > placed > newest
        const locked = lockedSkuToItem.get(sku);
        const winner =
            (locked && list.find(i => i.$id === locked.$id)) ||
            list.find(i => claimedItemIdToSku.get(i.$id) === sku) ||
            list.find(i => i.status === 'placed' && Number(i.quantity ?? 1) > 1) ||
            list.find(i => i.status === 'placed') ||
            list[0];

        canonicalItemBySku.set(sku, winner);

        for (const other of list) {
            if (other.$id === winner.$id) continue;
            console.log(`   🧹 Clearing duplicate locationSku="${sku}" from non-winner $id=${other.$id} (upc=${other.upc}, title="${other.title}") — Winner is $id=${winner.$id} (upc=${winner.upc})`);
            if (!DRY_RUN) {
                await db.updateDocument(DB_ID, 'items', other.$id, { locationSku: '' });
            }
            other.locationSku = '';
            clearedDuplicateSkuCount++;
        }
    }

    // 4b. Ensure no two 0EJ... SKUs share the same UPC
    const skuByUpc = new Map();
    let reindexedDuplicateUpcCount = 0;

    // Sort SKUs so preverified & locked SKUs claim their UPC first
    const sortedCanonicalSkus = Array.from(canonicalItemBySku.keys()).sort((a, b) => {
        const pA = PREVERIFIED_SKU_TO_UPC[a] ? 0 : 1;
        const pB = PREVERIFIED_SKU_TO_UPC[b] ? 0 : 1;
        if (pA !== pB) return pA - pB;
        return a.localeCompare(b);
    });

    for (const sku of sortedCanonicalSkus) {
        const item = canonicalItemBySku.get(sku);
        let upc = normalizeUpc(item.upc);
        const title = String(item.title || item.identity || '');

        // Never allow test/demo UPCs or empty UPCs on a 0EJ item
        if (!upc || !/^(HUCK-|PDXGL-|BB-)/i.test(upc) || /test|demo|sample/i.test(upc)) {
            const newUpc = isBbDbItem(item) ? `BB-${sku}` : allocateNextHuckUpc();
            console.log(`   🔧 Assigning valid production UPC ${newUpc} to [${sku}] $id=${item.$id} ("${title}")`);
            if (!DRY_RUN) {
                await db.updateDocument(DB_ID, 'items', item.$id, { upc: newUpc });
            }
            item.upc = newUpc;
            upc = newUpc;
            reindexedDuplicateUpcCount++;
        }

        if (skuByUpc.has(upc)) {
            const ownerSku = skuByUpc.get(upc);
            const newUpc = isBbDbItem(item) ? `BB-${sku}` : allocateNextHuckUpc();
            console.log(`   🔧 Resolving shared UPC collision on ${upc} (owned by ${ownerSku}): assigning unique ${newUpc} to [${sku}] $id=${item.$id} ("${title}")`);
            if (!DRY_RUN) {
                await db.updateDocument(DB_ID, 'items', item.$id, { upc: newUpc });
            }
            item.upc = newUpc;
            upc = newUpc;
            reindexedDuplicateUpcCount++;
        }

        skuByUpc.set(upc, sku);
    }

    // ============================================================================
    // STEP 5: FINAL VERIFICATION AUDIT
    // ============================================================================
    if (!DRY_RUN) {
        dbItems = await fetchAllItems();
    }

    const finalSkuMap = new Map();
    const finalUpcToSkus = new Map();
    for (const item of dbItems) {
        const sku = normalizeSku(item.locationSku || item.sku);
        const upc = normalizeUpc(item.upc);
        if (!sku || !/^0EJ/i.test(sku) || !upc) continue;
        finalSkuMap.set(sku, item);
        if (!finalUpcToSkus.has(upc)) finalUpcToSkus.set(upc, []);
        finalUpcToSkus.get(upc).push(sku);
    }

    const remainingUpcCollisions = Array.from(finalUpcToSkus.entries()).filter(([, skus]) => skus.length > 1);

    console.log('\n================================================================================');
    console.log('✅ FINAL MEMORY DEN (#0EJ) BARCODE VERIFICATION SUMMARY');
    console.log('================================================================================');
    console.log(`  • Total Unique 0EJ... -> UPC Mappings in resale_db.items : ${finalSkuMap.size}`);
    console.log(`  • Extra HUCK-9713..9739 Duplicates Deleted               : ${deletedDuplicatesCount}`);
    console.log(`  • Stale Duplicate locationSkus Cleared                   : ${clearedDuplicateSkuCount}`);
    console.log(`  • Shared UPC Collisions Re-Indexed                       : ${reindexedDuplicateUpcCount}`);
    console.log(`  • Remaining Duplicate UPC Collisions                     : ${remainingUpcCollisions.length}`);
    console.log('  ------------------------------------------------------------------------------');
    console.log('  🔎 Explicit Collision Pair Verification:');
    for (const pair of EXPLICIT_COLLISION_PAIRS) {
        const pDoc = finalSkuMap.get(pair.primarySku);
        const sDoc = finalSkuMap.get(pair.secondarySku);
        console.log(
            `    - ${pair.primarySku}: UPC=${pDoc?.upc || 'MISSING'} ($id=${pDoc?.$id || '-'}, "${(pDoc?.title || '').slice(0, 38)}")\n` +
            `      ${pair.secondarySku}: UPC=${sDoc?.upc || 'MISSING'} ($id=${sDoc?.$id || '-'}, "${(sDoc?.title || '').slice(0, 38)}")`
        );
    }
    console.log('================================================================================');
}

main().catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
});


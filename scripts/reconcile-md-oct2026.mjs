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

const DRY_RUN = !process.argv.includes('--apply');

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
// 1. RFC-4180 MULTILINE-AWARE CSV PARSER
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

// ============================================================================
// 2. FILE DISCOVERY FOR PRODUCTS & PAYOUTS CSVs
// ============================================================================
function getArgValue(flag) {
    const idx = process.argv.indexOf(flag);
    if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
    return null;
}

function findCsvFile(explicitPath, exactName, prefixPattern) {
    const searchDirs = [
        process.cwd(),
        path.join(process.cwd(), 'data'),
        path.join(process.cwd(), 'csv'),
        path.join(process.cwd(), 'exports'),
        path.join(process.cwd(), 'scripts'),
        path.join(os.homedir(), 'Downloads'),
    ];

    if (explicitPath && fs.existsSync(explicitPath)) {
        return path.resolve(explicitPath);
    }

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
// 3. PRE-VERIFIED OCTOBER 2026 MAPPINGS & GUARDRAILS
// ============================================================================
// Pre-verified Single Items sold in Oct 2026 Payouts (must end at status: 'sold', storageLocation: 'MD', quantity: 1)
const PREVERIFIED_OCT_SOLD_SINGLE_BY_SKU = {
    '0EJ0N8': { upc: 'HUCK-1440', saleNum: '224517', gross: 25.00, label: 'NOTATIONS Black Floral Lace Long' },
    '0EJ0O1': { upc: 'HUCK-9456', saleNum: '224185', gross: 35.00, label: 'Black Bat Wing Spiderweb Handbag' },
    '0EJ0N6': { upc: 'HUCK-1502', saleNum: '224156', gross: 55.00, label: 'Madusella Black Quilted Open Front' },
    '0EJ0NZ': { upc: 'HUCK-9457', saleNum: '224075', gross: 30.00, label: 'Black Studded Cross Handbag' },
    '0EJ0OE': { upc: 'HUCK-1787', saleNum: '223898', gross: 45.00, label: "Levi's Faux Leather Moto Jacket (L)" },
    '0EJ0O7': { upc: 'HUCK-1794', saleNum: '223350', gross: 75.00, label: 'Her NYC Punk Moto Jacket (2X)' },
    '0EJ0H9': { upc: 'HUCK-1389', saleNum: '222998', gross: 23.00, label: 'Black Lace Veil Headband' },
    '0EJ0NX': { upc: 'HUCK-1795', saleNum: '222728', gross: 65.00, label: 'Promise NY Textured Fringe Jacket' },
    '0EJ0NY': { upc: 'HUCK-9459', saleNum: '222684', gross: 25.00, label: 'Black Rounded Gothic Mini Handbag (Smaller bag - NOT HUCK-9458)' },
    '0EJ0NI': { upc: 'HUCK-1405', saleNum: '222293', gross: 25.00, label: 'Universal Thread Black Crinkle' },
    '0EJ0N1': { upc: 'HUCK-0158', saleNum: '222148', gross: 75.00, label: 'Tim Burton Nightmare Before' },
    '0EJ0MU': { upc: 'HUCK-8968', saleNum: '221149', gross: 35.00, label: 'Cyberpunk 2020 Chrome 2 The Cyberpunk (Override In-Stock -> Sold)' },
    '0EJ0NO': { upc: 'HUCK-1508', saleNum: '221149', gross: 40.00, label: 'Cyberpunk 2020 Corporation Report' },
    '0EJ0ET': { upc: 'HUCK-1249-c', saleNum: '220889', gross: 15.00, label: 'Tri corner Hat With Bows' },
    '0EJ0JN': { upc: 'HUCK-1422', saleNum: '220507', gross: 40.00, label: "CC Exclusives Women's Purple Cloche Hat" },
    '0EJ0JQ': { upc: 'HUCK-1409', saleNum: '220507', gross: 40.00, label: 'Vintage Style Burgundy Wool Felt Bowler' },
    '0EJ0NA': { upc: 'HUCK-1504', saleNum: '220406', gross: 9.99, label: 'CeCe Black Ruffle Button Front' },
    '0EJ0N3': { upc: 'HUCK-1501', altUpc: 'HUCK-0209', saleNum: '219627', gross: 25.00, label: 'SKEWERS Black Mesh Pentagram' },
    '0EJ0EV': { upc: 'HUCK-1248', saleNum: '219569', gross: 15.00, label: 'Dungeons & Dragons Adventures Outlined Coloring Book' },
    '0EJ0N2': { upc: 'HUCK-0374', saleNum: '219405', gross: 75.00, label: 'Michael Kors Faux Leopard Fur Jacket' },
    '0EJ0N0': { upc: 'HUCK-5064', saleNum: '219403', gross: 140.00, label: 'Betsey Johnson 2006 Vintage Lace Up' },
    '0EJ0GV': { upc: 'HUCK-1369', saleNum: '218424', gross: 35.00, label: 'AD&D 1st Ed. C4: To Find a King' },
    '0EJ0NE': { upc: 'HUCK-0025', saleNum: '218413', gross: 65.00, label: 'Y2K Desigual T Shirt Dress Black' },
    '0EJ0MP': { upc: 'HUCK-2808', saleNum: '218335', gross: 20.00, label: 'CP2020 Solo of Fortune Mag 2013' },
    '0EJ0JR': { upc: 'HUCK-1262', saleNum: '217606', gross: 55.00, label: 'Vintage Brown Suede Western Cowboy Hat' },
    // 4 Non-UPC Single Items in Oct Payouts
    '0EJ0JV': { upc: null, saleNum: '225058', gross: 55.00, label: 'Tripp NYC Black Gothic Punk Alternative Lace-Up Mini Skirt Size 4' },
    '0EJ07F': { upc: null, saleNum: '221996', gross: 40.00, label: 'Goth Mini Skirt - Lips & Crossbones Patch' },
    '0EJ0C7': { upc: null, saleNum: '219981', gross: 70.00, label: 'Frank Frazetta ICON A Retrospective Art Book' },
    '0EJ0BD': { upc: null, saleNum: '218369', gross: 10.00, label: 'Air Land and Sea Game' },
};

// 14 Biggie & Birdie (BB-) SKUs sold in Oct 2026 Payouts
const PREVERIFIED_OCT_BB_SKUS = new Set([
    '0EJ0HN', '0EJ0HQ', '0EJ0HX', '0EJ0IH', '0EJ0IJ', '0EJ0IL', '0EJ0IN',
    '0EJ0IT', '0EJ0IU', '0EJ0IV', '0EJ0J5', '0EJ0J8', '0EJ0KA', '0EJ0LM',
]);

// Pre-verified Booth Bin (Multi-Qty) Lots active in Oct 2026
// Includes explicit per-unit cost basis rules (Fix #3) and altUpc support (Fix #1)
const PREVERIFIED_MULTI_QTY_BINS = {
    '0EJ0H5': {
        upc: 'HUCK-1425',
        altUpc: 'HUCK-1380',
        octUnitsSold: 4,
        expectedRemainingQty: 3,
        unitPrice: 95.00,
        unitCostOverride: 22.83,
        totalUnitsInLot: null,
        label: 'Frank Frazetta Fantasy Art',
    },
    '0EJ0FR': {
        upc: 'HUCK-1309',
        octUnitsSold: 2,
        expectedRemainingQty: 12,
        unitPrice: 15.00,
        unitCostOverride: 4.14,
        totalUnitsInLot: null,
        label: 'HMM Reader',
    },
    '0EJ0FQ': {
        upc: 'HUCK-1308',
        octUnitsSold: 2,
        expectedRemainingQty: 10,
        unitPrice: 25.00,
        unitCostOverride: 0.46,
        totalUnitsInLot: null,
        label: 'HMM Mid-Tier',
    },
    '0EJ0MN': {
        upc: 'HUCK-1323',
        octUnitsSold: 1,
        expectedRemainingQty: 3,
        unitPrice: 35.00,
        totalUnitsInLot: 4, // 4-book lot, lot cost $17.82 -> $4.46/unit
        unitCostOverride: Number((17.82 / 4).toFixed(2)),
        label: 'Assorted TTRPG Dungeons & Dragons 5e Rules Hardcover.',
    },
    '0EJ0EC': {
        upc: 'HUCK-0113',
        octUnitsSold: 1,
        expectedRemainingQty: 14,
        unitPrice: 10.00,
        unitCostOverride: 1.25,
        totalUnitsInLot: null,
        label: "Huck's TTRPG Themed Paperback Novels",
    },
    '0EJ0JK': {
        upc: 'HUCK-1460',
        octUnitsSold: 1,
        expectedRemainingQty: 43,
        unitPrice: 10.00,
        totalUnitsInLot: 44, // 44-book lot, lot cost $35.74 -> $0.81/unit
        unitCostOverride: Number((35.74 / 44).toFixed(2)),
        label: 'Startrek/SciFi Paperbacks',
    },
    '0EJ0NQ': {
        upc: 'HUCK-9455',
        octUnitsSold: 1,
        expectedRemainingQty: 8,
        unitPrice: 10.00,
        totalUnitsInLot: 9, // 9-item lot, lot cost $23.45 -> $2.61/unit
        unitCostOverride: Number((23.45 / 9).toFixed(2)),
        label: 'Vintage Star Trek Book & Mag Lot',
    },
    '0EJ07M': {
        upc: null,
        octUnitsSold: 4,
        expectedRemainingQty: 33,
        unitPrice: 15.00,
        unitCostOverride: null,
        totalUnitsInLot: null,
        label: 'Shadowrun RPG 2e/3e Source book',
    },
    '0EJ09E': {
        upc: 'HUCK-0296',
        octUnitsSold: 1,
        expectedRemainingQty: 2,
        unitPrice: 15.00,
        totalUnitsInLot: 3, // 3-book lot, lot cost $12.47 -> $4.16/unit
        unitCostOverride: Number((12.47 / 3).toFixed(2)),
        label: 'Vintage Paperback Books J.R.R. Tolkien',
    },
};

// ============================================================================
// 4. HELPERS, NAMESPACE ISOLATION & APPWRITE GUARDRAILS
// ============================================================================
function normalizeSku(raw) {
    return String(raw || '').trim().replace(/^'+/, '').toUpperCase();
}

function normalizeUpc(raw) {
    const val = String(raw || '').trim().replace(/^'+/, '');
    if (!val) return '';
    return val.toUpperCase();
}

function parseMoney(raw) {
    if (raw === undefined || raw === null || raw === '') return 0;
    const cleaned = String(raw).replace(/[^0-9.-]/g, '');
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
}

function fmtMoney(val) {
    return `$${Number(val ?? 0).toFixed(2)}`;
}

function normalizeTitleForMatch(str) {
    return String(str || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

/**
 * Computes token/character similarity between two normalized titles (0..1)
 */
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

/**
 * Fix #2: Strict Namespace Check for B&B (Biggie & Birdie) CSV rows & DB items
 */
function isBbRow({ sku, upc, title, raw }) {
    const normSku = normalizeSku(sku);
    const normUpc = normalizeUpc(upc);
    const rawTitle = String(title || '').trim();
    if (PREVERIFIED_OCT_BB_SKUS.has(normSku)) return true;
    if (normUpc.startsWith('BB-')) return true;
    if (/^B\s*&\s*B\b/i.test(rawTitle)) return true;
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
    if (upc.startsWith('BB-')) return true;
    const title = String(item.title || item.identity || '').trim();
    if (/^B\s*&\s*B\b/i.test(title)) return true;
    const sku = normalizeSku(item.locationSku);
    if (PREVERIFIED_OCT_BB_SKUS.has(sku)) return true;
    return false;
}

/**
 * Fix #3: Resolves Per-Unit Cost Basis for Multi-Qty Booth Bins vs Single Items
 */
function resolveUnitCost(dbItem, sku) {
    const normSku = normalizeSku(sku);
    const binConfig = PREVERIFIED_MULTI_QTY_BINS[normSku];
    if (binConfig) {
        if (binConfig.unitCostOverride !== null && binConfig.unitCostOverride !== undefined) {
            return Number(binConfig.unitCostOverride);
        }
        const rawCost = Number(dbItem?.cost ?? dbItem?.purchasePrice ?? 0);
        if (binConfig.totalUnitsInLot && binConfig.totalUnitsInLot > 1 && rawCost > 0) {
            return Number((rawCost / binConfig.totalUnitsInLot).toFixed(2));
        }
        return Number(rawCost.toFixed(2));
    }
    return Number(Number(dbItem?.cost ?? dbItem?.purchasePrice ?? 0).toFixed(2));
}

/**
 * Enforces Appwrite Schema Laws on every item update payload:
 * - Never write quantity: 0 (must be >= 1)
 * - Never send isMultiQty
 * - Never write Base64 data: strings
 */
function assertSafeItemPayload(payload, contextLabel) {
    if ('isMultiQty' in payload) {
        throw new Error(`[SCHEMA VIOLATION] ${contextLabel}: Attempted to send isMultiQty to Appwrite!`);
    }
    if (payload.quantity !== undefined && (!Number.isInteger(payload.quantity) || payload.quantity < 1)) {
        throw new Error(`[SCHEMA VIOLATION] ${contextLabel}: Invalid quantity=${payload.quantity} (never write quantity < 1)!`);
    }
    for (const [k, v] of Object.entries(payload)) {
        if (typeof v === 'string' && v.trim().startsWith('data:')) {
            throw new Error(`[SCHEMA VIOLATION] ${contextLabel}: Field "${k}" contains Base64 data: URI!`);
        }
    }
}

/**
 * Co-op 70/30 Waterfall Math:
 * 1) 15% Memory Den Venue Fee (or exact Payouts difference Gross - Net)
 * 2) 100% Curator Cost Basis Recouped
 * 3) Net Surplus split 70% Curator / 30% Commons Pool (if > 0)
 */
function computeWaterfall(grossAmount, netPayout, unitCostBasis) {
    const gross = Number(grossAmount ?? 0);
    const net = Number(netPayout ?? gross * 0.85);
    const venueFee = Number((gross - net).toFixed(2));
    const cost = Math.max(0, Number(unitCostBasis ?? 0));
    const costRecouped = Math.min(net, cost);
    const netSurplus = Math.max(0, Number((net - cost).toFixed(2)));
    const curatorShare70 = Number((netSurplus * 0.70).toFixed(2));
    const commonsPool30 = Number((netSurplus - curatorShare70).toFixed(2));
    return {
        gross,
        venueFee,
        net,
        cost,
        costRecouped,
        netSurplus,
        curatorShare70,
        commonsPool30,
    };
}

async function fetchAllDocuments(collectionId) {
    const all = [];
    let cursor = null;
    while (true) {
        const queries = [Query.orderDesc('$id'), Query.limit(100)];
        if (cursor) queries.push(Query.cursorAfter(cursor));
        const res = await db.listDocuments(DB_ID, collectionId, queries);
        if (!res.documents || res.documents.length === 0) break;
        all.push(...res.documents);
        cursor = res.documents[res.documents.length - 1].$id;
        if (res.documents.length < 100 || all.length >= res.total) break;
    }
    return all;
}

// ============================================================================
// 5. MAIN RECONCILIATION ENGINE
// ============================================================================
async function main() {
    console.log('================================================================================');
    console.log(`🔮 MEMORY DEN (#0EJ) OCT 2026 RECONCILIATION — ${DRY_RUN ? '🛡️ DRY-RUN MODE (NO DB WRITES)' : '🚀 APPLY MODE (LIVE WRITES)'}`);
    console.log('================================================================================\n');

    const productsPath = findCsvFile(
        getArgValue('--products'),
        'Products-2026-10-30 22_34_38.csv',
        /^Products-.*\.csv$/i
    );
    const payoutsPath = findCsvFile(
        getArgValue('--payouts'),
        'Payouts Michael Stanley - 2026-10-30T22_29_03.919Z.csv',
        /^Payouts.*\.csv$/i
    );

    if (!productsPath) {
        console.error('❌ Could not locate Products-*.csv in workspace or ~/Downloads. Pass --products "<path>".');
        process.exit(1);
    }
    if (!payoutsPath) {
        console.error('❌ Could not locate Payouts *.csv in workspace or ~/Downloads. Pass --payouts "<path>".');
        process.exit(1);
    }

    console.log(`📄 Products CSV : ${productsPath}`);
    console.log(`📄 Payouts CSV  : ${payoutsPath}\n`);

    const productsRows = parseCsvRfc4180(fs.readFileSync(productsPath, 'utf8'));
    const payoutsRows = parseCsvRfc4180(fs.readFileSync(payoutsPath, 'utf8'));

    console.log(`📊 Parsed Products CSV rows : ${productsRows.length}`);
    console.log(`📊 Parsed Payouts CSV rows  : ${payoutsRows.length}\n`);

    // Fetch existing DB items and sales
    const [dbItems, dbSales] = await Promise.all([
        fetchAllDocuments('items'),
        fetchAllDocuments('sales'),
    ]);

    console.log(`🗄️  Loaded resale_db.items : ${dbItems.length}`);
    console.log(`🗄️  Loaded resale_db.sales : ${dbSales.length}\n`);

    // Build lookup indexes on resale_db.items
    const itemsBySku = new Map();       // Normalized 0EJ SKU -> Item[]
    const itemsByUpc = new Map();       // Uppercase UPC (e.g. HUCK-1440) -> Item[]
    const itemsByNormTitle = new Map(); // Normalized title -> Item[]

    for (const item of dbItems) {
        const sku = normalizeSku(item.locationSku);
        if (sku) {
            if (!itemsBySku.has(sku)) itemsBySku.set(sku, []);
            itemsBySku.get(sku).push(item);
        }
        const upc = normalizeUpc(item.upc);
        if (upc) {
            if (!itemsByUpc.has(upc)) itemsByUpc.set(upc, []);
            itemsByUpc.get(upc).push(item);
        }
        const normTitle = normalizeTitleForMatch(item.title || item.identity);
        if (normTitle) {
            if (!itemsByNormTitle.has(normTitle)) itemsByNormTitle.set(normTitle, []);
            itemsByNormTitle.get(normTitle).push(item);
        }
    }

    // Index Products rows by normalized SKU
    const productBySku = new Map();
    const productsList = [];
    for (const row of productsRows) {
        const sku = normalizeSku(row['SKU'] || row['sku']);
        const title = String(row['Item'] || row['Title'] || row['Name'] || '').trim();
        const upcRaw = String(row['UPC'] || row['upc'] || '').trim();
        const invState = String(row['Inventory'] || row['Status'] || '').trim();
        const qtyRaw = Number(row['Quantity'] ?? row['Qty'] ?? 1);
        const price = parseMoney(row['Price'] ?? row['Aged Price']);
        const isBb = isBbRow({ sku, upc: upcRaw, title, raw: row });

        const record = {
            raw: row,
            sku,
            title,
            normTitle: normalizeTitleForMatch(title),
            upc: normalizeUpc(upcRaw),
            inventoryState: invState, // 'In Stock' | 'Sold' | 'Paid'
            quantity: Number.isFinite(qtyRaw) ? qtyRaw : 1,
            price,
            isBb,
        };
        if (sku) productBySku.set(sku, record);
        productsList.push(record);
    }

    // Track DB items already claimed by a canonical 0EJ SKU so another CSV row can NEVER overwrite them!
    const claimedItemIdToSku = new Map(); // dbItem.$id -> sku
    const multiBinResolvedBySku = new Map(); // sku -> dbItem

    // Pre-resolve the 9 Multi-Qty Booth Bins FIRST so their DB documents are locked to their bin SKU (Fix #1)
    // Priority: 1) Explicit binConfig.upc (e.g. HUCK-1309 for 0EJ0FR), 2) binConfig.altUpc, 3) placed/multi-qty SKU match, 4) title match
    for (const [binSku, binConfig] of Object.entries(PREVERIFIED_MULTI_QTY_BINS)) {
        let foundBinItem = null;
        if (binConfig.upc && itemsByUpc.has(normalizeUpc(binConfig.upc))) {
            foundBinItem = itemsByUpc.get(normalizeUpc(binConfig.upc))[0];
        }
        if (!foundBinItem && binConfig.altUpc && itemsByUpc.has(normalizeUpc(binConfig.altUpc))) {
            foundBinItem = itemsByUpc.get(normalizeUpc(binConfig.altUpc))[0];
        }
        if (!foundBinItem && itemsBySku.has(binSku)) {
            const skuCandidates = itemsBySku.get(binSku);
            foundBinItem = skuCandidates.find(c => c.status === 'placed' && Number(c.quantity ?? 1) > 1)
                || skuCandidates.find(c => c.status === 'placed')
                || skuCandidates[0];
        }
        if (!foundBinItem) {
            const normLabel = normalizeTitleForMatch(binConfig.label);
            if (itemsByNormTitle.has(normLabel)) {
                foundBinItem = itemsByNormTitle.get(normLabel)[0];
            } else {
                for (const [candTitle, docs] of itemsByNormTitle.entries()) {
                    if (candTitle.startsWith(normLabel) || normLabel.startsWith(candTitle)) {
                        foundBinItem = docs[0];
                        break;
                    }
                }
            }
        }
        if (foundBinItem) {
            multiBinResolvedBySku.set(binSku, foundBinItem);
            claimedItemIdToSku.set(foundBinItem.$id, binSku);
        }
    }

    // Helper to match a DB item with strict Namespace Isolation (Fix #2) & Fuzzy Guardrails (Fix #4)
    function matchDbItem({ sku, upc, title, price, raw, allowPrefixForPayout = false }) {
        const normSku = normalizeSku(sku);
        const normUpc = normalizeUpc(upc);
        const rowIsBb = isBbRow({ sku: normSku, upc: normUpc, title, raw });

        const canUseCandidate = (cand) => {
            if (!cand) return false;
            // Enforce strict B&B vs HUCK/PDXGL namespace isolation (Fix #2)
            const candIsBb = isBbDbItem(cand);
            if (rowIsBb !== candIsBb) return false;
            // Prevent stealing a DB item already locked to a different 0EJ SKU (Fix #1)
            const existingClaimSku = claimedItemIdToSku.get(cand.$id);
            if (existingClaimSku && existingClaimSku !== normSku) return false;
            return true;
        };

        // 0. If this SKU is one of our 9 pre-resolved Multi-Qty Booth Bins, always return its locked bin item
        if (normSku && multiBinResolvedBySku.has(normSku)) {
            return { item: multiBinResolvedBySku.get(normSku), matchMethod: `LOCKED_MULTI_BIN(${normSku})` };
        }

        // 1. CRITICAL TRAP GUARD: SKU 0EJ0NY must match HUCK-9459 (smaller rounded handbag), NEVER HUCK-9458!
        if (normSku === '0EJ0NY') {
            const huck9459 = (itemsByUpc.get('HUCK-9459') || [])[0];
            if (huck9459) return { item: huck9459, matchMethod: 'PREVERIFIED_TRAP_GUARD(HUCK-9459)' };
        }
        if (normSku === '0EJ0O0') {
            const huck9458 = (itemsByUpc.get('HUCK-9458') || [])[0];
            if (huck9458) return { item: huck9458, matchMethod: 'PREVERIFIED_TRAP_GUARD(HUCK-9458)' };
        }

        // 2. Pre-verified single item UPC override if configured
        const preSingle = PREVERIFIED_OCT_SOLD_SINGLE_BY_SKU[normSku];
        if (preSingle && preSingle.upc) {
            const byPreUpc = (itemsByUpc.get(normalizeUpc(preSingle.upc)) || []).find(canUseCandidate);
            if (byPreUpc) {
                return { item: byPreUpc, matchMethod: `PREVERIFIED_UPC(${preSingle.upc})` };
            }
        }

        // 3. Direct locationSku match in resale_db.items
        if (normSku && itemsBySku.has(normSku)) {
            const cand = itemsBySku.get(normSku).find(canUseCandidate);
            if (cand) return { item: cand, matchMethod: `SKU(${normSku})` };
        }

        // 4. Direct UPC match in resale_db.items
        if (normUpc && itemsByUpc.has(normUpc)) {
            const cand = itemsByUpc.get(normUpc).find(canUseCandidate);
            if (cand) return { item: cand, matchMethod: `UPC(${normUpc})` };
        }

        // 5. Strict Title Matching (Fix #4: Never let short/generic 1-word titles fuzzy match!)
        const normTitle = normalizeTitleForMatch(title);
        if (!normTitle || normTitle.length < 15) {
            return { item: null, matchMethod: 'UNMATCHED_SHORT_TITLE' };
        }

        // 5a. Exact normalized title match (with namespace check + price check if not pre-verified)
        if (itemsByNormTitle.has(normTitle)) {
            const cand = itemsByNormTitle.get(normTitle).find(c => {
                if (!canUseCandidate(c)) return false;
                const dbPrice = Number(c.resalePrice ?? 0);
                if (price > 0 && dbPrice > 0 && !preSingle && Math.abs(dbPrice - price) > 5.01) return false;
                return true;
            });
            if (cand) return { item: cand, matchMethod: 'EXACT_TITLE' };
        }

        // 5b. High-similarity (>= 85%) or Payouts 32-char prefix match
        let bestCand = null;
        let bestScore = 0;
        for (const [candTitle, docs] of itemsByNormTitle.entries()) {
            if (candTitle.length < 15) continue;
            const sim = computeTitleSimilarity(normTitle, candTitle);
            const isPayoutPrefix = allowPrefixForPayout && normTitle.length >= 18 &&
                (candTitle.startsWith(normTitle) || normTitle.startsWith(candTitle));

            if (sim >= 0.85 || isPayoutPrefix) {
                for (const c of docs) {
                    if (!canUseCandidate(c)) continue;
                    const dbPrice = Number(c.resalePrice ?? 0);
                    if (price > 0 && dbPrice > 0 && !preSingle && Math.abs(dbPrice - price) > 5.01) continue;
                    const score = isPayoutPrefix ? Math.max(sim, 0.86) : sim;
                    if (score > bestScore) {
                        bestScore = score;
                        bestCand = c;
                    }
                }
            }
        }

        if (bestCand) {
            return { item: bestCand, matchMethod: `HIGH_SIM_TITLE(${Math.round(bestScore * 100)}%)` };
        }

        return { item: null, matchMethod: 'UNMATCHED' };
    }

    // ============================================================================
    // STEP A: CATALOG & STOCK SYNC PLAN (Products-*.csv -> resale_db.items ONLY)
    // ============================================================================
    const itemUpdatesMap = new Map(); // item.$id -> { item, payload, diffNotes, reasonTag, sku, matchMethod }
    const missingBbItemsToCreate = new Map(); // sku -> { sku, upc, title, price, quantity, status, inventoryState }
    const unmatchedProductsInStock = [];
    const unmatchedProductsSoldPaid = [];

    let productsInStockCount = 0;
    let productsSoldCount = 0;
    let productsPaidCount = 0;

    // Sort productsList so the 9 Multi-Qty Booth Bins and Pre-Verified SKUs process first and lock their DB items
    const sortedProductsList = [...productsList].sort((a, b) => {
        const aPriority = PREVERIFIED_MULTI_QTY_BINS[a.sku] ? 0 : (PREVERIFIED_OCT_SOLD_SINGLE_BY_SKU[a.sku] ? 1 : 2);
        const bPriority = PREVERIFIED_MULTI_QTY_BINS[b.sku] ? 0 : (PREVERIFIED_OCT_SOLD_SINGLE_BY_SKU[b.sku] ? 1 : 2);
        return aPriority - bPriority;
    });

    for (const prod of sortedProductsList) {
        const inv = prod.inventoryState.toLowerCase();
        if (inv === 'in stock') productsInStockCount++;
        else if (inv === 'sold') productsSoldCount++;
        else if (inv === 'paid') productsPaidCount++;

        const { item, matchMethod } = matchDbItem({
            sku: prod.sku,
            upc: prod.upc,
            title: prod.title,
            price: prod.price,
            raw: prod.raw,
            allowPrefixForPayout: false,
        });

        if (!item) {
            // Fix #2: If this is a B&B item missing from resale_db.items, queue a clean BB- item creation
            if (prod.isBb && prod.sku) {
                const targetStatus = (inv === 'sold' || inv === 'paid' || PREVERIFIED_OCT_BB_SKUS.has(prod.sku)) ? 'sold' : 'placed';
                const targetQty = targetStatus === 'sold' ? 1 : Math.max(1, Number(prod.quantity || 1));
                const bbUpc = prod.upc && prod.upc.startsWith('BB-') ? prod.upc : `BB-${prod.sku}`;
                missingBbItemsToCreate.set(prod.sku, {
                    sku: prod.sku,
                    upc: bbUpc,
                    title: prod.title,
                    price: prod.price,
                    quantity: targetQty,
                    status: targetStatus,
                    inventoryState: prod.inventoryState,
                });
            } else if (inv === 'in stock') {
                unmatchedProductsInStock.push(prod);
            } else {
                unmatchedProductsSoldPaid.push(prod);
            }
            continue;
        }

        // Claim this DB item for this SKU so no later row can overwrite it (Fix #1)
        if (prod.sku && !claimedItemIdToSku.has(item.$id)) {
            claimedItemIdToSku.set(item.$id, prod.sku);
        }

        const isMultiBin = Boolean(PREVERIFIED_MULTI_QTY_BINS[prod.sku]);
        const isOverrideSold = !isMultiBin && (prod.sku === '0EJ0MU' || Boolean(PREVERIFIED_OCT_SOLD_SINGLE_BY_SKU[prod.sku]));

        let targetStatus;
        let targetQty;
        let reasonTag;

        if (isMultiBin) {
            // Fix #1: Multi-Qty Booth Bins MUST stay status: 'placed' at MD with CSV Qty from Products (3 for 0EJ0H5)
            targetStatus = 'placed';
            const csvQty = Number(prod.quantity || PREVERIFIED_MULTI_QTY_BINS[prod.sku].expectedRemainingQty || 1);
            targetQty = Math.max(1, csvQty);
            reasonTag = `Multi-Qty Booth Bin (${prod.sku}) -> placed, qty=${targetQty}`;
        } else if (prod.sku === '0EJ0O0' || normalizeUpc(item.upc) === 'HUCK-9458') {
            // Explicit Trap Guard: HUCK-9458 (Larger Gothic Backpack/Shoulder Bag, 0EJ0O0) is IN STOCK at MD
            targetStatus = 'placed';
            targetQty = 1;
            reasonTag = 'TRAP_GUARD: HUCK-9458 (0EJ0O0) stays In Stock (placed, MD, qty=1)';
        } else if (isOverrideSold || inv === 'sold' || inv === 'paid') {
            // Single item sold/paid: status: 'sold', storageLocation: 'MD', quantity: 1 (NEVER 0!)
            targetStatus = 'sold';
            targetQty = 1;
            reasonTag = prod.sku === '0EJ0MU'
                ? 'OCT_PAYOUT_OVERRIDE: HUCK-8968 (0EJ0MU) sold on 2026-10-14 -> status=sold, qty=1'
                : `Products CSV (${prod.inventoryState}) -> status=sold, qty=1`;
        } else {
            // In Stock single or multi-qty item at MD
            targetStatus = 'placed';
            targetQty = Math.max(1, Number(prod.quantity || 1));
            reasonTag = `Products CSV (In Stock) -> status=placed, qty=${targetQty}`;
        }

        const proposedPayload = {};
        const diffNotes = [];

        if (item.status !== targetStatus) {
            proposedPayload.status = targetStatus;
            diffNotes.push(`status: "${item.status || ''}" -> "${targetStatus}"`);
        }
        if (item.storageLocation !== MD_CODE) {
            proposedPayload.storageLocation = MD_CODE;
            diffNotes.push(`storageLocation: "${item.storageLocation || ''}" -> "${MD_CODE}"`);
        }
        if (item.warehouseId !== MD_WAREHOUSE_ID) {
            proposedPayload.warehouseId = MD_WAREHOUSE_ID;
            diffNotes.push(`warehouseId -> "${MD_WAREHOUSE_ID}"`);
        }
        if (prod.sku && normalizeSku(item.locationSku) !== prod.sku) {
            proposedPayload.locationSku = prod.sku;
            diffNotes.push(`locationSku: "${item.locationSku || ''}" -> "${prod.sku}"`);
        }
        if (Number(item.quantity ?? 1) !== targetQty) {
            proposedPayload.quantity = targetQty;
            diffNotes.push(`quantity: ${item.quantity ?? 1} -> ${targetQty}`);
        } else if (targetStatus === 'sold' && (!item.quantity || item.quantity < 1)) {
            proposedPayload.quantity = 1;
            diffNotes.push(`quantity: ${item.quantity} -> 1 (schema law)`);
        }

        if (Object.keys(proposedPayload).length > 0) {
            assertSafeItemPayload(proposedPayload, `Item ${item.$id} (${item.upc || prod.sku})`);
            itemUpdatesMap.set(item.$id, {
                item,
                sku: prod.sku,
                matchMethod,
                payload: proposedPayload,
                diffNotes,
                reasonTag,
            });
        }
    }

    // ============================================================================
    // STEP B: INTERIM OCTOBER 2026 SALES RECONCILIATION (Payouts *.csv)
    // ============================================================================
    const existingSalesByOrderKey = new Map();
    for (const s of dbSales) {
        const orderKey = String(s.orderId || s.soNumber || '').trim();
        if (orderKey) existingSalesByOrderKey.set(orderKey, s);
    }

    const ticketOccurrenceCounter = new Map();
    const payoutLinePlans = [];

    let totalOctGross = 0;
    let totalOctNet = 0;
    let totalOctVenueFee = 0;
    let totalOctCostRecouped = 0;
    let totalOctCurator70 = 0;
    let totalOctCommons30 = 0;

    for (const row of payoutsRows) {
        const rawTitle = String(row['Item'] || '').trim();
        const saleNum = String(row['Sale#'] || row['Sale'] || '').trim();
        const agreedPrice = parseMoney(row['Agreed']);
        const agedPrice = parseMoney(row['Aged Price']);
        const discounts = parseMoney(row['Discounts']);
        const netAmount = parseMoney(row['Amount']);
        const soldDateRaw = String(row['Sold Date'] || row['Sold'] || '').trim();

        const basePrice = agedPrice > 0 ? agedPrice : agreedPrice;
        const grossAmount = basePrice > 0
            ? Number((basePrice - Math.abs(discounts)).toFixed(2))
            : Number((netAmount / 0.85).toFixed(2));

        const occ = (ticketOccurrenceCounter.get(saleNum) || 0) + 1;
        ticketOccurrenceCounter.set(saleNum, occ);
        const dedupOrderKey = `MD-${saleNum}#${occ}`;

        const normPayoutTitle = normalizeTitleForMatch(rawTitle);
        let matchedProduct = null;

        // 1. Match via pre-verified single items where saleNum + title prefix match
        for (const [sku, info] of Object.entries(PREVERIFIED_OCT_SOLD_SINGLE_BY_SKU)) {
            const normInfoLabel = normalizeTitleForMatch(info.label);
            if (info.saleNum === saleNum && (normPayoutTitle.startsWith(normInfoLabel.slice(0, 18)) || normInfoLabel.startsWith(normPayoutTitle.slice(0, 18)))) {
                matchedProduct = productBySku.get(sku) || { sku, upc: info.upc, title: info.label, price: info.gross, isBb: false };
                break;
            }
        }
        // 2. Match via pre-verified 9 Multi-Qty Booth Bins
        if (!matchedProduct) {
            for (const [sku, binInfo] of Object.entries(PREVERIFIED_MULTI_QTY_BINS)) {
                const normBinLabel = normalizeTitleForMatch(binInfo.label);
                if (normPayoutTitle.startsWith(normBinLabel.slice(0, 14)) || normBinLabel.startsWith(normPayoutTitle.slice(0, 14))) {
                    matchedProduct = productBySku.get(sku) || { sku, upc: binInfo.upc, title: binInfo.label, price: binInfo.unitPrice, isBb: false };
                    break;
                }
            }
        }
        // 3. Match against Products CSV rows by normalized title prefix
        if (!matchedProduct) {
            const candidates = productsList.filter(p =>
                p.normTitle && normPayoutTitle && (p.normTitle.startsWith(normPayoutTitle) || normPayoutTitle.startsWith(p.normTitle))
            );
            if (candidates.length === 1) {
                matchedProduct = candidates[0];
            } else if (candidates.length > 1) {
                matchedProduct = candidates.find(c =>
                    (c.inventoryState.toLowerCase() === 'sold' || c.inventoryState.toLowerCase() === 'paid') &&
                    Math.abs(c.price - basePrice) < 0.05
                ) || candidates.find(c => Math.abs(c.price - basePrice) < 0.05) || candidates[0];
            }
        }

        const matchedSku = matchedProduct ? normalizeSku(matchedProduct.sku) : '';
        const matchedUpc = matchedProduct ? normalizeUpc(matchedProduct.upc) : '';
        const isBbItem = isBbRow({ sku: matchedSku, upc: matchedUpc, title: matchedProduct ? matchedProduct.title : rawTitle, raw: matchedProduct?.raw });

        const { item: dbItem, matchMethod } = matchDbItem({
            sku: matchedSku,
            upc: matchedUpc,
            title: matchedProduct ? matchedProduct.title : rawTitle,
            price: basePrice,
            raw: matchedProduct?.raw,
            allowPrefixForPayout: true,
        });

        // Fix #3: Use per-unit cost basis for Multi-Qty Booth Bins, and $0 cost basis for B&B consignment items
        const unitCost = isBbItem ? 0 : resolveUnitCost(dbItem, matchedSku);
        const wf = computeWaterfall(grossAmount, netAmount, unitCost);

        totalOctGross += wf.gross;
        totalOctNet += wf.net;
        totalOctVenueFee += wf.venueFee;
        totalOctCostRecouped += wf.costRecouped;
        totalOctCurator70 += wf.curatorShare70;
        totalOctCommons30 += wf.commonsPool30;

        const existingSale = existingSalesByOrderKey.get(dedupOrderKey) || existingSalesByOrderKey.get(saleNum);
        const isMultiBin = Boolean(PREVERIFIED_MULTI_QTY_BINS[matchedSku]);
        const plannedBbCreate = !dbItem && isBbItem && matchedSku ? missingBbItemsToCreate.get(matchedSku) : null;

        payoutLinePlans.push({
            saleNum,
            occurrence: occ,
            dedupOrderKey,
            soldDateRaw,
            rawTitle,
            sku: matchedSku || '(no SKU)',
            upc: dbItem?.upc || (plannedBbCreate ? plannedBbCreate.upc : (matchedUpc || (isBbItem ? `BB-${matchedSku}` : '(no UPC)'))),
            dbItemId: dbItem?.$id || null,
            willCreateBbItem: Boolean(plannedBbCreate),
            matchMethod,
            isMultiBin,
            isBbItem,
            grossAmount: wf.gross,
            venueFee: wf.venueFee,
            netPayout: wf.net,
            unitCost: wf.cost,
            costRecouped: wf.costRecouped,
            curatorShare70: wf.curatorShare70,
            commonsPool30: wf.commonsPool30,
            alreadyInSalesCollection: Boolean(existingSale),
        });
    }

    // ============================================================================
    // STEP C: EXPLICIT AUDIT CHECKS (HUCK-9458 vs HUCK-9459, HUCK-1425 vs HUCK-1380, B&B Isolation)
    // ============================================================================
    console.log('================================================================================');
    console.log('🔍 1. EXPLICIT SAFETY, TRAP & DUPLICATE CHECKS');
    console.log('================================================================================');

    const doc9459 = (itemsByUpc.get('HUCK-9459') || [])[0];
    const doc9458 = (itemsByUpc.get('HUCK-9458') || [])[0];
    console.log(`  • HUCK-9459 (0EJ0NY — Smaller Rounded Handbag, Sold #222684):`);
    if (doc9459) {
        const planned9459 = itemUpdatesMap.get(doc9459.$id);
        console.log(`      Found $id=${doc9459.$id} | current status="${doc9459.status}" loc="${doc9459.storageLocation}" sku="${doc9459.locationSku}" qty=${doc9459.quantity}`);
        console.log(`      Planned Update: ${planned9459 ? JSON.stringify(planned9459.payload) : 'Already synced (status=sold, loc=MD, qty=1)'}`);
    }

    console.log(`  • HUCK-9458 (0EJ0O0 — Larger Gothic Backpack/Shoulder Bag, TRAP GUARD — MUST STAY IN STOCK):`);
    if (doc9458) {
        const planned9458 = itemUpdatesMap.get(doc9458.$id);
        console.log(`      Found $id=${doc9458.$id} | current status="${doc9458.status}" loc="${doc9458.storageLocation}" sku="${doc9458.locationSku}" qty=${doc9458.quantity}`);
        console.log(`      Planned Update: ${planned9458 ? JSON.stringify(planned9458.payload) : 'Stays status=placed, loc=MD, qty=1 (NOT marked sold!)'}`);
    }

    const doc1425 = (itemsByUpc.get('HUCK-1425') || [])[0];
    const doc1380 = (itemsByUpc.get('HUCK-1380') || [])[0];
    console.log(`  • Frank Frazetta Fantasy Art (0EJ0H5 — Multi-Qty Booth Bin) Check (HUCK-1425 vs HUCK-1380):`);
    console.log(`      HUCK-1425: ${doc1425 ? `$id=${doc1425.$id} status="${doc1425.status}" loc="${doc1425.storageLocation}" sku="${doc1425.locationSku}" qty=${doc1425.quantity} cost=${doc1425.cost} title="${doc1425.title}"` : 'Not found in resale_db.items'}`);
    console.log(`      HUCK-1380: ${doc1380 ? `$id=${doc1380.$id} status="${doc1380.status}" loc="${doc1380.storageLocation}" sku="${doc1380.locationSku}" qty=${doc1380.quantity} cost=${doc1380.cost} title="${doc1380.title}"` : 'Not found in resale_db.items'}`);

    const doc8968 = (itemsByUpc.get('HUCK-8968') || [])[0];
    console.log(`  • HUCK-8968 (0EJ0MU — Cyberpunk 2020 Chrome 2, Sold in Oct Payouts #221149 despite Products "In Stock"):`);
    if (doc8968) {
        const planned8968 = itemUpdatesMap.get(doc8968.$id);
        console.log(`      Found $id=${doc8968.$id} | current status="${doc8968.status}" loc="${doc8968.storageLocation}" sku="${doc8968.locationSku}" qty=${doc8968.quantity}`);
        console.log(`      Planned Update: ${planned8968 ? JSON.stringify(planned8968.payload) : 'Already status=sold, loc=MD, qty=1'}`);
    }

    const doc1501 = (itemsByUpc.get('HUCK-1501') || [])[0];
    const doc0209 = (itemsByUpc.get('HUCK-0209') || [])[0];
    console.log(`  • SKEWERS Black Mesh Pentagram (0EJ0N3 — Sold #219627) Duplicate Check:`);
    console.log(`      HUCK-1501: ${doc1501 ? `$id=${doc1501.$id} status="${doc1501.status}" loc="${doc1501.storageLocation}" sku="${doc1501.locationSku}" title="${doc1501.title}"` : 'Not found'}`);
    console.log(`      HUCK-0209: ${doc0209 ? `$id=${doc0209.$id} status="${doc0209.status}" loc="${doc0209.storageLocation}" sku="${doc0209.locationSku}" title="${doc0209.title}"` : 'Not found in resale_db.items'}`);

    console.log('\n================================================================================');
    console.log('📦 2. PRE-VERIFIED MULTI-QTY BOOTH BINS (9 LOTS — ALL STAY status="placed")');
    console.log('================================================================================');
    for (const [sku, bin] of Object.entries(PREVERIFIED_MULTI_QTY_BINS)) {
        const prodRow = productBySku.get(sku);
        const item = multiBinResolvedBySku.get(sku);
        const planned = item ? itemUpdatesMap.get(item.$id) : null;
        const unitCost = resolveUnitCost(item, sku);
        console.log(
            `  • [${sku}] ${(item?.upc || bin.upc || '(title)').padEnd(11)} | ${bin.label.slice(0, 34).padEnd(34)} | ` +
            `OctSold:${String(bin.octUnitsSold).padStart(2)} | CSVQty:${String(prodRow ? prodRow.quantity : '?').padStart(2)} | ` +
            `DBCost:${fmtMoney(item?.cost ?? 0).padStart(6)} -> UnitCost:${fmtMoney(unitCost).padStart(6)} | ` +
            `DB: ${item ? `${item.$id} (curStatus=${item.status}, curQty=${item.quantity ?? 1})` : '❌ UNMATCHED'}` +
            (planned ? ` -> UPDATE: ${JSON.stringify(planned.payload)}` : ' -> (Already in sync)')
        );
    }

    console.log('\n================================================================================');
    console.log('📋 3. PRODUCTS-*.CSV CATALOG & STOCK SYNC SUMMARY (resale_db.items ONLY)');
    console.log('================================================================================');
    console.log(`  • Total Products CSV Rows           : ${productsRows.length}`);
    console.log(`      - Inventory = "In Stock"        : ${productsInStockCount}`);
    console.log(`      - Inventory = "Sold"            : ${productsSoldCount}`);
    console.log(`      - Inventory = "Paid"            : ${productsPaidCount}`);
    console.log(`  • Total DB Items Requiring Updates  : ${itemUpdatesMap.size}`);
    console.log(`  • Missing B&B (BB-) Items to Create : ${missingBbItemsToCreate.size}`);
    console.log(`  • Unmatched "In Stock" Products     : ${unmatchedProductsInStock.length}`);
    console.log(`  • Unmatched "Sold/Paid" Products    : ${unmatchedProductsSoldPaid.length}`);

    let toPlacedMdCount = 0;
    let toSoldMdCount = 0;
    for (const u of itemUpdatesMap.values()) {
        const finalStatus = u.payload.status || u.item.status;
        if (finalStatus === 'placed') toPlacedMdCount++;
        else if (finalStatus === 'sold') toSoldMdCount++;
    }
    console.log(`      - Updating to placed @ MD       : ${toPlacedMdCount}`);
    console.log(`      - Updating to sold @ MD (qty=1) : ${toSoldMdCount}`);

    if (missingBbItemsToCreate.size > 0) {
        console.log(`\n  🏷️  B&B (Biggie & Birdie) Items Missing in resale_db.items (Isolated from HUCK- — Will Create BB-*):`);
        for (const bb of missingBbItemsToCreate.values()) {
            console.log(`      [${bb.sku}] UPC="${bb.upc}" Status="${bb.status}" Qty=${bb.quantity} Price=${fmtMoney(bb.price)} | "${bb.title}"`);
        }
    }

    if (unmatchedProductsInStock.length > 0) {
        console.log(`\n  ⚠️ Unmatched Non-B&B "In Stock" Rows in Products CSV (${unmatchedProductsInStock.length}):`);
        for (const p of unmatchedProductsInStock.slice(0, 25)) {
            console.log(`      [${p.sku}] UPC="${p.upc || '-'}" Qty=${p.quantity} Price=${fmtMoney(p.price)} | "${p.title}"`);
        }
    }

    console.log('\n================================================================================');
    console.log('💵 4. OCTOBER 2026 INTERIM PAYOUTS SUMMARY (60 ROWS — CO-OP 70/30 WATERFALL)');
    console.log('================================================================================');
    const matchedPayoutLines = payoutLinePlans.filter(p => p.dbItemId !== null);
    const plannedBbPayoutLines = payoutLinePlans.filter(p => p.dbItemId === null && p.willCreateBbItem);
    const unmatchedPayoutLines = payoutLinePlans.filter(p => p.dbItemId === null && !p.willCreateBbItem);
    const multiBinPayoutLines = payoutLinePlans.filter(p => p.isMultiBin);
    const bbPayoutLines = payoutLinePlans.filter(p => p.isBbItem);
    const newSalesToCreate = payoutLinePlans.filter(p => !p.alreadyInSalesCollection);

    console.log(`  • Total Oct 2026 Payouts Lines      : ${payoutLinePlans.length}`);
    console.log(`      - Matched to existing DB item   : ${matchedPayoutLines.length}`);
    console.log(`      - Matched to new BB- item       : ${plannedBbPayoutLines.length}`);
    console.log(`      - Multi-Qty Booth Bin Line Hits : ${multiBinPayoutLines.length} lines (across 9 bins)`);
    console.log(`      - Biggie & Birdie (BB-) Lines   : ${bbPayoutLines.length} lines (0 false HUCK- matches!)`);
    console.log(`      - Unmatched in resale_db.items  : ${unmatchedPayoutLines.length} lines`);
    console.log(`      - New sales records to create   : ${newSalesToCreate.length} (Already in resale_db.sales: ${payoutLinePlans.length - newSalesToCreate.length})`);
    console.log('  ------------------------------------------------------------------------------');
    console.log(`  • Gross Sales (Oct 2026 Interim)    : ${fmtMoney(totalOctGross)}`);
    console.log(`  • Memory Den 15% Commission Fee     : ${fmtMoney(totalOctVenueFee)}`);
    console.log(`  • Net Check Payout (Ricochet)       : ${fmtMoney(totalOctNet)}`);
    console.log(`  • Step 2: Cost Basis Recouped (100%): ${fmtMoney(totalOctCostRecouped)}`);
    console.log(`  • Step 3a: Curator 70% Share        : ${fmtMoney(totalOctCurator70)}`);
    console.log(`  • Step 3b: Commons Pool 30% Share   : ${fmtMoney(totalOctCommons30)}`);

    console.log('\n  📜 All 60 October 2026 Payout Lines Preview:');
    for (const line of payoutLinePlans) {
        const tag = line.isMultiBin ? '[BIN]' : line.isBbItem ? '[BB-]' : '[1x ]';
        const dbStatusStr = line.dbItemId
            ? `✅ ${line.dbItemId}`
            : (line.willCreateBbItem ? `🆕 [BB- MISSING IN DB — WILL CREATE ${line.upc}]` : '⚠️ NO_DB_ITEM');
        console.log(
            `    ${line.dedupOrderKey.padEnd(12)} | ${line.soldDateRaw.padEnd(10)} | ${tag} ${line.sku.padEnd(7)} | ` +
            `${String(line.upc).padEnd(12)} | Gross ${fmtMoney(line.grossAmount).padStart(7)} -> Net ${fmtMoney(line.netPayout).padStart(7)} | ` +
            `Cost ${fmtMoney(line.unitCost).padStart(6)} | ${line.rawTitle.slice(0, 32).padEnd(32)} | ${dbStatusStr}`
        );
    }

    if (DRY_RUN) {
        console.log('\n================================================================================');
        console.log('✅ DRY RUN COMPLETE — Zero database writes were performed.');
        console.log('👉 Review the summary above. To apply these updates to resale_db, run:');
        console.log('   node scripts/reconcile-md-oct2026.mjs --apply');
        console.log('================================================================================');
        return;
    }

    // ============================================================================
    // STEP D: LIVE EXECUTION (--apply mode ONLY)
    // ============================================================================
    // 1. Create any missing BB- items first so Payouts lines can link to their $id
    const createdBbItemIdBySku = new Map();
    if (missingBbItemsToCreate.size > 0) {
        console.log(`\n🚀 Creating ${missingBbItemsToCreate.size} missing B&B (BB-) items in resale_db.items...`);
        for (const bb of missingBbItemsToCreate.values()) {
            const newBbPayload = {
                title: bb.title,
                identity: bb.title,
                upc: bb.upc,
                locationSku: bb.sku,
                storageLocation: MD_CODE,
                warehouseId: MD_WAREHOUSE_ID,
                status: bb.status,
                quantity: bb.quantity,
                cost: 0,
                resalePrice: Number(bb.price ?? 0),
                tenantId: 'huck',
            };
            assertSafeItemPayload(newBbPayload, `Create BB- Item ${bb.sku}`);
            const createdDoc = await db.createDocument(DB_ID, 'items', ID.unique(), newBbPayload);
            createdBbItemIdBySku.set(bb.sku, createdDoc.$id);
        }
        console.log(`✅ Created ${createdBbItemIdBySku.size} B&B items.`);
    }

    // 2. Apply updates to existing resale_db.items
    console.log('\n🚀 Applying updates to resale_db.items...');
    let updatedItemsCount = 0;
    for (const { item, payload, sku } of itemUpdatesMap.values()) {
        assertSafeItemPayload(payload, `Live Update ${item.$id} (${sku})`);
        await db.updateDocument(DB_ID, 'items', item.$id, payload);
        updatedItemsCount++;
        if (updatedItemsCount % 25 === 0) {
            console.log(`  ... updated ${updatedItemsCount} / ${itemUpdatesMap.size} items`);
        }
    }
    console.log(`✅ Updated ${updatedItemsCount} items in resale_db.items.`);

    // 3. Create new interim October 2026 sales records in resale_db.sales
    console.log('\n🚀 Creating new interim October 2026 sales records in resale_db.sales...');
    let createdSalesCount = 0;
    for (const line of newSalesToCreate) {
        const saleDoc = await db.createDocument(DB_ID, 'sales', ID.unique(), {
            soNumber: `SO-${line.dedupOrderKey}`,
            warehouseId: MD_WAREHOUSE_ID,
            orderId: line.dedupOrderKey,
            saleDate: line.soldDateRaw ? new Date(line.soldDateRaw).toISOString() : new Date().toISOString(),
            status: 'completed',
            grossAmount: Number(line.grossAmount ?? 0),
            commissionFee: Number(line.venueFee ?? 0),
            shippingCost: 0,
            shippingCharged: 0,
            netPayout: Number(line.netPayout ?? 0),
            tenantId: 'huck',
        });
        createdSalesCount++;

        const targetItemId = line.dbItemId || createdBbItemIdBySku.get(line.sku) || null;
        // Link single sold items (NEVER Multi-Qty Booth Bins!) to saleId
        if (targetItemId && !line.isMultiBin) {
            await db.updateDocument(DB_ID, 'items', targetItemId, {
                saleId: saleDoc.$id,
                soldPrice: Number(line.grossAmount ?? 0),
                commissionPaid: Number(line.venueFee ?? 0),
            });
        }
    }
    console.log(`✅ Created ${createdSalesCount} sales records in resale_db.sales.`);
}

main().catch(err => {
    console.error('❌ Reconciliation failed:', err);
    process.exit(1);
});

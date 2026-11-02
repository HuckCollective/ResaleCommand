/**
 * Resale Command - Multi-Org Sales Partitioning & Reconciliation Engine
 * Automatically partitions POS and venue payout CSV rows into:
 * 1. Primary Org Bucket (HUCK-)
 * 2. Partner Org Buckets (PDXGL-, etc.)
 * 3. Unassigned / Store SKU Bucket (0EJ08G, unbarcoded, numeric)
 * 
 * Guarantees zero dropped or skipped sales rows!
 */

import { extractOrgPrefix, normalizeOrgPrefix } from './inventoryUpc';

export interface OrgSalesBucket {
    orgKey: string;           // 'HUCK', 'PDXGL', 'UNASSIGNED'
    prefix: string;           // 'HUCK-', 'PDXGL-', 'NONE'
    displayName: string;      // e.g. "Huck Collective", "PDX Game Library", "Unassigned Store Sales"
    rows: any[];              // Raw CSV sales rows belonging to this bucket
    matchedItems: any[];      // Matched Appwrite items
    unmatchedRows: any[];     // Rows not yet matched to an Appwrite item
    grossSales: number;       // Gross sticker sales
    consignorPayout: number;  // Net take-home after commission
    storeCommission: number;  // Store fee (e.g. 15%)
    itemCount: number;        // Units sold
}

export interface PartitionedSalesResult {
    totalRows: number;
    totalGross: number;
    totalPayout: number;
    totalCommission: number;
    buckets: Record<string, OrgSalesBucket>;
    allBuckets: OrgSalesBucket[];
}

function createEmptyBucket(orgKey: string, prefix: string, displayName: string): OrgSalesBucket {
    return {
        orgKey,
        prefix,
        displayName,
        rows: [],
        matchedItems: [],
        unmatchedRows: [],
        grossSales: 0,
        consignorPayout: 0,
        storeCommission: 0,
        itemCount: 0
    };
}

/**
 * Partitions incoming sales report rows into discrete org buckets.
 * No row is ever skipped or lost.
 */
export function partitionSalesByOrg(
    csvRows: any[],
    appwriteItems: any[] = [],
    configuredPrefixes: string[] = ['HUCK-', 'PDXGL-', 'BB-']
): PartitionedSalesResult {
    const buckets: Record<string, OrgSalesBucket> = {
        HUCK: createEmptyBucket('HUCK', 'HUCK-', 'Huck Collective (HUCK-)'),
        PDXGL: createEmptyBucket('PDXGL', 'PDXGL-', 'PDX Game Library'),
        BB: createEmptyBucket('BB', 'BB-', 'B&B Consignment (PDXGL Sub-Client)'),
        UNASSIGNED: createEmptyBucket('UNASSIGNED', 'NONE', 'Unassigned / Store SKUs')
    };

    configuredPrefixes.forEach(p => {
        const root = p.replace(/[-_]$/, '').toUpperCase();
        if (!buckets[root]) {
            buckets[root] = createEmptyBucket(root, normalizeOrgPrefix(p), `${root} Partner`);
        }
    });

    // Helper: Dereference combined/deconstructed child items to their active Parent Lot
    const dereferenceParentLot = (item: any): any => {
        if (!item) return null;
        const s = String(item?.status || '').toLowerCase().trim();
        if ((s === 'combined' || s === 'deconstructed') && item.parentLotId) {
            const parent = appwriteItems.find(p => p.$id === item.parentLotId);
            if (parent) return dereferenceParentLot(parent);
        }
        return item;
    };

    // Filter out unacquired pre-buy items (tracked, draft, scouted) so they are immune to sales attribution
    const eligibleItems = appwriteItems.filter(item => {
        const s = String(item?.status || '').toLowerCase().trim();
        return s !== 'tracked' && s !== 'draft' && s !== 'scouted';
    });

    // Title search candidates: strictly exclude 'combined' and 'deconstructed' items
    const titleEligibleItems = eligibleItems.filter(item => {
        const s = String(item?.status || '').toLowerCase().trim();
        return s !== 'combined' && s !== 'deconstructed';
    });

    // Index Appwrite items by UPC, locationSku, and Appwrite $id
    const appwriteByCode = new Map<string, any>();
    eligibleItems.forEach(item => {
        if (item.upc) appwriteByCode.set(item.upc.trim().toUpperCase(), item);
        if (item.locationSku) {
            const cleanLoc = item.locationSku.trim().replace(/^['"]+/, '').toUpperCase();
            appwriteByCode.set(cleanLoc, item);
        }
        if (item.sku) appwriteByCode.set(item.sku.trim().toUpperCase(), item);
        if (item.$id) appwriteByCode.set(item.$id, item);
    });

    let totalGross = 0;
    let totalPayout = 0;
    let totalCommission = 0;

    csvRows.forEach(row => {
        const rawUpc = (row.upc || row['UPC'] || row['Barcode'] || '').trim().replace(/^['"]+/, '');
        const rawSku = (row.sku || row['SKU'] || row['Location SKU'] || row.extractedSku || '').trim().replace(/^['"]+/, '');
        const rawName = (row.itemName || row['Name'] || row['Item'] || row['Item Name'] || row.title || '').trim();

        // 1. Identify match in Appwrite inventory
        let matchedItem = appwriteByCode.get(rawUpc.toUpperCase()) || 
                          appwriteByCode.get(rawSku.toUpperCase()) || 
                          null;

        // If code hit a combined/deconstructed child, dereference to its active Parent Lot!
        if (matchedItem) {
            matchedItem = dereferenceParentLot(matchedItem);
        }

        if (!matchedItem && rawName) {
            const cleanName = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
                // Helper to get all candidate titles for an item (tagTitle and title)
                const getItemTitles = (itm: any): string[] => {
                    const list: string[] = [];
                    if (itm.tagTitle) list.push(itm.tagTitle);
                    if (itm.title) list.push(itm.title);
                    return list;
                };

                // 1. Exact cleaned match on tagTitle or title
                let candidates = titleEligibleItems.filter(item => {
                    const titles = getItemTitles(item);
                    return titles.some(t => t.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanName);
                });

                // 2. Substring containment match
                if (candidates.length === 0) {
                    candidates = titleEligibleItems.filter(item => {
                        const titles = getItemTitles(item);
                        return titles.some(t => {
                            const ic = t.toLowerCase().replace(/[^a-z0-9]/g, '');
                            return ic.includes(cleanName) || cleanName.includes(ic);
                        });
                    });
                }

                // 3. Keyword overlap fallback
                if (candidates.length === 0) {
                    const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'for', 'in', 'on', 'at', 'to', 'with', 'by', 'from', 'is', 'it', 'as']);
                    const rawTokens = new Set(rawName.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !STOP_WORDS.has(w)));
                    if (rawTokens.size > 0) {
                        const scored: { item: any; score: number }[] = [];
                        for (const itm of titleEligibleItems) {
                            const combinedText = `${itm.tagTitle || ''} ${itm.title || ''}`;
                            if (!combinedText.trim()) continue;
                            const itmTokens = new Set(combinedText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !STOP_WORDS.has(w)));
                            let matches = 0;
                            for (const t of rawTokens) {
                                if (itmTokens.has(t)) matches++;
                            }
                            if (matches === 0) continue;
                            const score = matches / Math.min(rawTokens.size, itmTokens.size);
                            if (score >= 0.50) scored.push({ item: itm, score });
                        }
                        scored.sort((a, b) => b.score - a.score);
                        candidates = scored.map(s => s.item);
                    }
                }

                if (candidates.length > 0) {
                    candidates.sort((a, b) => {
                        // Prioritize status === 'placed'
                        const aPlaced = a.status === 'placed' ? 1 : 0;
                        const bPlaced = b.status === 'placed' ? 1 : 0;
                        if (bPlaced !== aPlaced) return bPlaced - aPlaced;

                        // Then prioritize multi-quantity items (quantity > 1)
                        const aQty = Number(a.quantity || 1);
                        const bQty = Number(b.quantity || 1);
                        return bQty - aQty;
                    });
                    matchedItem = dereferenceParentLot(candidates[0]);
                }
        }

        // 2. Determine Org Attribution
        const effectiveCode = matchedItem?.upc || rawUpc || rawSku;
        const orgPrefix = extractOrgPrefix(effectiveCode);
        const orgRoot = orgPrefix ? orgPrefix.replace(/[-_]$/, '').toUpperCase() : null;

        let targetKey = 'UNASSIGNED';
        if (orgRoot) {
            if (!buckets[orgRoot]) {
                buckets[orgRoot] = createEmptyBucket(orgRoot, `${orgRoot}-`, `${orgRoot} Inventory`);
            }
            targetKey = orgRoot;
        } else if (rawName) {
            const trimmedUpper = rawName.toUpperCase();
            if (trimmedUpper.startsWith('B&B ') || trimmedUpper.startsWith('B&B-') || trimmedUpper.startsWith('BB ') || trimmedUpper.startsWith('BB-')) {
                targetKey = 'BB';
            }
        }

        const bucket = buckets[targetKey];

        // 3. Compute Financials
        const gross = parseFloat(String(row.grossPrice || row.listedPrice || row['Price'] || row['Agreed Price'] || row['Amount'] || 0).replace(/[^0-9.]/g, '')) || 0;
        let payout = parseFloat(String(row.netSoldPrice || row.salePrice || row['Cost/Split'] || 0).replace(/[^0-9.]/g, '')) || 0;
        
        if (payout === 0 && gross > 0) {
            const consignorPct = parseFloat(String(row['Consignor %'] || 85)) || 85;
            payout = Number((gross * (consignorPct / 100)).toFixed(2));
        }
        const commission = Math.max(0, gross - payout);

        // Append to bucket
        const enrichedRow = {
            ...row,
            _matchedItem: matchedItem,
            _orgBucket: targetKey,
            _computedGross: gross,
            _computedPayout: payout,
            _computedCommission: commission
        };

        bucket.rows.push(enrichedRow);
        if (matchedItem) {
            bucket.matchedItems.push(matchedItem);
        } else {
            bucket.unmatchedRows.push(enrichedRow);
        }

        bucket.itemCount++;
        bucket.grossSales += gross;
        bucket.consignorPayout += payout;
        bucket.storeCommission += commission;

        totalGross += gross;
        totalPayout += payout;
        totalCommission += commission;
    });

    const allBuckets = Object.values(buckets).filter(b => b.itemCount > 0 || b.orgKey === 'HUCK' || b.orgKey === 'UNASSIGNED');

    return {
        totalRows: csvRows.length,
        totalGross: Number(totalGross.toFixed(2)),
        totalPayout: Number(totalPayout.toFixed(2)),
        totalCommission: Number(totalCommission.toFixed(2)),
        buckets,
        allBuckets
    };
}


// =========================================================================
// CUMULATIVE CSV RE-IMPORT IDEMPOTENCY (Occurrence-Indexed Fingerprints)
// Ricochet exports month-to-date CSVs: re-importing tomorrow's file repeats every row already recorded today.
// =========================================================================

/** Strip a UTF-8 BOM so the first header cell ("Item") parses correctly. */
export function stripBom(text: string): string {
    return String(text || '').replace(/^\uFEFF/, '');
}

/** Lowercase, unquote and collapse a CSV header cell, e.g. ` "Sold Date" ` -> `sold date`, `Sale#` -> `sale#`. */
export function normalizeCsvHeader(h: string): string {
    return String(h || '').replace(/^\uFEFF/, '').replace(/["']/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** True for the Memory Den / Ricochet sale-number header variants: Sale, Sale#, Sale #, Ticket, Receipt, Invoice... */
export function isSaleNumberHeader(h: string): boolean {
    const n = normalizeCsvHeader(h);
    return n === 'sale' || n === 'sale#' || n === 'sale #' || n === 'sale no' || n === 'sale number' || n === 'ticket' ||
        n.includes('ticket') || n.includes('receipt') || n.includes('invoice') || n.includes('transaction');
}

/** True for Sold Date header variants: Sold, Sold Date, Date Sold, Sale Date. */
export function isSoldDateHeader(h: string): boolean {
    const n = normalizeCsvHeader(h);
    return n === 'sold' || n === 'sold date' || n === 'date sold' || n === 'sale date' || n === 'sold_date';
}

/**
 * Ricochet "Product Catalog" export (`Products-*.csv`): has `Product ID` + `SKU` + `Inventory` but NO Sale/Sale# ticket column and NO Sold/Sold Date column.
 * Its `In stock` column is the date the item was added to stock (NOT a sale date). Such files may only update items - never create sales.
 */
export function isProductCatalogHeaders(headers: string[]): boolean {
    const n = (headers || []).map(normalizeCsvHeader);
    const has = (k: string) => n.includes(k);
    return has('product id') && has('sku') && has('inventory') && !n.some(isSaleNumberHeader) && !n.some(isSoldDateHeader);
}

/** Strips the leading apostrophe Ricochet puts on exported SKUs (`'0EJ001` -> `0EJ001`). */
export function cleanCatalogSku(raw: any): string {
    return String(raw ?? '').replace(/^'+/, '').trim();
}

/** Extracts the numeric POS sale/ticket number from `Ticket #224185`, `T-224185 • Title`, or `224185`. */
export function extractSaleNumber(raw: any): string {
    const s = String(raw ?? '').trim();
    if (!s) return '';
    const m = s.match(/(?:ticket\s*#|sale\s*#|T-)\s*(\d{4,8})/i) || s.match(/^(\d{4,8})$/);
    return m ? m[1] : '';
}

/**
 * Parses a CSV/DB date into an ISO instant.
 * - `YYYY-MM-DD HH:mm:ss` (Format A, interim payouts) is wall-clock time in the browser's local zone.
 * - `MM-DD-YYYY` / `MM/DD/YYYY` (Format B, Payout History) and bare `YYYY-MM-DD` are date-only: they become NOON local,
 *   the register convention used by every other import (never UTC/local midnight, which can shift the day).
 */
export function toSaleIso(raw: any): string {
    if (!raw) return '';
    const s = String(raw).trim();
    if (!s) return '';
    let m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (m) {
        const d = new Date(`${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}T12:00:00`);
        return isNaN(d.getTime()) ? '' : d.toISOString();
    }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
        const d = new Date(`${s}T12:00:00`);
        return isNaN(d.getTime()) ? '' : d.toISOString();
    }
    const d = new Date(/^\d{4}-\d{2}-\d{2} \d/.test(s) ? s.replace(' ', 'T') : s);
    return isNaN(d.getTime()) ? '' : d.toISOString();
}

/** True for payout summary / credit lines that must never become sales rows. */
export function isPayoutSummaryRow(itemName: string): boolean {
    const n = String(itemName || '').trim().toLowerCase();
    return n.startsWith('(credit) space rental') || n.startsWith('(credit)') || n.startsWith('total for payout') ||
        n.startsWith('total paid') || n.startsWith('total:') || n.includes('space rental');
}

/**
 * Splits a Ricochet item cell like `Cartographers Heros  - 0EJ03C` into a clean display title and the booth SKU.
 * Only a trailing ` - [0-9A-Z]{5,8}` token counts as a SKU.
 */
export function splitTrailingBoothSku(itemName: string): { title: string; sku: string } {
    const raw = String(itemName || '').trim();
    const m = raw.match(/\s+-\s+([0-9A-Z]{5,8})\s*$/);
    if (!m) return { title: raw.replace(/\s+/g, ' ').trim(), sku: '' };
    return { title: raw.slice(0, m.index).replace(/\s+/g, ' ').trim(), sku: m[1] };
}

/** Canonical numeric ticket id: `T-217301 • Title`, `Ticket #217301` and `217301` all become `217301`. */
export function canonicalTicketNumber(raw: any): string {
    return extractSaleNumber(raw);
}

/** Display form of a stored SKU / order reference: strips any ` • Item Title` suffix. `T-217301 • X` -> `Ticket #217301`. */
export function cleanSkuDisplay(raw: any): string {
    const s = String(raw ?? '').trim();
    if (!s) return '';
    const t = extractSaleNumber(s);
    if (t && /^(?:ticket\s*#|sale\s*#|T-)/i.test(s)) return `Ticket #${t}`;
    return s.split('•')[0].trim();
}

const slugKey = (v: any) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');


const localDay = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export interface FingerprintAccessors<T = any> {
    getSaleNumber: (row: T) => any;
    getSoldDate: (row: T) => any;
    getGross: (row: T) => any;
    /** Booth SKU (`0EJ08B`) when the row carries one. */
    getSku?: (row: T) => any;
    /** Clean item title (used for the fingerprint's title/SKU component). */
    getTitle?: (row: T) => any;
}

/**
 * Assigns each row an occurrence-indexed fingerprint within the file:
 *   `${canonicalTicket}|${normalizedTitleOrSku}|${gross.toFixed(2)}#${occurrenceIndexInTicket}`
 * The occurrence counter runs over rows sharing the same `canonicalTicket|gross`, so two copies of one item on a ticket are `#1`/`#2`
 * AND the same count is reproducible from the sales ledger (which does not store titles in a stable way).
 */
export function assignOccurrenceFingerprints<T extends Record<string, any>>(rows: T[], acc: FingerprintAccessors<T>): T[] {
    const seen = new Map<string, number>();
    rows.forEach(row => {
        const rawSale = acc.getSaleNumber(row);
        const ticket = canonicalTicketNumber(rawSale) || String(rawSale ?? '').trim();
        const gross = Number(acc.getGross(row) || 0).toFixed(2);
        const titleOrSku = slugKey(acc.getSku?.(row) || acc.getTitle?.(row) || '');
        const groupKey = `${ticket}|${gross}`;
        const idx = (seen.get(groupKey) || 0) + 1;
        seen.set(groupKey, idx);
        (row as any).canonicalTicket = ticket;
        (row as any).fingerprintBase = `${ticket}|${titleOrSku}|${gross}`;
        (row as any).occurrenceIndex = idx;
        (row as any).fingerprint = `${ticket}|${titleOrSku}|${gross}#${idx}`;
    });
    return rows;
}

/**
 * Flags rows already recorded in the sales ledger (`isAlreadyRecorded = true`, shown as "✅ Already Recorded (Skipped)").
 * Every ticket reference is normalised the same way on both sides (`T-217301 • Title`, `Ticket #217301`, `217301` -> `217301`),
 * so a CSV upload never duplicates a legacy record. A row is recorded when the ledger holds at least `occurrenceIndex`
 * sales for its `canonicalTicket|gross`. Ticket-less legacy sales (SKU / payout-batch order ids) match on SKU + local day + gross,
 * or on exact instant + gross. Skipped rows must never create sales or touch multi-qty stock.
 */
export function flagAlreadyRecordedRows<T extends Record<string, any>>(rows: T[], existingSales: any[], acc: FingerprintAccessors<T>): { rows: T[]; recordedCount: number; newCount: number } {
    assignOccurrenceFingerprints(rows, acc);
    const byTicketGross = new Map<string, number>();
    const bySkuDayGross = new Map<string, number>();
    const byInstantGross = new Map<string, number>();
    const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) || 0) + 1);

    (existingSales || []).forEach(s => {
        if (s.status === 'Cancelled') return;
        const gross = Number(s.grossAmount || 0).toFixed(2);
        const iso = toSaleIso(s.saleDate);
        const ticket = canonicalTicketNumber(s.orderId) || canonicalTicketNumber(s.soNumber);
        if (ticket) {
            bump(byTicketGross, `${ticket}|${gross}`);
            return;
        }
        if (!iso) return;
        bump(byInstantGross, `${iso}|${gross}`);
        [s.soNumber, s.orderId].forEach(k => {
            const key = slugKey(k);
            if (key) bump(bySkuDayGross, `${key}|${localDay(iso)}|${gross}`);
        });
    });

    let recordedCount = 0;
    rows.forEach(row => {
        const ticket = (row as any).canonicalTicket as string;
        const gross = Number(acc.getGross(row) || 0).toFixed(2);
        const k = (row as any).occurrenceIndex || 1;
        const iso = toSaleIso(acc.getSoldDate(row));
        let recorded = false;
        if (ticket && /^\d{4,8}$/.test(ticket)) {
            recorded = (byTicketGross.get(`${ticket}|${gross}`) || 0) >= k;
        }
        if (!recorded && iso) {
            recorded = (byInstantGross.get(`${iso}|${gross}`) || 0) >= k;
            const sku = slugKey(acc.getSku?.(row));
            if (!recorded && sku) recorded = (bySkuDayGross.get(`${sku}|${localDay(iso)}|${gross}`) || 0) >= k;
        }
        (row as any).isAlreadyRecorded = recorded;
        if (recorded) recordedCount++;
    });
    return { rows, recordedCount, newCount: rows.length - recordedCount };
}

/**
 * Month key (YYYY-MM) of a sale in the booth's Pacific time zone, so every view (ledger, KPI cards, co-op statements) buckets a sale into the same month
 * regardless of the browser's time zone or UTC offset. Date-only strings use their own calendar month.
 */
export function pacificMonthKey(dateStr?: string | null): string {
    if (!dateStr) return '';
    const s = String(dateStr).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7);
    const d = new Date(s);
    if (isNaN(d.getTime())) return s.slice(0, 7);
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit' }).formatToParts(d);
    return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}`;
}

// =========================================================================
// CANONICAL MEMORY DEN (#0EJ) RFC-4180 PARSER, TRAP GUARDS & MATCH ENGINE
// =========================================================================

export const MD_CANONICAL_WAREHOUSE_ID = '6a7e70050009db0e1857';

/**
 * RFC-4180 multiline-aware CSV row parser.
 * Properly handles embedded newlines inside quoted Description cells in Products-*.csv.
 */
export function parseCsvRfc4180Rows(rawText: string): string[][] {
    const text = stripBom(rawText || '');
    const rows: string[][] = [];
    let currentRow: string[] = [];
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
                currentRow.push(currentField.trim());
                currentField = '';
            } else if (ch === '\r' && next === '\n') {
                currentRow.push(currentField.trim());
                if (currentRow.some(c => c.length > 0)) rows.push(currentRow);
                currentRow = [];
                currentField = '';
                i++;
            } else if (ch === '\n' || ch === '\r') {
                currentRow.push(currentField.trim());
                if (currentRow.some(c => c.length > 0)) rows.push(currentRow);
                currentRow = [];
                currentField = '';
            } else {
                currentField += ch;
            }
        }
    }

    if (currentField.length > 0 || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        if (currentRow.some(c => c.length > 0)) rows.push(currentRow);
    }

    return rows;
}

export interface MdPreverifiedSingle {
    upc: string | null;
    altUpc?: string;
    saleNum: string;
    gross: number;
    label: string;
}

export const PREVERIFIED_MD_SINGLE_UPC_BY_SKU: Record<string, MdPreverifiedSingle> = {
    '0EJ0N8': { upc: 'HUCK-1440', saleNum: '224517', gross: 25.00, label: 'NOTATIONS Black Floral Lace Long' },
    '0EJ0O1': { upc: 'HUCK-9456', saleNum: '224185', gross: 35.00, label: 'Black Bat Wing Spiderweb Handbag' },
    '0EJ0N6': { upc: 'HUCK-1502', saleNum: '224156', gross: 55.00, label: 'Madusella Black Quilted Open Front' },
    '0EJ0NZ': { upc: 'HUCK-9457', saleNum: '224075', gross: 30.00, label: 'Black Studded Cross Handbag' },
    '0EJ0OE': { upc: 'HUCK-1787', saleNum: '223898', gross: 45.00, label: "Levi's Faux Leather Moto Jacket (L)" },
    '0EJ0O7': { upc: 'HUCK-1794', saleNum: '223350', gross: 75.00, label: 'Her NYC Punk Moto Jacket (2X)' },
    '0EJ0H9': { upc: 'HUCK-1389', saleNum: '222998', gross: 23.00, label: 'Black Lace Veil Headband' },
    '0EJ0NX': { upc: 'HUCK-1795', saleNum: '222728', gross: 65.00, label: 'Promise NY Textured Fringe Jacket' },
    '0EJ0NY': { upc: 'HUCK-9459', saleNum: '222684', gross: 25.00, label: 'Black Rounded Gothic Mini Handbag' },
    '0EJ0NI': { upc: 'HUCK-1405', saleNum: '222293', gross: 25.00, label: 'Universal Thread Black Crinkle' },
    '0EJ0N1': { upc: 'HUCK-0158', saleNum: '222148', gross: 75.00, label: 'Tim Burton Nightmare Before' },
    '0EJ0MU': { upc: 'HUCK-8968', saleNum: '221149', gross: 35.00, label: 'Cyberpunk 2020 Chrome 2 The Cyberpunk' },
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
    '0EJ06K': { upc: 'HUCK-1206', saleNum: '225288', gross: 30.00, label: '0EJ06K HUCK-1206' },
    '0EJ0JV': { upc: null, saleNum: '225058', gross: 55.00, label: 'Tripp NYC Black Gothic Punk Alternative Lace-Up Mini Skirt Size 4' },
    '0EJ07F': { upc: null, saleNum: '221996', gross: 40.00, label: 'Goth Mini Skirt - Lips & Crossbones Patch' },
    '0EJ0C7': { upc: null, saleNum: '219981', gross: 70.00, label: 'Frank Frazetta ICON A Retrospective Art Book' },
    '0EJ0BD': { upc: null, saleNum: '218369', gross: 10.00, label: 'Air Land and Sea Game' },
};

export const PREVERIFIED_OCT_BB_SKUS = new Set<string>([
    '0EJ0HN', '0EJ0HQ', '0EJ0HX', '0EJ0IH', '0EJ0IJ', '0EJ0IL', '0EJ0IN',
    '0EJ0IT', '0EJ0IU', '0EJ0IV', '0EJ0J5', '0EJ0J8', '0EJ0KA', '0EJ0LM',
]);

/**
 * Pre-verified unambiguous Memory Den SKU -> UPC (or Appwrite $id) map.
 * Consulted automatically during Products-*.csv and Payouts *.csv matching.
 * Add 100% unambiguous verified In-Stock or Sold pairs here so they auto-link on upload.
 */
export const PREVERIFIED_MD_SKU_TO_UPC_OR_ID: Record<string, string> = {
    '0EJ001': 'HUCK-0543',
    '0EJ008': 'HUCK-0536',
    '0EJ009': 'HUCK-0535',
    '0EJ00A': 'HUCK-1184',
    '0EJ00B': 'HUCK-0534',
    '0EJ00C': 'HUCK-0533',
    '0EJ00D': 'HUCK-0532',
    '0EJ00E': 'HUCK-0531',
    '0EJ00F': 'HUCK-1100',
    '0EJ00G': 'HUCK-0530',
    '0EJ00H': 'HUCK-0529',
    '0EJ00I': 'HUCK-0528',
    '0EJ00J': 'HUCK-0527',
    '0EJ00K': 'HUCK-0526',
    '0EJ00L': 'HUCK-0525',
    '0EJ00M': 'HUCK-0524',
    '0EJ00N': 'HUCK-0523',
    '0EJ00O': 'HUCK-0522',
    '0EJ00P': 'HUCK-0521',
    '0EJ00Q': 'HUCK-0520',
    '0EJ00R': 'HUCK-0829',
    '0EJ00S': 'HUCK-0630',
    '0EJ00T': 'HUCK-0519',
    '0EJ00U': 'HUCK-0518',
    '0EJ00V': 'HUCK-9908',
    '0EJ00W': 'HUCK-0517',
    '0EJ00X': 'HUCK-0412',
    '0EJ00Y': 'HUCK-0595',
    '0EJ00Z': 'HUCK-0516',
    '0EJ010': 'HUCK-1190',
    '0EJ011': 'HUCK-9909',
    '0EJ012': 'HUCK-0515',
    '0EJ013': 'HUCK-0514',
    '0EJ014': 'HUCK-0513',
    '0EJ015': 'PDXGL-0001',
    '0EJ016': 'HUCK-0469',
    '0EJ017': 'HUCK-0512',
    '0EJ018': 'HUCK-0511',
    '0EJ019': 'PDXGL-0169',
    '0EJ01A': 'PDXGL-0003',
    '0EJ01B': 'HUCK-9910',
    '0EJ01C': 'HUCK-9548',
    '0EJ01D': 'PDXGL-0171',
    '0EJ01E': 'HUCK-0485',
    '0EJ01F': 'HUCK-0812',
    '0EJ01G': 'HUCK-0265',
    '0EJ01H': 'HUCK-0653',
    '0EJ01I': 'HUCK-0969',
    '0EJ01J': 'HUCK-0992',
    '0EJ01K': 'PDXGL-0004',
    '0EJ01L': 'HUCK-1047',
    '0EJ01M': 'HUCK-0837',
    '0EJ01N': 'HUCK-9911',
    '0EJ01O': 'HUCK-0759',
    '0EJ01P': 'HUCK-0929',
    '0EJ01Q': 'HUCK-0901',
    '0EJ01R': 'HUCK-0567',
    '0EJ01S': 'PDXGL-0005',
    '0EJ01T': 'HUCK-0509',
    '0EJ01U': 'PDXGL-0006',
    '0EJ01V': 'PDXGL-0007',
    '0EJ01W': 'PDXGL-0008',
    '0EJ01X': 'HUCK-9528',
    '0EJ01Y': 'HUCK-9912',
    '0EJ01Z': 'PDXGL-0009',
    '0EJ020': 'PDXGL-0010',
    '0EJ021': 'PDXGL-0011',
    '0EJ022': 'PDXGL-0012',
    '0EJ023': 'PDXGL-0013',
    '0EJ024': 'HUCK-9533',
    '0EJ025': 'HUCK-9532',
    '0EJ026': 'HUCK-0294',
    '0EJ027': 'HUCK-9522',
    '0EJ028': 'HUCK-9913',
    '0EJ029': 'HUCK-0051',
    '0EJ02A': 'PDXGL-0014',
    '0EJ02B': 'HUCK-0436',
    '0EJ02C': 'HUCK-9549',
    '0EJ02D': 'HUCK-9733',
    '0EJ02E': 'HUCK-9914',
    '0EJ02F': 'HUCK-9516',
    '0EJ02G': 'HUCK-0438',
    '0EJ02H': 'PDXGL-0015',
    '0EJ02I': 'PDXGL-0016',
    '0EJ02J': 'HUCK-0494',
    '0EJ02K': 'HUCK-0443',
    '0EJ02L': 'HUCK-0445',
    '0EJ02M': 'HUCK-0446',
    '0EJ02N': 'HUCK-0447',
    '0EJ02O': 'HUCK-0448',
    '0EJ02P': 'HUCK-0449',
    '0EJ02Q': 'PDXGL-0017',
    '0EJ02R': 'PDXGL-0018',
    '0EJ02S': 'PDXGL-0019',
    '0EJ02T': 'PDXGL-0020',
    '0EJ02U': 'PDXGL-0021',
    '0EJ02V': 'PDXGL-0022',
    '0EJ02W': 'PDXGL-0023',
    '0EJ02X': 'PDXGL-0024',
    '0EJ02Y': 'PDXGL-0025',
    '0EJ02Z': 'PDXGL-0026',
    '0EJ030': 'PDXGL-0027',
    '0EJ031': 'PDXGL-0028',
    '0EJ032': 'HUCK-0510',
    '0EJ033': 'PDXGL-0029',
    '0EJ034': 'PDXGL-0030',
    '0EJ035': 'PDXGL-0031',
    '0EJ036': 'PDXGL-0032',
    '0EJ037': 'PDXGL-0033',
    '0EJ038': 'PDXGL-0034',
    '0EJ039': 'PDXGL-0035',
    '0EJ03A': 'PDXGL-0036',
    '0EJ03B': 'PDXGL-0037',
    '0EJ03C': 'PDXGL-0038',
    '0EJ03D': 'PDXGL-0039',
    '0EJ03E': 'PDXGL-0040',
    '0EJ03F': 'PDXGL-0041',
    '0EJ03G': 'PDXGL-0042',
    '0EJ03H': 'PDXGL-0043',
    '0EJ03I': 'PDXGL-0044',
    '0EJ03J': 'PDXGL-0045',
    '0EJ03K': 'PDXGL-0046',
    '0EJ03L': 'PDXGL-0047',
    '0EJ03M': 'PDXGL-0048',
    '0EJ03N': 'PDXGL-0049',
    '0EJ03O': 'PDXGL-0050',
    '0EJ03P': 'PDXGL-0051',
    '0EJ03Q': 'PDXGL-0052',
    '0EJ03R': 'PDXGL-0053',
    '0EJ03S': 'PDXGL-0054',
    '0EJ03T': 'PDXGL-0055',
    '0EJ03U': 'PDXGL-0056',
    '0EJ03V': 'PDXGL-0057',
    '0EJ03W': 'PDXGL-0058',
    '0EJ03X': 'PDXGL-0059',
    '0EJ03Y': 'PDXGL-0060',
    '0EJ03Z': 'PDXGL-0061',
    '0EJ040': 'PDXGL-0062',
    '0EJ041': 'PDXGL-0063',
    '0EJ042': 'PDXGL-0064',
    '0EJ043': 'PDXGL-0065',
    '0EJ044': 'PDXGL-0066',
    '0EJ045': 'PDXGL-0067',
    '0EJ046': 'PDXGL-0068',
    '0EJ047': 'PDXGL-0069',
    '0EJ048': 'PDXGL-0070',
    '0EJ049': 'PDXGL-0071',
    '0EJ04A': 'PDXGL-0072',
    '0EJ04B': 'HUCK-9551',
    '0EJ04C': 'PDXGL-0073',
    '0EJ04D': 'PDXGL-0074',
    '0EJ04E': 'PDXGL-0075',
    '0EJ04F': 'PDXGL-0076',
    '0EJ04G': 'PDXGL-0077',
    '0EJ04H': 'PDXGL-0078',
    '0EJ04I': 'PDXGL-0002',
    '0EJ04J': 'PDXGL-0079',
    '0EJ04K': 'PDXGL-0080',
    '0EJ04L': 'PDXGL-0081',
    '0EJ04M': 'PDXGL-0082',
    '0EJ04N': 'PDXGL-0083',
    '0EJ04O': 'PDXGL-0084',
    '0EJ04P': 'PDXGL-0085',
    '0EJ04Q': 'PDXGL-0086',
    '0EJ04R': 'PDXGL-0087',
    '0EJ04S': 'PDXGL-0088',
    '0EJ04T': 'PDXGL-0089',
    '0EJ04U': 'PDXGL-0090',
    '0EJ04V': 'PDXGL-0091',
    '0EJ04W': 'HUCK-9915',
    '0EJ04X': 'HUCK-9553',
    '0EJ04Y': 'HUCK-0619',
    '0EJ04Z': 'HUCK-1277',
    '0EJ050': 'HUCK-9524',
    '0EJ051': 'HUCK-0873',
    '0EJ052': 'HUCK-0858',
    '0EJ053': 'HUCK-0610',
    '0EJ054': 'HUCK-9916',
    '0EJ055': 'HUCK-11223',
    '0EJ056': 'HUCK-9529',
    '0EJ057': 'HUCK-9917',
    '0EJ058': 'HUCK-9527',
    '0EJ059': 'HUCK-0011',
    '0EJ05A': 'HUCK-9530',
    '0EJ05B': 'HUCK-9531',
    '0EJ05C': 'HUCK-9542',
    '0EJ05D': 'HUCK-1192',
    '0EJ05E': 'HUCK-1193',
    '0EJ05F': 'HUCK-9556',
    '0EJ05G': 'HUCK-9543',
    '0EJ05H': 'HUCK-9918',
    '0EJ05I': 'HUCK-1276',
    '0EJ05J': 'HUCK-0683',
    '0EJ05K': 'HUCK-1194',
    '0EJ05L': 'HUCK-10613',
    '0EJ05M': 'HUCK-10555',
    '0EJ05N': 'HUCK-10101',
    '0EJ05O': 'HUCK-1195',
    '0EJ05P': 'HUCK-1196',
    '0EJ05Q': 'HUCK-9919',
    '0EJ05R': 'HUCK-1197',
    '0EJ05S': 'HUCK-0492',
    '0EJ05T': 'HUCK-1275',
    '0EJ05U': 'HUCK-1198',
    '0EJ05V': 'HUCK-0452',
    '0EJ05W': 'HUCK-0450',
    '0EJ05X': 'HUCK-0831',
    '0EJ05Y': 'HUCK-1199',
    '0EJ05Z': 'HUCK-1284',
    '0EJ060': 'HUCK-1281',
    '0EJ061': 'HUCK-1200',
    '0EJ062': 'HUCK-9521',
    '0EJ063': 'HUCK-1201',
    '0EJ064': 'HUCK-0454',
    '0EJ065': 'HUCK-1202',
    '0EJ066': 'HUCK-1274',
    '0EJ067': 'HUCK-1283',
    '0EJ068': 'HUCK-0453',
    '0EJ069': 'HUCK-0919',
    '0EJ06A': 'HUCK-1203',
    '0EJ06B': 'HUCK-1282',
    '0EJ06C': 'HUCK-1204',
    '0EJ06D': 'HUCK-0684',
    '0EJ06E': 'HUCK-0685',
    '0EJ06F': 'HUCK-1205',
    '0EJ06G': 'HUCK-0871',
    '0EJ06H': 'HUCK-0686',
    '0EJ06I': 'HUCK-9557',
    '0EJ06J': 'HUCK-0806',
    '0EJ06K': 'HUCK-1206',
    '0EJ06L': 'HUCK-0699',
    '0EJ06M': 'HUCK-9526',
    '0EJ06N': 'HUCK-0801',
    '0EJ06O': 'HUCK-0921',
    '0EJ06P': 'HUCK-1280',
    '0EJ06Q': 'HUCK-9520',
    '0EJ06R': 'HUCK-0902',
    '0EJ06S': 'HUCK-1207',
    '0EJ06T': 'HUCK-1208',
    '0EJ06U': 'HUCK-0554',
    '0EJ06V': 'HUCK-0090',
    '0EJ06W': 'HUCK-0508',
    '0EJ06X': 'HUCK-0283',
    '0EJ06Y': 'HUCK-1209',
    '0EJ06Z': 'HUCK-0612',
    '0EJ070': 'HUCK-0724',
    '0EJ071': 'HUCK-9920',
    '0EJ072': 'HUCK-0457',
    '0EJ073': 'HUCK-1210',
    '0EJ074': 'HUCK-1211',
    '0EJ075': 'HUCK-1279',
    '0EJ076': 'HUCK-1212',
    '0EJ077': 'HUCK-1213',
    '0EJ078': 'HUCK-1214',
    '0EJ079': 'HUCK-1278',
    '0EJ07A': 'HUCK-1215',
    '0EJ07B': 'PDXGL-0195',
    '0EJ07C': 'HUCK-0819',
    '0EJ07D': 'HUCK-9921',
    '0EJ07E': 'HUCK-0698',
    '0EJ07F': 'HUCK-1216',
    '0EJ07G': 'HUCK-0864',
    '0EJ07H': 'HUCK-0877',
    '0EJ07I': 'HUCK-1217',
    '0EJ07J': 'HUCK-10037',
    '0EJ07K': 'HUCK-1218',
    '0EJ07L': 'HUCK-1432',
    '0EJ07M': 'HUCK-1219',
    '0EJ07N': 'HUCK-0505',
    '0EJ07O': 'HUCK-1220',
    '0EJ07P': 'HUCK-1292',
    '0EJ07Q': 'HUCK-1221',
    '0EJ07R': 'HUCK-1222',
    '0EJ07S': 'HUCK-1223',
    '0EJ07T': 'HUCK-1289',
    '0EJ07U': 'HUCK-1290',
    '0EJ07V': 'HUCK-1291',
    '0EJ07W': 'HUCK-1224',
    '0EJ07X': 'HUCK-9922',
    '0EJ07Y': 'HUCK-0817',
    '0EJ07Z': 'HUCK-9923',
    '0EJ080': 'HUCK-0552',
    '0EJ081': 'HUCK-9924',
    '0EJ082': 'HUCK-0571',
    '0EJ083': 'HUCK-0545',
    '0EJ084': 'HUCK-0544',
    '0EJ085': 'HUCK-0569',
    '0EJ086': 'HUCK-1225',
    '0EJ087': 'HUCK-0816',
    '0EJ088': 'HUCK-0866',
    '0EJ089': 'HUCK-0556',
    '0EJ08A': 'HUCK-0915',
    '0EJ08B': 'HUCK-0629',
    '0EJ08D': 'HUCK-0432',
    '0EJ08E': 'HUCK-9519',
    '0EJ08F': 'HUCK-9925',
    '0EJ08G': 'HUCK-0433',
    '0EJ08H': 'HUCK-0430',
    '0EJ08I': 'HUCK-0429',
    '0EJ08J': 'HUCK-0810',
    '0EJ08K': 'HUCK-1229',
    '0EJ08L': 'HUCK-0428',
    '0EJ08M': 'HUCK-0427',
    '0EJ08N': 'HUCK-0426',
    '0EJ08O': 'HUCK-0434',
    '0EJ08P': 'HUCK-9926',
    '0EJ08Q': 'HUCK-0360',
    '0EJ08R': 'HUCK-0359',
    '0EJ08S': 'HUCK-0875',
    '0EJ08T': 'HUCK-0358',
    '0EJ08U': 'PDXGL-0177',
    '0EJ08V': 'HUCK-0351',
    '0EJ08W': 'HUCK-0308',
    '0EJ08X': 'HUCK-0352',
    '0EJ08Y': 'HUCK-0353',
    '0EJ08Z': 'HUCK-0460',
    '0EJ090': 'HUCK-9734',
    '0EJ091': 'HUCK-0350',
    '0EJ092': 'HUCK-0349',
    '0EJ093': 'HUCK-0507',
    '0EJ094': 'HUCK-0568',
    '0EJ095': 'HUCK-0340',
    '0EJ096': 'HUCK-0339',
    '0EJ097': 'HUCK-0338',
    '0EJ098': 'HUCK-0337',
    '0EJ099': 'HUCK-0336',
    '0EJ09A': 'HUCK-9716',
    '0EJ09B': 'HUCK-0335',
    '0EJ09C': 'HUCK-0437',
    '0EJ09D': 'HUCK-0216',
    '0EJ09E': 'HUCK-0296',
    '0EJ09F': 'HUCK-0297',
    '0EJ09G': 'HUCK-1494',
    '0EJ09H': 'HUCK-0917',
    '0EJ09I': 'HUCK-0312',
    '0EJ09J': 'HUCK-0346',
    '0EJ09K': 'HUCK-0733',
    '0EJ09L': 'HUCK-0326',
    '0EJ09M': 'HUCK-1131',
    '0EJ09N': 'HUCK-0807',
    '0EJ09O': 'HUCK-0882',
    '0EJ09P': 'HUCK-0322',
    '0EJ09Q': 'HUCK-0717',
    '0EJ09R': 'HUCK-0914',
    '0EJ09S': 'HUCK-0800',
    '0EJ09T': 'HUCK-0818',
    '0EJ09U': 'PDXGL-0107',
    '0EJ09V': 'PDXGL-0108',
    '0EJ09W': 'PDXGL-0109',
    '0EJ09X': 'PDXGL-0110',
    '0EJ09Y': 'PDXGL-0111',
    '0EJ09Z': 'PDXGL-0112',
    '0EJ0A0': 'PDXGL-0113',
    '0EJ0A1': 'PDXGL-0114',
    '0EJ0A2': 'HUCK-9525',
    '0EJ0A3': 'HUCK-0423',
    '0EJ0A4': 'HUCK-0502',
    '0EJ0A5': 'HUCK-0564',
    '0EJ0A6': 'HUCK-0823',
    '0EJ0A7': 'HUCK-0922',
    '0EJ0A8': 'HUCK-0420',
    '0EJ0A9': 'HUCK-0371',
    '0EJ0AA': 'HUCK-0278',
    '0EJ0AB': 'HUCK-0394',
    '0EJ0AC': 'HUCK-0286',
    '0EJ0AD': 'HUCK-0364',
    '0EJ0AE': 'HUCK-0400',
    '0EJ0AF': 'HUCK-0276',
    '0EJ0AG': 'HUCK-0570',
    '0EJ0AH': 'HUCK-0275',
    '0EJ0AI': 'HUCK-0345',
    '0EJ0AJ': 'HUCK-0261',
    '0EJ0AK': 'HUCK-0262',
    '0EJ0AL': 'HUCK-0292',
    '0EJ0AM': 'HUCK-0405',
    '0EJ0AN': 'HUCK-0293',
    '0EJ0AO': 'HUCK-0475',
    '0EJ0AP': 'HUCK-0259',
    '0EJ0AQ': 'HUCK-0258',
    '0EJ0AR': 'HUCK-0257',
    '0EJ0AS': 'HUCK-0284',
    '0EJ0AT': 'HUCK-0311',
    '0EJ0AU': 'HUCK-0318',
    '0EJ0AV': 'HUCK-0887',
    '0EJ0AW': 'HUCK-0720',
    '0EJ0AX': 'HUCK-0722',
    '0EJ0AY': 'PDXGL-0115',
    '0EJ0AZ': 'PDXGL-0116',
    '0EJ0B0': 'PDXGL-0117',
    '0EJ0B1': 'PDXGL-0118',
    '0EJ0B2': 'PDXGL-0119',
    '0EJ0B3': 'PDXGL-0120',
    '0EJ0B4': 'PDXGL-0121',
    '0EJ0B5': 'PDXGL-0122',
    '0EJ0B6': 'PDXGL-0123',
    '0EJ0B7': 'PDXGL-0124',
    '0EJ0B8': 'PDXGL-0125',
    '0EJ0B9': 'PDXGL-0126',
    '0EJ0BA': 'PDXGL-0127',
    '0EJ0BB': 'PDXGL-0128',
    '0EJ0BC': 'PDXGL-0129',
    '0EJ0BD': 'PDXGL-0130',
    '0EJ0BE': 'PDXGL-0131',
    '0EJ0BF': 'HUCK-9735',
    '0EJ0BG': 'HUCK-9736',
    '0EJ0BH': 'HUCK-0235',
    '0EJ0BI': 'HUCK-0236',
    '0EJ0BJ': 'HUCK-0237',
    '0EJ0BK': 'HUCK-0238',
    '0EJ0BL': 'HUCK-0239',
    '0EJ0BM': 'HUCK-0226',
    '0EJ0BN': 'PDXGL-0132',
    '0EJ0BO': 'HUCK-0225',
    '0EJ0BP': 'HUCK-0227',
    '0EJ0BQ': 'HUCK-0270',
    '0EJ0BR': 'HUCK-0240',
    '0EJ0BS': 'HUCK-0241',
    '0EJ0BT': 'HUCK-0243',
    '0EJ0BU': 'HUCK-0245',
    '0EJ0BV': 'HUCK-0244',
    '0EJ0BW': 'HUCK-0246',
    '0EJ0BX': 'HUCK-0247',
    '0EJ0BY': 'HUCK-0249',
    '0EJ0BZ': 'HUCK-0251',
    '0EJ0C0': 'HUCK-0252',
    '0EJ0C1': 'HUCK-0253',
    '0EJ0C2': 'HUCK-0254',
    '0EJ0C3': 'HUCK-0255',
    '0EJ0C4': 'HUCK-0220',
    '0EJ0C5': 'HUCK-0923',
    '0EJ0C6': 'HUCK-0219',
    '0EJ0C7': 'HUCK-0222',
    '0EJ0C8': 'HUCK-0221',
    '0EJ0C9': 'HUCK-0217',
    '0EJ0CA': 'HUCK-1300',
    '0EJ0CB': 'HUCK-0212',
    '0EJ0CC': 'HUCK-0256',
    '0EJ0CD': 'HUCK-0387',
    '0EJ0CE': 'HUCK-0386',
    '0EJ0CF': 'HUCK-0385',
    '0EJ0CG': 'HUCK-0401',
    '0EJ0CH': 'HUCK-1228',
    '0EJ0CI': 'HUCK-0201',
    '0EJ0CJ': 'PDXGL-0134',
    '0EJ0CK': 'PDXGL-0135',
    '0EJ0CL': 'PDXGL-0136',
    '0EJ0CM': 'PDXGL-0137',
    '0EJ0CN': 'PDXGL-0138',
    '0EJ0CO': 'PDXGL-0139',
    '0EJ0CP': 'HUCK-1226',
    '0EJ0CQ': 'HUCK-9907',
    '0EJ0CR': 'HUCK-0182',
    '0EJ0CS': 'HUCK-0183',
    '0EJ0CT': 'HUCK-0184',
    '0EJ0CU': 'HUCK-9927',
    '0EJ0CV': 'HUCK-0185',
    '0EJ0CW': 'HUCK-0187',
    '0EJ0CX': 'HUCK-0188',
    '0EJ0CY': 'HUCK-0189',
    '0EJ0CZ': 'HUCK-0191',
    '0EJ0D0': 'HUCK-0392',
    '0EJ0D1': 'HUCK-0168',
    '0EJ0D2': 'HUCK-0167',
    '0EJ0D3': 'HUCK-0169',
    '0EJ0D4': 'HUCK-1299',
    '0EJ0D5': 'HUCK-9477',
    '0EJ0D6': 'HUCK-1297',
    '0EJ0D7': 'HUCK-1296',
    '0EJ0D8': 'PDXGL-0144',
    '0EJ0D9': 'HUCK-1295',
    '0EJ0DA': 'HUCK-1294',
    '0EJ0DB': 'HUCK-1293',
    '0EJ0DC': 'HUCK-0888',
    '0EJ0DD': 'HUCK-0161',
    '0EJ0DE': 'PDXGL-0174',
    '0EJ0DF': 'PDXGL-0148',
    '0EJ0DG': 'PDXGL-0149',
    '0EJ0DH': 'PDXGL-0150',
    '0EJ0DI': 'PDXGL-0151',
    '0EJ0DJ': 'PDXGL-0152',
    '0EJ0DK': 'PDXGL-0153',
    '0EJ0DL': 'PDXGL-0154',
    '0EJ0DM': 'PDXGL-0155',
    '0EJ0DN': 'PDXGL-0156',
    '0EJ0DO': 'PDXGL-0157',
    '0EJ0DP': 'PDXGL-0158',
    '0EJ0DQ': 'PDXGL-0159',
    '0EJ0DR': 'PDXGL-0175',
    '0EJ0DS': 'PDXGL-0160',
    '0EJ0DU': 'PDXGL-0161',
    '0EJ0DV': 'PDXGL-0162',
    '0EJ0DW': 'PDXGL-0163',
    '0EJ0DX': 'PDXGL-0164',
    '0EJ0DY': 'PDXGL-0165',
    '0EJ0DZ': 'PDXGL-0166',
    '0EJ0E0': 'PDXGL-0167',
    '0EJ0E1': 'HUCK-0092',
    '0EJ0E2': 'HUCK-0093',
    '0EJ0E3': 'HUCK-0097',
    '0EJ0E4': 'HUCK-0095',
    '0EJ0E5': 'HUCK-0094',
    '0EJ0E6': 'HUCK-0096',
    '0EJ0E7': 'HUCK-0171',
    '0EJ0E8': 'HUCK-0153',
    '0EJ0E9': 'HUCK-0180',
    '0EJ0EA': 'HUCK-0103',
    '0EJ0EB': 'HUCK-0399',
    '0EJ0EC': 'HUCK-0113',
    '0EJ0ED': 'HUCK-0070',
    '0EJ0EE': 'HUCK-0069',
    '0EJ0EF': 'HUCK-0068',
    '0EJ0EG': 'HUCK-0067',
    '0EJ0EH': 'HUCK-0066',
    '0EJ0EI': 'HUCK-9737',
    '0EJ0EJ': 'HUCK-0058',
    '0EJ0EK': 'HUCK-0105',
    '0EJ0EL': 'HUCK-9738',
    '0EJ0EM': 'HUCK-0106',
    '0EJ0EN': 'HUCK-0644',
    '0EJ0EO': 'HUCK-0123',
    '0EJ0EP': 'HUCK-9928',
    '0EJ0EQ': 'HUCK-1250',
    '0EJ0ER': 'HUCK-1249',
    '0EJ0ES': 'HUCK-9476',
    '0EJ0ET': 'HUCK-9535',
    '0EJ0EU': 'HUCK-9523',
    '0EJ0EV': 'HUCK-1248',
    '0EJ0EW': 'HUCK-1247',
    '0EJ0EX': 'HUCK-1246',
    '0EJ0EY': 'HUCK-1245',
    '0EJ0EZ': 'HUCK-1244',
    '0EJ0F0': 'HUCK-1243',
    '0EJ0F1': 'HUCK-1242',
    '0EJ0F2': 'HUCK-1241',
    '0EJ0F3': 'HUCK-1240',
    '0EJ0F4': 'HUCK-1239',
    '0EJ0F5': 'HUCK-1238',
    '0EJ0F6': 'HUCK-1237',
    '0EJ0F7': 'HUCK-1236',
    '0EJ0F8': 'HUCK-1235',
    '0EJ0F9': 'HUCK-0966',
    '0EJ0FA': 'HUCK-0199',
    '0EJ0FB': 'HUCK-9518',
    '0EJ0FC': 'HUCK-1017',
    '0EJ0FD': 'HUCK-0023',
    '0EJ0FE': 'HUCK-0697',
    '0EJ0FF': 'HUCK-0147',
    '0EJ0FG': 'HUCK-1252',
    '0EJ0FH': 'HUCK-1251',
    '0EJ0FI': 'HUCK-1255',
    '0EJ0FJ': 'HUCK-1256',
    '0EJ0FK': 'HUCK-0150',
    '0EJ0FL': 'HUCK-1303',
    '0EJ0FM': 'HUCK-1304',
    '0EJ0FN': 'HUCK-1305',
    '0EJ0FO': 'HUCK-1306',
    '0EJ0FP': 'HUCK-1307',
    '0EJ0FQ': 'HUCK-1308',
    '0EJ0FR': 'HUCK-1309',
    '0EJ0FS': 'HUCK-1310',
    '0EJ0FT': 'HUCK-1311',
    '0EJ0FU': 'HUCK-1312',
    '0EJ0FV': 'HUCK-1313',
    '0EJ0FW': 'HUCK-1360',
    '0EJ0FX': 'HUCK-1359',
    '0EJ0FY': 'HUCK-1358',
    '0EJ0FZ': 'HUCK-1357',
    '0EJ0G0': 'HUCK-1356',
    '0EJ0G1': 'HUCK-1355',
    '0EJ0G2': 'HUCK-1354',
    '0EJ0G3': 'HUCK-1353',
    '0EJ0G4': 'HUCK-1352',
    '0EJ0G5': 'HUCK-1351',
    '0EJ0G6': 'HUCK-1350',
    '0EJ0G7': 'HUCK-1349',
    '0EJ0G8': 'HUCK-1348',
    '0EJ0G9': 'HUCK-1347',
    '0EJ0GA': 'HUCK-1346',
    '0EJ0GB': 'HUCK-1345',
    '0EJ0GC': 'HUCK-1344',
    '0EJ0GD': 'HUCK-1343',
    '0EJ0GE': 'HUCK-1342',
    '0EJ0GF': 'HUCK-1341',
    '0EJ0GG': 'HUCK-9562',
    '0EJ0GH': 'HUCK-1340',
    '0EJ0GI': 'HUCK-1339',
    '0EJ0GJ': 'HUCK-1338',
    '0EJ0GK': 'HUCK-1337',
    '0EJ0GL': 'HUCK-1336',
    '0EJ0GM': 'HUCK-1335',
    '0EJ0GN': 'HUCK-1334',
    '0EJ0GO': 'HUCK-1333',
    '0EJ0GP': 'HUCK-1332',
    '0EJ0GQ': 'HUCK-1314',
    '0EJ0GR': 'HUCK-1373',
    '0EJ0GS': 'HUCK-1372',
    '0EJ0GT': 'HUCK-1371',
    '0EJ0GU': 'HUCK-1370',
    '0EJ0GV': 'HUCK-1369',
    '0EJ0GW': 'HUCK-1368',
    '0EJ0GX': 'HUCK-1367',
    '0EJ0GY': 'HUCK-1366',
    '0EJ0GZ': 'HUCK-1365',
    '0EJ0H0': 'HUCK-1364',
    '0EJ0H1': 'HUCK-1363',
    '0EJ0H2': 'HUCK-1362',
    '0EJ0H3': 'HUCK-1361',
    '0EJ0H4': 'HUCK-9929',
    '0EJ0H5': 'HUCK-1380',
    '0EJ0H6': 'HUCK-1403',
    '0EJ0H7': 'HUCK-1400',
    '0EJ0H8': 'HUCK-1390',
    '0EJ0H9': 'HUCK-1389',
    '0EJ0HA': 'HUCK-1436',
    '0EJ0HB': 'HUCK-1388',
    '0EJ0HC': 'HUCK-1387',
    '0EJ0HD': 'HUCK-1386',
    '0EJ0HG': 'HUCK-1377',
    '0EJ0HH': 'HUCK-1330',
    '0EJ0HI': 'HUCK-1329',
    '0EJ0HJ': 'HUCK-1326',
    '0EJ0HK': 'HUCK-1324',
    '0EJ0HL': 'BB-0EJ0HL',
    '0EJ0HM': 'BB-0EJ0HM',
    '0EJ0HN': 'BB-0056',
    '0EJ0HO': 'BB-0EJ0HO',
    '0EJ0HP': 'BB-0EJ0HP',
    '0EJ0HQ': 'BB-0052',
    '0EJ0HR': 'BB-0EJ0HR',
    '0EJ0HS': 'BB-0EJ0HS',
    '0EJ0HT': 'BB-0EJ0HT',
    '0EJ0HU': 'BB-0EJ0HU',
    '0EJ0HV': 'BB-0EJ0HV',
    '0EJ0HW': 'BB-0EJ0HW',
    '0EJ0HX': 'BB-0033',
    '0EJ0HY': 'BB-0EJ0HY',
    '0EJ0HZ': 'BB-0EJ0HZ',
    '0EJ0I3': 'BB-0EJ0I3',
    '0EJ0I4': 'BB-0EJ0I4',
    '0EJ0I5': 'BB-0EJ0I5',
    '0EJ0I7': 'BB-0EJ0I7',
    '0EJ0I8': 'BB-0EJ0I8',
    '0EJ0I9': 'BB-0EJ0I9',
    '0EJ0IB': 'BB-0EJ0IB',
    '0EJ0ID': 'BB-0EJ0ID',
    '0EJ0IE': 'BB-0EJ0IE',
    '0EJ0IG': 'BB-0EJ0IG',
    '0EJ0IH': 'BB-0044',
    '0EJ0II': 'BB-0EJ0II',
    '0EJ0IJ': 'BB-0034',
    '0EJ0IK': 'BB-0EJ0IK',
    '0EJ0IL': 'BB-0003',
    '0EJ0IM': 'BB-0EJ0IM',
    '0EJ0IN': 'BB-0031',
    '0EJ0IO': 'BB-0EJ0IO',
    '0EJ0IP': 'BB-0EJ0IP',
    '0EJ0IQ': 'BB-0EJ0IQ',
    '0EJ0IR': 'BB-0EJ0IR',
    '0EJ0IS': 'BB-0EJ0IS',
    '0EJ0IT': 'BB-0038',
    '0EJ0IU': 'BB-0040',
    '0EJ0IV': 'BB-0019',
    '0EJ0IW': 'BB-0EJ0IW',
    '0EJ0IX': 'BB-0EJ0IX',
    '0EJ0IY': 'BB-0EJ0IY',
    '0EJ0IZ': 'BB-0EJ0IZ',
    '0EJ0J0': 'BB-0EJ0J0',
    '0EJ0J1': 'BB-0EJ0J1',
    '0EJ0J2': 'BB-0EJ0J2',
    '0EJ0J3': 'BB-0EJ0J3',
    '0EJ0J4': 'BB-0EJ0J4',
    '0EJ0J5': 'BB-0030',
    '0EJ0J6': 'BB-0EJ0J6',
    '0EJ0J7': 'BB-0EJ0J7',
    '0EJ0J8': 'BB-0021',
    '0EJ0J9': 'BB-0EJ0J9',
    '0EJ0JA': 'BB-0EJ0JA',
    '0EJ0JB': 'BB-0EJ0JB',
    '0EJ0JD': 'HUCK-1407',
    '0EJ0JE': 'HUCK-0035',
    '0EJ0JF': 'HUCK-2297',
    '0EJ0JG': 'HUCK-0910',
    '0EJ0JH': 'HUCK-1462',
    '0EJ0JI': 'HUCK-1463',
    '0EJ0JK': 'HUCK-1460',
    '0EJ0JL': 'HUCK-1464',
    '0EJ0JM': 'HUCK-1465',
    '0EJ0JN': 'HUCK-1422',
    '0EJ0JO': 'HUCK-1466',
    '0EJ0JP': 'HUCK-1431',
    '0EJ0JQ': 'HUCK-1409',
    '0EJ0JR': 'HUCK-1262',
    '0EJ0JS': 'HUCK-1384',
    '0EJ0JT': 'HUCK-1418',
    '0EJ0JU': 'HUCK-1417',
    '0EJ0JV': 'HUCK-1467',
    '0EJ0JW': 'HUCK-0164',
    '0EJ0JX': 'HUCK-1469',
    '0EJ0JY': 'HUCK-0165',
    '0EJ0JZ': 'BB-0EJ0JZ',
    '0EJ0K1': 'BB-0EJ0K1',
    '0EJ0K2': 'BB-0EJ0K2',
    '0EJ0K5': 'BB-0EJ0K5',
    '0EJ0K7': 'BB-0EJ0K7',
    '0EJ0K9': 'BB-0EJ0K9',
    '0EJ0KA': 'BB-0EJ0KA',
    '0EJ0KF': 'BB-0EJ0KF',
    '0EJ0KN': 'BB-0EJ0KN',
    '0EJ0LI': 'BB-0EJ0LI',
    '0EJ0LL': 'BB-0EJ0LL',
    '0EJ0LM': 'BB-0050',
    '0EJ0LO': 'BB-0EJ0LO',
    '0EJ0LQ': 'BB-0EJ0LQ',
    '0EJ0LT': 'BB-0EJ0LT',
    '0EJ0LU': 'BB-0EJ0LU',
    '0EJ0LV': 'BB-0EJ0LV',
    '0EJ0LW': 'BB-0EJ0LW',
    '0EJ0LY': 'BB-0EJ0LY',
    '0EJ0LZ': 'BB-0EJ0LZ',
    '0EJ0M0': 'BB-0EJ0M0',
    '0EJ0M1': 'BB-0EJ0M1',
    '0EJ0M2': 'BB-0EJ0M2',
    '0EJ0M3': 'BB-0EJ0M3',
    '0EJ0M4': 'BB-0EJ0M4',
    '0EJ0M6': 'BB-0EJ0M6',
    '0EJ0M7': 'BB-0EJ0M7',
    '0EJ0M8': 'HUCK-1498',
    '0EJ0M9': 'HUCK-1491',
    '0EJ0MA': 'HUCK-1490',
    '0EJ0MB': 'HUCK-1489',
    '0EJ0MC': 'HUCK-1492',
    '0EJ0MD': 'HUCK-0049',
    '0EJ0ME': 'HUCK-1475',
    '0EJ0MF': 'HUCK-1408',
    '0EJ0MG': 'HUCK-1471',
    '0EJ0MH': 'HUCK-1470',
    '0EJ0MI': 'HUCK-1401',
    '0EJ0MJ': 'HUCK-1260',
    '0EJ0MK': 'HUCK-1258',
    '0EJ0ML': 'HUCK-1392',
    '0EJ0MM': 'HUCK-1426',
    '0EJ0MN': 'HUCK-1323',
    '0EJ0MO': 'HUCK-3621',
    '0EJ0MP': 'HUCK-2808',
    '0EJ0MR': 'HUCK-9448',
    '0EJ0MS': 'HUCK-1817',
    '0EJ0MT': 'HUCK-4089',
    '0EJ0MU': 'HUCK-8968',
    '0EJ0MV': 'HUCK-1327',
    '0EJ0MW': 'HUCK-9724',
    '0EJ0MX': 'HUCK-0017',
    '0EJ0MY': 'HUCK-9732',
    '0EJ0MZ': 'HUCK-9930',
    '0EJ0N0': 'HUCK-5064',
    '0EJ0N1': 'HUCK-0158',
    '0EJ0N2': 'HUCK-0374',
    '0EJ0N3': 'HUCK-1501',
    '0EJ0N4': 'HUCK-0127',
    '0EJ0N5': 'HUCK-1414',
    '0EJ0N6': 'HUCK-1502',
    '0EJ0N7': 'HUCK-0034',
    '0EJ0N8': 'HUCK-1440',
    '0EJ0N9': 'HUCK-0024',
    '0EJ0NA': 'HUCK-1504',
    '0EJ0NB': 'HUCK-1503',
    '0EJ0NC': 'HUCK-1449',
    '0EJ0ND': 'HUCK-1500',
    '0EJ0NE': 'HUCK-0025',
    '0EJ0NF': 'HUCK-1325',
    '0EJ0NG': 'HUCK-1412',
    '0EJ0NH': 'HUCK-1445',
    '0EJ0NI': 'HUCK-1405',
    '0EJ0NJ': 'HUCK-1376',
    '0EJ0NK': 'HUCK-1506',
    '0EJ0NL': 'HUCK-1488',
    '0EJ0NM': 'HUCK-1507',
    '0EJ0NN': 'HUCK-1487',
    '0EJ0NO': 'HUCK-1508',
    '0EJ0NP': 'HUCK-1509',
    '0EJ0NQ': 'HUCK-9455',
    '0EJ0NR': 'HUCK-9463',
    '0EJ0NS': 'HUCK-9464',
    '0EJ0NT': 'HUCK-9465',
    '0EJ0NU': 'HUCK-9461',
    '0EJ0NV': 'HUCK-9460',
    '0EJ0NW': 'HUCK-9462',
    '0EJ0NX': 'HUCK-1795',
    '0EJ0NY': 'HUCK-9459',
    '0EJ0NZ': 'HUCK-9457',
    '0EJ0O0': 'HUCK-9458',
    '0EJ0O1': 'HUCK-9456',
    '0EJ0O2': 'HUCK-1789',
    '0EJ0O3': 'HUCK-1796',
    '0EJ0O4': 'HUCK-1803',
    '0EJ0O5': 'HUCK-1802',
    '0EJ0O6': 'HUCK-9452',
    '0EJ0O7': 'HUCK-1794',
    '0EJ0O8': 'HUCK-1793',
    '0EJ0O9': 'HUCK-1790',
    '0EJ0OA': 'HUCK-9474',
    '0EJ0OB': 'HUCK-9475',
    '0EJ0OC': 'HUCK-9472',
    '0EJ0OD': 'HUCK-9471',
    '0EJ0OE': 'HUCK-1787',
};

export interface MdPreverifiedMultiBin {
    upc: string | null;
    altUpc?: string;
    octUnitsSold: number;
    expectedRemainingQty: number;
    unitPrice: number;
    unitCostOverride: number | null;
    totalUnitsInLot: number | null;
    label: string;
}

export const PREVERIFIED_MD_MULTI_QTY_BINS: Record<string, MdPreverifiedMultiBin> = {
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
        totalUnitsInLot: 4,
        unitCostOverride: Number((17.82 / 4).toFixed(2)), // $4.46
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
        totalUnitsInLot: 44,
        unitCostOverride: Number((35.74 / 44).toFixed(2)), // $0.81
        label: 'Startrek/SciFi Paperbacks',
    },
    '0EJ0NQ': {
        upc: 'HUCK-9455',
        octUnitsSold: 1,
        expectedRemainingQty: 8,
        unitPrice: 10.00,
        totalUnitsInLot: 9,
        unitCostOverride: Number((23.45 / 9).toFixed(2)), // $2.61
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
        totalUnitsInLot: 3,
        unitCostOverride: Number((12.47 / 3).toFixed(2)), // $4.16
        label: 'Vintage Paperback Books J.R.R. Tolkien',
    },
    '0EJ0M8': {
        upc: 'HUCK-1498',
        octUnitsSold: 2,
        expectedRemainingQty: 15,
        unitPrice: 10.00,
        totalUnitsInLot: null,
        unitCostOverride: 0.04,
        label: 'Fantasy/Sci-Fi MM Paperbacks',
    },
};

export function normalizeTitleForMdMatch(str: any): string {
    return String(str ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

export function computeMdTitleSimilarity(normA: string, normB: string): number {
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
 * Strict Namespace Check for B&B (Biggie & Birdie) CSV rows & DB items.
 * B&B rows must NEVER match HUCK- or PDXGL- items (and vice versa).
 */
export function isBbConsignorRow(params: { sku?: any; upc?: any; title?: any; extraText?: any }): boolean {
    const normSku = cleanCatalogSku(params.sku).toUpperCase();
    const normUpc = cleanCatalogSku(params.upc).toUpperCase();
    const rawTitle = String(params.title ?? '').trim();
    if (PREVERIFIED_OCT_BB_SKUS.has(normSku)) return true;
    if (normUpc.startsWith('BB-') || normSku.startsWith('BB-')) return true;
    if (/^B\s*&\s*B\b/i.test(rawTitle) || /^BB[\s-]/i.test(rawTitle)) return true;
    if (params.extraText && /biggie/i.test(String(params.extraText))) return true;
    return false;
}

export function isBbConsignorDbItem(item: any): boolean {
    if (!item) return false;
    const upc = cleanCatalogSku(item.upc).toUpperCase();
    if (upc.startsWith('HUCK-') || upc.startsWith('PDXGL-')) return false;
    if (upc.startsWith('BB-') || item.isSubClient) return true;
    const title = String(item.title || item.identity || '').trim();
    if (/^B\s*&\s*B\b/i.test(title)) return true;
    const sku = cleanCatalogSku(item.locationSku || item.sku).toUpperCase();
    if (PREVERIFIED_OCT_BB_SKUS.has(sku)) return true;
    return false;
}

/**
 * Resolves the canonical per-unit cost basis for a Memory Den sale.
 * Enforces exact per-unit cost overrides on pooled Multi-Qty Booth Bins ($2.61, $0.81, $4.46, $4.16)
 * and $0.00 cost basis on B&B consignment items.
 */
export function resolveMdUnitCostBasis(item: any, sku?: any, isMultiQty?: boolean): number {
    const normSku = cleanCatalogSku(sku || item?.locationSku || item?.sku).toUpperCase();
    const normUpc = cleanCatalogSku(item?.upc).toUpperCase();

    if (isBbConsignorDbItem(item) || PREVERIFIED_OCT_BB_SKUS.has(normSku)) {
        return 0;
    }

    // Check by SKU or by matching UPC in PREVERIFIED_MD_MULTI_QTY_BINS
    let binConfig = PREVERIFIED_MD_MULTI_QTY_BINS[normSku];
    if (!binConfig && normUpc) {
        binConfig = Object.values(PREVERIFIED_MD_MULTI_QTY_BINS).find(
            b => (b.upc && b.upc.toUpperCase() === normUpc) || (b.altUpc && b.altUpc.toUpperCase() === normUpc)
        ) as any;
    }

    const rawCost = Number(item?.cost ?? item?.purchasePrice ?? 0);
    if (binConfig) {
        if (binConfig.unitCostOverride !== null && binConfig.unitCostOverride !== undefined) {
            return Number(binConfig.unitCostOverride.toFixed(2));
        }
        if (binConfig.totalUnitsInLot && binConfig.totalUnitsInLot > 1 && rawCost > 0) {
            return Number((rawCost / binConfig.totalUnitsInLot).toFixed(2));
        }
        return Number((Number.isFinite(rawCost) ? rawCost : 0).toFixed(2));
    }

    if (isMultiQty && item) {
        const qty = Math.max(1, Number(item.quantity || 1));
        if (qty > 1 && rawCost > 0) {
            return Number((rawCost / qty).toFixed(2));
        }
    }

    return Number((Number.isFinite(rawCost) ? rawCost : 0).toFixed(2));
}

/**
 * Resolves the canonical 0EJ SKU for a Payouts CSV row when the Payouts export has no SKU column.
 */
export function resolveMemoryDenSkuFromPayoutRow(params: {
    extractedSku?: string;
    itemName: string;
    ticketNumber?: string;
    grossPrice?: number;
}): string {
    const existing = cleanCatalogSku(params.extractedSku).toUpperCase();
    if (existing) return existing;

    const normPayoutTitle = normalizeTitleForMdMatch(params.itemName);
    const ticket = canonicalTicketNumber(params.ticketNumber) || String(params.ticketNumber || '').trim();

    if (!normPayoutTitle) return '';

    // 1. Check pre-verified single items by saleNum + title prefix
    for (const [sku, info] of Object.entries(PREVERIFIED_MD_SINGLE_UPC_BY_SKU)) {
        const normInfoLabel = normalizeTitleForMdMatch(info.label);
        if (ticket && info.saleNum === ticket && (
            normPayoutTitle.startsWith(normInfoLabel.slice(0, 18)) ||
            normInfoLabel.startsWith(normPayoutTitle.slice(0, 18))
        )) {
            return sku;
        }
    }

    // 2. Check pre-verified Multi-Qty Booth Bins by title prefix
    for (const [sku, binInfo] of Object.entries(PREVERIFIED_MD_MULTI_QTY_BINS)) {
        const normBinLabel = normalizeTitleForMdMatch(binInfo.label);
        if (normPayoutTitle.startsWith(normBinLabel.slice(0, 14)) || normBinLabel.startsWith(normPayoutTitle.slice(0, 14))) {
            return sku;
        }
    }

    // 3. Fallback: check pre-verified single items by title prefix + price
    for (const [sku, info] of Object.entries(PREVERIFIED_MD_SINGLE_UPC_BY_SKU)) {
        const normInfoLabel = normalizeTitleForMdMatch(info.label);
        if (
            (normPayoutTitle.startsWith(normInfoLabel.slice(0, 18)) || normInfoLabel.startsWith(normPayoutTitle.slice(0, 18))) &&
            (!params.grossPrice || Math.abs(info.gross - params.grossPrice) < 0.05)
        ) {
            return sku;
        }
    }

    return '';
}

/**
 * Builds the locked Multi-Qty Booth Bin map (`sku -> dbItem`) and claims their `$id`s so
 * sold split children (like HUCK-9515) or single items (like 0EJ0C7) can never hijack a Booth Bin.
 */
export function buildLockedMultiBinMap(
    activeItems: any[],
    claimedItemIdToSku: Map<string, string> = new Map()
): Map<string, any> {
    const multiBinResolvedBySku = new Map<string, any>();
    const isSoldUnitSplitChild = (it: any) => /\(sold unit\)/i.test(String(it?.title || ''));

    for (const [binSku, binConfig] of Object.entries(PREVERIFIED_MD_MULTI_QTY_BINS)) {
        let foundBinItem: any = null;

        // 1. Explicit primary UPC (e.g. HUCK-1309 for 0EJ0FR, HUCK-1425 for 0EJ0H5)
        if (binConfig.upc) {
            const targetUpc = binConfig.upc.toUpperCase();
            foundBinItem = activeItems.find(i => cleanCatalogSku(i?.upc).toUpperCase() === targetUpc && !isSoldUnitSplitChild(i));
        }
        // 2. Alternate UPC (e.g. HUCK-1380 for 0EJ0H5)
        if (!foundBinItem && binConfig.altUpc) {
            const altUpc = binConfig.altUpc.toUpperCase();
            foundBinItem = activeItems.find(i => cleanCatalogSku(i?.upc).toUpperCase() === altUpc && !isSoldUnitSplitChild(i));
        }
        // 3. SKU match preferring placed & multi-qty over sold split children
        if (!foundBinItem) {
            const skuCandidates = activeItems.filter(
                i => cleanCatalogSku(i?.locationSku || i?.sku).toUpperCase() === binSku && !isSoldUnitSplitChild(i)
            );
            foundBinItem = skuCandidates.find(c => c.status === 'placed' && Number(c.quantity ?? 1) > 1)
                || skuCandidates.find(c => c.status === 'placed')
                || skuCandidates[0]
                || null;
        }
        // 4. Title match preferring placed & multi-qty
        if (!foundBinItem) {
            const normLabel = normalizeTitleForMdMatch(binConfig.label);
            const titleCandidates = activeItems.filter(i => {
                if (isSoldUnitSplitChild(i)) return false;
                const s = String(i?.status || '').toLowerCase();
                if (s === 'combined' || s === 'deconstructed' || s === 'tracked' || s === 'draft' || s === 'scouted') return false;
                const candTitle = normalizeTitleForMdMatch(i?.title || i?.identity);
                return candTitle && (candTitle === normLabel || candTitle.startsWith(normLabel) || normLabel.startsWith(candTitle));
            });
            foundBinItem = titleCandidates.find(c => c.status === 'placed' && Number(c.quantity ?? 1) > 1)
                || titleCandidates.find(c => c.status === 'placed')
                || titleCandidates[0]
                || null;
        }

        if (foundBinItem) {
            multiBinResolvedBySku.set(binSku, foundBinItem);
            claimedItemIdToSku.set(foundBinItem.$id, binSku);
        }
    }

    return multiBinResolvedBySku;
}

/**
 * Matches a Memory Den Products-*.csv or Payouts *.csv row against resale_db.items
 * enforcing all verified invariants:
 * - Multi-Qty Booth Bin priority & lock (0EJ0FR -> HUCK-1309, 0EJ0H5 -> HUCK-1425/HUCK-1380)
 * - Trap guards (0EJ0NY -> HUCK-9459 sold; 0EJ0O0 -> HUCK-9458 placed)
 * - Strict B&B (BB-) vs HUCK-/PDXGL- namespace isolation
 * - Anti-fuzzy guardrails (blocks <15 char generic titles, requires >=85% similarity & price within $5)
 */
export function matchMemoryDenInventoryItem(params: {
    sku?: string;
    upc?: string;
    title?: string;
    price?: number;
    extraText?: string;
    allowPrefixForPayout?: boolean;
    activeItems: any[];
    claimedItemIdToSku?: Map<string, string>;
    multiBinResolvedBySku?: Map<string, any>;
}): any | null {
    const normSku = cleanCatalogSku(params.sku).toUpperCase();
    const normUpc = cleanCatalogSku(params.upc).toUpperCase();
    const price = Number(params.price ?? 0);
    const activeItems = params.activeItems || [];
    const claimed = params.claimedItemIdToSku || new Map<string, string>();
    const multiBins = params.multiBinResolvedBySku || buildLockedMultiBinMap(activeItems, claimed);
    const rowIsBb = isBbConsignorRow({ sku: normSku, upc: normUpc, title: params.title, extraText: params.extraText });
    const isSoldUnitSplitChild = (it: any) => /\(sold unit\)/i.test(String(it?.title || ''));

    const dereferenceParent = (itm: any): any => {
        if (!itm) return null;
        const s = String(itm.status || '').toLowerCase().trim();
        if ((s === 'combined' || s === 'deconstructed') && itm.parentLotId) {
            const parent = activeItems.find(p => p.$id === itm.parentLotId);
            if (parent) return dereferenceParent(parent);
        }
        return itm;
    };

    const rowClaimKey = normSku || normalizeTitleForMdMatch(params.title);

    const canUseCandidate = (cand: any): boolean => {
        if (!cand) return false;
        const s = String(cand.status || '').toLowerCase().trim();
        if (s === 'tracked' || s === 'draft' || s === 'scouted') return false;
        if (isSoldUnitSplitChild(cand)) return false;
        const candIsBb = isBbConsignorDbItem(cand);
        if (rowIsBb !== candIsBb) return false;
        const candLocSku = cleanCatalogSku(cand.locationSku || cand.sku).toUpperCase();
        if (normSku && /^0EJ/i.test(normSku) && /^0EJ/i.test(candLocSku) && candLocSku !== normSku) {
            return false;
        }
        const existingClaimSku = claimed.get(cand.$id);
        if (existingClaimSku && existingClaimSku !== normSku && existingClaimSku !== rowClaimKey) return false;
        return true;
    };

    // 0. Pre-resolved Multi-Qty Booth Bins
    if (normSku && multiBins.has(normSku)) {
        return multiBins.get(normSku);
    }

    // 1. Explicit Trap Guards: 0EJ0NY -> HUCK-9459 (smaller rounded bag); 0EJ0O0 -> HUCK-9458 (larger gothic backpack)
    if (normSku === '0EJ0NY') {
        const huck9459 = activeItems.find(i => cleanCatalogSku(i?.upc).toUpperCase() === 'HUCK-9459');
        if (huck9459) return dereferenceParent(huck9459);
    }
    if (normSku === '0EJ0O0') {
        const huck9458 = activeItems.find(i => cleanCatalogSku(i?.upc).toUpperCase() === 'HUCK-9458');
        if (huck9458) return dereferenceParent(huck9458);
    }

    // 2. Pre-verified SKU -> UPC/ID override map (PREVERIFIED_MD_SKU_TO_UPC_OR_ID + PREVERIFIED_MD_SINGLE_UPC_BY_SKU)
    const preMappedTarget = normSku ? PREVERIFIED_MD_SKU_TO_UPC_OR_ID[normSku] : '';
    if (preMappedTarget) {
        const upperTarget = preMappedTarget.toUpperCase();
        const byMapped = activeItems.find(
            i => (cleanCatalogSku(i?.upc).toUpperCase() === upperTarget || String(i?.$id || '') === preMappedTarget) && canUseCandidate(i)
        );
        if (byMapped) return dereferenceParent(byMapped);
    }

    const preSingle = PREVERIFIED_MD_SINGLE_UPC_BY_SKU[normSku];
    if (preSingle && preSingle.upc) {
        const targetPreUpc = preSingle.upc.toUpperCase();
        const byPreUpc = activeItems.find(i => cleanCatalogSku(i?.upc).toUpperCase() === targetPreUpc && canUseCandidate(i));
        if (byPreUpc) return dereferenceParent(byPreUpc);
        if (preSingle.altUpc) {
            const altPreUpc = preSingle.altUpc.toUpperCase();
            const byAltUpc = activeItems.find(i => cleanCatalogSku(i?.upc).toUpperCase() === altPreUpc && canUseCandidate(i));
            if (byAltUpc) return dereferenceParent(byAltUpc);
        }
    }

    // 3. Direct UPC match
    if (normUpc) {
        const byUpc = activeItems.find(i => cleanCatalogSku(i?.upc).toUpperCase() === normUpc && canUseCandidate(i));
        if (byUpc) return dereferenceParent(byUpc);
    }

    // 4. Direct locationSku match (preferring active placed / multi-qty over sold duplicates)
    if (normSku) {
        const skuHits = activeItems.filter(i => {
            const iLocSku = cleanCatalogSku(i?.locationSku || i?.sku).toUpperCase();
            const iUpc = cleanCatalogSku(i?.upc).toUpperCase();
            return (iLocSku === normSku || iUpc === normSku) && canUseCandidate(i);
        });
        if (skuHits.length > 0) {
            const chosen = skuHits.find(it => it.status === 'placed' && Number(it.quantity ?? 1) > 1)
                || skuHits.find(it => String(it.status || '').toLowerCase() !== 'sold')
                || skuHits[0];
            return dereferenceParent(chosen);
        }
    }

    // 5. Strict Title Matching (Never let short/generic <15 char titles fuzzy match!)
    const normTitle = normalizeTitleForMdMatch(params.title);
    if (!normTitle || normTitle.length < 15) {
        return null;
    }

    const titleEligible = activeItems.filter(i => {
        const s = String(i?.status || '').toLowerCase().trim();
        if (s === 'combined' || s === 'deconstructed') return false;
        return canUseCandidate(i);
    });

    // 5a. Exact normalized title match
    const exactMatch = titleEligible.find(c => {
        const candTitle = normalizeTitleForMdMatch(c.title || c.identity);
        if (candTitle !== normTitle) return false;
        const dbPrice = Number(c.resalePrice ?? 0);
        if (price > 0 && dbPrice > 0 && !preSingle && Math.abs(dbPrice - price) > 5.01) return false;
        return true;
    });
    if (exactMatch) return dereferenceParent(exactMatch);

    // 5b. High-similarity (>= 85%) or Payouts 32-char prefix match
    let bestCand: any = null;
    let bestScore = 0;
    for (const c of titleEligible) {
        const candTitle = normalizeTitleForMdMatch(c.title || c.identity);
        if (candTitle.length < 15) continue;
        const sim = computeMdTitleSimilarity(normTitle, candTitle);
        const isPayoutPrefix = Boolean(params.allowPrefixForPayout) && normTitle.length >= 18 &&
            (candTitle.startsWith(normTitle) || normTitle.startsWith(candTitle));

        if (sim >= 0.85 || isPayoutPrefix) {
            const dbPrice = Number(c.resalePrice ?? 0);
            if (price > 0 && dbPrice > 0 && !preSingle && Math.abs(dbPrice - price) > 5.01) continue;
            const score = isPayoutPrefix ? Math.max(sim, 0.86) : sim;
            if (score > bestScore) {
                bestScore = score;
                bestCand = c;
            }
        }
    }

    return bestCand ? dereferenceParent(bestCand) : null;
}

/**
 * Extracts the primary imageId or galleryImageIds[0] from an item document.
 */
export function getPrimaryItemImageId(item: any): string {
    if (!item) return '';
    if (typeof item.imageId === 'string' && item.imageId.trim()) return item.imageId.trim();
    if (Array.isArray(item.galleryImageIds) && item.galleryImageIds.length > 0) {
        const first = String(item.galleryImageIds[0] || '').trim();
        if (first) return first;
    }
    return '';
}

export interface UnclaimedMatchCandidateResult {
    item: any;
    score: number;
    confidence: number;
    reasons: string[];
    priceDiff: number | null;
    isExactPrice: boolean;
    isClosePrice: boolean;
    isParentLot: boolean;
    estimatedLotCount: number;
    unitCostShare: number;
    recommendedAction: 'link' | 'split_lot' | 'create_new';
}

const PARENT_LOT_TITLE_REGEX = /\b(lot\s+of\s+\d+|\d+\s*(pcs|pc|pack|lot|set|issues|books|mags|magazines|figures|wands|pins|cards)|bulk\s+lot|mixed\s+lot|collection\s+lot)\b/i;

/**
 * Detects whether an inventory item is a multi-piece Parent Lot or Multi-Qty Bin
 * that can have individual pieces split & linked to multiple Memory Den booth SKUs.
 */
export function isParentLotCandidate(item: any): boolean {
    if (!item) return false;
    const qty = Number(item.quantity ?? 1);
    if (qty > 1) return true;
    const title = String(item.title || item.identity || '');
    if (PARENT_LOT_TITLE_REGEX.test(title)) return true;
    if (Array.isArray(item.components) && item.components.length > 1) return true;
    if (typeof item.components === 'string' && item.components.trim().startsWith('[')) {
        try {
            const parsed = JSON.parse(item.components);
            if (Array.isArray(parsed) && parsed.length > 1) return true;
        } catch {}
    }
    return false;
}

/**
 * Extracts the estimated piece count from a Parent Lot's quantity, components array, or title ("Lot of 5", "18 pcs", etc.).
 */
export function extractEstimatedLotPieceCount(item: any): number {
    if (!item) return 1;
    const qty = Number(item.quantity ?? 1);
    if (qty > 1) return qty;
    if (Array.isArray(item.components) && item.components.length > 1) {
        return item.components.length;
    }
    if (typeof item.components === 'string' && item.components.trim().startsWith('[')) {
        try {
            const parsed = JSON.parse(item.components);
            if (Array.isArray(parsed) && parsed.length > 1) return parsed.length;
        } catch {}
    }
    const title = String(item.title || item.identity || '');
    const lotOfMatch = title.match(/\blot\s+of\s+(\d{1,3})\b/i);
    if (lotOfMatch) {
        const n = parseInt(lotOfMatch[1], 10);
        if (n > 1) return n;
    }
    const pcsMatch = title.match(/\b(\d{1,3})\s*(pcs|pc|pack|lot|set|issues|books|mags|magazines|figures|wands|pins)\b/i);
    if (pcsMatch) {
        const n = parseInt(pcsMatch[1], 10);
        if (n > 1) return n;
    }
    return isParentLotCandidate(item) ? 4 : 1;
}

const MATCH_STOP_WORDS = new Set([
    'the', 'and', 'with', 'for', 'from', 'into', 'over', 'under', 'this', 'that',
    'item', 'pcs', 'pc', 'pack', 'lot', 'lots', 'assorted', 'mixed', 'bundle',
    'collection', 'of', 'in', 'on', 'to', 'by', 'at', 'or', 'an', 'as', 'is',
]);

/**
 * Generic category, form-factor, condition, and multi-item brand tokens.
 * Matching ONLY these tokens without matching specific/identifying tokens
 * must NEVER produce a High Confidence (88%+) score.
 */
const GENERIC_CATEGORY_FORM_TOKENS = new Set([
    // RPG / Books / Media generic form & system words
    'dungeons', 'dragons', 'dnd', 'add', 'ad', 'rpg', 'ttrpg', 'fantasy', 'scifi',
    'game', 'games', 'gaming', 'tabletop', 'board', 'card', 'cards', 'dice',
    'book', 'books', 'rulebook', 'sourcebook', 'supplement', 'module', 'adventure',
    'campaign', 'setting', 'settings', 'world', 'edition', 'ed', 'vol', 'volume',
    'issue', 'issues', 'magazine', 'magazines', 'mag', 'mags', 'hardcover',
    'softcover', 'paperback', 'hc', 'pb', 'tsr', 'wizards', 'coast', 'wotc',
    'box', 'boxed', 'set', 'sets', 'kit', 'starter', 'core', 'complete',
    // Apparel / Accessories / Condition generic words
    'vintage', 'vtg', 'retro', 'modern', 'classic', 'style', 'new', 'old', 'used',
    'preowned', 'nwt', 'nwot', 'size', 'sz', 'small', 'medium', 'large', 'xl',
    'xxl', '2x', '3x', 'xs', 'petite', 'tall', 'plus', 'womens', 'women', 'woman',
    'mens', 'men', 'man', 'unisex', 'adult', 'ladies', 'shirt', 'blouse', 'top',
    'tee', 'tshirt', 'dress', 'skirt', 'pants', 'jeans', 'trousers', 'shorts',
    'jacket', 'coat', 'sweater', 'cardigan', 'hoodie', 'sweatshirt', 'vest',
    'suit', 'blazer', 'hat', 'cap', 'beanie', 'beret', 'cloche', 'bowler',
    'bag', 'handbag', 'purse', 'tote', 'backpack', 'wallet', 'clutch', 'crossbody',
    'belt', 'scarf', 'gloves', 'shoes', 'boots', 'sandals', 'heels', 'sneakers',
    'flats', 'loafers', 'jewelry', 'necklace', 'bracelet', 'earrings', 'ring',
    'pin', 'pins', 'brooch', 'pendant', 'charm', 'wand', 'wands', 'print',
    'printed', 'pattern', 'patterned', 'solid', 'graphic', 'sleeve', 'sleeves',
    'long', 'short', 'sleeveless', 'button', 'front', 'open', 'zip', 'zipper',
    'collar', 'collared', 'neck', 'vneck', 'crew', 'scoop', 'mock', 'turtleneck',
    'mini', 'midi', 'maxi', 'cropped', 'high', 'low', 'rise', 'waist', 'fit',
    'slim', 'relaxed', 'loose', 'stretch', 'cotton', 'silk', 'wool', 'polyester',
    'linen', 'rayon', 'nylon', 'spandex', 'acrylic', 'cashmere', 'leather', 'faux',
    'suede', 'velvet', 'satin', 'chiffon', 'denim', 'corduroy', 'fleece', 'flannel',
    'lace', 'mesh', 'knit', 'woven', 'collectible', 'collectibles', 'figure',
    'figures', 'miniature', 'miniatures', 'statue', 'toy', 'toys', 'plush',
    'art', 'decor', 'wall', 'framed', 'poster',
    // High-frequency multi-item brands (require matching color/motif/specific noun to be high confidence)
    'banana', 'republic', 'ann', 'taylor', 'loft', 'chicos', 'talbots', 'jcrew',
    'anthropologie', 'free', 'people', 'zara', 'uniqlo', 'express', 'torrid',
    'lane', 'bryant', 'eileen', 'fisher', 'lularoe', 'gap', 'target', 'universal',
    'thread', 'wild', 'fable', 'shein', 'romwe', 'forever', 'charlotte', 'russe',
    'hot', 'topic', 'tripp', 'nyc', 'killstar', 'disturbia', 'foxblood', 'blackcraft',
    'restyle', 'punk', 'rave', 'widow', 'dollskill', 'betsey', 'johnson', 'michael',
    'kors', 'coach', 'kate', 'spade', 'levi', 'levis', 'wrangler', 'lee', 'cece',
    'notations', 'madusella', 'her', 'promise', 'desigual',
]);

const COLOR_CONFLICT_TOKENS = new Set([
    'black', 'white', 'red', 'blue', 'navy', 'green', 'emerald', 'olive', 'sage',
    'yellow', 'gold', 'mustard', 'orange', 'rust', 'coral', 'purple', 'violet',
    'plum', 'lavender', 'lilac', 'pink', 'magenta', 'fuchsia', 'rose', 'blush',
    'brown', 'tan', 'camel', 'beige', 'cream', 'ivory', 'khaki', 'grey', 'gray',
    'charcoal', 'silver', 'burgundy', 'maroon', 'wine', 'teal', 'turquoise', 'aqua',
]);

const PATTERN_CONFLICT_TOKENS = new Set([
    'animal', 'leopard', 'cheetah', 'zebra', 'snake', 'snakeskin', 'tiger',
    'dash', 'polka', 'dot', 'dots', 'striped', 'stripe', 'stripes', 'plaid',
    'tartan', 'gingham', 'check', 'checkered', 'houndstooth', 'paisley', 'floral',
    'flower', 'flowers', 'botanical', 'tropical', 'camo', 'camouflage', 'geometric',
    'abstract', 'tie', 'dye', 'ombre', 'skull', 'skulls', 'skeleton', 'bat', 'bats',
    'spider', 'spiderweb', 'cobweb', 'pentagram', 'cross', 'crossbones', 'moon',
    'crescent', 'star', 'stars', 'celestial', 'cat', 'cats', 'kitten', 'butterfly',
    'moth', 'dragon', 'cherry', 'cherries', 'strawberry', 'heart', 'hearts',
]);

const RPG_SETTING_CONFLICT_TOKENS = new Set([
    'planescape', 'eberron', 'forgotten', 'realms', 'greyhawk', 'dragonlance',
    'ravenloft', 'spelljammer', 'birthright', 'mystara', 'lankhmar', 'darksun',
    'cyberpunk', 'shadowrun', 'pathfinder', 'starfinder', 'warhammer', '40k',
    'infinity', 'corvus', 'belli', 'battletech', 'cthulhu', 'vampire', 'masquerade',
    'werewolf', 'mage', 'gurps', 'traveller', 'palladium', 'rifts', 'robotech',
    'starwars', 'startrek', 'tolkien', 'merp', 'conan', 'frazetta',
]);

const EDITION_CONFLICT_TOKENS = new Set([
    '1st', '1e', '2nd', '2e', '3rd', '3e', '35e', '4th', '4e', '5th', '5e', 'n3', 'n4',
]);

const GARMENT_TYPE_CONFLICT_TOKENS = new Set([
    'blouse', 'shirt', 'top', 'tee', 'tshirt', 'dress', 'skirt', 'pants', 'jeans',
    'trousers', 'shorts', 'jacket', 'coat', 'sweater', 'cardigan', 'hoodie', 'vest',
    'blazer', 'hat', 'cap', 'headband', 'veil', 'handbag', 'purse', 'tote', 'backpack',
    'wallet', 'belt', 'scarf', 'shoes', 'boots', 'sandals', 'heels', 'sneakers',
    'necklace', 'bracelet', 'earrings', 'ring', 'pin', 'brooch', 'wand',
]);

function tokenizeForCandidateMatch(raw: string): string[] {
    const preNormalized = String(raw || '')
        .toLowerCase()
        .replace(/\bad\s*&\s*d\b/g, ' add ')
        .replace(/\bd\s*&\s*d\b/g, ' dnd ')
        .replace(/\b3\.5\s*e?\b/g, ' 35e ')
        .replace(/\b1st\s+ed(ition)?\b/g, ' 1e ')
        .replace(/\b2nd\s+ed(ition)?\b/g, ' 2e ')
        .replace(/\b3rd\s+ed(ition)?\b/g, ' 3e ')
        .replace(/\b4th\s+ed(ition)?\b/g, ' 4e ')
        .replace(/\b5th\s+ed(ition)?\b/g, ' 5e ')
        .replace(/\bdark\s+sun\b/g, ' darksun ')
        .replace(/\bstar\s+wars\b/g, ' starwars ')
        .replace(/\bstar\s+trek\b/g, ' startrek ')
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    if (!preNormalized) return [];
    return preNormalized.split(/\s+/).filter(t => t.length >= 2);
}

/**
 * Returns strictly filtered & ranked unclaimed inventory candidates for the Slide-Over Inventory Match Drawer
 * and Inline High-Confidence Preview.
 *
 * STRICT CANDIDATE EXCLUSION & CONFIDENCE CALIBRATION LAWS:
 * 1. Rules out any single item that already has a different Memory Den `0EJ...` locationSku (Parent Lots stay reusable for remaining pieces!).
 * 2. Rules out any single item already claimed by another row in the active CSV sync (Parent Lots stay matchable so remaining pieces can be split!).
 * 3. Rules out `status === 'sold'` items when matching an `In Stock` row (`rowIsInStock === true`).
 * 4. Enforces strict B&B (`BB-`) vs `HUCK-`/`PDXGL-` namespace isolation.
 * 5. Separates generic category/form/brand tokens (`campaign, setting, set, boxed, print, blouse, banana, republic`) from distinctive identifying tokens (`planescape, eberron, corvus, belli, infinity, n4, red, animal, navy, dash`).
 * 6. Never awards `🟢 High (88%+)` unless distinctive identifying tokens match with zero conflicting color/pattern/setting/edition tokens.
 */
export function getUnclaimedMatchCandidatesForRow(params: {
    rowSku?: string;
    rowTitle?: string;
    rowPrice?: number;
    rowIsInStock?: boolean;
    rowIsBb?: boolean;
    searchQuery?: string;
    filterMode?: 'suggested' | 'all' | 'same_price' | 'backstock';
    allItems: any[];
    claimedItemIds?: Set<string>;
    allowMultiQtyReuse?: boolean;
    limit?: number;
}): UnclaimedMatchCandidateResult[] {
    const rowSku = cleanCatalogSku(params.rowSku).toUpperCase();
    const rowTitle = String(params.rowTitle || '').trim();
    const rowPrice = Number(params.rowPrice ?? 0);
    const rowIsInStock = Boolean(params.rowIsInStock);
    const rowIsBb = params.rowIsBb !== undefined
        ? params.rowIsBb
        : isBbConsignorRow({ sku: rowSku, title: rowTitle });
    const rawQuery = String(params.searchQuery || '').trim().toLowerCase();
    const queryTokens = rawQuery.split(/\s+/).filter(Boolean);
    const filterMode = params.filterMode || (queryTokens.length > 0 ? 'all' : 'suggested');
    const claimedIds = params.claimedItemIds || new Set<string>();
    const limit = params.limit ?? (queryTokens.length > 0 ? 40 : 12);

    const normRowTitle = normalizeTitleForMdMatch(rowTitle);
    const rowTokens = tokenizeForCandidateMatch(rowTitle);
    const rowTokenSet = new Set(rowTokens);

    // Specific identifying tokens (excluding stop words & generic category/form/common-brand words)
    const specificRowTokens = rowTokens.filter(
        t => !MATCH_STOP_WORDS.has(t) && !GENERIC_CATEGORY_FORM_TOKENS.has(t)
    );
    // Generic category/brand/form tokens present in the row
    const genericRowTokens = rowTokens.filter(
        t => !MATCH_STOP_WORDS.has(t) && GENERIC_CATEGORY_FORM_TOKENS.has(t)
    );

    const rowColors = rowTokens.filter(t => COLOR_CONFLICT_TOKENS.has(t));
    const rowPatterns = rowTokens.filter(t => PATTERN_CONFLICT_TOKENS.has(t));
    const rowSettings = rowTokens.filter(t => RPG_SETTING_CONFLICT_TOKENS.has(t));
    const rowEditions = rowTokens.filter(t => EDITION_CONFLICT_TOKENS.has(t));
    const rowGarmentTypes = rowTokens.filter(t => GARMENT_TYPE_CONFLICT_TOKENS.has(t));

    const rowIsBoxedSet =
        (rowTokenSet.has('boxed') || rowTokenSet.has('box')) &&
        (rowTokenSet.has('set') || rowTokenSet.has('sets'));
    const rowIsDndOrRpg =
        rowTokenSet.has('add') ||
        rowTokenSet.has('dnd') ||
        rowTokenSet.has('dungeons') ||
        rowTokenSet.has('dragons') ||
        rowTokenSet.has('rpg') ||
        rowTokenSet.has('ttrpg') ||
        rowTokenSet.has('tsr') ||
        rowTokenSet.has('campaign');

    const results: UnclaimedMatchCandidateResult[] = [];

    for (const item of params.allItems || []) {
        if (!item || !item.$id) continue;

        // 1. Exclude non-working statuses & split children
        const status = String(item.status || '').toLowerCase().trim();
        if (
            status === 'combined' ||
            status === 'deconstructed' ||
            status === 'tracked' ||
            status === 'draft' ||
            status === 'scouted'
        ) {
            continue;
        }
        const rawItemTitle = String(item.title || item.identity || '');
        if (/\(sold unit\)/i.test(rawItemTitle)) continue;

        // 2. Rule out `sold` items when matching an `In Stock` row
        if (rowIsInStock && status === 'sold') continue;

        // 3. Strict B&B vs HUCK/PDXGL namespace isolation
        if (isBbConsignorDbItem(item) !== rowIsBb) continue;

        const isLot = isParentLotCandidate(item);
        const itemLocSku = cleanCatalogSku(item.locationSku || item.sku).toUpperCase();

        // 4. Rule out single-piece items that already have a DIFFERENT Memory Den `0EJ...` locationSku
        // (Parent Lots remain available so remaining pieces from that lot can be split & linked!)
        if (/^0EJ/i.test(itemLocSku) && (!rowSku || itemLocSku !== rowSku) && !isLot) {
            continue;
        }

        // 5. Rule out single-piece items already claimed by another row in this CSV sync
        // (Parent Lots are NEVER ruled out after 1 piece is linked!)
        if (claimedIds.has(item.$id) && !isLot) {
            const isReusableBin = Boolean(params.allowMultiQtyReuse) && Number(item.quantity ?? 1) > 1 && status === 'placed';
            if (!isReusableBin) continue;
        }

        const itemUpc = cleanCatalogSku(item.upc).toUpperCase();
        const itemCategory = String(item.category || '').trim();
        const itemStorage = String(item.storageLocation || '').toUpperCase().trim();
        const dbPrice = Number(item.resalePrice ?? 0);
        const hasValidPrices = rowPrice > 0 && dbPrice > 0;
        const priceDiff = hasValidPrices ? Math.abs(dbPrice - rowPrice) : null;
        const isExactPrice = priceDiff !== null && priceDiff < 0.05;
        const isClosePrice = priceDiff !== null && priceDiff <= 5.01;

        // Optional quick filter pills
        if (filterMode === 'same_price' && !isClosePrice) continue;
        if (filterMode === 'backstock' && itemStorage === 'MD') continue;

        // If user typed a multi-word search query, every token must match across searchable fields
        if (queryTokens.length > 0) {
            const searchableBlob = [
                rawItemTitle,
                item.identity || '',
                itemUpc,
                itemLocSku,
                itemCategory,
                itemStorage,
                item.conditionNotes || '',
                dbPrice > 0 ? `$${dbPrice.toFixed(2)} ${dbPrice}` : '',
            ]
                .join(' ')
                .toLowerCase();

            const matchesAllTokens = queryTokens.every(tok => searchableBlob.includes(tok));
            if (!matchesAllTokens) continue;
        }

        const normCandTitle = normalizeTitleForMdMatch(rawItemTitle);
        const candTokens = tokenizeForCandidateMatch(rawItemTitle);
        const candTokenSet = new Set(candTokens);

        const candColors = candTokens.filter(t => COLOR_CONFLICT_TOKENS.has(t));
        const candPatterns = candTokens.filter(t => PATTERN_CONFLICT_TOKENS.has(t));
        const candSettings = candTokens.filter(t => RPG_SETTING_CONFLICT_TOKENS.has(t));
        const candEditions = candTokens.filter(t => EDITION_CONFLICT_TOKENS.has(t));
        const candGarmentTypes = candTokens.filter(t => GARMENT_TYPE_CONFLICT_TOKENS.has(t));

        const candIsBoxedSet =
            (candTokenSet.has('boxed') || candTokenSet.has('box')) &&
            (candTokenSet.has('set') || candTokenSet.has('sets'));
        const candIsDndOrRpg =
            candTokenSet.has('add') ||
            candTokenSet.has('dnd') ||
            candTokenSet.has('dungeons') ||
            candTokenSet.has('dragons') ||
            candTokenSet.has('rpg') ||
            candTokenSet.has('ttrpg') ||
            candTokenSet.has('tsr') ||
            candTokenSet.has('campaign');

        // 1. Specific/Distinctive token matches (whole-token match only, no false substring hits)
        const matchedSpecific: string[] = [];
        for (const st of specificRowTokens) {
            if (candTokenSet.has(st)) {
                matchedSpecific.push(st);
            }
        }

        // 2. Generic/Category/Brand token matches
        const matchedGeneric: string[] = [];
        for (const gt of genericRowTokens) {
            if (candTokenSet.has(gt)) {
                matchedGeneric.push(gt);
            }
        }

        // 3. Detect Conflicts (Color, Pattern/Motif, RPG Campaign Setting, Edition, Garment Type)
        const hasColorConflict =
            rowColors.length > 0 &&
            candColors.length > 0 &&
            !rowColors.some(c => candTokenSet.has(c));

        const hasPatternConflict =
            rowPatterns.length > 0 &&
            candPatterns.length > 0 &&
            !rowPatterns.some(p => candTokenSet.has(p));

        const hasSettingConflict =
            rowSettings.length > 0 &&
            candSettings.length > 0 &&
            !rowSettings.some(s => candTokenSet.has(s));

        const hasEditionConflict =
            rowEditions.length > 0 &&
            candEditions.length > 0 &&
            !rowEditions.some(e => candTokenSet.has(e));

        const hasGarmentTypeConflict =
            rowGarmentTypes.length > 0 &&
            candGarmentTypes.length > 0 &&
            !rowGarmentTypes.some(g => candTokenSet.has(g));

        // Also detect if candidate is an explicitly enumerated lot (e.g. "Lot of 5: D&D 3.5e Eberron..., Player's Handbook...")
        // that does NOT contain the row's specific identifying token (like "Planescape")
        const candSpecificTokens = candTokens.filter(
            t => !MATCH_STOP_WORDS.has(t) && !GENERIC_CATEGORY_FORM_TOKENS.has(t)
        );
        const isUnenumeratedCategoryLot =
            isLot && candSpecificTokens.length === 0 && candSettings.length === 0;
        const isEnumeratedLotMissingRowSpecific =
            isLot &&
            specificRowTokens.length > 0 &&
            matchedSpecific.length === 0 &&
            candSpecificTokens.length >= 2;

        const hasHardConflict =
            hasColorConflict ||
            hasPatternConflict ||
            hasSettingConflict ||
            hasGarmentTypeConflict ||
            (hasEditionConflict && matchedSpecific.length === 0) ||
            isEnumeratedLotMissingRowSpecific;

        // Compute candidate relevance score & human-readable match reasons
        let score = 0;
        const reasons: string[] = [];

        const isDirectSkuMatch = Boolean(rowSku && itemLocSku === rowSku);
        if (isDirectSkuMatch) {
            score += 120;
            reasons.push(`SKU ${rowSku}`);
        }

        if (matchedSpecific.length > 0) {
            score += matchedSpecific.length * 26;
            reasons.push(`Matched: ${matchedSpecific.slice(0, 4).join(', ')}`);
        }

        if (matchedGeneric.length > 0) {
            // Generic/form/brand words contribute a small context bonus (capped so they never inflate confidence)
            score += Math.min(18, matchedGeneric.length * 5);
            if (matchedSpecific.length === 0) {
                reasons.push(`Category/Form: ${matchedGeneric.slice(0, 3).join(', ')}`);
            }
        }

        // Un-enumerated Boxed Set / Category Parent Lot match (e.g. HUCK-0790 "Lot Of 5 Pcs Dungeons And Dragons Boxed Sets" for 0EJ07J "AD&D Planescape Campaign Setting Boxed Set")
        const isBoxedSetLotMatch =
            isLot &&
            rowIsBoxedSet &&
            candIsBoxedSet &&
            rowIsDndOrRpg &&
            candIsDndOrRpg &&
            !hasSettingConflict &&
            !hasEditionConflict;

        if (isBoxedSetLotMatch) {
            score += 48;
            reasons.unshift(`📦 Unsplit D&D Boxed Sets Lot`);
        } else if (isUnenumeratedCategoryLot && rowIsDndOrRpg && candIsDndOrRpg && !hasHardConflict) {
            score += 24;
        }

        // General Jaccard title similarity (weighted lightly so generic words don't dominate)
        const sim = computeMdTitleSimilarity(normRowTitle, normCandTitle);
        if (sim > 0 && !hasHardConflict) {
            score += Math.round(sim * 22);
        }

        // Price proximity bonus (only full bonus when there is no hard conflict!)
        if (!hasHardConflict) {
            if (isExactPrice) {
                score += matchedSpecific.length > 0 ? 22 : 10;
                reasons.push(`Exact $${rowPrice.toFixed(0)} price`);
            } else if (isClosePrice && priceDiff !== null) {
                score += matchedSpecific.length > 0 ? 10 : 4;
                reasons.push(`Close price ($${dbPrice.toFixed(0)})`);
            }
        }

        // Apply heavy penalties for conflicting distinctive attributes
        if (hasColorConflict || hasPatternConflict) {
            score -= 65;
            reasons.push(`⚠️ Conflicting color/print`);
        }
        if (hasSettingConflict) {
            score -= 55;
            reasons.push(`⚠️ Different campaign setting (${candSettings.join(', ')})`);
        }
        if (hasEditionConflict && matchedSpecific.length === 0) {
            score -= 35;
            reasons.push(`⚠️ Different edition (${candEditions.join(', ')})`);
        }
        if (hasGarmentTypeConflict) {
            score -= 50;
        }
        if (isEnumeratedLotMissingRowSpecific && !hasSettingConflict) {
            score -= 40;
            reasons.push(`⚠️ Enumerated lot missing "${specificRowTokens[0]}"`);
        }

        const estimatedLotCount = isLot ? extractEstimatedLotPieceCount(item) : 1;
        const lotCost = Number(item.cost ?? 0);
        const unitCostShare = isLot
            ? Number((lotCost / Math.max(1, estimatedLotCount)).toFixed(2))
            : Number(lotCost.toFixed(2));
        if (isLot && (matchedSpecific.length > 0 || isBoxedSetLotMatch || isUnenumeratedCategoryLot)) {
            score += 6;
            reasons.push(`📦 Multi-Piece Lot (~${estimatedLotCount} pcs • $${unitCostShare.toFixed(2)}/ea cost)`);
        }

        if (!itemLocSku) score += 3;
        if (itemStorage === 'HG' || itemStorage === 'HH' || itemStorage === 'HD') score += 3;

        // In default 'suggested' mode (no user search query), strictly exclude conflicting or purely generic noise matches
        if (queryTokens.length === 0 && filterMode === 'suggested') {
            if (hasColorConflict || hasPatternConflict || hasGarmentTypeConflict) {
                continue;
            }
            if (hasSettingConflict || isEnumeratedLotMissingRowSpecific) {
                continue;
            }
            if (
                !isDirectSkuMatch &&
                matchedSpecific.length === 0 &&
                !isBoxedSetLotMatch &&
                !(isUnenumeratedCategoryLot && matchedGeneric.length >= 2)
            ) {
                continue;
            }
        }

        // Calibrate 0-100 confidence score with strict guardrails:
        // NEVER award High Confidence (88%+) unless distinctive identifying tokens actually match without conflict!
        const specificOverlapRatio =
            specificRowTokens.length > 0
                ? matchedSpecific.length / specificRowTokens.length
                : 0;

        let confidence = 30;
        if (isDirectSkuMatch) {
            confidence = 99;
        } else if (hasHardConflict) {
            confidence = Math.max(20, Math.min(45, 35 + Math.round(score * 0.25)));
        } else if (isBoxedSetLotMatch && matchedSpecific.length === 0) {
            // Un-enumerated Boxed Set Lot (e.g. HUCK-0790 for 0EJ07J / 0EJ0CQ): rank #1 in Review / Lot Split tier (~76%)
            confidence = 76;
        } else if (matchedSpecific.length === 0) {
            // Only generic category/form/brand words matched — cap strictly in Review/Low tier (never >= 88%)
            confidence = Math.min(62, Math.max(30, 35 + matchedGeneric.length * 6 + (isExactPrice ? 8 : 0)));
        } else {
            // At least 1 specific identifying token matched and zero conflicts
            const baseFromSpecific =
                matchedSpecific.length >= 3
                    ? 84
                    : matchedSpecific.length === 2
                    ? 76
                    : 64;
            const ratioBonus = Math.round(specificOverlapRatio * 10);
            const priceBonus = isExactPrice ? 8 : isClosePrice ? 4 : 0;
            confidence = Math.min(98, baseFromSpecific + ratioBonus + priceBonus);

            // Require either >=2 specific tokens OR 100% of row's specific tokens + price/generic confirmation to cross 88%
            const canReachHighConfidence =
                matchedSpecific.length >= 2 ||
                (specificRowTokens.length === 1 &&
                    matchedSpecific.length === 1 &&
                    (matchedGeneric.length >= 2 || isExactPrice || isClosePrice));
            if (!canReachHighConfidence) {
                confidence = Math.min(confidence, 82);
            }
        }

        const recommendedAction: 'link' | 'split_lot' | 'create_new' =
            isLot && (!itemLocSku || itemLocSku !== rowSku)
                ? 'split_lot'
                : 'link';

        results.push({
            item,
            score,
            confidence,
            reasons,
            priceDiff,
            isExactPrice,
            isClosePrice,
            isParentLot: isLot,
            estimatedLotCount,
            unitCostShare,
            recommendedAction,
        });
    }

    results.sort((a, b) => {
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        if (b.score !== a.score) return b.score - a.score;
        if (a.priceDiff !== null && b.priceDiff !== null && a.priceDiff !== b.priceDiff) {
            return a.priceDiff - b.priceDiff;
        }
        return String(b.item.$createdAt || '').localeCompare(String(a.item.$createdAt || ''));
    });

    return results.slice(0, limit);
}



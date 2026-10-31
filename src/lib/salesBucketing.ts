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
    '0EJ0JV': { upc: null, saleNum: '225058', gross: 55.00, label: 'Tripp NYC Black Gothic Punk Alternative Lace-Up Mini Skirt Size 4' },
    '0EJ07F': { upc: null, saleNum: '221996', gross: 40.00, label: 'Goth Mini Skirt - Lips & Crossbones Patch' },
    '0EJ0C7': { upc: null, saleNum: '219981', gross: 70.00, label: 'Frank Frazetta ICON A Retrospective Art Book' },
    '0EJ0BD': { upc: null, saleNum: '218369', gross: 10.00, label: 'Air Land and Sea Game' },
};

export const PREVERIFIED_OCT_BB_SKUS = new Set<string>([
    '0EJ0HN', '0EJ0HQ', '0EJ0HX', '0EJ0IH', '0EJ0IJ', '0EJ0IL', '0EJ0IN',
    '0EJ0IT', '0EJ0IU', '0EJ0IV', '0EJ0J5', '0EJ0J8', '0EJ0KA', '0EJ0LM',
]);

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

    const canUseCandidate = (cand: any): boolean => {
        if (!cand) return false;
        const s = String(cand.status || '').toLowerCase().trim();
        if (s === 'tracked' || s === 'draft' || s === 'scouted') return false;
        if (isSoldUnitSplitChild(cand)) return false;
        const candIsBb = isBbConsignorDbItem(cand);
        if (rowIsBb !== candIsBb) return false;
        const existingClaimSku = claimed.get(cand.$id);
        if (existingClaimSku && existingClaimSku !== normSku) return false;
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

    // 2. Pre-verified single item UPC override
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


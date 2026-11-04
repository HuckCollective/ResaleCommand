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
 * - All date strings (`MM-DD-YYYY`, `YYYY-MM-DD`, or `YYYY-MM-DD HH:mm:ss`) are anchored to NOON UTC (`T12:00:00.000Z`)
 *   on the calendar date as written so an evening sale (`2026-10-27 17:45:00`) NEVER rolls forward to `2026-10-28` UTC.
 */
export function toSaleIso(raw: any): string {
    if (!raw) return '';
    const s = String(raw).trim();
    if (!s) return '';
    let m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[T\s].*)?$/);
    if (m) {
        return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}T12:00:00.000Z`;
    }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T00:00:00(?:\.000)?Z?|[T\s]\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:AM|PM))?)$/i);
    if (m) {
        return `${m[1]}-${m[2]}-${m[3]}T12:00:00.000Z`;
    }
    const d = new Date(/^\d{4}-\d{2}-\d{2} \d/.test(s) ? s.replace(' ', 'T') : s);
    return isNaN(d.getTime()) ? '' : d.toISOString();
}

/** True for payout summary / credit lines that must never become sales rows. */
export function isPayoutSummaryRow(itemName: string): boolean {
    const n = String(itemName || '').trim().toLowerCase();
    if (!n) return false;
    return (
        n.startsWith('(credit) space rental') ||
        n.startsWith('(credit)') ||
        n.startsWith('total for payout') ||
        n.startsWith('total paid') ||
        n.startsWith('total:') ||
        n === 'total' ||
        n.startsWith('subtotal') ||
        n.startsWith('payout total') ||
        n.startsWith('net payout') ||
        n.includes('space rental') ||
        /^payout\s*#\d+\s*total/i.test(n)
    );
}

/**
 * Detects bogus rows leaked from Ricochet's `Inventory (Active)` DOM table during SPA tab scraping:
 * - `title === 'Booth Sale Item'` (or generic fallback) where `saleNumber`/`payoutId` is a non-numeric product title
 *   (e.g. `#Levi's Faux Leather Moto Jacket (L)`, `#WWII US Sun Helmet Hawley 1944`), OR
 * - `saleNumber` is a multi-word product title containing letters & spaces instead of a numeric POS ticket ID, OR
 * - `grossPrice` is `0` or `1` (from the Inventory `Qty` column) while `splitPct`/`commissionRate` is `> 20%` (and not a real 85%/90% consignor split) with no valid Ricochet `0EJ...` SKU or `HUCK-`/`PDXGL-`/`BB-` UPC.
 */
export function isLeakedInventoryDomRow(row: any): boolean {
    if (!row || typeof row !== 'object') return false;
    const rawTitle = String(row.title || row.itemName || row.name || '').trim();
    const rawSale = String(row.saleNumber || row.payoutId || row.saleId || row.ticketNumber || '').trim();
    const cleanSale = rawSale.replace(/^#/, '').trim();
    const rawSku = cleanCatalogSku(row.ricoSku || row.sku || row.extractedSku || '').toUpperCase();
    const rawUpc = cleanCatalogSku(row.upc || row.matchedItemUpc || '').toUpperCase();
    const hasValidBoothSku = /^0EJ[A-Z0-9]{2,6}$/i.test(rawSku);
    const hasValidOrgUpc = /^(?:HUCK|PDXGL|BB)-[A-Z0-9_-]+$/i.test(rawUpc);

    const isGenericTitle =
        !rawTitle ||
        rawTitle.toLowerCase() === 'booth sale item' ||
        rawTitle.toLowerCase() === 'booth item';

    // 1. Non-numeric product title leaked into saleNumber / payoutId (e.g. `#Levi's Faux Leather Moto Jacket (L)`)
    if (cleanSale) {
        const isKnownTicketOrRef =
            /^\d{3,10}(?:\s*#\d+)?$/.test(cleanSale) ||
            /^(?:ticket\s*#\d+|sale\s*#\d+|t-\d+|rico-|so-|row-\d+|sold-item-\d+|0ej[a-z0-9]+|(?:huck|pdxgl|bb)-[a-z0-9_-]+)$/i.test(cleanSale);
        if (!isKnownTicketOrRef && (isGenericTitle || /[a-z]{3,}.*\s+[a-z]{2,}/i.test(cleanSale))) {
            return true;
        }
    }

    // 2. Inventory `Qty` (0 or 1) leaked into grossPrice while `Price` ($45, $75, $35 -> 45%, 75%, 35%) leaked into splitPct
    const grossPrice = Number(row.grossPrice ?? row.agreedPrice ?? row.listedPrice ?? row.price ?? 0);
    const rawSplitStr = String(row.splitPct ?? row.commissionRate ?? '').trim();
    const splitNum = parseFloat(rawSplitStr.replace(/[^0-9.]/g, '')) || 0;
    const isNonStandardSplit =
        rawSplitStr.startsWith('$') ||
        (splitNum > 20 && Math.abs(splitNum - 85) > 0.5 && Math.abs(splitNum - 90) > 0.5 && Math.abs(splitNum - 70) > 0.5);

    if ((grossPrice === 0 || grossPrice === 1) && !hasValidBoothSku && !hasValidOrgUpc) {
        if (isGenericTitle || isNonStandardSplit) {
            return true;
        }
    }

    return false;
}

/**
 * Splits a Ricochet item cell like `Cartographers Heros  - 0EJ03C` or `Item - HUCK-1206` into a clean display title and the booth SKU.
 * Supports `0EJ...` SKUs, partner UPCs (`HUCK-`, `PDXGL-`, `BB-`), and 5-8 char alphanumeric booth SKUs.
 */
export function splitTrailingBoothSku(itemName: string): { title: string; sku: string } {
    const raw = String(itemName || '').trim();
    if (!raw) return { title: '', sku: '' };
    const m = raw.match(/\s+[-–]\s*['"]?(0EJ[0-9A-Z]{2,6}|(?:HUCK|PDXGL|BB)-[0-9A-Z_-]{2,10})['"]?\s*$/i);
    if (m) {
        return {
            title: raw.slice(0, m.index).replace(/\s+/g, ' ').trim(),
            sku: m[1].toUpperCase(),
        };
    }
    const leadPair = raw.match(/^(0EJ[0-9A-Z]{2,6})\s+((?:HUCK|PDXGL|BB)-[0-9A-Z_-]{2,10})\b/i);
    if (leadPair) {
        return {
            title: raw.replace(/\s+/g, ' ').trim(),
            sku: leadPair[1].toUpperCase(),
        };
    }
    return { title: raw.replace(/\s+/g, ' ').trim(), sku: '' };
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
    /** Optional net payout accessor for matching paid history rows where net is primary. */
    getNet?: (row: T) => any;
    /** Booth SKU (`0EJ08B`) or UPC (`HUCK-1440`) when the row carries one. */
    getSku?: (row: T) => any;
    /** Optional secondary code (e.g. matchedItemUpc when getSku returns 0EJ SKU). */
    getUpc?: (row: T) => any;
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
        const titleOrSku = slugKey(acc.getSku?.(row) || acc.getUpc?.(row) || acc.getTitle?.(row) || '');
        const groupKey = `${ticket || titleOrSku}|${gross}`;
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
 * so a CSV upload or live Ricochet sync never duplicates a legacy record. Also cross-indexes SKU/UPC (`0EJ...` <-> `HUCK-`/`PDXGL-`/`BB-`),
 * sold date/month, and gross/net payout so paid history rows without a 6-digit ticket number still match recorded ledger sales.
 */
export function flagAlreadyRecordedRows<T extends Record<string, any>>(rows: T[], existingSales: any[], acc: FingerprintAccessors<T>): { rows: T[]; recordedCount: number; newCount: number } {
    assignOccurrenceFingerprints(rows, acc);
    const byTicketGross = new Map<string, number>();
    const byTicketNet = new Map<string, number>();
    const byTicketOnly = new Map<string, number>();
    const bySkuDayGross = new Map<string, number>();
    const bySkuDayNet = new Map<string, number>();
    const bySkuMonthGross = new Map<string, number>();
    const bySkuMonthNet = new Map<string, number>();
    const bySkuGross = new Map<string, number>();
    const bySkuNet = new Map<string, number>();
    const byInstantGross = new Map<string, number>();
    const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) || 0) + 1);

    const upcToMdSku = new Map<string, string>();
    for (const [mdSku, mdUpc] of Object.entries(PREVERIFIED_MD_SKU_TO_UPC_OR_ID)) {
        if (mdUpc) upcToMdSku.set(slugKey(mdUpc), slugKey(mdSku));
    }

    const expandCodeKeys = (rawCodes: any[]): Set<string> => {
        const out = new Set<string>();
        for (const c of rawCodes) {
            const rawClean = cleanCatalogSku(c).toUpperCase();
            const k = slugKey(rawClean);
            if (!k) continue;
            out.add(k);
            if (PREVERIFIED_MD_SKU_TO_UPC_OR_ID[rawClean]) {
                out.add(slugKey(PREVERIFIED_MD_SKU_TO_UPC_OR_ID[rawClean]));
            }
            const revSku = upcToMdSku.get(k);
            if (revSku) out.add(revSku);
        }
        return out;
    };

    (existingSales || []).forEach(s => {
        if (s.status === 'Cancelled') return;
        const gross = Number(s.grossAmount || 0).toFixed(2);
        const net = Number(s.netPayout ?? (Number(s.grossAmount || 0) - Number(s.commissionFee || 0))).toFixed(2);
        const iso = toSaleIso(s.saleDate);
        const ticket = canonicalTicketNumber(s.orderId) || canonicalTicketNumber(s.soNumber) || canonicalTicketNumber(s.ricochetSaleId);
        if (ticket) {
            bump(byTicketGross, `${ticket}|${gross}`);
            bump(byTicketNet, `${ticket}|${net}`);
            bump(byTicketOnly, ticket);
        }
        const day = iso ? localDay(iso) : '';
        const month = pacificMonthKey(s.saleDate || iso);
        if (iso) {
            bump(byInstantGross, `${iso}|${gross}`);
        }
        const codeKeys = expandCodeKeys([s.soNumber, s.orderId, s.sku, s.upc, s.ricochetSaleId]);
        for (const key of codeKeys) {
            bump(bySkuGross, `${key}|${gross}`);
            bump(bySkuNet, `${key}|${net}`);
            if (day) {
                bump(bySkuDayGross, `${key}|${day}|${gross}`);
                bump(bySkuDayNet, `${key}|${day}|${net}`);
            }
            if (month) {
                bump(bySkuMonthGross, `${key}|${month}|${gross}`);
                bump(bySkuMonthNet, `${key}|${month}|${net}`);
            }
        }
    });

    const consumedByCodeMonth = new Map<string, number>();
    const consumedByCodeGross = new Map<string, number>();

    let recordedCount = 0;
    rows.forEach(row => {
        const ticket = (row as any).canonicalTicket as string;
        const gross = Number(acc.getGross(row) || 0).toFixed(2);
        const netVal = acc.getNet ? Number(acc.getNet(row) || 0) : Number((row as any).ricoNetPayout ?? (row as any).expectedNetPayout ?? (row as any).salePrice ?? 0);
        const net = netVal > 0 ? netVal.toFixed(2) : (Number(gross) * 0.85).toFixed(2);
        const k = (row as any).occurrenceIndex || 1;
        const rawDate = acc.getSoldDate(row);
        const iso = toSaleIso(rawDate);
        const day = iso ? localDay(iso) : '';
        const month = pacificMonthKey(rawDate || iso);
        const rowCodes = expandCodeKeys([
            acc.getSku?.(row),
            acc.getUpc?.(row),
            (row as any).sku,
            (row as any).ricoSku,
            (row as any).upc,
            (row as any).matchedItemUpc,
            (row as any).extractedSku,
        ]);

        let recorded = false;
        if (ticket && /^\d{4,8}$/.test(ticket)) {
            recorded =
                (byTicketGross.get(`${ticket}|${gross}`) || 0) >= k ||
                (byTicketNet.get(`${ticket}|${net}`) || 0) >= k;
        }
        if (!recorded && iso) {
            recorded = (byInstantGross.get(`${iso}|${gross}`) || 0) >= k;
        }
        if (!recorded && rowCodes.size > 0) {
            for (const code of rowCodes) {
                if (day && ((bySkuDayGross.get(`${code}|${day}|${gross}`) || 0) >= k || (bySkuDayNet.get(`${code}|${day}|${net}`) || 0) >= k)) {
                    recorded = true;
                    break;
                }
                if (month) {
                    const mKeyGross = `${code}|${month}|${gross}`;
                    const mKeyNet = `${code}|${month}|${net}`;
                    const usedM = (consumedByCodeMonth.get(code) || 0) + 1;
                    if ((bySkuMonthGross.get(mKeyGross) || 0) >= usedM || (bySkuMonthNet.get(mKeyNet) || 0) >= usedM) {
                        recorded = true;
                        consumedByCodeMonth.set(code, usedM);
                        break;
                    }
                }
                const usedG = (consumedByCodeGross.get(code) || 0) + 1;
                if ((bySkuGross.get(`${code}|${gross}`) || 0) >= usedG || (bySkuNet.get(`${code}|${net}`) || 0) >= usedG) {
                    recorded = true;
                    consumedByCodeGross.set(code, usedG);
                    break;
                }
            }
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
    // Date-only values stored as UTC midnight (`2026-11-01T00:00:00.000Z`) are CALENDAR dates, not instants:
    // converting them to Pacific would push Nov 1 back into October, so read the calendar month as written.
    if (/^\d{4}-\d{2}-\d{2}T00:00:00(?:\.0+)?Z$/i.test(s)) return s.slice(0, 7);
    // Wall-clock / date-only strings with no time-zone designator (`11-02-2026`, `11/03/2026 5:21 PM`, `2026-11-03 17:21:00`)
    // are bucketed by the calendar month they are written in.
    const hasTimeZoneDesignator = /[T:]/.test(s) && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(s);
    if (!hasTimeZoneDesignator) {
        const written = calendarMonthKeyFromDateString(s);
        if (written) return written;
    }
    const d = new Date(s);
    if (isNaN(d.getTime())) return s.slice(0, 7);
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit' }).formatToParts(d);
    return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}`;
}

const MONTH_NAMES_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Calendar month key (`YYYY-MM`, ONE-indexed: November = `11`) of the sold date exactly as written —
 * `2026-11-02`, `2026-11-03 17:21:00`, `11-02-2026`, `11/03/2026 5:21 PM`. Pure string parsing: never uses
 * `Date#getMonth()` (0-indexed) so month 11 can never slip into October. Returns `''` when no date is present.
 */
export function calendarMonthKeyFromDateString(raw: any): string {
    const s = String(raw ?? '').replace(/['"]/g, '').trim();
    if (!s) return '';
    let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?!\d)/);
    if (m) {
        const mm = Number(m[2]);
        return mm >= 1 && mm <= 12 ? `${m[1]}-${String(mm).padStart(2, '0')}` : '';
    }
    m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?!\d)/);
    if (m) {
        const mm = Number(m[1]);
        return mm >= 1 && mm <= 12 ? `${m[3]}-${String(mm).padStart(2, '0')}` : '';
    }
    return '';
}

/** `2026-11` -> `November 2026` (1-indexed lookup; no Date object involved). */
export function monthKeyToLabel(key: string): string {
    const m = String(key || '').match(/^(\d{4})-(\d{2})$/);
    if (!m) return String(key || '');
    const idx = Number(m[2]);
    return idx >= 1 && idx <= 12 ? `${MONTH_NAMES_LONG[idx - 1]} ${m[1]}` : String(key);
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

/**
 * Runtime-hydrated single-item lookup cache (populated dynamically from Appwrite inventory documents; zero hardcoded SKU dictionaries).
 */
export const PREVERIFIED_MD_SINGLE_UPC_BY_SKU: Record<string, MdPreverifiedSingle> = {};

/**
 * Law 4: no static SKU lists. B&B (Biggie & Birdie) rows are recognised from their `BB-` barcode prefix or their "B&B" title
 * (see `isBbConsignorRow`); the former hardcoded October SKU list was removed.
 */
export const PREVERIFIED_OCT_BB_SKUS = new Set<string>();

/**
 * Runtime-hydrated SKU -> UPC lookup cache (populated dynamically at runtime by `buildLockedMultiBinMap` from live Appwrite inventory records; zero static SKU maps).
 */
export const PREVERIFIED_MD_SKU_TO_UPC_OR_ID: Record<string, string> = {};

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

/**
 * Runtime-hydrated Multi-Qty Booth Bin metadata cache (populated dynamically from live Appwrite inventory records; zero static SKU maps).
 */
export const PREVERIFIED_MD_MULTI_QTY_BINS: Record<string, MdPreverifiedMultiBin> = {};

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
 * Dynamically builds the locked Multi-Qty Booth Bin & SKU lookup map at runtime in memory
 * directly from the passed Appwrite inventory records (`external_sku` / `locationSku` / `sku` and `barcode` / `upc`),
 * hydrating runtime lookup caches and claiming bin `$id`s so sold split children never hijack a Booth Bin.
 */
export function buildLockedMultiBinMap(
    activeItems: any[],
    claimedItemIdToSku: Map<string, string> = new Map()
): Map<string, any> {
    const multiBinResolvedBySku = new Map<string, any>();
    const isSoldUnitSplitChild = (it: any) => /\(sold unit\)/i.test(String(it?.title || ''));
    const byBoothSku = new Map<string, any[]>();

    for (const item of activeItems || []) {
        if (!item) continue;
        const rawSku = cleanCatalogSku(item.external_sku || item.locationSku || item.sku).toUpperCase();
        const rawUpc = cleanCatalogSku(item.barcode || item.upc).toUpperCase();
        const status = String(item.status || '').toLowerCase().trim();
        if (status === 'tracked' || status === 'draft' || status === 'scouted') continue;

        if (rawSku && /^0EJ[0-9A-Z]{2,6}$/i.test(rawSku)) {
            if (!byBoothSku.has(rawSku)) byBoothSku.set(rawSku, []);
            byBoothSku.get(rawSku)!.push(item);

            if (rawUpc && /^(?:HUCK|PDXGL|BB)-[0-9A-Z_-]{2,10}$/i.test(rawUpc) && !isSoldUnitSplitChild(item)) {
                if (!PREVERIFIED_MD_SKU_TO_UPC_OR_ID[rawSku] || status === 'placed') {
                    PREVERIFIED_MD_SKU_TO_UPC_OR_ID[rawSku] = rawUpc;
                }
            }
        }
    }

    for (const [binSku, candidates] of byBoothSku.entries()) {
        const validCandidates = candidates.filter(c => !isSoldUnitSplitChild(c));
        if (validCandidates.length === 0) continue;

        const multiQtyCand =
            validCandidates.find(c => c.status === 'placed' && (Number(c.quantity ?? 1) > 1 || Boolean(c.isMultiQty))) ||
            validCandidates.find(c => Number(c.quantity ?? 1) > 1 || Boolean(c.isMultiQty) || isParentLotCandidate(c)) ||
            (validCandidates.length > 1 ? validCandidates.find(c => c.status === 'placed') || validCandidates[0] : null);

        if (multiQtyCand) {
            const upc = cleanCatalogSku(multiQtyCand.barcode || multiQtyCand.upc).toUpperCase() || null;
            const qty = Math.max(1, Number(multiQtyCand.quantity ?? 1));
            const unitPrice = Number(multiQtyCand.boutiquePrice ?? multiQtyCand.resalePrice ?? multiQtyCand.price ?? 0);
            const rawCost = Number(multiQtyCand.cost ?? multiQtyCand.purchasePrice ?? 0);
            PREVERIFIED_MD_MULTI_QTY_BINS[binSku] = {
                upc,
                octUnitsSold: 0,
                expectedRemainingQty: qty,
                unitPrice,
                unitCostOverride: qty > 1 && rawCost > 0 ? Number((rawCost / qty).toFixed(2)) : null,
                totalUnitsInLot: qty > 1 ? qty : null,
                label: String(multiQtyCand.title || multiQtyCand.identity || binSku),
            };
            multiBinResolvedBySku.set(binSku, multiQtyCand);
            if (multiQtyCand.$id) {
                claimedItemIdToSku.set(multiQtyCand.$id, binSku);
            }
        }
    }

    return multiBinResolvedBySku;
}

function stripGenericTitleAffixes(normTitle: string): string {
    return String(normTitle || '')
        .replace(/^(?:the|vintage|vtg|board\s+game|card\s+game|rpg|ttrpg|d\s*&\s*d|ad\s*&\s*d|advanced\s+dungeons\s+(?:and\s+)?dragons|dungeons\s+(?:and\s+)?dragons)\s+/i, '')
        .replace(/\s+(?:board\s+game|card\s+game|rpg|ttrpg|game|book|rulebook|hardcover|hc|softcover|sc|boxed\s+set|box\s+set)$/i, '')
        .trim();
}

/**
 * Matches a Memory Den Products-*.csv, Payouts *.csv, or Ricochet Live Sync row against resale_db.items
 * enforcing all verified 4-tier invariants:
 * - Tier 1: Exact SKU / UPC / trailing SKU via `splitTrailingBoothSku` + trap guards + pre-verified maps
 * - Tier 2: Normalized title / `tagTitle` match (including stripped core title for `"Board Game Stop Thief"`, `"Castles of Burgundy"`, etc.)
 * - Tier 3: Token / fuzzy title + gross price match for rows missing a SKU (supports short titles >= 5 chars like `"Blackbeard"`, `"Advanced Dungeons & Dragons"`)
 * - Tier 4: Multi-Qty Booth Bin priority & lock (`buildLockedMultiBinMap`: `0EJ0FR -> HUCK-1309`, `0EJ0H5 -> HUCK-1425/HUCK-1380`)
 * - Strict B&B (`BB-`) vs `HUCK-`/`PDXGL-` namespace isolation
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
    const trailingFromTitle = splitTrailingBoothSku(String(params.title || ''));
    const effectiveRawTitle = trailingFromTitle.sku ? trailingFromTitle.title : String(params.title || '');
    let normSku = cleanCatalogSku(params.sku || trailingFromTitle.sku).toUpperCase();
    let normUpc = cleanCatalogSku(params.upc).toUpperCase();
    if (/^(?:HUCK|PDXGL|BB)-/i.test(normSku)) {
        if (!normUpc) normUpc = normSku;
        normSku = '';
    }
    const price = Number(params.price ?? 0);
    if (!normSku && effectiveRawTitle) {
        normSku = resolveMemoryDenSkuFromPayoutRow({
            extractedSku: '',
            itemName: effectiveRawTitle,
            grossPrice: price,
        });
    }
    const activeItems = params.activeItems || [];
    const claimed = params.claimedItemIdToSku || new Map<string, string>();
    const multiBins = params.multiBinResolvedBySku || buildLockedMultiBinMap(activeItems, claimed);
    const rowIsBb = isBbConsignorRow({ sku: normSku, upc: normUpc, title: effectiveRawTitle, extraText: params.extraText });
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

    const rowClaimKey = normSku || normUpc || `${normalizeTitleForMdMatch(effectiveRawTitle)}|${price.toFixed(2)}`;

    const finalizeHit = (cand: any): any => {
        const resolved = dereferenceParent(cand);
        if (!resolved) return null;
        const isReusableMulti =
            Boolean(normSku && PREVERIFIED_MD_MULTI_QTY_BINS[normSku]) ||
            Boolean(resolved.isMultiQty) ||
            Number(resolved.quantity ?? 1) > 1 ||
            isParentLotCandidate(resolved);
        if (resolved.$id && !isReusableMulti && rowClaimKey) {
            claimed.set(resolved.$id, rowClaimKey);
        }
        return resolved;
    };

    const canUseCandidate = (cand: any): boolean => {
        if (!cand) return false;
        const s = String(cand.status || '').toLowerCase().trim();
        if (s === 'tracked' || s === 'draft' || s === 'scouted') return false;
        if (isSoldUnitSplitChild(cand)) return false;
        const candLocSku = cleanCatalogSku(cand.locationSku || cand.sku).toUpperCase();
        const isExplicitSkuMatch = Boolean(normSku && /^0EJ/i.test(normSku) && candLocSku === normSku);
        if (!isExplicitSkuMatch) {
            const candIsBb = isBbConsignorDbItem(cand);
            if (rowIsBb !== candIsBb) return false;
        }
        if (normSku && /^0EJ/i.test(normSku) && /^0EJ/i.test(candLocSku) && candLocSku !== normSku) {
            return false;
        }
        const existingClaimSku = claimed.get(cand.$id);
        if (existingClaimSku && existingClaimSku !== normSku && existingClaimSku !== rowClaimKey) return false;
        return true;
    };

    // Tier 4a: Pre-resolved Multi-Qty Booth Bins (`buildLockedMultiBinMap`)
    if (normSku && multiBins.has(normSku)) {
        return multiBins.get(normSku);
    }

    // Tier 1b: Direct locationSku + UPC or Direct locationSku match (live Appwrite links always take priority; no per-SKU special cases - Law 4)
    if (normSku) {
        const skuHits = activeItems.filter(i => {
            const iLocSku = cleanCatalogSku(i?.locationSku || i?.sku).toUpperCase();
            const iUpc = cleanCatalogSku(i?.upc).toUpperCase();
            return (iLocSku === normSku || iUpc === normSku) && canUseCandidate(i);
        });
        if (skuHits.length > 0) {
            const chosen =
                (normUpc ? skuHits.find(it => cleanCatalogSku(it?.upc).toUpperCase() === normUpc) : null)
                || skuHits.find(it => it.status === 'placed' && Number(it.quantity ?? 1) > 1)
                || skuHits.find(it => String(it.status || '').toLowerCase() !== 'sold')
                || skuHits[0];
            return finalizeHit(chosen);
        }
    }

    // Tier 1c: Direct UPC match
    if (normUpc) {
        const byUpc = activeItems.find(i => cleanCatalogSku(i?.upc).toUpperCase() === normUpc && canUseCandidate(i));
        if (byUpc) return finalizeHit(byUpc);
    }

    // Tier 1d: Pre-verified SKU -> UPC/ID override map (PREVERIFIED_MD_SKU_TO_UPC_OR_ID + PREVERIFIED_MD_SINGLE_UPC_BY_SKU)
    const preMappedTarget = normSku ? PREVERIFIED_MD_SKU_TO_UPC_OR_ID[normSku] : '';
    if (preMappedTarget) {
        const upperTarget = preMappedTarget.toUpperCase();
        const byMapped = activeItems.find(
            i => (cleanCatalogSku(i?.upc).toUpperCase() === upperTarget || String(i?.$id || '') === preMappedTarget) && canUseCandidate(i)
        );
        if (byMapped) return finalizeHit(byMapped);
    }

    const preSingle = PREVERIFIED_MD_SINGLE_UPC_BY_SKU[normSku];
    if (preSingle && preSingle.upc) {
        const targetPreUpc = preSingle.upc.toUpperCase();
        const byPreUpc = activeItems.find(i => cleanCatalogSku(i?.upc).toUpperCase() === targetPreUpc && canUseCandidate(i));
        if (byPreUpc) return finalizeHit(byPreUpc);
        if (preSingle.altUpc) {
            const altPreUpc = preSingle.altUpc.toUpperCase();
            const byAltUpc = activeItems.find(i => cleanCatalogSku(i?.upc).toUpperCase() === altPreUpc && canUseCandidate(i));
            if (byAltUpc) return finalizeHit(byAltUpc);
        }
    }

    // Tier 2 & Tier 3: Normalized Title & Token/Fuzzy Title + Gross Price Matching
    const normTitle = normalizeTitleForMdMatch(effectiveRawTitle);
    if (!normTitle || normTitle.length < 4) {
        return null;
    }
    const coreRowTitle = stripGenericTitleAffixes(normTitle);

    const titleEligible = activeItems.filter(i => {
        const s = String(i?.status || '').toLowerCase().trim();
        if (s === 'combined' || s === 'deconstructed') return false;
        return canUseCandidate(i);
    });

    const isPriceCompatible = (c: any, maxDiff: number = 5.01): boolean => {
        const dbPrice = Number(c.resalePrice ?? c.boutiquePrice ?? c.price ?? c.soldPrice ?? 0);
        if (price > 0 && dbPrice > 0 && !preSingle && Math.abs(dbPrice - price) > maxDiff) return false;
        return true;
    };

    // Tier 2a: Exact normalized title or tagTitle match (prefers exact price match first)
    const exactMatches = titleEligible.filter(c => {
        const candTitle = normalizeTitleForMdMatch(c.title || c.identity);
        const candTag = normalizeTitleForMdMatch(c.tagTitle);
        if (candTitle !== normTitle && candTag !== normTitle) return false;
        return isPriceCompatible(c, 5.01);
    });
    if (exactMatches.length > 0) {
        const exactPriceHit = exactMatches.find(
            c => Math.abs(Number(c.resalePrice ?? c.boutiquePrice ?? c.price ?? 0) - price) < 0.05
        );
        return finalizeHit(exactPriceHit || exactMatches[0]);
    }

    // Tier 2b: Core title match (e.g. "Board Game Stop Thief" <-> "Stop Thief", "Castles of Burgundy" <-> "The Castles of Burgundy")
    if (coreRowTitle && coreRowTitle.length >= 5) {
        const coreMatches = titleEligible.filter(c => {
            const candTitle = normalizeTitleForMdMatch(c.title || c.identity);
            const candTag = normalizeTitleForMdMatch(c.tagTitle);
            const coreCand = stripGenericTitleAffixes(candTitle);
            const coreTag = stripGenericTitleAffixes(candTag);
            const matchesCore =
                (coreCand && coreCand === coreRowTitle) ||
                (coreTag && coreTag === coreRowTitle) ||
                (candTitle && candTitle === coreRowTitle) ||
                (candTag && candTag === coreRowTitle);
            if (!matchesCore) return false;
            return isPriceCompatible(c, 5.01);
        });
        if (coreMatches.length > 0) {
            const exactPriceHit = coreMatches.find(
                c => Math.abs(Number(c.resalePrice ?? c.boutiquePrice ?? c.price ?? 0) - price) < 0.05
            );
            return finalizeHit(exactPriceHit || coreMatches[0]);
        }
    }

    // Tier 3: Token / Prefix / Fuzzy Title + Gross Price Match for rows missing a SKU
    // Supports short distinctive titles (`normTitle.length >= 5`, e.g. "Blackbeard", "Stop Thief", "Castles of Burgundy", "Advanced Dungeons & Dragons")
    const rowTokens = tokenizeForCandidateMatch(effectiveRawTitle).filter(t => !MATCH_STOP_WORDS.has(t));
    const specificRowTokens = rowTokens.filter(t => !GENERIC_CATEGORY_FORM_TOKENS.has(t));

    let bestCand: any = null;
    let bestScore = 0;

    for (const c of titleEligible) {
        const rawCandStr = String(c.title || c.identity || '');
        const rawTagStr = String(c.tagTitle || '');
        const candTitles = [
            normalizeTitleForMdMatch(rawCandStr),
            normalizeTitleForMdMatch(rawTagStr),
        ].filter(t => t && t.length >= 5);

        const dbPrice = Number(c.resalePrice ?? c.boutiquePrice ?? c.price ?? c.soldPrice ?? 0);
        const priceDiff = price > 0 && dbPrice > 0 ? Math.abs(dbPrice - price) : 0;
        const isExactPrice = price > 0 && dbPrice > 0 && priceDiff < 0.05;
        const isClosePrice = price === 0 || dbPrice === 0 || priceDiff <= 5.01;

        const candTokens = tokenizeForCandidateMatch(`${rawCandStr} ${rawTagStr}`).filter(t => !MATCH_STOP_WORDS.has(t));
        const candTokenSet = new Set(candTokens);

        for (const candTitle of candTitles) {
            const simRaw = computeMdTitleSimilarity(normTitle, candTitle);
            const coreCand = stripGenericTitleAffixes(candTitle);
            const coreSimRaw = coreRowTitle && coreCand ? computeMdTitleSimilarity(coreRowTitle, coreCand) : 0;
            const sim = isClosePrice || preSingle ? simRaw : simRaw >= 0.9 ? simRaw : 0;
            const coreSim = isClosePrice || preSingle ? coreSimRaw : coreSimRaw >= 0.9 ? coreSimRaw : 0;

            const isPayoutPrefix =
                Boolean(params.allowPrefixForPayout) &&
                (isClosePrice || preSingle) &&
                normTitle.length >= 8 &&
                candTitle.length >= 8 &&
                (candTitle.startsWith(normTitle) ||
                    normTitle.startsWith(candTitle) ||
                    (coreRowTitle.length >= 6 &&
                        coreCand.length >= 6 &&
                        (coreCand.startsWith(coreRowTitle) || coreRowTitle.startsWith(coreCand))));

            let tokenOverlapScore = 0;
            if (rowTokens.length > 0 && candTokens.length > 0) {
                const matchedRowTokens = rowTokens.filter(t => candTokenSet.has(t));
                const matchedSpecific = specificRowTokens.filter(t => candTokenSet.has(t));
                const rowCoverage = matchedRowTokens.length / rowTokens.length;
                const minCoverage = matchedRowTokens.length / Math.min(rowTokens.length, candTokens.length);

                // Distinctive single-word or short-title match (e.g. "Blackbeard", "Stop Thief", "Castles of Burgundy")
                if (
                    specificRowTokens.length > 0 &&
                    matchedSpecific.length === specificRowTokens.length &&
                    (isExactPrice || (isClosePrice && rowCoverage >= 0.5) || rowCoverage >= 0.75)
                ) {
                    tokenOverlapScore = isExactPrice ? 0.91 : 0.87;
                } else if (
                    // Strong multi-token match even when online vs booth price differs (e.g. Demonia 518, Feelhappy Y2K Goth Blouse, Forever 21 Sanrio Kuromi, Tripp NYC Black Grommet Pants, D&D 5e Starter Set)
                    matchedSpecific.length >= 2 &&
                    (rowCoverage >= 0.5 || minCoverage >= 0.6)
                ) {
                    tokenOverlapScore = isExactPrice ? 0.9 : isClosePrice ? 0.88 : 0.86;
                } else if (
                    // "Advanced Dungeons & Dragons" or RPG/Board Game titles with close/exact price match
                    rowCoverage >= 0.65 &&
                    minCoverage >= 0.65 &&
                    isClosePrice &&
                    matchedRowTokens.length >= 2
                ) {
                    tokenOverlapScore = isExactPrice ? 0.89 : 0.86;
                }
            }

            const effectiveSim = Math.max(sim, coreSim, tokenOverlapScore);
            if (effectiveSim >= 0.85 || isPayoutPrefix) {
                const baseScore = isPayoutPrefix ? Math.max(effectiveSim, 0.86) : effectiveSim;
                const priceBonus = isExactPrice ? 0.05 : isClosePrice ? 0.02 : 0;
                const multiBonus = Number(c.quantity ?? 1) > 1 ? 0.02 : 0;
                const score = baseScore + priceBonus + multiBonus;
                if (score > bestScore) {
                    bestScore = score;
                    bestCand = c;
                }
            }
        }
    }

    return bestCand ? finalizeHit(bestCand) : null;
}

/**
 * Resolves the canonical partner bucket (`HUCK` | `PDXGL` | `BB`) for a Ricochet or CSV sale row.
 */
export function resolvePartnerBucketForSaleRow(row: any): 'HUCK' | 'PDXGL' | 'BB' {
    if (!row) return 'HUCK';
    const sku = cleanCatalogSku(row.ricoSku || row.sku || row.extractedSku).toUpperCase();
    const mappedUpc = sku && PREVERIFIED_MD_SKU_TO_UPC_OR_ID[sku] ? PREVERIFIED_MD_SKU_TO_UPC_OR_ID[sku].toUpperCase() : '';
    const upc = cleanCatalogSku(row.matchedItemUpc || row.upc || mappedUpc).toUpperCase();
    const title = String(row.matchedItemTitle || row.title || row.itemName || '').trim();

    if (row.partnerBucket === 'BB' || isBbConsignorRow({ sku, upc, title })) {
        return 'BB';
    }
    if (
        row.partnerBucket === 'PDXGL' ||
        upc.startsWith('PDXGL-') ||
        sku.startsWith('PDXGL-') ||
        /^PDXGL\b/i.test(title)
    ) {
        return 'PDXGL';
    }
    return 'HUCK';
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
        .replace(/\badvanced\s+dungeons\s*(?:&|and)?\s*dragons\b/g, ' add dnd dungeons dragons ')
        .replace(/\bdungeons\s*(?:&|and)\s*dragons\b/g, ' dnd dungeons dragons ')
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



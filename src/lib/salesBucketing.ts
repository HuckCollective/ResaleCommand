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

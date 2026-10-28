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

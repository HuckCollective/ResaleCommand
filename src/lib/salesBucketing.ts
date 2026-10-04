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
    displayName: string;      // e.g. "Huck Collective", "PDX Glass", "Unassigned Store Sales"
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
    configuredPrefixes: string[] = ['HUCK-', 'PDXGL-']
): PartitionedSalesResult {
    const buckets: Record<string, OrgSalesBucket> = {
        HUCK: createEmptyBucket('HUCK', 'HUCK-', 'Huck Collective (HUCK-)'),
        UNASSIGNED: createEmptyBucket('UNASSIGNED', 'NONE', 'Unassigned / Store SKUs')
    };

    configuredPrefixes.forEach(p => {
        const root = p.replace(/[-_]$/, '').toUpperCase();
        if (!buckets[root]) {
            buckets[root] = createEmptyBucket(root, normalizeOrgPrefix(p), `${root} Partner`);
        }
    });

    // Index Appwrite items by UPC, locationSku, and Appwrite $id
    const appwriteByCode = new Map<string, any>();
    appwriteItems.forEach(item => {
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

        if (!matchedItem && rawName) {
            const cleanName = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
            matchedItem = appwriteItems.find(item => {
                if (!item.title) return false;
                const ic = item.title.toLowerCase().replace(/[^a-z0-9]/g, '');
                return ic === cleanName || ic.includes(cleanName) || cleanName.includes(ic);
            }) || null;
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

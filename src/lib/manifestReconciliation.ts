/**
 * Manifest Reconciliation Service
 * 
 * Closes the loop between Memory Den Ricochet POS and Resale Command.
 * Reads Ricochet's inventory export CSV, matches items against the active outbound drop manifest,
 * and stamps the assigned '0EJ...' booth SKUs into Resale Command's database and manifest snapshot.
 */

import Papa from 'papaparse';
import { manifestsApi, type ManifestDocument } from './manifests';
import { cleanLocationSku, isValidOrgUpc } from './upcAuthority';
import { DB_ID, getCollectionId, updateInventoryItem } from './inventory';
import { withRateLimitRetry } from './retry';

export interface RicochetCsvRow {
    productId: string;
    locationSku: string;
    upc: string;
    title: string;
    price: number;
    quantity: number;
    status: string;
}

export interface ReconcileResult {
    success: boolean;
    manifestId: string;
    manifestName: string;
    totalManifestItems: number;
    matchedCount: number;
    updatedItemIds: string[];
    unmatchedItemIds: string[];
    errors: string[];
}

/**
 * Normalizes title for fallback matching
 */
function normalizeTitle(t?: string): string {
    if (!t) return '';
    return t.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

/**
 * Parses Ricochet inventory export CSV into standardized objects.
 */
export function parseRicochetInventoryCsv(csvText: string): RicochetCsvRow[] {
    const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim().replace(/^"|"$/g, '')
    });

    const rows: RicochetCsvRow[] = [];

    for (const raw of parsed.data as any[]) {
        const prodId = String(raw['Product ID'] || raw['productId'] || raw['ID'] || '').trim();
        const rawSku = String(raw['SKU'] || raw['sku'] || '').trim();
        const rawUpc = String(raw['UPC'] || raw['upc'] || raw['Custom Barcode'] || '').trim();
        const name = String(raw['Name'] || raw['Item Title'] || raw['Title'] || raw['Description'] || '').trim();
        const priceStr = String(raw['Agreed Price'] || raw['Price'] || raw['resalePrice'] || '0').replace(/[^0-9.]/g, '');
        const qtyStr = String(raw['Quantity'] || raw['Qty'] || '1').replace(/[^0-9]/g, '');
        const status = String(raw['Inventory'] || raw['Status'] || raw['In Stock'] || '').trim();

        const cleanSku = cleanLocationSku(rawSku);
        const cleanUpc = rawUpc.toUpperCase();

        if (cleanSku || cleanUpc || name) {
            rows.push({
                productId: prodId,
                locationSku: cleanSku,
                upc: cleanUpc,
                title: name,
                price: parseFloat(priceStr) || 0,
                quantity: parseInt(qtyStr, 10) || 1,
                status
            });
        }
    }

    return rows;
}

/**
 * Reconciles an active Drop Manifest with a Ricochet confirmation export CSV.
 */
export async function reconcileManifestWithRicochetCsv(
    manifest: ManifestDocument,
    stagedItems: any[],
    csvText: string
): Promise<ReconcileResult> {
    const ricochetRows = parseRicochetInventoryCsv(csvText);
    const errors: string[] = [];

    if (ricochetRows.length === 0) {
        return {
            success: false,
            manifestId: manifest.$id,
            manifestName: manifest.name,
            totalManifestItems: stagedItems.length,
            matchedCount: 0,
            updatedItemIds: [],
            unmatchedItemIds: stagedItems.map(i => i.$id),
            errors: ['The uploaded CSV contains no valid Ricochet inventory rows.']
        };
    }

    // Build lookups for Ricochet rows
    const upcToRowMap = new Map<string, RicochetCsvRow>();
    const titleToRowMap = new Map<string, RicochetCsvRow>();

    for (const r of ricochetRows) {
        if (r.upc && isValidOrgUpc(r.upc)) {
            upcToRowMap.set(r.upc.toUpperCase(), r);
        }
        if (r.title) {
            titleToRowMap.set(normalizeTitle(r.title), r);
        }
    }

    const updatedItemIds: string[] = [];
    const unmatchedItemIds: string[] = [];
    const itemUpdates: Array<{ id: string; locationSku: string }> = [];

    // Map each staged item to its corresponding Ricochet row
    for (const item of stagedItems) {
        const itemUpc = (item.upc || item.sku || '').trim().toUpperCase();
        let matchedRow: RicochetCsvRow | undefined = undefined;

        // 1. Primary Authority: Exact UPC match (e.g. HUCK-1507)
        if (itemUpc && upcToRowMap.has(itemUpc)) {
            matchedRow = upcToRowMap.get(itemUpc);
        }

        // 2. Secondary Fallback: Normalized Title Match
        if (!matchedRow && item.title) {
            const norm = normalizeTitle(item.title);
            if (titleToRowMap.has(norm)) {
                matchedRow = titleToRowMap.get(norm);
            }
        }

        if (matchedRow && matchedRow.locationSku) {
            itemUpdates.push({
                id: item.$id,
                locationSku: matchedRow.locationSku
            });
            updatedItemIds.push(item.$id);
            // Update local memory object
            item.locationSku = matchedRow.locationSku;
        } else {
            unmatchedItemIds.push(item.$id);
        }
    }

    // Persist updates to Appwrite
    if (itemUpdates.length > 0) {
        for (const update of itemUpdates) {
            try {
                await withRateLimitRetry(() => 
                    updateInventoryItem(update.id, { locationSku: update.locationSku })
                );
            } catch (err: any) {
                errors.push(`Failed to update item ${update.id}: ${err.message}`);
            }
        }

        // 3. Update Manifest Snapshot with new locationSkus
        try {
            const snapshotMap = new Map(itemUpdates.map(u => [u.id, u.locationSku]));
            const nextSnapshot = (manifest.itemsSnapshot || stagedItems).map(s => {
                const sId = s.$id || s.id;
                if (snapshotMap.has(sId)) {
                    return {
                        ...s,
                        locationSku: snapshotMap.get(sId)
                    };
                }
                return s;
            });

            await manifestsApi.updateManifest(manifest.$id, {
                itemsSnapshot: nextSnapshot,
                status: manifest.status === 'draft' ? 'exported' : manifest.status,
                notes: `[Reconciled ${itemUpdates.length} Ricochet SKUs on ${new Date().toLocaleDateString()}] ${manifest.notes || ''}`.trim()
            });
        } catch (mErr: any) {
            errors.push(`Manifest update error: ${mErr.message}`);
        }
    }

    return {
        success: itemUpdates.length > 0,
        manifestId: manifest.$id,
        manifestName: manifest.name,
        totalManifestItems: stagedItems.length,
        matchedCount: itemUpdates.length,
        updatedItemIds,
        unmatchedItemIds,
        errors
    };
}

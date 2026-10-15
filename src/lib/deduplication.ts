import { databases, Query } from './appwrite';
import { getCollectionId } from './inventory';
import { purchasesAPI } from './purchases';

const getDbId = () => (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_APPWRITE_DB_ID) 
    || (typeof process !== 'undefined' && process.env?.PUBLIC_APPWRITE_DB_ID) 
    || 'resale_db';

export interface DedupCheckParams {
    itemId?: string | number | null;
    orderId?: string | number | null;
    teamId?: string | null;
}

export interface DedupMatchResult {
    isDuplicate: boolean;
    matchedDoc: any | null;
    matchMethod: 'identity_exact' | 'upc_sgw' | 'sourcing_location_url' | 'combined_lot_identity' | 'purchase_order_item' | null;
    status: string | null;
    location: string | null;
    upc: string | null;
    title: string | null;
    reason: string | null;
}

/**
 * 5-stage comprehensive duplicate detection for inventory ingestion.
 * Detects standalone items, items combined into master lots, deconstructed items,
 * and items already placed on retail locations (Memory Den, Highgate, etc.).
 */
export async function checkInventoryDuplicate(params: DedupCheckParams): Promise<DedupMatchResult> {
    const rawItemId = params.itemId ? String(params.itemId).trim() : '';
    const cleanItemId = rawItemId.replace(/[^0-9]/g, '');
    const rawOrderId = params.orderId ? String(params.orderId).trim() : '';
    const cleanOrderId = rawOrderId.replace(/[^0-9]/g, '');

    const noMatch: DedupMatchResult = {
        isDuplicate: false,
        matchedDoc: null,
        matchMethod: null,
        status: null,
        location: null,
        upc: null,
        title: null,
        reason: null
    };

    if (!cleanItemId && !cleanOrderId) {
        return noMatch;
    }

    const DB_ID = getDbId();
    const COL_ID = getCollectionId();

    const makeResult = (doc: any, method: DedupMatchResult['matchMethod'], reason: string): DedupMatchResult => {
        const status = doc.status || 'unknown';
        const location = doc.storageLocation || doc.location || 'Warehouse';
        const upc = doc.upc || 'NO-UPC';
        const title = doc.title || 'Untitled';
        return {
            isDuplicate: true,
            matchedDoc: doc,
            matchMethod: method,
            status,
            location,
            upc,
            title,
            reason: `${reason} (${upc} - ${status.toUpperCase()} @ ${location})`
        };
    };

    // Stage 1: Exact identity match (standalone item)
    if (cleanItemId) {
        try {
            const idRes = await databases.listDocuments(DB_ID, COL_ID, [
                Query.equal('identity', cleanItemId),
                Query.limit(1)
            ]);
            if (idRes.documents.length > 0) {
                return makeResult(idRes.documents[0], 'identity_exact', 'Already in inventory by ShopGoodwill Item ID');
            }
        } catch (e) {
            console.warn('[Dedup] Stage 1 check error:', e);
        }

        // Stage 2: UPC prefix check (SGW-{itemId})
        try {
            const upcRes = await databases.listDocuments(DB_ID, COL_ID, [
                Query.equal('upc', `SGW-${cleanItemId}`),
                Query.limit(1)
            ]);
            if (upcRes.documents.length > 0) {
                return makeResult(upcRes.documents[0], 'upc_sgw', 'Already cataloged under SGW barcode');
            }
        } catch (e) {
            console.warn('[Dedup] Stage 2 check error:', e);
        }

        // Stage 3: Sourcing Location URL check (e.g. https://shopgoodwill.com/item/267818315)
        try {
            const srcRes = await databases.listDocuments(DB_ID, COL_ID, [
                Query.contains('sourcingLocation', cleanItemId),
                Query.limit(1)
            ]);
            if (srcRes.documents.length > 0) {
                return makeResult(srcRes.documents[0], 'sourcing_location_url', 'Matched by sourcing URL');
            }
        } catch (e) {
            console.warn('[Dedup] Stage 3 check error:', e);
        }

        // Stage 4: Combined Lot / Master Lot lookup (identity contains itemId)
        try {
            const lotRes = await databases.listDocuments(DB_ID, COL_ID, [
                Query.contains('identity', cleanItemId),
                Query.limit(5)
            ]);
            if (lotRes.documents.length > 0) {
                return makeResult(lotRes.documents[0], 'combined_lot_identity', 'Part of a Combined / Master Lot');
            }
        } catch (e) {
            console.warn('[Dedup] Stage 4 check error:', e);
        }
    }

    // Stage 5: Purchase Order item check (Order ID -> PO -> child items)
    if (cleanOrderId) {
        try {
            const existingPo: any = await purchasesAPI.getPurchaseByOrderId(cleanOrderId);
            if (existingPo?.$id) {
                const poItemsRes = await databases.listDocuments(DB_ID, COL_ID, [
                    Query.equal('purchaseId', existingPo.$id),
                    Query.limit(50)
                ]);

                if (poItemsRes.documents.length > 0) {
                    if (cleanItemId) {
                        const matchedInPo = poItemsRes.documents.find((doc: any) => {
                            const idStr = String(doc.identity || '');
                            const srcStr = String(doc.sourcingLocation || '');
                            const notesStr = String(doc.conditionNotes || doc.condition_notes || '');
                            return idStr.includes(cleanItemId) || srcStr.includes(cleanItemId) || notesStr.includes(cleanItemId);
                        });
                        if (matchedInPo) {
                            return makeResult(matchedInPo, 'purchase_order_item', 'Found in linked Purchase Order');
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('[Dedup] Stage 5 check error:', e);
        }
    }

    return noMatch;
}

/**
 * Batch deduplication scanner with controlled concurrency.
 * Pre-scans an entire list of CSV items before import.
 */
export async function batchCheckDuplicates(
    items: Array<{ itemId?: string | number | null; orderId?: string | number | null; [key: string]: any }>,
    concurrency = 5,
    onProgress?: (scanned: number, total: number) => void
): Promise<Map<any, DedupMatchResult>> {
    const results = new Map<any, DedupMatchResult>();
    const total = items.length;
    let scanned = 0;

    for (let i = 0; i < total; i += concurrency) {
        const chunk = items.slice(i, i + concurrency);
        await Promise.all(
            chunk.map(async (item) => {
                const res = await checkInventoryDuplicate({
                    itemId: item.itemId,
                    orderId: item.orderId
                });
                results.set(item, res);
                scanned++;
                if (onProgress) onProgress(scanned, total);
            })
        );
    }

    return results;
}

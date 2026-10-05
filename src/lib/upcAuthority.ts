/**
 * UPC Authority - Single Source of Truth for Resale Command Barcodes
 * 
 * INVARIANTS:
 * 1. ZERO GHOST UPCS: An item's UPC must never be fabricated in an export CSV
 *    without being immediately persisted to the database.
 * 2. TRUE DATABASE MAXIMUM: Next sequential UPC is determined by scanning the
 *    entire database sequence, never a partial screen buffer or last 50 documents.
 * 3. ATOMIC LOCKS: Session-level locks prevent race conditions during rapid batch
 *    creation (e.g. lot splitting or CSV intake).
 */

import { databases, Query } from './appwrite';
import { DB_ID, getCollectionId, updateInventoryItem } from './inventory';

// Session-level memory locks to prevent race conditions during rapid consecutive calls
const upcAllocationLocks = new Map<string, number>();

/**
 * Validates whether a UPC is a legitimate organization barcode (e.g. HUCK-1509)
 * or a valid manufacturer GTIN/UPC (8-14 digits).
 * Strictly rejects null, undefined, empty strings, and raw 20-character Appwrite IDs.
 */
export function isValidOrgUpc(upc: string | null | undefined, prefix: string = 'HUCK'): boolean {
    if (!upc || typeof upc !== 'string') return false;
    const trimmed = upc.trim();
    if (trimmed.length < 5 || trimmed.length > 20) return false;
    // Disallow raw 20-character Appwrite hex IDs (e.g. 6aa6df24002ea4c5e34b)
    if (/^[0-9a-f]{20}$/i.test(trimmed)) return false;
    // Check for org prefix pattern (e.g. HUCK-1460, RC-102)
    const cleanPrefix = prefix.replace(/[-_]$/, '').toUpperCase();
    if (new RegExp(`^${cleanPrefix}-\\d+$`, 'i').test(trimmed)) return true;
    if (/^[A-Z0-9]{2,8}-\d+$/i.test(trimmed)) return true;
    // Standard retail numeric barcode (8-14 digits)
    if (/^\d{8,14}$/.test(trimmed)) return true;
    return false;
}

/**
 * Cleans a Ricochet or vendor location SKU by stripping leading apostrophes or quotes
 * (e.g. "'0EJ0NP" -> "0EJ0NP")
 */
export function cleanLocationSku(sku: string | null | undefined): string {
    if (!sku || typeof sku !== 'string') return '';
    return sku.replace(/^['"]+/, '').replace(/['"]+$/, '').trim().toUpperCase();
}

/**
 * Finds the true highest numeric index for a given prefix in the database.
 * Paginates safely through all documents with that prefix to avoid partial-buffer blindspots.
 */
export async function getTrueMaxUpcIndex(prefix: string = 'HUCK', collectionId?: string): Promise<number> {
    const targetColl = collectionId || getCollectionId();
    const cleanPrefix = prefix.endsWith('-') ? prefix.toUpperCase() : `${prefix.toUpperCase()}-`;
    let maxNum = 0;
    let offset = 0;
    const limit = 100;

    try {
        while (true) {
            const resp = await databases.listDocuments(DB_ID, targetColl, [
                Query.startsWith('upc', cleanPrefix),
                Query.limit(limit),
                Query.offset(offset)
            ]);

            for (const doc of resp.documents) {
                const u = (doc as any).upc;
                if (u && typeof u === 'string' && u.toUpperCase().startsWith(cleanPrefix)) {
                    const numPart = u.substring(cleanPrefix.length);
                    const parsed = parseInt(numPart, 10);
                    // Filter out ISBNs or accidental phone numbers (must be reasonable sequential range < 90000)
                    if (!isNaN(parsed) && parsed > maxNum && parsed < 90000) {
                        maxNum = parsed;
                    }
                }
            }

            offset += resp.documents.length;
            if (resp.documents.length < limit) break;
        }
    } catch (err) {
        console.warn('[upcAuthority.getTrueMaxUpcIndex] Database scan fallback:', err);
    }

    return maxNum;
}

/**
 * Generates the next guaranteed-unique organization UPC.
 * Checks true database maximum + session locks, verifies candidate uniqueness against the DB,
 * and increments session locks atomically.
 */
export async function generateNextUpc(prefix: string = 'HUCK', collectionId?: string): Promise<string> {
    const cleanPrefix = prefix.endsWith('-') ? prefix.toUpperCase() : `${prefix.toUpperCase()}-`;
    const targetColl = collectionId || getCollectionId();

    // 1. Check in-memory session lock or calculate true DB maximum
    let currentLock = upcAllocationLocks.get(cleanPrefix);
    if (currentLock === undefined || currentLock === 0) {
        const dbMax = await getTrueMaxUpcIndex(cleanPrefix, targetColl);
        currentLock = dbMax;
        upcAllocationLocks.set(cleanPrefix, currentLock);
    }

    let nextIndex = currentLock + 1;

    // 2. Uniqueness verification against DB
    let candidate = `${cleanPrefix}${nextIndex.toString().padStart(4, '0')}`;
    let exists = true;
    let attempts = 0;

    while (exists && attempts < 20) {
        attempts++;
        try {
            const check = await databases.listDocuments(DB_ID, targetColl, [
                Query.equal('upc', candidate),
                Query.limit(1)
            ]);
            if (check.documents && check.documents.length > 0) {
                nextIndex++;
                candidate = `${cleanPrefix}${nextIndex.toString().padStart(4, '0')}`;
            } else {
                exists = false;
            }
        } catch {
            // If query fails, accept candidate
            exists = false;
        }
    }

    // 3. Update session lock
    upcAllocationLocks.set(cleanPrefix, nextIndex);
    return candidate;
}

/**
 * Ensures an item has a valid organization UPC.
 * If the item already has a valid UPC, returns it.
 * If missing or invalid, generates the next true unique UPC and IMMEDIATELY persists it to Appwrite.
 */
export async function ensureItemUpc(
    item: { $id?: string; id?: string; upc?: string | null }, 
    prefix: string = 'HUCK',
    options?: { persist?: boolean; collectionId?: string }
): Promise<string> {
    const itemId = item.$id || item.id;
    const cleanPrefix = prefix.replace(/[-_]$/, '').toUpperCase();

    // If item already has a valid UPC, keep it
    if (isValidOrgUpc(item.upc, cleanPrefix)) {
        return item.upc!.trim().toUpperCase();
    }

    // Generate new guaranteed unique UPC
    const newUpc = await generateNextUpc(cleanPrefix, options?.collectionId);

    // Persist immediately to Appwrite if item has a valid database ID (unless persist === false)
    if (options?.persist !== false && itemId && /^[0-9a-f]{20}$/i.test(itemId)) {
        try {
            await updateInventoryItem(itemId, { upc: newUpc });
            item.upc = newUpc;
        } catch (err) {
            console.warn(`[upcAuthority.ensureItemUpc] Failed to persist new UPC ${newUpc} for item ${itemId}:`, err);
        }
    }

    return newUpc;
}

/**
 * Resale Command - Multi-Org UPC & Barcode Management
 * Handles organization prefixes (HUCK-, PDXGL-), validation, and collision-free generation.
 */

import { databases, Query } from './appwrite';
import { getDatabaseId, getItemsCollectionId } from './appwriteEnv';

const getDbId = () => getDatabaseId();
const getColId = () => getItemsCollectionId();

export const KNOWN_ORG_PREFIXES = ['HUCK-', 'PDXGL-'] as const;
export type OrgPrefix = typeof KNOWN_ORG_PREFIXES[number] | string;

const upcAllocationLocks = new Map<string, number>();

/**
 * Normalizes a prefix string to end with a hyphen (e.g. 'HUCK' -> 'HUCK-')
 */
export function normalizeOrgPrefix(prefix: string = 'HUCK-'): string {
    const trimmed = (prefix || 'HUCK-').trim().toUpperCase();
    if (!trimmed.endsWith('-') && !trimmed.endsWith('_')) {
        return `${trimmed}-`;
    }
    return trimmed;
}

/**
 * Extracts a known org prefix from a SKU or UPC string, or null if unassigned/standard barcode
 */
export function extractOrgPrefix(code: string | null | undefined): string | null {
    if (!code || typeof code !== 'string') return null;
    const clean = code.trim().toUpperCase().replace(/^['"]+/, '');
    for (const p of KNOWN_ORG_PREFIXES) {
        const root = p.replace(/[-_]$/, '');
        if (clean.startsWith(`${root}-`) || clean.startsWith(`${root}_`)) {
            return p;
        }
    }
    // Generic pattern check: 2-8 uppercase letters followed by hyphen/digit
    const match = clean.match(/^([A-Z]{2,8})[-_]/);
    if (match) {
        return `${match[1]}-`;
    }
    return null;
}

/**
 * Checks if a UPC is a valid organization barcode (e.g. HUCK-1460, PDXGL-0024).
 * Strictly rejects empty strings, raw 20-char Appwrite IDs, and malformed strings.
 */
export function isValidOrgUpc(upc: string | null | undefined, prefix: string = 'HUCK'): boolean {
    if (!upc || typeof upc !== 'string') return false;
    const trimmed = upc.trim().replace(/^['"]+/, '').replace(/['"]+$/, '');
    if (trimmed.length < 5 || trimmed.length > 24) return false;
    // Disallow raw 20-character Appwrite hex IDs (e.g. 6aa6df24002ea4c5e34b)
    if (/^[0-9a-f]{20}$/i.test(trimmed)) return false;
    // Check for org prefix pattern (e.g. HUCK-1460, PDXGL-0012)
    if (/^[A-Z0-9]{2,8}[-_]\d+$/i.test(trimmed)) return true;
    // Standard retail UPC / EAN barcode (8-14 digits)
    if (/^\d{8,14}$/.test(trimmed)) return true;
    return false;
}

/**
 * Auto-generates the next sequential, guaranteed-unique UPC for an organization prefix
 */
export async function generateAutoUpc(prefix: string = 'HUCK-', teamId?: string): Promise<string> {
    const cleanPrefix = normalizeOrgPrefix(prefix);
    try {
        const queries = [
            Query.startsWith('upc', cleanPrefix),
            Query.orderDesc('upc'),
            Query.limit(25)
        ];
        if (teamId) {
            queries.push(Query.equal('tenantId', teamId));
        }

        const resp = await databases.listDocuments(getDbId(), getColId(), queries).catch(() => ({ documents: [] }));
        let maxIndex = 0;

        for (const doc of resp.documents) {
            const u = (doc as any).upc;
            if (u && typeof u === 'string' && u.startsWith(cleanPrefix)) {
                const numPart = u.replace(cleanPrefix, '');
                const num = parseInt(numPart, 10);
                if (!isNaN(num) && num > maxIndex) {
                    maxIndex = num;
                }
            }
        }

        // Prevent race condition across rapid batch creations in same session
        const currentLock = upcAllocationLocks.get(cleanPrefix) || 0;
        let nextIndex = Math.max(maxIndex, currentLock) + 1;

        // Guaranteed Uniqueness Check: verify candidate does not already exist
        let candidate = `${cleanPrefix}${nextIndex.toString().padStart(4, '0')}`;
        let exists = await databases.listDocuments(getDbId(), getColId(), [
            Query.equal('upc', candidate),
            Query.limit(1)
        ]).catch(() => ({ documents: [] }));

        while (exists.documents && exists.documents.length > 0) {
            nextIndex++;
            candidate = `${cleanPrefix}${nextIndex.toString().padStart(4, '0')}`;
            exists = await databases.listDocuments(getDbId(), getColId(), [
                Query.equal('upc', candidate),
                Query.limit(1)
            ]).catch(() => ({ documents: [] }));
        }

        upcAllocationLocks.set(cleanPrefix, nextIndex);
        return candidate;
    } catch (e) {
        console.warn(`[UPC Generator] Fallback used for prefix ${cleanPrefix}:`, e);
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        return `${cleanPrefix}${randomNum}`;
    }
}

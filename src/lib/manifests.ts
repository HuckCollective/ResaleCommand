import { databases, Query, ID } from './appwrite';
import type { Models } from 'appwrite';
import { Permission, Role } from 'appwrite';
import { DB_ID, getCollectionId, updateInventoryItem } from './inventory';
import { withRateLimitRetry } from './retry';
import { findFacility } from './warehouses';

export const MANIFESTS_COL = 'manifests';

export interface ManifestItemSummary {
    $id: string;
    title: string;
    upc?: string;
    locationSku?: string;
    cost?: number;
    price?: number;
    resalePrice?: number;
    quantity?: number;
    imageId?: string | null;
    storageLocation?: string;
}

export interface ManifestData {
    name: string;
    tenantId: string;
    locationId: string;
    locationName: string;
    status: 'draft' | 'paused' | 'exported' | 'in-transit' | 'placed' | 'cancelled';
    itemIds: string[]; // item IDs
    placedItemIds?: string[]; // item IDs confirmed placed in booth
    itemsSnapshot?: ManifestItemSummary[];
    itemCount?: number;
    totalCost?: number;
    totalRetail?: number;
    estimatedNet?: number;
    commissionRate?: number;
    exportedAt?: string | null;
    placedAt?: string | null;
    notes?: string;
}

export type ManifestDocument = Models.Document & {
    name: string;
    tenantId: string;
    locationId: string;
    locationName: string;
    status: 'draft' | 'paused' | 'exported' | 'in-transit' | 'placed' | 'cancelled';
    itemIds: string[];
    placedItemIds: string[];
    itemsSnapshot?: ManifestItemSummary[];
    itemCount: number;
    totalCost: number;
    totalRetail: number;
    estimatedNet: number;
    commissionRate: number;
    exportedAt?: string | null;
    placedAt?: string | null;
    notes?: string;
};

function parseDoc(doc: any): ManifestDocument {
    let itemIds: string[] = [];
    if (Array.isArray(doc.itemIds)) {
        itemIds = doc.itemIds;
    } else if (typeof doc.itemIds === 'string' && doc.itemIds.trim()) {
        try {
            itemIds = JSON.parse(doc.itemIds);
        } catch {
            itemIds = doc.itemIds.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
    }

    let placedItemIds: string[] = [];
    if (Array.isArray(doc.placedItemIds)) {
        placedItemIds = doc.placedItemIds;
    } else if (typeof doc.placedItemIds === 'string' && doc.placedItemIds.trim()) {
        try {
            placedItemIds = JSON.parse(doc.placedItemIds);
        } catch {
            placedItemIds = doc.placedItemIds.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
    }

    let itemsSnapshot: ManifestItemSummary[] = [];
    if (Array.isArray(doc.itemsSnapshot)) {
        itemsSnapshot = doc.itemsSnapshot;
    } else if (typeof doc.itemsSnapshot === 'string' && doc.itemsSnapshot.trim()) {
        try {
            itemsSnapshot = JSON.parse(doc.itemsSnapshot);
        } catch {
            itemsSnapshot = [];
        }
    }

    // Resilience for older / legacy manifests:
    // 1. Recover itemIds from snapshot if empty in document
    if (itemIds.length === 0 && itemsSnapshot.length > 0) {
        itemIds = itemsSnapshot.map((s: any) => s.$id || s.id).filter(Boolean);
    }

    // 2. Recover from legacy 'items' or 'item_ids' fields
    if (itemIds.length === 0 && Array.isArray(doc.items)) {
        itemIds = doc.items.map((i: any) => typeof i === 'string' ? i : (i.$id || i.id)).filter(Boolean);
    }
    if (itemIds.length === 0 && typeof doc.item_ids === 'string') {
        try { 
            const parsed = JSON.parse(doc.item_ids);
            if (Array.isArray(parsed)) itemIds = parsed.map((i: any) => typeof i === 'string' ? i : (i.$id || i.id)).filter(Boolean);
        } catch { /* ignore */ }
    }

    // 3. Normalize legacy status representations
    let rawStatus = (doc.status || 'draft').toLowerCase();
    let status: ManifestDocument['status'] = 'draft';
    if (rawStatus === 'active') {
        status = 'draft';
    } else if (rawStatus === 'closed' || rawStatus === 'completed' || rawStatus === 'archived' || rawStatus === 'placed') {
        status = 'placed';
    } else if (rawStatus === 'paused') {
        status = 'paused';
    } else if (rawStatus === 'in-transit' || rawStatus === 'intransit' || rawStatus === 'locked') {
        status = 'in-transit';
    } else if (rawStatus === 'exported') {
        status = 'exported';
    } else if (rawStatus === 'cancelled' || rawStatus === 'canceled') {
        status = 'cancelled';
    } else if (doc.placedAt || doc.deployedAt) {
        status = 'placed';
    }

    // 4. Default placedItemIds if manifest was marked placed/closed but placedItemIds was not tracked
    if (status === 'placed' && placedItemIds.length === 0 && itemIds.length > 0) {
        placedItemIds = [...itemIds];
    }

    return {
        ...doc,
        status,
        itemIds,
        placedItemIds,
        itemsSnapshot,
        itemCount: doc.itemCount ?? itemIds.length,
        totalCost: Number(doc.totalCost || 0),
        totalRetail: Number(doc.totalRetail || 0),
        estimatedNet: Number(doc.estimatedNet || 0),
        commissionRate: Number(doc.commissionRate || 0),
    };
}

function serializeForSave(data: Partial<ManifestData>): Record<string, any> {
    const payload: Record<string, any> = { ...data };
    if (Array.isArray(payload.itemIds)) {
        payload.itemIds = JSON.stringify(payload.itemIds);
    }
    if (Array.isArray(payload.placedItemIds)) {
        payload.placedItemIds = JSON.stringify(payload.placedItemIds);
    }
    if (Array.isArray(payload.itemsSnapshot)) {
        payload.itemsSnapshot = JSON.stringify(payload.itemsSnapshot);
    }
    return payload;
}

export const manifestsApi = {
    /**
     * List all manifests for a tenant, optionally filtered by location or status
     */
    async listManifests(tenantId?: string, locationId?: string, status?: string): Promise<ManifestDocument[]> {
        try {
            const queries = [Query.orderDesc('$updatedAt'), Query.limit(100)];
            if (tenantId) queries.push(Query.equal('tenantId', tenantId));
            if (locationId) queries.push(Query.equal('locationId', locationId));
            if (status) queries.push(Query.equal('status', status));

            const resp = await databases.listDocuments(DB_ID, MANIFESTS_COL, queries);
            return resp.documents.map(parseDoc);
        } catch (err: any) {
            console.warn('[manifestsApi.listManifests] Error reading manifests:', err);
            return [];
        }
    },

    /**
     * List all draft, paused, or in-transit manifests for a tenant
     */
    async listDrafts(tenantId?: string, locationId?: string): Promise<ManifestDocument[]> {
        try {
            const queries = [
                Query.equal('status', ['draft', 'paused', 'in-transit']),
                Query.orderDesc('$updatedAt'),
                Query.limit(50)
            ];
            if (tenantId) queries.push(Query.equal('tenantId', tenantId));
            if (locationId) queries.push(Query.equal('locationId', locationId));

            const resp = await databases.listDocuments(DB_ID, MANIFESTS_COL, queries);
            return resp.documents.map(parseDoc);
        } catch (err: any) {
            console.warn('[manifestsApi.listDrafts] Error:', err);
            return [];
        }
    },

    /**
     * List recent manifests including drafts, in-transit, and recent placed/closed drops
     */
    async listRecentManifests(tenantId?: string, locationId?: string, limit = 50): Promise<ManifestDocument[]> {
        try {
            const queries = [
                Query.equal('status', ['draft', 'paused', 'in-transit', 'placed', 'exported', 'active', 'closed', 'completed', 'archived']),
                Query.orderDesc('$updatedAt'),
                Query.limit(limit)
            ];
            if (tenantId) queries.push(Query.equal('tenantId', tenantId));
            if (locationId) queries.push(Query.equal('locationId', locationId));

            const resp = await databases.listDocuments(DB_ID, MANIFESTS_COL, queries);
            return resp.documents.map(parseDoc);
        } catch (err: any) {
            console.warn('[manifestsApi.listRecentManifests] Error:', err);
            return [];
        }
    },

    /**
     * Get the active draft manifest for a location (or general draft)
     */
    async getActiveDraft(tenantId?: string, locationId?: string): Promise<ManifestDocument | null> {
        try {
            const queries = [
                Query.equal('status', 'draft'),
                Query.orderDesc('$updatedAt'),
                Query.limit(1)
            ];
            if (tenantId) queries.push(Query.equal('tenantId', tenantId));
            if (locationId) queries.push(Query.equal('locationId', locationId));

            const resp = await databases.listDocuments(DB_ID, MANIFESTS_COL, queries);
            if (resp.documents.length > 0) {
                return parseDoc(resp.documents[0]);
            }
            return null;
        } catch (err: any) {
            console.warn('[manifestsApi.getActiveDraft] Error:', err);
            return null;
        }
    },

    /**
     * Pause an active manifest
     */
    async pauseManifest(id: string): Promise<ManifestDocument> {
        return await this.updateManifest(id, { status: 'paused' });
    },

    /**
     * Resume a paused manifest
     */
    async resumeManifest(id: string): Promise<ManifestDocument> {
        return await this.updateManifest(id, { status: 'draft' });
    },

    /**
     * Lock manifest into In-Transit state (packed & en route to destination)
     */
    async lockManifest(id: string): Promise<ManifestDocument> {
        return await this.updateManifest(id, { status: 'in-transit' });
    },

    /**
     * Unlock manifest back to draft for edits/corrections
     */
    async unlockManifest(id: string): Promise<ManifestDocument> {
        return await this.updateManifest(id, { status: 'draft' });
    },

    /**
     * Verify or unverify an individual item placement (PO Receiving style)
     */
    async verifyItemPlacement(
        manifestId: string, 
        itemId: string, 
        targetLocation: string, 
        undo = false
    ): Promise<{ manifest: ManifestDocument; updatedItem: any }> {
        const manifest = await this.getManifest(manifestId);
        const placedSet = new Set(manifest.placedItemIds || []);

        const facility = findFacility(targetLocation);
        const locCode = facility ? facility.code : targetLocation;
        const locName = facility ? facility.name : targetLocation;

        const itemUpdates = !undo ? {
            status: 'placed',
            storageLocation: locCode,
            sellingLocations: [locName]
        } : {
            status: 'active',
            storageLocation: 'HG',
            sellingLocations: ['HG']
        };

        if (!undo) {
            placedSet.add(itemId);
        } else {
            placedSet.delete(itemId);
        }

        // 1. FAST PATH: Server Bulk Update API (elevated server privileges)
        let updatedItem: any = null;
        try {
            const resp = await fetch('/api/inventory/bulk-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    itemIds: [itemId],
                    updates: itemUpdates,
                    collectionId: getCollectionId(),
                    dbId: DB_ID
                })
            });
            if (resp.ok) {
                const res = await resp.json();
                if (res.success) {
                    updatedItem = { $id: itemId, ...itemUpdates };
                }
            }
        } catch (serverErr) {
            console.warn('[manifestsApi.verifyItemPlacement] Server API fallback:', serverErr);
        }

        // 2. FALLBACK PATH: Client-side direct update
        if (!updatedItem) {
            updatedItem = await withRateLimitRetry(() => 
                updateInventoryItem(itemId, itemUpdates)
            );
        }

        const nextPlacedIds = Array.from(placedSet);
        const updatedManifest = await this.updateManifest(manifestId, {
            placedItemIds: nextPlacedIds
        });

        return { manifest: updatedManifest, updatedItem };
    },

    /**
     * Finalize manifest placement: set status to 'placed' and record timestamp
     */
    async finalizePlacement(manifestId: string): Promise<ManifestDocument> {
        return await this.updateManifest(manifestId, {
            status: 'placed',
            placedAt: new Date().toISOString()
        });
    },

    /**
     * Rollback a placed or in-transit manifest back to draft:
     * - Reverts all constituent items back to 'in-stock' at specified storage location (e.g. Backstock)
     * - Clears item placed status and sellingLocations
     * - Restores manifest document to 'draft' with placedItemIds = [] and placedAt = null
     */
    async rollbackManifest(
        manifestId: string, 
        options?: { revertItemsToStatus?: string; targetStorageLocation?: string }
    ): Promise<ManifestDocument> {
        const manifest = await this.getManifest(manifestId);

        // Recover constituent item IDs from all potential fields (itemIds, placedItemIds, itemsSnapshot, and legacy items)
        const snapshotIds = (manifest.itemsSnapshot || []).map((s: any) => s.$id || (s as any).id).filter(Boolean);
        const legacyItems = Array.isArray((manifest as any).items) 
            ? (manifest as any).items.map((i: any) => typeof i === 'string' ? i : (i.$id || i.id)).filter(Boolean)
            : [];

        const itemIdsToRevert = Array.from(new Set([
            ...(manifest.placedItemIds || []),
            ...(manifest.itemIds || []),
            ...snapshotIds,
            ...legacyItems
        ]));

        const revertStatus = options?.revertItemsToStatus || 'in-stock';
        const revertLocation = options?.targetStorageLocation || 'Backstock';

        const itemUpdates = {
            status: revertStatus,
            storageLocation: revertLocation,
            sellingLocations: []
        };

        if (itemIdsToRevert.length > 0) {
            // 1. FAST PATH: Server Bulk Update API (elevated server permissions)
            let serverSuccess = false;
            try {
                const resp = await fetch('/api/inventory/bulk-update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        itemIds: itemIdsToRevert,
                        updates: itemUpdates,
                        collectionId: getCollectionId(),
                        dbId: DB_ID
                    })
                });
                if (resp.ok) {
                    const res = await resp.json();
                    if (res.success) serverSuccess = true;
                }
            } catch (serverErr) {
                console.warn('[manifestsApi.rollbackManifest] Server bulk update fallback:', serverErr);
            }

            // 2. FALLBACK PATH: Client-side rate-limit retry
            if (!serverSuccess) {
                for (const id of itemIdsToRevert) {
                    try {
                        await withRateLimitRetry(() => updateInventoryItem(id, itemUpdates));
                    } catch (e) {
                        console.warn(`[manifestsApi.rollbackManifest] Fallback item revert failed for ${id}:`, e);
                    }
                }
            }
        }

        // 3. Update Manifest doc back to draft, ensuring itemIds are preserved if recovered from snapshot
        const manifestUpdates: Partial<ManifestData> = {
            status: 'draft',
            placedAt: null,
            placedItemIds: []
        };
        if (manifest.itemIds.length === 0 && itemIdsToRevert.length > 0) {
            manifestUpdates.itemIds = itemIdsToRevert;
            manifestUpdates.itemCount = itemIdsToRevert.length;
        }

        return await this.updateManifest(manifestId, manifestUpdates);
    },

    /**
     * Unverify all items on a manifest without removing them from staging:
     * - Resets all verified placed item records back to 'in-stock'
     * - Clears placedItemIds to empty array
     */
    async unverifyManifestItems(manifestId: string): Promise<ManifestDocument> {
        const manifest = await this.getManifest(manifestId);
        let placedIds = manifest.placedItemIds || [];
        // If older manifest was marked placed/closed but placedItemIds was not tracked, unverify all itemIds
        if (placedIds.length === 0 && (manifest.status === 'placed' || (manifest as any).placedAt)) {
            placedIds = manifest.itemIds || [];
        }

        if (placedIds.length > 0) {
            const itemUpdates = {
                status: 'in-stock',
                sellingLocations: []
            };

            try {
                await fetch('/api/inventory/bulk-update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        itemIds: placedIds,
                        updates: itemUpdates,
                        collectionId: getCollectionId(),
                        dbId: DB_ID
                    })
                });
            } catch (err) {
                console.warn('[manifestsApi.unverifyManifestItems] Bulk update fallback:', err);
                for (const id of placedIds) {
                    try {
                        await withRateLimitRetry(() => updateInventoryItem(id, itemUpdates));
                    } catch (e) {
                        // continue
                    }
                }
            }
        }

        return await this.updateManifest(manifestId, {
            placedItemIds: []
        });
    },

    /**
     * Get a single manifest by ID
     */
    async getManifest(id: string): Promise<ManifestDocument> {
        const doc = await databases.getDocument(DB_ID, MANIFESTS_COL, id);
        return parseDoc(doc);
    },

    /**
     * Create a new manifest document
     */
    async createManifest(data: ManifestData): Promise<ManifestDocument> {
        const payload = serializeForSave(data);
        const perms = [
            Permission.read(Role.any()),
            Permission.update(Role.any()),
            Permission.delete(Role.any()),
        ];
        if (data.tenantId) {
            perms.unshift(Permission.read(Role.team(data.tenantId)));
            perms.unshift(Permission.update(Role.team(data.tenantId)));
            perms.unshift(Permission.delete(Role.team(data.tenantId)));
        }

        const doc = await databases.createDocument(
            DB_ID,
            MANIFESTS_COL,
            ID.unique(),
            payload,
            perms
        );
        return parseDoc(doc);
    },

    /**
     * Update an existing manifest
     */
    async updateManifest(id: string, updates: Partial<ManifestData>): Promise<ManifestDocument> {
        const payload = serializeForSave(updates);
        const doc = await databases.updateDocument(DB_ID, MANIFESTS_COL, id, payload);
        return parseDoc(doc);
    },

    /**
     * Delete a manifest
     */
    async deleteManifest(id: string): Promise<void> {
        await databases.deleteDocument(DB_ID, MANIFESTS_COL, id);
    },

    /**
     * In-store placement confirmation: batch-update items to 'placed', storageLocation, and ricochetSynced
     */
    async deployManifest(
        manifestId: string, 
        confirmedItemIds: string[], 
        targetLocation: string,
        onProgress?: (progress: number, current: number, total: number) => void
    ): Promise<{ updatedCount: number; errors: string[] }> {
        const total = confirmedItemIds.length;
        let updatedCount = 0;
        const errors: string[] = [];

        const facility = findFacility(targetLocation);
        const locCode = facility ? facility.code : targetLocation;
        const locName = facility ? facility.name : targetLocation;

        const itemUpdates = {
            status: 'placed',
            storageLocation: locCode,
            sellingLocations: [locName]
        };

        // 1. FAST PATH: Server Bulk Update API (bypasses browser client rate limits)
        try {
            const resp = await fetch('/api/inventory/bulk-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    itemIds: confirmedItemIds,
                    updates: itemUpdates,
                    collectionId: getCollectionId(),
                    dbId: DB_ID
                })
            });

            if (resp.ok) {
                const result = await resp.json();
                if (result.success) {
                    updatedCount = result.updatedCount ?? total;
                    if (onProgress) onProgress(100, total, total);
                }
            }
        } catch (serverErr) {
            console.warn('[manifestsApi.deployManifest] Server bulk update fallback:', serverErr);
        }

        // 2. FALLBACK PATH: If server update failed, update individually with rate-limit retries
        if (updatedCount === 0 && total > 0) {
            for (let i = 0; i < total; i++) {
                const itemId = confirmedItemIds[i];
                try {
                    await withRateLimitRetry(() => 
                        updateInventoryItem(itemId, itemUpdates)
                    );
                    updatedCount++;
                } catch (err: any) {
                    errors.push(`Item ${itemId}: ${err.message}`);
                }
                if (onProgress) {
                    onProgress(Math.round(((i + 1) / total) * 100), i + 1, total);
                }
            }
        }

        // 3. Update manifest status to 'placed'
        try {
            await this.updateManifest(manifestId, {
                status: 'placed',
                placedAt: new Date().toISOString()
            });
        } catch (mErr) {
            console.warn('[manifestsApi.deployManifest] Could not update manifest status:', mErr);
        }

        return { updatedCount, errors };
    }
};

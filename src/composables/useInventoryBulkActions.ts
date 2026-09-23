import { ref } from 'vue';
import { Permission, Role, type Models } from 'appwrite';
import { databases, ID, Query } from '../lib/appwrite';
import { updateInventoryItem, deleteInventoryItem, getCollectionId, DB_ID } from '../lib/inventory';
import { generateGenericCsv, generateEbayCsv, generatePoshmarkCsv, generateRicochetCsv, downloadCsv } from '../lib/exportUtils';
import { withRateLimitRetry } from '../lib/retry';
import { syncPurchaseStatusForItems } from '../lib/purchases';
import { useLoader } from './useLoader';
import { addToast } from '../stores/toast';

export type ExportFormat = 'ricochet' | 'ebay' | 'poshmark' | 'generic';

/**
 * Composable for bulk operations on inventory items (location assignment, status transitions, bundling, and exports/deletions).
 * Employs server-side accelerated batching with APPWRITE_API_KEY (to avoid client rate limits on 300+ items)
 * and falls back seamlessly to client-side exponential backoff pacing.
 */
export function useInventoryBulkActions(onSuccess?: () => Promise<void> | void) {
    const isApplyingBulk = ref(false);
    const bulkLocationTarget = ref('');
    const bulkStatusTarget = ref('');
    const { showLoader, hideLoader } = useLoader();

    const applyBulkLocation = async (itemIds: string[], targetLocation: string) => {
        if (!targetLocation || !itemIds || itemIds.length === 0) return false;
        isApplyingBulk.value = true;
        const total = itemIds.length;

        showLoader("Moving Records...", {
            step: `Relocating ${total} records to "${targetLocation}"...`,
            progress: null,
            cancelable: false
        });

        try {
            // 1. FAST PATH: Server-Side Bulk Update (bypasses client browser rate limits with admin key)
            try {
                const resp = await fetch('/api/inventory/bulk-update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        itemIds,
                        updates: { storageLocation: targetLocation },
                        collectionId: getCollectionId(),
                        dbId: DB_ID
                    })
                });

                if (resp.ok) {
                    const data = await resp.json();
                    if (data.success) {
                        const count = data.updatedCount ?? total;
                        addToast({ 
                            type: 'success', 
                            message: `Successfully moved ${count} items to "${targetLocation}".` 
                        });
                        bulkLocationTarget.value = '';
                        if (onSuccess) await onSuccess();
                        return true;
                    }
                }
                console.warn("Server bulk update fell through, attempting client fallback...");
            } catch (serverErr) {
                console.warn("Server bulk-update unreachable, falling back to client execution:", serverErr);
            }

            // 2. FALLBACK PATH: Paced Client-Side Loop with Rate Limit Protection
            let successCount = 0;
            for (let idx = 0; idx < total; idx++) {
                const id = itemIds[idx];
                const percent = Math.round(((idx + 1) / total) * 100);

                showLoader("Moving Records...", {
                    step: `Item ${idx + 1} of ${total}: Moving to "${targetLocation}" (${percent}%)`,
                    progress: percent,
                    cancelable: false
                });

                await withRateLimitRetry(
                    () => updateInventoryItem(id, { storageLocation: targetLocation }),
                    {
                        onRetry: (attempt, delayMs) => {
                            showLoader("Rate Limit Protection...", {
                                step: `⏳ Pausing ${Math.ceil(delayMs / 1000)}s to respect cloud rate limits (attempt ${attempt}/5)...`,
                                progress: percent,
                                cancelable: false
                            });
                        }
                    }
                );

                successCount++;

                // Gentle 120ms inter-item spacing on client side
                if (total > 1 && idx < total - 1) {
                    await new Promise(r => setTimeout(r, 120));
                }
            }

            addToast({ type: 'success', message: `Moved ${successCount} items to "${targetLocation}".` });
            bulkLocationTarget.value = '';
            if (onSuccess) await onSuccess();
            return true;
        } catch (e: any) {
            console.error("Bulk location update failed:", e);
            addToast({ type: 'error', message: `Bulk location update failed: ${e.message}` });
            return false;
        } finally {
            isApplyingBulk.value = false;
            hideLoader();
        }
    };

    const applyBulkStatus = async (itemIds: string[], targetStatus: string) => {
        if (!targetStatus || !itemIds || itemIds.length === 0) return false;
        isApplyingBulk.value = true;
        const total = itemIds.length;

        showLoader("Updating Status...", {
            step: `Updating status to "${targetStatus}" for ${total} items...`,
            progress: null,
            cancelable: false
        });

        try {
            // 1. FAST PATH: Server-Side Bulk Update
            try {
                const resp = await fetch('/api/inventory/bulk-update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        itemIds,
                        updates: { status: targetStatus },
                        collectionId: getCollectionId(),
                        dbId: DB_ID
                    })
                });

                if (resp.ok) {
                    const data = await resp.json();
                    if (data.success) {
                        const count = data.updatedCount ?? total;
                        addToast({ 
                            type: 'success', 
                            message: `Updated status to "${targetStatus}" for ${count} items.` 
                        });
                        bulkStatusTarget.value = '';
                        if (onSuccess) await onSuccess();
                        return true;
                    }
                }
            } catch (serverErr) {
                console.warn("Server bulk-update unreachable, falling back to client execution:", serverErr);
            }

            // 2. FALLBACK PATH: Paced Client-Side Loop
            let successCount = 0;
            for (let idx = 0; idx < total; idx++) {
                const id = itemIds[idx];
                const percent = Math.round(((idx + 1) / total) * 100);

                showLoader("Updating Status...", {
                    step: `Item ${idx + 1} of ${total}: Setting status to "${targetStatus}" (${percent}%)`,
                    progress: percent,
                    cancelable: false
                });

                await withRateLimitRetry(
                    () => updateInventoryItem(id, { status: targetStatus }),
                    {
                        onRetry: (attempt, delayMs) => {
                            showLoader("Rate Limit Protection...", {
                                step: `⏳ Pausing ${Math.ceil(delayMs / 1000)}s for rate limit recovery (attempt ${attempt}/5)...`,
                                progress: percent,
                                cancelable: false
                            });
                        }
                    }
                );

                successCount++;

                if (total > 1 && idx < total - 1) {
                    await new Promise(r => setTimeout(r, 120));
                }
            }

            addToast({ type: 'success', message: `Updated status to "${targetStatus}" for ${successCount} items.` });
            bulkStatusTarget.value = '';
            if (onSuccess) await onSuccess();
            return true;
        } catch (e: any) {
            console.error("Bulk status update failed:", e);
            addToast({ type: 'error', message: `Bulk status update failed: ${e.message}` });
            return false;
        } finally {
            isApplyingBulk.value = false;
            hideLoader();
        }
    };

    const deleteBulkItems = async (itemIds: string[]) => {
        if (!itemIds || itemIds.length === 0) return false;
        isApplyingBulk.value = true;
        const total = itemIds.length;

        showLoader("Deleting Records...", {
            step: `Deleting ${total} items...`,
            progress: null,
            cancelable: false
        });

        try {
            // 1. FAST PATH: Server-Side Bulk Delete
            try {
                const resp = await fetch('/api/inventory/bulk-delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        itemIds,
                        collectionId: getCollectionId(),
                        dbId: DB_ID
                    })
                });

                if (resp.ok) {
                    const data = await resp.json();
                    if (data.success) {
                        const count = data.deletedCount ?? total;
                        addToast({ type: 'success', message: `Deleted ${count} items.` });
                        if (onSuccess) await onSuccess();
                        return true;
                    }
                }
            } catch (serverErr) {
                console.warn("Server bulk-delete unreachable, falling back to client execution:", serverErr);
            }

            // 2. FALLBACK PATH: Paced Client-Side Loop
            let deletedCount = 0;
            for (let idx = 0; idx < total; idx++) {
                const id = itemIds[idx];
                const percent = Math.round(((idx + 1) / total) * 100);

                showLoader("Deleting Records...", {
                    step: `Item ${idx + 1} of ${total}: Deleting (${percent}%)`,
                    progress: percent,
                    cancelable: false
                });

                await withRateLimitRetry(
                    () => deleteInventoryItem(id),
                    {
                        onRetry: (attempt, delayMs) => {
                            showLoader("Rate Limit Protection...", {
                                step: `⏳ Pausing ${Math.ceil(delayMs / 1000)}s for rate limit recovery (attempt ${attempt}/5)...`,
                                progress: percent,
                                cancelable: false
                            });
                        }
                    }
                );

                deletedCount++;

                if (total > 1 && idx < total - 1) {
                    await new Promise(r => setTimeout(r, 120));
                }
            }

            addToast({ type: 'success', message: `Deleted ${deletedCount} items.` });
            if (onSuccess) await onSuccess();
            return true;
        } catch (e: any) {
            console.error("Bulk delete failed:", e);
            addToast({ type: 'error', message: `Bulk delete failed: ${e.message}` });
            return false;
        } finally {
            isApplyingBulk.value = false;
            hideLoader();
        }
    };

    const exportBulkItems = (items: Models.Document[], format: ExportFormat = 'generic') => {
        if (!items || items.length === 0) {
            addToast({ type: 'warning', message: 'No items selected to export.' });
            return false;
        }

        let csv = '';
        if (format === 'ricochet') csv = generateRicochetCsv(items);
        else if (format === 'ebay') csv = generateEbayCsv(items);
        else if (format === 'poshmark') csv = generatePoshmarkCsv(items);
        else csv = generateGenericCsv(items);

        const filename = `inventory-export-${format}-${new Date().toISOString().split('T')[0]}.csv`;
        downloadCsv(csv, filename);
        addToast({ type: 'success', message: `Exported ${items.length} items for ${format}.` });
        return true;
    };

    const applyBulkUnified = async (
        itemIds: string[], 
        updates: { 
            storageLocation?: string; 
            status?: string; 
            channel?: string; 
            sellingLocations?: string[];
        }
    ) => {
        if (!itemIds || itemIds.length === 0 || !updates || Object.keys(updates).length === 0) return false;
        
        // Build clean payload
        const safeUpdates: Record<string, any> = {};
        if (updates.storageLocation) safeUpdates.storageLocation = updates.storageLocation;
        if (updates.status) safeUpdates.status = updates.status;
        if (updates.sellingLocations && Array.isArray(updates.sellingLocations)) {
            safeUpdates.sellingLocations = updates.sellingLocations;
        } else if (updates.channel) {
            safeUpdates.sellingLocations = [updates.channel];
        }

        if (Object.keys(safeUpdates).length === 0) return false;

        isApplyingBulk.value = true;
        const total = itemIds.length;
        const summaryChanges: string[] = [];
        if (safeUpdates.storageLocation) summaryChanges.push(`Location ➔ ${safeUpdates.storageLocation}`);
        if (safeUpdates.status) summaryChanges.push(`Status ➔ ${safeUpdates.status}`);
        if (safeUpdates.sellingLocations) summaryChanges.push(`Channel ➔ ${safeUpdates.sellingLocations.join(', ')}`);

        showLoader("Updating Records...", {
            step: `Updating ${total} records (${summaryChanges.join(', ')})...`,
            progress: null,
            cancelable: false
        });

        try {
            // 1. FAST PATH: Server-Side Bulk Update
            try {
                const resp = await fetch('/api/inventory/bulk-update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        itemIds,
                        updates: safeUpdates,
                        collectionId: getCollectionId(),
                        dbId: DB_ID
                    })
                });

                if (resp.ok) {
                    const data = await resp.json();
                    if (data.success) {
                        const count = data.updatedCount ?? total;
                        addToast({ 
                            type: 'success', 
                            message: `Updated ${count} items (${summaryChanges.join(', ')}).` 
                        });
                        if (onSuccess) await onSuccess();
                        return true;
                    }
                }
                console.warn("Server bulk update fell through, attempting client fallback...");
            } catch (serverErr) {
                console.warn("Server bulk-update unreachable, falling back to client execution:", serverErr);
            }

            // 2. FALLBACK PATH: Paced Client-Side Loop
            let successCount = 0;
            for (let idx = 0; idx < total; idx++) {
                const id = itemIds[idx];
                const percent = Math.round(((idx + 1) / total) * 100);

                showLoader("Updating Records...", {
                    step: `Item ${idx + 1} of ${total} (${percent}%)`,
                    progress: percent,
                    cancelable: false
                });

                await withRateLimitRetry(
                    () => updateInventoryItem(id, safeUpdates),
                    {
                        onRetry: (attempt, delayMs) => {
                            showLoader("Rate Limit Protection...", {
                                step: `⏳ Pausing ${Math.ceil(delayMs / 1000)}s for rate limit recovery (attempt ${attempt}/5)...`,
                                progress: percent,
                                cancelable: false
                            });
                        }
                    }
                );

                successCount++;

                if (total > 1 && idx < total - 1) {
                    await new Promise(r => setTimeout(r, 120));
                }
            }

            addToast({ type: 'success', message: `Updated ${successCount} items.` });
            if (onSuccess) await onSuccess();
            return true;
        } catch (e: any) {
            console.error("Bulk unified update failed:", e);
            addToast({ type: 'error', message: `Bulk update failed: ${e.message}` });
            return false;
        } finally {
            isApplyingBulk.value = false;
            hideLoader();
        }
    };

    const restockInventoryItem = async (item: any, { unitsToAdd, addedCostBasis }: { unitsToAdd: number; addedCostBasis: number }) => {
        if (!item || !item.$id || unitsToAdd < 1) return false;
        isApplyingBulk.value = true;
        showLoader("Restocking Units...", {
            step: `Adding ${unitsToAdd} units to "${item.title || item.upc}"...`,
            progress: null,
            cancelable: false
        });

        try {
            const currentQty = Number(item.quantity || 1);
            const newQty = currentQty + Number(unitsToAdd);
            const currentCost = Number(item.cost || 0);
            const newCost = Number((currentCost + Number(addedCostBasis || 0)).toFixed(2));

            const lotFlags = Array.isArray(item.redFlags) ? [...item.redFlags] : [];
            if (!lotFlags.includes('needs_shop_update')) {
                lotFlags.push('needs_shop_update');
            }

            const timestamp = new Date().toLocaleDateString();
            const restockLog = `[Restocked +${unitsToAdd} units (+$${Number(addedCostBasis || 0).toFixed(2)}) on ${timestamp}]`;
            const currentNotes = item.conditionNotes || '';
            const newNotes = currentNotes ? `${currentNotes}\n${restockLog}` : restockLog;

            const updates: Record<string, any> = {
                quantity: newQty,
                cost: newCost,
                redFlags: lotFlags,
                conditionNotes: newNotes
            };

            await withRateLimitRetry(() => updateInventoryItem(item.$id, updates));

            addToast({
                type: 'success',
                message: `🎉 Successfully restocked +${unitsToAdd} units! Total batch stock is now ${newQty}.`
            });
            if (onSuccess) await onSuccess();
            return true;
        } catch (e: any) {
            console.error("Restock failed:", e);
            addToast({ type: 'error', message: `Restock failed: ${e.message}` });
            return false;
        } finally {
            isApplyingBulk.value = false;
            hideLoader();
        }
    };

    const createBundle = async ({
        items,
        title,
        description,
        estHigh,
        storageLocation
    }: {
        items: any[];
        title: string;
        description?: string;
        estHigh?: number;
        storageLocation?: string;
    }) => {
        if (!items || items.length < 2 || !title) return false;
        isApplyingBulk.value = true;
        showLoader("Creating Bundle...", {
            step: `Bundling ${items.length} items into "${title}"...`,
            progress: null,
            cancelable: false
        });

        try {
            const collId = getCollectionId();
            const firstItem = items[0];
            const newBundleId = ID.unique();
            const combinedCost = items.reduce((sum, item) => sum + Number(item.cost || 0), 0);
            const sourceIdentities = items.map(i => i.identity || i.upc || i.$id).filter(Boolean);
            const sourceLocations = items.map(i => i.sourcingLocation).filter(Boolean);

            const bundleDoc: Record<string, any> = {
                title,
                identity: `BUNDLE-${Date.now().toString().slice(-6)}`,
                description: description || '',
                conditionNotes: `Bundled ${items.length} items together.\nSources: ${sourceIdentities.join(', ')}`,
                status: 'listed',
                cost: combinedCost,
                quantity: 1,
                tenantId: firstItem.tenantId || null,
                userId: firstItem.userId || null,
                storageLocation: storageLocation || firstItem.storageLocation || 'HG',
                estHigh: estHigh || null,
                purchaseId: null,
                sourcingLocation: sourceLocations.length > 0 ? sourceLocations[0] : null
            };

            Object.keys(bundleDoc).forEach(key => bundleDoc[key] === undefined && delete bundleDoc[key]);

            let permissions = undefined;
            if (firstItem.tenantId && firstItem.tenantId !== 'default') {
                const role = Role.team(firstItem.tenantId);
                permissions = [Permission.read(role), Permission.update(role), Permission.delete(role)];
            } else if (firstItem.userId) {
                const role = Role.user(firstItem.userId);
                permissions = [Permission.read(role), Permission.update(role), Permission.delete(role)];
            }

            const bundleRecord = await databases.createDocument(DB_ID, collId, newBundleId, bundleDoc, permissions);

            // Update child items
            const promises = items.map(item => {
                return databases.updateDocument(DB_ID, collId, item.$id, {
                    parentLotId: bundleRecord.$id,
                    status: 'combined'
                });
            });
            await Promise.all(promises);

            syncPurchaseStatusForItems(items).catch(err => console.warn('[createBundle] PO sync warning:', err));

            addToast({
                type: 'success',
                message: `🎉 Successfully created bundle "${title}" from ${items.length} items!`
            });
            if (onSuccess) await onSuccess();
            return true;
        } catch (err: any) {
            console.error("Bundle creation failed:", err);
            addToast({ type: 'error', message: 'Failed to create bundle: ' + err.message });
            return false;
        } finally {
            isApplyingBulk.value = false;
            hideLoader();
        }
    };

    const rollbackLot = async (lotItem: any, lotChildren: any[] = []) => {
        if (!lotItem || !lotItem.$id) return false;
        isApplyingBulk.value = true;
        showLoader("Rolling back lot...", {
            step: `Restoring items from lot "${lotItem.title}"...`,
            progress: null,
            cancelable: false
        });

        try {
            const collId = getCollectionId();
            let children = lotChildren;
            if (!children || children.length === 0) {
                const res = await databases.listDocuments(DB_ID, collId, [
                    Query.equal('parentLotId', lotItem.$id)
                ]);
                children = res.documents;
            }

            for (const child of children) {
                await databases.updateDocument(DB_ID, collId, child.$id, {
                    parentLotId: null,
                    status: (child.status === 'combined' || child.status === 'archived') ? 'acquired' : child.status
                });
            }

            await databases.deleteDocument(DB_ID, collId, lotItem.$id);

            addToast({
                type: 'success',
                message: `Successfully rolled back lot "${lotItem.title}" and restored ${children.length} items to active stock.`
            });
            if (onSuccess) await onSuccess();
            return true;
        } catch (e: any) {
            console.error("Rollback failed:", e);
            addToast({ type: 'error', message: 'Rollback failed: ' + e.message });
            return false;
        } finally {
            isApplyingBulk.value = false;
            hideLoader();
        }
    };

    return {
        isApplyingBulk,
        bulkLocationTarget,
        bulkStatusTarget,
        applyBulkLocation,
        applyBulkStatus,
        applyBulkUnified,
        deleteBulkItems,
        exportBulkItems,
        restockInventoryItem,
        createBundle,
        rollbackLot
    };
}

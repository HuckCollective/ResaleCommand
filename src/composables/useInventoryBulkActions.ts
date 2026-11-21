import { ref } from 'vue';
import type { Models } from 'appwrite';
import { databases, ID, Query } from '../lib/appwrite';
import {
    updateInventoryItem,
    deleteInventoryItem,
    saveItemToInventory,
    cloneItemMediaPayload,
    duplicateItemMediaInStorage,
    getCollectionId,
    DB_ID
} from '../lib/inventory';
import {
    notifyInventoryPatch,
    notifyInventoryRemove,
    notifyInventoryUpsert,
    notifyInventoryPreMutation,
    beginInventoryWrite,
} from '../lib/searchEngine';
import { generateGenericCsv, generateEbayCsv, generatePoshmarkCsv, generateRicochetCsv, downloadCsv } from '../lib/exportUtils';
import { withRateLimitRetry } from '../lib/retry';
import { syncPurchaseStatusForItems } from '../lib/purchases';
import { useLoader } from './useLoader';
import { addToast } from '../stores/toast';
import { getCoopJwtHeaders } from '../lib/coopLedgerClient';
import { extractItemOwnerPrefix, isRetailPlacementLocation } from '../lib/curatorOwnership';
import { resolveMultiQtyCost } from './useItemDrawerForm';
import { toUserMessage } from '../lib/userFacingErrors';

export type ExportFormat = 'ricochet' | 'ebay' | 'poshmark' | 'generic';

function collectValidGalleryIds(items: any[]): string[] {
    const seen = new Set<string>();
    for (const item of items || []) {
        if (!item || typeof item !== 'object') continue;
        const candidates = [
            item.imageId,
            ...(Array.isArray(item.galleryImageIds) ? item.galleryImageIds : []),
        ];
        for (const raw of candidates) {
            if (typeof raw !== 'string') continue;
            const trimmed = raw.trim();
            if (!trimmed || trimmed.length > 255) continue;
            if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) continue;
            seen.add(trimmed);
        }
    }
    return Array.from(seen);
}

/**
 * Composable for bulk operations on inventory items (location assignment, status transitions, bundling, and exports/deletions).
 * Employs server-side accelerated batching with APPWRITE_API_KEY (to avoid client rate limits on 300+ items)
 * and falls back seamlessly to client-side exponential backoff pacing.
 */
export function useInventoryBulkActions(onSuccess?: (affectedIds?: string[], updates?: Record<string, any>) => Promise<void> | void) {
    const isApplyingBulk = ref(false);
    const bulkLocationTarget = ref('');
    const bulkStatusTarget = ref('');
    const { showLoader, hideLoader } = useLoader();

    const applyBulkLocation = async (itemIds: string[], targetLocation: string) => {
        if (!targetLocation || !itemIds || itemIds.length === 0) return false;
        isApplyingBulk.value = true;
        const total = itemIds.length;
        notifyInventoryPreMutation(itemIds);
        const endWrite = beginInventoryWrite();

        showLoader("Moving Records...", {
            step: `Relocating ${total} records to "${targetLocation}"...`,
            progress: null,
            cancelable: false
        });

        try {
            // 1. FAST PATH: Server-Side Bulk Update (bypasses client browser rate limits with admin key)
            let authError = '';
            try {
                const resp = await fetch('/api/inventory/bulk-update', {
                    method: 'POST',
                    headers: await getCoopJwtHeaders(),
                    body: JSON.stringify({
                        itemIds,
                        updates: { storageLocation: targetLocation },
                        collectionId: getCollectionId(),
                        dbId: DB_ID
                    })
                });

                if (resp.status === 401 || resp.status === 403) {
                    const errData = await resp.json().catch(() => ({}));
                    authError = errData?.error || 'You do not have permission to move one or more selected items.';
                } else if (resp.ok) {
                    const data = await resp.json();
                    if (data.success) {
                        const count = data.updatedCount ?? total;
                        addToast({ 
                            type: 'success', 
                            message: `Successfully moved ${count} items to "${targetLocation}".` 
                        });
                        bulkLocationTarget.value = '';
                        notifyInventoryPatch(itemIds, { storageLocation: targetLocation });
                        if (onSuccess) await onSuccess(itemIds, { storageLocation: targetLocation });
                        return true;
                    }
                }
                if (!authError) {
                    console.warn("Server bulk update fell through, attempting client fallback...");
                }
            } catch (serverErr) {
                console.warn("Server bulk-update unreachable, falling back to client execution:", serverErr);
            }

            if (authError) {
                addToast({ type: 'error', message: authError });
                return false;
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
            notifyInventoryPatch(itemIds, { storageLocation: targetLocation });
            if (onSuccess) await onSuccess(itemIds, { storageLocation: targetLocation });
            return true;
        } catch (e: any) {
            console.error("Bulk location update failed:", e);
            addToast({ type: 'error', message: toUserMessage(e, 'Could not move items right now — please try again.') });
            return false;
        } finally {
            endWrite();
            isApplyingBulk.value = false;
            hideLoader();
        }
    };

    const applyBulkStatus = async (itemIds: string[], targetStatus: string) => {
        if (!targetStatus || !itemIds || itemIds.length === 0) return false;
        isApplyingBulk.value = true;
        const total = itemIds.length;
        notifyInventoryPreMutation(itemIds);
        const endWrite = beginInventoryWrite();

        showLoader("Updating Status...", {
            step: `Updating status to "${targetStatus}" for ${total} items...`,
            progress: null,
            cancelable: false
        });

        try {
            // 1. FAST PATH: Server-Side Bulk Update
            let authError = '';
            try {
                const resp = await fetch('/api/inventory/bulk-update', {
                    method: 'POST',
                    headers: await getCoopJwtHeaders(),
                    body: JSON.stringify({
                        itemIds,
                        updates: { status: targetStatus },
                        collectionId: getCollectionId(),
                        dbId: DB_ID
                    })
                });

                if (resp.status === 401 || resp.status === 403) {
                    const errData = await resp.json().catch(() => ({}));
                    authError = errData?.error || 'You do not have permission to update status for these items.';
                } else if (resp.ok) {
                    const data = await resp.json();
                    if (data.success) {
                        const count = data.updatedCount ?? total;
                        addToast({ 
                            type: 'success', 
                            message: `Updated status to "${targetStatus}" for ${count} items.` 
                        });
                        bulkStatusTarget.value = '';
                        notifyInventoryPatch(itemIds, { status: targetStatus });
                        if (onSuccess) await onSuccess(itemIds, { status: targetStatus });
                        return true;
                    }
                }
            } catch (serverErr) {
                console.warn("Server bulk-update unreachable, falling back to client execution:", serverErr);
            }

            if (authError) {
                addToast({ type: 'error', message: authError });
                return false;
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
            notifyInventoryPatch(itemIds, { status: targetStatus });
            if (onSuccess) await onSuccess(itemIds, { status: targetStatus });
            return true;
        } catch (e: any) {
            console.error("Bulk status update failed:", e);
            addToast({ type: 'error', message: toUserMessage(e, 'Could not update status right now — please try again.') });
            return false;
        } finally {
            endWrite();
            isApplyingBulk.value = false;
            hideLoader();
        }
    };

    const deleteBulkItems = async (itemIds: string[]) => {
        if (!itemIds || itemIds.length === 0) return false;
        isApplyingBulk.value = true;
        const total = itemIds.length;
        notifyInventoryPreMutation(itemIds);
        const endWrite = beginInventoryWrite();

        showLoader("Deleting Records...", {
            step: `Deleting ${total} items...`,
            progress: null,
            cancelable: false
        });

        try {
            // 1. FAST PATH: Server-Side Bulk Delete
            let authError = '';
            try {
                const resp = await fetch('/api/inventory/bulk-delete', {
                    method: 'POST',
                    headers: await getCoopJwtHeaders(),
                    body: JSON.stringify({
                        itemIds,
                        collectionId: getCollectionId(),
                        dbId: DB_ID
                    })
                });

                if (resp.status === 401 || resp.status === 403) {
                    const errData = await resp.json().catch(() => ({}));
                    authError = errData?.error || 'You do not have permission to delete one or more selected items.';
                } else if (resp.ok) {
                    const data = await resp.json();
                    if (data.success) {
                        const count = data.deletedCount ?? total;
                        addToast({ type: 'success', message: `Deleted ${count} items.` });
                        notifyInventoryRemove(itemIds);
                        if (onSuccess) await onSuccess(itemIds, { _deleted: true });
                        return true;
                    }
                }
            } catch (serverErr) {
                console.warn("Server bulk-delete unreachable, falling back to client execution:", serverErr);
            }

            if (authError) {
                addToast({ type: 'error', message: authError });
                return false;
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
            notifyInventoryRemove(itemIds);
            if (onSuccess) await onSuccess(itemIds, { _deleted: true });
            return true;
        } catch (e: any) {
            console.error("Bulk delete failed:", e);
            addToast({ type: 'error', message: toUserMessage(e, 'Could not delete items right now — please try again.') });
            return false;
        } finally {
            endWrite();
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
        if (updates.storageLocation !== undefined) safeUpdates.storageLocation = updates.storageLocation;
        if (updates.status) safeUpdates.status = updates.status;
        if ((updates as any).auctionStatus !== undefined) (safeUpdates as any).auctionStatus = (updates as any).auctionStatus;
        if (updates.sellingLocations && Array.isArray(updates.sellingLocations)) {
            safeUpdates.sellingLocations = updates.sellingLocations;
        } else if (updates.channel) {
            safeUpdates.sellingLocations = [updates.channel];
        }

        if (Object.keys(safeUpdates).length === 0) return false;

        isApplyingBulk.value = true;
        const total = itemIds.length;
        notifyInventoryPreMutation(itemIds);
        const endWrite = beginInventoryWrite();
        const summaryChanges: string[] = [];
        if (safeUpdates.storageLocation !== undefined) summaryChanges.push(`Location ➔ ${safeUpdates.storageLocation || 'Unassigned'}`);
        if (safeUpdates.status) summaryChanges.push(`Status ➔ ${safeUpdates.status}`);
        if ((safeUpdates as any).auctionStatus) summaryChanges.push(`Auction ➔ ${(safeUpdates as any).auctionStatus}`);
        if (safeUpdates.sellingLocations) summaryChanges.push(`Channel ➔ ${safeUpdates.sellingLocations.join(', ')}`);

        showLoader("Updating Records...", {
            step: `Updating ${total} records (${summaryChanges.join(', ')})...`,
            progress: null,
            cancelable: false
        });

        try {
            // 1. FAST PATH: Server-Side Bulk Update
            let authError = '';
            try {
                const resp = await fetch('/api/inventory/bulk-update', {
                    method: 'POST',
                    headers: await getCoopJwtHeaders(),
                    body: JSON.stringify({
                        itemIds,
                        updates: safeUpdates,
                        collectionId: getCollectionId(),
                        dbId: DB_ID
                    })
                });

                if (resp.status === 401 || resp.status === 403) {
                    const errData = await resp.json().catch(() => ({}));
                    authError = errData?.error || 'You do not have permission to update one or more selected items.';
                } else if (resp.ok) {
                    const data = await resp.json();
                    if (data.success) {
                        const count = data.updatedCount ?? total;
                        addToast({ 
                            type: 'success', 
                            message: `Updated ${count} items (${summaryChanges.join(', ')}).` 
                        });
                        notifyInventoryPatch(itemIds, safeUpdates);
                        if (onSuccess) await onSuccess(itemIds, safeUpdates);
                        return true;
                    }
                }
                if (!authError) {
                    console.warn("Server bulk update fell through, attempting client fallback...");
                }
            } catch (serverErr) {
                console.warn("Server bulk-update unreachable, falling back to client execution:", serverErr);
            }

            if (authError) {
                addToast({ type: 'error', message: authError });
                return false;
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
            notifyInventoryPatch(itemIds, safeUpdates);
            if (onSuccess) await onSuccess(itemIds, safeUpdates);
            return true;
        } catch (e: any) {
            console.error("Bulk unified update failed:", e);
            addToast({ type: 'error', message: toUserMessage(e, 'Could not update items right now — please try again.') });
            return false;
        } finally {
            endWrite();
            isApplyingBulk.value = false;
            hideLoader();
        }
    };

    const restockInventoryItem = async (item: any, { unitsToAdd, addedCostBasis }: { unitsToAdd: number; addedCostBasis: number }) => {
        if (!item || !item.$id || unitsToAdd < 1) return false;
        isApplyingBulk.value = true;
        notifyInventoryPreMutation([item.$id]);
        const endWrite = beginInventoryWrite();
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

            const updatedDoc = await withRateLimitRetry(() => updateInventoryItem(item.$id, updates));
            if (updatedDoc) {
                notifyInventoryUpsert([updatedDoc]);
            }

            addToast({
                type: 'success',
                message: `🎉 Successfully restocked +${unitsToAdd} units! Total batch stock is now ${newQty}.`
            });
            if (onSuccess) await onSuccess([item.$id], { ...updates, _storeSynced: true });
            return true;
        } catch (e: any) {
            console.error("Restock failed:", e);
            addToast({ type: 'error', message: toUserMessage(e, 'Could not restock units right now — please try again.') });
            return false;
        } finally {
            endWrite();
            isApplyingBulk.value = false;
            hideLoader();
        }
    };

    const createBundle = async ({
        items,
        title,
        description,
        estHigh,
        storageLocation,
        teamId,
        upcPrefix,
        allowRetailPlacement
    }: {
        items: any[];
        title: string;
        description?: string;
        estHigh?: number;
        storageLocation?: string;
        teamId?: string;
        upcPrefix?: string;
        allowRetailPlacement?: boolean;
    }) => {
        if (!items || items.length < 2 || !title?.trim()) return false;
        isApplyingBulk.value = true;
        const childIds = items.map(i => i?.$id).filter(Boolean);
        notifyInventoryPreMutation(childIds);
        const endWrite = beginInventoryWrite();
        showLoader("Creating Bundle...", {
            step: `Bundling ${items.length} items into "${title.trim()}"...`,
            progress: null,
            cancelable: false
        });

        try {
            const firstItem = items[0];
            const combinedCost = Number(items.reduce((sum, item) => sum + (Number(item?.cost) || 0), 0).toFixed(2));
            const sumChildResale = Number(
                items.reduce((sum, item) => sum + (Number(item?.resalePrice || item?.boutiquePrice) || 0), 0).toFixed(2)
            );
            const finalResale =
                Number(estHigh) > 0
                    ? Number(Number(estHigh).toFixed(2))
                    : (sumChildResale > 0 ? sumChildResale : undefined);
            const sourceIdentities = items.map(i => i?.identity || i?.upc || i?.$id).filter(Boolean);
            const sourceLocations = items.map(i => i?.sourcingLocation).filter(Boolean);

            const galleryIds = collectValidGalleryIds(items);
            const firstImage =
                typeof firstItem?.imageId === 'string' &&
                !firstItem.imageId.startsWith('data:') &&
                !firstItem.imageId.startsWith('blob:')
                    ? firstItem.imageId
                    : undefined;
            const mainImageId = firstImage || galleryIds[0] || undefined;

            const rawLoc = String(storageLocation || firstItem?.storageLocation || 'HG').trim() || 'HG';
            const isRetail = isRetailPlacementLocation(rawLoc);
            const safeLoc = isRetail && allowRetailPlacement === false ? 'HG' : rawLoc;
            const status = isRetailPlacementLocation(safeLoc) && allowRetailPlacement !== false ? 'placed' : 'received';
            const resolvedPrefix = upcPrefix || extractItemOwnerPrefix(firstItem) || 'HUCK-';
            const resolvedTeamId = teamId || firstItem?.tenantId || undefined;

            const bundleRecord = await saveItemToInventory(
                {
                    title: title.trim(),
                    identity: `BUNDLE-${ID.unique().slice(-8)}`,
                    condition_notes: `Bundled ${items.length} items together.\nSources: ${sourceIdentities.join(', ')}`.slice(0, 750),
                },
                null,
                {
                    cost: combinedCost,
                    resalePrice: finalResale,
                    marketDescription: description ? String(description).trim() : undefined,
                    status,
                    storageLocation: safeLoc,
                    sourcingLocation: sourceLocations[0] || 'Companion Bundle',
                    upcPrefix: resolvedPrefix,
                    imageId: mainImageId,
                    galleryImageIds: galleryIds,
                    keywords: Array.from(new Set(items.flatMap((i: any) => (Array.isArray(i?.keywords) ? i.keywords : [])))),
                    quantity: 1,
                    parentLotId: null,
                },
                resolvedTeamId
            );

            // Keep child quantity >= 1 while marking status 'combined'
            const updatedChildren = await Promise.all(
                items.map(item =>
                    updateInventoryItem(item.$id, {
                        parentLotId: bundleRecord.$id,
                        status: 'combined'
                    })
                )
            );

            notifyInventoryUpsert([bundleRecord, ...updatedChildren.filter(Boolean)]);
            syncPurchaseStatusForItems(items).catch(err => console.warn('[createBundle] PO sync warning:', err));

            addToast({
                type: 'success',
                message: `🎉 Successfully created bundle "${title.trim()}" from ${items.length} items!`
            });
            if (onSuccess) await onSuccess([bundleRecord.$id, ...childIds], { _storeSynced: true });
            return bundleRecord;
        } catch (err: any) {
            console.error("Bundle creation failed:", err);
            addToast({ type: 'error', message: toUserMessage(err, 'Could not create bundle — please try again.') });
            return false;
        } finally {
            endWrite();
            isApplyingBulk.value = false;
            hideLoader();
        }
    };

    const combineItemsIntoBatch = async ({
        items,
        mode = 'create_new',
        title,
        primaryId,
        targetLot,
        totalCostOverride,
        totalUnitsOverride,
        allCatalogItems = [],
        teamId,
        upcPrefix,
        allowRetailPlacement,
    }: {
        items: any[];
        mode?: 'create_new' | 'add_to_existing';
        title?: string;
        primaryId?: string | null;
        targetLot?: any;
        totalCostOverride?: number;
        totalUnitsOverride?: number;
        allCatalogItems?: any[];
        teamId?: string;
        upcPrefix?: string;
        allowRetailPlacement?: boolean;
    }): Promise<any | false> => {
        if (!Array.isArray(items) || items.length === 0) return false;
        isApplyingBulk.value = true;
        const targetId = targetLot?.$id || targetLot?.id || '';
        const involvedIds = Array.from(new Set([
            ...(targetId ? [targetId] : []),
            ...items.map(i => i?.$id).filter(Boolean),
        ]));
        notifyInventoryPreMutation(involvedIds);
        const endWrite = beginInventoryWrite();
        showLoader('Combining Items...', {
            step: 'Saving combined lot to ledger…',
            progress: null,
            cancelable: false
        });

        try {
            if (mode === 'add_to_existing' && targetLot?.$id) {
                const itemsToAdd = items.filter(i => i?.$id && i.$id !== targetLot.$id);
                if (itemsToAdd.length === 0) return false;

                const galleryIds = collectValidGalleryIds([targetLot, ...itemsToAdd]);
                const mainImg =
                    (typeof targetLot.imageId === 'string' && !targetLot.imageId.startsWith('data:') && !targetLot.imageId.startsWith('blob:')
                        ? targetLot.imageId
                        : undefined) || galleryIds[0] || undefined;

                const addedCost = itemsToAdd.reduce((sum, i) => sum + (parseFloat(i?.cost) || 0), 0);
                const addedQty = itemsToAdd.reduce((sum, i) => sum + Math.max(1, parseInt(i?.quantity, 10) || 1), 0);
                const newCost = Number(((Number(targetLot.cost) || 0) + addedCost).toFixed(2));
                const newQty = Math.max(1, (Number(targetLot.quantity) || 1) + addedQty);

                const targetUpdates: Record<string, any> = {
                    cost: newCost,
                    quantity: newQty,
                    galleryImageIds: galleryIds
                };
                if (mainImg && !targetLot.imageId) {
                    targetUpdates.imageId = mainImg;
                }

                const updatedTarget = await updateInventoryItem(targetLot.$id, targetUpdates);
                const updatedAdded = await Promise.all(
                    itemsToAdd.map(item =>
                        updateInventoryItem(item.$id, {
                            parentLotId: targetLot.$id,
                            status: 'combined'
                        })
                    )
                );

                const addedIdSet = new Set(itemsToAdd.map(i => i.$id));
                const nestedChildren = (allCatalogItems || []).filter(i => i?.$id && i.parentLotId && addedIdSet.has(i.parentLotId));
                const updatedNested = nestedChildren.length > 0
                    ? await Promise.all(nestedChildren.map(nc => updateInventoryItem(nc.$id, { parentLotId: targetLot.$id })))
                    : [];

                notifyInventoryUpsert([updatedTarget, ...updatedAdded, ...updatedNested].filter(Boolean));
                syncPurchaseStatusForItems(itemsToAdd).catch(err => console.warn('[combineItemsIntoBatch] PO sync warning:', err));

                addToast({
                    type: 'success',
                    message: `Successfully added ${itemsToAdd.length} item${itemsToAdd.length === 1 ? '' : 's'} to "${targetLot.title}"!`
                });
                if (onSuccess) await onSuccess([targetLot.$id, ...itemsToAdd.map(i => i.$id)], { _storeSynced: true });
                return updatedTarget || true;
            }

            if (items.length < 2) return false;
            const primaryItem = (primaryId && items.find(i => i?.$id === primaryId)) || items[0];
            const pooledCost = totalCostOverride !== undefined
                ? Number(Number(totalCostOverride).toFixed(2))
                : Number(items.reduce((sum, i) => sum + (parseFloat(i?.cost) || 0), 0).toFixed(2));
            const pooledUnits = totalUnitsOverride !== undefined && totalUnitsOverride >= 1
                ? Math.round(totalUnitsOverride)
                : Math.max(2, items.reduce((sum, i) => sum + Math.max(1, parseInt(i?.quantity, 10) || 1), 0));
            const totalResale = items.reduce((sum, i) => sum + (parseFloat(i?.resalePrice || i?.boutiquePrice || i?.listPrice || 0) || 0), 0);

            const galleryIds = collectValidGalleryIds(items);
            const primaryImage =
                typeof primaryItem?.imageId === 'string' && !primaryItem.imageId.startsWith('data:') && !primaryItem.imageId.startsWith('blob:')
                    ? primaryItem.imageId
                    : undefined;
            const mainImageId = primaryImage || galleryIds[0] || undefined;

            const cleanedPrimaryNotes = String(primaryItem?.conditionNotes || '')
                .replace(/Location:\s*https?:\/\/[^\s\n]+/gi, '')
                .trim();

            const rawLoc = String(primaryItem?.storageLocation || 'HG').trim() || 'HG';
            const isRetail = isRetailPlacementLocation(rawLoc);
            const safeLoc = isRetail && allowRetailPlacement === false ? 'HG' : rawLoc;
            const lotStatus =
                primaryItem?.status === 'placed' && isRetailPlacementLocation(safeLoc) && allowRetailPlacement !== false
                    ? 'placed'
                    : 'received';
            const resolvedPrefix = upcPrefix || extractItemOwnerPrefix(primaryItem) || 'HUCK-';
            const resolvedTeamId = teamId || primaryItem?.tenantId || undefined;
            const finalTitle = (title || '').trim() || `Combined Lot (${pooledUnits} Units)`;

            const combinedLotDoc = await saveItemToInventory(
                {
                    title: finalTitle,
                    identity: `BATCH-${ID.unique().slice(-8)}`,
                    condition_notes: cleanedPrimaryNotes.slice(0, 750),
                },
                null,
                {
                    cost: pooledCost,
                    resalePrice: totalResale > 0 ? Number(totalResale.toFixed(2)) : undefined,
                    status: lotStatus,
                    sourcingLocation: 'Combined Lot',
                    storageLocation: safeLoc,
                    upcPrefix: resolvedPrefix,
                    imageId: mainImageId,
                    galleryImageIds: galleryIds,
                    keywords: Array.from(new Set(items.flatMap((i: any) => (Array.isArray(i?.keywords) ? i.keywords : [])))),
                    quantity: Math.max(1, pooledUnits),
                    parentLotId: null,
                },
                resolvedTeamId
            );

            if (combinedLotDoc?.$id && (mainImageId || galleryIds.length > 0)) {
                duplicateItemMediaInStorage({
                    imageId: mainImageId,
                    galleryImageIds: galleryIds
                }, { copyAll: true }).then(async (deepMedia) => {
                    if (deepMedia?.imageId || (deepMedia?.galleryImageIds && deepMedia.galleryImageIds.length > 0)) {
                        const updatedMedia = await updateInventoryItem(combinedLotDoc.$id, {
                            imageId: deepMedia.imageId || undefined,
                            galleryImageIds: deepMedia.galleryImageIds || []
                        });
                        if (updatedMedia) notifyInventoryUpsert([updatedMedia]);
                    }
                }).catch(e => console.warn('[combineItemsIntoBatch] Background media clone skipped:', e));
            }

            const updatedChildren = await Promise.all(
                items.map(item =>
                    updateInventoryItem(item.$id, {
                        status: 'combined',
                        parentLotId: combinedLotDoc.$id
                    })
                )
            );

            const itemIdSet = new Set(items.map(i => i.$id));
            const nestedChildren = (allCatalogItems || []).filter(i => i?.$id && i.parentLotId && itemIdSet.has(i.parentLotId));
            const updatedNested = nestedChildren.length > 0
                ? await Promise.all(nestedChildren.map(nc => updateInventoryItem(nc.$id, { parentLotId: combinedLotDoc.$id })))
                : [];

            notifyInventoryUpsert([combinedLotDoc, ...updatedChildren, ...updatedNested].filter(Boolean));
            syncPurchaseStatusForItems(items).catch(err => console.warn('[combineItemsIntoBatch] PO sync warning:', err));

            addToast({ type: 'success', message: `Successfully combined into new lot "${finalTitle}"!` });
            if (onSuccess) await onSuccess([combinedLotDoc.$id, ...items.map(i => i.$id)], { _storeSynced: true });
            return combinedLotDoc;
        } catch (err: any) {
            console.error('Combine lot failed:', err);
            addToast({ type: 'error', message: toUserMessage(err, 'Could not combine items right now — please try again.') });
            return false;
        } finally {
            endWrite();
            isApplyingBulk.value = false;
            hideLoader();
        }
    };

    const splitOneUnitFromBatch = async (
        lotItem: any,
        opts?: { teamId?: string; upcPrefix?: string; allowRetailPlacement?: boolean }
    ): Promise<any | false> => {
        if (!lotItem?.$id || Number(lotItem.quantity || 1) <= 1) return false;
        isApplyingBulk.value = true;
        notifyInventoryPreMutation([lotItem.$id]);
        const endWrite = beginInventoryWrite();
        showLoader('Splitting 1 Unit…', {
            step: 'Allocating cost basis and minting tag…',
            progress: null,
            cancelable: false
        });

        try {
            const qty = Math.max(2, Number(lotItem.quantity) || 2);
            const unitResale = parseFloat(lotItem.resalePrice || lotItem.boutiquePrice || lotItem.price || 0) || 0;
            const { totalCost, unitCost } = resolveMultiQtyCost(lotItem.cost, qty, unitResale);
            const remainingQty = Math.max(1, qty - 1);
            const remainingCost = Number(Math.max(0, totalCost - unitCost).toFixed(2));
            const childTitle = `${lotItem.title || 'Inventory Item'} (Piece ${qty})`;

            const mediaPayload = cloneItemMediaPayload({
                imageId: lotItem.imageId,
                galleryImageIds: lotItem.galleryImageIds
            }, { copyAll: false });

            const rawLoc = String(lotItem.storageLocation || 'HG').trim() || 'HG';
            const isRetail = isRetailPlacementLocation(rawLoc);
            const allowRetail = isRetail && opts?.allowRetailPlacement !== false;
            const childLoc = allowRetail ? rawLoc : (isRetail ? 'HG' : rawLoc);
            const childStatus = lotItem.status === 'sold' ? 'received' : (allowRetail ? 'placed' : 'received');
            const resolvedPrefix = opts?.upcPrefix || extractItemOwnerPrefix(lotItem) || 'HUCK-';
            const resolvedTeamId = opts?.teamId || lotItem.tenantId || undefined;

            const splitDoc = await saveItemToInventory(
                {
                    title: childTitle,
                    identity: `SPLIT-${ID.unique().slice(-8)}`,
                    condition_notes: `Split 1 unit from batch: ${lotItem.$id}`
                },
                null,
                {
                    cost: unitCost,
                    resalePrice: unitResale > 0 ? unitResale : undefined,
                    status: childStatus,
                    sourcingLocation: lotItem.sourcingLocation || '',
                    orderId: lotItem.orderId || undefined,
                    storageLocation: childLoc,
                    imageId: mediaPayload.imageId,
                    galleryImageIds: mediaPayload.galleryImageIds,
                    quantity: 1,
                    parentLotId: lotItem.$id,
                    purchaseId: lotItem.purchaseId || null,
                    upcPrefix: resolvedPrefix
                },
                resolvedTeamId
            );

            if (splitDoc?.$id && mediaPayload.imageId) {
                duplicateItemMediaInStorage({
                    imageId: lotItem.imageId,
                    galleryImageIds: lotItem.galleryImageIds
                }, { copyAll: false }).then(async (deepMedia) => {
                    if (deepMedia?.imageId && deepMedia.imageId !== mediaPayload.imageId) {
                        const updatedMedia = await updateInventoryItem(splitDoc.$id, {
                            imageId: deepMedia.imageId,
                            galleryImageIds: deepMedia.galleryImageIds
                        });
                        if (updatedMedia) notifyInventoryUpsert([updatedMedia]);
                    }
                }).catch(e => console.warn('[splitOneUnitFromBatch] Background deep media clone skipped:', e));
            }

            const updatedParent = await updateInventoryItem(lotItem.$id, {
                quantity: remainingQty,
                cost: remainingCost
            });

            notifyInventoryUpsert([splitDoc, updatedParent].filter(Boolean));
            addToast({
                type: 'success',
                message: `Split 1 unit into dedicated tag! (${remainingQty} units remaining in batch)`
            });
            if (onSuccess) await onSuccess([lotItem.$id, ...(splitDoc?.$id ? [splitDoc.$id] : [])], { _storeSynced: true });
            return splitDoc;
        } catch (e: any) {
            console.error('Failed to split unit:', e);
            addToast({ type: 'error', message: toUserMessage(e, 'Could not split unit from batch — please try again.') });
            return false;
        } finally {
            endWrite();
            isApplyingBulk.value = false;
            hideLoader();
        }
    };

    const rollbackLot = async (lotItem: any, lotChildren: any[] = []) => {
        if (!lotItem || !lotItem.$id) return false;
        isApplyingBulk.value = true;
        const childIds = (lotChildren || []).map(c => c?.$id).filter(Boolean);
        notifyInventoryPreMutation([lotItem.$id, ...childIds]);
        const endWrite = beginInventoryWrite();
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

            const restoredDocs: any[] = [];
            for (const child of children) {
                const updatedChild = await updateInventoryItem(child.$id, {
                    parentLotId: null,
                    status: (child.status === 'combined' || child.status === 'archived') ? 'received' : child.status
                });
                if (updatedChild) restoredDocs.push(updatedChild);
            }

            await deleteInventoryItem(lotItem.$id);
            if (restoredDocs.length > 0) notifyInventoryUpsert(restoredDocs);
            notifyInventoryRemove([lotItem.$id]);

            addToast({
                type: 'success',
                message: `Successfully rolled back lot "${lotItem.title}" and restored ${children.length} items to active stock.`
            });
            if (onSuccess) await onSuccess([lotItem.$id, ...restoredDocs.map(c => c.$id)], { _storeSynced: true });
            return true;
        } catch (e: any) {
            console.error("Rollback failed:", e);
            addToast({ type: 'error', message: toUserMessage(e, 'Could not undo combine — please try again.') });
            return false;
        } finally {
            endWrite();
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
        combineItemsIntoBatch,
        splitOneUnitFromBatch,
        rollbackLot
    };
}

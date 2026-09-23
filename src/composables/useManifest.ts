import { ref, computed, watch } from 'vue';
import { manifestsApi, type ManifestDocument, type ManifestItemSummary } from '../lib/manifests';
import { useAuth } from './useAuth';
import { addToast } from '../stores/toast';
import { generateRicochetCsv, generateGenericCsv, downloadCsv } from '../lib/exportUtils';
import { databases } from '../lib/appwrite';
import { DB_ID, getCollectionId } from '../lib/inventory';
import { Query } from 'appwrite';

// Shared singleton state across all views
const activeManifest = ref<ManifestDocument | null>(null);
const stagedItems = ref<any[]>([]);
const isManifestTrayOpen = ref(false);
const isActionTrayOpen = ref(false);
const isTrayOpen = isManifestTrayOpen;
const isSyncing = ref(false);
const allDrafts = ref<ManifestDocument[]>([]);
const manifestsList = ref<ManifestDocument[]>([]);
const recentManifests = ref<ManifestDocument[]>([]);
const isInitialized = ref(false);

let manifestUpdateQueue = Promise.resolve();

function enqueueManifestUpdate<T>(task: () => Promise<T>): Promise<T> {
    const next = manifestUpdateQueue.then(task, task);
    manifestUpdateQueue = next.then(() => {}, () => {});
    return next;
}

function openManifestTray() {
    isActionTrayOpen.value = false;
    isManifestTrayOpen.value = true;
}

function openActionTray() {
    isManifestTrayOpen.value = false;
    isActionTrayOpen.value = true;
}

function toggleManifestTray() {
    if (isManifestTrayOpen.value) {
        isManifestTrayOpen.value = false;
    } else {
        openManifestTray();
    }
}

function toggleActionTray() {
    if (isActionTrayOpen.value) {
        isActionTrayOpen.value = false;
    } else {
        openActionTray();
    }
}

function closeAllTrays() {
    isManifestTrayOpen.value = false;
    isActionTrayOpen.value = false;
}

export function useManifest() {
    const { user, currentTeam } = useAuth();

    const tenantId = computed(() => {
        return currentTeam.value?.$id 
            || user.value?.$id 
            || (typeof localStorage !== 'undefined' ? localStorage.getItem('activeTeamId') : null)
            || '';
    });

    // Reactive tenant watcher to automatically load all drafts when auth initializes or switches teams
    watch(tenantId, async (newTId) => {
        if (newTId) {
            await fetchAllDrafts();
            if (!activeManifest.value) {
                await initActiveDraft('MD');
            }
        }
    }, { immediate: true });

    // -- Reactive Financial Calculations --
    const stagedCount = computed(() => stagedItems.value.length);
    const totalUnits = computed(() => {
        return stagedItems.value.reduce((sum, item) => {
            return sum + Math.max(1, Number(item.quantity || 1));
        }, 0);
    });

    const placedItemIds = computed(() => new Set(activeManifest.value?.placedItemIds || []));
    const placedCount = computed(() => activeManifest.value?.placedItemIds?.length || 0);

    const totalCost = computed(() => {
        return stagedItems.value.reduce((sum, item) => {
            const cost = Number(item.cost || item.purchasePrice || 0);
            const qty = Math.max(1, Number(item.quantity || 1));
            return sum + (cost * qty);
        }, 0);
    });

    const totalRetail = computed(() => {
        return stagedItems.value.reduce((sum, item) => {
            const price = Number(item.boutiquePrice || item.resalePrice || item.price || 0);
            const qty = Math.max(1, Number(item.quantity || 1));
            return sum + (price * qty);
        }, 0);
    });

    const commissionRate = computed(() => {
        if (activeManifest.value?.commissionRate !== undefined) {
            return activeManifest.value.commissionRate;
        }
        return 15; // default 15% for Memory Den
    });

    const estimatedNet = computed(() => {
        const rate = commissionRate.value / 100;
        return totalRetail.value * (1 - rate);
    });

    const estimatedProfit = computed(() => {
        return estimatedNet.value - totalCost.value;
    });

    const roiMultiple = computed(() => {
        if (totalCost.value <= 0) return '0.0x';
        return (totalRetail.value / totalCost.value).toFixed(1) + 'x';
    });

    // -- Snapshot generator for quick cross-device inspection --
    function createItemSnapshot(item: any): ManifestItemSummary {
        return {
            $id: item.$id,
            title: item.title || 'Untitled Item',
            upc: item.upc || '',
            locationSku: item.locationSku || '',
            cost: Number(item.cost || 0),
            price: Number(item.boutiquePrice || item.resalePrice || item.price || 0),
            quantity: Number(item.quantity || 1),
            imageId: item.imageId || null,
            storageLocation: item.storageLocation || ''
        };
    }

    // -- Sync Line Items from Appwrite or Local Pool --
    async function loadStagedItems(manifest: ManifestDocument) {
        if (!manifest) {
            stagedItems.value = [];
            return;
        }

        let itemIds = manifest.itemIds || [];
        // Fallback: If itemIds is empty but itemsSnapshot has items, recover from snapshot
        if (itemIds.length === 0 && manifest.itemsSnapshot && manifest.itemsSnapshot.length > 0) {
            itemIds = manifest.itemsSnapshot.map((s: any) => s.$id || s.id).filter(Boolean);
        }

        if (itemIds.length === 0) {
            stagedItems.value = manifest.itemsSnapshot ? [...manifest.itemsSnapshot] : [];
            return;
        }

        // If snapshot exists, use as initial immediate render so UI never flashes blank
        if (manifest.itemsSnapshot && manifest.itemsSnapshot.length > 0) {
            stagedItems.value = [...manifest.itemsSnapshot];
        }

        // Fetch authoritative latest item records from Appwrite
        try {
            const targetIds = itemIds.slice(0, 100);
            const resp = await databases.listDocuments(DB_ID, getCollectionId(), [
                Query.equal('$id', targetIds),
                Query.limit(100)
            ]);
            if (resp.documents.length > 0) {
                const idMap = new Map(resp.documents.map(d => [d.$id, d]));
                const snapMap = new Map((manifest.itemsSnapshot || []).map((s: any) => [s.$id || s.id, s]));
                // Keep order matching itemIds, falling back to snapshot if an older item document was moved or not returned
                const resolved = itemIds.map(id => idMap.get(id) || snapMap.get(id)).filter(Boolean);
                stagedItems.value = resolved as any[];
            }
        } catch (e) {
            console.warn('[useManifest] Could not fetch fresh items from Appwrite, using snapshot:', e);
            if (manifest.itemsSnapshot && manifest.itemsSnapshot.length > 0) {
                stagedItems.value = [...manifest.itemsSnapshot];
            }
        }
    }

    // -- Load / Refresh All Drafts & Recent Drops (all locations across the tenant) --
    async function fetchAllDrafts(locationId?: string) {
        const tId = tenantId.value || (typeof localStorage !== 'undefined' ? localStorage.getItem('activeTeamId') : null) || '';
        if (!tId) return;
        try {
            const [drafts, recent] = await Promise.all([
                manifestsApi.listDrafts(tId, locationId),
                manifestsApi.listRecentManifests(tId, locationId, 50)
            ]);
            allDrafts.value = drafts;
            recentManifests.value = recent;
        } catch (e) {
            console.warn('[useManifest.fetchAllDrafts] Error:', e);
        }
    }

    // -- Load / Initialize Active Draft --
    async function initActiveDraft(targetLocationId = 'MD') {
        const tId = tenantId.value || (typeof localStorage !== 'undefined' ? localStorage.getItem('activeTeamId') : null) || '';
        if (!tId) return;
        isSyncing.value = true;
        try {
            await fetchAllDrafts();
            const draft = await manifestsApi.getActiveDraft(tId, targetLocationId);
            if (draft) {
                activeManifest.value = draft;
                await loadStagedItems(draft);
            }
            isInitialized.value = true;
        } catch (err) {
            console.warn('[useManifest.initActiveDraft] Error:', err);
        } finally {
            isSyncing.value = false;
        }
    }

    // -- Switch Active Manifest to a selected draft --
    async function switchActiveManifest(manifestId: string) {
        if (!manifestId) return;
        isSyncing.value = true;
        try {
            const target = await manifestsApi.getManifest(manifestId);
            if (target) {
                if (target.status === 'paused') {
                    const resumed = await manifestsApi.resumeManifest(manifestId);
                    activeManifest.value = resumed;
                    await loadStagedItems(resumed);
                } else {
                    activeManifest.value = target;
                    await loadStagedItems(target);
                }
                await fetchAllDrafts();
            }
        } catch (err: any) {
            addToast({ type: 'error', message: `Could not switch manifest: ${err.message}` });
        } finally {
            isSyncing.value = false;
        }
    }

    // -- Pause Active Manifest (Clean Hide from Screen) --
    async function pauseActiveManifest() {
        if (!activeManifest.value) return;
        isSyncing.value = true;
        try {
            const pausedName = activeManifest.value.name;
            await manifestsApi.pauseManifest(activeManifest.value.$id);
            activeManifest.value = null; // Clean hide from screen!
            stagedItems.value = [];
            isTrayOpen.value = false;
            await fetchAllDrafts();
            addToast({ type: 'info', message: `Paused "${pausedName}" — hidden from screen.` });
        } catch (err: any) {
            addToast({ type: 'error', message: `Failed to pause: ${err.message}` });
        } finally {
            isSyncing.value = false;
        }
    }

    // -- Lock Active Manifest into In-Transit state --
    async function lockActiveManifest() {
        if (!activeManifest.value) return;
        isSyncing.value = true;
        try {
            const updated = await manifestsApi.lockManifest(activeManifest.value.$id);
            activeManifest.value = updated;
            await fetchAllDrafts();
            addToast({ type: 'info', message: `Drop locked in-transit for ${updated.locationName}!` });
        } catch (err: any) {
            addToast({ type: 'error', message: `Failed to lock drop: ${err.message}` });
        } finally {
            isSyncing.value = false;
        }
    }

    // -- Unlock Active Manifest back to Draft for edits --
    async function unlockActiveManifest() {
        if (!activeManifest.value) return;
        isSyncing.value = true;
        try {
            const updated = await manifestsApi.unlockManifest(activeManifest.value.$id);
            activeManifest.value = updated;
            await fetchAllDrafts();
            addToast({ type: 'info', message: `Drop unlocked! You can now edit items.` });
        } catch (err: any) {
            addToast({ type: 'error', message: `Failed to unlock drop: ${err.message}` });
        } finally {
            isSyncing.value = false;
        }
    }

    // -- Check if an item is staged in any active or draft manifest --
    function getStagedInfo(itemId: string): { isStaged: boolean; locationName: string; manifestName: string; status: string } | null {
        if (!itemId) return null;
        if (activeManifest.value && activeManifest.value.itemIds && activeManifest.value.itemIds.includes(itemId)) {
            return {
                isStaged: true,
                locationName: activeManifest.value.locationName,
                manifestName: activeManifest.value.name,
                status: activeManifest.value.status
            };
        }
        for (const draft of allDrafts.value) {
            if (draft.itemIds && draft.itemIds.includes(itemId)) {
                return {
                    isStaged: true,
                    locationName: draft.locationName,
                    manifestName: draft.name,
                    status: draft.status
                };
            }
        }
        return null;
    }

    // -- Resume a Paused Manifest --
    async function resumeManifest(manifestId: string) {
        isSyncing.value = true;
        try {
            const updated = await manifestsApi.resumeManifest(manifestId);
            activeManifest.value = updated;
            await loadStagedItems(updated);
            await fetchAllDrafts();
            addToast({ type: 'success', message: `Resumed "${updated.name}"` });
        } catch (err: any) {
            addToast({ type: 'error', message: `Failed to resume: ${err.message}` });
        } finally {
            isSyncing.value = false;
        }
    }

    // -- Create a New Draft Manifest --
    async function createNewDraft(customName?: string, locationId = 'MD', locationName = 'Memory Den') {
        const tId = tenantId.value || 'default';
        const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const name = customName?.trim() || `${locationName} Drop - ${dateStr}`;

        isSyncing.value = true;
        try {
            const newDoc = await manifestsApi.createManifest({
                name,
                tenantId: tId,
                locationId,
                locationName,
                status: 'draft',
                itemIds: [],
                placedItemIds: [],
                itemsSnapshot: [],
                commissionRate: locationId === 'MD' || locationName.toLowerCase().includes('memory den') ? 15 : 10,
                itemCount: 0,
                totalCost: 0,
                totalRetail: 0,
                estimatedNet: 0
            });
            activeManifest.value = newDoc;
            stagedItems.value = [];
            await fetchAllDrafts();
            addToast({ type: 'success', message: `Created new manifest: "${name}"` });
            return newDoc;
        } catch (err: any) {
            addToast({ type: 'error', message: `Failed to create manifest: ${err.message}` });
            return null;
        } finally {
            isSyncing.value = false;
        }
    }

    // -- Add Items to Active Draft Manifest --
    async function addToActiveManifest(
        items: any[], 
        locationId = 'MD', 
        locationName = 'Memory Den', 
        shouldOpenTray = false, 
        silent = false
    ) {
        if (!items || items.length === 0) return;
        return enqueueManifestUpdate(async () => {
            isSyncing.value = true;
            try {
                const tId = tenantId.value || 'default';
                const now = new Date();
                const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                // If no active draft or location changed, fetch or create one
                if (!activeManifest.value || activeManifest.value.status !== 'draft') {
                    const existingDraft = await manifestsApi.getActiveDraft(tId, locationId);
                    if (existingDraft) {
                        activeManifest.value = existingDraft;
                        await loadStagedItems(existingDraft);
                    } else {
                        // Create new draft
                        const newManifest = await manifestsApi.createManifest({
                            name: `${locationName} Drop - ${dateStr}`,
                            tenantId: tId,
                            locationId,
                            locationName,
                            status: 'draft',
                            itemIds: [],
                            placedItemIds: [],
                            itemsSnapshot: [],
                            commissionRate: locationId === 'MD' || locationName.toLowerCase().includes('memory den') ? 15 : 10,
                            itemCount: 0,
                            totalCost: 0,
                            totalRetail: 0,
                            estimatedNet: 0
                        });
                        activeManifest.value = newManifest;
                        stagedItems.value = [];
                    }
                }

                // Merge items into staged items without duplicates
                const currentItemIds = new Set(activeManifest.value.itemIds || []);
                const newItemsToAdd: any[] = [];

                for (const item of items) {
                    if (!currentItemIds.has(item.$id)) {
                        currentItemIds.add(item.$id);
                        newItemsToAdd.push(item);
                    }
                }

                if (newItemsToAdd.length === 0) {
                    if (!silent) {
                        addToast({ type: 'info', message: 'Selected items are already in this manifest.' });
                    }
                    if (shouldOpenTray) {
                        openManifestTray();
                    }
                    return;
                }

                stagedItems.value = [...stagedItems.value, ...newItemsToAdd];

                // Recompute metrics
                const updatedIds = Array.from(currentItemIds);
                const updatedSnapshot = stagedItems.value.map(createItemSnapshot);

                const updatedManifest = await manifestsApi.updateManifest(activeManifest.value.$id, {
                    itemIds: updatedIds,
                    itemsSnapshot: updatedSnapshot,
                    itemCount: updatedIds.length,
                    totalCost: totalCost.value,
                    totalRetail: totalRetail.value,
                    estimatedNet: estimatedNet.value
                });

                activeManifest.value = updatedManifest;
                await fetchAllDrafts();
                if (shouldOpenTray) {
                    openManifestTray();
                }
                if (!silent) {
                    addToast({
                        type: 'success',
                        message: `Added ${newItemsToAdd.length} items to ${activeManifest.value.name}!`
                    });
                }
            } catch (err: any) {
                console.error('[useManifest.addToActiveManifest] Failed:', err);
                if (!silent) {
                    addToast({ type: 'error', message: `Failed to add items to manifest: ${err.message}` });
                }
            } finally {
                isSyncing.value = false;
            }
        });
    }

    // -- Remove Item from Active Manifest --
    async function removeFromManifest(itemId: string, silent = false) {
        if (!activeManifest.value) return;
        return enqueueManifestUpdate(async () => {
            isSyncing.value = true;
            try {
                stagedItems.value = stagedItems.value.filter(i => i.$id !== itemId);
                const updatedIds = stagedItems.value.map(i => i.$id);
                const updatedSnapshot = stagedItems.value.map(createItemSnapshot);

                const updated = await manifestsApi.updateManifest(activeManifest.value.$id, {
                    itemIds: updatedIds,
                    itemsSnapshot: updatedSnapshot,
                    itemCount: updatedIds.length,
                    totalCost: totalCost.value,
                    totalRetail: totalRetail.value,
                    estimatedNet: estimatedNet.value
                });

                activeManifest.value = updated;
                await fetchAllDrafts();
                if (!silent) {
                    addToast({ type: 'info', message: 'Removed item from manifest.' });
                }
            } catch (err: any) {
                if (!silent) {
                    addToast({ type: 'error', message: `Failed to remove item: ${err.message}` });
                }
            } finally {
                isSyncing.value = false;
            }
        });
    }

    // -- Clear Staged Items in Active Draft --
    async function clearStagedItems() {
        if (!activeManifest.value) return;
        return enqueueManifestUpdate(async () => {
            isSyncing.value = true;
            try {
                stagedItems.value = [];
                const updated = await manifestsApi.updateManifest(activeManifest.value.$id, {
                    itemIds: [],
                    itemsSnapshot: [],
                    itemCount: 0,
                    totalCost: 0,
                    totalRetail: 0,
                    estimatedNet: 0
                });
                activeManifest.value = updated;
                await fetchAllDrafts();
            } catch (err: any) {
                console.error('[useManifest.clearStagedItems] Failed:', err);
            } finally {
                isSyncing.value = false;
            }
        });
    }

    // -- Rename Active Manifest --
    async function updateManifestTitle(newTitle: string) {
        if (!activeManifest.value || !newTitle.trim()) return;
        try {
            const updated = await manifestsApi.updateManifest(activeManifest.value.$id, {
                name: newTitle.trim()
            });
            activeManifest.value = updated;
            await fetchAllDrafts();
            addToast({ type: 'success', message: `Renamed manifest to "${newTitle.trim()}"` });
        } catch (err: any) {
            addToast({ type: 'error', message: `Failed to rename: ${err.message}` });
        }
    }

    // -- Discard / Clear Active Draft --
    async function clearActiveManifest() {
        if (!activeManifest.value) return;
        try {
            await manifestsApi.deleteManifest(activeManifest.value.$id);
            activeManifest.value = null;
            stagedItems.value = [];
            isTrayOpen.value = false;
            await fetchAllDrafts();
            addToast({ type: 'info', message: 'Manifest discarded.' });
        } catch (err: any) {
            addToast({ type: 'error', message: `Failed to discard manifest: ${err.message}` });
        }
    }

    // -- Export Manifest CSV (Ricochet or Generic) --
    async function exportManifestCsv(format: 'ricochet' | 'generic' = 'ricochet') {
        if (!activeManifest.value || stagedItems.value.length === 0) {
            addToast({ type: 'warning', message: 'No items in manifest to export.' });
            return;
        }

        try {
            const items = stagedItems.value;
            let csv = '';
            if (format === 'ricochet') {
                csv = generateRicochetCsv(items);
            } else {
                csv = generateGenericCsv(items);
            }

            const cleanName = activeManifest.value.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const dateStr = new Date().toISOString().split('T')[0];
            const fileName = `${cleanName}-${format}-${dateStr}.csv`;

            downloadCsv(csv, fileName);

            // Update status to 'exported'
            const updated = await manifestsApi.updateManifest(activeManifest.value.$id, {
                status: 'exported',
                exportedAt: new Date().toISOString()
            });
            activeManifest.value = updated;
            await fetchAllDrafts();

            addToast({
                type: 'success',
                message: `Exported ${items.length} items for ${activeManifest.value.locationName}! Upload to Ricochet on your PC.`
            });
        } catch (err: any) {
            console.error('[useManifest.exportManifestCsv] Error:', err);
            addToast({ type: 'error', message: `Export failed: ${err.message}` });
        }
    }

    // -- Item-by-Item Placement Verification (PO Style) --
    async function verifyPlacementItem(manifestId: string, itemId: string, targetLocation: string, undo = false) {
        try {
            const { manifest } = await manifestsApi.verifyItemPlacement(manifestId, itemId, targetLocation, undo);
            if (activeManifest.value && activeManifest.value.$id === manifestId) {
                activeManifest.value = manifest;
            }
            return manifest;
        } catch (err: any) {
            addToast({ type: 'error', message: `Verification error: ${err.message}` });
            throw err;
        }
    }

    // -- Finalize Manifest Placement --
    async function finalizeActivePlacement(manifestId: string) {
        try {
            const finalized = await manifestsApi.finalizePlacement(manifestId);
            if (activeManifest.value && activeManifest.value.$id === manifestId) {
                activeManifest.value = finalized;
            }
            addToast({ type: 'success', message: 'All items placed! Drop finalized.' });
            return finalized;
        } catch (err: any) {
            addToast({ type: 'error', message: `Could not finalize: ${err.message}` });
            throw err;
        }
    }

    // -- List all manifests for location hub --
    async function fetchManifests(locationId?: string) {
        const tId = tenantId.value || 'default';
        manifestsList.value = await manifestsApi.listManifests(tId, locationId);
        return manifestsList.value;
    }

    // -- Rollback Placed or In-Transit Manifest (Full Revert / Undo) --
    async function rollbackPlacedManifest(manifestId: string, targetStorageLocation = 'Backstock') {
        if (!manifestId) return;
        isSyncing.value = true;
        try {
            const rolledBack = await manifestsApi.rollbackManifest(manifestId, {
                revertItemsToStatus: 'in-stock',
                targetStorageLocation
            });
            activeManifest.value = rolledBack;
            await loadStagedItems(rolledBack);
            await fetchAllDrafts();
            addToast({ 
                type: 'success', 
                message: `Drop "${rolledBack.name}" rolled back to draft! Items restored to ${targetStorageLocation}.` 
            });
            return rolledBack;
        } catch (err: any) {
            addToast({ type: 'error', message: `Failed to rollback manifest: ${err.message}` });
            throw err;
        } finally {
            isSyncing.value = false;
        }
    }

    // -- Unverify All Items on Active Manifest --
    async function unverifyAllItems(manifestId?: string) {
        const mId = manifestId || activeManifest.value?.$id;
        if (!mId) return;
        isSyncing.value = true;
        try {
            const updated = await manifestsApi.unverifyManifestItems(mId);
            if (activeManifest.value && activeManifest.value.$id === mId) {
                activeManifest.value = updated;
            }
            await fetchAllDrafts();
            addToast({ type: 'info', message: 'All items unverified on manifest.' });
            return updated;
        } catch (err: any) {
            addToast({ type: 'error', message: `Unverify failed: ${err.message}` });
            throw err;
        } finally {
            isSyncing.value = false;
        }
    }

    // -- Reopen Closed / Placed Manifest --
    async function reopenClosedManifest(manifestId: string, targetStorageLocation?: string) {
        return await rollbackPlacedManifest(manifestId, targetStorageLocation);
    }

    // Computed list of recent placed/closed drops
    const recentPlacedManifests = computed(() => {
        return recentManifests.value.filter(m => m.status === 'placed');
    });

    return {
        activeManifest,
        stagedItems,
        isTrayOpen: isManifestTrayOpen,
        isManifestTrayOpen,
        isActionTrayOpen,
        openManifestTray,
        openActionTray,
        toggleManifestTray,
        toggleActionTray,
        closeAllTrays,
        isSyncing,
        allDrafts,
        manifestsList,
        recentManifests,
        recentPlacedManifests,
        isInitialized,
        stagedCount,
        totalUnits,
        placedItemIds,
        placedCount,
        totalCost,
        totalRetail,
        commissionRate,
        estimatedNet,
        estimatedProfit,
        roiMultiple,
        initActiveDraft,
        fetchAllDrafts,
        switchActiveManifest,
        pauseActiveManifest,
        resumeManifest,
        lockActiveManifest,
        unlockActiveManifest,
        rollbackPlacedManifest,
        unverifyAllItems,
        reopenClosedManifest,
        getStagedInfo,
        createNewDraft,
        addToActiveManifest,
        removeFromManifest,
        clearStagedItems,
        updateManifestTitle,
        clearActiveManifest,
        exportManifestCsv,
        verifyPlacementItem,
        finalizeActivePlacement,
        fetchManifests
    };
}

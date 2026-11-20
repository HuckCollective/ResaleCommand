import { ref, shallowRef, computed } from 'vue';
import { databases, Query, client } from '../lib/appwrite';
import type { Models } from 'appwrite';
import { useLoader } from './useLoader';

import { isAlphaMode } from '../stores/env';
import { generateAutoUpc, isValidOrgUpc, isActiveInventory, getCollectionId, DB_ID } from '../lib/inventory';
import { registerInventoryStoreBridge } from '../lib/searchEngine';
import { markCalmSelfMutation, beginCalmLocalWrite, handleCalmRealtimeEvent } from './useCalmRealtime';

// Shared state for the general inventory view (shallowRef avoids deep reactive proxies on 60KB rawAnalysis across 1,900+ items)
const inventoryItems = shallowRef<Models.Document[]>([]);
const totalItems = ref(0);
const loading = ref(false);
const error = ref<string | null>(null);
let currentTeamId: string | null = null;
let unsubscribe: (() => void) | null = null;
const generatingProgress = ref(0);
const generatingTotal = ref(0);

// Anti-clobber mutation tracking & generation-safe fetch guards
const localMutationTimestamps = new Map<string, number>();
const localRemovedTimestamps = new Map<string, number>();
let activeFetchGeneration = 0;
let pendingFollowUpTeamId: string | null = null;

const itemByIdMap = computed<Map<string, Models.Document>>(() => {
    const map = new Map<string, Models.Document>();
    for (const item of inventoryItems.value) {
        if (item?.$id) map.set(item.$id, item);
    }
    return map;
});

/**
 * ShallowRef-safe canonical mutators: always assign a new array reference (and new modified item objects)
 * so every downstream computed (filters, Spatial Bar, Queues, Health Audit, Trays) updates synchronously.
 */
export function upsertLocalItems(docs: any[], opts?: { fromRealtime?: boolean }): void {
    if (!Array.isArray(docs) || docs.length === 0) return;
    const now = Date.now();
    const next = [...inventoryItems.value];
    const indexById = new Map<string, number>();
    for (let i = 0; i < next.length; i++) {
        const id = next[i]?.$id;
        if (id) indexById.set(id, i);
    }

    let changed = false;
    const mutatedIds: string[] = [];
    for (const doc of docs) {
        if (!doc || typeof doc !== 'object' || !doc.$id) continue;
        localMutationTimestamps.set(doc.$id, now);
        localRemovedTimestamps.delete(doc.$id);
        mutatedIds.push(doc.$id);
        const existingIdx = indexById.get(doc.$id);
        if (existingIdx !== undefined) {
            next[existingIdx] = { ...next[existingIdx], ...doc };
            changed = true;
        } else {
            next.unshift(doc);
            indexById.clear();
            for (let i = 0; i < next.length; i++) {
                if (next[i]?.$id) indexById.set(next[i].$id, i);
            }
            totalItems.value++;
            changed = true;
        }
    }

    if (!opts?.fromRealtime && mutatedIds.length > 0) {
        markCalmSelfMutation(mutatedIds, 'inventory');
    }

    if (changed) {
        inventoryItems.value = next;
    }
}

export function patchLocalItems(ids: string[], updates: Record<string, any>, opts?: { fromRealtime?: boolean }): void {
    if (!Array.isArray(ids) || ids.length === 0 || !updates) return;
    const idSet = new Set(ids.filter((id) => typeof id === 'string' && id.trim().length > 0));
    if (idSet.size === 0) return;

    const now = Date.now();
    const isoNow = new Date(now).toISOString();
    let changed = false;

    const next = inventoryItems.value.map((item) => {
        if (!item || !idSet.has(item.$id)) return item;
        changed = true;
        localMutationTimestamps.set(item.$id, now);
        localRemovedTimestamps.delete(item.$id);
        return {
            ...item,
            ...updates,
            $updatedAt: updates.$updatedAt || isoNow,
        };
    });

    if (!opts?.fromRealtime) {
        markCalmSelfMutation(Array.from(idSet), 'inventory');
    }

    if (changed) {
        inventoryItems.value = next;
    }
}

export function removeLocalItems(ids: string[], opts?: { fromRealtime?: boolean }): void {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const idSet = new Set(ids.filter((id) => typeof id === 'string' && id.trim().length > 0));
    if (idSet.size === 0) return;

    const now = Date.now();
    for (const id of idSet) {
        localRemovedTimestamps.set(id, now);
        localMutationTimestamps.delete(id);
    }

    if (!opts?.fromRealtime) {
        markCalmSelfMutation(Array.from(idSet), 'inventory');
    }

    const before = inventoryItems.value.length;
    const next = inventoryItems.value.filter((item) => item && !idSet.has(item.$id));
    if (next.length !== before) {
        inventoryItems.value = next;
        totalItems.value = Math.max(0, totalItems.value - (before - next.length));
    }
}

registerInventoryStoreBridge({
    getSnapshot: () => inventoryItems.value,
    upsert: upsertLocalItems,
    patch: patchLocalItems,
    remove: removeLocalItems,
    preMark: (ids) => markCalmSelfMutation(ids, 'inventory'),
    beginWrite: () => beginCalmLocalWrite('inventory'),
});

export function useInventory() {
    
    // -- Realtime Subscription --
    const initRealtime = () => {
        if (unsubscribe) return; // Already listening
        
        console.log('[Inventory] Starting Realtime Subscription...');
        unsubscribe = client.subscribe(
            `databases.${DB_ID}.collections.${getCollectionId()}.documents`,
            (response) => {
                const events = Array.isArray(response.events) ? response.events : [];
                const item = response.payload as Models.Document;
                if (!item || !item.$id) return;

                // 1. Filter by Tenant (Security/Relevance)
                if (currentTeamId && (item as any).tenantId !== currentTeamId) return;

                // 2. Route through Calm Realtime Coordinator (silent scalar .update, buffered row shifts when busy)
                const isDelete = events.some((e) => e.includes('.delete'));
                const isCreate = !isDelete && events.some((e) => e.includes('.create'));
                const isUpdate = !isDelete && !isCreate && events.some((e) => e.includes('.update'));
                if (!isDelete && !isCreate && !isUpdate) return;

                const prevItem = itemByIdMap.value.get(item.$id);
                const existsInList = Boolean(prevItem);
                const evictsFromActiveView = Boolean(
                    isUpdate &&
                    prevItem &&
                    isActiveInventory((prevItem as any).status) &&
                    !isActiveInventory((item as any).status)
                );

                handleCalmRealtimeEvent({
                    scope: 'inventory',
                    id: item.$id,
                    eventType: isDelete ? 'delete' : isCreate ? 'create' : 'update',
                    existsInList,
                    evictsFromActiveView,
                    applyImmediate: () => {
                        if (isDelete) {
                            removeLocalItems([item.$id], { fromRealtime: true });
                        } else {
                            upsertLocalItems([item], { fromRealtime: true });
                        }
                    },
                });
            }
        );
    };

    // State
    const hasMore = ref(false);
    
    /**
     * Fetch items (all, with pagination)
     */
    let fetchPromise: Promise<void> | null = null;

    const fetchInventory = async (teamId?: string) => {
        // If already fetching, queue a single follow-up fetch instead of dropping post-save refreshes
        if (loading.value && fetchPromise) {
            pendingFollowUpTeamId = teamId !== undefined ? teamId : (currentTeamId ?? '');
            return fetchPromise;
        }

        if (teamId !== undefined) currentTeamId = teamId;

        loading.value = true;
        error.value = null;
        const myGen = ++activeFetchGeneration;
        const fetchStartedAt = Date.now();
        
        const { startAmbientSync } = useLoader();
        const isInitialColdLoad = inventoryItems.value.length === 0;
        const stopAmbient = isInitialColdLoad ? startAmbientSync('Loading catalog…') : () => {};
        
        fetchPromise = (async () => {
            try {
                const allDocs: Models.Document[] = [];
                let cursor: string | null = null;
                let hasMoreItems = true;
                let total = 0;
                const pageSize = 500;

                while (hasMoreItems) {
                    const queries: any[] = [
                        Query.orderDesc('$id'),
                        Query.limit(pageSize)
                    ];

                    if (currentTeamId) {
                        queries.push(Query.equal('tenantId', currentTeamId));
                    }

                    if (cursor) {
                        queries.push(Query.cursorAfter(cursor));
                    }

                    const response = await databases.listDocuments(
                        DB_ID,
                        getCollectionId(),
                        queries
                    );
                    
                    total = response.total;
                    totalItems.value = total;

                    if (response.documents.length > 0) {
                        const isFirstBatch = allDocs.length === 0;
                        allDocs.push(...response.documents);
                        cursor = response.documents[response.documents.length - 1].$id;

                        // Paint Batch 1 immediately (<400ms) & release calm sync pill; remaining batches commit once at end
                        if (isFirstBatch && isInitialColdLoad && inventoryItems.value.length === 0) {
                            inventoryItems.value = [...allDocs];
                            stopAmbient('');
                        }
                    }

                    console.log(`[useInventory] Batch: ${response.documents.length}, Accumulated: ${allDocs.length}, Collection total: ${total} (${getCollectionId()})`);

                    // Continue until all items in collection are retrieved or empty batch returned
                    if (response.documents.length === 0 || allDocs.length >= total) {
                        hasMoreItems = false;
                    }
                }

                if (myGen === activeFetchGeneration) {
                    // Anti-clobber guard: preserve any local creates, edits, or deletes made while this fetch was in flight
                    const mergedMap = new Map<string, Models.Document>();
                    for (const doc of allDocs) {
                        if (doc?.$id) mergedMap.set(doc.$id, doc);
                    }
                    for (const localDoc of inventoryItems.value) {
                        const id = localDoc?.$id;
                        if (!id) continue;
                        const mutTs = localMutationTimestamps.get(id) || 0;
                        if (mutTs >= fetchStartedAt) {
                            const fetchedDoc = mergedMap.get(id);
                            if (!fetchedDoc) {
                                const delTs = localRemovedTimestamps.get(id) || 0;
                                if (delTs < mutTs) mergedMap.set(id, localDoc);
                            } else {
                                const localTime = new Date(localDoc.$updatedAt || 0).getTime();
                                const fetchedTime = new Date(fetchedDoc.$updatedAt || 0).getTime();
                                if (localTime >= fetchedTime) {
                                    mergedMap.set(id, { ...fetchedDoc, ...localDoc });
                                }
                            }
                        }
                    }
                    for (const [delId, delTs] of localRemovedTimestamps.entries()) {
                        if (delTs >= fetchStartedAt && (localMutationTimestamps.get(delId) || 0) <= delTs) {
                            mergedMap.delete(delId);
                        }
                    }

                    const mergedDocs = Array.from(mergedMap.values());
                    // Deterministic stable sort by intake creation date ($createdAt DESC) so editing an item never jumps its position
                    mergedDocs.sort((a: any, b: any) => {
                        const aTime = new Date(a.$createdAt || a.createdAt || 0).getTime();
                        const bTime = new Date(b.$createdAt || b.createdAt || 0).getTime();
                        return bTime - aTime;
                    });

                    inventoryItems.value = mergedDocs;
                    totalItems.value = Math.max(total, mergedDocs.length);
                }

                initRealtime();
                hasMore.value = false;
            } catch (e: any) {
                console.error("Failed to fetch inventory:", e);
                error.value = e.message;
            } finally {
                loading.value = false;
                fetchPromise = null;
                stopAmbient('');

                if (pendingFollowUpTeamId !== null) {
                    const nextTeam = pendingFollowUpTeamId || undefined;
                    pendingFollowUpTeamId = null;
                    void fetchInventory(nextTeam);
                }
            }
        })();

        return fetchPromise;
    };
    
    const loadNextPage = () => {
        // No-op - all items are automatically fetched via fetchInventory
    };

    /**
     * Add an item to the local list (optimistic update or after creation)
     */
    const addLocalItem = (item: Models.Document) => {
        if (item?.$id) {
            upsertLocalItems([item]);
        }
    };

    /**
     * Generate UPCs for items missing a UPC
     */
    const generateUpcs = async (prefix: string = 'HUCK-') => {
        loading.value = true;
        error.value = null;
        generatingProgress.value = 0;
        
        const { showLoader, hideLoader, updateLoader } = useLoader();
        showLoader(`Generating ${prefix} UPCs...`);

        try {
            // Find items without valid UPC
            const missingUpcItems = inventoryItems.value.filter((i: any) => !isValidOrgUpc(i.upc, prefix));
            if (missingUpcItems.length === 0) return 0;
            
            generatingTotal.value = missingUpcItems.length;

            // Assign guaranteed unique UPCs via database-verified generateAutoUpc
            let updatedCount = 0;
            for (const item of missingUpcItems) {
                const newUpc = await generateAutoUpc(prefix, currentTeamId || undefined);
                
                // Add a 200ms delay to prevent Appwrite rate limits when bulk updating
                await new Promise(resolve => setTimeout(resolve, 200));
                
                let success = false;
                let retries = 0;
                while (!success && retries < 3) {
                    try {
                        await databases.updateDocument(DB_ID, getCollectionId(), item.$id, {
                            upc: newUpc
                        });
                        success = true;
                    } catch (e: any) {
                        if (e.code === 429) {
                            console.warn("Rate limited, pausing for 2 seconds...");
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            retries++;
                        } else {
                            throw e;
                        }
                    }
                }
                patchLocalItems([item.$id], { upc: newUpc }); // Update shallowRef immutably for immediate UI reflection
                updatedCount++;
                generatingProgress.value = updatedCount;
                
                // Update the loader message so it acts as a global progress indicator
                if (updateLoader) {
                    updateLoader(`Generating ${prefix} UPCs... (${updatedCount}/${generatingTotal.value})`);
                }
            }
            
            return updatedCount;
        } catch (err: any) {
            console.error("Failed to generate UPCs:", err);
            throw err;
        } finally {
            loading.value = false;
            generatingProgress.value = 0;
            generatingTotal.value = 0;
            hideLoader();
        }
    };

    const localUpcLocks = new Map<string, number>();

    /**
     * Get the next UPC for a given prefix without saving
     */
    const getNextUpc = (prefix: string = 'HUCK-') => {
        const cleanPrefix = prefix.endsWith('-') ? prefix : `${prefix}-`;
        const existingUpcs = inventoryItems.value
            .map((i: any) => i.upc)
            .filter(u => u && u.startsWith(cleanPrefix));
        
        let maxIndex = 0;
        existingUpcs.forEach((u: string) => {
            const numPart = u.replace(cleanPrefix, '');
            const num = parseInt(numPart, 10);
            if (!isNaN(num) && num > maxIndex) {
                maxIndex = num;
            }
        });

        const currentLock = localUpcLocks.get(cleanPrefix) || 0;
        let nextIndex = Math.max(maxIndex, currentLock) + 1;

        let candidate = `${cleanPrefix}${nextIndex.toString().padStart(4, '0')}`;
        const upcSet = new Set(existingUpcs);
        while (upcSet.has(candidate)) {
            nextIndex++;
            candidate = `${cleanPrefix}${nextIndex.toString().padStart(4, '0')}`;
        }

        localUpcLocks.set(cleanPrefix, nextIndex);
        return candidate;
    };

    return {
        inventoryItems,
        itemByIdMap,
        totalItems,
        loading,
        error,
        hasMore,
        fetchInventory,
        loadNextPage,
        addLocalItem,
        upsertLocalItems,
        patchLocalItems,
        removeLocalItems,
        generateUpcs,
        getNextUpc,
        generatingProgress,
        generatingTotal
    };
}

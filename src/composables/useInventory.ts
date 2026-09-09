import { ref, computed } from 'vue';
import { databases, Query, client } from '../lib/appwrite';
import type { Models } from 'appwrite';
import { useLoader } from './useLoader';

import { isAlphaMode } from '../stores/env';

const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID;
const getCollectionId = () => isAlphaMode.get() 
    ? (import.meta.env.PUBLIC_APPWRITE_ALPHA_COLLECTION_ID || 'alpha_items') 
    : (import.meta.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items');

// Shared state for the general inventory view
const inventoryItems = ref<Models.Document[]>([]);
const totalItems = ref(0);
const loading = ref(false);
const error = ref<string | null>(null);
let currentTeamId: string | null = null;
let unsubscribe: (() => void) | null = null;
const generatingProgress = ref(0);
const generatingTotal = ref(0);

export function useInventory() {
    
    // -- Realtime Subscription --
    const initRealtime = () => {
        if (unsubscribe) return; // Already listening
        
        console.log('[Inventory] Starting Realtime Subscription...');
        unsubscribe = client.subscribe(
            `databases.${DB_ID}.collections.${getCollectionId()}.documents`,
            (response) => {
                const eventType = response.events[0];
                const item = response.payload as Models.Document;

                // 1. Filter by Tenant (Security/Relevance)
                if (currentTeamId && (item as any).tenantId !== currentTeamId) return;

                // 2. Handle Events
                if (eventType.includes('.create')) {
                    // Check if already exists (prevent duplicates if local optimistic update happened)
                    if (!inventoryItems.value.find(i => i.$id === item.$id)) {
                        inventoryItems.value.unshift(item);
                    }
                    totalItems.value++;
                } else if (eventType.includes('.update')) {
                    const idx = inventoryItems.value.findIndex(i => i.$id === item.$id);
                    if (idx !== -1) {
                        inventoryItems.value[idx] = item;
                    } else {
                        // Moved into view (e.g. status change)? Add to top
                        inventoryItems.value.unshift(item);
                    }
                } else if (eventType.includes('.delete')) {
                    inventoryItems.value = inventoryItems.value.filter(i => i.$id !== item.$id);
                    totalItems.value--;
                }
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
        if (teamId !== undefined) currentTeamId = teamId;

        // If already fetching, return existing promise to avoid duplicate concurrent loops
        if (loading.value && fetchPromise) {
            return fetchPromise;
        }

        loading.value = true;
        error.value = null;
        
        const { showLoader, updateLoader, hideLoader } = useLoader();
        if (inventoryItems.value.length === 0) {
            showLoader("Loading Inventory...");
        }
        
        fetchPromise = (async () => {
            try {
                const allDocs: Models.Document[] = [];
                let cursor: string | null = null;
                let hasMoreItems = true;
                let total = 0;
                const pageSize = 5000;

                while (hasMoreItems) {
                    const queries: any[] = [
                        Query.orderDesc('$createdAt'),
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
                        allDocs.push(...response.documents);
                        cursor = response.documents[response.documents.length - 1].$id;
                        inventoryItems.value = [...allDocs];
                    }

                    console.log(`[useInventory] Batch: ${response.documents.length}, Accumulated: ${allDocs.length}, Collection total: ${total} (${getCollectionId()})`);

                    if (response.documents.length < pageSize || allDocs.length >= total) {
                        hasMoreItems = false;
                    }
                }

                inventoryItems.value = allDocs;
                initRealtime();
                hasMore.value = false;
            } catch (e: any) {
                console.error("Failed to fetch inventory:", e);
                error.value = e.message;
            } finally {
                loading.value = false;
                fetchPromise = null;
                // Hide the global Vue loader
                hideLoader();
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
        // Prevent dupes
        if (!inventoryItems.value.find(i => i.$id === item.$id)) {
             inventoryItems.value.unshift(item);
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
            // Find items without UPC
            const missingUpcItems = inventoryItems.value.filter((i: any) => !i.upc);
            if (missingUpcItems.length === 0) return 0;
            
            generatingTotal.value = missingUpcItems.length;

            // Find current max index for this prefix
            const existingUpcs = inventoryItems.value
                .map((i: any) => i.upc)
                .filter(u => u && u.startsWith(prefix));
            
            let maxIndex = 0;
            existingUpcs.forEach((u: string) => {
                const numPart = u.replace(prefix, '');
                const num = parseInt(numPart, 10);
                if (!isNaN(num) && num > maxIndex) {
                    maxIndex = num;
                }
            });

            // Assign new UPCs
            let updatedCount = 0;
            for (const item of missingUpcItems) {
                maxIndex++;
                // Format to 4 digits minimum (e.g. 0001)
                const newUpc = `${prefix}${maxIndex.toString().padStart(4, '0')}`;
                
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
                item.upc = newUpc; // Update local state for immediate UI reflection
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

    /**
     * Get the next UPC for a given prefix without saving
     */
    const getNextUpc = (prefix: string = 'HUCK-') => {
        const existingUpcs = inventoryItems.value
            .map((i: any) => i.upc)
            .filter(u => u && u.startsWith(prefix));
        
        let maxIndex = 0;
        existingUpcs.forEach((u: string) => {
            const numPart = u.replace(prefix, '');
            const num = parseInt(numPart, 10);
            if (!isNaN(num) && num > maxIndex) {
                maxIndex = num;
            }
        });

        maxIndex++;
        return `${prefix}${maxIndex.toString().padStart(4, '0')}`;
    };

    return {
        inventoryItems,
        totalItems,
        loading,
        error,
        hasMore,
        fetchInventory,
        loadNextPage,
        addLocalItem,
        generateUpcs,
        getNextUpc,
        generatingProgress,
        generatingTotal
    };
}

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
     * Fetch items (all)
     */
    const fetchInventory = async (teamId: string) => {
        currentTeamId = teamId;
        loading.value = true;
        error.value = null;
        
        const { showLoader } = useLoader();
        showLoader("Loading Inventory...");
        
        try {
            // Appwrite limit is max 5000 documents per request
            const queries = [
                Query.orderDesc('$createdAt'),
                Query.orderDesc('$id'), 
                Query.limit(5000)
            ];

            if (teamId) {
                queries.push(Query.equal('tenantId', teamId));
            }

            const response = await databases.listDocuments(
                DB_ID,
                getCollectionId(),
                queries
            );
            
            totalItems.value = response.total;

            inventoryItems.value = response.documents;
            initRealtime();
            
            hasMore.value = false;
        } catch (e: any) {
            console.error("Failed to fetch inventory:", e);
            error.value = e.message;
        } finally {
            loading.value = false;
            // Hide the global Vue loader
            const { hideLoader } = useLoader();
            hideLoader();
        }
    };
    
    const loadNextPage = () => {
        // No-op
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
        if (!currentTeamId) throw new Error("No active team");
        
        loading.value = true;
        error.value = null;
        const { showLoader, hideLoader } = useLoader();
        showLoader(`Generating ${prefix} UPCs...`);

        try {
            // Find items without UPC
            const missingUpcItems = inventoryItems.value.filter((i: any) => !i.upc);
            if (missingUpcItems.length === 0) return 0;

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
                
                await databases.updateDocument(DB_ID, getCollectionId(), item.$id, {
                    upc: newUpc
                });
                updatedCount++;
            }
            
            return updatedCount;
        } catch (err: any) {
            console.error("Failed to generate UPCs:", err);
            throw err;
        } finally {
            loading.value = false;
            hideLoader();
        }
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
        generateUpcs
    };
}

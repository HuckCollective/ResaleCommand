import { ref } from 'vue';
import { databases, Query, client } from '../lib/appwrite';
import type { Models } from 'appwrite';
import { purchasesAPI, getPurchasesCollectionId } from '../lib/purchases';
import { markCalmSelfMutation, handleCalmRealtimeEvent } from './useCalmRealtime';

const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

// Shared singleton state for purchases across all components and views
const purchases = ref<any[]>([]);
const totalPurchases = ref(0);
const loading = ref(false);
const error = ref<string | null>(null);
let currentTenantId: string | null = null;
let unsubscribe: (() => void) | null = null;

// Synchronize in-memory reactive state instantly whenever any component creates, updates, or deletes a PO
if (typeof window !== 'undefined' && !(window as any).__purchasesEventsInitialized) {
    (window as any).__purchasesEventsInitialized = true;

    window.addEventListener('purchase-updated', (e: any) => {
        const doc = e?.detail?.data;
        const purchaseId = e?.detail?.purchaseId || doc?.$id;
        if (!purchaseId) return;
        markCalmSelfMutation(purchaseId, 'purchases');
        const idx = purchases.value.findIndex(p => p.$id === purchaseId);
        if (idx !== -1) {
            const next = [...purchases.value];
            next[idx] = { ...next[idx], ...doc };
            purchases.value = next;
        } else if (doc) {
            purchases.value = [doc, ...purchases.value];
        }
    });

    window.addEventListener('purchase-created', (e: any) => {
        const doc = e?.detail?.data;
        if (!doc || !doc.$id) return;
        markCalmSelfMutation(doc.$id, 'purchases');
        if (!purchases.value.find(p => p.$id === doc.$id)) {
            purchases.value = [doc, ...purchases.value];
            totalPurchases.value++;
        }
    });

    window.addEventListener('purchase-deleted', (e: any) => {
        const purchaseId = e?.detail?.purchaseId;
        if (!purchaseId) return;
        markCalmSelfMutation(purchaseId, 'purchases');
        const before = purchases.value.length;
        purchases.value = purchases.value.filter(p => p.$id !== purchaseId);
        if (purchases.value.length < before) {
            totalPurchases.value = Math.max(0, totalPurchases.value - (before - purchases.value.length));
        }
    });
}

export function usePurchases() {
    const currentTeamIdMissing = (doc: any) =>
        Boolean(currentTenantId && doc?.tenantId && doc.tenantId !== currentTenantId);

    const initRealtime = () => {
        if (unsubscribe) return; // Already subscribed

        const colId = getPurchasesCollectionId();
        try {
            unsubscribe = client.subscribe(
                `databases.${DB_ID}.collections.${colId}.documents`,
                (response) => {
                    const isDelete = response.events.some(e => e.includes('.delete'));
                    const isCreate = !isDelete && response.events.some(e => e.includes('.create'));
                    const isUpdate = !isDelete && !isCreate && response.events.some(e => e.includes('.update'));
                    const doc = response.payload as Models.Document;
                    if (!doc || !doc.$id || (!isCreate && !isUpdate && !isDelete)) return;

                    // Filter by tenant if applicable
                    if (currentTeamIdMissing(doc)) return;

                    const exists = purchases.value.some(p => p.$id === doc.$id);
                    handleCalmRealtimeEvent({
                        scope: 'purchases',
                        id: doc.$id,
                        eventType: isDelete ? 'delete' : isCreate ? 'create' : 'update',
                        existsInList: exists,
                        applyImmediate: () => {
                            if (isDelete) {
                                const before = purchases.value.length;
                                purchases.value = purchases.value.filter(p => p.$id !== doc.$id);
                                if (purchases.value.length < before) {
                                    totalPurchases.value = Math.max(0, totalPurchases.value - (before - purchases.value.length));
                                }
                            } else {
                                const idx = purchases.value.findIndex(p => p.$id === doc.$id);
                                if (idx !== -1) {
                                    const next = [...purchases.value];
                                    next[idx] = { ...next[idx], ...doc };
                                    purchases.value = next;
                                } else {
                                    purchases.value = [doc, ...purchases.value];
                                    totalPurchases.value++;
                                }
                            }
                        },
                    });
                }
            );
        } catch (err) {
            console.warn('[usePurchases] Realtime subscription warning:', err);
        }
    };

    const fetchPurchases = async (tenantId?: string) => {
        if (tenantId) currentTenantId = tenantId;
        loading.value = true;
        error.value = null;

        try {
            const queries = [
                Query.orderDesc('$createdAt'),
                Query.limit(5000)
            ];
            if (currentTenantId) {
                queries.push(Query.equal('tenantId', currentTenantId));
            }

            let res = await purchasesAPI.listPurchases(queries);
            let docs = res.documents || [];

            // If tenant filter returned 0, fallback to recent purchases so legacy/dev POs still appear
            if (docs.length === 0 && currentTenantId) {
                try {
                    const fallbackRes = await purchasesAPI.listPurchases([
                        Query.orderDesc('$createdAt'),
                        Query.limit(5000)
                    ]);
                    if (fallbackRes.documents && fallbackRes.documents.length > 0) {
                        docs = fallbackRes.documents;
                    }
                } catch (fallbackErr) {
                    console.warn('[usePurchases] Fallback query error:', fallbackErr);
                }
            }

            purchases.value = docs;
            totalPurchases.value = docs.length;
            initRealtime();
        } catch (err: any) {
            console.error('[usePurchases] Error loading purchases:', err);
            error.value = err.message || 'Failed to load purchases';
            // Safe fallback attempt with minimal query
            try {
                const minimalRes = await purchasesAPI.listPurchases([Query.limit(5000)]);
                if (minimalRes.documents) {
                    purchases.value = minimalRes.documents;
                    totalPurchases.value = minimalRes.documents.length;
                }
            } catch (minErr) {
                console.error('[usePurchases] Minimal fallback failed:', minErr);
            }
        } finally {
            loading.value = false;
        }
    };

    return {
        purchases,
        totalPurchases,
        loading,
        error,
        fetchPurchases,
        initRealtime
    };
}

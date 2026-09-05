import { ref } from 'vue';
import { databases, Query, client } from '../lib/appwrite';
import type { Models } from 'appwrite';
import { purchasesAPI, getPurchasesCollectionId } from '../lib/purchases';

const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

// Shared singleton state for purchases across all components and views
const purchases = ref<any[]>([]);
const totalPurchases = ref(0);
const loading = ref(false);
const error = ref<string | null>(null);
let currentTenantId: string | null = null;
let unsubscribe: (() => void) | null = null;

export function usePurchases() {
    const initRealtime = () => {
        if (unsubscribe) return; // Already subscribed

        const colId = getPurchasesCollectionId();
        try {
            unsubscribe = client.subscribe(
                `databases.${DB_ID}.collections.${colId}.documents`,
                (response) => {
                    const isCreate = response.events.some(e => e.includes('.create'));
                    const isUpdate = response.events.some(e => e.includes('.update'));
                    const isDelete = response.events.some(e => e.includes('.delete'));
                    const doc = response.payload as Models.Document;
                    if (!doc || !doc.$id) return;

                    // Filter by tenant if applicable
                    if (currentTenantId && (doc as any).tenantId && (doc as any).tenantId !== currentTenantId) {
                        return;
                    }

                    if (isCreate) {
                        if (!purchases.value.find(p => p.$id === doc.$id)) {
                            purchases.value.unshift(doc);
                        }
                        totalPurchases.value++;
                    } else if (isUpdate) {
                        const idx = purchases.value.findIndex(p => p.$id === doc.$id);
                        if (idx !== -1) {
                            purchases.value[idx] = { ...purchases.value[idx], ...doc };
                        } else {
                            purchases.value.unshift(doc);
                        }
                    } else if (isDelete) {
                        purchases.value = purchases.value.filter(p => p.$id !== doc.$id);
                        totalPurchases.value = Math.max(0, totalPurchases.value - 1);
                    }
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

            const res = await purchasesAPI.listPurchases(queries);
            purchases.value = res.documents || [];
            totalPurchases.value = res.total || purchases.value.length;
            initRealtime();
        } catch (err: any) {
            console.error('[usePurchases] Error loading purchases:', err);
            error.value = err.message || 'Failed to load purchases';
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

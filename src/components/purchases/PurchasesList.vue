<template>
  <div class="card bg-base-100 shadow-xl border border-base-200">
    <div class="p-4 border-b border-base-200 bg-base-100 flex items-center justify-between gap-4 sticky top-0 z-10 shadow-sm rounded-t-2xl">
      <div class="flex gap-2 flex-1 max-w-md">
        <input 
          type="text" 
          v-model="searchQuery" 
          @keyup.enter="handleSearch"
          placeholder="Search PO Number, External ID, or Vendor..." 
          class="input input-sm sm:input-md input-bordered w-full"
        />
        <button class="btn btn-sm sm:btn-md btn-primary" @click="handleSearch" :disabled="loading">
          <span v-if="loading" class="loading loading-spinner loading-xs"></span>
          Search
        </button>
        <button v-if="searchQuery" class="btn btn-sm sm:btn-md btn-ghost" @click="clearSearch" :disabled="loading">
          Clear
        </button>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <button 
          @click="cleanEmptyPurchases" 
          class="btn btn-sm btn-ghost text-warning hover:bg-warning/10 font-bold gap-1.5 shadow-xs"
          :disabled="cleaningEmpty"
          title="Scan and delete purchase orders that have 0 items"
        >
          <Icon icon="solar:broom-bold-duotone" class="w-4 h-4" />
          <span>{{ cleaningEmpty ? 'Cleaning...' : 'Clean Empty Orders' }}</span>
        </button>

        <button 
          v-if="undoBatch" 
          @click="handleUndoImport" 
          class="btn btn-sm btn-outline btn-error font-black gap-1.5 shadow-xs"
          :disabled="processingUndo"
          title="Roll back all items & POs created in the last import session"
        >
          <Icon icon="solar:restart-bold" class="w-4 h-4" />
          <span>{{ processingUndo ? 'Rolling back...' : `Rollback Last Import (${(undoBatch.items?.length || 0) + (undoBatch.purchases?.length || 0)})` }}</span>
        </button>

        <button @click="showImportModal = true" class="btn btn-sm btn-outline btn-primary font-black gap-2 shadow-xs">
          <Icon icon="solar:upload-track-bold-duotone" class="w-4 h-4" />
          Import SGW Report
        </button>
        <div class="text-xs font-bold opacity-60 hidden sm:block">
          {{ filteredPurchases.length }} Order(s)
        </div>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="table w-full">
        <thead class="bg-base-200/50">
          <tr>
            <th>PO Number</th>
            <th>External ID</th>
            <th class="cursor-pointer hover:bg-base-200 transition-colors" @click="toggleSort('date')">
              <div class="flex items-center gap-1">
                Date
                <span v-if="sortBy === 'date'" class="text-xs">{{ sortDesc ? '▼' : '▲' }}</span>
                <span v-else class="text-xs opacity-20">▼</span>
              </div>
            </th>
            <th class="hidden md:table-cell">Vendor</th>
            <th class="cursor-pointer hover:bg-base-200 transition-colors" @click="toggleSort('total')">
              <div class="flex items-center gap-1">
                Total
                <span v-if="sortBy === 'total'" class="text-xs">{{ sortDesc ? '▼' : '▲' }}</span>
                <span v-else class="text-xs opacity-20">▼</span>
              </div>
            </th>
            <th class="hidden md:table-cell">Status</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading && purchases.length === 0">
            <td colspan="7" class="text-center py-12">
              <span class="loading loading-spinner loading-lg text-primary"></span>
            </td>
          </tr>
          <tr v-else-if="filteredPurchases.length === 0">
            <td colspan="7" class="text-center py-12 text-base-content/50">
              No purchases found matching your criteria.
            </td>
          </tr>
          <tr v-else v-for="purchase in filteredPurchases" :key="purchase.$id" class="hover:bg-base-200/20 transition-colors">
            <td class="font-bold">
              <a :href="`/purchases/${purchase.$id}`" class="link link-primary link-hover flex items-center gap-1">
                <Icon icon="solar:document-text-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
                {{ purchase.poNumber || 'Pending' }}
              </a>
            </td>
            <td class="font-mono text-sm opacity-75">
              <a v-if="purchase.vendor?.toLowerCase().includes('goodwill') || purchase.orderId?.toString().match(/^\d+$/)" 
                 :href="getSgwUrl(purchase.orderId)" 
                 target="_blank" 
                 class="link link-hover flex items-center gap-1"
                 title="Open in ShopGoodwill">
                {{ purchase.orderId }}
                <Icon icon="solar:link-external-linear" class="w-3 h-3 opacity-50" />
              </a>
              <a v-else-if="purchase.orderId?.startsWith('http')"
                 :href="purchase.orderId"
                 target="_blank"
                 class="link link-hover flex items-center gap-1 text-primary"
                 title="Open External URL">
                {{ purchase.orderId.length > 35 ? purchase.orderId.substring(0, 32) + '...' : purchase.orderId }}
                <Icon icon="solar:link-external-linear" class="w-3 h-3 opacity-50" />
              </a>
              <span v-else>{{ purchase.orderId }}</span>
            </td>
            <td>{{ formatDate(purchase.purchaseDate, purchase.$createdAt) }}</td>
            <td class="hidden md:table-cell">
              <div class="badge badge-ghost">{{ purchase.vendor || 'Unknown' }}</div>
            </td>
            <td class="font-mono font-medium">${{ (purchase.grandTotal || 0).toFixed(2) }}</td>
            <td class="hidden md:table-cell">
              <div class="badge" :class="getStatusClass(purchase.status)">
                {{ purchase.status || 'Pending' }}
              </div>
            </td>
            <td class="text-right">
              <div class="flex items-center justify-end gap-1.5">
                <a 
                  :href="`/purchases/ingest?poId=${purchase.$id}`"
                  class="btn btn-xs btn-primary text-primary-content font-black gap-1 shadow-sm"
                  title="Ingest, Price & Tag Haul"
                >
                  <Icon icon="solar:box-minimalistic-bold" class="w-3.5 h-3.5" />
                  <span>Ingest</span>
                </a>
                <a 
                  :href="`/inventory?purchaseId=${encodeURIComponent(purchase.$id)}&orderId=${encodeURIComponent(purchase.orderId || '')}`" 
                  class="btn btn-xs btn-outline btn-secondary gap-1"
                  title="View all items for this order in Inventory"
                >
                  <Icon icon="solar:box-minimalistic-linear" class="w-3.5 h-3.5" />
                  <span>Items</span>
                </a>
                <a :href="`/purchases/${purchase.$id}`" class="btn btn-xs btn-ghost btn-square" title="View Purchase Details">
                  <Icon icon="solar:arrow-right-linear" class="w-4 h-4" />
                </a>
                <button 
                  @click="deletePurchaseOrder(purchase)" 
                  class="btn btn-xs btn-ghost btn-square text-error hover:bg-error/10" 
                  title="Delete this Purchase Order"
                >
                  <Icon icon="solar:trash-bin-trash-bold" class="w-3.5 h-3.5" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Bottom scroll spacer so bottom-most rows are never covered by dock -->
      <div class="h-28"></div>
    </div>

    <!-- Floating Scroll to Top & Count FAB (Floats in bottom-right corner out of the content area) -->
    <div v-if="filteredPurchases.length > 0" 
         class="fixed bottom-20 right-4 sm:right-8 z-40 transition-all hover:scale-105 active:scale-95 cursor-pointer select-none" 
         @click="scrollToTop">
      <div class="flex items-center gap-1.5 bg-base-200/95 text-base-content border border-base-content/25 shadow-2xl rounded-full px-3.5 py-2 font-black text-xs backdrop-blur-md hover:bg-base-300 transition-all">
        <span class="opacity-80">{{ filteredPurchases.length }}</span>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      </div>
    </div>

    <!-- Bulk Import Modal -->
    <BulkImport v-if="showImportModal" @close="showImportModal = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { purchasesAPI } from '../../lib/purchases';
import { Query } from 'appwrite';
import { databases, storage } from '../../lib/appwrite';
import { addToast } from '../../stores/toast';
import { confirmDialog } from '../../stores/confirm';
import { useLoader } from '../../composables/useLoader';
import { Icon } from '@iconify/vue';
import BulkImport from '../inventory/BulkImport.vue';

const { showLoader, hideLoader } = useLoader();

const purchases = ref([]);
const loading = ref(true);
const showImportModal = ref(false);
const undoBatch = ref(null);
const processingUndo = ref(false);

const searchQuery = ref('');
const sortBy = ref('date'); // 'date' or 'total'
const sortDesc = ref(true);

const toggleSort = (col) => {
    if (sortBy.value === col) {
        sortDesc.value = !sortDesc.value;
    } else {
        sortBy.value = col;
        sortDesc.value = true;
    }
};

const handleSearch = () => {
    // Handled reactively via filteredPurchases
};

const clearSearch = () => {
    searchQuery.value = '';
};

const getTimestamp = (p) => {
    if (p.purchaseDate) {
        const t = new Date(p.purchaseDate).getTime();
        if (!isNaN(t) && t > 0) return t;
    }
    if (p.$createdAt) {
        const t = new Date(p.$createdAt).getTime();
        if (!isNaN(t) && t > 0) return t;
    }
    return 0;
};

const filteredPurchases = computed(() => {
    let list = purchases.value || [];
    
    if (searchQuery.value && searchQuery.value.trim() !== '') {
        const q = searchQuery.value.trim().toLowerCase();
        list = list.filter(p => {
            const poMatch = (p.poNumber || '').toLowerCase().includes(q);
            const orderMatch = (p.orderId || '').toLowerCase().includes(q);
            const vendorMatch = (p.vendor || '').toLowerCase().includes(q);
            const idMatch = (p.$id || '').toLowerCase().includes(q);
            const trackingMatch = (p.trackingNumber || '').toLowerCase().includes(q);
            const statusMatch = (p.status || '').toLowerCase().includes(q);
            return poMatch || orderMatch || vendorMatch || idMatch || trackingMatch || statusMatch;
        });
    }

    list = [...list].sort((a, b) => {
        if (sortBy.value === 'date') {
            const da = getTimestamp(a);
            const db = getTimestamp(b);
            return sortDesc.value ? db - da : da - db;
        } else if (sortBy.value === 'total') {
            const ta = Number(a.grandTotal || 0);
            const tb = Number(b.grandTotal || 0);
            return sortDesc.value ? tb - ta : ta - tb;
        }
        return 0;
    });

    return list;
});

const loadPurchases = async () => {
    loading.value = true;
    showLoader("Loading Purchases...");
    
    try {
        const queries = [
            Query.orderDesc('$createdAt'),
            Query.limit(5000)
        ];
        
        const res = await purchasesAPI.listPurchases(queries);
        purchases.value = res.documents || [];
    } catch (e) {
        console.error('Failed to load purchases:', e);
    } finally {
        loading.value = false;
        hideLoader();
    }
};

const formatDate = (dateStr, fallbackDateStr) => {
    const raw = dateStr || fallbackDateStr;
    if (!raw) return 'N/A';
    try {
        const d = new Date(raw);
        if (isNaN(d.getTime())) return 'N/A';
        return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
    } catch {
        return 'N/A';
    }
};

const getSgwUrl = (orderId) => {
    if (!orderId) return '#';
    const str = orderId.toString().trim();
    if (str.startsWith('http')) return str;
    if (/^6\d{7}$/.test(str)) {
        return `https://shopgoodwill.com/shopgoodwill/order/${str}`;
    }
    return `https://shopgoodwill.com/item/${str}`;
};

const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
        case 'pending': return 'badge-warning';
        case 'ordered': return 'badge-info';
        case 'shipped': return 'badge-info';
        case 'received': return 'badge-success';
        case 'returned': return 'badge-error';
        case 'cancelled': return 'badge-error';
        default: return 'badge-ghost';
    }
};

const checkUndoBatch = () => {
    const saved = localStorage.getItem('lastImportBatch');
    if (saved) {
        try {
            undoBatch.value = JSON.parse(saved);
        } catch(e) {}
    } else {
        undoBatch.value = null;
    }
};

const handleUndoImport = async () => {
    if (!undoBatch.value) return;
    const itemsCount = undoBatch.value.items?.length || 0;
    const purchasesCount = undoBatch.value.purchases?.length || 0;
    
    const ok = await confirmDialog(
        `Are you sure you want to permanently delete the ${itemsCount} items and ${purchasesCount} purchase orders created in the last import?`,
        'Rollback Last Import',
        'Rollback',
        'Cancel',
        'btn-error'
    );
    if (!ok) return;
    
    processingUndo.value = true;
    showLoader("Rolling back last import...");
    
    const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID;
    const ITEMS_COL = import.meta.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items';
    const PURCHASES_COL = import.meta.env.PUBLIC_APPWRITE_CARTS_COL || import.meta.env.PUBLIC_APPWRITE_PURCHASES_COL || 'carts';
    const BUCKET_ID = import.meta.env.PUBLIC_APPWRITE_STORAGE_BUCKET_ID || 'item-photos';

    try {
        for (const id of (undoBatch.value.items || [])) {
            try { await databases.deleteDocument(DB_ID, ITEMS_COL, id); } catch(e) {}
        }
        for (const id of (undoBatch.value.purchases || [])) {
            try { await databases.deleteDocument(DB_ID, PURCHASES_COL, id); } catch(e) {}
        }
        for (const id of (undoBatch.value.assets || [])) {
            try { await storage.deleteFile(BUCKET_ID, id); } catch(e) {}
        }
        
        localStorage.removeItem('lastImportBatch');
        undoBatch.value = null;
        addToast('The previous import has been fully rolled back!', 'success');
        await loadPurchases();
    } catch(e) {
        addToast(`Rollback failed: ${e.message}`, 'error');
    } finally {
        processingUndo.value = false;
        hideLoader();
    }
};

const cleaningEmpty = ref(false);

const deletePurchaseOrder = async (purchase) => {
    const label = purchase.poNumber || purchase.orderId || purchase.$id;
    const ok = await confirmDialog(
        `Delete Purchase Order "${label}"? (Active inventory items will not be affected).`,
        'Delete Purchase Order',
        'Delete',
        'Cancel',
        'btn-error'
    );
    if (!ok) return;
    
    showLoader(`Deleting ${label}...`);
    try {
        await purchasesAPI.deletePurchase(purchase.$id);
        addToast(`Deleted Purchase Order "${label}"`, 'success');
        await loadPurchases();
    } catch(e) {
        addToast(`Failed to delete PO: ${e.message}`, 'error');
    } finally {
        hideLoader();
    }
};

const cleanEmptyPurchases = async () => {
    cleaningEmpty.value = true;
    showLoader("Scanning Purchase Orders & Inventory Items...");
    
    const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID;
    const ITEMS_COL = import.meta.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items';
    
    try {
        // 1. Fetch all known items to gather linked purchaseIds and cartIds
        const activePurchaseIds = new Set();

        let offset = 0;
        let keepFetching = true;
        while (keepFetching) {
            const itemRes = await databases.listDocuments(DB_ID, ITEMS_COL, [
                Query.limit(100),
                Query.offset(offset),
                Query.select(['purchaseId', 'cartId'])
            ]);
            itemRes.documents.forEach(doc => {
                if (doc.purchaseId) activePurchaseIds.add(String(doc.purchaseId).trim());
                if (doc.cartId) activePurchaseIds.add(String(doc.cartId).trim());
            });
            offset += itemRes.documents.length;
            if (itemRes.documents.length < 100 || offset >= 5000) {
                keepFetching = false;
            }
        }

        // 2. Identify POs with 0 active items
        const emptyPOs = purchases.value.filter(p => {
            const hasPurchaseId = activePurchaseIds.has(p.$id);
            const hasCartId = p.orderId && activePurchaseIds.has(String(p.orderId).trim());
            return !hasPurchaseId && !hasCartId;
        });

        if (emptyPOs.length === 0) {
            addToast('All Purchase Orders have active items attached! No empty orders found.', 'info');
            return;
        }

        const ok = await confirmDialog(
            `Found ${emptyPOs.length} empty purchase orders with 0 items. Permanently remove them now?`,
            'Clean Empty Orders',
            'Clean All',
            'Cancel',
            'btn-warning'
        );
        if (!ok) return;

        showLoader(`Deleting ${emptyPOs.length} empty purchase orders...`);
        let deletedCount = 0;
        for (const po of emptyPOs) {
            try {
                await purchasesAPI.deletePurchase(po.$id);
                deletedCount++;
            } catch(e) {
                console.error('Failed to delete PO:', po.$id, e);
            }
        }

        addToast(`Successfully removed ${deletedCount} empty purchase orders!`, 'success');
        await loadPurchases();
    } catch(e) {
        console.error('Cleanup failed:', e);
        addToast(`Cleanup error: ${e.message}`, 'error');
    } finally {
        cleaningEmpty.value = false;
        hideLoader();
    }
};

onMounted(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('search')) {
        searchQuery.value = params.get('search') || '';
    }
    checkUndoBatch();
    loadPurchases();
});
</script>

<template>
  <div class="space-y-4">
    <!-- SEARCH & CONTROLS TOOLBAR (CLEAN & MOBILE-FIRST) -->
    <div class="card bg-base-100 shadow-md border border-base-200 p-3 sm:p-4">
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        
        <!-- DaisyUI Connected Search Input + Button Group (.join) -->
        <div class="join w-full shadow-xs">
          <div class="relative flex-1 join-item">
            <Icon icon="solar:magnifer-linear" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" />
            <input 
              type="text" 
              v-model="searchQuery" 
              @keyup.enter="handleSearch"
              placeholder="Search PO Number, External Order ID, Vendor..." 
              class="input input-bordered join-item w-full pl-10 pr-9 text-sm min-h-[44px]"
            />
            <button 
              v-if="searchQuery" 
              @click="clearSearch" 
              class="absolute right-2.5 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle opacity-60 hover:opacity-100 min-h-[28px] min-w-[28px]"
              title="Clear search"
            >
              ✕
            </button>
          </div>
          
          <button 
            @click="handleSearch" 
            class="btn btn-primary join-item text-primary-content font-black px-4 min-h-[44px] shrink-0 gap-1.5 active:scale-95 transition-all"
            :disabled="loading"
            title="Execute Search"
          >
            <Icon icon="solar:magnifer-bold" class="w-4 h-4" />
            <span class="hidden sm:inline">Search</span>
          </button>
        </div>
      </div>
    </div>

    <!-- LOADING STATE -->
    <div v-if="loading && purchases.length === 0" class="flex flex-col items-center justify-center py-16 gap-3">
      <span class="loading loading-spinner loading-lg text-primary"></span>
      <span class="text-xs font-bold opacity-60">Loading Purchases...</span>
    </div>

    <!-- EMPTY STATE -->
    <div v-else-if="filteredPurchases.length === 0" class="card bg-base-100 shadow-md border border-base-200 p-8 text-center space-y-2">
      <Icon icon="solar:box-minimalistic-linear" class="w-12 h-12 mx-auto text-base-content/30" />
      <h3 class="font-bold text-base">No Purchases Found</h3>
      <p class="text-xs text-base-content/60">No purchases match your search or filter criteria.</p>
    </div>

    <!-- 1. MOBILE CARD VIEW (VISIBLE ON MOBILE & TABLET < MD) -->
    <div v-else class="block md:hidden space-y-3">
      <div 
        v-for="purchase in filteredPurchases" 
        :key="purchase.$id"
        class="card bg-base-100 shadow-md border border-base-200/80 hover:border-primary/40 transition-all rounded-2xl p-3.5 space-y-3"
      >
        <!-- Card Header: PO Number + Price + Status -->
        <div class="flex items-start justify-between gap-2">
          <div class="space-y-0.5">
            <a :href="`/purchases/${purchase.$id}`" class="link link-primary font-black text-base flex items-center gap-1.5">
              <Icon icon="solar:document-text-bold-duotone" class="w-4 h-4 shrink-0 text-primary" />
              <span>{{ purchase.poNumber || 'PO-Pending' }}</span>
            </a>
            <div class="text-[11px] font-medium opacity-60 flex items-center gap-1">
              <Icon icon="solar:calendar-linear" class="w-3 h-3" />
              <span>{{ formatDate(purchase.purchaseDate, purchase.$createdAt) }}</span>
            </div>
          </div>

          <div class="text-right space-y-1">
            <div class="font-mono font-black text-lg text-base-content leading-none">
              ${{ (purchase.grandTotal || 0).toFixed(2) }}
            </div>
            <div class="badge badge-sm font-bold" :class="getStatusClass(purchase.status)">
              {{ purchase.status || 'Pending' }}
            </div>
          </div>
        </div>

        <!-- Vendor & External Order ID -->
        <div class="flex items-center justify-between gap-2 bg-base-200/50 rounded-xl px-3 py-2 text-xs">
          <div class="flex items-center gap-1.5 text-base-content/80 font-bold truncate">
            <Icon icon="solar:shop-2-linear" class="w-3.5 h-3.5 shrink-0 opacity-60" />
            <span class="truncate">{{ purchase.vendor || 'Unknown Vendor' }}</span>
          </div>

          <div class="shrink-0 font-mono text-[11px]">
            <a v-if="purchase.vendor?.toLowerCase().includes('goodwill') || purchase.orderId?.toString().match(/^\d+$/)" 
               :href="getSgwUrl(purchase.orderId)" 
               target="_blank" 
               class="link link-primary font-bold flex items-center gap-1"
               title="Open in ShopGoodwill">
              #{{ purchase.orderId }}
              <Icon icon="solar:link-external-linear" class="w-3 h-3 opacity-60" />
            </a>
            <span v-else class="opacity-60">#{{ purchase.orderId || '—' }}</span>
          </div>
        </div>

        <!-- Touch Actions: Ingest, Items, Details, Delete -->
        <div class="flex items-center gap-2 pt-1 border-t border-base-200/60">
          <a 
            :href="`/purchases/ingest?poId=${purchase.$id}`"
            class="btn btn-sm btn-primary text-primary-content font-black flex-1 rounded-xl shadow-xs gap-1.5 min-h-[38px]"
            title="Receive & Tag Haul"
          >
            <Icon icon="solar:box-minimalistic-bold" class="w-4 h-4" />
            <span>Receive</span>
          </a>

          <a 
            :href="`/inventory?purchaseId=${encodeURIComponent(purchase.$id)}&orderId=${encodeURIComponent(purchase.orderId || '')}`" 
            class="btn btn-sm btn-outline btn-secondary font-bold flex-1 rounded-xl gap-1 min-h-[38px]"
            title="View Items in Inventory"
          >
            <Icon icon="solar:box-minimalistic-linear" class="w-4 h-4" />
            <span>Items</span>
          </a>

          <a 
            :href="`/purchases/${purchase.$id}`" 
            class="btn btn-sm btn-ghost bg-base-200/50 hover:bg-base-200 btn-square rounded-xl min-h-[38px] w-10" 
            title="View Details"
          >
            <Icon icon="solar:arrow-right-linear" class="w-4 h-4" />
          </a>

          <button 
            @click="deletePurchaseOrder(purchase)" 
            class="btn btn-sm btn-ghost text-error hover:bg-error/10 btn-square rounded-xl min-h-[38px] w-10" 
            title="Delete this Purchase Order"
          >
            <Icon icon="solar:trash-bin-trash-bold" class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- 2. DESKTOP TABLE VIEW (VISIBLE ON MD AND LARGER SCREENS) -->
    <div class="hidden md:block card bg-base-100 shadow-xl border border-base-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="table table-zebra w-full">
          <thead class="bg-base-200/70 text-xs font-black uppercase tracking-wider text-base-content/80">
            <tr>
              <th class="w-40 py-3.5 px-4 whitespace-nowrap">PO Number</th>
              <th class="w-44 py-3.5 px-4 whitespace-nowrap">External ID</th>
              <th class="w-32 py-3.5 px-4 whitespace-nowrap cursor-pointer hover:bg-base-200 transition-colors" @click="toggleSort('date')">
                <div class="flex items-center gap-1.5">
                  Date
                  <span v-if="sortBy === 'date'" class="text-xs font-black">{{ sortDesc ? '▼' : '▲' }}</span>
                  <span v-else class="text-xs opacity-20">▼</span>
                </div>
              </th>
              <th class="w-40 py-3.5 px-4 whitespace-nowrap">Vendor</th>
              <th class="w-28 py-3.5 px-4 whitespace-nowrap text-right cursor-pointer hover:bg-base-200 transition-colors" @click="toggleSort('total')">
                <div class="flex items-center justify-end gap-1.5">
                  Total
                  <span v-if="sortBy === 'total'" class="text-xs font-black">{{ sortDesc ? '▼' : '▲' }}</span>
                  <span v-else class="text-xs opacity-20">▼</span>
                </div>
              </th>
              <th class="w-32 py-3.5 px-4 whitespace-nowrap text-center">Status</th>
              <th class="w-60 py-3.5 px-4 whitespace-nowrap text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="purchase in filteredPurchases" :key="purchase.$id" class="hover:bg-base-200/40 transition-colors">
              <!-- PO Number -->
              <td class="py-3 px-4 font-bold whitespace-nowrap">
                <a :href="`/purchases/${purchase.$id}`" class="link link-primary link-hover flex items-center gap-1.5 font-mono text-sm">
                  <Icon icon="solar:document-text-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
                  <span>{{ purchase.poNumber || 'PO-Pending' }}</span>
                </a>
              </td>

              <!-- External ID -->
              <td class="py-3 px-4 font-mono text-xs opacity-85 whitespace-nowrap">
                <a v-if="purchase.vendor?.toLowerCase().includes('goodwill') || purchase.orderId?.toString().match(/^\d+$/)" 
                   :href="getSgwUrl(purchase.orderId)" 
                   target="_blank" 
                   class="link link-primary link-hover flex items-center gap-1 font-bold"
                   title="Open in ShopGoodwill">
                  <span>#{{ purchase.orderId }}</span>
                  <Icon icon="solar:link-external-linear" class="w-3 h-3 opacity-60 shrink-0" />
                </a>
                <a v-else-if="purchase.orderId?.startsWith('http')"
                   :href="purchase.orderId"
                   target="_blank"
                   class="link link-hover flex items-center gap-1 text-primary truncate max-w-[160px]"
                   title="Open External URL">
                  <span class="truncate">{{ purchase.orderId.length > 25 ? purchase.orderId.substring(0, 22) + '...' : purchase.orderId }}</span>
                  <Icon icon="solar:link-external-linear" class="w-3 h-3 opacity-60 shrink-0" />
                </a>
                <span v-else class="truncate max-w-[160px] inline-block">{{ purchase.orderId || '—' }}</span>
              </td>

              <!-- Date -->
              <td class="py-3 px-4 text-xs font-medium whitespace-nowrap">
                {{ formatDate(purchase.purchaseDate, purchase.$createdAt) }}
              </td>

              <!-- Vendor -->
              <td class="py-3 px-4 whitespace-nowrap">
                <div class="badge badge-ghost font-bold text-xs truncate max-w-[140px]">
                  {{ purchase.vendor || 'Unknown' }}
                </div>
              </td>

              <!-- Total -->
              <td class="py-3 px-4 font-mono font-black text-sm text-right whitespace-nowrap text-base-content">
                ${{ (purchase.grandTotal || 0).toFixed(2) }}
              </td>

              <!-- Status -->
              <td class="py-3 px-4 text-center whitespace-nowrap">
                <div class="badge badge-sm font-bold uppercase tracking-wider text-[10px]" :class="getStatusClass(purchase.status)">
                  {{ purchase.status || 'Pending' }}
                </div>
              </td>

              <!-- Actions -->
              <td class="py-3 px-4 text-right whitespace-nowrap">
                <div class="flex items-center justify-end gap-1.5">
                  <a 
                    :href="`/purchases/ingest?poId=${purchase.$id}`"
                    class="btn btn-xs btn-primary text-primary-content font-black gap-1 shadow-xs px-2.5 h-8 rounded-lg"
                    title="Receive, Price & Tag Haul"
                  >
                    <Icon icon="solar:box-minimalistic-bold" class="w-3.5 h-3.5" />
                    <span>Receive</span>
                  </a>

                  <a 
                    :href="`/inventory?purchaseId=${encodeURIComponent(purchase.$id)}&orderId=${encodeURIComponent(purchase.orderId || '')}`" 
                    class="btn btn-xs btn-outline btn-secondary font-bold gap-1 px-2.5 h-8 rounded-lg"
                    title="View all items for this order in Inventory"
                  >
                    <Icon icon="solar:box-minimalistic-linear" class="w-3.5 h-3.5" />
                    <span>Items</span>
                  </a>

                  <a 
                    :href="`/purchases/${purchase.$id}`" 
                    class="btn btn-xs btn-ghost hover:bg-base-200 btn-square h-8 w-8 rounded-lg" 
                    title="View Purchase Details"
                  >
                    <Icon icon="solar:arrow-right-linear" class="w-4 h-4" />
                  </a>

                  <button 
                    @click="deletePurchaseOrder(purchase)" 
                    class="btn btn-xs btn-ghost text-error hover:bg-error/10 btn-square h-8 w-8 rounded-lg" 
                    title="Delete this Purchase Order"
                  >
                    <Icon icon="solar:trash-bin-trash-bold" class="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
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

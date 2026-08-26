<template>
  <div class="card bg-base-100 shadow-xl border border-base-200">
    <div class="p-4 border-b border-base-200 bg-base-100 flex gap-4 sticky top-0 z-10 shadow-sm rounded-t-2xl">
      <input 
        type="text" 
        v-model="searchQuery" 
        @keyup.enter="handleSearch"
        placeholder="Search PO Number, External ID, or Vendor..." 
        class="input input-bordered w-full max-w-md"
      />
      <button class="btn btn-primary" @click="handleSearch" :disabled="loading">
        <span v-if="loading" class="loading loading-spinner loading-xs"></span>
        Search
      </button>
      <button v-if="searchQuery" class="btn btn-ghost" @click="clearSearch" :disabled="loading">
        Clear
      </button>
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
          <tr v-else-if="purchases.length === 0">
            <td colspan="7" class="text-center py-12 text-base-content/50">
              No purchases found matching your criteria.
            </td>
          </tr>
          <tr v-else v-for="purchase in purchases" :key="purchase.$id" class="hover:bg-base-200/20 transition-colors">
            <td class="font-bold">
              <a :href="`/purchases/${purchase.$id}`" class="link link-primary link-hover flex items-center gap-1">
                <Icon icon="solar:document-text-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
                {{ purchase.poNumber || 'Pending' }}
              </a>
            </td>
            <td class="font-mono text-sm opacity-75">
              <a v-if="purchase.vendor?.toLowerCase() === 'shopgoodwill'" 
                 :href="purchase.orderId?.toString().match(/^\\d{9}$/) ? `https://shopgoodwill.com/item/${purchase.orderId}` : `https://shopgoodwill.com/shopgoodwill/order/${purchase.orderId}`" 
                 target="_blank" 
                 class="link link-hover flex items-center gap-1"
                 title="Open in ShopGoodwill">
                {{ purchase.orderId }}
                <Icon icon="solar:link-external-linear" class="w-3 h-3 opacity-50" />
              </a>
              <span v-else>{{ purchase.orderId }}</span>
            </td>
            <td>{{ formatDate(purchase.purchaseDate) }}</td>
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
                  :href="`/inventory?search=${encodeURIComponent(purchase.orderId || purchase.poNumber || '')}`" 
                  class="btn btn-xs btn-outline btn-secondary gap-1"
                  title="View all items for this order in Inventory"
                >
                  <Icon icon="solar:box-minimalistic-linear" class="w-3.5 h-3.5" />
                  <span>Items</span>
                </a>
                <a :href="`/purchases/${purchase.$id}`" class="btn btn-xs btn-ghost btn-square" title="View Purchase Details">
                  <Icon icon="solar:arrow-right-linear" class="w-4 h-4" />
                </a>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <div v-if="hasMore" class="p-4 flex justify-center border-t border-base-200">
      <button class="btn btn-outline btn-sm" @click="loadPurchases(true)" :disabled="loadingMore">
        <span v-if="loadingMore" class="loading loading-spinner loading-xs"></span>
        Load More Orders
      </button>
    </div>
    
    <!-- Floating Total Count / Scroll to Top -->
    <div v-if="totalResults !== null" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 transition-transform hover:-translate-y-1 cursor-pointer shadow-xl rounded-full" @click="scrollToTop">
      <span class="badge badge-lg badge-primary border-none shadow-md px-6 py-4 font-bold text-sm flex gap-2 items-center">
        {{ totalResults }} Purchases <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { purchasesAPI } from '../../lib/purchases';
import { Query } from 'appwrite';
import { useLoader } from '../../composables/useLoader';
import { Icon } from '@iconify/vue';

const { showLoader, hideLoader } = useLoader();
showLoader("Loading Purchases...");

const purchases = ref([]);
const loading = ref(true);
const loadingMore = ref(false);
const hasMore = ref(false);
const totalResults = ref(null);

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
    loadPurchases(false);
};

const handleSearch = () => {
    loadPurchases(false);
};

const clearSearch = () => {
    searchQuery.value = '';
    loadPurchases(false);
};

const loadPurchases = async (isLoadMore = false) => {
    if (isLoadMore) {
        loadingMore.value = true;
    } else {
        loading.value = true;
        if (!isLoadMore) purchases.value = [];
    }
    
    try {
        const queries = [Query.limit(5000)];
        
        if (sortBy.value === 'date') {
            queries.push(sortDesc.value ? Query.orderDesc('purchaseDate') : Query.orderAsc('purchaseDate'));
        } else if (sortBy.value === 'total') {
            queries.push(sortDesc.value ? Query.orderDesc('grandTotal') : Query.orderAsc('grandTotal'));
        }
        
        // Appwrite search across multiple attributes natively usually requires full-text index or multiple queries.
        // For simple substring search we might need OR queries. 
        // As a workaround, we can fetch all or rely on a specific search if implemented in the backend.
        // Actually, if we want to search `poNumber`, `orderId`, or `vendor`, we can use `Query.search()` if indexes exist,
        // OR we can just use `Query.contains` or `Query.equal` wrapped in `Query.or()`.
        if (searchQuery.value.trim() !== '') {
            const term = searchQuery.value.trim();
            queries.push(
                Query.or([
                    Query.equal('poNumber', term),
                    Query.equal('orderId', term),
                    Query.contains('vendor', term)
                ])
            );
        }
        
        if (isLoadMore && purchases.value.length > 0) {
            queries.push(Query.cursorAfter(purchases.value[purchases.value.length - 1].$id));
        }
        
        const res = await purchasesAPI.listPurchases(queries);
        
        if (isLoadMore) {
            purchases.value = [...purchases.value, ...res.documents];
        } else {
            purchases.value = res.documents;
        }
        
        totalResults.value = res.total;
        hasMore.value = res.documents.length === 5000;
    } catch (e) {
        console.error(e);
    } finally {
        loading.value = false;
        loadingMore.value = false;
        hideLoader();
    }
};

const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    // Prevent timezone shifting by extracting the local date string
    const datePart = dateStr.split('T')[0];
    const [year, month, day] = datePart.split('-');
    return `${parseInt(month)}/${parseInt(day)}/${year}`;
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

const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

onMounted(() => {
    loadPurchases();
});
</script>

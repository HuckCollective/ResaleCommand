<template>
  <div class="card bg-base-100 shadow-xl overflow-hidden border border-base-200">
    <div class="p-4 border-b border-base-200 bg-base-100 flex gap-4">
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
            <th>Vendor</th>
            <th class="cursor-pointer hover:bg-base-200 transition-colors" @click="toggleSort('total')">
              <div class="flex items-center gap-1">
                Total
                <span v-if="sortBy === 'total'" class="text-xs">{{ sortDesc ? '▼' : '▲' }}</span>
                <span v-else class="text-xs opacity-20">▼</span>
              </div>
            </th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading && purchases.length === 0">
            <td colspan="6" class="text-center py-12">
              <span class="loading loading-spinner loading-lg text-primary"></span>
            </td>
          </tr>
          <tr v-else-if="purchases.length === 0">
            <td colspan="6" class="text-center py-12 text-base-content/50">
              No purchases found matching your criteria.
            </td>
          </tr>
          <tr v-else v-for="purchase in purchases" :key="purchase.$id" class="hover:bg-base-200/20 transition-colors">
            <td class="font-bold">
              <a :href="`/purchases/${purchase.$id}`" class="link link-primary link-hover">{{ purchase.poNumber || 'Pending' }}</a>
            </td>
            <td class="font-mono text-sm opacity-75">
              <a v-if="purchase.vendor?.toLowerCase() === 'shopgoodwill'" 
                 :href="`https://shopgoodwill.com/shopgoodwill/order/${purchase.orderId}`" 
                 target="_blank" 
                 class="link link-hover flex items-center gap-1"
                 title="Open Order in ShopGoodwill">
                {{ purchase.orderId }}
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <span v-else>{{ purchase.orderId }}</span>
            </td>
            <td>{{ formatDate(purchase.purchaseDate) }}</td>
            <td>
              <div class="badge badge-ghost">{{ purchase.vendor || 'Unknown' }}</div>
            </td>
            <td class="font-mono font-medium">${{ (purchase.grandTotal || 0).toFixed(2) }}</td>
            <td>
              <div class="badge" :class="getStatusClass(purchase.status)">
                {{ purchase.status || 'Pending' }}
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { purchasesAPI } from '../../lib/purchases';
import { Query } from 'appwrite';

const purchases = ref([]);
const loading = ref(true);
const loadingMore = ref(false);
const hasMore = ref(false);

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
        const queries = [Query.limit(50)];
        
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
        
        hasMore.value = res.documents.length === 50;
    } catch (e) {
        console.error(e);
    } finally {
        loading.value = false;
        loadingMore.value = false;
    }
};

const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString();
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

onMounted(() => {
    loadPurchases();
});
</script>

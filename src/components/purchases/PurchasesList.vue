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
              <a v-if="purchase.vendor?.toLowerCase() === 'shopgoodwill'" 
                 :href="purchase.orderId?.toString().match(/^\d{9}$/) ? `https://shopgoodwill.com/item/${purchase.orderId}` : `https://shopgoodwill.com/shopgoodwill/order/${purchase.orderId}`" 
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
                  :href="`/inventory?search=${encodeURIComponent(purchase.orderId || purchase.poNumber || '')}&purchaseId=${encodeURIComponent(purchase.$id)}`" 
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
    
    <!-- Floating Total Count / Scroll to Top -->
    <div v-if="filteredPurchases.length > 0" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 transition-transform hover:-translate-y-1 cursor-pointer shadow-xl rounded-full" @click="scrollToTop">
      <span class="badge badge-lg badge-primary border-none shadow-md px-6 py-4 font-bold text-sm flex gap-2 items-center">
        {{ filteredPurchases.length }} Purchases <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { purchasesAPI } from '../../lib/purchases';
import { Query } from 'appwrite';
import { useLoader } from '../../composables/useLoader';
import { Icon } from '@iconify/vue';

const { showLoader, hideLoader } = useLoader();

const purchases = ref([]);
const loading = ref(true);

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
            const da = new Date(a.purchaseDate || 0).getTime();
            const db = new Date(b.purchaseDate || 0).getTime();
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
            Query.orderDesc('purchaseDate'),
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

const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
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
    const params = new URLSearchParams(window.location.search);
    if (params.has('search')) {
        searchQuery.value = params.get('search') || '';
    }
    loadPurchases();
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h1 class="text-4xl font-black text-base-content tracking-tight flex items-center gap-3">
          <Icon icon="solar:dollar-bold-duotone" class="w-9 h-9 text-success" />
          Sales & Realized Revenue
        </h1>
        <p class="text-base-content/70 mt-1">
          Track sold items, calculate platform commissions, and monitor net payouts across all locations.
        </p>
      </div>
      <div class="flex gap-2 flex-wrap">
        <a href="/warehouse/sync" class="btn btn-outline btn-secondary gap-1.5 shadow-sm font-bold">
          <Icon icon="solar:round-transfer-horizontal-bold-duotone" class="w-4 h-4" />
          Location Sync
        </a>
        <a href="/sales/new" class="btn btn-primary gap-1.5 shadow-lg shadow-primary/20 font-bold">
          <Icon icon="solar:add-circle-bold" class="w-4 h-4" />
          Record Sale
        </a>
      </div>
    </div>

    <!-- Loader -->
    <div v-if="loading" class="flex justify-center p-16">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="alert alert-error shadow-sm">
      <Icon icon="solar:danger-circle-bold" class="w-6 h-6 shrink-0" />
      <span>{{ error }}</span>
      <button class="btn btn-xs ml-auto" @click="fetchData">Retry</button>
    </div>

    <!-- Main Content when loaded -->
    <div v-else class="space-y-6">
      
      <!-- Metrics Overview Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-base-100 p-5 rounded-2xl border border-base-200 shadow-sm">
          <div class="flex items-center gap-3">
            <div class="p-3 bg-success/10 text-success rounded-xl">
              <Icon icon="solar:dollar-bold" class="w-6 h-6" />
            </div>
            <div>
              <div class="text-xs uppercase font-bold opacity-60">Gross Sales</div>
              <div class="text-2xl font-black font-mono text-success">{{ formatCurrency(totalGross) }}</div>
            </div>
          </div>
        </div>

        <div class="bg-base-100 p-5 rounded-2xl border border-base-200 shadow-sm">
          <div class="flex items-center gap-3">
            <div class="p-3 bg-primary/10 text-primary rounded-xl">
              <Icon icon="solar:wallet-money-bold" class="w-6 h-6" />
            </div>
            <div>
              <div class="text-xs uppercase font-bold opacity-60">Net Payout</div>
              <div class="text-2xl font-black font-mono text-primary">{{ formatCurrency(totalNet) }}</div>
            </div>
          </div>
        </div>

        <div class="bg-base-100 p-5 rounded-2xl border border-base-200 shadow-sm">
          <div class="flex items-center gap-3">
            <div class="p-3 bg-error/10 text-error rounded-xl">
              <Icon icon="solar:ticket-sale-bold" class="w-6 h-6" />
            </div>
            <div>
              <div class="text-xs uppercase font-bold opacity-60">Total Fees / Comm.</div>
              <div class="text-2xl font-black font-mono text-error">{{ formatCurrency(totalFees) }}</div>
            </div>
          </div>
        </div>

        <div class="bg-base-100 p-5 rounded-2xl border border-base-200 shadow-sm">
          <div class="flex items-center gap-3">
            <div class="p-3 bg-info/10 text-info rounded-xl">
              <Icon icon="solar:box-bold" class="w-6 h-6" />
            </div>
            <div>
              <div class="text-xs uppercase font-bold opacity-60">Items Sold</div>
              <div class="text-2xl font-black font-mono text-info">{{ consolidatedSales.length }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Search and Location Filters -->
      <div class="bg-base-100 p-4 rounded-xl border border-base-200 shadow-sm flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div class="relative flex-1 max-w-md">
          <Icon icon="solar:magnifer-linear" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="Search sale by item title, UPC, SKU, SO#..." 
            class="input input-bordered input-sm pl-9 w-full font-mono text-xs" 
          />
          <button v-if="searchQuery" @click="searchQuery = ''" class="btn btn-xs btn-ghost btn-circle absolute right-2 top-1/2 -translate-y-1/2">✕</button>
        </div>

        <div class="flex items-center gap-2">
          <select v-model="locationFilter" class="select select-bordered select-sm text-xs font-bold">
            <option value="all">All Locations</option>
            <option v-for="wh in warehouses" :key="wh.$id" :value="wh.name">{{ wh.name }}</option>
          </select>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="displayedSales.length === 0" class="card bg-base-100 shadow-xl border border-base-200">
        <div class="card-body text-center py-16">
          <div class="flex justify-center mb-4">
            <div class="p-4 bg-primary/10 rounded-full text-primary">
              <Icon icon="solar:box-minimalistic-linear" class="w-10 h-10 opacity-60" />
            </div>
          </div>
          <h3 class="text-xl font-bold">No Sales Matching Filter</h3>
          <p class="opacity-70 mt-2 max-w-md mx-auto">
            {{ searchQuery || locationFilter !== 'all' ? 'Try adjusting your search query or location filter.' : 'Start recording sales or sync from your location booth CSV.' }}
          </p>
          <div class="mt-6 flex justify-center gap-3">
            <a href="/warehouse/sync" class="btn btn-outline btn-secondary font-bold">Sync Location CSV</a>
            <a href="/sales/new" class="btn btn-primary font-bold">Record First Sale</a>
          </div>
        </div>
      </div>

      <!-- Sales Table -->
      <div v-else class="card bg-base-100 shadow-xl overflow-hidden border border-base-200">
        <div class="overflow-x-auto">
          <table class="table table-zebra w-full table-sm">
            <thead>
              <tr class="bg-base-200 text-xs uppercase tracking-wider">
                <th>Item / SO #</th>
                <th>Location</th>
                <th>Sale Date</th>
                <th>Status</th>
                <th class="text-right">Gross Price</th>
                <th class="text-right">Fees</th>
                <th class="text-right font-bold">Net Payout</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="sale in displayedSales" :key="sale.uniqueKey" class="hover">
                <td>
                  <div class="flex items-center gap-3">
                    <div>
                      <div class="font-bold text-xs truncate max-w-xs" :title="sale.title">
                        {{ sale.title }}
                      </div>
                      <div class="flex items-center gap-1.5 mt-0.5">
                        <span class="font-mono text-[10px] text-primary font-bold bg-primary/10 px-1.5 py-0.5 rounded">
                          {{ sale.soNumber }}
                        </span>
                        <span v-if="sale.upc" class="font-mono text-[10px] opacity-70 bg-base-200 px-1.5 py-0.5 rounded">
                          UPC: {{ sale.upc }}
                        </span>
                        <span v-if="sale.sku" class="font-mono text-[10px] text-secondary font-bold bg-secondary/10 px-1.5 py-0.5 rounded">
                          SKU: {{ sale.sku }}
                        </span>
                      </div>
                    </div>
                  </div>
                </td>

                <td>
                  <span class="badge badge-sm badge-outline font-semibold">
                    {{ sale.locationName }}
                  </span>
                </td>

                <td class="font-mono text-xs opacity-75">
                  {{ sale.date ? new Date(sale.date).toLocaleDateString() : 'N/A' }}
                </td>

                <td>
                  <span class="badge badge-sm font-bold" :class="getStatusClass(sale.status)">
                    {{ sale.status }}
                  </span>
                </td>

                <td class="text-right font-mono font-bold text-xs text-base-content">
                  {{ formatCurrency(sale.grossAmount) }}
                </td>

                <td class="text-right font-mono text-xs text-error">
                  {{ formatCurrency(sale.fees) }}
                </td>

                <td class="text-right font-mono font-bold text-xs text-success">
                  {{ formatCurrency(sale.netPayout) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useAuth } from '../../composables/useAuth';
import { useInventory } from '../../composables/useInventory';
import { salesApi } from '../../lib/sales';
import { warehousesApi } from '../../lib/warehouses';
import { client } from '../../lib/appwrite';
import type { SaleDocument } from '../../lib/sales';
import type { WarehouseDocument } from '../../lib/warehouses';

const { currentTeam } = useAuth();
const { inventoryItems, fetchInventory } = useInventory();

const sales = ref<SaleDocument[]>([]);
const warehouses = ref<WarehouseDocument[]>([]);
const loading = ref(true);
const error = ref('');
const searchQuery = ref('');
const locationFilter = ref('all');

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

const getStatusClass = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'draft') return 'badge-neutral';
  if (s === 'sold' || s === 'paid') return 'badge-success text-white';
  if (s === 'shipped') return 'badge-primary';
  if (s === 'delivered') return 'badge-info';
  if (s === 'returned' || s === 'refunded') return 'badge-error';
  return 'badge-ghost';
};

const getWarehouseName = (warehouseId: string) => {
  const wh = warehouses.value.find(w => w.$id === warehouseId || w.name.toLowerCase() === warehouseId.toLowerCase());
  return wh ? wh.name : (warehouseId || 'General Location');
};

const getCommissionRate = (locNameOrId: string) => {
  if (!locNameOrId) return 0;
  const target = locNameOrId.toLowerCase().replace(/[^a-z0-9]/g, '');
  const wh = warehouses.value.find(w => 
    w.$id === locNameOrId || 
    w.name.toLowerCase().replace(/[^a-z0-9]/g, '') === target
  );
  return wh?.commissionRate || 0;
};

// Consolidated list combining sales collection documents & sold items from inventory
const consolidatedSales = computed(() => {
  const list: any[] = [];
  const linkedSaleIds = new Set<string>();
  const linkedItemIds = new Set<string>();

  // 1. Process official sales collection documents
  sales.value.forEach(sale => {
    linkedSaleIds.add(sale.$id);
    const linkedItem = inventoryItems.value.find(i => i.saleId === sale.$id || (sale.orderId && (i.locationSku === sale.orderId || i.upc === sale.orderId)));
    if (linkedItem) linkedItemIds.add(linkedItem.$id);

    const locName = getWarehouseName(sale.warehouseId);
    const comm = (sale.commissionFee || 0) + (sale.shippingCost || 0);

    list.push({
      uniqueKey: `sale-${sale.$id}`,
      id: sale.$id,
      soNumber: sale.soNumber || `SO-${sale.$id.slice(-4).toUpperCase()}`,
      title: linkedItem?.title || sale.orderId || 'Order ' + sale.soNumber,
      upc: linkedItem?.upc || '',
      sku: linkedItem?.locationSku || linkedItem?.sku || '',
      locationName: locName,
      date: sale.saleDate || sale.$createdAt,
      status: sale.status || 'Sold',
      grossAmount: Number(sale.grossAmount || 0),
      fees: comm,
      netPayout: Number(sale.netPayout !== undefined ? sale.netPayout : (sale.grossAmount - comm)),
    });
  });

  // 2. Process sold inventory items that do not have a dedicated sales collection document
  inventoryItems.value.forEach(item => {
    if (item.status === 'sold' && !linkedItemIds.has(item.$id)) {
      const locName = (Array.isArray(item.sellingLocations) ? item.sellingLocations[0] : item.sellingLocations) || item.storageLocation || 'Location';
      const commRate = getCommissionRate(locName);

      const gross = Number(item.resalePrice || item.listPrice || item.soldPrice || 0);
      const net = (item.soldPrice !== undefined && item.soldPrice !== null && Number(item.soldPrice) > 0)
        ? Number(item.soldPrice)
        : Number((gross * (1 - (commRate / 100))).toFixed(2));
      const fees = Math.max(0, Number((gross - net).toFixed(2)));

      list.push({
        uniqueKey: `item-${item.$id}`,
        id: item.$id,
        soNumber: item.upc || item.locationSku || `SO-${item.$id.slice(-4).toUpperCase()}`,
        title: item.title || 'Sold Item',
        upc: item.upc || '',
        sku: item.locationSku || item.sku || '',
        locationName: locName,
        date: item.$updatedAt || item.$createdAt,
        status: 'Sold',
        grossAmount: gross,
        fees: fees,
        netPayout: net,
      });
    }
  });

  return list.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
});

const totalGross = computed(() => consolidatedSales.value.reduce((acc, s) => acc + s.grossAmount, 0));
const totalFees = computed(() => consolidatedSales.value.reduce((acc, s) => acc + s.fees, 0));
const totalNet = computed(() => consolidatedSales.value.reduce((acc, s) => acc + s.netPayout, 0));

const displayedSales = computed(() => {
  let list = consolidatedSales.value;

  if (locationFilter.value !== 'all') {
    const target = locationFilter.value.toLowerCase().replace(/[^a-z0-9]/g, '');
    list = list.filter(s => (s.locationName || '').toLowerCase().replace(/[^a-z0-9]/g, '') === target);
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(s => 
      (s.title || '').toLowerCase().includes(q) ||
      (s.soNumber || '').toLowerCase().includes(q) ||
      (s.upc || '').toLowerCase().includes(q) ||
      (s.sku || '').toLowerCase().includes(q) ||
      (s.locationName || '').toLowerCase().includes(q)
    );
  }

  return list;
});

let salesUnsubscribe: (() => void) | null = null;
let whUnsubscribe: (() => void) | null = null;

const initSalesRealtime = () => {
  if (salesUnsubscribe) return;
  const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

  try {
    salesUnsubscribe = client.subscribe(
      `databases.${DB_ID}.collections.sales.documents`,
      (response) => {
        const isCreate = response.events.some(e => e.includes('.create'));
        const isUpdate = response.events.some(e => e.includes('.update'));
        const isDelete = response.events.some(e => e.includes('.delete'));
        const doc = response.payload as any;
        if (!doc || !doc.$id) return;

        // Filter by tenant
        if (currentTeam.value && doc.tenantId && doc.tenantId !== currentTeam.value.$id) {
          return;
        }

        if (isCreate) {
          if (!sales.value.find(s => s.$id === doc.$id)) {
            sales.value.unshift(doc);
          }
        } else if (isUpdate) {
          const idx = sales.value.findIndex(s => s.$id === doc.$id);
          if (idx !== -1) {
            sales.value[idx] = { ...sales.value[idx], ...doc };
          } else {
            sales.value.unshift(doc);
          }
        } else if (isDelete) {
          sales.value = sales.value.filter(s => s.$id !== doc.$id);
        }
      }
    );

    whUnsubscribe = client.subscribe(
      `databases.${DB_ID}.collections.warehouses.documents`,
      (response) => {
        const isCreate = response.events.some(e => e.includes('.create'));
        const isUpdate = response.events.some(e => e.includes('.update'));
        const isDelete = response.events.some(e => e.includes('.delete'));
        const doc = response.payload as any;
        if (!doc || !doc.$id) return;

        if (currentTeam.value && doc.tenantId && doc.tenantId !== currentTeam.value.$id) return;

        if (isCreate) {
          if (!warehouses.value.find(w => w.$id === doc.$id)) {
            warehouses.value.push(doc);
          }
        } else if (isUpdate) {
          const idx = warehouses.value.findIndex(w => w.$id === doc.$id);
          if (idx !== -1) {
            warehouses.value[idx] = { ...warehouses.value[idx], ...doc };
          }
        } else if (isDelete) {
          warehouses.value = warehouses.value.filter(w => w.$id !== doc.$id);
        }
      }
    );
  } catch (err) {
    console.warn('[SalesList] Realtime subscription warning:', err);
  }
};

const fetchData = async () => {
  if (!currentTeam.value) return;
  loading.value = true;
  error.value = '';
  try {
    const [salesRes, whRes] = await Promise.all([
      salesApi.listSales(currentTeam.value.$id).catch(() => []),
      warehousesApi.listWarehouses(currentTeam.value.$id).catch(() => []),
      fetchInventory(currentTeam.value.$id).catch(() => [])
    ]);
    sales.value = salesRes;
    warehouses.value = whRes;
    initSalesRealtime();
  } catch (err: any) {
    console.error('Error fetching sales:', err);
    error.value = err.message || 'Failed to load sales data.';
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  if (currentTeam.value) fetchData();
});

onUnmounted(() => {
  if (salesUnsubscribe) {
    salesUnsubscribe();
    salesUnsubscribe = null;
  }
  if (whUnsubscribe) {
    whUnsubscribe();
    whUnsubscribe = null;
  }
});

watch(currentTeam, (n) => {
  if (n) {
    if (salesUnsubscribe) { salesUnsubscribe(); salesUnsubscribe = null; }
    if (whUnsubscribe) { whUnsubscribe(); whUnsubscribe = null; }
    fetchData();
  } else {
    sales.value = [];
    warehouses.value = [];
  }
});
</script>

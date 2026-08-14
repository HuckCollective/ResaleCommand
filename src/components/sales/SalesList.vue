<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h1 class="text-4xl font-black text-base-content tracking-tight">Sales</h1>
        <p class="text-base-content/70 mt-2">Manage your sales, commissions, and shipments across all locations.</p>
      </div>
      <div class="flex gap-2">
        <a href="/sales/import" class="btn btn-outline btn-primary shadow-lg shadow-primary/10">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          Import CSV
        </a>
        <a href="/sales/new" class="btn btn-primary shadow-lg shadow-primary/20">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
          Record Sale
        </a>
      </div>
    </div>

    <!-- Loader -->
    <div v-if="loading" class="flex justify-center p-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="alert alert-error shadow-sm">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      <span>{{ error }}</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="sales.length === 0" class="card bg-base-100 shadow-xl border border-base-200">
      <div class="card-body text-center py-16">
        <div class="flex justify-center mb-4">
          <div class="p-4 bg-primary/10 rounded-full text-primary">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
        </div>
        <h3 class="text-xl font-bold">No Sales Yet</h3>
        <p class="opacity-70 mt-2 max-w-md mx-auto">Start recording your sales to automatically track commissions, net payouts, and update inventory statuses.</p>
        <div class="mt-6 flex justify-center gap-4">
          <a href="/sales/new" class="btn btn-primary">Record First Sale</a>
        </div>
      </div>
    </div>

    <!-- Sales Table -->
    <div v-else class="card bg-base-100 shadow-xl overflow-hidden border border-base-200">
      <div class="overflow-x-auto">
        <table class="table table-zebra w-full">
          <thead>
            <tr class="bg-base-200/50">
              <th>SO Number</th>
              <th>Location</th>
              <th>Date</th>
              <th>Status</th>
              <th class="text-right">Gross</th>
              <th class="text-right">Fees</th>
              <th class="text-right">Net Payout</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="sale in sales" :key="sale.$id" class="hover cursor-pointer" @click="goToSale(sale.$id)">
              <td class="font-mono text-sm font-bold text-primary">{{ sale.soNumber }}</td>
              <td>{{ getWarehouseName(sale.warehouseId) }}</td>
              <td>{{ sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : 'N/A' }}</td>
              <td>
                <span class="badge badge-sm" :class="getStatusClass(sale.status)">
                  {{ sale.status }}
                </span>
              </td>
              <td class="text-right">{{ formatCurrency(sale.grossAmount || 0) }}</td>
              <td class="text-right text-error">{{ formatCurrency((sale.commissionFee || 0) + (sale.shippingCost || 0)) }}</td>
              <td class="text-right font-bold text-success">{{ formatCurrency(sale.netPayout || 0) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useAuth } from '../../composables/useAuth';
import { salesApi } from '../../lib/sales';
import { warehousesApi } from '../../lib/warehouses';
import type { SaleDocument } from '../../lib/sales';
import type { WarehouseDocument } from '../../lib/warehouses';

const { currentTeam } = useAuth();
const sales = ref<SaleDocument[]>([]);
const warehouses = ref<WarehouseDocument[]>([]);
const loading = ref(true);
const error = ref('');

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

const getStatusClass = (status: string) => {
  if (status === 'Draft') return 'badge-neutral';
  if (status === 'Sold') return 'badge-info';
  if (status === 'Shipped') return 'badge-primary';
  if (status === 'Delivered') return 'badge-success';
  if (status === 'Returned' || status === 'Refunded') return 'badge-error';
  return 'badge-ghost';
};

const getWarehouseName = (warehouseId: string) => {
  const wh = warehouses.value.find(w => w.$id === warehouseId);
  return wh ? wh.name : 'Unknown Location';
};

const goToSale = (id: string) => {
  window.location.href = `/sales/${id}`;
};

const fetchData = async () => {
  if (!currentTeam.value) return;
  loading.value = true;
  error.value = '';
  try {
    const [salesRes, whRes] = await Promise.all([
      salesApi.listSales(currentTeam.value.$id),
      warehousesApi.listWarehouses(currentTeam.value.$id)
    ]);
    sales.value = salesRes;
    warehouses.value = whRes;
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

watch(currentTeam, (n) => {
  if (n) fetchData();
  else { sales.value = []; warehouses.value = []; }
});
</script>

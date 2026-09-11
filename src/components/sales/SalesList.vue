<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h1 class="text-3xl sm:text-4xl font-black text-base-content tracking-tight flex items-center gap-3">
          <Icon icon="solar:dollar-bold-duotone" class="w-8 h-8 sm:w-9 h-9 text-success shrink-0" />
          <span>Sales & Realized Revenue</span>
        </h1>
        <p class="text-sm text-base-content/70 mt-1">
          Track sold items, calculate platform commissions, and monitor net payouts across all locations.
        </p>
      </div>
      <div class="flex items-center gap-2 flex-wrap w-full md:w-auto">
        <a href="/warehouse/sync" class="btn btn-sm sm:btn-md btn-outline btn-secondary gap-1.5 shadow-xs font-bold flex-1 sm:flex-initial min-h-[40px]">
          <Icon icon="solar:round-transfer-horizontal-bold-duotone" class="w-4 h-4 shrink-0" />
          <span>Location Sync</span>
        </a>
        <a href="/sales/new" class="btn btn-sm sm:btn-md btn-primary gap-1.5 shadow-lg shadow-primary/20 font-bold flex-1 sm:flex-initial min-h-[40px]">
          <Icon icon="solar:add-circle-bold" class="w-4 h-4 shrink-0" />
          <span>Record Sale</span>
        </a>
      </div>
    </div>

    <!-- Loader -->
    <div v-if="loading && consolidatedSales.length === 0" class="flex flex-col items-center justify-center py-16 gap-3">
      <span class="loading loading-spinner loading-lg text-primary"></span>
      <span class="text-xs font-bold opacity-60">Loading Sales Records...</span>
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
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 shadow-sm">
          <div class="flex items-center gap-2.5 sm:gap-3">
            <div class="p-2.5 sm:p-3 bg-success/10 text-success rounded-xl shrink-0">
              <Icon icon="solar:dollar-bold" class="w-5 h-5 sm:w-6 h-6" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-[11px] uppercase font-bold opacity-60 truncate">Gross Sales</div>
              <div class="text-lg sm:text-2xl font-black font-mono text-success truncate">{{ formatCurrency(totalGross) }}</div>
            </div>
          </div>
        </div>

        <div class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 shadow-sm">
          <div class="flex items-center gap-2.5 sm:gap-3">
            <div class="p-2.5 sm:p-3 bg-primary/10 text-primary rounded-xl shrink-0">
              <Icon icon="solar:wallet-money-bold" class="w-5 h-5 sm:w-6 h-6" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-[11px] uppercase font-bold opacity-60 truncate">Net Payout</div>
              <div class="text-lg sm:text-2xl font-black font-mono text-primary truncate">{{ formatCurrency(totalNet) }}</div>
            </div>
          </div>
        </div>

        <div class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 shadow-sm">
          <div class="flex items-center gap-2.5 sm:gap-3">
            <div class="p-2.5 sm:p-3 bg-error/10 text-error rounded-xl shrink-0">
              <Icon icon="solar:ticket-sale-bold" class="w-5 h-5 sm:w-6 h-6" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-[11px] uppercase font-bold opacity-60 truncate">Total Fees</div>
              <div class="text-lg sm:text-2xl font-black font-mono text-error truncate">{{ formatCurrency(totalFees) }}</div>
            </div>
          </div>
        </div>

        <div class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 shadow-sm">
          <div class="flex items-center gap-2.5 sm:gap-3">
            <div class="p-2.5 sm:p-3 bg-info/10 text-info rounded-xl shrink-0">
              <Icon icon="solar:box-bold" class="w-5 h-5 sm:w-6 h-6" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-[11px] uppercase font-bold opacity-60 truncate">Items Sold</div>
              <div class="text-lg sm:text-2xl font-black font-mono text-info truncate">{{ consolidatedSales.length }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- SEARCH & CONTROLS TOOLBAR (PO TREATMENT: CLEAN & MOBILE-FIRST) -->
      <div class="card bg-base-100 shadow-md border border-base-200 p-3 sm:p-4">
        <div class="flex flex-col gap-3">
          
          <!-- DaisyUI Connected Search Input + Location Dropdown (.join) -->
          <div class="join w-full shadow-xs">
            <div class="relative flex-1 join-item">
              <Icon icon="solar:magnifer-linear" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" />
              <input 
                type="text" 
                v-model="searchQuery" 
                placeholder="Search sale by item title, UPC, SKU, SO#..." 
                class="input input-bordered join-item w-full pl-10 pr-9 text-sm min-h-[44px]"
              />
              <button 
                v-if="searchQuery" 
                @click="searchQuery = ''" 
                class="absolute right-2.5 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle opacity-60 hover:opacity-100 min-h-[28px] min-w-[28px]"
                title="Clear search"
              >
                ✕
              </button>
            </div>

            <select v-model="locationFilter" class="select select-bordered join-item text-xs font-bold min-h-[44px] max-w-[130px] sm:max-w-[200px]">
              <option value="all">All Locations</option>
              <option v-for="wh in warehouses" :key="wh.$id" :value="wh.name">{{ wh.name }}</option>
            </select>
          </div>

          <!-- Sort Control Pills (Mobile Only - Table View uses Column Headers) -->
          <div class="flex md:hidden items-center gap-1.5 flex-wrap pt-1 text-xs">
            <span class="font-bold opacity-60 mr-1 flex items-center gap-1 whitespace-nowrap shrink-0">
              <Icon icon="solar:sort-vertical-linear" class="w-3.5 h-3.5 shrink-0" /> Sort:
            </span>
            <button 
              type="button" 
              class="btn btn-xs rounded-lg font-bold gap-1 transition-all whitespace-nowrap shrink-0" 
              :class="sortBy === 'date' ? 'btn-primary shadow-xs' : 'btn-ghost opacity-75'" 
              @click="toggleSort('date')"
            >
              ⚡ Date
              <span v-if="sortBy === 'date'">{{ sortDesc ? '↓' : '↑' }}</span>
            </button>
            <button 
              type="button" 
              class="btn btn-xs rounded-lg font-bold gap-1 transition-all whitespace-nowrap shrink-0" 
              :class="sortBy === 'so' ? 'btn-primary shadow-xs' : 'btn-ghost opacity-75'" 
              @click="toggleSort('so')"
            >
              # SO#
              <span v-if="sortBy === 'so'">{{ sortDesc ? '↓' : '↑' }}</span>
            </button>
            <button 
              type="button" 
              class="btn btn-xs rounded-lg font-bold gap-1 transition-all whitespace-nowrap shrink-0" 
              :class="sortBy === 'net' ? 'btn-primary shadow-xs' : 'btn-ghost opacity-75'" 
              @click="toggleSort('net')"
            >
              💲 Net
              <span v-if="sortBy === 'net'">{{ sortDesc ? '↓' : '↑' }}</span>
            </button>
            <button 
              type="button" 
              class="btn btn-xs rounded-lg font-bold gap-1 transition-all whitespace-nowrap shrink-0" 
              :class="sortBy === 'gross' ? 'btn-primary shadow-xs' : 'btn-ghost opacity-75'" 
              @click="toggleSort('gross')"
            >
              💲 Gross
              <span v-if="sortBy === 'gross'">{{ sortDesc ? '↓' : '↑' }}</span>
            </button>
          </div>
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
          <p class="opacity-70 mt-2 max-w-md mx-auto text-sm">
            {{ searchQuery || locationFilter !== 'all' ? 'Try adjusting your search query or location filter.' : 'Start recording sales or sync from your location booth CSV.' }}
          </p>
          <div class="mt-6 flex justify-center gap-3">
            <a href="/warehouse/sync" class="btn btn-outline btn-secondary font-bold">Sync Location CSV</a>
            <a href="/sales/new" class="btn btn-primary font-bold">Record First Sale</a>
          </div>
        </div>
      </div>

      <!-- 1. MOBILE CARD VIEW (VISIBLE ON MOBILE & TABLET < MD) -->
      <div v-else class="block md:hidden space-y-3">
        <div 
          v-for="sale in displayedSales" 
          :key="sale.uniqueKey"
          class="card bg-base-100 shadow-md border border-base-200/80 hover:border-primary/40 transition-all rounded-2xl p-3.5 space-y-3"
        >
          <!-- Card Header: SO Number + Price + Status -->
          <div class="flex items-start justify-between gap-2">
            <div class="space-y-1">
              <a 
                :href="`/sales/${sale.id}`" 
                class="btn btn-xs btn-primary text-primary-content font-mono font-black gap-1.5 shadow-xs px-2.5 rounded-lg inline-flex items-center active:scale-95 transition-all"
                title="Edit Sale"
              >
                <Icon icon="solar:document-text-bold" class="w-3.5 h-3.5 shrink-0" />
                <span>{{ sale.soNumber }}</span>
              </a>
              <div class="text-[11px] font-medium opacity-70 flex items-center gap-2 flex-wrap pt-0.5">
                <span class="flex items-center gap-1" title="Sale Date">
                  <Icon icon="solar:calendar-linear" class="w-3 h-3 text-primary shrink-0" />
                  <span class="whitespace-nowrap">{{ formatDate(sale.date) }}</span>
                </span>
                <span v-if="formatRelativeTime(sale.date)" class="badge badge-ghost badge-xs font-mono font-bold opacity-80 whitespace-nowrap">
                  {{ formatRelativeTime(sale.date) }}
                </span>
              </div>
            </div>

            <div class="text-right space-y-1 shrink-0">
              <div class="font-mono font-black text-lg text-success leading-none">
                {{ formatCurrency(sale.netPayout) }}
              </div>
              <div class="badge badge-sm font-bold" :class="getStatusClass(sale.status)">
                {{ sale.status }}
              </div>
            </div>
          </div>

          <!-- Item Title & Identifiers -->
          <div class="space-y-1.5">
            <a 
              :href="`/sales/${sale.id}`" 
              class="font-bold text-sm text-base-content hover:text-primary transition-colors line-clamp-2"
              :title="sale.title"
            >
              {{ sale.title }}
            </a>

            <!-- Chips / Pills: Location, UPC, SKU -->
            <div class="flex items-center gap-1.5 flex-wrap text-xs">
              <span class="badge badge-sm badge-outline font-semibold gap-1 py-2 whitespace-nowrap shrink-0">
                <Icon icon="solar:shop-2-linear" class="w-3 h-3 opacity-60 shrink-0" />
                {{ sale.locationName }}
              </span>
              <span v-if="sale.sku" class="badge badge-sm badge-secondary badge-outline font-mono text-[10px] font-bold py-2 whitespace-nowrap shrink-0">
                SKU: {{ sale.sku }}
              </span>
              <span v-if="sale.upc" class="badge badge-sm badge-ghost font-mono text-[10px] opacity-75 py-2 whitespace-nowrap shrink-0">
                UPC: {{ sale.upc }}
              </span>
            </div>
          </div>

          <!-- Financial Breakdown Bar (Gross, Fees, Net) -->
          <div class="grid grid-cols-3 gap-2 bg-base-200/50 rounded-xl p-2.5 text-center text-xs">
            <div>
              <div class="text-[10px] uppercase font-bold opacity-50">Gross</div>
              <div class="font-mono font-bold text-base-content">{{ formatCurrency(sale.grossAmount) }}</div>
            </div>
            <div class="border-x border-base-200">
              <div class="text-[10px] uppercase font-bold opacity-50">Fees</div>
              <div class="font-mono font-bold text-error">-{{ formatCurrency(sale.fees) }}</div>
            </div>
            <div>
              <div class="text-[10px] uppercase font-bold opacity-50">Net Payout</div>
              <div class="font-mono font-black text-success">{{ formatCurrency(sale.netPayout) }}</div>
            </div>
          </div>

          <!-- Touch Actions: Edit Sale + Item Link -->
          <div class="flex items-center gap-2 pt-1 border-t border-base-200/60">
            <a 
              :href="`/sales/${sale.id}`" 
              class="btn btn-sm btn-primary text-primary-content font-bold flex-1 rounded-xl gap-1.5 min-h-[38px] shadow-xs active:scale-95 transition-all"
              title="Edit Sale Details"
            >
              <Icon icon="solar:pen-bold" class="w-4 h-4 shrink-0" />
              <span>Edit Sale</span>
            </a>

            <a 
              v-if="sale.itemUrl"
              :href="sale.itemUrl" 
              class="btn btn-sm btn-outline btn-secondary font-bold rounded-xl gap-1.5 min-h-[38px] px-3 shrink-0"
              title="View Item Details"
            >
              <Icon icon="solar:box-minimalistic-linear" class="w-4 h-4 shrink-0" />
              <span>Item</span>
            </a>
          </div>
        </div>
      </div>

      <!-- 2. DESKTOP TABLE VIEW (VISIBLE ON MD AND LARGER SCREENS) -->
      <div v-if="displayedSales.length > 0" class="hidden md:block card bg-base-100 shadow-xl border border-base-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="table table-zebra w-full">
            <thead class="bg-base-200/70 text-xs font-black uppercase tracking-wider text-base-content/80">
              <tr>
                <th class="w-36 py-3.5 px-4 whitespace-nowrap cursor-pointer hover:bg-base-200 transition-colors" @click="toggleSort('so')">
                  <div class="flex items-center gap-1.5">
                    SO Number
                    <span v-if="sortBy === 'so'" class="text-xs font-black text-primary">{{ sortDesc ? '▼' : '▲' }}</span>
                    <span v-else class="text-xs opacity-20">▼</span>
                  </div>
                </th>
                <th class="py-3.5 px-4">Item Details</th>
                <th class="w-36 py-3.5 px-4 whitespace-nowrap cursor-pointer hover:bg-base-200 transition-colors" @click="toggleSort('location')">
                  <div class="flex items-center gap-1.5">
                    Location
                    <span v-if="sortBy === 'location'" class="text-xs font-black text-primary">{{ sortDesc ? '▼' : '▲' }}</span>
                    <span v-else class="text-xs opacity-20">▼</span>
                  </div>
                </th>
                <th class="w-32 py-3.5 px-4 whitespace-nowrap cursor-pointer hover:bg-base-200 transition-colors" @click="toggleSort('date')">
                  <div class="flex items-center gap-1.5">
                    Sale Date
                    <span v-if="sortBy === 'date'" class="text-xs font-black text-primary">{{ sortDesc ? '▼' : '▲' }}</span>
                    <span v-else class="text-xs opacity-20">▼</span>
                  </div>
                </th>
                <th class="w-28 py-3.5 px-4 whitespace-nowrap text-center cursor-pointer hover:bg-base-200 transition-colors" @click="toggleSort('status')">
                  <div class="flex items-center justify-center gap-1.5">
                    Status
                    <span v-if="sortBy === 'status'" class="text-xs font-black text-primary">{{ sortDesc ? '▼' : '▲' }}</span>
                    <span v-else class="text-xs opacity-20">▼</span>
                  </div>
                </th>
                <th class="w-28 py-3.5 px-4 whitespace-nowrap text-right cursor-pointer hover:bg-base-200 transition-colors" @click="toggleSort('gross')">
                  <div class="flex items-center justify-end gap-1.5">
                    Gross Price
                    <span v-if="sortBy === 'gross'" class="text-xs font-black text-primary">{{ sortDesc ? '▼' : '▲' }}</span>
                    <span v-else class="text-xs opacity-20">▼</span>
                  </div>
                </th>
                <th class="w-24 py-3.5 px-4 whitespace-nowrap text-right">Fees</th>
                <th class="w-28 py-3.5 px-4 whitespace-nowrap text-right cursor-pointer hover:bg-base-200 transition-colors" @click="toggleSort('net')">
                  <div class="flex items-center justify-end gap-1.5">
                    Net Payout
                    <span v-if="sortBy === 'net'" class="text-xs font-black text-primary">{{ sortDesc ? '▼' : '▲' }}</span>
                    <span v-else class="text-xs opacity-20">▼</span>
                  </div>
                </th>
                <th class="w-32 py-3.5 px-4 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="sale in displayedSales" :key="sale.uniqueKey" class="hover:bg-base-200/40 transition-colors">
                <!-- SO Number Button -->
                <td class="py-3 px-4 font-bold whitespace-nowrap">
                  <a 
                    :href="`/sales/${sale.id}`" 
                    class="btn btn-xs btn-primary text-primary-content font-mono font-black gap-1.5 shadow-xs px-2.5 h-8 rounded-lg inline-flex items-center hover:scale-105 transition-transform"
                    title="Edit Sale"
                  >
                    <Icon icon="solar:document-text-bold" class="w-3.5 h-3.5 shrink-0" />
                    <span>{{ sale.soNumber }}</span>
                  </a>
                </td>

                <!-- Item Details (Clickable Title + SKU/UPC badges) -->
                <td class="py-3 px-4">
                  <a 
                    :href="`/sales/${sale.id}`" 
                    class="font-bold text-xs text-base-content hover:text-primary transition-colors block max-w-sm truncate" 
                    :title="sale.title"
                  >
                    {{ sale.title }}
                  </a>
                  <div class="flex items-center gap-1.5 mt-1">
                    <span v-if="sale.sku" class="font-mono text-[10px] text-secondary font-bold bg-secondary/10 px-1.5 py-0.5 rounded whitespace-nowrap">
                      SKU: {{ sale.sku }}
                    </span>
                    <span v-if="sale.upc" class="font-mono text-[10px] opacity-70 bg-base-200 px-1.5 py-0.5 rounded whitespace-nowrap">
                      UPC: {{ sale.upc }}
                    </span>
                  </div>
                </td>

                <!-- Location -->
                <td class="py-3 px-4 whitespace-nowrap">
                  <span class="badge badge-sm badge-outline font-semibold">
                    {{ sale.locationName }}
                  </span>
                </td>

                <!-- Sale Date -->
                <td class="py-3 px-4 font-mono text-xs opacity-75 whitespace-nowrap">
                  {{ formatDate(sale.date) }}
                </td>

                <!-- Status -->
                <td class="py-3 px-4 text-center whitespace-nowrap">
                  <span class="badge badge-sm font-bold" :class="getStatusClass(sale.status)">
                    {{ sale.status }}
                  </span>
                </td>

                <!-- Gross -->
                <td class="py-3 px-4 text-right font-mono font-bold text-xs text-base-content whitespace-nowrap">
                  {{ formatCurrency(sale.grossAmount) }}
                </td>

                <!-- Fees -->
                <td class="py-3 px-4 text-right font-mono text-xs text-error whitespace-nowrap">
                  -{{ formatCurrency(sale.fees) }}
                </td>

                <!-- Net -->
                <td class="py-3 px-4 text-right font-mono font-black text-xs text-success whitespace-nowrap">
                  {{ formatCurrency(sale.netPayout) }}
                </td>

                <!-- Actions -->
                <td class="py-3 px-4 text-right whitespace-nowrap">
                  <div class="flex items-center justify-end gap-1.5">
                    <a 
                      :href="`/sales/${sale.id}`" 
                      class="btn btn-xs btn-outline btn-primary font-bold gap-1 rounded-lg px-2.5 h-7"
                      title="Edit Sale"
                    >
                      <Icon icon="solar:pen-bold" class="w-3 h-3 shrink-0" />
                      <span>Edit</span>
                    </a>
                    <a 
                      v-if="sale.itemUrl" 
                      :href="sale.itemUrl" 
                      class="btn btn-xs btn-ghost btn-square text-base-content/70 hover:text-base-content rounded-lg h-7 w-7"
                      title="View Item"
                    >
                      <Icon icon="solar:box-minimalistic-linear" class="w-3.5 h-3.5 shrink-0" />
                    </a>
                  </div>
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
import { warehousesApi, matchesLocationFilter } from '../../lib/warehouses';
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

// Sorting state (PO treatment)
const sortBy = ref<'date' | 'so' | 'net' | 'gross' | 'location' | 'status'>('date');
const sortDesc = ref(true);

const toggleSort = (field: 'date' | 'so' | 'net' | 'gross' | 'location' | 'status') => {
  if (sortBy.value === field) {
    sortDesc.value = !sortDesc.value;
  } else {
    sortBy.value = field;
    sortDesc.value = (field === 'date' || field === 'net' || field === 'gross');
  }
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const formatRelativeTime = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays > 0 && diffDays < 30) return `${diffDays}d ago`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths > 0 && diffMonths < 12) return `${diffMonths}mo ago`;
    if (diffMonths >= 12) return `${Math.floor(diffMonths / 12)}y ago`;
    return '';
  } catch {
    return '';
  }
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
      itemId: linkedItem?.$id || '',
      itemUrl: linkedItem ? `/item/${linkedItem.$id}` : '',
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
        id: item.$id, // Handled seamlessly by SaleEditor.vue fallback
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
        itemId: item.$id,
        itemUrl: `/item/${item.$id}`,
      });
    }
  });

  return list;
});

const totalGross = computed(() => consolidatedSales.value.reduce((acc, s) => acc + s.grossAmount, 0));
const totalFees = computed(() => consolidatedSales.value.reduce((acc, s) => acc + s.fees, 0));
const totalNet = computed(() => consolidatedSales.value.reduce((acc, s) => acc + s.netPayout, 0));

const displayedSales = computed(() => {
  let list = [...consolidatedSales.value];

  if (locationFilter.value !== 'all') {
    list = list.filter(s => matchesLocationFilter({ storageLocation: s.locationName, sellingLocations: [s.locationName] }, locationFilter.value));
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

  list.sort((a, b) => {
    let diff = 0;
    if (sortBy.value === 'date') {
      diff = new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
    } else if (sortBy.value === 'so') {
      diff = (a.soNumber || '').localeCompare(b.soNumber || '');
    } else if (sortBy.value === 'net') {
      diff = a.netPayout - b.netPayout;
    } else if (sortBy.value === 'gross') {
      diff = a.grossAmount - b.grossAmount;
    } else if (sortBy.value === 'location') {
      diff = (a.locationName || '').localeCompare(b.locationName || '');
    } else if (sortBy.value === 'status') {
      diff = (a.status || '').localeCompare(b.status || '');
    }
    return sortDesc.value ? -diff : diff;
  });

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

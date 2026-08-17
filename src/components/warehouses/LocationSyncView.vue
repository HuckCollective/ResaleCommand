<template>
  <div class="space-y-6">
    <!-- Header & Breadcrumbs -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-base-100 p-6 rounded-2xl border border-base-200 shadow-sm">
      <div>
        <div class="flex items-center gap-2 text-xs opacity-60 mb-1">
          <a href="/warehouse" class="hover:underline flex items-center gap-1">
            <Icon icon="solar:shop-2-bold" class="w-3.5 h-3.5" /> Locations & Warehouses
          </a>
          <span>/</span>
          <span>Sync Workspace</span>
        </div>
        <h1 class="text-3xl font-bold flex items-center gap-3">
          <Icon icon="solar:round-transfer-horizontal-bold-duotone" class="w-8 h-8 text-primary" />
          Location Inventory & Sales Sync
        </h1>
        <p class="text-xs opacity-70 mt-1">
          Upload products or payout reports from Memory Den / external booths to reconcile sales, link SKUs, and inject UPCs.
        </p>
      </div>

      <!-- Location Selector & Commission Badge -->
      <div class="flex items-center gap-3 w-full md:w-auto">
        <div class="form-control flex-1 md:w-64">
          <label class="label py-1"><span class="label-text text-xs font-bold uppercase opacity-60">Target Location</span></label>
          <select v-model="selectedLocationId" class="select select-bordered select-sm w-full font-bold">
            <option value="" disabled>Select a location...</option>
            <option v-for="loc in warehouses" :key="loc.$id" :value="loc.$id">
              {{ loc.name }} ({{ loc.type }})
            </option>
          </select>
        </div>

        <div v-if="currentLocation" class="bg-base-200 p-2.5 rounded-xl border border-base-300 text-center shrink-0">
          <div class="text-[10px] uppercase font-bold opacity-60">Commission</div>
          <div class="text-sm font-extrabold text-primary font-mono">{{ currentLocation.commissionRate || 0 }}%</div>
        </div>
      </div>
    </div>

    <!-- Step 1: Upload Dropzone (if no CSV is loaded) -->
    <div v-if="syncRows.length === 0" class="card bg-base-100 border-2 border-dashed border-base-300 shadow-sm p-12 text-center">
      <div class="max-w-md mx-auto flex flex-col items-center">
        <div class="p-4 bg-primary/10 text-primary rounded-3xl mb-4">
          <Icon icon="solar:upload-track-linear" class="w-12 h-12" />
        </div>
        <h2 class="text-xl font-bold mb-1">Upload Location CSV Export</h2>
        <p class="text-xs opacity-60 mb-6">
          Drop your Memory Den product catalog or payout summary CSV to link SKUs, attribute sales, and generate two-way synced barcodes.
        </p>

        <label class="btn btn-primary btn-md gap-2 font-bold shadow-lg shadow-primary/20 cursor-pointer">
          <Icon icon="solar:file-text-bold" class="w-5 h-5" />
          <span>Select CSV File</span>
          <input type="file" accept=".csv" class="hidden" @change="handleFileUpload" :disabled="isParsing" />
        </label>

        <div v-if="isParsing" class="mt-4 flex items-center gap-2 text-primary text-xs font-bold">
          <span class="loading loading-spinner loading-xs"></span> Parsing CSV & Matching Inventory...
        </div>
      </div>
    </div>

    <!-- Step 2: Full Reconciliation Workspace (once CSV loaded) -->
    <div v-else class="space-y-4">
      
      <!-- Metrics & Overview Header -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="bg-base-100 p-4 rounded-xl border border-base-200 shadow-sm flex items-center gap-3">
          <div class="p-3 bg-base-200 rounded-lg text-primary"><Icon icon="solar:documents-bold" class="w-5 h-5" /></div>
          <div>
            <div class="text-xs opacity-60">Total Rows</div>
            <div class="text-xl font-extrabold font-mono">{{ syncRows.length }}</div>
          </div>
        </div>

        <div class="bg-base-100 p-4 rounded-xl border border-base-200 shadow-sm flex items-center gap-3">
          <div class="p-3 bg-info/10 text-info rounded-lg"><Icon icon="solar:box-bold" class="w-5 h-5" /></div>
          <div>
            <div class="text-xs opacity-60">In-Stock Items</div>
            <div class="text-xl font-extrabold font-mono text-info">{{ inStockCount }}</div>
          </div>
        </div>

        <div class="bg-base-100 p-4 rounded-xl border border-base-200 shadow-sm flex items-center gap-3">
          <div class="p-3 bg-success/10 text-success rounded-lg"><Icon icon="solar:dollar-bold" class="w-5 h-5" /></div>
          <div>
            <div class="text-xs opacity-60">Sold / Paid Out</div>
            <div class="text-xl font-extrabold font-mono text-success">{{ soldCount }}</div>
          </div>
        </div>

        <div class="bg-base-100 p-4 rounded-xl border border-base-200 shadow-sm flex items-center gap-3">
          <div class="p-3 bg-primary/10 text-primary rounded-lg"><Icon icon="solar:check-circle-bold" class="w-5 h-5" /></div>
          <div>
            <div class="text-xs opacity-60">Matched in RC</div>
            <div class="text-xl font-extrabold font-mono" :class="matchedCount === syncRows.length ? 'text-success' : 'text-primary'">
              {{ matchedCount }} / {{ syncRows.length }}
            </div>
          </div>
        </div>
      </div>

      <!-- Controls & Filters Bar -->
      <div class="bg-base-100 p-4 rounded-xl border border-base-200 shadow-sm flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
        
        <!-- Filter Tabs & Search -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <!-- Filter Tabs -->
          <div class="join border border-base-300 rounded-lg p-0.5 bg-base-200">
            <button class="btn btn-xs join-item" :class="{'btn-active btn-primary': filterTab === 'all'}" @click="filterTab = 'all'">
              All ({{ syncRows.length }})
            </button>
            <button class="btn btn-xs join-item text-info" :class="{'btn-active btn-info text-white': filterTab === 'instock'}" @click="filterTab = 'instock'">
              In Stock ({{ inStockCount }})
            </button>
            <button class="btn btn-xs join-item text-success" :class="{'btn-active btn-secondary text-white': filterTab === 'sold'}" @click="filterTab = 'sold'">
              Sold ({{ soldCount }})
            </button>
            <button class="btn btn-xs join-item text-success" :class="{'btn-active btn-success text-white': filterTab === 'matched'}" @click="filterTab = 'matched'">
              Matched ({{ matchedCount }})
            </button>
            <button class="btn btn-xs join-item text-error" :class="{'btn-active btn-error text-white': filterTab === 'unmatched'}" @click="filterTab = 'unmatched'">
              Unmatched ({{ unmatchedCount }})
            </button>
          </div>

          <!-- CSV Search Input -->
          <div class="relative flex-1 sm:w-64">
            <Icon icon="solar:magnifer-linear" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
            <input 
              type="text" 
              v-model="searchQuery" 
              placeholder="Search CSV title, SKU, price..." 
              class="input input-bordered input-sm pl-9 w-full font-mono text-xs" 
            />
            <button v-if="searchQuery" @click="searchQuery = ''" class="btn btn-xs btn-ghost btn-circle absolute right-2 top-1/2 -translate-y-1/2">✕</button>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-3 w-full lg:w-auto justify-end flex-wrap">
          <label class="label cursor-pointer gap-2 py-0">
            <input type="checkbox" v-model="exportUpdatedCsv" class="checkbox checkbox-sm checkbox-primary" />
            <span class="label-text text-xs font-semibold">Download Synced CSV with UPCs</span>
          </label>

          <button class="btn btn-sm btn-ghost" @click="resetSync">Clear File</button>
          
          <button 
            class="btn btn-sm btn-primary font-bold shadow-md shadow-primary/20" 
            :disabled="matchedCount === 0 || isCommitting" 
            @click="executeSync"
          >
            <span v-if="isCommitting" class="loading loading-spinner loading-sm"></span>
            Sync & Commit {{ matchedCount }} {{ matchedCount === 1 ? 'Item' : 'Items' }}
          </button>
        </div>
      </div>

      <!-- Progress / Rate Limit Notification Bar -->
      <div v-if="bulkProgressMessage" class="alert alert-info py-2.5 px-4 shadow-sm flex items-center gap-3 animate-pulse">
        <span class="loading loading-spinner loading-sm"></span>
        <span class="font-bold text-xs">{{ bulkProgressMessage }}</span>
      </div>

      <!-- Unmatched Action Banner -->
      <div v-if="unmatchedCount > 0" class="alert alert-warning py-3 px-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <Icon icon="solar:info-circle-bold" class="w-6 h-6 text-warning shrink-0" />
          <div>
            <div class="font-bold text-sm">{{ unmatchedCount }} Unmatched Items in CSV</div>
            <div class="text-xs opacity-75">You can search to match existing inventory, quick-add individual items, or bulk create all unmatched items into inventory at once.</div>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button class="btn btn-xs btn-outline" @click="filterTab = 'unmatched'">Filter Unmatched</button>
          <button 
            class="btn btn-xs btn-warning font-bold gap-1.5 shadow-sm text-neutral" 
            :disabled="isBulkQuickAdding"
            @click="bulkQuickAddAllUnmatched"
          >
            <span v-if="isBulkQuickAdding" class="loading loading-spinner loading-xs"></span>
            <Icon v-else icon="solar:box-minimalistic-bold" class="w-4 h-4" />
            Quick Add All Unmatched ({{ unmatchedCount }})
          </button>
        </div>
      </div>

      <!-- Main Reconciliation Table -->
      <div class="card bg-base-100 border border-base-200 shadow-sm overflow-hidden">
        <div class="overflow-x-auto max-h-[65vh]">
          <table class="table table-sm table-pin-rows">
            <thead>
              <tr class="bg-base-200 text-xs uppercase tracking-wider">
                <th class="w-12">Match</th>
                <th class="w-24">CSV Status</th>
                <th class="w-32">Location SKU</th>
                <th>CSV Item Name</th>
                <th class="w-28 text-right">Price</th>
                <th class="min-w-[340px]">Map to ResaleCommand Inventory Item</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in displayedRows" :key="row.originalLineIndex" :class="{'bg-success/10': row.mappedItem}">
                
                <!-- Match Indicator -->
                <td>
                  <div class="tooltip tooltip-right" :data-tip="row.mappedItem ? 'Mapped to ' + (row.mappedItem.upc || row.mappedItem.title) : 'Unmatched item'">
                    <Icon v-if="row.mappedItem" icon="solar:check-circle-bold" class="w-5 h-5 text-success" />
                    <Icon v-else icon="solar:danger-circle-bold" class="w-5 h-5 text-error" />
                  </div>
                </td>

                <!-- Status Badge -->
                <td>
                  <span 
                    class="badge badge-xs font-bold" 
                    :class="(row.status === 'sold' || row.status === 'paid') ? 'badge-success text-white' : 'badge-info text-white'"
                  >
                    {{ (row.status === 'sold' || row.status === 'paid') ? 'Sold / Paid' : 'In Stock' }}
                  </span>
                </td>

                <!-- Extracted SKU -->
                <td>
                  <span class="font-mono text-xs font-bold text-secondary bg-base-200/80 px-2 py-0.5 rounded border border-base-300">
                    {{ row.extractedSku || '—' }}
                  </span>
                </td>

                <!-- CSV Name -->
                <td class="font-semibold text-xs max-w-[280px] truncate" :title="row.itemName">
                  {{ row.itemName }}
                </td>

                <!-- Price -->
                <td class="text-right font-mono font-bold text-success text-xs">
                  ${{ (row.salePrice || 0).toFixed(2) }}
                </td>

                <!-- Mapping Picker or Matched Item Info -->
                <td>
                  <!-- Matched Display -->
                  <div v-if="row.mappedItem" class="flex items-center gap-2 p-1 bg-base-200 rounded-lg border border-base-300">
                    <span class="badge badge-xs font-mono font-bold" :class="row.mappedItem.upc ? 'badge-primary' : 'badge-ghost'">
                      {{ row.mappedItem.upc || 'NO UPC' }}
                    </span>
                    <span class="text-xs font-semibold truncate flex-1" :title="row.mappedItem.title">
                      {{ row.mappedItem.title }}
                    </span>
                    <span class="text-[11px] font-mono opacity-70 shrink-0">
                      Cost: ${{ Number(row.mappedItem.cost || 0).toFixed(2) }}
                    </span>
                    <button class="btn btn-xs btn-ghost btn-circle text-error ml-1 shrink-0" @click="row.mappedItem = null" title="Unlink Item">
                      ✕
                    </button>
                  </div>

                  <!-- Searchable Autocomplete Picker + Quick Add button if unmapped -->
                  <div v-else class="flex items-center gap-1.5">
                    <div class="relative flex-1">
                      <Icon icon="solar:magnifer-linear" class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-50" />
                      <input 
                        type="text" 
                        v-model="row.searchQuery" 
                        @focus="row.isSearching = true"
                        @blur="setTimeout(() => { row.isSearching = false; }, 250)"
                        placeholder="Search inventory to link..." 
                        class="input input-bordered input-xs pl-8 w-full font-mono text-xs bg-base-200/50 focus:bg-base-100" 
                      />
                      <button v-if="row.searchQuery" @click.stop="row.searchQuery = ''; row.isSearching = false" class="btn btn-ghost btn-xs btn-circle absolute right-1 top-1/2 -translate-y-1/2">✕</button>

                      <!-- Autocomplete Dropdown List -->
                      <div 
                        v-if="row.isSearching && getFilteredMatches(row.searchQuery || '').length > 0" 
                        class="absolute z-50 left-0 right-0 mt-1 bg-base-100 border border-base-300 rounded-xl shadow-2xl max-h-56 overflow-y-auto p-1 divide-y divide-base-200"
                      >
                        <div 
                          v-for="item in getFilteredMatches(row.searchQuery || '').slice(0, 10)" 
                          :key="item.$id" 
                          @click="selectItem(row, item)"
                          class="p-2 hover:bg-base-200 rounded-lg cursor-pointer flex items-center justify-between gap-2 transition-colors"
                        >
                          <div class="min-w-0 flex-1">
                            <div class="font-bold text-xs truncate">{{ item.title }}</div>
                            <div class="flex items-center gap-2 text-[10px] opacity-60 font-mono">
                              <span v-if="item.upc" class="text-primary font-bold">UPC: {{ item.upc }}</span>
                              <span>Cost: ${{ Number(item.cost || 0).toFixed(2) }}</span>
                              <span>Status: {{ item.status }}</span>
                            </div>
                          </div>
                          <button class="btn btn-xs btn-primary font-bold shrink-0">Select</button>
                        </div>
                      </div>
                    </div>

                    <!-- Quick Add Button per row -->
                    <button 
                      class="btn btn-xs btn-outline btn-secondary font-bold shrink-0 gap-1 hover:btn-secondary hover:text-white"
                      :disabled="row.isQuickAdding"
                      @click="quickAddRow(row)"
                      title="Create new inventory item for this row"
                    >
                      <span v-if="row.isQuickAdding" class="loading loading-spinner loading-xs"></span>
                      <Icon v-else icon="solar:add-circle-bold" class="w-3.5 h-3.5" />
                      Quick Add
                    </button>
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
import { ref, computed, onMounted, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useAuth } from '../../composables/useAuth';
import { warehousesApi } from '../../lib/warehouses';
import type { WarehouseDocument } from '../../lib/warehouses';
import { salesApi } from '../../lib/sales';
import { useInventory } from '../../composables/useInventory';
import { databases, ID } from '../../lib/appwrite';
import { getCollectionId, DB_ID, saveItemToInventory } from '../../lib/inventory';
import { addToast } from '../../stores/toast';

const { currentTeam: team } = useAuth();
const { inventoryItems, fetchInventory, getNextUpc } = useInventory();

const warehouses = ref<WarehouseDocument[]>([]);
const selectedLocationId = ref<string>('');
const isParsing = ref(false);
const isCommitting = ref(false);
const isBulkQuickAdding = ref(false);
const bulkProgressMessage = ref('');
const exportUpdatedCsv = ref(true);

const filterTab = ref<'all' | 'instock' | 'sold' | 'matched' | 'unmatched'>('all');
const searchQuery = ref('');
const syncRows = ref<any[]>([]);
const rawCsvHeader = ref('');
const rawCsvLines = ref<string[]>([]);

const currentLocation = computed(() => {
  return warehouses.value.find(w => w.$id === selectedLocationId.value) || null;
});

const inStockCount = computed(() => syncRows.value.filter(r => r.status !== 'sold' && r.status !== 'paid').length);
const soldCount = computed(() => syncRows.value.filter(r => r.status === 'sold' || r.status === 'paid').length);
const matchedCount = computed(() => syncRows.value.filter(r => r.mappedItem !== null).length);
const unmatchedCount = computed(() => syncRows.value.filter(r => r.mappedItem === null).length);
const totalSoldGross = computed(() => {
  return syncRows.value
    .filter(r => r.status === 'sold' || r.status === 'paid')
    .reduce((acc, r) => acc + (r.salePrice || 0), 0);
});

const displayedRows = computed(() => {
  let rows = syncRows.value;

  if (filterTab.value === 'instock') rows = rows.filter(r => r.status !== 'sold' && r.status !== 'paid');
  else if (filterTab.value === 'sold') rows = rows.filter(r => r.status === 'sold' || r.status === 'paid');
  else if (filterTab.value === 'matched') rows = rows.filter(r => r.mappedItem !== null);
  else if (filterTab.value === 'unmatched') rows = rows.filter(r => r.mappedItem === null);

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    rows = rows.filter(r => 
      r.itemName.toLowerCase().includes(q) || 
      (r.extractedSku && r.extractedSku.toLowerCase().includes(q)) ||
      (r.salePrice && r.salePrice.toString().includes(q)) ||
      (r.mappedItem && r.mappedItem.title && r.mappedItem.title.toLowerCase().includes(q)) ||
      (r.mappedItem && r.mappedItem.upc && r.mappedItem.upc.toLowerCase().includes(q))
    );
  }

  return rows;
});

const getFilteredMatches = (query: string) => {
  const q = query.toLowerCase().trim();
  const all = inventoryItems.value;
  if (!q) return all.slice(0, 15);

  return all.filter(item => {
    const titleMatch = (item.title || '').toLowerCase().includes(q);
    const upcMatch = (item.upc || '').toLowerCase().includes(q);
    const notesMatch = (item.conditionNotes || '').toLowerCase().includes(q);
    const skuMatch = (item.locationSku || item.sku || '').toLowerCase().includes(q);
    return titleMatch || upcMatch || notesMatch || skuMatch;
  });
};

const selectItem = (row: any, item: any) => {
  row.mappedItem = item;
  row.isSearching = false;
  row.searchQuery = '';
};

const splitCsvLine = (line: string) => {
  const regex = /(?:^|,)(?:"([^"]*)"|([^,]*))/g;
  const result: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    if (match[1] !== undefined) result.push(match[1]);
    else if (match[2] !== undefined) result.push(match[2]);
    if (regex.lastIndex === match.index) regex.lastIndex++;
  }
  return result;
};

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  isParsing.value = true;
  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) {
        addToast({ type: 'error', message: 'CSV file is empty or invalid.' });
        isParsing.value = false;
        return;
      }

      rawCsvHeader.value = lines[0];
      rawCsvLines.value = lines;

      const headerCols = splitCsvLine(lines[0]).map(h => h.trim().toLowerCase());
      const skuIdx = headerCols.findIndex(h => h.includes('sku') || h.includes('barcode') || h.includes('custom sku'));
      const prodIdIdx = headerCols.findIndex(h => h.includes('product id') || h.includes('item id'));
      const nameIdx = headerCols.findIndex(h => h.includes('name') || h.includes('title') || h.includes('item'));
      const priceIdx = headerCols.findIndex(h => h.includes('agreed price') || h.includes('sale price') || h.includes('price') || h.includes('amount') || h.includes('total'));
      const statusIdx = headerCols.findIndex(h => h.includes('inventory') || h.includes('status'));

      const rows: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = splitCsvLine(lines[i]);
        if (cols.length === 0 || !cols.some(c => c.trim().length > 0)) continue;

        let rawSku = skuIdx !== -1 ? cols[skuIdx] : (prodIdIdx !== -1 ? cols[prodIdIdx] : '');
        let cleanSku = (rawSku || '').trim().replace(/^['"]/, '').replace(/['"]$/, '');

        let name = nameIdx !== -1 ? cols[nameIdx] : `Row #${i}`;
        let rawPrice = priceIdx !== -1 ? cols[priceIdx] : '0';
        let price = parseFloat(rawPrice.replace(/[^0-9.]/g, '')) || 0;
        let rawStatus = statusIdx !== -1 ? cols[statusIdx]?.trim().toLowerCase() : '';

        let isSoldOrPaid = rawStatus.includes('sold') || rawStatus.includes('paid') || (rawStatus.length === 0 && price > 0 && !headerCols.includes('inventory'));

        // Match against existing inventory items
        let matched = null;

        // 1. Match by SKU
        if (cleanSku) {
          matched = inventoryItems.value.find(item => {
            const iLocSku = (item.locationSku || '').toLowerCase().trim();
            const iSku = (item.sku || '').toLowerCase().trim();
            const target = cleanSku.toLowerCase();
            return iLocSku === target || iSku === target;
          });
        }

        // 2. Match by exact or normalized UPC
        if (!matched && cleanSku) {
          matched = inventoryItems.value.find(item => (item.upc || '').toLowerCase().trim() === cleanSku.toLowerCase());
        }

        // 3. Match by Title
        if (!matched && name) {
          const cleanCsvName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
          matched = inventoryItems.value.find(item => {
            const cleanTitle = (item.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanTitle && cleanTitle === cleanCsvName;
          });
        }

        rows.push({
          originalLineIndex: i,
          extractedSku: cleanSku,
          itemName: name,
          salePrice: price,
          status: isSoldOrPaid ? 'sold' : 'instock',
          mappedItem: matched || null,
          searchQuery: '',
          isSearching: false,
          isQuickAdding: false
        });
      }

      syncRows.value = rows;
      addToast({ type: 'success', message: `Parsed ${rows.length} items from CSV!` });
    } catch (err: any) {
      console.error('CSV Parsing Error:', err);
      addToast({ type: 'error', message: 'Failed to parse CSV: ' + err.message });
    } finally {
      isParsing.value = false;
    }
  };

  reader.readAsText(file);
};

const resetSync = () => {
  syncRows.value = [];
  rawCsvHeader.value = '';
  rawCsvLines.value = [];
  searchQuery.value = '';
};

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 6, initialDelay = 2000): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const isRateLimit = err?.code === 429 || (err?.message && err.message.toLowerCase().includes('rate limit'));
      if (isRateLimit && attempt < maxRetries) {
        const waitMs = initialDelay * Math.pow(1.5, attempt - 1);
        console.warn(`[Appwrite] Rate limit hit. Backing off for ${Math.round(waitMs)}ms (attempt ${attempt}/${maxRetries})...`);
        bulkProgressMessage.value = `Rate limit paused. Resuming in ${Math.round(waitMs / 1000)}s...`;
        await new Promise(res => setTimeout(res, waitMs));
      } else {
        throw err;
      }
    }
  }
  throw new Error('Max retries exceeded');
}

const quickAddRow = async (row: any) => {
  if (!team.value) return;
  row.isQuickAdding = true;
  try {
    const isSold = row.status === 'sold' || row.status === 'paid';
    const locName = currentLocation.value?.name || '';
    const priceNum = parseFloat(String(row.salePrice || 0)) || 0;
    
    // Generate next UPC
    const upc = getNextUpc ? getNextUpc('HUCK-') : `HUCK-${Math.floor(1000 + Math.random() * 9000)}`;

    const doc = await withRetry(() => saveItemToInventory(
      {
        title: row.itemName || 'Unnamed Item',
        condition_notes: `Added from ${locName || 'Booth'} Sync. SKU: ${row.extractedSku || 'N/A'}`
      },
      null,
      {
        title: row.itemName || 'Unnamed Item',
        status: isSold ? 'sold' : 'placed',
        locationSku: row.extractedSku || '',
        cost: '0',
        resalePrice: String(priceNum),
        soldPrice: isSold ? priceNum : undefined,
        sellingLocations: locName ? [locName] : [],
        storageLocation: locName || '',
        upc: upc
      },
      team.value.$id,
      'team'
    ));

    inventoryItems.value.unshift(doc);
    row.mappedItem = doc;
    row.isSearching = false;
    row.searchQuery = '';

    addToast({ type: 'success', message: `Added "${row.itemName}" to inventory (UPC: ${upc})!` });
  } catch (err: any) {
    console.error('Quick add failed:', err);
    addToast({ type: 'error', message: 'Failed to quick add item: ' + err.message });
  } finally {
    row.isQuickAdding = false;
  }
};

const bulkQuickAddAllUnmatched = async () => {
  if (!team.value) return;
  const unmapped = syncRows.value.filter(r => r.mappedItem === null);
  if (unmapped.length === 0) return;

  if (!confirm(`Create and link ${unmapped.length} new inventory items with auto-generated UPCs?`)) {
    return;
  }

  isBulkQuickAdding.value = true;
  let successCount = 0;
  const total = unmapped.length;
  try {
    const locName = currentLocation.value?.name || '';

    for (let idx = 0; idx < total; idx++) {
      const row = unmapped[idx];
      bulkProgressMessage.value = `Creating item ${idx + 1} of ${total}: "${row.itemName}"...`;
      try {
        const isSold = row.status === 'sold' || row.status === 'paid';
        const priceNum = parseFloat(String(row.salePrice || 0)) || 0;
        const upc = getNextUpc ? getNextUpc('HUCK-') : `HUCK-${Math.floor(1000 + Math.random() * 9000)}`;

        const doc = await withRetry(() => saveItemToInventory(
          {
            title: row.itemName || 'Unnamed Item',
            condition_notes: `Added from ${locName || 'Booth'} Sync. SKU: ${row.extractedSku || 'N/A'}`
          },
          null,
          {
            title: row.itemName || 'Unnamed Item',
            status: isSold ? 'sold' : 'placed',
            locationSku: row.extractedSku || '',
            cost: '0',
            resalePrice: String(priceNum),
            soldPrice: isSold ? priceNum : undefined,
            sellingLocations: locName ? [locName] : [],
            storageLocation: locName || '',
            upc: upc
          },
          team.value.$id,
          'team'
        ));

        inventoryItems.value.unshift(doc);
        row.mappedItem = doc;
        row.isSearching = false;
        row.searchQuery = '';
        successCount++;

        // 350ms delay between consecutive creations to avoid Appwrite rate limit spikes
        await new Promise(r => setTimeout(r, 350));
      } catch (rowErr) {
        console.error('Error creating row:', row, rowErr);
      }
    }

    addToast({ type: 'success', message: `Successfully created and linked ${successCount} new items to inventory!` });
  } catch (err: any) {
    console.error('Bulk quick add failed:', err);
    addToast({ type: 'error', message: 'Bulk add encountered an issue: ' + err.message });
  } finally {
    isBulkQuickAdding.value = false;
    bulkProgressMessage.value = '';
  }
};

const executeSync = async () => {
  if (!team.value) return;
  const mappedRows = syncRows.value.filter(r => r.mappedItem !== null);
  if (mappedRows.length === 0) {
    addToast({ type: 'warning', message: 'No items mapped to sync.' });
    return;
  }

  isCommitting.value = true;
  const locName = currentLocation.value?.name || 'Location';
  const commissionRate = currentLocation.value?.commissionRate || 0;

  try {
    let count = 0;
    const total = mappedRows.length;

    for (let idx = 0; idx < total; idx++) {
      const row = mappedRows[idx];
      bulkProgressMessage.value = `Syncing item ${idx + 1} of ${total}: "${row.itemName}"...`;
      const item = row.mappedItem;
      const isSold = row.status === 'sold' || row.status === 'paid';

      const updateData: any = {};
      if (row.extractedSku && (!item.locationSku || item.locationSku !== row.extractedSku)) {
        updateData.locationSku = row.extractedSku;
      }

      // Update sellingLocations
      let sellingLocs = Array.isArray(item.sellingLocations) ? [...item.sellingLocations] : (item.sellingLocations ? [item.sellingLocations] : []);
      if (!sellingLocs.includes(locName)) {
        sellingLocs.push(locName);
        updateData.sellingLocations = sellingLocs;
      }

      if (isSold) {
        updateData.status = 'sold';
        updateData.soldPrice = Number(row.salePrice || item.soldPrice || item.listPrice || 0);

        // Record official sale document in sales collection
        try {
          const gross = updateData.soldPrice;
          const commFee = gross * (commissionRate / 100);
          const net = gross - commFee;
          const soNum = await salesApi.generateSoNumber(team.value.$id);

          const saleDoc = await withRetry(() => salesApi.createSale({
            soNumber: soNum,
            warehouseId: selectedLocationId.value || '',
            orderId: row.extractedSku || '',
            saleDate: new Date().toISOString(),
            status: 'Sold',
            grossAmount: gross,
            commissionFee: commFee,
            netPayout: net,
            tenantId: team.value.$id
          }));

          updateData.saleId = saleDoc.$id;
        } catch (saleErr) {
          console.warn('Could not record sale document:', saleErr);
        }
      } else {
        if (['scouted', 'received', 'acquired'].includes(item.status)) {
          updateData.status = 'placed';
        }
      }

      if (Object.keys(updateData).length > 0) {
        await withRetry(() => databases.updateDocument(
          DB_ID,
          getCollectionId(),
          item.$id,
          updateData
        ));
      }

      count++;
      await new Promise(r => setTimeout(r, 200));
    }

    // 2-Way CSV Export
    if (exportUpdatedCsv.value && rawCsvLines.value.length > 0) {
      const headerCols = splitCsvLine(rawCsvLines.value[0]);
      let upcIdx = headerCols.findIndex(h => h.trim().toLowerCase() === 'upc' || h.trim().toLowerCase() === 'barcode');

      let newLines: string[] = [];

      if (upcIdx === -1) {
        newLines.push(`${rawCsvLines.value[0]},"UPC"`);
        for (let i = 1; i < rawCsvLines.value.length; i++) {
          const rowData = syncRows.value.find(r => r.originalLineIndex === i);
          const assignedUpc = rowData?.mappedItem?.upc || '';
          newLines.push(`${rawCsvLines.value[i]},"${assignedUpc}"`);
        }
      } else {
        newLines.push(rawCsvLines.value[0]);
        for (let i = 1; i < rawCsvLines.value.length; i++) {
          const cols = splitCsvLine(rawCsvLines.value[i]);
          const rowData = syncRows.value.find(r => r.originalLineIndex === i);
          if (rowData?.mappedItem?.upc) {
            cols[upcIdx] = rowData.mappedItem.upc;
          }
          newLines.push(cols.map(c => `"${c.replace(/"/g, '""')}"`).join(','));
        }
      }

      const blob = new Blob([newLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${locName.replace(/\s+/g, '_')}_Synced_Inventory_${new Date().toISOString().slice(0, 10)}.csv`;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    addToast({ type: 'success', message: `Successfully synced ${count} items to ${locName}!` });
    resetSync();
    if (team.value) {
      await fetchInventory('');
    }
  } catch (err: any) {
    console.error('Sync commit error:', err);
    addToast({ type: 'error', message: 'Failed to commit sync: ' + err.message });
  } finally {
    isCommitting.value = false;
  }
};

const loadData = async () => {
  if (!team.value) return;
  try {
    warehouses.value = await warehousesApi.listWarehouses(team.value.$id);
    await fetchInventory('');

    if (typeof window !== 'undefined' && window.location?.search) {
      const p = new URLSearchParams(window.location.search);
      const locName = p.get('location');
      if (locName) {
        const cleanTarget = locName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const found = warehouses.value.find(w => w.name.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget);
        if (found) {
          selectedLocationId.value = found.$id;
          return;
        }
      }
    }

    // Default to the first available location if not specified
    if (!selectedLocationId.value && warehouses.value.length > 0) {
      selectedLocationId.value = warehouses.value[0].$id;
    }
  } catch (err) {
    console.error("Failed to load locations:", err);
  }
};

onMounted(() => {
  loadData();
});

watch(team, () => {
  loadData();
});
</script>

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
      <div class="flex items-end gap-2 w-full md:w-auto">
        <div class="form-control flex-1 md:w-64">
          <label class="label py-1 flex justify-between items-center">
            <span class="label-text text-xs font-bold uppercase opacity-60">Target Location</span>
            <button @click="showNewLocationModal = true" class="text-[11px] text-primary hover:underline font-bold">+ New</button>
          </label>
          <select v-model="selectedLocationId" class="select select-bordered select-sm w-full font-bold">
            <option value="" disabled>Select a location...</option>
            <option v-for="loc in locations" :key="loc.$id" :value="loc.$id">
              {{ loc.name }} ({{ loc.type || 'Booth' }})
            </option>
          </select>
        </div>

        <div v-if="currentLocation" class="bg-base-200 p-2.5 rounded-xl border border-base-300 text-center shrink-0">
          <div class="text-[10px] uppercase font-bold opacity-60">Booth Fee</div>
          <div class="text-sm font-extrabold text-primary font-mono">{{ currentLocation.commissionRate || 0 }}%</div>
        </div>
      </div>
    </div>

    <!-- Quick Create Location Modal -->
    <div v-if="showNewLocationModal" class="modal modal-open">
      <div class="modal-box max-w-sm">
        <h3 class="font-bold text-lg flex items-center gap-2">
          <Icon icon="solar:shop-2-bold" class="w-5 h-5 text-primary" />
          Add Selling Location / Booth
        </h3>
        <div class="space-y-3 mt-4">
          <div class="form-control">
            <label class="label py-0.5"><span class="label-text text-xs font-bold">Location Name</span></label>
            <input type="text" v-model="newLocationForm.name" placeholder="e.g. Memory Den, Booth 42..." class="input input-bordered input-sm" />
          </div>
          <div class="form-control">
            <label class="label py-0.5"><span class="label-text text-xs font-bold">Location Type</span></label>
            <select v-model="newLocationForm.type" class="select select-bordered select-sm">
              <option value="Consignment Booth">Consignment Booth</option>
              <option value="Antique Mall">Antique Mall</option>
              <option value="Warehouse">Warehouse</option>
              <option value="Retail Store">Retail Store</option>
              <option value="Online">Online Marketplace</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="form-control">
              <label class="label py-0.5"><span class="label-text text-xs font-bold">Commission %</span></label>
              <input type="number" v-model="newLocationForm.commissionRate" placeholder="15" class="input input-bordered input-sm" />
            </div>
            <div class="form-control">
              <label class="label py-0.5"><span class="label-text text-xs font-bold">Monthly Rent ($)</span></label>
              <input type="number" v-model="newLocationForm.monthlyRent" placeholder="0" class="input input-bordered input-sm" />
            </div>
          </div>
        </div>
        <div class="modal-action">
          <button class="btn btn-sm btn-ghost" @click="showNewLocationModal = false">Cancel</button>
          <button class="btn btn-sm btn-primary" :disabled="!newLocationForm.name.trim() || isCreatingLocation" @click="createNewLocation">
            <span v-if="isCreatingLocation" class="loading loading-spinner loading-xs"></span>
            Save Location
          </button>
        </div>
      </div>
    </div>

    <!-- Step 1: Upload Dropzone (if no CSV is loaded) -->
    <div 
      v-if="syncRows.length === 0" 
      class="card bg-base-100 border-2 border-dashed shadow-sm p-12 text-center transition-all"
      :class="isDragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-base-300'"
      @dragover.prevent="isDragging = true" 
      @dragleave.prevent="isDragging = false" 
      @drop.prevent="handleDrop"
    >
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
          <input type="file" accept=".csv" class="hidden" @change="handleFileSelect" :disabled="isParsing" />
        </label>

        <div v-if="isParsing" class="mt-4 flex items-center gap-2 text-primary text-xs font-bold">
          <span class="loading loading-spinner loading-xs"></span> Parsing CSV & Matching Inventory...
        </div>
      </div>
    </div>

    <!-- Step 2: Full Reconciliation Workspace (once CSV loaded) -->
    <div v-else class="space-y-4">
      
      <!-- Metrics & Overview Header -->
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div class="bg-base-100 p-3.5 rounded-xl border border-base-200 shadow-sm flex items-center gap-3">
          <div class="p-2.5 bg-base-200 rounded-lg text-primary"><Icon icon="solar:documents-bold" class="w-5 h-5" /></div>
          <div>
            <div class="text-[11px] opacity-60">Total Rows</div>
            <div class="text-lg font-extrabold font-mono">{{ syncRows.length }}</div>
          </div>
        </div>

        <div class="bg-base-100 p-3.5 rounded-xl border border-base-200 shadow-sm flex items-center gap-3">
          <div class="p-2.5 bg-info/10 text-info rounded-lg"><Icon icon="solar:box-bold" class="w-5 h-5" /></div>
          <div>
            <div class="text-[11px] opacity-60">In-Stock</div>
            <div class="text-lg font-extrabold font-mono text-info">{{ inStockCount }} <span class="text-xs font-normal opacity-70">(${{ totalInStockGross.toFixed(0) }})</span></div>
          </div>
        </div>

        <div class="bg-base-100 p-3.5 rounded-xl border border-base-200 shadow-sm flex items-center gap-3">
          <div class="p-2.5 bg-secondary/10 text-secondary rounded-lg"><Icon icon="solar:cart-check-bold" class="w-5 h-5" /></div>
          <div>
            <div class="text-[11px] opacity-60">Gross Sold</div>
            <div class="text-lg font-extrabold font-mono text-secondary">${{ totalSoldGross.toFixed(2) }}</div>
          </div>
        </div>

        <div class="bg-base-100 p-3.5 rounded-xl border border-base-200 shadow-sm flex items-center gap-3">
          <div class="p-2.5 bg-success/10 text-success rounded-lg"><Icon icon="solar:dollar-bold" class="w-5 h-5" /></div>
          <div>
            <div class="text-[11px] opacity-60 font-bold text-success">Net Made (Take-Home)</div>
            <div class="text-lg font-extrabold font-mono text-success">${{ totalSoldNet.toFixed(2) }}</div>
          </div>
        </div>

        <div class="bg-base-100 p-3.5 rounded-xl border border-base-200 shadow-sm flex items-center gap-3">
          <div class="p-2.5 bg-primary/10 text-primary rounded-lg"><Icon icon="solar:check-circle-bold" class="w-5 h-5" /></div>
          <div>
            <div class="text-[11px] opacity-60">Matched in RC</div>
            <div class="text-lg font-extrabold font-mono" :class="matchedCount === syncRows.length ? 'text-success' : 'text-primary'">
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
              placeholder="Search title, SKU, price..." 
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

      <!-- Active Location Status Banner -->
      <div class="flex items-center justify-between bg-base-100 px-4 py-2.5 rounded-xl border border-base-200 text-xs">
        <div class="flex items-center gap-2">
          <Icon icon="solar:shop-2-bold" class="w-4 h-4 text-primary" />
          <span class="opacity-70">Target Location:</span>
          <span class="font-bold text-primary font-mono text-sm">{{ currentLocation ? currentLocation.name : 'No Location Selected' }}</span>
          <span v-if="currentLocation" class="badge badge-xs badge-neutral font-medium">{{ currentLocation.type || 'Consignment Booth' }}</span>
          <span v-if="currentLocation" class="badge badge-xs badge-outline badge-primary font-bold">{{ currentLocation.commissionRate || 15 }}% Booth Fee</span>
        </div>
        <div class="text-[11px] opacity-60">
          Syncing items will tag them with <code class="font-bold text-secondary">{{ currentLocation?.name || 'Location' }}</code> in selling channels.
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
                <th class="w-28">Location SKU</th>
                <th>CSV Product Title</th>
                <th class="w-24 text-right">Agreed Price</th>
                <th class="w-32 text-right text-success">Net Made (Take-Home)</th>
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
                <td class="font-semibold text-xs max-w-[260px] truncate" :title="row.itemName">
                  {{ row.itemName }}
                </td>

                <!-- Listed Agreed Price -->
                <td class="text-right font-mono text-xs opacity-75">
                  ${{ (row.listedPrice || 0).toFixed(2) }}
                </td>

                <!-- Net Take-Home Price (What you made after fees) -->
                <td class="text-right font-mono font-bold text-success text-xs">
                  <div>${{ (row.netSoldPrice || 0).toFixed(2) }}</div>
                  <div v-if="row.consignorPct && row.consignorPct < 100" class="text-[10px] font-normal text-base-content/60 font-sans">
                    {{ row.consignorPct }}% split (-${{ (row.commissionFee || 0).toFixed(2) }})
                  </div>
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
                    <button class="btn btn-xs btn-ghost btn-circle text-error ml-1 shrink-0" @click="row.mappedItem = null" title="Unlink Item">
                      ✕
                    </button>
                  </div>

                  <!-- Searchable Autocomplete Picker + Quick Add button if unmapped -->
                  <div v-else class="flex items-center gap-2">
                    <div class="relative flex-1">
                      <input 
                        type="text" 
                        v-model="row.searchQuery" 
                        @focus="row.isSearching = true"
                        placeholder="Search inventory to match..." 
                        class="input input-bordered input-xs w-full text-xs font-mono"
                      />
                      
                      <!-- Autocomplete Dropdown List -->
                      <div 
                        v-if="row.isSearching" 
                        class="absolute z-50 left-0 top-full mt-1 w-full bg-base-100 border border-base-300 rounded-lg shadow-xl max-h-52 overflow-y-auto"
                      >
                        <div class="p-1.5 border-b border-base-200 flex justify-between items-center text-[10px] opacity-70 bg-base-200/50">
                          <span>Select item from inventory:</span>
                          <button class="btn btn-ghost btn-xs text-error h-auto min-h-0 py-0.5 px-1" @click.stop="row.isSearching = false">Close</button>
                        </div>
                        <div 
                          v-for="item in getFilteredMatches(row.searchQuery)" 
                          :key="item.$id"
                          class="p-2 hover:bg-primary/10 cursor-pointer border-b border-base-200/50 last:border-0 flex items-center justify-between text-xs transition-colors"
                          @click="selectItemMatch(row, item)"
                        >
                          <div class="flex items-center gap-2 truncate pr-2">
                            <span class="badge badge-xs font-mono font-bold" :class="item.upc ? 'badge-primary' : 'badge-ghost'">
                              {{ item.upc || 'NO UPC' }}
                            </span>
                            <span class="font-semibold truncate">{{ item.title }}</span>
                          </div>
                          <span class="font-mono text-[11px] opacity-75 shrink-0">${{ Number(item.resalePrice || item.listPrice || 0).toFixed(2) }}</span>
                        </div>
                        <div v-if="getFilteredMatches(row.searchQuery).length === 0" class="p-3 text-center text-xs opacity-50">
                          No matching items found
                        </div>
                      </div>
                    </div>

                    <!-- Quick Add Button per row -->
                    <button 
                      class="btn btn-xs btn-outline btn-primary shrink-0 gap-1"
                      :disabled="row.isQuickAdding"
                      @click="quickAddRow(row)"
                      title="Quick create this item in ResaleCommand inventory with next barcode"
                    >
                      <span v-if="row.isQuickAdding" class="loading loading-spinner loading-xs"></span>
                      <Icon v-else icon="solar:add-circle-bold" class="w-3.5 h-3.5" />
                      + Quick Add
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
import { useAuth } from '../../composables/useAuth';
import { useInventory } from '../../composables/useInventory';
import { addToast } from '../../stores/toast';
import { warehousesApi } from '../../lib/warehouses';
import { salesApi } from '../../lib/sales';
import { databases } from '../../lib/appwrite';
import { DB_ID, getCollectionId, saveItemToInventory, updateItemInInventory } from '../../lib/inventory';
import { Icon } from '@iconify/vue';

const { user, currentTeam: team } = useAuth();
const { inventoryItems, fetchInventory, getNextUpc } = useInventory();

const isDragging = ref(false);
const isParsing = ref(false);
const isCommitting = ref(false);
const isBulkQuickAdding = ref(false);
const bulkProgressMessage = ref('');
const filterTab = ref<'all' | 'instock' | 'sold' | 'matched' | 'unmatched'>('all');
const searchQuery = ref('');
const exportUpdatedCsv = ref(true);

const showNewLocationModal = ref(false);
const isCreatingLocation = ref(false);
const newLocationForm = ref({
  name: '',
  type: 'Consignment Booth',
  commissionRate: 15,
  monthlyRent: 0
});

const locations = ref<any[]>([]);
const selectedLocationId = ref<string>('');
const syncRows = ref<any[]>([]);
const rawCsvHeader = ref<string>('');
const rawCsvLines = ref<string[]>([]);

const currentLocation = computed(() => {
  return locations.value.find(l => l.$id === selectedLocationId.value) || null;
});

const inStockCount = computed(() => syncRows.value.filter(r => r.status !== 'sold' && r.status !== 'paid').length);
const soldCount = computed(() => syncRows.value.filter(r => r.status === 'sold' || r.status === 'paid').length);
const matchedCount = computed(() => syncRows.value.filter(r => r.mappedItem !== null).length);
const unmatchedCount = computed(() => syncRows.value.filter(r => r.mappedItem === null).length);

const totalInStockGross = computed(() => {
  return syncRows.value
    .filter(r => r.status !== 'sold' && r.status !== 'paid')
    .reduce((acc, r) => acc + (r.listedPrice || 0), 0);
});

const totalSoldGross = computed(() => {
  return syncRows.value
    .filter(r => r.status === 'sold' || r.status === 'paid')
    .reduce((acc, r) => acc + (r.listedPrice || r.netSoldPrice || 0), 0);
});

const totalSoldNet = computed(() => {
  return syncRows.value
    .filter(r => r.status === 'sold' || r.status === 'paid')
    .reduce((acc, r) => acc + (r.netSoldPrice || 0), 0);
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
      (r.listedPrice && r.listedPrice.toString().includes(q)) ||
      (r.netSoldPrice && r.netSoldPrice.toString().includes(q)) ||
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
  return all.filter(i => 
    (i.title && i.title.toLowerCase().includes(q)) || 
    (i.upc && i.upc.toLowerCase().includes(q)) || 
    (i.locationSku && i.locationSku.toLowerCase().includes(q)) ||
    (i.sku && i.sku.toLowerCase().includes(q))
  ).slice(0, 20);
};

const selectItemMatch = (row: any, item: any) => {
  row.mappedItem = item;
  row.isSearching = false;
  row.searchQuery = '';
};

// CSV Line Parser with RFC 4180 Quote Safety
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // Skip escaped double quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      let cleaned = current.trim();
      if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        cleaned = cleaned.slice(1, -1);
      }
      result.push(cleaned);
      current = '';
    } else {
      current += char;
    }
  }
  let cleaned = current.trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }
  result.push(cleaned);
  return result;
}

const handleDrop = (e: DragEvent) => {
  isDragging.value = false;
  if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
    processCsvFile(e.dataTransfer.files[0]);
  }
};

const handleFileSelect = (e: Event) => {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    processCsvFile(input.files[0]);
  }
};

const processCsvFile = (file: File) => {
  isParsing.value = true;
  const reader = new FileReader();

  reader.onload = (event) => {
    try {
      const text = event.target?.result as string;
      if (!text) {
        addToast({ type: 'error', message: 'Could not read CSV file.' });
        isParsing.value = false;
        return;
      }

      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) {
        addToast({ type: 'error', message: 'CSV file is empty or invalid.' });
        isParsing.value = false;
        return;
      }

      rawCsvHeader.value = lines[0];
      rawCsvLines.value = lines;

      const headerCols = splitCsvLine(lines[0]).map(h => (h || '').trim().toLowerCase().replace(/["']/g, ''));
      const skuIdx = headerCols.findIndex(h => h === 'sku' || h.includes('sku') || h.includes('barcode') || h.includes('custom sku'));
      const prodIdIdx = headerCols.findIndex(h => h === 'product id' || h.includes('product id') || h.includes('item id'));
      const nameIdx = headerCols.findIndex(h => h === 'name' || h.includes('name') || h.includes('title') || h.includes('item'));
      
      const amountIdx = headerCols.findIndex(h => h === 'amount' || h === 'final amount' || h === 'sold amount' || h === 'payout' || h === 'net amount');
      const agedPriceIdx = headerCols.findIndex(h => h.includes('aged price'));
      const agreedPriceIdx = headerCols.findIndex(h => h.includes('agreed price') || h === 'price' || h.includes('price') || h.includes('total'));
      
      const splitIdx = headerCols.findIndex(h => h.includes('consignor %') || h.includes('split') || h.includes('consignor percent'));
      const statusIdx = headerCols.findIndex(h => h === 'inventory' || h.includes('inventory') || h.includes('status'));

      const defaultCommissionRate = currentLocation.value?.commissionRate ?? 15;
      const activeItems = Array.isArray(inventoryItems.value) ? inventoryItems.value : [];

      const rows: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = splitCsvLine(lines[i]);
        if (cols.length === 0 || !cols.some(c => c.trim().length > 0)) continue;

        let rawSku = skuIdx !== -1 ? cols[skuIdx] : (prodIdIdx !== -1 ? cols[prodIdIdx] : '');
        let cleanSku = (rawSku || '').trim().replace(/^['"]+/, '').replace(/['"]+$/, '');

        let name = nameIdx !== -1 ? (cols[nameIdx] || '').trim() : `Row #${i}`;
        
        // Extract SKU from end of name if missing: "Item Name - 0EJ001"
        if (!cleanSku && name) {
          const match = name.match(/ - ([A-Z0-9-]+)$/i);
          if (match) {
            cleanSku = match[1];
          }
        }

        // 1. Determine Listed / Agreed Gross Price
        let agreedPriceVal = agreedPriceIdx !== -1 ? parseFloat((cols[agreedPriceIdx] || '').replace(/[^0-9.]/g, '')) || 0 : 0;
        let agedPriceVal = agedPriceIdx !== -1 ? parseFloat((cols[agedPriceIdx] || '').replace(/[^0-9.]/g, '')) || 0 : 0;
        let grossPrice = agreedPriceVal > 0 ? agreedPriceVal : agedPriceVal;

        // 2. Determine Consignor Split % (or booth fee)
        let consignorPct = 100 - defaultCommissionRate; // e.g. 85%
        if (splitIdx !== -1 && cols[splitIdx]) {
          const parsedSplit = parseFloat(cols[splitIdx].replace(/[^0-9.]/g, ''));
          if (parsedSplit > 0 && parsedSplit <= 100) {
            consignorPct = parsedSplit;
          }
        }

        // 3. Determine Net Amount Made After Fees
        let amountVal = amountIdx !== -1 ? parseFloat((cols[amountIdx] || '').replace(/[^0-9.]/g, '')) || 0 : 0;
        let netSoldPrice = 0;
        if (amountVal > 0 && amountVal !== grossPrice) {
          // Explicit payout column from a payout report
          netSoldPrice = amountVal;
        } else if (grossPrice > 0) {
          // Calculate take-home payout after booth commission (e.g. $200 * 0.85 = $170)
          netSoldPrice = Number((grossPrice * (consignorPct / 100)).toFixed(2));
        }

        let rawStatus = statusIdx !== -1 ? (cols[statusIdx] || '').trim().toLowerCase() : '';
        let isSoldOrPaid = rawStatus.includes('sold') || rawStatus.includes('paid') || (rawStatus.length === 0 && (amountVal > 0 || grossPrice > 0) && !headerCols.includes('inventory'));

        // Commission Fee
        let commFee = grossPrice > netSoldPrice ? Number((grossPrice - netSoldPrice).toFixed(2)) : 0;

        // Match against existing inventory items
        let matched = null;

        // 1. Match by SKU
        if (cleanSku && activeItems.length > 0) {
          const target = cleanSku.toLowerCase();
          matched = activeItems.find(item => {
            const iLocSku = (item?.locationSku || '').toLowerCase().trim().replace(/^['"]+/, '');
            const iSku = (item?.sku || '').toLowerCase().trim();
            return iLocSku === target || iSku === target;
          });
        }

        // 2. Match by exact or normalized UPC
        if (!matched && cleanSku && activeItems.length > 0) {
          const target = cleanSku.toLowerCase();
          matched = activeItems.find(item => (item?.upc || '').toLowerCase().trim() === target);
        }

        // 3. Match by Title
        if (!matched && name && activeItems.length > 0) {
          const cleanCsvName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
          matched = activeItems.find(item => {
            const cleanTitle = (item?.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanTitle && (cleanTitle === cleanCsvName || cleanTitle.includes(cleanCsvName) || cleanCsvName.includes(cleanTitle));
          });
        }

        rows.push({
          originalLineIndex: i,
          extractedSku: cleanSku,
          itemName: name,
          listedPrice: grossPrice,
          netSoldPrice: netSoldPrice,
          commissionFee: commFee,
          consignorPct: consignorPct,
          salePrice: netSoldPrice, // Fallback compatibility
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
  filterTab.value = 'all';
  searchQuery.value = '';
};

// Retry helper for handling Appwrite rate limits with countdown UI
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 8, initialDelay = 2500): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isRateLimit = err?.code === 429 || err?.message?.includes('Rate limit') || err?.message?.includes('429') || err?.message?.includes('rate');
      if (isRateLimit && attempt < maxRetries) {
        const waitMs = Math.min(initialDelay * Math.pow(1.6, attempt - 1), 20000);
        console.warn(`[Appwrite] Rate limit encountered. Backing off for ${Math.round(waitMs)}ms (attempt ${attempt}/${maxRetries})...`);
        const totalSec = Math.ceil(waitMs / 1000);
        for (let s = totalSec; s > 0; s--) {
          bulkProgressMessage.value = `⏳ Sync paused temporarily to protect cloud rate limits. Automatically resuming in ${s}s (attempt ${attempt}/${maxRetries})...`;
          await new Promise(res => setTimeout(res, 1000));
        }
      } else {
        throw err;
      }
    }
  }
  throw new Error('Sync paused too long due to rate limits. Please try again in a few moments.');
}

const quickAddRow = async (row: any) => {
  if (!team.value) return;
  row.isQuickAdding = true;
  try {
    const isSold = row.status === 'sold' || row.status === 'paid';
    const locName = currentLocation.value?.name || '';
    const listedPrice = Number(row.listedPrice || row.netSoldPrice || 0);
    const netSoldPrice = Number(row.netSoldPrice || row.listedPrice || 0);
    
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
        resalePrice: String(listedPrice),
        soldPrice: isSold ? netSoldPrice : undefined,
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

    addToast({ type: 'success', message: `Added "${row.itemName}" to inventory!` });
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
        const listedPrice = Number(row.listedPrice || row.netSoldPrice || 0);
        const netSoldPrice = Number(row.netSoldPrice || row.listedPrice || 0);
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
            resalePrice: String(listedPrice),
            soldPrice: isSold ? netSoldPrice : undefined,
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

        // 500ms delay between items to respect Appwrite API quotas
        await new Promise(r => setTimeout(r, 500));
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
  const commissionRate = currentLocation.value?.commissionRate || 15;

  try {
    let count = 0;
    const total = mappedRows.length;

    // Prefetch base SO number once upfront instead of per item
    let nextSoNum = 1000;
    try {
      const initialSo = await withRetry(() => salesApi.generateSoNumber(team.value.$id));
      const match = initialSo.match(/SO-(\d+)/);
      if (match) nextSoNum = parseInt(match[1], 10);
    } catch (e) {
      console.warn('Initial SO lookup fallback:', e);
    }

    for (let idx = 0; idx < total; idx++) {
      const row = mappedRows[idx];
      bulkProgressMessage.value = `Syncing item ${idx + 1} of ${total}: "${row.itemName}"...`;
      const item = row.mappedItem;
      const isSold = row.status === 'sold' || row.status === 'paid';

      const updateData: any = {};
      
      // Update location SKU
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
        const gross = Number(row.listedPrice || row.netSoldPrice || 0);
        const net = Number(row.netSoldPrice || (gross * (1 - (commissionRate / 100))));
        const commFee = Number(row.commissionFee || (gross - net));

        updateData.status = 'sold';
        updateData.resalePrice = gross;
        updateData.soldPrice = net; // The exact amount made after fees!

        // Record official sale document in sales collection
        try {
          const soNum = `SO-${nextSoNum++}`;

          const saleDoc = await withRetry(() => salesApi.createSale({
            soNumber: soNum,
            warehouseId: currentLocation.value?.$id || '',
            orderId: row.extractedSku || `SYNC-${Date.now()}-${idx}`,
            saleDate: new Date().toISOString(),
            status: 'Sold',
            grossAmount: gross,
            commissionFee: commFee,
            shippingCharged: 0,
            shippingCost: 0,
            netPayout: net,
            tenantId: team.value.$id
          }));

          if (saleDoc?.$id) {
            updateData.saleId = saleDoc.$id;
          }
        } catch (saleErr) {
          console.error('Error creating sale document during sync:', saleErr);
        }
      } else {
        if (['scouted', 'received', 'acquired'].includes(item.status)) {
          updateData.status = 'placed';
        }
      }

      if (Object.keys(updateData).length > 0) {
        try {
          await withRetry(() => updateItemInInventory(
            item.$id,
            item,
            updateData
          ));

          // Update local item reference
          Object.assign(item, updateData);
          count++;
        } catch (itemErr: any) {
          console.warn(`Could not update document for "${row.itemName}":`, itemErr);
          addToast({ type: 'warning', message: `Could not update "${row.itemName}": ${itemErr.message || 'Error'}` });
        }

        // 400ms delay between consecutive items
        await new Promise(r => setTimeout(r, 400));
      } else {
        // Already up to date
        count++;
      }
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
      await fetchInventory();
    }
  } catch (err: any) {
    console.error('Sync commit error:', err);
    addToast({ type: 'error', message: 'Sync encountered an issue: ' + err.message });
  } finally {
    isCommitting.value = false;
    bulkProgressMessage.value = '';
  }
};

const createNewLocation = async () => {
  if (!team.value || !newLocationForm.value.name.trim()) return;
  isCreatingLocation.value = true;
  try {
    const doc = await warehousesApi.createWarehouse({
      name: newLocationForm.value.name.trim(),
      type: newLocationForm.value.type || 'Consignment Booth',
      commissionRate: Number(newLocationForm.value.commissionRate || 15),
      monthlyRent: Number(newLocationForm.value.monthlyRent || 0),
      tenantId: team.value.$id
    });
    locations.value.push(doc);
    selectedLocationId.value = doc.$id;
    showNewLocationModal.value = false;
    newLocationForm.value = { name: '', type: 'Consignment Booth', commissionRate: 15, monthlyRent: 0 };
    addToast({ type: 'success', message: `Added "${doc.name}" location!` });
  } catch (err: any) {
    console.error('Create location error:', err);
    addToast({ type: 'error', message: 'Failed to create location: ' + err.message });
  } finally {
    isCreatingLocation.value = false;
  }
};

const loadData = async () => {
  if (!team.value) return;
  try {
    locations.value = await warehousesApi.listWarehouses(team.value.$id);
    await fetchInventory();

    // If team has no locations created yet, auto-provision Memory Den
    if (locations.value.length === 0) {
      try {
        const defaultDen = await warehousesApi.createWarehouse({
          name: 'Memory Den',
          type: 'Consignment Booth',
          commissionRate: 15,
          monthlyRent: 0,
          tenantId: team.value.$id
        });
        locations.value = [defaultDen];
        selectedLocationId.value = defaultDen.$id;
      } catch (e) {
        console.warn('Auto-create Memory Den skipped:', e);
      }
    }

    if (typeof window !== 'undefined' && window.location?.search) {
      const p = new URLSearchParams(window.location.search);
      const locName = p.get('location');
      if (locName) {
        const cleanTarget = locName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const found = locations.value.find(w => w.name.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget);
        if (found) {
          selectedLocationId.value = found.$id;
          return;
        }
      }
    }

    // Default to the first available location if not specified
    if (!selectedLocationId.value && locations.value.length > 0) {
      selectedLocationId.value = locations.value[0].$id;
    }
  } catch (err) {
    console.error("Failed to load locations:", err);
  }
};

onMounted(() => {
  loadData();
});

watch(team, (newTeam) => {
  if (newTeam) {
    loadData();
  }
}, { immediate: true });
</script>

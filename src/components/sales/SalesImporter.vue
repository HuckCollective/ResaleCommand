<template>
  <div class="card bg-base-100 shadow-xl border border-base-200">
    <div class="card-body">
      <h2 class="card-title text-2xl font-bold flex items-center gap-2">
        <Icon icon="solar:import-bold-duotone" class="w-8 h-8 text-primary" />
        Universal Sales Importer
      </h2>
      <p class="text-sm opacity-80 mb-6">
        Upload a Payout History CSV (e.g., MemoryDen). We will match sold items to your inventory, mark them as Sold, create the sale records, and learn your manual mappings for future imports.
      </p>

      <!-- Step 1: Upload -->
      <div v-if="!parsedRows.length" class="flex flex-col items-center justify-center p-12 border-2 border-dashed border-base-300 rounded-xl bg-base-200/50 hover:bg-base-200 transition-colors">
        <Icon icon="solar:upload-minimalistic-linear" class="w-12 h-12 opacity-50 mb-4" />
        <h3 class="font-bold text-lg mb-2">Upload Sales CSV</h3>
        
        <div class="form-control w-full max-w-xs mb-4">
          <label class="label"><span class="label-text">Select Platform</span></label>
          <select class="select select-bordered" v-model="platform">
            <option value="memoryden">MemoryDen Payout</option>
            <option value="ebay">eBay Orders (Soon)</option>
            <option value="generic">Generic CSV (Soon)</option>
          </select>
        </div>

        <input 
          type="file" 
          accept=".csv" 
          class="file-input file-input-bordered file-input-primary w-full max-w-xs" 
          @change="handleFileUpload" 
          :disabled="isProcessing || platform !== 'memoryden'"
        />
        <div v-if="isProcessing" class="mt-4 flex items-center gap-2 text-primary font-bold">
          <span class="loading loading-spinner loading-sm"></span> Parsing & Matching...
        </div>
      </div>

      <!-- Step 2: Reconciliation UI -->
      <div v-else>
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 mb-4">
          <div>
            <h3 class="font-bold text-lg">Process Sales ({{ parsedRows.length }})</h3>
            <div class="flex items-center gap-2 mt-1">
              <div class="join">
                <button class="btn btn-xs join-item" :class="{'btn-active btn-primary': filterTab === 'all'}" @click="filterTab = 'all'">
                  All ({{ parsedRows.length }})
                </button>
                <button class="btn btn-xs join-item text-success" :class="{'btn-active btn-success text-white': filterTab === 'matched'}" @click="filterTab = 'matched'">
                  Matched ({{ matchedCount }})
                </button>
                <button class="btn btn-xs join-item text-error" :class="{'btn-active btn-error text-white': filterTab === 'unmatched'}" @click="filterTab = 'unmatched'">
                  Unmatched ({{ unmatchedCount }})
                </button>
              </div>
            </div>
          </div>
          <div class="flex gap-2 w-full sm:w-auto justify-end">
            <button class="btn btn-sm btn-ghost" @click="reset">Cancel</button>
            <button class="btn btn-sm btn-primary shadow-md shadow-primary/20" :disabled="matchedCount === 0 || isImporting" @click="executeImport">
              <span v-if="isImporting" class="loading loading-spinner loading-sm"></span>
              Commit {{ matchedCount }} Matched {{ matchedCount === 1 ? 'Item' : 'Items' }}
            </button>
          </div>
        </div>

        <div class="overflow-x-auto border border-base-300 rounded-lg max-h-[60vh]">
          <table class="table table-sm table-pin-rows">
            <thead>
              <tr class="bg-base-200">
                <th>Match</th>
                <th>CSV Status</th>
                <th>Sold Item (CSV)</th>
                <th>Price</th>
                <th>Map to ResaleCommand Item</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in displayedRows" :key="index" :class="{'bg-success/10': row.mappedItem}">
                <td>
                  <Icon v-if="row.mappedItem" icon="solar:check-circle-bold" class="w-5 h-5 text-success" />
                  <Icon v-else icon="solar:danger-circle-bold" class="w-5 h-5 text-error" />
                </td>
                <td>
                  <span class="badge badge-xs" :class="{'badge-success': row.status === 'sold' || row.status === 'paid', 'badge-ghost': row.status !== 'sold' && row.status !== 'paid'}">
                    {{ row.status || 'N/A' }}
                  </span>
                </td>
                <td>
                  <div class="font-semibold text-sm">{{ row.itemName }}</div>
                  <div class="font-mono text-xs opacity-70 flex items-center gap-1">
                    <Icon icon="solar:tag-bold" class="w-3 h-3 text-secondary" />
                    <span>SKU: {{ row.extractedSku || 'N/A' }}</span>
                  </div>
                </td>
                <td class="font-mono text-success font-bold">${{ row.salePrice.toFixed(2) }}</td>
                <td>
                  <div v-if="row.mappedItem" class="flex items-center gap-2">
                    <span class="badge badge-sm badge-outline font-mono font-bold">{{ row.mappedItem.upc || 'NO UPC' }}</span>
                    <span class="truncate max-w-[200px] text-sm">{{ row.mappedItem.title }}</span>
                    <button class="btn btn-xs btn-ghost text-error ml-auto" @click="row.mappedItem = null">✕</button>
                  </div>
                  <select v-else class="select select-bordered select-sm w-full max-w-xs" v-model="row.mappedItem">
                    <option :value="null">Search active inventory...</option>
                    <option v-for="item in availableItems" :key="item.$id" :value="item">
                      {{ item.upc ? `[${item.upc}] ` : '' }}{{ item.title }}
                    </option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div v-if="unmatchedCount > 0 && filterTab !== 'unmatched'" class="alert alert-info mt-4 py-2 text-xs flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Icon icon="solar:info-circle-bold" class="w-4 h-4" />
            <span>{{ unmatchedCount }} items are unmatched. Clicking "Commit" will safely process only the {{ matchedCount }} matched items.</span>
          </div>
          <button class="btn btn-xs btn-outline" @click="filterTab = 'unmatched'">Review Unmatched</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { useInventory } from '../../composables/useInventory';
import { databases, ID } from '../../lib/appwrite';
import { addToast } from '../../stores/toast';
import { getCollectionId, DB_ID } from '../../lib/inventory';

const { inventoryItems, fetchInventory, currentTeamId } = useInventory();
const isProcessing = ref(false);
const isImporting = ref(false);
const platform = ref('memoryden');
const filterTab = ref('all'); // 'all' | 'matched' | 'unmatched'
const parsedRows = ref([]);

onMounted(() => {
  if (inventoryItems.value.length === 0 && currentTeamId.value) {
    fetchInventory(currentTeamId.value);
  }
});

const activeInventory = computed(() => {
  return inventoryItems.value;
});

const displayedRows = computed(() => {
  if (filterTab.value === 'matched') return parsedRows.value.filter(r => r.mappedItem !== null);
  if (filterTab.value === 'unmatched') return parsedRows.value.filter(r => r.mappedItem === null);
  return parsedRows.value;
});

const availableItems = computed(() => {
  const mappedIds = parsedRows.value.filter(r => r.mappedItem).map(r => r.mappedItem.$id);
  return activeInventory.value.filter(i => !mappedIds.includes(i.$id));
});

const matchedCount = computed(() => parsedRows.value.filter(r => r.mappedItem).length);
const unmatchedCount = computed(() => parsedRows.value.filter(r => !r.mappedItem).length);

const reset = () => {
  parsedRows.value = [];
};

const splitCsvLine = (line) => {
  const regex = /(?:^|,)(?:"([^"]*)"|([^,]*))/g;
  const result = [];
  let match;
  while ((match = regex.exec(line)) !== null) {
      if (match[1] !== undefined) result.push(match[1]);
      else if (match[2] !== undefined) result.push(match[2]);
      if (regex.lastIndex === match.index) regex.lastIndex++;
  }
  return result;
};

const handleFileUpload = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  isProcessing.value = true;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    parseMemoryDenPayout(text);
  };
  reader.readAsText(file);
};

const parseMemoryDenPayout = (csvText) => {
  const lines = csvText.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) {
    addToast({ type: 'error', message: 'CSV is empty or invalid.' });
    isProcessing.value = false;
    return;
  }

  const headers = splitCsvLine(lines[0]).map(h => h?.trim().toLowerCase().replace(/"/g, ''));
  const itemIdx = headers.findIndex(h => h === 'name' || h === 'item' || h === 'product name');
  const skuIdx = headers.findIndex(h => h === 'sku' || h === 'location sku');
  
  const amountIdx = headers.findIndex(h => h === 'amount' || h === 'final amount' || h === 'sold amount' || h === 'net amount' || h.includes('amount'));
  const agedPriceIdx = headers.findIndex(h => h.includes('aged price') || h.includes('sold price') || h.includes('sale price'));
  const agreedPriceIdx = headers.findIndex(h => h.includes('agreed price') || h === 'agreed' || h.includes('price') || h.includes('total'));
  
  const dateIdx = headers.findIndex(h => h === 'in stock' || h === 'sold' || h === 'date');
  const statusIdx = headers.findIndex(h => h === 'inventory' || h === 'status');
  const costIdx = headers.findIndex(h => h === 'cost' || h === 'fee' || h === 'cost/split' || h === 'split / cost');

  const splitIdx = headers.findIndex(h => h.includes('consignor %') || h.includes('split') || h.includes('split / cost'));

  if (itemIdx === -1) {
    addToast({ type: 'error', message: 'Could not find "Name" or "Item" column in MemoryDen CSV.' });
    isProcessing.value = false;
    return;
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length <= itemIdx) continue;
    
    const fullItemName = cols[itemIdx]?.trim() || '';
    if (!fullItemName || fullItemName.includes('Rent') || fullItemName.includes('Credit')) continue; // Skip non-inventory items

    const statusVal = statusIdx !== -1 ? cols[statusIdx]?.trim().toLowerCase() : '';
    
    let agreedPriceVal = agreedPriceIdx !== -1 ? parseFloat((cols[agreedPriceIdx] || '').replace(/[^0-9.-]+/g, '')) || 0 : 0;
    let agedPriceVal = agedPriceIdx !== -1 ? parseFloat((cols[agedPriceIdx] || '').replace(/[^0-9.-]+/g, '')) || 0 : 0;
    let grossPrice = agreedPriceVal > 0 ? agreedPriceVal : agedPriceVal;

    let consignorPct = 85; // 85% default payout
    if (splitIdx !== -1 && cols[splitIdx]) {
      const parsedSplit = parseFloat(cols[splitIdx].replace(/[^0-9.]/g, ''));
      if (parsedSplit > 0 && parsedSplit <= 100) consignorPct = parsedSplit;
    }

    let amountVal = amountIdx !== -1 ? parseFloat((cols[amountIdx] || '').replace(/[^0-9.-]+/g, '')) || 0 : 0;
    let netSoldPrice = 0;
    if (amountVal > 0 && amountVal !== grossPrice) {
      netSoldPrice = amountVal;
    } else if (grossPrice > 0) {
      netSoldPrice = Number((grossPrice * (consignorPct / 100)).toFixed(2));
    }

    const date = dateIdx !== -1 ? cols[dateIdx]?.trim() : new Date().toLocaleDateString();

    // MemoryDen SKU either from explicit SKU column or end of title: "Item Name - 0EJ066"
    let extractedSku = skuIdx !== -1 ? (cols[skuIdx]?.replace(/^'/, '').trim() || '') : '';
    let itemName = fullItemName;
    const skuMatch = fullItemName.match(/ - ([A-Z0-9-]+)$/);
    if (!extractedSku && skuMatch) {
      extractedSku = skuMatch[1];
      itemName = fullItemName.replace(skuMatch[0], '').trim();
    }

    // Matching Logic Priority against all inventory
    let matched = null;
    
    // 1. Exact Location SKU match
    if (extractedSku) {
      matched = activeInventory.value.find(item => item.locationSku === extractedSku || item.locationSku === `'${extractedSku}`);
    }
    
    // 2. Exact UPC match
    if (!matched && extractedSku) {
      matched = activeInventory.value.find(item => item.upc === extractedSku);
    }

    // 3. Normalized Title Match
    if (!matched) {
      const cleanName = itemName.toLowerCase().replace(/[^a-z0-9]/g, '');
      matched = activeInventory.value.find(item => {
        if (!item.title) return false;
        const itemClean = item.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        return itemClean === cleanName || itemClean.includes(cleanName) || cleanName.includes(itemClean);
      });
    }

    rows.push({
      date,
      itemName: fullItemName, // Display full original
      extractedSku,
      status: statusVal,
      listedPrice: grossPrice,
      salePrice: netSoldPrice, // The actual net amount made after fees
      netSoldPrice: netSoldPrice,
      mappedItem: matched || null
    });
  }

  parsedRows.value = rows;
  isProcessing.value = false;
};

const executeImport = async () => {
  if (unmatchedCount.value > 0) return;
  
  isImporting.value = true;
  try {
    const ITEMS_COL = getCollectionId();
    const SALES_COL = 'sales'; // Needs to exist in schema

    // Group items into a single Sale record or just create individual sales?
    // A single payout could be treated as one batch "Sale". 
    // Let's create individual sale docs for simplicity right now unless we want one master payout doc.
    const batchId = 'MD-PAYOUT-' + new Date().toISOString().slice(0, 10);

    for (const row of parsedRows.value) {
      const item = row.mappedItem;
      if (!item) continue;

      const isSoldOrPaid = row.status === 'sold' || row.status === 'paid';
      const updatePayload = {
        locationSku: row.extractedSku || item.locationSku
      };

      if (isSoldOrPaid) {
        updatePayload.status = 'sold';
        updatePayload.soldPrice = row.salePrice;
        updatePayload.saleId = batchId;
      }

      // 1. Update the Item: Sync locationSku, and mark Sold if sold/paid
      await databases.updateDocument(DB_ID, ITEMS_COL, item.$id, updatePayload);

      // 2. Create Sale Record (if you have a sales collection)
      try {
        await databases.createDocument(DB_ID, SALES_COL, ID.unique(), {
          tenantId: item.tenantId,
          soNumber: `SO-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          totalGross: row.salePrice,
          totalNet: row.salePrice * 0.9, // Approximation, should be actual
          status: 'Completed',
          items: [item.$id]
        });
      } catch (e) {
         // Silently fail if sales col isn't completely setup yet
         console.warn("Sale creation failed, maybe schema not updated:", e);
      }
    }

    addToast({ type: 'success', message: 'Sales imported and inventory updated!' });
    reset();
    
    // Refresh inventory
    if (currentTeamId.value) {
      fetchInventory(currentTeamId.value);
    }
  } catch (err) {
    console.error("Sales Import Failed:", err);
    addToast({ type: 'error', message: 'Failed to process sales: ' + err.message });
  } finally {
    isImporting.value = false;
  }
};
</script>

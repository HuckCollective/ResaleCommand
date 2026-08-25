<template>
  <div class="card bg-base-100 shadow-xl border border-base-200">
    <div class="card-body">
      <h2 class="card-title text-2xl font-bold flex items-center gap-2">
        <Icon icon="solar:round-transfer-horizontal-bold-duotone" class="w-8 h-8 text-primary" />
        Initial Inventory Sync
      </h2>
      <p class="text-sm opacity-80 mb-6">
        Upload your active <strong>Products CSV</strong> from your location (e.g., MemoryDen). 
        We will map your current inventory to your ResaleCommand items, save their internal SKU, and generate a fresh CSV that injects your Custom UPCs into their system.
      </p>

      <!-- Step 1: Upload -->
      <div v-if="!parsedRows.length" class="flex flex-col items-center justify-center p-12 border-2 border-dashed border-base-300 rounded-xl bg-base-200/50 hover:bg-base-200 transition-colors">
        <Icon icon="solar:upload-minimalistic-linear" class="w-12 h-12 opacity-50 mb-4" />
        <h3 class="font-bold text-lg mb-2">Upload Products CSV</h3>
        <input 
          type="file" 
          accept=".csv" 
          class="file-input file-input-bordered file-input-primary w-full max-w-xs" 
          @change="handleFileUpload" 
          :disabled="isProcessing"
        />
        <div v-if="isProcessing" class="mt-4 flex items-center gap-2 text-primary font-bold">
          <span class="loading loading-spinner loading-sm"></span> Parsing...
        </div>
      </div>

      <!-- Step 2: Reconciliation UI -->
      <div v-else>
        <div class="flex justify-between items-end mb-4">
          <div>
            <h3 class="font-bold text-lg">Reconcile Items ({{ parsedRows.length }})</h3>
            <p class="text-xs opacity-70">
              <span class="text-success font-bold">{{ mappedCount }} mapped</span> • 
              <span class="text-error font-bold">{{ unmappedCount }} unmatched</span>
            </p>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-sm btn-ghost" @click="reset">Cancel</button>
            <button class="btn btn-sm btn-primary" :disabled="unmappedCount > 0 || isExporting" @click="executeSync">
              <span v-if="isExporting" class="loading loading-spinner loading-sm"></span>
              Sync & Export CSV
            </button>
          </div>
        </div>

        <div class="overflow-x-auto border border-base-300 rounded-lg max-h-[60vh]">
          <table class="table table-sm table-pin-rows">
            <thead>
              <tr class="bg-base-200">
                <th>Status</th>
                <th>CSV Item Name</th>
                <th>Location SKU</th>
                <th>Map to ResaleCommand Item</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in parsedRows" :key="index" :class="{'bg-success/10': row.mappedItem}">
                <td>
                  <Icon v-if="row.mappedItem" icon="solar:check-circle-bold" class="w-5 h-5 text-success" />
                  <Icon v-else icon="solar:danger-circle-bold" class="w-5 h-5 text-error" />
                </td>
                <td class="font-semibold">{{ row.itemName }}</td>
                <td class="font-mono text-xs opacity-80">{{ row.locationSku }}</td>
                <td>
                  <div v-if="row.mappedItem" class="flex items-center gap-2">
                    <span class="badge badge-sm badge-outline">{{ row.mappedItem.upc || 'NO UPC' }}</span>
                    <span class="truncate max-w-50 text-sm">{{ row.mappedItem.title }}</span>
                    <button class="btn btn-xs btn-ghost text-error ml-auto" @click="row.mappedItem = null">✕</button>
                  </div>
                  <select v-else class="select select-bordered select-sm w-full max-w-xs" v-model="row.mappedItem">
                    <option :value="null">Select match...</option>
                    <option v-for="item in availableItems" :key="item.$id" :value="item">
                      {{ item.upc || 'N/A' }} - {{ item.title }}
                    </option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div v-if="unmappedCount > 0" class="alert alert-warning mt-4 py-2">
          <Icon icon="solar:danger-triangle-bold" class="w-5 h-5" />
          <span class="text-sm">You must map all items (or delete the unmapped rows) before exporting.</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { useInventory } from '../../composables/useInventory';
import { databases } from '../../lib/appwrite';
import { addToast } from '../../stores/toast';

const { inventoryItems, fetchInventory, currentTeamId } = useInventory();
const isProcessing = ref(false);
const isExporting = ref(false);
const parsedRows = ref([]);
const rawCsvHeader = ref('');
const rawCsvLines = ref([]);

// We assume the user has already loaded inventory globally, but let's be safe
onMounted(() => {
  if (inventoryItems.value.length === 0 && currentTeamId.value) {
    fetchInventory(currentTeamId.value);
  }
});

const availableItems = computed(() => {
  // Only show items that haven't been mapped yet
  const mappedIds = parsedRows.value.filter(r => r.mappedItem).map(r => r.mappedItem.$id);
  return inventoryItems.value.filter(i => !mappedIds.includes(i.$id));
});

const mappedCount = computed(() => parsedRows.value.filter(r => r.mappedItem).length);
const unmappedCount = computed(() => parsedRows.value.filter(r => !r.mappedItem).length);

const reset = () => {
  parsedRows.value = [];
  rawCsvHeader.value = '';
  rawCsvLines.value = [];
};

const handleFileUpload = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  isProcessing.value = true;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    parseCsv(text);
  };
  reader.readAsText(file);
};

// Very basic CSV parser to handle quotes
const splitCsvLine = (line) => {
  const regex = /(?:^|,)(?:"([^"]*)"|([^,]*))/g;
  const result = [];
  let match;
  while ((match = regex.exec(line)) !== null) {
      if (match[1] !== undefined) result.push(match[1]);
      else if (match[2] !== undefined) result.push(match[2]);
      if (regex.lastIndex === match.index) regex.lastIndex++;
  }
  if (line.endsWith(',')) result.push('');
  return result;
};

const escapeCsv = (str) => {
    if (str === null || str === undefined) return '';
    const s = String(str).replace(/"/g, '""').replace(/\n/g, ' ');
    if (s.includes(',') || s.includes('"') || s.startsWith(' ') || s.endsWith(' ')) {
        return `"${s}"`;
    }
    return s;
};

const parseCsv = (csvText) => {
  // Strip BOM if present
  if (csvText.charCodeAt(0) === 0xFEFF) {
    csvText = csvText.substring(1);
  }
  const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) {
    addToast({ type: 'error', message: 'CSV file is empty or invalid.' });
    isProcessing.value = false;
    return;
  }

  rawCsvHeader.value = lines[0];
  rawCsvLines.value = lines;
  
  const headers = splitCsvLine(lines[0]).map(h => h.trim());
  const itemIdx = headers.findIndex(h => h.toLowerCase() === 'item' || h.toLowerCase() === 'title');
  const skuIdx = headers.findIndex(h => h.toLowerCase() === 'sku');

  if (itemIdx === -1 || skuIdx === -1) {
    addToast({ type: 'error', message: 'Could not find "Item" or "SKU" columns in CSV.' });
    isProcessing.value = false;
    return;
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < Math.max(itemIdx, skuIdx)) continue;
    
    const itemName = cols[itemIdx].trim();
    const locationSku = cols[skuIdx].trim();

    // Auto-match logic (Fuzzy match by exact title for now)
    let matched = inventoryItems.value.find(item => 
      item.title.toLowerCase() === itemName.toLowerCase() || 
      (item.locationSku && item.locationSku === locationSku)
    );

    rows.push({
      originalLineIndex: i,
      itemName,
      locationSku,
      mappedItem: matched || null
    });
  }

  parsedRows.value = rows;
  isProcessing.value = false;
};

const executeSync = async () => {
  if (unmappedCount.value > 0) return;
  
  isExporting.value = true;
  try {
    const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
    const ITEMS_COL = import.meta.env.PUBLIC_APPWRITE_COLLECTION_ID || 'inventory';

    // 1. Two-way DB update: Save Location SKU to Appwrite
    let updatePromises = [];
    for (const row of parsedRows.value) {
      if (row.mappedItem && row.mappedItem.locationSku !== row.locationSku) {
        updatePromises.push(
          databases.updateDocument(DB_ID, ITEMS_COL, row.mappedItem.$id, {
            locationSku: row.locationSku
          })
        );
      }
    }
    
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
      addToast({ type: 'success', message: `Saved Location SKUs to ${updatePromises.length} items.` });
    }

    // 2. Export CSV (Injecting our UPC into their UPC column)
    const headers = splitCsvLine(rawCsvHeader.value);
    const upcIdx = headers.findIndex(h => h.toLowerCase() === 'upc');
    
    let finalCsv = rawCsvHeader.value + '\n';
    
    for (const row of parsedRows.value) {
      const cols = splitCsvLine(rawCsvLines.value[row.originalLineIndex]);
      if (row.mappedItem) {
        const upcToInject = row.mappedItem.upc || row.mappedItem.$id;
        // Escape quotes if needed
        if (upcIdx !== -1) {
             cols[upcIdx] = upcToInject;
        }
      }
      
      finalCsv += cols.map(c => escapeCsv(c)).join(',') + '\n';
    }

    // Download file
    const blob = new Blob([finalCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Synced_Products_${new Date().toISOString().slice(0, 10)}.csv`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast({ type: 'success', message: 'Sync complete! Upload this CSV to MemoryDen.' });
    reset();
  } catch (err) {
    console.error("Sync Export Failed:", err);
    addToast({ type: 'error', message: 'Failed to complete sync: ' + err.message });
  } finally {
    isExporting.value = false;
  }
};
</script>

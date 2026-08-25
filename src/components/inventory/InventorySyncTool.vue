<template>
  <div class="card bg-base-100 shadow-xl border border-base-200">
    <div class="card-body">
      <h2 class="card-title text-2xl font-bold flex items-center gap-2">
        <Icon icon="solar:synchronize-bold-duotone" class="w-8 h-8 text-secondary" />
        MemoryDen Inventory Sync
      </h2>
      <p class="text-sm opacity-80 mb-6">
        Upload your active <b>Products CSV</b> from MemoryDen. We will match your active items, inject your custom UPCs, and give you a fresh CSV to re-upload to MemoryDen to permanently link the two systems!
      </p>

      <!-- Step 1: Upload -->
      <div v-if="!parsedRows.length" class="flex flex-col items-center justify-center p-12 border-2 border-dashed border-base-300 rounded-xl bg-base-200/50 hover:bg-base-200 transition-colors">
        <Icon icon="solar:upload-minimalistic-linear" class="w-12 h-12 opacity-50 mb-4" />
        <h3 class="font-bold text-lg mb-2">Upload Products CSV</h3>
        
        <input 
          type="file" 
          accept=".csv" 
          class="file-input file-input-bordered file-input-secondary w-full max-w-xs" 
          @change="handleFileUpload" 
          :disabled="isProcessing"
        />
        <div v-if="isProcessing" class="mt-4 flex items-center gap-2 text-secondary font-bold">
          <span class="loading loading-spinner loading-sm"></span> Parsing & Matching...
        </div>
      </div>

      <!-- Step 2: Reconciliation UI -->
      <div v-else>
        <div class="flex justify-between items-end mb-4">
          <div>
            <h3 class="font-bold text-lg">Sync Active Inventory ({{ parsedRows.length }})</h3>
            <p class="text-xs opacity-70">
              <span class="text-success font-bold">{{ matchedCount }} auto-matched</span> • 
              <span class="text-info font-bold">{{ aiMatchedCount }} AI matched</span> • 
              <span class="text-warning font-bold">{{ unmatchedCount }} unmatched</span>
            </p>
          </div>
          <div class="flex gap-2">
            <button v-if="unmatchedCount > 0" class="btn btn-sm btn-info text-white shadow-lg shadow-info/20" :disabled="isAskingAi || isSyncing" @click="askAiToMatch">
              <span v-if="isAskingAi" class="loading loading-spinner loading-sm"></span>
              <Icon v-else icon="solar:magic-stick-3-bold-duotone" class="w-4 h-4" />
              Ask AI to Match ({{ unmatchedCount }})
            </button>
            
            <button class="btn btn-sm btn-ghost" @click="reset">Cancel</button>
            <button class="btn btn-sm btn-secondary" :disabled="isSyncing || isAskingAi" @click="executeSync">
              <span v-if="isSyncing" class="loading loading-spinner loading-sm"></span>
              Export Synced CSV
            </button>
          </div>
        </div>

        <div class="overflow-x-auto border border-base-300 rounded-lg max-h-[60vh]">
          <table class="table table-sm table-pin-rows">
            <thead>
              <tr class="bg-base-200">
                <th>Status</th>
                <th>MemoryDen Product (CSV)</th>
                <th>MD SKU</th>
                <th>Map to ResaleCommand Item</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in parsedRows" :key="index" :class="{'bg-success/10': row.mappedItem, 'bg-base-200 opacity-60': row.isIgnored}">
                <td>
                  <Icon v-if="row.mappedItem" icon="solar:check-circle-bold" class="w-5 h-5 text-success" />
                  <Icon v-else-if="row.isIgnored" icon="solar:minus-circle-bold" class="w-5 h-5 text-base-content/40" />
                  <Icon v-else icon="solar:danger-circle-bold" class="w-5 h-5 text-warning" />
                </td>
                <td>
                  <div class="font-semibold max-w-xs truncate" :title="row.originalTitle">{{ row.originalTitle }}</div>
                  <div class="text-xs opacity-50">PID: {{ row.productId }}</div>
                </td>
                <td class="font-mono text-xs">{{ row.extractedSku }}</td>
                <td>
                  <div v-if="row.mappedItem" class="flex items-center gap-2">
                    <span v-if="row.isAiMatch" class="badge badge-sm badge-info text-white shadow-sm gap-1">
                      <Icon icon="solar:magic-stick-3-bold" class="w-3 h-3" /> AI
                    </span>
                    <span class="badge badge-sm badge-outline">{{ row.mappedItem.upc || 'NO UPC' }}</span>
                    <span class="truncate max-w-50 text-sm">{{ row.mappedItem.title }}</span>
                    <button class="btn btn-xs btn-ghost text-error ml-auto" @click="row.mappedItem = null; row.isAiMatch = false; row.isIgnored = false">✕</button>
                  </div>
                  <div v-else-if="row.isIgnored" class="flex items-center gap-2">
                    <span class="badge badge-sm badge-ghost opacity-70">Ignored</span>
                    <button class="btn btn-xs btn-ghost ml-auto" @click="row.isIgnored = false">Undo</button>
                  </div>
                  <div v-else class="flex items-center gap-2">
                    <button class="btn btn-xs btn-outline w-32" @click="openSearchModal(index)">
                      <Icon icon="solar:magnifer-linear" class="w-3 h-3" /> Search to Map
                    </button>
                    <button class="btn btn-xs btn-ghost text-xs opacity-50" @click="row.isIgnored = true">Ignore Item</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    
    <!-- Search Modal -->
    <dialog id="search_modal" class="modal">
      <div class="modal-box w-11/12 max-w-2xl bg-base-100 p-0 overflow-hidden flex flex-col max-h-[80vh]">
        <div class="p-4 border-b border-base-200 bg-base-200/50 flex justify-between items-center">
          <h3 class="font-bold text-lg flex items-center gap-2">
            <Icon icon="solar:magnifer-linear" class="w-5 h-5 text-primary" /> Map: {{ activeMappingRowIndex !== null ? parsedRows[activeMappingRowIndex]?.originalTitle : 'Item' }}
          </h3>
          <form method="dialog">
            <button class="btn btn-sm btn-circle btn-ghost">✕</button>
          </form>
        </div>
        
        <div class="p-4 bg-base-200/30">
          <div class="join w-full">
            <div class="join-item flex items-center justify-center px-4 bg-base-100 border border-base-300 border-r-0 rounded-l-lg">
              <Icon icon="solar:magnifer-linear" class="w-4 h-4 opacity-50" />
            </div>
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="Search your database by title, SKU, or UPC..." 
              class="input input-bordered join-item w-full focus:outline-none" 
              autofocus
            />
          </div>
        </div>

        <div class="overflow-y-auto flex-1 p-0">
          <table class="table table-sm w-full">
            <thead class="bg-base-200 sticky top-0 z-10">
              <tr>
                <th>Image</th>
                <th>UPC / SKU</th>
                <th>Title</th>
                <th class="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="filteredSearchItems.length === 0">
                <td colspan="4" class="text-center py-8 text-base-content/50">No items found matching "{{ searchQuery }}"</td>
              </tr>
              <tr v-for="item in filteredSearchItems" :key="item.$id" class="hover:bg-base-200/50 transition-colors">
                <td>
                  <div class="avatar">
                    <div class="w-8 h-8 rounded bg-base-300">
                      <img v-if="item.imageId" :src="getAssetUrl(item.imageId)" class="object-cover w-full h-full" alt="Item" />
                      <img v-else-if="item.galleryImageIds?.length" :src="getAssetUrl(item.galleryImageIds[0])" class="object-cover w-full h-full" alt="Item" />
                      <Icon v-else icon="solar:box-minimalistic-linear" class="w-full h-full p-2 opacity-50" />
                    </div>
                  </div>
                </td>
                <td>
                  <div class="flex flex-col">
                    <span class="font-mono text-xs font-bold">{{ item.upc || 'NO UPC' }}</span>
                    <span class="text-[10px] opacity-70">{{ item.locationSku || 'No SKU' }}</span>
                  </div>
                </td>
                <td class="text-sm">
                  <div class="font-medium truncate max-w-75">{{ item.title }}</div>
                </td>
                <td class="text-right">
                  <span v-if="timesMapped(item) > 0" class="text-xs text-warning mr-2">
                    Mapped {{ timesMapped(item) }}/{{ parseInt(item.quantity) || 1 }}
                  </span>
                  <button class="btn btn-xs btn-primary" :disabled="isAlreadyMapped(item)" @click="selectMappedItem(item)">
                    Select
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div class="p-4 border-t border-base-200 bg-base-100 flex justify-end">
           <button class="btn btn-sm" @click="ignoreItemAndClose">Ignore Item</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { useInventory } from '../../composables/useInventory';
import { useAuth } from '../../composables/useAuth';
import { databases, ID } from '../../lib/appwrite';
import { addToast } from '../../stores/toast';

const { inventoryItems, fetchInventory } = useInventory();
const { currentTeam } = useAuth();
const isProcessing = ref(false);
const isSyncing = ref(false);
const isAskingAi = ref(false);
const parsedRows = ref<any[]>([]);
const rawHeaders = ref<string[]>([]);

// Search Modal State
const searchQuery = ref('');
const activeMappingRowIndex = ref<number | null>(null);

const getAssetUrl = (id: string) => {
  if (!id) return '';
  const endpoint = import.meta.env.PUBLIC_APPWRITE_ENDPOINT;
  const project = import.meta.env.PUBLIC_APPWRITE_PROJECT_ID;
  const bucket = import.meta.env.PUBLIC_APPWRITE_BUCKET_ID;
  return `${endpoint}/storage/buckets/${bucket}/files/${id}/view?project=${project}`;
};

// Restore session from localStorage on mount
onMounted(() => {
  const savedState = localStorage.getItem('inventorySyncState');
  if (savedState) {
    try {
      const parsed = JSON.parse(savedState);
      if (parsed && parsed.parsedRows && parsed.rawHeaders) {
        parsedRows.value = parsed.parsedRows;
        rawHeaders.value = parsed.rawHeaders;
        addToast({ type: 'info', message: 'Restored previous sync session.' });
      }
    } catch (e) {
      console.error("Failed to restore sync state", e);
    }
  }
});

// Auto-save session
watch(parsedRows, (newVal) => {
  if (newVal && newVal.length > 0) {
    localStorage.setItem('inventorySyncState', JSON.stringify({
      parsedRows: newVal,
      rawHeaders: rawHeaders.value
    }));
  }
}, { deep: true });

// Fetch inventory on mount or when team is ready
watch(() => currentTeam.value, (team) => {
  if (team && inventoryItems.value.length === 0) {
    fetchInventory(team.$id);
  }
}, { immediate: true });

const activeInventory = computed(() => {
  return inventoryItems.value; // Allow mapping ALL items, even sold ones
});

const availableItems = computed(() => {
  const mappedIds = parsedRows.value.filter(r => r.mappedItem).map(r => r.mappedItem.$id);
  return activeInventory.value.filter(i => !mappedIds.includes(i.$id));
});

const matchedCount = computed(() => parsedRows.value.filter(r => r.mappedItem && !r.isAiMatch).length);
const aiMatchedCount = computed(() => parsedRows.value.filter(r => r.mappedItem && r.isAiMatch).length);
const unmatchedCount = computed(() => parsedRows.value.filter(r => !r.mappedItem).length);

const reset = () => {
  parsedRows.value = [];
  rawHeaders.value = [];
  localStorage.removeItem('inventorySyncState');
};

const splitCsvLine = (line: string) => {
  const regex = /(?:^|,)(?:"([^"]*)"|([^,]*))/g;
  const result = [];
  let match;
  while ((match = regex.exec(line)) !== null) {
      if (match[1] !== undefined) result.push(match[1]);
      else if (match[2] !== undefined) result.push(match[2]);
      if (regex.lastIndex === match.index) regex.lastIndex++;
  }
  // If the line ended with a comma, we need to push an empty string for the last column
  if (line.endsWith(',')) result.push('');
  return result;
};

const escapeCsv = (str: any) => {
    if (str === null || str === undefined) return '';
    const s = String(str).replace(/"/g, '""').replace(/\n/g, ' ');
    if (s.includes(',') || s.includes('"') || s.startsWith(' ') || s.endsWith(' ')) {
        return `"${s}"`;
    }
    return s;
};

const ignoreItemAndClose = () => {
  if (activeMappingRowIndex.value !== null) {
    parsedRows.value[activeMappingRowIndex.value].mappedItem = null;
    parsedRows.value[activeMappingRowIndex.value].isAiMatch = false;
    parsedRows.value[activeMappingRowIndex.value].isIgnored = true;
  }
  closeSearchModal();
};

const selectMappedItem = (item: any) => {
  if (activeMappingRowIndex.value !== null) {
    parsedRows.value[activeMappingRowIndex.value].mappedItem = item;
    parsedRows.value[activeMappingRowIndex.value].isAiMatch = false;
    parsedRows.value[activeMappingRowIndex.value].isIgnored = false;
  }
  closeSearchModal();
};

const openSearchModal = (rowIndex: number) => {
  activeMappingRowIndex.value = rowIndex;
  searchQuery.value = parsedRows.value[rowIndex].originalTitle || '';
  const modal = document.getElementById('search_modal') as HTMLDialogElement;
  if (modal) {
    modal.showModal();
  }
};

const closeSearchModal = () => {
  const modal = document.getElementById('search_modal') as HTMLDialogElement;
  if (modal) {
    modal.close();
  }
  activeMappingRowIndex.value = null;
  searchQuery.value = '';
};

const filteredSearchItems = computed(() => {
  let items = activeInventory.value;
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    items = items.filter(item => {
      const titleMatch = (item.title || item.itemName || '').toLowerCase().includes(query);
      const idMatch = (item.identity || item.upc || item.$id || '').toLowerCase().includes(query);
      const binMatch = (item.storageLocation || '').toLowerCase().includes(query);
      const skuMatch = (item.locationSku || '').toLowerCase().includes(query);
      const keywordMatch = Array.isArray(item.keywords) && item.keywords.some(k => k.toLowerCase().includes(query));
      
      return titleMatch || idMatch || binMatch || skuMatch || keywordMatch;
    });
  }
  return items.slice(0, 50); // limit for performance in modal
});

  const timesMapped = (item: any) => {
    return parsedRows.value.filter(r => r.mappedItem?.$id === item.$id).length;
  };

  const isAlreadyMapped = (item: any) => {
    const qty = parseInt(item.quantity) || 1;
    return timesMapped(item) >= qty;
  };

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  isProcessing.value = true;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    parseMemoryDenProducts(text);
  };
  reader.readAsText(file);
};

const parseMemoryDenProducts = (csvText) => {
  // Strip BOM if present
  if (csvText.charCodeAt(0) === 0xFEFF) {
    csvText = csvText.substring(1);
  }
  
  const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) {
    addToast({ type: 'error', message: 'CSV is empty or invalid.' });
    isProcessing.value = false;
    return;
  }

  // Store exact raw headers to rebuild CSV perfectly
  rawHeaders.value = lines[0];
  
  const headers = splitCsvLine(lines[0]).map(h => h?.trim().toLowerCase().replace(/"/g, ''));
  const idIdx = headers.findIndex(h => h === 'product id');
  const skuIdx = headers.findIndex(h => h === 'sku');
  const upcIdx = headers.findIndex(h => h === 'upc');
  const nameIdx = headers.findIndex(h => h === 'name');

  if (nameIdx === -1 || upcIdx === -1) {
    addToast({ type: 'error', message: 'Could not find "Name" or "UPC" column in MemoryDen CSV.' });
    isProcessing.value = false;
    return;
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < nameIdx) continue; // Skip invalid lines
    
    const productId = idIdx !== -1 ? cols[idIdx] : '';
    const extractedSku = skuIdx !== -1 ? cols[skuIdx]?.replace(/'/g, '').trim() : ''; // MD puts ' in front of SKU sometimes
    const originalTitle = cols[nameIdx]?.trim() || '';
    if (!originalTitle) continue;

    // Matching Logic Priority
    let matched = null;
    
    // 1. Exact UPC match 
    if (extractedSku) {
      matched = activeInventory.value.find(item => item.upc === extractedSku);
    }
    // 2. Exact Location SKU match
    if (!matched && extractedSku) {
      matched = activeInventory.value.find(item => item.locationSku === extractedSku);
    }
    // 3. Fuzzy Title Fallback
    if (!matched) {
      const cleanTarget = originalTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
      matched = activeInventory.value.find(item => {
          if (!item.title) return false;
          const cleanItem = item.title.toLowerCase().replace(/[^a-z0-9]/g, '');
          // Match if they are identical after stripping punctuation, or if one is completely contained in the other
          return cleanItem === cleanTarget || (cleanTarget.length > 5 && cleanItem.includes(cleanTarget)) || (cleanItem.length > 5 && cleanTarget.includes(cleanItem));
      });
    }

    rows.push({
      originalCols: cols,
      productId,
      extractedSku,
      originalTitle,
      upcIdx,
      skuIdx,
      mappedItem: matched || null,
      isAiMatch: false,
      isIgnored: false
    });
  }

  parsedRows.value = rows;
  isProcessing.value = false;
};

const askAiToMatch = async () => {
  if (unmatchedCount.value === 0) return;
  
  isAskingAi.value = true;
  try {
    const unmatched = parsedRows.value
      .map((r, index) => ({ index, title: r.originalTitle, sku: r.extractedSku }))
      .filter(r => !parsedRows.value[r.index].mappedItem);
      
    const available = availableItems.value.map(i => ({ id: i.$id, title: i.title, sku: i.locationSku }));

    const res = await fetch('/api/match-inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unmatchedCsvItems: unmatched, availableDbItems: available })
    });

    if (!res.ok) throw new Error("Failed to reach AI matching service.");
    
    const data = await res.json();
    if (data.mappings && Array.isArray(data.mappings)) {
      let matchedCount = 0;
      data.mappings.forEach(mapping => {
        const row = parsedRows.value[mapping.csvIndex];
        const dbItem = availableItems.value.find(i => i.$id === mapping.dbId);
        if (row && dbItem && !row.mappedItem) {
          row.mappedItem = dbItem;
          row.isAiMatch = true;
          matchedCount++;
        }
      });
      addToast({ type: 'success', message: `AI successfully mapped ${matchedCount} items!` });
    }
  } catch (err) {
    console.error(err);
    addToast({ type: 'error', message: "AI matching failed: " + err.message });
  } finally {
    isAskingAi.value = false;
  }
};

const executeSync = async () => {
  isSyncing.value = true;
  try {
    const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
    const ITEMS_COL = import.meta.env.PUBLIC_APPWRITE_COLLECTION_ID || 'inventory';

    const finalCsvRows = [];
    finalCsvRows.push(rawHeaders.value);

    // Process all mapped items
    for (const row of parsedRows.value) {
      const item = row.mappedItem;
      const modifiedCols = [...row.originalCols];
      
      if (item) {
        // 1. We found a map! Save the MemoryDen SKU, update status to placed, and tag the location
        const updates = {};
        if (row.extractedSku && item.locationSku !== row.extractedSku) {
          updates.locationSku = row.extractedSku;
        }
        
        if (item.status !== 'placed' && item.status !== 'Sold' && item.status !== 'sold') {
          updates.status = 'placed';
        }
        
        const locs = Array.isArray(item.sellingLocations) ? [...item.sellingLocations] : [];
        if (!locs.includes('memoryden')) {
          locs.push('memoryden');
          updates.sellingLocations = locs;
        }

        if (Object.keys(updates).length > 0) {
          try {
            await databases.updateDocument(DB_ID, ITEMS_COL, item.$id, updates);
          } catch(e) {
             console.warn("Failed to update synced item ", item.$id, e);
          }
        }

        // 2. Inject the Appwrite item's UPC into the MemoryDen CSV UPC column
        if (row.upcIdx !== -1) {
            modifiedCols[row.upcIdx] = item.upc || '';
        }
      }

      // Add to export CSV
      finalCsvRows.push(modifiedCols.map(col => escapeCsv(col)).join(','));
    }

    // Generate Download
    const csvContent = finalCsvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Products-Synced-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast({ type: 'success', message: 'Sync complete! Upload this CSV to MemoryDen.' });
    reset();
    
    // Refresh inventory to pull new mappings
    if (currentTeam.value) {
      fetchInventory(currentTeam.value.$id);
    }
  } catch (err: any) {
    console.error("Sync Failed:", err);
    addToast({ type: 'error', message: 'Failed to sync: ' + err.message });
  } finally {
    isSyncing.value = false;
  }
};
</script>

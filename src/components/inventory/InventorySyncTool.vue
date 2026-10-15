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

      <!-- How Ricochet Sync Works Explainer on Upload Screen -->
      <div v-if="!parsedRows.length" class="mt-6 p-5 rounded-2xl bg-base-200/50 border border-base-300 space-y-3">
        <div class="flex items-center gap-2">
          <Icon icon="solar:info-circle-bold" class="w-5 h-5 text-secondary" />
          <h4 class="font-bold text-sm">How Ricochet POS Barcode Sync Works</h4>
        </div>
        <p class="text-xs opacity-70">
          Ricochet POS does not support re-uploading modified CSVs for existing items (it rejects existing SKUs as duplicates). Resale Command provides 2 automated browser options to update your barcodes directly:
        </p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs">
          <div class="p-3.5 rounded-xl bg-base-100 border border-base-300">
            <div class="flex items-center gap-1.5 font-bold mb-1 text-primary">
              <span class="badge badge-xs badge-primary font-mono">1</span>
              <span>Option 1: Preloaded DevTools Script (Fastest)</span>
            </div>
            <p class="opacity-75 text-[11px] leading-relaxed">
              Upload your CSV, match items, click <strong>Copy Option 1 Script</strong>, and paste into Chrome DevTools (F12) inside Ricochet to update all items automatically in real-time.
            </p>
          </div>
          <div class="p-3.5 rounded-xl bg-base-100 border border-base-300">
            <div class="flex items-center gap-1.5 font-bold mb-1 text-secondary">
              <span class="badge badge-xs badge-secondary font-mono">2</span>
              <span>Option 2: Userscript / Bookmarklet</span>
            </div>
            <p class="opacity-75 text-[11px] leading-relaxed">
              Install the Tampermonkey userscript or drag the bookmarklet to your browser. A floating sync widget appears directly inside your Ricochet dashboard screen.
            </p>
          </div>
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
            <button 
              type="button" 
              class="btn btn-sm btn-primary gap-1.5 font-bold shadow-md" 
              :disabled="matchedCount === 0 || isSyncing" 
              @click="showBrowserSyncModal = true"
              title="Inject UPCs directly into Ricochet POS via Browser (Bypasses CSV restriction)"
            >
              <Icon icon="solar:bolt-bold" class="w-4 h-4 text-warning" />
              <span>Browser Auto-Sync</span>
            </button>
            <button class="btn btn-sm btn-secondary" :disabled="isSyncing || isAskingAi" @click="executeSync">
              <span v-if="isSyncing" class="loading loading-spinner loading-sm"></span>
              Export Synced CSV
            </button>
          </div>
        </div>

        <!-- How to Sync into Ricochet Instructions Panel -->
        <div class="mb-5 bg-base-200/60 border border-base-300 rounded-2xl p-4 shadow-xs space-y-3">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-base-300/60 pb-3">
            <div class="flex items-center gap-2">
              <div class="p-1.5 bg-warning/10 text-warning rounded-lg">
                <Icon icon="solar:bolt-bold" class="w-5 h-5" />
              </div>
              <div>
                <h4 class="font-black text-sm text-base-content">How to Sync Barcodes to Ricochet POS</h4>
                <p class="text-[11px] opacity-70">
                  Ricochet blocks CSV re-imports for existing SKUs. Choose <strong>Option 1 (Easiest)</strong> or <strong>Option 2</strong> below to inject your barcodes directly.
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button 
                type="button" 
                class="btn btn-xs btn-primary gap-1 font-bold shadow-xs"
                :disabled="matchedCount === 0"
                @click="copyPreloadedConsoleScript"
              >
                <Icon icon="solar:copy-bold" class="w-3.5 h-3.5" />
                <span>⚡ Copy Option 1 Script ({{ matchedCount }})</span>
              </button>
            </div>
          </div>

          <!-- 2 Columns: Option 1 vs Option 2 -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <!-- Option 1 -->
            <div class="p-4 rounded-xl bg-base-100 border border-base-300/80 shadow-xs flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between gap-2 mb-2">
                  <div class="flex items-center gap-1.5 font-bold text-xs text-primary">
                    <span class="badge badge-xs badge-primary font-mono">1</span>
                    <span>Option 1: Preloaded Console Script (Recommended • Easiest)</span>
                  </div>
                  <span class="badge badge-xs badge-success text-[10px] font-bold">Fastest</span>
                </div>
                <p class="text-[11px] opacity-70 mb-2.5">
                  Zero extensions or installation needed. Runs directly inside your open Ricochet browser tab via DevTools.
                </p>
                <ol class="list-decimal list-inside space-y-1.5 text-[11px] opacity-85 leading-relaxed bg-base-200/40 p-2.5 rounded-lg border border-base-300/40 font-medium">
                  <li>Click <button type="button" class="btn btn-link btn-xs p-0 text-primary font-bold h-auto inline align-baseline" @click="copyPreloadedConsoleScript">Copy Script</button> to copy all {{ matchedCount }} items with your custom barcodes.</li>
                  <li>Switch to your open <strong>Memory Den / Ricochet</strong> tab (<code>memoryden.ricoconsign.com</code>).</li>
                  <li>Press <kbd class="kbd kbd-xs">F12</kbd> (or right-click anywhere ➔ <strong>Inspect</strong> ➔ click <strong>Console</strong>).</li>
                  <li>Paste (<kbd class="kbd kbd-xs">Ctrl + V</kbd>) and press <kbd class="kbd kbd-xs">Enter</kbd>.</li>
                  <li>Watch the real-time progress update each item:
                    <div class="font-mono text-[10px] bg-neutral text-neutral-content px-2 py-1 rounded mt-1">
                      ✓ [1/{{ matchedCount || 785 }}] 0EJ001 ➔ HUCK-0001<br/>
                      🎉 Sync Finished! {{ matchedCount || 785 }} items updated in Ricochet.
                    </div>
                  </li>
                </ol>
              </div>
              <div class="pt-3">
                <button 
                  type="button" 
                  class="btn btn-xs btn-primary font-bold w-full gap-1.5 shadow-xs"
                  :disabled="matchedCount === 0"
                  @click="copyPreloadedConsoleScript"
                >
                  <Icon icon="solar:copy-bold" class="w-3.5 h-3.5" />
                  <span>Copy Option 1 Script ({{ matchedCount }} items)</span>
                </button>
              </div>
            </div>

            <!-- Option 2 -->
            <div class="p-4 rounded-xl bg-base-100 border border-base-300/80 shadow-xs flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between gap-2 mb-2">
                  <div class="flex items-center gap-1.5 font-bold text-xs text-secondary">
                    <span class="badge badge-xs badge-secondary font-mono">2</span>
                    <span>Option 2: Visual Browser Button (Tampermonkey / Bookmarklet)</span>
                  </div>
                  <span class="badge badge-xs badge-ghost text-[10px]">Extension</span>
                </div>
                <p class="text-[11px] opacity-70 mb-2.5">
                  Adds a floating <strong>⚡ Ricochet UPC Sync</strong> widget directly inside your Ricochet dashboard screen.
                </p>
                <ol class="list-decimal list-inside space-y-1.5 text-[11px] opacity-85 leading-relaxed bg-base-200/40 p-2.5 rounded-lg border border-base-300/40 font-medium">
                  <li>Click <a href="/ricochet-upc-sync.user.js" target="_blank" class="link link-secondary font-bold">Install Userscript</a> (Tampermonkey) or drag the <strong>Bookmarklet</strong> to your bookmarks bar.</li>
                  <li>Open or refresh your Ricochet portal (<code>memoryden.ricoconsign.com</code>).</li>
                  <li>A floating widget appears in the bottom-right corner. Click it to open.</li>
                  <li>Drop your exported CSV from step 1 or click <strong>Start Auto-Sync</strong>.</li>
                  <li>Watch the live visual progress bar fill up until complete.</li>
                </ol>
              </div>
              <div class="pt-3 flex gap-2">
                <a 
                  href="/ricochet-upc-sync.user.js" 
                  target="_blank" 
                  class="btn btn-xs btn-secondary font-bold flex-1"
                >
                  Install Userscript
                </a>
                <a 
                  :href="bookmarkletHref" 
                  class="btn btn-xs btn-outline btn-secondary font-bold cursor-grab active:cursor-grabbing flex-1"
                  title="Drag this button to your Bookmarks Bar!"
                  @click.prevent="copyBookmarkletCode"
                >
                  Drag Bookmarklet
                </a>
              </div>
            </div>
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

    <!-- Browser Auto-Sync Helper Modal -->
    <dialog class="modal modal-bottom sm:modal-middle z-[85]" :class="{ 'modal-open': showBrowserSyncModal }">
      <div v-if="showBrowserSyncModal" class="modal-box bg-base-100 border border-base-300 shadow-2xl rounded-3xl p-6 max-w-2xl mx-auto space-y-4">
        <div class="flex items-center justify-between border-b border-base-200 pb-3">
          <div class="flex items-center gap-2.5">
            <div class="p-2.5 bg-primary/10 text-primary rounded-2xl">
              <Icon icon="solar:bolt-bold" class="w-6 h-6 text-warning" />
            </div>
            <div>
              <h3 class="font-black text-lg">Ricochet In-Browser UPC Auto-Sync</h3>
              <p class="text-xs opacity-60">Inject your HUCK-XXXX barcodes directly into Ricochet POS through your browser</p>
            </div>
          </div>
          <button type="button" class="btn btn-xs btn-ghost btn-circle" @click="showBrowserSyncModal = false">✕</button>
        </div>

        <div class="alert alert-info py-2.5 px-3.5 text-xs rounded-2xl flex items-start gap-2 shadow-xs">
          <Icon icon="solar:info-circle-bold" class="w-5 h-5 shrink-0 mt-0.5" />
          <span>
            Ricochet POS <strong>blocks CSV re-imports</strong> for existing SKUs. This browser tool uses your active Ricochet session to update the UPC fields automatically!
          </span>
        </div>

        <!-- 2 Clear Options -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
          <!-- Option 1: Preloaded Script -->
          <div class="p-4 rounded-2xl bg-base-200/60 border border-primary/30 flex flex-col justify-between shadow-xs">
            <div>
              <div class="flex items-center justify-between gap-1.5 mb-1.5">
                <div class="flex items-center gap-1.5 font-bold text-xs text-primary">
                  <span class="badge badge-xs badge-primary font-mono">1</span>
                  <span>Option 1: Preloaded Script</span>
                </div>
                <span class="badge badge-xs badge-success text-[10px] font-bold">Recommended • Fastest</span>
              </div>
              <p class="text-[11px] opacity-70 leading-relaxed mb-3">
                Zero extensions needed. Copies all {{ matchedCount }} matched items pre-bundled to paste into Chrome DevTools.
              </p>
              <div class="text-[11px] opacity-80 space-y-1 bg-base-100 p-2.5 rounded-xl border border-base-300 mb-3">
                <div class="font-bold text-[10px] uppercase tracking-wider text-base-content/60">Steps:</div>
                <div>1. Click <strong>Copy Option 1 Script</strong> below.</div>
                <div>2. Switch to your Ricochet tab.</div>
                <div>3. Press <kbd class="kbd kbd-xs">F12</kbd> ➔ <strong>Console</strong>.</div>
                <div>4. Paste & press <kbd class="kbd kbd-xs">Enter</kbd>.</div>
              </div>
            </div>
            <button 
              type="button" 
              class="btn btn-sm btn-primary font-bold text-white w-full gap-1.5 shadow-sm"
              :disabled="matchedCount === 0"
              @click="copyPreloadedConsoleScript"
            >
              <Icon icon="solar:copy-bold" class="w-4 h-4" />
              <span>Copy Option 1 Script ({{ matchedCount }})</span>
            </button>
          </div>

          <!-- Option 2: Tampermonkey Userscript / Bookmarklet -->
          <div class="p-4 rounded-2xl bg-base-200/60 border border-secondary/30 flex flex-col justify-between shadow-xs">
            <div>
              <div class="flex items-center justify-between gap-1.5 mb-1.5">
                <div class="flex items-center gap-1.5 font-bold text-xs text-secondary">
                  <span class="badge badge-xs badge-secondary font-mono">2</span>
                  <span>Option 2: Userscript / Bookmarklet</span>
                </div>
                <span class="badge badge-xs badge-ghost text-[10px]">Extension</span>
              </div>
              <p class="text-[11px] opacity-70 leading-relaxed mb-3">
                Installs a floating <strong>⚡ Ricochet UPC Sync</strong> button that appears directly inside your Ricochet dashboard.
              </p>
              <div class="text-[11px] opacity-80 space-y-1 bg-base-100 p-2.5 rounded-xl border border-base-300 mb-3">
                <div class="font-bold text-[10px] uppercase tracking-wider text-base-content/60">Steps:</div>
                <div>1. Install Userscript (or drag Bookmarklet).</div>
                <div>2. Visit <code>memoryden.ricoconsign.com</code>.</div>
                <div>3. Click the floating widget in the bottom-right.</div>
                <div>4. Drop your CSV or click <strong>Start Auto-Sync</strong>.</div>
              </div>
            </div>
            <div class="flex gap-2">
              <a 
                href="/ricochet-upc-sync.user.js" 
                target="_blank" 
                class="btn btn-sm btn-secondary font-bold flex-1"
              >
                Install Userscript
              </a>
              <a 
                :href="bookmarkletHref" 
                class="btn btn-sm btn-outline btn-secondary font-bold cursor-grab active:cursor-grabbing flex-1"
                title="Drag this button to your Bookmarks Bar!"
                @click.prevent="copyBookmarkletCode"
              >
                Drag Bookmarklet
              </a>
            </div>
          </div>
        </div>

        <div class="modal-action border-t border-base-200 pt-3 flex justify-between items-center">
          <span class="text-xs opacity-60 font-mono">{{ matchedCount }} item{{ matchedCount === 1 ? '' : 's' }} ready</span>
          <button type="button" class="btn btn-sm btn-ghost" @click="showBrowserSyncModal = false">Close</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showBrowserSyncModal = false">
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
import { getCollectionId, DB_ID } from '../../lib/inventory';

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

// Browser Auto-Sync Helper State
const showBrowserSyncModal = ref(false);

const bookmarkletHref = computed(() => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4321';
  return `javascript:(function(){const s=document.createElement('script');s.src='${origin}/ricochet-upc-sync.user.js?t='+Date.now();document.body.appendChild(s);})();`;
});

const copyBookmarkletCode = () => {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(bookmarkletHref.value);
    addToast({ type: 'info', message: 'Bookmarklet code copied! Drag it to your bookmarks bar or paste into a new bookmark URL.' });
  }
};

const copyPreloadedConsoleScript = () => {
  const matched = parsedRows.value
    .filter(r => r.mappedItem && r.mappedItem.upc)
    .map(r => ({
      id: r.productId || '',
      sku: r.extractedSku || '',
      upc: r.mappedItem.upc || '',
      title: r.mappedItem.title || r.originalTitle || ''
    }));

  if (matched.length === 0) {
    addToast({ type: 'warning', message: 'No mapped items with UPCs to export.' });
    return;
  }

  const script = `// ⚡ Resale Command ➔ Ricochet Preloaded UPC Auto-Sync
(async function() {
  const items = \${JSON.stringify(matched, null, 2)};
  console.log('%c[Resale Command]%c Starting bulk UPC sync for ' + items.length + ' items...', 'background:#4f46e5;color:#fff;padding:2px 8px;border-radius:4px;font-weight:bold;', '');
  
  if (!window.axios) {
    alert('Please run this script inside your logged-in Ricochet portal (e.g. memoryden.ricoconsign.com)');
    return;
  }

  // 1. Fetch recent products for consignor (scans up to 800 items sorted desc)
  console.log('%c[Resale Command]%c Scanning your consignor catalog in Ricochet...', 'background:#4f46e5;color:#fff;padding:2px 6px;border-radius:4px;', '');
  let catalog = [];
  let consignorId = null;

  for (let offset = 0; offset < 800; offset += 100) {
    try {
      const q = consignorId ? '&consignor_id=' + consignorId : '';
      const catRes = await window.axios.get('/api/product?store=1&limit=100&offset=' + offset + '&order_by=id&direction=desc' + q);
      const prods = catRes.data.products || (Array.isArray(catRes.data) ? catRes.data : []);
      if (!consignorId && prods[0]?.consignor_id) {
        consignorId = prods[0].consignor_id;
      }
      const myProds = consignorId ? prods.filter(p => !p.consignor_id || p.consignor_id === consignorId) : prods;
      catalog.push(...myProds);
      if (prods.length < 100) break;
    } catch (e) {
      break;
    }
  }
  console.log('📡 Loaded ' + catalog.length + ' consignor products from Ricochet.');

  let success = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const cleanSku = (item.sku || '').trim().toUpperCase();
    const cleanTitle = (item.title || '').trim().toLowerCase();

    // Matching Strategy: Exact ID -> Direct SKU -> Exact Title -> Fuzzy Title
    let prod = null;
    if (item.id) {
      prod = catalog.find(p => String(p.id) === String(item.id));
    }
    if (!prod && cleanSku) {
      prod = catalog.find(p => {
        if (p.sku && p.sku.toUpperCase() === cleanSku) return true;
        if (p.sku_quantities && Object.keys(p.sku_quantities).some(s => s.trim().toUpperCase() === cleanSku)) return true;
        return false;
      });
    }
    if (!prod && cleanTitle) {
      const titleWords = cleanTitle.replace(/[^a-z0-9\\s]/g, '').split(/\\s+/).filter(w => w.length > 2);
      prod = catalog.find(p => {
        const pName = (p.name || p.title || '').toLowerCase().replace(/[^a-z0-9\\s]/g, '');
        if (pName === cleanTitle.replace(/[^a-z0-9\\s]/g, '')) return true;
        if (titleWords.length >= 2) {
          const prefix = titleWords[0] + ' ' + titleWords[1];
          if (pName.includes(prefix)) return true;
        }
        return false;
      });
    }

    if (!prod) {
      console.warn('✕ [' + (i+1) + '/' + items.length + '] Skipping "' + (item.title || cleanSku) + '": No match found in Ricochet catalog');
      failed++;
      continue;
    }

    try {
      const detailRes = await window.axios.get('/api/product/show/' + prod.id);
      const payload = detailRes.data.product || detailRes.data.data || detailRes.data;
      const allItems = Array.isArray(payload.items) ? payload.items : Object.values(payload.items || {}).flat();
      const targetItem = allItems[0];

      if (!targetItem) {
        console.warn('✕ Product ' + prod.id + ' (' + prod.name + ') has no items payload');
        failed++;
        continue;
      }

      if (targetItem.upc_code === item.upc) {
        console.log('ℹ️ [' + (prod.name || targetItem.sku) + '] Already has UPC: ' + item.upc);
        success++;
        continue;
      }

      targetItem.store = 1;
      targetItem.upc_code = item.upc;

      const saveRes = await window.axios.put('/api/product/items', targetItem);
      if (saveRes.status === 200 || saveRes.status === 201) {
        success++;
        console.log('%c✓ [' + (i+1) + '/' + items.length + '] ' + (prod.name || targetItem.sku) + ' ➔ UPC: ' + item.upc, 'color:#10b981;font-weight:bold;font-size:12px;');
      } else {
        console.warn('✕ HTTP ' + saveRes.status + ' on ' + prod.name);
        failed++;
      }
    } catch (err) {
      console.error('✕ Error on ' + (prod?.name || cleanSku) + ':', err.response?.data || err.message);
      failed++;
    }

    await new Promise(r => setTimeout(r, 200));
  }

  console.log('%c🎉 Sync Finished! ' + success + ' updated, ' + failed + ' failed.', 'color:#10b981;font-weight:bold;font-size:14px;');
  alert('🎉 Ricochet Barcode Sync Finished!\\n\\n' + success + ' items verified/updated in Ricochet.\\n' + failed + ' failed.\\nRefresh page to verify!');
})();`;

  navigator.clipboard.writeText(script);
  addToast({ type: 'success', message: `Copied preloaded script for ${matched.length} items to clipboard!` });
};

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
  const nameIdx = headers.findIndex(h => h === 'name' || h === 'title');
  const priceIdx = headers.findIndex(h => h === 'agreed price' || h === 'price');
  const agedPriceIdx = headers.findIndex(h => h === 'aged price');

  if (nameIdx === -1 || upcIdx === -1) {
    addToast({ type: 'error', message: 'Could not find "Name" or "UPC" column in MemoryDen CSV.' });
    isProcessing.value = false;
    return;
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < nameIdx) continue; // Skip invalid lines
    
    const productId = idIdx !== -1 ? cols[idIdx]?.trim() : '';
    const extractedSku = skuIdx !== -1 ? cols[skuIdx]?.replace(/['"]/g, '').trim() : ''; // MD puts ' in front of SKU sometimes
    const extractedUpc = upcIdx !== -1 ? cols[upcIdx]?.replace(/['"]/g, '').trim() : '';
    const originalTitle = cols[nameIdx]?.trim() || '';
    if (!originalTitle) continue;

    let csvPrice = 0;
    if (priceIdx !== -1 && cols[priceIdx]) {
      csvPrice = parseFloat(cols[priceIdx].replace(/[^0-9.]/g, '')) || 0;
    }
    if (csvPrice === 0 && agedPriceIdx !== -1 && cols[agedPriceIdx]) {
      csvPrice = parseFloat(cols[agedPriceIdx].replace(/[^0-9.]/g, '')) || 0;
    }

    // Matching Logic Priority
    let matched = null;
    
    // 1. Exact UPC match from CSV's UPC column (e.g. HUCK-5064 uploaded from Resale Command)
    if (extractedUpc) {
      const upcTarget = extractedUpc.toLowerCase();
      matched = activeInventory.value.find(item => (item.upc || '').toLowerCase().trim() === upcTarget);
    }
    // 2. Exact match by extractedSku against inventory UPC or locationSku
    if (!matched && extractedSku) {
      const skuTarget = extractedSku.toLowerCase();
      matched = activeInventory.value.find(item => {
        const u = (item.upc || '').toLowerCase().trim();
        const l = (item.locationSku || '').toLowerCase().trim().replace(/^['"]+/, '');
        return u === skuTarget || l === skuTarget;
      });
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
      extractedUpc,
      csvPrice,
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
    const ITEMS_COL = getCollectionId();

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

        // Sync list price if it changed in Ricochet POS
        if (row.csvPrice > 0 && Math.abs((Number(item.resalePrice || item.price) || 0) - row.csvPrice) > 0.01) {
          updates.resalePrice = row.csvPrice;
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

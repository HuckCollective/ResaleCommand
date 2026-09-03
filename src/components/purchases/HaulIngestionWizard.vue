<template>
  <div class="haul-ingestion-wizard bg-base-100 rounded-3xl border border-base-300 shadow-xl overflow-hidden">
    
    <!-- TOP HEADER & PROGRESS BAR -->
    <div class="bg-base-200/90 border-b border-base-300 p-4 sm:p-6 backdrop-blur">
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div class="flex-1 w-full max-w-2xl space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="badge badge-primary text-primary-content font-black text-xs uppercase tracking-wider px-2.5 py-1">
              Haul Intake & Receiving
            </span>
            <span v-if="poNumber" class="text-xs font-mono font-bold opacity-60">{{ poNumber }}</span>
            <span v-else class="badge badge-ghost badge-sm text-[10px] font-bold opacity-60">Draft PO</span>
          </div>

          <!-- PO / Haul Name (Editable anytime) -->
          <div class="flex items-center gap-2 w-full">
            <input 
              type="text" 
              v-model="poVendor" 
              placeholder="Name this Haul (e.g. Goodwill Bins, Estate Sale...)" 
              class="input input-sm sm:input-md input-bordered font-black text-base sm:text-xl w-full bg-base-100/90 border-base-300 focus:border-primary"
            />
            <button @click="autoDerivePoName" class="btn btn-sm sm:btn-md btn-ghost border border-base-300 bg-base-100 hover:bg-base-200 text-primary font-bold shrink-0 gap-1" title="Auto-Derive Name">
              <Icon icon="solar:magic-stick-3-bold" class="w-4 h-4" />
              <span class="text-xs hidden sm:inline">Auto-Name</span>
            </button>
          </div>

          <p class="text-xs opacity-70">
            {{ items.length }} Line Item(s) • Total Landed Cost: <strong class="text-success font-bold">${{ totalLandedCost.toFixed(2) }}</strong>
          </p>
        </div>

        <!-- Wizard Step Indicators -->
        <div class="steps steps-horizontal text-xs font-bold w-full md:w-auto shrink-0">
          <button @click="currentStep = 1" class="step cursor-pointer" :class="{ 'step-primary': currentStep >= 1 }">1. Haul & Cost</button>
          <button @click="currentStep = 2" class="step cursor-pointer" :class="{ 'step-primary': currentStep >= 2 }">2. Unbox & AI Receive</button>
          <button @click="currentStep = 3" class="step cursor-pointer" :class="{ 'step-primary': currentStep >= 3 }">3. Route & Deploy</button>
        </div>
      </div>
    </div>

    <!-- STEP 1: REVIEW LINES & COST BASIS -->
    <div v-if="currentStep === 1" class="p-4 sm:p-6 space-y-5">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h3 class="text-lg font-extrabold text-base-content">Step 1: Haul Overview & Cost Basis</h3>
          <p class="text-xs opacity-70">Review purchase order line items and verify landed cost allocations.</p>
        </div>
      </div>

      <!-- Sourcing Options: 3 Ways to Ingest (Only shown when starting a fresh PO with 0 items) -->
      <div v-if="items.length === 0" class="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-base-200/60 rounded-2xl border border-base-300">
        <!-- Option 1: Scan Physical Receipt -->
        <a href="/purchases/speed-entry" class="flex items-center gap-3 p-3 rounded-xl bg-base-100 border border-base-300 hover:border-warning cursor-pointer transition-all shadow-xs group">
          <div class="w-10 h-10 rounded-xl bg-warning/10 text-warning flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Icon icon="solar:camera-bold-duotone" class="w-5 h-5" />
          </div>
          <div>
            <span class="text-xs font-black text-base-content block">1. Scan Receipt</span>
            <span class="text-[11px] opacity-60 block">Receipt camera OCR</span>
          </div>
        </a>

        <!-- Option 2: Upload CSV / SGW Report -->
        <label class="flex items-center gap-3 p-3 rounded-xl bg-base-100 border border-base-300 hover:border-primary cursor-pointer transition-all shadow-xs group text-left">
          <input type="file" accept=".csv,text/csv,.xlsx,.xls,*/*" @change="handleCsvImport" class="hidden" />
          <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Icon icon="solar:upload-track-bold-duotone" class="w-5 h-5" />
          </div>
          <div class="flex-1">
            <span class="text-xs font-black text-base-content block">2. Upload SGW / CSV</span>
            <span class="text-[11px] opacity-60 block">Instant CSV intake & landed cost</span>
          </div>
        </label>

        <!-- Option 3: Add Line Manually -->
        <button @click="addLineItem" class="flex items-center gap-3 p-3 rounded-xl bg-base-100 border border-base-300 hover:border-secondary cursor-pointer transition-all shadow-xs group text-left">
          <div class="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Icon icon="solar:add-circle-bold-duotone" class="w-5 h-5" />
          </div>
          <div>
            <span class="text-xs font-black text-base-content block">3. Add Line Manually</span>
            <span class="text-[11px] opacity-60 block">Type lines one-by-one</span>
          </div>
        </button>
      </div>

      <!-- Loaded PO Banner (Shown when items are already loaded from a PO) -->
      <div v-else class="flex items-center justify-between gap-3 p-3.5 bg-success/10 border border-success/25 rounded-2xl">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-success text-success-content flex items-center justify-center font-black text-sm shrink-0">
            ✓
          </div>
          <div>
            <h4 class="font-black text-xs sm:text-sm text-base-content">
              Loaded {{ items.length }} Line Item(s) from {{ poNumber || 'Purchase Order' }}
            </h4>
            <p class="text-[11px] opacity-70">
              Landed cost is already allocated. Ready for unboxing photos & pricing!
            </p>
          </div>
        </div>

        <button @click="currentStep = 2" class="btn btn-sm btn-primary text-primary-content font-black rounded-xl shadow-xs gap-1.5 shrink-0">
          <span>Go to AI Pricing</span>
          <Icon icon="solar:arrow-right-linear" class="w-4 h-4" />
        </button>
      </div>

      <!-- Order Filter Toolbar & Bulk Actions -->
      <div v-if="items.length > 0" class="flex flex-wrap items-center justify-between gap-3 p-3 bg-base-200/60 rounded-2xl border border-base-300">
        <div class="flex items-center gap-2">
          <span class="text-xs font-extrabold opacity-70">Showing:</span>
          <select v-model="selectedOrderFilter" class="select select-bordered select-xs font-bold text-xs">
            <option value="all">All Items ({{ items.length }})</option>
            <option v-for="ord in uniqueOrders" :key="ord.id" :value="ord.id">
              Order #{{ ord.id }} ({{ ord.count }} items)
            </option>
          </select>
        </div>

        <div class="flex items-center gap-2">
          <button v-if="hasNumericSgwTitles" @click="fetchMissingSgwDetails" :disabled="fetchingSgw" 
                  class="btn btn-xs btn-primary text-primary-content font-black gap-1 shadow-sm">
            <span v-if="fetchingSgw" class="loading loading-spinner loading-xs"></span>
            <template v-else>
              <Icon icon="solar:magic-stick-3-bold" class="w-3.5 h-3.5" />
              Fetch Real SGW Titles
            </template>
          </button>
          <button @click="addLineItem" class="btn btn-xs btn-outline btn-secondary font-bold gap-1">
            <Icon icon="solar:add-circle-bold" class="w-3.5 h-3.5" /> + Add Line
          </button>
          <button @click="clearAllItems" class="btn btn-xs btn-ghost text-error hover:bg-error/20 font-bold gap-1">
            <Icon icon="solar:trash-bin-trash-bold" class="w-3.5 h-3.5" /> Clear All
          </button>
        </div>
      </div>

      <!-- Empty State when no items loaded -->
      <div v-if="items.length === 0" class="text-center py-10 px-4 border-2 border-dashed border-base-300 rounded-3xl bg-base-200/40 space-y-2">
        <div class="w-12 h-12 rounded-2xl bg-base-300 text-base-content/60 flex items-center justify-center mx-auto">
          <Icon icon="solar:box-minimalistic-linear" class="w-6 h-6 opacity-70" />
        </div>
        <h4 class="font-bold text-sm text-base-content">No items loaded in this haul yet</h4>
        <p class="text-xs opacity-60 max-w-sm mx-auto">
          Tap <strong>Upload ShopGoodwill / CSV</strong> above or <strong>Add Item Line Manually</strong> to start.
        </p>
      </div>

      <!-- Line Items List -->
      <div v-if="items.length > 0" class="space-y-3">
        <div v-for="(item, idx) in displayItems" :key="idx" 
             class="p-3.5 rounded-2xl bg-base-200/60 border border-base-300 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          
          <div class="w-7 h-7 rounded-xl bg-base-300 font-mono font-black text-xs flex items-center justify-center text-base-content/80 shrink-0">
            {{ idx + 1 }}
          </div>

          <div class="flex-1 w-full sm:w-auto">
            <input type="text" v-model="item.title" placeholder="Item description / receipt title" 
                   class="input input-sm input-bordered w-full font-semibold text-sm" />
          </div>

          <div class="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold opacity-60">Cost:</span>
              <div class="relative">
                <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold opacity-50">$</span>
                <input type="number" step="0.01" v-model.number="item.cost" placeholder="0.00" 
                       class="input input-sm input-bordered w-24 pl-6 font-bold text-sm" />
              </div>
            </div>

            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold opacity-60">Qty:</span>
              <input type="number" min="1" v-model.number="item.quantity" 
                     class="input input-sm input-bordered w-16 text-center font-bold text-sm" />
            </div>

            <!-- Resale vs Expense Pill -->
            <button type="button" @click="item.type = item.type === 'expense' ? 'resale' : 'expense'" 
                    class="badge badge-sm font-extrabold cursor-pointer transition-all"
                    :class="item.type === 'expense' ? 'badge-warning text-warning-content' : 'badge-primary text-primary-content'">
              {{ item.type === 'expense' ? '💼 Expense' : '📦 Resale' }}
            </button>

            <!-- Delete Line -->
            <button @click="removeLineItem(idx)" class="btn btn-ghost btn-xs btn-circle text-error hover:bg-error/20">
              <Icon icon="solar:trash-bin-trash-bold" class="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>

      <!-- Action Footer -->
      <div class="flex items-center justify-between pt-4 border-t border-base-300">
        <div class="text-xs opacity-70">
          <span v-if="items.length === 0" class="opacity-60">Add or import items to proceed.</span>
          <span v-else>Ready to photograph & enrich <strong class="text-base-content">{{ resaleItems.length }} resale item(s)</strong>.</span>
        </div>
        <button @click="proceedToStep2" 
                :disabled="items.length === 0" 
                class="btn btn-primary text-primary-content font-black gap-2 shadow-md">
          Next: Unbox & AI Receive <Icon icon="solar:arrow-right-bold" class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- STEP 2: DEEP AI PHOTO ENRICHMENT & PRICING -->
    <div v-if="currentStep === 2" class="p-4 sm:p-6 space-y-6">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h3 class="text-lg font-extrabold text-base-content">Step 2: Unbox, Inspect & AI Boutique Pricing</h3>
          <p class="text-xs opacity-70">Snap/verify photos, run AI Deep Receive to enrich titles and prices, or open full ItemDrawer for lot splitting.</p>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <!-- AI Deep Receive All Button -->
          <button 
            v-if="itemsWithPhotos.length > 0" 
            @click="runBatchAiEnrich" 
            class="btn btn-xs sm:btn-sm btn-primary text-primary-content font-extrabold gap-1.5 shadow-sm"
            :disabled="batchEnriching"
          >
            <span v-if="batchEnriching" class="loading loading-spinner loading-xs"></span>
            <Icon v-else icon="solar:magic-stick-3-bold-duotone" class="w-4 h-4" />
            <span>AI Deep Receive All ({{ itemsWithPhotos.length }})</span>
          </button>

          <!-- Global Markup Multiplier Quick Bar -->
          <div class="flex items-center gap-1.5 bg-base-200 p-1 rounded-xl border border-base-300 text-xs font-bold">
            <span class="opacity-60 px-2">Markup:</span>
            <button v-for="mult in [2.5, 3.0, 3.5, 4.0, 5.0]" :key="mult" 
                    @click="applyGlobalMarkup(mult)" 
                    class="btn btn-xs btn-ghost hover:btn-primary hover:text-primary-content font-black">
              {{ mult }}x
            </button>
          </div>
        </div>
      </div>

      <!-- Item Enrichment Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div v-for="(item, idx) in resaleItems" :key="idx" 
             class="p-4 rounded-2xl bg-base-200/70 border border-base-300 space-y-3.5 shadow-sm">
          
          <!-- Card Header -->
          <div class="flex items-start justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-2">
              <span class="badge badge-sm badge-neutral text-neutral-content font-mono font-bold">#{{ idx + 1 }}</span>
              <span class="text-xs font-bold opacity-60">Cost: ${{ (item.cost || 0).toFixed(2) }}</span>
            </div>

            <div class="flex items-center gap-1.5 flex-wrap">
              <!-- Full Edit in ItemDrawer Button -->
              <button 
                v-if="item.id" 
                type="button" 
                @click="openItemDrawer(item)" 
                class="btn btn-ghost btn-xs text-primary font-bold gap-1 border border-base-300 hover:bg-base-100"
                title="Open full ItemDrawer with Lot Tools, Checklist, & Detailed Specs"
              >
                <Icon icon="solar:pen-linear" class="w-3.5 h-3.5" />
                <span class="text-[11px]">Full Edit & Lots</span>
              </button>

              <!-- Destination Selector Pill -->
              <select v-model="item.destination" class="select select-bordered select-xs font-extrabold text-xs">
                <option value="memory_den">🏢 Memory Den (MD1)</option>
                <option value="dustytiger">🐯 DustyTiger (DUSTY)</option>
                <option value="backstock">📦 Backstock (Bin)</option>
                <option value="online">🌐 Online (eBay/Poshmark)</option>
              </select>
            </div>
          </div>

          <!-- Photo Attachment Area -->
          <div class="flex items-center gap-3">
            <div class="w-20 h-20 rounded-xl bg-base-300 border-2 border-dashed border-base-content/20 flex flex-col items-center justify-center overflow-hidden shrink-0 relative group">
              <img v-if="item.imagePreview" :src="item.imagePreview" class="w-full h-full object-cover" />
              <div v-else class="text-center p-1">
                <Icon icon="solar:camera-bold" class="w-6 h-6 opacity-40 mx-auto" />
                <span class="text-[9px] font-bold opacity-50 block leading-tight">No Photo</span>
              </div>
              <input type="file" accept="image/*" @change="handleItemPhotoUpload($event, item)" 
                     class="absolute inset-0 opacity-0 cursor-pointer" />
            </div>

            <div class="flex-1 space-y-1.5">
              <!-- Item Title & OCR Trigger -->
              <div class="flex gap-1.5">
                <input type="text" v-model="item.title" placeholder="Product Title" 
                       class="input input-sm input-bordered w-full font-bold text-sm" />
                <button @click="runItemAiEnrich(item)" :disabled="item.analyzing || !item.imagePreview" 
                        class="btn btn-sm btn-primary text-primary-content font-extrabold px-3 shrink-0 shadow-sm"
                        title="Run Deep AI Identification on Photo">
                  <span v-if="item.analyzing" class="loading loading-spinner loading-xs"></span>
                  <template v-else>
                    <Icon icon="solar:magic-stick-3-bold-duotone" class="w-4 h-4" /> AI
                  </template>
                </button>
              </div>

              <!-- 30-42 char Tag Title for Physical Price Tags -->
              <div class="relative">
                <input type="text" v-model="item.tagTitle" maxlength="42" placeholder="Tag Title (30-42 chars for Rollo / Ricochet)" 
                       class="input input-xs input-bordered w-full font-mono text-xs opacity-90" />
                <span class="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono opacity-50">
                  {{ (item.tagTitle || '').length }}/42
                </span>
              </div>
            </div>
          </div>

          <!-- Pricing & Attributes Row -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-base-300/60 text-xs">
            <div>
              <span class="block font-bold opacity-60 text-[10px]">Price ($):</span>
              <input type="number" step="0.50" v-model.number="item.price" placeholder="0.00" 
                     class="input input-xs input-bordered w-full font-black text-success" />
            </div>

            <div>
              <span class="block font-bold opacity-60 text-[10px]">Category:</span>
              <input type="text" v-model="item.category" placeholder="Apparel, Media..." 
                     class="input input-xs input-bordered w-full font-semibold" />
            </div>

            <div>
              <span class="block font-bold opacity-60 text-[10px]">Brand:</span>
              <input type="text" v-model="item.brand" placeholder="Brand / Maker" 
                     class="input input-xs input-bordered w-full font-semibold" />
            </div>

            <div>
              <span class="block font-bold opacity-60 text-[10px]">Bin / SKU:</span>
              <input type="text" v-model="item.sku" placeholder="Auto-generated" 
                     class="input input-xs input-bordered w-full font-mono font-bold" />
            </div>
          </div>

        </div>
      </div>

      <!-- Action Footer -->
      <div class="flex items-center justify-between pt-4 border-t border-base-300">
        <button @click="currentStep = 1" class="btn btn-ghost btn-sm font-bold">
          <Icon icon="solar:arrow-left-bold" class="w-4 h-4" /> Back to Review
        </button>
        <button @click="currentStep = 3" class="btn btn-primary text-primary-content font-black gap-2 shadow-md">
          Next: Route Channels & Export Tags <Icon icon="solar:arrow-right-bold" class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- STEP 3: ROUTE & EXPORT TAGS (MEMORY DEN / DUSTYTIGER / BACKSTOCK / ONLINE) -->
    <div v-if="currentStep === 3" class="p-4 sm:p-6 space-y-6">
      <div>
        <h3 class="text-lg font-extrabold text-base-content">Step 3: Multi-Channel Deployment & Tag Exports</h3>
        <p class="text-xs opacity-70">Download your Ricochet CSV, print Rollo stickers, and graduate items to active inventory.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <!-- Memory Den Export Card -->
        <div class="p-4 rounded-2xl bg-base-200/80 border border-base-300 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-2xl">🏢</span>
              <div>
                <h4 class="font-extrabold text-sm text-base-content">Memory Den (Ricochet POS)</h4>
                <p class="text-xs opacity-60">{{ memoryDenItems.length }} Item(s) Routed</p>
              </div>
            </div>
            <span class="badge badge-primary text-primary-content font-bold text-xs">Ricochet CSV</span>
          </div>
          <p class="text-xs opacity-80">
            Exports standardized Ricochet CSV matching Memory Den's format ready for 1-click upload & in-store tag printing.
          </p>
          <button @click="downloadRicochetCsv" :disabled="memoryDenItems.length === 0" 
                  class="btn btn-sm btn-outline btn-primary w-full gap-2 font-black">
            <Icon icon="solar:file-download-bold" class="w-4 h-4" /> Download Ricochet POS CSV
          </button>
        </div>

        <!-- DustyTiger Export Card -->
        <div class="p-4 rounded-2xl bg-base-200/80 border border-base-300 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-2xl">🐯</span>
              <div>
                <h4 class="font-extrabold text-sm text-base-content">DustyTiger (Manual Tags)</h4>
                <p class="text-xs opacity-60">{{ dustyTigerItems.length }} Item(s) Routed</p>
              </div>
            </div>
            <span class="badge badge-secondary text-secondary-content font-bold text-xs">Rollo Stickers</span>
          </div>
          <p class="text-xs opacity-80">
            Prints mini thermal stickers with Vendor code (`DUSTY`), bold price, and title to stick right onto manual tags.
          </p>
          <button @click="printRolloTags" :disabled="dustyTigerItems.length === 0" 
                  class="btn btn-sm btn-outline btn-secondary w-full gap-2 font-black">
            <Icon icon="solar:printer-bold" class="w-4 h-4" /> Print Rollo Tag Stickers
          </button>
        </div>

      </div>

      <!-- Completion Action Banner -->
      <div class="p-4 rounded-2xl bg-success/10 border border-success/30 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 class="font-black text-sm text-success flex items-center gap-1.5">
            <Icon icon="solar:check-circle-bold" class="w-5 h-5" /> Ready for Active Inventory
          </h4>
          <p class="text-xs opacity-80">
            Completing intake promotes {{ resaleItems.length }} items to <strong>In-Stock</strong> and closes this Purchase Order.
          </p>
        </div>
        <button @click="completeIngestion" :disabled="completing" 
                class="btn btn-success text-success-content font-black gap-2 shadow-lg w-full sm:w-auto">
          <span v-if="completing" class="loading loading-spinner loading-sm"></span>
          <template v-else>
            <Icon icon="solar:disk-bold" class="w-5 h-5" /> Complete Intake & Activate Inventory
          </template>
        </button>
      </div>

    </div>

    <!-- Bulk Import Modal -->
    <BulkImport 
      v-if="showBulkImportModal" 
      :isOpen="showBulkImportModal" 
      @close="showBulkImportModal = false" 
      @complete="onBulkImportComplete" 
    />

    <!-- Full ItemDrawer for Deep Editing & Lot Splitting -->
    <ItemDrawer 
      v-if="activeDrawerDoc" 
      :item="activeDrawerDoc" 
      :isOpen="!!activeDrawerDoc" 
      @close="activeDrawerDoc = null" 
      @saved="handleDrawerSaved" 
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { addToast } from '../../stores/toast';
import { databases, storage, ID, Query } from '../../lib/appwrite';
import { purchasesAPI } from '../../lib/purchases';
import { saveItemToInventory, getItemsByPurchaseId, getCollectionId } from '../../lib/inventory';
import { useLoader } from '../../composables/useLoader';
import BulkImport from '../inventory/BulkImport.vue';
import ItemDrawer from '../common/ItemDrawer.vue';

const activeDrawerDoc = ref<any>(null);
const openingDrawer = ref(false);

const openItemDrawer = async (item: IngestionItem) => {
  if (!item.id) {
    addToast('Item must be saved or loaded from a purchase order to open full ItemDrawer.', 'info');
    return;
  }
  openingDrawer.value = true;
  showLoader('Opening ItemDrawer & Lot Hub...');
  try {
    const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
    const collId = getCollectionId();
    const doc = await databases.getDocument(DB_ID, collId, item.id);
    activeDrawerDoc.value = doc;
  } catch (err: any) {
    console.error('Failed to load item doc:', err);
    addToast(`Could not open item: ${err.message}`, 'error');
  } finally {
    hideLoader();
    openingDrawer.value = false;
  }
};

const handleDrawerSaved = async (savedDoc: any) => {
  if (savedDoc && savedDoc.$id) {
    const matching = items.value.find(i => i.id === savedDoc.$id);
    if (matching) {
      matching.title = savedDoc.title || matching.title;
      matching.tagTitle = savedDoc.tag_title || matching.tagTitle;
      matching.cost = Number(savedDoc.cost) || matching.cost;
      matching.price = Number(savedDoc.resalePrice || savedDoc.price) || matching.price;
      matching.brand = savedDoc.brand || matching.brand;
      matching.category = savedDoc.category || matching.category;
      matching.sku = savedDoc.identity || savedDoc.upc || matching.sku;
      if (savedDoc.imageId) matching.imagePreview = getItemImageUrl(savedDoc.imageId);
    }
  }
  activeDrawerDoc.value = null;
  addToast('Item updated from ItemDrawer!', 'success');
};

const getItemImageUrl = (imageId: string) => {
  if (!imageId) return null;
  if (imageId.startsWith('http')) return imageId;
  const BUCKET_ID = import.meta.env.PUBLIC_APPWRITE_BUCKET_ID || 'item-photos';
  try {
    return storage.getFilePreview(BUCKET_ID, imageId, 400, 400).toString();
  } catch (e) {
    return null;
  }
};

const props = defineProps<{
  poId?: string;
  initialVendor?: string;
  initialItems?: Array<any>;
}>();

const emit = defineEmits(['completed', 'cancel']);

const showBulkImportModal = ref(false);

const onBulkImportComplete = () => {
  showBulkImportModal.value = false;
  addToast('Import completed! Redirecting to Purchases...', 'success');
  window.location.href = '/purchases';
};

const currentStep = ref(1);
const poNumber = ref('');
const poVendor = ref(props.initialVendor || '');
const completing = ref(false);
const { showLoader, hideLoader } = useLoader();

interface IngestionItem {
  id?: string;
  orderId?: string;
  itemId?: string;
  title: string;
  tagTitle?: string;
  cost: number | null;
  price?: number | null;
  quantity: number;
  type: 'resale' | 'expense';
  destination: 'memory_den' | 'dustytiger' | 'backstock' | 'online';
  category?: string;
  brand?: string;
  sku?: string;
  imagePreview?: string;
  imageBase64?: string;
  analyzing?: boolean;
}

const selectedOrderFilter = ref('all');
const fetchingSgw = ref(false);

const uniqueOrders = computed(() => {
  const map = new Map<string, number>();
  items.value.forEach(i => {
    if (i.orderId) {
      map.set(i.orderId, (map.get(i.orderId) || 0) + 1);
    }
  });
  return Array.from(map.entries()).map(([id, count]) => ({ id, count }));
});

const displayItems = computed(() => {
  if (selectedOrderFilter.value === 'all') return items.value;
  return items.value.filter(i => i.orderId === selectedOrderFilter.value);
});

const hasNumericSgwTitles = computed(() => {
  return items.value.some(i => i.title && /^\d{7,10}$/.test(i.title.trim()));
});

const clearAllItems = () => {
  items.value = [];
  addToast('Cleared all line items', 'info');
};

const fetchMissingSgwDetails = async () => {
  fetchingSgw.value = true;
  showLoader('Fetching Real Titles from ShopGoodwill API...', { step: 'Resolving numeric item IDs' });
  let resolved = 0;
  
  try {
    for (const item of items.value) {
      const isNumeric = item.title && /^\d{7,10}$/.test(item.title.trim());
      const itemId = item.itemId || (isNumeric ? item.title.trim() : null);
      if (itemId) {
        try {
          const res = await fetch('/api/proxy-item-details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.title) {
              item.title = data.title;
              item.tagTitle = data.title.slice(0, 42);
              if (data.imageURL) item.imagePreview = data.imageURL;
              resolved++;
            }
          }
        } catch (e) {
          console.warn(`Failed to resolve title for ${itemId}`, e);
        }
      }
    }
    addToast(`Successfully resolved ${resolved} item title(s) from ShopGoodwill!`, 'success');
  } catch (err: any) {
    addToast(`Error fetching details: ${err.message}`, 'error');
  } finally {
    hideLoader();
    fetchingSgw.value = false;
  }
};

const items = ref<IngestionItem[]>(props.initialItems?.map(i => ({
  title: i.title || '',
  tagTitle: i.tag_title || i.title?.slice(0, 40) || '',
  cost: Number(i.cost) || 0,
  price: Number(i.price) || (Number(i.cost) ? Number(i.cost) * 3.5 : 0),
  quantity: Number(i.quantity) || 1,
  type: (i.type === 'expense' ? 'expense' : 'resale') as 'resale' | 'expense',
  destination: (i.destination || 'backstock') as 'memory_den' | 'dustytiger' | 'backstock' | 'online',
  category: i.category || '',
  brand: i.brand || '',
  sku: i.sku || `HUCK-${Math.floor(1000 + Math.random() * 9000)}`,
  imagePreview: i.imagePreview || null
})) || []);

const resaleItems = computed(() => items.value.filter(i => i.type === 'resale'));
const memoryDenItems = computed(() => resaleItems.value.filter(i => i.destination === 'memory_den'));
const dustyTigerItems = computed(() => resaleItems.value.filter(i => i.destination === 'dustytiger'));

const totalLandedCost = computed(() => {
  return items.value.reduce((sum, item) => sum + ((Number(item.cost) || 0) * (Number(item.quantity) || 1)), 0);
});

const addLineItem = () => {
  items.value.push({
    title: '',
    tagTitle: '',
    cost: 0,
    price: 0,
    quantity: 1,
    type: 'resale',
    destination: 'backstock',
    category: '',
    brand: '',
    sku: `HUCK-${Math.floor(1000 + Math.random() * 9000)}`
  });
};

const removeLineItem = (idx: number) => {
  items.value.splice(idx, 1);
};

const autoDerivePoName = () => {
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const activeOrder = selectedOrderFilter.value !== 'all' ? selectedOrderFilter.value : null;
  const orderId = activeOrder || items.value.find(i => i.orderId)?.orderId;
  
  if (orderId) {
    poVendor.value = `ShopGoodwill Order #${orderId}`;
    poNumber.value = `PO-${orderId.slice(-4)}`;
    addToast(`Derived name: ${poVendor.value}`, 'info');
    return;
  }
  
  if (items.value.length > 0) {
    const firstTitle = items.value[0].title;
    if (items.value.length === 1 && firstTitle && !/^\d+$/.test(firstTitle)) {
      poVendor.value = `${firstTitle.slice(0, 30)} Haul`;
    } else {
      poVendor.value = `Haul - ${today} (${items.value.length} items)`;
    }
    addToast(`Derived name: ${poVendor.value}`, 'info');
  } else {
    poVendor.value = `Sourcing Run - ${today}`;
    addToast(`Default name set: ${poVendor.value}`, 'info');
  }
};

const proceedToStep2 = () => {
  if (!poVendor.value.trim()) {
    autoDerivePoName();
  }
  if (items.value.length === 0) {
    addToast('Please load or add at least 1 item line', 'warning');
    return;
  }
  currentStep.value = 2;
};

const applyGlobalMarkup = (mult: number) => {
  resaleItems.value.forEach(item => {
    if (item.cost) {
      item.price = Math.round(item.cost * mult);
    }
  });
  addToast(`Applied ${mult}x markup multiplier across resale lines`, 'info');
};

const handleCsvImport = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;
  const file = target.files[0];
  showLoader('Analyzing ShopGoodwill Report & Checking Database...', { step: 'Checking for existing inventory items' });

  try {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) {
      addToast('CSV file is empty or has no header row.', 'error');
      return;
    }

    const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["']/g, ''));
    const itemIdIdx = header.findIndex(h => h.includes('item id') || h.includes('item #') || h.includes('itemid') || h.includes('item_id') || h.includes('item number') || h.includes('itemno'));
    const orderIdIdx = header.findIndex(h => h.includes('order id') || h.includes('order #') || h.includes('orderid') || h.includes('order_id') || h.includes('invoice'));
    const titleIdx = header.findIndex(h => h.includes('title') || h.includes('description') || h.includes('item'));
    const priceIdx = header.findIndex(h => h.includes('price') || h.includes('paid') || h.includes('bid') || h.includes('cost') || h.includes('amount'));
    const shipIdx = header.findIndex(h => h.includes('ship'));
    const handIdx = header.findIndex(h => h.includes('hand'));
    const taxIdx = header.findIndex(h => h.includes('tax'));

    // 1. Fetch Existing Items from Appwrite DB to ensure 100% deduplication
    const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
    const collId = getCollectionId();
    const existingDbIdentities = new Set<string>();

    try {
      const dbCheck = await databases.listDocuments(DB_ID, collId, [
        Query.limit(5000),
        Query.select(['identity', 'sku', 'external_id'])
      ]);
      dbCheck.documents.forEach(doc => {
        if (doc.identity) existingDbIdentities.add(String(doc.identity).trim());
        if (doc.external_id) existingDbIdentities.add(String(doc.external_id).trim());
        if (doc.sku) existingDbIdentities.add(String(doc.sku).trim());
      });
    } catch (e) {
      console.warn('Could not query DB items for deduplication:', e);
    }

    const parsedItems: IngestionItem[] = [];
    const seenKeys = new Map<string, IngestionItem>();
    let inMemoryDups = 0;
    let dbAlreadyExistsCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
      if (row.length === 0) continue;

      const rawTitle = titleIdx >= 0 && row[titleIdx] ? row[titleIdx].replace(/^"|"$/g, '').trim() : `Imported Item ${i}`;
      if (!rawTitle || rawTitle.toLowerCase().includes('total') || rawTitle.toLowerCase().includes('subtotal')) continue;

      const rawItemId = itemIdIdx >= 0 && row[itemIdIdx] ? row[itemIdIdx].replace(/[^0-9]/g, '').trim() : '';
      const rawOrderId = orderIdIdx >= 0 && row[orderIdIdx] ? row[orderIdIdx].replace(/[^0-9a-zA-Z_-]/g, '').trim() : '';

      // Skip if this item ID is ALREADY in the Appwrite database!
      if (rawItemId && (existingDbIdentities.has(rawItemId) || existingDbIdentities.has(`SGW-${rawItemId.slice(-6)}`))) {
        dbAlreadyExistsCount++;
        continue;
      }

      const rawPrice = priceIdx >= 0 && row[priceIdx] ? parseFloat(row[priceIdx].replace(/[^0-9.]/g, '')) || 0 : 0;
      const rawShip = shipIdx >= 0 && row[shipIdx] ? parseFloat(row[shipIdx].replace(/[^0-9.]/g, '')) || 0 : 0;
      const rawHand = handIdx >= 0 && row[handIdx] ? parseFloat(row[handIdx].replace(/[^0-9.]/g, '')) || 0 : 0;
      const rawTax = taxIdx >= 0 && row[taxIdx] ? parseFloat(row[taxIdx].replace(/[^0-9.]/g, '')) || 0 : 0;
      const landedCost = rawPrice + rawShip + rawHand + rawTax;

      // Unique deduplication key within the file
      const uniqueKey = rawItemId ? `item_${rawItemId}` : (rawOrderId ? `order_${rawOrderId}_${rawTitle.toLowerCase()}` : `title_${rawTitle.toLowerCase()}_${rawPrice}`);

      if (seenKeys.has(uniqueKey)) {
        inMemoryDups++;
        const existing = seenKeys.get(uniqueKey)!;
        existing.quantity = (existing.quantity || 1) + 1;
        continue;
      }

      const newItem: IngestionItem = {
        title: rawTitle,
        tagTitle: rawTitle.slice(0, 42),
        cost: landedCost > 0 ? Number(landedCost.toFixed(2)) : (rawPrice > 0 ? rawPrice : 0),
        price: landedCost > 0 ? Math.round(landedCost * 3.5) : 0,
        quantity: 1,
        type: 'resale',
        destination: 'backstock',
        orderId: rawOrderId || undefined,
        itemId: rawItemId || undefined,
        sku: rawItemId ? `SGW-${rawItemId.slice(-6)}` : `HUCK-${Math.floor(1000 + Math.random() * 9000)}`
      };

      seenKeys.set(uniqueKey, newItem);
      parsedItems.push(newItem);
    }

    if (parsedItems.length > 0) {
      items.value = parsedItems;
      
      // Auto-derive PO name from Order ID, File Name, or Date
      const firstOrderId = parsedItems.find(i => i.orderId)?.orderId;
      const cleanFileName = file.name.replace(/\.[^/.]+$/, '').replace(/[_ -]+/g, ' ').trim();
      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      if (firstOrderId) {
        poVendor.value = `ShopGoodwill Order #${firstOrderId}`;
        poNumber.value = `PO-${firstOrderId.slice(-4)}`;
      } else if (cleanFileName && !cleanFileName.toLowerCase().startsWith('report')) {
        poVendor.value = cleanFileName;
      } else {
        poVendor.value = `ShopGoodwill Haul - ${today} (${parsedItems.length} items)`;
      }

      let toastMsg = `Imported ${parsedItems.length} new uningested item(s)!`;
      if (dbAlreadyExistsCount > 0) {
        toastMsg += ` (Skipped ${dbAlreadyExistsCount} items already in your database)`;
      }
      addToast(toastMsg, 'success');

      // Auto-fetch real titles if numeric item IDs are present
      if (parsedItems.some(i => i.itemId || /^\d{7,10}$/.test(i.title.trim()))) {
        fetchMissingSgwDetails();
      }

      // Automatically advance to Step 2: Unbox & AI Receive!
      currentStep.value = 2;
    } else {
      if (dbAlreadyExistsCount > 0) {
        addToast(`All ${dbAlreadyExistsCount} items in this report are already in your inventory! No new items to ingest.`, 'info');
      } else {
        addToast('No valid new item lines found in file.', 'warning');
      }
    }
  } catch (err: any) {
    console.error('Failed to parse file:', err);
    addToast(`Error reading file: ${err.message}`, 'error');
  } finally {
    hideLoader();
    target.value = '';
  }
};

const handleItemPhotoUpload = (e: Event, item: IngestionItem) => {
  const target = e.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;
  const file = target.files[0];
  const reader = new FileReader();
  reader.onload = (re) => {
    item.imagePreview = re.target?.result as string;
    item.imageBase64 = item.imagePreview;
  };
  reader.readAsDataURL(file);
};

const itemsWithPhotos = computed(() => resaleItems.value.filter(i => i.imagePreview || i.imageBase64));
const batchEnriching = ref(false);

const runItemAiEnrich = async (item: IngestionItem) => {
  const hasImage = item.imageBase64 || item.imagePreview;
  if (!hasImage) {
    addToast('Please attach or snap a photo first to run AI Deep Receive.', 'info');
    return;
  }
  item.analyzing = true;
  try {
    const payload: any = {
      notes: `Existing cost: $${item.cost || 0}. Please enrich title, suggest boutique booth retail price, category, brand, and tag_title (30-42 chars max).`
    };
    if (item.imageBase64) {
      payload.image = item.imageBase64;
    } else if (item.imagePreview) {
      payload.imageUrl = item.imagePreview;
    }

    const res = await fetch('/api/identify-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.items && data.items.length > 0) {
      const detected = data.items[0];
      if (detected.title) item.title = detected.title;
      if (detected.tag_title) item.tagTitle = detected.tag_title.slice(0, 42);
      if (detected.category) item.category = detected.category;
      if (detected.brand) item.brand = detected.brand;
      
      // Auto price from boutique premium or cost markup
      if (detected.price_breakdown?.boutique_premium) {
        const matches = detected.price_breakdown.boutique_premium.match(/([0-9.]+)/);
        if (matches) item.price = parseFloat(matches[1]);
      } else if (item.cost) {
        item.price = Math.round(item.cost * 3.5);
      }
      addToast(`AI Enriched: ${item.tagTitle || item.title}`, 'success');
    }
  } catch (err) {
    console.error('AI Enrichment Failed:', err);
    addToast('AI Enrichment failed. Please enter details manually.', 'error');
  } finally {
    item.analyzing = false;
  }
};

const runBatchAiEnrich = async () => {
  if (itemsWithPhotos.value.length === 0) {
    addToast('No items with photos to AI enrich.', 'info');
    return;
  }
  batchEnriching.value = true;
  showLoader(`AI Deep Receiving ${itemsWithPhotos.value.length} items...`);
  let count = 0;
  for (const item of itemsWithPhotos.value) {
    try {
      await runItemAiEnrich(item);
      count++;
    } catch (e) {
      console.warn(e);
    }
  }
  hideLoader();
  batchEnriching.value = false;
  addToast(`AI Deep Received ${count} item(s)!`, 'success');
};

const downloadRicochetCsv = () => {
  const header = 'SKU,Item Title,Description,Web Description,Price,Quantity,In-Stock Date,Category,Brand\n';
  const today = new Date().toLocaleDateString('en-US');
  const rows = memoryDenItems.value.map(item => {
    const cleanTitle = `"${(item.title || '').replace(/"/g, '""')}"`;
    const cleanTag = `"${(item.tagTitle || item.title || '').replace(/"/g, '""')}"`;
    const cleanBrand = `"${(item.brand || '').replace(/"/g, '""')}"`;
    const cleanCategory = `"${(item.category || '').replace(/"/g, '""')}"`;
    return `${item.sku},${cleanTitle},${cleanTag},${cleanTag},${(item.price || 0).toFixed(2)},${item.quantity || 1},${today},${cleanCategory},${cleanBrand}`;
  }).join('\n');

  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ricochet_memoryden_import_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  addToast('Downloaded Ricochet POS Import CSV!', 'success');
};

const printRolloTags = () => {
  window.print();
};

const completeIngestion = async () => {
  completing.value = true;
  showLoader('Activating In-Stock Inventory & Closing PO...', { step: 'Deploying items to active inventory' });
  try {
    const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
    const collId = getCollectionId();

    // Update existing items or create new active inventory records
    const savePromises = resaleItems.value.map(async item => {
      if (item.id) {
        const updateData: any = {
          title: item.title,
          cost: item.cost || 0,
          resalePrice: item.price || 0,
          status: 'in-stock',
          storageLocation: item.destination,
          identity: item.sku,
          brand: item.brand,
          category: item.category
        };
        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);
        return await databases.updateDocument(DB_ID, collId, item.id, updateData);
      } else {
        return await saveItemToInventory(
          {
            title: item.title,
            tag_title: item.tagTitle || item.title.slice(0, 42),
            identity: item.sku,
            category: item.category,
            brand: item.brand
          },
          null,
          {
            cost: item.cost || 0,
            price: item.price || 0,
            quantity: item.quantity || 1,
            status: 'in-stock',
            location: item.destination
          }
        );
      }
    });

    await Promise.all(savePromises);

    // Close / update Purchase Order
    const urlParams = new URLSearchParams(window.location.search);
    const targetPoId = props.poId || urlParams.get('poId');
    if (targetPoId) {
      await purchasesAPI.updatePurchase(targetPoId, {
        status: 'Received',
        vendor: poVendor.value,
        grandTotal: totalLandedCost.value
      });
    }

    addToast(`Successfully received and activated ${resaleItems.value.length} items in inventory!`, 'success');
    emit('completed');
    setTimeout(() => {
      window.location.href = '/inventory';
    }, 1200);
  } catch (err: any) {
    console.error('Intake failed:', err);
    addToast(`Intake error: ${err.message}`, 'error');
  } finally {
    hideLoader();
    completing.value = false;
  }
};

onMounted(async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const targetPoId = props.poId || urlParams.get('poId');
  if (targetPoId) {
    showLoader('Loading Purchase Order...', { step: 'Fetching lines & items' });
    try {
      const poDoc: any = await purchasesAPI.getPurchase(targetPoId);
      if (poDoc) {
        poNumber.value = poDoc.poNumber || poDoc.$id;
        poVendor.value = poDoc.vendor || 'Goodwill Haul';
        
        // Fetch linked items for this PO using rock-solid helper getItemsByPurchaseId
        const docs = await getItemsByPurchaseId(targetPoId, poDoc.orderId, poDoc.poNumber);

        if (docs.length > 0) {
          items.value = docs.map(d => ({
            id: d.$id,
            orderId: d.orderId || poDoc.orderId || undefined,
            itemId: d.identity || undefined,
            title: d.title || '',
            tagTitle: d.tag_title || d.title?.slice(0, 42) || '',
            cost: Number(d.cost) || 0,
            price: Number(d.resalePrice || d.price) || (Number(d.cost) ? Math.round(Number(d.cost) * 3.5) : 0),
            quantity: Number(d.quantity) || 1,
            type: 'resale',
            destination: (d.storageLocation || d.location || 'backstock') as any,
            category: d.category || '',
            brand: d.brand || '',
            sku: d.identity || d.locationSku || d.upc || `HUCK-${Math.floor(1000 + Math.random() * 9000)}`,
            imagePreview: d.imageId ? getItemImageUrl(d.imageId) : (d.imageUrl || null)
          }));

          // Automatically advance to Step 2 (AI Vision Enrich & Price & Unbox) since PO is already loaded!
          currentStep.value = 2;
        }
      }
    } catch (err) {
      console.warn('Could not load PO lines:', err);
    } finally {
      hideLoader();
    }
  }
});
</script>

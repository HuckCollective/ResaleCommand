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

      <!-- Location Selector, History Button & Commission Badge -->
      <div class="flex items-end gap-2 w-full md:w-auto flex-wrap">
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

        <button 
          type="button" 
          class="btn btn-sm btn-outline gap-1.5 font-bold"
          :class="locationHistory.length > 0 ? 'btn-secondary text-white' : 'btn-ghost border-base-300'"
          @click="showHistoryModal = true"
          title="View previous sync audit log"
        >
          <Icon icon="solar:history-bold" class="w-4 h-4" />
          <span>History</span>
          <span v-if="locationHistory.length > 0" class="badge badge-xs badge-neutral font-mono font-bold">{{ locationHistory.length }}</span>
        </button>
      </div>
    </div>

    <!-- Sync History Modal -->
    <div v-if="showHistoryModal" class="modal modal-open">
      <div class="modal-box max-w-2xl max-h-[85vh] flex flex-col">
        <div class="flex items-center justify-between border-b border-base-200 pb-3">
          <div class="flex items-center gap-2">
            <div class="p-2 bg-secondary/10 text-secondary rounded-lg">
              <Icon icon="solar:history-bold" class="w-5 h-5" />
            </div>
            <div>
              <h3 class="font-bold text-lg">Sync History: {{ currentLocation?.name || 'Location' }}</h3>
              <p class="text-xs opacity-60">Record of all sales and inventory imports committed for this location.</p>
            </div>
          </div>
          <button class="btn btn-sm btn-ghost btn-circle" @click="showHistoryModal = false">✕</button>
        </div>

        <!-- History List -->
        <div class="overflow-y-auto flex-1 py-4 space-y-3">
          <div v-if="locationHistory.length === 0" class="text-center py-12 opacity-60 text-xs">
            <Icon icon="solar:documents-minimalistic-linear" class="w-12 h-12 mx-auto mb-2 opacity-40" />
            No previous syncs recorded for {{ currentLocation?.name || 'this location' }} yet.
          </div>

          <div 
            v-for="entry in locationHistory" 
            :key="entry.id"
            class="p-4 bg-base-200/60 hover:bg-base-200 rounded-xl border border-base-300 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all"
          >
            <div class="space-y-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-bold text-xs font-mono text-primary">{{ formatDate(entry.timestamp) }}</span>
                <span class="badge badge-xs badge-neutral font-mono">{{ entry.fileName }}</span>
                <span class="badge badge-xs badge-outline badge-primary font-bold">UPC: {{ entry.upcPrefix || 'HUCK-' }}</span>
              </div>
              <div class="text-[11px] opacity-75 flex items-center gap-3 flex-wrap">
                <span>Total Rows: <b>{{ entry.totalRows }}</b></span>
                <span>In-Stock: <b class="text-info">{{ entry.inStockCount }}</b></span>
                <span>Sold: <b class="text-success">{{ entry.soldCount }}</b></span>
                <span v-if="entry.newItemsCreated > 0">Created: <b class="text-warning">+{{ entry.newItemsCreated }} items</b></span>
              </div>
            </div>

            <div class="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-base-300">
              <div class="text-right">
                <div class="text-xs font-extrabold text-success font-mono">+${{ Number(entry.totalNet || 0).toFixed(2) }} Net</div>
                <div class="text-[10px] opacity-60 font-mono">${{ Number(entry.totalGross || 0).toFixed(2) }} Gross (${{ Number(entry.commissionPaid || 0).toFixed(2) }} Fee)</div>
              </div>
              <button class="btn btn-xs btn-ghost btn-circle text-error opacity-60 hover:opacity-100" @click="deleteHistoryItem(entry.id)" title="Delete log entry">
                <Icon icon="solar:trash-bin-trash-linear" class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div class="modal-action border-t border-base-200 pt-3 flex justify-between items-center">
          <button 
            v-if="locationHistory.length > 0" 
            class="btn btn-xs btn-ghost text-error" 
            @click="clearHistoryForCurrentLocation"
          >
            Clear {{ currentLocation?.name }} History
          </button>
          <div v-else></div>
          <button class="btn btn-sm btn-ghost" @click="showHistoryModal = false">Close</button>
        </div>
      </div>
      <div class="modal-backdrop" @click="showHistoryModal = false"></div>
    </div>

    <!-- Custom DaisyUI Confirmation Dialog Modal -->
    <div v-if="confirmDialog.isOpen" class="modal modal-open z-50">
      <div class="modal-box max-w-md border border-base-200 shadow-2xl p-6 bg-base-100">
        <div class="flex items-start gap-3">
          <div 
            class="p-2.5 rounded-2xl shrink-0" 
            :class="confirmDialog.type === 'error' ? 'bg-error/10 text-error' : confirmDialog.type === 'success' ? 'bg-success/10 text-success' : confirmDialog.type === 'warning' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'"
          >
            <Icon :icon="confirmDialog.icon || 'solar:question-circle-bold'" class="w-6 h-6" />
          </div>
          <div>
            <h3 class="font-bold text-lg leading-tight">{{ confirmDialog.title }}</h3>
            <p class="text-xs opacity-75 mt-1.5 whitespace-pre-line">{{ confirmDialog.message }}</p>
          </div>
        </div>
        
        <div class="modal-action mt-6 flex justify-end gap-2 border-t border-base-200 pt-3">
          <button class="btn btn-sm btn-ghost" @click="handleConfirmCancel">{{ confirmDialog.cancelText || 'Cancel' }}</button>
          <button 
            class="btn btn-sm font-bold shadow-sm" 
            :class="confirmDialog.type === 'error' ? 'btn-error text-white' : confirmDialog.type === 'success' ? 'btn-success text-white' : confirmDialog.type === 'warning' ? 'btn-warning text-white' : 'btn-primary'"
            @click="handleConfirmAccept"
          >
            {{ confirmDialog.confirmText || 'Confirm' }}
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="handleConfirmCancel"></div>
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
    <div v-if="syncRows.length === 0" class="space-y-6">
      <div 
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

      <!-- Sync History Section (Audit Log for active location) -->
      <div class="card bg-base-100 border border-base-200 shadow-sm p-5">
        <div class="flex items-center justify-between border-b border-base-200 pb-3 mb-4">
          <div class="flex items-center gap-2.5">
            <div class="p-2 bg-secondary/10 text-secondary rounded-lg">
              <Icon icon="solar:history-bold" class="w-5 h-5" />
            </div>
            <div>
              <h3 class="font-bold text-sm">Sync History: {{ currentLocation?.name || 'Location' }}</h3>
              <p class="text-[11px] opacity-60">Audit trail of previously imported sales and inventory reports for this booth.</p>
            </div>
          </div>
          <div v-if="locationHistory.length > 0" class="flex items-center gap-3">
            <span class="text-xs opacity-60 font-mono">{{ locationHistory.length }} recorded {{ locationHistory.length === 1 ? 'sync' : 'syncs' }}</span>
            <button class="btn btn-xs btn-ghost text-error" @click="clearHistoryForCurrentLocation">Clear</button>
          </div>
        </div>

        <div v-if="locationHistory.length === 0" class="text-center py-6 opacity-60 text-xs">
          No previous syncs recorded for {{ currentLocation?.name || 'this location' }} yet. When you commit a CSV sync, an audit log will appear here.
        </div>

        <div v-else class="space-y-2.5">
          <div 
            v-for="entry in locationHistory" 
            :key="entry.id"
            class="p-3.5 bg-base-200/50 hover:bg-base-200 rounded-xl border border-base-300/60 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 transition-colors"
          >
            <div class="space-y-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-bold text-xs font-mono text-primary">{{ formatDate(entry.timestamp) }}</span>
                <span class="badge badge-xs badge-neutral font-mono">{{ entry.fileName }}</span>
                <span class="badge badge-xs badge-outline badge-primary font-bold">UPC: {{ entry.upcPrefix || 'HUCK-' }}</span>
              </div>
              <div class="text-[11px] opacity-70 flex items-center gap-3 flex-wrap">
                <span>Rows: <b>{{ entry.totalRows }}</b></span>
                <span>In-Stock: <b class="text-info">{{ entry.inStockCount }}</b></span>
                <span>Sold: <b class="text-success">{{ entry.soldCount }}</b></span>
                <span v-if="entry.newItemsCreated > 0">Created: <b class="text-warning">+{{ entry.newItemsCreated }} items</b></span>
              </div>
            </div>

            <div class="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0 border-base-300">
              <div class="text-right">
                <div class="text-xs font-bold text-success font-mono">+${{ Number(entry.totalNet || 0).toFixed(2) }} Net</div>
                <div class="text-[10px] opacity-60 font-mono">${{ Number(entry.totalGross || 0).toFixed(2) }} Gross (${{ Number(entry.commissionPaid || 0).toFixed(2) }} Fee)</div>
              </div>
              <button class="btn btn-xs btn-ghost btn-circle text-error opacity-60 hover:opacity-100" @click="deleteHistoryItem(entry.id)" title="Delete entry">
                <Icon icon="solar:trash-bin-trash-linear" class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
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
          <!-- Filter Tabs: Prioritizing Unmatched -->
          <div class="flex flex-wrap gap-1.5 items-center">
            <!-- 1. Unmatched Sold (Top Priority) -->
            <button 
              class="btn btn-xs rounded-lg font-bold gap-1.5 transition-all" 
              :class="filterTab === 'unmatched-sold' ? 'btn-error text-white shadow-md shadow-error/20' : 'btn-ghost bg-base-200 text-error hover:bg-error/10'" 
              @click="filterTab = 'unmatched-sold'"
            >
              <Icon icon="solar:fire-bold" class="w-3.5 h-3.5" />
              Unmatched Sold
              <span class="badge badge-xs" :class="filterTab === 'unmatched-sold' ? 'bg-white text-error font-extrabold' : 'badge-error text-white'">
                {{ unmatchedSoldCount }}
              </span>
            </button>

            <!-- 2. Unmatched In-Stock -->
            <button 
              class="btn btn-xs rounded-lg font-bold gap-1.5 transition-all" 
              :class="filterTab === 'unmatched-instock' ? 'btn-warning text-black shadow-md shadow-warning/20' : 'btn-ghost bg-base-200 text-warning-content hover:bg-warning/10'" 
              @click="filterTab = 'unmatched-instock'"
            >
              <Icon icon="solar:box-minimalistic-bold-duotone" class="w-3.5 h-3.5" />
              Unmatched In-Stock
              <span class="badge badge-xs" :class="filterTab === 'unmatched-instock' ? 'bg-black text-warning font-extrabold' : 'badge-warning text-black'">
                {{ unmatchedInStockCount }}
              </span>
            </button>

            <!-- 3. Matched & Ready -->
            <button 
              class="btn btn-xs rounded-lg font-bold gap-1.5 transition-all" 
              :class="filterTab === 'matched' ? 'btn-success text-white shadow-md shadow-success/20' : 'btn-ghost bg-base-200 text-success hover:bg-success/10'" 
              @click="filterTab = 'matched'"
            >
              <Icon icon="solar:check-circle-bold" class="w-3.5 h-3.5" />
              Matched ({{ matchedCount }})
            </button>

            <!-- 4. All Rows -->
            <button 
              class="btn btn-xs rounded-lg font-bold gap-1.5 transition-all" 
              :class="filterTab === 'all' ? 'btn-primary text-white shadow-md shadow-primary/20' : 'btn-ghost bg-base-200'" 
              @click="filterTab = 'all'"
            >
              All ({{ syncRows.length }})
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

      <!-- PERMANENT BULK UPC & QUICK-ACTION TOOLBAR (Always Visible when file loaded) -->
      <div class="bg-base-100 p-3.5 rounded-xl border border-base-300 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <!-- Left: Interactive UPC Prefix Selector & Next Barcode Preview -->
        <div class="flex items-center gap-2.5 flex-wrap">
          <div class="flex items-center gap-1.5 font-bold text-xs opacity-80">
            <Icon icon="solar:barcode-bold" class="w-4 h-4 text-primary" />
            <span>Barcode Prefix (Code Start):</span>
          </div>

          <!-- Quick Select Buttons: HUCK- vs PDXGL- -->
          <div class="join border border-base-300 rounded-lg p-0.5 bg-base-200">
            <button 
              type="button" 
              class="btn btn-xs join-item" 
              :class="upcPrefix === 'HUCK-' ? 'btn-active btn-primary font-black shadow-xs' : 'btn-ghost'"
              @click="upcPrefix = 'HUCK-'"
            >
              HUCK-
            </button>
            <button 
              type="button" 
              class="btn btn-xs join-item" 
              :class="upcPrefix === 'PDXGL-' ? 'btn-active btn-secondary text-white font-black shadow-xs' : 'btn-ghost'"
              @click="upcPrefix = 'PDXGL-'"
            >
              PDXGL-
            </button>
          </div>

          <!-- Custom Prefix Text Input -->
          <div class="relative w-28">
            <input 
              type="text" 
              v-model="upcPrefix" 
              placeholder="e.g. PDXGL-" 
              class="input input-bordered input-xs w-full font-mono uppercase font-bold text-xs"
            />
          </div>

          <span class="text-xs opacity-75">
            Next: <code class="font-bold text-primary font-mono bg-base-200 px-2 py-0.5 rounded border border-base-300">{{ nextPreviewUpc }}</code>
          </span>
        </div>

        <!-- Right: Clear Bulk Action Buttons -->
        <div class="flex items-center gap-2 flex-wrap justify-end">
          <!-- 0. Gemini AI Auto-Matcher -->
          <button 
            v-if="unmatchedCount > 0"
            type="button"
            class="btn btn-xs bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black shadow-sm gap-1.5 border-none"
            :disabled="isAiMatching || isBulkQuickAdding"
            @click="triggerAiMatching"
            title="Use Gemini AI to semantically match abbreviations, editions, and RPG sourcebooks"
          >
            <span v-if="isAiMatching" class="loading loading-spinner loading-xs"></span>
            <Icon v-else icon="solar:magic-stick-3-bold" class="w-3.5 h-3.5 text-yellow-300" />
            ✨ AI Match ({{ unmatchedCount }})
          </button>

          <!-- 1. Track All Sold Items -->
          <button 
            v-if="unmatchedSoldCount > 0"
            type="button"
            class="btn btn-xs btn-error text-white font-extrabold shadow-sm gap-1.5"
            :disabled="isBulkQuickAdding || isAiMatching"
            @click="bulkQuickAddUnmatched(true)"
          >
            <span v-if="isBulkQuickAdding" class="loading loading-spinner loading-xs"></span>
            <Icon v-else icon="solar:cart-check-bold" class="w-3.5 h-3.5" />
            ⚡ Save & Track All {{ unmatchedSoldCount }} Sold ({{ upcPrefix }})
          </button>

          <!-- 2. Auto-Create All In-Stock -->
          <button 
            v-if="unmatchedInStockCount > 0"
            type="button"
            class="btn btn-xs btn-warning text-black font-bold shadow-sm gap-1.5"
            :disabled="isBulkQuickAdding || isAiMatching"
            @click="bulkQuickAddUnmatched(false)"
          >
            <span v-if="isBulkQuickAdding" class="loading loading-spinner loading-xs"></span>
            <Icon v-else icon="solar:box-minimalistic-bold-duotone" class="w-3.5 h-3.5" />
            + Bulk Add {{ unmatchedInStockCount }} In-Stock ({{ upcPrefix }})
          </button>

          <!-- 3. If all items matched -->
          <span v-if="unmatchedCount === 0" class="badge badge-success text-white font-bold text-xs gap-1 py-2 px-3">
            <Icon icon="solar:check-circle-bold" class="w-3.5 h-3.5" />
            All {{ syncRows.length }} Items Mapped to Inventory
          </span>
        </div>
      </div>

      <!-- Main Reconciliation Table -->
      <div class="bg-base-100 rounded-2xl border border-base-200 shadow-sm">
        <table class="table table-sm w-full">
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
                  <div v-if="row.isEditingSku" class="flex items-center gap-1">
                    <input 
                      type="text" 
                      v-model="row.extractedSku" 
                      class="input input-bordered input-xs w-20 font-mono text-xs font-bold" 
                      placeholder="SKU..."
                    />
                    <button class="btn btn-xs btn-success btn-square shrink-0" @click="row.isEditingSku = false" title="Save SKU">
                      <Icon icon="solar:check-read-linear" class="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div v-else class="group flex items-center gap-1">
                    <span class="font-mono text-xs font-bold text-secondary bg-base-200/80 px-2 py-0.5 rounded border border-base-300">
                      {{ row.extractedSku || '—' }}
                    </span>
                    <button 
                      v-if="!row.mappedItem" 
                      class="btn btn-xs btn-ghost btn-circle opacity-0 group-hover:opacity-80 transition-opacity shrink-0" 
                      @click="row.isEditingSku = true"
                      title="Edit booth SKU"
                    >
                      <Icon icon="solar:pen-linear" class="w-3 h-3 text-secondary" />
                    </button>
                  </div>
                </td>

                <!-- CSV Name (Editable if unmapped) -->
                <td class="text-xs max-w-[280px]">
                  <div v-if="row.isEditing" class="flex items-center gap-1">
                    <input 
                      type="text" 
                      v-model="row.itemName" 
                      class="input input-bordered input-xs w-full text-xs font-semibold" 
                      placeholder="Edit title..."
                    />
                    <button class="btn btn-xs btn-success btn-square shrink-0" @click="row.isEditing = false" title="Save title">
                      <Icon icon="solar:check-read-linear" class="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div v-else class="group flex items-center justify-between gap-1">
                    <span class="font-semibold truncate flex-1" :title="row.itemName">{{ row.itemName }}</span>
                    <button 
                      v-if="!row.mappedItem" 
                      class="btn btn-xs btn-ghost btn-circle opacity-0 group-hover:opacity-80 transition-opacity shrink-0" 
                      @click="row.isEditing = true"
                      title="Edit title / fix typos"
                    >
                      <Icon icon="solar:pen-linear" class="w-3 h-3 text-primary" />
                    </button>
                  </div>
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
                    <span 
                      class="badge badge-xs font-mono font-bold cursor-pointer hover:badge-secondary transition-all" 
                      :class="row.mappedItem.upc ? 'badge-primary' : 'badge-ghost'"
                      @click="cycleUpcPrefix(row.mappedItem)"
                      title="Click to toggle or generate next HUCK- / PDXGL- UPC"
                    >
                      {{ row.mappedItem.upc || 'NO UPC' }}
                    </span>
                    <span v-if="row.aiMatched" class="badge badge-xs bg-purple-600 text-white font-bold gap-0.5" :title="row.aiReason || 'Matched by Gemini AI'">
                      ✨ AI
                    </span>
                    <span class="text-xs font-semibold truncate flex-1" :title="row.mappedItem.title">
                      {{ row.mappedItem.title }}
                    </span>
                    <button class="btn btn-xs btn-ghost btn-circle text-error ml-1 shrink-0" @click="row.mappedItem = null; row.aiMatched = false;" title="Unlink Item">
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
                        class="absolute z-50 left-0 top-full mt-1 w-full bg-base-100 border border-base-300 rounded-lg shadow-2xl max-h-64 overflow-y-auto"
                      >
                        <div class="p-1.5 border-b border-base-200 flex justify-between items-center text-[10px] bg-base-200/70">
                          <span class="font-bold text-primary flex items-center gap-1">
                            <Icon icon="solar:stars-bold" class="w-3.5 h-3.5 text-warning" />
                            {{ row.searchQuery ? 'Search Results:' : 'Suggested Matches for "' + row.itemName.substring(0, 22) + '...":' }}
                          </span>
                          <button class="btn btn-ghost btn-xs text-error h-auto min-h-0 py-0.5 px-1" @click.stop="row.isSearching = false">Close</button>
                        </div>
                        <div 
                          v-for="item in getFilteredMatches(row.searchQuery, row)" 
                          :key="item.$id"
                          class="p-2 hover:bg-primary/10 cursor-pointer border-b border-base-200/50 last:border-0 flex items-center justify-between text-xs transition-colors"
                          @click="selectItemMatch(row, item)"
                        >
                          <div class="flex items-center gap-2 truncate pr-2">
                            <span class="badge badge-xs font-mono font-bold" :class="item.upc ? 'badge-primary' : 'badge-ghost'">
                              {{ item.upc || 'NO UPC' }}
                            </span>
                            <span v-if="item._matchScore && !row.searchQuery" class="badge badge-xs badge-success text-white font-bold" :title="item._matchReason">
                              {{ item._matchScore }}% Match
                            </span>
                            <span class="font-semibold truncate">{{ item.title }}</span>
                          </div>
                          <span class="font-mono text-[11px] opacity-75 shrink-0">${{ Number(item.resalePrice || item.listPrice || 0).toFixed(2) }}</span>
                        </div>
                        <div v-if="getFilteredMatches(row.searchQuery, row).length === 0" class="p-3 text-center text-xs opacity-50">
                          No suggestions found. Type above to search full inventory.
                        </div>
                      </div>
                    </div>

                    <!-- Quick Add Button per row with HUCK- preview -->
                    <button 
                      class="btn btn-xs btn-primary shrink-0 gap-1 font-bold shadow-xs"
                      :disabled="row.isQuickAdding"
                      @click="quickAddRow(row)"
                      title="Quick create this item with next sequential barcode"
                    >
                      <span v-if="row.isQuickAdding" class="loading loading-spinner loading-xs"></span>
                      <Icon v-else icon="solar:add-circle-bold" class="w-3.5 h-3.5" />
                      + Add ({{ nextPreviewUpc }})
                    </button>
                  </div>
                </td>

              </tr>
            </tbody>
          </table>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAuth } from '../../composables/useAuth';
import { useInventory } from '../../composables/useInventory';
import { useLoader } from '../../composables/useLoader';
import { addToast } from '../../stores/toast';
import { warehousesApi } from '../../lib/warehouses';
import { salesApi } from '../../lib/sales';
import { databases } from '../../lib/appwrite';
import { DB_ID, getCollectionId, saveItemToInventory, updateInventoryItem } from '../../lib/inventory';
import { 
  getSyncHistory, 
  recordSyncHistory, 
  deleteSyncHistoryEntry, 
  clearLocationSyncHistory, 
  type SyncHistoryEntry 
} from '../../lib/syncHistory';
import { Icon } from '@iconify/vue';

const { user, currentTeam: team } = useAuth();
const { inventoryItems, fetchInventory, getNextUpc } = useInventory();
const { showLoader, hideLoader } = useLoader();

const isDragging = ref(false);
const isParsing = ref(false);
const isCommitting = ref(false);
const isBulkQuickAdding = ref(false);
const isAiMatching = ref(false);
const bulkProgressMessage = ref('');
const filterTab = ref<'unmatched-sold' | 'unmatched-instock' | 'unmatched' | 'matched' | 'sold' | 'instock' | 'all'>('unmatched-sold');
const searchQuery = ref('');
const exportUpdatedCsv = ref(true);
const upcPrefix = ref<string>('HUCK-');
const currentFileName = ref<string>('');
const showHistoryModal = ref<boolean>(false);
const syncHistoryList = ref<SyncHistoryEntry[]>([]);
const newItemsCreatedInSession = ref<number>(0);

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

const locationHistory = computed(() => {
  if (!selectedLocationId.value && !currentLocation.value) return [];
  const locName = (currentLocation.value?.name || '').toLowerCase();
  return syncHistoryList.value.filter(h => 
    h.locationId === selectedLocationId.value || 
    (locName && h.locationName.toLowerCase() === locName)
  );
});

const formatDate = (isoStr: string) => {
  try {
    return new Date(isoStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  } catch {
    return isoStr;
  }
};

const refreshSyncHistory = () => {
  if (team.value) {
    syncHistoryList.value = getSyncHistory(team.value.$id);
  }
};

const deleteHistoryItem = (id: string) => {
  if (!team.value) return;
  deleteSyncHistoryEntry(team.value.$id, id);
  refreshSyncHistory();
  addToast({ type: 'info', message: 'Removed sync history record.' });
};

const confirmDialog = ref<{
  isOpen: boolean;
  title: string;
  message: string;
  type: 'primary' | 'error' | 'success' | 'warning';
  icon: string;
  confirmText: string;
  cancelText: string;
}>({
  isOpen: false,
  title: '',
  message: '',
  type: 'primary',
  icon: 'solar:question-circle-bold',
  confirmText: 'Confirm',
  cancelText: 'Cancel'
});

let confirmResolve: ((val: boolean) => void) | null = null;

const showCustomConfirm = (options: {
  title: string;
  message: string;
  type?: 'primary' | 'error' | 'success' | 'warning';
  icon?: string;
  confirmText?: string;
  cancelText?: string;
}): Promise<boolean> => {
  confirmDialog.value = {
    isOpen: true,
    title: options.title,
    message: options.message,
    type: options.type || 'primary',
    icon: options.icon || 'solar:question-circle-bold',
    confirmText: options.confirmText || 'Confirm',
    cancelText: options.cancelText || 'Cancel'
  };
  return new Promise((resolve) => {
    confirmResolve = resolve;
  });
};

const handleConfirmAccept = () => {
  confirmDialog.value.isOpen = false;
  if (confirmResolve) confirmResolve(true);
  confirmResolve = null;
};

const handleConfirmCancel = () => {
  confirmDialog.value.isOpen = false;
  if (confirmResolve) confirmResolve(false);
  confirmResolve = null;
};

const clearHistoryForCurrentLocation = async () => {
  if (!team.value) return;
  const locName = currentLocation.value?.name || 'this location';
  const ok = await showCustomConfirm({
    title: `Clear ${locName} History?`,
    message: `Are you sure you want to delete all recorded sync audit logs for ${locName}? This action cannot be undone.`,
    type: 'error',
    icon: 'solar:trash-bin-trash-bold',
    confirmText: 'Clear History',
    cancelText: 'Keep History'
  });
  if (!ok) return;
  clearLocationSyncHistory(team.value.$id, selectedLocationId.value);
  refreshSyncHistory();
  addToast({ type: 'info', message: `Cleared sync history for ${locName}.` });
};

const inStockCount = computed(() => syncRows.value.filter(r => r.status !== 'sold' && r.status !== 'paid').length);
const soldCount = computed(() => syncRows.value.filter(r => r.status === 'sold' || r.status === 'paid').length);
const matchedCount = computed(() => syncRows.value.filter(r => r.mappedItem !== null).length);
const unmatchedCount = computed(() => syncRows.value.filter(r => r.mappedItem === null).length);
const unmatchedSoldCount = computed(() => syncRows.value.filter(r => (r.status === 'sold' || r.status === 'paid') && r.mappedItem === null).length);
const unmatchedInStockCount = computed(() => syncRows.value.filter(r => r.status !== 'sold' && r.status !== 'paid' && r.mappedItem === null).length);

const nextPreviewUpc = computed(() => {
  const p = upcPrefix.value?.trim() || 'HUCK-';
  return getNextUpc ? getNextUpc(p) : `${p}0001`;
});

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

  if (filterTab.value === 'unmatched-sold') rows = rows.filter(r => (r.status === 'sold' || r.status === 'paid') && r.mappedItem === null);
  else if (filterTab.value === 'unmatched-instock') rows = rows.filter(r => r.status !== 'sold' && r.status !== 'paid' && r.mappedItem === null);
  else if (filterTab.value === 'matched') rows = rows.filter(r => r.mappedItem !== null);
  else if (filterTab.value === 'unmatched') rows = rows.filter(r => r.mappedItem === null);
  else if (filterTab.value === 'instock') rows = rows.filter(r => r.status !== 'sold' && r.status !== 'paid');
  else if (filterTab.value === 'sold') rows = rows.filter(r => r.status === 'sold' || r.status === 'paid');

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

const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'for', 'in', 'on', 'at', 'to', 'with', 'by', 'from', 'is', 'it', 'as', 'game', 'sc', 'aeg']);

function extractKeywords(str: string): string[] {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

function findBestItemMatch(csvName: string, inventory: any[]): any {
  if (!csvName || !inventory || inventory.length === 0) return null;

  // 1. Direct exact or cleaned substring match
  const cleanCsv = csvName.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const item of inventory) {
    const cleanTitle = (item?.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanTitle && (cleanTitle === cleanCsv || cleanTitle.includes(cleanCsv) || cleanCsv.includes(cleanTitle))) {
      return item;
    }
  }

  // 2. Tokenized keyword overlap scoring
  const csvTokens = new Set(extractKeywords(csvName));
  if (csvTokens.size === 0) return null;

  let bestItem = null;
  let bestScore = 0;

  for (const item of inventory) {
    const dbTokens = new Set(extractKeywords(item.title));
    if (dbTokens.size === 0) continue;

    let matchingTokens = 0;
    for (const token of csvTokens) {
      if (dbTokens.has(token)) {
        matchingTokens++;
      }
    }

    const minSize = Math.min(csvTokens.size, dbTokens.size);
    const score = matchingTokens / minSize;
    const jaccard = matchingTokens / (csvTokens.size + dbTokens.size - matchingTokens);

    // Overlap threshold: >= 55% overlap and (>= 2 matching words or 1 distinct word >= 5 chars)
    if (score >= 0.55 && (matchingTokens >= 2 || (matchingTokens === 1 && [...csvTokens].some(t => dbTokens.has(t) && t.length >= 5)))) {
      const combinedScore = score * 0.6 + jaccard * 0.4;
      if (combinedScore > bestScore) {
        bestScore = combinedScore;
        bestItem = item;
      }
    }
  }

  return bestItem;
}

const getFilteredMatches = (query: string, row?: any) => {
  const all = inventoryItems.value;
  if (!all || all.length === 0) return [];

  const q = query.toLowerCase().trim();
  
  // If user actively typed a search query
  if (q) {
    const qTokens = extractKeywords(q);
    return all.filter(i => {
      const title = (i.title || '').toLowerCase();
      const upc = (i.upc || '').toLowerCase();
      const locSku = (i.locationSku || '').toLowerCase();
      const sku = (i.sku || '').toLowerCase();
      
      // Direct matches
      if (title.includes(q) || upc.includes(q) || locSku.includes(q) || sku.includes(q)) return true;
      
      // Token matches (all query tokens exist in title)
      if (qTokens.length > 0 && qTokens.every(t => title.includes(t))) return true;
      
      return false;
    }).slice(0, 25);
  }

  // If search query is empty: generate smart suggestions based on the CSV row's title & SKU!
  if (row) {
    const rowTitle = row.itemName || '';
    const rowSku = (row.extractedSku || '').toLowerCase().trim();
    const rowTokens = new Set(extractKeywords(rowTitle));

    const scored = all.map(item => {
      const title = (item.title || '').toLowerCase();
      const itemSku = (item.locationSku || item.sku || '').toLowerCase().trim();
      const itemTokens = new Set(extractKeywords(item.title));

      let score = 0;
      let reasons: string[] = [];

      // SKU match
      if (rowSku && itemSku && (itemSku === rowSku || itemSku.includes(rowSku) || rowSku.includes(itemSku))) {
        score += 1.0;
        reasons.push('Matching SKU');
      }

      // Keyword overlap
      if (rowTokens.size > 0 && itemTokens.size > 0) {
        let matches = 0;
        for (const token of rowTokens) {
          if (itemTokens.has(token)) {
            matches++;
          }
        }
        if (matches > 0) {
          const overlap = matches / Math.min(rowTokens.size, itemTokens.size);
          score += overlap;
          reasons.push(`${matches} matching terms`);
        }
      }

      return {
        item,
        score,
        reason: reasons.join(', ')
      };
    });

    const suggestions = scored
      .filter(s => s.score > 0.15)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)
      .map(s => Object.assign({}, s.item, { _matchScore: Math.min(Math.round(s.score * 100), 100), _matchReason: s.reason }));

    if (suggestions.length > 0) {
      return suggestions;
    }
  }

  return all.slice(0, 15);
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
  currentFileName.value = file.name || 'Location_Export.csv';
  newItemsCreatedInSession.value = 0;
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
      
      const amountIdx = headerCols.findIndex(h => h === 'payout' || h === 'net' || h === 'net payout' || h === 'vendor payout' || h === 'consignor amount' || h === 'net amount' || h === 'sold amount' || h === 'take home' || h === 'final amount' || h === 'amount');
      const agedPriceIdx = headerCols.findIndex(h => h === 'aged price' || h.includes('aged price'));
      const agreedPriceIdx = headerCols.findIndex(h => h === 'agreed price' || h.includes('agreed price') || h === 'gross' || h === 'gross amount' || h === 'price' || h.includes('price') || h.includes('total'));
      
      const splitIdx = headerCols.findIndex(h => h === 'consignor %' || h.includes('consignor %') || h === 'split / cost' || h.includes('split') || h.includes('consignor percent'));
      const statusIdx = headerCols.findIndex(h => h === 'status' || h.includes('status') || h === 'inventory' || h.includes('state'));
      const qtyIdx = headerCols.findIndex(h => h === 'quantity' || h === 'qty' || h === 'in stock' || h.includes('quantity') || h.includes('qty'));

      const activeItems = Array.isArray(inventoryItems.value) ? inventoryItems.value : [];
      const defaultCommission = currentLocation.value?.commissionRate || 15;
      const defaultConsignorPct = 100 - defaultCommission; // e.g. 85%

      const rows: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = splitCsvLine(lines[i]);
        if (cols.length === 0 || !cols.some(c => c.trim().length > 0)) continue;

        let rawSku = skuIdx !== -1 ? cols[skuIdx] : (prodIdIdx !== -1 ? cols[prodIdIdx] : '');
        let cleanSku = (rawSku || '').trim().replace(/^['"]+/, '').replace(/['"]+$/, '');
        let rowQty = qtyIdx !== -1 ? parseInt((cols[qtyIdx] || '').replace(/[^0-9]/g, ''), 10) || 1 : 1;

        let fullItemName = nameIdx !== -1 ? (cols[nameIdx] || '').trim() : `Item ${i}`;
        let name = fullItemName;

        // Fallback SKU extraction from title like "Item Title - 0EJ001"
        if (!cleanSku) {
          const skuMatch = fullItemName.match(/ - ([A-Z0-9-]+)$/i);
          if (skuMatch) {
            cleanSku = skuMatch[1].trim();
            name = fullItemName.replace(skuMatch[0], '').trim();
          }
        }

        // 1. Read Gross Sticker / Agreed Price directly from Memory Den row
        let grossPrice = 0;
        if (agreedPriceIdx !== -1 && cols[agreedPriceIdx]) {
          grossPrice = parseFloat(cols[agreedPriceIdx].replace(/[^0-9.]/g, '')) || 0;
        }
        if (grossPrice === 0 && agedPriceIdx !== -1 && cols[agedPriceIdx]) {
          grossPrice = parseFloat(cols[agedPriceIdx].replace(/[^0-9.]/g, '')) || 0;
        }

        // 2. Read Consignor Split % directly from Memory Den row (e.g. 85% from "Consignor %" or "Split / Cost")
        let consignorPct = defaultConsignorPct;
        if (splitIdx !== -1 && cols[splitIdx]) {
          const parsedSplit = parseFloat(cols[splitIdx].replace(/[^0-9.]/g, ''));
          if (!isNaN(parsedSplit) && parsedSplit > 0 && parsedSplit <= 100) {
            consignorPct = parsedSplit;
          }
        }

        // 3. Read or Apply Exact Net Payout
        let explicitPayout = amountIdx !== -1 ? parseFloat((cols[amountIdx] || '').replace(/[^0-9.]/g, '')) || 0 : 0;
        let netSoldPrice = 0;

        if (explicitPayout > 0 && explicitPayout !== grossPrice) {
          // Explicit payout amount directly from CSV
          netSoldPrice = explicitPayout;
        } else if (grossPrice > 0) {
          // Use the row's exact consignor percentage directly (e.g. $200 * 85% = $170)
          netSoldPrice = Number((grossPrice * (consignorPct / 100)).toFixed(2));
        }

        let rawStatus = statusIdx !== -1 ? (cols[statusIdx] || '').trim().toLowerCase() : '';
        let isSoldOrPaid = rawStatus.includes('sold') || rawStatus.includes('paid') || (rawStatus.length === 0 && (explicitPayout > 0 || grossPrice > 0) && !headerCols.includes('inventory'));

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

        // 3. Smart Fuzzy Match by Title & Keywords
        if (!matched && name && activeItems.length > 0) {
          matched = findBestItemMatch(name, activeItems);
        }

        rows.push({
          originalLineIndex: i,
          extractedSku: cleanSku,
          itemName: name,
          listedPrice: grossPrice,
          netSoldPrice: netSoldPrice,
          commissionFee: commFee,
          consignorPct: consignorPct,
          csvQty: rowQty,
          salePrice: netSoldPrice, // Fallback compatibility
          status: isSoldOrPaid ? 'sold' : 'instock',
          mappedItem: matched || null,
          searchQuery: '',
          isSearching: false,
          isQuickAdding: false
        });
      }

      syncRows.value = rows;
      filterTab.value = 'all';
      addToast({ type: 'success', message: `Parsed ${rows.length} items from ${file.name}!` });
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
  currentFileName.value = '';
  newItemsCreatedInSession.value = 0;
};

// Retry helper for handling Appwrite rate limits with countdown UI
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 8, initialDelay = 2500, currentProgress = 0): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isRateLimit = err?.code === 429 || err?.message?.includes('Rate limit') || err?.message?.includes('429') || err?.message?.includes('rate');
      if (isRateLimit && attempt < maxRetries) {
        const waitMs = Math.min(initialDelay * Math.pow(1.6, attempt - 1), 20000);
        const totalSec = Math.ceil(waitMs / 1000);
        for (let s = totalSec; s > 0; s--) {
          showLoader("Rate Limit Protection...", {
            step: `⏳ Sync paused temporarily to protect cloud rate limits. Resuming in ${s}s (attempt ${attempt}/${maxRetries})...`,
            progress: currentProgress,
            cancelable: true
          });
          await new Promise(res => setTimeout(res, 1000));
        }
      } else {
        throw err;
      }
    }
  }
  throw new Error('Sync paused too long due to rate limits. Please try again in a few moments.');
}

const triggerAiMatching = async () => {
  const unmappedRows = syncRows.value.filter(r => r.mappedItem === null);
  if (unmappedRows.length === 0) {
    addToast({ type: 'info', message: 'All items are already mapped!' });
    return;
  }

  isAiMatching.value = true;
  showLoader("Gemini AI is analyzing unmatched items...", {
    step: `Scanning ${unmappedRows.length} items against catalog...`,
    progress: 25
  });

  try {
    const unmatchedPayload = unmappedRows.map((r, idx) => ({
      index: idx,
      originalIndex: r.originalLineIndex,
      title: r.itemName,
      sku: r.extractedSku,
      price: r.listedPrice || r.netSoldPrice
    }));

    const availablePayload = inventoryItems.value.map(i => ({
      dbId: i.$id,
      title: i.title,
      upc: i.upc,
      sku: i.sku || i.locationSku,
      price: Number(i.resalePrice || i.listPrice || 0)
    }));

    const res = await fetch('/api/match-inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unmatchedCsvItems: unmatchedPayload,
        availableDbItems: availablePayload
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `AI server error (${res.status})`);
    }

    const data = await res.json();
    const mappings = data.mappings || [];

    let matchedCount = 0;
    for (const m of mappings) {
      const targetUnmapped = unmatchedPayload[m.csvIndex];
      if (targetUnmapped) {
        const row = syncRows.value.find(r => r.originalLineIndex === targetUnmapped.originalIndex);
        const dbItem = inventoryItems.value.find(i => i.$id === m.dbId);
        if (row && dbItem) {
          row.mappedItem = dbItem;
          row.aiMatched = true;
          row.aiConfidence = m.confidence;
          row.aiReason = m.reason;
          matchedCount++;
        }
      }
    }

    if (matchedCount > 0) {
      addToast({ 
        type: 'success', 
        message: `✨ AI successfully mapped ${matchedCount} ${matchedCount === 1 ? 'item' : 'items'}!` 
      });
    } else {
      addToast({ 
        type: 'info', 
        message: 'AI analyzed remaining items but found no additional high-confidence matches.' 
      });
    }
  } catch (err: any) {
    console.error('AI Matching failed:', err);
    addToast({ type: 'error', message: 'AI matching failed: ' + err.message });
  } finally {
    isAiMatching.value = false;
    hideLoader();
  }
};

const quickAddRow = async (row: any) => {
  if (!team.value) return;
  row.isQuickAdding = true;
  try {
    const isSold = row.status === 'sold' || row.status === 'paid';
    const locName = currentLocation.value?.name || '';
    const listedPrice = Number(row.listedPrice || row.netSoldPrice || 0);
    const netSoldPrice = Number(row.netSoldPrice || row.listedPrice || 0);
    
    // Normalize prefix (e.g. "PDXGL" -> "PDXGL-")
    let prefix = upcPrefix.value?.trim() || 'HUCK-';
    if (!prefix.endsWith('-') && !prefix.endsWith('_')) {
      prefix = `${prefix}-`;
    }
    
    const partnerTag = prefix.replace(/[-_]$/, '');
    const isCustomPartner = partnerTag.toUpperCase() !== 'HUCK';
    const partnerNote = isCustomPartner ? ` | Partner: ${partnerTag}` : '';

    // Generate next UPC using active prefix
    const upc = getNextUpc ? getNextUpc(prefix) : `${prefix}${Math.floor(1000 + Math.random() * 9000)}`;

    const doc = await withRetry(() => saveItemToInventory(
      {
        title: row.itemName || 'Unnamed Item',
        condition_notes: `Added from ${locName || 'Booth'} Sync. SKU: ${row.extractedSku || 'N/A'}${partnerNote}`
      },
      null,
      {
        title: row.itemName || 'Unnamed Item',
        status: isSold ? 'sold' : 'placed',
        locationSku: row.extractedSku || (isCustomPartner ? partnerTag : ''),
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

    addToast({ type: 'success', message: `Added "${row.itemName}" with UPC ${upc}!` });
  } catch (err: any) {
    console.error('Quick add failed:', err);
    addToast({ type: 'error', message: 'Failed to quick add item: ' + err.message });
  } finally {
    row.isQuickAdding = false;
  }
};

const cycleUpcPrefix = async (item: any) => {
  if (!item) return;
  const current = item.upc || '';
  let newPrefix = 'HUCK-';
  if (current.startsWith('HUCK-')) {
    newPrefix = 'PDXGL-';
  } else {
    newPrefix = 'HUCK-';
  }
  const newUpc = getNextUpc ? getNextUpc(newPrefix) : `${newPrefix}${Math.floor(1000 + Math.random() * 9000)}`;
  item.upc = newUpc;
  addToast({ type: 'info', message: `Updated "${item.title.substring(0, 25)}..." UPC to ${newUpc}` });
  if (item.$id) {
    try {
      await updateInventoryItem(item.$id, { upc: newUpc });
    } catch (e) {
      console.warn('Live UPC update error:', e);
    }
  }
};

const bulkQuickAddUnmatched = async (onlySold: boolean = false) => {
  if (!team.value) return;
  const unmapped = syncRows.value.filter(r => r.mappedItem === null && (!onlySold || r.status === 'sold' || r.status === 'paid'));
  if (unmapped.length === 0) {
    addToast({ type: 'info', message: onlySold ? 'No unmatched sold items to save.' : 'All items are already mapped!' });
    return;
  }

  let prefix = upcPrefix.value?.trim() || 'HUCK-';
  if (!prefix.endsWith('-') && !prefix.endsWith('_')) {
    prefix = `${prefix}-`;
  }
  
  const partnerTag = prefix.replace(/[-_]$/, '');
  const isCustomPartner = partnerTag.toUpperCase() !== 'HUCK';
  const partnerNote = isCustomPartner ? ` | Partner: ${partnerTag}` : '';

  const label = onlySold ? `${unmapped.length} unmatched SOLD items` : `${unmapped.length} unmatched items`;

  const ok = await showCustomConfirm({
    title: `Create & Track ${label}?`,
    message: `This will auto-generate "${prefix}" barcodes, save items to inventory, and track all sales and revenue.`,
    type: 'success',
    icon: 'solar:cart-check-bold',
    confirmText: `Create ${unmapped.length} Items`,
    cancelText: 'Cancel'
  });
  if (!ok) return;

  isBulkQuickAdding.value = true;
  let successCount = 0;
  const total = unmapped.length;
  let isCancelled = false;

  showLoader(onlySold ? "Tracking Sold Items as Sales..." : "Creating Inventory Items...", {
    step: `Item 1 of ${total}: "${unmapped[0].itemName.substring(0, 32)}..."`,
    progress: 0,
    cancelable: true,
    onCancel: () => {
      isCancelled = true;
      addToast({ type: 'warning', message: 'Creation cancelled by user.' });
    }
  });

  try {
    const locName = currentLocation.value?.name || '';

    for (let idx = 0; idx < total; idx++) {
      if (isCancelled) break;
      const row = unmapped[idx];
      const percent = Math.round(((idx + 1) / total) * 100);

      showLoader(onlySold ? "Tracking Sold Items as Sales..." : "Creating Inventory Items...", {
        step: `Item ${idx + 1} of ${total}: "${row.itemName.substring(0, 32)}..." (${percent}%)`,
        progress: percent,
        cancelable: true,
        onCancel: () => {
          isCancelled = true;
          addToast({ type: 'warning', message: 'Creation cancelled by user.' });
        }
      });

      try {
        const isSold = row.status === 'sold' || row.status === 'paid';
        const listedPrice = Number(row.listedPrice || row.netSoldPrice || 0);
        const netSoldPrice = Number(row.netSoldPrice || row.listedPrice || 0);
        const upc = getNextUpc ? getNextUpc(prefix) : `${prefix}${Math.floor(1000 + Math.random() * 9000)}`;

        const doc = await withRetry(() => saveItemToInventory(
          {
            title: row.itemName || 'Unnamed Item',
            condition_notes: `Added from ${locName || 'Booth'} Sync. SKU: ${row.extractedSku || 'N/A'}${partnerNote}`
          },
          null,
          {
            title: row.itemName || 'Unnamed Item',
            status: isSold ? 'sold' : 'placed',
            locationSku: row.extractedSku || (isCustomPartner ? partnerTag : ''),
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

        // 350ms delay between items to respect API quotas
        await new Promise(r => setTimeout(r, 350));
      } catch (rowErr) {
        console.error('Error creating row:', row, rowErr);
      }
    }

    if (!isCancelled) {
      addToast({ type: 'success', message: `Successfully created and tracked ${successCount} items with "${prefix}" UPCs!` });
    }
  } catch (err: any) {
    console.error('Bulk quick add failed:', err);
    addToast({ type: 'error', message: 'Bulk add encountered an issue: ' + err.message });
  } finally {
    isBulkQuickAdding.value = false;
    hideLoader();
  }
};

const executeSync = async () => {
  if (!team.value) return;

  if (unmatchedSoldCount.value > 0) {
    const prefix = upcPrefix.value?.trim() || 'HUCK-';
    const shouldCreate = await showCustomConfirm({
      title: 'Unmatched Sold Items Found',
      message: `You have ${unmatchedSoldCount.value} sold items in this CSV that are not yet in inventory.\n\nWould you like to auto-create them now with "${prefix}" barcodes so they are tracked as sales and revenue?`,
      type: 'primary',
      icon: 'solar:bell-bing-bold',
      confirmText: 'Auto-Create & Track Sales',
      cancelText: 'Sync Matched Only'
    });
    if (shouldCreate) {
      await bulkQuickAddUnmatched(true);
    }
  }

  const mappedRows = syncRows.value.filter(r => r.mappedItem !== null);
  if (mappedRows.length === 0) {
    addToast({ type: 'warning', message: 'No mapped items to sync.' });
    return;
  }

  isCommitting.value = true;
  const locName = currentLocation.value?.name || 'Location';
  const commissionRate = currentLocation.value?.commissionRate || 15;
  let isCancelled = false;

  showLoader(`Syncing Sales & Inventory to ${locName}...`, {
    step: `Item 1 of ${mappedRows.length}: "${mappedRows[0].itemName.substring(0, 32)}..."`,
    progress: 0,
    cancelable: true,
    onCancel: () => {
      isCancelled = true;
      addToast({ type: 'warning', message: 'Sync stopped by user.' });
    }
  });

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
      if (isCancelled) break;
      const row = mappedRows[idx];
      const percent = Math.round(((idx + 1) / total) * 100);

      showLoader(`Syncing Sales & Inventory to ${locName}...`, {
        step: `Item ${idx + 1} of ${total}: "${row.itemName.substring(0, 32)}..." (${percent}%)`,
        progress: percent,
        cancelable: true,
        onCancel: () => {
          isCancelled = true;
          addToast({ type: 'warning', message: 'Sync stopped by user.' });
        }
      });

      const item = row.mappedItem;
      const isSold = row.status === 'sold' || row.status === 'paid';

      const updateData: any = {};
      
      // Ensure item has a UPC barcode assigned
      if (!item.upc) {
        let prefix = upcPrefix.value?.trim() || 'HUCK-';
        if (!prefix.endsWith('-') && !prefix.endsWith('_')) {
          prefix = `${prefix}-`;
        }
        const autoUpc = getNextUpc ? getNextUpc(prefix) : `${prefix}${Math.floor(1000 + Math.random() * 9000)}`;
        updateData.upc = autoUpc;
        item.upc = autoUpc;
      }

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

      const currentQty = Number(item.quantity || 1);

      if (isSold) {
        const gross = Number(row.listedPrice || row.netSoldPrice || 0);
        const net = Number(row.netSoldPrice || (gross * (1 - (commissionRate / 100))));
        const commFee = Number(row.commissionFee || (gross - net));

        if (currentQty > 1) {
          // Multi-quantity lot: decrement parent and keep it in stock
          const totalCost = Number(item.cost || 0);
          const unitCost = Number((totalCost / currentQty).toFixed(2));
          const remainingQty = currentQty - 1;
          const remainingCost = Math.max(0, Number((totalCost - unitCost).toFixed(2)));

          updateData.quantity = remainingQty;
          updateData.cost = remainingCost;
          updateData.status = 'placed'; // Parent lot stays active in booth!

          // Record official sale document
          let soNum = `SO-${nextSoNum++}`;
          let saleDoc: any = null;
          try {
            saleDoc = await withRetry(() => salesApi.createSale({
              soNumber: soNum,
              warehouseId: currentLocation.value?.$id || '',
              orderId: item.upc || row.extractedSku || `SYNC-${Date.now()}-${idx}`,
              saleDate: new Date().toISOString(),
              status: 'Sold',
              grossAmount: gross,
              commissionFee: commFee,
              shippingCharged: 0,
              shippingCost: 0,
              netPayout: net,
              tenantId: team.value.$id
            }));
          } catch (saleErr) {
            console.error('Error creating sale document during lot sync:', saleErr);
          }

          // Create Child Sold item document in inventory
          try {
            const prefix = upcPrefix.value?.trim() || 'HUCK-';
            const childDoc = await withRetry(() => saveItemToInventory(
              {
                title: `${item.title} (Sold Unit)`,
                identity: `${item.identity || 'Item'}-SOLD-${Date.now().toString().slice(-4)}`,
                condition_notes: `Sold unit from Lot: ${item.title} (${item.$id}). Synced from ${locName}.`
              },
              null,
              {
                title: item.title,
                status: 'sold',
                locationSku: row.extractedSku || item.locationSku || '',
                cost: unitCost,
                resalePrice: gross,
                soldPrice: net,
                quantity: 1,
                parentLotId: item.$id,
                saleId: saleDoc?.$id || undefined,
                sellingLocations: [locName],
                storageLocation: item.storageLocation || locName,
                upc: getNextUpc ? getNextUpc(prefix) : undefined
              },
              team.value.$id,
              'team'
            ));
            if (childDoc) {
              inventoryItems.value.unshift(childDoc);
            }
          } catch (childErr) {
            console.error('Error creating child sold item:', childErr);
          }

        } else {
          // Single unit item sold
          updateData.status = 'sold';
          updateData.resalePrice = gross;
          updateData.soldPrice = net; // The exact amount made after fees!

          // Record official sale document in sales collection
          try {
            const soNum = `SO-${nextSoNum++}`;

            const saleDoc = await withRetry(() => salesApi.createSale({
              soNumber: soNum,
              warehouseId: currentLocation.value?.$id || '',
              orderId: item.upc || row.extractedSku || `SYNC-${Date.now()}-${idx}`,
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
        }
      } else {
        // In-stock item
        if (['scouted', 'received', 'acquired'].includes(item.status)) {
          updateData.status = 'placed';
        }
        if (row.csvQty !== undefined && row.csvQty > 0 && item.quantity !== row.csvQty) {
          updateData.quantity = row.csvQty;
        }
      }

      if (Object.keys(updateData).length > 0) {
        try {
          await withRetry(() => updateInventoryItem(
            item.$id,
            updateData
          ));

          // Update local item reference
          Object.assign(item, updateData);
          count++;
        } catch (itemErr: any) {
          console.warn(`Could not update document for "${row.itemName}":`, itemErr);
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

    // 3. Record in Location Sync History & Audit Log
    if (team.value) {
      recordSyncHistory({
        tenantId: team.value.$id,
        locationId: currentLocation.value?.$id || selectedLocationId.value,
        locationName: locName,
        fileName: currentFileName.value || `${locName.replace(/\s+/g, '_')}_Sync_${new Date().toISOString().slice(0, 10)}.csv`,
        totalRows: syncRows.value.length,
        matchedCount: count,
        newItemsCreated: newItemsCreatedInSession.value,
        inStockCount: inStockCount.value,
        soldCount: soldCount.value,
        totalGross: totalSoldGross.value,
        totalNet: totalSoldNet.value,
        commissionPaid: Number((totalSoldGross.value - totalSoldNet.value).toFixed(2)),
        upcPrefix: upcPrefix.value
      });
      refreshSyncHistory();
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
    hideLoader();
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
    await fetchInventory(team.value.$id);

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

    refreshSyncHistory();
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

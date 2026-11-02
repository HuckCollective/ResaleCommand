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
          class="btn btn-sm gap-1.5 font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100"
          @click="showHistoryModal = true"
          title="View previous sync audit log"
        >
          <span>🕒 History</span>
          <span v-if="locationHistory.length > 0" class="badge badge-xs badge-neutral font-mono font-bold">{{ locationHistory.length }}</span>
        </button>

        <button 
          type="button" 
          class="btn btn-sm btn-outline btn-warning gap-1.5 font-bold"
          @click="showBrowserSyncModal = true"
          title="Open Ricochet In-Browser Barcode Sync Guide"
        >
          <span>⚡ Ricochet Sync Guide</span>
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

    <!-- Live Memory Den Barcode Verification Scorecard Banner (when a report has arrived via API or CSV) -->
    <div
      v-if="mdVerifyReport"
      class="card bg-base-100 border border-success/30 shadow-sm p-4 space-y-3"
    >
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-2.5">
          <div class="p-2 bg-success/15 text-success rounded-xl shrink-0">
            <span class="text-base leading-none">📊</span>
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="font-black text-sm text-base-content">
                Memory Den Barcode Verification Report
              </h3>
              <span class="badge badge-xs badge-success text-success-content font-mono font-bold">
                {{ mdVerifyReport.summary.totalCatalog }} Booth Items Audited
              </span>
              <span
                v-if="verifyStatusFilter !== 'ALL'"
                class="badge badge-xs badge-primary text-primary-content font-mono font-bold"
              >
                Filtered: {{ verifyStatusFilter }}
              </span>
            </div>
            <p class="text-[11px] opacity-70">
              Verified {{ formatDate(mdVerifyReport.timestamp) }} • Click any pill below to filter the table
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <button
            v-if="mdVerifyReport.summary.unlinkedInRc > 0"
            type="button"
            class="btn btn-xs btn-primary font-bold gap-1"
            @click="applyVerificationPillFilter('UNLINKED_IN_RC')"
          >
            <span>🔍 Match {{ mdVerifyReport.summary.unlinkedInRc }} Unlinked Items</span>
          </button>
          <button
            type="button"
            class="btn btn-xs btn-outline border-base-300 font-bold gap-1"
            @click="applyVerificationPillFilter('ALL')"
          >
            <span>📋 Load All {{ mdVerifyReport.summary.totalCatalog }} Items</span>
          </button>
          <button
            type="button"
            class="btn btn-xs btn-ghost opacity-60 hover:opacity-100"
            @click="mdVerifyReport = null; verifyStatusFilter = 'ALL'"
            title="Dismiss scorecard"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- 4 Clickable Filter Pills -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          type="button"
          class="p-2.5 rounded-xl bg-success/10 hover:bg-success/20 border border-success/30 flex items-center justify-between text-left transition-all cursor-pointer"
          :class="verifyStatusFilter === 'VERIFIED_MATCH' ? 'ring-2 ring-success ring-offset-1 bg-success/20' : ''"
          @click="applyVerificationPillFilter('VERIFIED_MATCH')"
          title="Click to filter table to Verified items in Memory Den"
        >
          <span class="text-xs font-bold text-success">🟢 Verified in MD</span>
          <span class="font-mono font-black text-sm text-success">{{ mdVerifyReport.summary.verifiedMatch }}</span>
        </button>

        <button
          type="button"
          class="p-2.5 rounded-xl bg-warning/10 hover:bg-warning/20 border border-warning/30 flex items-center justify-between text-left transition-all cursor-pointer"
          :class="verifyStatusFilter === 'MISSING_IN_MD' ? 'ring-2 ring-warning ring-offset-1 bg-warning/20' : ''"
          @click="applyVerificationPillFilter('MISSING_IN_MD')"
          title="Click to inspect the items still missing a UPC in Memory Den"
        >
          <span class="text-xs font-bold text-warning">🟡 Missing UPC in MD</span>
          <span class="font-mono font-black text-sm text-warning">{{ mdVerifyReport.summary.missingInMd }}</span>
        </button>

        <button
          type="button"
          class="p-2.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 flex items-center justify-between text-left transition-all cursor-pointer"
          :class="verifyStatusFilter === 'MISMATCH_UPC' ? 'ring-2 ring-orange-500 ring-offset-1 bg-orange-500/20' : ''"
          @click="applyVerificationPillFilter('MISMATCH_UPC')"
          title="Click to inspect items whose Memory Den UPC differs from Resale Command"
        >
          <span class="text-xs font-bold text-orange-500">🟠 Mismatched UPC</span>
          <span class="font-mono font-black text-sm text-orange-500">{{ mdVerifyReport.summary.mismatchUpc }}</span>
        </button>

        <button
          type="button"
          class="p-2.5 rounded-xl bg-base-200/70 hover:bg-base-300/70 border border-base-300 flex items-center justify-between text-left transition-all cursor-pointer"
          :class="verifyStatusFilter === 'UNLINKED_IN_RC' ? 'ring-2 ring-primary ring-offset-1 bg-primary/10' : ''"
          @click="applyVerificationPillFilter('UNLINKED_IN_RC')"
          title="Click to load & match unlinked Memory Den items (shows In-Stock first)"
        >
          <span class="text-xs font-bold opacity-80">⚪ Unlinked in RC</span>
          <span class="font-mono font-black text-sm text-base-content">{{ mdVerifyReport.summary.unlinkedInRc }}</span>
        </button>
      </div>

      <!-- Diagnostic Banner When Viewing "🟡 Missing UPC in MD" -->
      <div
        v-if="verifyStatusFilter === 'MISSING_IN_MD'"
        class="p-3 rounded-xl bg-warning/15 border border-warning/40 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5"
      >
        <div class="space-y-0.5">
          <div class="font-black text-warning-content flex items-center gap-1.5">
            <span>🔎 Why these {{ displayedRows.length }} item(s) didn't accept their UPC in Memory Den:</span>
          </div>
          <p class="opacity-85 leading-relaxed">
            Memory Den's POS rejects a barcode if that exact <code>HUCK-XXXX</code> is <strong>already used on another <code>0EJ...</code> SKU</strong> (for example, two separate booth tags linked to the same DB item). Click <strong>🔧 Assign Unique Barcode</strong> on any row below to give it its own unique <code>HUCK-</code> barcode, then re-run the Bookmarklet!
          </p>
        </div>
        <button
          type="button"
          class="btn btn-xs btn-warning text-warning-content font-black shrink-0 gap-1"
          @click="verifyStatusFilter = 'ALL'; filterTab = 'all'"
        >
          <span>Show All {{ syncRows.length }} Rows</span>
        </button>
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
          <h2 class="text-xl font-bold mb-1">Upload Location Inventory Export</h2>
          <p class="text-xs opacity-70 mb-3 max-w-sm">
            Drop Ricochet's <strong>Inventory Export</strong> (with Product ID, SKU, UPC) to permanently link your booth SKUs (<code class="text-xs">0EJ...</code>) to your <code class="text-xs">HUCK-</code> barcodes.
          </p>
          <div class="alert alert-info py-2 px-3 text-xs mb-4 rounded-xl flex items-center justify-between text-left">
            <span>Looking to reconcile monthly sales &amp; payout checks? Use the <a href="/sales/import" class="link font-bold underline">Sales Importer</a> with your Payout CSV!</span>
          </div>

          <!-- Org Prefix Guard Selector -->
          <div class="flex items-center gap-2.5 mb-6 bg-base-200/80 px-3.5 py-2 rounded-xl border border-base-300 text-xs">
            <label class="cursor-pointer flex items-center gap-2 font-bold select-none text-left">
              <input type="checkbox" v-model="onlySyncOrgPrefix" class="checkbox checkbox-primary checkbox-xs" />
              <span>Only sync Org Prefix:</span>
            </label>
            <input type="text" v-model="upcPrefix" class="input input-xs input-bordered w-24 font-mono font-bold uppercase" placeholder="HUCK-" />
            <span class="text-[10px] opacity-60">(Ignores 3rd-party items)</span>
          </div>

          <div class="flex items-center gap-3 justify-center flex-wrap">
            <label class="btn btn-primary btn-md gap-2 font-bold shadow-lg shadow-primary/20 cursor-pointer">
              <Icon icon="solar:file-text-bold" class="w-5 h-5" />
              <span>Select CSV File</span>
              <input type="file" accept=".csv" class="hidden" @change="handleFileSelect" :disabled="isParsing" />
            </label>

            <button 
              type="button" 
              class="btn btn-secondary btn-outline btn-md gap-2 font-bold shadow-sm"
              @click="loadDemoCsv"
              :disabled="isParsing"
              title="Instantly test multi-org sales bucketing with mock data (zero database dependency)"
            >
              <span>⚡ Load Test / Demo CSV</span>
            </button>
          </div>

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
      
      <!-- Catalog & Stock-Level Sync Banner (Products-*.csv) -->
      <div v-if="syncRows.length > 0 && isCatalogExport" class="alert alert-success py-2.5 px-4 rounded-xl text-xs shadow-sm">
        <span>
          <strong>📦 Catalog &amp; Stock-Level Sync (Products-*.csv):</strong>
          this file only updates your items (booth SKU, price, status, quantity). It has no Sale # or Sold Date, so
          <strong>no sales are ever created</strong> from it.
        </span>
      </div>

      <!-- Org Sales Bucketing Banner -->
      <div v-if="syncRows.length > 0" class="alert alert-info py-2.5 px-4 rounded-xl text-xs flex justify-between items-center shadow-sm">
        <div class="flex items-center gap-2">
          <Icon icon="solar:folder-with-files-bold" class="w-5 h-5 text-info-content shrink-0" />
          <span>
            <strong>Multi-Org Sales Bucketing Active:</strong> 
            <strong>{{ primaryBucketCount }}</strong> in {{ primaryOrgKey }} (Primary), 
            <strong v-if="partnerBucketCount > 0">{{ partnerBucketCount }} in Partner Buckets, </strong>
            <strong>{{ unassignedBucketCount }}</strong> in Unassigned Store SKUs. 
            All sales rows preserved with zero data loss!
          </span>
        </div>
      </div>

      <!-- Booth Rent Deductions Alert Banner -->
      <div v-if="detectedRentDeductions.length > 0" class="alert alert-secondary py-3 px-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm border border-secondary/20 bg-secondary/10">
        <div class="flex items-start sm:items-center gap-2.5">
          <Icon icon="solar:tag-price-bold" class="w-6 h-6 text-secondary shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <div class="font-bold text-xs sm:text-sm text-base-content">
              Found {{ detectedRentDeductions.length }} Space Rental Deductions (${{ totalRentDetected.toFixed(2) }} total)
            </div>
            <div class="text-[11px] opacity-75">
              Memory Den deducted booth rent from these payouts. These are 100% tax-deductible operating expenses (Schedule C Line 20b).
            </div>
          </div>
        </div>
        <button 
          type="button" 
          class="btn btn-xs sm:btn-sm btn-secondary font-bold shrink-0 shadow-xs" 
          :disabled="isLoggingRent" 
          @click="logRentDeductionsToExpenses"
        >
          <Icon v-if="isLoggingRent" icon="solar:refresh-circle-bold" class="w-4 h-4 animate-spin" />
          <Icon v-else icon="solar:document-add-bold" class="w-4 h-4" />
          Log to Tax Expenses (${{ totalRentDetected.toFixed(2) }})
        </button>
      </div>

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
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 flex-wrap">
          <!-- Org Bucket Pills -->
          <div class="flex items-center gap-1 bg-base-200/80 p-1 rounded-lg border border-base-300 shrink-0">
            <button 
              class="btn btn-xs rounded-md transition-all font-bold"
              :class="selectedOrgBucket === 'all' ? 'btn-neutral text-white' : 'btn-ghost'"
              @click="selectedOrgBucket = 'all'"
            >
              All ({{ syncRows.length }})
            </button>
            <button 
              class="btn btn-xs rounded-md transition-all font-bold"
              :class="selectedOrgBucket === 'primary' ? 'btn-primary text-white shadow-xs' : 'btn-ghost text-primary'"
              @click="selectedOrgBucket = 'primary'"
            >
              ⭐ {{ primaryOrgKey }} ({{ primaryBucketCount }})
            </button>
            <button 
              v-if="partnerBucketCount > 0"
              class="btn btn-xs rounded-md transition-all font-bold"
              :class="selectedOrgBucket === 'partner' ? 'btn-secondary text-white shadow-xs' : 'btn-ghost text-secondary'"
              @click="selectedOrgBucket = 'partner'"
            >
              🤝 Partners ({{ partnerBucketCount }})
            </button>
            <button 
              v-if="unassignedBucketCount > 0"
              class="btn btn-xs rounded-md transition-all font-bold"
              :class="selectedOrgBucket === 'unassigned' ? 'btn-warning text-black shadow-xs' : 'btn-ghost text-warning'"
              @click="selectedOrgBucket = 'unassigned'"
            >
              🏷️ Store SKUs ({{ unassignedBucketCount }})
            </button>
          </div>

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
              :class="filterTab === 'all' && verifyStatusFilter === 'ALL' ? 'btn-primary text-white shadow-md shadow-primary/20' : 'btn-ghost bg-base-200'" 
              @click="filterTab = 'all'; verifyStatusFilter = 'ALL'"
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

        <!-- Top Toolbar: Prefix Config, CSV Download Toggle & Clear -->
        <div class="flex items-center gap-3 w-full lg:w-auto justify-end flex-wrap">
          <!-- Interactive UPC Prefix Selector -->
          <div class="flex items-center gap-1.5 bg-base-200/80 px-2.5 py-1 rounded-xl border border-base-300">
            <span class="text-[11px] font-bold opacity-60 flex items-center gap-1">
              <Icon icon="solar:barcode-bold" class="w-3.5 h-3.5 text-primary" />
              Prefix:
            </span>
            <div class="join">
              <button 
                v-for="org in availableOrgPrefixes"
                :key="org.prefix"
                type="button" 
                class="btn btn-xs join-item" 
                :class="upcPrefix === org.prefix ? 'btn-active btn-primary text-primary-content font-black shadow-xs' : 'btn-ghost'"
                @click="upcPrefix = org.prefix"
                :title="org.name"
              >
                {{ org.label }}
              </button>
            </div>
            <input 
              type="text" 
              v-model="upcPrefix" 
              class="input input-bordered input-xs w-20 font-mono uppercase font-bold text-xs" 
              placeholder="PREFIX-" 
            />
            <span class="text-[10px] font-mono opacity-70 hidden sm:inline">
              Next: <code class="text-primary font-bold">{{ nextPreviewUpc }}</code>
            </span>
          </div>

          <label class="label cursor-pointer gap-2 py-0">
            <input type="checkbox" v-model="exportUpdatedCsv" class="checkbox checkbox-sm checkbox-primary" />
            <span class="label-text text-xs font-semibold">Download Synced CSV</span>
          </label>

          <button class="btn btn-sm btn-ghost text-xs" @click="resetSync">Clear File</button>
        </div>
      </div>

      <!-- HIGH-CONFIDENCE UX PRO RECONCILIATION SUMMARY BAR (Confidence First — Zero Blind Writes) -->
      <div
        v-if="unmatchedCount > 0"
        class="bg-base-100 rounded-2xl border-2 border-primary/25 p-3.5 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3"
      >
        <div class="space-y-1.5 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
              <span>🎯 Staged Match Confidence Triage</span>
            </span>
            <span class="badge badge-xs badge-success text-success-content font-bold gap-1">
              🟢 Live Tab Sync Active
            </span>
            <span class="text-[11px] opacity-70">
              Review inline previews below — nothing commits until you click Confirm, Split, or Approve Selected!
            </span>
          </div>

          <div class="flex items-center gap-1.5 flex-wrap pt-0.5">
            <button
              type="button"
              class="btn btn-xs rounded-lg font-bold gap-1"
              :class="confidenceTierFilter === 'ALL' ? 'btn-primary text-primary-content' : 'btn-ghost bg-base-200'"
              @click="confidenceTierFilter = 'ALL'"
            >
              All Unlinked ({{ unmatchedCount }})
            </button>
            <button
              type="button"
              class="btn btn-xs rounded-lg font-bold gap-1"
              :class="confidenceTierFilter === 'HIGH' ? 'btn-success text-success-content shadow-xs' : 'btn-ghost bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'"
              @click="filterTab = 'unmatched'; confidenceTierFilter = confidenceTierFilter === 'HIGH' ? 'ALL' : 'HIGH'"
            >
              🟢 High Confidence 88%+ ({{ highConfidenceUnmatchedRows.length }})
            </button>
            <button
              type="button"
              class="btn btn-xs rounded-lg font-bold gap-1"
              :class="confidenceTierFilter === 'LOT_SPLIT' ? 'btn-secondary text-secondary-content shadow-xs' : 'btn-ghost bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/30'"
              @click="filterTab = 'unmatched'; confidenceTierFilter = confidenceTierFilter === 'LOT_SPLIT' ? 'ALL' : 'LOT_SPLIT'"
            >
              📦 Multi-Piece Lot Splits ({{ lotSplitUnmatchedRows.length }})
            </button>
            <button
              type="button"
              class="btn btn-xs rounded-lg font-bold gap-1"
              :class="confidenceTierFilter === 'REVIEW' ? 'btn-warning text-warning-content shadow-xs' : 'btn-ghost bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/30'"
              @click="filterTab = 'unmatched'; confidenceTierFilter = confidenceTierFilter === 'REVIEW' ? 'ALL' : 'REVIEW'"
            >
              🟡 Review 60–87% ({{ reviewUnmatchedRows.length }})
            </button>
            <button
              type="button"
              class="btn btn-xs rounded-lg font-bold gap-1"
              :class="confidenceTierFilter === 'NEW_ITEM' ? 'btn-info text-info-content shadow-xs' : 'btn-ghost bg-base-200 border border-base-300'"
              @click="filterTab = 'unmatched'; confidenceTierFilter = confidenceTierFilter === 'NEW_ITEM' ? 'ALL' : 'NEW_ITEM'"
            >
              ⚪ New Booth Items ({{ newBoothUnmatchedRows.length }})
            </button>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            class="btn btn-xs sm:btn-sm bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black border-none shadow-xs gap-1.5"
            :disabled="isAiMatching || isBatchApproving"
            @click="triggerAiMatching"
            title="Chunked Gemini 2.5 Flash Smart-Stager: scores unlinked booth items in batches of 20 against unclaimed inventory & parent lots without blind writes"
          >
            <span v-if="isAiMatching" class="loading loading-spinner loading-xs"></span>
            <span v-if="isAiMatching">{{ aiMatchingProgressText || '⏳ AI Analyzing...' }}</span>
            <span v-else>✨ AI Smart-Stage Unlinked ({{ targetAiUnmappedRows.length }})</span>
          </button>

          <button
            v-if="selectedHighConfidenceRows.length > 0"
            type="button"
            class="btn btn-xs sm:btn-sm btn-success text-success-content font-black shadow-xs gap-1.5"
            :disabled="isBatchApproving"
            @click="approveSelectedStagedMatches"
          >
            <span v-if="isBatchApproving" class="loading loading-spinner loading-xs"></span>
            <span>✅ Approve Selected Matches ({{ selectedHighConfidenceRows.length }})</span>
          </button>
        </div>
      </div>

      <!-- Main Reconciliation Table Container (pb-44 for bottom dock clearance) -->
      <div class="bg-base-100 rounded-2xl border border-base-300 shadow-sm overflow-x-auto pb-44">
        <table class="table w-full">
            <thead>
              <tr class="bg-base-200/90 text-xs font-black uppercase tracking-wider text-base-content/80 border-b border-base-300">
                <th class="w-12 text-center">Match</th>
                <th class="w-24">Status</th>
                <th class="w-28 font-mono">Booth SKU</th>
                <th class="min-w-64">Incoming CSV Product Title</th>
                <th class="w-24 text-right font-mono">Price</th>
                <th class="w-32 text-right font-mono text-success">Net Payout</th>
                <th class="min-w-96">Resale Command Matched Item & Barcode</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-base-200">
              <tr 
                v-for="(row, idx) in displayedRows" 
                :key="row.originalLineIndex" 
                class="transition-colors border-l-4"
                :class="[
                  row.mappedItem ? 'border-l-success hover:bg-success/5' : 'border-l-warning hover:bg-warning/5',
                  idx % 2 === 0 ? 'bg-base-100' : 'bg-base-200/30'
                ]"
              >
                
                <!-- Match Indicator -->
                <td class="text-center align-middle">
                  <div class="tooltip tooltip-right" :data-tip="row.mappedItem ? 'Mapped to ' + (row.mappedItem.upc || row.mappedItem.title) : 'Unmatched item'">
                    <Icon v-if="row.mappedItem" icon="solar:check-circle-bold" class="w-5 h-5 text-success inline-block" />
                    <Icon v-else icon="solar:danger-circle-bold" class="w-5 h-5 text-warning inline-block" />
                  </div>
                </td>

                <!-- Status Badge -->
                <td class="align-middle">
                  <span 
                    class="badge badge-sm font-black whitespace-nowrap shrink-0" 
                    :class="(row.status === 'sold' || row.status === 'paid') ? 'badge-success text-success-content' : 'badge-info text-info-content'"
                  >
                    {{ (row.status === 'sold' || row.status === 'paid') ? 'Sold / Paid' : 'In Stock' }}
                  </span>
                </td>

                <!-- Extracted SKU -->
                <td class="align-middle">
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
                  <div v-else class="group flex flex-col items-start gap-1">
                    <div class="flex items-center gap-1">
                      <span class="font-mono text-xs font-black text-secondary bg-base-200/90 px-2.5 py-1 rounded-lg border border-base-300">
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
                    <span 
                      v-if="row.orgBucket && row.orgBucket.toUpperCase() !== primaryOrgKey"
                      class="badge badge-xs font-mono font-bold"
                      :class="row.orgBucket === 'UNASSIGNED' ? 'badge-ghost opacity-70 text-[9px]' : 'badge-secondary text-[9px]'"
                    >
                      {{ row.orgBucket }}
                    </span>
                  </div>
                </td>

                <!-- CSV Name (Auto-wrapping, clear font, zero awkward truncation) -->
                <td class="align-middle py-3">
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
                  <div v-else class="group flex items-start justify-between gap-2 max-w-lg">
                    <div class="font-bold text-xs sm:text-sm text-base-content leading-snug break-words">
                      {{ row.itemName }}
                      <span v-if="row.isAlreadyRecorded" class="badge badge-xs badge-success font-bold whitespace-nowrap ml-1 align-middle" title="Already in the sales ledger. Skipped; will not change stock.">✅ Already Recorded (Skipped)</span>
                    </div>
                    <button 
                      v-if="!row.mappedItem" 
                      class="btn btn-xs btn-ghost btn-circle opacity-0 group-hover:opacity-80 transition-opacity shrink-0 mt-0.5" 
                      @click="row.isEditing = true"
                      title="Edit title / fix typos"
                    >
                      <Icon icon="solar:pen-linear" class="w-3 h-3 text-primary" />
                    </button>
                  </div>
                </td>

                <!-- Listed Agreed Price -->
                <td class="text-right font-mono text-xs sm:text-sm font-semibold opacity-80 align-middle whitespace-nowrap">
                  ${{ (row.listedPrice || 0).toFixed(2) }}
                </td>

                <!-- Net Take-Home Price (What you made after fees) -->
                <td class="text-right font-mono font-black text-success text-xs sm:text-sm align-middle whitespace-nowrap">
                  <div>${{ (row.netSoldPrice || 0).toFixed(2) }}</div>
                  <div v-if="row.consignorPct && row.consignorPct < 100" class="text-[10px] font-normal text-base-content/60 font-sans">
                    {{ row.consignorPct }}% split (-${{ (row.commissionFee || 0).toFixed(2) }})
                  </div>
                </td>

                <!-- Mapping Picker or Matched Item Info (Inventory Match Drawer Trigger — No Tiny Table-Cell Dropdowns!) -->
                <td class="align-middle py-3">
                  <!-- Matched Display Card -->
                  <div v-if="row.mappedItem" class="flex items-start sm:items-center gap-2.5 p-2.5 bg-base-100 dark:bg-base-200 rounded-xl border border-base-300 shadow-2xs">
                    <!-- Thumbnail -->
                    <div class="w-10 h-10 rounded-lg bg-base-300 border border-base-content/10 overflow-hidden shrink-0 flex items-center justify-center">
                      <img
                        v-if="getItemThumbUrl(row.mappedItem)"
                        :src="getItemThumbUrl(row.mappedItem)"
                        :alt="row.mappedItem.title"
                        class="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <Icon v-else icon="solar:gallery-minimalistic-linear" class="w-5 h-5 opacity-35" />
                    </div>

                    <!-- Full Untruncated Title + Badges -->
                    <div class="flex-1 min-w-0 space-y-1">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span 
                          class="badge badge-xs font-mono font-black cursor-pointer hover:brightness-110 active:scale-95 transition-all whitespace-nowrap shrink-0 shadow-xs" 
                          :class="row.mappedItem.upc ? 'badge-primary text-primary-content' : 'badge-ghost'"
                          @click="cycleUpcPrefix(row.mappedItem)"
                          title="Click to toggle or generate next sequential barcode"
                        >
                          {{ row.mappedItem.upc || 'NO UPC' }}
                        </span>
                        <span class="badge badge-xs badge-ghost font-mono font-semibold whitespace-nowrap shrink-0">
                          DB: ${{ Number(row.mappedItem.resalePrice || row.mappedItem.listPrice || 0).toFixed(2) }}
                        </span>
                        <span class="badge badge-xs badge-outline font-mono opacity-75 whitespace-nowrap shrink-0">
                          {{ row.mappedItem.status || 'received' }} @ {{ row.mappedItem.storageLocation || 'HG' }}
                        </span>
                        <span v-if="row.isSavedToMd" class="badge badge-xs badge-success text-success-content font-black gap-0.5 whitespace-nowrap shrink-0">
                          ✓ Saved to MD
                        </span>
                        <span v-if="row.uniqueBarcodeAssigned" class="badge badge-xs badge-success text-success-content font-black gap-0.5 whitespace-nowrap shrink-0">
                          ✅ Unique Barcode Assigned (Push in MD Widget)
                        </span>
                        <span v-else-if="row.verifyStatus === 'MISSING_IN_MD'" class="badge badge-xs badge-warning text-warning-content font-black gap-0.5 whitespace-nowrap shrink-0" title="Missing UPC in Memory Den — click Assign Unique Barcode if this barcode is shared with another 0EJ SKU">
                          🟡 Missing UPC in MD
                        </span>
                        <span v-else-if="row.verifyStatus === 'MISMATCH_UPC'" class="badge badge-xs bg-orange-500 text-white font-black gap-0.5 whitespace-nowrap shrink-0" title="Ricochet already has a physical barcode attached to this item — never overwritten by Fill Missing">
                          🟠 Physical Tag Mismatch (MD: {{ row.extractedUpc }})
                        </span>
                        <span v-if="row.aiMatched" class="badge badge-xs bg-purple-600 text-white font-black gap-0.5 whitespace-nowrap shrink-0" :title="row.aiReason || 'Matched by Gemini AI'">
                          ✨ AI
                        </span>
                      </div>
                      <div class="text-xs font-bold leading-snug text-base-content break-words whitespace-normal">
                        {{ row.mappedItem.title }}
                      </div>
                      <div v-if="row.uniqueBarcodeAssigned" class="pt-1 flex items-center gap-2 flex-wrap">
                        <span class="badge badge-sm badge-success text-success-content font-bold gap-1 py-2.5 px-2.5 shadow-2xs">
                          ✅ Unique Barcode Assigned ({{ row.mappedItem.upc || row.extractedUpc }}) — Push in MD Widget
                        </span>
                      </div>
                      <div v-else-if="row.verifyStatus === 'MISMATCH_UPC' && row.extractedUpc" class="pt-1 flex items-center gap-2 flex-wrap">
                        <span class="text-[11px] text-orange-400 font-semibold font-mono">
                          🏷️ Booth Tag: <b>{{ row.extractedUpc }}</b> vs RC DB: <b>{{ row.mappedItem.upc }}</b> (Protected from overwrite)
                        </span>
                        <button
                          type="button"
                          class="btn btn-xs bg-orange-500 hover:bg-orange-600 text-white border-none font-black gap-1 shadow-2xs"
                          :disabled="row.isAdoptingBoothUpc"
                          @click="adoptBoothTagForRow(row)"
                        >
                          <span v-if="row.isAdoptingBoothUpc" class="loading loading-spinner loading-xs"></span>
                          <span>🏷️ Adopt Booth Tag ({{ row.extractedUpc }})</span>
                        </button>
                      </div>
                      <div v-else-if="row.verifyStatus === 'MISSING_IN_MD'" class="pt-1 flex items-center gap-2 flex-wrap">
                        <span class="text-[11px] text-warning font-semibold">
                          {{ getRowConflictReason(row) }}
                        </span>
                        <button
                          type="button"
                          class="btn btn-xs btn-warning text-warning-content font-black gap-1 shadow-2xs"
                          :disabled="row.isAssigningUniqueUpc"
                          @click="assignUniqueUpcToRow(row)"
                        >
                          <span v-if="row.isAssigningUniqueUpc" class="loading loading-spinner loading-xs"></span>
                          <span>🔧 Assign Unique Barcode ({{ getRowPreviewUpc(row) }})</span>
                        </button>
                      </div>
                    </div>

                    <!-- Change / Unlink Actions -->
                    <div class="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        class="btn btn-xs btn-ghost border border-base-300 hover:border-primary/40 font-bold gap-1"
                        @click="openMatchDrawer(row)"
                        title="Open Inventory Match Drawer to inspect or change linked item"
                      >
                        🔄 Change
                      </button>
                      <button
                        type="button"
                        class="btn btn-xs btn-ghost btn-circle text-error/80 hover:text-error hover:bg-error/10 shrink-0"
                        @click="row.mappedItem = null; row.aiMatched = false; row.isSavedToMd = false;"
                        title="Unlink Item"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <!-- Unmatched Trigger: Inline #1 High-Confidence Staged Preview + Lot Split + Match Drawer + Quick Add -->
                  <div v-else class="space-y-1.5">
                    <!-- Inline #1 Candidate Preview Card (Confidence First — Never Auto-Commits Without User Click) -->
                    <div
                      v-if="getTopStagedCandidateForRow(row)"
                      class="p-2.5 rounded-xl border transition-all space-y-2"
                      :class="
                        getTopStagedCandidateForRow(row)!.confidence >= 88
                          ? 'bg-emerald-500/5 border-emerald-500/35'
                          : getTopStagedCandidateForRow(row)!.isParentLot || getTopStagedCandidateForRow(row)!.recommendedAction === 'split_lot'
                            ? 'bg-purple-500/5 border-purple-500/35'
                            : 'bg-amber-500/5 border-amber-500/30'
                      "
                    >
                      <div class="flex items-start gap-2.5">
                        <!-- Batch Approval Checkbox -->
                        <input
                          type="checkbox"
                          v-model="row.selectedForApproval"
                          class="checkbox checkbox-xs checkbox-success mt-1 shrink-0"
                          title="Include this staged match in '✅ Approve Selected Matches'"
                        />

                        <!-- Candidate Photo Thumbnail -->
                        <div class="w-10 h-10 rounded-lg bg-base-300 border border-base-content/10 overflow-hidden shrink-0 flex items-center justify-center">
                          <img
                            v-if="getItemThumbUrl(getTopStagedCandidateForRow(row)!.item)"
                            :src="getItemThumbUrl(getTopStagedCandidateForRow(row)!.item)"
                            :alt="getTopStagedCandidateForRow(row)!.item.title"
                            class="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <Icon v-else icon="solar:gallery-minimalistic-linear" class="w-5 h-5 opacity-35" />
                        </div>

                        <!-- Candidate Info + Confidence Badge + Reason -->
                        <div class="flex-1 min-w-0 space-y-1">
                          <div class="flex items-center gap-1.5 flex-wrap">
                            <span
                              class="badge badge-xs font-black whitespace-nowrap shrink-0"
                              :class="
                                getTopStagedCandidateForRow(row)!.confidence >= 88
                                  ? 'badge-success text-success-content'
                                  : 'badge-warning text-warning-content'
                              "
                            >
                              {{ getTopStagedCandidateForRow(row)!.confidence >= 88 ? '🟢 High' : '🟡 Review' }} {{ getTopStagedCandidateForRow(row)!.confidence }}%
                            </span>
                            <span
                              v-if="getTopStagedCandidateForRow(row)!.isParentLot || getTopStagedCandidateForRow(row)!.recommendedAction === 'split_lot'"
                              class="badge badge-xs badge-secondary text-secondary-content font-black whitespace-nowrap shrink-0"
                            >
                              📦 Lot Split (~{{ getTopStagedCandidateForRow(row)!.estimatedLotCount }} pcs • ${{ getTopStagedCandidateForRow(row)!.unitCostShare.toFixed(2) }}/ea cost)
                            </span>
                            <span class="badge badge-xs badge-primary text-primary-content font-mono font-black whitespace-nowrap shrink-0">
                              {{ getTopStagedCandidateForRow(row)!.item.upc || 'NO UPC' }}
                            </span>
                            <span class="badge badge-xs badge-ghost font-mono font-semibold whitespace-nowrap shrink-0">
                              DB: ${{ Number(getTopStagedCandidateForRow(row)!.item.resalePrice || 0).toFixed(2) }} • Cost: ${{ Number(getTopStagedCandidateForRow(row)!.item.cost || 0).toFixed(2) }}
                            </span>
                          </div>

                          <div class="text-xs font-bold leading-snug text-base-content break-words whitespace-normal">
                            {{ getTopStagedCandidateForRow(row)!.item.title || getTopStagedCandidateForRow(row)!.item.identity }}
                          </div>

                          <div v-if="getTopStagedCandidateForRow(row)!.reasons?.length" class="flex items-center gap-1 flex-wrap">
                            <span
                              v-for="(reason, rIdx) in getTopStagedCandidateForRow(row)!.reasons.slice(0, 3)"
                              :key="rIdx"
                              class="text-[10px] px-1.5 py-0.5 rounded bg-base-200 text-base-content/80 font-semibold"
                            >
                              {{ reason }}
                            </span>
                          </div>
                        </div>
                      </div>

                      <!-- 1-Click Inline Action Row: Confirm Link OR Split Piece from Lot + Drawer + Add New -->
                      <div class="flex items-center gap-1.5 flex-wrap pt-1 border-t border-base-300/60">
                        <button
                          v-if="getTopStagedCandidateForRow(row)!.isParentLot || getTopStagedCandidateForRow(row)!.recommendedAction === 'split_lot'"
                          type="button"
                          class="btn btn-xs btn-secondary text-secondary-content font-black gap-1 shadow-2xs"
                          :disabled="row.isConfirmingInline"
                          @click="splitLotPieceAndLinkToMd(row, getTopStagedCandidateForRow(row)!.item, getTopStagedCandidateForRow(row)!.estimatedLotCount)"
                        >
                          <span v-if="row.isConfirmingInline" class="loading loading-spinner loading-xs"></span>
                          <span>✂️ Split Piece from Lot &amp; Link</span>
                        </button>
                        <button
                          v-else
                          type="button"
                          class="btn btn-xs btn-success text-success-content font-black gap-1 shadow-2xs"
                          :disabled="row.isConfirmingInline"
                          @click="confirmInlineCandidateLink(row, getTopStagedCandidateForRow(row)!.item)"
                        >
                          <span v-if="row.isConfirmingInline" class="loading loading-spinner loading-xs"></span>
                          <span>🔗 Confirm Link</span>
                        </button>

                        <button
                          type="button"
                          class="btn btn-xs btn-outline border-base-300 hover:border-primary font-bold gap-1"
                          @click="openMatchDrawer(row)"
                        >
                          <span>🔍 Drawer ({{ getRowSuggestedCount(row) }})</span>
                        </button>

                        <button
                          type="button"
                          class="btn btn-xs btn-ghost border border-base-300 font-bold gap-1 ml-auto"
                          :disabled="row.isQuickAdding"
                          @click="quickAddRow(row)"
                        >
                          <span v-if="row.isQuickAdding" class="loading loading-spinner loading-xs"></span>
                          <span>+ Add New ({{ getRowPreviewUpc(row) }})</span>
                        </button>
                      </div>
                    </div>

                    <!-- Fallback when 0 suggested candidates: New Booth Item pill + Open Match Drawer + Quick Add -->
                    <div v-else class="space-y-1">
                      <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <span
                          class="badge badge-xs badge-info text-info-content font-black whitespace-nowrap shrink-0"
                          title="Added on the fly at the booth — 1 click imports to Resale Command (placed @ MD) &amp; assigns sequential barcode"
                        >
                          🆕 New Booth Item
                        </span>
                        <button
                          type="button"
                          class="btn btn-xs sm:btn-sm btn-outline border-base-300 hover:border-primary hover:bg-primary/5 text-base-content font-bold gap-1.5 flex-1 justify-between min-w-[155px] shadow-2xs"
                          @click="openMatchDrawer(row)"
                        >
                          <span class="flex items-center gap-1.5 truncate">
                            <span>🔍 Open Match Drawer</span>
                          </span>
                          <span class="badge badge-xs badge-ghost opacity-70 whitespace-nowrap shrink-0">
                            Search All
                          </span>
                        </button>

                        <!-- Quick Add Button per row with Partner Prefix Protection (BB- / PDXGL- / HUCK-) -->
                        <button 
                          type="button"
                          class="btn btn-xs sm:btn-sm shrink-0 gap-1 font-bold shadow-xs"
                          :class="row.isBbRow || row.orgBucket === 'BB' ? 'btn-warning text-warning-content' : row.customPrefix === 'PDXGL-' ? 'btn-secondary text-secondary-content' : 'btn-primary'"
                          :disabled="row.isQuickAdding"
                          @click="quickAddRow(row)"
                          title="Import this new booth item to Resale Command (placed @ MD) with partner-protected sequential barcode"
                        >
                          <span v-if="row.isQuickAdding" class="loading loading-spinner loading-xs"></span>
                          <Icon v-else icon="solar:add-circle-bold" class="w-3.5 h-3.5" />
                          + Import to RC ({{ getRowPreviewUpc(row) }})
                        </button>
                      </div>
                      <div v-if="row.aiEvaluated && row.aiReason" class="text-[10px] text-purple-600 dark:text-purple-300 font-semibold px-1">
                        ✨ AI: {{ row.aiReason }}
                      </div>
                    </div>

                    <!-- Partner Prefix Protection Guard Pill for Board/Card Games -->
                    <div v-if="isBoardOrCardGameRow(row) && !row.isBbRow && row.orgBucket !== 'BB'" class="flex items-center">
                      <button
                        type="button"
                        class="badge badge-sm font-bold gap-1 py-2.5 px-2.5 cursor-pointer transition-all shadow-2xs"
                        :class="row.customPrefix === 'PDXGL-' ? 'badge-secondary text-secondary-content' : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-300 border border-amber-500/40'"
                        @click="toggleRowPdxglPrefix(row)"
                      >
                        <span v-if="row.customPrefix === 'PDXGL-'">🎲 Using PDXGL- (Click to switch back to {{ upcPrefix }})</span>
                        <span v-else>🎲 Board Game — Switch prefix to PDXGL-?</span>
                      </button>
                    </div>
                  </div>
                </td>

              </tr>
            </tbody>
          </table>
      </div>

    <!-- ========================================================================= -->
    <!-- CANONICAL CONTEXTUAL COMMAND DOCK (NN/g, Apple HIG, Material 3 Standard)   -->
    <!-- ========================================================================= -->
    <Teleport to="body">
      <div 
        v-if="syncRows.length > 0"
        class="fixed bottom-0 inset-x-0 z-40 bg-base-100/95 dark:bg-base-200/95 backdrop-blur-2xl border-t border-base-300 shadow-[0_-8px_30px_rgba(0,0,0,0.18)] select-none pointer-events-auto flex flex-col pb-[env(safe-area-inset-bottom,0px)]"
      >
        <!-- TIER 1: STATUS & TELEMETRY STRIP -->
        <div class="border-b border-base-content/10 bg-base-200/60 dark:bg-base-300/60 py-1.5 px-4 flex items-center justify-between text-xs">
          <div class="max-w-5xl w-full mx-auto flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="badge badge-xs badge-primary text-primary-content font-black font-mono whitespace-nowrap shrink-0">
                {{ matchedCount }} / {{ syncRows.length }} Items Ready
              </span>
              <span class="text-[11px] font-mono opacity-75">
                Prefix: <strong class="text-primary">{{ upcPrefix }}</strong> (Next: {{ nextPreviewUpc }})
              </span>
              <span v-if="unmatchedCount > 0" class="badge badge-xs badge-warning text-warning-content font-bold whitespace-nowrap shrink-0">
                {{ unmatchedCount }} Unlinked
              </span>
            </div>

            <!-- Deep Drawer Trigger for Full Guide -->
            <button 
              type="button" 
              class="btn btn-ghost btn-xs gap-1 font-bold text-base-content/80 hover:text-primary transition-colors shrink-0"
              @click="showBrowserSyncModal = true"
              title="Open full Ricochet sync guide, Userscript, and Bookmarklet options"
            >
              <Icon icon="solar:bolt-bold" class="w-3.5 h-3.5 text-warning" />
              <span>Ricochet Sync Guide & Bookmarklet ⌃</span>
            </button>
          </div>
        </div>

        <!-- TIER 2: ACTION BUTTONS STRIP (THUMB ZONE) -->
        <div class="py-2.5 px-4 flex items-center justify-center">
          <div class="max-w-5xl w-full mx-auto flex items-center justify-between gap-2.5 flex-wrap sm:flex-nowrap">
            <!-- Left: Batch Resolution Actions -->
            <div class="flex items-center gap-1.5 flex-wrap sm:flex-nowrap shrink-0">
              <button 
                v-if="unmatchedCount > 0"
                type="button"
                class="btn btn-xs sm:btn-sm bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black shadow-xs gap-1.5 border-none active:scale-95 shrink-0 min-h-[40px]"
                :disabled="isAiMatching || isBulkQuickAdding"
                @click="triggerAiMatching"
                title="Use Gemini AI to semantically match abbreviations, editions, and RPG sourcebooks in batches of 20"
              >
                <span v-if="isAiMatching" class="loading loading-spinner loading-xs"></span>
                <Icon v-else icon="solar:magic-stick-3-bold" class="w-4 h-4 text-yellow-300" />
                <span v-if="isAiMatching">{{ aiMatchingProgressText || '⏳ AI Analyzing...' }}</span>
                <template v-else>
                  <span class="hidden md:inline">✨ AI Match</span>
                  <span class="md:hidden">✨ AI</span>
                  <span>({{ targetAiUnmappedRows.length }})</span>
                </template>
              </button>

              <button 
                v-if="unmatchedSoldCount > 0"
                type="button"
                class="btn btn-xs sm:btn-sm btn-error text-white font-extrabold shadow-xs gap-1.5 active:scale-95 shrink-0 min-h-[40px]"
                :disabled="isBulkQuickAdding || isAiMatching"
                @click="bulkQuickAddUnmatched(true)"
                title="Auto-create inventory items for sold lines so net profit is recorded"
              >
                <span v-if="isBulkQuickAdding" class="loading loading-spinner loading-xs"></span>
                <Icon v-else icon="solar:cart-check-bold" class="w-4 h-4" />
                <span>Save Sold ({{ unmatchedSoldCount }})</span>
              </button>

              <button 
                v-if="unmatchedInStockCount > 0"
                type="button"
                class="btn btn-xs sm:btn-sm btn-warning text-black font-bold shadow-xs gap-1.5 active:scale-95 shrink-0 min-h-[40px]"
                :disabled="isBulkQuickAdding || isAiMatching"
                @click="bulkQuickAddUnmatched(false)"
                title="Auto-create in-stock items with sequential barcodes"
              >
                <span v-if="isBulkQuickAdding" class="loading loading-spinner loading-xs"></span>
                <Icon v-else icon="solar:box-minimalistic-bold" class="w-4 h-4" />
                <span>+ In-Stock ({{ unmatchedInStockCount }})</span>
              </button>
            </div>

            <!-- Center: CONTEXTUAL PRIMARY ACTION (Solid Elevated Tactile Pill) & Safe Test Pill -->
            <div class="flex items-center gap-1.5 shrink-0">
              <button 
                type="button" 
                class="btn btn-sm btn-outline btn-primary font-bold shadow-xs active:scale-95 gap-1.5 min-h-[44px] text-xs px-3"
                :disabled="matchedCount === 0"
                @click="copyPreloadedConsoleScript('single')"
                title="Safely test 1 single item first on your live Ricochet store before syncing all 240"
              >
                <Icon icon="solar:test-tube-bold" class="w-4 h-4 text-warning" />
                <span>Test 1 Item</span>
              </button>

              <button 
                type="button" 
                class="btn btn-sm btn-primary text-primary-content font-black shadow-md border border-primary-content/25 active:scale-95 hover:brightness-110 gap-2 px-5 min-h-[44px] text-xs sm:text-sm shrink-0"
                :disabled="matchedCount === 0"
                @click="copyPreloadedConsoleScript('full')"
                title="1-Click copy pre-bundled script with all matched items and barcodes"
              >
                <Icon icon="solar:copy-bold" class="w-4 h-4" />
                <span>⚡ Copy All ({{ matchedCount }})</span>
              </button>
            </div>

            <!-- Right: Commit to Local DB -->
            <button 
              type="button"
              class="btn btn-sm btn-secondary text-secondary-content font-bold shadow-md shadow-secondary/20 active:scale-95 min-h-[44px] gap-1.5 px-4 text-xs sm:text-sm shrink-0"
              :disabled="matchedCount === 0 || isCommitting" 
              @click="executeSync"
              title="Record sales transactions and assign SKUs in local database"
            >
              <span v-if="isCommitting" class="loading loading-spinner loading-xs"></span>
              <Icon v-else icon="solar:check-read-linear" class="w-4 h-4" />
              <span>Sync & Commit</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ========================================================================= -->
    <!-- CANONICAL SLIDE-OVER INVENTORY MATCH DRAWER (Replaces Table Dropdowns)    -->
    <!-- ========================================================================= -->
    <Teleport to="body">
      <div
        v-if="isMatchDrawerOpen && activeMatchRow"
        class="fixed inset-0 z-[9999] flex justify-end bg-black/60 backdrop-blur-xs transition-opacity"
        @click.self="closeMatchDrawer"
      >
        <div class="w-full max-w-2xl bg-base-100 h-full shadow-2xl border-l border-base-300 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
          <!-- 1. Pinned Target Banner at Top -->
          <div class="p-4 sm:p-5 bg-base-200/90 border-b border-base-300 space-y-3 shrink-0">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-black">
                  🔍
                </div>
                <div>
                  <h3 class="font-black text-base leading-tight">Inventory Match Drawer</h3>
                  <p class="text-[11px] opacity-65">
                    🛡️ Ruling out items with other <code>0EJ</code> SKUs, claimed items, &amp; cross-org items
                  </p>
                </div>
              </div>

              <!-- Row Prev / Next Navigation + Close -->
              <div class="flex items-center gap-1.5">
                <div class="join border border-base-300 rounded-lg bg-base-100">
                  <button
                    type="button"
                    class="btn btn-xs join-item btn-ghost px-2"
                    :disabled="activeMatchRowIndex <= 0"
                    @click="stepMatchDrawerRow(-1)"
                    title="Previous Row"
                  >
                    ←
                  </button>
                  <span class="join-item px-2 text-[11px] font-mono font-bold flex items-center opacity-75">
                    {{ activeMatchRowIndex + 1 }} / {{ displayedRows.length }}
                  </span>
                  <button
                    type="button"
                    class="btn btn-xs join-item btn-ghost px-2"
                    :disabled="activeMatchRowIndex < 0 || activeMatchRowIndex >= displayedRows.length - 1"
                    @click="stepMatchDrawerRow(1)"
                    title="Next Row"
                  >
                    →
                  </button>
                </div>
                <button
                  type="button"
                  class="btn btn-sm btn-circle btn-ghost"
                  @click="closeMatchDrawer"
                  title="Close Drawer"
                >
                  ✕
                </button>
              </div>
            </div>

            <!-- Incoming CSV Target Card -->
            <div class="p-3.5 rounded-2xl bg-base-100 border-2 border-primary/30 shadow-xs space-y-2">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="badge badge-sm badge-primary text-primary-content font-mono font-black">
                    Booth SKU: {{ activeMatchRow.extractedSku || 'NO SKU' }}
                  </span>
                  <span
                    class="badge badge-sm font-bold"
                    :class="activeMatchRow.status === 'sold' || activeMatchRow.status === 'paid' ? 'badge-error text-white' : 'badge-success text-success-content'"
                  >
                    {{ activeMatchRow.status === 'sold' || activeMatchRow.status === 'paid' ? 'Sold / Paid' : 'In Stock' }}
                  </span>
                  <span v-if="Number(activeMatchRow.csvQty) > 1" class="badge badge-sm badge-warning text-warning-content font-mono font-black">
                    CSV Qty: {{ activeMatchRow.csvQty }}
                  </span>
                </div>
                <div class="text-right font-mono font-black text-base text-primary">
                  CSV Price: ${{ Number(activeMatchRow.listedPrice || 0).toFixed(2) }}
                </div>
              </div>

              <!-- Full Untruncated CSV Row Title -->
              <div class="text-sm sm:text-base font-black leading-snug text-base-content break-words whitespace-normal">
                {{ activeMatchRow.itemName }}
              </div>

              <!-- Quick Action Row inside Pinned Header: Currently Linked status or + Add as New Item -->
              <div class="pt-1 flex items-center justify-between gap-2 flex-wrap border-t border-base-200">
                <div v-if="activeMatchRow.mappedItem" class="text-xs flex items-center gap-1.5 text-success font-bold">
                  <span>✓ Currently linked to:</span>
                  <span class="badge badge-xs badge-primary font-mono">{{ activeMatchRow.mappedItem.upc || 'NO UPC' }}</span>
                  <span class="font-semibold">{{ activeMatchRow.mappedItem.title }}</span>
                </div>
                <div v-else class="text-[11px] opacity-65">
                  Select a candidate below to link &amp; save to Memory Den (<code>MD</code>), or create a new item:
                </div>
                <button
                  type="button"
                  class="btn btn-xs btn-primary font-bold gap-1 shrink-0 ml-auto"
                  :disabled="activeMatchRow.isQuickAdding"
                  @click="quickAddFromDrawer(activeMatchRow)"
                >
                  <span v-if="activeMatchRow.isQuickAdding" class="loading loading-spinner loading-xs"></span>
                  <span>+ Add as New Item ({{ getRowPreviewUpc(activeMatchRow) }})</span>
                </button>
              </div>
            </div>

            <!-- Full-Width Multi-Word Search Input + Quick Filter Pills -->
            <div class="space-y-2">
              <div class="relative">
                <input
                  ref="matchDrawerSearchInput"
                  v-model="matchDrawerSearch"
                  type="text"
                  placeholder="Search unclaimed inventory by title, noun, brand, UPC, or price (e.g. 'wand', 'vampire', 'tweed', '019')..."
                  class="input input-bordered input-sm sm:input-md w-full pl-9 pr-16 text-xs sm:text-sm font-medium bg-base-100"
                />
                <span class="absolute left-3 top-1/2 -translate-y-1/2 opacity-50 text-sm">🔍</span>
                <button
                  v-if="matchDrawerSearch"
                  type="button"
                  class="btn btn-xs btn-ghost absolute right-2 top-1/2 -translate-y-1/2"
                  @click="matchDrawerSearch = ''"
                >
                  Clear
                </button>
              </div>

              <div class="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  class="btn btn-xs rounded-lg font-bold"
                  :class="matchDrawerFilter === 'suggested' && !matchDrawerSearch ? 'btn-primary text-primary-content' : 'btn-ghost bg-base-100 border border-base-300'"
                  @click="matchDrawerSearch = ''; matchDrawerFilter = 'suggested'"
                >
                  🎯 Top Suggested ({{ drawerSuggestedCandidates.length }})
                </button>
                <button
                  type="button"
                  class="btn btn-xs rounded-lg font-bold"
                  :class="matchDrawerFilter === 'same_price' ? 'btn-primary text-primary-content' : 'btn-ghost bg-base-100 border border-base-300'"
                  @click="matchDrawerFilter = 'same_price'"
                >
                  💲 Close Price (~${{ Number(activeMatchRow.listedPrice || 0).toFixed(0) }})
                </button>
                <button
                  type="button"
                  class="btn btn-xs rounded-lg font-bold"
                  :class="matchDrawerFilter === 'backstock' ? 'btn-primary text-primary-content' : 'btn-ghost bg-base-100 border border-base-300'"
                  @click="matchDrawerFilter = 'backstock'"
                >
                  📦 Backstock (HG / HH / HD)
                </button>
                <button
                  type="button"
                  class="btn btn-xs rounded-lg font-bold"
                  :class="matchDrawerFilter === 'all' ? 'btn-primary text-primary-content' : 'btn-ghost bg-base-100 border border-base-300'"
                  @click="matchDrawerFilter = 'all'"
                >
                  📋 All Unclaimed
                </button>
              </div>
            </div>
          </div>

          <!-- 2. Scrollable Rich Visual Candidate Cards -->
          <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
            <div v-if="drawerDisplayCandidates.length === 0" class="p-8 text-center bg-base-200/40 rounded-2xl border border-dashed border-base-300 space-y-3">
              <div class="text-2xl">🕵️</div>
              <div class="font-bold text-sm">
                {{ matchDrawerSearch ? `No unclaimed items matched "${matchDrawerSearch}"` : 'No close unclaimed matches suggested automatically' }}
              </div>
              <p class="text-xs opacity-65 max-w-md mx-auto">
                Items already assigned to a different <code>0EJ</code> Memory Den SKU or claimed by another CSV row are automatically ruled out. Try typing a keyword above, switching to <strong>📋 All Unclaimed</strong>, or click <strong>+ Add as New Item ({{ getRowPreviewUpc(activeMatchRow) }})</strong>.
              </p>
              <div class="flex justify-center gap-2 pt-1">
                <button
                  type="button"
                  class="btn btn-xs btn-outline"
                  @click="matchDrawerFilter = 'all'"
                >
                  📋 Browse All Unclaimed
                </button>
                <button
                  type="button"
                  class="btn btn-xs btn-primary font-bold"
                  :disabled="activeMatchRow.isQuickAdding"
                  @click="quickAddFromDrawer(activeMatchRow)"
                >
                  + Add as New Item ({{ getRowPreviewUpc(activeMatchRow) }})
                </button>
              </div>
            </div>

            <div
              v-for="cand in drawerDisplayCandidates"
              :key="cand.item.$id"
              class="p-3.5 rounded-2xl bg-base-100 hover:bg-base-200/50 border border-base-300 hover:border-primary/50 transition-all shadow-xs space-y-3"
              :class="{ 'ring-2 ring-primary bg-primary/5': activeMatchRow.mappedItem?.$id === cand.item.$id }"
            >
              <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <!-- Left: Photo Thumbnail + Full Untruncated Details -->
                <div class="flex items-start gap-3 flex-1 min-w-0">
                  <div class="w-14 h-14 rounded-xl bg-base-200 border border-base-300 overflow-hidden shrink-0 flex items-center justify-center">
                    <img
                      v-if="getItemThumbUrl(cand.item)"
                      :src="getItemThumbUrl(cand.item)"
                      :alt="cand.item.title"
                      class="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <Icon v-else icon="solar:gallery-minimalistic-linear" class="w-6 h-6 opacity-35" />
                  </div>

                  <div class="flex-1 min-w-0 space-y-1">
                    <!-- Badges Row: Confidence, UPC, Status @ Location, Lot Info, Price Comparison -->
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span
                        class="badge badge-xs font-black"
                        :class="cand.confidence >= 88 ? 'badge-success text-success-content' : 'badge-warning text-warning-content'"
                      >
                        {{ cand.confidence >= 88 ? '🟢' : '🟡' }} {{ cand.confidence }}% Match
                      </span>
                      <span
                        v-if="cand.isParentLot"
                        class="badge badge-xs badge-secondary text-secondary-content font-black"
                      >
                        📦 Parent Lot (~{{ cand.estimatedLotCount }} pcs • ${{ cand.unitCostShare.toFixed(2) }}/ea cost)
                      </span>
                      <span class="badge badge-xs font-mono font-black" :class="cand.item.upc ? 'badge-primary text-primary-content' : 'badge-ghost'">
                        {{ cand.item.upc || 'NO UPC' }}
                      </span>
                      <span class="badge badge-xs badge-outline font-mono font-bold">
                        {{ cand.item.status || 'received' }} @ {{ cand.item.storageLocation || 'HG' }}
                      </span>
                      <span v-if="Number(cand.item.quantity) > 1" class="badge badge-xs badge-warning text-warning-content font-mono font-bold">
                        Qty: {{ cand.item.quantity }}
                      </span>
                      <span
                        v-if="cand.isExactPrice"
                        class="badge badge-xs badge-success text-success-content font-black"
                      >
                        ✓ Exact ${{ Number(cand.item.resalePrice || 0).toFixed(2) }}
                      </span>
                      <span
                        v-else-if="cand.isClosePrice"
                        class="badge badge-xs badge-info text-info-content font-bold"
                      >
                        DB: ${{ Number(cand.item.resalePrice || 0).toFixed(2) }} (Δ ${{ (cand.priceDiff || 0).toFixed(2) }})
                      </span>
                      <span
                        v-else
                        class="badge badge-xs badge-ghost font-mono"
                      >
                        DB: ${{ Number(cand.item.resalePrice || 0).toFixed(2) }} • Cost: ${{ Number(cand.item.cost || 0).toFixed(2) }}
                      </span>
                    </div>

                    <!-- Full Untruncated Candidate Title -->
                    <div class="text-sm font-bold leading-snug text-base-content break-words whitespace-normal">
                      {{ cand.item.title || cand.item.identity || 'Untitled Item' }}
                    </div>

                    <!-- Match Reasons / Notes -->
                    <div v-if="cand.reasons && cand.reasons.length > 0" class="flex items-center gap-1 flex-wrap pt-0.5">
                      <span
                        v-for="(reason, rIdx) in cand.reasons"
                        :key="rIdx"
                        class="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold"
                      >
                        {{ reason }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Right: 1-Click Link & Save to MD OR Split from Lot & Link to MD -->
                <div class="flex sm:flex-col items-center sm:items-end justify-end gap-1.5 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-base-200">
                  <button
                    v-if="cand.isParentLot"
                    type="button"
                    class="btn btn-xs sm:btn-sm btn-secondary text-secondary-content font-black gap-1.5 shadow-sm w-full sm:w-auto"
                    :disabled="isSavingDrawerLink === cand.item.$id"
                    @click="splitLotPieceAndLinkToMd(activeMatchRow, cand.item, cand.estimatedLotCount, true)"
                  >
                    <span v-if="isSavingDrawerLink === cand.item.$id" class="loading loading-spinner loading-xs"></span>
                    <span v-else>✂️ Split from Lot &amp; Link to MD</span>
                  </button>
                  <button
                    type="button"
                    class="btn btn-xs sm:btn-sm font-black gap-1.5 shadow-sm w-full sm:w-auto"
                    :class="cand.isParentLot ? 'btn-outline btn-primary' : 'btn-primary text-primary-content'"
                    :disabled="isSavingDrawerLink === cand.item.$id"
                    @click="linkAndSaveCandidateToMd(cand.item)"
                  >
                    <span v-if="isSavingDrawerLink === cand.item.$id" class="loading loading-spinner loading-xs"></span>
                    <span v-else>🔗 {{ cand.isParentLot ? 'Link Whole Lot' : 'Link & Save to MD' }}</span>
                  </button>
                </div>
              </div>

              <!-- Multi-Piece Sibling Lot Checklist: When this candidate is a Parent Lot, show other unmatched booth rows matching this same Lot! -->
              <div
                v-if="cand.isParentLot && getOtherUnmatchedRowsMatchingLot(cand.item, activeMatchRow).length > 0"
                class="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-2"
              >
                <div class="flex items-center justify-between gap-2 flex-wrap">
                  <div class="text-xs font-black text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                    <span>📦 Other Unlinked Booth Items Matching This Same Parent Lot ({{ getOtherUnmatchedRowsMatchingLot(cand.item, activeMatchRow).length }})</span>
                  </div>
                  <button
                    type="button"
                    class="btn btn-xs btn-secondary text-secondary-content font-black gap-1"
                    :disabled="isSplittingLotId === cand.item.$id"
                    @click="splitMultiplePiecesFromLot(cand.item, cand.estimatedLotCount, [activeMatchRow, ...getOtherUnmatchedRowsMatchingLot(cand.item, activeMatchRow)])"
                  >
                    <span v-if="isSplittingLotId === cand.item.$id" class="loading loading-spinner loading-xs"></span>
                    <span>✂️ Split &amp; Link All {{ 1 + getOtherUnmatchedRowsMatchingLot(cand.item, activeMatchRow).length }} Pieces ($ {{ cand.unitCostShare.toFixed(2) }}/ea cost)</span>
                  </button>
                </div>
                <div class="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto pr-1">
                  <div
                    v-for="sibRow in getOtherUnmatchedRowsMatchingLot(cand.item, activeMatchRow)"
                    :key="sibRow.originalLineIndex"
                    class="flex items-center justify-between gap-2 text-xs bg-base-100/90 px-2.5 py-1.5 rounded-lg border border-base-300"
                  >
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="badge badge-xs badge-secondary font-mono font-bold shrink-0">{{ sibRow.extractedSku || 'NO SKU' }}</span>
                      <span class="font-semibold truncate">{{ sibRow.itemName }}</span>
                    </div>
                    <span class="font-mono font-bold text-primary shrink-0">${{ Number(sibRow.listedPrice || 0).toFixed(2) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. Sticky Drawer Footer -->
          <div class="p-3.5 bg-base-200/80 border-t border-base-300 flex items-center justify-between gap-2 text-xs shrink-0">
            <span class="opacity-70 font-mono">
              Showing {{ drawerDisplayCandidates.length }} unclaimed candidate{{ drawerDisplayCandidates.length === 1 ? '' : 's' }}
            </span>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="btn btn-xs sm:btn-sm btn-ghost"
                @click="closeMatchDrawer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    </div>

    <!-- ========================================================================= -->
    <!-- TOP-LEVEL RICOCHET SYNC GUIDE & BOOKMARKLET MODAL/DRAWER                  -->
    <!-- Always accessible from header whether a CSV is uploaded or not!           -->
    <!-- ========================================================================= -->
    <Teleport to="body">
      <div 
        v-if="showBrowserSyncModal" 
        class="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs transition-opacity duration-300"
        @click.self="showBrowserSyncModal = false"
      >
        <div 
          class="bg-base-100 dark:bg-base-200 border-t border-base-300 shadow-2xl rounded-t-3xl max-h-[90vh] flex flex-col w-full max-w-4xl mx-auto overflow-hidden animate-in slide-in-from-bottom duration-300"
        >
          <!-- Drag Handle Affordance -->
          <div class="pt-3 pb-1 cursor-grab flex justify-center" @click="showBrowserSyncModal = false">
            <div class="w-12 h-1.5 rounded-full bg-base-content/25 hover:bg-base-content/40 transition-colors"></div>
          </div>

          <!-- Sticky Header (Plain-English Headline + Non-Overlapping Status Badge) -->
          <div class="px-6 py-3.5 border-b border-base-200 flex items-center justify-between gap-3 flex-wrap">
            <div class="flex items-center gap-3 min-w-0">
              <div class="p-2.5 bg-warning/15 text-warning rounded-xl shrink-0">
                <span class="text-lg leading-none">🏷️</span>
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="font-black text-base sm:text-lg leading-tight">
                    Fill In Missing HUCK- Barcodes Inside Memory Den
                  </h3>
                  <span class="badge badge-sm badge-success text-success-content font-mono font-black whitespace-nowrap shrink-0">
                    {{ ricochetSyncableItems.length }} Items Ready
                  </span>
                </div>
                <p class="text-xs opacity-70 mt-0.5">
                  Automatically copies your <code>HUCK-</code>, <code>PDXGL-</code>, and <code>BB-</code> barcodes onto your <code>0EJ...</code> items on <code>memoryden.ricoconsign.com</code>
                </p>
              </div>
            </div>
            <button type="button" class="btn btn-sm btn-ghost btn-circle shrink-0" @click="showBrowserSyncModal = false">✕</button>
          </div>

          <!-- Sheet Scrollable Content -->
          <div class="overflow-y-auto p-6 space-y-5">
            <!-- 1. Plain-English Top Banner ("Why & What This Does") -->
            <div class="p-4 rounded-2xl bg-primary/10 border border-primary/25 text-xs sm:text-sm leading-relaxed text-base-content shadow-2xs">
              <p class="font-medium">
                <strong>Why this exists:</strong> Memory Den's website doesn't let you re-upload a CSV to add barcodes to existing items. Instead of typing <strong>{{ ricochetSyncableItems.length }}</strong> <code>HUCK-</code> barcodes one by one on <code>memoryden.ricoconsign.com</code>, pick <strong>Method A</strong> or <strong>Method B</strong> below to fill them in automatically while you're logged into Memory Den.
              </p>
            </div>

            <!-- 2. Two Clear Side-by-Side Plain-English Methods -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- METHOD A: Evergreen Live-Fetch Bookmarklet -->
              <div class="p-5 rounded-2xl bg-base-200/60 border-2 border-warning/50 flex flex-col justify-between shadow-sm space-y-4">
                <div class="space-y-3">
                  <div class="flex items-center justify-between gap-2 flex-wrap">
                    <div class="flex items-center gap-2 font-black text-sm text-base-content">
                      <span class="badge badge-sm badge-warning text-warning-content font-mono font-black shrink-0">Method A</span>
                      <span>1-Click Browser Bookmark</span>
                    </div>
                    <span class="badge badge-xs badge-warning/20 text-warning font-bold whitespace-nowrap shrink-0">
                      Install Once • Auto-Updates Live
                    </span>
                  </div>

                  <!-- Draggable Bookmarklet Pill Zone -->
                  <div class="p-3.5 rounded-2xl bg-base-100 border-2 border-dashed border-warning/60 text-center space-y-2">
                    <div class="text-[11px] font-bold uppercase tracking-wider text-warning flex items-center justify-center gap-1">
                      <span>⬆️ Drag this yellow button up to your Bookmarks Bar (Once Forever!)</span>
                    </div>
                    <div class="flex justify-center">
                      <a
                        :href="bookmarkletHref"
                        class="btn btn-sm sm:btn-md bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-500 font-black rounded-xl shadow-md cursor-grab active:cursor-grabbing gap-2 px-4"
                        title="Drag me once to your Chrome Bookmarks Bar — auto-updates live from Resale Command!"
                        @click.prevent="copyBookmarkletCode"
                      >
                        <span>⚡ Memory Den Sync</span>
                      </a>
                    </div>
                    <div>
                      <button
                        type="button"
                        class="text-[11px] underline opacity-75 hover:opacity-100 font-semibold cursor-pointer"
                        @click="copyBookmarkletCode"
                      >
                        📋 Or click here to copy Bookmarklet URL
                      </button>
                    </div>
                  </div>

                  <!-- 3-Step Plain-English Checklist -->
                  <div class="text-xs space-y-2 bg-base-100 p-3.5 rounded-xl border border-base-300">
                    <div class="flex items-start gap-2">
                      <span class="w-5 h-5 rounded-full bg-warning/20 text-warning-content font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <span>Drag the yellow <strong>⚡ Memory Den Sync</strong> button above up to your Chrome Bookmarks Bar once (you never need to re-drag it when new items are added!).</span>
                    </div>
                    <div class="flex items-start gap-2">
                      <span class="w-5 h-5 rounded-full bg-warning/20 text-warning-content font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <span>Switch to your open <code>memoryden.ricoconsign.com</code> tab (on the Inventory page).</span>
                    </div>
                    <div class="flex items-start gap-2">
                      <span class="w-5 h-5 rounded-full bg-warning/20 text-warning-content font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <span>Click <strong>⚡ Memory Den Sync</strong> on your Bookmarks Bar — it automatically fetches all <strong>{{ ricochetSyncableItems.length }}</strong> live barcodes from Resale Command and lets you filter by <strong>⭐ HUCK</strong>, <strong>🎲 PDXGL</strong>, or <strong>💛 B&amp;B</strong>!</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- METHOD B: Quick Copy-Paste (No Bookmark Needed) -->
              <div class="p-5 rounded-2xl bg-base-200/60 border-2 border-success/50 flex flex-col justify-between shadow-sm space-y-4">
                <div class="space-y-3">
                  <div class="flex items-center justify-between gap-2 flex-wrap">
                    <div class="flex items-center gap-2 font-black text-sm text-base-content">
                      <span class="badge badge-sm badge-success text-success-content font-mono font-black shrink-0">Method B</span>
                      <span>Quick Copy-Paste (No Bookmark Needed)</span>
                    </div>
                    <span class="badge badge-xs badge-success text-success-content font-bold whitespace-nowrap shrink-0">
                      Works Every Time
                    </span>
                  </div>

                  <!-- 4-Step Plain-English Checklist -->
                  <div class="text-xs space-y-2 bg-base-100 p-3.5 rounded-xl border border-base-300">
                    <div class="flex items-start gap-2">
                      <span class="w-5 h-5 rounded-full bg-success/20 text-success font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <span>Click <strong>🧪 Test 1 Item First</strong> (or <strong>📋 Copy All {{ ricochetSyncableItems.length }} Items</strong>) below.</span>
                    </div>
                    <div class="flex items-start gap-2">
                      <span class="w-5 h-5 rounded-full bg-success/20 text-success font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <span>Go to your open <code>memoryden.ricoconsign.com</code> tab and press <kbd class="kbd kbd-xs">F12</kbd> (then click the <strong>Console</strong> tab at the top of the panel).</span>
                    </div>
                    <div class="flex items-start gap-2">
                      <span class="w-5 h-5 rounded-full bg-success/20 text-success font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <span>Click inside the Console box, press <kbd class="kbd kbd-xs">Ctrl + V</kbd> to paste, and press <kbd class="kbd kbd-xs">Enter</kbd>. <span class="opacity-75">(Tip: If Chrome asks you to type <code>allow pasting</code> first, type <code>allow pasting</code> and hit Enter, then press Ctrl + V again.)</span></span>
                    </div>
                    <div class="flex items-start gap-2">
                      <span class="w-5 h-5 rounded-full bg-success/20 text-success font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">4</span>
                      <span>Watch the live progress counter update your Memory Den UPC barcodes automatically!</span>
                    </div>
                  </div>
                </div>

                <!-- Action Buttons Showing Exact Test Item SKU -> UPC -->
                <div class="space-y-2 pt-1">
                  <button 
                    type="button" 
                    class="btn btn-sm sm:btn-md btn-outline border-success/60 hover:bg-success/10 text-base-content font-bold gap-1.5 w-full justify-center"
                    :disabled="ricochetSyncableItems.length === 0"
                    @click="copyPreloadedConsoleScript('single')"
                    title="Safely test 1 single item first on your live Memory Den store"
                  >
                    <span>🧪 Test 1 Item First ({{ firstTestSyncItem ? `${firstTestSyncItem.sku} → ${firstTestSyncItem.upc}` : '1 Item' }})</span>
                  </button>
                  <button 
                    type="button" 
                    class="btn btn-sm sm:btn-md btn-success text-success-content font-black gap-2 shadow-md w-full justify-center"
                    :disabled="ricochetSyncableItems.length === 0"
                    @click="copyPreloadedConsoleScript('full')"
                  >
                    <span>📋 Copy All {{ ricochetSyncableItems.length }} Items</span>
                  </button>
                </div>
              </div>
            </div>

        <!-- 3. 2-Way Live Barcode Verification Scorecard -->
            <div class="p-4 rounded-2xl bg-base-200/70 border border-base-300 space-y-3 shadow-xs">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="flex items-center gap-2">
                  <span class="text-base leading-none">📊</span>
                  <div>
                    <h4 class="font-black text-xs sm:text-sm text-base-content">
                      Memory Den Barcode Verification Scorecard
                    </h4>
                    <p class="text-[11px] opacity-70">
                      <span v-if="mdVerifyReport">
                        Last verified {{ formatDate(mdVerifyReport.timestamp) }} • {{ mdVerifyReport.summary.totalCatalog }} live Memory Den items audited
                      </span>
                      <span v-else>
                        Click <strong>📡 Send Report to RC</strong> or <strong>📥 Download CSV</strong> inside the Memory Den widget to verify all ~808 booth items.
                      </span>
                    </p>
                  </div>
                </div>

                <div class="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    class="btn btn-xs btn-outline border-base-300 font-bold gap-1"
                    :disabled="isCheckingVerifyReport"
                    @click="fetchMdVerifyReport(true)"
                  >
                    <span v-if="isCheckingVerifyReport" class="loading loading-spinner loading-xs"></span>
                    <span v-else>🔄 Check for Live Report</span>
                  </button>
                  <label class="btn btn-xs btn-outline border-base-300 font-bold gap-1 cursor-pointer">
                    <span>📂 Drop/Load Verify CSV</span>
                    <input type="file" accept=".csv" class="hidden" @change="handleFileSelect" />
                  </label>
                </div>
              </div>

              <!-- 4-State Clickable Verification Pills -->
              <div v-if="mdVerifyReport" class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                <button
                  type="button"
                  class="p-2.5 rounded-xl bg-success/10 hover:bg-success/20 border border-success/30 flex flex-col justify-between text-left cursor-pointer transition-all"
                  @click="applyVerificationPillFilter('VERIFIED_MATCH')"
                >
                  <div class="text-[11px] font-bold text-success flex items-center gap-1">
                    <span>🟢 Verified in MD</span>
                  </div>
                  <div class="text-lg font-black font-mono text-success mt-0.5">
                    {{ mdVerifyReport.summary.verifiedMatch }}
                  </div>
                  <div class="text-[10px] opacity-70">Click to View</div>
                </button>

                <button
                  type="button"
                  class="p-2.5 rounded-xl bg-warning/10 hover:bg-warning/20 border border-warning/30 flex flex-col justify-between text-left cursor-pointer transition-all"
                  @click="applyVerificationPillFilter('MISSING_IN_MD')"
                >
                  <div class="text-[11px] font-bold text-warning flex items-center gap-1">
                    <span>🟡 Missing UPC in MD</span>
                  </div>
                  <div class="text-lg font-black font-mono text-warning mt-0.5">
                    {{ mdVerifyReport.summary.missingInMd }}
                  </div>
                  <div class="text-[10px] opacity-70">Click to Inspect &amp; Fix</div>
                </button>

                <button
                  type="button"
                  class="p-2.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 flex flex-col justify-between text-left cursor-pointer transition-all"
                  @click="applyVerificationPillFilter('MISMATCH_UPC')"
                >
                  <div class="text-[11px] font-bold text-orange-500 flex items-center gap-1">
                    <span>🟠 Mismatched UPC</span>
                  </div>
                  <div class="text-lg font-black font-mono text-orange-500 mt-0.5">
                    {{ mdVerifyReport.summary.mismatchUpc }}
                  </div>
                  <div class="text-[10px] opacity-70">Click to View</div>
                </button>

                <button
                  type="button"
                  class="p-2.5 rounded-xl bg-base-100 hover:bg-base-300/60 border border-base-300 flex flex-col justify-between text-left cursor-pointer transition-all"
                  @click="applyVerificationPillFilter('UNLINKED_IN_RC')"
                >
                  <div class="text-[11px] font-bold opacity-80 flex items-center gap-1">
                    <span>⚪ Unlinked in RC</span>
                  </div>
                  <div class="text-lg font-black font-mono text-base-content mt-0.5">
                    {{ mdVerifyReport.summary.unlinkedInRc }}
                  </div>
                  <div class="text-[10px] opacity-70">Click to Match In-Stock</div>
                </button>
              </div>

              <!-- 1-Click Action to Load Unlinked Items into Slide-Over Match Drawer Table -->
              <div v-if="mdVerifyReport && (mdVerifyReport.summary.unlinkedInRc > 0 || mdVerifyReport.rows?.length > 0)" class="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-base-300/70">
                <span class="text-[11px] opacity-75">
                  Want to link the <strong>{{ mdVerifyReport.summary.unlinkedInRc }}</strong> unlinked Memory Den items in the Slide-Over Match Drawer?
                </span>
                <div class="flex items-center gap-2 flex-wrap">
                  <button
                    v-if="mdVerifyReport.summary.unlinkedInRc > 0"
                    type="button"
                    class="btn btn-xs btn-primary font-bold gap-1"
                    @click="applyVerificationPillFilter('UNLINKED_IN_RC')"
                  >
                    <span>🔍 Match {{ mdVerifyReport.summary.unlinkedInRc }} Unlinked Items</span>
                  </button>
                  <button
                    type="button"
                    class="btn btn-xs btn-ghost border border-base-300 font-bold gap-1"
                    @click="applyVerificationPillFilter('ALL')"
                  >
                    <span>📋 View All {{ mdVerifyReport.summary.totalCatalog }} Report Rows</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- 4. Quiet Collapsible Advanced Developer Options Footer -->
            <details class="rounded-2xl bg-base-200/50 border border-base-300 px-4 py-2.5 text-xs">
              <summary class="cursor-pointer font-bold opacity-75 hover:opacity-100 select-none">
                ⚙️ Advanced: Raw JSON &amp; Tampermonkey Userscript
              </summary>
              <div class="pt-3 mt-2 border-t border-base-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <span class="text-[11px] opacity-70">
                  For external scripts or Tampermonkey browser extension users:
                </span>
                <div class="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    class="btn btn-xs btn-outline border-base-300 font-bold gap-1"
                    :disabled="ricochetBarcodePayloadCount === 0"
                    @click="copyRicochetBarcodeMapJson"
                  >
                    <span>📋 Copy Raw JSON ({{ ricochetBarcodePayloadCount }})</span>
                  </button>
                  <a 
                    href="/ricochet-upc-sync.user.js" 
                    target="_blank" 
                    class="btn btn-xs btn-outline border-base-300 font-bold"
                  >
                    🧩 Install Tampermonkey Userscript
                  </a>
                </div>
              </div>
            </details>
          </div>

          <!-- Sticky Footer with Thumb Clearance -->
          <div class="p-4 border-t border-base-200 bg-base-200/40 flex justify-between items-center pb-[max(1rem,env(safe-area-inset-bottom,1rem))]">
            <span class="text-xs opacity-60 font-mono">
              {{ ricochetSyncableItems.length }} barcode item{{ ricochetSyncableItems.length === 1 ? '' : 's' }} ready ({{ dbZeroEjItemsCount }} from DB<span v-if="syncRows.length > 0">, {{ matchedCount }} from CSV</span>)
            </span>
            <button type="button" class="btn btn-sm btn-ghost" @click="showBrowserSyncModal = false">Close</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useAuth } from '../../composables/useAuth';
import { useInventory } from '../../composables/useInventory';
import { useLoader } from '../../composables/useLoader';
import { addToast } from '../../stores/toast';
import { warehousesApi } from '../../lib/warehouses';
import { salesApi } from '../../lib/sales';
import { client, databases, ID } from '../../lib/appwrite';
import {
  DB_ID,
  getCollectionId,
  saveItemToInventory,
  updateInventoryItem,
  extractOrgPrefix,
  KNOWN_ORG_PREFIXES,
  normalizeOrgPrefix,
  getAssetUrl,
} from '../../lib/inventory';
import {
  getSyncHistory,
  recordSyncHistory,
  deleteSyncHistoryEntry,
  clearLocationSyncHistory,
  type SyncHistoryEntry,
} from '../../lib/syncHistory';
import {
  stripBom,
  normalizeCsvHeader,
  isSaleNumberHeader,
  isSoldDateHeader,
  flagAlreadyRecordedRows,
  canonicalTicketNumber,
  toSaleIso,
  isProductCatalogHeaders,
  cleanCatalogSku,
  parseCsvRfc4180Rows,
  MD_CANONICAL_WAREHOUSE_ID,
  PREVERIFIED_MD_SINGLE_UPC_BY_SKU,
  PREVERIFIED_MD_MULTI_QTY_BINS,
  PREVERIFIED_MD_SKU_TO_UPC_OR_ID,
  isBbConsignorRow,
  resolveMdUnitCostBasis,
  resolveMemoryDenSkuFromPayoutRow,
  buildLockedMultiBinMap,
  matchMemoryDenInventoryItem,
  getUnclaimedMatchCandidatesForRow,
  getPrimaryItemImageId,
  isParentLotCandidate,
  extractEstimatedLotPieceCount,
  type UnclaimedMatchCandidateResult,
} from '../../lib/salesBucketing';

// =========================================================================
// 1. ALL COMPOSABLES & REACTIVE REFS (Strictly at top to prevent TDZ errors)
// =========================================================================
const { user, currentTeam: team } = useAuth();
const { inventoryItems, fetchInventory, getNextUpc } = useInventory();
const { showLoader, hideLoader } = useLoader();

const showBrowserSyncModal = ref(false);
const mdVerifyReport = ref<any | null>(null);
const isCheckingVerifyReport = ref(false);
const verifyStatusFilter = ref<'ALL' | 'VERIFIED_MATCH' | 'MISSING_IN_MD' | 'MISMATCH_UPC' | 'UNLINKED_IN_RC'>('ALL');
const confidenceTierFilter = ref<'ALL' | 'HIGH' | 'LOT_SPLIT' | 'REVIEW' | 'NEW_ITEM'>('ALL');
const isBatchApproving = ref(false);
const isSplittingLotId = ref<string | null>(null);

const isDragging = ref(false);
const isParsing = ref(false);
const isCommitting = ref(false);
const isBulkQuickAdding = ref(false);
const isAiMatching = ref(false);
const aiMatchingProgressText = ref('');
const bulkProgressMessage = ref('');
const filterTab = ref<'unmatched-sold' | 'unmatched-instock' | 'unmatched' | 'matched' | 'sold' | 'instock' | 'all'>('unmatched-sold');
const searchQuery = ref('');
const exportUpdatedCsv = ref(true);

const upcPrefix = ref<string>(team.value?.prefs?.upcPrefix || 'HUCK-');
const onlySyncOrgPrefix = ref<boolean>(false);
const skippedNonOrgCount = ref<number>(0);
const selectedOrgBucket = ref<string>('all'); // 'all' | 'primary' | 'partner' | 'unassigned'

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
  monthlyRent: 0,
});

const locations = ref<any[]>([]);
const selectedLocationId = ref<string>('');
const syncRows = ref<any[]>([]);
// Ricochet Product Catalog export (Products-*.csv): items-only sync, NEVER creates sales
const isCatalogExport = ref(false);
const rawCsvHeader = ref<string>('');
const rawCsvLines = ref<string[]>([]);

const detectedRentDeductions = ref<{ title: string; amount: number; date: string }[]>([]);
const isLoggingRent = ref<boolean>(false);

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
  cancelText: 'Cancel',
});
let confirmResolve: ((val: boolean) => void) | null = null;

// Slide-Over Inventory Match Drawer Refs
const isMatchDrawerOpen = ref(false);
const activeMatchRow = ref<any | null>(null);
const matchDrawerSearch = ref('');
const matchDrawerFilter = ref<'suggested' | 'all' | 'same_price' | 'backstock'>('suggested');
const isSavingDrawerLink = ref<string | null>(null);
const matchDrawerSearchInput = ref<HTMLInputElement | null>(null);

// =========================================================================
// 2. PURE HELPER FUNCTIONS (Used by computed properties & actions)
// =========================================================================
const BOARD_OR_CARD_GAME_REGEX = /\b(board\s*game|card\s*game|deck\s*building|expansion|dice\s*game)\b/i;
const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'for', 'in', 'on', 'at', 'to', 'with', 'by', 'from', 'is', 'it', 'as', 'game', 'sc', 'aeg']);

function isRealProductionUpc(upc: any): boolean {
  const u = cleanCatalogSku(upc).toUpperCase();
  if (!u || !/^(HUCK-|PDXGL-|BB-)/i.test(u)) return false;
  if (/test|demo/i.test(u)) return false;
  return true;
}

function cleanSkuAndUpcValid(sku: string, upc: any): boolean {
  return Boolean(sku && isRealProductionUpc(upc));
}

function claimedItemIdsForRow(targetRow?: any): Set<string> {
  const set = new Set<string>();
  for (const r of syncRows.value || []) {
    if (r === targetRow) continue;
    if (r.mappedItem && r.mappedItem.$id) {
      set.add(r.mappedItem.$id);
    }
  }
  return set;
}

function getTopStagedCandidateForRow(row: any): UnclaimedMatchCandidateResult | null {
  if (!row || row.mappedItem) return null;
  if (row.stagedCandidate && row.stagedCandidate.item) {
    return row.stagedCandidate as UnclaimedMatchCandidateResult;
  }
  if (row.aiEvaluated) {
    return null;
  }
  const allItems = Array.isArray(inventoryItems.value) ? inventoryItems.value : [];
  if (allItems.length === 0) return null;
  const isRowInStock = row.status !== 'sold' && row.status !== 'paid';
  const cands = getUnclaimedMatchCandidatesForRow({
    rowSku: row.extractedSku,
    rowTitle: row.itemName,
    rowPrice: Number(row.listedPrice || 0),
    rowIsInStock: isRowInStock,
    rowIsBb: Boolean(row.isBbRow),
    searchQuery: '',
    filterMode: 'suggested',
    allItems,
    claimedItemIds: claimedItemIdsForRow(row),
    limit: 1,
  });
  return cands[0] || null;
}

function mergeStagedCandidateAtTop(
  row: any,
  list: UnclaimedMatchCandidateResult[]
): UnclaimedMatchCandidateResult[] {
  const staged = row?.stagedCandidate;
  if (!staged || !staged.item || !staged.item.$id) return list;
  const filtered = list.filter((c) => c.item?.$id !== staged.item.$id);
  return [staged, ...filtered];
}

// =========================================================================
// 3. COMPUTED PROPERTIES (Strict topological order — never references below)
// =========================================================================
const availableOrgPrefixes = computed(() => {
  const list: Array<{ prefix: string; label: string; orgKey: string; name: string }> = [];
  const teamPref = team.value?.prefs?.upcPrefix || user.value?.prefs?.upcPrefix || 'HUCK-';
  const primary = normalizeOrgPrefix(teamPref);
  list.push({ prefix: primary, label: primary, orgKey: primary.replace(/[-_]$/, ''), name: 'Primary Org' });

  const partners = team.value?.prefs?.partnerPrefixes || user.value?.prefs?.partnerPrefixes || [
    { prefix: 'PDXGL-', name: 'PDX Game Library' },
  ];
  partners.forEach((p: any) => {
    const pStr = normalizeOrgPrefix(typeof p === 'string' ? p : p.prefix);
    const pName = typeof p === 'string' ? `${pStr.replace(/[-_]$/, '')} Partner` : (p.name || 'Partner');
    if (!list.some((item) => item.prefix === pStr)) {
      list.push({
        prefix: pStr,
        label: pStr,
        orgKey: pStr.replace(/[-_]$/, ''),
        name: pName,
      });
    }
  });
  return list;
});

const primaryOrgKey = computed(() => {
  return (upcPrefix.value || 'HUCK-').replace(/[-_]$/, '').toUpperCase();
});

const primaryBucketCount = computed(() => {
  const p = primaryOrgKey.value;
  return (syncRows.value || []).filter((r) => (r.orgBucket || '').toUpperCase() === p).length;
});

const partnerBucketCount = computed(() => {
  const p = primaryOrgKey.value;
  return (syncRows.value || []).filter((r) => {
    const b = (r.orgBucket || '').toUpperCase();
    return b !== p && b !== 'UNASSIGNED';
  }).length;
});

const unassignedBucketCount = computed(() => {
  return (syncRows.value || []).filter((r) => (r.orgBucket || '').toUpperCase() === 'UNASSIGNED').length;
});

const totalRentDetected = computed(() => {
  return (detectedRentDeductions.value || []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
});

const currentLocation = computed(() => {
  return (locations.value || []).find((l) => l.$id === selectedLocationId.value) || null;
});

const locationHistory = computed(() => {
  if (!selectedLocationId.value && !currentLocation.value) return [];
  const locName = (currentLocation.value?.name || '').toLowerCase();
  return (syncHistoryList.value || []).filter(
    (h) =>
      h.locationId === selectedLocationId.value ||
      (locName && h.locationName.toLowerCase() === locName)
  );
});

const inStockCount = computed(() => (syncRows.value || []).filter((r) => r.status !== 'sold' && r.status !== 'paid').length);
const soldCount = computed(() => (syncRows.value || []).filter((r) => r.status === 'sold' || r.status === 'paid').length);
const matchedCount = computed(() => (syncRows.value || []).filter((r) => r.mappedItem !== null).length);
const unmatchedCount = computed(() => (syncRows.value || []).filter((r) => r.mappedItem === null).length);

const unmatchedSoldCount = computed(() => {
  const rows = syncRows.value || [];
  const base = verifyStatusFilter.value !== 'ALL'
    ? rows.filter((r) => r.verifyStatus === verifyStatusFilter.value)
    : rows;
  return base.filter((r) => (r.status === 'sold' || r.status === 'paid') && r.mappedItem === null).length;
});

const unmatchedInStockCount = computed(() => {
  const rows = syncRows.value || [];
  const base = verifyStatusFilter.value !== 'ALL'
    ? rows.filter((r) => r.verifyStatus === verifyStatusFilter.value)
    : rows;
  return base.filter((r) => r.status !== 'sold' && r.status !== 'paid' && r.mappedItem === null).length;
});

const nextPreviewUpc = computed(() => {
  const p = upcPrefix.value?.trim() || 'HUCK-';
  return getNextUpc ? getNextUpc(p) : `${p}0001`;
});

const totalInStockGross = computed(() => {
  return (syncRows.value || [])
    .filter((r) => r.status !== 'sold' && r.status !== 'paid')
    .reduce((acc, r) => acc + (r.listedPrice || 0), 0);
});

const totalSoldGross = computed(() => {
  return (syncRows.value || [])
    .filter((r) => r.status === 'sold' || r.status === 'paid')
    .reduce((acc, r) => acc + (r.listedPrice || r.netSoldPrice || 0), 0);
});

const totalSoldNet = computed(() => {
  return (syncRows.value || [])
    .filter((r) => r.status === 'sold' || r.status === 'paid')
    .reduce((acc, r) => acc + (r.netSoldPrice || 0), 0);
});

const highConfidenceUnmatchedRows = computed(() => {
  return (syncRows.value || []).filter((r) => {
    if (r.mappedItem) return false;
    const top = getTopStagedCandidateForRow(r);
    return Boolean(top && top.confidence >= 88);
  });
});

const lotSplitUnmatchedRows = computed(() => {
  return (syncRows.value || []).filter((r) => {
    if (r.mappedItem) return false;
    const top = getTopStagedCandidateForRow(r);
    return Boolean(top && (top.isParentLot || top.recommendedAction === 'split_lot'));
  });
});

const reviewUnmatchedRows = computed(() => {
  return (syncRows.value || []).filter((r) => {
    if (r.mappedItem) return false;
    const top = getTopStagedCandidateForRow(r);
    return Boolean(top && top.confidence < 88);
  });
});

const newBoothUnmatchedRows = computed(() => {
  return (syncRows.value || []).filter((r) => {
    if (r.mappedItem) return false;
    const top = getTopStagedCandidateForRow(r);
    return !top;
  });
});

const selectedHighConfidenceRows = computed(() => {
  return (syncRows.value || []).filter((r) => !r.mappedItem && r.selectedForApproval && getTopStagedCandidateForRow(r));
});

const displayedRows = computed(() => {
  let rows = syncRows.value || [];

  if (verifyStatusFilter.value !== 'ALL') {
    rows = rows.filter((r) => r.verifyStatus === verifyStatusFilter.value);
  }

  if (confidenceTierFilter.value !== 'ALL') {
    rows = rows.filter((r) => {
      if (r.mappedItem) return false;
      const top = getTopStagedCandidateForRow(r);
      if (confidenceTierFilter.value === 'HIGH') return Boolean(top && top.confidence >= 88);
      if (confidenceTierFilter.value === 'LOT_SPLIT') return Boolean(top && (top.isParentLot || top.recommendedAction === 'split_lot'));
      if (confidenceTierFilter.value === 'REVIEW') return Boolean(top && top.confidence < 88);
      if (confidenceTierFilter.value === 'NEW_ITEM') return !top;
      return true;
    });
  }

  if (selectedOrgBucket.value === 'primary') {
    const p = primaryOrgKey.value;
    rows = rows.filter((r) => (r.orgBucket || '').toUpperCase() === p);
  } else if (selectedOrgBucket.value === 'partner') {
    const p = primaryOrgKey.value;
    rows = rows.filter((r) => {
      const b = (r.orgBucket || '').toUpperCase();
      return b !== p && b !== 'UNASSIGNED';
    });
  } else if (selectedOrgBucket.value === 'unassigned') {
    rows = rows.filter((r) => (r.orgBucket || '').toUpperCase() === 'UNASSIGNED');
  }

  if (filterTab.value === 'unmatched-sold') rows = rows.filter((r) => (r.status === 'sold' || r.status === 'paid') && r.mappedItem === null);
  else if (filterTab.value === 'unmatched-instock') rows = rows.filter((r) => r.status !== 'sold' && r.status !== 'paid' && r.mappedItem === null);
  else if (filterTab.value === 'matched') rows = rows.filter((r) => r.mappedItem !== null);
  else if (filterTab.value === 'unmatched') rows = rows.filter((r) => r.mappedItem === null);
  else if (filterTab.value === 'instock') rows = rows.filter((r) => r.status !== 'sold' && r.status !== 'paid');
  else if (filterTab.value === 'sold') rows = rows.filter((r) => r.status === 'sold' || r.status === 'paid');

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    rows = rows.filter((r) =>
      (r.itemName || '').toLowerCase().includes(q) ||
      (r.extractedSku && r.extractedSku.toLowerCase().includes(q)) ||
      (r.listedPrice && r.listedPrice.toString().includes(q)) ||
      (r.netSoldPrice && r.netSoldPrice.toString().includes(q)) ||
      (r.mappedItem && r.mappedItem.title && r.mappedItem.title.toLowerCase().includes(q)) ||
      (r.mappedItem && r.mappedItem.upc && r.mappedItem.upc.toLowerCase().includes(q))
    );
  }

  return rows;
});

const activeMatchRowIndex = computed(() => {
  if (!activeMatchRow.value) return -1;
  return displayedRows.value.indexOf(activeMatchRow.value);
});

const targetAiUnmappedRows = computed(() => {
  const inView = (displayedRows.value || []).filter((r) => r.mappedItem === null);
  if (inView.length > 0) return inView;
  return (syncRows.value || []).filter((r) => r.mappedItem === null);
});

const drawerSuggestedCandidates = computed(() => {
  const row = activeMatchRow.value;
  if (!row || !inventoryItems.value) return [];
  const isRowInStock = row.status !== 'sold' && row.status !== 'paid';
  const base = getUnclaimedMatchCandidatesForRow({
    rowSku: row.extractedSku,
    rowTitle: row.itemName,
    rowPrice: Number(row.listedPrice || 0),
    rowIsInStock: isRowInStock,
    rowIsBb: Boolean(row.isBbRow),
    searchQuery: '',
    filterMode: 'suggested',
    allItems: inventoryItems.value,
    claimedItemIds: claimedItemIdsForRow(row),
    limit: 8,
  });
  return mergeStagedCandidateAtTop(row, base);
});

const drawerDisplayCandidates = computed(() => {
  const row = activeMatchRow.value;
  if (!row || !inventoryItems.value) return [];
  const isRowInStock = row.status !== 'sold' && row.status !== 'paid';
  const query = matchDrawerSearch.value.trim();
  const effectiveFilter = query ? 'all' : matchDrawerFilter.value;

  const base = getUnclaimedMatchCandidatesForRow({
    rowSku: row.extractedSku,
    rowTitle: row.itemName,
    rowPrice: Number(row.listedPrice || 0),
    rowIsInStock: isRowInStock,
    rowIsBb: Boolean(row.isBbRow),
    searchQuery: query,
    filterMode: effectiveFilter,
    allItems: inventoryItems.value,
    claimedItemIds: claimedItemIdsForRow(row),
    limit: query || effectiveFilter !== 'suggested' ? 40 : 8,
  });
  return !query && effectiveFilter === 'suggested' ? mergeStagedCandidateAtTop(row, base) : base;
});

// Direct DB + Preverified + Report syncable items (`0EJ...` -> `HUCK-XXXX` / `PDXGL-` / `BB-`) so all ~714 matched items are ALWAYS included!
const dbZeroEjItems = computed(() => {
  const list: Array<{ id: string; sku: string; upc: string; title: string }> = [];
  const seenSkus = new Set<string>();
  const usedUpcs = new Set<string>();
  const activeItems = Array.isArray(inventoryItems.value) ? inventoryItems.value : [];
  const byId = new Map<string, any>();
  for (const item of activeItems) {
    if (item?.$id) byId.set(item.$id, item);
  }

  for (const item of activeItems) {
    const sku = cleanCatalogSku(item?.locationSku || item?.sku).toUpperCase();
    const upc = cleanCatalogSku(item?.upc).toUpperCase();
    if (!sku || !/^0EJ/i.test(sku) || !isRealProductionUpc(upc)) continue;
    if (seenSkus.has(sku) || usedUpcs.has(upc)) continue;
    seenSkus.add(sku);
    usedUpcs.add(upc);
    list.push({
      id: '',
      sku,
      upc,
      title: String(item?.title || item?.identity || ''),
    });
  }

  for (const [skuKey, mappedUpcOrId] of Object.entries(PREVERIFIED_MD_SKU_TO_UPC_OR_ID)) {
    const sku = cleanCatalogSku(skuKey).toUpperCase();
    if (!sku || seenSkus.has(sku)) continue;
    let resolvedUpc = cleanCatalogSku(mappedUpcOrId).toUpperCase();
    let resolvedTitle = '';
    if (!/^(HUCK-|PDXGL-|BB-)/i.test(resolvedUpc)) {
      const dbMatch = byId.get(String(mappedUpcOrId).trim());
      if (dbMatch?.upc) {
        resolvedUpc = cleanCatalogSku(dbMatch.upc).toUpperCase();
        resolvedTitle = String(dbMatch.title || dbMatch.identity || '');
      } else {
        continue;
      }
    }
    if (!isRealProductionUpc(resolvedUpc) || usedUpcs.has(resolvedUpc)) continue;
    seenSkus.add(sku);
    usedUpcs.add(resolvedUpc);
    list.push({ id: '', sku, upc: resolvedUpc, title: resolvedTitle });
  }

  return list;
});

const dbZeroEjItemsCount = computed(() => dbZeroEjItems.value.length);

const ricochetSyncableItems = computed(() => {
  const mapBySkuOrKey = new Map<string, { id: string; sku: string; upc: string; title: string }>();
  const usedUpcs = new Set<string>();
  const currentRows = Array.isArray(syncRows.value) ? syncRows.value : [];

  // 1. If a CSV or Verification Report is loaded in syncRows, include all matched rows first (all 714+ matched items!)
  for (const r of currentRows) {
    const upc = cleanCatalogSku(r.mappedItem?.upc || r.extractedUpc || r.expectedRcUpc).toUpperCase();
    if (!isRealProductionUpc(upc) || usedUpcs.has(upc)) continue;
    const sku = cleanCatalogSku(r.extractedSku || r.mappedItem?.locationSku).toUpperCase();
    const key = sku || r.productId || r.mappedItem?.$id || r.itemName;
    if (!key || mapBySkuOrKey.has(key)) continue;
    usedUpcs.add(upc);
    mapBySkuOrKey.set(key, {
      id: r.productId || '',
      sku,
      upc,
      title: r.mappedItem?.title || r.itemName || '',
    });
  }

  // 2. If mdVerifyReport is loaded (even before clicking Load All 808 Items), match its rows against inventoryItems so all 714 items are in the payload!
  if (currentRows.length === 0 && mdVerifyReport.value && Array.isArray(mdVerifyReport.value.rows)) {
    const activeItems = Array.isArray(inventoryItems.value) ? inventoryItems.value : [];
    const claimedItemIdToSku = new Map<string, string>();
    const multiBinResolvedBySku = buildLockedMultiBinMap(activeItems, claimedItemIdToSku);
    for (const r of mdVerifyReport.value.rows) {
      const sku = cleanCatalogSku(r.sku).toUpperCase();
      if (!sku || mapBySkuOrKey.has(sku)) continue;
      const matched = matchMemoryDenInventoryItem({
        sku,
        upc: cleanCatalogSku(r.upc || r.expectedRcUpc),
        title: String(r.name || ''),
        price: Number(r.agreedPrice || 0),
        extraText: '',
        allowPrefixForPayout: false,
        activeItems,
        claimedItemIdToSku,
        multiBinResolvedBySku,
      });
      const matchedUpc = cleanCatalogSku(matched?.upc || r.expectedRcUpc || r.upc).toUpperCase();
      if (cleanSkuAndUpcValid(sku, matchedUpc) && !usedUpcs.has(matchedUpc)) {
        if (matched?.$id && !claimedItemIdToSku.has(matched.$id)) claimedItemIdToSku.set(matched.$id, sku);
        usedUpcs.add(matchedUpc);
        mapBySkuOrKey.set(sku, {
          id: String(r.productId || ''),
          sku,
          upc: matchedUpc,
          title: String(matched?.title || r.name || ''),
        });
      }
    }
  }

  // 3. Always include all DB items that have both a `0EJ...` locationSku and a unique `upc`
  for (const dbEntry of dbZeroEjItems.value) {
    if (!mapBySkuOrKey.has(dbEntry.sku) && !usedUpcs.has(dbEntry.upc)) {
      usedUpcs.add(dbEntry.upc);
      mapBySkuOrKey.set(dbEntry.sku, dbEntry);
    }
  }

  return Array.from(mapBySkuOrKey.values());
});

const firstTestSyncItem = computed(() => ricochetSyncableItems.value[0] || null);

const ricochetBarcodePayloadMap = computed(() => {
  const out: Record<string, string> = {};
  const usedUpcs = new Set<string>();
  for (const entry of ricochetSyncableItems.value) {
    if (entry.sku && entry.upc && isRealProductionUpc(entry.upc) && !usedUpcs.has(entry.upc)) {
      usedUpcs.add(entry.upc);
      out[entry.sku] = entry.upc;
    }
  }
  return out;
});

const ricochetSkuMetaMap = computed(() => {
  const out: Record<string, { upc: string; partner: 'HUCK' | 'PDXGL' | 'BB'; title: string }> = {};
  for (const entry of ricochetSyncableItems.value) {
    if (!entry.sku || !entry.upc) continue;
    const u = entry.upc.toUpperCase();
    const partner: 'HUCK' | 'PDXGL' | 'BB' = u.startsWith('BB-') ? 'BB' : u.startsWith('PDXGL-') ? 'PDXGL' : 'HUCK';
    out[entry.sku] = {
      upc: entry.upc,
      partner,
      title: entry.title || '',
    };
  }
  return out;
});

const ricochetBarcodePayloadCount = computed(() => Object.keys(ricochetBarcodePayloadMap.value).length);

// Permanent Live-Loader Bookmarklet (`⚡ Memory Den Sync`) — Zero baked-in snapshot, 100% live script + live cloud fetch on every open!
const bookmarkletHref = computed(() => {
  const origin =
    typeof window !== 'undefined' && window.location?.origin && !window.location.origin.includes('localhost')
      ? window.location.origin
      : 'https://resalecmd.com';
  return `javascript:(function(){delete window.__RC_PRELOADED_BARCODES__;var s=document.createElement('script');s.src='${origin}/ricochet-upc-sync.user.js?v='+Date.now();document.body.appendChild(s);})();`;
});

// =========================================================================
// 4. METHODS, WATCHERS & LIFECYCLE (All refs & computeds are now initialized)
// =========================================================================
const syncLivePayloadToCloudEndpoint = async () => {
  const map = ricochetBarcodePayloadMap.value;
  if (!map || Object.keys(map).length === 0) return;
  try {
    await fetch('/api/md-verify-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'payload',
        skuToUpcMap: map,
        skuToMetaMap: ricochetSkuMetaMap.value,
      }),
    });
  } catch (e) {
    // Non-blocking background cache sync
  }
};

const fetchMdVerifyReport = async (showManualToast = false) => {
  isCheckingVerifyReport.value = true;
  try {
    let loadedReport: any = null;
    try {
      const res = await fetch(`/api/md-verify-report?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.hasReport && data?.report) {
          loadedReport = data.report;
        }
      }
    } catch {}

    // Direct Appwrite fallback in case serverless memory is cold
    if (!loadedReport) {
      try {
        const doc: any = await databases.getDocument(DB_ID, 'manifests', 'md_verify_report_latest');
        if (doc?.itemsSnapshot) {
          const parsed = typeof doc.itemsSnapshot === 'string' ? JSON.parse(doc.itemsSnapshot) : doc.itemsSnapshot;
          if (parsed && parsed.summary && Array.isArray(parsed.rows)) {
            loadedReport = parsed;
          }
        }
      } catch {}
    }

    if (loadedReport) {
      const isNewer = !mdVerifyReport.value || mdVerifyReport.value.timestamp !== loadedReport.timestamp;
      mdVerifyReport.value = loadedReport;
      if (showManualToast || isNewer) {
        addToast({
          type: 'success',
          message: `📊 Loaded Memory Den Verification Report: ${loadedReport.summary.verifiedMatch} Verified, ${loadedReport.summary.missingInMd} Missing, ${loadedReport.summary.unlinkedInRc} Unlinked!`,
        });
      }
    } else if (showManualToast) {
      addToast({
        type: 'info',
        message: 'No live report received yet. Click "📡 Send Report to RC" or "📥 Download CSV" inside the Memory Den widget!',
      });
    }
  } catch (e) {
    if (showManualToast) {
      addToast({ type: 'warning', message: 'Could not check live report endpoint.' });
    }
  } finally {
    isCheckingVerifyReport.value = false;
  }
};

watch(showBrowserSyncModal, (isOpen) => {
  if (isOpen) {
    void fetchMdVerifyReport(false);
    void syncLivePayloadToCloudEndpoint();
  }
});

watch(ricochetBarcodePayloadCount, (newCount) => {
  if (newCount > 0) {
    void syncLivePayloadToCloudEndpoint();
  }
});

watch(() => team.value?.prefs?.upcPrefix, (newPref) => {
  if (newPref) upcPrefix.value = normalizeOrgPrefix(newPref);
}, { immediate: true });

const loadVerifyReportIntoWorkspace = (mode: 'unlinked' | 'all' = 'all') => {
  if (!mdVerifyReport.value || !Array.isArray(mdVerifyReport.value.rows)) return;
  const sourceRows = mdVerifyReport.value.rows;

  if (sourceRows.length === 0) {
    addToast({ type: 'info', message: 'No rows found in the verification report.' });
    return;
  }

  const esc = (val: any) => `"${String(val ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
  const header = `"Product ID",SKU,UPC,Expected_RC_UPC,Verify_Status,Partner,Conflict_Reason,Name,"Agreed Price",Quantity,Inventory`;
  const csvLines = [header];
  for (const r of sourceRows) {
    const rawQty = r.quantity !== undefined && r.quantity !== null ? Number(r.quantity) : 1;
    const invStr = r.inventory || (rawQty > 0 ? 'In Stock' : 'Sold');
    csvLines.push(
      [
        esc(r.productId),
        esc(r.sku),
        esc(r.upc),
        esc(r.expectedRcUpc),
        esc(r.verifyStatus),
        esc(r.partner || ''),
        esc(r.conflictReason || ''),
        esc(r.name),
        esc(Number(r.agreedPrice || 0).toFixed(2)),
        esc(rawQty),
        esc(invStr),
      ].join(',')
    );
  }

  showBrowserSyncModal.value = false;
  parseCsvData(csvLines.join('\n'), 'MD-Barcode-Verification-Report.csv');

  if (mode === 'unlinked') {
    verifyStatusFilter.value = 'UNLINKED_IN_RC';
    const hasInStockUnlinked = (syncRows.value || []).some(
      (r) => r.verifyStatus === 'UNLINKED_IN_RC' && r.status !== 'sold' && r.status !== 'paid' && !r.mappedItem
    );
    filterTab.value = hasInStockUnlinked ? 'unmatched-instock' : 'unmatched';
  } else {
    verifyStatusFilter.value = 'ALL';
    filterTab.value = 'all';
  }
};

const applyVerificationPillFilter = (
  targetStatus: 'ALL' | 'VERIFIED_MATCH' | 'MISSING_IN_MD' | 'MISMATCH_UPC' | 'UNLINKED_IN_RC'
) => {
  showBrowserSyncModal.value = false;
  const hasLoadedVerifyRows = (syncRows.value || []).length > 0 && (syncRows.value || []).some((r) => Boolean(r.verifyStatus));
  if (!hasLoadedVerifyRows && mdVerifyReport.value?.rows?.length) {
    loadVerifyReportIntoWorkspace('all');
  }

  verifyStatusFilter.value = targetStatus;
  searchQuery.value = '';
  selectedOrgBucket.value = 'all';

  if (targetStatus === 'UNLINKED_IN_RC') {
    const hasInStockUnlinked = (syncRows.value || []).some(
      (r) => r.verifyStatus === 'UNLINKED_IN_RC' && r.status !== 'sold' && r.status !== 'paid' && !r.mappedItem
    );
    filterTab.value = hasInStockUnlinked ? 'unmatched-instock' : 'all';
  } else {
    filterTab.value = 'all';
  }
};

const isBoardOrCardGameRow = (row: any): boolean => {
  if (!row) return false;
  const text = `${row.itemName || ''} ${row.extraText || ''}`;
  return BOARD_OR_CARD_GAME_REGEX.test(text);
};

const toggleRowPdxglPrefix = (row: any) => {
  if (!row) return;
  if (row.customPrefix === 'PDXGL-') {
    row.customPrefix = '';
    row.orgBucket = primaryOrgKey.value;
    addToast({ type: 'info', message: `Switched "${row.itemName}" back to ${upcPrefix.value || 'HUCK-'}` });
  } else {
    row.customPrefix = 'PDXGL-';
    row.orgBucket = 'PDXGL';
    addToast({ type: 'success', message: `🎲 Switched "${row.itemName}" to PDXGL- partner barcode!` });
  }
};

const getRowEffectivePrefix = (row: any): string => {
  if (row?.isBbRow || String(row?.orgBucket || '').toUpperCase() === 'BB') {
    return 'BB-';
  }
  if (row?.customPrefix) {
    const cp = String(row.customPrefix).trim().toUpperCase();
    return cp.endsWith('-') || cp.endsWith('_') ? cp : `${cp}-`;
  }
  if (String(row?.orgBucket || '').toUpperCase() === 'PDXGL') {
    return 'PDXGL-';
  }
  let p = upcPrefix.value?.trim() || 'HUCK-';
  if (!p.endsWith('-') && !p.endsWith('_')) p = `${p}-`;
  return p;
};

const getRowPreviewUpc = (row: any): string => {
  if (!row) return nextPreviewUpc.value;
  if (row.isBbRow || String(row.orgBucket || '').toUpperCase() === 'BB') {
    const cleanSku = cleanCatalogSku(row.extractedSku).toUpperCase();
    return cleanSku ? `BB-${cleanSku}` : (getNextUpc ? getNextUpc('BB-') : 'BB-0001');
  }
  const effPrefix = getRowEffectivePrefix(row);
  return getNextUpc ? getNextUpc(effPrefix) : `${effPrefix}0001`;
};

const getRowConflictReason = (row: any): string => {
  if (!row) return '';
  if (row.conflictReason) return String(row.conflictReason);
  const cleanSku = cleanCatalogSku(row.extractedSku).toUpperCase();
  const targetUpc = cleanCatalogSku(row.mappedItem?.upc || row.expectedRcUpc || row.extractedUpc).toUpperCase();
  if (!cleanSku || !targetUpc) {
    return `⚠️ Shared/rejected UPC in Memory Den (${targetUpc || 'NO UPC'})`;
  }
  const otherRow = (syncRows.value || []).find((r) => {
    const rSku = cleanCatalogSku(r.extractedSku).toUpperCase();
    const rUpc = cleanCatalogSku(r.mappedItem?.upc || r.extractedUpc || r.expectedRcUpc).toUpperCase();
    return rSku && rSku !== cleanSku && rUpc === targetUpc;
  });
  if (otherRow) {
    return `⚠️ ${cleanSku}: ${targetUpc} is already used on ${cleanCatalogSku(otherRow.extractedSku).toUpperCase()}`;
  }
  const otherDb = (inventoryItems.value || []).find((i: any) => {
    const iSku = cleanCatalogSku(i?.locationSku || i?.sku).toUpperCase();
    const iUpc = cleanCatalogSku(i?.upc).toUpperCase();
    return iSku && /^0EJ/i.test(iSku) && iSku !== cleanSku && iUpc === targetUpc;
  });
  if (otherDb) {
    return `⚠️ ${cleanSku}: ${targetUpc} is already used on ${cleanCatalogSku(otherDb.locationSku || otherDb.sku).toUpperCase()}`;
  }
  return `⚠️ ${cleanSku}: ${targetUpc} was rejected by Memory Den (shared/duplicate barcode)`;
};

const assignUniqueUpcToRow = async (row: any) => {
  if (!row || row.isAssigningUniqueUpc || row.uniqueBarcodeAssigned) return;
  row.isAssigningUniqueUpc = true;
  const prefix = getRowEffectivePrefix(row);
  const newUpc = getNextUpc ? getNextUpc(prefix) : `${prefix}${Math.floor(1000 + Math.random() * 9000)}`;
  const cleanSku = cleanCatalogSku(row.extractedSku).toUpperCase();

  try {
    // 1. Clear conflicting locationSku from any OTHER item in inventoryItems that still claims cleanSku
    if (cleanSku) {
      const staleSameSkuItems = (inventoryItems.value || []).filter((i: any) => {
        const iSku = cleanCatalogSku(i?.locationSku || i?.sku).toUpperCase();
        return i?.$id && iSku === cleanSku && i.$id !== row.mappedItem?.$id;
      });
      for (const staleItem of staleSameSkuItems) {
        try {
          await updateInventoryItem(staleItem.$id, { locationSku: '' });
          staleItem.locationSku = '';
        } catch (clearErr) {
          console.warn('Could not clear stale locationSku on', staleItem.$id, clearErr);
        }
      }
    }

    const mapped = row.mappedItem;
    const mappedExistingSku = cleanCatalogSku(mapped?.locationSku || mapped?.sku).toUpperCase();
    const isSharedWithOtherRow = Boolean(
      mapped?.$id &&
        (syncRows.value || []).some((r) => {
          const rSku = cleanCatalogSku(r.extractedSku).toUpperCase();
          return r !== row && rSku && rSku !== cleanSku && r.mappedItem?.$id === mapped.$id;
        })
    );
    const belongsToOtherZeroEjSku = Boolean(
      cleanSku && mappedExistingSku && /^0EJ/i.test(mappedExistingSku) && mappedExistingSku !== cleanSku
    );

    if (
      mapped &&
      mapped.$id &&
      !String(mapped.$id).startsWith('subclient_') &&
      !isSharedWithOtherRow &&
      !belongsToOtherZeroEjSku
    ) {
      const updatePayload: any = {
        upc: newUpc,
        storageLocation: 'MD',
        warehouseId: MD_CANONICAL_WAREHOUSE_ID,
      };
      if (cleanSku) updatePayload.locationSku = cleanSku;
      await updateInventoryItem(mapped.$id, updatePayload);
      mapped.upc = newUpc;
      mapped.storageLocation = 'MD';
      mapped.warehouseId = MD_CANONICAL_WAREHOUSE_ID;
      if (cleanSku) mapped.locationSku = cleanSku;
    } else {
      // Mapped item is shared with another 0EJ SKU (e.g. 0EJ02D vs 0EJ05G on HUCK-9543): create a dedicated item for cleanSku
      const isSold = row.status === 'sold' || row.status === 'paid';
      const locName = currentLocation.value?.name || 'Memory Den';
      const listedPrice = Number(row.listedPrice || mapped?.resalePrice || row.netSoldPrice || 0);
      const netSoldPrice = Number(row.netSoldPrice || row.listedPrice || 0);
      const doc = await saveItemToInventory(
        {
          title: row.itemName || mapped?.title || 'Memory Den Item',
          condition_notes: `Assigned unique barcode for SKU: ${cleanSku || 'N/A'}`,
        },
        null,
        {
          title: row.itemName || mapped?.title || 'Memory Den Item',
          status: isSold ? 'sold' : 'placed',
          locationSku: cleanSku,
          cost: String(mapped?.cost ?? 0),
          resalePrice: String(listedPrice),
          soldPrice: isSold ? netSoldPrice : undefined,
          sellingLocations: locName ? [locName] : [],
          storageLocation: 'MD',
          upc: newUpc,
        },
        team.value?.$id || user.value?.$id || '',
        team.value?.$id ? 'team' : 'user'
      );
      inventoryItems.value.unshift(doc);
      row.mappedItem = doc;
    }

    row.extractedUpc = newUpc;
    row.expectedRcUpc = newUpc;
    row.conflictReason = '';
    row.uniqueBarcodeAssigned = true;
    row.isSavedToMd = true;
    void syncLivePayloadToCloudEndpoint();
    addToast({
      type: 'success',
      message: `✅ Assigned unique barcode ${newUpc} to ${cleanSku || row.itemName}! Push in MD Widget to finish.`,
    });
  } catch (err: any) {
    addToast({
      type: 'error',
      message: `Failed to assign unique barcode: ${err?.message || 'Unknown error'}`,
    });
  } finally {
    row.isAssigningUniqueUpc = false;
  }
};

const adoptBoothTagForRow = async (row: any) => {
  if (!row || row.isAdoptingBoothUpc) return;
  const cleanSku = cleanCatalogSku(row.extractedSku || row.mappedItem?.locationSku || '').toUpperCase();
  const boothUpc = cleanCatalogSku(row.extractedUpc || '').toUpperCase();
  if (!cleanSku || !boothUpc) {
    addToast({ type: 'warning', message: 'Missing 0EJ SKU or Ricochet Booth Tag UPC.' });
    return;
  }

  row.isAdoptingBoothUpc = true;
  try {
    // Check if another active 0EJ item in inventory already claims boothUpc
    const conflictingDoc = (inventoryItems.value || []).find((i: any) => {
      const iSku = cleanCatalogSku(i?.locationSku || i?.sku).toUpperCase();
      const iUpc = cleanCatalogSku(i?.upc).toUpperCase();
      return iUpc === boothUpc && iSku && /^0EJ/i.test(iSku) && iSku !== cleanSku;
    });
    if (conflictingDoc) {
      addToast({
        type: 'error',
        message: `Cannot adopt ${boothUpc} for ${cleanSku}: ${boothUpc} is already assigned to booth SKU ${cleanCatalogSku(conflictingDoc.locationSku || conflictingDoc.sku).toUpperCase()} ("${conflictingDoc.title}").`,
      });
      return;
    }

    if (row.mappedItem?.$id && !String(row.mappedItem.$id).startsWith('subclient_')) {
      await updateInventoryItem(row.mappedItem.$id, {
        upc: boothUpc,
        locationSku: cleanSku,
        storageLocation: 'MD',
        warehouseId: MD_CANONICAL_WAREHOUSE_ID,
      });
      row.mappedItem.upc = boothUpc;
      row.mappedItem.locationSku = cleanSku;
      row.mappedItem.storageLocation = 'MD';
    }

    const res = await fetch('/api/md-verify-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'adopt_md_upc',
        sku: cleanSku,
        mdUpc: boothUpc,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      throw new Error(data?.error || 'Could not update cloud verification report');
    }

    row.expectedRcUpc = boothUpc;
    row.verifyStatus = 'VERIFIED_MATCH';
    row.isSavedToMd = true;
    broadcastBarcodesUpdated();
    void fetchMdVerifyReport(false);
    addToast({
      type: 'success',
      message: `🏷️ Adopted Booth Tag ${boothUpc} for ${cleanSku}! Resale Command now matches the physical tag on the shelf.`,
    });
  } catch (err: any) {
    addToast({
      type: 'error',
      message: `Could not adopt booth tag: ${err?.message || 'Unknown error'}`,
    });
  } finally {
    row.isAdoptingBoothUpc = false;
  }
};

const copyBookmarkletCode = () => {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(bookmarkletHref.value);
    addToast({ type: 'success', message: `Copied Evergreen "⚡ Memory Den Sync" Bookmarklet! Drag the yellow button to your Bookmarks Bar once — it auto-updates live from Resale Command.` });
  }
};

const copyRicochetBarcodeMapJson = () => {
  const payload = ricochetBarcodePayloadMap.value;
  const count = Object.keys(payload).length;
  if (count === 0) {
    addToast({ type: 'warning', message: 'No 0EJ... -> UPC pairs found in inventory yet.' });
    return;
  }
  const json = JSON.stringify(payload, null, 2);
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(json);
    addToast({ type: 'success', message: `Copied { "0EJ...": "HUCK-XXXX" } JSON payload (${count} SKU pairs) to clipboard!` });
  }
};

const copyPreloadedConsoleScript = (mode: 'full' | 'single' = 'full') => {
  let matched = [...ricochetSyncableItems.value];

  if (matched.length === 0) {
    addToast({ type: 'warning', message: 'No mapped items with UPCs to export.' });
    return;
  }

  const isTest = mode === 'single';
  if (isTest) {
    matched = matched.slice(0, 1);
  }

  const fullMap = ricochetBarcodePayloadMap.value;
  const script = `// ⚡ Resale Command ➔ Ricochet Preloaded UPC Auto-Sync & 2-Way Verifier (${isTest ? 'TEST 1 ITEM' : 'ALL ' + matched.length + ' ITEMS'})
(async function() {
  const isTestMode = ${isTest};
  const items = ${JSON.stringify(matched, null, 2)};
  const fullMap = ${JSON.stringify(fullMap)};
  const cleanStr = (v) => String(v ?? '').trim().replace(/^['"]+/, '').replace(/['"]+$/, '').trim();
  const extractRicochetSku = (p) => {
    if (!p || typeof p !== 'object') return '';
    for (const c of [p.sku, p.SKU, p.number, p.code, p.items?.[0]?.sku]) {
      const s = cleanStr(c).toUpperCase();
      if (s && /^0EJ[A-Z0-9]{2,6}$/i.test(s)) return s;
    }
    if (p.sku_quantities && typeof p.sku_quantities === 'object') {
      for (const k of Object.keys(p.sku_quantities)) {
        const s = cleanStr(k).toUpperCase();
        if (s) return s;
      }
    }
    for (const v of Object.values(p)) {
      if (typeof v === 'string' && /^'?0EJ[A-Z0-9]{3,5}$/i.test(v.trim())) return cleanStr(v).toUpperCase();
    }
    return cleanStr(p.sku || p.SKU || p.number || p.code).toUpperCase();
  };
  const extractRicochetUpc = (p) => {
    if (!p || typeof p !== 'object') return '';
    for (const c of [p.upc_code, p.upc, p.UPC, p.barcode, p.items?.[0]?.upc_code, p.items?.[0]?.upc]) {
      const u = cleanStr(c).toUpperCase();
      if (u) return u;
    }
    for (const v of Object.values(p)) {
      if (typeof v === 'string' && /^'?(HUCK|PDXGL|BB)-[A-Z0-9-]+$/i.test(v.trim())) return cleanStr(v).toUpperCase();
    }
    return '';
  };

  console.log('%c[Resale Command]%c ' + (isTestMode ? '🧪 Starting SAFE TEST RUN for 1 item only...' : 'Starting bulk UPC sync for ' + items.length + ' items...'), 'background:#4f46e5;color:#fff;padding:2px 8px;border-radius:4px;font-weight:bold;', '');
  if (!window.axios) {
    console.error('[Resale Command] Please run this script inside your logged-in Ricochet portal (memoryden.ricoconsign.com)');
    return;
  }

  let catalog = [];
  let consignorId = null;
  for (let offset = 0; offset < 2000; offset += 100) {
    try {
      const q = consignorId ? '&consignor_id=' + consignorId : '';
      const catRes = await window.axios.get('/api/product?store=1&limit=100&offset=' + offset + '&order_by=id&direction=desc' + q);
      const prods = catRes.data.products || (Array.isArray(catRes.data) ? catRes.data : []);
      if (!consignorId && prods[0]?.consignor_id) consignorId = prods[0].consignor_id;
      const myProds = consignorId ? prods.filter(p => !p.consignor_id || p.consignor_id === consignorId) : prods;
      catalog.push(...myProds);
      if (prods.length < 100) break;
    } catch (e) { break; }
  }
  console.log('📡 Loaded ' + catalog.length + ' consignor products from Ricochet.');

  let success = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const cleanSku = cleanStr(item.sku).toUpperCase();
    let prod = catalog.find(p => extractRicochetSku(p) === cleanSku);
    if (!prod) continue;

    try {
      const detailRes = await window.axios.get('/api/product/show/' + prod.id);
      const payload = detailRes.data.product || detailRes.data.data || detailRes.data;
      const allItems = Array.isArray(payload.items) ? payload.items : Object.values(payload.items || {}).flat();
      const targetItem = allItems[0];
      if (!targetItem) { failed++; continue; }

      if (cleanStr(targetItem.upc_code).toUpperCase() === item.upc) {
        prod.upc_code = item.upc;
        success++;
        continue;
      }

      targetItem.store = 1;
      targetItem.upc_code = item.upc;
      const saveRes = await window.axios.put('/api/product/items', targetItem);
      if (saveRes.status === 200 || saveRes.status === 201) {
        prod.upc_code = item.upc;
        success++;
        console.log('%c✓ [' + (i+1) + '/' + items.length + '] ' + cleanSku + ' ➔ UPC: ' + item.upc, 'color:#10b981;font-weight:bold;font-size:12px;');
      } else { failed++; }
    } catch (err) { failed++; }
    await new Promise(r => setTimeout(r, 200));
  }

  const reportRows = catalog.map(p => {
    const sku = extractRicochetSku(p);
    const upc = extractRicochetUpc(p);
    const expectedRcUpc = cleanStr(fullMap[sku] || '').toUpperCase();
    let verifyStatus = 'UNLINKED_IN_RC';
    if (expectedRcUpc) {
      verifyStatus = !upc ? 'MISSING_IN_MD' : (upc === expectedRcUpc ? 'VERIFIED_MATCH' : 'MISMATCH_UPC');
    } else if (upc && /^(HUCK|PDXGL|BB)-/i.test(upc)) {
      verifyStatus = 'VERIFIED_MATCH';
    }
    const firstItem = Array.isArray(p.items) ? p.items[0] : (p.items && typeof p.items === 'object' ? Object.values(p.items).flat()[0] : null);
    const rawPrice = p.price ?? p.agreed_price ?? p.retail_price ?? p.aged_price ?? p['Agreed Price'] ?? p.cost ?? p.amount ?? firstItem?.price ?? firstItem?.agreed_price ?? 0;
    const agreedPrice = parseFloat(String(rawPrice).replace(/[^0-9.-]/g, '')) || 0;
    const rawStatusStr = cleanStr(p.status ?? p.inventory ?? p.Inventory ?? p.state ?? firstItem?.status ?? '').toLowerCase();
    const isSoldOrPaidFlag = p.sold === true || p.paid === true || rawStatusStr === 'sold' || rawStatusStr === 'paid';
    const rawQty = p.quantity ?? p.qty ?? p.in_stock ?? p.stock ?? p.Quantity ?? firstItem?.quantity ?? 1;
    const parsedQty = isSoldOrPaidFlag ? 0 : (parseInt(String(rawQty).replace(/[^0-9-]/g, ''), 10) || 0);
    const inventory = (p.paid === true || rawStatusStr.includes('paid')) ? 'Paid' : ((isSoldOrPaidFlag || parsedQty === 0) ? 'Sold' : 'In Stock');
    return {
      productId: String(p.id || ''),
      sku,
      upc,
      expectedRcUpc,
      verifyStatus,
      name: cleanStr(p.name || p.title || sku),
      agreedPrice,
      quantity: parsedQty,
      inventory
    };
  });

  try {
    await fetch('https://www.resalecmd.com/api/md-verify-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp: new Date().toISOString(), rows: reportRows })
    });
    console.log('%c📡 Sent Live Verification Report to Resale Command!', 'color:#38bdf8;font-weight:bold;');
  } catch (e) {}

  console.log('%c🎉 ' + (isTestMode ? 'Test Run Complete!' : 'Sync Finished!') + ' ' + success + ' verified/updated, ' + failed + ' failed.', 'color:#10b981;font-weight:bold;font-size:14px;');
})();`;

  navigator.clipboard.writeText(script);
  if (isTest) {
    addToast({ type: 'info', message: 'Copied TEST script (1 item only) to clipboard! Paste into Ricochet console to verify.' });
  } else {
    addToast({ type: 'success', message: `Copied preloaded script for ${matched.length} items to clipboard!` });
  }
};

const toValidIso = (raw: any): string | null => {
  if (!raw) return null;
  return toSaleIso(raw) || null;
};
const resolveSoldIso = (row: any, item?: any): string =>
  toValidIso(row?.soldDate) || toValidIso(item?.soldDate) || new Date().toISOString();

function parseFlexibleDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  const m = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) {
    const [, month, day, year] = m;
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00.000Z`).toISOString();
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

const logRentDeductionsToExpenses = async () => {
  if ((detectedRentDeductions.value || []).length === 0) return;
  isLoggingRent.value = true;
  try {
    const locName = currentLocation.value?.name || 'Memory Den';
    const locId = selectedLocationId.value || 'booth';
    let count = 0;
    for (const rent of detectedRentDeductions.value) {
      await databases.createDocument(DB_ID, 'expenses', ID.unique(), {
        cartId: `RENT-${locId}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        tenantId: team.value?.$id || 'personal',
        amount: Number(rent.amount) || 382.50,
        note: `[BOOTH_RENT] ${locName} - ${rent.title} (${rent.date || 'Monthly'})`,
        date: parseFlexibleDate(rent.date),
        purchaseId: locId !== 'booth' ? locId : undefined,
      });
      count++;
    }
    addToast({
      type: 'success',
      message: `Successfully logged ${count} booth rent deductions ($${totalRentDetected.value.toFixed(2)}) to your tax expenses ledger!`,
    });
    detectedRentDeductions.value = [];
  } catch (err: any) {
    console.error('Failed to log rent expenses:', err);
    addToast({ type: 'error', message: 'Failed to log rent expenses: ' + err.message });
  } finally {
    isLoggingRent.value = false;
  }
};

const formatDate = (isoStr: string) => {
  try {
    return new Date(isoStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
};

const refreshSyncHistory = () => {
  const tId = team.value?.$id || user.value?.$id;
  if (tId) {
    syncHistoryList.value = getSyncHistory(tId);
  }
};

const deleteHistoryItem = (id: string) => {
  const tId = team.value?.$id || user.value?.$id;
  if (!tId) return;
  deleteSyncHistoryEntry(tId, id);
  refreshSyncHistory();
  addToast({ type: 'info', message: 'Removed sync history record.' });
};

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
    cancelText: options.cancelText || 'Cancel',
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
    cancelText: 'Keep History',
  });
  if (!ok) return;
  clearLocationSyncHistory(team.value.$id, selectedLocationId.value);
  refreshSyncHistory();
  addToast({ type: 'info', message: `Cleared sync history for ${locName}.` });
};

function extractKeywords(str: string): string[] {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

function findBestItemMatch(csvName: string, inventory: any[]): any {
  if (!csvName || !inventory || inventory.length === 0) return null;

  const eligibleInventory = inventory.filter((i) => {
    const s = String(i?.status || '').toLowerCase().trim();
    return s !== 'tracked' && s !== 'scouted' && s !== 'draft';
  });
  if (eligibleInventory.length === 0) return null;

  const cleanCsv = csvName.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const item of eligibleInventory) {
    const cleanTitle = (item?.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanTitle && (cleanTitle === cleanCsv || (cleanCsv.length >= 10 && cleanTitle === cleanCsv))) {
      return item;
    }
  }

  const csvTokens = new Set(extractKeywords(csvName));
  if (csvTokens.size === 0) return null;

  let bestItem = null;
  let bestScore = 0;

  for (const item of eligibleInventory) {
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

    if (score >= 0.55 && (matchingTokens >= 2 || (matchingTokens === 1 && [...csvTokens].some((t) => dbTokens.has(t) && t.length >= 5)))) {
      const combinedScore = score * 0.6 + jaccard * 0.4;
      if (combinedScore > bestScore) {
        bestScore = combinedScore;
        bestItem = item;
      }
    }
  }

  return bestItem;
}

// =========================================================================
// SLIDE-OVER INVENTORY MATCH DRAWER STATE, INLINE CONFIRM & LOT SPLITTING
// =========================================================================
let rcSyncChannel: BroadcastChannel | null = null;
const broadcastBarcodesUpdated = () => {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      if (!rcSyncChannel) rcSyncChannel = new BroadcastChannel('resale_command_sync');
      rcSyncChannel.postMessage({ type: 'RC_BARCODES_UPDATED', timestamp: Date.now() });
    }
  } catch {}
};

const getItemThumbUrl = (item: any): string => {
  const imgId = getPrimaryItemImageId(item);
  if (!imgId) return '';
  return getAssetUrl(imgId, { preview: true, width: 160, height: 160, quality: 80 });
};

const getRowSuggestedCount = (row: any): number => {
  if (!row || !inventoryItems.value || inventoryItems.value.length === 0) return 0;
  const isRowInStock = row.status !== 'sold' && row.status !== 'paid';
  const cands = getUnclaimedMatchCandidatesForRow({
    rowSku: row.extractedSku,
    rowTitle: row.itemName,
    rowPrice: Number(row.listedPrice || 0),
    rowIsInStock: isRowInStock,
    rowIsBb: Boolean(row.isBbRow),
    searchQuery: '',
    filterMode: 'suggested',
    allItems: inventoryItems.value,
    claimedItemIds: claimedItemIdsForRow(row),
    limit: 8,
  });
  return mergeStagedCandidateAtTop(row, cands).length;
};

const openMatchDrawer = (row: any) => {
  activeMatchRow.value = row;
  matchDrawerSearch.value = '';
  const suggested = getRowSuggestedCount(row);
  matchDrawerFilter.value = suggested > 0 ? 'suggested' : 'all';
  isMatchDrawerOpen.value = true;
};

const closeMatchDrawer = () => {
  isMatchDrawerOpen.value = false;
  activeMatchRow.value = null;
  matchDrawerSearch.value = '';
};

const stepMatchDrawerRow = (delta: number) => {
  const idx = activeMatchRowIndex.value;
  if (idx < 0) return;
  const nextIdx = idx + delta;
  if (nextIdx >= 0 && nextIdx < displayedRows.value.length) {
    const nextRow = displayedRows.value[nextIdx];
    activeMatchRow.value = nextRow;
    matchDrawerSearch.value = '';
    matchDrawerFilter.value = getRowSuggestedCount(nextRow) > 0 ? 'suggested' : 'all';
  }
};

const quickAddFromDrawer = async (row: any) => {
  await quickAddRow(row);
  if (row.mappedItem) {
    closeMatchDrawer();
  }
};

/**
 * Shared persistence helper: links a single inventory item to a booth row and saves to Appwrite MD.
 */
const linkAndSaveItemToSpecificRow = async (row: any, item: any, closeDrawerOnSuccess = false) => {
  if (!row || !item || !item.$id) return;

  isSavingDrawerLink.value = item.$id;
  row.isConfirmingInline = true;
  try {
    const cleanSku = cleanCatalogSku(row.extractedSku);
    const isRowSold = row.status === 'sold' || row.status === 'paid';
    const isMemoryDenLocation =
      selectedLocationId.value === MD_CANONICAL_WAREHOUSE_ID ||
      String(currentLocation.value?.code || '').toUpperCase() === 'MD' ||
      /memory\s*den/i.test(String(currentLocation.value?.name || '')) ||
      /^0EJ/i.test(cleanSku);

    const targetWarehouseId = isMemoryDenLocation
      ? MD_CANONICAL_WAREHOUSE_ID
      : (selectedLocationId.value || MD_CANONICAL_WAREHOUSE_ID);
    const targetStorageCode = isMemoryDenLocation
      ? 'MD'
      : String(currentLocation.value?.code || 'MD').toUpperCase();

    const normSkuUpper = cleanSku.toUpperCase();
    const binConfig = PREVERIFIED_MD_MULTI_QTY_BINS[normSkuUpper];
    const targetStatus = !isRowSold || Boolean(binConfig) ? 'placed' : 'sold';
    const targetQty = !isRowSold
      ? Math.max(1, Number(row.csvQty ?? item.quantity ?? 1))
      : binConfig
        ? Math.max(1, binConfig.expectedRemainingQty)
        : 1;

    const updatePayload: any = {
      status: targetStatus,
      storageLocation: targetStorageCode,
      warehouseId: targetWarehouseId,
      quantity: targetQty,
    };
    if (cleanSku) {
      updatePayload.locationSku = cleanSku;
    }

    await updateInventoryItem(item.$id, updatePayload);

    item.status = targetStatus;
    item.storageLocation = targetStorageCode;
    item.warehouseId = targetWarehouseId;
    item.quantity = targetQty;
    if (cleanSku) item.locationSku = cleanSku;

    row.mappedItem = item;
    row.extractedUpc = item.upc || row.extractedUpc;
    row.expectedRcUpc = item.upc || row.expectedRcUpc;
    row.isSavedToMd = true;
    row.selectedForApproval = false;

    void syncLivePayloadToCloudEndpoint();
    broadcastBarcodesUpdated();

    addToast({
      type: 'success',
      message: `✅ Linked & Saved ${item.upc || item.title} ➔ ${cleanSku || targetStorageCode} (${targetStatus} @ ${targetStorageCode})`,
    });

    if (closeDrawerOnSuccess) {
      closeMatchDrawer();
    }
  } catch (err: any) {
    console.error('[LocationSyncView] Failed to link & save item to MD:', err);
    addToast({
      type: 'error',
      message: `Failed to save link to Appwrite: ${err?.message || 'Unknown error'}`,
    });
  } finally {
    isSavingDrawerLink.value = null;
    row.isConfirmingInline = false;
  }
};

const linkAndSaveCandidateToMd = async (item: any) => {
  await linkAndSaveItemToSpecificRow(activeMatchRow.value, item, true);
};

const confirmInlineCandidateLink = async (row: any, item: any) => {
  await linkAndSaveItemToSpecificRow(row, item, false);
};

/**
 * 1-Click `✂️ Split Piece from Lot & Link to MD`:
 * Creates a child item inheriting parentLotId, proportional cost share (`lotCost / pieceCount`),
 * purchaseId/orderId/photos, stamps `locationSku: rowSku`, `storageLocation: 'MD'`, `warehouseId: '6a7e70050009db0e1857'`,
 * and assigns a fresh sequential `HUCK-XXXX` / `PDXGL-` / `BB-` barcode while keeping the Parent Lot matchable for remaining pieces!
 */
const splitLotPieceAndLinkToMd = async (
  row: any,
  parentLot: any,
  estimatedCount?: number,
  closeDrawerAfter = false
) => {
  if (!row || !parentLot || !team.value) return;
  row.isConfirmingInline = true;
  isSavingDrawerLink.value = parentLot.$id;

  try {
    const cleanSku = cleanCatalogSku(row.extractedSku).toUpperCase();
    const isSold = row.status === 'sold' || row.status === 'paid';
    const pieceCount = Math.max(2, Number(estimatedCount || extractEstimatedLotPieceCount(parentLot) || 2));
    const lotCost = Number(parentLot.cost ?? 0);
    const unitCostShare = Number((lotCost / pieceCount).toFixed(2));
    const listedPrice = Number(row.listedPrice || row.netSoldPrice || parentLot.resalePrice || 0);
    const netSoldPrice = Number(row.netSoldPrice || row.listedPrice || 0);
    const locName = currentLocation.value?.name || 'Memory Den';

    const prefix = getRowEffectivePrefix(row);
    const newUpc =
      prefix.toUpperCase().startsWith('BB') && cleanSku
        ? `BB-${cleanSku}`
        : (getNextUpc ? getNextUpc(prefix) : `${prefix}${Math.floor(1000 + Math.random() * 9000)}`);

    const parentImgId = getPrimaryItemImageId(parentLot);
    const parentGallery = Array.isArray(parentLot.galleryImageIds) ? parentLot.galleryImageIds : [];

    const childDoc = await withRetry(() =>
      saveItemToInventory(
        {
          title: row.itemName || parentLot.title || 'Split Lot Piece',
          condition_notes: `✂️ Split 1/${pieceCount} from Parent Lot ${parentLot.upc || parentLot.$id} ("${parentLot.title}") • Proportional Cost: $${unitCostShare.toFixed(2)} • Booth SKU: ${cleanSku || 'MD'}`,
        },
        null,
        {
          title: row.itemName || parentLot.title || 'Split Lot Piece',
          status: isSold ? 'sold' : 'placed',
          locationSku: cleanSku,
          cost: String(unitCostShare),
          resalePrice: String(listedPrice),
          soldPrice: isSold ? netSoldPrice : undefined,
          sellingLocations: [locName],
          storageLocation: 'MD',
          upc: newUpc,
          parentLotId: parentLot.$id,
          purchaseId: parentLot.purchaseId || undefined,
          orderId: parentLot.orderId || undefined,
          purchaseLocation: parentLot.purchaseLocation || undefined,
          imageId: parentImgId || undefined,
          galleryImageIds: parentGallery.length > 0 ? parentGallery : (parentImgId ? [parentImgId] : []),
        } as any,
        team.value?.$id || user.value?.$id || '',
        team.value?.$id ? 'team' : 'user'
      )
    );

    // Decrement parent lot quantity if > 1 (never write quantity: 0!)
    const currentParentQty = Number(parentLot.quantity ?? 1);
    if (currentParentQty > 1) {
      const nextParentQty = Math.max(1, currentParentQty - 1);
      const nextParentCost = Math.max(0, Number((lotCost - unitCostShare).toFixed(2)));
      try {
        await updateInventoryItem(parentLot.$id, {
          quantity: nextParentQty,
          cost: nextParentCost,
        });
        parentLot.quantity = nextParentQty;
        parentLot.cost = nextParentCost;
      } catch {}
    }

    inventoryItems.value.unshift(childDoc);
    row.mappedItem = childDoc;
    row.extractedUpc = newUpc;
    row.expectedRcUpc = newUpc;
    row.isSavedToMd = true;
    row.selectedForApproval = false;
    newItemsCreatedInSession.value++;

    void syncLivePayloadToCloudEndpoint();
    broadcastBarcodesUpdated();

    addToast({
      type: 'success',
      message: `✂️ Split "${row.itemName}" from Lot ${parentLot.upc || ''} ➔ ${newUpc} ($${unitCostShare.toFixed(2)} cost share, SKU ${cleanSku})!`,
    });

    if (closeDrawerAfter) {
      closeMatchDrawer();
    }
  } catch (err: any) {
    console.error('[LocationSyncView] Lot split failed:', err);
    addToast({
      type: 'error',
      message: `Failed to split piece from lot: ${err?.message || 'Unknown error'}`,
    });
  } finally {
    row.isConfirmingInline = false;
    isSavingDrawerLink.value = null;
  }
};

/**
 * Finds other unmatched rows in syncRows that also match this same Parent Lot so the user can split & link multiple pieces in 1 click.
 */
const getOtherUnmatchedRowsMatchingLot = (parentLot: any, excludeRow?: any): any[] => {
  if (!parentLot || !parentLot.$id) return [];
  const lotKeywords = new Set(extractKeywords(parentLot.title || parentLot.identity || ''));
  if (lotKeywords.size === 0) return [];

  return (syncRows.value || []).filter((r) => {
    if (!r || r.mappedItem || r === excludeRow) return false;
    if (r.stagedCandidate?.item?.$id === parentLot.$id) return true;
    const rowWords = extractKeywords(r.itemName || '');
    return rowWords.some((w) => w.length >= 4 && lotKeywords.has(w));
  });
};

const splitMultiplePiecesFromLot = async (parentLot: any, estimatedCount: number, targetRows: any[]) => {
  if (!parentLot || !Array.isArray(targetRows) || targetRows.length === 0) return;
  isSplittingLotId.value = parentLot.$id;
  try {
    for (const r of targetRows) {
      if (!r || r.mappedItem) continue;
      await splitLotPieceAndLinkToMd(r, parentLot, estimatedCount, false);
      await new Promise((res) => setTimeout(res, 180));
    }
    closeMatchDrawer();
  } finally {
    isSplittingLotId.value = null;
  }
};

/**
 * Batch approves all user-checked staged matches (`✅ Approve Selected Matches (N)`).
 */
const approveSelectedStagedMatches = async () => {
  const rowsToApprove = [...selectedHighConfidenceRows.value];
  if (rowsToApprove.length === 0) return;

  isBatchApproving.value = true;
  let approved = 0;
  try {
    for (const row of rowsToApprove) {
      const top = getTopStagedCandidateForRow(row);
      if (!top || !top.item) continue;
      if (top.isParentLot || top.recommendedAction === 'split_lot') {
        await splitLotPieceAndLinkToMd(row, top.item, top.estimatedLotCount, false);
      } else {
        await confirmInlineCandidateLink(row, top.item);
      }
      approved++;
      await new Promise((res) => setTimeout(res, 150));
    }
    addToast({
      type: 'success',
      message: `✅ Approved & linked ${approved} staged booth match${approved === 1 ? '' : 'es'} to Memory Den!`,
    });
  } finally {
    isBatchApproving.value = false;
  }
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

const loadDemoCsv = () => {
  const sample = `Product ID,SKU,UPC,Item Name,Price,Consignor %,Status,Sold Date,Sale #
101,HUCK-1001,HUCK-1001,Vintage Pyrex Horizon Blue Butter Dish,45.00,85%,Sold,2026-10-01,T-8891
102,HUCK-1002,HUCK-1002,Mid Century Teak Salt & Pepper Shakers,28.00,85%,In Stock,,
103,PDXGL-2001,PDXGL-2001,Handblown Art Glass Swirl Paperweight,65.00,85%,Sold,2026-10-02,T-8892
104,PDXGL-2002,PDXGL-2002,Cobalt Blue Blown Glass Pitcher,50.00,85%,In Stock,,
105,0EJ08G,0EJ08G,Ceramic Retro Planter with Saucer,18.00,85%,Sold,2026-10-03,T-8893
106,0EJ09H,,Brass Desk Lamp Gooseneck,35.00,85%,In Stock,,
107,,,"Space Rental - Booth A2 Rent",-125.00,100%,Paid,2026-10-01,RENT-OCT`;

  parseCsvData(sample, 'Demo_MemoryDen_MultiOrg_Payout.csv');
};

const processCsvFile = (file: File) => {
  isParsing.value = true;
  const reader = new FileReader();
  reader.onload = (event) => {
    const text = event.target?.result as string;
    parseCsvData(text, file.name || 'Location_Export.csv');
  };
  reader.readAsText(file);
};

const parseCsvData = (rawText: string, fileName: string) => {
  isParsing.value = true;
  currentFileName.value = fileName;
  newItemsCreatedInSession.value = 0;

  try {
    let text = stripBom(rawText || '');

    if (!text) {
      addToast({ type: 'error', message: 'Could not read CSV data.' });
      isParsing.value = false;
      return;
    }

    const parsedMatrix = parseCsvRfc4180Rows(text);
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (parsedMatrix.length < 2) {
      addToast({ type: 'error', message: 'CSV file is empty or invalid.' });
      isParsing.value = false;
      return;
    }

    // Auto-detect Target Location based on Ricochet SKU format ('0EJ...') or filename
    const isMemoryDenCsv = text.includes('0EJ') || text.includes('0ej') || fileName.toLowerCase().includes('memory') || fileName.toLowerCase().includes('den');
    if (isMemoryDenCsv && locations.value.length > 0) {
      const memDen = locations.value.find(l => l.name.toLowerCase().includes('memory') || l.name.toLowerCase().includes('den'));
      if (memDen && selectedLocationId.value !== memDen.$id) {
        selectedLocationId.value = memDen.$id;
        addToast({ type: 'info', message: '📍 Auto-detected Memory Den (0EJ SKU) as Target Location' });
      }
    }

      rawCsvHeader.value = lines[0] || parsedMatrix[0].join(',');
      rawCsvLines.value = lines;

      const rawHeaders = parsedMatrix[0];
      const headerCols = rawHeaders.map(h => normalizeCsvHeader(h));
      const skuIdx = headerCols.findIndex(h => h === 'sku' || h.includes('sku') || h.includes('barcode') || h.includes('custom sku'));
      const upcIdx = headerCols.findIndex(h => h === 'upc' || h.includes('upc'));
      const prodIdIdx = headerCols.findIndex(h => h === 'product id' || h.includes('product id') || h.includes('item id'));
      const nameIdx = headerCols.findIndex(h => h === 'item' || h === 'name' || h.includes('name') || h.includes('title') || h.includes('item'));
      const saleIdx = headerCols.findIndex(h => isSaleNumberHeader(h));
      const soldDateIdx = headerCols.findIndex(h => isSoldDateHeader(h));
      const paidDateIdx = headerCols.findIndex(h => h === 'paid' || h === 'payout date');
      
      const amountIdx = headerCols.findIndex(h => h === 'payout' || h === 'net' || h === 'net payout' || h === 'vendor payout' || h === 'consignor amount' || h === 'net amount' || h === 'sold amount' || h === 'take home' || h === 'final amount' || h === 'amount');
      const agedPriceIdx = headerCols.findIndex(h => h === 'aged price' || h.includes('aged price'));
      const agreedPriceIdx = headerCols.findIndex(h => h === 'agreed' || h === 'agreed price' || h.includes('agreed') || h === 'gross' || h === 'gross amount' || h === 'price' || h.includes('price') || h === 'total');
      const descIdx = headerCols.findIndex(h => h === 'description' || h.includes('description') || h === 'brand' || h === 'category');
      
      const splitIdx = headerCols.findIndex(h => h === 'consignor %' || h.includes('consignor %') || h === 'split / cost' || h.includes('split') || h.includes('consignor percent'));
      const statusIdx = headerCols.findIndex(h => h === 'status' || h.includes('status') || h === 'inventory' || h.includes('state'));
      const qtyIdxExact = headerCols.findIndex(h => h === 'quantity' || h === 'qty');
      // NOTE: a Products-*.csv "In stock" column is the date the item was added to stock - never a quantity
      const qtyIdx = qtyIdxExact !== -1 ? qtyIdxExact : headerCols.findIndex(h => h.includes('quantity') || h.includes('qty'));
      const expectedRcUpcIdx = headerCols.findIndex(h => h === 'expected_rc_upc' || h === 'expected rc upc' || h.includes('expected_rc_upc'));
      const verifyStatusIdx = headerCols.findIndex(h => h === 'verify_status' || h === 'verify status' || h.includes('verify_status'));
      const conflictReasonIdx = headerCols.findIndex(h => h === 'conflict_reason' || h === 'conflict reason' || h.includes('conflict_reason'));
      const isVerifyReportCsv = expectedRcUpcIdx !== -1 || verifyStatusIdx !== -1;
      isCatalogExport.value = isVerifyReportCsv || isProductCatalogHeaders(rawHeaders);

      if (isVerifyReportCsv && !fileName.includes('Unlinked')) {
        const verifyRows: any[] = [];
        for (let rIdx = 1; rIdx < parsedMatrix.length; rIdx++) {
          const c = parsedMatrix[rIdx];
          if (!c || c.length === 0) continue;
          const vStatus = verifyStatusIdx !== -1 ? (c[verifyStatusIdx] || '').trim().toUpperCase() : 'UNLINKED_IN_RC';
          verifyRows.push({
            productId: prodIdIdx !== -1 ? (c[prodIdIdx] || '').trim() : '',
            sku: skuIdx !== -1 ? cleanCatalogSku(c[skuIdx]).toUpperCase() : '',
            upc: upcIdx !== -1 ? cleanCatalogSku(c[upcIdx]).toUpperCase() : '',
            expectedRcUpc: expectedRcUpcIdx !== -1 ? cleanCatalogSku(c[expectedRcUpcIdx]).toUpperCase() : '',
            verifyStatus: vStatus || 'UNLINKED_IN_RC',
            conflictReason: conflictReasonIdx !== -1 ? (c[conflictReasonIdx] || '').trim() : '',
            name: nameIdx !== -1 ? (c[nameIdx] || '').trim() : '',
            agreedPrice: agreedPriceIdx !== -1 ? (parseFloat((c[agreedPriceIdx] || '').replace(/[^0-9.]/g, '')) || 0) : 0,
            quantity: qtyIdx !== -1 ? (parseInt((c[qtyIdx] || '').replace(/[^0-9]/g, ''), 10) || 0) : 1,
            inventory: statusIdx !== -1 ? (c[statusIdx] || '').trim() : 'In Stock',
          });
        }
        mdVerifyReport.value = {
          timestamp: new Date().toISOString(),
          source: fileName,
          summary: {
            totalCatalog: verifyRows.length,
            verifiedMatch: verifyRows.filter(r => r.verifyStatus === 'VERIFIED_MATCH').length,
            missingInMd: verifyRows.filter(r => r.verifyStatus === 'MISSING_IN_MD').length,
            mismatchUpc: verifyRows.filter(r => r.verifyStatus === 'MISMATCH_UPC').length,
            unlinkedInRc: verifyRows.filter(r => r.verifyStatus === 'UNLINKED_IN_RC').length,
          },
          rows: verifyRows,
        };
      }

      const activeItems = Array.isArray(inventoryItems.value) ? inventoryItems.value : [];
      const claimedItemIdToSku = new Map<string, string>();
      const multiBinResolvedBySku = buildLockedMultiBinMap(activeItems, claimedItemIdToSku);

      const defaultCommission = currentLocation.value?.commissionRate || 15;
      const defaultConsignorPct = 100 - defaultCommission; // e.g. 85%

      const rows: any[] = [];
      const cleanOrg = (upcPrefix.value?.trim() || 'HUCK-').replace(/[-_]$/, '').toUpperCase();
      let nonOrgSkipped = 0;
      detectedRentDeductions.value = [];

      for (let i = 1; i < parsedMatrix.length; i++) {
        const cols = parsedMatrix[i];
        if (cols.length === 0 || !cols.some(c => c.trim().length > 0)) continue;

        let fullItemName = nameIdx !== -1 ? (cols[nameIdx] || '').trim() : `Item ${i}`;

        // Ignore summary lines or empty lines
        const lowerName = fullItemName.toLowerCase();
        if (
          lowerName.startsWith('total for payout') || 
          lowerName.startsWith('total paid') || 
          lowerName.startsWith('total:') ||
          (!fullItemName && !cols.some(c => c.trim().length > 0))
        ) {
          continue;
        }

        // Check for booth rent deduction rows (e.g. "(Credit) Space Rental 08/31/2026")
        if (lowerName.includes('space rental') || lowerName.includes('booth rent')) {
          const rentAmt = Math.abs(parseFloat((cols[amountIdx] || cols[agreedPriceIdx] || '382.50').replace(/[^0-9.]/g, '')) || 382.50);
          const dateMatch = fullItemName.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
          const rentDate = dateMatch 
            ? `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}` 
            : ((soldDateIdx !== -1 && cols[soldDateIdx]) || (paidDateIdx !== -1 && cols[paidDateIdx]) || '');
          detectedRentDeductions.value.push({
            title: fullItemName,
            amount: rentAmt,
            date: rentDate
          });
          continue;
        }

        // Payout-style files: rows missing Sale / Agreed / Amount are summary lines, never sales
        if (saleIdx !== -1 && agreedPriceIdx !== -1 && amountIdx !== -1 &&
            (!(cols[saleIdx] || '').trim() || !(cols[agreedPriceIdx] || '').trim() || !(cols[amountIdx] || '').trim())) {
          continue;
        }

        const statusVal = statusIdx !== -1 ? (cols[statusIdx] || '').trim().toLowerCase() : '';
        if (statusVal === 'declined' || statusVal === 'failed' || statusVal === 'void' || statusVal === 'cancelled' || statusVal === 'canceled' || statusVal === 'unsuccessful') {
          continue;
        }

        let rawSku = skuIdx !== -1 ? cols[skuIdx] : (prodIdIdx !== -1 ? cols[prodIdIdx] : '');
        let cleanSku = cleanCatalogSku(rawSku).replace(/^["]+/, '').replace(/['"]+$/, '').toUpperCase();
        let rawUpc = upcIdx !== -1 ? cols[upcIdx] : '';
        let cleanUpc = cleanCatalogSku(rawUpc).replace(/^['"]+/, '').replace(/['"]+$/, '');
        const rowExpectedRcUpc = expectedRcUpcIdx !== -1 ? cleanCatalogSku(cols[expectedRcUpcIdx]).toUpperCase() : '';
        const rowVerifyStatus = verifyStatusIdx !== -1 ? (cols[verifyStatusIdx] || '').trim().toUpperCase() : '';
        const rawQtyCell = qtyIdx !== -1 ? (cols[qtyIdx] || '').trim() : '';
        const parsedQtyNum = rawQtyCell !== '' ? parseInt(rawQtyCell.replace(/[^0-9-]/g, ''), 10) : NaN;
        const isExplicitZeroQty = !isNaN(parsedQtyNum) && parsedQtyNum === 0;
        let rowQty = !isNaN(parsedQtyNum) ? Math.max(0, parsedQtyNum) : (isCatalogExport.value ? 0 : 1);
        let saleTicketIdRaw = saleIdx !== -1 ? (cols[saleIdx] || '').trim() : '';
        // Canonical numeric ticket id so legacy "T-217301 • Title" records dedupe against "217301"
        let saleTicketId = canonicalTicketNumber(saleTicketIdRaw) || saleTicketIdRaw;
        let soldDate = soldDateIdx !== -1 ? (cols[soldDateIdx] || '').trim() : '';

        let name = fullItemName;

        // Fallback SKU extraction from title like "Item Title - 0EJ001"
        if (!cleanSku) {
          const skuMatch = fullItemName.match(/\s+-\s+([0-9A-Z]{5,8})\s*$/);
          if (skuMatch) {
            cleanSku = skuMatch[1].trim().toUpperCase();
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

        if (!cleanSku && !isCatalogExport.value) {
          cleanSku = resolveMemoryDenSkuFromPayoutRow({
            extractedSku: cleanSku,
            itemName: name,
            ticketNumber: saleTicketId,
            grossPrice
          });
        }

        const extraText = descIdx !== -1 ? (cols[descIdx] || '') : '';
        const rowIsBb = isBbConsignorRow({ sku: cleanSku, upc: cleanUpc || rowExpectedRcUpc, title: name, extraText });

        // Multi-Org SKU & Prefix Extraction
        const detectedPrefix = rowIsBb ? 'BB' : extractOrgPrefix(cleanUpc || rowExpectedRcUpc || cleanSku);
        const hasOrgPrefix = (cleanUpc && (cleanUpc.toUpperCase().startsWith(`${cleanOrg}-`) || cleanUpc.toUpperCase().startsWith(cleanOrg))) ||
                             (cleanSku && (cleanSku.toUpperCase().startsWith(`${cleanOrg}-`) || cleanSku.toUpperCase().startsWith(cleanOrg)));
        const matchesInventoryItem = activeItems.some(item => {
          const l = (item.locationSku || '').toLowerCase().trim().replace(/^['"]+/, '');
          const u = (item.upc || '').toLowerCase().trim();
          const s = (item.sku || '').toLowerCase().trim();
          const target = cleanSku.toLowerCase();
          return (l && l === target) || (u && u === target) || (s && s === target);
        });

        const isOrgItem = hasOrgPrefix || matchesInventoryItem;

        let orgBucket = 'UNASSIGNED';
        if (rowIsBb) {
          orgBucket = 'BB';
        } else if (isOrgItem || detectedPrefix === cleanOrg) {
          orgBucket = cleanOrg;
        } else if (detectedPrefix && detectedPrefix !== 'NONE') {
          orgBucket = detectedPrefix;
        } else {
          orgBucket = 'UNASSIGNED';
        }

        if (onlySyncOrgPrefix.value && (cleanSku || cleanUpc) && !isOrgItem) {
          nonOrgSkipped++;
          continue;
        }

        // 2. Read Consignor Split % directly from Memory Den row (e.g. 85% from "Consignor %" or "Split / Cost")
        let consignorPct = defaultConsignorPct;
        if (splitIdx !== -1 && cols[splitIdx]) {
          const parsedSplit = parseFloat(cols[splitIdx].replace(/[^0-9.]/g, ''));
          if (!isNaN(parsedSplit) && parsedSplit > 0 && parsedSplit <= 100) {
            consignorPct = parsedSplit;
          }
        }

        // 3. Read or Apply Exact Net Payout (preserve exact Agreed & Amount cents, never round $9.99 -> $10.00)
        grossPrice = Number(grossPrice.toFixed(2));
        let explicitPayout = amountIdx !== -1 ? parseFloat((cols[amountIdx] || '').replace(/[^0-9.-]/g, '')) || 0 : 0;
        let netSoldPrice = 0;

        if (explicitPayout > 0) {
          netSoldPrice = Number(explicitPayout.toFixed(2));
        } else if (grossPrice > 0) {
          netSoldPrice = Number((grossPrice * (consignorPct / 100)).toFixed(2));
        }

        // A row is only "sold" when the CSV says so explicitly: a sold/paid status, qty===0 in Ricochet, a Sold / Paid date, or pre-verified Oct sold override (0EJ0MU).
        // Multi-Qty Booth Bins with CSV Qty > 0 and HUCK-9458 (0EJ0O0) stay 'instock' (placed) in Catalog mode!
        let hasSoldIndicatorDate = (soldDateIdx !== -1 && !!(cols[soldDateIdx] || '').trim()) || (paidDateIdx !== -1 && !!(cols[paidDateIdx] || '').trim());
        let rawStatus = statusIdx !== -1 ? (cols[statusIdx] || '').trim().toLowerCase() : '';
        const isMultiBin = Boolean(PREVERIFIED_MD_MULTI_QTY_BINS[cleanSku]);
        const isOverrideSold = !isMultiBin && cleanSku !== '0EJ0O0' && (cleanSku === '0EJ0MU' || Boolean(PREVERIFIED_MD_SINGLE_UPC_BY_SKU[cleanSku]));
        let isSoldOrPaid =
          rawStatus.includes('sold') ||
          rawStatus.includes('paid') ||
          hasSoldIndicatorDate ||
          isOverrideSold ||
          (!isMultiBin && cleanSku !== '0EJ0O0' && isExplicitZeroQty);
        if (isCatalogExport.value && (isMultiBin || cleanSku === '0EJ0O0')) {
          isSoldOrPaid = false;
          if (isMultiBin && (!rowQty || rowQty < 1)) {
            rowQty = PREVERIFIED_MD_MULTI_QTY_BINS[cleanSku].expectedRemainingQty;
          }
        }

        // Commission Fee
        let commFee = grossPrice > netSoldPrice ? Number((grossPrice - netSoldPrice).toFixed(2)) : 0;

        // Match against existing inventory items using verified Memory Den matcher (enforcing B&B isolation, trap guards & multi-bin locks)
        let matched = matchMemoryDenInventoryItem({
          sku: cleanSku,
          upc: cleanUpc || rowExpectedRcUpc,
          title: name,
          price: grossPrice,
          extraText,
          allowPrefixForPayout: !isCatalogExport.value,
          activeItems,
          claimedItemIdToSku,
          multiBinResolvedBySku
        });

        if (matched && cleanSku && !claimedItemIdToSku.has(matched.$id)) {
          claimedItemIdToSku.set(matched.$id, cleanSku);
        }

        // Price & Sold-Status Fallback from Matched DB Item:
        // 1) Never show $0.00 when the matched DB item has a known resalePrice / listPrice / price / soldPrice!
        // 2) In Verification Report mode, if the matched DB item is already 'sold' (and not a multi-bin or 0EJ0O0), preserve 'sold' status so Load All 808 Items never marks 304 sold items as In-Stock!
        if (matched) {
          const dbPrice = Number(matched.resalePrice || matched.listPrice || matched.price || matched.soldPrice || 0);
          if (grossPrice <= 0 && dbPrice > 0) {
            grossPrice = Number(dbPrice.toFixed(2));
            if (explicitPayout <= 0) {
              netSoldPrice = Number((grossPrice * (consignorPct / 100)).toFixed(2));
            }
            commFee = grossPrice > netSoldPrice ? Number((grossPrice - netSoldPrice).toFixed(2)) : 0;
          }
          if (
            isVerifyReportCsv &&
            !isMultiBin &&
            cleanSku !== '0EJ0O0' &&
            String(matched.status || '').toLowerCase() === 'sold'
          ) {
            isSoldOrPaid = true;
          }
        }

        // Auto-stage missing B&B (BB-) items so they never match HUCK- and auto-create cleanly with cost: 0 on commit
        if (!matched && rowIsBb && cleanSku) {
          matched = {
            $id: `subclient_bb_${cleanSku}`,
            title: name,
            upc: cleanUpc && cleanUpc.toUpperCase().startsWith('BB-') ? cleanUpc.toUpperCase() : `BB-${cleanSku}`,
            locationSku: cleanSku,
            resalePrice: grossPrice,
            cost: 0,
            status: isSoldOrPaid ? 'sold' : 'placed',
            storageLocation: 'MD',
            quantity: isSoldOrPaid ? 1 : Math.max(1, rowQty || 1),
            isSubClient: true,
          };
        }

        const initialTopCand = !matched
          ? getUnclaimedMatchCandidatesForRow({
              rowSku: cleanSku,
              rowTitle: name,
              rowPrice: grossPrice,
              rowIsInStock: !isSoldOrPaid,
              rowIsBb,
              searchQuery: '',
              filterMode: 'suggested',
              allItems: activeItems,
              claimedItemIds: new Set<string>(claimedItemIdToSku.keys()),
              limit: 1,
            })[0] || null
          : null;

        rows.push({
          originalLineIndex: i,
          orgBucket,
          isBbRow: rowIsBb,
          extraText,
          customPrefix: rowIsBb ? 'BB-' : (detectedPrefix === 'PDXGL' ? 'PDXGL-' : ''),
          conflictReason: conflictReasonIdx !== -1 ? (cols[conflictReasonIdx] || '').trim() : '',
          productId: prodIdIdx !== -1 ? (cols[prodIdIdx] || '').trim() : '',
          extractedSku: cleanSku,
          extractedUpc: cleanUpc || (matched?.upc || '') || rowExpectedRcUpc,
          expectedRcUpc: rowExpectedRcUpc || (matched?.upc || ''),
          verifyStatus: rowVerifyStatus || undefined,
          itemName: name,
          listedPrice: grossPrice,
          netSoldPrice: netSoldPrice,
          commissionFee: commFee,
          consignorPct: consignorPct,
          csvQty: Math.max(1, rowQty || 1),
          salePrice: netSoldPrice, // Fallback compatibility
          status: isSoldOrPaid ? 'sold' : 'instock',
          saleTicketId,
          soldDate,
          mappedItem: matched || null,
          stagedCandidate: initialTopCand,
          selectedForApproval: Boolean(initialTopCand && initialTopCand.confidence >= 88),
          isConfirmingInline: false,
          searchQuery: '',
          isSearching: false,
          isQuickAdding: false
        });
      }

      skippedNonOrgCount.value = nonOrgSkipped;
      syncRows.value = rows;
      filterTab.value = 'all';
      // Cumulative CSV idempotency: flag rows already recorded in the sales ledger (non-blocking)
      void refreshRecordedFlags();
      if (nonOrgSkipped > 0) {
        addToast({ 
          type: 'success', 
          message: `Parsed ${rows.length} ${cleanOrg}-* items (skipped ${nonOrgSkipped} non-org rows)` 
        });
      } else {
        addToast({ type: 'success', message: `Parsed ${rows.length} items from ${fileName}!` });
      }
    } catch (err: any) {
      console.error('CSV Parsing Error:', err);
      addToast({ type: 'error', message: 'Failed to parse CSV: ' + err.message });
    } finally {
      isParsing.value = false;
    }
};

// Occurrence-indexed fingerprint guard (`saleNumber|soldDateIso|gross#occurrence`) against resale_db.sales.
// Rows already recorded are flagged `isAlreadyRecorded` ("✅ Already Recorded (Skipped)") and never create sales
// or decrement a multi-quantity bin again.
const syncRowAccessors = {
  getSaleNumber: (r: any) => r.saleTicketId,
  getSoldDate: (r: any) => r.soldDate,
  getGross: (r: any) => r.listedPrice,
  getSku: (r: any) => r.extractedSku,
  getTitle: (r: any) => r.itemName
};
const refreshRecordedFlags = async () => {
  try {
    if (!team.value?.$id || syncRows.value.length === 0 || isCatalogExport.value) return;
    const existing = await salesApi.listSales(team.value.$id);
    const { recordedCount, newCount } = flagAlreadyRecordedRows(syncRows.value, existing || [], syncRowAccessors);
    syncRows.value = [...syncRows.value];
    if (recordedCount > 0) {
      addToast({ type: 'info', message: `✅ ${recordedCount} row(s) already recorded (skipped). ${newCount} new.` });
    }
  } catch (e) {
    console.warn('[LocationSync] Could not flag already-recorded rows:', e);
  }
};

const resetSync = () => {
  syncRows.value = [];
  rawCsvHeader.value = '';
  rawCsvLines.value = [];
  filterTab.value = 'all';
  verifyStatusFilter.value = 'ALL';
  searchQuery.value = '';
  currentFileName.value = '';
  newItemsCreatedInSession.value = 0;
  skippedNonOrgCount.value = 0;
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
  const unmappedRows = [...targetAiUnmappedRows.value];
  if (unmappedRows.length === 0) {
    addToast({ type: 'info', message: 'All items in this view are already mapped!' });
    return;
  }

  const BATCH_SIZE = 20;
  const totalRows = unmappedRows.length;
  isAiMatching.value = true;
  aiMatchingProgressText.value = `⏳ AI Analyzing 1–${Math.min(BATCH_SIZE, totalRows)} of ${totalRows}...`;

  showLoader("✨ Gemini 2.5 Flash Smart-Stager...", {
    step: aiMatchingProgressText.value,
    progress: 15
  });

  try {
    const allItems = Array.isArray(inventoryItems.value) ? inventoryItems.value : [];
    const claimedIds = claimedItemIdsForRow();
    const eligiblePool = allItems.filter((i: any) => {
      if (!i || !i.$id) return false;
      const s = String(i.status || '').toLowerCase();
      if (['combined', 'deconstructed', 'tracked', 'draft', 'scouted'].includes(s)) return false;
      const isLot = isParentLotCandidate(i);
      const locSku = cleanCatalogSku(i.locationSku || i.sku).toUpperCase();
      if (/^0EJ/i.test(locSku) && !isLot) return false;
      if (claimedIds.has(i.$id) && !isLot) return false;
      return true;
    });

    let stagedCount = 0;
    let lotSplitCount = 0;
    let newBoothCount = 0;

    for (let offset = 0; offset < totalRows; offset += BATCH_SIZE) {
      const batchRows = unmappedRows.slice(offset, offset + BATCH_SIZE);
      const startNum = offset + 1;
      const endNum = Math.min(offset + BATCH_SIZE, totalRows);
      const progressPct = Math.min(95, Math.round((endNum / totalRows) * 90) + 10);

      aiMatchingProgressText.value = `⏳ AI Analyzing ${startNum}–${endNum} of ${totalRows}...`;
      showLoader("✨ Gemini 2.5 Flash Smart-Stager...", {
        step: aiMatchingProgressText.value,
        progress: progressPct,
      });

      const rowsPayload = batchRows.map((r) => ({
        sku: r.extractedSku || `ROW_${r.originalLineIndex}`,
        title: r.itemName,
        price: Number(r.listedPrice || r.netSoldPrice || 0),
        status: r.status,
      }));

      // Build targeted candidate pool for this batch:
      // 1) Top heuristic & all-mode candidates for each row in the batch
      // 2) All eligible Parent Lots (e.g. HUCK-0790, HUCK-0467, etc.)
      // 3) Remaining unclaimed items up to 90 candidates
      const prioritizedMap = new Map<string, any>();
      for (const r of batchRows) {
        const isRowInStock = r.status !== 'sold' && r.status !== 'paid';
        const topForRow = getUnclaimedMatchCandidatesForRow({
          rowSku: r.extractedSku,
          rowTitle: r.itemName,
          rowPrice: Number(r.listedPrice || 0),
          rowIsInStock: isRowInStock,
          rowIsBb: Boolean(r.isBbRow),
          searchQuery: '',
          filterMode: 'all',
          allItems,
          claimedItemIds: claimedIds,
          limit: 6,
        });
        for (const c of topForRow) {
          if (c.item?.$id && !prioritizedMap.has(c.item.$id)) {
            prioritizedMap.set(c.item.$id, c.item);
          }
        }
      }

      for (const item of eligiblePool) {
        if (isParentLotCandidate(item) && !prioritizedMap.has(item.$id)) {
          prioritizedMap.set(item.$id, item);
        }
      }

      for (const item of eligiblePool) {
        if (prioritizedMap.size >= 90) break;
        if (!prioritizedMap.has(item.$id)) {
          prioritizedMap.set(item.$id, item);
        }
      }

      const candidatesPayload = Array.from(prioritizedMap.values())
        .slice(0, 90)
        .map((i: any) => ({
          id: i.$id,
          upc: i.upc || '',
          title: i.title || i.identity || '',
          price: Number(i.resalePrice || i.listPrice || 0),
          cost: Number(i.cost || 0),
          quantity: Number(i.quantity || 1),
          isParentLot: isParentLotCandidate(i),
          estimatedLotCount: extractEstimatedLotPieceCount(i),
          storageLocation: i.storageLocation || 'HG',
        }));

      const res = await fetch('/api/ai-match-booth-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: rowsPayload,
          candidates: candidatesPayload,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `AI Smart-Stage server error (${res.status})`);
      }

      const data = await res.json();
      const matches = Array.isArray(data?.matches) ? data.matches : [];

      for (const m of matches) {
        const normMatchSku = String(m.sku || '').trim().toUpperCase();
        const row = batchRows.find(
          (r) => String(r.extractedSku || `ROW_${r.originalLineIndex}`).trim().toUpperCase() === normMatchSku
        );
        if (!row) continue;

        const rawCandId = String(m.candidateId || '').trim();
        const normCandUpc = cleanCatalogSku(rawCandId).toUpperCase();
        const dbItem = rawCandId
          ? allItems.find(
              (i: any) =>
                i.$id === rawCandId ||
                (normCandUpc && cleanCatalogSku(i.upc).toUpperCase() === normCandUpc)
            )
          : null;

        if (m.action === 'create_new' || !rawCandId || !dbItem || Number(m.confidence || 0) < 50) {
          row.aiEvaluated = true;
          row.aiMatched = false;
          row.aiReason = m.reason || 'Classified as New Booth Item (no matching inventory item)';
          row.stagedCandidate = null;
          row.selectedForApproval = false;
          newBoothCount++;
          continue;
        }

        const isLot = m.action === 'split_lot' || isParentLotCandidate(dbItem);
        const estPieces = Math.max(
          1,
          Number(m.estimatedLotPieces || extractEstimatedLotPieceCount(dbItem) || 1)
        );
        const lotCost = Number(dbItem.cost ?? 0);
        const unitCostShare = isLot ? Number((lotCost / estPieces).toFixed(2)) : lotCost;
        const rowPrice = Number(row.listedPrice || 0);
        const dbPrice = Number(dbItem.resalePrice || 0);
        const priceDiff = rowPrice > 0 && dbPrice > 0 ? Math.abs(dbPrice - rowPrice) : null;
        const conf = Math.min(99, Math.max(50, Number(m.confidence || 76)));

        // CONFIDENCE FIRST (NO BLIND WRITES): Override row.stagedCandidate & Match Drawer #1 candidate!
        row.aiEvaluated = true;
        row.aiReason = m.reason || (isLot ? 'Multi-Piece Lot Split' : 'Semantic Title Match');
        row.stagedCandidate = {
          item: dbItem,
          score: conf,
          confidence: conf,
          reasons: [
            `✨ AI: ${row.aiReason}`,
          ],
          priceDiff,
          isExactPrice: priceDiff !== null && priceDiff < 0.05,
          isClosePrice: priceDiff !== null && priceDiff <= 5.01,
          isParentLot: isLot,
          estimatedLotCount: estPieces,
          unitCostShare,
          recommendedAction: isLot ? 'split_lot' : 'link',
        };
        row.selectedForApproval = conf >= 88;
        stagedCount++;
        if (isLot) lotSplitCount++;
      }

      // Trigger reactive table & drawer refresh after each batch
      syncRows.value = [...syncRows.value];
    }

    if (stagedCount > 0 || newBoothCount > 0) {
      addToast({
        type: 'success',
        message: `✨ AI Smart-Staged ${stagedCount} match${stagedCount === 1 ? '' : 'es'} (${lotSplitCount} Lot Split${lotSplitCount === 1 ? '' : 's'}) & flagged ${newBoothCount} New Booth Item${newBoothCount === 1 ? '' : 's'}!`,
      });
    } else {
      addToast({
        type: 'info',
        message: 'AI analyzed remaining items and classified them as ⚪ New Booth Items.',
      });
    }
  } catch (err: any) {
    console.error('AI Smart-Stager failed:', err);
    addToast({ type: 'error', message: 'AI Smart-Stage failed: ' + err.message });
  } finally {
    isAiMatching.value = false;
    aiMatchingProgressText.value = '';
    hideLoader();
  }
};

const quickAddRow = async (row: any) => {
  if (!team.value) return;
  row.isQuickAdding = true;
  try {
    const isSold = row.status === 'sold' || row.status === 'paid';
    const locName = currentLocation.value?.name || 'Memory Den';
    const cleanSku = cleanCatalogSku(row.extractedSku).toUpperCase();
    const isMd = /^0EJ/i.test(cleanSku) || /memory\s*den/i.test(locName) || selectedLocationId.value === MD_CANONICAL_WAREHOUSE_ID;
    const targetStorageCode = isMd ? 'MD' : (currentLocation.value?.code || locName || 'HG');
    const listedPrice = Number(row.listedPrice || row.netSoldPrice || 0);
    const netSoldPrice = Number(row.netSoldPrice || row.listedPrice || 0);
    
    // Partner Prefix Protection: force BB- on B&B rows, PDXGL- when toggled, or active org prefix
    const prefix = getRowEffectivePrefix(row);
    const partnerTag = prefix.replace(/[-_]$/, '');
    const isCustomPartner = partnerTag.toUpperCase() !== 'HUCK';
    const partnerNote = isCustomPartner ? ` | Partner: ${partnerTag}` : '';

    // Generate next UPC using partner-protected prefix (or BB-0EJ... for B&B items)
    const upc =
      partnerTag.toUpperCase() === 'BB' && cleanSku
        ? `BB-${cleanSku}`
        : (getNextUpc ? getNextUpc(prefix) : `${prefix}${Math.floor(1000 + Math.random() * 9000)}`);

    const doc = await withRetry(() => saveItemToInventory(
      {
        title: row.itemName || 'Unnamed Item',
        condition_notes: `Added from ${locName || 'Booth'} Sync. SKU: ${cleanSku || 'N/A'}${partnerNote}`
      },
      null,
      {
        title: row.itemName || 'Unnamed Item',
        status: isSold ? 'sold' : 'placed',
        locationSku: cleanSku || (isCustomPartner ? partnerTag : ''),
        cost: '0',
        resalePrice: String(listedPrice),
        soldPrice: isSold ? netSoldPrice : undefined,
        sellingLocations: locName ? [locName] : [],
        storageLocation: targetStorageCode,
        upc: upc
      },
      team.value?.$id || user.value?.$id || '',
      team.value?.$id ? 'team' : 'user'
    ));

    inventoryItems.value.unshift(doc);
    row.mappedItem = doc;
    row.extractedUpc = upc;
    row.expectedRcUpc = upc;
    row.isSavedToMd = true;
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
  const prefixList = availableOrgPrefixes.value.map(p => p.prefix);
  const currentIdx = prefixList.findIndex(p => current.startsWith(p));
  const nextIdx = (currentIdx + 1) % prefixList.length;
  const newPrefix = prefixList[nextIdx] || prefixList[0] || 'HUCK-';
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

  const label = onlySold ? `${unmapped.length} unmatched SOLD items` : `${unmapped.length} unmatched items`;

  const ok = await showCustomConfirm({
    title: `Create & Track ${label}?`,
    message: `This will auto-generate partner-protected barcodes ("${prefix}", "PDXGL-", or "BB-"), save items to inventory, and track all sales and revenue.`,
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
    const locName = currentLocation.value?.name || 'Memory Den';

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
        const cleanSku = cleanCatalogSku(row.extractedSku).toUpperCase();
        const isMd = /^0EJ/i.test(cleanSku) || /memory\s*den/i.test(locName) || selectedLocationId.value === MD_CANONICAL_WAREHOUSE_ID;
        const targetStorageCode = isMd ? 'MD' : (currentLocation.value?.code || locName || 'HG');
        const listedPrice = Number(row.listedPrice || row.netSoldPrice || 0);
        const netSoldPrice = Number(row.netSoldPrice || row.listedPrice || 0);
        const rowPrefix = getRowEffectivePrefix(row);
        const rowPartnerTag = rowPrefix.replace(/[-_]$/, '');
        const isRowCustomPartner = rowPartnerTag.toUpperCase() !== 'HUCK';
        const rowPartnerNote = isRowCustomPartner ? ` | Partner: ${rowPartnerTag}` : '';
        const upc =
          rowPartnerTag.toUpperCase() === 'BB' && cleanSku
            ? `BB-${cleanSku}`
            : (getNextUpc ? getNextUpc(rowPrefix) : `${rowPrefix}${Math.floor(1000 + Math.random() * 9000)}`);

        const doc = await withRetry(() => saveItemToInventory(
          {
            title: row.itemName || 'Unnamed Item',
            condition_notes: `Added from ${locName || 'Booth'} Sync. SKU: ${cleanSku || 'N/A'}${rowPartnerNote}`
          },
          null,
          {
            title: row.itemName || 'Unnamed Item',
            status: isSold ? 'sold' : 'placed',
            locationSku: cleanSku || (isRowCustomPartner ? rowPartnerTag : ''),
            cost: '0',
            resalePrice: String(listedPrice),
            soldPrice: isSold ? netSoldPrice : undefined,
            sellingLocations: locName ? [locName] : [],
            storageLocation: targetStorageCode,
            upc: upc
          },
          team.value?.$id || user.value?.$id || '',
          team.value?.$id ? 'team' : 'user'
        ));

        inventoryItems.value.unshift(doc);
        row.mappedItem = doc;
        row.extractedUpc = upc;
        row.expectedRcUpc = upc;
        row.isSavedToMd = true;
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
    let skippedRecorded = 0;
    const total = mappedRows.length;

    // Re-flag against the freshest sales ledger right before committing (whole file, so occurrence indices stay aligned)
    try {
      const existingForGuard = await salesApi.listSales(team.value.$id);
      flagAlreadyRecordedRows(syncRows.value, existingForGuard || [], syncRowAccessors);
    } catch (guardErr) {
      console.warn('[LocationSync] Idempotency pre-check failed:', guardErr);
    }

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

      let item = row.mappedItem;
      if (!item) continue;

      // ✅ Already Recorded (Skipped): never create a sale or decrement a multi-qty bin a second time
      if (!isCatalogExport.value && row.isAlreadyRecorded) {
        skippedRecorded++;
        continue;
      }
      const normSku = cleanCatalogSku(row.extractedSku || item.locationSku).toUpperCase();
      const binConfig = PREVERIFIED_MD_MULTI_QTY_BINS[normSku];
      const isMultiBin = Boolean(binConfig);
      const isTrapInStock = normSku === '0EJ0O0' || cleanCatalogSku(item.upc).toUpperCase() === 'HUCK-9458';
      const isSold = !isMultiBin && !isTrapInStock && (row.status === 'sold' || row.status === 'paid' || normSku === '0EJ0MU');
      const targetWarehouseId = currentLocation.value?.$id || MD_CANONICAL_WAREHOUSE_ID;

      // If this is a staged B&B (BB-) item not yet in resale_db.items, create it first with cost: 0
      if (item.isSubClient && (!item.$id || String(item.$id).startsWith('subclient_'))) {
        try {
          const bbUpc = item.upc || `BB-${normSku || Math.floor(1000 + Math.random() * 9000)}`;
          const bbStatus = isSold ? 'sold' : 'placed';
          const bbQty = isSold ? 1 : Math.max(1, Number(row.csvQty || 1));
          const createdBb = await withRetry(() => databases.createDocument(DB_ID, getCollectionId(), ID.unique(), {
            title: row.itemName || item.title || 'B&B Consignment Item',
            identity: row.itemName || item.title || 'B&B Consignment Item',
            upc: bbUpc,
            locationSku: normSku || undefined,
            storageLocation: 'MD',
            warehouseId: targetWarehouseId,
            status: bbStatus,
            quantity: bbQty,
            cost: 0,
            resalePrice: Number(row.listedPrice || row.netSoldPrice || 0),
            tenantId: team.value?.$id || 'huck',
          }));
          inventoryItems.value.unshift(createdBb);
          item = createdBb;
          row.mappedItem = createdBb;
          newItemsCreatedInSession.value++;
        } catch (bbErr) {
          console.warn('Could not auto-create B&B item during sync:', bbErr);
          continue;
        }
      }

      // Catalog & Stock-Level Sync (Products-*.csv): items only. NEVER create sales here (no Sale# / Sold Date in this file).
      if (isCatalogExport.value) {
        const catalogUpdate: any = {};
        if (!item.upc) {
          const effPrefix = getRowEffectivePrefix(row);
          const autoUpc = getNextUpc ? getNextUpc(effPrefix) : `${effPrefix}${Math.floor(1000 + Math.random() * 9000)}`;
          catalogUpdate.upc = autoUpc;
          item.upc = autoUpc;
        }
        if (normSku && item.locationSku !== normSku) catalogUpdate.locationSku = normSku;
        if (item.storageLocation !== 'MD') catalogUpdate.storageLocation = 'MD';
        if (item.warehouseId !== targetWarehouseId) catalogUpdate.warehouseId = targetWarehouseId;

        if (!isSold) {
          const targetQty = Math.max(1, Number(binConfig?.expectedRemainingQty || row.csvQty || 1));
          if (item.status !== 'placed') catalogUpdate.status = 'placed';
          if (Number(item.quantity ?? 1) !== targetQty) catalogUpdate.quantity = targetQty;
          if (row.listedPrice > 0 && Math.abs((Number(item.resalePrice) || 0) - row.listedPrice) > 0.01) {
            catalogUpdate.resalePrice = row.listedPrice;
          }
        } else {
          // Single item sold/paid in Products-*.csv (or 0EJ0MU override): mark status='sold' with quantity=1 (NEVER 0!)
          if (item.status !== 'sold') catalogUpdate.status = 'sold';
          if (Number(item.quantity ?? 1) !== 1) catalogUpdate.quantity = 1;
        }

        delete catalogUpdate.isMultiQty;
        if (Object.keys(catalogUpdate).length > 0) {
          try {
            await withRetry(() => updateInventoryItem(item.$id, catalogUpdate));
            Object.assign(item, catalogUpdate);
            count++;
          } catch (itemErr: any) {
            console.warn(`Could not update catalog item "${row.itemName}":`, itemErr);
          }
          await new Promise(r => setTimeout(r, 120));
        } else {
          count++;
        }
        continue;
      }

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

      if (isSold || isMultiBin) {
        const gross = Number(Number(row.listedPrice || row.netSoldPrice || 0).toFixed(2));
        const net = Number(Number(row.netSoldPrice || (gross * (1 - (commissionRate / 100)))).toFixed(2));
        const commFee = Math.max(0, Number((gross - net).toFixed(2)));
        const occNum = Math.max(1, Number((row as any).occurrenceIndex || 1));
        const formattedTicketRef = row.saleTicketId
          ? (occNum > 1 ? `Ticket #${row.saleTicketId} #${occNum}` : `Ticket #${row.saleTicketId}`)
          : (item.upc || row.extractedSku || `SYNC-${Date.now()}-${idx}`);
        const canonicalSoNumber = item.upc || cleanCatalogSku(row.extractedSku || item.locationSku) || `SO-${nextSoNum++}`;

        if (currentQty > 1 || isMultiBin) {
          // Multi-quantity Booth Bin: keep parent lot active at status='placed' (never create '(Sold Unit)' split children)
          const remainingQty = binConfig ? Math.max(1, binConfig.expectedRemainingQty) : Math.max(1, currentQty - 1);

          updateData.quantity = remainingQty;
          updateData.status = 'placed';
          updateData.storageLocation = 'MD';
          updateData.warehouseId = targetWarehouseId;

          try {
            await withRetry(() => salesApi.createSale({
              soNumber: canonicalSoNumber,
              warehouseId: targetWarehouseId || MD_CANONICAL_WAREHOUSE_ID,
              orderId: formattedTicketRef,
              saleDate: resolveSoldIso(row, item),
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

        } else {
          // Single unit item sold
          updateData.status = 'sold';
          updateData.quantity = 1;
          updateData.resalePrice = gross;
          updateData.soldPrice = net; // The exact amount made after fees!
          updateData.soldDate = resolveSoldIso(row, item);

          // Record official sale document in sales collection
          try {
            const saleDoc = await withRetry(() => salesApi.createSale({
              soNumber: canonicalSoNumber,
              warehouseId: targetWarehouseId || MD_CANONICAL_WAREHOUSE_ID,
              orderId: formattedTicketRef,
              saleDate: resolveSoldIso(row, item),
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
        // Sync updated list price if changed in Ricochet POS
        if (row.listedPrice > 0 && Math.abs((Number(item.resalePrice || item.price) || 0) - row.listedPrice) > 0.01) {
          updateData.resalePrice = row.listedPrice;
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

      const escapeCsv = (str: any) => {
        if (str === null || str === undefined) return '""';
        return `"${String(str).replace(/"/g, '""').replace(/\n/g, ' ')}"`;
      };

      if (upcIdx === -1) {
        newLines.push(`${rawCsvLines.value[0]},"UPC"`);
        for (let i = 1; i < rawCsvLines.value.length; i++) {
          const rowData = syncRows.value.find(r => r.originalLineIndex === i);
          const assignedUpc = rowData?.mappedItem?.upc || '';
          newLines.push(`${rawCsvLines.value[i]},${escapeCsv(assignedUpc)}`);
        }
      } else {
        newLines.push(rawCsvLines.value[0]);
        for (let i = 1; i < rawCsvLines.value.length; i++) {
          const cols = splitCsvLine(rawCsvLines.value[i]);
          const rowData = syncRows.value.find(r => r.originalLineIndex === i);
          if (rowData?.mappedItem?.upc) {
            cols[upcIdx] = rowData.mappedItem.upc;
          }
          newLines.push(cols.map(c => escapeCsv(c)).join(','));
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

    await syncLivePayloadToCloudEndpoint();
    addToast({ type: 'success', message: `Successfully synced ${count} items to ${locName}!${skippedRecorded > 0 ? ` (${skippedRecorded} already recorded, skipped)` : ''}` });
    resetSync();
    if (team.value) {
      await fetchInventory();
      await syncLivePayloadToCloudEndpoint();
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

const healZeroEj0CqParentLotIfNeeded = async () => {
  try {
    const allItems = Array.isArray(inventoryItems.value) ? inventoryItems.value : [];
    if (allItems.length === 0) return;

    const item0ej0cq = allItems.find(
      (i: any) => cleanCatalogSku(i?.locationSku || i?.sku).toUpperCase() === '0EJ0CQ'
    );
    const huck0790 = allItems.find(
      (i: any) => cleanCatalogSku(i?.upc).toUpperCase() === 'HUCK-0790'
    );
    const huck0467 = allItems.find(
      (i: any) => cleanCatalogSku(i?.upc).toUpperCase() === 'HUCK-0467'
    );

    if (!item0ej0cq || !huck0790) return;

    const currentParentId = String(item0ej0cq.parentLotId || '').trim();
    const notesStr = String(item0ej0cq.conditionNotes || '');
    const isLinkedTo0467 =
      (huck0467 && currentParentId === huck0467.$id) ||
      /HUCK-0467/i.test(notesStr);

    if (isLinkedTo0467 && currentParentId !== huck0790.$id) {
      const pieceCount = Math.max(2, extractEstimatedLotPieceCount(huck0790) || 5);
      const lotCost = Number(huck0790.cost ?? 0);
      const unitCostShare = Number((lotCost / pieceCount).toFixed(2));
      const updatedNotes = `✂️ Split 1/${pieceCount} from Parent Lot HUCK-0790 ("${huck0790.title}") • Proportional Cost: $${unitCostShare.toFixed(2)} • Booth SKU: 0EJ0CQ`;

      const patchPayload: any = {
        parentLotId: huck0790.$id,
        cost: unitCostShare,
        conditionNotes: updatedNotes,
      };
      if (huck0790.purchaseId) patchPayload.purchaseId = huck0790.purchaseId;
      if (huck0790.orderId) patchPayload.orderId = huck0790.orderId;

      await updateInventoryItem(item0ej0cq.$id, patchPayload);
      Object.assign(item0ej0cq, patchPayload);
      addToast({
        type: 'info',
        message: `✅ Updated 0EJ0CQ ("${item0ej0cq.title}") parentLotId from HUCK-0467 ➔ HUCK-0790 ($${unitCostShare.toFixed(2)} cost share)!`,
      });
    }
  } catch (e) {
    console.warn('[LocationSyncView] 0EJ0CQ parent lot check skipped:', e);
  }
};

const loadData = async () => {
  if (!team.value) return;
  try {
    locations.value = await warehousesApi.listWarehouses(team.value.$id);
    await fetchInventory(team.value.$id);
    void healZeroEj0CqParentLotIfNeeded();

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

    // Default to Memory Den if available, otherwise first location
    if (!selectedLocationId.value && locations.value.length > 0) {
      const memDen = locations.value.find(l => l.name.toLowerCase().includes('memory') || l.name.toLowerCase().includes('den'));
      selectedLocationId.value = memDen ? memDen.$id : locations.value[0].$id;
    }

    refreshSyncHistory();
  } catch (err) {
    console.error("Failed to load locations:", err);
  }
};

let unsubscribeMdRealtime: (() => void) | null = null;

onMounted(() => {
  loadData();
  void fetchMdVerifyReport(false);
  if (typeof window !== 'undefined') {
    window.addEventListener('message', (ev) => {
      if (ev.data && ev.data.type === 'RC_MD_VERIFY_REPORT' && ev.data.report) {
        mdVerifyReport.value = ev.data.report;
        addToast({
          type: 'success',
          message: `📡 Received Live Memory Den Verification Report (${ev.data.report.summary?.verifiedMatch || 0} Verified)!`,
        });
      }
    });

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        rcSyncChannel = new BroadcastChannel('resale_command_sync');
        rcSyncChannel.onmessage = (ev) => {
          if (ev?.data?.type === 'RC_MD_VERIFY_REPORT' && ev.data.report) {
            mdVerifyReport.value = ev.data.report;
            addToast({
              type: 'success',
              message: `📡 Auto-Refreshed Live Memory Den Verification Report (${ev.data.report.summary?.verifiedMatch || 0} Verified)!`,
            });
          }
        };
      }
    } catch {}

    try {
      unsubscribeMdRealtime = client.subscribe(
        `databases.${DB_ID}.collections.manifests.documents.md_verify_report_latest`,
        (response: any) => {
          const doc = response?.payload;
          if (doc?.itemsSnapshot) {
            try {
              const parsed = typeof doc.itemsSnapshot === 'string' ? JSON.parse(doc.itemsSnapshot) : doc.itemsSnapshot;
              if (parsed && parsed.summary && Array.isArray(parsed.rows)) {
                const isNewer = !mdVerifyReport.value || mdVerifyReport.value.timestamp !== parsed.timestamp;
                mdVerifyReport.value = parsed;
                if (isNewer) {
                  addToast({
                    type: 'success',
                    message: `📡 Live Appwrite Realtime: Memory Den Verification Report updated (${parsed.summary.verifiedMatch || 0} Verified)!`,
                  });
                }
              }
            } catch {}
          } else {
            void fetchMdVerifyReport(false);
          }
        }
      );
    } catch (rtErr) {
      console.warn('[LocationSyncView] Appwrite Realtime subscription skipped:', rtErr);
    }

    window.addEventListener('focus', () => {
      if (!isCommitting.value && !isBulkQuickAdding.value) {
        void fetchMdVerifyReport(false);
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !isCommitting.value && !isBulkQuickAdding.value) {
        void fetchMdVerifyReport(false);
      }
    });
  }
});

onUnmounted(() => {
  try {
    if (unsubscribeMdRealtime) unsubscribeMdRealtime();
  } catch {}
  try {
    if (rcSyncChannel) {
      rcSyncChannel.close();
      rcSyncChannel = null;
    }
  } catch {}
});

watch(team, (newTeam) => {
  if (newTeam) {
    loadData();
  }
}, { immediate: true });
</script>

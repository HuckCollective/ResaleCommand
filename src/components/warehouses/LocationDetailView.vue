<template>
  <div class="space-y-6">
    <!-- Breadcrumb & Top Navigation -->
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-2 text-xs">
        <a href="/warehouse" class="btn btn-ghost btn-xs gap-1 opacity-70 hover:opacity-100 font-bold px-1.5">
          <Icon icon="solar:arrow-left-linear" class="w-4 h-4" />
          <span>Locations &amp; Warehouses</span>
        </a>
        <span class="opacity-30">/</span>
        <span class="font-bold text-base-content truncate">{{ warehouse?.name || 'Location' }}</span>
      </div>

      <div class="flex items-center gap-2">
        <button 
          type="button" 
          @click="openLocationStagingTray" 
          class="btn btn-sm btn-outline border-base-300 gap-1.5 font-bold shadow-xs"
          title="Open Outbound Location Manifest Tray"
        >
          <Icon icon="solar:box-minimalistic-bold" class="w-4 h-4 text-primary" />
          <span>Staging Tray</span>
          <span v-if="activeDraft && (activeDraft.itemCount || activeDraftItems.length)" class="badge badge-xs badge-secondary font-mono font-bold">
            {{ activeDraft.itemCount || activeDraftItems.length }}
          </span>
        </button>

        <a 
          v-if="warehouse" 
          :href="'/warehouse/sync?location=' + encodeURIComponent(warehouse.name)" 
          class="btn btn-sm btn-secondary gap-1.5 font-bold shadow-xs"
        >
          <Icon icon="solar:round-transfer-horizontal-bold-duotone" class="w-4 h-4" />
          <span>Sales Sync Hub</span>
        </a>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center p-16">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- Error State -->
    <div v-else-if="error || !warehouse" class="alert alert-error">
      <Icon icon="solar:danger-circle-bold" class="w-6 h-6 shrink-0" />
      <span>{{ error || 'Location not found.' }}</span>
      <a href="/warehouse" class="btn btn-xs btn-ghost ml-auto font-bold">Back to Locations</a>
    </div>

    <!-- Main Location Cockpit -->
    <div v-else class="space-y-6">
      <!-- Location Identity Hero Banner -->
      <div class="card bg-base-100 border border-base-200 shadow-md p-5 sm:p-6 rounded-3xl">
        <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div class="flex items-center gap-2.5 flex-wrap">
              <h1 class="text-2xl sm:text-3xl font-black tracking-tight text-base-content">{{ warehouse.name }}</h1>
              <span v-if="warehouse.code" class="badge badge-primary font-mono font-black tracking-wider text-xs px-2.5 py-1">{{ warehouse.code }}</span>
              <span class="badge font-bold text-xs" :class="warehouse.type === 'Online' ? 'badge-info' : warehouse.type === 'Warehouse' ? 'badge-neutral' : 'badge-secondary'">
                {{ warehouse.type }}
              </span>
            </div>
            <p v-if="warehouse.categories" class="text-xs opacity-70 mt-1 flex items-center gap-1.5 flex-wrap">
              <span class="font-bold">Niches:</span>
              <span v-for="(cat, cIdx) in warehouse.categories.split(',')" :key="cIdx" class="badge badge-xs badge-outline">
                {{ cat.trim() }}
              </span>
            </p>
          </div>

          <!-- Quick Telemetry Stats Strip -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full lg:w-auto">
            <div class="bg-base-200/70 p-2.5 rounded-2xl border border-base-300/70 text-center min-w-[110px]">
              <div class="text-[10px] uppercase font-bold opacity-60">In-Stock Stock</div>
              <div class="font-mono font-black text-sm text-primary">{{ inStockItems.length }} items</div>
              <div class="text-[10px] opacity-60 font-mono">${{ inStockValue.toFixed(2) }}</div>
            </div>
            <div class="bg-base-200/70 p-2.5 rounded-2xl border border-base-300/70 text-center min-w-[110px]">
              <div class="text-[10px] uppercase font-bold opacity-60">POS Synced</div>
              <div class="font-mono font-black text-sm text-success">{{ syncedItemsCount }} synced</div>
              <div class="text-[10px] opacity-60 font-mono">{{ pendingExportCount }} pending</div>
            </div>
            <div class="bg-base-200/70 p-2.5 rounded-2xl border border-base-300/70 text-center min-w-[110px]">
              <div class="text-[10px] uppercase font-bold opacity-60">Commission</div>
              <div class="font-mono font-black text-sm text-warning">{{ warehouse.commissionRate ? warehouse.commissionRate + '%' : '0%' }}</div>
              <div class="text-[10px] opacity-60 font-mono">per sale</div>
            </div>
            <div class="bg-base-200/70 p-2.5 rounded-2xl border border-base-300/70 text-center min-w-[110px]">
              <div class="text-[10px] uppercase font-bold opacity-60">Monthly Rent</div>
              <div class="font-mono font-black text-sm text-secondary">${{ (warehouse.monthlyRent || 0).toFixed(2) }}</div>
              <div class="text-[10px] opacity-60 font-mono">booth fee</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Navigation Tabs (Drops & Manifests vs In-Stock Catalog vs Settings) -->
      <div class="tabs tabs-bordered font-bold text-sm border-b border-base-300">
        <a 
          class="tab gap-2 pb-3"
          :class="{'tab-active !border-primary text-primary': activeTab === 'manifests'}"
          @click="activeTab = 'manifests'"
        >
          <Icon icon="solar:box-minimalistic-bold" class="w-4 h-4" />
          <span>Outbound Drops &amp; Manifests</span>
          <span v-if="locationManifests.length > 0" class="badge badge-xs font-mono font-bold" :class="activeTab === 'manifests' ? 'badge-primary text-primary-content' : 'badge-neutral'">
            {{ locationManifests.length }}
          </span>
        </a>

        <a 
          class="tab gap-2 pb-3"
          :class="{'tab-active !border-primary text-primary': activeTab === 'catalog'}"
          @click="activeTab = 'catalog'"
        >
          <Icon icon="solar:tag-bold" class="w-4 h-4" />
          <span>In-Stock Catalog</span>
          <span class="badge badge-xs font-mono font-bold" :class="activeTab === 'catalog' ? 'badge-primary text-primary-content' : 'badge-neutral'">
            {{ inStockItems.length }}
          </span>
        </a>

        <a 
          class="tab gap-2 pb-3"
          :class="{'tab-active !border-primary text-primary': activeTab === 'settings'}"
          @click="activeTab = 'settings'"
        >
          <Icon icon="solar:settings-bold" class="w-4 h-4" />
          <span>Booth Settings &amp; Economics</span>
        </a>
      </div>

      <!-- ========================================================================= -->
      <!-- TAB 1: OUTBOUND DROPS & MANIFESTS HUB                                     -->
      <!-- ========================================================================= -->
      <div v-if="activeTab === 'manifests'" class="space-y-6">

        <!-- 1. Active / Paused Draft Drop -->
        <div class="card bg-base-100 border border-base-200 shadow-md p-5 sm:p-6 rounded-3xl space-y-4">
          <div class="flex items-center justify-between gap-3 flex-wrap border-b border-base-200/60 pb-3">
            <div class="flex items-center gap-2">
              <div class="w-9 h-9 rounded-2xl bg-warning/15 text-warning flex items-center justify-center shrink-0">
                <Icon icon="solar:clock-circle-bold" class="w-5 h-5" />
              </div>
              <div>
                <h3 class="font-black text-base sm:text-lg">Active Drop Draft</h3>
                <p class="text-xs opacity-60">Staged inventory preparing for delivery to {{ warehouse.name }}</p>
              </div>
            </div>

            <!-- Header Actions for Draft -->
            <div v-if="activeDraft" class="flex items-center gap-2">
              <button 
                v-if="activeDraft.status === 'draft'"
                type="button" 
                @click="pauseActiveManifest" 
                class="btn btn-xs btn-outline border-warning text-warning hover:bg-warning/20 font-bold gap-1"
                title="Pause this drop"
              >
                <Icon icon="solar:pause-circle-bold" class="w-3.5 h-3.5" />
                <span>Pause</span>
              </button>
              <button 
                v-else-if="activeDraft.status === 'paused'"
                type="button" 
                @click="resumeManifest(activeDraft.$id)" 
                class="btn btn-xs btn-warning font-bold gap-1"
                title="Resume this drop"
              >
                <Icon icon="solar:play-circle-bold" class="w-3.5 h-3.5" />
                <span>Resume</span>
              </button>

              <button 
                type="button" 
                @click="openDraftInTray(activeDraft)" 
                class="btn btn-xs btn-primary font-bold gap-1 shadow-xs"
              >
                <Icon icon="solar:arrow-right-up-linear" class="w-3.5 h-3.5" />
                <span>Open in Tray</span>
              </button>
            </div>
          </div>

          <!-- Active Draft Content -->
          <div v-if="activeDraft" class="space-y-4">
            <!-- Summary Banner -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-base-200/60 p-3 rounded-2xl border border-base-300/70 text-center text-xs">
              <div>
                <span class="opacity-60 text-[10px] uppercase font-bold block">Drop Name</span>
                <span class="font-bold text-base-content truncate block">{{ activeDraft.name }}</span>
              </div>
              <div>
                <span class="opacity-60 text-[10px] uppercase font-bold block">Total Items</span>
                <span class="font-mono font-black text-primary text-sm">{{ activeDraft.itemCount }} items</span>
              </div>
              <div>
                <span class="opacity-60 text-[10px] uppercase font-bold block">Tag Retail Value</span>
                <span class="font-mono font-black text-secondary text-sm">${{ activeDraft.totalRetail.toFixed(2) }}</span>
              </div>
              <div>
                <span class="opacity-60 text-[10px] uppercase font-bold block">Est. Net (after comm.)</span>
                <span class="font-mono font-black text-success text-sm">${{ activeDraft.estimatedNet.toFixed(2) }}</span>
              </div>
            </div>

            <!-- Staged Items List with Links to Inventory -->
            <div v-if="activeDraftItems.length > 0" class="space-y-2">
              <div class="text-xs font-bold opacity-75 flex items-center justify-between">
                <span>Staged Items ({{ activeDraftItems.length }}):</span>
                <span class="text-[11px] opacity-60">Click item to view in catalog</span>
              </div>
              
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
                <div 
                  v-for="item in activeDraftItems" 
                  :key="item.$id"
                  @click="openItemEditor(item)"
                  class="flex items-center gap-2.5 p-2 rounded-xl bg-base-200/50 border border-base-300 hover:border-primary/40 hover:bg-base-200/80 transition-all group cursor-pointer"
                  title="Click to view full specs & edit in ItemDrawer"
                >
                  <div class="w-10 h-10 rounded-lg bg-base-300 overflow-hidden shrink-0">
                    <img v-if="item.imageId" :src="getItemPhotoUrl(item.imageId)" class="w-full h-full object-cover" />
                    <Icon v-else icon="solar:tag-bold" class="w-5 h-5 m-2.5 opacity-40" />
                  </div>
                  <div class="min-w-0 flex-1 text-xs">
                    <span class="font-bold truncate block group-hover:text-primary transition-colors">
                      {{ item.title }}
                    </span>
                    <div class="text-[10px] font-mono opacity-70 flex items-center gap-1.5">
                      <span v-if="item.upc" class="text-primary font-bold">{{ item.upc }}</span>
                      <span>•</span>
                      <span class="text-secondary font-bold">${{ (Number(item.price || item.boutiquePrice || item.resalePrice) || 0).toFixed(2) }}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    <button 
                      type="button" 
                      class="btn btn-ghost btn-xs btn-circle opacity-0 group-hover:opacity-100 text-primary hover:bg-primary/15 transition-opacity"
                      title="Edit item specs"
                      @click.stop="openItemEditor(item)"
                    >
                      <Icon icon="solar:pen-bold" class="w-3 h-3" />
                    </button>
                    <button 
                      type="button" 
                      class="btn btn-ghost btn-xs btn-circle opacity-0 group-hover:opacity-100 text-error hover:bg-error/15 transition-opacity"
                      title="Remove from drop"
                      @click.stop="handleRemoveItemFromDraft(item.$id)"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Drop Primary Actions: Verify Stock & Export CSV -->
            <div class="pt-3 flex items-center justify-between gap-2 border-t border-base-200 flex-wrap">
              <div class="text-xs opacity-60 font-mono">
                {{ activeDraftItems.length }} items staged • Ready for stocking or POS export
              </div>
              <div class="flex items-center gap-2">
                <button 
                  type="button" 
                  @click="exportDraftCsv" 
                  class="btn btn-sm btn-outline border-base-300 hover:border-base-content/40 font-bold gap-1.5"
                  :disabled="activeDraftItems.length === 0"
                  title="Download clean CSV for Ricochet POS"
                >
                  <Icon icon="solar:file-download-bold" class="w-4 h-4 text-success" />
                  <span>Export POS CSV</span>
                </button>
                <button 
                  type="button" 
                  @click="placeAllDraftItems" 
                  class="btn btn-sm btn-success font-black text-success-content shadow-md gap-1.5"
                  :disabled="activeDraftItems.length === 0 || isPlacingBatch"
                  title="Verify Stock: marks all items PLACED at this location"
                >
                  <span v-if="isPlacingBatch" class="loading loading-spinner loading-xs"></span>
                  <template v-else>
                    <Icon icon="solar:check-circle-bold" class="w-4 h-4" />
                    <span>Verify Stock (${{ activeDraft.totalRetail.toFixed(2) }})</span>
                  </template>
                </button>
              </div>
            </div>
          </div>

          <!-- Empty Active Draft State -->
          <div v-else class="text-center py-8 bg-base-200/30 rounded-2xl border border-dashed border-base-300 space-y-2">
            <Icon icon="solar:box-minimalistic-bold" class="w-8 h-8 opacity-40 mx-auto text-primary" />
            <div class="font-bold text-sm">No Active Drop Draft</div>
            <p class="text-xs opacity-60 max-w-sm mx-auto">Stage items from Inventory to build a drop manifest, or create a new draft drop here.</p>
            <div class="pt-2">
              <button 
                type="button" 
                class="btn btn-sm btn-primary font-bold gap-1"
                @click="handleCreateNewDraft"
              >
                <Icon icon="solar:add-circle-bold" class="w-4 h-4" />
                <span>+ Create New Drop for {{ warehouse.name }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 2. Exported Drops awaiting In-Store Verification (PO Style Receiving) -->
        <div v-if="exportedDrops.length > 0" class="space-y-4">
          <div class="flex items-center gap-2">
            <Icon icon="solar:checklist-bold" class="w-5 h-5 text-info" />
            <h3 class="font-black text-base sm:text-lg">Exported Drops • Ready for In-Store Shelf Placement</h3>
          </div>

          <div v-for="drop in exportedDrops" :key="drop.$id" class="card bg-base-100 border border-info/30 shadow-md p-5 sm:p-6 rounded-3xl space-y-4">
            <!-- Drop Header -->
            <div class="flex items-center justify-between gap-3 flex-wrap border-b border-base-200/60 pb-3">
              <div>
                <div class="flex items-center gap-2">
                  <h4 class="font-black text-base">{{ drop.name }}</h4>
                  <span class="badge badge-xs badge-info font-mono font-bold">Exported to POS</span>
                </div>
                <div class="text-xs opacity-60 font-mono mt-0.5">
                  Exported {{ formatDate(drop.exportedAt) }} • {{ drop.itemCount }} total items • ${{ drop.totalRetail.toFixed(2) }} Tag Retail
                </div>
              </div>

              <!-- Placement Progress Metric -->
              <div class="flex items-center gap-3">
                <div class="text-right">
                  <div class="font-black text-xs font-mono text-success">
                    {{ (drop.placedItemIds || []).length }} of {{ drop.itemIds.length }} Placed
                  </div>
                  <div class="text-[10px] opacity-60 font-mono">
                    {{ Math.round(((drop.placedItemIds || []).length / Math.max(1, drop.itemIds.length)) * 100) }}% complete
                  </div>
                </div>

                <button 
                  type="button" 
                  class="btn btn-xs btn-outline border-success text-success hover:bg-success/20 font-bold gap-1"
                  @click="placeAllRemainingItems(drop)"
                  :disabled="isPlacingBatch"
                >
                  <Icon icon="solar:check-circle-bold" class="w-3.5 h-3.5" />
                  <span>Place All Remaining</span>
                </button>
              </div>
            </div>

            <!-- In-Store Item-by-Item Receiving Checklist (PO Style) -->
            <div class="space-y-2">
              <div class="flex items-center justify-between text-xs opacity-75">
                <span class="font-bold">Check off items as you place them on physical booth shelves:</span>
                <span class="text-[11px] opacity-60">Tap item to toggle placed status</span>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
                <div 
                  v-for="itemId in drop.itemIds" 
                  :key="itemId"
                  class="flex items-center gap-3 p-2.5 rounded-2xl border transition-all cursor-pointer select-none"
                  :class="isItemPlaced(drop, itemId) ? 'bg-success/10 border-success/40' : 'bg-base-200/50 border-base-300 hover:border-primary/40'"
                  @click="toggleItemPlacement(drop, itemId)"
                >
                  <input 
                    type="checkbox" 
                    :checked="isItemPlaced(drop, itemId)"
                    class="checkbox checkbox-sm checkbox-success"
                    @click.stop="toggleItemPlacement(drop, itemId)"
                  />
                  <div class="w-10 h-10 rounded-xl bg-base-300 overflow-hidden shrink-0">
                    <img v-if="getItemRecord(drop, itemId)?.imageId" :src="getItemPhotoUrl(getItemRecord(drop, itemId)?.imageId)" class="w-full h-full object-cover" />
                    <Icon v-else icon="solar:tag-bold" class="w-5 h-5 m-2.5 opacity-40" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="font-bold text-xs truncate hover:text-primary transition-colors cursor-pointer" :class="{'line-through opacity-70': isItemPlaced(drop, itemId)}" @click.stop="openItemEditor(getItemRecord(drop, itemId))" title="Click to view & edit in ItemDrawer">
                      {{ getItemRecord(drop, itemId)?.title || 'Item ' + itemId }}
                    </div>
                    <div class="text-[10px] font-mono opacity-70 flex items-center gap-1.5">
                      <span v-if="getItemRecord(drop, itemId)?.upc" class="font-bold text-primary">{{ getItemRecord(drop, itemId)?.upc }}</span>
                      <span>•</span>
                      <span class="text-secondary font-bold">${{ (Number(getItemRecord(drop, itemId)?.price || getItemRecord(drop, itemId)?.boutiquePrice) || 0).toFixed(2) }}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <span v-if="isItemPlaced(drop, itemId)" class="badge badge-xs badge-success text-success-content font-bold">Placed</span>
                    <button 
                      type="button" 
                      class="btn btn-ghost btn-xs btn-circle text-base-content/50 hover:text-primary hover:bg-base-300 transition-colors"
                      title="Inspect & edit item specs in ItemDrawer"
                      @click.stop="openItemEditor(getItemRecord(drop, itemId))"
                    >
                      <Icon icon="solar:pen-bold" class="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer: Finalize Drop Action -->
            <div class="pt-3 border-t border-base-200 flex items-center justify-between gap-2 flex-wrap">
              <span class="text-xs opacity-60">
                When all items are placed in the booth, finalize this drop to archive it.
              </span>
              <button 
                type="button" 
                class="btn btn-sm btn-success font-black text-success-content shadow-md gap-1.5"
                @click="finalizeDrop(drop)"
              >
                <Icon icon="solar:check-circle-bold" class="w-4 h-4" />
                <span>Finish &amp; Finalize Drop Placement</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 3. Placed Drops Archive History -->
        <div v-if="placedDrops.length > 0" class="card bg-base-100 border border-base-200 shadow-md p-5 rounded-3xl space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="font-black text-base flex items-center gap-2">
              <Icon icon="solar:history-bold" class="w-4 h-4 text-primary" />
              <span>Past Placed Drops Archive ({{ placedDrops.length }})</span>
            </h3>
          </div>

          <div class="divide-y divide-base-200">
            <div v-for="pd in placedDrops" :key="pd.$id" class="py-2.5 flex items-center justify-between text-xs gap-3">
              <div>
                <span class="font-bold text-base-content block">{{ pd.name }}</span>
                <span class="text-[11px] opacity-60 font-mono">Delivered {{ formatDate(pd.placedAt || pd.$updatedAt) }}</span>
              </div>
              <div class="text-right font-mono">
                <span class="badge badge-sm badge-neutral font-bold">{{ pd.itemCount }} items</span>
                <span class="font-black text-secondary ml-2">${{ pd.totalRetail.toFixed(2) }}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- ========================================================================= -->
      <!-- TAB 2: IN-STOCK CATALOG                                                  -->
      <!-- ========================================================================= -->
      <div v-if="activeTab === 'catalog'" class="space-y-4">
        <!-- Catalog Search & Filter Bar -->
        <div class="flex items-center justify-between gap-3 flex-wrap bg-base-100 p-4 rounded-2xl border border-base-200 shadow-xs">
          <div class="relative flex-1 min-w-[200px]">
            <Icon icon="solar:magnifer-linear" class="absolute left-3 top-2.5 w-4 h-4 opacity-50" />
            <input 
              v-model="catalogSearch" 
              type="text" 
              class="input input-sm input-bordered pl-9 w-full bg-base-200 focus:bg-base-100" 
              placeholder="Search items currently in this booth..."
            />
          </div>
          <div class="flex items-center gap-2 text-xs font-mono opacity-70">
            <span>Showing {{ filteredCatalogItems.length }} of {{ inStockItems.length }} items</span>
          </div>
        </div>

        <!-- Catalog Table -->
        <div class="card bg-base-100 border border-base-200 shadow-md rounded-3xl overflow-hidden">
          <div class="overflow-x-auto">
            <table class="table table-sm">
              <thead class="bg-base-200/60 text-xs uppercase font-bold text-base-content/70">
                <tr>
                  <th>Item</th>
                  <th>UPC / SKU</th>
                  <th>Category</th>
                  <th class="text-right">Price</th>
                  <th class="text-center">POS Sync</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in filteredCatalogItems" :key="item.$id" class="hover:bg-base-200/40 transition-colors">
                  <td class="cursor-pointer" @click="openItemEditor(item)" title="Click to view & edit in ItemDrawer">
                    <div class="flex items-center gap-2.5">
                      <div class="w-9 h-9 rounded-lg bg-base-300 overflow-hidden shrink-0">
                        <img v-if="item.imageId" :src="getItemPhotoUrl(item.imageId)" class="w-full h-full object-cover" />
                        <Icon v-else icon="solar:tag-bold" class="w-4 h-4 m-2.5 opacity-40" />
                      </div>
                      <span class="font-bold text-xs truncate max-w-xs block hover:text-primary transition-colors">{{ item.title }}</span>
                    </div>
                  </td>
                  <td class="font-mono text-xs font-bold text-primary cursor-pointer" @click="openItemEditor(item)">{{ item.upc || item.locationSku || '—' }}</td>
                  <td class="text-xs opacity-75">{{ item.category || 'General' }}</td>
                  <td class="font-mono font-bold text-secondary text-right text-xs">
                    ${{ (Number(item.price || item.boutiquePrice || item.resalePrice) || 0).toFixed(2) }}
                  </td>
                  <td class="text-center">
                    <span v-if="item.ricochetSynced" class="badge badge-xs badge-success gap-1 font-bold">
                      <Icon icon="solar:check-circle-bold" class="w-3 h-3" /> Synced
                    </span>
                    <span v-else class="badge badge-xs badge-warning gap-1 font-bold">
                      <Icon icon="solar:clock-circle-bold" class="w-3 h-3" /> Pending
                    </span>
                  </td>
                  <td class="text-right">
                    <button 
                      type="button"
                      @click="openItemEditor(item)"
                      class="btn btn-ghost btn-xs text-primary font-bold gap-1"
                      title="Open ItemDrawer"
                    >
                      <Icon icon="solar:pen-bold" class="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                  </td>
                </tr>
                <tr v-if="filteredCatalogItems.length === 0">
                  <td colspan="6" class="text-center py-12 opacity-60 text-xs">
                    No items found matching criteria in this location.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ========================================================================= -->
      <!-- TAB 3: LOCATION SETTINGS & BOOTH CONFIGURATION                           -->
      <!-- ========================================================================= -->
      <div v-if="activeTab === 'settings'" class="card bg-base-100 border border-base-200 shadow-md p-6 rounded-3xl max-w-2xl">
        <h3 class="text-xl font-bold mb-4 flex items-center gap-2">
          <Icon icon="solar:settings-bold" class="w-5 h-5 text-primary" />
          <span>Location Configuration &amp; Economics</span>
        </h3>

        <form @submit.prevent="saveLocationSettings" class="space-y-4">
          <div class="grid grid-cols-3 gap-3">
            <div class="form-control col-span-2">
              <label class="label"><span class="label-text font-bold">Location Name</span></label>
              <input type="text" v-model="editForm.name" required class="input input-bordered w-full bg-base-200 focus:bg-base-100" />
            </div>
            <div class="form-control col-span-1">
              <label class="label"><span class="label-text font-bold">Code</span></label>
              <input type="text" v-model="editForm.code" maxlength="6" class="input input-bordered w-full bg-base-200 focus:bg-base-100 font-mono font-bold uppercase" />
            </div>
          </div>

          <div class="form-control w-full">
            <label class="label"><span class="label-text font-bold">Location Type</span></label>
            <select v-model="editForm.type" required class="select select-bordered w-full bg-base-200">
              <option value="Consignment Booth">Consignment Booth (e.g. Memory Den, Dusty Tiger)</option>
              <option value="On-Site">On-Site (Retail / Booth)</option>
              <option value="Online">Online Marketplace</option>
              <option value="Warehouse">Warehouse (Storage Only)</option>
            </select>
          </div>

          <div class="form-control w-full">
            <label class="label">
              <span class="label-text font-bold">Niche &amp; Allowed Categories</span>
              <span class="label-text-alt text-[10px] opacity-70">Used by AI Scout when sourcing for this booth</span>
            </label>
            <input type="text" v-model="editForm.categories" class="input input-bordered w-full bg-base-200 focus:bg-base-100" placeholder="e.g. Vintage, Collectibles, Games" />
            <label class="label pt-1 pb-0"><span class="label-text-alt text-[10px] opacity-60">Separate with commas</span></label>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="form-control w-full">
              <label class="label"><span class="label-text font-bold">Commission Rate (%)</span></label>
              <input type="number" step="0.01" min="0" max="100" v-model.number="editForm.commissionRate" class="input input-bordered w-full bg-base-200" />
            </div>
            <div class="form-control w-full">
              <label class="label"><span class="label-text font-bold">Monthly Rent ($)</span></label>
              <input type="number" step="0.01" min="0" v-model.number="editForm.monthlyRent" class="input input-bordered w-full bg-base-200" />
            </div>
          </div>

          <div class="pt-4 flex items-center justify-between border-t border-base-200">
            <button 
              type="button" 
              class="btn btn-sm btn-error btn-outline gap-1"
              @click="confirmDeleteLocation"
            >
              <Icon icon="solar:trash-bin-trash-linear" class="w-4 h-4" />
              <span>Delete Location</span>
            </button>

            <button type="submit" class="btn btn-sm btn-primary font-bold px-6" :disabled="savingSettings">
              <span v-if="savingSettings" class="loading loading-spinner loading-xs"></span>
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>

    </div>

    <!-- SHARED OUTBOUND LOCATION MANIFEST TRAY -->
    <LocationManifestTray 
      :isOpen="isManifestTrayOpen" 
      :locationId="warehouse?.code || locationId"
      :locationName="warehouse?.name"
      @toggle-tray="isManifestTrayOpen = false" 
      @close="isManifestTrayOpen = false"
      @drop-changed="loadManifests"
    />

    <!-- FULL ITEM DRAWER FOR INSPECTING & EDITING SPECS -->
    <ItemDrawer 
      v-if="editingItem" 
      :item="editingItem" 
      @close="editingItem = null" 
      @save="handleItemSaved" 
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, defineAsyncComponent } from 'vue';
import { Icon } from '@iconify/vue';
import { useAuth } from '../../composables/useAuth';
import { useInventory } from '../../composables/useInventory';
import { warehousesApi, type WarehouseDocument, matchesLocationFilter } from '../../lib/warehouses';
import { manifestsApi, type ManifestDocument } from '../../lib/manifests';
import { useManifest } from '../../composables/useManifest';
import LocationManifestTray from '../inventory/LocationManifestTray.vue';
import { getAssetUrl, updateInventoryItem } from '../../lib/inventory';
import { addToast } from '../../stores/toast';

const ItemDrawer = defineAsyncComponent(() => import('../common/ItemDrawer.vue'));

const editingItem = ref<any | null>(null);

const openItemEditor = (item: any) => {
  if (!item) return;
  editingItem.value = item;
};

const handleItemSaved = async (payload: any) => {
  const targetId = editingItem.value?.$id || editingItem.value?.id;
  if (targetId && payload) {
    try {
      await updateInventoryItem(targetId, payload);
      addToast({ type: 'success', message: 'Item updated successfully!' });
    } catch (err: any) {
      addToast({ type: 'error', message: `Save failed: ${err.message}` });
    }
  }
  editingItem.value = null;
  await loadManifests();
  fetchInventory(team.value?.$id);
};

const props = defineProps<{
  locationId: string;
}>();

const { currentTeam: team } = useAuth();
const { inventoryItems, fetchInventory } = useInventory();

const {
  activeManifest,
  stagedCount,
  isTrayOpen: isManifestTrayOpen,
  initActiveDraft,
  switchActiveManifest,
  pauseActiveManifest,
  resumeManifest,
  createNewDraft,
  removeFromManifest,
  exportManifestCsv,
  verifyPlacementItem,
  finalizeActivePlacement
} = useManifest();

const warehouse = ref<WarehouseDocument | null>(null);
const locationManifests = ref<ManifestDocument[]>([]);
const loading = ref(true);
const error = ref('');
const activeTab = ref<'manifests' | 'catalog' | 'settings'>('manifests');

// Settings Form State
const editForm = ref({
  name: '',
  code: '',
  type: 'Consignment Booth',
  commissionRate: 15,
  monthlyRent: 0,
  categories: ''
});
const savingSettings = ref(false);
const catalogSearch = ref('');
const isPlacingBatch = ref(false);

// Fetch Warehouse and Manifests
const loadLocationData = async () => {
  loading.value = true;
  error.value = '';
  try {
    const list = await warehousesApi.listWarehouses(team.value?.$id);
    const found = list.find(w => w.$id === props.locationId || (w.code && w.code.toLowerCase() === props.locationId.toLowerCase()));
    if (!found) {
      error.value = 'Location not found.';
      return;
    }
    warehouse.value = found;
    editForm.value = {
      name: found.name || '',
      code: found.code || '',
      type: found.type || 'Consignment Booth',
      commissionRate: found.commissionRate ?? 15,
      monthlyRent: found.monthlyRent ?? 0,
      categories: found.categories || found.niche || ''
    };

    // Load manifests for this location
    await loadManifests();
    if (activeDraft.value) {
      await switchActiveManifest(activeDraft.value.$id);
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load location data.';
  } finally {
    loading.value = false;
  }
};

const loadManifests = async () => {
  if (!warehouse.value) return;
  const tId = team.value?.$id;
  if (!tId) return;
  try {
    const all = await manifestsApi.listManifests(tId);
    const code = (warehouse.value.code || '').toLowerCase();
    const name = (warehouse.value.name || '').toLowerCase();

    locationManifests.value = all.filter(m => {
      const mLocId = (m.locationId || '').toLowerCase();
      const mLocName = (m.locationName || '').toLowerCase();
      return mLocId === code || mLocName === name || (code === 'md' && (mLocId.includes('memory') || mLocName.includes('memory')));
    });
  } catch (e) {
    console.warn('Could not load manifests:', e);
  }
};

// Computed Breakdown of Manifests
const activeDraft = computed(() => {
  return locationManifests.value.find(m => m.status === 'draft' || m.status === 'paused') || null;
});

const activeDraftItems = computed(() => {
  if (!activeDraft.value) return [];
  const ids = activeDraft.value.itemIds || [];
  const invMap = new Map(inventoryItems.value.map(i => [i.$id, i]));
  const snapMap = new Map((activeDraft.value.itemsSnapshot || []).map(s => [s.$id, s]));
  return ids.map(id => invMap.get(id) || snapMap.get(id) || { $id: id, title: 'Item ' + id });
});

const exportedDrops = computed(() => {
  return locationManifests.value.filter(m => m.status === 'exported');
});

const placedDrops = computed(() => {
  return locationManifests.value.filter(m => m.status === 'placed');
});

// Computed In-Stock Items at this Location
const inStockItems = computed(() => {
  if (!warehouse.value) return [];
  return inventoryItems.value.filter(item => matchesLocationFilter(item, warehouse.value!.name));
});

const inStockValue = computed(() => {
  return inStockItems.value.reduce((sum, item) => {
    return sum + (Number(item.price || item.boutiquePrice || item.resalePrice) || 0);
  }, 0);
});

const syncedItemsCount = computed(() => {
  return inStockItems.value.filter(i => i.ricochetSynced).length;
});

const pendingExportCount = computed(() => {
  return inStockItems.value.filter(i => !i.ricochetSynced).length;
});

const filteredCatalogItems = computed(() => {
  const q = catalogSearch.value.trim().toLowerCase();
  if (!q) return inStockItems.value;
  return inStockItems.value.filter(i => {
    return (i.title || '').toLowerCase().includes(q) ||
           (i.upc || '').toLowerCase().includes(q) ||
           (i.locationSku || '').toLowerCase().includes(q);
  });
});

// Item Helpers
const getItemRecord = (drop: ManifestDocument, itemId: string) => {
  const inv = inventoryItems.value.find(i => i.$id === itemId);
  if (inv) return inv;
  return (drop.itemsSnapshot || []).find(s => s.$id === itemId) || null;
};

const getItemPhotoUrl = (imageId?: string) => {
  if (!imageId) return '';
  return getAssetUrl(imageId);
};

const isItemPlaced = (drop: ManifestDocument, itemId: string) => {
  return (drop.placedItemIds || []).includes(itemId);
};

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return 'Recently';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Actions
const openLocationStagingTray = async () => {
  if (activeDraft.value) {
    await switchActiveManifest(activeDraft.value.$id);
  }
  isManifestTrayOpen.value = true;
};

const openDraftInTray = async (draft: ManifestDocument) => {
  await switchActiveManifest(draft.$id);
  isManifestTrayOpen.value = true;
};

const handleCreateNewDraft = async () => {
  if (!warehouse.value) return;
  const newDoc = await createNewDraft(
    `${warehouse.value.name} Drop - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    warehouse.value.code || 'MD',
    warehouse.value.name
  );
  if (newDoc) {
    await loadManifests();
    isManifestTrayOpen.value = true;
  }
};

const handleRemoveItemFromDraft = async (itemId: string) => {
  await removeFromManifest(itemId);
  await loadManifests();
};

const exportDraftCsv = async () => {
  await exportManifestCsv('ricochet');
  await loadManifests();
};

const placeAllDraftItems = async () => {
  if (!activeDraft.value || !warehouse.value || isPlacingBatch.value) return;
  isPlacingBatch.value = true;
  const targetLoc = warehouse.value.name;

  try {
    const result = await manifestsApi.deployManifest(activeDraft.value.$id, activeDraft.value.itemIds, targetLoc);
    addToast({
      type: 'success',
      message: `Verified & Placed ${result.updatedCount} items at ${targetLoc}! Status set to PLACED.`
    });
    await loadManifests();
    await fetchInventory(team.value?.$id);
  } catch (err: any) {
    addToast({ type: 'error', message: `Placement error: ${err.message}` });
  } finally {
    isPlacingBatch.value = false;
  }
};

// Item-by-Item Placement Toggle (PO Style)
const toggleItemPlacement = async (drop: ManifestDocument, itemId: string) => {
  if (!warehouse.value) return;
  const targetLoc = warehouse.value.name;
  const wasPlaced = isItemPlaced(drop, itemId);

  try {
    const updated = await verifyPlacementItem(drop.$id, itemId, targetLoc, wasPlaced);
    // Update local drop record
    const idx = locationManifests.value.findIndex(m => m.$id === drop.$id);
    if (idx !== -1) {
      locationManifests.value[idx] = updated;
    }
    // Refresh inventory in background
    fetchInventory(team.value?.$id);
  } catch (err: any) {
    addToast({ type: 'error', message: `Could not update placement: ${err.message}` });
  }
};

// Place All Remaining Items
const placeAllRemainingItems = async (drop: ManifestDocument) => {
  if (!warehouse.value || isPlacingBatch.value) return;
  isPlacingBatch.value = true;
  const targetLoc = warehouse.value.name;

  try {
    const result = await manifestsApi.deployManifest(drop.$id, drop.itemIds, targetLoc);
    addToast({
      type: 'success',
      message: `Placed all ${result.updatedCount} items at ${targetLoc}!`
    });
    await loadManifests();
    await fetchInventory(team.value?.$id);
  } catch (err: any) {
    addToast({ type: 'error', message: `Batch place error: ${err.message}` });
  } finally {
    isPlacingBatch.value = false;
  }
};

// Finalize Drop Placement
const finalizeDrop = async (drop: ManifestDocument) => {
  try {
    await finalizeActivePlacement(drop.$id);
    addToast({ type: 'success', message: `${drop.name} finalized and placed!` });
    await loadManifests();
    await fetchInventory(team.value?.$id);
  } catch (err: any) {
    addToast({ type: 'error', message: `Finalize error: ${err.message}` });
  }
};

// Save Settings Form
const saveLocationSettings = async () => {
  if (!warehouse.value || savingSettings.value) return;
  savingSettings.value = true;

  try {
    const updated = await warehousesApi.updateWarehouse(warehouse.value.$id, {
      name: editForm.value.name.trim(),
      code: editForm.value.code.trim().toUpperCase(),
      type: editForm.value.type,
      commissionRate: editForm.value.commissionRate,
      monthlyRent: editForm.value.monthlyRent,
      categories: editForm.value.categories.trim()
    });
    warehouse.value = updated;
    addToast({ type: 'success', message: 'Location settings saved!' });
  } catch (err: any) {
    addToast({ type: 'error', message: `Failed to save: ${err.message}` });
  } finally {
    savingSettings.value = false;
  }
};

const confirmDeleteLocation = async () => {
  if (!warehouse.value) return;
  if (!confirm(`Are you sure you want to delete ${warehouse.value.name}? This cannot be undone.`)) return;

  try {
    await warehousesApi.deleteWarehouse(warehouse.value.$id);
    addToast({ type: 'info', message: 'Location deleted.' });
    window.location.href = '/warehouse';
  } catch (err: any) {
    addToast({ type: 'error', message: `Delete failed: ${err.message}` });
  }
};

onMounted(() => {
  loadLocationData();
});

watch(team, () => {
  loadLocationData();
});
</script>

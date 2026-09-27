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
          :class="{'tab-active !border-primary text-primary': activeTab === 'expenses'}"
          @click="activeTab = 'expenses'"
        >
          <Icon icon="solar:wallet-money-bold" class="w-4 h-4" />
          <span>Rent &amp; Expenses</span>
          <span v-if="locationExpenses.length > 0" class="badge badge-xs font-mono font-bold" :class="activeTab === 'expenses' ? 'badge-primary text-primary-content' : 'badge-neutral'">
            {{ locationExpenses.length }}
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

        <!-- Unified Outbound Drops & Manifests Hub -->
        <div class="card bg-base-100 border border-base-200 shadow-md p-5 rounded-box space-y-4">
          <!-- Card Header & Actions -->
          <div class="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-base-200">
            <div>
              <h3 class="font-black text-base sm:text-lg flex items-center gap-2">
                <Icon icon="solar:box-minimalistic-bold" class="w-5 h-5 text-primary" />
                <span>Outbound Drops &amp; Manifests ({{ locationManifests.length }})</span>
              </h3>
              <p class="text-xs opacity-60">
                All drops staged, exported, and placed at {{ warehouse.name }}. Inspect items, export to POS, open in tray, or manage shipments.
              </p>
            </div>
            
            <div class="flex items-center gap-2">
              <button 
                type="button" 
                @click="openLocationStagingTray"
                class="btn btn-xs sm:btn-sm btn-ghost border border-base-300 rounded-btn font-bold gap-1.5 shadow-2xs"
                title="Open the Outbound Staging Tray"
              >
                <Icon icon="solar:inbox-out-bold" class="w-4 h-4 text-primary" />
                <span>Staging Tray</span>
              </button>
              
              <button 
                type="button" 
                @click="handleCreateNewDraft" 
                class="btn btn-xs sm:btn-sm btn-primary rounded-btn font-bold gap-1.5 shadow-xs"
                title="Create a new drop draft for this location"
              >
                <Icon icon="solar:add-circle-bold" class="w-4 h-4" />
                <span>+ Create New Drop</span>
              </button>
            </div>
          </div>

          <!-- Status Filter Pills -->
          <div v-if="locationManifests.length > 0" class="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono">
            <button 
              type="button" 
              @click="dropStatusFilter = 'all'" 
              class="btn btn-xs rounded-btn font-bold gap-1"
              :class="dropStatusFilter === 'all' ? 'btn-neutral' : 'btn-ghost border border-base-300'"
            >
              <span>All Drops</span>
              <span class="badge badge-xs">{{ locationManifests.length }}</span>
            </button>

            <button 
              v-if="draftDropsCount > 0"
              type="button" 
              @click="dropStatusFilter = 'draft'" 
              class="btn btn-xs rounded-btn font-bold gap-1"
              :class="dropStatusFilter === 'draft' ? 'btn-primary' : 'btn-ghost border border-base-300'"
            >
              <span>Drafts</span>
              <span class="badge badge-xs badge-primary">{{ draftDropsCount }}</span>
            </button>

            <button 
              v-if="exportedDropsCount > 0"
              type="button" 
              @click="dropStatusFilter = 'exported'" 
              class="btn btn-xs rounded-btn font-bold gap-1"
              :class="dropStatusFilter === 'exported' ? 'btn-info text-info-content' : 'btn-ghost border border-base-300'"
            >
              <span>Exported &amp; In-Transit</span>
              <span class="badge badge-xs badge-info">{{ exportedDropsCount }}</span>
            </button>

            <button 
              v-if="placedDropsCount > 0"
              type="button" 
              @click="dropStatusFilter = 'placed'" 
              class="btn btn-xs rounded-btn font-bold gap-1"
              :class="dropStatusFilter === 'placed' ? 'btn-success text-success-content' : 'btn-ghost border border-base-300'"
            >
              <span>Placed Archive</span>
              <span class="badge badge-xs badge-success">{{ placedDropsCount }}</span>
            </button>
          </div>

          <!-- Empty State -->
          <div v-if="filteredManifests.length === 0" class="text-center py-10 bg-base-200/30 rounded-2xl border border-dashed border-base-300 space-y-2">
            <Icon icon="solar:box-minimalistic-bold" class="w-8 h-8 opacity-40 mx-auto text-primary" />
            <div class="font-bold text-sm">No drops found</div>
            <p class="text-xs opacity-60 max-w-sm mx-auto">
              {{ dropStatusFilter === 'all' ? 'No drops have been created for this location yet.' : 'No drops matching the selected filter.' }}
            </p>
            <div v-if="dropStatusFilter !== 'all'" class="pt-1">
              <button type="button" @click="dropStatusFilter = 'all'" class="btn btn-xs btn-ghost border border-base-300">
                Show All Drops
              </button>
            </div>
            <div v-else class="pt-2">
              <button type="button" @click="handleCreateNewDraft" class="btn btn-sm btn-primary font-bold gap-1">
                <Icon icon="solar:add-circle-bold" class="w-4 h-4" />
                <span>+ Create First Drop for {{ warehouse.name }}</span>
              </button>
            </div>
          </div>

          <!-- All Drops Accordion List (Unified with Archived Drop styling) -->
          <div v-else class="space-y-3">
            <div 
              v-for="drop in filteredManifests" 
              :key="drop.$id" 
              class="border border-base-300 rounded-box bg-base-200/30 overflow-hidden transition-all"
            >
              <!-- Drop Header Strip -->
              <div 
                class="p-3.5 flex items-center justify-between gap-3 flex-wrap bg-base-100 cursor-pointer hover:bg-base-200/40 transition-colors select-none"
                @click="toggleExpandDrop(drop.$id)"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <button 
                    type="button" 
                    @click.stop="toggleExpandDrop(drop.$id)"
                    class="btn btn-ghost btn-xs btn-circle rounded-btn text-base-content/70 hover:text-primary shrink-0"
                    :title="isDropExpanded(drop.$id) ? 'Collapse details' : 'Expand items'"
                  >
                    <Icon :icon="isDropExpanded(drop.$id) ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'" class="w-4 h-4" />
                  </button>

                  <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="font-black text-xs sm:text-sm text-base-content truncate">{{ drop.name }}</span>
                      <span 
                        class="badge badge-xs font-mono font-bold uppercase text-[9px]"
                        :class="getDropBadgeClass(drop.status)"
                      >
                        {{ getDropBadgeLabel(drop.status) }}
                      </span>
                    </div>
                    <div class="text-[11px] opacity-60 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{{ getDropDateLabel(drop) }}</span>
                      <span>•</span>
                      <span>{{ getDropUnits(drop) }} units ({{ (drop.itemIds || []).length }} items)</span>
                      <span>•</span>
                      <span class="text-secondary font-black">${{ getDropRetail(drop).toFixed(2) }}</span>
                      <template v-if="drop.status === 'in-transit' || drop.status === 'exported'">
                        <span>•</span>
                        <span class="text-success font-bold">{{ (drop.placedItemIds || []).length }} of {{ drop.itemIds.length }} Placed</span>
                      </template>
                    </div>
                  </div>
                </div>

                <!-- Drop Action Buttons -->
                <div class="flex items-center gap-2 shrink-0 flex-wrap" @click.stop>
                  <!-- 1. Placed Drop Actions -->
                  <template v-if="drop.status === 'placed'">
                    <button 
                      type="button" 
                      @click="openDraftInTray(drop)"
                      class="btn btn-ghost btn-xs rounded-btn gap-1 font-bold border border-base-300 hover:bg-base-200 shadow-2xs"
                      title="Open this placed drop in Outbound Drop Tray"
                    >
                      <Icon icon="solar:arrow-right-up-linear" class="w-3.5 h-3.5 text-primary" />
                      <span>Open in Tray</span>
                    </button>

                    <button 
                      type="button" 
                      @click="openRollbackModal(drop)"
                      class="btn btn-warning btn-xs rounded-btn gap-1 font-black text-warning-content shadow-2xs active:scale-95"
                      title="Undo placement and return items to Backstock as active draft"
                    >
                      <Icon icon="solar:restart-bold" class="w-3.5 h-3.5" />
                      <span>Undo Placement / Rollback</span>
                    </button>
                  </template>

                  <!-- 2. Exported & In-Transit Drop Actions -->
                  <template v-else-if="drop.status === 'exported' || drop.status === 'in-transit'">
                    <button 
                      type="button" 
                      @click="exportSingleDropCsv(drop)" 
                      class="btn btn-xs btn-outline border-base-300 hover:border-base-content/40 font-bold gap-1 rounded-btn"
                      title="Download clean CSV for Ricochet POS"
                    >
                      <Icon icon="solar:file-download-bold" class="w-3.5 h-3.5 text-success" />
                      <span>Export POS CSV</span>
                    </button>

                    <button 
                      type="button" 
                      @click="openDraftInTray(drop)"
                      class="btn btn-ghost btn-xs rounded-btn gap-1 font-bold border border-base-300 hover:bg-base-200 shadow-2xs"
                      title="Open in Outbound Drop Tray"
                    >
                      <Icon icon="solar:arrow-right-up-linear" class="w-3.5 h-3.5 text-primary" />
                      <span>Open in Tray</span>
                    </button>

                    <button 
                      type="button" 
                      @click="handleUnlockDrop(drop)"
                      class="btn btn-xs btn-warning btn-outline rounded-btn font-bold gap-1 shadow-2xs"
                      title="Unlock drop back to editable draft"
                    >
                      <Icon icon="solar:lock-unlocked-bold" class="w-3.5 h-3.5" />
                      <span>Unlock to Draft</span>
                    </button>

                    <button 
                      type="button" 
                      @click="placeAllRemainingItems(drop)"
                      :disabled="isPlacingBatch"
                      class="btn btn-xs btn-success font-black text-success-content gap-1 rounded-btn shadow-2xs"
                      title="Mark all items placed at this location"
                    >
                      <Icon icon="solar:check-circle-bold" class="w-3.5 h-3.5" />
                      <span>Place All</span>
                    </button>
                  </template>

                  <!-- 3. Draft Drop Actions -->
                  <template v-else-if="drop.status === 'draft'">
                    <button 
                      type="button" 
                      @click="pauseActiveManifest" 
                      class="btn btn-xs btn-outline border-warning text-warning hover:bg-warning/20 font-bold gap-1 rounded-btn"
                      title="Pause this drop"
                    >
                      <Icon icon="solar:pause-circle-bold" class="w-3.5 h-3.5" />
                      <span>Pause</span>
                    </button>

                    <button 
                      type="button" 
                      @click="exportSingleDropCsv(drop)" 
                      class="btn btn-xs btn-outline border-base-300 hover:border-base-content/40 font-bold gap-1 rounded-btn"
                      :disabled="(drop.itemIds || []).length === 0"
                      title="Download clean CSV for Ricochet POS"
                    >
                      <Icon icon="solar:file-download-bold" class="w-3.5 h-3.5 text-success" />
                      <span>Export POS CSV</span>
                    </button>

                    <button 
                      type="button" 
                      @click="openDraftInTray(drop)"
                      class="btn btn-ghost btn-xs rounded-btn gap-1 font-bold border border-base-300 hover:bg-base-200 shadow-2xs"
                      title="Open in Outbound Drop Tray"
                    >
                      <Icon icon="solar:arrow-right-up-linear" class="w-3.5 h-3.5 text-primary" />
                      <span>Open in Tray</span>
                    </button>

                    <button 
                      type="button" 
                      @click="placeAllRemainingItems(drop)"
                      :disabled="(drop.itemIds || []).length === 0 || isPlacingBatch"
                      class="btn btn-xs btn-success font-black text-success-content gap-1 rounded-btn shadow-2xs"
                      title="Verify Stock: mark all items as placed at this location"
                    >
                      <Icon icon="solar:check-circle-bold" class="w-3.5 h-3.5" />
                      <span>Verify Stock</span>
                    </button>
                  </template>

                  <!-- 4. Paused Drop Actions -->
                  <template v-else-if="drop.status === 'paused'">
                    <button 
                      type="button" 
                      @click="resumeManifest(drop.$id)" 
                      class="btn btn-xs btn-warning font-bold gap-1 rounded-btn"
                      title="Resume this drop"
                    >
                      <Icon icon="solar:play-circle-bold" class="w-3.5 h-3.5" />
                      <span>Resume</span>
                    </button>

                    <button 
                      type="button" 
                      @click="openDraftInTray(drop)"
                      class="btn btn-ghost btn-xs rounded-btn gap-1 font-bold border border-base-300 hover:bg-base-200 shadow-2xs"
                      title="Open in Outbound Drop Tray"
                    >
                      <Icon icon="solar:arrow-right-up-linear" class="w-3.5 h-3.5 text-primary" />
                      <span>Open in Tray</span>
                    </button>
                  </template>
                </div>
              </div>

              <!-- Expanded Item Inspection Checklist (Matching Archived Drops) -->
              <div v-if="isDropExpanded(drop.$id)" class="p-3 border-t border-base-200 bg-base-200/50 space-y-2">
                <div class="text-[11px] font-bold opacity-75 flex items-center justify-between">
                  <span>Constituent Items ({{ (drop.itemIds || []).length }}):</span>
                  <span class="opacity-60">Click item to view/edit in ItemDrawer</span>
                </div>

                <!-- Empty items inside drop -->
                <div v-if="(drop.itemIds || []).length === 0" class="text-center py-6 border border-dashed border-base-300 rounded-box bg-base-100/50 space-y-2">
                  <Icon icon="solar:box-minimalistic-bold" class="w-6 h-6 opacity-30 mx-auto text-primary" />
                  <div class="text-xs font-bold opacity-60">No items staged in this drop yet</div>
                  <button type="button" @click="openDraftInTray(drop)" class="btn btn-xs btn-primary font-bold gap-1">
                    <Icon icon="solar:arrow-right-up-linear" class="w-3.5 h-3.5" />
                    <span>Stage Items in Tray</span>
                  </button>
                </div>

                <!-- Items Grid -->
                <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
                  <div 
                    v-for="item in getDropItems(drop)" 
                    :key="item.$id"
                    @click="openItemEditor(item)"
                    class="flex items-center gap-2.5 p-2 rounded-box bg-base-100 border border-base-300 hover:border-primary/40 transition-all cursor-pointer group"
                    title="Click to view & edit in ItemDrawer"
                  >
                    <div class="w-10 h-10 rounded-box bg-base-300 overflow-hidden shrink-0">
                      <img 
                        v-if="item.imageId" 
                        :src="getItemPhotoUrl(item.imageId)" 
                        @error="handleImageError($event, item.imageId)"
                        class="w-full h-full object-cover" 
                      />
                      <Icon v-else icon="solar:tag-bold" class="w-5 h-5 m-2.5 opacity-40" />
                    </div>
                    <div class="min-w-0 flex-1 text-xs">
                      <span class="font-bold truncate block group-hover:text-primary transition-colors">
                        {{ item.title || 'Item ' + item.$id }}
                      </span>
                      <div class="text-[10px] font-mono opacity-70 flex items-center gap-1.5 flex-wrap">
                        <span v-if="item.upc" class="text-primary font-bold">
                          {{ item.upc }}
                        </span>
                        <span v-if="item.quantity > 1" class="badge badge-xs badge-outline badge-primary font-bold">Qty: {{ item.quantity }}</span>
                        <span>•</span>
                        <span class="text-secondary font-bold">
                          ${{ (Number(item.boutiquePrice || item.resalePrice || item.price || item.listPrice) || 0).toFixed(2) }}
                        </span>
                      </div>
                    </div>
                    <div class="flex items-center gap-1 shrink-0">
                      <Icon v-if="drop.status === 'placed'" icon="solar:check-circle-bold" class="w-4 h-4 text-success" />
                      <template v-else-if="drop.status === 'draft'">
                        <button 
                          type="button" 
                          class="btn btn-ghost btn-xs btn-circle opacity-0 group-hover:opacity-100 text-error hover:bg-error/15 transition-opacity"
                          title="Remove from drop"
                          @click.stop="handleRemoveItemFromDraftDirect(drop, item.$id)"
                        >
                          ✕
                        </button>
                      </template>
                      <template v-else>
                        <span v-if="isItemPlaced(drop, item.$id)" class="badge badge-xs badge-success text-success-content font-bold">Placed</span>
                        <Icon v-else icon="solar:box-minimalistic-bold" class="w-4 h-4 text-info opacity-60" />
                      </template>
                    </div>
                  </div>
                </div>
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
                        <img 
                          v-if="item.imageId" 
                          :src="getItemPhotoUrl(item.imageId)" 
                          @error="handleImageError($event, item.imageId)"
                          class="w-full h-full object-cover" 
                        />
                        <Icon v-else icon="solar:tag-bold" class="w-4 h-4 m-2.5 opacity-40" />
                      </div>
                      <span class="font-bold text-xs truncate max-w-xs block hover:text-primary transition-colors">{{ item.title }}</span>
                    </div>
                  </td>
                  <td class="font-mono text-xs font-bold text-primary cursor-pointer" @click="openItemEditor(item)">{{ item.upc || item.locationSku || '—' }}</td>
                  <td class="text-xs opacity-75">{{ item.category || 'General' }}</td>
                  <td class="font-mono font-bold text-secondary text-right text-xs">
                    ${{ (Number(item.boutiquePrice || item.resalePrice || item.price || item.listPrice) || 0).toFixed(2) }}
                  </td>
                  <td class="text-center">
                    <span v-if="isItemSynced(item)" class="badge badge-xs badge-success gap-1 font-bold">
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

          <!-- Niche Guidelines Textarea -->
          <div class="form-control w-full space-y-1">
            <div class="flex items-center justify-between">
              <label class="label p-0">
                <span class="label-text font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Icon icon="solar:document-text-bold" class="w-4 h-4 text-primary" />
                  Niche &amp; Sourcing Guidelines (Exclusions &amp; Rules)
                </span>
              </label>
              <span class="text-[10px] opacity-60 font-mono">Used by AI Scout &amp; Deep Scan</span>
            </div>
            <textarea 
              v-model="editForm.categories" 
              rows="3" 
              class="textarea textarea-bordered w-full bg-base-200 focus:bg-base-100 font-medium text-xs leading-relaxed" 
              placeholder="e.g. Small Collectibles, Vintage Jewelry, Pins, Wands, Pocket Curiosities. NO Clothes, NO Apparel, NO Large Toys, Under 8 inches only"
            ></textarea>
            
            <!-- Quick Negative Exclusion Rule Helpers -->
            <div class="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span class="text-[10px] font-bold uppercase opacity-50">Quick Exclusions:</span>
              <button 
                type="button" 
                @click="appendRuleToTextarea('NO Clothes')"
                class="badge badge-xs badge-outline hover:badge-error hover:text-error-content cursor-pointer transition-colors text-[10px] font-bold"
              >
                ⛔ NO Clothes
              </button>
              <button 
                type="button" 
                @click="appendRuleToTextarea('NO Large Toys')"
                class="badge badge-xs badge-outline hover:badge-error hover:text-error-content cursor-pointer transition-colors text-[10px] font-bold"
              >
                ⛔ NO Large Toys
              </button>
              <button 
                type="button" 
                @click="appendRuleToTextarea('Under 8 inches only')"
                class="badge badge-xs badge-outline hover:badge-warning hover:text-warning-content cursor-pointer transition-colors text-[10px] font-bold"
              >
                📏 Under 8" Only
              </button>
              <button 
                type="button" 
                @click="appendRuleToTextarea('NO Bulky Playsets')"
                class="badge badge-xs badge-outline hover:badge-error hover:text-error-content cursor-pointer transition-colors text-[10px] font-bold"
              >
                ⛔ NO Bulky Playsets
              </button>
            </div>
          </div>

          <!-- Watch Tags (Tags to Watch / Priority Franchises) -->
          <div class="form-control w-full p-3.5 rounded-2xl bg-base-200/50 border border-base-300 space-y-2.5">
            <div class="flex items-center justify-between">
              <label class="label p-0">
                <span class="label-text font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Icon icon="solar:eye-bold" class="w-4 h-4 text-secondary" />
                  Tags &amp; Brands to Watch
                </span>
              </label>
              <span class="badge badge-xs badge-secondary/20 text-secondary font-mono font-bold">
                {{ watchTags.length }} tag{{ watchTags.length === 1 ? '' : 's' }} active
              </span>
            </div>
            <p class="text-[11px] opacity-70 leading-normal">
              Items matching these keywords/brands will be prioritized and automatically flagged for this booth by AI Scout and Haul Receiving.
            </p>

            <!-- Active Watch Tags List -->
            <div v-if="watchTags.length > 0" class="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
              <span 
                v-for="(tag, idx) in watchTags" 
                :key="tag" 
                class="badge badge-sm badge-secondary font-bold gap-1 py-2.5 px-2.5 text-xs shadow-2xs"
              >
                <span>{{ tag }}</span>
                <button 
                  type="button" 
                  @click="removeWatchTag(idx)" 
                  class="hover:text-error ml-0.5 rounded-full hover:bg-black/10 w-3.5 h-3.5 flex items-center justify-center text-[10px]"
                  title="Remove tag"
                >
                  ✕
                </button>
              </span>
            </div>
            <div v-else class="text-[11px] opacity-50 italic">
              No watch tags added yet. Type below or click quick suggestions to add.
            </div>

            <!-- Add New Watch Tag Input -->
            <div class="flex items-center gap-2">
              <div class="relative flex-1">
                <input 
                  type="text" 
                  v-model="newWatchTag" 
                  @keydown.enter.prevent="addWatchTag()"
                  placeholder="Type tag or brand &amp; press Enter (e.g. Star Trek, Trifari, Enamel Pins)"
                  class="input input-xs sm:input-sm input-bordered w-full font-bold bg-base-100 focus:bg-base-100" 
                />
              </div>
              <button 
                type="button" 
                @click="addWatchTag()" 
                class="btn btn-xs sm:btn-sm btn-secondary text-secondary-content font-bold px-3 shrink-0"
                :disabled="!newWatchTag.trim()"
              >
                <Icon icon="solar:add-circle-bold" class="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            <!-- AI Recommended / Quick Preset Watch Tags -->
            <div class="space-y-1 pt-1">
              <span class="text-[10px] font-bold uppercase opacity-50 block">Quick Preset Suggestions:</span>
              <div class="flex flex-wrap gap-1">
                <button 
                  v-for="rec in presetWatchTags" 
                  :key="rec" 
                  type="button"
                  @click="addWatchTag(rec)"
                  :disabled="watchTags.includes(rec)"
                  class="badge badge-xs sm:badge-sm badge-outline hover:badge-primary transition-colors cursor-pointer text-[10px] font-bold"
                  :class="{'opacity-35 pointer-events-none': watchTags.includes(rec)}"
                >
                  + {{ rec }}
                </button>
              </div>
            </div>
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

      <!-- ========================================================================= -->
      <!-- TAB 4: RENT & EXPENSES LEDGER (SCHEDULE C WRITE-OFFS)                     -->
      <!-- ========================================================================= -->
      <div v-if="activeTab === 'expenses'" class="space-y-6">
        <!-- Top Summary Cards (Calculated Rollups) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="bg-base-100 p-4 rounded-3xl border border-base-200 shadow-sm flex items-center gap-3">
            <div class="p-3 bg-secondary/10 text-secondary rounded-2xl shrink-0">
              <Icon icon="solar:wallet-money-bold" class="w-6 h-6" />
            </div>
            <div>
              <div class="text-[11px] uppercase font-bold opacity-60">Total Rent Paid</div>
              <div class="text-xl font-black font-mono text-secondary">${{ totalRentPaid.toFixed(2) }}</div>
              <div class="text-[10px] opacity-60">{{ rentPaymentsCount }} deduction{{ rentPaymentsCount === 1 ? '' : 's' }} logged</div>
            </div>
          </div>

          <div class="bg-base-100 p-4 rounded-3xl border border-base-200 shadow-sm flex items-center gap-3">
            <div class="p-3 bg-primary/10 text-primary rounded-2xl shrink-0">
              <Icon icon="solar:calculator-bold" class="w-6 h-6" />
            </div>
            <div>
              <div class="text-[11px] uppercase font-bold opacity-60">Monthly Average</div>
              <div class="text-xl font-black font-mono text-primary">${{ averageMonthlyRent.toFixed(2) }}</div>
              <div class="text-[10px] opacity-60">per active month</div>
            </div>
          </div>

          <div class="bg-base-100 p-4 rounded-3xl border border-base-200 shadow-sm flex items-center gap-3">
            <div class="p-3 bg-success/10 text-success rounded-2xl shrink-0">
              <Icon icon="solar:document-text-bold" class="w-6 h-6" />
            </div>
            <div>
              <div class="text-[11px] uppercase font-bold opacity-60">Tax Deduction</div>
              <div class="text-sm font-black text-success">Schedule C Line 20b</div>
              <div class="text-[10px] opacity-60">100% OpEx Write-Off</div>
            </div>
          </div>

          <div class="bg-base-100 p-4 rounded-3xl border border-base-200 shadow-sm flex items-center gap-3">
            <div class="p-3 bg-warning/10 text-warning rounded-2xl shrink-0">
              <Icon icon="solar:calendar-bold" class="w-6 h-6" />
            </div>
            <div>
              <div class="text-[11px] uppercase font-bold opacity-60">YTD Rent Total</div>
              <div class="text-xl font-black font-mono text-warning">${{ ytdRentPaid.toFixed(2) }}</div>
              <div class="text-[10px] opacity-60">Calendar Year {{ currentYear }}</div>
            </div>
          </div>
        </div>

        <!-- Ledger Table Card -->
        <div class="card bg-base-100 border border-base-200 shadow-md p-5 sm:p-6 rounded-3xl space-y-4">
          <div class="flex items-center justify-between gap-3 flex-wrap border-b border-base-200/60 pb-3">
            <div>
              <h3 class="font-black text-base sm:text-lg flex items-center gap-2">
                <Icon icon="solar:bill-list-bold" class="w-5 h-5 text-secondary" />
                <span>Itemized Rent &amp; Expenses Ledger</span>
              </h3>
              <p class="text-xs opacity-60">
                Each periodic space rental charge is recorded as an individual line-item expense with exact payment date for IRS audit compliance.
              </p>
            </div>
            <div class="flex items-center gap-2">
              <a 
                :href="'/warehouse/sync?location=' + encodeURIComponent(warehouse.name)" 
                class="btn btn-xs sm:btn-sm btn-outline border-base-300 gap-1.5 font-bold"
                title="Import from Mall Settlement Report"
              >
                <Icon icon="solar:upload-bold" class="w-4 h-4 text-secondary" />
                <span>Import Settlement CSV</span>
              </a>
              <button 
                type="button" 
                @click="openAddExpenseModal" 
                class="btn btn-xs sm:btn-sm btn-primary gap-1.5 font-bold shadow-xs"
              >
                <Icon icon="solar:add-circle-bold" class="w-4 h-4" />
                <span>Record Rent / Expense</span>
              </button>
            </div>
          </div>

          <!-- Loading State -->
          <div v-if="loadingExpenses" class="flex justify-center py-8">
            <span class="loading loading-spinner loading-md text-primary"></span>
          </div>

          <!-- Empty State -->
          <div v-else-if="locationExpenses.length === 0" class="text-center py-12 px-4 border border-dashed border-base-300 rounded-2xl space-y-3">
            <div class="w-12 h-12 rounded-2xl bg-base-200 text-secondary flex items-center justify-center mx-auto">
              <Icon icon="solar:wallet-money-bold" class="w-6 h-6" />
            </div>
            <div>
              <h4 class="font-bold text-sm">No Rent Deductions Logged Yet</h4>
              <p class="text-xs opacity-60 max-w-md mx-auto mt-1">
                When you import a Memory Den or mall settlement CSV in the Sales Sync Hub, booth space rentals (e.g. $382.50/mo) are automatically detected and logged line-by-line. You can also record off-cycle rent payments manually.
              </p>
            </div>
            <div class="pt-2 flex justify-center gap-2">
              <button type="button" @click="openAddExpenseModal" class="btn btn-xs btn-primary font-bold">
                Record First Rent Charge
              </button>
            </div>
          </div>

          <!-- Expenses Table -->
          <div v-else class="overflow-x-auto">
            <table class="table table-sm w-full">
              <thead>
                <tr class="text-[11px] uppercase tracking-wider text-base-content/60 border-b border-base-200">
                  <th>Payment Date</th>
                  <th>Description / Statement Note</th>
                  <th>Tax Category</th>
                  <th class="text-right">Deduction Amount</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="exp in locationExpenses" :key="exp.$id" class="hover:bg-base-200/40 transition-colors">
                  <td class="font-mono text-xs font-bold text-base-content">
                    {{ formatExpenseDate(exp.date) }}
                  </td>
                  <td class="text-xs">
                    <span class="font-bold block">{{ exp.note || 'Space Rental' }}</span>
                    <span v-if="exp.cartId" class="text-[10px] opacity-40 font-mono">{{ exp.cartId }}</span>
                  </td>
                  <td>
                    <span class="badge badge-xs badge-outline badge-success font-bold">
                      Schedule C Line 20b
                    </span>
                  </td>
                  <td class="font-mono font-black text-secondary text-right text-xs sm:text-sm">
                    -${{ Number(exp.amount || 0).toFixed(2) }}
                  </td>
                  <td class="text-right">
                    <button 
                      type="button" 
                      class="btn btn-ghost btn-xs text-error opacity-70 hover:opacity-100" 
                      @click="confirmDeleteExpense(exp)"
                      title="Delete expense line"
                    >
                      <Icon icon="solar:trash-bin-trash-linear" class="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="font-bold border-t-2 border-base-300">
                  <td colspan="3" class="text-right text-xs uppercase opacity-75">Calculated Total Rolled Up:</td>
                  <td class="font-mono font-black text-secondary text-right text-sm">
                    -${{ totalRentPaid.toFixed(2) }}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
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

    <!-- ROLLBACK / UNDO PLACEMENT CONFIRMATION MODAL -->
    <dialog class="modal modal-bottom sm:modal-middle z-[85]" :class="{ 'modal-open': !!dropPendingRollback }">
      <div v-if="dropPendingRollback" class="modal-box bg-base-100 border border-base-300 shadow-2xl rounded-box p-5 max-w-sm mx-auto space-y-4">
        <div class="flex items-center gap-3 text-warning">
          <div class="w-10 h-10 rounded-box bg-warning/15 flex items-center justify-center shrink-0">
            <Icon icon="solar:restart-bold" class="w-6 h-6" />
          </div>
          <div>
            <h3 class="font-black text-base text-base-content">Undo Drop Placement?</h3>
            <p class="text-xs text-base-content/60 font-mono truncate max-w-48">{{ dropPendingRollback.name }}</p>
          </div>
        </div>

        <p class="text-xs text-base-content/80 leading-relaxed">
          This will roll back all <strong>{{ (dropPendingRollback.itemIds || []).length }} items</strong> from <em>placed</em> at {{ warehouse?.name }} back to <strong>in-stock</strong> at <strong>Backstock</strong>, and restore this manifest as an active draft.
        </p>

        <div class="modal-action flex items-center gap-2 mt-0">
          <button 
            type="button" 
            class="btn btn-ghost flex-1 font-bold rounded-btn"
            @click="dropPendingRollback = null"
          >
            Cancel
          </button>
          <button 
            type="button" 
            class="btn btn-warning flex-1 font-black text-warning-content shadow-md border border-warning-content/25 active:scale-95 rounded-btn gap-1"
            :disabled="isRollingBack"
            @click="confirmRollbackPlacedDrop"
          >
            <span v-if="isRollingBack" class="loading loading-spinner loading-xs"></span>
            <template v-else>
              <Icon icon="solar:restart-bold" class="w-4 h-4" />
              <span>Confirm Rollback</span>
            </template>
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="dropPendingRollback = null">
        <button>close</button>
      </form>
    </dialog>

    <!-- RECORD RENT / EXPENSE MODAL -->
    <dialog class="modal modal-bottom sm:modal-middle z-[85]" :class="{ 'modal-open': showAddExpenseModal }">
      <div v-if="showAddExpenseModal" class="modal-box bg-base-100 border border-base-300 shadow-2xl rounded-3xl p-6 max-w-md mx-auto space-y-4">
        <div class="flex items-center justify-between border-b border-base-200 pb-3">
          <div class="flex items-center gap-2.5">
            <div class="p-2 bg-secondary/10 text-secondary rounded-xl">
              <Icon icon="solar:wallet-money-bold" class="w-5 h-5" />
            </div>
            <div>
              <h3 class="font-black text-base">Record Rent / Booth Expense</h3>
              <p class="text-xs opacity-60">{{ warehouse?.name || 'Location' }}</p>
            </div>
          </div>
          <button type="button" class="btn btn-xs btn-ghost btn-circle" @click="showAddExpenseModal = false">✕</button>
        </div>

        <form @submit.prevent="submitNewExpense" class="space-y-3.5">
          <div class="form-control">
            <label class="label py-0.5"><span class="label-text text-xs font-bold">Deduction Amount ($)</span></label>
            <input 
              type="number" 
              step="0.01" 
              min="0.01" 
              v-model.number="newExpenseForm.amount" 
              required 
              class="input input-bordered input-sm font-mono font-bold text-base" 
            />
          </div>

          <div class="form-control">
            <label class="label py-0.5"><span class="label-text text-xs font-bold">Charge / Payment Date</span></label>
            <input 
              type="date" 
              v-model="newExpenseForm.date" 
              required 
              class="input input-bordered input-sm font-mono" 
            />
          </div>

          <div class="form-control">
            <label class="label py-0.5"><span class="label-text text-xs font-bold">Description / Note</span></label>
            <input 
              type="text" 
              v-model="newExpenseForm.note" 
              required 
              class="input input-bordered input-sm" 
              placeholder="e.g. Memory Den Space Rental - August 2026"
            />
          </div>

          <div class="form-control">
            <label class="label py-0.5"><span class="label-text text-xs font-bold">Tax Category</span></label>
            <select v-model="newExpenseForm.category" class="select select-bordered select-sm">
              <option value="Schedule C Line 20b (Rent on business property)">Schedule C Line 20b (Rent on business property)</option>
              <option value="Schedule C Line 22 (Supplies &amp; materials)">Schedule C Line 22 (Supplies &amp; materials)</option>
              <option value="Schedule C Line 27a (Other expenses)">Schedule C Line 27a (Other expenses)</option>
            </select>
          </div>

          <div class="modal-action border-t border-base-200 pt-3 flex justify-end gap-2">
            <button type="button" class="btn btn-sm btn-ghost" @click="showAddExpenseModal = false">Cancel</button>
            <button type="submit" class="btn btn-sm btn-secondary font-bold" :disabled="isSubmittingExpense">
              <span v-if="isSubmittingExpense" class="loading loading-spinner loading-xs"></span>
              <span>Record Expense Line</span>
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showAddExpenseModal = false">
        <button>close</button>
      </form>
    </dialog>

    <!-- DELETE EXPENSE CONFIRMATION MODAL -->
    <dialog class="modal modal-bottom sm:modal-middle z-[85]" :class="{ 'modal-open': !!expenseToDelete }">
      <div v-if="expenseToDelete" class="modal-box bg-base-100 border border-base-300 shadow-2xl rounded-3xl p-5 max-w-sm mx-auto space-y-4">
        <div class="flex items-center gap-3 text-error">
          <div class="w-10 h-10 rounded-2xl bg-error/15 flex items-center justify-center shrink-0">
            <Icon icon="solar:trash-bin-trash-bold" class="w-6 h-6" />
          </div>
          <div>
            <h3 class="font-black text-base text-base-content">Delete Expense Line?</h3>
            <p class="text-xs text-base-content/60 font-mono">${{ Number(expenseToDelete.amount).toFixed(2) }}</p>
          </div>
        </div>

        <p class="text-xs text-base-content/80 leading-relaxed">
          Are you sure you want to remove the expense line <strong>"{{ expenseToDelete.note }}"</strong>? This will remove it from the calculated rollup and tax records.
        </p>

        <div class="modal-action flex items-center gap-2 mt-0">
          <button type="button" class="btn btn-ghost flex-1 font-bold" @click="expenseToDelete = null">
            Cancel
          </button>
          <button 
            type="button" 
            class="btn btn-error flex-1 font-bold text-white shadow-md gap-1"
            :disabled="isDeletingExpense"
            @click="executeDeleteExpense"
          >
            <span v-if="isDeletingExpense" class="loading loading-spinner loading-xs"></span>
            <span>Confirm Delete</span>
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="expenseToDelete = null">
        <button>close</button>
      </form>
    </dialog>

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
import { databases, ID, Query } from '../../lib/appwrite';

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
  finalizeActivePlacement,
  rollbackPlacedManifest,
  unverifyAllItems
} = useManifest();

const expandedDropIds = ref<Set<string>>(new Set());
const isDropExpanded = (id: string) => expandedDropIds.value.has(id);
const toggleExpandDrop = (id: string) => {
  if (expandedDropIds.value.has(id)) {
    expandedDropIds.value.delete(id);
  } else {
    expandedDropIds.value.add(id);
  }
  expandedDropIds.value = new Set(expandedDropIds.value);
};
// Aliases for compatibility
const expandedPlacedDropIds = expandedDropIds;
const toggleExpandPlacedDrop = toggleExpandDrop;

const dropPendingRollback = ref<ManifestDocument | null>(null);
const isRollingBack = ref(false);

const openRollbackModal = (drop: ManifestDocument) => {
  dropPendingRollback.value = drop;
};

const confirmRollbackPlacedDrop = async () => {
  if (!dropPendingRollback.value || isRollingBack.value) return;
  isRollingBack.value = true;
  const targetDrop = dropPendingRollback.value;
  try {
    await rollbackPlacedManifest(targetDrop.$id);
    addToast({
      type: 'success',
      message: `Rolled back "${targetDrop.name}"! Items returned to Backstock and manifest restored to draft.`
    });
    dropPendingRollback.value = null;
    await loadManifests();
    await fetchInventory(team.value?.$id);
  } catch (err: any) {
    addToast({
      type: 'error',
      message: `Rollback failed: ${err.message || err}`
    });
  } finally {
    isRollingBack.value = false;
  }
};

const handleUnlockDrop = async (drop: ManifestDocument) => {
  try {
    await manifestsApi.unlockManifest(drop.$id);
    addToast({
      type: 'info',
      message: `Unlocked "${drop.name}" to editable draft!`
    });
    await loadManifests();
  } catch (err: any) {
    addToast({
      type: 'error',
      message: `Could not unlock: ${err.message || err}`
    });
  }
};

const handleUnverifyDrop = async (drop: ManifestDocument) => {
  try {
    await unverifyAllItems(drop.$id);
    addToast({
      type: 'info',
      message: `Unverified all items on "${drop.name}".`
    });
    await loadManifests();
  } catch (err: any) {
    addToast({
      type: 'error',
      message: `Could not unverify: ${err.message || err}`
    });
  }
};

const warehouse = ref<WarehouseDocument | null>(null);
const locationManifests = ref<ManifestDocument[]>([]);
const loading = ref(true);
const error = ref('');
const activeTab = ref<'manifests' | 'catalog' | 'expenses' | 'settings'>('manifests');

const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

const locationExpenses = ref<any[]>([]);
const loadingExpenses = ref<boolean>(false);
const showAddExpenseModal = ref<boolean>(false);
const isSubmittingExpense = ref<boolean>(false);
const expenseToDelete = ref<any | null>(null);
const isDeletingExpense = ref<boolean>(false);

const currentYear = new Date().getFullYear();

const newExpenseForm = ref({
  amount: 382.50,
  date: new Date().toISOString().slice(0, 10),
  note: '',
  category: 'Schedule C Line 20b (Rent on business property)'
});

const openAddExpenseModal = () => {
  const locName = warehouse.value?.name || 'Booth';
  const defRent = warehouse.value?.monthlyRent || 382.50;
  newExpenseForm.value = {
    amount: defRent,
    date: new Date().toISOString().slice(0, 10),
    note: `${locName} Space Rental`,
    category: 'Schedule C Line 20b (Rent on business property)'
  };
  showAddExpenseModal.value = true;
};

const formatExpenseDate = (isoOrStr: string) => {
  if (!isoOrStr) return '—';
  try {
    return new Date(isoOrStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return isoOrStr;
  }
};

const loadExpenses = async () => {
  if (!warehouse.value) return;
  loadingExpenses.value = true;
  try {
    const locId = warehouse.value.$id;
    const locName = (warehouse.value.name || '').toLowerCase();
    const locCode = (warehouse.value.code || '').toLowerCase();

    const queries = [Query.orderDesc('date'), Query.limit(100)];
    if (team.value?.$id) {
      queries.push(Query.equal('tenantId', team.value.$id));
    }

    const res = await databases.listDocuments(DB_ID, 'expenses', queries);
    locationExpenses.value = res.documents.filter((doc: any) => {
      const cId = (doc.cartId || '').toLowerCase();
      const pId = (doc.purchaseId || '').toLowerCase();
      const note = (doc.note || '').toLowerCase();

      return (
        (locId && (cId.includes(locId.toLowerCase()) || pId === locId.toLowerCase())) ||
        (locName && note.includes(locName)) ||
        (locCode && cId.includes(locCode))
      );
    });
  } catch (err: any) {
    console.warn('Failed to load expenses for location:', err);
  } finally {
    loadingExpenses.value = false;
  }
};

const submitNewExpense = async () => {
  if (!warehouse.value) return;
  isSubmittingExpense.value = true;
  try {
    const locId = warehouse.value.$id;
    const doc = await databases.createDocument(DB_ID, 'expenses', ID.unique(), {
      cartId: `RENT-${locId}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      tenantId: team.value?.$id || 'personal',
      amount: Number(newExpenseForm.value.amount) || 0,
      note: newExpenseForm.value.note || `${warehouse.value.name} Booth Rent`,
      date: new Date(newExpenseForm.value.date + 'T12:00:00.000Z').toISOString(),
      purchaseId: locId
    });
    locationExpenses.value.unshift(doc);
    addToast({
      type: 'success',
      message: `Recorded $${Number(newExpenseForm.value.amount).toFixed(2)} rent expense line!`
    });
    showAddExpenseModal.value = false;
  } catch (err: any) {
    console.error('Failed to create expense:', err);
    addToast({ type: 'error', message: 'Failed to record expense: ' + err.message });
  } finally {
    isSubmittingExpense.value = false;
  }
};

const confirmDeleteExpense = (exp: any) => {
  expenseToDelete.value = exp;
};

const executeDeleteExpense = async () => {
  if (!expenseToDelete.value) return;
  isDeletingExpense.value = true;
  try {
    await databases.deleteDocument(DB_ID, 'expenses', expenseToDelete.value.$id);
    locationExpenses.value = locationExpenses.value.filter(e => e.$id !== expenseToDelete.value.$id);
    addToast({ type: 'info', message: 'Expense line removed.' });
    expenseToDelete.value = null;
  } catch (err: any) {
    console.error('Failed to delete expense:', err);
    addToast({ type: 'error', message: 'Could not delete expense: ' + err.message });
  } finally {
    isDeletingExpense.value = false;
  }
};

const totalRentPaid = computed(() => {
  return locationExpenses.value.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
});

const rentPaymentsCount = computed(() => {
  return locationExpenses.value.length;
});

const averageMonthlyRent = computed(() => {
  if (rentPaymentsCount.value === 0) return warehouse.value?.monthlyRent || 0;
  return totalRentPaid.value / rentPaymentsCount.value;
});

const ytdRentPaid = computed(() => {
  return locationExpenses.value
    .filter(exp => {
      try {
        return new Date(exp.date).getFullYear() === currentYear;
      } catch {
        return false;
      }
    })
    .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
});

// Settings Form State & Watch Tags
const parseNicheAndWatchTags = (raw: string) => {
  if (!raw) return { rules: '', tags: [] as string[] };
  const markerRegex = /(?:^|\n)(?:Watch Tags|Tags to Watch|Priority Tags):\s*(.*)$/im;
  const match = raw.match(markerRegex);
  if (match) {
    const rules = raw.replace(markerRegex, '').trim();
    const tags = match[1]
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    return { rules, tags };
  }
  return { rules: raw, tags: [] as string[] };
};

const watchTags = ref<string[]>([]);
const newWatchTag = ref('');

const presetWatchTags = [
  'Small Collectibles',
  'Vintage Jewelry',
  'Enamel Pins',
  'Pocket Knives',
  'Sterling 925',
  'Star Trek',
  'Miniature Figures',
  'Trading Cards',
  'Wands & Arcana',
  'Micro Machines'
];

const addWatchTag = (tag?: string) => {
  const val = (tag || newWatchTag.value || '').trim();
  if (!val) return;
  const parts = val.split(',').map(p => p.trim()).filter(Boolean);
  for (const part of parts) {
    if (!watchTags.value.some(t => t.toLowerCase() === part.toLowerCase())) {
      watchTags.value.push(part);
    }
  }
  newWatchTag.value = '';
};

const removeWatchTag = (idx: number) => {
  watchTags.value.splice(idx, 1);
};

const appendRuleToTextarea = (rule: string) => {
  const current = (editForm.value.categories || '').trim();
  if (!current) {
    editForm.value.categories = rule;
  } else if (!current.toLowerCase().includes(rule.toLowerCase())) {
    editForm.value.categories = `${current}, ${rule}`;
  }
};

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
    const parsed = parseNicheAndWatchTags(found.categories || (found as any).niche || '');
    editForm.value = {
      name: found.name || '',
      code: found.code || '',
      type: found.type || 'Consignment Booth',
      commissionRate: found.commissionRate ?? 15,
      monthlyRent: found.monthlyRent ?? 0,
      categories: parsed.rules
    };
    watchTags.value = parsed.tags;

    // Load manifests, inventory items, and expenses for this location in parallel
    await Promise.all([
      loadManifests(),
      fetchInventory(team.value?.$id),
      loadExpenses()
    ]);
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
  try {
    const all = await manifestsApi.listManifests(tId);
    const code = (warehouse.value.code || '').toLowerCase();
    const name = (warehouse.value.name || '').toLowerCase();

    locationManifests.value = all.filter(m => {
      const mLocId = (m.locationId || '').toLowerCase();
      const mLocName = (m.locationName || '').toLowerCase();
      if (code && mLocId === code) return true;
      if (name && mLocName === name) return true;
      if (code === 'md' && (mLocId.includes('memory') || mLocName.includes('memory'))) return true;
      if (code === 'dt' && (mLocId.includes('dusty') || mLocName.includes('dusty'))) return true;
      if (code === 'hg' && (mLocId.includes('huck') || mLocName.includes('huck') || mLocId.includes('garage') || mLocName.includes('garage'))) return true;
      if (name && (mLocName.includes(name) || name.includes(mLocName))) return true;
      return false;
    });

    // Auto-expand the first drop if none are currently expanded
    if (expandedDropIds.value.size === 0 && locationManifests.value.length > 0) {
      expandedDropIds.value.add(locationManifests.value[0].$id);
      expandedDropIds.value = new Set(expandedDropIds.value);
    }
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

const activeDraftUnits = computed(() => {
  return activeDraftItems.value.reduce((sum, i) => sum + Math.max(1, Number(i.quantity || 1)), 0);
});

const activeDraftRetail = computed(() => {
  return activeDraftItems.value.reduce((sum, item) => {
    const price = Number(item.boutiquePrice || item.resalePrice || item.price || item.listPrice || 0);
    const qty = Math.max(1, Number(item.quantity || 1));
    return sum + (price * qty);
  }, 0);
});

const activeDraftNet = computed(() => {
  const comm = (warehouse.value?.commissionRate ?? 15) / 100;
  return activeDraftRetail.value * (1 - comm);
});

const dropStatusFilter = ref<'all' | 'draft' | 'exported' | 'placed'>('all');

const draftDrops = computed(() => {
  return locationManifests.value.filter(m => m.status === 'draft' || m.status === 'paused');
});

const exportedDrops = computed(() => {
  return locationManifests.value.filter(m => m.status === 'exported' || m.status === 'in-transit');
});

const placedDrops = computed(() => {
  return locationManifests.value.filter(m => m.status === 'placed');
});

const draftDropsCount = computed(() => draftDrops.value.length);
const exportedDropsCount = computed(() => exportedDrops.value.length);
const placedDropsCount = computed(() => placedDrops.value.length);

const filteredManifests = computed(() => {
  if (dropStatusFilter.value === 'all') return locationManifests.value;
  if (dropStatusFilter.value === 'draft') return draftDrops.value;
  if (dropStatusFilter.value === 'exported') return exportedDrops.value;
  if (dropStatusFilter.value === 'placed') return placedDrops.value;
  return locationManifests.value;
});

const getDropItems = (drop: ManifestDocument) => {
  const ids = drop.itemIds || [];
  const invMap = new Map(inventoryItems.value.map(i => [i.$id, i]));
  const snapMap = new Map((drop.itemsSnapshot || []).map(s => [s.$id, s]));
  return ids.map(id => invMap.get(id) || snapMap.get(id) || { $id: id, title: 'Item ' + id });
};

const getDropUnits = (drop: ManifestDocument) => {
  const items = getDropItems(drop);
  return items.reduce((sum, i) => sum + Math.max(1, Number(i.quantity || 1)), 0);
};

const getDropRetail = (drop: ManifestDocument) => {
  if (drop.totalRetail && Number(drop.totalRetail) > 0) return Number(drop.totalRetail);
  const items = getDropItems(drop);
  return items.reduce((sum, item) => {
    const price = Number(item.boutiquePrice || item.resalePrice || item.price || item.listPrice || 0);
    const qty = Math.max(1, Number(item.quantity || 1));
    return sum + (price * qty);
  }, 0);
};

const getDropDateLabel = (drop: ManifestDocument) => {
  if (drop.status === 'placed') {
    return `Delivered ${formatDate(drop.placedAt || drop.$updatedAt)}`;
  }
  if (drop.status === 'exported') {
    return `Exported ${formatDate(drop.exportedAt || drop.$updatedAt)}`;
  }
  return `Created ${formatDate(drop.$createdAt || drop.$updatedAt)}`;
};

const getDropBadgeClass = (status: string) => {
  switch (status) {
    case 'placed':
      return 'badge-success text-success-content';
    case 'exported':
      return 'badge-info text-info-content';
    case 'in-transit':
      return 'badge-warning text-warning-content';
    case 'draft':
      return 'badge-primary text-primary-content';
    case 'paused':
      return 'badge-ghost';
    default:
      return 'badge-ghost';
  }
};

const getDropBadgeLabel = (status: string) => {
  switch (status) {
    case 'placed':
      return 'Placed';
    case 'exported':
      return 'Exported to POS';
    case 'in-transit':
      return 'In-Transit';
    case 'draft':
      return 'Active Draft';
    case 'paused':
      return 'Paused';
    default:
      return status;
  }
};

const exportSingleDropCsv = async (drop: ManifestDocument) => {
  await switchActiveManifest(drop.$id);
  await exportManifestCsv('ricochet');
  await loadManifests();
};

const handleRemoveItemFromDraftDirect = async (drop: ManifestDocument, itemId: string) => {
  await switchActiveManifest(drop.$id);
  await removeFromManifest(itemId);
  await loadManifests();
};

// Computed In-Stock Items at this Location
const inStockItems = computed(() => {
  if (!warehouse.value) return [];
  const query = warehouse.value.code || warehouse.value.name;
  return inventoryItems.value.filter(item => {
    if (item.status === 'sold') return false;
    return matchesLocationFilter(item, query) || matchesLocationFilter(item, warehouse.value!.name);
  });
});

const inStockValue = computed(() => {
  return inStockItems.value.reduce((acc, i) => {
    const unitPrice = Number(i.boutiquePrice || i.resalePrice || i.listPrice || i.price || i.estValue || 0);
    const qty = Math.max(1, Number(i.quantity) || 1);
    return acc + (unitPrice * qty);
  }, 0);
});

const isItemSynced = (item: any) => {
  return !!(
    item.locationSku ||
    item.ricochetSynced === true ||
    (Array.isArray(item.sellingLocations) && item.sellingLocations.some((l: string) => /ricochet/i.test(l)))
  );
};

const syncedItemsCount = computed(() => {
  return inStockItems.value.filter(isItemSynced).length;
});

const pendingExportCount = computed(() => {
  return inStockItems.value.filter(i => !isItemSynced(i)).length;
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

const handleImageError = (e: Event, imageId?: string) => {
  const target = e.target as HTMLImageElement;
  if (!target || !imageId) return;
  if (target.dataset.triedFallback) return;
  target.dataset.triedFallback = 'true';
  const ENDPOINT = import.meta.env.PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1';
  const PROJECT = import.meta.env.PUBLIC_APPWRITE_PROJECT_ID || '69714b35003a8adab6bb';
  if (target.src.includes('item_images_dev')) {
    target.src = `${ENDPOINT}/storage/buckets/item_images/files/${imageId}/view?project=${PROJECT}`;
  } else if (target.src.includes('item_images')) {
    target.src = `${ENDPOINT}/storage/buckets/item_images_dev/files/${imageId}/view?project=${PROJECT}`;
  }
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
    let finalCategories = editForm.value.categories.trim();
    if (watchTags.value.length > 0) {
      finalCategories = finalCategories 
        ? `${finalCategories}\nWatch Tags: ${watchTags.value.join(', ')}` 
        : `Watch Tags: ${watchTags.value.join(', ')}`;
    }

    const updated = await warehousesApi.updateWarehouse(warehouse.value.$id, {
      name: editForm.value.name.trim(),
      code: editForm.value.code.trim().toUpperCase(),
      type: editForm.value.type,
      commissionRate: editForm.value.commissionRate,
      monthlyRent: editForm.value.monthlyRent,
      categories: finalCategories
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

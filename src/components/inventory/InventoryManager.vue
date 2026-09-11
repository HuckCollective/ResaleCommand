<template>
    <div class="space-y-12">
        <!-- SHOPPING CART SECTION -->
        <div v-if="cartItems.length > 0" class="space-y-8">
            <h2 class="text-2xl font-bold flex items-center gap-2"><Icon icon="solar:object-scan-linear" class="w-8 h-8 text-primary" /> Active Sourcing Run <span class="badge badge-primary">{{ cartItems.length }}</span></h2>

            <div v-for="(groupItems, location) in cartGroups" :key="location" class="bg-base-200 p-6 rounded-2xl border-2 border-base-300 relative">
                <div class="absolute -top-3 left-6 px-2 bg-base-200 text-sm font-bold opacity-70 border border-base-300 rounded">
                    <Icon icon="solar:map-point-linear" class="w-4 h-4 inline" /> {{ location }} ({{ groupItems.length }})
                </div>
            
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-1 pt-2">
                    <div v-for="item in groupItems" :key="item.$id" class="card bg-base-100 shadow-sm border-2 border-primary/20 hover:border-primary transition-colors">
                        <div class="card-body p-4">
                            <div class="flex gap-4 cursor-pointer hover:opacity-80 transition-opacity" @click="openEdit(item)">
                                <div class="w-16 h-16 bg-base-300 rounded-lg shrink-0 overflow-hidden relative">
                                    <img v-if="getImageUrl(item)" :src="getImageUrl(item)" class="w-full h-full object-cover" />
                                    <div v-else class="flex items-center justify-center w-full h-full opacity-30"><Icon icon="solar:box-linear" class="w-8 h-8" /></div>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <h3 class="font-bold truncate group-hover:text-primary transition-colors">{{ item.title }}</h3>
                                    <div class="text-xs opacity-70 mt-1">
                                        Max Buy: <span class="font-bold text-success">${{ item.maxBuyPrice }}</span>
                                    </div>
                                    <div v-if="item.storageLocation" class="badge badge-xs badge-outline mt-1">{{ item.storageLocation }}</div>
                                </div>
                            </div>
                            <div class="card-actions justify-end mt-2">
                                <button class="btn btn-sm btn-ghost text-error" @click="confirmDelete(item.$id)" :disabled="processingId === item.$id">✕</button>
                                <button class="btn btn-sm btn-primary" @click="openCheckout(item)">
                                    Purchase <Icon icon="solar:dollar-linear" class="w-4 h-4 ml-1 inline" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <!-- MAIN INVENTORY SECTION -->
        <div class="drawer lg:drawer-open">
            <input id="inventory-sidebar" type="checkbox" class="drawer-toggle" />
            
            <div class="drawer-content flex flex-col pb-44 lg:pl-5 pt-0 min-w-0">
                <!-- RESPONSIVE STICKY HEADER (Row 1: Title & Controls, Row 2: Full-width Search, Row 3: Quick Filter Pills) -->
                <!-- STREAMLINED COMPACT HEADER -->
                <div class="sticky top-0 z-30 bg-base-100/95 backdrop-blur-md border-b border-base-200 py-2 mb-2 -mx-4 px-4 sm:mx-0 sm:px-0 shadow-2xs">
                    <div class="flex flex-col gap-1.5">
                        <!-- Row 1: Title & Counts on Left | View Toggle & Add on Right -->
                        <div class="flex items-center justify-between gap-2">
                            <!-- Left: Clean Title & Live Item Count -->
                            <div class="flex items-center gap-2 min-w-0">
                                <h1 class="text-lg sm:text-xl font-black tracking-tight text-base-content leading-none">Inventory</h1>
                                <span class="badge badge-sm badge-neutral font-mono font-bold">{{ filteredInventory.length }}</span>
                                <span v-if="loading" class="loading loading-spinner loading-xs text-primary"></span>
                            </div>

                            <!-- Right: Compact Controls (Zero Collisions!) -->
                            <div class="flex items-center gap-1.5 shrink-0">
                                <!-- Mobile: Single compact "Table" toggle button -->
                                <button 
                                    type="button"
                                    class="sm:hidden btn btn-xs btn-ghost border border-base-300 gap-1 font-bold shadow-2xs"
                                    @click="$emit('update:viewMode', 'table')"
                                    title="Switch to Spreadsheet Table View"
                                >
                                    <Icon icon="solar:list-bold" class="w-3.5 h-3.5 text-primary" />
                                    <span class="text-xs">Table</span>
                                </button>

                                <!-- Desktop: Full Segmented Control -->
                                <div class="hidden sm:inline-flex join bg-base-200/80 p-0.5 rounded-lg border border-base-300 shrink-0">
                                    <button 
                                        type="button"
                                        class="join-item btn btn-xs gap-1 font-bold transition-all px-2.5"
                                        :class="viewMode === 'table' ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost opacity-70 hover:opacity-100'"
                                        @click="$emit('update:viewMode', 'table')"
                                        title="Spreadsheet Table View"
                                    >
                                        <Icon icon="solar:list-bold" class="w-3.5 h-3.5" />
                                        <span class="text-[11px]">Table</span>
                                    </button>
                                    <button 
                                        type="button"
                                        class="join-item btn btn-xs gap-1 font-bold transition-all px-2.5"
                                        :class="viewMode === 'grid' ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost opacity-70 hover:opacity-100'"
                                        @click="$emit('update:viewMode', 'grid')"
                                        title="Visual Card Grid View"
                                    >
                                        <Icon icon="solar:gallery-wide-bold" class="w-3.5 h-3.5" />
                                        <span class="text-[11px]">Cards</span>
                                    </button>
                                </div>

                                <!-- Desktop Only: Add Item Trigger (Mobile Add is thumb-docked in bottom tray!) -->
                                <button class="hidden sm:inline-flex btn btn-xs sm:btn-sm btn-primary gap-1 font-bold shadow-xs shrink-0" @click="openAdd">
                                    <Icon icon="solar:add-circle-linear" class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    <span class="text-xs">Add</span>
                                </button>
                            </div>
                        </div>

                        <!-- Row 2: Omnibox Search (Full Width) -->
                        <div class="relative w-full">
                            <Icon icon="solar:magnifer-linear" class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
                            <input 
                                type="text" 
                                v-model="searchQuery" 
                                placeholder="Search title, UPC, PO, vendor, location..." 
                                class="input input-bordered input-xs sm:input-sm h-8 min-h-8 w-full pl-8.5 pr-8 bg-base-200/60 focus:bg-base-100 font-mono text-xs shadow-inner rounded-lg" 
                            />
                            <button v-if="searchQuery" @click="searchQuery = ''" class="btn btn-ghost btn-circle btn-xs w-6 h-6 min-h-6 absolute right-1 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 touch-manipulation active:scale-90 flex items-center justify-center font-bold text-xs" title="Clear search">✕</button>
                        </div>

                        <!-- Row 3: Horizontal Quick-Tap Filter Pills Bar -->
                        <div class="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5 shrink-0 max-w-full text-xs">
                            <!-- Filter Tray Trigger Pill -->
                            <button type="button" @click="dockRef?.openTab('filters')" class="btn btn-xs rounded-full gap-1 font-bold shrink-0 border border-base-300 cursor-pointer lg:hidden" :class="activeFilterCount > 0 ? 'btn-primary text-primary-content shadow-2xs' : 'btn-ghost bg-base-200/80 hover:bg-base-200'">
                                <Icon icon="solar:tuning-square-2-bold-duotone" class="w-3.5 h-3.5" />
                                <span>Filters</span>
                                <span v-if="activeFilterCount > 0" class="badge badge-xs badge-neutral">{{ activeFilterCount }}</span>
                            </button>

                            <div class="h-3 w-px bg-base-content/20 shrink-0 lg:hidden"></div>

                            <!-- Quick Pill: Active Stock -->
                            <button 
                                type="button"
                                @click="filterStatus = (filterStatus === 'active' ? 'all' : 'active')"
                                class="btn btn-xs rounded-full gap-1 font-bold shrink-0 transition-all"
                                :class="filterStatus === 'active' ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost bg-base-200/70 text-base-content/80 hover:bg-base-200'"
                                title="Toggle Active On-Hand Stock"
                            >
                                <Icon icon="solar:box-minimalistic-bold" class="w-3 h-3" />
                                <span>Active Stock</span>
                                <span class="badge badge-xs" :class="filterStatus === 'active' ? 'badge-neutral' : 'badge-ghost'">{{ countByStatus('active') }}</span>
                            </button>

                            <!-- Quick Pill: Ready to List -->
                            <button 
                                type="button"
                                @click="insightFilter = (insightFilter === 'ready_to_list' ? '' : 'ready_to_list')"
                                class="btn btn-xs rounded-full gap-1 font-bold shrink-0 transition-all"
                                :class="insightFilter === 'ready_to_list' ? 'btn-secondary text-secondary-content shadow-xs' : 'btn-ghost bg-base-200/70 text-base-content/80 hover:bg-base-200'"
                                title="Items with photos, pricing, and descriptions ready"
                            >
                                <Icon icon="solar:checklist-linear" class="w-3 h-3" />
                                <span>Ready to List</span>
                                <span class="badge badge-xs badge-ghost">{{ readyToListCount }}</span>
                            </button>

                            <!-- Quick Pill: Missing Photos -->
                            <button 
                                type="button"
                                @click="insightFilter = (insightFilter === 'missing_photos' ? '' : 'missing_photos')"
                                class="btn btn-xs rounded-full gap-1 font-bold shrink-0 transition-all"
                                :class="insightFilter === 'missing_photos' ? 'bg-error text-error-content shadow-xs' : 'btn-ghost bg-base-200/70 text-base-content/80 hover:bg-base-200'"
                                title="Items needing photo uploads"
                            >
                                <Icon icon="solar:camera-linear" class="w-3 h-3" />
                                <span>Missing Photos</span>
                                <span class="badge badge-xs badge-ghost">{{ missingPhotosCount }}</span>
                            </button>

                            <!-- Quick Pill: Missing Pricing -->
                            <button 
                                type="button"
                                @click="insightFilter = (insightFilter === 'missing_est_value' ? '' : 'missing_est_value')"
                                class="btn btn-xs rounded-full gap-1 font-bold shrink-0 transition-all"
                                :class="insightFilter === 'missing_est_value' ? 'bg-warning text-warning-content shadow-xs' : 'btn-ghost bg-base-200/70 text-base-content/80 hover:bg-base-200'"
                                title="Items needing pricing"
                            >
                                <Icon icon="solar:dollar-linear" class="w-3 h-3" />
                                <span>Missing Pricing</span>
                                <span class="badge badge-xs badge-ghost">{{ missingPricingCount }}</span>
                            </button>

                            <!-- Quick Location Select Dropdown Pill -->
                            <div class="shrink-0">
                                <select 
                                    v-model="filterBinLocation" 
                                    class="select select-bordered select-xs rounded-full h-6 min-h-6 text-[11px] font-bold bg-base-200/70 shrink-0"
                                >
                                    <option value="">All Locations</option>
                                    <option v-for="loc in allAvailableLocations" :key="loc.value || loc" :value="loc.value || loc">{{ loc.label || loc }}</option>
                                </select>
                            </div>

                            <!-- Clear / Reset button if filters active -->
                            <button 
                                v-if="activeFilterCount > 0" 
                                type="button" 
                                @click="clearAllFilters" 
                                class="btn btn-ghost btn-xs text-error font-bold shrink-0 hover:bg-error/10"
                                title="Reset all filters"
                            >
                                ✕ Reset
                            </button>
                        </div>
                    </div>
                </div>

                    <!-- SUBHEADER: SELECTION INDICATOR, MOBILE DENSITY SWITCHER & EXPORT -->
                    <div class="mt-2 rounded-xl border transition-all duration-200 bg-base-200/90 border-base-300 px-3 py-2 flex flex-col gap-2"
                         :class="selectedItems.length > 0 ? 'bg-primary/10 border-primary/50 shadow-xs' : ''">
                        
                        <div class="flex items-center justify-between gap-2">
                            <!-- Left: Checkbox + Selection label -->
                            <div class="flex items-center gap-2 sm:gap-3 min-w-0">
                                <label class="flex items-center gap-2 cursor-pointer select-none">
                                    <input 
                                        type="checkbox" 
                                        :checked="isAllSelected" 
                                        @change="toggleAll" 
                                        class="checkbox checkbox-xs sm:checkbox-sm checkbox-primary shrink-0" 
                                    />
                                    <span v-if="selectedItems.length === 0" class="text-xs sm:text-sm font-semibold truncate text-base-content/80">
                                        Select all items
                                    </span>
                                    <span v-else class="text-xs sm:text-sm font-bold text-primary truncate">
                                        {{ selectedItems.length }} item{{ selectedItems.length > 1 ? 's' : '' }} selected
                                    </span>
                                    <span class="text-xs opacity-50 shrink-0">({{ filteredInventory.length }})</span>
                                </label>

                                <!-- Quick Clear button when items are selected -->
                                <button 
                                    v-if="selectedItems.length > 0" 
                                    class="btn btn-xs btn-ghost text-error font-bold hover:bg-error/15 h-7 min-h-7 px-2 shrink-0" 
                                    @click="selectedItems = []"
                                    title="Clear selection"
                                >
                                    ✕ Clear
                                </button>
                            </div>
                            
                            <!-- Right: Mobile Density Switcher & Export -->
                            <div class="flex items-center gap-1.5 shrink-0">
                                <!-- Mobile Density Switcher: List vs Grid -->
                                <div class="join sm:hidden bg-base-100 p-0.5 rounded-lg border border-base-300">
                                    <button 
                                        type="button" 
                                        class="join-item btn btn-xs gap-1 font-bold transition-all px-2 h-7 min-h-7"
                                        :class="mobileLayout === 'list' ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost opacity-70 hover:opacity-100'"
                                        @click="setMobileLayout('list')"
                                        title="1-Column Mobile Feed"
                                    >
                                        <Icon icon="solar:list-linear" class="w-3.5 h-3.5" />
                                        <span class="text-[10px]">List</span>
                                    </button>
                                    <button 
                                        type="button" 
                                        class="join-item btn btn-xs gap-1 font-bold transition-all px-2 h-7 min-h-7"
                                        :class="mobileLayout === 'grid' ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost opacity-70 hover:opacity-100'"
                                        @click="setMobileLayout('grid')"
                                        title="2-Column Visual Card Grid"
                                    >
                                        <Icon icon="solar:gallery-wide-linear" class="w-3.5 h-3.5" />
                                        <span class="text-[10px]">Grid</span>
                                    </button>
                                </div>

                                <!-- Export Dropdown -->
                                <div class="dropdown dropdown-end">
                                    <div tabindex="0" role="button" class="btn btn-xs btn-ghost gap-1 opacity-80 hover:opacity-100 border border-base-300 bg-base-100 font-bold h-7 min-h-7">
                                        <Icon icon="solar:file-download-linear" class="w-3.5 h-3.5" />
                                        <span>Export {{ selectedItems.length > 0 ? `(${selectedItems.length})` : 'All' }} ▾</span>
                                    </div>
                                    <ul tabindex="0" class="dropdown-content z-50 menu p-2 shadow-xl bg-base-100 rounded-box w-56 border border-base-300 text-xs font-bold space-y-1">
                                        <li>
                                            <a @click="exportCsv('ricochet')" class="text-primary hover:bg-primary/10">
                                                <Icon icon="solar:shop-2-bold" class="w-4 h-4 text-primary" />
                                                <span>Memory Den (Ricochet)</span>
                                            </a>
                                        </li>
                                        <li>
                                            <a @click="exportCsv('ebay')">
                                                <Icon icon="solar:tag-price-linear" class="w-4 h-4 text-warning" />
                                                <span>eBay Seller Hub</span>
                                            </a>
                                        </li>
                                        <li>
                                            <a @click="exportCsv('poshmark')">
                                                <Icon icon="solar:hanger-linear" class="w-4 h-4 text-secondary" />
                                                <span>Poshmark</span>
                                            </a>
                                        </li>
                                        <div class="divider my-0.5"></div>
                                        <li>
                                            <a @click="exportCsv('generic')">
                                                <Icon icon="solar:document-text-linear" class="w-4 h-4" />
                                                <span>Generic CSV</span>
                                            </a>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <!-- Admin Auto-Heal row (only when insight filter active AND items selected) -->
                        <div v-if="insightFilter && selectedItems.length > 0" class="pt-2 border-t border-primary/20">
                            <div class="text-[10px] uppercase font-bold opacity-60 text-warning mb-1.5 flex items-center gap-1">
                                <Icon icon="solar:shield-warning-bold-duotone" class="w-3 h-3" /> Auto-Heal: {{ insightFilter.replace(/_/g, ' ') }}
                            </div>
                            <button v-if="insightFilter === 'missing_est_value'" class="btn btn-xs btn-warning w-full" @click="runAutoEstimatorAdmin" :disabled="isEstimating">
                                <span v-if="isEstimating" class="loading loading-spinner loading-xs"></span>
                                <Icon v-else icon="solar:magic-stick-3-bold-duotone" class="w-3.5 h-3.5" />
                                {{ isEstimating ? 'Estimating ' + bulkProgress + '/' + bulkTotal : 'Auto-Estimate ' + selectedItems.length + ' Items' }}
                            </button>
                            <button v-if="insightFilter === 'missing_sold_price'" class="btn btn-xs btn-warning w-full" @click="runAutoCalcSoldPrice" :disabled="isEstimating">
                                <span v-if="isEstimating" class="loading loading-spinner loading-xs"></span>
                                {{ isEstimating ? 'Calculating ' + bulkProgress + '/' + bulkTotal : 'Auto-Calc Sold Price for ' + selectedItems.length + ' Items' }}
                            </button>
                            <div v-if="insightFilter === 'missing_cost'" class="flex gap-2">
                                <label class="input input-bordered input-xs flex items-center gap-1 w-28 bg-base-100">
                                    <span class="opacity-50">$</span>
                                    <input type="number" step="0.01" v-model="bulkCostValue" class="grow" placeholder="0.00" />
                                </label>
                                <button class="btn btn-xs btn-warning flex-1" @click="runAutoCalcCost" :disabled="isEstimating || bulkCostValue === ''">
                                    <span v-if="isEstimating" class="loading loading-spinner loading-xs"></span>
                                    {{ isEstimating ? 'Processing...' : 'Set Cost for ' + selectedItems.length + ' Items' }}
                                </button>
                            </div>
                            <button v-if="insightFilter === 'missing_photos'" class="btn btn-xs btn-error w-full" @click="runAutoFetchPhotos" :disabled="isEstimating">
                                <span v-if="isEstimating" class="loading loading-spinner loading-xs"></span>
                                {{ isEstimating ? 'Fetching ' + bulkProgress + '/' + bulkTotal : 'Auto-Fetch Photos for ' + selectedItems.length + ' Items' }}
                            </button>
                            <button v-if="insightFilter === 'missing_description'" class="btn btn-xs btn-info w-full" @click="runAutoGenerateDescriptions" :disabled="isEstimating">
                                <span v-if="isEstimating" class="loading loading-spinner loading-xs"></span>
                                {{ isEstimating ? 'Generating ' + bulkProgress + '/' + bulkTotal : 'Auto-Generate Descriptions for ' + selectedItems.length + ' Items' }}
                            </button>
                        </div>
                    </div>

                    <!-- 🔗 ACTIVE LINEAGE & PO FILTER BANNER -->
                    <div v-if="filterParentLotId || filterPO || filterSO" class="bg-base-200 border border-primary/30 rounded-2xl p-3.5 flex items-center justify-between shadow-xs mb-4">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <div class="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
                                <Icon icon="solar:filter-bold" class="w-4 h-4" />
                            </div>
                            <div class="min-w-0 text-xs">
                                <span v-if="filterParentLotId" class="block font-bold truncate">
                                    <span class="opacity-70">Filtered by Lot:</span> 
                                    <span class="text-primary ml-1 font-mono">{{ filterParentLotTitle || filterParentLotId }}</span>
                                    <span class="badge badge-xs badge-primary ml-2">{{ filteredInventory.length }} items</span>
                                </span>
                                <span v-else-if="filterPO" class="block font-bold truncate">
                                    <span class="opacity-70">Filtered by Purchase Order:</span> 
                                    <span class="text-secondary ml-1 font-mono">{{ filterPO }}</span>
                                    <span class="badge badge-xs badge-secondary ml-2">{{ filteredInventory.length }} items</span>
                                </span>
                                <span v-else-if="filterSO" class="block font-bold truncate">
                                    <span class="opacity-70">Filtered by Sales Order:</span> 
                                    <span class="text-success ml-1 font-mono">{{ filterSO }}</span>
                                    <span class="badge badge-xs badge-success ml-2">{{ filteredInventory.length }} items</span>
                                </span>
                                <span class="text-[10px] opacity-60">Showing only records linked to this lineage</span>
                            </div>
                        </div>
                        <button class="btn btn-xs btn-ghost btn-circle shrink-0" @click="clearLineageFilters" title="Clear Filter">✕</button>
                    </div>

            <div v-if="filteredInventory.length === 0 && !loading && !error" class="text-center py-12 bg-base-200 rounded-xl border-dashed border-2 border-base-300">
                <p class="text-lg opacity-60 mb-4">No items in inventory matching your filters.</p>
                <button class="btn btn-sm btn-outline" @click="clearAllFilters">Clear Filters</button>
            </div>
            
            <div v-else class="pb-32">
                <!-- RESPONSIVE MOBILE FEED (1-COL LIST OR 2-COL GRID) / MULTI-COLUMN DESKTOP -->
                <div :class="mobileLayout === 'list' 
                    ? 'grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5' 
                    : 'grid gap-2.5 sm:gap-3 md:gap-4 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'">
                    <ItemCard 
                        v-for="item in displayedInventory" 
                        :key="item.$id" 
                        :item="item"
                        :compact="true"
                        :horizontal="mobileLayout === 'list'"
                        :selected="selectedItems.includes(item.$id)"
                        @click-card="openPreview(item)"
                        @toggle-select="toggleItemSelection(item.$id)"
                        :class="{'ring-2 ring-primary': selectedItems.includes(item.$id)}">
                        
                        <template #absolute-top-left>
                            <!-- Expanded hit area for reliable one-tap selection -->
                            <label class="z-20 p-2 -m-1.5 flex items-center justify-center cursor-pointer touch-manipulation active:scale-90 transition-transform" @click.stop title="Select Item">
                                <input type="checkbox" :value="item.$id" v-model="selectedItems" class="checkbox checkbox-xs sm:checkbox-sm checkbox-primary shadow-xs cursor-pointer border-none bg-white/80 ring-1 ring-white/50" />
                            </label>
                        </template>

                        <template #actions>
                            <div :class="mobileLayout === 'list' ? 'flex items-center gap-1' : 'grid grid-cols-3 gap-1 w-full mt-1.5 pt-1.5 border-t border-base-200/60 z-10'" @click.stop>
                                <button @click="copyShareLink(item.$id)" class="btn btn-ghost btn-xs h-7.5 min-h-7.5 px-1.5 text-[11px] font-bold opacity-75 hover:opacity-100 active:scale-95 flex items-center justify-center gap-1 rounded-lg touch-manipulation" title="Copy shareable link">
                                    <Icon icon="solar:link-linear" class="w-3.5 h-3.5" /> <span class="hidden sm:inline">Share</span>
                                </button>
                                <button @click="openEdit(item)" class="btn btn-ghost btn-xs h-7.5 min-h-7.5 px-1.5 text-[11px] font-bold opacity-80 hover:opacity-100 hover:text-primary active:scale-95 flex items-center justify-center gap-1 rounded-lg touch-manipulation" title="Edit item">
                                    <Icon icon="solar:pen-linear" class="w-3.5 h-3.5" /> <span class="hidden sm:inline">Edit</span>
                                </button>
                                <button @click="confirmDelete(item.$id)" class="btn btn-ghost btn-xs h-7.5 min-h-7.5 px-1.5 text-[11px] font-bold text-error opacity-80 hover:opacity-100 hover:bg-error/10 active:scale-95 flex items-center justify-center gap-1 rounded-lg touch-manipulation" :disabled="processingId === item.$id" title="Delete item">
                                    <span v-if="processingId === item.$id" class="loading loading-spinner loading-xs"></span>
                                    <span v-else><Icon icon="solar:trash-bin-trash-linear" class="w-3.5 h-3.5" /> <span class="hidden sm:inline">Del</span></span>
                                </button>
                            </div>
                        </template>
                    </ItemCard>
                </div>

                <!-- Floating Bottom Integrated Pagination & Contextual Command Tray -->
                <InventoryPaginationDock 
                    ref="dockRef"
                    v-model:currentPage="gridPage"
                    v-model:pageSize="gridPageSize"
                    :pageSizeOptions="gridPageSizeOptions"
                    :totalPages="gridTotalPages"
                    :totalItems="filteredInventory.length"
                    :totalUnfiltered="inventoryItems.length"
                    :selectedCount="selectedItems.length"
                    :activeFilterCount="activeFilterCount"
                    :isLoading="loading"
                    v-model:filterLocation="filterBinLocation"
                    v-model:filterStatus="filterStatus"
                    v-model:filterChannel="filterChannel"
                    :locations="allAvailableLocations"
                    :channels="allAvailableChannels"
                    :isProcessing="processingBulk || processingBulkLoc || processingBulkChannel"
                    :showBundle="selectedItems.length >= 2"
                    :showCombine="selectedItems.length >= 2"
                    @apply-location="onDockApplyLocation"
                    @apply-status="onDockApplyStatus"
                    @apply-channel="onDockApplyChannel"
                    @export="exportCsv"
                    @clear-selection="selectedItems = []"
                    @clear-filters="clearAllFilters"
                    @bundle="openBundleModal"
                    @combine="openCombineModal"
                    @add="openAdd"
                    @delete="handleBulkDelete"
                    @import-csv="showImport = true"
                >
                    <template #filters>
                        <div class="space-y-3 text-xs">
                            <!-- 1. Status Pipeline (Collapsible, open by default) -->
                            <details class="collapse collapse-arrow bg-base-200/50 border border-base-300/70 rounded-xl shadow-2xs" open>
                                <summary class="collapse-title text-xs font-bold uppercase tracking-wider opacity-80 min-h-0 py-2.5 px-3 flex items-center justify-between">
                                    <span>Status Pipeline</span>
                                    <span v-if="filterStatus !== 'active' && filterStatus !== 'all'" class="badge badge-xs badge-warning mr-4 uppercase text-[9px] font-bold">{{ filterStatus }}</span>
                                </summary>
                                <div class="collapse-content px-3 pb-3 pt-0">
                                    <ul class="menu menu-xs p-0 gap-0.5 w-full">
                                        <li>
                                            <button :class="{'active font-bold text-primary': filterStatus === 'active'}" @click="filterStatus = 'active'">
                                                <Icon icon="solar:box-minimalistic-bold" class="w-3.5 h-3.5" />
                                                <span>Active Stock</span>
                                                <span class="badge badge-xs badge-neutral">{{ countByStatus('active') }}</span>
                                            </button>
                                        </li>
                                        <li><button :class="{'active font-bold text-warning': filterStatus === 'acquired'}" @click="filterStatus = 'acquired'"><span>Acquired</span><span class="badge badge-xs">{{ countByStatus('acquired') }}</span></button></li>
                                        <li><button :class="{'active font-bold text-info': filterStatus === 'received'}" @click="filterStatus = 'received'"><span>Received</span><span class="badge badge-xs">{{ countByStatus('received') }}</span></button></li>
                                        <li><button :class="{'active font-bold text-success': filterStatus === 'placed'}" @click="filterStatus = 'placed'"><span>Placed</span><span class="badge badge-xs">{{ countByStatus('placed') }}</span></button></li>
                                        <li><button :class="{'active font-bold text-secondary': filterStatus === 'tracked'}" @click="filterStatus = 'tracked'"><span>Tracked</span><span class="badge badge-xs">{{ countByStatus('tracked') }}</span></button></li>
                                        <li><button :class="{'active font-bold opacity-75': filterStatus === 'sold'}" @click="filterStatus = 'sold'"><span>Sold</span><span class="badge badge-xs">{{ countByStatus('sold') }}</span></button></li>
                                        <li><button :class="{'active font-bold': filterStatus === 'all'}" @click="filterStatus = 'all'"><span>All Items</span><span class="badge badge-xs">{{ inventoryItems.length }}</span></button></li>
                                    </ul>
                                </div>
                            </details>

                            <!-- 2. Location & Channels -->
                            <details class="collapse collapse-arrow bg-base-200/50 border border-base-300/70 rounded-xl shadow-2xs" :open="!!filterBinLocation || !!filterChannel || filterLotType !== 'all'">
                                <summary class="collapse-title text-xs font-bold uppercase tracking-wider opacity-80 min-h-0 py-2.5 px-3 flex items-center justify-between">
                                    <span>Location &amp; Channels</span>
                                    <span v-if="filterBinLocation || filterChannel" class="badge badge-xs badge-primary mr-4 text-[9px] font-bold">Active</span>
                                </summary>
                                <div class="collapse-content px-3 pb-3 pt-0 space-y-2">
                                    <div class="form-control w-full">
                                        <label class="label pt-1 pb-0.5"><span class="label-text text-[10px] uppercase font-bold opacity-60">Location / Booth</span></label>
                                        <select v-model="filterBinLocation" class="select select-bordered select-xs w-full bg-base-100 font-bold">
                                            <option value="">All Locations</option>
                                            <option v-for="loc in allAvailableLocations" :key="loc.value || loc" :value="loc.value || loc">{{ loc.label || loc }}</option>
                                        </select>
                                    </div>

                                    <div class="form-control w-full">
                                        <label class="label pt-1 pb-0.5"><span class="label-text text-[10px] uppercase font-bold opacity-60">Sales Channel</span></label>
                                        <select v-model="filterChannel" class="select select-bordered select-xs w-full bg-base-100 font-bold">
                                            <option value="">All Channels</option>
                                            <option v-for="ch in allAvailableChannels" :key="ch" :value="ch">{{ ch }}</option>
                                        </select>
                                    </div>

                                    <div class="form-control w-full">
                                        <label class="label pt-1 pb-0.5"><span class="label-text text-[10px] uppercase font-bold opacity-60">Lot Type</span></label>
                                        <select v-model="filterLotType" class="select select-bordered select-xs w-full bg-base-100 font-bold">
                                            <option value="all">All Items</option>
                                            <option value="lots_only">Parent Lots Only</option>
                                            <option value="extracted_only">Extracted Children Only</option>
                                            <option value="standalone_only">Standalone Items</option>
                                        </select>
                                    </div>
                                </div>
                            </details>

                            <!-- 3. Exclusions ("No-Show") Toggles -->
                            <details class="collapse collapse-arrow bg-base-200/50 border border-base-300/70 rounded-xl shadow-2xs" :open="hideSold || hideTracked || hideCombined || filterFlaggedLocated">
                                <summary class="collapse-title text-xs font-bold uppercase tracking-wider opacity-80 min-h-0 py-2.5 px-3 flex items-center justify-between">
                                    <span>Exclusions ("No-Show")</span>
                                </summary>
                                <div class="collapse-content px-3 pb-3 pt-0 space-y-1">
                                    <label class="label cursor-pointer py-1 justify-between hover:bg-base-200/40 rounded-lg px-1">
                                        <span class="label-text text-xs font-semibold text-base-content">Hide Sold Items</span>
                                        <input type="checkbox" v-model="hideSold" class="checkbox checkbox-xs checkbox-primary" />
                                    </label>
                                    <label class="label cursor-pointer py-1 justify-between hover:bg-base-200/40 rounded-lg px-1">
                                        <span class="label-text text-xs font-semibold text-base-content">Hide Trackers / Unacquired</span>
                                        <input type="checkbox" v-model="hideTracked" class="checkbox checkbox-xs checkbox-primary" />
                                    </label>
                                    <label class="label cursor-pointer py-1 justify-between hover:bg-base-200/40 rounded-lg px-1">
                                        <span class="label-text text-xs font-semibold text-base-content">Hide Merged Lots</span>
                                        <input type="checkbox" v-model="hideCombined" class="checkbox checkbox-xs checkbox-primary" />
                                    </label>
                                    <label class="label cursor-pointer py-1 justify-between hover:bg-base-200/40 rounded-lg px-1">
                                        <span class="label-text text-xs font-semibold text-base-content">Only Placed & Located</span>
                                        <input type="checkbox" v-model="filterFlaggedLocated" class="checkbox checkbox-xs checkbox-primary" />
                                    </label>
                                </div>
                            </details>

                            <!-- 4. AI Health Insights -->
                            <details class="collapse collapse-arrow bg-base-200/50 border border-base-300/70 rounded-xl shadow-2xs" :open="!!insightFilter">
                                <summary class="collapse-title text-xs font-bold uppercase tracking-wider opacity-80 min-h-0 py-2.5 px-3 flex items-center justify-between">
                                    <span>AI Health Insights</span>
                                    <span v-if="insightFilter" class="badge badge-xs badge-secondary mr-4 text-[9px] font-bold">Active</span>
                                </summary>
                                <div class="collapse-content px-3 pb-3 pt-0 space-y-1.5">
                                    <button class="btn btn-xs w-full justify-between" :class="insightFilter === 'ready_to_list' ? 'btn-primary font-bold shadow-xs' : 'btn-outline border-base-300'" @click="insightFilter = insightFilter === 'ready_to_list' ? '' : 'ready_to_list'">
                                        <span class="flex items-center gap-1"><Icon icon="solar:checklist-linear" class="w-3.5 h-3.5 text-primary" /> Ready to List</span>
                                        <span class="badge badge-xs font-mono font-bold">{{ readyToListCount }}</span>
                                    </button>
                                    <button class="btn btn-xs w-full justify-between" :class="insightFilter === 'missing_photos' ? 'btn-error font-bold shadow-xs' : 'btn-outline border-base-300'" @click="insightFilter = insightFilter === 'missing_photos' ? '' : 'missing_photos'">
                                        <span class="flex items-center gap-1"><Icon icon="solar:camera-linear" class="w-3.5 h-3.5 text-error" /> Missing Photos</span>
                                        <span class="badge badge-xs font-mono font-bold">{{ missingPhotosCount }}</span>
                                    </button>
                                    <button class="btn btn-xs w-full justify-between" :class="insightFilter === 'missing_est_value' ? 'btn-warning font-bold shadow-xs' : 'btn-outline border-base-300'" @click="insightFilter = insightFilter === 'missing_est_value' ? '' : 'missing_est_value'">
                                        <span class="flex items-center gap-1"><Icon icon="solar:dollar-linear" class="w-3.5 h-3.5 text-warning" /> Missing Pricing</span>
                                        <span class="badge badge-xs font-mono font-bold">{{ missingPricingCount }}</span>
                                    </button>
                                </div>
                            </details>

                            <!-- 5. Barcodes & Prefixes -->
                            <details class="collapse collapse-arrow bg-base-200/50 border border-base-300/70 rounded-xl shadow-2xs" :open="!!filterUpcPrefix">
                                <summary class="collapse-title text-xs font-bold uppercase tracking-wider opacity-80 min-h-0 py-2.5 px-3 flex items-center justify-between">
                                    <span>Barcodes &amp; Prefixes</span>
                                    <span v-if="filterUpcPrefix" class="badge badge-xs badge-primary mr-4 text-[9px] font-mono font-bold">{{ filterUpcPrefix }}</span>
                                </summary>
                                <div class="collapse-content px-3 pb-3 pt-0 space-y-1.5">
                                    <div class="flex flex-wrap gap-1">
                                        <button 
                                            v-for="p in allAvailableUpcPrefixes.filter(x => x.prefix !== '__missing__').slice(0, 6)" 
                                            :key="p.prefix" 
                                            class="badge badge-xs font-mono cursor-pointer transition-colors px-1.5 py-2 font-bold" 
                                            :class="filterUpcPrefix === p.prefix ? 'badge-primary font-bold shadow-xs ring-1 ring-primary' : 'badge-outline'" 
                                            @click="filterUpcPrefix = filterUpcPrefix === p.prefix ? '' : p.prefix"
                                        >
                                            {{ p.prefix }} <span class="text-[8px] opacity-60 ml-0.5">{{ p.count }}</span>
                                        </button>
                                        <button 
                                            v-if="allAvailableUpcPrefixes.find(x => x.prefix === '__missing__')" 
                                            class="badge badge-xs cursor-pointer transition-colors px-1.5 py-2 font-bold" 
                                            :class="filterUpcPrefix === '__missing__' ? 'badge-error font-bold shadow-xs' : 'badge-outline'" 
                                            @click="filterUpcPrefix = filterUpcPrefix === '__missing__' ? '' : '__missing__'"
                                        >
                                            No Barcode
                                        </button>
                                    </div>
                                    <input 
                                        type="text" 
                                        v-model="filterUpcPrefix" 
                                        placeholder="Custom prefix..." 
                                        class="input input-bordered input-xs font-mono w-full bg-base-100 text-xs mt-1" 
                                    />
                                </div>
                            </details>
                        </div>
                    </template>
                </InventoryPaginationDock>
            </div> <!-- End v-else -->

            <!-- ALL ITEMS LOADED -->
            </div> <!-- End drawer-content -->

            <!-- LEFT COMMAND & FILTERS SIDEBAR (Desktop Only) -->
            <div class="drawer-side z-50 lg:z-auto h-dvh max-h-dvh min-h-screen lg:h-auto lg:max-h-none hidden lg:block">
                <label for="inventory-sidebar" aria-label="close sidebar" class="drawer-overlay bg-black/60 backdrop-blur-xs"></label> 
                <div class="w-[90vw] max-w-sm sm:w-80 lg:w-64 h-dvh min-h-dvh max-h-dvh self-stretch lg:self-auto lg:h-auto lg:min-h-full lg:max-h-none bg-base-100 lg:bg-transparent border-r lg:border-transparent border-base-200 text-base-content flex flex-col justify-between shadow-2xl lg:shadow-none overflow-hidden p-3.5 sm:p-4 lg:p-0">
                    
                    <!-- Sticky Header with Active Count & Quick Reset -->
                    <div class="shrink-0 flex justify-between items-center pb-2.5 mb-1 border-b border-base-300">
                        <div class="flex items-center gap-2">
                            <Icon icon="solar:tuning-square-2-bold-duotone" class="w-5 h-5 text-primary" />
                            <span class="font-black text-base text-base-content">Filters</span>
                            <span v-if="activeFilterCount > 0" class="badge badge-xs badge-primary font-mono font-bold px-1.5 py-0.5">
                                {{ activeFilterCount }} Active
                            </span>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <button 
                                v-if="activeFilterCount > 0"
                                type="button" 
                                class="btn btn-ghost btn-xs text-error font-bold hover:bg-error/15 h-7 min-h-7 px-2"
                                @click="clearAllFilters"
                                title="Reset all filters to default"
                            >
                                Reset All
                            </button>
                            <label for="inventory-sidebar" class="btn btn-sm btn-circle btn-ghost text-base-content/70 hover:text-base-content lg:hidden">✕</label>
                        </div>
                    </div>

                    <!-- Scrollable Filter Accordions Container -->
                    <div class="flex-1 overflow-y-auto space-y-2.5 py-1.5 pr-0.5 scrollbar-thin">
                        
                        <!-- 1. Status Pipeline (Collapsible, open by default) -->
                        <details class="collapse collapse-arrow bg-base-200/50 border border-base-300/70 rounded-xl shadow-2xs" open>
                            <summary class="collapse-title text-xs font-bold uppercase tracking-wider opacity-80 min-h-0 py-2.5 px-3 flex items-center justify-between">
                                <span>Status Pipeline</span>
                                <span v-if="filterStatus !== 'active' && filterStatus !== 'all'" class="badge badge-xs badge-warning mr-4 uppercase text-[9px] font-bold">{{ filterStatus }}</span>
                            </summary>
                            <div class="collapse-content px-3 pb-3 pt-0">
                                <ul class="menu menu-xs p-0 gap-0.5 w-full">
                                    <li>
                                        <button :class="{'active font-bold text-primary': filterStatus === 'active'}" @click="filterStatus = 'active'">
                                            <Icon icon="solar:box-minimalistic-bold" class="w-3.5 h-3.5" />
                                            <span>Active Stock</span>
                                            <span class="badge badge-xs badge-neutral">{{ countByStatus('active') }}</span>
                                        </button>
                                    </li>
                                    <li><button :class="{'active font-bold text-warning': filterStatus === 'acquired'}" @click="filterStatus = 'acquired'"><span>Acquired</span><span class="badge badge-xs">{{ countByStatus('acquired') }}</span></button></li>
                                    <li><button :class="{'active font-bold text-info': filterStatus === 'received'}" @click="filterStatus = 'received'"><span>Received</span><span class="badge badge-xs">{{ countByStatus('received') }}</span></button></li>
                                    <li><button :class="{'active font-bold text-success': filterStatus === 'placed'}" @click="filterStatus = 'placed'"><span>Placed</span><span class="badge badge-xs">{{ countByStatus('placed') }}</span></button></li>
                                    <li><button :class="{'active font-bold text-secondary': filterStatus === 'tracked'}" @click="filterStatus = 'tracked'"><span>Tracked</span><span class="badge badge-xs">{{ countByStatus('tracked') }}</span></button></li>
                                    <li><button :class="{'active font-bold opacity-75': filterStatus === 'sold'}" @click="filterStatus = 'sold'"><span>Sold</span><span class="badge badge-xs">{{ countByStatus('sold') }}</span></button></li>
                                    <li><button :class="{'active font-bold': filterStatus === 'all'}" @click="filterStatus = 'all'"><span>All Items</span><span class="badge badge-xs">{{ inventoryItems.length }}</span></button></li>
                                </ul>
                            </div>
                        </details>

                        <!-- 2. Location & Channels (Collapsible, open if filtered) -->
                        <details class="collapse collapse-arrow bg-base-200/50 border border-base-300/70 rounded-xl shadow-2xs" :open="!!filterBinLocation || !!filterChannel || filterLotType !== 'all'">
                            <summary class="collapse-title text-xs font-bold uppercase tracking-wider opacity-80 min-h-0 py-2.5 px-3 flex items-center justify-between">
                                <span>Location &amp; Channels</span>
                                <span v-if="filterBinLocation || filterChannel" class="badge badge-xs badge-primary mr-4 text-[9px] font-bold">Active</span>
                            </summary>
                            <div class="collapse-content px-3 pb-3 pt-0 space-y-2">
                                <div class="form-control w-full">
                                    <label class="label pt-1 pb-0.5"><span class="label-text text-[10px] uppercase font-bold opacity-60">Location / Booth</span></label>
                                    <select v-model="filterBinLocation" class="select select-bordered select-xs w-full bg-base-100 font-bold">
                                        <option value="">All Locations</option>
                                        <option v-for="loc in allAvailableLocations" :key="loc.value || loc" :value="loc.value || loc">{{ loc.label || loc }}</option>
                                    </select>
                                </div>

                                <div class="form-control w-full">
                                    <label class="label pt-1 pb-0.5"><span class="label-text text-[10px] uppercase font-bold opacity-60">Sales Channel</span></label>
                                    <select v-model="filterChannel" class="select select-bordered select-xs w-full bg-base-100 font-bold">
                                        <option value="">All Channels</option>
                                        <option v-for="ch in allAvailableChannels" :key="ch" :value="ch">{{ ch }}</option>
                                    </select>
                                </div>

                                <div class="form-control w-full">
                                    <label class="label pt-1 pb-0.5"><span class="label-text text-[10px] uppercase font-bold opacity-60">Lot Type</span></label>
                                    <select v-model="filterLotType" class="select select-bordered select-xs w-full bg-base-100 font-bold">
                                        <option value="all">All Items</option>
                                        <option value="lots_only">Parent Lots Only</option>
                                        <option value="extracted_only">Extracted Children Only</option>
                                        <option value="standalone_only">Standalone Items</option>
                                    </select>
                                </div>

                                <div class="form-control w-full">
                                    <label class="label pt-1 pb-0.5"><span class="label-text text-[10px] uppercase font-bold opacity-60">Keywords</span></label>
                                    <TagInput 
                                        v-model="filterKeywords" 
                                        type="keyword" 
                                        placeholder="Any..." 
                                        badgeClass="badge-secondary" 
                                    />
                                </div>
                            </div>
                        </details>

                        <!-- 3. Exclusions ("No-Show") Toggles -->
                        <details class="collapse collapse-arrow bg-base-200/50 border border-base-300/70 rounded-xl shadow-2xs" :open="hideSold || hideTracked || hideCombined || filterFlaggedLocated">
                            <summary class="collapse-title text-xs font-bold uppercase tracking-wider opacity-80 min-h-0 py-2.5 px-3 flex items-center justify-between">
                                <span>Exclusions ("No-Show")</span>
                            </summary>
                            <div class="collapse-content px-3 pb-3 pt-0 space-y-1">
                                <label class="label cursor-pointer py-1 justify-between hover:bg-base-200/40 rounded-lg px-1">
                                    <span class="label-text text-xs font-semibold text-base-content">Hide Sold Items</span>
                                    <input type="checkbox" v-model="hideSold" class="checkbox checkbox-xs checkbox-primary" />
                                </label>
                                <label class="label cursor-pointer py-1 justify-between hover:bg-base-200/40 rounded-lg px-1">
                                    <span class="label-text text-xs font-semibold text-base-content">Hide Trackers / Unacquired</span>
                                    <input type="checkbox" v-model="hideTracked" class="checkbox checkbox-xs checkbox-primary" />
                                </label>
                                <label class="label cursor-pointer py-1 justify-between hover:bg-base-200/40 rounded-lg px-1">
                                    <span class="label-text text-xs font-semibold text-base-content">Hide Merged Lots</span>
                                    <input type="checkbox" v-model="hideCombined" class="checkbox checkbox-xs checkbox-primary" />
                                </label>
                                <label class="label cursor-pointer py-1 justify-between hover:bg-base-200/40 rounded-lg px-1">
                                    <span class="label-text text-xs font-semibold text-base-content">Only Placed &amp; Located</span>
                                    <input type="checkbox" v-model="filterFlaggedLocated" class="checkbox checkbox-xs checkbox-primary" />
                                </label>
                            </div>
                        </details>

                        <!-- 4. AI Health Insights -->
                        <details class="collapse collapse-arrow bg-base-200/50 border border-base-300/70 rounded-xl shadow-2xs" :open="!!insightFilter">
                            <summary class="collapse-title text-xs font-bold uppercase tracking-wider opacity-80 min-h-0 py-2.5 px-3 flex items-center justify-between">
                                <span>AI Health Insights</span>
                                <span v-if="insightFilter" class="badge badge-xs badge-secondary mr-4 text-[9px] font-bold">Active</span>
                            </summary>
                            <div class="collapse-content px-3 pb-3 pt-0 space-y-1.5">
                                <button class="btn btn-xs w-full justify-between" :class="insightFilter === 'ready_to_list' ? 'btn-primary font-bold shadow-xs' : 'btn-outline border-base-300'" @click="insightFilter = insightFilter === 'ready_to_list' ? '' : 'ready_to_list'">
                                    <span class="flex items-center gap-1"><Icon icon="solar:checklist-linear" class="w-3.5 h-3.5 text-primary" /> Ready to List</span>
                                    <span class="badge badge-xs font-mono font-bold">{{ readyToListCount }}</span>
                                </button>
                                <button class="btn btn-xs w-full justify-between" :class="insightFilter === 'missing_photos' ? 'btn-error font-bold shadow-xs' : 'btn-outline border-base-300'" @click="insightFilter = insightFilter === 'missing_photos' ? '' : 'missing_photos'">
                                    <span class="flex items-center gap-1"><Icon icon="solar:camera-linear" class="w-3.5 h-3.5 text-error" /> Missing Photos</span>
                                    <span class="badge badge-xs font-mono font-bold">{{ missingPhotosCount }}</span>
                                </button>
                                <button class="btn btn-xs w-full justify-between" :class="insightFilter === 'missing_est_value' ? 'btn-warning font-bold shadow-xs' : 'btn-outline border-base-300'" @click="insightFilter = insightFilter === 'missing_est_value' ? '' : 'missing_est_value'">
                                    <span class="flex items-center gap-1"><Icon icon="solar:dollar-linear" class="w-3.5 h-3.5 text-warning" /> Missing Pricing</span>
                                    <span class="badge badge-xs font-mono font-bold">{{ missingPricingCount }}</span>
                                </button>
                            </div>
                        </details>

                        <!-- 5. Barcodes & Prefixes -->
                        <details class="collapse collapse-arrow bg-base-200/50 border border-base-300/70 rounded-xl shadow-2xs" :open="!!filterUpcPrefix">
                            <summary class="collapse-title text-xs font-bold uppercase tracking-wider opacity-80 min-h-0 py-2.5 px-3 flex items-center justify-between">
                                <span>Barcodes &amp; Prefixes</span>
                                <span v-if="filterUpcPrefix" class="badge badge-xs badge-primary mr-4 text-[9px] font-mono font-bold">{{ filterUpcPrefix }}</span>
                            </summary>
                            <div class="collapse-content px-3 pb-3 pt-0 space-y-1.5">
                                <div class="flex flex-wrap gap-1">
                                    <button 
                                        v-for="p in allAvailableUpcPrefixes.filter(x => x.prefix !== '__missing__').slice(0, 6)" 
                                        :key="p.prefix" 
                                        class="badge badge-xs font-mono cursor-pointer transition-colors px-1.5 py-2 font-bold" 
                                        :class="filterUpcPrefix === p.prefix ? 'badge-primary font-bold shadow-xs ring-1 ring-primary' : 'badge-outline'" 
                                        @click="filterUpcPrefix = filterUpcPrefix === p.prefix ? '' : p.prefix"
                                    >
                                        {{ p.prefix }} <span class="text-[8px] opacity-60 ml-0.5">{{ p.count }}</span>
                                    </button>
                                    <button 
                                        v-if="allAvailableUpcPrefixes.find(x => x.prefix === '__missing__')" 
                                        class="badge badge-xs cursor-pointer transition-colors px-1.5 py-2 font-bold" 
                                        :class="filterUpcPrefix === '__missing__' ? 'badge-error font-bold shadow-xs' : 'badge-outline'" 
                                        @click="filterUpcPrefix = filterUpcPrefix === '__missing__' ? '' : '__missing__'"
                                    >
                                        No Barcode
                                    </button>
                                </div>
                                <input 
                                    type="text" 
                                    v-model="filterUpcPrefix" 
                                    placeholder="Custom prefix..." 
                                    class="input input-bordered input-xs font-mono w-full bg-base-100 text-xs mt-1" 
                                />
                            </div>
                        </details>

                        <!-- 6. Ingestion & Tools Hub -->
                        <details class="collapse collapse-arrow bg-base-200/50 border border-base-300/70 rounded-xl shadow-2xs">
                            <summary class="collapse-title text-xs font-bold uppercase tracking-wider opacity-80 min-h-0 py-2.5 px-3">
                                <span>Tools &amp; Imports</span>
                            </summary>
                            <div class="collapse-content px-3 pb-3 pt-0 space-y-2">
                                <button class="btn btn-sm btn-primary w-full gap-1.5 font-bold shadow-xs" @click="openAdd">
                                    <Icon icon="solar:add-circle-linear" class="w-4 h-4" /> Add New Item
                                </button>
                                
                                <div class="grid grid-cols-2 gap-1.5">
                                    <!-- Generate UPCs Dropdown -->
                                    <div class="dropdown">
                                        <div tabindex="0" role="button" class="btn btn-xs btn-outline btn-secondary gap-1 w-full font-bold">
                                            <Icon icon="solar:barcode-read-linear" class="w-3.5 h-3.5" /> UPCs
                                        </div>
                                        <ul tabindex="0" class="dropdown-content z-50 menu p-2 shadow-xl bg-base-100 border border-base-200 rounded-xl w-60 mt-1">
                                            <li class="menu-title text-[10px] uppercase font-bold opacity-60">Generate for Missing:</li>
                                            <li>
                                                <button @click="handleGenerateUpcs('HUCK-')" class="flex items-center justify-between py-1.5">
                                                    <span class="font-mono font-bold text-primary">HUCK-0001</span>
                                                    <span class="badge badge-xs badge-primary">Auto</span>
                                                </button>
                                            </li>
                                            <li>
                                                <button @click="handleGenerateUpcs('PDXGL-')" class="flex items-center justify-between py-1.5">
                                                    <span class="font-mono font-bold text-secondary">PDXGL-0001</span>
                                                    <span class="badge badge-xs badge-secondary">Auto</span>
                                                </button>
                                            </li>
                                            <div class="divider my-1"></div>
                                            <li>
                                                <button @click="handleCustomGenerateUpcs" class="flex items-center gap-2 py-1.5 text-xs">
                                                    <Icon icon="solar:pen-new-square-linear" class="w-3.5 h-3.5" />
                                                    <span>Custom Prefix...</span>
                                                </button>
                                            </li>
                                        </ul>
                                    </div>

                                    <!-- Import Dropdown -->
                                    <div class="dropdown">
                                        <div tabindex="0" role="button" class="btn btn-xs btn-outline gap-1 w-full font-bold">
                                            <Icon icon="solar:import-linear" class="w-3.5 h-3.5" /> Import
                                        </div>
                                        <ul tabindex="0" class="dropdown-content z-50 menu p-2 shadow-xl bg-base-100 border border-base-200 rounded-xl w-60 mt-1">
                                            <li>
                                                <button class="flex items-start gap-2 py-2" @click="showImport = true">
                                                    <Icon icon="solar:document-text-linear" class="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                                                    <div>
                                                        <div class="font-bold text-xs">ShopGoodwill CSV</div>
                                                        <div class="text-[10px] opacity-60">Bought &amp; shipped items</div>
                                                    </div>
                                                </button>
                                            </li>
                                            <li>
                                                <button class="flex items-start gap-2 py-2" @click="showReconciliation = true">
                                                    <Icon icon="solar:refresh-circle-linear" class="w-4 h-4 mt-0.5 shrink-0 text-accent" />
                                                    <div>
                                                        <div class="font-bold text-xs">Booth Sync</div>
                                                        <div class="text-[10px] opacity-60">Reconcile booth inventory</div>
                                                    </div>
                                                </button>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </details>
                    </div>

                    <!-- Sticky Bottom Apply Footer (Mobile Only) -->
                    <div class="shrink-0 pt-2.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] border-t border-base-300 flex items-center justify-between gap-2 lg:hidden">
                        <button 
                            type="button" 
                            class="btn btn-xs btn-ghost text-error font-bold" 
                            @click="clearAllFilters" 
                            :disabled="activeFilterCount === 0"
                        >
                            Reset
                        </button>
                        <label for="inventory-sidebar" class="btn btn-xs btn-primary font-bold px-4 shadow-sm flex-1">
                            Show {{ filteredInventory.length.toLocaleString() }} Items
                        </label>
                    </div>
                </div>
            </div>
        </div>

        <!-- ----------------------------------------------------------- -->
        <!-- CHECKOUT MODAL -->
        <!-- ----------------------------------------------------------- -->
        <dialog ref="checkoutModal" class="modal">
            <div class="modal-box">
                <div v-if="!checkoutSuccess">
                    <h3 class="font-bold text-lg mb-4">Confirm Purchase</h3>
                    <p>Purchasing: <span class="font-bold">{{ activeItem?.title }}</span></p>
                    
                    <div class="form-control w-full mt-4">
                        <label class="label"><span class="label-text">Verify Cost Basis</span></label>
                        <input type="number" step="0.01" v-model="checkoutPrice" class="input input-bordered" placeholder="0.00" />
                    </div>

                    <div class="divider">Receipt</div>
                    <div class="flex flex-col gap-2">
                        <button v-if="!isCameraOpen" @click="startCamera('checkout')" class="btn btn-outline gap-2"><Icon icon="solar:camera-linear" class="w-5 h-5 inline" /> Take Receipt Photo</button>
                        
                        <!-- Camera View -->
                        <div v-if="isCameraOpen" class="relative rounded-lg overflow-hidden bg-black">
                             <video ref="cameraVideo" class="w-full h-48 object-cover" autoplay playsinline></video>
                             <button @click="capturePhoto('checkout')" class="btn btn-circle absolute bottom-2 left-1/2 -translate-x-1/2 btn-success border-2 border-white"><Icon icon="solar:camera-linear" class="w-5 h-5" /></button>
                             <button @click="stopCamera" class="btn btn-circle btn-ghost btn-sm text-white absolute top-2 right-2">✕</button>
                        </div>

                        <input v-else type="file" @change="handleFileSelect($event, 'receipt')" accept="image/*" class="file-input file-input-bordered w-full" />
                        
                        <div v-if="checkoutReceiptPreview" class="w-full h-32 bg-base-200 rounded-lg mt-2 overflow-hidden relative group">
                            <img :src="checkoutReceiptPreview" class="w-full h-full object-cover">
                            <button @click="clearCheckoutReceipt" class="absolute top-1 right-1 btn btn-xs btn-circle btn-error">✕</button>
                        </div>
                    </div>

                    <div class="modal-action">
                        <form method="dialog"><button class="btn btn-ghost" @click="closeCheckout">Cancel</button></form>
                        <button class="btn btn-primary" @click="submitCheckout" :disabled="processing">
                            <span v-if="processing" class="loading loading-spinner"></span>
                            Confirm Purchase
                        </button>
                    </div>
                </div>

                <div v-else class="text-center py-6">
                    <h3 class="font-bold text-lg text-success mb-4 flex justify-center items-center"><Icon icon="solar:check-circle-linear" class="w-6 h-6 mr-2 inline" /> Purchase Confirmed!</h3>
                    <p class="text-xs opacity-70 mb-4">Item moved to "Acquired".</p>
                    <div class="divider">AI Description</div>
                    <div class="p-4 bg-base-200 rounded-lg text-sm text-center">
                        <p>{{ generatedDescription }}</p>
                    </div>
                    <div class="modal-action">
                         <button class="btn btn-primary w-full" @click="closeCheckout">Done</button>
                    </div>
                </div>
            </div>
        </dialog>

        <!-- ----------------------------------------------------------- -->
        <!-- EDIT DRAWER -->
        <!-- ----------------------------------------------------------- -->
        <ItemDrawer v-if="isEditDrawerOpen" :item="activeItem" @close="closeEditDrawer" @save="saveEdit" @uncombined="fetchInventory" @deconstruct="openDeconstructModal" @selectItem="openEdit" />

        <!-- FULLSCREEN PREVIEW MODAL -->
        <ItemPreviewModal 
            :item="previewItem" 
            @close="previewItem = null" 
            @edit="openEdit" 
            @deconstruct="openDeconstructModal"
        />

        <!-- Bulk Import Modal -->
        <BulkImport v-if="showImport" @close="showImport = false" @complete="showImport = false" />

        <!-- Booth Reconciliation Modal -->
        <BoothReconciliation :isOpen="showReconciliation" @close="showReconciliation = false" />

        <!-- Create Bundle Modal -->
        <!-- Moved to BundleModal.vue -->

        <!-- Combine Selected into Lot Modal -->
        <dialog ref="combineModal" class="modal">
            <div class="modal-box max-w-lg">
                <h3 class="font-bold text-lg mb-4 flex items-center gap-2">
                    <Icon icon="solar:link-minimalistic-bold" class="w-6 h-6 text-secondary" /> 
                    Combine Selected into Lot
                </h3>
                
                <div class="space-y-4">
                    <!-- Primary Item Selector -->
                    <div class="form-control w-full">
                        <label class="label">
                            <span class="label-text font-bold opacity-70">Primary Item (Keep Photos & Description)</span>
                        </label>
                        <select v-model="combinePrimaryId" class="select select-bordered w-full text-xs font-bold" @change="onCombinePrimaryChange">
                            <option v-for="item in selectedItemsObjects" :key="item.$id" :value="item.$id">
                                {{ item.title }} (Qty: {{ item.quantity || 1 }}, Cost: ${{ Number(item.cost || 0).toFixed(2) }})
                            </option>
                        </select>
                    </div>

                    <!-- Suggested Title -->
                    <div class="form-control w-full">
                        <div class="flex items-center justify-between pb-1">
                            <label class="label-text font-bold opacity-70">Lot Title</label>
                            <span class="text-[10px] text-secondary font-bold uppercase tracking-wider flex items-center gap-1">
                                <Icon icon="solar:magic-stick-3-bold" class="w-3 h-3" /> Smart Suggested
                            </span>
                        </div>
                        <input type="text" v-model="combineTitle" class="input input-bordered w-full font-bold text-sm" placeholder="Lot Name" />
                        
                        <!-- Quick Title Suggestions -->
                        <div v-if="combineTitleSuggestions.length > 0" class="flex flex-wrap gap-1.5 mt-2">
                            <button 
                                v-for="(sug, idx) in combineTitleSuggestions" 
                                :key="idx" 
                                type="button" 
                                class="badge badge-sm py-2.5 px-3 cursor-pointer transition-all hover:badge-secondary text-xs"
                                :class="combineTitle === sug ? 'badge-secondary font-bold shadow-sm' : 'badge-ghost border-base-300 opacity-80'"
                                @click="combineTitle = sug"
                            >
                                {{ sug }}
                            </button>
                        </div>
                    </div>

                    <!-- Cost & Resale row -->
                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-control w-full">
                            <label class="label"><span class="label-text font-bold opacity-70">Total Cost ($)</span></label>
                            <input type="number" step="0.01" v-model="combineCost" class="input input-bordered w-full font-mono text-sm" />
                        </div>
                        <div class="form-control w-full">
                            <label class="label"><span class="label-text font-bold opacity-70">Total Quantity</span></label>
                            <input type="number" v-model.number="combineTotalUnits" min="1" class="input input-bordered w-full font-mono text-sm" />
                        </div>
                    </div>

                    <!-- List of Items included -->
                    <div class="border border-base-300 rounded-xl p-3 bg-base-200/50">
                        <label class="label pt-0 pb-1.5">
                            <span class="label-text font-bold text-[10px] uppercase opacity-60">Selected Items ({{ selectedItems.length }})</span>
                        </label>
                        <ul class="space-y-1.5 max-h-36 overflow-y-auto pr-1 text-xs">
                            <li v-for="item in selectedItemsObjects" :key="item.$id" class="flex justify-between items-center bg-base-100 p-2 rounded border border-base-200 shadow-sm" :class="{'ring-1 ring-secondary': item.$id === combinePrimaryId}">
                                <div class="flex flex-col min-w-0">
                                    <div class="flex items-center gap-1.5">
                                        <span class="font-medium truncate max-w-50" :class="item.$id === combinePrimaryId ? 'text-secondary font-bold' : ''">
                                            {{ item.title }}
                                        </span>
                                        <span v-if="item.$id === combinePrimaryId" class="badge badge-secondary badge-xs uppercase font-bold text-[8px] scale-90">Primary</span>
                                    </div>
                                    <span class="text-[9px] opacity-50 uppercase font-bold">
                                        Cost: ${{ Number(item.cost || 0).toFixed(2) }} | Qty: {{ item.quantity || 1 }}
                                    </span>
                                </div>
                            </li>
                        </ul>
                    </div>
                    
                    <div class="alert alert-warning py-2 shadow-sm text-xs leading-normal">
                        <Icon icon="solar:danger-triangle-linear" class="w-5 h-5 shrink-0" />
                        <span>This will merge the selected items into a single Master Lot. The original items will be marked as "combined", linked to the new lot, and hidden from your main inventory view.</span>
                    </div>
                </div>

                <div class="modal-action">
                    <button type="button" class="btn btn-ghost btn-sm" @click="closeCombineModal" :disabled="savingCombine">Cancel</button>
                    <button type="button" class="btn btn-secondary btn-sm px-6" @click="submitCombine" :disabled="savingCombine || !combineTitle || combineTotalUnits < 1">
                        <span v-if="savingCombine" class="loading loading-spinner loading-xs mr-1"></span>
                        Combine into Lot
                    </button>
                </div>
            </div>
            <form method="dialog" class="modal-backdrop">
                <button @click="closeCombineModal" :disabled="savingCombine">close</button>
            </form>
        </dialog>

        <!-- Deconstruct Modal -->
        <dialog ref="deconstructModalRef" class="modal">
            <div class="modal-box max-w-sm">
                <h3 class="font-bold text-lg mb-4 flex items-center gap-2">
                    <Icon icon="solar:pie-chart-2-bold" class="w-5 h-5 text-secondary" /> 
                    Split Inbound Lot
                </h3>
                
                <p class="text-xs mb-4">You are about to split <b>{{ deconstructItemData?.title }}</b> into individual items. The original cost of <b>${{ deconstructItemData?.cost || deconstructItemData?.purchasePrice || '0.00' }}</b> will be divided equally.</p>

                <div class="form-control w-full mb-4">
                    <label class="label"><span class="label-text font-bold opacity-70">How many individual items?</span></label>
                    <input type="number" min="2" v-model.number="deconstructCount" class="input input-bordered w-full font-mono" />
                </div>
                
                <div class="alert alert-info py-2 shadow-sm text-xs leading-normal mb-4">
                    <Icon icon="solar:info-circle-linear" class="w-5 h-5 shrink-0" />
                    <span>This will create {{ deconstructCount }} new items in your inventory with a cost basis of ${{ ((parseFloat(deconstructItemData?.cost || deconstructItemData?.purchasePrice) || 0) / (deconstructCount || 1)).toFixed(2) }} each. The original lot will be archived.</span>
                </div>

                <div class="modal-action">
                    <button class="btn btn-ghost btn-sm" @click="closeDeconstructModal" :disabled="isDeconstructing">Cancel</button>
                    <button class="btn btn-secondary btn-sm" @click="submitDeconstruct" :disabled="isDeconstructing || deconstructCount < 2">
                        <span v-if="isDeconstructing" class="loading loading-spinner loading-xs"></span>
                        Confirm Split
                    </button>
                </div>
            </div>
            <form method="dialog" class="modal-backdrop">
                <button @click="closeDeconstructModal" :disabled="isDeconstructing">close</button>
            </form>
        </dialog>

        <!-- Post-Export Modal -->
        <dialog ref="postExportModalRef" class="modal">
            <div class="modal-box max-w-sm">
                <h3 class="font-bold text-lg mb-4 flex items-center gap-2 text-success">
                    <Icon icon="solar:check-circle-bold-duotone" class="w-6 h-6" /> 
                    Export Complete!
                </h3>
                
                <p class="text-sm mb-4">You just exported <b>{{ postExportItems.length }}</b> items for <b>{{ postExportPlatform }}</b>.</p>
                <div class="alert bg-base-200 border border-base-300 py-3 shadow-sm text-xs leading-normal mb-6">
                    <Icon icon="solar:shop-linear" class="w-5 h-5 shrink-0 text-primary" />
                    <span>Would you like to automatically mark these items as <b>Placed</b> and tag them with <b>{{ postExportPlatform }}</b>?</span>
                </div>

                <div class="modal-action">
                    <button class="btn btn-ghost btn-sm" @click="closePostExportModal" :disabled="processing">No Thanks</button>
                    <button class="btn btn-primary btn-sm" @click="confirmPostExportActions" :disabled="processing">
                        <span v-if="processing" class="loading loading-spinner loading-xs"></span>
                        Yes, Mark as Placed
                    </button>
                </div>
            </div>
            <form method="dialog" class="modal-backdrop">
                <button @click="closePostExportModal" :disabled="processing">close</button>
            </form>
        <!-- Dialog postExportModalRef ... -->
        </dialog>

        <!-- BUNDLE MODAL -->
        <BundleModal 
            :isOpen="isBundleModalOpen" 
            :items="bundleItemsList" 
            @close="isBundleModalOpen = false" 
            @success="onBundleSuccess" 
        />
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useInventory } from '../../composables/useInventory';
import { updateInventoryItem, deleteInventoryItem, saveItemToInventory, BUCKET_ID, getCollectionId, DB_ID } from '../../lib/inventory';
import { useLoader } from '../../composables/useLoader';
import BulkImport from './BulkImport.vue';
import BoothReconciliation from './BoothReconciliation.vue';
import { useAuth } from '../../composables/useAuth';
import { account, databases, Query, storage, ID } from '../../lib/appwrite';
import { Icon } from '@iconify/vue';
import ItemDrawer from '../common/ItemDrawer.vue';
import ItemCard from '../common/ItemCard.vue';
import ItemPreviewModal from './ItemPreviewModal.vue';
import InventoryPaginationDock from './InventoryPaginationDock.vue';
import BundleModal from './BundleModal.vue';
import TagInput from '../common/TagInput.vue';
import { addToast } from '../../stores/toast';
import { confirmDialog } from '../../stores/confirm';
import { purchasesAPI } from '../../lib/purchases';
import { generateGenericCsv, generateEbayCsv, generatePoshmarkCsv, generateRicochetCsv, downloadCsv } from '../../lib/exportUtils';
import { warehousesApi, matchesLocationFilter, getWarehouseFacilityOptions } from '../../lib/warehouses';

const props = defineProps({
    viewMode: {
        type: String,
        default: 'grid'
    }
});

const emit = defineEmits(['update:viewMode']);

const dockRef = ref(null);

const mobileLayout = ref(typeof window !== 'undefined' ? (localStorage.getItem('rc_mobile_grid_layout') || 'list') : 'list');

const setMobileLayout = (mode) => {
    mobileLayout.value = mode;
    try {
        localStorage.setItem('rc_mobile_grid_layout', mode);
    } catch (e) {
        // ignore
    }
};

const allPurchases = ref([]);

const fetchPurchases = async () => {
    try {
        const res = await purchasesAPI.listPurchases([
            Query.orderDesc('$createdAt'),
            Query.limit(5000)
        ]);
        allPurchases.value = res.documents || [];
    } catch (e) {
        console.error('Failed to load purchases for inventory search:', e);
    }
};

const isBundleModalOpen = ref(false);
const bundleItemsList = ref([]);

const openBundleModal = () => {
    bundleItemsList.value = filteredInventory.value.filter(i => selectedItems.value.includes(i.$id));
    isBundleModalOpen.value = true;
};

const onBundleSuccess = (bundleId) => {
    isBundleModalOpen.value = false;
    selectedItems.value = [];
    addToast({ type: 'success', message: 'Bundle created successfully!' });
    // Reload items
    fetchItems(true);
};

const handleBulkDelete = async () => {
    if (selectedItems.value.length === 0) return;
    const count = selectedItems.value.length;
    processing.value = true;
    try {
        for (const id of selectedItems.value) {
            await deleteInventoryItem(id);
        }
        addToast({ type: 'success', message: `Deleted ${count} items.` });
        selectedItems.value = [];
        await fetchItems(true);
    } catch (e) {
        addToast({ type: 'error', message: 'Bulk delete failed: ' + e.message });
    } finally {
        processing.value = false;
    }
};


// -- EXPORT CSV --
// -- EXPORT CSV --
const postExportModalRef = ref(null);
const postExportPlatform = ref('');
const postExportItems = ref([]);

function exportCsv(format = 'generic') {
    // Safety check just in case it receives an event
    if (typeof format !== 'string') {
        format = 'generic';
    }
    const itemsToExport = selectedItems.value.length > 0
        ? filteredInventory.value.filter(i => selectedItems.value.includes(i.$id))
        : filteredInventory.value;

    if (itemsToExport.length === 0) {
        addToast({ type: 'warning', message: 'No items to export.' });
        return;
    }

    let csvContent = '';
    if (format === 'ebay') {
        csvContent = generateEbayCsv(itemsToExport);
    } else if (format === 'poshmark') {
        csvContent = generatePoshmarkCsv(itemsToExport);
    } else if (format === 'ricochet') {
        csvContent = generateRicochetCsv(itemsToExport);
    } else {
        csvContent = generateGenericCsv(itemsToExport);
    }

    const filename = `inventory-export-${format}-${new Date().toISOString().split('T')[0]}.csv`;
    downloadCsv(csvContent, filename);
    addToast({ type: 'success', message: `Exported ${itemsToExport.length} items for ${format}.` });

    // Show post-export actions for platform exports
    if (format === 'ebay' || format === 'poshmark') {
        postExportPlatform.value = format === 'ebay' ? 'eBay' : 'Poshmark';
        postExportItems.value = itemsToExport;
        if (postExportModalRef.value) {
            postExportModalRef.value.showModal();
        }
    }
}

const closePostExportModal = () => {
    if (postExportModalRef.value) postExportModalRef.value.close();
};

const confirmPostExportActions = async () => {
    processing.value = true;
    let successCount = 0;
    try {
        for (const item of postExportItems.value) {
            const currentLocs = Array.isArray(item.sellingLocations) ? [...item.sellingLocations] : [];
            let changed = false;
            if (!currentLocs.includes(postExportPlatform.value)) {
                currentLocs.push(postExportPlatform.value);
                changed = true;
            }
            if (item.status !== 'placed' || changed) {
                await updateInventoryItem(item.$id, {
                    status: 'placed',
                    sellingLocations: currentLocs
                });
                successCount++;
            }
        }
        addToast({ type: 'success', message: `Updated ${successCount} items.` });
    } catch (e) {
        addToast({ type: 'error', message: 'Failed to update some items: ' + e.message });
    } finally {
        processing.value = false;
        closePostExportModal();
    }
};

// Environment Variables
const ENDPOINT = import.meta.env.PUBLIC_APPWRITE_ENDPOINT;
const PROJECT = import.meta.env.PUBLIC_APPWRITE_PROJECT_ID;
const BUCKET = BUCKET_ID;

// Use Composable
const { currentTeam, user, loading: authLoading } = useAuth();

const { inventoryItems, totalItems, loading, error, fetchInventory, hasMore, loadNextPage, generateUpcs, getNextUpc } = useInventory();
const loadMore = loadNextPage; // Alias for template
const currentTeamId = computed(() => currentTeam.value?.$id); 

// State for Filters
const searchQuery = ref('');
const filterStatus = ref('active');
const hideSold = ref(true);
const hideTracked = ref(true);
const hideCombined = ref(true);
const insightFilter = ref('');
const isEstimating = ref(false);
const bulkProgress = ref(0);
const bulkTotal = ref(0);
const bulkCostValue = ref('');

const runAutoEstimatorAdmin = async () => {
    if (isEstimating.value || selectedItems.value.length === 0) return;
    isEstimating.value = true;
    let successCount = 0;
    let skippedCount = 0;

    const itemsToProcess = inventoryItems.value.filter(i => selectedItems.value.includes(i.$id));
    bulkTotal.value = itemsToProcess.length;
    bulkProgress.value = 0;

    for (const item of itemsToProcess) {
        const title = item.title || item.itemName || '';
        const desc = item.description || (item.keywords || []).join(', ') || '';

        bulkProgress.value++;

        if (title.length < 5 && desc.length < 5) {
            skippedCount++;
            continue;
        }

        try {
            const res = await fetch('/api/estimate-price', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, description: desc })
            });

            if (res.ok) {
                const data = await res.json();
                if (data.fair) {
                    await updateInventoryItem(item.$id, { estValue: data.fair });
                    item.estValue = data.fair;
                    successCount++;
                }
            }
        } catch (e) {
            console.error("Auto-Estimate failed for", item.$id, e);
        }
        await new Promise(r => setTimeout(r, 500));
    }

    isEstimating.value = false;
    selectedItems.value = [];
    let msg = `Auto-Estimated ${successCount} items.`;
    if (skippedCount > 0) msg += ` Skipped ${skippedCount} due to missing info.`;
    addToast({ type: 'success', message: msg });
};

const runAutoCalcSoldPrice = async () => {
    if (isEstimating.value || selectedItems.value.length === 0) return;
    isEstimating.value = true;
    let successCount = 0;
    const itemsToProcess = inventoryItems.value.filter(i => selectedItems.value.includes(i.$id));
    bulkTotal.value = itemsToProcess.length;
    bulkProgress.value = 0;

    for (const item of itemsToProcess) {
        bulkProgress.value++;
        const rp = parseFloat(item.resalePrice || item.listPrice || 0);
        if (rp > 0) {
            const calcPrice = parseFloat((rp * 0.85).toFixed(2));
            try {
                await updateInventoryItem(item.$id, { soldPrice: calcPrice });
                item.soldPrice = calcPrice;
                successCount++;
            } catch (e) { console.error("Failed to update", item.$id, e); }
        }
    }

    isEstimating.value = false;
    selectedItems.value = [];
    addToast({ type: 'success', message: `Auto-calculated Sold Price for ${successCount} items.` });
};

const runAutoCalcCost = async () => {
    if (isEstimating.value || selectedItems.value.length === 0 || bulkCostValue.value === '') return;
    isEstimating.value = true;
    let successCount = 0;
    const targetCost = parseFloat(bulkCostValue.value) || 0;
    const itemsToProcess = inventoryItems.value.filter(i => selectedItems.value.includes(i.$id));
    bulkTotal.value = itemsToProcess.length;
    bulkProgress.value = 0;

    for (const item of itemsToProcess) {
        bulkProgress.value++;
        try {
            await updateInventoryItem(item.$id, { cost: targetCost });
            item.cost = targetCost;
            item.purchasePrice = targetCost;
            successCount++;
        } catch (e) { console.error("Failed to update", item.$id, e); }
    }

    isEstimating.value = false;
    selectedItems.value = [];
    bulkCostValue.value = '';
    addToast({ type: 'success', message: `Marked ${successCount} items as $${targetCost.toFixed(2)} Cost.` });
};

const runAutoFetchPhotos = async () => {
    if (isEstimating.value || selectedItems.value.length === 0) return;
    isEstimating.value = true;
    let successCount = 0;
    let skippedCount = 0;
    const itemsToProcess = inventoryItems.value.filter(i => selectedItems.value.includes(i.$id));
    bulkTotal.value = itemsToProcess.length;
    bulkProgress.value = 0;

    // Process in parallel batches of 4 for 4x faster fetching
    const batchSize = 4;
    for (let i = 0; i < itemsToProcess.length; i += batchSize) {
        const batch = itemsToProcess.slice(i, i + batchSize);
        await Promise.all(batch.map(async (item) => {
            const url = item.sourcingLocation || item.orderId;
            if (!url || !url.startsWith('http')) {
                skippedCount++;
                bulkProgress.value++;
                return;
            }

            try {
                const res = await fetch('/api/extract-images', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.images && data.images.length > 0) {
                        const uploadRes = await fetch('/api/upload-remote-image', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ url: data.images[0] })
                        });
                        
                        if (uploadRes.ok) {
                            const uploadData = await uploadRes.json();
                            if (uploadData.success && uploadData.fileId) {
                                const newGallery = [...(item.galleryImageIds || []), uploadData.fileId];
                                await updateInventoryItem(item.$id, { 
                                    galleryImageIds: newGallery,
                                    imageId: item.imageId || uploadData.fileId
                                });
                                item.galleryImageIds = newGallery;
                                if(!item.imageId) item.imageId = uploadData.fileId;
                                successCount++;
                                bulkProgress.value++;
                                return;
                            }
                        }
                    }
                }
                skippedCount++;
            } catch (e) {
                console.error("Failed to fetch/upload image for", item.$id, e);
                skippedCount++;
            } finally {
                bulkProgress.value++;
            }
        }));
    }

    isEstimating.value = false;
    selectedItems.value = [];
    let msg = `Fetched & attached photos for ${successCount} items.`;
    if (skippedCount > 0) msg += ` Skipped ${skippedCount} items (no valid URL or fetch failed).`;
    addToast({ type: 'success', message: msg });
};

const runAutoGenerateDescriptions = async () => {
    if (isEstimating.value || selectedItems.value.length === 0) return;
    isEstimating.value = true;
    let successCount = 0;
    let failedCount = 0;
    const itemsToProcess = inventoryItems.value.filter(i => selectedItems.value.includes(i.$id));
    bulkTotal.value = itemsToProcess.length;
    bulkProgress.value = 0;

    let jwt = null;
    try {
        const jwtRes = await account.createJWT();
        jwt = jwtRes.jwt;
    } catch (jwtErr) {
        console.warn("Failed to create JWT for bulk description generation:", jwtErr);
    }

    const headers = { 'Content-Type': 'application/json' };
    if (jwt) {
        headers['X-Appwrite-JWT'] = jwt;
    }

    for (const item of itemsToProcess) {
        bulkProgress.value++;
        try {
            const res = await fetch('/api/generate-description', {
                method: 'POST',
                headers,
                body: JSON.stringify({ itemId: item.$id })
            });
            const data = await res.json();
            if (data.success && data.description) {
                // The API actually saves it to marketDescription
                // We should also save it to description in case they use that
                await updateInventoryItem(item.$id, { 
                    description: data.description,
                    marketDescription: data.description 
                });
                item.description = data.description;
                item.marketDescription = data.description;
                successCount++;
            } else {
                failedCount++;
            }
        } catch (e) {
            console.error("Failed to generate description for", item.$id, e);
            failedCount++;
        }
    }

    isEstimating.value = false;
    selectedItems.value = [];
    let msg = `AI generated descriptions for ${successCount} items.`;
    if (failedCount > 0) msg += ` Failed on ${failedCount}.`;
    addToast({ type: 'success', message: msg });
};

const filterKeywords = ref([]);
const filterBinLocation = ref('');
const filterChannel = ref('');
const filterUpcPrefix = ref('');
const filterPurchaseId = ref('');
const filterParentLotId = ref('');
const filterPO = ref('');
const filterSO = ref('');
const filterLotType = ref('all');
const filterFlaggedLocated = ref(false);
const orgPlacedLocations = ref([]);

const filterParentLotTitle = computed(() => {
    if (!filterParentLotId.value || !inventoryItems.value) return '';
    const target = filterParentLotId.value.trim().toLowerCase();
    const parent = inventoryItems.value.find(i => i.$id?.toLowerCase() === target || (i.upc && i.upc.toLowerCase() === target));
    return parent ? (parent.upc ? `${parent.upc} - ${parent.title}` : parent.title) : filterParentLotId.value;
});

const matchingLotDocIds = computed(() => {
    const set = new Set();
    if (!filterParentLotId.value || !inventoryItems.value) return set;
    const target = filterParentLotId.value.trim().toLowerCase();
    set.add(target);

    // If target matches a parent item by UPC or ID, also add its document ID and UPC
    inventoryItems.value.forEach(i => {
        const idMatch = i.$id && i.$id.toLowerCase() === target;
        const upcMatch = i.upc && i.upc.toLowerCase() === target;
        if (idMatch || upcMatch) {
            if (i.$id) set.add(i.$id.toLowerCase());
            if (i.upc) set.add(i.upc.toLowerCase());
        }
    });
    return set;
});

const clearLineageFilters = () => {
    filterParentLotId.value = '';
    filterPO.value = '';
    filterSO.value = '';
    if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('parentLotId');
        url.searchParams.delete('lot');
        url.searchParams.delete('lotId');
        url.searchParams.delete('po');
        url.searchParams.delete('purchaseId');
        url.searchParams.delete('orderId');
        url.searchParams.delete('so');
        url.searchParams.delete('saleId');
        window.history.replaceState({}, '', url.toString());
    }
};

onMounted(() => {
    fetchPurchases();
    // Check URL for AI Insight filters & search / order params
    const params = new URLSearchParams(window.location.search);
    if (params.has('insightFilter')) {
        insightFilter.value = params.get('insightFilter') || '';
        if (insightFilter.value) {
            bulkOpen.value = true;
        }
    }
    if (params.has('search')) {
        searchQuery.value = params.get('search') || '';
    }
    if (params.has('purchaseId')) {
        filterPurchaseId.value = params.get('purchaseId') || '';
        filterPO.value = params.get('purchaseId') || '';
    }
    if (params.has('orderId')) {
        if (!filterPurchaseId.value) filterPurchaseId.value = params.get('orderId') || '';
        filterPO.value = params.get('orderId') || '';
    } else if (params.has('po')) {
        if (!filterPurchaseId.value) filterPurchaseId.value = params.get('po') || '';
        filterPO.value = params.get('po') || '';
    }
    if (params.has('parentLotId')) {
        filterParentLotId.value = params.get('parentLotId') || '';
    } else if (params.has('lot')) {
        filterParentLotId.value = params.get('lot') || '';
    } else if (params.has('lotId')) {
        filterParentLotId.value = params.get('lotId') || '';
    }
    if (params.has('purchaseId')) {
        filterPO.value = params.get('purchaseId') || '';
    }
    if (params.has('so')) {
        filterSO.value = params.get('so') || '';
    } else if (params.has('saleId')) {
        filterSO.value = params.get('saleId') || '';
    }
    if (params.has('upcPrefix')) {
        filterUpcPrefix.value = params.get('upcPrefix') || '';
    }
    if (params.has('status')) {
        filterStatus.value = params.get('status') || 'all';
    }
});
const warehouseLocations = ref([]);

const fetchLocations = async () => {
    if (!currentTeam.value) return;
    try {
        const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
        const res = await databases.listDocuments(DB_ID, 'org_settings', [
            Query.equal('tenantId', currentTeam.value.$id)
        ]);
        if (res.documents.length) {
            orgPlacedLocations.value = res.documents[0].placedLocations || [];
        }
        try {
            const whs = await warehousesApi.listWarehouses(currentTeam.value.$id);
            warehouseLocations.value = whs.map(w => w.name);
        } catch (we) {}
    } catch(e) {}
};

const allAvailableLocations = computed(() => {
    return getWarehouseFacilityOptions(inventoryItems.value, orgPlacedLocations.value);
});

const allAvailableChannels = computed(() => {
    const set = new Set();
    (inventoryItems.value || []).forEach(item => {
        if (Array.isArray(item.sellingLocations)) {
            item.sellingLocations.forEach(l => l && set.add(String(l).trim()));
        } else if (typeof item.sellingLocations === 'string' && item.sellingLocations) {
            set.add(String(item.sellingLocations).trim());
        }
    });
    if (filterChannel.value) set.add(String(filterChannel.value).trim());
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
});

const knownOrgPrefixes = computed(() => {
    const prefixes = new Set(['HUCK-', 'PDXGL-']);
    if (currentTeam.value?.prefs?.upcPrefix) {
        let p = currentTeam.value.prefs.upcPrefix.trim().toUpperCase();
        if (!p.endsWith('-') && !/^\d+$/.test(p)) p += '-';
        prefixes.add(p);
    }
    if (user.value?.prefs?.upcPrefix) {
        let p = user.value.prefs.upcPrefix.trim().toUpperCase();
        if (!p.endsWith('-') && !/^\d+$/.test(p)) p += '-';
        prefixes.add(p);
    }
    return Array.from(prefixes);
});

const allAvailableUpcPrefixes = computed(() => {
    const map = new Map();
    // Pre-populate with known organization prefixes
    knownOrgPrefixes.value.forEach(p => map.set(p, 0));

    let missingCount = 0;
    let numericOnlyCount = 0;

    (inventoryItems.value || []).forEach(item => {
        if (item.status === 'scouted') return;
        const code = (item.upc || item.locationSku || item.sku || '').trim().toUpperCase();
        
        if (!code) {
            missingCount++;
            return;
        }

        // Check against known org prefixes first (e.g. HUCK-, PDXGL-)
        let matchedKnown = false;
        for (const kp of knownOrgPrefixes.value) {
            if (code.startsWith(kp)) {
                map.set(kp, (map.get(kp) || 0) + 1);
                matchedKnown = true;
                break;
            }
        }
        if (matchedKnown) return;

        // 1. Hyphenated prefix: e.g. "RC-045", "SGW-999" -> "RC-", "SGW-"
        const hyphenMatch = code.match(/^([A-Za-z0-9]+-)/);
        if (hyphenMatch) {
            const prefix = hyphenMatch[1].toUpperCase();
            map.set(prefix, (map.get(prefix) || 0) + 1);
            return;
        }

        // 2. Letters followed by numbers: e.g. "HUCK0123", "PDXGL045", "RC45"
        const alphaNumMatch = code.match(/^([A-Za-z]+)\d+/);
        if (alphaNumMatch) {
            const prefix = alphaNumMatch[1].toUpperCase();
            map.set(prefix, (map.get(prefix) || 0) + 1);
            return;
        }

        // 3. Pure numeric barcode (standard retail UPC): e.g. "012345678901"
        if (/^\d+$/.test(code)) {
            numericOnlyCount++;
            return;
        }

        // 4. Other custom code (take leading 4 chars)
        const customPrefix = code.length > 6 ? code.substring(0, 4).toUpperCase() : code.toUpperCase();
        map.set(customPrefix, (map.get(customPrefix) || 0) + 1);
    });
    
    // Sort so known org prefixes come first, then by count
    const list = Array.from(map.entries()).map(([prefix, count]) => ({
        prefix,
        label: `${prefix} (${count})`,
        count
    })).sort((a, b) => {
        const aKnown = knownOrgPrefixes.value.includes(a.prefix);
        const bKnown = knownOrgPrefixes.value.includes(b.prefix);
        if (aKnown && !bKnown) return -1;
        if (!aKnown && bKnown) return 1;
        return b.count - a.count;
    });

    if (numericOnlyCount > 0) {
        list.push({
            prefix: '__numeric__',
            label: `Retail / Numeric Barcodes (${numericOnlyCount})`,
            count: numericOnlyCount
        });
    }

    if (missingCount > 0) {
        list.push({
            prefix: '__missing__',
            label: `No Barcode / Missing (${missingCount})`,
            count: missingCount
        });
    }
    return list;
});

watch(currentTeam, (n) => { 
    if (n) {
        fetchLocations(); 
        // Load default view preference for Flagged & Located
        const val = localStorage.getItem(`resale_command_only_flagged_located_${n.$id}`);
        filterFlaggedLocated.value = val === 'true';
    } 
}, { immediate: true });

// Lifecycle
const cartItems = computed(() => inventoryItems.value.filter(i => i.status === 'scouted'));

const countByStatus = (status) => {
    return (inventoryItems.value || []).filter(i => i.status === status).length;
};

const readyToListCount = computed(() => {
    return (inventoryItems.value || []).filter(item => {
        if (!['acquired', 'received'].includes(item.status)) return false;
        if (!item.title || item.title.trim() === '') return false;
        const hasPrice = item.resalePrice || item.estValue || item.listPrice;
        if (!hasPrice) return false;
        const hasPhoto = item.imageId || (item.galleryImageIds && item.galleryImageIds.length > 0) || (item.conditionNotes && (item.conditionNotes.includes('[MAIN IMAGE ID:') || item.conditionNotes.includes('[IMAGE_ID:')));
        return !!hasPhoto;
    }).length;
});

const missingPhotosCount = computed(() => {
    return (inventoryItems.value || []).filter(item => {
        if (item.imageId || (item.galleryImageIds && item.galleryImageIds.length > 0)) return false;
        if (item.conditionNotes && (item.conditionNotes.includes('[MAIN IMAGE ID:') || item.conditionNotes.includes('[IMAGE_ID:'))) return false;
        return true;
    }).length;
});

const missingPricingCount = computed(() => {
    return (inventoryItems.value || []).filter(item => {
        if (item.status === 'sold' || item.status === 'scouted') return false;
        return !item.resalePrice && !item.estValue && !item.listPrice;
    }).length;
});

const activeFilterCount = computed(() => {
    let c = 0;
    if (filterStatus.value !== 'all') c++;
    if (filterUpcPrefix.value) c++;
    if (filterBinLocation.value) c++;
    if (filterChannel.value) c++;
    if (filterLotType.value !== 'all') c++;
    if (filterFlaggedLocated.value) c++;
    if (filterKeywords.value && filterKeywords.value.length > 0) c++;
    if (insightFilter.value) c++;
    if (searchQuery.value) c++;
    return c;
});

const clearAllFilters = () => {
    filterStatus.value = 'all';
    filterUpcPrefix.value = '';
    filterBinLocation.value = '';
    filterChannel.value = '';
    filterLotType.value = 'all';
    filterFlaggedLocated.value = false;
    filterKeywords.value = [];
    insightFilter.value = '';
    searchQuery.value = '';
    filterPurchaseId.value = '';
};

// The true "base" total of items that would be shown without any user filters applied
// (excluding items that are hidden by default like cart items, tracked, and combined items)
const baseInventoryCount = computed(() => {
    return inventoryItems.value.filter(i => i.status !== 'scouted' && i.status !== 'tracked' && i.status !== 'combined').length;
});

const matchingPurchaseIds = computed(() => {
    const set = new Set();
    if (filterPurchaseId.value) {
        set.add(filterPurchaseId.value);
    }
    const q = (filterPO.value || searchQuery.value || '').trim().toLowerCase();
    if (q) {
        (allPurchases.value || []).forEach(p => {
            const orderIdMatch = p.orderId && p.orderId.toLowerCase().includes(q);
            const poMatch = p.poNumber && p.poNumber.toLowerCase().includes(q);
            const idMatch = p.$id && p.$id.toLowerCase().includes(q);
            const vendorMatch = p.vendor && p.vendor.toLowerCase().includes(q);
            if (orderIdMatch || poMatch || idMatch || vendorMatch) {
                set.add(p.$id);
                if (p.orderId) set.add(p.orderId);
            }
        });
    }
    return set;
});

const filteredInventory = computed(() => {
    return inventoryItems.value.filter(item => {
        // Exclude default hidden items ONLY when not searching explicitly or filtering by purchase
        if (!searchQuery.value && !filterPurchaseId.value) {
            // Exclude cart items
            if (item.status === 'scouted') return false;

            // Exclude tracked items by default (unless explicitly filtering for them)
            if (item.status === 'tracked' && filterStatus.value !== 'tracked') return false;

            // Exclude combined items by default (unless explicitly filtering for them)
            if (item.status === 'combined' && filterStatus.value !== 'combined') return false;
        }

        // Filter by Purchase ID (from direct PO links)
        if (filterPurchaseId.value && !searchQuery.value) {
            const matchesPurchase = item.purchaseId === filterPurchaseId.value || item.cartId === filterPurchaseId.value || matchingPurchaseIds.value.has(item.purchaseId) || matchingPurchaseIds.value.has(item.cartId);
            if (!matchesPurchase) return false;
        }

        // --- AI Insight Filters ---
        if (insightFilter.value) {
            const parseVal = (itm, key, noteKey) => {
                let val = 0;
                if (itm[key]) {
                    val = parseFloat(itm[key]);
                } else if (itm.conditionNotes) {
                    const regex = new RegExp(`${noteKey}[:\\s]*\\$?([\\d.]+)`, 'i');
                    const match = itm.conditionNotes.match(regex);
                    if (match) val = parseFloat(match[1]);
                }
                return isNaN(val) ? 0 : val;
            };

            if (insightFilter.value === 'missing_sold_price') {
                if (item.status !== 'sold' || (parseVal(item, 'soldPrice', 'Sold') || parseVal(item, 'price', 'Sold'))) return false;
            } else if (insightFilter.value === 'missing_est_value') {
                if (item.status === 'sold' || (parseVal(item, 'resalePrice', 'Resale') || parseVal(item, 'estValue', 'Est. Low') || parseVal(item, 'listPrice', 'Est'))) return false;
            } else if (insightFilter.value === 'missing_cost') {
                if (item.status === 'sold' || (parseVal(item, 'cost', 'Paid') || parseVal(item, 'purchasePrice', 'Paid'))) return false;
            } else if (insightFilter.value === 'missing_description') {
                if (item.marketDescription && item.marketDescription.length >= 10) return false;
            } else if (insightFilter.value === 'missing_photos') {
                if (item.imageId || (item.galleryImageIds && item.galleryImageIds.length > 0)) return false;
                if (item.conditionNotes && (item.conditionNotes.includes('[MAIN IMAGE ID:') || item.conditionNotes.includes('[IMAGE_ID:'))) return false;
            } else if (insightFilter.value === 'ready_to_list') {
                if (!['acquired', 'received'].includes(item.status)) return false;
                if (!item.title || item.title.trim() === '') return false;
                if (!parseVal(item, 'resalePrice', 'Resale') && !parseVal(item, 'estValue', 'Est. Low')) return false;
                const hasPhoto = item.imageId || (item.galleryImageIds && item.galleryImageIds.length > 0) || (item.conditionNotes && (item.conditionNotes.includes('[MAIN IMAGE ID:') || item.conditionNotes.includes('[IMAGE_ID:')));
                if (!hasPhoto) return false;
            }
        }
        
        // Filter by Parent Lot ID (Lineage)
        if (filterParentLotId.value) {
            const matchesLot = (item.$id && matchingLotDocIds.value.has(item.$id.toLowerCase())) ||
                               (item.parentLotId && matchingLotDocIds.value.has(item.parentLotId.toLowerCase())) ||
                               (item.upc && matchingLotDocIds.value.has(item.upc.toLowerCase()));
            if (!matchesLot) return false;
        }

        // Exclusion Toggles ("No-Show")
        if (hideSold.value && item.status === 'sold' && filterStatus.value !== 'sold') return false;
        if (hideTracked.value && (item.status === 'tracked' || item.status === 'scouted') && filterStatus.value !== 'tracked') return false;
        if (hideCombined.value && item.status === 'combined' && filterStatus.value !== 'combined') return false;

        // Filter by Status (Only if not using insight filter that forces status or filtering by lineage)
        if (!insightFilter.value && !filterParentLotId.value && filterStatus.value !== 'all') {
            if (filterStatus.value === 'active') {
                if (['sold', 'tracked', 'scouted', 'combined'].includes(item.status)) return false;
            } else if (item.status !== filterStatus.value) {
                return false;
            }
        }

        // Filter by PO / Purchase Order / Sourcing Order
        if (filterPO.value) {
            const target = filterPO.value.trim().toLowerCase();
            const matchesPo = (item.purchaseId && (item.purchaseId.toLowerCase().includes(target) || matchingPurchaseIds.value.has(item.purchaseId))) ||
                              (item.orderId && (item.orderId.toLowerCase().includes(target) || matchingPurchaseIds.value.has(item.orderId))) ||
                              (item.cartId && (item.cartId.toLowerCase().includes(target) || matchingPurchaseIds.value.has(item.cartId))) ||
                              (item.sourcingLocation && item.sourcingLocation.toLowerCase().includes(target)) ||
                              (item.conditionNotes && item.conditionNotes.toLowerCase().includes(target)) ||
                              (item.upc && item.upc.toLowerCase().startsWith(target));
            if (!matchesPo) return false;
        }

        // Filter by SO / Sales Order
        if (filterSO.value) {
            const target = filterSO.value.trim().toLowerCase();
            const matchesSo = (item.saleId && item.saleId.toLowerCase() === target) ||
                              (item.locationSku && item.locationSku.toLowerCase() === target);
            if (!matchesSo) return false;
        }

        // Lot Filtering
        if (filterLotType.value === 'lots_only') {
            if (item.quantity <= 1 && !(item.title && item.title.toLowerCase().startsWith('lot of'))) return false;
        } else if (filterLotType.value === 'extracted_only') {
            if (!item.parentLotId) return false;
        } else if (filterLotType.value === 'standalone_only') {
            if (item.parentLotId || (item.quantity > 1) || (item.title && item.title.toLowerCase().startsWith('lot of'))) return false;
        }

        // Filter by Sales Channel
        if (filterChannel.value) {
            const rawTarget = filterChannel.value.trim().toLowerCase();
            const cleanTarget = rawTarget.replace(/[^a-z0-9]/g, '');
            const matchesLoc = (val) => {
                if (!val) return false;
                if (Array.isArray(val)) return val.some(v => matchesLoc(v));
                const str = String(val).trim().toLowerCase();
                const cleanStr = str.replace(/[^a-z0-9]/g, '');
                return str === rawTarget || cleanStr === cleanTarget || (cleanTarget.length > 2 && (cleanStr.includes(cleanTarget) || cleanTarget.includes(cleanStr)));
            };
            if (!matchesLoc(item.sellingLocations)) return false;
        }

        // Filter by Location (Physical location or selling booth)
        if (filterBinLocation.value) {
            if (!matchesLocationFilter(item, filterBinLocation.value)) {
                return false;
            }
        }

        // Filter by Placed & Located Only
        if (filterFlaggedLocated.value) {
            const hasLocation = !!item.storageLocation || (item.sellingLocations && item.sellingLocations.length > 0);
            const isPlaced = item.status === 'placed';
            if (!hasLocation || !isPlaced) return false;
        }

        // Filter by specific Keywords (must have all selected keywords)
        if (filterKeywords.value.length > 0) {
            if (!item.keywords || item.keywords.length === 0) return false;
            const itemKeywordsLower = item.keywords.map(k => k.toLowerCase());
            const hasAllKeywords = filterKeywords.value.every(kw => itemKeywordsLower.includes(kw.toLowerCase()));
            if (!hasAllKeywords) return false;
        }

        // Filter by UPC / Barcode Prefix
        if (filterUpcPrefix.value) {
            const code = (item.upc || item.locationSku || item.sku || '').trim().toUpperCase();
            if (filterUpcPrefix.value === '__missing__') {
                if (code !== '') return false;
            } else if (filterUpcPrefix.value === '__numeric__') {
                if (!code || !/^\d+$/.test(code)) return false;
            } else {
                const target = filterUpcPrefix.value.toUpperCase();
                if (!code.startsWith(target) && !code.includes(target)) return false;
            }
        }

        // Filter by Search (Free text, UPC, SKU, Cart ID, PO, Order #, External URL, Title, Location, etc.)
        if (searchQuery.value) {
            const rawQuery = searchQuery.value.trim();
            const query = rawQuery.toLowerCase();
            const numericDigits = rawQuery.replace(/\D/g, '');
            const itemUpc = (item.upc || item.sku || '').toLowerCase();

            // Explicit prefix query like 'upc:huck-' or 'barcode:0012'
            if (query.startsWith('upc:') || query.startsWith('barcode:')) {
                const target = query.replace(/^(upc|barcode):/, '').trim();
                return itemUpc.includes(target);
            }

            const titleMatch = (item.title || item.itemName || '').toLowerCase().includes(query);
            const idMatch = (item.$id || '').toLowerCase().includes(query);
            const identityMatch = (item.identity || '').toLowerCase().includes(query);
            const binMatch = (item.storageLocation || '').toLowerCase().includes(query);
            const orderMatch = (item.orderId || item.sourceOrderId || '').toLowerCase().includes(query);
            const cartMatch = (item.cartId || '').toLowerCase().includes(query) || (item.cartId && matchingPurchaseIds.value.has(item.cartId));
            const purchaseMatch = (item.purchaseId || '').toLowerCase().includes(query) || (item.purchaseId && matchingPurchaseIds.value.has(item.purchaseId));
            const sourcingMatch = (item.sourcingLocation || '').toLowerCase().includes(query);
            const locSkuMatch = (item.locationSku || '').toLowerCase().includes(query);
            const notesMatch = (item.conditionNotes || item.marketDescription || '').toLowerCase().includes(query);
            const rawAnalysisMatch = (item.rawAnalysis || '').toLowerCase().includes(query);
            const componentsMatch = (item.components || '').toLowerCase().includes(query);
            const keywordMatch = Array.isArray(item.keywords) && item.keywords.some(k => k.toLowerCase().includes(query));
            const upcMatch = itemUpc.includes(query);

            // Numeric Suffix & Partial Number Matching (e.g. searching "0735" or "735" matches "HUCK-0735")
            let numericMatch = false;
            if (numericDigits.length >= 1) {
                const itemUpcDigits = itemUpc.replace(/\D/g, '');
                if (itemUpcDigits) {
                    if (itemUpcDigits.endsWith(numericDigits) || itemUpcDigits.includes(numericDigits)) {
                        numericMatch = true;
                    }
                    const padded = numericDigits.padStart(4, '0');
                    if (itemUpcDigits.endsWith(padded) || itemUpc.includes(padded)) {
                        numericMatch = true;
                    }
                }
            }

            if (!titleMatch && !idMatch && !identityMatch && !binMatch && !keywordMatch && !orderMatch && !cartMatch && !purchaseMatch && !sourcingMatch && !locSkuMatch && !notesMatch && !rawAnalysisMatch && !componentsMatch && !upcMatch && !numericMatch) {
                return false;
            }
        }
        
        return true;
    });
});

// Grid Pagination
const gridPage = ref(1);
const gridPageSize = ref(50);
const gridPageSizeOptions = [25, 50, 100, 200];
const gridTotalPages = computed(() => Math.ceil(filteredInventory.value.length / gridPageSize.value) || 1);

const displayedInventory = computed(() => {
    const start = (gridPage.value - 1) * gridPageSize.value;
    return filteredInventory.value.slice(start, start + gridPageSize.value);
});

// Reset page when any filter or query changes
watch([filterStatus, filterUpcPrefix, filterBinLocation, filterChannel, filterLotType, filterFlaggedLocated, filterKeywords, insightFilter, searchQuery, filterPurchaseId], () => {
    gridPage.value = 1;
});

// Smoothly scroll back to top of grid on page change if scrolled down
watch(gridPage, () => {
    if (typeof window !== 'undefined' && window.scrollY > 200) {
        window.scrollTo({ top: 120, behavior: 'smooth' });
    }
});

const cartGroups = computed(() => {
    return cartItems.value.reduce((groups, item) => {
        const loc = item.sourcingLocation || 'Unknown Location';
        if (!groups[loc]) groups[loc] = [];
        groups[loc].push(item);
        return groups;
    }, {});
});


// State
const processingId = ref(null); // deleting/updating ID
const processing = ref(false); // general loading state
const processingBulk = ref(false); // bulk action state
const activeItem = ref(null); // used for edit drawer
const previewItem = ref(null); // used for full preview modal
const showReconciliation = ref(false); // Booth sync modal

const openPreview = (item) => {
    previewItem.value = item;
};

// Bulk Selection State
const selectedItems = ref([]);
const selectedItemsObjects = computed(() => {
    return inventoryItems.value.filter(i => selectedItems.value.includes(i.$id));
});
const bulkStatusTarget = ref('');
const bulkLocationTarget = ref('');
const bulkCustomLocation = ref('');
const processingBulkLoc = ref(false);
const bulkChannelTarget = ref('');
const processingBulkChannel = ref(false);
const bulkUpcPrefixTarget = ref('');
const bulkCustomUpcPrefix = ref('');
const bulkOpen = ref(false);

watch(selectedItems, (newVal, oldVal) => {
    if (newVal.length > 0 && oldVal.length === 0) bulkOpen.value = true;
    else if (newVal.length === 0) bulkOpen.value = false;
});

const isAllSelected = computed(() => {
    return filteredInventory.value.length > 0 && selectedItems.value.length === filteredInventory.value.length;
});

const toggleItemSelection = (itemId) => {
    const idx = selectedItems.value.indexOf(itemId);
    if (idx > -1) {
        selectedItems.value.splice(idx, 1);
    } else {
        selectedItems.value.push(itemId);
    }
};

const toggleAll = (event) => {
    if (event.target.checked) {
        selectedItems.value = filteredInventory.value.map(i => i.$id);
    } else {
        selectedItems.value = [];
    }
};

const pruneFilteredOutSelections = () => {
    // Retain only selected items that are still part of the current filtered inventory view
    const visibleMatchingIds = new Set(filteredInventory.value.map(i => i.$id));
    selectedItems.value = selectedItems.value.filter(id => visibleMatchingIds.has(id));
};

const handleGenerateUpcs = async (targetPrefix = 'HUCK-') => {
    const prefix = targetPrefix || currentTeam.value?.prefs?.upcPrefix || user.value?.prefs?.upcPrefix || 'HUCK-';
    const missingCount = inventoryItems.value.filter(i => !i.upc).length;
    if (missingCount === 0) {
        addToast({ type: 'info', message: 'All items already have a UPC!' });
        return;
    }
    const confirmed = await confirmDialog(
        `Generate ${prefix} UPCs`,
        `You have ${missingCount} items without a UPC. This will automatically assign unique sequential IDs (e.g. ${prefix}0001) to each of them. Continue?`,
        'Generate',
        'cancel'
    );
    if (!confirmed) return;
    
    try {
        const count = await generateUpcs(prefix);
        pruneFilteredOutSelections();
        addToast({ type: 'success', message: `Successfully generated ${count} "${prefix}" UPCs!` });
    } catch (e) {
        addToast({ type: 'error', message: e.message || 'Failed to generate UPCs' });
    }
};

const handleCustomGenerateUpcs = async () => {
    const custom = window.prompt("Enter custom UPC Prefix (e.g. MYORG-):");
    if (!custom || !custom.trim()) return;
    let clean = custom.trim().toUpperCase();
    if (!clean.endsWith('-') && !/^\d+$/.test(clean)) clean += '-';
    await handleGenerateUpcs(clean);
};

const applyBulkUpc = async () => {
    let target = bulkUpcPrefixTarget.value;
    if (target === '__custom__') {
        target = bulkCustomUpcPrefix.value?.trim().toUpperCase();
        if (target && !target.endsWith('-') && !/^\d+$/.test(target)) target += '-';
    }
    if (!target) return;
    await bulkReassignUpc(target);
    bulkUpcPrefixTarget.value = '';
    bulkCustomUpcPrefix.value = '';
};

const bulkReassignUpc = async (prefix = 'HUCK-') => {
    if (selectedItems.value.length === 0) return;
    const count = selectedItems.value.length;
    const confirmed = await confirmDialog(
        `Reassign to ${prefix} UPCs`,
        `Are you sure you want to assign/replace barcodes for ${count} selected items with sequential "${prefix}" barcodes?`,
        'Reassign',
        'cancel'
    );
    if (!confirmed) return;

    processingBulk.value = true;
    try {
        let updated = 0;
        for (const id of selectedItems.value) {
            const item = inventoryItems.value.find(i => i.$id === id);
            if (item) {
                const newUpc = getNextUpc(prefix);
                await updateInventoryItem(id, { upc: newUpc });
                item.upc = newUpc;
                updated++;
            }
        }
        pruneFilteredOutSelections();
        addToast({ type: 'success', message: `Successfully updated ${updated} items to "${prefix}" UPCs!` });
    } catch (e) {
        console.error('Bulk UPC update error:', e);
        addToast({ type: 'error', message: 'Failed to reassign UPCs: ' + e.message });
    } finally {
        processingBulk.value = false;
    }
};

const applyBulkStatus = async () => {
    if (!bulkStatusTarget.value || selectedItems.value.length === 0) return;
    
    processingBulk.value = true;
    const targetStatus = bulkStatusTarget.value;
    const itemsToUpdate = inventoryItems.value.filter(i => selectedItems.value.includes(i.$id));
    const total = itemsToUpdate.length;
    let successCount = 0;
    let autoCalcCount = 0;
    
    const { showLoader, hideLoader } = useLoader();
    showLoader("Updating Status...", {
        step: `Setting status to "${targetStatus}" for ${total} items...`,
        progress: 0,
        cancelable: false
    });
    
    try {
        for (let idx = 0; idx < total; idx++) {
            const item = itemsToUpdate[idx];
            const percent = Math.round(((idx + 1) / total) * 100);
            
            showLoader("Updating Status...", {
                step: `Item ${idx + 1} of ${total}: "${(item.title || 'Item').substring(0, 28)}..." (${percent}%)`,
                progress: percent,
                cancelable: false
            });
            
            const updates = { status: targetStatus };
            if (targetStatus === 'sold' && item) {
                const currentSoldPrice = item.soldPrice || '';
                const rp = parseFloat(item.resalePrice || item.listPrice || 0);
                if (!currentSoldPrice && rp > 0) {
                    updates.soldPrice = parseFloat((rp * 0.85).toFixed(2));
                    autoCalcCount++;
                }
            }
            
            await updateInventoryItem(item.$id, updates);
            Object.assign(item, updates);
            successCount++;
            
            if (total > 5) await new Promise(r => setTimeout(r, 80));
        }
        
        pruneFilteredOutSelections();
        bulkStatusTarget.value = '';
        
        let msg = `Successfully updated status for ${successCount} items.`;
        if (autoCalcCount > 0) msg += ` Auto-filled Sold Price for ${autoCalcCount} item(s).`;
        addToast({ type: 'success', message: msg });
    } catch (e) {
        console.error("Bulk status error:", e);
        addToast({ type: 'error', message: "Failed to apply bulk update: " + e.message });
    } finally {
        processingBulk.value = false;
        const { hideLoader } = useLoader();
        hideLoader();
    }
};

const applyBulkLocation = async () => {
    const rawTarget = bulkLocationTarget.value === '__custom__' ? bulkCustomLocation.value.trim() : bulkLocationTarget.value;
    if (!rawTarget || selectedItems.value.length === 0) return;
    
    processingBulkLoc.value = true;
    const targetLoc = rawTarget;
    const itemsToUpdate = inventoryItems.value.filter(i => selectedItems.value.includes(i.$id));
    const total = itemsToUpdate.length;
    let successCount = 0;
    
    const { showLoader, hideLoader } = useLoader();
    showLoader("Updating Location...", {
        step: `Moving ${total} items to "${targetLoc}"...`,
        progress: null,
        cancelable: false
    });
    
    try {
        // Fast Server Path (bypasses browser rate limits with server admin API key)
        try {
            const resp = await fetch('/api/inventory/bulk-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    itemIds: selectedItems.value,
                    updates: { storageLocation: targetLoc },
                    collectionId: getCollectionId(),
                    dbId: DB_ID
                })
            });

            if (resp.ok) {
                const data = await resp.json();
                if (data.success) {
                    itemsToUpdate.forEach(item => {
                        item.storageLocation = targetLoc;
                        if (['scouted', 'acquired', 'received'].includes(item.status)) {
                            item.status = 'placed';
                        }
                    });
                    pruneFilteredOutSelections();
                    bulkLocationTarget.value = '';
                    bulkCustomLocation.value = '';
                    processingBulkLoc.value = false;
                    hideLoader();
                    addToast({ type: 'success', message: `Successfully updated location for ${data.updatedCount ?? total} items to "${targetLoc}".` });
                    return;
                }
            }
        } catch (serverErr) {
            console.warn("Server bulk update fallback in InventoryManager:", serverErr);
        }

        // Fallback Client Loop with pacing
        for (let idx = 0; idx < total; idx++) {
            const item = itemsToUpdate[idx];
            const percent = Math.round(((idx + 1) / total) * 100);
            
            showLoader("Updating Location...", {
                step: `Item ${idx + 1} of ${total}: "${(item.title || 'Item').substring(0, 28)}..." -> ${targetLoc} (${percent}%)`,
                progress: percent,
                cancelable: false
            });
            
            const updates = {
                storageLocation: targetLoc
            };
            
            // If item status is scouted, acquired, or received, update status to placed
            if (['scouted', 'acquired', 'received'].includes(item.status)) {
                updates.status = 'placed';
            }
            
            await updateInventoryItem(item.$id, updates);
            Object.assign(item, updates);
            successCount++;
            
            if (total > 1 && idx < total - 1) await new Promise(r => setTimeout(r, 120));
        }
        
        pruneFilteredOutSelections();
        bulkLocationTarget.value = '';
        bulkCustomLocation.value = '';
        processingBulkLoc.value = false;
        hideLoader();
        addToast({ type: 'success', message: `Successfully updated location for ${successCount} items to "${targetLoc}".` });
    } catch (e) {
        console.error("Bulk location error:", e);
        addToast({ type: 'error', message: "Failed to apply bulk location update: " + e.message });
    } finally {
        processingBulkLoc.value = false;
        const { hideLoader } = useLoader();
        hideLoader();
    }
};

const applyBulkChannel = async () => {
    if (!bulkChannelTarget.value || selectedItems.value.length === 0) return;
    
    processingBulkChannel.value = true;
    const targetChannel = bulkChannelTarget.value;
    const itemsToUpdate = inventoryItems.value.filter(i => selectedItems.value.includes(i.$id));
    const total = itemsToUpdate.length;
    let successCount = 0;
    
    const { showLoader, hideLoader } = useLoader();
    showLoader("Updating Channel...", {
        step: `Adding ${total} items to "${targetChannel}"...`,
        progress: 0,
        cancelable: false
    });
    
    try {
        for (let idx = 0; idx < total; idx++) {
            const item = itemsToUpdate[idx];
            const percent = Math.round(((idx + 1) / total) * 100);
            
            showLoader("Updating Channel...", {
                step: `Item ${idx + 1} of ${total}: "${(item.title || 'Item').substring(0, 28)}..." -> ${targetChannel} (${percent}%)`,
                progress: percent,
                cancelable: false
            });
            
            // Add to sellingLocations if not already there
            const existingChannels = Array.isArray(item.sellingLocations) ? item.sellingLocations : (item.sellingLocations ? [item.sellingLocations] : []);
            if (!existingChannels.includes(targetChannel)) {
                const updates = {
                    sellingLocations: [...existingChannels, targetChannel]
                };
                
                await updateInventoryItem(item.$id, updates);
                const localItem = inventoryItems.value.find(i => i.$id === item.$id);
                if (localItem) localItem.sellingLocations = updates.sellingLocations;
            }
            successCount++;
        }
        pruneFilteredOutSelections();
        addToast({ type: 'success', message: `Added channel "${targetChannel}" to ${successCount} items.` });
        
    } catch (e) {
        addToast({ type: 'error', message: 'Failed to bulk update channels.' });
        console.error(e);
    } finally {
        bulkChannelTarget.value = '';
        processingBulkChannel.value = false;
        hideLoader();
    }
};

// Handlers for unified bottom pagination dock bulk operations
const onDockApplyLocation = async (targetLoc) => {
    bulkLocationTarget.value = targetLoc;
    await applyBulkLocation();
};

const onDockApplyStatus = async (targetSt) => {
    bulkStatusTarget.value = targetSt;
    await applyBulkStatus();
};

const onDockApplyChannel = async (targetCh) => {
    bulkChannelTarget.value = targetCh;
    await applyBulkChannel();
};

// Checkout State
const checkoutModal = ref(null);
const checkoutPrice = ref('');
const checkoutReceiptFile = ref(null);
const checkoutReceiptPreview = ref(null);
const checkoutSuccess = ref(false);
const generatedDescription = ref('');

// Edit Drawer State
const isEditDrawerOpen = ref(false);

// Camera State (Checkout only)
const cameraVideo = ref(null);
const isCameraOpen = ref(false);
const cameraStream = ref(null);

// Trigger loader on setup only if items not already loaded
const { showLoader, updateLoader, hideLoader } = useLoader();

// Guarantee loader dismisses when useInventory finishes loading
watch(loading, (isLoading) => {
    if (!isLoading) {
        hideLoader();
    }
});

// Lifecycle
onMounted(async () => {
    console.log("InventoryManager Mounted - Version with Image Fetcher");
    
    // Check URL parameters for location or status filters
    if (typeof window !== 'undefined' && window.location?.search) {
        const params = new URLSearchParams(window.location.search);
        const loc = params.get('location');
        const st = params.get('status');
        if (loc) filterBinLocation.value = loc;
        if (st) filterStatus.value = st;
    }

    try {
        if (inventoryItems.value.length === 0) {
            showLoader("Loading Inventory...");
        }
        await fetchInventory(currentTeam.value?.$id || ''); 
    } catch (e) {
        console.error("Failed to load inventory:", e);
    } finally {
        hideLoader();
    }
});

// Watch for Auth / Team changes
watch(authLoading, async (newVal, oldVal) => {
    if (oldVal && !newVal) {
        try {
            await fetchInventory(currentTeam.value?.$id || ''); 
        } finally {
            hideLoader();
        }
    }
});

watch(currentTeam, async (newTeam, oldTeam) => {
    if (newTeam?.$id !== oldTeam?.$id) {
        try {
            await fetchInventory(newTeam?.$id || '');
        } finally {
            hideLoader();
        }
    }
});

// Helpers
const getNoteValue = (notes, key, isCurrency = false) => {
    if (!notes) return null;
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Allow optional colon, capture value until newline or end of string
    const regex = new RegExp(`${escapedKey}[:\\s]*([^\\n\\r]+)`, 'i');
    const match = notes.match(regex);
    if (match) {
        let val = match[1].trim();
        if (isCurrency) val = val.replace('$', '').trim();
        return val;
    }
    return null;
};

const getImageUrl = (item) => {
    let id = item.imageId;
    if (!id && item.galleryImageIds?.length > 0) id = item.galleryImageIds[0];
    
    // Fallback: Check Notes
    if (!id && item.conditionNotes) {
         const match = item.conditionNotes.match(/\[MAIN IMAGE ID: ([^\]]+)\]/);
         if (match) id = match[1].split(',')[0].trim();
    }
    
    if (!id) return null;
    if (id.startsWith('http')) return proxify(id);
    return getAssetUrl(id);
};

const getAssetUrl = (id) => {
    if (!id) return '';
    if (typeof id === 'string' && (id.startsWith('http') || id.startsWith('data:') || id.startsWith('blob:') || id.startsWith('/api/'))) {
        return proxify(id);
    }
    return `${ENDPOINT}/storage/buckets/${BUCKET}/files/${id}/preview?project=${PROJECT}&width=350&height=350&quality=80&output=webp`;
};
const getObjectUrl = (file) => URL.createObjectURL(file);
const formatCurrency = (val) => {
    if(!val) return '-';
    const num = parseFloat(val.toString().replace('$',''));
    return isNaN(num) ? val : '$' + num.toFixed(2);
};

const formatPriceRange = (val) => {
    if (!val) return '-';
    
    // 1. Try to parse if string looks like JSON
    if (typeof val === 'string' && val.trim().startsWith('{')) {
        try {
            val = JSON.parse(val);
        } catch (e) { /* ignore */ }
    }

    // 2. Handle Object { low, high }
    if (typeof val === 'object' && val !== null) {
        const low = val.low ?? val.Low ?? val.min ?? val.Min ?? val.low_price ?? val.start;
        const high = val.high ?? val.High ?? val.max ?? val.Max ?? val.high_price ?? val.end;
        
        if (low !== undefined && high !== undefined) return `$${low} - $${high}`;
        if (low !== undefined) return `$${low}+`;
        
        // Fallback: simple stringify only numbers?
        return JSON.stringify(val).replace(/[{}"]/g, '').replace(/,/g, ', ');
    }
    
    return val;
};

const formatPriceOnly = (val) => {
    if (!val) return '';
    const s = formatPriceRange(val);
    // Extract first price-like substring "$5 - $15" or "$10"
    // Stop at any character that isn't digit, dot, dash, space, or $
    // Actually, simpler: just take the first part before any paren or alpha text
    // E.g. "$5 - $15 (some text)" -> "$5 - $15"
    return s.split(/[a-z(]/i)[0].trim();
};

// Global Helpers for Price Parsing
const parsePrice = (p) => {
    if (!p) return 0;
    if (typeof p === 'number') return p;
    // Handle Object {min, max}
    if (typeof p === 'object') {
        const l = parseFloat((p.low || p.min || p.mint || 0).toString().replace(/,/g, ''));
        const h = parseFloat((p.high || p.max || p.fair || l).toString().replace(/,/g, ''));
        return (l + h) / 2;
    }
    
    // Aggressive cleanup: Remove $, commas, parens, letters (except 'to' separator logic handled in match)
    // Actually, let's just strip $, commas to start
    const s = String(p).replace(/[$,]/g, '').trim(); 

    // Handle range "10-20", "10 to 20", "10–20" (en dash), "10−20" (minus)
    // Regex: (Number) (Separator) (Number)
    const range = s.match(/(\d+(?:\.\d+)?)\s*(?:[-–—−]|to)\s*(\d+(?:\.\d+)?)/i);
    
    if (range) {
        return (parseFloat(range[1]) + parseFloat(range[2])) / 2;
    }
    // Handle single number "15.00", "15"
    const single = s.match(/(\d+(?:\.\d+)?)/);
    return single ? parseFloat(single[1]) : 0;
};

const getRationalPrice = (item) => {
    const fair = parsePrice(item.price_breakdown?.fair);
    const mint = parsePrice(item.price_breakdown?.mint);
    const poor = parsePrice(item.price_breakdown?.poor);

    // Sanity Check: If Fair is crazy high vs Mint (e.g. Fair $1000, Mint $40)
    if (mint > 0 && fair > mint * 1.5) {
        return (mint + (poor || 0)) / 2;
    }
    
    return fair || mint || 0;
};

const renderMarkdown = (text) => marked(text || '');

const proxify = (url) => {
    if (!url) return null;
    if (typeof url !== 'string') return url;
    // Don't proxy blobs, data URIs, or already proxied URLs
    if (url.startsWith('blob:') || url.startsWith('data:') || url.includes('/api/proxy-image')) return url;
    // Don't proxy internal Appwrite storage links (usually safe, avoids double traffic)
    if (url.includes('/storage/buckets/')) return url;
    
    // Proxy all other http(s) links to avoid mixed content / CORS / Hotlinking issues
    if (url.startsWith('http')) {
        return `/api/proxy-image?url=${encodeURIComponent(url)}`;
    }
    return url;
};



//---------------------------------------------------------
// CHECKOUT LOGIC
//---------------------------------------------------------
const openCheckout = (item) => {
    activeItem.value = item;
    checkoutPrice.value = '';
    checkoutReceiptFile.value = null;
    checkoutReceiptPreview.value = null;
    checkoutSuccess.value = false;
    generatedDescription.value = '';
    checkoutModal.value.showModal();
};

const closeCheckout = () => {
    checkoutModal.value.close();
    stopCamera();
};

const clearCheckoutReceipt = () => {
    checkoutReceiptFile.value = null;
    checkoutReceiptPreview.value = null;
};

const submitCheckout = async () => {
    if (!activeItem.value) return;
    processing.value = true;
    try {
        await updateInventoryItem(activeItem.value.$id, {
            status: 'acquired',
            cost: checkoutPrice.value,
            receiptFile: checkoutReceiptFile.value
        });
        
        // Success UI
        checkoutSuccess.value = true;
        
        // Removed AI Gen trigger: The user requested generation be deferred until listing
        generatedDescription.value = "Item correctly transitioned to 'Acquired'. Description generation has been deferred until the item is placed for sale.";
        
    } catch (e) {
        addToast({ type: 'error', message: 'Checkout failed: ' + e.message });
    } finally {
        processing.value = false;
    }
};

//---------------------------------------------------------
// EDIT DRAWER LOGIC & URL DEEP-LINKING (?upc=HUCK-2251)
//---------------------------------------------------------

function syncUrlWithDrawer(item) {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (item) {
        const identifier = item.upc || item.sku || item.$id;
        if (identifier) url.searchParams.set('upc', identifier);
    } else {
        url.searchParams.delete('upc');
        url.searchParams.delete('item');
        url.searchParams.delete('sku');
        url.searchParams.delete('id');
    }
    window.history.replaceState({}, '', url.toString());
}

function checkUrlForDirectItemOpen() {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const target = params.get('upc') || params.get('sku') || params.get('item') || params.get('id');
    if (!target || !inventoryItems.value || inventoryItems.value.length === 0) return;
    
    const cleanTarget = target.trim().toLowerCase();
    const found = inventoryItems.value.find(i => 
        (i.upc && i.upc.toLowerCase() === cleanTarget) ||
        (i.sku && i.sku.toLowerCase() === cleanTarget) ||
        i.$id === target.trim()
    );
    if (found && !isEditDrawerOpen.value) {
        openEdit(found);
    }
}

// Check URL param whenever inventory items load
watch(inventoryItems, () => {
    checkUrlForDirectItemOpen();
}, { immediate: true });

const openAdd = () => {
    activeItem.value = null; // Create Mode
    isEditDrawerOpen.value = true;
};

const openEdit = (item) => {
    activeItem.value = item;
    isEditDrawerOpen.value = true;
    syncUrlWithDrawer(item);
};

const closeEditDrawer = () => {
    isEditDrawerOpen.value = false;
    syncUrlWithDrawer(null);
};

const saveEdit = async (payload) => {
    processing.value = true;
    try {
        const targetItem = activeItem.value;
        const targetId = targetItem?.$id || targetItem?.id;
        if (targetId) {
            // UPDATE EXISTING
            const prefix = currentTeam.value?.prefs?.upcPrefix || user.value?.prefs?.upcPrefix || 'HUCK-';
            if (!payload.upc && !targetItem.upc) {
                payload.upc = getNextUpc(prefix);
            }

            const updatedDoc = await updateInventoryItem(targetId, payload);
            // Optimistic update to immediately reflect in UI before Appwrite query cache clears
            const idx = inventoryItems.value.findIndex(i => i && (i.$id === targetId || i.id === targetId));
            if (idx !== -1) {
                inventoryItems.value[idx] = updatedDoc;
            }
        } else {
            // CREATE NEW
            const prefix = currentTeam.value?.prefs?.upcPrefix || user.value?.prefs?.upcPrefix || 'HUCK-';
            if (!payload.upc) {
                payload.upc = getNextUpc(prefix);
            }
            const effectiveTeamId = currentTeamId.value || user.value?.$id;
             const newDoc = await saveItemToInventory(
                { title: payload.title || 'Untitled Item', identity: payload.title, condition_notes: '' }, 
                payload.imageFile,
                payload,
                effectiveTeamId
            );
            if (newDoc) {
                inventoryItems.value.unshift(newDoc);
            }
        }

        closeEditDrawer();
        // Fire async refresh in background just in case
        fetchInventory('').catch(() => {});
        addToast({ type: 'success', message: 'Item saved successfully.' });
    } catch (e) {
        addToast({ type: 'error', message: 'Save failed: ' + e.message });
    } finally {
        processing.value = false;
    }
};

//---------------------------------------------------------
// CAMERA & FILE LOGIC (Checkout)
//---------------------------------------------------------
const handleFileSelect = (e, type) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (type === 'receipt') {
        processFile(files[0], (file, url) => {
            checkoutReceiptFile.value = file;
            checkoutReceiptPreview.value = url;
        });
    }
};

const processFile = (file, cb) => {
    cb(file, URL.createObjectURL(file));
};

const startCamera = async (context) => {
    try {
        cameraStream.value = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        
        if (context === 'checkout') {
            isCameraOpen.value = true;
            setTimeout(() => {
                if (cameraVideo.value) cameraVideo.value.srcObject = cameraStream.value;
            }, 100);
        }
    } catch (e) {
        addToast({ type: 'error', message: "Camera Error: " + e.message });
    }
};

const stopCamera = () => {
    if (cameraStream.value) {
        cameraStream.value.getTracks().forEach(t => t.stop());
        cameraStream.value = null;
    }
    isCameraOpen.value = false;
};

const capturePhoto = (context) => {
    const videoEl = cameraVideo.value;
    if (!videoEl) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    canvas.getContext('2d').drawImage(videoEl, 0, 0);

    canvas.toBlob(blob => {
        const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
        if (context === 'checkout') {
            checkoutReceiptFile.value = file;
            checkoutReceiptPreview.value = URL.createObjectURL(blob);
            stopCamera();
        }
    }, 'image/jpeg', 0.8);
};

// General
const confirmDelete = async (id) => {
    if (!(await confirmDialog('Are you sure you want to delete this item?', 'Delete Item', 'Delete', 'Cancel', 'btn-error'))) return;
    processingId.value = id;
    try {
        await deleteInventoryItem(id);
        addToast({ type: 'success', message: 'Item deleted.' });
        // Realtime should handle removal from list, but manual optimistic update supported by useInventory too
    } catch(e) {
        addToast({ type: 'error', message: 'Delete failed' });
    } finally {
        processingId.value = false;
    }
};

const copyShareLink = async (id) => {
    if (!id) return;
    const url = `${window.location.origin}/item/${id}`;
    try {
        await navigator.clipboard.writeText(url);
        window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Link copied to clipboard!', type: 'success' } }));
        addToast({ type: 'success', message: 'Link copied to clipboard!' });
    } catch (err) {
        addToast({ type: 'error', message: 'Failed to copy link: ' + url });
    }
};

//---------------------------------------------------------
// DECONSTRUCT LOGIC
//---------------------------------------------------------
const deconstructModalRef = ref(null);
const deconstructItemData = ref(null);
const deconstructCount = ref(2);
const isDeconstructing = ref(false);

function guessQuantityFromTitle(title) {
    if (!title) return null;
    const lower = title.toLowerCase();
    
    // Pattern: "Lot of 50", "Set of 6", "Bundle of 12"
    let match = lower.match(/(?:lot|set|bundle|collection)\s+of\s+(\d+)/);
    if (match) return parseInt(match[1]);
    
    // Pattern: "50 Comic Books"
    match = lower.match(/^(\d+)\s+(?:comic|graphic|book|magazine|item|piece|dvd|cd|game)/);
    if (match) return parseInt(match[1]);
    
    // Pattern: "x15" or "15x"
    match = lower.match(/(?:\s|^)x\s*(\d+)(?:\s|$)/);
    if (match) return parseInt(match[1]);
    
    match = lower.match(/(?:\s|^)(\d+)\s*x(?:\s|$)/);
    if (match) return parseInt(match[1]);
    
    return null;
}

const openDeconstructModal = async (payload) => {
    const item = payload.item || (payload.$id ? payload : activeItem.value) || {};
    const aiCount = payload.count || null;
    const aiItems = payload.scoutItems || null;
    
    previewItem.value = null; // Close preview
    isEditDrawerOpen.value = false; // Close edit drawer
    deconstructItemData.value = { ...item, _aiItems: aiItems };
    
    let dbQty = item.quantity && item.quantity > 1 ? parseInt(item.quantity) : 2;
    let guessedQty = guessQuantityFromTitle(item.title) || 0;
    
    deconstructCount.value = aiCount || Math.max(dbQty, guessedQty);
    
    if (aiCount !== null && aiCount > 0 && aiItems && aiItems.length > 0) {
        // AI already generated the items, skip asking how many and go straight to execution
        deconstructCount.value = aiCount;
        closeEditDrawer();
        addToast({ type: 'info', message: `Splitting into ${aiCount} items... Please wait.` });
        submitDeconstruct();
    } else {
        if (deconstructModalRef.value) deconstructModalRef.value.showModal();
    }
};

const closeDeconstructModal = () => {
    if (deconstructModalRef.value) deconstructModalRef.value.close();
    deconstructItemData.value = null;
};

const submitDeconstruct = async () => {
    if (!deconstructItemData.value || deconstructCount.value < 2) return;
    
    isDeconstructing.value = true;
    try {
        const parent = deconstructItemData.value;
        const count = deconstructCount.value;
        
        showLoader("Splitting Lot...", {
            step: `Step 1 of 3: Preparing parent lot & calculating split cost basis...`,
            progress: 10,
            cancelable: false
        });
        
        let parentCost = parseFloat(parent.cost || parent.purchasePrice);
        if (isNaN(parentCost) && parent.conditionNotes) {
            const match = parent.conditionNotes.match(/Paid:[ \t]*\$?([0-9.]+)/i);
            if (match) parentCost = parseFloat(match[1]);
        }
        
        const totalCost = parentCost || 0;
        const costPerUnit = parseFloat((totalCost / count).toFixed(2));
        const user = await account.get();
        const teamId = localStorage.getItem('activeTeamId') || user.prefs?.teamId || null;

        let duplicatedImageId = null;
        let parentImageElement = null;
        let pImageId = parent.imageId || parent.mainPhotoId;
        if (!pImageId && parent.existingGalleryIds && parent.existingGalleryIds.length > 0) pImageId = parent.existingGalleryIds[0];
        if (!pImageId && parent.galleryImageIds && parent.galleryImageIds.length > 0) pImageId = parent.galleryImageIds[0];
        if (!pImageId && Array.isArray(parent.images) && parent.images.length > 0) pImageId = parent.images[0];
        if (!pImageId && typeof parent.images === 'string') {
            try { const parsed = JSON.parse(parent.images); if (Array.isArray(parsed) && parsed.length > 0) pImageId = parsed[0]; } catch(e){}
        }
        if (!pImageId && parent.conditionNotes) {
             const match = parent.conditionNotes.match(/\[MAIN IMAGE ID: ([^\]]+)\]/);
             if (match) pImageId = match[1].split(',')[0].trim();
        }

        if (pImageId) {
            try {
                updateLoader("Splitting Lot...", `Step 1 of 3: Loading original lot photo for cropping...`, 15);
                const url = getAssetUrl(pImageId);
                const proxiedUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
                const res = await fetch(proxiedUrl);
                const blob = await res.blob();
                const objectUrl = URL.createObjectURL(blob);
                
                // Pre-load for cropping later
                parentImageElement = new Image();
                await new Promise((resolve, reject) => {
                     parentImageElement.onload = resolve;
                     parentImageElement.onerror = reject;
                     parentImageElement.src = objectUrl;
                });
                URL.revokeObjectURL(objectUrl);

                const file = new File([blob], `split-${pImageId}.jpg`, { type: blob.type });
                const upload = await storage.createFile(BUCKET, ID.unique(), file);
                duplicatedImageId = upload.$id;
            } catch (e) {
                console.error("Failed to duplicate parent image", e);
            }
        }

        let aiItems = parent._aiItems || null;
        
        // If the AI returned exactly ONE item, and it has 'lot_items', the user is splitting the lot_items!
        if (aiItems && aiItems.length === 1 && aiItems[0].lot_items && Array.isArray(aiItems[0].lot_items)) {
            aiItems = aiItems[0].lot_items;
        } else if (!aiItems && parent.rawAnalysis) {
            // Fallback: try to parse rawAnalysis if we didn't get _aiItems (e.g. triggered from inventory list instead of drawer)
            try {
                const parsed = JSON.parse(parent.rawAnalysis);
                const items = Array.isArray(parsed) ? parsed : (parsed.items || [parsed]);
                if (items.length === 1 && items[0].lot_items && Array.isArray(items[0].lot_items)) {
                    aiItems = items[0].lot_items;
                } else {
                    aiItems = items;
                }
            } catch (e) {
                console.error('Failed to parse rawAnalysis for split names', e);
            }
        }

        const loadedGalleryImages = {};
        const getGalleryImageElement = async (imgId) => {
            if (!imgId) return parentImageElement;
            if (loadedGalleryImages[imgId]) return loadedGalleryImages[imgId];
            try {
                const url = getAssetUrl(imgId);
                const proxiedUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
                const res = await fetch(proxiedUrl);
                const blob = await res.blob();
                const objectUrl = URL.createObjectURL(blob);
                const img = new Image();
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = objectUrl;
                });
                URL.revokeObjectURL(objectUrl);
                loadedGalleryImages[imgId] = img;
                return img;
            } catch(e) {
                return parentImageElement;
            }
        };

        for (let i = 0; i < count; i++) {
            const aiData = aiItems && aiItems[i] ? aiItems[i] : null;
            const title = aiData ? (aiData.title || aiData.name || `${parent.title} (Unit ${i + 1} of ${count})`) : `${parent.title} (Unit ${i + 1} of ${count})`;
            const identity = aiData && (aiData.identity || aiData.title || aiData.name) ? (aiData.identity || aiData.title || aiData.name) : (parent.identity || parent.title);
            
            const currentPct = Math.round(20 + ((i + 1) / count) * 65);
            updateLoader("Splitting Lot...", `Step 2 of 3: Cropping & creating item ${i + 1} of ${count} (${title})...`, currentPct);
            
            let targetImgElement = parentImageElement;
            const galleryList = (parent.galleryImageIds && parent.galleryImageIds.length > 0) ? parent.galleryImageIds : (parent.existingGalleryIds || []);
            if (aiData && aiData.image_index !== undefined && galleryList[aiData.image_index]) {
                const specificImg = await getGalleryImageElement(galleryList[aiData.image_index]);
                if (specificImg) targetImgElement = specificImg;
            }
            
            let childImageId = duplicatedImageId;
            
            // Priority 1: Direct base64 image data (e.g. from client cropPreviews or per-photo AI)
            if (aiData && aiData.image && typeof aiData.image === 'string' && aiData.image.startsWith('data:')) {
                try {
                    const res = await fetch(aiData.image);
                    const blob = await res.blob();
                    if (blob && blob.size > 0) {
                        const file = new File([blob], `ai-split-${ID.unique()}.jpg`, { type: 'image/jpeg' });
                        const upload = await storage.createFile(BUCKET, ID.unique(), file);
                        childImageId = upload.$id;
                    }
                } catch (e) {
                    console.error("Failed to upload base64 image for split item", e);
                }
            }
            // Priority 2: Direct existing gallery image ID
            else if (aiData && aiData.image_index !== undefined && !aiData.bounding_box && galleryList[aiData.image_index]) {
                childImageId = galleryList[aiData.image_index];
            } 
            // Priority 3: Remote image URL
            else if (aiData && aiData.image && typeof aiData.image === 'string' && aiData.image.startsWith('http')) {
                try {
                    const proxiedUrl = `/api/proxy-image?url=${encodeURIComponent(aiData.image)}`;
                    const res = await fetch(proxiedUrl);
                    if (res.ok) {
                        const blob = await res.blob();
                        const file = new File([blob], `ai-split-${ID.unique()}.jpg`, { type: blob.type || 'image/jpeg' });
                        const upload = await storage.createFile(BUCKET, ID.unique(), file);
                        childImageId = upload.$id;
                    }
                } catch (e) {
                    console.error("Failed to fetch AI image for split item", e);
                }
            } 
            // Priority 4: Bounding box crop on target image
            else if (aiData && aiData.bounding_box && targetImgElement) {
                 try {
                     let bbox = aiData.bounding_box;
                     if (typeof bbox === 'string') {
                         bbox = JSON.parse(bbox);
                     }
                     const [ymin, xmin, ymax, xmax] = bbox;
                     const imgW = targetImgElement.naturalWidth;
                     const imgH = targetImgElement.naturalHeight;
                     
                     const sx = (xmin / 1000) * imgW;
                     const sy = (ymin / 1000) * imgH;
                     const sWidth = ((xmax - xmin) / 1000) * imgW;
                     const sHeight = ((ymax - ymin) / 1000) * imgH;
                     
                     const paddingX = sWidth * 0.1;
                     const paddingY = sHeight * 0.1;
                     const cropX = Math.max(0, sx - paddingX);
                     const cropY = Math.max(0, sy - paddingY);
                     const cropW = Math.min(imgW - cropX, sWidth + (paddingX * 2));
                     const cropH = Math.min(imgH - cropY, sHeight + (paddingY * 2));
                     
                     const canvas = document.createElement('canvas');
                     canvas.width = cropW;
                     canvas.height = cropH;
                     const ctx = canvas.getContext('2d');
                     ctx.drawImage(targetImgElement, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
                     
                     const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
                     const file = new File([blob], `crop-${ID.unique()}.jpg`, { type: 'image/jpeg' });
                     const upload = await storage.createFile(BUCKET, ID.unique(), file);
                     childImageId = upload.$id;
                 } catch(e) {
                     console.error("Failed to crop image using bounding box", e);
                 }
            }
            
            let notes = aiData ? `Extracted from lot: ${parent.title}` : `[Needs Scouting]\n\nExtracted from lot: ${parent.title}`;
            if (aiData && aiData.condition) notes = `Condition: ${aiData.condition}\n\n` + notes;
            if (aiData && aiData.estimated_value) notes = `Estimated Value: ${aiData.estimated_value}\n\n` + notes;
            
            const childData = {
                title: title,
                identity: identity,
                condition_notes: notes
            };
            
            const extraData = {
                cost: costPerUnit,
                status: (parent.status === 'inbound' || parent.status === 'raw_lot') ? 'received' : parent.status,
                sourcingLocation: "", // Clear sourcing location for child
                storageLocation: parent.storageLocation,
                imageId: childImageId,
                galleryImageIds: [], // Clear gallery images
                keywords: parent.keywords,
                quantity: 1,
                parentLotId: parent.$id,
                ...(aiData ? { scoutData: aiData } : {})
            };
            
            await saveItemToInventory(childData, null, extraData, teamId);
        }
        
        updateLoader("Splitting Lot...", `Step 3 of 3: Archiving parent lot & finalizing child items...`, 95);
        
        await updateInventoryItem(parent.$id, { 
            status: 'archived',
            cost: 0, // Transfer all cost to children to prevent double-counting
            condition_notes: (parent.conditionNotes || '') + `\n\n[DECONSTRUCTED into ${count} units on ${new Date().toLocaleDateString()}]`
        });
        
        addToast({ type: 'success', message: `Successfully deconstructed into ${count} items.` });
        closeDeconstructModal();
        hideLoader();
        
        setTimeout(() => {
            window.location.reload();
        }, 500);
        
    } catch (e) {
        console.error("Deconstruct error:", e);
        addToast({ type: 'error', message: 'Failed to deconstruct: ' + e.message });
        hideLoader();
    } finally {
        isDeconstructing.value = false;
    }
};

// Removed old bundle methods

const combineModal = ref(null);
const combineTitle = ref('');
const combineTitleSuggestions = ref([]);
const combineCost = ref(0);
const combineTotalUnits = ref(1);
const combinePrimaryId = ref(null);
const savingCombine = ref(false);

function generateSmartLotTitle(items, totalQty) {
    if (!items || items.length === 0) return { defaultTitle: `Master Lot (Qty: ${totalQty})`, suggestions: [] };

    // Clean individual title noise (e.g., "12pc", "Lot of 5", "Auction", SGW tags)
    const cleanTitles = items.map(i => {
        let t = (i.title || '').trim();
        t = t.replace(/^(lot of \d+|\d+\s*(?:pc|pcs|items?|piece|pieces|count|mags?|magazines?))\s*[:-]?\s*/gi, '');
        t = t.replace(/\s*\(?(?:lot of \d+|\d+\s*(?:pc|pcs|items?|piece|pieces|count))\)?/gi, '');
        t = t.replace(/\[[^\]]*\]/g, ''); // remove [tags]
        t = t.replace(/\b\d{6,}\b/g, ''); // remove long random numeric IDs
        return t.trim();
    }).filter(t => t.length > 0);

    // Token analysis for common keywords across all titles
    const stopWords = new Set(['and', 'the', 'for', 'with', 'from', 'vintage', 'rare', 'lot', 'set', 'pcs', 'piece', 'pieces', 'items', 'mixed', 'collection', 'huge', 'great', 'condition']);
    const tokenLists = cleanTitles.map(t => 
        t.toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && !stopWords.has(w))
    );

    // Find words common across all items
    const commonTokens = (tokenLists[0] || []).filter(token => 
        tokenLists.every(list => list.includes(token))
    );

    let theme = '';
    if (commonTokens.length > 0) {
        // Look for common continuous phrase in original title
        const primaryClean = cleanTitles[0];
        const phraseRegex = new RegExp(commonTokens.join('\\s+'), 'i');
        const match = primaryClean.match(phraseRegex);
        if (match) {
            theme = match[0];
        } else {
            theme = commonTokens.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }
    } else {
        // Fallback to shared brand/category or primary clean title
        const sharedBrand = items.find(i => i.brand)?.brand;
        const sharedCat = items.find(i => i.category)?.category;
        theme = sharedBrand || sharedCat || cleanTitles[0] || 'Items';
    }

    // Capitalize words nicely
    theme = theme.replace(/\b\w/g, l => l.toUpperCase()).trim();

    // Generate formatted suggestions
    const suggestions = [];
    
    // Suggestion 1: Clean Subject (Lot of X)
    suggestions.push(`${theme} (Lot of ${totalQty})`);
    
    // Suggestion 2: Combined Lot of X: Theme
    suggestions.push(`Combined Lot of ${totalQty}: ${theme}`);
    
    // Suggestion 3: Mega Lot: Theme (X Items)
    suggestions.push(`${theme} Mega Lot (${totalQty} Items)`);

    // If 2-3 short distinct titles, offer combined titles
    if (cleanTitles.length >= 2 && cleanTitles.length <= 3) {
        const shortNames = cleanTitles.map(t => t.length > 22 ? t.slice(0, 20) + '...' : t).join(' + ');
        suggestions.push(`${shortNames} (Lot of ${totalQty})`);
    }

    const defaultTitle = suggestions[0] || `Master Lot of ${totalQty} Items`;
    return { defaultTitle, suggestions };
}

const openCombineModal = () => {
    const items = selectedItemsObjects.value;
    if (items.length < 2) return;
    
    // Choose the first item as default primary
    combinePrimaryId.value = items[0].$id;
    
    // Calculate total cost and total quantity (parsing embedded counts like "12pc", "Lot of 10", "8 Issues")
    const totalCost = items.reduce((sum, i) => sum + (parseFloat(i.cost) || 0), 0);
    const totalQty = items.reduce((sum, i) => {
        let q = parseInt(i.quantity);
        if (isNaN(q) || q <= 1) {
            const titleMatch = (i.title || '').match(/(?:lot of\s*(\d+)|\b(\d+)\s*(?:pc|pcs|items?|piece|pieces|mags?|magazines?|issues?)\b)/i);
            if (titleMatch) {
                const parsed = parseInt(titleMatch[1] || titleMatch[2], 10);
                if (!isNaN(parsed) && parsed > 1) return sum + parsed;
            }
        }
        return sum + (q > 0 ? q : 1);
    }, 0);
    
    combineCost.value = parseFloat(totalCost.toFixed(2));
    combineTotalUnits.value = totalQty;

    // Generate smart lot title and quick suggestion chips
    const { defaultTitle, suggestions } = generateSmartLotTitle(items, totalQty);
    combineTitle.value = defaultTitle;
    combineTitleSuggestions.value = suggestions;
    
    if (combineModal.value) {
        combineModal.value.showModal();
    }
};

const onCombinePrimaryChange = () => {
    // Keep user customized title or regenerate with new primary context
    const primaryItem = selectedItemsObjects.value.find(i => i.$id === combinePrimaryId.value);
    if (primaryItem) {
        // Re-generate suggestions prioritizing this primary item if needed
        const items = [
            primaryItem,
            ...selectedItemsObjects.value.filter(i => i.$id !== combinePrimaryId.value)
        ];
        const { suggestions } = generateSmartLotTitle(items, combineTotalUnits.value);
        combineTitleSuggestions.value = suggestions;
    }
};

const closeCombineModal = () => {
    if (combineModal.value) {
        combineModal.value.close();
    }
};

const submitCombine = async () => {
    const items = selectedItemsObjects.value;
    if (items.length < 2 || !combinePrimaryId.value) return;
    
    savingCombine.value = true;
    try {
        const primaryItem = items.find(i => i.$id === combinePrimaryId.value);
        if (!primaryItem) throw new Error("Primary item not found.");
        
        const user = await account.get();
        const teamId = localStorage.getItem('activeTeamId') || user.prefs?.teamId || null;
        
        // 1. Combine images from all selected items
        const galleryIdsSet = new Set();
        items.forEach(item => {
            if (item.imageId) galleryIdsSet.add(item.imageId);
            if (item.galleryImageIds) {
                item.galleryImageIds.forEach(id => galleryIdsSet.add(id));
            }
        });
        const combinedGallery = Array.from(galleryIdsSet);
        const mainImageId = primaryItem.imageId || combinedGallery[0] || null;
        
        // 2. Prepare description/condition notes merge
        let combinedNotes = (primaryItem.conditionNotes || '').trim();
        const otherNotesList = items
            .filter(i => i.$id !== primaryItem.$id)
            .map(i => `[Merged Item: ${i.title} - Cost: $${Number(i.cost || 0).toFixed(2)}, Qty: ${i.quantity || 1}]\n${i.conditionNotes || ''}`.trim())
            .filter(n => n.length > 0);
        
        // Clean sourcing URL from combined notes so AI scans strictly use the combined photo gallery
        combinedNotes = combinedNotes.replace(/Location:\s*https?:\/\/[^\s\n]+/gi, '').trim();

        // Calculate combined resale price
        const totalResale = items.reduce((sum, i) => sum + (parseFloat(i.resalePrice || i.listPrice || 0) || 0), 0);

        // 3. Create the new combined item document representing the combined lot
        const extraData = {
            cost: combineCost.value,
            resalePrice: totalResale ? totalResale.toFixed(2) : undefined,
            status: primaryItem.status || 'acquired',
            sourcingLocation: 'Combined Lot', // Fresh custom lot: no old auction URL
            storageLocation: primaryItem.storageLocation,
            imageId: mainImageId,
            galleryImageIds: combinedGallery,
            keywords: Array.from(new Set(items.flatMap(i => i.keywords || []))),
            quantity: combineTotalUnits.value,
            parentLotId: null,
            rawAnalysis: null // Clear stale analysis so AI runs a fresh comprehensive lot appraisal
        };
        
        const combinedLotDoc = await saveItemToInventory(
            { 
                title: combineTitle.value, 
                identity: combineTitle.value, 
                condition_notes: combinedNotes 
            },
            null, // no file upload
            extraData,
            teamId
        );
        
        // 4. Update all original items: set status to 'combined' and link to new lot
        const updatePromises = items.map(item => 
            updateInventoryItem(item.$id, {
                status: 'combined',
                parentLotId: combinedLotDoc.$id
            })
        );
        await Promise.all(updatePromises);
        
        // 5. Optimistically update local state
        // Add new combined document to inventory list
        inventoryItems.value.unshift(combinedLotDoc);
        // Mark combined items locally
        inventoryItems.value.forEach(item => {
            if (items.some(i => i.$id === item.$id)) {
                item.status = 'combined';
                item.parentLotId = combinedLotDoc.$id;
            }
        });
        
        // Close modal and reset state
        closeCombineModal();
        selectedItems.value = [];
        addToast({ type: 'success', message: `Successfully combined into new lot "${combineTitle.value}"!` });
        
        // Async refresh in background
        fetchInventory('').catch(() => {});
    } catch (e) {
        addToast({ type: 'error', message: 'Failed to combine items: ' + e.message });
        console.error(e);
    } finally {
        savingCombine.value = false;
    }
};

const showImport = ref(false); // CSV Modal



</script>

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
            
            <div class="drawer-content flex flex-col pb-8 lg:pl-5 pt-0 min-w-0">
                <!-- COMPACT SINGLE-ROW STICKY HEADER -->
                <div class="sticky top-0 z-30 bg-base-100/95 backdrop-blur-md border-b border-base-200 py-2.5 mb-4 -mx-4 px-4 sm:mx-0 sm:px-0 shadow-xs">
                    <div class="flex items-center gap-2 sm:gap-3">
                        <!-- Left: Page Title & Item Count -->
                        <div class="shrink-0 flex items-center gap-1.5">
                            <h1 class="text-lg sm:text-xl font-bold tracking-tight text-base-content leading-none">Inventory</h1>
                            <span class="badge badge-sm badge-neutral font-mono font-bold">{{ filteredInventory.length }}</span>
                            <span v-if="loading" class="loading loading-spinner loading-xs text-primary"></span>
                        </div>

                        <!-- Center: Full-width Omnibox Search -->
                        <div class="relative flex-1 min-w-0">
                            <Icon icon="solar:magnifer-linear" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
                            <input 
                                type="text" 
                                v-model="searchQuery" 
                                placeholder="Search title, UPC, PO, vendor, location..." 
                                class="input input-bordered input-sm w-full pl-9 pr-9 bg-base-200/60 focus:bg-base-100 font-mono text-xs shadow-inner rounded-lg" 
                            />
                            <button v-if="searchQuery" @click="searchQuery = ''" class="btn btn-ghost btn-circle btn-sm w-8 h-8 min-h-8 absolute right-0.5 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 touch-manipulation active:scale-90 flex items-center justify-center font-bold text-xs" title="Clear search">✕</button>
                        </div>

                        <!-- Right: Quick Add + Mobile Filter Drawer Toggle -->
                        <div class="flex items-center gap-1.5 shrink-0">
                            <button class="btn btn-sm btn-primary gap-1 hidden sm:inline-flex shadow-xs" @click="openAdd">
                                <Icon icon="solar:add-circle-linear" class="w-4 h-4" /> Add
                            </button>
                            <label for="inventory-sidebar" class="btn btn-sm btn-ghost border border-base-300 bg-base-100 lg:hidden gap-1.5 shadow-xs" title="Open Filters & Tools">
                                <Icon icon="solar:tuning-square-2-bold-duotone" class="w-4 h-4 text-primary" />
                                <span class="text-xs font-bold">Filters</span>
                                <span v-if="activeFilterCount > 0" class="badge badge-xs badge-primary font-bold">{{ activeFilterCount }}</span>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- ACTIVE FILTERS SUMMARY BANNER -->
                <div v-if="activeFilterCount > 0" class="alert alert-info py-2 px-3 shadow-xs flex items-center justify-between gap-2 mb-3 text-xs rounded-xl">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <Icon icon="solar:filter-linear" class="w-4 h-4 shrink-0" />
                        <span class="font-semibold">Active Filters:</span>
                        <span v-if="filterStatus !== 'all'" class="badge badge-sm badge-neutral font-bold capitalize">{{ filterStatus }}</span>
                        <span v-if="insightFilter" class="badge badge-sm badge-warning font-bold">{{ insightFilter.replace(/_/g, ' ') }}</span>
                        <span v-if="filterUpcPrefix" class="badge badge-sm badge-neutral font-mono font-bold">UPC: {{ filterUpcPrefix === '__missing__' ? 'No Barcode' : filterUpcPrefix }}</span>
                        <span v-if="filterBinLocation" class="badge badge-sm badge-neutral font-bold">Loc: {{ filterBinLocation }}</span>
                        <span v-if="filterChannel" class="badge badge-sm badge-neutral font-bold">Channel: {{ filterChannel }}</span>
                        <span v-if="filterLotType !== 'all'" class="badge badge-sm badge-neutral font-bold">{{ filterLotType.replace('_only', '') }}</span>
                        <span v-if="filterFlaggedLocated" class="badge badge-sm badge-neutral font-bold">Placed &amp; Located</span>
                        <span v-if="searchQuery" class="badge badge-sm badge-neutral font-mono truncate max-w-32 font-bold">"{{ searchQuery }}"</span>
                    </div>
                    <button class="btn btn-xs btn-outline bg-base-100 hover:bg-base-200 border-base-300 gap-1 font-bold shrink-0" @click="clearAllFilters">
                        <Icon icon="solar:close-circle-linear" class="w-3.5 h-3.5" /> Clear All
                    </button>
                </div>

                    <!-- SMART SELECTION / PIPELINE BAR -->
                    <div class="mt-2 rounded-xl border transition-all duration-200"
                         :class="selectedItems.length > 0 ? 'bg-primary/10 border-primary shadow-md' : 'bg-base-200 border-base-300'">

                        <!-- State A: Nothing selected — show count + select all -->
                        <div v-if="selectedItems.length === 0" class="flex items-center justify-between px-3 py-2.5 gap-3">
                            <label class="flex items-center gap-3 cursor-pointer select-none">
                                <input type="checkbox" :checked="isAllSelected" @change="toggleAll" class="checkbox checkbox-sm checkbox-primary" />
                                <span class="text-sm font-semibold">Select items to take action</span>
                                <span class="text-xs opacity-50">{{ filteredInventory.length }} in view</span>
                            </label>
                            <button class="btn btn-xs btn-ghost gap-1 opacity-60 hover:opacity-100" @click="() => exportCsv('generic')">
                                <Icon icon="solar:file-download-linear" class="w-3.5 h-3.5" /> Export All
                            </button>
                        </div>

                        <!-- State B: Items selected — inline action pipeline -->
                        <div v-else class="flex flex-col gap-2 p-3">
                            <!-- Top row: checkbox + count + clear -->
                            <div class="flex items-center gap-3">
                                <input type="checkbox" :checked="isAllSelected" @change="toggleAll" class="checkbox checkbox-sm checkbox-primary" />
                                <span class="text-sm font-bold text-primary flex-1">{{ selectedItems.length }} item{{ selectedItems.length > 1 ? 's' : '' }} selected</span>
                                <button class="btn btn-xs btn-ghost text-error" @click="selectedItems = []">✕ Clear</button>
                            </div>

                            <!-- Action row -->
                            <div class="flex flex-wrap gap-2">
                                <!-- Status -->
                                <div class="join">
                                    <select v-model="bulkStatusTarget" class="select select-xs select-bordered join-item bg-base-100 text-base-content">
                                        <option value="" disabled selected>Set Status...</option>
                                        <option value="tracked">Tracked</option>
                                        <option value="acquired">Acquired</option>
                                        <option value="received">Received</option>
                                        <option value="placed">Placed</option>
                                        <option value="sold">Sold</option>
                                    </select>
                                    <button class="btn btn-xs btn-primary join-item" @click="applyBulkStatus" :disabled="!bulkStatusTarget || processingBulk">
                                        <span v-if="processingBulk" class="loading loading-spinner loading-xs"></span>
                                        <span v-else>Apply</span>
                                    </button>
                                </div>

                                <!-- Location -->
                                <div class="join">
                                    <select v-model="bulkLocationTarget" class="select select-xs select-bordered join-item bg-base-100 text-base-content max-w-35">
                                        <option value="" disabled selected>Set Location...</option>
                                        <option v-for="loc in allAvailableLocations" :key="loc" :value="loc">{{ loc }}</option>
                                        <option value="__custom__">+ Custom Location...</option>
                                    </select>
                                    <input 
                                        v-if="bulkLocationTarget === '__custom__'"
                                        type="text" 
                                        v-model="bulkCustomLocation"
                                        placeholder="Type location..." 
                                        class="input input-xs input-bordered join-item w-28 bg-base-100 text-xs font-bold" 
                                    />
                                    <button class="btn btn-xs btn-secondary join-item" @click="applyBulkLocation" :disabled="(!bulkLocationTarget || (bulkLocationTarget === '__custom__' && !bulkCustomLocation.trim())) || processingBulkLoc">
                                        <span v-if="processingBulkLoc" class="loading loading-spinner loading-xs"></span>
                                        <span v-else>Apply</span>
                                    </button>
                                </div>

                                <!-- Channel -->
                                <div class="join">
                                    <select v-model="bulkChannelTarget" class="select select-xs select-bordered join-item bg-base-100 text-base-content max-w-35">
                                        <option value="" disabled selected>Set Channel...</option>
                                        <option v-for="ch in allAvailableChannels" :key="ch" :value="ch">{{ ch }}</option>
                                    </select>
                                    <button class="btn btn-xs btn-primary join-item" @click="applyBulkChannel" :disabled="!bulkChannelTarget || processingBulkChannel">
                                        <span v-if="processingBulkChannel" class="loading loading-spinner loading-xs"></span>
                                        <span v-else>Apply</span>
                                    </button>
                                </div>

                                <!-- Bundle / Combine (2+ only) -->
                                <button v-if="selectedItems.length >= 2" class="btn btn-xs btn-accent gap-1" @click="openBundleModal">
                                    <Icon icon="solar:box-minimalistic-bold-duotone" class="w-3.5 h-3.5" /> Bundle
                                </button>
                                <button v-if="selectedItems.length >= 2" class="btn btn-xs btn-secondary gap-1" @click="openCombineModal">
                                    <Icon icon="solar:link-minimalistic-bold" class="w-3.5 h-3.5" /> Combine
                                </button>

                                <!-- Reassign / Set UPC Prefix -->
                                <div class="join">
                                    <select v-model="bulkUpcPrefixTarget" class="select select-xs select-bordered join-item bg-base-100 text-base-content max-w-35 font-mono">
                                        <option value="" disabled selected>Set UPC Prefix...</option>
                                        <option value="HUCK-">HUCK-</option>
                                        <option value="PDXGL-">PDXGL-</option>
                                        <option v-for="p in allAvailableUpcPrefixes.filter(x => !['HUCK-', 'PDXGL-', '__missing__', '__numeric__'].includes(x.prefix))" :key="p.prefix" :value="p.prefix">{{ p.prefix }}</option>
                                        <option value="__custom__">+ Custom...</option>
                                    </select>
                                    <input 
                                        v-if="bulkUpcPrefixTarget === '__custom__'"
                                        type="text" 
                                        v-model="bulkCustomUpcPrefix"
                                        placeholder="PREFIX-" 
                                        class="input input-xs input-bordered join-item w-24 bg-base-100 text-xs font-mono font-bold uppercase" 
                                    />
                                    <button class="btn btn-xs btn-primary join-item font-bold" @click="applyBulkUpc" :disabled="(!bulkUpcPrefixTarget || (bulkUpcPrefixTarget === '__custom__' && !bulkCustomUpcPrefix.trim())) || processingBulk">
                                        <span v-if="processingBulk" class="loading loading-spinner loading-xs"></span>
                                        <span v-else>Apply</span>
                                    </button>
                                </div>

                                <!-- Export selected -->
                                <button class="btn btn-xs btn-success gap-1 ml-auto" @click="() => exportCsv('generic')">
                                    <Icon icon="solar:file-download-linear" class="w-3.5 h-3.5" /> Export {{ selectedItems.length }}
                                </button>
                            </div>

                            <!-- Admin Auto-Heal row (only when insight filter active) -->
                            <div v-if="insightFilter" class="pt-2 border-t border-primary/20">
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
                    </div>

            <div v-if="filteredInventory.length === 0 && !loading && !error" class="text-center py-12 bg-base-200 rounded-xl border-dashed border-2 border-base-300">
                <p class="text-lg opacity-60 mb-4">No items in inventory matching your filters.</p>
                <button class="btn btn-sm btn-outline" @click="clearAllFilters">Clear Filters</button>
            </div>
            
            <div v-else>
                <!-- RESPONSIVE 2-COLUMN MOBILE / MULTI-COLUMN DESKTOP GRID -->
                <div class="grid gap-2.5 sm:gap-3 md:gap-4 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    <ItemCard 
                        v-for="item in displayedInventory" 
                        :key="item.$id" 
                        :item="item"
                        :compact="true"
                        @click-card="openPreview(item)"
                        :class="{'ring-2 ring-primary': selectedItems.includes(item.$id)}">
                        
                        <template #absolute-top-left>
                            <!-- Expanded 40x40px hit area for reliable one-tap selection (Fitts's Law) -->
                            <label class="z-20 p-2.5 -m-2 flex items-center justify-center cursor-pointer touch-manipulation active:scale-90 transition-transform" @click.stop title="Select Item">
                                <input type="checkbox" :value="item.$id" v-model="selectedItems" class="checkbox checkbox-sm checkbox-primary shadow-xs cursor-pointer border-none bg-white/80 ring-1 ring-white/50" />
                            </label>
                        </template>

                        <template #actions>
                            <div class="grid grid-cols-3 gap-1 w-full mt-1.5 pt-1.5 border-t border-base-200/60 z-10" @click.stop>
                                <button @click="copyShareLink(item.$id)" class="btn btn-ghost btn-xs h-7.5 min-h-7.5 px-1 text-[11px] font-bold opacity-75 hover:opacity-100 active:scale-95 flex items-center justify-center gap-1 rounded-lg touch-manipulation" title="Copy shareable link">
                                    <Icon icon="solar:link-linear" class="w-3.5 h-3.5" /> <span class="hidden sm:inline">Share</span>
                                </button>
                                <button @click="openEdit(item)" class="btn btn-ghost btn-xs h-7.5 min-h-7.5 px-1 text-[11px] font-bold opacity-80 hover:opacity-100 hover:text-primary active:scale-95 flex items-center justify-center gap-1 rounded-lg touch-manipulation" title="Edit item">
                                    <Icon icon="solar:pen-linear" class="w-3.5 h-3.5" /> <span class="hidden sm:inline">Edit</span>
                                </button>
                                <button @click="confirmDelete(item.$id)" class="btn btn-ghost btn-xs h-7.5 min-h-7.5 px-1 text-[11px] font-bold text-error opacity-80 hover:opacity-100 hover:bg-error/10 active:scale-95 flex items-center justify-center gap-1 rounded-lg touch-manipulation" :disabled="processingId === item.$id" title="Delete item">
                                    <span v-if="processingId === item.$id" class="loading loading-spinner loading-xs"></span>
                                    <span v-else><Icon icon="solar:trash-bin-trash-linear" class="w-3.5 h-3.5" /> <span class="hidden sm:inline">Del</span></span>
                                </button>
                            </div>
                        </template>
                    </ItemCard>
                </div>

                <!-- Infinite Scroll Sentinel & Load More Trigger -->
                <div ref="loadMoreSentinel" class="py-6 flex justify-center items-center w-full" v-if="displayedInventory.length < filteredInventory.length">
                    <button class="btn btn-sm btn-ghost gap-2 font-bold opacity-70 hover:opacity-100 touch-manipulation active:scale-95" @click="loadMoreItems">
                        <span class="loading loading-spinner loading-xs text-primary"></span>
                        <span class="text-xs">Loading more items ({{ displayedInventory.length }} of {{ filteredInventory.length }})...</span>
                    </button>
                </div>
            </div> <!-- End v-else -->

            <!-- ALL ITEMS LOADED -->
            </div> <!-- End drawer-content -->

            <!-- LEFT COMMAND & FILTERS SIDEBAR -->
            <div class="drawer-side z-50 lg:z-auto">
                <label for="inventory-sidebar" aria-label="close sidebar" class="drawer-overlay"></label> 
                <div class="p-4 w-72 lg:w-64 min-h-full bg-base-100 lg:bg-transparent border-r lg:border-transparent border-base-200 text-base-content flex flex-col gap-3.5 lg:p-0">
                    
                    <!-- Mobile Drawer Header -->
                    <div class="flex lg:hidden justify-between items-center pb-2 border-b border-base-200">
                        <span class="font-bold text-base flex items-center gap-1.5">
                            <Icon icon="solar:tuning-square-2-bold-duotone" class="w-5 h-5 text-primary" /> Inventory Tools
                        </span>
                        <label for="inventory-sidebar" class="btn btn-sm btn-circle btn-ghost">✕</label>
                    </div>

                    <!-- 1. Primary Action & Tool Hub -->
                    <div class="card bg-base-200/50 border border-base-300/70 p-3 rounded-xl shadow-2xs space-y-2">
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
                                    <li v-for="p in knownOrgPrefixes.filter(x => !['HUCK-', 'PDXGL-'].includes(x))" :key="p">
                                        <button @click="handleGenerateUpcs(p)" class="flex items-center justify-between py-1.5">
                                            <span class="font-mono font-bold">{{ p }}0001</span>
                                            <span class="badge badge-xs badge-ghost">Auto</span>
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
                                <div tabindex="0" role="button" class="btn btn-xs btn-outline gap-1 w-full">
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

                        <!-- Export Dropdown -->
                        <div class="dropdown w-full">
                            <div tabindex="0" role="button" class="btn btn-xs btn-outline gap-1 w-full justify-between">
                                <span class="flex items-center gap-1"><Icon icon="solar:export-linear" class="w-3.5 h-3.5" /> Export Data</span>
                                <Icon icon="solar:alt-arrow-down-linear" class="w-3 h-3 opacity-60" />
                            </div>
                            <ul tabindex="0" class="dropdown-content z-50 menu p-2 shadow-xl bg-base-100 border border-base-200 rounded-xl w-64 mt-1">
                                <li>
                                    <a href="/inventory/sync" class="flex items-start gap-2 py-1.5">
                                        <Icon icon="solar:synchronize-bold-duotone" class="w-4 h-4 mt-0.5 shrink-0 text-secondary" />
                                        <span class="font-bold text-xs">MemoryDen Sync</span>
                                    </a>
                                </li>
                                <div class="divider my-1"></div>
                                <li>
                                    <button class="flex items-start gap-2 py-1.5" @click="exportCsv('generic')">
                                        <Icon icon="solar:file-download-linear" class="w-4 h-4 mt-0.5 shrink-0 text-success" />
                                        <span class="font-bold text-xs">Generic CSV</span>
                                    </button>
                                </li>
                                <li>
                                    <button class="flex items-start gap-2 py-1.5" @click="exportCsv('ebay')">
                                        <Icon icon="solar:tag-price-linear" class="w-4 h-4 mt-0.5 shrink-0 text-secondary" />
                                        <span class="font-bold text-xs">eBay Bulk Upload</span>
                                    </button>
                                </li>
                                <li>
                                    <button class="flex items-start gap-2 py-1.5" @click="exportCsv('poshmark')">
                                        <Icon icon="simple-icons:poshmark" class="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                                        <span class="font-bold text-xs">Poshmark CSV</span>
                                    </button>
                                </li>
                                <li>
                                    <button class="flex items-start gap-2 py-1.5" @click="exportCsv('ricochet')">
                                        <Icon icon="solar:shop-bold-duotone" class="w-4 h-4 mt-0.5 shrink-0 text-info" />
                                        <span class="font-bold text-xs">Ricochet POS (MemoryDen)</span>
                                    </button>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <!-- 2. Status Pipeline Navigation -->
                    <div class="card bg-base-200/50 border border-base-300/70 p-3 rounded-xl shadow-2xs">
                        <div class="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-1.5 px-1">Status Pipeline</div>
                        <ul class="menu menu-xs p-0 gap-0.5 w-full">
                            <li><button :class="{'active font-bold': filterStatus === 'all'}" @click="filterStatus = 'all'"><span>All Items</span><span class="badge badge-xs">{{ inventoryItems.length }}</span></button></li>
                            <li><button :class="{'active font-bold text-secondary': filterStatus === 'acquired'}" @click="filterStatus = 'acquired'"><span>Acquired</span><span class="badge badge-xs">{{ countByStatus('acquired') }}</span></button></li>
                            <li><button :class="{'active font-bold text-info': filterStatus === 'received'}" @click="filterStatus = 'received'"><span>Received</span><span class="badge badge-xs">{{ countByStatus('received') }}</span></button></li>
                            <li><button :class="{'active font-bold text-success': filterStatus === 'placed'}" @click="filterStatus = 'placed'"><span>Placed</span><span class="badge badge-xs">{{ countByStatus('placed') }}</span></button></li>
                            <li><button :class="{'active font-bold text-primary': filterStatus === 'tracked'}" @click="filterStatus = 'tracked'"><span>Tracked</span><span class="badge badge-xs">{{ countByStatus('tracked') }}</span></button></li>
                            <li><button :class="{'active font-bold opacity-75': filterStatus === 'sold'}" @click="filterStatus = 'sold'"><span>Sold</span><span class="badge badge-xs">{{ countByStatus('sold') }}</span></button></li>
                        </ul>
                    </div>

                    <!-- 3. AI Health Insights -->
                    <div class="card bg-base-200/50 border border-base-300/70 p-3 rounded-xl shadow-2xs space-y-1.5">
                        <div class="text-[10px] font-bold uppercase tracking-wider opacity-60 px-1 flex items-center justify-between">
                            <span>AI Health Insights</span>
                            <button v-if="insightFilter" class="text-[9px] text-error font-bold" @click="insightFilter = ''">Clear</button>
                        </div>
                        <button class="btn btn-xs w-full justify-between" :class="insightFilter === 'ready_to_list' ? 'btn-primary font-bold shadow-xs' : 'btn-outline border-base-300'" @click="insightFilter = insightFilter === 'ready_to_list' ? '' : 'ready_to_list'">
                            <span class="flex items-center gap-1"><Icon icon="solar:checklist-linear" class="w-3.5 h-3.5 text-primary" /> Ready to List</span>
                            <span class="badge badge-xs">{{ readyToListCount }}</span>
                        </button>
                        <button class="btn btn-xs w-full justify-between" :class="insightFilter === 'missing_photos' ? 'btn-error font-bold shadow-xs' : 'btn-outline border-base-300'" @click="insightFilter = insightFilter === 'missing_photos' ? '' : 'missing_photos'">
                            <span class="flex items-center gap-1"><Icon icon="solar:camera-linear" class="w-3.5 h-3.5 text-error" /> Missing Photos</span>
                            <span class="badge badge-xs">{{ missingPhotosCount }}</span>
                        </button>
                        <button class="btn btn-xs w-full justify-between" :class="insightFilter === 'missing_est_value' ? 'btn-warning font-bold shadow-xs' : 'btn-outline border-base-300'" @click="insightFilter = insightFilter === 'missing_est_value' ? '' : 'missing_est_value'">
                            <span class="flex items-center gap-1"><Icon icon="solar:dollar-linear" class="w-3.5 h-3.5 text-warning" /> Missing Pricing</span>
                            <span class="badge badge-xs">{{ missingPricingCount }}</span>
                        </button>
                    </div>

                    <!-- 4. Barcodes & Prefixes -->
                    <div class="card bg-base-200/50 border border-base-300/70 p-3 rounded-xl shadow-2xs space-y-1.5">
                        <div class="text-[10px] font-bold uppercase tracking-wider opacity-60 px-1 flex items-center justify-between">
                            <span>Barcodes &amp; Prefixes</span>
                            <button v-if="filterUpcPrefix" class="text-[9px] text-error font-bold" @click="filterUpcPrefix = ''">Clear</button>
                        </div>
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
                                class="badge badge-xs cursor-pointer transition-colors px-1.5 py-2" 
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

                    <!-- 5. Advanced Filters (Location, Channel, Lot, Keywords) -->
                    <div class="card bg-base-200/50 border border-base-300/70 p-3 rounded-xl shadow-2xs space-y-2.5">
                        <div class="text-[10px] font-bold uppercase tracking-wider opacity-60 px-1">Location &amp; Channels</div>

                        <div class="form-control w-full">
                            <label class="label pt-0 pb-1"><span class="label-text text-[10px] uppercase font-bold opacity-60">Location / Booth</span></label>
                            <select v-model="filterBinLocation" class="select select-bordered select-xs w-full bg-base-100">
                                <option value="">All Locations</option>
                                <option v-for="loc in allAvailableLocations" :key="loc" :value="loc">{{ loc }}</option>
                            </select>
                        </div>

                        <div class="form-control w-full">
                            <label class="label pt-0 pb-1"><span class="label-text text-[10px] uppercase font-bold opacity-60">Sales Channel</span></label>
                            <select v-model="filterChannel" class="select select-bordered select-xs w-full bg-base-100">
                                <option value="">All Channels</option>
                                <option v-for="ch in allAvailableChannels" :key="ch" :value="ch">{{ ch }}</option>
                            </select>
                        </div>

                        <div class="form-control w-full">
                            <label class="label pt-0 pb-1"><span class="label-text text-[10px] uppercase font-bold opacity-60">Lot Type</span></label>
                            <select v-model="filterLotType" class="select select-bordered select-xs w-full bg-base-100">
                                <option value="all">All Items</option>
                                <option value="lots_only">Parent Lots Only</option>
                                <option value="extracted_only">Extracted Children Only</option>
                                <option value="standalone_only">Standalone Items</option>
                            </select>
                        </div>

                        <div class="form-control w-full">
                            <label class="label pt-0 pb-1"><span class="label-text text-[10px] uppercase font-bold opacity-60">Keywords</span></label>
                            <TagInput 
                                v-model="filterKeywords" 
                                type="keyword" 
                                placeholder="Any..." 
                                badgeClass="badge-secondary" 
                            />
                        </div>

                        <div class="form-control w-full border-t border-base-300/50 pt-2">
                            <label class="label cursor-pointer justify-start gap-2 pt-0 pb-0">
                                <input type="checkbox" v-model="filterFlaggedLocated" class="checkbox checkbox-primary checkbox-xs" />
                                <span class="label-text font-bold text-xs select-none">Only Placed &amp; Located</span>
                            </label>
                        </div>
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
        <ItemDrawer v-if="isEditDrawerOpen" :item="activeItem" @close="closeEditDrawer" @save="saveEdit" @deconstruct="openDeconstructModal" />

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
                        <label class="label"><span class="label-text font-bold opacity-70">Lot Title</span></label>
                        <input type="text" v-model="combineTitle" class="input input-bordered w-full font-bold text-sm" placeholder="Lot Name" />
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
        </dialog>

        <!-- Floating Total Count / Scroll to Top -->
        <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 transition-transform hover:-translate-y-1 cursor-pointer shadow-xl rounded-full" @click="scrollToTop">
            <span class="badge badge-lg badge-primary border-none shadow-md px-6 py-4 font-bold text-sm flex gap-2 items-center">
                {{ filteredInventory.length }} / {{ baseInventoryCount }} Items <Icon icon="solar:round-alt-arrow-up-linear" class="w-4 h-4" />
            </span>
        </div>
    </div>
    
    <BundleModal 
        :isOpen="isBundleModalOpen" 
        :items="bundleItemsList" 
        @close="isBundleModalOpen = false" 
        @success="onBundleSuccess" 
    />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useInventory } from '../../composables/useInventory';
import { updateInventoryItem, deleteInventoryItem, saveItemToInventory } from '../../lib/inventory';
import BulkImport from './BulkImport.vue';
import BoothReconciliation from './BoothReconciliation.vue';
import { useAuth } from '../../composables/useAuth';
import { account, databases, Query, storage, ID } from '../../lib/appwrite';
import { Icon } from '@iconify/vue';
import ItemDrawer from '../common/ItemDrawer.vue';
import ItemCard from '../common/ItemCard.vue';
import ItemPreviewModal from './ItemPreviewModal.vue';
import BundleModal from './BundleModal.vue';
import TagInput from '../common/TagInput.vue';
import { addToast } from '../../stores/toast';
import { confirmDialog } from '../../stores/confirm';
import { purchasesAPI } from '../../lib/purchases';
import { generateGenericCsv, generateEbayCsv, generatePoshmarkCsv, generateRicochetCsv, downloadCsv } from '../../lib/exportUtils';
import { warehousesApi } from '../../lib/warehouses';

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
import { BUCKET_ID } from '../../lib/inventory';
const BUCKET = BUCKET_ID;

// Use Composable
import { useLoader } from '../../composables/useLoader';
const { currentTeam, user, loading: authLoading } = useAuth();

const { inventoryItems, totalItems, loading, error, fetchInventory, hasMore, loadNextPage, generateUpcs, getNextUpc } = useInventory();
const loadMore = loadNextPage; // Alias for template
const currentTeamId = computed(() => currentTeam.value?.$id); 

// State for Filters
const searchQuery = ref('');
const filterStatus = ref('all');
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

    for (const item of itemsToProcess) {
        bulkProgress.value++;
        const url = item.sourcingLocation || item.orderId;
        if (!url || !url.startsWith('http')) {
            skippedCount++;
            continue;
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
                            continue;
                        }
                    }
                }
            }
            skippedCount++;
        } catch (e) {
            console.error("Failed to fetch/upload image for", item.$id, e);
            skippedCount++;
        }
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
    } else if (params.has('orderId')) {
        searchQuery.value = params.get('orderId') || '';
    } else if (params.has('po')) {
        searchQuery.value = params.get('po') || '';
    }
    if (params.has('purchaseId')) {
        filterPurchaseId.value = params.get('purchaseId') || '';
    }
    if (params.has('upcPrefix')) {
        filterUpcPrefix.value = params.get('upcPrefix') || '';
    }
    if (params.has('status')) {
        filterStatus.value = params.get('status') || 'all';
    }
});

const scrollToTop = () => {
    // Check if we are inside a drawer-content or window
    const drawer = document.querySelector('.drawer-content');
    if (drawer) {
        drawer.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
};
const filterKeywords = ref([]);
const filterBinLocation = ref('');
const filterChannel = ref('');
const filterUpcPrefix = ref('');
const filterPurchaseId = ref('');
const filterLotType = ref('all');
const filterFlaggedLocated = ref(false);
const orgPlacedLocations = ref([]);
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
    const set = new Set();
    (orgPlacedLocations.value || []).forEach(l => l && set.add(String(l).trim()));
    (warehouseLocations.value || []).forEach(l => l && set.add(String(l).trim()));
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
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
    if (searchQuery.value) {
        const q = searchQuery.value.trim().toLowerCase();
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
        
        // Filter by Status (Only if not using insight filter that forces status)
        if (!insightFilter.value && filterStatus.value !== 'all' && item.status !== filterStatus.value) {
            return false;
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
            const rawTarget = filterBinLocation.value.trim().toLowerCase();
            const cleanTarget = rawTarget.replace(/[^a-z0-9]/g, '');

            const matchesLoc = (val) => {
                if (!val) return false;
                if (Array.isArray(val)) {
                    return val.some(v => matchesLoc(v));
                }
                const str = String(val).trim().toLowerCase();
                const cleanStr = str.replace(/[^a-z0-9]/g, '');
                return str === rawTarget || cleanStr === cleanTarget || (cleanTarget.length > 2 && (cleanStr.includes(cleanTarget) || cleanTarget.includes(cleanStr)));
            };

            const matchStorage = matchesLoc(item.storageLocation);
            const matchSelling = matchesLoc(item.sellingLocations);
            const matchPurchase = matchesLoc(item.purchaseLocation);

            if (!matchStorage && !matchSelling && !matchPurchase) {
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

            if (!titleMatch && !idMatch && !identityMatch && !binMatch && !keywordMatch && !orderMatch && !cartMatch && !purchaseMatch && !sourcingMatch && !locSkuMatch && !notesMatch && !upcMatch && !numericMatch) {
                return false;
            }
        }
        
        return true;
    });
});

// Progressive / Chunked Rendering for Lightning-Fast Instant Filter Speeds (<10ms)
const displayLimit = ref(40);
const displayedInventory = computed(() => {
    return filteredInventory.value.slice(0, displayLimit.value);
});

// Reset display limit when any filter or query changes
watch([filterStatus, filterUpcPrefix, filterBinLocation, filterChannel, filterLotType, filterFlaggedLocated, filterKeywords, insightFilter, searchQuery, filterPurchaseId], () => {
    displayLimit.value = 40;
});

const loadMoreSentinel = ref(null);
let infiniteScrollObserver = null;

const loadMoreItems = () => {
    if (displayLimit.value < filteredInventory.value.length) {
        displayLimit.value += 40;
    }
};

onMounted(() => {
    if (typeof IntersectionObserver !== 'undefined') {
        infiniteScrollObserver = new IntersectionObserver((entries) => {
            if (entries[0]?.isIntersecting) {
                loadMoreItems();
            }
        }, { rootMargin: '600px' });
        
        watch(loadMoreSentinel, (el) => {
            if (el && infiniteScrollObserver) {
                infiniteScrollObserver.observe(el);
            }
        }, { immediate: true });
    }
});

onUnmounted(() => {
    if (infiniteScrollObserver) {
        infiniteScrollObserver.disconnect();
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
        progress: 0,
        cancelable: false
    });
    
    try {
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
            
            if (total > 5) await new Promise(r => setTimeout(r, 80));
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

// Trigger loader immediately on setup (before mount) to prevent layout flash
const { showLoader, updateLoader, hideLoader } = useLoader();
showLoader("Loading Inventory...");

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

    // ONLY fetch if auth is already loaded.
    if (!authLoading.value) {
        await fetchInventory(''); 
    }
});

// Watch for Auth to finish loading so we know if the user is in Alpha mode
watch(authLoading, async (newVal) => {
    if (!newVal) {
        await fetchInventory(''); 
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
    return `${ENDPOINT}/storage/buckets/${BUCKET}/files/${id}/view?project=${PROJECT}`;
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
// EDIT DRAWER LOGIC
//---------------------------------------------------------

const openAdd = () => {
    activeItem.value = null; // Create Mode
    isEditDrawerOpen.value = true;
};

const openEdit = (item) => {
    activeItem.value = item;
    isEditDrawerOpen.value = true;
};

const closeEditDrawer = () => {
    isEditDrawerOpen.value = false;
};

const saveEdit = async (payload) => {
    processing.value = true;
    try {
        if (activeItem.value) {
            // UPDATE EXISTING
            const prefix = currentTeam.value?.prefs?.upcPrefix || user.value?.prefs?.upcPrefix || 'HUCK-';
            if (!payload.upc && !activeItem.value.upc) {
                payload.upc = getNextUpc(prefix);
            }

            const updatedDoc = await updateInventoryItem(activeItem.value.$id, payload);
            // Optimistic update to immediately reflect in UI before Appwrite query cache clears
            const idx = inventoryItems.value.findIndex(i => i.$id === activeItem.value.$id);
            if (idx !== -1) {
                inventoryItems.value[idx] = updatedDoc;
            }
        } else {
            // CREATE NEW
            const prefix = currentTeam.value?.prefs?.upcPrefix || user.value?.prefs?.upcPrefix || 'HUCK-';
            if (!payload.upc) {
                payload.upc = getNextUpc(prefix);
            }
             const newDoc = await saveItemToInventory(
                { title: payload.title || 'Untitled Item', identity: payload.title, condition_notes: '' }, 
                payload.imageFile,
                payload,
                currentTeamId.value // Pass team ID
            );
            inventoryItems.value.unshift(newDoc);
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
const combineCost = ref(0);
const combineTotalUnits = ref(1);
const combinePrimaryId = ref(null);
const savingCombine = ref(false);

const openCombineModal = () => {
    const items = selectedItemsObjects.value;
    if (items.length < 2) return;
    
    // Choose the first item as default primary
    combinePrimaryId.value = items[0].$id;
    combineTitle.value = items[0].title;
    
    // Calculate total cost and total quantity
    const totalCost = items.reduce((sum, i) => sum + (parseFloat(i.cost) || 0), 0);
    const totalQty = items.reduce((sum, i) => sum + (parseInt(i.quantity) || 1), 0);
    
    combineCost.value = parseFloat(totalCost.toFixed(2));
    combineTotalUnits.value = totalQty;
    
    if (combineModal.value) {
        combineModal.value.showModal();
    }
};

const onCombinePrimaryChange = () => {
    const primaryItem = selectedItemsObjects.value.find(i => i.$id === combinePrimaryId.value);
    if (primaryItem) {
        combineTitle.value = primaryItem.title;
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
        
        if (otherNotesList.length > 0) {
            combinedNotes += `\n\n--- MERGED ITEMS NOTES ---\n` + otherNotesList.join('\n\n');
        }

        // Calculate combined resale price
        const totalResale = items.reduce((sum, i) => sum + (parseFloat(i.resalePrice || i.listPrice || 0) || 0), 0);

        // 3. Create the new combined item document representing the combined lot
        const extraData = {
            cost: combineCost.value,
            resalePrice: totalResale ? totalResale.toFixed(2) : undefined,
            status: primaryItem.status || 'acquired',
            sourcingLocation: primaryItem.sourcingLocation || 'Combined Lot',
            storageLocation: primaryItem.storageLocation,
            imageId: mainImageId,
            galleryImageIds: combinedGallery,
            keywords: Array.from(new Set(items.flatMap(i => i.keywords || []))),
            quantity: combineTotalUnits.value,
            parentLotId: null,
            rawAnalysis: primaryItem.rawAnalysis || null
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

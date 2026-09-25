<template>
    <div v-if="isOpen" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end transition-opacity" @click.self="closeTray">
        <div 
            class="bg-base-100 border-t border-base-300 rounded-t-box mx-auto w-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-250 select-none transition-all"
            :class="currentSubView === 'split' ? 'max-w-4xl h-[90vh] sm:h-[780px]' : 'max-w-2xl h-[78vh] sm:h-[650px]'"
        >
            <!-- Top Drag Handle Affordance -->
            <div class="w-12 h-1.5 bg-base-content/20 rounded-full mx-auto mt-2.5 mb-1 shrink-0"></div>

            <!-- Drawer Header with Dynamic Navigation -->
            <div class="px-4 py-2.5 border-b border-base-300 flex items-center justify-between gap-3 shrink-0">
                <div class="flex items-center gap-2 min-w-0">
                    <!-- Back Button when inside a Merchandising Sub-View -->
                    <button 
                        v-if="currentSubView !== 'main' && activeTab === 'actions'"
                        type="button" 
                        class="btn btn-ghost btn-xs gap-1 font-bold text-primary shrink-0"
                        @click="currentSubView = 'main'"
                        title="Back to Selection"
                    >
                        <Icon icon="solar:arrow-left-bold" class="w-4 h-4" />
                        <span>Back</span>
                    </button>

                    <div class="w-8 h-8 rounded-box bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Icon :icon="headerIcon" class="w-4 h-4" />
                    </div>
                    <div class="min-w-0">
                        <h3 class="font-black text-sm sm:text-base text-base-content truncate">
                            {{ headerTitle }}
                        </h3>
                        <p class="text-[10px] sm:text-xs text-base-content/60 truncate font-mono">
                            {{ headerSubtitle }}
                        </p>
                    </div>
                </div>

                <!-- Header Close -->
                <div class="flex items-center gap-1.5 shrink-0">
                    <button 
                        type="button" 
                        @click="closeTray" 
                        class="btn btn-ghost btn-sm btn-circle shrink-0" 
                        title="Close Tray"
                    >
                        <Icon icon="solar:close-circle-bold" class="w-5 h-5 opacity-60 hover:opacity-100" />
                    </button>
                </div>
            </div>

            <!-- ============================================================= -->
            <!-- 1. MAIN ACTIONS & SELECTION TRAY VIEW                          -->
            <!-- ============================================================= -->
            <div v-show="activeTab === 'actions'" class="flex-1 flex flex-col min-h-0 overflow-hidden">
                
                <!-- ------------------------------------------------------------- -->
                <!-- SUB-VIEW 1: RESTOCK MULTI-QUANTITY CRATE (When 1 Item Selected)-->
                <!-- ------------------------------------------------------------- -->
                <div v-if="currentSubView === 'restock' && selectedItems.length > 0" class="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div class="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                        <!-- Selected Target Item Card (Tap to edit in drawer) -->
                        <div 
                            class="p-3 rounded-box border border-base-300 bg-base-200/50 hover:bg-base-200/80 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                            @click="openItemDrawer(selectedItems[0])"
                            title="Edit item in drawer"
                        >
                            <div class="flex items-center gap-3 min-w-0 flex-1">
                                <ItemThumbnail :item="selectedItems[0]" size="md" class="w-12 h-12 pointer-events-none rounded-box shrink-0" />
                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center gap-1.5 flex-wrap">
                                        <span v-if="selectedItems[0].upc || selectedItems[0].locationSku" class="badge badge-xs font-mono font-bold bg-primary/10 text-primary border-0">
                                            {{ selectedItems[0].upc || selectedItems[0].locationSku }}
                                        </span>
                                        <span class="badge badge-xs badge-info font-bold">
                                            {{ currentStock }} Units In Stock
                                        </span>
                                    </div>
                                    <h4 class="font-bold text-xs text-base-content truncate mt-0.5 group-hover:text-primary transition-colors">
                                        {{ selectedItems[0].title || 'Untitled Item' }}
                                    </h4>
                                    <div class="text-[10px] font-mono opacity-70 mt-0.5">
                                        Current Basis: <strong>${{ currentCost.toFixed(2) }}</strong> (${{ currentUnitCost.toFixed(2) }}/ea)
                                    </div>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                class="btn btn-ghost btn-xs btn-circle opacity-60 group-hover:opacity-100 group-hover:text-primary shrink-0" 
                                title="Edit item in drawer"
                            >
                                <Icon icon="solar:pen-linear" class="w-4 h-4" />
                            </button>
                        </div>

                        <!-- Restock Mode Segmented Selector -->
                        <div class="flex items-center gap-1 p-1 bg-base-200 rounded-box border border-base-300">
                            <button 
                                type="button" 
                                class="btn btn-xs flex-1 font-bold gap-1 transition-all"
                                :class="restockMode === 'catalog_items' ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost opacity-70'"
                                @click="restockMode = 'catalog_items'"
                            >
                                <Icon icon="solar:magic-stick-3-bold" class="w-3.5 h-3.5" />
                                <span>Add from Catalog</span>
                            </button>
                            <button 
                                type="button" 
                                class="btn btn-xs flex-1 font-bold gap-1 transition-all"
                                :class="restockMode === 'vice_versa' ? 'btn-secondary text-secondary-content shadow-xs' : 'btn-ghost opacity-70'"
                                @click="restockMode = 'vice_versa'"
                            >
                                <Icon icon="solar:transfer-horizontal-bold" class="w-3.5 h-3.5" />
                                <span>Vice Versa (Merge into Crate)</span>
                            </button>
                            <button 
                                type="button" 
                                class="btn btn-xs flex-1 font-bold gap-1 transition-all"
                                :class="restockMode === 'manual' ? 'btn-neutral text-neutral-content shadow-xs' : 'btn-ghost opacity-70'"
                                @click="restockMode = 'manual'"
                            >
                                <Icon icon="solar:calculator-bold" class="w-3.5 h-3.5" />
                                <span>Manual Count</span>
                            </button>
                        </div>

                        <!-- MODE 1: ADD MATCHING ITEMS FROM CATALOG -->
                        <div v-if="restockMode === 'catalog_items'" class="space-y-3">
                            <!-- Search filter -->
                            <div class="relative">
                                <Icon icon="solar:magnifer-linear" class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50" />
                                <input 
                                    v-model="restockCatalogSearch" 
                                    type="text" 
                                    class="input input-xs input-bordered w-full pl-8 text-xs bg-base-100" 
                                    placeholder="Search catalog items to add to this restock..." 
                                />
                            </div>

                            <!-- Staged Items to Absorb (if any) -->
                            <div v-if="stagedRestockItems.length > 0" class="p-2.5 bg-primary/10 rounded-box border border-primary/30 space-y-1.5">
                                <div class="flex items-center justify-between text-[10px] font-bold text-primary uppercase">
                                    <span>Staged for Restock ({{ stagedRestockItems.length }} items, +{{ restockUnits }} units, +${{ restockCost.toFixed(2) }})</span>
                                    <button type="button" @click="stagedRestockItems = []; recalcRestockFromStaged()" class="btn btn-2xs btn-ghost text-error">Clear All</button>
                                </div>
                                <div class="space-y-1 max-h-32 overflow-y-auto pr-1">
                                    <div 
                                        v-for="staged in stagedRestockItems" 
                                        :key="staged.$id || staged.id"
                                        class="flex items-center justify-between gap-2 p-1.5 bg-base-100 rounded-box border border-base-200 text-xs"
                                    >
                                        <div class="truncate flex-1 font-medium text-[11px]">
                                            <span>{{ staged.title }}</span>
                                            <span class="opacity-50 text-[10px] ml-1 font-mono">Qty: {{ staged.quantity || 1 }} • ${{ Number(staged.cost || 0).toFixed(2) }}</span>
                                        </div>
                                        <button 
                                            type="button" 
                                            class="btn btn-2xs btn-ghost text-error hover:bg-error/10 px-1.5"
                                            @click="removeStagedRestockItem(staged.$id || staged.id)"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Matching Candidate Items from Catalog -->
                            <div class="space-y-1.5">
                                <span class="text-[10px] font-bold uppercase tracking-wider text-base-content/70 block">
                                    Matching Catalog Candidates ({{ restockCatalogCandidates.length }}):
                                </span>
                                <div v-if="restockCatalogCandidates.length > 0" class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                    <div 
                                        v-for="cand in restockCatalogCandidates" 
                                        :key="cand.item.$id || cand.item.id"
                                        class="p-2 rounded-box border border-base-300 bg-base-100 hover:bg-base-200/60 transition-all flex items-center justify-between gap-2 text-xs"
                                    >
                                        <ItemThumbnail :item="cand.item" size="sm" class="w-9 h-9 pointer-events-none rounded-box shrink-0" />
                                        <div class="min-w-0 flex-1">
                                            <h5 class="font-bold truncate text-[11px] text-base-content">{{ cand.item.title }}</h5>
                                            <div class="flex items-center gap-1.5 text-[10px] opacity-70 font-mono mt-0.5">
                                                <span v-if="cand.item.locationSku || cand.item.upc">{{ cand.item.locationSku || cand.item.upc }} •</span>
                                                <span>Qty: <strong>{{ cand.item.quantity || 1 }}</strong></span>
                                                <span>• Cost: <strong>${{ Number(cand.item.cost || 0).toFixed(2) }}</strong></span>
                                                <span v-if="cand.item.storageLocation">({{ cand.item.storageLocation }})</span>
                                            </div>
                                        </div>
                                        <button 
                                            type="button" 
                                            class="btn btn-2xs btn-primary text-primary-content font-bold px-2 shrink-0"
                                            @click="addRestockItemCandidate(cand.item)"
                                            title="Add this item into the restock crate"
                                        >
                                            + Add (+{{ cand.item.quantity || 1 }})
                                        </button>
                                    </div>
                                </div>
                                <div v-else class="text-center py-4 border border-dashed border-base-300 rounded-box text-base-content/50 text-xs">
                                    No other matching items found. Search above or use Manual Count.
                                </div>
                            </div>
                        </div>

                        <!-- MODE 2: VICE VERSA (MERGE THIS ITEM INTO AN EXISTING ACTIVE CRATE) -->
                        <div v-else-if="restockMode === 'vice_versa'" class="space-y-2.5">
                            <div class="p-2 bg-info/10 rounded-box border border-info/20 text-xs text-info leading-relaxed">
                                <strong>Vice Versa Merging:</strong> Merge this item directly into an existing active booth crate or batch in your catalog. Preserves the active crate's price tag and recalculates blended cost.
                            </div>

                            <span class="text-[10px] font-bold uppercase tracking-wider text-base-content/70 block">
                                Active Catalog Crates & Batches ({{ activeBatchesInCatalog.length }}):
                            </span>

                            <div v-if="activeBatchesInCatalog.length > 0" class="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                <div 
                                    v-for="batch in activeBatchesInCatalog" 
                                    :key="batch.$id || batch.id"
                                    class="p-2.5 rounded-box border border-base-300 bg-base-100 hover:border-secondary transition-all flex items-center justify-between gap-2.5 text-xs"
                                >
                                    <ItemThumbnail :item="batch" size="sm" class="w-10 h-10 pointer-events-none rounded-box shrink-0" />
                                    <div class="min-w-0 flex-1">
                                        <div class="flex items-center gap-1.5">
                                            <span class="badge badge-2xs badge-secondary font-mono font-bold">Qty: {{ batch.quantity || 1 }}</span>
                                            <h5 class="font-bold truncate text-xs text-base-content">{{ batch.title }}</h5>
                                        </div>
                                        <div class="text-[10px] opacity-70 font-mono mt-0.5 flex items-center gap-2">
                                            <span>Current Cost: ${{ Number(batch.cost || 0).toFixed(2) }}</span>
                                            <span v-if="batch.storageLocation">Loc: {{ batch.storageLocation }}</span>
                                            <span v-if="batch.upc || batch.locationSku" class="text-primary font-bold">Tag: {{ batch.upc || batch.locationSku }}</span>
                                        </div>
                                    </div>
                                    <button 
                                        type="button" 
                                        class="btn btn-xs btn-secondary font-bold px-3 shrink-0 gap-1"
                                        @click="handleConfirmMergeIntoBatch(batch)"
                                    >
                                        <Icon icon="solar:import-bold" class="w-3.5 h-3.5" />
                                        <span>Merge In</span>
                                    </button>
                                </div>
                            </div>
                            <div v-else class="text-center py-4 border border-dashed border-base-300 rounded-box text-base-content/50 text-xs">
                                No other active multi-piece batches found in your catalog.
                            </div>
                        </div>

                        <!-- MODE 3: MANUAL NUMERIC RESTOCK -->
                        <div v-else-if="restockMode === 'manual'" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <!-- Units to Add -->
                            <div class="space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <label class="text-[10px] font-bold uppercase tracking-wider text-base-content/70 flex items-center gap-1">
                                        <Icon icon="solar:layers-bold" class="w-3 h-3 text-primary" />
                                        <span>Units to Add</span>
                                    </label>
                                    <span class="text-[10px] font-mono opacity-50">Min: 1</span>
                                </div>
                                <input 
                                    type="number" 
                                    min="1" 
                                    step="1" 
                                    v-model.number="restockUnits" 
                                    class="input input-sm input-bordered w-full font-mono font-black text-center text-sm bg-base-200/50 focus:bg-base-100" 
                                    placeholder="10" 
                                />
                                <!-- Quick Increments -->
                                <div class="flex items-center gap-1.5 pt-0.5">
                                    <span class="text-[9px] font-bold opacity-50 uppercase">Quick:</span>
                                    <button 
                                        v-for="amt in [5, 10, 20, 50]" 
                                        :key="amt" 
                                        type="button" 
                                        @click="restockUnits = (Number(restockUnits) || 0) + amt"
                                        class="btn btn-2xs btn-ghost bg-base-200 hover:bg-primary/20 hover:text-primary font-mono font-bold px-1.5 py-0 h-5 min-h-5"
                                    >
                                        +{{ amt }}
                                    </button>
                                    <button 
                                        type="button" 
                                        @click="restockUnits = 1" 
                                        class="btn btn-2xs btn-ghost text-[9px] opacity-60 hover:opacity-100 px-1 py-0 h-5 min-h-5 ml-auto font-mono"
                                    >
                                        Reset
                                    </button>
                                </div>
                            </div>

                            <!-- Total Added Cost -->
                            <div class="space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <label class="text-[10px] font-bold uppercase tracking-wider text-base-content/70 flex items-center gap-1">
                                        <Icon icon="solar:tag-price-bold" class="w-3 h-3 text-secondary" />
                                        <span>Total Added Cost ($)</span>
                                    </label>
                                    <span class="text-[10px] font-mono opacity-50">Landed / Lot</span>
                                </div>
                                <div class="relative">
                                    <span class="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50 font-bold text-xs">$</span>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        step="0.01" 
                                        v-model.number="restockCost" 
                                        class="input input-sm input-bordered w-full pl-6 font-mono font-bold text-sm bg-base-200/50 focus:bg-base-100" 
                                        placeholder="0.00" 
                                    />
                                </div>
                                <p class="text-[9px] opacity-60 italic pt-0.5">
                                    Leave $0.00 if already accounted in parent purchase order.
                                </p>
                            </div>
                        </div>

                        <!-- Live Telemetry Calculation Banner -->
                        <div class="bg-base-200/80 p-3 rounded-box border border-base-300 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                            <div class="flex items-center gap-1.5">
                                <span class="opacity-60 text-[11px]">Stock:</span>
                                <span class="font-bold">{{ currentStock }}</span>
                                <Icon icon="solar:arrow-right-linear" class="w-3 h-3 opacity-40" />
                                <span class="badge badge-sm badge-primary text-primary-content font-extrabold whitespace-nowrap">
                                    {{ newStock }} Units
                                </span>
                            </div>
                            <div class="flex items-center gap-1.5">
                                <span class="opacity-60 text-[11px]">New Total Cost:</span>
                                <span class="font-bold text-base-content">${{ newTotalCost.toFixed(2) }}</span>
                            </div>
                            <div class="flex items-center gap-1.5">
                                <span class="opacity-60 text-[11px]">Avg Unit Cost:</span>
                                <span class="badge badge-sm badge-secondary text-secondary-content font-extrabold whitespace-nowrap">
                                    ${{ newUnitCost.toFixed(2) }}/ea
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Restock Action Bar Dock (Canonical Treatment) -->
                    <div class="p-3 sm:px-6 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-base-300 flex items-center justify-between bg-base-200/90 backdrop-blur-md gap-3 shrink-0">
                        <button 
                            type="button" 
                            class="btn btn-ghost btn-sm font-semibold" 
                            @click="currentSubView = 'main'"
                        >
                            Cancel
                        </button>
                        <div v-if="restockMode === 'vice_versa'" class="text-xs opacity-60 font-medium">
                            Select an active batch card above to merge this item in.
                        </div>
                        <button 
                            v-else
                            type="button" 
                            class="btn btn-primary text-primary-content btn-sm font-black px-6 shadow-md border border-primary-content/25 active:scale-95 transition-all gap-1.5"
                            @click="handleConfirmRestock"
                            :disabled="!restockUnits || restockUnits < 1 || isProcessing"
                        >
                            <Icon icon="solar:check-circle-bold" class="w-4 h-4" />
                            <span>{{ stagedRestockItems.length > 0 ? `Confirm Restock (+${restockUnits} from Catalog)` : `Confirm Restock (+${restockUnits || 0} Units)` }}</span>
                        </button>
                    </div>
                </div>

                <!-- ------------------------------------------------------------- -->
                <!-- SUB-VIEW 2: BUNDLE SUB-PANEL (In-Tray Companion Bundle)       -->
                <!-- ------------------------------------------------------------- -->
                <div v-else-if="currentSubView === 'bundle'" class="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div class="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
                        <!-- Selected Items Preview Pill List -->
                        <div class="p-3 rounded-box border border-base-300 bg-base-200/50 space-y-2">
                            <div class="flex items-center justify-between font-bold text-[10px] uppercase opacity-60">
                                <span>{{ selectedCount }} Items in Bundle</span>
                                <span class="font-mono">Combined Cost: ${{ bundleCombinedCost.toFixed(2) }}</span>
                            </div>
                            
                            <div v-if="selectedItems && selectedItems.length > 0" class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                <div 
                                    v-for="item in selectedItems" 
                                    :key="item.$id"
                                    class="p-2 rounded-box border border-base-300 bg-base-100 hover:bg-base-200/60 transition-all flex items-center justify-between gap-2.5 group text-xs"
                                >
                                    <!-- Thumbnail (tap to edit) -->
                                    <div class="cursor-pointer shrink-0" @click="openItemDrawer(item)" title="Edit item in drawer">
                                        <ItemThumbnail :item="item" size="sm" class="w-10 h-10 pointer-events-none rounded-box" />
                                    </div>

                                    <!-- Title & Badges (tap to edit) -->
                                    <div class="min-w-0 flex-1 cursor-pointer select-none" @click="openItemDrawer(item)" title="Edit item in drawer">
                                        <div class="flex items-center gap-1.5 flex-wrap">
                                            <span v-if="item.upc || item.locationSku" class="badge badge-2xs font-mono font-bold bg-primary/10 text-primary border-0">
                                                {{ item.upc || item.locationSku }}
                                            </span>
                                            <span v-if="item.status" class="badge badge-2xs font-mono font-bold uppercase" :class="item.status === 'placed' ? 'badge-success' : 'badge-ghost'">
                                                {{ item.status }}
                                            </span>
                                            <h4 class="font-bold text-xs text-base-content truncate hover:text-primary transition-colors">
                                                {{ item.title || 'Untitled Item' }}
                                            </h4>
                                        </div>
                                        <div class="flex items-center gap-2 text-[10px] opacity-75 mt-0.5 font-mono">
                                            <span>Tag: <strong class="text-secondary font-black">${{ (Number(item.boutiquePrice || item.resalePrice || item.price) || 0).toFixed(2) }}</strong></span>
                                            <span v-if="item.cost">• Cost: ${{ (Number(item.cost) || 0).toFixed(2) }}</span>
                                            <span v-if="item.storageLocation" class="opacity-70">({{ item.storageLocation }})</span>
                                            <span v-if="Number(item.quantity || 1) > 1" class="badge badge-2xs badge-neutral font-bold font-mono">Qty: {{ item.quantity }}</span>
                                        </div>
                                    </div>

                                    <!-- Edit Drawer Button -->
                                    <button 
                                        type="button" 
                                        class="btn btn-ghost btn-xs btn-circle opacity-60 hover:opacity-100 hover:text-primary hover:bg-primary/10 shrink-0" 
                                        @click="openItemDrawer(item)" 
                                        title="Edit item in drawer"
                                    >
                                        <Icon icon="solar:pen-linear" class="w-3.5 h-3.5" />
                                    </button>

                                    <!-- Remove Button -->
                                    <button 
                                        type="button" 
                                        class="btn btn-ghost btn-xs btn-circle opacity-60 hover:opacity-100 hover:text-error hover:bg-error/10 shrink-0" 
                                        @click="$emit('unselect-item', item.$id)" 
                                        title="Remove from bundle selection"
                                    >
                                        <Icon icon="solar:close-circle-linear" class="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div v-else class="text-center py-3 border border-dashed border-base-300 rounded-box text-base-content/50 text-[11px]">
                                No items added yet. Search or use AI matches below to add pieces.
                            </div>

                            <!-- Workbench Quick Search & AI Match Strip -->
                            <div class="space-y-2 pt-2 border-t border-base-300/60">
                                <div class="flex items-center gap-1.5">
                                    <div class="relative flex-1">
                                        <Icon icon="solar:magnifer-linear" class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50" />
                                        <input 
                                            v-model="workbenchQuery" 
                                            type="text" 
                                            class="input input-xs input-bordered w-full pl-8 text-xs bg-base-100" 
                                            placeholder="Search catalog to add to bundle..." 
                                        />
                                    </div>
                                    <button 
                                        type="button" 
                                        class="btn btn-xs btn-secondary font-bold gap-1 shrink-0"
                                        @click="runTrayAiMatches"
                                        :disabled="loadingTrayAi || (selectedItems.length === 0 && !workbenchQuery.trim())"
                                        :title="workbenchQuery.trim() ? `Find companions seeded with '${workbenchQuery}'` : 'Find companion items that pair well with currently staged pieces'"
                                    >
                                        <span v-if="loadingTrayAi" class="loading loading-spinner loading-2xs"></span>
                                        <Icon v-else icon="solar:magic-stick-3-bold" class="w-3.5 h-3.5" />
                                        <span>{{ workbenchQuery.trim() ? 'Match Seed' : 'AI Matches' }}</span>
                                    </button>
                                </div>

                                <!-- AI Match Suggestion Chips -->
                                <div v-if="trayAiMatches.length > 0" class="space-y-1.5 bg-secondary/10 p-2 rounded-box border border-secondary/30">
                                    <div class="flex items-center justify-between text-[10px] font-bold text-secondary uppercase">
                                        <span>✨ AI Companion Matches ({{ trayAiMatches.length }})</span>
                                        <button type="button" @click="trayAiMatches = []" class="btn btn-2xs btn-ghost">✕</button>
                                    </div>
                                    <div class="space-y-1 max-h-40 overflow-y-auto pr-1">
                                        <div 
                                            v-for="match in trayAiMatches" 
                                            :key="match.id"
                                            class="flex items-center justify-between gap-2 p-1.5 bg-base-100 rounded-box border border-base-200 text-xs group"
                                        >
                                            <!-- Thumbnail (tap to edit) -->
                                            <div class="cursor-pointer shrink-0" @click="openItemDrawer(match.rawItem || match)" title="Edit item in drawer">
                                                <ItemThumbnail :item="match.rawItem || match" size="sm" class="w-8 h-8 pointer-events-none rounded-box" />
                                            </div>

                                            <div class="min-w-0 flex-1 cursor-pointer select-none" @click="openItemDrawer(match.rawItem || match)" title="Edit item in drawer">
                                                <p class="font-bold truncate text-[11px] group-hover:text-primary transition-colors">{{ match.title }}</p>
                                                <span class="text-[10px] text-secondary font-medium truncate block">{{ match.reason }}</span>
                                            </div>

                                            <div class="flex items-center gap-1.5 shrink-0">
                                                <span class="font-mono font-bold text-success text-[11px]">${{ match.price.toFixed(2) }}</span>
                                                <button 
                                                    type="button" 
                                                    class="btn btn-2xs btn-primary text-primary-content font-bold px-2"
                                                    @click="addMatchToSelection(match.id)"
                                                    title="Add to bundle"
                                                >
                                                    + Add
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Manual Search Candidate Results Dropdown -->
                                <div v-if="workbenchQuery.trim().length > 1" class="space-y-1 max-h-44 overflow-y-auto bg-base-100 p-1.5 rounded-box border border-base-300">
                                    <div v-if="workbenchSearchResults.length > 0">
                                        <div 
                                            v-for="cand in workbenchSearchResults" 
                                            :key="cand.$id"
                                            class="flex items-center justify-between gap-2 p-1.5 hover:bg-base-200 rounded-box cursor-pointer text-xs group"
                                        >
                                            <!-- Thumbnail (tap to edit) -->
                                            <div class="cursor-pointer shrink-0" @click="openItemDrawer(cand)" title="Edit item in drawer">
                                                <ItemThumbnail :item="cand" size="sm" class="w-8 h-8 pointer-events-none rounded-box" />
                                            </div>

                                            <div class="truncate font-medium text-[11px] flex-1 cursor-pointer select-none" @click="openItemDrawer(cand)" title="Edit item in drawer">
                                                <span class="truncate block group-hover:text-primary transition-colors font-bold">{{ cand.title }}</span>
                                                <span v-if="cand.upc || cand.locationSku" class="text-[9px] font-mono opacity-50 block">{{ cand.upc || cand.locationSku }}</span>
                                            </div>

                                            <div class="flex items-center gap-1.5 shrink-0">
                                                <span class="font-mono text-[10px] opacity-75">${{ (Number(cand.resalePrice || cand.price) || 0).toFixed(2) }}</span>
                                                <button 
                                                    type="button" 
                                                    class="btn btn-2xs btn-primary text-primary-content font-bold px-1.5 shrink-0"
                                                    @click="addMatchToSelection(cand.$id)"
                                                    title="Add to bundle"
                                                >
                                                    + Add
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div v-else class="p-2 text-center text-[11px] text-base-content/60">
                                        No active inventory found matching "{{ workbenchQuery }}"
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Bundle Form -->
                        <div class="space-y-2.5">
                            <div class="space-y-1">
                                <label class="text-[10px] font-bold uppercase tracking-wider text-base-content/70">Bundle Title</label>
                                <input 
                                    v-model="bundleForm.title" 
                                    type="text" 
                                    class="input input-sm input-bordered w-full font-bold bg-base-100" 
                                    placeholder="e.g. Vintage D&D Companion Set (Book + Dice + Minis)" 
                                />
                            </div>

                            <div class="space-y-1">
                                <label class="text-[10px] font-bold uppercase tracking-wider text-base-content/70">Description / Curation Notes</label>
                                <textarea 
                                    v-model="bundleForm.description" 
                                    class="textarea textarea-bordered textarea-sm w-full h-16 bg-base-100" 
                                    placeholder="Describe the lifestyle companion bundle..."
                                ></textarea>
                            </div>

                            <div class="grid grid-cols-2 gap-3">
                                <div class="space-y-1">
                                    <label class="text-[10px] font-bold uppercase tracking-wider text-base-content/70">Estimated Value ($)</label>
                                    <input 
                                        v-model.number="bundleForm.estHigh" 
                                        type="number" 
                                        step="0.01" 
                                        class="input input-sm input-bordered w-full font-mono font-bold text-success bg-base-100" 
                                        placeholder="0.00" 
                                    />
                                </div>
                                <div class="space-y-1">
                                    <label class="text-[10px] font-bold uppercase tracking-wider text-base-content/70">Storage Location</label>
                                    <input 
                                        v-model="bundleForm.storageLocation" 
                                        type="text" 
                                        class="input input-sm input-bordered w-full bg-base-100" 
                                        placeholder="e.g. MD-SHELF-1" 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Bundle Action Dock -->
                    <div class="p-3 sm:px-6 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-base-300 flex items-center justify-between bg-base-200/90 backdrop-blur-md gap-3 shrink-0">
                        <button 
                            type="button" 
                            class="btn btn-ghost btn-sm font-semibold" 
                            @click="currentSubView = 'main'"
                        >
                            Cancel
                        </button>
                        <button 
                            type="button" 
                            class="btn btn-accent text-accent-content btn-sm font-black px-6 shadow-md border border-accent-content/25 active:scale-95 transition-all gap-1.5"
                            @click="handleConfirmBundle"
                            :disabled="!bundleForm.title || isProcessing"
                        >
                            <Icon icon="solar:gift-bold" class="w-4 h-4" />
                            <span>Create Bundle ({{ selectedCount }} Items)</span>
                        </button>
                    </div>
                </div>

                <!-- ------------------------------------------------------------- -->
                <!-- SUB-VIEW 3: BATCH SUB-PANEL (In-Tray Volume Lot)              -->
                <!-- ------------------------------------------------------------- -->
                <div v-else-if="currentSubView === 'combine'" class="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div class="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
                        <!-- Mode Switcher (if an existing lot is detected) -->
                        <div v-if="existingLotInSelection" class="p-2.5 rounded-box border border-base-300 bg-base-200/50 space-y-1.5">
                            <label class="text-[10px] font-bold uppercase tracking-wider opacity-70">Batch Strategy</label>
                            <div class="flex gap-2">
                                <label class="label cursor-pointer gap-2 py-0">
                                    <input type="radio" value="add_to_existing" v-model="combineMode" class="radio radio-xs radio-primary" />
                                    <span class="label-text text-xs">Add into Existing Batch / Lot</span>
                                </label>
                                <label class="label cursor-pointer gap-2 py-0">
                                    <input type="radio" value="create_new" v-model="combineMode" class="radio radio-xs radio-primary" />
                                    <span class="label-text text-xs">Create New Batch Lot</span>
                                </label>
                            </div>
                        </div>

                        <!-- Combined Items Summary (Canonical List Item Pattern) -->
                        <div class="p-3 rounded-box border border-base-300 bg-base-200/50 space-y-2">
                            <div class="flex items-center justify-between font-bold text-[10px] uppercase opacity-60">
                                <span>{{ selectedCount }} Items to Batch</span>
                                <span class="font-mono">Batch Cost: ${{ combineCost.toFixed(2) }}</span>
                            </div>
                            <div class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                <div 
                                    v-for="item in selectedItems" 
                                    :key="item.$id"
                                    class="p-2 rounded-box border border-base-300 bg-base-100 hover:bg-base-200/60 transition-all flex items-center justify-between gap-2.5 group text-xs"
                                >
                                    <!-- Thumbnail (tap to edit) -->
                                    <div class="cursor-pointer shrink-0" @click="openItemDrawer(item)" title="Edit item in drawer">
                                        <ItemThumbnail :item="item" size="sm" class="w-10 h-10 pointer-events-none rounded-box" />
                                    </div>

                                    <!-- Title & Badges (tap to edit) -->
                                    <div class="min-w-0 flex-1 cursor-pointer select-none" @click="openItemDrawer(item)" title="Edit item in drawer">
                                        <div class="flex items-center gap-1.5 flex-wrap">
                                            <span v-if="item.upc || item.locationSku" class="badge badge-2xs font-mono font-bold bg-primary/10 text-primary border-0">
                                                {{ item.upc || item.locationSku }}
                                            </span>
                                            <span v-if="item.status" class="badge badge-2xs font-mono font-bold uppercase" :class="item.status === 'placed' ? 'badge-success' : 'badge-ghost'">
                                                {{ item.status }}
                                            </span>
                                            <h4 class="font-bold text-xs text-base-content truncate hover:text-primary transition-colors">
                                                {{ item.title || 'Untitled Item' }}
                                            </h4>
                                        </div>
                                        <div class="flex items-center gap-2 text-[10px] opacity-75 mt-0.5 font-mono">
                                            <span>Tag: <strong class="text-secondary font-black">${{ (Number(item.boutiquePrice || item.resalePrice || item.price) || 0).toFixed(2) }}</strong></span>
                                            <span v-if="item.cost">• Cost: ${{ (Number(item.cost) || 0).toFixed(2) }}</span>
                                            <span v-if="item.storageLocation" class="opacity-70">({{ item.storageLocation }})</span>
                                            <span v-if="Number(item.quantity || 1) > 1" class="badge badge-2xs badge-neutral font-bold font-mono">Qty: {{ item.quantity }}</span>
                                        </div>
                                    </div>

                                    <!-- Edit Drawer Button -->
                                    <button 
                                        type="button" 
                                        class="btn btn-ghost btn-xs btn-circle opacity-60 hover:opacity-100 hover:text-primary hover:bg-primary/10 shrink-0" 
                                        @click="openItemDrawer(item)" 
                                        title="Edit item in drawer"
                                    >
                                        <Icon icon="solar:pen-linear" class="w-3.5 h-3.5" />
                                    </button>

                                    <!-- Remove Button -->
                                    <button 
                                        type="button" 
                                        class="btn btn-ghost btn-xs btn-circle opacity-60 hover:opacity-100 hover:text-error hover:bg-error/10 shrink-0" 
                                        @click="$emit('unselect-item', item.$id)" 
                                        title="Remove from batch selection"
                                    >
                                        <Icon icon="solar:close-circle-linear" class="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Workbench Quick Search & AI Match Strip for Batching -->
                        <div class="space-y-2 pt-2 border-t border-base-300/60">
                            <div class="flex items-center gap-1.5">
                                <div class="relative flex-1">
                                    <Icon icon="solar:magnifer-linear" class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50" />
                                    <input 
                                        v-model="workbenchQuery" 
                                        type="text" 
                                        class="input input-xs input-bordered w-full pl-8 text-xs bg-base-100" 
                                        placeholder="Search catalog to add to batch..." 
                                    />
                                </div>
                                <button 
                                    type="button" 
                                    class="btn btn-xs btn-secondary font-bold gap-1 shrink-0"
                                    @click="runTrayAiMatches"
                                    :disabled="loadingTrayAi || (selectedItems.length === 0 && !workbenchQuery.trim())"
                                    :title="workbenchQuery.trim() ? `Find batch candidates seeded with '${workbenchQuery}'` : 'Find like-category items to batch with currently staged pieces'"
                                >
                                    <span v-if="loadingTrayAi" class="loading loading-spinner loading-2xs"></span>
                                    <Icon v-else icon="solar:magic-stick-3-bold" class="w-3.5 h-3.5" />
                                    <span>{{ workbenchQuery.trim() ? 'Match Seed' : 'AI Matches' }}</span>
                                </button>
                            </div>

                            <!-- AI Match Suggestion Chips -->
                            <div v-if="trayAiMatches.length > 0" class="space-y-1.5 bg-secondary/10 p-2 rounded-box border border-secondary/30">
                                <div class="flex items-center justify-between text-[10px] font-bold text-secondary uppercase">
                                    <span>✨ AI Batch Candidates ({{ trayAiMatches.length }})</span>
                                    <button type="button" @click="trayAiMatches = []" class="btn btn-2xs btn-ghost">✕</button>
                                </div>
                                <div class="space-y-1 max-h-40 overflow-y-auto pr-1">
                                    <div 
                                        v-for="match in trayAiMatches" 
                                        :key="match.id"
                                        class="flex items-center justify-between gap-2 p-1.5 bg-base-100 rounded-box border border-base-200 text-xs group"
                                    >
                                        <!-- Thumbnail (tap to edit) -->
                                        <div class="cursor-pointer shrink-0" @click="openItemDrawer(match.rawItem || match)" title="Edit item in drawer">
                                            <ItemThumbnail :item="match.rawItem || match" size="sm" class="w-8 h-8 pointer-events-none rounded-box" />
                                        </div>

                                        <div class="min-w-0 flex-1 cursor-pointer select-none" @click="openItemDrawer(match.rawItem || match)" title="Edit item in drawer">
                                            <p class="font-bold truncate text-[11px] group-hover:text-primary transition-colors">{{ match.title }}</p>
                                            <span class="text-[10px] text-secondary font-medium truncate block">{{ match.reason }}</span>
                                        </div>

                                        <div class="flex items-center gap-1.5 shrink-0">
                                            <span class="font-mono font-bold text-success text-[11px]">${{ match.price.toFixed(2) }}</span>
                                            <button 
                                                type="button" 
                                                class="btn btn-2xs btn-primary text-primary-content font-bold px-2"
                                                @click="addMatchToSelection(match.id)"
                                                title="Add to batch"
                                            >
                                                + Add
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Manual Search Candidate Results Dropdown -->
                            <div v-if="workbenchQuery.trim().length > 1" class="space-y-1 max-h-44 overflow-y-auto bg-base-100 p-1.5 rounded-box border border-base-300">
                                <div v-if="workbenchSearchResults.length > 0">
                                    <div 
                                        v-for="cand in workbenchSearchResults" 
                                        :key="cand.$id"
                                        class="flex items-center justify-between gap-2 p-1.5 hover:bg-base-200 rounded-box cursor-pointer text-xs group"
                                    >
                                        <!-- Thumbnail (tap to edit) -->
                                        <div class="cursor-pointer shrink-0" @click="openItemDrawer(cand)" title="Edit item in drawer">
                                            <ItemThumbnail :item="cand" size="sm" class="w-8 h-8 pointer-events-none rounded-box" />
                                        </div>

                                        <div class="truncate font-medium text-[11px] flex-1 cursor-pointer select-none" @click="openItemDrawer(cand)" title="Edit item in drawer">
                                            <span class="text-base-content group-hover:text-primary font-bold">{{ cand.title }}</span>
                                            <span class="opacity-50 text-[10px] block font-mono">
                                                {{ cand.locationSku || cand.upc }} • ${{ (Number(cand.boutiquePrice || cand.resalePrice || cand.price) || 0).toFixed(2) }}
                                            </span>
                                        </div>

                                        <button 
                                            type="button" 
                                            class="btn btn-2xs btn-secondary text-secondary-content font-bold px-2"
                                            @click="addMatchToSelection(cand.$id)"
                                            title="Add to batch"
                                        >
                                            + Add
                                        </button>
                                    </div>
                                </div>
                                <div v-else class="text-center py-2 text-[11px] opacity-60">
                                    No items matching "{{ workbenchQuery }}"
                                </div>
                            </div>
                        </div>

                        <!-- Title Input & Smart Suggestions -->
                        <div v-if="combineMode === 'create_new'" class="space-y-2">
                            <div class="space-y-1">
                                <label class="text-[10px] font-bold uppercase tracking-wider text-base-content/70">Batch Lot Title</label>
                                <input 
                                    v-model="combineTitle" 
                                    type="text" 
                                    class="input input-sm input-bordered w-full font-bold bg-base-100" 
                                    placeholder="e.g. Vintage Fantasy Paperbacks (Lot of 4)" 
                                />
                            </div>

                            <!-- Smart Title Suggestions -->
                            <div v-if="combineTitleSuggestions.length > 0" class="space-y-1">
                                <span class="text-[9px] font-bold uppercase opacity-50">Suggestions:</span>
                                <div class="flex flex-wrap gap-1">
                                    <button 
                                        v-for="sug in combineTitleSuggestions" 
                                        :key="sug"
                                        type="button" 
                                        @click="combineTitle = sug"
                                        class="btn btn-2xs btn-ghost border border-base-300 bg-base-200 hover:bg-primary/10 hover:border-primary text-[10px] truncate max-w-full font-semibold"
                                    >
                                        {{ sug }}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div v-else class="p-2.5 rounded-box bg-info/10 border border-info/20 text-xs">
                            <span class="font-bold text-info">Destination Batch / Lot:</span>
                            <strong class="ml-1">{{ existingLotInSelection?.title }}</strong>
                        </div>
                    </div>

                    <!-- Batch Action Dock -->
                    <div class="p-3 sm:px-6 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-base-300 flex items-center justify-between bg-base-200/90 backdrop-blur-md gap-3 shrink-0">
                        <button 
                            type="button" 
                            class="btn btn-ghost btn-sm font-semibold" 
                            @click="currentSubView = 'main'"
                        >
                            Cancel
                        </button>
                        <button 
                            type="button" 
                            class="btn btn-primary text-primary-content btn-sm font-black px-6 shadow-md border border-primary-content/25 active:scale-95 transition-all gap-1.5"
                            @click="handleConfirmCombine"
                            :disabled="combineMode === 'create_new' ? !combineTitle : false"
                        >
                            <Icon icon="solar:layers-bold" class="w-4 h-4" />
                            <span>{{ combineMode === 'create_new' ? 'Create Batch Lot' : 'Merge into Batch' }}</span>
                        </button>
                    </div>
                </div>

                <!-- ------------------------------------------------------------- -->
                <!-- SUB-VIEW 4: SPLIT / CURATION SUB-PANEL (IN-TRAY WIZARD)       -->
                <!-- ------------------------------------------------------------- -->
                <div v-else-if="currentSubView === 'split' && (selectedItems.length > 0 || activeLotItem)" class="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <LotSplitterWizard 
                        :lotItem="selectedItems[0] || activeLotItem"
                        @close="closeSplitSubView"
                        @completed="handleSplitCompleted"
                        @uncombine="handleConfirmSplit"
                        @split-one-unit="$emit('split-one-unit', selectedItems[0] || activeLotItem)"
                    />
                </div>

                <!-- ------------------------------------------------------------- -->
                <!-- DEFAULT MAIN VIEW: SELECTION LIST + BATCH CONTROLS           -->
                <!-- ------------------------------------------------------------- -->
                <div v-else class="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <!-- Drop Staging Context Banner (Phase 3) -->
                    <div 
                        v-if="activeManifest && (activeManifest.status === 'draft' || activeManifest.status === 'in-transit')" 
                        class="px-4 py-1.5 bg-primary/10 border-b border-primary/20 flex items-center justify-between gap-2 shrink-0 text-xs select-none"
                    >
                        <div class="flex items-center gap-1.5 min-w-0 text-primary font-bold truncate">
                            <Icon icon="solar:box-minimalistic-bold" class="w-4 h-4 shrink-0" />
                            <span class="truncate">Staged in {{ activeManifest.name }}</span>
                            <span class="badge badge-xs badge-primary font-mono font-bold shrink-0">{{ stagedCount }} items</span>
                        </div>
                        <div class="flex items-center gap-1.5 shrink-0">
                            <button 
                                v-if="selectedCount > 0 && activeManifest.status === 'draft'"
                                type="button" 
                                @click="$emit('stage-manifest')" 
                                class="btn btn-xs btn-primary text-primary-content font-bold h-6 min-h-6 px-2 shrink-0 gap-0.5"
                                title="Stage selected items into this drop"
                            >
                                <Icon icon="solar:add-circle-bold" class="w-3 h-3" />
                                <span>+ Stage ({{ selectedCount }})</span>
                            </button>
                            <button 
                                type="button" 
                                @click="handleOpenDropTray" 
                                class="btn btn-xs btn-outline btn-primary font-bold h-6 min-h-6 px-2 shrink-0 gap-0.5"
                            >
                                <span>View Drop</span>
                                <Icon icon="solar:arrow-right-linear" class="w-3 h-3" />
                            </button>
                        </div>
                    </div>

                    <!-- Selection Header Bar -->
                    <div class="px-4 py-2 border-b border-base-200 bg-base-200/40 flex items-center justify-between gap-2 shrink-0">
                        <div class="flex items-center gap-2 min-w-0">
                            <span class="font-extrabold text-xs text-base-content">
                                {{ selectedCount > 0 ? `${selectedCount} Selected` : '0 Selected' }}
                            </span>
                            <span v-if="selectedCount > 0 && selectedTotalRetail > 0" class="badge badge-xs badge-primary font-mono font-bold">
                                ${{ selectedTotalRetail.toFixed(2) }}
                            </span>
                        </div>

                        <div class="flex items-center gap-1.5 shrink-0">
                            <button 
                                type="button" 
                                class="btn btn-ghost btn-xs text-primary font-bold h-7 min-h-7 px-2.5"
                                @click="$emit('select-all')"
                                title="Select all filtered records"
                            >
                                Select All ({{ totalItems }})
                            </button>
                            <button 
                                v-if="selectedCount > 0"
                                type="button" 
                                class="btn btn-xs btn-outline btn-error font-bold h-7 min-h-7 px-2.5 gap-1 shadow-2xs"
                                @click="$emit('clear-selection')"
                                title="Clear all selections across pages"
                            >
                                <Icon icon="solar:close-circle-bold" class="w-3.5 h-3.5" />
                                <span>Clear ({{ selectedCount }})</span>
                            </button>
                        </div>
                    </div>

                    <!-- Scrollable Body: Selected Items List or Empty State -->
                    <div class="flex-1 overflow-y-auto p-3.5 space-y-2.5 scrollbar-thin text-xs">
                        <!-- Populated Selection List -->
                        <div v-if="selectedItems && selectedItems.length > 0" class="space-y-2">
                            <div 
                                v-for="item in selectedItems" 
                                :key="item.$id"
                                class="p-2.5 rounded-box border border-base-300 bg-base-200/40 hover:bg-base-200/80 transition-all flex items-center justify-between gap-3 group"
                            >
                                <!-- Thumbnail Image (tap to edit) -->
                                <div class="cursor-pointer shrink-0" @click="openItemDrawer(item)" title="Edit item in drawer">
                                    <ItemThumbnail :item="item" size="md" class="w-11 h-11 pointer-events-none rounded-box" />
                                </div>

                                <!-- Title & Metadata (tap to edit in drawer) -->
                                <div 
                                    class="min-w-0 flex-1 cursor-pointer select-none"
                                    @click="openItemDrawer(item)"
                                    title="Edit item in drawer"
                                >
                                    <div class="flex items-center gap-1.5 flex-wrap">
                                        <span v-if="item.upc || item.locationSku" class="badge badge-xs font-mono font-bold bg-primary/10 text-primary border-0">
                                            {{ item.upc || item.locationSku }}
                                        </span>
                                        <span v-if="item.status" class="badge badge-xs font-mono font-bold uppercase" :class="item.status === 'placed' ? 'badge-success' : 'badge-ghost'">
                                            {{ item.status }}
                                        </span>
                                        <h4 class="font-bold text-xs text-base-content truncate hover:text-primary transition-colors">
                                            {{ item.title || 'Untitled Item' }}
                                        </h4>
                                    </div>

                                    <div class="flex items-center gap-2 text-[10px] opacity-75 mt-0.5 font-mono">
                                        <span>Tag: <strong class="text-secondary font-black">${{ (Number(item.boutiquePrice || item.resalePrice || item.price) || 0).toFixed(2) }}</strong></span>
                                        <span v-if="item.cost">• Cost: ${{ (Number(item.cost) || 0).toFixed(2) }}</span>
                                        <span v-if="item.storageLocation" class="opacity-70">({{ item.storageLocation }})</span>
                                        <span v-if="Number(item.quantity || 1) > 1" class="badge badge-2xs badge-neutral font-bold font-mono">Qty: {{ item.quantity }}</span>
                                    </div>
                                </div>

                                <!-- Remove from selection button -->
                                <button 
                                    type="button" 
                                    class="btn btn-ghost btn-xs btn-circle opacity-60 hover:opacity-100 hover:text-error hover:bg-error/10 shrink-0" 
                                    @click="$emit('unselect-item', item.$id)"
                                    title="Unselect item"
                                >
                                    <Icon icon="solar:close-circle-linear" class="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <!-- Empty State when 0 items selected -->
                        <div v-else class="text-center py-10 space-y-2 text-base-content/60">
                            <div class="w-12 h-12 rounded-box bg-base-200 flex items-center justify-center mx-auto text-primary">
                                <Icon icon="solar:checklist-minimalistic-bold" class="w-6 h-6 opacity-60" />
                            </div>
                            <p class="font-bold text-xs sm:text-sm text-base-content">No Items Selected</p>
                            <p class="text-[11px] max-w-xs mx-auto text-base-content/70">
                                Check items in your catalog to restock units, combine like-with-like, bundle, move locations, or set status.
                            </p>
                            <div class="flex items-center justify-center gap-2 mt-2 flex-wrap">
                                <button 
                                    type="button" 
                                    class="btn btn-xs btn-outline btn-primary font-bold gap-1 shadow-2xs"
                                    @click="$emit('select-all')"
                                >
                                    <Icon icon="solar:check-square-bold" class="w-3.5 h-3.5" />
                                    <span>Select All ({{ totalItems }})</span>
                                </button>
                                <button 
                                    type="button" 
                                    class="btn btn-xs btn-secondary text-secondary-content font-bold gap-1 shadow-2xs"
                                    @click="openBundleSubView"
                                    title="Create a new companion bundle from scratch"
                                >
                                    <Icon icon="solar:gift-bold" class="w-3.5 h-3.5" />
                                    <span>➕ New Bundle</span>
                                </button>
                                <button 
                                    type="button" 
                                    class="btn btn-xs btn-outline border-info/50 text-info hover:bg-info/10 font-bold gap-1 shadow-2xs"
                                    @click="openCombineSubView"
                                    title="Combine items into a new volume lot"
                                >
                                    <Icon icon="solar:layers-bold" class="w-3.5 h-3.5" />
                                    <span>➕ New Combine Lot</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- STACKED FOOTER DOCK (ALL BULK ACTIONS IN STACKED DOCK) -->
                    <div class="border-t border-base-300 bg-base-100/95 backdrop-blur-md p-3 space-y-2 shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
                        <!-- UNIFIED BATCH CONTROLS BOX -->
                        <div class="bg-base-200/60 p-2.5 rounded-box border border-base-300/80 space-y-2">
                            <!-- Top Row: Location, Status, Channel pickers -->
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <!-- 1. Move Location -->
                                <div class="space-y-1">
                                    <label class="text-[10px] font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-1">
                                        <Icon icon="solar:map-point-bold" class="w-3 h-3 text-primary" />
                                        <span>Location</span>
                                    </label>
                                    <div class="flex items-center gap-1">
                                        <select v-model="selectedWarehouse" class="select select-xs select-bordered bg-base-100 text-xs font-bold flex-1 h-8 min-h-8">
                                            <option value="">No change</option>
                                            <option value="HG">HG (Garage)</option>
                                            <option value="HD">HD (Hideout)</option>
                                            <option value="MD">MD (Memory Den)</option>
                                            <option value="DT">DT (Dusty Tiger)</option>
                                            <option value="__custom__">Custom...</option>
                                        </select>
                                        <input 
                                            v-if="selectedWarehouse && selectedWarehouse !== '__custom__'"
                                            type="text" 
                                            v-model="customBin" 
                                            placeholder="Bin..." 
                                            class="input input-xs input-bordered bg-base-100 text-xs font-mono font-bold uppercase w-16 h-8 min-h-8"
                                        />
                                        <input 
                                            v-else-if="selectedWarehouse === '__custom__'"
                                            type="text" 
                                            v-model="customRawLocation" 
                                            placeholder="Location..." 
                                            class="input input-xs input-bordered bg-base-100 text-xs font-bold w-20 h-8 min-h-8"
                                        />
                                    </div>
                                </div>

                                <!-- 2. Set Status -->
                                <div class="space-y-1">
                                    <label class="text-[10px] font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-1">
                                        <Icon icon="solar:tag-bold" class="w-3 h-3 text-secondary" />
                                        <span>Status</span>
                                    </label>
                                    <select v-model="targetStatus" class="select select-xs select-bordered bg-base-100 text-xs font-bold w-full h-8 min-h-8">
                                        <option value="">No change</option>
                                        <option value="active">Active Stock</option>
                                        <option value="acquired">Acquired</option>
                                        <option value="received">Received</option>
                                        <option value="placed">Placed</option>
                                        <option value="sold">Sold</option>
                                    </select>
                                </div>

                                <!-- 3. Sales Channel -->
                                <div class="space-y-1">
                                    <label class="text-[10px] font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-1">
                                        <Icon icon="solar:shop-bold" class="w-3 h-3 text-accent" />
                                        <span>Channel</span>
                                    </label>
                                    <select v-model="targetChannel" class="select select-xs select-bordered bg-base-100 text-xs font-bold w-full h-8 min-h-8">
                                        <option value="">No change</option>
                                        <option v-for="ch in availableChannelList" :key="ch" :value="ch">{{ ch }}</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Apply Button Row -->
                            <div class="flex items-center justify-between gap-2 pt-1 border-t border-base-300/60">
                                <div class="text-[11px] text-base-content/70 flex items-center gap-1.5 font-medium">
                                    <span v-if="configuredChangesCount > 0" class="badge badge-xs badge-primary font-bold">
                                        {{ configuredChangesCount }} field{{ configuredChangesCount > 1 ? 's' : '' }} configured
                                    </span>
                                    <span v-else class="text-base-content/50 italic text-[10px]">
                                        Pick Location, Status, or Channel above
                                    </span>
                                </div>

                                <button 
                                    type="button" 
                                    class="btn btn-xs sm:btn-sm btn-primary text-primary-content font-bold px-3.5 gap-1.5 shadow-md active:scale-95 transition-all"
                                    :disabled="selectedCount === 0 || configuredChangesCount === 0 || isProcessing"
                                    @click="openConfirmationModal"
                                    title="Review and apply configured updates to all selected records"
                                >
                                    <Icon icon="solar:check-circle-bold" class="w-4 h-4" />
                                    <span>Apply to {{ selectedCount }} Selected</span>
                                </button>
                            </div>
                        </div>

                        <!-- MERCHANDISING ROW (RESTOCK, COMBINE, BUNDLE, SPLIT) -->
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-0.5">
                            <!-- Scenario A: Exactly 1 item selected -> Show Restock + Combine + Bundle + Split -->
                            <template v-if="selectedCount === 1">
                                <!-- Restock Units Trigger -->
                                <button 
                                    type="button" 
                                    class="btn btn-xs sm:btn-sm btn-primary text-primary-content font-black gap-1 h-9 justify-center shadow-xs active:scale-95"
                                    @click="openRestockSubView"
                                    title="Restock units into this crate/item"
                                >
                                    <Icon icon="solar:box-minimalistic-bold" class="w-3.5 h-3.5" />
                                    <span class="truncate">Restock</span>
                                </button>

                                <!-- Batch into another lot -->
                                <button 
                                    type="button" 
                                    class="btn btn-xs sm:btn-sm btn-outline border-base-300 hover:border-info hover:bg-info/10 font-bold gap-1 h-9 justify-center"
                                    @click="openCombineSubView"
                                    title="Batch into existing lot or multi-quantity"
                                >
                                    <Icon icon="solar:layers-bold" class="w-3.5 h-3.5 text-info" />
                                    <span class="truncate">Batch (1)</span>
                                </button>

                                <!-- Curate Companion Bundle around this 1 anchor item -->
                                <button 
                                    type="button" 
                                    class="btn btn-xs sm:btn-sm btn-outline border-base-300 hover:border-accent hover:bg-accent/10 font-bold gap-1 h-9 justify-center"
                                    @click="openBundleSubView"
                                    title="Curate companion pieces around this anchor item into an elevated bundle"
                                >
                                    <Icon icon="solar:gift-bold" class="w-3.5 h-3.5 text-accent" />
                                    <span class="truncate">Bundle (1)</span>
                                </button>

                                <!-- Split / Rollback / Curate Lot Trigger -->
                                <button 
                                    type="button" 
                                    class="btn btn-xs sm:btn-sm btn-outline border-base-300 hover:border-secondary hover:bg-secondary/10 font-bold gap-1 h-9 justify-center text-base-content"
                                    :class="{ 'border-secondary/60 text-secondary bg-secondary/5': isLotItem(selectedItems[0]) || (Number(selectedItems[0]?.quantity) > 1) }"
                                    @click="openSplitSubView"
                                    title="Split, deconstruct, or curate this lot into profit tiers"
                                >
                                    <Icon icon="solar:scissors-square-bold" class="w-3.5 h-3.5 text-secondary" />
                                    <span class="truncate">{{ isLotItem(selectedItems[0]) ? 'Split / Rollback' : 'Split Lot' }}</span>
                                </button>
                            </template>

                            <!-- Scenario B: 2+ items selected -> Show Batch + Bundle -->
                            <template v-else>
                                <!-- Batch (Like-with-Like) -->
                                <button 
                                    type="button" 
                                    class="btn btn-xs sm:btn-sm btn-outline border-base-300 hover:border-info hover:bg-info/10 font-bold gap-1 h-9 justify-center"
                                    :disabled="selectedCount < 2"
                                    @click="openCombineSubView"
                                    title="Batch selected items into new volume lot"
                                >
                                    <Icon icon="solar:layers-bold" class="w-3.5 h-3.5 text-info" />
                                    <span class="truncate">Batch ({{ selectedCount }})</span>
                                </button>

                                <!-- Bundle (Companion / Lifestyle) -->
                                <button 
                                    type="button" 
                                    class="btn btn-xs sm:btn-sm btn-outline border-base-300 hover:border-accent hover:bg-accent/10 font-bold gap-1 h-9 justify-center"
                                    :disabled="selectedCount < 2"
                                    @click="openBundleSubView"
                                    title="Bundle selected items into new companion listing"
                                >
                                    <Icon icon="solar:gift-bold" class="w-3.5 h-3.5 text-accent" />
                                    <span class="truncate">Bundle ({{ selectedCount }})</span>
                                </button>
                            </template>

                            <!-- Generic CSV Export -->
                            <button 
                                type="button" 
                                class="btn btn-xs sm:btn-sm btn-outline border-base-300 hover:border-success hover:bg-success/10 font-bold gap-1 h-9 justify-center"
                                @click="$emit('export', 'generic')"
                                :title="selectedCount > 0 ? `Export ${selectedCount} selected items to Generic CSV` : 'Export all filtered items to Generic CSV'"
                            >
                                <Icon icon="solar:file-download-bold" class="w-3.5 h-3.5 text-success" />
                                <span class="truncate">Export CSV</span>
                            </button>

                            <!-- Delete -->
                            <button 
                                type="button" 
                                class="btn btn-xs sm:btn-sm btn-outline btn-error font-bold gap-1 h-9 justify-center"
                                :disabled="selectedCount === 0 || isProcessing"
                                @click="isConfirmingDelete = true"
                                title="Delete selected records"
                            >
                                <Icon icon="solar:trash-bin-trash-bold" class="w-3.5 h-3.5" />
                                <span class="truncate">Delete</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ============================================================= -->
            <!-- TAB 2: ADD & INGEST TRAY CONTENT                              -->
            <!-- ============================================================= -->
            <div v-show="activeTab === 'add-prep'" class="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 text-xs scrollbar-thin">
                <!-- Action 1: Scout Quick Add (Hero Card) -->
                <div class="bg-gradient-to-r from-primary/10 via-secondary/10 to-base-200/80 border border-primary/20 rounded-box p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                    <div class="flex items-start gap-3">
                        <div class="w-10 h-10 rounded-box bg-primary text-primary-content flex items-center justify-center shrink-0 shadow-md">
                            <Icon icon="solar:camera-bold" class="w-5 h-5" />
                        </div>
                        <div class="space-y-0.5 min-w-0">
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <span class="badge badge-xs badge-primary font-bold">Fastest</span>
                                <h4 class="font-extrabold text-xs sm:text-sm text-base-content">Scout Camera Quick Add</h4>
                            </div>
                            <p class="text-[11px] text-base-content/70 leading-relaxed">
                                Continuous real-time camera viewfinder with instant Gemini AI multi-photo deep inspection.
                            </p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        class="btn btn-sm btn-primary text-primary-content font-bold px-4 shadow-sm w-full sm:w-auto shrink-0 gap-1.5"
                        @click="handleScoutQuickAdd"
                    >
                        <Icon icon="solar:magic-stick-3-bold" class="w-4 h-4" />
                        <span>Launch Scout</span>
                    </button>
                </div>

                <!-- Action 2: Manual Item Creation Drawer -->
                <div class="p-3.5 rounded-box border border-base-300 bg-base-200/40 hover:bg-base-200/70 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div class="flex items-start gap-3">
                        <div class="w-9 h-9 rounded-box bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
                            <Icon icon="solar:pen-new-square-bold" class="w-4.5 h-4.5" />
                        </div>
                        <div class="space-y-0.5">
                            <h4 class="font-bold text-xs text-base-content">Manual Item Drawer</h4>
                            <p class="text-[11px] text-base-content/70">
                                Open the standard single-item creation drawer to fill in UPC, title, costs, and channels.
                            </p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        class="btn btn-sm btn-outline border-base-300 hover:border-secondary hover:bg-secondary/10 font-bold px-4 w-full sm:w-auto shrink-0 gap-1.5"
                        @click="handleOpenAddDrawer"
                    >
                        <Icon icon="solar:add-circle-linear" class="w-4 h-4 text-secondary" />
                        <span>Add Item</span>
                    </button>
                </div>

                <!-- Action 3: CSV Spreadsheet Ingestion -->
                <div class="p-3.5 rounded-box border border-base-300 bg-base-200/40 hover:bg-base-200/70 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div class="flex items-start gap-3">
                        <div class="w-9 h-9 rounded-box bg-accent/10 text-accent flex items-center justify-center shrink-0">
                            <Icon icon="solar:file-text-bold" class="w-4.5 h-4.5" />
                        </div>
                        <div class="space-y-0.5">
                            <h4 class="font-bold text-xs text-base-content">CSV Spreadsheet Ingestion</h4>
                            <p class="text-[11px] text-base-content/70">
                                Bulk upload hundreds of items from ShopGoodwill, eBay, or generic CSV inventory manifests.
                            </p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        class="btn btn-sm btn-outline border-base-300 hover:border-accent hover:bg-accent/10 font-bold px-4 w-full sm:w-auto shrink-0 gap-1.5"
                        @click="handleImportCsv"
                    >
                        <Icon icon="solar:upload-track-linear" class="w-4 h-4 text-accent" />
                        <span>Upload CSV</span>
                    </button>
                </div>
            </div>

            <!-- ============================================================= -->
            <!-- TAB 3: FILTERS & VIEW OPTIONS TRAY CONTENT                    -->
            <!-- ============================================================= -->
            <div v-show="activeTab === 'filters'" class="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div class="flex-1 overflow-y-auto p-4 space-y-4 text-xs scrollbar-thin">
                    <slot name="filters">
                        <!-- Standard Fallback Filter Controls -->
                        <div class="space-y-3">
                            <div class="space-y-1">
                                <label class="font-black text-xs text-base-content">
                                    Filter by Location
                                </label>
                                <select 
                                    :value="filterLocation" 
                                    @change="$emit('update:filterLocation', $event.target.value)"
                                    class="select select-sm select-bordered w-full bg-base-100 text-xs font-bold"
                                >
                                    <option value="all">All Locations</option>
                                    <option v-for="loc in locations" :key="loc" :value="loc">{{ loc }}</option>
                                </select>
                            </div>

                            <div class="space-y-1">
                                <label class="font-black text-xs text-base-content">
                                    Filter by Status
                                </label>
                                <select 
                                    :value="filterStatus" 
                                    @change="$emit('update:filterStatus', $event.target.value)"
                                    class="select select-sm select-bordered w-full bg-base-100 text-xs font-bold"
                                >
                                    <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                                </select>
                            </div>

                            <div class="space-y-1">
                                <label class="font-black text-xs text-base-content">
                                    Filter by Sales Channel
                                </label>
                                <select 
                                    :value="filterChannel" 
                                    @change="$emit('update:filterChannel', $event.target.value)"
                                    class="select select-sm select-bordered w-full bg-base-100 text-xs font-bold"
                                >
                                    <option value="all">All Channels</option>
                                    <option v-for="ch in channels" :key="ch" :value="ch">{{ ch }}</option>
                                </select>
                            </div>
                        </div>
                    </slot>
                </div>

                <!-- Sticky Filters Footer -->
                <div class="p-3 border-t border-base-300 bg-base-200/90 backdrop-blur-md flex items-center justify-between gap-2 shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
                    <button 
                        type="button" 
                        class="btn btn-sm btn-ghost text-base-content/70 font-bold" 
                        @click="$emit('reset-filters')"
                    >
                        Reset All
                    </button>
                    <button 
                        type="button" 
                        class="btn btn-sm btn-primary font-bold px-6 shadow-md text-primary-content"
                        @click="closeTray"
                    >
                        Show Items
                    </button>
                </div>
            </div>
        </div>

        <!-- BULK DELETE CONFIRMATION MODAL -->
        <dialog class="modal modal-bottom sm:modal-middle z-[80]" :class="{ 'modal-open': isConfirmingDelete }">
            <div v-if="isConfirmingDelete" class="modal-box bg-base-100 border border-base-300 shadow-2xl rounded-box p-5 max-w-sm mx-auto">
                <div class="flex items-center gap-3 text-error mb-3">
                    <div class="w-10 h-10 rounded-box bg-error/15 flex items-center justify-center shrink-0">
                        <Icon icon="solar:trash-bin-trash-bold" class="w-6 h-6 text-error" />
                    </div>
                    <div>
                        <h3 class="font-black text-base text-base-content">Delete {{ selectedCount }} Items?</h3>
                        <p class="text-xs opacity-60 font-mono">Bulk Deletion</p>
                    </div>
                </div>
                
                <p class="text-xs sm:text-sm text-base-content/80 mb-5 leading-relaxed">
                    This will permanently delete <strong>{{ selectedCount }} items</strong> and all associated image assets. This action cannot be undone.
                </p>

                <div class="modal-action flex items-center gap-2 mt-0">
                    <button 
                        type="button" 
                        @click="isConfirmingDelete = false" 
                        class="btn btn-ghost flex-1 font-bold"
                    >
                        Cancel
                    </button>
                    <button 
                        type="button" 
                        @click="confirmDelete" 
                        class="btn btn-error flex-1 font-black text-error-content shadow-md gap-1.5"
                    >
                        <span>Yes, Delete All</span>
                    </button>
                </div>
            </div>
            <form method="dialog" class="modal-backdrop" @click="isConfirmingDelete = false">
                <button>close</button>
            </form>
        </dialog>

        <!-- BULK CHANGES CONFIRMATION MODAL -->
        <dialog class="modal modal-bottom sm:modal-middle z-[80]" :class="{ 'modal-open': isConfirmModalOpen }">
            <div v-if="isConfirmModalOpen" class="modal-box bg-base-100 border border-base-300 shadow-2xl rounded-box p-5 max-w-md mx-auto space-y-4">
                <!-- Header -->
                <div class="flex items-start justify-between gap-3">
                    <div class="flex items-center gap-2.5">
                        <div class="w-10 h-10 rounded-box bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Icon icon="solar:checklist-minimalistic-bold" class="w-6 h-6" />
                        </div>
                        <div>
                            <h3 class="font-black text-base text-base-content">Confirm Bulk Changes</h3>
                            <p class="text-xs text-base-content/60 font-mono">
                                Updating {{ selectedCount }} items across catalog
                            </p>
                        </div>
                    </div>
                    <button type="button" @click="isConfirmModalOpen = false" class="btn btn-ghost btn-xs btn-circle">
                        <Icon icon="solar:close-circle-bold" class="w-5 h-5 opacity-60" />
                    </button>
                </div>

                <!-- Itemized Changes Breakdown -->
                <div class="space-y-2 bg-base-200/60 p-3 rounded-box border border-base-300/80 text-xs">
                    <div class="font-bold text-[10px] uppercase tracking-wider text-base-content/60 mb-1">
                        Updates to be applied:
                    </div>

                    <!-- Location -->
                    <div class="flex items-center justify-between py-1 border-b border-base-300/50">
                        <div class="flex items-center gap-1.5 text-base-content/80">
                            <Icon icon="solar:map-point-bold" class="w-4 h-4 text-primary" />
                            <span class="font-bold">Location</span>
                        </div>
                        <div>
                            <span v-if="computedLocationPreview" class="badge badge-xs badge-primary font-mono font-bold">
                                {{ computedLocationPreview }}
                            </span>
                            <span v-else class="text-base-content/40 italic">Unchanged</span>
                        </div>
                    </div>

                    <!-- Status -->
                    <div class="flex items-center justify-between py-1 border-b border-base-300/50">
                        <div class="flex items-center gap-1.5 text-base-content/80">
                            <Icon icon="solar:tag-bold" class="w-4 h-4 text-secondary" />
                            <span class="font-bold">Status</span>
                        </div>
                        <div>
                            <span v-if="targetStatus" class="badge badge-xs badge-secondary font-mono font-bold uppercase">
                                {{ targetStatus }}
                            </span>
                            <span v-else class="text-base-content/40 italic">Unchanged</span>
                        </div>
                    </div>

                    <!-- Channel -->
                    <div class="flex items-center justify-between py-1">
                        <div class="flex items-center gap-1.5 text-base-content/80">
                            <Icon icon="solar:shop-bold" class="w-4 h-4 text-accent" />
                            <span class="font-bold">Sales Channel</span>
                        </div>
                        <div>
                            <span v-if="targetChannel" class="badge badge-xs badge-accent font-mono font-bold">
                                {{ targetChannel }}
                            </span>
                            <span v-else class="text-base-content/40 italic">Unchanged</span>
                        </div>
                    </div>
                </div>

                <!-- Explanation Note -->
                <div class="alert alert-info py-2 px-3 text-[11px] rounded-box flex items-start gap-2">
                    <Icon icon="solar:info-circle-bold" class="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                        This will update all <strong>{{ selectedCount }} items</strong> in the database at once via high-speed server batching.
                    </span>
                </div>

                <!-- Clear Selection Checkbox Option -->
                <label class="label cursor-pointer py-0 justify-start gap-2.5">
                    <input type="checkbox" v-model="clearSelectionAfterApply" class="checkbox checkbox-xs checkbox-primary" />
                    <span class="label-text text-xs text-base-content/80">Clear selection after applying changes</span>
                </label>

                <!-- Actions -->
                <div class="flex items-center justify-end gap-2 pt-2 border-t border-base-300">
                    <button 
                        type="button" 
                        class="btn btn-sm btn-ghost font-bold"
                        @click="isConfirmModalOpen = false"
                    >
                        Cancel
                    </button>
                    <button 
                        type="button" 
                        class="btn btn-sm btn-primary text-primary-content font-bold px-5 gap-1.5 shadow-md"
                        @click="executeUnifiedApply"
                    >
                        <Icon icon="solar:check-circle-bold" class="w-4 h-4" />
                        <span>Confirm &amp; Apply</span>
                    </button>
                </div>
            </div>
            <form method="dialog" class="modal-backdrop" @click="isConfirmModalOpen = false">
                <button>close</button>
            </form>
        </dialog>
    </div>
</template>

<script setup>
import { ref, computed, reactive, watch } from 'vue';
import { Icon } from '@iconify/vue';
import ItemThumbnail from '../common/ItemThumbnail.vue';
import LotSplitterWizard from './LotSplitterWizard.vue';
import { useManifest } from '../../composables/useManifest';
import { useItemDrawer } from '../../composables/useItemDrawer';
import { useLotSplitter } from '../../composables/useLotSplitter';
import { generateSmartLotTitle } from '../../lib/lotTitleGenerator';

const props = defineProps({
    isOpen: {
        type: Boolean,
        default: false
    },
    activeTab: {
        type: String,
        default: 'actions' // 'actions' | 'add-prep' | 'filters'
    },
    selectedCount: {
        type: Number,
        default: 0
    },
    selectedItems: {
        type: Array,
        default: () => []
    },
    totalItems: {
        type: Number,
        default: 0
    },
    activeFilterCount: {
        type: Number,
        default: 0
    },
    locations: {
        type: Array,
        default: () => []
    },
    channels: {
        type: Array,
        default: () => []
    },
    filterStatus: {
        type: String,
        default: 'active'
    },
    filterLocation: {
        type: String,
        default: 'all'
    },
    filterChannel: {
        type: String,
        default: 'all'
    },
    isProcessing: {
        type: Boolean,
        default: false
    },
    manifestItemCount: {
        type: Number,
        default: 0
    },
    manifestName: {
        type: String,
        default: ''
    },
    inventoryItems: {
        type: Array,
        default: () => []
    }
});

const emit = defineEmits([
    'update:isOpen',
    'update:activeTab',
    'update:filterStatus',
    'update:filterLocation',
    'update:filterChannel',
    'scout-quick-add',
    'open-add-drawer',
    'import-csv',
    'combine',
    'bundle',
    'apply-location',
    'apply-status',
    'apply-bulk-unified',
    'export',
    'delete',
    'select-all',
    'select-item',
    'unselect-item',
    'clear-selection',
    'reset-filters',
    'stage-manifest',
    'restock-item',
    'submit-bundle',
    'submit-combine',
    'uncombine-lot',
    'split-one-unit',
    'split-completed'
]);

const { isActionTrayOpen, activeManifest, stagedCount, openManifestTray } = useManifest();
const { openItemDrawer } = useItemDrawer();
const { isLotSplitterOpen, activeLotItem, openLotSplitter, closeLotSplitter } = useLotSplitter();

// Merchandising In-Tray Sub-View Navigation
const currentSubView = ref('main'); // 'main' | 'restock' | 'bundle' | 'combine' | 'split'

const openSplitSubView = () => {
    currentSubView.value = 'split';
};

const closeSplitSubView = () => {
    currentSubView.value = 'main';
    closeLotSplitter();
};

const handleSplitCompleted = (payload) => {
    currentSubView.value = 'main';
    emit('uncombine-lot', props.selectedItems[0] || activeLotItem.value);
    emit('split-completed', payload);
    closeTray();
};

const closeTray = () => {
    currentSubView.value = 'main';
    isActionTrayOpen.value = false;
    closeLotSplitter();
    emit('update:isOpen', false);
};

const handleOpenDropTray = () => {
    closeTray();
    openManifestTray();
};

// Open split subview automatically when isLotSplitterOpen is triggered globally
watch(isLotSplitterOpen, (open) => {
    if (open && activeLotItem.value) {
        emit('update:isOpen', true);
        currentSubView.value = 'split';
    }
});

// Reset subview when tray closes or active tab changes
watch(() => props.isOpen, (open) => {
    if (!open) {
        currentSubView.value = 'main';
        closeLotSplitter();
    }
});
watch(() => props.activeTab, () => {
    currentSubView.value = 'main';
});
watch(() => props.selectedCount, (count) => {
    if (count === 0 && currentSubView.value === 'restock') {
        currentSubView.value = 'main';
    }
    if (count === 0 && currentSubView.value === 'split' && !activeLotItem.value) {
        currentSubView.value = 'main';
    }
});

// Helper: Check if item is already a lot
const isLotItem = (item) => {
    if (!item) return false;
    return !!(
        item.isLot || 
        item.status === 'combined' || 
        (Number(item.quantity || 1) > 1 && !item.parentLotId) ||
        (Array.isArray(item.lotChildren) && item.lotChildren.length > 0) ||
        /\b(?:lot|bundle|crate|pack|collection)\b/i.test(item.title || '')
    );
};

// -------------------------------------------------------------
// RESTOCK STATE & TELEMETRY
// -------------------------------------------------------------
const restockMode = ref('catalog_items'); // 'catalog_items' | 'vice_versa' | 'manual'
const stagedRestockItems = ref([]);
const restockCatalogSearch = ref('');
const restockUnits = ref(10);
const restockCost = ref(0);

const currentStock = computed(() => {
    if (!props.selectedItems || props.selectedItems.length === 0) return 1;
    return Number(props.selectedItems[0]?.quantity || 1);
});

const currentCost = computed(() => {
    if (!props.selectedItems || props.selectedItems.length === 0) return 0;
    return Number(props.selectedItems[0]?.cost || 0);
});

const currentUnitCost = computed(() => {
    return currentStock.value > 0 ? (currentCost.value / currentStock.value) : 0;
});

const newStock = computed(() => {
    return currentStock.value + Math.max(0, Number(restockUnits.value) || 0);
});

const newTotalCost = computed(() => {
    return Number((currentCost.value + Math.max(0, Number(restockCost.value) || 0)).toFixed(2));
});

const newUnitCost = computed(() => {
    const qty = Math.max(1, newStock.value);
    return Number((newTotalCost.value / qty).toFixed(2));
});

// Clean / normalize text for robust token and phrase matching
const normalizeSearchText = (str = '') => {
    return String(str || '')
        .toLowerCase()
        .replace(/g\.i\./gi, 'gi ') // normalize G.I. to gi
        .replace(/[^a-z0-9\s]/g, ' ') // strip punctuation to spaces
        .replace(/\s+/g, ' ')
        .trim();
};

const RESALE_STOP_WORDS = new Set([
    'vintage', 'retro', 'rare', 'classic', 'collectible', 'original', 'authentic',
    'condition', 'used', 'brand', 'pieces', 'with', 'from', 'more', 'lot', 'item',
    'items', 'and', 'the', 'for', 'box', 'set', 'edition', 'unknown', 'assorted',
    'very', 'good', 'fair', 'nice', 'great', 'style'
]);

const DOMAIN_SHORT_TOKENS = new Set([
    'gi', 'joe', 'd&d', 'rpg', 'tsr', 'dc', 'tv', 'lotr', 'pc', 'nes', 'snes', 'n64', 'cd', 'lp', 'ep'
]);

const extractMeaningfulTokens = (text = '') => {
    const normalized = normalizeSearchText(text);
    return normalized
        .split(/\s+/)
        .filter(w => {
            if (DOMAIN_SHORT_TOKENS.has(w)) return true;
            return w.length > 2 && !RESALE_STOP_WORDS.has(w);
        });
};

// Existing Active Batches in Catalog (to merge this item INTO - "Vice Versa")
const activeBatchesInCatalog = computed(() => {
    if (!props.inventoryItems || !props.selectedItems || props.selectedItems.length === 0) return [];
    const target = props.selectedItems[0];
    const targetId = target?.$id || target?.id;
    const targetParentId = target?.parentLotId;
    return (props.inventoryItems || []).filter(item => {
        const id = item.$id || item.id;
        if (id === targetId) return false;
        // Exclude finished, deconstructed, or non-physical items
        if (['sold', 'archived', 'deconstructed', 'combined', 'tracked', 'scouted'].includes(item.status)) return false;
        // Exclude parent lot if target was split from it
        if (targetParentId && id === targetParentId) return false;
        // Exclude children if target has this child
        if (item.parentLotId && item.parentLotId === targetId) return false;
        return Number(item.quantity || 1) > 1 || item.isLot || /\b(?:lot|bundle|crate|pack|collection)\b/i.test(item.title || '');
    });
});

// Matching Catalog Items to Restock INTO this item
const restockCatalogCandidates = computed(() => {
    if (!props.inventoryItems || !props.selectedItems || props.selectedItems.length === 0) return [];
    const target = props.selectedItems[0];
    const targetId = target.$id || target.id;
    const targetParentId = target.parentLotId;
    const stagedIds = new Set(stagedRestockItems.value.map(i => i.$id || i.id));
    const targetCat = (target.category || '').toLowerCase();
    const targetTokens = extractMeaningfulTokens(target.title || '');
    const rawSearch = (restockCatalogSearch.value || '').trim().toLowerCase();
    const searchTokens = rawSearch.split(/\s+/).filter(Boolean);

    return (props.inventoryItems || [])
        .filter(item => {
            const id = item.$id || item.id;
            // Never show the item itself, already staged items, or its direct parent lot
            if (id === targetId || stagedIds.has(id)) return false;
            if (targetParentId && id === targetParentId) return false;
            if (item.parentLotId && item.parentLotId === targetId) return false;

            // Filter out finished (sold), deconstructed parent lots, already combined items, and unacquired trackers
            const itemStatus = (item.status || 'acquired').toLowerCase();
            if (['sold', 'archived', 'deconstructed', 'combined', 'tracked', 'scouted'].includes(itemStatus)) {
                return false;
            }
            
            if (rawSearch.length > 0) {
                const titleNorm = (item.title || '').toLowerCase();
                const skuNorm = (item.locationSku || item.upc || '').toLowerCase();
                const catNorm = (item.category || '').toLowerCase();
                return searchTokens.every(tok => titleNorm.includes(tok) || skuNorm.includes(tok) || catNorm.includes(tok));
            }
            return true;
        })
        .map(item => {
            let score = 0;
            const cat = (item.category || '').toLowerCase();
            const itemTokens = extractMeaningfulTokens(item.title || '');
            const matched = itemTokens.filter(t => targetTokens.includes(t));
            if (matched.length > 0) score += matched.length * 10;
            if (cat && targetCat && cat === targetCat) score += 5;
            return { item, score, matchedTokens: matched };
        })
        .filter(x => rawSearch.length > 0 || x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
});

const addRestockItemCandidate = (item) => {
    if (!stagedRestockItems.value.some(i => (i.$id || i.id) === (item.$id || item.id))) {
        stagedRestockItems.value.push(item);
        recalcRestockFromStaged();
    }
};

const removeStagedRestockItem = (itemId) => {
    stagedRestockItems.value = stagedRestockItems.value.filter(i => (i.$id || i.id) !== itemId);
    recalcRestockFromStaged();
};

const recalcRestockFromStaged = () => {
    if (stagedRestockItems.value.length > 0) {
        restockUnits.value = stagedRestockItems.value.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);
        restockCost.value = Number(stagedRestockItems.value.reduce((sum, i) => sum + (Number(i.cost) || 0), 0).toFixed(2));
    } else {
        restockUnits.value = 0;
        restockCost.value = 0;
    }
};

const handleConfirmMergeIntoBatch = (targetBatch) => {
    if (!props.selectedItems || props.selectedItems.length === 0 || !targetBatch) return;
    emit('submit-combine', {
        items: props.selectedItems,
        title: targetBatch.title,
        mode: 'add_to_existing',
        targetLot: targetBatch
    });
    currentSubView.value = 'main';
};

const openRestockSubView = () => {
    if (props.selectedCount !== 1) return;
    restockMode.value = 'catalog_items';
    stagedRestockItems.value = [];
    restockCatalogSearch.value = '';
    restockUnits.value = 0;
    restockCost.value = 0;
    currentSubView.value = 'restock';
};

const handleConfirmRestock = () => {
    if (props.selectedItems.length === 0) return;
    if (stagedRestockItems.value.length > 0) {
        emit('submit-combine', {
            items: stagedRestockItems.value,
            title: props.selectedItems[0].title,
            mode: 'add_to_existing',
            targetLot: props.selectedItems[0]
        });
    } else {
        if (!restockUnits.value || restockUnits.value < 1) return;
        emit('restock-item', {
            item: props.selectedItems[0],
            unitsToAdd: Number(restockUnits.value),
            addedCostBasis: Number(restockCost.value || 0)
        });
    }
    currentSubView.value = 'main';
};

// -------------------------------------------------------------
// BUNDLE STATE & ACTIONS
// -------------------------------------------------------------
const bundleForm = reactive({
    title: '',
    description: '',
    estHigh: '',
    storageLocation: ''
});

const bundleCombinedCost = computed(() => {
    if (!props.selectedItems || props.selectedItems.length === 0) return 0;
    return props.selectedItems.reduce((sum, item) => sum + Number(item.cost || 0), 0);
});



// In-Tray Bundle & Combine Workbench Search & AI Matching
const workbenchQuery = ref('');
const loadingTrayAi = ref(false);
const trayAiMatches = ref([]);

const workbenchSearchResults = computed(() => {
    const rawQ = workbenchQuery.value.trim();
    if (rawQ.length < 2) return [];
    // Auto-normalize common typo "git" -> "gi"
    const qNorm = normalizeSearchText(rawQ).replace(/\bgit\b/g, 'gi');
    const queryTokens = qNorm.split(/\s+/).filter(Boolean);
    const selectedIds = new Set((props.selectedItems || []).map(i => i.$id || i.id));

    return (props.inventoryItems || [])
        .filter(item => {
            const id = item.$id || item.id;
            if (selectedIds.has(id)) return false;
            
            const titleNorm = normalizeSearchText(item.title || '');
            const skuNorm = normalizeSearchText(item.locationSku || item.sku || '');
            const catNorm = normalizeSearchText(item.category || '');

            // Exact phrase match first
            if (titleNorm.includes(qNorm) || skuNorm.includes(qNorm) || catNorm.includes(qNorm)) {
                return true;
            }
            // All tokens match
            if (queryTokens.length > 1 && queryTokens.every(tok => titleNorm.includes(tok) || catNorm.includes(tok))) {
                return true;
            }
            // Or if at least one meaningful domain token matches (e.g. 'joe', 'hasbro', 'gi')
            if (queryTokens.some(tok => (DOMAIN_SHORT_TOKENS.has(tok) || tok.length >= 3) && titleNorm.includes(tok))) {
                return true;
            }
            return false;
        })
        .slice(0, 8);
});

const addMatchToSelection = (itemId) => {
    emit('select-item', itemId);
    trayAiMatches.value = trayAiMatches.value.filter(m => m.id !== itemId);
};

const runTrayAiMatches = () => {
    if ((!props.selectedItems || props.selectedItems.length === 0) && !workbenchQuery.value.trim()) return;
    loadingTrayAi.value = true;
    setTimeout(() => {
        try {
            const selectedIds = new Set((props.selectedItems || []).map(i => i.$id || i.id));
            const selectedCategories = new Set((props.selectedItems || []).map(i => (i.category || '').toLowerCase()).filter(Boolean));
            
            // Build meaningful seed tokens from BOTH user search query AND selected items!
            const seedQuery = workbenchQuery.value.trim().replace(/\bgit\b/g, 'gi');
            const seedTokens = extractMeaningfulTokens(seedQuery);
            const selectedItemTokens = (props.selectedItems || []).flatMap(i => extractMeaningfulTokens(i.title || ''));

            const candidates = (props.inventoryItems || []).filter(item => {
                const id = item.$id || item.id;
                return !selectedIds.has(id);
            });

            const scored = candidates.map(item => {
                let score = 0;
                let reason = '';
                const titleNorm = normalizeSearchText(item.title || '');
                const cat = (item.category || '').toLowerCase();
                const itemTokens = extractMeaningfulTokens(item.title || '');

                // 1. High-priority User Seed Query Boost (+15 per token)
                if (seedTokens.length > 0) {
                    const seedMatches = seedTokens.filter(t => titleNorm.includes(t));
                    if (seedMatches.length > 0) {
                        score += seedMatches.length * 15;
                        reason = `Matched seed: "${seedMatches.join(' ')}"`;
                    }
                }

                // 2. Franchise / token overlap with selected items (excluding stop words!)
                const matchedTokens = itemTokens.filter(t => selectedItemTokens.includes(t));
                if (matchedTokens.length > 0) {
                    score += matchedTokens.length * 5;
                    if (!reason) {
                        reason = `Shared franchise/theme: "${matchedTokens.slice(0, 2).join(' ')}"`;
                    }
                }

                // 3. Category synergy
                if (cat && selectedCategories.has(cat)) {
                    score += 2;
                    if (!reason) reason = `Same category: ${item.category}`;
                }

                // 4. Toy + Literature / Book Companion Synergy (e.g. GI Joe action figure + comic book)
                const isItemBook = /\b(book|paperback|hardcover|comic|novel|guide|manual)\b/i.test(titleNorm);
                const isSelectedToyOrGame = (props.selectedItems || []).some(i => 
                    /\b(toy|figure|aircraft|vehicle|hasbro|kenner|action figure|playset)\b/i.test(normalizeSearchText(i.title || ''))
                );
                if (isItemBook && isSelectedToyOrGame) {
                    if (matchedTokens.includes('gi') || matchedTokens.includes('joe') || matchedTokens.includes('hasbro') || (seedTokens.length > 0 && score >= 15)) {
                        score += 8;
                        if (!reason.includes('seed')) {
                            reason = `Companion set: Action figure toy + collector book`;
                        }
                    }
                }

                return {
                    id: item.$id || item.id,
                    title: item.title,
                    price: Number(item.boutiquePrice || item.resalePrice || item.price || 0),
                    reason: reason || 'Catalog companion candidate',
                    score,
                    rawItem: item
                };
            });

            scored.sort((a, b) => b.score - a.score);
            // Require score >= 3 so pure unrelated garbage never surfaces
            trayAiMatches.value = scored.filter(s => s.score >= 3).slice(0, 4);
        } finally {
            loadingTrayAi.value = false;
        }
    }, 250);
};

const openBundleSubView = () => {
    bundleForm.title = '';
    bundleForm.description = '';
    bundleForm.estHigh = '';
    workbenchQuery.value = '';
    trayAiMatches.value = [];
    const loc = props.selectedItems?.[0]?.storageLocation;
    if (loc && props.selectedItems.every(i => i.storageLocation === loc)) {
        bundleForm.storageLocation = loc;
    } else {
        bundleForm.storageLocation = '';
    }
    currentSubView.value = 'bundle';

    // Automatically trigger companion synergy matching on open!
    if (props.selectedItems && props.selectedItems.length > 0) {
        runTrayAiMatches();
    }
};

const handleConfirmBundle = () => {
    if (!bundleForm.title || props.selectedItems.length < 2) return;
    emit('submit-bundle', {
        items: props.selectedItems,
        title: bundleForm.title,
        description: bundleForm.description,
        estHigh: Number(bundleForm.estHigh) || 0,
        storageLocation: bundleForm.storageLocation
    });
    currentSubView.value = 'main';
};

// -------------------------------------------------------------
// COMBINE STATE & ACTIONS
// -------------------------------------------------------------
const combineTitle = ref('');
const combineTitleSuggestions = ref([]);
const combineMode = ref('create_new'); // 'create_new' | 'add_to_existing'

const existingLotInSelection = computed(() => {
    return props.selectedItems.find(i => isLotItem(i));
});

const combineCost = computed(() => {
    if (!props.selectedItems) return 0;
    return props.selectedItems.reduce((sum, i) => sum + (parseFloat(i.cost) || 0), 0);
});

const combineTotalUnits = computed(() => {
    if (!props.selectedItems) return 0;
    return props.selectedItems.reduce((sum, i) => sum + (parseInt(i.quantity) || 1), 0);
});

const openCombineSubView = () => {
    if (existingLotInSelection.value) {
        combineMode.value = 'add_to_existing';
    } else {
        combineMode.value = 'create_new';
    }
    workbenchQuery.value = '';
    trayAiMatches.value = [];
    if (props.selectedItems && props.selectedItems.length > 0) {
        const { defaultTitle, suggestions } = generateSmartLotTitle(props.selectedItems, combineTotalUnits.value);
        combineTitle.value = defaultTitle;
        combineTitleSuggestions.value = suggestions;
    } else {
        combineTitle.value = '';
        combineTitleSuggestions.value = [];
    }
    currentSubView.value = 'combine';

    // Auto-run AI matching for batch candidates
    if (props.selectedItems && props.selectedItems.length > 0) {
        runTrayAiMatches();
    }
};

const handleConfirmCombine = () => {
    emit('submit-combine', {
        items: props.selectedItems,
        title: combineTitle.value,
        mode: combineMode.value,
        targetLot: existingLotInSelection.value
    });
    currentSubView.value = 'main';
};

// -------------------------------------------------------------
// SPLIT & ROLLBACK ACTIONS
// -------------------------------------------------------------
const handleConfirmSplit = () => {
    if (props.selectedItems.length === 0) return;
    emit('uncombine-lot', props.selectedItems[0]);
    currentSubView.value = 'main';
};

// -------------------------------------------------------------
// STANDARD BATCH CONTROLS
// -------------------------------------------------------------
const selectedWarehouse = ref('');
const customBin = ref('');
const customRawLocation = ref('');
const targetStatus = ref('');
const targetChannel = ref('');
const isConfirmModalOpen = ref(false);
const clearSelectionAfterApply = ref(false);
const isConfirmingDelete = ref(false);

const availableChannelList = computed(() => {
    if (props.channels && props.channels.length > 0) {
        return props.channels;
    }
    return ['Ricochet', 'DustyTiger', 'eBay', 'Poshmark', 'Backstock'];
});

const computedLocationPreview = computed(() => {
    if (!selectedWarehouse.value) return '';
    if (selectedWarehouse.value === '__custom__') {
        return customRawLocation.value.trim();
    }
    const wh = selectedWarehouse.value;
    const bin = customBin.value.trim().toUpperCase().replace(/^[-_\s]+/, '');
    if (!bin) return wh;
    return `${wh}-${bin}`;
});

const configuredChangesCount = computed(() => {
    let c = 0;
    if (computedLocationPreview.value) c++;
    if (targetStatus.value) c++;
    if (targetChannel.value) c++;
    return c;
});

const openConfirmationModal = () => {
    if (props.selectedCount === 0 || configuredChangesCount.value === 0) return;
    isConfirmModalOpen.value = true;
};

const executeUnifiedApply = () => {
    isConfirmModalOpen.value = false;
    const updates = {};
    if (computedLocationPreview.value) {
        updates.storageLocation = computedLocationPreview.value;
    }
    if (targetStatus.value) {
        updates.status = targetStatus.value;
    }
    if (targetChannel.value) {
        updates.channel = targetChannel.value;
        updates.sellingLocations = [targetChannel.value];
    }
    
    emit('apply-bulk-unified', {
        itemIds: props.selectedItems.map(i => i.$id),
        updates,
        clearSelection: clearSelectionAfterApply.value
    });

    selectedWarehouse.value = '';
    customBin.value = '';
    customRawLocation.value = '';
    targetStatus.value = '';
    targetChannel.value = '';
};

const statusOptions = [
    { value: 'active', label: 'Active Stock' },
    { value: 'all', label: 'All Statuses' },
    { value: 'acquired', label: 'Acquired' },
    { value: 'received', label: 'Received' },
    { value: 'placed', label: 'Placed' },
    { value: 'sold', label: 'Sold' },
    { value: 'combined', label: 'Combined' }
];

const selectedTotalRetail = computed(() => {
    if (!props.selectedItems || props.selectedItems.length === 0) return 0;
    return props.selectedItems.reduce((sum, item) => {
        const p = Number(item.boutiquePrice || item.resalePrice || item.price || 0);
        return sum + p;
    }, 0);
});

// Dynamic Header Title & Subtitle based on Sub-View
const headerTitle = computed(() => {
    if (props.activeTab === 'actions') {
        if (currentSubView.value === 'restock') return 'Restock Multi-Quantity Batch';
        if (currentSubView.value === 'bundle') return 'Create Companion Bundle';
        if (currentSubView.value === 'combine') return 'Combine into Main Lot';
        if (currentSubView.value === 'split') return 'Split & Deconstruct Lot';
        return props.selectedCount > 0 ? `Selected Items (${props.selectedCount})` : 'Bulk Actions & Selections';
    }
    if (props.activeTab === 'filters') {
        return 'Filters & View Options';
    }
    return 'Add & Ingest Inventory';
});

const headerSubtitle = computed(() => {
    if (props.activeTab === 'actions') {
        if (currentSubView.value === 'restock') return 'Add units to crate & recalculate average cost basis';
        if (currentSubView.value === 'bundle') return `Curate ${props.selectedCount} companion items into an elevated set`;
        if (currentSubView.value === 'combine') return `Merge ${props.selectedCount} like-with-like items into volume lot`;
        if (currentSubView.value === 'split') return 'Decompose into profit tiers, quick-split 1 unit, or rollback lot';
        return props.selectedCount > 0 ? 'Curate selection or run bulk operations' : 'Select items in catalog to move locations or set status';
    }
    if (props.activeTab === 'filters') {
        return 'Refine catalog by status, storage location, or tags';
    }
    return 'Scout AI scan, manual item drawer & CSV spreadsheet import';
});

const headerIcon = computed(() => {
    if (props.activeTab === 'actions') {
        if (currentSubView.value === 'restock') return 'solar:box-minimalistic-bold';
        if (currentSubView.value === 'bundle') return 'solar:gift-bold';
        if (currentSubView.value === 'combine') return 'solar:layers-bold';
        if (currentSubView.value === 'split') return 'solar:scissors-square-bold';
        return 'solar:checklist-minimalistic-bold';
    }
    if (props.activeTab === 'filters') return 'solar:tuning-square-2-bold-duotone';
    return 'solar:add-circle-bold';
});

const handleScoutQuickAdd = () => {
    closeTray();
    emit('scout-quick-add');
    if (typeof window !== 'undefined') {
        window.location.href = '/scout?quick=true';
    }
};

const handleOpenAddDrawer = () => {
    closeTray();
    emit('open-add-drawer');
};

const handleImportCsv = () => {
    closeTray();
    emit('import-csv');
};

const confirmDelete = () => {
    isConfirmingDelete.value = false;
    closeTray();
    emit('delete');
};

defineExpose({
    openBundle: openBundleSubView,
    openBundleSubView,
    openCombine: openCombineSubView,
    openCombineSubView,
    openRestock: openRestockSubView,
    openRestockSubView,
    openSplit: openSplitSubView,
    openSplitSubView,
    closeTray,
    currentSubView
});
</script>

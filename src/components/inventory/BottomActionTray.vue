<template>
    <div v-if="isOpen" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end transition-opacity" @click.self="closeTray">
        <div 
            class="bg-base-100 border-t border-base-300 rounded-t-box max-w-2xl mx-auto w-full h-[78vh] sm:h-[650px] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-250 select-none"
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
                        <!-- Selected Target Item Card -->
                        <div class="p-3 rounded-box border border-base-300 bg-base-200/50 flex items-center gap-3">
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
                                <h4 class="font-bold text-xs text-base-content truncate mt-0.5">
                                    {{ selectedItems[0].title || 'Untitled Item' }}
                                </h4>
                                <div class="text-[10px] font-mono opacity-70 mt-0.5">
                                    Current Basis: <strong>${{ currentCost.toFixed(2) }}</strong> (${{ currentUnitCost.toFixed(2) }}/ea)
                                </div>
                            </div>
                        </div>

                        <!-- Restock Form Inputs -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        <button 
                            type="button" 
                            class="btn btn-primary text-primary-content btn-sm font-black px-6 shadow-md border border-primary-content/25 active:scale-95 transition-all gap-1.5"
                            @click="handleConfirmRestock"
                            :disabled="!restockUnits || restockUnits < 1 || isProcessing"
                        >
                            <Icon icon="solar:check-circle-bold" class="w-4 h-4" />
                            <span>Confirm Restock (+{{ restockUnits || 0 }} Units)</span>
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
                            <div class="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                <div 
                                    v-for="item in selectedItems" 
                                    :key="item.$id"
                                    class="flex items-center justify-between text-xs bg-base-100 p-1.5 px-2.5 rounded-box border border-base-200"
                                >
                                    <span class="truncate font-medium flex-1 pr-2">{{ item.title }}</span>
                                    <span class="font-mono font-bold opacity-75 shrink-0">${{ (Number(item.cost) || 0).toFixed(2) }}</span>
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
                <!-- SUB-VIEW 3: COMBINE SUB-PANEL (In-Tray Volume Lot)            -->
                <!-- ------------------------------------------------------------- -->
                <div v-else-if="currentSubView === 'combine'" class="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div class="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
                        <!-- Mode Switcher (if an existing lot is detected) -->
                        <div v-if="existingLotInSelection" class="p-2.5 rounded-box border border-base-300 bg-base-200/50 space-y-1.5">
                            <label class="text-[10px] font-bold uppercase tracking-wider opacity-70">Combine Strategy</label>
                            <div class="flex gap-2">
                                <label class="label cursor-pointer gap-2 py-0">
                                    <input type="radio" value="add_to_existing" v-model="combineMode" class="radio radio-xs radio-primary" />
                                    <span class="label-text text-xs">Add into Existing Lot</span>
                                </label>
                                <label class="label cursor-pointer gap-2 py-0">
                                    <input type="radio" value="create_new" v-model="combineMode" class="radio radio-xs radio-primary" />
                                    <span class="label-text text-xs">Create Brand New Lot</span>
                                </label>
                            </div>
                        </div>

                        <!-- Combined Items Summary -->
                        <div class="p-3 rounded-box border border-base-300 bg-base-200/50 space-y-2">
                            <div class="flex items-center justify-between font-bold text-[10px] uppercase opacity-60">
                                <span>{{ selectedCount }} Items to Combine</span>
                                <span class="font-mono">Combined Cost: ${{ combineCost.toFixed(2) }}</span>
                            </div>
                            <div class="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                                <div 
                                    v-for="item in selectedItems" 
                                    :key="item.$id"
                                    class="flex items-center justify-between text-xs bg-base-100 p-1.5 px-2.5 rounded-box border border-base-200"
                                >
                                    <span class="truncate font-medium flex-1 pr-2">{{ item.title }}</span>
                                    <span class="font-mono font-bold opacity-75 shrink-0">${{ (Number(item.cost) || 0).toFixed(2) }}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Title Input & Smart Suggestions -->
                        <div v-if="combineMode === 'create_new'" class="space-y-2">
                            <div class="space-y-1">
                                <label class="text-[10px] font-bold uppercase tracking-wider text-base-content/70">Main Lot Title</label>
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
                            <span class="font-bold text-info">Destination Lot:</span>
                            <strong class="ml-1">{{ existingLotInSelection?.title }}</strong>
                        </div>
                    </div>

                    <!-- Combine Action Dock -->
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
                            <span>{{ combineMode === 'create_new' ? 'Create Main Lot' : 'Merge into Lot' }}</span>
                        </button>
                    </div>
                </div>

                <!-- ------------------------------------------------------------- -->
                <!-- SUB-VIEW 4: SPLIT / ROLLBACK SUB-PANEL                        -->
                <!-- ------------------------------------------------------------- -->
                <div v-else-if="currentSubView === 'split' && selectedItems.length > 0" class="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div class="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                        <!-- Selected Lot Card -->
                        <div class="p-3 rounded-box border border-base-300 bg-base-200/50 flex items-center gap-3">
                            <ItemThumbnail :item="selectedItems[0]" size="md" class="w-12 h-12 pointer-events-none rounded-box shrink-0" />
                            <div class="min-w-0 flex-1">
                                <span class="badge badge-xs badge-warning font-bold uppercase">Main Lot</span>
                                <h4 class="font-bold text-xs text-base-content truncate mt-0.5">
                                    {{ selectedItems[0].title }}
                                </h4>
                                <div class="text-[10px] font-mono opacity-70 mt-0.5">
                                    Quantity: {{ selectedItems[0].quantity || 1 }} • Cost: ${{ (Number(selectedItems[0].cost) || 0).toFixed(2) }}
                                </div>
                            </div>
                        </div>

                        <!-- Rollback Explanation -->
                        <div class="alert alert-warning/20 border border-warning/40 p-3 rounded-box text-xs space-y-1">
                            <div class="font-bold flex items-center gap-1.5 text-warning">
                                <Icon icon="solar:danger-triangle-bold" class="w-4 h-4" />
                                <span>Uncombine & Rollback Confirmation</span>
                            </div>
                            <p class="text-base-content/80 text-[11px] leading-relaxed">
                                Uncombining will deconstruct this lot, return all constituent child records back into active individual inventory, and delete this combined parent record.
                            </p>
                        </div>
                    </div>

                    <!-- Split Action Dock -->
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
                            class="btn btn-error text-error-content btn-sm font-black px-6 shadow-md border border-error-content/25 active:scale-95 transition-all gap-1.5"
                            @click="handleConfirmSplit"
                        >
                            <Icon icon="solar:restart-bold" class="w-4 h-4" />
                            <span>Confirm Rollback</span>
                        </button>
                    </div>
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
                            <button 
                                type="button" 
                                class="btn btn-xs btn-outline btn-primary font-bold gap-1 mt-1 shadow-2xs"
                                @click="$emit('select-all')"
                            >
                                <Icon icon="solar:check-square-bold" class="w-3.5 h-3.5" />
                                <span>Select All ({{ totalItems }})</span>
                            </button>
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

                        <!-- MERCHANDISING ROW (RESTOCK, BUNDLE, COMBINE, SPLIT, EXPORT, DELETE) -->
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-0.5">
                            <!-- Scenario A: Exactly 1 item selected -> Show Restock + Combine/Split -->
                            <template v-if="selectedCount === 1">
                                <!-- Restock Units Trigger -->
                                <button 
                                    type="button" 
                                    class="btn btn-xs sm:btn-sm btn-primary text-primary-content font-black gap-1 h-9 justify-center shadow-xs active:scale-95"
                                    @click="openRestockSubView"
                                    title="Restock units into this crate/item"
                                >
                                    <Icon icon="solar:box-minimalistic-bold" class="w-3.5 h-3.5" />
                                    <span class="truncate">Restock Units</span>
                                </button>

                                <!-- Split / Rollback if lot -->
                                <button 
                                    v-if="isLotItem(selectedItems[0])"
                                    type="button" 
                                    class="btn btn-xs sm:btn-sm btn-outline border-warning/50 text-warning hover:bg-warning/15 font-bold gap-1 h-9 justify-center"
                                    @click="currentSubView = 'split'"
                                    title="Rollback or deconstruct this lot"
                                >
                                    <Icon icon="solar:restart-bold" class="w-3.5 h-3.5" />
                                    <span class="truncate">Rollback Lot</span>
                                </button>

                                <!-- Combine into another lot -->
                                <button 
                                    v-else
                                    type="button" 
                                    class="btn btn-xs sm:btn-sm btn-outline border-base-300 hover:border-info hover:bg-info/10 font-bold gap-1 h-9 justify-center"
                                    @click="openCombineSubView"
                                    title="Combine into existing lot"
                                >
                                    <Icon icon="solar:layers-bold" class="w-3.5 h-3.5 text-info" />
                                    <span class="truncate">Combine</span>
                                </button>
                            </template>

                            <!-- Scenario B: 2+ items selected -> Show Combine + Bundle -->
                            <template v-else>
                                <!-- Combine (Like-with-Like) -->
                                <button 
                                    type="button" 
                                    class="btn btn-xs sm:btn-sm btn-outline border-base-300 hover:border-info hover:bg-info/10 font-bold gap-1 h-9 justify-center"
                                    :disabled="selectedCount < 2"
                                    @click="openCombineSubView"
                                    title="Combine selected items into new volume lot"
                                >
                                    <Icon icon="solar:layers-bold" class="w-3.5 h-3.5 text-info" />
                                    <span class="truncate">Combine ({{ selectedCount }})</span>
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
import { useManifest } from '../../composables/useManifest';
import { useItemDrawer } from '../../composables/useItemDrawer';
import { generateSmartLotTitle } from '../../lib/lotTitleGenerator';

const { isActionTrayOpen, activeManifest, stagedCount, openManifestTray } = useManifest();
const { openItemDrawer } = useItemDrawer();

// Merchandising In-Tray Sub-View Navigation
const currentSubView = ref('main'); // 'main' | 'restock' | 'bundle' | 'combine' | 'split'

const closeTray = () => {
    currentSubView.value = 'main';
    isActionTrayOpen.value = false;
    emit('update:isOpen', false);
};

const handleOpenDropTray = () => {
    closeTray();
    openManifestTray();
};

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
    'unselect-item',
    'clear-selection',
    'reset-filters',
    'stage-manifest',
    'restock-item',
    'submit-bundle',
    'submit-combine',
    'uncombine-lot'
]);

// Reset subview when tray closes or active tab changes
watch(() => props.isOpen, (open) => {
    if (!open) currentSubView.value = 'main';
});
watch(() => props.activeTab, () => {
    currentSubView.value = 'main';
});
watch(() => props.selectedCount, (count) => {
    if (count === 0 && currentSubView.value !== 'main') {
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

const openRestockSubView = () => {
    if (props.selectedCount !== 1) return;
    restockUnits.value = 10;
    restockCost.value = 0;
    currentSubView.value = 'restock';
};

const handleConfirmRestock = () => {
    if (!restockUnits.value || restockUnits.value < 1 || props.selectedItems.length === 0) return;
    emit('restock-item', {
        item: props.selectedItems[0],
        unitsToAdd: Number(restockUnits.value),
        addedCostBasis: Number(restockCost.value || 0)
    });
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

const openBundleSubView = () => {
    bundleForm.title = '';
    bundleForm.description = '';
    bundleForm.estHigh = '';
    const loc = props.selectedItems[0]?.storageLocation;
    if (loc && props.selectedItems.every(i => i.storageLocation === loc)) {
        bundleForm.storageLocation = loc;
    } else {
        bundleForm.storageLocation = '';
    }
    currentSubView.value = 'bundle';
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
    if (props.selectedItems.length < 1) return;
    if (existingLotInSelection.value) {
        combineMode.value = 'add_to_existing';
    } else {
        combineMode.value = 'create_new';
    }
    const { defaultTitle, suggestions } = generateSmartLotTitle(props.selectedItems, combineTotalUnits.value);
    combineTitle.value = defaultTitle;
    combineTitleSuggestions.value = suggestions;
    currentSubView.value = 'combine';
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
        if (currentSubView.value === 'split') return 'Rollback / Deconstruct Lot';
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
        if (currentSubView.value === 'split') return 'Restore constituent items back into active individual inventory';
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
</script>

<template>
    <div v-if="isOpen" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end transition-opacity" @click.self="closeTray">
        <div 
            class="bg-base-100 border-t border-base-300 rounded-t-3xl max-w-2xl mx-auto w-full h-[78vh] sm:h-[650px] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-250 select-none"
        >
            <!-- Top Drag Handle Affordance -->
            <div class="w-12 h-1.5 bg-base-content/20 rounded-full mx-auto mt-2.5 mb-1 shrink-0"></div>

            <!-- Drawer Header with Tab Navigation -->
            <div class="px-4 py-2.5 border-b border-base-300 flex items-center justify-between gap-3 shrink-0">
                <div class="flex items-center gap-2 min-w-0">
                    <div class="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
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

                <!-- Close Button -->
                <button 
                    type="button" 
                    @click="closeTray" 
                    class="btn btn-ghost btn-sm btn-circle shrink-0" 
                    title="Close Tray"
                >
                    <Icon icon="solar:close-circle-bold" class="w-5 h-5 opacity-60 hover:opacity-100" />
                </button>
            </div>

            <!-- Segmented Tab Switcher -->
            <div class="px-4 pt-2.5 pb-1 shrink-0">
                <div class="grid grid-cols-3 bg-base-200/90 p-1 rounded-xl border border-base-300 text-xs font-bold gap-1">
                    <!-- Tab 1: Actions & Bulk Ops -->
                    <button 
                        type="button" 
                        class="btn btn-xs sm:btn-sm rounded-lg border-0 transition-all font-bold gap-1.5"
                        :class="activeTab === 'actions' ? 'btn-warning text-warning-content shadow-xs' : 'btn-ghost text-base-content/70 hover:bg-base-300/50'"
                        @click="setTab('actions')"
                    >
                        <Icon icon="solar:bolt-bold" class="w-3.5 h-3.5" />
                        <span>Actions</span>
                        <span class="badge badge-xs badge-neutral font-mono font-bold">{{ selectedCount }}</span>
                    </button>

                    <!-- Tab 2: Add & Ingest -->
                    <button 
                        type="button" 
                        class="btn btn-xs sm:btn-sm rounded-lg border-0 transition-all font-bold gap-1.5"
                        :class="activeTab === 'add-prep' ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost text-base-content/70 hover:bg-base-300/50'"
                        @click="setTab('add-prep')"
                    >
                        <Icon icon="solar:add-circle-bold" class="w-3.5 h-3.5" />
                        <span>Add & Ingest</span>
                    </button>

                    <!-- Tab 3: Filters -->
                    <button 
                        type="button" 
                        class="btn btn-xs sm:btn-sm rounded-lg border-0 transition-all font-bold gap-1.5"
                        :class="activeTab === 'filters' ? 'btn-neutral text-neutral-content shadow-xs' : 'btn-ghost text-base-content/70 hover:bg-base-300/50'"
                        @click="setTab('filters')"
                    >
                        <Icon icon="solar:tuning-square-2-bold-duotone" class="w-3.5 h-3.5 text-primary" />
                        <span>Filters</span>
                        <span v-if="activeFilterCount > 0" class="badge badge-xs badge-primary font-bold">{{ activeFilterCount }}</span>
                    </button>
                </div>
            </div>

            <!-- ============================================================= -->
            <!-- TAB 1: BULK ACTIONS TRAY (Operating on Current Records)        -->
            <!-- ============================================================= -->
            <div v-show="activeTab === 'actions'" class="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div class="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin text-xs">
                    <!-- If 0 items selected -->
                    <div v-if="selectedCount === 0" class="text-center py-8 text-base-content/50 space-y-2">
                        <Icon icon="solar:bolt-linear" class="w-10 h-10 mx-auto opacity-30" />
                        <p class="font-bold text-sm">No records currently selected.</p>
                        <p class="text-[11px] max-w-xs mx-auto">
                            Check items in your catalog to perform bulk operations: bundling, combining, relocations, status transitions, channel exporting, or deleting.
                        </p>
                    </div>

                    <!-- If items are selected -->
                    <div v-else class="space-y-4">
                        <!-- SECTION A: BUNDLING & COMBINING (Lot Merchandising Operations) -->
                        <div class="bg-base-200/50 p-3 rounded-2xl border border-base-300 space-y-2">
                            <div class="flex items-center justify-between">
                                <span class="font-black text-xs text-base-content flex items-center gap-1.5">
                                    <Icon icon="solar:box-minimalistic-bold" class="w-3.5 h-3.5 text-accent" />
                                    <span>Bundling & Combining</span>
                                </span>
                                <span class="text-[10px] font-mono text-base-content/60">{{ selectedCount }} selected</span>
                            </div>

                            <div class="grid grid-cols-2 gap-2">
                                <!-- Bundle into Lot Button -->
                                <button 
                                    type="button" 
                                    class="btn btn-xs sm:btn-sm btn-outline btn-accent font-bold rounded-xl gap-1.5 h-10 justify-center"
                                    :disabled="selectedCount < 2"
                                    @click="handleBundle"
                                    :title="selectedCount < 2 ? 'Select at least 2 items to bundle' : 'Bundle selected items into new lot'"
                                >
                                    <Icon icon="solar:box-minimalistic-bold" class="w-4 h-4" />
                                    <span>Bundle ({{ selectedCount }})</span>
                                </button>

                                <!-- Combine into Lot Button -->
                                <button 
                                    type="button" 
                                    class="btn btn-xs sm:btn-sm btn-outline btn-info font-bold rounded-xl gap-1.5 h-10 justify-center"
                                    :disabled="selectedCount < 1"
                                    @click="handleCombine"
                                    :title="selectedCount < 1 ? 'Select at least 1 item to combine' : 'Combine into existing lot'"
                                >
                                    <Icon icon="solar:layers-bold" class="w-4 h-4" />
                                    <span>Combine ({{ selectedCount }})</span>
                                </button>
                            </div>
                        </div>

                        <!-- SECTION B: LOCATION MOVE -->
                        <div class="bg-base-200/70 p-3 rounded-2xl border border-base-300 space-y-2">
                            <label class="font-black text-xs text-base-content flex items-center gap-1.5">
                                <Icon icon="solar:map-point-bold" class="w-3.5 h-3.5 text-primary" />
                                <span>Move Location ({{ selectedCount }} Records)</span>
                            </label>
                            <div class="flex items-center gap-2">
                                <select v-model="targetLocation" class="select select-sm select-bordered flex-1 bg-base-100 text-xs font-bold rounded-xl">
                                    <option value="" disabled selected>Select destination location...</option>
                                    <option v-for="loc in locations" :key="loc" :value="loc">{{ loc }}</option>
                                </select>
                                <button 
                                    type="button" 
                                    class="btn btn-sm btn-primary text-primary-content font-bold px-4 rounded-xl shrink-0"
                                    :disabled="!targetLocation || isProcessing"
                                    @click="onApplyLocation"
                                >
                                    Apply
                                </button>
                            </div>
                        </div>

                        <!-- SECTION C: STATUS PIPELINE UPDATE -->
                        <div class="bg-base-200/70 p-3 rounded-2xl border border-base-300 space-y-2">
                            <label class="font-black text-xs text-base-content flex items-center gap-1.5">
                                <Icon icon="solar:check-circle-bold" class="w-3.5 h-3.5 text-secondary" />
                                <span>Set Pipeline Status ({{ selectedCount }} Records)</span>
                            </label>
                            <div class="flex items-center gap-2">
                                <select v-model="targetStatus" class="select select-sm select-bordered flex-1 bg-base-100 text-xs font-bold rounded-xl">
                                    <option value="" disabled selected>Select new status...</option>
                                    <option value="acquired">Acquired</option>
                                    <option value="received">Received</option>
                                    <option value="placed">Placed</option>
                                    <option value="sold">Sold</option>
                                </select>
                                <button 
                                    type="button" 
                                    class="btn btn-sm btn-secondary text-secondary-content font-bold px-4 rounded-xl shrink-0"
                                    :disabled="!targetStatus || isProcessing"
                                    @click="onApplyStatus"
                                >
                                    Apply
                                </button>
                            </div>
                        </div>

                        <!-- SECTION D: CHANNEL EXPORTS -->
                        <div class="space-y-1.5">
                            <div class="text-[10px] uppercase font-bold tracking-wider text-base-content/60 px-1">
                                Export Selected Records
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <button 
                                    type="button" 
                                    class="btn btn-sm btn-outline border-base-300 hover:border-success hover:bg-success/10 font-bold rounded-xl justify-start gap-2 h-10"
                                    @click="$emit('export', 'ricochet')"
                                >
                                    <Icon icon="solar:shop-2-bold" class="w-4 h-4 text-success" />
                                    <span class="truncate">Memory Den</span>
                                </button>
                                <button 
                                    type="button" 
                                    class="btn btn-sm btn-outline border-base-300 hover:border-primary hover:bg-primary/10 font-bold rounded-xl justify-start gap-2 h-10"
                                    @click="$emit('export', 'ebay')"
                                >
                                    <Icon icon="solar:bag-bold" class="w-4 h-4 text-primary" />
                                    <span class="truncate">eBay Hub</span>
                                </button>
                                <button 
                                    type="button" 
                                    class="btn btn-sm btn-outline border-base-300 hover:border-secondary hover:bg-secondary/10 font-bold rounded-xl justify-start gap-2 h-10"
                                    @click="$emit('export', 'poshmark')"
                                >
                                    <Icon icon="solar:tag-bold" class="w-4 h-4 text-secondary" />
                                    <span class="truncate">Poshmark</span>
                                </button>
                                <button 
                                    type="button" 
                                    class="btn btn-sm btn-outline border-base-300 hover:border-neutral font-bold rounded-xl justify-start gap-2 h-10"
                                    @click="$emit('export', 'generic')"
                                >
                                    <Icon icon="solar:file-download-bold" class="w-4 h-4 text-base-content/70" />
                                    <span class="truncate">Generic CSV</span>
                                </button>
                            </div>
                        </div>

                        <!-- SECTION E: DANGER ZONE (BULK DELETION) -->
                        <div class="bg-error/10 border border-error/20 p-3 rounded-2xl space-y-2">
                            <div class="flex items-center justify-between">
                                <span class="font-black text-xs text-error flex items-center gap-1.5">
                                    <Icon icon="solar:trash-bin-trash-bold" class="w-3.5 h-3.5" />
                                    <span>Danger Zone</span>
                                </span>
                                <span class="text-[10px] font-mono text-error/80">Permanent Action</span>
                            </div>
                            <div class="flex items-center justify-between gap-3">
                                <p class="text-[11px] text-base-content/70">
                                    Permanently remove all {{ selectedCount }} selected records from database.
                                </p>
                                <button 
                                    type="button" 
                                    class="btn btn-xs sm:btn-sm btn-error text-error-content font-bold px-3 rounded-xl shrink-0 gap-1"
                                    @click="isConfirmingDelete = true"
                                    :disabled="isProcessing"
                                >
                                    <Icon icon="solar:trash-bin-trash-bold" class="w-3.5 h-3.5" />
                                    <span>Delete ({{ selectedCount }})</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Sticky Actions Footer -->
                <div v-if="selectedCount > 0" class="p-3 border-t border-base-300 bg-base-200/90 backdrop-blur-md flex items-center justify-between gap-2 shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
                    <button 
                        type="button" 
                        class="btn btn-sm btn-ghost text-error font-bold" 
                        @click="$emit('clear-selection')"
                    >
                        Clear Selection
                    </button>
                    <button 
                        type="button" 
                        class="btn btn-sm btn-primary font-bold px-6 shadow-md text-primary-content rounded-xl"
                        @click="closeTray"
                    >
                        Done
                    </button>
                </div>
            </div>

            <!-- ============================================================= -->
            <!-- TAB 2: ADD & INGEST TRAY CONTENT                              -->
            <!-- ============================================================= -->
            <div v-show="activeTab === 'add-prep'" class="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 text-xs scrollbar-thin">
                <!-- Action 1: Scout Quick Add (Hero Card) -->
                <div class="bg-gradient-to-r from-primary/10 via-secondary/10 to-base-200/80 border border-primary/20 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                    <div class="flex items-start gap-3">
                        <div class="w-10 h-10 rounded-xl bg-primary text-primary-content flex items-center justify-center shrink-0 shadow-md">
                            <Icon icon="solar:camera-bold" class="w-5 h-5" />
                        </div>
                        <div>
                            <div class="flex items-center gap-1.5">
                                <h4 class="font-black text-sm text-base-content">Scout Quick Add</h4>
                                <span class="badge badge-xs badge-secondary font-bold">AI Fast Scan</span>
                            </div>
                            <p class="text-[11px] text-base-content/70 mt-0.5 max-w-sm">
                                High-speed camera intake, receipt OCR & instant AI deal valuation via Scout.
                            </p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        class="btn btn-sm btn-primary text-primary-content font-bold px-4 rounded-xl shadow-md gap-1.5 w-full sm:w-auto shrink-0 active:scale-95 transition-all"
                        @click="handleScoutQuickAdd"
                    >
                        <Icon icon="solar:bolt-bold" class="w-4 h-4" />
                        <span>Launch Scout</span>
                    </button>
                </div>

                <!-- Action 2: Add Item via ItemDrawer (Standard Manual Entry) -->
                <div class="bg-base-200/60 border border-base-300 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-primary/40 transition-all">
                    <div class="flex items-start gap-3">
                        <div class="w-10 h-10 rounded-xl bg-base-300 text-base-content flex items-center justify-center shrink-0">
                            <Icon icon="solar:pen-new-square-bold" class="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <div class="flex items-center gap-1.5">
                                <h4 class="font-black text-sm text-base-content">Add Item (Item Drawer)</h4>
                                <span class="badge badge-xs badge-ghost font-mono">Manual Entry</span>
                            </div>
                            <p class="text-[11px] text-base-content/70 mt-0.5 max-w-sm">
                                Open the complete ItemDrawer with full specs, purchase orders, pricing tiers, photo gallery & barcodes.
                            </p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        class="btn btn-sm btn-outline btn-primary font-bold px-4 rounded-xl gap-1.5 w-full sm:w-auto shrink-0 active:scale-95 transition-all"
                        @click="handleOpenAddDrawer"
                    >
                        <Icon icon="solar:widget-2-bold" class="w-4 h-4" />
                        <span>Open Item Drawer</span>
                    </button>
                </div>

                <!-- Action 3: Bulk Import CSV -->
                <div class="bg-base-200/60 border border-base-300 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-primary/40 transition-all">
                    <div class="flex items-start gap-3">
                        <div class="w-10 h-10 rounded-xl bg-base-300 text-base-content flex items-center justify-center shrink-0">
                            <Icon icon="solar:import-linear" class="w-5 h-5 text-success" />
                        </div>
                        <div>
                            <div class="flex items-center gap-1.5">
                                <h4 class="font-black text-sm text-base-content">Bulk Import CSV</h4>
                                <span class="badge badge-xs badge-ghost font-mono">Spreadsheet</span>
                            </div>
                            <p class="text-[11px] text-base-content/70 mt-0.5 max-w-sm">
                                Import full batches from ShopGoodwill, eBay, or generic CSV inventory exports.
                            </p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        class="btn btn-sm btn-outline btn-success font-bold px-4 rounded-xl gap-1.5 w-full sm:w-auto shrink-0 active:scale-95 transition-all"
                        @click="handleImportCsv"
                    >
                        <Icon icon="solar:import-linear" class="w-4 h-4" />
                        <span>Import CSV</span>
                    </button>
                </div>
            </div>

            <!-- ============================================================= -->
            <!-- TAB 3: FILTERS TRAY CONTENT                                   -->
            <!-- ============================================================= -->
            <div v-show="activeTab === 'filters'" class="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div class="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin text-xs">
                    <!-- Filters slot so caller can inject the rich Filter drawer content -->
                    <slot name="filters">
                        <!-- Built-in Clean Filters Content -->
                        <div class="space-y-4">
                            <!-- Status Pipeline Section -->
                            <div class="bg-base-200/70 p-3.5 rounded-2xl border border-base-300 space-y-2">
                                <label class="font-black text-xs text-base-content flex items-center justify-between">
                                    <span>Status Pipeline</span>
                                    <span class="text-[10px] font-mono opacity-60">Single Selection</span>
                                </label>
                                <div class="flex flex-wrap gap-1.5">
                                    <button 
                                        v-for="st in statusOptions" 
                                        :key="st.value"
                                        type="button"
                                        class="btn btn-xs rounded-lg font-bold gap-1 transition-all"
                                        :class="filterStatus === st.value ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost bg-base-100 hover:bg-base-300 text-base-content/80'"
                                        @click="$emit('update:filterStatus', st.value)"
                                    >
                                        <span>{{ st.label }}</span>
                                    </button>
                                </div>
                            </div>

                            <!-- Location Section -->
                            <div class="bg-base-200/70 p-3.5 rounded-2xl border border-base-300 space-y-2">
                                <label class="font-black text-xs text-base-content">
                                    Filter by Location
                                </label>
                                <select 
                                    :value="filterLocation" 
                                    @change="$emit('update:filterLocation', $event.target.value)"
                                    class="select select-sm select-bordered w-full bg-base-100 text-xs font-bold rounded-xl"
                                >
                                    <option value="all">All Locations</option>
                                    <option v-for="loc in locations" :key="loc" :value="loc">{{ loc }}</option>
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
                        class="btn btn-sm btn-primary font-bold px-6 shadow-md text-primary-content rounded-xl"
                        @click="closeTray"
                    >
                        Show Items
                    </button>
                </div>
            </div>

        </div>

        <!-- BULK DELETE CONFIRMATION MODAL -->
        <dialog class="modal modal-bottom sm:modal-middle z-[80]" :class="{ 'modal-open': isConfirmingDelete }">
            <div v-if="isConfirmingDelete" class="modal-box bg-base-100 border border-base-300 shadow-2xl rounded-3xl p-5 max-w-sm mx-auto">
                <div class="flex items-center gap-3 text-error mb-3">
                    <div class="w-10 h-10 rounded-2xl bg-error/15 flex items-center justify-center shrink-0">
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
                        class="btn btn-ghost flex-1 rounded-xl font-bold"
                    >
                        Cancel
                    </button>
                    <button 
                        type="button" 
                        @click="confirmDelete" 
                        class="btn btn-error flex-1 rounded-xl font-black text-error-content shadow-md gap-1.5"
                    >
                        <span>Yes, Delete All</span>
                    </button>
                </div>
            </div>
            <form method="dialog" class="modal-backdrop" @click="isConfirmingDelete = false">
                <button>close</button>
            </form>
        </dialog>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { Icon } from '@iconify/vue';

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
    isProcessing: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits([
    'update:isOpen',
    'update:activeTab',
    'update:filterStatus',
    'update:filterLocation',
    'scout-quick-add',
    'open-add-drawer',
    'import-csv',
    'combine',
    'bundle',
    'apply-location',
    'apply-status',
    'export',
    'delete',
    'clear-selection',
    'reset-filters'
]);

const targetLocation = ref('');
const targetStatus = ref('');
const isConfirmingDelete = ref(false);

const statusOptions = [
    { value: 'active', label: 'Active Stock' },
    { value: 'all', label: 'All Statuses' },
    { value: 'acquired', label: 'Acquired' },
    { value: 'received', label: 'Received' },
    { value: 'placed', label: 'Placed' },
    { value: 'sold', label: 'Sold' },
    { value: 'combined', label: 'Combined' }
];

const headerTitle = computed(() => {
    if (props.activeTab === 'actions') {
        return props.selectedCount > 0 ? `Actions (${props.selectedCount} Records)` : 'Bulk Actions';
    }
    if (props.activeTab === 'filters') {
        return 'Filters & View Options';
    }
    return 'Add & Ingest Inventory';
});

const headerSubtitle = computed(() => {
    if (props.activeTab === 'actions') {
        return 'Bundling, combining, locations, statuses, exports & deletions';
    }
    if (props.activeTab === 'filters') {
        return 'Refine catalog by status, storage location, or tags';
    }
    return 'Scout AI scan, manual item drawer & CSV spreadsheet import';
});

const headerIcon = computed(() => {
    if (props.activeTab === 'actions') return 'solar:bolt-bold';
    if (props.activeTab === 'filters') return 'solar:tuning-square-2-bold-duotone';
    return 'solar:add-circle-bold';
});

const setTab = (tab) => {
    emit('update:activeTab', tab);
};

const closeTray = () => {
    emit('update:isOpen', false);
};

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

const handleCombine = () => {
    closeTray();
    emit('combine');
};

const handleBundle = () => {
    closeTray();
    emit('bundle');
};

const onApplyLocation = () => {
    if (!targetLocation.value) return;
    emit('apply-location', targetLocation.value);
    targetLocation.value = '';
};

const onApplyStatus = () => {
    if (!targetStatus.value) return;
    emit('apply-status', targetStatus.value);
    targetStatus.value = '';
};

const confirmDelete = () => {
    isConfirmingDelete.value = false;
    closeTray();
    emit('delete');
};
</script>

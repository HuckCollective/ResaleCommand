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
            <!-- MAIN ACTIONS & SELECTION TRAY VIEW (Operating on Selected Records) -->
            <!-- ============================================================= -->
            <div v-show="activeTab === 'actions'" class="flex-1 flex flex-col min-h-0 overflow-hidden">
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
                    <button 
                        type="button" 
                        @click="handleOpenDropTray" 
                        class="btn btn-xs btn-primary text-primary-content font-bold h-6 min-h-6 px-2 rounded-lg shrink-0 gap-0.5"
                    >
                        <span>View Drop</span>
                        <Icon icon="solar:arrow-right-linear" class="w-3 h-3" />
                    </button>
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
                            class="btn btn-ghost btn-xs text-primary font-bold h-6 min-h-6 px-2"
                            @click="$emit('select-all')"
                            title="Select all filtered records"
                        >
                            Select All ({{ totalItems }})
                        </button>
                        <button 
                            v-if="selectedCount > 0"
                            type="button" 
                            class="btn btn-ghost btn-xs text-error font-bold h-6 min-h-6 px-2"
                            @click="$emit('clear-selection')"
                            title="Clear selection"
                        >
                            Clear
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
                            class="p-2.5 rounded-2xl border border-base-300 bg-base-200/40 hover:bg-base-200/80 transition-all flex items-center justify-between gap-3 group"
                        >
                            <!-- Thumbnail Image (tap to edit) -->
                            <div class="cursor-pointer shrink-0" @click="openItemDrawer(item)" title="Edit item in drawer">
                                <ItemThumbnail :item="item" size="md" rounded="xl" class="w-11 h-11 pointer-events-none" />
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
                        <div class="w-12 h-12 rounded-2xl bg-base-200 flex items-center justify-center mx-auto text-primary">
                            <Icon icon="solar:checklist-minimalistic-bold" class="w-6 h-6 opacity-60" />
                        </div>
                        <p class="font-bold text-xs sm:text-sm text-base-content">No Items Selected</p>
                        <p class="text-[11px] max-w-xs mx-auto text-base-content/70">
                            Check items in your catalog to stage them into a drop, move locations, set status, or bundle.
                        </p>
                        <button 
                            type="button" 
                            class="btn btn-xs btn-outline btn-primary font-bold rounded-xl gap-1 mt-1 shadow-2xs"
                            @click="$emit('select-all')"
                        >
                            <Icon icon="solar:check-square-bold" class="w-3.5 h-3.5" />
                            <span>Select All ({{ totalItems }})</span>
                        </button>
                    </div>
                </div>

                <!-- STACKED FOOTER DOCK (ALL BULK ACTIONS IN STACKED DOCK) -->
                <div class="border-t border-base-300 bg-base-100/95 backdrop-blur-md p-3 space-y-2 shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
                    <!-- STACK ROW 1: LOCATION & STATUS MOVERS -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-base-200/60 p-2.5 rounded-2xl border border-base-300/80">
                        <!-- Move Location -->
                        <div class="flex items-center gap-1.5">
                            <select v-model="selectedWarehouse" class="select select-xs select-bordered bg-base-100 text-xs font-bold rounded-lg flex-1 h-8 min-h-8">
                                <option value="HG">HG (Garage)</option>
                                <option value="HD">HD (Hideout)</option>
                                <option value="MD">MD (Memory Den)</option>
                                <option value="DT">DT (Dusty Tiger)</option>
                                <option value="__custom__">Custom...</option>
                            </select>
                            <input 
                                v-if="selectedWarehouse !== '__custom__'"
                                type="text" 
                                v-model="customBin" 
                                placeholder="Bin..." 
                                class="input input-xs input-bordered bg-base-100 text-xs font-mono font-bold uppercase rounded-lg w-20 h-8 min-h-8"
                            />
                            <input 
                                v-else
                                type="text" 
                                v-model="customRawLocation" 
                                placeholder="Location..." 
                                class="input input-xs input-bordered bg-base-100 text-xs font-bold rounded-lg w-24 h-8 min-h-8"
                            />
                            <button 
                                type="button" 
                                class="btn btn-xs btn-primary text-primary-content font-bold rounded-lg h-8 min-h-8 px-2.5 shrink-0"
                                :disabled="selectedCount === 0 || !computedLocationPreview || isProcessing"
                                @click="onApplyLocation"
                                title="Apply new location to selected records"
                            >
                                Move
                            </button>
                        </div>

                        <!-- Set Status -->
                        <div class="flex items-center gap-1.5">
                            <select v-model="targetStatus" class="select select-xs select-bordered bg-base-100 text-xs font-bold rounded-lg flex-1 h-8 min-h-8">
                                <option value="" disabled selected>Select status...</option>
                                <option value="active">Active Stock</option>
                                <option value="acquired">Acquired</option>
                                <option value="received">Received</option>
                                <option value="placed">Placed</option>
                                <option value="sold">Sold</option>
                            </select>
                            <button 
                                type="button" 
                                class="btn btn-xs btn-secondary text-secondary-content font-bold rounded-lg h-8 min-h-8 px-2.5 shrink-0"
                                :disabled="selectedCount === 0 || !targetStatus || isProcessing"
                                @click="onApplyStatus"
                                title="Apply new pipeline status to selected records"
                            >
                                Set Status
                            </button>
                        </div>
                    </div>

                    <!-- STACK ROW 3: BUNDLE, COMBINE, GENERIC CSV EXPORT & DELETE -->
                    <div class="grid grid-cols-4 gap-1.5 pt-0.5">
                        <!-- Bundle -->
                        <button 
                            type="button" 
                            class="btn btn-xs sm:btn-sm btn-outline border-base-300 hover:border-accent hover:bg-accent/10 font-bold rounded-xl gap-1 h-9 justify-center"
                            :disabled="selectedCount < 2"
                            @click="handleBundle"
                            title="Bundle selected items into new lot"
                        >
                            <Icon icon="solar:box-minimalistic-bold" class="w-3.5 h-3.5 text-accent" />
                            <span class="truncate">Bundle</span>
                        </button>

                        <!-- Combine -->
                        <button 
                            type="button" 
                            class="btn btn-xs sm:btn-sm btn-outline border-base-300 hover:border-info hover:bg-info/10 font-bold rounded-xl gap-1 h-9 justify-center"
                            :disabled="selectedCount < 1"
                            @click="handleCombine"
                            title="Combine into existing lot"
                        >
                            <Icon icon="solar:layers-bold" class="w-3.5 h-3.5 text-info" />
                            <span class="truncate">Combine</span>
                        </button>

                        <!-- Generic CSV Export -->
                        <button 
                            type="button" 
                            class="btn btn-xs sm:btn-sm btn-outline border-base-300 hover:border-success hover:bg-success/10 font-bold rounded-xl gap-1 h-9 justify-center"
                            @click="$emit('export', 'generic')"
                            :title="selectedCount > 0 ? `Export ${selectedCount} selected items to Generic CSV` : 'Export all filtered items to Generic CSV'"
                        >
                            <Icon icon="solar:file-download-bold" class="w-3.5 h-3.5 text-success" />
                            <span class="truncate">Export CSV</span>
                        </button>

                        <!-- Delete -->
                        <button 
                            type="button" 
                            class="btn btn-xs sm:btn-sm btn-outline btn-error font-bold rounded-xl gap-1 h-9 justify-center"
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
                                    <option v-for="loc in locations" :key="loc.value || loc" :value="loc.value || loc">{{ loc.label || loc }}</option>
                                </select>
                            </div>

                            <!-- Channel Section -->
                            <div v-if="channels && channels.length > 0" class="bg-base-200/70 p-3.5 rounded-2xl border border-base-300 space-y-2">
                                <label class="font-black text-xs text-base-content">
                                    Filter by Sales Channel
                                </label>
                                <select 
                                    :value="filterChannel" 
                                    @change="$emit('update:filterChannel', $event.target.value)"
                                    class="select select-sm select-bordered w-full bg-base-100 text-xs font-bold rounded-xl"
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
import ItemThumbnail from '../common/ItemThumbnail.vue';
import { useManifest } from '../../composables/useManifest';
import { useItemDrawer } from '../../composables/useItemDrawer';

const { isActionTrayOpen, activeManifest, stagedCount, openManifestTray } = useManifest();
const { openItemDrawer } = useItemDrawer();

const closeTray = () => {
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
    'export',
    'delete',
    'select-all',
    'unselect-item',
    'clear-selection',
    'reset-filters'
]);

const targetLocation = ref('');
const selectedWarehouse = ref('HG');
const customBin = ref('');
const customRawLocation = ref('');
const targetStatus = ref('');
const isConfirmingDelete = ref(false);

const computedLocationPreview = computed(() => {
    if (selectedWarehouse.value === '__custom__') {
        return customRawLocation.value.trim();
    }
    const wh = selectedWarehouse.value;
    const bin = customBin.value.trim().toUpperCase().replace(/^[-_\s]+/, '');
    if (!bin) return wh;
    return `${wh}-${bin}`;
});

const setQuickLoc = (wh, bin = '') => {
    selectedWarehouse.value = wh;
    customBin.value = bin;
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

const headerTitle = computed(() => {
    if (props.activeTab === 'actions') {
        return props.selectedCount > 0 ? `Selected Items (${props.selectedCount})` : 'Bulk Actions & Selections';
    }
    if (props.activeTab === 'filters') {
        return 'Filters & View Options';
    }
    return 'Add & Ingest Inventory';
});

const headerSubtitle = computed(() => {
    if (props.activeTab === 'actions') {
        return props.selectedCount > 0 ? 'Curate selection or run bulk operations' : 'Select items in catalog to move locations or set status';
    }
    if (props.activeTab === 'filters') {
        return 'Refine catalog by status, storage location, or tags';
    }
    return 'Scout AI scan, manual item drawer & CSV spreadsheet import';
});

const headerIcon = computed(() => {
    if (props.activeTab === 'actions') return 'solar:checklist-minimalistic-bold';
    if (props.activeTab === 'filters') return 'solar:tuning-square-2-bold-duotone';
    return 'solar:add-circle-bold';
});

const setTab = (tab) => {
    emit('update:activeTab', tab);
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
    const loc = computedLocationPreview.value;
    if (!loc) return;
    emit('apply-location', loc);
    customBin.value = '';
};

const onApplyStatus = () => {
    if (!targetStatus.value) return;
    const st = targetStatus.value;
    targetStatus.value = '';
    closeTray();
    emit('apply-status', st);
};

const confirmDelete = () => {
    isConfirmingDelete.value = false;
    closeTray();
    emit('delete');
};
</script>

<template>
    <div class="sticky top-0 z-30 bg-base-100/95 backdrop-blur-md border-b border-base-200 py-3 -mx-2 px-2 sm:mx-0 sm:px-0 shadow-xs w-full max-w-full min-w-0">
        <div class="flex flex-col gap-2 sm:gap-3">
            <!-- Row 1: Title & Live Counts on Left, View Switcher on Right -->
            <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 sm:gap-2.5 min-w-0">
                    <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <Icon icon="solar:widget-2-bold" class="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-1.5 sm:gap-2">
                            <h1 class="text-base sm:text-xl font-bold tracking-tight text-base-content leading-none truncate">{{ title }}</h1>
                            <span class="badge badge-xs sm:badge-sm badge-neutral font-mono font-bold">{{ filteredCount }}</span>
                            <span v-if="loading" class="loading loading-spinner loading-xs text-primary"></span>
                        </div>
                        <span class="text-[10px] sm:text-[11px] opacity-60 font-medium truncate block">
                            {{ viewMode === 'grid' ? 'Visual Card Grid View' : subtitle }}
                        </span>
                    </div>
                </div>

                <!-- View Mode Segmented Control or Fallback Link -->
                <div v-if="viewMode" class="join bg-base-200/80 p-0.5 rounded-lg border border-base-300 shrink-0">
                    <button 
                        type="button"
                        class="join-item btn btn-xs gap-1 font-bold transition-all px-2 sm:px-2.5"
                        :class="viewMode === 'table' ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost opacity-70 hover:opacity-100'"
                        @click="$emit('update:viewMode', 'table')"
                        title="Spreadsheet Table View"
                    >
                        <Icon icon="solar:list-bold" class="w-3.5 h-3.5" />
                        <span class="text-[11px]">Table</span>
                    </button>
                    <button 
                        type="button"
                        class="join-item btn btn-xs gap-1 font-bold transition-all px-2 sm:px-2.5"
                        :class="viewMode === 'grid' ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost opacity-70 hover:opacity-100'"
                        @click="$emit('update:viewMode', 'grid')"
                        title="Visual Card Grid View"
                    >
                        <Icon icon="solar:gallery-wide-bold" class="w-3.5 h-3.5" />
                        <span class="text-[11px]">Cards</span>
                    </button>
                </div>
                <a v-else :href="switchViewHref" class="btn btn-xs sm:btn-sm btn-ghost border border-base-300 gap-1.5 shrink-0" :title="switchViewTitle">
                    <Icon :icon="switchViewIcon" class="w-4 h-4" />
                    <span class="text-xs font-bold">{{ switchViewLabel }}</span>
                </a>
            </div>

            <!-- Row 2: Full-Width Omnibox Search -->
            <div class="relative w-full">
                <Icon icon="solar:magnifer-linear" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
                <input 
                    type="text" 
                    :value="searchQuery" 
                    @input="$emit('update:searchQuery', $event.target.value)"
                    placeholder="Search title, UPC, PO, vendor, location..." 
                    class="input input-bordered input-sm w-full pl-9 pr-8 bg-base-200/60 focus:bg-base-100 font-mono text-xs shadow-inner rounded-lg" 
                />
                <button 
                    v-if="searchQuery" 
                    @click="$emit('update:searchQuery', '')" 
                    class="btn btn-ghost btn-circle btn-xs absolute right-1.5 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100"
                    title="Clear search"
                >✕</button>
            </div>
        </div>

        <!-- ------------------------------------------------------------- -->
        <!-- HORIZONTAL STATUS PIPELINE TABS                               -->
        <!-- ------------------------------------------------------------- -->
        <div class="flex items-center gap-2 overflow-x-auto pt-3 mt-1 pb-1 scrollbar-none w-full max-w-full min-w-0 overscroll-x-contain">
            <!-- Status Tab: Active Stock (Default on-hand physical inventory) -->
            <button 
                type="button"
                @click="$emit('update:filterStatus', 'active')"
                class="btn btn-xs rounded-full gap-1.5 transition-all font-bold shrink-0"
                :class="filterStatus === 'active' ? 'btn-primary text-primary-content shadow-sm' : 'btn-ghost bg-base-200/70 text-base-content/80 hover:bg-base-200'"
                title="Active on-hand inventory (excludes sold, unacquired trackers, and combined lots)"
            >
                <Icon icon="solar:box-minimalistic-bold" class="w-3.5 h-3.5" />
                <span>Active Stock</span>
                <span class="badge badge-xs" :class="filterStatus === 'active' ? 'badge-neutral' : 'badge-ghost'">{{ getStatusCount('active') }}</span>
            </button>

            <div class="h-3 w-px bg-base-content/20 shrink-0"></div>

            <!-- Status Tab: Acquired -->
            <button 
                type="button"
                @click="$emit('update:filterStatus', 'acquired')"
                class="btn btn-xs rounded-full gap-1.5 transition-all font-bold shrink-0"
                :class="filterStatus === 'acquired' ? 'bg-warning text-warning-content shadow-sm' : 'btn-ghost bg-base-200/70 opacity-70 hover:opacity-100'"
            >
                <span>Acquired</span>
                <span class="badge badge-xs" :class="filterStatus === 'acquired' ? 'badge-neutral' : 'badge-ghost'">{{ getStatusCount('acquired') }}</span>
            </button>

            <Icon icon="solar:alt-arrow-right-linear" class="w-3.5 h-3.5 opacity-30 shrink-0" />

            <!-- Status Tab: Received -->
            <button 
                type="button"
                @click="$emit('update:filterStatus', 'received')"
                class="btn btn-xs rounded-full gap-1.5 transition-all font-bold shrink-0"
                :class="filterStatus === 'received' ? 'bg-info text-info-content shadow-sm' : 'btn-ghost bg-base-200/70 opacity-70 hover:opacity-100'"
            >
                <span>Received</span>
                <span class="badge badge-xs" :class="filterStatus === 'received' ? 'badge-neutral' : 'badge-ghost'">{{ getStatusCount('received') }}</span>
            </button>

            <Icon icon="solar:alt-arrow-right-linear" class="w-3.5 h-3.5 opacity-30 shrink-0" />

            <!-- Status Tab: Placed -->
            <button 
                type="button"
                @click="$emit('update:filterStatus', 'placed')"
                class="btn btn-xs rounded-full gap-1.5 transition-all font-bold shrink-0"
                :class="filterStatus === 'placed' ? 'bg-success text-success-content shadow-sm' : 'btn-ghost bg-base-200/70 opacity-70 hover:opacity-100'"
            >
                <span>Placed</span>
                <span class="badge badge-xs" :class="filterStatus === 'placed' ? 'badge-neutral' : 'badge-ghost'">{{ getStatusCount('placed') }}</span>
            </button>

            <div class="h-3 w-px bg-base-content/20 shrink-0"></div>

            <!-- Status Tab: Tracked (Unacquired Items in Trackers / Shopping Cart) -->
            <button 
                type="button"
                @click="$emit('update:filterStatus', 'tracked')"
                class="btn btn-xs rounded-full gap-1.5 transition-all font-bold shrink-0"
                :class="filterStatus === 'tracked' ? 'bg-secondary text-secondary-content shadow-sm' : 'btn-ghost bg-base-200/70 opacity-70 hover:opacity-100'"
                title="Unacquired items currently in online trackers, auctions, or scout cart"
            >
                <Icon icon="solar:radar-2-bold" class="w-3.5 h-3.5" />
                <span>Tracked (Unacquired)</span>
                <span class="badge badge-xs" :class="filterStatus === 'tracked' ? 'badge-neutral' : 'badge-ghost'">{{ getStatusCount('tracked') }}</span>
            </button>

            <!-- Status Tab: Sold -->
            <button 
                type="button"
                @click="$emit('update:filterStatus', 'sold')"
                class="btn btn-xs rounded-full gap-1.5 transition-all font-bold shrink-0"
                :class="filterStatus === 'sold' ? 'bg-neutral text-neutral-content shadow-sm' : 'btn-ghost bg-base-200/70 opacity-70 hover:opacity-100'"
            >
                <span>Sold</span>
                <span class="badge badge-xs badge-ghost">{{ getStatusCount('sold') }}</span>
            </button>

            <!-- Status Tab: All -->
            <button 
                type="button"
                @click="$emit('update:filterStatus', 'all')"
                class="btn btn-xs rounded-full gap-1.5 transition-all font-bold shrink-0"
                :class="filterStatus === 'all' ? 'btn-outline border-base-content/30 font-black shadow-sm' : 'btn-ghost opacity-60 hover:opacity-100'"
                title="All database records including sold and tracker items"
            >
                <span>All ({{ totalCount }})</span>
            </button>

            <div class="h-3 w-px bg-base-content/20 shrink-0"></div>

            <!-- Quick Insight: Ready to List -->
            <button 
                type="button"
                @click="$emit('update:filterInsight', filterInsight === 'ready_to_list' ? '' : 'ready_to_list')"
                class="btn btn-xs rounded-full gap-1 transition-all font-bold shrink-0"
                :class="filterInsight === 'ready_to_list' ? 'btn-secondary text-secondary-content shadow-sm' : 'btn-ghost bg-base-200/70 text-base-content/80 hover:bg-base-200'"
                title="Items ready to list"
            >
                <Icon icon="solar:checklist-linear" class="w-3 h-3" />
                <span>Ready to List</span>
            </button>

            <!-- Quick Insight: Missing Photos -->
            <button 
                type="button"
                @click="$emit('update:filterInsight', filterInsight === 'missing_photos' ? '' : 'missing_photos')"
                class="btn btn-xs rounded-full gap-1 transition-all font-bold shrink-0"
                :class="filterInsight === 'missing_photos' ? 'bg-error text-error-content shadow-sm' : 'btn-ghost bg-base-200/70 text-base-content/80 hover:bg-base-200'"
                title="Items missing photos"
            >
                <Icon icon="solar:camera-linear" class="w-3 h-3" />
                <span>Missing Photos</span>
            </button>

            <!-- Quick Insight: Missing Pricing -->
            <button 
                type="button"
                @click="$emit('update:filterInsight', filterInsight === 'missing_est_value' ? '' : 'missing_est_value')"
                class="btn btn-xs rounded-full gap-1 transition-all font-bold shrink-0"
                :class="filterInsight === 'missing_est_value' ? 'bg-warning text-warning-content shadow-sm' : 'btn-ghost bg-base-200/70 text-base-content/80 hover:bg-base-200'"
                title="Items missing pricing"
            >
                <Icon icon="solar:dollar-linear" class="w-3 h-3" />
                <span>Missing Pricing</span>
            </button>

            <div class="h-3 w-px bg-base-content/20 shrink-0"></div>

            <!-- Quick Location Filter Dropdown Pill -->
            <div class="shrink-0 flex items-center">
                <select 
                    :value="filterLocation" 
                    @change="$emit('update:filterLocation', $event.target.value)"
                    class="select select-bordered select-xs rounded-full h-6 min-h-6 text-[11px] font-bold bg-base-200/70 shrink-0"
                    title="Filter by storage location or warehouse facility"
                >
                    <option value="all">All Locations</option>
                    <option v-for="loc in locations" :key="loc.value || loc" :value="loc.value || loc">{{ loc.label || loc }}</option>
                </select>
            </div>

            <!-- Filters & Exclusions Modal Trigger Button -->
            <button 
                type="button" 
                @click="isFiltersOpen = true"
                class="btn btn-xs rounded-full gap-1 font-bold shrink-0 transition-all border border-base-300"
                :class="activeFilterChips.length > 0 ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost bg-base-200/70 text-base-content/80 hover:bg-base-200'"
                title="Open Advanced Filters & Exclusions"
            >
                <Icon icon="solar:tuning-square-2-bold-duotone" class="w-3.5 h-3.5" />
                <span>Filters</span>
                <span v-if="activeFilterChips.length > 0" class="badge badge-xs badge-neutral font-mono font-bold">{{ activeFilterChips.length }}</span>
            </button>
        </div>

        <!-- ------------------------------------------------------------- -->
        <!-- ACTIVE FILTER CHIPS ROW                                       -->
        <!-- ------------------------------------------------------------- -->
        <div v-if="activeFilterChips.length > 0" class="flex items-center gap-1.5 flex-wrap pt-2.5 border-t border-base-200 mt-2">
            <span class="text-[11px] font-bold opacity-60 shrink-0">Active Filters:</span>
            <span 
                v-for="chip in activeFilterChips" 
                :key="chip.id" 
                class="badge badge-sm badge-neutral gap-1.5 font-bold shadow-2xs py-1 px-2 text-xs"
            >
                <span>{{ chip.label }}</span>
                <button 
                    type="button" 
                    class="opacity-60 hover:opacity-100 hover:text-error transition-colors font-bold text-xs" 
                    @click="chip.onRemove"
                    title="Remove filter"
                >✕</button>
            </span>
            <button 
                type="button" 
                class="btn btn-ghost btn-xs text-error font-bold ml-1 hover:bg-error/10" 
                @click="$emit('clear-filters')"
            >
                Clear All
            </button>
        </div>
    </div>

    <!-- FILTERS & VISIBILITY MODAL BOTTOM SHEET / DIALOG (No Clipping on Mobile!) -->
    <dialog class="modal modal-bottom sm:modal-middle" :class="{'modal-open': isFiltersOpen}">
        <div class="modal-box bg-base-100 border-2 border-base-300 p-4 sm:p-5 max-w-lg shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div class="flex items-center justify-between pb-2 border-b border-base-200">
                <span class="font-bold flex items-center gap-2 text-base text-base-content">
                    <Icon icon="solar:tuning-square-2-bold-duotone" class="w-5 h-5 text-primary" /> Filters &amp; Exclusions
                </span>
                <button type="button" @click="isFiltersOpen = false" class="btn btn-sm btn-circle btn-ghost text-base-content/70 hover:text-base-content">✕</button>
            </div>

            <!-- Visibility "No-Show" Toggles -->
            <div class="space-y-2 bg-base-200/60 p-3 rounded-xl border border-base-300/60">
                <div class="text-[11px] uppercase font-bold tracking-wider text-base-content/70">Exclusions ("No-Show")</div>
                <label class="label cursor-pointer py-1 justify-between hover:bg-base-200/40 rounded-lg px-1">
                    <span class="label-text text-xs font-semibold text-base-content">Hide Sold Items</span>
                    <input type="checkbox" :checked="hideSold" @change="$emit('update:hideSold', $event.target.checked)" class="checkbox checkbox-sm checkbox-primary" />
                </label>
                <label class="label cursor-pointer py-1 justify-between hover:bg-base-200/40 rounded-lg px-1">
                    <span class="label-text text-xs font-semibold text-base-content">Hide Trackers / Unacquired</span>
                    <input type="checkbox" :checked="hideTracked" @change="$emit('update:hideTracked', $event.target.checked)" class="checkbox checkbox-sm checkbox-primary" />
                </label>
                <label class="label cursor-pointer py-1 justify-between hover:bg-base-200/40 rounded-lg px-1">
                    <span class="label-text text-xs font-semibold text-base-content">Hide Merged Lots</span>
                    <input type="checkbox" :checked="hideCombined" @change="$emit('update:hideCombined', $event.target.checked)" class="checkbox checkbox-sm checkbox-primary" />
                </label>
                <label class="label cursor-pointer py-1 justify-between hover:bg-base-200/40 rounded-lg px-1">
                    <span class="label-text text-xs font-semibold text-base-content">Only Placed &amp; Located</span>
                    <input type="checkbox" :checked="filterPlacedLocated" @change="$emit('update:filterPlacedLocated', $event.target.checked)" class="checkbox checkbox-sm checkbox-primary" />
                </label>
            </div>

            <!-- Location Filter -->
            <div class="space-y-1.5">
                <div class="text-[11px] uppercase font-bold tracking-wider text-base-content/70">Location / Facility</div>
                <select :value="filterLocation" @change="$emit('update:filterLocation', $event.target.value)" class="select select-bordered select-sm w-full bg-base-100 font-bold text-xs">
                    <option value="all">All Locations</option>
                    <option v-for="loc in locations" :key="loc.value || loc" :value="loc.value || loc">{{ loc.label || loc }}</option>
                </select>
            </div>

            <!-- AI Health Insights -->
            <div class="space-y-1.5">
                <div class="text-[11px] uppercase font-bold tracking-wider text-base-content/70">AI Health Insights</div>
                <select :value="filterInsight" @change="$emit('update:filterInsight', $event.target.value)" class="select select-bordered select-sm w-full bg-base-100 font-bold text-xs">
                    <option value="">All Health Statuses</option>
                    <option value="ready_to_list">Ready to List</option>
                    <option value="missing_photos">Missing Photos</option>
                    <option value="missing_pricing">Missing Pricing</option>
                    <option value="missing_cost">Missing Cost Basis</option>
                </select>
            </div>

            <!-- Barcode & Prefix -->
            <div class="space-y-1.5">
                <div class="text-[11px] uppercase font-bold tracking-wider text-base-content/70">Barcode &amp; Prefix</div>
                <select :value="filterBarcode" @change="$emit('update:filterBarcode', $event.target.value)" class="select select-bordered select-sm w-full bg-base-100 font-bold text-xs">
                    <option value="all">All Barcodes</option>
                    <option value="__missing__">Missing Barcode (No UPC)</option>
                    <option value="__has_barcode__">Has Barcode (Any UPC)</option>
                    <option v-for="p in prefixes" :key="p.prefix" :value="p.prefix">{{ p.prefix }} ({{ p.count }})</option>
                </select>
            </div>

            <!-- Lot Lineage -->
            <div class="space-y-1.5">
                <div class="text-[11px] uppercase font-bold tracking-wider text-base-content/70">Lot Lineage</div>
                <select :value="filterLotType" @change="$emit('update:filterLotType', $event.target.value)" class="select select-bordered select-sm w-full bg-base-100 font-bold text-xs">
                    <option value="all">All Items</option>
                    <option value="lots_only">Parent Lots Only</option>
                    <option value="extracted_only">Extracted Children Only</option>
                    <option value="standalone_only">Standalone Items Only</option>
                </select>
            </div>

            <!-- Modal Actions -->
            <div class="modal-action justify-between pt-2 border-t border-base-200">
                <button 
                    v-if="activeFilterChips.length > 0" 
                    type="button" 
                    @click="$emit('clear-filters')" 
                    class="btn btn-sm btn-ghost text-error font-bold"
                >
                    Reset All
                </button>
                <div v-else></div>
                <button type="button" @click="isFiltersOpen = false" class="btn btn-sm btn-primary font-bold px-5">
                    Done
                </button>
            </div>
        </div>
        <form method="dialog" class="modal-backdrop" @click="isFiltersOpen = false">
            <button type="button">close</button>
        </form>
    </dialog>
</template>

<script setup>
import { ref } from 'vue';
import { Icon } from '@iconify/vue';

const isFiltersOpen = ref(false);

const props = defineProps({
    title: { type: String, default: 'Inventory' },
    subtitle: { type: String, default: 'Spreadsheet / High-Density View' },
    searchQuery: { type: String, default: '' },
    filterStatus: { type: String, default: 'active' },
    filterLocation: { type: String, default: 'all' },
    filterChannel: { type: String, default: 'all' },
    hideSold: { type: Boolean, default: true },
    hideTracked: { type: Boolean, default: true },
    hideCombined: { type: Boolean, default: true },
    filterPlacedLocated: { type: Boolean, default: false },
    filterInsight: { type: String, default: '' },
    filterBarcode: { type: String, default: 'all' },
    filterLotType: { type: String, default: 'all' },
    locations: { type: Array, default: () => [] },
    prefixes: { type: Array, default: () => [] },
    activeFilterChips: { type: Array, default: () => [] },
    totalCount: { type: Number, default: 0 },
    filteredCount: { type: Number, default: 0 },
    loading: { type: Boolean, default: false },
    statusCounts: { type: Object, default: () => ({}) },
    switchViewHref: { type: String, default: '/inventory' },
    switchViewLabel: { type: String, default: 'Card Grid' },
    switchViewIcon: { type: String, default: 'solar:gallery-wide-linear' },
    switchViewTitle: { type: String, default: 'Switch to Visual Card Grid' },
    viewMode: { type: String, default: '' }
});

defineEmits([
    'update:searchQuery',
    'update:filterStatus',
    'update:filterLocation',
    'update:filterChannel',
    'update:hideSold',
    'update:hideTracked',
    'update:hideCombined',
    'update:filterPlacedLocated',
    'update:filterInsight',
    'update:filterBarcode',
    'update:filterLotType',
    'update:viewMode',
    'add',
    'import',
    'clear-filters'
]);

const getStatusCount = (status) => {
    return props.statusCounts[status] || 0;
};
</script>

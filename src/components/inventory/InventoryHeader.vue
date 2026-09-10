<template>
    <div class="sticky top-0 z-30 bg-base-100/95 backdrop-blur-md border-b border-base-200 py-3 -mx-4 px-4 sm:mx-0 sm:px-0 shadow-xs">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <!-- Left: Title & Live Counts -->
            <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Icon icon="solar:widget-2-bold" class="w-5 h-5" />
                </div>
                <div>
                    <div class="flex items-center gap-2">
                        <h1 class="text-lg sm:text-xl font-bold tracking-tight text-base-content leading-none">{{ title }}</h1>
                        <span class="badge badge-sm badge-neutral font-mono font-bold">{{ filteredCount }}</span>
                        <span v-if="loading" class="loading loading-spinner loading-xs text-primary"></span>
                    </div>
                    <span class="text-[11px] opacity-50 font-medium">{{ subtitle }}</span>
                </div>
            </div>

            <!-- Center: Omnibox Search -->
            <div class="relative flex-1 max-w-lg min-w-0">
                <Icon icon="solar:magnifer-linear" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
                <input 
                    type="text" 
                    :value="searchQuery" 
                    @input="$emit('update:searchQuery', $event.target.value)"
                    placeholder="Search title, UPC, SKU, PO, vendor, location..." 
                    class="input input-bordered input-sm w-full pl-9 pr-8 bg-base-200/60 focus:bg-base-100 font-mono text-xs shadow-inner rounded-lg" 
                />
                <button 
                    v-if="searchQuery" 
                    @click="$emit('update:searchQuery', '')" 
                    class="btn btn-ghost btn-circle btn-xs absolute right-1.5 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100"
                    title="Clear search"
                >✕</button>
            </div>

            <!-- Right: Quick Actions & View Switch Link -->
            <div class="flex items-center gap-2 shrink-0">
                <!-- Location filter dropdown -->
                <select 
                    :value="filterLocation" 
                    @change="$emit('update:filterLocation', $event.target.value)"
                    class="select select-bordered select-sm text-xs font-bold bg-base-200/60 max-w-36"
                >
                    <option value="all">All Locations</option>
                    <option v-for="loc in locations" :key="loc" :value="loc">{{ loc }}</option>
                </select>

                <!-- Add Item Button -->
                <button class="btn btn-sm btn-primary gap-1 font-bold shadow-xs" @click="$emit('add')">
                    <Icon icon="solar:add-circle-linear" class="w-4 h-4" /> Add Item
                </button>

                <!-- Import CSV -->
                <button class="btn btn-sm btn-outline gap-1 font-bold" @click="$emit('import')" title="Bulk Import CSV">
                    <Icon icon="solar:import-linear" class="w-4 h-4 text-primary" /> Import
                </button>

                <!-- View Mode Segmented Control or Fallback Link -->
                <div v-if="viewMode" class="join bg-base-200/80 p-0.5 rounded-lg border border-base-300 shrink-0">
                    <button 
                        type="button"
                        class="join-item btn btn-xs gap-1 font-bold transition-all"
                        :class="viewMode === 'table' ? 'btn-primary shadow-xs' : 'btn-ghost opacity-70 hover:opacity-100'"
                        @click="$emit('update:viewMode', 'table')"
                        title="Spreadsheet Table View"
                    >
                        <Icon icon="solar:list-bold" class="w-3.5 h-3.5" />
                        <span class="hidden md:inline text-[11px]">Table</span>
                    </button>
                    <button 
                        type="button"
                        class="join-item btn btn-xs gap-1 font-bold transition-all"
                        :class="viewMode === 'grid' ? 'btn-primary shadow-xs' : 'btn-ghost opacity-70 hover:opacity-100'"
                        @click="$emit('update:viewMode', 'grid')"
                        title="Visual Card Grid View"
                    >
                        <Icon icon="solar:gallery-wide-bold" class="w-3.5 h-3.5" />
                        <span class="hidden md:inline text-[11px]">Cards</span>
                    </button>
                </div>
                <a v-else :href="switchViewHref" class="btn btn-sm btn-ghost border border-base-300 gap-1.5" :title="switchViewTitle">
                    <Icon :icon="switchViewIcon" class="w-4 h-4" />
                    <span class="hidden md:inline text-xs font-bold">{{ switchViewLabel }}</span>
                </a>
            </div>
        </div>

        <!-- ------------------------------------------------------------- -->
        <!-- HORIZONTAL STATUS PIPELINE TABS                               -->
        <!-- ------------------------------------------------------------- -->
        <div class="flex items-center gap-2 overflow-x-auto pt-3 mt-1 pb-1 scrollbar-none">
            <!-- Status Tab: All -->
            <button 
                @click="$emit('update:filterStatus', 'all')"
                class="btn btn-xs rounded-full gap-1.5 transition-all font-bold shrink-0"
                :class="filterStatus === 'all' ? 'btn-primary shadow-sm' : 'btn-ghost bg-base-200/70 opacity-70 hover:opacity-100'"
            >
                <span>All Items</span>
                <span class="badge badge-xs" :class="filterStatus === 'all' ? 'badge-neutral' : 'badge-ghost'">{{ totalCount }}</span>
            </button>

            <Icon icon="solar:alt-arrow-right-linear" class="w-3.5 h-3.5 opacity-30 shrink-0" />

            <!-- Status Tab: Acquired -->
            <button 
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
                @click="$emit('update:filterStatus', 'placed')"
                class="btn btn-xs rounded-full gap-1.5 transition-all font-bold shrink-0"
                :class="filterStatus === 'placed' ? 'bg-success text-success-content shadow-sm' : 'btn-ghost bg-base-200/70 opacity-70 hover:opacity-100'"
            >
                <span>Placed</span>
                <span class="badge badge-xs" :class="filterStatus === 'placed' ? 'badge-neutral' : 'badge-ghost'">{{ getStatusCount('placed') }}</span>
            </button>

            <Icon icon="solar:alt-arrow-right-linear" class="w-3.5 h-3.5 opacity-30 shrink-0" />

            <!-- Status Tab: Sold -->
            <button 
                @click="$emit('update:filterStatus', 'sold')"
                class="btn btn-xs rounded-full gap-1.5 transition-all font-bold shrink-0"
                :class="filterStatus === 'sold' ? 'bg-neutral text-neutral-content shadow-sm' : 'btn-ghost bg-base-200/70 opacity-70 hover:opacity-100'"
            >
                <span>Sold</span>
                <span class="badge badge-xs badge-ghost">{{ getStatusCount('sold') }}</span>
            </button>

            <!-- Active Filters Clear Trigger -->
            <div v-if="activeFilterCount > 0" class="ml-auto shrink-0 flex items-center gap-1.5 pl-2">
                <span class="badge badge-xs badge-primary font-bold">{{ activeFilterCount }} active filter{{ activeFilterCount > 1 ? 's' : '' }}</span>
                <button class="btn btn-ghost btn-xs text-error font-bold" @click="$emit('clear-filters')">Clear All</button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { Icon } from '@iconify/vue';

const props = defineProps({
    title: { type: String, default: 'Inventory' },
    subtitle: { type: String, default: 'Spreadsheet / High-Density View' },
    searchQuery: { type: String, default: '' },
    filterStatus: { type: String, default: 'all' },
    filterLocation: { type: String, default: 'all' },
    locations: { type: Array, default: () => [] },
    totalCount: { type: Number, default: 0 },
    filteredCount: { type: Number, default: 0 },
    loading: { type: Boolean, default: false },
    activeFilterCount: { type: Number, default: 0 },
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
    'update:viewMode',
    'add',
    'import',
    'clear-filters'
]);

const getStatusCount = (status) => {
    return props.statusCounts[status] || 0;
};
</script>

<template>
    <div class="space-y-1.5">
        <!-- True 2-Row Spatial & Operational Workbench Bar (Zero Desktop Clipping, Mobile-Friendly) -->
        <div class="bg-base-100 border border-base-300 rounded-xl p-1.5 sm:p-2.5 shadow-2xs space-y-1.5 sm:space-y-2">
            <!-- ROW 1: Spatial Location Tabs (Left) + Partner / Prefix Switcher (Right) -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
                <!-- Left: All 7 Spatial Location Tabs -->
                <div class="flex items-center gap-1 overflow-x-auto sm:flex-wrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    <button
                        v-for="loc in SPATIAL_LOCATIONS"
                        :key="loc.id"
                        type="button"
                        @click="selectLocation(loc.id)"
                        class="btn btn-xs h-7 min-h-7 px-2 sm:px-2.5 rounded-lg font-bold gap-1 shrink-0 transition-all cursor-pointer"
                        :class="getLocationTabClass(loc.id, locationCounts[loc.id] || 0)"
                        :title="loc.description"
                    >
                        <span class="whitespace-nowrap text-[11px] sm:text-xs">{{ loc.shortLabel }}</span>
                        <span
                            class="badge badge-2xs font-mono font-extrabold border-0 px-1.5"
                            :class="getLocationBadgeClass(loc.id, locationCounts[loc.id] || 0)"
                        >
                            {{ locationCounts[loc.id] || 0 }}
                        </span>
                    </button>
                </div>

                <!-- Right: Partner & 0EJ Switcher -->
                <div class="flex items-center justify-between sm:justify-end gap-1.5 shrink-0">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider text-base-content/50 sm:hidden">
                        Partner:
                    </span>
                    <div class="join bg-base-200/80 p-0.5 rounded-lg border border-base-300/80 shrink-0">
                        <button
                            v-for="p in PARTNER_PREFIXES"
                            :key="p.id"
                            type="button"
                            @click="selectPartner(p.id)"
                            class="join-item btn btn-2xs h-6 min-h-6 px-2 font-mono font-bold border-0 rounded-md transition-all"
                            :class="isPartnerActive(p.id)
                                ? 'btn-primary text-primary-content shadow-2xs'
                                : 'btn-ghost text-base-content/70 hover:text-base-content'"
                            :title="`${p.description} (${partnerCounts[p.id] || 0} active)`"
                        >
                            <span>{{ p.label }}</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Subtle Horizontal Divider -->
            <div class="border-t border-base-200/90"></div>

            <!-- ROW 2: Operational Smart Queues (Left) + Sort Selector & Bulk Select Pills (Right) -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-1.5 sm:gap-2">
                <!-- Left: All 6 Operational Smart Queue Pills -->
                <div class="flex items-center gap-1 overflow-x-auto sm:flex-wrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider text-base-content/50 hidden xl:inline mr-0.5 shrink-0">
                        Smart Queues:
                    </span>
                    <button
                        v-for="q in SMART_QUEUES"
                        :key="q.id"
                        type="button"
                        @click="toggleQueue(q.id)"
                        class="btn btn-xs h-7 min-h-7 px-2 sm:px-2.5 rounded-lg font-bold gap-1 shrink-0 transition-all cursor-pointer"
                        :class="filterSmartQueue === q.id
                            ? 'btn-secondary text-secondary-content shadow-xs ring-1 ring-secondary'
                            : 'btn-ghost bg-base-200/70 hover:bg-base-300 text-base-content/80 border border-base-300/70'"
                        :title="q.description"
                    >
                        <span class="whitespace-nowrap text-[11px] sm:text-xs">{{ q.shortLabel }}</span>
                        <span
                            class="badge badge-2xs font-mono font-bold px-1.5 border-0"
                            :class="filterSmartQueue === q.id ? 'bg-secondary-content/20 text-secondary-content' : 'bg-base-300 text-base-content/75'"
                        >
                            {{ queueCounts[q.id] || 0 }}
                        </span>
                    </button>
                </div>

                <!-- Right: Sort Selector + Quick Bulk Select / Clear Pill -->
                <div class="flex items-center justify-between md:justify-end gap-1.5 shrink-0">
                    <!-- Stable Workbench Sort Selector -->
                    <div class="flex items-center gap-1 shrink-0">
                        <label for="rc-inventory-sort" class="text-[10px] font-extrabold uppercase tracking-wider text-base-content/55 hidden sm:inline">
                            Sort:
                        </label>
                        <select
                            id="rc-inventory-sort"
                            :value="currentSortValue"
                            @change="onSortChange"
                            class="select select-bordered select-xs h-7 min-h-7 rounded-lg font-bold text-[11px] bg-base-200/70 border-base-300 text-base-content pr-6 pl-2 focus:bg-base-100 cursor-pointer"
                            title="Sort inventory items (Newest Added and Barcode/SKU keep items fixed in place when editing)"
                        >
                            <option value="$createdAt:desc">🆕 Newest Added (Stable)</option>
                            <option value="$createdAt:asc">🌱 Oldest Added</option>
                            <option value="upc:desc">🔢 Barcode / SKU (High → Low)</option>
                            <option value="upc:asc">🔢 Barcode / SKU (Low → High)</option>
                            <option value="resalePrice:desc">💰 Price: High → Low</option>
                            <option value="resalePrice:asc">💸 Price: Low → High</option>
                            <option value="margin:desc">📈 Highest ROI %</option>
                            <option value="title:asc">🔤 Title (A → Z)</option>
                            <option value="$updatedAt:desc">🕒 Recently Edited</option>
                            <option v-if="sortColumn === 'soldDate'" value="soldDate:desc">🏷️ Sold Date (Newest)</option>
                        </select>
                    </div>

                    <!-- Quick Bulk Select / Clear Pill -->
                    <div v-if="(filteredCount || 0) > 0" class="flex items-center gap-1 shrink-0">
                        <button
                            v-if="(selectedCount || 0) < (filteredCount || 0)"
                            type="button"
                            @click="$emit('select-all')"
                            class="btn btn-xs h-7 min-h-7 px-2 sm:px-2.5 rounded-lg font-bold gap-1 shrink-0 btn-outline border-primary/40 text-primary hover:bg-primary hover:text-primary-content"
                            title="Select all items matching current filter"
                        >
                            <Icon icon="solar:check-square-bold" class="w-3.5 h-3.5" />
                            <span class="text-[11px] whitespace-nowrap">Select All ({{ filteredCount }})</span>
                        </button>
                        <button
                            v-if="(selectedCount || 0) > 0"
                            type="button"
                            @click="$emit('clear-selection')"
                            class="btn btn-xs h-7 min-h-7 px-2 sm:px-2.5 rounded-lg font-bold gap-1 shrink-0 btn-warning text-warning-content"
                            title="Clear selected items"
                        >
                            <Icon icon="solar:close-circle-bold" class="w-3.5 h-3.5" />
                            <span class="text-[11px] whitespace-nowrap">Clear ({{ selectedCount }})</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Contextual Active Smart Queue Banner -->
        <div
            v-if="activeQueueMeta"
            class="px-3 py-1.5 rounded-xl bg-secondary/10 border border-secondary/30 flex items-center justify-between gap-2 text-xs animate-fade-in"
        >
            <div class="flex items-center gap-1.5 min-w-0">
                <span class="badge badge-2xs sm:badge-xs badge-secondary font-extrabold uppercase tracking-wider shrink-0">
                    Queue
                </span>
                <span class="font-extrabold text-base-content shrink-0">{{ activeQueueMeta.label }}:</span>
                <span class="text-base-content/75 truncate text-[11px] sm:text-xs">{{ activeQueueMeta.description }}</span>
            </div>
            <div class="flex items-center gap-1 shrink-0">
                <button
                    v-if="(filteredCount || 0) > 0 && (selectedCount || 0) < (filteredCount || 0)"
                    type="button"
                    @click="$emit('select-all')"
                    class="btn btn-2xs btn-secondary text-secondary-content font-bold gap-1"
                >
                    <Icon icon="solar:check-square-bold" class="w-3 h-3" />
                    <span>Select {{ filteredCount }}</span>
                </button>
                <button
                    type="button"
                    @click="$emit('update:filterSmartQueue', '')"
                    class="btn btn-2xs btn-ghost text-secondary hover:bg-secondary/15 font-bold gap-1 shrink-0"
                >
                    <Icon icon="solar:close-circle-bold" class="w-3.5 h-3.5" />
                    <span>Clear</span>
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import {
    SPATIAL_LOCATIONS,
    SMART_QUEUES,
    PARTNER_PREFIXES,
    isWorkingStockItem,
    matchesSpatialLocation,
    matchesSmartQueue,
    matchesPartnerPrefix,
    type SmartQueueId,
    type SpatialLocationId,
    type PartnerPrefixId
} from '../../lib/inventoryVibes';

const props = defineProps<{
    inventoryItems: any[];
    filterLocation: string;
    filterSmartQueue: string;
    filterBarcode: string;
    filteredCount?: number;
    selectedCount?: number;
    sortColumn?: string;
    sortDirection?: 'asc' | 'desc';
}>();

const emit = defineEmits<{
    (e: 'update:filterLocation', val: string): void;
    (e: 'update:filterSmartQueue', val: string): void;
    (e: 'update:filterBarcode', val: string): void;
    (e: 'select-all'): void;
    (e: 'clear-selection'): void;
    (e: 'update-sort', payload: { column: string; direction: 'asc' | 'desc' }): void;
}>();

const currentSortValue = computed(() => {
    const col = props.sortColumn || '$createdAt';
    const dir = props.sortDirection || 'desc';
    const candidate = `${col}:${dir}`;
    const validOptions = new Set([
        '$createdAt:desc',
        '$createdAt:asc',
        'upc:desc',
        'upc:asc',
        'resalePrice:desc',
        'resalePrice:asc',
        'margin:desc',
        'title:asc',
        '$updatedAt:desc',
        'soldDate:desc'
    ]);
    return validOptions.has(candidate) ? candidate : '$createdAt:desc';
});

function onSortChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    const [column, direction] = val.split(':');
    if (column && (direction === 'asc' || direction === 'desc')) {
        emit('update-sort', { column, direction });
    }
}

const activeItems = computed(() => {
    return (props.inventoryItems || []).filter(item => isWorkingStockItem(item));
});

const locationCounts = computed<Record<string, number>>(() => {
    const counts: Record<string, number> = {
        all: activeItems.value.length,
        __unassigned__: 0,
        MD: 0,
        DT: 0,
        HG: 0,
        HH: 0,
        HD: 0
    };
    for (const item of activeItems.value) {
        for (const loc of SPATIAL_LOCATIONS) {
            if (loc.id === 'all') continue;
            if (matchesSpatialLocation(item, loc.id)) {
                counts[loc.id] = (counts[loc.id] || 0) + 1;
            }
        }
    }
    return counts;
});

const queueCounts = computed<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const q of SMART_QUEUES) {
        counts[q.id] = 0;
    }
    for (const item of activeItems.value) {
        for (const q of SMART_QUEUES) {
            if (matchesSmartQueue(item, q.id)) {
                counts[q.id] = (counts[q.id] || 0) + 1;
            }
        }
    }
    return counts;
});

const partnerCounts = computed<Record<string, number>>(() => {
    const counts: Record<string, number> = {
        all: activeItems.value.length,
        'HUCK-': 0,
        'PDXGL-': 0,
        'BB-': 0,
        '0EJ': 0
    };
    for (const item of activeItems.value) {
        for (const p of PARTNER_PREFIXES) {
            if (p.id === 'all') continue;
            if (matchesPartnerPrefix(item, p.id)) {
                counts[p.id] = (counts[p.id] || 0) + 1;
            }
        }
    }
    return counts;
});

const activeQueueMeta = computed(() => {
    if (!props.filterSmartQueue) return null;
    return SMART_QUEUES.find(q => q.id === props.filterSmartQueue) || null;
});

function selectLocation(locId: SpatialLocationId) {
    if (props.filterLocation === locId && locId !== 'all') {
        emit('update:filterLocation', 'all');
    } else {
        emit('update:filterLocation', locId);
    }
}

function toggleQueue(queueId: SmartQueueId) {
    if (props.filterSmartQueue === queueId) {
        emit('update:filterSmartQueue', '');
    } else {
        emit('update:filterSmartQueue', queueId);
    }
}

function isPartnerActive(partnerId: PartnerPrefixId): boolean {
    if (partnerId === 'all') {
        return !props.filterBarcode || props.filterBarcode === 'all';
    }
    return (props.filterBarcode || '').toUpperCase() === partnerId.toUpperCase();
}

function selectPartner(partnerId: PartnerPrefixId) {
    if (partnerId === 'all') {
        emit('update:filterBarcode', 'all');
    } else if ((props.filterBarcode || '').toUpperCase() === partnerId.toUpperCase()) {
        emit('update:filterBarcode', 'all');
    } else {
        emit('update:filterBarcode', partnerId);
    }
}

function getLocationTabClass(locId: SpatialLocationId, count: number): string {
    const isActive = (props.filterLocation || 'all').toLowerCase() === locId.toLowerCase();
    if (isActive) {
        if (locId === '__unassigned__') {
            return 'btn-warning text-warning-content shadow-xs ring-1 ring-warning';
        }
        return 'btn-primary text-primary-content shadow-xs ring-1 ring-primary';
    }
    if (locId === '__unassigned__' && count > 0) {
        return 'bg-warning/15 hover:bg-warning/25 text-warning-content border border-warning/40';
    }
    return 'btn-ghost bg-base-200/60 hover:bg-base-200 text-base-content/80 border border-base-300/60';
}

function getLocationBadgeClass(locId: SpatialLocationId, count: number): string {
    const isActive = (props.filterLocation || 'all').toLowerCase() === locId.toLowerCase();
    if (isActive) {
        return 'bg-base-100/25 text-current';
    }
    if (locId === '__unassigned__' && count > 0) {
        return 'badge-warning text-warning-content';
    }
    return 'bg-base-300 text-base-content/75';
}
</script>

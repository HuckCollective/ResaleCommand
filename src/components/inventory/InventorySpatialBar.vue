<template>
  <div class="space-y-1.5">
    <!-- Calm 1-Row Reseller Spatial Bar: Storage (Garage/Hideout) vs Selling Booths (Memory Den/Dusty Tiger) + Partner & Sort -->
    <div class="bg-base-100 border border-base-300 rounded-xl p-1.5 sm:px-2.5 sm:py-2 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-2">
      <!-- Left: All + 📦 Storage Group + 🏪 Selling Booths Group + 🚨 Unassigned -->
      <div class="flex items-center gap-1 overflow-x-auto scrollbar-none max-w-full">
        <button
          type="button"
          class="btn btn-xs h-11 md:h-7 px-2.5 rounded-lg font-bold gap-1 shrink-0 transition-all cursor-pointer"
          :class="getLocationTabClass('all', locationCounts.all || 0)"
          title="All active working stock across Storage and Selling Booths"
          @click="selectLocation('all')"
        >
          <span class="whitespace-nowrap text-[11px] sm:text-xs">All</span>
          <span
            class="badge badge-2xs font-mono font-extrabold border-0 px-1.5 whitespace-nowrap shrink-0"
            :class="getLocationBadgeClass('all', locationCounts.all || 0)"
          >
            {{ locationCounts.all || 0 }}
          </span>
        </button>

        <span class="text-[10px] font-extrabold uppercase tracking-wider text-base-content/50 pl-1 hidden xl:inline shrink-0">
          Storage:
        </span>
        <button
          v-for="loc in storageFacilities"
          :key="loc.code"
          type="button"
          class="btn btn-xs h-11 md:h-7 px-2.5 rounded-lg font-bold gap-1 shrink-0 transition-all cursor-pointer"
          :class="getLocationTabClass(loc.code as SpatialLocationId, locationCounts[loc.code] || 0)"
          :title="`${loc.shortName} (${loc.code}) — Backstock Storage`"
          @click="selectLocation(loc.code as SpatialLocationId)"
        >
          <span class="whitespace-nowrap text-[11px] sm:text-xs">{{ loc.icon }} {{ loc.shortName }}</span>
          <span
            class="badge badge-2xs font-mono font-extrabold border-0 px-1.5 whitespace-nowrap shrink-0"
            :class="getLocationBadgeClass(loc.code as SpatialLocationId, locationCounts[loc.code] || 0)"
          >
            {{ locationCounts[loc.code] || 0 }}
          </span>
        </button>

        <div class="h-4 w-px bg-base-300 mx-0.5 shrink-0"></div>

        <span class="text-[10px] font-extrabold uppercase tracking-wider text-base-content/50 hidden xl:inline shrink-0">
          Booths:
        </span>
        <button
          v-for="loc in sellingBoothFacilities"
          :key="loc.code"
          type="button"
          class="btn btn-xs h-11 md:h-7 px-2.5 rounded-lg font-bold gap-1 shrink-0 transition-all cursor-pointer"
          :class="getLocationTabClass(loc.code as SpatialLocationId, locationCounts[loc.code] || 0)"
          :title="`${loc.shortName} (${loc.code}) — Selling Booth (${loc.feePct}% fee)`"
          @click="selectLocation(loc.code as SpatialLocationId)"
        >
          <span class="whitespace-nowrap text-[11px] sm:text-xs">{{ loc.icon }} {{ loc.shortName }}</span>
          <span
            class="badge badge-2xs font-mono font-extrabold border-0 px-1.5 whitespace-nowrap shrink-0"
            :class="getLocationBadgeClass(loc.code as SpatialLocationId, locationCounts[loc.code] || 0)"
          >
            {{ locationCounts[loc.code] || 0 }}
          </span>
        </button>

        <button
          v-if="(locationCounts.__unassigned__ || 0) > 0 || filterLocation === '__unassigned__'"
          type="button"
          class="btn btn-xs h-11 md:h-7 px-2.5 rounded-lg font-bold gap-1 shrink-0 transition-all cursor-pointer"
          :class="getLocationTabClass('__unassigned__', locationCounts.__unassigned__ || 0)"
          title="Items missing a physical location (Golden Rule #1 triage)"
          @click="selectLocation('__unassigned__')"
        >
          <span class="whitespace-nowrap text-[11px] sm:text-xs">🚨 Unassigned</span>
          <span
            class="badge badge-2xs font-mono font-extrabold border-0 px-1.5 whitespace-nowrap shrink-0"
            :class="getLocationBadgeClass('__unassigned__', locationCounts.__unassigned__ || 0)"
          >
            {{ locationCounts.__unassigned__ || 0 }}
          </span>
        </button>
      </div>

      <!-- Right: Single Unified Owner Scope Select + Sort Select + Conditional Select All / Clear -->
      <div class="flex items-center justify-between lg:justify-end gap-1.5 flex-wrap sm:flex-nowrap shrink-0">
        <select
          :value="currentOwnerSelectValue"
          aria-label="Filter by Owner or Partner SKU"
          title="Filter by Owner or Partner SKU"
          class="select select-bordered select-xs h-11 md:h-7 rounded-lg font-mono font-bold text-[11px] bg-base-200/70 border-base-300 text-base-content pr-6 pl-2 cursor-pointer"
          @change="onPartnerChange"
        >
          <option v-if="!isConsignor" value="__mine__">
            {{ myScopeOptionLabel }} ({{ mySkuCount }})
          </option>
          <option value="all">
            {{ isConsignor ? 'All Items' : '🌐 All Collective' }} ({{ activeItems.length }})
          </option>
          <option v-for="p in otherPartnerOptions" :key="p.id" :value="p.id">
            {{ p.label }} ({{ partnerCounts[p.id] || 0 }})
          </option>
        </select>

        <select
          v-if="showSort"
          :value="currentSortValue"
          aria-label="Sort inventory items"
          title="Sort inventory items"
          class="select select-bordered select-xs h-11 md:h-7 rounded-lg font-bold text-[11px] bg-base-200/70 border-base-300 text-base-content pr-6 pl-2 cursor-pointer"
          @change="onSortChange"
        >
          <option value="$createdAt:desc">🆕 Newest Added</option>
          <option value="$createdAt:asc">🌱 Oldest Added</option>
          <option value="upc:desc">🔢 Barcode (High → Low)</option>
          <option value="upc:asc">🔢 Barcode (Low → High)</option>
          <option value="resalePrice:desc">💰 Price: High → Low</option>
          <option value="resalePrice:asc">💸 Price: Low → High</option>
          <option value="margin:desc">📈 Highest ROI %</option>
          <option value="title:asc">🔤 Title (A → Z)</option>
          <option value="$updatedAt:desc">🕒 Recently Edited</option>
          <option v-if="sortColumn === 'soldDate'" value="soldDate:desc">🏷️ Sold Date (Newest)</option>
        </select>

        <div v-if="(filteredCount || 0) > 0" class="flex items-center gap-1 shrink-0">
          <button
            v-if="(selectedCount || 0) > 0"
            type="button"
            class="btn btn-xs h-11 md:h-7 px-2.5 rounded-lg font-bold gap-1 shrink-0 btn-warning text-warning-content"
            title="Clear selected items"
            @click="$emit('clear-selection')"
          >
            <Icon icon="solar:close-circle-bold" class="w-3.5 h-3.5" />
            <span class="text-[11px] whitespace-nowrap">Clear ({{ selectedCount }})</span>
          </button>
          <button
            v-else
            type="button"
            class="btn btn-xs h-11 md:h-7 px-2.5 rounded-lg font-bold gap-1 shrink-0 btn-outline border-primary/40 text-primary hover:bg-primary hover:text-primary-content"
            title="Select all items matching current filter"
            @click="$emit('select-all')"
          >
            <Icon icon="solar:check-square-bold" class="w-3.5 h-3.5" />
            <span class="text-[11px] whitespace-nowrap">Select All ({{ filteredCount }})</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 1-Click Location Triage Bar (Shown when viewing Unassigned or when items are selected) -->
    <div
      v-if="showQuickAssign && ((filterLocation === '__unassigned__' && (filteredCount || 0) > 0) || (selectedCount || 0) > 0)"
      class="px-3 py-1.5 rounded-xl bg-warning/10 border border-warning/35 flex flex-wrap items-center justify-between gap-2 text-xs"
    >
      <div class="flex items-center gap-1.5 min-w-0">
        <span class="badge badge-2xs sm:badge-xs badge-warning text-warning-content font-extrabold uppercase tracking-wider whitespace-nowrap shrink-0">
          Assign Location
        </span>
        <span class="font-extrabold text-base-content truncate">
          {{
            (selectedCount || 0) > 0
              ? `Move ${selectedCount} selected item${selectedCount === 1 ? '' : 's'} to:`
              : `Assign ${filteredCount} unassigned item${filteredCount === 1 ? '' : 's'} to:`
          }}
        </span>
      </div>
      <div class="flex items-center gap-1 flex-wrap shrink-0">
        <button
          v-for="target in triageTargets"
          :key="target.code"
          type="button"
          class="btn btn-2xs sm:btn-xs h-11 md:h-6 px-2.5 rounded-lg font-bold gap-1 btn-outline border-base-300 bg-base-100 hover:btn-primary hover:text-primary-content transition-all cursor-pointer"
          :title="`Assign to ${target.shortName} (${target.code})`"
          @click="$emit('quick-assign-location', target.code)"
        >
          <span>{{ target.icon }} {{ target.code }}</span>
        </button>
      </div>
    </div>

    <!-- Contextual Active Queue Banner -->
    <div
      v-if="activeQueueMeta"
      class="px-3 py-1.5 rounded-xl bg-secondary/10 border border-secondary/30 flex items-center justify-between gap-2 text-xs flex-wrap"
    >
      <div class="flex items-center gap-1.5 min-w-0">
        <span class="badge badge-2xs sm:badge-xs badge-secondary text-secondary-content font-extrabold uppercase tracking-wider whitespace-nowrap shrink-0">
          Active Queue
        </span>
        <span class="font-extrabold text-base-content shrink-0">{{ activeQueueMeta.label }}</span>
        <span class="text-base-content/75 truncate text-[11px] sm:text-xs hidden md:inline">— {{ activeQueueMeta.description }}</span>
      </div>
      <div class="flex items-center gap-1 shrink-0 ml-auto">
        <button
          type="button"
          class="btn btn-2xs h-11 md:h-6 px-2.5 btn-outline btn-secondary font-bold gap-1 rounded-lg"
          @click="$emit('open-queues')"
        >
          <span>Switch Queue</span>
        </button>
        <button
          type="button"
          class="btn btn-2xs h-11 md:h-6 px-2 btn-ghost text-secondary hover:bg-secondary/15 font-bold gap-1 rounded-lg"
          @click="$emit('update:filterSmartQueue', '')"
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
  matchesPartnerPrefix,
  type SpatialLocationId,
  type PartnerPrefixId,
} from '../../lib/inventoryVibes';
import {
  getAllLocationSettingMetas,
  getBackstockStorageMetas,
  getSellingBoothMetas,
} from '../../lib/warehouses';
import {
  extractItemOwnerPrefix,
  matchesMySkuFilter,
  normalizeUpcPrefix,
} from '../../lib/curatorOwnership';

const props = withDefaults(
  defineProps<{
    inventoryItems: any[];
    filterLocation: string;
    filterSmartQueue: string;
    filterBarcode: string;
    myPrefix?: string;
    ownedPrefixes?: string[];
    currentUserId?: string;
    isConsignor?: boolean;
    filteredCount?: number;
    selectedCount?: number;
    sortColumn?: string;
    sortDirection?: 'asc' | 'desc';
    showSort?: boolean;
    showQuickAssign?: boolean;
  }>(),
  {
    showSort: true,
    showQuickAssign: true,
    isConsignor: false,
  }
);

const emit = defineEmits<{
  (e: 'update:filterLocation', val: string): void;
  (e: 'update:filterSmartQueue', val: string): void;
  (e: 'update:filterBarcode', val: string): void;
  (e: 'select-all'): void;
  (e: 'clear-selection'): void;
  (e: 'update-sort', payload: { column: string; direction: 'asc' | 'desc' }): void;
  (e: 'quick-assign-location', code: string): void;
  (e: 'open-queues'): void;
}>();

const storageFacilities = getBackstockStorageMetas();
const sellingBoothFacilities = getSellingBoothMetas();
const triageTargets = getAllLocationSettingMetas();

const activeItems = computed(() =>
  (props.inventoryItems || []).filter((item) => isWorkingStockItem(item))
);

const effectiveOwnedPrefixes = computed<string[]>(() => {
  const out = new Set<string>();
  for (const p of props.ownedPrefixes || []) {
    const norm = normalizeUpcPrefix(p);
    if (norm) out.add(norm);
  }
  if (props.myPrefix) {
    const norm = normalizeUpcPrefix(props.myPrefix);
    if (norm) out.add(norm);
  }
  return Array.from(out);
});

const mySkuCount = computed(() => {
  if (!props.currentUserId && effectiveOwnedPrefixes.value.length === 0) {
    return activeItems.value.length;
  }
  return activeItems.value.filter((item) =>
    matchesMySkuFilter(item, effectiveOwnedPrefixes.value, props.currentUserId || '')
  ).length;
});

const myScopeOptionLabel = computed(() => {
  const primary = normalizeUpcPrefix(props.myPrefix) || effectiveOwnedPrefixes.value[0] || '';
  if (!primary) return '🏷️ Mine — Drafts';
  if (effectiveOwnedPrefixes.value.length > 1) {
    return `🏷️ Mine — ${primary} +${effectiveOwnedPrefixes.value.length - 1}`;
  }
  return `🏷️ Mine — ${primary}`;
});

const scopedActiveItems = computed(() => {
  const bc = String(props.filterBarcode || 'all').trim();
  if (!bc || bc === 'all') return activeItems.value;
  if (bc === '__mine__') {
    if (!props.currentUserId && effectiveOwnedPrefixes.value.length === 0) {
      return activeItems.value;
    }
    return activeItems.value.filter((item) =>
      matchesMySkuFilter(item, effectiveOwnedPrefixes.value, props.currentUserId || '')
    );
  }
  if (bc === '__missing__') {
    return activeItems.value.filter((item) => !(item.upc || item.locationSku || item.sku || '').trim());
  }
  if (bc === '__numeric__') {
    return activeItems.value.filter((item) => /^\d+$/.test((item.upc || item.locationSku || item.sku || '').trim()));
  }
  if (bc === '__has_barcode__') {
    return activeItems.value.filter((item) => Boolean((item.upc || item.locationSku || item.sku || '').trim()));
  }
  return activeItems.value.filter((item) => matchesPartnerPrefix(item, bc));
});

const otherPartnerOptions = computed<Array<{ id: string; label: string }>>(() => {
  const map = new Map<string, string>();
  const singleOwnedPrefix =
    !props.isConsignor && effectiveOwnedPrefixes.value.length === 1
      ? effectiveOwnedPrefixes.value[0]
      : '';

  for (const p of PARTNER_PREFIXES) {
    if (p.id === 'all' || p.id === '0EJ') continue;
    if (singleOwnedPrefix && p.id.toUpperCase() === singleOwnedPrefix) continue;
    map.set(p.id, p.label);
  }
  for (const pfx of effectiveOwnedPrefixes.value) {
    if (singleOwnedPrefix && pfx === singleOwnedPrefix) continue;
    if (!map.has(pfx)) map.set(pfx, pfx);
  }
  for (const item of activeItems.value) {
    const pfx = extractItemOwnerPrefix(item);
    if (!pfx) continue;
    if (singleOwnedPrefix && pfx === singleOwnedPrefix) continue;
    if (!map.has(pfx)) {
      map.set(pfx, pfx);
    }
  }
  return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
});

const currentOwnerSelectValue = computed<string>(() => {
  const raw = (props.filterBarcode || 'all').trim();
  if (raw === '__mine__' && !props.isConsignor) return '__mine__';
  if (raw === 'all' || !raw) return 'all';
  const singleOwnedPrefix =
    !props.isConsignor && effectiveOwnedPrefixes.value.length === 1
      ? effectiveOwnedPrefixes.value[0]
      : '';
  if (singleOwnedPrefix && raw.toUpperCase() === singleOwnedPrefix) return '__mine__';
  const found = otherPartnerOptions.value.find(
    (p) => p.id.toUpperCase() === raw.toUpperCase()
  );
  return found ? found.id : 'all';
});

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
    'soldDate:desc',
  ]);
  return validOptions.has(candidate) ? candidate : '$createdAt:desc';
});

function onPartnerChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value;
  emit('update:filterBarcode', val || 'all');
}

function onSortChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value;
  const [column, direction] = val.split(':');
  if (column && (direction === 'asc' || direction === 'desc')) {
    emit('update-sort', { column, direction });
  }
}

const locationCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {
    all: scopedActiveItems.value.length,
    __unassigned__: 0,
    MD: 0,
    DT: 0,
    HG: 0,
    HH: 0,
    HD: 0,
  };
  for (const item of scopedActiveItems.value) {
    for (const loc of SPATIAL_LOCATIONS) {
      if (loc.id === 'all') continue;
      if (matchesSpatialLocation(item, loc.id)) {
        counts[loc.id] = (counts[loc.id] || 0) + 1;
      }
    }
  }
  return counts;
});

const partnerCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {
    all: activeItems.value.length,
  };
  for (const p of otherPartnerOptions.value) {
    counts[p.id] = 0;
  }
  for (const item of activeItems.value) {
    for (const p of otherPartnerOptions.value) {
      if (matchesPartnerPrefix(item, p.id)) {
        counts[p.id] = (counts[p.id] || 0) + 1;
      }
    }
  }
  return counts;
});

const activeQueueMeta = computed(() => {
  if (!props.filterSmartQueue) return null;
  return SMART_QUEUES.find((q) => q.id === props.filterSmartQueue) || null;
});

function selectLocation(locId: SpatialLocationId) {
  if (props.filterLocation === locId && locId !== 'all') {
    emit('update:filterLocation', 'all');
  } else {
    emit('update:filterLocation', locId);
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

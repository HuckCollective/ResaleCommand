<template>
  <div class="sticky top-0 z-30 bg-base-100/95 backdrop-blur-md border-b border-base-200 py-2.5 -mx-2 px-2 sm:mx-0 sm:px-0 shadow-2xs w-full max-w-full min-w-0 space-y-2">
    <!-- Row 1: Title + Count | Omnibox Search + Scan | Status + ⚡ Queues + ⚙ Filters + View Switcher + Add -->
    <div class="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2">
      <!-- Left: Title & Live Count (Krug #5 Trunk Test) -->
      <div class="flex items-center gap-2 shrink-0">
        <h1 class="text-lg sm:text-xl font-black tracking-tight text-base-content leading-none">{{ title }}</h1>
        <span class="badge badge-sm badge-neutral text-neutral-content font-mono font-bold whitespace-nowrap shrink-0">
          {{ filteredCount }}
        </span>
        <span v-if="loading" class="loading loading-spinner loading-xs text-primary"></span>
      </div>

      <!-- Center: Prominent Omnibox Search + Guide + Camera Scan -->
      <div class="relative order-3 lg:order-2 w-full lg:flex-1 lg:max-w-xl min-w-0">
        <Icon icon="solar:magnifer-linear" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-45 pointer-events-none" />
        <input
          ref="searchInputRef"
          type="text"
          :value="searchQuery"
          placeholder="Search title, barcode, booth SKU, PO, location…"
          aria-label="Search inventory"
          class="input input-bordered input-sm h-11 md:h-8 w-full pl-9 pr-28 md:pr-24 bg-base-200/60 focus:bg-base-100 font-mono text-xs rounded-xl"
          @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
          @keydown.esc="onSearchEscape"
        />
        <div class="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          <kbd
            v-if="!searchQuery"
            class="hidden md:inline-flex kbd kbd-xs opacity-45 pointer-events-none mr-0.5"
            title="Press / to search"
          >
            /
          </kbd>
          <button
            v-if="searchQuery"
            type="button"
            class="btn btn-ghost btn-circle btn-xs w-9 h-9 md:w-6 md:h-6 opacity-65 hover:opacity-100 font-bold text-xs"
            title="Clear search"
            aria-label="Clear search"
            @click="$emit('update:searchQuery', '')"
          >
            ✕
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-circle btn-xs w-9 h-9 md:w-6 md:h-6 text-base-content/65 hover:text-primary font-black text-xs"
            title="Search tips & syntax cheat sheet"
            aria-label="Search tips and syntax cheat sheet"
            @click="openSearchGuide"
          >
            ?
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-circle btn-xs w-9 h-9 md:w-6 md:h-6 text-primary hover:bg-primary/10"
            title="Scan Barcode or Mini QR with Camera"
            aria-label="Scan Barcode or Mini QR with Camera"
            @click="isScannerOpen = true"
          >
            <Icon icon="solar:camera-linear" class="w-4 h-4 md:w-3.5 md:h-3.5" />
          </button>
        </div>
      </div>

      <!-- Right: Status Select + 🧹 Cleanup + ⚡ Queues & Lists + ⚙ Filters + Table|Cards + Add -->
      <div class="flex items-center gap-1.5 order-2 lg:order-3 shrink-0 ml-auto lg:ml-0">
        <select
          :value="filterStatus"
          aria-label="Filter by inventory status"
          title="Filter by inventory status"
          class="hidden md:inline-flex select select-bordered select-xs w-auto min-w-0 max-w-full shrink-0 h-8 rounded-xl font-bold text-xs bg-base-200/70 border-base-300 pl-2.5 pr-7 cursor-pointer"
          @change="$emit('update:filterStatus', ($event.target as HTMLSelectElement).value)"
        >
          <option value="active">Active Stock ({{ getStatusCount('active') }})</option>
          <option value="acquired">Acquired ({{ getStatusCount('acquired') }})</option>
          <option value="received">Received ({{ getStatusCount('received') }})</option>
          <option value="placed">Placed ({{ getStatusCount('placed') }})</option>
          <option value="tracked">Tracked ({{ getStatusCount('tracked') }})</option>
          <option value="sold">Sold ({{ getStatusCount('sold') }})</option>
          <option value="combined">Merged / Combined ({{ getStatusCount('combined') }})</option>
          <option value="deconstructed">Deconstructed ({{ getStatusCount('deconstructed') }})</option>
          <option value="all">All Records ({{ countAll ?? totalCount }})</option>
        </select>

        <button
          v-if="healthBadgeCount > 0 || isHealthTrayOpen"
          type="button"
          class="btn btn-xs sm:btn-sm h-11 md:h-8 px-2.5 rounded-xl font-bold gap-1 shrink-0 transition-all"
          :class="
            isHealthTrayOpen
              ? 'btn-warning text-warning-content shadow-xs'
              : 'btn-outline border-warning/55 bg-warning/10 text-base-content hover:bg-warning/20'
          "
          title="Review already-sold backstock twins, already-split parent lots, extra duplicate copies & stale POs"
          @click="$emit('open-health-audit')"
        >
          <span>🧹</span>
          <span class="hidden sm:inline text-xs whitespace-nowrap">Cleanup</span>
          <span
            v-if="healthBadgeCount > 0"
            class="badge badge-2xs badge-warning text-warning-content font-mono font-black whitespace-nowrap shrink-0"
          >
            {{ healthBadgeCount }}
          </span>
        </button>

        <button
          type="button"
          class="btn btn-xs sm:btn-sm h-11 md:h-8 px-2.5 rounded-xl font-bold gap-1 shrink-0 transition-all"
          :class="
            activeQueueMeta
              ? 'btn-secondary text-secondary-content shadow-xs'
              : 'btn-outline border-base-300 bg-base-200/60 text-base-content hover:bg-base-200'
          "
          title="Open Booth Restock Lists, Shared Online Ready Bin & Tag Health Queues"
          @click="$emit('open-queues')"
        >
          <span>⚡</span>
          <span class="text-xs whitespace-nowrap">{{ activeQueueMeta ? activeQueueMeta.shortLabel : 'Queues & Lists' }}</span>
        </button>

        <button
          type="button"
          class="btn btn-xs sm:btn-sm h-11 md:h-8 px-2.5 rounded-xl font-bold gap-1 shrink-0 transition-all"
          :class="
            activeFilterChips.length > 0
              ? 'btn-outline btn-primary shadow-2xs'
              : 'btn-outline border-base-300 bg-base-200/60 text-base-content hover:bg-base-200'
          "
          title="Open Filters & Exclusions"
          @click="openFiltersDrawer"
        >
          <Icon icon="solar:tuning-square-2-bold-duotone" class="w-3.5 h-3.5" />
          <span class="hidden sm:inline text-xs">Filters</span>
          <span
            v-if="activeFilterChips.length > 0"
            class="badge badge-2xs badge-primary text-primary-content font-mono font-bold whitespace-nowrap shrink-0"
          >
            {{ activeFilterChips.length }}
          </span>
        </button>

        <div v-if="viewMode" class="join bg-base-200/80 p-0.5 rounded-xl border border-base-300 shrink-0">
          <button
            type="button"
            class="join-item btn btn-xs h-11 md:h-7 gap-1 font-bold transition-all px-2.5 rounded-lg"
            :class="viewMode === 'table' ? 'btn-neutral text-neutral-content shadow-xs' : 'btn-ghost opacity-70 hover:opacity-100'"
            title="Spreadsheet Table View"
            @click="$emit('update:viewMode', 'table')"
          >
            <Icon icon="solar:list-bold" class="w-3.5 h-3.5" />
            <span class="hidden sm:inline text-[11px]">Table</span>
          </button>
          <button
            type="button"
            class="join-item btn btn-xs h-11 md:h-7 gap-1 font-bold transition-all px-2.5 rounded-lg"
            :class="viewMode === 'grid' ? 'btn-neutral text-neutral-content shadow-xs' : 'btn-ghost opacity-70 hover:opacity-100'"
            title="Visual Card Grid View"
            @click="$emit('update:viewMode', 'grid')"
          >
            <Icon icon="solar:gallery-wide-bold" class="w-3.5 h-3.5" />
            <span class="hidden sm:inline text-[11px]">Cards</span>
          </button>
        </div>

        <button
          type="button"
          class="hidden sm:inline-flex btn btn-xs sm:btn-sm h-11 md:h-8 px-3 btn-primary text-primary-content font-black rounded-xl gap-1 shadow-xs shrink-0"
          @click="$emit('add')"
        >
          <Icon icon="solar:add-circle-bold" class="w-4 h-4" />
          <span class="text-xs">Add</span>
        </button>
      </div>
    </div>

    <!-- Row 2: Projected Spatial Location Bar (Storage vs Selling Booths) -->
    <slot name="spatial-bar" />

    <!-- Conditional Deep-Prose Search Toggle & Active Filter Chips Row -->
    <div
      v-if="activeFilterChips.length > 0 || ((proseOnlyMatchCount || 0) > 0 && !searchIncludeNotes)"
      class="flex items-center gap-1.5 flex-wrap pt-1"
    >
      <button
        v-if="(proseOnlyMatchCount || 0) > 0 && !searchIncludeNotes"
        type="button"
        class="btn btn-2xs h-8 md:h-6 px-2.5 rounded-full btn-outline border-info/50 bg-info/10 text-base-content hover:bg-info/20 font-bold gap-1 whitespace-nowrap shrink-0"
        title="Expand search to also include condition notes and descriptions"
        @click="$emit('update:searchIncludeNotes', true)"
      >
        <span>📝 +{{ proseOnlyMatchCount }} in notes &amp; descriptions</span>
        <span class="text-info font-black">Show</span>
      </button>

      <span
        v-for="chip in activeFilterChips"
        :key="chip.id"
        class="badge badge-sm badge-outline gap-1.5 font-semibold bg-base-100 border-base-300 px-2.5 whitespace-nowrap shrink-0"
      >
        <span>{{ chip.label }}</span>
        <button
          type="button"
          class="opacity-65 hover:opacity-100 hover:text-error font-bold text-xs"
          title="Remove filter"
          @click="chip.onRemove && chip.onRemove()"
        >
          ✕
        </button>
      </span>
      <button
        v-if="activeFilterChips.length > 0"
        type="button"
        class="btn btn-ghost btn-xs h-11 md:h-7 text-error font-bold hover:bg-error/10 rounded-lg"
        @click="$emit('clear-filters')"
      >
        Reset All
      </button>
    </div>

    <!-- Active Lineage / PO / SO Banner -->
    <div
      v-if="filterParentLotId || filterPO || filterSO"
      class="bg-base-200 border border-primary/30 rounded-2xl p-3 flex items-center justify-between gap-2 shadow-xs"
    >
      <div class="flex items-center gap-2.5 min-w-0">
        <div class="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center text-primary shrink-0">
          <Icon icon="solar:filter-bold" class="w-4 h-4" />
        </div>
        <div class="min-w-0 text-xs">
          <span v-if="filterParentLotId" class="block font-bold truncate">
            <span class="opacity-70">Filtered by Lot:</span>
            <span class="text-primary ml-1 font-mono">{{ filterParentLotTitle || filterParentLotId }}</span>
            <span class="badge badge-xs badge-primary text-primary-content ml-2">{{ filteredCount }} items</span>
          </span>
          <span v-else-if="filterPO" class="block font-bold truncate">
            <span class="opacity-70">Filtered by Purchase Order:</span>
            <span class="text-secondary ml-1 font-mono">{{ filterPO }}</span>
            <span class="badge badge-xs badge-secondary text-secondary-content ml-2">{{ filteredCount }} items</span>
          </span>
          <span v-else-if="filterSO" class="block font-bold truncate">
            <span class="opacity-70">Filtered by Sales Order:</span>
            <span class="text-success ml-1 font-mono">{{ filterSO }}</span>
            <span class="badge badge-xs badge-success text-success-content ml-2">{{ filteredCount }} items</span>
          </span>
          <span class="text-[10px] opacity-60">Showing only records linked to this lineage</span>
        </div>
      </div>
      <button
        type="button"
        class="btn btn-xs btn-ghost btn-circle shrink-0"
        title="Clear lineage filter"
        @click="$emit('clear-lineage')"
      >
        ✕
      </button>
    </div>

    <!-- Optional View-Specific Sub-Banners (e.g. Admin Auto-Heal) -->
    <slot name="sub-banners" />

    <!-- Canonical Slide-Over Drawer for Advanced Filters & Exclusions (Jakob's Law) -->
    <SlideOverDrawer
      v-model="isFiltersOpen"
      title="Filters & Exclusions"
      subtitle="Refine status, health checks, lot lineage, and hidden item groups."
    >
      <InventoryFilterPanel
        :filter-status="filterStatus"
        :filter-location="filterLocation"
        :filter-channel="filterChannel"
        :filter-lot-type="filterLotType"
        :filter-barcode="filterBarcode"
        :filter-insight="filterInsight"
        :hide-sold="hideSold"
        :hide-tracked="hideTracked"
        :hide-combined="hideCombined"
        :hide-deconstructed="hideDeconstructed"
        :filter-placed-located="filterPlacedLocated"
        :filter-keywords="filterKeywords"
        :locations="locations"
        :channels="channels"
        :prefixes="prefixes"
        :count-by-status="countByStatus || getStatusCount"
        :ready-to-list-count="readyToListCount"
        :missing-photos-count="missingPhotosCount"
        :missing-pricing-count="missingPricingCount"
        :missing-cost-count="missingCostCount"
        :total-count="countAll ?? totalCount"
        :show-keywords="showKeywords"
        @update:filter-status="$emit('update:filterStatus', $event)"
        @update:filter-location="$emit('update:filterLocation', $event)"
        @update:filter-channel="$emit('update:filterChannel', $event)"
        @update:filter-lot-type="$emit('update:filterLotType', $event)"
        @update:filter-barcode="$emit('update:filterBarcode', $event)"
        @update:filter-insight="$emit('update:filterInsight', $event)"
        @update:hide-sold="$emit('update:hideSold', $event)"
        @update:hide-tracked="$emit('update:hideTracked', $event)"
        @update:hide-combined="$emit('update:hideCombined', $event)"
        @update:hide-deconstructed="$emit('update:hideDeconstructed', $event)"
        @update:filter-placed-located="$emit('update:filterPlacedLocated', $event)"
        @update:filter-keywords="$emit('update:filterKeywords', $event)"
      />

      <template #footer>
        <div class="flex items-center justify-between gap-2">
          <button
            v-if="activeFilterChips.length > 0"
            type="button"
            class="btn btn-sm h-11 md:h-9 btn-ghost text-error rounded-xl font-bold"
            @click="$emit('clear-filters')"
          >
            Reset All Filters
          </button>
          <span v-else></span>
          <button
            type="button"
            class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content rounded-xl font-black px-5"
            @click="isFiltersOpen = false"
          >
            Apply &amp; Close
          </button>
        </div>
      </template>
    </SlideOverDrawer>

    <!-- BARCODE & MINI QR CAMERA SCANNER -->
    <BarcodeScannerModal
      :is-open="isScannerOpen"
      title="Scan Tag to Filter Inventory"
      subtitle="Point camera at barcode or Mini QR to instantly search"
      @close="isScannerOpen = false"
      @scan="handleScannedCode"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import BarcodeScannerModal from '../common/BarcodeScannerModal.vue';
import SlideOverDrawer from '../common/SlideOverDrawer.vue';
import InventoryFilterPanel from './InventoryFilterPanel.vue';
import { SMART_QUEUES } from '../../lib/inventoryVibes';
import { useItemDrawer } from '../../composables/useItemDrawer';
import { useManifest } from '../../composables/useManifest';
import { addToast } from '../../stores/toast';
import inventorySearchGuideMd from '../../content/help/inventory-search-guide.md?raw';

const isFiltersOpen = ref(false);
const isScannerOpen = ref(false);
const searchInputRef = ref<HTMLInputElement | null>(null);

const { isDrawerOpen, closeItemDrawer } = useItemDrawer();
const { closeAllTrays } = useManifest();

watch(isDrawerOpen, (open) => {
  if (open && isFiltersOpen.value) {
    isFiltersOpen.value = false;
  }
});

const props = withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string;
    searchQuery?: string;
    searchIncludeNotes?: boolean;
    proseOnlyMatchCount?: number;
    filterStatus?: string;
    filterLocation?: string;
    filterChannel?: string;
    filterSmartQueue?: string;
    hideSold?: boolean;
    hideTracked?: boolean;
    hideCombined?: boolean;
    hideDeconstructed?: boolean;
    filterPlacedLocated?: boolean;
    filterInsight?: string;
    filterBarcode?: string;
    filterLotType?: string;
    filterKeywords?: string[];
    filterParentLotId?: string;
    filterParentLotTitle?: string;
    filterPO?: string;
    filterSO?: string;
    locations?: any[];
    channels?: string[];
    prefixes?: any[];
    activeFilterChips?: any[];
    totalCount?: number;
    countAll?: number;
    filteredCount?: number;
    loading?: boolean;
    statusCounts?: Record<string, number>;
    countByStatus?: (status: string) => number;
    readyToListCount?: number;
    missingPhotosCount?: number;
    missingPricingCount?: number;
    missingCostCount?: number;
    showKeywords?: boolean;
    switchViewHref?: string;
    switchViewLabel?: string;
    switchViewIcon?: string;
    switchViewTitle?: string;
    viewMode?: string;
    healthBadgeCount?: number;
    isHealthTrayOpen?: boolean;
  }>(),
  {
    title: 'Inventory',
    subtitle: 'Spreadsheet / High-Density View',
    searchQuery: '',
    searchIncludeNotes: false,
    proseOnlyMatchCount: 0,
    filterStatus: 'active',
    filterLocation: 'all',
    filterChannel: 'all',
    filterSmartQueue: '',
    hideSold: true,
    hideTracked: true,
    hideCombined: true,
    hideDeconstructed: true,
    filterPlacedLocated: false,
    filterInsight: '',
    filterBarcode: 'all',
    filterLotType: 'all',
    filterKeywords: () => [],
    filterParentLotId: '',
    filterParentLotTitle: '',
    filterPO: '',
    filterSO: '',
    locations: () => [],
    channels: () => [],
    prefixes: () => [],
    activeFilterChips: () => [],
    totalCount: 0,
    filteredCount: 0,
    loading: false,
    statusCounts: () => ({}),
    readyToListCount: 0,
    missingPhotosCount: 0,
    missingPricingCount: 0,
    missingCostCount: 0,
    showKeywords: true,
    switchViewHref: '/inventory',
    switchViewLabel: 'Card Grid',
    switchViewIcon: 'solar:gallery-wide-linear',
    switchViewTitle: 'Switch to Visual Card Grid',
    viewMode: '',
    healthBadgeCount: 0,
    isHealthTrayOpen: false,
  }
);

const emit = defineEmits([
  'update:searchQuery',
  'update:searchIncludeNotes',
  'update:filterStatus',
  'update:filterLocation',
  'update:filterChannel',
  'update:hideSold',
  'update:hideTracked',
  'update:hideCombined',
  'update:hideDeconstructed',
  'update:filterPlacedLocated',
  'update:filterInsight',
  'update:filterBarcode',
  'update:filterLotType',
  'update:filterKeywords',
  'update:viewMode',
  'open-queues',
  'open-health-audit',
  'open-filters',
  'add',
  'import',
  'clear-filters',
  'clear-lineage',
]);

function openFiltersDrawer() {
  closeItemDrawer();
  closeAllTrays();
  emit('open-filters');
  isFiltersOpen.value = true;
}

function openSearchGuide() {
  if (typeof document === 'undefined') return;
  document.dispatchEvent(
    new CustomEvent('show-md-modal', {
      detail: {
        title: '🔍 Inventory Search & Filter Guide',
        text: inventorySearchGuideMd,
      },
    })
  );
}

function onSearchEscape() {
  if (props.searchQuery) {
    emit('update:searchQuery', '');
  } else {
    searchInputRef.value?.blur();
  }
}

function handleGlobalShortcut(e: KeyboardEvent) {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
  const target = e.target as HTMLElement | null;
  if (target) {
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
      return;
    }
  }
  e.preventDefault();
  searchInputRef.value?.focus();
  searchInputRef.value?.select();
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleGlobalShortcut);
  }
});

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleGlobalShortcut);
  }
});

const activeQueueMeta = computed(() => {
  if (!props.filterSmartQueue) return null;
  return SMART_QUEUES.find((q) => q.id === props.filterSmartQueue) || null;
});

const handleScannedCode = (res: any) => {
  if (!res?.rawValue) return;
  emit('update:searchQuery', res.rawValue);
  addToast(`Scanned: ${res.rawValue} (${res.format || 'code'})`, 'success');
};

const getStatusCount = (status: string) => {
  if (props.statusCounts && Object.prototype.hasOwnProperty.call(props.statusCounts, status)) {
    return props.statusCounts[status] || 0;
  }
  return props.countByStatus ? props.countByStatus(status) : 0;
};
</script>

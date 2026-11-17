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

      <!-- Center: Prominent Omnibox Search + Camera Scan -->
      <div class="relative order-3 lg:order-2 w-full lg:flex-1 lg:max-w-xl min-w-0">
        <Icon icon="solar:magnifer-linear" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-45 pointer-events-none" />
        <input
          type="text"
          :value="searchQuery"
          placeholder="Search title, barcode, booth SKU, PO, location…"
          aria-label="Search inventory"
          class="input input-bordered input-sm h-11 md:h-8 w-full pl-9 pr-20 md:pr-16 bg-base-200/60 focus:bg-base-100 font-mono text-xs rounded-xl"
          @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        />
        <div class="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
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
            class="btn btn-ghost btn-circle btn-xs w-9 h-9 md:w-6 md:h-6 text-primary hover:bg-primary/10"
            title="Scan Barcode or Mini QR with Camera"
            aria-label="Scan Barcode or Mini QR with Camera"
            @click="isScannerOpen = true"
          >
            <Icon icon="solar:camera-linear" class="w-4 h-4 md:w-3.5 md:h-3.5" />
          </button>
        </div>
      </div>

      <!-- Right: Status Select + ⚡ Queues & Lists + ⚙ Filters + Table|Cards + Add -->
      <div class="flex items-center gap-1.5 order-2 lg:order-3 shrink-0 ml-auto lg:ml-0">
        <select
          :value="filterStatus"
          aria-label="Filter by inventory status"
          title="Filter by inventory status"
          class="hidden md:inline-flex select select-bordered select-xs h-8 rounded-xl font-bold text-xs bg-base-200/70 border-base-300 pr-6 pl-2.5 cursor-pointer"
          @change="$emit('update:filterStatus', ($event.target as HTMLSelectElement).value)"
        >
          <option value="active">Active Stock ({{ getStatusCount('active') }})</option>
          <option value="acquired">Acquired ({{ getStatusCount('acquired') }})</option>
          <option value="received">Received ({{ getStatusCount('received') }})</option>
          <option value="placed">Placed ({{ getStatusCount('placed') }})</option>
          <option value="tracked">Tracked ({{ getStatusCount('tracked') }})</option>
          <option value="sold">Sold ({{ getStatusCount('sold') }})</option>
          <option value="all">All Records ({{ totalCount }})</option>
        </select>

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
          @click="isFiltersOpen = true"
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

    <!-- Conditional Active Filter Chips Row -->
    <div v-if="activeFilterChips.length > 0" class="flex items-center gap-1.5 flex-wrap pt-1">
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
        type="button"
        class="btn btn-ghost btn-xs h-11 md:h-7 text-error font-bold hover:bg-error/10 rounded-lg"
        @click="$emit('clear-filters')"
      >
        Reset All
      </button>
    </div>

    <!-- Canonical Slide-Over Drawer for Advanced Filters & Exclusions (Jakob's Law) -->
    <SlideOverDrawer
      v-model="isFiltersOpen"
      title="Filters & Exclusions"
      subtitle="Refine status, health checks, lot lineage, and hidden item groups."
    >
      <div class="space-y-5">
        <!-- Status Pipeline (especially handy on mobile) -->
        <div class="flex flex-col gap-1">
          <label for="hdr-filter-status" class="text-xs font-bold text-base-content/80">Inventory Status</label>
          <select
            id="hdr-filter-status"
            :value="filterStatus"
            class="select select-bordered select-sm h-11 md:h-9 w-full rounded-xl bg-base-100 font-bold text-xs"
            @change="$emit('update:filterStatus', ($event.target as HTMLSelectElement).value)"
          >
            <option value="active">Active Stock ({{ getStatusCount('active') }})</option>
            <option value="acquired">Acquired ({{ getStatusCount('acquired') }})</option>
            <option value="received">Received ({{ getStatusCount('received') }})</option>
            <option value="placed">Placed ({{ getStatusCount('placed') }})</option>
            <option value="tracked">Tracked / Unacquired ({{ getStatusCount('tracked') }})</option>
            <option value="sold">Sold ({{ getStatusCount('sold') }})</option>
            <option value="all">All Records ({{ totalCount }})</option>
          </select>
        </div>

        <!-- Visibility Toggles -->
        <div class="space-y-2 rounded-2xl bg-base-200/60 border border-base-300 p-3.5">
          <div class="text-xs font-extrabold uppercase tracking-wider text-base-content/75">
            Visibility &amp; Exclusions
          </div>

          <label class="flex items-center justify-between gap-3 p-2 rounded-xl bg-base-100 border border-base-300 cursor-pointer">
            <span class="text-xs font-bold text-base-content">Hide Deconstructed Parent Lots</span>
            <input
              type="checkbox"
              :checked="hideDeconstructed"
              class="toggle toggle-sm toggle-primary shrink-0"
              @change="$emit('update:hideDeconstructed', ($event.target as HTMLInputElement).checked)"
            />
          </label>

          <label class="flex items-center justify-between gap-3 p-2 rounded-xl bg-base-100 border border-base-300 cursor-pointer">
            <span class="text-xs font-bold text-base-content">Hide Combined / Merged Source Items</span>
            <input
              type="checkbox"
              :checked="hideCombined"
              class="toggle toggle-sm toggle-primary shrink-0"
              @change="$emit('update:hideCombined', ($event.target as HTMLInputElement).checked)"
            />
          </label>

          <label class="flex items-center justify-between gap-3 p-2 rounded-xl bg-base-100 border border-base-300 cursor-pointer">
            <span class="text-xs font-bold text-base-content">Hide Sold Items</span>
            <input
              type="checkbox"
              :checked="hideSold"
              class="toggle toggle-sm toggle-primary shrink-0"
              @change="$emit('update:hideSold', ($event.target as HTMLInputElement).checked)"
            />
          </label>

          <label class="flex items-center justify-between gap-3 p-2 rounded-xl bg-base-100 border border-base-300 cursor-pointer">
            <span class="text-xs font-bold text-base-content">Hide Unacquired Trackers &amp; Scout Cart</span>
            <input
              type="checkbox"
              :checked="hideTracked"
              class="toggle toggle-sm toggle-primary shrink-0"
              @change="$emit('update:hideTracked', ($event.target as HTMLInputElement).checked)"
            />
          </label>

          <label class="flex items-center justify-between gap-3 p-2 rounded-xl bg-base-100 border border-base-300 cursor-pointer">
            <span class="text-xs font-bold text-base-content">Only Placed &amp; Located Stock</span>
            <input
              type="checkbox"
              :checked="filterPlacedLocated"
              class="toggle toggle-sm toggle-primary shrink-0"
              @change="$emit('update:filterPlacedLocated', ($event.target as HTMLInputElement).checked)"
            />
          </label>
        </div>

        <!-- Location / Bin -->
        <div class="flex flex-col gap-1">
          <label for="hdr-filter-loc" class="text-xs font-bold text-base-content/80">Specific Location or Shelf Bin</label>
          <select
            id="hdr-filter-loc"
            :value="filterLocation"
            class="select select-bordered select-sm h-11 md:h-9 w-full rounded-xl bg-base-100 font-bold text-xs"
            @change="$emit('update:filterLocation', ($event.target as HTMLSelectElement).value)"
          >
            <option value="all">All Locations</option>
            <option v-for="loc in locations" :key="loc.value || loc" :value="loc.value || loc">{{ loc.label || loc }}</option>
          </select>
        </div>

        <!-- Health Insights -->
        <div class="flex flex-col gap-1">
          <label for="hdr-filter-insight" class="text-xs font-bold text-base-content/80">Catalog Health Check</label>
          <select
            id="hdr-filter-insight"
            :value="filterInsight"
            class="select select-bordered select-sm h-11 md:h-9 w-full rounded-xl bg-base-100 font-bold text-xs"
            @change="$emit('update:filterInsight', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">All Health Statuses</option>
            <option value="needs_shop_update">Needs Shop Update</option>
            <option value="ready_to_list">Ready to List</option>
            <option value="missing_photos">Missing Photos</option>
            <option value="missing_est_value">Missing Pricing</option>
            <option value="missing_cost">Missing Cost Basis</option>
          </select>
        </div>

        <!-- Barcode Prefix -->
        <div class="flex flex-col gap-1">
          <label for="hdr-filter-barcode" class="text-xs font-bold text-base-content/80">Barcode &amp; Partner Prefix</label>
          <select
            id="hdr-filter-barcode"
            :value="filterBarcode"
            class="select select-bordered select-sm h-11 md:h-9 w-full rounded-xl bg-base-100 font-bold text-xs"
            @change="$emit('update:filterBarcode', ($event.target as HTMLSelectElement).value)"
          >
            <option value="all">All Barcodes</option>
            <option value="__missing__">Missing Barcode (No UPC)</option>
            <option value="__has_barcode__">Has Barcode (Any UPC)</option>
            <option v-for="p in prefixes" :key="p.prefix" :value="p.prefix">{{ p.prefix }} ({{ p.count }})</option>
          </select>
        </div>

        <!-- Lot Lineage -->
        <div class="flex flex-col gap-1">
          <label for="hdr-filter-lot" class="text-xs font-bold text-base-content/80">Lot Lineage</label>
          <select
            id="hdr-filter-lot"
            :value="filterLotType"
            class="select select-bordered select-sm h-11 md:h-9 w-full rounded-xl bg-base-100 font-bold text-xs"
            @change="$emit('update:filterLotType', ($event.target as HTMLSelectElement).value)"
          >
            <option value="all">All Items</option>
            <option value="lots_only">Parent Lots Only</option>
            <option value="extracted_only">Split Children Only</option>
            <option value="standalone_only">Standalone Items Only</option>
          </select>
        </div>
      </div>

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
import { computed, ref } from 'vue';
import { Icon } from '@iconify/vue';
import BarcodeScannerModal from '../common/BarcodeScannerModal.vue';
import SlideOverDrawer from '../common/SlideOverDrawer.vue';
import { SMART_QUEUES } from '../../lib/inventoryVibes';
import { addToast } from '../../stores/toast';

const isFiltersOpen = ref(false);
const isScannerOpen = ref(false);

const props = withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string;
    searchQuery?: string;
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
    locations?: any[];
    prefixes?: any[];
    activeFilterChips?: any[];
    totalCount?: number;
    filteredCount?: number;
    loading?: boolean;
    statusCounts?: Record<string, number>;
    switchViewHref?: string;
    switchViewLabel?: string;
    switchViewIcon?: string;
    switchViewTitle?: string;
    viewMode?: string;
  }>(),
  {
    title: 'Inventory',
    subtitle: 'Spreadsheet / High-Density View',
    searchQuery: '',
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
    locations: () => [],
    prefixes: () => [],
    activeFilterChips: () => [],
    totalCount: 0,
    filteredCount: 0,
    loading: false,
    statusCounts: () => ({}),
    switchViewHref: '/inventory',
    switchViewLabel: 'Card Grid',
    switchViewIcon: 'solar:gallery-wide-linear',
    switchViewTitle: 'Switch to Visual Card Grid',
    viewMode: '',
  }
);

const emit = defineEmits([
  'update:searchQuery',
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
  'update:viewMode',
  'open-queues',
  'add',
  'import',
  'clear-filters',
]);

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
  return props.statusCounts?.[status] || 0;
};
</script>

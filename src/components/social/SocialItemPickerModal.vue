<template>
  <div v-if="isOpen" class="modal modal-open z-50">
    <div class="modal-box max-w-3xl max-h-[85vh] flex flex-col p-5 sm:p-6 bg-base-100 rounded-3xl border border-base-300 shadow-2xl">
      
      <!-- HEADER -->
      <div class="flex items-center justify-between pb-3 border-b border-base-200 shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-2xl bg-secondary/15 text-secondary flex items-center justify-center font-bold shrink-0">
            <Icon icon="solar:box-minimalistic-bold" class="w-5 h-5" />
          </div>
          <div>
            <h3 class="font-black text-base sm:text-lg text-base-content flex items-center gap-2">
              <span>Add Items to Social Post</span>
              <span class="badge badge-sm badge-secondary font-mono font-bold">{{ selectedIds.length }} selected</span>
            </h3>
            <p class="text-xs opacity-65">
              Select inventory items to feature in your post, carousel, and AI marketing copy.
            </p>
          </div>
        </div>

        <button 
          type="button" 
          @click="handleClose" 
          class="btn btn-sm btn-ghost btn-circle"
          title="Close modal"
        >
          <Icon icon="solar:close-circle-bold" class="w-6 h-6 opacity-60 hover:opacity-100" />
        </button>
      </div>

      <!-- SEARCH & FILTER TOOLBAR -->
      <div class="py-3.5 space-y-2.5 shrink-0">
        <div class="flex flex-col sm:flex-row items-center gap-2">
          <!-- Real-Time Search Input -->
          <div class="relative flex-1 w-full">
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="Search title, UPC, brand, tags..." 
              class="input input-sm input-bordered w-full pl-8 font-mono text-xs rounded-xl"
              autofocus
            />
            <Icon icon="solar:magnifer-linear" class="w-4 h-4 opacity-50 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <button 
              v-if="searchQuery" 
              type="button" 
              @click="searchQuery = ''" 
              class="btn btn-ghost btn-xs btn-circle absolute right-1.5 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </div>

          <!-- Location Filter Chips -->
          <div class="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button 
              type="button" 
              v-for="loc in locationFilters" 
              :key="loc.id"
              @click="activeLocation = loc.id"
              class="btn btn-xs rounded-lg font-bold font-mono transition-all shrink-0"
              :class="activeLocation === loc.id ? 'btn-neutral text-white shadow-xs' : 'btn-ghost border border-base-300 opacity-70'"
            >
              {{ loc.label }}
            </button>
          </div>
        </div>

        <!-- Filter Count & Quick Selection Controls -->
        <div class="flex items-center justify-between text-xs opacity-75 pt-1">
          <span>Showing {{ displayedItems.length }} available item{{ displayedItems.length === 1 ? '' : 's' }}</span>
          <div class="flex items-center gap-2">
            <button 
              type="button" 
              @click="selectAllFiltered" 
              class="link link-hover font-bold text-primary"
            >
              Select All ({{ displayedItems.length }})
            </button>
            <span class="opacity-30">•</span>
            <button 
              type="button" 
              @click="selectedIds = []" 
              class="link link-hover opacity-70"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <!-- ITEM LIST SCROLL AREA -->
      <div class="flex-1 overflow-y-auto space-y-2 min-h-[260px] max-h-[420px] pr-1 scrollbar-thin">
        
        <!-- Loading State -->
        <div v-if="loading && inventoryItems.length === 0" class="flex flex-col items-center justify-center p-12 text-center space-y-2">
          <span class="loading loading-spinner loading-md text-primary"></span>
          <p class="text-xs opacity-60 font-mono">Loading inventory items...</p>
        </div>

        <!-- Empty State -->
        <div v-else-if="displayedItems.length === 0" class="p-10 text-center space-y-2 rounded-2xl bg-base-200/40 border border-base-200">
          <Icon icon="solar:box-minimalistic-linear" class="w-8 h-8 opacity-30 mx-auto" />
          <p class="text-xs font-bold opacity-60">No available items match your filters</p>
          <p v-if="searchQuery" class="text-[11px] opacity-40">Try searching for a different keyword or location</p>
        </div>

        <!-- Item Rows -->
        <div 
          v-else 
          v-for="item in displayedItems" 
          :key="item.$id"
          @click="toggleSelection(item.$id)"
          class="flex items-center gap-3 p-2.5 rounded-2xl border transition-all cursor-pointer select-none group"
          :class="isItemSelected(item.$id) ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-base-200 hover:border-base-300 hover:bg-base-200/50'"
        >
          <!-- Checkbox -->
          <div 
            class="w-6 h-6 rounded-lg flex items-center justify-center transition-colors shrink-0 shadow-2xs"
            :class="isItemSelected(item.$id) ? 'bg-primary text-primary-content' : 'border border-base-300 bg-base-100 group-hover:border-primary/50 text-transparent'"
          >
            <Icon icon="solar:check-read-linear" class="w-4 h-4 font-black" />
          </div>

          <!-- Thumbnail -->
          <div class="w-12 h-12 rounded-xl overflow-hidden bg-base-300 shrink-0 border border-base-200 flex items-center justify-center">
            <img 
              v-if="resolveThumbnail(item)" 
              :src="resolveThumbnail(item)!" 
              :alt="item.title"
              class="w-full h-full object-cover"
              loading="lazy"
            />
            <Icon v-else icon="solar:gallery-linear" class="w-5 h-5 opacity-40" />
          </div>

          <!-- Item Details -->
          <div class="min-w-0 flex-1">
            <div class="font-bold text-xs sm:text-sm truncate text-base-content group-hover:text-primary transition-colors">
              {{ item.title }}
            </div>
            <div class="flex items-center gap-2 text-[10px] opacity-65 font-mono mt-0.5 flex-wrap">
              <span v-if="item.upc" class="font-bold text-primary">{{ item.upc }}</span>
              <span v-if="item.brand">• {{ item.brand }}</span>
              <span v-if="item.storageLocation" class="badge badge-xs badge-neutral font-mono">{{ item.storageLocation }}</span>
            </div>
          </div>

          <!-- Retail Price Tag -->
          <div class="text-right shrink-0">
            <div class="font-mono font-black text-secondary text-xs sm:text-sm">
              ${{ Number(item.boutiquePrice || item.resalePrice || item.price || 0).toFixed(2) }}
            </div>
          </div>
        </div>

      </div>

      <!-- FOOTER ACTIONS -->
      <div class="pt-4 mt-2 border-t border-base-200 flex items-center justify-between gap-3 shrink-0">
        <span class="text-xs font-mono opacity-65">
          {{ selectedIds.length }} item{{ selectedIds.length === 1 ? '' : 's' }} ready to stage
        </span>

        <div class="flex items-center gap-2">
          <button 
            type="button" 
            @click="handleClose" 
            class="btn btn-sm btn-ghost rounded-xl font-bold"
          >
            Cancel
          </button>

          <button 
            type="button" 
            @click="confirmAddItems" 
            :disabled="selectedIds.length === 0"
            class="btn btn-sm btn-secondary text-secondary-content rounded-xl font-black gap-1.5 shadow-md active:scale-95"
          >
            <Icon icon="solar:add-circle-bold" class="w-4 h-4" />
            <span>Add to Post ({{ selectedIds.length }})</span>
          </button>
        </div>
      </div>

    </div>
    <div class="modal-backdrop bg-black/60 backdrop-blur-xs" @click="handleClose"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { useInventory } from '../../composables/useInventory';
import { getItemImageUrl } from '../../composables/useInventoryFilters';
import { getItemImageUrls, type SocialStudioItem } from '../../lib/socialMediaStudio';

const props = withDefaults(defineProps<{
  isOpen: boolean;
  alreadyStagedIds: string[];
  initialLocation?: string;
}>(), {
  initialLocation: 'all'
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'add-items', items: SocialStudioItem[]): void;
}>();

const { inventoryItems, fetchInventory, loading } = useInventory();

const searchQuery = ref('');
const activeLocation = ref('all');
const selectedIds = ref<string[]>([]);

const locationFilters = [
  { id: 'all', label: 'All Items' },
  { id: 'MD', label: 'Memory Den' },
  { id: 'DT', label: 'Dusty Tiger' },
  { id: 'BACKSTOCK', label: 'Backstock' }
];

onMounted(() => {
  if (inventoryItems.value.length === 0) {
    fetchInventory();
  }
});

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    selectedIds.value = [];
    searchQuery.value = '';
    const loc = (props.initialLocation || '').toLowerCase();
    if (loc.includes('memory') || loc === 'md') {
      activeLocation.value = 'MD';
    } else if (loc.includes('dusty') || loc === 'dt') {
      activeLocation.value = 'DT';
    } else {
      activeLocation.value = 'all';
    }
    if (inventoryItems.value.length === 0) {
      fetchInventory();
    }
  }
});

const alreadyStagedSet = computed(() => new Set(props.alreadyStagedIds));

const displayedItems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const loc = activeLocation.value.toLowerCase();

  return inventoryItems.value.filter(item => {
    // Exclude items already in this post
    if (alreadyStagedSet.value.has(item.$id)) return false;

    // Location filter
    if (loc !== 'all') {
      const itemLoc = (item.storageLocation || '').toLowerCase();
      if (!itemLoc.includes(loc)) return false;
    }

    // Search query filter
    if (query) {
      const title = (item.title || '').toLowerCase();
      const upc = (item.upc || '').toLowerCase();
      const brand = (item.brand || '').toLowerCase();
      const cat = (item.category || '').toLowerCase();
      if (!title.includes(query) && !upc.includes(query) && !brand.includes(query) && !cat.includes(query)) {
        return false;
      }
    }

    return true;
  });
});

function isItemSelected(id: string): boolean {
  return selectedIds.value.includes(id);
}

function toggleSelection(id: string) {
  const idx = selectedIds.value.indexOf(id);
  if (idx !== -1) {
    selectedIds.value.splice(idx, 1);
  } else {
    selectedIds.value.push(id);
  }
}

function selectAllFiltered() {
  const newSet = new Set(selectedIds.value);
  for (const item of displayedItems.value) {
    newSet.add(item.$id);
  }
  selectedIds.value = Array.from(newSet);
}

function resolveThumbnail(item: any): string | null {
  const urls = getItemImageUrls(item);
  if (urls.length > 0) return urls[0];
  return getItemImageUrl(item, 100);
}

function handleClose() {
  emit('close');
}

function confirmAddItems() {
  if (selectedIds.value.length === 0) return;
  const idSet = new Set(selectedIds.value);
  const itemsToAdd: SocialStudioItem[] = inventoryItems.value
    .filter(it => idSet.has(it.$id))
    .map(it => ({
      ...it,
      title: it.title || 'Item ' + it.$id,
      resalePrice: it.boutiquePrice || it.resalePrice || it.price || 0,
      boutiquePrice: it.boutiquePrice || it.resalePrice || it.price || 0,
      upc: it.upc,
      imageId: it.imageId || (Array.isArray(it.images) && it.images[0])
    }));

  emit('add-items', itemsToAdd);
  handleClose();
}
</script>

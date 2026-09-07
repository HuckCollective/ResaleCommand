<template>
  <div v-if="currentTracker && showTray" class="relative z-50">
    <!-- EXPANDABLE MANIFEST DRAWER / MODAL -->
    <div 
      class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end transition-opacity"
      @click.self="toggleTray"
    >
      <div class="bg-base-100 border-t border-base-300 rounded-t-3xl max-w-2xl mx-auto w-full max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200 overflow-hidden">
        
        <!-- Drawer Header with Inline Title Editing -->
        <div class="p-4 sm:p-5 border-b border-base-300 flex items-center justify-between gap-3 shrink-0">
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Icon icon="lucide:truck" class="w-6 h-6" />
            </div>
            <div class="min-w-0 flex-1">
              <!-- Title Row: Display or Inline Edit Mode -->
              <div class="flex items-center gap-2 flex-wrap">
                <template v-if="isEditingTitle">
                  <div class="flex items-center gap-1.5 flex-1 max-w-sm">
                    <input 
                      ref="titleInputRef"
                      v-model="editedTitle" 
                      type="text" 
                      class="input input-xs sm:input-sm input-bordered font-bold text-sm w-full"
                      placeholder="Tracker Title / Vendor"
                      @keyup.enter="saveTitle"
                      @keyup.esc="cancelEditTitle"
                    />
                    <button 
                      @click="saveTitle" 
                      :disabled="savingTitle || !editedTitle.trim()"
                      class="btn btn-xs sm:btn-sm btn-primary text-primary-content font-bold px-2 shrink-0" 
                      title="Save Title"
                    >
                      <Icon icon="solar:check-read-linear" class="w-4 h-4" />
                    </button>
                    <button 
                      @click="cancelEditTitle" 
                      class="btn btn-xs sm:btn-sm btn-ghost px-2 shrink-0" 
                      title="Cancel"
                    >
                      ✕
                    </button>
                  </div>
                </template>
                <template v-else>
                  <h3 class="text-base sm:text-lg font-black text-base-content truncate">
                    {{ currentTracker.vendor || 'Buy Tracker' }}
                  </h3>
                  <button 
                    @click="startEditTitle" 
                    class="btn btn-ghost btn-xs btn-circle opacity-60 hover:opacity-100 hover:bg-base-200"
                    title="Rename Tracker"
                  >
                    <Icon icon="solar:pen-bold" class="w-3.5 h-3.5 text-primary" />
                  </button>
                  <span v-if="activePurchase" class="badge badge-warning badge-sm font-bold shrink-0">
                    Active Tracker
                  </span>
                  <span v-else class="badge badge-outline badge-warning badge-sm font-bold shrink-0">
                    Paused
                  </span>
                </template>
              </div>

              <div class="text-xs font-mono opacity-50 flex items-center gap-2 mt-0.5">
                <span class="truncate">{{ currentTracker.poNumber || currentTracker.orderId || 'Draft' }}</span>
                <span>•</span>
                <span class="shrink-0">{{ displayItemCount }} total {{ displayItemCount === 1 ? 'item' : 'items' }}</span>
              </div>
            </div>
          </div>

          <!-- Right side of header: Switch Tracker & Close -->
          <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button 
              @click="goToScoutHome" 
              type="button"
              class="btn btn-ghost btn-xs sm:btn-sm gap-1.5 font-bold text-xs rounded-xl bg-base-200/80 hover:bg-primary/15 hover:text-primary border border-base-300 transition-all"
              title="Go to Scout Home to view & switch trackers"
            >
              <Icon icon="solar:widget-2-bold" class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
              <span class="font-extrabold text-[11px] sm:text-xs">Switch Tracker</span>
            </button>

            <button @click="toggleTray" type="button" class="btn btn-ghost btn-sm btn-circle shrink-0" title="Close manifest">
              <Icon icon="solar:close-circle-bold" class="w-6 h-6 opacity-60 hover:opacity-100" />
            </button>
          </div>
        </div>

        <!-- Financial Summary Banner -->
        <div class="bg-base-200/60 p-3 sm:p-4 border-b border-base-300 shrink-0 space-y-2.5">
          <div class="grid grid-cols-4 gap-1.5 sm:gap-2 text-center">
            <div class="bg-base-100 p-1.5 sm:p-2 rounded-xl border border-base-300/80">
              <div class="text-[9px] uppercase font-bold opacity-60 truncate">Planned Cost</div>
              <div class="font-mono font-black text-xs sm:text-base text-warning truncate">${{ displayCost.toFixed(2) }}</div>
            </div>
            <div class="bg-base-100 p-1.5 sm:p-2 rounded-xl border border-base-300/80">
              <div class="text-[9px] uppercase font-bold opacity-60 truncate">Boutique Ret.</div>
              <div class="font-mono font-black text-xs sm:text-base text-secondary truncate">${{ displayBoutiqueValue.toFixed(2) }}</div>
            </div>
            <div class="bg-base-100 p-1.5 sm:p-2 rounded-xl border border-base-300/80">
              <div class="text-[9px] uppercase font-bold opacity-60 truncate">Est. Profit</div>
              <div class="font-mono font-black text-xs sm:text-base text-success truncate">+${{ displayProfit.toFixed(2) }}</div>
            </div>
            <div class="bg-base-100 p-1.5 sm:p-2 rounded-xl border border-base-300/80">
              <div class="text-[9px] uppercase font-bold opacity-60 truncate">ROI Multiple</div>
              <div class="font-mono font-black text-xs sm:text-base text-primary truncate">{{ roiMultiple }}</div>
            </div>
          </div>

          <!-- Tier Breakdown Chips -->
          <div class="flex items-center justify-center gap-2 flex-wrap text-xs">
            <span class="badge badge-secondary badge-sm font-bold gap-1">
              🌟 Showcase: {{ tierBreakdown.showcase }}
            </span>
            <span class="badge badge-primary badge-sm font-bold gap-1">
              📦 Core: {{ tierBreakdown.core }}
            </span>
            <span class="badge badge-accent badge-sm font-bold gap-1">
              ⚡ Quick Turn: {{ tierBreakdown.quickTurn }}
            </span>
            <span v-if="lotItems.length > 0" class="badge badge-outline badge-sm font-bold gap-1">
              📦 Lots: {{ lotItems.length }}
            </span>
          </div>
        </div>

        <!-- Manifest Items List -->
        <div class="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-48">
          <div v-if="purchaseItems.length === 0" class="text-center py-12 text-base-content/50 space-y-2">
            <Icon icon="solar:scanner-linear" class="w-10 h-10 mx-auto opacity-30" />
            <p class="text-sm font-bold">Your buy tracker is empty.</p>
            <p class="text-xs max-w-xs mx-auto">Scan photos or paste screenshots in Scout to tally items here!</p>
          </div>

          <div 
            v-for="item in purchaseItems" 
            :key="item.$id"
            @click="openPreview(item)"
            class="bg-base-200/50 border border-base-300 rounded-2xl p-3 flex items-center justify-between gap-3 hover:border-primary/40 transition-all cursor-pointer group"
          >
            <!-- Thumbnail / Icon -->
            <div class="w-12 h-12 rounded-xl bg-base-300 flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
              <img 
                v-if="item.imageId" 
                :src="getImageUrl(item.imageId)" 
                @error="handleImageError($event, item.imageId)"
                class="w-full h-full object-cover" 
                alt="Item thumbnail"
              />
              <Icon v-else-if="item.isLot" icon="solar:box-bold" class="w-6 h-6 text-primary" />
              <Icon v-else icon="solar:tag-bold" class="w-6 h-6 opacity-40" />
            </div>

            <!-- Title & Details -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span v-if="getItemTier(item)" class="badge badge-xs font-bold" :class="getItemTier(item)?.class">
                  {{ getItemTier(item)?.label }}
                </span>
                <span v-if="item.isLot" class="badge badge-xs badge-outline badge-secondary font-bold">
                  {{ item.lotItemsCount || 0 }} Items In Lot
                </span>
                <h4 class="font-bold text-xs text-base-content truncate group-hover:text-primary transition-colors">
                  {{ cleanItemTitle(item.title) }}
                </h4>
              </div>

              <div class="flex items-center gap-2 text-[10px] opacity-70 mt-1">
                <span>Cost: <strong class="text-warning font-mono">${{ (item.cost || 0).toFixed(2) }}</strong></span>
                <span>•</span>
                <span>Boutique: <strong class="text-secondary font-mono">${{ (item.boutiquePrice || item.resalePrice || 0).toFixed(2) }}</strong></span>
              </div>
            </div>

            <!-- Item Action Buttons (Preview, Edit, Delete) -->
            <div class="flex items-center gap-1 shrink-0" @click.stop>
              <!-- Preview Modal Button -->
              <button 
                type="button"
                @click="openPreview(item)"
                class="btn btn-ghost btn-xs btn-circle opacity-70 hover:opacity-100 hover:bg-base-300"
                title="Preview full item details"
              >
                <Icon icon="solar:eye-linear" class="w-4 h-4" />
              </button>

              <!-- ItemDrawer Editor Button -->
              <button 
                type="button"
                @click="openEdit(item)"
                class="btn btn-ghost btn-xs btn-circle text-primary opacity-80 hover:opacity-100 hover:bg-primary/10"
                title="Edit item details"
              >
                <Icon icon="solar:pen-linear" class="w-4 h-4" />
              </button>

              <!-- Remove Item Button -->
              <button 
                type="button"
                @click="handleRemoveItem(item.$id)"
                class="btn btn-ghost btn-xs btn-circle text-error/60 hover:text-error hover:bg-error/10"
                title="Remove from purchase"
              >
                <Icon icon="solar:trash-bin-trash-linear" class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <!-- Drawer Footer: Hero Action (State C: Purchase It / State B: + Add Here) -->
        <div class="p-3 sm:p-4 border-t border-base-300 bg-base-200/70 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-baseline justify-between sm:block">
            <div class="text-[10px] uppercase font-bold tracking-wider opacity-60 whitespace-nowrap">Total Cost To Pay</div>
            <div class="text-xl sm:text-2xl font-black text-warning font-mono">${{ totalCost.toFixed(2) }}</div>
          </div>

          <div class="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap sm:flex-nowrap">
            <!-- Go to Scout Home / Switch Tracker -->
            <button 
              type="button"
              @click="goToScoutHome" 
              class="btn btn-ghost btn-sm font-bold gap-1.5 text-xs sm:text-sm text-base-content/80 hover:text-primary hover:bg-primary/10 rounded-xl"
              title="Go to Scout Home to switch trackers"
            >
              <Icon icon="solar:widget-2-bold" class="w-4 h-4 text-primary" />
              <span>All Trackers</span>
            </button>

            <button 
              type="button"
              @click="toggleTray" 
              class="btn btn-ghost btn-sm font-bold flex-1 sm:flex-initial rounded-xl"
            >
              Keep Scouting
            </button>

            <!-- State C (Active Tracker): Purchase It Hero Action in Footer -->
            <button 
              v-if="activePurchase"
              type="button"
              @click="handleCompletePurchase"
              :disabled="completing || purchaseItems.length === 0"
              class="btn btn-success btn-sm sm:btn-md font-black text-success-content shadow-lg px-4 sm:px-6 flex-[1.5] sm:flex-initial gap-2 shrink-0 active:scale-95 transition-all"
              title="Open Draft Purchase Order to review and finalize"
            >
              <span v-if="completing" class="loading loading-spinner loading-sm"></span>
              <template v-else>
                <Icon icon="lucide:truck" class="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span class="whitespace-nowrap">Purchase It (${{ displayCost.toFixed(2) }})</span>
              </template>
            </button>

            <!-- State B (Paused Tracker): Resume Tracker Action in Footer -->
            <button 
              v-else-if="currentTracker"
              type="button"
              @click="handleResumeCurrentTracker"
              class="btn btn-primary btn-sm sm:btn-md font-black text-primary-content shadow-lg px-4 sm:px-6 flex-[1.5] sm:flex-initial gap-2 shrink-0 active:scale-95 transition-all"
              title="Resume this tracker and set as active"
            >
              <Icon icon="solar:play-circle-bold" class="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span class="whitespace-nowrap">Resume Tracker</span>
            </button>
          </div>
        </div>

      </div>
    </div>

    <!-- FULLSCREEN PREVIEW MODAL -->
    <ItemPreviewModal 
      v-if="previewItem"
      :item="previewItem" 
      @close="previewItem = null" 
      @edit="openEdit" 
    />

    <!-- ITEM DRAWER EDITOR -->
    <ItemDrawer 
      v-if="editingItem" 
      :item="editingItem" 
      @close="editingItem = null" 
      @save="handleItemSaved" 
      @saved="handleItemSaved" 
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import { useScoutPurchase, type ScoutPurchase, type ScoutPurchaseItem } from '../../composables/useScoutPurchase';
import { addToast } from '../../stores/toast';
import { BUCKET_ID, updateInventoryItem } from '../../lib/inventory';
import ItemPreviewModal from '../inventory/ItemPreviewModal.vue';
import ItemDrawer from '../common/ItemDrawer.vue';

const emit = defineEmits<{
  (e: 'toggle-tray'): void;
  (e: 'purchase-completed', purchaseId: string): void;
  (e: 'resume-tracker', purchase: ScoutPurchase): void;
  (e: 'go-to-list'): void;
}>();

const props = defineProps<{
  isOpen?: boolean;
  pausedTracker?: ScoutPurchase | null;
}>();

const { 
  activePurchase, 
  purchaseItems, 
  pausedTracker: composablePausedTracker,
  isTrayOpen: composableIsTrayOpen,
  singleItems, 
  lotItems, 
  totalCost, 
  totalBoutiqueValue, 
  projectedProfit, 
  roiMultiple, 
  tierBreakdown,
  removeItemFromPurchase,
  setActivePurchase,
  updatePurchaseTitle,
  fetchPurchaseItems,
  refreshActivePurchaseItems
} = useScoutPurchase();

const showTray = computed(() => {
  return props.isOpen !== undefined ? props.isOpen : composableIsTrayOpen.value;
});

const currentTracker = computed(() => {
  return activePurchase.value || props.pausedTracker || composablePausedTracker.value;
});

// Auto-fetch line items whenever tray is opened for a tracker
watch(
  [() => showTray.value, () => currentTracker.value?.$id],
  async ([open, trackerId]) => {
    if (open && trackerId) {
      await fetchPurchaseItems(trackerId);
    }
  },
  { immediate: true }
);

// Fallback metrics to avoid $0.00 while items load or when inspecting paused tracker
const displayCost = computed(() => {
  if (purchaseItems.value.length > 0) return totalCost.value;
  return currentTracker.value?.subtotal || 0;
});

const displayBoutiqueValue = computed(() => {
  if (purchaseItems.value.length > 0) return totalBoutiqueValue.value;
  return (currentTracker.value?.subtotal || 0) * 4;
});

const displayProfit = computed(() => {
  if (purchaseItems.value.length > 0) return projectedProfit.value;
  return Math.max(0, displayBoutiqueValue.value - displayCost.value);
});

const displayItemCount = computed(() => {
  if (purchaseItems.value.length > 0) return purchaseItems.value.length;
  return currentTracker.value?.itemCount || 0;
});

const completing = ref(false);

const toggleTray = () => {
  emit('toggle-tray');
  composableIsTrayOpen.value = false;
};

const goToScoutHome = () => {
  toggleTray();
  emit('go-to-list');
  if (typeof window !== 'undefined' && window.location.pathname !== '/scout') {
    window.location.href = '/scout';
  }
};

// -- TITLE EDITING STATE --
const isEditingTitle = ref(false);
const editedTitle = ref('');
const savingTitle = ref(false);
const titleInputRef = ref<HTMLInputElement | null>(null);

const startEditTitle = () => {
  if (!currentTracker.value) return;
  editedTitle.value = currentTracker.value.vendor || '';
  isEditingTitle.value = true;
  nextTick(() => {
    titleInputRef.value?.focus();
    titleInputRef.value?.select();
  });
};

const cancelEditTitle = () => {
  isEditingTitle.value = false;
};

const saveTitle = async () => {
  if (!currentTracker.value?.$id || !editedTitle.value.trim() || savingTitle.value) return;
  savingTitle.value = true;
  try {
    await updatePurchaseTitle(currentTracker.value.$id, editedTitle.value.trim());
    isEditingTitle.value = false;
    addToast({ type: 'success', message: `Renamed tracker to "${editedTitle.value.trim()}"` });
  } catch (err: any) {
    addToast({ type: 'error', message: 'Failed to rename tracker: ' + err.message });
  } finally {
    savingTitle.value = false;
  }
};

// -- ITEM PREVIEW & EDITOR STATE --
const previewItem = ref<any | null>(null);
const editingItem = ref<any | null>(null);

const openPreview = (item: any) => {
  previewItem.value = item;
};

const openEdit = (item: any) => {
  editingItem.value = { ...item };
};

const handleItemSaved = async (payload: any) => {
  if (!editingItem.value) return;
  try {
    await updateInventoryItem(editingItem.value.$id, payload);
    const idx = purchaseItems.value.findIndex(i => i.$id === editingItem.value?.$id);
    if (idx !== -1) {
      Object.assign(purchaseItems.value[idx], payload);
    }
    editingItem.value = null;
    addToast({ type: 'success', message: 'Item updated successfully!' });
    await refreshActivePurchaseItems();
  } catch (err: any) {
    addToast({ type: 'error', message: 'Failed to update item: ' + err.message });
  }
};

// -- REMOVE & COMPLETE --
const handleRemoveItem = async (itemId: string) => {
  try {
    await removeItemFromPurchase(itemId);
    addToast({ type: 'info', message: 'Item removed from purchase.' });
  } catch (err: any) {
    addToast({ type: 'error', message: 'Failed to remove item: ' + err.message });
  }
};

const handleCompletePurchase = async () => {
  if (!activePurchase.value) return;
  completing.value = true;
  try {
    const pId = activePurchase.value.$id;
    addToast({ type: 'info', message: '📋 Opening Draft Purchase Order...' });
    emit('purchase-completed', pId);
    window.location.href = `/purchases/${pId}`;
  } catch (err: any) {
    addToast({ type: 'error', message: 'Failed to open purchase: ' + err.message });
  } finally {
    completing.value = false;
  }
};

const handleResumeCurrentTracker = () => {
  if (!currentTracker.value) return;
  const target = currentTracker.value;
  setActivePurchase(target);
  toggleTray();
  emit('resume-tracker', target);
  addToast({ type: 'success', message: `Resumed tracker: ${target.vendor}` });
};

const getImageUrl = (imageId: string): string => {
  if (!imageId) return '';
  if (imageId.startsWith('http') || imageId.startsWith('data:') || imageId.startsWith('blob:')) return imageId;
  const ENDPOINT = import.meta.env.PUBLIC_APPWRITE_ENDPOINT;
  const PROJECT = import.meta.env.PUBLIC_APPWRITE_PROJECT_ID;
  const bucket = BUCKET_ID || 'item_images';
  return `${ENDPOINT}/storage/buckets/${bucket}/files/${imageId}/view?project=${PROJECT}`;
};

const handleImageError = (e: Event, imageId?: string) => {
  const target = e.target as HTMLImageElement;
  if (!target || !imageId) return;
  const ENDPOINT = import.meta.env.PUBLIC_APPWRITE_ENDPOINT;
  const PROJECT = import.meta.env.PUBLIC_APPWRITE_PROJECT_ID;
  if (target.src.includes('item_images_dev')) {
    target.src = `${ENDPOINT}/storage/buckets/item_images/files/${imageId}/view?project=${PROJECT}`;
  } else if (target.src.includes('item_images')) {
    target.src = `${ENDPOINT}/storage/buckets/item_images_dev/files/${imageId}/view?project=${PROJECT}`;
  }
};

const cleanItemTitle = (title?: string): string => {
  if (!title) return 'Untitled Item';
  return title.replace(/\[Tier \d[^\]]*\]\s*/i, '').trim();
};

const getItemTier = (item: ScoutPurchaseItem) => {
  const raw = (item.rawAnalysis || '').toLowerCase();
  const title = (item.title || '').toLowerCase();
  if (raw.includes('"tier":"showcase"') || raw.includes('tier 1') || title.includes('showcase')) {
    return { label: '🌟 Showcase', class: 'badge-secondary text-secondary-content' };
  }
  if (raw.includes('"tier":"quick_turn"') || raw.includes('tier 3') || title.includes('quick turn')) {
    return { label: '⚡ Quick Turn', class: 'badge-accent text-accent-content' };
  }
  return { label: '📦 Core', class: 'badge-primary text-primary-content' };
};
</script>

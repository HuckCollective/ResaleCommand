<template>
  <div v-if="currentTracker && showTray" class="relative z-[70]">
    <!-- EXPANDABLE MANIFEST DRAWER / MODAL -->
    <div 
      class="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex flex-col justify-end transition-opacity"
      @click.self="toggleTray"
    >
      <div class="bg-base-100 border-t border-base-300 rounded-t-3xl max-w-2xl mx-auto w-full max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200 overflow-hidden">
        
        <!-- Drawer Header with Inline Title Editing -->
        <div class="px-4 py-3 sm:px-5 sm:py-4 border-b border-base-300 flex items-center justify-between gap-3 shrink-0">
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
                <button 
                  v-if="activePurchase" 
                  type="button"
                  @click="handlePauseCurrentTracker"
                  class="badge badge-warning badge-sm font-bold gap-1 cursor-pointer hover:opacity-85 active:scale-95 transition-all select-none border-0 shadow-xs"
                  title="Active tracker — Tap to pause"
                >
                  <Icon icon="solar:pause-circle-bold" class="w-3 h-3" />
                  <span>Pause Tracker</span>
                </button>
                <button 
                  v-else 
                  type="button"
                  @click="handleResumeCurrentTracker"
                  class="badge badge-outline badge-warning badge-sm font-bold gap-1 cursor-pointer hover:bg-warning/20 active:scale-95 transition-all select-none"
                  title="Paused tracker — Tap to resume"
                >
                  <Icon icon="solar:play-circle-bold" class="w-3 h-3" />
                  <span>Resume Tracker</span>
                </button>
              </template>
            </div>

            <div class="text-xs font-mono flex items-center gap-2 mt-0.5">
              <a 
                v-if="currentTracker && (currentTracker.poNumber || currentTracker.$id)" 
                :href="`/purchases/${currentTracker.poNumber || currentTracker.$id}`" 
                class="truncate font-bold text-primary hover:underline inline-flex items-center gap-0.5 group/traypo"
                title="Open Purchase Order Details"
              >
                <span class="truncate">{{ currentTracker.poNumber || currentTracker.orderId || 'Draft' }}</span>
                <Icon icon="solar:arrow-right-up-linear" class="w-3 h-3 opacity-60 group-hover/traypo:opacity-100 transition-opacity shrink-0" />
              </a>
              <span v-else class="truncate opacity-50">{{ currentTracker?.poNumber || currentTracker?.orderId || 'Draft' }}</span>
              <span class="opacity-40">•</span>
              <span class="shrink-0 opacity-60">{{ displayItemCount }} total {{ displayItemCount === 1 ? 'item' : 'items' }}</span>
            </div>
          </div>

          <!-- Right side of header: Close only -->
          <button @click="toggleTray" type="button" class="btn btn-ghost btn-sm btn-circle shrink-0" title="Close manifest">
            <Icon icon="solar:close-circle-bold" class="w-6 h-6 opacity-60 hover:opacity-100" />
          </button>
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
            <span class="badge badge-secondary text-secondary-content badge-sm font-bold whitespace-nowrap gap-1">
              🌟 Showcase: {{ tierBreakdown.showcase }}
            </span>
            <span class="badge badge-primary text-primary-content badge-sm font-bold whitespace-nowrap gap-1">
              📦 Core: {{ tierBreakdown.core }}
            </span>
            <span class="badge badge-accent text-accent-content badge-sm font-bold whitespace-nowrap gap-1">
              ⚡ Quick Turn: {{ tierBreakdown.quickTurn }}
            </span>
            <span v-if="lotItems.length > 0" class="badge badge-outline badge-sm font-bold whitespace-nowrap gap-1">
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
            @click="openEdit(item)"
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

            <!-- Title & Details (Clicking row opens edit directly) -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span v-if="getItemTier(item)" class="badge badge-xs font-bold whitespace-nowrap" :class="getItemTier(item)?.class">
                  {{ getItemTier(item)?.label }}
                </span>
                <span v-if="item.isLot" class="badge badge-xs badge-outline badge-secondary font-bold whitespace-nowrap">
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

            <!-- Item Action: Delete icon (opens confirmation modal) -->
            <div class="shrink-0" @click.stop>
              <button 
                type="button"
                @click.stop="itemPendingDelete = item"
                class="btn btn-ghost btn-xs btn-circle text-error/60 hover:text-error hover:bg-error/10 transition-all"
                title="Remove item from tracker"
              >
                <Icon icon="solar:trash-bin-trash-linear" class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <!-- Drawer Footer (Clean Symmetrical Dock) -->
        <div class="p-3 sm:p-4 border-t border-base-300 bg-base-200/90 backdrop-blur-md flex flex-col gap-2.5 shrink-0">
          <!-- Row 1: Equal-width 50/50 Utility Buttons based on container width -->
          <div class="grid grid-cols-2 gap-2 w-full">
            <button 
              @click="goToScoutHome" 
              type="button"
              class="btn btn-ghost btn-sm gap-1.5 font-bold text-xs rounded-xl bg-base-100 hover:bg-base-300 border border-base-300 transition-all h-10 w-full flex items-center justify-center shadow-xs"
              title="View all trackers"
            >
              <Icon icon="solar:widget-2-bold" class="w-4 h-4 text-primary" />
              <span>All Trackers</span>
            </button>

            <button 
              type="button"
              @click="isDeleteTrackerModalOpen = true"
              class="btn btn-ghost btn-sm text-error hover:bg-error/15 border border-error/25 rounded-xl gap-1.5 h-10 w-full flex items-center justify-center transition-all shadow-xs"
              title="Delete this tracker and all associated items"
            >
              <Icon icon="solar:trash-bin-trash-linear" class="w-4 h-4" />
              <span>Delete Tracker</span>
            </button>
          </div>

          <!-- Row 2: Full-width Hero Action (Purchase It or Resume) -->
          <div class="w-full">
            <!-- Active Tracker state: 100% width Purchase It button -->
            <template v-if="activePurchase">
              <button 
                type="button"
                @click="handleCompletePurchase"
                :disabled="completing || purchaseItems.length === 0"
                class="btn btn-success w-full font-black text-success-content shadow-lg px-4 gap-2 h-11 active:scale-95 transition-all text-sm sm:text-base flex items-center justify-center"
                title="Open Draft Purchase Order to review and finalize"
              >
                <span v-if="completing" class="loading loading-spinner loading-xs"></span>
                <template v-else>
                  <Icon icon="lucide:truck" class="w-5 h-5 shrink-0" />
                  <span class="whitespace-nowrap">Purchase It (${{ displayCost.toFixed(2) }})</span>
                </template>
              </button>
            </template>

            <!-- Paused Tracker state: 100% width Resume Tracker button -->
            <template v-else-if="currentTracker">
              <button 
                type="button"
                @click="handleResumeCurrentTracker"
                class="btn btn-success w-full font-black text-success-content shadow-lg px-4 gap-2 h-11 active:scale-95 transition-all text-sm sm:text-base flex items-center justify-center"
                title="Resume this tracker and set as active"
              >
                <Icon icon="solar:play-circle-bold" class="w-5 h-5 shrink-0" />
                <span class="whitespace-nowrap">Resume Tracker</span>
              </button>
            </template>
          </div>
        </div>

      </div>
    </div>

    <!-- 1. DELETE TRACKER CONFIRMATION MODAL -->
    <dialog class="modal modal-bottom sm:modal-middle z-[80]" :class="{ 'modal-open': isDeleteTrackerModalOpen }">
      <div v-if="isDeleteTrackerModalOpen" class="modal-box bg-base-100 border border-base-300 shadow-2xl rounded-3xl p-5 sm:p-6 max-w-sm mx-auto">
        <div class="flex items-center gap-3 text-error mb-3">
          <div class="w-10 h-10 rounded-2xl bg-error/15 flex items-center justify-center shrink-0">
            <Icon icon="solar:trash-bin-trash-bold" class="w-6 h-6 text-error" />
          </div>
          <div>
            <h3 class="font-black text-base sm:text-lg text-base-content">Delete Tracker?</h3>
            <p class="text-xs opacity-60 font-mono">{{ currentTracker?.vendor || 'Buy Tracker' }}</p>
          </div>
        </div>
        
        <p class="text-xs sm:text-sm text-base-content/80 mb-5 leading-relaxed">
          This will permanently delete this tracker, along with all <strong>{{ displayItemCount }} {{ displayItemCount === 1 ? 'item' : 'items' }}</strong> and uploaded photos. This action cannot be undone.
        </p>

        <div class="modal-action flex items-center gap-2 mt-0">
          <button 
            type="button" 
            @click="isDeleteTrackerModalOpen = false" 
            class="btn btn-ghost flex-1 rounded-xl font-bold"
            :disabled="isDeletingTracker"
          >
            Cancel
          </button>
          <button 
            type="button" 
            @click="handleDeleteTracker" 
            class="btn btn-error flex-1 rounded-xl font-black text-error-content shadow-md gap-1.5"
            :disabled="isDeletingTracker"
          >
            <span v-if="isDeletingTracker" class="loading loading-spinner loading-xs"></span>
            <Icon v-else icon="solar:trash-bin-trash-bold" class="w-4 h-4" />
            <span>Yes, Delete Tracker</span>
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="isDeleteTrackerModalOpen = false">
        <button>close</button>
      </form>
    </dialog>

    <!-- 2. REMOVE ITEM CONFIRMATION MODAL -->
    <dialog class="modal modal-bottom sm:modal-middle z-[80]" :class="{ 'modal-open': !!itemPendingDelete }">
      <div v-if="itemPendingDelete" class="modal-box bg-base-100 border border-base-300 shadow-2xl rounded-3xl p-5 sm:p-6 max-w-sm mx-auto">
        <div class="flex items-center gap-3 text-error mb-3">
          <div class="w-10 h-10 rounded-2xl bg-error/15 flex items-center justify-center shrink-0">
            <Icon icon="solar:trash-bin-trash-bold" class="w-6 h-6 text-error" />
          </div>
          <div>
            <h3 class="font-black text-base sm:text-lg text-base-content">Remove Item?</h3>
            <p class="text-xs opacity-60 font-mono">From {{ currentTracker?.vendor || 'Tracker' }}</p>
          </div>
        </div>
        
        <div class="bg-base-200/60 p-2.5 rounded-xl flex items-center gap-2.5 mb-4 border border-base-300">
          <div class="w-10 h-10 rounded-lg bg-base-300 overflow-hidden shrink-0">
            <img v-if="itemPendingDelete.imageId" :src="getImageUrl(itemPendingDelete.imageId)" class="w-full h-full object-cover" />
            <Icon v-else icon="solar:tag-bold" class="w-5 h-5 m-2.5 opacity-40" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="font-bold text-xs text-base-content truncate">{{ cleanItemTitle(itemPendingDelete.title) }}</div>
            <div class="text-[11px] font-mono text-warning font-bold">${{ (itemPendingDelete.cost || 0).toFixed(2) }}</div>
          </div>
        </div>

        <p class="text-xs text-base-content/70 mb-5 leading-relaxed">
          Are you sure you want to remove this item from your scouting manifest?
        </p>

        <div class="modal-action flex items-center gap-2 mt-0">
          <button 
            type="button" 
            @click="itemPendingDelete = null" 
            class="btn btn-ghost flex-1 rounded-xl font-bold"
            :disabled="isRemovingItem"
          >
            Cancel
          </button>
          <button 
            type="button" 
            @click="confirmRemoveItem" 
            class="btn btn-error flex-1 rounded-xl font-black text-error-content shadow-md gap-1.5"
            :disabled="isRemovingItem"
          >
            <span v-if="isRemovingItem" class="loading loading-spinner loading-xs"></span>
            <Icon v-else icon="solar:trash-bin-trash-bold" class="w-4 h-4" />
            <span>Remove Item</span>
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="itemPendingDelete = null">
        <button>close</button>
      </form>
    </dialog>

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
  pauseTracker,
  resumeTracker,
  discardPurchase,
  updatePurchaseTitle,
  fetchPurchaseItems,
  loadDraftPurchases,
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

// -- MANUAL TRAY REFRESH --
const isRefreshingTray = ref(false);
const handleManualRefresh = async () => {
  if (!currentTracker.value?.$id || isRefreshingTray.value) return;
  isRefreshingTray.value = true;
  try {
    await fetchPurchaseItems(currentTracker.value.$id);
    await loadDraftPurchases();
    addToast({ type: 'info', message: 'Tracker data refreshed' });
  } catch (e: any) {
    console.warn('[ScoutPurchaseTray] Manual refresh error:', e);
  } finally {
    isRefreshingTray.value = false;
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
const itemPendingDelete = ref<ScoutPurchaseItem | null>(null);
const isRemovingItem = ref(false);

const confirmRemoveItem = async () => {
  if (!itemPendingDelete.value) return;
  isRemovingItem.value = true;
  try {
    const trackerId = currentTracker.value?.$id;
    await removeItemFromPurchase(itemPendingDelete.value.$id, trackerId);
    addToast({ type: 'info', message: 'Item removed from tracker.' });
    itemPendingDelete.value = null;
  } catch (err: any) {
    addToast({ type: 'error', message: 'Failed to remove item: ' + err.message });
  } finally {
    isRemovingItem.value = false;
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

const handlePauseCurrentTracker = () => {
  if (!currentTracker.value) return;
  const vendorName = currentTracker.value.vendor || 'Buy Tracker';
  pauseTracker();
  addToast({ type: 'warning', message: `⏸️ Paused tracker: ${vendorName}` });
};

const handleResumeCurrentTracker = async () => {
  if (!currentTracker.value) return;
  const target = await resumeTracker(currentTracker.value);
  if (target) {
    toggleTray();
    emit('resume-tracker', target);
    addToast({ type: 'success', message: `▶️ Resumed tracker: ${target.vendor}` });
  }
};

const isDeleteTrackerModalOpen = ref(false);
const isDeletingTracker = ref(false);

const handleDeleteTracker = async () => {
  if (!currentTracker.value?.$id || isDeletingTracker.value) return;
  isDeletingTracker.value = true;
  try {
    const targetId = currentTracker.value.$id;
    const vendorName = currentTracker.value.vendor || 'Buy Tracker';
    await discardPurchase(targetId);
    isDeleteTrackerModalOpen.value = false;
    toggleTray();
    addToast({ type: 'info', message: `🗑️ Deleted ${vendorName} and all associated items.` });
  } catch (e: any) {
    addToast({ type: 'error', message: 'Failed to delete tracker: ' + e.message });
  } finally {
    isDeletingTracker.value = false;
  }
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

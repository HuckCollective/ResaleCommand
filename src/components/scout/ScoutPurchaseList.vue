<template>
  <div class="space-y-6 pb-36">
    <!-- Top Financial Summary Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <!-- Active Drafts -->
      <div class="bg-base-200/60 border border-base-300 rounded-2xl p-4 flex items-center justify-between shadow-xs">
        <div>
          <div class="text-[10px] uppercase font-bold tracking-wider opacity-60">Buy Trackers</div>
          <div class="text-2xl sm:text-3xl font-black text-primary mt-0.5">{{ draftPurchases.length }}</div>
        </div>
        <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon icon="lucide:truck" class="w-6 h-6" />
        </div>
      </div>

      <!-- Planned Spend -->
      <div class="bg-base-200/60 border border-base-300 rounded-2xl p-4 flex items-center justify-between shadow-xs">
        <div>
          <div class="text-[10px] uppercase font-bold tracking-wider opacity-60">Planned Cost</div>
          <div class="text-2xl sm:text-3xl font-black text-warning mt-0.5">${{ aggregateTotals.cost.toFixed(2) }}</div>
        </div>
        <div class="w-10 h-10 rounded-xl bg-warning/10 text-warning flex items-center justify-center shrink-0">
          <Icon icon="solar:wallet-money-bold" class="w-6 h-6" />
        </div>
      </div>

      <!-- Retail Boutique Potential -->
      <div class="bg-base-200/60 border border-base-300 rounded-2xl p-4 flex items-center justify-between shadow-xs">
        <div>
          <div class="text-[10px] uppercase font-bold tracking-wider opacity-60">Boutique Potential</div>
          <div class="text-2xl sm:text-3xl font-black text-secondary mt-0.5">${{ aggregateTotals.boutique.toFixed(2) }}</div>
        </div>
        <div class="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
          <Icon icon="solar:star-fall-minimalistic-2-bold" class="w-6 h-6" />
        </div>
      </div>

      <!-- ROI Multiple -->
      <div class="bg-base-200/60 border border-base-300 rounded-2xl p-4 flex items-center justify-between shadow-xs">
        <div>
          <div class="text-[10px] uppercase font-bold tracking-wider opacity-60">Projected ROI</div>
          <div class="text-2xl sm:text-3xl font-black text-success mt-0.5">{{ aggregateTotals.roi }}</div>
        </div>
        <div class="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center shrink-0">
          <Icon icon="solar:chart-2-bold" class="w-6 h-6" />
        </div>
      </div>
    </div>

    <!-- Section Header -->
    <div class="bg-base-100 p-4 rounded-2xl border border-base-300 shadow-sm">
      <h2 class="text-lg sm:text-xl font-black text-base-content flex items-center gap-2">
        <Icon icon="lucide:truck" class="text-primary w-5 h-5" />
        Buy Trackers
      </h2>
      <p class="text-xs opacity-60 mt-0.5">
        Active sourcing runs and buy trackers holding multiple items & lots before purchase
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="loading && draftPurchases.length === 0" class="flex flex-col items-center justify-center py-16 text-center space-y-3">
      <span class="loading loading-spinner loading-lg text-primary"></span>
      <p class="text-xs font-bold uppercase tracking-wider opacity-50">Loading your draft deals...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="draftPurchases.length === 0" class="card bg-base-100 border border-base-300 shadow-sm p-8 sm:p-12 text-center space-y-4">
      <div class="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
        <Icon icon="solar:cart-large-minimalistic-bold" class="w-8 h-8" />
      </div>
      <div class="space-y-1">
        <h3 class="text-lg font-black text-base-content">No Active Buy Trackers</h3>
        <p class="text-xs text-base-content/60 max-w-sm mx-auto">
          Start a new Buy Tracker when you arrive at a sourcing haul, or use Quick Scan for one-off lookups.
        </p>
      </div>
      <div class="flex justify-center gap-3 pt-2">
        <button @click="emit('quick-scan')" class="btn btn-outline btn-sm font-bold">
          ⚡ Try Quick Scan
        </button>
        <button @click="isModalOpen = true" class="btn btn-primary btn-sm font-black text-primary-content shadow-md">
          Start Buy Tracker
        </button>
      </div>
    </div>

    <!-- Purchase Cards Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div 
        v-for="purchase in sortedDraftPurchases" 
        :key="purchase.$id" 
        class="card bg-base-100 border border-base-300 shadow-sm hover:shadow-md hover:border-primary/50 transition-all rounded-3xl overflow-hidden flex flex-col justify-between group"
      >
        <!-- Card Header -->
        <div class="p-5 border-b border-base-200 bg-base-200/20">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Icon :icon="getVendorIcon(purchase.vendor)" class="w-5 h-5" />
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <template v-if="editingPurchaseId === purchase.$id">
                    <div class="flex items-center gap-1" @click.stop>
                      <input 
                        :id="`edit-tracker-input-${purchase.$id}`"
                        v-model="editingPurchaseTitle" 
                        type="text" 
                        class="input input-xs input-bordered font-bold text-sm w-36 sm:w-48 bg-base-100"
                        placeholder="Tracker name"
                        @keyup.enter="saveCardTitle(purchase.$id)"
                        @keyup.esc="cancelCardTitle"
                        @blur="saveCardTitle(purchase.$id)"
                      />
                      <button 
                        @click.stop="saveCardTitle(purchase.$id)" 
                        :disabled="savingCardTitle" 
                        class="btn btn-xs btn-primary text-primary-content btn-circle"
                        title="Save name"
                      >
                        <Icon icon="solar:check-read-linear" class="w-3.5 h-3.5" />
                      </button>
                      <button 
                        @click.stop="cancelCardTitle" 
                        class="btn btn-xs btn-ghost btn-circle"
                        title="Cancel"
                      >
                        ✕
                      </button>
                    </div>
                  </template>
                  <template v-else>
                    <h3 
                      @click.stop="startCardTitleEdit(purchase)"
                      class="font-black text-base text-base-content truncate group-hover:text-primary transition-colors cursor-pointer hover:underline"
                      title="Click to rename"
                    >
                      {{ purchase.vendor || 'Buy Tracker' }}
                    </h3>
                    <button 
                      type="button"
                      @click.stop="startCardTitleEdit(purchase)" 
                      class="btn btn-ghost btn-xs btn-circle opacity-70 hover:opacity-100 hover:bg-base-200 text-primary transition-all"
                      title="Rename Tracker"
                    >
                      <Icon icon="solar:pen-bold" class="w-3.5 h-3.5" />
                    </button>
                  </template>
                </div>
                <div class="text-[11px] font-mono flex items-center gap-1.5 mt-0.5">
                  <a 
                    :href="`/purchases/${purchase.poNumber || purchase.$id}`" 
                    @click.stop 
                    class="font-bold text-primary hover:underline flex items-center gap-0.5 group/po"
                    title="Open Purchase Order Details"
                  >
                    <span>{{ purchase.poNumber || purchase.orderId || 'Draft' }}</span>
                    <Icon icon="solar:arrow-right-up-linear" class="w-2.5 h-2.5 opacity-60 group-hover/po:opacity-100 transition-opacity" />
                  </a>
                  <span class="opacity-40">•</span>
                  <span class="inline-flex items-center gap-1 opacity-50" :title="`Last updated: ${purchase.$updatedAt || purchase.purchaseDate || purchase.$createdAt}`">
                    <Icon icon="solar:clock-circle-linear" class="w-3 h-3 opacity-70 shrink-0" />
                    Updated {{ formatUpdatedDate(purchase.$updatedAt || purchase.purchaseDate || purchase.$createdAt) }}
                  </span>
                </div>
              </div>
            </div>

            <span class="badge badge-warning badge-sm font-bold shrink-0">
              Buy Tracker
            </span>
          </div>
        </div>

        <!-- Card Body: Financial Summary -->
        <div class="p-5 space-y-4 grow">
          <div class="grid grid-cols-3 gap-2 text-center">
            <button 
              type="button"
              @click.stop="handleInspectTracker(purchase)"
              class="bg-base-200/50 p-2.5 rounded-2xl border border-base-content/5 hover:border-primary/50 hover:bg-primary/5 transition-all text-center group/items cursor-pointer"
              title="Inspect items in tracker drawer"
            >
              <div class="text-[9px] uppercase font-bold opacity-60 flex items-center justify-center gap-1">
                <span>Items</span>
                <Icon icon="solar:eye-linear" class="w-3 h-3 text-primary" />
              </div>
              <div class="font-black text-sm text-primary mt-0.5 group-hover/items:underline">
                {{ (purchase.$id === activePurchase?.$id && purchaseItems.length > 0) ? purchaseItems.length : (purchase.itemCount || 0) }}
              </div>
            </button>

            <div class="bg-base-200/50 p-2.5 rounded-2xl border border-base-content/5">
              <div class="text-[9px] uppercase font-bold opacity-60">Planned Cost</div>
              <div class="font-black text-sm text-warning font-mono mt-0.5">
                ${{ (purchase.subtotal || 0).toFixed(2) }}
              </div>
            </div>

            <div class="bg-base-200/50 p-2.5 rounded-2xl border border-base-content/5">
              <div class="text-[9px] uppercase font-bold opacity-60">Est. Ret.</div>
              <div class="font-black text-sm text-secondary font-mono mt-0.5">
                ${{ ( (purchase.subtotal || 0) * 4 ).toFixed(2) }}
              </div>
            </div>
          </div>
        </div>

        <!-- Card Footer: Actions -->
        <div class="p-4 bg-base-200/40 border-t border-base-200 flex items-center justify-between gap-2">
          <button 
            @click="handleResume(purchase)"
            class="btn btn-primary btn-sm font-black text-primary-content shadow-xs gap-1 grow"
            title="Resume scouting items into this purchase"
          >
            <Icon icon="solar:play-circle-bold" class="w-4 h-4" />
            Resume Scouting
          </button>


          <button 
            @click="handleDiscardPurchase(purchase)"
            :disabled="actionInProgress === purchase.$id"
            class="btn btn-ghost btn-sm btn-square text-error/60 hover:text-error hover:bg-error/10"
            title="Discard draft purchase"
          >
            <Icon icon="solar:trash-bin-trash-linear" class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- New Purchase Modal -->
    <dialog ref="modalRef" class="modal modal-bottom sm:modal-middle" :class="{ 'modal-open': isModalOpen }">
      <div class="modal-box bg-base-100 border border-base-300 p-6 rounded-3xl max-w-md shadow-2xl">
        <h3 class="font-black text-xl text-base-content flex items-center gap-2 mb-1">
          <Icon icon="lucide:truck" class="text-primary w-6 h-6" />
          Start a New Buy Tracker
        </h3>
        <p class="text-xs text-base-content/60 mb-5">
          Choose where you are sourcing today. Items you scout will be ready to review and add directly into this Buy Tracker.
        </p>

        <!-- Preset Vendor Chips -->
        <div class="space-y-2 mb-4">
          <label class="text-[10px] uppercase font-bold tracking-wider opacity-60">Quick Presets</label>
          <div class="flex flex-wrap gap-2">
            <button 
              v-for="preset in vendorPresets" 
              :key="preset.name"
              type="button"
              @click="selectPreset(preset.name)"
              class="btn btn-xs rounded-full font-bold transition-all"
              :class="newVendorName === preset.name ? 'btn-primary shadow-xs' : 'btn-outline border-base-300 hover:border-primary'"
            >
              <span>{{ preset.icon }}</span>
              <span>{{ preset.name }}</span>
            </button>
          </div>
        </div>

        <!-- Vendor Name Input -->
        <div class="form-control space-y-1 mb-6">
          <label class="label p-0">
            <span class="label-text text-xs font-bold text-base-content/80">Store or Source Name</span>
          </label>
          <div class="relative">
            <input 
              v-model="newVendorName" 
              type="text" 
              placeholder="e.g. Goodwill Eastside, Elm St Estate Sale..." 
              class="input input-bordered w-full font-bold text-sm pr-10"
              @keyup.enter="confirmStartPurchase"
              autofocus
            />
            <span class="absolute right-3 top-1/2 -translate-y-1/2 opacity-30">
              <Icon icon="solar:shop-2-linear" class="w-5 h-5" />
            </span>
          </div>
        </div>

        <!-- Modal Actions -->
        <div class="modal-action flex items-center justify-between m-0 pt-2 border-t border-base-300">
          <button @click="closeNewPurchaseModal" type="button" class="btn btn-ghost font-bold text-xs">
            Cancel
          </button>
          <button 
            @click="confirmStartPurchase" 
            :disabled="creatingPurchase || !newVendorName.trim()"
            type="button" 
            class="btn btn-primary font-bold shadow-md min-w-32"
          >
            <span v-if="creatingPurchase" class="loading loading-spinner loading-xs"></span>
            <template v-else>
              <Icon icon="solar:camera-bold" class="w-4 h-4" />
              Start Scouting
            </template>
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="closeNewPurchaseModal">
        <button>close</button>
      </form>
    </dialog>

    <!-- TACTILE FIXED BOTTOM DOCK (MOBILE-FIRST ERGONOMIC CLUSTER) -->
    <div class="fixed bottom-0 inset-x-0 z-40 bg-base-100/90 backdrop-blur-md border-t border-base-300/80 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-2xl transition-all">
      <div class="max-w-md mx-auto flex flex-col gap-2">
        <!-- State C: Active Buy Tracker Status Strip (Unified Pill with Resume inside) -->
        <div v-if="activePurchase" class="pb-1.5 border-b border-base-content/10">
          <div 
            @click="toggleTray(true)" 
            class="flex items-center justify-between gap-1.5 sm:gap-2 px-2.5 py-1 rounded-2xl bg-base-300/80 hover:bg-base-300 border border-base-content/15 cursor-pointer select-none transition-all group"
            title="View manifest details"
          >
            <!-- Left: Active deal summary -->
            <div class="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
              <Icon icon="lucide:truck" class="w-4 h-4 text-primary shrink-0" />
              <span class="font-black text-xs text-base-content truncate max-w-[100px] sm:max-w-[160px]">
                {{ activePurchase.vendor || 'Buy Tracker' }}
              </span>
              <span class="badge badge-xs badge-warning font-black shrink-0">
                {{ (purchaseItems.length || activePurchase.itemCount || 0) }} items
              </span>
              <span class="text-[11px] font-mono text-warning font-black shrink-0">
                ${{ (activePurchase.subtotal || 0).toFixed(2) }}
              </span>
              <span class="text-[10px] uppercase font-bold opacity-60 ml-auto hidden sm:inline">Manifest</span>
              <Icon icon="solar:alt-arrow-up-linear" class="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity shrink-0 ml-0.5" />
            </div>

            <!-- Right: Resume Button (nested inside pill) -->
            <button 
              type="button" 
              @click.stop="handleResume(activePurchase)"
              class="btn btn-primary btn-xs h-6 px-2.5 font-black text-primary-content rounded-xl shadow-xs gap-1 shrink-0 active:scale-95 transition-all"
              title="Resume scouting into this deal"
            >
              <Icon icon="solar:play-circle-bold" class="w-3.5 h-3.5" />
              <span>Resume</span>
            </button>
          </div>
        </div>

        <!-- State B: Paused Buy Tracker Status Strip (Unified Pill with Resume & Inline Rename inside) -->
        <div v-else-if="mostRecentTracker" class="pb-1.5 border-b border-base-content/10">
          <div 
            @click="toggleTray(true)" 
            class="flex items-center justify-between gap-1.5 sm:gap-2 px-2.5 py-1 rounded-2xl bg-base-300/60 hover:bg-base-300/80 border border-base-300 cursor-pointer select-none transition-all group"
            title="Inspect most recent tracker manifest"
          >
            <!-- Left: Paused Tracker summary -->
            <div class="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
              <Icon icon="solar:pause-circle-bold" class="w-4 h-4 text-warning shrink-0" />
              <span class="badge badge-xs badge-warning badge-outline font-bold shrink-0">Paused</span>
              
              <!-- Inline edit or display for dock pill -->
              <template v-if="editingPurchaseId === mostRecentTracker.$id">
                <div class="flex items-center gap-1" @click.stop>
                  <input 
                    :id="`edit-tracker-input-${mostRecentTracker.$id}-dock`"
                    v-model="editingPurchaseTitle" 
                    type="text" 
                    class="input input-xs input-bordered font-bold text-xs w-28 sm:w-44 bg-base-100"
                    placeholder="Tracker name"
                    @keyup.enter="saveCardTitle(mostRecentTracker.$id)"
                    @keyup.esc="cancelCardTitle"
                    @blur="saveCardTitle(mostRecentTracker.$id)"
                  />
                  <button @click.stop="saveCardTitle(mostRecentTracker.$id)" :disabled="savingCardTitle" class="btn btn-xs btn-primary btn-circle">
                    <Icon icon="solar:check-read-linear" class="w-3 h-3" />
                  </button>
                </div>
              </template>
              <template v-else>
                <span 
                  @click.stop="startCardTitleEdit(mostRecentTracker)"
                  class="font-bold text-xs text-base-content truncate max-w-[100px] sm:max-w-[160px] hover:underline cursor-pointer"
                  title="Click to rename"
                >
                  {{ mostRecentTracker.vendor || 'Buy Tracker' }}
                </span>
                <button 
                  type="button" 
                  @click.stop="startCardTitleEdit(mostRecentTracker)"
                  class="btn btn-ghost btn-xs btn-circle opacity-60 hover:opacity-100 hover:bg-base-200 text-primary transition-opacity"
                  title="Rename Tracker"
                >
                  <Icon icon="solar:pen-bold" class="w-3 h-3" />
                </button>
              </template>

              <span class="text-[11px] font-mono opacity-60 shrink-0">
                {{ (mostRecentTracker.$id === activePurchase?.$id && purchaseItems.length > 0) ? purchaseItems.length : (mostRecentTracker.itemCount || 0) }} items
              </span>
              <span v-if="mostRecentTracker.subtotal" class="text-[11px] font-mono text-warning font-bold shrink-0 hidden sm:inline">
                ${{ mostRecentTracker.subtotal.toFixed(2) }}
              </span>
              <Icon icon="solar:alt-arrow-up-linear" class="w-3.5 h-3.5 opacity-40 group-hover:opacity-80 transition-opacity shrink-0 ml-0.5" />
            </div>

            <!-- Right: Resume Button (nested inside pill) -->
            <button 
              type="button" 
              @click.stop="handleResume(mostRecentTracker)"
              class="btn btn-primary btn-xs h-6 px-2.5 font-black text-primary-content rounded-xl shadow-xs gap-1 shrink-0 active:scale-95 transition-all"
              title="Resume scouting into this deal"
            >
              <Icon icon="solar:play-circle-bold" class="w-3.5 h-3.5" />
              <span>Resume</span>
            </button>
          </div>
        </div>

        <!-- Action Buttons Row: Quick Scan & New Buy Tracker -->
        <div class="flex items-center justify-between gap-3">
          <!-- Action 1: Quick Scan -->
          <button 
            type="button"
            @click="emit('quick-scan')" 
            class="btn btn-sm sm:btn-md btn-outline border-base-300 hover:border-warning font-extrabold flex-1 rounded-2xl shadow-xs active:scale-95 transition-all gap-2"
            title="Fast one-off valuation without saving to a purchase"
          >
            <Icon icon="solar:scanner-bold" class="w-4 h-4 sm:w-5 sm:h-5 text-warning" />
            <span class="text-xs sm:text-sm font-bold">Quick Scan</span>
          </button>

          <!-- Action 2: New Buy Tracker -->
          <button 
            type="button"
            @click="isModalOpen = true" 
            class="btn btn-sm sm:btn-md btn-primary text-primary-content font-black flex-[1.2] rounded-2xl shadow-md active:scale-95 transition-all gap-2 tracking-wide cursor-pointer"
          >
            <Icon icon="solar:add-circle-bold" class="w-5 h-5 shrink-0" />
            <span class="text-xs sm:text-sm font-black">New Buy Tracker</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import { useScoutPurchase, type ScoutPurchase } from '../../composables/useScoutPurchase';
import { addToast } from '../../stores/toast';
import { confirmDialog } from '../../stores/confirm';

const emit = defineEmits<{
  (e: 'start-purchase', purchase: ScoutPurchase): void;
  (e: 'resume-purchase', purchase: ScoutPurchase): void;
  (e: 'quick-scan'): void;
}>();

const handleResume = (purchase: ScoutPurchase) => {
  console.log('[ScoutPurchaseList] handleResume clicked:', purchase.$id);
  emit('resume-purchase', purchase);
};

const { 
  draftPurchases, 
  loading, 
  loadDraftPurchases, 
  startDraftPurchase, 
  completePurchase, 
  discardPurchase,
  updatePurchaseTitle,
  setActivePurchase,
  toggleTray,
  activePurchase,
  pausedTracker
} = useScoutPurchase();

const isModalOpen = ref(false);
const newVendorName = ref('Goodwill');
const creatingPurchase = ref(false);
const actionInProgress = ref<string | null>(null);

// Card inline title editing state
const editingPurchaseId = ref<string | null>(null);
const editingPurchaseTitle = ref('');
const savingCardTitle = ref(false);
const cardTitleInputRef = ref<HTMLInputElement | null>(null);

const startCardTitleEdit = (purchase: ScoutPurchase) => {
  editingPurchaseId.value = purchase.$id;
  editingPurchaseTitle.value = purchase.vendor || '';
  nextTick(() => {
    const el = (document.getElementById(`edit-tracker-input-${purchase.$id}`) ||
                document.getElementById(`edit-tracker-input-${purchase.$id}-dock`)) as HTMLInputElement;
    if (el) {
      el.focus();
      el.select();
    }
  });
};

const cancelCardTitle = () => {
  editingPurchaseId.value = null;
};

const saveCardTitle = async (purchaseId: string) => {
  if (editingPurchaseId.value !== purchaseId) return;
  const newName = editingPurchaseTitle.value.trim();
  if (!newName || savingCardTitle.value) {
    editingPurchaseId.value = null;
    return;
  }
  savingCardTitle.value = true;
  try {
    await updatePurchaseTitle(purchaseId, newName);
    editingPurchaseId.value = null;
    addToast({ type: 'success', message: `Tracker renamed to "${newName}"` });
  } catch (err: any) {
    addToast({ type: 'error', message: 'Failed to rename: ' + err.message });
  } finally {
    savingCardTitle.value = false;
  }
};

const handleInspectTracker = (purchase: ScoutPurchase) => {
  setActivePurchase(purchase);
  toggleTray(true);
};

// Sort draft purchases by last updated (most recent first)
const sortedDraftPurchases = computed(() => {
  return [...draftPurchases.value].sort((a, b) => {
    const timeA = new Date(a.$updatedAt || a.purchaseDate || a.$createdAt || 0).getTime();
    const timeB = new Date(b.$updatedAt || b.purchaseDate || b.$createdAt || 0).getTime();
    return timeB - timeA;
  });
});

const mostRecentTracker = computed(() => {
  return activePurchase.value || pausedTracker.value || sortedDraftPurchases.value[0] || null;
});

const vendorPresets = [
  { name: 'Goodwill', icon: '🏪' },
  { name: 'Estate Sale', icon: '🏡' },
  { name: 'Garage Sale', icon: '🏷️' },
  { name: 'ShopGoodwill', icon: '💻' },
  { name: 'Flea Market', icon: '🎪' },
  { name: 'Thrift Store', icon: '🛍️' },
  { name: 'Auction Lot', icon: '🔨' },
  { name: 'Storage Locker', icon: '📦' }
];

onMounted(async () => {
  await loadDraftPurchases();
});

const aggregateTotals = computed(() => {
  let cost = 0;
  let boutique = 0;

  draftPurchases.value.forEach(p => {
    cost += (p.subtotal || 0);
    // Estimate 4x average markup for draft deals
    boutique += (p.subtotal || 0) * 4;
  });

  const profit = Math.max(0, boutique - cost);
  const roi = cost > 0 ? `${(boutique / cost).toFixed(1)}x` : '0.0x';
  const margin = boutique > 0 ? Math.round(((boutique - cost) / boutique) * 100) : 0;

  return { cost, boutique, profit, roi, margin };
});

const openNewPurchaseModal = () => {
  newVendorName.value = 'Goodwill';
  isModalOpen.value = true;
};

const closeNewPurchaseModal = () => {
  isModalOpen.value = false;
};

const selectPreset = (name: string) => {
  newVendorName.value = name;
};

const confirmStartPurchase = async () => {
  if (!newVendorName.value.trim() || creatingPurchase.value) return;
  creatingPurchase.value = true;
  try {
    const purchase = await startDraftPurchase(newVendorName.value.trim());
    addToast({ type: 'success', message: `Deal started: ${newVendorName.value}!` });
    closeNewPurchaseModal();
    emit('start-purchase', purchase as unknown as ScoutPurchase);
  } catch (err: any) {
    addToast({ type: 'error', message: 'Failed to start purchase: ' + err.message });
  } finally {
    creatingPurchase.value = false;
  }
};


const handleDiscardPurchase = async (purchase: ScoutPurchase) => {
  const confirmed = await confirmDialog(
    `Discard draft deal "${purchase.vendor}"? Any scouted items in this draft will be removed.`,
    'Discard Buy Tracker',
    'Discard Deal',
    'Keep Tracker',
    'btn-error text-error-content font-black'
  );
  if (!confirmed) return;

  actionInProgress.value = purchase.$id;
  try {
    await discardPurchase(purchase.$id);
    addToast({ type: 'info', message: `Discarded "${purchase.vendor}".` });
  } catch (err: any) {
    addToast({ type: 'error', message: 'Discard failed: ' + err.message });
  } finally {
    actionInProgress.value = null;
  }
};

const getVendorIcon = (vendor?: string): string => {
  const v = (vendor || '').toLowerCase();
  if (v.includes('goodwill')) return 'solar:shop-2-bold';
  if (v.includes('estate')) return 'solar:home-smile-bold';
  if (v.includes('garage')) return 'solar:tag-price-bold';
  if (v.includes('auction')) return 'solar:hammer-bold';
  if (v.includes('online') || v.includes('shopgoodwill') || v.includes('ebay')) return 'solar:laptop-bold';
  return 'solar:box-bold';
};

const formatUpdatedDate = (dateStr?: string): string => {
  if (!dateStr) return 'Just now';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - d.getTime());
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return 'Just now';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return 'Recently';
  }
};
</script>

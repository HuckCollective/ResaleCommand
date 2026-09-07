<template>
  <div class="space-y-6">
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

    <!-- Action Bar -->
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-base-100 p-4 rounded-2xl border border-base-300 shadow-sm">
      <div>
        <h2 class="text-lg sm:text-xl font-black text-base-content flex items-center gap-2">
          <Icon icon="lucide:truck" class="text-primary w-5 h-5" />
          Buy Trackers
        </h2>
        <p class="text-xs opacity-60 mt-0.5">
          Active sourcing runs and buy trackers holding multiple items & lots before purchase
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button 
          @click="emit('quick-scan')" 
          class="btn btn-outline btn-sm font-bold flex-1 sm:flex-initial"
          title="Fast one-off valuation without saving to a purchase"
        >
          <Icon icon="solar:scanner-bold" class="w-4 h-4 text-warning" />
          ⚡ Quick Scan
        </button>

        <button 
          @click="isModalOpen = true" 
          class="btn btn-primary btn-sm font-black text-primary-content shadow-md gap-1 flex-1 sm:flex-initial"
        >
          <Icon icon="solar:add-circle-bold" class="w-4 h-4" />
          <span>New Buy Tracker</span>
        </button>
      </div>
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
        v-for="purchase in draftPurchases" 
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
                <h3 class="font-black text-base text-base-content truncate group-hover:text-primary transition-colors">
                  {{ purchase.vendor || 'Buy Tracker' }}
                </h3>
                <div class="text-[11px] font-mono opacity-50 flex items-center gap-1.5">
                  <span>{{ purchase.poNumber || purchase.orderId || 'Draft' }}</span>
                  <span>•</span>
                  <span>{{ formatDate(purchase.purchaseDate || purchase.$createdAt) }}</span>
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
            <div class="bg-base-200/50 p-2.5 rounded-2xl border border-base-content/5">
              <div class="text-[9px] uppercase font-bold opacity-60">Items</div>
              <div class="font-black text-sm text-base-content mt-0.5">
                {{ purchase.itemCount || 0 }}
              </div>
            </div>

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
            @click="handleCompletePurchase(purchase)"
            :disabled="actionInProgress === purchase.$id"
            class="btn btn-success btn-sm font-bold text-success-content shadow-xs"
            title="Mark as paid and open Purchase Order"
          >
            <span v-if="actionInProgress === purchase.$id" class="loading loading-spinner loading-xs"></span>
            <template v-else>
              <Icon icon="lucide:truck" class="w-4 h-4" />
              Purchase It
            </template>
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useScoutPurchase, type ScoutPurchase } from '../../composables/useScoutPurchase';
import { addToast } from '../../stores/toast';

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
  discardPurchase 
} = useScoutPurchase();

const isModalOpen = ref(false);
const newVendorName = ref('Goodwill');
const creatingPurchase = ref(false);
const actionInProgress = ref<string | null>(null);

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

const handleCompletePurchase = async (purchase: ScoutPurchase) => {
  actionInProgress.value = purchase.$id;
  try {
    addToast({ type: 'info', message: `📋 Opening Draft PO: "${purchase.vendor}"...` });
    // Open directly in the Purchase Order screen without finalizing prematurely
    window.location.href = `/purchases/${purchase.$id}`;
  } catch (err: any) {
    addToast({ type: 'error', message: 'Failed to open purchase: ' + err.message });
  } finally {
    actionInProgress.value = null;
  }
};

const handleDiscardPurchase = async (purchase: ScoutPurchase) => {
  if (!confirm(`Discard draft deal "${purchase.vendor}"? Any scouted items in this draft will be removed.`)) {
    return;
  }
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

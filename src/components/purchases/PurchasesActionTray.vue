<template>
  <Teleport v-if="mounted" to="body">
    <Transition name="rc-purchases-tray">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-400 bg-black/60 backdrop-blur-xs flex flex-col justify-end"
        role="dialog"
        aria-modal="true"
        aria-label="Purchases Actions, Buy Trackers, and Auction Scout"
        @click.self="closeTray"
      >
        <div
          class="bg-base-100 border-t border-base-300 rounded-t-3xl max-w-3xl mx-auto w-full max-h-[84dvh] flex flex-col shadow-2xl overflow-hidden pb-[env(safe-area-inset-bottom,0px)]"
        >
          <!-- Drag Handle Pill -->
          <div
            class="w-12 h-1.5 rounded-full bg-base-content/25 mx-auto mt-2.5 mb-1 shrink-0 cursor-pointer"
            @click="closeTray"
            title="Close Tray"
          ></div>

          <!-- Tray Header -->
          <header class="px-4 sm:px-6 py-2.5 border-b border-base-200 flex items-center justify-between gap-2 shrink-0">
            <div class="min-w-0">
              <h3 class="text-base sm:text-lg font-black tracking-tight text-base-content truncate">
                Purchases &amp; Sourcing Tools
              </h3>
              <p class="text-xs text-base-content/70 truncate">
                Add new hauls, check open Buy Trackers, or open Auction Scout.
              </p>
            </div>
            <button
              type="button"
              class="btn btn-ghost btn-sm h-11 w-11 md:h-9 md:w-9 btn-circle shrink-0"
              aria-label="Close Purchases Tray"
              @click="closeTray"
            >
              ✕
            </button>
          </header>

          <!-- Segmented 3-Tab Switcher (Mobile-safe horizontal scroll) -->
          <div class="px-4 sm:px-6 py-2.5 border-b border-base-200 bg-base-200/40 shrink-0">
            <div class="flex items-center gap-1.5 overflow-x-auto max-w-full no-scrollbar">
              <button
                type="button"
                class="btn btn-sm h-11 md:h-9 rounded-xl font-bold gap-1.5 shrink-0 whitespace-nowrap"
                :class="activeTab === 'add' ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost bg-base-100 border border-base-300'"
                @click="emit('update:activeTab', 'add')"
              >
                <Icon icon="solar:add-circle-bold" class="w-4 h-4 shrink-0" />
                <span>Add Purchase</span>
              </button>

              <button
                type="button"
                class="btn btn-sm h-11 md:h-9 rounded-xl font-bold gap-1.5 shrink-0 whitespace-nowrap"
                :class="activeTab === 'trackers' ? 'btn-secondary text-secondary-content shadow-xs' : 'btn-ghost bg-base-100 border border-base-300'"
                @click="emit('update:activeTab', 'trackers')"
              >
                <span>📌 Buy Trackers</span>
                <span
                  v-if="trackers.length > 0"
                  class="badge badge-xs font-mono font-black whitespace-nowrap shrink-0"
                  :class="activeTab === 'trackers' ? 'badge-neutral text-neutral-content' : 'badge-secondary text-secondary-content'"
                >
                  {{ trackers.length }}
                </span>
              </button>

              <button
                type="button"
                class="btn btn-sm h-11 md:h-9 rounded-xl font-bold gap-1.5 shrink-0 whitespace-nowrap"
                :class="activeTab === 'scout' ? 'btn-neutral text-neutral-content shadow-xs' : 'btn-ghost bg-base-100 border border-base-300'"
                @click="emit('update:activeTab', 'scout')"
              >
                <span>🚀 Auction Scout</span>
              </button>
            </div>
          </div>

          <!-- Scrollable Tray Body -->
          <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3 text-xs">
            <!-- TAB 1: ADD PURCHASE (Speed Entry + New PO + Import CSV) -->
            <div v-if="activeTab === 'add'" class="space-y-3">
              <!-- Card 1 (Primary Hero): Speed Entry -->
              <div class="bg-primary/10 border border-primary/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="flex items-start gap-3 min-w-0">
                  <div class="w-10 h-10 rounded-xl bg-primary text-primary-content flex items-center justify-center shrink-0 shadow-xs">
                    <Icon icon="solar:bolt-bold" class="w-5 h-5" />
                  </div>
                  <div class="space-y-0.5 min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="badge badge-xs badge-primary text-primary-content font-black whitespace-nowrap shrink-0">Fastest</span>
                      <h4 class="font-black text-sm text-base-content">Speed Entry (Receipt &amp; Haul)</h4>
                    </div>
                    <p class="text-xs text-base-content/75 leading-relaxed">
                      Snap a store receipt photo for automatic vendor, date, and line-item extraction into Backstock.
                    </p>
                  </div>
                </div>
                <a
                  href="/purchases/speed-entry"
                  class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content font-black px-4 rounded-xl shadow-sm w-full sm:w-auto shrink-0 gap-1.5 whitespace-nowrap"
                >
                  <Icon icon="solar:bolt-bold" class="w-4 h-4 shrink-0" />
                  <span>Launch Speed Entry</span>
                </a>
              </div>

              <!-- Card 2: New Purchase Order -->
              <div class="bg-base-200/45 border border-base-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="flex items-start gap-3 min-w-0">
                  <div class="w-10 h-10 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
                    <Icon icon="solar:document-add-bold" class="w-5 h-5" />
                  </div>
                  <div class="space-y-0.5 min-w-0">
                    <h4 class="font-black text-sm text-base-content">New Purchase Order</h4>
                    <p class="text-xs text-base-content/75 leading-relaxed">
                      Enter a full purchase order manually with shipping, tax allocation, tracking number, and linked items.
                    </p>
                  </div>
                </div>
                <a
                  href="/purchases/new"
                  class="btn btn-sm h-11 md:h-9 btn-outline font-bold px-4 rounded-xl w-full sm:w-auto shrink-0 gap-1.5 whitespace-nowrap"
                >
                  <Icon icon="solar:add-circle-linear" class="w-4 h-4 shrink-0" />
                  <span>Create PO</span>
                </a>
              </div>

              <!-- Card 3: Import CSV / XLSX -->
              <div class="bg-base-200/45 border border-base-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="flex items-start gap-3 min-w-0">
                  <div class="w-10 h-10 rounded-xl bg-accent/15 text-accent flex items-center justify-center shrink-0">
                    <Icon icon="solar:file-text-bold" class="w-5 h-5" />
                  </div>
                  <div class="space-y-0.5 min-w-0">
                    <h4 class="font-black text-sm text-base-content">Import CSV / XLSX</h4>
                    <p class="text-xs text-base-content/75 leading-relaxed">
                      Upload ShopGoodwill Shipped Reports or spreadsheet exports to create POs and graduate tracked auctions.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  class="btn btn-sm h-11 md:h-9 btn-outline font-bold px-4 rounded-xl w-full sm:w-auto shrink-0 gap-1.5 whitespace-nowrap"
                  @click="triggerCsvImport"
                >
                  <Icon icon="solar:upload-track-linear" class="w-4 h-4 shrink-0" />
                  <span>Upload CSV</span>
                </button>
              </div>
            </div>

            <!-- TAB 2: ACTIVE BUY TRACKERS -->
            <div v-else-if="activeTab === 'trackers'" class="space-y-3">
              <div
                v-if="trackers.length === 0"
                class="bg-base-200/40 border border-dashed border-base-300 rounded-2xl p-8 text-center space-y-3"
              >
                <div class="text-base font-black text-base-content">No Active Buy Trackers</div>
                <p class="text-xs text-base-content/70 max-w-sm mx-auto">
                  Pre-buy hauls and live online auction lots wait in Buy Trackers until acquired.
                </p>
                <div class="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <a
                    href="/scout?quick=true"
                    class="btn btn-sm h-11 md:h-9 btn-outline rounded-xl font-bold"
                  >
                    ⚡ Open Quick Scout
                  </a>
                  <a
                    href="/scout/trackers"
                    class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content rounded-xl font-black"
                  >
                    📌 Open Buy Trackers
                  </a>
                </div>
              </div>

              <div v-else class="space-y-2.5">
                <div
                  v-for="tracker in trackers"
                  :key="tracker.$id"
                  class="rounded-2xl border border-base-300 bg-base-200/45 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div class="min-w-0 space-y-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="font-black text-sm text-base-content truncate">
                        {{ tracker.vendor || 'Buy Tracker' }}
                      </span>
                      <span class="badge badge-xs badge-warning text-warning-content font-mono font-bold whitespace-nowrap shrink-0">
                        {{ tracker.poNumber || tracker.orderId || 'Draft' }}
                      </span>
                    </div>
                    <div class="text-[11px] font-mono text-base-content/75 flex items-center gap-2 flex-wrap">
                      <span>{{ getItemCount(tracker) }} items</span>
                      <span>•</span>
                      <span class="font-bold text-secondary">
                        Planned ${{ Number(tracker.subtotal || tracker.grandTotal || 0).toFixed(2) }}
                      </span>
                      <span>•</span>
                      <span>{{ formatTrackerDate(tracker.$updatedAt || tracker.purchaseDate || tracker.$createdAt) }}</span>
                    </div>
                  </div>

                  <div class="flex items-center gap-2 shrink-0 flex-wrap">
                    <button
                      type="button"
                      class="btn btn-sm h-11 md:h-8 btn-outline font-bold rounded-xl gap-1 whitespace-nowrap"
                      @click="inspectTracker(tracker)"
                    >
                      <Icon icon="solar:box-minimalistic-linear" class="w-4 h-4 shrink-0" />
                      <span>Items ({{ getItemCount(tracker) }})</span>
                    </button>
                    <a
                      href="/scout/trackers"
                      class="btn btn-sm h-11 md:h-8 btn-primary text-primary-content font-black rounded-xl gap-1 whitespace-nowrap"
                    >
                      <Icon icon="solar:play-circle-bold" class="w-4 h-4 shrink-0" />
                      <span>Resume</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <!-- TAB 3: AUCTION SCOUT & BOOKMARKLET -->
            <div v-else class="space-y-3">
              <BookmarkletHeroBar v-if="canUseBml" tool="auction_scout" variant="tray" />

              <div class="bg-base-200/45 border border-base-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="flex items-start gap-3 min-w-0">
                  <div class="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <Icon icon="solar:scanner-bold" class="w-5 h-5" />
                  </div>
                  <div class="space-y-0.5 min-w-0">
                    <h4 class="font-black text-sm text-base-content">⚡ Quick Scout &amp; Camera Appraisal</h4>
                    <p class="text-xs text-base-content/75 leading-relaxed">
                      Snap photos in thrift aisles or paste any listing link to check real net resale value before buying.
                    </p>
                  </div>
                </div>
                <a
                  href="/scout?quick=true"
                  class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content font-black px-4 rounded-xl shadow-sm w-full sm:w-auto shrink-0 gap-1.5 whitespace-nowrap"
                >
                  <Icon icon="solar:scanner-bold" class="w-4 h-4 shrink-0" />
                  <span>Open Quick Scout</span>
                </a>
              </div>
            </div>
          </div>

          <!-- Sticky Footer -->
          <footer class="px-4 sm:px-6 py-3 border-t border-base-200 bg-base-200/60 flex items-center justify-between gap-2 shrink-0">
            <a
              v-if="activeTab === 'trackers'"
              href="/scout/trackers"
              class="btn btn-sm h-11 md:h-9 btn-outline font-bold rounded-xl whitespace-nowrap"
            >
              Open Full Buy Trackers ↗
            </a>
            <span v-else class="text-[11px] text-base-content/65 font-medium">
              All purchases track into Backstock &amp; Official Ledger.
            </span>
            <button
              type="button"
              class="btn btn-sm h-11 md:h-9 btn-ghost border border-base-300 font-bold rounded-xl px-4 ml-auto"
              @click="closeTray"
            >
              Close
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { Icon } from '@iconify/vue';
import BookmarkletHeroBar from '../bml/BookmarkletHeroBar.vue';
import { useBodyScrollLock } from '../../composables/useBodyScrollLock';

export type PurchasesTrayTab = 'add' | 'trackers' | 'scout';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    activeTab: PurchasesTrayTab;
    trackers: any[];
    getItemCount: (purchase: any) => number;
    canUseBml?: boolean;
  }>(),
  {
    canUseBml: true,
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'update:activeTab', value: PurchasesTrayTab): void;
  (e: 'import-csv'): void;
  (e: 'inspect-tracker', tracker: any): void;
}>();

const mounted = ref(false);
useBodyScrollLock(() => props.modelValue);

const closeTray = () => {
  emit('update:modelValue', false);
};

const triggerCsvImport = () => {
  closeTray();
  emit('import-csv');
};

const inspectTracker = (tracker: any) => {
  closeTray();
  emit('inspect-tracker', tracker);
};

const formatTrackerDate = (raw?: string) => {
  if (!raw) return 'Recently';
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return 'Recently';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
};

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.modelValue) {
    closeTray();
  }
};

watch(
  () => props.modelValue,
  (open) => {
    if (typeof window === 'undefined') return;
    if (open) {
      window.addEventListener('keydown', onKeyDown);
    } else {
      window.removeEventListener('keydown', onKeyDown);
    }
  }
);

onMounted(() => {
  mounted.value = true;
});

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onKeyDown);
  }
});
</script>

<style scoped>
.rc-purchases-tray-enter-active,
.rc-purchases-tray-leave-active {
  transition: opacity 0.2s ease-out;
}
.rc-purchases-tray-enter-from,
.rc-purchases-tray-leave-to {
  opacity: 0;
}
</style>

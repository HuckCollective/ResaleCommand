<template>
  <Teleport v-if="mounted" to="body">
    <Transition name="rc-location-tools-tray">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-400 bg-black/60 backdrop-blur-xs flex flex-col justify-end"
        role="dialog"
        aria-modal="true"
        :aria-label="`${locationMeta.shortName || locationMeta.code} Booth Sync and Sales Tools`"
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

          <!-- Header -->
          <header class="px-4 sm:px-6 py-2.5 border-b border-base-200 flex items-center justify-between gap-2 shrink-0">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="text-base sm:text-lg font-black tracking-tight text-base-content truncate">
                  {{ locationMeta.icon || '🏪' }} {{ locationMeta.shortName || locationMeta.name || effectiveCode }} Sync &amp; Tools
                </h3>
                <span class="badge badge-xs badge-primary text-primary-content font-mono font-black whitespace-nowrap shrink-0">
                  {{ effectiveCode }}
                </span>
                <span
                  v-if="pendingCount > 0"
                  class="badge badge-xs badge-warning text-warning-content font-mono font-black whitespace-nowrap shrink-0"
                >
                  {{ pendingCount }} pending
                </span>
              </div>
              <p class="text-xs text-base-content/70 truncate">
                POS bookmarklet, pending shelf updates, barcode sync, and sales payout import.
              </p>
            </div>
            <button
              type="button"
              class="btn btn-ghost btn-sm h-11 w-11 md:h-9 md:w-9 btn-circle shrink-0"
              aria-label="Close Booth Sync Tray"
              @click="closeTray"
            >
              ✕
            </button>
          </header>

          <!-- Scrollable Tray Body -->
          <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
            <!-- 1. Compact Ricochet Bookmarklet Card (when location uses Ricochet POS) -->
            <BookmarkletHeroBar
              v-if="locationMeta.usesRicochet"
              tool="ricochet_sync"
              :location-meta="locationMeta"
              variant="tray"
            />

            <!-- 2. Live Outbound Channel Sync Queue / Physical Booth Pull Checklist -->
            <template v-if="locationMeta.usesRicochet || locationMeta.supportsPaperSalesSheet">
              <LocationChannelOutboxPanel
                :location-meta="locationMeta"
                @pending-count="handleOutboxPendingCount"
              />

              <div
                v-if="pendingCount === 0"
                class="rounded-2xl border border-success/30 bg-success/10 px-3.5 py-2.5 flex items-center justify-between gap-2"
              >
                <span class="font-bold text-base-content">
                  ✅ Outbound Sync Queue Clear — no shelf tag pulls waiting.
                </span>
                <span class="badge badge-xs badge-success text-success-content font-mono font-black whitespace-nowrap shrink-0">
                  0 pending
                </span>
              </div>
            </template>

            <!-- 3. Sync & Sales Importer Launchers -->
            <div class="grid grid-cols-1 gap-3" :class="locationMeta.usesRicochet ? 'sm:grid-cols-2' : 'sm:grid-cols-1'">
              <div
                v-if="locationMeta.usesRicochet"
                class="bg-base-200/45 border border-base-300 rounded-2xl p-4 flex flex-col justify-between gap-3"
              >
                <div class="space-y-1">
                  <div class="font-black text-sm text-base-content flex items-center gap-1.5">
                    <Icon icon="solar:round-transfer-horizontal-bold-duotone" class="w-4.5 h-4.5 text-secondary shrink-0" />
                    <span>POS &amp; Barcode Sync</span>
                  </div>
                  <p class="text-xs text-base-content/75 leading-relaxed">
                    Match booth SKUs to barcodes, adopt physical shelf stickers, and review sync scorecards.
                  </p>
                </div>
                <a
                  :href="syncHref"
                  class="btn btn-sm h-11 md:h-9 btn-outline btn-secondary font-bold rounded-xl w-full whitespace-nowrap"
                >
                  Open POS &amp; Barcode Sync ➔
                </a>
              </div>

              <div class="bg-base-200/45 border border-base-300 rounded-2xl p-4 flex flex-col justify-between gap-3">
                <div class="space-y-1">
                  <div class="font-black text-sm text-base-content flex items-center gap-1.5">
                    <Icon icon="solar:import-bold-duotone" class="w-4.5 h-4.5 text-success shrink-0" />
                    <span>Sales Importer</span>
                  </div>
                  <p class="text-xs text-base-content/75 leading-relaxed">
                    {{
                      locationMeta.supportsPaperSalesSheet
                        ? 'Upload or snap handwritten sales sheets and record booth payouts.'
                        : 'Stage live payout sales or import monthly payout CSVs into the sales ledger.'
                    }}
                  </p>
                </div>
                <a
                  :href="salesImportHref"
                  class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content font-black rounded-xl w-full whitespace-nowrap"
                >
                  Open Sales Importer ➔
                </a>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <footer class="px-4 sm:px-6 py-3 border-t border-base-200 bg-base-200/60 flex items-center justify-end shrink-0">
            <button
              type="button"
              class="btn btn-sm h-11 md:h-9 btn-ghost border border-base-300 font-bold rounded-xl px-5"
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
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { Icon } from '@iconify/vue';
import BookmarkletHeroBar from '../bml/BookmarkletHeroBar.vue';
import LocationChannelOutboxPanel from './LocationChannelOutboxPanel.vue';
import { getCoopJwtHeaders } from '../../lib/coopLedgerClient';
import { useBodyScrollLock } from '../../composables/useBodyScrollLock';
import type { LocationSettingMeta } from '../../lib/warehouses';

const props = defineProps<{
  modelValue: boolean;
  locationMeta: LocationSettingMeta;
  canonicalCode: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'pending-count', count: number): void;
}>();

const mounted = ref(false);
const pendingCount = ref(0);
useBodyScrollLock(() => props.modelValue);

const effectiveCode = computed(() =>
  String(props.canonicalCode || props.locationMeta?.code || '').trim().toUpperCase()
);

const syncHref = computed(() =>
  `/warehouse/sync/${encodeURIComponent(effectiveCode.value)}`
);

const salesImportHref = computed(() =>
  `/sales/import/${encodeURIComponent(effectiveCode.value)}`
);

const handleOutboxPendingCount = (count: number) => {
  pendingCount.value = count;
  emit('pending-count', count);
};

// Keep bottom-dock badge accurate on initial page load even before the user opens the tray.
const preloadPendingCount = async () => {
  const code = effectiveCode.value;
  if (!code) return;
  if (!props.locationMeta?.usesRicochet && !props.locationMeta?.supportsPaperSalesSheet) {
    handleOutboxPendingCount(0);
    return;
  }
  try {
    const res = await fetch(`/api/sync/channel-outbox?location=${encodeURIComponent(code)}`, {
      method: 'GET',
      headers: await getCoopJwtHeaders(),
    });
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    if (!data?.ok || !Array.isArray(data.intents)) return;
    const count = data.intents.filter(
      (i: any) => i?.status === 'pending' || i?.status === 'failed'
    ).length;
    handleOutboxPendingCount(count);
  } catch {
    // Non-blocking badge preload
  }
};

const closeTray = () => {
  emit('update:modelValue', false);
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

watch(
  effectiveCode,
  () => {
    void preloadPendingCount();
  },
  { immediate: true }
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
.rc-location-tools-tray-enter-active,
.rc-location-tools-tray-leave-active {
  transition: opacity 0.2s ease-out;
}
.rc-location-tools-tray-enter-from,
.rc-location-tools-tray-leave-to {
  opacity: 0;
}
</style>

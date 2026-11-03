<template>
  <Teleport to="body">
    <Transition name="import-tray">
      <div v-if="isOpen" class="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label="Manual CSV and Demo">
        <!-- Scrim -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-xs" @click="emit('close')"></div>

        <!-- Slide-Over Tray (docked to the right edge) -->
        <aside
          class="import-tray-panel relative h-full w-full sm:w-[26rem] bg-base-100 border-l border-base-300 shadow-2xl flex flex-col pb-[env(safe-area-inset-bottom,0px)]"
        >
          <header class="flex items-center justify-between gap-2 px-4 py-3 border-b border-base-300 bg-base-200/60 shrink-0">
            <div class="min-w-0">
              <h3 class="font-black text-base text-base-content flex items-center gap-2">
                <Icon icon="solar:folder-with-files-bold" class="w-5 h-5 text-primary shrink-0" />
                <span>Manual CSV &amp; Demo</span>
              </h3>
              <p class="text-[11px] opacity-70 truncate">Fallback intake for {{ locationMeta.shortName }} ({{ locationMeta.code }})</p>
            </div>
            <button type="button" class="btn btn-sm btn-ghost btn-square" aria-label="Close tray" @click="emit('close')">
              <Icon icon="solar:close-circle-bold" class="w-5 h-5" />
            </button>
          </header>

          <div class="flex-1 overflow-y-auto p-4 space-y-4">
            <!-- Locked venue badge -->
            <div class="bg-base-200/70 border border-primary/30 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <span class="badge badge-primary font-mono font-black text-xs px-2 py-2 gap-1 shrink-0">
                  <span>{{ locationMeta.icon }}</span>
                  <span>{{ locationMeta.code }}</span>
                </span>
                <div class="text-left min-w-0">
                  <div class="text-[10px] uppercase font-bold opacity-60 leading-none">Locked Payout Venue</div>
                  <div class="text-xs font-black text-base-content truncate">{{ locationMeta.fullName }}</div>
                </div>
              </div>
              <span class="badge badge-xs badge-outline font-mono font-bold shrink-0">{{ locationMeta.feePct }}%</span>
            </div>

            <!-- Dropzone -->
            <div class="flex flex-col items-center justify-center p-6 border-2 border-dashed border-base-300 rounded-2xl bg-base-200/50 hover:bg-base-200 transition-colors text-center">
              <Icon icon="solar:upload-minimalistic-linear" class="w-10 h-10 opacity-50 mb-2 text-primary" />
              <h4 class="font-bold text-base mb-1">Upload Month-End Payout CSV</h4>
              <p class="text-xs opacity-70 mb-3 max-w-xs">
                Upload the payout export from Ricochet (Consignors &rarr; Payouts). The tray closes as soon as a file is chosen.
              </p>
              <input
                type="file"
                accept=".csv,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx,.xls,*/*"
                class="file-input file-input-bordered file-input-primary file-input-sm w-full rounded-xl"
                :disabled="isProcessing"
                @change="onFileChange"
              />
            </div>

            <div v-if="catalogFileDetected" class="alert alert-warning py-2.5 px-4 rounded-xl text-xs shadow-sm">
              <span>
                <strong>📦 That's a Product Catalog export (<code>Products-*.csv</code>).</strong>
                It has no Sale # or Sold Date, so no sales were created. To record sales upload a <strong>Payouts-*.csv</strong> here;
                to refresh booth stock &amp; quantities use <strong>Location Sync</strong> with this catalog file.
              </span>
            </div>

            <div class="divider text-xs opacity-60 my-1">OR</div>

            <button
              type="button"
              class="btn btn-outline btn-sm gap-2 rounded-xl w-full"
              :disabled="isProcessing"
              @click="onLoadDemo"
            >
              <Icon icon="solar:folder-with-files-bold" class="w-4 h-4 text-primary" />
              <span>Load {{ locationMeta.shortName }} Full Payout (Multi-Month Demo)</span>
            </button>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import type { LocationSettingMeta } from '../../lib/warehouses';

/**
 * SalesImportTray.vue — Slide-Over Tray (right edge) holding the manual "Upload Month-End Payout CSV"
 * dropzone and the "Load Multi-Month Demo" action, so the main Sales Import canvas stays
 * Top KPIs ➔ Full Data Table ➔ Sticky Bottom Bar.
 *
 * Teleports to <body>, so root attrs cannot fall through: every prop and emit is declared (vue-component-standards).
 */
defineOptions({ name: 'SalesImportTray', inheritAttrs: false });

defineProps<{
  isOpen: boolean;
  isProcessing: boolean;
  catalogFileDetected: boolean;
  locationMeta: LocationSettingMeta;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'file-selected', event: Event): void;
  (e: 'load-demo'): void;
}>();

// Hand the event to the parent first (it reads the File synchronously), then auto-close the tray.
const onFileChange = (event: Event) => {
  emit('file-selected', event);
  emit('close');
};

const onLoadDemo = () => {
  emit('load-demo');
  emit('close');
};

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') emit('close');
};

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<style scoped>
.import-tray-enter-active,
.import-tray-leave-active {
  transition: opacity 0.2s ease-out;
}
.import-tray-enter-active .import-tray-panel,
.import-tray-leave-active .import-tray-panel {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.import-tray-enter-from,
.import-tray-leave-to {
  opacity: 0;
}
.import-tray-enter-from .import-tray-panel,
.import-tray-leave-to .import-tray-panel {
  transform: translateX(100%);
}
</style>


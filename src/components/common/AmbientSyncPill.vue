<template>
  <Teleport to="body">
    <div
      v-if="!globalLoading && (ambientSyncCount > 0 || ambientDoneLabel || pendingCalmCount > 0)"
      class="fixed top-[calc(4.25rem+env(safe-area-inset-top,0px))] left-1/2 -translate-x-1/2 z-[460] pointer-events-none flex flex-col items-center gap-1.5 px-3"
      role="status"
      aria-live="polite"
    >
      <!-- Active Ambient Sync or Brief Done Confirmation -->
      <div
        v-if="ambientSyncCount > 0"
        class="bg-base-100/95 border border-base-300 shadow-md backdrop-blur-md rounded-full px-3.5 py-1.5 text-xs font-bold text-base-content flex items-center gap-2 whitespace-nowrap"
      >
        <span class="loading loading-spinner loading-xs text-primary shrink-0"></span>
        <span>{{ ambientSyncLabel || 'Saving…' }}</span>
      </div>
      <div
        v-else-if="ambientDoneLabel"
        class="bg-base-100/95 border border-success/40 shadow-md backdrop-blur-md rounded-full px-3.5 py-1.5 text-xs font-bold text-base-content flex items-center gap-1.5 whitespace-nowrap"
      >
        <Icon icon="solar:check-circle-bold" class="w-4 h-4 text-success shrink-0" />
        <span>{{ ambientDoneLabel }}</span>
      </div>

      <!-- Buffered Calm Realtime Pill (when external row-shifting events await user focus) -->
      <button
        v-if="pendingCalmCount > 0"
        type="button"
        class="pointer-events-auto btn btn-xs h-8 px-3.5 rounded-full btn-primary text-primary-content font-black shadow-md border border-primary-content/25 gap-1.5 whitespace-nowrap active:scale-95"
        @click="applyLiveUpdates"
      >
        <Icon icon="solar:stars-minimalistic-bold" class="w-3.5 h-3.5 shrink-0" />
        <span>
          {{ pendingCalmCount }} live {{ pendingCalmCount === 1 ? 'update' : 'updates' }} · Apply
        </span>
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { useLoader } from '../../composables/useLoader';
import { useCalmRealtime } from '../../composables/useCalmRealtime';

const {
  globalLoading,
  ambientSyncCount,
  ambientSyncLabel,
  ambientDoneLabel,
  finishAmbientSync,
} = useLoader();

const { pendingCalmCount, flushCalmUpdates } = useCalmRealtime();

const applyLiveUpdates = () => {
  const count = flushCalmUpdates();
  if (count > 0) {
    finishAmbientSync(`✅ Applied ${count} live ${count === 1 ? 'update' : 'updates'}`);
  }
};
</script>

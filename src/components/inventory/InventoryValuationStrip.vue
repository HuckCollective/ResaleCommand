<template>
  <div class="space-y-2.5">
    <!-- Compact 1-Line Valuation & Margin Strip (Collapsed by Default — Saves ~220px Above Item #1) -->
    <button
      type="button"
      :aria-expanded="expanded"
      class="w-full rounded-xl border border-base-300 bg-base-200/55 hover:bg-base-200 px-3 py-2 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer min-h-11 md:min-h-9"
      @click="expanded = !expanded"
    >
      <div class="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0 text-xs">
        <span class="font-extrabold text-base-content inline-flex items-center gap-1.5 shrink-0">
          <Icon icon="solar:chart-2-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
          <span>Valuation &amp; Margin Summary</span>
        </span>
        <span v-if="stats.length >= 4" class="flex items-center gap-2 sm:gap-3 flex-wrap font-mono text-[11px] sm:text-xs">
          <span class="text-base-content/80 font-bold">{{ stats[0].value }}</span>
          <span class="opacity-35">•</span>
          <span class="text-info font-bold">Retail {{ stats[1].value }}</span>
          <span class="opacity-35 hidden sm:inline">•</span>
          <span class="text-warning font-bold hidden sm:inline">Cost {{ stats[2].value }}</span>
          <span class="opacity-35">•</span>
          <span class="font-black" :class="stats[3].tone || 'text-success'">Spread {{ stats[3].value }}</span>
          <span
            v-if="stats[3].badge"
            class="badge badge-2xs badge-success text-success-content font-bold whitespace-nowrap shrink-0"
          >
            {{ stats[3].badge }}
          </span>
        </span>
      </div>

      <span class="text-[11px] font-bold text-primary shrink-0 inline-flex items-center gap-1">
        <span class="hidden sm:inline">{{ expanded ? 'Hide Cards' : 'Details' }}</span>
        <span class="transition-transform" :class="expanded ? 'rotate-180' : ''">▾</span>
      </span>
    </button>

    <div v-if="expanded" class="pt-0.5">
      <KpiStatGrid :items="stats" :columns="4" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Icon } from '@iconify/vue';
import KpiStatGrid from '../common/KpiStatGrid.vue';
import type { KpiStatItem } from '../../lib/inventoryKpiStats';

defineProps<{
  stats: KpiStatItem[];
}>();

const expanded = ref(false);
</script>

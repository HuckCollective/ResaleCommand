<template>
  <div class="grid gap-2 sm:gap-2.5" :class="gridColsClass">
    <a
      v-for="card in cards"
      :key="card.id"
      :href="card.link"
      class="flex flex-col justify-between p-2.5 sm:p-3.5 rounded-xl border bg-base-100 transition-all cursor-pointer group hover:shadow-md active:scale-[0.99]"
      :class="[card.borderClass, card.isAlert ? 'bg-warning/5' : '']"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-1.5 min-w-0">
            <h4 class="font-extrabold text-xs sm:text-sm text-base-content group-hover:text-primary transition-colors break-words">
              {{ card.title }}
            </h4>
            <span
              class="badge badge-2xs font-extrabold uppercase tracking-wider text-[8px] px-1.5 py-1 shrink-0"
              :class="card.isAlert ? 'badge-warning text-warning-content' : 'badge-ghost border-base-300 text-base-content/70'"
            >
              {{ card.badgeLabel }}
            </span>
          </div>
          <p class="text-[10px] sm:text-[11px] text-base-content/60 leading-tight mt-0.5 break-words">
            {{ card.subtitle }}
          </p>
        </div>

        <div class="flex flex-col items-end shrink-0 text-right">
          <div class="flex items-center gap-1 font-mono leading-none">
            <span class="font-black text-sm sm:text-base text-base-content">{{ card.count.toLocaleString() }}</span>
            <span v-if="!compact" class="text-[10px] text-base-content/60">items</span>
            <Icon
              icon="solar:arrow-right-linear"
              class="w-3 h-3 text-primary transform group-hover:translate-x-0.5 transition-transform"
            />
          </div>
          <div class="flex items-center gap-1 mt-0.5">
            <span v-if="!compact && card.unitCount > card.count" class="text-[9px] font-mono text-base-content/55">
              {{ card.unitCount.toLocaleString() }}u ·
            </span>
            <span class="text-[10px] sm:text-xs font-mono font-extrabold text-success">
              ${{ card.totalValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }}
            </span>
          </div>
        </div>
      </div>
    </a>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import type { RadarCard } from '../../composables/dashboard/useOperationsRadar';

const props = withDefaults(
  defineProps<{
    cards: RadarCard[];
    category?: 'queues' | 'locations' | 'partners' | 'all';
    compact?: boolean;
  }>(),
  {
    category: 'queues',
    compact: false,
  }
);

const gridColsClass = computed(() => {
  if (props.compact) return 'grid-cols-1 sm:grid-cols-2 content-start';
  if (props.category === 'locations' || props.category === 'partners') {
    return 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
  }
  return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
});
</script>


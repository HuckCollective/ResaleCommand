<template>
  <div class="grid gap-2.5 sm:gap-3.5" :class="gridClass">
    <div
      v-for="stat in items"
      :key="stat.label"
      class="p-3 sm:p-4 rounded-xl bg-base-200/50 border border-base-300/80 flex flex-col justify-between gap-1"
    >
      <div class="flex items-center justify-between gap-1.5">
        <span class="text-[11px] sm:text-xs font-bold text-base-content/70 break-words">{{ stat.label }}</span>
        <span
          v-if="stat.badge"
          class="badge badge-xs font-bold whitespace-nowrap shrink-0"
          :class="stat.badgeClass || 'badge-ghost'"
        >
          {{ stat.badge }}
        </span>
        <Icon
          v-else-if="stat.icon"
          :icon="stat.icon"
          class="w-4 h-4 sm:w-5 sm:h-5 shrink-0"
          :class="stat.tone || 'text-primary'"
        />
      </div>
      <div
        class="font-black font-mono text-lg sm:text-2xl leading-tight break-words"
        :class="stat.tone || 'text-base-content'"
      >
        {{ stat.value }}
      </div>
      <div v-if="stat.hint" class="text-[10px] sm:text-xs text-base-content/60 break-words">
        {{ stat.hint }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';

export interface KpiStatItem {
  label: string;
  value: string;
  hint?: string;
  icon?: string;
  tone?: string;
  badge?: string;
  badgeClass?: string;
}

const props = withDefaults(
  defineProps<{
    items: KpiStatItem[];
    columns?: 2 | 3 | 4;
  }>(),
  {
    columns: 4,
  }
);

const gridClass = computed(() => {
  if (props.columns === 2) return 'grid-cols-2';
  if (props.columns === 3) return 'grid-cols-1 sm:grid-cols-3';
  return 'grid-cols-2 lg:grid-cols-4';
});
</script>


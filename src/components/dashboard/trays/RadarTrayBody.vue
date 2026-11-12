<template>
  <div class="flex-1 min-h-0 flex flex-col">
    <div class="px-4 sm:px-6 py-2 border-b border-base-200 bg-base-100 flex items-center gap-1.5 overflow-x-auto max-w-full scrollbar-none shrink-0">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="btn btn-xs rounded-xl font-bold gap-1 shrink-0"
        :class="activeCategory === tab.id ? tab.activeClass : 'btn-ghost bg-base-200/70'"
        @click="activeCategory = tab.id"
      >
        <span>{{ tab.label }}</span>
        <span class="badge badge-2xs font-mono whitespace-nowrap shrink-0">{{ tab.count }}</span>
      </button>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
      <RadarCardList :cards="visibleRadarCards" :category="activeCategory" :compact="true" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import RadarCardList from '../RadarCardList.vue';
import { useOperationsRadar } from '../../../composables/dashboard/useOperationsRadar';

const { activeCategory, visibleRadarCards, categoryCounts } = useOperationsRadar();

const tabs = computed(() => [
  { id: 'queues' as const, label: 'Restock & Triage', count: categoryCounts.value.queues, activeClass: 'btn-secondary text-secondary-content' },
  { id: 'locations' as const, label: 'Locations', count: categoryCounts.value.locations, activeClass: 'btn-info text-info-content' },
  { id: 'partners' as const, label: 'Partners', count: categoryCounts.value.partners, activeClass: 'btn-accent text-accent-content' },
  { id: 'all' as const, label: 'All', count: categoryCounts.value.all, activeClass: 'btn-primary text-primary-content' },
]);
</script>


<template>
  <div class="card bg-base-100 shadow-xl border border-base-300/80 overflow-hidden transition-all">
    <!-- Section Header -->
    <div
      @click="toggle"
      class="p-3 sm:p-4 flex items-center justify-between gap-2 cursor-pointer hover:bg-base-200/50 transition-colors select-none"
      :class="{ 'border-b border-base-200': !isCollapsed }"
      role="button"
      :aria-expanded="!isCollapsed"
      tabindex="0"
      @keydown.enter.space="toggle"
    >
      <div class="flex items-center gap-2.5 min-w-0">
        <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-secondary/15 flex items-center justify-center text-secondary shadow-sm shrink-0">
          <Icon icon="solar:radar-2-bold-duotone" class="w-4.5 h-4.5 sm:w-6 sm:h-6" />
        </div>
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-1.5">
            <h3 class="font-extrabold text-sm sm:text-base text-base-content tracking-tight break-words">
              Operations &amp; Booth Restock Radar
            </h3>
            <span class="badge badge-2xs sm:badge-xs badge-secondary text-secondary-content font-bold whitespace-nowrap">
              Top {{ displayedCards.length }} Active
            </span>
          </div>
          <p class="text-[10px] sm:text-xs text-base-content/65 break-words">
            Top triage queues on canvas — open the full Restock Radar Tray for every booth &amp; partner queue
          </p>
        </div>
      </div>

      <!-- Header Controls -->
      <div class="flex items-center gap-1 shrink-0">
        <button
          type="button"
          @click.stop="openTray('radar')"
          class="btn btn-xs btn-outline border-base-300 font-bold gap-1 transition-all px-2 h-7 min-h-7"
        >
          <span class="text-[11px] whitespace-nowrap">Full Tray ({{ visibleRadarCards.length }}) ↑</span>
        </button>

        <button
          type="button"
          @click.stop="isCustomizing = !isCustomizing; if (isCollapsed) isCollapsed = false;"
          class="btn btn-xs font-bold gap-1 transition-all px-2 h-7 min-h-7"
          :class="isCustomizing ? 'btn-secondary text-secondary-content shadow-xs' : 'btn-ghost border border-base-300'"
          title="Customize which radar cards appear on your Command Center"
        >
          <span class="text-[11px] whitespace-nowrap">⚙️</span>
          <span v-if="hiddenCardIds.length > 0" class="badge badge-2xs badge-neutral font-mono">
            {{ allRadarCards.length - hiddenCardIds.length }}/{{ allRadarCards.length }}
          </span>
        </button>

        <button
          type="button"
          class="btn btn-ghost btn-xs btn-circle shrink-0 hover:bg-base-300"
          :aria-expanded="!isCollapsed"
          aria-label="Toggle Operations Radar"
        >
          <Icon
            icon="solar:alt-arrow-down-linear"
            class="w-4 h-4 transition-transform duration-200"
            :class="{ '-rotate-90': isCollapsed }"
          />
        </button>
      </div>
    </div>

    <!-- Collapsible Body -->
    <div v-show="!isCollapsed" class="p-2.5 sm:p-4 space-y-2.5">
      <!-- Customize Cards Panel -->
      <div
        v-if="isCustomizing"
        class="p-3 rounded-2xl bg-base-200/80 border border-secondary/30 space-y-2.5 animate-fade-in"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 text-xs font-extrabold text-base-content">
            <span>⚙️ Select Radar Cards to Display</span>
          </div>
          <div class="flex items-center gap-1.5">
            <button
              v-if="hiddenCardIds.length > 0"
              type="button"
              @click="resetCardConfig"
              class="btn btn-2xs btn-ghost text-warning font-bold"
            >
              Reset Default
            </button>
            <button
              type="button"
              @click="isCustomizing = false"
              class="btn btn-2xs btn-secondary text-secondary-content font-bold px-2.5"
            >
              Done
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
          <label
            v-for="card in allRadarCards"
            :key="`cfg-${card.id}`"
            class="flex items-center justify-between gap-2 p-2 rounded-xl border bg-base-100 cursor-pointer select-none transition-all text-xs"
            :class="isCardVisible(card.id) ? 'border-secondary/40 font-bold' : 'border-base-300 opacity-60'"
          >
            <div class="flex items-center gap-2 min-w-0">
              <input
                type="checkbox"
                class="checkbox checkbox-xs checkbox-secondary"
                :checked="isCardVisible(card.id)"
                @change="toggleCardVisibility(card.id)"
              />
              <span class="break-words">{{ card.title }}</span>
            </div>
            <span class="badge badge-2xs badge-ghost font-mono shrink-0">{{ card.count }}</span>
          </label>
        </div>
      </div>

      <!-- Category Tabs -->
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1 bg-base-200/80 p-1 rounded-xl overflow-x-auto max-w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <button
            v-for="tab in categoryTabs"
            :key="tab.id"
            type="button"
            @click="activeCategory = tab.id"
            class="btn btn-xs rounded-lg font-bold gap-1 shrink-0 transition-all h-7 min-h-7 px-2.5"
            :class="activeCategory === tab.id ? tab.activeClass : 'btn-ghost text-base-content/75'"
          >
            <span>{{ tab.label }}</span>
            <span class="badge badge-2xs font-mono font-bold" :class="activeCategory === tab.id ? 'badge-neutral' : 'badge-ghost'">
              {{ tab.count }}
            </span>
          </button>
        </div>
      </div>

      <!-- Top-6 Capped On-Canvas Bento Grid -->
      <template v-if="displayedCards.length > 0">
        <RadarCardList :cards="displayedCards" :category="activeCategory" />
        <div
          v-if="overflowCount > 0"
          class="rounded-xl border border-base-300 bg-base-200/50 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
        >
          <span class="font-bold text-base-content/75">
            +{{ overflowCount }} more radar queue{{ overflowCount === 1 ? '' : 's' }} in {{ activeCategory }}
          </span>
          <button
            type="button"
            class="btn btn-xs btn-secondary text-secondary-content rounded-lg font-black gap-1"
            @click="openTray('radar')"
          >
            <span>Open Full Radar Tray ({{ visibleRadarCards.length }}) ↑</span>
          </button>
        </div>
      </template>

      <div v-else class="text-center py-5 border border-dashed border-base-300 rounded-xl text-xs text-base-content/60 space-y-2">
        <p>No radar cards visible in this category.</p>
        <button type="button" @click="resetCardConfig" class="btn btn-xs btn-outline">
          Reset Card Visibility
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import RadarCardList from './RadarCardList.vue';
import { useDashboardSource } from '../../composables/dashboard/useDashboardSource';
import { useCollapsibleSection } from '../../composables/dashboard/useCollapsibleSection';
import { useDashboardCommandTray } from '../../composables/dashboard/useDashboardCommandTray';
import { useOperationsRadar } from '../../composables/dashboard/useOperationsRadar';

const ON_PAGE_RADAR_CAP = 6;

const source = useDashboardSource();
const { openTray } = useDashboardCommandTray();
const { isCollapsed, toggle } = useCollapsibleSection('radar', false, source.mode === 'live');

const {
  activeCategory,
  isCustomizing,
  hiddenCardIds,
  allRadarCards,
  visibleRadarCards,
  categoryCounts,
  isCardVisible,
  toggleCardVisibility,
  resetCardConfig,
} = useOperationsRadar();

const displayedCards = computed(() => visibleRadarCards.value.slice(0, ON_PAGE_RADAR_CAP));
const overflowCount = computed(() => Math.max(0, visibleRadarCards.value.length - ON_PAGE_RADAR_CAP));

const categoryTabs = computed(() => [
  { id: 'queues' as const, label: 'Restock & Triage', count: categoryCounts.value.queues, activeClass: 'btn-secondary text-secondary-content shadow-xs' },
  { id: 'locations' as const, label: 'Locations', count: categoryCounts.value.locations, activeClass: 'btn-info text-info-content shadow-xs' },
  { id: 'partners' as const, label: 'Partners', count: categoryCounts.value.partners, activeClass: 'btn-accent text-accent-content shadow-xs' },
  { id: 'all' as const, label: 'All', count: categoryCounts.value.all, activeClass: 'btn-primary text-primary-content shadow-xs' },
]);
</script>

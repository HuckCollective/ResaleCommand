<template>
  <div class="flex-1 min-h-0 flex flex-col">
    <div class="px-4 sm:px-6 py-2 border-b border-base-200 bg-base-100 flex items-center gap-1.5 overflow-x-auto max-w-full scrollbar-none shrink-0">
      <button
        v-for="tab in triageTabs"
        :key="tab.id"
        type="button"
        class="btn btn-2xs sm:btn-xs rounded-xl font-bold gap-1 shrink-0"
        :class="triageFilter === tab.id ? 'btn-primary text-primary-content' : 'btn-ghost bg-base-200/70'"
        @click="triageFilter = tab.id"
      >
        <span>{{ tab.label }}</span>
        <span class="badge badge-2xs font-mono whitespace-nowrap shrink-0">{{ tab.count }}</span>
      </button>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-2.5">
      <div
        v-if="filteredTriageCards.length === 0"
        class="rounded-2xl border border-dashed border-base-300 bg-base-200/30 p-6 text-center space-y-2"
      >
        <Icon icon="solar:check-circle-bold" class="w-8 h-8 text-success mx-auto" />
        <div class="text-sm font-black">All clear in this filter</div>
        <p class="text-xs text-base-content/65">
          {{ triageFilter === 'snoozed' ? 'No alerts are currently snoozed.' : 'Nothing needs immediate triage here right now.' }}
        </p>
      </div>

      <article
        v-for="card in filteredTriageCards"
        :key="`tray-${card.id}`"
        class="rounded-2xl border-2 bg-base-100 p-3.5 space-y-2 shadow-xs"
        :class="ALERT_SEVERITY_BORDER[card.severity]"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-start gap-2 min-w-0">
            <Icon :icon="card.icon" class="w-5 h-5 shrink-0 mt-0.5" :class="ALERT_SEVERITY_TEXT[card.severity]" />
            <div class="min-w-0">
              <div class="text-[10px] font-extrabold uppercase tracking-wider opacity-60">
                {{ ALERT_CATEGORY_LABEL[card.category] }}
              </div>
              <h4 class="text-sm font-black leading-snug break-words">{{ card.title }}</h4>
            </div>
          </div>
          <span class="badge font-black whitespace-nowrap shrink-0" :class="ALERT_SEVERITY_BADGE[card.severity]">
            {{ card.count }}
          </span>
        </div>

        <p class="text-xs text-base-content/75 leading-relaxed break-words">{{ card.detail }}</p>

        <ul v-if="card.samples.length > 0" class="space-y-1 pl-1">
          <li v-for="(s, idx) in card.samples" :key="idx">
            <a :href="s.href" class="text-xs font-semibold link link-hover text-base-content/85 break-words">
              • {{ s.label }}
            </a>
          </li>
        </ul>

        <div class="pt-2 border-t border-base-200 flex flex-wrap items-center justify-between gap-2">
          <a
            :href="card.href"
            class="btn btn-xs btn-primary text-primary-content rounded-lg font-black gap-1 h-8 px-3"
          >
            <span>{{ card.actionText }}</span>
            <Icon icon="solar:arrow-right-linear" class="w-3.5 h-3.5 shrink-0" />
          </a>

          <div v-if="triageFilter === 'snoozed'" class="flex items-center gap-1.5">
            <button
              type="button"
              class="btn btn-xs btn-outline btn-success rounded-lg font-bold"
              @click="unsnooze(card.id)"
            >
              Restore Alert
            </button>
          </div>
          <div v-else class="flex items-center gap-1">
            <button
              type="button"
              class="btn btn-2xs btn-ghost rounded-lg font-bold text-base-content/65"
              @click="snooze(card.id, 1)"
            >
              Snooze 1d
            </button>
            <button
              type="button"
              class="btn btn-2xs btn-ghost rounded-lg font-bold text-base-content/65"
              @click="snooze(card.id, 7)"
            >
              7d
            </button>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import {
  useDashboardCommandTray,
  ALERT_SEVERITY_BORDER,
  ALERT_SEVERITY_TEXT,
  ALERT_SEVERITY_BADGE,
  ALERT_CATEGORY_LABEL,
  type TriageFilterId,
} from '../../../composables/dashboard/useDashboardCommandTray';

const {
  triageFilter,
  activeCards,
  snoozedCards,
  criticalCount,
  snooze,
  unsnooze,
} = useDashboardCommandTray();

const triageTabs = computed<{ id: TriageFilterId; label: string; count: number }[]>(() => [
  { id: 'all', label: 'All Active', count: activeCards.value.length },
  { id: 'critical', label: 'Urgent', count: criticalCount.value },
  { id: 'inventory', label: 'Inventory & Booth', count: activeCards.value.filter((c) => c.category === 'inventory').length },
  { id: 'sales', label: 'Sales & Sync', count: activeCards.value.filter((c) => c.category === 'sales').length },
  { id: 'coop', label: 'Co-op & Votes', count: activeCards.value.filter((c) => c.category === 'coop' || c.category === 'membership' || c.category === 'marketing').length },
  { id: 'snoozed', label: 'Snoozed', count: snoozedCards.value.length },
]);

const filteredTriageCards = computed(() => {
  if (triageFilter.value === 'snoozed') return snoozedCards.value;
  if (triageFilter.value === 'critical') {
    return activeCards.value.filter((c) => c.severity === 'error' || c.severity === 'warning');
  }
  if (triageFilter.value === 'inventory') {
    return activeCards.value.filter((c) => c.category === 'inventory');
  }
  if (triageFilter.value === 'sales') {
    return activeCards.value.filter((c) => c.category === 'sales');
  }
  if (triageFilter.value === 'coop') {
    return activeCards.value.filter((c) => c.category === 'coop' || c.category === 'membership' || c.category === 'marketing');
  }
  return activeCards.value;
});
</script>


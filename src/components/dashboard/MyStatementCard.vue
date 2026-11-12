<template>
  <div class="card bg-base-100 border-2 border-primary/30 shadow-sm rounded-2xl p-4 sm:p-5 space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="text-[11px] font-extrabold uppercase tracking-wider text-primary">My Statement</span>
        <span class="badge badge-2xs badge-primary badge-outline font-bold whitespace-nowrap">👤 My Pulse</span>
      </div>
      <a href="/coop/settlements" class="btn btn-xs btn-outline rounded-lg font-bold">Open Statements</a>
    </div>

    <div v-if="statement" class="space-y-3">
      <div class="text-xs text-base-content/70 break-words">{{ statement.month }} · {{ statement.dealLabel }}</div>
      <KpiStatGrid :items="rows" />
      <p class="text-[11px] text-base-content/60 leading-relaxed">
        You see your own statement and deal terms. The Collective's shared books are visible across voting members.
      </p>
    </div>
    <p v-else class="text-xs text-base-content/70 leading-relaxed">
      Your personal payout statement appears here as soon as sales are reconciled for the month.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import KpiStatGrid, { type KpiStatItem } from '../common/KpiStatGrid.vue';
import { useDashboardSource } from '../../composables/dashboard/useDashboardSource';

const source = useDashboardSource();
const statement = computed(() => source.snapshot.value.statement);
const money = (n: number) => `$${n.toFixed(2)}`;

const rows = computed<KpiStatItem[]>(() => {
  const s = statement.value;
  if (!s) return [];
  return [
    { label: 'My Gross Sales', value: money(s.grossSales), icon: 'solar:dollar-minimalistic-bold-duotone', tone: 'text-base-content' },
    { label: 'Venue Fee', value: `-${money(s.venueFee)}`, icon: 'solar:shop-2-bold-duotone', tone: 'text-error' },
    { label: 'Rent Offset', value: `-${money(s.rentOffset)}`, icon: 'solar:home-2-bold-duotone', tone: 'text-error' },
    { label: 'My Net Payout', value: money(s.payout), icon: 'solar:hand-money-bold-duotone', tone: 'text-success' },
  ];
});
</script>

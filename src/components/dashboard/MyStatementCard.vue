<template>
  <div class="card bg-base-100 border border-base-300 shadow-sm rounded-2xl p-4 sm:p-5 space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="text-[11px] font-extrabold uppercase tracking-wider text-primary">My Statement</div>
      <a href="/coop/settlements" class="btn btn-xs btn-outline rounded-lg font-bold">Open Statements</a>
    </div>

    <div v-if="statement" class="space-y-3">
      <div class="text-xs text-base-content/70 break-words">{{ statement.month }} · {{ statement.dealLabel }}</div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div v-for="row in rows" :key="row.label" class="p-3 rounded-xl bg-base-200/50 border border-base-300/80">
          <div class="text-[11px] font-bold text-base-content/70 break-words">{{ row.label }}</div>
          <div class="font-black font-mono text-lg leading-tight break-words" :class="row.tone">{{ row.value }}</div>
        </div>
      </div>
      <p class="text-[11px] text-base-content/60 leading-relaxed">
        You see your own statement and deal terms. The Collective's own books are shared among voting members.
      </p>
    </div>
    <p v-else class="text-xs text-base-content/70 leading-relaxed">
      Your statement appears here after each month closes.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useDashboardSource } from '../../composables/dashboard/useDashboardSource';

const source = useDashboardSource();
const statement = computed(() => source.snapshot.value.statement);
const money = (n: number) => `$${n.toFixed(2)}`;

const rows = computed(() => {
  const s = statement.value;
  if (!s) return [];
  return [
    { label: 'Gross sales', value: money(s.grossSales), tone: 'text-base-content' },
    { label: 'Venue fee', value: `-${money(s.venueFee)}`, tone: 'text-error' },
    { label: 'Rent offset', value: `-${money(s.rentOffset)}`, tone: 'text-error' },
    { label: 'Your payout', value: money(s.payout), tone: 'text-success' },
  ];
});
</script>


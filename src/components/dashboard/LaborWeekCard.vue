<template>
  <div class="card bg-base-100 border border-base-300 shadow-sm rounded-2xl p-4 sm:p-5 space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <div class="text-[11px] font-extrabold uppercase tracking-wider text-primary">Labor This Week</div>
        <div class="text-xs text-base-content/65">Verified hours feed the Collective's labor pool</div>
      </div>
      <a href="/coop/labor" class="btn btn-xs btn-outline rounded-lg font-bold">Open Labor Ledger</a>
    </div>

    <div class="flex flex-wrap items-end gap-x-6 gap-y-2">
      <div>
        <div class="font-black font-mono text-2xl text-success">{{ myHours.toFixed(1) }}h</div>
        <div class="text-[11px] text-base-content/65">Your hours, last {{ ALERT_CONFIG.laborLogDays }} days</div>
      </div>
      <div>
        <div class="font-black font-mono text-2xl text-base-content">{{ teamHours.toFixed(1) }}h</div>
        <div class="text-[11px] text-base-content/65">Whole Collective</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useDashboardSource } from '../../composables/dashboard/useDashboardSource';
import { ALERT_CONFIG } from '../../lib/dashboardAlerts';

const source = useDashboardSource();

const recent = computed(() => {
  const cutoff = source.snapshot.value.now - ALERT_CONFIG.laborLogDays * 86_400_000;
  return source.snapshot.value.laborEntries.filter((e) => Date.parse(e.date) >= cutoff);
});

const teamHours = computed(() => recent.value.reduce((s, e) => s + (Number(e.hours) || 0), 0));
const myHours = computed(() => {
  const me = source.member.value.name.trim().toLowerCase();
  return recent.value.filter((e) => e.member.trim().toLowerCase() === me).reduce((s, e) => s + (Number(e.hours) || 0), 0);
});
</script>

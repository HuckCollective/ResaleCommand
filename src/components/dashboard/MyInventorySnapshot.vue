<template>
  <div class="card bg-base-100 border-2 border-primary/30 shadow-sm rounded-2xl p-4 sm:p-5 space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="text-[11px] font-extrabold uppercase tracking-wider text-primary">{{ title }}</span>
          <span class="badge badge-2xs badge-primary badge-outline font-bold whitespace-nowrap">👤 My Pulse</span>
        </div>
        <div v-if="prefix" class="text-xs text-base-content/65">
          Items tagged <span class="font-mono font-bold">{{ prefix }}</span>
        </div>
      </div>
      <a v-if="prefix" href="/inventory" class="btn btn-xs btn-outline rounded-lg font-bold">Open My Inventory</a>
    </div>

    <p v-if="!prefix" class="text-xs text-base-content/70 leading-relaxed">
      No barcode prefix is registered to you yet, so there are no personal items to total. A Founder can assign one in Settings.
    </p>

    <KpiStatGrid v-else :items="stats" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import KpiStatGrid, { type KpiStatItem } from '../common/KpiStatGrid.vue';
import { useDashboardSource, useActiveHat } from '../../composables/dashboard/useDashboardSource';
import { itemsOwnedBy, isActiveInventory, parseItemValue } from '../../lib/dashboardAlerts';

const source = useDashboardSource();
const activeHat = useActiveHat();

const prefix = computed(() => source.member.value.inventoryPrefix || '');
const title = computed(() => (activeHat.value === 'consignor' ? 'My Items on the Floor' : 'My Inventory'));

const mine = computed(() => itemsOwnedBy(source.snapshot.value.items, source.member.value));
const qty = (i: any) => i.quantity || 1;
const est = (i: any) => parseItemValue(i, 'resalePrice', 'Resale') || parseItemValue(i, 'estValue', 'Est. Low') || 0;
const cost = (i: any) => parseItemValue(i, 'cost', 'Paid') || parseItemValue(i, 'purchasePrice', 'Paid') || 0;

const stats = computed<KpiStatItem[]>(() => {
  const active = mine.value.filter(isActiveInventory);
  const sold = mine.value.filter((i) => i.status === 'sold');
  const onHand = active.reduce((s, i) => s + qty(i), 0);
  const value = active.reduce((s, i) => s + est(i) * qty(i), 0);
  const sunk = active.reduce((s, i) => s + cost(i) * qty(i), 0);
  return [
    { label: 'My Items on Hand', value: String(onHand), hint: 'Active personal stock', icon: 'solar:box-bold-duotone', tone: 'text-warning' },
    { label: 'My Est. Value', value: `$${value.toFixed(2)}`, hint: 'Unsold personal stock', icon: 'solar:tag-price-bold-duotone', tone: 'text-info' },
    { label: 'My Cost Basis', value: `$${sunk.toFixed(2)}`, hint: 'Recouped 100% first', icon: 'solar:shield-check-bold-duotone', tone: 'text-base-content' },
    { label: 'My Sold Items', value: String(sold.length), hint: 'Cleared at register', icon: 'solar:check-circle-bold-duotone', tone: 'text-success' },
  ];
});
</script>

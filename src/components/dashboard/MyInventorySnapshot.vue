<template>
  <div class="card bg-base-100 border border-base-300 shadow-sm rounded-2xl p-4 sm:p-5 space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="min-w-0">
        <div class="text-[11px] font-extrabold uppercase tracking-wider text-primary">{{ title }}</div>
        <div v-if="prefix" class="text-xs text-base-content/65">Items tagged <span class="font-mono font-bold">{{ prefix }}</span></div>
      </div>
      <a v-if="prefix" href="/inventory" class="btn btn-xs btn-outline rounded-lg font-bold">Open Inventory</a>
    </div>

    <p v-if="!prefix" class="text-xs text-base-content/70 leading-relaxed">
      No barcode prefix is registered to you yet, so there are no personal items to total. A Founder can assign one in Settings.
    </p>

    <div v-else class="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      <div v-for="stat in stats" :key="stat.label" class="p-3 rounded-xl bg-base-200/50 border border-base-300/80">
        <div class="text-[11px] font-bold text-base-content/70 break-words">{{ stat.label }}</div>
        <div class="font-black font-mono text-lg leading-tight break-words" :class="stat.tone">{{ stat.value }}</div>
        <div class="text-[10px] text-base-content/60 break-words">{{ stat.hint }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
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

const stats = computed(() => {
  const active = mine.value.filter(isActiveInventory);
  const sold = mine.value.filter((i) => i.status === 'sold');
  const onHand = active.reduce((s, i) => s + qty(i), 0);
  const value = active.reduce((s, i) => s + est(i) * qty(i), 0);
  const sunk = active.reduce((s, i) => s + cost(i) * qty(i), 0);
  return [
    { label: 'Items on hand', value: String(onHand), hint: 'Active stock', tone: 'text-warning' },
    { label: 'Est. value', value: `$${value.toFixed(2)}`, hint: 'Unsold items', tone: 'text-info' },
    { label: 'Cost basis', value: `$${sunk.toFixed(2)}`, hint: 'Returned to you first', tone: 'text-base-content' },
    { label: 'Sold', value: String(sold.length), hint: 'Items sold', tone: 'text-success' },
  ];
});
</script>

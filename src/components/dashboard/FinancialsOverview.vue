<template>
  <div class="card bg-base-100 shadow-xl border border-base-300/80 overflow-hidden transition-all">
    <div
      @click="toggle"
      class="p-3.5 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 cursor-pointer hover:bg-base-200/50 transition-colors select-none"
      :class="{ 'border-b border-base-200': !isCollapsed }"
      role="button"
      :aria-expanded="!isCollapsed"
      tabindex="0"
      @keydown.enter.space="toggle"
    >
      <div class="flex items-center gap-2.5">
        <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm shrink-0">
          <Icon icon="solar:chart-2-bold-duotone" class="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="font-extrabold text-sm sm:text-lg text-base-content tracking-tight">Collective Financials &amp; Inventory</h3>
            <span class="badge badge-xs badge-ghost text-base-content/70 font-bold whitespace-nowrap">Collective</span>
          </div>
          <p class="text-[11px] sm:text-xs text-base-content/65">Profit, estimated stock valuation, and purchase costs for the whole Collective</p>
        </div>
      </div>

      <div class="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto">
        <div class="flex flex-wrap items-center gap-1.5">
          <div class="badge badge-xs sm:badge-sm badge-success text-success-content font-extrabold whitespace-nowrap shadow-xs">
            +${{ globalProfit.toFixed(2) }} <span class="opacity-80 font-normal hidden sm:inline ml-1">Profit</span>
          </div>
          <div class="badge badge-xs sm:badge-sm badge-info text-info-content font-extrabold whitespace-nowrap shadow-xs">
            ${{ globalProjectedRevenue.toFixed(2) }} <span class="opacity-80 font-normal hidden sm:inline ml-1">Valuation</span>
          </div>
          <div class="badge badge-xs sm:badge-sm badge-warning text-warning-content font-bold whitespace-nowrap shadow-xs">{{ totalItemsCount }} in stock</div>
        </div>
        <button type="button" class="btn btn-ghost btn-xs btn-circle shrink-0 hover:bg-base-300" :aria-expanded="!isCollapsed" aria-label="Toggle Collective Financials">
          <Icon icon="solar:alt-arrow-down-linear" class="w-4 h-4 transition-transform duration-200" :class="{ '-rotate-90': isCollapsed }" />
        </button>
      </div>
    </div>

    <div v-show="!isCollapsed" class="p-3 sm:p-4 grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 bg-base-100">
      <div v-for="stat in stats" :key="stat.label" class="p-3 sm:p-4 rounded-xl bg-base-200/50 border border-base-300/80 flex flex-col justify-between">
        <div class="flex items-center justify-between gap-1.5 mb-1">
          <span class="text-[11px] sm:text-xs font-bold text-base-content/70 break-words">{{ stat.label }}</span>
          <Icon :icon="stat.icon" class="w-4 h-4 sm:w-5 sm:h-5 shrink-0" :class="stat.tone" />
        </div>
        <div class="font-black font-mono text-lg sm:text-2xl leading-tight break-words" :class="stat.tone">{{ stat.value }}</div>
        <div class="text-[10px] sm:text-xs text-base-content/60 mt-0.5 break-words">{{ stat.hint }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useDashboardSource } from '../../composables/dashboard/useDashboardSource';
import { useDashboardMetrics } from '../../composables/dashboard/useDashboardMetrics';
import { useCollapsibleSection } from '../../composables/dashboard/useCollapsibleSection';

const source = useDashboardSource();
const { totalItemsCount, globalProfit, globalProjectedRevenue, globalSunkCost, totalSpentPurchases, totalPurchasesCount } =
  useDashboardMetrics();
const { isCollapsed, toggle } = useCollapsibleSection('overview_v2', false, source.mode === 'live');

const stats = computed(() => [
  { label: 'Total Profit', value: `$${globalProfit.value.toFixed(2)}`, hint: 'From sold inventory', icon: 'solar:wallet-money-bold-duotone', tone: 'text-success' },
  { label: 'Est. Stock Value', value: `$${globalProjectedRevenue.value.toFixed(2)}`, hint: 'Unsold items in stock', icon: 'solar:chart-square-bold-duotone', tone: 'text-info' },
  { label: 'Items in Stock', value: String(totalItemsCount.value), hint: `$${globalSunkCost.value.toFixed(2)} sunk cost`, icon: 'solar:box-bold-duotone', tone: 'text-warning' },
  { label: 'Orders Placed', value: String(totalPurchasesCount.value), hint: `$${totalSpentPurchases.value.toFixed(2)} total spent`, icon: 'solar:cart-large-minimalistic-bold-duotone', tone: 'text-secondary' },
]);
</script>


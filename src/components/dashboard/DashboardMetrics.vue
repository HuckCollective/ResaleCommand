<template>
    <!-- REAL DASHBOARD CONTENT -->
    <div class="space-y-8">
        
        <div class="flex justify-between items-center">
            <h2 class="text-2xl font-bold">Dashboard</h2>
        </div>

        <!-- KEY METRICS (DaisyUI Stats) -->
        <div class="stats stats-vertical lg:stats-horizontal shadow w-full bg-base-100">
        
        <div class="stat">
            <div class="stat-figure text-success">
            <Icon icon="solar:wallet-money-linear" class="w-8 h-8" />
            </div>
            <div class="stat-title">Total Profit</div>
            <div class="stat-value text-success">${{ globalProfit.toFixed(2) }}</div>
            <div class="stat-desc">From sold inventory</div>
        </div>
        
        <div class="stat">
            <div class="stat-figure text-info">
            <Icon icon="solar:chart-square-linear" class="w-8 h-8" />
            </div>
            <div class="stat-title">Est. Inventory Value</div>
            <div class="stat-value text-info">${{ globalProjectedRevenue.toFixed(2) }}</div>
            <div class="stat-desc">Unsold items in stock</div>
        </div>
        
        <div class="stat">
            <div class="stat-figure text-warning">
            <Icon icon="solar:box-linear" class="w-8 h-8" />
            </div>
            <div class="stat-value text-warning">{{ totalItemsCount }}</div>
            <div class="stat-title">Items in Inventory</div>
            <div class="stat-desc text-warning">${{ globalSunkCost.toFixed(2) }} total sunk cost</div>
        </div>
        
        </div>

        <!-- AI BUSINESS INSIGHTS -->
        <div v-if="insights.length > 0" class="card bg-base-200 shadow-xl border border-warning/50 animate-fade-in">
        <div class="card-body p-5">
            <h3 class="card-title text-warning flex items-center gap-2 mb-2">
                <Icon icon="solar:lightbulb-bolt-bold-duotone" class="w-6 h-6" />
                AI Business Insights
            </h3>
            <p class="text-sm opacity-80 mb-4">I've analyzed your inventory. Here are some issues that might be affecting your metrics:</p>
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <a :href="`/inventory?insightFilter=${insight.filter}`" v-for="(insight, idx) in insights" :key="idx" class="flex flex-col text-sm bg-base-100 p-5 rounded-xl border border-base-300 hover:border-primary hover:shadow-md transition-all cursor-pointer relative overflow-hidden group">
                    <div class="flex items-center gap-2 font-bold mb-1">
                        <Icon icon="solar:danger-triangle-bold-duotone" class="text-error w-4 h-4" v-if="insight.type === 'error'" />
                        <Icon icon="solar:info-circle-bold-duotone" class="text-info w-4 h-4" v-if="insight.type === 'info'" />
                        {{ insight.title }}
                    </div>
                    <p class="opacity-70 text-xs">{{ insight.description }}</p>
                    <Icon icon="solar:arrow-right-linear" class="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-primary w-5 h-5" />
                </a>
            </div>
        </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { useDashboardMetrics } from '../../composables/dashboard/useDashboardMetrics';
import { useLoader } from '../../composables/useLoader';

const {
    loading,
    totalItemsCount,
    globalProfit,
    globalProjectedRevenue,
    globalSunkCost,
    insights,
    initDashboard
} = useDashboardMetrics();

const { showLoader } = useLoader();
showLoader("Loading Dashboard...");

onMounted(() => {
    initDashboard();
});
</script>

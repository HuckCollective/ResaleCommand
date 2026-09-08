<template>
  <div class="card bg-base-100 border border-primary/25 shadow-xl transition-all overflow-hidden">
    <!-- Card Header -->
    <div class="card-body p-5 sm:p-6 border-b border-base-200 bg-gradient-to-r from-primary/5 via-transparent to-base-100">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm">
            <Icon icon="solar:cpu-bolt-bold-duotone" class="w-6 h-6" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-extrabold text-lg sm:text-xl tracking-tight text-base-content">
                Gemini AI Spend & Usage
              </h3>
              <span class="badge badge-sm badge-primary font-bold gap-1 shadow-sm">
                <Icon icon="solar:shield-check-bold" class="w-3.5 h-3.5" />
                Admin
              </span>
            </div>
            <p class="text-xs text-base-content/65">
              Live token monitoring & multi-month historical audit (Gemini 2.5 Flash)
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 self-start sm:self-center">
          <button 
            @click="fetchMetrics" 
            :disabled="loading" 
            class="btn btn-ghost btn-sm gap-1.5 hover:bg-base-200"
            title="Refresh AI Usage Metrics"
          >
            <Icon 
              icon="solar:refresh-linear" 
              class="w-4 h-4" 
              :class="{ 'animate-spin': loading }" 
            />
            <span class="text-xs font-semibold">Refresh</span>
          </button>
          
          <a 
            href="https://console.cloud.google.com/billing/reports" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="btn btn-outline btn-primary btn-sm gap-1.5 text-xs font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            <span>Google Billing</span>
            <Icon icon="solar:arrow-right-up-linear" class="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading && !metrics" class="p-8 flex flex-col items-center justify-center gap-3 text-center">
      <span class="loading loading-spinner loading-md text-primary"></span>
      <p class="text-xs text-base-content/70 animate-pulse">Calculating historical AI usage across Prod & Dev...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="p-6">
      <div class="alert alert-error shadow-sm text-xs">
        <Icon icon="solar:danger-triangle-bold" class="w-5 h-5 flex-shrink-0" />
        <span>{{ error }}</span>
        <button @click="fetchMetrics" class="btn btn-xs btn-outline">Retry</button>
      </div>
    </div>

    <!-- Content State -->
    <div v-else-if="metrics" class="p-5 sm:p-6 space-y-6">
      <!-- 1. Headline Key Metrics Stats -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <!-- This Month (Current) -->
        <div class="bg-base-200/60 hover:bg-base-200 rounded-2xl p-4 border border-base-300/60 transition-all">
          <div class="flex items-center justify-between text-xs text-base-content/70 font-semibold mb-1">
            <span>This Month ({{ metrics.summary.thisMonth.label.split(' ')[0] }})</span>
            <span class="badge badge-xs badge-success text-[10px] font-bold">Active</span>
          </div>
          <div class="text-2xl sm:text-3xl font-black text-success tracking-tight">
            ${{ metrics.summary.thisMonth.estCost.toFixed(4) }}
          </div>
          <div class="flex items-center justify-between text-xs mt-2 text-base-content/65">
            <span>{{ metrics.summary.thisMonth.totalScans }} total scans</span>
            <span class="font-mono text-[11px]">{{ formatTokens(metrics.summary.thisMonth.totalTokens) }} tkn</span>
          </div>
        </div>

        <!-- Last Month (August 2026) -->
        <div class="bg-base-200/60 hover:bg-base-200 rounded-2xl p-4 border border-base-300/60 transition-all">
          <div class="flex items-center justify-between text-xs text-base-content/70 font-semibold mb-1">
            <span>Last Month ({{ metrics.summary.lastMonth.label.split(' ')[0] }})</span>
            <span class="badge badge-xs badge-ghost text-[10px]">Closed</span>
          </div>
          <div class="text-2xl sm:text-3xl font-black text-base-content tracking-tight">
            ${{ metrics.summary.lastMonth.estCost.toFixed(4) }}
          </div>
          <div class="flex items-center justify-between text-xs mt-2 text-base-content/65">
            <span>{{ metrics.summary.lastMonth.totalScans }} total scans</span>
            <span class="font-mono text-[11px]">{{ formatTokens(metrics.summary.lastMonth.totalTokens) }} tkn</span>
          </div>
        </div>

        <!-- All-Time Lifetime -->
        <div class="bg-base-200/60 hover:bg-base-200 rounded-2xl p-4 border border-base-300/60 transition-all">
          <div class="flex items-center justify-between text-xs text-base-content/70 font-semibold mb-1">
            <span>All-Time Total</span>
            <span class="badge badge-xs badge-primary text-[10px] font-bold">Lifetime</span>
          </div>
          <div class="text-2xl sm:text-3xl font-black text-primary tracking-tight">
            ${{ metrics.summary.allTime.totalCost.toFixed(4) }}
          </div>
          <div class="flex items-center justify-between text-xs mt-2 text-base-content/65">
            <span>{{ metrics.summary.allTime.totalScans }} total scans</span>
            <span class="font-mono text-[11px]">{{ formatTokens(metrics.summary.allTime.totalTokens) }} tkn</span>
          </div>
        </div>
      </div>

      <!-- 2. Environment Split: Production vs Non-Production -->
      <div class="bg-base-200/40 rounded-2xl p-4 sm:p-5 border border-base-300/60 space-y-3">
        <div class="flex items-center justify-between">
          <h4 class="font-bold text-sm text-base-content flex items-center gap-2">
            <Icon icon="solar:server-square-bold-duotone" class="w-4 h-4 text-primary" />
            Environment Split: Production vs. Development
          </h4>
          <span class="text-xs text-base-content/60">
            {{ getProdPercentage() }}% Live Prod
          </span>
        </div>

        <!-- Visual Progress Bar -->
        <div class="w-full bg-base-300 h-2.5 rounded-full overflow-hidden flex">
          <div 
            class="bg-success h-full transition-all duration-500" 
            :style="{ width: `${getProdPercentage()}%` }"
            title="Production Usage"
          ></div>
          <div 
            class="bg-warning h-full transition-all duration-500" 
            :style="{ width: `${100 - getProdPercentage()}%` }"
            title="Development Usage"
          ></div>
        </div>

        <!-- Metric Pills -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div class="flex items-center justify-between p-3 rounded-xl bg-base-100 border border-base-200">
            <div class="flex items-center gap-2.5">
              <span class="w-2.5 h-2.5 rounded-full bg-success"></span>
              <div>
                <div class="text-xs font-bold text-base-content">Production (Live Items)</div>
                <div class="text-[11px] text-base-content/60">Collection: <code class="text-[10px]">items</code></div>
              </div>
            </div>
            <div class="text-right">
              <div class="text-sm font-black text-base-content">
                {{ metrics.summary.allTime.prodScans }} scans
              </div>
              <div class="text-xs text-success font-semibold">
                ${{ metrics.summary.allTime.prodCost.toFixed(4) }}
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between p-3 rounded-xl bg-base-100 border border-base-200">
            <div class="flex items-center gap-2.5">
              <span class="w-2.5 h-2.5 rounded-full bg-warning"></span>
              <div>
                <div class="text-xs font-bold text-base-content">Non-Production (Dev/Test)</div>
                <div class="text-[11px] text-base-content/60">Collection: <code class="text-[10px]">items_dev</code></div>
              </div>
            </div>
            <div class="text-right">
              <div class="text-sm font-black text-base-content">
                {{ metrics.summary.allTime.devScans }} scans
              </div>
              <div class="text-xs text-warning font-semibold">
                ${{ metrics.summary.allTime.devCost.toFixed(4) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Navigation Tabs: Monthly Timeline vs User Attribution -->
      <div class="space-y-3">
        <div class="flex items-center justify-between border-b border-base-300 pb-2">
          <div class="flex gap-2">
            <button 
              @click="activeTab = 'timeline'" 
              class="btn btn-xs rounded-lg font-bold gap-1.5"
              :class="activeTab === 'timeline' ? 'btn-primary' : 'btn-ghost'"
            >
              <Icon icon="solar:calendar-bold-duotone" class="w-3.5 h-3.5" />
              Monthly Timeline
            </button>
            <button 
              @click="activeTab = 'users'" 
              class="btn btn-xs rounded-lg font-bold gap-1.5"
              :class="activeTab === 'users' ? 'btn-primary' : 'btn-ghost'"
            >
              <Icon icon="solar:users-group-two-rounded-bold-duotone" class="w-3.5 h-3.5" />
              Usage by User / Team ({{ metrics.byUser.length }})
            </button>
          </div>
          <span class="text-[11px] text-base-content/50 font-mono hidden sm:inline">
            Pricing: $0.075 / 1M prompt
          </span>
        </div>

        <!-- Tab 1: Monthly Timeline Table -->
        <div v-if="activeTab === 'timeline'" class="overflow-x-auto">
          <table class="table table-xs w-full">
            <thead>
              <tr class="text-base-content/70">
                <th>Billing Month</th>
                <th class="text-center">Total Scans</th>
                <th class="text-center">Prod Scans</th>
                <th class="text-center">Dev Scans</th>
                <th class="text-right">Est. Tokens</th>
                <th class="text-right">Est. Cost</th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="row in metrics.monthlyHistory" 
                :key="row.key" 
                class="hover:bg-base-200/50 transition-colors"
              >
                <td class="font-bold">
                  {{ row.label }}
                  <span v-if="row.key === metrics.summary.thisMonth.key" class="badge badge-xs badge-success ml-1.5">Current</span>
                </td>
                <td class="text-center font-semibold">{{ row.totalScans }}</td>
                <td class="text-center text-success font-medium">{{ row.prodScans }}</td>
                <td class="text-center text-warning font-medium">{{ row.devScans }}</td>
                <td class="text-right font-mono text-[11px] opacity-70">{{ formatTokens(row.totalTokens) }}</td>
                <td class="text-right font-bold text-base-content">${{ row.estCost.toFixed(4) }}</td>
              </tr>
              <tr v-if="metrics.monthlyHistory.length === 0">
                <td colspan="6" class="text-center py-4 text-xs opacity-60">
                  No historical AI scan items found in Appwrite yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Tab 2: User Attribution Table -->
        <div v-if="activeTab === 'users'" class="overflow-x-auto">
          <table class="table table-xs w-full">
            <thead>
              <tr class="text-base-content/70">
                <th>User / Tenant Identifier</th>
                <th class="text-center">Total Scans</th>
                <th class="text-center">Prod</th>
                <th class="text-center">Dev</th>
                <th class="text-right">Estimated Spend</th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="user in metrics.byUser" 
                :key="user.userId" 
                class="hover:bg-base-200/50 transition-colors"
              >
                <td class="font-mono text-xs font-semibold">
                  {{ user.userId }}
                </td>
                <td class="text-center font-bold">{{ user.totalScans }}</td>
                <td class="text-center text-success">{{ user.prodScans }}</td>
                <td class="text-center text-warning">{{ user.devScans }}</td>
                <td class="text-right font-black text-primary">${{ user.estCost.toFixed(4) }}</td>
              </tr>
              <tr v-if="metrics.byUser.length === 0">
                <td colspan="5" class="text-center py-4 text-xs opacity-60">
                  No user activity recorded yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Icon } from '@iconify/vue';

const loading = ref(true);
const error = ref<string | null>(null);
const metrics = ref<any>(null);
const activeTab = ref<'timeline' | 'users'>('timeline');

const formatTokens = (tokens: number): string => {
  if (!tokens || tokens === 0) return '0';
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return tokens.toString();
};

const getProdPercentage = (): number => {
  if (!metrics.value || metrics.value.summary.allTime.totalScans === 0) return 50;
  const prod = metrics.value.summary.allTime.prodScans;
  const total = metrics.value.summary.allTime.totalScans;
  return Math.round((prod / total) * 100);
};

const fetchMetrics = async () => {
  loading.value = true;
  error.value = null;
  try {
    const res = await fetch('/api/admin/ai-metrics');
    if (!res.ok) {
      throw new Error(`Failed to load AI usage: HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch metrics');
    }
    metrics.value = data;
  } catch (err: any) {
    error.value = err.message || 'Could not load AI metrics';
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchMetrics();
});
</script>

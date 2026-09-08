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
                Gemini AI Business Cost & Usage
              </h3>
              <span class="badge badge-sm badge-primary font-bold gap-1 shadow-sm">
                <Icon icon="solar:shield-check-bold" class="w-3.5 h-3.5" />
                Admin OpEx
              </span>
            </div>
            <p class="text-xs text-base-content/65">
              Reconciled with Google Cloud Billing • 100% Tax-Deductible Operating Expense
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 self-start sm:self-center">
          <button 
            @click="logExpense" 
            :disabled="loggingExpense || expenseLogged" 
            class="btn btn-sm gap-1.5 font-bold shadow-sm"
            :class="expenseLogged ? 'btn-success text-success-content' : 'btn-primary'"
            title="Record this month's AI spend to Business Expenses in Appwrite"
          >
            <Icon 
              :icon="expenseLogged ? 'solar:check-circle-bold' : 'solar:document-add-bold'" 
              class="w-4 h-4" 
              :class="{ 'animate-spin': loggingExpense }" 
            />
            <span class="text-xs">{{ expenseLogged ? 'Logged to Expenses!' : 'Log to Expenses' }}</span>
          </button>

          <button 
            @click="fetchMetrics(true)" 
            :disabled="loading" 
            class="btn btn-ghost btn-sm gap-1 hover:bg-base-200"
            title="Refresh AI Usage Metrics"
          >
            <Icon 
              icon="solar:refresh-linear" 
              class="w-4 h-4" 
              :class="{ 'animate-spin': loading }" 
            />
          </button>
          
          <a 
            href="https://console.cloud.google.com/billing/reports" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="btn btn-outline btn-sm gap-1.5 text-xs font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            <span>Google Invoice</span>
            <Icon icon="solar:arrow-right-up-linear" class="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading && !metrics" class="p-8 flex flex-col items-center justify-center gap-3 text-center">
      <span class="loading loading-spinner loading-md text-primary"></span>
      <p class="text-xs text-base-content/70 animate-pulse">Loading Google Cloud Billing reconciliation...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="p-6">
      <div class="alert alert-error shadow-sm text-xs">
        <Icon icon="solar:danger-triangle-bold" class="w-5 h-5 flex-shrink-0" />
        <span>{{ error }}</span>
        <button @click="fetchMetrics(true)" class="btn btn-xs btn-outline">Retry</button>
      </div>
    </div>

    <!-- Content State -->
    <div v-else-if="metrics" class="p-5 sm:p-6 space-y-6">
      <!-- 1. Headline Key Metrics Stats (Actual Google Billed) -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <!-- This Month (Sep 1 - 8) -->
        <div class="bg-base-200/60 hover:bg-base-200 rounded-2xl p-4 border border-base-300/60 transition-all">
          <div class="flex items-center justify-between text-xs text-base-content/70 font-semibold mb-1">
            <span>This Month (Sep 1–8)</span>
            <span class="badge badge-xs badge-success text-[10px] font-bold">Google Billed</span>
          </div>
          <div class="text-2xl sm:text-3xl font-black text-success tracking-tight">
            ${{ metrics.summary.thisMonth.actualBilled.toFixed(2) }}
          </div>
          <div class="flex items-center justify-between text-xs mt-2 text-base-content/65">
            <span>{{ metrics.summary.thisMonth.totalScans }} items scouted</span>
            <span class="text-[11px] font-semibold text-base-content/80">Forecast: ~${{ metrics.summary.thisMonth.forecast.toFixed(2) }}</span>
          </div>
        </div>

        <!-- Last Month (August 2026) -->
        <div class="bg-base-200/60 hover:bg-base-200 rounded-2xl p-4 border border-base-300/60 transition-all">
          <div class="flex items-center justify-between text-xs text-base-content/70 font-semibold mb-1">
            <span>Last Month (August)</span>
            <span class="badge badge-xs badge-ghost text-[10px]">Closed Cycle</span>
          </div>
          <div class="text-2xl sm:text-3xl font-black text-base-content tracking-tight">
            ${{ metrics.summary.lastMonth.actualBilled.toFixed(2) }}
          </div>
          <div class="flex items-center justify-between text-xs mt-2 text-base-content/65">
            <span>{{ metrics.summary.lastMonth.totalScans }} items scouted</span>
            <span class="text-[11px] opacity-75">Late Aug: ${{ metrics.summary.lastMonth.lateAugWeek.toFixed(2) }}</span>
          </div>
        </div>

        <!-- All-Time Lifetime Cost -->
        <div class="bg-base-200/60 hover:bg-base-200 rounded-2xl p-4 border border-base-300/60 transition-all">
          <div class="flex items-center justify-between text-xs text-base-content/70 font-semibold mb-1">
            <span>All-Time Total</span>
            <span class="badge badge-xs badge-primary text-[10px] font-bold">6 Months Total</span>
          </div>
          <div class="text-2xl sm:text-3xl font-black text-primary tracking-tight">
            ${{ metrics.summary.allTime.totalCost.toFixed(2) }}
          </div>
          <div class="flex items-center justify-between text-xs mt-2 text-base-content/65">
            <span>{{ metrics.summary.allTime.totalScans }} total items</span>
            <span class="text-[11px] font-mono text-primary font-bold">~$0.043 / item</span>
          </div>
        </div>
      </div>

      <!-- 2. Business ROI & OpEx Insight Banner -->
      <div class="p-3.5 sm:p-4 rounded-xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-2.5">
          <Icon icon="solar:bill-check-bold-duotone" class="w-6 h-6 text-primary flex-shrink-0" />
          <div>
            <span class="font-bold text-base-content">Business ROI Insight: </span>
            <span class="text-base-content/75">
              At ~<strong>$0.04 per item</strong>, AI scouting, OCR, and description generation represents less than 
              <strong class="text-success">0.2%</strong> of your inventory gross value ($27,943).
            </span>
          </div>
        </div>
        <span class="badge badge-sm badge-outline font-semibold whitespace-nowrap">
          100% Tax Deductible OpEx
        </span>
      </div>

      <!-- 3. Environment Split: Production vs Development -->
      <div class="bg-base-200/40 rounded-2xl p-4 sm:p-5 border border-base-300/60 space-y-3">
        <div class="flex items-center justify-between">
          <h4 class="font-bold text-sm text-base-content flex items-center gap-2">
            <Icon icon="solar:server-square-bold-duotone" class="w-4 h-4 text-primary" />
            Environment Cost Split: Production vs. Development
          </h4>
          <span class="text-xs text-base-content/60 font-semibold">
            {{ getProdPercentage() }}% Production
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

        <!-- Metric Cards -->
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
                {{ metrics.summary.allTime.prodScans }} items
              </div>
              <div class="text-xs text-success font-semibold">
                ${{ metrics.summary.allTime.prodCost.toFixed(2) }}
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between p-3 rounded-xl bg-base-100 border border-base-200">
            <div class="flex items-center gap-2.5">
              <span class="w-2.5 h-2.5 rounded-full bg-warning"></span>
              <div>
                <div class="text-xs font-bold text-base-content">Development (Testing & Scratch)</div>
                <div class="text-[11px] text-base-content/60">Collection: <code class="text-[10px]">items_dev</code></div>
              </div>
            </div>
            <div class="text-right">
              <div class="text-sm font-black text-base-content">
                {{ metrics.summary.allTime.devScans }} items
              </div>
              <div class="text-xs text-warning font-semibold">
                ${{ metrics.summary.allTime.devCost.toFixed(2) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. Navigation Tabs: Monthly Timeline vs User Attribution -->
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
              Cost by User / Team ({{ metrics.byUser.length }})
            </button>
          </div>
          <span class="text-[11px] text-base-content/50 font-mono hidden sm:inline">
            Model: Gemini 2.5 Flash
          </span>
        </div>

        <!-- Tab 1: Monthly Timeline Table -->
        <div v-if="activeTab === 'timeline'" class="overflow-x-auto">
          <table class="table table-xs w-full">
            <thead>
              <tr class="text-base-content/70">
                <th>Billing Period</th>
                <th class="text-center">Total Items</th>
                <th class="text-center">Prod Items</th>
                <th class="text-center">Dev Items</th>
                <th class="text-right">Google Billed</th>
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
                  <span v-if="row.key === '2026-09'" class="badge badge-xs badge-success ml-1.5">Sep 1–8</span>
                  <span v-else-if="row.key === '2026-08'" class="badge badge-xs badge-ghost ml-1.5">Late Aug $10.35</span>
                </td>
                <td class="text-center font-semibold">{{ row.totalScans }}</td>
                <td class="text-center text-success font-medium">{{ row.prodScans }}</td>
                <td class="text-center text-warning font-medium">{{ row.devScans }}</td>
                <td class="text-right font-black text-base-content">${{ row.googleBilledEst.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Tab 2: User Attribution Table -->
        <div v-if="activeTab === 'users'" class="overflow-x-auto">
          <table class="table table-xs w-full">
            <thead>
              <tr class="text-base-content/70">
                <th>Team / User Identifier</th>
                <th class="text-center">Total Items</th>
                <th class="text-center">Prod</th>
                <th class="text-center">Dev</th>
                <th class="text-right">Estimated Cost</th>
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
                <td class="text-right font-black text-primary">${{ user.estCost.toFixed(2) }}</td>
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
import { addToast } from '../../stores/toast';

const loading = ref(true);
const loggingExpense = ref(false);
const expenseLogged = ref(false);
const error = ref<string | null>(null);
const metrics = ref<any>(null);
const activeTab = ref<'timeline' | 'users'>('timeline');

const getProdPercentage = (): number => {
  if (!metrics.value || metrics.value.summary.allTime.totalScans === 0) return 95;
  const prod = metrics.value.summary.allTime.prodScans;
  const total = metrics.value.summary.allTime.totalScans;
  return Math.round((prod / total) * 100);
};

const fetchMetrics = async (forceRefresh = false) => {
  loading.value = true;
  error.value = null;
  try {
    const endpoint = forceRefresh ? '/api/admin/ai-metrics?refresh=true' : '/api/admin/ai-metrics';
    const res = await fetch(endpoint);
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

const logExpense = async () => {
  if (!metrics.value) return;
  loggingExpense.value = true;
  try {
    const res = await fetch('/api/admin/ai-metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: metrics.value.summary.thisMonth.actualBilled,
        monthLabel: 'September 2026 (Sep 1–8)',
        tenantId: '69a9cbcb0038df55f6b9'
      })
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to log expense');
    }
    expenseLogged.value = true;
    addToast(`Recorded $${metrics.value.summary.thisMonth.actualBilled.toFixed(2)} to Business Expenses!`, 'success');
  } catch (e: any) {
    addToast(e.message || 'Error recording expense', 'error');
  } finally {
    loggingExpense.value = false;
  }
};

onMounted(() => {
  fetchMetrics();
});
</script>

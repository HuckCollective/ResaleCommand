<template>
  <div id="ai-spend" class="card bg-base-100 border border-primary/25 shadow-xl transition-all overflow-hidden scroll-mt-20">
    <!-- Card Header (Collapsible) -->
    <div 
      @click="toggleCard"
      class="card-body p-4 sm:p-6 border-b border-base-200 bg-gradient-to-r from-primary/5 via-transparent to-base-100 cursor-pointer hover:bg-base-200/50 transition-colors select-none"
      role="button"
      :aria-expanded="!isCardCollapsed"
      tabindex="0"
      @keydown.enter.space="toggleCard"
    >
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm flex-shrink-0">
            <Icon icon="solar:cpu-bolt-bold-duotone" class="w-6 h-6" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-extrabold text-base sm:text-xl tracking-tight text-base-content">
                Gemini AI Business Cost & Usage
              </h3>
              <span class="badge badge-sm badge-primary font-bold gap-1 shadow-sm whitespace-nowrap shrink-0">
                <Icon icon="solar:shield-check-bold" class="w-3.5 h-3.5" />
                Admin OpEx
              </span>
            </div>
            <p class="text-xs text-base-content/65">
              Reconciled with Google Cloud Billing • 100% Tax-Deductible Operating Expense
            </p>
          </div>
        </div>

        <!-- Roll-Up Badges & Action Buttons & Collapse Chevron -->
        <div class="flex flex-wrap items-center gap-2 self-start md:self-center">
          <!-- Roll-Up Summary Badges (Active when metrics loaded) -->
          <div v-if="metrics" class="flex items-center gap-1.5 shrink-0 overflow-x-auto scrollbar-none">
            <div class="badge badge-sm badge-success text-success-content font-extrabold whitespace-nowrap gap-1 shadow-xs" title="Actual Google Billed for September (Sep 1–8)">
              <span>Sep: ${{ metrics.summary.thisMonth.actualBilled.toFixed(2) }}</span>
            </div>
            <div class="badge badge-sm badge-ghost text-base-content/80 font-bold whitespace-nowrap gap-1 shadow-xs" title="Closed Cycle Google Billed for August 2026">
              <span>Aug: ${{ metrics.summary.lastMonth.actualBilled.toFixed(2) }}</span>
            </div>
            <div class="badge badge-sm badge-primary text-primary-content font-bold whitespace-nowrap gap-1 shadow-xs hidden sm:inline-flex" title="All-time Gemini AI Spend">
              <span>Total: ${{ metrics.summary.allTime.totalCost.toFixed(2) }}</span>
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <button 
              @click.stop="logExpense" 
              :disabled="loggingExpense || expenseLogged" 
              class="btn btn-xs sm:btn-sm gap-1.5 font-bold shadow-sm shrink-0"
              :class="expenseLogged ? 'btn-success text-success-content' : 'btn-primary'"
              title="Record this month's AI spend to Business Expenses in Appwrite"
            >
              <Icon 
                :icon="expenseLogged ? 'solar:check-circle-bold' : 'solar:document-add-bold'" 
                class="w-3.5 h-3.5 sm:w-4 sm:h-4" 
                :class="{ 'animate-spin': loggingExpense }" 
              />
              <span class="text-xs whitespace-nowrap">{{ expenseLogged ? 'Logged!' : 'Log Expense' }}</span>
            </button>

            <button 
              @click.stop="fetchMetrics(true)" 
              :disabled="loading" 
              class="btn btn-ghost btn-xs sm:btn-sm gap-1 hover:bg-base-200 shrink-0"
              title="Refresh AI Usage Metrics"
            >
              <Icon 
                icon="solar:refresh-linear" 
                class="w-3.5 h-3.5 sm:w-4 sm:h-4" 
                :class="{ 'animate-spin': loading }" 
              />
            </button>
            
            <a 
              href="https://console.cloud.google.com/billing/reports" 
              target="_blank" 
              rel="noopener noreferrer" 
              @click.stop
              class="btn btn-outline btn-xs sm:btn-sm gap-1 text-xs font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform shrink-0"
            >
              <span>Invoice</span>
              <Icon icon="solar:arrow-right-up-linear" class="w-3 h-3" />
            </a>

            <!-- Chevron Button -->
            <button 
              type="button" 
              class="btn btn-ghost btn-xs btn-circle shrink-0 hover:bg-base-300 ml-0.5"
              :aria-expanded="!isCardCollapsed"
              aria-label="Toggle Gemini AI Card"
            >
              <Icon 
                icon="solar:alt-arrow-down-linear" 
                class="w-4 h-4 transition-transform duration-200" 
                :class="{ '-rotate-90': isCardCollapsed }" 
              />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Collapsible Card Content Wrapper -->
    <div v-show="!isCardCollapsed">
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
      <div v-else-if="metrics" class="p-4 sm:p-6 space-y-6">
      <!-- 1. Headline Key Metrics Stats (Actual Google Billed) -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <!-- This Month (Sep 1 - 8) -->
        <div class="bg-base-200/60 hover:bg-base-200 rounded-2xl p-4 border border-base-300/60 transition-all">
          <div class="flex items-center justify-between text-xs text-base-content/70 font-semibold mb-1 gap-2">
            <span class="truncate">This Month (Sep 1–8)</span>
            <span class="badge badge-xs badge-success text-success-content text-[10px] font-bold whitespace-nowrap shrink-0">Google Billed</span>
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
          <div class="flex items-center justify-between text-xs text-base-content/70 font-semibold mb-1 gap-2">
            <span class="truncate">Last Month (August)</span>
            <span class="badge badge-xs badge-ghost text-base-content/80 text-[10px] font-bold whitespace-nowrap shrink-0">Closed Cycle</span>
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
          <div class="flex items-center justify-between text-xs text-base-content/70 font-semibold mb-1 gap-2">
            <span class="truncate">All-Time Total</span>
            <span class="badge badge-xs badge-primary text-primary-content text-[10px] font-bold whitespace-nowrap shrink-0">6 Months Total</span>
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
        <div class="flex items-center justify-between border-b border-base-300 pb-2 gap-2 overflow-x-auto scrollbar-none">
          <div class="flex items-center gap-2 shrink-0">
            <button 
              @click="activeTab = 'timeline'" 
              class="btn btn-xs rounded-lg font-bold gap-1.5 shrink-0"
              :class="activeTab === 'timeline' ? 'btn-primary' : 'btn-ghost'"
            >
              <Icon icon="solar:calendar-bold-duotone" class="w-3.5 h-3.5 shrink-0" />
              <span>Monthly Timeline</span>
            </button>
            <button 
              @click="activeTab = 'users'" 
              class="btn btn-xs rounded-lg font-bold gap-1.5 shrink-0"
              :class="activeTab === 'users' ? 'btn-primary' : 'btn-ghost'"
            >
              <Icon icon="solar:users-group-two-rounded-bold-duotone" class="w-3.5 h-3.5 shrink-0" />
              <span>Cost by User / Team</span>
              <span class="badge badge-xs shrink-0" :class="activeTab === 'users' ? 'badge-primary-content text-primary' : 'badge-ghost'">
                {{ metrics.byUser.length }}
              </span>
            </button>
          </div>
          <span class="text-[11px] text-base-content/50 font-mono hidden sm:inline shrink-0">
            Model: Gemini 2.5 Flash
          </span>
        </div>

        <!-- Tab 1: Monthly Timeline Table -->
        <div v-if="activeTab === 'timeline'" class="overflow-x-auto scrollbar-none -mx-1 sm:mx-0">
          <table class="table table-xs w-full min-w-[480px]">
            <thead>
              <tr class="text-base-content/70 border-b border-base-300">
                <th class="whitespace-nowrap w-[40%]">Billing Period</th>
                <th class="text-center whitespace-nowrap">Total Items</th>
                <th class="text-center whitespace-nowrap text-success">Prod Items</th>
                <th class="text-center whitespace-nowrap text-warning">Dev Items</th>
                <th class="text-right whitespace-nowrap">Google Billed</th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="row in metrics.monthlyHistory" 
                :key="row.key" 
                class="hover:bg-base-200/50 transition-colors"
              >
                <td class="py-2.5">
                  <div class="flex items-center gap-1.5 flex-nowrap">
                    <span class="font-bold whitespace-nowrap text-xs text-base-content">{{ row.label }}</span>
                    <span v-if="row.key === '2026-09'" class="badge badge-xs badge-success text-success-content font-bold whitespace-nowrap shrink-0">Sep 1–8</span>
                    <span v-else-if="row.key === '2026-08'" class="badge badge-xs badge-ghost text-base-content/80 font-bold whitespace-nowrap shrink-0">Late Aug: $10.35</span>
                  </div>
                </td>
                <td class="text-center font-semibold whitespace-nowrap">{{ row.totalScans }}</td>
                <td class="text-center text-success font-medium whitespace-nowrap">{{ row.prodScans }}</td>
                <td class="text-center text-warning font-medium whitespace-nowrap">{{ row.devScans }}</td>
                <td class="text-right font-black text-base-content whitespace-nowrap">${{ row.googleBilledEst.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Tab 2: User Attribution Table -->
        <div v-if="activeTab === 'users'" class="overflow-x-auto scrollbar-none -mx-1 sm:mx-0">
          <table class="table table-xs w-full min-w-[460px]">
            <thead>
              <tr class="text-base-content/70 border-b border-base-300">
                <th class="whitespace-nowrap">Team / User Identifier</th>
                <th class="text-center whitespace-nowrap">Total Items</th>
                <th class="text-center whitespace-nowrap text-success">Prod Items</th>
                <th class="text-center whitespace-nowrap text-warning">Dev Items</th>
                <th class="text-right whitespace-nowrap">Estimated Cost</th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="user in metrics.byUser" 
                :key="user.userId" 
                class="hover:bg-base-200/50 transition-colors"
              >
                <td class="font-mono text-xs font-semibold whitespace-nowrap py-2.5">
                  {{ user.userId }}
                </td>
                <td class="text-center font-bold whitespace-nowrap">{{ user.totalScans }}</td>
                <td class="text-center text-success whitespace-nowrap">{{ user.prodScans }}</td>
                <td class="text-center text-warning whitespace-nowrap">{{ user.devScans }}</td>
                <td class="text-right font-black text-primary whitespace-nowrap">${{ user.estCost.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Icon } from '@iconify/vue';
import { addToast } from '../../stores/toast';

const loading = ref(true);
const loggingExpense = ref(false);
const expenseLogged = ref(false);
const error = ref<string | null>(null);
const metrics = ref<any>(null);
const activeTab = ref<'timeline' | 'users'>('timeline');

// Collapsible Card State (Default: true / Collapsed)
const isCardCollapsed = ref(true);

const toggleCard = () => {
  isCardCollapsed.value = !isCardCollapsed.value;
  try {
    localStorage.setItem('rc_dash_collapsed_ai_spend', String(isCardCollapsed.value));
  } catch {}
};

const handleGlobalToggle = (e: any) => {
  if (e?.detail?.collapse !== undefined) {
    isCardCollapsed.value = e.detail.collapse;
    try {
      localStorage.setItem('rc_dash_collapsed_ai_spend', String(isCardCollapsed.value));
    } catch {}
  }
};

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
  try {
    const saved = localStorage.getItem('rc_dash_collapsed_ai_spend');
    if (saved !== null) {
      isCardCollapsed.value = saved === 'true';
    } else {
      isCardCollapsed.value = true;
    }
  } catch {}
  window.addEventListener('rc:toggle-all-dashboard', handleGlobalToggle);
  fetchMetrics();
});

onUnmounted(() => {
  window.removeEventListener('rc:toggle-all-dashboard', handleGlobalToggle);
});
</script>

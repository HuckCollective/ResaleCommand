<template>
  <div
    v-if="isAdmin"
    id="ai-spend"
    class="card bg-base-100 border border-primary/25 shadow-xl transition-all overflow-hidden scroll-mt-20"
  >
    <!-- Compact Collapsible Header -->
    <div
      @click="toggle"
      class="card-body p-3.5 sm:p-5 bg-gradient-to-r from-primary/5 via-transparent to-base-100 cursor-pointer hover:bg-base-200/50 transition-colors select-none"
      :class="{ 'border-b border-base-200': !isCollapsed }"
      role="button"
      :aria-expanded="!isCollapsed"
      tabindex="0"
      @keydown.enter.space="toggle"
    >
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-4">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm shrink-0">
            <Icon icon="solar:cpu-bolt-bold-duotone" class="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="font-extrabold text-sm sm:text-lg tracking-tight text-base-content break-words">
                Gemini AI Business Cost &amp; Usage
              </h3>
              <span class="badge badge-xs sm:badge-sm badge-primary font-bold gap-1 shadow-sm whitespace-nowrap shrink-0">
                <Icon icon="solar:shield-check-bold" class="w-3.5 h-3.5" />
                Admin OpEx
              </span>
            </div>
            <p class="text-[11px] sm:text-xs text-base-content/65 break-words">
              Google Cloud Billing reconciliation · 100% tax-deductible operating expense
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-1.5 self-start md:self-center">
          <div v-if="metrics" class="flex flex-wrap items-center gap-1.5">
            <span class="badge badge-xs sm:badge-sm badge-success text-success-content font-extrabold whitespace-nowrap shadow-xs">
              Active: ${{ metrics.summary.thisMonth.actualBilled.toFixed(2) }}
            </span>
            <span class="badge badge-xs sm:badge-sm badge-ghost text-base-content/80 font-bold whitespace-nowrap shadow-xs">
              Prior: ${{ metrics.summary.lastMonth.actualBilled.toFixed(2) }}
            </span>
          </div>

          <button
            v-if="metrics"
            type="button"
            @click.stop="showDetailsDrawer = true"
            class="btn btn-xs btn-outline rounded-xl font-bold gap-1 shrink-0"
          >
            <span>Breakdown</span>
            <Icon icon="solar:arrow-right-linear" class="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            class="btn btn-ghost btn-xs btn-circle shrink-0 hover:bg-base-300"
            :aria-expanded="!isCollapsed"
            aria-label="Toggle Gemini AI Card"
          >
            <Icon
              icon="solar:alt-arrow-down-linear"
              class="w-4 h-4 transition-transform duration-200"
              :class="{ '-rotate-90': isCollapsed }"
            />
          </button>
        </div>
      </div>
    </div>

    <!-- Compact On-Page Body (3-Stat Summary Strip Only) -->
    <div v-show="!isCollapsed" class="p-3.5 sm:p-5 space-y-3">
      <div v-if="loading && !metrics" class="py-6 flex items-center justify-center gap-2 text-xs text-base-content/70">
        <span class="loading loading-spinner loading-sm text-primary"></span>
        <span>Loading Google Cloud Billing reconciliation...</span>
      </div>

      <div v-else-if="error" class="alert alert-error shadow-sm text-xs">
        <Icon icon="solar:danger-triangle-bold" class="w-5 h-5 shrink-0" />
        <span class="break-words">{{ error }}</span>
        <button type="button" @click="fetchMetrics(true)" class="btn btn-xs btn-outline">Retry</button>
      </div>

      <template v-else-if="metrics">
        <KpiStatGrid :columns="3" :items="summaryStats" />

        <div class="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
          <span class="text-base-content/70 break-words">
            AI scouting &amp; OCR represents <strong>{{ opexPctLabel }}</strong> of active stock valuation (${{ globalProjectedRevenue.toFixed(0) }}).
          </span>
          <div class="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              @click="logExpense"
              :disabled="loggingExpense || expenseLogged || !activeTenantId"
              class="btn btn-xs gap-1 font-bold rounded-lg"
              :class="expenseLogged ? 'btn-success text-success-content' : 'btn-primary text-primary-content'"
            >
              <Icon
                :icon="expenseLogged ? 'solar:check-circle-bold' : 'solar:document-add-bold'"
                class="w-3.5 h-3.5"
                :class="{ 'animate-spin': loggingExpense }"
              />
              <span>{{ expenseLogged ? 'Logged!' : 'Log Expense' }}</span>
            </button>
            <button type="button" @click="fetchMetrics(true)" :disabled="loading" class="btn btn-xs btn-ghost rounded-lg" title="Refresh">
              <Icon icon="solar:refresh-linear" class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
            </button>
            <button type="button" @click="showDetailsDrawer = true" class="btn btn-xs btn-outline rounded-lg font-bold">
              Timeline &amp; Prod/Dev Split →
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- Lazy Right-Side Slide-Over Inspector for Prod/Dev Split & Monthly/Team Tables -->
    <SlideOverDrawer
      v-model="showDetailsDrawer"
      title="Gemini AI Cost & Attribution"
      :subtitle="metrics ? `Model: ${metrics.model || 'gemini-flash-latest'}` : ''"
      size="lg"
    >
      <div v-if="showDetailsDrawer && metrics" class="space-y-5 text-xs">
        <!-- Environment Split: Production vs Development -->
        <div class="bg-base-200/40 rounded-2xl p-4 border border-base-300/60 space-y-3">
          <div class="flex items-center justify-between gap-2">
            <h4 class="font-bold text-sm text-base-content flex items-center gap-2 break-words">
              <Icon icon="solar:server-square-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
              <span>Environment Split: Production vs. Development</span>
            </h4>
            <span class="font-semibold text-base-content/70 whitespace-nowrap">{{ prodPct }}% Prod</span>
          </div>

          <div class="w-full bg-base-300 h-2.5 rounded-full overflow-hidden flex">
            <div class="bg-success h-full" :style="{ width: `${prodPct}%` }"></div>
            <div class="bg-warning h-full" :style="{ width: `${100 - prodPct}%` }"></div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div class="flex items-center justify-between p-3 rounded-xl bg-base-100 border border-base-200">
              <div>
                <div class="font-bold text-base-content">Production (`items`)</div>
                <div class="text-[11px] text-base-content/60">{{ metrics.summary.allTime.prodScans }} items</div>
              </div>
              <div class="font-mono font-black text-success">${{ metrics.summary.allTime.prodCost.toFixed(2) }}</div>
            </div>
            <div class="flex items-center justify-between p-3 rounded-xl bg-base-100 border border-base-200">
              <div>
                <div class="font-bold text-base-content">Development (`items_dev`)</div>
                <div class="text-[11px] text-base-content/60">{{ metrics.summary.allTime.devScans }} items</div>
              </div>
              <div class="font-mono font-black text-warning">${{ metrics.summary.allTime.devCost.toFixed(2) }}</div>
            </div>
          </div>
        </div>

        <!-- Tabs: Monthly Timeline vs User Attribution -->
        <div class="space-y-3">
          <div class="flex items-center gap-2 border-b border-base-300 pb-2">
            <button
              type="button"
              @click="activeTab = 'timeline'"
              class="btn btn-xs rounded-lg font-bold"
              :class="activeTab === 'timeline' ? 'btn-primary' : 'btn-ghost'"
            >
              Monthly Timeline
            </button>
            <button
              type="button"
              @click="activeTab = 'users'"
              class="btn btn-xs rounded-lg font-bold"
              :class="activeTab === 'users' ? 'btn-primary' : 'btn-ghost'"
            >
              By User / Team ({{ metrics.byUser.length }})
            </button>
          </div>

          <div v-if="activeTab === 'timeline'" class="overflow-x-auto">
            <table class="table table-xs w-full">
              <thead>
                <tr class="text-base-content/70 border-b border-base-300">
                  <th>Billing Period</th>
                  <th class="text-center">Total</th>
                  <th class="text-center text-success">Prod</th>
                  <th class="text-center text-warning">Dev</th>
                  <th class="text-right">Billed</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in metrics.monthlyHistory" :key="row.key" class="hover:bg-base-200/50">
                  <td class="font-bold">{{ row.label }}</td>
                  <td class="text-center font-semibold">{{ row.totalScans }}</td>
                  <td class="text-center text-success">{{ row.prodScans }}</td>
                  <td class="text-center text-warning">{{ row.devScans }}</td>
                  <td class="text-right font-mono font-black">${{ row.googleBilledEst.toFixed(2) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else class="overflow-x-auto">
            <table class="table table-xs w-full">
              <thead>
                <tr class="text-base-content/70 border-b border-base-300">
                  <th>Team / User</th>
                  <th class="text-center">Total</th>
                  <th class="text-center text-success">Prod</th>
                  <th class="text-center text-warning">Dev</th>
                  <th class="text-right">Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in metrics.byUser" :key="u.userId" class="hover:bg-base-200/50">
                  <td class="font-mono font-semibold break-all">{{ u.userId }}</td>
                  <td class="text-center font-bold">{{ u.totalScans }}</td>
                  <td class="text-center text-success">{{ u.prodScans }}</td>
                  <td class="text-center text-warning">{{ u.devScans }}</td>
                  <td class="text-right font-mono font-black text-primary">${{ u.estCost.toFixed(2) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <a
            href="https://console.cloud.google.com/billing/reports"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-sm btn-outline rounded-xl font-bold gap-1"
          >
            <span>Google Cloud Invoice</span>
            <Icon icon="solar:arrow-right-up-linear" class="w-3.5 h-3.5" />
          </a>
          <button type="button" class="btn btn-sm btn-primary text-primary-content rounded-xl font-bold px-5" @click="showDetailsDrawer = false">
            Close
          </button>
        </div>
      </template>
    </SlideOverDrawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { addToast } from '../../stores/toast';
import { useAuth } from '../../composables/useAuth';
import KpiStatGrid, { type KpiStatItem } from '../common/KpiStatGrid.vue';
import SlideOverDrawer from '../common/SlideOverDrawer.vue';
import { useDashboardSource } from '../../composables/dashboard/useDashboardSource';
import { useDashboardMetrics } from '../../composables/dashboard/useDashboardMetrics';
import { useCollapsibleSection } from '../../composables/dashboard/useCollapsibleSection';

const source = useDashboardSource();
const { currentTeam } = useAuth();
const { globalProjectedRevenue } = useDashboardMetrics();

const isAdmin = computed(() => source.isAdmin.value && source.mode === 'live');
const activeTenantId = computed(() => currentTeam.value?.$id || '');

const { isCollapsed, toggle } = useCollapsibleSection('ai_spend', true, source.mode === 'live');

const loading = ref(false);
const loggingExpense = ref(false);
const expenseLogged = ref(false);
const error = ref<string | null>(null);
const metrics = ref<any>(null);
const showDetailsDrawer = ref(false);
const activeTab = ref<'timeline' | 'users'>('timeline');

const prodPct = computed(() => {
  if (!metrics.value || !metrics.value.summary?.allTime?.totalScans) return 95;
  return Math.round((metrics.value.summary.allTime.prodScans / metrics.value.summary.allTime.totalScans) * 100);
});

const opexPctLabel = computed(() => {
  const totalCost = metrics.value?.summary?.allTime?.totalCost || 0;
  const stockVal = globalProjectedRevenue.value || 0;
  if (stockVal <= 0) return '<0.5%';
  return `${((totalCost / stockVal) * 100).toFixed(2)}%`;
});

const summaryStats = computed<KpiStatItem[]>(() => {
  if (!metrics.value) return [];
  const tm = metrics.value.summary.thisMonth;
  const lm = metrics.value.summary.lastMonth;
  const at = metrics.value.summary.allTime;
  return [
    {
      label: tm.period || 'Active Cycle',
      value: `$${tm.actualBilled.toFixed(2)}`,
      hint: `${tm.totalScans} items · Forecast ~$${tm.forecast.toFixed(2)}`,
      badge: 'Google Billed',
      badgeClass: 'badge-success text-success-content',
      tone: 'text-success',
    },
    {
      label: lm.period || lm.label || 'Prior Cycle',
      value: `$${lm.actualBilled.toFixed(2)}`,
      hint: `${lm.totalScans} items scouted`,
      badge: 'Closed Cycle',
      badgeClass: 'badge-ghost',
      tone: 'text-base-content',
    },
    {
      label: 'All-Time Total',
      value: `$${at.totalCost.toFixed(2)}`,
      hint: `${at.totalScans} total items (~$${(at.totalCost / Math.max(1, at.totalScans)).toFixed(3)}/item)`,
      badge: 'Cumulative',
      badgeClass: 'badge-primary text-primary-content',
      tone: 'text-primary',
    },
  ];
});

const fetchMetrics = async (forceRefresh = false) => {
  if (!isAdmin.value) return;
  loading.value = true;
  error.value = null;
  try {
    const endpoint = forceRefresh ? '/api/admin/ai-metrics?refresh=true' : '/api/admin/ai-metrics';
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`Failed to load AI usage: HTTP ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch metrics');
    metrics.value = data;
  } catch (err: any) {
    error.value = err.message || 'Could not load AI metrics';
  } finally {
    loading.value = false;
  }
};

const logExpense = async () => {
  if (!metrics.value || !activeTenantId.value) return;
  loggingExpense.value = true;
  try {
    const tm = metrics.value.summary.thisMonth;
    const res = await fetch('/api/admin/ai-metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: tm.actualBilled,
        monthLabel: tm.period || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        tenantId: activeTenantId.value,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to log expense');
    expenseLogged.value = true;
    addToast(`Recorded $${tm.actualBilled.toFixed(2)} to Business Expenses!`, 'success');
  } catch (e: any) {
    addToast(e.message || 'Error recording expense', 'error');
  } finally {
    loggingExpense.value = false;
  }
};

watch(isAdmin, (allowed) => {
  if (allowed && !metrics.value && !loading.value) {
    fetchMetrics();
  }
});

onMounted(() => {
  if (isAdmin.value) {
    fetchMetrics();
  }
});
</script>

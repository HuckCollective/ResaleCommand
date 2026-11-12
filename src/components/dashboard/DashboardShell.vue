<template>
  <div class="space-y-4 sm:space-y-6" @click.capture="onDemoClick">
    <!-- PUBLIC DEMO BANNER -->
    <div v-if="mode === 'demo'" class="card bg-secondary/10 border border-secondary/40 rounded-2xl p-4 space-y-3">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="text-sm font-black">🧪 Example Works Hub — nothing here is real</div>
          <p class="text-xs text-base-content/75 leading-relaxed">
            This is what members see after signing in. Everything below is invented sample data. Pick a role to see how the dashboard adapts for each kind of member.
          </p>
        </div>
        <div class="flex flex-wrap gap-2 shrink-0">
          <a href="/coop" data-demo-allow class="btn btn-sm btn-primary text-primary-content rounded-xl font-bold">Connect With Us</a>
          <a href="/login" data-demo-allow class="btn btn-sm btn-outline rounded-xl font-bold">Member Login</a>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Preview as role">
        <span class="text-[11px] font-extrabold uppercase tracking-wider opacity-60 mr-1">Preview as</span>
        <button
          v-for="hat in demoRoles"
          :key="hat"
          type="button"
          class="btn btn-xs h-7 min-h-0 rounded-lg gap-1 font-bold"
          :class="demoRole === hat ? 'btn-secondary text-secondary-content' : 'btn-ghost border border-base-300'"
          @click="demoRole = hat"
        >
          <span>{{ META[hat].icon }}</span>
          <span>{{ hat === 'founder' ? 'Founder (Steward)' : META[hat].label }}</span>
        </button>
      </div>
    </div>

    <!-- UNIFIED COMMAND HEADER + ROLE LENS SWITCHER (WITH CROSS-HAT ALERT BADGES) -->
    <header class="rounded-2xl bg-base-100 border border-base-300/85 shadow-2xs p-3.5 sm:p-4 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-xl sm:text-2xl font-extrabold tracking-tight text-base-content leading-tight">
              {{ mode === 'demo' ? 'Example Works Hub' : 'The Works' }}
            </h1>
            <span class="badge badge-xs badge-outline font-semibold whitespace-nowrap shrink-0">
              {{ memberName }}
            </span>
          </div>
          <p class="text-[11px] sm:text-xs text-base-content/65">
            {{ activeLensSubtitle }}
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            v-if="pendingJoinCount > 0 && mode === 'live' && canSeeCollective"
            type="button"
            class="btn btn-xs sm:btn-sm btn-info text-info-content rounded-xl font-black gap-1 shadow-xs"
            @click="openJoinQueueTray"
          >
            <span>📬 {{ pendingJoinCount }} Join Request{{ pendingJoinCount === 1 ? '' : 's' }}</span>
          </button>

          <button
            v-if="canSeeCollective"
            type="button"
            class="btn btn-xs sm:btn-sm btn-ghost border border-success/40 text-success rounded-xl font-bold gap-1 hover:bg-success/10 transition-all shrink-0"
            title="Open IRS Schedule C Tax Playbook"
            @click="openTaxPlaybook"
          >
            <Icon icon="solar:book-bookmark-bold-duotone" class="w-3.5 h-3.5 shrink-0" />
            <span class="text-xs hidden sm:inline">Tax Playbook</span>
          </button>

          <button
            type="button"
            class="btn btn-xs sm:btn-sm btn-ghost border border-base-300/80 rounded-xl font-bold gap-1 hover:bg-base-200 transition-all shrink-0"
            :title="allCollapsed ? 'Expand All Dashboard Areas' : 'Collapse All Dashboard Areas'"
            @click="toggleAllSections"
          >
            <Icon :icon="allCollapsed ? 'solar:maximize-square-minimalistic-bold' : 'solar:minimize-square-minimalistic-bold'" class="w-3.5 h-3.5 text-primary" />
            <span class="text-xs hidden sm:inline">{{ allCollapsed ? 'Expand All' : 'Collapse All' }}</span>
          </button>
        </div>
      </div>

      <!-- 1-Line Role Hat Lens Bar with Cross-Hat Alert Badges + Opt-In ✨ All Hats -->
      <div class="pt-2.5 border-t border-base-200 flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-1.5 overflow-x-auto max-w-full scrollbar-none py-0.5" role="group" aria-label="Active collective hat lens">
          <span class="text-[10px] font-extrabold uppercase tracking-wider text-primary shrink-0 mr-0.5">Lens:</span>
          <button
            v-for="hat in availableHats"
            :key="hat"
            type="button"
            class="btn btn-xs h-7 min-h-0 rounded-xl gap-1 font-bold shrink-0"
            :class="activeLens === hat ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost border border-base-300'"
            @click="selectLens(hat)"
          >
            <span>{{ META[hat].icon }}</span>
            <span>{{ META[hat].label }}</span>
            <span
              v-if="tray.hatAlertCounts.value[hat] > 0 && activeLens !== hat"
              class="badge badge-2xs badge-warning text-warning-content font-mono font-black whitespace-nowrap"
            >
              {{ tray.hatAlertCounts.value[hat] }}
            </span>
          </button>

          <button
            v-if="availableHats.length > 1"
            type="button"
            class="btn btn-xs h-7 min-h-0 rounded-xl gap-1 font-bold shrink-0"
            :class="activeLens === 'all' ? 'btn-secondary text-secondary-content shadow-xs' : 'btn-ghost border border-base-300'"
            @click="selectLens('all')"
          >
            <span>✨</span>
            <span>All Hats</span>
            <span
              v-if="tray.unionActiveCount.value > 0 && activeLens !== 'all'"
              class="badge badge-2xs badge-ghost font-mono font-bold whitespace-nowrap"
            >
              {{ tray.unionActiveCount.value }}
            </span>
          </button>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            class="btn btn-xs rounded-xl btn-ghost border border-base-300 font-bold gap-1"
            @click="tray.openTray('tools')"
          >
            <Icon icon="solar:compass-bold-duotone" class="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Shortcuts &amp; Tools</span>
          </button>
        </div>
      </div>
    </header>

    <!-- STRICT PER-LENS PRIORITY WIDGET STACK -->
    <div v-if="loading" class="flex justify-center py-16">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>
    <template v-else>
      <component :is="WIDGET_COMPONENTS[id]" v-for="id in widgetIds" :key="`${activeLens}-${id}`" />

      <!-- CO-OP JOIN & INVITE QUEUE (Inline on Founder / All Hats lens; tray/drawer always reachable from Header/Dock) -->
      <JoinRequestsPanel
        v-if="mode === 'live' && canSeeCollective"
        :inline-visible="activeLens === 'founder' || activeLens === 'all'"
      />
    </template>

    <!-- RIGHT-SIDE IRS SCHEDULE C PLAYBOOK DRAWER -->
    <TaxPlaybookDrawer v-if="canSeeCollective" :playbook-html="taxPlaybookHtml" />

    <!-- CONTEXTUAL BOTTOM ACTION DOCK + UNIFIED DETENT TRAY STACK -->
    <DashboardCommandDock />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch, type Component } from 'vue';
import { Icon } from '@iconify/vue';
import { addToast } from '../../stores/toast';
import { canSeeCollectiveFinancials, MEMBER_HAT_META, type MemberHat } from '../../lib/memberHats';
import { DASHBOARD_WIDGETS, visibleWidgetIdsForLens } from '../../lib/dashboardWidgets';
import {
  provideDashboardSource,
  provideActiveHat,
  provideActiveLens,
  type ActiveLens,
  type DashboardSource,
} from '../../composables/dashboard/useDashboardSource';
import { useLiveDashboardSource } from '../../composables/dashboard/useLiveDashboardSource';
import { useDemoDashboardSource } from '../../composables/dashboard/useDemoDashboardSource';
import { createDashboardCommandTray } from '../../composables/dashboard/useDashboardCommandTray';
import { useLoader } from '../../composables/useLoader';
import RoleAlertsGrid from './RoleAlertsGrid.vue';
import FinancialsOverview from './FinancialsOverview.vue';
import OperationsRadarGrid from './OperationsRadarGrid.vue';
import MyInventorySnapshot from './MyInventorySnapshot.vue';
import MyStatementCard from './MyStatementCard.vue';
import LaborWeekCard from './LaborWeekCard.vue';
import AdminToolsCard from './AdminToolsCard.vue';
import AiUsageCard from './AiUsageCard.vue';
import TaxPlaybookDrawer from './TaxPlaybookDrawer.vue';
import DashboardCommandDock from './DashboardCommandDock.vue';
import JoinRequestsPanel from '../coop/JoinRequestsPanel.vue';

const ACTIVE_HAT_STORAGE_KEY = 'rc_active_hat_v1';

const props = defineProps<{
  mode: 'live' | 'demo';
  taxPlaybookHtml?: string;
}>();

const META = MEMBER_HAT_META;
const WIDGET_COMPONENTS: Record<string, Component> = {
  alerts: RoleAlertsGrid,
  financials: FinancialsOverview,
  radar: OperationsRadarGrid,
  my_inventory: MyInventorySnapshot,
  my_statement: MyStatementCard,
  labor_week: LaborWeekCard,
  admin_tools: AdminToolsCard,
  ai_usage: AiUsageCard,
};

const demoRoles: MemberHat[] = ['curator', 'promoter', 'enabler', 'consignor', 'founder'];
const demoRole = ref<MemberHat>('curator');

const source: DashboardSource = props.mode === 'demo' ? useDemoDashboardSource(demoRole) : useLiveDashboardSource();
provideDashboardSource(source);

const activeLens = ref<ActiveLens>(source.member.value.hats[0]);
const effectiveLeadHat = computed<MemberHat>(() => {
  const hats = source.member.value.hats;
  if (activeLens.value !== 'all' && hats.includes(activeLens.value)) {
    return activeLens.value;
  }
  return hats[0] || 'curator';
});

provideActiveLens(activeLens);
provideActiveHat(effectiveLeadHat);

const tray = createDashboardCommandTray(source, activeLens, effectiveLeadHat);

const memberName = computed(() => source.member.value.name);
const availableHats = computed(() => source.member.value.hats);
const canSeeCollective = computed(() => canSeeCollectiveFinancials(source.member.value.hats));
const pendingJoinCount = computed(() => source.snapshot.value.joinRequests || 0);
const loading = computed(() => source.loading.value);

const activeLensSubtitle = computed(() => {
  if (activeLens.value === 'all') {
    return 'Combined All-Hats view — priority triage first, personal & collective metrics below';
  }
  return `${META[effectiveLeadHat.value].icon} ${META[effectiveLeadHat.value].label} focus — ${META[effectiveLeadHat.value].pitch}`;
});

const persistLens = (lens: ActiveLens) => {
  if (props.mode !== 'live' || typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_HAT_STORAGE_KEY, lens);
  } catch {}
};

const selectLens = (lens: ActiveLens) => {
  activeLens.value = lens;
  persistLens(lens);
};

const resolveValidStoredLens = (hats: readonly MemberHat[]): ActiveLens => {
  if (props.mode === 'live' && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(ACTIVE_HAT_STORAGE_KEY) as ActiveLens | null;
      if (stored === 'all' && hats.length > 1) return 'all';
      if (stored && stored !== 'all' && hats.includes(stored)) return stored;
    } catch {}
  }
  return hats[0] || 'curator';
};

watch(
  () => source.member.value.hats.join(','),
  () => {
    activeLens.value = resolveValidStoredLens(source.member.value.hats);
  }
);

const widgetIds = computed(() =>
  visibleWidgetIdsForLens(
    source.member.value.hats,
    activeLens.value,
    effectiveLeadHat.value,
    source.isAdmin.value
  ).filter((id) => props.mode !== 'demo' || DASHBOARD_WIDGETS.find((w) => w.id === id)?.demo)
);

const allCollapsed = ref(false);
const toggleAllSections = () => {
  allCollapsed.value = !allCollapsed.value;
  window.dispatchEvent(new CustomEvent('rc:toggle-all-dashboard', { detail: { collapse: allCollapsed.value } }));
};

const openJoinQueueTray = () => {
  window.dispatchEvent(new CustomEvent('rc:open-join-queue-tray'));
};

const openTaxPlaybook = () => {
  window.dispatchEvent(new CustomEvent('rc:open-tax-playbook'));
};

let lastHint = 0;
const onDemoClick = (e: MouseEvent) => {
  if (props.mode !== 'demo') return;
  const anchor = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (!anchor || anchor.hasAttribute('data-demo-allow')) return;
  e.preventDefault();
  e.stopPropagation();
  if (Date.now() - lastHint > 2500) {
    lastHint = Date.now();
    addToast({ type: 'info', message: 'This is an example. Members get this live after signing in.' });
  }
};

if (props.mode === 'live') {
  const { showLoader } = useLoader();
  showLoader('Loading Dashboard...');
}

onMounted(() => {
  activeLens.value = resolveValidStoredLens(source.member.value.hats);
  source.init();
});
</script>

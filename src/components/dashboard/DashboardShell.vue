<template>
  <div class="space-y-4 sm:space-y-6" @click.capture="onDemoClick">
    <!-- PUBLIC DEMO BANNER -->
    <div v-if="mode === 'demo'" class="card bg-secondary/10 border border-secondary/40 rounded-2xl p-4 space-y-3">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="text-sm font-black">🧪 Example Works Hub — nothing here is real</div>
          <p class="text-xs text-base-content/75 leading-relaxed">
            This is what members see after signing in. Everything below is invented sample data. Pick a role to see how the dashboard changes for each kind of member.
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

    <!-- UNIFIED COMMAND HEADER + SLIM ROLE SCOPE BAR -->
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
            Priority triage first, live financials &amp; booth radar next, deep queues in your bottom dock
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            v-if="pendingJoinCount > 0 && mode === 'live'"
            type="button"
            class="btn btn-xs sm:btn-sm btn-info text-info-content rounded-xl font-black gap-1 shadow-xs"
            @click="openJoinQueueTray"
          >
            <span>📬 {{ pendingJoinCount }} Join Request{{ pendingJoinCount === 1 ? '' : 's' }}</span>
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

      <!-- 1-Line Active Role Hat Scope Switcher (Replaces Giant Top Link Directory) -->
      <div class="pt-2.5 border-t border-base-200 flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-1.5 overflow-x-auto max-w-full scrollbar-none py-0.5" role="group" aria-label="Active collective hat">
          <span class="text-[10px] font-extrabold uppercase tracking-wider text-primary shrink-0 mr-0.5">Hat:</span>
          <button
            v-for="hat in availableHats"
            :key="hat"
            type="button"
            class="btn btn-xs h-7 min-h-0 rounded-xl gap-1 font-bold shrink-0"
            :class="activeHat === hat ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost border border-base-300'"
            @click="activeHat = hat"
          >
            <span>{{ META[hat].icon }}</span>
            <span>{{ META[hat].label }}</span>
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

    <!-- ROLE-ORDERED PRIORITY WIDGETS (URGENT ALERTS + LIVE METRICS FIRST) -->
    <div v-if="loading" class="flex justify-center py-16">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>
    <template v-else>
      <component :is="WIDGET_COMPONENTS[id]" v-for="id in widgetIds" :key="`${activeHat}-${id}`" />

      <!-- SECONDARY CO-OP JOIN & INVITE QUEUE (Sits below core ops; accessible anytime via Tray Stack) -->
      <JoinRequestsPanel v-if="mode === 'live'" />
    </template>

    <!-- CONTEXTUAL BOTTOM ACTION DOCK + UNIFIED DETENT TRAY STACK -->
    <DashboardCommandDock />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch, type Component } from 'vue';
import { Icon } from '@iconify/vue';
import { addToast } from '../../stores/toast';
import { MEMBER_HAT_META, type MemberHat } from '../../lib/memberHats';
import { DASHBOARD_WIDGETS, visibleWidgetIds } from '../../lib/dashboardWidgets';
import {
  provideDashboardSource,
  provideActiveHat,
  type DashboardSource,
} from '../../composables/dashboard/useDashboardSource';
import { useLiveDashboardSource } from '../../composables/dashboard/useLiveDashboardSource';
import { useDemoDashboardSource } from '../../composables/dashboard/useDemoDashboardSource';
import { createDashboardCommandTray } from '../../composables/dashboard/useDashboardCommandTray';
import { useLoader } from '../../composables/useLoader';
import RoleHubCard from './RoleHubCard.vue';
import RoleAlertsGrid from './RoleAlertsGrid.vue';
import FinancialsOverview from './FinancialsOverview.vue';
import OperationsRadarGrid from './OperationsRadarGrid.vue';
import TaxTipsPanel from './TaxTipsPanel.vue';
import MyInventorySnapshot from './MyInventorySnapshot.vue';
import MyStatementCard from './MyStatementCard.vue';
import LaborWeekCard from './LaborWeekCard.vue';
import AdminToolsCard from './AdminToolsCard.vue';
import AiUsageCard from './AiUsageCard.vue';
import DashboardCommandDock from './DashboardCommandDock.vue';
import JoinRequestsPanel from '../coop/JoinRequestsPanel.vue';

const props = defineProps<{ mode: 'live' | 'demo' }>();

const META = MEMBER_HAT_META;
const WIDGET_COMPONENTS: Record<string, Component> = {
  role_hub: RoleHubCard,
  alerts: RoleAlertsGrid,
  financials: FinancialsOverview,
  radar: OperationsRadarGrid,
  tax_tips: TaxTipsPanel,
  my_inventory: MyInventorySnapshot,
  my_statement: MyStatementCard,
  labor_week: LaborWeekCard,
  admin_tools: AdminToolsCard,
  ai_usage: AiUsageCard,
};

// Demo: visitors pick a role. Live: the signed-in member's own hats.
const demoRoles: MemberHat[] = ['curator', 'promoter', 'enabler', 'consignor', 'founder'];
const demoRole = ref<MemberHat>('curator');

const source: DashboardSource = props.mode === 'demo' ? useDemoDashboardSource(demoRole) : useLiveDashboardSource();
provideDashboardSource(source);

const activeHat = ref<MemberHat>(source.member.value.hats[0]);
provideActiveHat(activeHat);

const tray = createDashboardCommandTray(source, activeHat);

const memberName = computed(() => source.member.value.name);
const availableHats = computed(() => source.member.value.hats);
const pendingJoinCount = computed(() => source.snapshot.value.joinRequests || 0);

// Reset the active hat whenever the member's hats change (role switch in demo, roster load in live)
watch(
  () => source.member.value.hats.join(','),
  () => {
    activeHat.value = source.member.value.hats[0];
  }
);

const loading = computed(() => source.loading.value);

const widgetIds = computed(() =>
  visibleWidgetIds(source.member.value.hats, activeHat.value, source.isAdmin.value).filter(
    (id) => props.mode !== 'demo' || DASHBOARD_WIDGETS.find((w) => w.id === id)?.demo
  )
);

const allCollapsed = ref(false);
const toggleAllSections = () => {
  allCollapsed.value = !allCollapsed.value;
  window.dispatchEvent(new CustomEvent('rc:toggle-all-dashboard', { detail: { collapse: allCollapsed.value } }));
};

const openJoinQueueTray = () => {
  window.dispatchEvent(new CustomEvent('rc:open-join-queue-tray'));
};

// Demo is read-only: links inside widgets go nowhere (they would just bounce to /login).
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
  source.init();
});
</script>

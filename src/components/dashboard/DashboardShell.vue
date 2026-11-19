<template>
  <div class="space-y-5 sm:space-y-6" @click.capture="onDemoClick">
    <!-- PUBLIC DEMO BANNER -->
    <div v-if="mode === 'demo'" class="card bg-secondary/10 border border-secondary/40 rounded-2xl p-4 space-y-3">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="text-sm font-black">🧪 Example Works Hub — nothing here is real</div>
          <p class="text-xs text-base-content/75 leading-relaxed">
            This is the calm Task-First Command Hub signed-in Collective members see every day (vs. the isolated legacy Consignor statement view).
          </p>
        </div>
        <div class="flex flex-wrap gap-2 shrink-0">
          <a href="/coop" data-demo-allow class="btn btn-sm h-11 min-h-11 md:h-8 md:min-h-0 btn-primary text-primary-content rounded-xl font-bold">Connect With Us</a>
          <a href="/login" data-demo-allow class="btn btn-sm h-11 min-h-11 md:h-8 md:min-h-0 btn-outline rounded-xl font-bold">Member Login</a>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Preview account type">
        <span class="text-[11px] font-extrabold uppercase tracking-wider opacity-60 mr-1">Preview as</span>
        <button
          v-for="roleOpt in demoRoles"
          :key="roleOpt.id"
          type="button"
          class="btn btn-xs h-11 min-h-11 md:h-7 md:min-h-0 rounded-lg gap-1 font-bold shrink-0 whitespace-nowrap"
          :class="demoRole === roleOpt.id ? 'btn-secondary text-secondary-content' : 'btn-ghost border border-base-300'"
          @click="demoRole = roleOpt.id"
        >
          <span>{{ roleOpt.label }}</span>
        </button>
      </div>
    </div>

    <!-- COMPACT COMMAND HEADER (ZERO HAT SILOS / ZERO DUPLICATE DOCK) -->
    <header class="rounded-2xl bg-base-100 border border-base-300/85 shadow-2xs p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-2">
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
          {{ isConsignorOnly
            ? 'Your personal consignment statement and floor items'
            : 'Pick what you are working on — every Curator can pitch in anywhere' }}
        </p>
      </div>

      <div v-if="mode === 'live' && canSeeCollective" class="flex flex-wrap items-center gap-1.5 shrink-0">
        <button
          v-if="pendingJoinCount > 0"
          type="button"
          class="btn btn-xs sm:btn-sm h-11 min-h-11 md:h-8 md:min-h-0 btn-warning text-warning-content rounded-xl font-black gap-1 shadow-xs"
          @click="openJoinQueueTray"
        >
          <span>📬 {{ pendingJoinCount }} Join Request{{ pendingJoinCount === 1 ? '' : 's' }}</span>
        </button>

        <button
          v-if="openMessagesCount > 0"
          type="button"
          class="btn btn-xs sm:btn-sm h-11 min-h-11 md:h-8 md:min-h-0 btn-info text-info-content rounded-xl font-black gap-1 shadow-xs"
          @click="openMessagesTray"
        >
          <span>💬 {{ openMessagesCount }} Message{{ openMessagesCount === 1 ? '' : 's' }}</span>
        </button>
      </div>
    </header>

    <!-- LOADING SKELETON -->
    <div v-if="loading" class="space-y-4" aria-busy="true" aria-label="Loading command hub">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div
          v-for="kpi in 4"
          :key="`sk-kpi-${kpi}`"
          class="rounded-2xl bg-base-100 border border-base-300 p-4 space-y-2"
        >
          <div class="skeleton h-3 w-24 rounded-md"></div>
          <div class="skeleton h-6 w-20 rounded-md"></div>
          <div class="skeleton h-3 w-28 rounded-md"></div>
        </div>
      </div>

      <div class="card bg-base-100 border border-base-300 rounded-3xl p-5 space-y-4">
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <div v-for="t in 4" :key="`sk-tab-${t}`" class="skeleton h-11 rounded-2xl"></div>
        </div>
        <div class="skeleton h-28 w-full rounded-2xl"></div>
      </div>
    </div>

    <!-- ISOLATED LEGACY CONSIGNOR VIEW (BB-) -->
    <template v-else-if="isConsignorOnly">
      <MyStatementCard />
      <MyInventorySnapshot />
    </template>

    <!-- SIMPLIFIED TASK-FIRST COLLECTIVE COMMAND HUB -->
    <template v-else>
      <TaskHubDashboard
        @open-join-queue="openJoinQueueTray"
        @open-messages="openMessagesTray"
      />

      <JoinRequestsPanel
        v-if="mode === 'live' && canSeeCollective"
        :inline-visible="pendingJoinCount > 0"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { addToast } from '../../stores/toast';
import { canSeeCollectiveFinancials, type MemberHat } from '../../lib/memberHats';
import {
  provideDashboardSource,
  provideActiveHat,
  provideActiveLens,
  provideRoleHelpHtml,
  type ActiveLens,
  type DashboardSource,
} from '../../composables/dashboard/useDashboardSource';
import { useLiveDashboardSource } from '../../composables/dashboard/useLiveDashboardSource';
import { useDemoDashboardSource } from '../../composables/dashboard/useDemoDashboardSource';
import TaskHubDashboard from './TaskHubDashboard.vue';
import MyInventorySnapshot from './MyInventorySnapshot.vue';
import MyStatementCard from './MyStatementCard.vue';
import JoinRequestsPanel from '../coop/JoinRequestsPanel.vue';

const props = defineProps<{
  mode: 'live' | 'demo';
  taxPlaybookHtml?: string;
  roleHelpHtmlMap?: Partial<Record<MemberHat, string>>;
}>();

const demoRoles: ReadonlyArray<{ id: MemberHat; label: string }> = [
  { id: 'curator', label: '💎 Collective Member (Curator)' },
  { id: 'consignor', label: '🏷️ Legacy Consignor (BB-)' },
];
const demoRole = ref<MemberHat>('curator');

const source: DashboardSource =
  props.mode === 'demo' ? useDemoDashboardSource(demoRole) : useLiveDashboardSource();
provideDashboardSource(source);

const effectiveLeadHat = computed<MemberHat>(() => source.member.value.hats[0] || 'curator');
const activeLens = ref<ActiveLens>(effectiveLeadHat.value);
provideActiveLens(activeLens);
provideActiveHat(effectiveLeadHat);
provideRoleHelpHtml(props.roleHelpHtmlMap);

const memberName = computed(() => source.member.value.name);
const canSeeCollective = computed(() => canSeeCollectiveFinancials(source.member.value.hats));
const isConsignorOnly = computed(() => {
  const hats = source.member.value.hats;
  return (
    hats.length === 1 && hats[0] === 'consignor' && !source.isAdmin.value
  );
});
const pendingJoinCount = computed(() => source.snapshot.value.joinRequests || 0);
const openMessagesCount = computed(() => source.snapshot.value.coopMessages || 0);
const loading = computed(() => source.loading.value);

const openJoinQueueTray = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('rc:open-join-queue-tray'));
};

const openMessagesTray = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('rc:open-coop-messages', { detail: { mode: 'list' } }));
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

onMounted(() => {
  source.init();
});
</script>

<template>
  <nav
    class="bg-base-100 border border-base-300 rounded-2xl p-2.5 sm:p-3 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5"
    aria-label="Co-op Workspace Sub-Navigation"
  >
    <!-- 5 Clean Co-op Pillars -->
    <div class="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5">
      <a
        v-for="tab in navTabs"
        :key="tab.id"
        :href="tab.href"
        class="btn btn-sm rounded-xl gap-1.5 font-bold transition-all justify-start sm:justify-center"
        :class="
          isActive(tab)
            ? 'btn-primary shadow-xs'
            : 'btn-ghost bg-base-200/50 hover:bg-base-200 text-base-content/80'
        "
      >
        <Icon :icon="tab.icon" class="w-4 h-4 shrink-0" />
        <span class="truncate text-xs">{{ tab.label }}</span>
      </a>
    </div>

    <!-- Live Democratic Policy Badges -->
    <div class="flex flex-wrap items-center justify-between lg:justify-end gap-1.5 px-1">
      <a
        href="/coop/governance?tab=rules"
        class="badge badge-sm badge-outline border-primary/40 text-primary font-mono font-bold gap-1 py-2.5 px-2.5 hover:bg-primary/10 transition-colors"
        title="Click to configure Gate 3 & Gate 4B Co-op Waterfall Rules"
      >
        <Icon icon="solar:Sliders-minimalistic-horizontal-bold" class="w-3.5 h-3.5" />
        <span>
          {{ policy.curatorSharePct }}/{{ policy.commonsSharePct }} Gate 3
        </span>
      </a>
      <a
        href="/coop/governance?tab=rules"
        class="badge badge-sm badge-ghost font-mono font-semibold gap-1 py-2.5 px-2.5 text-[11px] hover:bg-base-200 transition-colors"
        title="Gate 4B Excess Surplus WSDE Split: Reserve / Sales Patronage / Sweat-Equity Labor"
      >
        <span>
          Over Ops: {{ policy.reserveSharePct }}% Res • {{ policy.salesPatronagePct }}% Sales • {{ policy.laborPatronagePct }}% Labor
        </span>
      </a>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import {
  loadCoopGovernanceState,
  DEFAULT_COOP_POLICY_CONFIG,
  type CoopPolicyConfig,
} from '../../lib/coopGovernance';

const props = defineProps<{
  activeTab?: 'settlements' | 'governance' | 'labor' | 'expenses' | 'charter';
}>();

const currentPath = ref('');
const policy = ref<CoopPolicyConfig>({ ...DEFAULT_COOP_POLICY_CONFIG });

const navTabs = [
  {
    id: 'settlements',
    label: 'Monthly Settlements',
    href: '/coop/settlements',
    icon: 'solar:hand-money-bold-duotone',
  },
  {
    id: 'governance',
    label: 'Governance & Rules',
    href: '/coop/governance',
    icon: 'solar:users-group-two-rounded-bold-duotone',
  },
  {
    id: 'labor',
    label: 'Sweat-Equity Labor',
    href: '/coop/labor',
    icon: 'solar:clock-circle-bold-duotone',
  },
  {
    id: 'expenses',
    label: 'Commons Expenses',
    href: '/expenses',
    icon: 'solar:bill-list-bold-duotone',
  },
  {
    id: 'charter',
    label: 'Living Charter',
    href: '/coop',
    icon: 'solar:shield-star-bold-duotone',
  },
] as const;

const isActive = (tab: (typeof navTabs)[number]): boolean => {
  if (props.activeTab) {
    return props.activeTab === tab.id;
  }
  if (!currentPath.value) return false;
  if (tab.href === '/coop') {
    return currentPath.value === '/coop' || currentPath.value === '/coop/';
  }
  return currentPath.value.startsWith(tab.href);
};

onMounted(async () => {
  if (typeof window !== 'undefined') {
    currentPath.value = window.location.pathname;
  }
  const { state } = await loadCoopGovernanceState([]);
  if (state.policyConfig) {
    policy.value = state.policyConfig;
  }
});
</script>


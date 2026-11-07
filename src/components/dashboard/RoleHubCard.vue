<template>
  <div class="card bg-base-100 border border-primary/25 shadow-sm rounded-2xl p-4 sm:p-5 space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
      <div class="min-w-0">
        <div class="text-[11px] font-extrabold uppercase tracking-wider text-primary">My Role in the Collective</div>
        <div class="text-sm sm:text-base font-black truncate">
          {{ memberName }}
          <span v-if="!member" class="text-xs font-semibold opacity-60">(showing all hats)</span>
        </div>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="hat in availableHats"
          :key="hat"
          type="button"
          class="btn btn-xs h-7 min-h-0 rounded-lg gap-1 font-bold"
          :class="activeHat === hat ? 'btn-primary' : 'btn-ghost border border-base-300'"
          @click="activeHat = hat"
        >
          <span>{{ META[hat].icon }}</span>
          <span>{{ META[hat].label }}</span>
        </button>
      </div>
    </div>

    <p class="text-xs text-base-content/70">{{ META[activeHat].pitch }}</p>

    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
      <a
        v-for="action in actions"
        :key="action.href + action.label"
        :href="action.href"
        class="p-3 rounded-xl bg-base-200/50 border border-base-300 hover:border-primary/50 hover:bg-base-200 transition-all flex items-center gap-2.5"
      >
        <Icon :icon="action.icon" class="w-5 h-5 text-primary shrink-0" />
        <div class="min-w-0">
          <div class="text-xs font-black truncate">{{ action.label }}</div>
          <div class="text-[10px] opacity-60 truncate">{{ action.hint }}</div>
        </div>
      </a>
      <button
        v-if="canLogHours"
        type="button"
        class="p-3 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/15 transition-all flex items-center gap-2.5 text-left"
        :disabled="logging"
        @click="logHours"
      >
        <Icon icon="solar:clock-circle-bold-duotone" class="w-5 h-5 text-primary shrink-0" />
        <div class="min-w-0">
          <div class="text-xs font-black truncate">+ Log {{ META[activeHat].label }} Hours (1.5h)</div>
          <div class="text-[10px] opacity-60 truncate">Counts toward the Labor &amp; Surplus Pool</div>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { useAuth } from '../../composables/useAuth';
import { addToast } from '../../stores/toast';
import {
  loadCoopGovernanceState,
  logSweatEquityLaborEntry,
  normalizePolicyConfig,
  DEFAULT_COOP_POLICY_CONFIG,
  MEMBER_HAT_META,
  type CoopMemberProfile,
  type MemberHat,
} from '../../lib/coopGovernance';

const META = MEMBER_HAT_META;
const { user, currentTeam } = useAuth();

const members = ref<CoopMemberProfile[]>(normalizePolicyConfig(DEFAULT_COOP_POLICY_CONFIG).members);
const activeHat = ref<MemberHat>('founder');
const logging = ref(false);

const member = computed(() => {
  const name = user.value?.name?.toLowerCase();
  if (!name) return undefined;
  return members.value.find((m) => m.name.toLowerCase().includes(name));
});

const memberName = computed(() => member.value?.name || user.value?.name || 'Member');

const availableHats = computed<MemberHat[]>(() =>
  member.value?.hats?.length ? member.value.hats : (Object.keys(META) as MemberHat[])
);

const prefix = computed(() => member.value?.inventoryPrefix || '');

const canLogHours = computed(() => activeHat.value === 'promoter' || activeHat.value === 'enabler');

const actions = computed(() => {
  switch (activeHat.value) {
    case 'founder':
      return [
        { label: 'Collective Settlements', hint: 'Monthly payouts & breakeven', icon: 'solar:hand-money-bold-duotone', href: '/coop/settlements' },
        { label: 'Governance & Votes', hint: 'Proposals and sliders', icon: 'solar:users-group-two-rounded-bold-duotone', href: '/coop/governance' },
        { label: 'Org & Co-op Settings', hint: 'Personas, prefixes, contracts', icon: 'solar:settings-bold-duotone', href: '/settings' },
        { label: 'Expenses & Receipts', hint: 'Commons vs personal', icon: 'solar:bill-list-bold-duotone', href: '/expenses' },
        { label: 'Idea & Prompt Vault', hint: 'Phone notes & Gemini prompts', icon: 'solar:notebook-bold-duotone', href: '/coop/vault' },
      ];
    case 'curator':
      return [
        { label: 'Quick Scout', hint: prefix.value ? `Sourcing for ${prefix.value}` : 'Source new inventory', icon: 'solar:scanner-bold', href: '/scout?quick=true' },
        { label: 'My Inventory', hint: 'Items, costs and status', icon: 'solar:box-bold-duotone', href: '/inventory' },
        { label: 'My Payout Statement', hint: 'Cost back + profit share', icon: 'solar:hand-money-bold-duotone', href: '/coop/settlements' },
        { label: 'Sales Ledger', hint: 'Register tickets', icon: 'solar:dollar-minimalistic-bold-duotone', href: '/sales' },
      ];
    case 'promoter':
      return [
        { label: 'Social Dropcast Studio', hint: 'Booth drops & reels', icon: 'solar:broadcast-bold-duotone', href: '/social' },
        { label: 'Labor Ledger', hint: 'My logged work', icon: 'solar:clock-circle-bold-duotone', href: '/coop/labor' },
        { label: 'Collective Home', hint: 'Charter and pillars', icon: 'solar:shield-star-bold-duotone', href: '/coop' },
      ];
    case 'enabler':
      return [
        { label: 'Memory Den Sync', hint: 'Booth barcode sync', icon: 'solar:refresh-circle-bold-duotone', href: '/warehouse/sync/MD' },
        { label: 'Thermal Label Studio', hint: 'Print booth tags', icon: 'solar:printer-bold-duotone', href: '/labels/studio' },
        { label: 'Inventory', hint: 'Restock & staging queues', icon: 'solar:box-bold-duotone', href: '/inventory' },
        { label: 'Labor Ledger', hint: 'My logged work', icon: 'solar:clock-circle-bold-duotone', href: '/coop/labor' },
      ];
    default:
      return [
        { label: 'My Statement & What-If', hint: prefix.value ? `${prefix.value} payouts` : 'Consignor payouts', icon: 'solar:document-text-bold-duotone', href: '/coop/settlements' },
        { label: 'Sales Ledger', hint: 'Sold items', icon: 'solar:dollar-minimalistic-bold-duotone', href: '/sales' },
      ];
  }
});

const logHours = async () => {
  logging.value = true;
  try {
    const hat = activeHat.value;
    const { syncedToCloud } = await logSweatEquityLaborEntry(
      {
        member: member.value?.name,
        partner: 'SWEAT',
        category: hat === 'enabler' ? 'Booth Restock' : 'Social & Marketing',
        hours: 1.5,
        notes: `${META[hat].label} contribution logged from My Role dashboard`,
      },
      currentTeam.value?.$id || 'huck_collective'
    );
    addToast({ type: syncedToCloud ? 'success' : 'warning', message: syncedToCloud ? 'Logged 1.5h to the Labor Pool' : 'Logged locally; cloud sync failed' });
  } finally {
    logging.value = false;
  }
};

onMounted(async () => {
  try {
    const { state } = await loadCoopGovernanceState([], currentTeam.value?.$id || 'huck_collective');
    members.value = normalizePolicyConfig(state.policyConfig).members;
  } catch (e) {
    console.warn('[RoleHubCard] Could not load roster:', e);
  }
  activeHat.value = availableHats.value[0];
});
</script>


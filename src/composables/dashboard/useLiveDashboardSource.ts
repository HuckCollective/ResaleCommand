import { computed, ref } from 'vue';
import { useInventory } from '../useInventory';
import { usePurchases } from '../usePurchases';
import { useLoader } from '../useLoader';
import { useAuth } from '../useAuth';
import {
  loadCoopGovernanceState,
  logSweatEquityLaborEntry,
  normalizePolicyConfig,
  type CoopMemberProfile,
  type CoopProposal,
  type CoopLaborEntry,
} from '../../lib/coopGovernance';
import { MEMBER_HAT_META, type MemberHat } from '../../lib/memberHats';
import { emptySnapshot, type DashboardMember } from '../../lib/dashboardTypes';
import type { DashboardSource } from './useDashboardSource';

/** Real dashboard data (signed-in members). The ONLY dashboard file that talks to Appwrite. */
export function useLiveDashboardSource(): DashboardSource {
  const { inventoryItems, loading: inventoryLoading, fetchInventory } = useInventory();
  const { purchases, fetchPurchases } = usePurchases();
  const { hideLoader } = useLoader();
  const { user, currentTeam, isAdmin } = useAuth();

  const roster = ref<CoopMemberProfile[]>([]);
  const proposals = ref<CoopProposal[]>([]);
  const laborEntries = ref<CoopLaborEntry[]>([]);
  const initialLoading = ref(true);

  const profile = computed(() => {
    const name = user.value?.name?.toLowerCase();
    if (!name) return undefined;
    return roster.value.find((m) => m.name.toLowerCase().includes(name));
  });

  const member = computed<DashboardMember>(() => ({
    name: profile.value?.name || user.value?.name || 'Member',
    // No roster match (e.g. the owner): show every hat, as before
    hats: profile.value?.hats?.length ? profile.value.hats : (Object.keys(MEMBER_HAT_META) as MemberHat[]),
    inventoryPrefix: profile.value?.inventoryPrefix,
  }));

  const snapshot = computed(() => ({
    ...emptySnapshot(),
    items: inventoryItems.value || [],
    purchases: purchases.value || [],
    proposals: proposals.value,
    laborEntries: laborEntries.value,
  }));

  const loading = computed(() => initialLoading.value || inventoryLoading.value);

  const init = async () => {
    try {
      const tasks: Promise<unknown>[] = [];
      if (inventoryItems.value.length === 0) {
        // @ts-ignore existing signature takes a search string
        tasks.push(fetchInventory(''));
      }
      if (purchases.value.length === 0) tasks.push(fetchPurchases());
      tasks.push(
        loadCoopGovernanceState([], currentTeam.value?.$id || 'huck_collective').then(({ state }) => {
          roster.value = normalizePolicyConfig(state.policyConfig).members;
          proposals.value = state.proposals || [];
          laborEntries.value = state.laborEntries || [];
        })
      );
      await Promise.allSettled(tasks);
    } catch (e) {
      console.error('[Dashboard] Error loading dashboard data:', e);
    } finally {
      initialLoading.value = false;
      hideLoader();
    }
  };

  const logHours = async (hat: MemberHat) => {
    const { syncedToCloud } = await logSweatEquityLaborEntry(
      {
        member: profile.value?.name,
        partner: 'SWEAT',
        category: hat === 'enabler' ? 'Booth Restock' : 'Social & Marketing',
        hours: 1.5,
        notes: `${MEMBER_HAT_META[hat].label} contribution logged from My Role dashboard`,
      },
      currentTeam.value?.$id || 'huck_collective'
    );
    return { syncedToCloud };
  };

  return {
    mode: 'live',
    snapshot,
    member,
    hasMemberProfile: computed(() => !!profile.value),
    loading,
    isAdmin,
    init,
    logHours,
  };
}

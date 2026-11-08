import { computed, ref, type Ref } from 'vue';
import type { MemberHat } from '../../lib/memberHats';
import { buildDemoSnapshot, DEMO_MEMBERS } from '../../lib/demoDashboardData';
import type { DashboardSource } from './useDashboardSource';

/**
 * Public /demo data source. Fictional sample data only.
 * MUST NOT import Appwrite, auth, inventory or governance modules — the demo never touches the database.
 */
export function useDemoDashboardSource(role: Ref<MemberHat>): DashboardSource {
  const snapshot = computed(() => buildDemoSnapshot());
  const member = computed(() => DEMO_MEMBERS[role.value]);

  return {
    mode: 'demo',
    snapshot,
    member,
    hasMemberProfile: computed(() => true),
    loading: ref(false),
    isAdmin: computed(() => role.value === 'founder'),
    init: async () => {},
    // logHours intentionally undefined: widgets show a "members get this live" hint instead
  };
}

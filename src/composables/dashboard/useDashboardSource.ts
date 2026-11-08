import { inject, provide, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import type { MemberHat } from '../../lib/memberHats';
import type { DashboardMember, DashboardSnapshot } from '../../lib/dashboardTypes';

/**
 * One interface, two implementations:
 *  - live  (useLiveDashboardSource)  → real Appwrite data, signed-in members only
 *  - demo  (useDemoDashboardSource)  → fictional sample data, public /demo, NEVER touches the database
 * Every dashboard widget reads ONLY from this, so the demo can never drift from the real dashboard.
 */
export interface DashboardSource {
  mode: 'live' | 'demo';
  snapshot: ComputedRef<DashboardSnapshot>;
  member: ComputedRef<DashboardMember>;
  /** false when the signed-in user has no roster profile yet (we then show every hat) */
  hasMemberProfile: ComputedRef<boolean>;
  loading: Readonly<Ref<boolean>>;
  isAdmin: Readonly<Ref<boolean>>;
  init: () => Promise<void>;
  /** Live only. Demo leaves this undefined and widgets show a hint instead. */
  logHours?: (hat: MemberHat) => Promise<{ syncedToCloud: boolean }>;
}

const DASHBOARD_SOURCE_KEY: InjectionKey<DashboardSource> = Symbol('dashboardSource');

export function provideDashboardSource(source: DashboardSource): void {
  provide(DASHBOARD_SOURCE_KEY, source);
}

export function useDashboardSource(): DashboardSource {
  const source = inject(DASHBOARD_SOURCE_KEY);
  if (!source) {
    throw new Error('useDashboardSource() called outside a <DashboardShell> (no source provided).');
  }
  return source;
}

/** The hat the member is currently "wearing" on the dashboard (drives alerts + layout order). */
const ACTIVE_HAT_KEY: InjectionKey<Ref<MemberHat>> = Symbol('dashboardActiveHat');

export function provideActiveHat(hat: Ref<MemberHat>): void {
  provide(ACTIVE_HAT_KEY, hat);
}

export function useActiveHat(): Ref<MemberHat> {
  const hat = inject(ACTIVE_HAT_KEY);
  if (!hat) throw new Error('useActiveHat() called outside a <DashboardShell>.');
  return hat;
}

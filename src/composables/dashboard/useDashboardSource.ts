import { inject, provide, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import type { MemberHat } from '../../lib/memberHats';
import type { DashboardMember, DashboardSnapshot } from '../../lib/dashboardTypes';

/**
 *ActiveLens allows a multi-hat member to focus strictly on ONE hat's widgets/alerts at a time,
 * or opt into `'all'` (deduplicated union across all of their real hats).
 */
export type ActiveLens = MemberHat | 'all';

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

/**
 * Safe single MemberHat (`effectiveLeadHat`):
 * When `activeLens === 'all'`, resolves cleanly to `member.hats[0]` so child lookups into
 * `MEMBER_HAT_META[activeHat]` or `getRolePrimaryCpa(activeHat)` NEVER crash on `'all'`.
 */
const ACTIVE_HAT_KEY: InjectionKey<Ref<MemberHat> | ComputedRef<MemberHat>> = Symbol('dashboardActiveHat');

export function provideActiveHat(hat: Ref<MemberHat> | ComputedRef<MemberHat>): void {
  provide(ACTIVE_HAT_KEY, hat);
}

export function useActiveHat(): Ref<MemberHat> | ComputedRef<MemberHat> {
  const hat = inject(ACTIVE_HAT_KEY);
  if (!hat) throw new Error('useActiveHat() called outside a <DashboardShell>.');
  return hat;
}

/** Active UI lens (`MemberHat | 'all'`). */
const ACTIVE_LENS_KEY: InjectionKey<Ref<ActiveLens>> = Symbol('dashboardActiveLens');

export function provideActiveLens(lens: Ref<ActiveLens>): void {
  provide(ACTIVE_LENS_KEY, lens);
}

export function useActiveLens(): Ref<ActiveLens> {
  const lens = inject(ACTIVE_LENS_KEY);
  if (!lens) throw new Error('useActiveLens() called outside a <DashboardShell>.');
  return lens;
}

/** Server-rendered Markdown Role Playbook HTML map (`src/content/roles/*.md`). */
const ROLE_HELP_HTML_KEY: InjectionKey<Partial<Record<MemberHat, string>>> = Symbol('dashboardRoleHelpHtml');

export function provideRoleHelpHtml(map?: Partial<Record<MemberHat, string>>): void {
  provide(ROLE_HELP_HTML_KEY, map || {});
}

export function useRoleHelpHtml(): Partial<Record<MemberHat, string>> {
  return inject(ROLE_HELP_HTML_KEY, {});
}

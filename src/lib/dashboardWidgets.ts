import { canSeeCollectiveFinancials, type MemberHat } from './memberHats';
import type { ActiveLens } from '../composables/dashboard/useDashboardSource';

/**
 * Who may see a widget (see financial_visibility_plan.md):
 *  - everyone        : always safe (the member's own shortcuts / own data)
 *  - voting_members  : collective aggregates. Founder, Curator, Promoter, Enabler share ONE
 *                      information class — you cannot vote on numbers you cannot see.
 *  - own_only        : shows only the member's own items/payouts/hours
 *  - admin           : operational detail (billing, settings shortcuts)
 */
export type WidgetAudience = 'everyone' | 'voting_members' | 'own_only' | 'admin';

export interface DashboardWidgetDef {
  id: string;
  title: string;
  audience: WidgetAudience;
  /** Rendered in the public /demo with sample data */
  demo: boolean;
}

export const DASHBOARD_WIDGETS: DashboardWidgetDef[] = [
  { id: 'alerts', title: 'Needs Your Attention', audience: 'everyone', demo: true },
  { id: 'financials', title: 'Collective Financials', audience: 'voting_members', demo: true },
  { id: 'my_inventory', title: 'My Inventory', audience: 'own_only', demo: true },
  { id: 'my_statement', title: 'My Statement', audience: 'own_only', demo: true },
  { id: 'labor_week', title: 'Labor This Week', audience: 'voting_members', demo: true },
  { id: 'radar', title: 'Operations Radar', audience: 'voting_members', demo: true },
  { id: 'admin_tools', title: 'Steward Tools', audience: 'admin', demo: true },
  { id: 'ai_usage', title: 'AI Cost Monitor', audience: 'admin', demo: false },
];

/**
 * Strict role-focused widget stack per hat:
 * 1) Urgent triage alerts first
 * 2) Personal / role pulse second
 * 3) Collective financials / steward pulse third (with role-adaptive collapse defaults)
 * Secondary shortcuts & IRS Schedule C Tax Playbook live cleanly in the Command Dock / SlideOverDrawer.
 */
export const ROLE_LAYOUTS: Record<MemberHat, string[]> = {
  founder: ['alerts', 'financials', 'admin_tools', 'ai_usage', 'radar'],
  curator: ['alerts', 'my_inventory', 'my_statement', 'financials'],
  promoter: ['alerts', 'labor_week', 'financials'],
  enabler: ['alerts', 'radar', 'labor_week', 'financials'],
  consignor: ['alerts', 'my_statement', 'my_inventory'],
};

const HAT_ORDER: MemberHat[] = ['founder', 'curator', 'promoter', 'enabler', 'consignor'];

/** Union of the member's hat layouts, lead hat first, de-duplicated (first occurrence wins). */
export function layoutForHats(hats: readonly MemberHat[], leadHat: MemberHat): string[] {
  const ordered = [leadHat, ...HAT_ORDER.filter((h) => h !== leadHat && hats.includes(h))].filter((h) => hats.includes(h));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const hat of ordered) {
    for (const id of ROLE_LAYOUTS[hat] ?? []) {
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  return out;
}

/**
 * Access-control check: ALWAYS evaluated against the member's REAL `memberHats` + `isAdmin`
 * (never the UI lens), so switching lenses can never elevate visibility.
 */
export function widgetAllowed(def: DashboardWidgetDef, memberHats: readonly MemberHat[], isAdmin: boolean): boolean {
  switch (def.audience) {
    case 'voting_members':
      return canSeeCollectiveFinancials(memberHats);
    case 'admin':
      return isAdmin;
    default:
      return true;
  }
}

/**
 * Strict per-lens widget resolver:
 * - Single hat lens (`curator`, `promoter`, `enabler`, `founder`, `consignor`): renders ONLY that hat's focused stack.
 * - `'all'` lens: renders the deduplicated union across all of the member's real hats.
 */
export function visibleWidgetIdsForLens(
  memberHats: readonly MemberHat[],
  lens: ActiveLens,
  leadHat: MemberHat,
  isAdmin: boolean
): string[] {
  const rawIds =
    lens === 'all'
      ? layoutForHats(memberHats, leadHat)
      : memberHats.includes(lens)
        ? ROLE_LAYOUTS[lens] ?? []
        : ROLE_LAYOUTS[leadHat] ?? [];

  return rawIds.filter((id) => {
    const def = DASHBOARD_WIDGETS.find((w) => w.id === id);
    return !!def && widgetAllowed(def, memberHats, isAdmin);
  });
}

export function visibleWidgetIds(hats: readonly MemberHat[], leadHat: MemberHat, isAdmin: boolean): string[] {
  return visibleWidgetIdsForLens(hats, 'all', leadHat, isAdmin);
}

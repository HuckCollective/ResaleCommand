import { canSeeCollectiveFinancials, type MemberHat } from './memberHats';

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
  { id: 'role_hub', title: 'My Role', audience: 'everyone', demo: true },
  { id: 'alerts', title: 'Needs Your Attention', audience: 'everyone', demo: true },
  { id: 'financials', title: 'Collective Financials', audience: 'voting_members', demo: true },
  { id: 'my_inventory', title: 'My Inventory', audience: 'own_only', demo: true },
  { id: 'my_statement', title: 'My Statement', audience: 'own_only', demo: true },
  { id: 'labor_week', title: 'Labor This Week', audience: 'voting_members', demo: true },
  { id: 'radar', title: 'Operations Radar', audience: 'voting_members', demo: true },
  { id: 'tax_tips', title: 'Tax Tips', audience: 'voting_members', demo: true },
  { id: 'admin_tools', title: 'Steward Tools', audience: 'admin', demo: true },
  { id: 'ai_usage', title: 'AI Cost Monitor', audience: 'admin', demo: false },
];

/** Ordered widget ids per hat. Top of every layout: role hub, then alerts. */
export const ROLE_LAYOUTS: Record<MemberHat, string[]> = {
  founder: ['role_hub', 'alerts', 'financials', 'radar', 'tax_tips', 'admin_tools', 'ai_usage'],
  curator: ['role_hub', 'alerts', 'financials', 'my_inventory', 'radar', 'tax_tips'],
  promoter: ['role_hub', 'alerts', 'financials', 'labor_week', 'tax_tips'],
  enabler: ['role_hub', 'alerts', 'financials', 'radar', 'labor_week', 'tax_tips'],
  consignor: ['role_hub', 'alerts', 'my_statement', 'my_inventory'],
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

export function widgetAllowed(def: DashboardWidgetDef, hats: readonly MemberHat[], isAdmin: boolean): boolean {
  switch (def.audience) {
    case 'voting_members':
      return canSeeCollectiveFinancials(hats);
    case 'admin':
      return isAdmin;
    default:
      return true;
  }
}

export function visibleWidgetIds(hats: readonly MemberHat[], leadHat: MemberHat, isAdmin: boolean): string[] {
  return layoutForHats(hats, leadHat).filter((id) => {
    const def = DASHBOARD_WIDGETS.find((w) => w.id === id);
    return !!def && widgetAllowed(def, hats, isAdmin);
  });
}


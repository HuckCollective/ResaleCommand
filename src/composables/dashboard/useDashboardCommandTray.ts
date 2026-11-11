import { computed, inject, onMounted, provide, ref, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import type { MemberHat } from '../../lib/memberHats';
import {
  buildAlertsForMember,
  type AlertCardData,
  type AlertCategory,
  type AlertSeverity,
} from '../../lib/dashboardAlerts';
import type { DashboardSource } from './useDashboardSource';

export type DashboardTrayId = 'triage' | 'radar' | 'tools';
export type TriageFilterId = 'all' | 'critical' | 'inventory' | 'sales' | 'coop' | 'snoozed';

export interface RoleActionLink {
  label: string;
  hint: string;
  icon: string;
  href: string;
}

export interface RolePrimaryCpa {
  label: string;
  shortLabel: string;
  icon: string;
  href: string;
}

export function getRoleActionsForHat(hat: MemberHat, prefix: string): RoleActionLink[] {
  switch (hat) {
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
        { label: 'Quick Scout', hint: prefix ? `Sourcing for ${prefix}` : 'Source new inventory', icon: 'solar:scanner-bold', href: '/scout?quick=true' },
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
        { label: 'Locations & Booth Sync', hint: 'Booth barcode & stock sync', icon: 'solar:refresh-circle-bold-duotone', href: '/warehouse' },
        { label: 'Thermal Label Studio', hint: 'Print booth tags', icon: 'solar:printer-bold-duotone', href: '/labels/studio' },
        { label: 'Inventory', hint: 'Restock & staging queues', icon: 'solar:box-bold-duotone', href: '/inventory' },
        { label: 'Labor Ledger', hint: 'My logged work', icon: 'solar:clock-circle-bold-duotone', href: '/coop/labor' },
      ];
    default:
      return [
        { label: 'My Statement & What-If', hint: prefix ? `${prefix} payouts` : 'Consignor payouts', icon: 'solar:document-text-bold-duotone', href: '/coop/settlements' },
        { label: 'Sales Ledger', hint: 'Sold items', icon: 'solar:dollar-minimalistic-bold-duotone', href: '/sales' },
      ];
  }
}

export function getRolePrimaryCpa(hat: MemberHat): RolePrimaryCpa {
  switch (hat) {
    case 'enabler':
      return { label: 'Booth & Sync Hub', shortLabel: 'Locations', icon: 'solar:shop-2-bold', href: '/warehouse' };
    case 'promoter':
      return { label: 'Dropcast Studio', shortLabel: 'Dropcast', icon: 'solar:broadcast-bold', href: '/social' };
    case 'consignor':
      return { label: 'My Statement', shortLabel: 'Statement', icon: 'solar:hand-money-bold', href: '/coop/settlements' };
    case 'curator':
    case 'founder':
    default:
      return { label: 'Quick Scout', shortLabel: 'Scout', icon: 'solar:scanner-bold', href: '/scout' };
  }
}

export const ALERT_SEVERITY_BORDER: Record<AlertSeverity, string> = {
  error: 'border-error/60',
  warning: 'border-warning/50',
  info: 'border-info/40',
  success: 'border-success/40',
};

export const ALERT_SEVERITY_TEXT: Record<AlertSeverity, string> = {
  error: 'text-error',
  warning: 'text-warning',
  info: 'text-info',
  success: 'text-success',
};

export const ALERT_SEVERITY_BADGE: Record<AlertSeverity, string> = {
  error: 'badge-error text-error-content',
  warning: 'badge-warning text-warning-content',
  info: 'badge-info text-info-content',
  success: 'badge-success text-success-content',
};

export const ALERT_CATEGORY_LABEL: Record<AlertCategory, string> = {
  inventory: 'Inventory & Booth',
  sales: 'Sales & Sync',
  coop: 'Co-op & Finance',
  marketing: 'Marketing',
  membership: 'Membership',
};

export interface DashboardCommandTrayController {
  activeTray: Ref<DashboardTrayId | null>;
  triageFilter: Ref<TriageFilterId>;
  allCards: ComputedRef<AlertCardData[]>;
  activeCards: ComputedRef<AlertCardData[]>;
  topPriorityCards: ComputedRef<AlertCardData[]>;
  overflowCards: ComputedRef<AlertCardData[]>;
  snoozedCards: ComputedRef<AlertCardData[]>;
  criticalCount: ComputedRef<number>;
  openTray: (id: DashboardTrayId, filter?: TriageFilterId) => void;
  toggleTray: (id: DashboardTrayId) => void;
  closeTray: () => void;
  snooze: (id: string, days: number) => void;
  unsnooze: (id: string) => void;
  unsnoozeAll: () => void;
}

const DASHBOARD_TRAY_KEY: InjectionKey<DashboardCommandTrayController> = Symbol('dashboardCommandTray');
const SNOOZE_KEY = 'rc_alert_snooze_v1';

export function createDashboardCommandTray(
  source: DashboardSource,
  activeHat: Ref<MemberHat>
): DashboardCommandTrayController {
  const activeTray = ref<DashboardTrayId | null>(null);
  const triageFilter = ref<TriageFilterId>('all');
  const snoozeUntil = ref<Record<string, number>>({});

  const persistSnooze = () => {
    if (source.mode !== 'live' || typeof window === 'undefined') return;
    try {
      localStorage.setItem(SNOOZE_KEY, JSON.stringify(snoozeUntil.value));
    } catch {}
  };

  const allCards = computed(() => {
    const member = { ...source.member.value, hats: [activeHat.value] };
    return buildAlertsForMember(source.snapshot.value, member, { liveOnly: source.mode === 'live' });
  });

  const activeCards = computed(() =>
    allCards.value.filter((c) => (snoozeUntil.value[c.id] ?? 0) <= source.snapshot.value.now)
  );

  const snoozedCards = computed(() =>
    allCards.value.filter((c) => (snoozeUntil.value[c.id] ?? 0) > source.snapshot.value.now)
  );

  const topPriorityCards = computed(() => activeCards.value.slice(0, 3));
  const overflowCards = computed(() => activeCards.value.slice(3));

  const criticalCount = computed(
    () => activeCards.value.filter((c) => c.severity === 'error' || c.severity === 'warning').length
  );

  const openTray = (id: DashboardTrayId, filter?: TriageFilterId) => {
    if (filter) triageFilter.value = filter;
    activeTray.value = id;
  };

  const toggleTray = (id: DashboardTrayId) => {
    activeTray.value = activeTray.value === id ? null : id;
  };

  const closeTray = () => {
    activeTray.value = null;
  };

  const snooze = (id: string, days: number) => {
    const baseNow = source.mode === 'live' ? Date.now() : source.snapshot.value.now;
    snoozeUntil.value = { ...snoozeUntil.value, [id]: baseNow + days * 86_400_000 };
    persistSnooze();
  };

  const unsnooze = (id: string) => {
    const next = { ...snoozeUntil.value };
    delete next[id];
    snoozeUntil.value = next;
    persistSnooze();
  };

  const unsnoozeAll = () => {
    snoozeUntil.value = {};
    persistSnooze();
  };

  onMounted(() => {
    if (source.mode !== 'live' || typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(SNOOZE_KEY);
      if (raw) snoozeUntil.value = JSON.parse(raw);
    } catch {}
  });

  const controller: DashboardCommandTrayController = {
    activeTray,
    triageFilter,
    allCards,
    activeCards,
    topPriorityCards,
    overflowCards,
    snoozedCards,
    criticalCount,
    openTray,
    toggleTray,
    closeTray,
    snooze,
    unsnooze,
    unsnoozeAll,
  };

  provide(DASHBOARD_TRAY_KEY, controller);
  return controller;
}

export function useDashboardCommandTray(): DashboardCommandTrayController {
  const ctx = inject(DASHBOARD_TRAY_KEY);
  if (!ctx) {
    throw new Error('useDashboardCommandTray() called outside a <DashboardShell>.');
  }
  return ctx;
}


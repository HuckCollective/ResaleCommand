import type { MemberHat } from './memberHats';
import type { DashboardMember, DashboardSnapshot } from './dashboardTypes';
import {
  isWorkingStockItem,
  isUnassignedLocation,
  matchesSmartQueue,
  matchesSpatialLocation,
  matchesPartnerPrefix,
} from './inventoryVibes';

/** All alert thresholds live here — never hardcode them in components. */
export const ALERT_CONFIG = {
  /** Items still in `received` status (never shelved/listed) after this many days */
  agingReceivedDays: 7,
  /** Ricochet sync older than this many days */
  staleSyncDays: 14,
  /** A vote closing within this many days is flagged as "closing soon" */
  voteSoonDays: 3,
  /** Promoters/Enablers with no logged hours in this many days */
  laborLogDays: 7,
  /** "New sale" look-back window */
  newSaleDays: 7,
} as const;
export type AlertConfig = typeof ALERT_CONFIG;

export type AlertSeverity = 'error' | 'warning' | 'info' | 'success';
export type AlertCategory = 'inventory' | 'sales' | 'coop' | 'marketing' | 'membership';

export interface AlertSample {
  label: string;
  href: string;
}

export interface AlertCardData {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  icon: string;
  title: string;
  detail: string;
  count: number;
  samples: AlertSample[];
  href: string;
  actionText: string;
}

interface AlertResult {
  count: number;
  detail: string;
  samples?: AlertSample[];
  href?: string;
}

interface AlertContext {
  snap: DashboardSnapshot;
  member: DashboardMember;
  cfg: AlertConfig;
}

interface AlertTypeDef {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  icon: string;
  title: string;
  actionText: string;
  href: string;
  hats: MemberHat[];
  /** false = the live dashboard cannot load this data yet (shown in /demo only) */
  liveWired: boolean;
  evaluate: (ctx: AlertContext) => AlertResult;
}

// ── Shared item helpers (single source for dashboard + metrics) ─────────────
export function parseItemValue(item: any, key: string, noteKey: string): number {
  let val = 0;
  if (item[key]) {
    val = parseFloat(item[key]);
  } else if (item.conditionNotes) {
    const match = String(item.conditionNotes).match(new RegExp(`${noteKey}[:\\s]*\\$?([\\d.]+)`, 'i'));
    if (match) val = parseFloat(match[1]);
  }
  return isNaN(val) ? 0 : val;
}

export const isActiveInventory = (i: any): boolean =>
  !['sold', 'tracked', 'scouted', 'combined'].includes(i.status);

const estValueOf = (i: any) =>
  parseItemValue(i, 'resalePrice', 'Resale') || parseItemValue(i, 'estValue', 'Est. Low') || parseItemValue(i, 'listPrice', 'Est');
const costOf = (i: any) => parseItemValue(i, 'cost', 'Paid') || parseItemValue(i, 'purchasePrice', 'Paid');
const soldPriceOf = (i: any) => parseItemValue(i, 'soldPrice', 'Sold') || parseItemValue(i, 'price', 'Sold');

const hasPhoto = (i: any): boolean => {
  if (i.imageId || (i.galleryImageIds && i.galleryImageIds.length > 0)) return true;
  const notes = i.conditionNotes ? String(i.conditionNotes) : '';
  return notes.includes('[MAIN IMAGE ID:') || notes.includes('[IMAGE_ID:');
};

const daysSince = (iso: string | undefined | null, now: number): number => {
  const t = iso ? Date.parse(iso) : NaN;
  return isNaN(t) ? 0 : Math.floor((now - t) / 86_400_000);
};

const money = (n: number) => `$${n.toFixed(2)}`;

const sampleItems = (items: any[], max = 3): AlertSample[] =>
  items.slice(0, max).map((i) => ({
    label: String(i.title || i.upc || i.$id || 'Item'),
    href: i.$id ? `/item/${i.$id}` : '/inventory',
  }));

const nameMatches = (a: string | undefined, b: string | undefined) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

const ownsPrefix = (member: DashboardMember, prefix?: string) =>
  !!member.inventoryPrefix && !!prefix && prefix.toUpperCase().startsWith(member.inventoryPrefix.toUpperCase());

const VOTING_HATS: MemberHat[] = ['founder', 'curator', 'promoter', 'enabler'];

const countOnly = (items: any[], detail: string, href?: string): AlertResult => ({
  count: items.length,
  detail,
  samples: sampleItems(items),
  href,
});

// ── The 20 alert types (#20 join requests is data-ready but needs the join queue) ──
export const ALERT_TYPES: AlertTypeDef[] = [
  // Inventory & booth ops
  {
    id: 'unassigned_location', category: 'inventory', severity: 'warning', icon: 'solar:danger-triangle-bold-duotone',
    title: 'Unassigned location', actionText: 'Assign locations', href: '/inventory?location=__unassigned__',
    hats: ['enabler', 'curator', 'founder'], liveWired: true,
    evaluate: ({ snap }) => countOnly(snap.items.filter((i) => isWorkingStockItem(i) && isUnassignedLocation(i)),
      'Active items with no warehouse or booth code. Every item needs a home.'),
  },
  {
    id: 'ej_not_marked_md', category: 'inventory', severity: 'warning', icon: 'solar:refresh-circle-bold-duotone',
    title: '0EJ tagged, not marked MD', actionText: 'Review sync audit', href: '/inventory?queue=needs_md_sync',
    hats: ['enabler', 'founder'], liveWired: true,
    evaluate: ({ snap }) => countOnly(snap.items.filter((i) => isWorkingStockItem(i) && matchesSmartQueue(i, 'needs_md_sync')),
      'Items with a booth 0EJ SKU that are not marked as placed in the booth.'),
  },
  {
    id: 'md_missing_0ej', category: 'inventory', severity: 'warning', icon: 'solar:tag-horizontal-bold-duotone',
    title: 'Booth item missing a 0EJ SKU', actionText: 'Assign SKUs', href: '/inventory?queue=missing_booth_sku',
    hats: ['enabler', 'founder'], liveWired: true,
    evaluate: ({ snap }) => countOnly(snap.items.filter((i) => isWorkingStockItem(i) && matchesSmartQueue(i, 'missing_booth_sku')),
      'Booth items that still need a register SKU.'),
  },
  {
    id: 'legacy_hd', category: 'inventory', severity: 'info', icon: 'solar:archive-minimalistic-bold-duotone',
    title: 'Legacy HD storage code', actionText: 'Move to HG/HH', href: '/inventory?location=HD',
    hats: ['enabler', 'founder'], liveWired: true,
    evaluate: ({ snap }) => countOnly(snap.items.filter((i) => isWorkingStockItem(i) && matchesSpatialLocation(i, 'HD')),
      'Items still using the retired HD code.'),
  },
  {
    id: 'sold_no_price', category: 'inventory', severity: 'error', icon: 'solar:danger-triangle-bold-duotone',
    title: 'Sold items missing sale price', actionText: 'Review sold items', href: '/inventory?insightFilter=missing_sold_price',
    hats: ['founder', 'curator'], liveWired: true,
    evaluate: ({ snap }) => countOnly(snap.items.filter((i) => i.status === 'sold' && !soldPriceOf(i)),
      'Marked sold without a sale price, which pulls total profit down.'),
  },
  {
    id: 'no_est_value', category: 'inventory', severity: 'warning', icon: 'solar:tag-price-bold-duotone',
    title: 'Items missing estimated value', actionText: 'Estimate values', href: '/inventory?insightFilter=missing_est_value',
    hats: ['curator', 'enabler'], liveWired: true,
    evaluate: ({ snap }) => countOnly(snap.items.filter((i) => isActiveInventory(i) && !estValueOf(i)),
      'Stock without an estimated value or list price.'),
  },
  {
    id: 'no_cost', category: 'inventory', severity: 'warning', icon: 'solar:bill-cross-bold-duotone',
    title: 'Items missing cost basis', actionText: 'Add cost basis', href: '/inventory?insightFilter=missing_cost',
    hats: ['curator', 'founder'], liveWired: true,
    evaluate: ({ snap }) => countOnly(snap.items.filter((i) => isActiveInventory(i) && !costOf(i)),
      'Stock with $0 cost. Logging cost keeps payouts and ROI accurate.'),
  },
  {
    id: 'no_description', category: 'inventory', severity: 'warning', icon: 'solar:document-text-bold-duotone',
    title: 'Items missing descriptions', actionText: 'Generate descriptions', href: '/inventory?insightFilter=missing_description',
    hats: ['curator', 'promoter'], liveWired: true,
    evaluate: ({ snap }) => countOnly(snap.items.filter((i) => isActiveInventory(i) && (!i.marketDescription || i.marketDescription.length < 10)),
      'Items without a pitch cannot be posted or listed.'),
  },
  {
    id: 'no_photos', category: 'inventory', severity: 'error', icon: 'solar:camera-broken',
    title: 'Items missing photos', actionText: 'Add photos', href: '/inventory?insightFilter=missing_photos',
    hats: ['curator', 'promoter'], liveWired: true,
    evaluate: ({ snap }) => countOnly(snap.items.filter((i) => isActiveInventory(i) && !hasPhoto(i)),
      'An item without photos is invisible to buyers.'),
  },
  {
    id: 'aging_received', category: 'inventory', severity: 'info', icon: 'solar:clock-circle-bold-duotone',
    title: 'Received but never shelved', actionText: 'Place or list them', href: '/inventory?status=received',
    hats: ['curator', 'enabler'], liveWired: true,
    evaluate: ({ snap, cfg }) => countOnly(
      snap.items.filter((i) => i.status === 'received' && daysSince(i.$createdAt, snap.now) > cfg.agingReceivedDays),
      `Items received more than ${cfg.agingReceivedDays} days ago that were never placed or listed.`),
  },

  // Sales & sync
  {
    id: 'unlinked_tickets', category: 'sales', severity: 'warning', icon: 'solar:link-broken-bold-duotone',
    title: 'Unlinked register tickets', actionText: 'Link tickets', href: '/sales',
    hats: ['founder'], liveWired: false,
    evaluate: ({ snap }) => {
      const rows = snap.sales.filter((s) => !s.matched);
      return {
        count: rows.length,
        detail: 'Register tickets not matched to an inventory item.',
        samples: rows.slice(0, 3).map((s) => ({ label: `${s.title} (${money(s.amount)})`, href: '/sales' })),
      };
    },
  },
  {
    id: 'stale_sync', category: 'sales', severity: 'warning', icon: 'solar:round-transfer-horizontal-bold-duotone',
    title: 'Register sync is stale', actionText: 'Open sync', href: '/warehouse/sync/MD',
    hats: ['founder', 'enabler'], liveWired: true,
    evaluate: ({ snap, cfg }) => {
      if (!snap.lastSyncAt) return { count: 0, detail: '' };
      const days = daysSince(snap.lastSyncAt, snap.now);
      return days > cfg.staleSyncDays
        ? { count: 1, detail: `Last register sync was ${days} days ago.` }
        : { count: 0, detail: '' };
    },
  },
  {
    id: 'new_sale_mine', category: 'sales', severity: 'success', icon: 'solar:dollar-minimalistic-bold-duotone',
    title: 'New sale on my items', actionText: 'See sales', href: '/sales',
    hats: ['curator', 'consignor'], liveWired: true,
    evaluate: ({ snap, member, cfg }) => {
      const rows = snap.sales.filter((s) => ownsPrefix(member, s.ownerPrefix) && daysSince(s.soldAt, snap.now) <= cfg.newSaleDays);
      return {
        count: rows.length,
        detail: `Sold in the last ${cfg.newSaleDays} days.`,
        samples: rows.slice(0, 3).map((s) => ({ label: `${s.title} (${money(s.amount)})`, href: '/sales' })),
      };
    },
  },
  {
    id: 'payout_ready', category: 'sales', severity: 'success', icon: 'solar:hand-money-bold-duotone',
    title: 'Payout statement ready', actionText: 'View statement', href: '/coop/settlements',
    hats: ['curator', 'consignor', 'founder'], liveWired: false,
    evaluate: ({ snap }) => snap.statement?.ready
      ? { count: 1, detail: `${snap.statement.month} statement is ready (${money(snap.statement.payout)} payout).` }
      : { count: 0, detail: '' },
  },

  // Co-op & finance
  {
    id: 'vote_needed', category: 'coop', severity: 'warning', icon: 'solar:users-group-two-rounded-bold-duotone',
    title: 'A vote needs you', actionText: 'Open governance', href: '/coop/governance',
    hats: VOTING_HATS, liveWired: true,
    evaluate: ({ snap, member, cfg }) => {
      const open = snap.proposals.filter((p) =>
        p.status === 'active' && !Object.values(p.votes || {}).some((v) => nameMatches(v.memberName, member.name)));
      const soon = open.filter((p) => {
        const ms = Date.parse(p.deadline);
        return !isNaN(ms) && ms - snap.now <= cfg.voteSoonDays * 86_400_000;
      }).length;
      return {
        count: open.length,
        detail: soon > 0 ? `${soon} closing within ${cfg.voteSoonDays} days.` : 'Open proposals you have not voted on.',
        samples: open.slice(0, 3).map((p) => ({ label: p.title, href: '/coop/governance' })),
      };
    },
  },
  {
    id: 'breakeven_shortfall', category: 'coop', severity: 'warning', icon: 'solar:graph-down-bold-duotone',
    title: 'Commons breakeven shortfall', actionText: 'Open settlements', href: '/coop/settlements',
    hats: VOTING_HATS, liveWired: false,
    evaluate: ({ snap }) => snap.shortfall > 0
      ? { count: 1, detail: `${money(snap.shortfall)} short of covering this month's operating costs.` }
      : { count: 0, detail: '' },
  },
  {
    id: 'pending_reimbursements', category: 'coop', severity: 'info', icon: 'solar:bill-list-bold-duotone',
    title: 'Expenses pending reimbursement', actionText: 'Review expenses', href: '/expenses',
    hats: ['founder'], liveWired: true,
    evaluate: ({ snap }) => {
      const rows = snap.expenses.filter((e) => e.status === 'pending' && e.scope !== 'personal_write_off');
      const total = rows.reduce((s, e) => s + e.amount, 0);
      return {
        count: rows.length,
        detail: `${money(total)} owed to members who fronted shared costs.`,
        samples: rows.slice(0, 3).map((e) => ({ label: `${e.title} (${money(e.amount)})`, href: '/expenses' })),
      };
    },
  },

  // Marketing
  {
    id: 'drop_unannounced', category: 'marketing', severity: 'info', icon: 'solar:broadcast-bold-duotone',
    title: 'Booth drop ready, not announced', actionText: 'Open Dropcast Studio', href: '/social',
    hats: ['promoter'], liveWired: true,
    evaluate: ({ snap }) => {
      const rows = snap.drops.filter((d) => d.status === 'ready');
      return {
        count: rows.length,
        detail: 'Drops with items on the shelf and no announcement yet.',
        samples: rows.slice(0, 3).map((d) => ({ label: d.title, href: '/social' })),
      };
    },
  },
  {
    id: 'labor_unlogged', category: 'marketing', severity: 'info', icon: 'solar:clock-circle-bold-duotone',
    title: 'No hours logged this week', actionText: 'Log hours', href: '/coop/labor',
    hats: ['promoter', 'enabler'], liveWired: true,
    evaluate: ({ snap, member, cfg }) => {
      const cutoff = snap.now - cfg.laborLogDays * 86_400_000;
      const logged = snap.laborEntries.some((e) => nameMatches(e.member, member.name) && Date.parse(e.date) >= cutoff);
      return logged
        ? { count: 0, detail: '' }
        : { count: 1, detail: `You have no logged hours in the last ${cfg.laborLogDays} days. Hours count toward the labor pool.` };
    },
  },

  // Membership
  {
    id: 'join_requests', category: 'membership', severity: 'info', icon: 'solar:user-plus-bold-duotone',
    title: 'Join requests waiting', actionText: 'Review requests', href: '/coop/governance',
    hats: ['founder'], liveWired: true,
    evaluate: ({ snap }) => ({ count: snap.joinRequests, detail: 'People who asked to join and confirmed their email.' }),
  },
];

const SEVERITY_ORDER: Record<AlertSeverity, number> = { error: 0, warning: 1, info: 2, success: 3 };

export interface BuildAlertsOptions {
  /** Live dashboard: skip alert types whose data the live source cannot load yet */
  liveOnly?: boolean;
  cfg?: AlertConfig;
}

/** Evaluate every alert type the member's hats can see; drop zero-count cards; sort by urgency. */
export function buildAlertsForMember(
  snap: DashboardSnapshot,
  member: DashboardMember,
  opts: BuildAlertsOptions = {}
): AlertCardData[] {
  const cfg = opts.cfg ?? ALERT_CONFIG;
  const cards: AlertCardData[] = [];

  for (const def of ALERT_TYPES) {
    if (opts.liveOnly && !def.liveWired) continue;
    if (!def.hats.some((h) => member.hats.includes(h))) continue;

    // Consignors only ever see alerts about their own items/payouts
    const result = def.evaluate({ snap, member, cfg });
    if (result.count <= 0) continue;

    cards.push({
      id: def.id,
      category: def.category,
      severity: def.severity,
      icon: def.icon,
      title: def.title,
      detail: result.detail,
      count: result.count,
      samples: result.samples ?? [],
      href: result.href ?? def.href,
      actionText: def.actionText,
    });
  }

  return cards.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.count - a.count
  );
}

/** Items owned by the member's prefix (used for consignor-only views). */
export function itemsOwnedBy(items: any[], member: DashboardMember): any[] {
  return member.inventoryPrefix ? items.filter((i) => matchesPartnerPrefix(i, member.inventoryPrefix)) : [];
}


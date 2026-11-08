import type { MemberHat } from './memberHats';

/** Minimal shapes the dashboard needs. Live and demo sources both produce these. */
export interface DashboardMember {
  name: string;
  hats: MemberHat[];
  /** Barcode prefix for Curator / Consignor hats, e.g. 'HUCK-' */
  inventoryPrefix?: string;
}

export interface DashboardProposalLite {
  id: string;
  title: string;
  status: 'active' | 'passed' | 'blocked';
  deadline: string;
  votes: Record<string, { memberName: string }>;
}

export interface DashboardLaborLite {
  member: string;
  date: string;
  hours: number;
}

export interface DashboardSaleLite {
  id: string;
  title: string;
  soldAt: string;
  amount: number;
  /** false when the register ticket is not linked to an inventory item */
  matched: boolean;
  /** Barcode prefix of the item's owner, e.g. 'HUCK-' */
  ownerPrefix?: string;
}

export interface DashboardExpenseLite {
  id: string;
  title: string;
  amount: number;
  status: 'pending' | 'reimbursed';
  scope: 'coop_shared' | 'personal_write_off' | 'split';
}

export interface DashboardDropLite {
  id: string;
  title: string;
  status: 'ready' | 'announced';
}

export interface DashboardStatementLite {
  month: string;
  ready: boolean;
  grossSales: number;
  venueFee: number;
  rentOffset: number;
  payout: number;
  dealLabel: string;
}

export interface DashboardSnapshot {
  now: number;
  items: any[];
  purchases: any[];
  sales: DashboardSaleLite[];
  expenses: DashboardExpenseLite[];
  proposals: DashboardProposalLite[];
  laborEntries: DashboardLaborLite[];
  drops: DashboardDropLite[];
  /** ISO date of the last Ricochet sync, or null when unknown */
  lastSyncAt: string | null;
  statement: DashboardStatementLite | null;
  /** Commons breakeven shortfall for the current month (0 when none) */
  shortfall: number;
  joinRequests: number;
}

export function emptySnapshot(now = Date.now()): DashboardSnapshot {
  return {
    now,
    items: [],
    purchases: [],
    sales: [],
    expenses: [],
    proposals: [],
    laborEntries: [],
    drops: [],
    lastSyncAt: null,
    statement: null,
    shortfall: 0,
    joinRequests: 0,
  };
}

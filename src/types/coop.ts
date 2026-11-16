export type PartnerCode = 'HUCK-' | 'PDXGL-' | 'BB-' | 'SO-' | 'COMMONS-' | 'SWEAT-' | (string & {});

export type PartnerRole =
  | 'Co-op Partner'
  | 'Marketing & Social Enabler'
  | 'Consignor'
  | 'Commons Pool';

export type SweatSalesPoolMode = 'labor_only' | 'equal_all';

export type CoopAppwriteRole =
  | 'owner'
  | 'founder'
  | 'curator'
  | 'promoter'
  | 'enabler'
  | 'builder'
  | 'consignor'
  | 'member';

export interface CoopMeIdentity {
  authenticated: boolean;
  userId: string;
  name: string;
  email: string;
  teamId: string;
  confirmed: boolean;
  isBreakGlassAdmin: boolean;
  roles: CoopAppwriteRole[];
  isOwner: boolean;
  isFounder: boolean;
  soleFounder: boolean;
  canViewLabor: boolean;
  canLogLabor: boolean;
  canApproveLabor: boolean;
  canLockMonth: boolean;
  canEditGlobalFinancials: boolean;
  linkedMemberName?: string;
  linkedPartner?: 'HUCK' | 'PDXGL' | 'SWEAT' | 'BB';
}

export interface SettlementSaleItem {
  date: string;
  sku: string;
  ticketNumber?: string;
  title: string;
  grossPrice: number;
  venueFee: number;
  costBasis: number;
  shippingCost?: number;
  netSurplus: number;
  curatorTake: number;
  unrecoupedCost?: number;
  rawSale?: any;
}

export interface SettlementConfig {
  /** Optional fallback venue commission rate ONLY when POS ticket fees/netPayout are missing */
  venueFeeRate?: number;
  /** Gate 3 curator base profit split rate (from live policyConfig.curatorSharePct / 100) */
  curatorSplitRate: number;
  /** Gate 3 shared commons pool split rate (from live policyConfig.commonsSharePct / 100) */
  commonsSplitRate: number;
  /** Gross monthly booth rent from live warehouses.ts (forced to 0 inside engine when isMonthInProgress) */
  grossRent: number;
  /** Monthly tech & software operations cost */
  techOps: number;
  /** Monthly booth supplies & thermal tags cost */
  supplies: number;
  /** Prior month carried-over shortfall to repay before Gate 4B dividends */
  carriedOverShortfall: number;
  /** Current balance in the Co-op Emergency Reserve Fund */
  reserveBalance: number;
  /** Target cap for the Co-op Emergency Reserve Fund before 100% bonus distribution */
  reserveCap: number;
  /** True while the selected Pacific calendar month has not closed yet */
  isMonthInProgress?: boolean;
  /** Active surplus distribution mode */
  surplusPolicyMode: 'patronage_90_10' | 'cap_100' | 'reserve_100';
  /** Sales patronage split basis */
  surplusSplitBasis: 'volume' | 'equal';
  /** Whether $0-inventory SWEAT enablers participate only in Labor Pool or Equal Share of Both Pools */
  sweatSalesPoolMode: SweatSalesPoolMode;
  /** Policy percentages (0-100) */
  reserveSharePct: number;
  salesPatronagePct: number;
  laborPatronagePct: number;
  /** Mondragon ICA retained credit % (0-50, default 0 = 100% monthly cash check) */
  icaRetainedPct: number;
  /** Mondragon ICA projected annual yield rate % (e.g. 7) */
  icaAnnualYieldRatePct: number;
  /** Mondragon advisory pay-ratio compression standard (e.g. 4.5) */
  payRatioCapStandard: number;
}

export interface PartnerSummary {
  /** Unique deterministic key per org ('ORG::HUCK-') or individual SWEAT worker ('SWEAT::Jesse') */
  rowKey: string;
  partnerCode: PartnerCode;
  partnerName: string;
  memberName?: string;
  role: PartnerRole;
  isSweatEnabler?: boolean;
  isConsignor?: boolean;
  isCommonsPool?: boolean;
  itemsSold: number;
  grossSales: number;
  venueFee: number;
  /** Exact net store deposit after venue fee (grossSales - venueFee) */
  netAfterVenue?: number;
  costRecoup: number;
  /** Exposed when an item sold below cost + shipping after venue fee (never paid above netAfterVenue) */
  unrecoupedCost?: number;
  /** Positive net margin eligible for 70/30 split & volume patronage */
  netMargin?: number;
  baseProfit70: number;
  commons30: number;
  frontedReimbursement: number;
  finalPayoutCheck: number;
  /** Rent deducted from a Consignor via calculateConsignorSettlement */
  consignorRentDeducted?: number;
  /** Co-op commission contributed to Commons Pool by a Consignor */
  coopCommission?: number;
  dealMode?: 'pro_rata_rent' | 'flat_commission' | 'fixed_shelf_rent';
  dealFormulaLabel?: string;
  /** Approved labor hours logged in the period */
  laborHoursLogged?: number;
  /** Unapproved/pending labor hours (worth $0 until Founder approves) */
  pendingLaborHours?: number;
  deliverableCount?: number;
  /** Approved labor bounty hours weight for Gate 4B Labor Pool pro-rata */
  laborBountyWeight?: number;
  laborLogs?: any[];
  items?: SettlementSaleItem[];
  /** Gate 4B pro-rata bonus from Sales Patronage Pool */
  salesPatronageBonus?: number;
  /** Gate 4B pro-rata bonus from Sweat-Equity Labor Pool */
  laborBountyBonus?: number;
  /** Total Gate 4B dividend (salesPatronageBonus + laborBountyBonus) */
  totalBonusDividend?: number;
  /** Portion of totalBonusDividend retained as Mondragon ICA credit (not paid in cash check) */
  icaRetainedCredit?: number;
  /** Portion of totalBonusDividend paid in monthly cash check (totalBonusDividend - icaRetainedCredit) */
  cashBonusPaid?: number;
  /** Simple projected annual ICA yield estimate (icaRetainedCredit * icaAnnualYieldRatePct%) */
  projectedAnnualIcaYield?: number;
}

export interface MondragonPayRatioStatus {
  isMondragon104545: boolean;
  effectiveHourlyDividendRate: number;
  payRatioActual: number | null;
  payRatioCap: number;
  isPayRatioCompliant: boolean;
  noHoursBonusRows: string[];
  totalIcaRetained: number;
  totalCashBonusPaid: number;
  hasZeroLaborPresetWarning: boolean;
}

export interface SettlementResult {
  /** Total monthly operating cost breakeven target (netRent + techOps + supplies) */
  operatingBreakeven: number;
  /** Computed partner settlement rows including Gate 1-3 splits, Gate 4B dividends & ICA split */
  partners: PartnerSummary[];
  /** Net distributable surplus remaining after Operating Breakeven (Gate 4A) and Shortfall Repayment */
  excessSurplus: number;
  /** Amount added to the Co-op Emergency Reserve in Gate 4B */
  reserveAdded: number;
  /** Total bonus pool distributed to Co-op Partners in Gate 4B */
  partnerBonusPool: number;
  /** Input / scope warnings surfaced to UI chips */
  warnings: string[];
  /** Detailed Gate 2 & Gate 4A/4B accounting breakdown for UI scorecards */
  breakdown: {
    isMonthInProgress: boolean;
    grossRent: number;
    consignorRentOffset: number;
    netRent: number;
    techOps: number;
    supplies: number;
    totalCommonsCollected: number;
    netOperatingBalanceBeforeShortfall: number;
    shortfallRepaid: number;
    remainingShortfall: number;
    newReserveBalance: number;
    salesPatronagePool: number;
    laborBountyPool: number;
    mondragonStatus: MondragonPayRatioStatus;
  };
}

export type CoopMonthLockStatus = 'open' | 'locked' | 'unlocked';

export interface CoopUnlockHistoryEntry {
  by: { id: string; name: string };
  at: string;
  reason: string;
  previousHash: string;
  revisionUnlocked: number;
}

export interface CoopMonthLockRevisionDiffItem {
  rowKey: string;
  partnerName: string;
  previousCheck: number;
  newCheck: number;
  deltaCheck: number;
}

export interface CoopMonthLockSnapshot {
  month: string;
  status: 'locked' | 'unlocked';
  revision: number;
  lockedBy: { id: string; name: string };
  lockedAt: string;
  payoutDate?: string;
  payoutNote?: string;
  policy: {
    curatorSharePct: number;
    commonsSharePct: number;
    reserveSharePct: number;
    salesPatronagePct: number;
    laborPatronagePct: number;
    icaRetainedPct: number;
    icaAnnualYieldRatePct: number;
    payRatioCapStandard: number;
    sweatSalesPoolMode: SweatSalesPoolMode;
    surplusPolicyMode: 'patronage_90_10' | 'cap_100' | 'reserve_100';
    surplusSplitBasis: 'volume' | 'equal';
    carriedOverShortfallUsed: number;
    grossBoothRentUsed: number;
    venueFeePctActual: number;
  };
  laborApproved: any[];
  rows: PartnerSummary[];
  breakdown: SettlementResult['breakdown'];
  totals: {
    totalGross: number;
    totalVenueFee: number;
    totalStorePayout: number;
    totalCostBasis: number;
    totalNetSurplus: number;
    totalCuratorPayouts: number;
    totalCommonsPool: number;
    operatingBreakeven: number;
    excessSurplus: number;
    reserveAdded: number;
    partnerBonusPool: number;
  };
  snapshotHash: string;
  unlockHistory: CoopUnlockHistoryEntry[];
  priorRevisionDiff?: CoopMonthLockRevisionDiffItem[];
}

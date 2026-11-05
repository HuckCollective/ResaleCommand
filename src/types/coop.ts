export type PartnerCode = 'HUCK-' | 'PDXGL-' | 'BB-' | 'SO-' | 'COMMONS-' | (string & {});

export type PartnerRole = 'Co-op Partner' | 'Consignor';

export interface SettlementConfig {
  /** Gate 1 venue commission rate (e.g. 0.15 for 15% Memory Den fee) */
  venueFeeRate: number;
  /** Gate 3 curator base profit split rate (e.g. 0.70 for 70%) */
  curatorSplitRate: number;
  /** Gate 3 shared commons pool split rate (e.g. 0.30 for 30%) */
  commonsSplitRate: number;
  /** Gross monthly booth rent before consignor sub-lease offset (e.g. 382.50) */
  grossRent: number;
  /** Fixed monthly rent offset paid by Consignors such as BB- (defaults to 85.41 when consignors are active) */
  consignorFixedRent?: number;
  /** Monthly tech & software operations cost (e.g. 219.99) */
  techOps: number;
  /** Monthly booth supplies & thermal tags cost (e.g. 6.18) */
  supplies: number;
  /** Prior month carried-over shortfall to repay before Gate 4B dividends (e.g. -132.97 or 132.97) */
  carriedOverShortfall: number;
  /** Current balance in the Co-op Emergency Reserve Fund */
  reserveBalance: number;
  /** Target cap for the Co-op Emergency Reserve Fund before 100% bonus distribution */
  reserveCap: number;
  /** Optional share of Excess Surplus allocated to Reserve when below cap (defaults to 0.10 or up to remaining cap) */
  reserveContributionRate?: number;
  /** Gate 4B Sales Margin Patronage share of partnerBonusPool (defaults to 0.50) */
  salesPatronageRate?: number;
  /** Gate 4B Sweat-Equity Labor Bounty share of partnerBonusPool (defaults to 0.50) */
  laborBountyRate?: number;
}

export interface PartnerSummary {
  partnerCode: PartnerCode;
  partnerName: string;
  role: PartnerRole;
  itemsSold: number;
  grossSales: number;
  venueFee: number;
  costRecoup: number;
  baseProfit70: number;
  commons30: number;
  frontedReimbursement: number;
  finalPayoutCheck: number;
  /** Optional fixed rent deducted from a Consignor (e.g. $85.41 for BB-) in Gate 2 */
  consignorRentDeducted?: number;
  /** Optional approved labor bounty hours/dollars for Gate 4B 50% Labor Bounties pro-rata */
  laborBountyWeight?: number;
  /** Gate 4B pro-rata bonus from 50% Sales Margin pool */
  salesPatronageBonus?: number;
  /** Gate 4B pro-rata bonus from 50% Labor Bounties pool */
  laborBountyBonus?: number;
  /** Total Gate 4B dividend added to finalPayoutCheck */
  totalBonusDividend?: number;
}

export interface SettlementResult {
  /** Total monthly operating cost breakeven target ($297.09 net rent + $219.99 tech + $6.18 supplies = $523.26) */
  operatingBreakeven: number;
  /** Updated partner settlement rows including Gate 1-3 splits and Gate 4B dividends */
  partners: PartnerSummary[];
  /** Net distributable surplus remaining after Operating Breakeven (Gate 4A) and Shortfall Repayment */
  excessSurplus: number;
  /** Amount added to the Co-op Emergency Reserve in Gate 4B */
  reserveAdded: number;
  /** Total bonus pool distributed to Co-op Partners in Gate 4B (50% Sales Margin / 50% Labor Bounties) */
  partnerBonusPool: number;
  /** Detailed Gate 2 & Gate 4A/4B accounting breakdown for UI scorecards */
  breakdown: {
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
  };
}

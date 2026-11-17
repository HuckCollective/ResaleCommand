import { extractOrgPrefix, normalizeOrgPrefix } from '../inventoryUpc';
import {
  calendarMonthKeyFromDateString,
  monthKeyToLabel,
  pacificMonthKey,
} from '../salesBucketing';
import {
  getAllLocationSettingMetas,
  getLocationSettingMeta,
  resolveCanonicalLocationCode,
} from '../warehouses';
import type { CoopExpenseItem } from '../coopExpenses';
import {
  calculateConsignorSettlement,
  currentPacificMonthKey,
  findConsignorAgreement,
  getLaborHoursByMemberForMonth,
  getLaborHoursByPartnerForMonth,
  isSettlementEligibleLabor,
  laborEntryMonthKey,
  summarizeLaborApproval,
  type CoopLaborEntry,
  type CoopPolicyConfig,
  type LaborApprovalSummary,
  type MemberLaborShareSummary,
  type SurplusPolicyMode,
  type SurplusSplitBasis,
} from '../coopGovernance';
import type {
  CoopMonthLockSnapshot,
  MondragonPayRatioStatus,
  PartnerSummary,
  SettlementResult,
  SettlementSaleItem,
} from '../../types/coop';
import { fromCents, runCoopSettlement, toCents } from './settlementEngine';
import { computeCoCurationSplitCents, type CoCurationRecord } from '../onlineCoCuration';

export interface UnassignedReimbursementNotice {
  owner: string;
  partner: string;
  amount: number;
  description: string;
}

export interface MonthlySettlementSubtotal {
  monthKey: string;
  monthLabel: string;
  isLocked: boolean;
  isMonthInProgress: boolean;
  itemsSold: number;
  grossSales: number;
  venueFee: number;
  costRecoup: number;
  curatorBase: number;
  reimbursements: number;
  salesBonus: number;
  laborBonus: number;
  icaRetained: number;
  payoutCheck: number;
}

export interface EnrichedPartnerSettlement extends PartnerSummary {
  /** Template convenience aliases matching CoopSettlementView & PDF fields */
  prefix: string;
  name: string;
  totalGross: number;
  totalVenueFee: number;
  totalCostBasis: number;
  totalNetSurplus: number;
  totalCuratorProfit: number;
  grossCuratorShare: number;
  totalCommonsTake: number;
  reimbursements: number;
  rentDeduction: number;
  bonusSurplusDividend: number;
  totalPayoutCheck: number;
  approvedByNames?: string[];
  latestApprovedAt?: string;
  deliverableRefs?: string[];
  monthlySubtotals?: MonthlySettlementSubtotal[];
}

export interface BuiltSettlementSummary {
  totalGross: number;
  totalVenueFee: number;
  venueFeePct: number;
  totalStorePayout: number;
  totalCostBasis: number;
  totalUnrecoupedCost: number;
  totalNetSurplus: number;
  totalCuratorPayouts: number;
  totalCommonsPool: number;
  boothRent: number;
  isMonthInProgress: boolean;
  isVenueScopedPreview: boolean;
  isLockedSnapshot: boolean;
  consignorRentOffsets: number;
  netBoothRentForCoop: number;
  techOps: number;
  supplies: number;
  carriedOverShortfall: number;
  shortfallRepaid: number;
  remainingShortfall: number;
  totalCommonsOverhead: number;
  commonsNetBalance: number;
  excessSurplus: number;
  isCommonsFullyCovered: boolean;
  distributablePartnerBonusPool: number;
  salesPatronagePool: number;
  laborBonusPool: number;
  reserveAddition: number;
  newReserveBalance: number;
  breakevenProgressPct: number;
  memoryDenNetCheck: number;
  mondragonStatus: MondragonPayRatioStatus;
}

export interface BuiltMonthlySettlementBundle {
  rows: EnrichedPartnerSettlement[];
  summary: BuiltSettlementSummary;
  engineResult: SettlementResult;
  laborApproval: LaborApprovalSummary;
  approvedMemberShares: MemberLaborShareSummary[];
  allMemberShares: MemberLaborShareSummary[];
  unassignedReimbursements: UnassignedReimbursementNotice[];
  zeroSaleBoothWarnings: string[];
  warnings: string[];
}

export interface BuildMonthlySettlementInputs {
  sales: any[];
  period: string; // 'YYYY-MM' or 'all'
  location?: string; // 'all' | 'MD' | 'DT' | 'HG' | 'HH'
  warehouses?: any[];
  monthlyRentFallback?: number;
  expenses?: CoopExpenseItem[];
  laborEntries?: CoopLaborEntry[];
  policyConfig: CoopPolicyConfig;
  surplusPolicyMode: SurplusPolicyMode;
  surplusSplitBasis: SurplusSplitBasis;
  teamPartnerPrefixes?: any[];
  defaultUpcPrefix?: string;
  currentPacificMonth?: string;
  lockedSnapshotsByMonth?: Record<string, CoopMonthLockSnapshot>;
  coCurationRecords?: ReadonlyArray<CoCurationRecord>;
}

function extractSaleCalendarYmd(rawDate: unknown): string {
  const s = String(rawDate ?? '').trim();
  const iso = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = /^(0?[1-9]|1[0-2])[/-](0?[1-9]|[12]\d|3[01])[/-](\d{4})/.exec(s);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  return '';
}

export function resolveSaleLocationCode(sale: any, warehouses?: any[]): string {
  const whId = String(sale?.warehouseId || '').trim();
  const loc = String(sale?.locationName || '').trim();
  const direct = resolveCanonicalLocationCode(whId || loc, warehouses);
  if (direct) return direct;

  const locLower = loc.toLowerCase();
  const sSku = String(sale?.sku || '').toLowerCase();
  const sUpc = String(sale?.upc || '').toLowerCase();
  const soNumber = String(sale?.soNumber || '').toLowerCase();
  const orderId = String(sale?.orderId || '').toLowerCase();
  const whLower = whId.toLowerCase();

  if (
    locLower.includes('memory') ||
    locLower.includes('0ej') ||
    locLower === 'md' ||
    sSku.includes('0ej') ||
    sUpc.includes('0ej') ||
    soNumber.includes('0ej') ||
    orderId.startsWith('md-payout') ||
    orderId.startsWith('md-') ||
    orderId.startsWith('t-') ||
    whLower === '6a7e70050009db0e1857' ||
    whLower === '6ab9a37500233d76d580'
  ) {
    return 'MD';
  }

  if (
    locLower.includes('dusty') ||
    locLower.includes('tiger') ||
    locLower === 'dt' ||
    sSku.startsWith('dt-') ||
    orderId.startsWith('dt-') ||
    whLower === '6a7e71eb001f53734a86'
  ) {
    return 'DT';
  }

  return '';
}

export function resolveSalePartnerPrefix(
  sale: any,
  teamPartnerPrefixes: any[] = [],
  defaultUpcPrefix = 'HUCK-'
): string {
  const upc = String(sale?.upc || '').trim().toUpperCase();
  const sku = String(sale?.sku || '').trim().toUpperCase();
  const soNumber = String(sale?.soNumber || '').trim().toUpperCase();
  const title = String(sale?.title || '').trim().toUpperCase();

  if (
    upc.startsWith('COMMONS') ||
    sku.startsWith('COMMONS') ||
    soNumber.startsWith('COMMONS') ||
    title.includes('[COMMONS]')
  ) {
    return 'COMMONS-';
  }

  const extracted = extractOrgPrefix(upc) || extractOrgPrefix(sku) || extractOrgPrefix(soNumber);
  if (extracted) return extracted;

  if (
    upc.startsWith('BB') ||
    sku.startsWith('BB') ||
    soNumber.startsWith('BB') ||
    title.startsWith('B&B') ||
    title.startsWith('BB ') ||
    title.startsWith('BB-') ||
    title.includes(' B&B ') ||
    title.endsWith(' BB')
  ) {
    return 'BB-';
  }
  if (
    upc.startsWith('PDXGL') ||
    sku.startsWith('PDXGL') ||
    soNumber.startsWith('PDXGL') ||
    title.startsWith('PDXGL')
  ) {
    return 'PDXGL-';
  }
  if (
    upc.startsWith('HUCK') ||
    sku.startsWith('HUCK') ||
    soNumber.startsWith('HUCK') ||
    title.startsWith('HUCK')
  ) {
    return 'HUCK-';
  }

  for (const p of teamPartnerPrefixes || []) {
    const pStr = normalizeOrgPrefix(typeof p === 'string' ? p : p?.prefix);
    if (pStr && (upc.startsWith(pStr) || sku.startsWith(pStr) || soNumber.startsWith(pStr))) {
      return pStr;
    }
  }

  return normalizeOrgPrefix(defaultUpcPrefix || 'HUCK-');
}

export function resolvePartnerDisplayName(
  prefix: string,
  policyConfig: CoopPolicyConfig,
  teamPartnerPrefixes: any[] = []
): string {
  const clean = String(prefix || '').replace(/[-_]+$/, '').toUpperCase();
  if (clean === 'COMMONS') return 'Shared Commons Pool (100% Margin Sweep)';
  if (clean === 'HUCK') return 'Huckleberry Collective';
  if (clean === 'PDXGL') return 'PDX Game Library';

  const consignor = findConsignorAgreement(policyConfig.consignors, prefix);
  if (consignor?.displayName) return consignor.displayName;
  if (clean === 'BB') return 'B&B Consignment (PDXGL Sub-Client)';

  for (const p of teamPartnerPrefixes || []) {
    const pStr = normalizeOrgPrefix(typeof p === 'string' ? p : p?.prefix);
    if (pStr === prefix && typeof p === 'object' && p?.name) {
      return String(p.name);
    }
  }
  return `${clean} Partner`;
}

export function expenseMonthKey(dateStr?: string | null): string {
  const raw = String(dateStr ?? '').trim();
  if (!raw) return '';
  const written = calendarMonthKeyFromDateString(raw);
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(written)) return written;
  const pac = pacificMonthKey(raw);
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(pac) ? pac : '';
}

function isTechOpsExpense(e: CoopExpenseItem): boolean {
  const cat = String(e.category || '').toLowerCase();
  const desc = String(e.description || '').toLowerCase();
  return (
    cat.includes('tech') ||
    cat.includes('ai') ||
    desc.includes('gemini') ||
    desc.includes('appwrite') ||
    desc.includes('vercel') ||
    desc.includes('hosting') ||
    desc.includes('software') ||
    desc.includes('cloud') ||
    desc.includes('ai credits')
  );
}

function isRentOrMallFeeExpense(e: CoopExpenseItem): boolean {
  const cat = String(e.category || '').toLowerCase();
  return cat.includes('rent') || cat.includes('mall fee');
}

function enrichPartnerSummaryRow(
  row: PartnerSummary,
  extra: Partial<EnrichedPartnerSettlement> = {}
): EnrichedPartnerSettlement {
  const costBasis = Number(row.costRecoup || 0);
  const baseProfit = Number(row.baseProfit70 || 0);
  const grossCuratorShare = row.isCommonsPool
    ? 0
    : row.isConsignor
      ? baseProfit
      : fromCents(toCents(costBasis) + toCents(baseProfit));

  return {
    ...row,
    prefix: row.partnerCode,
    name: row.partnerName,
    totalGross: row.grossSales,
    totalVenueFee: row.venueFee,
    totalCostBasis: costBasis,
    totalNetSurplus: Number(row.netMargin ?? 0),
    totalCuratorProfit: baseProfit,
    grossCuratorShare,
    totalCommonsTake: row.commons30,
    reimbursements: row.frontedReimbursement,
    rentDeduction: Number(row.consignorRentDeducted ?? 0),
    bonusSurplusDividend: Number(row.totalBonusDividend ?? 0),
    totalPayoutCheck: row.finalPayoutCheck,
    ...extra,
  };
}

export function buildSettlementBundleFromLockSnapshot(
  lock: CoopMonthLockSnapshot
): BuiltMonthlySettlementBundle {
  const rows = (lock.rows || []).map((r) => enrichPartnerSummaryRow(r));
  const totalGross = Number(lock.totals?.totalGross ?? 0);
  const totalVenueFee = Number(lock.totals?.totalVenueFee ?? 0);
  const totalStorePayout = fromCents(toCents(totalGross) - toCents(totalVenueFee));
  const boothRent = Number(lock.breakdown?.grossRent ?? 0);
  const netBoothRentForCoop = Number(lock.breakdown?.netRent ?? 0);
  const techOps = Number(lock.breakdown?.techOps ?? 0);
  const supplies = Number(lock.breakdown?.supplies ?? 0);
  const carriedOverShortfall = Number(lock.policy?.carriedOverShortfallUsed ?? 0);
  const totalCommonsPool = Number(lock.breakdown?.totalCommonsCollected ?? 0);
  const totalCommonsOverhead = fromCents(
    toCents(netBoothRentForCoop) +
      toCents(techOps) +
      toCents(supplies) +
      toCents(carriedOverShortfall)
  );
  const commonsNetBalance = fromCents(toCents(totalCommonsPool) - toCents(totalCommonsOverhead));

  const approvedLabor = Array.isArray(lock.laborApproved) ? lock.laborApproved : [];
  const laborApproval = summarizeLaborApproval(approvedLabor, lock.month);
  const approvedMemberShares = getLaborHoursByMemberForMonth(
    approvedLabor,
    lock.month,
    undefined,
    { status: 'approved' }
  );

  const summary: BuiltSettlementSummary = {
    totalGross,
    totalVenueFee,
    venueFeePct:
      totalGross > 0 ? Number(((totalVenueFee / totalGross) * 100).toFixed(1)) : 0,
    totalStorePayout,
    totalCostBasis: Number(lock.totals?.totalCostBasis ?? 0),
    totalUnrecoupedCost: fromCents(
      rows.reduce((sum, r) => sum + toCents(r.unrecoupedCost ?? 0), 0)
    ),
    totalNetSurplus: Number(lock.totals?.totalNetSurplus ?? 0),
    totalCuratorPayouts: Number(lock.totals?.totalCuratorPayouts ?? 0),
    totalCommonsPool,
    boothRent,
    isMonthInProgress: false,
    isVenueScopedPreview: false,
    isLockedSnapshot: true,
    consignorRentOffsets: Number(lock.breakdown?.consignorRentOffset ?? 0),
    netBoothRentForCoop,
    techOps,
    supplies,
    carriedOverShortfall,
    shortfallRepaid: Number(lock.breakdown?.shortfallRepaid ?? 0),
    remainingShortfall: Number(lock.breakdown?.remainingShortfall ?? 0),
    totalCommonsOverhead,
    commonsNetBalance,
    excessSurplus: Number(lock.totals?.excessSurplus ?? 0),
    isCommonsFullyCovered: commonsNetBalance >= 0,
    distributablePartnerBonusPool: Number(lock.totals?.partnerBonusPool ?? 0),
    salesPatronagePool: Number(lock.breakdown?.salesPatronagePool ?? 0),
    laborBonusPool: Number(lock.breakdown?.laborBountyPool ?? 0),
    reserveAddition: Number(lock.totals?.reserveAdded ?? 0),
    newReserveBalance: Number(lock.breakdown?.newReserveBalance ?? 0),
    breakevenProgressPct:
      totalCommonsOverhead > 0
        ? Math.min(100, Math.round((totalCommonsPool / totalCommonsOverhead) * 100))
        : 100,
    memoryDenNetCheck: fromCents(toCents(totalStorePayout) - toCents(boothRent)),
    mondragonStatus: lock.breakdown?.mondragonStatus || {
      isMondragon104545: false,
      effectiveHourlyDividendRate: 0,
      payRatioActual: 1,
      payRatioCap: 4.5,
      isPayRatioCompliant: true,
      noHoursBonusRows: [],
      totalIcaRetained: 0,
      totalCashBonusPaid: Number(lock.totals?.partnerBonusPool ?? 0),
      hasZeroLaborPresetWarning: false,
    },
  };

  return {
    rows,
    summary,
    engineResult: {
      operatingBreakeven: Number(lock.totals?.operatingBreakeven ?? 0),
      partners: rows,
      excessSurplus: summary.excessSurplus,
      reserveAdded: summary.reserveAddition,
      partnerBonusPool: summary.distributablePartnerBonusPool,
      warnings: [],
      breakdown: lock.breakdown,
    },
    laborApproval,
    approvedMemberShares,
    allMemberShares: approvedMemberShares,
    unassignedReimbursements: [],
    zeroSaleBoothWarnings: [],
    warnings: [],
  };
}

function buildSingleMonthSettlement(
  inputs: BuildMonthlySettlementInputs,
  monthKey: string,
  shortfallOverride?: number
): BuiltMonthlySettlementBundle {
  const {
    policyConfig,
    surplusPolicyMode,
    surplusSplitBasis,
    warehouses = [],
    expenses = [],
    laborEntries = [],
    teamPartnerPrefixes = [],
    defaultUpcPrefix = 'HUCK-',
  } = inputs;

  const locationFilter = inputs.location || 'all';
  const isVenueScopedPreview = locationFilter !== 'all';
  const targetVenueCode = isVenueScopedPreview
    ? resolveCanonicalLocationCode(locationFilter, warehouses) || locationFilter.toUpperCase()
    : 'all';

  const currentPacMonth = inputs.currentPacificMonth || currentPacificMonthKey();
  const isMonthInProgress = monthKey === currentPacMonth;

  // 1. Filter & deduplicate sales for this Pacific month (Law 7)
  const seenSaleIds = new Set<string>();
  const monthSales = (inputs.sales || []).filter((s) => {
    if (!s || s.status === 'Cancelled' || !s.date) return false;
    if (pacificMonthKey(s.date) !== monthKey) return false;

    if (isVenueScopedPreview) {
      const saleLoc = resolveSaleLocationCode(s, warehouses);
      if (saleLoc !== targetVenueCode) return false;
    }

    if (s.id) {
      if (seenSaleIds.has(s.id)) return false;
      seenSaleIds.add(s.id);
    }
    return true;
  });

  // 2. Resolve live booth rent & zero-sale booth warnings (§5 item 14, Law 2)
  const allLocMetas = getAllLocationSettingMetas(warehouses);
  const boothMetas = allLocMetas.filter((m) => Number(m.monthlyRent) > 0);
  const zeroSaleBoothWarnings: string[] = [];

  let grossBoothRent = 0;
  if (!isMonthInProgress) {
    if (isVenueScopedPreview) {
      const venueMeta = getLocationSettingMeta(targetVenueCode, warehouses);
      if (monthSales.length > 0) {
        grossBoothRent = Number(venueMeta?.monthlyRent ?? inputs.monthlyRentFallback ?? 0);
      } else if (venueMeta && Number(venueMeta.monthlyRent) > 0) {
        zeroSaleBoothWarnings.push(
          `${venueMeta.name} ($${Number(venueMeta.monthlyRent).toFixed(2)}/mo) has 0 recorded sales in ${monthKeyToLabel(monthKey)} — rent not auto-billed.`
        );
      }
    } else {
      const activeVenueCodes = new Set<string>();
      for (const s of monthSales) {
        const code = resolveSaleLocationCode(s, warehouses);
        if (code) activeVenueCodes.add(code);
      }
      let summedRentCents = 0;
      for (const meta of boothMetas) {
        if (activeVenueCodes.has(meta.code)) {
          summedRentCents += toCents(meta.monthlyRent);
        } else {
          zeroSaleBoothWarnings.push(
            `${meta.name} ($${Number(meta.monthlyRent).toFixed(2)}/mo) has 0 recorded sales in ${monthKeyToLabel(monthKey)} — rent not auto-billed.`
          );
        }
      }
      if (summedRentCents > 0) {
        grossBoothRent = fromCents(summedRentCents);
      } else if (monthSales.length > 0 && Number(inputs.monthlyRentFallback) > 0) {
        grossBoothRent = Number(inputs.monthlyRentFallback);
      }
    }
  }

  // 3. Expenses & member-keyed reimbursements (§5 item 21, Law 7)
  const monthSharedExpenses = isVenueScopedPreview
    ? []
    : expenses.filter((exp) => {
        if (!exp || exp.status === 'rejected' || exp.scope === 'personal_write_off') return false;
        if (expenseMonthKey(exp.date) !== monthKey) return false;
        return Number(exp.coopSharedAmount ?? exp.amount ?? 0) > 0;
      });

  let techOpsCents = 0;
  let suppliesCents = 0;
  const orgReimbursementCents = new Map<string, number>();
  const sweatReimbursementCents = new Map<string, { displayName: string; cents: number }>();
  const unassignedReimbursements: UnassignedReimbursementNotice[] = [];

  for (const exp of monthSharedExpenses) {
    if (isRentOrMallFeeExpense(exp)) continue;
    const amtCents = Math.max(0, toCents(exp.coopSharedAmount ?? exp.amount ?? 0));
    if (amtCents <= 0) continue;

    if (isTechOpsExpense(exp)) {
      techOpsCents += amtCents;
    } else {
      suppliesCents += amtCents;
    }

    const rawPartner = String(exp.partner || '').trim();
    const normPrefix = rawPartner ? normalizeOrgPrefix(rawPartner) : '';
    const isConsignorOwner = normPrefix
      ? Boolean(findConsignorAgreement(policyConfig.consignors, normPrefix))
      : false;

    if (isConsignorOwner) {
      unassignedReimbursements.push({
        owner: exp.member || rawPartner,
        partner: normPrefix,
        amount: fromCents(amtCents),
        description: exp.description || exp.category,
      });
      continue;
    }

    if (normPrefix === 'SWEAT-' || /^sweat$/i.test(rawPartner)) {
      const rawMember = String(exp.member || '').trim();
      const rosterMatch = policyConfig.members.find(
        (m) => m.name.trim().toLowerCase() === rawMember.toLowerCase()
      );
      if (!rawMember) {
        unassignedReimbursements.push({
          owner: 'Unnamed SWEAT Worker',
          partner: 'SWEAT-',
          amount: fromCents(amtCents),
          description: exp.description || exp.category,
        });
      } else {
        const canonicalName = rosterMatch?.name || rawMember;
        const key = canonicalName.toLowerCase();
        const prev = sweatReimbursementCents.get(key);
        sweatReimbursementCents.set(key, {
          displayName: canonicalName,
          cents: (prev?.cents || 0) + amtCents,
        });
      }
      continue;
    }

    const knownOrgPrefixes = new Set<string>(['HUCK-', 'PDXGL-']);
    for (const m of policyConfig.members) {
      if (m.inventoryPrefix) knownOrgPrefixes.add(normalizeOrgPrefix(m.inventoryPrefix));
    }
    for (const p of teamPartnerPrefixes || []) {
      const pStr = normalizeOrgPrefix(typeof p === 'string' ? p : p?.prefix);
      if (pStr) knownOrgPrefixes.add(pStr);
    }

    if (normPrefix && knownOrgPrefixes.has(normPrefix)) {
      orgReimbursementCents.set(
        normPrefix,
        (orgReimbursementCents.get(normPrefix) || 0) + amtCents
      );
    } else {
      unassignedReimbursements.push({
        owner: exp.member || rawPartner || 'Unassigned',
        partner: normPrefix || 'UNASSIGNED',
        amount: fromCents(amtCents),
        description: exp.description || exp.category,
      });
    }
  }

  // 4. Labor eligibility & summaries (§5 items 24–25 & §6)
  const eligibleLabor = (laborEntries || []).filter(
    (entry) => isSettlementEligibleLabor(entry) && laborEntryMonthKey(entry.date) === monthKey
  );
  const laborApproval = summarizeLaborApproval(laborEntries || [], monthKey);
  const approvedMemberShares = getLaborHoursByMemberForMonth(
    eligibleLabor,
    monthKey,
    policyConfig.members,
    { status: 'approved' }
  );
  const allMemberShares = getLaborHoursByMemberForMonth(
    laborEntries || [],
    monthKey,
    policyConfig.members,
    { status: 'all' }
  );
  const approvedPartnerHours = getLaborHoursByPartnerForMonth(laborEntries || [], monthKey, {
    status: 'approved',
  });
  const pendingPartnerHours = getLaborHoursByPartnerForMonth(laborEntries || [], monthKey, {
    status: 'pending',
  });

  // 5. Aggregate sales into org buckets (exact integer cents)
  const curatorRatio = Number(policyConfig.curatorSharePct) / 100;
  const commonsRatio = Number(policyConfig.commonsSharePct) / 100;

  // Index active Co-Curation records (unlocked months only — buildFromLockedSnapshot handles locked months)
  const coCurationByUpc = new Map<string, CoCurationRecord>();
  const coCurationByItemId = new Map<string, CoCurationRecord>();
  const coCurationBySoldSaleId = new Map<string, CoCurationRecord>();
  if (!isVenueScopedPreview && Array.isArray(inputs.coCurationRecords)) {
    for (const rec of inputs.coCurationRecords) {
      if (!rec || rec.mode === 'self_listed') continue;
      if (rec.status !== 'listed' && rec.status !== 'sold') continue;
      if (rec.upc) coCurationByUpc.set(rec.upc.trim().toUpperCase(), rec);
      if (rec.itemId) coCurationByItemId.set(rec.itemId.trim(), rec);
      if (rec.soldSaleId) coCurationBySoldSaleId.set(rec.soldSaleId.trim(), rec);
    }
  }
  const sweatCoCuratedProfitCents = new Map<string, { displayName: string; cents: number }>();

  interface MutableOrgGroup {
    prefix: string;
    name: string;
    isConsignor: boolean;
    isCommonsPool: boolean;
    items: SettlementSaleItem[];
    grossCents: number;
    venueFeeCents: number;
    costRecoupCents: number;
    unrecoupedCostCents: number;
    netMarginCents: number;
    baseProfitCents: number;
    commonsTakeCents: number;
  }

  const orgGroups = new Map<string, MutableOrgGroup>();

  const ensureOrgGroup = (prefix: string): MutableOrgGroup => {
    let grp = orgGroups.get(prefix);
    if (!grp) {
      const consignor = findConsignorAgreement(policyConfig.consignors, prefix);
      grp = {
        prefix,
        name: resolvePartnerDisplayName(prefix, policyConfig, teamPartnerPrefixes),
        isConsignor: Boolean(consignor),
        isCommonsPool: prefix === 'COMMONS-',
        items: [],
        grossCents: 0,
        venueFeeCents: 0,
        costRecoupCents: 0,
        unrecoupedCostCents: 0,
        netMarginCents: 0,
        baseProfitCents: 0,
        commonsTakeCents: 0,
      };
      orgGroups.set(prefix, grp);
    }
    return grp;
  };

  for (const sale of monthSales) {
    const prefix = resolveSalePartnerPrefix(sale, teamPartnerPrefixes, defaultUpcPrefix);
    const grp = ensureOrgGroup(prefix);

    const grossCents = Math.max(0, toCents(sale.grossAmount || 0));
    const netDepositCents =
      sale.netPayout !== undefined
        ? toCents(sale.netPayout)
        : grossCents - Math.max(0, toCents(sale.fees ?? 0));
    const venueFeeCents =
      sale.fees !== undefined
        ? Math.max(0, toCents(sale.fees))
        : Math.max(0, grossCents - netDepositCents);

    let effectiveRecoupCents = 0;
    let unrecoupedCents = 0;
    let netSurplusCents = 0;
    let baseProfitCents = 0;
    let commonsTakeCents = 0;
    let curatorTakeCents = 0;
    let coCurationLabel: string | undefined;
    let coCurationTransferOut: number | undefined;
    let pendingListerTransfer: { rec: CoCurationRecord; cents: number } | null = null;
    const shippingCents =
      grp.isConsignor || grp.isCommonsPool ? 0 : Math.max(0, toCents(sale.shippingCost || 0));

    if (grp.isCommonsPool) {
      netSurplusCents = Math.max(0, netDepositCents);
      commonsTakeCents = netSurplusCents;
      curatorTakeCents = 0;
    } else if (grp.isConsignor) {
      netSurplusCents = Math.max(0, netDepositCents);
      curatorTakeCents = Math.max(0, netDepositCents);
      commonsTakeCents = 0;
    } else {
      const itemCostCents = Math.max(0, toCents(sale.cost || 0));
      const saleUpcUpper = String(sale.upc || sale.sku || '').trim().toUpperCase();
      const saleItemId = String(sale.itemId || '').trim();
      const saleIdStr = String(sale.id || sale.$id || '').trim();
      const saleYmd = extractSaleCalendarYmd(sale.date);

      const candidateCoCur =
        (saleIdStr && coCurationBySoldSaleId.get(saleIdStr)) ||
        (saleItemId && coCurationByItemId.get(saleItemId)) ||
        (saleUpcUpper && coCurationByUpc.get(saleUpcUpper)) ||
        null;

      const activeCoCur =
        candidateCoCur &&
        saleYmd &&
        candidateCoCur.claimedAt &&
        candidateCoCur.claimedAt <= saleYmd
          ? candidateCoCur
          : null;

      if (activeCoCur) {
        const splitRes = computeCoCurationSplitCents({
          netDepositCents,
          itemCostCents,
          shippingCents,
          commonsRatio,
          mode: activeCoCur.mode,
          transferFloorCents: Math.round(Number(activeCoCur.transferFloorPrice || 0) * 100),
        });
        effectiveRecoupCents = splitRes.effectiveRecoupCents;
        unrecoupedCents = splitRes.unrecoupedCents;
        netSurplusCents = splitRes.netSurplusCents;
        commonsTakeCents = splitRes.commonsTakeCents;

        const normListerPrefix = normalizeOrgPrefix(activeCoCur.listerPrefix);
        if (normListerPrefix === grp.prefix) {
          // Same-org pair: net-zero within org bucket; attach memo-only attribution
          baseProfitCents = splitRes.ogBaseProfitCents + splitRes.listerTransferCents;
          curatorTakeCents = effectiveRecoupCents + baseProfitCents;
          coCurationLabel = `🤝 Co-curated w/ ${activeCoCur.listerName} ($${fromCents(splitRes.listerTransferCents).toFixed(2)} internal share)`;
        } else {
          baseProfitCents = splitRes.ogBaseProfitCents;
          curatorTakeCents = effectiveRecoupCents + baseProfitCents;
          coCurationTransferOut = fromCents(splitRes.listerTransferCents);
          coCurationLabel = `🤝 Co-curated by ${activeCoCur.listerName} (${normListerPrefix} +$${fromCents(splitRes.listerTransferCents).toFixed(2)})`;
          if (splitRes.listerTransferCents > 0) {
            pendingListerTransfer = {
              rec: activeCoCur,
              cents: splitRes.listerTransferCents,
            };
          }
        }
      } else {
        const rawCostCents = itemCostCents + shippingCents;
        if (netDepositCents < rawCostCents) {
          effectiveRecoupCents = Math.max(0, netDepositCents);
          unrecoupedCents = rawCostCents - effectiveRecoupCents;
          netSurplusCents = 0;
          commonsTakeCents = 0;
          baseProfitCents = 0;
          curatorTakeCents = effectiveRecoupCents;
        } else {
          effectiveRecoupCents = rawCostCents;
          unrecoupedCents = 0;
          netSurplusCents = netDepositCents - rawCostCents;
          commonsTakeCents = Math.round(netSurplusCents * commonsRatio);
          baseProfitCents = netSurplusCents - commonsTakeCents;
          curatorTakeCents = effectiveRecoupCents + baseProfitCents;
        }
      }
    }

    grp.items.push({
      date: String(sale.date || ''),
      sku: String(sale.sku || sale.upc || sale.soNumber || 'N/A'),
      ticketNumber: sale.ticketNumber ? String(sale.ticketNumber) : undefined,
      title: String(sale.title || 'Sold Item'),
      grossPrice: fromCents(grossCents),
      venueFee: fromCents(venueFeeCents),
      costBasis: fromCents(effectiveRecoupCents),
      shippingCost: shippingCents > 0 ? fromCents(shippingCents) : undefined,
      netSurplus: fromCents(netSurplusCents),
      curatorTake: fromCents(curatorTakeCents),
      unrecoupedCost: unrecoupedCents > 0 ? fromCents(unrecoupedCents) : undefined,
      coCurationLabel,
      coCurationTransferOut,
      rawSale: sale,
    });

    grp.grossCents += grossCents;
    grp.venueFeeCents += venueFeeCents;
    grp.costRecoupCents += effectiveRecoupCents;
    grp.unrecoupedCostCents += unrecoupedCents;
    grp.netMarginCents += netSurplusCents;
    grp.baseProfitCents += baseProfitCents;
    grp.commonsTakeCents += commonsTakeCents;

    if (pendingListerTransfer) {
      const listerPref = normalizeOrgPrefix(pendingListerTransfer.rec.listerPrefix);
      if (listerPref === 'SWEAT-') {
        const rawName = String(pendingListerTransfer.rec.listerName || 'Sweat-Equity Member').trim();
        const rosterMatch = policyConfig.members.find(
          (m) => m.name.trim().toLowerCase() === rawName.toLowerCase()
        );
        const canonicalName = rosterMatch?.name || rawName;
        const lowerKey = canonicalName.toLowerCase();
        const prev = sweatCoCuratedProfitCents.get(lowerKey);
        sweatCoCuratedProfitCents.set(lowerKey, {
          displayName: canonicalName,
          cents: (prev?.cents || 0) + pendingListerTransfer.cents,
        });
      } else if (listerPref) {
        const listerGrp = ensureOrgGroup(listerPref);
        if (!listerGrp.isConsignor && !listerGrp.isCommonsPool) {
          listerGrp.baseProfitCents += pendingListerTransfer.cents;
        }
      }
    }
  }

  // Inject 0-sale org rows when they have approved/pending labor or shared reimbursements (All Venues only)
  if (!isVenueScopedPreview) {
    if (
      !orgGroups.has('HUCK-') &&
      (approvedPartnerHours.HUCK > 0 ||
        pendingPartnerHours.HUCK > 0 ||
        (orgReimbursementCents.get('HUCK-') || 0) > 0)
    ) {
      ensureOrgGroup('HUCK-');
    }
    if (
      !orgGroups.has('PDXGL-') &&
      (approvedPartnerHours.PDXGL > 0 ||
        pendingPartnerHours.PDXGL > 0 ||
        (orgReimbursementCents.get('PDXGL-') || 0) > 0)
    ) {
      ensureOrgGroup('PDXGL-');
    }
    for (const [orgPrefix, cents] of orgReimbursementCents.entries()) {
      if (cents > 0 && !orgGroups.has(orgPrefix)) {
        ensureOrgGroup(orgPrefix);
      }
    }
  }

  const totalGrossAllCents = Array.from(orgGroups.values()).reduce(
    (sum, g) => sum + g.grossCents,
    0
  );

  // Build PartnerSummary inputs for runCoopSettlement
  const engineInputs: PartnerSummary[] = [];
  const rowMetaMap = new Map<
    string,
    {
      approvedByNames: string[];
      latestApprovedAt?: string;
      deliverableRefs: string[];
    }
  >();

  for (const grp of orgGroups.values()) {
    const rowKey = `ORG::${grp.prefix}`;
    const grossRatio = totalGrossAllCents > 0 ? grp.grossCents / totalGrossAllCents : 0;

    if (grp.isConsignor) {
      const agreement = findConsignorAgreement(policyConfig.consignors, grp.prefix)!;
      const netDeposit = fromCents(Math.max(0, grp.grossCents - grp.venueFeeCents));
      const consignorRes = calculateConsignorSettlement({
        agreement,
        netStoreDeposit: netDeposit,
        grossRatio,
        boothRent: grossBoothRent,
        isMonthInProgress,
      });

      engineInputs.push({
        rowKey,
        partnerCode: grp.prefix,
        partnerName: grp.name,
        role: 'Consignor',
        isConsignor: true,
        itemsSold: grp.items.length,
        grossSales: fromCents(grp.grossCents),
        venueFee: fromCents(grp.venueFeeCents),
        costRecoup: 0,
        baseProfit70: consignorRes.payout,
        commons30: consignorRes.coopCommission,
        frontedReimbursement: 0,
        consignorRentDeducted: consignorRes.rentDeduction,
        coopCommission: consignorRes.coopCommission,
        dealMode: agreement.mode,
        dealFormulaLabel: consignorRes.formulaLabel,
        laborHoursLogged: 0,
        pendingLaborHours: 0,
        laborBountyWeight: 0,
        items: grp.items,
        finalPayoutCheck: consignorRes.payout,
      });
      continue;
    }

    if (grp.isCommonsPool) {
      engineInputs.push({
        rowKey,
        partnerCode: grp.prefix,
        partnerName: grp.name,
        role: 'Commons Pool',
        isCommonsPool: true,
        itemsSold: grp.items.length,
        grossSales: fromCents(grp.grossCents),
        venueFee: fromCents(grp.venueFeeCents),
        costRecoup: 0,
        baseProfit70: 0,
        commons30: fromCents(grp.commonsTakeCents),
        frontedReimbursement: 0,
        laborHoursLogged: 0,
        pendingLaborHours: 0,
        laborBountyWeight: 0,
        items: grp.items,
        finalPayoutCheck: 0,
      });
      continue;
    }

    const orgKey = grp.prefix.replace(/[-_]+$/, '').toUpperCase();
    const orgMemberShares = allMemberShares.filter((m) => m.partner === orgKey);
    const orgApprovedLogs = orgMemberShares.flatMap((m) => m.entries);
    const orgDeliverableRefs = Array.from(
      new Set(orgMemberShares.flatMap((m) => m.deliverableRefs))
    );
    const orgApprovedBy = Array.from(
      new Set(orgMemberShares.flatMap((m) => m.approvedByNames))
    );
    const latestApp = orgMemberShares
      .map((m) => m.latestApprovedAt)
      .filter(Boolean)
      .sort()
      .pop();

    const approvedHrs = isVenueScopedPreview
      ? 0
      : orgKey === 'HUCK'
        ? approvedPartnerHours.HUCK
        : orgKey === 'PDXGL'
          ? approvedPartnerHours.PDXGL
          : 0;
    const pendingHrs = isVenueScopedPreview
      ? 0
      : orgKey === 'HUCK'
        ? pendingPartnerHours.HUCK
        : orgKey === 'PDXGL'
          ? pendingPartnerHours.PDXGL
          : 0;

    const reimbCents = isVenueScopedPreview
      ? 0
      : orgReimbursementCents.get(grp.prefix) || 0;

    rowMetaMap.set(rowKey, {
      approvedByNames: orgApprovedBy,
      latestApprovedAt: latestApp,
      deliverableRefs: orgDeliverableRefs,
    });

    engineInputs.push({
      rowKey,
      partnerCode: grp.prefix,
      partnerName: grp.name,
      role: 'Co-op Partner',
      itemsSold: grp.items.length,
      grossSales: fromCents(grp.grossCents),
      venueFee: fromCents(grp.venueFeeCents),
      costRecoup: fromCents(grp.costRecoupCents),
      unrecoupedCost: fromCents(grp.unrecoupedCostCents),
      netMargin: fromCents(grp.netMarginCents),
      baseProfit70: fromCents(grp.baseProfitCents),
      commons30: fromCents(grp.commonsTakeCents),
      frontedReimbursement: fromCents(reimbCents),
      laborHoursLogged: approvedHrs,
      pendingLaborHours: pendingHrs,
      deliverableCount: orgDeliverableRefs.length,
      laborBountyWeight: approvedHrs,
      laborLogs: orgApprovedLogs,
      items: grp.items,
      finalPayoutCheck: fromCents(
        grp.costRecoupCents + grp.baseProfitCents + reimbCents
      ),
    });
  }

  // 6. Inject individual SWEAT- worker rows (All Venues only — §5 item 22)
  if (!isVenueScopedPreview) {
    const sweatWorkerKeys = new Set<string>();
    const sweatShareByLower = new Map<string, MemberLaborShareSummary>();
    for (const share of allMemberShares) {
      if (share.partner === 'SWEAT') {
        const k = share.member.trim().toLowerCase();
        sweatWorkerKeys.add(k);
        sweatShareByLower.set(k, share);
      }
    }
    for (const k of sweatReimbursementCents.keys()) {
      sweatWorkerKeys.add(k);
    }
    for (const k of sweatCoCuratedProfitCents.keys()) {
      sweatWorkerKeys.add(k);
    }

    for (const lowerName of sweatWorkerKeys) {
      const share = sweatShareByLower.get(lowerName);
      const reimbEntry = sweatReimbursementCents.get(lowerName);
      const coCurEntry = sweatCoCuratedProfitCents.get(lowerName);
      const displayName =
        share?.member || reimbEntry?.displayName || coCurEntry?.displayName || 'Sweat-Equity Worker';
      const approvedHrs = share?.approvedHours || 0;
      const pendingHrs = share?.pendingHours || 0;
      const reimbCents = reimbEntry?.cents || 0;
      const coCurProfitCents = coCurEntry?.cents || 0;

      if (approvedHrs <= 0 && pendingHrs <= 0 && reimbCents <= 0 && coCurProfitCents <= 0) continue;

      const rowKey = `SWEAT::${displayName}`;
      rowMetaMap.set(rowKey, {
        approvedByNames: share?.approvedByNames || [],
        latestApprovedAt: share?.latestApprovedAt,
        deliverableRefs: share?.deliverableRefs || [],
      });

      engineInputs.push({
        rowKey,
        partnerCode: 'SWEAT-',
        partnerName: displayName,
        memberName: displayName,
        role: 'Marketing & Social Enabler',
        isSweatEnabler: true,
        itemsSold: 0,
        grossSales: 0,
        venueFee: 0,
        costRecoup: 0,
        unrecoupedCost: 0,
        netMargin: 0,
        baseProfit70: fromCents(coCurProfitCents),
        commons30: 0,
        frontedReimbursement: fromCents(reimbCents),
        laborHoursLogged: approvedHrs,
        pendingLaborHours: pendingHrs,
        deliverableCount: share?.deliverableCount || 0,
        laborBountyWeight: approvedHrs,
        laborLogs: share?.entries || [],
        items: [],
        finalPayoutCheck: fromCents(reimbCents + coCurProfitCents),
      });
    }
  }

  const effectiveShortfall =
    shortfallOverride !== undefined
      ? shortfallOverride
      : Number(policyConfig.carriedOverShortfall || 0);

  // 7. Run pure 4-Gate engine (in venue-scoped preview, suppress Gate 4B pool via reserve_100 / 0 surplus)
  const rawEngineResult = runCoopSettlement(engineInputs, {
    curatorSplitRate: curatorRatio,
    commonsSplitRate: commonsRatio,
    grossRent: grossBoothRent,
    techOps: fromCents(techOpsCents),
    supplies: fromCents(suppliesCents),
    carriedOverShortfall: isVenueScopedPreview ? 0 : effectiveShortfall,
    reserveBalance: Number(policyConfig.currentReserveBalance || 0),
    reserveCap: Number(policyConfig.reserveCapTarget || 0),
    isMonthInProgress,
    surplusPolicyMode,
    surplusSplitBasis,
    sweatSalesPoolMode: policyConfig.sweatSalesPoolMode || 'labor_only',
    reserveSharePct: Number(policyConfig.reserveSharePct ?? 10),
    salesPatronagePct: Number(policyConfig.salesPatronagePct ?? 60),
    laborPatronagePct: Number(policyConfig.laborPatronagePct ?? 30),
    icaRetainedPct: Number(policyConfig.icaRetainedPct ?? 0),
    icaAnnualYieldRatePct: Number(policyConfig.icaAnnualYieldRatePct ?? 7),
    payRatioCapStandard: Number(policyConfig.payRatioCapStandard ?? 4.5),
  });

  // §5 item 22: Venue-scoped preview settles Gates 1–3 ONLY; Gate 4B / ICA / SWEAT bonuses are omitted
  const finalPartners = rawEngineResult.partners.map((p) => {
    const meta = rowMetaMap.get(p.rowKey);
    if (!isVenueScopedPreview) {
      return enrichPartnerSummaryRow(p, {
        approvedByNames: meta?.approvedByNames,
        latestApprovedAt: meta?.latestApprovedAt,
        deliverableRefs: meta?.deliverableRefs,
      });
    }
    const baseOnlyCheck = p.isConsignor
      ? p.finalPayoutCheck
      : p.isCommonsPool
        ? 0
        : fromCents(
            toCents(p.costRecoup) +
              toCents(p.baseProfit70) +
              toCents(p.frontedReimbursement)
          );
    return enrichPartnerSummaryRow(
      {
        ...p,
        salesPatronageBonus: 0,
        laborBountyBonus: 0,
        totalBonusDividend: 0,
        icaRetainedCredit: 0,
        cashBonusPaid: 0,
        projectedAnnualIcaYield: 0,
        finalPayoutCheck: baseOnlyCheck,
      },
      {
        approvedByNames: meta?.approvedByNames,
        latestApprovedAt: meta?.latestApprovedAt,
        deliverableRefs: meta?.deliverableRefs,
      }
    );
  });

  const totalGross = fromCents(finalPartners.reduce((s, p) => s + toCents(p.grossSales), 0));
  const totalVenueFee = fromCents(finalPartners.reduce((s, p) => s + toCents(p.venueFee), 0));
  const totalStorePayout = fromCents(toCents(totalGross) - toCents(totalVenueFee));
  const totalCostBasis = fromCents(finalPartners.reduce((s, p) => s + toCents(p.costRecoup), 0));
  const totalUnrecoupedCost = fromCents(
    finalPartners.reduce((s, p) => s + toCents(p.unrecoupedCost ?? 0), 0)
  );
  const totalNetSurplus = fromCents(
    finalPartners.reduce((s, p) => s + toCents(p.netMargin ?? 0), 0)
  );
  const totalCuratorPayouts = fromCents(
    finalPartners.reduce((s, p) => s + toCents(p.finalPayoutCheck), 0)
  );
  const totalCommonsPool = rawEngineResult.breakdown.totalCommonsCollected;
  const boothRent = rawEngineResult.breakdown.grossRent;
  const consignorRentOffsets = rawEngineResult.breakdown.consignorRentOffset;
  const netBoothRentForCoop = rawEngineResult.breakdown.netRent;
  const techOps = rawEngineResult.breakdown.techOps;
  const supplies = rawEngineResult.breakdown.supplies;
  const carriedOverShortfallUsed =
    isMonthInProgress || isVenueScopedPreview ? 0 : Math.max(0, effectiveShortfall);
  const totalCommonsOverhead = fromCents(
    toCents(netBoothRentForCoop) +
      toCents(techOps) +
      toCents(supplies) +
      toCents(carriedOverShortfallUsed)
  );
  const commonsNetBalance = fromCents(toCents(totalCommonsPool) - toCents(totalCommonsOverhead));

  const distributablePartnerBonusPool = isVenueScopedPreview
    ? 0
    : rawEngineResult.partnerBonusPool;
  const salesPatronagePool = isVenueScopedPreview
    ? 0
    : rawEngineResult.breakdown.salesPatronagePool;
  const laborBonusPool = isVenueScopedPreview
    ? 0
    : rawEngineResult.breakdown.laborBountyPool;
  const reserveAddition = isVenueScopedPreview ? 0 : rawEngineResult.reserveAdded;

  const summary: BuiltSettlementSummary = {
    totalGross,
    totalVenueFee,
    venueFeePct:
      totalGross > 0 ? Number(((totalVenueFee / totalGross) * 100).toFixed(1)) : 0,
    totalStorePayout,
    totalCostBasis,
    totalUnrecoupedCost,
    totalNetSurplus,
    totalCuratorPayouts,
    totalCommonsPool,
    boothRent,
    isMonthInProgress,
    isVenueScopedPreview,
    isLockedSnapshot: false,
    consignorRentOffsets,
    netBoothRentForCoop,
    techOps,
    supplies,
    carriedOverShortfall: carriedOverShortfallUsed,
    shortfallRepaid: isVenueScopedPreview ? 0 : rawEngineResult.breakdown.shortfallRepaid,
    remainingShortfall: isVenueScopedPreview
      ? 0
      : rawEngineResult.breakdown.remainingShortfall,
    totalCommonsOverhead,
    commonsNetBalance,
    excessSurplus: isVenueScopedPreview ? 0 : rawEngineResult.excessSurplus,
    isCommonsFullyCovered: commonsNetBalance >= 0,
    distributablePartnerBonusPool,
    salesPatronagePool,
    laborBonusPool,
    reserveAddition,
    newReserveBalance: isVenueScopedPreview
      ? Number(policyConfig.currentReserveBalance || 0)
      : rawEngineResult.breakdown.newReserveBalance,
    breakevenProgressPct:
      totalCommonsOverhead > 0
        ? Math.min(100, Math.round((totalCommonsPool / totalCommonsOverhead) * 100))
        : 100,
    memoryDenNetCheck: fromCents(toCents(totalStorePayout) - toCents(boothRent)),
    mondragonStatus: rawEngineResult.breakdown.mondragonStatus,
  };

  return {
    rows: finalPartners,
    summary,
    engineResult: rawEngineResult,
    laborApproval,
    approvedMemberShares,
    allMemberShares,
    unassignedReimbursements,
    zeroSaleBoothWarnings,
    warnings: [...rawEngineResult.warnings, ...zeroSaleBoothWarnings],
  };
}

/**
 * Canonical entry point for `/coop/settlements` (§2, §5 items 11 & 22, §6, §7.5).
 * - Single month (`YYYY-MM`): runs locked snapshot if month is locked (on All Venues), otherwise runs live month.
 * - All-Time (`'all'`): runs per Pacific month bucket chronologically and sums monthly results!
 */
export function buildMonthlySettlementFromInputs(
  inputs: BuildMonthlySettlementInputs
): BuiltMonthlySettlementBundle {
  const period = inputs.period || 'all';
  const location = inputs.location || 'all';

  if (period !== 'all') {
    const locked =
      location === 'all' ? inputs.lockedSnapshotsByMonth?.[period] : undefined;
    if (locked && locked.status === 'locked') {
      return buildSettlementBundleFromLockSnapshot(locked);
    }
    return buildSingleMonthSettlement(inputs, period);
  }

  // Collect all distinct YYYY-MM buckets across sales, labor, expenses & locked months (§5 item 11)
  const monthSet = new Set<string>();
  for (const s of inputs.sales || []) {
    if (!s || s.status === 'Cancelled' || !s.date) continue;
    const mk = pacificMonthKey(s.date);
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(mk)) monthSet.add(mk);
  }
  if (location === 'all') {
    for (const l of inputs.laborEntries || []) {
      const mk = laborEntryMonthKey(l?.date);
      if (mk) monthSet.add(mk);
    }
    for (const e of inputs.expenses || []) {
      if (!e || e.status === 'rejected' || e.scope === 'personal_write_off') continue;
      const mk = expenseMonthKey(e.date);
      if (mk) monthSet.add(mk);
    }
    for (const mk of Object.keys(inputs.lockedSnapshotsByMonth || {})) {
      if (/^\d{4}-(0[1-9]|1[0-2])$/.test(mk)) monthSet.add(mk);
    }
  }

  const chronologicalMonths = Array.from(monthSet).sort();
  if (chronologicalMonths.length === 0) {
    return buildSingleMonthSettlement(
      inputs,
      inputs.currentPacificMonth || currentPacificMonthKey(),
      0
    );
  }

  // Run per-month settlement chronologically, carrying unpaid shortfall forward month-to-month
  let runningShortfall = 0;
  const monthlyBundles: Array<{ monthKey: string; bundle: BuiltMonthlySettlementBundle }> = [];

  for (const mk of chronologicalMonths) {
    const locked =
      location === 'all' ? inputs.lockedSnapshotsByMonth?.[mk] : undefined;
    if (locked && locked.status === 'locked') {
      const b = buildSettlementBundleFromLockSnapshot(locked);
      runningShortfall = b.summary.remainingShortfall;
      monthlyBundles.push({ monthKey: mk, bundle: b });
    } else {
      const b = buildSingleMonthSettlement(inputs, mk, runningShortfall);
      runningShortfall = b.summary.isMonthInProgress
        ? runningShortfall
        : b.summary.remainingShortfall;
      monthlyBundles.push({ monthKey: mk, bundle: b });
    }
  }

  // Merge partner rows across all months by rowKey
  const mergedRowsMap = new Map<string, EnrichedPartnerSettlement>();
  const allUnassigned: UnassignedReimbursementNotice[] = [];
  const allZeroSaleWarnings: string[] = [];
  const allWarnings: string[] = [];

  let sumGrossCents = 0;
  let sumVenueFeeCents = 0;
  let sumCostBasisCents = 0;
  let sumUnrecoupedCents = 0;
  let sumNetSurplusCents = 0;
  let sumCuratorPayoutsCents = 0;
  let sumCommonsPoolCents = 0;
  let sumBoothRentCents = 0;
  let sumConsignorRentCents = 0;
  let sumNetRentCents = 0;
  let sumTechOpsCents = 0;
  let sumSuppliesCents = 0;
  let sumShortfallRepaidCents = 0;
  let sumExcessSurplusCents = 0;
  let sumBonusPoolCents = 0;
  let sumSalesPoolCents = 0;
  let sumLaborPoolCents = 0;
  let sumReserveAddCents = 0;
  let sumIcaRetainedCents = 0;
  let sumCashBonusCents = 0;

  for (const { monthKey, bundle } of monthlyBundles) {
    const s = bundle.summary;
    sumGrossCents += toCents(s.totalGross);
    sumVenueFeeCents += toCents(s.totalVenueFee);
    sumCostBasisCents += toCents(s.totalCostBasis);
    sumUnrecoupedCents += toCents(s.totalUnrecoupedCost);
    sumNetSurplusCents += toCents(s.totalNetSurplus);
    sumCuratorPayoutsCents += toCents(s.totalCuratorPayouts);
    sumCommonsPoolCents += toCents(s.totalCommonsPool);
    sumBoothRentCents += toCents(s.boothRent);
    sumConsignorRentCents += toCents(s.consignorRentOffsets);
    sumNetRentCents += toCents(s.netBoothRentForCoop);
    sumTechOpsCents += toCents(s.techOps);
    sumSuppliesCents += toCents(s.supplies);
    sumShortfallRepaidCents += toCents(s.shortfallRepaid);
    sumExcessSurplusCents += toCents(s.excessSurplus);
    sumBonusPoolCents += toCents(s.distributablePartnerBonusPool);
    sumSalesPoolCents += toCents(s.salesPatronagePool);
    sumLaborPoolCents += toCents(s.laborBonusPool);
    sumReserveAddCents += toCents(s.reserveAddition);
    sumIcaRetainedCents += toCents(s.mondragonStatus.totalIcaRetained);
    sumCashBonusCents += toCents(s.mondragonStatus.totalCashBonusPaid);

    allUnassigned.push(...bundle.unassignedReimbursements);
    allZeroSaleWarnings.push(...bundle.zeroSaleBoothWarnings);
    allWarnings.push(...bundle.warnings);

    for (const r of bundle.rows) {
      const subtotal: MonthlySettlementSubtotal = {
        monthKey,
        monthLabel: monthKeyToLabel(monthKey),
        isLocked: s.isLockedSnapshot,
        isMonthInProgress: s.isMonthInProgress,
        itemsSold: r.itemsSold,
        grossSales: r.grossSales,
        venueFee: r.venueFee,
        costRecoup: r.costRecoup,
        curatorBase: r.baseProfit70,
        reimbursements: r.frontedReimbursement,
        salesBonus: Number(r.salesPatronageBonus ?? 0),
        laborBonus: Number(r.laborBountyBonus ?? 0),
        icaRetained: Number(r.icaRetainedCredit ?? 0),
        payoutCheck: r.finalPayoutCheck,
      };

      const existing = mergedRowsMap.get(r.rowKey);
      if (!existing) {
        mergedRowsMap.set(r.rowKey, {
          ...r,
          items: [...(r.items || [])],
          laborLogs: [...(r.laborLogs || [])],
          approvedByNames: [...(r.approvedByNames || [])],
          deliverableRefs: [...(r.deliverableRefs || [])],
          monthlySubtotals: [subtotal],
        });
      } else {
        const nextGross = fromCents(toCents(existing.grossSales) + toCents(r.grossSales));
        const nextFee = fromCents(toCents(existing.venueFee) + toCents(r.venueFee));
        const nextNetAfter = fromCents(
          toCents(existing.netAfterVenue ?? 0) + toCents(r.netAfterVenue ?? 0)
        );
        const nextCost = fromCents(toCents(existing.costRecoup) + toCents(r.costRecoup));
        const nextUnrec = fromCents(
          toCents(existing.unrecoupedCost ?? 0) + toCents(r.unrecoupedCost ?? 0)
        );
        const nextMargin = fromCents(
          toCents(existing.netMargin ?? 0) + toCents(r.netMargin ?? 0)
        );
        const nextBase70 = fromCents(toCents(existing.baseProfit70) + toCents(r.baseProfit70));
        const nextCommons = fromCents(toCents(existing.commons30) + toCents(r.commons30));
        const nextReimb = fromCents(
          toCents(existing.frontedReimbursement) + toCents(r.frontedReimbursement)
        );
        const nextRent = fromCents(
          toCents(existing.consignorRentDeducted ?? 0) +
            toCents(r.consignorRentDeducted ?? 0)
        );
        const nextComm = fromCents(
          toCents(existing.coopCommission ?? 0) + toCents(r.coopCommission ?? 0)
        );
        const nextSalesBonus = fromCents(
          toCents(existing.salesPatronageBonus ?? 0) +
            toCents(r.salesPatronageBonus ?? 0)
        );
        const nextLaborBonus = fromCents(
          toCents(existing.laborBountyBonus ?? 0) +
            toCents(r.laborBountyBonus ?? 0)
        );
        const nextTotalBonus = fromCents(
          toCents(existing.totalBonusDividend ?? 0) +
            toCents(r.totalBonusDividend ?? 0)
        );
        const nextIca = fromCents(
          toCents(existing.icaRetainedCredit ?? 0) +
            toCents(r.icaRetainedCredit ?? 0)
        );
        const nextCashBonus = fromCents(
          toCents(existing.cashBonusPaid ?? 0) + toCents(r.cashBonusPaid ?? 0)
        );
        const nextCheck = fromCents(
          toCents(existing.finalPayoutCheck) + toCents(r.finalPayoutCheck)
        );
        const nextHours = Number(
          ((existing.laborHoursLogged || 0) + (r.laborHoursLogged || 0)).toFixed(2)
        );
        const nextPendingHours = Number(
          ((existing.pendingLaborHours || 0) + (r.pendingLaborHours || 0)).toFixed(2)
        );

        const mergedLogsMap = new Map<string, any>();
        for (const lg of [...(existing.laborLogs || []), ...(r.laborLogs || [])]) {
          if (lg?.id) mergedLogsMap.set(lg.id, lg);
        }
        const mergedRefs = Array.from(
          new Set([...(existing.deliverableRefs || []), ...(r.deliverableRefs || [])])
        );
        const mergedApprovers = Array.from(
          new Set([...(existing.approvedByNames || []), ...(r.approvedByNames || [])])
        );

        const updated = enrichPartnerSummaryRow(
          {
            ...existing,
            itemsSold: existing.itemsSold + r.itemsSold,
            grossSales: nextGross,
            venueFee: nextFee,
            netAfterVenue: nextNetAfter,
            costRecoup: nextCost,
            unrecoupedCost: nextUnrec,
            netMargin: nextMargin,
            baseProfit70: nextBase70,
            commons30: nextCommons,
            frontedReimbursement: nextReimb,
            consignorRentDeducted: nextRent,
            coopCommission: nextComm,
            laborHoursLogged: nextHours,
            pendingLaborHours: nextPendingHours,
            laborBountyWeight: nextHours,
            deliverableCount: mergedRefs.length,
            salesPatronageBonus: nextSalesBonus,
            laborBountyBonus: nextLaborBonus,
            totalBonusDividend: nextTotalBonus,
            icaRetainedCredit: nextIca,
            cashBonusPaid: nextCashBonus,
            finalPayoutCheck: nextCheck,
            items: [...(existing.items || []), ...(r.items || [])],
            laborLogs: Array.from(mergedLogsMap.values()),
          },
          {
            approvedByNames: mergedApprovers,
            deliverableRefs: mergedRefs,
            monthlySubtotals: [...(existing.monthlySubtotals || []), subtotal],
          }
        );
        mergedRowsMap.set(r.rowKey, updated);
      }
    }
  }

  const mergedRows = Array.from(mergedRowsMap.values());
  const totalGross = fromCents(sumGrossCents);
  const totalVenueFee = fromCents(sumVenueFeeCents);
  const totalStorePayout = fromCents(sumGrossCents - sumVenueFeeCents);
  const totalCommonsPool = fromCents(sumCommonsPoolCents);
  const totalCommonsOverhead = fromCents(
    sumNetRentCents + sumTechOpsCents + sumSuppliesCents
  );
  const commonsNetBalance = fromCents(sumCommonsPoolCents - toCents(totalCommonsOverhead));

  const laborApprovalAll = summarizeLaborApproval(inputs.laborEntries || [], 'all');
  const eligibleAll = (inputs.laborEntries || []).filter((e) =>
    isSettlementEligibleLabor(e)
  );
  const approvedMemberSharesAll = getLaborHoursByMemberForMonth(
    eligibleAll,
    'all',
    inputs.policyConfig.members,
    { status: 'approved' }
  );
  const allMemberSharesAll = getLaborHoursByMemberForMonth(
    inputs.laborEntries || [],
    'all',
    inputs.policyConfig.members,
    { status: 'all' }
  );

  const lastMondragon =
    monthlyBundles[monthlyBundles.length - 1]?.bundle.summary.mondragonStatus;

  const mergedSummary: BuiltSettlementSummary = {
    totalGross,
    totalVenueFee,
    venueFeePct:
      totalGross > 0 ? Number(((totalVenueFee / totalGross) * 100).toFixed(1)) : 0,
    totalStorePayout,
    totalCostBasis: fromCents(sumCostBasisCents),
    totalUnrecoupedCost: fromCents(sumUnrecoupedCents),
    totalNetSurplus: fromCents(sumNetSurplusCents),
    totalCuratorPayouts: fromCents(sumCuratorPayoutsCents),
    totalCommonsPool,
    boothRent: fromCents(sumBoothRentCents),
    isMonthInProgress: false,
    isVenueScopedPreview: location !== 'all',
    isLockedSnapshot: false,
    consignorRentOffsets: fromCents(sumConsignorRentCents),
    netBoothRentForCoop: fromCents(sumNetRentCents),
    techOps: fromCents(sumTechOpsCents),
    supplies: fromCents(sumSuppliesCents),
    carriedOverShortfall: 0,
    shortfallRepaid: fromCents(sumShortfallRepaidCents),
    remainingShortfall: runningShortfall,
    totalCommonsOverhead,
    commonsNetBalance,
    excessSurplus: fromCents(sumExcessSurplusCents),
    isCommonsFullyCovered: commonsNetBalance >= 0,
    distributablePartnerBonusPool: fromCents(sumBonusPoolCents),
    salesPatronagePool: fromCents(sumSalesPoolCents),
    laborBonusPool: fromCents(sumLaborPoolCents),
    reserveAddition: fromCents(sumReserveAddCents),
    newReserveBalance: fromCents(
      toCents(inputs.policyConfig.currentReserveBalance || 0) + sumReserveAddCents
    ),
    breakevenProgressPct:
      totalCommonsOverhead > 0
        ? Math.min(100, Math.round((totalCommonsPool / totalCommonsOverhead) * 100))
        : 100,
    memoryDenNetCheck: fromCents(toCents(totalStorePayout) - sumBoothRentCents),
    mondragonStatus: {
      isMondragon104545: Boolean(lastMondragon?.isMondragon104545),
      effectiveHourlyDividendRate:
        laborApprovalAll.approvedHours > 0
          ? fromCents(Math.round(sumLaborPoolCents / laborApprovalAll.approvedHours))
          : 0,
      payRatioActual: lastMondragon?.payRatioActual ?? null,
      payRatioCap: Number(inputs.policyConfig.payRatioCapStandard || 4.5),
      isPayRatioCompliant: lastMondragon?.isPayRatioCompliant ?? true,
      noHoursBonusRows: lastMondragon?.noHoursBonusRows || [],
      totalIcaRetained: fromCents(sumIcaRetainedCents),
      totalCashBonusPaid: fromCents(sumCashBonusCents),
      hasZeroLaborPresetWarning: Boolean(lastMondragon?.hasZeroLaborPresetWarning),
    },
  };

  return {
    rows: mergedRows,
    summary: mergedSummary,
    engineResult: {
      operatingBreakeven: totalCommonsOverhead,
      partners: mergedRows,
      excessSurplus: mergedSummary.excessSurplus,
      reserveAdded: mergedSummary.reserveAddition,
      partnerBonusPool: mergedSummary.distributablePartnerBonusPool,
      warnings: allWarnings,
      breakdown: {
        isMonthInProgress: false,
        grossRent: mergedSummary.boothRent,
        consignorRentOffset: mergedSummary.consignorRentOffsets,
        netRent: mergedSummary.netBoothRentForCoop,
        techOps: mergedSummary.techOps,
        supplies: mergedSummary.supplies,
        totalCommonsCollected: mergedSummary.totalCommonsPool,
        netOperatingBalanceBeforeShortfall: commonsNetBalance,
        shortfallRepaid: mergedSummary.shortfallRepaid,
        remainingShortfall: mergedSummary.remainingShortfall,
        newReserveBalance: mergedSummary.newReserveBalance,
        salesPatronagePool: mergedSummary.salesPatronagePool,
        laborBountyPool: mergedSummary.laborBonusPool,
        mondragonStatus: mergedSummary.mondragonStatus,
      },
    },
    laborApproval: laborApprovalAll,
    approvedMemberShares: approvedMemberSharesAll,
    allMemberShares: allMemberSharesAll,
    unassignedReimbursements: allUnassigned,
    zeroSaleBoothWarnings: allZeroSaleWarnings,
    warnings: allWarnings,
  };
}

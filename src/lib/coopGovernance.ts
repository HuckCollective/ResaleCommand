import { databases, Query } from './appwrite';
import { Permission, Role } from 'appwrite';
import { getDatabaseId } from './appwriteEnv';
import { cleanEscapedCurrency } from './safeMarkdown';
import { calendarMonthKeyFromDateString, pacificMonthKey } from './salesBucketing';
import { mutateCoopLabor } from './coopLedgerClient';
import {
  isCoopLaborFunctionTag,
  normalizeFunctionTag,
  type CoopLaborFunctionTag,
  type CoopTaskPeerApproval,
} from './coopTaskBoard';
import type { SweatSalesPoolMode } from '../types/coop';

export type LoomioSignal = 'agree' | 'abstain' | 'disagree' | 'block';
export type SurplusPolicyMode = 'patronage_90_10' | 'cap_100' | 'reserve_100';
export type SurplusSplitBasis = 'volume' | 'equal';
export type { SweatSalesPoolMode };

export interface ProposalVote {
  signal: LoomioSignal;
  memberName: string;
  partner: string;
  comment?: string;
  votedAt: string;
}

export interface CoopProposal {
  id: string;
  title: string;
  proposer: string;
  proposerPartner: string;
  proposerUserId?: string;
  proposerEmail?: string;
  category:
    | 'Booth & Physical Footprint'
    | 'Inventory & Consignment'
    | 'Hardware & Equipment'
    | 'Software & Tech Commons'
    | 'Policy & Membership';
  description: string;
  rationale: string;
  financialImpact?: string;
  /** Optional policy preset action that can be enacted in 1 click once Consensus is reached */
  presetAction?: 'wsde_10_60_30' | 'mondragon_10_45_45' | 'sales_10_90_0' | 'cap_100' | 'reserve_100';
  deadline: string;
  status: 'active' | 'passed' | 'blocked';
  createdAt: string;
  updatedAt?: string;
  lastEditKind?: 'formatting' | 'amendment';
  imageId?: string;
  galleryImageIds?: string[];
  mdFileId?: string;
  votes: Record<string, ProposalVote>;
}

/**
 * Pacific calendar date (`YYYY-MM-DD`, America/Los_Angeles) so evening logs after 4 PM PT
 * never roll forward into tomorrow or the next calendar month (Law 7).
 */
export function pacificTodayYmd(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value || '2026';
  const m = parts.find((p) => p.type === 'month')?.value || '01';
  const d = parts.find((p) => p.type === 'day')?.value || '01';
  return `${y}-${m}-${d}`;
}

export function currentPacificMonthKey(now: Date = new Date()): string {
  return pacificTodayYmd(now).slice(0, 7);
}

/**
 * Law 7 1-indexed month key (`YYYY-MM`) for labor work dates using string parsing
 * (`calendarMonthKeyFromDateString` -> `pacificMonthKey`). Returns `''` when missing/invalid.
 */
export function laborEntryMonthKey(dateStr?: string | null): string {
  const raw = String(dateStr ?? '').trim();
  if (!raw) return '';
  const written = calendarMonthKeyFromDateString(raw);
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(written)) return written;
  const pac = pacificMonthKey(raw);
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(pac) ? pac : '';
}

/**
 * Author & Steward Ownership Guard:
 * Allows the original proposer (matched by Appwrite User ID, email, or member persona name)
 * OR a Founder/Steward to unlock and edit/amend a proposal.
 */
export function canUserEditProposal(
  proposal: CoopProposal | null | undefined,
  opts: {
    userId?: string;
    userEmail?: string;
    userName?: string;
    activeVotingMember?: string;
    isSteward?: boolean;
  }
): boolean {
  if (!proposal) return false;
  if (opts.isSteward) return true;

  if (proposal.proposerUserId && opts.userId && proposal.proposerUserId === opts.userId) {
    return true;
  }
  if (
    proposal.proposerEmail &&
    opts.userEmail &&
    proposal.proposerEmail.trim().toLowerCase() === opts.userEmail.trim().toLowerCase()
  ) {
    return true;
  }

  const normalizeName = (raw?: string) =>
    String(raw || '')
      .replace(/\(.*?\)/g, '')
      .trim()
      .toLowerCase();

  const propName = normalizeName(proposal.proposer);
  if (!propName) return false;

  const candidateNames = [normalizeName(opts.userName), normalizeName(opts.activeVotingMember)].filter(Boolean);
  for (const cand of candidateNames) {
    if (cand === propName) return true;
    const firstWordProp = propName.split(/\s+/)[0];
    const firstWordCand = cand.split(/\s+/)[0];
    if (firstWordProp && firstWordProp.length >= 3 && firstWordProp === firstWordCand) {
      return true;
    }
  }

  return false;
}

// Member hats live in ./memberHats (pure, no Appwrite) so the dashboard and public demo can share them.
import { MEMBER_HAT_META, type MemberHat } from './memberHats';
export { MEMBER_HAT_META, canSeeCollectiveFinancials, ensureCuratorBaseRoles } from './memberHats';
export type { MemberHat, MemberHatMeta } from './memberHats';

/** Barcode prefixes printed on physical booth tags. Never editable or removable once registered. */
export const PROTECTED_BARCODE_PREFIXES: readonly string[] = ['HUCK-', 'PDXGL-', 'BB-'];

/** Reserved system prefix roots that no individual Curator may claim as their personal SKU prefix. */
export const RESERVED_PREFIX_ROOTS: readonly string[] = [
  'COMMONS',
  'SWEAT',
  'UNASSIGNED',
  'NONE',
  'ALL',
  'ITEM',
  'PO',
  'SO',
  'SC',
  '0EJ',
  'BB',
];

export type PrefixLifecycleStatus = 'unset' | 'requested' | 'locked';

/**
 * Strips hyphens, spaces, and punctuation from a raw user SKU input so members type ONLY
 * letters/digits (e.g. 'dom' or 'DOM-' -> 'DOM').
 */
export function sanitizePrefixRootInput(raw: string | null | undefined): string {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
}

/**
 * Formats a sanitized root into a canonical barcode prefix with automatic trailing '-' (e.g. 'DOM' -> 'DOM-').
 */
export function formatAutoHyphenPrefix(raw: string | null | undefined): string {
  const root = sanitizePrefixRootInput(raw);
  return root ? `${root}-` : '';
}

export function isProtectedPrefix(prefix: string, usedPrefixes: string[] = []): boolean {
  const key = String(prefix || '').trim().toUpperCase();
  return PROTECTED_BARCODE_PREFIXES.includes(key) || usedPrefixes.map((p) => p.toUpperCase()).includes(key);
}

/**
 * Builds an alias lookup (`Map<normalizedOldPrefix, normalizedActivePrefix>`) from every member's
 * `historicalPrefixes` so sales, expenses, and labor under retired physical tags roll cleanly into
 * that Curator's current settlement row without splitting payouts across two rows.
 */
export function buildMemberPrefixAliasMap(members: ReadonlyArray<CoopMemberProfile> = []): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of members || []) {
    const active = formatAutoHyphenPrefix(m?.inventoryPrefix);
    if (!active) continue;
    map.set(active, active);
    for (const hist of m?.historicalPrefixes || []) {
      const cleanHist = formatAutoHyphenPrefix(hist);
      if (cleanHist && cleanHist !== active) {
        map.set(cleanHist, active);
      }
    }
  }
  return map;
}

/**
 * Validates a candidate SKU prefix (`2–6` uppercase alphanumeric chars, auto-suffixed with '-')
 * for global 1-to-1 exclusivity across active member prefixes, `historicalPrefixes`, consignor contracts,
 * and extra team partner prefixes.
 */
export function validateUniquePrefixRequest(
  rawInput: string,
  opts: {
    members?: ReadonlyArray<CoopMemberProfile>;
    consignors?: ReadonlyArray<ConsignorAgreementConfig>;
    partnerPrefixes?: ReadonlyArray<any>;
    allowForUserId?: string;
    allowForEmail?: string;
  } = {}
): { ok: true; root: string; prefix: string } | { ok: false; error: string } {
  const root = sanitizePrefixRootInput(rawInput);
  if (root.length < 2 || root.length > 6) {
    return {
      ok: false,
      error: 'Choose 2 to 6 letters or numbers (for example DOM or MIKE) — the hyphen is added automatically.',
    };
  }
  if (/^\d+$/.test(root)) {
    return {
      ok: false,
      error: 'Include at least one letter in your SKU prefix (for example DOM or M2K).',
    };
  }
  if (RESERVED_PREFIX_ROOTS.includes(root) || root.startsWith('0EJ')) {
    return {
      ok: false,
      error: `${root}- is reserved for booth or system operations. Please pick another prefix.`,
    };
  }

  const prefix = `${root}-`;
  const callerUid = String(opts.allowForUserId || '').trim();
  const callerEmail = String(opts.allowForEmail || '').trim().toLowerCase();

  const isSameCaller = (m: CoopMemberProfile): boolean => {
    if (callerUid && m.userId && m.userId.trim() === callerUid) return true;
    if (callerEmail && m.email && m.email.trim().toLowerCase() === callerEmail) return true;
    return false;
  };

  for (const c of opts.consignors || []) {
    if (formatAutoHyphenPrefix(c.prefix) === prefix) {
      return { ok: false, error: `${prefix} is already assigned to consignor ${c.displayName}.` };
    }
  }

  for (const m of opts.members || []) {
    const same = isSameCaller(m);
    const active = formatAutoHyphenPrefix(m.inventoryPrefix);
    const requested = formatAutoHyphenPrefix(m.requestedPrefix);
    const historicals = (m.historicalPrefixes || []).map((h) => formatAutoHyphenPrefix(h)).filter(Boolean);

    if (!same && active === prefix) {
      // Allow claiming an UNLINKED legacy seed row's prefix only during Founder lock? No — keep 1-to-1 strict unless linked!
      if (m.userId || m.email) {
        return { ok: false, error: `${prefix} is already locked to ${m.name}. Every Curator has a unique SKU.` };
      }
    }
    if (!same && requested === prefix && (m.userId || m.email)) {
      return { ok: false, error: `${prefix} has already been requested by ${m.name}.` };
    }
    if (!same && historicals.includes(prefix)) {
      return {
        ok: false,
        error: `${prefix} was previously printed on physical booth tags for ${m.name} and cannot be reused.`,
      };
    }
  }

  return { ok: true, root, prefix };
}

/**
 * UI display hint for global financial controls.
 * Real authorization is enforced server-side via Appwrite Team roles (`owner` | `founder`) in `/api/coop/me`.
 */
export function canMemberEditGlobalFinancials(
  member: { hats?: MemberHat[] } | undefined | null,
  isServerFounderOrTeamOwner = false
): boolean {
  if (isServerFounderOrTeamOwner) return true;
  return !!member?.hats?.includes('founder');
}

function defaultHatsFor(partner: string, role?: string): MemberHat[] {
  if (partner === 'BB' || role === 'Consignor') return ['consignor'];
  if (partner === 'SWEAT' || role === 'Marketing & Social Enabler') return ['curator', 'promoter', 'enabler'];
  if (partner === 'HUCK' && role === 'Co-op Member') return ['founder', 'curator', 'promoter'];
  return ['curator'];
}

/**
 * Derives display-only WSDE hats from live Appwrite Team membership roles when an account is linked (§8.4).
 */
export function deriveMemberHatsFromRoles(
  roles: readonly string[] | undefined | null,
  fallbackMember?: Pick<CoopMemberProfile, 'partner' | 'role' | 'hats'>
): MemberHat[] {
  if (Array.isArray(roles) && roles.length > 0) {
    const derived = new Set<MemberHat>();
    for (const r of roles) {
      const clean = String(r || '').trim().toLowerCase();
      if (clean === 'owner' || clean === 'founder') derived.add('founder');
      else if (clean === 'curator') derived.add('curator');
      else if (clean === 'promoter') derived.add('promoter');
      else if (clean === 'enabler') derived.add('enabler');
      else if (clean === 'builder') derived.add('builder');
      else if (clean === 'consignor') derived.add('consignor');
    }
    if (derived.size > 0) return Array.from(derived);
  }
  const validFallback = (Array.isArray(fallbackMember?.hats) ? fallbackMember!.hats : []).filter(
    (h): h is MemberHat => h in MEMBER_HAT_META
  );
  if (validFallback.length > 0) return validFallback;
  return defaultHatsFor(fallbackMember?.partner || 'HUCK', fallbackMember?.role);
}

export interface CoopMemberProfile {
  name: string;
  partner: string;
  role: 'Co-op Member' | 'Partner Curator' | 'Marketing & Social Enabler' | 'Consignor';
  canVote: boolean;
  /** Optional linked Appwrite Auth User ID (set by Founder/Owner in Roles panel; server re-verifies JWT) */
  userId?: string;
  /** Optional display email hint for matching */
  email?: string;
  /** Combinable WSDE hats (display-only; server security uses Appwrite Team roles). */
  hats?: MemberHat[];
  /** Physical barcode prefix for Curator/Consignor hats (e.g. 'HUCK-', 'DOM-'). */
  inventoryPrefix?: string;
  /** Lifecycle status of this member's personal barcode prefix ('unset' | 'requested' | 'locked'). */
  prefixStatus?: PrefixLifecycleStatus;
  /** Member-requested candidate prefix awaiting Steward lock (normalized 'DOM-'). */
  requestedPrefix?: string;
  /** ISO timestamp when prefix was locked for physical shelf tags. */
  prefixLockedAt?: string;
  /** Steward name/id who locked the prefix. */
  prefixLockedBy?: string;
  /** Prior locked prefixes whose printed booth stickers continue crediting this Curator. */
  historicalPrefixes?: string[];
}

export type ConsignorDealMode =
  /** Venue Fee + pro-rata share of booth rent (matches % of booth gross sales); 0% Co-op commission */
  | 'pro_rata_rent'
  /** Straight % Split: Venue Fee + X% Co-op commission to Commons Pool; $0 rent */
  | 'flat_commission'
  /** Venue Fee + fixed $/mo shelf rent + optional X% Co-op commission */
  | 'fixed_shelf_rent';

export interface ConsignorAgreementConfig {
  /** Normalized barcode prefix, e.g. 'BB-' */
  prefix: string;
  displayName: string;
  mode: ConsignorDealMode;
  /** % of net store deposit (after rent in fixed mode) contributed to the Commons Pool (0–60) */
  coopCommissionPct: number;
  /** Fixed monthly shelf rent ($) used in 'fixed_shelf_rent' mode */
  fixedMonthlyRent: number;
  /** Never let rent push the consignor payout below $0 */
  capRentAtNetSales: boolean;
  notes?: string;
}

export const CONSIGNOR_DEAL_MODE_LABELS: Record<ConsignorDealMode, string> = {
  pro_rata_rent: '📊 Pro-Rata Booth Rent Share',
  flat_commission: '✂️ Straight % Split ($0 Rent)',
  fixed_shelf_rent: '🏪 Fixed Monthly Shelf Rent',
};

export const DEFAULT_CONSIGNOR_AGREEMENTS: ConsignorAgreementConfig[] = [
  {
    prefix: 'BB-',
    displayName: 'B&B Consignment (PDXGL Sub-Client)',
    mode: 'pro_rata_rent',
    coopCommissionPct: 20,
    fixedMonthlyRent: 85.41,
    capRentAtNetSales: true,
  },
];

export interface ConsignorSettlementInput {
  agreement: ConsignorAgreementConfig;
  /** Net store deposit for the consignor's sales (gross - venue fee) */
  netStoreDeposit: number;
  /** Consignor's share of total gross sales (0–1) */
  grossRatio: number;
  /** Live monthly booth rent (0 while the month is still in progress) */
  boothRent: number;
  /** True while the Pacific month is open: no rent is billed yet */
  isMonthInProgress: boolean;
}

export interface ConsignorSettlementResult {
  rentDeduction: number;
  coopCommission: number;
  payout: number;
  formulaLabel: string;
}

/** Single shared consignor payout formula for /coop/settlements and the PDF statement. */
export function calculateConsignorSettlement(input: ConsignorSettlementInput): ConsignorSettlementResult {
  const { agreement, netStoreDeposit, grossRatio, boothRent, isMonthInProgress } = input;
  const netCents = Math.max(0, Math.round((Number(netStoreDeposit) || 0) * 100));
  const pct = Math.min(60, Math.max(0, Number(agreement.coopCommissionPct) || 0)) / 100;
  const boothRentCents = Math.max(0, Math.round((Number(boothRent) || 0) * 100));

  let rentCents = 0;
  let commissionCents = 0;
  let formulaLabel = '';

  if (agreement.mode === 'flat_commission') {
    commissionCents = Math.round(netCents * pct);
    const consignorPctLabel = Math.round((1 - pct) * 10000) / 100;
    const coopPctLabel = Math.round(pct * 10000) / 100;
    formulaLabel = `Straight Consignment Split (${consignorPctLabel}% Consignor / ${coopPctLabel}% Co-op)`;
  } else if (agreement.mode === 'fixed_shelf_rent') {
    const fixedCents = isMonthInProgress
      ? 0
      : Math.max(0, Math.round((Number(agreement.fixedMonthlyRent) || 0) * 100));
    rentCents = agreement.capRentAtNetSales ? Math.min(fixedCents, netCents) : fixedCents;
    commissionCents = Math.round(Math.max(0, netCents - rentCents) * pct);
    const fixedDollars = (Math.round((Number(agreement.fixedMonthlyRent) || 0) * 100) / 100).toFixed(2);
    const coopPctLabel = Math.round(pct * 10000) / 100;
    formulaLabel = `Fixed Shelf Rent ($${fixedDollars}/mo)${pct > 0 ? ` + ${coopPctLabel}% Co-op` : ''}`;
  } else {
    const shareCents = Math.round(grossRatio * boothRentCents);
    rentCents = agreement.capRentAtNetSales ? Math.min(shareCents, netCents) : shareCents;
    formulaLabel = 'Pro-Rata Booth Rent Share';
  }

  const rawPayoutCents = netCents - rentCents - commissionCents;
  const payoutCents = agreement.capRentAtNetSales ? Math.max(0, rawPayoutCents) : rawPayoutCents;
  return {
    rentDeduction: rentCents / 100,
    coopCommission: commissionCents / 100,
    payout: payoutCents / 100,
    formulaLabel,
  };
}

export function findConsignorAgreement(
  agreements: ConsignorAgreementConfig[] | undefined,
  prefix: string
): ConsignorAgreementConfig | undefined {
  const key = String(prefix || '').toUpperCase().replace(/[-_]+$/, '');
  return (agreements || []).find((a) => a.prefix.toUpperCase().replace(/[-_]+$/, '') === key);
}

export interface CoopPolicyConfig {
  /** Straight-consignment agreements (BB- and any added consignor prefix) */
  consignors: ConsignorAgreementConfig[];
  /** Gate 3 Item Margin Split (must sum to 100) */
  curatorSharePct: number;
  commonsSharePct: number;
  /** Gate 4B Excess Surplus 3-Way WSDE / Mondragon Split (must sum to 100) */
  reserveSharePct: number;
  salesPatronagePct: number;
  laborPatronagePct: number;
  /** Rainy-Day Reserve Target Cap ($). Once reached, reserve slice redirects to partner dividends */
  reserveCapTarget: number;
  /** Current accumulated Rainy-Day Reserve balance ($) */
  currentReserveBalance: number;
  /** Prior month carried-over shortfall ($) that must be repaid 100% first in Gate 4A before Gate 4B dividends unlock */
  carriedOverShortfall: number;
  /** Mondragon ICA retained % of Gate 4B bonus (0–50, default 0 = 100% monthly cash check) */
  icaRetainedPct: number;
  /** $0-Inventory Enabler Sales Pool Scope ('labor_only' default vs 'equal_all' in equal mode) */
  sweatSalesPoolMode: SweatSalesPoolMode;
  /** Mondragon ICA annual target cash bonus yield % on retained member capital balances (default 7%) */
  icaAnnualYieldRatePct: number;
  /** Mondragon pay/bounty ratio compression cap (default 4.5:1 standard, max 6.5:1) */
  payRatioCapStandard: number;
  /** Minimum Agree votes (with 0 Blocks) required to pass a proposal */
  minAgreeVotes: number;
  /** Days before an unlinked register ticket can be swept 100% to Commons Pool */
  orphanClaimWindowDays: number;
  /** Founder setting: max USD for receipt-backed POs to auto-approve Gate 2 recoupment ($0 = approve every PO) */
  autoApproveReceiptPoMaxUsd: number;
  /** Eligible Co-op Voters & Labor Contributors */
  members: CoopMemberProfile[];
}

export type CoopLaborCategory =
  | 'Booth Restock'
  | 'Photography & Staging'
  | 'Social & Marketing'
  | 'Online Fulfillment & Shipping'
  | 'Pop-Up & Event Staffing'
  | 'Tech & Admin'
  | 'Sourcing';

export const COOP_LABOR_CATEGORIES: readonly CoopLaborCategory[] = [
  'Booth Restock',
  'Photography & Staging',
  'Social & Marketing',
  'Online Fulfillment & Shipping',
  'Pop-Up & Event Staffing',
  'Tech & Admin',
  'Sourcing',
] as const;

export type WsdeSurplusLaborRole = 'Producer of Surplus' | 'Enabler of Surplus';

export type LaborApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface CoopLaborEntry {
  id: string;
  date: string;
  member: string;
  memberUserId?: string;
  partner: string;
  category: CoopLaborCategory;
  /** Per-entry function tag (`Promoter` / `Enabler` / `Builder` / `Shift`) */
  functionTag?: CoopLaborFunctionTag;
  hours: number;
  /** Task Board solidarity points when created from a task (`1 pt = 1.00h`) */
  points?: number;
  taskId?: string;
  /** Anti-double-dip advisory flag when notes/proof mention the worker's own barcode prefix */
  ownBarcodeWarning?: boolean;
  /** Peer completion sign-offs recorded on Task Board completions */
  peerApprovals?: CoopTaskPeerApproval[];
  notes: string;
  /** Optional proof link or deliverable reference (e.g. Dropcast ID, Instagram/TikTok Reel URL, Booth Photo batch) */
  deliverableRef?: string;
  /** Missing = legacy entry (treated as 'pending' until Founder approves; never auto-approved) */
  approval?: LaborApprovalStatus;
  approvedBy?: string;
  approvedByUserId?: string;
  /** ISO instant (audit trail only; never used for month bucketing) */
  approvedAt?: string;
  /** Required on reject/unapprove, optional on approve */
  decisionNote?: string;
  /** Flagged when the sole confirmed Founder approves their own logged hours */
  selfApproved?: boolean;
  loggedByUserId?: string;
  loggedByName?: string;
  updatedAt?: string;
}

export interface MemberLaborShareSummary {
  member: string;
  partner: string;
  roleLabel: string;
  /** Approved hours (basis for Gate 4B Sweat-Equity share) */
  hours: number;
  approvedHours: number;
  pendingHours: number;
  rejectedHours: number;
  sharePct: number;
  deliverableCount: number;
  deliverableRefs: string[];
  enablerHours: number;
  producerHours: number;
  entries: CoopLaborEntry[];
  approvedByNames: string[];
  latestApprovedAt?: string;
}

export interface LaborApprovalSummary {
  approvedHours: number;
  pendingHours: number;
  rejectedHours: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  legacyPendingCount: number;
  invalidExcludedCount: number;
  latestApprovedAt?: string;
}

export interface CoopGovernanceCloudState {
  proposals: CoopProposal[];
  surplusPolicyMode: SurplusPolicyMode;
  surplusSplitBasis: SurplusSplitBasis;
  policyConfig: CoopPolicyConfig;
  /** Legacy field preserved read-only for 1-time migration into coop_ledger; no longer written from browser */
  laborEntries: CoopLaborEntry[];
  laborMigratedAt?: string;
  updatedAt: string;
}

export function classifySurplusLaborRole(category: CoopLaborCategory): WsdeSurplusLaborRole {
  if (
    category === 'Sourcing' ||
    category === 'Booth Restock' ||
    category === 'Pop-Up & Event Staffing'
  ) {
    return 'Producer of Surplus';
  }
  return 'Enabler of Surplus';
}

export const DEFAULT_COOP_POLICY_CONFIG: CoopPolicyConfig = {
  consignors: DEFAULT_CONSIGNOR_AGREEMENTS.map((c) => ({ ...c })),
  curatorSharePct: 70,
  commonsSharePct: 30,
  reserveSharePct: 10,
  salesPatronagePct: 60,
  laborPatronagePct: 30,
  reserveCapTarget: 500,
  currentReserveBalance: 0,
  carriedOverShortfall: 0,
  icaRetainedPct: 0,
  sweatSalesPoolMode: 'labor_only',
  icaAnnualYieldRatePct: 7,
  payRatioCapStandard: 4.5,
  minAgreeVotes: 2,
  orphanClaimWindowDays: 30,
  autoApproveReceiptPoMaxUsd: 25,
  members: [
    { name: 'Huckleberry', partner: 'HUCK', role: 'Co-op Member', canVote: true, inventoryPrefix: 'HUCK-', prefixStatus: 'locked' },
    { name: 'PDX Partner (PDXGL)', partner: 'PDXGL', role: 'Partner Curator', canVote: true, inventoryPrefix: 'PDXGL-', prefixStatus: 'locked' },
  ],
};

/** Demo-only charter seed entries for public `/coop` preview. Never eligible for real settlements (§5 item 24). */
export const DEFAULT_COOP_LABOR_ENTRIES: CoopLaborEntry[] = [
  {
    id: 'labor-seed-1',
    date: pacificTodayYmd(),
    member: 'Mike (HUCK)',
    partner: 'HUCK',
    category: 'Booth Restock',
    hours: 2.0,
    notes: 'Restocked booth #0EJ, staged vintage pieces & verified Ricochet tags.',
    deliverableRef: 'Booth #0EJ Drop',
    approval: 'approved',
  },
  {
    id: 'labor-seed-2',
    date: pacificTodayYmd(new Date(Date.now() - 86400000 * 2)),
    member: 'PDX Partner (PDXGL)',
    partner: 'PDXGL',
    category: 'Photography & Staging',
    hours: 1.5,
    notes: 'Deep Scan photo enrichment on tabletop games & cataloged SKUs.',
    deliverableRef: '18 RPG SKUs Scanned',
    approval: 'approved',
  },
  {
    id: 'labor-seed-3',
    date: pacificTodayYmd(new Date(Date.now() - 86400000 * 4)),
    member: 'Jesse (Social & Ops)',
    partner: 'SWEAT',
    category: 'Social & Marketing',
    hours: 1.5,
    notes: 'Filmed & edited Dropcast social reel showcasing new Memory Den booth drop.',
    deliverableRef: 'IG/TikTok Dropcast Reel #12',
    approval: 'approved',
  },
];

export const COOP_GOVERNANCE_DOC_ID = 'coop_governance_proposals_v1';
export const COOP_PROPOSALS_COL_ID = 'coop_proposals';
const MANIFESTS_COL_ID = 'manifests';
const LOCAL_STORAGE_PROPOSALS_KEY = 'huck_coop_proposals_v1';
const LOCAL_STORAGE_POLICY_MODE_KEY = 'rc_coop_surplus_policy_mode';
const LOCAL_STORAGE_SPLIT_BASIS_KEY = 'rc_coop_surplus_split_basis';
const LOCAL_STORAGE_POLICY_CONFIG_KEY = 'rc_coop_policy_config_v1';

function sanitizeStorageIds(ids?: string[]): string[] {
  if (!Array.isArray(ids)) return [];
  return ids
    .map((v) => String(v || '').trim())
    .filter((v) => v.length > 0 && !v.startsWith('data:') && !v.startsWith('blob:'));
}

function docToCoopProposal(doc: any): CoopProposal {
  let votes: Record<string, ProposalVote> = {};
  if (typeof doc.votesJson === 'string' && doc.votesJson.trim().startsWith('{')) {
    try {
      votes = JSON.parse(doc.votesJson);
    } catch {
      votes = {};
    }
  } else if (doc.votes && typeof doc.votes === 'object') {
    votes = doc.votes;
  }

  const gallery = sanitizeStorageIds(doc.galleryImageIds);
  const cover =
    typeof doc.imageId === 'string' && doc.imageId.trim() && !doc.imageId.startsWith('data:')
      ? doc.imageId.trim()
      : gallery[0] || undefined;

  return {
    id: String(doc.$id || doc.id),
    title: cleanEscapedCurrency(doc.title || 'Untitled Proposal'),
    proposer: String(doc.proposer || 'Member'),
    proposerPartner: String(doc.proposerPartner || 'HUCK'),
    proposerUserId: doc.proposerUserId ? String(doc.proposerUserId) : undefined,
    proposerEmail: doc.proposerEmail ? String(doc.proposerEmail) : undefined,
    category: (doc.category as CoopProposal['category']) || 'Policy & Membership',
    description: cleanEscapedCurrency(doc.description || ''),
    rationale: cleanEscapedCurrency(doc.rationale || ''),
    financialImpact: doc.financialImpact ? cleanEscapedCurrency(doc.financialImpact) : undefined,
    presetAction: doc.presetAction ? (doc.presetAction as CoopProposal['presetAction']) : undefined,
    deadline: String(doc.deadline || pacificTodayYmd()),
    status: doc.status === 'passed' || doc.status === 'blocked' ? doc.status : 'active',
    createdAt: String(doc.createdAt || doc.$createdAt || pacificTodayYmd()).slice(0, 10),
    updatedAt: doc.updatedAt || doc.$updatedAt || undefined,
    lastEditKind: doc.lastEditKind === 'formatting' || doc.lastEditKind === 'amendment' ? doc.lastEditKind : undefined,
    imageId: cover,
    galleryImageIds: gallery,
    mdFileId: doc.mdFileId ? String(doc.mdFileId) : undefined,
    votes,
  };
}

function proposalToDocPayload(proposal: CoopProposal, tenantId = 'huck_collective') {
  const gallery = sanitizeStorageIds(proposal.galleryImageIds);
  const cover =
    proposal.imageId && !proposal.imageId.startsWith('data:') && !proposal.imageId.startsWith('blob:')
      ? proposal.imageId
      : gallery[0] || null;

  return {
    title: cleanEscapedCurrency(proposal.title || 'Untitled Proposal').slice(0, 500),
    proposer: String(proposal.proposer || 'Member').slice(0, 128),
    proposerPartner: String(proposal.proposerPartner || 'HUCK').slice(0, 64),
    proposerUserId: proposal.proposerUserId ? String(proposal.proposerUserId).slice(0, 128) : null,
    proposerEmail: proposal.proposerEmail ? String(proposal.proposerEmail).slice(0, 255) : null,
    category: String(proposal.category || 'Policy & Membership').slice(0, 128),
    status: String(proposal.status || 'active').slice(0, 32),
    deadline: String(proposal.deadline || '').slice(0, 64),
    financialImpact: proposal.financialImpact ? cleanEscapedCurrency(proposal.financialImpact).slice(0, 1000) : null,
    description: cleanEscapedCurrency(proposal.description || '').slice(0, 65000),
    rationale: cleanEscapedCurrency(proposal.rationale || '').slice(0, 65000),
    mdFileId: proposal.mdFileId ? String(proposal.mdFileId).slice(0, 128) : null,
    imageId: cover ? String(cover).slice(0, 255) : null,
    galleryImageIds: gallery,
    votesJson: JSON.stringify(proposal.votes || {}).slice(0, 65000),
    presetAction: proposal.presetAction ? String(proposal.presetAction).slice(0, 64) : null,
    lastEditKind: proposal.lastEditKind ? String(proposal.lastEditKind).slice(0, 32) : null,
    createdAt: String(proposal.createdAt || pacificTodayYmd()).slice(0, 64),
    updatedAt: new Date().toISOString(),
    tenantId: String(tenantId || 'huck_collective').slice(0, 64),
  };
}

/**
 * Explicit partner ALWAYS wins first (§5 item 26), supporting any dynamic Curator SKU root
 * (e.g. 'HUCK', 'PDXGL', 'DOM', 'MIKE', 'GENE', 'SWEAT'). Name-keyword heuristic applies ONLY when explicit is absent.
 */
export function inferPartnerFromMemberName(
  member: string,
  explicit?: string,
  aliasMap?: ReadonlyMap<string, string>
): string {
  const exp = String(explicit || '')
    .trim()
    .toUpperCase()
    .replace(/[-_]+$/, '');
  if (/^[A-Z0-9]{2,8}$/.test(exp)) {
    if (aliasMap) {
      const mapped = aliasMap.get(`${exp}-`);
      if (mapped) return mapped.replace(/-$/, '');
    }
    return exp;
  }
  if (/social|sweat|marketing|enabler/i.test(member)) return 'SWEAT';
  if (/pdx/i.test(member)) return 'PDXGL';
  return 'HUCK';
}

export function normalizePolicyConfig(raw?: Partial<CoopPolicyConfig>): CoopPolicyConfig {
  const base = { ...DEFAULT_COOP_POLICY_CONFIG, ...(raw || {}) };
  const curatorSharePct = Math.min(95, Math.max(50, Math.round(Number(base.curatorSharePct) || 70)));
  const commonsSharePct = 100 - curatorSharePct;

  let reserveSharePct = Math.min(100, Math.max(0, Math.round(Number(base.reserveSharePct ?? 10))));
  let salesPatronagePct = Math.min(100, Math.max(0, Math.round(Number(base.salesPatronagePct ?? 60))));
  let laborPatronagePct = Math.min(100, Math.max(0, Math.round(Number(base.laborPatronagePct ?? 30))));

  const sumExcess = reserveSharePct + salesPatronagePct + laborPatronagePct;
  if (sumExcess !== 100) {
    salesPatronagePct = Math.max(0, 100 - reserveSharePct - laborPatronagePct);
  }

  const rawMembers =
    Array.isArray(base.members) && base.members.length > 0
      ? base.members
      : DEFAULT_COOP_POLICY_CONFIG.members;
  const members: CoopMemberProfile[] = rawMembers.map((m) => {
    const validHats = (Array.isArray(m.hats) ? m.hats : []).filter((h): h is MemberHat => h in MEMBER_HAT_META);
    const cleanPartner = sanitizePrefixRootInput(m.partner) || 'HUCK';
    const hats = validHats.length > 0 ? validHats : defaultHatsFor(cleanPartner, m.role);
    const usesPrefix = hats.some((h) => MEMBER_HAT_META[h].usesPrefix);
    const explicitInv = m.inventoryPrefix ? formatAutoHyphenPrefix(m.inventoryPrefix) : undefined;
    const requestedPref = m.requestedPrefix ? formatAutoHyphenPrefix(m.requestedPrefix) : undefined;
    const isExplicitlyUnsetOrRequested = m.prefixStatus === 'unset' || m.prefixStatus === 'requested';
    const resolvedInv = usesPrefix
      ? explicitInv ||
        (!isExplicitlyUnsetOrRequested && !requestedPref && cleanPartner !== 'SWEAT'
          ? `${cleanPartner}-`
          : undefined)
      : undefined;
    const resolvedStatus: PrefixLifecycleStatus =
      m.prefixStatus === 'locked' && resolvedInv
        ? 'locked'
        : m.prefixStatus === 'requested' || (!resolvedInv && Boolean(requestedPref))
          ? 'requested'
          : resolvedInv
            ? 'locked'
            : 'unset';
    const historicalPrefixes = Array.isArray(m.historicalPrefixes)
      ? Array.from(
          new Set(
            m.historicalPrefixes
              .map((h) => formatAutoHyphenPrefix(h))
              .filter((h) => h && h !== resolvedInv)
          )
        )
      : undefined;
    const syncedPartner = resolvedInv ? resolvedInv.replace(/-$/, '') : cleanPartner;

    return {
      ...m,
      partner: syncedPartner,
      userId: m.userId ? String(m.userId).trim() : undefined,
      email: m.email ? String(m.email).trim().toLowerCase() : undefined,
      hats,
      inventoryPrefix: resolvedInv,
      prefixStatus: resolvedStatus,
      requestedPrefix: requestedPref,
      prefixLockedAt: m.prefixLockedAt ? String(m.prefixLockedAt) : undefined,
      prefixLockedBy: m.prefixLockedBy ? String(m.prefixLockedBy) : undefined,
      historicalPrefixes: historicalPrefixes && historicalPrefixes.length > 0 ? historicalPrefixes : undefined,
      canVote: hats.some((h) => MEMBER_HAT_META[h].canVote),
    };
  });

  const rawConsignors = Array.isArray(base.consignors) ? base.consignors : DEFAULT_CONSIGNOR_AGREEMENTS;
  const consignors: ConsignorAgreementConfig[] = rawConsignors
    .filter((c) => c && String(c.prefix || '').trim())
    .map((c) => {
      const prefix = String(c.prefix).trim().toUpperCase().replace(/[-_]+$/, '') + '-';
      const mode: ConsignorDealMode =
        c.mode === 'flat_commission' || c.mode === 'fixed_shelf_rent' ? c.mode : 'pro_rata_rent';
      return {
        prefix,
        displayName: String(c.displayName || `${prefix.replace(/-$/, '')} Consignor`),
        mode,
        coopCommissionPct: Math.min(60, Math.max(0, Number(c.coopCommissionPct ?? 20))),
        fixedMonthlyRent: Math.max(0, Number(c.fixedMonthlyRent ?? 0)),
        capRentAtNetSales: c.capRentAtNetSales !== false,
        notes: c.notes ? String(c.notes) : undefined,
      };
    });

  const icaRetainedPct = Math.min(50, Math.max(0, Math.round(Number(base.icaRetainedPct ?? 0))));
  const sweatSalesPoolMode: SweatSalesPoolMode =
    base.sweatSalesPoolMode === 'equal_all' ? 'equal_all' : 'labor_only';
  const rawAutoApprovePo = Number(base.autoApproveReceiptPoMaxUsd);
  const autoApproveReceiptPoMaxUsd = Number.isFinite(rawAutoApprovePo)
    ? Math.min(5000, Math.max(0, Math.round(rawAutoApprovePo * 100) / 100))
    : 25;

  return {
    consignors,
    curatorSharePct,
    commonsSharePct,
    reserveSharePct,
    salesPatronagePct,
    laborPatronagePct,
    reserveCapTarget: Math.max(0, Number(base.reserveCapTarget ?? 500)),
    currentReserveBalance: Math.max(0, Number(base.currentReserveBalance ?? 0)),
    carriedOverShortfall: Math.max(0, Number(base.carriedOverShortfall ?? 0)),
    icaRetainedPct,
    sweatSalesPoolMode,
    icaAnnualYieldRatePct: Math.min(25, Math.max(0, Number(base.icaAnnualYieldRatePct ?? 7))),
    payRatioCapStandard: Math.min(6.5, Math.max(1, Number(base.payRatioCapStandard ?? 4.5))),
    minAgreeVotes: Math.max(1, Math.round(Number(base.minAgreeVotes ?? 2))),
    orphanClaimWindowDays: Math.max(7, Math.round(Number(base.orphanClaimWindowDays ?? 30))),
    autoApproveReceiptPoMaxUsd,
    members,
  };
}

export function effectiveLaborApproval(entry?: Pick<CoopLaborEntry, 'approval'> | null): LaborApprovalStatus {
  if (!entry) return 'pending';
  if (entry.approval === 'approved' || entry.approval === 'rejected') return entry.approval;
  return 'pending';
}

export function isDemoSeedLaborEntry(entry?: Pick<CoopLaborEntry, 'id'> | null): boolean {
  return String(entry?.id || '').startsWith('labor-seed-');
}

export function isValidLaborEntryData(entry?: Pick<CoopLaborEntry, 'date' | 'hours'> | null): boolean {
  if (!entry) return false;
  const monthKey = laborEntryMonthKey(entry.date);
  if (!monthKey) return false;
  const hrs = Number(entry.hours);
  return Number.isFinite(hrs) && hrs > 0 && hrs <= 24;
}

/**
 * Settlement Eligibility Gate (§5 items 24–25 & §6):
 * Must NOT be a demo seed row, MUST have valid calendar date + hours > 0, and MUST be explicitly 'approved'.
 */
export function isSettlementEligibleLabor(entry?: CoopLaborEntry | null): boolean {
  if (!entry) return false;
  return (
    !isDemoSeedLaborEntry(entry) &&
    isValidLaborEntryData(entry) &&
    entry.approval === 'approved'
  );
}

/**
 * Normalizes cloud/legacy labor entries WITHOUT fabricating dates, hours, or demo seed rows (§5 items 24–25 & §6).
 */
export function normalizeLaborEntries(raw?: any[]): CoopLaborEntry[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }
  return raw.map((entry, idx) => {
    const member = String(entry?.member || '').trim().replace('Tyler (Core)', 'Mike (HUCK)');
    const rawHours = Number(entry?.hours);
    const hours = Number.isFinite(rawHours) ? Number(rawHours.toFixed(2)) : 0;
    const rawApproval = entry?.approval;
    const approval: LaborApprovalStatus | undefined =
      rawApproval === 'approved' || rawApproval === 'pending' || rawApproval === 'rejected'
        ? rawApproval
        : undefined;
    const catCandidate = String(entry?.category || 'Booth Restock') as CoopLaborCategory;
    const category: CoopLaborCategory = COOP_LABOR_CATEGORIES.includes(catCandidate)
      ? catCandidate
      : 'Booth Restock';
    const functionTag: CoopLaborFunctionTag = isCoopLaborFunctionTag(entry?.functionTag)
      ? entry.functionTag
      : normalizeFunctionTag(entry?.functionTag, category);
    const rawPoints = Number(entry?.points);
    const points = Number.isFinite(rawPoints) && rawPoints > 0 ? Number(rawPoints.toFixed(2)) : undefined;
    const peerApprovals: CoopTaskPeerApproval[] | undefined = Array.isArray(entry?.peerApprovals)
      ? entry.peerApprovals
          .filter((p: any) => p && p.userId)
          .map((p: any) => ({
            userId: String(p.userId).trim(),
            name: String(p.name || 'Member').trim(),
            isFounder: p.isFounder === true ? true : undefined,
            at: String(p.at || '').trim(),
          }))
      : undefined;

    return {
      id: String(entry?.id || `labor-${idx + 1}`),
      date: String(entry?.date ?? '').trim().slice(0, 10),
      member: member || 'Member',
      memberUserId: entry?.memberUserId ? String(entry.memberUserId).trim() : undefined,
      partner: inferPartnerFromMemberName(member || 'Member', entry?.partner),
      category,
      functionTag,
      hours,
      points,
      taskId: entry?.taskId ? String(entry.taskId).trim() : undefined,
      ownBarcodeWarning: entry?.ownBarcodeWarning === true ? true : undefined,
      peerApprovals,
      notes: String(entry?.notes || ''),
      deliverableRef: entry?.deliverableRef ? String(entry.deliverableRef).trim() : undefined,
      approval,
      approvedBy: entry?.approvedBy ? String(entry.approvedBy).trim() : undefined,
      approvedByUserId: entry?.approvedByUserId ? String(entry.approvedByUserId).trim() : undefined,
      approvedAt: entry?.approvedAt ? String(entry.approvedAt).trim() : undefined,
      decisionNote: entry?.decisionNote ? String(entry.decisionNote).trim() : undefined,
      selfApproved: entry?.selfApproved === true ? true : undefined,
      loggedByUserId: entry?.loggedByUserId ? String(entry.loggedByUserId).trim() : undefined,
      loggedByName: entry?.loggedByName ? String(entry.loggedByName).trim() : undefined,
      updatedAt: entry?.updatedAt ? String(entry.updatedAt).trim() : undefined,
    };
  });
}

export function summarizeLaborApproval(
  entries: CoopLaborEntry[],
  monthKey: string
): LaborApprovalSummary {
  let approvedHours = 0;
  let pendingHours = 0;
  let rejectedHours = 0;
  let approvedCount = 0;
  let pendingCount = 0;
  let rejectedCount = 0;
  let legacyPendingCount = 0;
  let invalidExcludedCount = 0;
  let latestApprovedAt: string | undefined;

  for (const entry of entries || []) {
    if (isDemoSeedLaborEntry(entry)) continue;

    const entryMonth = laborEntryMonthKey(entry.date);
    if (!isValidLaborEntryData(entry)) {
      if (monthKey === 'all' || !entryMonth || entryMonth === monthKey) {
        invalidExcludedCount += 1;
      }
      continue;
    }

    if (monthKey !== 'all' && entryMonth !== monthKey) continue;

    const hrs = Number(entry.hours) || 0;
    const status = effectiveLaborApproval(entry);
    if (status === 'approved') {
      approvedHours = Number((approvedHours + hrs).toFixed(2));
      approvedCount += 1;
      if (entry.approvedAt && (!latestApprovedAt || entry.approvedAt > latestApprovedAt)) {
        latestApprovedAt = entry.approvedAt;
      }
    } else if (status === 'rejected') {
      rejectedHours = Number((rejectedHours + hrs).toFixed(2));
      rejectedCount += 1;
    } else {
      pendingHours = Number((pendingHours + hrs).toFixed(2));
      pendingCount += 1;
      if (!entry.approval) legacyPendingCount += 1;
    }
  }

  return {
    approvedHours,
    pendingHours,
    rejectedHours,
    approvedCount,
    pendingCount,
    rejectedCount,
    legacyPendingCount,
    invalidExcludedCount,
    latestApprovedAt,
  };
}

function resolveEntryPartnerWithRoster(
  entry: Pick<CoopLaborEntry, 'member' | 'memberUserId' | 'partner'>,
  roster: ReadonlyArray<CoopMemberProfile> = [],
  aliasMap?: ReadonlyMap<string, string>
): string {
  const uid = String(entry.memberUserId || '').trim();
  const memberLower = String(entry.member || '').trim().toLowerCase();
  const rosterMatch =
    (uid ? roster.find((r) => r.userId && r.userId.trim() === uid) : undefined) ||
    (memberLower ? roster.find((r) => r.name.trim().toLowerCase() === memberLower) : undefined);

  if (rosterMatch?.inventoryPrefix) {
    return formatAutoHyphenPrefix(rosterMatch.inventoryPrefix).replace(/-$/, '');
  }
  return inferPartnerFromMemberName(entry.member, entry.partner, aliasMap);
}

export function getLaborHoursByPartnerForMonth(
  entries: CoopLaborEntry[],
  monthKey: string,
  opts: { status?: 'approved' | 'all' | 'pending'; roster?: ReadonlyArray<CoopMemberProfile> } = { status: 'approved' }
): Record<string, number> {
  const mode = opts.status || 'approved';
  const roster = opts.roster || [];
  const aliasMap = buildMemberPrefixAliasMap(roster);
  const totals: Record<string, number> = { HUCK: 0, PDXGL: 0, SWEAT: 0 };
  for (const m of roster) {
    const root = sanitizePrefixRootInput(m.inventoryPrefix || m.partner);
    if (root && totals[root] === undefined) totals[root] = 0;
  }
  for (const entry of entries || []) {
    if (isDemoSeedLaborEntry(entry) || !isValidLaborEntryData(entry)) continue;
    const entryMonth = laborEntryMonthKey(entry.date);
    if (monthKey !== 'all' && entryMonth !== monthKey) continue;

    const status = effectiveLaborApproval(entry);
    if (mode === 'approved' && status !== 'approved') continue;
    if (mode === 'pending' && status !== 'pending') continue;
    if (mode === 'all' && status === 'rejected') continue;

    const partner = resolveEntryPartnerWithRoster(entry, roster, aliasMap);
    totals[partner] = Number(((totals[partner] || 0) + (Number(entry.hours) || 0)).toFixed(2));
  }
  return totals;
}

export function getLaborHoursByMemberForMonth(
  entries: CoopLaborEntry[],
  monthKey: string,
  roster: CoopMemberProfile[] = DEFAULT_COOP_POLICY_CONFIG.members,
  opts: { status?: 'approved' | 'all' | 'pending' } = { status: 'approved' }
): MemberLaborShareSummary[] {
  const mode = opts.status || 'approved';
  const aliasMap = buildMemberPrefixAliasMap(roster);
  const map = new Map<
    string,
    {
      member: string;
      partner: string;
      roleLabel: string;
      approvedHours: number;
      pendingHours: number;
      rejectedHours: number;
      deliverableRefsSet: Set<string>;
      enablerHours: number;
      producerHours: number;
      entries: CoopLaborEntry[];
      approvedBySet: Set<string>;
      latestApprovedAt?: string;
    }
  >();

  let totalApprovedHours = 0;

  for (const entry of entries || []) {
    if (isDemoSeedLaborEntry(entry) || !isValidLaborEntryData(entry)) continue;
    const entryMonth = laborEntryMonthKey(entry.date);
    if (monthKey !== 'all' && entryMonth !== monthKey) continue;

    const status = effectiveLaborApproval(entry);
    if (mode === 'approved' && status !== 'approved') continue;
    if (mode === 'pending' && status !== 'pending') continue;
    if (mode === 'all' && status === 'rejected') continue;

    const hrs = Math.max(0, Number(entry.hours) || 0);
    if (hrs <= 0) continue;

    const memberName = String(entry.member || 'Member').trim();
    const mapKey = memberName.toLowerCase();
    const partner = resolveEntryPartnerWithRoster(entry, roster, aliasMap);
    const exactRosterMatch = roster.find((r) => r.name.trim().toLowerCase() === mapKey);
    const partnerRosterFallback = roster.find((r) => r.partner === partner);
    const rosterMatch = exactRosterMatch || partnerRosterFallback;

    const roleLabel =
      partner === 'SWEAT' || rosterMatch?.role === 'Marketing & Social Enabler'
        ? 'Marketing & Social Enabler'
        : rosterMatch?.role || 'Curator Worker-Member';

    const laborRole = classifySurplusLaborRole(entry.category);

    let bucket = map.get(mapKey);
    if (!bucket) {
      bucket = {
        member: exactRosterMatch?.name || memberName,
        partner,
        roleLabel,
        approvedHours: 0,
        pendingHours: 0,
        rejectedHours: 0,
        deliverableRefsSet: new Set<string>(),
        enablerHours: 0,
        producerHours: 0,
        entries: [],
        approvedBySet: new Set<string>(),
      };
      map.set(mapKey, bucket);
    }

    bucket.entries.push(entry);

    if (status === 'approved') {
      totalApprovedHours += hrs;
      bucket.approvedHours = Number((bucket.approvedHours + hrs).toFixed(2));
      if (entry.deliverableRef) bucket.deliverableRefsSet.add(entry.deliverableRef);
      if (laborRole === 'Enabler of Surplus') {
        bucket.enablerHours = Number((bucket.enablerHours + hrs).toFixed(2));
      } else {
        bucket.producerHours = Number((bucket.producerHours + hrs).toFixed(2));
      }
      if (entry.approvedBy) bucket.approvedBySet.add(entry.approvedBy);
      if (entry.approvedAt && (!bucket.latestApprovedAt || entry.approvedAt > bucket.latestApprovedAt)) {
        bucket.latestApprovedAt = entry.approvedAt;
      }
    } else if (status === 'pending') {
      bucket.pendingHours = Number((bucket.pendingHours + hrs).toFixed(2));
      if (mode === 'pending' && entry.deliverableRef) {
        bucket.deliverableRefsSet.add(entry.deliverableRef);
      }
    } else {
      bucket.rejectedHours = Number((bucket.rejectedHours + hrs).toFixed(2));
    }
  }

  return Array.from(map.values())
    .sort((a, b) => {
      if (b.approvedHours !== a.approvedHours) return b.approvedHours - a.approvedHours;
      if (b.pendingHours !== a.pendingHours) return b.pendingHours - a.pendingHours;
      return a.member.localeCompare(b.member);
    })
    .map((item) => {
      const sortedEntries = item.entries
        .slice()
        .sort((x, y) => String(y.date || '').localeCompare(String(x.date || '')));
      const deliverableRefs = Array.from(item.deliverableRefsSet);
      const basisHours = mode === 'pending' ? item.pendingHours : item.approvedHours;
      return {
        member: item.member,
        partner: item.partner,
        roleLabel: item.roleLabel,
        hours: basisHours,
        approvedHours: item.approvedHours,
        pendingHours: item.pendingHours,
        rejectedHours: item.rejectedHours,
        sharePct:
          totalApprovedHours > 0 && mode !== 'pending'
            ? Number(((item.approvedHours / totalApprovedHours) * 100).toFixed(1))
            : 0,
        deliverableCount: deliverableRefs.length,
        deliverableRefs,
        enablerHours: item.enablerHours,
        producerHours: item.producerHours,
        entries: sortedEntries,
        approvedByNames: Array.from(item.approvedBySet),
        latestApprovedAt: item.latestApprovedAt,
      };
    });
}

function readLocalGovernanceFallback(defaultProposals: CoopProposal[]): CoopGovernanceCloudState {
  let proposals = defaultProposals;
  let surplusPolicyMode: SurplusPolicyMode = 'patronage_90_10';
  let surplusSplitBasis: SurplusSplitBasis = 'volume';
  let policyConfig: CoopPolicyConfig = { ...DEFAULT_COOP_POLICY_CONFIG };

  if (typeof window !== 'undefined') {
    try {
      const savedProposals = localStorage.getItem(LOCAL_STORAGE_PROPOSALS_KEY);
      if (savedProposals) {
        const parsed = JSON.parse(savedProposals);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasSurplusProp = parsed.some((p: CoopProposal) => p.id === 'prop-surplus-policy');
          proposals =
            hasSurplusProp && defaultProposals[0]
              ? parsed
              : defaultProposals.length > 0
                ? [defaultProposals[0], ...parsed]
                : parsed;
        }
      }
      const savedMode = localStorage.getItem(LOCAL_STORAGE_POLICY_MODE_KEY);
      if (savedMode === 'patronage_90_10' || savedMode === 'cap_100' || savedMode === 'reserve_100') {
        surplusPolicyMode = savedMode;
      }
      const savedBasis = localStorage.getItem(LOCAL_STORAGE_SPLIT_BASIS_KEY);
      if (savedBasis === 'volume' || savedBasis === 'equal') {
        surplusSplitBasis = savedBasis;
      }
      const savedPolicyConfig = localStorage.getItem(LOCAL_STORAGE_POLICY_CONFIG_KEY);
      if (savedPolicyConfig) {
        policyConfig = normalizePolicyConfig(JSON.parse(savedPolicyConfig));
      }
    } catch (err) {
      console.warn('[coopGovernance] LocalStorage fallback read warning:', err);
    }
  }

  return {
    proposals,
    surplusPolicyMode,
    surplusSplitBasis,
    policyConfig,
    laborEntries: [],
    updatedAt: new Date().toISOString(),
  };
}

function mirrorToLocalStorage(state: Partial<CoopGovernanceCloudState>): void {
  if (typeof window === 'undefined') return;
  try {
    if (state.proposals) {
      localStorage.setItem(LOCAL_STORAGE_PROPOSALS_KEY, JSON.stringify(state.proposals));
    }
    if (state.surplusPolicyMode) {
      localStorage.setItem(LOCAL_STORAGE_POLICY_MODE_KEY, state.surplusPolicyMode);
    }
    if (state.surplusSplitBasis) {
      localStorage.setItem(LOCAL_STORAGE_SPLIT_BASIS_KEY, state.surplusSplitBasis);
    }
    if (state.policyConfig) {
      localStorage.setItem(LOCAL_STORAGE_POLICY_CONFIG_KEY, JSON.stringify(state.policyConfig));
    }
  } catch (err) {
    console.warn('[coopGovernance] LocalStorage mirror warning:', err);
  }
}

export async function loadCoopGovernanceState(
  defaultProposals: CoopProposal[] = [],
  tenantId = 'huck_collective'
): Promise<{ state: CoopGovernanceCloudState; syncedFromCloud: boolean }> {
  const localState = readLocalGovernanceFallback(defaultProposals);
  const dbId = getDatabaseId();

  let parsedSnapshot: Partial<CoopGovernanceCloudState> = {};
  let manifestLoaded = false;
  let manifestUpdatedAt = '';

  try {
    const doc: any = await databases.getDocument(dbId, MANIFESTS_COL_ID, COOP_GOVERNANCE_DOC_ID);
    manifestLoaded = true;
    manifestUpdatedAt = doc.$updatedAt || '';
    if (typeof doc.itemsSnapshot === 'string' && doc.itemsSnapshot.trim().startsWith('{')) {
      parsedSnapshot = JSON.parse(doc.itemsSnapshot);
    } else if (typeof doc.notes === 'string' && doc.notes.trim().startsWith('{')) {
      parsedSnapshot = JSON.parse(doc.notes);
    }
  } catch (err: any) {
    if (err?.code === 404 && defaultProposals.length > 0) {
      await saveCoopGovernanceState(localState, tenantId);
    }
  }

  let legacyProposals: CoopProposal[] =
    Array.isArray(parsedSnapshot.proposals) && parsedSnapshot.proposals.length > 0
      ? parsedSnapshot.proposals.map((p) => docToCoopProposal({ ...p, $id: p.id }))
      : localState.proposals;

  if (defaultProposals.length > 0 && !legacyProposals.some((p) => p.id === 'prop-surplus-policy')) {
    legacyProposals = [defaultProposals[0], ...legacyProposals];
  }

  let collectionProposals: CoopProposal[] = [];
  let collectionLoaded = false;

  try {
    const res = await databases.listDocuments(dbId, COOP_PROPOSALS_COL_ID, [
      Query.orderDesc('$id'),
      Query.limit(100),
    ]);
    collectionLoaded = true;
    collectionProposals = (res.documents || []).map((doc) => docToCoopProposal(doc));

    // Zero-loss forward sync: if any legacy proposal in manifests is missing from coop_proposals, migrate it
    const existingIds = new Set(collectionProposals.map((p) => p.id));
    for (const legacyProp of legacyProposals) {
      if (legacyProp?.id && !existingIds.has(legacyProp.id)) {
        collectionProposals.push(legacyProp);
        existingIds.add(legacyProp.id);
        saveSingleCoopProposal(legacyProp, tenantId).catch(() => {});
      }
    }
  } catch (colErr) {
    console.warn('[coopGovernance] coop_proposals list fallback to manifest/local:', colErr);
  }

  const mergedProposals = (collectionLoaded && collectionProposals.length > 0 ? collectionProposals : legacyProposals)
    .slice()
    .sort((a, b) => {
      const dateCmp = String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      if (dateCmp !== 0) return dateCmp;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });

  const surplusPolicyMode: SurplusPolicyMode =
    parsedSnapshot.surplusPolicyMode === 'patronage_90_10' ||
    parsedSnapshot.surplusPolicyMode === 'cap_100' ||
    parsedSnapshot.surplusPolicyMode === 'reserve_100'
      ? parsedSnapshot.surplusPolicyMode
      : localState.surplusPolicyMode;

  const surplusSplitBasis: SurplusSplitBasis =
    parsedSnapshot.surplusSplitBasis === 'volume' || parsedSnapshot.surplusSplitBasis === 'equal'
      ? parsedSnapshot.surplusSplitBasis
      : localState.surplusSplitBasis;

  const policyConfig = parsedSnapshot.policyConfig
    ? normalizePolicyConfig(parsedSnapshot.policyConfig)
    : localState.policyConfig;

  // After server migration (`laborMigratedAt` set), ignore legacy manifest laborEntries forever (§7.3)
  const legacyLaborEntries =
    !parsedSnapshot.laborMigratedAt &&
    Array.isArray(parsedSnapshot.laborEntries) &&
    parsedSnapshot.laborEntries.length > 0
      ? normalizeLaborEntries(parsedSnapshot.laborEntries)
      : [];

  const cloudState: CoopGovernanceCloudState = {
    proposals: mergedProposals,
    surplusPolicyMode,
    surplusSplitBasis,
    policyConfig,
    laborEntries: legacyLaborEntries,
    laborMigratedAt: parsedSnapshot.laborMigratedAt ? String(parsedSnapshot.laborMigratedAt) : undefined,
    updatedAt: manifestUpdatedAt || parsedSnapshot.updatedAt || new Date().toISOString(),
  };

  mirrorToLocalStorage(cloudState);
  return { state: cloudState, syncedFromCloud: collectionLoaded || manifestLoaded };
}

/**
 * Atomic per-proposal cloud upsert in `resale_db.coop_proposals` (prevents multi-voter overwrite races).
 */
export async function saveSingleCoopProposal(
  proposal: CoopProposal,
  tenantId = 'huck_collective'
): Promise<boolean> {
  const dbId = getDatabaseId();
  const docId = String(proposal.id || `prop-${Date.now()}`).slice(0, 36);
  const normalized: CoopProposal = {
    ...proposal,
    id: docId,
    title: cleanEscapedCurrency(proposal.title),
    description: cleanEscapedCurrency(proposal.description),
    rationale: cleanEscapedCurrency(proposal.rationale),
    financialImpact: proposal.financialImpact ? cleanEscapedCurrency(proposal.financialImpact) : undefined,
    updatedAt: new Date().toISOString(),
  };

  const local = readLocalGovernanceFallback([]);
  const idx = local.proposals.findIndex((p) => p.id === docId);
  const nextLocalProposals =
    idx >= 0
      ? local.proposals.map((p, i) => (i === idx ? normalized : p))
      : [normalized, ...local.proposals];
  mirrorToLocalStorage({ proposals: nextLocalProposals });

  const payload = proposalToDocPayload(normalized, tenantId);

  try {
    try {
      await databases.updateDocument(dbId, COOP_PROPOSALS_COL_ID, docId, payload);
    } catch (updateErr: any) {
      if (updateErr?.code === 404) {
        await databases.createDocument(dbId, COOP_PROPOSALS_COL_ID, docId, payload, [
          Permission.read(Role.any()),
          Permission.update(Role.users()),
          Permission.delete(Role.users()),
        ]);
      } else {
        throw updateErr;
      }
    }
    return true;
  } catch (err) {
    console.warn('[coopGovernance] saveSingleCoopProposal fallback to manifest:', err);
    return saveCoopGovernanceState({ proposals: nextLocalProposals }, tenantId);
  }
}

export async function deleteCoopProposal(
  proposalId: string,
  tenantId = 'huck_collective'
): Promise<boolean> {
  const dbId = getDatabaseId();
  const local = readLocalGovernanceFallback([]);
  const nextLocalProposals = local.proposals.filter((p) => p.id !== proposalId);
  mirrorToLocalStorage({ proposals: nextLocalProposals });

  let deletedFromCol = false;
  try {
    await databases.deleteDocument(dbId, COOP_PROPOSALS_COL_ID, proposalId);
    deletedFromCol = true;
  } catch (err: any) {
    if (err?.code === 404) {
      deletedFromCol = true;
    } else {
      console.warn('[coopGovernance] deleteCoopProposal warning:', err);
    }
  }

  await saveCoopGovernanceState({ proposals: nextLocalProposals }, tenantId).catch(() => {});
  return deletedFromCol;
}

/**
 * Saves governance proposals & policy dials ONLY.
 * Browser writes NEVER modify `laborEntries` (§7.3 — labor lives in server-only `coop_ledger`).
 */
export async function saveCoopGovernanceState(
  partial: Partial<Omit<CoopGovernanceCloudState, 'laborEntries'>>,
  tenantId = 'huck_collective'
): Promise<boolean> {
  mirrorToLocalStorage(partial);
  const dbId = getDatabaseId();

  try {
    let existing: any = readLocalGovernanceFallback([]);
    try {
      const currentDoc: any = await databases.getDocument(dbId, MANIFESTS_COL_ID, COOP_GOVERNANCE_DOC_ID);
      if (typeof currentDoc.itemsSnapshot === 'string' && currentDoc.itemsSnapshot.trim().startsWith('{')) {
        existing = { ...existing, ...JSON.parse(currentDoc.itemsSnapshot) };
      }
    } catch {
      // Document doesn't exist yet; will create below
    }

    const nextPolicy = normalizePolicyConfig(partial.policyConfig ?? existing.policyConfig);
    const preservedLegacyLabor = Array.isArray(existing.laborEntries) ? existing.laborEntries : [];

    const nextSnapshot: Record<string, any> = {
      proposals: partial.proposals ?? existing.proposals ?? [],
      surplusPolicyMode: partial.surplusPolicyMode ?? existing.surplusPolicyMode ?? 'patronage_90_10',
      surplusSplitBasis: partial.surplusSplitBasis ?? existing.surplusSplitBasis ?? 'volume',
      policyConfig: nextPolicy,
      laborEntries: preservedLegacyLabor,
      updatedAt: new Date().toISOString(),
    };
    if (existing.laborMigratedAt) {
      nextSnapshot.laborMigratedAt = existing.laborMigratedAt;
    }

    mirrorToLocalStorage({
      proposals: nextSnapshot.proposals,
      surplusPolicyMode: nextSnapshot.surplusPolicyMode,
      surplusSplitBasis: nextSnapshot.surplusSplitBasis,
      policyConfig: nextPolicy,
    });

    const serialized = JSON.stringify(nextSnapshot);
    const docPayload = {
      name: 'Co-op Democratic Governance & Surplus Policy Ledger',
      tenantId: tenantId || 'huck_collective',
      locationId: 'COOP_GOVERNANCE',
      locationName: 'Huckleberry Co-op Governance',
      status: 'governance_state',
      itemsSnapshot: serialized,
      itemCount: nextSnapshot.proposals.length,
      notes: JSON.stringify({
        surplusPolicyMode: nextSnapshot.surplusPolicyMode,
        surplusSplitBasis: nextSnapshot.surplusSplitBasis,
        curatorSharePct: nextPolicy.curatorSharePct,
        commonsSharePct: nextPolicy.commonsSharePct,
        reserveSharePct: nextPolicy.reserveSharePct,
        salesPatronagePct: nextPolicy.salesPatronagePct,
        laborPatronagePct: nextPolicy.laborPatronagePct,
        icaRetainedPct: nextPolicy.icaRetainedPct,
        sweatSalesPoolMode: nextPolicy.sweatSalesPoolMode,
        carriedOverShortfall: nextPolicy.carriedOverShortfall,
        proposalCount: nextSnapshot.proposals.length,
        updatedAt: nextSnapshot.updatedAt,
      }).slice(0, 4900),
    };

    try {
      await databases.updateDocument(dbId, MANIFESTS_COL_ID, COOP_GOVERNANCE_DOC_ID, docPayload);
    } catch (updateErr: any) {
      if (updateErr?.code === 404) {
        await databases.createDocument(dbId, MANIFESTS_COL_ID, COOP_GOVERNANCE_DOC_ID, docPayload, [
          Permission.read(Role.any()),
          Permission.update(Role.any()),
          Permission.delete(Role.any()),
        ]);
      } else {
        throw updateErr;
      }
    }
    return true;
  } catch (err) {
    console.warn('[coopGovernance] Appwrite cloud sync fallback to localStorage:', err);
    return false;
  }
}

/**
 * Logs Sweat-Equity / Dropcast labor strictly through the server-enforced `/api/coop/labor` endpoint (§7.3).
 */
export async function logSweatEquityLaborEntry(
  input: {
    member?: string;
    partner?: 'HUCK' | 'PDXGL' | 'SWEAT';
    category?: CoopLaborCategory;
    hours: number;
    deliverableRef?: string;
    notes?: string;
    date?: string;
  },
  tenantId = 'huck_collective'
): Promise<{ entry: CoopLaborEntry; syncedToCloud: boolean; error?: string }> {
  const { state } = await loadCoopGovernanceState([], tenantId);
  const sweatMember =
    state.policyConfig.members.find((m) => m.partner === 'SWEAT') ||
    state.policyConfig.members[0] || {
      name: 'Jesse (Social & Ops)',
      partner: 'SWEAT' as const,
    };

  const memberName = (input.member || sweatMember.name).trim();
  const partnerPrefix =
    input.partner || inferPartnerFromMemberName(memberName, sweatMember.partner);
  const workDate = (input.date || pacificTodayYmd()).slice(0, 10);
  const hours = Math.min(24, Math.max(0.25, Number(input.hours || 1)));
  const category = input.category || 'Social & Marketing';
  const notes = input.notes?.trim() || 'Dropcast social reel & marketing contribution';
  const deliverableRef = input.deliverableRef?.trim() || undefined;

  try {
    const res = await mutateCoopLabor({
      mode: 'log',
      date: workDate,
      member: memberName,
      partner: partnerPrefix,
      category,
      hours,
      notes,
      deliverableRef,
    });
    if (res.entry) {
      return { entry: res.entry, syncedToCloud: true };
    }
  } catch (err: any) {
    console.warn('[coopGovernance] Server labor log rejected:', err?.message || err);
    const fallbackEntry: CoopLaborEntry = {
      id: `labor-unsynced-${Date.now()}`,
      date: workDate,
      member: memberName,
      partner: partnerPrefix,
      category,
      hours,
      deliverableRef,
      notes,
      approval: 'pending',
    };
    return {
      entry: fallbackEntry,
      syncedToCloud: false,
      error: err?.message || 'Unable to save labor entry to server ledger.',
    };
  }

  const fallbackEntry: CoopLaborEntry = {
    id: `labor-unsynced-${Date.now()}`,
    date: workDate,
    member: memberName,
    partner: partnerPrefix,
    category,
    hours,
    deliverableRef,
    notes,
    approval: 'pending',
  };
  return { entry: fallbackEntry, syncedToCloud: false };
}

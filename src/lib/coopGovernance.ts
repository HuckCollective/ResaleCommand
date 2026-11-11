import { databases, Query } from './appwrite';
import { Permission, Role } from 'appwrite';
import { getDatabaseId } from './appwriteEnv';
import { cleanEscapedCurrency } from './safeMarkdown';

export type LoomioSignal = 'agree' | 'abstain' | 'disagree' | 'block';
export type SurplusPolicyMode = 'patronage_90_10' | 'cap_100' | 'reserve_100';
export type SurplusSplitBasis = 'volume' | 'equal';

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
 * Author & Steward Ownership Guard:
 * Allows the original proposer (matched by Appwrite User ID, email, or member persona name)
 * OR a Founder/Steward hat to unlock and edit/amend a proposal.
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
export { MEMBER_HAT_META, canSeeCollectiveFinancials } from './memberHats';
export type { MemberHat, MemberHatMeta } from './memberHats';


/** Barcode prefixes printed on physical booth tags. Never editable or removable once registered. */
export const PROTECTED_BARCODE_PREFIXES: readonly string[] = ['HUCK-', 'PDXGL-', 'BB-'];

export function isProtectedPrefix(prefix: string, usedPrefixes: string[] = []): boolean {
  const key = String(prefix || '').trim().toUpperCase();
  return PROTECTED_BARCODE_PREFIXES.includes(key) || usedPrefixes.map((p) => p.toUpperCase()).includes(key);
}

/** Only a member wearing the Founder hat (or the team owner) may save global financial settings. */
export function canMemberEditGlobalFinancials(
  member: { hats?: MemberHat[] } | undefined | null,
  isTeamOwner = false
): boolean {
  return isTeamOwner || !!member?.hats?.includes('founder');
}

function defaultHatsFor(partner: string, role?: string): MemberHat[] {
  if (partner === 'BB' || role === 'Consignor') return ['consignor'];
  if (partner === 'SWEAT' || role === 'Marketing & Social Enabler') return ['promoter', 'enabler'];
  if (partner === 'PDXGL') return ['curator'];
  return ['founder', 'curator', 'promoter'];
}

export interface CoopMemberProfile {
  name: string;
  partner: 'HUCK' | 'PDXGL' | 'SWEAT' | 'BB';
  role: 'Co-op Member' | 'Partner Curator' | 'Marketing & Social Enabler' | 'Consignor';
  canVote: boolean;
  /** Combinable WSDE hats. Derived from partner/role for legacy records. */
  hats?: MemberHat[];
  /** Physical barcode prefix for Curator/Consignor hats (e.g. 'HUCK-'). */
  inventoryPrefix?: string;
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
  const net = Math.max(0, Number(netStoreDeposit) || 0);
  const pct = Math.min(60, Math.max(0, Number(agreement.coopCommissionPct) || 0)) / 100;
  const round = (n: number) => Number(n.toFixed(2));

  let rent = 0;
  let commission = 0;
  let formulaLabel = '';

  if (agreement.mode === 'flat_commission') {
    commission = round(net * pct);
    formulaLabel = `Straight Consignment Split (${round(100 - pct * 100)}% Consignor / ${round(pct * 100)}% Co-op)`;
  } else if (agreement.mode === 'fixed_shelf_rent') {
    const fixed = isMonthInProgress ? 0 : Math.max(0, Number(agreement.fixedMonthlyRent) || 0);
    rent = agreement.capRentAtNetSales ? Math.min(fixed, net) : fixed;
    commission = round(Math.max(0, net - rent) * pct);
    formulaLabel = `Fixed Shelf Rent ($${round(Number(agreement.fixedMonthlyRent) || 0).toFixed(2)}/mo)${pct > 0 ? ` + ${round(pct * 100)}% Co-op` : ''}`;
  } else {
    const share = round(grossRatio * boothRent);
    rent = agreement.capRentAtNetSales ? Math.min(share, net) : share;
    formulaLabel = 'Pro-Rata Booth Rent Share';
  }

  rent = round(rent);
  const rawPayout = round(net - rent - commission);
  const payout = agreement.capRentAtNetSales ? Math.max(0, rawPayout) : rawPayout;
  return { rentDeduction: rent, coopCommission: commission, payout, formulaLabel };
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
  /** Mondragon ICA annual target cash bonus yield % on retained member capital balances (default 7%) */
  icaAnnualYieldRatePct: number;
  /** Mondragon pay/bounty ratio compression cap (default 4.5:1 standard, max 6.5:1) */
  payRatioCapStandard: number;
  /** Minimum Agree votes (with 0 Blocks) required to pass a proposal */
  minAgreeVotes: number;
  /** Days before an unlinked register ticket can be swept 100% to Commons Pool */
  orphanClaimWindowDays: number;
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

export type WsdeSurplusLaborRole = 'Producer of Surplus' | 'Enabler of Surplus';

export interface CoopLaborEntry {
  id: string;
  date: string;
  member: string;
  partner: 'HUCK' | 'PDXGL' | 'SWEAT';
  category: CoopLaborCategory;
  hours: number;
  notes: string;
  /** Optional proof link or deliverable reference (e.g. Dropcast ID, Instagram/TikTok Reel URL, Booth Photo batch) */
  deliverableRef?: string;
}

export interface MemberLaborShareSummary {
  member: string;
  partner: 'HUCK' | 'PDXGL' | 'SWEAT';
  roleLabel: string;
  hours: number;
  sharePct: number;
  deliverableCount: number;
  enablerHours: number;
  producerHours: number;
}

export interface CoopGovernanceCloudState {
  proposals: CoopProposal[];
  surplusPolicyMode: SurplusPolicyMode;
  surplusSplitBasis: SurplusSplitBasis;
  policyConfig: CoopPolicyConfig;
  laborEntries: CoopLaborEntry[];
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
  icaAnnualYieldRatePct: 7,
  payRatioCapStandard: 4.5,
  minAgreeVotes: 2,
  orphanClaimWindowDays: 30,
  members: [
    { name: 'Mike (HUCK)', partner: 'HUCK', role: 'Co-op Member', canVote: true },
    { name: 'Tyler (HUCK)', partner: 'HUCK', role: 'Co-op Member', canVote: true },
    { name: 'PDX Partner (PDXGL)', partner: 'PDXGL', role: 'Partner Curator', canVote: true },
    { name: 'Jesse (Social & Ops)', partner: 'SWEAT', role: 'Marketing & Social Enabler', canVote: true },
  ],
};

export const DEFAULT_COOP_LABOR_ENTRIES: CoopLaborEntry[] = [
  {
    id: 'labor-seed-1',
    date: new Date().toISOString().slice(0, 10),
    member: 'Mike (HUCK)',
    partner: 'HUCK',
    category: 'Booth Restock',
    hours: 2.0,
    notes: 'Restocked booth #0EJ, staged vintage pieces & verified Ricochet tags.',
    deliverableRef: 'Booth #0EJ Drop',
  },
  {
    id: 'labor-seed-2',
    date: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10),
    member: 'PDX Partner (PDXGL)',
    partner: 'PDXGL',
    category: 'Photography & Staging',
    hours: 1.5,
    notes: 'Deep Scan photo enrichment on tabletop games & cataloged SKUs.',
    deliverableRef: '18 RPG SKUs Scanned',
  },
  {
    id: 'labor-seed-3',
    date: new Date(Date.now() - 86400000 * 4).toISOString().slice(0, 10),
    member: 'Jesse (Social & Ops)',
    partner: 'SWEAT',
    category: 'Social & Marketing',
    hours: 1.5,
    notes: 'Filmed & edited Dropcast social reel showcasing new Memory Den booth drop.',
    deliverableRef: 'IG/TikTok Dropcast Reel #12',
  },
];

export const COOP_GOVERNANCE_DOC_ID = 'coop_governance_proposals_v1';
export const COOP_PROPOSALS_COL_ID = 'coop_proposals';
const MANIFESTS_COL_ID = 'manifests';
const LOCAL_STORAGE_PROPOSALS_KEY = 'huck_coop_proposals_v1';
const LOCAL_STORAGE_POLICY_MODE_KEY = 'rc_coop_surplus_policy_mode';
const LOCAL_STORAGE_SPLIT_BASIS_KEY = 'rc_coop_surplus_split_basis';
const LOCAL_STORAGE_POLICY_CONFIG_KEY = 'rc_coop_policy_config_v1';
const LOCAL_STORAGE_LABOR_KEY = 'huck_coop_labor_logs';

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
    deadline: String(doc.deadline || new Date().toISOString().slice(0, 10)),
    status: doc.status === 'passed' || doc.status === 'blocked' ? doc.status : 'active',
    createdAt: String(doc.createdAt || doc.$createdAt || new Date().toISOString().slice(0, 10)).slice(0, 10),
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
    createdAt: String(proposal.createdAt || new Date().toISOString().slice(0, 10)).slice(0, 64),
    updatedAt: new Date().toISOString(),
    tenantId: String(tenantId || 'huck_collective').slice(0, 64),
  };
}

function inferPartnerFromMemberName(member: string, explicit?: string): 'HUCK' | 'PDXGL' | 'SWEAT' {
  if (explicit === 'SWEAT' || /social|sweat|marketing|enabler/i.test(member)) return 'SWEAT';
  if (explicit === 'PDXGL' || /pdx/i.test(member)) return 'PDXGL';
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
    const hats = validHats.length > 0 ? validHats : defaultHatsFor(m.partner, m.role);
    const usesPrefix = hats.some((h) => MEMBER_HAT_META[h].usesPrefix);
    return {
      ...m,
      hats,
      inventoryPrefix: usesPrefix ? m.inventoryPrefix || (m.partner === 'SWEAT' ? undefined : `${m.partner}-`) : undefined,
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
    icaAnnualYieldRatePct: Math.min(25, Math.max(0, Number(base.icaAnnualYieldRatePct ?? 7))),
    payRatioCapStandard: Math.min(6.5, Math.max(1, Number(base.payRatioCapStandard ?? 4.5))),
    minAgreeVotes: Math.max(1, Math.round(Number(base.minAgreeVotes ?? 2))),
    orphanClaimWindowDays: Math.max(7, Math.round(Number(base.orphanClaimWindowDays ?? 30))),
    members,
  };
}

export function normalizeLaborEntries(raw?: any[]): CoopLaborEntry[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [...DEFAULT_COOP_LABOR_ENTRIES];
  }
  return raw.map((entry, idx) => {
    const member = String(entry?.member || 'Mike (HUCK)').replace('Tyler (Core)', 'Mike (HUCK)');
    return {
      id: String(entry?.id || `labor-${idx + 1}`),
      date: String(entry?.date || new Date().toISOString().slice(0, 10)).slice(0, 10),
      member,
      partner: inferPartnerFromMemberName(member, entry?.partner),
      category: (entry?.category as CoopLaborCategory) || 'Booth Restock',
      hours: Math.max(0.25, Number(entry?.hours || 1)),
      notes: String(entry?.notes || ''),
      deliverableRef: entry?.deliverableRef ? String(entry.deliverableRef) : undefined,
    };
  });
}

export function getLaborHoursByPartnerForMonth(
  entries: CoopLaborEntry[],
  monthKey: string
): Record<'HUCK' | 'PDXGL' | 'SWEAT', number> {
  const totals: Record<'HUCK' | 'PDXGL' | 'SWEAT', number> = { HUCK: 0, PDXGL: 0, SWEAT: 0 };
  for (const entry of entries || []) {
    if (monthKey !== 'all' && !String(entry.date || '').startsWith(monthKey)) {
      continue;
    }
    const partner = inferPartnerFromMemberName(entry.member, entry.partner);
    totals[partner] = Number((totals[partner] + (Number(entry.hours) || 0)).toFixed(2));
  }
  return totals;
}

export function getLaborHoursByMemberForMonth(
  entries: CoopLaborEntry[],
  monthKey: string,
  roster: CoopMemberProfile[] = DEFAULT_COOP_POLICY_CONFIG.members
): MemberLaborShareSummary[] {
  const map = new Map<
    string,
    {
      member: string;
      partner: 'HUCK' | 'PDXGL' | 'SWEAT';
      roleLabel: string;
      hours: number;
      deliverableCount: number;
      enablerHours: number;
      producerHours: number;
    }
  >();

  let totalHours = 0;

  for (const entry of entries || []) {
    if (monthKey !== 'all' && !String(entry.date || '').startsWith(monthKey)) {
      continue;
    }
    const hrs = Math.max(0, Number(entry.hours) || 0);
    if (hrs <= 0) continue;

    totalHours += hrs;
    const memberName = String(entry.member || 'Member').trim();
    const partner = inferPartnerFromMemberName(memberName, entry.partner);
    const rosterMatch = roster.find(
      (r) => r.name.toLowerCase() === memberName.toLowerCase() || r.partner === partner
    );
    const roleLabel =
      partner === 'SWEAT' || rosterMatch?.role === 'Marketing & Social Enabler'
        ? 'Marketing & Social Enabler'
        : rosterMatch?.role || 'Curator Worker-Member';

    const laborRole = classifySurplusLaborRole(entry.category);
    const existing = map.get(memberName);
    if (existing) {
      existing.hours = Number((existing.hours + hrs).toFixed(2));
      if (entry.deliverableRef) existing.deliverableCount += 1;
      if (laborRole === 'Enabler of Surplus') {
        existing.enablerHours = Number((existing.enablerHours + hrs).toFixed(2));
      } else {
        existing.producerHours = Number((existing.producerHours + hrs).toFixed(2));
      }
    } else {
      map.set(memberName, {
        member: memberName,
        partner,
        roleLabel,
        hours: Number(hrs.toFixed(2)),
        deliverableCount: entry.deliverableRef ? 1 : 0,
        enablerHours: laborRole === 'Enabler of Surplus' ? Number(hrs.toFixed(2)) : 0,
        producerHours: laborRole === 'Producer of Surplus' ? Number(hrs.toFixed(2)) : 0,
      });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.hours - a.hours)
    .map((item) => ({
      ...item,
      sharePct: totalHours > 0 ? Number(((item.hours / totalHours) * 100).toFixed(1)) : 0,
    }));
}

function readLocalGovernanceFallback(defaultProposals: CoopProposal[]): CoopGovernanceCloudState {
  let proposals = defaultProposals;
  let surplusPolicyMode: SurplusPolicyMode = 'patronage_90_10';
  let surplusSplitBasis: SurplusSplitBasis = 'volume';
  let policyConfig: CoopPolicyConfig = { ...DEFAULT_COOP_POLICY_CONFIG };
  let laborEntries: CoopLaborEntry[] = [...DEFAULT_COOP_LABOR_ENTRIES];

  if (typeof window !== 'undefined') {
    try {
      const savedProposals = localStorage.getItem(LOCAL_STORAGE_PROPOSALS_KEY);
      if (savedProposals) {
        const parsed = JSON.parse(savedProposals);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasSurplusProp = parsed.some((p: CoopProposal) => p.id === 'prop-surplus-policy');
          proposals = hasSurplusProp && defaultProposals[0] ? parsed : defaultProposals.length > 0 ? [defaultProposals[0], ...parsed] : parsed;
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
      const savedLabor = localStorage.getItem(LOCAL_STORAGE_LABOR_KEY);
      if (savedLabor) {
        laborEntries = normalizeLaborEntries(JSON.parse(savedLabor));
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
    laborEntries,
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
    if (state.laborEntries) {
      localStorage.setItem(LOCAL_STORAGE_LABOR_KEY, JSON.stringify(state.laborEntries));
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
      // Keep newest createdAt proposals first; preserve prop-surplus-policy near top if tied
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

  const laborEntries =
    Array.isArray(parsedSnapshot.laborEntries) && parsedSnapshot.laborEntries.length > 0
      ? normalizeLaborEntries(parsedSnapshot.laborEntries)
      : localState.laborEntries;

  const cloudState: CoopGovernanceCloudState = {
    proposals: mergedProposals,
    surplusPolicyMode,
    surplusSplitBasis,
    policyConfig,
    laborEntries,
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

  // Update local cache immediately
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

  // Also prune from legacy manifest snapshot so auto-migration doesn't resurrect a deleted proposal
  await saveCoopGovernanceState({ proposals: nextLocalProposals }, tenantId).catch(() => {});
  return deletedFromCol;
}

export async function saveCoopGovernanceState(
  partial: Partial<CoopGovernanceCloudState>,
  tenantId = 'huck_collective'
): Promise<boolean> {
  mirrorToLocalStorage(partial);
  const dbId = getDatabaseId();

  try {
    let existing: Partial<CoopGovernanceCloudState> = readLocalGovernanceFallback([]);
    try {
      const currentDoc: any = await databases.getDocument(dbId, MANIFESTS_COL_ID, COOP_GOVERNANCE_DOC_ID);
      if (typeof currentDoc.itemsSnapshot === 'string' && currentDoc.itemsSnapshot.trim().startsWith('{')) {
        existing = { ...existing, ...JSON.parse(currentDoc.itemsSnapshot) };
      }
    } catch {
      // Document doesn't exist yet; will create below
    }

    const nextState: CoopGovernanceCloudState = {
      proposals: partial.proposals ?? existing.proposals ?? [],
      surplusPolicyMode: partial.surplusPolicyMode ?? existing.surplusPolicyMode ?? 'patronage_90_10',
      surplusSplitBasis: partial.surplusSplitBasis ?? existing.surplusSplitBasis ?? 'volume',
      policyConfig: normalizePolicyConfig(partial.policyConfig ?? existing.policyConfig),
      laborEntries: normalizeLaborEntries(partial.laborEntries ?? existing.laborEntries),
      updatedAt: new Date().toISOString(),
    };

    mirrorToLocalStorage(nextState);

    const serialized = JSON.stringify(nextState);
    const docPayload = {
      name: 'Co-op Democratic Governance & Surplus Policy Ledger',
      tenantId: tenantId || 'huck_collective',
      locationId: 'COOP_GOVERNANCE',
      locationName: 'Huckleberry Co-op Governance',
      status: 'governance_state',
      itemsSnapshot: serialized,
      itemCount: nextState.proposals.length,
      notes: JSON.stringify({
        surplusPolicyMode: nextState.surplusPolicyMode,
        surplusSplitBasis: nextState.surplusSplitBasis,
        curatorSharePct: nextState.policyConfig.curatorSharePct,
        commonsSharePct: nextState.policyConfig.commonsSharePct,
        reserveSharePct: nextState.policyConfig.reserveSharePct,
        salesPatronagePct: nextState.policyConfig.salesPatronagePct,
        laborPatronagePct: nextState.policyConfig.laborPatronagePct,
        carriedOverShortfall: nextState.policyConfig.carriedOverShortfall,
        laborCount: nextState.laborEntries.length,
        proposalCount: nextState.proposals.length,
        updatedAt: nextState.updatedAt,
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
): Promise<{ entry: CoopLaborEntry; syncedToCloud: boolean }> {
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

  const entry: CoopLaborEntry = {
    id: `labor-${Date.now()}`,
    date: (input.date || new Date().toISOString().slice(0, 10)).slice(0, 10),
    member: memberName,
    partner: partnerPrefix,
    category: input.category || 'Social & Marketing',
    hours: Math.max(0.25, Number(input.hours || 1)),
    deliverableRef: input.deliverableRef?.trim() || undefined,
    notes: input.notes?.trim() || 'Dropcast social reel & marketing contribution',
  };

  const nextEntries = [entry, ...(state.laborEntries || [])];
  const syncedToCloud = await saveCoopGovernanceState({ laborEntries: nextEntries }, tenantId);
  return { entry, syncedToCloud };
}

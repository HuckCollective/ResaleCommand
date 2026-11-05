import { databases } from './appwrite';
import { Permission, Role } from 'appwrite';
import { getDatabaseId } from './appwriteEnv';

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
  votes: Record<string, ProposalVote>;
}

export interface CoopMemberProfile {
  name: string;
  partner: 'HUCK' | 'PDXGL' | 'SWEAT' | 'BB';
  role: 'Co-op Member' | 'Partner Curator' | 'Marketing & Social Enabler' | 'Consignor';
  canVote: boolean;
}

export interface CoopPolicyConfig {
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
const MANIFESTS_COL_ID = 'manifests';
const LOCAL_STORAGE_PROPOSALS_KEY = 'huck_coop_proposals_v1';
const LOCAL_STORAGE_POLICY_MODE_KEY = 'rc_coop_surplus_policy_mode';
const LOCAL_STORAGE_SPLIT_BASIS_KEY = 'rc_coop_surplus_split_basis';
const LOCAL_STORAGE_POLICY_CONFIG_KEY = 'rc_coop_policy_config_v1';
const LOCAL_STORAGE_LABOR_KEY = 'huck_coop_labor_logs';

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

  const members =
    Array.isArray(base.members) && base.members.length > 0
      ? base.members
      : DEFAULT_COOP_POLICY_CONFIG.members;

  return {
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

  try {
    const doc: any = await databases.getDocument(dbId, MANIFESTS_COL_ID, COOP_GOVERNANCE_DOC_ID);
    let parsedSnapshot: Partial<CoopGovernanceCloudState> = {};

    if (typeof doc.itemsSnapshot === 'string' && doc.itemsSnapshot.trim().startsWith('{')) {
      parsedSnapshot = JSON.parse(doc.itemsSnapshot);
    } else if (typeof doc.notes === 'string' && doc.notes.trim().startsWith('{')) {
      parsedSnapshot = JSON.parse(doc.notes);
    }

    let proposals =
      Array.isArray(parsedSnapshot.proposals) && parsedSnapshot.proposals.length > 0
        ? parsedSnapshot.proposals
        : localState.proposals;

    if (defaultProposals.length > 0 && !proposals.some((p) => p.id === 'prop-surplus-policy')) {
      proposals = [defaultProposals[0], ...proposals];
    }

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
      proposals,
      surplusPolicyMode,
      surplusSplitBasis,
      policyConfig,
      laborEntries,
      updatedAt: doc.$updatedAt || parsedSnapshot.updatedAt || new Date().toISOString(),
    };

    mirrorToLocalStorage(cloudState);
    return { state: cloudState, syncedFromCloud: true };
  } catch (err: any) {
    if (err?.code === 404 && defaultProposals.length > 0) {
      const seeded = await saveCoopGovernanceState(localState, tenantId);
      return { state: localState, syncedFromCloud: seeded };
    }
    return { state: localState, syncedFromCloud: false };
  }
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

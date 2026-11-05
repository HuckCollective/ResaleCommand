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
  deadline: string;
  status: 'active' | 'passed' | 'blocked';
  createdAt: string;
  votes: Record<string, ProposalVote>;
}

export interface CoopGovernanceCloudState {
  proposals: CoopProposal[];
  surplusPolicyMode: SurplusPolicyMode;
  surplusSplitBasis: SurplusSplitBasis;
  updatedAt: string;
}

export const COOP_GOVERNANCE_DOC_ID = 'coop_governance_proposals_v1';
const MANIFESTS_COL_ID = 'manifests';
const LOCAL_STORAGE_PROPOSALS_KEY = 'huck_coop_proposals_v1';
const LOCAL_STORAGE_POLICY_MODE_KEY = 'rc_coop_surplus_policy_mode';
const LOCAL_STORAGE_SPLIT_BASIS_KEY = 'rc_coop_surplus_split_basis';

function readLocalGovernanceFallback(defaultProposals: CoopProposal[]): CoopGovernanceCloudState {
  let proposals = defaultProposals;
  let surplusPolicyMode: SurplusPolicyMode = 'patronage_90_10';
  let surplusSplitBasis: SurplusSplitBasis = 'volume';

  if (typeof window !== 'undefined') {
    try {
      const savedProposals = localStorage.getItem(LOCAL_STORAGE_PROPOSALS_KEY);
      if (savedProposals) {
        const parsed = JSON.parse(savedProposals);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasSurplusProp = parsed.some((p: CoopProposal) => p.id === 'prop-surplus-policy');
          proposals = hasSurplusProp ? parsed : [defaultProposals[0], ...parsed];
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
    } catch (err) {
      console.warn('[coopGovernance] LocalStorage fallback read warning:', err);
    }
  }

  return {
    proposals,
    surplusPolicyMode,
    surplusSplitBasis,
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

    let proposals = Array.isArray(parsedSnapshot.proposals) && parsedSnapshot.proposals.length > 0
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

    const cloudState: CoopGovernanceCloudState = {
      proposals,
      surplusPolicyMode,
      surplusSplitBasis,
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
      updatedAt: new Date().toISOString(),
    };

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


/**
 * Pure (no Appwrite) member-hat definitions + visibility rules.
 * Re-exported from coopGovernance.ts so existing imports keep working, and imported
 * directly by dashboard widgets / the public demo so they never touch the database.
 */
export type MemberHat = 'founder' | 'curator' | 'promoter' | 'enabler' | 'builder' | 'consignor';

export interface MemberHatMeta {
  id: MemberHat;
  label: string;
  icon: string;
  pitch: string;
  /** Hat requires a physical barcode prefix (price-tag stickers) */
  usesPrefix: boolean;
  canVote: boolean;
}

export const MEMBER_HAT_META: Record<MemberHat, MemberHatMeta> = {
  founder: {
    id: 'founder',
    label: 'Founder',
    icon: '👑',
    pitch: 'Co-op steward: enacts global splits, consignor contracts and new barcode prefixes.',
    usesPrefix: true,
    canVote: true,
  },
  curator: {
    id: 'curator',
    label: 'Curator',
    icon: '💎',
    pitch: 'Brings or co-curates inventory. 100% cost back first, then the Curator share of net profit.',
    usesPrefix: true,
    canVote: true,
  },
  promoter: {
    id: 'promoter',
    label: 'Promoter',
    icon: '📣',
    pitch: 'Dropcasts, reels, photography and merchandising. Inventory optional.',
    usesPrefix: true,
    canVote: true,
  },
  enabler: {
    id: 'enabler',
    label: 'Surplus Enabler',
    icon: '🔥',
    pitch: 'Booth restock, tagging, hauling, shipping and reconciliation. Inventory optional.',
    usesPrefix: true,
    canVote: true,
  },
  builder: {
    id: 'builder',
    label: 'Builder',
    icon: '🛠️',
    pitch: 'Dev, design & physical displays: web/AI tools, signage, shelving and booth lighting. Inventory optional.',
    usesPrefix: true,
    canVote: true,
  },
  consignor: {
    id: 'consignor',
    label: 'Consignor',
    icon: '🏷️',
    pitch: 'Drops off items on a straight % split or shelf rent. No co-op duties.',
    usesPrefix: true,
    canVote: false,
  },
};

const VOTING_PROVIDER_ROLES = new Set(['owner', 'founder', 'promoter', 'enabler', 'builder']);

/**
 * Universal Curator onboarding helper (initial invite / accept ONLY):
 * Auto-includes `'curator'` whenever a voting/provider role (`founder`, `promoter`, `enabler`, `builder`)
 * is granted on initial onboarding, while keeping `'consignor'` strictly isolated (§14A).
 * Never run this inside manual role-checkbox toggles so Founders can intentionally uncheck `'curator'`.
 */
export function ensureCuratorBaseRoles<T extends string>(roles: readonly T[]): Array<T | 'curator'> {
  const out: Array<T | 'curator'> = [];
  let hasVotingProvider = false;
  for (const r of roles) {
    if (!out.includes(r)) out.push(r);
    if (VOTING_PROVIDER_ROLES.has(String(r).trim().toLowerCase())) {
      hasVotingProvider = true;
    }
  }
  if (hasVotingProvider && !out.some((r) => String(r).trim().toLowerCase() === 'curator')) {
    out.push('curator');
  }
  return out;
}

/**
 * WSDE rule: voting members share ONE information class — they all see the collective's
 * aggregate financials (you cannot vote on numbers you cannot see). Founder differs only in
 * AUTHORITY (settings, prefixes), never in information. Consignors are contractual and see
 * only their own statement.
 */
export function canSeeCollectiveFinancials(hats?: readonly MemberHat[] | null): boolean {
  return !!hats?.some((h) => MEMBER_HAT_META[h]?.canVote);
}

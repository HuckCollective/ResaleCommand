/**
 * Pure (no Appwrite) member-hat definitions + visibility rules.
 * Re-exported from coopGovernance.ts so existing imports keep working, and imported
 * directly by dashboard widgets / the public demo so they never touch the database.
 */
export type MemberHat = 'founder' | 'curator' | 'promoter' | 'enabler' | 'consignor';

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
    usesPrefix: false,
    canVote: true,
  },
  curator: {
    id: 'curator',
    label: 'Curator',
    icon: '💎',
    pitch: 'Brings inventory. 100% cost back first, then the Curator share of net profit.',
    usesPrefix: true,
    canVote: true,
  },
  promoter: {
    id: 'promoter',
    label: 'Promoter',
    icon: '📣',
    pitch: 'Dropcasts, reels, photography and merchandising. $0 inventory required.',
    usesPrefix: false,
    canVote: true,
  },
  enabler: {
    id: 'enabler',
    label: 'Surplus Enabler',
    icon: '🔥',
    pitch: 'Booth restock, tagging, hauling, shipping and reconciliation. $0 inventory required.',
    usesPrefix: false,
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

/**
 * WSDE rule: voting members share ONE information class — they all see the collective's
 * aggregate financials (you cannot vote on numbers you cannot see). Founder differs only in
 * AUTHORITY (settings, prefixes), never in information. Consignors are contractual and see
 * only their own statement.
 */
export function canSeeCollectiveFinancials(hats?: readonly MemberHat[] | null): boolean {
  return !!hats?.some((h) => MEMBER_HAT_META[h]?.canVote);
}


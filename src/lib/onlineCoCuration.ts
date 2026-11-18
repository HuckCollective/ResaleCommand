/**
 * Shared Online Storefront (`🌐 Online Ready`) & Dual-Option Backstock Co-Curation Model.
 *
 * Pure TypeScript — zero Appwrite / server SDK imports so client drawers, inventory filters,
 * and `settlementInputs.ts` share one exact mathematical & lifecycle contract (§3A).
 *
 * Binding Architecture Contracts:
 * 1. Law 1 Location Integrity: `storageLocation` stays strictly `'HG'` or `'HH'` (never suffixed).
 *    Online-Ready status is stored exclusively via `sellingLocations` containing `'ONLINE_READY_BIN'`.
 * 2. Law 2 Dynamic Split: Mode A (`split_half`) splits the live `curatorSharePct` 50/50 in integer cents
 *    (`Math.floor(baseProfitCents / 2)` to Lister, remainder to OG Buyer) — zero hardcoded `35/35`.
 * 3. Law 7 String Dates: 14-day claim clock uses pure calendar `YYYY-MM-DD` strings (`addCalendarDaysYmd`),
 *    evaluated lazily against `pacificTodayYmd()`.
 */
import { sanitizeHttpsUrl } from './flagshipContent';
import { addCalendarDaysYmd } from './salesChannels';

export const ONLINE_READY_SELLING_TAG = 'ONLINE_READY_BIN';
export const ONLINE_READY_DISPLAY_LABEL = '🌐 Online Ready';
export const COOP_ONLINE_COCURATION_LOCATION_ID = 'COOP_ONLINE_COCURATION';
export const COCURATION_CLAIM_WINDOW_DAYS = 14;
/** A pending co-curation request (or counter-offer) waits this many days for an answer before it expires. */
export const COCURATION_REQUEST_WINDOW_DAYS = 3;

export type CoCurationMode =
  | 'self_listed'
  | 'booth_prep'
  | 'photo_stage'
  | 'split_half'
  | 'transfer_price';
export type OnlinePlatformKey = 'ebay' | 'whatnot' | 'depop' | 'poshmark' | 'district';
export type CoCurationStatus =
  | 'requested'
  | 'countered'
  | 'claimed'
  | 'listed'
  | 'sold'
  | 'released'
  | 'declined'
  | 'expired';

/**
 * Co-Curator tiers. The Lister's cut is a fixed fraction of the LIVE Curator pool (never a literal 70),
 * so if the Collective changes `curatorSharePct` the tiers scale with it.
 * With a 70% pool: Booth Prep = 15, Photo & Stage = 25, Online Turnkey = 35 points of the sale surplus.
 */
export type CoCurationTierMode = 'booth_prep' | 'photo_stage' | 'split_half';
export const COCURATION_LISTER_POOL_SHARE: Record<CoCurationTierMode, readonly [number, number]> = {
  booth_prep: [3, 14],
  photo_stage: [5, 14],
  split_half: [1, 2],
};

/** Modes a member may offer when asking to co-curate someone else's item. */
export const COCURATION_REQUESTABLE_MODES: readonly CoCurationMode[] = [
  'booth_prep',
  'photo_stage',
  'split_half',
  'transfer_price',
];

export function isCoCurationTierMode(mode: unknown): mode is CoCurationTierMode {
  return mode === 'booth_prep' || mode === 'photo_stage' || mode === 'split_half';
}

/** Lister's share of the sale surplus, in percentage points, for display (e.g. 15 / 25 / 35 at a 70% pool). */
export function coCurationListerSharePct(mode: CoCurationTierMode, curatorSharePct: number): number {
  const [num, den] = COCURATION_LISTER_POOL_SHARE[mode];
  return Number(((curatorSharePct * num) / den).toFixed(1));
}

export function isPendingCoCurationStatus(status: CoCurationStatus | undefined | null): boolean {
  return status === 'requested' || status === 'countered';
}

export function isActiveCoCurationStatus(status: CoCurationStatus | undefined | null): boolean {
  return status === 'claimed' || status === 'listed' || status === 'sold';
}

/** A record the next member may overwrite with a brand-new request. */
export function isFreeCoCurationStatus(status: CoCurationStatus | undefined | null): boolean {
  return !status || status === 'released' || status === 'declined' || status === 'expired';
}

export interface OnlinePlatformListing {
  platform: OnlinePlatformKey;
  listingUrl: string;
  listedPrice: number;
  listedAt: string;
}

export interface CoCurationCounter {
  mode: CoCurationMode;
  transferFloorPrice: number;
  note: string;
  byName: string;
  at: string;
}

export interface CoCurationRecord {
  itemId: string;
  upc: string;
  titleSnapshot: string;
  ogBuyerPrefix: 'HUCK-' | 'PDXGL-';
  ogBuyerName: string;
  listerUserId: string;
  listerName: string;
  listerPrefix: 'HUCK-' | 'PDXGL-' | 'SWEAT-';
  mode: CoCurationMode;
  transferFloorPrice: number;
  binFacility: 'HG' | 'HH';
  claimedAt: string;
  expiresAt: string;
  status: CoCurationStatus;
  soldSaleId?: string;
  soldAt?: string;
  listings: OnlinePlatformListing[];
  updatedAt: string;
  /** Request-and-approve fields (empty on legacy self-claims). */
  ownerUserId?: string;
  requestedAt?: string;
  requestExpiresAt?: string;
  requestNote?: string;
  counter?: CoCurationCounter;
  approvedAt?: string;
  approvedByName?: string;
}

export const ONLINE_PLATFORM_OPTIONS: ReadonlyArray<{
  id: OnlinePlatformKey;
  label: string;
  feePctHint: number;
}> = [
  { id: 'ebay', label: '📦 eBay Store (MUAA)', feePctHint: 13.6 },
  { id: 'whatnot', label: '📡 Whatnot Live', feePctHint: 11 },
  { id: 'depop', label: '👕 Depop', feePctHint: 10 },
  { id: 'poshmark', label: '👗 Poshmark', feePctHint: 20 },
  { id: 'district', label: '🌐 District', feePctHint: 11 },
];

/**
 * Deterministic per-item Appwrite `manifests` document ID (`<= 36` chars) so two simultaneous
 * claims on the same item receive HTTP 409 (`document_already_exists`) at the DB layer (§3A-C).
 */
export function coCurationDocIdForItem(itemId: string): string {
  const clean = String(itemId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 28);
  return `cocur_${clean || 'unknown'}`;
}

/**
 * True ONLY when `item.sellingLocations` explicitly contains `'ONLINE_READY_BIN'`.
 * Never matches legacy `'eBay'` / `'Poshmark'` strings written by HaulIngestionWizard (§3A-B).
 */
export function hasOnlineReadyTag(item: any): boolean {
  if (!item?.sellingLocations) return false;
  const list = Array.isArray(item.sellingLocations)
    ? item.sellingLocations
    : [item.sellingLocations];
  return list.some(
    (entry: any) => String(entry || '').trim().toUpperCase() === ONLINE_READY_SELLING_TAG
  );
}

/**
 * Human-readable display mapper for `sellingLocations` pills on cards, tables, and viewers.
 */
export function formatSellingLocationBadge(rawTag: string): string {
  const trimmed = String(rawTag || '').trim();
  if (trimmed.toUpperCase() === ONLINE_READY_SELLING_TAG) {
    return ONLINE_READY_DISPLAY_LABEL;
  }
  return trimmed;
}

/**
 * Checks whether an item is eligible for Online Ready Bin & Co-Curation (§3A-A):
 * - Single-unit working stock (`quantity === 1`, not sold/combined/deconstructed/tracked)
 * - Co-op Curator barcode (`HUCK-` or `PDXGL-`, never `BB-` or `COMMONS-`)
 */
export function checkCoCurationEligibility(item: any): {
  eligible: boolean;
  reason?: string;
  ogPrefix: 'HUCK-' | 'PDXGL-';
} {
  if (!item) {
    return { eligible: false, reason: 'Item not loaded.', ogPrefix: 'HUCK-' };
  }
  const st = String(item.status || '').trim().toLowerCase();
  if (['sold', 'combined', 'deconstructed', 'tracked', 'scouted', 'draft'].includes(st)) {
    return {
      eligible: false,
      reason: 'Only received or active on-hand items can be placed in the Online Ready Bin.',
      ogPrefix: 'HUCK-',
    };
  }
  if (Number(item.quantity || 1) > 1) {
    return {
      eligible: false,
      reason: 'Multi-quantity Booth Bins stay on the booth bin ledger (single-unit items only).',
      ogPrefix: 'HUCK-',
    };
  }
  const upcUpper = String(item.upc || item.sku || '').trim().toUpperCase();
  if (upcUpper.startsWith('BB-') || upcUpper.startsWith('COMMONS-')) {
    return {
      eligible: false,
      reason: 'Consignor (BB-) and Commons items are excluded from member co-curation.',
      ogPrefix: 'HUCK-',
    };
  }
  const ogPrefix: 'HUCK-' | 'PDXGL-' = upcUpper.startsWith('PDXGL-') ? 'PDXGL-' : 'HUCK-';
  return { eligible: true, ogPrefix };
}

function sanitizeYmd(raw: unknown): string {
  const s = String(raw ?? '').trim().slice(0, 10);
  return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s) ? s : '';
}

function cleanText(raw: unknown, maxLen: number, fallback = ''): string {
  const s = String(raw ?? '')
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/data:[a-z0-9+/=-]+;base64,[a-z0-9+/=]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s ? s.slice(0, maxLen) : fallback;
}

export function normalizeCoCurationRecord(raw: any): CoCurationRecord {
  const validPlatforms = new Set<OnlinePlatformKey>(ONLINE_PLATFORM_OPTIONS.map((p) => p.id));
  const listings: OnlinePlatformListing[] = Array.isArray(raw?.listings)
    ? raw.listings
        .map((l: any) => {
          const platform: OnlinePlatformKey = validPlatforms.has(l?.platform) ? l.platform : 'ebay';
          const listingUrl = sanitizeHttpsUrl(l?.listingUrl);
          const listedPrice = Math.max(0, Number(Number(l?.listedPrice || 0).toFixed(2)));
          const listedAt = sanitizeYmd(l?.listedAt);
          return { platform, listingUrl, listedPrice, listedAt };
        })
        .filter((l: OnlinePlatformListing) => Boolean(l.listingUrl))
        .slice(0, 8)
    : [];

  const mode: CoCurationMode =
    raw?.mode === 'booth_prep' ||
    raw?.mode === 'photo_stage' ||
    raw?.mode === 'split_half' ||
    raw?.mode === 'transfer_price' ||
    raw?.mode === 'self_listed'
      ? raw.mode
      : 'self_listed';

  const ogBuyerPrefix: 'HUCK-' | 'PDXGL-' =
    String(raw?.ogBuyerPrefix || '').toUpperCase().startsWith('PDXGL') ? 'PDXGL-' : 'HUCK-';

  const rawListerPrefix = String(raw?.listerPrefix || '').toUpperCase();
  const listerPrefix: 'HUCK-' | 'PDXGL-' | 'SWEAT-' = rawListerPrefix.startsWith('PDXGL')
    ? 'PDXGL-'
    : rawListerPrefix.startsWith('SWEAT')
      ? 'SWEAT-'
      : 'HUCK-';

  const binFacility: 'HG' | 'HH' =
    String(raw?.binFacility || '').toUpperCase() === 'HG' ? 'HG' : 'HH';

  const claimedAt = sanitizeYmd(raw?.claimedAt) || new Date().toISOString().slice(0, 10);
  const expiresAt =
    sanitizeYmd(raw?.expiresAt) || addCalendarDaysYmd(claimedAt, COCURATION_CLAIM_WINDOW_DAYS);

  const RAW_STATUSES = [
    'requested',
    'countered',
    'listed',
    'sold',
    'released',
    'declined',
    'expired',
  ] as const;
  let status: CoCurationStatus = (RAW_STATUSES as readonly string[]).includes(raw?.status)
    ? raw.status
    : 'claimed';
  if (status === 'claimed' && listings.length > 0) {
    status = 'listed';
  }

  let counter: CoCurationCounter | undefined;
  if (raw?.counter && typeof raw.counter === 'object') {
    const cMode: CoCurationMode = COCURATION_REQUESTABLE_MODES.includes(raw.counter.mode)
      ? raw.counter.mode
      : 'split_half';
    counter = {
      mode: cMode,
      transferFloorPrice: Math.max(0, Number(Number(raw.counter.transferFloorPrice || 0).toFixed(2))),
      note: cleanText(raw.counter.note, 300),
      byName: cleanText(raw.counter.byName, 60, 'Item Owner'),
      at: sanitizeYmd(raw.counter.at),
    };
  }

  return {
    itemId: cleanText(raw?.itemId, 48),
    upc: cleanText(raw?.upc, 32).toUpperCase(),
    titleSnapshot: cleanText(raw?.titleSnapshot, 120, 'Catalog Item'),
    ogBuyerPrefix,
    ogBuyerName: cleanText(raw?.ogBuyerName, 60, ogBuyerPrefix),
    listerUserId: cleanText(raw?.listerUserId, 48),
    listerName: cleanText(raw?.listerName, 60, 'Collective Member'),
    listerPrefix,
    mode,
    transferFloorPrice: Math.max(0, Number(Number(raw?.transferFloorPrice || 0).toFixed(2))),
    binFacility,
    claimedAt,
    expiresAt,
    status,
    soldSaleId: raw?.soldSaleId ? cleanText(raw.soldSaleId, 48) : undefined,
    soldAt: sanitizeYmd(raw?.soldAt) || undefined,
    listings,
    updatedAt:
      typeof raw?.updatedAt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw.updatedAt)
        ? raw.updatedAt.slice(0, 30)
        : new Date().toISOString(),
    ownerUserId: raw?.ownerUserId ? cleanText(raw.ownerUserId, 48) : undefined,
    requestedAt: sanitizeYmd(raw?.requestedAt) || undefined,
    requestExpiresAt: sanitizeYmd(raw?.requestExpiresAt) || undefined,
    requestNote: raw?.requestNote ? cleanText(raw.requestNote, 300) : undefined,
    counter,
    approvedAt: sanitizeYmd(raw?.approvedAt) || undefined,
    approvedByName: raw?.approvedByName ? cleanText(raw.approvedByName, 60) : undefined,
  };
}

/**
 * Lazy clock evaluation (Law 7 string compare against `pacificTodayYmd()`):
 * - A `requested` / `countered` record past `requestExpiresAt` is `expired` (the item is free again).
 * - A `claimed` record with no listings past `expiresAt` (14 days from approval) is `released`.
 */
export function effectiveCoCurationStatus(
  rec: CoCurationRecord,
  todayYmd: string
): CoCurationStatus {
  if (rec.status === 'requested' || rec.status === 'countered') {
    if (rec.requestExpiresAt && /^\d{4}-\d{2}-\d{2}$/.test(todayYmd) && todayYmd > rec.requestExpiresAt) {
      return 'expired';
    }
    return rec.status;
  }
  if (rec.status === 'declined' || rec.status === 'expired') return rec.status;
  if (rec.status === 'sold' || rec.status === 'released') return rec.status;
  if (rec.listings.length > 0 || rec.status === 'listed') return 'listed';
  if (rec.expiresAt && /^\d{4}-\d{2}-\d{2}$/.test(todayYmd) && todayYmd > rec.expiresAt) {
    return 'released';
  }
  return 'claimed';
}

/**
 * Pure integer-cent Co-Curation split preview & settlement helper (§3A-A):
 * - Keeps shipping recoup in the seller-of-record row (`rawCostCents = effectiveItemCostCents + shippingCents`).
 * - Mode A (`split_half`): OG recoups `itemCostCents`; `listerTransferCents = Math.floor(baseProfitCents / 2)`.
 * - Mode B (`transfer_price`): overrides item cost basis with `transferFloorCents`; if `netDepositCents < floor + shipping`,
 *   recoup is capped and `listerTransferCents = 0`; else `listerTransferCents = baseProfitCents` (100% of Gate 3 profit above floor).
 */
export function computeCoCurationSplitCents(opts: {
  netDepositCents: number;
  itemCostCents: number;
  shippingCents: number;
  commonsRatio: number;
  mode: CoCurationMode;
  transferFloorCents: number;
}): {
  effectiveRecoupCents: number;
  unrecoupedCents: number;
  netSurplusCents: number;
  commonsTakeCents: number;
  ogBaseProfitCents: number;
  listerTransferCents: number;
} {
  const netDeposit = Math.max(0, Math.round(opts.netDepositCents));
  const ship = Math.max(0, Math.round(opts.shippingCents));
  const baseItemCost =
    opts.mode === 'transfer_price'
      ? Math.max(0, Math.round(opts.transferFloorCents))
      : Math.max(0, Math.round(opts.itemCostCents));
  const rawCostCents = baseItemCost + ship;

  if (netDeposit < rawCostCents) {
    const effectiveRecoupCents = netDeposit;
    const unrecoupedCents = rawCostCents - effectiveRecoupCents;
    return {
      effectiveRecoupCents,
      unrecoupedCents,
      netSurplusCents: 0,
      commonsTakeCents: 0,
      ogBaseProfitCents: 0,
      listerTransferCents: 0,
    };
  }

  const effectiveRecoupCents = rawCostCents;
  const netSurplusCents = netDeposit - rawCostCents;
  const commonsTakeCents = Math.round(netSurplusCents * opts.commonsRatio);
  const totalCuratorProfitCents = netSurplusCents - commonsTakeCents;

  if (opts.mode === 'self_listed') {
    return {
      effectiveRecoupCents,
      unrecoupedCents: 0,
      netSurplusCents,
      commonsTakeCents,
      ogBaseProfitCents: totalCuratorProfitCents,
      listerTransferCents: 0,
    };
  }

  if (opts.mode === 'transfer_price') {
    return {
      effectiveRecoupCents,
      unrecoupedCents: 0,
      netSurplusCents,
      commonsTakeCents,
      ogBaseProfitCents: 0,
      listerTransferCents: totalCuratorProfitCents,
    };
  }

  // Co-Curator tiers: Lister takes a fixed fraction of the live Curator pool.
  // Integer-cent remainder pattern: the Lister's share is floored and the Original Buyer keeps the rest,
  // so no cent is ever created or lost.
  const [num, den] = COCURATION_LISTER_POOL_SHARE[isCoCurationTierMode(opts.mode) ? opts.mode : 'split_half'];
  const listerTransferCents = Math.floor((totalCuratorProfitCents * num) / den);
  const ogBaseProfitCents = totalCuratorProfitCents - listerTransferCents;
  return {
    effectiveRecoupCents,
    unrecoupedCents: 0,
    netSurplusCents,
    commonsTakeCents,
    ogBaseProfitCents,
    listerTransferCents,
  };
}

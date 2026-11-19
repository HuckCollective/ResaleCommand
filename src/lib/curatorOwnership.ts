/**
 * Pure TypeScript Curator Ownership, Co-Curator Carve-Out & Pre-Placement Lock Engine.
 *
 * Intentionally zero runtime imports from `appwrite`, `node-appwrite`, `vue`,
 * `warehouses`, `coopGovernance`, or `inventoryVibes` so it is universally safe
 * across Astro SSR API endpoints, Vue client components, and unit tests without cycles.
 */

import type { MemberCapabilities } from './memberAccess';
import type { CoCurationRecord } from './onlineCoCuration';

export const CO_CURATOR_PROTECTED_FIELDS = [
  'cost',
  'purchasePrice',
  'upc',
  'upcPrefix',
  'locationSku',
  'sku',
  'purchaseId',
  'orderId',
  'cartId',
  'parentLotId',
  'saleId',
  'soldPrice',
  'soldDate',
  'quantity',
  'tenantId',
  'userId',
  'buyerId',
  'components',
  'receiptImageId',
  'receiptFile',
] as const;

export const CO_CURATOR_BLOCKED_STATUSES = new Set([
  'sold',
  'combined',
  'deconstructed',
  'archived',
  'tracked',
  'scouted',
]);

const RESERVED_NON_OWNER_ROOTS = new Set([
  'DRAFT',
  'TEMP',
  'PENDING',
  'PO',
  'SC',
  'ITEM',
  'UNASSIGNED',
]);

export type ItemAccessLevel = 'founder' | 'owner' | 'co_curator' | 'readonly';

export interface ItemAccessDecision {
  accessLevel: ItemAccessLevel;
  canEditFull: boolean;
  canEditCoCurator: boolean;
  canSaveAny: boolean;
  canEditProtectedFields: boolean;
  canPlaceOrPrintTag: boolean;
  placementBlockReason: string;
  readOnlyReason: string;
  ownerPrefix: string;
  isDraftUnprefixed: boolean;
}

export interface PurchaseAccessDecision {
  isMine: boolean;
  canEdit: boolean;
  canDelete: boolean;
  ownerPrefix: string;
  ownerBadge: string;
  readOnlyReason: string;
}

function purePacificTodayYmd(now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
    const y = get('year');
    const m = get('month');
    const d = get('day');
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // Fallback to UTC ISO slice if Intl timezone fails in restricted runtimes
  }
  return now.toISOString().slice(0, 10);
}

/**
 * Returns true when a barcode/SKU is a temporary non-production draft placeholder.
 */
export function isDraftPlaceholderUpc(upc?: string | null): boolean {
  const clean = String(upc || '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .toUpperCase();
  if (!clean) return false;
  return /^(DRAFT|TEMP|PENDING)-/.test(clean);
}

/**
 * Normalizes a SKU prefix or extracts the owner prefix from a SKU/UPC string.
 * Rejects blanks, 0EJ booth SKUs, draft/PO placeholders, raw hex IDs, and pure numbers.
 * Returns e.g. 'DOM-', 'STORM-', 'HUCK-', 'PDXGL-', 'BB-', or ''.
 */
export function normalizeUpcPrefix(raw?: string | null): string {
  const clean = String(raw || '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .toUpperCase();
  if (!clean) return '';

  // Reject Ricochet booth location SKUs (0EJ or letter-O OEJ typo), pure numbers, and raw 16-32 char hex document IDs
  if (/^[0O]EJ/i.test(clean)) return '';
  if (/^\d+$/.test(clean)) return '';
  if (/^[0-9A-F]{16,}$/.test(clean)) return '';
  if (isDraftPlaceholderUpc(clean)) return '';
  if (/^(PO|SC|ITEM|UNASSIGNED)-/.test(clean)) return '';

  const token = clean.includes('-') ? clean.split('-')[0].trim() : clean;
  if (!token) return '';
  if (RESERVED_NON_OWNER_ROOTS.has(token)) return '';
  if (!/^[A-Z0-9]{2,8}$/.test(token)) return '';
  if (!/[A-Z]/.test(token)) return '';

  return `${token}-`;
}

/**
 * Extracts the canonical Curator owner prefix from an inventory item (`upc` first, then `sku`).
 */
export function extractItemOwnerPrefix(item: any): string {
  if (!item) return '';
  const fromUpc = normalizeUpcPrefix(item.upc);
  if (fromUpc) return fromUpc;
  const fromSku = normalizeUpcPrefix(item.sku);
  if (fromSku) return fromSku;
  return '';
}

/**
 * Deterministic 4-character user-scoped draft prefix for Curators without a locked SKU prefix.
 */
export function draftPrefixForUser(userId?: string | null): string {
  const alnum = String(userId || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  const uid4 = alnum.slice(0, 4) || 'CURA';
  return `DRAFT-${uid4}-`;
}

/**
 * Returns deduplicated normalized prefixes owned by a member.
 * `caps.prefix` is included only when `caps.prefixStatus === 'locked'`.
 */
export function getMemberOwnedPrefixes(caps?: Partial<MemberCapabilities> | null): string[] {
  const out = new Set<string>();
  for (const raw of caps?.ownedPrefixes || []) {
    const norm = normalizeUpcPrefix(raw);
    if (norm) out.add(norm);
  }
  if (caps?.prefixStatus === 'locked') {
    const normPrimary = normalizeUpcPrefix(caps.prefix);
    if (normPrimary) out.add(normPrimary);
  }
  return Array.from(out);
}

/**
 * Resolves the minting prefix when creating items for a member.
 * Non-Founders without a locked prefix NEVER fall back to 'HUCK-' — they mint `DRAFT-<UID4>-`.
 */
export function resolveMintingPrefixForMember(
  caps?: Partial<MemberCapabilities> | null,
  userId?: string | null
): { mode: 'locked' | 'draft'; prefix: string } {
  const lockedPrefix =
    caps?.prefixStatus === 'locked' ? normalizeUpcPrefix(caps?.prefix) : '';
  if (lockedPrefix) {
    return { mode: 'locked', prefix: lockedPrefix };
  }
  if (caps?.role === 'founder') {
    const founderPrefix = normalizeUpcPrefix(caps?.prefix) || 'HUCK-';
    return { mode: 'locked', prefix: founderPrefix };
  }
  return { mode: 'draft', prefix: draftPrefixForUser(userId) };
}

/**
 * Checks whether a storage location represents a physical retail booth (`MD` or `DT`).
 */
export function isRetailPlacementLocation(loc?: string | null): boolean {
  const raw = String(loc || '').trim().toUpperCase();
  if (!raw) return false;
  if (raw === 'MD' || raw === 'DT') return true;
  if (/\bMD\b|\bDT\b/.test(raw)) return true;
  if (raw.includes('MEMORY DEN') || raw.includes('DUSTY TIGER') || /BOOTH\s*#?0EJ/.test(raw)) {
    return true;
  }
  return false;
}

/**
 * Detects whether an update payload attempts retail/online placement.
 */
export function isPlacementMutation(updates?: Record<string, any> | null): boolean {
  if (!updates || typeof updates !== 'object') return false;
  if (String(updates.status || '').trim().toLowerCase() === 'placed') return true;
  if (updates.storageLocation && isRetailPlacementLocation(String(updates.storageLocation))) {
    return true;
  }
  const rawSelling = updates.sellingLocations;
  if (Array.isArray(rawSelling)) {
    for (const loc of rawSelling) {
      const s = String(loc || '').trim().toUpperCase();
      if (s === 'ONLINE_READY_BIN' || isRetailPlacementLocation(s)) return true;
    }
  } else if (typeof rawSelling === 'string' && rawSelling.trim()) {
    const upper = rawSelling.toUpperCase();
    if (upper.includes('ONLINE_READY_BIN') || /\bMD\b|\bDT\b|MEMORY DEN|DUSTY TIGER/.test(upper)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks ownership of an item for write permissions.
 */
export function isItemOwnedByMember(
  item: any,
  caps?: Partial<MemberCapabilities> | null,
  userId?: string | null,
  purchaseBuyerId?: string | null
): boolean {
  if (caps?.role === 'founder') return true;
  if (caps?.isConsignor) return false;
  if (!item || !item.$id) return true;

  const itemPrefix = extractItemOwnerPrefix(item);
  if (itemPrefix) {
    return getMemberOwnedPrefixes(caps).includes(itemPrefix);
  }

  const uid = String(userId || '').trim();
  if (!uid) return false;
  if (String(item.userId || '').trim() === uid) return true;
  if (String(purchaseBuyerId || '').trim() === uid) return true;

  const dp = draftPrefixForUser(uid);
  if (String(item.upc || '').trim().toUpperCase().startsWith(dp)) return true;
  if (String(item.identity || '').trim().toUpperCase().startsWith(dp)) return true;
  return false;
}

/**
 * Strict personal SKU matcher for the `My SKU | All` toggle (applies to Founders too).
 */
export function matchesMySkuFilter(
  item: any,
  ownedPrefixes: readonly string[],
  userId?: string | null
): boolean {
  const normalizedOwned = (ownedPrefixes || [])
    .map((p) => normalizeUpcPrefix(p))
    .filter(Boolean);

  const itemPrefix = extractItemOwnerPrefix(item);
  if (itemPrefix) {
    return normalizedOwned.includes(itemPrefix);
  }

  const uid = String(userId || '').trim();
  if (!uid) return false;
  if (String(item?.userId || '').trim() === uid) return true;
  const dp = draftPrefixForUser(uid);
  if (String(item?.upc || '').trim().toUpperCase().startsWith(dp)) return true;
  if (String(item?.identity || '').trim().toUpperCase().startsWith(dp)) return true;
  return false;
}

/**
 * Returns true only when `activeCoCuration` is an active ('claimed' or 'listed')
 * co-curation belonging to the current caller/lister.
 */
export function isActiveCoCuratorForItem(
  activeCoCuration?: Partial<CoCurationRecord> | null,
  userId?: string | null,
  caps?: Partial<MemberCapabilities> | null,
  todayYmd?: string
): boolean {
  if (!activeCoCuration) return false;
  const today = todayYmd || purePacificTodayYmd();
  const rawStatus = String(activeCoCuration.status || '').trim().toLowerCase();
  const expiresAt = String(activeCoCuration.expiresAt || '').trim().slice(0, 10);
  const effStatus =
    (rawStatus === 'requested' || rawStatus === 'claimed') &&
    expiresAt &&
    expiresAt <= today
      ? 'expired'
      : rawStatus;

  if (effStatus !== 'claimed' && effStatus !== 'listed') return false;

  const uid = String(userId || '').trim();
  if (uid && String(activeCoCuration.listerUserId || '').trim() === uid) {
    return true;
  }

  const listerPrefix = normalizeUpcPrefix(activeCoCuration.listerPrefix);
  if (listerPrefix && getMemberOwnedPrefixes(caps).includes(listerPrefix)) {
    return true;
  }
  return false;
}

/**
 * Computes full access control + Pre-Placement Lock state for a single item.
 */
export function evaluateItemAccess(
  item: any,
  caps?: Partial<MemberCapabilities> | null,
  opts?: {
    userId?: string | null;
    purchaseBuyerId?: string | null;
    activeCoCuration?: Partial<CoCurationRecord> | null;
    todayYmd?: string;
  }
): ItemAccessDecision {
  const ownerPrefix = extractItemOwnerPrefix(item);
  const isDraftUnprefixed =
    isDraftPlaceholderUpc(item?.upc) ||
    (!ownerPrefix && (Boolean(item?.$id) || isDraftPlaceholderUpc(item?.sku)));

  if (caps?.role === 'founder') {
    return {
      accessLevel: 'founder',
      canEditFull: true,
      canEditCoCurator: false,
      canSaveAny: true,
      canEditProtectedFields: true,
      canPlaceOrPrintTag: true,
      placementBlockReason: '',
      readOnlyReason: '',
      ownerPrefix,
      isDraftUnprefixed,
    };
  }

  if (
    !caps?.isConsignor &&
    isItemOwnedByMember(item, caps, opts?.userId, opts?.purchaseBuyerId)
  ) {
    const hasLockedPrefix =
      caps?.prefixStatus === 'locked' && Boolean(normalizeUpcPrefix(caps?.prefix));
    return {
      accessLevel: 'owner',
      canEditFull: true,
      canEditCoCurator: false,
      canSaveAny: true,
      canEditProtectedFields: true,
      canPlaceOrPrintTag: hasLockedPrefix,
      placementBlockReason: hasLockedPrefix
        ? ''
        : 'Lock your Curator SKU prefix on /profile before placing items in booths, the Online Ready Bin, or printing retail tags.',
      readOnlyReason: '',
      ownerPrefix,
      isDraftUnprefixed,
    };
  }

  if (
    !caps?.isConsignor &&
    item?.$id &&
    isActiveCoCuratorForItem(opts?.activeCoCuration, opts?.userId, caps, opts?.todayYmd)
  ) {
    // Audit Fix #4: an approved Co-Curator CAN stage/place/list another Curator's already-locked OG item
    const itemHasRealBarcode = Boolean(ownerPrefix) && !isDraftPlaceholderUpc(item?.upc);
    return {
      accessLevel: 'co_curator',
      canEditFull: false,
      canEditCoCurator: true,
      canSaveAny: true,
      canEditProtectedFields: false,
      canPlaceOrPrintTag: itemHasRealBarcode,
      placementBlockReason: itemHasRealBarcode
        ? ''
        : 'The original Curator needs a locked SKU barcode on this item before placement or label printing.',
      readOnlyReason: '',
      ownerPrefix,
      isDraftUnprefixed,
    };
  }

  const readOnlyReason = caps?.isConsignor
    ? 'Consignor view is read-only. Contact an Account Steward or Active Curator if changes are needed.'
    : `Read-Only Collective View — this item belongs to ${ownerPrefix || 'another Curator'}. Request Co-Curation in the Online Bin tab to team up on listing it.`;

  return {
    accessLevel: 'readonly',
    canEditFull: false,
    canEditCoCurator: false,
    canSaveAny: false,
    canEditProtectedFields: false,
    canPlaceOrPrintTag: false,
    placementBlockReason: readOnlyReason,
    readOnlyReason,
    ownerPrefix,
    isDraftUnprefixed,
  };
}

/**
 * Checks whether an item may be placed in a retail booth, Online Ready Bin,
 * outbound manifest, or printed on a physical thermal barcode label.
 */
export function canItemBePlacedOrPrinted(
  item: any,
  caps?: Partial<MemberCapabilities> | null,
  opts?: {
    userId?: string | null;
    purchaseBuyerId?: string | null;
    activeCoCuration?: Partial<CoCurationRecord> | null;
    todayYmd?: string;
  }
): { allowed: boolean; reason: string } {
  if (isDraftPlaceholderUpc(item?.upc)) {
    return {
      allowed: false,
      reason:
        'Temporary DRAFT- barcodes cannot be placed in booths or printed on retail tags. Save with a locked SKU prefix first.',
    };
  }

  const decision = evaluateItemAccess(item, caps, opts);
  if (!decision.canSaveAny) {
    return { allowed: false, reason: decision.readOnlyReason };
  }
  if (!decision.canPlaceOrPrintTag) {
    return { allowed: false, reason: decision.placementBlockReason };
  }
  if (!extractItemOwnerPrefix(item) && !String(item?.locationSku || '').trim()) {
    return {
      allowed: false,
      reason:
        'Lock your Curator SKU prefix on /profile and mint a permanent barcode before placement or thermal printing.',
    };
  }
  return { allowed: true, reason: '' };
}

/**
 * Strips protected ownership/cost/accounting/split-status fields from a Co-Curator update payload
 * while preserving non-enumerable save-lifecycle hooks (`__markAsync`, `__onSaveComplete`) used by `ItemDrawer`.
 */
export function sanitizeCoCuratorUpdatePayload<T extends Record<string, any>>(
  payload: T,
  _originalItem?: any
): Partial<T> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(payload || {})) {
    if ((CO_CURATOR_PROTECTED_FIELDS as readonly string[]).includes(key)) continue;
    if (
      key === 'status' &&
      CO_CURATOR_BLOCKED_STATUSES.has(String(value || '').trim().toLowerCase())
    ) {
      continue;
    }
    clean[key] = value;
  }

  // CRITICAL: preserve non-enumerable save hooks attached by ItemDrawer.vue
  for (const hookName of ['__markAsync', '__onSaveComplete'] as const) {
    const desc = Object.getOwnPropertyDescriptor(payload, hookName);
    if (desc) {
      Object.defineProperty(clean, hookName, {
        value: desc.value,
        enumerable: false,
        configurable: true,
        writable: true,
      });
    }
  }

  return clean as Partial<T>;
}

/**
 * Formats a standardized PO number using the Curator's SKU root or 'DRAFT'.
 */
export function buildCuratorPoNumber(prefix?: string | null, timestamp6?: string): string {
  const ts =
    timestamp6 && String(timestamp6).trim()
      ? String(timestamp6).trim()
      : String(Date.now()).slice(-6);
  if (!prefix || isDraftPlaceholderUpc(prefix)) {
    return `PO-DRAFT-${ts}`;
  }
  const norm = normalizeUpcPrefix(prefix);
  const root = norm ? norm.replace(/-$/, '') : 'DRAFT';
  return `PO-${root}-${ts}`;
}

/**
 * Evaluates ownership and edit/delete permissions for a Purchase Order.
 */
export function evaluatePurchaseAccess(
  purchase: any,
  linkedItems: readonly any[],
  caps?: Partial<MemberCapabilities> | null,
  userId?: string | null
): PurchaseAccessDecision {
  const poStr = String(purchase?.poNumber || '').trim().toUpperCase();
  const poMatch = poStr.match(/^PO-([A-Z0-9]{2,8})-/i);
  const poToken = poMatch ? poMatch[1].toUpperCase() : '';
  const hasDraftPo = poToken === 'DRAFT';
  const poPrefix = poToken && !hasDraftPo ? normalizeUpcPrefix(poToken) : '';

  const counts = new Map<string, number>();
  for (const it of linkedItems || []) {
    const pfx = extractItemOwnerPrefix(it);
    if (pfx) counts.set(pfx, (counts.get(pfx) || 0) + 1);
  }
  let dominantItemPrefix = '';
  let maxCount = 0;
  for (const [pfx, cnt] of counts.entries()) {
    if (cnt > maxCount) {
      maxCount = cnt;
      dominantItemPrefix = pfx;
    }
  }

  const ownerPrefix = poPrefix || dominantItemPrefix;
  const ownerBadge = ownerPrefix || (hasDraftPo ? 'DRAFT' : '');

  const uid = String(userId || '').trim();
  const owned = getMemberOwnedPrefixes(caps);
  const byBuyer = Boolean(uid && String(purchase?.buyerId || '').trim() === uid);
  const byPoPrefix = Boolean(ownerPrefix && owned.includes(ownerPrefix));
  const byLinkedItems = (linkedItems || []).some((it) =>
    matchesMySkuFilter(it, owned, uid)
  );
  const isMine = byBuyer || byPoPrefix || byLinkedItems;

  const isFounder = caps?.role === 'founder';
  const canEdit = isFounder || (!caps?.isConsignor && isMine);
  const canDelete = canEdit;
  const readOnlyReason = canEdit
    ? ''
    : caps?.isConsignor
      ? 'Consignor view is read-only.'
      : `Read-Only Collective Purchase Order — belongs to ${ownerBadge || 'another Curator'}.`;

  return {
    isMine,
    canEdit,
    canDelete,
    ownerPrefix,
    ownerBadge,
    readOnlyReason,
  };
}

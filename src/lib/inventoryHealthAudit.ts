import { normalizeInventoryStatus } from './inventoryStatus';
import { getSellingBoothMetas, resolveCanonicalLocationCode } from './warehouses';
import {
  buildLockedMultiBinMap,
  cleanCatalogSku,
  splitTrailingBoothSku,
} from './salesBucketing';
import {
  evaluateItemAccess,
  evaluatePurchaseAccess,
  extractItemOwnerPrefix,
  getMemberOwnedPrefixes,
  matchesMySkuFilter,
} from './curatorOwnership';
import { isRefundedPurchaseOrder } from './shipmentTracking';
import type { MemberCapabilities } from './memberAccess';

export type HealthAuditScope = 'mine' | 'all';

export interface UnclosedSplitLotFinding {
  id: string;
  parentLot: any;
  children: any[];
  soldChildrenCount: number;
  placedChildrenCount: number;
  receivedChildrenCount: number;
  canEdit: boolean;
  ownerPrefix: string;
}

export interface ProvenanceCarryForward {
  cost?: number;
  orderId?: string;
  purchaseId?: string;
  sourcingLocation?: string;
}

export interface SoldTwinGhostFinding {
  id: string;
  pairKey: string;
  ghostItem: any;
  confidence: 'exact' | 'fuzzy';
  matchReason: 'sgw_id' | 'identity' | 'direct_sale' | 'fuzzy_sold_item' | 'fuzzy_sale_ticket';
  reasonLabel: string;
  matchedItem: any | null;
  matchedSale: any | null;
  provenanceToCarry: ProvenanceCarryForward | null;
  canEditGhost: boolean;
  canBackfillKeeper: boolean;
}

export interface ActiveDuplicateCluster {
  id: string;
  matchKeyLabel: string;
  keeper: any;
  clones: any[];
  allItems: any[];
  requiresManualCheck: boolean;
  provenanceToCarry: ProvenanceCarryForward | null;
  canEditKeeper: boolean;
}

export interface BarcodeCollisionFinding {
  id: string;
  upc: string;
  protectedSummary: string;
  protectedItem: any | null;
  conflictingSale: any | null;
  retagTargets: any[];
  requiresManualCheck: boolean;
}

export interface StaleOpenPurchaseFinding {
  id: string;
  purchase: any;
  linkedItems: any[];
  duplicateOrderPo: any | null;
  reasonLabel: string;
  canEdit: boolean;
}

export interface ItemInlineHealthWarning {
  kind: 'split_parent' | 'sold_ghost' | 'active_clone' | 'barcode_collision';
  severity: 'warning' | 'error' | 'info';
  headline: string;
  detail: string;
  findingId: string;
  recommendedAction: 'mark_deconstructed' | 'archive_duplicate' | 'mint_fresh_upc' | 'review';
  keeperItem?: any | null;
  provenanceToCarry?: ProvenanceCarryForward | null;
}

export interface InventoryHealthReport {
  scope: HealthAuditScope;
  unclosedSplitLots: UnclosedSplitLotFinding[];
  soldTwinGhosts: SoldTwinGhostFinding[];
  exactSoldGhostsCount: number;
  fuzzySoldGhostsCount: number;
  activeDuplicateClusters: ActiveDuplicateCluster[];
  extraActiveClonesCount: number;
  barcodeCollisions: BarcodeCollisionFinding[];
  staleOpenPurchases: StaleOpenPurchaseFinding[];
  actionableOpenPurchasesCount: number;
  totalHighConfidenceCount: number;
  totalReviewCount: number;
  byItemId: Map<string, ItemInlineHealthWarning>;
}

const GENERIC_IDENTITIES = new Set([
  'unidentified item',
  'receipt item',
  'inspected piece',
  'unknown',
  'item',
  'lot item',
  'hardcover book',
  'hardcover reference book',
  'paperback book',
  'softcover book',
  'vintage item',
  'booth item',
]);

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'lot',
  'set',
  'vintage',
  'new',
  'box',
  'book',
  'books',
  'game',
  'games',
  'edition',
  'hardcover',
  'softcover',
  'paperback',
  'mens',
  'womens',
  'women',
  'size',
  'black',
  'white',
  'red',
  'blue',
  'green',
  'brown',
  'silver',
  'gold',
  'style',
  'from',
  'assorted',
  'misc',
  'piece',
  'pieces',
  'bundle',
  'pack',
  'pair',
  'series',
]);

export function normalizeComparableTitle(raw: unknown): string {
  const withoutBoothSuffix = splitTrailingBoothSku(String(raw || '')).title || String(raw || '');
  return withoutBoothSuffix
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function tokenizeDistinctiveWords(raw: unknown): string[] {
  const norm = normalizeComparableTitle(raw);
  if (!norm) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const word of norm.split(' ')) {
    if (word.length < 4 || STOP_WORDS.has(word)) continue;
    if (!seen.has(word)) {
      seen.add(word);
      out.push(word);
    }
  }
  return out;
}

export function areTitlesDuplicateCompatible(titleA: unknown, titleB: unknown): boolean {
  const a = normalizeComparableTitle(titleA);
  const b = normalizeComparableTitle(titleB);
  if (!a || !b) return false;
  if (a === b) return true;

  const tokensA = a.split(' ').filter((w) => w.length >= 3);
  const tokensB = b.split(' ').filter((w) => w.length >= 3);
  if (tokensA.length === 0 || tokensB.length === 0) return false;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let shared = 0;
  for (const tok of setA) {
    if (setB.has(tok)) shared++;
  }
  const union = setA.size + setB.size - shared;
  const jaccard = union > 0 ? shared / union : 0;

  if (jaccard >= 0.65) return true;
  if ((a.includes(b) || b.includes(a)) && shared >= 3 && jaccard >= 0.5) return true;
  return false;
}

export function extractExternalSourcingId(doc: any): string | null {
  if (!doc || typeof doc !== 'object') return null;
  for (const field of [doc.identity, doc.upc, doc.sourcingLocation, doc.conditionNotes]) {
    const str = String(field || '').trim();
    if (!str) continue;
    const urlMatch = str.match(/shopgoodwill\.com\/item\/(\d{6,12})/i);
    if (urlMatch) return `sgw:${urlMatch[1]}`;
    const sgwUpc = str.match(/^SGW-(\d{6,12})$/i);
    if (sgwUpc) return `sgw:${sgwUpc[1]}`;
    if (field === doc.identity && /^\d{7,12}$/.test(str)) {
      return `sgw:${str}`;
    }
  }
  return null;
}

export function isNonGenericIdentity(raw: unknown): string | null {
  const s = String(raw || '').trim().toLowerCase();
  if (!s || s.length < 6) return null;
  if (GENERIC_IDENTITIES.has(s)) return null;
  return s;
}

export function isArchivedOrDeletedStatus(rawStatus: unknown): boolean {
  const s = String(rawStatus || '').trim().toLowerCase();
  return s === 'archived' || s === 'deleted' || s === 'void';
}

export function isUnacquiredBuyTrackerPo(po: any): boolean {
  if (!po) return false;
  const st = String(po.status || '').trim().toLowerCase();
  if (st === 'draft') return true;
  const oid = String(po.orderId || '').trim().toUpperCase();
  if (oid.startsWith('SC-') && st === 'draft') return true;
  return false;
}

export function isActionableOpenPurchase(po: any): boolean {
  if (!po || typeof po !== 'object') return false;
  if (isUnacquiredBuyTrackerPo(po)) return false;
  if (isRefundedPurchaseOrder(po)) return false;
  const st = String(po.status || '').trim().toLowerCase();
  if (['received', 'cancelled', 'canceled', 'returned', 'refunded', 'void'].includes(st)) {
    return false;
  }
  return true;
}

export function buildBoothCodeSet(liveWarehouses?: any[]): Set<string> {
  return new Set(getSellingBoothMetas(liveWarehouses).map((m) => m.code));
}

export function isItemAtRetailBooth(
  item: any,
  boothCodes: Set<string>,
  liveWarehouses?: any[]
): boolean {
  if (!item) return false;
  const code = resolveCanonicalLocationCode(item.storageLocation, liveWarehouses);
  return Boolean(code && boothCodes.has(code));
}

export function isProtectedBoothOrBinItem(
  item: any,
  boothCodes: Set<string>,
  multiBinIds: Set<string>,
  liveWarehouses?: any[]
): boolean {
  if (!item) return false;
  if (Boolean(cleanCatalogSku(item.locationSku))) return true;
  if (Number(item.quantity || 1) > 1) return true;
  if (item.$id && multiBinIds.has(String(item.$id))) return true;
  const normStatus = normalizeInventoryStatus(item.status);
  if (normStatus === 'placed' && isItemAtRetailBooth(item, boothCodes, liveWarehouses)) {
    return true;
  }
  return false;
}

export function buildProvenanceCarryForward(
  sourceGhost: any,
  targetKeeper: any | null
): ProvenanceCarryForward | null {
  if (!sourceGhost || !targetKeeper) return null;
  const carry: ProvenanceCarryForward = {};
  const keeperCost = Number(targetKeeper.cost || 0);
  const ghostCost = Number(sourceGhost.cost || 0);
  if (keeperCost <= 0 && ghostCost > 0) {
    carry.cost = ghostCost;
  }
  if (!String(targetKeeper.orderId || '').trim() && String(sourceGhost.orderId || '').trim()) {
    carry.orderId = String(sourceGhost.orderId).trim();
  }
  if (
    !String(targetKeeper.purchaseId || '').trim() &&
    String(sourceGhost.purchaseId || '').trim()
  ) {
    carry.purchaseId = String(sourceGhost.purchaseId).trim();
  }
  if (
    !String(targetKeeper.sourcingLocation || '').trim() &&
    String(sourceGhost.sourcingLocation || '').trim()
  ) {
    carry.sourcingLocation = String(sourceGhost.sourcingLocation).trim();
  }
  return Object.keys(carry).length > 0 ? carry : null;
}

function scoreKeeperCandidate(
  item: any,
  boothCodes: Set<string>,
  liveWarehouses?: any[]
): number {
  let score = 0;
  if (cleanCatalogSku(item?.locationSku)) score += 10_000;
  const normStatus = normalizeInventoryStatus(item?.status);
  if (normStatus === 'sold') score += 8_000;
  if (normStatus === 'placed' && isItemAtRetailBooth(item, boothCodes, liveWarehouses)) {
    score += 5_000;
  } else if (normStatus === 'placed') {
    score += 2_000;
  } else if (normStatus === 'received') {
    score += 500;
  }
  if (String(item?.purchaseId || item?.orderId || '').trim()) score += 300;
  if (Number(item?.cost || 0) > 0) score += 200;
  if (Number(item?.resalePrice || 0) > 0) score += 100;
  const photoCount =
    (item?.imageId ? 1 : 0) +
    (Array.isArray(item?.galleryImageIds) ? item.galleryImageIds.length : 0);
  score += Math.min(photoCount, 10) * 15;
  return score;
}

export function pickCanonicalKeeper(
  candidates: any[],
  boothCodes: Set<string>,
  liveWarehouses?: any[]
): any {
  const sorted = [...candidates].sort((a, b) => {
    const diff =
      scoreKeeperCandidate(b, boothCodes, liveWarehouses) -
      scoreKeeperCandidate(a, boothCodes, liveWarehouses);
    if (diff !== 0) return diff;
    const ca = String(a?.$createdAt || a?.$id || '');
    const cb = String(b?.$createdAt || b?.$id || '');
    return ca.localeCompare(cb);
  });
  return sorted[0];
}

export interface AuditHealthParams {
  items: readonly any[];
  purchases?: readonly any[];
  sales?: readonly any[];
  capabilities?: Partial<MemberCapabilities> | null;
  userId?: string | null;
  scope?: HealthAuditScope;
  dismissedPairKeys?: ReadonlySet<string>;
  liveWarehouses?: any[];
}

export function auditInventoryAndPurchaseHealth(
  params: AuditHealthParams
): InventoryHealthReport {
  const rawItems = Array.isArray(params.items) ? params.items : [];
  const rawPurchases = Array.isArray(params.purchases) ? params.purchases : [];
  const rawSales = Array.isArray(params.sales) ? params.sales : [];
  const caps = params.capabilities || null;
  const userId = params.userId || null;
  const scope: HealthAuditScope = params.scope || 'mine';
  const dismissed = params.dismissedPairKeys || new Set<string>();
  const liveWarehouses = params.liveWarehouses;

  const boothCodes = buildBoothCodeSet(liveWarehouses);
  const ownedPrefixes = getMemberOwnedPrefixes(caps);
  const hasOwnerFilter =
    scope === 'mine' && !caps?.isConsignor && (Boolean(userId) || ownedPrefixes.length > 0);

  const isInScopeItem = (item: any): boolean => {
    if (!hasOwnerFilter) return true;
    return matchesMySkuFilter(item, ownedPrefixes, userId);
  };

  const validItems = rawItems.filter((it) => it && !isArchivedOrDeletedStatus(it.status));
  const multiBinMap = buildLockedMultiBinMap(validItems as any[], new Map());
  const multiBinIds = new Set<string>();
  for (const binItem of multiBinMap.values()) {
    if (binItem?.$id) multiBinIds.add(String(binItem.$id));
  }

  const byItemId = new Map<string, ItemInlineHealthWarning>();

  const isActiveCandidateStatus = (it: any): boolean => {
    const norm = normalizeInventoryStatus(it?.status);
    return norm === 'received' || norm === 'acquired' || norm === 'placed';
  };

  const isUnplacedStatus = (it: any): boolean => {
    const norm = normalizeInventoryStatus(it?.status);
    return norm === 'received' || norm === 'acquired';
  };

  // 1. UNCLOSED SPLIT PARENT LOTS
  // Exclude `status === 'combined'` children (which belong to active Combined Bundles / Restocked Bins)
  // and exclude multi-qty Booth Bins or items carrying a physical booth `locationSku`.
  const splitChildrenByParent = new Map<string, any[]>();
  for (const it of validItems) {
    const pid = String(it.parentLotId || '').trim();
    if (!pid) continue;
    const childNorm = normalizeInventoryStatus(it.status);
    if (childNorm === 'combined') continue;
    const list = splitChildrenByParent.get(pid) || [];
    list.push(it);
    splitChildrenByParent.set(pid, list);
  }

  const unclosedSplitLots: UnclosedSplitLotFinding[] = [];
  const unclosedParentIds = new Set<string>();

  for (const it of validItems) {
    if (!it.$id || !isActiveCandidateStatus(it)) continue;
    if (Number(it.quantity || 1) > 1 || multiBinIds.has(String(it.$id))) continue;
    if (cleanCatalogSku(it.locationSku)) continue;

    const kids = splitChildrenByParent.get(String(it.$id));
    if (!kids || kids.length === 0) continue;

    unclosedParentIds.add(String(it.$id));
    if (!isInScopeItem(it)) continue;

    const access = evaluateItemAccess(it, caps, { userId });
    const soldChildrenCount = kids.filter(
      (k) => normalizeInventoryStatus(k.status) === 'sold'
    ).length;
    const placedChildrenCount = kids.filter(
      (k) => normalizeInventoryStatus(k.status) === 'placed'
    ).length;
    const receivedChildrenCount = kids.length - soldChildrenCount - placedChildrenCount;

    unclosedSplitLots.push({
      id: String(it.$id),
      parentLot: it,
      children: kids,
      soldChildrenCount,
      placedChildrenCount,
      receivedChildrenCount,
      canEdit: access.canEditFull,
      ownerPrefix: extractItemOwnerPrefix(it),
    });

    byItemId.set(String(it.$id), {
      kind: 'split_parent',
      severity: 'warning',
      headline: `✂️ Already-Split Parent Lot (${kids.length} extracted item${kids.length === 1 ? '' : 's'})`,
      detail: `This lot already has ${kids.length} split child item${kids.length === 1 ? '' : 's'} (${soldChildrenCount} sold, ${placedChildrenCount} placed). Mark the parent lot Deconstructed so it leaves active backstock.`,
      findingId: String(it.$id),
      recommendedAction: 'mark_deconstructed',
    });
  }

  // Build Terminal (Sold / Deconstructed) Indexes & Sales Ticket Indexes
  const terminalItems = validItems.filter((it) => {
    const norm = normalizeInventoryStatus(it.status);
    return norm === 'sold' || norm === 'deconstructed';
  });

  const terminalBySgw = new Map<string, any[]>();
  const terminalByIdentity = new Map<string, any[]>();
  const terminalTokenized: Array<{ item: any; normTitle: string; tokens: string[] }> = [];

  for (const term of terminalItems) {
    const sgw = extractExternalSourcingId(term);
    if (sgw && !term.parentLotId) {
      terminalBySgw.set(sgw, [...(terminalBySgw.get(sgw) || []), term]);
    }
    const ident = !term.parentLotId ? isNonGenericIdentity(term.identity) : null;
    if (ident) {
      terminalByIdentity.set(ident, [...(terminalByIdentity.get(ident) || []), term]);
    }
    const normT = normalizeComparableTitle(term.title);
    const toks = tokenizeDistinctiveWords(term.title);
    if (normT.length >= 14) {
      terminalTokenized.push({ item: term, normTitle: normT, tokens: toks });
    }
  }

  const validSales = rawSales.filter(
    (s) => s && String(s.status || '').trim().toLowerCase() !== 'cancelled'
  );
  const saleById = new Map<string, any>();
  const salesBySo = new Map<string, any[]>();
  const salesTokenized: Array<{
    sale: any;
    so: string;
    cleanTitle: string;
    normTitle: string;
    tokens: string[];
  }> = [];

  for (const s of validSales) {
    if (s.$id) saleById.set(String(s.$id), s);
    const so = cleanCatalogSku(s.soNumber).toUpperCase();
    if (so) salesBySo.set(so, [...(salesBySo.get(so) || []), s]);

    const rawDesc =
      s.orderId && String(s.orderId).includes('•')
        ? String(s.orderId).split('•').slice(1).join('•').trim()
        : '';
    const cleanTitle = splitTrailingBoothSku(rawDesc).title || rawDesc;
    const normT = normalizeComparableTitle(cleanTitle);
    const toks = tokenizeDistinctiveWords(cleanTitle);
    salesTokenized.push({ sale: s, so, cleanTitle, normTitle: normT, tokens: toks });
  }

  // Track Conflicting Sales on Same Barcode (where sale description clearly belongs to a different product)
  const conflictingSaleByItemId = new Map<string, any>();

  // 2. ALREADY-SOLD BACKSTOCK GHOSTS
  const soldTwinGhosts: SoldTwinGhostFinding[] = [];
  const exactSoldGhostIds = new Set<string>();

  for (const it of validItems) {
    if (!it.$id || unclosedParentIds.has(String(it.$id))) continue;
    if (!isUnplacedStatus(it)) continue;
    if (isProtectedBoothOrBinItem(it, boothCodes, multiBinIds, liveWarehouses)) continue;

    const sgw = !it.parentLotId ? extractExternalSourcingId(it) : null;
    const ident = !it.parentLotId ? isNonGenericIdentity(it.identity) : null;
    const normT = normalizeComparableTitle(it.title);
    const toks = tokenizeDistinctiveWords(it.title);
    const tokSet = new Set(toks);
    const cleanUpc = cleanCatalogSku(it.upc).toUpperCase();

    let matchedItem: any | null = null;
    let matchedSale: any | null = null;
    let confidence: 'exact' | 'fuzzy' | null = null;
    let matchReason: SoldTwinGhostFinding['matchReason'] | null = null;
    let reasonLabel = '';

    // 2A. Exact Sourcing ID match (title-gated so distinct pieces split from the same multi-item lot stay separate)
    if (sgw && terminalBySgw.has(sgw)) {
      const compatSgw = terminalBySgw
        .get(sgw)!
        .filter((cand) => areTitlesDuplicateCompatible(it.title, cand?.title));
      if (compatSgw.length > 0) {
        matchedItem = pickCanonicalKeeper(compatSgw, boothCodes, liveWarehouses);
        confidence = 'exact';
        matchReason = 'sgw_id';
        reasonLabel = `Exact sourcing lot match (${sgw.replace('sgw:', 'Lot #')})`;
      }
    }

    // 2B. Exact non-generic Identity match (title-gated so shared lot identities stay separate across distinct pieces)
    if (!matchedItem && ident && terminalByIdentity.has(ident)) {
      const compatIdent = terminalByIdentity
        .get(ident)!
        .filter((cand) => areTitlesDuplicateCompatible(it.title, cand?.title));
      if (compatIdent.length > 0) {
        matchedItem = pickCanonicalKeeper(compatIdent, boothCodes, liveWarehouses);
        confidence = 'exact';
        matchReason = 'identity';
        reasonLabel = 'Exact item identity match to sold/split record';
      }
    }

    // 2C. Direct saleId or UPC match in `sales` (verifying title compatibility if sale has a product title!)
    if (!matchedItem && !matchedSale) {
      const directSaleById = it.saleId ? saleById.get(String(it.saleId)) : null;
      if (directSaleById) {
        matchedSale = directSaleById;
        confidence = 'exact';
        matchReason = 'direct_sale';
        reasonLabel = `Directly linked to register sale (${directSaleById.orderId || directSaleById.soNumber})`;
      } else if (cleanUpc && salesBySo.has(cleanUpc)) {
        const candSale = salesBySo.get(cleanUpc)![0];
        const parsedSale = salesTokenized.find((st) => st.sale.$id === candSale.$id);
        const saleToks = parsedSale?.tokens || [];
        if (saleToks.length === 0) {
          // Ticket has no title text; check if another sold item already owns this UPC
          const otherSoldWithUpc = terminalItems.find(
            (t) => cleanCatalogSku(t.upc).toUpperCase() === cleanUpc
          );
          if (!otherSoldWithUpc) {
            matchedSale = candSale;
            confidence = 'exact';
            matchReason = 'direct_sale';
            reasonLabel = `Register sale recorded under barcode ${cleanUpc}`;
          }
        } else {
          const shared = saleToks.filter((w) => tokSet.has(w));
          if (shared.length >= 1) {
            matchedSale = candSale;
            confidence = 'exact';
            matchReason = 'direct_sale';
            reasonLabel = `Register sale recorded under ${cleanUpc}`;
          } else {
            // Different item sold under same UPC -> Barcode Collision!
            conflictingSaleByItemId.set(String(it.$id), candSale);
          }
        }
      }
    }

    // 2D. Exact full normalized title match (>= 16 chars) against Sold/Deconstructed item
    if (!matchedItem && !matchedSale && normT.length >= 16) {
      const exactTitleSold = terminalTokenized.find((t) => t.normTitle === normT);
      if (exactTitleSold) {
        matchedItem = exactTitleSold.item;
        confidence = 'exact';
        matchReason = 'fuzzy_sold_item';
        reasonLabel = 'Exact full title match to sold/split record';
      }
    }

    // 2E. Fuzzy token match (>= 3 distinctive words & >= 65% overlap) against Sold item or Sale ticket
    if (!matchedItem && !matchedSale && toks.length >= 3) {
      let bestSold: any | null = null;
      let bestRatio = 0;

      for (const cand of terminalTokenized) {
        if (cand.tokens.length < 3) continue;
        // Never re-flag sibling pieces split from the same sourcing lot or parent lot if their titles are incompatible
        if (sgw && extractExternalSourcingId(cand.item) === sgw && !areTitlesDuplicateCompatible(it.title, cand.item?.title)) {
          continue;
        }
        if (
          it.parentLotId &&
          cand.item?.parentLotId &&
          String(it.parentLotId) === String(cand.item.parentLotId) &&
          !areTitlesDuplicateCompatible(it.title, cand.item?.title)
        ) {
          continue;
        }
        const shared = cand.tokens.filter((w) => tokSet.has(w)).length;
        const ratio = shared / Math.min(toks.length, cand.tokens.length);
        if (shared >= 3 && ratio >= 0.65 && ratio > bestRatio) {
          bestRatio = ratio;
          bestSold = cand.item;
        }
      }

      if (bestSold) {
        matchedItem = bestSold;
        confidence = 'fuzzy';
        matchReason = 'fuzzy_sold_item';
        reasonLabel = `Similar title to sold item (${Math.round(bestRatio * 100)}% keyword match)`;
      } else {
        for (const sr of salesTokenized) {
          if (sr.tokens.length < 3) continue;
          const shared = sr.tokens.filter((w) => tokSet.has(w)).length;
          const ratio = shared / Math.min(toks.length, sr.tokens.length);
          if (shared >= 3 && ratio >= 0.65 && ratio > bestRatio) {
            bestRatio = ratio;
            matchedSale = sr.sale;
          }
        }
        if (matchedSale) {
          confidence = 'fuzzy';
          matchReason = 'fuzzy_sale_ticket';
          reasonLabel = `Similar title to register sale (${Math.round(bestRatio * 100)}% keyword match)`;
        }
      }
    }

    if (!confidence || !matchReason) continue;

    if (!matchedSale && matchedItem?.saleId && saleById.has(String(matchedItem.saleId))) {
      matchedSale = saleById.get(String(matchedItem.saleId)) || null;
    }

    const targetId = String(matchedItem?.$id || matchedSale?.$id || 'unknown');
    const pairKey = `ghost:${it.$id}:${targetId}`;
    if (dismissed.has(pairKey)) continue;

    if (confidence === 'exact') {
      exactSoldGhostIds.add(String(it.$id));
    }

    if (!isInScopeItem(it)) continue;

    const ghostAccess = evaluateItemAccess(it, caps, { userId });
    const keeperAccess = matchedItem
      ? evaluateItemAccess(matchedItem, caps, { userId })
      : { canEditFull: false };
    const provenanceToCarry = buildProvenanceCarryForward(it, matchedItem);

    soldTwinGhosts.push({
      id: String(it.$id),
      pairKey,
      ghostItem: it,
      confidence,
      matchReason,
      reasonLabel,
      matchedItem,
      matchedSale,
      provenanceToCarry,
      canEditGhost: ghostAccess.canEditFull,
      canBackfillKeeper: Boolean(provenanceToCarry && keeperAccess.canEditFull),
    });

    if (!byItemId.has(String(it.$id))) {
      const refLabel = matchedItem
        ? `${matchedItem.upc || 'Item'} (${normalizeInventoryStatus(matchedItem.status).toUpperCase()})`
        : `${matchedSale?.orderId || matchedSale?.soNumber || 'Register Sale'}`;
      byItemId.set(String(it.$id), {
        kind: 'sold_ghost',
        severity: confidence === 'exact' ? 'error' : 'warning',
        headline:
          confidence === 'exact'
            ? '💸 Already Sold / Deconstructed Twin Found'
            : '🔎 Possible Already-Sold Match',
        detail: `${reasonLabel} — matches ${refLabel}.`,
        findingId: String(it.$id),
        recommendedAction: 'archive_duplicate',
        keeperItem: matchedItem,
        provenanceToCarry,
      });
    }
  }

  // Sort exact sold ghosts before fuzzy review suggestions
  soldTwinGhosts.sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence === 'exact' ? -1 : 1;
    return String(b.ghostItem?.$createdAt || '').localeCompare(
      String(a.ghostItem?.$createdAt || '')
    );
  });

  // 3. ACTIVE-TO-ACTIVE DUPLICATE CLUSTERS
  const activePool = validItems.filter(
    (it) =>
      it.$id &&
      isActiveCandidateStatus(it) &&
      !unclosedParentIds.has(String(it.$id)) &&
      !exactSoldGhostIds.has(String(it.$id)) &&
      Number(it.quantity || 1) <= 1 &&
      !multiBinIds.has(String(it.$id))
  );

  const ufParent = new Map<string, string>();
  const keyReason = new Map<string, string>();
  for (const it of activePool) ufParent.set(String(it.$id), String(it.$id));

  const ufFind = (x: string): string => {
    let cur = x;
    while (ufParent.get(cur) !== cur) {
      const p = ufParent.get(cur)!;
      ufParent.set(cur, ufParent.get(p) || p);
      cur = p;
    }
    return cur;
  };
  const ufUnion = (a: string, b: string, label: string) => {
    const ra = ufFind(a);
    const rb = ufFind(b);
    if (ra !== rb) {
      ufParent.set(ra, rb);
      if (!keyReason.has(rb)) keyReason.set(rb, label);
    }
  };

  const seenByKey = new Map<string, Array<{ id: string; title: unknown; label: string }>>();
  for (const it of activePool) {
    const idStr = String(it.$id);
    const candidateKeys: Array<{ key: string; label: string; requireTitleCompat: boolean }> = [];

    if (!it.parentLotId) {
      const sgw = extractExternalSourcingId(it);
      if (sgw) {
        candidateKeys.push({
          key: sgw,
          label: `Same sourcing lot (${sgw.replace('sgw:', '#')})`,
          requireTitleCompat: true,
        });
      }
      const ident = isNonGenericIdentity(it.identity);
      if (ident) {
        candidateKeys.push({
          key: `id:${ident}`,
          label: 'Same item identity',
          requireTitleCompat: true,
        });
      }
    }
    const normT = normalizeComparableTitle(it.title);
    if (normT.length >= 16 && !GENERIC_IDENTITIES.has(normT)) {
      candidateKeys.push({
        key: `title:${normT}`,
        label: 'Identical item title',
        requireTitleCompat: false,
      });
    }

    for (const ck of candidateKeys) {
      const prevList = seenByKey.get(ck.key);
      if (prevList && prevList.length > 0) {
        for (const prev of prevList) {
          if (!ck.requireTitleCompat || areTitlesDuplicateCompatible(prev.title, it.title)) {
            ufUnion(prev.id, idStr, ck.label);
          }
        }
        prevList.push({ id: idStr, title: it.title, label: ck.label });
      } else {
        seenByKey.set(ck.key, [{ id: idStr, title: it.title, label: ck.label }]);
      }
    }
  }

  const groupedActive = new Map<string, any[]>();
  for (const it of activePool) {
    const root = ufFind(String(it.$id));
    const arr = groupedActive.get(root) || [];
    arr.push(it);
    groupedActive.set(root, arr);
  }

  const activeDuplicateClusters: ActiveDuplicateCluster[] = [];
  let extraActiveClonesCount = 0;

  for (const [root, group] of groupedActive.entries()) {
    if (group.length < 2) continue;
    if (!group.some(isInScopeItem)) continue;

    const clusterId = `cluster:${root}`;
    if (dismissed.has(clusterId)) continue;

    const keeper = pickCanonicalKeeper(group, boothCodes, liveWarehouses);
    const clones = group.filter((x) => x.$id !== keeper.$id);

    // If any non-keeper ALSO has a booth locationSku or is placed at a retail booth, require manual check!
    const requiresManualCheck = clones.some((c) =>
      isProtectedBoothOrBinItem(c, boothCodes, multiBinIds, liveWarehouses)
    );

    const firstCloneWithProv =
      clones.find((c) => buildProvenanceCarryForward(c, keeper) !== null) || clones[0];
    const provenanceToCarry = buildProvenanceCarryForward(firstCloneWithProv, keeper);
    const keeperAccess = evaluateItemAccess(keeper, caps, { userId });

    activeDuplicateClusters.push({
      id: clusterId,
      matchKeyLabel: keyReason.get(root) || 'Duplicate active item records',
      keeper,
      clones,
      allItems: group,
      requiresManualCheck,
      provenanceToCarry,
      canEditKeeper: keeperAccess.canEditFull,
    });

    extraActiveClonesCount += clones.length;

    for (const clone of clones) {
      if (!byItemId.has(String(clone.$id))) {
        byItemId.set(String(clone.$id), {
          kind: 'active_clone',
          severity: 'warning',
          headline: `👯 Duplicate Active Copy (${group.length} copies in stock)`,
          detail: `${keyReason.get(root) || 'Duplicate item'} — recommended Keeper is ${keeper.upc || 'primary record'} (${keeper.storageLocation || 'Backstock'}).`,
          findingId: clusterId,
          recommendedAction: requiresManualCheck ? 'review' : 'archive_duplicate',
          keeperItem: keeper,
          provenanceToCarry: buildProvenanceCarryForward(clone, keeper),
        });
      }
    }
  }

  // 4. BARCODE (UPC) COLLISIONS INVOLVING ACTIVE ITEMS
  const byUpc = new Map<string, any[]>();
  for (const it of validItems) {
    const u = cleanCatalogSku(it.upc).toUpperCase();
    if (!u || u === 'NO-UPC' || u.startsWith('DRAFT-')) continue;
    byUpc.set(u, [...(byUpc.get(u) || []), it]);
  }

  const barcodeCollisions: BarcodeCollisionFinding[] = [];
  const seenCollisionUpcs = new Set<string>();

  for (const [upc, arr] of byUpc.entries()) {
    if (arr.length < 2) continue;
    if (!arr.some(isActiveCandidateStatus)) continue;
    if (!arr.some(isInScopeItem)) continue;

    // Skip if every item in this UPC group is already the exact same duplicate cluster
    const normTitles = new Set(arr.map((i) => normalizeComparableTitle(i.title)));
    if (normTitles.size <= 1) continue;

    seenCollisionUpcs.add(upc);
    const protectedItem = pickCanonicalKeeper(arr, boothCodes, liveWarehouses);
    const others = arr.filter((x) => x.$id !== protectedItem.$id && isActiveCandidateStatus(x));
    if (others.length === 0) continue;

    const requiresManualCheck = others.some((o) =>
      isProtectedBoothOrBinItem(o, boothCodes, multiBinIds, liveWarehouses)
    );
    const retagTargets = others.filter(
      (o) =>
        !isProtectedBoothOrBinItem(o, boothCodes, multiBinIds, liveWarehouses) &&
        evaluateItemAccess(o, caps, { userId }).canEditFull
    );

    barcodeCollisions.push({
      id: `upc:${upc}`,
      upc,
      protectedSummary: `${protectedItem.title || 'Primary Item'} (${normalizeInventoryStatus(protectedItem.status).toUpperCase()} @ ${protectedItem.locationSku || protectedItem.storageLocation || 'Booth'})`,
      protectedItem,
      conflictingSale: null,
      retagTargets,
      requiresManualCheck,
    });

    for (const target of others) {
      if (!byItemId.has(String(target.$id))) {
        byItemId.set(String(target.$id), {
          kind: 'barcode_collision',
          severity: 'error',
          headline: `🏷️ Barcode Collision on ${upc}`,
          detail: `${upc} is already used by "${protectedItem.title || 'another item'}". Mint a fresh barcode before printing tags.`,
          findingId: `upc:${upc}`,
          recommendedAction: retagTargets.some((r) => r.$id === target.$id)
            ? 'mint_fresh_upc'
            : 'review',
        });
      }
    }
  }

  // Include active items whose UPC collided with a different product's historical sale `soNumber`
  for (const [itemId, sale] of conflictingSaleByItemId.entries()) {
    const target = validItems.find((x) => String(x.$id) === itemId);
    if (!target || !isInScopeItem(target)) continue;
    const upc = cleanCatalogSku(target.upc).toUpperCase();
    if (!upc || seenCollisionUpcs.has(upc)) continue;
    seenCollisionUpcs.add(upc);

    const canEdit = evaluateItemAccess(target, caps, { userId }).canEditFull;
    barcodeCollisions.push({
      id: `upc-sale:${upc}`,
      upc,
      protectedSummary: `Historical Sale (${sale.orderId || sale.soNumber})`,
      protectedItem: null,
      conflictingSale: sale,
      retagTargets: canEdit ? [target] : [],
      requiresManualCheck: !canEdit,
    });

    if (!byItemId.has(itemId)) {
      byItemId.set(itemId, {
        kind: 'barcode_collision',
        severity: 'error',
        headline: `🏷️ Barcode Collision with Past Sale (${upc})`,
        detail: `${upc} was already recorded on ${sale.orderId || 'a past register ticket'} for a different item. Mint a fresh barcode.`,
        findingId: `upc-sale:${upc}`,
        recommendedAction: canEdit ? 'mint_fresh_upc' : 'review',
      });
    }
  }

  // 5. OPEN PURCHASE ORDERS & STALE / ALREADY-RECEIVED OPEN POs
  const itemsByPoKey = new Map<string, any[]>();
  const pushPoKey = (rawKey: unknown, item: any) => {
    const k = String(rawKey || '').trim();
    if (!k) return;
    const list = itemsByPoKey.get(k) || [];
    list.push(item);
    itemsByPoKey.set(k, list);
  };
  for (const it of validItems) {
    pushPoKey(it.purchaseId, it);
    pushPoKey(it.orderId, it);
    pushPoKey(it.cartId, it);
    pushPoKey(it.poNumber, it);
  }

  const getLinkedItemsForPo = (po: any): any[] => {
    const out: any[] = [];
    const seen = new Set<string>();
    for (const k of [po?.$id, po?.orderId, po?.poNumber]) {
      const key = String(k || '').trim();
      if (!key) continue;
      for (const it of itemsByPoKey.get(key) || []) {
        const id = String(it.$id || it.upc || '');
        if (id && seen.has(id)) continue;
        if (id) seen.add(id);
        out.push(it);
      }
    }
    return out;
  };

  const posByOrderId = new Map<string, any[]>();
  for (const po of rawPurchases) {
    const oid = String(po?.orderId || '').trim();
    if (!oid || oid.toUpperCase().startsWith('SC-')) continue;
    posByOrderId.set(oid, [...(posByOrderId.get(oid) || []), po]);
  }

  let actionableOpenPurchasesCount = 0;
  const staleOpenPurchases: StaleOpenPurchaseFinding[] = [];

  for (const po of rawPurchases) {
    if (!isActionableOpenPurchase(po)) continue;
    const linked = getLinkedItemsForPo(po);
    const poAccess = evaluatePurchaseAccess(po, linked, caps, userId);
    if (hasOwnerFilter && !poAccess.isMine) continue;

    actionableOpenPurchasesCount++;

    const oid = String(po.orderId || '').trim();
    const dupReceivedTwin =
      oid && posByOrderId.has(oid)
        ? posByOrderId
            .get(oid)!
            .find(
              (other) =>
                other.$id !== po.$id &&
                String(other.status || '').trim().toLowerCase() === 'received'
            ) || null
        : null;

    const allLinkedCheckedIn =
      linked.length > 0 &&
      linked.every((it) => {
        const norm = normalizeInventoryStatus(it.status);
        return (
          norm === 'received' ||
          norm === 'placed' ||
          norm === 'sold' ||
          norm === 'combined' ||
          norm === 'deconstructed'
        );
      });

    if (allLinkedCheckedIn || dupReceivedTwin) {
      staleOpenPurchases.push({
        id: String(po.$id),
        purchase: po,
        linkedItems: linked,
        duplicateOrderPo: dupReceivedTwin,
        reasonLabel: dupReceivedTwin
          ? `Order #${oid} already has a Received PO (${dupReceivedTwin.poNumber || dupReceivedTwin.$id})`
          : `All ${linked.length} linked item${linked.length === 1 ? '' : 's'} already checked in (${linked.filter((i) => normalizeInventoryStatus(i.status) === 'sold').length} sold, ${linked.filter((i) => normalizeInventoryStatus(i.status) === 'placed').length} placed)`,
        canEdit: poAccess.canEdit,
      });
    }
  }

  const exactSoldGhostsCount = soldTwinGhosts.filter((g) => g.confidence === 'exact').length;
  const fuzzySoldGhostsCount = soldTwinGhosts.filter((g) => g.confidence === 'fuzzy').length;
  const autoDuplicateClustersCount = activeDuplicateClusters.filter(
    (c) => !c.requiresManualCheck
  ).length;

  const totalHighConfidenceCount =
    unclosedSplitLots.length +
    exactSoldGhostsCount +
    autoDuplicateClustersCount +
    barcodeCollisions.length +
    staleOpenPurchases.length;

  const totalReviewCount =
    fuzzySoldGhostsCount +
    activeDuplicateClusters.filter((c) => c.requiresManualCheck).length;

  return {
    scope,
    unclosedSplitLots,
    soldTwinGhosts,
    exactSoldGhostsCount,
    fuzzySoldGhostsCount,
    activeDuplicateClusters,
    extraActiveClonesCount,
    barcodeCollisions,
    staleOpenPurchases,
    actionableOpenPurchasesCount,
    totalHighConfidenceCount,
    totalReviewCount,
    byItemId,
  };
}

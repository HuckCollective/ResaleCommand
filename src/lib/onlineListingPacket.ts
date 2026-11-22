/**
 * Pure TypeScript 4-Platform Listing Packet Builder (`Poshmark`, `Depop`, `eBay`, `Whatnot`).
 *
 * Security & Lifecycle Contracts:
 * 1. Allowlist ONLY — private fields (`cost`, `purchasePrice`, `maxBuyPrice`, `purchaseId`,
 *    `buyerId`, `rawAnalysis`) are never read or returned in any listing packet.
 * 2. Physical Separation (Law 1) — rejects booth-placed (`MD`/`DT`) items, multi-qty bins,
 *    and terminal statuses via `checkCoCurationEligibility` + `isAlreadyInBooth`.
 * 3. Canonical Price Math — uses `parsePriceValue()` converted to integer cents.
 */

import { isAlreadyInBooth } from './inventoryVibes';
import { parsePriceValue } from './lot-strategy';
import { checkCoCurationEligibility } from './onlineCoCuration';

export type ListingAssistPlatform = 'poshmark' | 'depop' | 'ebay' | 'whatnot';

export interface ListingPlatformLimit {
  id: ListingAssistPlatform;
  label: string;
  shortLabel: string;
  emoji: string;
  hostPatterns: readonly string[];
  createListingUrl: string;
  maxTitleChars: number;
  maxDescriptionChars: number;
  maxPhotos: number;
  maxHashtags: number;
  feeSummary: string;
  feePctHint: number;
  supportsBulkCsv: boolean;
}

export const LISTING_ASSIST_PLATFORMS: readonly ListingAssistPlatform[] = [
  'poshmark',
  'depop',
  'ebay',
  'whatnot',
] as const;

export const LISTING_PLATFORM_LIMITS: Record<ListingAssistPlatform, ListingPlatformLimit> = {
  poshmark: {
    id: 'poshmark',
    label: 'Poshmark',
    shortLabel: 'Poshmark',
    emoji: '👗',
    hostPatterns: ['poshmark.com'],
    createListingUrl: 'https://poshmark.com/create-listing',
    maxTitleChars: 80,
    maxDescriptionChars: 1500,
    maxPhotos: 16,
    maxHashtags: 0,
    feeSummary: '20% ($2.95 under $15) • flat 5 lb label',
    feePctHint: 20,
    supportsBulkCsv: true,
  },
  depop: {
    id: 'depop',
    label: 'Depop',
    shortLabel: 'Depop',
    emoji: '👕',
    hostPatterns: ['depop.com'],
    createListingUrl: 'https://www.depop.com/products/create/',
    maxTitleChars: 80,
    maxDescriptionChars: 1000,
    maxPhotos: 8,
    maxHashtags: 5,
    feeSummary: '0% selling fee • ~3.3% + $0.45 processing',
    feePctHint: 3.3,
    supportsBulkCsv: false,
  },
  ebay: {
    id: 'ebay',
    label: 'eBay',
    shortLabel: 'eBay',
    emoji: '📦',
    hostPatterns: ['ebay.com'],
    createListingUrl: 'https://www.ebay.com/sl/prelist/suggest',
    maxTitleChars: 80,
    maxDescriptionChars: 4000,
    maxPhotos: 12,
    maxHashtags: 0,
    feeSummary: '~13.6% + $0.40 • Pirate Ship SKU',
    feePctHint: 13.6,
    supportsBulkCsv: true,
  },
  whatnot: {
    id: 'whatnot',
    label: 'Whatnot',
    shortLabel: 'Whatnot',
    emoji: '📡',
    hostPatterns: ['whatnot.com'],
    createListingUrl: 'https://www.whatnot.com/dashboard/inventory',
    maxTitleChars: 100,
    maxDescriptionChars: 1500,
    maxPhotos: 8,
    maxHashtags: 0,
    feeSummary: '~8% + 2.9% + $0.30 (~11%) • Live & BIN',
    feePctHint: 11,
    supportsBulkCsv: true,
  },
};

export interface OnlineListingPacket {
  itemId: string;
  platform: ListingAssistPlatform;
  platformLabel: string;
  createListingUrl: string;
  title: string;
  description: string;
  priceCents: number;
  priceFormatted: string;
  sku: string;
  condition: string;
  keywords: string[];
  hashtags: string[];
  photoFileIds: string[];
  binFacility: 'HG' | 'HH';
  feeSummary: string;
}

export function isListingAssistPlatform(raw: unknown): raw is ListingAssistPlatform {
  const s = String(raw || '').trim().toLowerCase();
  return s === 'poshmark' || s === 'depop' || s === 'ebay' || s === 'whatnot';
}

export function normalizeListingPlatform(raw: unknown): ListingAssistPlatform | null {
  const s = String(raw || '').trim().toLowerCase();
  return isListingAssistPlatform(s) ? s : null;
}

export function detectListingPlatformFromHost(hostname: string): ListingAssistPlatform | null {
  const host = String(hostname || '').trim().toLowerCase();
  for (const id of LISTING_ASSIST_PLATFORMS) {
    const meta = LISTING_PLATFORM_LIMITS[id];
    if (meta.hostPatterns.some((p) => host === p || host.endsWith(`.${p}`))) {
      return id;
    }
  }
  return null;
}

function stripUnsafeAndMarkdown(raw: unknown): string {
  return String(raw ?? '')
    .replace(/data:[a-z0-9+/=-]+;base64,[a-z0-9+/=]+/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]+/g, ' ')
    .replace(/[*_`~#]+/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function truncateWordSafe(text: string, maxLen: number): string {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  const slice = clean.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > Math.floor(maxLen * 0.55)) {
    return slice.slice(0, lastSpace).replace(/[\s\-–—,;:\/|]+$/, '').trim();
  }
  return slice.replace(/[\s\-–—,;:\/|]+$/, '').trim();
}

function cleanFileId(raw: unknown): string {
  const id = String(raw ?? '').trim();
  return /^[A-Za-z0-9_][A-Za-z0-9._-]{0,254}$/.test(id) ? id : '';
}

function buildHashtags(keywords: string[], maxCount: number): string[] {
  if (maxCount <= 0) return [];
  const tags: string[] = [];
  for (const kw of keywords) {
    const token = kw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 28);
    if (!token || token.length < 2) continue;
    const tag = `#${token}`;
    if (!tags.includes(tag)) tags.push(tag);
    if (tags.length >= maxCount) break;
  }
  return tags;
}

export function checkListingAssistEligibility(item: any): {
  eligible: boolean;
  reason?: string;
  binFacility: 'HG' | 'HH';
} {
  const base = checkCoCurationEligibility(item);
  const rawLoc = String(item?.storageLocation || '').trim().toUpperCase();
  const binFacility: 'HG' | 'HH' = rawLoc.startsWith('HG') ? 'HG' : 'HH';
  if (!base.eligible) {
    return { eligible: false, reason: base.reason, binFacility };
  }
  if (isAlreadyInBooth(item)) {
    return {
      eligible: false,
      reason: 'Pull this item off the booth shelf into HG or HH Online Ready Bin before queueing it online.',
      binFacility,
    };
  }
  return { eligible: true, binFacility };
}

export function buildListingPacket(
  item: any,
  platform: ListingAssistPlatform
): { ok: true; packet: OnlineListingPacket } | { ok: false; error: string } {
  const check = checkListingAssistEligibility(item);
  if (!check.eligible) {
    return { ok: false, error: check.reason || 'This item is not ready to list online yet.' };
  }

  const limits = LISTING_PLATFORM_LIMITS[platform];
  const rawTitle = stripUnsafeAndMarkdown(item?.title || item?.identity || 'Curated Vintage Find');
  const title = truncateWordSafe(rawTitle || 'Curated Vintage Find', limits.maxTitleChars);

  const keywords: string[] = Array.isArray(item?.keywords)
    ? item.keywords
        .map((k: unknown) => stripUnsafeAndMarkdown(k).slice(0, 36))
        .filter(Boolean)
        .slice(0, 15)
    : [];

  const hashtags = buildHashtags(keywords, limits.maxHashtags);
  const condition = stripUnsafeAndMarkdown(item?.condition || 'Pre-owned - Very Good').slice(0, 60);

  const marketDesc = stripUnsafeAndMarkdown(item?.marketDescription);
  const condNotes = stripUnsafeAndMarkdown(item?.conditionNotes);
  let body = marketDesc || condNotes || title;
  if (marketDesc && condNotes && !marketDesc.toLowerCase().includes(condNotes.toLowerCase().slice(0, 40))) {
    body = `${marketDesc}\n\nCondition Notes: ${condNotes}`;
  }

  const sku = String(item?.upc || item?.sku || '').trim().toUpperCase().slice(0, 48);
  const footerParts: string[] = [];
  if (platform === 'depop') {
    if (!body.toLowerCase().startsWith(title.toLowerCase().slice(0, 24))) {
      body = `${title}\n\n${body}`;
    }
    if (hashtags.length > 0) {
      footerParts.push(hashtags.join(' '));
    }
  }
  if (sku && (platform === 'poshmark' || platform === 'depop' || platform === 'whatnot')) {
    footerParts.push(`SKU: ${sku}`);
  }

  const footer = footerParts.length > 0 ? `\n\n${footerParts.join('\n')}` : '';
  const maxBodyLen = Math.max(80, limits.maxDescriptionChars - footer.length);
  const description = (body.length > maxBodyLen ? truncateWordSafe(body, maxBodyLen) : body) + footer;

  // Allowlist price resolution: resalePrice / listPrice / estValue only (NEVER item.cost)
  const rawPrice = item?.resalePrice ?? item?.listPrice ?? item?.estValue ?? 0;
  const priceDollars = Math.max(0, parsePriceValue(rawPrice));
  const priceCents = Math.round(priceDollars * 100);
  const priceFormatted = priceCents > 0 ? (priceCents / 100).toFixed(2) : '';

  const photoFileIds: string[] = [];
  const pushImg = (raw: unknown) => {
    const id = cleanFileId(raw);
    if (id && !photoFileIds.includes(id) && photoFileIds.length < limits.maxPhotos) {
      photoFileIds.push(id);
    }
  };
  pushImg(item?.imageId);
  if (Array.isArray(item?.galleryImageIds)) {
    item.galleryImageIds.forEach(pushImg);
  }

  return {
    ok: true,
    packet: {
      itemId: String(item?.$id || '').trim().slice(0, 64),
      platform,
      platformLabel: limits.label,
      createListingUrl: limits.createListingUrl,
      title,
      description: description.slice(0, limits.maxDescriptionChars),
      priceCents,
      priceFormatted,
      sku,
      condition,
      keywords,
      hashtags,
      photoFileIds,
      binFacility: check.binFacility,
      feeSummary: limits.feeSummary,
    },
  };
}

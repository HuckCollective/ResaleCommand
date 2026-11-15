import {
  Client as NodeClient,
  ID as NodeID,
  Permission as NodePermission,
  Role as NodeRole,
  Storage as NodeStorage,
} from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import { getBucketId } from './appwriteEnv';
import { parsePacificDateToIso } from './dateTimeUtils';

export type OnlineDomainFamily =
  | 'shopgoodwill'
  | 'buyers_premium_auction'
  | 'local_cash'
  | 'fixed_online'
  | 'generic';

export type OnlineListingMode =
  | 'auction'
  | 'soft_close_auction'
  | 'local_cash'
  | 'fixed_online';

export interface OnlineShippingQuote {
  shipping: number;
  handling: number;
  total: number;
  carrier: string;
  zipCode?: string;
  weight?: number;
  sellerId?: string | number | null;
  sellerName?: string | null;
  canCombineShipping?: boolean;
  isEstimated?: boolean;
  isLocalPickupOnly?: boolean;
  message?: string;
}

export interface ClientDomListingPayload {
  sourceUrl?: string;
  platformName?: string;
  domainFamily?: OnlineDomainFamily;
  listingMode?: OnlineListingMode;
  externalItemId?: string | null;
  title?: string;
  description?: string;
  currentPrice?: number | string;
  buyersPremiumPct?: number | string;
  shippingCost?: number | string | null;
  isLocalPickupOnly?: boolean;
  isAuction?: boolean;
  isSoftClose?: boolean;
  termsText?: string;
  sellerName?: string | null;
  sellerId?: string | number | null;
  locationText?: string | null;
  shippingWeight?: number | string;
  canCombineShipping?: boolean;
  endingDate?: string | null;
  bidCount?: number | null;
  imageUrls?: string[];
}

export interface OnlineListingEnvelope {
  sourceUrl: string;
  domainFamily: OnlineDomainFamily;
  platformName: string;
  externalItemId: string | null;
  listingMode: OnlineListingMode;
  isAuction: boolean;
  isSoftClose: boolean;
  title: string;
  description: string;
  currentPrice: number;
  askingPriceFormatted: string;
  bidCount: number | null;
  endTimeIso: string | null;
  timeLeftText: string | null;
  buyersPremiumPct: number;
  isLocalPickupOnly: boolean;
  termsText: string;
  sellerName: string | null;
  sellerId: string | number | null;
  locationText: string | null;
  shippingWeight: number;
  canCombineShipping: boolean;
  shippingQuote: OnlineShippingQuote | null;
  imageUrls: string[];
  authoritativeGallery: boolean;
  contextBlock: string;
  rawVendorData?: any;
}

export interface DomainAdjustedBidResult {
  maxHammerBid: number;
  proxySniperBid: number;
  effectiveLandedAtMaxBid: number;
  buyersPremiumPct: number;
  buyersPremiumDollars: number;
  allowProxySniperCents: boolean;
  isSoftClose: boolean;
  listingMode: OnlineListingMode;
  actionLabel: string;
  targetCashOfferLow: number | null;
  targetCashOfferHigh: number | null;
}

export interface ArchivedGalleryResult {
  imageId: string | null;
  galleryImageIds: string[];
  uploadedCount: number;
  failedCount: number;
  fallbackExternalUrl: string | null;
}

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function parseNumericPrice(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? raw : 0;
  if (!raw) return 0;
  const str = String(raw).trim();
  const dollarMatch = str.match(/\$([0-9,]+(?:\.[0-9]{1,2})?)/);
  if (dollarMatch && dollarMatch[1]) {
    return parseFloat(dollarMatch[1].replace(/,/g, '')) || 0;
  }
  const bareMatch = str.match(/([0-9,]+(?:\.[0-9]{1,2})?)/);
  if (bareMatch && bareMatch[1]) {
    return parseFloat(bareMatch[1].replace(/,/g, '')) || 0;
  }
  return 0;
}

function fixRemoteUrl(u: string): string {
  if (!u) return '';
  const cleaned = u.trim().replace(/&amp;/g, '&').replace(/\\/g, '/');
  if (cleaned.startsWith('//')) return `https:${cleaned}`;
  return /^https?:\/\//i.test(cleaned) ? cleaned : '';
}

function upgradeEbayImageHiRes(url: string): string {
  if (!url.includes('i.ebayimg.com')) return url;
  return url.replace(/\/s-l\d+\.(jpg|jpeg|png|webp)/i, '/s-l1600.$1');
}

function hashShortSlug(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/**
 * Strips copyright boilerplate and store return policies that can trigger Gemini RECITATION blocks.
 */
export function sanitizeListingDescription(rawHtml: string): string {
  if (!rawHtml) return '';
  let text = rawHtml.replace(/<[^>]*>?/gm, ' ');
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const filteredLines = lines.filter((line) => {
    const lower = line.toLowerCase();
    if (
      lower.includes('all rights reserved') ||
      lower.includes('copyright') ||
      lower.includes('©') ||
      lower.includes('(c) 19') ||
      lower.includes('(c) 20') ||
      lower.includes('trademark') ||
      lower.includes('tm &')
    ) {
      return false;
    }
    if (
      lower.includes('shipping & handling policy') ||
      lower.includes('return policy') ||
      lower.includes('seller warranty') ||
      lower.includes('terms of purchase')
    ) {
      return false;
    }
    return true;
  });
  return filteredLines.join('\n').substring(0, 1200);
}

/**
 * Deterministic domain family, listing mode, default Buyer's Premium %, and external item ID extractor.
 */
export function detectDomainFromUrl(rawUrl: string): {
  domainFamily: OnlineDomainFamily;
  platformName: string;
  listingMode: OnlineListingMode;
  defaultBuyersPremiumPct: number;
  externalItemId: string | null;
  sgwNumericId: string | null;
} {
  const url = String(rawUrl || '').trim();
  const lower = url.toLowerCase();

  const sgwMatch = url.match(/shopgoodwill\.com\/(?:item|viewitem)\/(\d+)/i);
  if (sgwMatch || lower.includes('shopgoodwill.com')) {
    const numId = sgwMatch ? sgwMatch[1] : null;
    return {
      domainFamily: 'shopgoodwill',
      platformName: 'ShopGoodwill',
      listingMode: 'auction',
      defaultBuyersPremiumPct: 0,
      externalItemId: numId,
      sgwNumericId: numId,
    };
  }

  if (lower.includes('hibid.com')) {
    const lotMatch = url.match(/\/lot\/(\d+)/i) || url.match(/lot-([0-9]+)/i);
    return {
      domainFamily: 'buyers_premium_auction',
      platformName: 'HiBid',
      listingMode: 'soft_close_auction',
      defaultBuyersPremiumPct: 15,
      externalItemId: lotMatch ? `hibid:${lotMatch[1]}` : `hibid:${hashShortSlug(url)}`,
      sgwNumericId: null,
    };
  }

  if (lower.includes('ctbids.com')) {
    const itemMatch = url.match(/\/item\/(\d+)/i) || url.match(/\/([0-9]{5,12})(?:[/?#]|$)/);
    return {
      domainFamily: 'buyers_premium_auction',
      platformName: 'CTBids',
      listingMode: 'soft_close_auction',
      defaultBuyersPremiumPct: 15,
      externalItemId: itemMatch ? `ctbids:${itemMatch[1]}` : `ctbids:${hashShortSlug(url)}`,
      sgwNumericId: null,
    };
  }

  if (lower.includes('liveauctioneers.com') || lower.includes('proxibid.com') || lower.includes('maxsold.com')) {
    const platformName = lower.includes('liveauctioneers')
      ? 'LiveAuctioneers'
      : lower.includes('proxibid')
        ? 'Proxibid'
        : 'MaxSold';
    const defaultBp = lower.includes('liveauctioneers') ? 20 : 15;
    const idMatch = url.match(/(\d{5,12})/);
    const prefix = platformName.toLowerCase();
    return {
      domainFamily: 'buyers_premium_auction',
      platformName,
      listingMode: 'soft_close_auction',
      defaultBuyersPremiumPct: defaultBp,
      externalItemId: idMatch ? `${prefix}:${idMatch[1]}` : `${prefix}:${hashShortSlug(url)}`,
      sgwNumericId: null,
    };
  }

  if (lower.includes('estatesales.net')) {
    const isOnlineAuction = /\/marketplace\/|\/instant-purchase\/|auction/i.test(url);
    const idMatch = url.match(/\/(\d{5,12})(?:[/?#]|$)/);
    return {
      domainFamily: isOnlineAuction ? 'buyers_premium_auction' : 'local_cash',
      platformName: 'EstateSales.net',
      listingMode: isOnlineAuction ? 'soft_close_auction' : 'local_cash',
      defaultBuyersPremiumPct: isOnlineAuction ? 15 : 0,
      externalItemId: idMatch ? `estate:${idMatch[1]}` : `estate:${hashShortSlug(url)}`,
      sgwNumericId: null,
    };
  }

  if (
    lower.includes('facebook.com/marketplace') ||
    lower.includes('craigslist.org') ||
    lower.includes('offerup.com') ||
    lower.includes('nextdoor.com')
  ) {
    const platformName = lower.includes('facebook.com')
      ? 'Facebook Marketplace'
      : lower.includes('craigslist')
        ? 'Craigslist'
        : lower.includes('offerup')
          ? 'OfferUp'
          : 'Nextdoor';
    const fbmMatch =
      url.match(/\/item\/(\d+)/i) ||
      url.match(/\/(\d{8,20})(?:[/?#]|$)/);
    const slugPrefix = lower.includes('facebook.com')
      ? 'fbm'
      : lower.includes('craigslist')
        ? 'cl'
        : 'local';
    return {
      domainFamily: 'local_cash',
      platformName,
      listingMode: 'local_cash',
      defaultBuyersPremiumPct: 0,
      externalItemId: fbmMatch ? `${slugPrefix}:${fbmMatch[1]}` : `${slugPrefix}:${hashShortSlug(url)}`,
      sgwNumericId: null,
    };
  }

  if (/ebay\.(com|io|ca|co\.uk|com\.au|de|fr|it|es)/i.test(lower)) {
    const itmMatch = url.match(/\/itm\/(?:[^/]+\/)?(\d{9,15})/i) || url.match(/item=(\d{9,15})/i);
    return {
      domainFamily: 'fixed_online',
      platformName: 'eBay',
      listingMode: 'fixed_online',
      defaultBuyersPremiumPct: 0,
      externalItemId: itmMatch ? `ebay:${itmMatch[1]}` : `ebay:${hashShortSlug(url)}`,
      sgwNumericId: null,
    };
  }

  if (lower.includes('poshmark.com') || lower.includes('mercari.com') || lower.includes('depop.com') || lower.includes('etsy.com')) {
    const platformName = lower.includes('poshmark')
      ? 'Poshmark'
      : lower.includes('mercari')
        ? 'Mercari'
        : lower.includes('depop')
          ? 'Depop'
          : 'Etsy';
    const idMatch = url.match(/\/([a-z0-9]{8,28})(?:[/?#]|$)/i);
    const prefix = platformName.toLowerCase();
    return {
      domainFamily: 'fixed_online',
      platformName,
      listingMode: 'fixed_online',
      defaultBuyersPremiumPct: 0,
      externalItemId: idMatch ? `${prefix}:${idMatch[1]}` : `${prefix}:${hashShortSlug(url)}`,
      sgwNumericId: null,
    };
  }

  return {
    domainFamily: 'generic',
    platformName: 'Online Listing',
    listingMode: 'fixed_online',
    defaultBuyersPremiumPct: 0,
    externalItemId: url ? `web:${hashShortSlug(url)}` : null,
    sgwNumericId: null,
  };
}

function buildContextBlockFromEnvelope(env: Omit<OnlineListingEnvelope, 'contextBlock'>): string {
  const lines: string[] = [`[Deep Parse - ${env.platformName}]`];
  if (env.title) lines.push(`Title: ${env.title}`);
  if (env.sellerName) {
    lines.push(`Seller: ${env.sellerName}${env.sellerId ? ` (ID: ${env.sellerId})` : ''}`);
  }
  if (env.locationText) lines.push(`Location: ${env.locationText}`);
  if (env.currentPrice > 0) {
    const label = env.isAuction ? 'Current Bid' : 'Asking Price';
    lines.push(`${label}: $${env.currentPrice.toFixed(2)}${env.bidCount != null ? ` | Bids: ${env.bidCount}` : ''}`);
  }
  if (env.buyersPremiumPct > 0) {
    lines.push(`Buyer's Premium: ${env.buyersPremiumPct}% (Added on top of hammer bid!${env.isSoftClose ? ' Soft-close auction.' : ''})`);
  }
  if (env.termsText) lines.push(`Fulfillment Terms: ${env.termsText}`);
  if (env.timeLeftText) lines.push(`Ends / Time Left: ${env.timeLeftText}`);
  if (env.shippingWeight > 0 && env.domainFamily === 'shopgoodwill') {
    lines.push(
      `Weight: ${env.shippingWeight} lbs | Combined Shipping: ${env.canCombineShipping ? 'Eligible' : 'Ineligible'}`
    );
  }
  if (env.shippingQuote) {
    if (env.shippingQuote.isLocalPickupOnly) {
      lines.push(`Shipping: Local Pickup Only ($0 carrier shipping — verify drive radius & pickup window)`);
    } else {
      lines.push(
        `Estimated Shipping: $${env.shippingQuote.total.toFixed(2)} (${env.shippingQuote.carrier}) to ZIP ${env.shippingQuote.zipCode || '97206'}`
      );
    }
  }
  if (env.description) {
    lines.push(`Description: ${env.description}`);
  }
  return lines.join('\n');
}

/**
 * <= 80-token (<= 320-char) deterministic Domain Acquisition Lens.
 * Keeps 1 unified Speed Scout JSON schema while giving Gemini sharp venue risk & fee awareness.
 */
export function buildDomainAcquisitionLens(envelope: OnlineListingEnvelope | null | undefined): string {
  if (!envelope) return '';
  let lens = '';

  switch (envelope.domainFamily) {
    case 'shopgoodwill':
      lens =
        '[Sourcing Lens — ShopGoodwill]: 0% buyer premium, untested donated goods ("as-is"), high dimensional S&H + handling. Verify completeness strictly from visible photos; penalize untested electronics or heavy low-margin bulk.';
      break;
    case 'buyers_premium_auction': {
      const bp = envelope.buyersPremiumPct || 15;
      const pickupWarn = envelope.isLocalPickupOnly
        ? ' LOCAL PICKUP ONLY—flag narrow pickup window/forfeiture risk.'
        : '';
      lens = `[Sourcing Lens — ${envelope.platformName} (${bp}% BP)]: Soft-close estate auction where ${bp}% buyer's premium stacks onto hammer bid.${pickupWarn} Watch mixed box-lot filler and disclosed flaws.`;
      break;
    }
    case 'local_cash':
      lens = `[Sourcing Lens — ${envelope.platformName} (Local Cash)]: $0 shipping, 0% buyer fee, local cash pickup. Suggest a polite Target Cash Offer (65%-80% of ask) when negotiating; flag stock photos or missing proof shots.`;
      break;
    case 'fixed_online':
      if (envelope.isAuction) {
        lens = `[Sourcing Lens — ${envelope.platformName} Auction (0% OR Sales Tax)]: Hard-close online auction. Factor inbound shipping into landed cost; only chase if spread beats physical booth net.`;
      } else {
        lens = `[Sourcing Lens — ${envelope.platformName} Arbitrage (0% OR Sales Tax)]: Fixed-price / Make-Offer sourcing. Only recommend BUY_NOW or NEGOTIATE when underpriced/poorly titled online vs physical booth retail.`;
      }
      break;
    default:
      if (envelope.isAuction) {
        lens = `[Sourcing Lens — Online Auction]: Factor inbound shipping${envelope.buyersPremiumPct > 0 ? ` and ${envelope.buyersPremiumPct}% buyer's premium` : ''} into max bid ceiling.`;
      }
      break;
  }

  if (lens.length <= 320) return lens;
  const slice = lens.slice(0, 317);
  const lastPeriod = slice.lastIndexOf('.');
  return lastPeriod > 120 ? slice.slice(0, lastPeriod + 1) : `${slice}...`;
}

/**
 * Exact Buyer's Premium, Shipping & Local Cash Offer calculator.
 * Eliminates the 15%-20% overbid bug on HiBid / CTBids / LiveAuctioneers:
 *   MaxHammerBid = Math.floor((targetLandedCost - effectiveShip) / (1 + BP% / 100))
 */
export function computeDomainAdjustedMaxBid(params: {
  targetLandedCost: number;
  shippingTotal?: number;
  buyersPremiumPct?: number;
  listingMode?: OnlineListingMode;
  isAuction?: boolean;
  isSoftClose?: boolean;
  currentAskingPrice?: number;
}): DomainAdjustedBidResult {
  const targetLanded = Math.max(0, Number(params.targetLandedCost || 0));
  const listingMode: OnlineListingMode =
    params.listingMode ||
    (params.isSoftClose || Number(params.buyersPremiumPct || 0) > 0
      ? 'soft_close_auction'
      : params.isAuction
        ? 'auction'
        : 'fixed_online');

  const isLocalCash = listingMode === 'local_cash';
  const ship = isLocalCash ? 0 : Math.max(0, Number(params.shippingTotal || 0));
  const bpPct = isLocalCash ? 0 : Math.max(0, Math.min(40, Number(params.buyersPremiumPct || 0)));
  const isSoftClose = Boolean(params.isSoftClose || listingMode === 'soft_close_auction' || bpPct > 0);
  const isAuction = Boolean(params.isAuction || listingMode === 'auction' || listingMode === 'soft_close_auction');

  const bpMultiplier = 1 + bpPct / 100;
  const netAvailableForHammer = Math.max(0, targetLanded - ship);

  let maxHammerBid = 0;
  if (isAuction) {
    maxHammerBid = Math.max(0, Math.floor(netAvailableForHammer / bpMultiplier));
  } else {
    maxHammerBid = Math.max(0, Math.round((netAvailableForHammer / bpMultiplier) * 100) / 100);
  }

  const allowProxySniperCents = isAuction && !isSoftClose && bpPct === 0;
  const proxySniperBid =
    allowProxySniperCents && maxHammerBid > 0
      ? Number((maxHammerBid + 0.87).toFixed(2))
      : maxHammerBid;

  const buyersPremiumDollars =
    bpPct > 0 ? Number(((maxHammerBid * bpPct) / 100).toFixed(2)) : 0;
  const effectiveLandedAtMaxBid = Number(
    (maxHammerBid + buyersPremiumDollars + ship).toFixed(2)
  );

  let targetCashOfferLow: number | null = null;
  let targetCashOfferHigh: number | null = null;
  if (isLocalCash && maxHammerBid > 0) {
    const ask = Math.max(0, Number(params.currentAskingPrice || 0));
    if (ask > 0) {
      targetCashOfferHigh = Math.max(5, Math.round(Math.min(maxHammerBid, ask * 0.8)));
      targetCashOfferLow = Math.max(5, Math.round(Math.min(targetCashOfferHigh, ask * 0.65)));
    } else {
      targetCashOfferHigh = Math.round(maxHammerBid);
      targetCashOfferLow = Math.max(5, Math.round(maxHammerBid * 0.8));
    }
  }

  const actionLabel = isLocalCash
    ? 'Target Cash Offer'
    : bpPct > 0
      ? `Max Hammer Bid (+${bpPct}% BP)`
      : isAuction
        ? 'Max Proxy Bid'
        : 'Max Buy / Offer Price';

  return {
    maxHammerBid,
    proxySniperBid,
    effectiveLandedAtMaxBid,
    buyersPremiumPct: bpPct,
    buyersPremiumDollars,
    allowProxySniperCents,
    isSoftClose,
    listingMode,
    actionLabel,
    targetCashOfferLow,
    targetCashOfferHigh,
  };
}

/**
 * Normalizes a live browser DOM snapshot sent by the bookmarklet into a verified OnlineListingEnvelope.
 */
export function mergeClientDomListing(
  rawUrl: string,
  clientDom: ClientDomListingPayload
): OnlineListingEnvelope {
  const url = String(clientDom.sourceUrl || rawUrl || '').trim();
  const detected = detectDomainFromUrl(url);

  const domainFamily = clientDom.domainFamily || detected.domainFamily;
  const platformName = clientDom.platformName || detected.platformName;
  const bpParsed =
    clientDom.buyersPremiumPct !== undefined && clientDom.buyersPremiumPct !== null && clientDom.buyersPremiumPct !== ''
      ? Math.max(0, Math.min(40, parseFloat(String(clientDom.buyersPremiumPct).replace(/[^0-9.]/g, '')) || 0))
      : detected.defaultBuyersPremiumPct;

  const isAuction =
    clientDom.isAuction !== undefined
      ? Boolean(clientDom.isAuction)
      : detected.listingMode === 'auction' || detected.listingMode === 'soft_close_auction';

  const isSoftClose =
    clientDom.isSoftClose !== undefined
      ? Boolean(clientDom.isSoftClose)
      : detected.listingMode === 'soft_close_auction' || bpParsed > 0;

  const listingMode: OnlineListingMode =
    clientDom.listingMode ||
    (domainFamily === 'local_cash'
      ? 'local_cash'
      : isSoftClose
        ? 'soft_close_auction'
        : isAuction
          ? 'auction'
          : 'fixed_online');

  const isLocalPickupOnly = Boolean(
    clientDom.isLocalPickupOnly ||
      domainFamily === 'local_cash' ||
      /local\s*pick\s*-?\s*up\s*only|no\s*shipping/i.test(String(clientDom.termsText || ''))
  );

  const currentPrice = parseNumericPrice(clientDom.currentPrice);
  const shippingWeight = Math.max(0, parseFloat(String(clientDom.shippingWeight || 0)) || 0);
  const canCombineShipping =
    clientDom.canCombineShipping !== undefined ? Boolean(clientDom.canCombineShipping) : domainFamily === 'shopgoodwill';

  let shippingQuote: OnlineShippingQuote | null = null;
  if (isLocalPickupOnly) {
    shippingQuote = {
      shipping: 0,
      handling: 0,
      total: 0,
      carrier: 'Local Pickup',
      zipCode: 'Local',
      isLocalPickupOnly: true,
      message: 'Local Pickup Only ($0 carrier shipping)',
    };
  } else if (clientDom.shippingCost !== undefined && clientDom.shippingCost !== null && clientDom.shippingCost !== '') {
    const rawShipStr = String(clientDom.shippingCost).trim();
    if (/free/i.test(rawShipStr)) {
      shippingQuote = {
        shipping: 0,
        handling: 0,
        total: 0,
        carrier: `${platformName} Shipping`,
        message: 'Free Shipping',
      };
    } else {
      const shipAmt = parseNumericPrice(rawShipStr);
      shippingQuote = {
        shipping: shipAmt,
        handling: 0,
        total: shipAmt,
        carrier: `${platformName} Shipping`,
        message: rawShipStr,
      };
    }
  }

  const cleanImages: string[] = [];
  const seen = new Set<string>();
  for (const rawImg of clientDom.imageUrls || []) {
    const fixed = upgradeEbayImageHiRes(fixRemoteUrl(rawImg));
    if (fixed && !seen.has(fixed)) {
      seen.add(fixed);
      cleanImages.push(fixed);
    }
  }

  const endingRaw = clientDom.endingDate ? String(clientDom.endingDate).trim() : null;
  const endTimeIso = endingRaw ? parsePacificDateToIso(endingRaw) || null : null;
  const description = sanitizeListingDescription(String(clientDom.description || ''));

  const baseEnv: Omit<OnlineListingEnvelope, 'contextBlock'> = {
    sourceUrl: url,
    domainFamily,
    platformName,
    externalItemId: clientDom.externalItemId || detected.externalItemId,
    listingMode,
    isAuction,
    isSoftClose,
    title: String(clientDom.title || '').trim(),
    description,
    currentPrice,
    askingPriceFormatted: currentPrice > 0 ? `$${currentPrice.toFixed(2)}` : '',
    bidCount: clientDom.bidCount != null ? Number(clientDom.bidCount) : null,
    endTimeIso,
    timeLeftText: endingRaw,
    buyersPremiumPct: bpParsed,
    isLocalPickupOnly,
    termsText: String(
      clientDom.termsText ||
        (isLocalPickupOnly ? 'Local Pickup Only' : shippingQuote ? shippingQuote.message || '' : '')
    ).trim(),
    sellerName: clientDom.sellerName ? String(clientDom.sellerName).trim() : null,
    sellerId: clientDom.sellerId ?? null,
    locationText: clientDom.locationText ? String(clientDom.locationText).trim() : null,
    shippingWeight,
    canCombineShipping,
    shippingQuote,
    imageUrls: cleanImages.slice(0, 24),
    authoritativeGallery: false,
  };

  return {
    ...baseEnv,
    contextBlock: buildContextBlockFromEnvelope(baseEnv),
  };
}

/**
 * Extracts listing metadata & up to 24 high-res gallery images from server-fetched HTML.
 */
export function parseHtmlForOnlineListing(url: string, html: string): OnlineListingEnvelope {
  const detected = detectDomainFromUrl(url);
  const ogTitleMatch =
    html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const rawTitle = (ogTitleMatch ? ogTitleMatch[1] : titleTagMatch ? titleTagMatch[1] : '')
    .replace(/\s*\|\s*(?:eBay|CTBids|HiBid|ShopGoodwill\.com|Poshmark|Mercari).*$/i, '')
    .trim();

  const descMatch =
    html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  let description = sanitizeListingDescription(descMatch ? descMatch[1] : '');

  let title = rawTitle;
  let currentPrice = 0;
  let locationText: string | null = null;
  let buyersPremiumPct = detected.defaultBuyersPremiumPct;
  let isAuction = detected.listingMode === 'auction' || detected.listingMode === 'soft_close_auction';
  let isSoftClose = detected.listingMode === 'soft_close_auction';
  let isLocalPickupOnly = detected.domainFamily === 'local_cash';
  let termsText = '';
  let timeLeftText: string | null = null;
  let shippingQuote: OnlineShippingQuote | null = null;

  // Extract JSON-LD Product / Offer metadata when present
  const ldRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const ldImages: string[] = [];
  let ldMatch: RegExpExecArray | null;
  while ((ldMatch = ldRegex.exec(html)) !== null) {
    const rawJson = ldMatch[1].trim();
    try {
      const parsed = JSON.parse(rawJson);
      const nodes = Array.isArray(parsed) ? parsed : parsed?.['@graph'] || [parsed];
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue;
        if (!title && node.name && typeof node.name === 'string') title = node.name.trim();
        if (!description && node.description && typeof node.description === 'string') {
          description = sanitizeListingDescription(node.description);
        }
        const imgs = Array.isArray(node.image) ? node.image : node.image ? [node.image] : [];
        for (const im of imgs) {
          const u = typeof im === 'string' ? im : im?.url || im?.contentUrl || '';
          if (u) ldImages.push(u);
        }
        const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
        if (offer && currentPrice <= 0) {
          currentPrice = parseNumericPrice(offer.price ?? offer.lowPrice ?? offer.highPrice);
        }
      }
    } catch {
      // Keep raw snippet fallback below if JSON-LD has unescaped newlines
    }
  }

  if (detected.platformName === 'Facebook Marketplace' && rawTitle.includes(' - ')) {
    const parts = rawTitle.split(' - ');
    title = parts[0].trim();
    for (const part of parts.slice(1)) {
      if (part.trim().startsWith('$') && currentPrice <= 0) {
        currentPrice = parseNumericPrice(part);
      } else if (!locationText) {
        locationText = part.trim();
      }
    }
  }

  if (currentPrice <= 0) {
    const priceMatch =
      html.match(/itemprop=["']price["']\s+content=["']([^"']+)["']/i) ||
      html.match(/property=["']product:price:amount["']\s+content=["']([^"']+)["']/i) ||
      html.match(/(?:internet\s*bid|current\s*bid|lead\s*bid|starting\s*bid)\s*:?\s*\$([0-9,.]+)/i) ||
      html.match(/"price"\s*:\s*"?([0-9]+(?:\.[0-9]{1,2})?)"?/i);
    if (priceMatch && priceMatch[1]) {
      currentPrice = parseNumericPrice(priceMatch[1]);
    }
  }

  if (detected.platformName === 'eBay') {
    if (/place\s+bid|x-bid-info|"bidCount"\s*:/i.test(html)) {
      isAuction = true;
    }
    const shipMatch =
      html.match(/id=["']shipCost["'][^>]*>\s*([^<]+)/i) ||
      html.match(/Shipping:[\s\S]{0,180}?ux-textspans--bold["']>\s*([^<]+)/i);
    if (shipMatch && shipMatch[1]) {
      const rawShip = shipMatch[1].replace(/<[^>]*>/g, '').trim();
      if (/free/i.test(rawShip)) {
        shippingQuote = { shipping: 0, handling: 0, total: 0, carrier: 'eBay Shipping', message: 'Free Shipping' };
      } else {
        const amt = parseNumericPrice(rawShip);
        if (amt > 0) {
          shippingQuote = { shipping: amt, handling: 0, total: amt, carrier: 'eBay Shipping', message: rawShip };
        }
      }
    }
  }

  if (detected.domainFamily === 'buyers_premium_auction') {
    const bpMatch =
      html.match(/buyer'?s?\s*premium\s*:?\s*(\d{1,2}(?:\.\d+)?)%/i) ||
      html.match(/(\d{1,2}(?:\.\d+)?)%\s*buyer'?s?\s*premium/i);
    if (bpMatch && bpMatch[1]) {
      buyersPremiumPct = Math.min(40, parseFloat(bpMatch[1]) || detected.defaultBuyersPremiumPct);
    }
    if (/local\s*pick\s*-?\s*up\s*only|no\s*shipping/i.test(html)) {
      isLocalPickupOnly = true;
      termsText = 'Local Pickup Only';
      shippingQuote = {
        shipping: 0,
        handling: 0,
        total: 0,
        carrier: 'Local Pickup',
        isLocalPickupOnly: true,
        message: 'Local Pickup Only',
      };
    } else if (/shipping\s*available/i.test(html)) {
      termsText = 'Shipping Available';
    }
    const timeMatch =
      html.match(/(?:time\s*remaining|bidding\s*closes|closing\s*in|ends)\s*:?\s*([^<\n\r]{3,60})/i) ||
      html.match(/class=["'][^"']*(?:countdown|timer|time-left)[^"']*["'][^>]*>([^<]+)/i);
    if (timeMatch && timeMatch[1]) {
      timeLeftText = timeMatch[1].replace(/<[^>]*>/g, '').trim();
    }
  }

  const imageSet = new Set<string>();
  const addCandidateImg = (rawSrc: string) => {
    const fixed = upgradeEbayImageHiRes(fixRemoteUrl(rawSrc));
    if (!fixed) return;
    if (/logo|icon|avatar|sprite|badge|pixel|analytics|doubleclick/i.test(fixed)) return;
    imageSet.add(fixed);
  };

  const ogImg =
    html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (ogImg && ogImg[1]) addCandidateImg(ogImg[1]);
  ldImages.forEach(addCandidateImg);

  const imgRegex = /<img[^>]+src=["'](https?:\/\/[^"'\s]+|\/\/[^"'\s]+)["'][^>]*>/gi;
  let imgMatch: RegExpExecArray | null;
  let scannedCount = 0;
  while ((imgMatch = imgRegex.exec(html)) !== null && scannedCount < 45 && imageSet.size < 24) {
    scannedCount++;
    const src = imgMatch[1];
    if (
      src.includes('i.ebayimg.com') ||
      src.includes('poshmark.com') ||
      src.includes('hibid') ||
      src.includes('ctbids') ||
      src.includes('liveauctioneers') ||
      src.includes('azureedge.net') ||
      src.includes('cloudfront.net') ||
      src.includes('cloudinary.com') ||
      /\.(?:jpg|jpeg|png|webp)(?:\?|&|$)/i.test(src)
    ) {
      addCandidateImg(src);
    }
  }

  const listingMode: OnlineListingMode =
    detected.domainFamily === 'local_cash'
      ? 'local_cash'
      : isSoftClose
        ? 'soft_close_auction'
        : isAuction
          ? 'auction'
          : 'fixed_online';

  const baseEnv: Omit<OnlineListingEnvelope, 'contextBlock'> = {
    sourceUrl: url,
    domainFamily: detected.domainFamily,
    platformName: detected.platformName,
    externalItemId: detected.externalItemId,
    listingMode,
    isAuction,
    isSoftClose,
    title: title || `${detected.platformName} Listing`,
    description,
    currentPrice,
    askingPriceFormatted: currentPrice > 0 ? `$${currentPrice.toFixed(2)}` : '',
    bidCount: null,
    endTimeIso: timeLeftText ? parsePacificDateToIso(timeLeftText) || null : null,
    timeLeftText,
    buyersPremiumPct,
    isLocalPickupOnly,
    termsText,
    sellerName: null,
    sellerId: null,
    locationText,
    shippingWeight: 0,
    canCombineShipping: false,
    shippingQuote,
    imageUrls: Array.from(imageSet).slice(0, 24),
    authoritativeGallery: false,
  };

  return {
    ...baseEnv,
    contextBlock: buildContextBlockFromEnvelope(baseEnv),
  };
}

/**
 * Safely joins ShopGoodwill's `imageServer` with a relative gallery path.
 * Handles: missing/duplicate slashes, Windows backslashes, protocol-relative `//host/...`, and full `https://` URLs.
 */
export function joinSgImageUrl(imgServer: string | null | undefined, rawPath: string | null | undefined): string {
  const clean = String(rawPath || '').trim().replace(/\\/g, '/');
  if (!clean) return '';
  if (/^https?:\/\//i.test(clean)) return clean;
  if (clean.startsWith('//')) return `https:${clean}`;
  const base = String(imgServer || '').trim();
  if (!base) return '';
  const normalizedBase = /^https?:\/\//i.test(base) ? base : base.startsWith('//') ? `https:${base}` : `https://${base.replace(/^\/+/, '')}`;
  return `${normalizedBase.replace(/\/+$/, '')}/${clean.replace(/^\/+/, '')}`;
}

/**
 * Resolves any online listing URL (or client-harvested DOM snapshot) into a canonical OnlineListingEnvelope.
 * Uses ShopGoodwill's official Buyer API + CalculateShipping when on shopgoodwill.com, and merges
 * client-side DOM harvests on eBay / FB Marketplace / HiBid / CTBids so bot-walls never block scouting.
 */
export async function fetchAndResolveOnlineListing(options: {
  url?: string | null;
  zipCode?: string | null;
  clientDomListing?: ClientDomListingPayload | null;
}): Promise<OnlineListingEnvelope | null> {
  let targetUrl = String(options.url || options.clientDomListing?.sourceUrl || '').trim();
  if (!targetUrl && !options.clientDomListing) return null;

  // Resolve eBay short URL redirects (ebay.io)
  if (targetUrl && /ebay\.io/i.test(targetUrl)) {
    try {
      const redirectRes = await fetch(targetUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
      });
      const loc = redirectRes.headers.get('location');
      if (loc) targetUrl = loc;
    } catch {}
  }

  const detected = detectDomainFromUrl(targetUrl);

  // 1. Authoritative ShopGoodwill Buyer API + Live ZIP Shipping Quote
  if (detected.domainFamily === 'shopgoodwill' && detected.sgwNumericId) {
    const itemId = detected.sgwNumericId;
    let parsedData: any = null;
    try {
      const apiRes = await fetch(
        `https://buyerapi.shopgoodwill.com/api/ItemDetail/GetItemDetailModelByItemId/${itemId}`,
        {
          headers: {
            'User-Agent': BROWSER_USER_AGENT,
            Origin: 'https://shopgoodwill.com',
            Referer: 'https://shopgoodwill.com/',
          },
          signal: AbortSignal.timeout(8000),
        }
      );
      if (apiRes.ok) {
        const json = await apiRes.json();
        if (json && (json.title || json.itemName)) {
          parsedData = json;
        }
      }
    } catch (err) {
      console.warn('[onlineSourcingAdapters] SGW ItemDetail API failed:', err);
    }

    if (parsedData) {
      const sellerId = parsedData.sellerId || parsedData.seller_id || null;
      const rawCompany =
        parsedData.sellerCompanyName ||
        parsedData.sellerName ||
        parsedData.seller_name ||
        parsedData.seller?.companyName ||
        '';
      const pickupCity = parsedData.pickupCity || parsedData.sellerCity || '';
      const pickupState = parsedData.pickupState || parsedData.sellerState || '';
      const cityState =
        pickupCity && pickupState ? `${pickupCity}, ${pickupState}` : pickupCity || pickupState || '';
      const cleanCompany = String(rawCompany || '')
        .replace(/^Goodwill\s+Industries\s+of\s+(?:the\s+)?/i, 'Goodwill ')
        .replace(/^Goodwill\s+of\s+(?:the\s+)?/i, 'Goodwill ')
        .replace(/,\s*Inc\.?$/i, '')
        .trim();
      const sellerName = cleanCompany
        ? cityState && !cleanCompany.toLowerCase().includes(String(pickupCity).toLowerCase() || '__none__')
          ? `${cleanCompany} (${cityState})`
          : cleanCompany
        : cityState
          ? `Goodwill — ${cityState}`
          : parsedData.location || 'ShopGoodwill';
      parsedData.sellerName = sellerName;

      const canCombineShipping =
        parsedData.canCombineShipping !== undefined ? Boolean(parsedData.canCombineShipping) : true;
      const shippingWeight =
        parseFloat(parsedData.shippingWeight || parsedData.weight || parsedData.dimensionalWeight || 0) || 0;

      const imgServer = parsedData.imageServer || 'https://shopgoodwillimages.azureedge.net/production/';
      const imgUrls: string[] = [];
      if (parsedData.imageUrlString) {
        String(parsedData.imageUrlString)
          .split(';')
          .forEach((p: string) => {
            const joined = joinSgImageUrl(imgServer, p);
            if (joined && !imgUrls.includes(joined)) imgUrls.push(joined);
          });
      } else if (parsedData.imageURL) {
        const fixed = fixRemoteUrl(parsedData.imageURL);
        if (fixed) imgUrls.push(fixed);
      }
      // Vercel WAF fallback: API answered but gave 0 photos → keep the browser-harvested gallery
      if (imgUrls.length === 0 && options.clientDomListing?.imageUrls?.length) {
        for (const u of options.clientDomListing.imageUrls) {
          const joined = joinSgImageUrl('', u);
          if (joined && !imgUrls.includes(joined)) imgUrls.push(joined);
        }
      }

      let shippingQuote: OnlineShippingQuote | null = null;
      const zip = String(options.zipCode || '').trim();
      if (zip) {
        try {
          const calcRes = await fetch(
            'https://buyerapi.shopgoodwill.com/api/ItemDetail/CalculateShipping',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': BROWSER_USER_AGENT,
                Origin: 'https://shopgoodwill.com',
                Referer: 'https://shopgoodwill.com/',
              },
              body: JSON.stringify({
                itemId: parseInt(itemId, 10),
                country: 'US',
                province: null,
                zipCode: zip,
                quantity: 1,
                clientIP: '0.0.0.3',
              }),
              signal: AbortSignal.timeout(7000),
            }
          );
          if (calcRes.ok) {
            const htmlText = await calcRes.text();
            const shipMatch = htmlText.match(/id=['"]shipping-span['"]>\$([0-9.]+)/i);
            const handMatch = htmlText.match(/Handling:\s*\$([0-9.]+)/i);
            const totalMatch =
              htmlText.match(/Total Shipping and Handling:\s*\$([0-9.]+)/i) ||
              htmlText.match(/Total Shipping and Handling:.*?\$([0-9.]+)/is);
            const carrierMatch = htmlText.match(/Shipping Carrier:\s*([^<]+)/i);
            if (totalMatch) {
              shippingQuote = {
                shipping: shipMatch ? parseFloat(shipMatch[1]) : 0,
                handling: handMatch ? parseFloat(handMatch[1]) : 0,
                total: parseFloat(totalMatch[1]),
                carrier: carrierMatch ? carrierMatch[1].trim() : 'FedEx',
                zipCode: zip,
                weight: shippingWeight,
                sellerId,
                sellerName,
                canCombineShipping,
              };
            }
          }
        } catch (calcErr) {
          console.warn('[onlineSourcingAdapters] SGW CalculateShipping failed:', calcErr);
        }
      }

      const currentPrice = parseFloat(parsedData.currentPrice) || parseFloat(parsedData.minimumBid) || 0;
      const endTimeRaw = parsedData.endTime ? String(parsedData.endTime) : null;
      const endTimeIso = endTimeRaw ? parsePacificDateToIso(endTimeRaw) || null : null;
      const cleanDesc = sanitizeListingDescription(parsedData.description || '');

      const baseEnv: Omit<OnlineListingEnvelope, 'contextBlock'> = {
        sourceUrl: targetUrl,
        domainFamily: 'shopgoodwill',
        platformName: 'ShopGoodwill',
        externalItemId: itemId,
        listingMode: 'auction',
        isAuction: true,
        isSoftClose: false,
        title: String(parsedData.title || parsedData.itemName || `ShopGoodwill #${itemId}`).trim(),
        description: cleanDesc,
        currentPrice,
        askingPriceFormatted: `$${currentPrice.toFixed(2)}`,
        bidCount: parsedData.bidCount != null ? Number(parsedData.bidCount) : null,
        endTimeIso,
        timeLeftText: endTimeRaw,
        buyersPremiumPct: 0,
        isLocalPickupOnly: /pickup\s*only/i.test(String(parsedData.shippingPrice || '')),
        termsText: canCombineShipping ? 'Combined Shipping Eligible' : 'Standard Shipping',
        sellerName,
        sellerId,
        locationText: cityState || null,
        shippingWeight,
        canCombineShipping,
        shippingQuote,
        imageUrls: imgUrls.slice(0, 24),
        authoritativeGallery: imgUrls.length > 0,
        rawVendorData: parsedData,
      };

      return {
        ...baseEnv,
        contextBlock: buildContextBlockFromEnvelope(baseEnv),
      };
    }
  }

  // 2. Client-Side DOM Harvest (Zero bot-walls on eBay, FB Marketplace, HiBid, CTBids, EstateSales.net!)
  if (options.clientDomListing && (options.clientDomListing.title || (options.clientDomListing.imageUrls && options.clientDomListing.imageUrls.length > 0))) {
    return mergeClientDomListing(targetUrl, options.clientDomListing);
  }

  // 3. Server-Side HTML Fetch Fallback (for direct URL paste inside /scout)
  if (!targetUrl) return null;
  try {
    const pageRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (pageRes.ok) {
      const html = await pageRes.text();
      return parseHtmlForOnlineListing(pageRes.url || targetUrl, html);
    }
  } catch (err) {
    console.warn('[onlineSourcingAdapters] Server HTML fetch failed for', targetUrl, err);
  }

  return null;
}

/**
 * Filters user-selected remote gallery URLs against ShopGoodwill's authoritative item gallery
 * so unrelated "YOU MAY ALSO LIKE" sidebar recommendations can never contaminate vision scans,
 * while preserving the user's exact selected close-up/cover photo order (up to maxPhotos = 12).
 */
export function selectVerifiedListingImages(
  selectedUrls: string[],
  envelope: OnlineListingEnvelope | null,
  maxPhotos = 12
): string[] {
  const cleanSelected = (selectedUrls || [])
    .map((u) => upgradeEbayImageHiRes(fixRemoteUrl(u)))
    .filter(Boolean);

  if (envelope && envelope.authoritativeGallery && envelope.imageUrls.length > 0) {
    const officialNorm = new Set(envelope.imageUrls.map((u) => u.toLowerCase()));
    const firstFolderMatch = envelope.imageUrls[0]?.match(/(\/Items\/\d{1,2}-\d{1,2}-\d{4}\/[^/]+\/)/i);
    const officialFolder = firstFolderMatch ? firstFolderMatch[1].toLowerCase() : null;

    if (cleanSelected.length > 0) {
      const verifiedSelected = cleanSelected.filter((u) => {
        const low = u.toLowerCase();
        if (officialNorm.has(low)) return true;
        if (officialFolder && low.includes(officialFolder)) return true;
        return false;
      });
      if (verifiedSelected.length > 0) {
        return verifiedSelected.slice(0, maxPhotos);
      }
    }
    return envelope.imageUrls.slice(0, maxPhotos);
  }

  if (cleanSelected.length > 0) {
    return cleanSelected.slice(0, maxPhotos);
  }

  if (envelope && envelope.imageUrls.length > 0) {
    return envelope.imageUrls.slice(0, maxPhotos);
  }

  return [];
}

/**
 * Durable Serverless Appwrite Storage Multi-Photo Archiver.
 * Downloads up to `maxImages` (default 10) remote listing photos (`<= 6MB` each, `6s` timeout,
 * concurrency = 3) and stores them permanently in the Appwrite item images bucket so tracked
 * online items are 100% immune to 60-day auction CDN link rot and ready for `✂️ Split Lot`!
 */
export async function archiveRemoteImagesToAppwriteStorage(
  imageUrls: string[],
  options?: {
    maxImages?: number;
    concurrency?: number;
    timeoutMs?: number;
    maxBytesPerImage?: number;
  }
): Promise<ArchivedGalleryResult> {
  const maxImages = Math.max(1, Math.min(12, options?.maxImages ?? 10));
  const concurrency = Math.max(1, Math.min(4, options?.concurrency ?? 3));
  const timeoutMs = options?.timeoutMs ?? 6000;
  const maxBytes = options?.maxBytesPerImage ?? 6 * 1024 * 1024;

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const raw of imageUrls || []) {
    const trimmed = String(raw || '').trim();
    if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) continue;
    // Preserve already-uploaded Appwrite file IDs directly
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && /^[a-zA-Z0-9_-]{12,36}$/.test(trimmed)) {
      if (!seen.has(trimmed)) {
        seen.add(trimmed);
        deduped.push(trimmed);
      }
      continue;
    }
    const fixed = upgradeEbayImageHiRes(fixRemoteUrl(trimmed));
    if (fixed && !seen.has(fixed)) {
      seen.add(fixed);
      deduped.push(fixed);
    }
    if (deduped.length >= maxImages) break;
  }

  const fallbackExternalUrl =
    deduped.find((u) => /^https?:\/\//i.test(u)) || null;

  if (deduped.length === 0) {
    return {
      imageId: null,
      galleryImageIds: [],
      uploadedCount: 0,
      failedCount: 0,
      fallbackExternalUrl: null,
    };
  }

  const endpoint =
    (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_APPWRITE_ENDPOINT) ||
    process.env.PUBLIC_APPWRITE_ENDPOINT ||
    'https://sfo.cloud.appwrite.io/v1';
  const project =
    (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_APPWRITE_PROJECT_ID) ||
    process.env.PUBLIC_APPWRITE_PROJECT_ID ||
    '69714b35003a8adab6bb';
  const apiKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.APPWRITE_API_KEY) ||
    process.env.APPWRITE_API_KEY ||
    '';
  const bucketId = getBucketId() || 'item_images';

  if (!apiKey) {
    return {
      imageId: null,
      galleryImageIds: [],
      uploadedCount: 0,
      failedCount: deduped.length,
      fallbackExternalUrl,
    };
  }

  const client = new NodeClient().setEndpoint(endpoint).setProject(project).setKey(apiKey);
  const storage = new NodeStorage(client);
  const filePerms = [
    NodePermission.read(NodeRole.any()),
    NodePermission.update(NodeRole.users()),
    NodePermission.delete(NodeRole.users()),
  ];

  const orderedFileIds: Array<string | null> = new Array(deduped.length).fill(null);
  let uploadedCount = 0;
  let failedCount = 0;
  let cursor = 0;

  const uploadSingleAt = async (idx: number) => {
    const entry = deduped[idx];
    if (!entry) return;

    // Already an Appwrite Storage File ID or Appwrite Storage URL
    if (!entry.startsWith('http://') && !entry.startsWith('https://')) {
      orderedFileIds[idx] = entry;
      return;
    }
    const existingBucketMatch = entry.match(/\/storage\/buckets\/[^/]+\/files\/([a-zA-Z0-9_-]{10,36})\//);
    if (existingBucketMatch && existingBucketMatch[1]) {
      orderedFileIds[idx] = existingBucketMatch[1];
      return;
    }

    try {
      let referer: string | undefined;
      try {
        referer = `${new URL(entry).origin}/`;
      } catch {}

      const headers: Record<string, string> = {
        'User-Agent': BROWSER_USER_AGENT,
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      };
      if (referer) headers.Referer = referer;

      const res = await fetch(entry, {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        failedCount++;
        return;
      }

      const contentLen = Number(res.headers.get('content-length') || 0);
      if (contentLen > maxBytes) {
        failedCount++;
        return;
      }

      const mimeRaw = (res.headers.get('content-type') || 'image/jpeg').toLowerCase();
      if (mimeRaw.includes('text/html') || mimeRaw.includes('application/json')) {
        failedCount++;
        return;
      }

      const ab = await res.arrayBuffer();
      if (ab.byteLength <= 128 || ab.byteLength > maxBytes) {
        failedCount++;
        return;
      }

      const ext = mimeRaw.includes('png')
        ? 'png'
        : mimeRaw.includes('webp')
          ? 'webp'
          : 'jpg';
      const fileName = `scout_${Date.now()}_${idx + 1}.${ext}`;
      const inputFile = InputFile.fromBuffer(Buffer.from(ab), fileName);

      let uploaded: any = null;
      try {
        uploaded = await storage.createFile(bucketId, NodeID.unique(), inputFile, filePerms);
      } catch {
        // Fallback if bucket has file-level security disabled
        uploaded = await storage.createFile(bucketId, NodeID.unique(), inputFile);
      }

      if (uploaded?.$id) {
        orderedFileIds[idx] = uploaded.$id;
        uploadedCount++;
      } else {
        failedCount++;
      }
    } catch {
      failedCount++;
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, deduped.length) }).map(async () => {
    while (cursor < deduped.length) {
      const myIdx = cursor++;
      await uploadSingleAt(myIdx);
    }
  });

  await Promise.all(workers);

  const galleryImageIds = orderedFileIds.filter((id): id is string => Boolean(id));
  return {
    imageId: galleryImageIds[0] || null,
    galleryImageIds,
    uploadedCount,
    failedCount,
    fallbackExternalUrl,
  };
}

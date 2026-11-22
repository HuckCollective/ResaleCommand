/**
 * Public storefront item allowlist (pure TypeScript, zero SDK imports).
 *
 * `/subsite` and `/subsite/item/[id]` are PUBLIC pages. Raw Appwrite item documents carry
 * private business fields (`cost`, `purchasePrice`, `maxBuyPrice`, `purchaseId`, `rawAnalysis`,
 * `tenantId`, `warehouseId`, ...), so every document MUST pass through `toPublicStorefrontItem()`
 * before it is rendered or serialized into a `client:load` component prop.
 *
 * This is an allowlist: a field that is not named here can never reach a shopper, even if a new
 * private attribute is added to the `items` collection later.
 */

export const STOREFRONT_SELLING_TAG = 'storefront';

const TERMINAL_STATUSES = new Set(['sold', 'combined', 'deconstructed', 'archived']);

export interface PublicStorefrontItem {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  title: string;
  identity: string;
  upc: string;
  status: string;
  resalePrice: number;
  marketDescription: string;
  conditionNotes: string;
  keywords: string[];
  components: string;
  imageId: string;
  galleryImageIds: string[];
}

function cleanText(raw: unknown, maxLen: number): string {
  return String(raw ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]+/g, ' ')
    .replace(/data:[a-z0-9+/=-]+;base64,[a-z0-9+/=]+/gi, '')
    .trim()
    .slice(0, maxLen);
}

function cleanFileId(raw: unknown): string {
  const id = String(raw ?? '').trim();
  // Appwrite Storage File IDs only (never URLs or data: strings), <= 255 chars.
  return /^[A-Za-z0-9_][A-Za-z0-9._-]{0,254}$/.test(id) ? id : '';
}

function cleanPrice(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? Number(n.toFixed(2)) : 0;
}

/**
 * `components` is stored as a JSON blob that can carry internal valuation notes.
 * Publish only a readable "name x qty" list; plain-text values pass through trimmed.
 */
export function toPublicComponentsText(raw: unknown): string {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.components) ? parsed.components : [];
      const lines: string[] = [];
      for (const entry of list.slice(0, 40)) {
        if (typeof entry === 'string') {
          const name = cleanText(entry, 120);
          if (name) lines.push(name);
          continue;
        }
        if (!entry || typeof entry !== 'object') continue;
        const name = cleanText(entry.title ?? entry.name ?? entry.item ?? entry.description, 120);
        if (!name) continue;
        const qty = Math.floor(Number(entry.quantity ?? entry.qty ?? 1));
        lines.push(qty > 1 ? `${name} x${qty}` : name);
      }
      return lines.join('\n');
    } catch {
      return '';
    }
  }
  return cleanText(text, 2000);
}

export function hasStorefrontTag(item: any): boolean {
  const list = Array.isArray(item?.sellingLocations)
    ? item.sellingLocations
    : item?.sellingLocations
      ? [item.sellingLocations]
      : [];
  return list.some((entry: unknown) => String(entry ?? '').trim().toLowerCase() === STOREFRONT_SELLING_TAG);
}

/** True only for an item a shopper may see: storefront-tagged and not in a terminal status. */
export function isPubliclyListable(item: any): boolean {
  if (!item || typeof item !== 'object') return false;
  if (!hasStorefrontTag(item)) return false;
  const status = String(item.status ?? '').trim().toLowerCase();
  return !TERMINAL_STATUSES.has(status);
}

export function toPublicStorefrontItem(item: any): PublicStorefrontItem {
  const imageId = cleanFileId(item?.imageId);
  const gallery: string[] = [];
  if (Array.isArray(item?.galleryImageIds)) {
    for (const raw of item.galleryImageIds) {
      const id = cleanFileId(raw);
      if (id && id !== imageId && !gallery.includes(id)) gallery.push(id);
      if (gallery.length >= 8) break;
    }
  }
  const keywords: string[] = Array.isArray(item?.keywords)
    ? item.keywords
        .map((k: unknown) => cleanText(k, 40))
        .filter(Boolean)
        .slice(0, 20)
    : [];

  return {
    $id: cleanText(item?.$id, 64),
    $createdAt: cleanText(item?.$createdAt, 40),
    $updatedAt: cleanText(item?.$updatedAt, 40),
    title: cleanText(item?.title, 255),
    identity: cleanText(item?.identity, 500),
    upc: cleanText(item?.upc, 48),
    status: cleanText(item?.status, 32),
    resalePrice: cleanPrice(item?.resalePrice),
    marketDescription: cleanText(item?.marketDescription, 5000),
    conditionNotes: cleanText(item?.conditionNotes, 2000),
    keywords,
    components: toPublicComponentsText(item?.components),
    imageId,
    galleryImageIds: gallery,
  };
}

/**
 * Canonical Multi-Channel Sales Presets, Event Sanitization & Order Tag Builders (Laws 1, 2, 3 & 7).
 *
 * Pure TypeScript — safe in browser SFCs, SSR endpoints, and verification scripts.
 * Physical booth venue fees ALWAYS resolve dynamically from `src/lib/warehouses.ts` (Law 2);
 * this module owns external marketplace / live-stream / event-checkout presets and
 * guarantees `orderId` / `soNumber` prefixes stay 100% compatible with `isIntentionalNoSku`
 * and `[COST:x.xx]` parsers across `SalesList.vue` and `useLiveDashboardSource.ts`.
 */

export type NonBoothChannelCode = 'ONLINE' | 'EVENT';

export interface OnlineChannelPreset {
  id: 'ebay' | 'poshmark' | 'depop' | 'whatnot' | 'direct_dm';
  label: string;
  shortHint: string;
  feePct: number;
  /** Prefix written to `orderId` & `soNumber` — always starts with `EBAY`, `POSH`, or `ONLINE` for `isIntentionalNoSku`. */
  tag: 'EBAY' | 'POSH' | 'ONLINE-DEPOP' | 'ONLINE-WHATNOT' | 'ONLINE-DM';
}

export interface EventChannelPreset {
  id: 'hosted_card' | 'hosted_cash' | 'partner_card' | 'partner_cash' | 'partner_split';
  eventKind: 'hosted_by_us' | 'partner_event';
  label: string;
  shortHint: string;
  feePct: number;
}

export const ONLINE_MARKETPLACE_PRESETS: readonly OnlineChannelPreset[] = [
  {
    id: 'ebay',
    label: '📦 eBay (MUAA)',
    shortHint: 'Pirate Ship 4×6 label recouped first',
    feePct: 13.6,
    tag: 'EBAY',
  },
  {
    id: 'whatnot',
    label: '📡 Whatnot / District',
    shortHint: 'Live auction & community drops',
    feePct: 11,
    tag: 'ONLINE-WHATNOT',
  },
  {
    id: 'depop',
    label: '👕 Depop',
    shortHint: '0% selling fee • ~3.3% + $0.45 processing',
    feePct: 3.3,
    tag: 'ONLINE-DEPOP',
  },
  {
    id: 'poshmark',
    label: '👗 Poshmark',
    shortHint: 'Prepaid Posh label included',
    feePct: 20,
    tag: 'POSH',
  },
  {
    id: 'direct_dm',
    label: '💬 Direct / Social DM',
    shortHint: 'Instagram / TikTok / invoice checkout',
    feePct: 2.9,
    tag: 'ONLINE-DM',
  },
] as const;

export const EVENT_CHECKOUT_PRESETS: readonly EventChannelPreset[] = [
  {
    id: 'hosted_card',
    eventKind: 'hosted_by_us',
    label: '🎪 Our Event (Card)',
    shortHint: 'Huckleberry pop-up • tap/card processor',
    feePct: 2.9,
  },
  {
    id: 'hosted_cash',
    eventKind: 'hosted_by_us',
    label: '💵 Our Event (Cash)',
    shortHint: 'Huckleberry pop-up • zero fee',
    feePct: 0,
  },
  {
    id: 'partner_card',
    eventKind: 'partner_event',
    label: '🤝 Partner Market (Card)',
    shortHint: 'External market / con • tap/card',
    feePct: 2.9,
  },
  {
    id: 'partner_cash',
    eventKind: 'partner_event',
    label: '🤝 Partner Market (Cash)',
    shortHint: 'External market / con • cash',
    feePct: 0,
  },
  {
    id: 'partner_split',
    eventKind: 'partner_event',
    label: '🤝 Host Split Event',
    shortHint: 'Partner venue / host % split (editable)',
    feePct: 10,
  },
] as const;

/**
 * Strips delimiter characters (`•`, `[`, `]`, control chars) that could collide with
 * `orderId` splitting (`•`) or `[COST:x.xx]` regex parsing, collapses whitespace, and caps at 40 chars.
 */
export function sanitizeEventName(raw: string | null | undefined): string {
  return String(raw ?? '')
    .replace(/[\u0000-\u001F\u007F•\[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}

/**
 * Pure calendar `YYYY-MM-DD` day subtraction without `Date#getMonth()` or timezone conversion (Law 7).
 */
export function subtractCalendarDaysYmd(ymd: string, days: number): string {
  const m = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(String(ymd || '').trim());
  if (!m) return '';
  let year = Number(m[1]);
  let month = Number(m[2]);
  let day = Number(m[3]) - Math.max(0, Math.floor(days));

  const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const daysInMonth = (y: number, mo: number) => {
    if (mo === 2) return isLeap(y) ? 29 : 28;
    return [4, 6, 9, 11].includes(mo) ? 30 : 31;
  };

  while (day <= 0) {
    month -= 1;
    if (month <= 0) {
      month = 12;
      year -= 1;
    }
    day += daysInMonth(year, month);
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Pure calendar `YYYY-MM-DD` day addition without `Date#getMonth()` or timezone conversion (Law 7).
 */
export function addCalendarDaysYmd(ymd: string, days: number): string {
  const m = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(String(ymd || '').trim());
  if (!m) return '';
  let year = Number(m[1]);
  let month = Number(m[2]);
  let day = Number(m[3]) + Math.max(0, Math.floor(days));

  const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const daysInMonth = (y: number, mo: number) => {
    if (mo === 2) return isLeap(y) ? 29 : 28;
    return [4, 6, 9, 11].includes(mo) ? 30 : 31;
  };

  while (day > daysInMonth(year, month)) {
    day -= daysInMonth(year, month);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Includes `live`, `upcoming`, AND recently ended (`past` within `lookbackDays`, default 14) events
 * so members logging weekend market sales on Monday/Tuesday still get 1-tap Event Chips (Law 7 string compare).
 */
export function isRecentOrActiveCheckoutEvent(
  ev: { status?: string; startDate?: string; endDate?: string },
  todayYmd: string,
  lookbackDays = 14
): boolean {
  const status = String(ev?.status || '').toLowerCase();
  if (status === 'live' || status === 'upcoming') return true;
  const refDate = String(ev?.endDate || ev?.startDate || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(refDate)) return false;
  const cutoff = subtractCalendarDaysYmd(todayYmd, lookbackDays);
  return Boolean(cutoff) && refDate >= cutoff;
}

/**
 * Canonical `orderId` builder for catalog-linked sales:
 * - `EVENT` -> `POPUP • Item Title @ Event Name` (prefix strictly `POPUP`)
 * - `ONLINE` -> `${onlineTag} • Item Title` (defaults to `ONLINE`)
 * - Booth -> `${boothCode} • Item Title`
 */
export function buildCatalogSaleOrderId(opts: {
  selectedChannel: string;
  onlineTag?: string;
  title: string;
  eventName?: string;
}): string {
  const cleanTitle = String(opts.title || 'Catalog Item')
    .replace(/•/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  if (opts.selectedChannel === 'EVENT') {
    const cleanEvent = sanitizeEventName(opts.eventName);
    return cleanEvent ? `POPUP • ${cleanTitle} @ ${cleanEvent}` : `POPUP • ${cleanTitle}`;
  }

  if (opts.selectedChannel === 'ONLINE') {
    const prefix = opts.onlineTag || 'ONLINE';
    return `${prefix} • ${cleanTitle}`;
  }

  return `${opts.selectedChannel} • ${cleanTitle}`;
}

/**
 * Canonical `soNumber` + `orderId` builder for quick / no-SKU sale lines:
 * - `EVENT` -> `soNumber: "${partnerPrefix}POPUP-${stamp}"`, `orderId: "POPUP [COST:x.xx] • Title @ Event Name"`
 * - `ONLINE` -> `soNumber: "${partnerPrefix}${onlineTag}-${stamp}"`, `orderId: "${onlineTag} [COST:x.xx] • Title"`
 * - Paper-sheet booth -> `orderId: "${boothCode}-SHEET [COST:x.xx] • Title"`
 */
export function buildQuickSaleOrderCodes(opts: {
  selectedChannel: string;
  partnerPrefix: 'HUCK-' | 'PDXGL-' | 'BB-';
  stamp: string;
  onlineTag?: string;
  supportsPaperSalesSheet?: boolean;
  unitCost: number;
  title: string;
  eventName?: string;
}): { soNumber: string; orderId: string } {
  const cleanDesc = String(opts.title || 'Direct / Walk-Up Sale')
    .replace(/•/g, '-')
    .replace(/[\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const costTag = opts.unitCost > 0 ? ` [COST:${opts.unitCost.toFixed(2)}]` : '';

  if (opts.selectedChannel === 'EVENT') {
    const cleanEvent = sanitizeEventName(opts.eventName);
    const suffix = cleanEvent ? `${cleanDesc} @ ${cleanEvent}` : cleanDesc;
    return {
      soNumber: `${opts.partnerPrefix}POPUP-${opts.stamp}`,
      orderId: `POPUP${costTag} • ${suffix}`,
    };
  }

  if (opts.selectedChannel === 'ONLINE') {
    const tag = opts.onlineTag || 'ONLINE';
    return {
      soNumber: `${opts.partnerPrefix}${tag}-${opts.stamp}`,
      orderId: `${tag}${costTag} • ${cleanDesc}`,
    };
  }

  const sheetPrefix = opts.supportsPaperSalesSheet
    ? `${opts.selectedChannel}-SHEET`
    : opts.selectedChannel;
  return {
    soNumber: `${opts.partnerPrefix}${opts.selectedChannel}-${opts.stamp}`,
    orderId: `${sheetPrefix}${costTag} • ${cleanDesc}`,
  };
}

export function isIntentionalNoSkuOrderId(orderId: string | null | undefined): boolean {
  const ord = String(orderId || '').trim().toUpperCase();
  return (
    ord.includes('-SHEET') ||
    ord.startsWith('ONLINE') ||
    ord.startsWith('EBAY') ||
    ord.startsWith('POSH') ||
    ord.startsWith('DEPOP') ||
    ord.startsWith('WHATNOT') ||
    ord.startsWith('POPUP')
  );
}

/**
 * Canonical Public Flagship & Multi-Channel Events CMS Schema (`works.thehc.llc` -> `thehc.llc`).
 *
 * Pure TypeScript (zero Appwrite / server SDK imports) so client SFCs, SSR endpoints,
 * and public consumers share one strict contract.
 *
 * Privacy & Security Invariants (§4A):
 * - Plain text only (consumers render via text interpolation, NEVER `set:html` / `v-html`).
 * - External URLs must be `https://` only (`javascript:`, `data:`, `http:` are stripped).
 * - Event `locationLabel` is public city / neighborhood / venue name ONLY (never residential street addresses).
 * - Zero internal user IDs, emails, or Appwrite metadata in normalized public payloads.
 */

export const PUBLIC_FLAGSHIP_CMS_DOC_ID = 'public_flagship_cms_v1';

export type CoopEventKind = 'hosted_by_us' | 'partner_event' | 'online_live';
export type CoopEventStatus = 'upcoming' | 'live' | 'past';
export type FlagshipPillarTone = 'primary' | 'success' | 'warning' | 'secondary';
export type FlagshipChannelCategory = 'online' | 'hosted_events' | 'partner_events' | 'retail_booths';

export interface CoopPublicEvent {
  id: string;
  title: string;
  eventKind: CoopEventKind;
  status: CoopEventStatus;
  /** Human-readable date/time badge shown on `thehc.llc` (e.g. "Sat Nov 21 • 11am–5pm PT"). */
  dateLabel: string;
  /** Calendar `YYYY-MM-DD` start date (Law 7 string format). */
  startDate: string;
  /** Optional calendar `YYYY-MM-DD` end date for multi-day conventions/markets. */
  endDate: string;
  /** Public city, neighborhood, market name, or stream platform ONLY — never residential street addresses. */
  locationLabel: string;
  summary: string;
  ctaLabel: string;
  /** Optional `https://` link (e.g. Whatnot stream, market event page, RSVP). */
  ctaUrl: string;
  /** Default Gate 1 fee % pre-filled when selected in `RecordSaleDrawer.vue` (`0` cash, `2.9` card, `11` stream, etc.). */
  defaultFeePct: number;
}

export interface FlagshipChecklistBullet {
  lead: string;
  body: string;
}

export interface FlagshipWorksPillar {
  badge: string;
  badgeTone: FlagshipPillarTone;
  icon: string;
  title: string;
  description: string;
}

export interface FlagshipWorksSpotlight {
  eyebrow: string;
  headlineLead: string;
  headlineAccent: string;
  subhead: string;
  cardTitle: string;
  cardSubtitle: string;
  checklistBullets: [FlagshipChecklistBullet, FlagshipChecklistBullet, FlagshipChecklistBullet];
  pillars: [FlagshipWorksPillar, FlagshipWorksPillar, FlagshipWorksPillar, FlagshipWorksPillar];
}

export interface FlagshipChannelDirectoryItem {
  id: string;
  category: FlagshipChannelCategory;
  name: string;
  badge: string;
  summary: string;
  url: string;
  active: boolean;
}

export interface FlagshipCmsContent {
  version: 1;
  worksSpotlight: FlagshipWorksSpotlight;
  channels: FlagshipChannelDirectoryItem[];
  events: CoopPublicEvent[];
  updatedAt: string;
}

export interface PublicRoleSummaryCard {
  id: string;
  icon: string;
  title: string;
  pitch: string;
  tags: string[];
}

export interface PublicFlagshipApiBundle {
  version: 1;
  source: 'live_cms' | 'default_fallback';
  updatedAt: string;
  policySplit: {
    curatorSharePct: number;
    commonsSharePct: number;
  };
  worksSpotlight: FlagshipWorksSpotlight;
  channels: FlagshipChannelDirectoryItem[];
  events: CoopPublicEvent[];
  roles: PublicRoleSummaryCard[];
}

export const EVENT_KIND_META: Record<
  CoopEventKind,
  { label: string; badge: string; defaultFeePct: number }
> = {
  hosted_by_us: {
    label: '🎪 Hosted by TheHC',
    badge: 'Our Event',
    defaultFeePct: 2.9,
  },
  partner_event: {
    label: '🤝 Partner Market / Con',
    badge: 'Partner Pop-Up',
    defaultFeePct: 2.9,
  },
  online_live: {
    label: '📡 Live Stream / Online Drop',
    badge: 'Live Online',
    defaultFeePct: 11,
  },
};

export const DEFAULT_FLAGSHIP_CMS_CONTENT: FlagshipCmsContent = {
  version: 1,
  updatedAt: '',
  worksSpotlight: {
    eyebrow: 'FLAGSHIP SOFTWARE & MULTI-CHANNEL SALES ENGINE • WORKS.THEHC.LLC',
    headlineLead: 'The Huckleberry Works:',
    headlineAccent: 'From Haul to Every Way We Sell.',
    subhead:
      'Built in Portland for multi-channel resellers, makers, and creative partners—powering online marketplaces, live auctions, our own pop-ups & partner events, retail booths, and fair 70/30 cooperative payouts.',
    cardTitle: 'Works@TheHC',
    cardSubtitle: 'Multi-Channel Sales, Events & Co-op OS',
    checklistBullets: [
      {
        lead: 'Snap Once, Price & Split Fast:',
        body: 'Photograph an entire table of finds—AI slices individual items, checks real secondary comps, and routes stock to the highest-margin channel.',
      },
      {
        lead: 'Sell Everywhere (Online, Pop-Ups, Events & Booths):',
        body: 'Shared eBay + Pirate Ship labels, Whatnot & Depop drops, 1-tap checkout at our own events & partner markets, plus 2-way booth POS sync.',
      },
      {
        lead: 'Fair 70/30 WSDE Settlements:',
        body: '100% acquisition cost & postage returned first, then transparent monthly surplus shared across Curators, Promoters, Enablers, Builders & the Commons Pool.',
      },
    ],
    pillars: [
      {
        badge: 'VISION AI',
        badgeTone: 'primary',
        icon: '📸',
        title: 'AI Quick Scout & Lot Slicer',
        description:
          'Point your phone at a shelf, estate lot, or receipt. AI identifies eras, comps eBay/Poshmark/live margins, and auto-crops multi-item photos.',
      },
      {
        badge: 'MULTI-CHANNEL POS',
        badgeTone: 'success',
        icon: '🛒',
        title: 'Online, Pop-Up & Booth Checkout',
        description:
          'Scan tags at Huckleberry pop-ups or partner conventions, ship 4×6 Pirate Ship orders, and reconcile retail booth registers in one unified ledger.',
      },
      {
        badge: 'DROPCAST & EVENTS',
        badgeTone: 'warning',
        icon: '📣',
        title: 'Social Dropcasts & Live Events',
        description:
          'Turn fresh hauls, upcoming pop-up markets, and Whatnot live shows into ready-to-post Reels & promos—and log Promoter & Builder sweat-equity hours.',
      },
      {
        badge: 'WSDE CO-OP',
        badgeTone: 'secondary',
        icon: '🤝',
        title: '70/30 Democratic Ledger',
        description:
          'Built on Worker Self-Directed Enterprise & Mondragon principles—100% cost recovery first, 70% Curator surplus, and 30% Collective Commons Pool.',
      },
    ],
  },
  channels: [
    {
      id: 'chan-ebay-shared',
      category: 'online',
      name: 'Shared eBay Storefront + Pirate Ship',
      badge: 'Online • Worldwide',
      summary: 'Multi-user co-op eBay storefront with 100% Pirate Ship 4×6 postage recouped before the 70/30 split.',
      url: 'https://works.thehc.llc/coop',
      active: true,
    },
    {
      id: 'chan-whatnot-live',
      category: 'online',
      name: 'Whatnot & District Live Drops',
      badge: 'Live Auctions',
      summary: 'Real-time vintage, tabletop RPG, and collector live auction shows hosted by the Collective.',
      url: 'https://whatnot.com/invite/huckfinds',
      active: true,
    },
    {
      id: 'chan-depop-social',
      category: 'online',
      name: 'Depop & Social Direct Drops',
      badge: 'Apparel & Curated',
      summary: 'Curated vintage apparel, goth/whimsigoth fashion, and direct social drops.',
      url: 'https://www.depop.com/huckfinds/',
      active: true,
    },
    {
      id: 'chan-hc-events',
      category: 'hosted_events',
      name: 'Huckleberry Pop-Ups & Community Events',
      badge: 'Hosted by TheHC',
      summary: 'Pop-up markets, tabletop game nights, trunk shows, and direct community sales hosted by our crew.',
      url: 'https://thehc.llc/#works',
      active: true,
    },
    {
      id: 'chan-partner-markets',
      category: 'partner_events',
      name: 'Partner Markets, Swaps & Conventions',
      badge: 'Partner Events',
      summary: 'PNW vintage flea markets, gaming conventions, oddities expos, and collaborative pop-up booths.',
      url: 'https://thehc.llc/#locations',
      active: true,
    },
    {
      id: 'chan-retail-booths',
      category: 'retail_booths',
      name: 'Portland Permanent Retail Booths (#0EJ & Dusty Tiger)',
      badge: 'In-Person • SE Portland',
      summary: "Huck's Adventures Outfitter (#0EJ at The Memory Den) plus small-collectible showcase shelves at Dusty Tiger.",
      url: 'https://thehc.llc/#locations',
      active: true,
    },
  ],
  events: [
    {
      id: 'evt-whatnot-weekly',
      title: 'HuckFinds Live Tabletop, Sci-Fi & Vintage Drop',
      eventKind: 'online_live',
      status: 'upcoming',
      dateLabel: 'Weekly Live Stream • Follow for Next Drop Alert',
      startDate: '',
      endDate: '',
      locationLabel: 'Whatnot & District Live',
      summary: 'Live tabletop RPG boxed sets, curiosities, and fresh PNW estate finds with live chat bidding.',
      ctaLabel: 'Follow on Whatnot',
      ctaUrl: 'https://whatnot.com/invite/huckfinds',
      defaultFeePct: 11,
    },
    {
      id: 'evt-hc-community-popup',
      title: 'Huckleberry Seasonal Pop-Up & Game Swap',
      eventKind: 'hosted_by_us',
      status: 'upcoming',
      dateLabel: 'Seasonal Pop-Up • Portland Metro',
      startDate: '',
      endDate: '',
      locationLabel: 'Portland, OR (Venue Announced Per Drop)',
      summary: 'Direct Collective pop-up featuring multi-curator vintage racks, board game swaps, and zero middleman fees.',
      ctaLabel: 'Connect for Updates',
      ctaUrl: 'https://works.thehc.llc/coop',
      defaultFeePct: 2.9,
    },
  ],
};

function cleanPlainText(raw: unknown, maxLen: number, fallback = ''): string {
  const str = String(raw ?? '')
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/data:[a-z0-9+/=-]+;base64,[a-z0-9+/=]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!str) return fallback;
  return str.slice(0, maxLen);
}

/**
 * Strictly permits `https://` URLs only (or `''` when omitted).
 * Rejects `javascript:`, `data:`, `vbscript:`, `http:`, and malformed URLs.
 */
export function sanitizeHttpsUrl(raw: unknown): string {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';
  if (!/^https:\/\/[^\s<>"'`]+$/i.test(trimmed)) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return '';
    return parsed.toString().slice(0, 300);
  } catch {
    return '';
  }
}

function sanitizeYmd(raw: unknown): string {
  const s = String(raw ?? '').trim().slice(0, 10);
  return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s) ? s : '';
}

function sanitizePillarTone(raw: unknown, fallback: FlagshipPillarTone): FlagshipPillarTone {
  return raw === 'primary' || raw === 'success' || raw === 'warning' || raw === 'secondary'
    ? raw
    : fallback;
}

export function normalizePublicEvent(raw: any, index = 0): CoopPublicEvent {
  const kind: CoopEventKind =
    raw?.eventKind === 'hosted_by_us' || raw?.eventKind === 'partner_event' || raw?.eventKind === 'online_live'
      ? raw.eventKind
      : 'hosted_by_us';
  const status: CoopEventStatus =
    raw?.status === 'live' || raw?.status === 'past' || raw?.status === 'upcoming'
      ? raw.status
      : 'upcoming';
  const rawFee = Number(raw?.defaultFeePct);
  const defaultFeePct = Number.isFinite(rawFee)
    ? Math.min(50, Math.max(0, Number(rawFee.toFixed(2))))
    : EVENT_KIND_META[kind].defaultFeePct;

  const rawId = String(raw?.id || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 48);

  return {
    id: rawId || `evt-${index + 1}`,
    title: cleanPlainText(raw?.title, 90, 'Upcoming Collective Event'),
    eventKind: kind,
    status,
    dateLabel: cleanPlainText(raw?.dateLabel, 70, 'Date TBA'),
    startDate: sanitizeYmd(raw?.startDate),
    endDate: sanitizeYmd(raw?.endDate),
    locationLabel: cleanPlainText(raw?.locationLabel, 80, 'Portland, OR'),
    summary: cleanPlainText(raw?.summary, 240, ''),
    ctaLabel: cleanPlainText(raw?.ctaLabel, 36, 'Learn More'),
    ctaUrl: sanitizeHttpsUrl(raw?.ctaUrl),
    defaultFeePct,
  };
}

export function normalizeFlagshipChannel(
  raw: any,
  index = 0
): FlagshipChannelDirectoryItem {
  const category: FlagshipChannelCategory =
    raw?.category === 'online' ||
    raw?.category === 'hosted_events' ||
    raw?.category === 'partner_events' ||
    raw?.category === 'retail_booths'
      ? raw.category
      : 'online';

  const rawId = String(raw?.id || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 48);

  return {
    id: rawId || `chan-${index + 1}`,
    category,
    name: cleanPlainText(raw?.name, 80, 'Sales Channel'),
    badge: cleanPlainText(raw?.badge, 40, 'Active'),
    summary: cleanPlainText(raw?.summary, 220, ''),
    url: sanitizeHttpsUrl(raw?.url),
    active: raw?.active !== false,
  };
}

export function normalizeFlagshipCmsContent(raw: any): FlagshipCmsContent {
  const def = DEFAULT_FLAGSHIP_CMS_CONTENT;
  const ws = raw?.worksSpotlight || {};

  const rawBullets = Array.isArray(ws.checklistBullets) ? ws.checklistBullets : [];
  const checklistBullets: [FlagshipChecklistBullet, FlagshipChecklistBullet, FlagshipChecklistBullet] = [
    0, 1, 2,
  ].map((idx) => ({
    lead: cleanPlainText(
      rawBullets[idx]?.lead,
      70,
      def.worksSpotlight.checklistBullets[idx].lead
    ),
    body: cleanPlainText(
      rawBullets[idx]?.body,
      220,
      def.worksSpotlight.checklistBullets[idx].body
    ),
  })) as [FlagshipChecklistBullet, FlagshipChecklistBullet, FlagshipChecklistBullet];

  const rawPillars = Array.isArray(ws.pillars) ? ws.pillars : [];
  const pillars: [FlagshipWorksPillar, FlagshipWorksPillar, FlagshipWorksPillar, FlagshipWorksPillar] = [
    0, 1, 2, 3,
  ].map((idx) => {
    const defP = def.worksSpotlight.pillars[idx];
    const srcP = rawPillars[idx] || {};
    return {
      badge: cleanPlainText(srcP.badge, 28, defP.badge),
      badgeTone: sanitizePillarTone(srcP.badgeTone, defP.badgeTone),
      icon: cleanPlainText(srcP.icon, 8, defP.icon),
      title: cleanPlainText(srcP.title, 60, defP.title),
      description: cleanPlainText(srcP.description, 240, defP.description),
    };
  }) as [FlagshipWorksPillar, FlagshipWorksPillar, FlagshipWorksPillar, FlagshipWorksPillar];

  const channels = Array.isArray(raw?.channels) && raw.channels.length > 0
    ? raw.channels.slice(0, 16).map((c: any, idx: number) => normalizeFlagshipChannel(c, idx))
    : def.channels.map((c, idx) => normalizeFlagshipChannel(c, idx));

  const events = Array.isArray(raw?.events)
    ? raw.events.slice(0, 24).map((e: any, idx: number) => normalizePublicEvent(e, idx))
    : def.events.map((e, idx) => normalizePublicEvent(e, idx));

  const updatedAt =
    typeof raw?.updatedAt === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(raw.updatedAt)
      ? raw.updatedAt.slice(0, 30)
      : '';

  return {
    version: 1,
    updatedAt,
    worksSpotlight: {
      eyebrow: cleanPlainText(ws.eyebrow, 90, def.worksSpotlight.eyebrow),
      headlineLead: cleanPlainText(ws.headlineLead, 60, def.worksSpotlight.headlineLead),
      headlineAccent: cleanPlainText(ws.headlineAccent, 70, def.worksSpotlight.headlineAccent),
      subhead: cleanPlainText(ws.subhead, 320, def.worksSpotlight.subhead),
      cardTitle: cleanPlainText(ws.cardTitle, 40, def.worksSpotlight.cardTitle),
      cardSubtitle: cleanPlainText(ws.cardSubtitle, 60, def.worksSpotlight.cardSubtitle),
      checklistBullets,
      pillars,
    },
    channels,
    events,
  };
}

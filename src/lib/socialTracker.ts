/**
 * Cloud-Synced Social Cross-Posting & Promo Link Tracker Model (`manifests/coop_social_tracker_v1`).
 *
 * Pure TypeScript — zero Appwrite / server SDK imports so it is 100% safe across
 * client SFCs, SSR API routes, and `useLiveDashboardSource.ts` (§14D).
 */
import type { DashboardDropLite } from './dashboardTypes';
import { sanitizeHttpsUrl, type CoopPublicEvent } from './flagshipContent';
import { subtractCalendarDaysYmd } from './salesChannels';

export const SOCIAL_TRACKER_DOC_ID = 'coop_social_tracker_v1';

export type SocialChannelId =
  | 'instagram'
  | 'tiktok'
  | 'facebook'
  | 'youtube'
  | 'whatnot'
  | 'depop'
  | 'district'
  | 'ebay';

export type SocialSourceKind = 'event' | 'online_drop' | 'booth_restock' | 'general';
export type SocialPostStatus = 'pending' | 'posted' | 'skipped';

export interface SocialChannelMeta {
  id: SocialChannelId;
  label: string;
  shortLabel: string;
  icon: string;
  profileUrl: string;
}

export const SOCIAL_CHANNELS: readonly SocialChannelMeta[] = [
  {
    id: 'instagram',
    label: 'Instagram',
    shortLabel: 'IG',
    icon: 'solar:camera-bold',
    profileUrl: 'https://www.instagram.com/huckleberryfind',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    shortLabel: 'TikTok',
    icon: 'solar:music-note-2-bold',
    profileUrl: 'https://www.tiktok.com/@stormbringer288',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    shortLabel: 'FB',
    icon: 'solar:Global-bold',
    profileUrl: 'https://www.facebook.com/profile.php?id=61588276871946',
  },
  {
    id: 'youtube',
    label: 'YouTube Shorts',
    shortLabel: 'YT',
    icon: 'solar:videocamera-record-bold',
    profileUrl: 'https://www.youtube.com/channel/UCcfa92ZxvDRqyOLmZtoW1Vw',
  },
  {
    id: 'whatnot',
    label: 'Whatnot Live',
    shortLabel: 'Whatnot',
    icon: 'solar:broadcast-bold',
    profileUrl: 'https://whatnot.com/invite/huckfinds',
  },
  {
    id: 'depop',
    label: 'Depop',
    shortLabel: 'Depop',
    icon: 'solar:hanger-2-bold',
    profileUrl: 'https://www.depop.com/huckfinds/',
  },
  {
    id: 'district',
    label: 'District',
    shortLabel: 'District',
    icon: 'solar:shop-2-bold',
    profileUrl: 'https://district.net/u/pdxstormbringer',
  },
  {
    id: 'ebay',
    label: 'eBay Store',
    shortLabel: 'eBay',
    icon: 'solar:box-bold',
    profileUrl: 'https://works.thehc.llc/coop',
  },
] as const;

export const DEFAULT_TARGET_SOCIAL_CHANNELS: readonly SocialChannelId[] = [
  'instagram',
  'tiktok',
  'facebook',
  'whatnot',
] as const;

export interface SocialPlatformPostLog {
  channel: SocialChannelId;
  status: SocialPostStatus;
  postUrl: string;
  postedAt: string;
  postedBy: string;
  metricsNote: string;
}

export interface SocialPromoCampaign {
  id: string;
  title: string;
  sourceKind: SocialSourceKind;
  linkedEventId?: string;
  linkedSkus: string[];
  targetChannels: SocialChannelId[];
  posts: Record<SocialChannelId, SocialPlatformPostLog>;
  destinationUrl: string;
  plainFactSheet: string;
  laborLoggedEntryId?: string;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SocialTrackerSnapshot {
  version: number;
  campaigns: SocialPromoCampaign[];
  updatedAt: string;
}

function cleanText(raw: unknown, maxLen: number, fallback = ''): string {
  const s = String(raw ?? '')
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/data:[a-z0-9+/=-]+;base64,[a-z0-9+/=]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s ? s.slice(0, maxLen) : fallback;
}

function cleanMultilineText(raw: unknown, maxLen: number): string {
  return String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]+/g, '')
    .replace(/data:[a-z0-9+/=-]+;base64,[a-z0-9+/=]+/gi, '')
    .trim()
    .slice(0, maxLen);
}

function sanitizeYmd(raw: unknown): string {
  const s = String(raw ?? '').trim().slice(0, 10);
  return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s) ? s : '';
}

export function createEmptyPostsMap(): Record<SocialChannelId, SocialPlatformPostLog> {
  const out = {} as Record<SocialChannelId, SocialPlatformPostLog>;
  for (const ch of SOCIAL_CHANNELS) {
    out[ch.id] = {
      channel: ch.id,
      status: 'pending',
      postUrl: '',
      postedAt: '',
      postedBy: '',
      metricsNote: '',
    };
  }
  return out;
}

export function normalizeSocialCampaign(raw: any, index = 0): SocialPromoCampaign {
  const validChannelIds = new Set<SocialChannelId>(SOCIAL_CHANNELS.map((c) => c.id));
  const rawTargets = Array.isArray(raw?.targetChannels)
    ? raw.targetChannels.filter((c: any) => validChannelIds.has(c))
    : [];
  const targetChannels: SocialChannelId[] =
    rawTargets.length > 0 ? Array.from(new Set(rawTargets)) : [...DEFAULT_TARGET_SOCIAL_CHANNELS];

  const posts = createEmptyPostsMap();
  const rawPosts = raw?.posts && typeof raw.posts === 'object' ? raw.posts : {};
  for (const ch of SOCIAL_CHANNELS) {
    const src = rawPosts[ch.id] || {};
    const url = sanitizeHttpsUrl(src.postUrl);
    const status: SocialPostStatus =
      src.status === 'posted' || (url && src.status !== 'skipped')
        ? 'posted'
        : src.status === 'skipped'
          ? 'skipped'
          : 'pending';
    posts[ch.id] = {
      channel: ch.id,
      status,
      postUrl: url,
      postedAt: sanitizeYmd(src.postedAt),
      postedBy: cleanText(src.postedBy, 60),
      metricsNote: cleanText(src.metricsNote, 120),
    };
  }

  const sourceKind: SocialSourceKind =
    raw?.sourceKind === 'event' ||
    raw?.sourceKind === 'online_drop' ||
    raw?.sourceKind === 'booth_restock' ||
    raw?.sourceKind === 'general'
      ? raw.sourceKind
      : 'general';

  const rawId = String(raw?.id || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 48);

  const linkedSkus = Array.isArray(raw?.linkedSkus)
    ? Array.from(
        new Set(
          raw.linkedSkus
            .map((s: any) => cleanText(s, 32).toUpperCase())
            .filter(Boolean)
        )
      ).slice(0, 20)
    : [];

  const nowIso = new Date().toISOString();
  const createdAt =
    typeof raw?.createdAt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw.createdAt)
      ? raw.createdAt.slice(0, 30)
      : nowIso;
  const updatedAt =
    typeof raw?.updatedAt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw.updatedAt)
      ? raw.updatedAt.slice(0, 30)
      : createdAt;

  return {
    id: rawId || `promo-${index + 1}`,
    title: cleanText(raw?.title, 100, 'Collective Social Drop'),
    sourceKind,
    linkedEventId: raw?.linkedEventId ? cleanText(raw.linkedEventId, 48) : undefined,
    linkedSkus,
    targetChannels,
    posts,
    destinationUrl: sanitizeHttpsUrl(raw?.destinationUrl),
    plainFactSheet: cleanMultilineText(raw?.plainFactSheet, 1800),
    laborLoggedEntryId: raw?.laborLoggedEntryId ? cleanText(raw.laborLoggedEntryId, 60) : undefined,
    archived: Boolean(raw?.archived),
    createdAt,
    updatedAt,
  };
}

export function normalizeSocialTrackerSnapshot(raw: any): SocialTrackerSnapshot {
  const version = Math.max(1, Math.floor(Number(raw?.version) || 1));
  const campaigns = Array.isArray(raw?.campaigns)
    ? raw.campaigns.slice(0, 120).map((c: any, idx: number) => normalizeSocialCampaign(c, idx))
    : [];
  const updatedAt =
    typeof raw?.updatedAt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw.updatedAt)
      ? raw.updatedAt.slice(0, 30)
      : '';
  return { version, campaigns, updatedAt };
}

export function summarizeCampaignProgress(campaign: SocialPromoCampaign): {
  totalTargets: number;
  postedCount: number;
  pendingCount: number;
  liveUrls: string[];
  isComplete: boolean;
} {
  const targets = campaign.targetChannels.length > 0
    ? campaign.targetChannels
    : [...DEFAULT_TARGET_SOCIAL_CHANNELS];
  let postedCount = 0;
  let pendingCount = 0;
  const liveUrls: string[] = [];

  for (const ch of targets) {
    const entry = campaign.posts[ch];
    if (!entry || entry.status === 'pending') {
      pendingCount += 1;
    } else if (entry.status === 'posted') {
      postedCount += 1;
      if (entry.postUrl) liveUrls.push(entry.postUrl);
    }
  }

  // Include any bonus non-target channels where a URL was also posted
  for (const ch of SOCIAL_CHANNELS) {
    const entry = campaign.posts[ch.id];
    if (entry?.status === 'posted' && entry.postUrl && !liveUrls.includes(entry.postUrl)) {
      liveUrls.push(entry.postUrl);
    }
  }

  return {
    totalTargets: targets.length,
    postedCount,
    pendingCount,
    liveUrls,
    isComplete: pendingCount === 0 && targets.length > 0,
  };
}

/**
 * Prunes archived or fully-completed campaigns older than 90 calendar days (Law 7 string compare)
 * so the single `coop_social_tracker_v1` manifest stays lean and well under 60 KB.
 */
export function pruneStaleSocialCampaigns(
  campaigns: SocialPromoCampaign[],
  todayYmd: string,
  maxAgeDays = 90
): SocialPromoCampaign[] {
  const cutoff = subtractCalendarDaysYmd(todayYmd, maxAgeDays);
  if (!cutoff) return campaigns.slice(0, 100);

  return campaigns
    .filter((c) => {
      const updatedYmd = String(c.updatedAt || c.createdAt || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(updatedYmd)) return true;
      const summary = summarizeCampaignProgress(c);
      if ((c.archived || summary.isComplete) && updatedYmd < cutoff) {
        return false;
      }
      return true;
    })
    .slice(0, 100);
}

/**
 * Builds a clean, factual Plain-Fact Copy Sheet from real event / item details
 * (zero cheesy AI prose — ready to paste or reference while filming natively in TikTok/IG/Whatnot).
 */
export function buildPlainFactSheet(opts: {
  title: string;
  event?: Pick<CoopPublicEvent, 'title' | 'dateLabel' | 'locationLabel' | 'ctaUrl' | 'summary'> | null;
  items?: ReadonlyArray<{ title?: string; resalePrice?: number | string; upc?: string; locationSku?: string }>;
  destinationUrl?: string;
}): string {
  const lines: string[] = [];
  const headline = cleanText(opts.title, 100);
  if (headline) lines.push(headline);

  if (opts.event) {
    lines.push('');
    lines.push(`When: ${opts.event.dateLabel}`);
    lines.push(`Where: ${opts.event.locationLabel}`);
    if (opts.event.summary) {
      lines.push(opts.event.summary);
    }
  }

  if (opts.items && opts.items.length > 0) {
    lines.push('');
    for (const it of opts.items.slice(0, 10)) {
      const name = cleanText(it.title, 70, 'Featured Item');
      const priceNum = Number(it.resalePrice || 0);
      const pricePart = priceNum > 0 ? ` — $${priceNum.toFixed(2)}` : '';
      const sku = cleanText(it.upc || it.locationSku, 24);
      const skuPart = sku ? ` [${sku}]` : '';
      lines.push(`• ${name}${pricePart}${skuPart}`);
    }
  }

  const link = sanitizeHttpsUrl(opts.destinationUrl || opts.event?.ctaUrl || '');
  if (link) {
    lines.push('');
    lines.push(`Details / Shop: ${link}`);
  }

  lines.push('');
  lines.push('#huckfinds #thehuckleberrycollective #portlandvintage #tabletop #resale');
  return lines.join('\n');
}

/**
 * Maps Social Cross-Post campaigns onto existing `DashboardDropLite` rows so `/dashboard`
 * surfaces real pending cross-posts with ZERO new alert IDs (§14A / §14B / §14D).
 */
export function mapSocialCampaignsToDashboardDrops(
  campaigns: ReadonlyArray<SocialPromoCampaign>
): DashboardDropLite[] {
  return campaigns
    .filter((c) => !c.archived)
    .map((c) => {
      const progress = summarizeCampaignProgress(c);
      return {
        id: c.id,
        title: c.title,
        status: progress.pendingCount > 0 ? ('ready' as const) : ('announced' as const),
      };
    });
}

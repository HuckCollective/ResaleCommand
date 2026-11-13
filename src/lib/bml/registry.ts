import { databases } from '../appwrite';
import { Permission, Role } from 'appwrite';
import { getDatabaseId } from '../appwriteEnv';
import { ALPHA_SITE_URL, siteConfig, SYNC_FALLBACK_ORIGINS } from '../../site-config';

export type BookmarkletToolId = 'ricochet_sync' | 'auction_scout';
export type BookmarkletDisplayMode = 'full' | 'compact' | 'icon_only';

export interface BookmarkletToolConfig {
  id: BookmarkletToolId;
  icon: string;
  barTitle: string;
  compactTitle: string;
  hudTitle: string;
  mobileKeyword: string;
  displayMode: BookmarkletDisplayMode;
  targetSites: string;
  summary: string;
  status: 'active' | 'phase2_ready';
}

export interface BookmarkletRegistryConfig {
  updatedAt: string;
  updatedBy?: string;
  tools: Record<BookmarkletToolId, BookmarkletToolConfig>;
}

export const BML_REGISTRY_DOC_ID = 'bml_registry_config_v1';
const MANIFESTS_COL_ID = 'manifests';
const LOCAL_STORAGE_KEY = 'rc_bml_registry_v1';

export const BML_ICON_PRESETS = ['⚡', '🫐', '🔭', '🏷️', '🎯', '🚀', '💎', '📦', '🛡️', '🔥'] as const;

export const DEFAULT_BML_REGISTRY_CONFIG: BookmarkletRegistryConfig = {
  updatedAt: '2026-11-12T00:00:00.000Z',
  tools: {
    ricochet_sync: {
      id: 'ricochet_sync',
      icon: '⚡',
      barTitle: 'Memory Den Sync',
      compactTitle: 'MD Sync',
      hudTitle: 'Works@TheHC ➔ Ricochet POS Sync',
      mobileKeyword: 'md',
      displayMode: 'full',
      targetSites: 'memoryden.ricoconsign.com',
      summary: '2-way barcode verification, outbound drop deployment & live payout CSV capture on Ricochet POS.',
      status: 'active',
    },
    auction_scout: {
      id: 'auction_scout',
      icon: '🔭',
      barTitle: 'Auction Scout & Orders',
      compactTitle: 'SGW Scout',
      hudTitle: 'Works@TheHC ➔ Auction Scout & Order Sync',
      mobileKeyword: 'rcscout',
      displayMode: 'full',
      targetSites: 'shopgoodwill.com (In-Progress, Closed, Shipped & Item Pages)',
      summary: '4-Page ShopGoodwill Sync: Live winning/outbid badges, Won➔Acquired / Lost➔Clean reconciliation, Shipped PO + carrier tracking sync & 1-tap Item Scout.',
      status: 'active',
    },
  },
};

export function normalizeBmlRegistryConfig(raw?: Partial<BookmarkletRegistryConfig> | null): BookmarkletRegistryConfig {
  const base = DEFAULT_BML_REGISTRY_CONFIG;
  if (!raw || typeof raw !== 'object') {
    return JSON.parse(JSON.stringify(base));
  }
  const rawTools = (raw.tools || {}) as Partial<Record<BookmarkletToolId, Partial<BookmarkletToolConfig>>>;
  const mergeTool = (id: BookmarkletToolId): BookmarkletToolConfig => {
    const d = base.tools[id];
    const r = rawTools[id] || {};
    const mode: BookmarkletDisplayMode =
      r.displayMode === 'compact' || r.displayMode === 'icon_only' || r.displayMode === 'full'
        ? r.displayMode
        : d.displayMode;
    return {
      ...d,
      icon: String(r.icon ?? d.icon).trim() || d.icon,
      barTitle: String(r.barTitle ?? d.barTitle).trim() || d.barTitle,
      compactTitle: String(r.compactTitle ?? d.compactTitle).trim() || d.compactTitle,
      hudTitle: String(r.hudTitle ?? d.hudTitle).trim() || d.hudTitle,
      mobileKeyword:
        String(r.mobileKeyword ?? d.mobileKeyword)
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 8) || d.mobileKeyword,
      displayMode: mode,
    };
  };

  return {
    updatedAt: String(raw.updatedAt || base.updatedAt),
    updatedBy: raw.updatedBy ? String(raw.updatedBy) : undefined,
    tools: {
      ricochet_sync: mergeTool('ricochet_sync'),
      auction_scout: mergeTool('auction_scout'),
    },
  };
}

/** Formats the exact text rendered inside the draggable `<a>` pill (which Desktop Chrome uses as the Bookmarks Bar label). */
export function formatBmlBarLabel(tool: BookmarkletToolConfig, locationShortName?: string): string {
  const icon = (tool.icon || '⚡').trim();
  if (tool.displayMode === 'icon_only') {
    return icon;
  }
  if (tool.displayMode === 'compact') {
    return `${icon} ${tool.compactTitle}`.trim();
  }
  if (tool.id === 'ricochet_sync' && locationShortName && tool.barTitle === DEFAULT_BML_REGISTRY_CONFIG.tools.ricochet_sync.barTitle) {
    return `${icon} ${locationShortName} Sync`.trim();
  }
  return `${icon} ${tool.barTitle}`.trim();
}

/** Formats the recommended Android / Pixel 8 Chrome bookmark name starting with the short address-bar trigger keyword. */
export function formatBmlMobileBookmarkName(tool: BookmarkletToolConfig, locationCode?: string): string {
  const kw = (locationCode ? locationCode.toLowerCase() : tool.mobileKeyword || 'hc').trim();
  return `${kw} — ${tool.icon} ${tool.compactTitle || tool.barTitle}`;
}

export function buildEvergreenBookmarkletHref(scriptPathAndQuery: string, preferredOrigin?: string): string {
  const cleanPreferred =
    preferredOrigin && !preferredOrigin.includes('localhost') ? preferredOrigin.replace(/\/+$/, '') : '';
  const currentOrigin =
    cleanPreferred ||
    (typeof window !== 'undefined' &&
    window.location?.origin &&
    !window.location.origin.includes('localhost')
      ? window.location.origin
      : siteConfig.siteUrl);
  const origins = Array.from(new Set([currentOrigin, ...SYNC_FALLBACK_ORIGINS, ALPHA_SITE_URL].filter(Boolean)));
  const sep = scriptPathAndQuery.includes('?') ? '&' : '?';
  return `javascript:(function(){delete window.__RC_PRELOADED_BARCODES__;var h=${JSON.stringify(origins)},i=0;function l(){if(i>=h.length)return;var s=document.createElement('script');s.src=h[i++]+${JSON.stringify(scriptPathAndQuery + sep + 't=')}+Date.now();s.onerror=l;document.body.appendChild(s);}l();})();`;
}

export function getCachedBmlRegistryConfig(): BookmarkletRegistryConfig {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) return normalizeBmlRegistryConfig(JSON.parse(saved));
    } catch {}
  }
  return normalizeBmlRegistryConfig(null);
}

export async function loadBmlRegistryConfig(): Promise<BookmarkletRegistryConfig> {
  try {
    const doc: any = await databases.getDocument(getDatabaseId(), MANIFESTS_COL_ID, BML_REGISTRY_DOC_ID);
    const raw = doc?.itemsSnapshot || doc?.notes_raw;
    if (raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const normalized = normalizeBmlRegistryConfig(parsed);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));
        } catch {}
      }
      return normalized;
    }
  } catch {
    // Use local / default fallback if manifest doc doesn't exist yet
  }
  return getCachedBmlRegistryConfig();
}

export async function saveBmlRegistryConfig(
  config: BookmarkletRegistryConfig,
  teamId?: string,
  updatedBy?: string
): Promise<BookmarkletRegistryConfig> {
  const normalized = normalizeBmlRegistryConfig({
    ...config,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || config.updatedBy,
  });

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));
    } catch {}
  }

  const dbId = getDatabaseId();
  const payload = {
    location: 'SYSTEM_BML_REGISTRY',
    status: 'completed',
    itemsSnapshot: JSON.stringify(normalized),
    tenantId: teamId || 'system',
  };

  try {
    await databases.updateDocument(dbId, MANIFESTS_COL_ID, BML_REGISTRY_DOC_ID, payload);
  } catch (err: any) {
    if (err?.code === 404) {
      const perms = [Permission.read(Role.users()), Permission.update(Role.users())];
      await databases.createDocument(dbId, MANIFESTS_COL_ID, BML_REGISTRY_DOC_ID, payload, perms);
    } else {
      throw err;
    }
  }

  return normalized;
}


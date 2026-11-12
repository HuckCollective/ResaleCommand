import { getCollection } from 'astro:content';
import { marked } from 'marked';
import { getAllLocationSettingMetas } from './warehouses';
import { DEFAULT_COOP_POLICY_CONFIG } from './coopGovernance';

export type CharterSectionId = 'payouts' | 'monthly' | 'expenses' | 'governance' | 'legal';

export interface CharterSectionView {
  id: CharterSectionId;
  order: number;
  icon: string;
  title: string;
  summary: string;
  stat: string;
  href: string;
  ctaLabel: string;
  html: string;
}

export interface CharterRoleCard {
  id: 'curator' | 'promoter' | 'enabler' | 'consignor' | 'founder';
  order: number;
  icon: string;
  title: string;
  pitch: string;
  tags: string[];
  showInJoinGrid: boolean;
  html: string;
}

export interface CharterCmsBundle {
  sections: CharterSectionView[];
  roleCards: CharterRoleCard[];
  primaryBoothLabel: string;
  primaryBoothRentLabel: string;
  curatorPct: number;
  commonsPct: number;
}

const VALID_SECTIONS: ReadonlySet<string> = new Set(['payouts', 'monthly', 'expenses', 'governance', 'legal']);

export function parseCharterSectionParam(raw: string | null | undefined): CharterSectionId {
  if (raw && VALID_SECTIONS.has(raw)) {
    return raw as CharterSectionId;
  }
  return 'payouts';
}

function interpolateCharterTokens(markdown: string, tokens: Record<string, string>): string {
  return markdown.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_match, key: string) => {
    return Object.prototype.hasOwnProperty.call(tokens, key) ? tokens[key] : _match;
  });
}

export async function loadCharterCmsBundle(): Promise<CharterCmsBundle> {
  const locationMetas = getAllLocationSettingMetas();
  const retailBooths = locationMetas.filter((m) => m.commissionRate > 0 || m.monthlyRent > 0);
  const primaryBooth = retailBooths[0] || locationMetas[0];
  const secondaryBooth = retailBooths[1] || primaryBooth;

  const curatorPct = DEFAULT_COOP_POLICY_CONFIG.curatorSharePct;
  const commonsPct = DEFAULT_COOP_POLICY_CONFIG.commonsSharePct;

  const tokens: Record<string, string> = {
    PRIMARY_BOOTH_NAME: primaryBooth.shortName || primaryBooth.name,
    PRIMARY_BOOTH_FEE: String(primaryBooth.commissionRate),
    PRIMARY_BOOTH_RENT: primaryBooth.monthlyRent.toFixed(2),
    SECONDARY_BOOTH_NAME: secondaryBooth.shortName || secondaryBooth.name,
    SECONDARY_BOOTH_FEE: String(secondaryBooth.commissionRate),
    SECONDARY_BOOTH_RENT: secondaryBooth.monthlyRent.toFixed(2),
    CURATOR_PCT: String(curatorPct),
    COMMONS_PCT: String(commonsPct),
  };

  const [rawCharter, rawRoles] = await Promise.all([
    getCollection('charter'),
    getCollection('roleHelp'),
  ]);

  const sortedCharter = [...rawCharter].sort((a, b) => a.data.order - b.data.order);
  const sections: CharterSectionView[] = await Promise.all(
    sortedCharter.map(async (entry) => {
      const interpolated = interpolateCharterTokens(entry.body || '', tokens);
      const html = await marked.parse(interpolated);
      return {
        id: entry.data.sectionId,
        order: entry.data.order,
        icon: entry.data.icon,
        title: entry.data.title,
        summary: entry.data.summary,
        stat: entry.data.stat,
        href: entry.data.memberHref,
        ctaLabel: entry.data.memberCtaLabel,
        html,
      };
    })
  );

  const sortedRoles = [...rawRoles].sort((a, b) => a.data.order - b.data.order);
  const roleCards: CharterRoleCard[] = await Promise.all(
    sortedRoles.map(async (entry) => {
      const interpolated = interpolateCharterTokens(entry.body || '', tokens);
      const html = entry.body ? await marked.parse(interpolated) : '';
      return {
        id: entry.data.hatId,
        order: entry.data.order,
        icon: entry.data.icon,
        title: entry.data.title,
        pitch: entry.data.pitch,
        tags: entry.data.tags,
        showInJoinGrid: entry.data.showInJoinGrid,
        html,
      };
    })
  );

  return {
    sections,
    roleCards,
    primaryBoothLabel: primaryBooth.shortName || primaryBooth.name,
    primaryBoothRentLabel: `$${primaryBooth.monthlyRent.toFixed(2)}`,
    curatorPct,
    commonsPct,
  };
}

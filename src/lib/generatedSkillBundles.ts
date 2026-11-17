/**
 * Compile-time Vite `?raw` Skill Bundle Loader for `/coop/vault` (`src/pages/api/generate-vault-prompt.ts`).
 *
 * Zero Node sync script & zero 338 KB JSON blob in Git:
 * - Vite/Astro inlines these `.md?raw` imports into plain JS strings at `astro build` time so Vercel
 *   serverless functions read them directly from memory without touching the filesystem at runtime.
 * - `AGENTS.md` is placed FIRST in `hucks-resale-core` so Core DNA + Laws 1–7 are never sliced off
 *   before `ACTIVE_SESSION.md`.
 */

import agentsMdRaw from '../../AGENTS.md?raw';
import activeSessionRaw from '../../ACTIVE_SESSION.md?raw';

import hucksCoreSkillRaw from '../../.agents/skills/hucks-resale-core/SKILL.md?raw';
import brandIdentityRaw from '../../.agents/skills/huckleberry-brand-and-domain-identity/SKILL.md?raw';

import aiArchCostRaw from '../../.agents/skills/ai-architecture-and-cost-optimization/SKILL.md?raw';
import aiScoutValidationRaw from '../../.agents/skills/ai-scout-and-deep-scan-validation/SKILL.md?raw';
import photoSlicingRaw from '../../.agents/skills/multi-angle-photo-slicing/SKILL.md?raw';
import appraisalValuationRaw from '../../.agents/skills/secondary-market-appraisal-and-valuation/SKILL.md?raw';
import sourcingEnrichmentRaw from '../../.agents/skills/sourcing-and-ai-enrichment/SKILL.md?raw';

import inventoryCoreRaw from '../../.agents/skills/resale-inventory-core/SKILL.md?raw';
import lotProfitStrategyRaw from '../../.agents/skills/lot-profit-and-exit-strategy/SKILL.md?raw';
import uxTaxonomyRaw from '../../.agents/skills/ux-design-system-taxonomy/SKILL.md?raw';
import vueStandardsRaw from '../../.agents/skills/vue-component-standards/SKILL.md?raw';
import lawsOfUxRaw from '../../.agents/skills/laws-of-ux/SKILL.md?raw';

import haulIngestionRaw from '../../.agents/skills/haul-ingestion/SKILL.md?raw';
import boothSyncRaw from '../../.agents/skills/resale-booth-sync/SKILL.md?raw';
import merchandisingRaw from '../../.agents/skills/resale-merchandising-and-bundling/SKILL.md?raw';
import thermalPrintingRaw from '../../.agents/skills/thermal-label-printing/SKILL.md?raw';

import salesInvariantsRuleRaw from '../../.agents/rules/sales-reconciliation-and-payout-invariants.md?raw';
import coopDemocracyRaw from '../../.agents/skills/democracy-at-work-cooperative/SKILL.md?raw';
import taxComplianceRaw from '../../.agents/skills/tax-and-expense-compliance/SKILL.md?raw';

import socialMarketingRaw from '../../.agents/skills/social-marketing-and-drop-broadcasting/SKILL.md?raw';
import mobileUxRaw from '../../.agents/skills/mobile-ux-standards/SKILL.md?raw';
import daisyUiRaw from '../../.agents/skills/daisyui/SKILL.md?raw';

export interface SkillBundle {
  id: string;
  description: string;
  modules: string[];
  keywords: string[];
  content: string;
}

export const CORE_BUNDLE_ID = 'hucks-resale-core';

function stripFrontmatter(rawContent: string): string {
  const normalized = String(rawContent || '').replace(/\r\n/g, '\n');
  const fmMatch = normalized.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return (fmMatch ? fmMatch[1] : normalized).trim();
}

function joinSections(parts: Array<{ name: string; raw: string }>): string {
  return parts
    .map((p) => `<!-- === MODULE: ${p.name} === -->\n\n${stripFrontmatter(p.raw)}`)
    .join('\n\n---\n\n');
}

export const SKILL_BUNDLES: SkillBundle[] = [
  {
    id: CORE_BUNDLE_ID,
    description:
      'Master system DNA (AGENTS.md + Laws 1–7), Works@TheHC brand & multi-domain identity, 3 Golden Rules, canonical Appwrite warehouse IDs (MD, DT, HG, HH), co-op waterfall rules, and live ACTIVE_SESSION.md summary.',
    modules: ['AGENTS.md', 'hucks-resale-core', 'huckleberry-brand-and-domain-identity', 'ACTIVE_SESSION.md'],
    keywords: [],
    // Keep AGENTS.md FIRST so Core DNA + Laws 1-7 always precede ACTIVE_SESSION.md
    content: joinSections([
      { name: 'AGENTS.md', raw: agentsMdRaw },
      { name: 'huckleberry-brand-and-domain-identity', raw: brandIdentityRaw },
      { name: 'hucks-resale-core', raw: hucksCoreSkillRaw },
      { name: 'ACTIVE_SESSION.md', raw: activeSessionRaw },
    ]),
  },
  {
    id: 'rc-1-scout-vision',
    description:
      'Chat 1 (AI Scout & Vision) bundle: AI architecture & cost optimization, Speed Scout & Deep Scan validation, multi-angle photo slicing, secondary market valuation, and sourcing enrichment.',
    modules: [
      'ai-architecture-and-cost-optimization',
      'ai-scout-and-deep-scan-validation',
      'multi-angle-photo-slicing',
      'secondary-market-appraisal-and-valuation',
      'sourcing-and-ai-enrichment',
    ],
    keywords: [
      'scout',
      'deep scan',
      'vision',
      'ocr',
      'appraisal',
      'valuation',
      'price',
      'auction',
      'shopgoodwill',
      'hibid',
      'ebay',
      'fbmp',
      'facebook',
      'marketplace',
      'negotiat',
      'offer',
      'estate',
      'deal',
      'sourcing',
      'bid',
    ],
    content: joinSections([
      { name: 'ai-architecture-and-cost-optimization', raw: aiArchCostRaw },
      { name: 'ai-scout-and-deep-scan-validation', raw: aiScoutValidationRaw },
      { name: 'multi-angle-photo-slicing', raw: photoSlicingRaw },
      { name: 'secondary-market-appraisal-and-valuation', raw: appraisalValuationRaw },
      { name: 'sourcing-and-ai-enrichment', raw: sourcingEnrichmentRaw },
    ]),
  },
  {
    id: 'rc-2-inventory-splitter',
    description:
      'Chat 2 (Inventory, Drawer & Splitter) bundle: core inventory lifecycle & SKU bucketing, lot profit & exit strategy, UX design system taxonomy, 30 Laws of UX + Krug usability, and Vue 3 SFC standards.',
    modules: [
      'resale-inventory-core',
      'lot-profit-and-exit-strategy',
      'ux-design-system-taxonomy',
      'laws-of-ux',
      'vue-component-standards',
    ],
    keywords: [
      'inventory',
      'lot',
      'split',
      'splitter',
      'drawer',
      'sku',
      'status',
      'vue',
      'component',
      'ui',
      'ux',
      'krug',
      'bundle profit',
      'playbook',
      'anchor',
      'hero',
    ],
    content: joinSections([
      { name: 'resale-inventory-core', raw: inventoryCoreRaw },
      { name: 'lot-profit-and-exit-strategy', raw: lotProfitStrategyRaw },
      { name: 'ux-design-system-taxonomy', raw: uxTaxonomyRaw },
      { name: 'laws-of-ux', raw: lawsOfUxRaw },
      { name: 'vue-component-standards', raw: vueStandardsRaw },
    ]),
  },
  {
    id: 'rc-3-booth-drops',
    description:
      'Chat 3 (Booth Drops & Theme Puller) bundle: haul ingestion SOP, booth sync & UX empathy guardrails, booth merchandising & bundling, and direct thermal label printing (Ricochet POS & Dusty Tiger).',
    modules: [
      'haul-ingestion',
      'resale-booth-sync',
      'resale-merchandising-and-bundling',
      'thermal-label-printing',
    ],
    keywords: [
      'booth',
      'haul',
      'ricochet',
      'barcode',
      'label',
      'thermal',
      'merchandis',
      'bundle',
      'combine',
      'shelf',
      'sync',
    ],
    content: joinSections([
      { name: 'haul-ingestion', raw: haulIngestionRaw },
      { name: 'resale-booth-sync', raw: boothSyncRaw },
      { name: 'resale-merchandising-and-bundling', raw: merchandisingRaw },
      { name: 'thermal-label-printing', raw: thermalPrintingRaw },
    ]),
  },
  {
    id: 'rc-4-sales-coop',
    description:
      'Chat 4 (Sales & Co-op Ledger) bundle: Ricochet POS CSV sales reconciliation & payout invariants, cooperative economics & WSDE waterfall, and IRS tax & expense compliance.',
    modules: [
      'sales-reconciliation-and-payout-invariants',
      'democracy-at-work-cooperative',
      'tax-and-expense-compliance',
    ],
    keywords: [
      'sales',
      'payout',
      'co-op',
      'coop',
      'collective',
      'waterfall',
      'tax',
      'expense',
      'member',
      'hat',
      'promoter',
      'enabler',
      'consignor',
      'settlement',
      'governance',
      'trial',
      'preview',
    ],
    content: joinSections([
      { name: 'sales-reconciliation-and-payout-invariants', raw: salesInvariantsRuleRaw },
      { name: 'democracy-at-work-cooperative', raw: coopDemocracyRaw },
      { name: 'tax-and-expense-compliance', raw: taxComplianceRaw },
    ]),
  },
  {
    id: 'rc-5-social-studio',
    description:
      'Chat 5 (Social Cross-Post & Mobile UI) bundle: social media drop broadcasting & IP guardrails, mobile UX standards (HIG/M3), and DaisyUI v5 + Tailwind v4 component patterns.',
    modules: ['social-marketing-and-drop-broadcasting', 'mobile-ux-standards', 'daisyui'],
    keywords: [
      'social',
      'post',
      'instagram',
      'dropcast',
      'mobile',
      'phone',
      'marketing',
      'daisyui',
      'tailwind',
      'layout',
    ],
    content: joinSections([
      { name: 'social-marketing-and-drop-broadcasting', raw: socialMarketingRaw },
      { name: 'mobile-ux-standards', raw: mobileUxRaw },
      { name: 'daisyui', raw: daisyUiRaw },
    ]),
  },
];

/** Returns up to `max` specialist bundle ids whose keywords appear in the text (core is always added by callers). */
export function matchSkillBundlesForIdea(text: string, max = 2): string[] {
  const hay = (text || '').toLowerCase();
  return SKILL_BUNDLES.filter((b) => b.id !== CORE_BUNDLE_ID)
    .map((b) => ({ id: b.id, score: b.keywords.filter((k) => hay.includes(k)).length }))
    .filter((b) => b.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((b) => b.id);
}

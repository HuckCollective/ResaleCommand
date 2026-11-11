import { databases } from './appwrite';
import { Permission, Role } from 'appwrite';
import { getDatabaseId } from './appwriteEnv';
import { siteConfig } from '../site-config';
import { getCoopMediaUrl } from './coopMedia';
import {
  DEV_AI_IDE_PICKER_BADGE,
  DEV_AI_CHROME_SIDEBAR_BADGE,
  DEV_AI_STUDIO_MODELS_LABEL,
} from './devAiRouting';

export type VaultNoteKind = 'idea' | 'prompt' | 'spec' | 'report';
export type CoopMessageKind = 'bug' | 'ai_report' | 'message';

/** Governance lifecycle. Nothing here ever alters live scan prompts — shipping happens only via Git on alpha-1. */
export type VaultGovernanceStatus = 'pending_review' | 'vetted_for_dev' | 'shipped' | 'rejected';

export type PromptTargetDestination =
  | 'gemini_app'
  | 'chrome_sidebar'
  | 'ai_studio'
  | 'antigravity_ide'
  | 'product_spec';

export type AiSurface = 'quick_scout' | 'deep_scan' | 'playbook' | 'social' | 'general';
export type AiIssueType = 'bad_price' | 'wrong_id_ocr' | 'wrong_playbook' | 'wrong_booth' | 'missed_lot_items' | 'other';
export type AiRootCause = 'missing_photo_info' | 'ignored_visible_clue' | 'msrp_or_comp_bias' | 'channel_mismatch';

export interface VaultRoutingGuide {
  recommendedPresetId: string;
  recommendedPresetTitle: string;
  recommendedDestination: PromptTargetDestination;
  whereToPasteLabel: string;
  aiStudioChatLabel: string;
  modelPickerBadge: string;
  whyThisSurface: string;
  handoffSteps: string[];
}

export interface VaultNote {
  id: string;
  kind: VaultNoteKind;
  title: string;
  body: string;
  done?: boolean;
  isLocked?: boolean;
  isMasterTemplate?: boolean;
  templateId?: string;
  createdAt: string;
  updatedAt: string;
  status?: VaultGovernanceStatus;
  surface?: AiSurface;
  issueType?: AiIssueType;
  rootCause?: AiRootCause;
  author?: string;
  authorEmail?: string;
  messageKind?: CoopMessageKind;
  pageUrl?: string;
  deviceSummary?: string;
  imageId?: string;
  galleryImageIds?: string[];
  upvotedBy?: string[];
  itemContext?: string;
  vettedBy?: string;
  vettedAt?: string;
  destination?: PromptTargetDestination;
  antiBiasAudit?: string;
  draftedFixPrompt?: string;
  coPilotNotes?: string;
  followUpQuestions?: Array<{ question: string; chips: string[] }>;
  bundlesUsed?: string[];
  routingGuide?: VaultRoutingGuide;
}

export interface ParsedItemContextSummary {
  title: string;
  tier?: string;
  priceOrValue?: string;
  verdict?: string;
  whyPayUp?: string;
  whyPass?: string;
  rawText: string;
}

function extractJsonFieldRegex(src: string, key: string): string | undefined {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`"${escaped}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, 'i');
  const m = src.match(re);
  if (!m || !m[1]) return undefined;
  return m[1]
    .replace(/\\"/g, '"')
    .replace(/\\n/g, ' ')
    .replace(/\\\\/g, '\\')
    .trim();
}

/**
 * Parses raw Quick Scout / ItemDrawer context strings or JSON into human-readable summary fields.
 * Resilient even when the 1,500-char snapshot truncated the trailing JSON payload.
 */
export function parseItemContextSummary(raw?: string): ParsedItemContextSummary | null {
  const text = (raw || '').trim();
  if (!text) return null;

  const jsonStart = text.indexOf('{');
  const prefixPart = (jsonStart !== -1 ? text.slice(0, jsonStart) : text)
    .split('|')
    .map((p) => p.trim())
    .filter((p) => p && !/^\d+$/.test(p));

  if (jsonStart !== -1) {
    const jsonSlice = text.slice(jsonStart);
    try {
      const parsed = JSON.parse(jsonSlice);
      const firstItem = Array.isArray(parsed?.items) && parsed.items.length > 0 ? parsed.items[0] : parsed;
      const title =
        firstItem?.title ||
        firstItem?.identity ||
        firstItem?.name ||
        prefixPart[0] ||
        'Attached Scan Snapshot';
      const tier = firstItem?.tier_label || firstItem?.tier || undefined;
      const priceOrValue =
        firstItem?.estimated_value ||
        firstItem?.pricing_potential?.boutique ||
        (firstItem?.resalePrice ? `$${firstItem.resalePrice}` : undefined);
      const verdict = firstItem?.purchase_strategy?.verdict || parsed?.purchase_strategy?.verdict || undefined;
      const whyPayUp = firstItem?.why_pay_up || firstItem?.reason || undefined;
      const whyPass = firstItem?.why_pass || undefined;
      return { title: String(title), tier, priceOrValue, verdict, whyPayUp, whyPass, rawText: text };
    } catch {
      const title =
        extractJsonFieldRegex(jsonSlice, 'title') ||
        extractJsonFieldRegex(jsonSlice, 'identity') ||
        prefixPart[0] ||
        'Attached Scan Snapshot';
      const tier =
        extractJsonFieldRegex(jsonSlice, 'tier_label') ||
        extractJsonFieldRegex(jsonSlice, 'tier') ||
        undefined;
      const priceOrValue =
        extractJsonFieldRegex(jsonSlice, 'estimated_value') ||
        extractJsonFieldRegex(jsonSlice, 'boutique') ||
        undefined;
      const verdict = extractJsonFieldRegex(jsonSlice, 'verdict') || undefined;
      const whyPayUp =
        extractJsonFieldRegex(jsonSlice, 'why_pay_up') ||
        extractJsonFieldRegex(jsonSlice, 'reason') ||
        undefined;
      const whyPass = extractJsonFieldRegex(jsonSlice, 'why_pass') || undefined;
      return { title, tier, priceOrValue, verdict, whyPayUp, whyPass, rawText: text };
    }
  }

  return {
    title: prefixPart[0]?.slice(0, 120) || 'Attached Item Snapshot',
    priceOrValue:
      prefixPart[1]?.startsWith('$') || /^\d/.test(prefixPart[1] || '') ? prefixPart[1] : undefined,
    whyPayUp: prefixPart.slice(1).join(' • ').slice(0, 260) || undefined,
    rawText: text,
  };
}

export const FOUNDER_VAULT_DOC_ID = 'founder_vault_notes_v1';
const MANIFESTS_COL_ID = 'manifests';
const LOCAL_KEY = 'rc_founder_vault_v1';

export const VAULT_KIND_META: Record<VaultNoteKind, { icon: string; label: string }> = {
  report: { icon: '🚩', label: 'AI / Bug Report' },
  idea: { icon: '💡', label: 'Idea / Message' },
  prompt: { icon: '📋', label: 'Prompt' },
  spec: { icon: '📌', label: 'Spec' },
};

export const COOP_MESSAGE_KIND_META: Record<CoopMessageKind, { icon: string; label: string; badge: string }> = {
  bug: { icon: '🐞', label: 'UI / App Bug', badge: 'badge-error' },
  ai_report: { icon: '🤖', label: 'AI Scan Flag', badge: 'badge-warning' },
  message: { icon: '💬', label: 'Steward Message', badge: 'badge-info' },
};

export function resolveNoteMessageKind(note: Partial<VaultNote>): CoopMessageKind {
  if (note.messageKind) return note.messageKind;
  if (note.kind === 'report') {
    if (/^🐞|bug:/i.test(note.title || '')) return 'bug';
    return 'ai_report';
  }
  return 'message';
}

export function canUserEditVaultNote(
  note: Partial<VaultNote> | null | undefined,
  opts: { userEmail?: string; userName?: string; isFounder?: boolean }
): boolean {
  if (!note) return false;
  if (opts.isFounder) return true;
  if (
    note.authorEmail &&
    opts.userEmail &&
    note.authorEmail.trim().toLowerCase() === opts.userEmail.trim().toLowerCase()
  ) {
    return true;
  }
  const clean = (s?: string) => String(s || '').replace(/\(.*?\)/g, '').trim().toLowerCase();
  const a = clean(note.author);
  const u = clean(opts.userName);
  return Boolean(a && u && (a === u || a.split(/\s+/)[0] === u.split(/\s+/)[0]));
}

export const GOVERNANCE_META: Record<VaultGovernanceStatus, { icon: string; label: string; badge: string }> = {
  pending_review: { icon: '🟡', label: 'Pending Review', badge: 'badge-warning' },
  vetted_for_dev: { icon: '🟣', label: 'Vetted for Dev', badge: 'badge-secondary' },
  shipped: { icon: '🟢', label: 'Shipped in Git', badge: 'badge-success' },
  rejected: { icon: '⚪', label: 'Rejected', badge: 'badge-ghost' },
};

export const DESTINATION_META: Record<PromptTargetDestination, { icon: string; label: string }> = {
  gemini_app: { icon: '📱', label: 'Gemini App (Phone)' },
  chrome_sidebar: { icon: '🌐', label: 'Chrome Sidebar' },
  ai_studio: { icon: '🧪', label: 'AI Studio' },
  antigravity_ide: { icon: '🎯', label: 'Antigravity IDE' },
  product_spec: { icon: '📌', label: 'Master Spec' },
};

export const AI_SURFACE_LABELS: Record<AiSurface, string> = {
  quick_scout: '⚡ Quick Scout',
  deep_scan: '🔍 Deep Scan',
  playbook: '🧭 Lot Playbook',
  social: '📣 Social Copy',
  general: '🧰 Other',
};

export const AI_ISSUE_LABELS: Record<AiIssueType, string> = {
  bad_price: '💰 Price / MSRP bias',
  wrong_id_ocr: '🏷️ Wrong item / OCR',
  wrong_playbook: '🧭 Wrong playbook',
  wrong_booth: '🏢 Wrong booth routing',
  missed_lot_items: '📦 Missed lot items / crop',
  other: '❓ Something else',
};

export const AI_ROOT_CAUSE_LABELS: Record<AiRootCause, string> = {
  missing_photo_info: '📷 Clue was not visible in the photo',
  ignored_visible_clue: '🔎 AI ignored a visible clue',
  msrp_or_comp_bias: '📊 Anchored to retail MSRP / bad comp',
  channel_mismatch: '🧭 Good item, wrong channel',
};

export interface PlaybookPresetItem {
  id: string;
  icon: string;
  title: string;
  summary: string;
  destination: PromptTargetDestination;
  bundles: string[];
  defaultGoal: string;
  masterPromptBody: string;
  locked: true;
}

/**
 * Canonical 5 Locked & Governed Master Templates.
 * These are NEVER injected as editable clutter in the user's card grid.
 * Members can 1-Tap Copy or Clone to a New Card; Founders must unlock a 2-step governance guard to edit a master template.
 */
export const PLAYBOOK_PRESETS: PlaybookPresetItem[] = [
  {
    id: 'ide-surgical-builder',
    icon: '🎯',
    title: 'Antigravity IDE: Surgical Bug Fix & Feature',
    summary:
      'Turns an AI Report, UI bug, or feature note (e.g., saving Quick Scout estimate range cards) into a 1-shot surgical Antigravity IDE prompt with Model Picker & 3-file lock.',
    destination: 'antigravity_ide',
    bundles: ['rc-1-scout-vision', 'rc-2-inventory-splitter'],
    defaultGoal:
      'Turn this issue description into a surgical Antigravity IDE prompt (with Model Picker header, ALLOWED FILES max 3, MAX TOOL CALLS: 3, FORBIDDEN ACTIONS, and alpha-1 verify + push) that fixes the bug or builds the feature cleanly.',
    masterPromptBody: [
      DEV_AI_IDE_PICKER_BADGE,
      '',
      'TASK: Fix or enhance the following Resale Command workflow on branch `alpha-1`:',
      '- Issue / Feature Goal: [Describe what is not saving, displaying, or working as expected — e.g., preserve Quick Scout estimated value range cards on the tracked Inventory Item so the human curator can see and play with the price range in the Item Drawer].',
      '',
      'STRICT CONSTRAINTS:',
      '- ALLOWED FILES (MAX 3): Identify the exact 1-3 files first (e.g., `src/components/scout/ScoutView.vue`, `src/components/inventory/ItemDetailsTab.vue`, `src/types/inventory.ts`).',
      '- MAX TOOL CALLS: 3 edit calls after targeted line-range reads.',
      '- FORBIDDEN ACTIONS: Never run `astro build` or `npm run build` locally; never write `quantity: 0` or Base64 to Appwrite; never mutate unrelated functions.',
      '- VERIFY & PUSH: Run `npm run verify` via `run_command` (`BypassSandbox: true`) and push to `origin HEAD` (`alpha-1`).',
    ].join('\n'),
    locked: true,
  },
  {
    id: 'paired-qa',
    icon: '🧪',
    title: 'Chrome Sidebar: Paired Human-AI Live Page QA',
    summary:
      'Step-by-step live DOM verification in Chrome Gemini Sidebar with pre-click checklists and 4-line status reports for Antigravity IDE.',
    destination: 'chrome_sidebar',
    bundles: ['rc-2-inventory-splitter', 'rc-5-social-studio'],
    defaultGoal:
      `Create a step-by-step Paired Human-AI Chrome Sidebar QA prompt to test our latest feature on ${siteConfig.alphaSiteUrl} one page at a time.`,
    masterPromptBody: [
      `🌐 OPEN PAGE FIRST: ${siteConfig.alphaSiteUrl}/coop/vault`,
      '',
      `You are my paired QA AI Ally for ${siteConfig.title} on ${siteConfig.alphaSiteUrl}. Report strictly what you SEE in the live DOM — never guess code.`,
      '',
      'HOW THIS SESSION WORKS:',
      '- Run ONE step at a time. For each step: (1) tell me the exact URL to open, (2) give me a short PRE-CLICK checklist of what to open/expand BEFORE pressing Enter, (3) grade what you see (PASS / FAIL / CANNOT TELL), and (4) give me the next step.',
      '- Flag any clipped buttons, mobile overflow, or unverified AI price/edition claims.',
      '',
      'AFTER EACH STEP, OUTPUT THIS 4-LINE COPY-PASTE BLOCK:',
      'URL | Step # | Checks: PASS n / FAIL n',
      'State Seen (active tab, cards, badges, counts)',
      'Any UI / UX or Bias Issues Found',
      'Next Step URL + Pre-Click Checklist',
    ].join('\n'),
    locked: true,
  },
  {
    id: 'auction-sweeper',
    icon: '🔭',
    title: 'Chrome Sidebar: Whole-Page Auction Grid Sweeper',
    summary:
      'Scans 24–50 ShopGoodwill, HiBid, or eBay search lots in Chrome Sidebar and ranks the Top 3–5 sleeper lots where 1 Anchor item recoups your bid.',
    destination: 'chrome_sidebar',
    bundles: ['rc-1-scout-vision', 'rc-2-inventory-splitter'],
    defaultGoal:
      'Scan this entire auction search results page and rank the top 3-5 sleeper lots worth clicking for our booths, factoring in shipping drag, buyer premium, and 1-anchor cost recovery.',
    masterPromptBody: [
      '🌐 OPEN PAGE FIRST: the auction / search-results page (ShopGoodwill, HiBid, EstateSales.net, eBay search) with the full grid of lots visible. Scroll once so every lot loads BEFORE you press Enter (the sidebar reads the page at the moment you press Enter).',
      '',
      'You are my resale deal-hunting AI Ally for The Huckleberry Collective. Look at EVERY lot on this page and tell me which 3-5 are worth clicking into, and which to skip.',
      '',
      'My venues: a vintage-mall booth (goth, whimsigoth, TTRPG/RPG books, metaphysical, sci-fi, punk, horror, adventure, cosplay) and a small-collectibles booth (jewelry, pins, wands/arcana under 8 inches; NO apparel, NO large toys).',
      "Rules: value ONLY from secondary-market sold comps, never retail MSRP. Prefer lots where ONE anchor item can recoup 80-120% of the landed cost. Include buyer's premium and shipping weight in landed cost. Do not invent items you cannot read in the photos or titles.",
      '',
      'For each pick give: lot title, why it is a sleeper, the likely anchor item, max bid ceiling, and the booth it fits. Then list 2-3 lots to SKIP (shipping traps, MSRP-priced, unclear photos).',
      'End with 2 short questions about my budget and which booth needs stock, so we can refine.',
      'Reply in a 5-line status block: URL | lots scanned | top picks | skips | next question.',
    ].join('\n'),
    locked: true,
  },
  {
    id: 'fbmp-coach',
    icon: '🤝',
    title: 'Gemini App: Local Deal & Offer-Ladder Coach',
    summary:
      'Builds an Opening Anchor -> Walk-Away Offer Ladder, 3 non-tip-off seller questions, and 3 copy-paste DM negotiation scripts.',
    destination: 'gemini_app',
    bundles: ['rc-1-scout-vision', 'rc-3-booth-drops'],
    defaultGoal:
      'Evaluate a Facebook Marketplace / Craigslist local pickup listing, give me an Opening Anchor to Walk-Away Offer Ladder, 3 non-tip-off inspection questions, and 3 copy-paste DM scripts.',
    masterPromptBody: [
      'You are my resale negotiation AI Ally. I will paste a Facebook Marketplace / Craigslist / OfferUp listing (text, link, or screenshot).',
      '',
      'Do this, phone-friendly (short bullets):',
      '1) What it likely is and a realistic cash resale range from sold comps (never MSRP). Say what you cannot verify from the photos.',
      '2) OFFER LADDER: opening cash anchor, target price, hard walk-away ceiling. Pick the ceiling so one anchor item recoups 100% of my cash outlay.',
      '3) THREE non-tip-off questions to ask the seller about condition/completeness.',
      '4) THREE copy-paste DM scripts: "cash pickup today", "bundle both posts", and "condition counter-offer".',
      '5) Red flags that mean walk away.',
      '',
      'My venues: a vintage-mall booth (goth, TTRPG, metaphysical, sci-fi, punk, horror) and a small-collectibles booth (under 8 inches, no apparel). Tell me which booth it fits.',
      'Give your recommendation first, then ask me 1-2 sharp follow-ups.',
    ].join('\n'),
    locked: true,
  },
  {
    id: 'estate-triage',
    icon: '🧭',
    title: 'Gemini App: Estate Table / Booth Pile Triage',
    summary:
      'Use your phone camera in Gemini App to scan a whole table or shelf of items, spot the highest-margin pieces, and suggest a bundle offer.',
    destination: 'gemini_app',
    bundles: ['rc-1-scout-vision', 'rc-2-inventory-splitter'],
    defaultGoal:
      'I am at an estate sale / flea market looking at a table of items. Help me spot the highest-margin pieces from my photo, flag any reprints/traps, and suggest a single cash bundle offer for the pile.',
    masterPromptBody: [
      'You are my field-sourcing AI Ally for The Huckleberry Collective. I am uploading a photo of an estate sale table, thrift shelf, or flea market pile.',
      '',
      '1) Spot the top 2-4 highest-margin pieces visible in the photo (valued strictly from secondary-market sold comps, never retail MSRP).',
      '2) Flag any common reproduction traps or condition risks to check in person before paying.',
      '3) Suggest a single cash bundle offer for the group where 1 anchor piece recoups 100% of the outlay.',
      '4) Tell me which booth each piece fits (Memory Den #0EJ vs. Dusty Tiger <8" collectibles).',
    ].join('\n'),
    locked: true,
  },
];

/** Clones a Locked Master Template into a brand-new, freely editable VaultNote card. */
export function clonePresetToNewNote(preset: PlaybookPresetItem): VaultNote {
  const now = new Date().toISOString();
  return {
    id: newVaultNoteId(),
    kind: 'prompt',
    title: `${preset.icon} ${preset.title} (Custom Copy)`,
    body: preset.masterPromptBody,
    destination: preset.destination,
    bundlesUsed: [...preset.bundles],
    templateId: preset.id,
    isLocked: false,
    isMasterTemplate: false,
    createdAt: now,
    updatedAt: now,
  };
}

/** Opens a Master Template in Locked Governance Mode (for Founder inspection). */
export function buildLockedMasterTemplateNote(preset: PlaybookPresetItem): VaultNote {
  const now = new Date().toISOString();
  return {
    id: `master-template-${preset.id}`,
    kind: 'prompt',
    title: `${preset.icon} ${preset.title}`,
    body: preset.masterPromptBody,
    destination: preset.destination,
    bundlesUsed: [...preset.bundles],
    templateId: preset.id,
    isLocked: true,
    isMasterTemplate: true,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Builds the full AI Ally input brief from a VaultNote so the user's Issue Description (`body`),
 * Title, Root Cause, and Attached Scan Snapshot automatically feed the Prompt Builder.
 */
export function buildCoPilotBriefFromNote(note: Partial<VaultNote>): string {
  const title = (note.title || '').trim();
  const body = (note.body || '').trim();
  const lines: string[] = [];

  const mediaIds = Array.from(
    new Set([note.imageId, ...(note.galleryImageIds || [])].filter((id): id is string => Boolean(id && !id.startsWith('data:'))))
  );
  const mediaUrls = mediaIds.map((id) => getCoopMediaUrl(id, { preview: false })).filter(Boolean);

  if (note.kind === 'report') {
    lines.push(
      'TASK: Analyze this reported Resale Command issue / feature request, run a 3-Point Anti-Bias Audit, and build a ready-to-paste prompt for the target surface.'
    );
    if (title) lines.push(`Card Title: ${title}`);
    if (note.pageUrl) lines.push(`Page Route: ${note.pageUrl}`);
    if (note.deviceSummary) lines.push(`Viewport / Device: ${note.deviceSummary}`);
    if (note.surface) lines.push(`Reported Surface: ${AI_SURFACE_LABELS[note.surface]}`);
    if (note.issueType) lines.push(`Issue Category: ${AI_ISSUE_LABELS[note.issueType]}`);
    if (note.rootCause) lines.push(`Reporter Root Cause: ${AI_ROOT_CAUSE_LABELS[note.rootCause]}`);
    if (body) lines.push(`User Issue Description & Expected Behavior:\n"${body}"`);
    const parsed = parseItemContextSummary(note.itemContext);
    if (parsed) {
      lines.push(
        `Attached Scan Snapshot: ${parsed.title}${parsed.tier ? ` (${parsed.tier})` : ''}${parsed.priceOrValue ? ` • Est: ${parsed.priceOrValue}` : ''}${parsed.verdict ? ` • Verdict: ${parsed.verdict}` : ''}`
      );
    }
    if (mediaUrls.length > 0) {
      lines.push(`Attached Screenshots (${mediaUrls.length}):\n${mediaUrls.map((u, idx) => `  [${idx + 1}] ${u}`).join('\n')}`);
    }
    return lines.join('\n');
  }

  const extraFooter = [
    note.pageUrl ? `Page Route: ${note.pageUrl}` : '',
    mediaUrls.length > 0 ? `Attached Screenshots:\n${mediaUrls.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  if (title && body && body !== title) {
    return `${title}\n\nDetails / Goal:\n${body}${extraFooter ? `\n\n${extraFooter}` : ''}`;
  }
  return `${body || title}${extraFooter ? `\n\n${extraFooter}` : ''}`;
}

/**
 * Inspects a VaultNote's description, surface, and kind to auto-recommend:
 * 1) Which Locked Master Template (`presetId`) matches best
 * 2) Which Target AI Surface (`antigravity_ide`, `ai_studio`, `chrome_sidebar`, `gemini_app`) to use
 * 3) Which Focused AI Studio Chat (#1–#5) and Skill Bundles apply
 * 4) Clear 1-2-3 Handoff Instructions on where & how to paste the generated prompt
 */
export function recommendVaultTemplateAndSurface(
  note: Partial<VaultNote>,
  overrideDestination?: PromptTargetDestination
): VaultRoutingGuide & { recommendedBundles: string[] } {
  const combined = `${note.title || ''} ${note.body || ''} ${note.itemContext || ''}`.toLowerCase();

  // 1. Auto-match Skill Bundles based on surface + keywords
  const bundles = new Set<string>();
  if (
    note.surface === 'quick_scout' ||
    note.surface === 'deep_scan' ||
    /scout|scan|price|msrp|estimate|comp|valuation|ocr|vision|comic|tier/.test(combined)
  ) {
    bundles.add('rc-1-scout-vision');
  }
  if (
    note.surface === 'playbook' ||
    /track|saved|save|drawer|lot|split|bundle|card|inventory|item|range/.test(combined)
  ) {
    bundles.add('rc-2-inventory-splitter');
  }
  if (/booth|memory den|0ej|ricochet|dusty tiger|label|barcode|tag|huck-/.test(combined)) {
    bundles.add('rc-3-booth-drops');
  }
  if (/sale|payout|ledger|coop|co-op|70\/30|waterfall|rent|expense|tax|charter|member/.test(combined)) {
    bundles.add('rc-4-sales-coop');
  }
  if (note.surface === 'social' || /social|dropcast|mobile|layout|button|ux|ui|daisyui/.test(combined)) {
    bundles.add('rc-5-social-studio');
  }
  if (bundles.size === 0) {
    bundles.add('rc-1-scout-vision');
    bundles.add('rc-2-inventory-splitter');
  }
  const recommendedBundles = Array.from(bundles).slice(0, 2);

  // 2. Pick the matching Focused Google AI Studio Chat (#1-#5)
  let aiStudioChatLabel = 'Chat 1: RC - AI Scout & Vision';
  if (bundles.has('rc-2-inventory-splitter') && /track|save|drawer|card|lot|split|inventory/.test(combined)) {
    aiStudioChatLabel = 'Chat 2: RC - Inventory, Drawer & Splitter';
  } else if (bundles.has('rc-3-booth-drops')) {
    aiStudioChatLabel = 'Chat 3: RC - Booth Drops & Theme Puller';
  } else if (bundles.has('rc-4-sales-coop')) {
    aiStudioChatLabel = 'Chat 4: RC - Sales & Co-op Ledger';
  } else if (bundles.has('rc-5-social-studio')) {
    aiStudioChatLabel = 'Chat 5: RC - Social Dropcast Studio';
  }

  // 3. Auto-detect Playbook Master Template & Target Surface
  let recommendedPresetId = 'ide-surgical-builder';
  let detectedDestination: PromptTargetDestination = 'antigravity_ide';

  if (/shopgoodwill|hibid|auction grid|whole-page|search results|lots on this page/.test(combined)) {
    recommendedPresetId = 'auction-sweeper';
    detectedDestination = 'chrome_sidebar';
  } else if (/facebook marketplace|fbmp|craigslist|offerup|negotiate|offer ladder|dm script/.test(combined)) {
    recommendedPresetId = 'fbmp-coach';
    detectedDestination = 'gemini_app';
  } else if (/estate sale|flea market|thrift pile|table of items/.test(combined)) {
    recommendedPresetId = 'estate-triage';
    detectedDestination = 'gemini_app';
  } else if (/paired.*qa|chrome sidebar qa|live page qa|pre-click checklist/.test(combined)) {
    recommendedPresetId = 'paired-qa';
    detectedDestination = 'chrome_sidebar';
  } else if (note.kind === 'spec') {
    recommendedPresetId = 'ide-surgical-builder';
    detectedDestination = 'product_spec';
  } else if (
    note.kind === 'report' ||
    /save|saved|track|estimate|card|drawer|button|bug|fix|broken|missing|prompt|bias|msrp|ui|ux/.test(combined)
  ) {
    recommendedPresetId = 'ide-surgical-builder';
    detectedDestination = 'antigravity_ide';
  }

  const finalDestination = overrideDestination || detectedDestination;
  const presetObj =
    PLAYBOOK_PRESETS.find((p) => p.id === recommendedPresetId) || PLAYBOOK_PRESETS[0];

  // 4. Build destination-specific Model Picker Badge & 1-2-3 Handoff Instructions
  if (finalDestination === 'antigravity_ide') {
    return {
      recommendedPresetId: presetObj.id,
      recommendedPresetTitle: presetObj.title,
      recommendedDestination: 'antigravity_ide',
      whereToPasteLabel: '🎯 Paste into Antigravity IDE (Active Branch: alpha-1)',
      aiStudioChatLabel,
      modelPickerBadge: DEV_AI_IDE_PICKER_BADGE,
      whyThisSurface:
        'This issue describes app behavior, UI state, or scan persistence (e.g., saving Quick Scout estimate range cards when tracking an item) that can be fixed directly in the repo on alpha-1.',
      handoffSteps: [
        '1. Click "📋 Copy IDE Prompt" below.',
        '2. In Antigravity IDE, start a fresh chat (or run /compact) and pick "Gemini 4 Argon (Medium)" for standard edits, "Gemini 4 Carbon (Medium/High)" for /plan or tricky multi-file code, or "Gemini 3.8 Flash" for read-only recon.',
        `3. Paste and press Enter — or if you want to brainstorm UX options first, switch Target Surface to "🧪 AI Studio" and paste into "${aiStudioChatLabel}".`,
      ],
      recommendedBundles,
    };
  }

  if (finalDestination === 'ai_studio') {
    return {
      recommendedPresetId: presetObj.id,
      recommendedPresetTitle: presetObj.title,
      recommendedDestination: 'ai_studio',
      whereToPasteLabel: `🧪 Paste into Google AI Studio — ${aiStudioChatLabel}`,
      aiStudioChatLabel,
      modelPickerBadge: `🧪 OPEN AI STUDIO: ${aiStudioChatLabel} (${DEV_AI_STUDIO_MODELS_LABEL})`,
      whyThisSurface:
        'Best when you want to explore UX alternatives, co-design a multi-file workflow, and build up a SAVED MASTER SPEC & IDE QUEUE before writing code in Antigravity IDE.',
      handoffSteps: [
        `1. Open Google AI Studio and select "${aiStudioChatLabel}".`,
        '2. Click "📋 Copy Prompt" below and paste it into the chat.',
        '3. Answer the 2-3 follow-up questions, then copy the final IDE prompt block back into Antigravity IDE.',
      ],
      recommendedBundles,
    };
  }

  if (finalDestination === 'chrome_sidebar') {
    return {
      recommendedPresetId: presetObj.id,
      recommendedPresetTitle: presetObj.title,
      recommendedDestination: 'chrome_sidebar',
      whereToPasteLabel: '🌐 Paste into Chrome Gemini Sidebar (Reading Live Webpage)',
      aiStudioChatLabel,
      modelPickerBadge: DEV_AI_CHROME_SIDEBAR_BADGE,
      whyThisSurface:
        `Best when your AI Ally needs to inspect the live browser DOM (either sweeping 24-50 auction lots or running Paired Human-AI QA on ${siteConfig.alphaSiteUrl}).`,
      handoffSteps: [
        '1. Open the target webpage in Chrome and complete the Pre-Click / Scroll step first (the sidebar snapshots the DOM when you press Enter).',
        '2. Open the Chrome Gemini Sidebar in the top-right of Chrome.',
        '3. Click "📋 Copy Prompt" and paste it into the sidebar.',
      ],
      recommendedBundles,
    };
  }

  if (finalDestination === 'product_spec') {
    return {
      recommendedPresetId: presetObj.id,
      recommendedPresetTitle: presetObj.title,
      recommendedDestination: 'product_spec',
      whereToPasteLabel: '📌 Keep in Vault as Master Spec (or Paste into Antigravity IDE)',
      aiStudioChatLabel,
      modelPickerBadge: '📌 MASTER SPEC + IDE TASK QUEUE',
      whyThisSurface:
        'Formats your idea into a clean, mobile-scannable Product Spec with acceptance criteria and an ordered Antigravity IDE implementation queue.',
      handoffSteps: [
        '1. Review the generated Product Spec & Acceptance Criteria in the card.',
        '2. Copy individual tasks from the IDE Task Queue at the bottom into Antigravity IDE (`Gemini 4 Argon (Medium)` or `Gemini 4 Carbon (Medium)`).',
        '3. Mark the card "Vetted for Dev" or "Shipped in Git" once verified on alpha-1.',
      ],
      recommendedBundles,
    };
  }

  return {
    recommendedPresetId: presetObj.id,
    recommendedPresetTitle: presetObj.title,
    recommendedDestination: 'gemini_app',
    whereToPasteLabel: '📱 Paste into Gemini App (Phone or gemini.google.com/app)',
    aiStudioChatLabel,
    modelPickerBadge: '📱 GEMINI APP (Phone Camera / Voice / Quick Chat)',
    whyThisSurface:
      'Phone-friendly interactive AI Ally for evaluating deals in the field, negotiating FBMP/local pickups, or voice-brainstorming on the go.',
    handoffSteps: [
      '1. Click "📋 Copy Prompt" below.',
      '2. Open the Gemini App on your phone (or gemini.google.com/app) and paste the prompt.',
      '3. Attach your listing screenshot or table photo and reply to the 1-2 follow-up questions.',
    ],
    recommendedBundles,
  };
}

/** Legacy auto-seeded starter IDs that should be pruned so they don't clutter the user's Vault Cards grid. */
const LEGACY_CLUTTER_STARTER_IDS = new Set([
  'starter-preview-trial',
  'starter-mobile-addon',
  'starter-auction-sweeper',
  'starter-fbmp-coach',
  'starter-paired-qa-sidebar',
  'starter-ide-surgical-builder',
]);

export const STARTER_VAULT_NOTES: VaultNote[] = [];

export function newVaultNoteId(): string {
  return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Reports and ideas default to pending review; other kinds have no governance state unless set. */
export function effectiveStatus(note: VaultNote): VaultGovernanceStatus | undefined {
  if (note.status) return note.status;
  return note.kind === 'report' || note.kind === 'idea' ? 'pending_review' : undefined;
}

export function toggleUpvote(note: VaultNote, memberName: string): void {
  const who = memberName || 'member';
  const set = new Set(note.upvotedBy || []);
  if (set.has(who)) set.delete(who);
  else set.add(who);
  note.upvotedBy = Array.from(set);
  note.updatedAt = new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Ops cost & token impact estimator (pure; used by the Prompt Maker UI + API)
// ---------------------------------------------------------------------------

/** Rough planning rate (USD per 1M input tokens) for a Gemini Flash-class model. Update if pricing changes. */
export const EST_INPUT_USD_PER_MILLION_TOKENS = 0.3;
/** Monthly Google Cloud Gen AI credit pool used for the "% of credit" estimate. */
export const EST_MONTHLY_CREDIT_USD = 40;
export const EST_DEFAULT_SCANS_PER_MONTH = 1500;

export type BloatRating = 'lean' | 'moderate' | 'heavy';

export interface PromptOpsImpact {
  addedTokens: number;
  costPer1kScansUsd: number;
  monthlyCostUsd: number;
  pctOfMonthlyCredit: number;
  bloatRating: BloatRating;
  recommendation: string;
}

export function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4);
}

export function estimatePromptOpsImpact(
  addedText: string,
  scansPerMonth = EST_DEFAULT_SCANS_PER_MONTH
): PromptOpsImpact {
  const addedTokens = estimateTokens(addedText);
  const costPerScan = (addedTokens / 1_000_000) * EST_INPUT_USD_PER_MILLION_TOKENS;
  const costPer1kScansUsd = costPerScan * 1000;
  const monthlyCostUsd = costPerScan * scansPerMonth;
  const pctOfMonthlyCredit = EST_MONTHLY_CREDIT_USD > 0 ? (monthlyCostUsd / EST_MONTHLY_CREDIT_USD) * 100 : 0;
  const bloatRating: BloatRating = addedTokens < 80 ? 'lean' : addedTokens <= 250 ? 'moderate' : 'heavy';
  const recommendation =
    bloatRating === 'lean'
      ? 'Lean — safe to merge.'
      : bloatRating === 'moderate'
        ? 'Moderate — replace or tighten an older phrase instead of only appending.'
        : 'Heavy — consolidate with existing rules before making this permanent.';
  return { addedTokens, costPer1kScansUsd, monthlyCostUsd, pctOfMonthlyCredit, bloatRating, recommendation };
}

export const BLOAT_BADGE: Record<BloatRating, { icon: string; badge: string }> = {
  lean: { icon: '🟢', badge: 'badge-success' },
  moderate: { icon: '🟡', badge: 'badge-warning' },
  heavy: { icon: '🔴', badge: 'badge-error' },
};

// ---------------------------------------------------------------------------
// Persistence (Appwrite manifests doc + localStorage mirror)
// ---------------------------------------------------------------------------

function pruneLegacyStarterClutter(list: VaultNote[]): { cleaned: VaultNote[]; removedAny: boolean } {
  const cleaned = list.filter((n) => !LEGACY_CLUTTER_STARTER_IDS.has(n.id));
  return { cleaned, removedAny: cleaned.length !== list.length };
}

function readLocal(): VaultNote[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return pruneLegacyStarterClutter(parsed).cleaned;
  } catch {
    return [];
  }
}

function writeLocal(notes: VaultNote[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(notes));
  } catch {
    // ignore quota errors
  }
}

export async function loadVaultNotes(): Promise<{ notes: VaultNote[]; synced: boolean }> {
  const local = readLocal();
  try {
    const doc: any = await databases.getDocument(getDatabaseId(), MANIFESTS_COL_ID, FOUNDER_VAULT_DOC_ID);
    const parsed = JSON.parse(doc.itemsSnapshot || '{}');
    const cloud: VaultNote[] = Array.isArray(parsed.notes) ? parsed.notes : local;
    const { cleaned, removedAny } = pruneLegacyStarterClutter(cloud);
    writeLocal(cleaned);
    if (removedAny) {
      const ok = await saveVaultNotes(cleaned);
      return { notes: cleaned, synced: ok };
    }
    return { notes: cleaned, synced: true };
  } catch (err: any) {
    if (err?.code === 404) {
      const ok = await saveVaultNotes(local);
      return { notes: local, synced: ok };
    }
    return { notes: local, synced: false };
  }
}

export async function saveVaultNotes(notes: VaultNote[]): Promise<boolean> {
  const { cleaned } = pruneLegacyStarterClutter(notes);
  writeLocal(cleaned);
  const dbId = getDatabaseId();
  const payload = {
    name: 'Founder Idea & Prompt Vault',
    tenantId: 'huck_collective',
    locationId: 'FOUNDER_VAULT',
    locationName: 'Founder Vault',
    status: 'vault_state',
    itemsSnapshot: JSON.stringify({ notes: cleaned, updatedAt: new Date().toISOString() }),
    itemCount: cleaned.length,
    notes: JSON.stringify({ noteCount: cleaned.length }),
  };
  try {
    try {
      await databases.updateDocument(dbId, MANIFESTS_COL_ID, FOUNDER_VAULT_DOC_ID, payload);
    } catch (updateErr: any) {
      if (updateErr?.code !== 404) throw updateErr;
      await databases.createDocument(dbId, MANIFESTS_COL_ID, FOUNDER_VAULT_DOC_ID, payload, [
        Permission.read(Role.any()),
        Permission.update(Role.any()),
        Permission.delete(Role.any()),
      ]);
    }
    return true;
  } catch (err) {
    console.warn('[founderVault] Appwrite sync fallback to localStorage:', err);
    return false;
  }
}

/**
 * Appends a community report to the vault as `pending_review`.
 * Re-reads the cloud state first so concurrent members do not overwrite each other's notes.
 * NEVER touches live scan prompts.
 */
export async function submitAiFeedbackReport(input: {
  surface: AiSurface;
  issueType: AiIssueType;
  rootCause: AiRootCause;
  note: string;
  title?: string;
  messageKind?: CoopMessageKind;
  pageUrl?: string;
  deviceSummary?: string;
  imageId?: string;
  galleryImageIds?: string[];
  itemContext?: string;
  author?: string;
  authorEmail?: string;
}): Promise<{ saved: boolean; synced: boolean; note: VaultNote }> {
  const { notes } = await loadVaultNotes();
  const now = new Date().toISOString();
  const cleanGallery = (input.galleryImageIds || []).filter((id) => Boolean(id && !id.startsWith('data:')));
  const coverId = input.imageId && !input.imageId.startsWith('data:') ? input.imageId : cleanGallery[0];
  const msgKind: CoopMessageKind = input.messageKind || 'ai_report';
  const defaultTitle =
    msgKind === 'bug'
      ? `🐞 Bug${input.pageUrl ? ` (${input.pageUrl})` : ''}: ${input.note.trim().split('\n')[0].slice(0, 64)}`
      : msgKind === 'message'
        ? `💬 Message: ${input.note.trim().split('\n')[0].slice(0, 68)}`
        : `${AI_SURFACE_LABELS[input.surface]}: ${AI_ISSUE_LABELS[input.issueType]}`;
  const finalTitle = (input.title || '').trim() || defaultTitle;
  const noteKind: VaultNoteKind = msgKind === 'message' ? 'idea' : 'report';

  const draftNote: Partial<VaultNote> = {
    kind: noteKind,
    messageKind: msgKind,
    title: finalTitle,
    body: input.note.trim(),
    surface: input.surface,
    issueType: input.issueType,
    rootCause: input.rootCause,
    pageUrl: input.pageUrl,
    deviceSummary: input.deviceSummary,
    imageId: coverId,
    galleryImageIds: cleanGallery,
    itemContext: input.itemContext?.slice(0, 1500),
  };
  const routing = recommendVaultTemplateAndSurface(draftNote);
  const report: VaultNote = {
    id: newVaultNoteId(),
    kind: noteKind,
    messageKind: msgKind,
    title: finalTitle,
    body: input.note.trim(),
    status: 'pending_review',
    surface: input.surface,
    issueType: msgKind === 'ai_report' ? input.issueType : undefined,
    rootCause: msgKind === 'ai_report' ? input.rootCause : undefined,
    pageUrl: input.pageUrl,
    deviceSummary: input.deviceSummary,
    imageId: coverId,
    galleryImageIds: cleanGallery,
    author: input.author,
    authorEmail: input.authorEmail,
    itemContext: input.itemContext?.slice(0, 1500),
    destination: routing.recommendedDestination,
    bundlesUsed: routing.recommendedBundles,
    routingGuide: routing,
    upvotedBy: input.author ? [input.author] : [],
    createdAt: now,
    updatedAt: now,
  };
  const synced = await saveVaultNotes([report, ...notes]);
  return { saved: true, synced, note: report };
}

/**
 * Convenience helper for submitting a UI/App Bug Report or Co-op Steward Message (with optional screenshots)
 * from the Bottom-Sheet Detent List Tray (`CoopMessagesTray.vue`) or Navbar.
 */
export async function submitCoopBugOrMessage(input: {
  messageKind: CoopMessageKind;
  title?: string;
  body: string;
  pageUrl?: string;
  deviceSummary?: string;
  imageId?: string;
  galleryImageIds?: string[];
  surface?: AiSurface;
  issueType?: AiIssueType;
  rootCause?: AiRootCause;
  itemContext?: string;
  author?: string;
  authorEmail?: string;
}): Promise<{ saved: boolean; synced: boolean; note: VaultNote }> {
  return submitAiFeedbackReport({
    surface: input.surface || 'general',
    issueType: input.issueType || 'other',
    rootCause: input.rootCause || 'ignored_visible_clue',
    note: input.body,
    title: input.title,
    messageKind: input.messageKind,
    pageUrl: input.pageUrl,
    deviceSummary: input.deviceSummary,
    imageId: input.imageId,
    galleryImageIds: input.galleryImageIds,
    itemContext: input.itemContext,
    author: input.author,
    authorEmail: input.authorEmail,
  });
}

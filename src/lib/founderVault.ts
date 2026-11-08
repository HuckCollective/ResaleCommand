import { databases } from './appwrite';
import { Permission, Role } from 'appwrite';
import { getDatabaseId } from './appwriteEnv';

export type VaultNoteKind = 'idea' | 'prompt' | 'spec' | 'report';

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
  createdAt: string;
  updatedAt: string;
  status?: VaultGovernanceStatus;
  surface?: AiSurface;
  issueType?: AiIssueType;
  rootCause?: AiRootCause;
  author?: string;
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
      // Truncated JSON at 1,500 chars: extract fields cleanly via regex without leaking raw JSON
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
  report: { icon: '🚩', label: 'AI Report' },
  idea: { icon: '💡', label: 'Idea' },
  prompt: { icon: '📋', label: 'Prompt' },
  spec: { icon: '📌', label: 'Spec' },
};

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
  starterNoteId?: string;
  icon: string;
  title: string;
  summary: string;
  destination: PromptTargetDestination;
  bundles: string[];
  defaultGoal: string;
}

/** Canonical 6 Playbook Starters (Dev/IDE, AI Studio Architecture, Live QA, and Deal Hunting). */
export const PLAYBOOK_PRESETS: PlaybookPresetItem[] = [
  {
    id: 'ide-surgical-builder',
    starterNoteId: 'starter-ide-surgical-builder',
    icon: '🎯',
    title: 'Antigravity IDE Surgical Bug Fix & Feature',
    summary:
      'Turns an AI Report, UI bug, or feature note (e.g., saving Quick Scout estimate range cards) into a 1-shot surgical Antigravity IDE prompt with Model Picker & 3-file lock.',
    destination: 'antigravity_ide',
    bundles: ['rc-1-scout-vision', 'rc-2-inventory-splitter'],
    defaultGoal:
      'Turn this issue description into a surgical Antigravity IDE prompt (with Model Picker header, ALLOWED FILES max 3, MAX TOOL CALLS: 3, FORBIDDEN ACTIONS, and alpha-1 verify + push) that fixes the bug or builds the feature cleanly.',
  },
  {
    id: 'ai-studio-architect',
    starterNoteId: 'starter-preview-trial',
    icon: '🧪',
    title: 'AI Studio Feature Architect & Spec Co-Pilot',
    summary:
      'Brainstorms multi-file features, UX flows, or prompt architecture in Google AI Studio Focused Chats (#1–#5) with a cumulative SAVED MASTER SPEC & IDE QUEUE.',
    destination: 'ai_studio',
    bundles: ['rc-2-inventory-splitter', 'rc-4-sales-coop'],
    defaultGoal:
      'Design a complete UX/IA and data architecture plan for this feature in Google AI Studio, ask 2-3 clarifying product questions, and maintain a cumulative SAVED MASTER SPEC & IDE QUEUE block.',
  },
  {
    id: 'paired-qa',
    starterNoteId: 'starter-paired-qa-sidebar',
    icon: '🧪',
    title: 'Paired Human-AI Live Page QA Tester',
    summary:
      'Step-by-step live DOM verification in Chrome Gemini Sidebar with pre-click checklists and 4-line status reports for Antigravity IDE.',
    destination: 'chrome_sidebar',
    bundles: ['rc-2-inventory-splitter', 'rc-5-social-studio'],
    defaultGoal:
      'Create a step-by-step Paired Human-AI Chrome Sidebar QA prompt to test our latest feature on alpha.resalecmd.com one page at a time.',
  },
  {
    id: 'auction-sweeper',
    starterNoteId: 'starter-auction-sweeper',
    icon: '🔭',
    title: 'Whole-Page Auction Grid Sweeper',
    summary:
      'Scans 24–50 ShopGoodwill, HiBid, or eBay search lots in Chrome Sidebar and ranks the Top 3–5 sleeper lots where 1 Anchor item recoups your bid.',
    destination: 'chrome_sidebar',
    bundles: ['rc-1-scout-vision', 'rc-2-inventory-splitter'],
    defaultGoal:
      'Scan this entire auction search results page and rank the top 3-5 sleeper lots worth clicking for our booths, factoring in shipping drag, buyer premium, and 1-anchor cost recovery.',
  },
  {
    id: 'fbmp-coach',
    starterNoteId: 'starter-fbmp-coach',
    icon: '🤝',
    title: 'FBMP / Local Deal & Negotiation Coach',
    summary:
      'Builds an Opening Anchor -> Walk-Away Offer Ladder, 3 non-tip-off seller questions, and 3 copy-paste DM negotiation scripts.',
    destination: 'gemini_app',
    bundles: ['rc-1-scout-vision', 'rc-3-booth-drops'],
    defaultGoal:
      'Evaluate a Facebook Marketplace / Craigslist local pickup listing, give me an Opening Anchor to Walk-Away Offer Ladder, 3 non-tip-off inspection questions, and 3 copy-paste DM scripts.',
  },
  {
    id: 'estate-triage',
    icon: '🧭',
    title: 'Estate Table / Thrift Pile Triage',
    summary:
      'Use your phone camera in Gemini App to scan a whole table or shelf of items, spot the highest-margin pieces, and suggest a bundle offer.',
    destination: 'gemini_app',
    bundles: ['rc-1-scout-vision', 'rc-2-inventory-splitter'],
    defaultGoal:
      'I am at an estate sale / flea market looking at a table of items. Help me spot the highest-margin pieces from my photo, flag any reprints/traps, and suggest a single cash bundle offer for the pile.',
  },
];

/**
 * Builds the full Co-Pilot input brief from a VaultNote so the user's Issue Description (`body`),
 * Title, Root Cause, and Attached Scan Snapshot automatically feed the AI Prompt Builder.
 */
export function buildCoPilotBriefFromNote(note: Partial<VaultNote>): string {
  const title = (note.title || '').trim();
  const body = (note.body || '').trim();
  const lines: string[] = [];

  if (note.kind === 'report') {
    lines.push('TASK: Analyze this reported Resale Command issue / feature request, run a 3-Point Anti-Bias Audit, and build a ready-to-paste prompt for the target surface.');
    if (title) lines.push(`Card Title: ${title}`);
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
    return lines.join('\n');
  }

  if (title && body && body !== title) {
    return `${title}\n\nDetails / Goal:\n${body}`;
  }
  return body || title;
}

/**
 * Inspects a VaultNote's description, surface, and kind to auto-recommend:
 * 1) Which Playbook Starter Template (`presetId`) matches best
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

  // 3. Auto-detect Playbook Starter Template & Target Surface
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
  } else if (
    note.kind === 'spec' ||
    /onboarding|trial user|preview member|multi-stage|architecture|brainstorm/.test(combined)
  ) {
    recommendedPresetId = 'ai-studio-architect';
    detectedDestination = note.kind === 'spec' ? 'product_spec' : 'ai_studio';
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
      modelPickerBadge: '🟢 PICK IN ANTIGRAVITY: Gemini 4 Argon Medium (or ⚡ 3.8 Flash for Recon first)',
      whyThisSurface:
        'This issue describes app behavior, UI state, or scan persistence (e.g., saving Quick Scout estimate range cards when tracking an item) that can be fixed directly in the repo on alpha-1.',
      handoffSteps: [
        '1. Click "📋 Copy IDE Prompt" below.',
        '2. In Antigravity IDE, start a fresh chat (or run /compact) and set the Model Picker to "Gemini 4 Argon Medium" (or "Gemini 3.8 Flash" for a read-only scout turn).',
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
      modelPickerBadge: `🧪 OPEN AI STUDIO: ${aiStudioChatLabel} (Gemini Pro / Argon)`,
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
      modelPickerBadge: '🌐 CHROME GEMINI SIDEBAR (Gemini 4 Argon)',
      whyThisSurface:
        'Best when the AI needs to inspect the live browser DOM (either sweeping 24-50 auction lots or running Paired Human-AI QA on alpha.resalecmd.com).',
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
        'Formats your idea into a clean, mobile-readable Product Spec with acceptance criteria and an ordered Antigravity IDE implementation queue.',
      handoffSteps: [
        '1. Review the generated Product Spec & Acceptance Criteria in the card.',
        '2. Copy individual tasks from the IDE Task Queue at the bottom into Antigravity IDE (`Gemini 4 Argon Medium`).',
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
      'Phone-friendly interactive coach for evaluating deals in the field, negotiating FBMP/local pickups, or voice-brainstorming on the go.',
    handoffSteps: [
      '1. Click "📋 Copy Prompt" below.',
      '2. Open the Gemini App on your phone (or gemini.google.com/app) and paste the prompt.',
      '3. Attach your listing screenshot or table photo and reply to the 1-2 follow-up questions.',
    ],
    recommendedBundles,
  };
}

/** Ready-to-copy power prompts seeded into a brand-new vault. */
export const STARTER_VAULT_NOTES: VaultNote[] = [
  {
    id: 'starter-ide-surgical-builder',
    kind: 'prompt',
    destination: 'antigravity_ide',
    title: '🎯 Antigravity IDE: Surgical Bug Fix & Feature Prompt Template',
    body: [
      '🟢 PICK IN ANTIGRAVITY: Gemini 4 Argon Medium (or ⚡ Gemini 3.8 Flash for Read-Only Recon first)',
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
    createdAt: '2026-11-07T00:00:00.000Z',
    updatedAt: '2026-11-07T00:00:00.000Z',
  },
  {
    id: 'starter-auction-sweeper',
    kind: 'prompt',
    destination: 'chrome_sidebar',
    title: '🔭 Whole-Page Auction Grid Sweeper (Chrome Sidebar)',
    body: [
      '🌐 OPEN PAGE FIRST: the auction / search-results page (ShopGoodwill, HiBid, EstateSales.net, eBay search) with the full grid of lots visible. Scroll once so every lot loads BEFORE you press Enter (the sidebar reads the page at the moment you press Enter).',
      '',
      'You are my resale deal-hunting co-pilot for The Huckleberry Collective. Look at EVERY lot on this page and tell me which 3-5 are worth clicking into, and which to skip.',
      '',
      'My venues: a vintage-mall booth (goth, whimsigoth, TTRPG/RPG books, metaphysical, sci-fi, punk, horror, adventure, cosplay) and a small-collectibles booth (jewelry, pins, wands/arcana under 8 inches; NO apparel, NO large toys).',
      "Rules: value ONLY from secondary-market sold comps, never retail MSRP. Prefer lots where ONE anchor item can recoup 80-120% of the landed cost. Include buyer's premium and shipping weight in landed cost. Do not invent items you cannot read in the photos or titles.",
      '',
      'For each pick give: lot title, why it is a sleeper, the likely anchor item, max bid ceiling, and the booth it fits. Then list 2-3 lots to SKIP (shipping traps, MSRP-priced, unclear photos).',
      'End with 2 short questions about my budget and which booth needs stock, so we can refine.',
      'Reply in a 5-line status block: URL | lots scanned | top picks | skips | next question.',
    ].join('\n'),
    createdAt: '2026-11-07T00:00:00.000Z',
    updatedAt: '2026-11-07T00:00:00.000Z',
  },
  {
    id: 'starter-fbmp-coach',
    kind: 'prompt',
    destination: 'gemini_app',
    title: '🤝 FB Marketplace / Local Deal Evaluator & Negotiation Coach',
    body: [
      'You are my resale negotiation coach. I will paste a Facebook Marketplace / Craigslist / OfferUp listing (text, link, or screenshot).',
      '',
      'Do this, phone-friendly (short bullets):',
      '1) What it likely is and a realistic cash resale range from sold comps (never MSRP). Say what you cannot verify from the photos.',
      '2) OFFER LADDER: opening cash anchor, target price, hard walk-away ceiling. Pick the ceiling so one anchor item recoups 100% of my cash outlay.',
      '3) THREE non-tip-off questions to ask the seller about condition/completeness.',
      '4) THREE copy-paste DM scripts: "cash pickup today", "bundle both posts", and "condition counter-offer".',
      '5) Red flags that mean walk away.',
      '',
      'My venues: a vintage-mall booth (goth, TTRPG, metaphysical, sci-fi, punk, horror) and a small-collectibles booth (under 8 inches, no apparel). Tell me which booth it fits.',
      'Give your recommendation first, then ask me 1-2 sharp follow-ups. Keep a running "SAVED MASTER SPEC & IDE QUEUE" only if we are designing app features.',
    ].join('\n'),
    createdAt: '2026-11-07T00:00:00.000Z',
    updatedAt: '2026-11-07T00:00:00.000Z',
  },
  {
    id: 'starter-paired-qa-sidebar',
    kind: 'prompt',
    destination: 'chrome_sidebar',
    title: '🧪 Paired Human-AI Live Page QA Tester (Chrome Sidebar)',
    body: [
      '🌐 OPEN PAGE FIRST: https://alpha.resalecmd.com/coop/vault',
      '',
      'You are my paired QA co-pilot for Resale Command on alpha.resalecmd.com. Report strictly what you SEE in the live DOM — never guess code.',
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
    createdAt: '2026-11-07T00:00:00.000Z',
    updatedAt: '2026-11-07T00:00:00.000Z',
  },
  {
    id: 'starter-preview-trial',
    kind: 'prompt',
    destination: 'ai_studio',
    title: 'Gemini Starter: Preview Member & Trial User Design',
    body: [
      'You are the Principal Product Architect, Cooperative Economist (WSDE / Mondragon), and UX/IA Co-Pilot for The Huckleberry Collective (thehc.llc) & Resale Command (resalecmd.com).',
      '',
      'GOAL: Architect a 2-stage onboarding experience.',
      '1. Preview Member: prospective partners explore the real dashboard, 70/30 waterfall and consignor simulators, labor pool and booth inventory read-only, switching between the 5 Member Hats (Founder, Curator, Promoter, Surplus Enabler, Consignor) with zero risk to production data. Clear "Apply to Join" CTA.',
      '2. Trial User: hands-on test-drive of Quick Scout / Deep Scan (capped free credits), Lot Splitter and label preview in an isolated DEMO- sandbox that never touches HUCK-/PDXGL-/BB- inventory, Ricochet sync or the co-op ledger.',
      'Define the upgrade path Guest > Preview Member > Trial User > Verified Co-op Member.',
      '',
      'RESPOND WITH: (1) permissions matrix + data isolation + AI quota protection, (2) top 3 UI components to build first, (3) 3 focused product questions. Keep it phone-friendly and end with a cumulative "SAVED MASTER SPEC & IDE QUEUE" block.',
    ].join('\n'),
    createdAt: '2026-11-07T00:00:00.000Z',
    updatedAt: '2026-11-07T00:00:00.000Z',
  },
  {
    id: 'starter-mobile-addon',
    kind: 'prompt',
    destination: 'gemini_app',
    title: 'Gemini Mobile Add-On (paste at bottom of chat)',
    body: [
      'I am brainstorming from my phone and will execute IDE prompts later on my PC in Antigravity IDE.',
      'Keep responses phone-screen friendly (short punchy bullets).',
      'Whenever we lock a decision, maintain a cumulative "SAVED MASTER SPEC & IDE QUEUE" block at the bottom of your reply.',
    ].join('\n'),
    createdAt: '2026-11-07T00:00:00.000Z',
    updatedAt: '2026-11-07T00:00:00.000Z',
  },
];

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

function readLocal(): VaultNote[] {
  if (typeof window === 'undefined') return STARTER_VAULT_NOTES;
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return STARTER_VAULT_NOTES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : STARTER_VAULT_NOTES;
  } catch {
    return STARTER_VAULT_NOTES;
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

function withMissingStarters(existing: VaultNote[]): { notes: VaultNote[]; added: boolean } {
  const ids = new Set(existing.map((n) => n.id));
  const missing = STARTER_VAULT_NOTES.filter((s) => !ids.has(s.id));
  return missing.length > 0 ? { notes: [...existing, ...missing], added: true } : { notes: existing, added: false };
}

export async function loadVaultNotes(): Promise<{ notes: VaultNote[]; synced: boolean }> {
  const local = readLocal();
  try {
    const doc: any = await databases.getDocument(getDatabaseId(), MANIFESTS_COL_ID, FOUNDER_VAULT_DOC_ID);
    const parsed = JSON.parse(doc.itemsSnapshot || '{}');
    const cloud: VaultNote[] = Array.isArray(parsed.notes) ? parsed.notes : local;
    const merged = withMissingStarters(cloud);
    writeLocal(merged.notes);
    if (merged.added) {
      const ok = await saveVaultNotes(merged.notes);
      return { notes: merged.notes, synced: ok };
    }
    return { notes: merged.notes, synced: true };
  } catch (err: any) {
    if (err?.code === 404) {
      const seeded = withMissingStarters(local).notes;
      const ok = await saveVaultNotes(seeded);
      return { notes: seeded, synced: ok };
    }
    return { notes: withMissingStarters(local).notes, synced: false };
  }
}

export async function saveVaultNotes(notes: VaultNote[]): Promise<boolean> {
  writeLocal(notes);
  const dbId = getDatabaseId();
  const payload = {
    name: 'Founder Idea & Prompt Vault',
    tenantId: 'huck_collective',
    locationId: 'FOUNDER_VAULT',
    locationName: 'Founder Vault',
    status: 'vault_state',
    itemsSnapshot: JSON.stringify({ notes, updatedAt: new Date().toISOString() }),
    itemCount: notes.length,
    notes: JSON.stringify({ noteCount: notes.length }),
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
  itemContext?: string;
  author?: string;
}): Promise<{ saved: boolean; synced: boolean }> {
  const { notes } = await loadVaultNotes();
  const now = new Date().toISOString();
  const draftNote: Partial<VaultNote> = {
    kind: 'report',
    title: `${AI_SURFACE_LABELS[input.surface]}: ${AI_ISSUE_LABELS[input.issueType]}`,
    body: input.note.trim(),
    surface: input.surface,
    issueType: input.issueType,
    rootCause: input.rootCause,
    itemContext: input.itemContext?.slice(0, 1500),
  };
  const routing = recommendVaultTemplateAndSurface(draftNote);
  const report: VaultNote = {
    id: newVaultNoteId(),
    kind: 'report',
    title: `${AI_SURFACE_LABELS[input.surface]}: ${AI_ISSUE_LABELS[input.issueType]}`,
    body: input.note.trim(),
    status: 'pending_review',
    surface: input.surface,
    issueType: input.issueType,
    rootCause: input.rootCause,
    author: input.author,
    itemContext: input.itemContext?.slice(0, 1500),
    destination: routing.recommendedDestination,
    bundlesUsed: routing.recommendedBundles,
    routingGuide: routing,
    upvotedBy: input.author ? [input.author] : [],
    createdAt: now,
    updatedAt: now,
  };
  const synced = await saveVaultNotes([...notes, report]);
  return { saved: true, synced };
}

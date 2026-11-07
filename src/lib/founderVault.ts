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

/** Ready-to-copy power prompts seeded into a brand-new vault. */
export const STARTER_VAULT_NOTES: VaultNote[] = [
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
      'Rules: value ONLY from secondary-market sold comps, never retail MSRP. Prefer lots where ONE anchor item can recoup 80-120% of the landed cost. Include buyer\'s premium and shipping weight in landed cost. Do not invent items you cannot read in the photos or titles.',
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
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(notes: VaultNote[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(notes));
  } catch (err) {
    console.warn('[founderVault] localStorage mirror warning:', err);
  }
}

/** Adds any starter prompts the vault does not have yet (so existing vaults get the new Deal-Hunter prompts). */
function withMissingStarters(notes: VaultNote[]): { notes: VaultNote[]; added: boolean } {
  const have = new Set(notes.map((n) => n.id));
  const missing = STARTER_VAULT_NOTES.filter((s) => !have.has(s.id));
  return missing.length ? { notes: [...notes, ...missing], added: true } : { notes, added: false };
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
    upvotedBy: input.author ? [input.author] : [],
    createdAt: now,
    updatedAt: now,
  };
  const synced = await saveVaultNotes([...notes, report]);
  return { saved: true, synced };
}

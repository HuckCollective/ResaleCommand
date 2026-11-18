/**
 * Co-op Task Board, 12 Editable Presets, Custom Task Value Voting (>=50% Quorum + 48h Window),
 * 2-Other-Member Peer Completion Sign-Off, Own-Barcode Anti-Double-Dip Detector,
 * Per-Entry Function Tags, and Hat-Derived BCC Group Emails.
 *
 * Pure TypeScript — zero Appwrite / server SDK imports so UI panels, server endpoints,
 * and unit tests share one exact mathematical & governance contract.
 */
import type { CoopLaborCategory, CoopMemberProfile } from './coopGovernance';
import { MEMBER_HAT_META, type MemberHat } from './memberHats';

export type CoopLaborFunctionTag = 'promoter' | 'enabler' | 'builder' | 'shift';

export const COOP_LABOR_FUNCTION_TAGS: readonly CoopLaborFunctionTag[] = [
  'promoter',
  'enabler',
  'builder',
  'shift',
] as const;

export interface FunctionTagMeta {
  id: CoopLaborFunctionTag;
  label: string;
  shortLabel: string;
  icon: string;
  badgeClass: string;
  defaultCategory: CoopLaborCategory;
}

export const FUNCTION_TAG_META: Record<CoopLaborFunctionTag, FunctionTagMeta> = {
  promoter: {
    id: 'promoter',
    label: '📣 Promoter',
    shortLabel: 'Promoter',
    icon: '📣',
    badgeClass: 'badge-secondary badge-outline',
    defaultCategory: 'Social & Marketing',
  },
  enabler: {
    id: 'enabler',
    label: '🔥 Enabler',
    shortLabel: 'Enabler',
    icon: '🔥',
    badgeClass: 'badge-info badge-outline',
    defaultCategory: 'Online Fulfillment & Shipping',
  },
  builder: {
    id: 'builder',
    label: '🛠️ Builder',
    shortLabel: 'Builder',
    icon: '🛠️',
    badgeClass: 'badge-primary badge-outline',
    defaultCategory: 'Tech & Admin',
  },
  shift: {
    id: 'shift',
    label: '⏱️ Shift',
    shortLabel: 'Shift',
    icon: '⏱️',
    badgeClass: 'badge-accent badge-outline',
    defaultCategory: 'Pop-Up & Event Staffing',
  },
};

export function isCoopLaborFunctionTag(val: unknown): val is CoopLaborFunctionTag {
  return (
    val === 'promoter' ||
    val === 'enabler' ||
    val === 'builder' ||
    val === 'shift'
  );
}

export function inferFunctionTagFromCategory(category?: CoopLaborCategory | string): CoopLaborFunctionTag {
  switch (category) {
    case 'Social & Marketing':
      return 'promoter';
    case 'Tech & Admin':
      return 'builder';
    case 'Pop-Up & Event Staffing':
    case 'Booth Restock':
      return 'shift';
    case 'Photography & Staging':
    case 'Online Fulfillment & Shipping':
    case 'Sourcing':
    default:
      return 'enabler';
  }
}

export function normalizeFunctionTag(
  raw: unknown,
  fallbackCategory?: CoopLaborCategory | string
): CoopLaborFunctionTag {
  const clean = String(raw || '').trim().toLowerCase();
  if (isCoopLaborFunctionTag(clean)) return clean;
  return inferFunctionTagFromCategory(fallbackCategory);
}

/**
 * Clamps task/preset Solidarity Points (`1 pt = 1.00h` in Gate 4B) to `[0.25, 24.0]` in `0.25` steps.
 */
export function clampTaskPoints(raw: unknown, fallback = 1.0): number {
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  const quarterRounded = Math.round(num * 4) / 4;
  return Math.min(24, Math.max(0.25, Number(quarterRounded.toFixed(2))));
}

export interface CoopTaskPreset {
  id: string;
  title: string;
  functionTag: CoopLaborFunctionTag;
  category: CoopLaborCategory;
  /** 1 Solidarity Point = 1.00 Approved Labor Hour in Gate 4B */
  basePoints: number;
  description: string;
  active: boolean;
}

export const DEFAULT_COOP_TASK_PRESETS: readonly CoopTaskPreset[] = [
  // 1-3: Promoter
  {
    id: 'preset-dropcast-reel',
    title: 'Dropcast Short Video / Reel',
    functionTag: 'promoter',
    category: 'Social & Marketing',
    basePoints: 1.5,
    description: 'Film, edit, and post a collective Dropcast reel featuring multi-member booth or online finds.',
    active: true,
  },
  {
    id: 'preset-drop-campaign',
    title: 'Multi-Platform Drop Campaign',
    functionTag: 'promoter',
    category: 'Social & Marketing',
    basePoints: 2.0,
    description: 'Publish coordinated event or weekend drop graphics and links across social channels.',
    active: true,
  },
  {
    id: 'preset-booth-photo-walk',
    title: 'Booth & Display Photo Walk',
    functionTag: 'promoter',
    category: 'Photography & Staging',
    basePoints: 1.5,
    description: 'Capture fresh shelf vignettes and story highlights across shared retail displays.',
    active: true,
  },
  // 4-6: Enabler
  {
    id: 'preset-shared-booth-reset',
    title: 'Shared Booth Reset & Merchandising Run',
    functionTag: 'enabler',
    category: 'Booth Restock',
    basePoints: 2.0,
    description: 'Tidy, restock, and re-merchandise shared collective sections on the retail floor.',
    active: true,
  },
  {
    id: 'preset-online-ship-batch',
    title: 'Collective Online Pack & Ship Batch',
    functionTag: 'enabler',
    category: 'Online Fulfillment & Shipping',
    basePoints: 1.5,
    description: 'Pull, pack, weigh, and drop off shared storefront orders (non-co-curated items).',
    active: true,
  },
  {
    id: 'preset-shared-tag-prep',
    title: 'Shared Lot Photo & Thermal Tag Prep',
    functionTag: 'enabler',
    category: 'Photography & Staging',
    basePoints: 2.0,
    description: 'Photograph and print thermal barcode labels for collective commons inventory.',
    active: true,
  },
  // 7-9: Builder
  {
    id: 'preset-works-feature-pr',
    title: 'Works@TheHC Feature or Bug Fix',
    functionTag: 'builder',
    category: 'Tech & Admin',
    basePoints: 3.0,
    description: 'Ship and verify a collective software improvement, workflow tool, or bug fix.',
    active: true,
  },
  {
    id: 'preset-booth-fixture-build',
    title: 'Booth Shelving, Lighting or Display Build',
    functionTag: 'builder',
    category: 'Booth Restock',
    basePoints: 3.0,
    description: 'Fabricate or install custom shelving, risers, lighting, or locking cases for a booth.',
    active: true,
  },
  {
    id: 'preset-signage-label-kit',
    title: 'Collective Signage & Print Kit',
    functionTag: 'builder',
    category: 'Tech & Admin',
    basePoints: 2.0,
    description: 'Design QR signs, shelf talkers, or event banners for collective booths and pop-ups.',
    active: true,
  },
  // 10-12: Shift
  {
    id: 'preset-popup-half-day',
    title: 'Pop-Up Market / Event Shift (Half-Day)',
    functionTag: 'shift',
    category: 'Pop-Up & Event Staffing',
    basePoints: 4.0,
    description: 'Staff the collective table or checkout terminal during a pop-up market or hosted event.',
    active: true,
  },
  {
    id: 'preset-popup-load-crew',
    title: 'Pop-Up Load-In & Tear-Down Crew',
    functionTag: 'shift',
    category: 'Pop-Up & Event Staffing',
    basePoints: 2.5,
    description: 'Haul canopies, tables, totes, and displays to and from an event venue.',
    active: true,
  },
  {
    id: 'preset-pos-tag-audit',
    title: 'Monthly Booth Barcode & Stock Audit',
    functionTag: 'shift',
    category: 'Tech & Admin',
    basePoints: 2.0,
    description: 'Walk the booth to reconcile missing tags, orphan items, and POS inventory counts.',
    active: true,
  },
] as const;

export function normalizeTaskPresets(raw?: unknown): CoopTaskPreset[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_COOP_TASK_PRESETS.map((p) => ({ ...p }));
  }
  const byId = new Map<string, any>();
  for (const item of raw) {
    if (item && typeof item.id === 'string' && item.id.trim()) {
      byId.set(item.id.trim(), item);
    }
  }
  return DEFAULT_COOP_TASK_PRESETS.map((def) => {
    const override = byId.get(def.id);
    if (!override) return { ...def };
    const title = String(override.title || def.title).trim().slice(0, 120) || def.title;
    const description =
      String(override.description ?? def.description).trim().slice(0, 400) || def.description;
    return {
      id: def.id,
      title,
      functionTag: normalizeFunctionTag(override.functionTag, def.category),
      category: def.category,
      basePoints: clampTaskPoints(override.basePoints, def.basePoints),
      description,
      active: override.active !== false,
    };
  });
}

export const CUSTOM_TASK_VOTE_WINDOW_HOURS = 48;
export const CUSTOM_TASK_VOTE_WINDOW_MS = CUSTOM_TASK_VOTE_WINDOW_HOURS * 60 * 60 * 1000;
export const MAX_COMPLETED_TASKS_RETAINED = 100;

export type CoopTaskStatus =
  | 'voting_value'
  | 'tiebreak_needed'
  | 'open'
  | 'claimed'
  | 'pending_approval'
  | 'completed'
  | 'archived';

export interface CoopTaskValueVote {
  userId: string;
  name: string;
  points: number;
  at: string;
}

export interface CoopTaskPeerApproval {
  userId: string;
  name: string;
  isFounder?: boolean;
  at: string;
}

export interface CoopTaskItem {
  id: string;
  presetId?: string;
  isCustom: boolean;
  title: string;
  description: string;
  functionTag: CoopLaborFunctionTag;
  category: CoopLaborCategory;
  /** Final locked points (`1 pt = 1.00h`); equals `proposedPoints` while voting */
  points: number;
  proposedPoints: number;
  status: CoopTaskStatus;
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  /** Voting fields for custom tasks */
  snapshotEligibleVoters: number;
  votingOpensAt?: string;
  votingClosesAt?: string;
  valueVotes: CoopTaskValueVote[];
  tiebreakReason?: 'quorum_missed' | 'split_tie';
  tiebreakResolvedBy?: string;
  /** Claim & completion fields */
  claimedByUserId?: string;
  claimedByName?: string;
  claimedPartner?: 'HUCK' | 'PDXGL' | 'SWEAT';
  claimedPrefix?: string;
  claimedAt?: string;
  completedByUserId?: string;
  completedByName?: string;
  completedPartner?: 'HUCK' | 'PDXGL' | 'SWEAT';
  completedDate?: string;
  deliverableRef?: string;
  completionNotes?: string;
  submittedAt?: string;
  /** Anti-double-dip own-barcode flag */
  ownBarcodeWarning?: boolean;
  ownBarcodeMatchedTokens?: string[];
  /** Peer completion sign-offs */
  peerApprovals: CoopTaskPeerApproval[];
  selfApproved?: boolean;
  linkedLaborEntryId?: string;
  linkedLaborApproval?: 'approved' | 'pending';
}

export interface TaskVoteEvaluation {
  quorumRequired: number;
  votesCast: number;
  quorumMet: boolean;
  windowClosed: boolean;
  nextStatus: 'voting_value' | 'tiebreak_needed' | 'open';
  resolvedPoints: number;
  tiebreakReason?: 'quorum_missed' | 'split_tie';
}

/**
 * Evaluates a custom task's 48h point-value vote against its snapshotted eligible voter count.
 * - Quorum requires `>= 50%` of `snapshotEligibleVoters` (`Math.ceil(denom / 2)`).
 * - Opens early if strictly `> 50%` of all `snapshotEligibleVoters` voted the exact `proposedPoints`
 *   (or immediately on `denom === 1` once the sole voter votes), because additional votes cannot shift the median.
 * - Once the 48h window closes:
 *   - `< 50%` quorum ➔ `'tiebreak_needed'` (`'quorum_missed'`).
 *   - `>= 50%` quorum with even-vote spread `> 0.5` pts around the middle pair ➔ `'tiebreak_needed'` (`'split_tie'`).
 *   - Otherwise ➔ `'open'` at the quarter-point median.
 */
export function evaluateTaskValueVote(
  task: Pick<
    CoopTaskItem,
    'proposedPoints' | 'snapshotEligibleVoters' | 'votingClosesAt' | 'valueVotes'
  >,
  nowIso: string
): TaskVoteEvaluation {
  const denom = Math.max(1, Math.round(Number(task.snapshotEligibleVoters || 1)));
  const quorumRequired = Math.ceil(denom / 2);

  // Deduplicate by userId (last vote wins)
  const byUser = new Map<string, CoopTaskValueVote>();
  for (const v of task.valueVotes || []) {
    if (v && v.userId) {
      byUser.set(v.userId, {
        userId: String(v.userId),
        name: String(v.name || 'Member'),
        points: clampTaskPoints(v.points, task.proposedPoints),
        at: String(v.at || nowIso),
      });
    }
  }
  const uniqueVotes = Array.from(byUser.values());
  const votesCast = uniqueVotes.length;
  const quorumMet = votesCast >= quorumRequired;

  const closesMs = task.votingClosesAt ? Date.parse(task.votingClosesAt) : NaN;
  const nowMs = Date.parse(nowIso);
  const windowClosed = Number.isFinite(closesMs) && Number.isFinite(nowMs) && nowMs >= closesMs;

  if (votesCast === 0) {
    return {
      quorumRequired,
      votesCast: 0,
      quorumMet: false,
      windowClosed,
      nextStatus: windowClosed ? 'tiebreak_needed' : 'voting_value',
      resolvedPoints: clampTaskPoints(task.proposedPoints),
      tiebreakReason: windowClosed ? 'quorum_missed' : undefined,
    };
  }

  // Sole-voter bootstrap: 1/1 voter resolves immediately at their chosen points
  if (denom === 1 && votesCast >= 1) {
    return {
      quorumRequired: 1,
      votesCast,
      quorumMet: true,
      windowClosed,
      nextStatus: 'open',
      resolvedPoints: uniqueVotes[0].points,
    };
  }

  const targetPts = clampTaskPoints(task.proposedPoints);
  const exactProposedMatches = uniqueVotes.filter(
    (v) => Math.abs(v.points - targetPts) < 0.001
  ).length;

  // Strict >50% of ALL eligible voters agreed on exact proposedPoints -> median is mathematically locked
  if (exactProposedMatches * 2 > denom) {
    return {
      quorumRequired,
      votesCast,
      quorumMet: true,
      windowClosed,
      nextStatus: 'open',
      resolvedPoints: targetPts,
    };
  }

  const sorted = uniqueVotes.map((v) => v.points).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const isEven = sorted.length % 2 === 0;
  const rawMedian = isEven ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const medianPts = clampTaskPoints(rawMedian, targetPts);

  if (!windowClosed) {
    return {
      quorumRequired,
      votesCast,
      quorumMet,
      windowClosed: false,
      nextStatus: 'voting_value',
      resolvedPoints: medianPts,
    };
  }

  if (!quorumMet) {
    return {
      quorumRequired,
      votesCast,
      quorumMet: false,
      windowClosed: true,
      nextStatus: 'tiebreak_needed',
      resolvedPoints: medianPts,
      tiebreakReason: 'quorum_missed',
    };
  }

  // Even-voter wide bimodal split (> 0.5 pt gap between middle two votes) goes to Founder tiebreak
  if (isEven && Math.abs(sorted[mid] - sorted[mid - 1]) > 0.5) {
    return {
      quorumRequired,
      votesCast,
      quorumMet: true,
      windowClosed: true,
      nextStatus: 'tiebreak_needed',
      resolvedPoints: medianPts,
      tiebreakReason: 'split_tie',
    };
  }

  return {
    quorumRequired,
    votesCast,
    quorumMet: true,
    windowClosed: true,
    nextStatus: 'open',
    resolvedPoints: medianPts,
  };
}

/**
 * Applies lazy 48h window transitions across a list of tasks without mutating input objects.
 */
export function refreshTaskStatusesAt(tasks: CoopTaskItem[], nowIso: string): {
  tasks: CoopTaskItem[];
  changed: boolean;
} {
  let changed = false;
  const next = (tasks || []).map((t) => {
    if (t.status !== 'voting_value') return t;
    const evalRes = evaluateTaskValueVote(t, nowIso);
    if (evalRes.nextStatus === 'voting_value') return t;
    changed = true;
    return {
      ...t,
      status: evalRes.nextStatus,
      points: evalRes.nextStatus === 'open' ? evalRes.resolvedPoints : t.points,
      tiebreakReason: evalRes.tiebreakReason,
      updatedAt: nowIso,
    };
  });
  return { tasks: next, changed };
}

export interface PeerApprovalPolicy {
  requiredCount: number;
  allowSoleFounderSelf: boolean;
}

/**
 * Explicit peer completion sign-off policy:
 * - `eligible === 1`: 1 sign-off, allowing audited self-sign-off ONLY when `soleFounder === true`.
 * - `eligible === 2`: 1 other confirmed voting member (`caller.userId !== completedByUserId`).
 * - `eligible >= 3`: 2 distinct other confirmed voting members (`caller.userId !== completedByUserId`).
 */
export function resolvePeerApprovalPolicy(
  eligibleVoterCount: number,
  soleFounder: boolean
): PeerApprovalPolicy {
  const count = Math.max(1, Math.round(Number(eligibleVoterCount || 1)));
  if (count === 1) {
    return {
      requiredCount: 1,
      allowSoleFounderSelf: Boolean(soleFounder),
    };
  }
  if (count === 2) {
    return {
      requiredCount: 1,
      allowSoleFounderSelf: false,
    };
  }
  return {
    requiredCount: 2,
    allowSoleFounderSelf: false,
  };
}

/**
 * Deterministic labor entry ID for task completions so retries never double-credit hours (Law 6).
 */
export function deterministicTaskLaborId(taskId: string): string {
  const clean = String(taskId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 48);
  return `labor-task-${clean || 'unknown'}`;
}

/**
 * Scans task or labor text fields for SKU references matching the worker's own barcode prefix
 * (anti-double-dipping safeguard: own-item work earns Gate 3 Curator profit, not Commons labor hours).
 */
export function detectOwnBarcodeWarning(
  texts: ReadonlyArray<string | undefined | null>,
  memberPrefix?: string | null
): { warning: boolean; matchedTokens: string[] } {
  const cleanPrefix = String(memberPrefix || '')
    .trim()
    .toUpperCase()
    .replace(/[-_\s]+$/, '');

  // Ignore blank, generic SWEAT, or Consignor BB when checking Curator inventory prefixes
  if (!cleanPrefix || cleanPrefix === 'SWEAT' || cleanPrefix.length < 2) {
    return { warning: false, matchedTokens: [] };
  }

  const escaped = cleanPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Matches e.g. "HUCK-1042", "HUCK-0042", "PDXGL-192"
  const re = new RegExp(`\\b${escaped}-\\d{1,8}\\b`, 'gi');
  const found = new Set<string>();

  for (const txt of texts) {
    if (!txt) continue;
    const matches = String(txt).match(re);
    if (matches) {
      for (const m of matches) {
        found.add(m.toUpperCase());
      }
    }
  }

  const matchedTokens = Array.from(found);
  return {
    warning: matchedTokens.length > 0,
    matchedTokens,
  };
}

/**
 * Keeps `coop_tasks_board` well below the 495,000-char ceiling by retaining all active tasks
 * plus the most recent `maxCompleted` completed/archived tasks.
 */
export function pruneTasksBoardForStorage(
  tasks: CoopTaskItem[],
  maxCompleted = MAX_COMPLETED_TASKS_RETAINED
): CoopTaskItem[] {
  const active: CoopTaskItem[] = [];
  const terminal: CoopTaskItem[] = [];

  for (const t of tasks || []) {
    if (!t || !t.id) continue;
    if (t.status === 'completed' || t.status === 'archived') {
      terminal.push(t);
    } else {
      active.push(t);
    }
  }

  terminal.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  return [...active, ...terminal.slice(0, Math.max(10, maxCompleted))];
}

export type BccGroupKey = 'all_voting' | 'founder' | 'curator' | 'promoter' | 'enabler' | 'builder';

export interface HatBccGroup {
  id: BccGroupKey;
  label: string;
  icon: string;
  emails: string[];
  count: number;
  mailtoHref: string;
}

const VOTING_ROLE_SET = new Set<string>([
  'owner',
  'founder',
  'curator',
  'promoter',
  'enabler',
  'builder',
]);

export function buildBccMailtoHref(emails: readonly string[], subjectLabel?: string): string {
  const clean = Array.from(
    new Set(
      (emails || [])
        .map((e) => String(e || '').trim().toLowerCase())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    )
  );
  if (clean.length === 0) return '';
  const subject = encodeURIComponent(
    subjectLabel ? `[Works@TheHC] ${subjectLabel}` : '[Works@TheHC] Collective Update'
  );
  return `mailto:?bcc=${encodeURIComponent(clean.join(','))}&subject=${subject}`;
}

/**
 * Builds privacy-safe BCC email groups strictly from confirmed voting memberships (plus linked voting
 * roster emails when membership list isn't loaded). Strictly excludes `consignor`-only accounts (§14A).
 */
export function buildHatBccGroups(
  memberships: readonly any[],
  rosterMembers: readonly CoopMemberProfile[] = []
): HatBccGroup[] {
  const buckets: Record<BccGroupKey, Set<string>> = {
    all_voting: new Set(),
    founder: new Set(),
    curator: new Set(),
    promoter: new Set(),
    enabler: new Set(),
    builder: new Set(),
  };

  const addEmailWithHats = (rawEmail: unknown, hats: readonly MemberHat[]) => {
    const email = String(rawEmail || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    const votingHats = hats.filter((h) => h !== 'consignor' && MEMBER_HAT_META[h]?.canVote);
    if (votingHats.length === 0) return;

    buckets.all_voting.add(email);
    for (const h of votingHats) {
      if (h in buckets) {
        buckets[h as BccGroupKey].add(email);
      }
    }
  };

  const confirmedMemberships = (memberships || []).filter((m) => m && m.confirm === true);
  if (confirmedMemberships.length > 0) {
    for (const m of confirmedMemberships) {
      const rawRoles: string[] = Array.isArray(m.roles)
        ? m.roles.map((r: any) => String(r || '').trim().toLowerCase())
        : [];
      // Strictly skip consignor-only or non-voting accounts
      if (!rawRoles.some((r) => VOTING_ROLE_SET.has(r))) continue;

      const hats: MemberHat[] = [];
      if (rawRoles.includes('owner') || rawRoles.includes('founder')) hats.push('founder');
      if (rawRoles.includes('curator')) hats.push('curator');
      if (rawRoles.includes('promoter')) hats.push('promoter');
      if (rawRoles.includes('enabler')) hats.push('enabler');
      if (rawRoles.includes('builder')) hats.push('builder');
      addEmailWithHats(m.userEmail, hats);
    }
  } else {
    for (const rm of rosterMembers || []) {
      if (!rm || rm.partner === 'BB' || !rm.canVote) continue;
      addEmailWithHats(rm.email, rm.hats || []);
    }
  }

  const groupDefs: ReadonlyArray<{ id: BccGroupKey; label: string; icon: string; subject: string }> = [
    { id: 'all_voting', label: 'All Voting', icon: '🤝', subject: 'All Voting Members' },
    { id: 'founder', label: 'Founders', icon: '👑', subject: 'Co-op Founders' },
    { id: 'curator', label: 'Curators', icon: '💎', subject: 'Curator Team' },
    { id: 'promoter', label: 'Promoters', icon: '📣', subject: 'Promoters & Dropcasts' },
    { id: 'enabler', label: 'Enablers', icon: '🔥', subject: 'Surplus Enablers' },
    { id: 'builder', label: 'Builders', icon: '🛠️', subject: 'Builders & Displays' },
  ];

  return groupDefs.map((g) => {
    const emails = Array.from(buckets[g.id]).sort();
    return {
      id: g.id,
      label: g.label,
      icon: g.icon,
      emails,
      count: emails.length,
      mailtoHref: buildBccMailtoHref(emails, g.subject),
    };
  });
}

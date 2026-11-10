/**
 * Single Source of Truth for Dev & Architecture AI Tooling (World 2).
 *
 * STRICT BOUNDARY:
 * - World 1 (Reseller / App Runtime AI) lives ONLY in `src/lib/gemini.ts` (`gemini-flash-latest` on $40/mo Cloud credits).
 * - World 2 (Developer & Architecture AI Tooling) lives ONLY here (`src/lib/devAiRouting.ts` on Google AI Ultra).
 *
 * Whenever a new model appears in the Antigravity IDE Model Picker:
 * 1. Update the tier/badge strings and `DEV_AI_ROSTER_LAST_REVIEWED` in THIS file.
 * 2. Run `npm run verify` — `scripts/sync-ai-context.mjs`, `/coop/vault`, `GEMINI.md`, and `thehcllc/GEMINI.md` sync automatically.
 */

export const DEV_AI_ROSTER_LAST_REVIEWED = '2026-11-10';
export const DEV_AI_REVIEW_INTERVAL_DAYS = 30;

export type DevAiTierId = 'fast_scout' | 'daily_driver' | 'deep_architect' | 'outside_fallback';

export interface DevAiTierRule {
  id: DevAiTierId;
  icon: string;
  shortLabel: string;
  pickerModel: string;
  thinkingLevels: string;
  pickerHeader: string;
  whenToUse: string;
  quotaPool: 'google_ai_ultra' | 'partner_credits';
}

export const DEV_AI_HEADER_FLASH = '⚡ PICK IN ANTIGRAVITY: Gemini 3.8 Flash';
export const DEV_AI_HEADER_ARGON = '🟢 PICK IN ANTIGRAVITY: Gemini 4 Argon (Medium)';
export const DEV_AI_HEADER_CARBON = '🔥 PICK IN ANTIGRAVITY: Gemini 4 Carbon (Medium / High)';
export const DEV_AI_HEADER_CLAUDE = '🟣 PICK IN ANTIGRAVITY: Claude Sonnet 5.5 (⚠️ Switch back to Gemini right after!)';

export const DEV_AI_TIERS: readonly DevAiTierRule[] = [
  {
    id: 'fast_scout',
    icon: '⚡',
    shortLabel: '3.8 Flash',
    pickerModel: 'Gemini 3.8 Flash',
    thinkingLevels: 'Low / Medium',
    pickerHeader: DEV_AI_HEADER_FLASH,
    whenToUse: 'File scouting/recon, ACTIVE_SESSION.md & GEMINI.md syncs, single-line copy tweaks, npm run verify & git push (~8x lighter quota).',
    quotaPool: 'google_ai_ultra',
  },
  {
    id: 'daily_driver',
    icon: '🟢',
    shortLabel: '4 Argon Med',
    pickerModel: 'Gemini 4 Argon',
    thinkingLevels: 'Medium',
    pickerHeader: DEV_AI_HEADER_ARGON,
    whenToUse: 'Fast everyday 1–3 file Vue 3.5 / DaisyUI v5 components, CSS polish, and clear feature/API refactors.',
    quotaPool: 'google_ai_ultra',
  },
  {
    id: 'deep_architect',
    icon: '🔥',
    shortLabel: '4 Carbon Med/High',
    pickerModel: 'Gemini 4 Carbon',
    thinkingLevels: 'Medium / High',
    pickerHeader: DEV_AI_HEADER_CARBON,
    whenToUse: '/plan architecture, multi-store/API sync adapters, and tricky bug surgery BEFORE touching Claude (0% Partner credit burn).',
    quotaPool: 'google_ai_ultra',
  },
  {
    id: 'outside_fallback',
    icon: '🟣',
    shortLabel: 'Claude Sonnet 5.5',
    pickerModel: 'Claude Sonnet 5.5',
    thinkingLevels: 'Medium',
    pickerHeader: DEV_AI_HEADER_CLAUDE,
    whenToUse: 'Rare outside tie-breaker after /compact if an isolated bug needs a second opinion (never Opus 5.5).',
    quotaPool: 'partner_credits',
  },
] as const;

export const DEV_AI_ROSTER_SUMMARY_PILL = '⚡ 3.8 Flash • 🟢 4 Argon • 🔥 4 Carbon';

export const DEV_AI_IDE_PICKER_BADGE =
  '🟢 PICK IN ANTIGRAVITY: Gemini 4 Argon (Medium) • 🔥 4 Carbon (Med/High) for /plan & tricky code • ⚡ 3.8 Flash for Recon';

export const DEV_AI_CHROME_SIDEBAR_BADGE = '🌐 CHROME GEMINI SIDEBAR (Gemini 4 Argon / 4 Carbon)';

export const DEV_AI_STUDIO_MODELS_LABEL = 'Gemini Pro / 4 Carbon / 4 Argon';

export const DEV_AI_ADHD_FOOTER =
  '🔔 **ADHD MODEL & /compact CHECK:** ⚡ **3.8 Flash** (recon/push) • 🟢 **4 Argon Med** (fast UI/edits) • 🔥 **4 Carbon Med/High** (/plan & tricky code) • 🟣 **Claude Sonnet 5.5** (last resort) — **/compact** every ~8 turns!';

export interface DevAiRosterFreshness {
  lastReviewed: string;
  reviewMonthLabel: string;
  daysOld: number;
  isStale: boolean;
}

export function getDevAiRosterFreshness(nowMs: number = Date.now()): DevAiRosterFreshness {
  const parsedMs = Date.parse(`${DEV_AI_ROSTER_LAST_REVIEWED}T00:00:00Z`);
  const daysOld = Number.isFinite(parsedMs)
    ? Math.max(0, Math.floor((nowMs - parsedMs) / (1000 * 60 * 60 * 24)))
    : 0;
  const [yr, mo] = DEV_AI_ROSTER_LAST_REVIEWED.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = Math.max(0, Math.min(11, Number(mo || 1) - 1));
  const reviewMonthLabel = `${monthNames[monthIdx]} ${yr || ''}`.trim();

  return {
    lastReviewed: DEV_AI_ROSTER_LAST_REVIEWED,
    reviewMonthLabel,
    daysOld,
    isStale: daysOld > DEV_AI_REVIEW_INTERVAL_DAYS,
  };
}

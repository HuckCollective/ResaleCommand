/**
 * Single Source of Truth for Dev & Architecture AI Tooling (World 2).
 *
 * STRICT BOUNDARY:
 * - World 1 (Reseller / App Runtime AI) lives ONLY in `src/lib/gemini.ts` (`gemini-flash-latest` on $40/mo Cloud credits).
 * - World 2 (Developer & Architecture AI Tooling) lives ONLY here (`src/lib/devAiRouting.ts` on Google AI Ultra).
 *
 * `/coop/vault` uses these tiers in an IDE-independent way (works identically in VS Code Cline, Antigravity IDE, Cursor, or AI Studio),
 * while `GEMINI.md` (Antigravity) and `.clinerules` (VS Code Cline) supply IDE-native tool mechanics automatically.
 */

export const DEV_AI_ROSTER_LAST_REVIEWED = '2026-11-12';
export const DEV_AI_REVIEW_INTERVAL_DAYS = 30;

export type DevAiTierId = 'fast_scout' | 'daily_driver' | 'deep_architect' | 'outside_fallback';

export interface DevAiTierRule {
  id: DevAiTierId;
  icon: string;
  shortLabel: string;
  pickerModel: string;
  modelCode: string;
  thinkingLevels: string;
  pickerHeader: string;
  whenToUse: string;
  geminiAlternative: string;
  quotaPool: 'google_ai_ultra' | 'partner_credits';
}

export const DEV_AI_HEADER_HYDROGEN =
  '⚡ MODEL PICK: Gemini 4 Hydrogen (Low / Medium) [or 3.8 Flash] — Recon, Docs, Verify & Push';
/** Backward-compatible alias for Tier 1 fast scout header */
export const DEV_AI_HEADER_FLASH = DEV_AI_HEADER_HYDROGEN;

export const DEV_AI_HEADER_ARGON =
  '🟢 MODEL PICK: Gemini 4 Argon (Medium) — Standard 1–3 File UI & Feature Coding (💡 If on Claude Sonnet: use 4 Argon Med for $0-pool speed)';

export const DEV_AI_HEADER_CARBON =
  '🔥 MODEL PICK: Gemini 4 Carbon (Medium / High) — Plan Mode Architecture & Tricky Multi-Store Code (💡 Best $0-pool alternative to Claude Sonnet Thinking)';

export const DEV_AI_HEADER_CLAUDE =
  '🟣 MODEL PICK: Claude Sonnet 5.5 (Medium — Rare Tie-Breaker) | 💡 BEST GEMINI $0-POOL ALT: Gemini 4 Carbon (High) — switch back to 4 Argon / 4 Hydrogen right after!';

export const DEV_AI_TIERS: readonly DevAiTierRule[] = [
  {
    id: 'fast_scout',
    icon: '⚡',
    shortLabel: '4 Hydrogen',
    pickerModel: 'Gemini 4 Hydrogen',
    modelCode: 'gemini-4-hydrogen',
    thinkingLevels: 'Low / Medium',
    pickerHeader: DEV_AI_HEADER_HYDROGEN,
    whenToUse:
      'Fastest Gemini 4 coding scout (1M context): file recon, ACTIVE_SESSION.md & skill syncs, copy tweaks, npm run verify & git push (~8x lighter quota; succeeds 3.8 Flash).',
    geminiAlternative: 'Already $0-pool fastest tier (fallback: Gemini 3.8 Flash if picker not refreshed).',
    quotaPool: 'google_ai_ultra',
  },
  {
    id: 'daily_driver',
    icon: '🟢',
    shortLabel: '4 Argon Med',
    pickerModel: 'Gemini 4 Argon',
    modelCode: 'gemini-4-argon',
    thinkingLevels: 'Medium',
    pickerHeader: DEV_AI_HEADER_ARGON,
    whenToUse:
      'Everyday Act-mode coding builder: 1–3 file Vue 3.5 / DaisyUI v5 components, CSS polish, and clear feature/API refactors.',
    geminiAlternative: 'If Claude Sonnet is selected -> swap to Gemini 4 Argon (Medium) for 0% Partner credit draw.',
    quotaPool: 'google_ai_ultra',
  },
  {
    id: 'deep_architect',
    icon: '🔥',
    shortLabel: '4 Carbon Med/High',
    pickerModel: 'Gemini 4 Carbon',
    modelCode: 'gemini-4-carbon',
    thinkingLevels: 'Medium / High',
    pickerHeader: DEV_AI_HEADER_CARBON,
    whenToUse:
      'Plan-mode frontier architect & code surgeon: multi-store/API sync adapters, complex state, and tricky bug surgery BEFORE touching Claude.',
    geminiAlternative: 'If Claude Sonnet / Opus is selected -> use Gemini 4 Carbon (High) first at $0 Partner cost.',
    quotaPool: 'google_ai_ultra',
  },
  {
    id: 'outside_fallback',
    icon: '🟣',
    shortLabel: 'Claude Sonnet 5.5',
    pickerModel: 'Claude Sonnet 5.5',
    modelCode: 'claude-sonnet-5-5',
    thinkingLevels: 'Medium',
    pickerHeader: DEV_AI_HEADER_CLAUDE,
    whenToUse:
      'Rare outside tie-breaker after compacting context (/smol or /compact) ONLY if an isolated bug needs a second model family opinion (never Opus 5.5).',
    geminiAlternative: '💡 Best Gemini $0-Pool Swap: Gemini 4 Carbon (High) for deep bugs, or 4 Argon (Med) for UI edits.',
    quotaPool: 'partner_credits',
  },
] as const;

export const DEV_AI_ROSTER_SUMMARY_PILL = '⚡ 4 Hydrogen • 🟢 4 Argon • 🔥 4 Carbon';

export const DEV_AI_IDE_PICKER_BADGE =
  '🟢 MODEL PICK: Gemini 4 Argon (Med) • 🔥 4 Carbon (Med/High) for Plan & tricky code • ⚡ 4 Hydrogen for Recon/Push (💡 On Claude? Swap to 4 Carbon High / 4 Argon Med for $0 pool)';

export const DEV_AI_CHROME_SIDEBAR_BADGE = '🌐 CHROME GEMINI SIDEBAR (Gemini 4 Hydrogen / 4 Argon / 4 Carbon)';

export const DEV_AI_STUDIO_MODELS_LABEL = 'Gemini 4 Carbon / 4 Argon / 4 Hydrogen';

export const DEV_AI_ADHD_FOOTER =
  '🔔 **ADHD MODEL & /compact CHECK:** ⚡ **4 Hydrogen** (recon/push) • 🟢 **4 Argon Med** (fast UI/edits) • 🔥 **4 Carbon Med/High** (/plan & tricky code — best `$0` swap for Claude!) • 🟣 **Claude Sonnet 5.5** (last resort) — **/compact** every ~8 turns!';

export const DEV_AI_CLINE_ADHD_FOOTER =
  '🔔 **ADHD CLINE CHECK (VS Code):** 🧭 **Plan = 4 Carbon** (architect) • 🟢 **Act = 4 Argon Med** (1–3 file edits) • ⚡ **4 Hydrogen** (recon/verify/push) • 💡 **On Claude? Swap to 4 Carbon High ($0 pool)** — **/smol** every ~8 turns!';

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


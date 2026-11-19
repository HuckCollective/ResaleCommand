/**
 * Single Source of Truth for Dev & Architecture AI Tooling (World 2).
 *
 * STRICT BOUNDARY:
 * - World 1 (Reseller / App Runtime AI) lives ONLY in `src/lib/gemini.ts` (`gemini-flash-latest` on $40/mo Cloud credits).
 * - World 2 (Developer & Architecture AI Tooling) lives ONLY here (`src/lib/devAiRouting.ts` on Google AI Ultra).
 *
 * `/coop/vault` uses these tiers in an IDE-independent way (works identically in Antigravity IDE, Cursor, Copilot, or AI Studio),
 * while root `AGENTS.md` supplies workspace rules and architecture laws automatically.
 */

export const DEV_AI_ROSTER_LAST_REVIEWED = '2026-11-18';
export const DEV_AI_REVIEW_INTERVAL_DAYS = 30;

export type DevAiTierId =
  | 'fast_scout'
  | 'fast_reasoner'
  | 'daily_driver'
  | 'deep_architect'
  | 'outside_fallback';

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

export const DEV_AI_HEADER_NEON =
  '💠 MODEL PICK: Gemini 4 Neon (Medium / High / XHigh) — Fast Analytical Reasoning, $0 Red-Team Audits & Snappy Logic/API Edits';

export const DEV_AI_ORCHESTRATOR_CALLOUT =
  '🎛️ Antigravity Auto-Shift: Park on Orchestrator (Neon / Argon) for daily work or Orchestrator (Carbon) for /plan — auto-pairs with 4 Hydrogen at $0 pool cost!';

export const DEV_AI_HEADER_ARGON =
  '🟢 MODEL PICK: Gemini 4 Argon (Medium) — Standard 1–3 File UI & Feature Coding (💡 If on Claude Sonnet: use 4 Argon Med or 4 Neon Med for $0-pool speed)';

export const DEV_AI_HEADER_CARBON =
  '🔥 MODEL PICK: Gemini 4 Carbon (Medium / High) — Plan Mode Architecture & Tricky Multi-Store Code (💡 Best $0-pool alternative to Claude Sonnet Thinking)';

export const DEV_AI_HEADER_CLAUDE =
  '🟣 MODEL PICK: Claude Sonnet 5.5 (Medium — Rare Tie-Breaker) | 💡 BEST GEMINI $0-POOL ALT: 💠 Gemini 4 Neon (High / XHigh) or 🔥 Gemini 4 Carbon (High) — switch back to 🎛️ Orchestrator right after!';

export const DEV_AI_CLAUDE_PLAN_AUDIT_HEADER =
  '🟣 MODEL PICK: Claude Sonnet 5.5 (Medium — 1-Turn Deep Plan Red-Team Audit) | 💡 BEST $0-POOL SWAP: 💠 Gemini 4 Neon (High / XHigh) | SWITCH BACK TO: 🎛️ Orchestrator (Neon / Argon / Carbon) BEFORE CLICKING PROCEED!';

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
    geminiAlternative: 'Already $0-pool fastest tier (auto-runs under Orchestrator modes).',
    quotaPool: 'google_ai_ultra',
  },
  {
    id: 'fast_reasoner',
    icon: '💠',
    shortLabel: '4 Neon Med/High',
    pickerModel: 'Gemini 4 Neon',
    modelCode: 'gemini-4-neon',
    thinkingLevels: 'Low / Medium / High / XHigh',
    pickerHeader: DEV_AI_HEADER_NEON,
    whenToUse:
      'High-efficiency reasoner (near-Carbon reasoning at Flash speed): $0-pool 1-Turn Plan/UX Red-Team audits (High/XHigh), logic/math checks, and fast multi-step code (Antigravity: Orchestrator (Neon)).',
    geminiAlternative: 'Best $0-pool fast alternative to Claude Sonnet Thinking for read-only audits & logic checks.',
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
      'Everyday Act-mode coding builder: 1–3 file Vue 3.5 / DaisyUI v5 components, CSS polish, and clear feature/API refactors (Antigravity: Orchestrator (Argon)).',
    geminiAlternative: 'If Claude Sonnet is selected -> swap to Orchestrator (Neon/Argon) or 4 Argon (Med) for $0 pool.',
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
      'Plan-mode frontier architect & code surgeon: multi-store/API sync adapters, complex state, and tricky bug surgery BEFORE touching Claude (Antigravity: Orchestrator (Carbon)).',
    geminiAlternative: 'If Claude Sonnet / Opus is selected -> use Orchestrator (Carbon) or 4 Carbon (High) at $0 Partner cost.',
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
      'Optional 1-Turn Deep Plan Red-Team Audit (money/payout math, POS/sales sync, Appwrite schema/migrations, or 4+ file plans) OR rare outside bug tie-breaker after /smol or /compact (never Opus 5.5; keep 100% of recon & code writing on $0 Gemini 4).',
    geminiAlternative: '💡 Best Gemini $0-Pool Swap: 💠 4 Neon (High/XHigh) for audits/logic, 🔥 4 Carbon (High) for deep plans, or 🟢 4 Argon (Med) for UI.',
    quotaPool: 'partner_credits',
  },
] as const;

export const DEV_AI_ROSTER_SUMMARY_PILL =
  '🎛️ Orchestrator • ⚡ 4 Hydrogen • 💠 4 Neon • 🟢 4 Argon • 🔥 4 Carbon';

export const DEV_AI_IDE_PICKER_BADGE =
  '🎛️ ANTIGRAVITY: Orchestrator (Neon / Argon / Carbon) | 🛠️ OTHER IDES: 💠 4 Neon (Med/High) • 🟢 4 Argon (Med) • 🔥 4 Carbon (Med/High) • ⚡ 4 Hydrogen (Recon/Push) — $0 Ultra Pool';

export const DEV_AI_CHROME_SIDEBAR_BADGE =
  '🌐 CHROME GEMINI SIDEBAR (Gemini 4 Hydrogen / 4 Neon / 4 Argon / 4 Carbon)';

export const DEV_AI_STUDIO_MODELS_LABEL =
  'Gemini 4 Carbon / 4 Neon / 4 Argon / 4 Hydrogen';

export const DEV_AI_ADHD_FOOTER =
  '🔔 **ADHD MODEL & /compact CHECK:** 🎛️ **Orchestrator (Neon/Argon/Carbon)** (Antigravity set-and-forget!) • ⚡ **Hydrogen** / 💠 **Neon** / 🟢 **Argon** / 🔥 **Carbon** ($0 Ultra) • 🟣 **Sonnet 5.5** (1-turn audit) — **/compact** every ~8 turns!';

export const DEV_AI_CLINE_ADHD_FOOTER =
  '🔔 **ADHD CLINE CHECK (VS Code):** 🧭 **Plan = 4 Carbon** (architect) • 💠 **Audit/Logic = 4 Neon High** • 🟢 **Act = 4 Argon Med** (1–3 file edits) • ⚡ **4 Hydrogen** (recon/verify/push) — **/smol** every ~8 turns!';

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


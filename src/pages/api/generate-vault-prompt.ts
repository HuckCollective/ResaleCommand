export const prerender = false;

import type { APIRoute } from 'astro';
import { generateContentWithBackoff } from '../../lib/gemini';
import { SKILL_BUNDLES, CORE_BUNDLE_ID, matchSkillBundlesForIdea } from '../../lib/generatedSkillBundles';
import {
  DEV_AI_HEADER_HYDROGEN,
  DEV_AI_HEADER_ARGON,
  DEV_AI_HEADER_CARBON,
  DEV_AI_HEADER_CLAUDE,
} from '../../lib/devAiRouting';
import {
  estimatePromptOpsImpact,
  DESTINATION_META,
  recommendVaultTemplateAndSurface,
  type PromptTargetDestination,
  type AiSurface,
  type AiIssueType,
  type AiRootCause,
  type VaultNoteKind,
} from '../../lib/founderVault';

const MAX_IDEA_CHARS = 4000;
const CORE_CONTEXT_CHARS = 7000;
const SPECIALIST_CONTEXT_CHARS = 9000;

const DESTINATION_INSTRUCTIONS: Record<PromptTargetDestination, string> = {
  gemini_app:
    'Target: the Gemini mobile app / gemini.google.com/app. Phone-screen friendly (short punchy bullets). The prompt must tell Gemini to act as an interactive AI Ally: give a recommendation FIRST, then ask 1-2 sharp follow-up questions. If it involves designing app features, tell Gemini to maintain a cumulative "SAVED MASTER SPEC & IDE QUEUE" block at the bottom of each reply.',
  chrome_sidebar:
    'Target: the Chrome Gemini sidebar reading the live page. The prompt MUST contain: (1) a first line "OPEN PAGE FIRST: <exact page URL or page type>", (2) a step-by-step pre-click checklist of what to open/scroll/expand BEFORE pressing Enter (the sidebar snapshots the DOM at that moment), (3) the task, and (4) a compact 4-5 line status-report template (URL | key counts | page state | pass/fail or picks).',
  ai_studio:
    'Target: Google AI Studio Focused Chat (#1-#5). Output ONE prompt block that can be pasted directly into the matching Google AI Studio chat to explore UX/data options, answer 2-3 clarifying questions, and maintain a cumulative "SAVED MASTER SPEC & IDE QUEUE" block.',
  antigravity_ide:
    `Target: Any Coding IDE Agent (IDE-independent — works identically in VS Code Cline, Antigravity IDE, Cursor, etc.). Output a single surgical prompt that begins with TWO model-selection lines: Line 1 = primary recommended model header ("${DEV_AI_HEADER_ARGON}" for standard 1-3 file UI/feature work, "${DEV_AI_HEADER_CARBON}" for architecture planning or tricky multi-store/API adapters, "${DEV_AI_HEADER_HYDROGEN}" for reads/docs/verify, or "${DEV_AI_HEADER_CLAUDE}" ONLY as a rare 2nd-opinion tie-breaker); Line 2 = "💡 IF CLAUDE IS SELECTED IN YOUR PICKER: Best $0-pool Gemini alternative for this exact task is [Gemini 4 Carbon (High) | Gemini 4 Argon (Medium) | Gemini 4 Hydrogen (Low)]" + whether to start in Plan Mode first vs. Direct Act/Edit Mode. Then include ALLOWED FILES (MAX 3) with paths, batch parallel reads/edits via native IDE file tools (never PowerShell file-writes), the exact bug fix or feature implementation addressing the User Issue Description, and a FORBIDDEN ACTIONS list (no unrelated refactors, no extra file reads, no local astro build / npm run build, no schema violations). Finish with: run npm run verify then git add/commit and git push origin HEAD (never push main unless explicitly asked). Use only file paths you are confident exist; otherwise say "locate with a read-only scout first".`,
  product_spec:
    'Target: a mobile-scannable product spec: goal, user flow, data rules, acceptance criteria, test plan on the alpha branch, and an IDE task queue.',
};

const SYSTEM_RULES = `You are the AI Ally for The Huckleberry Collective & Resale Command.
You turn a rough idea or reported issue description into a ready-to-use prompt for the chosen destination, grounded ONLY in the provided skill context.

HARD RULES:
- Directly address the user's full Issue Description & Expected Behavior (for example, if the user reports that Quick Scout estimate range cards are not saved when tracking a scouted item/lot into inventory, design the prompt to preserve and display those estimate cards/ranges on the tracked item).
- Value items from secondary-market sold comps only; never anchor to retail MSRP.
- Never invent items, SKUs, barcodes, prices, or file paths you cannot support from the context.
- Never hardcode item-specific price caps. Prefer generalizable inspection or UX rules.
- If the input is an AI issue report, FIRST run a 3-point anti-bias audit: (1) one-item overfitting vs general principle, (2) seller-optimism / buyer-lowball / MSRP bias, (3) was the clue actually visible in the photos (photo limit) vs an AI logic or UI persistence bug.
- In "coPilotNotes", explicitly tell the user WHICH chat/IDE surface to paste this prompt into and why.
- Prefer tightening an existing rule over adding a new one (prompt bloat).
Return ONLY valid JSON with this exact shape:
{"title": string, "promptText": string, "coPilotNotes": string, "followUpQuestions": [{"question": string, "chips": string[]}], "antiBiasAudit": string}
followUpQuestions: 2-3 items, each with 2-4 short tap-able chips. antiBiasAudit: "" unless the input is a report or a proposed rule/prompt change.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function extractJson(text: string): any | null {
  const cleaned = text.replace(/```json|```/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const idea = String(body.idea || '').trim().slice(0, MAX_IDEA_CHARS);
    const issueDescription = String(body.issueDescription || '').trim().slice(0, MAX_IDEA_CHARS);
    const cardTitle = String(body.cardTitle || '').trim().slice(0, 300);
    const kind = (body.kind as VaultNoteKind) || 'prompt';
    const surface = body.surface as AiSurface | undefined;
    const issueType = body.issueType as AiIssueType | undefined;
    const rootCause = body.rootCause as AiRootCause | undefined;
    const currentDraft = String(body.currentDraft || '').slice(0, MAX_IDEA_CHARS);
    const userRefinement = String(body.userRefinement || '').slice(0, 1000);
    const reportContext = String(body.reportContext || '').slice(0, 2000);
    const requestedIds: string[] = Array.isArray(body.bundleIds) ? body.bundleIds.map(String) : [];

    const combinedIdea = [cardTitle, issueDescription, idea]
      .filter(Boolean)
      .join('\n\n')
      .trim()
      .slice(0, MAX_IDEA_CHARS);

    if (!combinedIdea) return json({ error: 'Add a rough idea or issue description first.' }, 400);

    const routingGuide = recommendVaultTemplateAndSurface(
      {
        kind,
        title: cardTitle || idea.slice(0, 80),
        body: issueDescription || idea,
        surface,
        issueType,
        rootCause,
        itemContext: reportContext,
      },
      DESTINATION_META[body.destination as PromptTargetDestination]
        ? (body.destination as PromptTargetDestination)
        : undefined
    );

    const destination: PromptTargetDestination = routingGuide.recommendedDestination;

    const specialistIds = (
      requestedIds.length
        ? requestedIds
        : routingGuide.recommendedBundles.length
          ? routingGuide.recommendedBundles
          : matchSkillBundlesForIdea(`${combinedIdea} ${reportContext}`, 2)
    )
      .filter((id) => id !== CORE_BUNDLE_ID && SKILL_BUNDLES.some((b) => b.id === id))
      .slice(0, 2);

    const core = SKILL_BUNDLES.find((b) => b.id === CORE_BUNDLE_ID);
    const contextBlocks = [
      core ? `### CORE (${core.id})\n${core.content.slice(0, CORE_CONTEXT_CHARS)}` : '',
      ...specialistIds.map((id) => {
        const b = SKILL_BUNDLES.find((x) => x.id === id)!;
        return `### SPECIALIST (${b.id})\n${b.content.slice(0, SPECIALIST_CONTEXT_CHARS)}`;
      }),
    ].filter(Boolean);

    const prompt = [
      SYSTEM_RULES,
      '',
      '=== DESTINATION & ROUTING GUIDE ===',
      DESTINATION_INSTRUCTIONS[destination],
      `Recommended Surface: ${routingGuide.whereToPasteLabel}`,
      `Recommended Model / Chat: ${routingGuide.modelPickerBadge}`,
      `Matched Playbook Template: ${routingGuide.recommendedPresetTitle}`,
      '',
      '=== SKILL CONTEXT ===',
      contextBlocks.join('\n\n'),
      '',
      '=== CARD TITLE & USER ISSUE DESCRIPTION / GOAL ===',
      combinedIdea,
      reportContext ? `\n=== ATTACHED SCAN / ITEM SNAPSHOT ===\n${reportContext}` : '',
      currentDraft ? `\n=== CURRENT DRAFT (revise this) ===\n${currentDraft}` : '',
      userRefinement ? `\n=== USER REFINEMENT ===\n${userRefinement}` : '',
    ].join('\n');

    const aiResponse = await generateContentWithBackoff(prompt);
    const raw: string = aiResponse?.response?.text?.() || '';
    const modelVersion = String(aiResponse?.response?.modelVersion || 'gemini-flash-latest');
    const parsed = extractJson(raw);

    const promptText = String(parsed?.promptText || raw).trim();
    const result = {
      title: String(parsed?.title || cardTitle || idea.slice(0, 60)),
      promptText,
      coPilotNotes: String(parsed?.coPilotNotes || routingGuide.whyThisSurface),
      followUpQuestions: Array.isArray(parsed?.followUpQuestions)
        ? parsed.followUpQuestions.slice(0, 3).map((q: any) => ({
            question: String(q?.question || ''),
            chips: Array.isArray(q?.chips) ? q.chips.slice(0, 4).map(String) : [],
          }))
        : [],
      antiBiasAudit: String(parsed?.antiBiasAudit || ''),
      bundlesUsed: specialistIds,
      routingGuide,
      opsImpact: estimatePromptOpsImpact(promptText),
      modelVersion,
    };
    return json(result);
  } catch (err: any) {
    console.error('[generate-vault-prompt] failed:', err);
    return json({ error: err?.message || 'Prompt generation failed.' }, 500);
  }
};

export const prerender = false;

import type { APIRoute } from 'astro';
import { generateContentWithBackoff } from '../../lib/gemini';
import { SKILL_BUNDLES, CORE_BUNDLE_ID, matchSkillBundlesForIdea } from '../../lib/generatedSkillBundles';
import { estimatePromptOpsImpact, DESTINATION_META, type PromptTargetDestination } from '../../lib/founderVault';

const MAX_IDEA_CHARS = 4000;
const CORE_CONTEXT_CHARS = 7000;
const SPECIALIST_CONTEXT_CHARS = 9000;

const DESTINATION_INSTRUCTIONS: Record<PromptTargetDestination, string> = {
  gemini_app:
    'Target: the Gemini mobile app / gemini.google.com/app. Phone-screen friendly (short punchy bullets). The prompt must tell Gemini to act as an interactive co-pilot: give a recommendation FIRST, then ask 1-2 sharp follow-up questions. If it involves designing app features, tell Gemini to maintain a cumulative "SAVED MASTER SPEC & IDE QUEUE" block at the bottom of each reply.',
  chrome_sidebar:
    'Target: the Chrome Gemini sidebar reading the live page. The prompt MUST contain: (1) a first line "OPEN PAGE FIRST: <exact page URL or page type>", (2) a step-by-step pre-click checklist of what to open/scroll/expand BEFORE pressing Enter (the sidebar snapshots the DOM at that moment), (3) the task, and (4) a compact 4-5 line status-report template (URL | key counts | page state | pass/fail or picks).',
  ai_studio:
    'Target: Google AI Studio. Output ONE prompt block that can be pasted as System Instructions plus a short first user message, grounded in the business context.',
  antigravity_ide:
    'Target: Antigravity IDE. Output a single surgical prompt that begins with a model-picker header line (use "PICK IN ANTIGRAVITY: Gemini 4 Argon Medium" for multi-file work or "PICK IN ANTIGRAVITY: Gemini 3.8 Flash" for reads/docs), then ALLOWED FILES (MAX 3) with paths, MAX TOOL CALLS: 3, the change, and a FORBIDDEN ACTIONS list (no unrelated refactors, no extra file reads, no local astro build / npm run build, no schema violations). Finish with: run npm run verify then git add/commit and git push origin HEAD (never push main unless explicitly asked). Use only file paths you are confident exist; otherwise say "locate with a read-only scout first".',
  product_spec:
    'Target: a mobile-scannable product spec: goal, user flow, data rules, acceptance criteria, test plan on the alpha branch, and an IDE task queue.',
};

const SYSTEM_RULES = `You are the Interactive Prompt Co-Pilot for The Huckleberry Collective & Resale Command.
You turn a rough idea into a ready-to-use prompt for the chosen destination, grounded ONLY in the provided skill context.

HARD RULES:
- Value items from secondary-market sold comps only; never anchor to retail MSRP.
- Never invent items, SKUs, barcodes, prices, or file paths you cannot support from the context.
- Never hardcode item-specific price caps. Prefer generalizable inspection rules.
- If the input is an AI issue report, FIRST run a 3-point anti-bias audit: (1) one-item overfitting vs general principle, (2) seller-optimism / buyer-lowball / MSRP bias, (3) was the clue actually visible in the photos (photo limit) vs an AI logic miss. If it is a photo limit, say no prompt change is warranted.
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
    const destination: PromptTargetDestination = DESTINATION_META[body.destination as PromptTargetDestination]
      ? body.destination
      : 'gemini_app';
    const currentDraft = String(body.currentDraft || '').slice(0, MAX_IDEA_CHARS);
    const userRefinement = String(body.userRefinement || '').slice(0, 1000);
    const reportContext = String(body.reportContext || '').slice(0, 2000);
    const requestedIds: string[] = Array.isArray(body.bundleIds) ? body.bundleIds.map(String) : [];

    if (!idea) return json({ error: 'Add a rough idea first.' }, 400);

    const specialistIds = (requestedIds.length ? requestedIds : matchSkillBundlesForIdea(`${idea} ${reportContext}`, 2))
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
      '=== DESTINATION INSTRUCTIONS ===',
      DESTINATION_INSTRUCTIONS[destination],
      '',
      '=== SKILL CONTEXT ===',
      contextBlocks.join('\n\n'),
      '',
      '=== USER IDEA ===',
      idea,
      reportContext ? `\n=== REPORT CONTEXT ===\n${reportContext}` : '',
      currentDraft ? `\n=== CURRENT DRAFT (revise this) ===\n${currentDraft}` : '',
      userRefinement ? `\n=== USER REFINEMENT ===\n${userRefinement}` : '',
    ].join('\n');

    const aiResponse = await generateContentWithBackoff(prompt);
    const raw: string = aiResponse?.response?.text?.() || '';
    const parsed = extractJson(raw);

    const promptText = String(parsed?.promptText || raw).trim();
    const result = {
      title: String(parsed?.title || idea.slice(0, 60)),
      promptText,
      coPilotNotes: String(parsed?.coPilotNotes || ''),
      followUpQuestions: Array.isArray(parsed?.followUpQuestions)
        ? parsed.followUpQuestions.slice(0, 3).map((q: any) => ({
            question: String(q?.question || ''),
            chips: Array.isArray(q?.chips) ? q.chips.slice(0, 4).map(String) : [],
          }))
        : [],
      antiBiasAudit: String(parsed?.antiBiasAudit || ''),
      bundlesUsed: specialistIds,
      opsImpact: estimatePromptOpsImpact(promptText),
    };
    return json(result);
  } catch (err: any) {
    console.error('[generate-vault-prompt] failed:', err);
    return json({ error: err?.message || 'Prompt generation failed.' }, 500);
  }
};

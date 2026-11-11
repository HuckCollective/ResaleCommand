import type { APIRoute } from 'astro';
import { generateContentWithBackoff, parseAiJson, THINKING_BUDGET_PRESETS } from '../../lib/gemini';
import { cleanEscapedCurrency } from '../../lib/safeMarkdown';

export const prerender = false;

const VALID_CATEGORIES = [
  'Booth & Physical Footprint',
  'Inventory & Consignment',
  'Hardware & Equipment',
  'Software & Tech Commons',
  'Policy & Membership',
] as const;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const mode: 'format_md' | 'draft_proposal' =
      body?.mode === 'draft_proposal' ? 'draft_proposal' : 'format_md';

    const title = cleanEscapedCurrency(body?.title || '').trim();
    const description = cleanEscapedCurrency(body?.description || '').trim();
    const rationale = cleanEscapedCurrency(body?.rationale || '').trim();
    const financialImpact = cleanEscapedCurrency(body?.financialImpact || '').trim();
    const roughNotes = cleanEscapedCurrency(body?.roughNotes || '').trim();

    if (mode === 'format_md' && !description && !rationale) {
      return new Response(
        JSON.stringify({ error: 'Provide description or rationale text to format.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (mode === 'draft_proposal' && !roughNotes && !description && !title) {
      return new Response(
        JSON.stringify({ error: 'Provide rough notes or a topic so the AI helper can draft your proposal.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const systemInstruction = `You are the Co-op Governance Editor for The Huckleberry Collective (Works@TheHC — a Worker Self-Directed Enterprise running a 70% Curator / 30% Shared Commons Pool waterfall, Memory Den Booth #0EJ at $382.50/mo rent, and 4-signal Loomio consent voting).
NEVER escape dollar signs with backslashes (write $3,000, NEVER \\$3,000).
Output strictly valid JSON matching the requested schema with zero markdown fences around the JSON.`;

    const prompt =
      mode === 'format_md'
        ? `Reformat this existing co-op proposal into crisp, scannable GitHub-Flavored Markdown WITHOUT changing any numbers, percentages, dollar thresholds, partner names, or voting options.

RULES:
1. Preserve 100% of facts, dollar figures, percentages, options (e.g. Option A / B / C), and rules verbatim in meaning.
2. Break walls of text into clean \`###\` section headings, \`-\` bullet lists, and bold lead-ins (\`**Term:** details\`).
3. Never write \`\\$\` — always write plain \`$\`.
4. If CURRENT FINANCIAL IMPACT is empty or identical to the title, write a crisp 1-line financial/operational impact summary (under 110 chars). Otherwise keep it clean.

CURRENT TITLE: ${title}
CURRENT FINANCIAL IMPACT: ${financialImpact}
CURRENT DESCRIPTION:
${description}

CURRENT RATIONALE:
${rationale}

Return JSON:
{
  "title": "clean title without backslash escapes",
  "financialImpact": "concise 1-line impact summary",
  "description": "clean GFM markdown string",
  "rationale": "clean GFM markdown string"
}`
        : `Draft a clear, democratic 4-Signal Loomio Co-op Governance Proposal from the member's rough notes below.

VALID CATEGORIES: ${VALID_CATEGORIES.join(' | ')}

MEMBER NOTES / PROMPT:
${roughNotes || description || title}
${title ? `SUGGESTED TITLE: ${title}` : ''}

RULES:
1. Structure \`description\` in clean GitHub-Flavored Markdown (\`### 1. What Changes\`, \`### 2. Operational Mechanics\`, \`### 3. Signal Options / Scope\`) using concise \`-\` bullets and \`**bold**\` callouts.
2. Structure \`rationale\` in 2–4 concise bullets explaining how this protects cash reserves, accelerates physical booth/online sales, or aligns with our 70/30 WSDE Commons Pool.
3. Write a crisp 1-line \`financialImpact\` summary (e.g. "$0 upfront cash; banks Tier 2 (25 pts) Sweat Equity").
4. Never escape dollar signs (\`$3,000\`, never \`\\$3,000\`).

Return JSON:
{
  "title": "Clear Proposal Motion Title",
  "category": "one of VALID CATEGORIES",
  "financialImpact": "1-line cost / surplus impact",
  "description": "GFM markdown specification",
  "rationale": "GFM markdown WSDE rationale"
}`;

    const result = await generateContentWithBackoff({
      systemInstruction,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: mode === 'format_md' ? 0.15 : 0.35,
        thinkingBudget: THINKING_BUDGET_PRESETS.FAST_EXTRACTION,
      },
    });

    const rawText = result.response.text();
    const parsed = parseAiJson<Record<string, any>>(rawText, {});

    const pickedCategory = VALID_CATEGORIES.includes(parsed.category)
      ? parsed.category
      : body?.category && VALID_CATEGORIES.includes(body.category)
        ? body.category
        : 'Policy & Membership';

    return new Response(
      JSON.stringify({
        title: cleanEscapedCurrency(parsed.title || title),
        category: pickedCategory,
        financialImpact: cleanEscapedCurrency(parsed.financialImpact || financialImpact),
        description: cleanEscapedCurrency(parsed.description || description),
        rationale: cleanEscapedCurrency(parsed.rationale || rationale),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[/api/format-coop-proposal] Error:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Failed to format proposal with AI helper.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

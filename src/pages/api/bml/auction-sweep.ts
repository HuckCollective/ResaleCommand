import type { APIRoute } from 'astro';
import { loadAppraisalRules } from '../../../lib/appraisalCalibration';
import {
  MAX_SLEEPER_THUMBS,
  buildAuctionSweepPrompt,
  sanitizeSweepCandidates,
  scoreAndRankSweepLots,
  selectSleeperThumbnailIndices,
  type SweepAiLotAssessment,
} from '../../../lib/auctionSweep';
import { BML_CORS_HEADERS, requireBookmarkletMember } from '../../../lib/bml/serverAuth';
import {
  THINKING_BUDGET_PRESETS,
  generateContentWithBackoff,
  parseAiJson,
} from '../../../lib/gemini';
import { loadLiveWarehouseDocs } from '../../../lib/locationSettingsServer';

export const prerender = false;

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: BML_CORS_HEADERS });
};

const MAX_THUMB_BYTES = 1_600_000;

async function fetchThumbnailInlinePart(
  rawUrl: string,
  pageOrigin?: string
): Promise<{ inlineData: { data: string; mimeType: string } } | null> {
  const cleanUrl = String(rawUrl || '').trim();
  if (!/^https?:\/\//i.test(cleanUrl)) return null;

  const headers: Record<string, string> = {
    Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  };
  if (pageOrigin && /^https?:\/\//i.test(pageOrigin)) {
    headers.Referer = pageOrigin;
  }

  try {
    const res = await fetch(cleanUrl, {
      headers,
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;

    const declaredLen = Number(res.headers.get('content-length') || 0);
    if (declaredLen > MAX_THUMB_BYTES) return null;

    const ab = await res.arrayBuffer();
    if (ab.byteLength === 0 || ab.byteLength > MAX_THUMB_BYTES) return null;

    let mime = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!mime || mime === 'application/octet-stream' || !mime.startsWith('image/')) {
      mime = 'image/jpeg';
    }
    if (mime === 'image/svg+xml') return null;

    const data = Buffer.from(ab).toString('base64');
    if (!data) return null;

    return {
      inlineData: {
        data,
        mimeType: mime,
      },
    };
  } catch {
    return null;
  }
}

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireBookmarkletMember(request);
  if (auth.ok === false) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const candidates = sanitizeSweepCandidates(body?.candidates);
    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'No active auction cards were provided to sweep.',
        }),
        { status: 400, headers: BML_CORS_HEADERS }
      );
    }

    const pageUrl = String(body?.pageUrl || '').trim();
    let pageOrigin = '';
    try {
      if (pageUrl) pageOrigin = new URL(pageUrl).origin;
    } catch {}

    const useVision = body?.useVisionOnSleepers !== false;

    const [liveWarehouses, appraisalRules] = await Promise.all([
      loadLiveWarehouseDocs(),
      loadAppraisalRules(),
    ]);

    const targetThumbIndices = useVision
      ? selectSleeperThumbnailIndices(candidates, MAX_SLEEPER_THUMBS)
      : [];

    const fetchedThumbResults = await Promise.all(
      targetThumbIndices.map(async (lotIdx) => {
        const part = await fetchThumbnailInlinePart(candidates[lotIdx]?.thumbnailUrl || '', pageOrigin);
        return { lotIdx, part };
      })
    );

    const imageSlotByLotIndex = new Map<number, number>();
    const visionIndices = new Set<number>();
    const imageParts: Array<{ inlineData: { data: string; mimeType: string } }> = [];

    for (const item of fetchedThumbResults) {
      if (item.part) {
        const slot = imageParts.length;
        imageParts.push(item.part);
        imageSlotByLotIndex.set(item.lotIdx, slot);
        visionIndices.add(item.lotIdx);
      }
    }

    const promptText = buildAuctionSweepPrompt(
      candidates,
      imageSlotByLotIndex,
      appraisalRules,
      liveWarehouses
    );

    const aiRes = await generateContentWithBackoff(
      {
        contents: [
          {
            role: 'user',
            parts: [{ text: promptText }, ...imageParts],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          thinkingBudget: THINKING_BUDGET_PRESETS.BALANCED_SCOUT,
        },
      },
      undefined,
      6,
      2000,
      {
        surface: 'bml_sgw_tray',
        verdict: 'BUY',
        rulesVersion: appraisalRules.version,
      }
    );

    const rawText = aiRes.response.text();
    const parsed = parseAiJson<{ lots?: SweepAiLotAssessment[] } | SweepAiLotAssessment[]>(
      rawText,
      { lots: [] }
    );
    const aiAssessments: SweepAiLotAssessment[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.lots)
        ? parsed.lots
        : [];

    const { lots, summary } = scoreAndRankSweepLots(
      candidates,
      aiAssessments,
      visionIndices,
      appraisalRules,
      liveWarehouses
    );

    return new Response(
      JSON.stringify({
        ok: true,
        summary,
        lots,
        rulesVersion: appraisalRules.version,
      }),
      { status: 200, headers: BML_CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[auction-sweep] Error sweeping active auction grid:', err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Auction Sweep failed',
        details: err?.message || String(err),
      }),
      { status: 500, headers: BML_CORS_HEADERS }
    );
  }
};

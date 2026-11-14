import type { APIRoute } from 'astro';
import { model, generateContentWithBackoff, parseAiJson } from '../../lib/gemini';
import {
  buildLiveEstimateVsSoldScorecardServer,
  compileRulesPrompt,
  getDefaultAppraisalRules,
  loadAppraisalRules,
  saveAppraisalRules,
  type AppraisalRulesConfig,
} from '../../lib/appraisalCalibration';
import {
  getAllLocationSettingMetas,
  resolveCanonicalLocationCode,
  type LocationSettingMeta,
} from '../../lib/warehouses';
import { requireBookmarkletMember } from '../../lib/bml/serverAuth';

export const prerender = false;

const JSON_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, max-age=0',
};

async function fetchLiveWarehousesServer(): Promise<any[]> {
  const endpoint =
    import.meta.env.PUBLIC_APPWRITE_ENDPOINT || process.env.PUBLIC_APPWRITE_ENDPOINT || '';
  const project =
    import.meta.env.PUBLIC_APPWRITE_PROJECT_ID || process.env.PUBLIC_APPWRITE_PROJECT_ID || '';
  const apiKey = import.meta.env.APPWRITE_API_KEY || process.env.APPWRITE_API_KEY || '';
  const dbId =
    import.meta.env.PUBLIC_APPWRITE_DB_ID || process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

  if (!endpoint || !project || !apiKey) return [];
  try {
    const { Client, Databases, Query } = await import('node-appwrite');
    const client = new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey);
    const db = new Databases(client);
    const res = await db.listDocuments(dbId, 'warehouses', [Query.limit(50)]);
    return res.documents || [];
  } catch {
    return [];
  }
}

function isCurioExcludedItem(text: string): boolean {
  return /\b(jacket|coat|shirt|tee|dress|pants|jeans|skirt|boots|shoes|sweater|hoodie|playset|furniture|monitor|console|large|bulky)\b/i.test(
    text
  );
}

interface ChannelValuationRow {
  code: string;
  label: string;
  grossPrice: number;
  feePct: number;
  fixedFeeUsd: number;
  netPayout: number;
  eligible: boolean;
  exclusionNote?: string;
}

function computeVenueBreakdown(
  fairOnline: number,
  boutiqueBase: number,
  rules: AppraisalRulesConfig,
  metas: LocationSettingMeta[],
  itemContextText: string
): {
  channels: ChannelValuationRow[];
  bestChannel: ChannelValuationRow;
} {
  const channels: ChannelValuationRow[] = [];
  const excludedFromSmallCurio = isCurioExcludedItem(itemContextText);

  // Dynamic Physical Retail Booths (Law 2: read strictly from warehouses.ts)
  for (const meta of metas) {
    if (meta.commissionRate <= 0) continue; // Skip backstock facilities (0% commission)
    const bias = rules.venueBias?.[meta.code] ?? 1.0;
    const isSmallCurioBooth = /no\s+clothes|small\s+collectibles|<8"/i.test(
      `${meta.vibesAndNotes || ''}`
    );
    const eligible = !(isSmallCurioBooth && excludedFromSmallCurio);
    const gross = Math.max(1, Math.round(boutiqueBase * bias));
    const feeUsd = Number((gross * (meta.commissionRate / 100)).toFixed(2));
    const net = Number(Math.max(0, gross - feeUsd).toFixed(2));

    channels.push({
      code: meta.code,
      label: `${meta.shortName} (${meta.code})`,
      grossPrice: gross,
      feePct: meta.commissionRate,
      fixedFeeUsd: 0,
      netPayout: net,
      eligible,
      exclusionNote: eligible ? undefined : 'Excluded by booth size/apparel policy',
    });
  }

  // Online Channel: eBay
  const ebayGross = Math.max(1, Number(fairOnline.toFixed(2)));
  const ebayFeeUsd = Number(
    (ebayGross * (rules.channelFees.ebayPct / 100) + rules.channelFees.ebayFixedUsd).toFixed(2)
  );
  channels.push({
    code: 'EBAY',
    label: 'eBay (Sold Comps)',
    grossPrice: ebayGross,
    feePct: rules.channelFees.ebayPct,
    fixedFeeUsd: rules.channelFees.ebayFixedUsd,
    netPayout: Number(Math.max(0, ebayGross - ebayFeeUsd).toFixed(2)),
    eligible: true,
  });

  // Online Channel: Poshmark (20% >= $15, flat $2.95 < $15 per secondary-market-appraisal-and-valuation)
  const poshGross = Math.max(1, Number(fairOnline.toFixed(2)));
  const isUnder15 = poshGross < 15;
  const poshFeeUsd = isUnder15
    ? rules.channelFees.poshmarkUnder15FlatUsd
    : Number((poshGross * (rules.channelFees.poshmarkPct / 100)).toFixed(2));
  channels.push({
    code: 'POSHMARK',
    label: 'Poshmark',
    grossPrice: poshGross,
    feePct: isUnder15
      ? Number(((poshFeeUsd / poshGross) * 100).toFixed(1))
      : rules.channelFees.poshmarkPct,
    fixedFeeUsd: isUnder15 ? rules.channelFees.poshmarkUnder15FlatUsd : 0,
    netPayout: Number(Math.max(0, poshGross - poshFeeUsd).toFixed(2)),
    eligible: true,
  });

  const eligibleChannels = channels.filter((c) => c.eligible);
  const bestChannel =
    eligibleChannels.sort((a, b) => b.netPayout - a.netPayout)[0] || channels[0];

  return { channels, bestChannel };
}

/**
 * GET /api/estimate-price
 * - `?mode=lab_snapshot&windowDays=180` -> returns live calibration rules + warehouses metas + 10-rule Truth Scorecard
 * - `?mode=rules` -> returns live calibration rules + defaults
 */
export const GET: APIRoute = async ({ request }) => {
  const auth = await requireBookmarkletMember(request, { allowSameOriginCookieFallback: true });
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get('mode') || 'lab_snapshot';
    const windowDays = Math.min(
      730,
      Math.max(7, parseInt(url.searchParams.get('windowDays') || '180', 10) || 180)
    );

    const [rules, liveWarehouses] = await Promise.all([
      loadAppraisalRules(),
      fetchLiveWarehousesServer(),
    ]);
    const warehouseMetas = getAllLocationSettingMetas(liveWarehouses);

    if (mode === 'rules') {
      return new Response(
        JSON.stringify({
          success: true,
          rules,
          defaults: getDefaultAppraisalRules(),
          warehouses: warehouseMetas,
          promptPreview: compileRulesPrompt(rules, liveWarehouses),
        }),
        { status: 200, headers: JSON_HEADERS }
      );
    }

    const scorecard = await buildLiveEstimateVsSoldScorecardServer(windowDays);

    return new Response(
      JSON.stringify({
        success: true,
        rules,
        defaults: getDefaultAppraisalRules(),
        warehouses: warehouseMetas,
        scorecard,
        promptPreview: compileRulesPrompt(rules, liveWarehouses),
      }),
      { status: 200, headers: JSON_HEADERS }
    );
  } catch (err: any) {
    console.error('[GET /api/estimate-price] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Failed to load appraisal lab data' }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
};

/**
 * PUT /api/estimate-price
 * Saves or resets `ai_appraisal_rules_v1` with Founder/Curator auth & optimistic `expectedVersion` lock.
 */
export const PUT: APIRoute = async ({ request }) => {
  const auth = await requireBookmarkletMember(request, { allowSameOriginCookieFallback: true });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const updated = await saveAppraisalRules({
      ...body,
      expectedVersion:
        typeof body?.expectedVersion === 'number' ? body.expectedVersion : undefined,
      resetToDefaults: Boolean(body?.resetToDefaults),
    });
    const liveWarehouses = await fetchLiveWarehousesServer();

    return new Response(
      JSON.stringify({
        success: true,
        rules: updated,
        promptPreview: compileRulesPrompt(updated, liveWarehouses),
        cacheNotice: 'Saved — applies to all scans within 5 minutes.',
      }),
      { status: 200, headers: JSON_HEADERS }
    );
  } catch (err: any) {
    const msg = String(err?.message || 'Failed to save calibration rules');
    const isConflict = /version conflict/i.test(msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: isConflict ? 409 : 400,
      headers: JSON_HEADERS,
    });
  }
};

/**
 * POST /api/estimate-price
 * Venue- and fee-aware secondary market price estimator & calibration testbench.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    // Support `mode: 'save_rules' | 'reset_rules'` via POST as well for convenience
    if (body?.mode === 'save_rules' || body?.mode === 'reset_rules') {
      const auth = await requireBookmarkletMember(request, {
        allowSameOriginCookieFallback: true,
      });
      if (!auth.ok) return auth.response;

      const updated = await saveAppraisalRules({
        ...(body.rules || body),
        expectedVersion:
          typeof body?.expectedVersion === 'number' ? body.expectedVersion : undefined,
        resetToDefaults: body.mode === 'reset_rules' || Boolean(body?.resetToDefaults),
      });
      const liveWarehouses = await fetchLiveWarehousesServer();
      return new Response(
        JSON.stringify({
          success: true,
          rules: updated,
          promptPreview: compileRulesPrompt(updated, liveWarehouses),
          cacheNotice: 'Saved — applies to all scans within 5 minutes.',
        }),
        { status: 200, headers: JSON_HEADERS }
      );
    }

    const title = String(body?.title || '').trim();
    const description = String(body?.description || '').trim();
    const condition = String(body?.condition || '').trim();
    const category = String(body?.category || '').trim();
    const msrpTagPrice = Number(body?.msrpTagPrice) > 0 ? Number(body.msrpTagPrice) : 0;
    const preferredVenueRaw = String(body?.preferredVenue || '').trim();

    if (!title) {
      return new Response(
        JSON.stringify({ error: 'Item title is required for price estimation.' }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    if (!model) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 503,
        headers: JSON_HEADERS,
      });
    }

    const [rules, liveWarehouses] = await Promise.all([
      loadAppraisalRules(),
      fetchLiveWarehousesServer(),
    ]);
    const metas = getAllLocationSettingMetas(liveWarehouses);
    const itemContext = [title, description, condition, category].filter(Boolean).join(' ');
    const rulesPrompt = compileRulesPrompt(rules, liveWarehouses, itemContext);

    const boothSummary = metas
      .filter((m) => m.commissionRate > 0)
      .map(
        (m) =>
          `${m.code} (${m.name}, ${m.commissionRate}% fee${m.vibesAndNotes ? ` — ${m.vibesAndNotes}` : ''})`
      )
      .join('; ');

    const prompt = `You are a disciplined secondary-market appraiser for a vintage/collectibles resale co-op.
Anchor STRICTLY to realistic cash-cleared SOLD secondary market comparables — NEVER anchor to original retail MSRP or unsold wishful asking prices.

${rulesPrompt}

Available Physical Retail Booths: ${boothSummary}
Item Title: "${title}"
${condition ? `Condition: ${condition}` : ''}
${category ? `Category: ${category}` : ''}
${msrpTagPrice > 0 ? `Original Retail MSRP Tag (DO NOT ANCHOR TO THIS): $${msrpTagPrice}` : ''}
${description ? `Details: ${description}` : ''}

Return ONLY valid JSON with this exact shape:
{
  "min": number,
  "max": number,
  "fair": number,
  "boutiquePrice": number,
  "recommendedVenueCode": "string (booth code or EBAY or POSHMARK)",
  "isRareCollectible": boolean,
  "reason": "1-2 concise sentences citing realistic sold comp range and condition/venue fit"
}`;

    const result = await generateContentWithBackoff({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
      telemetryContext: {
        surface: 'estimate_price',
        rulesVersion: rules.version,
      },
    });

    const text = result.response.text();
    const rawData = parseAiJson(text) || {};

    let min = Math.max(1, Number(rawData.min) || Number(rawData.fair) * 0.75 || 5);
    let max = Math.max(min, Number(rawData.max) || Number(rawData.fair) * 1.25 || min);
    let fair = Math.max(
      min,
      Math.min(max * 1.15, Number(rawData.fair) || Number(((min + max) / 2).toFixed(2)))
    );
    let boutiquePrice = Math.max(
      fair,
      Number(rawData.boutiquePrice) || Math.round(fair * 1.18)
    );
    const isRareCollectible = Boolean(rawData.isRareCollectible);

    const warnings: string[] = [];

    // Anti-MSRP Anchoring Guardrail (`secondary-market-appraisal-and-valuation` skill)
    if (msrpTagPrice > 0 && fair > msrpTagPrice * 0.6 && !isRareCollectible) {
      warnings.push(
        `MSRP Ceiling Alert: Fair online estimate ($${fair.toFixed(2)}) exceeds 60% of original MSRP ($${msrpTagPrice.toFixed(2)}). Verify cleared sold comps before paying up.`
      );
    }

    if (boutiquePrice > fair * 2.0) {
      warnings.push(
        `Boutique Tag Cap Applied: Raw boutique tag ($${boutiquePrice.toFixed(2)}) exceeded 2.0x fair online comp ($${fair.toFixed(2)}); clamped to realistic shelf ceiling.`
      );
      boutiquePrice = Math.round(fair * (isRareCollectible ? 1.85 : 1.55));
    }

    const { channels, bestChannel } = computeVenueBreakdown(
      fair,
      boutiquePrice,
      rules,
      metas,
      itemContext
    );

    const requestedCode = preferredVenueRaw
      ? resolveCanonicalLocationCode(preferredVenueRaw, liveWarehouses) ||
        preferredVenueRaw.toUpperCase()
      : '';
    const aiSuggestedCode = rawData.recommendedVenueCode
      ? resolveCanonicalLocationCode(String(rawData.recommendedVenueCode), liveWarehouses) ||
        String(rawData.recommendedVenueCode).toUpperCase()
      : '';

    const chosenChannel =
      channels.find((c) => c.eligible && c.code === requestedCode) ||
      channels.find((c) => c.eligible && c.code === aiSuggestedCode) ||
      bestChannel;

    const netBasis = Math.max(0, chosenChannel.netPayout);
    const maxTargetBids = {
      conservative: Number((netBasis / rules.roiTargets.conservative).toFixed(2)),
      balanced: Number((netBasis / rules.roiTargets.balanced).toFixed(2)),
      aggressive: Number((netBasis / rules.roiTargets.aggressive).toFixed(2)),
    };

    const quickFloorPrice = Number(Math.max(1, min * 0.85).toFixed(2));

    return new Response(
      JSON.stringify({
        min: Number(min.toFixed(2)),
        max: Number(max.toFixed(2)),
        fair: Number(fair.toFixed(2)),
        quickFloorPrice,
        boutiquePrice: Number(boutiquePrice.toFixed(2)),
        recommendedVenue: chosenChannel.label,
        recommendedVenueCode: chosenChannel.code,
        venueFeePct: chosenChannel.feePct,
        netAfterVenueFee: chosenChannel.netPayout,
        channelBreakdown: channels,
        maxTargetBids,
        warnings,
        reason: String(rawData.reason || 'Estimated from cleared secondary market comps.'),
        rulesVersion: rules.version,
        promptPreview: rulesPrompt,
      }),
      { status: 200, headers: JSON_HEADERS }
    );
  } catch (error: any) {
    console.error('Price Estimate Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to estimate price' }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
};

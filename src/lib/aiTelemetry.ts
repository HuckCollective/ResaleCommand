import {
  Client as NodeClient,
  Databases as NodeDatabases,
  ID as NodeID,
  Permission as NodePermission,
  Query as NodeQuery,
  Role as NodeRole,
} from 'node-appwrite';

export const AI_TELEMETRY_COL = 'ai_telemetry';
export const MANIFESTS_COL = 'manifests';
export const AI_BILLING_LEDGER_DOC_ID = 'ai_billing_ledger_v1';

export type AiSurface =
  | 'bml_sgw_tray'
  | 'scout_camera'
  | 'scout_url'
  | 'deep_scan_drawer'
  | 'lot_inspector'
  | 'estimate_price'
  | 'sales_sheet_ocr'
  | 'social_dropcast'
  | 'other';

export type AiVerdict = 'BUY' | 'WATCH' | 'PASS' | null;

export interface AiTelemetryContext {
  surface?: AiSurface;
  verdict?: AiVerdict | string | null;
  itemId?: string | null;
  rulesVersion?: number | null;
}

export interface AiTelemetryEventInput {
  surface?: AiSurface;
  model: string;
  verdict?: AiVerdict | string | null;
  promptTokens?: number;
  candTokens?: number;
  thoughtTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  fallback?: boolean;
  rulesVersion?: number | null;
  itemId?: string | null;
}

/**
 * Official Gemini API Token Pricing per 1,000,000 tokens (USD) — Updated Nov 2026.
 * Used for real-time telemetry estimation; actual Google Cloud Invoice in
 * `ai_billing_ledger_v1` always takes precedence when recorded.
 */
export const GEMINI_PRICE_PER_1M: Record<
  'flash_lite' | 'flash' | 'pro',
  { inputUsd: number; outputUsd: number }
> = {
  flash_lite: { inputUsd: 0.075, outputUsd: 0.30 },
  flash: { inputUsd: 0.15, outputUsd: 0.60 },
  pro: { inputUsd: 1.25, outputUsd: 5.00 },
};

export interface SurfaceRollup {
  surface: AiSurface;
  label: string;
  calls: number;
  promptTokens: number;
  candTokens: number;
  thoughtTokens: number;
  totalTokens: number;
  estimatedUsd: number;
  avgLatencyMs: number;
}

export interface ModelRollup {
  model: string;
  calls: number;
  totalTokens: number;
  estimatedUsd: number;
  fallbackCalls: number;
}

export interface MonthlyAiTelemetryRollup {
  monthKey: string;
  label: string;
  totalCalls: number;
  promptTokens: number;
  candTokens: number;
  thoughtTokens: number;
  totalTokens: number;
  estimatedUsd: number;
  avgLatencyMs: number;
  fallbackCount: number;
  funnel: {
    totalScouts: number;
    buyCount: number;
    watchCount: number;
    passCount: number;
    passFilterRatePct: number;
  };
  bySurface: SurfaceRollup[];
  byModel: ModelRollup[];
}

export interface AiBillingMonthOverride {
  invoicedUsd: number | null;
  creditAppliedUsd?: number | null;
  note?: string;
  updatedAt?: string;
}

export interface AiBillingLedger {
  version: number;
  updatedAt: string;
  monthlyCreditGrantUsd: number;
  bankedCreditsUsd: number;
  allTimeBaselineUsd: number;
  months: Record<string, AiBillingMonthOverride>;
}

const SURFACE_LABELS: Record<AiSurface, string> = {
  bml_sgw_tray: '🔭 ShopGoodwill Scout Tray',
  scout_camera: '📸 Speed Scout (Camera)',
  scout_url: '🔗 Speed Scout (URL)',
  deep_scan_drawer: '🔍 Item Drawer Deep Scan',
  lot_inspector: '✂️ Multi-Item Lot Inspector',
  estimate_price: '🏷️ Price & Venue Estimator',
  sales_sheet_ocr: '📝 Paper Sales Sheet OCR',
  social_dropcast: '📣 Social Dropcast Copy',
  other: '⚙️ Other AI Assistant',
};

let warnedTelemetryOnce = false;
const rollupCache = new Map<string, { expiresAt: number; data: MonthlyAiTelemetryRollup }>();
const ROLLUP_CACHE_TTL_MS = 60 * 1000; // 60s

function getAppwriteServer() {
  const endpoint =
    (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_APPWRITE_ENDPOINT) ||
    (typeof process !== 'undefined' && process.env?.PUBLIC_APPWRITE_ENDPOINT) ||
    'https://sfo.cloud.appwrite.io/v1';
  const project =
    (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_APPWRITE_PROJECT_ID) ||
    (typeof process !== 'undefined' && process.env?.PUBLIC_APPWRITE_PROJECT_ID) ||
    '69714b35003a8adab6bb';
  const apiKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.APPWRITE_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.APPWRITE_API_KEY) ||
    '';
  const dbId =
    (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_APPWRITE_DB_ID) ||
    (typeof process !== 'undefined' && process.env?.PUBLIC_APPWRITE_DB_ID) ||
    'resale_db';

  if (!endpoint || !project || !apiKey) {
    return { databases: null, dbId };
  }

  const client = new NodeClient().setEndpoint(endpoint).setProject(project).setKey(apiKey);
  return { databases: new NodeDatabases(client), dbId };
}

export function getPacificMonthAndDay(date: Date = new Date()): {
  monthKey: string;
  dayKey: string;
  label: string;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value || String(date.getUTCFullYear());
  const month = parts.find((p) => p.type === 'month')?.value || '01';
  const day = parts.find((p) => p.type === 'day')?.value || '01';

  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'long',
    year: 'numeric',
  }).format(date);

  return {
    monthKey: `${year}-${month}`,
    dayKey: `${year}-${month}-${day}`,
    label,
  };
}

export function formatMonthKeyLabel(monthKey: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(String(monthKey || '').trim());
  if (!m) return monthKey;
  const year = Number(m[1]);
  const monthIdx = Number(m[2]) - 1;
  const d = new Date(Date.UTC(year, monthIdx, 15, 12, 0, 0));
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function estimateGeminiCallUsdMicros(
  modelName: string,
  promptTokens: number,
  candTokens: number,
  thoughtTokens: number
): number {
  const norm = String(modelName || '').toLowerCase();
  const tier = norm.includes('pro') || norm.includes('carbon')
    ? GEMINI_PRICE_PER_1M.pro
    : norm.includes('lite') || norm.includes('hydrogen')
      ? GEMINI_PRICE_PER_1M.flash_lite
      : GEMINI_PRICE_PER_1M.flash;

  const pTok = Math.max(0, Number(promptTokens) || 0);
  const outTok = Math.max(0, (Number(candTokens) || 0) + (Number(thoughtTokens) || 0));

  const usd = (pTok / 1_000_000) * tier.inputUsd + (outTok / 1_000_000) * tier.outputUsd;
  return Math.max(1, Math.round(usd * 1_000_000));
}

function normalizeVerdict(v: any): AiVerdict {
  const s = String(v || '').trim().toUpperCase();
  if (!s) return null;
  if (s.includes('PASS') || s.includes('WALK') || s.includes('SKIP')) return 'PASS';
  if (s.includes('BUY') || s.includes('BID') || s.includes('STRONG')) return 'BUY';
  if (s.includes('WATCH') || s.includes('FAIR') || s.includes('CAUTION')) return 'WATCH';
  return null;
}

/**
 * Appends a single compact telemetry event document to `resale_db.ai_telemetry`.
 * Never throws; logs at most once per serverless cold start on failure.
 */
export async function recordAiTelemetryEvent(input: AiTelemetryEventInput): Promise<void> {
  try {
    const { databases, dbId } = getAppwriteServer();
    if (!databases) return;

    const now = new Date();
    const { monthKey, dayKey } = getPacificMonthAndDay(now);
    const promptTokens = Math.max(0, Math.round(Number(input.promptTokens) || 0));
    const candTokens = Math.max(0, Math.round(Number(input.candTokens) || 0));
    const thoughtTokens = Math.max(0, Math.round(Number(input.thoughtTokens) || 0));
    const totalTokens =
      Math.max(0, Math.round(Number(input.totalTokens) || 0)) ||
      promptTokens + candTokens + thoughtTokens;
    const usdMicros = estimateGeminiCallUsdMicros(
      input.model,
      promptTokens,
      candTokens,
      thoughtTokens
    );

    const surface: AiSurface = input.surface || 'other';
    const verdict = normalizeVerdict(input.verdict);

    await databases.createDocument(
      dbId,
      AI_TELEMETRY_COL,
      NodeID.unique(),
      {
        ts: now.toISOString(),
        monthKey,
        dayKey,
        surface,
        model: String(input.model || 'gemini-flash-latest').slice(0, 120),
        verdict: verdict || null,
        promptTokens,
        candTokens,
        thoughtTokens,
        totalTokens,
        usdMicros,
        latencyMs: Math.max(0, Math.round(Number(input.latencyMs) || 0)),
        fallback: Boolean(input.fallback),
        rulesVersion:
          typeof input.rulesVersion === 'number' && !isNaN(input.rulesVersion)
            ? Math.round(input.rulesVersion)
            : null,
        itemId: input.itemId ? String(input.itemId).slice(0, 120) : null,
      },
      [
        NodePermission.read(NodeRole.any()),
        NodePermission.update(NodeRole.any()),
        NodePermission.delete(NodeRole.any()),
      ]
    );

    rollupCache.delete(monthKey);
  } catch (err: any) {
    if (!warnedTelemetryOnce) {
      warnedTelemetryOnce = true;
      console.warn('[AiTelemetry] Non-fatal telemetry write skipped:', err?.message || err);
    }
  }
}

/**
 * Serverless-safe delivery helper: uses Vercel's `waitUntil` context if present,
 * otherwise awaits up to 650ms so fast responses don't drop events before returning.
 */
export async function deliverAiTelemetry(input: AiTelemetryEventInput): Promise<void> {
  try {
    const task = recordAiTelemetryEvent(input);
    const vercelCtxSymbol = Symbol.for('@vercel/request-context');
    const vercelCtx = (globalThis as any)[vercelCtxSymbol]?.get?.();
    if (vercelCtx && typeof vercelCtx.waitUntil === 'function') {
      vercelCtx.waitUntil(task);
      return;
    }
    await Promise.race([
      task,
      new Promise<void>((resolve) => setTimeout(resolve, 650)),
    ]);
  } catch {
    // Never propagate telemetry errors
  }
}

export function invalidateAiTelemetryCache(monthKey?: string) {
  if (monthKey) {
    rollupCache.delete(monthKey);
  } else {
    rollupCache.clear();
  }
}

/**
 * Read-time aggregation of `resale_db.ai_telemetry` for a given `YYYY-MM` Pacific month.
 * Paginates with `Query.orderDesc('$id')` cursor loops (capped at 5,000 events) and caches for 60s.
 */
export async function getMonthlyAiTelemetry(
  monthKey?: string,
  forceRefresh = false
): Promise<MonthlyAiTelemetryRollup> {
  const targetMonth = monthKey || getPacificMonthAndDay().monthKey;
  const cached = rollupCache.get(targetMonth);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const emptyRollup: MonthlyAiTelemetryRollup = {
    monthKey: targetMonth,
    label: formatMonthKeyLabel(targetMonth),
    totalCalls: 0,
    promptTokens: 0,
    candTokens: 0,
    thoughtTokens: 0,
    totalTokens: 0,
    estimatedUsd: 0,
    avgLatencyMs: 0,
    fallbackCount: 0,
    funnel: {
      totalScouts: 0,
      buyCount: 0,
      watchCount: 0,
      passCount: 0,
      passFilterRatePct: 0,
    },
    bySurface: [],
    byModel: [],
  };

  const { databases, dbId } = getAppwriteServer();
  if (!databases) return emptyRollup;

  const surfaceMap = new Map<
    AiSurface,
    {
      calls: number;
      promptTokens: number;
      candTokens: number;
      thoughtTokens: number;
      totalTokens: number;
      usdMicros: number;
      latencySum: number;
    }
  >();
  const modelMap = new Map<
    string,
    { calls: number; totalTokens: number; usdMicros: number; fallbackCalls: number }
  >();

  let totalCalls = 0;
  let promptTokens = 0;
  let candTokens = 0;
  let thoughtTokens = 0;
  let totalTokens = 0;
  let totalUsdMicros = 0;
  let totalLatencyMs = 0;
  let fallbackCount = 0;

  let buyCount = 0;
  let watchCount = 0;
  let passCount = 0;

  let cursor: string | null = null;
  const maxPages = 50; // 50 * 100 = 5,000 events cap

  try {
    for (let page = 0; page < maxPages; page++) {
      const queries: string[] = [
        NodeQuery.equal('monthKey', targetMonth),
        NodeQuery.orderDesc('$id'),
        NodeQuery.limit(100),
      ];
      if (cursor) queries.push(NodeQuery.cursorAfter(cursor));

      const res = await databases.listDocuments(dbId, AI_TELEMETRY_COL, queries);
      const docs = res.documents || [];

      for (const doc of docs as any[]) {
        totalCalls++;
        const pTok = Number(doc.promptTokens) || 0;
        const cTok = Number(doc.candTokens) || 0;
        const tTok = Number(doc.thoughtTokens) || 0;
        const totTok = Number(doc.totalTokens) || pTok + cTok + tTok;
        const micros = Number(doc.usdMicros) || 0;
        const lat = Number(doc.latencyMs) || 0;
        const fb = Boolean(doc.fallback);

        promptTokens += pTok;
        candTokens += cTok;
        thoughtTokens += tTok;
        totalTokens += totTok;
        totalUsdMicros += micros;
        totalLatencyMs += lat;
        if (fb) fallbackCount++;

        const v = normalizeVerdict(doc.verdict);
        if (v === 'BUY') buyCount++;
        else if (v === 'WATCH') watchCount++;
        else if (v === 'PASS') passCount++;

        const surf = ((doc.surface as AiSurface) in SURFACE_LABELS
          ? doc.surface
          : 'other') as AiSurface;
        const sEntry = surfaceMap.get(surf) || {
          calls: 0,
          promptTokens: 0,
          candTokens: 0,
          thoughtTokens: 0,
          totalTokens: 0,
          usdMicros: 0,
          latencySum: 0,
        };
        sEntry.calls++;
        sEntry.promptTokens += pTok;
        sEntry.candTokens += cTok;
        sEntry.thoughtTokens += tTok;
        sEntry.totalTokens += totTok;
        sEntry.usdMicros += micros;
        sEntry.latencySum += lat;
        surfaceMap.set(surf, sEntry);

        const modKey = String(doc.model || 'gemini-flash-latest');
        const mEntry = modelMap.get(modKey) || {
          calls: 0,
          totalTokens: 0,
          usdMicros: 0,
          fallbackCalls: 0,
        };
        mEntry.calls++;
        mEntry.totalTokens += totTok;
        mEntry.usdMicros += micros;
        if (fb) mEntry.fallbackCalls++;
        modelMap.set(modKey, mEntry);
      }

      if (docs.length < 100) break;
      cursor = docs[docs.length - 1].$id;
    }
  } catch (err: any) {
    if (!warnedTelemetryOnce) {
      warnedTelemetryOnce = true;
      console.warn('[AiTelemetry] Could not query ai_telemetry:', err?.message || err);
    }
    return emptyRollup;
  }

  const totalScouts = buyCount + watchCount + passCount;
  const passFilterRatePct = totalScouts > 0 ? Math.round((passCount / totalScouts) * 100) : 0;

  const bySurface: SurfaceRollup[] = Array.from(surfaceMap.entries())
    .map(([surface, s]) => ({
      surface,
      label: SURFACE_LABELS[surface] || surface,
      calls: s.calls,
      promptTokens: s.promptTokens,
      candTokens: s.candTokens,
      thoughtTokens: s.thoughtTokens,
      totalTokens: s.totalTokens,
      estimatedUsd: Number((s.usdMicros / 1_000_000).toFixed(4)),
      avgLatencyMs: s.calls > 0 ? Math.round(s.latencySum / s.calls) : 0,
    }))
    .sort((a, b) => b.calls - a.calls);

  const byModel: ModelRollup[] = Array.from(modelMap.entries())
    .map(([model, m]) => ({
      model,
      calls: m.calls,
      totalTokens: m.totalTokens,
      estimatedUsd: Number((m.usdMicros / 1_000_000).toFixed(4)),
      fallbackCalls: m.fallbackCalls,
    }))
    .sort((a, b) => b.calls - a.calls);

  const rollup: MonthlyAiTelemetryRollup = {
    monthKey: targetMonth,
    label: formatMonthKeyLabel(targetMonth),
    totalCalls,
    promptTokens,
    candTokens,
    thoughtTokens,
    totalTokens,
    estimatedUsd: Number((totalUsdMicros / 1_000_000).toFixed(4)),
    avgLatencyMs: totalCalls > 0 ? Math.round(totalLatencyMs / totalCalls) : 0,
    fallbackCount,
    funnel: {
      totalScouts,
      buyCount,
      watchCount,
      passCount,
      passFilterRatePct,
    },
    bySurface,
    byModel,
  };

  rollupCache.set(targetMonth, {
    expiresAt: Date.now() + ROLLUP_CACHE_TTL_MS,
    data: rollup,
  });

  return rollup;
}

export function getDefaultBillingLedger(): AiBillingLedger {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    monthlyCreditGrantUsd: 40.0,
    bankedCreditsUsd: 156.99,
    allTimeBaselineUsd: 65.35,
    months: {
      '2026-08': {
        invoicedUsd: 18.45,
        creditAppliedUsd: 18.45,
        note: 'August 2026 Closed Google Cloud Invoice',
      },
      '2026-09': {
        invoicedUsd: 2.20,
        creditAppliedUsd: 2.20,
        note: 'September 2026 Google Cloud Billing Snapshot',
      },
    },
  };
}

let cachedLedger: { expiresAt: number; data: AiBillingLedger } | null = null;

export async function loadAiBillingLedger(forceRefresh = false): Promise<AiBillingLedger> {
  if (!forceRefresh && cachedLedger && cachedLedger.expiresAt > Date.now()) {
    return cachedLedger.data;
  }

  const fallback = getDefaultBillingLedger();
  const { databases, dbId } = getAppwriteServer();
  if (!databases) return fallback;

  try {
    const doc: any = await databases.getDocument(dbId, MANIFESTS_COL, AI_BILLING_LEDGER_DOC_ID);
    const raw = doc?.itemsSnapshot || doc?.notes;
    if (raw && typeof raw === 'string') {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const merged: AiBillingLedger = {
          version: Number(parsed.version) || 1,
          updatedAt: String(parsed.updatedAt || doc.$updatedAt || new Date().toISOString()),
          monthlyCreditGrantUsd:
            typeof parsed.monthlyCreditGrantUsd === 'number'
              ? parsed.monthlyCreditGrantUsd
              : fallback.monthlyCreditGrantUsd,
          bankedCreditsUsd:
            typeof parsed.bankedCreditsUsd === 'number'
              ? parsed.bankedCreditsUsd
              : fallback.bankedCreditsUsd,
          allTimeBaselineUsd:
            typeof parsed.allTimeBaselineUsd === 'number'
              ? parsed.allTimeBaselineUsd
              : fallback.allTimeBaselineUsd,
          months: {
            ...fallback.months,
            ...(parsed.months && typeof parsed.months === 'object' ? parsed.months : {}),
          },
        };
        cachedLedger = { expiresAt: Date.now() + 60_000, data: merged };
        return merged;
      }
    }
  } catch {
    // Document may not exist yet; return defaults
  }

  cachedLedger = { expiresAt: Date.now() + 60_000, data: fallback };
  return fallback;
}

export async function saveAiBillingLedger(
  patch: Partial<AiBillingLedger> & { expectedVersion?: number }
): Promise<AiBillingLedger> {
  const current = await loadAiBillingLedger(true);
  if (
    typeof patch.expectedVersion === 'number' &&
    patch.expectedVersion !== current.version
  ) {
    throw new Error(
      `Billing ledger version conflict (expected v${patch.expectedVersion}, found v${current.version}). Refresh and try again.`
    );
  }

  const next: AiBillingLedger = {
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
    monthlyCreditGrantUsd:
      typeof patch.monthlyCreditGrantUsd === 'number'
        ? Math.max(0, patch.monthlyCreditGrantUsd)
        : current.monthlyCreditGrantUsd,
    bankedCreditsUsd:
      typeof patch.bankedCreditsUsd === 'number'
        ? Math.max(0, patch.bankedCreditsUsd)
        : current.bankedCreditsUsd,
    allTimeBaselineUsd:
      typeof patch.allTimeBaselineUsd === 'number'
        ? Math.max(0, patch.allTimeBaselineUsd)
        : current.allTimeBaselineUsd,
    months: {
      ...current.months,
      ...(patch.months || {}),
    },
  };

  const serialized = JSON.stringify(next);
  if (serialized.length > 30_000) {
    throw new Error('Billing ledger payload exceeds 30KB safety limit.');
  }

  const { databases, dbId } = getAppwriteServer();
  if (!databases) {
    cachedLedger = { expiresAt: Date.now() + 60_000, data: next };
    return next;
  }

  const payload = {
    name: 'AI Cloud Billing & Credit Ledger',
    tenantId: 'huck_collective',
    locationId: 'HG',
    locationName: 'System Telemetry',
    status: 'placed',
    itemsSnapshot: serialized,
    notes: `v${next.version} updated ${next.updatedAt}`,
  };

  try {
    await databases.updateDocument(dbId, MANIFESTS_COL, AI_BILLING_LEDGER_DOC_ID, payload);
  } catch {
    await databases.createDocument(
      dbId,
      MANIFESTS_COL,
      AI_BILLING_LEDGER_DOC_ID,
      payload,
      [
        NodePermission.read(NodeRole.any()),
        NodePermission.update(NodeRole.any()),
        NodePermission.delete(NodeRole.any()),
      ]
    );
  }

  cachedLedger = { expiresAt: Date.now() + 60_000, data: next };
  return next;
}

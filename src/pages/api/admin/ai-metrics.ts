import type { APIRoute } from 'astro';
import { Client, Databases, Query, ID, Permission, Role } from 'node-appwrite';
import { DEFAULT_GEMINI_MODEL } from '../../../lib/gemini';
import {
  formatMonthKeyLabel,
  GEMINI_PRICE_PER_1M,
  getMonthlyAiTelemetry,
  getPacificMonthAndDay,
  invalidateAiTelemetryCache,
  loadAiBillingLedger,
  saveAiBillingLedger,
} from '../../../lib/aiTelemetry';

export const prerender = false;

const PRICING_RATES = {
  promptPerMillion: GEMINI_PRICE_PER_1M.flash.inputUsd,
  completionPerMillion: GEMINI_PRICE_PER_1M.flash.outputUsd,
  calibratedPipelineCostPerItem: 0.043,
};

interface MonthBucket {
  key: string;
  label: string;
  year: number;
  month: number;
  totalScans: number;
  prodScans: number;
  devScans: number;
  telemetryCalls: number;
  googleBilledEst: number;
  invoicedUsd: number | null;
  billingSource: 'invoiced' | 'estimated';
  prodCost: number;
  devCost: number;
  totalTokens: number;
}

interface UserBucket {
  userId: string;
  totalScans: number;
  prodScans: number;
  devScans: number;
  estCost: number;
  lastActive: string;
}

let cachedPayload: any = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 60s

function getPreviousMonthKey(monthKey: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) return '2026-10';
  let year = Number(m[1]);
  let month = Number(m[2]) - 1;
  if (month <= 0) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

function getDaysElapsedAndTotalInPacificMonth(): { elapsedDays: number; totalDays: number } {
  const now = new Date();
  const { monthKey, dayKey } = getPacificMonthAndDay(now);
  const elapsedDays = Math.max(1, Number(dayKey.slice(-2)) || 1);
  const [y, m] = monthKey.split('-').map(Number);
  const totalDays = new Date(y || 2026, m || 11, 0).getDate() || 30;
  return { elapsedDays, totalDays };
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';

    if (!forceRefresh && cachedPayload && Date.now() - lastCacheTime < CACHE_TTL_MS) {
      return new Response(JSON.stringify(cachedPayload), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
          'Cache-Control': 'no-store, max-age=0',
        },
      });
    }

    const endpoint =
      import.meta.env.PUBLIC_APPWRITE_ENDPOINT || process.env.PUBLIC_APPWRITE_ENDPOINT;
    const projectId =
      import.meta.env.PUBLIC_APPWRITE_PROJECT_ID || process.env.PUBLIC_APPWRITE_PROJECT_ID;
    const apiKey = process.env.APPWRITE_API_KEY || import.meta.env.APPWRITE_API_KEY;
    const dbId =
      import.meta.env.PUBLIC_APPWRITE_DB_ID ||
      process.env.PUBLIC_APPWRITE_DB_ID ||
      'resale_db';

    if (!endpoint || !projectId || !apiKey) {
      return new Response(
        JSON.stringify({ error: 'Service temporarily unavailable — please try again.' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
    const databases = new Databases(client);

    const fetchCollectionItems = async (colId: string) => {
      const items: any[] = [];
      let cursor: string | null = null;
      const limit = 100;

      for (let page = 0; page < 20; page++) {
        try {
          const queries: string[] = [
            Query.orderDesc('$id'),
            Query.limit(limit),
            Query.select(['$id', '$createdAt', 'status', 'keywords', 'tenantId', 'rawAnalysis']),
          ];
          if (cursor) queries.push(Query.cursorAfter(cursor));

          const res = await databases.listDocuments(dbId, colId, queries);
          items.push(...res.documents);
          if (res.documents.length < limit) break;
          cursor = res.documents[res.documents.length - 1].$id;
        } catch {
          break;
        }
      }
      return items;
    };

    const { monthKey: thisMonthKey, label: thisMonthLabel } = getPacificMonthAndDay();
    const lastMonthKey = getPreviousMonthKey(thisMonthKey);
    const lastMonthLabel = formatMonthKeyLabel(lastMonthKey);

    const [prodItems, devItems, thisMonthTelemetry, lastMonthTelemetry, billingLedger] =
      await Promise.all([
        fetchCollectionItems('items'),
        fetchCollectionItems('items_dev'),
        getMonthlyAiTelemetry(thisMonthKey, forceRefresh),
        getMonthlyAiTelemetry(lastMonthKey, forceRefresh),
        loadAiBillingLedger(forceRefresh),
      ]);

    const monthlyMap = new Map<string, MonthBucket>();
    const userMap = new Map<string, UserBucket>();

    const ensureMonthBucket = (key: string): MonthBucket => {
      if (!monthlyMap.has(key)) {
        const [yStr, mStr] = key.split('-');
        const year = Number(yStr) || 2026;
        const month = (Number(mStr) || 1) - 1;
        monthlyMap.set(key, {
          key,
          label: formatMonthKeyLabel(key),
          year,
          month,
          totalScans: 0,
          prodScans: 0,
          devScans: 0,
          telemetryCalls: 0,
          googleBilledEst: 0,
          invoicedUsd: null,
          billingSource: 'estimated',
          prodCost: 0,
          devCost: 0,
          totalTokens: 0,
        });
      }
      return monthlyMap.get(key)!;
    };

    ensureMonthBucket(thisMonthKey);
    ensureMonthBucket(lastMonthKey);
    for (const k of Object.keys(billingLedger.months || {})) {
      ensureMonthBucket(k);
    }

    let allTimeProdScans = 0;
    let allTimeDevScans = 0;

    const processDocument = (doc: any, isProd: boolean) => {
      const isAiScanned =
        !!doc.rawAnalysis ||
        doc.status === 'scouted' ||
        (Array.isArray(doc.keywords) && doc.keywords.length > 0);
      if (!isAiScanned) return;

      if (isProd) {
        allTimeProdScans++;
      } else {
        allTimeDevScans++;
      }

      const date = new Date(doc.$createdAt || doc.$updatedAt || Date.now());
      const { monthKey: key } = getPacificMonthAndDay(date);
      const bucket = ensureMonthBucket(key);

      bucket.totalScans++;
      bucket.totalTokens += 1900;
      bucket.googleBilledEst += PRICING_RATES.calibratedPipelineCostPerItem;

      if (isProd) {
        bucket.prodScans++;
        bucket.prodCost += PRICING_RATES.calibratedPipelineCostPerItem;
      } else {
        bucket.devScans++;
        bucket.devCost += PRICING_RATES.calibratedPipelineCostPerItem;
      }

      const userId = doc.tenantId || 'Primary Team';
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          userId,
          totalScans: 0,
          prodScans: 0,
          devScans: 0,
          estCost: 0,
          lastActive: doc.$createdAt,
        });
      }

      const userBucket = userMap.get(userId)!;
      userBucket.totalScans++;
      userBucket.estCost += PRICING_RATES.calibratedPipelineCostPerItem;
      if (isProd) {
        userBucket.prodScans++;
      } else {
        userBucket.devScans++;
      }
    };

    prodItems.forEach((doc) => processDocument(doc, true));
    devItems.forEach((doc) => processDocument(doc, false));

    // Blend live telemetry events & billing ledger overrides onto each month bucket
    for (const bucket of monthlyMap.values()) {
      const tele =
        bucket.key === thisMonthKey
          ? thisMonthTelemetry
          : bucket.key === lastMonthKey
            ? lastMonthTelemetry
            : null;

      if (tele && tele.totalCalls > 0) {
        bucket.telemetryCalls = tele.totalCalls;
        bucket.totalScans = Math.max(bucket.totalScans, tele.totalCalls);
        bucket.totalTokens = Math.max(bucket.totalTokens, tele.totalTokens);
        bucket.googleBilledEst = Math.max(bucket.googleBilledEst, tele.estimatedUsd);
      }

      const ledgerEntry = billingLedger.months?.[bucket.key];
      if (ledgerEntry && typeof ledgerEntry.invoicedUsd === 'number') {
        bucket.invoicedUsd = ledgerEntry.invoicedUsd;
        bucket.googleBilledEst = ledgerEntry.invoicedUsd;
        bucket.billingSource = 'invoiced';
      } else {
        bucket.googleBilledEst = Number(bucket.googleBilledEst.toFixed(2));
        bucket.billingSource = 'estimated';
      }

      const scanDenom = Math.max(1, bucket.prodScans + bucket.devScans);
      const prodRatio =
        bucket.prodScans + bucket.devScans > 0 ? bucket.prodScans / scanDenom : 1;
      bucket.prodCost = Number((bucket.googleBilledEst * prodRatio).toFixed(2));
      bucket.devCost = Number((bucket.googleBilledEst * (1 - prodRatio)).toFixed(2));
    }

    const monthlyHistory = Array.from(monthlyMap.values()).sort((a, b) =>
      b.key.localeCompare(a.key)
    );

    const tmBucket = ensureMonthBucket(thisMonthKey);
    const lmBucket = ensureMonthBucket(lastMonthKey);

    const { elapsedDays, totalDays } = getDaysElapsedAndTotalInPacificMonth();
    const projectedForecast = Number(
      ((tmBucket.googleBilledEst / Math.max(1, elapsedDays)) * totalDays).toFixed(2)
    );

    const creditGrantUsd = billingLedger.monthlyCreditGrantUsd || 40.0;
    const tmNetOutOfPocketUsd = Math.max(
      0,
      Number((tmBucket.googleBilledEst - creditGrantUsd).toFixed(2))
    );
    const tmCreditRemainingUsd = Math.max(
      0,
      Number((creditGrantUsd - tmBucket.googleBilledEst).toFixed(2))
    );

    const allTimeTotalScans =
      Math.max(allTimeProdScans + allTimeDevScans, thisMonthTelemetry.totalCalls);
    const computedAllTimeCost = Math.max(
      billingLedger.allTimeBaselineUsd || 65.35,
      monthlyHistory.reduce((sum, m) => sum + (Number(m.googleBilledEst) || 0), 0)
    );

    const byUser = Array.from(userMap.values()).sort((a, b) => b.totalScans - a.totalScans);

    const googleBilledCompat = {
      thisMonth: {
        billed: tmBucket.googleBilledEst,
        forecast: projectedForecast,
        period: `${thisMonthLabel} (${tmBucket.billingSource === 'invoiced' ? 'Invoiced' : 'Live Est.'})`,
        status: tmBucket.billingSource === 'invoiced' ? 'Invoiced Ground Truth' : 'Live Telemetry + Credit Pool',
      },
      lastMonth: {
        billed: lmBucket.googleBilledEst,
        lateAugWeek: 0,
        period: `${lastMonthLabel} (${lmBucket.billingSource === 'invoiced' ? 'Invoiced' : 'Est.'})`,
        status: lmBucket.billingSource === 'invoiced' ? 'Closed Invoice' : 'Estimated Cycle',
      },
      allTimeBilled: Number(computedAllTimeCost.toFixed(2)),
      taxCategory: 'Operating Expenses (OpEx) — 100% Current-Year Deductible',
    };

    const responsePayload = {
      success: true,
      model: DEFAULT_GEMINI_MODEL,
      pricingRates: PRICING_RATES,
      googleBilled: googleBilledCompat,
      creditPool: {
        monthlyCreditGrantUsd: creditGrantUsd,
        bankedCreditsUsd: billingLedger.bankedCreditsUsd,
        thisMonthSpendUsd: tmBucket.googleBilledEst,
        thisMonthCreditRemainingUsd: tmCreditRemainingUsd,
        thisMonthNetOutOfPocketUsd: tmNetOutOfPocketUsd,
        ledgerVersion: billingLedger.version,
        ledgerUpdatedAt: billingLedger.updatedAt,
      },
      telemetry: {
        thisMonth: thisMonthTelemetry,
        lastMonth: lastMonthTelemetry,
      },
      summary: {
        thisMonth: {
          key: thisMonthKey,
          label: thisMonthLabel,
          actualBilled: tmBucket.googleBilledEst,
          billingSource: tmBucket.billingSource,
          forecast: projectedForecast,
          creditGrantUsd,
          creditRemainingUsd: tmCreditRemainingUsd,
          netOutOfPocketUsd: tmNetOutOfPocketUsd,
          totalScans: tmBucket.totalScans,
          telemetryCalls: thisMonthTelemetry.totalCalls,
          prodScans: tmBucket.prodScans,
          devScans: tmBucket.devScans,
          period: `${thisMonthLabel} (${tmBucket.billingSource === 'invoiced' ? 'Invoiced' : 'Live Est.'})`,
          funnel: thisMonthTelemetry.funnel,
        },
        lastMonth: {
          key: lastMonthKey,
          label: lastMonthLabel,
          actualBilled: lmBucket.googleBilledEst,
          billingSource: lmBucket.billingSource,
          lateAugWeek: 0,
          totalScans: lmBucket.totalScans,
          telemetryCalls: lastMonthTelemetry.totalCalls,
          prodScans: lmBucket.prodScans,
          devScans: lmBucket.devScans,
          period: `${lastMonthLabel} (${lmBucket.billingSource === 'invoiced' ? 'Invoiced' : 'Est.'})`,
        },
        allTime: {
          totalScans: allTimeTotalScans,
          prodScans: allTimeProdScans,
          devScans: allTimeDevScans,
          totalCost: Number(computedAllTimeCost.toFixed(2)),
          prodCost: Number(
            (
              computedAllTimeCost *
              (allTimeProdScans / Math.max(1, allTimeProdScans + allTimeDevScans))
            ).toFixed(2)
          ),
          devCost: Number(
            (
              computedAllTimeCost *
              (allTimeDevScans / Math.max(1, allTimeProdScans + allTimeDevScans))
            ).toFixed(2)
          ),
        },
      },
      monthlyHistory,
      byUser,
    };

    cachedPayload = responsePayload;
    lastCacheTime = Date.now();

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: e.message || 'Failed to aggregate AI metrics',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

// POST endpoint: Supports both logging an AI expense to 'expenses' AND updating the Google Cloud Billing Ledger
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    if (body?.mode === 'update_ledger') {
      const monthKey = String(body.monthKey || getPacificMonthAndDay().monthKey).trim();
      const invoicedUsd =
        body.invoicedUsd === null || body.invoicedUsd === ''
          ? null
          : Math.max(0, Number(body.invoicedUsd) || 0);
      const monthlyCreditGrantUsd =
        typeof body.monthlyCreditGrantUsd === 'number'
          ? Math.max(0, body.monthlyCreditGrantUsd)
          : undefined;
      const bankedCreditsUsd =
        typeof body.bankedCreditsUsd === 'number'
          ? Math.max(0, body.bankedCreditsUsd)
          : undefined;

      const updatedLedger = await saveAiBillingLedger({
        expectedVersion:
          typeof body.expectedVersion === 'number' ? body.expectedVersion : undefined,
        monthlyCreditGrantUsd,
        bankedCreditsUsd,
        months: {
          [monthKey]: {
            invoicedUsd,
            note: body.note ? String(body.note).slice(0, 200) : undefined,
            updatedAt: new Date().toISOString(),
          },
        },
      });

      cachedPayload = null;
      invalidateAiTelemetryCache(monthKey);

      return new Response(
        JSON.stringify({
          success: true,
          ledger: updatedLedger,
          message: `Updated Google Cloud Billing ledger for ${formatMonthKeyLabel(monthKey)}.`,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const { amount, monthLabel, tenantId } = body;

    const endpoint =
      import.meta.env.PUBLIC_APPWRITE_ENDPOINT || process.env.PUBLIC_APPWRITE_ENDPOINT;
    const projectId =
      import.meta.env.PUBLIC_APPWRITE_PROJECT_ID || process.env.PUBLIC_APPWRITE_PROJECT_ID;
    const apiKey = process.env.APPWRITE_API_KEY || import.meta.env.APPWRITE_API_KEY;
    const dbId =
      import.meta.env.PUBLIC_APPWRITE_DB_ID ||
      process.env.PUBLIC_APPWRITE_DB_ID ||
      'resale_db';

    const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
    const databases = new Databases(client);

    const cleanAmount = parseFloat(amount) || 0;
    const activeTenant = tenantId || '69a9cbcb0038df55f6b9';

    const expenseDoc = {
      cartId: `AI-EXPENSE-${Date.now()}`,
      tenantId: activeTenant,
      amount: cleanAmount,
      note: `Google Gemini AI API Cloud Billing (${monthLabel || 'Current Month'}) — Tax Deductible OpEx`,
      date: new Date().toISOString(),
    };

    const permissions = [
      Permission.read(Role.team(activeTenant)),
      Permission.update(Role.team(activeTenant)),
      Permission.delete(Role.team(activeTenant)),
    ];

    const created = await databases.createDocument(
      dbId,
      'expenses',
      ID.unique(),
      expenseDoc,
      permissions
    );

    return new Response(
      JSON.stringify({
        success: true,
        expenseId: created.$id,
        amount: cleanAmount,
        message: `Successfully logged $${cleanAmount.toFixed(2)} to business expenses!`,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Failed to process AI billing action',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

import type { APIRoute } from 'astro';

export const prerender = false;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export interface MdVerifyRow {
  productId: string;
  sku: string;
  upc: string;
  expectedRcUpc: string;
  verifyStatus: 'VERIFIED_MATCH' | 'MISSING_IN_MD' | 'MISMATCH_UPC' | 'UNLINKED_IN_RC';
  name: string;
  agreedPrice: number;
  quantity: number;
  inventory: string;
}

export interface MdVerifyReportPayload {
  timestamp: string;
  source?: string;
  summary: {
    totalCatalog: number;
    verifiedMatch: number;
    missingInMd: number;
    mismatchUpc: number;
    unlinkedInRc: number;
  };
  rows: MdVerifyRow[];
}

const getStoredReport = (): MdVerifyReportPayload | null => {
  return (globalThis as any).__LATEST_MD_VERIFY_REPORT__ || null;
};

const setStoredReport = (report: MdVerifyReportPayload) => {
  (globalThis as any).__LATEST_MD_VERIFY_REPORT__ = report;
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

export const GET: APIRoute = async () => {
  const report = getStoredReport();
  return new Response(
    JSON.stringify({
      ok: true,
      hasReport: Boolean(report),
      report,
    }),
    {
      status: 200,
      headers: CORS_HEADERS,
    }
  );
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const rows: MdVerifyRow[] = Array.isArray(body?.rows) ? body.rows : [];
    const summaryInput = body?.summary || {};

    const verifiedMatch =
      typeof summaryInput.verifiedMatch === 'number'
        ? summaryInput.verifiedMatch
        : rows.filter((r) => r.verifyStatus === 'VERIFIED_MATCH').length;
    const missingInMd =
      typeof summaryInput.missingInMd === 'number'
        ? summaryInput.missingInMd
        : rows.filter((r) => r.verifyStatus === 'MISSING_IN_MD').length;
    const mismatchUpc =
      typeof summaryInput.mismatchUpc === 'number'
        ? summaryInput.mismatchUpc
        : rows.filter((r) => r.verifyStatus === 'MISMATCH_UPC').length;
    const unlinkedInRc =
      typeof summaryInput.unlinkedInRc === 'number'
        ? summaryInput.unlinkedInRc
        : rows.filter((r) => r.verifyStatus === 'UNLINKED_IN_RC').length;
    const totalCatalog =
      typeof summaryInput.totalCatalog === 'number' ? summaryInput.totalCatalog : rows.length;

    const payload: MdVerifyReportPayload = {
      timestamp: body?.timestamp || new Date().toISOString(),
      source: body?.source || 'memoryden.ricoconsign.com',
      summary: {
        totalCatalog,
        verifiedMatch,
        missingInMd,
        mismatchUpc,
        unlinkedInRc,
      },
      rows,
    };

    setStoredReport(payload);

    return new Response(
      JSON.stringify({
        ok: true,
        summary: payload.summary,
        timestamp: payload.timestamp,
      }),
      {
        status: 200,
        headers: CORS_HEADERS,
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err?.message || 'Invalid JSON body',
      }),
      {
        status: 400,
        headers: CORS_HEADERS,
      }
    );
  }
};


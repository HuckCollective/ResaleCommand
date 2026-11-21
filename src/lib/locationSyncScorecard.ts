import { cleanCatalogSku } from './salesBucketing';

export type BoothVerifyStatus = 'VERIFIED_MATCH' | 'MISSING_IN_MD' | 'MISMATCH_UPC' | 'UNLINKED_IN_RC';

export interface BoothVerifySummary {
  totalCatalog: number;
  verifiedMatch: number;
  missingInMd: number;
  mismatchUpc: number;
  unlinkedInRc: number;
}

/**
 * Extracts the true POS shelf barcode without confusing a blank Ricochet UPC with fallback expected barcodes.
 */
export function deriveActualMdUpc(rawRow: any): string {
  if (String(rawRow?.verifyStatus || '').trim().toUpperCase() === 'MISSING_IN_MD') {
    return '';
  }
  const raw = rawRow?.mdUpc !== undefined ? rawRow.mdUpc : rawRow?.upc || '';
  return cleanCatalogSku(raw).toUpperCase();
}

/**
 * Computes the live 4-state verification status for a single booth row.
 */
export function computeRowLiveVerifyStatus(params: {
  hasLinkedItem: boolean;
  isSoldOrPaid: boolean;
  mdUpc?: string | null;
  expectedRcUpc?: string | null;
}): BoothVerifyStatus {
  if (!params.hasLinkedItem) {
    return 'UNLINKED_IN_RC';
  }
  if (params.isSoldOrPaid) {
    return 'VERIFIED_MATCH';
  }
  const actualMd = cleanCatalogSku(params.mdUpc || '').toUpperCase();
  const expectedRc = cleanCatalogSku(params.expectedRcUpc || '').toUpperCase();
  if (!actualMd) {
    return 'MISSING_IN_MD';
  }
  if (!expectedRc || actualMd === expectedRc) {
    return 'VERIFIED_MATCH';
  }
  return 'MISMATCH_UPC';
}

function emptySummary(): BoothVerifySummary {
  return {
    totalCatalog: 0,
    verifiedMatch: 0,
    missingInMd: 0,
    mismatchUpc: 0,
    unlinkedInRc: 0,
  };
}

function accumulateStatus(summary: BoothVerifySummary, status: string): void {
  summary.totalCatalog++;
  if (status === 'VERIFIED_MATCH') summary.verifiedMatch++;
  else if (status === 'MISSING_IN_MD') summary.missingInMd++;
  else if (status === 'MISMATCH_UPC') summary.mismatchUpc++;
  else summary.unlinkedInRc++;
}

function isReportRowSoldOrPaid(r: any): boolean {
  const invStr = String(r?.inventory || '').trim();
  if (/^(sold|paid)$/i.test(invStr)) return true;
  if (Number(r?.quantity) === 0 && !/^in\s*stock$/i.test(invStr)) return true;
  return false;
}

function buildSkuInventoryMap(inventoryItems: any[]): Map<string, any> {
  const bySku = new Map<string, any>();
  for (const it of inventoryItems || []) {
    if (!it) continue;
    const sku = cleanCatalogSku(it.locationSku || it.sku).toUpperCase();
    if (!sku) continue;
    const existing = bySku.get(sku);
    if (!existing || (it.status === 'placed' && existing.status !== 'placed')) {
      bySku.set(sku, it);
    }
  }
  return bySku;
}

/**
 * Derives live scorecard pill counts either from hydrated workspace rows or directly by overlaying
 * live inventory links onto an incoming report's rows (with 1-to-1 status parity).
 */
export function computeLiveVerifySummary(params: {
  syncRows: any[];
  report: any | null;
  inventoryItems: any[];
}): BoothVerifySummary {
  const rows = Array.isArray(params.syncRows) ? params.syncRows : [];
  if (rows.length > 0 && rows.some((r) => Boolean(r?.verifyStatus))) {
    const summary = emptySummary();
    for (const r of rows) {
      accumulateStatus(summary, String(r?.verifyStatus || 'UNLINKED_IN_RC'));
    }
    return summary;
  }

  const reportRows = Array.isArray(params.report?.rows) ? params.report.rows : [];
  if (reportRows.length > 0) {
    const bySku = buildSkuInventoryMap(params.inventoryItems);
    const summary = emptySummary();
    for (const r of reportRows) {
      const sku = cleanCatalogSku(r?.sku).toUpperCase();
      const liveDbItem = sku ? bySku.get(sku) : null;
      const mdUpc = deriveActualMdUpc(r);
      const isSoldOrPaid = isReportRowSoldOrPaid(r);
      const hasLinkedItem = Boolean(liveDbItem || (r?.verifyStatus && r.verifyStatus !== 'UNLINKED_IN_RC'));
      const expectedRcUpc = cleanCatalogSku(liveDbItem?.upc || r?.expectedRcUpc || '').toUpperCase();
      const status = computeRowLiveVerifyStatus({
        hasLinkedItem,
        isSoldOrPaid,
        mdUpc,
        expectedRcUpc,
      });
      accumulateStatus(summary, status);
    }
    return summary;
  }

  const fallback = params.report?.summary;
  if (fallback && typeof fallback === 'object') {
    return {
      totalCatalog: Number(fallback.totalCatalog || 0),
      verifiedMatch: Number(fallback.verifiedMatch || 0),
      missingInMd: Number(fallback.missingInMd || 0),
      mismatchUpc: Number(fallback.mismatchUpc || 0),
      unlinkedInRc: Number(fallback.unlinkedInRc || 0),
    };
  }
  return emptySummary();
}

/**
 * Patches matching loaded `syncRows` entries in place from an incoming verification report without
 * discarding table scroll position, active pill filters, or staged AI match candidates.
 */
export function patchSyncRowsFromReport(syncRows: any[], report: any): boolean {
  if (!Array.isArray(syncRows) || syncRows.length === 0 || !Array.isArray(report?.rows)) {
    return false;
  }

  const bySku = new Map<string, any>();
  for (const r of report.rows) {
    const sku = cleanCatalogSku(r?.sku).toUpperCase();
    if (sku && !bySku.has(sku)) {
      bySku.set(sku, r);
    }
  }
  if (bySku.size === 0) return false;

  let touched = false;
  for (const row of syncRows) {
    const cleanSku = cleanCatalogSku(row?.extractedSku || row?.sku).toUpperCase();
    if (!cleanSku) continue;
    const incoming = bySku.get(cleanSku);
    if (!incoming) continue;

    touched = true;
    const nextMdUpc = deriveActualMdUpc(incoming);
    const nextExpected = cleanCatalogSku(row.mappedItem?.upc || incoming.expectedRcUpc || '').toUpperCase();

    row.mdUpc = nextMdUpc;
    if (nextMdUpc) {
      row.extractedUpc = nextMdUpc;
    } else if (nextExpected) {
      row.extractedUpc = nextExpected;
    }
    if (nextExpected) {
      row.expectedRcUpc = nextExpected;
    }
    row.conflictReason = String(incoming.conflictReason || '');

    const hasLinked = Boolean(row.mappedItem || (incoming.verifyStatus && incoming.verifyStatus !== 'UNLINKED_IN_RC'));
    const isSold = row.status === 'sold' || row.status === 'paid';
    row.verifyStatus = computeRowLiveVerifyStatus({
      hasLinkedItem: hasLinked,
      isSoldOrPaid: isSold,
      mdUpc: nextMdUpc,
      expectedRcUpc: nextExpected,
    });
    if (row.verifyStatus === 'VERIFIED_MATCH') {
      row.uniqueBarcodeAssigned = false;
    }
  }

  return touched;
}

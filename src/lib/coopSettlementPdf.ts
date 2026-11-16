import { jsPDF } from 'jspdf';
import { classifySurplusLaborRole, type CoopLaborEntry } from './coopGovernance';
import type { MonthlySettlementSubtotal } from './coop/settlementInputs';
import type { PartnerRole } from '../types/coop';

export interface SettlementLineItem {
  date: string;
  sku: string;
  ticketNumber?: string;
  title: string;
  grossPrice: number;
  venueFee: number;
  costBasis: number;
  netSurplus: number;
  curatorTake: number;
  unrecoupedCost?: number;
}

export interface PartnerStatementData {
  statementDate: string;
  periodLabel: string;
  periodKey?: string;
  partnerName: string;
  prefix: string;
  role?: PartnerRole;
  isSweatEnabler?: boolean;
  isConsignor?: boolean;
  isVenueScopedPreview?: boolean;
  curatorSharePct: number;
  commonsSharePct: number;
  venueFeePct?: number;
  items: SettlementLineItem[];
  totalGross: number;
  totalVenueFee: number;
  totalCostBasis: number;
  unrecoupedCost?: number;
  totalNetSurplus: number;
  totalCuratorProfit: number;
  totalPayoutCheck: number;
  boothLocation?: string;
  reimbursements?: number;
  rentDeduction?: number;
  coopCommission?: number;
  dealFormulaLabel?: string;
  laborHoursLogged?: number;
  laborLogs?: CoopLaborEntry[];
  salesPatronageBonus?: number;
  laborBountyBonus?: number;
  icaRetainedCredit?: number;
  cashBonusPaid?: number;
  icaAnnualYieldRatePct?: number;
  monthlySubtotals?: MonthlySettlementSubtotal[];
  lockedInfo?: {
    lockedAt: string;
    lockedByName: string;
    snapshotHash: string;
    revision?: number;
  };
}

export function slugifyMemberForFilename(raw: string): string {
  const slug = String(raw || 'partner')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return slug || 'partner';
}

export function buildPartnerPdfFilename(
  partnerName: string,
  prefix: string,
  periodOrDate: string
): string {
  const cleanPrefix = String(prefix || 'COOP')
    .replace(/[-_]+$/, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
  const slug = slugifyMemberForFilename(partnerName);
  const safePeriod = String(periodOrDate || 'statement').replace(/[^A-Za-z0-9_-]/g, '');
  return `Settlement_${cleanPrefix}_${slug}_${safePeriod}.pdf`;
}

/**
 * Law 7 pure string date formatter — zero `new Date()` or `getMonth()` timezone drift.
 */
function formatPdfDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const raw = String(dateStr).replace(/['"]/g, '').trim();
  if (!raw) return '-';
  const datePart = raw.includes('T') ? raw.split('T')[0] : raw.split(' ')[0];

  let m = datePart.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) {
    return `${m[2].padStart(2, '0')}/${m[3].padStart(2, '0')}/${m[1].slice(-2)}`;
  }
  m = datePart.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) {
    return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3].slice(-2)}`;
  }
  return datePart.slice(0, 10);
}

function formatPdfSku(skuStr: string | null | undefined): string {
  if (!skuStr) return '-';
  const clean = String(skuStr).trim();
  return clean.length > 13 ? clean.slice(0, 12) + '…' : clean;
}

function formatPdfTitle(titleStr: string | null | undefined, maxLen = 36): string {
  if (!titleStr) return 'Sold Item';
  const clean = String(titleStr).trim();
  return clean.length > maxLen ? clean.substring(0, maxLen - 2) + '...' : clean;
}

export function generatePartnerSettlementPdf(data: PartnerStatementData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter', // 612 x 792 pt
  });

  const margin = 36;
  const pageWidth = 612;
  const pageHeight = 792;
  let y = margin;

  const curatorPct = Number(data.curatorSharePct || 0);
  const commonsPct = Number(data.commonsSharePct || 0);
  const approvedLaborLogs = (data.laborLogs || []).filter(
    (entry) => entry && entry.approval === 'approved'
  );
  const isLaborOnlyStatement =
    data.items.length === 0 && (Boolean(data.isSweatEnabler) || approvedLaborLogs.length > 0);

  // Header Bar (Emerald accent)
  doc.setFillColor(16, 185, 129);
  doc.rect(margin, y, pageWidth - margin * 2, 4, 'F');
  y += 24;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(30, 41, 59);
  doc.text('HUCKLEBERRY COLLECTIVE COOPERATIVE', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Worker Self-Directed Enterprise • Multi-Channel Retail Commons',
    margin,
    y + 14
  );

  // Statement Meta on Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(16, 185, 129);
  doc.text(
    data.isSweatEnabler ? 'SWEAT-EQUITY STATEMENT' : 'PARTNER SETTLEMENT',
    pageWidth - margin,
    y,
    { align: 'right' }
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Period: ${data.periodLabel || 'Monthly Settlement'}`,
    pageWidth - margin,
    y + 14,
    { align: 'right' }
  );
  doc.text(`Date: ${data.statementDate}`, pageWidth - margin, y + 26, {
    align: 'right',
  });
  y += 42;

  // Partner Info Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 46, 6, 6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Member / Partner: ${data.partnerName}`, margin + 14, y + 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  const roleLabel =
    data.role ||
    (data.isConsignor
      ? 'Consignor'
      : data.isSweatEnabler
        ? 'Marketing & Social Enabler'
        : 'Co-op Partner');
  doc.text(
    `Prefix: [ ${data.prefix} ] • Role: ${roleLabel} • Scope: ${data.boothLocation || 'All Co-op Channels'}`,
    margin + 14,
    y + 32
  );

  // Financial Highlight on Right of Info Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(16, 185, 129);
  doc.text(`$${data.totalPayoutCheck.toFixed(2)}`, pageWidth - margin - 14, y + 20, {
    align: 'right',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Total Net Cash Payout Check', pageWidth - margin - 14, y + 32, {
    align: 'right',
  });

  y += 60;

  if (isLaborOnlyStatement) {
    // Official VERIFIED SWEAT-EQUITY & ENABLING LABOR LEDGER table (§2 & §6)
    const laborColX = {
      date: margin + 6,
      category: margin + 56,
      wsde: margin + 184,
      proof: margin + 286,
      hours: pageWidth - margin - 6,
    };

    const drawLaborHeader = (currY: number) => {
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, currY, pageWidth - margin * 2, 20, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text('Date', laborColX.date, currY + 13);
      doc.text('Category', laborColX.category, currY + 13);
      doc.text('WSDE Surplus Role', laborColX.wsde, currY + 13);
      doc.text('Deliverable Proof / Contribution Notes', laborColX.proof, currY + 13);
      doc.text('Approved Hrs', laborColX.hours, currY + 13, { align: 'right' });
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('VERIFIED SWEAT-EQUITY & ENABLING LABOR LEDGER', margin, y);
    y += 8;

    drawLaborHeader(y);
    y += 24;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);

    if (approvedLaborLogs.length === 0) {
      doc.text(
        'No approved Sweat-Equity labor entries in this period (pending entries earn $0 until Founder-approved).',
        margin + 6,
        y + 4
      );
      y += 20;
    } else {
      for (let i = 0; i < approvedLaborLogs.length; i++) {
        const lg = approvedLaborLogs[i];
        if (y > pageHeight - 110) {
          doc.addPage();
          y = margin;
          drawLaborHeader(y);
          y += 24;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(51, 65, 85);
        }

        if (i % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y - 9, pageWidth - margin * 2, 15, 'F');
        }

        const wsdeRole = classifySurplusLaborRole(lg.category);
        const proofStr = [lg.deliverableRef ? `[${lg.deliverableRef}]` : '', lg.notes || '']
          .filter(Boolean)
          .join(' — ');

        doc.text(formatPdfDate(lg.date), laborColX.date, y + 2);
        doc.text(formatPdfTitle(lg.category, 24), laborColX.category, y + 2);
        doc.text(wsdeRole, laborColX.wsde, y + 2);
        doc.text(formatPdfTitle(proofStr || 'Verified contribution', 46), laborColX.proof, y + 2);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(`${Number(lg.hours || 0).toFixed(2)}h`, laborColX.hours, y + 2, {
          align: 'right',
        });
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        y += 15;
      }
    }
  } else {
    // Sold-Items Ledger Table
    const colX = {
      date: margin + 4,
      sku: margin + 50,
      title: margin + 116,
      gross: margin + 344,
      fee: margin + 392,
      cost: margin + 438,
      profit: margin + 486,
      take: pageWidth - margin - 4,
    };

    const drawTableHeader = (currY: number) => {
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, currY, pageWidth - margin * 2, 20, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);

      doc.text('Date', colX.date, currY + 13);
      doc.text('SKU / Code', colX.sku, currY + 13);
      doc.text('Item Description', colX.title, currY + 13);
      doc.text('Gross', colX.gross, currY + 13, { align: 'right' });
      doc.text('Venue Fee', colX.fee, currY + 13, { align: 'right' });
      doc.text('Cost Back', colX.cost, currY + 13, { align: 'right' });
      doc.text('Surplus', colX.profit, currY + 13, { align: 'right' });
      doc.text(
        data.isConsignor ? 'Net Deposit' : `Curator (${curatorPct}%)`,
        colX.take,
        currY + 13,
        { align: 'right' }
      );
    };

    drawTableHeader(y);
    y += 24;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);

    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];

      if (y > pageHeight - 90) {
        doc.addPage();
        y = margin;
        drawTableHeader(y);
        y += 24;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(51, 65, 85);
      }

      if (i % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y - 9, pageWidth - margin * 2, 15, 'F');
      }

      doc.text(formatPdfDate(item.date), colX.date, y + 2);
      doc.text(formatPdfSku(item.sku), colX.sku, y + 2);
      doc.text(formatPdfTitle(item.title), colX.title, y + 2);

      doc.text(`$${item.grossPrice.toFixed(2)}`, colX.gross, y + 2, { align: 'right' });
      doc.text(`-$${item.venueFee.toFixed(2)}`, colX.fee, y + 2, { align: 'right' });

      doc.setTextColor(16, 185, 129);
      doc.text(`+$${item.costBasis.toFixed(2)}`, colX.cost, y + 2, { align: 'right' });

      doc.setTextColor(51, 65, 85);
      doc.text(`$${item.netSurplus.toFixed(2)}`, colX.profit, y + 2, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`$${item.curatorTake.toFixed(2)}`, colX.take, y + 2, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);

      y += 15;
    }

    // Compact labor summary block for hybrid Producer-Enablers (HUCK- / PDXGL-) with approved hours (§2)
    if (approvedLaborLogs.length > 0 && !data.isVenueScopedPreview) {
      y += 6;
      if (y > pageHeight - 100) {
        doc.addPage();
        y = margin;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(
        `Verified Sweat-Equity Contributions (${Number(data.laborHoursLogged || 0).toFixed(2)}h across ${approvedLaborLogs.length} approved log${approvedLaborLogs.length === 1 ? '' : 's'}):`,
        margin,
        y
      );
      y += 12;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      for (const lg of approvedLaborLogs.slice(0, 6)) {
        if (y > pageHeight - 90) {
          doc.addPage();
          y = margin;
        }
        const refPart = lg.deliverableRef ? ` [${lg.deliverableRef}]` : '';
        doc.text(
          `• ${formatPdfDate(lg.date)} — ${lg.member}: ${Number(lg.hours).toFixed(2)}h (${lg.category})${refPart}`,
          margin + 6,
          y
        );
        y += 11;
      }
    }
  }

  // Optional All-Time Monthly Subtotals (§5 item 11)
  if (data.monthlySubtotals && data.monthlySubtotals.length > 1) {
    y += 8;
    if (y > pageHeight - 110) {
      doc.addPage();
      y = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text('Per-Month Settlement Subtotals:', margin, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(71, 85, 105);
    for (const ms of data.monthlySubtotals) {
      if (y > pageHeight - 85) {
        doc.addPage();
        y = margin;
      }
      const lockBadge = ms.isLocked ? ' [LOCKED]' : ms.isMonthInProgress ? ' [OPEN]' : '';
      doc.text(
        `• ${ms.monthLabel}${lockBadge}: ${ms.itemsSold} sold · Gross $${ms.grossSales.toFixed(2)} · Bonus +$${(ms.salesBonus + ms.laborBonus).toFixed(2)} · Check $${ms.payoutCheck.toFixed(2)}`,
        margin + 6,
        y
      );
      y += 11;
    }
  }

  y += 10;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  // Summary Totals Box (dynamic height based on active Gate 4B & ICA lines)
  const includeBonuses = !data.isVenueScopedPreview && !data.isConsignor;
  const salesBonus = includeBonuses ? Number(data.salesPatronageBonus || 0) : 0;
  const laborBonus = includeBonuses ? Number(data.laborBountyBonus || 0) : 0;
  const icaRetained = includeBonuses ? Number(data.icaRetainedCredit || 0) : 0;
  const hasSalesBonus = salesBonus > 0;
  const hasLaborBonus = laborBonus > 0 || Boolean(data.isSweatEnabler && includeBonuses);
  const hasIcaRetained = icaRetained > 0;
  const hasReimbursement = Boolean(data.reimbursements && data.reimbursements > 0);
  const hasRentDeduction = Boolean(data.rentDeduction && data.rentDeduction > 0);
  const hasCoopCommission = Boolean(data.coopCommission && data.coopCommission > 0);

  let summaryLinesCount = data.isSweatEnabler ? 2 : 4;
  if (data.isConsignor && data.dealFormulaLabel) summaryLinesCount += 1;
  if (hasRentDeduction) summaryLinesCount += 1;
  if (hasCoopCommission) summaryLinesCount += 1;
  if (hasReimbursement) summaryLinesCount += 1;
  if (hasSalesBonus) summaryLinesCount += 1;
  if (hasLaborBonus) summaryLinesCount += 1;
  if (hasIcaRetained) summaryLinesCount += 1;

  const summaryBoxHeight = 36 + summaryLinesCount * 14;
  if (y + summaryBoxHeight > pageHeight - 60) {
    doc.addPage();
    y = margin;
  }

  const summaryBoxWidth = 276;
  const summaryBoxX = pageWidth - margin - summaryBoxWidth;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(summaryBoxX, y, summaryBoxWidth, summaryBoxHeight, 6, 6, 'FD');

  let sy = y + 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  if (data.isSweatEnabler) {
    doc.text('Approved Sweat-Equity Hours:', summaryBoxX + 14, sy);
    doc.text(
      `${Number(data.laborHoursLogged || 0).toFixed(2)} hrs`,
      summaryBoxX + summaryBoxWidth - 14,
      sy,
      { align: 'right' }
    );
    sy += 14;
  } else {
    doc.text('Total Items Sold:', summaryBoxX + 14, sy);
    doc.text(`${data.items.length}`, summaryBoxX + summaryBoxWidth - 14, sy, {
      align: 'right',
    });
    sy += 14;

    doc.text('Gross Register Sales:', summaryBoxX + 14, sy);
    doc.text(`$${data.totalGross.toFixed(2)}`, summaryBoxX + summaryBoxWidth - 14, sy, {
      align: 'right',
    });
    sy += 14;

    doc.text('100% Cost Basis Recouped (Gate 3):', summaryBoxX + 14, sy);
    doc.setTextColor(16, 185, 129);
    doc.text(
      `+$${data.totalCostBasis.toFixed(2)}`,
      summaryBoxX + summaryBoxWidth - 14,
      sy,
      { align: 'right' }
    );
    doc.setTextColor(71, 85, 105);
    sy += 14;

    doc.text(
      data.isConsignor
        ? 'Net Deposit Before Deal:'
        : `${curatorPct}% Curator Base Share:`,
      summaryBoxX + 14,
      sy
    );
    doc.text(
      `+$${data.totalCuratorProfit.toFixed(2)}`,
      summaryBoxX + summaryBoxWidth - 14,
      sy,
      { align: 'right' }
    );
    sy += 14;
  }

  if (data.isConsignor && data.dealFormulaLabel) {
    doc.text('Consignment Deal:', summaryBoxX + 14, sy);
    doc.text(
      data.dealFormulaLabel.slice(0, 44),
      summaryBoxX + summaryBoxWidth - 14,
      sy,
      { align: 'right' }
    );
    sy += 14;
  }

  if (hasRentDeduction && data.rentDeduction) {
    doc.text('Booth / Shelf Rent Share:', summaryBoxX + 14, sy);
    doc.setTextColor(220, 38, 38);
    doc.text(
      `-$${data.rentDeduction.toFixed(2)}`,
      summaryBoxX + summaryBoxWidth - 14,
      sy,
      { align: 'right' }
    );
    doc.setTextColor(71, 85, 105);
    sy += 14;
  }

  if (hasCoopCommission && data.coopCommission) {
    doc.text('Co-op Commons Commission:', summaryBoxX + 14, sy);
    doc.setTextColor(220, 38, 38);
    doc.text(
      `-$${data.coopCommission.toFixed(2)}`,
      summaryBoxX + summaryBoxWidth - 14,
      sy,
      { align: 'right' }
    );
    doc.setTextColor(71, 85, 105);
    sy += 14;
  }

  if (hasReimbursement && data.reimbursements) {
    doc.text('Approved Expense Reimbursements:', summaryBoxX + 14, sy);
    doc.setTextColor(16, 185, 129);
    doc.text(
      `+$${data.reimbursements.toFixed(2)}`,
      summaryBoxX + summaryBoxWidth - 14,
      sy,
      { align: 'right' }
    );
    doc.setTextColor(71, 85, 105);
    sy += 14;
  }

  if (hasSalesBonus) {
    doc.text('Gate 4B Sales Patronage Bonus:', summaryBoxX + 14, sy);
    doc.setTextColor(16, 185, 129);
    doc.text(`+$${salesBonus.toFixed(2)}`, summaryBoxX + summaryBoxWidth - 14, sy, {
      align: 'right',
    });
    doc.setTextColor(71, 85, 105);
    sy += 14;
  }

  if (hasLaborBonus) {
    doc.text(
      `Gate 4B Sweat-Equity Dividend (${Number(data.laborHoursLogged || 0).toFixed(1)}h):`,
      summaryBoxX + 14,
      sy
    );
    doc.setTextColor(16, 185, 129);
    doc.text(`+$${laborBonus.toFixed(2)}`, summaryBoxX + summaryBoxWidth - 14, sy, {
      align: 'right',
    });
    doc.setTextColor(71, 85, 105);
    sy += 14;
  }

  if (hasIcaRetained) {
    const yieldPct = Number(data.icaAnnualYieldRatePct ?? 7);
    doc.text(
      `Mondragon ICA Credit (retained @ ${yieldPct}%/yr est.):`,
      summaryBoxX + 14,
      sy
    );
    doc.setTextColor(14, 116, 144);
    doc.text(`-$${icaRetained.toFixed(2)}`, summaryBoxX + summaryBoxWidth - 14, sy, {
      align: 'right',
    });
    doc.setTextColor(71, 85, 105);
    sy += 14;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('FINAL CASH PAYOUT CHECK:', summaryBoxX + 14, sy + 4);
  doc.setTextColor(16, 185, 129);
  doc.text(
    `$${data.totalPayoutCheck.toFixed(2)}`,
    summaryBoxX + summaryBoxWidth - 14,
    sy + 4,
    { align: 'right' }
  );

  // Left-side Charter Guarantee + Audit / Lock Footer (§6 & §7.5)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Worker Self-Directed Enterprise Guarantee:', margin, y + 16);
  doc.text(
    '• 100% of verified purchase & shipping capital is returned dollar-for-dollar.',
    margin,
    y + 28
  );
  doc.text(
    `• ${curatorPct}% of net item surplus is distributed to Curator; ${commonsPct}% funds Commons Pool.`,
    margin,
    y + 40
  );
  doc.text(
    '• Gate 4B Sweat-Equity & Sales Patronage bonuses distribute above monthly breakeven.',
    margin,
    y + 52
  );

  let footerY = y + 66;
  if (approvedLaborLogs.length > 0) {
    const approvers = Array.from(
      new Set(approvedLaborLogs.map((l) => l.approvedBy).filter(Boolean))
    );
    const dates = Array.from(
      new Set(
        approvedLaborLogs
          .map((l) => (l.approvedAt ? String(l.approvedAt).slice(0, 10) : ''))
          .filter(Boolean)
      )
    );
    if (approvers.length > 0) {
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Approved by: ${approvers.join(', ')}${dates.length ? ` on ${dates.join(', ')}` : ''}`,
        margin,
        footerY
      );
      footerY += 12;
    }
  }

  if (data.lockedInfo && data.lockedInfo.snapshotHash) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 118, 110);
    const lockDate = String(data.lockedInfo.lockedAt || '').slice(0, 10);
    const shortHash = String(data.lockedInfo.snapshotHash).slice(0, 8);
    doc.text(
      `LOCKED — ${lockDate} — snapshot ${shortHash}${data.lockedInfo.revision && data.lockedInfo.revision > 1 ? ` (rev ${data.lockedInfo.revision})` : ''}`,
      margin,
      footerY
    );
  } else if (data.isVenueScopedPreview) {
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(180, 83, 9);
    doc.text(
      'Venue-scoped preview (Gates 1-3 only) — collective Gate 4B bonuses settle on All Venues.',
      margin,
      footerY
    );
  }

  return doc;
}

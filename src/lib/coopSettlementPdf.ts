import { jsPDF } from 'jspdf';

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
}

export interface PartnerStatementData {
  statementDate: string;
  periodLabel: string;
  partnerName: string;
  prefix: string;
  items: SettlementLineItem[];
  totalGross: number;
  totalVenueFee: number;
  totalCostBasis: number;
  totalNetSurplus: number;
  totalCuratorProfit: number;
  totalPayoutCheck: number;
  boothLocation?: string;
}

function formatPdfDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const raw = String(dateStr).trim();
    const datePart = raw.includes('T') ? raw.split('T')[0] : raw.split(' ')[0];
    if (datePart && datePart.includes('-')) {
      const parts = datePart.split('-');
      if (parts.length === 3) {
        const [yyyy, mm, dd] = parts;
        return `${mm}/${dd}/${yyyy.slice(2)}`; // e.g. "10/23/26"
      }
    }
    return datePart.slice(0, 10);
  } catch {
    return String(dateStr).slice(0, 10);
  }
}

function formatPdfSku(skuStr: string | null | undefined): string {
  if (!skuStr) return '-';
  const clean = String(skuStr).trim();
  return clean.length > 13 ? clean.slice(0, 12) + '…' : clean;
}

function formatPdfTitle(titleStr: string | null | undefined): string {
  if (!titleStr) return 'Sold Item';
  const clean = String(titleStr).trim();
  return clean.length > 36 ? clean.substring(0, 34) + '...' : clean;
}

export function generatePartnerSettlementPdf(data: PartnerStatementData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter' // 612 x 792 pt
  });

  const margin = 36;
  const pageWidth = 612;
  const pageHeight = 792;
  let y = margin;

  // Header Bar (Emerald accent)
  doc.setFillColor(16, 185, 129);
  doc.rect(margin, y, pageWidth - (margin * 2), 4, 'F');
  y += 24;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(30, 41, 59);
  doc.text('HUCKLEBERRY COLLECTIVE COOPERATIVE', margin, y);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Worker Self-Directed Consortium • Multi-Channel Retail Commons', margin, y + 14);

  // Statement Meta on Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(16, 185, 129);
  doc.text('PARTNER SETTLEMENT', pageWidth - margin, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Period: ${data.periodLabel || 'Monthly Settlement'}`, pageWidth - margin, y + 14, { align: 'right' });
  doc.text(`Date: ${data.statementDate}`, pageWidth - margin, y + 26, { align: 'right' });
  y += 42;

  // Partner Info Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 46, 6, 6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Partner: ${data.partnerName}`, margin + 14, y + 18);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Barcode Prefix: [ ${data.prefix} ] • Venue: ${data.boothLocation || 'Memory Den (Booth 0EJ)'}`, margin + 14, y + 32);

  // Financial Highlight on Right of Info Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(16, 185, 129);
  doc.text(`$${data.totalPayoutCheck.toFixed(2)}`, pageWidth - margin - 14, y + 20, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Total Net Payout Check', pageWidth - margin - 14, y + 32, { align: 'right' });

  y += 60;

  // Table Column Coordinates (Optimized to prevent text collisions)
  const colX = {
    date: margin + 4,         // 40
    sku: margin + 50,         // 86
    title: margin + 116,      // 152
    gross: margin + 344,      // 380 (right-align)
    fee: margin + 392,        // 428 (right-align)
    cost: margin + 438,       // 474 (right-align)
    profit: margin + 486,     // 522 (right-align)
    take: pageWidth - margin - 4 // 572 (right-align)
  };

  const drawTableHeader = (currY: number) => {
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, currY, pageWidth - (margin * 2), 20, 'F');
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
    doc.text('Curator (70%)', colX.take, currY + 13, { align: 'right' });
  };

  drawTableHeader(y);
  y += 24;

  // Item Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);

  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];

    // Page Break Check
    if (y > pageHeight - 90) {
      doc.addPage();
      y = margin;
      drawTableHeader(y);
      y += 24;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
    }

    // Alternating Zebra Row Background
    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y - 9, pageWidth - (margin * 2), 15, 'F');
    }

    const cleanDate = formatPdfDate(item.date);
    const cleanSku = formatPdfSku(item.sku);
    const cleanTitle = formatPdfTitle(item.title);

    doc.text(cleanDate, colX.date, y + 2);
    doc.text(cleanSku, colX.sku, y + 2);
    doc.text(cleanTitle, colX.title, y + 2);

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

  y += 10;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  // Summary Totals Box
  if (y > pageHeight - 120) {
    doc.addPage();
    y = margin;
  }

  const summaryBoxWidth = 260;
  const summaryBoxX = pageWidth - margin - summaryBoxWidth;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(summaryBoxX, y, summaryBoxWidth, 90, 6, 6, 'FD');

  let sy = y + 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  doc.text('Total Items Sold:', summaryBoxX + 14, sy);
  doc.text(`${data.items.length}`, summaryBoxX + summaryBoxWidth - 14, sy, { align: 'right' });
  sy += 14;

  doc.text('Gross Register Sales:', summaryBoxX + 14, sy);
  doc.text(`$${data.totalGross.toFixed(2)}`, summaryBoxX + summaryBoxWidth - 14, sy, { align: 'right' });
  sy += 14;

  doc.text('100% Cost Basis Recouped (Tier 2):', summaryBoxX + 14, sy);
  doc.setTextColor(16, 185, 129);
  doc.text(`+$${data.totalCostBasis.toFixed(2)}`, summaryBoxX + summaryBoxWidth - 14, sy, { align: 'right' });
  doc.setTextColor(71, 85, 105);
  sy += 14;

  doc.text('70% Curator Net Profit Share:', summaryBoxX + 14, sy);
  doc.text(`+$${data.totalCuratorProfit.toFixed(2)}`, summaryBoxX + summaryBoxWidth - 14, sy, { align: 'right' });
  sy += 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('FINAL PAYOUT CHECK:', summaryBoxX + 14, sy);
  doc.setTextColor(16, 185, 129);
  doc.text(`$${data.totalPayoutCheck.toFixed(2)}`, summaryBoxX + summaryBoxWidth - 14, sy, { align: 'right' });

  // Charter Guarantee Footer on Left
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Worker Self-Directed Enterprise Guarantee:', margin, y + 20);
  doc.text('• 100% of purchase capital is returned dollar-for-dollar.', margin, y + 32);
  doc.text('• 70% of net surplus profit is distributed to curator.', margin, y + 44);
  doc.text('• 30% commons pool pays booth rent, hosting, and labels.', margin, y + 56);
  doc.text('Governed democratically by the Huckleberry Collective Charter.', margin, y + 68);

  return doc;
}

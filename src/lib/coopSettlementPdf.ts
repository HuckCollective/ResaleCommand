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

export function generatePartnerSettlementPdf(data: PartnerStatementData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter' // 612 x 792 pt
  });

  const margin = 40;
  const pageWidth = 612;
  const pageHeight = 792;
  let y = margin;

  // Header Bar
  doc.setFillColor(16, 185, 129); // Primary emerald/green
  doc.rect(margin, y, pageWidth - (margin * 2), 4, 'F');
  y += 24;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text('HUCKLEBERRY COLLECTIVE COOPERATIVE', margin, y);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('Worker Self-Directed Consortium • Multi-Channel Retail Commons', margin, y + 14);

  // Statement Meta on Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(16, 185, 129);
  doc.text('PARTNER SETTLEMENT', pageWidth - margin, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
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
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Barcode Prefix: [ ${data.prefix} ] • Venue: ${data.boothLocation || 'Memory Den (Booth 0EJ)'}`, margin + 14, y + 32);

  // Financial Highlight on Right of Info Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(16, 185, 129);
  doc.text(`$${data.totalPayoutCheck.toFixed(2)}`, pageWidth - margin - 14, y + 20, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Total Net Payout Check', pageWidth - margin - 14, y + 32, { align: 'right' });

  y += 62;

  // Table Headers
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, pageWidth - (margin * 2), 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  const colX = {
    date: margin + 6,
    sku: margin + 60,
    title: margin + 120,
    gross: margin + 300,
    fee: margin + 355,
    cost: margin + 410,
    profit: margin + 465,
    take: pageWidth - margin - 6
  };

  doc.text('Date', colX.date, y + 13);
  doc.text('SKU / Code', colX.sku, y + 13);
  doc.text('Item Description', colX.title, y + 13);
  doc.text('Gross', colX.gross, y + 13, { align: 'right' });
  doc.text('Venue Fee', colX.fee, y + 13, { align: 'right' });
  doc.text('Cost Back', colX.cost, y + 13, { align: 'right' });
  doc.text('Surplus', colX.profit, y + 13, { align: 'right' });
  doc.text('Curator (70%)', colX.take, y + 13, { align: 'right' });

  y += 24;

  // Item Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);

  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];

    // Check for page break
    if (y > pageHeight - 90) {
      doc.addPage();
      y = margin;
      // Re-print table header on new page
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, pageWidth - (margin * 2), 20, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('Date', colX.date, y + 13);
      doc.text('SKU / Code', colX.sku, y + 13);
      doc.text('Item Description', colX.title, y + 13);
      doc.text('Gross', colX.gross, y + 13, { align: 'right' });
      doc.text('Venue Fee', colX.fee, y + 13, { align: 'right' });
      doc.text('Cost Back', colX.cost, y + 13, { align: 'right' });
      doc.text('Surplus', colX.profit, y + 13, { align: 'right' });
      doc.text('Curator (70%)', colX.take, y + 13, { align: 'right' });
      y += 24;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
    }

    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y - 9, pageWidth - (margin * 2), 16, 'F');
    }

    doc.text(item.date || '-', colX.date, y + 2);
    doc.text(item.sku || '-', colX.sku, y + 2);

    const safeTitle = item.title.length > 34 ? item.title.substring(0, 32) + '...' : item.title;
    doc.text(safeTitle, colX.title, y + 2);

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

    y += 16;
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
  doc.setFontSize(8.5);
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
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Worker Self-Directed Enterprise Guarantee:', margin, y + 20);
  doc.text('• 100% of purchase capital is returned dollar-for-dollar.', margin, y + 32);
  doc.text('• 70% of net surplus profit is distributed to curator.', margin, y + 44);
  doc.text('• 30% commons pool pays booth rent, hosting, and labels.', margin, y + 56);
  doc.text('Governed democratically by the Huckleberry Collective Charter.', margin, y + 68);

  return doc;
}

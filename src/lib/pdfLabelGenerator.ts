import { jsPDF } from 'jspdf';
import { getCode128Modules } from './barcode128';
import { extractShortTagTitle } from './exportUtils';
import type { RolloPrintItem, RolloPrintOptions } from './rolloLabelPrint';

/**
 * Generates an immutable, device-independent vector PDF for thermal label printing.
 * Bypasses all browser CSS @page rotation and margin bugs across all operating systems.
 */
export function generateLabelsPdf(items: RolloPrintItem[], options: RolloPrintOptions = {}): jsPDF {
  const size = options.size || '2x1';
  const vendor = (options.vendorHeader || 'MEMORY DEN').toUpperCase();

  let widthIn = 2.0;
  let heightIn = 1.0;

  if (size === 'butterfly') {
    widthIn = 2.2;
    heightIn = 0.5;
  } else if (size === '2.25x1.25') {
    widthIn = 2.25;
    heightIn = 1.25;
  } else if (size === '3x2') {
    widthIn = 3.0;
    heightIn = 2.0;
  } else if (size === '4x6') {
    widthIn = 4.0;
    heightIn = 6.0;
  }

  // Initialize jsPDF with exact physical dimensions in inches
  const doc = new jsPDF({
    orientation: widthIn >= heightIn ? 'landscape' : 'portrait',
    unit: 'in',
    format: [widthIn, heightIn]
  });

  let isFirstPage = true;

  for (const item of items) {
    const qty = Math.max(1, Number(item.quantity || 1));
    const title = extractShortTagTitle(item);

    // Resolve price
    const rawPrice = item.resalePrice ?? item.boutiquePrice ?? item.price ?? 0;
    const numPrice = Number(String(rawPrice).replace(/[^0-9.]/g, '')) || 0;
    const priceDisplay = `$${numPrice.toFixed(2)}`;

    // Resolve barcode value (Ricochet SKU priority for Memory Den)
    const cleanLocSku = (item.locationSku || '').replace(/^['"]+/, '').trim().toUpperCase();
    const cleanUpc = (item.upc || item.sku || '').trim().toUpperCase();
    const barcodeVal = cleanLocSku || cleanUpc || 'HUCK-0000';
    const modules = getCode128Modules(barcodeVal);

    let captionText = '';
    if (cleanLocSku && cleanUpc && cleanLocSku !== cleanUpc) {
      captionText = `${cleanLocSku} • ${cleanUpc}`;
    } else {
      captionText = cleanLocSku || cleanUpc || 'HUCK-0000';
    }

    for (let q = 0; q < qty; q++) {
      if (!isFirstPage) {
        doc.addPage([widthIn, heightIn], widthIn >= heightIn ? 'landscape' : 'portrait');
      }
      isFirstPage = false;

      if (size === 'butterfly') {
        // -------------------------------------------------------------
        // JEWELRY BUTTERFLY BARBELL TAG (2.2" × 0.5")
        // Left Wing: Store, Price, Title | Center: Empty | Right Wing: Barcode, SKU
        // -------------------------------------------------------------
        doc.setTextColor(0, 0, 0);

        // Left Wing (x: 0.04 to 0.80)
        doc.setFont('courier', 'bold');
        doc.setFontSize(6);
        doc.text(vendor, 0.05, 0.12);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(priceDisplay, 0.05, 0.28);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        let truncTitle = title;
        while (doc.getTextWidth(truncTitle) > 0.72 && truncTitle.length > 3) {
          truncTitle = truncTitle.slice(0, -1);
        }
        if (truncTitle !== title) truncTitle += '…';
        doc.text(truncTitle, 0.05, 0.42);

        // Center Bridge (x: 0.80 to 1.40) - Kept completely empty

        // Right Wing (x: 1.40 to 2.16)
        const rightStartX = 1.44;
        const rightWidth = 0.72;
        const barWidth = 0.007; // in inches
        const barcodeTotalWidth = modules.length * barWidth;
        const barStartX = rightStartX + Math.max(0.02, (rightWidth - barcodeTotalWidth) / 2);
        const barY = 0.08;
        const barH = 0.24;

        // Draw pure vector barcode rectangles
        doc.setFillColor(0, 0, 0);
        let inBar = false;
        let barStart = 0;
        for (let m = 0; m < modules.length; m++) {
          if (modules[m] === '1') {
            if (!inBar) {
              inBar = true;
              barStart = m;
            }
          } else {
            if (inBar) {
              inBar = false;
              const w = (m - barStart) * barWidth;
              doc.rect(barStartX + barStart * barWidth, barY, w, barH, 'F');
            }
          }
        }
        if (inBar) {
          const w = (modules.length - barStart) * barWidth;
          doc.rect(barStartX + barStart * barWidth, barY, w, barH, 'F');
        }

        // Caption SKU
        doc.setFont('courier', 'bold');
        doc.setFontSize(6.5);
        const skuCaption = cleanLocSku || cleanUpc;
        const skuWidth = doc.getTextWidth(skuCaption);
        doc.text(skuCaption, barStartX + (barcodeTotalWidth - skuWidth) / 2, barY + barH + 0.09);

      } else {
        // -------------------------------------------------------------
        // STANDARD RECTANGLE TAG (2" × 1", 2.25" × 1.25", etc.)
        // -------------------------------------------------------------
        doc.setTextColor(0, 0, 0);

        // Header: Store (left) & Price (right)
        doc.setFont('courier', 'bold');
        doc.setFontSize(7.5);
        doc.text(vendor, 0.08, 0.14);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        const priceW = doc.getTextWidth(priceDisplay);
        doc.text(priceDisplay, widthIn - 0.08 - priceW, 0.15);

        // Short Tag Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        let truncTitle = title;
        while (doc.getTextWidth(truncTitle) > (widthIn - 0.16) && truncTitle.length > 5) {
          truncTitle = truncTitle.slice(0, -1);
        }
        if (truncTitle !== title) truncTitle += '…';
        doc.text(truncTitle, 0.08, 0.28);

        // Code128 Vector Barcode (compact height 0.32" to ensure safety margin)
        const barWidth = 0.011; // in inches
        const barcodeTotalWidth = modules.length * barWidth;
        const barStartX = Math.max(0.08, (widthIn - barcodeTotalWidth) / 2);
        const barY = 0.35;
        const barH = 0.32;

        doc.setFillColor(0, 0, 0);
        let inBar = false;
        let barStart = 0;
        for (let m = 0; m < modules.length; m++) {
          if (modules[m] === '1') {
            if (!inBar) {
              inBar = true;
              barStart = m;
            }
          } else {
            if (inBar) {
              inBar = false;
              const w = (m - barStart) * barWidth;
              doc.rect(barStartX + barStart * barWidth, barY, w, barH, 'F');
            }
          }
        }
        if (inBar) {
          const w = (modules.length - barStart) * barWidth;
          doc.rect(barStartX + barStart * barWidth, barY, w, barH, 'F');
        }

        // Barcode Caption (positioned safely at 0.77", leaving >0.15" bottom margin)
        doc.setFont('courier', 'bold');
        doc.setFontSize(7);
        const capW = doc.getTextWidth(captionText);
        doc.text(captionText, (widthIn - capW) / 2, barY + barH + 0.10);
      }
    }
  }

  return doc;
}

/**
 * Triggers universal PDF print in the browser with autoPrint flags enabled.
 */
export function printLabelsViaPdf(items: RolloPrintItem[], options: RolloPrintOptions = {}) {
  const doc = generateLabelsPdf(items, options);
  doc.autoPrint();

  const blobUrl = doc.output('bloburl');

  // Create an invisible iframe to print the PDF seamlessly
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = blobUrl;

  document.body.appendChild(iframe);

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      // Fallback: open in new tab if iframe printing is blocked
      window.open(blobUrl, '_blank');
    }
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(blobUrl);
    }, 60000);
  };
}

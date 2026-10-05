import { generateCode128Svg } from './barcode128';
import { extractShortTagTitle } from './exportUtils';

export interface RolloPrintItem {
  id?: string;
  $id?: string;
  title?: string;
  tagTitle?: string;
  upc?: string;
  locationSku?: string;
  sku?: string;
  price?: number | string;
  resalePrice?: number | string;
  boutiquePrice?: number | string;
  cost?: number | string;
  quantity?: number;
  locationName?: string;
}

export interface RolloPrintOptions {
  size?: '2x1' | '2.25x1.25' | '3x2' | '4x6';
  vendorHeader?: string; // Default: 'MEMORY DEN'
  barcodeAuthority?: 'ricochet_sku' | 'upc'; // Prefer Ricochet SKU for Den registers, fallback to UPC
}

/**
 * Generates printable HTML for Rollo thermal printer.
 * Each item produces (quantity) individual labels with exact @page dimensions and page breaks.
 */
export function generateRolloPrintHtml(items: RolloPrintItem[], options: RolloPrintOptions = {}): string {
  const size = options.size || '2x1';
  const vendor = options.vendorHeader || 'MEMORY DEN';

  let widthIn = 2.0;
  let heightIn = 1.0;
  let barHeight = 26;
  let titleFontSize = '9px';
  let priceFontSize = '14px';

  if (size === '2.25x1.25') {
    widthIn = 2.25;
    heightIn = 1.25;
    barHeight = 32;
    titleFontSize = '10px';
    priceFontSize = '16px';
  } else if (size === '3x2') {
    widthIn = 3.0;
    heightIn = 2.0;
    barHeight = 55;
    titleFontSize = '12px';
    priceFontSize = '20px';
  } else if (size === '4x6') {
    widthIn = 4.0;
    heightIn = 6.0;
    barHeight = 120;
    titleFontSize = '18px';
    priceFontSize = '28px';
  }

  const labelHtmls: string[] = [];

  for (const item of items) {
    const qty = Math.max(1, Number(item.quantity || 1));
    const title = extractShortTagTitle(item);
    
    // Resolve price
    const rawPrice = item.resalePrice ?? item.boutiquePrice ?? item.price ?? 0;
    const numPrice = Number(String(rawPrice).replace(/[^0-9.]/g, '')) || 0;
    const priceDisplay = `$${numPrice.toFixed(2)}`;

    // Resolve barcode value:
    // If locationSku is present (e.g. '0EJ0NO' or '0EJ0NO), clerks at Memory Den scan this!
    const cleanLocSku = (item.locationSku || '').replace(/^['"]+/, '').trim().toUpperCase();
    const cleanUpc = (item.upc || item.sku || '').trim().toUpperCase();
    
    // The barcode value scanned by register:
    // If cleanLocSku exists, use it so cashier scans Memory Den SKU. Otherwise use HUCK UPC.
    const barcodeVal = cleanLocSku || cleanUpc || 'HUCK-0000';
    
    // Generate SVG barcode
    const barcodeSvg = generateCode128Svg(barcodeVal, {
      height: barHeight,
      barWidth: 2,
      includeText: false
    });

    // Human readable caption: show both SKU and UPC if available
    let captionText = '';
    if (cleanLocSku && cleanUpc && cleanLocSku !== cleanUpc) {
      captionText = `${cleanLocSku} • ${cleanUpc}`;
    } else {
      captionText = cleanLocSku || cleanUpc;
    }

    const singleLabel = `
      <div class="rollo-label">
        <div class="label-header">
          <span class="vendor-tag">${vendor}</span>
          <span class="price-tag">${priceDisplay}</span>
        </div>
        <div class="item-title">${escapeHtml(title)}</div>
        <div class="barcode-container">
          ${barcodeSvg}
        </div>
        <div class="barcode-caption">${escapeHtml(captionText)}</div>
      </div>
    `;

    for (let q = 0; q < qty; q++) {
      labelHtmls.push(singleLabel);
    }
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Rollo Thermal Barcode Labels</title>
  <style>
    @page {
      size: ${widthIn}in ${heightIn}in;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: white;
      color: black;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .rollo-label {
      width: ${widthIn}in;
      height: ${heightIn}in;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
      padding: 0.05in 0.08in;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: stretch;
      background: white;
    }
    .label-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      line-height: 1.1;
    }
    .vendor-tag {
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      opacity: 0.85;
      font-family: monospace;
    }
    .price-tag {
      font-size: ${priceFontSize};
      font-weight: 900;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .item-title {
      font-size: ${titleFontSize};
      font-weight: 700;
      line-height: 1.15;
      max-height: 2.3em;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      margin-top: 1px;
    }
    .barcode-container {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      margin: 1px 0;
      overflow: hidden;
    }
    .barcode-container svg {
      max-width: 95%;
      height: ${barHeight}px;
      display: block;
    }
    .barcode-caption {
      font-size: 8px;
      font-weight: 700;
      font-family: monospace;
      text-align: center;
      letter-spacing: 0.5px;
      line-height: 1;
      margin-top: 0px;
    }
  </style>
</head>
<body>
  ${labelHtmls.join('\n')}
</body>
</html>`;
}

/**
 * Triggers Rollo print popup in browser.
 */
export function printRolloLabels(items: RolloPrintItem[], options: RolloPrintOptions = {}) {
  const html = generateRolloPrintHtml(items, options);
  
  // Create an iframe to print cleanly without leaving the current page
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    // Fallback: open print window
    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(html);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        printWin.print();
        printWin.close();
      }, 300);
    }
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 400);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

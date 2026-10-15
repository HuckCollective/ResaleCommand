import { generateCode128Svg } from './barcode128';
import { extractShortTagTitle } from './exportUtils';
import { generateQrCodeSvg, resolveQrPayload } from './qrCodeHelper';

export interface RolloPrintItem {
  id?: string;
  $id?: string;
  title?: string;
  tagTitle?: string;
  upc?: string;
  locationSku?: string;
  sku?: string;
  bin?: string;
  customCaption?: string; // Explicit caption override
  barcodeVal?: string; // Explicit barcode override
  price?: number | string;
  resalePrice?: number | string;
  boutiquePrice?: number | string;
  cost?: number | string;
  quantity?: number;
  locationName?: string;
}

import { printLabelsViaPdf, generateLabelsPdf } from './pdfLabelGenerator';

export interface RolloPrintOptions {
  size?: '2x1' | '2.25x1.25' | '3x2' | '4x6' | 'butterfly';
  vendorHeader?: string; // Default: 'MEMORY DEN'
  barcodeAuthority?: 'ricochet_sku' | 'upc' | 'auto'; // What barcode encodes
  engine?: 'pdf' | 'html'; // Default: 'pdf' (immutable vector PDF, bypasses all browser rotation bugs)
  barcodeType?: 'code128' | 'qr'; // Default: 'code128'
  qrDataFormat?: 'sku' | 'url'; // Default: 'sku'
  qrBaseUrl?: string; // Default: 'https://resalecommand.com/i/'
  customCaption?: string; // Explicit caption override across batch
}

export { printLabelsViaPdf, generateLabelsPdf, generateQrCodeSvg, resolveQrPayload };

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
  let barWidth = 2;
  let titleFontSize = '9px';
  let priceFontSize = '14px';

  if (size === 'butterfly') {
    widthIn = 2.2;
    heightIn = 0.5;
    barHeight = 18;
    barWidth = 1.5;
    titleFontSize = '6.5px';
    priceFontSize = '11px';
  } else if (size === '2.25x1.25') {
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

    // Resolve barcode value with explicit override support:
    const cleanLocSku = (item.locationSku || '').replace(/^['"]+/, '').trim().toUpperCase();
    const cleanUpc = (item.upc || item.sku || '').trim().toUpperCase();
    const cleanBin = (item.bin || item.locationName || '').trim().toUpperCase();
    
    let barcodeVal = (item.barcodeVal || '').trim().toUpperCase();
    if (!barcodeVal) {
      if (options.barcodeAuthority === 'upc') {
        barcodeVal = cleanUpc || cleanLocSku || 'UPC-0000';
      } else if (options.barcodeAuthority === 'ricochet_sku') {
        barcodeVal = cleanLocSku || cleanUpc || 'UPC-0000';
      } else {
        // Auto: Prefer store SKU if present, otherwise UPC
        barcodeVal = cleanLocSku || cleanUpc || 'UPC-0000';
      }
    }

    const isQr = options.barcodeType === 'qr';
    const qrPayload = isQr ? resolveQrPayload(item, options.qrDataFormat, options.qrBaseUrl) : '';
    const qrSvg = isQr ? generateQrCodeSvg(qrPayload) : '';

    // Caption logic with explicit override support:
    let captionText = (item.customCaption || options.customCaption || '').trim();
    if (!captionText) {
      if (cleanLocSku && cleanUpc && cleanLocSku !== cleanUpc) {
        captionText = `${cleanLocSku} • ${cleanUpc}`;
      } else if (cleanBin && cleanUpc) {
        captionText = `BIN: ${cleanBin} • ${cleanUpc}`;
      } else {
        captionText = cleanLocSku || cleanUpc || 'UPC-0000';
      }
    }

    // Generate SVG barcode
    const barcodeSvg = !isQr ? generateCode128Svg(barcodeVal, {
      height: barHeight,
      barWidth,
      includeText: false
    }) : '';

    let singleLabel = '';

    if (size === 'butterfly') {
      // Dual-paddle jewelry layout (Left Wing: Price/Title, Middle: Blank tail, Right Wing: Barcode/SKU)
      singleLabel = `
        <div class="rollo-label butterfly-label">
          <div class="butterfly-wing butterfly-left">
            <div class="butterfly-vendor">${escapeHtml(vendor)}</div>
            <div class="butterfly-price">${priceDisplay}</div>
            <div class="butterfly-title" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
          </div>
          <div class="butterfly-bridge"></div>
          <div class="butterfly-wing butterfly-right">
            <div class="${isQr ? 'qr-container-bfly' : 'barcode-container'}">
              ${isQr ? qrSvg : barcodeSvg}
            </div>
            <div class="barcode-caption">${escapeHtml(cleanLocSku || cleanUpc || 'UPC-0000')}</div>
          </div>
        </div>
      `;
    } else if (isQr) {
      // 2D Mini QR Side-by-Side Layout (Left: Big price + Title, Right: Compact QR matrix)
      singleLabel = `
        <div class="rollo-label qr-label">
          <div class="qr-left">
            <div class="vendor-tag">${vendor}</div>
            <div class="qr-price">${priceDisplay}</div>
            <div class="item-title">${escapeHtml(title)}</div>
            <div class="qr-caption-sub">${escapeHtml(captionText)}</div>
          </div>
          <div class="qr-right">
            <div class="qr-container-box">
              ${qrSvg}
            </div>
            <div class="barcode-caption">${escapeHtml(cleanLocSku || cleanUpc || 'UPC-0000')}</div>
          </div>
        </div>
      `;
    } else {
      singleLabel = `
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
    }

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
      box-sizing: border-box;
      padding: 0.04in 0.06in;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: stretch;
      background: white;
    }
    .rollo-label:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    /* 2D Mini QR Layout */
    .rollo-label.qr-label {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: stretch;
      padding: 0.05in 0.08in;
    }
    .qr-left {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding-right: 0.06in;
      overflow: hidden;
    }
    .qr-price {
      font-size: ${size === '2x1' ? '18px' : '22px'};
      font-weight: 900;
      line-height: 1.05;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .qr-caption-sub {
      font-size: 7.5px;
      font-weight: 800;
      font-family: monospace;
      letter-spacing: 0.4px;
      opacity: 0.9;
    }
    .qr-right {
      width: ${size === '2x1' ? '0.85in' : '1.1in'};
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .qr-container-box svg {
      width: ${size === '2x1' ? '0.70in' : '0.90in'};
      height: ${size === '2x1' ? '0.70in' : '0.90in'};
      display: block;
    }
    .qr-container-bfly svg {
      width: 0.30in;
      height: 0.30in;
      display: block;
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
    /* Butterfly Jewelry Tag Specifics (2.2" x 0.5") */
    .rollo-label.butterfly-label {
      width: 2.2in;
      height: 0.5in;
      padding: 0;
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: stretch;
    }
    .butterfly-wing {
      width: 0.8in;
      height: 0.5in;
      box-sizing: border-box;
    }
    .butterfly-left {
      padding: 0.03in 0.04in;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: flex-start;
      overflow: hidden;
    }
    .butterfly-vendor {
      font-size: 6.5px;
      font-weight: 800;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      font-family: monospace;
      line-height: 1;
    }
    .butterfly-price {
      font-size: 11px;
      font-weight: 900;
      line-height: 1.1;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .butterfly-title {
      font-size: 6.5px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      line-height: 1;
    }
    .butterfly-bridge {
      width: 0.6in;
      height: 0.5in;
      flex-shrink: 0;
    }
    .butterfly-right {
      padding: 0.02in 0.03in;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      overflow: hidden;
    }
    .butterfly-right .barcode-container {
      margin: 0;
    }
    .butterfly-right .barcode-container svg {
      max-width: 100%;
      height: 18px;
    }
    .butterfly-right .barcode-caption {
      font-size: 7px;
      font-weight: 800;
      font-family: monospace;
      letter-spacing: 0.4px;
      line-height: 1;
      margin-top: 1px;
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
  // Use the robust Universal PDF engine by default (bypasses browser CSS @page rotation bugs)
  if (options.engine !== 'html') {
    printLabelsViaPdf(items, options);
    return;
  }

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

import { encode, renderSVG } from 'uqr';

export interface QrCodeOptions {
  size?: number;
  whiteColor?: string;
  blackColor?: string;
}

/**
 * Generates an SVG string representation of a QR code.
 * Zero external rendering dependencies; produces clean SVG vector path.
 */
export function generateQrCodeSvg(text: string, options: QrCodeOptions = {}): string {
  const clean = (text || '').trim();
  if (!clean) return '';
  return renderSVG(clean, {
    whiteColor: options.whiteColor ?? 'white',
    blackColor: options.blackColor ?? 'black'
  });
}

/**
 * Returns raw 2D boolean matrix of QR modules for direct vector rendering in jsPDF or canvas.
 */
export function getQrCodeMatrix(text: string): { data: boolean[][]; size: number } {
  const clean = (text || '').trim();
  if (!clean) {
    return { data: [], size: 0 };
  }
  const result = encode(clean);
  return {
    data: result.data as boolean[][],
    size: result.size
  };
}

/**
 * Resolves the payload string to encode into the QR code based on user preference.
 */
export function resolveQrPayload(
  item: { locationSku?: string; upc?: string; sku?: string },
  format: 'sku' | 'url' = 'sku',
  baseUrl = 'https://resalecommand.com/i/'
): string {
  const cleanLocSku = (item.locationSku || '').replace(/^['"]+/, '').trim().toUpperCase();
  const cleanUpc = (item.upc || item.sku || '').trim().toUpperCase();
  const primaryIdentifier = cleanLocSku || cleanUpc || 'HUCK-0000';

  if (format === 'url') {
    const slug = cleanUpc || cleanLocSku || 'item';
    const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return `${cleanBase}${slug}`;
  }

  return primaryIdentifier;
}

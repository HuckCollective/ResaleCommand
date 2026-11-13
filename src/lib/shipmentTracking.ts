export interface ParsedTrackingInfo {
  number: string;
  shortNumber: string;
  carrier: 'USPS' | 'FedEx' | 'UPS' | 'Carrier';
  url: string;
  badgeClass: string;
}

const IGNORED_TOKENS = new Set([
  'refunded',
  'refund',
  'none',
  'n/a',
  'na',
  'null',
  'undefined',
  'pending',
  'local',
  'pickup',
  'localpickup',
  'in-store',
  'instore',
  'cancelled',
  'canceled',
  'tbd',
]);

export function parseTrackingNumbers(raw?: string | null): ParsedTrackingInfo[] {
  if (!raw || typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (IGNORED_TOKENS.has(trimmed.toLowerCase())) {
    return [];
  }

  const rawTokens = trimmed
    .split(/[-,\s;|/]+/)
    .map((t) => t.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '').trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const results: ParsedTrackingInfo[] = [];

  for (const token of rawTokens) {
    const lower = token.toLowerCase();
    if (IGNORED_TOKENS.has(lower)) continue;

    const clean = token.toUpperCase();
    if (clean.length < 10 || seen.has(clean)) continue;
    // Skip tokens that have no digits at all
    if (!/\d/.test(clean)) continue;

    seen.add(clean);
    const shortNumber = clean.slice(-4);

    if (/^1Z[0-9A-Z]{16}$/i.test(clean)) {
      results.push({
        number: clean,
        shortNumber,
        carrier: 'UPS',
        url: `https://www.ups.com/track?tracknum=${encodeURIComponent(clean)}`,
        badgeClass: 'badge-warning text-warning-content',
      });
      continue;
    }

    if (
      /^(92|93|94|95)\d{18,24}$/.test(clean) ||
      /^420\d{23,31}$/.test(clean) ||
      /^[A-Z]{2}\d{9}US$/i.test(clean)
    ) {
      results.push({
        number: clean,
        shortNumber,
        carrier: 'USPS',
        url: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(clean)}`,
        badgeClass: 'badge-info text-info-content',
      });
      continue;
    }

    if (/^\d{12}$/.test(clean) || /^\d{15}$/.test(clean) || /^\d{20}$/.test(clean)) {
      results.push({
        number: clean,
        shortNumber,
        carrier: 'FedEx',
        url: `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(clean)}`,
        badgeClass: 'badge-secondary text-secondary-content',
      });
      continue;
    }

    if (/^[A-Z0-9]{10,34}$/.test(clean)) {
      results.push({
        number: clean,
        shortNumber,
        carrier: 'Carrier',
        url: `https://www.google.com/search?q=${encodeURIComponent(clean + ' package tracking')}`,
        badgeClass: 'badge-neutral text-neutral-content',
      });
    }
  }

  return results;
}

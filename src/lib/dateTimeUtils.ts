/**
 * Universal Date & Time Utilities for Resale Command
 * Handles timezone conversions between US Pacific (ShopGoodwill/Portland retail) and UTC ISO 8601.
 */

/**
 * Parses a date string (especially from ShopGoodwill, which outputs dates in US Pacific Time
 * without timezone offset, e.g. "2026-11-11T18:01:00" or "11/11/2026 6:01:00 PM")
 * into a precise UTC ISO 8601 string.
 */
export function parsePacificDateToIso(rawDateStr: string | null | undefined): string | null {
    if (!rawDateStr) return null;
    const cleanStr = String(rawDateStr).trim();
    if (!cleanStr) return null;

    // If it already has an explicit timezone (e.g. trailing 'Z' or '+00:00' or '-08:00')
    if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(cleanStr)) {
        const d = new Date(cleanStr);
        return isNaN(d.getTime()) ? null : d.toISOString();
    }

    // Try parsing standard YYYY-MM-DDTHH:mm(:ss)? or YYYY-MM-DD HH:mm(:ss)?
    const isoMatch = cleanStr.replace(' ', 'T').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (isoMatch) {
        const [, y, mo, d, h, min, sec = '00'] = isoMatch;
        return calculatePacificIso(+y, +mo, +d, +h, +min, +sec);
    }

    // Try parsing US format: MM/DD/YYYY H:mm(:ss)? (AM|PM)?
    const usMatch = cleanStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i);
    if (usMatch) {
        const [, mo, d, y, rawH = '0', min = '00', sec = '00', ampm] = usMatch;
        let h = parseInt(rawH, 10);
        if (ampm) {
            const upper = ampm.toUpperCase();
            if (upper === 'PM' && h < 12) h += 12;
            if (upper === 'AM' && h === 12) h = 0;
        }
        return calculatePacificIso(+y, +mo, +d, h, +min, +sec);
    }

    // Fallback: try native Date parsing
    const fallback = new Date(cleanStr);
    return isNaN(fallback.getTime()) ? null : fallback.toISOString();
}

/**
 * Calculates exact UTC ISO string for a given year, month, day, hour, min, sec in America/Los_Angeles
 * accurately accounting for Daylight Saving Time (PST UTC-8 vs PDT UTC-7).
 */
function calculatePacificIso(year: number, month: number, day: number, hour: number, min: number, sec: number): string {
    // Make an approximate UTC date around this time to check Pacific offset
    const approxUtc = new Date(Date.UTC(year, month - 1, day, hour + 8, min, sec));
    
    let offset = '-08:00';
    try {
        const dtf = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Los_Angeles',
            timeZoneName: 'shortOffset'
        });
        const tzName = dtf.formatToParts(approxUtc).find(p => p.type === 'timeZoneName')?.value || 'GMT-8';
        const match = tzName.match(/GMT([+-])(\d+)(?::(\d+))?/);
        if (match) {
            const sign = match[1];
            const hrs = match[2].padStart(2, '0');
            const mins = (match[3] || '00').padStart(2, '0');
            offset = `${sign}${hrs}:${mins}`;
        }
    } catch {
        offset = '-08:00';
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    const fullStr = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(min)}:${pad(sec)}${offset}`;
    const finalDate = new Date(fullStr);
    return isNaN(finalDate.getTime()) ? approxUtc.toISOString() : finalDate.toISOString();
}

/**
 * Formats an ISO string for display in US Pacific Time (or local browser time)
 * e.g. "Nov 11, 2026, 6:01 PM PT"
 */
export function formatPacificDateDisplay(isoStr: string | null | undefined): string {
    if (!isoStr) return 'No date set';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return 'Invalid date';

    try {
        return d.toLocaleString('en-US', {
            timeZone: 'America/Los_Angeles',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }) + ' PT';
    } catch {
        return d.toLocaleString();
    }
}

/**
 * Converts an ISO string into standard HTML <input type="datetime-local"> format: YYYY-MM-DDTHH:mm
 * expressed in user's local timezone for clean form editing.
 */
export function isoToDatetimeLocal(isoStr: string | null | undefined): string {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    
    const pad = (n: number) => String(n).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Converts standard HTML <input type="datetime-local"> value (YYYY-MM-DDTHH:mm)
 * back to a standard UTC ISO 8601 string.
 */
export function datetimeLocalToIso(localStr: string | null | undefined): string | null {
    if (!localStr) return null;
    const clean = String(localStr).trim();
    if (!clean) return null;
    const d = new Date(clean);
    return isNaN(d.getTime()) ? null : d.toISOString();
}


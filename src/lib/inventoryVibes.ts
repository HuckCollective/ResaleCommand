import { matchesLocationFilter } from './warehouses';

export type SpatialLocationId = 'all' | '__unassigned__' | 'MD' | 'DT' | 'HG' | 'HH' | 'HD';
export type SmartQueueId =
    | 'md_restock'
    | 'dt_restock'
    | 'needs_md_sync'
    | 'missing_booth_sku'
    | 'booth_bins'
    | 'has_booth_sku';
export type PartnerPrefixId = 'all' | 'HUCK-' | 'PDXGL-' | 'BB-' | '0EJ';

export interface SpatialLocationMeta {
    id: SpatialLocationId;
    label: string;
    shortLabel: string;
    description: string;
    isAlert?: boolean;
}

export interface SmartQueueMeta {
    id: SmartQueueId;
    label: string;
    shortLabel: string;
    description: string;
    badgeClass: string;
}

export interface PartnerPrefixMeta {
    id: PartnerPrefixId;
    label: string;
    description: string;
}

export const SPATIAL_LOCATIONS: SpatialLocationMeta[] = [
    {
        id: 'all',
        label: 'All Locations',
        shortLabel: 'All',
        description: 'All storage and retail locations'
    },
    {
        id: '__unassigned__',
        label: '🚨 Unassigned',
        shortLabel: '🚨 Unassigned',
        description: 'Active items missing a physical storageLocation (Golden Rule #1 triage)',
        isAlert: true
    },
    {
        id: 'MD',
        label: '🔮 MD',
        shortLabel: '🔮 MD',
        description: "Memory Den Booth #0EJ — Huck's Adventures Outfitters"
    },
    {
        id: 'DT',
        label: '🐯 DT',
        shortLabel: '🐯 DT',
        description: 'Dusty Tiger Consignment Booth — Small Collectibles & Curios'
    },
    {
        id: 'HG',
        label: '🏠 HG',
        shortLabel: '🏠 HG',
        description: "Huck's Garage — Primary Hardgoods & Bulk Backstock"
    },
    {
        id: 'HH',
        label: '🏡 HH',
        shortLabel: '🏡 HH',
        description: "Huck's Hideout — Climate-Controlled Backstock & Staging"
    },
    {
        id: 'HD',
        label: '🛋️ HD',
        shortLabel: '🛋️ HD',
        description: 'Legacy HD Location Code Records'
    }
];

export const SMART_QUEUES: SmartQueueMeta[] = [
    {
        id: 'md_restock',
        label: '🔮 Pull for MD',
        shortLabel: '🔮 Pull for MD',
        description: 'Untagged backstock in HG/HH/HD/Unassigned matching Memory Den vibes (Goth, Whimsigoth, TTRPG, Oddities, Sci-Fi, Horror, Cult Media).',
        badgeClass: 'badge-primary'
    },
    {
        id: 'dt_restock',
        label: '🐯 Pull for DT',
        shortLabel: '🐯 Pull for DT',
        description: 'Untagged backstock matching Dusty Tiger smalls, jewelry, enamel pins, pocket items, coins, and wands (<8").',
        badgeClass: 'badge-secondary'
    },
    {
        id: 'needs_md_sync',
        label: '🔄 0EJ Not Marked MD',
        shortLabel: '🔄 0EJ Not Marked MD',
        description: 'Items already tagged with a 0EJ Ricochet SKU that still show HD/HG/HH/Unassigned or are not marked Placed in MD.',
        badgeClass: 'badge-warning'
    },
    {
        id: 'missing_booth_sku',
        label: '⚠️ MD Missing 0EJ',
        shortLabel: '⚠️ MD Missing 0EJ',
        description: 'Items assigned to Memory Den (MD) that are missing their 0EJ Ricochet booth SKU.',
        badgeClass: 'badge-warning'
    },
    {
        id: 'booth_bins',
        label: '📦 Booth Bins (Qty > 1)',
        shortLabel: '📦 Booth Bins',
        description: 'Multi-quantity Booth Bins and volume crates (quantity > 1).',
        badgeClass: 'badge-info'
    },
    {
        id: 'has_booth_sku',
        label: '🏷️ 0EJ Tagged',
        shortLabel: '🏷️ 0EJ Tagged',
        description: 'All active items tagged with a Memory Den Ricochet 0EJ booth SKU.',
        badgeClass: 'badge-success'
    }
];

export const PARTNER_PREFIXES: PartnerPrefixMeta[] = [
    { id: 'all', label: 'All', description: 'All co-op partners & SKUs' },
    { id: 'HUCK-', label: 'HUCK-', description: 'The Huckleberry Collective' },
    { id: 'PDXGL-', label: 'PDXGL-', description: 'PDX Game Library' },
    { id: 'BB-', label: 'BB-', description: 'Consignor BB-' },
    { id: '0EJ', label: '0EJ', description: 'Memory Den Ricochet Booth #0EJ SKU' }
];

// Pre-compiled whole-word regular expressions (matched ONLY against title, identity, and keywords)
const MD_VIBE_REGEX = /\b(goth|gothic|whimsigoth|witch|witchy|wiccan|occult|tarot|altar|ttrpg|d&d|dnd|dungeons|warhammer|sci-fi|scifi|cyberpunk|horror|macabre|punk|skull|skeleton|oddity|oddities|curio|taxidermy|ouija|baphomet|pentagram|chalice|goblet|candelabra|steampunk|vampire|gargoyle|dragon|wizard|necromancer|arcade|vhs|cassette)\b/i;

const DT_VIBE_REGEX = /\b(enamel pin|lapel pin|hat pin|pins|jewelry|ring|rings|necklace|pendant|bracelet|bangle|brooch|earring|earrings|cufflink|cufflinks|patch|patches|keychain|keychains|fob|wand|wands|miniature|figurine|trinket|pill box|snuff|coin|coins|token|tokens|medallion|lighter|zippo|pocket watch|pocket knife|marbles|charm|charms|beads|sticker|stickers|magnet|magnets|badge)\b/i;

const DT_EXCLUSION_REGEX = /\b(shirt|t-shirt|jacket|coat|sweater|hoodie|pants|jeans|dress|skirt|shoes|boots|playset|board game)\b/i;

function getSearchableVibeText(item: any): string {
    if (!item) return '';
    const kw = Array.isArray(item.keywords) ? item.keywords.join(' ') : String(item.keywords || '');
    return [
        item.title || '',
        item.identity || '',
        kw
    ]
        .join(' ')
        .toLowerCase();
}

/**
 * Canonical "Working Stock" scope matching default Active Stock on Inventory page:
 * Excludes sold, deconstructed, combined, tracked, and scouted items.
 * Includes active, acquired, received, and placed items.
 */
export function isWorkingStockItem(item: any): boolean {
    if (!item) return false;
    const st = String(item.status || 'acquired').trim().toLowerCase();
    return !['sold', 'tracked', 'scouted', 'combined', 'deconstructed'].includes(st);
}

/**
 * True when storageLocation is empty, null, whitespace, 'unassigned', or 'none'.
 */
export function isUnassignedLocation(item: any): boolean {
    if (!item) return true;
    const raw = typeof item.storageLocation === 'string' ? item.storageLocation.trim().toLowerCase() : '';
    if (!raw || raw === 'unassigned' || raw === 'none' || raw === 'null' || raw === 'undefined') {
        return true;
    }
    return false;
}

/**
 * True if item has a 0EJ Memory Den Ricochet SKU in locationSku or upc.
 */
export function hasZeroEjSku(item: any): boolean {
    if (!item) return false;
    const locSku = String(item.locationSku || '').trim().toUpperCase().replace(/^'+/, '');
    const upc = String(item.upc || '').trim().toUpperCase().replace(/^'+/, '');
    return locSku.startsWith('0EJ') || upc.startsWith('0EJ');
}

/**
 * True if item is already placed/assigned in MD or DT retail booths,
 * OR already has a 0EJ Ricochet booth SKU assigned.
 */
export function isAlreadyInBooth(item: any): boolean {
    if (!item) return false;
    if (hasZeroEjSku(item)) return true;

    const sl = typeof item.storageLocation === 'string' ? item.storageLocation.trim().toUpperCase() : '';
    if (
        sl === 'MD' ||
        sl.startsWith('MD-') ||
        sl.startsWith('MD:') ||
        sl.includes('MEMORY DEN') ||
        sl === 'DT' ||
        sl.startsWith('DT-') ||
        sl.startsWith('DT:') ||
        sl.includes('DUSTY TIGER')
    ) {
        return true;
    }

    if (item.sellingLocations) {
        const arr = Array.isArray(item.sellingLocations) ? item.sellingLocations : [item.sellingLocations];
        for (const loc of arr) {
            const clean = String(loc || '').trim().toLowerCase();
            if (
                clean === 'md' ||
                clean === 'dt' ||
                clean.includes('memory den') ||
                clean.includes('dusty tiger')
            ) {
                return true;
            }
        }
    }

    return false;
}

/**
 * True if item is untagged backstock/unassigned (not already in MD/DT and no 0EJ SKU) and matches Memory Den vibes.
 */
export function matchesMdRestockVibe(item: any): boolean {
    if (!item || !isWorkingStockItem(item) || isAlreadyInBooth(item)) return false;
    const text = getSearchableVibeText(item);
    return MD_VIBE_REGEX.test(text);
}

/**
 * True if item is untagged backstock/unassigned (not already in MD/DT and no 0EJ SKU) and matches Dusty Tiger smalls/jewelry/pins/wands.
 */
export function matchesDtRestockVibe(item: any): boolean {
    if (!item || !isWorkingStockItem(item) || isAlreadyInBooth(item)) return false;
    const text = getSearchableVibeText(item);
    if (DT_EXCLUSION_REGEX.test(text)) return false;
    return DT_VIBE_REGEX.test(text);
}

/**
 * True if item is assigned to Memory Den (MD) either via storageLocation or sellingLocations.
 */
export function isAssignedToMd(item: any): boolean {
    if (!item) return false;
    const sl = String(item.storageLocation || '').trim().toUpperCase();
    if (sl === 'MD' || sl.startsWith('MD-') || sl.startsWith('MD:') || sl.includes('MEMORY DEN')) {
        return true;
    }
    if (item.sellingLocations) {
        const arr = Array.isArray(item.sellingLocations) ? item.sellingLocations : [item.sellingLocations];
        if (arr.some((c: any) => {
            const s = String(c || '').trim().toLowerCase();
            return s === 'md' || s.includes('memory den');
        })) {
            return true;
        }
    }
    return false;
}

/**
 * True if item has a 0EJ Ricochet SKU but is still sitting in HD/HG/HH/unassigned or not marked 'placed'.
 */
export function needsMdSync(item: any): boolean {
    if (!item || !isWorkingStockItem(item)) return false;
    if (!hasZeroEjSku(item)) return false;
    const st = String(item.status || 'acquired').trim().toLowerCase();
    return !isAssignedToMd(item) || st !== 'placed';
}

/**
 * Evaluates whether an item matches the specified Smart Queue ID.
 */
export function matchesSmartQueue(item: any, queueId: string | null | undefined): boolean {
    if (!queueId) return true;
    switch (queueId as SmartQueueId) {
        case 'md_restock':
            return matchesMdRestockVibe(item);
        case 'dt_restock':
            return matchesDtRestockVibe(item);
        case 'needs_md_sync':
            return needsMdSync(item);
        case 'missing_booth_sku':
            return isWorkingStockItem(item) && isAssignedToMd(item) && !hasZeroEjSku(item);
        case 'booth_bins':
            return isWorkingStockItem(item) && (Number(item?.quantity) || 1) > 1;
        case 'has_booth_sku':
            return isWorkingStockItem(item) && hasZeroEjSku(item);
        default:
            return true;
    }
}

/**
 * Evaluates whether an item matches a Partner Prefix or 0EJ SKU filter.
 */
export function matchesPartnerPrefix(item: any, prefix: string | null | undefined): boolean {
    if (!prefix || prefix === 'all') return true;
    const cleanTarget = prefix.trim().toUpperCase();
    if (cleanTarget === '0EJ') {
        return hasZeroEjSku(item);
    }
    const upc = String(item?.upc || item?.sku || '').trim().toUpperCase();
    const locSku = String(item?.locationSku || '').trim().toUpperCase();
    return upc.startsWith(cleanTarget) || upc.includes(cleanTarget) || locSku.startsWith(cleanTarget);
}

/**
 * Evaluates spatial location filter including '__unassigned__', 'HD', 'HH', 'HG', 'MD', 'DT', or custom bins.
 */
export function matchesSpatialLocation(item: any, locationFilter: string | null | undefined): boolean {
    if (!locationFilter || locationFilter === 'all' || !locationFilter.trim()) {
        return true;
    }
    const target = locationFilter.trim();
    if (target === '__unassigned__') {
        return isUnassignedLocation(item);
    }
    const upper = target.toUpperCase();
    const sl = String(item?.storageLocation || '').trim().toUpperCase();

    // Explicitly distinguish HD vs HH so both tabs show their exact records
    if (upper === 'HD') {
        return sl === 'HD' || sl.startsWith('HD-') || sl.startsWith('HD:');
    }
    if (upper === 'HH') {
        return (
            sl === 'HH' ||
            sl.startsWith('HH-') ||
            sl.startsWith('HH:') ||
            sl.includes("HUCK'S HIDEOUT") ||
            sl.includes('HUCKS HIDEOUT') ||
            sl.includes("HUCK'S HOUSE")
        );
    }

    return matchesLocationFilter(item, target);
}

import { databases, Query, ID } from './appwrite';
import type { Models } from 'appwrite';
import { Permission, Role } from 'appwrite';

const DB_ID = import.meta.env?.PUBLIC_APPWRITE_DB_ID || 'resale_db';
const WAREHOUSES_COL = 'warehouses';

export interface WarehouseData {
    name: string;
    code?: string;
    type: string;
    commissionRate?: number;
    monthlyRent?: number;
    categories?: string;
    niche?: string;
    tenantId: string;
}

export type WarehouseDocument = WarehouseData & Models.Document;

export const warehousesApi = {
    async listWarehouses(tenantId?: string): Promise<WarehouseDocument[]> {
        const queries = [Query.orderAsc('name'), Query.limit(100)];
        if (tenantId) {
            queries.unshift(Query.equal('tenantId', tenantId));
        }
        
        const response = await databases.listDocuments(
            DB_ID,
            WAREHOUSES_COL,
            queries
        );
        return response.documents as WarehouseDocument[];
    },

    formatWarehouseBin(warehouseCode: string, bin?: string): string {
        const code = (warehouseCode || '').trim().toUpperCase();
        if (!bin || !bin.trim()) return code;
        const cleanBin = bin.trim().toUpperCase().replace(/^[-_\s]+/, '');
        return `${code}-${cleanBin}`;
    },

    async getWarehouse(id: string): Promise<WarehouseDocument> {
        if (!id) throw new Error("id is required");
        return await databases.getDocument(DB_ID, WAREHOUSES_COL, id) as WarehouseDocument;
    },

    async createWarehouse(data: WarehouseData): Promise<WarehouseDocument> {
        if (!data.tenantId) throw new Error("tenantId is required");
        const role = Role.team(data.tenantId);
        const permissions = [
            Permission.read(role),
            Permission.update(role),
            Permission.delete(role),
        ];
        return await databases.createDocument(
            DB_ID,
            WAREHOUSES_COL,
            ID.unique(),
            data,
            permissions
        ) as WarehouseDocument;
    },

    async updateWarehouse(id: string, data: Partial<WarehouseData>): Promise<WarehouseDocument> {
        if (!id) throw new Error("id is required");
        return await databases.updateDocument(
            DB_ID,
            WAREHOUSES_COL,
            id,
            data
        ) as WarehouseDocument;
    },

    async deleteWarehouse(id: string): Promise<void> {
        if (!id) throw new Error("id is required");
        await databases.deleteDocument(DB_ID, WAREHOUSES_COL, id);
    }
};

export interface FacilityDefinition {
    id: string;
    code: string;
    icon: string;
    name: string;
    shortName: string;
    fullName: string;
    displayName: string;
    subtitle: string;
    type: string;
    commissionRate: number;
    feePct: number;
    monthlyRent: number;
    skuPrefix: string;
    posName: string;
    aliases: string[];
    channelName?: string;
}

export type LocationSettingMeta = FacilityDefinition;

export const KNOWN_FACILITIES: FacilityDefinition[] = [
    {
        id: '6a7e70050009db0e1857',
        code: 'MD',
        icon: '🔮',
        name: "Memory Den - Huck's Adventures Outfitters",
        shortName: 'Memory Den',
        fullName: "Memory Den - Huck's Adventures Outfitters",
        displayName: 'Memory Den (MD)',
        subtitle: "Huck's Adventures Outfitters (#0EJ)",
        type: 'Consignment Booth',
        commissionRate: 15,
        feePct: 15,
        monthlyRent: 382.5,
        skuPrefix: '0EJ',
        posName: 'Ricochet POS',
        aliases: ['md', 'memory den', 'memoryden', 'memory_den', '0ej', 'hao', "huck's adventures outfitters", "memory den - huck's adventures outfitters"],
        channelName: 'Memory Den',
    },
    {
        id: '6a7e71eb001f53734a86',
        code: 'DT',
        icon: '🐯',
        name: 'Dusty Tiger',
        shortName: 'Dusty Tiger',
        fullName: 'Dusty Tiger Consignment Booth',
        displayName: 'Dusty Tiger (DT)',
        subtitle: 'Small Collectibles, Jewelry & Wands <8"',
        type: 'Consignment Booth',
        commissionRate: 10,
        feePct: 10,
        monthlyRent: 75,
        skuPrefix: 'DT-',
        posName: 'Booth POS',
        aliases: ['dt', 'dusty tiger', 'dustytiger', 'dusty_tiger', 'tiger'],
        channelName: 'Dusty Tiger',
    },
    {
        id: '6a7e6f73003a5a2a7c34',
        code: 'HG',
        icon: '🏠',
        name: "Huck's Garage",
        shortName: "Huck's Garage",
        fullName: "Huck's Garage Warehouse",
        displayName: "Huck's Garage (HG)",
        subtitle: 'Primary Backstock & Hardgoods',
        type: 'Warehouse / Backstock',
        commissionRate: 0,
        feePct: 0,
        monthlyRent: 0,
        skuPrefix: 'HG-',
        posName: 'Warehouse CSV',
        aliases: ['hg', 'backstock', "huck's garage", 'hucks garage', 'hucksgarage', 'garage'],
    },
    {
        id: '6ae3afbd0030a7eb8a9c',
        code: 'HH',
        icon: '🏡',
        name: "Huck's Hideout",
        shortName: "Huck's Hideout",
        fullName: "Huck's Hideout Backstock",
        displayName: "Huck's Hideout (HH)",
        subtitle: 'Climate-Controlled Backstock & Staging',
        type: 'Warehouse / Backstock',
        commissionRate: 0,
        feePct: 0,
        monthlyRent: 0,
        skuPrefix: 'HH-',
        posName: 'Warehouse CSV',
        aliases: ['hh', 'hd', 'hideout', "huck's hideout", 'hucks hideout', 'huckshideout', "huck's house", 'hucks house'],
    }
];

export const KNOWN_FACILITY_CODES: string[] = KNOWN_FACILITIES.map(f => f.code);

export function resolveCanonicalLocationCode(locOrStr: any, liveWarehouses?: any[]): string {
    if (!locOrStr) return '';
    if (typeof locOrStr === 'string') {
        const s = locOrStr.trim();
        const u = s.toUpperCase();
        const byDirect = KNOWN_FACILITIES.find(f => f.code === u || f.id === s);
        if (byDirect) return byDirect.code;
        if (liveWarehouses && Array.isArray(liveWarehouses)) {
            const matchedLive = liveWarehouses.find(w => w?.$id === s || String(w?.code || '').trim().toUpperCase() === u);
            if (matchedLive) {
                return resolveCanonicalLocationCode(matchedLive);
            }
        }
        const byFac = findFacility(s);
        if (byFac) return byFac.code;
        const l = s.toLowerCase();
        if (l.includes('memory') || l.includes('0ej')) return 'MD';
        if (l.includes('dusty') || l.includes('tiger')) return 'DT';
        if (l.includes('garage')) return 'HG';
        if (l.includes('hideout') || l.includes('house')) return 'HH';
        return '';
    }
    const id = String(locOrStr.$id || locOrStr.id || '').trim();
    const byId = KNOWN_FACILITIES.find(f => f.id === id);
    if (byId) return byId.code;
    const c = String(locOrStr.code || '').trim().toUpperCase();
    const byCode = KNOWN_FACILITIES.find(f => f.code === c);
    if (byCode) return byCode.code;
    const n = String(locOrStr.name || locOrStr.displayName || '').trim();
    const byName = findFacility(n);
    if (byName) return byName.code;
    return resolveCanonicalLocationCode(n);
}

export function getLocationSettingMeta(locOrStr: any, liveWarehouses?: any[]): LocationSettingMeta {
    const code = resolveCanonicalLocationCode(locOrStr, liveWarehouses) || 'MD';
    const base = KNOWN_FACILITIES.find(f => f.code === code) || KNOWN_FACILITIES[0];
    const liveDoc =
        (typeof locOrStr === 'object' && locOrStr && (locOrStr.$id || locOrStr.name) ? locOrStr : null) ||
        (Array.isArray(liveWarehouses)
            ? liveWarehouses.find(w => w?.$id === base.id || resolveCanonicalLocationCode(w) === base.code)
            : null);

    if (!liveDoc) return { ...base };

    const fee =
        liveDoc.commissionRate !== undefined && liveDoc.commissionRate !== null && !isNaN(Number(liveDoc.commissionRate))
            ? Number(liveDoc.commissionRate)
            : base.commissionRate;
    const rent =
        liveDoc.monthlyRent !== undefined && liveDoc.monthlyRent !== null && !isNaN(Number(liveDoc.monthlyRent))
            ? Number(liveDoc.monthlyRent)
            : base.monthlyRent;
    const liveName = String(liveDoc.name || base.name).trim();

    return {
        ...base,
        id: String(liveDoc.$id || base.id),
        name: liveName,
        shortName: base.shortName || liveName,
        fullName: liveName,
        displayName: `${ base.shortName || liveName } (${ base.code })`,
        type: String(liveDoc.type || base.type),
        commissionRate: fee,
        feePct: fee,
        monthlyRent: rent,
    };
}

export function getAllLocationSettingMetas(liveWarehouses?: any[]): LocationSettingMeta[] {
    return KNOWN_FACILITIES.map(f => getLocationSettingMeta(f.code, liveWarehouses));
}

export function getLocationManifestDocIds(locOrStr: any, liveWarehouses?: any[]): {
    code: string;
    reportDocId: string;
    payloadDocId: string;
} {
    const code = (resolveCanonicalLocationCode(locOrStr, liveWarehouses) || 'MD').toUpperCase();
    const prefix = code.toLowerCase();
    return {
        code,
        reportDocId: `${ prefix }_verify_report_latest`,
        payloadDocId: `${ prefix }_live_payload_latest`,
    };
}

export function findFacility(search: string): FacilityDefinition | undefined {
    if (!search) return undefined;
    const clean = search.trim().toLowerCase();
    const noPunct = clean.replace(/[^a-z0-9]/g, '');
    return KNOWN_FACILITIES.find(f => 
        f.code.toLowerCase() === clean ||
        f.name.toLowerCase() === clean ||
        f.displayName.toLowerCase() === clean ||
        f.aliases.includes(clean) ||
        (f.channelName && f.channelName.toLowerCase() === clean) ||
        f.aliases.some(a => a.replace(/[^a-z0-9]/g, '') === noPunct)
    );
}

export interface LocationOption {
    value: string;
    label: string;
}

/**
 * Returns the configured default backstock storage location for a team or user, defaulting to 'HG'.
 */
export function getDefaultStorageLocation(teamOrUser?: any): string {
    const prefLoc = teamOrUser?.prefs?.defaultStorageLocation || teamOrUser?.prefs?.defaultLocation;
    if (prefLoc && typeof prefLoc === 'string' && prefLoc.trim() && prefLoc.trim().toLowerCase() !== 'backstock') {
        return prefLoc.trim();
    }
    return 'HG';
}

export function getWarehouseFacilityOptions(
    items?: any[],
    extraLocations?: string[]
): LocationOption[] {
    const list: LocationOption[] = KNOWN_FACILITIES.map(f => ({
        value: f.code,
        label: f.displayName
    }));

    const knownFacilityCodes = new Set(KNOWN_FACILITIES.map(f => f.code.toUpperCase()));
    const knownAliases = new Set(KNOWN_FACILITIES.flatMap(f => f.aliases.map(a => a.toUpperCase())));

    const bins = new Set<string>();

    if (items && Array.isArray(items)) {
        for (const item of items) {
            const sl = typeof item?.storageLocation === 'string' ? item.storageLocation.trim() : '';
            if (sl && !sl.startsWith('Order #:') && !sl.startsWith('[SCOUT') && !sl.startsWith('[GALLERY')) {
                const upper = sl.toUpperCase();
                // Exclude raw facility codes or aliases already listed at top
                if (!knownFacilityCodes.has(upper) && !knownAliases.has(upper)) {
                    bins.add(sl);
                }
            }
        }
    }

    if (extraLocations && Array.isArray(extraLocations)) {
        for (const loc of extraLocations) {
            const str = String(loc || '').trim();
            if (str) {
                const upper = str.toUpperCase();
                if (!knownFacilityCodes.has(upper) && !knownAliases.has(upper)) {
                    bins.add(str);
                }
            }
        }
    }

    const sortedBins = Array.from(bins).sort((a, b) => a.localeCompare(b));
    for (const b of sortedBins) {
        list.push({ value: b, label: b });
    }

    return list;
}

export function matchesLocationFilter(
    item: { 
        storageLocation?: string | null; 
        sellingLocations?: string[] | string | null; 
        purchaseLocation?: string | null;
    },
    filterValue: string
): boolean {
    if (!filterValue || filterValue === 'all' || filterValue.trim() === '') {
        return true;
    }

    const target = filterValue.trim().toLowerCase();
    const facility = findFacility(target);

    // 1. If target is a facility (e.g. HG, HD, MD, DT, Huck's Garage, Memory Den)
    if (facility) {
        const facCodeLower = facility.code.toLowerCase();
        
        // Match storageLocation
        if (item.storageLocation && typeof item.storageLocation === 'string') {
            const sl = item.storageLocation.trim().toLowerCase();
            if (
                sl === facCodeLower || 
                sl.startsWith(`${facCodeLower}-`) || 
                sl.startsWith(`${facCodeLower}:`) ||
                facility.aliases.includes(sl) ||
                facility.aliases.some(a => sl.startsWith(`${a}-`) || sl.startsWith(`${a}:`))
            ) {
                return true;
            }
        }

        // Match sellingLocations (for consignment booth sales / placement)
        if (item.sellingLocations) {
            const sellingArr = Array.isArray(item.sellingLocations) 
                ? item.sellingLocations 
                : [item.sellingLocations];
            for (const s of sellingArr) {
                if (!s || typeof s !== 'string') continue;
                const cleanS = s.trim().toLowerCase();
                if (
                    cleanS === facCodeLower ||
                    facility.aliases.includes(cleanS) ||
                    (facility.channelName && cleanS === facility.channelName.toLowerCase())
                ) {
                    return true;
                }
            }
        }

        // Match purchaseLocation
        if (item.purchaseLocation && typeof item.purchaseLocation === 'string') {
            const pl = item.purchaseLocation.trim().toLowerCase();
            if (pl === facCodeLower || facility.aliases.includes(pl)) {
                return true;
            }
        }

        return false;
    }

    // 2. Specific bin or custom location (e.g. 'HG-RED-16', 'HD-04', 'SHELF-A')
    const cleanTarget = target.replace(/[^a-z0-9]/g, '');

    const checkValue = (val: any): boolean => {
        if (!val) return false;
        if (Array.isArray(val)) return val.some(v => checkValue(v));
        const str = String(val).trim().toLowerCase();
        const cleanStr = str.replace(/[^a-z0-9]/g, '');
        return str === target || 
               cleanStr === cleanTarget || 
               str.startsWith(`${target}-`) || 
               str.startsWith(`${target}:`) ||
               (cleanTarget.length >= 3 && cleanStr.includes(cleanTarget));
    };

    return checkValue(item.storageLocation) || 
           checkValue(item.sellingLocations) || 
           checkValue(item.purchaseLocation);
}

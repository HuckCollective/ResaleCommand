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
    code: string;
    name: string;
    displayName: string;
    aliases: string[];
    channelName?: string;
}

export const KNOWN_FACILITIES: FacilityDefinition[] = [
    {
        code: 'HG',
        name: "Huck's Garage",
        displayName: "Huck's Garage (HG)",
        aliases: ['hg', 'backstock', "huck's garage", 'hucks garage', 'hucksgarage'],
    },
    {
        code: 'HD',
        name: 'Hideout',
        displayName: 'Hideout (HD)',
        aliases: ['hd', 'hideout'],
    },
    {
        code: 'MD',
        name: "Memory Den - Huck's Adventures Outfitters",
        displayName: 'Memory Den (MD)',
        aliases: ['md', 'memory den', 'memoryden', 'memory_den', 'hao', "huck's adventures outfitters", "memory den - huck's adventures outfitters"],
        channelName: 'Memory Den',
    },
    {
        code: 'DT',
        name: 'Dusty Tiger',
        displayName: 'Dusty Tiger (DT)',
        aliases: ['dt', 'dusty tiger', 'dustytiger', 'dusty_tiger', 'tiger'],
        channelName: 'Dusty Tiger',
    }
];

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

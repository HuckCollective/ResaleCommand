import { ref, computed, type Ref } from 'vue';
import type { Models } from 'appwrite';
import { BUCKET_ID } from '../lib/inventory';

const ENDPOINT = import.meta.env.PUBLIC_APPWRITE_ENDPOINT;
const PROJECT = import.meta.env.PUBLIC_APPWRITE_PROJECT_ID;

export type InventorySortColumn = 'title' | 'cost' | 'resalePrice' | 'margin' | 'upc' | 'vendor' | 'status' | 'location' | '$createdAt';
export type SortDirection = 'asc' | 'desc';

// -- 0. IMAGE RESOLUTION HELPER (Exact ItemCard standard) --
export const getItemImageUrl = (item: any, size: number = 100): string | null => {
    if (!item) return null;
    let id = item.imageId;
    if (!id && Array.isArray(item.galleryImageIds) && item.galleryImageIds.length > 0) {
        id = item.galleryImageIds[0];
    }
    if (!id && Array.isArray(item.images) && item.images.length > 0) {
        id = typeof item.images[0] === 'string' ? item.images[0] : (item.images[0]?.url || item.images[0]?.id);
    }
    
    if (!id && item.conditionNotes && typeof item.conditionNotes === 'string') {
        const match = item.conditionNotes.match(/\[MAIN IMAGE ID: ([^\]]+)\]/);
        if (match && match[1]) id = match[1].split(',')[0].trim();
    }
    
    if (!id) return null;
    
    if (typeof id === 'string' && id.startsWith('http')) {
        if (id.includes('/api/proxy-image') || id.includes('/storage/buckets/')) return id;
        return `/api/proxy-image?url=${encodeURIComponent(id)}`;
    }
    
    return `${ENDPOINT}/storage/buckets/${BUCKET_ID || 'item_images'}/files/${id}/preview?project=${PROJECT}&width=${size}&height=${size}&quality=80&output=webp`;
};

/**
 * Composable for searching, filtering, and sorting inventory items.
 * Keeps filtering and sorting logic decoupled from Vue presentation components.
 */
export function useInventoryFilters(sourceItems: Ref<Models.Document[]>) {
    const searchQuery = ref('');
    const filterStatus = ref('all');
    const filterLocation = ref('all');
    const sortColumn = ref<InventorySortColumn>('$createdAt');
    const sortDirection = ref<SortDirection>('desc');

    // -- 1. VENDOR RESOLUTION HELPER --
    const getVendorName = (item: any): string => {
        if (!item) return 'Unknown';
        if (item.sourcingLocation?.includes('shopgoodwill')) return 'ShopGoodwill';
        if (item.sourcingLocation?.includes('ctbids')) return 'CTBids';
        if (item.sourcingLocation?.includes('hibid')) return 'HiBid';
        if (item.sourcingLocation) return item.sourcingLocation.replace(/https?:\/\//, '').split('/')[0];
        return 'ShopGoodwill';
    };

    // -- 2. ROI / MARGIN CALCULATION --
    const calculateRoi = (item: any): number | null => {
        const cost = parseFloat(item.cost) || 0;
        const price = parseFloat(item.resalePrice || item.boutiquePrice) || 0;
        if (cost <= 0 || price <= 0) return null;
        const margin = ((price - cost) / cost) * 100;
        return Math.round(margin);
    };

    // -- 3. EXTRACT ALL LOCATIONS --
    const allLocations = computed(() => {
        const locs = new Set<string>();
        locs.add('Memory Den Booth #12');
        locs.add('Dusty Tiger');
        locs.add('Backstock Bin A');
        locs.add('Backstock Bin B');
        for (const it of sourceItems.value) {
            if ((it as any).storageLocation) locs.add((it as any).storageLocation);
            if (Array.isArray((it as any).sellingLocations)) {
                (it as any).sellingLocations.forEach((l: string) => l && locs.add(l));
            }
        }
        return Array.from(locs).sort();
    });

    // -- 4. STATUS COUNTERS --
    const countByStatus = (status: string) => {
        return sourceItems.value.filter(i => ((i as any).status || 'acquired').toLowerCase() === status.toLowerCase()).length;
    };

    // -- 5. ACTIVE FILTERS COUNT --
    const activeFilterCount = computed(() => {
        let count = 0;
        if (filterStatus.value !== 'all') count++;
        if (filterLocation.value !== 'all') count++;
        if (searchQuery.value.trim()) count++;
        return count;
    });

    const clearFilters = () => {
        searchQuery.value = '';
        filterStatus.value = 'all';
        filterLocation.value = 'all';
    };

    // -- 6. SORTING CONTROLS --
    const setSort = (col: InventorySortColumn) => {
        if (sortColumn.value === col) {
            sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
        } else {
            sortColumn.value = col;
            sortDirection.value = 'desc';
        }
    };

    const getSortIcon = (col: InventorySortColumn) => {
        if (sortColumn.value !== col) return 'solar:sort-vertical-linear';
        return sortDirection.value === 'asc' ? 'solar:arrow-up-linear' : 'solar:arrow-down-linear';
    };

    // -- 7. FILTERED & SORTED PIPELINE --
    const filteredItems = computed(() => {
        const q = searchQuery.value.toLowerCase().trim();
        const st = filterStatus.value.toLowerCase();
        const loc = filterLocation.value;

        return sourceItems.value.filter(item => {
            const anyItem = item as any;

            // Status filter
            if (st !== 'all') {
                const itemStatus = (anyItem.status || 'acquired').toLowerCase();
                if (itemStatus !== st) return false;
            }

            // Location filter
            if (loc !== 'all') {
                const matchesStorage = anyItem.storageLocation === loc;
                const matchesSelling = Array.isArray(anyItem.sellingLocations) && anyItem.sellingLocations.includes(loc);
                if (!matchesStorage && !matchesSelling) return false;
            }

            // Omnisearch
            if (q) {
                const titleMatch = (anyItem.title || '').toLowerCase().includes(q);
                const upcMatch = (anyItem.upc || '').toLowerCase().includes(q);
                const idMatch = (anyItem.identity || '').toLowerCase().includes(q);
                const notesMatch = (anyItem.conditionNotes || '').toLowerCase().includes(q);
                const locMatch = (anyItem.storageLocation || '').toLowerCase().includes(q);
                const vendorMatch = getVendorName(anyItem).toLowerCase().includes(q);
                if (!titleMatch && !upcMatch && !idMatch && !notesMatch && !locMatch && !vendorMatch) {
                    return false;
                }
            }

            return true;
        }).sort((a, b) => {
            const anyA = a as any;
            const anyB = b as any;
            let aVal = anyA[sortColumn.value];
            let bVal = anyB[sortColumn.value];

            if (sortColumn.value === 'margin') {
                aVal = calculateRoi(anyA) ?? -999;
                bVal = calculateRoi(anyB) ?? -999;
            } else if (sortColumn.value === 'vendor') {
                aVal = getVendorName(anyA);
                bVal = getVendorName(anyB);
            } else if (sortColumn.value === 'cost' || sortColumn.value === 'resalePrice') {
                aVal = parseFloat(aVal) || 0;
                bVal = parseFloat(bVal) || 0;
            }

            if (typeof aVal === 'string') aVal = aVal.toLowerCase();
            if (typeof bVal === 'string') bVal = bVal.toLowerCase();

            if (aVal < bVal) return sortDirection.value === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection.value === 'asc' ? 1 : -1;
            return 0;
        });
    });

    return {
        searchQuery,
        filterStatus,
        filterLocation,
        sortColumn,
        sortDirection,
        allLocations,
        activeFilterCount,
        filteredItems,
        setSort,
        getSortIcon,
        countByStatus,
        clearFilters,
        getVendorName,
        calculateRoi,
        getItemImageUrl,
    };
}

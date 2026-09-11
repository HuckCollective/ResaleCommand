import { ref, computed, type Ref } from 'vue';
import type { Models } from 'appwrite';
import { BUCKET_ID } from '../lib/inventory';
import { getWarehouseFacilityOptions, findFacility, matchesLocationFilter } from '../lib/warehouses';

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
 * Domain definition of active physical on-hand stock:
 * Excludes sold, tracked (not yet acquired), scouted (in shopping cart), and combined items.
 */
export const isActiveInventory = (status: string = ''): boolean => {
    const st = (status || 'acquired').toLowerCase();
    return !['sold', 'tracked', 'scouted', 'combined'].includes(st);
};

export interface FilterChip {
    id: string;
    label: string;
    onRemove: () => void;
}

/**
 * Comprehensive composable for searching, filtering, sorting, and exclusions.
 * Powers both Spreadsheet Table View and Card Grid View.
 */
export function useInventoryFilters(sourceItems: Ref<Models.Document[]>) {
    const searchQuery = ref('');
    const filterStatus = ref('active'); // 'active' is default on-hand physical stock
    const filterLocation = ref('all');
    const filterChannel = ref('all');
    const hideSold = ref(true);
    const hideTracked = ref(true); // Excludes unacquired tracker and cart items
    const hideCombined = ref(true); // Excludes merged/combined items
    const filterPlacedLocated = ref(false); // Only placed items with a storage location
    const filterInsight = ref(''); // 'ready_to_list' | 'missing_photos' | 'missing_pricing' | 'missing_cost'
    const filterBarcode = ref('all'); // 'all' | '__missing__' | '__has_barcode__' | string prefix
    const filterLotType = ref('all'); // 'all' | 'lots_only' | 'extracted_only' | 'standalone_only'
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

    // Helper for numeric values from item fields or condition notes
    const parseVal = (itm: any, key: string, noteKey: string): number => {
        let val = 0;
        if (itm[key]) {
            val = parseFloat(itm[key]);
        } else if (itm.conditionNotes) {
            const regex = new RegExp(`${noteKey}[:\\s]*\\$?([\\d.]+)`, 'i');
            const match = itm.conditionNotes.match(regex);
            if (match) val = parseFloat(match[1]);
        }
        return isNaN(val) ? 0 : val;
    };

    // -- 2. ROI / MARGIN CALCULATION --
    const calculateRoi = (item: any): number | null => {
        const cost = parseFloat(item.cost) || 0;
        const price = parseFloat(item.resalePrice || item.boutiquePrice) || 0;
        if (cost <= 0 || price <= 0) return null;
        const margin = ((price - cost) / cost) * 100;
        return Math.round(margin);
    };

    // -- 3. EXTRACT ALL LOCATIONS & CHANNELS --
    const allLocations = computed(() => {
        return getWarehouseFacilityOptions(sourceItems.value);
    });

    const allChannels = computed(() => {
        const channels = new Set<string>();
        channels.add('Memory Den');
        channels.add('Dusty Tiger');
        channels.add('eBay');
        channels.add('Poshmark');
        for (const it of sourceItems.value) {
            if (Array.isArray((it as any).sellingLocations)) {
                (it as any).sellingLocations.forEach((l: string) => l && channels.add(l.trim()));
            }
        }
        return Array.from(channels).sort();
    });

    // -- 4. EXTRACT UPC PREFIXES --
    const allUpcPrefixes = computed(() => {
        const map = new Map<string, number>();
        let missingCount = 0;
        let hasCount = 0;

        for (const it of sourceItems.value) {
            const upc = (it as any).upc?.trim();
            if (!upc) {
                missingCount++;
            } else {
                hasCount++;
                const prefixMatch = upc.match(/^([A-Za-z]+-)/);
                const pfx = prefixMatch ? prefixMatch[1] : (upc.length > 5 ? upc.slice(0, 5) : upc);
                map.set(pfx, (map.get(pfx) || 0) + 1);
            }
        }

        const list = Array.from(map.entries()).map(([prefix, count]) => ({ prefix, count }));
        list.sort((a, b) => b.count - a.count);
        return {
            list,
            missingCount,
            hasCount
        };
    });

    // -- 5. STATUS COUNTERS --
    const countActive = computed(() => {
        return sourceItems.value.filter(i => isActiveInventory((i as any).status)).length;
    });

    const countByStatus = (status: string) => {
        const st = status.toLowerCase();
        if (st === 'active') return countActive.value;
        if (st === 'tracked') {
            return sourceItems.value.filter(i => {
                const s = ((i as any).status || '').toLowerCase();
                return s === 'tracked' || s === 'scouted';
            }).length;
        }
        return sourceItems.value.filter(i => ((i as any).status || 'acquired').toLowerCase() === st).length;
    };

    // AI Insight Counters
    const countMissingPhotos = computed(() => {
        return sourceItems.value.filter(i => !getItemImageUrl(i)).length;
    });

    const countMissingPricing = computed(() => {
        return sourceItems.value.filter(i => {
            const itm = i as any;
            if (itm.status === 'sold') return false;
            const price = parseVal(itm, 'resalePrice', 'Resale') || parseVal(itm, 'estValue', 'Est. Low') || parseVal(itm, 'listPrice', 'Est');
            return price <= 0;
        }).length;
    });

    const countReadyToList = computed(() => {
        return sourceItems.value.filter(i => {
            const itm = i as any;
            if (!['acquired', 'received'].includes(itm.status)) return false;
            if (!itm.title || itm.title.trim() === '') return false;
            const price = parseVal(itm, 'resalePrice', 'Resale') || parseVal(itm, 'estValue', 'Est. Low');
            if (price <= 0) return false;
            return Boolean(getItemImageUrl(itm));
        }).length;
    });

    // -- 6. ACTIVE FILTERS LIST & CHIPS --
    const activeFilterChips = computed<FilterChip[]>(() => {
        const chips: FilterChip[] = [];

        // Status chip
        if (filterStatus.value !== 'active' && filterStatus.value !== 'all') {
            const capitalized = filterStatus.value.charAt(0).toUpperCase() + filterStatus.value.slice(1);
            chips.push({
                id: 'status',
                label: `Status: ${capitalized}`,
                onRemove: () => { filterStatus.value = 'active'; }
            });
        } else if (filterStatus.value === 'all') {
            chips.push({
                id: 'status-all',
                label: 'All Items (incl. Sold/Trackers)',
                onRemove: () => { filterStatus.value = 'active'; }
            });
        }

        // Location chip
        if (filterLocation.value !== 'all') {
            const fac = findFacility(filterLocation.value);
            const display = fac ? fac.displayName : filterLocation.value;
            chips.push({
                id: 'location',
                label: `Location: ${display}`,
                onRemove: () => { filterLocation.value = 'all'; }
            });
        }

        // Channel chip
        if (filterChannel.value !== 'all') {
            chips.push({
                id: 'channel',
                label: `Channel: ${filterChannel.value}`,
                onRemove: () => { filterChannel.value = 'all'; }
            });
        }

        // Barcode chip
        if (filterBarcode.value === '__missing__') {
            chips.push({
                id: 'barcode-missing',
                label: 'No Barcode',
                onRemove: () => { filterBarcode.value = 'all'; }
            });
        } else if (filterBarcode.value === '__has_barcode__') {
            chips.push({
                id: 'barcode-has',
                label: 'Has Barcode',
                onRemove: () => { filterBarcode.value = 'all'; }
            });
        } else if (filterBarcode.value !== 'all') {
            chips.push({
                id: 'barcode-prefix',
                label: `UPC: ${filterBarcode.value}`,
                onRemove: () => { filterBarcode.value = 'all'; }
            });
        }

        // Insight chip
        if (filterInsight.value) {
            const map: Record<string, string> = {
                missing_photos: 'Missing Photos',
                missing_pricing: 'Missing Pricing',
                missing_cost: 'Missing Cost Basis',
                ready_to_list: 'Ready to List'
            };
            chips.push({
                id: 'insight',
                label: map[filterInsight.value] || filterInsight.value,
                onRemove: () => { filterInsight.value = ''; }
            });
        }

        // Lot Type chip
        if (filterLotType.value !== 'all') {
            const map: Record<string, string> = {
                lots_only: 'Parent Lots Only',
                extracted_only: 'Extracted Children',
                standalone_only: 'Standalone Items'
            };
            chips.push({
                id: 'lotType',
                label: map[filterLotType.value] || filterLotType.value,
                onRemove: () => { filterLotType.value = 'all'; }
            });
        }

        // Placed & Located chip
        if (filterPlacedLocated.value) {
            chips.push({
                id: 'placedLocated',
                label: 'Placed & Located',
                onRemove: () => { filterPlacedLocated.value = false; }
            });
        }

        // Explicit "Hide Sold" chip if on 'all'
        if (filterStatus.value === 'all' && hideSold.value) {
            chips.push({
                id: 'hideSold',
                label: 'Hiding Sold',
                onRemove: () => { hideSold.value = false; }
            });
        }

        // Explicit "Showing Trackers" chip if toggled on
        if (!hideTracked.value && filterStatus.value !== 'tracked') {
            chips.push({
                id: 'showTracked',
                label: 'Including Trackers',
                onRemove: () => { hideTracked.value = true; }
            });
        }

        // Search chip
        if (searchQuery.value.trim()) {
            chips.push({
                id: 'search',
                label: `"${searchQuery.value}"`,
                onRemove: () => { searchQuery.value = ''; }
            });
        }

        return chips;
    });

    const clearFilters = () => {
        searchQuery.value = '';
        filterStatus.value = 'active';
        filterLocation.value = 'all';
        filterChannel.value = 'all';
        filterInsight.value = '';
        filterBarcode.value = 'all';
        filterLotType.value = 'all';
        filterPlacedLocated.value = false;
        hideSold.value = true;
        hideTracked.value = true;
        hideCombined.value = true;
    };

    // -- 7. SORTING CONTROLS --
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

    // -- 8. FILTERED & SORTED PIPELINE --
    const filteredItems = computed(() => {
        const q = searchQuery.value.toLowerCase().trim();
        const st = filterStatus.value.toLowerCase();
        const loc = filterLocation.value;
        const ch = filterChannel.value;
        const insight = filterInsight.value;
        const bc = filterBarcode.value;
        const lot = filterLotType.value;
        const placedOnly = filterPlacedLocated.value;
        const doHideSold = hideSold.value;
        const doHideTracked = hideTracked.value;
        const doHideCombined = hideCombined.value;

        return sourceItems.value.filter(item => {
            const anyItem = item as any;
            const itemStatus = (anyItem.status || 'acquired').toLowerCase();

            // 1. Core Exclusion: Combined / Merged items
            if (doHideCombined && itemStatus === 'combined' && st !== 'combined') {
                return false;
            }

            // 2. Core Exclusion: Trackers & Scouted (unacquired items)
            // If hideTracked is true, hide them unless user is on the Tracked tab
            if (doHideTracked && (itemStatus === 'tracked' || itemStatus === 'scouted') && st !== 'tracked') {
                return false;
            }

            // 3. Core Exclusion: Sold items
            if (doHideSold && itemStatus === 'sold' && st !== 'sold') {
                return false;
            }

            // 4. Status Filter
            if (st === 'active') {
                if (!isActiveInventory(itemStatus)) return false;
            } else if (st === 'tracked') {
                if (itemStatus !== 'tracked' && itemStatus !== 'scouted') return false;
            } else if (st !== 'all') {
                if (itemStatus !== st) return false;
            }

            // 5. Placed & Located filter
            if (placedOnly) {
                if (itemStatus !== 'placed') return false;
                if (!anyItem.storageLocation || anyItem.storageLocation.trim() === '') return false;
            }

            // 6. Location filter
            if (loc && loc !== 'all') {
                if (!matchesLocationFilter(anyItem, loc)) return false;
            }

            // 7. Sales Channel filter
            if (ch !== 'all') {
                const matchesChannel = Array.isArray(anyItem.sellingLocations) && anyItem.sellingLocations.includes(ch);
                if (!matchesChannel) return false;
            }

            // 8. Barcode / UPC filter
            if (bc === '__missing__') {
                if (anyItem.upc && anyItem.upc.trim() !== '') return false;
            } else if (bc === '__has_barcode__') {
                if (!anyItem.upc || anyItem.upc.trim() === '') return false;
            } else if (bc !== 'all') {
                if (!anyItem.upc || !anyItem.upc.toLowerCase().startsWith(bc.toLowerCase())) return false;
            }

            // 9. Lot Type filter
            if (lot === 'lots_only') {
                const isLot = anyItem.quantity > 1 || (anyItem.title && anyItem.title.toLowerCase().startsWith('lot of'));
                if (!isLot) return false;
            } else if (lot === 'extracted_only') {
                if (!anyItem.parentLotId) return false;
            } else if (lot === 'standalone_only') {
                if (anyItem.parentLotId || anyItem.quantity > 1 || (anyItem.title && anyItem.title.toLowerCase().startsWith('lot of'))) {
                    return false;
                }
            }

            // 10. AI Health Insights
            if (insight === 'missing_photos') {
                if (Boolean(getItemImageUrl(anyItem))) return false;
            } else if (insight === 'missing_pricing') {
                if (itemStatus === 'sold') return false;
                const price = parseVal(anyItem, 'resalePrice', 'Resale') || parseVal(anyItem, 'estValue', 'Est. Low') || parseVal(anyItem, 'listPrice', 'Est');
                if (price > 0) return false;
            } else if (insight === 'missing_cost') {
                if (itemStatus === 'sold') return false;
                const cost = parseVal(anyItem, 'cost', 'Paid') || parseVal(anyItem, 'purchasePrice', 'Paid');
                if (cost > 0) return false;
            } else if (insight === 'ready_to_list') {
                if (!['acquired', 'received'].includes(itemStatus)) return false;
                if (!anyItem.title || anyItem.title.trim() === '') return false;
                const price = parseVal(anyItem, 'resalePrice', 'Resale') || parseVal(anyItem, 'estValue', 'Est. Low');
                if (price <= 0) return false;
                if (!Boolean(getItemImageUrl(anyItem))) return false;
            }

            // 11. Omnisearch
            if (q) {
                const titleMatch = (anyItem.title || '').toLowerCase().includes(q);
                const upcMatch = (anyItem.upc || '').toLowerCase().includes(q);
                const idMatch = (anyItem.identity || '').toLowerCase().includes(q);
                const notesMatch = (anyItem.conditionNotes || '').toLowerCase().includes(q);
                const locMatch = (anyItem.storageLocation || '').toLowerCase().includes(q);
                const vendorMatch = getVendorName(anyItem).toLowerCase().includes(q);
                const poMatch = (anyItem.poNumber || anyItem.orderId || anyItem.purchaseId || '').toLowerCase().includes(q);
                if (!titleMatch && !upcMatch && !idMatch && !notesMatch && !locMatch && !vendorMatch && !poMatch) {
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
        filterChannel,
        hideSold,
        hideTracked,
        hideCombined,
        filterPlacedLocated,
        filterInsight,
        filterBarcode,
        filterLotType,
        sortColumn,
        sortDirection,
        allLocations,
        allChannels,
        allUpcPrefixes,
        countActive,
        countMissingPhotos,
        countMissingPricing,
        countReadyToList,
        activeFilterChips,
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

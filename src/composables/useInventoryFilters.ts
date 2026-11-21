import { ref, computed, watch, onScopeDispose, type Ref } from 'vue';
import type { Models } from 'appwrite';
import { getAssetUrl, resolveItemImageUrls, normalizeInventoryStatus } from '../lib/inventory';
import { getWarehouseFacilityOptions, findFacility } from '../lib/warehouses';
import {
    SMART_QUEUES,
    matchesSmartQueue,
    matchesPartnerPrefix,
    matchesSpatialLocation,
    type SmartQueueId
} from '../lib/inventoryVibes';
import { useDataFilter, type SortDirection, type FilterChip } from './useDataFilter';
import { matchesMySkuFilter, normalizeUpcPrefix } from '../lib/curatorOwnership';
import { parseSearchQuery, scoreInventoryItemSearch, type ProseMatchOrigin } from '../lib/searchEngine';

export type InventorySortColumn = 'title' | 'cost' | 'resalePrice' | 'soldPrice' | 'soldDate' | 'margin' | 'upc' | 'vendor' | 'status' | 'location' | '$updatedAt' | '$createdAt' | 'relevance';
export type { SortDirection, FilterChip };

// -- 0. IMAGE RESOLUTION HELPER (Universal getAssetUrl standard) --
export const getItemImageUrl = (item: any, size: number = 100): string | null => {
    if (!item) return null;
    const urls = resolveItemImageUrls(item);
    if (urls.length > 0) return urls[0];

    // Fallback checks for auction tracker items / raw analysis
    if (item.fetched_image || (Array.isArray(item.fetched_images) && item.fetched_images.length > 0)) {
        const id = item.fetched_image || item.fetched_images[0];
        return getAssetUrl(id, { preview: true, width: size, height: size });
    }
    if (item.rawAnalysis) {
        try {
            const raw = typeof item.rawAnalysis === 'string' ? JSON.parse(item.rawAnalysis) : item.rawAnalysis;
            const target = Array.isArray(raw) ? raw[0] : (raw.items ? raw.items[0] : raw);
            const id = target?.fetched_image || target?.fetched_images?.[0] || target?.image;
            if (id) return getAssetUrl(id, { preview: true, width: size, height: size });
        } catch (e) {}
    }
    if (item.conditionNotes && typeof item.conditionNotes === 'string') {
        const match = item.conditionNotes.match(/\[MAIN IMAGE ID: ([^\]]+)\]/);
        if (match && match[1]) {
            const id = match[1].split(',')[0].trim();
            return getAssetUrl(id, { preview: true, width: size, height: size });
        }
    }
    return null;
};

/**
 * Domain definition of active physical on-hand stock:
 * Excludes sold, tracked (not yet acquired), scouted (in shopping cart), combined, and deconstructed items.
 */
export const isActiveInventory = (status: string = ''): boolean => {
    const st = (status || 'acquired').toLowerCase();
    return !['sold', 'tracked', 'scouted', 'combined', 'deconstructed'].includes(st);
};

export interface UseInventoryFiltersOptions {
    purchases?: Ref<any[]>;
    orgPlacedLocations?: Ref<string[]>;
    knownPrefixes?: Ref<string[]>;
    ownedPrefixes?: Ref<string[]>;
    currentUserId?: Ref<string>;
    defaultToMine?: Ref<boolean>;
    defaultPageSize?: number;
}

/**
 * Domain-specialized Inventory Filtering, Omnisearch, Lineage, and Health Engine.
 * Built on top of the generic `useDataFilter` composable.
 * Powers both Spreadsheet Table View and Visual Card Grid View.
 */
export function useInventoryFilters(
    sourceItems: Ref<Models.Document[]>,
    options: UseInventoryFiltersOptions = {}
) {
    // 1. Inventory-Specific Filter State
    const filterStatus = ref('active'); // 'active' is default on-hand physical stock
    const filterLocation = ref('all');
    const filterChannel = ref('all');
    const hideSold = ref(true);
    const hideTracked = ref(true); // Excludes unacquired tracker and cart items
    const hideCombined = ref(true); // Excludes merged/combined items
    const hideDeconstructed = ref(true); // Excludes split/deconstructed parent lots
    const filterPlacedLocated = ref(false); // Only placed items with a storage location
    const filterInsight = ref(''); // 'ready_to_list' | 'missing_photos' | 'missing_pricing' | 'missing_cost' | 'missing_sold_price' | 'missing_description'
    const getDefaultBarcodeScope = () => (options.defaultToMine?.value ? '__mine__' : 'all');
    const filterBarcode = ref<string>(getDefaultBarcodeScope()); // '__mine__' | 'all' | '__missing__' | '__numeric__' | '__has_barcode__' | string prefix
    let hasExplicitUrlBarcode = false;
    if (options.defaultToMine) {
        watch(options.defaultToMine, (shouldMine) => {
            if (!shouldMine && !hasExplicitUrlBarcode && filterBarcode.value === '__mine__') {
                filterBarcode.value = 'all';
            }
        });
    }
    const filterSmartQueue = ref<SmartQueueId | ''>(''); // '' | 'md_restock' | 'dt_restock' | 'booth_bins' | 'has_booth_sku' | 'missing_booth_sku'
    const filterLotType = ref('all'); // 'all' | 'lots_only' | 'extracted_only' | 'standalone_only'
    const filterKeywords = ref<string[]>([]);
    const filterPurchaseId = ref('');
    const filterParentLotId = ref('');
    const filterPO = ref('');
    const filterSO = ref('');
    const searchIncludeNotes = ref(false);

    // -- VENDOR RESOLUTION HELPER --
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

    // -- ROI / MARGIN CALCULATION --
    const calculateRoi = (item: any): number | null => {
        const qty = Math.max(1, Number(item.quantity) || 1);
        const rawCost = parseFloat(item.cost) || 0;
        const price = parseFloat(item.resalePrice || item.boutiquePrice) || 0;
        if (rawCost <= 0 || price <= 0) return null;
        
        // Detect if rawCost was saved as per-unit cost instead of total cost basis:
        let costPerUnit = rawCost / qty;
        if (qty > 1 && ((price - costPerUnit) / costPerUnit) * 100 > 2000 && ((price - rawCost) / rawCost) * 100 < 1500 && ((price - rawCost) / rawCost) * 100 > -50) {
            costPerUnit = rawCost;
        }

        const margin = ((price - costPerUnit) / costPerUnit) * 100;
        return Math.round(margin);
    };

    // -- LINEAGE & PO RESOLVERS --
    const matchingPurchaseIds = computed(() => {
        const set = new Set<string>();
        if (filterPurchaseId.value) {
            set.add(filterPurchaseId.value);
        }
        const q = (filterPO.value || '').trim().toLowerCase();
        if (q && options.purchases?.value) {
            options.purchases.value.forEach((p: any) => {
                const orderIdMatch = p.orderId && p.orderId.toLowerCase().includes(q);
                const poMatch = p.poNumber && p.poNumber.toLowerCase().includes(q);
                const idMatch = p.$id && p.$id.toLowerCase().includes(q);
                const vendorMatch = p.vendor && p.vendor.toLowerCase().includes(q);
                if (orderIdMatch || poMatch || idMatch || vendorMatch) {
                    set.add(p.$id);
                    if (p.orderId) set.add(p.orderId);
                }
            });
        }
        return set;
    });

    const matchingLotDocIds = computed(() => {
        const set = new Set<string>();
        if (!filterParentLotId.value || !sourceItems.value) return set;
        const target = filterParentLotId.value.trim().toLowerCase();
        set.add(target);

        sourceItems.value.forEach(i => {
            const idMatch = i.$id && i.$id.toLowerCase() === target;
            const upcMatch = i.upc && i.upc.toLowerCase() === target;
            if (idMatch || upcMatch) {
                if (i.$id) set.add(i.$id.toLowerCase());
                if (i.upc) set.add(i.upc.toLowerCase());
            }
        });
        return set;
    });

    const filterParentLotTitle = computed(() => {
        if (!filterParentLotId.value || !sourceItems.value) return '';
        const target = filterParentLotId.value.trim().toLowerCase();
        const parent = sourceItems.value.find(i => i.$id?.toLowerCase() === target || (i.upc && i.upc.toLowerCase() === target));
        return parent ? (parent.upc ? `${parent.upc} - ${parent.title}` : parent.title) : filterParentLotId.value;
    });

    const clearLineageFilters = () => {
        filterParentLotId.value = '';
        filterPO.value = '';
        filterSO.value = '';
        filterPurchaseId.value = '';
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.delete('parentLotId');
            url.searchParams.delete('lot');
            url.searchParams.delete('lotId');
            url.searchParams.delete('po');
            url.searchParams.delete('purchaseId');
            url.searchParams.delete('orderId');
            url.searchParams.delete('so');
            url.searchParams.delete('saleId');
            window.history.replaceState({}, '', url.toString());
        }
    };

    // -- EXTRACT AVAILABLE LOCATIONS & CHANNELS --
    const allLocations = computed(() => {
        return getWarehouseFacilityOptions(sourceItems.value, options.orgPlacedLocations?.value || []);
    });

    const allChannels = computed(() => {
        const channels = new Set<string>();
        channels.add('Memory Den');
        channels.add('Dusty Tiger');
        channels.add('eBay');
        channels.add('Poshmark');
        for (const it of sourceItems.value) {
            const sl = (it as any).sellingLocations;
            if (Array.isArray(sl)) {
                sl.forEach((l: string) => l && channels.add(String(l).trim()));
            } else if (typeof sl === 'string' && sl) {
                channels.add(String(sl).trim());
            }
        }
        if (filterChannel.value && filterChannel.value !== 'all') {
            channels.add(String(filterChannel.value).trim());
        }
        return Array.from(channels).filter(Boolean).sort((a, b) => a.localeCompare(b));
    });

    // -- EXTRACT KNOWN & AVAILABLE UPC PREFIXES --
    const knownOrgPrefixes = computed(() => {
        const prefixes = new Set(['HUCK-', 'PDXGL-']);
        if (options.knownPrefixes?.value) {
            options.knownPrefixes.value.forEach(p => {
                const cleaned = normalizeUpcPrefix(p);
                if (cleaned) prefixes.add(cleaned);
            });
        }
        if (options.ownedPrefixes?.value) {
            options.ownedPrefixes.value.forEach(p => {
                const cleaned = normalizeUpcPrefix(p);
                if (cleaned) prefixes.add(cleaned);
            });
        }
        return Array.from(prefixes);
    });

    const allUpcPrefixes = computed(() => {
        const map = new Map<string, number>();
        knownOrgPrefixes.value.forEach(p => map.set(p, 0));

        let missingCount = 0;
        let numericOnlyCount = 0;

        for (const it of sourceItems.value) {
            const anyItem = it as any;
            if (anyItem.status === 'scouted') continue;
            const code = (anyItem.upc || anyItem.locationSku || anyItem.sku || '').trim().toUpperCase();

            if (!code) {
                missingCount++;
                continue;
            }

            // Check known org prefixes
            let matchedKnown = false;
            for (const kp of knownOrgPrefixes.value) {
                if (code.startsWith(kp)) {
                    map.set(kp, (map.get(kp) || 0) + 1);
                    matchedKnown = true;
                    break;
                }
            }
            if (matchedKnown) continue;

            // 1. Hyphenated prefix: e.g. "RC-045", "SGW-999" -> "RC-", "SGW-"
            const hyphenMatch = code.match(/^([A-Za-z0-9]+-)/);
            if (hyphenMatch) {
                const prefix = hyphenMatch[1].toUpperCase();
                map.set(prefix, (map.get(prefix) || 0) + 1);
                continue;
            }

            // 2. Letters followed by numbers: e.g. "HUCK0123", "RC45"
            const alphaNumMatch = code.match(/^([A-Za-z]+)\d+/);
            if (alphaNumMatch) {
                const prefix = alphaNumMatch[1].toUpperCase();
                map.set(prefix, (map.get(prefix) || 0) + 1);
                continue;
            }

            // 3. Retail numeric barcode
            if (/^\d+$/.test(code)) {
                numericOnlyCount++;
                continue;
            }

            // 4. Custom code leading chars
            const customPrefix = code.length > 6 ? code.substring(0, 4).toUpperCase() : code.toUpperCase();
            map.set(customPrefix, (map.get(customPrefix) || 0) + 1);
        }

        const list = Array.from(map.entries()).map(([prefix, count]) => ({
            prefix,
            label: `${prefix} (${count})`,
            count
        })).sort((a, b) => {
            const aKnown = knownOrgPrefixes.value.includes(a.prefix);
            const bKnown = knownOrgPrefixes.value.includes(b.prefix);
            if (aKnown && !bKnown) return -1;
            if (!aKnown && bKnown) return 1;
            return b.count - a.count;
        });

        if (numericOnlyCount > 0) {
            list.push({
                prefix: '__numeric__',
                label: `Retail / Numeric Barcodes (${numericOnlyCount})`,
                count: numericOnlyCount
            });
        }

        if (missingCount > 0) {
            list.push({
                prefix: '__missing__',
                label: `No Barcode / Missing (${missingCount})`,
                count: missingCount
            });
        }

        return list;
    });

    // -- BARCODE / OWNER SCOPE HELPER --
    const matchesBarcodeScope = (anyItem: any, bc: string): boolean => {
        if (!bc || bc === 'all') return true;
        const code = (anyItem?.upc || anyItem?.locationSku || anyItem?.sku || '').trim().toUpperCase();
        if (bc === '__mine__') {
            const hasOwnerIdentity = Boolean(
                options.currentUserId?.value ||
                (options.ownedPrefixes?.value && options.ownedPrefixes.value.length > 0)
            );
            if (!hasOwnerIdentity) return true;
            return matchesMySkuFilter(
                anyItem,
                options.ownedPrefixes?.value || [],
                options.currentUserId?.value || ''
            );
        }
        if (bc === '__missing__') return code === '';
        if (bc === '__numeric__') return Boolean(code && /^\d+$/.test(code));
        if (bc === '__has_barcode__') return Boolean(code);
        return matchesPartnerPrefix(anyItem, bc);
    };

    const ownerScopedItems = computed(() => {
        const bc = filterBarcode.value;
        if (!bc || bc === 'all') return sourceItems.value;
        return sourceItems.value.filter(i => matchesBarcodeScope(i, bc));
    });

    // -- STATUS & HEALTH COUNTERS (Aligned with Owner Scope & Active Stock) --
    const countActive = computed(() => {
        return ownerScopedItems.value.filter(i => isActiveInventory((i as any).status)).length;
    });

    const countByStatus = (status: string) => {
        const target = normalizeInventoryStatus(status);
        if (target === 'received' && status.toLowerCase() === 'active') return countActive.value;
        if (status.toLowerCase() === 'active') return countActive.value;
        return ownerScopedItems.value.filter(i => {
            const s = normalizeInventoryStatus((i as any).status);
            return s === target;
        }).length;
    };

    const countAll = computed(() => ownerScopedItems.value.length);

    const countMissingCost = computed(() => {
        return ownerScopedItems.value.filter(i => {
            const itm = i as any;
            if (!isActiveInventory(itm.status)) return false;
            const costVal = parseVal(itm, 'cost', 'Paid') || parseVal(itm, 'purchasePrice', 'Paid');
            return costVal <= 0;
        }).length;
    });

    const countMissingPhotos = computed(() => {
        return ownerScopedItems.value.filter(i => {
            const anyItem = i as any;
            if (!isActiveInventory(anyItem.status)) return false;
            if (anyItem.imageId || (anyItem.galleryImageIds && anyItem.galleryImageIds.length > 0)) return false;
            if (anyItem.conditionNotes && (anyItem.conditionNotes.includes('[MAIN IMAGE ID:') || anyItem.conditionNotes.includes('[IMAGE_ID:'))) return false;
            return true;
        }).length;
    });

    const countMissingPricing = computed(() => {
        return ownerScopedItems.value.filter(i => {
            const itm = i as any;
            if (!isActiveInventory(itm.status)) return false;
            const price = parseVal(itm, 'resalePrice', 'Resale') || parseVal(itm, 'estValue', 'Est. Low') || parseVal(itm, 'listPrice', 'Est');
            return price <= 0;
        }).length;
    });

    const countReadyToList = computed(() => {
        return ownerScopedItems.value.filter(i => {
            const itm = i as any;
            if (!['acquired', 'received'].includes(itm.status)) return false;
            if (!itm.title || itm.title.trim() === '') return false;
            const price = parseVal(itm, 'resalePrice', 'Resale') || parseVal(itm, 'estValue', 'Est. Low');
            if (price <= 0) return false;
            return Boolean(getItemImageUrl(itm));
        }).length;
    });

    const cartItems = computed(() => sourceItems.value.filter(i => (i as any).status === 'scouted'));

    const cartGroups = computed(() => {
        return cartItems.value.reduce((groups: Record<string, any[]>, item: any) => {
            const loc = item.sourcingLocation || 'Unknown Location';
            if (!groups[loc]) groups[loc] = [];
            groups[loc].push(item);
            return groups;
        }, {});
    });

    const baseInventoryCount = computed(() => {
        return sourceItems.value.filter(i => {
            const s = (i as any).status;
            return s !== 'scouted' && s !== 'tracked' && s !== 'combined';
        }).length;
    });

    // -- 2. TOKENIZED DEEP SEARCH & RELEVANCE SCORER --
    // Note: useDataFilter allocates searchQuery lazily below; parsedSearch reads searchQuery reactively inside computeds & predicates.
    const evalItemSearch = (item: any, includeNotesOverride?: boolean) => {
        const parsed = parseSearchQuery(searchQuery.value);
        return scoreInventoryItemSearch(item, parsed, {
            includeNotes: includeNotesOverride ?? searchIncludeNotes.value,
            vendorName: getVendorName(item),
            matchesPurchaseLookup: Boolean(
                (item.cartId && matchingPurchaseIds.value.has(item.cartId)) ||
                (item.purchaseId && matchingPurchaseIds.value.has(item.purchaseId))
            ),
        });
    };

    const inventorySearchPredicate = (item: any, _q: string, _rawQuery: string, _digits: string): boolean => {
        return evalItemSearch(item).matched;
    };

    const inventorySearchScorer = (item: any, _q: string, _rawQuery: string): number => {
        return evalItemSearch(item).score;
    };

    // -- 3. SORT ACCESSORS --
    const inventorySortAccessors = {
        title: (item: any) => item.title || '',
        cost: (item: any) => parseFloat(item.cost) || 0,
        resalePrice: (item: any) => parseFloat(item.resalePrice || item.boutiquePrice) || 0,
        soldPrice: (item: any) => parseFloat(item.soldPrice || 0) || 0,
        soldDate: (item: any) => {
            const raw = item.soldDate || item.dateSold || item.saleDate;
            if (raw) return new Date(raw).getTime();
            if (item.status === 'sold') return new Date(item.$updatedAt || 0).getTime();
            return 0;
        },
        margin: (item: any) => calculateRoi(item) ?? -999,
        vendor: (item: any) => getVendorName(item),
        status: (item: any) => item.status || 'acquired',
        location: (item: any) => item.storageLocation || '',
        upc: (item: any) => item.upc || '',
        $updatedAt: (item: any) => new Date(item.$updatedAt || item.updatedAt || item.$createdAt || 0).getTime(),
        $createdAt: (item: any) => new Date(item.$createdAt || 0).getTime()
    };

    // -- 4. INSTANTIATE GENERIC CORE ENGINE --
    const {
        searchQuery,
        sortColumn,
        sortDirection,
        hasUserSelectedSort,
        currentPage,
        pageSize,
        pageSizeOptions,
        filteredItems,
        pagedItems,
        totalPages,
        setSort,
        getSortIcon
    } = useDataFilter<any>(sourceItems, {
        searchPredicate: inventorySearchPredicate,
        searchScoreAccessor: inventorySearchScorer,
        sortAccessors: inventorySortAccessors,
        defaultSortKey: '$createdAt',
        defaultSortDirection: 'desc',
        defaultPageSize: options.defaultPageSize || 50
    });

    const parsedSearch = computed(() => parseSearchQuery(searchQuery.value));
    const hasActiveSearch = computed(() => Boolean(searchQuery.value.trim()));
    const isRelevanceSort = computed(() =>
        Boolean(
            hasActiveSearch.value &&
            (sortColumn.value === 'relevance' ||
                (!hasUserSelectedSort.value && sortColumn.value === '$createdAt' && sortDirection.value === 'desc'))
        )
    );

    const applySortSelection = (column: string, direction: SortDirection = 'desc') => {
        if (!column || column === 'relevance') {
            sortColumn.value = '$createdAt';
            sortDirection.value = 'desc';
            hasUserSelectedSort.value = false;
            return;
        }
        sortColumn.value = column;
        sortDirection.value = direction;
        hasUserSelectedSort.value = true;
    };

    let isSyncingExclusions = false;

    const applyExclusionDefaultsForStatus = (statusStr: string) => {
        const st = (statusStr || 'active').toLowerCase();
        if (st === 'all') {
            hideSold.value = false;
            hideTracked.value = false;
            hideCombined.value = false;
            hideDeconstructed.value = false;
        } else if (st === 'active') {
            hideSold.value = filterInsight.value === 'missing_sold_price' ? false : true;
            hideTracked.value = true;
            hideCombined.value = true;
            hideDeconstructed.value = true;
        } else {
            hideSold.value = (st === 'sold' || filterInsight.value === 'missing_sold_price') ? false : true;
            hideTracked.value = st === 'tracked' ? false : true;
            hideCombined.value = st === 'combined' ? false : true;
            hideDeconstructed.value = st === 'deconstructed' ? false : true;
        }
    };

    // Auto-sort by soldDate DESC when viewing sold inventory & keep status <-> exclusion toggles synchronized
    watch(filterStatus, (newStatus, oldStatus) => {
        if (newStatus === 'sold') {
            sortColumn.value = 'soldDate';
            sortDirection.value = 'desc';
        } else if (oldStatus === 'sold' && sortColumn.value === 'soldDate') {
            sortColumn.value = '$createdAt';
            sortDirection.value = 'desc';
        }
        if (isSyncingExclusions) return;
        isSyncingExclusions = true;
        try {
            applyExclusionDefaultsForStatus(newStatus);
        } finally {
            isSyncingExclusions = false;
        }
    });

    watch([hideSold, hideTracked, hideCombined, hideDeconstructed], () => {
        if (isSyncingExclusions) return;
        isSyncingExclusions = true;
        try {
            if (filterStatus.value === 'all' && hideSold.value && hideTracked.value && hideCombined.value && hideDeconstructed.value) {
                filterStatus.value = 'active';
            } else if (filterStatus.value === 'active' && !hideSold.value && !hideTracked.value && !hideCombined.value && !hideDeconstructed.value) {
                filterStatus.value = 'all';
            }
        } finally {
            isSyncingExclusions = false;
        }
    });

    // Custom filtering pipeline for inventory domain rules (shared between table/grid & Spatial Bar)
    const matchesInventoryDomainFilters = (
        item: any,
        opts: boolean | { skipLocation?: boolean; skipBarcode?: boolean } = false
    ): boolean => {
        const skipLocation = typeof opts === 'boolean' ? opts : Boolean(opts?.skipLocation);
        const skipBarcode = typeof opts === 'object' ? Boolean(opts?.skipBarcode) : false;
        const q = searchQuery.value.trim();
        const st = filterStatus.value.toLowerCase();
        const loc = filterLocation.value;
        const ch = filterChannel.value;
        const insight = filterInsight.value;
        const bc = filterBarcode.value;
        const queue = filterSmartQueue.value;
        const lot = filterLotType.value;
        const placedOnly = filterPlacedLocated.value;
        const doHideSold = hideSold.value;
        const doHideTracked = hideTracked.value;
        const doHideCombined = hideCombined.value;
        const doHideDeconstructed = hideDeconstructed.value;

        const anyItem = item as any;
        const itemStatus = (anyItem.status || 'acquired').toLowerCase();

        // 0. Core Exclusion: Deconstructed / Split lots
        if (doHideDeconstructed && itemStatus === 'deconstructed' && st !== 'deconstructed') {
            return false;
        }

        // 1. Core Exclusion: Combined / Merged items
        if (doHideCombined && itemStatus === 'combined' && st !== 'combined') {
            return false;
        }

        // 2. Core Exclusion: Trackers & Scouted (unacquired items)
        if (doHideTracked && (itemStatus === 'tracked' || itemStatus === 'scouted') && st !== 'tracked') {
            return false;
        }

        // 3. Core Exclusion: Sold items (bypassed when inspecting sold items via insight or SO filter)
        if (doHideSold && itemStatus === 'sold' && st !== 'sold' && insight !== 'missing_sold_price' && !filterSO.value) {
            return false;
        }

        // 4. Status Filter (Only when no insight filter forcing status)
        if (!insight && !filterParentLotId.value) {
            if (st === 'active') {
                // Active Stock mode: governed directly by the exclusion flags above.
            } else if (st === 'tracked') {
                if (normalizeInventoryStatus(itemStatus) !== 'tracked') return false;
            } else if (st !== 'all') {
                if (normalizeInventoryStatus(itemStatus) !== normalizeInventoryStatus(st)) return false;
            }
        }

        // 5. Purchase ID filter (Direct PO links)
        if (filterPurchaseId.value && !q) {
            const matchesPurchase = anyItem.purchaseId === filterPurchaseId.value ||
                                    anyItem.cartId === filterPurchaseId.value ||
                                    matchingPurchaseIds.value.has(anyItem.purchaseId) ||
                                    matchingPurchaseIds.value.has(anyItem.cartId);
            if (!matchesPurchase) return false;
        }

        // 6. Parent Lot ID Lineage
        if (filterParentLotId.value) {
            const matchesLot = (anyItem.$id && matchingLotDocIds.value.has(anyItem.$id.toLowerCase())) ||
                               (anyItem.parentLotId && matchingLotDocIds.value.has(anyItem.parentLotId.toLowerCase())) ||
                               (anyItem.upc && matchingLotDocIds.value.has(anyItem.upc.toLowerCase()));
            if (!matchesLot) return false;
        }

        // 7. PO / Sourcing Order filter
        if (filterPO.value) {
            const target = filterPO.value.trim().toLowerCase();
            const matchesPo = (anyItem.purchaseId && (anyItem.purchaseId.toLowerCase().includes(target) || matchingPurchaseIds.value.has(anyItem.purchaseId))) ||
                              (anyItem.orderId && (anyItem.orderId.toLowerCase().includes(target) || matchingPurchaseIds.value.has(anyItem.orderId))) ||
                              (anyItem.cartId && (anyItem.cartId.toLowerCase().includes(target) || matchingPurchaseIds.value.has(anyItem.cartId))) ||
                              (anyItem.sourcingLocation && anyItem.sourcingLocation.toLowerCase().includes(target)) ||
                              (anyItem.conditionNotes && anyItem.conditionNotes.toLowerCase().includes(target)) ||
                              (anyItem.upc && anyItem.upc.toLowerCase().startsWith(target));
            if (!matchesPo) return false;
        }

        // 8. SO / Sales Order filter
        if (filterSO.value) {
            const target = filterSO.value.trim().toLowerCase();
            const matchesSo = (anyItem.saleId && anyItem.saleId.toLowerCase() === target) ||
                              (anyItem.locationSku && anyItem.locationSku.toLowerCase() === target);
            if (!matchesSo) return false;
        }

        // 9. Placed & Located filter
        if (placedOnly) {
            const hasLocation = !!anyItem.storageLocation || (anyItem.sellingLocations && anyItem.sellingLocations.length > 0);
            const isPlaced = itemStatus === 'placed';
            if (!hasLocation || !isPlaced) return false;
        }

        // 10. Location / Booth filter (supports __unassigned__, HD, HH, HG, MD, DT, and custom bins)
        if (!skipLocation && loc && loc !== 'all' && loc.trim() !== '') {
            if (!matchesSpatialLocation(anyItem, loc)) return false;
        }

        // 11. Sales Channel filter
        if (ch && ch !== 'all') {
            const rawTarget = ch.trim().toLowerCase();
            const cleanTarget = rawTarget.replace(/[^a-z0-9]/g, '');
            const matchesLoc = (val: any): boolean => {
                if (!val) return false;
                if (Array.isArray(val)) return val.some(v => matchesLoc(v));
                const str = String(val).trim().toLowerCase();
                const cleanStr = str.replace(/[^a-z0-9]/g, '');
                return str === rawTarget || cleanStr === cleanTarget || (cleanTarget.length > 2 && (cleanStr.includes(cleanTarget) || cleanTarget.includes(cleanStr)));
            };
            if (!matchesLoc(anyItem.sellingLocations)) return false;
        }

        // 12. Barcode / Partner Prefix / 0EJ filter
        if (!skipBarcode && bc && bc !== 'all') {
            if (!matchesBarcodeScope(anyItem, bc)) return false;
        }

        // 12b. Operational Smart Queue filter
        if (queue) {
            if (!matchesSmartQueue(anyItem, queue)) return false;
        }

        // 13. Lot Type filter
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

        // 14. Tag / Keyword Filters
        if (filterKeywords.value.length > 0) {
            if (!anyItem.keywords || anyItem.keywords.length === 0) return false;
            const itemKeywordsLower = anyItem.keywords.map((k: string) => k.toLowerCase());
            const hasAllKeywords = filterKeywords.value.every(kw => itemKeywordsLower.includes(kw.toLowerCase()));
            if (!hasAllKeywords) return false;
        }

        // 15. AI Health Insights
        if (insight) {
            if (insight === 'missing_sold_price') {
                const hasSoldOrTagPrice =
                    parseVal(anyItem, 'soldPrice', 'Sold') ||
                    parseVal(anyItem, 'resalePrice', 'Resale') ||
                    parseVal(anyItem, 'listPrice', 'Est') ||
                    parseVal(anyItem, 'price', 'Sold');
                if (itemStatus !== 'sold' || hasSoldOrTagPrice) return false;
            } else if (insight === 'missing_est_value' || insight === 'missing_pricing') {
                if (itemStatus === 'sold' || (parseVal(anyItem, 'resalePrice', 'Resale') || parseVal(anyItem, 'estValue', 'Est. Low') || parseVal(anyItem, 'listPrice', 'Est'))) return false;
            } else if (insight === 'missing_cost') {
                if (itemStatus === 'sold' || (parseVal(anyItem, 'cost', 'Paid') || parseVal(anyItem, 'purchasePrice', 'Paid'))) return false;
            } else if (insight === 'missing_description') {
                if (anyItem.marketDescription && anyItem.marketDescription.length >= 10) return false;
            } else if (insight === 'missing_photos') {
                if (anyItem.imageId || (anyItem.galleryImageIds && anyItem.galleryImageIds.length > 0)) return false;
                if (anyItem.conditionNotes && (anyItem.conditionNotes.includes('[MAIN IMAGE ID:') || anyItem.conditionNotes.includes('[IMAGE_ID:'))) return false;
            } else if (insight === 'ready_to_list') {
                if (!['acquired', 'received'].includes(itemStatus)) return false;
                if (!anyItem.title || anyItem.title.trim() === '') return false;
                if (!parseVal(anyItem, 'resalePrice', 'Resale') && !parseVal(anyItem, 'estValue', 'Est. Low')) return false;
                const hasPhoto = anyItem.imageId || (anyItem.galleryImageIds && anyItem.galleryImageIds.length > 0) || (anyItem.conditionNotes && (anyItem.conditionNotes.includes('[MAIN IMAGE ID:') || anyItem.conditionNotes.includes('[IMAGE_ID:')));
                if (!hasPhoto) return false;
            } else if (insight === 'needs_shop_update') {
                const hasFlag = Array.isArray(anyItem.redFlags) && anyItem.redFlags.includes('needs_shop_update');
                const hasNote = typeof anyItem.conditionNotes === 'string' && anyItem.conditionNotes.includes('[NEEDS_SHOP_UPDATE]');
                if (!hasFlag && !hasNote) return false;
            }
        }

        return true;
    };

    const inventoryFilteredItems = computed(() => {
        return filteredItems.value.filter(item => matchesInventoryDomainFilters(item, false));
    });

    const spatialScopedItems = computed(() => {
        return filteredItems.value.filter(item => matchesInventoryDomainFilters(item, { skipLocation: true }));
    });

    const ownerSwitchScopedItems = computed(() => {
        return filteredItems.value.filter(item => matchesInventoryDomainFilters(item, { skipBarcode: true }));
    });

    const proseOnlyMatchCount = computed<number>(() => {
        const ps = parsedSearch.value;
        if (ps.isEmpty || searchIncludeNotes.value || ps.isMultiSkuList || ps.prefix) {
            return 0;
        }
        let count = 0;
        for (const item of sourceItems.value) {
            if (!matchesInventoryDomainFilters(item, false)) continue;
            if (!evalItemSearch(item, false).matched && evalItemSearch(item, true).matched) {
                count++;
            }
        }
        return count;
    });

    const getSearchMatchOrigin = (item: any): ProseMatchOrigin | null => {
        const ps = parsedSearch.value;
        if (ps.isEmpty) return null;
        if (!searchIncludeNotes.value && ps.prefix !== 'notes' && ps.prefix !== 'desc') {
            return null;
        }
        return evalItemSearch(item).proseOrigin;
    };

    // Paged slice for grid and table
    const inventoryPagedItems = computed(() => {
        const start = (currentPage.value - 1) * pageSize.value;
        return inventoryFilteredItems.value.slice(start, start + pageSize.value);
    });

    const inventoryTotalPages = computed(() => {
        return Math.max(1, Math.ceil(inventoryFilteredItems.value.length / pageSize.value) || 1);
    });

    // Reset pagination to page 1 on filter changes
    watch([
        filterStatus,
        filterLocation,
        filterChannel,
        hideSold,
        hideTracked,
        hideCombined,
        filterPlacedLocated,
        filterInsight,
        filterBarcode,
        filterSmartQueue,
        filterLotType,
        filterKeywords,
        filterPurchaseId,
        filterParentLotId,
        filterPO,
        filterSO,
        searchIncludeNotes
    ], () => {
        currentPage.value = 1;
    }, { deep: true });

    // -- 5. ACTIVE FILTER CHIPS --
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
        if (filterLocation.value !== 'all' && filterLocation.value !== '') {
            let display = filterLocation.value;
            if (filterLocation.value === '__unassigned__') {
                display = '🚨 Unassigned';
            } else if (filterLocation.value === '__storage__') {
                display = '📦 Storage';
            } else if (filterLocation.value === '__selling__') {
                display = '🏪 Selling';
            } else if (filterLocation.value === '__online__') {
                display = '🌐 Online';
            } else if (filterLocation.value === '__events__') {
                display = '🎪 Events / Pop-Ups';
            } else if (filterLocation.value.toUpperCase() === 'HD') {
                display = '🛋️ HD';
            } else {
                const fac = findFacility(filterLocation.value);
                if (fac) display = fac.displayName;
            }
            chips.push({
                id: 'location',
                label: `Location: ${display}`,
                onRemove: () => { filterLocation.value = 'all'; }
            });
        }

        // Smart Queue chip
        if (filterSmartQueue.value) {
            const meta = SMART_QUEUES.find(q => q.id === filterSmartQueue.value);
            chips.push({
                id: 'smartQueue',
                label: `Queue: ${meta ? meta.shortLabel : filterSmartQueue.value}`,
                onRemove: () => { filterSmartQueue.value = ''; }
            });
        }

        // Channel chip
        if (filterChannel.value !== 'all' && filterChannel.value !== '') {
            chips.push({
                id: 'channel',
                label: `Channel: ${filterChannel.value}`,
                onRemove: () => { filterChannel.value = 'all'; }
            });
        }

        // Barcode chip (omit when on default Mine scope so toolbar stays calm)
        if (filterBarcode.value === '__mine__') {
            if (!options.defaultToMine?.value) {
                chips.push({
                    id: 'barcode',
                    label: 'My SKU',
                    onRemove: () => { filterBarcode.value = 'all'; }
                });
            }
        } else if (filterBarcode.value === '__missing__') {
            chips.push({
                id: 'barcode-missing',
                label: 'No Barcode',
                onRemove: () => { filterBarcode.value = 'all'; }
            });
        } else if (filterBarcode.value === '__numeric__') {
            chips.push({
                id: 'barcode-numeric',
                label: 'Numeric Barcodes',
                onRemove: () => { filterBarcode.value = 'all'; }
            });
        } else if (filterBarcode.value === '__has_barcode__') {
            chips.push({
                id: 'barcode-has',
                label: 'Has Barcode',
                onRemove: () => { filterBarcode.value = 'all'; }
            });
        } else if (filterBarcode.value !== 'all' && filterBarcode.value !== '') {
            chips.push({
                id: 'barcode-prefix',
                label: `Partner/SKU: ${filterBarcode.value}`,
                onRemove: () => { filterBarcode.value = 'all'; }
            });
        }

        // Insight chip
        if (filterInsight.value) {
            const map: Record<string, string> = {
                missing_photos: 'Missing Photos',
                missing_pricing: 'Missing Pricing',
                missing_est_value: 'Missing Pricing',
                missing_cost: 'Missing Cost Basis',
                missing_sold_price: 'Missing Sold Price',
                missing_description: 'Missing Description',
                ready_to_list: 'Ready to List',
                needs_shop_update: 'Needs Shop Update'
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

        // Lineage chips
        if (filterParentLotId.value) {
            chips.push({
                id: 'parentLot',
                label: `Lot: ${filterParentLotTitle.value || filterParentLotId.value}`,
                onRemove: () => { filterParentLotId.value = ''; }
            });
        }

        if (filterPO.value) {
            chips.push({
                id: 'po',
                label: `PO: ${filterPO.value}`,
                onRemove: () => { filterPO.value = ''; filterPurchaseId.value = ''; }
            });
        }

        if (filterSO.value) {
            chips.push({
                id: 'so',
                label: `SO: ${filterSO.value}`,
                onRemove: () => { filterSO.value = ''; }
            });
        }

        // Keywords
        if (filterKeywords.value.length > 0) {
            filterKeywords.value.forEach(kw => {
                chips.push({
                    id: `kw-${kw}`,
                    label: `Tag: ${kw}`,
                    onRemove: () => {
                        filterKeywords.value = filterKeywords.value.filter(k => k !== kw);
                    }
                });
            });
        }

        // Hide Flags chips (deviations from active defaults)
        if (!hideSold.value && filterStatus.value !== 'sold') {
            chips.push({
                id: 'showSold',
                label: 'Including Sold',
                onRemove: () => { hideSold.value = true; }
            });
        }

        if (!hideTracked.value && filterStatus.value !== 'tracked') {
            chips.push({
                id: 'showTracked',
                label: 'Including Trackers',
                onRemove: () => { hideTracked.value = true; }
            });
        }

        if (!hideCombined.value && filterStatus.value !== 'combined') {
            chips.push({
                id: 'showCombined',
                label: 'Including Merged',
                onRemove: () => { hideCombined.value = true; }
            });
        }

        if (!hideDeconstructed.value && filterStatus.value !== 'deconstructed') {
            chips.push({
                id: 'showDeconstructed',
                label: 'Including Deconstructed',
                onRemove: () => { hideDeconstructed.value = true; }
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

        if (searchIncludeNotes.value) {
            chips.push({
                id: 'includeNotes',
                label: 'Incl. Descriptions & Notes',
                onRemove: () => { searchIncludeNotes.value = false; }
            });
        }

        return chips;
    });

    const activeFilterCount = computed(() => {
        let c = 0;
        if (filterStatus.value !== 'active' && filterStatus.value !== 'all') c++;
        if (!hideSold.value && filterStatus.value !== 'sold') c++;
        if (!hideTracked.value && filterStatus.value !== 'tracked') c++;
        if (!hideCombined.value && filterStatus.value !== 'combined') c++;
        if (!hideDeconstructed.value && filterStatus.value !== 'deconstructed') c++;
        const defaultBc = getDefaultBarcodeScope();
        if (filterBarcode.value && filterBarcode.value !== 'all' && filterBarcode.value !== defaultBc) c++;
        if (filterSmartQueue.value) c++;
        if (filterLocation.value && filterLocation.value !== 'all') c++;
        if (filterChannel.value && filterChannel.value !== 'all') c++;
        if (filterLotType.value !== 'all') c++;
        if (filterPlacedLocated.value) c++;
        if (filterKeywords.value.length > 0) c += filterKeywords.value.length;
        if (filterInsight.value) c++;
        if (filterParentLotId.value) c++;
        if (filterPO.value) c++;
        if (filterSO.value) c++;
        if (searchQuery.value.trim()) c++;
        if (searchIncludeNotes.value) c++;
        return c;
    });

    const clearFilters = () => {
        searchQuery.value = '';
        searchIncludeNotes.value = false;
        hasUserSelectedSort.value = false;
        sortColumn.value = '$createdAt';
        sortDirection.value = 'desc';
        isSyncingExclusions = true;
        try {
            filterStatus.value = 'active';
            hideSold.value = true;
            hideTracked.value = true;
            hideCombined.value = true;
            hideDeconstructed.value = true;
        } finally {
            isSyncingExclusions = false;
        }
        filterLocation.value = 'all';
        filterChannel.value = 'all';
        filterInsight.value = '';
        filterBarcode.value = getDefaultBarcodeScope();
        filterSmartQueue.value = '';
        filterLotType.value = 'all';
        filterPlacedLocated.value = false;
        filterKeywords.value = [];
        filterPurchaseId.value = '';
        clearLineageFilters();
    };

    // -- 6. URL PARAMETER HYDRATION & DEBOUNCED STATE SYNC --
    let hasHydratedUrl = false;
    let urlSyncTimer: ReturnType<typeof setTimeout> | null = null;

    const writeUrlState = () => {
        if (typeof window === 'undefined' || !hasHydratedUrl) return;
        try {
            const url = new URL(window.location.href);
            const sp = url.searchParams;

            const qTrim = searchQuery.value.trim();
            sp.delete('search');
            if (qTrim) sp.set('q', qTrim);
            else sp.delete('q');

            if (searchIncludeNotes.value) sp.set('includeNotes', '1');
            else sp.delete('includeNotes');

            if (filterStatus.value && filterStatus.value !== 'active') sp.set('status', filterStatus.value);
            else sp.delete('status');

            sp.delete('loc');
            if (filterLocation.value && filterLocation.value !== 'all') sp.set('location', filterLocation.value);
            else sp.delete('location');

            if (filterChannel.value && filterChannel.value !== 'all') sp.set('channel', filterChannel.value);
            else sp.delete('channel');

            sp.delete('smartQueue');
            if (filterSmartQueue.value) sp.set('queue', filterSmartQueue.value);
            else sp.delete('queue');

            if (filterInsight.value) sp.set('insightFilter', filterInsight.value);
            else sp.delete('insightFilter');

            if (filterLotType.value && filterLotType.value !== 'all') sp.set('lotType', filterLotType.value);
            else sp.delete('lotType');

            if (hasUserSelectedSort.value && sortColumn.value && sortColumn.value !== 'relevance') {
                sp.set('sort', `${sortColumn.value}:${sortDirection.value}`);
            } else {
                sp.delete('sort');
            }

            const defaultBc = getDefaultBarcodeScope();
            const bc = filterBarcode.value || 'all';
            const hasDeepQueryParam = Boolean(
                sp.get('q') ||
                sp.get('queue') ||
                sp.get('po') ||
                sp.get('purchaseId') ||
                sp.get('orderId') ||
                sp.get('parentLotId') ||
                sp.get('lot') ||
                sp.get('lotId') ||
                sp.get('so') ||
                sp.get('saleId') ||
                sp.get('upc') ||
                sp.get('edit') ||
                sp.get('id') ||
                sp.get('item') ||
                sp.get('sku')
            );
            sp.delete('upcPrefix');
            sp.delete('scope');
            sp.delete('barcode');
            if (bc === 'all' && defaultBc === '__mine__') {
                sp.set('scope', 'all');
            } else if (bc !== defaultBc) {
                sp.set('barcode', bc);
            } else if (bc === '__mine__' && hasDeepQueryParam) {
                sp.set('barcode', '__mine__');
            }

            const nextUrl = url.toString();
            if (nextUrl !== window.location.href) {
                window.history.replaceState({}, '', nextUrl);
            }
        } catch {
            // Ignore URL history write errors
        }
    };

    const flushUrlSync = () => {
        if (urlSyncTimer) {
            clearTimeout(urlSyncTimer);
            urlSyncTimer = null;
        }
        writeUrlState();
    };

    watch(searchQuery, () => {
        if (typeof window === 'undefined' || !hasHydratedUrl) return;
        if (urlSyncTimer) clearTimeout(urlSyncTimer);
        urlSyncTimer = setTimeout(() => {
            urlSyncTimer = null;
            writeUrlState();
        }, 250);
    });

    watch(
        [
            searchIncludeNotes,
            filterStatus,
            filterLocation,
            filterChannel,
            filterBarcode,
            filterSmartQueue,
            filterInsight,
            filterLotType,
            sortColumn,
            sortDirection,
            hasUserSelectedSort,
        ],
        () => {
            if (!hasHydratedUrl) return;
            flushUrlSync();
        }
    );

    onScopeDispose(() => {
        flushUrlSync();
    });

    const initFromUrl = (params?: URLSearchParams) => {
        if (!params && typeof window === 'undefined') return;
        const p = params || new URLSearchParams(window.location.search);

        if (p.has('insightFilter')) {
            filterInsight.value = p.get('insightFilter') || '';
            if (filterInsight.value === 'missing_sold_price') {
                hideSold.value = false;
            }
        }
        if (p.has('queue') || p.has('smartQueue')) {
            filterSmartQueue.value = (p.get('queue') || p.get('smartQueue') || '') as SmartQueueId | '';
        }
        if (p.has('search') || p.has('q')) {
            searchQuery.value = p.get('search') || p.get('q') || '';
        }
        if (p.get('includeNotes') === '1' || p.get('includeNotes') === 'true') {
            searchIncludeNotes.value = true;
        }
        if (p.has('purchaseId')) {
            filterPurchaseId.value = p.get('purchaseId') || '';
            filterPO.value = p.get('purchaseId') || '';
        }
        if (p.has('orderId')) {
            if (!filterPurchaseId.value) filterPurchaseId.value = p.get('orderId') || '';
            filterPO.value = p.get('orderId') || '';
        } else if (p.has('po')) {
            if (!filterPurchaseId.value) filterPurchaseId.value = p.get('po') || '';
            filterPO.value = p.get('po') || '';
        }
        if (p.has('parentLotId')) {
            filterParentLotId.value = p.get('parentLotId') || '';
        } else if (p.has('lot')) {
            filterParentLotId.value = p.get('lot') || '';
        } else if (p.has('lotId')) {
            filterParentLotId.value = p.get('lotId') || '';
        }
        if (p.has('so')) {
            filterSO.value = p.get('so') || '';
        } else if (p.has('saleId')) {
            filterSO.value = p.get('saleId') || '';
        }
        if (p.has('upcPrefix') || p.has('barcode')) {
            hasExplicitUrlBarcode = true;
            filterBarcode.value = p.get('upcPrefix') || p.get('barcode') || 'all';
        } else if (
            p.get('scope') === 'all' ||
            p.has('search') ||
            p.has('q') ||
            p.has('upc') ||
            p.has('edit') ||
            p.has('id') ||
            p.has('item') ||
            p.has('sku') ||
            p.has('purchaseId') ||
            p.has('orderId') ||
            p.has('po') ||
            p.has('parentLotId') ||
            p.has('lot') ||
            p.has('lotId') ||
            p.has('so') ||
            p.has('saleId') ||
            p.has('queue') ||
            p.has('smartQueue')
        ) {
            hasExplicitUrlBarcode = true;
            filterBarcode.value = 'all';
        }
        if (p.has('status')) {
            isSyncingExclusions = true;
            try {
                filterStatus.value = p.get('status') || 'active';
                applyExclusionDefaultsForStatus(filterStatus.value);
            } finally {
                isSyncingExclusions = false;
            }
        }
        if (p.has('location') || p.has('loc')) {
            filterLocation.value = p.get('location') || p.get('loc') || 'all';
        }
        if (p.has('channel')) {
            filterChannel.value = p.get('channel') || 'all';
        }
        if (p.has('lotType')) {
            filterLotType.value = p.get('lotType') || 'all';
        }
        if (p.has('sort')) {
            const rawSort = p.get('sort') || '';
            if (rawSort.includes(':')) {
                const [col, dir] = rawSort.split(':');
                if (col && (dir === 'asc' || dir === 'desc')) {
                    applySortSelection(col, dir);
                }
            }
        }
        hasHydratedUrl = true;
    };

    return {
        // Core State & Aliases
        searchQuery,
        searchIncludeNotes,
        proseOnlyMatchCount,
        getSearchMatchOrigin,
        hasActiveSearch,
        isRelevanceSort,
        filterStatus,
        filterLocation,
        filterBinLocation: filterLocation, // Alias for InventoryManager
        filterChannel,
        hideSold,
        hideTracked,
        hideCombined,
        hideDeconstructed,
        filterPlacedLocated,
        filterFlaggedLocated: filterPlacedLocated, // Alias for InventoryManager
        filterInsight,
        insightFilter: filterInsight, // Alias for InventoryManager
        filterBarcode,
        filterUpcPrefix: filterBarcode, // Alias for InventoryManager
        filterSmartQueue,
        filterLotType,
        filterKeywords,
        filterPurchaseId,
        filterParentLotId,
        filterPO,
        filterSO,
        filterParentLotTitle,
        matchingLotDocIds,
        matchingPurchaseIds,
        // Sorting
        sortColumn,
        sortDirection,
        hasUserSelectedSort,
        setSort,
        applySortSelection,
        getSortIcon,
        // Option Lists
        allLocations,
        allAvailableLocations: allLocations, // Alias for InventoryManager
        allChannels,
        allAvailableChannels: allChannels, // Alias for InventoryManager
        allUpcPrefixes,
        allAvailableUpcPrefixes: allUpcPrefixes, // Alias for InventoryManager
        knownOrgPrefixes,
        // Cart
        cartItems,
        cartGroups,
        // Counters & Badges
        countActive,
        countAll,
        countByStatus,
        readyToListCount: countReadyToList,
        missingPhotosCount: countMissingPhotos,
        missingPricingCount: countMissingPricing,
        missingCostCount: countMissingCost,
        countMissingPhotos,
        countMissingPricing,
        countMissingCost,
        countReadyToList,
        activeFilterChips,
        activeFilterCount,
        baseInventoryCount,
        // Filtered Lists & Pagination
        filteredItems: inventoryFilteredItems,
        filteredInventory: inventoryFilteredItems, // Alias for InventoryManager
        spatialScopedItems,
        ownerSwitchScopedItems,
        pagedItems: inventoryPagedItems,
        pagedInventory: inventoryPagedItems, // Alias for InventoryTableView
        displayedInventory: inventoryPagedItems, // Alias for InventoryManager
        currentPage,
        gridPage: currentPage, // Alias for InventoryManager
        pageSize,
        gridPageSize: pageSize, // Alias for InventoryManager
        pageSizeOptions,
        gridPageSizeOptions: pageSizeOptions, // Alias for InventoryManager
        totalPages: inventoryTotalPages,
        gridTotalPages: inventoryTotalPages, // Alias for InventoryManager
        // Actions & Helpers
        clearFilters,
        clearAllFilters: clearFilters, // Alias for InventoryManager
        clearLineageFilters,
        initFromUrl,
        flushUrlSync,
        getVendorName,
        calculateRoi,
        getItemImageUrl,
        isActiveInventory
    };
}

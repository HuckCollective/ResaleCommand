import { ref, computed, watch, type Ref } from 'vue';
import type { Models } from 'appwrite';
import { getAssetUrl } from '../lib/inventory';
import { getWarehouseFacilityOptions, findFacility, matchesLocationFilter } from '../lib/warehouses';
import { useDataFilter, type SortDirection, type FilterChip } from './useDataFilter';

export type InventorySortColumn = 'title' | 'cost' | 'resalePrice' | 'margin' | 'upc' | 'vendor' | 'status' | 'location' | '$updatedAt' | '$createdAt';
export type { SortDirection, FilterChip };

// -- 0. IMAGE RESOLUTION HELPER (Universal getAssetUrl standard) --
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
    return getAssetUrl(id, { preview: true, width: size, height: size }) || null;
};

/**
 * Domain definition of active physical on-hand stock:
 * Excludes sold, tracked (not yet acquired), scouted (in shopping cart), and combined items.
 */
export const isActiveInventory = (status: string = ''): boolean => {
    const st = (status || 'acquired').toLowerCase();
    return !['sold', 'tracked', 'scouted', 'combined'].includes(st);
};

export interface UseInventoryFiltersOptions {
    purchases?: Ref<any[]>;
    orgPlacedLocations?: Ref<string[]>;
    knownPrefixes?: Ref<string[]>;
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
    const filterPlacedLocated = ref(false); // Only placed items with a storage location
    const filterInsight = ref(''); // 'ready_to_list' | 'missing_photos' | 'missing_pricing' | 'missing_cost' | 'missing_sold_price' | 'missing_description'
    const filterBarcode = ref('all'); // 'all' | '__missing__' | '__numeric__' | '__has_barcode__' | string prefix
    const filterLotType = ref('all'); // 'all' | 'lots_only' | 'extracted_only' | 'standalone_only'
    const filterKeywords = ref<string[]>([]);
    const filterPurchaseId = ref('');
    const filterParentLotId = ref('');
    const filterPO = ref('');
    const filterSO = ref('');

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
        const cost = (parseFloat(item.cost) || 0) / qty;
        const price = parseFloat(item.resalePrice || item.boutiquePrice) || 0;
        if (cost <= 0 || price <= 0) return null;
        const margin = ((price - cost) / cost) * 100;
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
                if (p) {
                    let cleaned = p.trim().toUpperCase();
                    if (!cleaned.endsWith('-') && !/^\d+$/.test(cleaned)) cleaned += '-';
                    prefixes.add(cleaned);
                }
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

    // -- STATUS & HEALTH COUNTERS --
    const countActive = computed(() => {
        return sourceItems.value.filter(i => isActiveInventory((i as any).status)).length;
    });

    const countByStatus = (status: string) => {
        const st = (status || '').toLowerCase();
        if (st === 'active') return countActive.value;
        if (st === 'tracked') {
            return sourceItems.value.filter(i => {
                const s = ((i as any).status || '').toLowerCase();
                return s === 'tracked' || s === 'scouted';
            }).length;
        }
        return sourceItems.value.filter(i => ((i as any).status || 'acquired').toLowerCase() === st).length;
    };

    const countMissingPhotos = computed(() => {
        return sourceItems.value.filter(i => {
            const anyItem = i as any;
            if (anyItem.imageId || (anyItem.galleryImageIds && anyItem.galleryImageIds.length > 0)) return false;
            if (anyItem.conditionNotes && (anyItem.conditionNotes.includes('[MAIN IMAGE ID:') || anyItem.conditionNotes.includes('[IMAGE_ID:'))) return false;
            return true;
        }).length;
    });

    const countMissingPricing = computed(() => {
        return sourceItems.value.filter(i => {
            const itm = i as any;
            if (itm.status === 'sold' || itm.status === 'scouted') return false;
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

    // -- 2. SEARCH PREDICATE OVERRIDE --
    const inventorySearchPredicate = (item: any, q: string, rawQuery: string, digits: string): boolean => {
        const itemUpc = (item.upc || item.sku || '').toLowerCase();

        // Explicit prefix queries like 'upc:huck-' or 'barcode:0012'
        if (q.startsWith('upc:') || q.startsWith('barcode:')) {
            const target = q.replace(/^(upc|barcode):/, '').trim();
            return itemUpc.includes(target);
        }

        const titleMatch = (item.title || item.itemName || '').toLowerCase().includes(q);
        const idMatch = (item.$id || '').toLowerCase().includes(q);
        const identityMatch = (item.identity || '').toLowerCase().includes(q);
        const binMatch = (item.storageLocation || '').toLowerCase().includes(q);
        const orderMatch = (item.orderId || item.sourceOrderId || '').toLowerCase().includes(q);
        const cartMatch = (item.cartId || '').toLowerCase().includes(q) || (item.cartId && matchingPurchaseIds.value.has(item.cartId));
        const purchaseMatch = (item.purchaseId || '').toLowerCase().includes(q) || (item.purchaseId && matchingPurchaseIds.value.has(item.purchaseId));
        const sourcingMatch = (item.sourcingLocation || '').toLowerCase().includes(q);
        const locSkuMatch = (item.locationSku || '').toLowerCase().includes(q);
        const notesMatch = (item.conditionNotes || item.marketDescription || '').toLowerCase().includes(q);
        const rawAnalysisMatch = (item.rawAnalysis || '').toLowerCase().includes(q);
        const componentsMatch = (item.components || '').toLowerCase().includes(q);
        const keywordMatch = Array.isArray(item.keywords) && item.keywords.some((k: string) => k.toLowerCase().includes(q));
        const vendorMatch = getVendorName(item).toLowerCase().includes(q);
        const upcMatch = itemUpc.includes(q);

        // Numeric suffix & partial number matching (e.g. searching "0735" or "735" matches "HUCK-0735")
        let numericMatch = false;
        if (digits.length >= 1) {
            const itemUpcDigits = itemUpc.replace(/\D/g, '');
            if (itemUpcDigits) {
                if (itemUpcDigits.endsWith(digits) || itemUpcDigits.includes(digits)) {
                    numericMatch = true;
                }
                const padded = digits.padStart(4, '0');
                if (itemUpcDigits.endsWith(padded) || itemUpc.includes(padded)) {
                    numericMatch = true;
                }
            }
        }

        return titleMatch || idMatch || identityMatch || binMatch || keywordMatch ||
               orderMatch || cartMatch || purchaseMatch || sourcingMatch || locSkuMatch ||
               notesMatch || rawAnalysisMatch || componentsMatch || upcMatch || vendorMatch || numericMatch;
    };

    // -- 3. SORT ACCESSORS --
    const inventorySortAccessors = {
        title: (item: any) => item.title || '',
        cost: (item: any) => parseFloat(item.cost) || 0,
        resalePrice: (item: any) => parseFloat(item.resalePrice || item.boutiquePrice) || 0,
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
        sortAccessors: inventorySortAccessors,
        defaultSortKey: '$updatedAt',
        defaultSortDirection: 'desc',
        defaultPageSize: options.defaultPageSize || 50
    });

    // Custom filtering pipeline for inventory domain rules
    const inventoryFilteredItems = computed(() => {
        const q = searchQuery.value.trim();
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

        // Apply pre-filter rules from generic pipeline
        return filteredItems.value.filter(item => {
            const anyItem = item as any;
            const itemStatus = (anyItem.status || 'acquired').toLowerCase();

            // 1. Core Exclusion: Combined / Merged items
            if (doHideCombined && itemStatus === 'combined' && st !== 'combined') {
                return false;
            }

            // 2. Core Exclusion: Trackers & Scouted (unacquired items)
            if (doHideTracked && (itemStatus === 'tracked' || itemStatus === 'scouted') && st !== 'tracked') {
                return false;
            }

            // 3. Core Exclusion: Sold items
            if (doHideSold && itemStatus === 'sold' && st !== 'sold') {
                return false;
            }

            // 4. Status Filter (Only when no insight filter forcing status)
            if (!insight && !filterParentLotId.value) {
                if (st === 'active') {
                    // Active Stock mode: governed directly by the exclusion flags above.
                    // If user unchecks hideSold, sold items pass through.
                    // If user unchecks hideTracked, tracked/scouted items pass through.
                    // If user unchecks hideCombined, combined items pass through.
                } else if (st === 'tracked') {
                    if (itemStatus !== 'tracked' && itemStatus !== 'scouted') return false;
                } else if (st !== 'all') {
                    if (itemStatus !== st) return false;
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

            // 10. Location / Booth filter
            if (loc && loc !== 'all' && loc.trim() !== '') {
                if (!matchesLocationFilter(anyItem, loc)) return false;
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

            // 12. Barcode / UPC filter
            if (bc && bc !== 'all') {
                const code = (anyItem.upc || anyItem.locationSku || anyItem.sku || '').trim().toUpperCase();
                if (bc === '__missing__') {
                    if (code !== '') return false;
                } else if (bc === '__numeric__') {
                    if (!code || !/^\d+$/.test(code)) return false;
                } else if (bc === '__has_barcode__') {
                    if (!code) return false;
                } else {
                    const target = bc.toUpperCase();
                    if (!code.startsWith(target) && !code.includes(target)) return false;
                }
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
                    if (itemStatus !== 'sold' || (parseVal(anyItem, 'soldPrice', 'Sold') || parseVal(anyItem, 'price', 'Sold'))) return false;
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
                }
            }

            return true;
        });
    });

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
        filterLotType,
        filterKeywords,
        filterPurchaseId,
        filterParentLotId,
        filterPO,
        filterSO
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
            const fac = findFacility(filterLocation.value);
            const display = fac ? fac.displayName : filterLocation.value;
            chips.push({
                id: 'location',
                label: `Location: ${display}`,
                onRemove: () => { filterLocation.value = 'all'; }
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

        // Barcode chip
        if (filterBarcode.value === '__missing__') {
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
                label: `UPC: ${filterBarcode.value}`,
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

    const activeFilterCount = computed(() => {
        let c = 0;
        if (filterStatus.value !== 'active' && filterStatus.value !== 'all') c++;
        if (!hideSold.value && filterStatus.value !== 'sold') c++;
        if (!hideTracked.value && filterStatus.value !== 'tracked') c++;
        if (!hideCombined.value && filterStatus.value !== 'combined') c++;
        if (filterBarcode.value && filterBarcode.value !== 'all') c++;
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
        return c;
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
        filterKeywords.value = [];
        filterPurchaseId.value = '';
        hideSold.value = true;
        hideTracked.value = true;
        hideCombined.value = true;
        clearLineageFilters();
    };

    // -- 6. URL PARAMETER HYDRATION --
    const initFromUrl = (params?: URLSearchParams) => {
        if (typeof window === 'undefined') return;
        const p = params || new URLSearchParams(window.location.search);

        if (p.has('insightFilter')) {
            filterInsight.value = p.get('insightFilter') || '';
        }
        if (p.has('search')) {
            searchQuery.value = p.get('search') || '';
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
            filterBarcode.value = p.get('upcPrefix') || p.get('barcode') || '';
        }
        if (p.has('status')) {
            filterStatus.value = p.get('status') || 'active';
        }
        if (p.has('location')) {
            filterLocation.value = p.get('location') || 'all';
        }
        if (p.has('channel')) {
            filterChannel.value = p.get('channel') || 'all';
        }
    };

    return {
        // Core State & Aliases
        searchQuery,
        filterStatus,
        filterLocation,
        filterBinLocation: filterLocation, // Alias for InventoryManager
        filterChannel,
        hideSold,
        hideTracked,
        hideCombined,
        filterPlacedLocated,
        filterFlaggedLocated: filterPlacedLocated, // Alias for InventoryManager
        filterInsight,
        insightFilter: filterInsight, // Alias for InventoryManager
        filterBarcode,
        filterUpcPrefix: filterBarcode, // Alias for InventoryManager
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
        setSort,
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
        countByStatus,
        readyToListCount: countReadyToList,
        missingPhotosCount: countMissingPhotos,
        missingPricingCount: countMissingPricing,
        countMissingPhotos,
        countMissingPricing,
        countReadyToList,
        activeFilterChips,
        activeFilterCount,
        baseInventoryCount,
        // Filtered Lists & Pagination
        filteredItems: inventoryFilteredItems,
        filteredInventory: inventoryFilteredItems, // Alias for InventoryManager
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
        getVendorName,
        calculateRoi,
        getItemImageUrl,
        isActiveInventory
    };
}

import { ref, computed, watch, type Ref } from 'vue';

export type SortDirection = 'asc' | 'desc';

export interface FilterChip {
    id: string;
    label: string;
    onRemove: () => void;
}

export interface DataFilterOptions<T> {
    /** Fields to include in default text search */
    searchFields?: (keyof T | string)[];
    /** Custom search predicate override */
    searchPredicate?: (item: T, query: string, rawQuery: string, digits: string) => boolean;
    /** Initial sort key */
    defaultSortKey?: string;
    /** Initial sort direction */
    defaultSortDirection?: SortDirection;
    /** Custom extractors to normalize sort values (dates, numbers, margin, etc.) */
    sortAccessors?: Record<string, (item: T) => any>;
    /** Custom named filter predicates: (item, filterValue) => boolean */
    filterPredicates?: Record<string, (item: T, filterValue: any) => boolean>;
    /** Default values for custom filters */
    defaultFilters?: Record<string, any>;
    /** Initial page size for pagination */
    defaultPageSize?: number;
    /** Available page size dropdown options */
    pageSizeOptions?: number[];
}

/**
 * Core Generic Data Filtering, Omnisearch, Multi-Column Sorting, and Pagination Engine.
 * Usable with ANY dataset (Inventory, Purchases, Sales, Drops, Manifests, etc.).
 */
export function useDataFilter<T extends Record<string, any>>(
    sourceItems: Ref<T[]>,
    options: DataFilterOptions<T> = {}
) {
    // 1. Search Query
    const searchQuery = ref('');

    // 2. Sorting
    const sortColumn = ref<string>(options.defaultSortKey || '$updatedAt');
    const sortDirection = ref<SortDirection>(options.defaultSortDirection || 'desc');

    // 3. Dynamic Filter State
    const activeFilters = ref<Record<string, any>>({ ...(options.defaultFilters || {}) });

    // 4. Pagination State
    const currentPage = ref(1);
    const pageSize = ref(options.defaultPageSize || 50);
    const pageSizeOptions = options.pageSizeOptions || [25, 50, 100, 200];

    // Helper to toggle or set sort
    const setSort = (col: string) => {
        if (sortColumn.value === col) {
            sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
        } else {
            sortColumn.value = col;
            sortDirection.value = 'desc';
        }
    };

    const getSortIcon = (col: string) => {
        if (sortColumn.value !== col) return 'solar:sort-vertical-linear';
        return sortDirection.value === 'asc' ? 'solar:arrow-up-linear' : 'solar:arrow-down-linear';
    };

    // Helper to set an individual filter
    const setFilter = (key: string, value: any) => {
        activeFilters.value[key] = value;
    };

    const getFilter = (key: string, fallback: any = null) => {
        return activeFilters.value[key] !== undefined ? activeFilters.value[key] : fallback;
    };

    // Reset all filters to default
    const resetFilters = () => {
        searchQuery.value = '';
        activeFilters.value = { ...(options.defaultFilters || {}) };
    };

    // Default comparator for sorting
    const compareValues = (a: any, b: any, dir: SortDirection): number => {
        if (a === b) return 0;
        if (a === null || a === undefined) return 1;
        if (b === null || b === undefined) return -1;

        if (typeof a === 'number' && typeof b === 'number') {
            return dir === 'asc' ? a - b : b - a;
        }

        const strA = String(a).toLowerCase();
        const strB = String(b).toLowerCase();
        const comp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
        return dir === 'asc' ? comp : -comp;
    };

    // 5. Filtered & Sorted Pipeline
    const filteredItems = computed<T[]>(() => {
        const items = sourceItems.value || [];
        const rawQuery = searchQuery.value.trim();
        const q = rawQuery.toLowerCase();
        const digits = rawQuery.replace(/\D/g, '');
        const currentFilters = activeFilters.value;

        // Step A: Filter
        const filtered = items.filter(item => {
            // 1. Omnisearch matching
            if (rawQuery) {
                if (options.searchPredicate) {
                    if (!options.searchPredicate(item, q, rawQuery, digits)) return false;
                } else if (options.searchFields && options.searchFields.length > 0) {
                    const matchesAnyField = options.searchFields.some(field => {
                        const val = item[field as keyof T];
                        if (val === null || val === undefined) return false;
                        if (Array.isArray(val)) {
                            return val.some(v => String(v).toLowerCase().includes(q));
                        }
                        return String(val).toLowerCase().includes(q);
                    });
                    if (!matchesAnyField) return false;
                }
            }

            // 2. Custom Filter Predicates
            if (options.filterPredicates) {
                for (const [filterKey, predicate] of Object.entries(options.filterPredicates)) {
                    const filterVal = currentFilters[filterKey];
                    if (filterVal !== undefined) {
                        const passed = predicate(item, filterVal);
                        if (!passed) return false;
                    }
                }
            }

            return true;
        });

        // Step B: Sort
        return filtered.sort((a, b) => {
            const col = sortColumn.value;
            let valA: any;
            let valB: any;

            if (options.sortAccessors && options.sortAccessors[col]) {
                valA = options.sortAccessors[col](a);
                valB = options.sortAccessors[col](b);
            } else {
                valA = a[col];
                valB = b[col];

                // Auto-detect date fields
                if (col.includes('At') || col.includes('Date') || col === '$createdAt' || col === '$updatedAt') {
                    valA = new Date(valA || a.$updatedAt || a.$createdAt || 0).getTime();
                    valB = new Date(valB || b.$updatedAt || b.$createdAt || 0).getTime();
                }
            }

            return compareValues(valA, valB, sortDirection.value);
        });
    });

    // 6. Pagination Math
    const totalPages = computed(() => {
        return Math.max(1, Math.ceil(filteredItems.value.length / pageSize.value) || 1);
    });

    const pagedItems = computed<T[]>(() => {
        const start = (currentPage.value - 1) * pageSize.value;
        return filteredItems.value.slice(start, start + pageSize.value);
    });

    // Reset pagination to page 1 whenever search query or filters change
    watch([searchQuery, activeFilters, pageSize], () => {
        currentPage.value = 1;
    }, { deep: true });

    return {
        // State
        searchQuery,
        sortColumn,
        sortDirection,
        activeFilters,
        currentPage,
        pageSize,
        pageSizeOptions,
        // Computed
        filteredItems,
        pagedItems,
        totalPages,
        // Methods
        setSort,
        getSortIcon,
        setFilter,
        getFilter,
        resetFilters
    };
}

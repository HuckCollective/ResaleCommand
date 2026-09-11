<template>
    <div class="space-y-4 pb-32">
        <!-- 1. STICKY TOP OMNIBAR & STATUS PIPELINE TABS -->
        <InventoryHeader 
            title="Inventory"
            subtitle="Spreadsheet / High-Density View"
            v-model:searchQuery="searchQuery"
            v-model:filterStatus="filterStatus"
            v-model:filterLocation="filterLocation"
            v-model:filterChannel="filterChannel"
            v-model:hideSold="hideSold"
            v-model:hideTracked="hideTracked"
            v-model:hideCombined="hideCombined"
            v-model:filterPlacedLocated="filterPlacedLocated"
            v-model:filterInsight="filterInsight"
            v-model:filterBarcode="filterBarcode"
            v-model:filterLotType="filterLotType"
            :locations="allLocations"
            :prefixes="allUpcPrefixes.list"
            :activeFilterChips="activeFilterChips"
            :totalCount="inventoryItems.length"
            :filteredCount="filteredItems.length"
            :loading="loading"
            :statusCounts="{
                active: countByStatus('active'),
                acquired: countByStatus('acquired'),
                received: countByStatus('received'),
                placed: countByStatus('placed'),
                tracked: countByStatus('tracked'),
                sold: countByStatus('sold')
            }"
            switchViewHref="/inventory"
            switchViewLabel="Card Grid"
            switchViewIcon="solar:gallery-wide-linear"
            switchViewTitle="Switch to Visual Card Grid"
            :viewMode="viewMode"
            @update:viewMode="$emit('update:viewMode', $event)"
            @add="openAdd"
            @import="showImport = true"
            @clear-filters="clearFilters"
        />

        <!-- 2. DENSE SPREADSHEET TABLE -->
        <div class="card bg-base-100 border border-base-200 shadow-sm overflow-hidden rounded-xl mb-32">
            <div class="overflow-x-auto">
                <table class="table table-sm table-pin-rows table-zebra w-full text-xs">
                    <thead>
                        <tr class="bg-base-200/90 text-base-content font-bold border-b border-base-300 select-none">
                            <!-- Checkbox Select All -->
                            <th class="w-10 text-center">
                                <input 
                                    type="checkbox" 
                                    :checked="isAllSelected(filteredItems)" 
                                    @change="toggleAll(filteredItems)" 
                                    class="checkbox checkbox-xs checkbox-primary" 
                                    title="Select all items"
                                />
                            </th>
                            
                            <!-- Thumbnail -->
                            <th class="w-12 text-center">Image</th>
                            
                            <!-- Title & Lot -->
                            <th class="cursor-pointer hover:text-primary transition-colors min-w-56" @click="setSort('title')">
                                <div class="flex items-center gap-1">
                                    <span>Item Name / Description</span>
                                    <Icon :icon="getSortIcon('title')" class="w-3.5 h-3.5 opacity-60" />
                                </div>
                            </th>

                            <!-- Barcode / UPC -->
                            <th class="cursor-pointer hover:text-primary transition-colors w-32" @click="setSort('upc')">
                                <div class="flex items-center gap-1">
                                    <span>Barcode / UPC</span>
                                    <Icon :icon="getSortIcon('upc')" class="w-3.5 h-3.5 opacity-60" />
                                </div>
                            </th>

                            <!-- Sourcing Vendor -->
                            <th class="cursor-pointer hover:text-primary transition-colors w-28" @click="setSort('vendor')">
                                <div class="flex items-center gap-1">
                                    <span>Vendor</span>
                                    <Icon :icon="getSortIcon('vendor')" class="w-3.5 h-3.5 opacity-60" />
                                </div>
                            </th>

                            <!-- Status -->
                            <th class="cursor-pointer hover:text-primary transition-colors w-24 text-center" @click="setSort('status')">
                                <div class="flex items-center justify-center gap-1">
                                    <span>Status</span>
                                    <Icon :icon="getSortIcon('status')" class="w-3.5 h-3.5 opacity-60" />
                                </div>
                            </th>

                            <!-- Cost -->
                            <th class="cursor-pointer hover:text-primary transition-colors w-24 text-right" @click="setSort('cost')">
                                <div class="flex items-center justify-end gap-1">
                                    <span>Landed Cost</span>
                                    <Icon :icon="getSortIcon('cost')" class="w-3.5 h-3.5 opacity-60" />
                                </div>
                            </th>

                            <!-- Resale Price -->
                            <th class="cursor-pointer hover:text-primary transition-colors w-24 text-right" @click="setSort('resalePrice')">
                                <div class="flex items-center justify-end gap-1">
                                    <span>Resale</span>
                                    <Icon :icon="getSortIcon('resalePrice')" class="w-3.5 h-3.5 opacity-60" />
                                </div>
                            </th>

                            <!-- Margin % / ROI -->
                            <th class="cursor-pointer hover:text-primary transition-colors w-20 text-right" @click="setSort('margin')">
                                <div class="flex items-center justify-end gap-1">
                                    <span>ROI %</span>
                                    <Icon :icon="getSortIcon('margin')" class="w-3.5 h-3.5 opacity-60" />
                                </div>
                            </th>

                            <!-- Location -->
                            <th class="cursor-pointer hover:text-primary transition-colors w-32" @click="setSort('location')">
                                <div class="flex items-center gap-1">
                                    <span>Location</span>
                                    <Icon :icon="getSortIcon('location')" class="w-3.5 h-3.5 opacity-60" />
                                </div>
                            </th>

                            <!-- Actions -->
                            <th class="w-12 text-center">Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        <!-- Loading State -->
                        <tr v-if="loading && inventoryItems.length === 0">
                            <td colspan="11" class="text-center py-12">
                                <span class="loading loading-spinner loading-md text-primary"></span>
                                <div class="text-xs opacity-60 mt-2 font-mono">Loading inventory database...</div>
                            </td>
                        </tr>

                        <!-- Empty State -->
                        <tr v-else-if="filteredItems.length === 0">
                            <td colspan="11" class="text-center py-12">
                                <div class="flex flex-col items-center justify-center gap-2">
                                    <Icon icon="solar:box-minimalistic-linear" class="w-10 h-10 opacity-30" />
                                    <p class="font-bold text-sm opacity-70">No items match your active filters</p>
                                    <button class="btn btn-xs btn-outline mt-1" @click="clearFilters">Reset Filters</button>
                                </div>
                            </td>
                        </tr>

                        <!-- Rows -->
                        <tr 
                            v-for="item in pagedInventory" 
                            :key="item.$id" 
                            class="hover:bg-primary/5 transition-colors cursor-pointer group"
                            :class="{'bg-primary/10 font-medium': isSelected(item.$id)}"
                            @click="openItem(item)"
                        >
                            <!-- Row Checkbox -->
                            <td class="text-center" @click.stop>
                                <input 
                                    type="checkbox" 
                                    :value="item.$id" 
                                    v-model="selectedItems" 
                                    class="checkbox checkbox-xs checkbox-primary align-middle"
                                />
                            </td>

                            <!-- Thumbnail Image Component -->
                            <td class="text-center" @click.stop="openItem(item)">
                                <ItemThumbnail :item="item" size="sm" rounded="lg" class="mx-auto" />
                            </td>

                            <!-- Title & Lot ID -->
                            <td class="min-w-56 max-w-xs">
                                <div class="font-bold text-xs truncate group-hover:text-primary transition-colors" :title="item.title">
                                    {{ item.title || 'Untitled Item' }}
                                </div>
                                <div class="text-[10px] opacity-50 truncate flex items-center gap-1.5 font-mono mt-0.5">
                                    <span v-if="item.identity">Lot/ID: {{ item.identity }}</span>
                                    <span v-if="item.parentLotId" class="badge badge-secondary badge-xs scale-90">Child Lot</span>
                                    <span v-if="item.quantity > 1" class="badge badge-ghost badge-xs scale-90">Qty: {{ item.quantity }}</span>
                                </div>
                            </td>

                            <!-- SKU / Barcode Pill -->
                            <td class="font-mono text-[11px]" @click.stop="copyUpc(item.upc)">
                                <span 
                                    v-if="item.upc" 
                                    class="badge badge-sm font-mono font-bold bg-base-200 border border-base-300 gap-1 hover:border-primary transition-colors cursor-copy"
                                    title="Click to copy barcode"
                                >
                                    <Icon icon="solar:barcode-read-linear" class="w-3 h-3 text-primary" />
                                    {{ item.upc }}
                                </span>
                                <span v-else class="text-[10px] opacity-40 italic">No Barcode</span>
                            </td>

                            <!-- Sourcing Vendor -->
                            <td>
                                <span class="badge badge-sm badge-outline text-[10px] font-bold truncate max-w-28" :class="getVendorBadgeClass(item)">
                                    {{ getVendorName(item) }}
                                </span>
                            </td>

                            <!-- Status Badge -->
                            <td class="text-center">
                                <span class="badge badge-xs font-bold uppercase tracking-wider py-2" :class="getStatusClass(item.status)">
                                    {{ item.status || 'acquired' }}
                                </span>
                            </td>

                            <!-- Landed Cost -->
                            <td class="text-right font-mono font-bold text-warning text-xs">
                                ${{ Number(item.cost || 0).toFixed(2) }}
                            </td>

                            <!-- Resale Price -->
                            <td class="text-right font-mono font-bold text-secondary text-xs">
                                ${{ Number(item.resalePrice || item.boutiquePrice || 0).toFixed(2) }}
                            </td>

                            <!-- Margin % / ROI -->
                            <td class="text-right font-mono text-[11px]">
                                <span v-if="calculateRoi(item) !== null" class="font-bold" :class="calculateRoi(item) >= 100 ? 'text-success' : calculateRoi(item) > 0 ? 'text-info' : 'text-error'">
                                    {{ calculateRoi(item) > 0 ? '+' : '' }}{{ calculateRoi(item) }}%
                                </span>
                                <span v-else class="opacity-30">—</span>
                            </td>

                            <!-- Location -->
                            <td>
                                <div v-if="item.storageLocation || (item.sellingLocations && item.sellingLocations.length > 0)" class="flex items-center gap-1 truncate max-w-32">
                                    <Icon icon="solar:map-point-linear" class="w-3 h-3 text-primary shrink-0" />
                                    <span class="font-bold text-[11px] truncate">
                                        {{ item.storageLocation || item.sellingLocations[0] }}
                                    </span>
                                </div>
                                <span v-else class="text-[10px] opacity-40 italic">Unassigned</span>
                            </td>

                            <!-- Actions -->
                            <td class="text-center" @click.stop>
                                <div class="dropdown dropdown-end">
                                    <button tabindex="0" class="btn btn-ghost btn-xs btn-circle opacity-60 hover:opacity-100">
                                        <Icon icon="solar:menu-dots-bold" class="w-4 h-4" />
                                    </button>
                                    <ul tabindex="0" class="dropdown-content z-50 menu p-1.5 shadow-xl bg-base-100 rounded-box w-44 border border-base-200 text-xs font-bold space-y-0.5">
                                        <li>
                                            <a @click="openItem(item)" class="text-primary">
                                                <Icon icon="solar:pen-linear" class="w-3.5 h-3.5" /> Edit Details
                                            </a>
                                        </li>
                                        <li>
                                            <a @click="quickFlipStatus(item, 'placed')" class="text-success">
                                                <Icon icon="solar:shop-2-bold" class="w-3.5 h-3.5" /> Mark Placed
                                            </a>
                                        </li>
                                        <li>
                                            <a @click="quickFlipStatus(item, 'sold')" class="text-info">
                                                <Icon icon="solar:tag-price-bold" class="w-3.5 h-3.5" /> Mark Sold
                                            </a>
                                        </li>
                                        <div class="divider my-0.5"></div>
                                        <li>
                                            <a @click="deleteItemConfirm(item)" class="text-error">
                                                <Icon icon="solar:trash-bin-trash-linear" class="w-3.5 h-3.5" /> Delete Item
                                            </a>
                                        </li>
                                    </ul>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Table Pagination Bar -->
            <div class="p-3 bg-base-200/80 border-t border-base-300 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div class="text-base-content/80 font-mono font-medium">
                    Showing <span class="font-bold text-primary">{{ filteredItems.length > 0 ? (currentPage - 1) * pageSize + 1 : 0 }}</span> to <span class="font-bold text-primary">{{ Math.min(currentPage * pageSize, filteredItems.length) }}</span> of <span class="font-bold text-base-content">{{ filteredItems.length }}</span> items
                </div>

                <div class="join border border-base-content/20 rounded-lg">
                    <button 
                        class="join-item btn btn-xs font-bold" 
                        :class="currentPage === 1 ? 'bg-base-300/40 text-base-content/40 border-base-content/10 cursor-not-allowed' : 'btn-primary text-primary-content'" 
                        :disabled="currentPage === 1" 
                        @click="currentPage--"
                    >« Prev</button>
                    <button class="join-item btn btn-xs font-mono font-bold bg-base-200 text-base-content border-x border-base-content/20">{{ currentPage }} / {{ totalPages || 1 }}</button>
                    <button 
                        class="join-item btn btn-xs font-bold" 
                        :class="currentPage >= totalPages ? 'bg-base-300/40 text-base-content/40 border-base-content/10 cursor-not-allowed' : 'btn-primary text-primary-content'" 
                        :disabled="currentPage >= totalPages" 
                        @click="currentPage++"
                    >Next »</button>
                </div>
            </div>
        </div>

        <!-- 3. UNIFIED INTEGRATED BOTTOM COMMAND DOCK & TRAY -->
        <InventoryPaginationDock 
            v-model:currentPage="currentPage"
            v-model:pageSize="pageSize"
            :pageSizeOptions="pageSizeOptions"
            :totalPages="totalPages"
            :totalItems="filteredItems.length"
            :totalUnfiltered="inventoryItems.length"
            :selectedCount="selectedItems.length"
            :activeFilterCount="activeFilterChips.length"
            :isLoading="loading"
            v-model:filterLocation="filterLocation"
            v-model:filterStatus="filterStatus"
            v-model:filterChannel="filterChannel"
            :locations="allLocations"
            :channels="allChannels"
            :isProcessing="isApplyingBulk"
            @add="openAdd"
            @import-csv="showImport = true"
            @apply-location="handleBulkLocation"
            @apply-status="handleBulkStatus"
            @export="handleExport"
            @delete="handleBulkDelete"
            @clear-selection="clearSelection"
            @clear-filters="clearFilters"
        />

        <!-- 5. SLIDE-OVER ITEM DRAWER (Async Lazy-Loaded Island) -->
        <ItemDrawer 
            v-if="isDrawerOpen" 
            :item="activeItem" 
            @close="closeDrawer" 
            @save="onDrawerSaved" 
            @refresh="fetchInventory"
        />

        <!-- 6. BULK IMPORT MODAL (Async Lazy-Loaded Island) -->
        <BulkImport v-if="showImport" @close="showImport = false" @complete="onImportComplete" />
    </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, defineAsyncComponent } from 'vue';
import { Icon } from '@iconify/vue';
import { useInventory } from '../../composables/useInventory';
import { useInventorySelection } from '../../composables/useInventorySelection';
import { useInventoryFilters } from '../../composables/useInventoryFilters';
import { useInventoryBulkActions } from '../../composables/useInventoryBulkActions';
import { updateInventoryItem, deleteInventoryItem, saveItemToInventory } from '../../lib/inventory';
import { useAuth } from '../../composables/useAuth';
import { addToast } from '../../stores/toast';
import { confirmDialog } from '../../stores/confirm';
import ItemThumbnail from '../common/ItemThumbnail.vue';
import InventoryHeader from './InventoryHeader.vue';
import InventoryPaginationDock from './InventoryPaginationDock.vue';

// Lazy-loaded modal islands (Only downloaded on demand)
const ItemDrawer = defineAsyncComponent(() => import('../common/ItemDrawer.vue'));
const BulkImport = defineAsyncComponent(() => import('./BulkImport.vue'));

const props = defineProps({
    viewMode: {
        type: String,
        default: 'table'
    }
});

const emit = defineEmits(['update:viewMode']);

const { currentTeam, user } = useAuth();

// -- 1. CORE DATA COMPOSABLE --
const { inventoryItems, loading, error, fetchInventory } = useInventory();

// -- 2. SELECTION COMPOSABLE --
const { 
    selectedItems, 
    isAllSelected, 
    toggleAll, 
    isSelected, 
    clearSelection, 
    getSelectedObjects 
} = useInventorySelection();

// -- 3. FILTERING & SORTING COMPOSABLE --
const {
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
    activeFilterChips,
    filteredItems,
    setSort,
    getSortIcon,
    countByStatus,
    clearFilters,
    getVendorName,
    calculateRoi
} = useInventoryFilters(inventoryItems);

// -- 4. BULK ACTIONS COMPOSABLE --
const {
    isApplyingBulk,
    applyBulkLocation,
    applyBulkStatus,
    deleteBulkItems,
    exportBulkItems
} = useInventoryBulkActions(async () => {
    clearSelection();
    await fetchInventory();
});

// -- 5. DRAWER & MODALS STATE --
const isDrawerOpen = ref(false);
const activeItem = ref(null);
const showImport = ref(false);

// Pagination
const currentPage = ref(1);
const pageSize = ref(50);
const pageSizeOptions = [25, 50, 100, 200];
const totalPages = computed(() => Math.ceil(filteredItems.value.length / pageSize.value));
const pagedInventory = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value;
    return filteredItems.value.slice(start, start + pageSize.value);
});

// Lifecycle
onMounted(async () => {
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.has('search')) searchQuery.value = params.get('search') || '';
        if (params.has('location')) filterLocation.value = params.get('location') || 'all';
        if (params.has('status')) filterStatus.value = params.get('status') || 'active';
        if (params.has('insightFilter')) filterInsight.value = params.get('insightFilter') || '';
        if (params.has('purchaseId') || params.has('po')) {
            searchQuery.value = params.get('purchaseId') || params.get('po') || '';
        }
    }
    if (inventoryItems.value.length === 0) {
        await fetchInventory();
    }
});

// Reset page on filter change
watch([searchQuery, filterStatus, filterLocation, filterChannel, hideSold, hideTracked, hideCombined, filterPlacedLocated, filterInsight, filterBarcode, filterLotType], () => {
    currentPage.value = 1;
});

// Smoothly scroll back to top of table on page change if scrolled down
watch(currentPage, () => {
    if (typeof window !== 'undefined' && window.scrollY > 220) {
        window.scrollTo({ top: 140, behavior: 'smooth' });
    }
});

// -- 6. BULK HANDLERS --
const handleBulkLocation = async (targetLocation) => {
    await applyBulkLocation(selectedItems.value, targetLocation);
};

const handleBulkStatus = async (targetStatus) => {
    await applyBulkStatus(selectedItems.value, targetStatus);
};

const handleBulkDelete = async () => {
    await deleteBulkItems(selectedItems.value);
};

const handleExport = (format) => {
    const itemsToExport = getSelectedObjects(filteredItems.value);
    exportBulkItems(itemsToExport, format);
};

// -- 7. DRAWER & ROW ACTIONS --
const openItem = (item) => {
    activeItem.value = item;
    isDrawerOpen.value = true;
};

const openAdd = () => {
    activeItem.value = null;
    isDrawerOpen.value = true;
};

const closeDrawer = () => {
    isDrawerOpen.value = false;
    activeItem.value = null;
};

const isDrawerSaving = ref(false);
const onDrawerSaved = async (payload) => {
    if (isDrawerSaving.value) return;
    isDrawerSaving.value = true;
    try {
        const targetItem = activeItem.value;
        const targetId = targetItem?.$id || targetItem?.id;
        if (targetId && payload) {
            const updatedDoc = await updateInventoryItem(targetId, payload);
            const idx = inventoryItems.value.findIndex(i => i && (i.$id === targetId || i.id === targetId));
            if (idx !== -1 && updatedDoc) {
                inventoryItems.value[idx] = updatedDoc;
            }
            addToast({ type: 'success', message: 'Item updated successfully.' });
        } else if (payload) {
            const effectiveTeamId = currentTeam.value?.$id || user.value?.$id;
            const newDoc = await saveItemToInventory(
                { title: payload.title || 'Untitled Item', identity: payload.title, condition_notes: '' },
                payload.imageFile,
                payload,
                effectiveTeamId
            );
            if (newDoc) {
                inventoryItems.value.unshift(newDoc);
            }
            addToast({ type: 'success', message: 'Item created successfully.' });
        }
    } catch (e) {
        addToast({ type: 'error', message: 'Save failed: ' + e.message });
    } finally {
        isDrawerSaving.value = false;
        closeDrawer();
        fetchInventory().catch(() => {});
    }
};

const onImportComplete = async () => {
    showImport.value = false;
    await fetchInventory();
    addToast({ type: 'success', message: 'Import completed successfully!' });
};

const quickFlipStatus = async (item, newStatus) => {
    try {
        await updateInventoryItem(item.$id, { status: newStatus });
        item.status = newStatus;
        addToast({ type: 'success', message: `Item marked as ${newStatus}.` });
    } catch (e) {
        addToast({ type: 'error', message: e.message });
    }
};

const deleteItemConfirm = async (item) => {
    const confirmed = await confirmDialog({
        title: 'Delete Item',
        message: `Are you sure you want to delete "${item.title}"? This cannot be undone.`,
        confirmText: 'Delete',
        danger: true
    });
    if (!confirmed) return;

    try {
        await deleteInventoryItem(item.$id);
        inventoryItems.value = inventoryItems.value.filter(i => i.$id !== item.$id);
        addToast({ type: 'success', message: 'Item deleted.' });
    } catch (e) {
        addToast({ type: 'error', message: `Delete failed: ${e.message}` });
    }
};

// -- 8. VIEW HELPERS --
const getVendorBadgeClass = (item) => {
    const v = getVendorName(item).toLowerCase();
    if (v.includes('goodwill')) return 'badge-primary text-primary';
    if (v.includes('ctbids')) return 'badge-secondary text-secondary';
    if (v.includes('hibid')) return 'badge-accent text-accent';
    return 'badge-ghost';
};

const getStatusClass = (status) => {
    const st = (status || 'acquired').toLowerCase();
    if (st === 'acquired') return 'badge-warning text-warning-content';
    if (st === 'received') return 'badge-info text-info-content';
    if (st === 'placed') return 'badge-success text-success-content';
    if (st === 'sold') return 'badge-neutral';
    return 'badge-ghost';
};

const copyUpc = (upc) => {
    if (!upc) return;
    navigator.clipboard.writeText(upc);
    addToast({ type: 'info', message: `Copied ${upc} to clipboard` });
};
</script>

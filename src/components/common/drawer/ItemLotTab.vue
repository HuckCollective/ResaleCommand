<template>
    <div class="space-y-5">
        <!-- A. IF VIEWING AN EXTRACTED CHILD ITEM -->
        <div v-if="item?.parentLotId" class="space-y-4">
            <!-- Parent Lot Hero Card -->
            <div class="bg-base-200/70 rounded-2xl p-4 border border-base-300 space-y-3 shadow-xs">
                <div class="flex items-center justify-between border-b border-base-300 pb-2.5">
                    <div class="flex items-center gap-2 text-xs font-bold text-primary">
                        <Icon icon="solar:link-circle-bold" class="w-4 h-4" />
                        <span>Parent Master Lot Origin</span>
                    </div>
                    <span class="badge badge-xs badge-secondary font-bold font-mono">{{ parentItem?.upc || item.parentLotId }}</span>
                </div>
                
                <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3 min-w-0">
                        <ItemThumbnail v-if="parentItem" :item="parentItem" size="md" rounded="xl" class="shrink-0" />
                        <div v-else class="w-14 h-14 rounded-xl bg-base-100 border border-base-300 flex items-center justify-center text-base-content/40 shrink-0">
                            <Icon icon="solar:box-minimalistic-bold" class="w-6 h-6" />
                        </div>
                        <div class="min-w-0">
                            <h4 class="font-bold text-xs sm:text-sm truncate text-base-content">{{ parentItem?.title || 'Parent Lot' }}</h4>
                            <div class="flex items-center gap-2 mt-1 flex-wrap text-xs">
                                <span class="opacity-60 font-mono">Box Cost: <strong class="text-base-content">${{ Number(parentItem?.cost || 0).toFixed(2) }}</strong></span>
                                <a v-if="parentItem?.orderId" :href="`/purchases?search=${encodeURIComponent(parentItem.orderId)}`" target="_blank" class="badge badge-xs badge-info font-bold gap-0.5 hover:underline">
                                    <Icon icon="solar:link-minimalistic-bold" class="w-2.5 h-2.5" /> PO: {{ parentItem.orderId }}
                                </a>
                            </div>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        class="btn btn-sm btn-primary gap-1.5 font-bold shadow-xs shrink-0" 
                        @click="parentItem ? $emit('selectItem', parentItem) : null"
                        :disabled="!parentItem"
                    >
                        <Icon icon="solar:arrow-left-bold" class="w-4 h-4" />
                        <span>Open Parent</span>
                    </button>
                </div>
            </div>

            <!-- Sibling Items extracted from same lot -->
            <div class="bg-base-200/60 rounded-2xl p-4 border border-base-300 space-y-3 shadow-xs">
                <div class="flex items-center justify-between border-b border-base-300 pb-2">
                    <h4 class="font-bold text-xs uppercase tracking-wider text-base-content flex items-center gap-1.5">
                        <Icon icon="solar:documents-bold" class="w-3.5 h-3.5 text-secondary" />
                        All Sibling Items in this Lot Batch ({{ lotChildren.length }})
                    </h4>
                    <a :href="`/inventory?parentLotId=${item.parentLotId}`" class="btn btn-xs btn-outline btn-neutral font-bold gap-1">
                        <Icon icon="solar:filter-bold" class="w-3 h-3" /> View in Table
                    </a>
                </div>
                
                <div class="space-y-2 max-h-80 overflow-y-auto pr-1">
                    <div 
                        v-for="child in lotChildren" 
                        :key="child.$id" 
                        class="bg-base-100 p-2.5 rounded-xl border flex items-center justify-between gap-2 shadow-xs transition-all cursor-pointer group"
                        :class="child.$id === item.$id ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-base-300 hover:border-primary/50'"
                        @click="$emit('selectItem', child)"
                    >
                        <div class="flex items-center gap-2.5 min-w-0">
                            <ItemThumbnail :item="child" size="xs" rounded="lg" class="shrink-0" />
                            <div class="min-w-0">
                                <div class="flex items-center gap-1.5">
                                    <span class="badge badge-xs badge-ghost font-mono font-bold">{{ child.upc || 'NO-UPC' }}</span>
                                    <span v-if="child.quantity > 1" class="badge badge-xs badge-accent font-bold">Qty: {{ child.quantity }}</span>
                                    <span v-if="child.$id === item.$id" class="badge badge-xs badge-primary font-bold">Current</span>
                                    <span v-else class="badge badge-xs" :class="child.status === 'sold' ? 'badge-success' : 'badge-ghost'">{{ child.status }}</span>
                                </div>
                                <p class="text-xs font-bold truncate text-base-content mt-0.5 group-hover:text-primary transition-colors">{{ child.title }}</p>
                            </div>
                        </div>
                        <div class="text-right shrink-0">
                            <span class="text-xs font-bold text-success font-mono">${{ Number(child.resalePrice || 0).toFixed(2) }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- B. IF VIEWING A MASTER LOT -->
        <div v-else class="space-y-4">
            <!-- Top Action Toolbar -->
            <div class="flex flex-wrap items-center justify-between gap-2 bg-base-200/80 p-3 rounded-2xl border border-base-300 shadow-xs">
                <div class="flex items-center gap-2">
                    <button 
                        type="button" 
                        class="btn btn-sm btn-primary gap-1.5 font-bold shadow-xs hover:scale-105 transition-all"
                        @click="$emit('open-splitter')"
                    >
                        <Icon icon="solar:magic-stick-3-bold" class="w-4 h-4" />
                        <span>✨ Multi-Tier Lot Splitter</span>
                    </button>
                    <a 
                        :href="`/inventory?parentLotId=${item?.$id}`" 
                        class="btn btn-sm btn-outline btn-secondary gap-1 font-bold shadow-xs"
                    >
                        <Icon icon="solar:filter-bold" class="w-3.5 h-3.5" />
                        <span>View in Main Table</span>
                    </a>
                </div>

                <!-- Rollback / Uncombine Button -->
                <button 
                    v-if="lotChildren && lotChildren.length > 0"
                    type="button" 
                    class="btn btn-xs btn-outline btn-error font-bold gap-1 shrink-0" 
                    @click="$emit('uncombine')" 
                    :disabled="uncombining"
                    title="Restore original items and remove master lot"
                >
                    <span v-if="uncombining" class="loading loading-spinner loading-xs"></span>
                    <Icon v-else icon="solar:restart-bold" class="w-3 h-3" />
                    <span>Rollback Lot</span>
                </button>
            </div>

            <!-- Financial ROI Stats -->
            <div class="stats stats-horizontal shadow-xs w-full bg-base-200/80 border border-base-300 text-xs">
                <div class="stat px-3 py-2.5">
                    <div class="stat-title text-[10px] font-bold uppercase opacity-60">Box Cost</div>
                    <div class="stat-value text-sm sm:text-base font-mono">${{ Number(lotDashboardItem?.cost || 0).toFixed(2) }}</div>
                </div>
                <div class="stat px-3 py-2.5">
                    <div class="stat-title text-[10px] font-bold uppercase opacity-60">Listed Value</div>
                    <div class="stat-value text-sm sm:text-base text-primary font-mono">${{ (totalSplitResaleValue || 0).toFixed(2) }}</div>
                </div>
                <div class="stat px-3 py-2.5">
                    <div class="stat-title text-[10px] font-bold uppercase opacity-60">Realized Sales</div>
                    <div class="stat-value text-sm sm:text-base text-success font-mono">${{ (lotRealizedRevenue || 0).toFixed(2) }}</div>
                </div>
                <div class="stat px-3 py-2.5">
                    <div class="stat-title text-[10px] font-bold uppercase opacity-60">Net Profit</div>
                    <div class="stat-value text-sm sm:text-base font-mono font-bold" :class="(lotROI || 0) >= 0 ? 'text-success' : 'text-error'">
                        {{ (lotROI || 0) >= 0 ? '+' : '' }}${{ (lotROI || 0).toFixed(2) }}
                    </div>
                </div>
            </div>

            <!-- Split Child Inventory List -->
            <div class="bg-base-200/60 rounded-2xl p-4 border border-base-300 space-y-3 shadow-xs">
                <div class="flex items-center justify-between border-b border-base-300 pb-2.5">
                    <h4 class="font-bold text-xs uppercase tracking-wider text-base-content flex items-center gap-1.5">
                        <Icon icon="solar:box-minimalistic-bold" class="w-4 h-4 text-secondary" />
                        Split Child Listings ({{ lotChildren.length }} Items)
                    </h4>
                    <span class="text-[11px] opacity-60">Active inventory listings</span>
                </div>

                <div v-if="!lotChildren || lotChildren.length === 0" class="text-center py-8 border-2 border-dashed border-base-300 rounded-xl">
                    <Icon icon="solar:box-linear" class="w-8 h-8 text-base-content/30 mx-auto mb-1.5" />
                    <p class="text-xs font-bold opacity-70">No split items created yet.</p>
                    <p class="text-[11px] opacity-50 mt-0.5">Use the Multi-Tier Lot Splitter above to deconstruct this lot.</p>
                </div>

                <div v-else class="space-y-2 max-h-96 overflow-y-auto pr-1">
                    <div 
                        v-for="child in lotChildren" 
                        :key="child.$id" 
                        class="bg-base-100 p-2.5 rounded-xl border border-base-300 flex items-center justify-between gap-3 shadow-xs hover:border-primary/50 transition-all cursor-pointer group"
                        @click="$emit('selectItem', child)"
                        title="Click to open this child item"
                    >
                        <div class="flex items-center gap-2.5 min-w-0">
                            <ItemThumbnail :item="child" size="xs" rounded="lg" class="shrink-0" />
                            <div class="min-w-0">
                                <div class="flex items-center gap-1.5">
                                    <span class="badge badge-xs badge-ghost font-mono font-bold">{{ child.upc || 'NO-UPC' }}</span>
                                    <span v-if="child.quantity > 1" class="badge badge-xs badge-accent font-bold">Qty: {{ child.quantity }}</span>
                                    <span class="badge badge-xs" :class="child.status === 'sold' ? 'badge-success' : 'badge-primary'">{{ child.status }}</span>
                                </div>
                                <p class="text-xs font-bold truncate text-base-content mt-0.5 group-hover:text-primary transition-colors">{{ child.title }}</p>
                            </div>
                        </div>
                        <div class="text-right shrink-0 flex items-center gap-3">
                            <div>
                                <span class="text-xs font-bold text-success font-mono block">${{ Number(child.resalePrice || 0).toFixed(2) }}</span>
                                <span class="text-[10px] opacity-60 font-mono block">Cost: ${{ Number(child.cost || 0).toFixed(2) }}</span>
                            </div>
                            <button type="button" class="btn btn-xs btn-ghost btn-circle text-primary group-hover:bg-primary group-hover:text-primary-content transition-all">
                                <Icon icon="solar:arrow-right-linear" class="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { Icon } from '@iconify/vue';
import ItemThumbnail from '../ItemThumbnail.vue';

defineProps({
    item: {
        type: Object,
        default: null
    },
    parentItem: {
        type: Object,
        default: null
    },
    lotChildren: {
        type: Array,
        default: () => []
    },
    uncombining: {
        type: Boolean,
        default: false
    },
    lotDashboardItem: {
        type: Object,
        default: null
    },
    totalSplitResaleValue: {
        type: Number,
        default: 0
    },
    lotRealizedRevenue: {
        type: Number,
        default: 0
    },
    lotROI: {
        type: Number,
        default: 0
    }
});

defineEmits(['selectItem', 'open-splitter', 'uncombine']);
</script>

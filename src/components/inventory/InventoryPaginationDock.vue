<template>
    <div v-if="totalItems > 0">
        <!-- ========================================================================= -->
        <!-- UNIFIED FROZEN BOTTOM CONTAINER: STACKED PAGE TOOLS & DAISYUI DOCK        -->
        <!-- ========================================================================= -->
        <Transition name="slide-up">
            <div 
                v-if="!isTrayOpen"
                class="fixed bottom-0 inset-x-0 z-40 bg-base-100/95 dark:bg-base-200/95 backdrop-blur-2xl border-t border-base-300 shadow-[0_-4px_25px_rgba(0,0,0,0.18)] select-none pointer-events-auto flex flex-col pb-[env(safe-area-inset-bottom,0px)]"
            >
                <!-- ------------------------------------------------------------- -->
                <!-- STACK ROW 1: SLIM PAGE TOOLS DOCK (TOP STRIP)                 -->
                <!-- ------------------------------------------------------------- -->
                <div class="border-b border-base-content/15 bg-base-200 dark:bg-base-300 py-1 px-3 flex items-center justify-center text-xs shadow-2xs">
                    <div class="max-w-xl w-full mx-auto flex items-center justify-between sm:justify-center gap-1 sm:gap-2">
                        <!-- Scroll to Top & Filtered Total Rows Trigger -->
                        <button 
                            type="button"
                            class="btn btn-xs h-7 px-2.5 bg-base-100 dark:bg-base-100 border border-base-content/25 text-base-content hover:text-primary hover:border-primary/50 hover:bg-primary/10 transition-all active:scale-95 gap-1 shrink-0 shadow-2xs font-mono rounded-lg"
                            @click="onScrollTop"
                            :title="isFiltered ? `Scroll to top (${totalItems.toLocaleString()} matching filters)` : `Scroll to top (${totalItems.toLocaleString()} total records)`"
                        >
                            <Icon icon="solar:arrow-up-bold" class="w-3.5 h-3.5 text-primary shrink-0" />
                            <span class="font-black text-xs text-base-content">{{ totalItems.toLocaleString() }}</span>
                            <span class="text-base-content/60 font-sans text-[10px] font-bold uppercase tracking-tight">rows</span>
                        </button>

                        <!-- Jump to First Page -->
                        <button 
                            type="button"
                            class="btn btn-xs btn-ghost btn-circle h-7 w-7 font-bold transition-all hidden xs:inline-flex shrink-0"
                            :class="currentPage <= 1 || isLoading ? 'text-base-content/35 cursor-not-allowed' : 'text-base-content hover:text-primary hover:bg-primary/15'"
                            :disabled="currentPage <= 1 || isLoading"
                            @click="goToPage(1)"
                            title="First Page"
                        >
                            <Icon icon="solar:double-alt-arrow-left-bold" class="w-3.5 h-3.5" />
                        </button>

                        <!-- Previous Page Button -->
                        <button 
                            type="button"
                            class="btn btn-xs btn-ghost btn-circle h-7 w-7 font-bold transition-all shrink-0"
                            :class="currentPage <= 1 || isLoading ? 'text-base-content/35 cursor-not-allowed' : 'text-base-content hover:text-primary hover:bg-primary/15 active:scale-90'"
                            :disabled="currentPage <= 1 || isLoading"
                            @click="goToPage(currentPage - 1)"
                            title="Previous Page"
                        >
                            <Icon icon="solar:alt-arrow-left-bold" class="w-3.5 h-3.5" />
                        </button>

                        <!-- Tactile Page Pill -->
                        <div 
                            class="flex items-center gap-1.5 px-2.5 py-0.5 bg-base-100 dark:bg-base-100 rounded-lg border border-base-content/20 font-mono text-xs cursor-pointer hover:border-primary transition-all shadow-xs shrink-0"
                            @click="toggleJumpInput"
                            title="Click to jump to a specific page"
                        >
                            <template v-if="isJumping">
                                <span class="text-base-content font-sans text-[11px] font-bold">Go:</span>
                                <input 
                                    ref="jumpInputRef"
                                    type="number" 
                                    min="1" 
                                    :max="totalPages"
                                    v-model.number="jumpTarget"
                                    @keydown.enter="submitJump"
                                    @keydown.esc="cancelJump"
                                    @blur="submitJump"
                                    class="input input-xs input-bordered w-10 font-mono font-black text-center bg-base-100 text-base-content border-2 border-primary p-0 text-xs shadow-inner"
                                />
                                <span class="text-base-content font-sans text-[11px] font-bold">/ {{ totalPages }}</span>
                            </template>
                            <template v-else>
                                <span class="font-black text-primary-content bg-primary font-mono text-xs px-1.5 py-0.5 rounded shadow-xs">{{ currentPage }}</span>
                                <span class="text-base-content/60 font-bold">/</span>
                                <span class="font-bold text-base-content font-mono text-xs">{{ totalPages || 1 }}</span>
                            </template>
                        </div>

                        <!-- Next Page Button -->
                        <button 
                            type="button"
                            class="btn btn-xs btn-ghost btn-circle h-7 w-7 font-bold transition-all shrink-0"
                            :class="currentPage >= totalPages || isLoading ? 'text-base-content/35 cursor-not-allowed' : 'text-base-content hover:text-primary hover:bg-primary/15 active:scale-90'"
                            :disabled="currentPage >= totalPages || isLoading"
                            @click="goToPage(currentPage + 1)"
                            title="Next Page"
                        >
                            <Icon icon="solar:alt-arrow-right-bold" class="w-3.5 h-3.5" />
                        </button>

                        <!-- Jump to Last Page -->
                        <button 
                            type="button"
                            class="btn btn-xs btn-ghost btn-circle h-7 w-7 font-bold transition-all hidden xs:inline-flex shrink-0"
                            :class="currentPage >= totalPages || isLoading ? 'text-base-content/35 cursor-not-allowed' : 'text-base-content hover:text-primary hover:bg-primary/15'"
                            :disabled="currentPage >= totalPages || isLoading"
                            @click="goToPage(totalPages)"
                            title="Last Page"
                        >
                            <Icon icon="solar:double-alt-arrow-right-bold" class="w-3.5 h-3.5" />
                        </button>

                        <div class="h-3.5 w-px bg-base-content/25 shrink-0 mx-0.5"></div>

                        <!-- Page Size Selector -->
                        <div class="relative shrink-0">
                            <select 
                                :value="pageSize" 
                                @change="onPageSizeChange($event.target.value)"
                                class="select select-xs h-6 min-h-6 bg-base-100 dark:bg-base-100 text-base-content font-mono font-bold text-[11px] rounded-lg border border-base-content/25 hover:border-primary focus:border-primary shadow-xs pl-2 pr-6 min-w-[4.8rem] cursor-pointer"
                                title="Items per page"
                                :disabled="isLoading"
                            >
                                <option v-for="opt in pageSizeOptions" :key="opt" :value="opt">{{ opt }}/pg</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- ------------------------------------------------------------- -->
                <!-- STACK ROW 2: DAISYUI SEMANTIC DOCK (BOTTOM STRIP - THUMB ZONE) -->
                <!-- ------------------------------------------------------------- -->
                <div class="max-w-xl w-full mx-auto">
                    <div class="dock dock-sm !static !bg-transparent !border-t-0 !shadow-none !h-14">
                        <!-- Dock Item 1: Actions & Bulk Operations -->
                        <button 
                            type="button"
                            :class="{ 'dock-active text-warning font-black': selectedCount > 0, 'opacity-70 hover:opacity-100': selectedCount === 0 }"
                            @click="openTray('actions')"
                            :title="selectedCount > 0 ? `${selectedCount} records selected for bulk actions` : 'Open bulk actions tray'"
                        >
                            <Icon icon="solar:bolt-bold" class="w-5 h-5" />
                            <span class="dock-label font-mono">Actions ({{ selectedCount }})</span>
                        </button>

                        <!-- Dock Item 2: Add & Ingest Primary Action -->
                        <button 
                            type="button"
                            class="text-primary hover:opacity-90 font-black"
                            @click="openTray('add-prep')"
                            title="Add items, scout quick add & CSV import"
                        >
                            <Icon icon="solar:add-circle-bold" class="w-5 h-5" />
                            <span class="dock-label">Add & Ingest</span>
                        </button>

                        <!-- Dock Item 3: Filters & View Options -->
                        <button 
                            type="button"
                            :class="{ 'dock-active text-primary font-bold': activeFilterCount > 0, 'opacity-70 hover:opacity-100': activeFilterCount === 0 }"
                            @click="openTray('filters')"
                            title="Open Filters & View Options"
                        >
                            <div class="indicator">
                                <span v-if="activeFilterCount > 0" class="indicator-item badge badge-xs badge-primary font-mono font-bold">{{ activeFilterCount }}</span>
                                <Icon icon="solar:tuning-square-2-bold-duotone" class="w-5 h-5" />
                            </div>
                            <span class="dock-label">Filters</span>
                        </button>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- ========================================================================= -->
        <!-- 3. SLIDE-UP BOTTOM ACTION TRAY (CONSISTENT HEIGHT DRAWER)                  -->
        <!-- ========================================================================= -->
        <BottomActionTray 
            v-model:isOpen="isTrayOpen"
            v-model:activeTab="activeTrayTab"
            :selectedCount="selectedCount"
            :activeFilterCount="activeFilterCount"
            :locations="locations"
            :channels="channels"
            :isProcessing="isProcessing"
            @scout-quick-add="$emit('scout-quick-add')"
            @open-add-drawer="$emit('add')"
            @import-csv="$emit('import-csv')"
            @combine="$emit('combine')"
            @bundle="$emit('bundle')"
            @apply-location="$emit('apply-location', $event)"
            @apply-status="$emit('apply-status', $event)"
            @export="$emit('export', $event)"
            @delete="$emit('delete')"
            @clear-selection="$emit('clear-selection')"
            @reset-filters="$emit('clear-filters')"
        >
            <template #filters>
                <slot name="filters" />
            </template>
        </BottomActionTray>
    </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import BottomActionTray from './BottomActionTray.vue';

const props = defineProps({
    currentPage: {
        type: Number,
        default: 1
    },
    totalPages: {
        type: Number,
        default: 1
    },
    totalItems: {
        type: Number,
        default: 0
    },
    totalUnfiltered: {
        type: Number,
        default: 0
    },
    pageSize: {
        type: Number,
        default: 50
    },
    pageSizeOptions: {
        type: Array,
        default: () => [25, 50, 100, 200]
    },
    selectedCount: {
        type: Number,
        default: 0
    },
    isLoading: {
        type: Boolean,
        default: false
    },
    locations: {
        type: Array,
        default: () => []
    },
    channels: {
        type: Array,
        default: () => []
    },
    isProcessing: {
        type: Boolean,
        default: false
    },
    activeFilterCount: {
        type: Number,
        default: 0
    }
});

// Row range and filter state for display
const shownStart = computed(() => {
    if (props.totalItems === 0) return 0;
    return (props.currentPage - 1) * props.pageSize + 1;
});

const shownEnd = computed(() => {
    return Math.min(props.currentPage * props.pageSize, props.totalItems);
});

const isFiltered = computed(() => {
    return props.activeFilterCount > 0 || (props.totalUnfiltered > 0 && props.totalItems < props.totalUnfiltered);
});

const emit = defineEmits([
    'update:currentPage',
    'update:pageSize',
    'scroll-top',
    'first',
    'prev',
    'next',
    'last',
    'add',
    'scout-quick-add',
    'import-csv',
    'combine',
    'bundle',
    'apply-location',
    'apply-status',
    'export',
    'delete',
    'clear-selection',
    'clear-filters'
]);

// Tray state
const isTrayOpen = ref(false);
const activeTrayTab = ref('actions'); // 'actions' | 'add-prep' | 'filters'

const openTray = (tab) => {
    activeTrayTab.value = tab;
    isTrayOpen.value = true;
};

const closeTray = () => {
    isTrayOpen.value = false;
};

// Direct jump page input
const isJumping = ref(false);
const jumpTarget = ref(props.currentPage);
const jumpInputRef = ref(null);

const goToPage = (page) => {
    const target = Math.max(1, Math.min(page, props.totalPages || 1));
    if (target !== props.currentPage) {
        emit('update:currentPage', target);
        if (target === 1) emit('first');
        else if (target === props.totalPages) emit('last');
        else if (target > props.currentPage) emit('next');
        else emit('prev');
    }
};

const onPageSizeChange = (val) => {
    const newSize = parseInt(val, 10);
    if (!isNaN(newSize) && newSize !== props.pageSize) {
        emit('update:pageSize', newSize);
        emit('update:currentPage', 1);
    }
};

const toggleJumpInput = () => {
    jumpTarget.value = props.currentPage;
    isJumping.value = true;
    nextTick(() => {
        jumpInputRef.value?.focus();
        jumpInputRef.value?.select();
    });
};

const submitJump = () => {
    if (isJumping.value) {
        isJumping.value = false;
        if (jumpTarget.value && jumpTarget.value >= 1 && jumpTarget.value <= props.totalPages) {
            goToPage(jumpTarget.value);
        }
    }
};

const cancelJump = () => {
    isJumping.value = false;
};

const onScrollTop = () => {
    if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    emit('scroll-top');
};

defineExpose({
    openTray,
    closeTray
});
</script>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease-out;
}

.slide-up-enter-from,
.slide-up-leave-to {
    transform: translateY(100%);
    opacity: 0;
}
</style>

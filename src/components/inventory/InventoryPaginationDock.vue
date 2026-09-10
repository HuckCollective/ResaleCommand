<template>
    <Transition name="slide-up">
        <div 
            v-if="totalItems > 0 && selectedCount === 0"
            class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-auto max-w-[95vw] bg-base-100/95 dark:bg-base-200/95 backdrop-blur-xl border-2 border-primary/50 shadow-[0_12px_40px_rgba(0,0,0,0.6)] rounded-2xl px-3 py-2 flex items-center gap-2 text-xs select-none ring-1 ring-base-content/10 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]"
        >
            <!-- Scroll to Top Trigger -->
            <button 
                type="button"
                class="btn btn-xs btn-ghost btn-circle text-base-content font-bold hover:text-primary hover:bg-primary/15 transition-colors"
                @click="onScrollTop"
                title="Scroll to Top"
            >
                <Icon icon="solar:arrow-up-linear" class="w-4 h-4" />
            </button>

            <div class="h-4 w-px bg-base-content/20 shrink-0"></div>

            <!-- Jump to First Page -->
            <button 
                type="button"
                class="btn btn-xs btn-ghost btn-circle font-bold transition-colors"
                :class="currentPage <= 1 || isLoading ? 'text-base-content/30 cursor-not-allowed' : 'text-base-content hover:text-primary hover:bg-primary/15'"
                :disabled="currentPage <= 1 || isLoading"
                @click="goToPage(1)"
                title="First Page"
            >
                <Icon icon="solar:double-alt-arrow-left-bold" class="w-3.5 h-3.5" />
            </button>

            <!-- Previous Page Button -->
            <button 
                type="button"
                class="btn btn-xs gap-1 font-bold border transition-all"
                :class="currentPage <= 1 || isLoading 
                    ? 'bg-base-300/40 text-base-content/40 border-base-content/15 cursor-not-allowed' 
                    : 'btn-primary text-primary-content border-primary shadow-xs hover:brightness-110'"
                :disabled="currentPage <= 1 || isLoading"
                @click="goToPage(currentPage - 1)"
                title="Previous Page"
            >
                <Icon icon="solar:alt-arrow-left-linear" class="w-3.5 h-3.5" />
                <span class="hidden sm:inline">Prev</span>
            </button>

            <!-- Page Number & Item Range Pill -->
            <div 
                class="flex items-center gap-1.5 px-3 py-1 bg-base-200 dark:bg-base-300/90 rounded-xl border border-base-content/20 font-mono text-xs cursor-pointer hover:border-primary transition-all shadow-inner"
                @click="toggleJumpInput"
                title="Click to jump to a specific page"
            >
                <!-- Direct Jump Input Mode -->
                <template v-if="isJumping">
                    <span class="text-base-content/80 font-sans text-xs font-bold">Go:</span>
                    <input 
                        ref="jumpInputRef"
                        type="number" 
                        min="1" 
                        :max="totalPages"
                        v-model.number="jumpTarget"
                        @keydown.enter="submitJump"
                        @keydown.esc="cancelJump"
                        @blur="submitJump"
                        class="input input-xs input-bordered w-14 font-mono font-black text-center bg-base-100 text-primary border-primary p-0 text-xs shadow-inner"
                    />
                    <span class="text-base-content/70 font-sans text-xs font-bold">/ {{ totalPages }}</span>
                </template>

                <!-- Normal Display Mode -->
                <template v-else>
                    <span class="font-sans text-base-content/80 font-bold text-[11px] hidden xs:inline">Page</span>
                    <span class="font-black text-primary font-mono text-sm px-1.5 py-0.5 bg-primary/20 rounded border border-primary/30">{{ currentPage }}</span>
                    <span class="text-base-content/60 font-bold">/</span>
                    <span class="font-bold text-base-content font-mono text-xs">{{ totalPages || 1 }}</span>
                    
                    <!-- Desktop Item Count Range Indicator -->
                    <span class="hidden md:inline font-sans text-base-content/80 font-semibold ml-1.5 text-xs whitespace-nowrap">
                        ({{ itemRangeText }} of {{ totalItems.toLocaleString() }})
                    </span>
                </template>
            </div>

            <!-- Next Page Button -->
            <button 
                type="button"
                class="btn btn-xs gap-1 font-bold border transition-all"
                :class="currentPage >= totalPages || isLoading 
                    ? 'bg-base-300/40 text-base-content/40 border-base-content/15 cursor-not-allowed' 
                    : 'btn-primary text-primary-content border-primary shadow-xs hover:brightness-110'"
                :disabled="currentPage >= totalPages || isLoading"
                @click="goToPage(currentPage + 1)"
                title="Next Page"
            >
                <span class="hidden sm:inline">Next</span>
                <Icon icon="solar:alt-arrow-right-linear" class="w-3.5 h-3.5" />
            </button>

            <!-- Jump to Last Page -->
            <button 
                type="button"
                class="btn btn-xs btn-ghost btn-circle font-bold transition-colors"
                :class="currentPage >= totalPages || isLoading ? 'text-base-content/30 cursor-not-allowed' : 'text-base-content hover:text-primary hover:bg-primary/15'"
                :disabled="currentPage >= totalPages || isLoading"
                @click="goToPage(totalPages)"
                title="Last Page"
            >
                <Icon icon="solar:double-alt-arrow-right-bold" class="w-3.5 h-3.5" />
            </button>

            <div class="h-4 w-px bg-base-content/20 shrink-0"></div>

            <!-- Page Size Selector -->
            <div class="relative shrink-0">
                <select 
                    :value="pageSize" 
                    @change="onPageSizeChange($event.target.value)"
                    class="select select-xs select-bordered bg-base-200 dark:bg-base-300 text-base-content font-mono font-bold text-xs rounded-xl border-base-content/25 hover:border-primary focus:border-primary shadow-xs pr-6 pl-2"
                    title="Items per page"
                    :disabled="isLoading"
                >
                    <option v-for="opt in pageSizeOptions" :key="opt" :value="opt">{{ opt }} / page</option>
                </select>
            </div>
        </div>
    </Transition>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue';
import { Icon } from '@iconify/vue';

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
    pageSize: {
        type: Number,
        default: 50
    },
    pageSizeOptions: {
        type: Array,
        default: () => [25, 50, 100, 250]
    },
    selectedCount: {
        type: Number,
        default: 0
    },
    isLoading: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits([
    'update:currentPage',
    'update:pageSize',
    'scroll-top',
    'first',
    'prev',
    'next',
    'last'
]);

// Jumping to a page directly via inline input
const isJumping = ref(false);
const jumpTarget = ref(props.currentPage);
const jumpInputRef = ref(null);

const itemRangeText = computed(() => {
    if (props.totalItems === 0) return '0–0';
    const start = (props.currentPage - 1) * props.pageSize + 1;
    const end = Math.min(props.currentPage * props.pageSize, props.totalItems);
    return `${start.toLocaleString()}–${end.toLocaleString()}`;
});

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

const onScrollTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    emit('scroll-top');
};

const toggleJumpInput = async () => {
    if (isJumping.value) return;
    jumpTarget.value = props.currentPage;
    isJumping.value = true;
    await nextTick();
    if (jumpInputRef.value) {
        jumpInputRef.value.focus();
        jumpInputRef.value.select();
    }
};

const submitJump = () => {
    if (!isJumping.value) return;
    isJumping.value = false;
    if (jumpTarget.value && !isNaN(jumpTarget.value)) {
        goToPage(parseInt(jumpTarget.value, 10));
    }
};

const cancelJump = () => {
    isJumping.value = false;
};
</script>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
    opacity: 0;
    transform: translate(-50%, 20px);
}
</style>

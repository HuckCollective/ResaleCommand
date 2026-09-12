<template>
  <div 
    class="fixed bottom-0 inset-x-0 z-40 bg-base-100/95 dark:bg-base-200/95 backdrop-blur-2xl border-t border-base-300 shadow-[0_-4px_25px_rgba(0,0,0,0.18)] select-none pointer-events-auto flex flex-col pb-[env(safe-area-inset-bottom,0px)]"
  >
    <!-- ========================================================================= -->
    <!-- TIER 1: SLIM PAGE TOOLS DOCK (TOP STRIP)                                   -->
    <!-- ========================================================================= -->
    <div class="border-b border-base-content/15 bg-base-200 dark:bg-base-300 py-1 px-3 flex items-center justify-center text-xs shadow-2xs">
      <div class="max-w-xl w-full mx-auto flex items-center justify-between sm:justify-center gap-1 sm:gap-2">
        <!-- Scroll to Top & Filtered Total Rows Trigger -->
        <button 
          type="button"
          class="btn btn-xs h-7 px-2.5 bg-base-100 dark:bg-base-100 border border-base-content/25 text-base-content hover:text-primary hover:border-primary/50 hover:bg-primary/10 transition-all active:scale-95 gap-1 shrink-0 shadow-2xs font-mono rounded-lg"
          @click="onScrollTop"
          :title="isFiltered ? `Scroll to top (${totalItems.toLocaleString()} matching filters)` : `Scroll to top (${totalItems.toLocaleString()} total ${entityLabel})`"
        >
          <Icon icon="solar:arrow-up-bold" class="w-3.5 h-3.5 text-primary shrink-0" />
          <span class="font-black text-xs text-base-content">{{ totalItems.toLocaleString() }}</span>
          <span class="text-base-content/80 font-sans text-[10px] font-extrabold uppercase tracking-tight">{{ entityLabel }}</span>
        </button>

        <!-- Jump to First Page -->
        <button 
          type="button"
          class="btn btn-xs btn-ghost btn-circle h-7 w-7 font-bold transition-all hidden xs:inline-flex shrink-0"
          :class="currentPage <= 1 || isLoading ? 'opacity-30 cursor-not-allowed' : 'text-base-content hover:text-primary hover:bg-base-100'"
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
          :class="currentPage <= 1 || isLoading ? 'opacity-30 cursor-not-allowed' : 'text-base-content hover:text-primary hover:bg-base-100 active:scale-90'"
          :disabled="currentPage <= 1 || isLoading"
          @click="goToPage(currentPage - 1)"
          title="Previous Page"
        >
          <Icon icon="solar:alt-arrow-left-bold" class="w-3.5 h-3.5" />
        </button>

        <!-- Tactile Page Pill with Direct Numeric Jump -->
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
          :class="currentPage >= totalPages || isLoading ? 'opacity-30 cursor-not-allowed' : 'text-base-content hover:text-primary hover:bg-base-100 active:scale-90'"
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
          :class="currentPage >= totalPages || isLoading ? 'opacity-30 cursor-not-allowed' : 'text-base-content hover:text-primary hover:bg-base-100'"
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

    <!-- ========================================================================= -->
    <!-- TIER 2: DAISYUI SEMANTIC DOCK (BOTTOM STRIP - THUMB ZONE)                  -->
    <!-- ========================================================================= -->
    <div class="max-w-xl w-full mx-auto">
      <div class="dock dock-sm !static !bg-transparent !border-t-0 !shadow-none !h-14 px-2 py-1 gap-1.5 sm:gap-2">
        <slot name="dock" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue';
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
    default: () => [25, 50, 100, 200]
  },
  isLoading: {
    type: Boolean,
    default: false
  },
  entityLabel: {
    type: String,
    default: 'rows'
  },
  isFiltered: {
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

// Direct jump page input state
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
</script>

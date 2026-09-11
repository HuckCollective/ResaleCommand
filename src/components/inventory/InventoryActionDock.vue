<template>
    <Transition name="slide-up">
        <div 
            v-if="selectedCount > 0"
            class="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-auto max-w-[96vw] overflow-x-auto scrollbar-none bg-base-100/95 backdrop-blur-md border-2 border-primary shadow-2xl rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 flex items-center gap-2 sm:gap-3 text-xs select-none"
        >
            <!-- Selected Badge Counter -->
            <div class="flex items-center gap-1.5 font-bold text-primary shrink-0 pr-2 border-r border-base-300">
                <Icon icon="solar:check-circle-bold" class="w-4 h-4 text-primary" />
                <span>{{ selectedCount }} Selected</span>
            </div>

            <!-- Action: Bulk Location Move -->
            <div class="join shrink-0">
                <select v-model="targetLocation" class="select select-xs select-bordered join-item bg-base-100 text-xs font-bold max-w-32">
                    <option value="" disabled selected>Move Location...</option>
                    <option v-for="loc in locations" :key="loc" :value="loc">{{ loc }}</option>
                </select>
                <button 
                    class="btn btn-xs btn-primary text-primary-content border-primary join-item font-bold" 
                    @click="onApplyLocation" 
                    :disabled="!targetLocation || isProcessing"
                >
                    Apply
                </button>
            </div>

            <!-- Action: Bulk Status Update -->
            <div class="join shrink-0">
                <select v-model="targetStatus" class="select select-xs select-bordered join-item bg-base-100 text-xs font-bold max-w-28">
                    <option value="" disabled selected>Set Status...</option>
                    <option value="acquired">Acquired</option>
                    <option value="received">Received</option>
                    <option value="placed">Placed</option>
                    <option value="sold">Sold</option>
                </select>
                <button 
                    class="btn btn-xs btn-secondary text-secondary-content border-secondary join-item font-bold" 
                    @click="onApplyStatus" 
                    :disabled="!targetStatus || isProcessing"
                >
                    Apply
                </button>
            </div>

            <!-- Action: Export Dropdown -->
            <div class="dropdown dropdown-top dropdown-end shrink-0">
                <button tabindex="0" class="btn btn-xs btn-success text-success-content border-success gap-1 font-bold shadow-xs">
                    <Icon icon="solar:file-download-linear" class="w-3.5 h-3.5" /> Export ▾
                </button>
                <ul tabindex="0" class="dropdown-content z-50 menu p-1.5 shadow-xl bg-base-100 rounded-box w-52 border border-base-200 text-xs font-bold space-y-0.5">
                    <li><a @click="$emit('export', 'ricochet')">Memory Den (Ricochet)</a></li>
                    <li><a @click="$emit('export', 'ebay')">eBay Seller Hub</a></li>
                    <li><a @click="$emit('export', 'poshmark')">Poshmark</a></li>
                    <div class="divider my-0.5"></div>
                    <li><a @click="$emit('export', 'generic')">Generic CSV</a></li>
                </ul>
            </div>

            <!-- Clear Selection Button -->
            <button 
                class="btn btn-xs btn-ghost text-error shrink-0 font-bold hover:bg-error/10" 
                @click="$emit('clear')"
                title="Clear selection"
            >
                ✕ Clear
            </button>
        </div>
    </Transition>
</template>

<script setup>
import { ref } from 'vue';
import { Icon } from '@iconify/vue';

const props = defineProps({
    selectedCount: {
        type: Number,
        default: 0
    },
    locations: {
        type: Array,
        default: () => []
    },
    isProcessing: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['apply-location', 'apply-status', 'export', 'clear']);

const targetLocation = ref('');
const targetStatus = ref('');

const onApplyLocation = () => {
    if (!targetLocation.value) return;
    emit('apply-location', targetLocation.value);
    targetLocation.value = '';
};

const onApplyStatus = () => {
    if (!targetStatus.value) return;
    emit('apply-status', targetStatus.value);
    targetStatus.value = '';
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

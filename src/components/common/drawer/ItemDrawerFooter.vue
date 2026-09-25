<template>
    <div class="p-3 sm:px-6 pb-safe border-t border-base-300 flex flex-row justify-between items-center bg-base-200/90 backdrop-blur-md shadow-lg gap-3 shrink-0 select-none">
        <div class="flex items-center gap-2">
            <!-- AI Button (Speed Scout for unacquired vs AI Deep Research / Playbook for acquired) -->
            <button 
                type="button"
                class="btn btn-secondary text-secondary-content btn-sm shadow-xs gap-1.5 font-bold hover:scale-105 active:scale-95 transition-all" 
                @click="emit('analyze')" 
                :disabled="analyzing || !canAnalyze"
                :title="isAcquired ? 'Run full multimodal deep scan & lot exit playbook' : 'Run quick Speed Scout AI for rapid appraisal'"
            >
                <span v-if="analyzing" class="loading loading-spinner loading-xs"></span>
                <Icon v-else :icon="isAcquired ? 'solar:magic-stick-3-bold' : 'solar:bolt-bold'" class="w-4 h-4" />
                <span class="hidden sm:inline">
                    {{ analyzing ? (analysisStatus || 'Analyzing...') : (isAcquired ? (hasScoutResult ? '⚡ Re-Run Deep Research' : '✨ AI Deep Research') : (hasScoutResult ? '⚡ Re-Scout (Fast)' : '⚡ Speed Scout AI')) }}
                </span>
                <span class="sm:hidden">{{ analyzing ? 'Scouting...' : (isAcquired ? 'Deep Research' : 'Speed Scout') }}</span>
            </button>
        </div>

        <div class="flex items-center gap-2">
            <button type="button" class="btn btn-ghost btn-sm font-semibold" @click="emit('cancel')">Cancel</button>
            <button 
                type="button" 
                class="btn btn-primary text-primary-content btn-sm font-black px-6 shadow-md border border-primary-content/25 active:scale-95 transition-all" 
                @click="emit('save')" 
                :disabled="processing"
            >
                <span v-if="processing" class="loading loading-spinner loading-xs mr-1"></span>
                <Icon v-else icon="solar:diskette-bold" class="w-4 h-4 mr-1" />
                Save Item
            </button>
        </div>
    </div>
</template>

<script setup>
import { Icon } from '@iconify/vue';

defineProps({
    currentTab: {
        type: String,
        default: 'details'
    },
    item: {
        type: Object,
        default: () => ({})
    },
    editForm: {
        type: Object,
        default: () => ({})
    },
    analyzing: {
        type: Boolean,
        default: false
    },
    analysisStatus: {
        type: String,
        default: ''
    },
    hasScoutResult: {
        type: Boolean,
        default: false
    },
    canAnalyze: {
        type: Boolean,
        default: true
    },
    processing: {
        type: Boolean,
        default: false
    },
    isAcquired: {
        type: Boolean,
        default: true
    }
});

const emit = defineEmits(['analyze', 'cancel', 'save']);
</script>

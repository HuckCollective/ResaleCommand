<template>
    <div class="p-3 sm:px-6 pb-safe border-t border-base-300 flex flex-row justify-between items-center bg-base-200/90 backdrop-blur-md z-30 shadow-lg gap-3 shrink-0">
        <div class="flex items-center gap-2">
            <button 
                class="btn btn-secondary btn-sm shadow-xs gap-1.5 font-bold hover:scale-105 transition-all" 
                @click="emit('analyze')" 
                :disabled="analyzing || !canAnalyze"
            >
                <span v-if="analyzing" class="loading loading-spinner loading-xs"></span>
                <Icon v-else icon="solar:magic-stick-3-bold" class="w-4 h-4" />
                <span class="hidden sm:inline">{{ analyzing ? (analysisStatus || 'Analyzing...') : (hasScoutResult ? '⚡ Re-Run AI Research' : '✨ AI Deep Research') }}</span>
                <span class="sm:hidden">{{ analyzing ? 'Scouting...' : 'AI Research' }}</span>
            </button>
        </div>

        <div class="flex items-center gap-2">
            <button class="btn btn-ghost btn-sm" @click="emit('cancel')">Cancel</button>
            <button class="btn btn-primary btn-sm font-bold px-6 shadow-md" @click="emit('save')" :disabled="processing">
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
    }
});

const emit = defineEmits(['analyze', 'cancel', 'save']);
</script>

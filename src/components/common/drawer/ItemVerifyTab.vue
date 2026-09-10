<template>
    <div class="space-y-5">
        <div class="alert alert-info py-2 shadow-sm text-xs sm:text-sm">
            <Icon icon="solar:smart-speaker-minimalistic-linear" class="w-5 h-5 shrink-0" />
            <span>Photograph the back-of-box contents list to automatically generate an item checklist.</span>
        </div>

        <ScannerWidget @photos-captured="emit('photos-captured', $event)" :hide-upload="false" />

        <div v-if="extracting" class="flex flex-col items-center py-10">
            <span class="loading loading-spinner text-primary w-10 h-10 mb-3"></span>
            <p class="font-bold text-xs opacity-70">AI is extracting components from photos...</p>
        </div>

        <div v-if="componentsList && componentsList.length > 0" class="space-y-2">
            <div class="flex justify-between items-center mb-1">
                <span class="font-bold text-xs uppercase tracking-wider">Verification Checklist</span>
                <button class="btn btn-xs btn-ghost text-error" @click="emit('clear')">Clear</button>
            </div>
            <div v-for="(comp, idx) in componentsList" :key="idx" class="flex items-center gap-3 bg-base-200 p-3 rounded-xl border border-base-300">
                <input 
                    type="checkbox" 
                    v-model="comp.verified" 
                    class="checkbox checkbox-primary checkbox-sm" 
                    @change="handleVerifiedToggle(comp)" 
                />
                <div class="flex-1 min-w-0 font-bold text-xs truncate" :class="{'line-through opacity-50': comp.verified}">{{ comp.name }}</div>
                <div class="flex items-center gap-1.5 bg-base-100 rounded-lg p-1 border border-base-300 font-mono text-xs">
                    <button class="btn btn-xs btn-circle btn-ghost" @click="comp.found = Math.max(0, comp.found - 1)">-</button>
                    <span class="w-8 text-center font-bold">{{ comp.found }} / {{ comp.expected }}</span>
                    <button class="btn btn-xs btn-circle btn-ghost" @click="comp.found++">+</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { Icon } from '@iconify/vue';
import ScannerWidget from '../ScannerWidget.vue';

defineProps({
    componentsList: {
        type: Array,
        default: () => []
    },
    extracting: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['photos-captured', 'clear']);

const handleVerifiedToggle = (comp) => {
    if (comp.verified && comp.found < comp.expected) {
        comp.found = comp.expected;
    }
};
</script>

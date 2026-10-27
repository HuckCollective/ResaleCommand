<template>
    <div class="space-y-5">
        <div class="alert alert-info py-2 shadow-sm text-xs sm:text-sm">
            <Icon icon="solar:smart-speaker-minimalistic-linear" class="w-5 h-5 shrink-0" />
            <span>Photograph the back-of-box contents list to automatically generate an item checklist.</span>
        </div>

        <button
            v-if="hasGalleryPhotos"
            type="button"
            class="btn btn-sm btn-primary btn-outline w-full gap-1.5 font-bold"
            :disabled="extracting"
            @click="emit('extract-from-gallery')"
        >
            <Icon icon="solar:gallery-wide-bold" class="w-4 h-4" />
            <span>Extract Checklist from Item Gallery Photos</span>
        </button>

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
                    <button class="btn btn-xs btn-circle btn-ghost" @click="comp.found = Math.max(0, foundOf(comp) - 1)">-</button>
                    <span class="min-w-8 px-1 text-center font-bold whitespace-nowrap">{{ foundOf(comp) }} / {{ expectedOf(comp) }}</span>
                    <button class="btn btn-xs btn-circle btn-ghost" @click="comp.found = foundOf(comp) + 1">+</button>
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
    },
    hasGalleryPhotos: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['photos-captured', 'clear', 'extract-from-gallery']);

const foundOf = (comp) => Number(comp?.found) || 0;
const expectedOf = (comp) => Number(comp?.expected ?? comp?.quantity) || 1;

const handleVerifiedToggle = (comp) => {
    if (comp.verified && foundOf(comp) < expectedOf(comp)) {
        comp.found = expectedOf(comp);
    }
};
</script>

<template>
    <div 
        class="relative overflow-hidden bg-base-200/60 flex items-center justify-center shrink-0 select-none border border-base-200/50"
        :class="[roundedClass, containerClass]"
    >
        <!-- Actual Image -->
        <img 
            v-if="resolvedUrl && !hasError"
            :src="resolvedUrl" 
            :alt="alt || item?.title || 'Item image'"
            class="w-full h-full object-cover transition-opacity duration-150"
            loading="lazy"
            @error="onError"
            @load="onLoad"
        />

        <!-- Placeholder Icon (shown when no image provided or on image load error) -->
        <div 
            v-else
            class="w-full h-full flex flex-col items-center justify-center p-1 text-base-content/30 bg-base-300/40"
            :title="hasError ? 'Image unavailable' : 'No image provided'"
        >
            <Icon :icon="placeholderIcon" :class="iconSizeClass" />
            <span v-if="showNoImageText" class="text-[9px] font-bold tracking-tight opacity-70 mt-0.5 uppercase">No Photo</span>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { getItemImageUrl } from '../../composables/useInventoryFilters';

const props = defineProps({
    item: {
        type: Object,
        default: null
    },
    src: {
        type: String,
        default: ''
    },
    alt: {
        type: String,
        default: ''
    },
    size: {
        type: String,
        default: 'sm' // 'xs' (24px), 'sm' (36px), 'md' (48px), 'lg' (64px), 'xl' (96px), 'full'
    },
    rounded: {
        type: String,
        default: 'lg' // 'none', 'sm', 'md', 'lg', 'xl', 'full'
    },
    placeholderIcon: {
        type: String,
        default: 'solar:box-minimalistic-linear'
    },
    showNoImageText: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['error', 'load']);

const hasError = ref(false);

const resolvedUrl = computed(() => {
    if (props.src) return props.src;
    if (props.item) return getItemImageUrl(props.item, 120);
    return null;
});

// Reset error state when image URL changes
watch(resolvedUrl, () => {
    hasError.value = false;
});

const onError = (e) => {
    hasError.value = true;
    emit('error', e);
};

const onLoad = (e) => {
    emit('load', e);
};

// CSS Classes
const containerClass = computed(() => {
    switch (props.size) {
        case 'xs': return 'w-6 h-6';
        case 'sm': return 'w-9 h-9';
        case 'md': return 'w-12 h-12';
        case 'lg': return 'w-16 h-16';
        case 'xl': return 'w-24 h-24';
        case 'full': return 'w-full h-full';
        default: return props.size.includes('w-') ? props.size : 'w-9 h-9';
    }
});

const iconSizeClass = computed(() => {
    switch (props.size) {
        case 'xs': return 'w-3 h-3';
        case 'sm': return 'w-4 h-4';
        case 'md': return 'w-6 h-6';
        case 'lg': return 'w-7 h-7';
        case 'xl': return 'w-10 h-10';
        case 'full': return 'w-8 h-8';
        default: return 'w-4 h-4';
    }
});

const roundedClass = computed(() => {
    switch (props.rounded) {
        case 'none': return 'rounded-none';
        case 'sm': return 'rounded-sm';
        case 'md': return 'rounded-md';
        case 'lg': return 'rounded-lg';
        case 'xl': return 'rounded-xl';
        case 'full': return 'rounded-full';
        default: return 'rounded-lg';
    }
});
</script>

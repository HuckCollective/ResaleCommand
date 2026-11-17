<template>
    <div 
        class="relative overflow-hidden bg-base-200/60 flex items-center justify-center shrink-0 select-none border border-base-200/50"
        :class="[roundedClass, containerClass]"
    >
        <!-- Actual Image (with 2-Stage /preview -> /view + galleryImageIds @error Fallback — Invariant #3) -->
        <img 
            v-if="resolvedUrl && !hasError"
            :src="resolvedUrl" 
            :alt="alt || item?.title || 'Item image'"
            class="w-full h-full object-cover transition-opacity duration-150"
            loading="lazy"
            @error="onError"
            @load="onLoad"
        />

        <!-- Placeholder Icon (shown when no image provided or after all fallback stages fail) -->
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
import { getAssetUrl } from '../../lib/inventory';

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
        default: 'sm' // 'xs' (24px), 'sm' (36px), 'md' (48px), 'lg' (64px), 'xl' (96px), 'full', or custom 'w-* h-*'
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
const candidateIdx = ref(0);
const useRawView = ref(false);

const pixelSize = computed(() => {
    switch (props.size) {
        case 'xs': return 64;
        case 'sm': return 96;
        case 'md': return 120;
        case 'lg': return 160;
        case 'xl': return 240;
        case 'full': return 400;
        default: return 120;
    }
});

function extractAppwriteFileIdFromUrl(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const match = raw.match(/\/storage\/buckets\/[^/]+\/files\/([^/?#]+)\/(?:preview|view)/i);
    return match && match[1] ? match[1] : null;
}

const candidates = computed(() => {
    const out = [];
    const pushUnique = (val) => {
        if (!val || typeof val !== 'string') return;
        const trimmed = val.trim();
        if (!trimmed) return;
        const extractedId = extractAppwriteFileIdFromUrl(trimmed);
        const normalized = extractedId || trimmed;
        if (!out.includes(normalized)) {
            out.push(normalized);
        }
    };

    if (props.src) {
        pushUnique(props.src);
    }

    const itm = props.item;
    if (itm && typeof itm === 'object') {
        pushUnique(itm.imageId);
        if (Array.isArray(itm.galleryImageIds)) {
            for (const gid of itm.galleryImageIds) pushUnique(gid);
        }
        pushUnique(itm.image);
        pushUnique(itm.imageUrl);
        pushUnique(itm.thumbnailUrl);
        if (Array.isArray(itm.images)) {
            for (const img of itm.images) pushUnique(img);
        }
        pushUnique(itm.fetched_image);
        if (Array.isArray(itm.fetched_images)) {
            for (const fImg of itm.fetched_images) pushUnique(fImg);
        }
        if (itm.rawAnalysis) {
            try {
                const raw = typeof itm.rawAnalysis === 'string' ? JSON.parse(itm.rawAnalysis) : itm.rawAnalysis;
                const target = Array.isArray(raw) ? raw[0] : (raw?.items ? raw.items[0] : raw);
                pushUnique(target?.fetched_image || target?.fetched_images?.[0] || target?.image);
            } catch {}
        }
        if (typeof itm.conditionNotes === 'string') {
            const match = itm.conditionNotes.match(/\[MAIN IMAGE ID:\s*([^\]]+)\]/);
            if (match && match[1]) {
                for (const id of match[1].split(',')) pushUnique(id);
            }
        }
    }

    return out;
});

// Reset fallback state ONLY when the underlying candidate signature changes (never on stage transitions)
const candidatesSignature = computed(() => candidates.value.join('|'));
watch(candidatesSignature, () => {
    hasError.value = false;
    candidateIdx.value = 0;
    useRawView.value = false;
});

const activeCandidate = computed(() => candidates.value[candidateIdx.value] || '');

const previewUrl = computed(() => {
    if (!activeCandidate.value) return '';
    return getAssetUrl(activeCandidate.value, {
        preview: true,
        width: pixelSize.value,
        height: pixelSize.value
    });
});

const rawViewUrl = computed(() => {
    if (!activeCandidate.value) return '';
    return getAssetUrl(activeCandidate.value, { preview: false });
});

const resolvedUrl = computed(() => {
    if (!activeCandidate.value) return null;
    return useRawView.value ? rawViewUrl.value : previewUrl.value;
});

const onError = (e) => {
    // Stage 1 -> Stage 2: Retry raw /view if it differs from /preview (Appwrite transform fallback)
    if (!useRawView.value && rawViewUrl.value && rawViewUrl.value !== previewUrl.value) {
        useRawView.value = true;
        return;
    }
    // Stage 2 -> Stage 3: Advance to next valid ID in galleryImageIds / candidates
    if (candidateIdx.value + 1 < candidates.value.length) {
        candidateIdx.value += 1;
        useRawView.value = false;
        return;
    }
    // Stage 4: Terminal fallback to semantic icon placeholder
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

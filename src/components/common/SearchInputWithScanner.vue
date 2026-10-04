<template>
    <div :class="['relative flex items-center w-full', containerClass]">
        <!-- Search Leading Icon -->
        <Icon 
            :icon="iconName" 
            :class="[
                'absolute pointer-events-none opacity-40 transition-colors',
                size === 'sm' ? 'left-3 w-3.5 h-3.5' : 'left-3.5 w-4 h-4',
                iconClass
            ]" 
        />

        <!-- Input Field -->
        <input 
            ref="inputRef"
            type="text" 
            :value="modelValue" 
            @input="handleInput"
            @keydown.esc="handleClear"
            :placeholder="placeholder" 
            :class="[
                'input input-bordered w-full font-sans transition-all shadow-inner',
                size === 'sm' ? 'input-sm pl-8 pr-16 text-xs h-9 min-h-9 rounded-lg' : 'pl-10 pr-18 text-xs sm:text-sm h-10 min-h-10 rounded-xl',
                inputClass || 'bg-base-200/50 hover:bg-base-200/70 focus:bg-base-100 border-base-300 focus:border-primary'
            ]"
            :autofocus="autofocus"
            :disabled="disabled"
        />

        <!-- Trailing Action Buttons (Clear + Camera Scanner) -->
        <div class="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            <!-- Clear Button -->
            <button 
                v-if="modelValue" 
                type="button"
                @click="handleClear" 
                class="btn btn-ghost btn-circle btn-xs opacity-60 hover:opacity-100 w-6 h-6 min-h-6 flex items-center justify-center font-bold text-xs"
                title="Clear search"
                aria-label="Clear search"
            >
                ✕
            </button>

            <!-- Camera Scanner Trigger Button -->
            <button 
                type="button"
                @click="isScannerOpen = true"
                class="btn btn-ghost btn-circle btn-xs text-primary hover:bg-primary/10 transition-colors flex items-center justify-center"
                :class="size === 'sm' ? 'w-6 h-6 min-h-6' : 'w-7 h-7 min-h-7'"
                :title="scannerButtonTitle"
                :aria-label="scannerButtonTitle"
            >
                <Icon icon="solar:camera-linear" :class="size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'" />
            </button>
        </div>

        <!-- Integrated Barcode & Mini QR Scanner Modal -->
        <BarcodeScannerModal 
            :is-open="isScannerOpen"
            :title="scannerTitle"
            :subtitle="scannerSubtitle"
            :mode="scannerMode"
            @close="isScannerOpen = false"
            @scan="handleScannedCode"
        />
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Icon } from '@iconify/vue';
import BarcodeScannerModal from './BarcodeScannerModal.vue';
import type { ScannedResult } from './BarcodeScannerModal.vue';

interface Props {
    modelValue: string;
    placeholder?: string;
    size?: 'sm' | 'md';
    scannerTitle?: string;
    scannerSubtitle?: string;
    scannerMode?: 'single' | 'continuous';
    scannerButtonTitle?: string;
    iconName?: string;
    inputClass?: string;
    containerClass?: string;
    iconClass?: string;
    autofocus?: boolean;
    disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    placeholder: 'Search by title, SKU, UPC...',
    size: 'md',
    scannerTitle: 'Scan Barcode or Mini QR',
    scannerSubtitle: 'Point camera at any tag or sticker',
    scannerMode: 'single',
    scannerButtonTitle: 'Scan Barcode or Mini QR with Camera',
    iconName: 'solar:magnifer-linear',
    inputClass: '',
    containerClass: '',
    iconClass: '',
    autofocus: false,
    disabled: false
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
    (e: 'scan', result: ScannedResult): void;
    (e: 'clear'): void;
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const isScannerOpen = ref(false);

function handleInput(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    emit('update:modelValue', val);
}

function handleClear() {
    emit('update:modelValue', '');
    emit('clear');
    inputRef.value?.focus();
}

function handleScannedCode(result: ScannedResult) {
    if (result && result.rawValue) {
        emit('update:modelValue', result.rawValue);
        emit('scan', result);
    }
}

defineExpose({
    focus: () => inputRef.value?.focus(),
    openScanner: () => { isScannerOpen.value = true; },
    closeScanner: () => { isScannerOpen.value = false; }
});
</script>

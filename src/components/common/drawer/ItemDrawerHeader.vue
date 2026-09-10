<template>
    <div class="px-4 py-3 sm:px-6 border-b border-base-200 flex justify-between items-center bg-base-100 flex-none sticky top-0 z-30">
        <div class="flex items-center gap-2 min-w-0">
            <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Icon :icon="item ? 'solar:pen-bold' : 'solar:box-minimalistic-bold'" class="w-4 h-4" />
            </div>
            <div class="min-w-0">
                <h3 class="font-bold text-base sm:text-lg leading-tight truncate">
                    {{ item ? 'Edit Item' : 'Add New Item' }}
                </h3>
                <div class="text-[11px] opacity-60 truncate flex items-center gap-1 font-mono">
                    <span>{{ item?.$id ? `ID: ${item.$id.substring(0, 12)}...` : 'Creating Draft' }}</span>
                    <span v-if="item?.tenantId" class="badge badge-ghost badge-xs scale-90">{{ item.tenantId }}</span>
                </div>
            </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
            <!-- UPC Badge -->
            <div v-if="item?.upc" class="hidden sm:flex items-center gap-1.5 text-xs font-mono bg-base-200 rounded-md px-2.5 py-1 border border-base-300">
                <Icon icon="solar:tag-horizontal-bold-duotone" class="w-3.5 h-3.5 text-primary" />
                <span class="font-bold tracking-wider">{{ item.upc }}</span>
            </div>
            <button class="btn btn-sm btn-circle btn-ghost" @click="emit('close')" aria-label="Close Drawer">✕</button>
        </div>
    </div>
</template>

<script setup>
import { Icon } from '@iconify/vue';

defineProps({
    item: {
        type: Object,
        default: null
    }
});

const emit = defineEmits(['close']);
</script>

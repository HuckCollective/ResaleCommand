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
            <!-- Needs Shop Update Reminder & 1-Click Dismiss -->
            <div v-if="hasShopUpdateReminder" class="flex items-center gap-1.5 bg-warning/15 border border-warning/40 rounded-lg px-2 py-1">
                <span class="badge badge-warning badge-xs font-bold gap-1 py-1 text-[10px] shadow-xs">
                    <Icon icon="solar:danger-triangle-bold" class="w-3 h-3 text-warning-content" />
                    Needs Shop Update
                </span>
                <button 
                    type="button" 
                    class="btn btn-xs btn-success text-[10px] h-6 min-h-0 px-2 font-bold gap-1 shadow-xs"
                    @click.stop="emit('dismiss-shop-update')"
                    title="Click when you have updated this item's UPC in Ricochet / shop UI"
                >
                    <Icon icon="solar:check-circle-bold" class="w-3 h-3" />
                    Mark Shop Updated
                </button>
            </div>

            <!-- Optional Quick Flag when not set -->
            <button
                v-else-if="item?.$id"
                type="button"
                class="btn btn-xs btn-ghost border border-dashed border-base-300 text-base-content/60 hover:text-base-content hover:border-base-content/40 text-[10px] h-6 min-h-0 px-2 hidden sm:inline-flex items-center gap-1"
                @click.stop="emit('flag-shop-update')"
                title="Flag this item to remind yourself to update its barcode in Ricochet POS"
            >
                <Icon icon="solar:bell-linear" class="w-3 h-3" />
                Remind Shop Update
            </button>

            <!-- Multi-Quantity Stock Badge -->
            <div v-if="itemQty > 1" class="hidden sm:flex items-center gap-1 text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-md px-2 py-1 shadow-2xs" :title="`Batch listing with ${itemQty} units`">
                <Icon icon="solar:box-minimalistic-bold" class="w-3.5 h-3.5 text-amber-500" />
                <span>{{ itemQty }} in Stock</span>
            </div>

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
import { computed } from 'vue';
import { Icon } from '@iconify/vue';

const props = defineProps({
    item: {
        type: Object,
        default: null
    },
    editForm: {
        type: Object,
        default: () => ({})
    }
});

const emit = defineEmits(['close', 'dismiss-shop-update', 'flag-shop-update']);

const itemQty = computed(() => {
    return Math.max(1, Number(props.editForm?.quantity || props.item?.quantity || 1));
});

const hasShopUpdateReminder = computed(() => {
    const itemFlags = Array.isArray(props.item?.redFlags) ? props.item.redFlags : [];
    const formFlags = Array.isArray(props.editForm?.redFlags) ? props.editForm.redFlags : [];
    const inFlags = itemFlags.includes('needs_shop_update') || formFlags.includes('needs_shop_update');
    const inNotes = typeof props.item?.conditionNotes === 'string' && props.item.conditionNotes.includes('[NEEDS_SHOP_UPDATE]');
    return inFlags || inNotes;
});
</script>

<template>
    <div class="form-control w-full relative">
        <label v-if="label" class="label"><span class="label-text">{{ label }}</span></label>
        
        <div class="dropdown w-full">
            <div tabindex="0" role="button" class="input input-sm w-full input-bordered flex items-center justify-between bg-base-100 min-h-8 h-auto py-1">
                <div class="flex gap-1 flex-wrap truncate items-center">
                    <span v-if="modelValue.length === 0" class="opacity-50 text-xs">{{ placeholder || 'Select channels...' }}</span>
                    <span v-for="tag in modelValue" :key="tag" class="badge badge-primary badge-sm gap-1 flex items-center">
                        {{ tag }}
                        <button @click.prevent.stop="toggleOption(tag)" class="hover:text-error hover:font-bold ml-1 flex items-center justify-center rounded-full hover:bg-black/10 w-3 h-3 min-h-0 text-[8px]">✕</button>
                    </span>
                </div>
                <Icon icon="solar:alt-arrow-down-linear" class="w-4 h-4 opacity-50 shrink-0" />
            </div>
            
            <ul tabindex="0" class="dropdown-content z-[100] menu p-2 shadow-xl bg-base-100 rounded-box w-full max-h-64 flex-nowrap overflow-y-auto border border-base-300 mt-1">
                <li v-for="opt in defaultOptions" :key="opt">
                    <label class="label cursor-pointer flex justify-start gap-3 py-1.5 px-2">
                        <input type="checkbox" class="checkbox checkbox-primary checkbox-sm" 
                            :checked="modelValue.includes(opt)"
                            @change="toggleOption(opt)" />
                        <span class="label-text">{{ opt }}</span>
                    </label>
                </li>
                
                <div class="divider my-1"></div>
                <li class="px-2 py-1">
                    <form @submit.prevent="addCustom" class="flex gap-2 w-full">
                        <input type="text" v-model="customInput" placeholder="Add custom channel..." class="input input-xs input-bordered flex-1 w-full" />
                        <button type="submit" class="btn btn-xs btn-primary">+</button>
                    </form>
                </li>
            </ul>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Icon } from '@iconify/vue';

const props = defineProps<{
    modelValue: string[];
    label?: string;
    placeholder?: string;
    options?: string[];
}>();

const emit = defineEmits(['update:modelValue']);

const defaultOptions = computed(() => {
    const opts = props.options || [
        'eBay', 'Mercari', 'Poshmark', 'Facebook Marketplace', 
        'Antique Mall', 'Storefront', 'Depop', 'Etsy', 'Grailed', 'OfferUp'
    ];
    // Also include any custom ones already in modelValue
    const all = new Set([...opts, ...props.modelValue]);
    return Array.from(all);
});

const customInput = ref('');

const toggleOption = (opt: string) => {
    const updated = [...props.modelValue];
    const idx = updated.indexOf(opt);
    if (idx > -1) {
        updated.splice(idx, 1);
    } else {
        updated.push(opt);
    }
    emit('update:modelValue', updated);
};

const addCustom = () => {
    const val = customInput.value.trim();
    if (val && !props.modelValue.includes(val)) {
        const updated = [...props.modelValue, val];
        emit('update:modelValue', updated);
    }
    customInput.value = '';
};
</script>

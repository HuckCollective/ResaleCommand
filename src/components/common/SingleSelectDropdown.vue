<template>
    <div class="form-control w-full relative">
        <label v-if="label" class="label"><span class="label-text" :class="labelClass">{{ label }}</span></label>
        
        <div class="dropdown w-full" ref="dropdownRef">
            <div tabindex="0" role="button" class="input input-bordered w-full flex items-center justify-between bg-base-100 min-h-8 h-auto py-1" :class="inputClass">
                <span v-if="!modelValue" class="opacity-50 text-sm">{{ placeholder || 'Select location...' }}</span>
                <span v-else class="text-sm truncate">{{ modelValue }}</span>
                <Icon icon="solar:alt-arrow-down-linear" class="w-4 h-4 opacity-50 shrink-0" />
            </div>
            
            <ul tabindex="0" class="dropdown-content z-[100] menu p-2 shadow-xl bg-base-100 rounded-box w-full max-h-64 flex-nowrap overflow-y-auto border border-base-300 mt-1">
                <li v-if="options.length === 0" class="disabled opacity-50 px-4 py-2 text-sm">
                    No predefined locations found.
                </li>
                <li v-for="opt in combinedOptions" :key="opt">
                    <a @click.prevent="selectOption(opt)" :class="{'active': modelValue === opt}">{{ opt }}</a>
                </li>
                
                <li v-if="allowCustom" class="px-2 py-1 mt-1 border-t border-base-200 pt-2">
                    <form @submit.prevent="addCustom" class="flex gap-2 w-full">
                        <input type="text" v-model="customInput" placeholder="Custom location..." class="input input-xs input-bordered flex-1 w-full" />
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
    modelValue: string;
    label?: string;
    placeholder?: string;
    options: string[];
    allowCustom?: boolean;
    labelClass?: string;
    inputClass?: string;
}>();

const emit = defineEmits(['update:modelValue']);
const customInput = ref('');
const dropdownRef = ref<HTMLElement | null>(null);

const combinedOptions = computed(() => {
    const opts = [...props.options];
    if (props.modelValue && !opts.includes(props.modelValue)) {
        opts.unshift(props.modelValue);
    }
    return opts;
});

const selectOption = (opt: string) => {
    emit('update:modelValue', opt);
    closeDropdown();
};

const addCustom = () => {
    const val = customInput.value.trim();
    if (val) {
        emit('update:modelValue', val);
    }
    customInput.value = '';
    closeDropdown();
};

const closeDropdown = () => {
    if (dropdownRef.value) {
        const elem = dropdownRef.value.querySelector('[tabindex="0"]') as HTMLElement;
        if (elem) elem.blur();
    }
};
</script>

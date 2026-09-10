<template>
    <div class="w-full min-h-[600px]">
        <Transition name="view-fade" mode="out-in">
            <component 
                :is="activeComponent" 
                :view-mode="viewMode" 
                @update:view-mode="updateView"
            />
        </Transition>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, defineAsyncComponent } from 'vue';

const props = defineProps({
    initialView: {
        type: String,
        default: ''
    }
});

const InventoryTableView = defineAsyncComponent(() => import('./InventoryTableView.vue'));
const InventoryManager = defineAsyncComponent(() => import('./InventoryManager.vue'));

const STORAGE_KEY = 'rc_inventory_view_mode';
const viewMode = ref('table');

const activeComponent = computed(() => {
    return viewMode.value === 'grid' ? InventoryManager : InventoryTableView;
});

const updateView = (newMode) => {
    if (newMode !== 'table' && newMode !== 'grid') return;
    if (viewMode.value === newMode) return;
    viewMode.value = newMode;
    
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem(STORAGE_KEY, newMode);
            const url = new URL(window.location.href);
            url.searchParams.set('view', newMode);
            window.history.replaceState({}, '', url.toString());
        } catch (e) {
            console.warn('Failed to persist inventory view mode preference:', e);
        }
    }
};

onMounted(() => {
    // 1. Explicit prop override
    if (props.initialView === 'table' || props.initialView === 'grid') {
        viewMode.value = props.initialView;
        return;
    }

    if (typeof window !== 'undefined') {
        try {
            // 2. URL search parameter (?view=grid or ?view=table)
            const params = new URLSearchParams(window.location.search);
            const paramView = params.get('view');
            if (paramView === 'table' || paramView === 'grid') {
                viewMode.value = paramView;
                localStorage.setItem(STORAGE_KEY, paramView);
                return;
            }

            // 3. Persisted user preference
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved === 'table' || saved === 'grid') {
                viewMode.value = saved;
                return;
            }
        } catch (e) {
            console.warn('Failed reading inventory view preference:', e);
        }
    }

    // 4. Default to modern high-density spreadsheet table view
    viewMode.value = 'table';
});
</script>

<style scoped>
.view-fade-enter-active,
.view-fade-leave-active {
    transition: opacity 0.15s ease;
}
.view-fade-enter-from,
.view-fade-leave-to {
    opacity: 0;
}
</style>

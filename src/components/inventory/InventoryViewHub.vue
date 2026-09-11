<template>
    <div class="w-full min-h-[600px]">
        <Transition name="view-fade" mode="out-in">
            <component 
                :is="activeComponent" 
                :key="viewMode"
                :view-mode="viewMode" 
                @update:view-mode="updateView"
            />
        </Transition>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onErrorCaptured } from 'vue';
import InventoryTableView from './InventoryTableView.vue';
import InventoryManager from './InventoryManager.vue';

const props = defineProps({
    initialView: {
        type: String,
        default: ''
    }
});

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
            const isMobile = window.innerWidth < 768;
            if (isMobile) {
                localStorage.setItem('rc_inventory_mobile_view', newMode);
            } else {
                localStorage.setItem(STORAGE_KEY, newMode);
            }
            const url = new URL(window.location.href);
            url.searchParams.set('view', newMode);
            window.history.replaceState({}, '', url.toString());
        } catch (e) {
            console.warn('Failed to persist inventory view mode preference:', e);
        }
    }
};

onErrorCaptured((err, instance, info) => {
    console.error('[InventoryViewHub] Error captured in child view:', err, info);
    // Return false to prevent error from propagating and unmounting the entire app tree
    return false;
});

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
                const isMobile = window.innerWidth < 768;
                localStorage.setItem(isMobile ? 'rc_inventory_mobile_view' : STORAGE_KEY, paramView);
                return;
            }

            // 3. Persisted device-specific user preference
            const isMobile = window.innerWidth < 768;
            const saved = localStorage.getItem(isMobile ? 'rc_inventory_mobile_view' : STORAGE_KEY);
            if (saved === 'table' || saved === 'grid') {
                viewMode.value = saved;
                return;
            }

            // 4. Default: Mobile phones (<768px) default to 'grid' (Mobile Feed); Desktop defaults to 'table'
            viewMode.value = isMobile ? 'grid' : 'table';
            return;
        } catch (e) {
            console.warn('Failed reading inventory view preference:', e);
        }
    }

    // 5. Fallback default
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

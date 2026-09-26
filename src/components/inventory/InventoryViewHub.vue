<template>
    <div class="w-full max-w-full min-w-0 min-h-[600px]">
        <div v-if="childError" class="card bg-base-100 border border-error/30 p-6 my-6 text-center space-y-3 max-w-lg mx-auto shadow-lg">
            <div class="text-error font-bold text-lg flex items-center justify-center gap-2">
                <span>Failed to load inventory view</span>
            </div>
            <p class="text-xs opacity-75 font-mono text-error/90">{{ childError }}</p>
            <div class="pt-2">
                <button class="btn btn-sm btn-primary font-bold" @click="retryLoad">Reload View</button>
            </div>
        </div>
        <Transition v-else name="view-fade">
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
import { ref, computed, onErrorCaptured } from 'vue';
import InventoryTableView from './InventoryTableView.vue';
import InventoryManager from './InventoryManager.vue';

const props = defineProps({
    initialView: {
        type: String,
        default: ''
    }
});

const STORAGE_KEY = 'rc_inventory_view_mode';

const resolveInitialViewMode = () => {
    // 1. Explicit prop override
    if (props.initialView === 'table' || props.initialView === 'grid') {
        return props.initialView;
    }

    if (typeof window !== 'undefined') {
        try {
            // 2. URL search parameter (?view=grid or ?view=table)
            const params = new URLSearchParams(window.location.search);
            const paramView = params.get('view');
            if (paramView === 'table' || paramView === 'grid') {
                return paramView;
            }

            // 3. Persisted device-specific user preference
            const isMobile = window.innerWidth < 768;
            const saved = localStorage.getItem(isMobile ? 'rc_inventory_mobile_view' : STORAGE_KEY);
            if (saved === 'table' || saved === 'grid') {
                return saved;
            }

            // 4. Default: Mobile phones (<768px) default to 'grid' (Mobile Feed); Desktop defaults to 'table'
            return isMobile ? 'grid' : 'table';
        } catch (e) {
            console.warn('Failed reading inventory view preference:', e);
        }
    }

    return 'table';
};

const viewMode = ref(resolveInitialViewMode());
const childError = ref(null);

const activeComponent = computed(() => {
    return viewMode.value === 'grid' ? InventoryManager : InventoryTableView;
});

const updateView = (newMode) => {
    if (newMode !== 'table' && newMode !== 'grid') return;
    if (viewMode.value === newMode) return;
    viewMode.value = newMode;
    childError.value = null;
    
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

const retryLoad = () => {
    childError.value = null;
    viewMode.value = resolveInitialViewMode();
};

onErrorCaptured((err, instance, info) => {
    console.error('[InventoryViewHub] Error captured in child view:', err, info);
    childError.value = err?.message || 'An unexpected rendering error occurred.';
    return false;
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

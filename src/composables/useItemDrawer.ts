import { ref } from 'vue';
import { useLotSplitter } from './useLotSplitter';

// Shared global singleton reactive state across all components and views
const isDrawerOpen = ref(false);
const activeDrawerItem = ref<any>(null);

export function useItemDrawer() {
    function openItemDrawer(item: any) {
        if (!item) return;
        // Prevent stacking LotSplitter and ItemDrawer open together
        const { closeLotSplitter } = useLotSplitter();
        closeLotSplitter();
        activeDrawerItem.value = { ...item };
        isDrawerOpen.value = true;
    }

    function closeItemDrawer() {
        isDrawerOpen.value = false;
        activeDrawerItem.value = null;
    }

    return {
        isDrawerOpen,
        activeDrawerItem,
        openItemDrawer,
        closeItemDrawer,
    };
}

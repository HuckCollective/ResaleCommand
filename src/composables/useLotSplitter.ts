import { ref } from 'vue';
import { useItemDrawer } from './useItemDrawer';

// Shared global singleton reactive state across all components and views
const isLotSplitterOpen = ref(false);
const activeLotItem = ref<any>(null);

export function useLotSplitter() {
    function openLotSplitter(item: any) {
        if (!item) return;
        // Prevent stacking LotSplitter and ItemDrawer open together
        const { closeItemDrawer } = useItemDrawer();
        closeItemDrawer();
        activeLotItem.value = { ...item };
        isLotSplitterOpen.value = true;
    }

    function closeLotSplitter() {
        isLotSplitterOpen.value = false;
        activeLotItem.value = null;
    }

    function updateActiveLotItem(updates: Partial<any>) {
        if (!activeLotItem.value) return;
        activeLotItem.value = { ...activeLotItem.value, ...updates };
    }

    return {
        isLotSplitterOpen,
        activeLotItem,
        openLotSplitter,
        closeLotSplitter,
        updateActiveLotItem
    };
}

import { ref } from 'vue';

// Shared global singleton reactive state across all components and views
const isLotSplitterOpen = ref(false);
const activeLotItem = ref<any>(null);

export function useLotSplitter() {
    function openLotSplitter(item: any) {
        if (!item) return;
        activeLotItem.value = { ...item };
        isLotSplitterOpen.value = true;
    }

    function closeLotSplitter() {
        isLotSplitterOpen.value = false;
        activeLotItem.value = null;
    }

    return {
        isLotSplitterOpen,
        activeLotItem,
        openLotSplitter,
        closeLotSplitter,
    };
}

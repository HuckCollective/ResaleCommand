import { ref } from 'vue';

// Shared global singleton reactive state across all components and views
const isDrawerOpen = ref(false);
const activeDrawerItem = ref<any>(null);

export function useItemDrawer() {
    function openItemDrawer(item: any) {
        if (!item) return;
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

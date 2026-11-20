import { ref, computed } from 'vue';
import { useLotSplitter } from './useLotSplitter';
import { useInventory } from './useInventory';

// Shared global singleton reactive state across all components and views
const isDrawerOpen = ref(false);
const activeDrawerItemId = ref<string | null>(null);
const activeDrawerFallback = ref<any>(null);

// Writable computed overlays live itemByIdMap updates onto the open ItemDrawer while staying compatible with activeItem.value = null
const activeDrawerItem = computed<any>({
    get() {
        const id = activeDrawerItemId.value;
        const fallback = activeDrawerFallback.value;
        if (!id) return fallback;
        try {
            const { itemByIdMap } = useInventory();
            const live = itemByIdMap.value.get(id);
            if (live) {
                return fallback ? { ...fallback, ...live } : live;
            }
        } catch {
            // Fall back to snapshot if store is unavailable
        }
        return fallback;
    },
    set(val: any) {
        if (!val) {
            activeDrawerItemId.value = null;
            activeDrawerFallback.value = null;
            return;
        }
        activeDrawerItemId.value = val.$id ? String(val.$id) : (val.id ? String(val.id) : null);
        activeDrawerFallback.value = { ...val };
    },
});

export function useItemDrawer() {
    function openItemDrawer(item: any) {
        if (!item) return;
        // Prevent stacking LotSplitter and ItemDrawer open together
        const { closeLotSplitter } = useLotSplitter();
        closeLotSplitter();
        activeDrawerItem.value = item;
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

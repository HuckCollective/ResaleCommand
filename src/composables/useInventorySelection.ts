import { ref, shallowRef, computed, watch, onScopeDispose, type Ref } from 'vue';
import type { Models } from 'appwrite';
import { registerCalmSelectionSource } from './useCalmRealtime';

/**
 * Composable for managing item selection state across inventory views.
 * Supports individual toggles, toggle-all, selection counters, and bulk ID resolution.
 */
export function useInventorySelection(itemsRef?: Ref<Models.Document[]>) {
    const selectedItems = shallowRef<string[]>([]);
    const calmSel = registerCalmSelectionSource();
    watch(
        selectedItems,
        (list) => {
            calmSel.update(Array.isArray(list) ? list.length : 0);
        },
        { immediate: true }
    );
    onScopeDispose(() => {
        calmSel.dispose();
    });

    const isAllSelected = (currentItems: Models.Document[]) => {
        if (!currentItems || currentItems.length === 0) return false;
        return currentItems.every(i => selectedItems.value.includes(i.$id));
    };

    const toggleAll = (currentItems: Models.Document[]) => {
        if (!currentItems || currentItems.length === 0) {
            selectedItems.value = [];
            return;
        }
        if (isAllSelected(currentItems)) {
            selectedItems.value = [];
        } else {
            selectedItems.value = currentItems.map(i => i.$id);
        }
    };

    const isSelected = (id: string) => selectedItems.value.includes(id);

    const toggleItem = (id: string) => {
        const idx = selectedItems.value.indexOf(id);
        if (idx !== -1) {
            selectedItems.value = selectedItems.value.filter(i => i !== id);
        } else {
            selectedItems.value = [...selectedItems.value, id];
        }
    };

    const clearSelection = () => {
        selectedItems.value = [];
    };

    const getSelectedObjects = (sourceItems?: Models.Document[]) => {
        const pool = sourceItems || itemsRef?.value || [];
        return pool.filter(i => selectedItems.value.includes(i.$id));
    };

    return {
        selectedItems,
        isAllSelected,
        toggleAll,
        isSelected,
        toggleItem,
        clearSelection,
        getSelectedObjects,
    };
}

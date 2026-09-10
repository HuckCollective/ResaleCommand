import { ref, computed, type Ref } from 'vue';
import type { Models } from 'appwrite';

/**
 * Composable for managing item selection state across inventory views.
 * Supports individual toggles, toggle-all, selection counters, and bulk ID resolution.
 */
export function useInventorySelection(itemsRef?: Ref<Models.Document[]>) {
    const selectedItems = ref<string[]>([]);

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
            selectedItems.value.splice(idx, 1);
        } else {
            selectedItems.value.push(id);
        }
    };

    const clearSelection = () => {
        selectedItems.value = [];
    };

    const getSelectedObjects = (sourceItems: Models.Document[]) => {
        return sourceItems.filter(i => selectedItems.value.includes(i.$id));
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

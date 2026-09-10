import { ref } from 'vue';
import type { Models } from 'appwrite';
import { updateInventoryItem } from '../lib/inventory';
import { generateGenericCsv, generateEbayCsv, generatePoshmarkCsv, generateRicochetCsv, downloadCsv } from '../lib/exportUtils';
import { addToast } from '../stores/toast';

export type ExportFormat = 'ricochet' | 'ebay' | 'poshmark' | 'generic';

/**
 * Composable for bulk operations on inventory items (location assignment, status transitions, and exports).
 */
export function useInventoryBulkActions(onSuccess?: () => Promise<void> | void) {
    const isApplyingBulk = ref(false);
    const bulkLocationTarget = ref('');
    const bulkStatusTarget = ref('');

    const applyBulkLocation = async (itemIds: string[], targetLocation: string) => {
        if (!targetLocation || !itemIds || itemIds.length === 0) return false;
        isApplyingBulk.value = true;
        try {
            for (const id of itemIds) {
                await updateInventoryItem(id, { storageLocation: targetLocation });
            }
            addToast({ type: 'success', message: `Moved ${itemIds.length} items to "${targetLocation}".` });
            bulkLocationTarget.value = '';
            if (onSuccess) await onSuccess();
            return true;
        } catch (e: any) {
            addToast({ type: 'error', message: `Bulk location update failed: ${e.message}` });
            return false;
        } finally {
            isApplyingBulk.value = false;
        }
    };

    const applyBulkStatus = async (itemIds: string[], targetStatus: string) => {
        if (!targetStatus || !itemIds || itemIds.length === 0) return false;
        isApplyingBulk.value = true;
        try {
            for (const id of itemIds) {
                await updateInventoryItem(id, { status: targetStatus });
            }
            addToast({ type: 'success', message: `Updated status to "${targetStatus}" for ${itemIds.length} items.` });
            bulkStatusTarget.value = '';
            if (onSuccess) await onSuccess();
            return true;
        } catch (e: any) {
            addToast({ type: 'error', message: `Bulk status update failed: ${e.message}` });
            return false;
        } finally {
            isApplyingBulk.value = false;
        }
    };

    const exportBulkItems = (items: Models.Document[], format: ExportFormat = 'generic') => {
        if (!items || items.length === 0) {
            addToast({ type: 'warning', message: 'No items selected to export.' });
            return false;
        }

        let csv = '';
        if (format === 'ricochet') csv = generateRicochetCsv(items);
        else if (format === 'ebay') csv = generateEbayCsv(items);
        else if (format === 'poshmark') csv = generatePoshmarkCsv(items);
        else csv = generateGenericCsv(items);

        const filename = `inventory-export-${format}-${new Date().toISOString().split('T')[0]}.csv`;
        downloadCsv(csv, filename);
        addToast({ type: 'success', message: `Exported ${items.length} items for ${format}.` });
        return true;
    };

    return {
        isApplyingBulk,
        bulkLocationTarget,
        bulkStatusTarget,
        applyBulkLocation,
        applyBulkStatus,
        exportBulkItems,
    };
}

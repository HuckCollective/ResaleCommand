import { ref } from 'vue';
import type { Models } from 'appwrite';
import { updateInventoryItem, deleteInventoryItem, getCollectionId, DB_ID } from '../lib/inventory';
import { generateGenericCsv, generateEbayCsv, generatePoshmarkCsv, generateRicochetCsv, downloadCsv } from '../lib/exportUtils';
import { withRateLimitRetry } from '../lib/retry';
import { useLoader } from './useLoader';
import { addToast } from '../stores/toast';

export type ExportFormat = 'ricochet' | 'ebay' | 'poshmark' | 'generic';

/**
 * Composable for bulk operations on inventory items (location assignment, status transitions, bundling, and exports/deletions).
 * Employs server-side accelerated batching with APPWRITE_API_KEY (to avoid client rate limits on 300+ items)
 * and falls back seamlessly to client-side exponential backoff pacing.
 */
export function useInventoryBulkActions(onSuccess?: () => Promise<void> | void) {
    const isApplyingBulk = ref(false);
    const bulkLocationTarget = ref('');
    const bulkStatusTarget = ref('');
    const { showLoader, hideLoader } = useLoader();

    const applyBulkLocation = async (itemIds: string[], targetLocation: string) => {
        if (!targetLocation || !itemIds || itemIds.length === 0) return false;
        isApplyingBulk.value = true;
        const total = itemIds.length;

        showLoader("Moving Records...", {
            step: `Relocating ${total} records to "${targetLocation}"...`,
            progress: null,
            cancelable: false
        });

        try {
            // 1. FAST PATH: Server-Side Bulk Update (bypasses client browser rate limits with admin key)
            try {
                const resp = await fetch('/api/inventory/bulk-update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        itemIds,
                        updates: { storageLocation: targetLocation },
                        collectionId: getCollectionId(),
                        dbId: DB_ID
                    })
                });

                if (resp.ok) {
                    const data = await resp.json();
                    if (data.success) {
                        const count = data.updatedCount ?? total;
                        addToast({ 
                            type: 'success', 
                            message: `Successfully moved ${count} items to "${targetLocation}".` 
                        });
                        bulkLocationTarget.value = '';
                        if (onSuccess) await onSuccess();
                        return true;
                    }
                }
                console.warn("Server bulk update fell through, attempting client fallback...");
            } catch (serverErr) {
                console.warn("Server bulk-update unreachable, falling back to client execution:", serverErr);
            }

            // 2. FALLBACK PATH: Paced Client-Side Loop with Rate Limit Protection
            let successCount = 0;
            for (let idx = 0; idx < total; idx++) {
                const id = itemIds[idx];
                const percent = Math.round(((idx + 1) / total) * 100);

                showLoader("Moving Records...", {
                    step: `Item ${idx + 1} of ${total}: Moving to "${targetLocation}" (${percent}%)`,
                    progress: percent,
                    cancelable: false
                });

                await withRateLimitRetry(
                    () => updateInventoryItem(id, { storageLocation: targetLocation }),
                    {
                        onRetry: (attempt, delayMs) => {
                            showLoader("Rate Limit Protection...", {
                                step: `⏳ Pausing ${Math.ceil(delayMs / 1000)}s to respect cloud rate limits (attempt ${attempt}/5)...`,
                                progress: percent,
                                cancelable: false
                            });
                        }
                    }
                );

                successCount++;

                // Gentle 120ms inter-item spacing on client side
                if (total > 1 && idx < total - 1) {
                    await new Promise(r => setTimeout(r, 120));
                }
            }

            addToast({ type: 'success', message: `Moved ${successCount} items to "${targetLocation}".` });
            bulkLocationTarget.value = '';
            if (onSuccess) await onSuccess();
            return true;
        } catch (e: any) {
            console.error("Bulk location update failed:", e);
            addToast({ type: 'error', message: `Bulk location update failed: ${e.message}` });
            return false;
        } finally {
            isApplyingBulk.value = false;
            hideLoader();
        }
    };

    const applyBulkStatus = async (itemIds: string[], targetStatus: string) => {
        if (!targetStatus || !itemIds || itemIds.length === 0) return false;
        isApplyingBulk.value = true;
        const total = itemIds.length;

        showLoader("Updating Status...", {
            step: `Updating status to "${targetStatus}" for ${total} items...`,
            progress: null,
            cancelable: false
        });

        try {
            // 1. FAST PATH: Server-Side Bulk Update
            try {
                const resp = await fetch('/api/inventory/bulk-update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        itemIds,
                        updates: { status: targetStatus },
                        collectionId: getCollectionId(),
                        dbId: DB_ID
                    })
                });

                if (resp.ok) {
                    const data = await resp.json();
                    if (data.success) {
                        const count = data.updatedCount ?? total;
                        addToast({ 
                            type: 'success', 
                            message: `Updated status to "${targetStatus}" for ${count} items.` 
                        });
                        bulkStatusTarget.value = '';
                        if (onSuccess) await onSuccess();
                        return true;
                    }
                }
            } catch (serverErr) {
                console.warn("Server bulk-update unreachable, falling back to client execution:", serverErr);
            }

            // 2. FALLBACK PATH: Paced Client-Side Loop
            let successCount = 0;
            for (let idx = 0; idx < total; idx++) {
                const id = itemIds[idx];
                const percent = Math.round(((idx + 1) / total) * 100);

                showLoader("Updating Status...", {
                    step: `Item ${idx + 1} of ${total}: Setting status to "${targetStatus}" (${percent}%)`,
                    progress: percent,
                    cancelable: false
                });

                await withRateLimitRetry(
                    () => updateInventoryItem(id, { status: targetStatus }),
                    {
                        onRetry: (attempt, delayMs) => {
                            showLoader("Rate Limit Protection...", {
                                step: `⏳ Pausing ${Math.ceil(delayMs / 1000)}s for rate limit recovery (attempt ${attempt}/5)...`,
                                progress: percent,
                                cancelable: false
                            });
                        }
                    }
                );

                successCount++;

                if (total > 1 && idx < total - 1) {
                    await new Promise(r => setTimeout(r, 120));
                }
            }

            addToast({ type: 'success', message: `Updated status to "${targetStatus}" for ${successCount} items.` });
            bulkStatusTarget.value = '';
            if (onSuccess) await onSuccess();
            return true;
        } catch (e: any) {
            console.error("Bulk status update failed:", e);
            addToast({ type: 'error', message: `Bulk status update failed: ${e.message}` });
            return false;
        } finally {
            isApplyingBulk.value = false;
            hideLoader();
        }
    };

    const deleteBulkItems = async (itemIds: string[]) => {
        if (!itemIds || itemIds.length === 0) return false;
        isApplyingBulk.value = true;
        const total = itemIds.length;

        showLoader("Deleting Records...", {
            step: `Deleting ${total} items...`,
            progress: null,
            cancelable: false
        });

        try {
            // 1. FAST PATH: Server-Side Bulk Delete
            try {
                const resp = await fetch('/api/inventory/bulk-delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        itemIds,
                        collectionId: getCollectionId(),
                        dbId: DB_ID
                    })
                });

                if (resp.ok) {
                    const data = await resp.json();
                    if (data.success) {
                        const count = data.deletedCount ?? total;
                        addToast({ type: 'success', message: `Deleted ${count} items.` });
                        if (onSuccess) await onSuccess();
                        return true;
                    }
                }
            } catch (serverErr) {
                console.warn("Server bulk-delete unreachable, falling back to client execution:", serverErr);
            }

            // 2. FALLBACK PATH: Paced Client-Side Loop
            let deletedCount = 0;
            for (let idx = 0; idx < total; idx++) {
                const id = itemIds[idx];
                const percent = Math.round(((idx + 1) / total) * 100);

                showLoader("Deleting Records...", {
                    step: `Item ${idx + 1} of ${total}: Deleting (${percent}%)`,
                    progress: percent,
                    cancelable: false
                });

                await withRateLimitRetry(
                    () => deleteInventoryItem(id),
                    {
                        onRetry: (attempt, delayMs) => {
                            showLoader("Rate Limit Protection...", {
                                step: `⏳ Pausing ${Math.ceil(delayMs / 1000)}s for rate limit recovery (attempt ${attempt}/5)...`,
                                progress: percent,
                                cancelable: false
                            });
                        }
                    }
                );

                deletedCount++;

                if (total > 1 && idx < total - 1) {
                    await new Promise(r => setTimeout(r, 120));
                }
            }

            addToast({ type: 'success', message: `Deleted ${deletedCount} items.` });
            if (onSuccess) await onSuccess();
            return true;
        } catch (e: any) {
            console.error("Bulk delete failed:", e);
            addToast({ type: 'error', message: `Bulk delete failed: ${e.message}` });
            return false;
        } finally {
            isApplyingBulk.value = false;
            hideLoader();
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
        deleteBulkItems,
        exportBulkItems,
    };
}

import { computed, ref } from 'vue';
import { useInventory } from '../useInventory';
import { usePurchases } from '../usePurchases';
import { useLoader } from '../useLoader';

export function useDashboardMetrics() {
    const { inventoryItems, loading, fetchInventory } = useInventory();
    const { purchases, fetchPurchases } = usePurchases();
    const { hideLoader } = useLoader();
    
    // Default to true so Astro renders skeletons on the server!
    const isInitialLoading = ref(true);

    const parseValue = (item: any, key: string, noteKey: string) => {
        let val = 0;
        if (item[key]) {
            val = parseFloat(item[key]);
        } else if (item.conditionNotes) {
            const regex = new RegExp(`${noteKey}[:\\s]*\\$?([\\d.]+)`, 'i');
            const match = item.conditionNotes.match(regex);
            if (match) val = parseFloat(match[1]);
        }
        return isNaN(val) ? 0 : val;
    };

    const isActiveInventory = (i: any) => !['sold', 'tracked', 'scouted', 'combined'].includes(i.status);

    const totalItemsCount = computed(() => {
        return inventoryItems.value.reduce((sum, item) => sum + (item.quantity || 1), 0);
    });

    const globalProfit = computed(() => {
        return inventoryItems.value.filter(i => i.status === 'sold').reduce((sum, item) => {
            const qty = item.quantity || 1;
            const sold = parseValue(item, 'soldPrice', 'Sold') || parseValue(item, 'price', 'Sold') || 0;
            const cost = parseValue(item, 'cost', 'Paid') || parseValue(item, 'purchasePrice', 'Paid') || 0;
            return sum + ((sold - cost) * qty);
        }, 0);
    });

    const totalSpentPurchases = computed(() => {
        return purchases.value.reduce((sum, p) => sum + (p.grandTotal || 0), 0);
    });

    const totalPurchasesCount = computed(() => purchases.value.length);

    const globalProjectedRevenue = computed(() => {
        return inventoryItems.value.filter(isActiveInventory).reduce((sum, item) => {
            const qty = item.quantity || 1;
            const est = parseValue(item, 'resalePrice', 'Resale') || parseValue(item, 'estValue', 'Est. Low') || parseValue(item, 'listPrice', 'Est') || 0;
            return sum + (est * qty);
        }, 0);
    });

    const globalSunkCost = computed(() => {
        return inventoryItems.value.filter(isActiveInventory).reduce((sum, item) => {
            const qty = item.quantity || 1;
            const cost = parseValue(item, 'cost', 'Paid') || parseValue(item, 'purchasePrice', 'Paid') || 0;
            return sum + (cost * qty);
        }, 0);
    });

    const insights = computed(() => {
        const alerts: Array<{ type: string; filter: string; title: string; description: string }> = [];
        
        // 1. Sold items missing a sale price
        const soldNoPrice = inventoryItems.value.filter(i => i.status === 'sold' && !(parseValue(i, 'soldPrice', 'Sold') || parseValue(i, 'price', 'Sold')));
        if (soldNoPrice.length > 0) {
            alerts.push({
                type: 'error',
                filter: 'missing_sold_price',
                title: `${soldNoPrice.length} Sold Items Missing Sale Price`,
                description: `You have items marked as 'Sold' but didn't enter how much they sold for. This is dragging your Total Profit down into the negatives because we only see the cost!`
            });
        }

        // 2. Active inventory missing an estimated value
        const activeNoEst = inventoryItems.value.filter(i => isActiveInventory(i) && !(parseValue(i, 'resalePrice', 'Resale') || parseValue(i, 'estValue', 'Est. Low') || parseValue(i, 'listPrice', 'Est')));
        if (activeNoEst.length > 0) {
            alerts.push({
                type: 'warning',
                filter: 'missing_est_value',
                title: `${activeNoEst.length} Items Missing Estimated Value`,
                description: `Some of your active inventory doesn't have an Estimated Value or List Price. Updating these will give you a much more accurate Projected Revenue.`
            });
        }

        // 3. Active inventory missing a cost basis
        const activeNoCost = inventoryItems.value.filter(i => isActiveInventory(i) && !(parseValue(i, 'cost', 'Paid') || parseValue(i, 'purchasePrice', 'Paid')));
        if (activeNoCost.length > 0) {
            alerts.push({
                type: 'warning',
                filter: 'missing_cost',
                title: `${activeNoCost.length} Items Missing Cost Basis`,
                description: `You have items in stock with $0 cost. If you got them for free, great! If not, logging the cost will help calculate accurate ROI later.`
            });
        }

        // 4. Missing Descriptions
        const activeNoDesc = inventoryItems.value.filter(i => isActiveInventory(i) && (!i.marketDescription || i.marketDescription.length < 10));
        if (activeNoDesc.length > 0) {
            alerts.push({
                type: 'warning',
                filter: 'missing_description',
                title: `${activeNoDesc.length} Items Missing Descriptions`,
                description: `You can't sell without a good pitch! These items are missing a description. We should use AI to bulk-generate them.`
            });
        }

        // 5. Missing Photos
        const activeNoPhotos = inventoryItems.value.filter(i => {
            if (!isActiveInventory(i)) return false;
            if (i.imageId || (i.galleryImageIds && i.galleryImageIds.length > 0)) return false;
            if (i.conditionNotes && (i.conditionNotes.includes('[MAIN IMAGE ID:') || i.conditionNotes.includes('[IMAGE_ID:'))) return false;
            return true;
        });
        if (activeNoPhotos.length > 0) {
            alerts.push({
                type: 'error',
                filter: 'missing_photos',
                title: `${activeNoPhotos.length} Items Missing Photos`,
                description: `An item without photos is invisible. Get snapping or grab some stock images for these items!`
            });
        }

        return alerts;
    });

    const initDashboard = async () => {
        const promises = [];
        if (inventoryItems.value.length === 0) {
            // @ts-ignore
            promises.push(fetchInventory(''));
        }
        if (purchases.value.length === 0) {
            promises.push(fetchPurchases());
        }
        
        await Promise.all(promises);
        
        isInitialLoading.value = false;
        
        // Hide global Vue loader
        hideLoader();
    };

    const displayLoading = computed(() => isInitialLoading.value || loading.value);

    return {
        loading: displayLoading,
        totalItemsCount,
        globalProfit,
        globalProjectedRevenue,
        globalSunkCost,
        totalSpentPurchases,
        totalPurchasesCount,
        insights,
        initDashboard
    };
}

import { computed, ref } from 'vue';
import { useInventory } from '../useInventory';
import { usePurchases } from '../usePurchases';
import { useLoader } from '../useLoader';

export interface DashboardInsight {
    type: 'error' | 'warning' | 'info' | 'success';
    category: 'inventory' | 'tax';
    filter: string;
    link: string;
    title: string;
    description: string;
    scheduleC?: string;
    icon?: string;
    actionText?: string;
}

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

    const insights = computed<DashboardInsight[]>(() => {
        const alerts: DashboardInsight[] = [];
        
        // 1. Sold items missing a sale price
        const soldNoPrice = inventoryItems.value.filter(i => i.status === 'sold' && !(parseValue(i, 'soldPrice', 'Sold') || parseValue(i, 'price', 'Sold')));
        if (soldNoPrice.length > 0) {
            alerts.push({
                type: 'error',
                category: 'inventory',
                filter: 'missing_sold_price',
                link: '/inventory?insightFilter=missing_sold_price',
                icon: 'solar:danger-triangle-bold-duotone',
                actionText: 'Review Sold Items',
                title: `${soldNoPrice.length} Sold Items Missing Sale Price`,
                description: `You have items marked as 'Sold' but didn't enter how much they sold for. This is dragging your Total Profit down into the negatives because we only see the cost!`
            });
        }

        // 2. Active inventory missing an estimated value
        const activeNoEst = inventoryItems.value.filter(i => isActiveInventory(i) && !(parseValue(i, 'resalePrice', 'Resale') || parseValue(i, 'estValue', 'Est. Low') || parseValue(i, 'listPrice', 'Est')));
        if (activeNoEst.length > 0) {
            alerts.push({
                type: 'warning',
                category: 'inventory',
                filter: 'missing_est_value',
                link: '/inventory?insightFilter=missing_est_value',
                icon: 'solar:tag-price-bold-duotone',
                actionText: 'Estimate Values',
                title: `${activeNoEst.length} Items Missing Estimated Value`,
                description: `Some of your active inventory doesn't have an Estimated Value or List Price. Updating these will give you a much more accurate Projected Revenue.`
            });
        }

        // 3. Active inventory missing a cost basis
        const activeNoCost = inventoryItems.value.filter(i => isActiveInventory(i) && !(parseValue(i, 'cost', 'Paid') || parseValue(i, 'purchasePrice', 'Paid')));
        if (activeNoCost.length > 0) {
            alerts.push({
                type: 'warning',
                category: 'inventory',
                filter: 'missing_cost',
                link: '/inventory?insightFilter=missing_cost',
                icon: 'solar:bill-cross-bold-duotone',
                actionText: 'Add Cost Basis',
                title: `${activeNoCost.length} Items Missing Cost Basis`,
                description: `You have items in stock with $0 cost. If you got them for free, great! If not, logging the cost will help calculate accurate ROI later.`
            });
        }

        // 4. Missing Descriptions
        const activeNoDesc = inventoryItems.value.filter(i => isActiveInventory(i) && (!i.marketDescription || i.marketDescription.length < 10));
        if (activeNoDesc.length > 0) {
            alerts.push({
                type: 'warning',
                category: 'inventory',
                filter: 'missing_description',
                link: '/inventory?insightFilter=missing_description',
                icon: 'solar:document-text-bold-duotone',
                actionText: 'Generate Descriptions',
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
                category: 'inventory',
                filter: 'missing_photos',
                link: '/inventory?insightFilter=missing_photos',
                icon: 'solar:camera-broken',
                actionText: 'Add Photos',
                title: `${activeNoPhotos.length} Items Missing Photos`,
                description: `An item without photos is invisible. Get snapping or grab some stock images for these items!`
            });
        }

        // --- TAX & OPERATING EXPENSE (OpEx) INSIGHTS ---
        // 6. Sourcing Mileage Deduction
        if (purchases.value.length > 0) {
            alerts.push({
                type: 'success',
                category: 'tax',
                scheduleC: 'Line 24a',
                filter: 'tax_mileage',
                link: '/purchases',
                icon: 'solar:routing-2-bold-duotone',
                actionText: 'Log Sourcing Mileage',
                title: 'Sourcing Trip Mileage Deduction',
                description: `You logged ${purchases.value.length} sourcing orders. At the IRS $0.67/mi rate, logging 1,000–2,000 sourcing miles can save ~$670 – $1,340 in taxes!`
            });
        }

        // 7. Booth Rent & Space Rental
        alerts.push({
            type: 'info',
            category: 'tax',
            scheduleC: 'Line 20b',
            filter: 'tax_booth_rent',
            link: '/warehouse',
            icon: 'solar:shop-2-bold-duotone',
            actionText: 'View Booth Spaces',
            title: 'Memory Den Booth Rent & Mall Fees',
            description: `Fixed monthly booth rent and consignment commission splits at Memory Den are 100% tax-deductible Operating Expenses (Schedule C, Line 20b).`
        });

        // 8. Software & AI API Subscriptions
        alerts.push({
            type: 'info',
            category: 'tax',
            scheduleC: 'Line 27a',
            filter: 'tax_software_ai',
            link: '#ai-spend',
            icon: 'solar:cpu-bolt-bold-duotone',
            actionText: 'Inspect Gemini AI Costs',
            title: 'Software & Gemini AI API OpEx',
            description: `Your Gemini AI API credits ($2.20 this week, ~$18/mo) and Ricochet POS subscriptions are 100% tax-deductible under Schedule C Line 27a.`
        });

        // 9. Cash / Estate Sale Purchases (Cohan Rule)
        alerts.push({
            type: 'info',
            category: 'tax',
            scheduleC: 'Cohan Rule',
            filter: 'tax_cash_cohan',
            link: '/purchases',
            icon: 'solar:wallet-money-bold-duotone',
            actionText: 'Review Cash Sourcing',
            title: 'Cash Sourcing (IRS Cohan Rule)',
            description: `Buying at garage sales or Craigslist with cash is tax-deductible without a register receipt by keeping a contemporaneous 5-point log.`
        });

        // 10. Online Marketplace Seller & Processing Fees
        alerts.push({
            type: 'info',
            category: 'tax',
            scheduleC: 'Line 10',
            filter: 'tax_marketplace_fees',
            link: '/sales',
            icon: 'solar:ticket-sale-bold-duotone',
            actionText: 'View Sales & Fees',
            title: 'Online Marketplace Selling & Processing Fees',
            description: `Marketplace final value fees (10–20%), payment processing, and promoted ad spend on eBay, Poshmark, & Etsy are 100% deductible on Schedule C Line 10.`
        });

        // 11. Shipping Postage & Packaging Supplies
        alerts.push({
            type: 'info',
            category: 'tax',
            scheduleC: 'Line 22 & 27a',
            filter: 'tax_shipping_supplies',
            link: '/purchases',
            icon: 'solar:box-minimalistic-bold-duotone',
            actionText: 'Track Supplies',
            title: 'Shipping Postage & Packaging Supplies',
            description: `Commercial postage (Pirate Ship, USPS labels) and packaging (boxes, poly mailers, bubble wrap, thermal labels) are 100% deductible in the year bought.`
        });

        // 12. 1099-K Gross vs. Net Reconciliation Trap
        alerts.push({
            type: 'warning',
            category: 'tax',
            scheduleC: 'Line 1-2',
            filter: 'tax_1099k_gross',
            link: '/sales',
            icon: 'solar:shield-warning-bold-duotone',
            actionText: 'Reconcile 1099-K Payouts',
            title: '1099-K Gross vs. Net Tax Alert',
            description: `Online platforms report GROSS buyer payments on Form 1099-K, not net payouts. You must deduct seller fees, shipping costs, and buyer returns to avoid overpaying taxes on phantom revenue.`
        });

        return alerts;
    });

    const initDashboard = async () => {
        try {
            const promises = [];
            if (inventoryItems.value.length === 0) {
                // @ts-ignore
                promises.push(fetchInventory(''));
            }
            if (purchases.value.length === 0) {
                promises.push(fetchPurchases());
            }
            
            await Promise.allSettled(promises);
        } catch (e) {
            console.error('[Dashboard] Error loading dashboard data:', e);
        } finally {
            isInitialLoading.value = false;
            // Hide global Vue loader once ready
            hideLoader();
        }
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

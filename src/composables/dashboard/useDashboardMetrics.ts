import { computed } from 'vue';
import { useDashboardSource } from './useDashboardSource';
import { parseItemValue, isActiveInventory } from '../../lib/dashboardAlerts';

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

/**
 * Collective totals + tax tips, computed purely from the injected dashboard source
 * (live Appwrite data OR the public demo's sample data). Inventory data-quality "alerts"
 * now live in src/lib/dashboardAlerts.ts and render as alert cards.
 */
export function useDashboardMetrics() {
    const { snapshot } = useDashboardSource();
    const items = computed(() => snapshot.value.items);
    const purchases = computed(() => snapshot.value.purchases);

    const qtyOf = (item: any) => item.quantity || 1;
    const costOf = (item: any) => parseItemValue(item, 'cost', 'Paid') || parseItemValue(item, 'purchasePrice', 'Paid') || 0;
    const estOf = (item: any) =>
        parseItemValue(item, 'resalePrice', 'Resale') || parseItemValue(item, 'estValue', 'Est. Low') || parseItemValue(item, 'listPrice', 'Est') || 0;

    const totalItemsCount = computed(() => items.value.reduce((sum, item) => sum + qtyOf(item), 0));

    const globalProfit = computed(() =>
        items.value.filter((i) => i.status === 'sold').reduce((sum, item) => {
            const sold = parseItemValue(item, 'soldPrice', 'Sold') || parseItemValue(item, 'price', 'Sold') || 0;
            return sum + (sold - costOf(item)) * qtyOf(item);
        }, 0)
    );

    const totalSpentPurchases = computed(() => purchases.value.reduce((sum, p) => sum + (p.grandTotal || 0), 0));
    const totalPurchasesCount = computed(() => purchases.value.length);

    const globalProjectedRevenue = computed(() =>
        items.value.filter(isActiveInventory).reduce((sum, item) => sum + estOf(item) * qtyOf(item), 0)
    );

    const globalSunkCost = computed(() =>
        items.value.filter(isActiveInventory).reduce((sum, item) => sum + costOf(item) * qtyOf(item), 0)
    );

    /** LLC-level + personal Schedule C tips. Not alerts: they live in the Tax Tips widget. */
    const taxTips = computed<DashboardInsight[]>(() => {
        const tips: DashboardInsight[] = [];

        if (purchases.value.length > 0) {
            tips.push({
                type: 'success', category: 'tax', scheduleC: 'Line 24a', filter: 'tax_mileage', link: '/purchases',
                icon: 'solar:routing-2-bold-duotone', actionText: 'Log Sourcing Mileage',
                title: 'Sourcing Trip Mileage Deduction',
                description: `You logged ${purchases.value.length} sourcing orders. At the IRS $0.67/mi rate, logging 1,000–2,000 sourcing miles can save ~$670 – $1,340 in taxes!`
            });
        }

        tips.push(
            {
                type: 'info', category: 'tax', scheduleC: 'Line 20b', filter: 'tax_booth_rent', link: '/warehouse',
                icon: 'solar:shop-2-bold-duotone', actionText: 'View Booth Spaces',
                title: 'Booth Rent & Mall Fees',
                description: `Fixed monthly booth rent and consignment commission splits at partner venues are 100% tax-deductible Operating Expenses (Schedule C, Line 20b).`
            },
            {
                type: 'info', category: 'tax', scheduleC: 'Line 27a', filter: 'tax_software_ai', link: '#ai-spend',
                icon: 'solar:cpu-bolt-bold-duotone', actionText: 'Inspect AI Costs',
                title: 'Software & AI API OpEx',
                description: `Gemini AI API credits and Ricochet POS subscriptions are 100% tax-deductible under Schedule C Line 27a.`
            },
            {
                type: 'info', category: 'tax', scheduleC: 'Cohan Rule', filter: 'tax_cash_cohan', link: '/purchases',
                icon: 'solar:wallet-money-bold-duotone', actionText: 'Review Cash Sourcing',
                title: 'Cash Sourcing (IRS Cohan Rule)',
                description: `Buying at garage sales or Craigslist with cash is tax-deductible without a register receipt by keeping a contemporaneous 5-point log.`
            },
            {
                type: 'info', category: 'tax', scheduleC: 'Line 10', filter: 'tax_marketplace_fees', link: '/sales',
                icon: 'solar:ticket-sale-bold-duotone', actionText: 'View Sales & Fees',
                title: 'Online Marketplace Selling & Processing Fees',
                description: `Marketplace final value fees (10–20%), payment processing, and promoted ad spend on eBay, Poshmark, & Etsy are 100% deductible on Schedule C Line 10.`
            },
            {
                type: 'info', category: 'tax', scheduleC: 'Line 22 & 27a', filter: 'tax_shipping_supplies', link: '/purchases',
                icon: 'solar:box-minimalistic-bold-duotone', actionText: 'Track Supplies',
                title: 'Shipping Postage & Packaging Supplies',
                description: `Commercial postage (Pirate Ship, USPS labels) and packaging (boxes, poly mailers, bubble wrap, thermal labels) are 100% deductible in the year bought.`
            },
            {
                type: 'warning', category: 'tax', scheduleC: 'Line 1-2', filter: 'tax_1099k_gross', link: '/sales',
                icon: 'solar:shield-warning-bold-duotone', actionText: 'Reconcile 1099-K Payouts',
                title: '1099-K Gross vs. Net Tax Alert',
                description: `Online platforms report GROSS buyer payments on Form 1099-K, not net payouts. You must deduct seller fees, shipping costs, and buyer returns to avoid overpaying taxes on phantom revenue.`
            }
        );

        return tips;
    });

    return {
        totalItemsCount,
        globalProfit,
        globalProjectedRevenue,
        globalSunkCost,
        totalSpentPurchases,
        totalPurchasesCount,
        taxTips
    };
}

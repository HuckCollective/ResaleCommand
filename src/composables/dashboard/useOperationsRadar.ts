import { ref, computed, onMounted } from 'vue';
import { useInventory } from '../useInventory';
import {
    isWorkingStockItem,
    isUnassignedLocation,
    matchesSmartQueue,
    matchesSpatialLocation,
    matchesPartnerPrefix
} from '../../lib/inventoryVibes';

export type RadarCategory = 'all' | 'queues' | 'locations' | 'partners';

export interface RadarCardItem {
    id: string;
    category: 'queues' | 'locations' | 'partners';
    title: string;
    subtitle: string;
    badgeLabel: string;
    icon: string;
    accentClass: string;
    borderClass: string;
    link: string;
    count: number;
    unitCount: number;
    totalValue: number;
    isAlert?: boolean;
}

const STORAGE_KEY = 'hucks_dashboard_radar_config';

export function useOperationsRadar() {
    const { inventoryItems } = useInventory();

    // Default to 'queues' (Restock & Triage) so mobile users see the high-priority action queues first
    const activeCategory = ref<RadarCategory>('queues');
    const isCustomizing = ref(false);
    const hiddenCardIds = ref<string[]>([]);

    const loadConfig = () => {
        if (typeof window === 'undefined') return;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    hiddenCardIds.value = parsed;
                }
            }
        } catch {}
    };

    const saveConfig = () => {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(hiddenCardIds.value));
        } catch {}
    };

    const toggleCardVisibility = (id: string) => {
        const idx = hiddenCardIds.value.indexOf(id);
        if (idx === -1) {
            hiddenCardIds.value = [...hiddenCardIds.value, id];
        } else {
            hiddenCardIds.value = hiddenCardIds.value.filter(x => x !== id);
        }
        saveConfig();
    };

    const isCardVisible = (id: string): boolean => {
        return !hiddenCardIds.value.includes(id);
    };

    const resetCardConfig = () => {
        hiddenCardIds.value = [];
        saveConfig();
    };

    onMounted(() => {
        loadConfig();
    });

    const activeStockItems = computed(() => {
        return (inventoryItems.value || []).filter((item: any) => isWorkingStockItem(item));
    });

    const computeMetrics = (predicate: (item: any) => boolean) => {
        let count = 0;
        let unitCount = 0;
        let totalValue = 0;
        for (const item of activeStockItems.value) {
            if (predicate(item)) {
                const qty = Math.max(1, Number((item as any).quantity) || 1);
                const price = Number((item as any).resalePrice || (item as any).boutiquePrice || 0) || 0;
                count++;
                unitCount += qty;
                totalValue += price * qty;
            }
        }
        return { count, unitCount, totalValue };
    };

    const allRadarCards = computed<RadarCardItem[]>(() => {
        const unassigned = computeMetrics(item => isUnassignedLocation(item));
        const mdRestock = computeMetrics(item => matchesSmartQueue(item, 'md_restock'));
        const dtRestock = computeMetrics(item => matchesSmartQueue(item, 'dt_restock'));
        const needsMdSyncMetric = computeMetrics(item => matchesSmartQueue(item, 'needs_md_sync'));
        const missing0ej = computeMetrics(item => matchesSmartQueue(item, 'missing_booth_sku'));
        const boothBins = computeMetrics(item => matchesSmartQueue(item, 'booth_bins'));

        const locMd = computeMetrics(item => matchesSpatialLocation(item, 'MD'));
        const locDt = computeMetrics(item => matchesSpatialLocation(item, 'DT'));
        const locHg = computeMetrics(item => matchesSpatialLocation(item, 'HG'));
        const locHh = computeMetrics(item => matchesSpatialLocation(item, 'HH'));
        const locHd = computeMetrics(item => matchesSpatialLocation(item, 'HD'));

        const partHuck = computeMetrics(item => matchesPartnerPrefix(item, 'HUCK-'));
        const partPdxgl = computeMetrics(item => matchesPartnerPrefix(item, 'PDXGL-'));
        const partBb = computeMetrics(item => matchesPartnerPrefix(item, 'BB-'));
        const part0ej = computeMetrics(item => matchesPartnerPrefix(item, '0EJ'));

        return [
            // --- 1. QUEUES (Restock & Triage) ---
            {
                id: 'q_unassigned',
                category: 'queues',
                title: '🚨 Unassigned Location Triage',
                subtitle: 'Active items missing a warehouse or booth code (Golden Rule #1)',
                badgeLabel: 'Triage Alert',
                icon: 'solar:danger-triangle-bold-duotone',
                accentClass: unassigned.count > 0 ? 'text-warning' : 'text-success',
                borderClass: unassigned.count > 0 ? 'border-warning/50 hover:border-warning' : 'border-base-300 hover:border-primary/50',
                link: '/inventory?location=__unassigned__',
                ...unassigned,
                isAlert: unassigned.count > 0
            },
            {
                id: 'q_md_restock',
                category: 'queues',
                title: '🔮 Memory Den Restock Pull',
                subtitle: 'Untagged backstock matching Goth, Whimsigoth, TTRPG, Oddities & Horror',
                badgeLabel: 'Smart Pull',
                icon: 'solar:magic-stick-3-bold-duotone',
                accentClass: 'text-primary',
                borderClass: 'border-primary/30 hover:border-primary',
                link: '/inventory?queue=md_restock',
                ...mdRestock
            },
            {
                id: 'q_dt_restock',
                category: 'queues',
                title: '🐯 Dusty Tiger Smalls Pull',
                subtitle: 'Untagged backstock matching Jewelry, Enamel Pins, Curios & Wands (<8")',
                badgeLabel: 'Smart Pull',
                icon: 'solar:star-fall-minimalistic-2-bold-duotone',
                accentClass: 'text-secondary',
                borderClass: 'border-secondary/30 hover:border-secondary',
                link: '/inventory?queue=dt_restock',
                ...dtRestock
            },
            {
                id: 'q_needs_md_sync',
                category: 'queues',
                title: '🔄 0EJ Not Marked MD',
                subtitle: '0EJ Ricochet-tagged items still marked HD/HG/HH or not Placed in MD',
                badgeLabel: 'Sync Audit',
                icon: 'solar:refresh-circle-bold-duotone',
                accentClass: needsMdSyncMetric.count > 0 ? 'text-warning' : 'text-success',
                borderClass: needsMdSyncMetric.count > 0 ? 'border-warning/40 hover:border-warning' : 'border-base-300 hover:border-primary/50',
                link: '/inventory?queue=needs_md_sync',
                ...needsMdSyncMetric,
                isAlert: needsMdSyncMetric.count > 0
            },
            {
                id: 'q_missing_0ej',
                category: 'queues',
                title: '⚠️ MD Missing 0EJ Tag',
                subtitle: 'Memory Den items needing a 0EJXXX Ricochet SKU assigned',
                badgeLabel: 'POS Audit',
                icon: 'solar:tag-horizontal-bold-duotone',
                accentClass: missing0ej.count > 0 ? 'text-warning' : 'text-success',
                borderClass: missing0ej.count > 0 ? 'border-warning/40 hover:border-warning' : 'border-base-300 hover:border-primary/50',
                link: '/inventory?queue=missing_booth_sku',
                ...missing0ej,
                isAlert: missing0ej.count > 0
            },
            {
                id: 'q_booth_bins',
                category: 'queues',
                title: '📦 Multi-Qty Booth Bins',
                subtitle: 'Active multi-quantity crates & volume bins (Qty > 1)',
                badgeLabel: 'Booth Bins',
                icon: 'solar:box-minimalistic-bold-duotone',
                accentClass: 'text-info',
                borderClass: 'border-info/30 hover:border-info',
                link: '/inventory?queue=booth_bins',
                ...boothBins
            },

            // --- 2. LOCATIONS (Booths & Backstock) ---
            {
                id: 'loc_md',
                category: 'locations',
                title: '🔮 Memory Den (MD)',
                subtitle: "Booth #0EJ — Huck's Adventures Outfitters",
                badgeLabel: 'Retail Booth',
                icon: 'solar:shop-2-bold-duotone',
                accentClass: 'text-primary',
                borderClass: 'border-base-300 hover:border-primary',
                link: '/inventory?location=MD',
                ...locMd
            },
            {
                id: 'loc_dt',
                category: 'locations',
                title: '🐯 Dusty Tiger (DT)',
                subtitle: 'Consignment Showcase — Smalls & Collectibles',
                badgeLabel: 'Retail Booth',
                icon: 'solar:shop-bold-duotone',
                accentClass: 'text-secondary',
                borderClass: 'border-base-300 hover:border-secondary',
                link: '/inventory?location=DT',
                ...locDt
            },
            {
                id: 'loc_hg',
                category: 'locations',
                title: "🏠 Huck's Garage (HG)",
                subtitle: 'Primary Hardgoods, Toys, Decor & Bulk Backstock',
                badgeLabel: 'Warehouse',
                icon: 'solar:garage-bold-duotone',
                accentClass: 'text-info',
                borderClass: 'border-base-300 hover:border-info',
                link: '/inventory?location=HG',
                ...locHg
            },
            {
                id: 'loc_hh',
                category: 'locations',
                title: "🏡 Huck's Hideout (HH)",
                subtitle: 'Climate-Controlled Backstock (Books, Media, Apparel, Jewelry)',
                badgeLabel: 'Warehouse',
                icon: 'solar:home-smile-bold-duotone',
                accentClass: 'text-accent',
                borderClass: 'border-base-300 hover:border-accent',
                link: '/inventory?location=HH',
                ...locHh
            },
            {
                id: 'loc_hd',
                category: 'locations',
                title: '🛋️ Hideout Legacy (HD)',
                subtitle: 'Items still carrying legacy HD storage code',
                badgeLabel: 'Legacy Code',
                icon: 'solar:archive-minimalistic-bold-duotone',
                accentClass: 'text-base-content/70',
                borderClass: 'border-base-300 hover:border-base-content/40',
                link: '/inventory?location=HD',
                ...locHd
            },

            // --- 3. PARTNERS & SKUs ---
            {
                id: 'part_huck',
                category: 'partners',
                title: '🌲 HUCK- Collective',
                subtitle: 'The Huckleberry Collective primary inventory',
                badgeLabel: 'Partner SKU',
                icon: 'solar:users-group-two-rounded-bold-duotone',
                accentClass: 'text-primary',
                borderClass: 'border-base-300 hover:border-primary',
                link: '/inventory?barcode=HUCK-',
                ...partHuck
            },
            {
                id: 'part_pdxgl',
                category: 'partners',
                title: '🎲 PDXGL- Game Library',
                subtitle: 'PDX Game Library co-op inventory',
                badgeLabel: 'Partner SKU',
                icon: 'solar:gamepad-bold-duotone',
                accentClass: 'text-secondary',
                borderClass: 'border-base-300 hover:border-secondary',
                link: '/inventory?barcode=PDXGL-',
                ...partPdxgl
            },
            {
                id: 'part_bb',
                category: 'partners',
                title: '🤝 BB- Consignor',
                subtitle: 'Consignor BB- inventory',
                badgeLabel: 'Consignor SKU',
                icon: 'solar:user-check-rounded-bold-duotone',
                accentClass: 'text-accent',
                borderClass: 'border-base-300 hover:border-accent',
                link: '/inventory?barcode=BB-',
                ...partBb
            },
            {
                id: 'part_0ej',
                category: 'partners',
                title: '🏷️ 0EJ Tagged Stock',
                subtitle: 'Items with Memory Den Ricochet 0EJ SKU',
                badgeLabel: 'Ricochet POS',
                icon: 'solar:barcode-bold-duotone',
                accentClass: 'text-success',
                borderClass: 'border-base-300 hover:border-success',
                link: '/inventory?barcode=0EJ',
                ...part0ej
            }
        ];
    });

    const visibleRadarCards = computed(() => {
        return allRadarCards.value.filter(card => {
            if (!isCardVisible(card.id)) return false;
            if (activeCategory.value !== 'all' && card.category !== activeCategory.value) return false;
            return true;
        });
    });

    const categoryCounts = computed(() => {
        const visible = allRadarCards.value.filter(c => isCardVisible(c.id));
        return {
            all: visible.length,
            queues: visible.filter(c => c.category === 'queues').length,
            locations: visible.filter(c => c.category === 'locations').length,
            partners: visible.filter(c => c.category === 'partners').length
        };
    });

    return {
        activeCategory,
        isCustomizing,
        hiddenCardIds,
        allRadarCards,
        visibleRadarCards,
        categoryCounts,
        isCardVisible,
        toggleCardVisibility,
        resetCardConfig
    };
}

/**
 * Resale Command - Canonical Inventory Lifecycle & Status Engine
 * Standardized 5-Stage Physical Lifecycle:
 * tracked -> acquired -> received -> placed -> sold
 */

export const INVENTORY_STATUS = {
    TRACKED: 'tracked',
    ACQUIRED: 'acquired',
    RECEIVED: 'received',
    PLACED: 'placed',
    SOLD: 'sold',
    COMBINED: 'combined',
    DECONSTRUCTED: 'deconstructed'
} as const;

export type InventoryStatus = typeof INVENTORY_STATUS[keyof typeof INVENTORY_STATUS];

/**
 * Normalizes any legacy or variant status string to the canonical status.
 * Provides backwards compatibility for existing Appwrite documents without requiring manual database rewrites.
 */
export function normalizeInventoryStatus(rawStatus: string | null | undefined): InventoryStatus {
    if (!rawStatus) return INVENTORY_STATUS.RECEIVED;
    const s = String(rawStatus).toLowerCase().trim();

    // Intake & Backstock synonyms
    if (['in-stock', 'in_stock', 'instock', 'active', 'staged', 'backstock'].includes(s)) {
        return INVENTORY_STATUS.RECEIVED;
    }

    // Pre-acquisition synonyms
    if (['scouted', 'draft', 'pending_bid', 'watching', 'watchlist', 'cart'].includes(s)) {
        return INVENTORY_STATUS.TRACKED;
    }

    // In-transit / Won synonyms
    if (['won', 'purchased', 'ordered', 'in-transit', 'in_transit'].includes(s)) {
        return INVENTORY_STATUS.ACQUIRED;
    }

    // Active retail booth placement
    if (['listed', 'booth', 'floor'].includes(s)) {
        return INVENTORY_STATUS.PLACED;
    }

    // Direct match
    if (Object.values(INVENTORY_STATUS).includes(s as any)) {
        return s as InventoryStatus;
    }

    return INVENTORY_STATUS.RECEIVED;
}

/**
 * Checks if an item is physically or legally acquired (post-buy).
 * Unlocks AI Deep Scan and Lot Deconstruction.
 */
export function isItemAcquired(status: string | null | undefined): boolean {
    const s = normalizeInventoryStatus(status);
    return [
        INVENTORY_STATUS.ACQUIRED,
        INVENTORY_STATUS.RECEIVED,
        INVENTORY_STATUS.PLACED,
        INVENTORY_STATUS.SOLD,
        INVENTORY_STATUS.COMBINED,
        INVENTORY_STATUS.DECONSTRUCTED
    ].includes(s);
}

/**
 * Checks if an item represents active, on-hand physical stock.
 * Excludes sold, pre-buy tracked items, and absorbed lineage records.
 */
export function isActiveInventory(status: string | null | undefined): boolean {
    const s = normalizeInventoryStatus(status);
    return ![
        INVENTORY_STATUS.TRACKED,
        INVENTORY_STATUS.SOLD,
        INVENTORY_STATUS.COMBINED,
        INVENTORY_STATUS.DECONSTRUCTED
    ].includes(s);
}

/**
 * Evaluates whether an item should show live auction bidding cards, countdowns, or outbid alerts.
 * Strictly returns false for items already purchased, received, placed, or sold!
 */
export function isLiveAuctionActive(item: any): boolean {
    if (!item) return false;
    const normalized = normalizeInventoryStatus(item.status);

    // If the item has already been acquired, received, placed on the floor, or sold, bidding is finished!
    if ([INVENTORY_STATUS.ACQUIRED, INVENTORY_STATUS.RECEIVED, INVENTORY_STATUS.PLACED, INVENTORY_STATUS.SOLD].includes(normalized)) {
        return false;
    }

    // If explicitly marked won or lost
    if (item.auctionStatus === 'won' || item.auctionStatus === 'lost') {
        return false;
    }

    // Active live auction conditions
    return Boolean(
        item.status === 'tracked' ||
        item.status === 'draft' ||
        item.status === 'scouted' ||
        item.auctionEndsAt ||
        (item.maxBid && item.maxBid > 0)
    );
}

/**
 * UI Badge styling helper for consistent status rendering across views
 */
export function getItemStatusBadgeClass(status: string | null | undefined): string {
    const s = normalizeInventoryStatus(status);
    switch (s) {
        case INVENTORY_STATUS.TRACKED:
            return 'badge-secondary text-secondary-content font-bold';
        case INVENTORY_STATUS.ACQUIRED:
            return 'badge-warning text-warning-content font-bold';
        case INVENTORY_STATUS.RECEIVED:
            return 'badge-info text-info-content font-bold';
        case INVENTORY_STATUS.PLACED:
            return 'badge-success text-success-content font-black';
        case INVENTORY_STATUS.SOLD:
            return 'badge-neutral text-neutral-content font-bold';
        case INVENTORY_STATUS.COMBINED:
            return 'badge-secondary badge-outline font-bold';
        case INVENTORY_STATUS.DECONSTRUCTED:
            return 'badge-ghost opacity-70 font-mono';
        default:
            return 'badge-ghost';
    }
}

/**
 * Human-readable label for status
 */
export function getItemStatusLabel(status: string | null | undefined): string {
    const s = normalizeInventoryStatus(status);
    switch (s) {
        case INVENTORY_STATUS.TRACKED:
            return 'Tracked (Unacquired)';
        case INVENTORY_STATUS.ACQUIRED:
            return 'Acquired (In-Transit)';
        case INVENTORY_STATUS.RECEIVED:
            return 'Received (Backstock)';
        case INVENTORY_STATUS.PLACED:
            return 'Placed (Active)';
        case INVENTORY_STATUS.SOLD:
            return 'Sold';
        case INVENTORY_STATUS.COMBINED:
            return 'Combined (Merged)';
        case INVENTORY_STATUS.DECONSTRUCTED:
            return 'Deconstructed Lot';
        default:
            return 'Received';
    }
}

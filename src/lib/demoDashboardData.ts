import type { MemberHat } from './memberHats';
import {
  emptySnapshot,
  type DashboardMember,
  type DashboardSnapshot,
} from './dashboardTypes';

/**
 * PUBLIC /demo sample data — 100% fictional. No real names, amounts, or live barcode prefixes.
 * Only RAW records live here: every alert count, total and card is computed by the real engine
 * (dashboardAlerts.ts / useDashboardMetrics.ts), so the demo can never drift from the real dashboard.
 */
export const DEMO_MEMBERS: Record<MemberHat, DashboardMember> = {
  founder: { name: 'Casey Steward', hats: ['founder'] },
  curator: { name: 'Alex Curator', hats: ['curator'], inventoryPrefix: 'DEMO-A-' },
  promoter: { name: 'Sam Promoter', hats: ['promoter'] },
  enabler: { name: 'Jordan Enabler', hats: ['enabler'] },
  consignor: { name: 'Riley Consignor', hats: ['consignor'], inventoryPrefix: 'DEMO-C-' },
};

/**
 * Which demo role sees each alert type. scripts/validate-templates.mjs (Check 14) fails if an
 * alert id in dashboardAlerts.ts is missing here — add sample records for it, then list it.
 */
export const DEMO_ALERT_COVERAGE: Record<string, MemberHat> = {
  unassigned_location: 'enabler',
  ej_not_marked_md: 'enabler',
  md_missing_0ej: 'enabler',
  legacy_hd: 'enabler',
  sold_no_price: 'founder',
  no_est_value: 'curator',
  no_cost: 'curator',
  no_description: 'curator',
  no_photos: 'curator',
  aging_received: 'curator',
  unlinked_tickets: 'founder',
  stale_sync: 'founder',
  new_sale_mine: 'curator',
  payout_ready: 'curator',
  vote_needed: 'promoter',
  breakeven_shortfall: 'founder',
  pending_reimbursements: 'founder',
  drop_unannounced: 'promoter',
  labor_unlogged: 'promoter',
  join_requests: 'founder',
};

const HEALTHY_TITLES = [
  'Ceramic Dragon Figurine', 'Retro Tabletop Dice Set', 'Hand-Bound Journal', 'Brass Candle Snuffer',
  'Enamel Pin Collection', 'Cast Iron Cauldron Planter', 'Vintage Map Print', 'Wooden Rune Set',
  'Felt Wizard Hat', 'Glass Potion Bottle', 'Tarot Deck Display Box', 'Mini Terrarium Kit',
];
const LOCATIONS = ['MD', 'DT', 'HG', 'HH'];
const DESCRIPTION = 'A fictional sample item with a full description, ready to post or list.';

export function buildDemoSnapshot(now = Date.now()): DashboardSnapshot {
  const DAY = 86_400_000;
  const iso = (daysAgo: number) => new Date(now - daysAgo * DAY).toISOString();
  let n = 0;
  const item = (over: Record<string, unknown> = {}) => {
    n += 1;
    return {
      $id: `demo-item-${n}`,
      title: `Sample Item ${n}`,
      status: 'placed',
      quantity: 1,
      storageLocation: 'HG',
      upc: `DEMO-A-${String(n).padStart(4, '0')}`,
      resalePrice: 24,
      cost: 8,
      marketDescription: DESCRIPTION,
      imageId: 'demo-image',
      $createdAt: iso(30),
      ...over,
    };
  };

  const healthy = HEALTHY_TITLES.map((title, i) =>
    item({ title, storageLocation: LOCATIONS[i % LOCATIONS.length], resalePrice: 18 + i * 6, cost: 5 + i * 2 })
  );

  const items = [
    ...healthy,
    // Consignor-owned floor items
    item({ title: 'Consigned Quilt Wall Hanging', upc: 'DEMO-C-0001', storageLocation: 'MD', resalePrice: 65, cost: 0 }),
    item({ title: 'Consigned Oak Side Table', upc: 'DEMO-C-0002', storageLocation: 'MD', resalePrice: 120, cost: 0 }),
    // Already sold, with prices (feeds collective profit)
    item({ title: 'Sold Lantern Set', status: 'sold', soldPrice: 48, cost: 14 }),
    item({ title: 'Sold Board Game Bundle', status: 'sold', soldPrice: 72, cost: 20 }),
    // Alert triggers
    item({ title: 'Unlabeled Crate A', storageLocation: '' }),
    item({ title: 'Unlabeled Crate B', storageLocation: '' }),
    item({ title: 'Booth-Tagged Candle Lot', locationSku: '0EJ9AA', status: 'acquired', storageLocation: 'HG' }),
    item({ title: 'Booth-Tagged Mug Set', locationSku: '0EJ9AB', status: 'acquired', storageLocation: 'HH' }),
    item({ title: 'Booth Shelf Item Without SKU', storageLocation: 'MD' }),
    item({ title: 'Booth Display Item Without SKU', storageLocation: 'MD' }),
    item({ title: 'Legacy Bin Item One', storageLocation: 'HD' }),
    item({ title: 'Legacy Bin Item Two', storageLocation: 'HD' }),
    item({ title: 'Sold Without A Price', status: 'sold', cost: 9 }),
    item({ title: 'Sold Mystery Box', status: 'sold', cost: 12 }),
    item({ title: 'Unpriced Chess Set', resalePrice: 0 }),
    item({ title: 'Unpriced Lamp', resalePrice: 0 }),
    item({ title: 'Unpriced Frame', resalePrice: 0 }),
    item({ title: 'Free-Find Planter', cost: 0 }),
    item({ title: 'Free-Find Rug', cost: 0 }),
    item({ title: 'Undescribed Vase', marketDescription: '' }),
    item({ title: 'Undescribed Scarf', marketDescription: '' }),
    item({ title: 'Undescribed Atlas', marketDescription: 'short' }),
    item({ title: 'Undescribed Lantern', marketDescription: '' }),
    item({ title: 'Photoless Teapot', imageId: '' }),
    item({ title: 'Photoless Mirror', imageId: '' }),
    item({ title: 'Photoless Clock', imageId: '' }),
    item({ title: 'Received Box One', status: 'received', $createdAt: iso(12) }),
    item({ title: 'Received Box Two', status: 'received', $createdAt: iso(15) }),
  ];

  return {
    ...emptySnapshot(now),
    items,
    purchases: [
      { $id: 'demo-po-1', grandTotal: 142.5 },
      { $id: 'demo-po-2', grandTotal: 86.25 },
      { $id: 'demo-po-3', grandTotal: 210 },
    ],
    sales: [
      { id: 'demo-sale-1', title: 'Retro Tabletop Dice Set', soldAt: iso(2), amount: 24, matched: true, ownerPrefix: 'DEMO-A-' },
      { id: 'demo-sale-2', title: 'Consigned Oak Side Table', soldAt: iso(3), amount: 120, matched: true, ownerPrefix: 'DEMO-C-' },
      { id: 'demo-sale-3', title: 'Unmatched Register Ticket', soldAt: iso(4), amount: 18, matched: false },
      { id: 'demo-sale-4', title: 'Unmatched Bin Sale', soldAt: iso(5), amount: 9, matched: false },
    ],
    expenses: [
      { id: 'demo-exp-1', title: 'Thermal label rolls', amount: 34.99, status: 'pending', scope: 'coop_shared' },
      { id: 'demo-exp-2', title: 'Pop-up table fee', amount: 45, status: 'pending', scope: 'coop_shared' },
      { id: 'demo-exp-3', title: 'Sourcing mileage', amount: 28.4, status: 'pending', scope: 'personal_write_off' },
    ],
    proposals: [
      {
        id: 'demo-prop-1', title: 'Add a second weekend pop-up table', status: 'active', deadline: iso(-2),
        votes: { v1: { memberName: 'Riley Demo' } },
      },
      {
        id: 'demo-prop-2', title: 'Adopt a quarterly surplus review', status: 'active', deadline: iso(-9),
        votes: {},
      },
    ],
    laborEntries: [
      { member: 'Alex Curator', date: iso(1).slice(0, 10), hours: 2 },
      { member: 'Casey Steward', date: iso(2).slice(0, 10), hours: 3.5 },
      { member: 'Sam Promoter', date: iso(12).slice(0, 10), hours: 1.5 },
      { member: 'Jordan Enabler', date: iso(10).slice(0, 10), hours: 2 },
    ],
    drops: [{ id: 'demo-drop-1', title: 'Cozy Autumn Booth Drop', status: 'ready' }],
    lastSyncAt: iso(20),
    statement: {
      month: 'Last month',
      ready: true,
      grossSales: 1240,
      venueFee: 186,
      rentOffset: 80,
      payout: 974,
      dealLabel: 'Venue fee + fixed shelf rent, 100% of the rest',
    },
    shortfall: 118.4,
    joinRequests: 3,
  };
}


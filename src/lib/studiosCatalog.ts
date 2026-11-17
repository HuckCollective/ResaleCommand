import type { MemberCapabilities } from './memberAccess';
import { getSellingBoothMetas } from './warehouses';

export const MAX_NAV_PILLARS = 5;
export const MAX_DROPDOWN_ITEMS = 7;

export interface StudioToolEntry {
  id: string;
  label: string;
  actionLabel: string;
  description: string;
  href: string;
  icon: string;
  iconColor: string;
  badge?: string;
  badgeClass?: string;
}

export interface StudioWorkbench {
  id: 'sourcing_appraisal' | 'booths_barcodes' | 'online_social_web' | 'strategy_ai';
  emoji: string;
  title: string;
  subtitle: string;
  tools: StudioToolEntry[];
}

export interface NavDropdownLink {
  id: string;
  label: string;
  hint: string;
  href: string;
  icon: string;
  iconColor?: string;
  emoji?: string;
  badge?: string;
  badgeClass?: string;
}

export interface NavPillarConfig {
  id: 'command' | 'purchases' | 'inventory' | 'booths_channels' | 'sales_coop';
  label: string;
  icon: string;
  href?: string;
  activePrefixes: string[];
  children?: NavDropdownLink[];
}

/**
 * Builds the 4 scannable Studios & Reseller Tools workbenches dynamically from `memberAccess`
 * capabilities and live `warehouses` metadata (zero hardcoded `/warehouse/sync/MD` — Law 2).
 */
export function buildStudiosWorkbenches(
  caps: MemberCapabilities,
  liveWarehouses?: any[]
): StudioWorkbench[] {
  const sellingBooths = getSellingBoothMetas(liveWarehouses);
  const ricochetBoothTools: StudioToolEntry[] = sellingBooths
    .filter((m) => m.usesRicochet)
    .map((m) => ({
      id: `pos_sync_${m.code.toLowerCase()}`,
      label: `${m.shortName} ${m.posName || 'POS'} & Barcode Sync`,
      actionLabel: `Open ${m.shortName} Sync`,
      description: `2-way ${m.skuPrefix} barcode check, pre-flight blank fill, and live ${m.shortName} payout staging.`,
      href: `/warehouse/sync/${encodeURIComponent(m.code)}`,
      icon: 'solar:round-transfer-horizontal-bold-duotone',
      iconColor: 'text-secondary',
      badge: '2-Way Sync',
      badgeClass: 'badge-secondary text-secondary-content',
    }));

  const sourcingTools: StudioToolEntry[] = [
    {
      id: 'quick_scout',
      label: 'Quick Scout & Camera Appraisal',
      actionLabel: 'Open Quick Scout',
      description: 'Snap photos in thrift aisles or paste listing details for instant net-profit comps.',
      href: '/scout?quick=true',
      icon: 'solar:scanner-bold',
      iconColor: 'text-primary',
      badge: 'Daily Tool',
      badgeClass: 'badge-primary text-primary-content',
    },
    ...(caps.canUseBuyTracker
      ? [
          {
            id: 'buy_trackers',
            label: 'Active Buy Trackers',
            actionLabel: 'Open Buy Trackers',
            description: 'Track live online bids, combined shipping windows, and local cash pickups before checkout.',
            href: '/scout/trackers',
            icon: 'solar:bookmark-square-minimalistic-bold-duotone',
            iconColor: 'text-secondary',
          } satisfies StudioToolEntry,
        ]
      : []),
    ...(caps.canViewCollectiveTools
      ? [
          {
            id: 'appraisal_lab',
            label: 'Appraisal & Pricing Lab',
            actionLabel: 'Open Pricing Lab',
            description: 'Review secondary-market valuation accuracy, domain rules, and AI usage telemetry.',
            href: '/studios/appraisal',
            icon: 'solar:test-tube-minimalistic-bold-duotone',
            iconColor: 'text-info',
          } satisfies StudioToolEntry,
        ]
      : []),
    ...(caps.canUseBookmarklets
      ? [
          {
            id: 'bookmarklets_hub',
            label: 'Bookmarklet Hub & Mobile Shortcuts',
            actionLabel: 'Open Bookmarklet Hub',
            description: 'Drag desktop Bookmarks Bar pills, copy mobile shortcut keywords, and refresh your 14-day pass.',
            href: '/studios/bookmarklets',
            icon: 'solar:shield-keyhole-bold-duotone',
            iconColor: 'text-warning',
            badge: 'Desktop & Phone',
            badgeClass: 'badge-warning text-warning-content',
          } satisfies StudioToolEntry,
        ]
      : []),
  ];

  const boothBarcodeTools: StudioToolEntry[] = [
    {
      id: 'label_studio',
      label: 'Thermal Label Studio',
      actionLabel: 'Print Thermal Tags',
      description: 'Batch-print crisp 2"×1" Code 128 barcode stickers, booth price tags, and bin labels.',
      href: '/labels/studio',
      icon: 'solar:printer-bold-duotone',
      iconColor: 'text-primary',
    },
    {
      id: 'label_calibration',
      label: 'Printer Feed Calibration',
      actionLabel: 'Run 3-Label Test',
      description: 'Verify tear-bar alignment and label dimensions before printing a full batch.',
      href: '/labels/test',
      icon: 'solar:ruler-pen-bold-duotone',
      iconColor: 'text-accent',
    },
    {
      id: 'camera_tag_scanner',
      label: 'Camera Barcode & QR Scanner',
      actionLabel: 'Scan Shelf Tag',
      description: 'Scan physical HUCK / PDXGL / BB stickers with your phone camera to inspect or move stock.',
      href: '/scout',
      icon: 'solar:qr-code-bold-duotone',
      iconColor: 'text-success',
    },
    ...ricochetBoothTools,
    {
      id: 'booths_storage_overview',
      label: 'Booths & Storage Overview',
      actionLabel: 'View Booths & Storage',
      description: 'Compare Selling Booths vs. Backstock Storage, outbound drops, commission rates, and default intake.',
      href: '/warehouse',
      icon: 'solar:shop-2-bold-duotone',
      iconColor: 'text-primary',
    },
  ];

  const workbenches: StudioWorkbench[] = [
    {
      id: 'sourcing_appraisal',
      emoji: '🔭',
      title: 'Sourcing & Appraisal',
      subtitle: 'Pre-buy comps, live auction trackers, valuation rules, and browser/phone bookmarklets.',
      tools: sourcingTools,
    },
    {
      id: 'booths_barcodes',
      emoji: '🏷️',
      title: 'Booths, Barcodes & Printing',
      subtitle: 'Thermal price tags, camera tag scanning, and 2-way booth POS reconciliation.',
      tools: boothBarcodeTools,
    },
  ];

  if (caps.canViewCollectiveTools) {
    workbenches.push(
      {
        id: 'online_social_web',
        emoji: '📣',
        title: 'Online, Social & Flagship Web',
        subtitle: 'Shared Online Ready Bin co-curation, 8-channel cross-post tracking, and public event schedule.',
        tools: [
          {
            id: 'online_ready_queue',
            label: 'Shared Online Ready Bin',
            actionLabel: 'Open Online Ready Bin',
            description: 'Browse single-unit backstock staged for eBay, Depop, Poshmark, and Whatnot co-curation.',
            href: '/inventory?queue=online_ready',
            icon: 'solar:globus-bold-duotone',
            iconColor: 'text-info',
          },
          {
            id: 'social_tracker',
            label: 'Social Cross-Post & Promo Tracker',
            actionLabel: 'Open Cross-Post Board',
            description: 'Grab plain item/event fact sheets, track IG/TikTok/Whatnot posts, and log verified Promoter hours.',
            href: '/social',
            icon: 'solar:share-circle-bold-duotone',
            iconColor: 'text-secondary',
          },
          {
            id: 'flagship_cms',
            label: 'Events & Flagship Website',
            actionLabel: 'Edit Events & Web',
            description: 'Publish upcoming pop-ups, markets, live streams, and featured Collective cards.',
            href: '/coop/cms',
            icon: 'solar:calendar-mark-bold-duotone',
            iconColor: 'text-primary',
          },
        ],
      },
      {
        id: 'strategy_ai',
        emoji: '🧠',
        title: 'Strategy & Collective AI',
        subtitle: 'Shared AI prompt vault, architecture playbooks, and parked legacy slide studio.',
        tools: [
          {
            id: 'ai_vault',
            label: 'AI Vault & Prompt Maker',
            actionLabel: 'Open AI Vault',
            description: 'Saved research briefs, skill bundles, and structured prompt templates for the Collective.',
            href: '/coop/vault',
            icon: 'solar:notebook-bold-duotone',
            iconColor: 'text-primary',
          },
          {
            id: 'legacy_slide_studio',
            label: 'Parked Legacy Slide Studio',
            actionLabel: 'Open Legacy Slides',
            description: 'Archived multi-slide canvas kept accessible for historical reference.',
            href: '/social?legacyStudio=1',
            icon: 'solar:archive-minimalistic-bold-duotone',
            iconColor: 'text-base-content/70',
          },
        ],
      }
    );
  }

  return workbenches.filter((wb) => wb.tools.length > 0);
}

/**
 * Single shared 5-pillar navigation config consumed by BOTH Desktop `<nav>` and Mobile Drawer
 * in `Navbar.vue` (enforces `<= 5` pillars and `<= 7` links per dropdown — §17).
 */
export function buildResellerNavConfig(
  caps: MemberCapabilities,
  liveWarehouses?: any[]
): NavPillarConfig[] {
  const sellingBooths = getSellingBoothMetas(liveWarehouses);

  const boothLinks: NavDropdownLink[] = [];
  for (const booth of sellingBooths) {
    boothLinks.push({
      id: `booth_${booth.code.toLowerCase()}`,
      label: `${booth.shortName} Booth (${booth.code})`,
      hint: `${booth.feePct}% fee • Drops & Shelf Stock`,
      href: `/warehouse/${encodeURIComponent(booth.code)}`,
      icon: 'solar:shop-2-bold-duotone',
      emoji: booth.icon,
      badge: 'Booth',
      badgeClass: 'badge-ghost',
    });
    if (booth.usesRicochet) {
      boothLinks.push({
        id: `booth_sync_${booth.code.toLowerCase()}`,
        label: `${booth.shortName} POS & Barcode Sync`,
        hint: `2-Way ${booth.skuPrefix} ↔ Barcode & Payouts`,
        href: `/warehouse/sync/${encodeURIComponent(booth.code)}`,
        icon: 'solar:round-transfer-horizontal-bold-duotone',
        iconColor: 'text-secondary',
        badge: '2-Way',
        badgeClass: 'badge-secondary text-secondary-content',
      });
    }
  }

  if (caps.canViewCollectiveTools) {
    boothLinks.push(
      {
        id: 'channel_online_ready',
        label: 'Online Ready Bin',
        hint: 'Shared eBay / Depop / Whatnot Stock',
        href: '/inventory?queue=online_ready',
        icon: 'solar:globus-bold-duotone',
        iconColor: 'text-info',
      },
      {
        id: 'channel_social_tracker',
        label: 'Social Cross-Post Tracker',
        hint: 'Reels, Drop Links & Promoter Hours',
        href: '/social',
        icon: 'solar:share-circle-bold-duotone',
        iconColor: 'text-secondary',
      },
      {
        id: 'channel_events_cms',
        label: 'Events & Flagship Website',
        hint: 'Pop-Ups, Markets & Live Schedule',
        href: '/coop/cms',
        icon: 'solar:calendar-mark-bold-duotone',
        iconColor: 'text-primary',
      }
    );
  }

  boothLinks.push({
    id: 'all_booths_and_storage',
    label: 'Booths & Storage Overview',
    hint: 'Selling Booths + Garage & Hideout Storage',
    href: '/warehouse',
    icon: 'solar:buildings-2-bold-duotone',
    iconColor: 'text-primary',
    badge: 'All 4',
    badgeClass: 'badge-ghost',
  });

  const salesAndCoopLinks: NavDropdownLink[] = [
    ...(caps.canViewSales
      ? [
          {
            id: 'sales_ledger',
            label: 'Sales & Payout Ledger',
            hint: 'Register Tickets & Payout CSV Import',
            href: '/sales',
            icon: 'solar:dollar-minimalistic-bold-duotone',
            iconColor: 'text-success',
          } satisfies NavDropdownLink,
        ]
      : []),
    ...(caps.canViewCollectiveTools
      ? [
          {
            id: 'coop_settlements',
            label: 'Monthly Settlements',
            hint: '4-Gate Waterfall & Partner Statements',
            href: '/coop/settlements',
            icon: 'solar:hand-money-bold-duotone',
            iconColor: 'text-primary',
          } satisfies NavDropdownLink,
          {
            id: 'expenses_receipts',
            label: 'Expenses & Receipts',
            hint: 'Schedule C / Form 1065 Write-Offs',
            href: '/expenses',
            icon: 'solar:bill-list-bold-duotone',
            iconColor: 'text-warning',
          } satisfies NavDropdownLink,
          {
            id: 'coop_governance',
            label: 'Governance & Proposals',
            hint: 'Consent Votes, Hats & Policy Rules',
            href: '/coop/governance',
            icon: 'solar:users-group-two-rounded-bold-duotone',
            iconColor: 'text-secondary',
          } satisfies NavDropdownLink,
          {
            id: 'coop_labor',
            label: 'Sweat-Equity Hours',
            hint: 'Log & Verify Booth / Promo Hours',
            href: '/coop/labor',
            icon: 'solar:clock-circle-bold-duotone',
            iconColor: 'text-accent',
          } satisfies NavDropdownLink,
        ]
      : []),
    {
      id: 'coop_charter',
      label: 'Living Co-op Charter',
      hint: 'Collective Rules & Payout Simulator',
      href: '/coop',
      icon: 'solar:shield-star-bold-duotone',
      iconColor: 'text-primary',
    },
  ];

  const pillars: NavPillarConfig[] = [
    {
      id: 'command',
      label: 'Command',
      icon: 'solar:widget-bold-duotone',
      href: '/dashboard',
      activePrefixes: ['/dashboard'],
    },
    ...(caps.canViewPurchases
      ? [
          {
            id: 'purchases',
            label: 'Purchases',
            icon: 'solar:cart-large-2-bold-duotone',
            href: '/purchases',
            activePrefixes: ['/purchases'],
          } satisfies NavPillarConfig,
        ]
      : []),
    {
      id: 'inventory',
      label: 'Inventory',
      icon: 'solar:box-bold-duotone',
      href: '/inventory',
      activePrefixes: ['/inventory'],
    },
    {
      id: 'booths_channels',
      label: 'Booths & Channels',
      icon: 'solar:shop-2-bold-duotone',
      activePrefixes: ['/warehouse', '/social', '/coop/cms'],
      children: boothLinks.slice(0, MAX_DROPDOWN_ITEMS),
    },
    {
      id: 'sales_coop',
      label: 'Sales & Co-op',
      icon: 'solar:tag-price-bold-duotone',
      activePrefixes: ['/sales', '/expenses', '/coop/settlements', '/coop/governance', '/coop/labor'],
      children: salesAndCoopLinks.slice(0, MAX_DROPDOWN_ITEMS),
    },
  ];

  return pillars.slice(0, MAX_NAV_PILLARS);
}

<template>
  <div v-if="isVisible">
    <!-- UNIVERSAL REUSABLE BOOKMARKLET HERO BAR (Ricochet POS 2-Way Sync & ShopGoodwill Auction Scout) -->
    <div
      class="bg-primary/10 border border-primary/35 rounded-2xl p-3 sm:px-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3"
    >
      <div class="flex items-center gap-2.5 flex-wrap text-xs">
        <span class="badge badge-sm badge-primary text-primary-content font-black font-mono">
          {{ capabilities.roleBadge }} • ✅ Live Auto-Updated Script
        </span>
        <span v-if="tool === 'ricochet_sync' && locationMeta" class="font-bold text-base-content">
          ⚡ {{ locationMeta.shortName }} {{ locationMeta.posName || 'Ricochet POS' }} 2-Way Sync: Drag to your Chrome Bookmarks Bar (<kbd class="kbd kbd-xs">Ctrl+Shift+B</kbd>) to sync Booth Barcodes (<code class="font-mono">{{ locationMeta.skuPrefix }}...</code> ↔ UPC), Outbound Drops &amp; Payout Sales:
        </span>
        <span v-else class="font-bold text-base-content">
          🔭 ShopGoodwill 4-Page Sync: Drag to your Chrome Bookmarks Bar (<kbd class="kbd kbd-xs">Ctrl+Shift+B</kbd>) to sync In-Progress Bids, Won/Lost Auctions, Shipped Orders &amp; Item Pages:
        </span>
      </div>

      <div class="flex items-center gap-2 flex-wrap shrink-0">
        <a
          :href="bookmarkletHref"
          @click.prevent="handleBookmarkletClick"
          class="btn btn-xs sm:btn-sm btn-primary text-primary-content font-black shadow-sm border border-primary-content/20 cursor-grab active:cursor-grabbing gap-1.5"
          :title="`Drag me to your Chrome Bookmarks Bar! (${bookmarkletBarLabel})`"
        >
          <span>{{ bookmarkletBarLabel }}</span>
        </a>

        <!-- Optional Companion Action Slot (e.g., 📌 Buy Trackers on /purchases) -->
        <slot name="companion" />

        <button
          type="button"
          class="btn btn-xs sm:btn-sm btn-outline font-bold gap-1"
          @click="copyBookmarkletHref"
          :title="`Copy javascript: URL for Chrome Bookmarks Bar or mobile Chrome (Pixel 8 keyword: ${mobileKeyword})`"
        >
          <span>📋 Copy JS URL</span>
        </button>

        <button
          type="button"
          class="btn btn-xs sm:btn-sm btn-ghost border border-base-300 font-bold gap-1"
          @click="showGuideModal = true"
        >
          <span>📖 Instructions</span>
        </button>

        <div v-if="quickLinks.length > 0" class="hidden sm:flex items-center gap-1 pl-1 border-l border-base-300">
          <a
            v-for="link in quickLinks"
            :key="link.href"
            :href="link.href"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-2xs btn-ghost border border-base-300 font-bold"
            :title="link.title"
          >
            {{ link.label }}
          </a>
        </div>
      </div>
    </div>

    <!-- UNIVERSAL BOOKMARKLET GUIDE MODAL (Contextualized for Ricochet POS or ShopGoodwill) -->
    <dialog class="modal" :class="{ 'modal-open': showGuideModal }">
      <div class="modal-box max-w-2xl rounded-2xl border border-base-300 space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="font-black text-lg flex items-center gap-2 flex-wrap">
              <span v-if="tool === 'ricochet_sync' && locationMeta">
                ⚡ {{ locationMeta.shortName }} {{ locationMeta.posName || 'Ricochet POS' }} Bookmarklet Guide
              </span>
              <span v-else>
                🔭 Auction Scout &amp; Orders Bookmarklet Guide
              </span>
              <span class="badge badge-sm badge-primary">{{ capabilities.roleBadge }}</span>
            </h3>
            <p v-if="tool === 'ricochet_sync'" class="text-xs opacity-70 mt-0.5">
              One evergreen bookmarklet for Booth Barcode Pre-Flight, Physical Tag Adoption, Outbound Drops &amp; Payout Sales Sync — auto-updates live from Resale Command.
            </p>
            <p v-else class="text-xs opacity-70 mt-0.5">
              One evergreen bookmarklet for all 4 ShopGoodwill pages — zero third-party credentials or cookies ever touched.
            </p>
          </div>
          <button type="button" class="btn btn-sm btn-circle btn-ghost" @click="showGuideModal = false">✕</button>
        </div>

        <!-- 4 Contextual Cards: Ricochet POS -->
        <div v-if="tool === 'ricochet_sync' && locationMeta" class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div class="bg-base-200/70 p-3 rounded-xl border border-base-300 space-y-1">
            <div class="font-black text-primary">1. Booth Inventory &amp; Barcodes (`/products`)</div>
            <p class="opacity-80">
              Scans your active <code class="font-mono">{{ locationMeta.skuPrefix }}...</code> booth catalog, previews blank items in the <span class="font-bold">Pre-Flight Queue</span>, and runs <span class="badge badge-xs badge-warning text-warning-content">🚀 Fill Missing</span> without ever overwriting populated barcodes.
            </p>
          </div>

          <div class="bg-base-200/70 p-3 rounded-xl border border-base-300 space-y-1">
            <div class="font-black text-secondary">2. Physical Tag Safety (`🏷️ Adopt Booth Tag`)</div>
            <p class="opacity-80">
              Whenever a physical shelf sticker at {{ locationMeta.shortName }} differs from Resale Command, click <span class="badge badge-xs badge-secondary text-secondary-content">🏷️ Adopt Booth Tag</span> in 1 tap so RC matches the physical tag—zero re-stickering.
            </p>
          </div>

          <div class="bg-base-200/70 p-3 rounded-xl border border-base-300 space-y-1">
            <div class="font-black text-info">3. Unpaid &amp; Settled Payouts (`/payouts` &amp; `/payout_history`)</div>
            <p class="opacity-80">
              Harvests multi-page Export CSVs directly in memory and stages register tickets (<code class="font-mono">Sale#</code> + calendar <code class="font-mono">Sold Date</code>) into Sales Importer in safe <span class="badge badge-xs badge-info">🧪 Dry-Run</span> mode.
            </p>
          </div>

          <div class="bg-base-200/70 p-3 rounded-xl border border-base-300 space-y-1">
            <div class="font-black text-accent">4. Live Scorecard &amp; On-the-Fly Additions</div>
            <p class="opacity-80">
              Click <span class="font-bold">📡 Send Report to RC</span> inside the widget to stream live <span class="text-success font-bold">Verified</span> / <span class="text-warning font-bold">Missing</span> / <span class="text-info font-bold">New Booth Item</span> counts straight to <code class="font-mono">/warehouse/sync/{{ locationMeta.code }}</code>.
            </p>
          </div>
        </div>

        <!-- 4 Contextual Cards: ShopGoodwill Auction Scout -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div class="bg-base-200/70 p-3 rounded-xl border border-base-300 space-y-1">
            <div class="font-black text-primary">1. In-Progress Auctions (`/inprogress-auctions`)</div>
            <p class="opacity-80">
              Overlays your RC Max Bid ceiling next to each row, flags <span class="badge badge-xs badge-success">🟢 WINNING</span> (🏆 trophy) vs. <span class="badge badge-xs badge-error">🚨 OUTBID</span>, and syncs live prices into your Buy Tracker.
            </p>
          </div>
          <div class="bg-base-200/70 p-3 rounded-xl border border-base-300 space-y-1">
            <div class="font-black text-secondary">2. Closed Auctions (`/closed-auctions`)</div>
            <p class="opacity-80">
              Previews Won vs. Lost rows: promotes <span class="font-bold">Auction won</span> items to <span class="badge badge-xs badge-info">Acquired (HG)</span> and cleans <span class="font-bold">Auction lost</span> items from your Buy Tracker.
            </p>
          </div>
          <div class="bg-base-200/70 p-3 rounded-xl border border-base-300 space-y-1">
            <div class="font-black text-info">3. Shipped Orders (`/shipped-orders`)</div>
            <p class="opacity-80">
              Creates/updates POs with live FedEx/USPS/UPS tracking pills (`🚚 Shipped`) and allocates true landed cost (`Price + Shipping + Handling + Tax`) across items.
            </p>
          </div>
          <div class="bg-base-200/70 p-3 rounded-xl border border-base-300 space-y-1">
            <div class="font-black text-accent">4. Single Item Page (`/item/123456789`)</div>
            <p class="opacity-80">
              Extracts Item ID, title, price, shipping &amp; gallery images and opens Quick Scout or adds directly to your active Buy Tracker.
            </p>
          </div>
        </div>

        <!-- Shared Manual Desktop & Mobile Chrome (Pixel 8) URL Paste Instructions -->
        <div class="bg-base-200/50 rounded-xl p-3 border border-base-300 text-xs space-y-1.5">
          <div class="font-black">📋 Manual Bookmark Update &amp; Mobile Chrome (Pixel 8 / Android) Trick:</div>
          <p class="opacity-80">
            <strong>Desktop Chrome (No Drag):</strong> Click <button type="button" class="link link-primary font-bold" @click="copyBookmarkletHref">📋 Copy JS URL</button>, right-click your Bookmarks Bar (<kbd class="kbd kbd-xs">Ctrl+Shift+B</kbd>) ➔ <strong>Add page...</strong> (or <strong>Edit...</strong> an existing bookmark), name it <code class="font-mono font-bold">{{ bookmarkletBarLabel }}</code>, and paste into the <strong>URL</strong> field.<br />
            <strong>Mobile Chrome (Pixel 8):</strong> Tap <button type="button" class="link link-primary font-bold" @click="copyBookmarkletHref">📋 Copy JS URL</button>, bookmark any page, edit its name to <code class="font-mono font-bold">{{ mobileKeyword }}</code>, and paste into the URL field. On your {{ targetPortalDisplayName }} tab, type <code class="font-mono font-bold">{{ mobileKeyword }}</code> in the address bar and tap the starred suggestion!
          </p>
        </div>

        <div class="modal-action flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-2 flex-wrap">
            <a
              href="/settings?tab=bookmarklets"
              class="btn btn-xs sm:btn-sm btn-ghost border border-base-300 font-bold rounded-xl"
            >
              ⚙️ Customize Label / Keyword
            </a>
            <button
              v-if="showConsoleFallback"
              type="button"
              class="btn btn-xs sm:btn-sm btn-outline btn-warning font-bold rounded-xl"
              @click="openAdvancedGuide"
            >
              🧪 Open Console Fallback &amp; Live Scorecard
            </button>
          </div>
          <button type="button" class="btn btn-sm btn-primary font-bold rounded-xl" @click="showGuideModal = false">
            Got It
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showGuideModal = false">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { buildRicochetBookmarkletHref, type LocationSettingMeta } from '../../lib/warehouses';
import {
  buildEvergreenBookmarkletHref,
  formatBmlBarLabel,
  getCachedBmlRegistryConfig,
  loadBmlRegistryConfig,
  type BookmarkletRegistryConfig,
  type BookmarkletToolId,
} from '../../lib/bml/registry';
import { useMemberCapabilities } from '../../lib/memberAccess';
import { siteConfig } from '../../site-config';
import { addToast } from '../../stores/toast';

const props = withDefaults(
  defineProps<{
    tool: BookmarkletToolId;
    locationMeta?: LocationSettingMeta | null;
    showConsoleFallback?: boolean;
  }>(),
  {
    locationMeta: null,
    showConsoleFallback: false,
  }
);

const emit = defineEmits<{
  (e: 'open-advanced-guide'): void;
}>();

const { capabilities } = useMemberCapabilities();
const showGuideModal = ref(false);
const bmlRegistry = ref<BookmarkletRegistryConfig>(getCachedBmlRegistryConfig());
const browserOrigin = ref(
  typeof window !== 'undefined' ? window.location.origin : siteConfig.siteUrl
);

const isVisible = computed(() => {
  if (!capabilities.value.canUseBml) return false;
  if (props.tool === 'ricochet_sync') {
    return Boolean(props.locationMeta && props.locationMeta.usesRicochet);
  }
  return true;
});

const bookmarkletHref = computed(() => {
  if (props.tool === 'ricochet_sync') {
    return buildRicochetBookmarkletHref(props.locationMeta?.code || 'MD');
  }
  return buildEvergreenBookmarkletHref('/scripts/auction-bookmarklet.js', browserOrigin.value);
});

const bookmarkletBarLabel = computed(() => {
  if (props.tool === 'ricochet_sync') {
    return formatBmlBarLabel(
      bmlRegistry.value.tools.ricochet_sync,
      props.locationMeta?.shortName
    );
  }
  return formatBmlBarLabel(bmlRegistry.value.tools.auction_scout);
});

const mobileKeyword = computed(() => {
  if (props.tool === 'ricochet_sync') {
    const configured = bmlRegistry.value.tools.ricochet_sync?.mobileKeyword;
    if (configured && configured.trim()) return configured.trim().toLowerCase();
    return (props.locationMeta?.code || 'md').toLowerCase();
  }
  const configured = bmlRegistry.value.tools.auction_scout?.mobileKeyword;
  return configured && configured.trim() ? configured.trim().toLowerCase() : 'rcscout';
});

const targetPortalDisplayName = computed(() => {
  if (props.tool === 'ricochet_sync') {
    return props.locationMeta?.posName || props.locationMeta?.shortName || 'Ricochet';
  }
  return 'ShopGoodwill';
});

const quickLinks = computed(() => {
  if (props.tool === 'ricochet_sync') {
    const raw = props.locationMeta?.posPortalUrl || '';
    const base = raw ? raw.replace(/\/+$/, '') : '';
    if (!base) return [];
    const name = props.locationMeta?.shortName || 'Booth';
    const pos = props.locationMeta?.posName || 'POS';
    return [
      {
        label: '📦 Products ↗',
        href: `${base}/products`,
        title: `Open ${name} Products / Inventory on ${pos}`,
      },
      {
        label: '💵 Payouts ↗',
        href: `${base}/payouts`,
        title: `Open ${name} Current Unpaid Payouts on ${pos}`,
      },
      {
        label: '📜 History ↗',
        href: `${base}/payout_history`,
        title: `Open ${name} Settled Payout History on ${pos}`,
      },
    ];
  }
  return [
    {
      label: '🔨 Bidding ↗',
      href: 'https://shopgoodwill.com/shopgoodwill/inprogress-auctions',
      title: 'Open ShopGoodwill Auctions In Progress',
    },
    {
      label: '🏆 Won/Lost ↗',
      href: 'https://shopgoodwill.com/shopgoodwill/closed-auctions',
      title: 'Open ShopGoodwill Closed Auctions (Won / Lost)',
    },
    {
      label: '🚚 Shipped ↗',
      href: 'https://shopgoodwill.com/shopgoodwill/shipped-orders',
      title: 'Open ShopGoodwill Shipped Orders',
    },
  ];
});

const handleBookmarkletClick = () => {
  addToast({
    type: 'info',
    message: `Drag '${bookmarkletBarLabel.value}' up to your Chrome Bookmarks Bar (Ctrl+Shift+B), then click it on your ${targetPortalDisplayName.value} tab!`,
  });
};

const copyBookmarkletHref = async () => {
  try {
    await navigator.clipboard.writeText(bookmarkletHref.value);
    addToast({
      type: 'success',
      message: `Copied ${bookmarkletBarLabel.value} JS URL! Paste into a bookmark URL field (keyword: ${mobileKeyword.value}).`,
    });
  } catch {
    addToast({
      type: 'warning',
      message: 'Could not copy automatically — drag the button to your Bookmarks Bar instead.',
    });
  }
};

const openAdvancedGuide = () => {
  showGuideModal.value = false;
  emit('open-advanced-guide');
};

onMounted(async () => {
  try {
    bmlRegistry.value = await loadBmlRegistryConfig();
  } catch {
    // Keep cached config
  }
});
</script>

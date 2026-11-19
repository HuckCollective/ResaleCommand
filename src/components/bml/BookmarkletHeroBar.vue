<template>
  <div v-if="isVisible">
    <!-- COMPACT BAR VARIANT (Used on /warehouse/sync/:code & /sales/import/:code) -->
    <div
      v-if="variant === 'bar'"
      class="bg-base-100 border border-primary/30 rounded-2xl px-3.5 py-2.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
    >
      <div class="flex items-center gap-2 flex-wrap text-xs min-w-0">
        <span class="badge badge-xs badge-primary text-primary-content font-black whitespace-nowrap shrink-0">
          ✅ Auto-Updated
        </span>
        <span class="font-bold text-base-content">
          Drag to Chrome Bookmarks Bar (<kbd class="kbd kbd-xs">Ctrl+Shift+B</kbd>) or copy for phone
        </span>
      </div>

      <div class="flex items-center gap-2 flex-wrap shrink-0">
        <a
          :href="bookmarkletHref"
          @mousedown="stampFreshHref"
          @dragstart="stampFreshHref"
          @click.prevent="handleBookmarkletClick"
          class="btn btn-sm h-11 md:h-8 btn-primary text-primary-content font-black shadow-xs border border-primary-content/20 cursor-grab active:cursor-grabbing gap-1.5 whitespace-nowrap"
          :title="`Drag me to your Chrome Bookmarks Bar! (${bookmarkletBarLabel})`"
        >
          <span>{{ bookmarkletBarLabel }}</span>
        </a>

        <button
          type="button"
          class="btn btn-sm h-11 md:h-8 btn-outline font-bold gap-1 whitespace-nowrap"
          @click="copyBookmarkletHref"
          :title="`Copy script URL for desktop Bookmarks Bar or mobile browser (keyword: ${mobileKeyword})`"
        >
          <span>📋 Copy Script</span>
        </button>

        <button
          type="button"
          class="btn btn-sm h-11 md:h-8 btn-ghost border border-base-300 font-bold gap-1 whitespace-nowrap"
          @click="showGuideOpen = true"
        >
          <span>📖 Instructions</span>
        </button>
      </div>
    </div>

    <!-- TRAY CARD VARIANT (Used inside Bottom-Sheet Trays — zero nested drawers) -->
    <div
      v-else
      class="bg-base-200/50 border border-base-300 rounded-2xl p-4 space-y-3"
    >
      <div class="flex items-center justify-between gap-2 flex-wrap text-xs">
        <div class="flex items-center gap-2 flex-wrap min-w-0">
          <span class="badge badge-xs badge-primary text-primary-content font-black whitespace-nowrap shrink-0">
            ✅ Auto-Updated
          </span>
          <span class="font-extrabold text-sm text-base-content">
            {{ tool === 'ricochet_sync' ? `${locationMeta?.shortName || 'Booth'} POS Bookmarklet` : 'Auction Scout & Orders Bookmarklet' }}
          </span>
        </div>
        <span class="text-[11px] text-base-content/70">
          Drag to Bookmarks Bar (<kbd class="kbd kbd-xs">Ctrl+Shift+B</kbd>) or copy for phone
        </span>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <a
          :href="bookmarkletHref"
          @mousedown="stampFreshHref"
          @dragstart="stampFreshHref"
          @click.prevent="handleBookmarkletClick"
          class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content font-black shadow-xs border border-primary-content/20 cursor-grab active:cursor-grabbing gap-1.5 whitespace-nowrap"
          :title="`Drag me to your Chrome Bookmarks Bar! (${bookmarkletBarLabel})`"
        >
          <span>{{ bookmarkletBarLabel }}</span>
        </a>

        <button
          type="button"
          class="btn btn-sm h-11 md:h-9 btn-outline font-bold gap-1 whitespace-nowrap"
          @click="copyBookmarkletHref"
          :title="`Copy script URL for desktop Bookmarks Bar or mobile browser (keyword: ${mobileKeyword})`"
        >
          <span>📋 Copy Script</span>
        </button>

        <button
          type="button"
          class="btn btn-sm h-11 md:h-9 btn-ghost border border-base-300 font-bold gap-1 whitespace-nowrap"
          @click="showInlineGuide = !showInlineGuide"
        >
          <span>📖 Instructions</span>
          <span class="text-[10px] opacity-70">{{ showInlineGuide ? '▲' : '▼' }}</span>
        </button>
      </div>

      <!-- Wrapped Portal Quick-Jump Links (Zero right-edge clipping) -->
      <div
        v-if="shouldShowQuickLinks && quickLinks.length > 0"
        class="flex flex-wrap items-center gap-1.5 pt-1 border-t border-base-300/70"
      >
        <span class="text-[11px] font-bold text-base-content/65 mr-1">Open Portal:</span>
        <a
          v-for="link in quickLinks"
          :key="link.href"
          :href="link.href"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-xs h-8 btn-ghost border border-base-300 font-bold rounded-xl whitespace-nowrap"
          :title="link.title"
        >
          {{ link.label }}
        </a>
      </div>

      <!-- Inline Expandable Setup & Workflow Guide (Zero nested SlideOverDrawer in Trays — §16) -->
      <div
        v-if="showInlineGuide"
        class="pt-3 border-t border-base-300 space-y-3 text-xs"
      >
        <div v-if="tool === 'ricochet_sync' && locationMeta" class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div class="bg-base-100 p-3 rounded-xl border border-base-300 space-y-1">
            <div class="font-black text-primary">1. Booth Inventory &amp; Barcodes</div>
            <p class="text-base-content/80">
              Scans your active <code class="font-mono">{{ locationMeta.skuPrefix }}...</code> booth catalog, previews blank items, and runs <span class="badge badge-xs badge-warning text-warning-content">🚀 Fill Missing</span> without overwriting existing tags.
            </p>
          </div>
          <div class="bg-base-100 p-3 rounded-xl border border-base-300 space-y-1">
            <div class="font-black text-secondary">2. Physical Tag Safety (🏷️ Adopt Booth Tag)</div>
            <p class="text-base-content/80">
              Whenever a physical shelf sticker at {{ locationMeta.shortName }} differs, click <span class="badge badge-xs badge-secondary text-secondary-content">🏷️ Adopt Booth Tag</span> so your ledger matches the sticker.
            </p>
          </div>
          <div class="bg-base-100 p-3 rounded-xl border border-base-300 space-y-1">
            <div class="font-black text-info">3. Unpaid &amp; Settled Payouts</div>
            <p class="text-base-content/80">
              Harvests payout CSVs directly on the POS page and stages register tickets into Sales Importer in safe dry-run preview mode.
            </p>
          </div>
          <div class="bg-base-100 p-3 rounded-xl border border-base-300 space-y-1">
            <div class="font-black text-accent">4. Sync Queue &amp; Live Scorecard</div>
            <p class="text-base-content/80">
              Apply queued stock pulls/retags inside the <strong>🧹 Queue</strong> tab or send live counts straight to <code class="font-mono">/warehouse/sync/{{ locationMeta.code }}</code>.
            </p>
          </div>
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div class="bg-base-100 p-3 rounded-xl border border-base-300 space-y-1">
            <div class="font-black text-primary">1. In-Progress Auctions</div>
            <p class="text-base-content/80">
              Shows your Max Bid ceiling next to each row, flags winning vs. outbid status, and syncs live prices into your Buy Tracker.
            </p>
          </div>
          <div class="bg-base-100 p-3 rounded-xl border border-base-300 space-y-1">
            <div class="font-black text-secondary">2. Closed Auctions</div>
            <p class="text-base-content/80">
              Previews Won vs. Lost rows: moves won items into acquired backstock and cleans lost items from your Buy Tracker.
            </p>
          </div>
          <div class="bg-base-100 p-3 rounded-xl border border-base-300 space-y-1">
            <div class="font-black text-info">3. Shipped Orders</div>
            <p class="text-base-content/80">
              Creates/updates Purchase Orders with live carrier tracking pills and allocates landed cost across items.
            </p>
          </div>
          <div class="bg-base-100 p-3 rounded-xl border border-base-300 space-y-1">
            <div class="font-black text-accent">4. Single Item Page Speed Scout</div>
            <p class="text-base-content/80">
              Extracts gallery photos, title, price, and shipping on ShopGoodwill, eBay, FB Marketplace, HiBid, CTBids &amp; EstateSales.net for AI Quick Scout.
            </p>
          </div>
        </div>

        <div class="bg-base-100 rounded-xl p-3 border border-base-300 space-y-1.5">
          <div class="font-black">📋 Desktop &amp; Phone Setup</div>
          <p class="text-base-content/80">
            <strong>Desktop:</strong> Drag <span class="font-bold">{{ bookmarkletBarLabel }}</span> onto your Bookmarks Bar (<kbd class="kbd kbd-xs">Ctrl+Shift+B</kbd>), or click <strong>📋 Copy Script</strong> ➔ right-click Bar ➔ <strong>Add page...</strong> and paste into URL.<br />
            <strong>Phone:</strong> Tap <strong>📋 Copy Script</strong>, bookmark any page, name it starting with <code class="font-mono font-bold">{{ mobileKeyword }}</code>, and paste the script URL. Type <code class="font-mono font-bold">{{ mobileKeyword }}</code> in your browser address bar and tap the ★ bookmark suggestion!
          </p>
        </div>

        <div class="flex items-center justify-between gap-2 flex-wrap">
          <a
            href="/studios/bookmarklets"
            class="btn btn-xs h-9 btn-ghost border border-base-300 font-bold rounded-xl"
          >
            ⚙️ Customize Label / Phone Keyword
          </a>
          <span v-if="targetHost" class="text-[10px] font-mono text-base-content/60">
            Host: {{ targetHost }}
          </span>
        </div>
      </div>
    </div>

    <!-- CANONICAL SLIDE-OVER INSTRUCTIONS DRAWER (variant === 'bar' only; replaces raw <dialog>) -->
    <SlideOverDrawer
      v-if="variant === 'bar'"
      v-model="showGuideOpen"
      :title="guideTitle"
      :subtitle="guideSubtitle"
      size="lg"
    >
      <div class="space-y-4 text-xs">
        <div v-if="quickLinks.length > 0" class="bg-base-200/60 border border-base-300 rounded-2xl p-3 space-y-2">
          <div class="font-black text-base-content">Open {{ targetPortalDisplayName }} Pages</div>
          <div class="flex flex-wrap items-center gap-2">
            <a
              v-for="link in quickLinks"
              :key="link.href"
              :href="link.href"
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-sm h-10 md:h-8 btn-outline font-bold rounded-xl"
              :title="link.title"
            >
              {{ link.label }}
            </a>
          </div>
        </div>

        <div v-if="tool === 'ricochet_sync' && locationMeta" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="bg-base-200/70 p-3 rounded-xl border border-base-300 space-y-1">
            <div class="font-black text-primary">1. Booth Inventory &amp; Barcodes</div>
            <p class="opacity-80">
              Scans your active <code class="font-mono">{{ locationMeta.skuPrefix }}...</code> booth catalog, previews blank items in the <span class="font-bold">Pre-Flight Queue</span>, and runs <span class="badge badge-xs badge-warning text-warning-content">🚀 Fill Missing</span> without ever overwriting populated barcodes.
            </p>
          </div>

          <div class="bg-base-200/70 p-3 rounded-xl border border-base-300 space-y-1">
            <div class="font-black text-secondary">2. Physical Tag Safety (🏷️ Adopt Booth Tag)</div>
            <p class="opacity-80">
              Whenever a physical shelf sticker at {{ locationMeta.shortName }} differs from your catalog, click <span class="badge badge-xs badge-secondary text-secondary-content">🏷️ Adopt Booth Tag</span> in 1 tap so your records match the physical sticker.
            </p>
          </div>

          <div class="bg-base-200/70 p-3 rounded-xl border border-base-300 space-y-1">
            <div class="font-black text-info">3. Unpaid &amp; Settled Payouts</div>
            <p class="opacity-80">
              Harvests multi-page export sheets directly in the browser and stages register tickets (<code class="font-mono">Sale#</code> + calendar <code class="font-mono">Sold Date</code>) into Sales Importer in safe <span class="badge badge-xs badge-info">🧪 Dry-Run</span> mode.
            </p>
          </div>

          <div class="bg-base-200/70 p-3 rounded-xl border border-base-300 space-y-1">
            <div class="font-black text-accent">4. Sync Queue &amp; Live Scorecard</div>
            <p class="opacity-80">
              Apply queued tag removals inside <strong>🧹 Queue</strong> or click <span class="font-bold">📡 Send Report</span> to stream live counts to <code class="font-mono">/warehouse/sync/{{ locationMeta.code }}</code>.
            </p>
          </div>
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="bg-base-200/70 p-3 rounded-xl border border-base-300 space-y-1">
            <div class="font-black text-primary">1. In-Progress Auctions</div>
            <p class="opacity-80">
              Overlays your Max Bid ceiling next to each row, flags <span class="badge badge-xs badge-success">🟢 WINNING</span> vs. <span class="badge badge-xs badge-error">🚨 OUTBID</span>, and syncs live prices into your Buy Tracker.
            </p>
          </div>
          <div class="bg-base-200/70 p-3 rounded-xl border border-base-300 space-y-1">
            <div class="font-black text-secondary">2. Closed Auctions</div>
            <p class="opacity-80">
              Previews Won vs. Lost rows: promotes <span class="font-bold">Auction won</span> items into Backstock and cleans <span class="font-bold">Auction lost</span> items from your Buy Tracker.
            </p>
          </div>
          <div class="bg-base-200/70 p-3 rounded-xl border border-base-300 space-y-1">
            <div class="font-black text-info">3. Shipped Orders</div>
            <p class="opacity-80">
              Creates/updates POs with live FedEx/USPS/UPS tracking pills and allocates true landed cost across items.
            </p>
          </div>
          <div class="bg-base-200/70 p-3 rounded-xl border border-base-300 space-y-1">
            <div class="font-black text-accent">4. Single Item Speed Scout</div>
            <p class="opacity-80">
              Extracts Item ID, title, price, shipping &amp; gallery images and opens Quick Scout or adds directly to your active Buy Tracker.
            </p>
          </div>
        </div>

        <div class="bg-base-200/50 rounded-xl p-3 border border-base-300 space-y-1.5">
          <div class="font-black">📋 Desktop Bar &amp; Mobile Browser Shortcut Setup</div>
          <p class="opacity-80 leading-relaxed">
            <strong>Desktop (Drag or Copy):</strong> Drag <span class="font-bold">{{ bookmarkletBarLabel }}</span> to your Chrome Bookmarks Bar (<kbd class="kbd kbd-xs">Ctrl+Shift+B</kbd>), or click <button type="button" class="link link-primary font-bold" @click="copyBookmarkletHref">📋 Copy Script</button> ➔ right-click your Bookmarks Bar ➔ <strong>Add page...</strong>, name it <code class="font-mono font-bold">{{ bookmarkletBarLabel }}</code>, and paste into the <strong>URL</strong> field.<br />
            <strong>Phone:</strong> Tap <button type="button" class="link link-primary font-bold" @click="copyBookmarkletHref">📋 Copy Script</button>, bookmark any page, edit its name to start with <code class="font-mono font-bold">{{ mobileKeyword }}</code>, and paste the script URL. Type <code class="font-mono font-bold">{{ mobileKeyword }}</code> in your mobile browser address bar and tap the ★ starred suggestion!
          </p>
        </div>

        <p v-if="targetHost" class="text-[11px] font-mono text-base-content/60">
          Connected Host: {{ targetHost }} · {{ capabilities.roleBadge }}
        </p>
      </div>

      <template #footer>
        <div class="flex items-center justify-between gap-2 flex-wrap w-full">
          <div class="flex items-center gap-2 flex-wrap">
            <a
              href="/studios/bookmarklets"
              class="btn btn-sm h-10 md:h-9 btn-ghost border border-base-300 font-bold rounded-xl"
            >
              ⚙️ Customize Label / Keyword
            </a>
            <button
              v-if="showConsoleFallback"
              type="button"
              class="btn btn-sm h-10 md:h-9 btn-outline btn-warning font-bold rounded-xl"
              @click="openAdvancedGuide"
            >
              🧪 Console Fallback &amp; Scorecard
            </button>
          </div>
          <button type="button" class="btn btn-sm h-10 md:h-9 btn-primary text-primary-content font-black rounded-xl px-5" @click="showGuideOpen = false">
            Got It
          </button>
        </div>
      </template>
    </SlideOverDrawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import SlideOverDrawer from '../common/SlideOverDrawer.vue';
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
import { addToast } from '../../stores/toast';

const props = withDefaults(
  defineProps<{
    tool: BookmarkletToolId;
    locationMeta?: LocationSettingMeta | null;
    showConsoleFallback?: boolean;
    variant?: 'bar' | 'tray';
    showQuickLinks?: boolean;
  }>(),
  {
    locationMeta: null,
    showConsoleFallback: false,
    variant: 'bar',
    showQuickLinks: undefined,
  }
);

const emit = defineEmits<{
  (e: 'open-advanced-guide'): void;
}>();

const { capabilities } = useMemberCapabilities();
const showGuideOpen = ref(false);
const showInlineGuide = ref(false);
const bmlRegistry = ref<BookmarkletRegistryConfig>(getCachedBmlRegistryConfig());
// SSR-hydration lock: start EMPTY on server and client; onMounted() then produces a real change so Vue patches the href.
const browserOrigin = ref<string>('');
const targetHost = computed(() => {
  try {
    return browserOrigin.value ? new URL(browserOrigin.value).host : '';
  } catch {
    return browserOrigin.value;
  }
});

const shouldShowQuickLinks = computed(() => {
  if (typeof props.showQuickLinks === 'boolean') return props.showQuickLinks;
  return props.variant === 'tray';
});

const guideTitle = computed(() => {
  if (props.tool === 'ricochet_sync' && props.locationMeta) {
    return `⚡ ${props.locationMeta.shortName} ${props.locationMeta.posName || 'Ricochet POS'} Guide`;
  }
  return '🔭 Auction Scout & Orders Guide';
});

const guideSubtitle = computed(() => {
  if (props.tool === 'ricochet_sync') {
    return 'Evergreen bookmarklet for booth barcodes, tag safety, outbound drops & payout sales — updates automatically.';
  }
  return 'Evergreen bookmarklet for 12-photo AI Quick Scout and ShopGoodwill Order Sync — never reads external logins or cookies.';
});

const isVisible = computed(() => {
  if (!capabilities.value.canUseBml) return false;
  if (props.tool === 'ricochet_sync') {
    return Boolean(props.locationMeta && props.locationMeta.usesRicochet);
  }
  return true;
});

const buildHref = (origin?: string) => {
  if (props.tool === 'ricochet_sync') {
    return buildRicochetBookmarkletHref(props.locationMeta?.code || 'MD', origin || undefined);
  }
  return buildEvergreenBookmarkletHref('/scripts/auction-bookmarklet.js', origin || undefined);
};

const bookmarkletHref = computed(() => buildHref(browserOrigin.value));

/** Re-stamps the anchor synchronously from the LIVE page origin right before a drag / click begins. */
const stampFreshHref = (event: Event) => {
  if (typeof window === 'undefined' || !window.location?.origin) return;
  const anchor = event.currentTarget as HTMLAnchorElement | null;
  if (!anchor) return;
  const fresh = buildHref(window.location.origin);
  if (anchor.getAttribute('href') !== fresh) anchor.setAttribute('href', fresh);
};

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
        label: '⚡ Open Ricochet POS ↗',
        href: `${base}/dashboard#`,
        title: `Open ${name} on ${pos} (Inventory, Payout & Payout History tabs)`,
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
      message: `Copied ${bookmarkletBarLabel.value} Script URL! Paste into a bookmark URL field (shortcut keyword: ${mobileKeyword.value}).`,
    });
  } catch {
    addToast({
      type: 'warning',
      message: 'Could not copy automatically — drag the button to your Bookmarks Bar instead.',
    });
  }
};

const openAdvancedGuide = () => {
  showGuideOpen.value = false;
  emit('open-advanced-guide');
};

onMounted(async () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    browserOrigin.value = window.location.origin;
  }
  try {
    bmlRegistry.value = await loadBmlRegistryConfig();
  } catch {
    // Keep cached config
  }
});
</script>

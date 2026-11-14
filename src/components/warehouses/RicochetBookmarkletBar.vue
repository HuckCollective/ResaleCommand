<template>
  <div v-if="locationMeta && locationMeta.usesRicochet && capabilities.canUseBml">
    <!-- FOUNDER/CURATOR RICOCHET POS 2-WAY SYNC BOOKMARKLET BAR (Matches Auction Scout & Orders Pattern) -->
    <div
      class="bg-primary/10 border border-primary/35 rounded-2xl p-3 sm:px-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3"
    >
      <div class="flex items-center gap-2.5 flex-wrap text-xs">
        <span class="badge badge-sm badge-primary text-primary-content font-black font-mono">
          {{ capabilities.roleBadge }} • ✅ Live Auto-Updated Script
        </span>
        <span class="font-bold text-base-content">
          ⚡ {{ locationMeta.shortName }} {{ locationMeta.posName || 'Ricochet POS' }} 2-Way Sync: Drag to your Chrome Bookmarks Bar (<kbd class="kbd kbd-xs">Ctrl+Shift+B</kbd>) to sync Booth Barcodes (<code class="font-mono">{{ locationMeta.skuPrefix }}...</code> ↔ UPC), Outbound Drops &amp; Payout Sales:
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

        <a
          v-if="context === 'detail'"
          :href="'/warehouse/sync/' + encodeURIComponent(locationMeta.code)"
          class="btn btn-xs sm:btn-sm btn-secondary text-secondary-content font-black shadow-2xs gap-1"
          :title="`Open ${locationMeta.shortName} Inventory & Barcode Sync (/warehouse/sync/${locationMeta.code})`"
        >
          <span>🌐 Inventory Sync</span>
        </a>

        <a
          v-else
          :href="'/sales/import/' + encodeURIComponent(locationMeta.code)"
          class="btn btn-xs sm:btn-sm btn-secondary text-secondary-content font-black shadow-2xs gap-1"
          :title="`Open ${locationMeta.shortName} Sales & Payout Importer (/sales/import/${locationMeta.code})`"
        >
          <span>📥 Sales Importer</span>
        </a>

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

        <div v-if="portalBaseUrl" class="hidden sm:flex items-center gap-1 pl-1 border-l border-base-300">
          <a
            :href="portalBaseUrl + '/products'"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-2xs btn-ghost border border-base-300 font-bold"
            :title="`Open ${locationMeta.shortName} Products / Inventory on ${locationMeta.posName}`"
          >
            📦 Products ↗
          </a>
          <a
            :href="portalBaseUrl + '/payouts'"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-2xs btn-ghost border border-base-300 font-bold"
            :title="`Open ${locationMeta.shortName} Current Unpaid Payouts on ${locationMeta.posName}`"
          >
            💵 Payouts ↗
          </a>
          <a
            :href="portalBaseUrl + '/payout_history'"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-2xs btn-ghost border border-base-300 font-bold"
            :title="`Open ${locationMeta.shortName} Settled Payout History on ${locationMeta.posName}`"
          >
            📜 History ↗
          </a>
        </div>
      </div>
    </div>

    <!-- How to Use Ricochet POS 2-Way Sync Bookmarklet Modal (Matches Auction Scout Guide Pattern) -->
    <dialog class="modal" :class="{ 'modal-open': showGuideModal }">
      <div class="modal-box max-w-2xl rounded-2xl border border-base-300 space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="font-black text-lg flex items-center gap-2 flex-wrap">
              <span>⚡ {{ locationMeta.shortName }} {{ locationMeta.posName || 'Ricochet POS' }} Bookmarklet Guide</span>
              <span class="badge badge-sm badge-primary">{{ capabilities.roleBadge }}</span>
            </h3>
            <p class="text-xs opacity-70 mt-0.5">
              One evergreen bookmarklet for Booth Barcode Pre-Flight, Physical Tag Adoption, Outbound Drops &amp; Payout Sales Sync — auto-updates live from Resale Command.
            </p>
          </div>
          <button type="button" class="btn btn-sm btn-circle btn-ghost" @click="showGuideModal = false">✕</button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
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

        <div class="bg-base-200/50 rounded-xl p-3 border border-base-300 text-xs space-y-1.5">
          <div class="font-black">📋 Manual Bookmark Update &amp; Mobile Chrome (Pixel 8 / Android) Trick:</div>
          <p class="opacity-80">
            <strong>Desktop Chrome (No Drag):</strong> Click <button type="button" class="link link-primary font-bold" @click="copyBookmarkletHref">📋 Copy JS URL</button>, right-click your Bookmarks Bar (<kbd class="kbd kbd-xs">Ctrl+Shift+B</kbd>) ➔ <strong>Add page...</strong> (or <strong>Edit...</strong> an existing bookmark), name it <code class="font-mono font-bold">{{ bookmarkletBarLabel }}</code>, and paste into the <strong>URL</strong> field.<br />
            <strong>Mobile Chrome (Pixel 8):</strong> Tap <button type="button" class="link link-primary font-bold" @click="copyBookmarkletHref">📋 Copy JS URL</button>, bookmark any page, edit its name to <code class="font-mono font-bold">{{ mobileKeyword }}</code>, and paste into the URL field. On your {{ locationMeta.posName || 'Ricochet' }} tab, type <code class="font-mono font-bold">{{ mobileKeyword }}</code> in the address bar and tap the starred suggestion!
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
              v-if="context === 'sync'"
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
  formatBmlBarLabel,
  getCachedBmlRegistryConfig,
  loadBmlRegistryConfig,
  type BookmarkletRegistryConfig,
} from '../../lib/bml/registry';
import { useMemberCapabilities } from '../../lib/memberAccess';
import { addToast } from '../../stores/toast';

const props = withDefaults(
  defineProps<{
    locationMeta: LocationSettingMeta;
    context?: 'detail' | 'sync';
  }>(),
  {
    context: 'detail',
  }
);

const emit = defineEmits<{
  (e: 'open-advanced-guide'): void;
}>();

const { capabilities } = useMemberCapabilities();
const showGuideModal = ref(false);
const bmlRegistry = ref<BookmarkletRegistryConfig>(getCachedBmlRegistryConfig());

const bookmarkletHref = computed(() =>
  buildRicochetBookmarkletHref(props.locationMeta?.code || 'MD')
);

const bookmarkletBarLabel = computed(() =>
  formatBmlBarLabel(bmlRegistry.value.tools.ricochet_sync, props.locationMeta?.shortName)
);

const mobileKeyword = computed(() => {
  const configured = bmlRegistry.value.tools.ricochet_sync?.mobileKeyword;
  if (configured && configured.trim()) return configured.trim().toLowerCase();
  return (props.locationMeta?.code || 'md').toLowerCase();
});

const portalBaseUrl = computed(() => {
  const raw = props.locationMeta?.posPortalUrl || '';
  return raw ? raw.replace(/\/+$/, '') : '';
});

const handleBookmarkletClick = () => {
  addToast({
    type: 'info',
    message: `Drag '${bookmarkletBarLabel.value}' up to your Chrome Bookmarks Bar (Ctrl+Shift+B), then click it on your ${props.locationMeta?.shortName || 'Ricochet'} tab!`,
  });
};

const copyBookmarkletHref = async () => {
  try {
    await navigator.clipboard.writeText(bookmarkletHref.value);
    addToast({
      type: 'success',
      message: `Copied ${props.locationMeta?.shortName || 'Ricochet'} Sync JS URL! Paste into a bookmark URL field (keyword: ${mobileKeyword.value}).`,
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

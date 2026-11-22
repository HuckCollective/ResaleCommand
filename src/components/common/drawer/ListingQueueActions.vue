<template>
  <section class="rounded-2xl border border-base-300 bg-base-200/40 p-3.5 sm:p-4 space-y-3">
    <div class="flex items-start justify-between gap-2 flex-wrap">
      <div>
        <div class="flex items-center gap-2 flex-wrap">
          <h4 class="text-xs font-extrabold uppercase tracking-wider text-base-content/85">
            Browser Listing Assistant (Poshmark · Depop · eBay · Whatnot)
          </h4>
          <span
            v-if="queuedCount > 0"
            class="badge badge-xs badge-info text-info-content font-bold whitespace-nowrap shrink-0"
          >
            {{ queuedCount }} Waiting in Browser
          </span>
        </div>
        <p class="text-[11px] text-base-content/70 mt-0.5 leading-snug">
          Queue this item for your logged-in browser tab — fills title, copy, price, SKU &amp; photos, then you review and press Submit.
        </p>
      </div>

      <a
        href="/studios/bookmarklets"
        class="btn btn-xs h-11 md:h-8 btn-ghost border border-base-300 rounded-lg font-bold gap-1 shrink-0"
      >
        <Icon icon="solar:bolt-bold" class="w-3.5 h-3.5 text-primary shrink-0" />
        <span>Get Bookmarklet</span>
      </a>
    </div>

    <div
      v-if="blockedReason"
      role="alert"
      class="rounded-xl bg-warning/15 border border-warning/40 px-3 py-2 text-xs text-base-content"
    >
      {{ blockedReason }}
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div
        v-for="plat in platformCards"
        :key="plat.id"
        class="rounded-xl border p-2.5 bg-base-100 flex flex-col justify-between gap-2"
        :class="queuedByPlatform[plat.id] ? 'border-info/60 bg-info/5' : 'border-base-300'"
      >
        <div class="space-y-0.5">
          <div class="flex items-center justify-between gap-1">
            <span class="font-bold text-xs text-base-content truncate">{{ plat.emoji }} {{ plat.shortLabel }}</span>
            <span
              v-if="queuedByPlatform[plat.id]"
              class="badge badge-xs badge-info text-info-content font-bold whitespace-nowrap shrink-0"
            >
              Queued
            </span>
          </div>
          <div class="text-[10px] text-base-content/65 leading-tight">{{ plat.feeSummary }}</div>
        </div>

        <div class="flex items-center gap-1">
          <button
            type="button"
            :disabled="Boolean(blockedReason) || busyPlatform === plat.id"
            class="btn btn-xs h-11 md:h-8 flex-1 rounded-lg font-bold"
            :class="queuedByPlatform[plat.id] ? 'btn-outline btn-info' : 'btn-primary text-primary-content'"
            @click="queuePlatform(plat.id)"
          >
            <span v-if="busyPlatform === plat.id" class="loading loading-spinner loading-xs"></span>
            <span v-else>{{ queuedByPlatform[plat.id] ? 'Re-Queue' : `Queue ${plat.shortLabel}` }}</span>
          </button>
          <a
            :href="plat.createListingUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-xs h-11 w-11 md:h-8 md:w-8 btn-ghost border border-base-300 rounded-lg shrink-0"
            :title="`Open ${plat.label} Create Listing page`"
            :aria-label="`Open ${plat.label} Create Listing page`"
          >
            ↗
          </a>
        </div>
      </div>
    </div>

    <div class="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-base-300/70">
      <span class="text-[11px] text-base-content/65">
        Need a quick spreadsheet upload instead?
      </span>
      <div class="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          class="btn btn-xs h-11 md:h-8 btn-outline rounded-lg font-bold gap-1"
          @click="exportSingleCsv('whatnot')"
        >
          <span>Download Whatnot CSV</span>
        </button>
        <button
          type="button"
          class="btn btn-xs h-11 md:h-8 btn-outline rounded-lg font-bold gap-1"
          @click="exportSingleCsv('ebay')"
        >
          <span>Download eBay CSV</span>
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { getCoopJwtHeaders } from '../../../lib/coopLedgerClient';
import { downloadCsv, generateEbayCsv, generateWhatnotCsv } from '../../../lib/exportUtils';
import {
  LISTING_ASSIST_PLATFORMS,
  LISTING_PLATFORM_LIMITS,
  checkListingAssistEligibility,
  type ListingAssistPlatform,
} from '../../../lib/onlineListingPacket';
import { toUserMessage } from '../../../lib/userFacingErrors';
import { addToast } from '../../../stores/toast';

const props = defineProps<{
  item: Record<string, any> | null;
  binFacility: 'HG' | 'HH';
}>();

const busyPlatform = ref<ListingAssistPlatform | ''>('');
const queuedByPlatform = ref<Record<string, boolean>>({});

const platformCards = computed(() =>
  LISTING_ASSIST_PLATFORMS.map((id) => LISTING_PLATFORM_LIMITS[id])
);

const eligibility = computed(() => checkListingAssistEligibility(props.item));
const blockedReason = computed(() => (eligibility.value.eligible ? '' : eligibility.value.reason || ''));
const queuedCount = computed(() => Object.values(queuedByPlatform.value).filter(Boolean).length);

const loadQueueStatus = async () => {
  const itemId = String(props.item?.$id || '').trim();
  if (!itemId) {
    queuedByPlatform.value = {};
    return;
  }
  try {
    const headers = await getCoopJwtHeaders();
    const responses = await Promise.all(
      (['HH', 'HG'] as const).map((loc) =>
        fetch(`/api/sync/channel-outbox?location=${loc}`, { method: 'GET', headers })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    );
    const nextMap: Record<string, boolean> = {};
    for (const res of responses) {
      const pending = Array.isArray(res?.pendingIntents) ? res.pendingIntents : [];
      for (const intent of pending) {
        if (intent?.rcItemId === itemId && intent?.action === 'publish_listing') {
          const plat = String(intent?.platform || intent?.payload?.platform || '').toLowerCase();
          if (plat) nextMap[plat] = true;
        }
      }
    }
    queuedByPlatform.value = nextMap;
  } catch {
    // Non-blocking badge hydration
  }
};

watch(
  () => props.item?.$id,
  () => {
    void loadQueueStatus();
  },
  { immediate: true }
);

const queuePlatform = async (platform: ListingAssistPlatform) => {
  const item = props.item;
  const itemId = String(item?.$id || '').trim();
  if (!item || !itemId || blockedReason.value || busyPlatform.value) return;

  busyPlatform.value = platform;
  try {
    const headers = await getCoopJwtHeaders();
    const sku = String(item.upc || item.sku || '').trim().toUpperCase();
    const title = String(item.title || item.identity || 'Curated Find').trim().slice(0, 140);
    const locationCode = props.binFacility === 'HG' ? 'HG' : 'HH';
    const meta = LISTING_PLATFORM_LIMITS[platform];

    const res = await fetch('/api/sync/channel-outbox', {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'enqueue',
        locationCode,
        intent: {
          action: 'publish_listing',
          platform,
          rcItemId: itemId,
          rcUpc: sku,
          title,
          reason: `Queued for ${meta.label} Listing Assistant`,
          payload: { platform },
        },
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || `Could not queue for ${meta.label}.`);
    }

    queuedByPlatform.value = { ...queuedByPlatform.value, [platform]: true };
    addToast({
      type: 'success',
      message: `Queued for ${meta.label} — open ${meta.label} and click 🚀 Listing Assistant to fill the form.`,
    });
  } catch (err: any) {
    addToast({
      type: 'error',
      message: toUserMessage(err, 'Could not queue this item for the browser assistant right now.'),
    });
  } finally {
    busyPlatform.value = '';
  }
};

const exportSingleCsv = (kind: 'whatnot' | 'ebay') => {
  if (!props.item) return;
  const sku = String(props.item.upc || props.item.sku || props.item.$id || 'item')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-');
  if (kind === 'whatnot') {
    downloadCsv(generateWhatnotCsv([props.item]), `whatnot-${sku}.csv`);
    addToast({ type: 'success', message: 'Downloaded Whatnot Seller Hub CSV.' });
  } else {
    downloadCsv(generateEbayCsv([props.item]), `ebay-${sku}.csv`);
    addToast({ type: 'success', message: 'Downloaded eBay Seller Hub CSV.' });
  }
};
</script>

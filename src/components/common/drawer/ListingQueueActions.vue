<template>
  <section class="rounded-2xl border border-base-300 bg-base-200/40 p-3.5 sm:p-4 space-y-3">
    <div class="flex items-start justify-between gap-2 flex-wrap">
      <div>
        <div class="flex items-center gap-2 flex-wrap">
          <h4 class="text-xs font-extrabold uppercase tracking-wider text-base-content/85">
            Safe Cross-List Copy Kit &amp; Official CSVs
          </h4>
          <span class="badge badge-xs badge-success text-success-content font-bold whitespace-nowrap shrink-0">
            Zero Site Scripts
          </span>
        </div>
        <p class="text-[11px] text-base-content/70 mt-0.5 leading-snug">
          Copy formatted fields side-by-side or upload an official Seller Hub CSV — nothing ever injects into external marketplace tabs.
        </p>
      </div>

      <a
        :href="activeMeta.createListingUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="btn btn-xs h-11 md:h-8 btn-outline rounded-lg font-bold gap-1 shrink-0"
      >
        <span>Open {{ activeMeta.label }} ↗</span>
      </a>
    </div>

    <div
      v-if="blockedReason"
      role="alert"
      class="rounded-xl bg-warning/15 border border-warning/40 px-3 py-2 text-xs text-base-content"
    >
      {{ blockedReason }}
    </div>

    <template v-else>
      <!-- Platform Picker Pills (<= 4 chips per Hick's Law) -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        <button
          v-for="plat in platformCards"
          :key="plat.id"
          type="button"
          class="btn btn-xs h-11 md:h-9 rounded-xl font-bold justify-start px-2.5 gap-1.5"
          :class="
            activePlatform === plat.id
              ? 'btn-primary text-primary-content'
              : 'btn-ghost bg-base-100 border border-base-300'
          "
          @click="activePlatform = plat.id"
        >
          <span>{{ plat.emoji }}</span>
          <span class="truncate">{{ plat.shortLabel }}</span>
        </button>
      </div>

      <!-- Formatted Preview & 1-Tap Copy Chips -->
      <div v-if="packet" class="rounded-xl border border-base-300 bg-base-100 p-3 space-y-2.5">
        <div class="flex items-center justify-between gap-2 flex-wrap text-[11px]">
          <span class="font-mono font-bold text-primary">
            {{ packet.sku || 'NO-SKU' }} • {{ packet.priceFormatted ? `$${packet.priceFormatted}` : 'No price set' }}
          </span>
          <span class="text-base-content/65">
            Title {{ packet.title.length }}/{{ activeMeta.maxTitleChars }}c • {{ activeMeta.feeSummary }}
          </span>
        </div>

        <div class="text-xs font-bold text-base-content leading-snug">
          {{ packet.title }}
        </div>

        <div class="flex flex-wrap gap-1.5">
          <button
            type="button"
            class="btn btn-xs h-11 md:h-8 btn-outline rounded-lg font-bold gap-1"
            @click="copyField('Title', packet.title)"
          >
            <Icon icon="solar:copy-bold" class="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Copy Title</span>
          </button>
          <button
            type="button"
            class="btn btn-xs h-11 md:h-8 btn-outline rounded-lg font-bold gap-1"
            @click="copyField('Description', packet.description)"
          >
            <Icon icon="solar:copy-bold" class="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Copy Description</span>
          </button>
          <button
            v-if="packet.priceFormatted"
            type="button"
            class="btn btn-xs h-11 md:h-8 btn-outline rounded-lg font-bold gap-1"
            @click="copyField('Price', packet.priceFormatted)"
          >
            <Icon icon="solar:copy-bold" class="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Copy Price</span>
          </button>
          <button
            v-if="packet.sku"
            type="button"
            class="btn btn-xs h-11 md:h-8 btn-outline rounded-lg font-bold gap-1"
            @click="copyField('SKU', packet.sku)"
          >
            <Icon icon="solar:copy-bold" class="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Copy SKU</span>
          </button>
          <button
            v-if="packet.hashtags.length > 0"
            type="button"
            class="btn btn-xs h-11 md:h-8 btn-outline rounded-lg font-bold gap-1"
            @click="copyField('Hashtags', packet.hashtags.join(' '))"
          >
            <Icon icon="solar:copy-bold" class="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Copy Hashtags</span>
          </button>
        </div>

        <div v-if="photoUrls.length > 0" class="flex items-center gap-1.5 flex-wrap pt-1">
          <span class="text-[11px] font-bold text-base-content/65">Photos ({{ photoUrls.length }}):</span>
          <a
            v-for="(url, idx) in photoUrls"
            :key="url"
            :href="url"
            target="_blank"
            rel="noopener noreferrer"
            class="badge badge-sm badge-ghost border border-base-300 font-bold hover:border-primary whitespace-nowrap shrink-0"
          >
            Photo {{ idx + 1 }} ↗
          </a>
        </div>
      </div>
    </template>

    <!-- Official Seller Hub Bulk CSV Exports -->
    <div class="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-base-300/70">
      <span class="text-[11px] text-base-content/65">
        Official bulk CSV uploads (zero account risk):
      </span>
      <div class="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          class="btn btn-xs h-11 md:h-8 btn-outline rounded-lg font-bold"
          @click="exportSingleCsv('ebay')"
        >
          eBay CSV
        </button>
        <button
          type="button"
          class="btn btn-xs h-11 md:h-8 btn-outline rounded-lg font-bold"
          @click="exportSingleCsv('whatnot')"
        >
          Whatnot CSV
        </button>
        <button
          type="button"
          class="btn btn-xs h-11 md:h-8 btn-outline rounded-lg font-bold"
          @click="exportSingleCsv('poshmark')"
        >
          Poshmark CSV
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Icon } from '@iconify/vue';
import {
  buildItemPublicImageUrls,
  downloadCsv,
  generateEbayCsv,
  generatePoshmarkCsv,
  generateWhatnotCsv,
} from '../../../lib/exportUtils';
import {
  LISTING_ASSIST_PLATFORMS,
  LISTING_PLATFORM_LIMITS,
  buildListingPacket,
  checkListingAssistEligibility,
  type ListingAssistPlatform,
} from '../../../lib/onlineListingPacket';
import { addToast } from '../../../stores/toast';

const props = defineProps<{
  item: Record<string, any> | null;
  binFacility: 'HG' | 'HH';
}>();

const activePlatform = ref<ListingAssistPlatform>('poshmark');

const platformCards = computed(() =>
  LISTING_ASSIST_PLATFORMS.map((id) => LISTING_PLATFORM_LIMITS[id])
);
const activeMeta = computed(() => LISTING_PLATFORM_LIMITS[activePlatform.value]);

const eligibility = computed(() => checkListingAssistEligibility(props.item));
const blockedReason = computed(() =>
  eligibility.value.eligible ? '' : eligibility.value.reason || ''
);

const packet = computed(() => {
  if (!props.item || !eligibility.value.eligible) return null;
  const built = buildListingPacket(props.item, activePlatform.value);
  return built.ok ? built.packet : null;
});

const photoUrls = computed(() =>
  props.item ? buildItemPublicImageUrls(props.item, activeMeta.value.maxPhotos) : []
);

const copyField = async (label: string, value: string) => {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    addToast({ type: 'success', message: `Copied ${activeMeta.value.label} ${label}!` });
  } catch {
    addToast({ type: 'info', message: `${label}: ${value.slice(0, 80)}` });
  }
};

const exportSingleCsv = (kind: 'whatnot' | 'ebay' | 'poshmark') => {
  if (!props.item) return;
  const sku = String(props.item.upc || props.item.sku || props.item.$id || 'item')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-');
  if (kind === 'whatnot') {
    downloadCsv(generateWhatnotCsv([props.item]), `whatnot-${sku}.csv`);
    addToast({ type: 'success', message: 'Downloaded Whatnot Seller Hub CSV.' });
  } else if (kind === 'poshmark') {
    downloadCsv(generatePoshmarkCsv([props.item]), `poshmark-${sku}.csv`);
    addToast({ type: 'success', message: 'Downloaded Poshmark CSV.' });
  } else {
    downloadCsv(generateEbayCsv([props.item]), `ebay-${sku}.csv`);
    addToast({ type: 'success', message: 'Downloaded eBay Seller Hub CSV.' });
  }
};
</script>

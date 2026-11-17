<template>
  <section class="space-y-2.5">
    <div class="flex items-center justify-between gap-2">
      <span
        class="text-xs font-black uppercase tracking-wider flex items-center gap-1.5"
        :class="!selectedChannel ? 'text-warning' : 'text-base-content/80'"
      >
        <span>1. How Did This Sell?</span>
        <span
          v-if="!selectedChannel"
          class="badge badge-xs badge-warning text-warning-content font-black whitespace-nowrap shrink-0"
        >
          Required
        </span>
      </span>
      <a
        v-if="advancedEditorHref"
        :href="advancedEditorHref"
        class="text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5"
        title="Open the full-page Sales Order form"
      >
        <span>Full Order Editor</span>
        <Icon icon="solar:arrow-right-up-linear" class="w-3.5 h-3.5" />
      </a>
    </div>

    <!-- SALES-FIRST MULTI-CHANNEL GRID: Online, Pop-Ups/Events (Ours + Partners), & Dynamic Retail Booths -->
    <div class="grid grid-cols-2 gap-2">
      <!-- 1. Online Marketplaces & Live Auctions -->
      <button
        type="button"
        class="p-2.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-1 min-h-14"
        :class="
          selectedChannel === 'ONLINE'
            ? 'border-info bg-info/10 shadow-sm'
            : 'border-base-300 bg-base-100 hover:border-base-content/30'
        "
        @click="emit('select-channel', 'ONLINE')"
      >
        <div class="flex items-center justify-between gap-1">
          <span class="font-black text-xs text-base-content truncate">🌐 Online &amp; Live</span>
          <span
            class="badge badge-xs font-mono font-bold whitespace-nowrap shrink-0"
            :class="selectedChannel === 'ONLINE' ? 'badge-info text-info-content' : 'badge-ghost'"
          >
            {{ selectedChannel === 'ONLINE' ? `${effectiveFeeRate}%` : 'Ship / Live' }}
          </span>
        </div>
        <span class="text-[10px] text-base-content/65 leading-tight">
          eBay, Whatnot, Depop, Posh &amp; DM
        </span>
      </button>

      <!-- 2. Pop-Ups & Events (Hosted by Us + Partner Markets/Cons) -->
      <button
        type="button"
        class="p-2.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-1 min-h-14"
        :class="
          selectedChannel === 'EVENT'
            ? 'border-secondary bg-secondary/10 shadow-sm'
            : 'border-base-300 bg-base-100 hover:border-base-content/30'
        "
        @click="emit('select-channel', 'EVENT')"
      >
        <div class="flex items-center justify-between gap-1">
          <span class="font-black text-xs text-base-content truncate">🎪 Pop-Ups &amp; Events</span>
          <span
            class="badge badge-xs font-mono font-bold whitespace-nowrap shrink-0"
            :class="selectedChannel === 'EVENT' ? 'badge-secondary text-secondary-content' : 'badge-ghost'"
          >
            {{ selectedChannel === 'EVENT' ? `${effectiveFeeRate}%` : 'Ours + Markets' }}
          </span>
        </div>
        <span class="text-[10px] text-base-content/65 leading-tight">
          Our pop-ups, partner markets &amp; cons
        </span>
      </button>

      <!-- 3. Dynamic Retail Booths from warehouses.ts (Law 2 Zero Hardcoding) -->
      <button
        v-for="loc in boothLocations"
        :key="loc.code"
        type="button"
        class="p-2.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-1 min-h-14"
        :class="
          selectedChannel === loc.code
            ? 'border-primary bg-primary/10 shadow-sm'
            : 'border-base-300 bg-base-100 hover:border-base-content/30'
        "
        @click="emit('select-channel', loc.code)"
      >
        <div class="flex items-center justify-between gap-1">
          <span class="font-black text-xs text-base-content truncate">{{ loc.icon }} {{ loc.shortName }}</span>
          <span
            class="badge badge-xs font-mono font-bold whitespace-nowrap shrink-0"
            :class="selectedChannel === loc.code ? 'badge-primary text-primary-content' : 'badge-ghost'"
          >
            {{ loc.feePct }}%
          </span>
        </div>
        <span class="text-[10px] text-base-content/65 leading-tight">
          {{ loc.supportsPaperSalesSheet ? 'Paper sheet • No SKU needed' : `Booth ${loc.code} register` }}
        </span>
      </button>
    </div>

    <!-- ONLINE SUB-CHANNEL PRESETS (<= 5 Pills) -->
    <div
      v-if="selectedChannel === 'ONLINE'"
      class="p-2.5 rounded-xl bg-base-200/60 border border-base-300 space-y-2"
    >
      <div class="flex items-center justify-between text-[11px] gap-2">
        <span class="font-bold text-base-content/80">Marketplace / Stream Preset:</span>
        <span class="font-mono text-[10px] text-base-content/65">100% label postage recouped first</span>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="preset in ONLINE_MARKETPLACE_PRESETS"
          :key="preset.id"
          type="button"
          class="btn btn-xs h-11 md:h-8 px-2.5 rounded-lg font-bold"
          :class="
            onlinePresetId === preset.id
              ? 'btn-info text-info-content'
              : 'btn-ghost bg-base-100 border border-base-300'
          "
          :title="preset.shortHint"
          @click="emit('select-online-preset', preset)"
        >
          {{ preset.label }} ({{ preset.feePct }}%)
        </button>
      </div>
    </div>

    <!-- POP-UP & EVENT SUB-PANEL (OUR EVENTS vs PARTNER MARKETS + 1-TAP CMS CHIPS) -->
    <div
      v-else-if="selectedChannel === 'EVENT'"
      class="p-3 rounded-xl bg-base-200/60 border border-base-300 space-y-2.5"
    >
      <div class="flex items-center justify-between text-[11px] gap-2">
        <span class="font-bold text-base-content/80">Our Event vs. Partner Market Preset:</span>
        <a href="/coop/cms" class="font-bold text-primary hover:underline text-[10px]">
          Manage Events →
        </a>
      </div>

      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="preset in EVENT_CHECKOUT_PRESETS"
          :key="preset.id"
          type="button"
          class="btn btn-xs h-11 md:h-8 px-2.5 rounded-lg font-bold"
          :class="
            eventPresetId === preset.id
              ? 'btn-secondary text-secondary-content'
              : 'btn-ghost bg-base-100 border border-base-300'
          "
          :title="preset.shortHint"
          @click="emit('select-event-preset', preset)"
        >
          {{ preset.label }} ({{ preset.feePct }}%)
        </button>
      </div>

      <!-- 1-Tap Scheduled Events from Flagship CMS (Capped <= 6 Pills per Choice Overload) -->
      <div v-if="visibleCmsEvents.length > 0" class="space-y-1">
        <div class="text-[10px] font-bold uppercase tracking-wider text-base-content/60">
          Tap Scheduled Event (Auto-Fills Name &amp; Fee)
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="ev in visibleCmsEvents"
            :key="ev.id"
            type="button"
            class="btn btn-xs h-11 md:h-8 px-2.5 rounded-lg font-semibold"
            :class="
              eventName === ev.title
                ? 'btn-primary text-primary-content'
                : 'btn-ghost bg-base-100 border border-base-300'
            "
            @click="emit('select-cms-event', ev)"
          >
            <span>{{ ev.eventKind === 'hosted_by_us' ? '🎪' : ev.eventKind === 'partner_event' ? '🤝' : '📡' }}</span>
            <span class="truncate max-w-44">{{ ev.title }}</span>
          </button>
        </div>
      </div>

      <div class="space-y-1">
        <label class="text-[10px] font-bold text-base-content/70 block">
          Event / Market Name (Stamped on Receipt Line)
        </label>
        <input
          :value="eventName"
          type="text"
          maxlength="40"
          placeholder="e.g. Hideout Game Swap or PDX Night Market"
          class="input input-bordered input-sm w-full h-9 rounded-xl text-xs bg-base-100 font-semibold"
          @input="emit('update:eventName', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>

    <!-- DATE + EDITABLE FEE RATE ROW -->
    <div v-if="selectedChannel" class="grid grid-cols-2 gap-2.5 pt-0.5">
      <div class="space-y-1">
        <label class="text-[11px] font-bold text-base-content/70 block">Sale / Event Date</label>
        <input
          :value="saleDate"
          type="date"
          class="input input-bordered input-sm w-full h-9 rounded-xl font-mono font-bold text-xs bg-base-100"
          @input="emit('update:saleDate', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="space-y-1">
        <label class="text-[11px] font-bold text-base-content/70 flex items-center justify-between">
          <span>Channel / Processor Fee</span>
          <span class="font-mono text-[10px] text-error">-${{ totalCommissionFee.toFixed(2) }}</span>
        </label>
        <div class="relative">
          <input
            :value="feeInput"
            type="text"
            inputmode="decimal"
            class="input input-bordered input-sm w-full pr-7 h-9 rounded-xl font-mono font-bold text-xs bg-base-100"
            @input="emit('update:feeInput', ($event.target as HTMLInputElement).value)"
          />
          <span class="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono font-bold text-xs opacity-60">%</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import type { CoopPublicEvent } from '../../lib/flagshipContent';
import {
  EVENT_CHECKOUT_PRESETS,
  ONLINE_MARKETPLACE_PRESETS,
  type EventChannelPreset,
  type OnlineChannelPreset,
} from '../../lib/salesChannels';
import type { LocationSettingMeta } from '../../lib/warehouses';

const props = defineProps<{
  selectedChannel: string;
  boothLocations: LocationSettingMeta[];
  onlinePresetId: OnlineChannelPreset['id'];
  eventPresetId: EventChannelPreset['id'];
  eventName: string;
  effectiveFeeRate: number;
  saleDate: string;
  feeInput: string;
  totalCommissionFee: number;
  advancedEditorHref: string;
  cmsEvents: CoopPublicEvent[];
}>();

const emit = defineEmits<{
  (e: 'select-channel', code: string): void;
  (e: 'select-online-preset', preset: OnlineChannelPreset): void;
  (e: 'select-event-preset', preset: EventChannelPreset): void;
  (e: 'select-cms-event', ev: CoopPublicEvent): void;
  (e: 'update:eventName', val: string): void;
  (e: 'update:saleDate', val: string): void;
  (e: 'update:feeInput', val: string): void;
}>();

const visibleCmsEvents = computed(() => props.cmsEvents.slice(0, 6));
</script>

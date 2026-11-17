<template>
  <div class="flex-1 min-h-0 flex flex-col">
    <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
      <div v-if="!item" class="py-10 text-center text-sm text-base-content/60">
        Select an inventory item first.
      </div>

      <template v-else>
        <!-- 1. ITEM SUMMARY & PIRATE SHIP SKU -->
        <div class="rounded-2xl border border-base-300 bg-base-200/50 p-3.5 sm:p-4 space-y-2.5">
          <div class="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap mb-1">
                <span class="badge badge-sm badge-primary text-primary-content font-mono font-bold whitespace-nowrap shrink-0">
                  {{ effectiveUpc || 'NO-SKU' }}
                </span>
                <span
                  v-if="existingRecord && existingRecord.status !== 'released'"
                  class="badge badge-sm font-bold whitespace-nowrap shrink-0"
                  :class="statusBadgeClass"
                >
                  {{ statusBadgeLabel }}
                </span>
                <span v-else class="badge badge-sm badge-ghost font-semibold whitespace-nowrap shrink-0">
                  Not yet in Online Bin
                </span>
              </div>
              <h4 class="font-bold text-sm sm:text-base text-base-content leading-snug">
                {{ itemTitle }}
              </h4>
              <p class="text-xs text-base-content/70 mt-0.5 font-mono">
                OG Cost: <strong>${{ itemCost.toFixed(2) }}</strong> • Est. Tag: <strong>${{ itemPrice.toFixed(2) }}</strong> • OG Partner: <strong>{{ eligibility.ogPrefix }}</strong>
              </p>
            </div>

            <button
              v-if="effectiveUpc"
              type="button"
              class="btn btn-sm h-11 md:h-9 btn-outline rounded-xl font-bold gap-1.5 shrink-0"
              @click="copyPirateShipSku"
            >
              <Icon icon="solar:copy-bold" class="w-4 h-4 text-primary shrink-0" />
              <span>Copy Pirate Ship SKU</span>
            </button>
          </div>

          <div
            v-if="existingRecord && existingRecord.status === 'claimed'"
            class="rounded-xl bg-info/10 border border-info/30 px-3 py-2 text-xs text-base-content flex items-center justify-between gap-2 flex-wrap"
          >
            <span>
              ⏳ <strong>14-Day Listing Hold:</strong> Paste at least one live <code>https://</code> storefront link by
              <strong class="font-mono">{{ existingRecord.expiresAt }}</strong> to lock your claim.
            </span>
            <span class="badge badge-xs badge-info text-info-content font-mono font-bold whitespace-nowrap shrink-0">
              Claimed by {{ existingRecord.listerName }}
            </span>
          </div>
        </div>

        <!-- INELIGIBLE GUARD -->
        <div
          v-if="!eligibility.eligible"
          role="alert"
          class="alert alert-warning rounded-2xl border border-warning/40 text-xs sm:text-sm"
        >
          <Icon icon="solar:shield-warning-bold" class="w-5 h-5 shrink-0" />
          <span>{{ eligibility.reason }}</span>
        </div>

        <!-- BOOTH DOUBLE-SELL SAFETY WARNING -->
        <div
          v-if="isCurrentlyInRetailBooth"
          role="alert"
          class="alert alert-warning rounded-2xl border border-warning/50 text-xs leading-relaxed"
        >
          <Icon icon="solar:danger-triangle-bold" class="w-5 h-5 shrink-0" />
          <div>
            <strong class="block font-extrabold">Physical Booth Double-Sell Check</strong>
            <span>
              This item currently shows booth placement or a booth tag ({{ item.storageLocation || item.locationSku }}).
              Physically pull it off the booth shelf into your <strong>HG</strong> or <strong>HH</strong> Online Ready Bin before saving so it cannot sell twice.
            </span>
          </div>
        </div>

        <div v-if="loading" class="py-6 flex items-center justify-center gap-2 text-xs text-base-content/70">
          <span class="loading loading-spinner loading-sm text-primary"></span>
          <span>Checking Official Ledger…</span>
        </div>

        <div v-if="loadError" role="alert" class="alert alert-error rounded-2xl text-xs">
          <span>{{ loadError }}</span>
          <button type="button" class="btn btn-sm h-11 md:h-8 btn-outline rounded-xl font-bold" @click="loadExistingClaim">
            Retry Load
          </button>
        </div>

        <template v-if="eligibility.eligible && !loading">
          <!-- 2. PHYSICAL BACKSTOCK BIN FACILITY (LAW 1: STRICTLY HG OR HH) -->
          <section class="space-y-2">
            <label class="text-xs font-extrabold uppercase tracking-wider text-base-content/80 block">
              1. Physical Online Ready Bin Location
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                class="btn h-auto min-h-11 py-2.5 px-3 rounded-xl justify-start text-left border"
                :class="binFacility === 'HH' ? 'btn-primary text-primary-content border-primary shadow-xs' : 'btn-ghost bg-base-100 border-base-300'"
                @click="binFacility = 'HH'"
              >
                <div>
                  <div class="font-bold text-xs sm:text-sm">🏡 {{ hhMeta.code }} — {{ hhMeta.shortName }} Online Bin</div>
                  <div class="text-[11px] opacity-80 font-normal">Apparel, media, books, jewelry &amp; smalls</div>
                </div>
              </button>
              <button
                type="button"
                class="btn h-auto min-h-11 py-2.5 px-3 rounded-xl justify-start text-left border"
                :class="binFacility === 'HG' ? 'btn-primary text-primary-content border-primary shadow-xs' : 'btn-ghost bg-base-100 border-base-300'"
                @click="binFacility = 'HG'"
              >
                <div>
                  <div class="font-bold text-xs sm:text-sm">🏠 {{ hgMeta.code }} — {{ hgMeta.shortName }} Online Bin</div>
                  <div class="text-[11px] opacity-80 font-normal">Hardgoods, toys, boxed games &amp; decor</div>
                </div>
              </button>
            </div>
            <p class="text-[11px] text-base-content/65">
              Items tagged <strong>🌐 Online Ready</strong> stay separated from booth restock pulls and outbound booth drops.
            </p>
          </section>

          <!-- 3. DUAL-OPTION CO-CURATION MODE -->
          <section class="space-y-2.5">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <label class="text-xs font-extrabold uppercase tracking-wider text-base-content/80">
                2. Listing &amp; Surplus Arrangement
              </label>
              <span v-if="isSplitFrozen" class="badge badge-xs badge-neutral text-neutral-content font-semibold whitespace-nowrap shrink-0">
                🔒 Split terms locked after live listing
              </span>
            </div>

            <div class="space-y-2">
              <button
                type="button"
                :disabled="isSplitFrozen"
                class="w-full text-left rounded-2xl border p-3 transition-all cursor-pointer"
                :class="mode === 'self_listed' ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-base-300 bg-base-100 hover:border-base-content/30'"
                @click="mode = 'self_listed'"
              >
                <div class="font-bold text-xs sm:text-sm text-base-content">
                  👤 My Own Inventory (Standard {{ curatorShareLabel }}% Curator / {{ commonsShareLabel }}% Commons)
                </div>
                <div class="text-[11px] text-base-content/70 mt-0.5">
                  I sourced this item and I am listing &amp; shipping it myself.
                </div>
              </button>

              <button
                type="button"
                :disabled="isSplitFrozen"
                class="w-full text-left rounded-2xl border p-3 transition-all cursor-pointer"
                :class="mode === 'split_half' ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-base-300 bg-base-100 hover:border-base-content/30'"
                @click="mode = 'split_half'"
              >
                <div class="font-bold text-xs sm:text-sm text-base-content">
                  🤝 Co-Curate: 50/50 Curator Split ({{ halfCuratorLabel }}% OG Buyer / {{ halfCuratorLabel }}% Lister)
                </div>
                <div class="text-[11px] text-base-content/70 mt-0.5">
                  OG Buyer recoups 100% item cost first; Commons keeps {{ commonsShareLabel }}%; remaining Curator Surplus splits evenly.
                </div>
              </button>

              <button
                type="button"
                :disabled="isSplitFrozen"
                class="w-full text-left rounded-2xl border p-3 transition-all cursor-pointer"
                :class="mode === 'transfer_price' ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-base-300 bg-base-100 hover:border-base-content/30'"
                @click="mode = 'transfer_price'"
              >
                <div class="font-bold text-xs sm:text-sm text-base-content">
                  💵 Co-Curate: Agreed Wholesale Transfer Floor
                </div>
                <div class="text-[11px] text-base-content/70 mt-0.5">
                  OG Buyer receives their agreed transfer floor first; Commons keeps {{ commonsShareLabel }}% above floor; Lister keeps 100% of remaining Curator Surplus.
                </div>
              </button>
            </div>

            <div v-if="mode === 'transfer_price'" class="rounded-xl border border-base-300 bg-base-200/40 p-3 space-y-1.5">
              <label for="rc-online-transfer-floor" class="text-xs font-bold text-base-content block">
                Agreed OG Buyer Transfer Floor ($)
              </label>
              <input
                id="rc-online-transfer-floor"
                v-model="transferFloorInput"
                :disabled="isSplitFrozen"
                type="text"
                inputmode="decimal"
                placeholder="e.g. 15.00"
                class="input input-bordered input-sm h-11 md:h-9 w-full sm:w-48 rounded-xl font-mono font-bold bg-base-100"
              />
              <p class="text-[11px] text-base-content/70">
                Original item cost: <strong>${{ itemCost.toFixed(2) }}</strong>. If net deposit after fees is below floor + shipping, OG Buyer recoups available net and Curator Surplus is $0.00.
              </p>
            </div>

            <!-- Lister attribution when co-curating -->
            <div v-if="mode !== 'self_listed'" class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div class="flex flex-col gap-1">
                <label for="rc-online-lister-name" class="text-[11px] font-bold text-base-content/80">Active Lister Name</label>
                <input
                  id="rc-online-lister-name"
                  v-model="listerNameInput"
                  :disabled="isSplitFrozen"
                  type="text"
                  maxlength="60"
                  placeholder="Your Collective display name"
                  class="input input-bordered input-sm h-11 md:h-9 w-full rounded-xl bg-base-100 text-xs sm:text-sm"
                />
              </div>
              <div class="flex flex-col gap-1">
                <label for="rc-online-lister-bucket" class="text-[11px] font-bold text-base-content/80">Lister Settlement Bucket</label>
                <select
                  id="rc-online-lister-bucket"
                  v-model="listerPrefixInput"
                  :disabled="isSplitFrozen"
                  class="select select-bordered select-sm h-11 md:h-9 w-full rounded-xl bg-base-100 text-xs sm:text-sm font-semibold"
                >
                  <option value="HUCK-">🫐 HUCK- (Huckleberry Curator)</option>
                  <option value="PDXGL-">🎲 PDXGL- (PDX Game Library)</option>
                  <option value="SWEAT-">🛠️ SWEAT- (Sweat-Equity Member)</option>
                </select>
              </div>
            </div>
          </section>

          <!-- 4. LIVE WATERFALL PREVIEW & NO-DOUBLE-DIPPING RULE -->
          <section class="rounded-2xl border border-base-300 bg-base-200/50 p-3.5 sm:p-4 space-y-3">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <h5 class="text-xs font-extrabold uppercase tracking-wider text-base-content">
                Live Waterfall Preview (Exact to the Penny)
              </h5>
              <span class="badge badge-xs badge-success text-success-content font-semibold whitespace-nowrap shrink-0">
                🔒 Official Ledger Math
              </span>
            </div>

            <div class="grid grid-cols-3 gap-2">
              <div class="flex flex-col gap-1">
                <label for="rc-preview-gross" class="text-[10px] font-bold opacity-70">Sample Sale ($)</label>
                <input
                  id="rc-preview-gross"
                  v-model="previewGrossInput"
                  type="text"
                  inputmode="decimal"
                  class="input input-bordered input-xs h-11 md:h-9 w-full rounded-lg font-mono bg-base-100"
                />
              </div>
              <div class="flex flex-col gap-1">
                <label for="rc-preview-fee" class="text-[10px] font-bold opacity-70">Est. Platform Fee ($)</label>
                <input
                  id="rc-preview-fee"
                  v-model="previewFeeInput"
                  type="text"
                  inputmode="decimal"
                  class="input input-bordered input-xs h-11 md:h-9 w-full rounded-lg font-mono bg-base-100"
                />
              </div>
              <div class="flex flex-col gap-1">
                <label for="rc-preview-ship" class="text-[10px] font-bold opacity-70">Label Postage ($)</label>
                <input
                  id="rc-preview-ship"
                  v-model="previewShippingInput"
                  type="text"
                  inputmode="decimal"
                  class="input input-bordered input-xs h-11 md:h-9 w-full rounded-lg font-mono bg-base-100"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div class="rounded-xl bg-base-100 border border-base-300 p-2">
                <div class="text-[10px] font-bold opacity-65">Cost + Label Recoup</div>
                <div class="font-mono font-black text-xs sm:text-sm text-warning">
                  ${{ (splitPreview.effectiveRecoupCents / 100).toFixed(2) }}
                </div>
              </div>
              <div class="rounded-xl bg-base-100 border border-base-300 p-2">
                <div class="text-[10px] font-bold opacity-65">Commons ({{ commonsShareLabel }}%)</div>
                <div class="font-mono font-black text-xs sm:text-sm text-info">
                  ${{ (splitPreview.commonsTakeCents / 100).toFixed(2) }}
                </div>
              </div>
              <div class="rounded-xl bg-base-100 border border-base-300 p-2">
                <div class="text-[10px] font-bold opacity-65">OG Buyer Surplus</div>
                <div class="font-mono font-black text-xs sm:text-sm text-success">
                  ${{ (splitPreview.ogBaseProfitCents / 100).toFixed(2) }}
                </div>
              </div>
              <div class="rounded-xl bg-base-100 border border-base-300 p-2">
                <div class="text-[10px] font-bold opacity-65">Lister Surplus</div>
                <div class="font-mono font-black text-xs sm:text-sm text-primary">
                  ${{ (splitPreview.listerTransferCents / 100).toFixed(2) }}
                </div>
              </div>
            </div>

            <p class="text-[11px] text-base-content/75 leading-relaxed">
              <strong>No Double-Dipping Rule:</strong> Your co-curation surplus share covers photography, listing, and packing—do not also log hourly Sweat-Equity labor for listing this item.
            </p>
          </section>

          <!-- 5. LIVE MARKETPLACE LISTING LINKS -->
          <section class="space-y-2.5">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <label class="text-xs font-extrabold uppercase tracking-wider text-base-content/80">
                3. Live Marketplace Links (Locks Claim Past 14 Days)
              </label>
              <button
                type="button"
                :disabled="listingRows.length >= 6"
                class="btn btn-xs h-11 md:h-8 btn-outline rounded-lg font-bold gap-1"
                @click="addListingRow"
              >
                <Icon icon="solar:add-circle-bold" class="w-3.5 h-3.5" />
                <span>Add Storefront Link</span>
              </button>
            </div>

            <div v-if="listingRows.length === 0" class="rounded-xl border border-dashed border-base-300 p-3 text-xs text-base-content/65">
              Save now to claim &amp; photograph the item, then paste your live <code>https://</code> eBay / Depop / Poshmark / Whatnot link within 14 days.
            </div>

            <div v-for="(row, idx) in listingRows" :key="idx" class="rounded-xl border border-base-300 bg-base-100 p-2.5 space-y-2">
              <div class="grid grid-cols-12 gap-2 items-center">
                <div class="col-span-7 sm:col-span-6">
                  <select
                    v-model="row.platform"
                    aria-label="Online marketplace"
                    class="select select-bordered select-xs h-11 md:h-9 w-full rounded-lg font-semibold"
                  >
                    <option v-for="opt in ONLINE_PLATFORM_OPTIONS" :key="opt.id" :value="opt.id">
                      {{ opt.label }} (~{{ opt.feePctHint }}%)
                    </option>
                  </select>
                </div>
                <div class="col-span-4 sm:col-span-5">
                  <input
                    v-model="row.priceInput"
                    type="text"
                    inputmode="decimal"
                    aria-label="Listed price"
                    placeholder="Listed $"
                    class="input input-bordered input-xs h-11 md:h-9 w-full rounded-lg font-mono"
                  />
                </div>
                <div class="col-span-1 flex justify-end">
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs h-11 w-11 md:h-7 md:w-7 btn-circle text-error"
                    title="Remove storefront link"
                    aria-label="Remove storefront link"
                    @click="listingRows.splice(idx, 1)"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <input
                v-model="row.listingUrl"
                type="url"
                aria-label="Live listing URL"
                placeholder="https://www.ebay.com/itm/..."
                class="input input-bordered input-xs h-11 md:h-9 w-full rounded-lg font-mono"
              />
            </div>

            <div v-if="invalidUrlWarning" class="text-xs text-error font-semibold">
              {{ invalidUrlWarning }}
            </div>

            <!-- Cross-Post Social Shortcut -->
            <div class="pt-1 flex items-center justify-between gap-2 flex-wrap">
              <a
                :href="socialCrossPostHref"
                class="btn btn-xs h-11 md:h-9 btn-ghost border border-base-300 rounded-xl font-bold gap-1.5"
              >
                <Icon icon="solar:share-circle-bold" class="w-4 h-4 text-secondary" />
                <span>Track Promo Links on Social Board</span>
              </a>
            </div>
          </section>
        </template>
      </template>
    </div>

    <!-- PINNED SINGLE-CPA FOOTER (Replaces ItemDrawerFooter while mainTab === 'online') -->
    <div class="p-3 sm:px-6 pb-safe border-t border-base-300 flex flex-row justify-between items-center bg-base-200/90 backdrop-blur-md shadow-lg gap-2 shrink-0 select-none flex-wrap">
      <button
        v-if="hasActiveBinStatus"
        type="button"
        :disabled="saving || existingRecord?.status === 'sold'"
        class="btn btn-sm h-11 md:h-9 btn-ghost text-error border border-error/30 rounded-xl font-bold"
        @click="handleRelease"
      >
        Release from Online Bin
      </button>
      <span v-else></span>

      <div class="flex items-center gap-2 ml-auto">
        <button
          type="button"
          class="btn btn-sm h-11 md:h-9 btn-ghost rounded-xl font-bold"
          @click="emit('back')"
        >
          Back to Details
        </button>
        <button
          v-if="eligibility.eligible"
          type="button"
          :disabled="saving || Boolean(invalidUrlWarning)"
          class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content rounded-xl font-black px-4 gap-1.5 shadow-md border border-primary-content/25 active:scale-95 transition-all"
          @click="handleSave"
        >
          <span v-if="saving" class="loading loading-spinner loading-xs"></span>
          <span>{{ saving ? 'Saving to Online Bin…' : '✅ Save to Online Ready Bin' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useAuth } from '../../../composables/useAuth';
import { loadCoopGovernanceState } from '../../../lib/coopGovernance';
import { getCoopJwtHeaders } from '../../../lib/coopLedgerClient';
import { sanitizeHttpsUrl } from '../../../lib/flagshipContent';
import { isAlreadyInBooth } from '../../../lib/inventoryVibes';
import { parsePriceValue } from '../../../lib/lot-strategy';
import {
  ONLINE_PLATFORM_OPTIONS,
  checkCoCurationEligibility,
  computeCoCurationSplitCents,
  hasOnlineReadyTag,
  type CoCurationMode,
  type CoCurationRecord,
  type OnlinePlatformKey,
} from '../../../lib/onlineCoCuration';
import { toUserMessage } from '../../../lib/userFacingErrors';
import { getLocationSettingMeta } from '../../../lib/warehouses';
import { confirmDialog } from '../../../stores/confirm';
import { addToast } from '../../../stores/toast';

interface ListingDraftRow {
  platform: OnlinePlatformKey;
  listingUrl: string;
  priceInput: string;
  listedAt: string;
}

const props = defineProps<{
  item: Record<string, any> | null;
}>();

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'saved', payload: { item: Record<string, any>; record: CoCurationRecord | null }): void;
}>();

const { user } = useAuth();

const hhMeta = computed(() => getLocationSettingMeta('HH'));
const hgMeta = computed(() => getLocationSettingMeta('HG'));

const loading = ref(false);
const saving = ref(false);
const loadError = ref('');
const existingRecord = ref<CoCurationRecord | null>(null);

const curatorSharePct = ref(70);
const commonsSharePct = ref(30);

const binFacility = ref<'HG' | 'HH'>('HH');
const mode = ref<CoCurationMode>('self_listed');
const transferFloorInput = ref('0.00');
const listerNameInput = ref('');
const listerPrefixInput = ref<'HUCK-' | 'PDXGL-' | 'SWEAT-'>('HUCK-');
const listingRows = ref<ListingDraftRow[]>([]);

const previewGrossInput = ref('40.00');
const previewFeeInput = ref('5.40');
const previewShippingInput = ref('6.50');

const itemTitle = computed(
  () => String(props.item?.title || props.item?.identity || 'Catalog Item')
);
const effectiveUpc = computed(
  () => String(props.item?.upc || props.item?.sku || '').trim().toUpperCase()
);
const itemCost = computed(() => Math.max(0, Number(props.item?.cost || 0)));
const itemPrice = computed(() =>
  Math.max(0, Number(props.item?.resalePrice || props.item?.boutiquePrice || props.item?.price || 0))
);

const eligibility = computed(() => checkCoCurationEligibility(props.item));
const isCurrentlyInRetailBooth = computed(() => isAlreadyInBooth(props.item));

const hasActiveBinStatus = computed(
  () =>
    hasOnlineReadyTag(props.item) ||
    Boolean(existingRecord.value && existingRecord.value.status !== 'released')
);

const isSplitFrozen = computed(
  () =>
    existingRecord.value?.status === 'listed' || existingRecord.value?.status === 'sold'
);

const curatorShareLabel = computed(() => Number(curatorSharePct.value.toFixed(1)));
const commonsShareLabel = computed(() => Number(commonsSharePct.value.toFixed(1)));
const halfCuratorLabel = computed(() => Number((curatorSharePct.value / 2).toFixed(1)));

const statusBadgeLabel = computed(() => {
  const st = existingRecord.value?.status;
  if (st === 'sold') return '🔒 Sold & Settled';
  if (st === 'listed') return '✅ Live Online';
  if (st === 'claimed') return '⏳ Claimed (14d Hold)';
  return 'Released';
});

const statusBadgeClass = computed(() => {
  const st = existingRecord.value?.status;
  if (st === 'sold') return 'badge-neutral text-neutral-content';
  if (st === 'listed') return 'badge-success text-success-content';
  if (st === 'claimed') return 'badge-info text-info-content';
  return 'badge-ghost';
});

const invalidUrlWarning = computed(() => {
  for (const row of listingRows.value) {
    const raw = row.listingUrl.trim();
    if (raw && !sanitizeHttpsUrl(raw)) {
      return 'Every marketplace link must start with https://';
    }
  }
  return '';
});

const splitPreview = computed(() => {
  const gross = parsePriceValue(previewGrossInput.value);
  const fee = parsePriceValue(previewFeeInput.value);
  const ship = parsePriceValue(previewShippingInput.value);
  const netDepositCents = Math.max(0, Math.round((gross - fee) * 100));
  return computeCoCurationSplitCents({
    netDepositCents,
    itemCostCents: Math.round(itemCost.value * 100),
    shippingCents: Math.round(ship * 100),
    commonsRatio: commonsSharePct.value / 100,
    mode: mode.value,
    transferFloorCents: Math.round(parsePriceValue(transferFloorInput.value) * 100),
  });
});

const socialCrossPostHref = computed(() => {
  const params = new URLSearchParams();
  if (itemTitle.value) params.set('seedTitle', itemTitle.value.slice(0, 90));
  if (effectiveUpc.value) params.set('seedSku', effectiveUpc.value);
  const firstValidUrl = listingRows.value
    .map((r) => sanitizeHttpsUrl(r.listingUrl))
    .find(Boolean);
  if (firstValidUrl) params.set('seedUrl', firstValidUrl);
  return `/social?${params.toString()}`;
});

const resetDraftFromItem = () => {
  const rawSl = String(props.item?.storageLocation || '').trim().toUpperCase();
  binFacility.value = rawSl.startsWith('HG') ? 'HG' : 'HH';
  mode.value = 'self_listed';
  transferFloorInput.value = itemCost.value > 0 ? itemCost.value.toFixed(2) : '10.00';
  listerNameInput.value = String(user.value?.name || '');
  listerPrefixInput.value = eligibility.value.ogPrefix === 'PDXGL-' ? 'PDXGL-' : 'HUCK-';
  listingRows.value = [];

  const baseGross = itemPrice.value > 0 ? itemPrice.value : Math.max(25, itemCost.value * 2.5);
  previewGrossInput.value = baseGross.toFixed(2);
  previewFeeInput.value = (baseGross * 0.136).toFixed(2);
  previewShippingInput.value = '6.50';
};

const hydrateFromRecord = (rec: CoCurationRecord | null) => {
  existingRecord.value = rec;
  if (!rec || rec.status === 'released') return;
  binFacility.value = rec.binFacility === 'HG' ? 'HG' : 'HH';
  mode.value = rec.mode;
  transferFloorInput.value = Number(rec.transferFloorPrice || 0).toFixed(2);
  listerNameInput.value = rec.listerName || String(user.value?.name || '');
  listerPrefixInput.value = rec.listerPrefix || 'HUCK-';
  listingRows.value = (rec.listings || []).map((l) => ({
    platform: l.platform,
    listingUrl: l.listingUrl,
    priceInput: l.listedPrice > 0 ? l.listedPrice.toFixed(2) : itemPrice.value.toFixed(2),
    listedAt: l.listedAt || '',
  }));
};

const loadExistingClaim = async () => {
  const id = String(props.item?.$id || '').trim();
  if (!id) return;
  loading.value = true;
  loadError.value = '';
  resetDraftFromItem();

  try {
    const [govRes, headers] = await Promise.all([
      loadCoopGovernanceState().catch(() => null),
      getCoopJwtHeaders(),
    ]);
    if (govRes?.state?.policyConfig) {
      curatorSharePct.value = Number(govRes.state.policyConfig.curatorSharePct || 70);
      commonsSharePct.value = Number(govRes.state.policyConfig.commonsSharePct || 30);
    }

    const res = await fetch(`/api/coop/co-curation?itemId=${encodeURIComponent(id)}`, {
      method: 'GET',
      headers,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(body?.error || `Failed to load Online Bin status (${res.status})`);
    }
    hydrateFromRecord(body?.record || null);
  } catch (err: any) {
    console.warn('[ItemOnlineTab] load failed:', err);
    loadError.value = toUserMessage(err, "Couldn't load Online Ready Bin details — tap Retry Load.");
  } finally {
    loading.value = false;
  }
};

watch(
  () => props.item?.$id,
  (id) => {
    if (id) {
      void loadExistingClaim();
    }
  },
  { immediate: true }
);

const addListingRow = () => {
  listingRows.value.push({
    platform: 'ebay',
    listingUrl: '',
    priceInput: itemPrice.value > 0 ? itemPrice.value.toFixed(2) : '',
    listedAt: new Date().toISOString().slice(0, 10),
  });
};

const copyPirateShipSku = async () => {
  if (!effectiveUpc.value) return;
  try {
    await navigator.clipboard.writeText(effectiveUpc.value);
    addToast({
      type: 'success',
      message: `Copied ${effectiveUpc.value} — paste into Pirate Ship Custom Label / SKU!`,
    });
  } catch {
    addToast({ type: 'info', message: `SKU: ${effectiveUpc.value}` });
  }
};

const handleSave = async () => {
  const id = String(props.item?.$id || '').trim();
  if (!id || saving.value || invalidUrlWarning.value) return;

  if (mode.value === 'transfer_price' && parsePriceValue(transferFloorInput.value) <= 0) {
    addToast({
      type: 'warning',
      message: 'Enter an agreed transfer floor above $0.00 before saving.',
    });
    return;
  }

  saving.value = true;
  try {
    const headers = await getCoopJwtHeaders();
    const todayYmd = new Date().toISOString().slice(0, 10);
    const listings = listingRows.value
      .map((r) => ({
        platform: r.platform,
        listingUrl: sanitizeHttpsUrl(r.listingUrl),
        listedPrice: parsePriceValue(r.priceInput),
        listedAt: r.listedAt || todayYmd,
      }))
      .filter((r) => Boolean(r.listingUrl));

    const res = await fetch('/api/coop/co-curation', {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'claim_or_update',
        itemId: id,
        record: {
          itemId: id,
          upc: effectiveUpc.value,
          titleSnapshot: itemTitle.value,
          binFacility: binFacility.value,
          mode: mode.value,
          transferFloorPrice: parsePriceValue(transferFloorInput.value),
          listerName: listerNameInput.value.trim(),
          listerPrefix: listerPrefixInput.value,
          listings,
        },
      }),
    });

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(body?.error || `Save failed (${res.status})`);
    }

    existingRecord.value = body?.record || null;
    addToast({
      type: 'success',
      message:
        listings.length > 0
          ? `✅ Saved live online listing in ${binFacility.value} Online Ready Bin!`
          : `✅ Saved 14-day Online Ready claim in ${binFacility.value}!`,
    });
    emit('saved', {
      item: body?.item || { ...props.item, storageLocation: binFacility.value },
      record: body?.record || null,
    });
  } catch (err: any) {
    console.warn('[ItemOnlineTab] save failed:', err);
    addToast({
      type: 'error',
      message: toUserMessage(err, "Couldn't save Online Ready Bin changes — please try again."),
    });
  } finally {
    saving.value = false;
  }
};

const handleRelease = async () => {
  const id = String(props.item?.$id || '').trim();
  if (!id || saving.value) return;

  const confirmed = await confirmDialog(
    'This removes the 🌐 Online Ready tag so the item returns to regular backstock and booth restock queues.',
    'Release from Online Ready Bin?',
    'Release Item',
    'Keep in Online Bin',
    'btn-error'
  );
  if (!confirmed) return;

  saving.value = true;
  try {
    const headers = await getCoopJwtHeaders();
    const res = await fetch('/api/coop/co-curation', {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'release',
        itemId: id,
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(body?.error || `Release failed (${res.status})`);
    }
    existingRecord.value = null;
    addToast({
      type: 'success',
      message: 'Released item back to regular backstock.',
    });
    emit('saved', {
      item: body?.item || props.item || {},
      record: null,
    });
  } catch (err: any) {
    console.warn('[ItemOnlineTab] release failed:', err);
    addToast({
      type: 'error',
      message: toUserMessage(err, "Couldn't release item — please try again."),
    });
  } finally {
    saving.value = false;
  }
};
</script>

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
            <div class="flex items-start gap-3 min-w-0 flex-1">
              <ItemThumbnail :item="item" size="sm" rounded="lg" class="shrink-0 mt-0.5" />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap mb-1">
                  <span class="badge badge-sm badge-primary text-primary-content font-mono font-bold whitespace-nowrap shrink-0">
                    {{ effectiveUpc || 'NO-SKU' }}
                  </span>
                  <span
                    v-if="existingRecord && !isFreeCoCurationStatus(existingRecord.status)"
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

        <!-- REQUEST / COUNTER-OFFER PANEL (owner approves; everyone else asks) -->
        <section
          v-if="existingRecord && isPending"
          class="rounded-2xl border border-info/40 bg-info/10 p-3.5 sm:p-4 space-y-3"
        >
          <div class="flex items-start justify-between gap-2 flex-wrap">
            <div class="text-xs sm:text-sm">
              <strong>{{ existingRecord.status === 'countered' ? '↔️ Counter-offer sent' : '📨 Co-curate request' }}</strong>
              from {{ existingRecord.listerName }} — {{ modeLabel(existingRecord.mode, existingRecord.transferFloorPrice) }}
            </div>
            <span class="badge badge-xs badge-info text-info-content font-mono font-bold whitespace-nowrap shrink-0">
              Answer by {{ existingRecord.requestExpiresAt }}
            </span>
          </div>
          <p v-if="existingRecord.requestNote" class="text-xs text-base-content/80">“{{ existingRecord.requestNote }}”</p>
          <p v-if="existingRecord.counter" class="text-xs text-base-content/80">
            <strong>{{ existingRecord.counter.byName }}</strong> countered with
            {{ modeLabel(existingRecord.counter.mode, existingRecord.counter.transferFloorPrice) }}.
            <span v-if="existingRecord.counter.note">“{{ existingRecord.counter.note }}”</span>
          </p>

          <!-- Owner / Founder answers a fresh request -->
          <template v-if="access.canDecide && existingRecord.status === 'requested'">
            <div class="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                :disabled="actionBusy"
                class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content rounded-xl font-black"
                @click="runAction('approve', {}, '✅ Approved — the 14-day listing hold has started.', true)"
              >
                ✅ Approve
              </button>
              <button
                type="button"
                :disabled="actionBusy"
                class="btn btn-sm h-11 md:h-9 btn-ghost border border-base-300 rounded-xl font-bold"
                @click="runAction('decline', {}, 'Request declined.')"
              >
                Decline
              </button>
            </div>
            <details class="rounded-xl border border-base-300 bg-base-100 p-3">
              <summary class="text-xs font-bold cursor-pointer select-none">Offer different terms instead</summary>
              <div class="mt-2.5 space-y-2">
                <select
                  v-model="counterMode"
                  aria-label="Counter-offer terms"
                  class="select select-bordered select-sm h-11 md:h-9 w-full rounded-xl text-xs font-semibold"
                >
                  <option v-for="m in requestableModes" :key="m" :value="m">{{ modeLabel(m, 0) }}</option>
                </select>
                <input
                  v-if="counterMode === 'transfer_price'"
                  v-model="counterFloorInput"
                  type="text"
                  inputmode="decimal"
                  aria-label="Counter-offer transfer floor"
                  placeholder="Transfer floor $"
                  class="input input-bordered input-sm h-11 md:h-9 w-full sm:w-48 rounded-xl font-mono"
                />
                <input
                  v-model="counterNote"
                  type="text"
                  maxlength="300"
                  aria-label="Counter-offer note"
                  placeholder="Short note (optional)"
                  class="input input-bordered input-sm h-11 md:h-9 w-full rounded-xl text-xs"
                />
                <button
                  type="button"
                  :disabled="actionBusy"
                  class="btn btn-sm h-11 md:h-9 btn-outline rounded-xl font-bold"
                  @click="sendCounter"
                >
                  Send Counter-Offer
                </button>
              </div>
            </details>
          </template>

          <!-- Requester answers a counter-offer -->
          <template v-else-if="access.isRequester && existingRecord.status === 'countered'">
            <div class="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                :disabled="actionBusy"
                class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content rounded-xl font-black"
                @click="runAction('accept_counter', {}, '✅ Counter-offer accepted — the 14-day listing hold has started.', true)"
              >
                ✅ Accept Counter-Offer
              </button>
              <button
                type="button"
                :disabled="actionBusy"
                class="btn btn-sm h-11 md:h-9 btn-ghost border border-base-300 rounded-xl font-bold"
                @click="runAction('withdraw', {}, 'Request withdrawn.')"
              >
                No Thanks
              </button>
            </div>
          </template>

          <template v-else-if="access.isRequester">
            <div class="flex items-center justify-between gap-2 flex-wrap text-xs">
              <span class="text-base-content/70">Waiting for the item's owner to answer.</span>
              <button
                type="button"
                :disabled="actionBusy"
                class="btn btn-sm h-11 md:h-9 btn-ghost border border-base-300 rounded-xl font-bold"
                @click="runAction('withdraw', {}, 'Request withdrawn.')"
              >
                Withdraw Request
              </button>
            </div>
          </template>

          <p v-else class="text-xs text-base-content/70">
            {{ access.ownerKnown ? "Waiting for the item's owner to answer." : 'This item has no recorded buyer, so a Founder answers.' }}
          </p>
        </section>

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

        <template v-if="eligibility.eligible && !loading && !isPending">
          <!-- 2. PHYSICAL BACKSTOCK BIN FACILITY (LAW 1: STRICTLY HG OR HH) -->
          <section class="space-y-2">
            <label class="text-xs font-extrabold uppercase tracking-wider text-base-content/80 block">
              1. Physical Online Ready Bin Location
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                class="w-full text-left rounded-2xl border p-3 min-h-11 transition-all cursor-pointer"
                :class="binFacility === 'HH' ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-base-300 bg-base-100 hover:border-base-content/30'"
                @click="binFacility = 'HH'"
              >
                <div class="font-bold text-xs sm:text-sm text-base-content">🏡 {{ hhMeta.code }} — {{ hhMeta.shortName }} Online Bin</div>
                <div class="text-[11px] text-base-content/70 mt-0.5">Apparel, media, books, jewelry &amp; smalls</div>
              </button>
              <button
                type="button"
                class="w-full text-left rounded-2xl border p-3 min-h-11 transition-all cursor-pointer"
                :class="binFacility === 'HG' ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-base-300 bg-base-100 hover:border-base-content/30'"
                @click="binFacility = 'HG'"
              >
                <div class="font-bold text-xs sm:text-sm text-base-content">🏠 {{ hgMeta.code }} — {{ hgMeta.shortName }} Online Bin</div>
                <div class="text-[11px] text-base-content/70 mt-0.5">Hardgoods, toys, boxed games &amp; decor</div>
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
              <p v-if="mustRequest" class="rounded-xl bg-info/10 border border-info/30 px-3 py-2 text-xs text-base-content">
                📨 This item belongs to another member. Pick the help you're offering and send a request — they approve it before anything changes.
              </p>
              <button
                v-if="!mustRequest"
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
                :class="mode === 'booth_prep' ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-base-300 bg-base-100 hover:border-base-content/30'"
                @click="mode = 'booth_prep'"
              >
                <div class="font-bold text-xs sm:text-sm text-base-content">
                  🏷️ Co-Curate: Booth Prep Assist ({{ tierPct('booth_prep') }}% to the Co-Curator)
                </div>
                <div class="text-[11px] text-base-content/70 mt-0.5">
                  Cleans, scans, tags and places the item in a booth. Original buyer recoups 100% of cost first; Commons keeps {{ commonsShareLabel }}%.
                </div>
              </button>

              <button
                type="button"
                :disabled="isSplitFrozen"
                class="w-full text-left rounded-2xl border p-3 transition-all cursor-pointer"
                :class="mode === 'photo_stage' ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-base-300 bg-base-100 hover:border-base-content/30'"
                @click="mode = 'photo_stage'"
              >
                <div class="font-bold text-xs sm:text-sm text-base-content">
                  📸 Co-Curate: Unbox, Photo &amp; Stage ({{ tierPct('photo_stage') }}% to the Co-Curator)
                </div>
                <div class="text-[11px] text-base-content/70 mt-0.5">
                  Unboxes, cleans and tests, shoots the full photo set and writes the listing.
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
                  📦 Co-Curate: Full Online Turnkey ({{ tierPct('split_half') }}% to the Co-Curator)
                </div>
                <div class="text-[11px] text-base-content/70 mt-0.5">
                  Cleans, photographs, lists and ships it. The curator share splits evenly.
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
            <div v-if="mode !== 'self_listed' && !mustRequest" class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
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
                  <option v-if="listerPrefixInput === 'SWEAT-'" value="SWEAT-">Legacy sweat-equity bucket</option>
                </select>
              </div>
            </div>
            <div v-if="mustRequest" class="space-y-1.5 pt-1">
              <label for="rc-online-request-note" class="text-[11px] font-bold text-base-content/80">Note to the owner (optional)</label>
              <input
                id="rc-online-request-note"
                v-model="requestNote"
                type="text"
                maxlength="300"
                placeholder="e.g. I can photograph and list this on eBay this week"
                class="input input-bordered input-sm h-11 md:h-9 w-full rounded-xl bg-base-100 text-xs sm:text-sm"
              />
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

          <!-- 4B. SAFE IN-APP CROSS-LIST COPY KIT & OFFICIAL CSV EXPORTS -->
          <ListingQueueActions
            v-if="!mustRequest"
            :item="item"
            :bin-facility="binFacility"
          />

          <!-- 5. LIVE MARKETPLACE LISTING LINKS -->
          <section v-if="!mustRequest" class="space-y-2.5">
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
          v-if="eligibility.eligible && mustRequest && !isPending"
          type="button"
          :disabled="actionBusy"
          class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content rounded-xl font-black px-4 gap-1.5 shadow-md border border-primary-content/25 active:scale-95 transition-all"
          @click="sendRequest"
        >
          <span v-if="actionBusy" class="loading loading-spinner loading-xs"></span>
          <span>{{ actionBusy ? 'Sending request…' : '📨 Send Request to Co-Curate' }}</span>
        </button>
        <button
          v-else-if="eligibility.eligible && !isPending"
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
import ItemThumbnail from '../ItemThumbnail.vue';
import ListingQueueActions from './ListingQueueActions.vue';
import { useAuth } from '../../../composables/useAuth';
import { loadCoopGovernanceState } from '../../../lib/coopGovernance';
import { getCoopJwtHeaders } from '../../../lib/coopLedgerClient';
import { sanitizeHttpsUrl } from '../../../lib/flagshipContent';
import { isAlreadyInBooth } from '../../../lib/inventoryVibes';
import { parsePriceValue } from '../../../lib/lot-strategy';
import {
  COCURATION_REQUESTABLE_MODES,
  ONLINE_PLATFORM_OPTIONS,
  checkCoCurationEligibility,
  coCurationListerSharePct,
  computeCoCurationSplitCents,
  hasOnlineReadyTag,
  isCoCurationTierMode,
  isFreeCoCurationStatus,
  isPendingCoCurationStatus,
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
    Boolean(
      existingRecord.value &&
        !isFreeCoCurationStatus(existingRecord.value.status) &&
        !isPendingCoCurationStatus(existingRecord.value.status)
    )
);

const isPending = computed(() => isPendingCoCurationStatus(existingRecord.value?.status));

// What THIS member may do on this item (the server decides; the drawer only reflects it).
const access = ref({
  ownerKnown: false,
  isOwner: false,
  isFounder: false,
  canDecide: false,
  isRequester: false,
});
const isApprovedLister = computed(
  () =>
    access.value.isRequester &&
    (existingRecord.value?.status === 'claimed' ||
      existingRecord.value?.status === 'listed' ||
      existingRecord.value?.status === 'sold')
);
// Someone else's item: ask first, owner approves. Unknown owner keeps the classic direct save.
const mustRequest = computed(
  () => access.value.ownerKnown && !access.value.canDecide && !isApprovedLister.value
);

const actionBusy = ref(false);
const requestNote = ref('');
const requestableModes = COCURATION_REQUESTABLE_MODES;
const counterMode = ref<CoCurationMode>('split_half');
const counterFloorInput = ref('0.00');
const counterNote = ref('');

const isSplitFrozen = computed(
  () =>
    existingRecord.value?.status === 'listed' ||
    existingRecord.value?.status === 'sold' ||
    Boolean(existingRecord.value?.approvedAt)
);

const curatorShareLabel = computed(() => Number(curatorSharePct.value.toFixed(1)));
const commonsShareLabel = computed(() => Number(commonsSharePct.value.toFixed(1)));
const halfCuratorLabel = computed(() => Number((curatorSharePct.value / 2).toFixed(1)));

const TIER_NAMES: Record<string, string> = {
  booth_prep: 'Booth Prep Assist',
  photo_stage: 'Unbox, Photo & Stage',
  split_half: 'Full Online Turnkey',
};

const tierPct = (m: 'booth_prep' | 'photo_stage' | 'split_half') =>
  coCurationListerSharePct(m, curatorSharePct.value);

const modeLabel = (m: CoCurationMode, floor = 0): string => {
  if (m === 'transfer_price') {
    return floor > 0 ? `Transfer floor $${Number(floor).toFixed(2)}` : 'Agreed transfer floor';
  }
  if (isCoCurationTierMode(m)) return `${TIER_NAMES[m]} (${tierPct(m)}% to the Co-Curator)`;
  return 'Own listing';
};

const statusBadgeLabel = computed(() => {
  const st = existingRecord.value?.status;
  if (st === 'sold') return '🔒 Sold & Settled';
  if (st === 'listed') return '✅ Live Online';
  if (st === 'claimed') return '⏳ Claimed (14d Hold)';
  if (st === 'requested') return '📨 Request Pending';
  if (st === 'countered') return '↔️ Counter-Offer';
  return 'Released';
});

const statusBadgeClass = computed(() => {
  const st = existingRecord.value?.status;
  if (st === 'sold') return 'badge-neutral text-neutral-content';
  if (st === 'listed') return 'badge-success text-success-content';
  if (st === 'claimed' || st === 'requested' || st === 'countered') return 'badge-info text-info-content';
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
  if (!rec || isFreeCoCurationStatus(rec.status)) return;
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
    if (body?.access) {
      access.value = {
        ownerKnown: Boolean(body.access.ownerKnown),
        isOwner: Boolean(body.access.isOwner),
        isFounder: Boolean(body.access.isFounder),
        canDecide: Boolean(body.access.canDecide),
        isRequester: Boolean(body.access.isRequester),
      };
    }
    // Someone else's item can only be requested, never saved directly.
    if (mustRequest.value && mode.value === 'self_listed') mode.value = 'split_half';
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

/** One helper for every request-and-approve step (request, approve, decline, counter, accept, withdraw). */
const runAction = async (
  action: string,
  record: Record<string, any>,
  okMessage: string,
  refreshParent = false
) => {
  const id = String(props.item?.$id || '').trim();
  if (!id || actionBusy.value) return;
  actionBusy.value = true;
  try {
    const headers = await getCoopJwtHeaders();
    const res = await fetch('/api/coop/co-curation', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, itemId: id, record }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(body?.error || `That didn't go through (${res.status})`);
    }
    existingRecord.value = body?.record || null;
    addToast({ type: 'success', message: okMessage });
    // Only approving puts the item into the bin, so only then does the parent need fresh item data.
    if (refreshParent) {
      emit('saved', {
        item: body?.item || props.item || {},
        record: body?.record || null,
      });
    }
    await loadExistingClaim();
  } catch (err: any) {
    console.warn(`[ItemOnlineTab] ${action} failed:`, err);
    addToast({
      type: 'error',
      message: toUserMessage(err, "Couldn't update the co-curation request — please try again."),
    });
  } finally {
    actionBusy.value = false;
  }
};

const sendRequest = async () => {
  if (mode.value === 'self_listed') mode.value = 'split_half';
  if (mode.value === 'transfer_price' && parsePriceValue(transferFloorInput.value) <= 0) {
    addToast({ type: 'warning', message: 'Enter a transfer floor above $0.00 before sending.' });
    return;
  }
  await runAction(
    'request',
    {
      mode: mode.value,
      transferFloorPrice: parsePriceValue(transferFloorInput.value),
      binFacility: binFacility.value,
      requestNote: requestNote.value.trim(),
      upc: effectiveUpc.value,
      titleSnapshot: itemTitle.value,
    },
    '📨 Request sent. The owner has 3 days to answer.'
  );
  requestNote.value = '';
};

const sendCounter = async () => {
  if (counterMode.value === 'transfer_price' && parsePriceValue(counterFloorInput.value) <= 0) {
    addToast({ type: 'warning', message: 'Enter a transfer floor above $0.00 for your counter-offer.' });
    return;
  }
  await runAction(
    'counter',
    {
      mode: counterMode.value,
      transferFloorPrice: parsePriceValue(counterFloorInput.value),
      requestNote: counterNote.value.trim(),
    },
    '↔️ Counter-offer sent. They have 3 days to answer.'
  );
  counterNote.value = '';
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

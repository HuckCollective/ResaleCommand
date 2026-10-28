<template>
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
    <!-- ================================================================= -->
    <!-- LEFT COLUMN: Physical Item & Logistics (Priority Order)          -->
    <!-- ================================================================= -->
    <div class="lg:col-span-6 space-y-5">
      <!-- 🔗 Subtle Lot Connection Badges (Clean & Compact) -->
      <div
        v-if="item?.parentLotId"
        class="flex items-center justify-between bg-primary/10 border border-primary/25 rounded-2xl px-3.5 py-2 text-xs shadow-2xs">
        <div class="flex items-center gap-2 min-w-0">
          <Icon
            icon="solar:link-circle-bold"
            class="w-4 h-4 text-primary shrink-0" />
          <span class="opacity-70 text-[11px] shrink-0">Extracted From:</span>
          <strong class="truncate font-mono text-base-content">{{
            parentItem?.title || parentItem?.upc || item.parentLotId
          }}</strong>
        </div>
        <button
          type="button"
          @click="$emit('open-lot-tab')"
          class="btn btn-ghost btn-xs text-primary font-bold hover:underline shrink-0 gap-1">
          <span>Lot Hub</span>
          <Icon icon="solar:arrow-right-linear" class="w-3 h-3" />
        </button>
      </div>

      <div
        v-else-if="lotChildren && lotChildren.length > 0"
        class="flex items-center justify-between bg-secondary/10 border border-secondary/25 rounded-2xl px-3.5 py-2 text-xs shadow-2xs">
        <div class="flex items-center gap-2 min-w-0">
          <Icon
            icon="solar:box-minimalistic-bold"
            class="w-4 h-4 text-secondary shrink-0" />
          <span class="opacity-70 text-[11px] shrink-0">Main Lot:</span>
          <strong class="font-bold text-secondary"
            >{{ lotChildren.length }} Split Listings Active</strong
          >
        </div>
        <button
          type="button"
          @click="$emit('open-lot-tab')"
          class="btn btn-ghost btn-xs text-secondary font-bold hover:underline shrink-0 gap-1">
          <span>Manage in Lot Hub</span>
          <Icon icon="solar:arrow-right-linear" class="w-3 h-3" />
        </button>
      </div>

      <!-- 2. 📸 PHOTOS & SOURCING MEDIA -->
      <div
        class="bg-base-200/50 rounded-2xl p-4 border border-base-300 space-y-3.5">
        <slot name="gallery-manager"></slot>

        <!-- Sourcing URL & Image Scraper Bar -->
        <div class="form-control">
          <div class="join w-full shadow-xs">
            <input
              type="text"
              v-model="editForm.sourcingLocation"
              placeholder="Paste ShopGoodwill Item # or Listing URL..."
              class="input input-bordered input-sm join-item grow font-mono text-xs bg-base-100 rounded-l-xl h-10"
              @keydown.enter.prevent="$emit('fetch-source-data')" />
            <button
              class="btn btn-primary btn-sm join-item shrink-0 gap-1.5 font-bold rounded-r-xl h-10 px-4"
              @click="$emit('fetch-source-data')"
              :disabled="!editForm.sourcingLocation || fetchingImages"
              title="Fetch photos & metadata from listing">
              <span
                v-if="fetchingImages"
                class="loading loading-spinner loading-xs"></span>
              <Icon v-else icon="solar:cloud-download-bold" class="w-4 h-4" />
              <span>Fetch</span>
            </button>
          </div>
        </div>

        <!-- 📸 Fetched Listing Photos Tray (Pick & Add) -->
        <div
          v-if="fetchedImages && fetchedImages.length > 0"
          class="bg-base-100 rounded-xl p-3 border border-primary/40 shadow-md space-y-2.5 transition-all">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <span class="badge badge-primary badge-sm font-bold shadow-xs">{{
                fetchedImages.length
              }}</span>
              <span class="text-xs font-bold text-base-content"
                >Fetched Photos Available</span
              >
            </div>
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                @click="$emit('add-all-fetched-images')"
                class="btn btn-xs btn-primary gap-1 font-bold shadow-xs"
                title="Add all fetched photos to gallery">
                <Icon icon="solar:gallery-add-bold" class="w-3.5 h-3.5" />
                <span>Add All</span>
              </button>
              <button
                type="button"
                @click="$emit('dismiss-fetched-images')"
                class="btn btn-xs btn-ghost btn-circle opacity-60 hover:opacity-100"
                title="Dismiss fetched photos">
                ✕
              </button>
            </div>
          </div>

          <!-- Image Grid -->
          <div
            class="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2.5 max-h-64 overflow-y-auto p-1.5 rounded-xl bg-base-200/60 border border-base-300">
            <div
              v-for="(imgUrl, idx) in fetchedImages"
              :key="idx"
              class="group relative aspect-square w-full rounded-xl border-2 border-base-300 overflow-hidden bg-base-100 shadow-xs hover:border-primary transition-all flex items-center justify-center cursor-pointer">
              <img
                :src="proxify(typeof imgUrl === 'string' ? imgUrl : imgUrl.url)"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                loading="lazy" />

              <!-- Downloading Spinner Overlay -->
              <div
                v-if="
                  downloadingImageUrls &&
                  downloadingImageUrls[
                    typeof imgUrl === 'string' ? imgUrl : imgUrl.url
                  ]
                "
                class="absolute inset-0 bg-base-300/80 backdrop-blur-xs flex items-center justify-center z-20">
                <span
                  class="loading loading-spinner loading-xs text-primary"></span>
              </div>

              <!-- Hover Actions -->
              <div
                class="absolute inset-0 bg-neutral/80 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1 z-10">
                <button
                  type="button"
                  class="btn btn-xs btn-primary w-full text-[10px] h-6 min-h-0 px-1 font-bold shadow-xs gap-0.5"
                  @click.stop="
                    $emit(
                      'select-fetched-image',
                      typeof imgUrl === 'string' ? imgUrl : imgUrl.url,
                      false,
                    )
                  "
                  title="Add to gallery">
                  <Icon icon="solar:add-circle-bold" class="w-3 h-3" />
                  <span>+ Gallery</span>
                </button>
                <button
                  type="button"
                  class="btn btn-xs btn-warning w-full text-[10px] h-6 min-h-0 px-1 font-bold shadow-xs gap-0.5"
                  @click.stop="
                    $emit(
                      'select-fetched-image',
                      typeof imgUrl === 'string' ? imgUrl : imgUrl.url,
                      true,
                    )
                  "
                  title="Set as main photo">
                  <Icon icon="solar:star-bold" class="w-3 h-3" />
                  <span>Set Main</span>
                </button>
              </div>
            </div>
          </div>
          <p class="text-[10px] text-base-content/60 text-center font-medium">
            Click <strong>+ Gallery</strong> to add or
            <strong>Set Main ⭐</strong> to pick photo
          </p>
        </div>
      </div>

      <!-- 3. 🛡️ ACQUISITION & BASE COST (PROTECTED / LOCKABLE) -->
      <div
        class="bg-base-200/70 rounded-2xl p-4 border border-base-300 relative shadow-sm">
        <div
          class="flex justify-between items-center border-b border-base-300 pb-2.5 mb-3">
          <div class="flex items-center gap-2">
            <div
              class="w-6 h-6 rounded-md bg-warning/15 flex items-center justify-center text-warning font-bold">
              <Icon icon="solar:shield-check-bold" class="w-3.5 h-3.5" />
            </div>
            <div>
              <h4
                class="font-bold text-xs uppercase tracking-wider text-base-content">
                Acquisition & Base Cost
              </h4>
              <p class="text-[10px] opacity-60">
                Protected sourcing provenance
              </p>
            </div>
          </div>

          <!-- Lock / Unlock Toggle Button -->
          <button
            type="button"
            class="btn btn-xs gap-1 font-bold transition-all shadow-xs"
            :class="
              isAcquisitionUnlocked
                ? 'btn-warning text-warning-content'
                : 'btn-outline btn-ghost opacity-70 hover:opacity-100'
            "
            @click="
              $emit('update:isAcquisitionUnlocked', !isAcquisitionUnlocked)
            "
            title="Toggle lock to protect original purchase cost and order ID">
            <Icon
              :icon="
                isAcquisitionUnlocked
                  ? 'solar:lock-unlocked-bold'
                  : 'solar:lock-bold'
              "
              class="w-3.5 h-3.5" />
            <span>{{ isAcquisitionUnlocked ? "Unlocked" : "Locked" }}</span>
          </button>
        </div>

        <!-- Read-Only Locked View (Default) -->
        <div
          v-if="!isAcquisitionUnlocked && item"
          class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs bg-base-100/70 p-3 rounded-xl border border-base-200">
          <div>
            <span class="text-[10px] opacity-50 block font-bold uppercase">{{
              Number(editForm.quantity || 1) > 1 ? "Total Cost" : "Buy Cost"
            }}</span>
            <span class="font-mono font-bold text-sm text-base-content">
              ${{ Number(editForm.cost || 0).toFixed(2) }}
              <span
                v-if="Number(editForm.quantity || 1) > 1"
                class="text-[10px] opacity-70 font-normal ml-0.5">
                (${{
                  (
                    Number(editForm.cost || 0) / Number(editForm.quantity || 1)
                  ).toFixed(2)
                }}/ea)
              </span>
            </span>
          </div>
          <div>
            <span class="text-[10px] opacity-50 block font-bold uppercase"
              >Order #</span
            >
            <a
              v-if="editForm.orderId || item?.purchaseId || item?.cartId"
              :href="`/purchases/${editForm.orderId || item?.purchaseId || item?.cartId}`"
              target="_blank"
              class="font-mono font-bold text-primary hover:underline truncate flex items-center gap-1 text-xs"
              :title="`Open ${editForm.orderId || 'Purchase Order'} details`">
              <span class="truncate">{{ editForm.orderId || "View PO" }}</span>
              <Icon
                icon="solar:arrow-right-up-linear"
                class="w-3 h-3 shrink-0 opacity-70" />
            </a>
            <span
              v-else
              class="font-mono font-semibold truncate block opacity-50"
              >None</span
            >
          </div>
          <div class="col-span-2 sm:col-span-1 flex flex-col justify-center">
            <span class="text-[10px] opacity-50 block font-bold uppercase"
              >Sourcing Origin</span
            >
            <a
              v-if="
                editForm.sourcingLocation &&
                editForm.sourcingLocation.startsWith('http')
              "
              :href="editForm.sourcingLocation"
              target="_blank"
              class="text-primary link font-bold flex items-center gap-1 truncate text-xs"
              title="Open Sourcing Source Link">
              <span class="truncate">{{
                editForm.sourcingLocation
                  .replace(/^https?:\/\/(www\.)?/, "")
                  .split("/")[0]
              }}</span>
              <Icon
                icon="solar:arrow-right-up-linear"
                class="w-3 h-3 shrink-0 opacity-70" />
            </a>
            <span
              v-else-if="editForm.sourcingLocation"
              class="font-bold text-xs truncate">
              {{ editForm.sourcingLocation }}
            </span>
            <span v-else class="opacity-40 italic text-[11px]"
              >Direct Entry</span
            >
          </div>
        </div>

        <!-- Editable Unlocked Form -->
        <div v-else class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div class="form-control">
              <label class="label py-0.5 flex items-center justify-between">
                <span class="label-text text-xs font-bold">{{
                  Number(editForm.quantity || 1) > 1
                    ? "Total Cost Basis ($)"
                    : "Buy Cost Basis ($)"
                }}</span>
                <span
                  v-if="Number(editForm.quantity || 1) > 1"
                  class="text-[10px] opacity-70 font-mono font-bold text-base-content/80">
                  ${{
                    (
                      Number(editForm.cost || 0) /
                      Number(editForm.quantity || 1)
                    ).toFixed(2)
                  }}/ea
                </span>
              </label>
              <div class="relative">
                <span
                  class="absolute left-3 top-1/2 -translate-y-1/2 opacity-50 font-bold text-xs"
                  >$</span
                >
                <input
                  type="number"
                  step="0.01"
                  v-model="editForm.cost"
                  placeholder="0.00"
                  class="input input-bordered input-sm w-full pl-6 font-mono font-bold bg-base-100" />
              </div>
              <!-- Quick helper if user entered unit cost instead of total cost on a multi-qty item -->
              <div
                v-if="
                  Number(editForm.quantity || 1) > 1 &&
                  Number(editForm.cost) > 0 &&
                  Number(editForm.cost) < 15 &&
                  Number(editForm.resalePrice) >= Number(editForm.cost)
                "
                class="mt-1 flex items-center justify-between text-[10px] bg-warning/10 border border-warning/20 rounded-md px-1.5 py-0.5 text-warning-content">
                <span class="truncate">Is ${{ editForm.cost }} per-item?</span>
                <button
                  type="button"
                  @click="
                    editForm.cost = Number(
                      (
                        Number(editForm.cost) * Number(editForm.quantity)
                      ).toFixed(2),
                    )
                  "
                  class="btn btn-2xs btn-warning font-bold shrink-0 ml-1">
                  Set Total (${{
                    (Number(editForm.cost) * Number(editForm.quantity)).toFixed(
                      2,
                    )
                  }})
                </button>
              </div>
            </div>
            <div class="form-control">
              <label class="label py-0.5 flex items-center justify-between">
                <span class="label-text text-xs font-bold"
                  >Order / Invoice #</span
                >
                <a
                  v-if="editForm.orderId"
                  :href="`/purchases?search=${encodeURIComponent(editForm.orderId)}`"
                  target="_blank"
                  class="text-[10px] text-primary font-bold hover:underline flex items-center gap-0.5"
                  title="Open PO in Purchases">
                  <Icon icon="solar:link-minimalistic-bold" class="w-3 h-3" />
                  View PO
                </a>
              </label>
              <input
                type="text"
                v-model="editForm.orderId"
                placeholder="e.g. SGW-84920"
                class="input input-bordered input-sm w-full font-mono text-xs bg-base-100" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="form-control">
              <label class="label py-0.5"
                ><span class="label-text text-xs font-bold"
                  >Origin / Provenance</span
                ></label
              >
              <input
                type="text"
                v-model="editForm.countryOfOrigin"
                placeholder="e.g. USA, Japan, Estate Sale"
                class="input input-bordered input-sm w-full text-xs bg-base-100" />
            </div>
            <div class="form-control">
              <label class="label py-0.5"
                ><span class="label-text text-xs font-bold"
                  >Sourcing Origin / Link</span
                ></label
              >
              <input
                type="text"
                v-model="editForm.sourcingLocation"
                placeholder="e.g. ShopGoodwill, CTBids, URL..."
                class="input input-bordered input-sm w-full font-mono text-xs bg-base-100" />
            </div>
          </div>
          <div class="form-control">
            <label class="label py-0.5 flex items-center justify-between">
              <span class="label-text text-xs font-bold">Parent Lot ID</span>
              <span
                v-if="editForm.parentLotId"
                class="badge badge-xs badge-secondary font-bold"
                >Extracted</span
              >
            </label>
            <div class="join w-full shadow-xs">
              <input
                type="text"
                :value="editForm.parentLotId || 'None'"
                disabled
                class="input input-bordered input-sm join-item grow text-xs bg-base-200/60 font-mono opacity-80" />
              <button
                v-if="editForm.parentLotId"
                type="button"
                @click="editForm.parentLotId = null"
                class="btn btn-sm btn-outline btn-error join-item font-bold text-xs"
                title="Unlink and make standalone">
                Unlink
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. 💲 PRICING & MARGIN (PROTECTED WHEN SOLD) -->
      <div
        class="bg-base-200/70 rounded-2xl p-4 border border-base-300 relative shadow-sm space-y-3">
        <div
          class="flex flex-wrap justify-between items-center gap-2 border-b border-base-300 pb-2.5">
          <div class="flex items-center gap-2">
            <div
              class="w-6 h-6 rounded-md bg-success/15 flex items-center justify-center text-success font-bold shrink-0">
              <Icon icon="solar:dollar-bold" class="w-3.5 h-3.5" />
            </div>
            <div>
              <h4
                class="font-bold text-xs uppercase tracking-wider text-base-content">
                Pricing & Margin
              </h4>
              <p class="text-[10px] opacity-60">
                Realized sale and margin tracking
              </p>
            </div>
          </div>

          <div class="flex items-center gap-1.5 flex-wrap justify-end">
            <!-- Margin Indicator -->
            <div
              v-if="calculatedMargin !== null"
              class="badge badge-sm font-mono font-bold whitespace-nowrap shrink-0"
              :class="
                calculatedMargin >= 50
                  ? 'badge-success text-white'
                  : calculatedMargin >= 20
                    ? 'badge-warning'
                    : 'badge-error'
              ">
              {{ calculatedMargin }}% Est. Margin
            </div>

            <!-- If Sold: Locked Badge / SO Link (Matches Acquisition card above) -->
            <a
              v-if="isSold"
              :href="`/sales/${linkedSaleOrderId}`"
              class="btn btn-xs gap-1 font-bold transition-all shadow-xs btn-outline btn-ghost opacity-70 hover:opacity-100 whitespace-nowrap shrink-0"
              title="Pricing is locked because item is sold. Click to view Sales Order.">
              <Icon icon="solar:lock-bold" class="w-3.5 h-3.5" />
              <span>Locked</span>
            </a>

            <!-- If Active: Quick Record Sale Link + Last Sale SO Link if partially sold -->
            <template v-else-if="item">
              <a
                v-if="item.saleId"
                :href="`/sales/${linkedSaleOrderId}`"
                class="btn btn-xs gap-1 font-bold transition-all shadow-xs btn-outline btn-ghost opacity-75 hover:opacity-100 font-mono text-[11px] whitespace-nowrap shrink-0"
                title="View previous Sales Order for this batch">
                <span>Last Sale SO</span>
                <Icon
                  icon="solar:arrow-right-up-linear"
                  class="w-3 h-3 shrink-0" />
              </a>

              <a
                :href="`/sales/new?itemId=${item.$id}`"
                class="btn btn-xs gap-1 font-bold transition-all shadow-xs btn-outline btn-success opacity-85 hover:opacity-100 whitespace-nowrap shrink-0"
                title="Record a sale for this item">
                <Icon icon="solar:cart-check-bold" class="w-3.5 h-3.5" />
                <span>Record Sale</span>
              </a>
            </template>
          </div>
        </div>

        <!-- Read-Only Locked View when Sold (Consistent with Acquisition Card Above) -->
        <div
          v-if="isSold"
          class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs bg-base-100/70 p-3 rounded-xl border border-base-200">
          <div>
            <span class="text-[10px] opacity-50 block font-bold uppercase"
              >Quantity</span
            >
            <span class="font-mono font-bold text-sm text-base-content">{{
              editForm.quantity || 1
            }}</span>
          </div>
          <div>
            <span class="text-[10px] opacity-50 block font-bold uppercase">
              {{
                Number(editForm.quantity || 1) > 1
                  ? "List Price (Per Item)"
                  : "List Price"
              }}
            </span>
            <span class="font-mono font-bold text-sm text-base-content">
              ${{ Number(editForm.resalePrice || 0).toFixed(2) }}
              <span
                v-if="Number(editForm.quantity || 1) > 1"
                class="text-[10px] opacity-60 font-normal ml-0.5"
                >/ea</span
              >
            </span>
            <span
              v-if="Number(editForm.quantity || 1) > 1"
              class="text-[10px] opacity-50 font-mono block">
              Total: ${{
                (
                  (Number(editForm.resalePrice) || 0) *
                  (Number(editForm.quantity) || 1)
                ).toFixed(2)
              }}
            </span>
          </div>
          <div>
            <span
              class="text-[10px] opacity-50 block font-bold uppercase text-success"
              >Sold Price</span
            >
            <span class="font-mono font-black text-sm text-success"
              >${{ Number(editForm.soldPrice || 0).toFixed(2) }}</span
            >
          </div>
          <div>
            <span class="text-[10px] opacity-50 block font-bold uppercase"
              >Sales Order</span
            >
            <a
              :href="`/sales/${linkedSaleOrderId}`"
              class="font-mono font-bold text-primary hover:underline truncate flex items-center gap-1 text-xs"
              title="Open Sales Order details">
              <span>View SO</span>
              <Icon
                icon="solar:arrow-right-up-linear"
                class="w-3 h-3 shrink-0 opacity-70" />
            </a>
          </div>
        </div>

        <!-- Editable Unlocked Form when Not Sold (With perfectly aligned labels and controls) -->
        <div v-else class="space-y-3">
          <div class="grid grid-cols-3 gap-3 items-start">
            <!-- Quantity -->
            <div class="form-control">
              <label class="label py-0 h-6 flex items-center justify-between">
                <span class="label-text text-xs font-bold">Quantity</span>
                <button
                  v-if="
                    item &&
                    Number(editForm.quantity) <= 1 &&
                    !isSold &&
                    !isRestockOpen
                  "
                  type="button"
                  @click="isRestockOpen = true"
                  class="text-[10px] text-primary hover:underline font-bold"
                  title="Restock and convert this item to a multi-quantity bin">
                  + Restock Bin
                </button>
              </label>
              <input
                type="number"
                step="1"
                min="1"
                v-model.number="editForm.quantity"
                class="input input-bordered input-sm w-full h-8 min-h-8 text-center font-bold font-mono bg-base-100 rounded-lg" />
            </div>

            <!-- List Price (Per Item) -->
            <div class="form-control">
              <label class="label py-0 h-6 flex items-center justify-between">
                <span class="label-text text-xs font-bold truncate">
                  {{
                    Number(editForm.quantity) > 1 ? "List / Item" : "List Price"
                  }}
                </span>
                <span
                  v-if="Number(editForm.quantity) > 1"
                  class="text-[10px] text-secondary font-mono font-bold shrink-0 ml-1"
                  title="Calculated total lot value across all units">
                  Lot: ${{
                    (
                      (Number(editForm.resalePrice) || 0) *
                      (Number(editForm.quantity) || 1)
                    ).toFixed(2)
                  }}
                </span>
              </label>
              <div class="relative">
                <span
                  class="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50 font-bold text-xs"
                  >$</span
                >
                <input
                  type="number"
                  step="0.01"
                  v-model="editForm.resalePrice"
                  placeholder="0.00"
                  class="input input-bordered input-sm w-full h-8 min-h-8 pl-6 font-mono font-bold bg-base-100 rounded-lg"
                  :class="{ 'pr-8': Number(editForm.quantity) > 1 }" />
                <span
                  v-if="Number(editForm.quantity) > 1"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold opacity-50 pointer-events-none"
                  >/ea</span
                >
              </div>
              <div
                v-if="editForm.estLow || editForm.estHigh"
                class="text-[10px] font-mono opacity-60 mt-1 truncate"
                title="Estimated Comps Range">
                Comps: ${{ editForm.estLow || "0" }} – ${{
                  editForm.estHigh || "0"
                }}
              </div>
            </div>

            <!-- Sold Price -->
            <div class="form-control">
              <label class="label py-0 h-6 flex items-center"
                ><span class="label-text text-xs font-bold text-success"
                  >Sold Price</span
                ></label
              >
              <div class="relative">
                <span
                  class="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50 font-bold text-xs"
                  >$</span
                >
                <input
                  type="number"
                  step="0.01"
                  v-model="editForm.soldPrice"
                  placeholder="0.00"
                  class="input input-bordered input-sm w-full h-8 min-h-8 pl-6 font-mono font-bold bg-base-100 rounded-lg" />
              </div>
            </div>
          </div>

          <!-- Multi-Quantity Splitting & Restocking Actions Bar -->
          <div
            v-if="item && (Number(editForm.quantity) > 1 || isRestockOpen)"
            class="border border-secondary/30 bg-secondary/5 rounded-xl p-2.5 mt-2 space-y-2.5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div
                class="text-[11px] font-bold text-secondary flex items-center gap-1.5 flex-wrap">
                <Icon
                  icon="solar:box-minimalistic-bold"
                  class="w-4 h-4 shrink-0" />
                <span
                  >Multi-Quantity Batch: {{ editForm.quantity }} Units @ ${{
                    Number(editForm.resalePrice || 0).toFixed(2)
                  }}/ea</span
                >
                <span
                  class="badge badge-xs badge-secondary font-mono font-bold text-[10px]">
                  ${{
                    (
                      (Number(editForm.resalePrice) || 0) *
                      Number(editForm.quantity)
                    ).toFixed(2)
                  }}
                  Total
                </span>
              </div>
              <div class="flex items-center gap-1.5 flex-wrap">
                <button
                  v-if="Number(editForm.quantity) > 1"
                  @click.prevent="$emit('sell-one-quantity')"
                  class="btn btn-xs btn-success font-bold gap-1 shadow-xs"
                  title="Log sale of 1 unit at per-item price and subtract unit cost">
                  <Icon icon="solar:cart-check-linear" class="w-3.5 h-3.5" />
                  Sell 1 Unit
                </button>
                <button
                  v-if="Number(editForm.quantity) > 1"
                  @click.prevent="$emit('split-one-active')"
                  class="btn btn-xs btn-outline btn-secondary font-bold gap-1 shadow-xs"
                  title="Extract 1 unit as a new active inventory item">
                  <Icon icon="solar:scissors-linear" class="w-3.5 h-3.5" />
                  Split 1 Active
                </button>
                <button
                  @click.prevent="isRestockOpen = !isRestockOpen"
                  class="btn btn-xs btn-primary font-bold gap-1 shadow-xs"
                  :class="{ 'btn-active': isRestockOpen }"
                  title="Add additional units and pool acquisition cost basis">
                  <Icon icon="solar:box-plus-bold" class="w-3.5 h-3.5" /> ➕
                  Restock Bin
                </button>
              </div>
            </div>

            <!-- Expandable Restock Form with Live Before ➔ After Preview -->
            <div
              v-if="isRestockOpen"
              class="pt-2 border-t border-secondary/20 space-y-2.5">
              <div class="flex items-center justify-between">
                <span
                  class="text-xs font-bold text-base-content flex items-center gap-1">
                  <Icon
                    icon="solar:box-plus-bold"
                    class="w-4 h-4 text-primary" />
                  <span
                    >Restock Units &amp; Pool Cost Basis (COGS Audited)</span
                  >
                </span>
                <button
                  type="button"
                  @click="cancelRestock"
                  class="btn btn-ghost btn-circle btn-xs text-base-content/60 hover:text-base-content"
                  title="Close restock">
                  ✕
                </button>
              </div>

              <!-- Two Restock Source Modes Toggle -->
              <div
                class="grid grid-cols-2 gap-1.5 bg-base-200/80 p-1 rounded-xl border border-base-300">
                <button
                  type="button"
                  @click="restockSourceMode = 'backstock'"
                  class="btn btn-xs h-auto py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 leading-tight"
                  :class="
                    restockSourceMode === 'backstock'
                      ? 'btn-primary text-primary-content shadow-xs'
                      : 'btn-ghost opacity-70 hover:opacity-100'
                  ">
                  <span>📥 Pull from Backstock (HG) Item</span>
                </button>
                <button
                  type="button"
                  @click="switchToWalkinMode"
                  class="btn btn-xs h-auto py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 leading-tight"
                  :class="
                    restockSourceMode === 'walkin'
                      ? 'btn-secondary text-secondary-content shadow-xs'
                      : 'btn-ghost opacity-70 hover:opacity-100'
                  ">
                  <span>💵 Direct Cash / Walk-In Buy</span>
                </button>
              </div>

              <!-- MODE A: Pull from Backstock (HG) Item (Absorb Existing Purchase) -->
              <div
                v-if="restockSourceMode === 'backstock'"
                class="bg-base-100 rounded-xl p-2.5 border border-primary/30 space-y-2 text-xs">
                <div class="flex items-center justify-between gap-2">
                  <span
                    class="font-bold text-[11px] text-primary flex items-center gap-1">
                    <Icon
                      icon="solar:archive-down-minimlistic-bold"
                      class="w-3.5 h-3.5" />
                    <span
                      >Select Unplaced Backstock (HG / Acquired / Received)
                      Item</span
                    >
                  </span>
                  <span class="badge badge-2xs badge-ghost font-mono whitespace-nowrap shrink-0"
                    >{{ filteredBackstockItems.length }} available</span
                  >
                </div>

                <!-- Search Input -->
                <div class="relative">
                  <Icon
                    icon="solar:magnifer-linear"
                    class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50" />
                  <input
                    type="text"
                    v-model="restockSearchQuery"
                    placeholder="Search HG / acquired items by title, UPC (e.g. HUCK-...), or PO #..."
                    class="input input-bordered input-xs w-full pl-7 pr-6 font-mono text-[11px] bg-base-200/40" />
                  <button
                    v-if="restockSearchQuery"
                    type="button"
                    @click="restockSearchQuery = ''"
                    class="absolute right-2 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 text-[10px]">
                    ✕
                  </button>
                </div>

                <!-- Searchable List of Active Unplaced HG / Acquired / Received Items -->
                <div
                  v-if="filteredBackstockItems.length > 0"
                  class="max-h-40 overflow-y-auto space-y-1 pr-0.5">
                  <div
                    v-for="cand in filteredBackstockItems"
                    :key="cand.$id"
                    @click="selectBackstockItem(cand)"
                    class="p-2 rounded-lg border cursor-pointer transition-all flex items-center justify-between gap-2 select-none"
                    :class="
                      selectedBackstockItem?.$id === cand.$id
                        ? 'border-primary bg-primary/10 ring-1 ring-primary/40 shadow-2xs'
                        : 'border-base-300 bg-base-100 hover:border-primary/40 hover:bg-base-200/50'
                    ">
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-1 flex-wrap">
                        <span
                          class="badge badge-2xs font-mono font-bold"
                          :class="
                            selectedBackstockItem?.$id === cand.$id
                              ? 'badge-primary'
                              : 'badge-neutral'
                          ">
                          {{ cand.upc || "NO-UPC" }}
                        </span>
                        <span
                          class="badge badge-2xs badge-ghost font-mono uppercase">
                          {{ cand.storageLocation || cand.status || "HG" }}
                        </span>
                        <span
                          v-if="cand.orderId || cand.purchaseId"
                          class="badge badge-2xs bg-info/15 text-info border-0 font-mono">
                          PO:
                          {{
                            cand.orderId || String(cand.purchaseId).slice(0, 10)
                          }}
                        </span>
                      </div>
                      <p
                        class="text-[11px] font-bold truncate mt-0.5 text-base-content">
                        {{ cand.title }}
                      </p>
                    </div>
                    <div class="text-right font-mono shrink-0">
                      <div class="text-[11px] font-bold text-primary">
                        +{{ getBackstockItemMetrics(cand).qty }} unit{{
                          getBackstockItemMetrics(cand).qty === 1 ? "" : "s"
                        }}
                      </div>
                      <div class="text-[10px] opacity-75">
                        ${{
                          getBackstockItemMetrics(cand).totalCost.toFixed(2)
                        }}
                        cost
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  v-else
                  class="text-center py-3 opacity-60 text-[11px] italic">
                  No matching unplaced Backstock (HG / Acquired / Received)
                  items found.
                </div>

                <!-- Selected Backstock Item Lineage Pill -->
                <div
                  v-if="selectedBackstockItem"
                  class="p-2 rounded-lg bg-primary/10 border border-primary/30 text-[11px] flex items-start justify-between gap-2">
                  <div class="space-y-0.5 leading-snug">
                    <div
                      class="font-bold text-primary flex items-center gap-1 flex-wrap">
                      <Icon
                        icon="solar:check-circle-bold"
                        class="w-3.5 h-3.5 shrink-0" />
                      <span
                        >Absorbing
                        {{
                          selectedBackstockItem.upc ||
                          selectedBackstockItem.$id
                        }}: {{ selectedBackstockItem.title }}</span
                      >
                    </div>
                    <div class="opacity-80 text-[10px]">
                      Preserves PO lineage (<span class="font-mono font-bold"
                        >status: 'combined'</span
                      >, linked to this bin)<span
                        v-if="
                          getBackstockItemMetrics(selectedBackstockItem)
                            .photoCount > 0
                        ">
                        &amp; copies
                        <strong
                          >{{
                            getBackstockItemMetrics(selectedBackstockItem)
                              .photoCount
                          }}
                          photo(s)</strong
                        >
                        into gallery</span
                      >.
                    </div>
                  </div>
                  <button
                    type="button"
                    @click="selectedBackstockItemId = ''"
                    class="btn btn-2xs btn-ghost shrink-0">
                    Clear
                  </button>
                </div>
              </div>

              <!-- MODE B: Direct Cash / Walk-In Buy (New Unlogged Purchase) -->
              <div
                v-else
                class="bg-base-100 rounded-xl p-2.5 border border-secondary/30 space-y-2 text-xs">
                <div class="form-control">
                  <label class="label py-0.5 flex items-center justify-between">
                    <span class="label-text text-[11px] font-bold"
                      >Vendor / Source (Creates Auditable PO)</span
                    >
                    <span class="badge badge-2xs badge-secondary font-mono"
                      >Auto-PO</span
                    >
                  </label>
                  <input
                    type="text"
                    v-model="restockVendor"
                    placeholder="Walk-In / Thrift Restock"
                    class="input input-bordered input-xs w-full bg-base-100 text-xs font-medium" />
                </div>
                <div
                  v-if="restockAddedCostVal > 0"
                  class="text-[10px] bg-secondary/10 border border-secondary/20 rounded-lg px-2 py-1 text-base-content/80 flex items-center gap-1.5">
                  <Icon
                    icon="solar:document-add-bold"
                    class="w-3.5 h-3.5 text-secondary shrink-0" />
                  <span
                    >Will automatically create a Received Purchase Order for
                    <strong class="font-mono"
                      >${{ restockAddedCostVal.toFixed(2) }}</strong
                    >
                    under
                    <strong>{{
                      restockVendor || "Walk-In / Thrift Restock"
                    }}</strong
                    >.</span
                  >
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div class="form-control">
                  <label class="label py-0.5"
                    ><span class="label-text text-[11px] font-bold"
                      >+ Units to Add</span
                    ></label
                  >
                  <input
                    type="number"
                    step="1"
                    min="1"
                    v-model.number="restockUnitsToAdd"
                    class="input input-bordered input-xs font-mono font-bold w-full bg-base-100 text-center"
                    placeholder="e.g. 18" />
                </div>
                <div class="form-control">
                  <label class="label py-0.5"
                    ><span class="label-text text-[11px] font-bold"
                      >+ Added Cost Basis ($)</span
                    ></label
                  >
                  <div class="relative">
                    <span
                      class="absolute left-2 top-1/2 -translate-y-1/2 text-xs opacity-50 font-bold"
                      >$</span
                    >
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      v-model.number="restockAddedCost"
                      class="input input-bordered input-xs font-mono font-bold w-full bg-base-100 pl-5"
                      placeholder="0.00" />
                  </div>
                </div>
              </div>

              <!-- Live "Before ➔ After" Pooled Cost & Profit Preview -->
              <div
                class="bg-base-100 rounded-xl p-3 border border-base-300 space-y-2 text-xs">
                <div
                  class="font-bold text-[11px] uppercase tracking-wider text-base-content/70 flex items-center gap-1.5 border-b border-base-200 pb-1.5">
                  <Icon
                    icon="solar:calculator-minimalistic-bold"
                    class="w-3.5 h-3.5 text-primary" />
                  <span>Live Pooled Cost &amp; Profit Preview</span>
                </div>

                <div class="space-y-1 font-mono text-[11px]">
                  <div class="flex items-center justify-between">
                    <span class="opacity-70">Current Bin:</span>
                    <span class="font-bold"
                      >{{ restockCurrentQty }} units | ${{
                        restockCurrentCost.toFixed(2)
                      }}
                      total
                      <span class="opacity-60 font-normal"
                        >(${{ restockCurrentUnitCost.toFixed(2) }}/ea)</span
                      ></span
                    >
                  </div>
                  <div class="flex items-center justify-between text-secondary">
                    <span class="font-bold">+ Adding Now:</span>
                    <span class="font-bold"
                      >+{{ restockUnitsToAddVal }} units | +${{
                        restockAddedCostVal.toFixed(2)
                      }}
                      total
                      <span class="opacity-80 font-normal"
                        >(${{ restockAddedUnitCost.toFixed(2) }}/ea)</span
                      ></span
                    >
                  </div>
                  <div
                    class="flex items-center justify-between text-success font-bold border-t border-base-200 pt-1">
                    <span>✅ New Pooled Bin Total:</span>
                    <span
                      >{{ restockNewQty }} units | ${{
                        restockNewTotalCost.toFixed(2)
                      }}
                      total
                      <span class="text-base-content/80 font-normal"
                        >(${{ restockNewAvgUnitCost.toFixed(2) }}/ea)</span
                      ></span
                    >
                  </div>
                </div>

                <!-- Profit Per Sale Check -->
                <div
                  class="bg-success/10 border border-success/20 rounded-lg p-2 text-[11px] flex items-start gap-1.5 text-success-content dark:text-success">
                  <Icon
                    icon="solar:dollar-bold"
                    class="w-4 h-4 shrink-0 text-success mt-0.5" />
                  <div class="leading-snug">
                    <span class="font-bold">💰 Profit Per Sale Check:</span>
                    At
                    <strong class="font-mono"
                      >${{
                        Number(editForm.resalePrice || 0).toFixed(2)
                      }}</strong
                    >
                    tag price
                    <span class="opacity-80"
                      >(~${{ restockNetAfterFee.toFixed(2) }} net after 15%
                      booth fee)</span
                    >, each sale recoups
                    <strong class="font-mono"
                      >${{ restockNewAvgUnitCost.toFixed(2) }}</strong
                    >
                    cost +
                    <strong class="font-mono text-success font-black"
                      >+${{ restockNetProfitPerUnit.toFixed(2) }}</strong
                    >
                    pure profit!
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  @click="cancelRestock"
                  class="btn btn-xs btn-ghost">
                  Cancel
                </button>
                <button
                  type="button"
                  @click="confirmRestock"
                  :disabled="
                    restockUnitsToAddVal < 1 ||
                    (restockSourceMode === 'backstock' &&
                      !selectedBackstockItem)
                  "
                  class="btn btn-xs btn-primary font-bold gap-1 shadow-xs">
                  <Icon icon="solar:check-circle-bold" class="w-3.5 h-3.5" />
                  <span
                    v-if="
                      restockSourceMode === 'backstock' && selectedBackstockItem
                    ">
                    Absorb {{ selectedBackstockItem.upc || "Item" }} &amp;
                    Restock (+{{ restockUnitsToAddVal }} units)
                  </span>
                  <span v-else>
                    Confirm Restock (+{{ restockUnitsToAddVal }} units)
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 5. 📍 STORAGE LOCATION & STATUS -->
      <div
        class="bg-base-200/50 rounded-2xl p-4 border border-base-300 space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
          <!-- Warehouse / Facility -->
          <div class="form-control">
            <label class="label py-0 h-6 flex items-center justify-between">
              <span class="label-text text-xs font-bold"
                >Warehouse / Facility</span
              >
            </label>
            <select
              v-model="selectedFacility"
              class="select select-bordered select-sm w-full h-8 min-h-8 font-bold text-xs bg-base-100">
              <option value="HG">Huck's Garage (HG)</option>
              <option value="HD">Hideout (HD)</option>
              <option value="MD">
                Memory Den - Huck's Adventures Outfitters (MD)
              </option>
              <option value="DT">Dusty Tiger (DT)</option>
              <option value="__custom__">Custom / Other Location...</option>
            </select>
          </div>

          <!-- Bin / Shelf Location -->
          <div class="form-control" v-if="selectedFacility !== '__custom__'">
            <label class="label py-0 h-6 flex items-center justify-between">
              <span class="label-text text-xs font-bold"
                >Storage (Bin / Shelf)</span
              >
              <span
                v-if="editForm.storageLocation"
                class="text-[10px] font-mono font-bold badge badge-xs badge-primary leading-none">
                {{ editForm.storageLocation }}
              </span>
            </label>
            <input
              type="text"
              v-model="facilityBin"
              list="facility-bins-list"
              placeholder="e.g. RED BIN-16, 04..."
              class="input input-bordered input-sm w-full h-8 min-h-8 font-mono text-xs bg-base-100 uppercase" />
            <datalist id="facility-bins-list">
              <option
                v-for="bin in availableBinsForFacility"
                :key="bin"
                :value="bin"></option>
            </datalist>
          </div>

          <!-- Custom Raw Location -->
          <div class="form-control" v-else>
            <label class="label py-0 h-6 flex items-center justify-between">
              <span class="label-text text-xs font-bold">Custom Location</span>
            </label>
            <input
              type="text"
              v-model="customFacilityText"
              placeholder="Enter custom location name..."
              class="input input-bordered input-sm w-full h-8 min-h-8 text-xs bg-base-100" />
          </div>
        </div>

        <div class="form-control">
          <label class="label py-0.5 flex items-center justify-between">
            <span class="label-text text-xs font-bold">Inventory Status</span>
            <span
              v-if="isSold"
              class="badge badge-xs badge-warning font-bold gap-1">
              <Icon icon="solar:lock-bold" class="w-2.5 h-2.5" /> Locked
            </span>
          </label>
          <select
            v-model="editForm.status"
            :disabled="isSold"
            class="select select-bordered select-sm w-full font-bold text-xs bg-base-100 disabled:bg-base-200/70">
            <option value="acquired">Acquired (Backlog)</option>
            <option value="received">Received</option>
            <option value="placed">Placed (In Booth)</option>
            <option value="tracked">Tracked</option>
            <option value="combined">Combined</option>
            <option value="sold">Sold</option>
            <option value="archived">Archived</option>
          </select>
          <div
            v-if="isSold"
            class="mt-1.5 flex items-center justify-between text-xs bg-base-100 p-2 rounded-xl border border-base-300">
            <span class="opacity-70 text-[11px] flex items-center gap-1">
              <Icon
                icon="solar:lock-bold"
                class="w-3.5 h-3.5 text-warning shrink-0" />
              Sold status is locked. Revert or cancel via Sales Order.
            </span>
            <a
              :href="`/sales/${linkedSaleOrderId}`"
              class="text-primary font-bold hover:underline text-xs flex items-center gap-0.5 shrink-0 ml-2">
              Open SO →
            </a>
          </div>
        </div>

        <MultiSelectDropdown
          v-model="editForm.sellingLocations"
          label="Sales Channels & Booth Locations" />

        <div
          class="flex items-center justify-between bg-base-100 p-2.5 rounded-xl border border-base-300">
          <div class="flex items-center gap-2">
            <Icon icon="solar:shop-2-bold" class="w-4 h-4 text-primary" />
            <div>
              <span class="text-xs font-bold"
                >Public Storefront Visibility</span
              >
              <p class="text-[10px] opacity-60">
                Show this item on your public catalog site
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            :checked="showOnStorefront"
            @change="$emit('update:showOnStorefront', $event.target.checked)"
            class="checkbox checkbox-primary checkbox-sm" />
        </div>
      </div>
    </div>

    <!-- ================================================================= -->
    <!-- RIGHT COLUMN: Intelligence & Content Hub                          -->
    <!-- ================================================================= -->
    <div class="lg:col-span-6 space-y-5">
      <!-- 1. 📝 INTERNAL NOTES & AI PROMPT GUIDANCE (SAVED WITH ITEM) -->
      <div
        class="bg-base-200/50 rounded-2xl p-4 border border-base-300 space-y-2">
        <div class="flex justify-between items-center">
          <div>
            <label
              class="font-bold text-xs uppercase tracking-wider text-base-content/80 flex items-center gap-1.5">
              <Icon icon="solar:notes-bold" class="w-4 h-4 text-secondary" />
              Internal Product Notes & AI Guidance
            </label>
            <p class="text-[10px] opacity-60">
              Saved with item & used to sharpen 🔍 Deep Scan
            </p>
          </div>
          <span class="badge badge-xs badge-ghost font-mono"
            >Internal Only</span
          >
        </div>
        <textarea
          v-model="editForm.condition_notes"
          class="textarea textarea-bordered w-full h-24 text-xs font-medium bg-base-100 focus:ring-1 focus:ring-secondary/30"
          placeholder="e.g. Tested motor works, light turns on, missing battery cap, minor wear on bottom, purchased from estate sale...">
        </textarea>
      </div>

      <!-- 2. 🕵️ AI SCOUT & DEEP VALUATION REPORT (FULL PRODUCTION DISPLAY) -->
      <div
        class="bg-base-200/60 rounded-2xl p-4 border border-base-300 space-y-4 shadow-sm">
        <div
          class="flex justify-between items-center border-b border-base-300 pb-2.5">
          <div class="flex items-center gap-2">
            <div
              class="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center text-primary font-bold">
              <Icon icon="solar:magic-stick-bold" class="w-3.5 h-3.5" />
            </div>
            <div>
              <h4
                class="font-bold text-xs uppercase tracking-wider text-base-content">
                AI Scout & Valuation Intelligence
              </h4>
              <p class="text-[10px] opacity-60">
                Deep market analysis & pricing models
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <span
              v-if="scoutResult"
              class="badge badge-sm badge-success text-success-content font-black whitespace-nowrap px-2.5 py-0.5 shadow-xs"
              >Report Ready</span
            >
            <span
              v-else-if="analyzing"
              class="badge badge-sm badge-warning text-warning-content font-black whitespace-nowrap px-2.5 py-0.5 animate-pulse"
              >Analyzing...</span
            >
            <span
              v-else
              class="badge badge-sm badge-ghost text-base-content/70 font-bold whitespace-nowrap px-2"
              >Not Scanned</span
            >
          </div>
        </div>

        <!-- Loading Animation -->
        <div
          v-if="analyzing"
          class="flex flex-col items-center justify-center py-8 space-y-2">
          <span class="loading loading-spinner text-primary loading-md"></span>
          <p class="font-bold text-xs text-primary">
            {{ analysisStatus || "Scanning photos & market comps..." }}
          </p>
        </div>

        <!-- Report Contents -->
        <div v-else-if="scoutResult" class="space-y-4">
          <!-- RESELLER EXIT PLAYBOOK BANNER (Acquired Inventory) -->
          <div
            v-if="isAcquiredItem && exitPlaybook"
            class="border-2 border-secondary/40 bg-secondary/10 rounded-2xl p-3.5 shadow-xs">
            <div
              class="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
              <div class="flex items-center gap-2 min-w-0">
                <Icon
                  icon="solar:clipboard-check-bold"
                  class="w-5 h-5 text-secondary shrink-0" />
                <div class="flex items-center gap-1.5 flex-wrap">
                  <h4
                    class="font-black text-sm uppercase tracking-wider text-secondary">
                    Exit Playbook
                  </h4>
                  <span
                    class="badge badge-xs badge-success font-black font-mono"
                    >+{{ Math.round(exitPlaybook.profitIncreasePct || 0) }}%
                    Margin</span
                  >
                  <span
                    v-if="parsedComponents && parsedComponents.length > 1"
                    class="badge badge-xs badge-neutral font-bold gap-1">
                    <span>📦</span>{{ parsedComponents.length }} Components
                  </span>
                </div>
              </div>
              <button
                type="button"
                @click="$emit('open-lot-tab')"
                class="btn btn-xs btn-secondary text-secondary-content gap-1 shrink-0 font-bold shadow-2xs">
                <span>{{
                  parsedComponents && parsedComponents.length > 1
                    ? "Open Playbook & Split Lot"
                    : "View Playbook"
                }}</span>
                <Icon icon="solar:arrow-right-linear" class="w-3.5 h-3.5" />
              </button>
            </div>
            <p class="text-xs opacity-90 leading-relaxed font-medium">
              {{ exitPlaybook.summary }}
            </p>
            <div
              class="mt-2 pt-2 border-t border-secondary/20 flex items-center justify-between text-[11px] font-mono">
              <span class="opacity-70"
                >Bulk Liquidation: ${{
                  Number(exitPlaybook.projectedBulkYield || 0).toFixed(0)
                }}</span
              >
              <span class="text-success font-bold"
                >Sliced Playbook Yield: ${{
                  Number(exitPlaybook.projectedSplitYield || 0).toFixed(0)
                }}</span
              >
            </div>
          </div>

          <!-- SOURCING STRATEGY VERDICT CARD (Pre-acquisition / Scouting Only) -->
          <div
            v-else-if="!isAcquiredItem && scoutPurchaseStrategy"
            class="border-2 rounded-2xl p-3.5 shadow-xs"
            :class="{
              'border-error bg-error/15 ring-2 ring-error/20':
                scoutPurchaseStrategy.isOutbid ||
                scoutPurchaseStrategy.verdict === 'PASS',
              'border-success bg-success/10':
                !scoutPurchaseStrategy.isOutbid &&
                ['BUY_NOW', 'BUY', 'CHASE_AUCTION'].includes(
                  scoutPurchaseStrategy.verdict,
                ),
              'border-warning bg-warning/10':
                !scoutPurchaseStrategy.isOutbid &&
                ['WATCH', 'NEGOTIATE'].includes(scoutPurchaseStrategy.verdict),
              'border-primary bg-primary/10':
                !scoutPurchaseStrategy.isOutbid &&
                ![
                  'PASS',
                  'WATCH',
                  'BUY_NOW',
                  'BUY',
                  'NEGOTIATE',
                  'CHASE_AUCTION',
                ].includes(scoutPurchaseStrategy.verdict),
            }">
            <div
              class="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
              <div class="flex items-center gap-2">
                <Icon
                  icon="solar:stop-circle-bold"
                  class="w-5 h-5 text-error animate-pulse"
                  v-if="
                    scoutPurchaseStrategy.isOutbid ||
                    scoutPurchaseStrategy.verdict === 'PASS'
                  " />
                <Icon
                  icon="solar:magic-stick-bold"
                  class="w-5 h-5 text-success"
                  v-else-if="
                    ['BUY_NOW', 'BUY', 'CHASE_AUCTION'].includes(
                      scoutPurchaseStrategy.verdict,
                    )
                  " />
                <Icon
                  icon="solar:eye-bold"
                  class="w-5 h-5 text-warning"
                  v-else />
                <h4
                  class="font-black text-sm uppercase tracking-wider"
                  :class="{
                    'text-error':
                      scoutPurchaseStrategy.isOutbid ||
                      scoutPurchaseStrategy.verdict === 'PASS',
                    'text-success':
                      !scoutPurchaseStrategy.isOutbid &&
                      ['BUY_NOW', 'BUY', 'CHASE_AUCTION'].includes(
                        scoutPurchaseStrategy.verdict,
                      ),
                    'text-warning':
                      !scoutPurchaseStrategy.isOutbid &&
                      ['WATCH', 'NEGOTIATE'].includes(
                        scoutPurchaseStrategy.verdict,
                      ),
                    'text-primary':
                      !scoutPurchaseStrategy.isOutbid &&
                      ![
                        'PASS',
                        'WATCH',
                        'BUY_NOW',
                        'BUY',
                        'NEGOTIATE',
                        'CHASE_AUCTION',
                      ].includes(scoutPurchaseStrategy.verdict),
                  }">
                  {{
                    scoutPurchaseStrategy.isOutbid
                      ? "🛑 STOP BIDDING (OUTBID)"
                      : String(scoutPurchaseStrategy.verdict || "").replace(
                          "_",
                          " ",
                        )
                  }}
                </h4>
              </div>
              <div
                v-if="
                  scoutPurchaseStrategy.current_asking_price &&
                  !String(scoutPurchaseStrategy.current_asking_price).includes(
                    'No Asking Price',
                  )
                "
                class="my-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-base-100 border border-base-300 flex flex-wrap items-center gap-1.5 leading-snug">
                <span class="opacity-60 text-[10px] uppercase font-black"
                  >Asking/Bid:</span
                >
                <span>{{ scoutPurchaseStrategy.current_asking_price }}</span>
              </div>
              <div
                v-else-if="
                  scoutPurchaseStrategy.max_bid || scoutPurchaseStrategy.maxBid
                "
                class="badge badge-sm font-mono font-bold bg-base-100 border border-base-300">
                Max Bid: ${{
                  Number(
                    scoutPurchaseStrategy.maxBid ||
                      scoutPurchaseStrategy.max_bid,
                  ).toFixed(2)
                }}
              </div>
            </div>

            <!-- Live Bidding Headroom vs Over-Ceiling Strip -->
            <div
              v-if="
                scoutPurchaseStrategy.headroom !== undefined &&
                scoutPurchaseStrategy.currentBid &&
                scoutPurchaseStrategy.maxBid
              "
              class="my-2 p-2 rounded-xl bg-base-100/90 border border-base-300 flex items-center justify-between text-xs font-mono shadow-xs">
              <div>
                <span class="opacity-60 text-[9px] uppercase font-bold block"
                  >Current Bid</span
                >
                <span
                  class="font-black text-xs sm:text-sm"
                  :class="
                    scoutPurchaseStrategy.isOutbid
                      ? 'text-error'
                      : 'text-base-content'
                  "
                  >${{
                    Number(scoutPurchaseStrategy.currentBid).toFixed(2)
                  }}</span
                >
              </div>
              <div class="text-center">
                <span class="opacity-60 text-[9px] uppercase font-bold block"
                  >Max Ceiling</span
                >
                <span class="font-bold text-xs sm:text-sm text-primary"
                  >${{ Number(scoutPurchaseStrategy.maxBid).toFixed(2) }}</span
                >
              </div>
              <div class="text-right">
                <span class="opacity-60 text-[9px] uppercase font-bold block">{{
                  scoutPurchaseStrategy.isOutbid ? "Over Ceiling" : "Headroom"
                }}</span>
                <span
                  class="font-black text-xs sm:text-sm"
                  :class="
                    scoutPurchaseStrategy.isOutbid
                      ? 'text-error'
                      : 'text-success'
                  ">
                  {{
                    scoutPurchaseStrategy.headroom >= 0
                      ? `+$${Number(scoutPurchaseStrategy.headroom).toFixed(2)}`
                      : `-$${Math.abs(Number(scoutPurchaseStrategy.headroom)).toFixed(2)}`
                  }}
                </span>
              </div>
            </div>

            <p
              v-if="scoutPurchaseStrategy.advice"
              class="text-xs opacity-90 leading-relaxed font-medium"
              :class="{
                'text-error font-bold': scoutPurchaseStrategy.isOutbid,
              }">
              {{ scoutPurchaseStrategy.advice }}
            </p>
            <!-- Combined Shipping & Weight Details -->
            <div
              v-if="
                (scoutAuctionMeta?.can_combine_shipping ??
                  scoutItemsArray[0]?.canCombineShipping) !== undefined
              "
              class="mt-2.5 pt-2 border-t border-base-300 flex items-center justify-between text-xs font-mono">
              <span
                class="flex items-center gap-1 font-bold"
                :class="
                  (scoutAuctionMeta?.can_combine_shipping ??
                  scoutItemsArray[0]?.canCombineShipping)
                    ? 'text-success'
                    : 'text-error'
                ">
                <Icon
                  :icon="
                    (scoutAuctionMeta?.can_combine_shipping ??
                    scoutItemsArray[0]?.canCombineShipping)
                      ? 'solar:box-minimalistic-bold'
                      : 'solar:forbidden-circle-bold'
                  "
                  class="w-3.5 h-3.5" />
                {{
                  (scoutAuctionMeta?.can_combine_shipping ??
                  scoutItemsArray[0]?.canCombineShipping)
                    ? "Combined Shipping: Eligible"
                    : "Combined Shipping: Ineligible"
                }}
                <span
                  v-if="
                    scoutAuctionMeta?.seller_id || scoutItemsArray[0]?.sellerId
                  "
                  class="opacity-75 font-mono text-[10px]"
                  >(Seller #{{
                    scoutAuctionMeta?.seller_id || scoutItemsArray[0]?.sellerId
                  }})</span
                >
              </span>
              <span
                v-if="
                  scoutAuctionMeta?.shipping_weight ||
                  scoutItemsArray[0]?.shippingWeight
                "
                class="opacity-70">
                &#9878;&#65039;
                {{
                  scoutAuctionMeta?.shipping_weight ||
                  scoutItemsArray[0]?.shippingWeight
                }}
                lbs
              </span>
            </div>
          </div>

          <!-- VISUAL CONDITION ASSESSMENT -->
          <div
            v-if="scoutItemsArray[0]?.condition_notes"
            class="bg-base-200 p-3 border border-base-300 rounded-xl">
            <div
              class="font-bold text-xs mb-1 opacity-70 uppercase tracking-wide flex items-center gap-1.5">
              <Icon icon="solar:magnifer-linear" class="w-3.5 h-3.5" />
              <span>Visual Condition Assessment</span>
            </div>
            <p class="text-xs font-medium opacity-90 leading-relaxed">
              {{ scoutItemsArray[0].condition_notes }}
            </p>
          </div>

          <!-- Fallback lot summary (only when the merged Exit Playbook card above is not shown) -->
          <div
            v-if="
              parsedComponents &&
              parsedComponents.length > 1 &&
              !(isAcquiredItem && exitPlaybook)
            "
            @click="$emit('open-lot-tab')"
            class="p-2.5 bg-secondary/10 border border-secondary/30 rounded-xl flex items-center justify-between text-xs font-medium cursor-pointer hover:bg-secondary/15 transition-all">
            <span class="text-base-content font-bold flex items-center gap-1.5">
              <span>📦</span>
              <span>{{ parsedComponents.length }} Bundle Components</span>
              <span class="opacity-40">•</span>
              <span class="text-secondary font-mono"
                >Sliced Yield: ${{
                  Number(exitPlaybook?.projectedSplitYield || 0).toFixed(2)
                }}</span
              >
            </span>
            <button
              type="button"
              class="btn btn-xs btn-secondary text-secondary-content font-bold gap-1 shadow-2xs">
              <span>Open Playbook &amp; Split Lot ➔</span>
            </button>
          </div>

          <!-- AI Found Image Thumbnail (Single Item) -->
          <div
            v-if="scoutItemsArray.length === 1 && scoutItemsArray[0].image"
            class="mb-2 flex justify-center">
            <img
              :src="proxify(scoutItemsArray[0].image)"
              class="h-32 object-contain rounded-xl shadow-md border border-base-300"
              alt="AI Found Item"
              @error="$event.target.style.display = 'none'" />
          </div>

          <!-- Red Flags -->
          <div
            v-if="
              scoutItemsArray[0]?.red_flags &&
              scoutItemsArray[0].red_flags.length > 0
            "
            class="alert alert-warning shadow-xs p-2.5 text-xs">
            <span class="font-bold"
              ><Icon
                icon="solar:danger-triangle-bold"
                class="w-4 h-4 inline mr-1" />
              Flags:</span
            >
            {{ scoutItemsArray[0].red_flags.join(", ") }}
          </div>

          <!-- CARD ACTION BUTTONS -->
          <div class="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              class="btn btn-secondary btn-sm flex-1 font-bold shadow-xs gap-1.5 text-white"
              @click="$emit('apply-bundle-suggestions')">
              <Icon icon="solar:magic-stick-linear" class="w-4 h-4" />
              <span>Apply AI Title, Price &amp; Tags</span>
            </button>
            <button
              v-if="scoutMdText"
              type="button"
              class="btn btn-outline btn-sm px-3"
              @click="$emit('open-md-modal')"
              title="View Full Report">
              <Icon icon="solar:document-text-linear" class="w-4 h-4" />
              <span class="sm:hidden">Report</span>
            </button>
          </div>
        </div>

        <!-- Empty State Prompt -->
        <div
          v-else
          class="text-center py-6 border-2 border-dashed rounded-xl border-base-300 text-xs space-y-1.5 bg-base-100/50">
          <Icon
            icon="solar:magic-stick-3-bold-duotone"
            class="w-7 h-7 mx-auto text-primary/50" />
          <p class="font-bold text-xs text-base-content/80">
            Ready for 🔍 Deep Scan
          </p>
          <p class="text-[11px] opacity-60 max-w-xs mx-auto">
            Use the <strong>🔍 Deep Scan</strong> button in the bottom dock to
            scout photos, comps, and prices.
          </p>
        </div>
      </div>

      <!-- 3. 🛍️ PUBLIC LISTING DESCRIPTION (MARKDOWN) -->
      <div
        class="bg-base-200/50 rounded-2xl p-4 border border-base-300 space-y-2">
        <div class="flex justify-between items-center">
          <label
            class="font-bold text-xs uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
            <Icon
              icon="solar:document-text-bold"
              class="w-4 h-4 text-primary" />
            Public Listing Description
          </label>

          <div class="flex items-center gap-2">
            <button
              class="btn btn-xs btn-outline btn-secondary font-bold gap-1"
              @click="$emit('generate-description')"
              :disabled="generatingDescription || !item">
              <span
                v-if="generatingDescription"
                class="loading loading-spinner loading-xs"></span>
              <Icon v-else icon="mingcute:gemini-fill" class="w-3.5 h-3.5" />
              AI Generate
            </button>

            <div class="join border border-base-300 rounded-lg overflow-hidden">
              <button
                type="button"
                class="btn btn-xs join-item"
                :class="
                  descTab === 'edit' ? 'btn-active btn-neutral' : 'btn-ghost'
                "
                @click="$emit('update:descTab', 'edit')">
                Edit
              </button>
              <button
                type="button"
                class="btn btn-xs join-item"
                :class="
                  descTab === 'preview' ? 'btn-active btn-neutral' : 'btn-ghost'
                "
                @click="$emit('update:descTab', 'preview')">
                Preview
              </button>
            </div>
          </div>
        </div>

        <div v-if="descTab === 'edit'">
          <textarea
            v-model="editForm.description"
            class="textarea textarea-bordered w-full h-36 font-mono text-xs bg-base-100 focus:ring-1 focus:ring-primary/30"
            placeholder="Product details, condition, measurements, flaws for customer listing..."></textarea>
        </div>
        <div
          v-else
          class="w-full h-36 overflow-y-auto border border-base-300 rounded-xl p-3 bg-base-100 prose prose-xs"
          v-html="
            renderMarkdown(
              editForm.description || '*No description entered yet.*',
            )
          "></div>

        <TagInput
          v-model="editForm.keywords"
          label="Tags & Keywords"
          type="keyword"
          badgeClass="badge-secondary"
          :recommendedTags="
            Array.isArray(scoutResult)
              ? Array.from(
                  new Set(scoutResult.flatMap((item) => item.keywords || [])),
                )
              : scoutResult && scoutResult.keywords
                ? scoutResult.keywords
                : []
          " />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import { marked } from 'marked';
import TagInput from '../TagInput.vue';
import MultiSelectDropdown from '../MultiSelectDropdown.vue';
import {
    getSubItemBoutique,
    getSubItemFair,
    getSubItemBuyRange,
    getSubItemCostBasis,
    calculateMaxBuyPrice,
    calculateSubItemMaxBidPrice
} from '../../../lib/bundle-pricing';
import { deriveLotExitPlaybook } from '../../../lib/lot-strategy';
import { isItemAcquired } from '../../../lib/inventory';
import { resolveMultiQtyCost } from '../../../composables/useItemDrawerForm';

const props = defineProps({
    editForm: {
        type: Object,
        required: true
    },
    item: {
        type: Object,
        default: null
    },
    parentItem: {
        type: Object,
        default: null
    },
    lotChildren: {
        type: Array,
        default: () => []
    },
    isAcquisitionUnlocked: {
        type: Boolean,
        default: false
    },
    allLocations: {
        type: Array,
        default: () => []
    },
    calculatedMargin: {
        type: Number,
        default: null
    },
    suggestedTitleStr: {
        type: String,
        default: ''
    },
    showOnStorefront: {
        type: Boolean,
        default: false
    },
    analyzing: {
        type: Boolean,
        default: false
    },
    analysisStatus: {
        type: String,
        default: ''
    },
    scoutResult: {
        type: [Object, Array],
        default: null
    },
    scoutPurchaseStrategy: {
        type: Object,
        default: null
    },
    scoutItemsArray: {
        type: Array,
        default: () => []
    },
    scoutTotalRange: {
        type: Object,
        default: null
    },
    scoutMdText: {
        type: String,
        default: null
    },
    parsedRawAnalysis: {
        type: [Object, Array],
        default: null
    },
    parsedComponents: {
        type: Array,
        default: () => []
    },
    saveIndividually: {
        type: Boolean,
        default: false
    },
    generatingDescription: {
        type: Boolean,
        default: false
    },
    descTab: {
        type: String,
        default: 'edit'
    },
    fetchedImages: {
        type: Array,
        default: () => []
    },
    fetchingImages: {
        type: Boolean,
        default: false
    },
    downloadingImageUrls: {
        type: Object,
        default: () => ({})
    },
    activeTray: {
        type: String,
        default: 'none'
    },
    inventoryItems: {
        type: Array,
        default: () => []
    }
});

const emit = defineEmits([
    'update:isAcquisitionUnlocked',
    'update:showOnStorefront',
    'update:saveIndividually',
    'update:descTab',
    'open-lot-tab',
    'open-splitter',
    'copy-title',
    'fetch-source-data',
    'add-all-fetched-images',
    'dismiss-fetched-images',
    'select-fetched-image',
    'sell-one-quantity',
    'split-one-active',
    'restock-quantity',
    'apply-price-tier',
    'deconstruct-ai-lot',
    'apply-bundle-suggestions',
    'open-md-modal',
    'generate-description',
    'open-restock'
]);

const KNOWN_CODES = ['HG', 'HD', 'MD', 'DT'];

const isSold = computed(() => {
    return (props.editForm?.status || props.item?.status) === 'sold';
});

const linkedSaleOrderId = computed(() => {
    return props.item?.saleId || props.item?.$id || '';
});

const isAcquiredItem = computed(() => {
    return isItemAcquired(props.item?.status || props.editForm?.status || '');
});

// --- ➕ RESTOCK BIN & POOLED COST BASIS PREVIEW ---
const isRestockOpen = ref(false);
const restockSourceMode = ref('backstock'); // 'backstock' | 'walkin'
const selectedBackstockItemId = ref('');
const restockSearchQuery = ref('');
const restockVendor = ref('Walk-In / Thrift Restock');
const restockUnitsToAdd = ref(1);
const restockAddedCost = ref(0);

function getBackstockItemMetrics(it) {
    if (!it) return { qty: 1, totalCost: 0, photoCount: 0 };
    let qty = Number(it.quantity) || 1;
    if (qty <= 1) {
        let comps = [];
        if (Array.isArray(it.components)) comps = it.components;
        else if (typeof it.components === 'string' && it.components.trim().startsWith('[')) {
            try { comps = JSON.parse(it.components); } catch (e) {}
        }
        if (comps.length > 1) {
            qty = comps.length;
        } else {
            const t = String(it.title || '');
            const m = t.match(/\b(?:lot|set|pack|box)\s+of\s+(\d+)\b/i) ||
                      t.match(/^(\d+)\s*x?\s+/i) ||
                      t.match(/\b(\d+)\s*(?:books|novels|paperbacks|hardcovers|pcs|pieces|items|units|vols|volumes)\b/i);
            if (m && parseInt(m[1], 10) > 1 && parseInt(m[1], 10) <= 200) {
                qty = parseInt(m[1], 10);
            }
        }
    }
    const rawCost = it.cost ?? it.purchasePrice ?? 0;
    const unitResale = it.resalePrice ?? it.priceFair ?? it.estHigh ?? 0;
    const { totalCost } = resolveMultiQtyCost(rawCost, Number(it.quantity) || 1, unitResale);

    const photoSet = new Set();
    if (it.imageId) photoSet.add(it.imageId);
    if (Array.isArray(it.galleryImageIds)) it.galleryImageIds.forEach(id => id && photoSet.add(id));

    return {
        qty: Math.max(1, qty),
        totalCost: Number((totalCost || 0).toFixed(2)),
        photoCount: photoSet.size
    };
}

const filteredBackstockItems = computed(() => {
    const all = Array.isArray(props.inventoryItems) ? props.inventoryItems : [];
    const currentId = props.item?.$id;
    const targetWords = String(props.editForm?.title || props.item?.title || '')
        .toLowerCase()
        .split(/[\s,./\-_()[\]]+/)
        .filter(w => w.length >= 4 && !['vintage', 'lot', 'bundle', 'pack', 'with', 'from', 'assorted', 'mixed'].includes(w));

    const candidates = all.filter(it => {
        if (!it || !it.$id || it.$id === currentId) return false;
        const st = String(it.status || '').toLowerCase().trim();
        if (['sold', 'combined', 'deconstructed', 'archived', 'tracked', 'draft', 'scouted'].includes(st)) return false;
        const loc = String(it.storageLocation || '').toUpperCase().trim();
        return st === 'acquired' || st === 'received' || loc.startsWith('HG');
    });

    const q = restockSearchQuery.value.trim().toLowerCase();
    const searched = q
        ? candidates.filter(it => {
            const hay = `${it.title || ''} ${it.upc || ''} ${it.orderId || ''} ${it.purchaseId || ''} ${it.storageLocation || ''} ${it.sourcingLocation || ''}`.toLowerCase();
            return hay.includes(q);
        })
        : candidates;

    return [...searched].sort((a, b) => {
        const aTitle = String(a.title || '').toLowerCase();
        const bTitle = String(b.title || '').toLowerCase();
        const aScore = targetWords.reduce((s, w) => s + (aTitle.includes(w) ? 1 : 0), 0);
        const bScore = targetWords.reduce((s, w) => s + (bTitle.includes(w) ? 1 : 0), 0);
        if (aScore !== bScore) return bScore - aScore;
        return new Date(b.$createdAt || 0).getTime() - new Date(a.$createdAt || 0).getTime();
    });
});

const selectedBackstockItem = computed(() => {
    if (!selectedBackstockItemId.value) return null;
    const all = Array.isArray(props.inventoryItems) ? props.inventoryItems : [];
    return all.find(it => it && it.$id === selectedBackstockItemId.value) || null;
});

function selectBackstockItem(cand) {
    if (!cand) return;
    selectedBackstockItemId.value = cand.$id;
    const metrics = getBackstockItemMetrics(cand);
    restockUnitsToAdd.value = metrics.qty;
    restockAddedCost.value = metrics.totalCost;
}

function switchToWalkinMode() {
    restockSourceMode.value = 'walkin';
    selectedBackstockItemId.value = '';
}

const restockUnitsToAddVal = computed(() => Math.max(1, Number(restockUnitsToAdd.value) || 1));
const restockAddedCostVal = computed(() => Math.max(0, Number(restockAddedCost.value) || 0));

const restockCurrentQty = computed(() => Math.max(1, Number(props.editForm?.quantity || props.item?.quantity || 1)));
const restockCurrentCost = computed(() => {
    const rawCost = props.editForm?.cost !== '' && props.editForm?.cost !== undefined
        ? props.editForm.cost
        : (props.item?.cost ?? 0);
    const unitResale = props.editForm?.resalePrice || props.item?.resalePrice || 0;
    return resolveMultiQtyCost(rawCost, restockCurrentQty.value, unitResale).totalCost;
});
const restockCurrentUnitCost = computed(() => restockCurrentQty.value > 0 ? (restockCurrentCost.value / restockCurrentQty.value) : 0);

const restockAddedUnitCost = computed(() => restockUnitsToAddVal.value > 0 ? (restockAddedCostVal.value / restockUnitsToAddVal.value) : 0);

const restockNewQty = computed(() => restockCurrentQty.value + restockUnitsToAddVal.value);
const restockNewTotalCost = computed(() => Number((restockCurrentCost.value + restockAddedCostVal.value).toFixed(2)));
const restockNewAvgUnitCost = computed(() => restockNewQty.value > 0 ? (restockNewTotalCost.value / restockNewQty.value) : 0);

const restockResalePrice = computed(() => Math.max(0, Number(props.editForm?.resalePrice || props.item?.resalePrice || 0)));
const restockNetAfterFee = computed(() => Number((restockResalePrice.value * 0.85).toFixed(2)));
const restockNetProfitPerUnit = computed(() => Math.max(0, Number((restockNetAfterFee.value - restockNewAvgUnitCost.value).toFixed(2))));

function confirmRestock() {
    if (restockUnitsToAddVal.value < 1) return;
    if (restockSourceMode.value === 'backstock' && !selectedBackstockItem.value) return;

    emit('restock-quantity', {
        mode: restockSourceMode.value,
        sourceItem: restockSourceMode.value === 'backstock' ? selectedBackstockItem.value : null,
        unitsToAdd: Number(restockUnitsToAddVal.value),
        addedCostBasis: Number(restockAddedCostVal.value),
        vendor: restockSourceMode.value === 'walkin' ? (restockVendor.value || 'Walk-In / Thrift Restock').trim() : null
    });
    isRestockOpen.value = false;
    selectedBackstockItemId.value = '';
    restockSearchQuery.value = '';
    restockUnitsToAdd.value = 1;
    restockAddedCost.value = 0;
}

function cancelRestock() {
    isRestockOpen.value = false;
    selectedBackstockItemId.value = '';
    restockSearchQuery.value = '';
    restockUnitsToAdd.value = 1;
    restockAddedCost.value = 0;
}

const exitPlaybook = computed(() => {
    const base = props.item || props.editForm;
    const strategyItem = (props.parsedComponents && props.parsedComponents.length > 1)
        ? { ...base, components: props.parsedComponents }
        : base;
    return deriveLotExitPlaybook(strategyItem, props.scoutResult);
});

const selectedFacility = ref('HG');
const facilityBin = ref('');
const customFacilityText = ref('');
let isInternalSync = false;

const syncFromStorageLocation = (loc) => {
    isInternalSync = true;
    const raw = (loc || '').trim();
    if (!raw || raw.toLowerCase() === 'backstock') {
        selectedFacility.value = 'HG';
        facilityBin.value = '';
        customFacilityText.value = '';
    } else {
        const matchedCode = KNOWN_CODES.find(code => raw === code || raw.startsWith(`${code}-`));
        if (matchedCode) {
            selectedFacility.value = matchedCode;
            facilityBin.value = raw === matchedCode ? '' : raw.slice(matchedCode.length + 1).trim();
            customFacilityText.value = '';
        } else {
            selectedFacility.value = '__custom__';
            facilityBin.value = '';
            customFacilityText.value = raw;
        }
    }
    nextTick(() => { isInternalSync = false; });
};

const updateStorageLocation = () => {
    if (isInternalSync) return;
    if (selectedFacility.value === '__custom__') {
        props.editForm.storageLocation = customFacilityText.value.trim();
    } else {
        const bin = facilityBin.value.trim();
        if (bin) {
            props.editForm.storageLocation = `${selectedFacility.value}-${bin.toUpperCase()}`;
        } else {
            props.editForm.storageLocation = selectedFacility.value;
        }
    }
};

watch(() => props.editForm?.storageLocation, (newVal) => {
    if (!isInternalSync) {
        syncFromStorageLocation(newVal);
    }
}, { immediate: true });

watch([selectedFacility, facilityBin, customFacilityText], () => {
    updateStorageLocation();
});

const availableBinsForFacility = computed(() => {
    if (!props.allLocations || !Array.isArray(props.allLocations)) return [];
    const prefix = `${selectedFacility.value}-`;
    return props.allLocations
        .filter(loc => typeof loc === 'string' && loc.startsWith(prefix))
        .map(loc => loc.slice(prefix.length))
        .filter(Boolean);
});

const renderMarkdown = (text) => marked(text || '');

const proxify = (url) => {
    if (!url) return null;
    if (typeof url !== 'string') return url;
    if (url.startsWith('blob:') || url.startsWith('data:') || url.includes('/api/proxy-image')) return url;
    if (url.includes('/storage/buckets/')) return url;
    if (url.startsWith('http')) {
        return `/api/proxy-image?url=${encodeURIComponent(url)}`;
    }
    return url;
};

const formatPriceRange = (rangeObj) => {
    if (!rangeObj) return '-';
    if (typeof rangeObj === 'string' || typeof rangeObj === 'number') return `$${rangeObj}`;
    if (rangeObj.formatted) return rangeObj.formatted;
    if (rangeObj.min && rangeObj.max) return `$${rangeObj.min} - $${rangeObj.max}`;
    return '-';
};

const calculateMaxBuy = (subItem) => {
    return calculateMaxBuyPrice(subItem);
};

const calculateSubItemMaxBid = (subItem, result) => {
    return calculateSubItemMaxBidPrice(subItem, result);
};

const getCleanSubItemTitle = (subItem) => {
    if (!subItem) return 'Item';
    const raw = subItem.tag_title || subItem.name || subItem.title || subItem.identity || subItem.item || 'Item';
    return raw.replace(/\[Tier \d[^\]]*\]\s*/i, '').trim();
};

const getConditionPillText = (cond) => {
    if (!cond) return 'Used';
    const lower = String(cond).toLowerCase();
    if (lower.includes('like new') || lower.includes('brand new') || lower.includes('mint')) return 'Mint';
    if (lower.includes('very good')) return 'Very Good';
    if (lower.includes('good')) return 'Good';
    if (lower.includes('fair')) return 'Fair';
    if (lower.includes('poor') || lower.includes('damaged') || lower.includes('as-is')) return 'Poor';
    const cleanFirst = String(cond).split(/[-–—:,]/)[0].trim();
    return cleanFirst.length <= 12 ? cleanFirst : 'Used';
};

const getConditionPillClass = (cond) => {
    const text = getConditionPillText(cond).toLowerCase();
    if (text === 'mint' || text === 'new') return 'badge-success text-success-content';
    if (text === 'very good' || text === 'good') return 'badge-info text-info-content';
    if (text === 'fair') return 'badge-warning text-warning-content';
    if (text === 'poor') return 'badge-error text-error-content';
    return 'badge-outline badge-primary';
};

const getConditionDetails = (subItem) => {
    if (!subItem) return '';
    if (subItem.condition_notes) return subItem.condition_notes.trim();
    if (subItem.condition) {
        const parts = String(subItem.condition).split(/[-–—:]/);
        if (parts.length > 1) {
            return parts.slice(1).join('-').trim();
        }
    }
    return '';
};
</script>

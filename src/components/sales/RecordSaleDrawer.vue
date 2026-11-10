<template>
  <SlideOverDrawer
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    @close="emit('close')"
    title="Record Sale"
    subtitle="Scan tags or search items to build your sale cart, inspect items, and check out."
  >
    <div class="space-y-5">
      <!-- STEP 1: REQUIRED VENUE / CHANNEL GATE + SALE DATE -->
      <section class="space-y-2.5">
        <div class="flex items-center justify-between gap-2">
          <span
            class="text-xs font-black uppercase tracking-wider flex items-center gap-1.5"
            :class="!selectedChannel ? 'text-warning' : 'text-base-content/80'"
          >
            <span>1. Venue &amp; Sale Date</span>
            <span v-if="!selectedChannel" class="badge badge-xs badge-warning font-black">Required</span>
          </span>
          <a
            :href="advancedEditorHref"
            class="text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5"
            title="Open the full-page Sales Order form"
          >
            <span>Full Order Editor</span>
            <Icon icon="solar:arrow-right-up-linear" class="w-3.5 h-3.5" />
          </a>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <!-- Dynamic Booth / Consignment Locations from warehouses.ts -->
          <button
            v-for="loc in boothLocationOptions"
            :key="loc.code"
            type="button"
            @click="selectChannel(loc.code)"
            class="p-2.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-1"
            :class="selectedChannel === loc.code
              ? 'border-primary bg-primary/10 shadow-sm'
              : 'border-base-300 bg-base-100 hover:border-base-content/30'"
          >
            <div class="flex items-center justify-between gap-1">
              <span class="font-black text-xs text-base-content truncate">{{ loc.icon }} {{ loc.shortName }}</span>
              <span class="badge badge-xs font-mono font-bold" :class="selectedChannel === loc.code ? 'badge-primary' : 'badge-ghost'">
                {{ loc.feePct }}%
              </span>
            </div>
            <span class="text-[10px] text-base-content/65 leading-tight">
              {{ loc.supportsPaperSalesSheet ? 'Paper sheet • No SKU needed' : `Booth ${loc.code} register` }}
            </span>
          </button>

          <!-- Online / Pop-Up Channel -->
          <button
            type="button"
            @click="selectChannel('ONLINE')"
            class="p-2.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-1"
            :class="selectedChannel === 'ONLINE'
              ? 'border-info bg-info/10 shadow-sm'
              : 'border-base-300 bg-base-100 hover:border-base-content/30'"
          >
            <div class="flex items-center justify-between gap-1">
              <span class="font-black text-xs text-base-content truncate">🌐 Online / Pop-Up</span>
              <span class="badge badge-xs font-mono font-bold" :class="selectedChannel === 'ONLINE' ? 'badge-info' : 'badge-ghost'">
                {{ effectiveFeeRate }}%
              </span>
            </div>
            <span class="text-[10px] text-base-content/65 leading-tight">
              eBay, Posh, Direct + Postage
            </span>
          </button>
        </div>

        <!-- Online Sub-Channel Presets -->
        <div v-if="selectedChannel === 'ONLINE'" class="p-2.5 rounded-xl bg-base-200/60 border border-base-300 space-y-2">
          <div class="flex items-center justify-between text-[11px]">
            <span class="font-bold opacity-75">Platform / Event Preset:</span>
            <span class="font-mono opacity-65">100% label postage recouped first</span>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="preset in ONLINE_PRESETS"
              :key="preset.id"
              type="button"
              @click="applyOnlinePreset(preset)"
              class="btn btn-xs rounded-lg font-bold"
              :class="onlinePresetId === preset.id ? 'btn-info' : 'btn-ghost bg-base-100 border border-base-300'"
            >
              {{ preset.label }} ({{ preset.feePct }}%)
            </button>
          </div>
        </div>

        <!-- Date + Fee Rate Row (Once Venue Picked) -->
        <div v-if="selectedChannel" class="grid grid-cols-2 gap-2.5 pt-0.5">
          <div class="space-y-1">
            <label class="text-[11px] font-bold text-base-content/70 block">Sale / Sheet Date</label>
            <input
              v-model="saleDate"
              type="date"
              class="input input-bordered input-sm w-full h-9 rounded-xl font-mono font-bold text-xs bg-base-100"
            />
          </div>
          <div class="space-y-1">
            <label class="text-[11px] font-bold text-base-content/70 flex items-center justify-between">
              <span>Commission Fee (%)</span>
              <span class="font-mono text-[10px] text-error">-${{ totalCommissionFee.toFixed(2) }}</span>
            </label>
            <div class="relative">
              <input
                v-model.number="customFeePct"
                type="number"
                min="0"
                max="100"
                step="0.1"
                class="input input-bordered input-sm w-full pr-7 h-9 rounded-xl font-mono font-bold text-xs bg-base-100"
              />
              <span class="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono font-bold text-xs opacity-60">%</span>
            </div>
          </div>
        </div>
      </section>

      <!-- GUARD WHEN NO VENUE IS PICKED YET -->
      <div
        v-if="!selectedChannel"
        class="p-6 rounded-2xl border border-dashed border-warning/50 bg-warning/5 text-center space-y-1.5"
      >
        <div class="text-2xl">👆</div>
        <div class="text-sm font-black text-base-content">Pick where this sold first</div>
        <p class="text-xs text-base-content/65 max-w-xs mx-auto">
          Selecting the venue sets the commission rate and unlocks Tag Scanning, Item Lookup, and Quick Paper-Sheet entry.
        </p>
      </div>

      <!-- STEP 2 & STEP 3: LOOKUP / SCANNER + SHOPPING CART -->
      <template v-else>
        <!-- STEP 2: ADD ITEMS TO CART (CATALOG + TAG SCAN vs. QUICK NO-SKU) -->
        <section class="space-y-2.5">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <span class="text-xs font-black uppercase tracking-wider text-base-content/80">
              2. Find Items or Add Line
            </span>
            <div class="join bg-base-200/80 p-0.5 rounded-xl border border-base-300">
              <button
                type="button"
                @click="entryMode = 'lookup'"
                class="join-item btn btn-xs rounded-lg font-bold gap-1"
                :class="entryMode === 'lookup' ? 'btn-primary' : 'btn-ghost opacity-75'"
              >
                <Icon icon="solar:magnifer-bold" class="w-3.5 h-3.5" />
                <span>Lookup / Scan ({{ venueScopedCandidates.length }})</span>
              </button>
              <button
                type="button"
                @click="entryMode = 'quick'"
                class="join-item btn btn-xs rounded-lg font-bold gap-1"
                :class="entryMode === 'quick' ? 'btn-primary' : 'btn-ghost opacity-75'"
              >
                <span>⚡ No-SKU Sheet Line</span>
              </button>
            </div>
          </div>

          <!-- MODE A: CATALOG LOOKUP + TAG SCANNER -->
          <div v-if="entryMode === 'lookup'" class="p-3 rounded-2xl bg-base-200/40 border border-base-300 space-y-2.5">
            <!-- Search Input + Prominent Scan Tag Button -->
            <div class="flex items-center gap-2">
              <div class="relative flex-1">
                <Icon icon="solar:magnifer-linear" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/45 pointer-events-none" />
                <input
                  v-model="lookupQuery"
                  type="text"
                  placeholder="Search title, HUCK- tag, or 0EJ SKU..."
                  class="input input-bordered input-sm w-full pl-9 pr-8 h-10 rounded-xl bg-base-100 text-xs sm:text-sm"
                />
                <button
                  v-if="lookupQuery"
                  type="button"
                  @click="lookupQuery = ''"
                  class="btn btn-ghost btn-circle btn-xs w-6 h-6 min-h-0 absolute right-1.5 top-1/2 -translate-y-1/2"
                  title="Clear search"
                >
                  ✕
                </button>
              </div>
              <button
                type="button"
                @click="showScanner = true"
                class="btn btn-sm btn-secondary h-10 rounded-xl font-black gap-1.5 px-3 shrink-0 shadow-xs"
                title="Scan physical tag barcode or QR to add straight to cart"
              >
                <Icon icon="solar:scanner-bold" class="w-4 h-4" />
                <span>Scan Tag</span>
              </button>
            </div>

            <div class="flex items-center justify-between text-[11px] px-0.5">
              <label class="label cursor-pointer gap-1.5 py-0">
                <input
                  v-model="restrictToVenueStock"
                  type="checkbox"
                  class="checkbox checkbox-xs checkbox-primary rounded"
                />
                <span class="label-text text-[11px] font-bold">
                  {{ activeBoothMeta ? `Only ${activeBoothMeta.shortName} stock` : 'Active stock only' }}
                </span>
              </label>
              <span class="text-[10px] text-base-content/60">
                Click item to inspect • <strong>+ Cart</strong> to add
              </span>
            </div>

            <div v-if="displayedCandidates.length === 0" class="py-5 text-center text-xs text-base-content/60 space-y-2">
              <div>No matching catalog items found.</div>
              <div class="flex justify-center gap-2">
                <button
                  v-if="restrictToVenueStock"
                  type="button"
                  @click="restrictToVenueStock = false"
                  class="btn btn-xs btn-outline rounded-lg"
                >
                  Search All Locations
                </button>
                <button
                  type="button"
                  @click="entryMode = 'quick'"
                  class="btn btn-xs btn-primary rounded-lg"
                >
                  ⚡ Add No-SKU Line
                </button>
              </div>
            </div>

            <div v-else class="max-h-52 overflow-y-auto space-y-1.5 pr-0.5">
              <div
                v-for="item in displayedCandidates"
                :key="item.$id"
                class="p-2 rounded-xl bg-base-100 hover:bg-base-200/50 border border-base-300 flex items-center justify-between gap-2 transition-all"
              >
                <!-- Left: Clickable Thumbnail + Title opens ItemDrawer! -->
                <button
                  type="button"
                  @click="emit('inspect-item', item)"
                  class="flex items-center gap-2.5 min-w-0 flex-1 text-left group cursor-pointer"
                  title="Click to inspect full item details in Side Drawer"
                >
                  <ItemThumbnail :item="item" size="sm" rounded="lg" />
                  <div class="min-w-0 flex-1">
                    <div class="text-xs font-bold text-base-content group-hover:text-primary truncate flex items-center gap-1">
                      <span class="truncate">{{ item.title || 'Untitled Item' }}</span>
                      <Icon icon="solar:eye-linear" class="w-3.5 h-3.5 opacity-0 group-hover:opacity-80 shrink-0 text-primary" />
                    </div>
                    <div class="flex items-center gap-1.5 text-[10px] font-mono text-base-content/60 flex-wrap">
                      <span v-if="item.upc">{{ item.upc }}</span>
                      <span v-if="item.locationSku">• {{ item.locationSku }}</span>
                      <span v-if="Number(item.quantity || 1) > 1" class="text-warning font-bold">
                        • 📦 Bin ({{ remainingBinQty(item) }} left)
                      </span>
                    </div>
                  </div>
                </button>

                <!-- Right: Price + Add to Cart Button -->
                <div class="flex items-center gap-2 shrink-0">
                  <div class="text-right font-mono leading-tight">
                    <div class="text-xs font-black text-success">
                      ${{ Number(item.resalePrice || item.listPrice || 0).toFixed(2) }}
                    </div>
                    <div class="text-[10px] text-base-content/55">
                      Cost ${{ resolveItemUnitCost(item).toFixed(2) }}
                    </div>
                  </div>
                  <button
                    type="button"
                    :disabled="remainingBinQty(item) <= 0"
                    @click="addCatalogItemToCart(item)"
                    class="btn btn-xs h-8 px-2.5 rounded-xl font-black gap-1"
                    :class="remainingBinQty(item) <= 0 ? 'btn-disabled' : 'btn-primary'"
                  >
                    <Icon icon="solar:cart-plus-bold" class="w-3.5 h-3.5" />
                    <span>{{ remainingBinQty(item) <= 0 ? 'In Cart' : '+ Cart' }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- MODE B: QUICK PAPER-SHEET / NO-SKU LINE BUILDER -->
          <div v-else class="p-3.5 rounded-2xl bg-base-200/40 border border-base-300 space-y-3">
            <div
              v-if="activeBoothMeta?.supportsPaperSalesSheet"
              class="px-2.5 py-1.5 rounded-xl bg-warning/10 border border-warning/30 text-[11px] text-base-content/85 flex items-center gap-2"
            >
              <span>{{ activeBoothMeta.icon }}</span>
              <span><strong>No {{ activeBoothMeta.code }} SKU needed:</strong> Add one or more paper-sheet lines to the cart below.</span>
            </div>

            <!-- Partner Prefix Pills -->
            <div class="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                @click="quickPartner = 'HUCK-'"
                class="btn btn-xs h-8 rounded-xl font-bold"
                :class="quickPartner === 'HUCK-' ? 'btn-primary' : 'btn-ghost bg-base-100 border border-base-300'"
              >
                🫐 HUCK-
              </button>
              <button
                type="button"
                @click="quickPartner = 'PDXGL-'"
                class="btn btn-xs h-8 rounded-xl font-bold"
                :class="quickPartner === 'PDXGL-' ? 'btn-accent' : 'btn-ghost bg-base-100 border border-base-300'"
              >
                🎲 PDXGL-
              </button>
              <button
                type="button"
                @click="quickPartner = 'BB-'"
                class="btn btn-xs h-8 rounded-xl font-bold"
                :class="quickPartner === 'BB-' ? 'btn-secondary' : 'btn-ghost bg-base-100 border border-base-300'"
              >
                👗 B&amp;B
              </button>
            </div>

            <div class="space-y-1.5">
              <input
                v-model="quickTitle"
                type="text"
                :placeholder="activeBoothMeta?.supportsPaperSalesSheet ? `e.g. ${activeBoothMeta.shortName} — Pins / Small Collectibles` : 'Unlisted / Walk-Up Item Description'"
                class="input input-bordered input-sm w-full rounded-xl h-9 text-xs sm:text-sm bg-base-100 font-medium"
                @keydown.enter.prevent="addQuickLineToCart"
              />
              <div v-if="activeBoothMeta?.supportsPaperSalesSheet" class="flex items-center gap-1 flex-wrap">
                <button
                  v-for="chip in PAPER_SHEET_CHIPS"
                  :key="chip"
                  type="button"
                  @click="quickTitle = `${activeBoothMeta.shortName} — ${chip}`"
                  class="badge badge-xs badge-outline hover:badge-primary cursor-pointer font-semibold py-2"
                >
                  {{ chip }}
                </button>
              </div>
            </div>

            <div class="grid grid-cols-12 gap-2 items-end">
              <div class="col-span-5 space-y-1">
                <label class="text-[10px] font-bold opacity-70 block">Sold Price ($)</label>
                <input
                  v-model.number="quickPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  class="input input-bordered input-sm w-full h-9 rounded-xl font-mono font-black bg-base-100"
                  @keydown.enter.prevent="addQuickLineToCart"
                />
              </div>
              <div class="col-span-4 space-y-1">
                <label class="text-[10px] font-bold opacity-70 block">Cost ($ opt)</label>
                <input
                  v-model.number="quickCost"
                  type="number"
                  min="0"
                  step="0.01"
                  :disabled="quickPartner === 'BB-'"
                  placeholder="0.00"
                  class="input input-bordered input-sm w-full h-9 rounded-xl font-mono font-bold bg-base-100 disabled:opacity-60"
                  @keydown.enter.prevent="addQuickLineToCart"
                />
              </div>
              <div class="col-span-3">
                <button
                  type="button"
                  :disabled="!quickPrice || quickPrice <= 0"
                  @click="addQuickLineToCart"
                  class="btn btn-sm btn-primary w-full h-9 rounded-xl font-black gap-1 px-2"
                >
                  <Icon icon="solar:cart-plus-bold" class="w-4 h-4 shrink-0" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- STEP 3: SHOPPING CART (EDITABLE LINES + CLICK TO INSPECT IN ITEMDRAWER) -->
        <section class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-black uppercase tracking-wider text-base-content/80 flex items-center gap-1.5">
              <Icon icon="solar:cart-large-2-bold-duotone" class="w-4 h-4 text-primary" />
              <span>3. Sale Cart ({{ effectiveCartLines.length }})</span>
            </span>
            <button
              v-if="cartLines.length > 1"
              type="button"
              @click="cartLines = []"
              class="text-[11px] font-bold text-error hover:underline"
            >
              Clear Cart
            </button>
          </div>

          <div
            v-if="cartLines.length === 0"
            class="p-4 rounded-2xl border border-dashed border-base-300 text-center text-xs text-base-content/60"
          >
            Scan a tag or tap <strong>+ Cart</strong> above to add items to this sale.
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="(line, idx) in cartLines"
              :key="line.cartKey"
              class="p-2.5 rounded-2xl bg-base-100 border border-base-300 shadow-2xs flex items-center justify-between gap-2.5"
            >
              <!-- Left: Thumbnail + Clickable Inspect Trigger -->
              <div class="flex items-center gap-2.5 min-w-0 flex-1">
                <ItemThumbnail v-if="line.item" :item="line.item" size="sm" rounded="lg" />
                <div v-else class="w-9 h-9 rounded-lg bg-base-200 flex items-center justify-center text-sm shrink-0">
                  🧾
                </div>
                <div class="min-w-0 flex-1">
                  <button
                    v-if="line.item"
                    type="button"
                    @click="emit('inspect-item', line.item)"
                    class="text-xs font-bold text-left text-base-content hover:text-primary truncate flex items-center gap-1 max-w-full cursor-pointer"
                    title="View full item details in Side Drawer"
                  >
                    <span class="truncate">{{ line.title }}</span>
                    <Icon icon="solar:eye-bold" class="w-3.5 h-3.5 text-primary shrink-0" />
                  </button>
                  <div v-else class="text-xs font-bold text-base-content truncate">{{ line.title }}</div>

                  <div class="flex items-center gap-1.5 text-[10px] font-mono text-base-content/60 mt-0.5 flex-wrap">
                    <span class="badge badge-xs font-mono font-bold" :class="line.partnerPrefix === 'BB-' ? 'badge-secondary' : line.partnerPrefix === 'PDXGL-' ? 'badge-accent' : 'badge-primary'">
                      {{ line.partnerPrefix }}
                    </span>
                    <span v-if="line.skuOrUpc">{{ line.skuOrUpc }}</span>
                    <span>• Cost ${{ line.unitCost.toFixed(2) }}</span>
                  </div>
                </div>
              </div>

              <!-- Right: Editable Sold Price + Remove -->
              <div class="flex items-center gap-1.5 shrink-0">
                <div class="relative w-22">
                  <span class="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-xs font-bold opacity-60">$</span>
                  <input
                    v-model.number="line.grossPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    class="input input-bordered input-xs w-full pl-5 h-8 rounded-lg font-mono font-black text-right text-xs bg-base-200/40"
                    title="Adjust sold price for this item"
                  />
                </div>
                <button
                  type="button"
                  @click="cartLines.splice(idx, 1)"
                  class="btn btn-ghost btn-circle btn-xs text-base-content/50 hover:text-error"
                  title="Remove from cart"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          <!-- Online Shipping Fields (Applies to Order) -->
          <div v-if="selectedChannel === 'ONLINE'" class="grid grid-cols-2 gap-2.5 pt-1">
            <div class="space-y-1">
              <label class="text-[10px] font-bold text-base-content/70 block">Buyer Paid Shipping ($)</label>
              <input
                v-model.number="shippingCharged"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                class="input input-bordered input-sm w-full h-8 rounded-xl font-mono font-bold text-xs bg-base-100"
              />
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-bold text-base-content/70 block">Actual Postage Cost ($)</label>
              <input
                v-model.number="shippingCost"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                class="input input-bordered input-sm w-full h-8 rounded-xl font-mono font-bold text-xs bg-base-100"
              />
            </div>
          </div>
        </section>

        <div v-if="errorMsg" class="alert alert-error py-2 px-3 rounded-xl text-xs">
          <span>{{ errorMsg }}</span>
        </div>
      </template>

      <!-- Camera Tag Scanner Modal -->
      <BarcodeScannerModal
        :is-open="showScanner"
        title="Scan Tag to Add to Sale Cart"
        subtitle="Point camera at any HUCK- or 0EJ tag"
        @close="showScanner = false"
        @scan="handleBarcodeScanned"
      />
    </div>

    <!-- STICKY CART TOTALS + CHECKOUT FOOTER -->
    <template #footer>
      <div class="space-y-2.5">
        <div v-if="selectedChannel" class="p-2.5 rounded-xl bg-base-200/70 border border-base-300 text-[11px] space-y-1">
          <div class="flex items-center justify-between font-mono">
            <span class="text-base-content/75">
              Cart ({{ effectiveCartLines.length }}) • Gross ${{ totalGrossAmount.toFixed(2) }} • Fee -${{ totalCommissionFee.toFixed(2) }}
            </span>
            <span class="font-black text-sm text-primary">Net ${{ totalNetPayout.toFixed(2) }}</span>
          </div>
          <div class="flex items-center justify-between text-[10px] font-mono text-base-content/70">
            <span>Partner Checks (Cost + 70%): <strong class="text-success">+${{ previewCuratorTake.toFixed(2) }}</strong></span>
            <span>30% Ops Pool: <strong class="text-warning">+${{ previewCommonsTake.toFixed(2) }}</strong></span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            :disabled="!canCheckout || saving"
            @click="checkoutCart(true)"
            class="btn btn-sm sm:btn-md btn-outline btn-primary rounded-xl font-bold flex-1 gap-1"
            title="Record cart and stay open on this venue & date for the next sale"
          >
            <span>Save &amp; Next</span>
          </button>
          <button
            type="button"
            :disabled="!canCheckout || saving"
            @click="checkoutCart(false)"
            class="btn btn-sm sm:btn-md btn-primary rounded-xl font-black flex-1 gap-1.5 shadow-md"
          >
            <span v-if="saving" class="loading loading-spinner loading-xs"></span>
            <Icon v-else icon="solar:check-circle-bold" class="w-4 h-4 shrink-0" />
            <span>Checkout ({{ effectiveCartLines.length || 0 }})</span>
          </button>
        </div>
      </div>
    </template>
  </SlideOverDrawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Icon } from '@iconify/vue';
import SlideOverDrawer from '../common/SlideOverDrawer.vue';
import ItemThumbnail from '../common/ItemThumbnail.vue';
import BarcodeScannerModal from '../common/BarcodeScannerModal.vue';
import { resolveMultiQtyCost } from '../../composables/useItemDrawerForm';
import { databases } from '../../lib/appwrite';
import { getDatabaseId, getItemsCollectionId } from '../../lib/appwriteEnv';
import { salesApi, type SaleData, type SaleDocument } from '../../lib/sales';
import { extractOrgPrefix } from '../../lib/inventoryUpc';
import {
  getAllLocationSettingMetas,
  matchesLocationFilter,
  findFacility,
  type WarehouseDocument,
} from '../../lib/warehouses';
import {
  PREVERIFIED_MD_MULTI_QTY_BINS,
  resolveMdUnitCostBasis,
  cleanCatalogSku,
} from '../../lib/salesBucketing';
import { addToast } from '../../stores/toast';

interface OnlinePreset {
  id: string;
  label: string;
  feePct: number;
  tag: string;
}

interface SaleCartLine {
  cartKey: string;
  mode: 'catalog' | 'quick';
  item?: any;
  title: string;
  skuOrUpc: string;
  partnerPrefix: 'HUCK-' | 'PDXGL-' | 'BB-';
  grossPrice: number;
  unitCost: number;
}

const ONLINE_PRESETS: OnlinePreset[] = [
  { id: 'ebay', label: '📦 eBay', feePct: 13.6, tag: 'EBAY' },
  { id: 'poshmark', label: '👗 Poshmark', feePct: 20, tag: 'POSH' },
  { id: 'popup_card', label: '🎪 Pop-Up (Card)', feePct: 2.9, tag: 'POPUP' },
  { id: 'popup_cash', label: '💵 Pop-Up / Direct (Cash)', feePct: 0, tag: 'POPUP' },
];

const PAPER_SHEET_CHIPS = [
  'Pins & Buttons',
  'Small Collectibles',
  'Jewelry / Charm',
  'Wand / Arcana',
  'Paper Sheet Line',
];

const props = defineProps<{
  modelValue: boolean;
  initialLocation?: string;
  warehouses: WarehouseDocument[];
  inventoryItems: any[];
  tenantId?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'close'): void;
  (e: 'inspect-item', item: any): void;
  (e: 'saved', payload: { sales: SaleDocument[]; linkedItemIds: string[] }): void;
}>();

const todayLocalIso = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const selectedChannel = ref<string>('');
const entryMode = ref<'lookup' | 'quick'>('lookup');
const onlinePresetId = ref<string>('ebay');
const lookupQuery = ref<string>('');
const restrictToVenueStock = ref<boolean>(true);
const quickPartner = ref<'HUCK-' | 'PDXGL-' | 'BB-'>('HUCK-');
const quickTitle = ref<string>('');
const quickPrice = ref<number | null>(null);
const quickCost = ref<number>(0);
const cartLines = ref<SaleCartLine[]>([]);
const customFeePct = ref<number>(15);
const shippingCharged = ref<number>(0);
const shippingCost = ref<number>(0);
const saleDate = ref<string>(todayLocalIso());
const saving = ref<boolean>(false);
const errorMsg = ref<string>('');
const showScanner = ref<boolean>(false);

const boothLocationOptions = computed(() =>
  getAllLocationSettingMetas(props.warehouses).filter((m) => m.monthlyRent > 0 || m.commissionRate > 0)
);

const activeBoothMeta = computed(() => {
  if (!selectedChannel.value || selectedChannel.value === 'ONLINE') return null;
  return boothLocationOptions.value.find((m) => m.code === selectedChannel.value) || null;
});

const advancedEditorHref = computed(() => {
  if (selectedChannel.value === 'ONLINE') return '/sales/new?channel=online';
  if (selectedChannel.value) return `/sales/new?location=${encodeURIComponent(selectedChannel.value)}`;
  return '/sales/new';
});

const resolveItemUnitCost = (item: any): number => {
  if (!item) return 0;
  const skuKey = cleanCatalogSku(item.locationSku || item.sku || '').toUpperCase();
  const upcKey = cleanCatalogSku(item.upc || '').toUpperCase();
  const matchedBin = Object.entries(PREVERIFIED_MD_MULTI_QTY_BINS).find(
    ([k, b]) => k === skuKey || (upcKey && (b.upc?.toUpperCase() === upcKey || b.altUpc?.toUpperCase() === upcKey))
  );
  if (matchedBin) {
    return resolveMdUnitCostBasis(item, matchedBin[0], true);
  }
  const rawCost = Number(item.cost ?? item.purchasePrice ?? 0) || 0;
  const qty = Math.max(1, Number(item.quantity || 1));
  if (qty > 1) {
    return resolveMultiQtyCost(rawCost, qty, Number(item.resalePrice || 0)).unitCost;
  }
  return rawCost;
};

const selectChannel = (code: string) => {
  selectedChannel.value = code;
  errorMsg.value = '';

  if (code === 'ONLINE') {
    const preset = ONLINE_PRESETS.find((p) => p.id === onlinePresetId.value) || ONLINE_PRESETS[0];
    customFeePct.value = preset.feePct;
    restrictToVenueStock.value = false;
    entryMode.value = 'lookup';
    return;
  }

  const meta = boothLocationOptions.value.find((m) => m.code === code);
  customFeePct.value = Number(meta?.feePct ?? 0);
  shippingCharged.value = 0;
  shippingCost.value = 0;
  restrictToVenueStock.value = true;
  entryMode.value = meta?.supportsPaperSalesSheet ? 'quick' : 'lookup';
};

const applyOnlinePreset = (preset: OnlinePreset) => {
  onlinePresetId.value = preset.id;
  customFeePct.value = preset.feePct;
};

const countInCartForItem = (itemId: string): number =>
  cartLines.value.filter((l) => l.item?.$id === itemId).length;

const remainingBinQty = (item: any): number => {
  const maxQty = Math.max(1, Number(item?.quantity || 1));
  return Math.max(0, maxQty - countInCartForItem(item.$id));
};

const addCatalogItemToCart = (item: any) => {
  if (!item || remainingBinQty(item) <= 0) return;
  const detectedPrefix = extractOrgPrefix(item.upc || item.locationSku || '');
  const partnerPrefix: 'HUCK-' | 'PDXGL-' | 'BB-' =
    detectedPrefix === 'PDXGL-' || detectedPrefix === 'BB-' ? detectedPrefix : 'HUCK-';

  cartLines.value.push({
    cartKey: `${item.$id}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    mode: 'catalog',
    item,
    title: item.title || 'Catalog Item',
    skuOrUpc: item.upc || item.locationSku || '',
    partnerPrefix,
    grossPrice: Number(item.resalePrice || item.listPrice || item.soldPrice || 0),
    unitCost: partnerPrefix === 'BB-' ? 0 : resolveItemUnitCost(item),
  });
};

const buildDraftQuickLine = (): SaleCartLine | null => {
  const price = Number(quickPrice.value || 0);
  if (entryMode.value !== 'quick' || price <= 0) return null;
  const fallbackDesc = activeBoothMeta.value
    ? `${activeBoothMeta.value.shortName} Paper Sheet Item`
    : 'Direct / Walk-Up Sale';
  return {
    cartKey: `draft-${Date.now()}`,
    mode: 'quick',
    title: (quickTitle.value || fallbackDesc).trim(),
    skuOrUpc: '',
    partnerPrefix: quickPartner.value,
    grossPrice: price,
    unitCost: quickPartner.value === 'BB-' ? 0 : Math.max(0, Number(quickCost.value || 0)),
  };
};

const addQuickLineToCart = () => {
  const line = buildDraftQuickLine();
  if (!line) return;
  cartLines.value.push({ ...line, cartKey: `quick-${Date.now()}-${Math.random().toString(36).slice(2, 5)}` });
  quickTitle.value = '';
  quickPrice.value = null;
  quickCost.value = 0;
};

// If cart is empty and user typed a valid 1-item Quick Line, allow direct 1-click checkout without forcing a separate "Add" click
const effectiveCartLines = computed<SaleCartLine[]>(() => {
  if (cartLines.value.length > 0) return cartLines.value;
  const draft = buildDraftQuickLine();
  return draft ? [draft] : [];
});

const handleBarcodeScanned = (res: { rawValue?: string }) => {
  showScanner.value = false;
  const scanned = String(res?.rawValue || '').trim();
  if (!scanned) return;
  const scannedUpper = cleanCatalogSku(scanned).toUpperCase();
  const exact = activeInventoryPool.value.find(
    (it) =>
      cleanCatalogSku(it.upc).toUpperCase() === scannedUpper ||
      cleanCatalogSku(it.locationSku).toUpperCase() === scannedUpper ||
      String(it.$id).toUpperCase() === scannedUpper
  );
  if (exact) {
    if (remainingBinQty(exact) > 0) {
      addCatalogItemToCart(exact);
      addToast(`🛒 Added "${exact.title || scanned}" to cart`, 'success');
    } else {
      addToast(`"${exact.title || scanned}" is already in your cart`, 'info');
    }
  } else {
    lookupQuery.value = scanned;
    entryMode.value = 'lookup';
    addToast(`Scanned ${scanned} — select matching item below`, 'info');
  }
};

const activeInventoryPool = computed(() =>
  (props.inventoryItems || []).filter((it) => it.status !== 'archived' && it.status !== 'sold')
);

const venueScopedCandidates = computed(() => {
  if (!selectedChannel.value || selectedChannel.value === 'ONLINE' || !restrictToVenueStock.value) {
    return activeInventoryPool.value;
  }
  return activeInventoryPool.value.filter((it) => matchesLocationFilter(it, selectedChannel.value));
});

const displayedCandidates = computed(() => {
  const pool = venueScopedCandidates.value;
  const q = lookupQuery.value.toLowerCase().trim();
  if (!q) return pool.slice(0, 12);
  return pool
    .filter(
      (it) =>
        String(it.title || '').toLowerCase().includes(q) ||
        String(it.upc || '').toLowerCase().includes(q) ||
        String(it.locationSku || '').toLowerCase().includes(q)
    )
    .slice(0, 20);
});

const effectiveFeeRate = computed(() => Math.max(0, Number(customFeePct.value || 0)));

const totalGrossAmount = computed(() =>
  Number(effectiveCartLines.value.reduce((s, l) => s + Math.max(0, Number(l.grossPrice || 0)), 0).toFixed(2))
);

const totalCommissionFee = computed(() =>
  Number(((totalGrossAmount.value * effectiveFeeRate.value) / 100).toFixed(2))
);

const totalNetPayout = computed(() => {
  const shipNet = Number(shippingCharged.value || 0) - Number(shippingCost.value || 0);
  return Number((totalGrossAmount.value + shipNet - totalCommissionFee.value).toFixed(2));
});

const previewCuratorTake = computed(() => {
  let total = 0;
  effectiveCartLines.value.forEach((l, idx) => {
    const gross = Math.max(0, Number(l.grossPrice || 0));
    const fee = Number(((gross * effectiveFeeRate.value) / 100).toFixed(2));
    const shipNet = idx === 0 ? Number(shippingCharged.value || 0) - Number(shippingCost.value || 0) : 0;
    const postageRecoup = idx === 0 ? Math.max(0, Number(shippingCost.value || 0)) : 0;
    const net = gross + shipNet - fee;
    if (l.partnerPrefix === 'BB-') {
      total += net;
    } else {
      const surplus = Math.max(0, net - l.unitCost);
      total += l.unitCost + postageRecoup + surplus * 0.7;
    }
  });
  return Number(total.toFixed(2));
});

const previewCommonsTake = computed(() => {
  let total = 0;
  effectiveCartLines.value.forEach((l, idx) => {
    if (l.partnerPrefix === 'BB-') return;
    const gross = Math.max(0, Number(l.grossPrice || 0));
    const fee = Number(((gross * effectiveFeeRate.value) / 100).toFixed(2));
    const shipNet = idx === 0 ? Number(shippingCharged.value || 0) - Number(shippingCost.value || 0) : 0;
    const net = gross + shipNet - fee;
    const surplus = Math.max(0, net - l.unitCost);
    total += surplus * 0.3;
  });
  return Number(total.toFixed(2));
});

const canCheckout = computed(() => {
  if (!selectedChannel.value || !props.tenantId) return false;
  if (effectiveCartLines.value.length === 0) return false;
  return effectiveCartLines.value.every((l) => Number(l.grossPrice || 0) > 0);
});

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    errorMsg.value = '';
    cartLines.value = [];
    quickTitle.value = '';
    quickPrice.value = null;
    quickCost.value = 0;
    lookupQuery.value = '';
    saleDate.value = todayLocalIso();

    const initLoc = (props.initialLocation || '').trim().toUpperCase();
    if (initLoc && initLoc !== 'ALL') {
      selectChannel(initLoc);
    } else {
      selectedChannel.value = '';
    }
  }
);

const resolveTargetWarehouseId = (): string => {
  if (selectedChannel.value === 'ONLINE') {
    const hg = findFacility('HG', props.warehouses);
    return hg?.$id || props.warehouses[0]?.$id || 'General';
  }
  const fac = findFacility(selectedChannel.value, props.warehouses);
  return fac?.$id || selectedChannel.value;
};

const checkoutCart = async (keepOpenForNext: boolean) => {
  if (!canCheckout.value || !props.tenantId) return;
  const linesToSave = [...effectiveCartLines.value];
  saving.value = true;
  errorMsg.value = '';

  try {
    const dateIso = saleDate.value ? new Date(`${saleDate.value}T12:00:00`).toISOString() : new Date().toISOString();
    const targetWhId = resolveTargetWarehouseId();
    const createdSales: SaleDocument[] = [];
    const linkedIds: string[] = [];
    const soldCountsByItemId = new Map<string, { item: any; count: number; lastGross: number; lastSaleId: string }>();

    for (let i = 0; i < linesToSave.length; i++) {
      const line = linesToSave[i];
      const gross = Number(Number(line.grossPrice || 0).toFixed(2));
      const fee = Number(((gross * effectiveFeeRate.value) / 100).toFixed(2));
      const lineShipCharged = i === 0 ? Number(shippingCharged.value || 0) : 0;
      const lineShipCost = i === 0 ? Number(shippingCost.value || 0) : 0;
      const net = Number((gross + (lineShipCharged - lineShipCost) - fee).toFixed(2));
      const stamp = `${(saleDate.value || todayLocalIso()).replace(/-/g, '').slice(2)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

      let soNumber = '';
      let orderId = '';

      if (line.mode === 'catalog' && line.item) {
        soNumber = line.item.upc || line.item.locationSku || `${line.partnerPrefix}${stamp}`;
        orderId = `${selectedChannel.value === 'ONLINE' ? 'ONLINE' : selectedChannel.value} • ${line.title}`;
      } else {
        const chanCode =
          selectedChannel.value === 'ONLINE'
            ? ONLINE_PRESETS.find((p) => p.id === onlinePresetId.value)?.tag || 'ONLINE'
            : selectedChannel.value;
        soNumber = `${line.partnerPrefix}${chanCode}-${stamp}`;
        const cleanDesc = line.title.replace(/•/g, '-').trim();
        const costTag = line.unitCost > 0 ? ` [COST:${line.unitCost.toFixed(2)}]` : '';
        const sheetPrefix = activeBoothMeta.value?.supportsPaperSalesSheet
          ? `${selectedChannel.value}-SHEET`
          : chanCode;
        orderId = `${sheetPrefix}${costTag} • ${cleanDesc}`;
      }

      const payload: SaleData = {
        soNumber,
        warehouseId: targetWhId,
        orderId,
        saleDate: dateIso,
        status: 'Sold',
        grossAmount: gross,
        shippingCharged: lineShipCharged,
        shippingCost: lineShipCost,
        commissionFee: fee,
        netPayout: net,
        tenantId: props.tenantId,
      };

      const created = await salesApi.createSale(payload);
      createdSales.push(created);

      if (line.mode === 'catalog' && line.item?.$id) {
        linkedIds.push(line.item.$id);
        const prev = soldCountsByItemId.get(line.item.$id);
        soldCountsByItemId.set(line.item.$id, {
          item: line.item,
          count: (prev?.count || 0) + 1,
          lastGross: gross,
          lastSaleId: created.$id,
        });
      }
    }

    // Update catalog item stock safely (Appwrite Law #7: never write quantity: 0)
    for (const [itemId, entry] of soldCountsByItemId.entries()) {
      try {
        const curQty = Math.max(1, Number(entry.item.quantity || 1));
        const remaining = curQty - entry.count;
        const stillInStock = remaining >= 1;
        await databases.updateDocument(getDatabaseId(), getItemsCollectionId(), itemId, {
          saleId: entry.lastSaleId,
          status: stillInStock ? 'placed' : 'sold',
          quantity: stillInStock ? remaining : 1,
          soldPrice: entry.lastGross,
        });
      } catch (itemErr) {
        console.warn('[RecordSaleDrawer] Non-fatal item stock update warning:', itemErr);
      }
    }

    emit('saved', { sales: createdSales, linkedItemIds: linkedIds });
    addToast(
      `Recorded ${createdSales.length} sale${createdSales.length === 1 ? '' : 's'} ($${totalGrossAmount.value.toFixed(2)} gross)`,
      'success'
    );

    cartLines.value = [];
    quickTitle.value = '';
    quickPrice.value = null;
    quickCost.value = 0;
    shippingCharged.value = 0;
    shippingCost.value = 0;

    if (!keepOpenForNext) {
      emit('update:modelValue', false);
      emit('close');
    }
  } catch (err: any) {
    console.error('[RecordSaleDrawer] Checkout failed:', err);
    errorMsg.value = err?.message || 'Failed to record sale(s). Please try again.';
  } finally {
    saving.value = false;
  }
};
</script>

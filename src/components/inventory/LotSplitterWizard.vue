<template>
  <div class="flex-1 flex flex-col min-h-0 overflow-hidden">
    <!-- Selected Item Summary (Canonical List Item Pattern) -->
    <div class="p-3 border-b border-base-200/80 bg-base-200/40 shrink-0">
      <div 
        class="p-2.5 rounded-box border border-base-300 bg-base-100 flex items-center justify-between gap-3 shadow-xs cursor-pointer hover:bg-base-200/60 transition-all group"
        @click="handleEditInDrawer"
        title="Edit item specs in drawer"
      >
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <ItemThumbnail :item="lotItem" size="sm" class="w-10 h-10 pointer-events-none rounded-box shrink-0" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span v-if="lotItem?.upc || lotItem?.locationSku" class="badge badge-xs font-mono font-bold bg-primary/10 text-primary border-0 shrink-0">
                {{ lotItem?.upc || lotItem?.locationSku }}
              </span>
              <span class="badge badge-xs font-bold shrink-0 badge-warning">
                {{ totalItemCount }} Pieces
              </span>
              <span v-if="lotItem?.storageLocation" class="badge badge-xs badge-ghost font-mono opacity-70 shrink-0">
                {{ lotItem?.storageLocation }}
              </span>
            </div>
            <h4 class="font-bold text-xs text-base-content truncate mt-0.5 group-hover:text-primary transition-colors">
              {{ lotItem?.title || 'Parent Lot' }}
            </h4>
            <div class="text-[10px] font-mono opacity-70 mt-0.5">
              Landed Cost: <strong>${{ totalCost.toFixed(2) }}</strong>
              <span v-if="totalItemCount > 1">
                (${{ (totalCost / Math.max(1, totalItemCount)).toFixed(2) }}/ea)
              </span>
            </div>
          </div>
        </div>
        <button 
          type="button" 
          class="btn btn-ghost btn-xs btn-circle opacity-60 group-hover:opacity-100 group-hover:text-primary shrink-0" 
          title="Edit item in drawer"
          @click.stop="handleEditInDrawer"
        >
          <Icon icon="solar:pen-linear" class="w-4 h-4" />
        </button>
      </div>

      <!-- Quick Action Pills Strip (Split 1 Unit / Rollback) -->
      <div v-if="Number(lotItem?.quantity || 1) > 1 || canRollback" class="flex items-center gap-2 pt-2">
        <button 
          v-if="Number(lotItem?.quantity || 1) > 1"
          type="button"
          class="btn btn-2xs btn-outline btn-primary font-bold gap-1"
          @click="$emit('split-one-unit', lotItem)"
          title="Break off 1 unit immediately into its own SKU"
        >
          <Icon icon="solar:box-minimalistic-bold" class="w-3 h-3" />
          <span>Quick Split 1 Unit</span>
        </button>

        <button 
          v-if="canRollback"
          type="button"
          class="btn btn-2xs btn-outline btn-warning font-bold gap-1"
          @click="$emit('uncombine')"
          title="Undo combine on this lot and restore individual items"
        >
          <Icon icon="solar:restart-bold" class="w-3 h-3" />
          <span>↩️ Undo Combine</span>
        </button>
      </div>
    </div>

    <!-- PROGRESS STEPS (Mobile scrollable) -->
    <div class="px-4 py-2 border-y border-base-200/60 overflow-x-auto no-scrollbar shrink-0 bg-base-100">
      <ul class="steps steps-horizontal w-full min-w-[340px] text-xs font-bold">
        <li class="step cursor-pointer" :class="{ 'step-primary': step >= 1 }" @click="step = 1">1. Tiers Setup</li>
        <li class="step cursor-pointer" :class="{ 'step-primary': step >= 2 }" @click="step = 2">2. Assign Items</li>
        <li class="step cursor-pointer" :class="{ 'step-primary': step >= 3 }" @click="step = 3">3. Costs & Pricing</li>
        <li class="step cursor-pointer" :class="{ 'step-primary': step >= 4 }" @click="step = 4">4. Create SKUs</li>
      </ul>
    </div>

      <!-- WIZARD BODY (Scrollable) -->
      <div class="flex-1 overflow-y-auto py-4 space-y-4 pr-1">

        <!-- ==================================================== -->
        <!-- STEP 1: CONFIGURE CUSTOM TIERS & OUTPUT FORMATS      -->
        <!-- ==================================================== -->
        <div v-if="step === 1" class="space-y-4">
          <div class="bg-base-200/50 p-3 rounded-xl text-xs text-base-content/80 flex items-start gap-2">
            <Icon icon="solar:info-circle-bold" class="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span>Customize your pricing tiers and select the <b>Listing Format</b> for each tier. You can add as many custom tiers as needed.</span>
          </div>

          <div class="space-y-3">
            <div 
              v-for="(tier, tIdx) in tiers" 
              :key="tier.id"
              class="p-4 rounded-xl border border-base-200 bg-base-100 shadow-xs space-y-3 relative group"
            >
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                  <span class="badge badge-sm font-mono font-bold" :class="getTierBadgeClass(tIdx)">Tier {{ tIdx + 1 }}</span>
                  <input 
                    type="text" 
                    v-model="tier.name" 
                    class="input input-sm input-bordered font-bold text-sm w-full max-w-xs"
                    placeholder="Tier Name"
                  />
                </div>
                <button 
                  v-if="tiers.length > 1"
                  type="button" 
                  class="btn btn-xs btn-circle btn-ghost text-error" 
                  @click="removeTier(tIdx)"
                  title="Remove Tier"
                >
                  ✕
                </button>
              </div>

              <!-- Output Listing Mode Selection -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <label 
                  class="flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors text-xs"
                  :class="tier.mode === 'single' ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-base-200 hover:bg-base-200/40'"
                >
                  <input type="radio" :name="`mode-${tier.id}`" value="single" v-model="tier.mode" class="radio radio-xs radio-primary" />
                  <div>
                    <div class="font-bold">🌟 Single Items</div>
                    <div class="text-[10px] opacity-70">Dedicated high-ticket tags</div>
                  </div>
                </label>

                <label 
                  class="flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors text-xs"
                  :class="tier.mode === 'multi_qty' ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-base-200 hover:bg-base-200/40'"
                >
                  <input type="radio" :name="`mode-${tier.id}`" value="multi_qty" v-model="tier.mode" class="radio radio-xs radio-primary" />
                  <div>
                    <div class="font-bold">📦 Multi-Qty SKU</div>
                    <div class="text-[10px] opacity-70">1 listing (Qty: {{ getTierItemCount(tier.id) }})</div>
                  </div>
                </label>

                <label 
                  class="flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors text-xs"
                  :class="tier.mode === 'bundle' ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-base-200 hover:bg-base-200/40'"
                >
                  <input type="radio" :name="`mode-${tier.id}`" value="bundle" v-model="tier.mode" class="radio radio-xs radio-primary" />
                  <div>
                    <div class="font-bold">🎁 Mini-Lot Bundle</div>
                    <div class="text-[10px] opacity-70">Sold together as 1 set</div>
                  </div>
                </label>
              </div>

              <!-- Price settings with Dynamic AI Average Suggestion -->
              <div class="flex items-center justify-between text-xs pt-1 border-t border-base-200/40">
                <div class="flex items-center gap-2">
                  <span class="text-base-content/70">Target Price / Unit:</span>
                  <div class="relative w-24">
                    <span class="absolute left-2.5 top-1.5 font-bold text-xs">$</span>
                    <input 
                      type="number" 
                      v-model.number="tier.targetPrice" 
                      @input="onTierPriceInput(tier)"
                      step="0.50" 
                      min="1" 
                      class="input input-xs input-bordered pl-6 font-mono font-bold w-full" 
                    />
                  </div>
                  <button 
                    v-if="getTierAiAverage(tier.id) > 0 && getTierAiAverage(tier.id) !== tier.targetPrice"
                    type="button" 
                    class="btn btn-xs btn-ghost text-primary text-[10px] gap-1 px-1.5"
                    @click="tier.targetPrice = getTierAiAverage(tier.id); onTierPriceInput(tier)"
                    title="Click to apply AI calculated average price"
                  >
                    <span>AI Avg: ${{ getTierAiAverage(tier.id).toFixed(2) }} ↺</span>
                  </button>
                  <span v-else-if="getTierAiAverage(tier.id) > 0" class="text-[10px] text-base-content/50">
                    (AI Avg: ${{ getTierAiAverage(tier.id).toFixed(2) }})
                  </span>
                </div>
                <div class="font-bold text-xs">
                  {{ getTierItemCount(tier.id) }} items assigned
                </div>
              </div>
            </div>
          </div>

          <button 
            type="button" 
            class="btn btn-sm btn-outline btn-primary w-full gap-2 border-dashed"
            @click="addCustomTier"
          >
            <Icon icon="solar:add-circle-bold" class="w-4 h-4" />
            + Add Another Custom Tier
          </button>
        </div>

        <!-- ==================================================== -->
        <!-- STEP 2: ASSIGN ITEMS TO TIERS (MOBILE 1-TAP PILLS)   -->
        <!-- ==================================================== -->
        <div v-if="step === 2" class="space-y-4">
          <!-- Selection & Move Guidance Banner -->
          <div class="alert alert-info py-2 px-3 text-[11px] shadow-xs flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Icon icon="solar:info-circle-bold" class="w-4 h-4 shrink-0" />
              <span>Tap the <b>Tier badge</b> on any item to reassign it, or check boxes to <b>bulk move</b>.</span>
            </div>
            <span class="badge badge-xs badge-neutral font-bold">{{ allItems.length }} total</span>
          </div>

          <!-- Multi-angle auto-crop banner -->
          <div v-if="hasCompletedAutoCrop || totalCroppedCount > 0" class="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-success/40 bg-success/10 text-[11px] text-success-content">
            <div class="flex items-center gap-1.5 font-bold min-w-0">
              <Icon icon="solar:check-circle-bold" class="w-4 h-4 text-success shrink-0" />
              <span class="truncate">✅ Auto-Cropped Item Views (Click any photo to zoom, or ✕ to remove)</span>
            </div>
            <button type="button" class="btn btn-2xs btn-outline btn-success font-bold gap-1 shrink-0" :disabled="isCropping" @click="autoCropAll">
              <Icon icon="solar:restart-bold" class="w-3 h-3" />
              <span>↻ Re-Crop</span>
            </button>
          </div>
          <div v-else class="flex items-center justify-between gap-2 p-2 rounded-xl border border-dashed border-base-300 bg-base-100 text-[11px]">
            <span class="text-base-content/70">Crop each item out of your gallery photos (front, back &amp; detail views).</span>
            <button type="button" class="btn btn-xs btn-primary font-bold gap-1 shrink-0" :disabled="isCropping" @click="autoCropAll">
              <Icon icon="solar:crop-bold" class="w-3.5 h-3.5" />
              <span>Auto-Crop Photos</span>
            </button>
          </div>

          <!-- Tier Filter Tabs -->
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button 
              type="button" 
              class="btn btn-xs rounded-full font-bold"
              :class="activeFilterTab === 'all' ? 'btn-primary' : 'btn-ghost border border-base-200'"
              @click="activeFilterTab = 'all'"
            >
              All Items ({{ allItems.length }})
            </button>
            <button 
              v-for="(tier, idx) in tiers" 
              :key="tier.id"
              type="button"
              class="btn btn-xs rounded-full gap-1 font-bold"
              :class="activeFilterTab === tier.id ? 'btn-primary' : 'btn-ghost border border-base-200'"
              @click="activeFilterTab = tier.id"
            >
              <span class="w-2 h-2 rounded-full" :class="getTierDotClass(idx)"></span>
              Tier {{ idx + 1 }} ({{ getTierItemCount(tier.id) }})
            </button>
          </div>

          <!-- Column Header Labels -->
          <div class="hidden sm:flex items-center justify-between px-3 text-[10px] uppercase font-bold text-base-content/50 tracking-wider">
            <div class="flex items-center gap-6">
              <span>Select</span>
              <span>Item Description &amp; Fair Comps</span>
            </div>
            <div class="flex items-center gap-12 pr-2">
              <span>Tag Price</span>
              <span>Assigned Tier</span>
            </div>
          </div>

          <!-- Empty State if filtered tab has 0 items -->
          <div v-if="filteredItems.length === 0" class="p-8 text-center bg-base-200/40 rounded-xl space-y-3">
            <Icon icon="solar:box-minimalistic-linear" class="w-10 h-10 mx-auto text-base-content/40" />
            <div class="space-y-1">
              <div class="font-bold text-xs sm:text-sm">No items currently in this tier tab</div>
              <p class="text-[11px] text-base-content/60">Tap "All Items" or another tier above to view and assign your items.</p>
            </div>
            <button type="button" class="btn btn-xs btn-primary font-bold" @click="activeFilterTab = 'all'">
              View All Items ({{ allItems.length }})
            </button>
          </div>

          <!-- Items Card List -->
          <div v-else class="space-y-2">
            <div 
              v-for="item in filteredItems" 
              :key="item.index"
              class="p-3 rounded-xl border transition-all flex items-center justify-between gap-3"
              :class="selectedItemIndices.has(item.index) ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40' : 'border-base-200 bg-base-100 shadow-xs hover:border-primary/40'"
            >
              <!-- Checkbox, Thumbnail & Info -->
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <input 
                  type="checkbox" 
                  :checked="selectedItemIndices.has(item.index)" 
                  @change="toggleSelect(item.index)" 
                  class="checkbox checkbox-xs checkbox-primary shrink-0" 
                  title="Check to select for bulk move"
                />
                
                <div class="min-w-0 flex-1">
                  <div class="font-bold text-xs sm:text-sm truncate">{{ item.title }}</div>
                  <div class="text-[11px] text-base-content/60 flex items-center gap-2">
                    <span v-if="item.condition" class="badge badge-xs badge-ghost">{{ item.condition }}</span>
                    <span>Est: <b>{{ item.estimated_value || '$15 - $25' }}</b></span>
                  </div>

                  <!-- Matched / cropped views strip (w-14 h-14 thumbnails with zoom & remove) -->
                  <div class="flex flex-wrap items-center gap-1.5 mt-2">
                    <div
                      v-for="v in item.views"
                      :key="v.key"
                      class="w-14 h-14 rounded-lg bg-base-200 overflow-hidden border relative shrink-0 group/thumb cursor-pointer shadow-2xs hover:ring-2 hover:ring-primary/60 transition-all"
                      :class="isViewCropped(v) ? 'border-success/60' : 'border-base-300'"
                      :title="`${v.role} - photo ${v.image_index + 1} (Click to zoom preview)`"
                      @click="zoomView(getViewPreviewUrl(v), `${item.title} (${viewRoleLabel(v.role)})`)"
                    >
                      <img :src="getViewPreviewUrl(v)" class="w-full h-full object-cover" alt="" loading="lazy" />
                      <span 
                        class="absolute bottom-0 inset-x-0 text-[8px] leading-3.5 font-bold uppercase text-center bg-black/75 text-white truncate px-0.5 cursor-pointer hover:bg-primary"
                        @click.stop="cycleViewRole(v)"
                        title="Tap to change role"
                      >
                        {{ viewRoleLabel(v.role) }}
                      </span>
                      <!-- Corner ✕ remove button -->
                      <button 
                        type="button" 
                        class="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 hover:bg-error text-white flex items-center justify-center text-[9px] font-bold z-10 transition-colors shadow-xs"
                        @click.stop="removeViewFromItem(item, v)"
                        title="Remove this photo view"
                      >
                        ✕
                      </button>
                    </div>

                    <div class="dropdown dropdown-top">
                      <label tabindex="0" class="w-14 h-14 rounded-lg border-2 border-dashed border-base-300 flex flex-col items-center justify-center cursor-pointer text-base-content/60 hover:text-primary hover:border-primary transition-all" title="Assign / toggle gallery photos">
                        <Icon icon="solar:add-circle-linear" class="w-5 h-5" />
                        <span class="text-[8px] font-bold mt-0.5">Add</span>
                      </label>
                      <div tabindex="0" class="dropdown-content z-30 p-2 shadow-2xl bg-base-100 rounded-xl border border-base-200 w-56 mb-1">
                        <div class="text-[10px] uppercase font-bold opacity-60 pb-1">Toggle gallery photos</div>
                        <div v-if="galleryPhotos.length === 0" class="text-[11px] opacity-60">No gallery photos on this lot.</div>
                        <div class="grid grid-cols-4 gap-1">
                          <button
                            v-for="(photo, pIdx) in galleryPhotos"
                            :key="pIdx"
                            type="button"
                            class="w-11 h-11 rounded-md overflow-hidden border-2 relative"
                            :class="itemHasPhoto(item, pIdx) ? 'border-primary' : 'border-base-300 opacity-70'"
                            @click="togglePhotoForItem(item, pIdx)"
                          >
                            <img :src="photoPreviewUrl(pIdx)" class="w-full h-full object-cover" alt="" loading="lazy" />
                            <span class="absolute top-0 left-0 text-[8px] px-0.5 bg-black/65 text-white font-bold">{{ pIdx + 1 }}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Individual Tag Price Input & Tier Move Badge -->
              <div class="flex items-center gap-2 shrink-0">
                <div class="relative w-18" title="Retail tag price for this specific item">
                  <span class="absolute left-2 top-1 font-bold text-[11px] text-base-content/50">$</span>
                  <input 
                    type="number" 
                    v-model.number="item.customPrice" 
                    @input="item.isPriceOverridden = true"
                    step="0.50" 
                    min="1"
                    class="input input-xs input-bordered pl-5 font-mono font-bold text-xs w-full text-right" 
                  />
                </div>

                <!-- 1-Tap Tier Selector Button (Mobile First) -->
                <div class="dropdown dropdown-end shrink-0">
                  <label tabindex="0" class="btn btn-xs rounded-full font-bold gap-1 cursor-pointer" :class="getTierBadgeClass(getTierIndex(item.tierId))" title="Tap to move to another tier">
                    <span>{{ getTierShortName(item.tierId) }}</span>
                    <Icon icon="solar:alt-arrow-down-linear" class="w-3 h-3" />
                  </label>
                  <ul tabindex="0" class="dropdown-content z-30 menu p-2 shadow-2xl bg-base-100 rounded-xl w-52 border border-base-200 text-xs mt-1">
                    <li class="menu-title text-[10px] uppercase font-bold opacity-60">Move to Tier</li>
                    <li v-for="(t, idx) in tiers" :key="t.id">
                      <a 
                        @click="assignItemToTier(item.index, t.id)"
                        :class="{ 'active font-bold': item.tierId === t.id }"
                      >
                        <span class="w-2 h-2 rounded-full" :class="getTierDotClass(idx)"></span>
                        {{ t.name }}
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <!-- Sticky Bottom Bulk Action Bar on Mobile -->
          <div 
            v-if="selectedItemIndices.size > 0"
            class="sticky bottom-0 z-20 p-3 bg-base-300/95 backdrop-blur-md rounded-xl border border-primary/30 flex items-center justify-between shadow-xl"
          >
            <div class="text-xs font-bold">
              <span>{{ selectedItemIndices.size }}</span> items selected
            </div>
            <div class="flex items-center gap-2">
              <div class="dropdown dropdown-top dropdown-end">
                <label tabindex="0" class="btn btn-xs btn-primary font-bold gap-1">
                  <span>Move Selected ▾</span>
                </label>
                <ul tabindex="0" class="dropdown-content z-30 menu p-2 shadow-2xl bg-base-100 rounded-xl w-52 border border-base-200 text-xs mb-1">
                  <li v-for="(t, idx) in tiers" :key="t.id">
                    <a @click="moveSelectedToTier(t.id)">
                      <span class="w-2 h-2 rounded-full" :class="getTierDotClass(idx)"></span>
                      Move to {{ t.name }}
                    </a>
                  </li>
                </ul>
              </div>
              <button type="button" class="btn btn-xs btn-ghost" @click="selectedItemIndices.clear()">Clear</button>
            </div>
          </div>
        </div>

        <!-- ==================================================== -->
        <!-- STEP 3: COST BASIS & PROFIT PROJECTIONS              -->
        <!-- ==================================================== -->
        <div v-if="step === 3" class="space-y-4">
          <!-- Total Cost Summary Card with Immutable PO Badge -->
          <div class="p-4 rounded-xl bg-base-200/60 border border-base-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center relative">
            <div>
              <div class="text-[10px] uppercase font-bold text-base-content/60 flex items-center justify-center gap-1">
                <Icon icon="solar:lock-bold" class="w-3 h-3 text-primary" />
                Original PO Cost
              </div>
              <div class="text-base font-mono font-black text-primary">${{ totalCost.toFixed(2) }}</div>
              <div class="text-[9px] text-base-content/50">Immutable Basis</div>
            </div>
            <div>
              <div class="text-[10px] uppercase font-bold text-base-content/60">Total Pieces</div>
              <div class="text-base font-black">{{ totalItemCount }}</div>
            </div>
            <div>
              <div class="text-[10px] uppercase font-bold text-base-content/60">Proj. Total Sales</div>
              <div class="text-base font-mono font-black text-success">${{ projectedGrossSales.toFixed(2) }}</div>
            </div>
            <div>
              <div class="text-[10px] uppercase font-bold text-base-content/60">Est. Net Profit</div>
              <div class="text-base font-mono font-black text-success">+${{ projectedNetProfit.toFixed(2) }}</div>
            </div>
          </div>

          <!-- Cost Allocation Switcher -->
          <div class="form-control p-3 bg-base-100 rounded-xl border border-base-200 space-y-2">
            <label class="label-text font-bold text-xs">Cost Allocation Method:</label>
            <div class="flex gap-4">
              <label class="flex items-center gap-2 text-xs cursor-pointer">
                <input type="radio" value="equal" v-model="costAllocationMode" class="radio radio-xs radio-primary" />
                <span><b>Equal Split:</b> ${{ (totalCost / (totalItemCount || 1)).toFixed(2) }}/unit</span>
              </label>
              <label class="flex items-center gap-2 text-xs cursor-pointer">
                <input type="radio" value="weighted" v-model="costAllocationMode" class="radio radio-xs radio-primary" />
                <span><b>Value-Weighted:</b> Proportional to target price</span>
              </label>
            </div>
          </div>

          <!-- Tier by Tier Breakdown Table -->
          <div class="space-y-2">
            <h4 class="font-bold text-xs uppercase tracking-wider text-base-content/70">Resulting Crated SKUs:</h4>
            
            <div 
              v-for="(tier, idx) in tiers" 
              :key="tier.id"
              class="p-3 rounded-xl border border-base-200 bg-base-100 flex items-center justify-between text-xs"
            >
              <div class="space-y-0.5">
                <div class="font-bold flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full" :class="getTierDotClass(idx)"></span>
                  {{ tier.name }}
                  <span class="badge badge-xs badge-ghost uppercase">{{ tier.mode }}</span>
                </div>
                <div class="text-[11px] text-base-content/60">
                  {{ getTierItemCount(tier.id) }} Items • Cost Basis: ${{ getTierCostBasis(tier).toFixed(2) }}/ea • Retail Tag: {{ getTierDisplayPrice(tier) }}
                </div>
              </div>

              <div class="text-right font-mono">
                <div class="font-bold text-success">${{ getTierTotalYield(tier).toFixed(2) }}</div>
                <div class="text-[10px] text-base-content/60">Yield</div>
              </div>
            </div>
          </div>
        </div>

        <!-- ==================================================== -->
        <!-- STEP 4: REVIEW & EXECUTE GENERATION                  -->
        <!-- ==================================================== -->
        <div v-if="step === 4" class="space-y-4 text-center py-4">
          <div class="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto shadow-inner">
            <Icon icon="solar:check-circle-bold-duotone" class="w-10 h-10" />
          </div>

          <div class="space-y-1 max-w-md mx-auto">
            <h3 class="font-black text-lg">Ready to Generate Crated SKUs!</h3>
            <p class="text-xs text-base-content/70">
              This will create <b>{{ totalGeneratedListingCount }} new inventory documents</b> in Appwrite, link component photos, assign cost basis, and prepare tags for Memory Den POS.
            </p>
          </div>

          <!-- Listing Distribution Breakdown -->
          <div class="p-4 bg-base-200/50 rounded-xl max-w-md mx-auto text-left text-xs space-y-2 border border-base-200">
            <div class="font-bold text-xs uppercase tracking-wider text-base-content/60 pb-1 border-b border-base-200">
              Inventory Listings to Create
            </div>
            <div class="flex justify-between">
              <span>🌟 Single Standout Documents:</span>
              <b>{{ singleItemCount }} listings</b>
            </div>
            <div class="flex justify-between">
              <span>📦 Multi-Quantity SKU Listings:</span>
              <b>{{ multiQtyListingCount }} listings</b>
            </div>
            <div class="flex justify-between">
              <span>🎁 Bundled Lot Sets:</span>
              <b>{{ bundleListingCount }} sets</b>
            </div>
            <div class="border-t border-base-200/80 pt-2 flex justify-between font-bold text-primary">
              <span>Total Crated Pieces:</span>
              <span>{{ totalItemCount }} pieces</span>
            </div>
          </div>

          <!-- Financial Profit Audit Box -->
          <div class="p-4 bg-base-200/50 rounded-xl max-w-md mx-auto text-left text-xs space-y-1.5 border border-base-200 font-mono">
            <div class="font-bold font-sans text-xs uppercase tracking-wider text-base-content/60 pb-1 border-b border-base-200">
              Financial Projections (Memory Den)
            </div>
            <div class="flex justify-between">
              <span class="font-sans text-base-content/70">Projected Total Gross Sales:</span>
              <span class="font-bold">${{ projectedGrossSales.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between text-error/80">
              <span class="font-sans text-base-content/70">Est. 12% Booth Commission:</span>
              <span>-${{ (projectedGrossSales * 0.12).toFixed(2) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="font-sans text-base-content/70">Net Booth Payout (88%):</span>
              <span class="font-bold text-primary">${{ (projectedGrossSales * 0.88).toFixed(2) }}</span>
            </div>
            <div class="flex justify-between text-base-content/60">
              <span class="font-sans">Original PO Cost Basis:</span>
              <span>-${{ totalCost.toFixed(2) }}</span>
            </div>
            <div class="border-t border-base-200/80 pt-2 flex justify-between font-bold text-sm text-success">
              <span class="font-sans">Est. Net Profit:</span>
              <span>+${{ projectedNetProfit.toFixed(2) }}</span>
            </div>
          </div>
        </div>

      </div>

      <!-- WIZARD STICKY FOOTER ACTIONS -->
      <div class="px-4 py-3 border-t border-base-300 flex items-center justify-between gap-3 shrink-0 bg-base-200/90 backdrop-blur-md">
        <button 
          type="button" 
          class="btn btn-sm btn-ghost font-semibold gap-1"
          @click="step > 1 ? step-- : closeWizard()"
          :disabled="isSubmitting"
        >
          <Icon icon="solar:arrow-left-linear" class="w-4 h-4" />
          <span>{{ step > 1 ? 'Back' : 'Cancel' }}</span>
        </button>

        <div class="flex items-center gap-2">
          <button 
            v-if="step < 4" 
            type="button" 
            class="btn btn-sm btn-primary font-bold gap-1 shadow-sm active:scale-95 transition-all"
            @click="step++"
          >
            <span>Continue</span>
            <Icon icon="solar:arrow-right-linear" class="w-4 h-4" />
          </button>

          <button 
            v-else 
            type="button" 
            class="btn btn-sm btn-success text-success-content font-black gap-2 shadow-md active:scale-95 transition-all"
            @click="executeSplit"
            :disabled="isSubmitting"
          >
            <span v-if="isSubmitting" class="loading loading-spinner loading-xs"></span>
            <Icon v-else icon="solar:rocket-bold" class="w-4 h-4" />
            <span>Create {{ totalGeneratedListingCount }} Inventory SKUs</span>
          </button>
        </div>
      </div>
  </div>

  <!-- Click-to-Zoom Preview Modal -->
  <dialog v-if="zoomedImageUrl" class="modal modal-open z-999" @click="zoomedImageUrl = null">
    <div class="modal-box p-3 max-w-2xl bg-base-100 rounded-2xl relative shadow-2xl" @click.stop>
      <div class="flex items-center justify-between pb-2 border-b border-base-200 mb-2">
        <span class="text-xs font-bold text-base-content truncate">{{ zoomedImageTitle || 'Photo Preview' }}</span>
        <button type="button" class="btn btn-xs btn-circle btn-ghost" @click="zoomedImageUrl = null">✕</button>
      </div>
      <div class="w-full flex items-center justify-center bg-black/5 rounded-xl overflow-hidden max-h-[70vh]">
        <img :src="zoomedImageUrl" class="max-w-full max-h-[70vh] object-contain rounded-lg" alt="Zoomed view" />
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, shallowRef } from 'vue';
import { Icon } from '@iconify/vue';
import ItemThumbnail from '../common/ItemThumbnail.vue';
import { useAuth } from '../../composables/useAuth';
import { useItemDrawer } from '../../composables/useItemDrawer';
import { useLotSplitter } from '../../composables/useLotSplitter';
import { useLoader } from '../../composables/useLoader';
import { addToast } from '../../stores/toast';
import { databases, Query } from '../../lib/appwrite';
import { DB_ID, BUCKET_ID, getCollectionId, saveItemToInventory, duplicateItemMediaInStorage, updateInventoryItem, fetchAssetBlob, getProxiedAssetUrl } from '../../lib/inventory';
import { storage } from '../../lib/appwrite';
import { generateNextUpc } from '../../lib/upcAuthority';
import { getSubItemBoutique } from '../../lib/bundle-pricing';
import { parsePriceValue } from '../../lib/lot-strategy';
import { cropPhotoToJpeg, type NormBox } from '../../lib/photoSlicing';
import { ID } from 'appwrite';

const props = defineProps<{
  lotItem: any;
  isOpen?: boolean;
}>();

const emit = defineEmits(['close', 'completed', 'uncombine', 'split-one-unit']);

// =========================================================================
// 1. STATE & SEQUENCE IDENTIFIERS (TOP-LEVEL BEFORE ANY CALLS/WATCHERS)
// =========================================================================
let viewSeq = 0;

// Cropped blobs kept strictly outside Vue reactivity in a plain Map
const viewBlobs = new Map<string, Blob>();

// Cropped preview Data URLs stored in a separate shallowRef map to avoid mutating watched items
const croppedPreviews = shallowRef<Record<string, string>>({});

// Execution guards & photo preview helpers
const isCropping = ref(false);
const hasAutoCroppedStep2 = ref(false);
const hasCompletedAutoCrop = ref(false);
const zoomedImageUrl = ref<string | null>(null);
const zoomedImageTitle = ref<string | null>(null);

function zoomView(url: string, title?: string) {
  zoomedImageUrl.value = url;
  zoomedImageTitle.value = title || 'Photo Preview';
}

function removeViewFromItem(item: ParsedItem, v: ItemViewState) {
  const idx = item.views.findIndex(view => view.key === v.key);
  if (idx >= 0) {
    viewBlobs.delete(v.key);
    if (croppedPreviews.value[v.key]) {
      const next = { ...croppedPreviews.value };
      delete next[v.key];
      croppedPreviews.value = next;
    }
    item.views.splice(idx, 1);
  }
}

const totalCroppedCount = computed(() => Object.keys(croppedPreviews.value).length);

const step = ref(1);
const isSubmitting = ref(false);
const activeFilterTab = ref('all');
const costAllocationMode = ref<'equal' | 'weighted'>('equal');
const selectedItemIndices = ref(new Set<number>());

// Custom Tier Definitions
interface CustomTier {
  id: string;
  name: string;
  mode: 'single' | 'multi_qty' | 'bundle';
  targetPrice: number;
}

const tiers = ref<CustomTier[]>([
  { id: 'tier-1', name: '🌟 Tier 1: Showcase', mode: 'single', targetPrice: 55 },
  { id: 'tier-2', name: '📦 Tier 2: Core', mode: 'multi_qty', targetPrice: 22 },
  { id: 'tier-3', name: '⚡ Tier 3: Quick Turn', mode: 'multi_qty', targetPrice: 10 },
]);

type ViewRole = 'front' | 'back' | 'spine' | 'detail' | 'tag';
const VIEW_ROLES: ViewRole[] = ['front', 'back', 'spine', 'detail', 'tag'];

interface ItemViewState {
  key: string;
  role: ViewRole;
  image_index: number;
  bounding_box?: NormBox;
}

interface ParsedItem {
  index: number;
  title: string;
  tierId: string;
  condition: string;
  estimated_value: string;
  customPrice: number;
  isPriceOverridden?: boolean;
  image_url?: string;
  views: ItemViewState[];
}

const allItems = ref<ParsedItem[]>([]);

const { currentTeam, user } = useAuth();
const { openItemDrawer } = useItemDrawer();
const { closeLotSplitter, updateActiveLotItem } = useLotSplitter();
const { showLoader, hideLoader } = useLoader();

function handleEditInDrawer() {
  closeLotSplitter();
  emit('close');
  openItemDrawer(props.lotItem);
}

// =========================================================================
// 2. COMPUTED LOT PROPERTIES
// =========================================================================
const isLot = computed(() => {
  const lot = props.lotItem;
  if (!lot) return false;
  return !!(
    lot.isLot || 
    lot.status === 'combined' || 
    (Number(lot.quantity || 1) > 1 && !lot.parentLotId) ||
    (Array.isArray(lot.lotChildren) && lot.lotChildren.length > 0) ||
    /\b(?:lot|bundle|crate|pack|collection)\b/i.test(lot.title || '')
  );
});

// Rollback is only meaningful for lots that were actually combined/split into child documents
const canRollback = computed(() => {
  const lot = props.lotItem;
  if (!lot) return false;
  return lot.status === 'combined' || (Array.isArray(lot.lotChildren) && lot.lotChildren.length > 0);
});

// Source gallery photos (index == AI image_index)
const galleryPhotos = computed<string[]>(() => {
  const l = props.lotItem;
  if (!l) return [];
  const imgs = Array.isArray(l.images) && l.images.length > 0
    ? l.images
    : [l.imageId, ...(Array.isArray(l.galleryImageIds) ? l.galleryImageIds : [])];
  return imgs.filter((s: any) => typeof s === 'string' && s);
});

// =========================================================================
// 3. PHOTO PREVIEWS & MULTI-ANGLE VIEW BUILDERS
// =========================================================================
function photoPreviewUrl(photoIdx: number): string {
  return getProxiedAssetUrl(galleryPhotos.value[photoIdx] || galleryPhotos.value[0]);
}

function getViewPreviewUrl(v: ItemViewState): string {
  return croppedPreviews.value[v.key] || photoPreviewUrl(v.image_index);
}

function isViewCropped(v: ItemViewState): boolean {
  return Boolean(croppedPreviews.value[v.key]);
}

function makeView(role: ViewRole, imageIndex: number, box?: NormBox): ItemViewState {
  return {
    key: `v${++viewSeq}`,
    role,
    image_index: imageIndex,
    bounding_box: box
  };
}

function toNormBox(box: any): NormBox | undefined {
  if (!Array.isArray(box) || box.length !== 4) return undefined;
  const n = box.map((v: any) => Math.max(0, Math.min(1000, Number(v))));
  if (n.some(v => Number.isNaN(v)) || n[2] <= n[0] || n[3] <= n[1]) return undefined;
  return n as NormBox;
}

function buildViews(it: any, fallbackIdx: number): ItemViewState[] {
  const max = Math.max(1, galleryPhotos.value.length);
  const clampIdx = (v: any, d: number) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n < max ? n : Math.min(d, max - 1);
  };
  const out: ItemViewState[] = [];
  if (Array.isArray(it?.views)) {
    for (const v of it.views) {
      const role: ViewRole = VIEW_ROLES.includes(v?.role) ? v.role : 'detail';
      out.push(makeView(role, clampIdx(v?.image_index, 0), toNormBox(v?.bounding_box)));
    }
  }
  if (out.length === 0) {
    out.push(makeView('front', clampIdx(it?.image_index, fallbackIdx), toNormBox(it?.bounding_box)));
  }
  return out;
}

function viewRoleLabel(role: ViewRole): string {
  return role === 'detail' ? 'Detail' : role.charAt(0).toUpperCase() + role.slice(1);
}

function cycleViewRole(v: ItemViewState) {
  v.role = VIEW_ROLES[(VIEW_ROLES.indexOf(v.role) + 1) % VIEW_ROLES.length];
}

function itemHasPhoto(item: ParsedItem, photoIdx: number): boolean {
  return item.views.some(v => v.image_index === photoIdx);
}

function togglePhotoForItem(item: ParsedItem, photoIdx: number) {
  const existing = item.views.findIndex(v => v.image_index === photoIdx);
  if (existing >= 0) {
    const viewKey = item.views[existing].key;
    viewBlobs.delete(viewKey);
    if (croppedPreviews.value[viewKey]) {
      const next = { ...croppedPreviews.value };
      delete next[viewKey];
      croppedPreviews.value = next;
    }
    item.views.splice(existing, 1);
  } else {
    item.views.push(makeView(item.views.length === 0 ? 'front' : 'detail', photoIdx));
  }
}

// =========================================================================
// 4. MEMORY-SAFE CANVAS CROPPING (MUTATES shallowRef MAP, NEVER ITEMS ARRAY)
// =========================================================================
/** Crops every view that has a bounding box out of its (proxied, CORS-safe) gallery photo. */
async function cropView(v: ItemViewState): Promise<boolean> {
  const src = galleryPhotos.value[v.image_index];
  if (!src || !v.bounding_box) return false;
  try {
    const { blob, dataUrl } = await cropPhotoToJpeg(src, v.bounding_box, { padding: 0, maxSize: 1200 });
    viewBlobs.set(v.key, blob);
    // Store dataUrl in separate shallowRef map instead of mutating the item object directly
    croppedPreviews.value = {
      ...croppedPreviews.value,
      [v.key]: dataUrl
    };
    return true;
  } catch (e) {
    console.warn('[LotSplitterWizard] Crop skipped:', e);
    return false;
  }
}

async function autoCropAll() {
  if (isCropping.value) return;
  isCropping.value = true;
  showLoader("Auto-Cropping Item Photos...", {
    step: "Matching front, back & detail views across gallery photos...",
    progress: 45,
    cancelable: true
  });
  let done = 0;
  let withBox = 0;
  try {
    let toCrop: ItemViewState[] = [];
    for (const it of allItems.value) {
      for (const v of it.views) {
        if (v.bounding_box) {
          withBox++;
          if (!croppedPreviews.value[v.key]) {
            toCrop.push(v);
          }
        }
      }
    }

    // If no items have bounding boxes yet, fetch them on demand via /api/inspect-lot!
    if (withBox === 0 && galleryPhotos.value.length > 0 && allItems.value.length > 0) {
      showLoader("Auto-Cropping Item Photos...", {
        step: "Detecting item coordinates across gallery photos with Gemini AI...",
        progress: 60,
        cancelable: true
      });
      try {
        const resp = await fetch('/api/inspect-lot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            remoteImageUrls: galleryPhotos.value,
            title: props.lotItem?.title || props.lotItem?.name,
            cost: props.lotItem?.cost,
            quantity: allItems.value.length,
            existingItems: allItems.value.map(it => ({
              name: it.title,
              identity: it.title,
              condition: it.condition,
              estimated_value: it.estimated_value
            }))
          })
        });

        if (resp.ok) {
          const inspected = await resp.json();
          if (Array.isArray(inspected.lot_items) && inspected.lot_items.length > 0) {
            allItems.value.forEach((it, idx) => {
              const match = inspected.lot_items[idx] || inspected.lot_items.find((li: any) => li.name?.toLowerCase() === it.title.toLowerCase());
              if (match) {
                const newViews = buildViews(match, idx);
                if (newViews.some(v => v.bounding_box)) {
                  it.views = newViews;
                }
              }
            });

            // Persist the newly found views/bounding_boxes back to the lot item in Appwrite
            if (props.lotItem?.$id) {
              try {
                const updatedComponents = allItems.value.map(it => ({
                  name: it.title,
                  condition: it.condition,
                  estimated_value: it.estimated_value,
                  bounding_box: it.views.find(v => v.bounding_box)?.bounding_box,
                  views: it.views.map(v => ({ role: v.role, image_index: v.image_index, bounding_box: v.bounding_box }))
                }));
                const existingRaw = typeof props.lotItem.rawAnalysis === 'string'
                  ? JSON.parse(props.lotItem.rawAnalysis || '{}')
                  : (props.lotItem.rawAnalysis || {});
                existingRaw.lot_items = updatedComponents;
                await updateInventoryItem(props.lotItem.$id, {
                  rawAnalysis: JSON.stringify(existingRaw)
                });
                if (props.lotItem) {
                  props.lotItem.rawAnalysis = JSON.stringify(existingRaw);
                }
                updateActiveLotItem({ rawAnalysis: JSON.stringify(existingRaw) });
              } catch (saveErr) {
                console.warn('[LotSplitterWizard] Failed to persist detected bounding boxes:', saveErr);
              }
            }

            // Re-collect toCrop
            toCrop = [];
            for (const it of allItems.value) {
              for (const v of it.views) {
                if (v.bounding_box) {
                  withBox++;
                  if (!croppedPreviews.value[v.key]) {
                    toCrop.push(v);
                  }
                }
              }
            }
          }
        }
      } catch (err: any) {
        console.warn('[LotSplitterWizard] On-demand inspect-lot failed:', err);
      }
    }

    showLoader("Auto-Cropping Item Photos...", {
      step: `Rendering high-res crops for ${toCrop.length} photo views...`,
      progress: 80,
      cancelable: true
    });

    for (const v of toCrop) {
      if (await cropView(v)) done++;
    }

    const totalCropped = Object.keys(croppedPreviews.value).length;
    if (withBox === 0 && totalCropped === 0) {
      addToast({ type: 'info', message: 'Could not detect bounding boxes in the photos. Showing full photos.' });
    } else if (done > 0 || totalCropped > 0) {
      hasCompletedAutoCrop.value = true;
      addToast({ type: 'success', message: `Cropped ${done || totalCropped} photo view${(done || totalCropped) === 1 ? '' : 's'}.` });
    }
  } finally {
    isCropping.value = false;
    hideLoader();
  }
}

// Run canvas auto-cropping ONCE when Step 2 opens (or on user click)
watch(step, (newStep) => {
  if (newStep === 2 && !hasAutoCroppedStep2.value) {
    hasAutoCroppedStep2.value = true;
    autoCropAll();
  }
});

// =========================================================================
// 5. SKU MEDIA PREPARATION FOR STORAGE & INVENTORY
// =========================================================================
function orderedViews(item: ParsedItem): ItemViewState[] {
  return [...item.views].sort((a, b) => (a.role === 'front' ? 0 : 1) - (b.role === 'front' ? 0 : 1));
}

async function uploadView(v: ItemViewState): Promise<string | null> {
  try {
    let blob = viewBlobs.get(v.key) || null;
    if (!blob && v.bounding_box) {
      if (await cropView(v)) blob = viewBlobs.get(v.key) || null;
    }
    if (!blob) blob = await fetchAssetBlob(galleryPhotos.value[v.image_index] || galleryPhotos.value[0]);
    if (!blob) return null;
    const file = new File([blob], `split-${v.role}-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
    const created = await storage.createFile(BUCKET_ID || 'item_images', ID.unique(), file);
    return created.$id;
  } catch (e) {
    console.warn('[LotSplitterWizard] View upload skipped:', e);
    return null;
  }
}

/** Uploads an item's front crop as imageId and all other views as galleryImageIds. */
async function resolveItemMedia(item: ParsedItem, primaryOnly = false): Promise<{ imageId: string | null; galleryIds: string[] }> {
  const views = orderedViews(item);
  if (views.length === 0) return { imageId: null, galleryIds: [] };
  const ids: (string | null)[] = [];
  for (const v of primaryOnly ? views.slice(0, 1) : views) ids.push(await uploadView(v));
  return { imageId: ids[0] || null, galleryIds: ids.slice(1).filter((x): x is string => !!x) };
}

/** Multi-qty / bundle SKUs: first item's full set + the front crop of each other item. */
async function resolveTierMedia(tierItems: ParsedItem[]): Promise<{ imageId: string | null; galleryIds: string[] }> {
  const first = await resolveItemMedia(tierItems[0]);
  const extra: string[] = [];
  for (const it of tierItems.slice(1, 8)) {
    const m = await resolveItemMedia(it, true);
    if (m.imageId) extra.push(m.imageId);
  }
  return { imageId: first.imageId, galleryIds: [...first.galleryIds, ...extra] };
}

// =========================================================================
// 6. LOT PARSING & TIERS INITIALIZATION
// =========================================================================
function parsePriceFromText(val: any): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const match = String(val).match(/\$?\s*(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

function closeWizard() {
  emit('close');
}

function getTierAiAverage(tierId: string): number {
  const items = allItems.value.filter(it => it.tierId === tierId);
  if (items.length === 0) return 0;
  const sum = items.reduce((s, it) => s + (it.customPrice || 0), 0);
  return Math.round((sum / items.length) * 2) / 2;
}

function initItemsFromLot() {
  const lot = props.lotItem;
  if (!lot) return;
  viewBlobs.clear();
  croppedPreviews.value = {};
  hasAutoCroppedStep2.value = false;

  // Reset tiers to defaults so state never leaks from a previously opened lot
  tiers.value = [
    { id: 'tier-1', name: '🌟 Tier 1: Showcase', mode: 'single', targetPrice: 55 },
    { id: 'tier-2', name: '📦 Tier 2: Core', mode: 'multi_qty', targetPrice: 22 },
    { id: 'tier-3', name: '⚡ Tier 3: Quick Turn', mode: 'multi_qty', targetPrice: 10 },
  ];

  // Auto-seed custom tiers directly from exitPlaybook if present
  if (lot.exitPlaybook) {
    const ep = lot.exitPlaybook;
    const customTiersList: CustomTier[] = [];
    if (ep.heroSingles && ep.heroSingles.length > 0) {
      const p = parsePriceFromText(ep.heroSingles[0].estPrice) || 55;
      customTiersList.push({
        id: 'tier-1',
        name: `🌟 Hero Singles (${ep.heroSingles[0].targetChannel || 'Showcase'})`,
        mode: 'single',
        targetPrice: p
      });
    } else {
      customTiersList.push({ id: 'tier-1', name: '🌟 Tier 1: Showcase', mode: 'single', targetPrice: 55 });
    }

    if (ep.themedCombines && ep.themedCombines.length > 0) {
      const p = parsePriceFromText(ep.themedCombines[0].estPrice) || 28;
      customTiersList.push({
        id: 'tier-2',
        name: `🎁 Themed Combine (${ep.themedCombines[0].title || 'Set'})`,
        mode: 'bundle',
        targetPrice: p
      });
    } else {
      customTiersList.push({ id: 'tier-2', name: '📦 Tier 2: Core', mode: 'multi_qty', targetPrice: 22 });
    }

    if (ep.remainderRuns && ep.remainderRuns.length > 0) {
      const p = parsePriceFromText(ep.remainderRuns[0].estPrice) || 12;
      customTiersList.push({
        id: 'tier-3',
        name: `⚡ Floor Fillers (${ep.remainderRuns[0].title || 'Grab Bag'})`,
        mode: 'multi_qty',
        targetPrice: p
      });
    } else {
      customTiersList.push({ id: 'tier-3', name: '⚡ Tier 3: Quick Turn', mode: 'multi_qty', targetPrice: 10 });
    }
    tiers.value = customTiersList;
  }

  const rawCandidates: ParsedItem[] = [];

  // Parse rawAnalysis or components
  let parsedRaw: any = null;
  try {
    if (typeof lot.rawAnalysis === 'string') parsedRaw = JSON.parse(lot.rawAnalysis);
    else if (typeof lot.rawAnalysis === 'object') parsedRaw = lot.rawAnalysis;
  } catch (e) {}

  const sourceItems = (parsedRaw?.lot_items && Array.isArray(parsedRaw.lot_items) && parsedRaw.lot_items.length > 0)
    ? parsedRaw.lot_items
    : (Array.isArray(lot.components) && lot.components.length > 0)
      ? lot.components
      : [];

  if (sourceItems.length > 0) {
    sourceItems.forEach((it: any, idx: number) => {
      const rawName = it.name || it.identity || it.title || `Lot Item #${idx + 1}`;
      const nameStr = rawName.replace(/\[Tier \d[^\]]*\]\s*/i, '').trim();
      // Each item keeps its OWN Boutique midpoint (never flattened to the tier average)
      const boutiqueMid = parsePriceValue(getSubItemBoutique(it), 'midpoint', 0);
      const fairMid = parsePriceFromText(it.estimated_value || it.price_breakdown?.fair);
      const ownPrice = boutiqueMid > 0 ? boutiqueMid : fairMid;

      let assignedTierId = 'tier-2';
      let defaultPrice = 22;
      if (it.tier === 'showcase' || it.is_key_issue || rawName.includes('Tier 1') || ownPrice >= 25) {
        assignedTierId = 'tier-1';
        defaultPrice = 55;
      } else if (it.tier === 'quick_turn' || rawName.includes('Tier 3') || (ownPrice > 0 && ownPrice < 15)) {
        assignedTierId = 'tier-3';
        defaultPrice = 10;
      }

      rawCandidates.push({
        index: idx,
        title: nameStr,
        tierId: assignedTierId,
        condition: it.condition || 'Used/Good',
        estimated_value: it.estimated_value || '$15 - $25',
        customPrice: ownPrice > 0 ? Math.round(ownPrice) : defaultPrice,
        isPriceOverridden: ownPrice > 0,
        image_url: it.image_url || lot.images?.[it.image_index || idx] || lot.images?.[0] || undefined,
        views: buildViews(it, idx)
      });
    });
  } else {
    // Fallback: Create N items based on lot quantity
    const count = Number(lot.quantity || 5);
    for (let i = 0; i < count; i++) {
      const assignedTierId = i === 0 ? 'tier-1' : (i < count - 2 ? 'tier-2' : 'tier-3');
      const defaultPrice = assignedTierId === 'tier-1' ? 45 : (assignedTierId === 'tier-2' ? 16 : 8);
      rawCandidates.push({
        index: i,
        title: `${lot.title || 'Lot Item'} #${i + 1}`,
        tierId: assignedTierId,
        condition: 'Used/Good',
        estimated_value: '$15 - $25',
        customPrice: defaultPrice,
        image_url: lot.images?.[i] || lot.images?.[0] || undefined,
        views: buildViews(null, i)
      });
    }
  }

  allItems.value = rawCandidates;

  // Auto-populate each tier's initial target price with the actual dynamic AI average
  tiers.value.forEach(t => {
    const avg = getTierAiAverage(t.id);
    if (avg > 0) {
      t.targetPrice = avg;
    }
  });

  // Default every item's price to its assigned tier's target price
  allItems.value.forEach(it => {
    const t = tiers.value.find(tier => tier.id === it.tierId);
    if (t && !it.isPriceOverridden) {
      it.customPrice = t.targetPrice;
    }
  });

  // Distinct titles (or a "Split into N Singles" playbook) => Tier 2 defaults to Single Items
  const t2 = tiers.value.find(t => t.id === 'tier-2');
  const t2Items = allItems.value.filter(it => it.tierId === 'tier-2');
  const distinct = t2Items.length > 0 && new Set(t2Items.map(it => it.title.trim().toLowerCase())).size === t2Items.length;
  let playbookSingles = false;
  try { playbookSingles = /split\s+into\s+\d+\s+singles?/i.test(JSON.stringify(lot.exitPlaybook || {})); } catch (e) {}
  if (t2 && t2.mode === 'multi_qty' && (distinct || playbookSingles)) t2.mode = 'single';
}

let currentLotId: string | null = null;

// Initialize items from lotItem (Runs AFTER all state and functions are initialized)
watch(() => props.lotItem, (lot) => {
  if (lot) {
    const newId = lot.$id || lot.id || null;
    if (newId && newId === currentLotId) {
      // Same lot item updated in-place (e.g. background save or auto-crop update).
      // DO NOT reset step, tiers, or custom prices!
      return;
    }
    currentLotId = newId;
    step.value = 1;
    selectedItemIndices.value.clear();
    initItemsFromLot();
  }
}, { immediate: true });

// Computeds & Helpers

const totalCost = computed(() => {
  return parseFloat(props.lotItem?.cost || props.lotItem?.purchasePrice || '0') || 0;
});

const totalItemCount = computed(() => allItems.value.length);

const filteredItems = computed(() => {
  if (activeFilterTab.value === 'all') return allItems.value;
  return allItems.value.filter(it => it.tierId === activeFilterTab.value);
});

function getTierItemCount(tierId: string) {
  return allItems.value.filter(it => it.tierId === tierId).length;
}

function getTierIndex(tierId: string) {
  return tiers.value.findIndex(t => t.id === tierId);
}

function getTierShortName(tierId: string) {
  const t = tiers.value.find(t => t.id === tierId);
  if (!t) return 'Tier';
  return t.name.split(':')[0] || t.name;
}

function getTierBadgeClass(idx: number) {
  const classes = [
    'badge-primary text-primary-content',
    'badge-secondary text-secondary-content',
    'badge-accent text-accent-content',
    'badge-info text-info-content',
    'badge-warning text-warning-content'
  ];
  return classes[idx % classes.length];
}

function getTierDotClass(idx: number) {
  const classes = [
    'bg-primary',
    'bg-secondary',
    'bg-accent',
    'bg-info',
    'bg-warning'
  ];
  return classes[idx % classes.length];
}

// User Actions
function addCustomTier() {
  const nextNum = tiers.value.length + 1;
  tiers.value.push({
    id: `tier-${Date.now()}`,
    name: `Tier ${nextNum}: Custom Batch`,
    mode: 'multi_qty',
    targetPrice: 12
  });
}

function removeTier(idx: number) {
  const removed = tiers.value[idx];
  tiers.value.splice(idx, 1);
  const fallbackTierId = tiers.value[0]?.id || 'tier-1';
  allItems.value.forEach(it => {
    if (it.tierId === removed.id) it.tierId = fallbackTierId;
  });
}

function onTierPriceInput(tier: CustomTier) {
  allItems.value.forEach(it => {
    if (it.tierId === tier.id && !it.isPriceOverridden) {
      it.customPrice = tier.targetPrice;
    }
  });
}

function assignItemToTier(itemIndex: number, tierId: string) {
  const it = allItems.value.find(i => i.index === itemIndex);
  if (it) {
    it.tierId = tierId;
    if (!it.isPriceOverridden) {
      const targetTier = tiers.value.find(t => t.id === tierId);
      if (targetTier) it.customPrice = targetTier.targetPrice;
    }
  }
}

function toggleSelect(itemIndex: number) {
  if (selectedItemIndices.value.has(itemIndex)) selectedItemIndices.value.delete(itemIndex);
  else selectedItemIndices.value.add(itemIndex);
}

function moveSelectedToTier(tierId: string) {
  selectedItemIndices.value.forEach(idx => {
    assignItemToTier(idx, tierId);
  });
  selectedItemIndices.value.clear();
}

// Financial calculations & Reconciled Yields
function getTierTotalYield(tier: CustomTier): number {
  const items = allItems.value.filter(it => it.tierId === tier.id);
  if (items.length === 0) return 0;
  if (tier.mode === 'single') {
    return items.reduce((sum, it) => sum + (it.customPrice || tier.targetPrice), 0);
  }
  return items.length * tier.targetPrice;
}

function getTierDisplayPrice(tier: CustomTier): string {
  const items = allItems.value.filter(it => it.tierId === tier.id);
  if (items.length === 0) return `$${tier.targetPrice.toFixed(2)}/ea`;
  if (tier.mode === 'single') {
    const prices = items.map(it => it.customPrice || tier.targetPrice);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    if (minP === maxP) return `$${minP.toFixed(2)}/ea`;
    return `$${minP.toFixed(0)} - $${maxP.toFixed(0)}/ea`;
  }
  return `$${tier.targetPrice.toFixed(2)}/ea`;
}

const projectedGrossSales = computed(() => {
  return tiers.value.reduce((sum, t) => sum + getTierTotalYield(t), 0);
});

const projectedNetProfit = computed(() => {
  // Approximate after 12% memory den booth fee
  const netRevenue = projectedGrossSales.value * 0.88;
  return netRevenue - totalCost.value;
});

function getTierCostBasis(tier: CustomTier) {
  const count = getTierItemCount(tier.id);
  if (count === 0) return 0;

  if (costAllocationMode.value === 'equal') {
    return totalCost.value / (totalItemCount.value || 1);
  } else {
    // Weighted by actual tier yield
    const totalPotential = projectedGrossSales.value;
    if (totalPotential === 0) return 0;
    const tierYield = getTierTotalYield(tier);
    return (totalCost.value * (tierYield / totalPotential)) / count;
  }
}

const singleItemCount = computed(() => {
  return tiers.value.filter(t => t.mode === 'single').reduce((sum, t) => sum + getTierItemCount(t.id), 0);
});

const multiQtyListingCount = computed(() => {
  return tiers.value.filter(t => t.mode === 'multi_qty' && getTierItemCount(t.id) > 0).length;
});

const bundleListingCount = computed(() => {
  return tiers.value.filter(t => t.mode === 'bundle' && getTierItemCount(t.id) > 0).length;
});

const totalGeneratedListingCount = computed(() => {
  return singleItemCount.value + multiQtyListingCount.value + bundleListingCount.value;
});

function extractFileId(urlOrId?: string): string | null {
  if (!urlOrId) return null;
  if (/^[a-zA-Z0-9_-]{10,}$/.test(urlOrId) && !urlOrId.includes('/')) return urlOrId;
  const match = urlOrId.match(/\/files\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// -------------------------------------------------------------
// EXECUTE GENERATION INTO APPWRITE
// -------------------------------------------------------------
async function executeSplit() {
  const orgId = currentTeam.value?.$id;
  if (!databases || !orgId) {
    addToast({ type: 'error', message: 'Database not initialized or unauthenticated.' });
    return;
  }

  isSubmitting.value = true;
  try {
    const parent = props.lotItem;
    const parentDocId = parent.$id || parent.id;

    // 0. Clean up any existing split children for this parent lot to prevent duplicates on re-split
    if (parentDocId) {
      try {
        const existingChildren = await databases.listDocuments(DB_ID, getCollectionId(), [
          Query.equal('parentLotId', parentDocId),
          Query.limit(100)
        ]);
        for (const child of existingChildren.documents) {
          await databases.deleteDocument(DB_ID, getCollectionId(), child.$id);
        }
      } catch (cleanupErr) {
        console.warn('Old children cleanup check passed:', cleanupErr);
      }
    }

    // 1. Calculate starting sequential UPC barcode prefix
    const prefix = (currentTeam.value as any)?.prefs?.upcPrefix || (user.value as any)?.prefs?.upcPrefix || 'HUCK';

    // Helper to get clean brand/subject for retail booth tags
    const getCleanParentSubject = (parentTitle: string): string => {
      return (parentTitle || 'Vintage Lot')
        .replace(/^Combined Lot of \d+:\s*/i, '')
        .replace(/^Lot of \d+:\s*/i, '')
        .replace(/\b(Lot|Collection|Bundle)\b/gi, '')
        .replace(/[:\-–—]\s*$/, '')
        .trim() || 'Inventory Item';
    };

    const cleanSubject = getCleanParentSubject(parent.title);

    // 2. Create Documents for each tier
    let createdCount = 0;
    const createdDocs: any[] = [];
    const targetLocation = parent.storageLocation || 'HG';
    const isRetailBooth = /^(MD|DT)\b/i.test(targetLocation);
    const childStatus = isRetailBooth ? 'placed' : 'received';

    for (const tier of tiers.value) {
      const tierItems = allItems.value.filter(it => it.tierId === tier.id);
      if (tierItems.length === 0) continue;

      const unitCost = getTierCostBasis(tier);

      if (tier.mode === 'single') {
        // Create 1 document per item with individual custom price & unique UPC
        for (const item of tierItems) {
          const itemUpc = await generateNextUpc(prefix);
          const media = await resolveItemMedia(item);
          const mainImgId = media.imageId || extractFileId(item.image_url) || extractFileId(parent.images?.[0]) || parent.imageId || null;
          const individualPrice = item.customPrice || tier.targetPrice;
          const createdDoc = await databases.createDocument(DB_ID, getCollectionId(), ID.unique(), {
            tenantId: orgId || undefined,
            purchaseId: parent.purchaseId || undefined,
            upc: itemUpc,
            title: (item.title || 'Split Item').slice(0, 250),
            identity: (item.title || itemUpc).slice(0, 950),
            cost: Number(unitCost.toFixed(2)),
            resalePrice: Number(individualPrice.toFixed(2)),
            quantity: 1,
            conditionNotes: `Deconstructed from: ${cleanSubject || parent.title || 'Collection'}`.slice(0, 950),
            imageId: mainImgId || undefined,
            galleryImageIds: media.galleryIds.length > 0 ? media.galleryIds : undefined,
            storageLocation: targetLocation,
            sourcingLocation: parent.sourcingLocation || '',
            parentLotId: parentDocId || undefined,
            status: childStatus
          });
          createdCount++;
          createdDocs.push(createdDoc);

          // Only fall back to cloning the parent photo when no crop/upload was produced
          if (!media.imageId && mainImgId && createdDoc?.$id) {
            duplicateItemMediaInStorage({ imageId: mainImgId }, { copyAll: false }).then(async (deepMedia) => {
              if (deepMedia.imageId && deepMedia.imageId !== mainImgId) {
                await updateInventoryItem(createdDoc.$id, { imageId: deepMedia.imageId });
              }
            }).catch(e => console.warn('[LotSplitterWizard] Background media clone skipped:', e));
          }
        }
      } else if (tier.mode === 'multi_qty') {
        // Create 1 multi-quantity document (Memory Den SKU) & unique UPC
        const itemUpc = await generateNextUpc(prefix);
        const issueListNotes = tierItems.map((it, i) => `${i + 1}. ${it.title}`).join('\n');
        const tierMedia = await resolveTierMedia(tierItems);
        const firstImgId = tierMedia.imageId || extractFileId(tierItems[0]?.image_url) || extractFileId(parent.images?.[0]) || parent.imageId || null;
        
        let retailTitle = `${cleanSubject} - Choice Issues`;
        if (tier.id === 'tier-3' || tier.name.toLowerCase().includes('reader') || tier.name.toLowerCase().includes('clearance')) {
          retailTitle = `${cleanSubject} - Reader / Clearance`;
        }

        const totalTierCost = unitCost * tierItems.length;

        const createdDoc = await databases.createDocument(DB_ID, getCollectionId(), ID.unique(), {
          tenantId: orgId || undefined,
          purchaseId: parent.purchaseId || undefined,
          upc: itemUpc,
          title: `${retailTitle} (Qty: ${tierItems.length})`.slice(0, 250),
          identity: `${retailTitle} (Qty: ${tierItems.length})`.slice(0, 950),
          cost: Number(totalTierCost.toFixed(2)),
          resalePrice: Number(tier.targetPrice.toFixed(2)),
          quantity: tierItems.length,
          conditionNotes: `Multi-Quantity Lot Run:\n${issueListNotes}`.slice(0, 950),
          imageId: firstImgId || undefined,
          galleryImageIds: tierMedia.galleryIds.length > 0 ? tierMedia.galleryIds : undefined,
          storageLocation: targetLocation,
          sourcingLocation: parent.sourcingLocation || '',
          parentLotId: parentDocId || undefined,
          status: childStatus
        });
        createdCount++;
        createdDocs.push(createdDoc);

        if (!tierMedia.imageId && firstImgId && createdDoc?.$id) {
          duplicateItemMediaInStorage({ imageId: firstImgId }, { copyAll: false }).then(async (deepMedia) => {
            if (deepMedia.imageId && deepMedia.imageId !== firstImgId) {
              await updateInventoryItem(createdDoc.$id, { imageId: deepMedia.imageId });
            }
          }).catch(e => console.warn('[LotSplitterWizard] Background media clone skipped:', e));
        }
      } else if (tier.mode === 'bundle') {
        // Create 1 bundled lot set document & unique UPC
        const itemUpc = await generateNextUpc(prefix);
        const bundleTotal = tier.targetPrice * tierItems.length;
        const totalBundleCost = unitCost * tierItems.length;
        const issueListNotes = tierItems.map((it, i) => `${i + 1}. ${it.title}`).join('\n');
        const tierMedia = await resolveTierMedia(tierItems);
        const firstImgId = tierMedia.imageId || extractFileId(tierItems[0]?.image_url) || extractFileId(parent.images?.[0]) || parent.imageId || null;
        const createdDoc = await databases.createDocument(DB_ID, getCollectionId(), ID.unique(), {
          tenantId: orgId || undefined,
          purchaseId: parent.purchaseId || undefined,
          upc: itemUpc,
          title: `${cleanSubject} - Set of ${tierItems.length}`.slice(0, 250),
          identity: `${cleanSubject} - Set of ${tierItems.length}`.slice(0, 950),
          cost: Number(totalBundleCost.toFixed(2)),
          resalePrice: Number(bundleTotal.toFixed(2)),
          quantity: 1,
          conditionNotes: `Curated Mini-Lot Set:\n${issueListNotes}`.slice(0, 950),
          imageId: firstImgId || undefined,
          galleryImageIds: tierMedia.galleryIds.length > 0 ? tierMedia.galleryIds : undefined,
          storageLocation: targetLocation,
          sourcingLocation: parent.sourcingLocation || '',
          parentLotId: parentDocId || undefined,
          status: childStatus
        });
        createdCount++;
        createdDocs.push(createdDoc);

        if (!tierMedia.imageId && firstImgId && createdDoc?.$id) {
          duplicateItemMediaInStorage({ imageId: firstImgId }, { copyAll: false }).then(async (deepMedia) => {
            if (deepMedia.imageId && deepMedia.imageId !== firstImgId) {
              await updateInventoryItem(createdDoc.$id, { imageId: deepMedia.imageId });
            }
          }).catch(e => console.warn('[LotSplitterWizard] Background media clone skipped:', e));
        }
      }
    }

    // 2. Mark parent lot as Deconstructed / Curated
    if (parentDocId) {
      const existingNotes = parent.conditionNotes || parent.condition_notes || '';
      await databases.updateDocument(DB_ID, getCollectionId(), parentDocId, {
        status: 'deconstructed',
        conditionNotes: `${existingNotes}\n[Deconstructed into ${createdCount} curated tier listings]`.trim()
      });
    }

    addToast({
      type: 'success',
      message: `🎉 Successfully generated ${createdCount} crated inventory listings ready for booth tagging!`
    });

    emit('completed', { parentId: parentDocId, createdDocs });
    closeWizard();
  } catch (err: any) {
    console.error('[LotSplitterWizard Error]:', err);
    addToast({ type: 'error', message: 'Failed to split lot: ' + err.message });
  } finally {
    isSubmitting.value = false;
  }
}
</script>

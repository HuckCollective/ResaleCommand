<template>
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        <!-- ================================================================= -->
        <!-- LEFT COLUMN: Physical Item & Logistics (Priority Order)          -->
        <!-- ================================================================= -->
        <div class="lg:col-span-6 space-y-5">
            
            <!-- 🔗 Subtle Lot Connection Badges (Clean & Compact) -->
            <div v-if="item?.parentLotId" class="flex items-center justify-between bg-primary/10 border border-primary/25 rounded-2xl px-3.5 py-2 text-xs shadow-2xs">
                <div class="flex items-center gap-2 min-w-0">
                    <Icon icon="solar:link-circle-bold" class="w-4 h-4 text-primary shrink-0" />
                    <span class="opacity-70 text-[11px] shrink-0">Extracted From:</span>
                    <strong class="truncate font-mono text-base-content">{{ parentItem?.title || parentItem?.upc || item.parentLotId }}</strong>
                </div>
                <button type="button" @click="$emit('open-lot-tab')" class="btn btn-ghost btn-xs text-primary font-bold hover:underline shrink-0 gap-1">
                    <span>Lot Hub</span>
                    <Icon icon="solar:arrow-right-linear" class="w-3 h-3" />
                </button>
            </div>

            <div v-else-if="lotChildren && lotChildren.length > 0" class="flex items-center justify-between bg-secondary/10 border border-secondary/25 rounded-2xl px-3.5 py-2 text-xs shadow-2xs">
                <div class="flex items-center gap-2 min-w-0">
                    <Icon icon="solar:box-minimalistic-bold" class="w-4 h-4 text-secondary shrink-0" />
                    <span class="opacity-70 text-[11px] shrink-0">Master Lot:</span>
                    <strong class="font-bold text-secondary">{{ lotChildren.length }} Split Listings Active</strong>
                </div>
                <button type="button" @click="$emit('open-lot-tab')" class="btn btn-ghost btn-xs text-secondary font-bold hover:underline shrink-0 gap-1">
                    <span>Manage in Lot Hub</span>
                    <Icon icon="solar:arrow-right-linear" class="w-3 h-3" />
                </button>
            </div>

            <!-- 1. 🏷️ TITLE & IDENTITY (TOP PRIORITY) -->
            <div class="bg-base-200/50 rounded-2xl p-4 border border-base-300 space-y-3">
                <div class="flex justify-between items-center">
                    <label class="font-bold text-xs uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
                        <Icon icon="solar:text-bold" class="w-4 h-4 text-primary" />
                        Item Title & Identity
                    </label>
                    <div class="flex items-center gap-1.5">
                        <!-- Persistent Multi-Tier Lot Splitter Button -->
                        <button 
                            v-if="item && (Number(editForm.quantity || item.quantity || 1) > 1 || (scoutItemsArray && scoutItemsArray.length > 1) || editForm.title?.toLowerCase().includes('lot') || editForm.title?.toLowerCase().includes('bundle'))"
                            type="button" 
                            class="btn btn-xs btn-primary gap-1 font-bold shadow-xs hover:scale-105 transition-all"
                            @click="$emit('open-splitter')"
                        >
                            <Icon icon="solar:magic-stick-3-bold" class="w-3.5 h-3.5" />
                            <span>✨ Multi-Tier Splitter</span>
                        </button>

                        <span v-if="item?.sku || item?.upc" class="badge badge-sm font-mono font-bold bg-base-300">
                            {{ item.sku || item.upc }}
                        </span>
                        <span class="text-[11px] opacity-50 font-mono">{{ editForm.title?.length || 0 }} chars</span>
                    </div>
                </div>
                <button 
                    v-if="suggestedTitleStr && suggestedTitleStr !== editForm.title" 
                    type="button" 
                    class="btn btn-xs btn-outline btn-secondary font-normal w-full text-left h-auto py-1.5 px-3 justify-start items-start rounded-xl shadow-xs"
                    @click="editForm.title = suggestedTitleStr" 
                    title="Click to use AI suggested title"
                >
                    <Icon icon="solar:magic-stick-linear" class="w-3.5 h-3.5 shrink-0 mt-0.5" /> 
                    <span class="whitespace-normal break-words leading-tight text-xs"><strong>Use:</strong> {{ suggestedTitleStr }}</span>
                </button>

                <div class="join w-full flex shadow-xs">
                    <textarea 
                        v-model="editForm.title" 
                        class="textarea textarea-bordered join-item grow font-bold text-sm sm:text-base leading-snug min-h-[3.2rem] py-2 resize-none bg-base-100" 
                        rows="2" 
                        placeholder="Brand, Item Name, Model, Edition, Sizing...">
                    </textarea>
                    <button class="btn join-item border border-base-300 h-auto px-3 flex items-center justify-center hover:bg-base-200" @click="$emit('copy-title')" title="Copy Title">
                        <Icon icon="solar:copy-linear" class="w-4 h-4" />
                    </button>
                </div>
            </div>

            <!-- 2. 📸 PHOTOS & SOURCING MEDIA -->
            <div class="bg-base-200/50 rounded-2xl p-4 border border-base-300 space-y-3.5">
                <slot name="gallery-manager"></slot>

                <!-- Sourcing URL & Image Scraper Bar -->
                <div class="form-control">
                    <div class="join w-full shadow-xs">
                        <input 
                            type="text" 
                            v-model="editForm.sourcingLocation" 
                            placeholder="Paste ShopGoodwill Item # or Listing URL..." 
                            class="input input-bordered input-sm join-item grow font-mono text-xs bg-base-100 rounded-l-xl h-10" 
                            @keydown.enter.prevent="$emit('fetch-source-data')"
                        />
                        <button 
                            class="btn btn-primary btn-sm join-item shrink-0 gap-1.5 font-bold rounded-r-xl h-10 px-4" 
                            @click="$emit('fetch-source-data')" 
                            :disabled="!editForm.sourcingLocation || fetchingImages" 
                            title="Fetch photos & metadata from listing"
                        >
                            <span v-if="fetchingImages" class="loading loading-spinner loading-xs"></span>
                            <Icon v-else icon="solar:cloud-download-bold" class="w-4 h-4" />
                            <span>Fetch</span>
                        </button>
                    </div>
                </div>

                <!-- 📸 Fetched Listing Photos Tray (Pick & Add) -->
                <div v-if="fetchedImages && fetchedImages.length > 0" class="bg-base-100 rounded-xl p-3 border border-primary/40 shadow-md space-y-2.5 transition-all">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-1.5">
                            <span class="badge badge-primary badge-sm font-bold shadow-xs">{{ fetchedImages.length }}</span>
                            <span class="text-xs font-bold text-base-content">Fetched Photos Available</span>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <button 
                                type="button" 
                                @click="$emit('add-all-fetched-images')" 
                                class="btn btn-xs btn-primary gap-1 font-bold shadow-xs"
                                title="Add all fetched photos to gallery"
                            >
                                <Icon icon="solar:gallery-add-bold" class="w-3.5 h-3.5" />
                                <span>Add All</span>
                            </button>
                            <button 
                                type="button" 
                                @click="$emit('dismiss-fetched-images')" 
                                class="btn btn-xs btn-ghost btn-circle opacity-60 hover:opacity-100"
                                title="Dismiss fetched photos"
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    <!-- Image Grid -->
                    <div class="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2.5 max-h-64 overflow-y-auto p-1.5 rounded-xl bg-base-200/60 border border-base-300">
                        <div 
                            v-for="(imgUrl, idx) in fetchedImages" 
                            :key="idx"
                            class="group relative aspect-square w-full rounded-xl border-2 border-base-300 overflow-hidden bg-base-100 shadow-xs hover:border-primary transition-all flex items-center justify-center cursor-pointer"
                        >
                            <img 
                                :src="proxify(typeof imgUrl === 'string' ? imgUrl : imgUrl.url)" 
                                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                loading="lazy"
                            />
                            
                            <!-- Downloading Spinner Overlay -->
                            <div 
                                v-if="downloadingImageUrls && downloadingImageUrls[typeof imgUrl === 'string' ? imgUrl : imgUrl.url]" 
                                class="absolute inset-0 bg-base-300/80 backdrop-blur-xs flex items-center justify-center z-20"
                            >
                                <span class="loading loading-spinner loading-xs text-primary"></span>
                            </div>

                            <!-- Hover Actions -->
                            <div class="absolute inset-0 bg-neutral/80 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1 z-10">
                                <button 
                                    type="button"
                                    class="btn btn-xs btn-primary w-full text-[10px] h-6 min-h-0 px-1 font-bold shadow-xs gap-0.5"
                                    @click.stop="$emit('select-fetched-image', typeof imgUrl === 'string' ? imgUrl : imgUrl.url, false)"
                                    title="Add to gallery"
                                >
                                    <Icon icon="solar:add-circle-bold" class="w-3 h-3" />
                                    <span>+ Gallery</span>
                                </button>
                                <button 
                                    type="button"
                                    class="btn btn-xs btn-warning w-full text-[10px] h-6 min-h-0 px-1 font-bold shadow-xs gap-0.5"
                                    @click.stop="$emit('select-fetched-image', typeof imgUrl === 'string' ? imgUrl : imgUrl.url, true)"
                                    title="Set as main photo"
                                >
                                    <Icon icon="solar:star-bold" class="w-3 h-3" />
                                    <span>Set Main</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    <p class="text-[10px] text-base-content/60 text-center font-medium">Click <strong>+ Gallery</strong> to add or <strong>Set Main ⭐</strong> to pick photo</p>
                </div>
            </div>

            <!-- 3. 🛡️ ACQUISITION & BASE COST (PROTECTED / LOCKABLE) -->
            <div class="bg-base-200/70 rounded-2xl p-4 border border-base-300 relative shadow-sm">
                <div class="flex justify-between items-center border-b border-base-300 pb-2.5 mb-3">
                    <div class="flex items-center gap-2">
                        <div class="w-6 h-6 rounded-md bg-warning/15 flex items-center justify-center text-warning font-bold">
                            <Icon icon="solar:shield-check-bold" class="w-3.5 h-3.5" />
                        </div>
                        <div>
                            <h4 class="font-bold text-xs uppercase tracking-wider text-base-content">Acquisition & Base Cost</h4>
                            <p class="text-[10px] opacity-60">Protected sourcing provenance</p>
                        </div>
                    </div>

                    <!-- Lock / Unlock Toggle Button -->
                    <button 
                        type="button" 
                        class="btn btn-xs gap-1 font-bold transition-all shadow-xs" 
                        :class="isAcquisitionUnlocked ? 'btn-warning text-warning-content' : 'btn-outline btn-ghost opacity-70 hover:opacity-100'"
                        @click="$emit('update:isAcquisitionUnlocked', !isAcquisitionUnlocked)"
                        title="Toggle lock to protect original purchase cost and order ID"
                    >
                        <Icon :icon="isAcquisitionUnlocked ? 'solar:lock-unlocked-bold' : 'solar:lock-bold'" class="w-3.5 h-3.5" />
                        <span>{{ isAcquisitionUnlocked ? 'Unlocked' : 'Locked' }}</span>
                    </button>
                </div>

                <!-- Read-Only Locked View (Default) -->
                <div v-if="!isAcquisitionUnlocked && item" class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs bg-base-100/70 p-3 rounded-xl border border-base-200">
                    <div>
                        <span class="text-[10px] opacity-50 block font-bold uppercase">Buy Cost</span>
                        <span class="font-mono font-bold text-sm text-base-content">${{ Number(editForm.cost || 0).toFixed(2) }}</span>
                    </div>
                    <div>
                        <span class="text-[10px] opacity-50 block font-bold uppercase">Order #</span>
                        <a 
                            v-if="editForm.orderId || item?.purchaseId || item?.cartId" 
                            :href="`/purchases/${editForm.orderId || item?.purchaseId || item?.cartId}`" 
                            target="_blank" 
                            class="font-mono font-bold text-primary hover:underline truncate flex items-center gap-1 text-xs"
                            :title="`Open ${editForm.orderId || 'Purchase Order'} details`"
                        >
                            <span class="truncate">{{ editForm.orderId || 'View PO' }}</span>
                            <Icon icon="solar:arrow-right-up-linear" class="w-3 h-3 shrink-0 opacity-70" />
                        </a>
                        <span v-else class="font-mono font-semibold truncate block opacity-50">None</span>
                    </div>
                    <div class="col-span-2 sm:col-span-1 flex flex-col justify-center">
                        <span class="text-[10px] opacity-50 block font-bold uppercase">Sourcing Origin</span>
                        <a 
                            v-if="editForm.sourcingLocation && editForm.sourcingLocation.startsWith('http')" 
                            :href="editForm.sourcingLocation" 
                            target="_blank" 
                            class="text-primary link font-bold flex items-center gap-1 truncate text-xs"
                            title="Open Sourcing Source Link"
                        >
                            <span class="truncate">{{ editForm.sourcingLocation.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] }}</span>
                            <Icon icon="solar:arrow-right-up-linear" class="w-3 h-3 shrink-0 opacity-70" />
                        </a>
                        <span v-else-if="editForm.sourcingLocation" class="font-bold text-xs truncate">
                            {{ editForm.sourcingLocation }}
                        </span>
                        <span v-else class="opacity-40 italic text-[11px]">Direct Entry</span>
                    </div>
                </div>

                <!-- Editable Unlocked Form -->
                <div v-else class="space-y-3">
                    <div class="grid grid-cols-2 gap-3">
                        <div class="form-control">
                            <label class="label py-0.5"><span class="label-text text-xs font-bold">Buy Cost Basis ($)</span></label>
                            <div class="relative">
                                <span class="absolute left-3 top-1/2 -translate-y-1/2 opacity-50 font-bold text-xs">$</span>
                                <input type="number" step="0.01" v-model="editForm.cost" placeholder="0.00" class="input input-bordered input-sm w-full pl-6 font-mono font-bold bg-base-100" />
                            </div>
                        </div>
                        <div class="form-control">
                            <label class="label py-0.5 flex items-center justify-between">
                                <span class="label-text text-xs font-bold">Order / Invoice #</span>
                                <a 
                                    v-if="editForm.orderId" 
                                    :href="`/purchases?search=${encodeURIComponent(editForm.orderId)}`" 
                                    target="_blank" 
                                    class="text-[10px] text-primary font-bold hover:underline flex items-center gap-0.5"
                                    title="Open PO in Purchases"
                                >
                                    <Icon icon="solar:link-minimalistic-bold" class="w-3 h-3" /> View PO
                                </a>
                            </label>
                            <input type="text" v-model="editForm.orderId" placeholder="e.g. SGW-84920" class="input input-bordered input-sm w-full font-mono text-xs bg-base-100" />
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div class="form-control">
                            <label class="label py-0.5"><span class="label-text text-xs font-bold">Origin / Provenance</span></label>
                            <input type="text" v-model="editForm.countryOfOrigin" placeholder="e.g. USA, Japan, Estate Sale" class="input input-bordered input-sm w-full text-xs bg-base-100" />
                        </div>
                        <div class="form-control">
                            <label class="label py-0.5"><span class="label-text text-xs font-bold">Sourcing Origin / Link</span></label>
                            <input type="text" v-model="editForm.sourcingLocation" placeholder="e.g. ShopGoodwill, CTBids, URL..." class="input input-bordered input-sm w-full font-mono text-xs bg-base-100" />
                        </div>
                    </div>
                    <div class="form-control">
                        <label class="label py-0.5 flex items-center justify-between">
                            <span class="label-text text-xs font-bold">Parent Lot ID</span>
                            <span v-if="editForm.parentLotId" class="badge badge-xs badge-secondary font-bold">Extracted</span>
                        </label>
                        <div class="join w-full shadow-xs">
                            <input type="text" :value="editForm.parentLotId || 'None'" disabled class="input input-bordered input-sm join-item grow text-xs bg-base-200/60 font-mono opacity-80" />
                            <button 
                                v-if="editForm.parentLotId" 
                                type="button" 
                                @click="editForm.parentLotId = null" 
                                class="btn btn-sm btn-outline btn-error join-item font-bold text-xs" 
                                title="Unlink and make standalone"
                            >
                                Unlink
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 4. 💲 PRICING, MARGIN & MULTI-QUANTITY SPLITTING -->
            <div class="bg-base-200/50 rounded-2xl p-4 border border-base-300 space-y-3">
                <div class="flex justify-between items-center">
                    <label class="font-bold text-xs uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
                        <Icon icon="solar:dollar-bold" class="w-4 h-4 text-success" />
                        Pricing & Margin
                    </label>

                    <!-- Margin Indicator -->
                    <div v-if="calculatedMargin !== null" class="badge badge-sm font-mono font-bold" :class="calculatedMargin >= 50 ? 'badge-success text-white' : (calculatedMargin >= 20 ? 'badge-warning' : 'badge-error')">
                        {{ calculatedMargin }}% Est. Margin
                    </div>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 items-start">
                    <!-- Quantity -->
                    <div class="form-control">
                        <label class="label py-0.5"><span class="label-text text-xs font-bold">Quantity</span></label>
                        <input type="number" step="1" min="1" v-model.number="editForm.quantity" class="input input-bordered input-sm w-full text-center font-bold font-mono bg-base-100" />
                    </div>

                    <!-- List Price -->
                    <div class="form-control">
                        <label class="label py-0.5 flex justify-between">
                            <span class="label-text text-xs font-bold">List Price</span>
                        </label>
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 opacity-50 font-bold text-xs">$</span>
                            <input type="number" step="0.01" v-model="editForm.resalePrice" placeholder="0.00" class="input input-bordered input-sm w-full pl-6 font-mono font-bold bg-base-100" />
                        </div>
                    </div>

                    <!-- Sold Price -->
                    <div class="form-control">
                        <label class="label py-0.5"><span class="label-text text-xs font-bold text-success">Sold Price</span></label>
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 opacity-50 font-bold text-xs">$</span>
                            <input type="number" step="0.01" v-model="editForm.soldPrice" placeholder="0.00" class="input input-bordered input-sm w-full pl-6 font-mono font-bold bg-base-100" :class="{'border-success ring-1 ring-success': editForm.status === 'sold'}" />
                        </div>
                    </div>

                    <!-- Estimated Comps Range -->
                    <div class="form-control">
                        <label class="label py-0.5"><span class="label-text text-[11px] opacity-60">Est. Range</span></label>
                        <div class="text-xs font-mono font-bold bg-base-100 p-1.5 rounded-lg border border-base-300 text-center truncate">
                            <span v-if="editForm.estLow || editForm.estHigh">${{ editForm.estLow || '0' }} - ${{ editForm.estHigh || '0' }}</span>
                            <span v-else class="opacity-40 font-normal">--</span>
                        </div>
                    </div>
                </div>

                <!-- Multi-Quantity Splitting Actions Bar -->
                <div v-if="item && Number(editForm.quantity) > 1" class="border border-secondary/30 bg-secondary/5 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 mt-2">
                    <div class="text-[11px] font-bold text-secondary flex items-center gap-1">
                        <Icon icon="solar:box-minimalistic-bold" class="w-4 h-4" />
                        <span>Multi-Quantity Batch ({{ editForm.quantity }} Units)</span>
                    </div>
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <button @click.prevent="$emit('sell-one-quantity')" class="btn btn-xs btn-success font-bold gap-1 shadow-xs" title="Log sale of 1 unit and subtract cost">
                            <Icon icon="solar:cart-check-linear" class="w-3.5 h-3.5" /> Sell 1 Unit
                        </button>
                        <button @click.prevent="$emit('split-one-active')" class="btn btn-xs btn-outline btn-secondary font-bold gap-1 shadow-xs" title="Extract 1 unit as a new active inventory item">
                            <Icon icon="solar:scissors-linear" class="w-3.5 h-3.5" /> Split 1 Active
                        </button>
                    </div>
                </div>
            </div>

            <!-- 5. 📍 STORAGE LOCATION & STATUS -->
            <div class="bg-base-200/50 rounded-2xl p-4 border border-base-300 space-y-3">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                    <!-- Warehouse / Facility -->
                    <div class="form-control">
                        <label class="label py-0 h-6 flex items-center justify-between">
                            <span class="label-text text-xs font-bold">Warehouse / Facility</span>
                        </label>
                        <select v-model="selectedFacility" class="select select-bordered select-sm w-full h-8 min-h-8 font-bold text-xs bg-base-100">
                            <option value="HG">Huck's Garage (HG)</option>
                            <option value="HD">Hideout (HD)</option>
                            <option value="MD">Memory Den - Huck's Adventures Outfitters (MD)</option>
                            <option value="DT">Dusty Tiger (DT)</option>
                            <option value="__custom__">Custom / Other Location...</option>
                        </select>
                    </div>

                    <!-- Bin / Shelf Location -->
                    <div class="form-control" v-if="selectedFacility !== '__custom__'">
                        <label class="label py-0 h-6 flex items-center justify-between">
                            <span class="label-text text-xs font-bold">Storage (Bin / Shelf)</span>
                            <span v-if="editForm.storageLocation" class="text-[10px] font-mono font-bold badge badge-xs badge-primary leading-none">
                                {{ editForm.storageLocation }}
                            </span>
                        </label>
                        <input 
                            type="text" 
                            v-model="facilityBin" 
                            list="facility-bins-list"
                            placeholder="e.g. RED BIN-16, 04..." 
                            class="input input-bordered input-sm w-full h-8 min-h-8 font-mono text-xs bg-base-100 uppercase"
                        />
                        <datalist id="facility-bins-list">
                            <option v-for="bin in availableBinsForFacility" :key="bin" :value="bin"></option>
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
                            class="input input-bordered input-sm w-full h-8 min-h-8 text-xs bg-base-100"
                        />
                    </div>
                </div>

                <div class="form-control">
                    <label class="label py-0.5"><span class="label-text text-xs font-bold">Inventory Status</span></label>
                    <select v-model="editForm.status" class="select select-bordered select-sm w-full font-bold text-xs bg-base-100">
                        <option value="acquired">Acquired (Backlog)</option>
                        <option value="received">Received</option>
                        <option value="placed">Placed (In Booth)</option>
                        <option value="tracked">Tracked</option>
                        <option value="combined">Combined</option>
                        <option value="sold">Sold</option>
                        <option value="archived">Archived</option>
                    </select>
                </div>

                <MultiSelectDropdown 
                    v-model="editForm.sellingLocations" 
                    label="Sales Channels & Booth Locations" 
                />

                <div class="flex items-center justify-between bg-base-100 p-2.5 rounded-xl border border-base-300">
                    <div class="flex items-center gap-2">
                        <Icon icon="solar:shop-2-bold" class="w-4 h-4 text-primary" />
                        <div>
                            <span class="text-xs font-bold">Public Storefront Visibility</span>
                            <p class="text-[10px] opacity-60">Show this item on your public catalog site</p>
                        </div>
                    </div>
                    <input 
                        type="checkbox" 
                        :checked="showOnStorefront" 
                        @change="$emit('update:showOnStorefront', $event.target.checked)" 
                        class="checkbox checkbox-primary checkbox-sm" 
                    />
                </div>
            </div>

        </div>

        <!-- ================================================================= -->
        <!-- RIGHT COLUMN: Intelligence & Content Hub                          -->
        <!-- ================================================================= -->
        <div class="lg:col-span-6 space-y-5">
            
            <!-- 1. 📝 INTERNAL NOTES & AI PROMPT GUIDANCE (SAVED WITH ITEM) -->
            <div class="bg-base-200/50 rounded-2xl p-4 border border-base-300 space-y-2">
                <div class="flex justify-between items-center">
                    <div>
                        <label class="font-bold text-xs uppercase tracking-wider text-base-content/80 flex items-center gap-1.5">
                            <Icon icon="solar:notes-bold" class="w-4 h-4 text-secondary" />
                            Internal Product Notes & AI Guidance
                        </label>
                        <p class="text-[10px] opacity-60">Saved with item & used to sharpen AI Deep Research</p>
                    </div>
                    <span class="badge badge-xs badge-ghost font-mono">Internal Only</span>
                </div>
                <textarea 
                    v-model="editForm.condition_notes" 
                    class="textarea textarea-bordered w-full h-24 text-xs font-medium bg-base-100 focus:ring-1 focus:ring-secondary/30" 
                    placeholder="e.g. Tested motor works, light turns on, missing battery cap, minor wear on bottom, purchased from estate sale...">
                </textarea>
            </div>

            <!-- 2. 🕵️ AI SCOUT & DEEP VALUATION REPORT (FULL PRODUCTION DISPLAY) -->
            <div class="bg-base-200/60 rounded-2xl p-4 border border-base-300 space-y-4 shadow-sm">
                <div class="flex justify-between items-center border-b border-base-300 pb-2.5">
                    <div class="flex items-center gap-2">
                        <div class="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center text-primary font-bold">
                            <Icon icon="solar:magic-stick-bold" class="w-3.5 h-3.5" />
                        </div>
                        <div>
                            <h4 class="font-bold text-xs uppercase tracking-wider text-base-content">AI Scout & Valuation Intelligence</h4>
                            <p class="text-[10px] opacity-60">Deep market analysis & pricing models</p>
                        </div>
                    </div>

                    <div class="flex items-center gap-2">
                        <span v-if="scoutResult" class="badge badge-sm badge-success text-success-content font-black whitespace-nowrap px-2.5 py-0.5 shadow-xs">Report Ready</span>
                        <span v-else-if="analyzing" class="badge badge-sm badge-warning text-warning-content font-black whitespace-nowrap px-2.5 py-0.5 animate-pulse">Analyzing...</span>
                        <span v-else class="badge badge-sm badge-ghost text-base-content/70 font-bold whitespace-nowrap px-2">Not Scanned</span>
                    </div>
                </div>

                <!-- Loading Animation -->
                <div v-if="analyzing" class="flex flex-col items-center justify-center py-8 space-y-2">
                    <span class="loading loading-spinner text-primary loading-md"></span>
                    <p class="font-bold text-xs text-primary">{{ analysisStatus || 'Scanning photos & market comps...' }}</p>
                </div>

                <!-- Report Contents -->
                <div v-else-if="scoutResult" class="space-y-4">
                    
                    <!-- SOURCING STRATEGY VERDICT CARD -->
                    <div v-if="scoutPurchaseStrategy" class="border-2 rounded-2xl p-3.5 shadow-xs" :class="{
                        'border-success bg-success/10': ['BUY_NOW', 'BUY', 'CHASE_AUCTION'].includes(scoutPurchaseStrategy.verdict),
                        'border-error bg-error/10': scoutPurchaseStrategy.verdict === 'PASS',
                        'border-warning bg-warning/10': ['WATCH', 'NEGOTIATE'].includes(scoutPurchaseStrategy.verdict),
                        'border-primary bg-primary/10': !['PASS', 'WATCH', 'BUY_NOW', 'BUY', 'NEGOTIATE', 'CHASE_AUCTION'].includes(scoutPurchaseStrategy.verdict)
                    }">
                        <div class="flex items-center justify-between gap-2 mb-1.5">
                            <div class="flex items-center gap-2">
                                <Icon icon="solar:magic-stick-bold" class="w-5 h-5 text-success" v-if="['BUY_NOW', 'BUY', 'CHASE_AUCTION'].includes(scoutPurchaseStrategy.verdict)" />
                                <Icon icon="solar:stop-circle-bold" class="w-5 h-5 text-error" v-else-if="scoutPurchaseStrategy.verdict === 'PASS'" />
                                <Icon icon="solar:eye-bold" class="w-5 h-5 text-warning" v-else />
                                <h4 class="font-black text-sm uppercase tracking-wider" :class="{
                                    'text-success': ['BUY_NOW', 'BUY', 'CHASE_AUCTION'].includes(scoutPurchaseStrategy.verdict),
                                    'text-error': scoutPurchaseStrategy.verdict === 'PASS',
                                    'text-warning': ['WATCH', 'NEGOTIATE'].includes(scoutPurchaseStrategy.verdict),
                                    'text-primary': !['PASS', 'WATCH', 'BUY_NOW', 'BUY', 'NEGOTIATE', 'CHASE_AUCTION'].includes(scoutPurchaseStrategy.verdict)
                                }">{{ String(scoutPurchaseStrategy.verdict || '').replace('_', ' ') }}</h4>
                            </div>
                            <div v-if="scoutPurchaseStrategy.current_asking_price && !String(scoutPurchaseStrategy.current_asking_price).includes('No Asking Price')" class="my-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-base-100 border border-base-300 flex flex-wrap items-center gap-1.5 leading-snug">
                                <span class="opacity-60 text-[10px] uppercase font-black">Asking/Bid:</span>
                                <span>{{ scoutPurchaseStrategy.current_asking_price }}</span>
                            </div>
                            <div v-else-if="scoutPurchaseStrategy.max_bid" class="badge badge-sm font-mono font-bold bg-base-100 border border-base-300">
                                Max Bid: ${{ scoutPurchaseStrategy.max_bid }}
                            </div>
                        </div>
                        <p v-if="scoutPurchaseStrategy.advice" class="text-xs opacity-90 leading-relaxed font-medium">
                            {{ scoutPurchaseStrategy.advice }}
                        </p>
                    </div>

                    <!-- VISUAL CONDITION ASSESSMENT -->
                    <div v-if="scoutItemsArray[0]?.condition_notes" class="bg-base-200 p-3 border border-base-300 rounded-xl">
                        <div class="font-bold text-xs mb-1 opacity-70 uppercase tracking-wide flex items-center gap-1.5">
                            <Icon icon="solar:magnifer-linear" class="w-3.5 h-3.5" />
                            <span>Visual Condition Assessment</span>
                        </div>
                        <p class="text-xs font-medium opacity-90 leading-relaxed">{{ scoutItemsArray[0].condition_notes }}</p>
                    </div>

                    <!-- BUNDLE COMPONENTS -->
                    <div v-if="scoutItemsArray.length > 1" class="bg-base-200 border border-base-300 rounded-xl p-3.5">
                        <div class="font-bold text-xs uppercase tracking-wider mb-2.5 flex items-center justify-between text-primary">
                            <div class="flex items-center gap-1.5">
                                <Icon icon="solar:box-linear" class="w-4 h-4" />
                                <span>Bundle Components ({{ scoutItemsArray.length }} Items)</span>
                            </div>
                            <button v-if="item" type="button" class="btn btn-xs btn-outline btn-primary font-bold shadow-xs gap-1" @click="$emit('open-lot-tab')">
                                <span>Lot Hub ➔</span>
                            </button>
                        </div>
                        <ul class="space-y-2 text-xs font-medium">
                            <li v-for="(subItem, subIdx) in scoutItemsArray" :key="subIdx" class="bg-base-100 p-2.5 rounded-lg border border-base-300 flex flex-col gap-1 shadow-xs">
                                <div class="flex justify-between items-start gap-2 w-full">
                                    <div class="flex items-start gap-2">
                                        <span class="badge badge-sm badge-neutral font-mono font-bold shrink-0 mt-0.5">{{ subIdx + 1 }}</span>
                                        <span class="text-base-content font-bold leading-snug text-left">{{ subItem.name || subItem.title || subItem.identity || subItem.item }}</span>
                                    </div>
                                    <span v-if="subItem.condition" class="badge badge-outline badge-primary badge-xs whitespace-nowrap px-1.5 py-0.5 shrink-0">{{ subItem.condition }}</span>
                                </div>
                                <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] opacity-75 border-t border-base-200/60 pt-1.5 mt-0.5">
                                    <span>Est. Resale: <strong class="text-primary">{{ subItem.estimated_value || formatPriceRange(subItem.price_breakdown?.fair) || '-' }}</strong></span>
                                    <span class="opacity-30">|</span>
                                    <span>Max Buy: <strong class="text-success">${{ calculateMaxBuy(subItem) }}</strong></span>
                                    <span class="opacity-30">|</span>
                                    <span>Max Bid: <strong class="text-secondary">${{ calculateSubItemMaxBid(subItem, scoutResult) }}</strong></span>
                                    <span v-if="editForm.cost && Number(editForm.cost) > 0" class="opacity-30">|</span>
                                    <span v-if="editForm.cost && Number(editForm.cost) > 0">Split Cost Basis: <strong class="text-warning">${{ (parseFloat(editForm.cost) / scoutItemsArray.length).toFixed(2) }}</strong></span>
                                </div>
                            </li>
                        </ul>
                    </div>

                    <!-- AI Found Image Thumbnail (Single Item) -->
                    <div v-if="scoutItemsArray.length === 1 && scoutItemsArray[0].image" class="mb-2 flex justify-center">
                        <img :src="proxify(scoutItemsArray[0].image)" class="h-32 object-contain rounded-xl shadow-md border border-base-300" alt="AI Found Item" @error="$event.target.style.display = 'none'" />
                    </div>

                    <!-- Red Flags -->
                    <div v-if="scoutItemsArray[0]?.red_flags && scoutItemsArray[0].red_flags.length > 0" class="alert alert-warning shadow-xs p-2.5 text-xs">
                        <span class="font-bold"><Icon icon="solar:danger-triangle-bold" class="w-4 h-4 inline mr-1" /> Flags:</span> {{ scoutItemsArray[0].red_flags.join(', ') }}
                    </div>

                    <!-- SUGGESTED VALUATION MATRIX (2x2 Grid) -->
                    <div v-if="scoutTotalRange || scoutItemsArray[0]?.price_breakdown" class="grid grid-cols-2 gap-2 pt-1">
                        <div 
                            class="flex flex-col items-center bg-base-200/60 p-2.5 rounded-xl border border-base-300 shadow-xs cursor-pointer hover:border-success/60 hover:bg-success/5 transition-all group"
                            @click="$emit('apply-price-tier', scoutTotalRange ? scoutTotalRange.mint.formatted : scoutItemsArray[0]?.price_breakdown?.mint)"
                            title="Click to apply Mint price"
                        >
                            <span class="badge badge-xs font-bold whitespace-nowrap bg-success/20 text-success border-success/40 mb-1">MINT</span>
                            <span class="font-mono font-black text-xs sm:text-sm text-base-content">{{ scoutTotalRange ? scoutTotalRange.mint.formatted : formatPriceRange(scoutItemsArray[0]?.price_breakdown?.mint) }}</span>
                            <span class="text-[9px] opacity-0 group-hover:opacity-80 text-success font-bold mt-0.5">Use Price ↵</span>
                        </div>
                        <div 
                            class="flex flex-col items-center bg-base-200/60 p-2.5 rounded-xl border border-primary/40 shadow-xs ring-1 ring-primary/20 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all group"
                            @click="$emit('apply-price-tier', scoutTotalRange ? scoutTotalRange.fair.formatted : scoutItemsArray[0]?.price_breakdown?.fair)"
                            title="Click to apply Fair market price"
                        >
                            <span class="badge badge-xs font-bold whitespace-nowrap bg-primary/20 text-primary border-primary/40 mb-1">FAIR</span>
                            <span class="font-mono font-black text-xs sm:text-sm text-base-content">{{ scoutTotalRange ? scoutTotalRange.fair.formatted : formatPriceRange(scoutItemsArray[0]?.price_breakdown?.fair) }}</span>
                            <span class="text-[9px] opacity-0 group-hover:opacity-80 text-primary font-bold mt-0.5">Use Price ↵</span>
                        </div>
                        <div 
                            class="flex flex-col items-center bg-base-200/60 p-2.5 rounded-xl border border-base-300 shadow-xs cursor-pointer hover:border-error/60 hover:bg-error/5 transition-all group"
                            @click="$emit('apply-price-tier', scoutTotalRange ? scoutTotalRange.poor.formatted : scoutItemsArray[0]?.price_breakdown?.poor)"
                            title="Click to apply Poor / Clearance price"
                        >
                            <span class="badge badge-xs font-bold whitespace-nowrap bg-error/20 text-error border-error/40 mb-1">POOR</span>
                            <span class="font-mono font-black text-xs sm:text-sm text-base-content">{{ scoutTotalRange ? scoutTotalRange.poor.formatted : formatPriceRange(scoutItemsArray[0]?.price_breakdown?.poor) }}</span>
                            <span class="text-[9px] opacity-0 group-hover:opacity-80 text-error font-bold mt-0.5">Use Price ↵</span>
                        </div>
                        <div 
                            class="flex flex-col items-center bg-base-200/60 p-2.5 rounded-xl border border-secondary/40 shadow-xs cursor-pointer hover:border-secondary hover:bg-secondary/5 transition-all group"
                            @click="$emit('apply-price-tier', scoutTotalRange ? scoutTotalRange.boutique.formatted : scoutItemsArray[0]?.price_breakdown?.boutique_premium)"
                            title="Click to apply Boutique / Antique Mall price"
                        >
                            <span class="badge badge-xs font-bold whitespace-nowrap bg-secondary/20 text-secondary border-secondary/40 mb-1">BOUTIQUE</span>
                            <span class="font-mono font-black text-xs sm:text-sm text-base-content">{{ scoutTotalRange ? scoutTotalRange.boutique.formatted : (formatPriceRange(scoutItemsArray[0]?.price_breakdown?.boutique_premium) || '-') }}</span>
                            <span class="text-[9px] opacity-0 group-hover:opacity-80 text-secondary font-bold mt-0.5">Use Price ↵</span>
                        </div>
                    </div>

                    <!-- LOT MARKET STRATEGY & LIQUIDATION -->
                    <div v-if="scoutResult?.market_report || (Array.isArray(scoutResult) && scoutResult[0]?.market_report) || scoutItemsArray[0]?.market_report" class="bg-base-100 p-3 rounded-2xl border border-primary/30 shadow-xs space-y-2.5">
                        <div class="flex items-center justify-between border-b border-base-200 pb-2">
                            <span class="text-xs font-bold flex items-center gap-1.5 text-primary">
                                <Icon icon="solar:chart-square-bold" class="w-4 h-4" />
                                {{ scoutItemsArray.length > 1 ? 'Lot Market Strategy & Liquidation' : 'Market Strategy & Sales Channels' }}
                            </span>
                            <span v-if="(scoutResult?.market_report || scoutResult[0]?.market_report || scoutItemsArray[0]?.market_report)?.sell_through_velocity" class="inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[10px] bg-info/20 text-info border border-info/30">
                                ⚡ {{ (scoutResult?.market_report || scoutResult[0]?.market_report || scoutItemsArray[0]?.market_report).sell_through_velocity }}
                            </span>
                        </div>
                        
                        <!-- Recommended Channel Banner -->
                        <div class="bg-primary/10 border border-primary/25 rounded-xl p-3 flex flex-col gap-1.5">
                            <div class="text-[10px] uppercase font-bold text-primary tracking-wider flex items-center gap-1">
                                <Icon icon="solar:shop-2-bold" class="w-3.5 h-3.5" /> Recommended Channel:
                            </div>
                            <div class="font-extrabold text-xs sm:text-sm text-base-content leading-snug break-words">
                                {{ (scoutResult?.market_report || scoutResult[0]?.market_report || scoutItemsArray[0]?.market_report).best_platform }}
                            </div>
                            <p v-if="(scoutResult?.market_report || scoutResult[0]?.market_report || scoutItemsArray[0]?.market_report).platform_rationale" class="text-xs opacity-85 leading-relaxed mt-0.5 whitespace-pre-wrap break-words text-base-content">
                                {{ (scoutResult?.market_report || scoutResult[0]?.market_report || scoutItemsArray[0]?.market_report).platform_rationale }}
                            </p>
                        </div>

                        <!-- Channel Comparisons / Trade-Offs -->
                        <div v-if="(scoutResult?.market_report || scoutResult[0]?.market_report || scoutItemsArray[0]?.market_report)?.channels?.length" class="space-y-1.5 pt-1">
                            <div class="text-[10px] font-bold uppercase opacity-60">Channel Trade-Offs</div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div v-for="(ch, cIdx) in (scoutResult?.market_report || scoutResult[0]?.market_report || scoutItemsArray[0]?.market_report).channels" :key="cIdx" class="bg-base-200/60 p-2.5 rounded-xl border border-base-300 flex flex-col justify-between space-y-1.5 text-xs">
                                    <div class="space-y-1">
                                        <div class="font-extrabold text-xs text-base-content leading-snug break-words">
                                            {{ ch.name }}
                                        </div>
                                        <div v-if="ch.recommendation" class="text-[10px] text-base-content/85 leading-snug bg-base-100 p-1.5 rounded-lg border border-base-300 font-medium break-words">
                                            💡 {{ ch.recommendation }}
                                        </div>
                                        <div class="text-xs font-mono font-black text-success pt-0.5">
                                            {{ ch.est_price || '-' }}
                                        </div>
                                    </div>
                                    <div class="text-[10px] opacity-80 flex justify-between items-center border-t border-base-300 pt-1.5 font-mono">
                                        <span>Net Payout:</span>
                                        <span class="font-bold text-base-content">{{ ch.net_payout || '-' }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- INVENTORY IMPORT PREFERENCE (IF MULTI-ITEM) -->
                    <div v-if="scoutItemsArray.length > 1" class="form-control border-t border-base-300 pt-3">
                        <label class="label pb-1.5"><span class="label-text text-[10px] uppercase font-bold opacity-75">Inventory Import Preference</span></label>
                        <div class="join grid grid-cols-2 w-full font-bold">
                            <button type="button" class="btn btn-xs join-item btn-outline text-[10px]" :class="{ 'btn-active btn-primary': !saveIndividually }" @click="$emit('update:saveIndividually', false)">
                                Save as Single Bundle
                            </button>
                            <button type="button" class="btn btn-xs join-item btn-outline text-[10px]" :class="{ 'btn-active btn-primary': saveIndividually }" @click="$emit('update:saveIndividually', true)">
                                Split Individually (x{{ scoutItemsArray.length }})
                            </button>
                        </div>
                        <div class="text-[10px] opacity-60 mt-1.5 leading-normal font-bold">
                            <span v-if="saveIndividually">
                                Creates {{ scoutItemsArray.length }} separate inventory items. Cost basis split evenly (${{ editForm.cost && !isNaN(parseFloat(editForm.cost)) ? (parseFloat(editForm.cost) / scoutItemsArray.length).toFixed(2) : '0.00' }} each).
                            </span>
                            <span v-else>
                                Updates this item as a single combined inventory bundle.
                            </span>
                        </div>
                    </div>

                    <!-- CARD ACTION BUTTONS -->
                    <div class="pt-2 flex flex-col sm:flex-row gap-2">
                        <button v-if="saveIndividually && item" type="button" class="btn btn-primary btn-sm flex-1 font-bold shadow-xs gap-1.5" @click="$emit('deconstruct-ai-lot')">
                            <Icon icon="solar:scissors-linear" class="w-4 h-4" />
                            <span>Split Lot ({{ scoutItemsArray.length }} Items)</span>
                        </button>
                        <button v-else type="button" class="btn btn-secondary btn-sm flex-1 font-bold shadow-xs gap-1.5 text-white" @click="$emit('apply-bundle-suggestions')">
                            <Icon icon="solar:magic-stick-linear" class="w-4 h-4" />
                            <span>Apply AI to Listing Description</span>
                        </button>
                        <button v-if="scoutMdText" type="button" class="btn btn-outline btn-sm px-3" @click="$emit('open-md-modal')" title="View Full Report">
                            <Icon icon="solar:document-text-linear" class="w-4 h-4" />
                            <span class="sm:hidden">Report</span>
                        </button>
                    </div>
                </div>

                <!-- Empty State Prompt -->
                <div v-else class="text-center py-6 border-2 border-dashed rounded-xl border-base-300 text-xs space-y-1.5 bg-base-100/50">
                    <Icon icon="solar:magic-stick-3-bold-duotone" class="w-7 h-7 mx-auto text-primary/50" />
                    <p class="font-bold text-xs text-base-content/80">Ready for AI Deep Research</p>
                    <p class="text-[11px] opacity-60 max-w-xs mx-auto">Use the <strong>AI Deep Research</strong> button in the bottom dock to scout photos, comps, and prices.</p>
                </div>
            </div>

            <!-- 3. 🛍️ PUBLIC LISTING DESCRIPTION (MARKDOWN) -->
            <div class="bg-base-200/50 rounded-2xl p-4 border border-base-300 space-y-2">
                <div class="flex justify-between items-center">
                    <label class="font-bold text-xs uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
                        <Icon icon="solar:document-text-bold" class="w-4 h-4 text-primary" />
                        Public Listing Description
                    </label>
                    
                    <div class="flex items-center gap-2">
                        <button class="btn btn-xs btn-outline btn-secondary font-bold gap-1" @click="$emit('generate-description')" :disabled="generatingDescription || !item">
                            <span v-if="generatingDescription" class="loading loading-spinner loading-xs"></span>
                            <Icon v-else icon="mingcute:gemini-fill" class="w-3.5 h-3.5" />
                            AI Generate
                        </button>

                        <div class="join border border-base-300 rounded-lg overflow-hidden">
                            <button type="button" class="btn btn-xs join-item" :class="descTab === 'edit' ? 'btn-active btn-neutral' : 'btn-ghost'" @click="$emit('update:descTab', 'edit')">Edit</button>
                            <button type="button" class="btn btn-xs join-item" :class="descTab === 'preview' ? 'btn-active btn-neutral' : 'btn-ghost'" @click="$emit('update:descTab', 'preview')">Preview</button>
                        </div>
                    </div>
                </div>

                <div v-if="descTab === 'edit'">
                    <textarea v-model="editForm.description" class="textarea textarea-bordered w-full h-36 font-mono text-xs bg-base-100 focus:ring-1 focus:ring-primary/30" placeholder="Product details, condition, measurements, flaws for customer listing..."></textarea>
                </div>
                <div v-else class="w-full h-36 overflow-y-auto border border-base-300 rounded-xl p-3 bg-base-100 prose prose-xs" v-html="renderMarkdown(editForm.description || '*No description entered yet.*')"></div>

                <TagInput 
                    v-model="editForm.keywords" 
                    label="Tags & Keywords" 
                    type="keyword" 
                    badgeClass="badge-secondary" 
                    :recommendedTags="Array.isArray(scoutResult) ? Array.from(new Set(scoutResult.flatMap(item => item.keywords || []))) : (scoutResult && scoutResult.keywords ? scoutResult.keywords : [])"
                />
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
    }
});

defineEmits([
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
    'apply-price-tier',
    'deconstruct-ai-lot',
    'apply-bundle-suggestions',
    'open-md-modal',
    'generate-description'
]);

const KNOWN_CODES = ['HG', 'HD', 'MD', 'DT'];

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
    const fair = subItem?.price_breakdown?.fair;
    let price = 0;
    if (fair) {
        price = typeof fair === 'object' ? (fair.mid || fair.min || 0) : parseFloat(fair) || 0;
    }
    return Math.round(price * 0.4);
};

const calculateSubItemMaxBid = (subItem, result) => {
    const fair = subItem?.price_breakdown?.fair;
    let price = 0;
    if (fair) {
        price = typeof fair === 'object' ? (fair.mid || fair.min || 0) : parseFloat(fair) || 0;
    }
    return Math.round(price * 0.5);
};
</script>

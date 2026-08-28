<template>
    <Teleport to="body">
        <div class="relative z-400">
            <!-- Backdrop -->
            <div class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" @click="closeDrawer"></div>

            <!-- Drawer Container: Mobile full-width, Desktop expanded (860px / 980px) -->
            <div class="fixed inset-y-0 right-0 w-full md:w-155 lg:w-220 xl:w-250 bg-base-100 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out">
                
                <!-- HEADER (Sticky) -->
                <div class="px-4 py-3 sm:px-6 border-b border-base-200 flex justify-between items-center bg-base-100 flex-none sticky top-0 z-30">
                    <div class="flex items-center gap-2 min-w-0">
                        <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <Icon :icon="item ? 'solar:pen-bold' : 'solar:box-minimalistic-bold'" class="w-4 h-4" />
                        </div>
                        <div class="min-w-0">
                            <h3 class="font-bold text-base sm:text-lg leading-tight truncate">
                                {{ item ? 'Edit Item' : 'Add New Item' }}
                            </h3>
                            <div class="text-[11px] opacity-60 truncate flex items-center gap-1 font-mono">
                                <span>{{ item?.$id ? `ID: ${item.$id.substring(0, 12)}...` : 'Creating Draft' }}</span>
                                <span v-if="item?.tenantId" class="badge badge-ghost badge-xs scale-90">{{ item.tenantId }}</span>
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 shrink-0">
                        <!-- UPC Badge -->
                        <div v-if="item?.upc" class="hidden sm:flex items-center gap-1.5 text-xs font-mono bg-base-200 rounded-md px-2.5 py-1 border border-base-300">
                            <Icon icon="solar:tag-horizontal-bold-duotone" class="w-3.5 h-3.5 text-primary" />
                            <span class="font-bold tracking-wider">{{ item.upc }}</span>
                        </div>
                        <button class="btn btn-sm btn-circle btn-ghost" @click="closeDrawer" aria-label="Close Drawer">✕</button>
                    </div>
                </div>

                <!-- TABS (Details, Verify, Lot) -->
                <div class="px-4 sm:px-6 pt-1 pb-0 bg-base-100 border-b border-base-200 flex-none z-20">
                    <div role="tablist" class="tabs tabs-bordered font-bold w-full">
                        <a role="tab" class="tab flex-1 text-xs sm:text-sm py-2" :class="{'tab-active text-primary': mainTab === 'details'}" @click="mainTab = 'details'">
                            <Icon icon="solar:notes-linear" class="w-4 h-4 mr-1.5 inline" /> Listing Details
                        </a>
                        <a role="tab" class="tab flex-1 text-xs sm:text-sm py-2" :class="{'tab-active text-primary': mainTab === 'verify'}" @click="mainTab = 'verify'">
                            <Icon icon="solar:checklist-minimalistic-linear" class="w-4 h-4 mr-1.5 inline" /> Checklist / Verify
                        </a>
                        <a v-if="item" role="tab" class="tab flex-1 text-xs sm:text-sm py-2" :class="{'tab-active text-secondary': mainTab === 'lot'}" @click="mainTab = 'lot'">
                            <Icon icon="solar:box-linear" class="w-4 h-4 mr-1.5 inline" /> Inbound Lot ({{ lotChildren?.length || 0 }})
                        </a>
                    </div>
                </div>

                <!-- SCROLLABLE CONTENT BODY -->
                <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6" v-show="mainTab === 'details'">
                    
                    <!-- RESPONSIVE 2-COLUMN GRID (Mobile 1 col, Desktop 12-col split) -->
                    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                        <!-- ================================================================= -->
                        <!-- LEFT COLUMN: Physical Item & Logistics (Priority Order)          -->
                        <!-- ================================================================= -->
                        <div class="lg:col-span-6 space-y-5">
                            
                            <!-- 1. 🏷️ TITLE & IDENTITY (TOP PRIORITY) -->
                            <div class="bg-base-200/50 rounded-2xl p-4 border border-base-300 space-y-3">
                                <div class="flex justify-between items-center">
                                    <label class="font-bold text-xs uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
                                        <Icon icon="solar:text-bold" class="w-4 h-4 text-primary" />
                                        Item Title & Identity
                                    </label>
                                    <div class="flex items-center gap-1.5">
                                        <span v-if="props.item?.sku || props.item?.upc" class="badge badge-sm font-mono font-bold bg-base-300">
                                            {{ props.item.sku || props.item.upc }}
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
                                    <button class="btn join-item border border-base-300 h-auto px-3 flex items-center justify-center hover:bg-base-200" @click="copyToClipboard(editForm.title)" title="Copy Title">
                                        <Icon icon="solar:copy-linear" class="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <!-- 2. 📸 PHOTOS & SOURCING URL FETCHER -->
                            <div class="bg-base-200/50 rounded-2xl p-4 border border-base-300 space-y-3">
                                <div class="flex justify-between items-center">
                                    <label class="font-bold text-xs uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
                                        <Icon icon="solar:gallery-bold" class="w-4 h-4 text-primary" />
                                        Photos & Sourcing Media
                                    </label>
                                    <span class="text-[11px] opacity-60 font-medium">Click photo to set Main ⭐</span>
                                </div>

                                <!-- Gallery Previews & Dropzone -->
                                <div class="border-2 border-dashed rounded-xl p-2.5 transition-colors relative min-h-27.5 flex flex-col justify-center bg-base-100/60"
                                     @dragenter.prevent="dragOver = true"
                                     @dragover.prevent="dragOver = true"
                                     @dragleave.prevent="onDragLeave"
                                     @drop.prevent="handleDrop"
                                     :class="{'border-primary bg-primary/5': dragOver, 'border-base-300': !dragOver}">
                                     
                                    <div v-if="!editForm.existingGalleryIds?.length && !editGalleryBuffer.length" class="text-center py-4 opacity-50 pointer-events-none">
                                        <Icon icon="solar:upload-minimalistic-linear" class="w-7 h-7 mx-auto mb-1 opacity-70" />
                                        <span class="text-xs">Drag & drop photos or use buttons below</span>
                                    </div>
                                    
                                    <div v-else class="flex gap-2.5 items-center overflow-x-auto pb-1 w-full pointer-events-auto z-10">
                                        <!-- Existing Appwrite Photos -->
                                        <div v-for="id in editForm.existingGalleryIds" :key="id" 
                                             class="relative w-20 h-20 shrink-0 group cursor-pointer transition-transform hover:scale-102" 
                                             @click="setMainPhoto('existing', id)">
                                            <img :src="getAssetUrl(id)" class="w-full h-full object-cover rounded-lg shadow-sm border border-base-300" :class="{'ring-3 ring-primary ring-inset': actualMainPhoto.id === id}"/>
                                            <div v-if="actualMainPhoto.id === id" class="absolute -top-2 -left-2 text-xl drop-shadow-md z-20 text-warning">
                                                <Icon icon="solar:star-bold" />
                                            </div>
                                            <button @click.stop="removeGalleryItem(id, true)" class="btn btn-xs btn-circle btn-error absolute -top-1.5 -right-1.5 w-4 h-4 min-h-0 text-[9px] flex items-center justify-center z-30 shadow hover:scale-110">✕</button>
                                        </div>
                                        
                                        <!-- New Buffered Uploads -->
                                        <div v-for="(file, idx) in editGalleryBuffer" :key="idx" 
                                             class="relative w-20 h-20 shrink-0 group cursor-pointer transition-transform hover:scale-102" 
                                             @click="setMainPhoto('new', idx)">
                                            <img :src="getObjectUrl(file)" class="w-full h-full object-cover rounded-lg shadow-sm border border-base-300" :class="{'ring-3 ring-primary ring-inset': actualMainPhoto.file === file}"/>
                                            <div v-if="actualMainPhoto.file === file" class="absolute -top-2 -left-2 text-xl drop-shadow-md z-20 text-warning">
                                                <Icon icon="solar:star-bold" />
                                            </div>
                                            <button @click.stop="removeGalleryItem(idx, false)" class="btn btn-xs btn-circle btn-error absolute -top-1.5 -right-1.5 w-4 h-4 min-h-0 text-[9px] flex items-center justify-center z-30 shadow hover:scale-110">✕</button>
                                        </div>
                                    </div>
                                </div>

                                <!-- Photo Actions: Upload, Camera, and Sourcing URL Fetcher -->
                                <div class="grid grid-cols-2 gap-2">
                                    <button @click="$refs.fileInput.click()" class="btn btn-sm btn-outline text-xs">
                                        <Icon icon="solar:gallery-add-linear" class="w-4 h-4 mr-1" /> Upload
                                    </button>
                                    <button @click="$refs.scannerWidget.startCamera()" class="btn btn-sm btn-outline text-xs">
                                        <Icon icon="solar:camera-linear" class="w-4 h-4 mr-1" /> Camera
                                    </button>
                                </div>

                                <!-- Always-Visible Sourcing URL & Image Scraper Bar -->
                                <div class="form-control">
                                    <div class="join w-full shadow-xs">
                                        <input 
                                            type="text" 
                                            v-model="editForm.sourcingLocation" 
                                            placeholder="Paste ShopGoodwill Item # or Listing URL..." 
                                            class="input input-bordered input-sm join-item grow font-mono text-xs bg-base-100" 
                                            @keydown.enter.prevent="fetchSourceData"
                                        />
                                        <button 
                                            class="btn btn-primary btn-sm join-item shrink-0 gap-1 font-bold" 
                                            @click="fetchSourceData" 
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
                                                @click="addAllFetchedImages" 
                                                class="btn btn-xs btn-primary gap-1 font-bold shadow-xs"
                                                title="Add all fetched photos to gallery"
                                            >
                                                <Icon icon="solar:gallery-add-bold" class="w-3.5 h-3.5" />
                                                <span>Add All</span>
                                            </button>
                                            <button 
                                                type="button" 
                                                @click="fetchedImages = []" 
                                                class="btn btn-xs btn-ghost btn-circle opacity-60 hover:opacity-100"
                                                title="Dismiss fetched photos"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>

                                    <!-- Image Grid -->
                                    <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-56 overflow-y-auto p-1.5 rounded-lg bg-base-200/60 border border-base-300">
                                        <div 
                                            v-for="(imgUrl, idx) in fetchedImages" 
                                            :key="idx"
                                            class="group relative aspect-square rounded-lg border border-base-300 overflow-hidden bg-base-100 shadow-xs hover:border-primary transition-all flex items-center justify-center cursor-pointer"
                                        >
                                            <img 
                                                :src="proxify(typeof imgUrl === 'string' ? imgUrl : imgUrl.url)" 
                                                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                                loading="lazy"
                                            />
                                            
                                            <!-- Downloading Spinner Overlay -->
                                            <div 
                                                v-if="downloadingImageUrls[typeof imgUrl === 'string' ? imgUrl : imgUrl.url]" 
                                                class="absolute inset-0 bg-base-300/80 backdrop-blur-xs flex items-center justify-center z-20"
                                            >
                                                <span class="loading loading-spinner loading-xs text-primary"></span>
                                            </div>

                                            <!-- Hover Actions -->
                                            <div class="absolute inset-0 bg-neutral/80 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1 z-10">
                                                <button 
                                                    type="button"
                                                    class="btn btn-xs btn-primary w-full text-[10px] h-6 min-h-0 px-1 font-bold shadow-xs gap-0.5"
                                                    @click.stop="selectFetchedImage(typeof imgUrl === 'string' ? imgUrl : imgUrl.url, false)"
                                                    title="Add to gallery"
                                                >
                                                    <Icon icon="solar:add-circle-bold" class="w-3 h-3" />
                                                    <span>+ Gallery</span>
                                                </button>
                                                <button 
                                                    type="button"
                                                    class="btn btn-xs btn-warning w-full text-[10px] h-6 min-h-0 px-1 font-bold shadow-xs gap-0.5"
                                                    @click.stop="selectFetchedImage(typeof imgUrl === 'string' ? imgUrl : imgUrl.url, true)"
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
                                        @click="isAcquisitionUnlocked = !isAcquisitionUnlocked"
                                        title="Toggle lock to protect original purchase cost and order ID"
                                    >
                                        <Icon :icon="isAcquisitionUnlocked ? 'solar:lock-unlocked-bold' : 'solar:lock-bold'" class="w-3.5 h-3.5" />
                                        <span>{{ isAcquisitionUnlocked ? 'Unlocked' : 'Locked' }}</span>
                                    </button>
                                </div>

                                <!-- Read-Only Locked View (Default) -->
                                <div v-if="!isAcquisitionUnlocked && props.item" class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs bg-base-100/70 p-3 rounded-xl border border-base-200">
                                    <div>
                                        <span class="text-[10px] opacity-50 block font-bold uppercase">Buy Cost</span>
                                        <span class="font-mono font-bold text-sm text-base-content">${{ Number(editForm.cost || 0).toFixed(2) }}</span>
                                    </div>
                                    <div>
                                        <span class="text-[10px] opacity-50 block font-bold uppercase">Order #</span>
                                        <span class="font-mono font-semibold truncate block" :title="editForm.orderId">{{ editForm.orderId || 'None' }}</span>
                                    </div>
                                    <div class="col-span-2 sm:col-span-1 flex flex-col justify-center">
                                        <span class="text-[10px] opacity-50 block font-bold uppercase">Purchase Link</span>
                                        <a v-if="props.item.purchaseId" :href="`/purchases/${props.item.purchaseId}`" target="_blank" class="text-primary link font-bold flex items-center gap-1 truncate text-xs">
                                            <Icon icon="solar:cart-bold" class="w-3.5 h-3.5 shrink-0" />
                                            <span>PO Details</span>
                                        </a>
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
                                            <label class="label py-0.5"><span class="label-text text-xs font-bold">Order / Invoice #</span></label>
                                            <input type="text" v-model="editForm.orderId" placeholder="e.g. SGW-84920" class="input input-bordered input-sm w-full font-mono text-xs bg-base-100" />
                                        </div>
                                    </div>
                                    <div class="grid grid-cols-2 gap-3">
                                        <div class="form-control">
                                            <label class="label py-0.5"><span class="label-text text-xs font-bold">Origin / Provenance</span></label>
                                            <input type="text" v-model="editForm.countryOfOrigin" placeholder="e.g. USA, Japan, Estate Sale" class="input input-bordered input-sm w-full text-xs bg-base-100" />
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
                                                    @click="editForm.parentLotId = null; addToast({ type: 'info', message: 'Unlinked from parent lot! Click Save to confirm.' })" 
                                                    class="btn btn-sm btn-outline btn-error join-item font-bold text-xs" 
                                                    title="Unlink and make standalone"
                                                >
                                                    Unlink
                                                </button>
                                            </div>
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
                                        <button @click.prevent="sellOneQuantity" class="btn btn-xs btn-success font-bold gap-1 shadow-xs" title="Log sale of 1 unit and subtract cost">
                                            <Icon icon="solar:cart-check-linear" class="w-3.5 h-3.5" /> Sell 1 Unit
                                        </button>
                                        <button @click.prevent="splitOneActive" class="btn btn-xs btn-outline btn-secondary font-bold gap-1 shadow-xs" title="Extract 1 unit as a new active inventory item">
                                            <Icon icon="solar:scissors-linear" class="w-3.5 h-3.5" /> Split 1 Active
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- 5. 📍 STORAGE LOCATION & STATUS -->
                            <div class="bg-base-200/50 rounded-2xl p-4 border border-base-300 space-y-3">
                                <div class="grid grid-cols-2 gap-3">
                                    <div class="form-control">
                                        <label class="label py-0.5"><span class="label-text text-xs font-bold">Physical Storage Bin</span></label>
                                        <SingleSelectDropdown 
                                            v-model="editForm.storageLocation" 
                                            :options="allLocations" 
                                            placeholder="Select or type bin..."
                                        />
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
                                    <input type="checkbox" v-model="showOnStorefront" class="checkbox checkbox-primary checkbox-sm" />
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

                                    <!-- Report Ready Badge -->
                                    <span v-if="scoutResult" class="badge badge-xs badge-primary font-bold">Report Ready</span>
                                    <span v-else-if="analyzing" class="badge badge-xs badge-warning font-bold animate-pulse">Analyzing...</span>
                                    <span v-else class="badge badge-xs badge-ghost opacity-60">Not Scanned</span>
                                </div>

                                <!-- Loading Animation -->
                                <div v-if="analyzing" class="flex flex-col items-center justify-center py-8 space-y-2">
                                    <span class="loading loading-spinner text-primary loading-md"></span>
                                    <p class="font-bold text-xs text-primary">{{ analysisStatus || 'Scanning photos & market comps...' }}</p>
                                </div>

                                <!-- Report Contents -->
                                <div v-else-if="scoutResult" class="space-y-4">
                                    
                                    <!-- MULTI-ITEM LOT: BUNDLE COMPONENTS -->
                                    <div v-if="scoutItemsArray.length > 1" class="space-y-3">
                                        <div class="flex items-center justify-between border-b border-base-300 pb-2">
                                            <span class="text-xs font-bold uppercase tracking-wider text-base-content/80 flex items-center gap-1.5">
                                                <Icon icon="solar:box-minimalistic-bold" class="w-4 h-4 text-primary" />
                                                Bundle Components ({{ scoutItemsArray.length }} Items)
                                            </span>
                                            <button v-if="item" type="button" class="btn btn-xs btn-primary font-bold shadow-xs gap-1" @click="deconstructAiLot" :disabled="extractingLot">
                                                <span v-if="extractingLot" class="loading loading-spinner loading-xs"></span>
                                                <Icon v-else icon="solar:scissors-linear" class="w-3.5 h-3.5" />
                                                <span>⚡ Deconstruct Lot</span>
                                            </button>
                                        </div>

                                        <ul class="space-y-2.5">
                                            <li v-for="(resultItem, idx) in scoutItemsArray" :key="idx" class="bg-base-100 p-2.5 rounded-xl border border-base-300 flex items-start gap-2.5 shadow-xs hover:border-primary/50 transition-colors">
                                                <!-- Interactive Preview Thumbnail with Photo Picker -->
                                                <div 
                                                    @click.stop="openPhotoPicker(idx)"
                                                    class="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-lg overflow-hidden border border-base-300 bg-base-200 shadow-inner flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary relative group transition-all" 
                                                    title="Click to select / change photo"
                                                >
                                                    <img 
                                                        v-if="cropPreviews[idx] || resultItem.image || resultItem.image_url || (resultItem.image_index !== undefined && allAvailableGalleryUrls[resultItem.image_index])" 
                                                        :src="cropPreviews[idx] || resultItem.image || resultItem.image_url || (resultItem.image_index !== undefined && allAvailableGalleryUrls[resultItem.image_index])" 
                                                        class="w-full h-full object-cover" 
                                                        alt="Item preview" 
                                                        @error="$event.target.style.display = 'none'; $event.target.nextElementSibling?.classList.remove('hidden')" 
                                                    />
                                                    <div :class="{'hidden': cropPreviews[idx] || resultItem.image || resultItem.image_url || (resultItem.image_index !== undefined && allAvailableGalleryUrls[resultItem.image_index])}" class="flex flex-col items-center justify-center text-base-content/40 p-1">
                                                        <Icon icon="solar:gallery-wide-bold" class="w-5 h-5" />
                                                        <span class="text-[8px] font-bold">Pick</span>
                                                    </div>
                                                    <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity">
                                                        <Icon icon="solar:gallery-edit-linear" class="w-4 h-4" />
                                                        <span class="text-[8px] font-bold mt-0.5">Change</span>
                                                    </div>
                                                </div>

                                                <div class="flex-1 flex flex-col gap-1.5 min-w-0">
                                                    <!-- Title & Swap -->
                                                    <div class="flex items-center justify-between gap-1.5 w-full">
                                                        <div class="flex items-center gap-1.5 flex-1 min-w-0">
                                                            <span class="text-primary font-black text-xs shrink-0">{{ idx + 1 }}.</span>
                                                            <input 
                                                                v-if="resultItem.name !== undefined"
                                                                v-model="resultItem.name" 
                                                                class="input input-xs bg-transparent font-bold text-xs sm:text-sm text-base-content hover:bg-base-200/70 focus:bg-base-200 px-1 py-0 rounded w-full truncate border-none focus:outline-none" 
                                                                :placeholder="resultItem.title || resultItem.identity || 'Item Name'"
                                                            />
                                                            <input 
                                                                v-else-if="resultItem.title !== undefined"
                                                                v-model="resultItem.title" 
                                                                class="input input-xs bg-transparent font-bold text-xs sm:text-sm text-base-content hover:bg-base-200/70 focus:bg-base-200 px-1 py-0 rounded w-full truncate border-none focus:outline-none" 
                                                                :placeholder="resultItem.identity || 'Item Name'"
                                                            />
                                                            <span v-else class="text-base-content font-bold text-xs sm:text-sm truncate">{{ resultItem.identity || resultItem.item || 'Unknown Item' }}</span>
                                                        </div>
                                                        
                                                        <!-- Photo Swap Controls -->
                                                        <div class="flex items-center gap-0.5 shrink-0 bg-base-200/80 rounded px-1 py-0.5 border border-base-300">
                                                            <button v-if="idx > 0" @click.stop="swapComponentPhotos(idx, idx - 1)" class="btn btn-ghost btn-xs btn-square h-5 w-5 min-h-0 text-base-content/70 hover:text-primary" title="Swap photo with item above">
                                                                <Icon icon="solar:arrow-up-linear" class="w-3.5 h-3.5" />
                                                            </button>
                                                            <button v-if="idx < scoutItemsArray.length - 1" @click.stop="swapComponentPhotos(idx, idx + 1)" class="btn btn-ghost btn-xs btn-square h-5 w-5 min-h-0 text-base-content/70 hover:text-primary" title="Swap photo with item below">
                                                                <Icon icon="solar:arrow-down-linear" class="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <!-- Condition Line: Clean neutral badge + subtitle -->
                                                    <div class="flex items-center gap-1.5 flex-wrap">
                                                        <span class="badge badge-neutral badge-xs font-bold text-[10px] px-1.5 py-0.5 rounded">
                                                            {{ (resultItem.condition || 'Used/Good').split(' - ')[0].replace(/^Used\//i, '') }}
                                                        </span>
                                                        <span v-if="(resultItem.condition || '').includes(' - ')" class="text-[11px] text-base-content/60 italic truncate max-w-full">
                                                            {{ resultItem.condition.split(' - ').slice(1).join(' - ') }}
                                                        </span>
                                                    </div>

                                                    <!-- Clean High-Contrast Price Badges -->
                                                    <div class="flex flex-wrap items-center gap-1.5 text-[11px] pt-1 mt-0.5 border-t border-base-200/80">
                                                        <span v-if="resultItem.price_breakdown?.fair" class="bg-base-200/80 px-1.5 py-0.5 rounded text-base-content/90 font-medium">
                                                            Fair: <strong class="text-primary font-mono font-bold">{{ formatPriceRange(resultItem.price_breakdown.fair) }}</strong>
                                                        </span>
                                                        <span v-if="resultItem.price_breakdown?.boutique_premium" class="bg-base-200/80 px-1.5 py-0.5 rounded text-base-content/90 font-medium">
                                                            Boutique: <strong class="text-secondary font-mono font-bold">{{ formatPriceRange(resultItem.price_breakdown.boutique_premium) }}</strong>
                                                        </span>
                                                        <span v-if="resultItem.price_breakdown?.mint" class="bg-base-200/80 px-1.5 py-0.5 rounded text-base-content/90 font-medium">
                                                            Mint: <strong class="text-success font-mono font-bold">{{ formatPriceRange(resultItem.price_breakdown.mint) }}</strong>
                                                        </span>
                                                        <span v-if="(!resultItem.price_breakdown?.fair && !resultItem.price_breakdown?.boutique_premium) && resultItem.estimated_value" class="bg-base-200/80 px-1.5 py-0.5 rounded text-base-content/90 font-medium">
                                                            Est: <strong class="text-primary font-mono font-bold">{{ formatPriceRange(resultItem.estimated_value) }}</strong>
                                                        </span>
                                                        
                                                        <span v-if="editForm.cost && !isNaN(parseFloat(editForm.cost))" class="bg-warning/15 text-warning px-1.5 py-0.5 rounded font-medium ml-auto">
                                                            Split Cost: <strong class="font-mono font-bold">${{ (parseFloat(editForm.cost) / scoutItemsArray.length).toFixed(2) }}</strong>
                                                        </span>
                                                    </div>
                                                </div>
                                            </li>
                                        </ul>
                                    </div>

                                    <!-- SINGLE ITEM LAYOUT -->
                                    <div v-else-if="scoutItemsArray.length === 1" class="space-y-3">
                                        <!-- AI Found Image Thumbnail -->
                                        <div v-if="scoutItemsArray[0].image" class="mb-2 flex justify-center">
                                            <img :src="proxify(scoutItemsArray[0].image)" class="h-32 object-contain rounded-xl shadow-md border border-base-300" alt="AI Found Item" @error="$event.target.style.display = 'none'" />
                                        </div>

                                        <!-- Red Flags -->
                                        <div v-if="scoutItemsArray[0].red_flags && scoutItemsArray[0].red_flags.length > 0" class="alert alert-warning shadow-xs p-2.5 text-xs">
                                            <span class="font-bold"><Icon icon="solar:danger-triangle-bold" class="w-4 h-4 inline mr-1" /> Flags:</span> {{ scoutItemsArray[0].red_flags.join(', ') }}
                                        </div>
                                    </div>

                                    <!-- SUGGESTED VALUATION MATRIX (2x2 Grid) -->
                                    <div v-if="scoutTotalRange || scoutItemsArray[0]?.price_breakdown" class="grid grid-cols-2 gap-2 pt-1">
                                        <div class="flex flex-col items-center bg-base-200/60 p-2.5 rounded-xl border border-base-300 shadow-xs">
                                            <span class="badge badge-xs font-bold bg-success/20 text-success border-success/40 mb-1">MINT</span>
                                            <span class="font-mono font-black text-xs sm:text-sm text-base-content">{{ scoutTotalRange ? scoutTotalRange.mint.formatted : formatPriceRange(scoutItemsArray[0]?.price_breakdown?.mint) }}</span>
                                        </div>
                                        <div class="flex flex-col items-center bg-base-200/60 p-2.5 rounded-xl border border-primary/40 shadow-xs ring-1 ring-primary/20">
                                            <span class="badge badge-xs font-bold bg-primary/20 text-primary border-primary/40 mb-1">FAIR</span>
                                            <span class="font-mono font-black text-xs sm:text-sm text-base-content">{{ scoutTotalRange ? scoutTotalRange.fair.formatted : formatPriceRange(scoutItemsArray[0]?.price_breakdown?.fair) }}</span>
                                        </div>
                                        <div class="flex flex-col items-center bg-base-200/60 p-2.5 rounded-xl border border-base-300 shadow-xs">
                                            <span class="badge badge-xs font-bold bg-error/20 text-error border-error/40 mb-1">POOR</span>
                                            <span class="font-mono font-black text-xs sm:text-sm text-base-content">{{ scoutTotalRange ? scoutTotalRange.poor.formatted : formatPriceRange(scoutItemsArray[0]?.price_breakdown?.poor) }}</span>
                                        </div>
                                        <div class="flex flex-col items-center bg-base-200/60 p-2.5 rounded-xl border border-secondary/40 shadow-xs">
                                            <span class="badge badge-xs font-bold bg-secondary/20 text-secondary border-secondary/40 mb-1">BOUTIQUE</span>
                                            <span class="font-mono font-black text-xs sm:text-sm text-base-content">{{ scoutTotalRange ? scoutTotalRange.boutique.formatted : (formatPriceRange(scoutItemsArray[0]?.price_breakdown?.boutique_premium) || '-') }}</span>
                                        </div>
                                    </div>

                                    <!-- LOT MARKET STRATEGY & LIQUIDATION -->
                                    <div v-if="scoutResult?.market_report || (Array.isArray(scoutResult) && scoutResult[0]?.market_report) || scoutItemsArray[0]?.market_report" class="bg-base-100 p-3 rounded-2xl border border-primary/30 shadow-xs space-y-2.5">
                                        <div class="flex items-center justify-between border-b border-base-200 pb-2">
                                            <span class="text-xs font-bold flex items-center gap-1.5 text-primary">
                                                <Icon icon="solar:chart-square-bold" class="w-4 h-4" />
                                                Lot Market Strategy & Liquidation
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

                                        <!-- Channel Comparisons / Trade-Offs (2-line layout with full channel name & readable pill) -->
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
                                            <button type="button" class="btn btn-xs join-item btn-outline text-[10px]" :class="{ 'btn-active btn-primary': !saveIndividually }" @click="saveIndividually = false">
                                                Save as Single Bundle
                                            </button>
                                            <button type="button" class="btn btn-xs join-item btn-outline text-[10px]" :class="{ 'btn-active btn-primary': saveIndividually }" @click="saveIndividually = true">
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
                                        <button v-if="saveIndividually && props.item" type="button" class="btn btn-primary btn-sm flex-1 font-bold shadow-xs gap-1.5" @click="deconstructAiLot">
                                            <Icon icon="solar:scissors-linear" class="w-4 h-4" />
                                            <span>Split Lot ({{ scoutItemsArray.length }} Items)</span>
                                        </button>
                                        <button v-else type="button" class="btn btn-secondary btn-sm flex-1 font-bold shadow-xs gap-1.5 text-white" @click="applyBundleSuggestions">
                                            <Icon icon="solar:magic-stick-linear" class="w-4 h-4" />
                                            <span>Apply AI to Listing Description</span>
                                        </button>
                                        <button v-if="scoutMdText" type="button" class="btn btn-outline btn-sm px-3" @click="openMdModal" title="View Full Report">
                                            <Icon icon="solar:document-text-linear" class="w-4 h-4" />
                                            <span class="sm:hidden">Report</span>
                                        </button>
                                    </div>
                                </div>

                                <!-- Empty State Prompt -->
                                <div v-else class="text-center py-6 border-2 border-dashed rounded-xl border-base-300 opacity-60 text-xs space-y-1">
                                    <Icon icon="solar:magic-stick-linear" class="w-6 h-6 mx-auto opacity-70" />
                                    <p class="font-medium">No AI report yet. Click "AI Deep Research" below to appraise this item.</p>
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
                                        <button class="btn btn-xs btn-outline btn-secondary font-bold gap-1" @click="generateDescription" :disabled="generatingDescription || !item">
                                            <span v-if="generatingDescription" class="loading loading-spinner loading-xs"></span>
                                            <Icon v-else icon="mingcute:gemini-fill" class="w-3.5 h-3.5" />
                                            AI Generate
                                        </button>

                                        <div class="join border border-base-300 rounded-lg overflow-hidden">
                                            <button type="button" class="btn btn-xs join-item" :class="descTab === 'edit' ? 'btn-active btn-neutral' : 'btn-ghost'" @click="descTab = 'edit'">Edit</button>
                                            <button type="button" class="btn btn-xs join-item" :class="descTab === 'preview' ? 'btn-active btn-neutral' : 'btn-ghost'" @click="descTab = 'preview'">Preview</button>
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

                    <div class="h-10"></div>
                </div>

                <!-- VERIFY CHECKLIST TAB -->
                <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5" v-show="mainTab === 'verify'">
                    <div class="alert alert-info py-2 shadow-sm text-xs sm:text-sm">
                        <Icon icon="solar:smart-speaker-minimalistic-linear" class="w-5 h-5 shrink-0" />
                        <span>Photograph the back-of-box contents list to automatically generate an item checklist.</span>
                    </div>

                    <ScannerWidget @photos-captured="handleVerifyPhotosCaptured" :hide-upload="false" />

                    <div v-if="extracting" class="flex flex-col items-center py-10">
                        <span class="loading loading-spinner text-primary w-10 h-10 mb-3"></span>
                        <p class="font-bold text-xs opacity-70">AI is extracting components from photos...</p>
                    </div>

                    <div v-if="componentsList && componentsList.length > 0" class="space-y-2">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-bold text-xs uppercase tracking-wider">Verification Checklist</span>
                            <button class="btn btn-xs btn-ghost text-error" @click="componentsList = []">Clear</button>
                        </div>
                        <div v-for="(comp, idx) in componentsList" :key="idx" class="flex items-center gap-3 bg-base-200 p-3 rounded-xl border border-base-300">
                            <input type="checkbox" v-model="comp.verified" class="checkbox checkbox-primary checkbox-sm" @change="handleVerifiedToggle(comp)" />
                            <div class="flex-1 min-w-0 font-bold text-xs truncate" :class="{'line-through opacity-50': comp.verified}">{{ comp.name }}</div>
                            <div class="flex items-center gap-1.5 bg-base-100 rounded-lg p-1 border border-base-300 font-mono text-xs">
                                <button class="btn btn-xs btn-circle btn-ghost" @click="comp.found = Math.max(0, comp.found - 1)">-</button>
                                <span class="w-8 text-center font-bold">{{ comp.found }} / {{ comp.expected }}</span>
                                <button class="btn btn-xs btn-circle btn-ghost" @click="comp.found++">+</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- LOT DASHBOARD TAB -->
                <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5" v-show="mainTab === 'lot'">
                    <!-- Rollback / Uncombine Banner for Master Lots -->
                    <div v-if="lotChildren && lotChildren.length > 0" class="bg-error/10 border border-error/30 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                        <div class="flex items-start sm:items-center gap-2 text-xs">
                            <div class="w-7 h-7 rounded-lg bg-error/20 flex items-center justify-center text-error font-bold shrink-0 mt-0.5 sm:mt-0">
                                <Icon icon="solar:history-bold" class="w-4 h-4" />
                            </div>
                            <div>
                                <div class="font-extrabold text-base-content">Combined Master Lot ({{ lotChildren.length }} Items Linked)</div>
                                <div class="text-[11px] opacity-70">Rollback to restore all original items as independent active inventory.</div>
                            </div>
                        </div>
                        <button 
                            type="button" 
                            class="btn btn-xs btn-error font-bold shadow-xs gap-1 self-end sm:self-center shrink-0" 
                            @click="uncombineLot" 
                            :disabled="uncombining"
                            title="Restore original items and remove master lot"
                        >
                            <span v-if="uncombining" class="loading loading-spinner loading-xs"></span>
                            <Icon v-else icon="solar:restart-bold" class="w-3.5 h-3.5" />
                            <span>Rollback &amp; Uncombine</span>
                        </button>
                    </div>

                    <div class="alert alert-secondary py-2 shadow-sm text-xs sm:text-sm">
                        <Icon icon="solar:box-linear" class="w-5 h-5 shrink-0" />
                        <span>Track items extracted from this box and calculated total lot ROI.</span>
                    </div>

                    <div class="stats stats-horizontal shadow-sm w-full bg-base-200 border border-base-300 text-xs">
                        <div class="stat px-3 py-2">
                            <div class="stat-title text-[10px] font-bold">Box Cost</div>
                            <div class="stat-value text-base">${{ Number(lotDashboardItem?.cost || 0).toFixed(2) }}</div>
                        </div>
                        <div class="stat px-3 py-2">
                            <div class="stat-title text-[10px] font-bold">Realized Revenue</div>
                            <div class="stat-value text-base text-success">${{ lotRealizedRevenue.toFixed(2) }}</div>
                        </div>
                        <div class="stat px-3 py-2">
                            <div class="stat-title text-[10px] font-bold">Net ROI</div>
                            <div class="stat-value text-base" :class="lotROI >= 0 ? 'text-success' : 'text-error'">
                                {{ lotROI >= 0 ? '+' : '' }}${{ lotROI.toFixed(2) }}
                            </div>
                        </div>
                    </div>

                    <!-- Inline Child Item Extractor Form -->
                    <div class="bg-base-200/60 rounded-2xl p-4 border border-base-300 space-y-3">
                        <div class="font-bold text-xs uppercase tracking-wider text-base-content/80 flex items-center gap-1.5">
                            <Icon icon="solar:add-circle-bold" class="w-4 h-4 text-primary" />
                            Extract & Add Item from Lot
                        </div>
                        <div class="space-y-2">
                            <input type="text" v-model="newChild.title" placeholder="Item Title / Model / Description..." class="input input-bordered input-sm w-full text-xs font-semibold bg-base-100" />
                            <div class="grid grid-cols-3 gap-2">
                                <div class="relative">
                                    <span class="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50 font-bold text-xs">$</span>
                                    <input type="number" step="0.01" v-model="newChild.cost" placeholder="Cost" class="input input-bordered input-sm w-full pl-5 font-mono text-xs bg-base-100" title="Cost Basis Allocation" />
                                </div>
                                <div class="relative">
                                    <span class="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50 font-bold text-xs">$</span>
                                    <input type="number" step="0.01" v-model="newChild.resalePrice" placeholder="List Price" class="input input-bordered input-sm w-full pl-5 font-mono text-xs bg-base-100" title="Resale List Price" />
                                </div>
                                <select v-model="newChild.status" class="select select-bordered select-sm w-full text-xs bg-base-100">
                                    <option value="acquired">Acquired</option>
                                    <option value="received">Received</option>
                                    <option value="placed">Placed</option>
                                    <option value="sold">Sold</option>
                                </select>
                            </div>
                            <div v-if="newChild.status === 'sold'" class="relative">
                                <span class="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50 font-bold text-xs text-success">$</span>
                                <input type="number" step="0.01" v-model="newChild.soldPrice" placeholder="Actual Sold Price..." class="input input-bordered input-sm w-full pl-5 font-mono text-xs bg-base-100 border-success" />
                            </div>
                            <button class="btn btn-primary btn-sm w-full font-bold shadow-xs" @click="createChildItem" :disabled="!newChild.title.trim() || creatingChild">
                                <span v-if="creatingChild" class="loading loading-spinner loading-xs"></span>
                                <Icon v-else icon="solar:add-circle-linear" class="w-4 h-4 mr-1" />
                                Add Item to Lot
                            </button>
                        </div>
                    </div>

                    <!-- Extracted items list -->
                    <div class="space-y-2">
                        <div class="font-bold text-xs uppercase tracking-wider border-b border-base-200 pb-1">Extracted Items ({{ lotChildren?.length || 0 }})</div>
                        <div v-if="!lotChildren || lotChildren.length === 0" class="text-center opacity-50 py-8 border-2 border-dashed rounded-xl border-base-300 text-xs">
                            No child items extracted yet.
                        </div>
                        <div v-for="child in lotChildren" :key="child.$id" class="flex justify-between items-center bg-base-200/70 p-2.5 rounded-xl border border-base-300 text-xs">
                            <span class="font-bold truncate max-w-55">{{ child.title }}</span>
                            <div class="flex items-center gap-2">
                                <span class="badge badge-xs" :class="child.status === 'sold' ? 'badge-success' : 'badge-ghost'">{{ child.status }}</span>
                                <span class="font-mono font-bold">${{ Number(child.soldPrice || child.resalePrice || 0).toFixed(2) }}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- FOOTER (Sticky Action Toolbar - Clean & Focused) -->
                <div class="p-3 sm:px-6 pb-safe border-t border-base-200 flex flex-row justify-between items-center bg-base-100 z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] gap-3 shrink-0">
                    <div>
                        <button class="btn btn-secondary btn-sm sm:btn-md shadow-sm gap-1.5 font-bold" @click="analyzeExistingItem" :disabled="analyzing || (!actualMainPhoto.url && !editForm.sourcingLocation && !editForm.title && !editForm.condition_notes && (!editForm.existingGalleryIds || editForm.existingGalleryIds.length === 0))">
                            <span v-if="analyzing" class="loading loading-spinner loading-xs"></span>
                            <Icon v-else icon="solar:magic-stick-linear" class="w-4 h-4" />
                            <span class="hidden sm:inline">{{ analyzing ? (analysisStatus || 'Analyzing...') : 'AI Deep Research' }}</span>
                            <span class="sm:hidden">{{ analyzing ? 'Scouting...' : 'Research' }}</span>
                        </button>
                    </div>

                    <div class="flex items-center gap-2">
                        <button class="btn btn-ghost btn-sm sm:btn-md" @click="closeDrawer">Cancel</button>
                        <button class="btn btn-primary btn-sm sm:btn-md font-bold px-6 shadow-md" @click="saveEdit" :disabled="processing">
                            <span v-if="processing" class="loading loading-spinner loading-xs mr-1"></span>
                            <Icon v-else icon="solar:diskette-bold" class="w-4 h-4 mr-1" />
                            Save Item
                        </button>
                    </div>
                </div>
            </div>

            <!-- Visual Photo Selector Modal for Bundle Components -->
            <dialog id="photo_picker_modal" class="modal" :class="{'modal-open': pickingPhotoForItemIndex !== null}">
                <div class="modal-box max-w-2xl bg-base-100 p-5 rounded-2xl border border-base-200 shadow-2xl">
                    <div class="flex justify-between items-center pb-3 border-b border-base-200">
                        <div class="flex items-center gap-2">
                            <Icon icon="solar:gallery-wide-bold" class="w-5 h-5 text-primary" />
                            <h3 class="font-bold text-sm sm:text-base">
                                Choose Photo for Item #{{ pickingPhotoForItemIndex !== null ? pickingPhotoForItemIndex + 1 : '' }}
                            </h3>
                        </div>
                        <button class="btn btn-sm btn-circle btn-ghost" @click="pickingPhotoForItemIndex = null">✕</button>
                    </div>

                    <p class="text-xs opacity-60 mt-2">
                        Select a photo from the gallery to assign as the primary image for this bundle item:
                    </p>

                    <div v-if="allAvailableGalleryUrls.length > 0" class="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-4 max-h-[50vh] overflow-y-auto p-1">
                        <div 
                            v-for="(photoUrl, pIdx) in allAvailableGalleryUrls" 
                            :key="pIdx"
                            @click="assignPhotoToComponent(pickingPhotoForItemIndex, photoUrl, pIdx)"
                            class="aspect-square rounded-xl overflow-hidden border-2 cursor-pointer relative group transition-all"
                            :class="isPhotoAssigned(pickingPhotoForItemIndex, pIdx) ? 'border-primary ring-2 ring-primary/40' : 'border-base-300 hover:border-primary/50'"
                        >
                            <img :src="photoUrl" class="w-full h-full object-cover" />
                            <div class="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                                Photo {{ pIdx + 1 }}
                            </div>
                            <div v-if="isPhotoAssigned(pickingPhotoForItemIndex, pIdx)" class="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                <Icon icon="solar:check-circle-bold" class="w-6 h-6 text-primary" />
                            </div>
                        </div>
                    </div>
                    <div v-else class="text-center py-8 opacity-40 text-xs italic">
                        No gallery photos available yet. Fetch or upload photos first.
                    </div>

                    <div class="modal-action border-t border-base-200 pt-3">
                        <button class="btn btn-sm" @click="pickingPhotoForItemIndex = null">Done</button>
                    </div>
                </div>
                <form method="dialog" class="modal-backdrop" @click="pickingPhotoForItemIndex = null">
                    <button>close</button>
                </form>
            </dialog>

            <!-- Full Markdown Scout Report Modal -->
            <dialog v-if="showMdModal" class="modal modal-open z-999">
                <div class="modal-box max-w-3xl max-h-[85vh] flex flex-col p-6">
                    <div class="flex justify-between items-center pb-3 border-b border-base-300">
                        <h3 class="font-bold text-base flex items-center gap-2">
                            <Icon icon="solar:document-text-bold" class="w-5 h-5 text-primary" />
                            AI Deep Research Report
                        </h3>
                        <button class="btn btn-sm btn-circle btn-ghost" @click="showMdModal = false">✕</button>
                    </div>
                    <div class="flex-1 overflow-y-auto py-4 prose prose-sm max-w-none" v-html="renderMarkdown(scoutMdText)">
                    </div>
                    <div class="modal-action border-t border-base-300 pt-3 flex justify-between">
                        <button class="btn btn-sm btn-outline gap-1" @click="copyToClipboard(scoutMdText)">
                            <Icon icon="solar:copy-linear" class="w-4 h-4" /> Copy Report
                        </button>
                        <button class="btn btn-sm btn-primary" @click="showMdModal = false">Close</button>
                    </div>
                </div>
                <form method="dialog" class="modal-backdrop" @click="showMdModal = false">
                    <button>close</button>
                </form>
            </dialog>
        </div>
    </Teleport>
</template>

<script setup>
import { ref, reactive, watch, computed, onMounted, onUnmounted } from 'vue';
import { marked } from 'marked';
import ScannerWidget from './ScannerWidget.vue';
import TagInput from './TagInput.vue';
import MultiSelectDropdown from './MultiSelectDropdown.vue';
import SingleSelectDropdown from './SingleSelectDropdown.vue';
import { saveItemToInventory, getCollectionId } from '../../lib/inventory';
import { account, databases, Query } from '../../lib/appwrite';
import { useAuth } from '../../composables/useAuth';
import { addToast } from '../../stores/toast';
import { confirmDialog } from '../../stores/confirm';
import { ID } from 'appwrite';
import { BUCKET_ID, REPORTS_BUCKET_ID } from '../../lib/inventory';
import { Icon } from '@iconify/vue';
import { useLoader } from '../../composables/useLoader';
import { warehousesApi } from '../../lib/warehouses';

const { currentTeam } = useAuth();
const { showLoader, hideLoader, updateLoader } = useLoader();
const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
const orgPlacedLocations = ref([]);
const orgWarehouses = ref([]);

const allLocations = computed(() => {
    const set = new Set();
    if (orgPlacedLocations.value) orgPlacedLocations.value.forEach(l => l && set.add(String(l).trim()));
    if (orgWarehouses.value) orgWarehouses.value.forEach(w => w?.name && set.add(String(w.name).trim()));
    return Array.from(set).filter(Boolean).sort();
});
const allStorageLocations = allLocations;

const fetchLocations = async () => {
    if (!currentTeam.value) return;
    try {
        const res = await databases.listDocuments(DB_ID, 'org_settings', [
            Query.equal('tenantId', currentTeam.value.$id)
        ]);
        if (res.documents.length) {
            orgPlacedLocations.value = res.documents[0].placedLocations || [];
        }
    } catch(e) {}

    try {
        const wList = await warehousesApi.listWarehouses(currentTeam.value.$id);
        orgWarehouses.value = wList || [];
    } catch(e) {}
};

onMounted(() => {
    document.body.style.overflow = 'hidden';
    fetchLocations();
});

watch(currentTeam, (n) => { if(n) fetchLocations(); });

onUnmounted(() => {
    document.body.style.overflow = '';
});

const PROJECT = import.meta.env.PUBLIC_APPWRITE_PROJECT_ID;
const ENDPOINT = import.meta.env.PUBLIC_APPWRITE_ENDPOINT;
const BUCKET = BUCKET_ID;
const REPORTS_BUCKET = REPORTS_BUCKET_ID;

const props = defineProps({
    item: {
        type: Object,
        default: null
    }
});

const emit = defineEmits(['close', 'save', 'uncombined', 'deconstruct']);

const mainTab = ref('details');
const descTab = ref('edit');
const scoutTab = ref('edit');
const processing = ref(false);
const isAcquisitionUnlocked = ref(false);
const showMdModal = ref(false);

const openMdModal = () => {
    if (scoutMdText.value) {
        showMdModal.value = true;
    }
};

const extracting = ref(false);
const componentsList = ref([]);

const calculatedMargin = computed(() => {
    const cost = parseFloat(editForm.cost || 0);
    const price = parseFloat(editForm.resalePrice || editForm.soldPrice || 0);
    if (price > 0 && cost >= 0) {
        return Math.round(((price - cost) / price) * 100);
    }
    return null;
});

const formatSourceDisplayName = (urlOrStr) => {
    if (!urlOrStr) return '';
    if (urlOrStr.includes('shopgoodwill.com')) return 'ShopGoodwill';
    if (urlOrStr.includes('ebay.com')) return 'eBay';
    if (urlOrStr.includes('poshmark.com')) return 'Poshmark';
    if (urlOrStr.includes('goodwillfinds.com')) return 'GoodwillFinds';
    return urlOrStr.length > 22 ? urlOrStr.substring(0, 20) + '...' : urlOrStr;
};

const performExtraction = async (imagesPayload) => {
    extracting.value = true;
    try {
        const bodyObj = { notes: scoutQuery.value };
        if (Array.isArray(imagesPayload)) {
            bodyObj.images = imagesPayload;
        } else {
            bodyObj.image = imagesPayload;
        }
        const res = await fetch('/api/extract-components', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyObj)
        });
        const data = await res.json();
        if (data.components) {
            componentsList.value = data.components;
        } else {
            addToast({ type: 'error', message: "Failed to parse list from image. " + (data.error || "") });
        }
    } catch(err) {
        addToast({ type: 'error', message: "Extraction error: " + err.message });
    } finally {
        extracting.value = false;
    }
};

const extractComponentsFromFile = async (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => performExtraction(reader.result);
};

const handleVerifyPhotosCaptured = async (files) => {
    if (!files || files.length === 0) return;
    if (files.length === 1) {
        extractComponentsFromFile(files[0]);
    } else {
        const base64List = await Promise.all(
            Array.from(files).slice(0, 10).map(file => new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(file);
            }))
        );
        const valid = base64List.filter(Boolean);
        if (valid.length > 0) {
            performExtraction(valid);
        }
    }
};

const handleVerifiedToggle = (comp) => {
     if (comp.verified && comp.found < comp.expected) {
          comp.found = comp.expected;
     }
};

async function copyToClipboard(text) {
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        addToast({ type: 'success', message: 'Copied to clipboard!' });
    } catch (e) {
        addToast({ type: 'error', message: 'Failed to copy to clipboard.' });
    }
}

const editForm = reactive({
    title: '',
    quantity: 1,
    cost: '',
    resalePrice: '',
    soldPrice: '',
    estLow: '',
    estHigh: '',
    storageLocation: '',
    sourcingLocation: '',
    orderId: '',
    status: 'acquired',
    description: '',
    condition_notes: '',
    itemCondition: '',
    existingGalleryIds: [],
    sellingLocations: [],
    keywords: [],
    countryOfOrigin: ''
});

watch(() => editForm.status, (newStatus) => {
    if (newStatus === 'sold' && (!editForm.soldPrice || editForm.soldPrice === '') && editForm.resalePrice) {
        const rp = parseFloat(editForm.resalePrice);
        if (!isNaN(rp) && rp > 0) {
            editForm.soldPrice = (rp * 0.85).toFixed(2);
            addToast({ type: 'info', message: 'Auto-filled Sold Price based on default payout.' });
        }
    }
});

const editGalleryBuffer = ref([]);
const mainPhotoSelection = ref({ type: 'none', val: null });

const actualMainPhoto = computed(() => {
    if (mainPhotoSelection.value.type === 'new' && editGalleryBuffer.value[mainPhotoSelection.value.val]) {
        return { 
            file: editGalleryBuffer.value[mainPhotoSelection.value.val], 
            url: getObjectUrl(editGalleryBuffer.value[mainPhotoSelection.value.val]),
            type: 'new',
            idx: mainPhotoSelection.value.val
        };
    } else if (mainPhotoSelection.value.type === 'existing' && editForm.existingGalleryIds.includes(mainPhotoSelection.value.val)) {
        return { 
            file: null, 
            url: getAssetUrl(mainPhotoSelection.value.val), 
            id: mainPhotoSelection.value.val,
            type: 'existing'
        };
    } else {
        if (editGalleryBuffer.value.length > 0) return { file: editGalleryBuffer.value[0], url: getObjectUrl(editGalleryBuffer.value[0]), type: 'new', idx: 0 };
        if (editForm.existingGalleryIds?.length > 0) return { file: null, url: getAssetUrl(editForm.existingGalleryIds[0]), id: editForm.existingGalleryIds[0], type: 'existing' };
        return { file: null, url: null, type: 'none' };
    }
});

const showOnStorefront = computed({
    get() {
        return editForm.sellingLocations && editForm.sellingLocations.includes('storefront');
    },
    set(val) {
        if (!editForm.sellingLocations) editForm.sellingLocations = [];
        if (val) {
            if (!editForm.sellingLocations.includes('storefront')) {
                editForm.sellingLocations.push('storefront');
            }
        } else {
            editForm.sellingLocations = editForm.sellingLocations.filter(loc => loc !== 'storefront');
        }
    }
});

const setMainPhoto = (type, val) => {
    mainPhotoSelection.value = { type, val };
};
const scoutResult = ref(null);

const scoutItemsArray = computed(() => {
    if (!scoutResult.value) return [];
    if (scoutResult.value.lot_items && Array.isArray(scoutResult.value.lot_items)) {
        return scoutResult.value.lot_items;
    }
    if (Array.isArray(scoutResult.value) && scoutResult.value.length === 1 && scoutResult.value[0]?.lot_items && Array.isArray(scoutResult.value[0].lot_items)) {
        return scoutResult.value[0].lot_items;
    }
    if (scoutResult.value.items && Array.isArray(scoutResult.value.items)) return scoutResult.value.items;
    if (Array.isArray(scoutResult.value)) return scoutResult.value;
    return [scoutResult.value];
});

const cropPreviews = ref({});

const suggestedTitleStr = computed(() => {
    if (!scoutResult.value) return null;
    if (scoutResult.value.title) return scoutResult.value.title;
    if (scoutResult.value.items && Array.isArray(scoutResult.value.items) && scoutResult.value.items.length > 0) {
        return scoutResult.value.items[0].title || scoutResult.value.items[0].identity || null;
    }
    if (Array.isArray(scoutResult.value) && scoutResult.value.length > 0) {
        return scoutResult.value[0].title || scoutResult.value[0].identity || null;
    }
    return null;
});

const suggestedListPriceStr = computed(() => {
    if (!scoutResult.value) return null;
    if (scoutResult.value.price_breakdown) {
        let fair = parsePrice(scoutResult.value.price_breakdown.fair);
        if (!fair) fair = parsePrice(scoutResult.value.price_breakdown.mint);
        if (fair > 0) return fair.toFixed(2);
    }
    if (scoutItemsArray.value.length > 1 && scoutTotalRange.value) {
        return ((scoutTotalRange.value.low + scoutTotalRange.value.high) / 2).toFixed(2);
    }
    let itemData = scoutItemsArray.value[0];
    if (!itemData) return null;
    let fair = parsePrice(itemData.price_breakdown?.fair);
    if (!fair && itemData.price_breakdown?.mint) fair = parsePrice(itemData.price_breakdown?.mint);
    return fair > 0 ? fair.toFixed(2) : null;
});

const suggestedEstLowStr = computed(() => {
    if (!scoutResult.value) return null;
    if (scoutResult.value.price_breakdown) {
        let poor = parsePrice(scoutResult.value.price_breakdown.poor);
        if (poor > 0) return poor.toFixed(2);
    }
    if (scoutItemsArray.value.length > 1 && scoutTotalRange.value) {
        return scoutTotalRange.value.low.toFixed(2);
    }
    let itemData = scoutItemsArray.value[0];
    if (!itemData) return null;
    let poor = parsePrice(itemData.price_breakdown?.poor);
    return poor > 0 ? poor.toFixed(2) : null;
});

const suggestedEstHighStr = computed(() => {
    if (!scoutResult.value) return null;
    if (scoutResult.value.price_breakdown) {
        let mint = parsePrice(scoutResult.value.price_breakdown.mint);
        if (mint > 0) return mint.toFixed(2);
    }
    if (scoutItemsArray.value.length > 1 && scoutTotalRange.value) {
        return scoutTotalRange.value.high.toFixed(2);
    }
    let itemData = scoutItemsArray.value[0];
    if (!itemData) return null;
    let mint = parsePrice(itemData.price_breakdown?.mint);
    return mint > 0 ? mint.toFixed(2) : null;
});

const suggestedDescriptionStr = computed(() => {
    if (!scoutResult.value) return null;
    let itemData = scoutItemsArray.value[0];
    if (!itemData) return null;
    return itemData.description || null;
});

const scoutMdText = ref(null);
const scoutQuery = ref('');
const fetchedImages = ref([]);
const downloadingImageUrls = ref({});
const fetchingImages = ref(false);
const analyzing = ref(false);
const analysisStatus = ref('');
const extractingLot = ref(false);
const saveIndividually = ref(false);
const generatingDescription = ref(false);

const getAssetUrl = (id) => {
    if (!id) return '';
    if (typeof id === 'string') {
        if (id.startsWith('http') || id.startsWith('data:') || id.startsWith('blob:') || id.startsWith('/api/')) {
            return proxify(id);
        }
    }
    if (!BUCKET) return '';
    try {
        return `${ENDPOINT}/storage/buckets/${BUCKET}/files/${id}/view?project=${PROJECT}`;
    } catch (e) { return ''; }
};

const objectUrls = new WeakMap();
const getObjectUrl = (file) => {
    if (!objectUrls.has(file)) objectUrls.set(file, URL.createObjectURL(file));
    return objectUrls.get(file);
};
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

const parsePrice = (p) => {
    if (!p) return 0;
    if (typeof p === 'number') return p;
    if (Array.isArray(p)) {
        if (p.length >= 2) return (parseFloat(String(p[0])) + parseFloat(String(p[1]))) / 2;
        if (p.length === 1) return parseFloat(String(p[0]));
        return 0;
    }
    if (typeof p === 'object') {
        const l = parseFloat((p.low || p.min || p.mint || 0).toString().replace(/,/g, ''));
        const h = parseFloat((p.high || p.max || p.fair || l).toString().replace(/,/g, ''));
        return (l + h) / 2;
    }
    const s = String(p).replace(/[$,]/g, '').trim(); 
    const range = s.match(/(\d+(?:\.\d+)?)\s*(?:[-–—−]|to)\s*(\d+(?:\.\d+)?)/i);
    if (range) return (parseFloat(range[1]) + parseFloat(range[2])) / 2;
    const single = s.match(/(\d+(?:\.\d+)?)/);
    return single ? parseFloat(single[1]) : 0;
};

const parsePriceRange = (p) => {
    if (!p) return { low: 0, high: 0, mid: 0 };
    if (Array.isArray(p)) {
        if (p.length >= 2) {
            const l = parseFloat(String(p[0])) || 0;
            const h = parseFloat(String(p[1])) || l;
            return { low: l, high: h, mid: (l + h) / 2 };
        }
        if (p.length === 1) {
            const val = parseFloat(String(p[0])) || 0;
            return { low: val, high: val, mid: val };
        }
        return { low: 0, high: 0, mid: 0 };
    }
    const s = String(p).replace(/[$,]/g, '').trim();
    const range = s.match(/(\d+(?:\.\d+)?)\s*(?:[-–—−]|to)\s*(\d+(?:\.\d+)?)/i);
    if (range) {
        const l = parseFloat(range[1]);
        const h = parseFloat(range[2]);
        return { low: l, high: h, mid: (l + h) / 2 };
    }
    const single = s.match(/(\d+(?:\.\d+)?)/);
    const val = single ? parseFloat(single[1]) : 0;
    return { low: val, high: val, mid: val };
};

const scoutTotalRange = computed(() => {
    if (!scoutItemsArray.value || scoutItemsArray.value.length === 0) return null;
    
    const parseLowHigh = (priceVal) => {
        if (!priceVal) return { low: 0, high: 0 };
        let low = 0, high = 0;
        if (Array.isArray(priceVal)) {
            low = parseFloat(String(priceVal[0])) || 0;
            high = parseFloat(String(priceVal[1])) || low;
        } else if (typeof priceVal === 'object' && priceVal !== null) {
            const parsed = parsePriceRange(priceVal);
            low = parsed.low;
            high = parsed.high;
        } else {
            const s = String(priceVal).replace(/[$,]/g, '').trim(); 
            const range = s.match(/(\d+(?:\.\d+)?)\s*(?:[-–—−]|to)\s*(\d+(?:\.\d+)?)/i);
            if (range) {
                low = parseFloat(range[1]) || 0;
                high = parseFloat(range[2]) || 0;
            } else {
                const single = s.match(/(\d+(?:\.\d+)?)/);
                if (single) {
                    low = parseFloat(single[1]) || 0;
                    high = low;
                }
            }
        }
        if (high < low) high = low;
        return { low, high };
    };

    let mintLow = 0, mintHigh = 0;
    let fairLow = 0, fairHigh = 0;
    let poorLow = 0, poorHigh = 0;
    let boutiqueLow = 0, boutiqueHigh = 0;
    
    scoutItemsArray.value.forEach(resItem => {
        const mint = parseLowHigh(resItem.price_breakdown?.mint);
        mintLow += mint.low;
        mintHigh += mint.high;

        const fair = parseLowHigh(resItem.price_breakdown?.fair || resItem.estimated_value);
        fairLow += fair.low;
        fairHigh += fair.high;

        const poor = parseLowHigh(resItem.price_breakdown?.poor);
        poorLow += poor.low;
        poorHigh += poor.high;

        if (resItem.price_breakdown?.boutique_premium) {
            const b = parseLowHigh(resItem.price_breakdown.boutique_premium);
            boutiqueLow += b.low;
            boutiqueHigh += b.high;
        } else {
            boutiqueLow += fair.low;
            boutiqueHigh += fair.high;
        }
    });

    const formatRange = (low, high) => {
        if (low === 0 && high === 0) return '-';
        return low === high ? `$${low.toFixed(0)}` : `$${low.toFixed(0)} - $${high.toFixed(0)}`;
    };

    return {
        low: fairLow,
        high: fairHigh,
        formatted: formatRange(fairLow, fairHigh),
        mint: { low: mintLow, high: mintHigh, formatted: formatRange(mintLow, mintHigh) },
        fair: { low: fairLow, high: fairHigh, formatted: formatRange(fairLow, fairHigh) },
        poor: { low: poorLow, high: poorHigh, formatted: formatRange(poorLow, poorHigh) },
        boutique: { low: boutiqueLow, high: boutiqueHigh, formatted: formatRange(boutiqueLow, boutiqueHigh) }
    };
});

function formatPriceRange(val) {
    if (!val) return '-';
    if (typeof val === 'string' && val.trim().startsWith('{')) {
        try { val = JSON.parse(val); } catch (e) { }
    }
    if (typeof val === 'string' && val.trim().startsWith('[')) {
        try { val = JSON.parse(val); } catch (e) { }
    }
    if (Array.isArray(val)) {
        if (val.length >= 2) return `$${parseFloat(String(val[0])).toFixed(0)} - $${parseFloat(String(val[1])).toFixed(0)}`;
        if (val.length === 1) return `$${parseFloat(String(val[0])).toFixed(0)}`;
        return '-';
    }
    if (typeof val === 'object' && val !== null) {
        const low = val.low ?? val.Low ?? val.min ?? val.Min ?? val.low_price ?? val.start;
        const high = val.high ?? val.High ?? val.max ?? val.Max ?? val.high_price ?? val.end;
        if (low !== undefined && high !== undefined) return `$${low} - $${high}`;
        if (low !== undefined) return `$${low}+`;
        return JSON.stringify(val).replace(/[{}"]/g, '').replace(/,/g, ', ');
    }
    return val;
}

const shippingCosts = computed(() => {
    if (scoutResult.value && scoutResult.value.shipping_info) {
        const sInfo = scoutResult.value.shipping_info;
        const shipping = parseFloat(sInfo.shipping) || 0;
        const handling = parseFloat(sInfo.handling) || 0;
        const total = parseFloat(sInfo.total) || (shipping + handling);
        return { shipping, handling, total };
    }
    const notes = props.item?.conditionNotes || '';
    const match = notes.match(/\[Shipping:\s*\$([\d.]+),\s*Handling:\s*\$([\d.]+)/i);
    if (match) {
        const shipping = parseFloat(match[1]) || 0;
        const handling = parseFloat(match[2]) || 0;
        return { shipping, handling, total: shipping + handling };
    }
    return { shipping: 0, handling: 0, total: 0 };
});

const pickingPhotoForItemIndex = ref(null);

const allAvailableGalleryUrls = computed(() => {
    const urls = [];
    if (actualMainPhoto.value?.url) urls.push(actualMainPhoto.value.url);
    if (editForm.existingGalleryIds) {
        editForm.existingGalleryIds.forEach(id => {
            const u = getAssetUrl(id);
            if (u && !urls.includes(u)) urls.push(u);
        });
    }
    if (editGalleryBuffer.value) {
        editGalleryBuffer.value.forEach(file => {
            const u = getObjectUrl(file);
            if (u && !urls.includes(u)) urls.push(u);
        });
    }
    if (urls.length === 0 && props.item?.imageId) {
        urls.push(getAssetUrl(props.item.imageId));
    }
    return urls;
});

const openPhotoPicker = (idx) => {
    pickingPhotoForItemIndex.value = idx;
};

const assignPhotoToComponent = (itemIdx, photoUrl, photoIdx) => {
    if (itemIdx === null || itemIdx === undefined) return;
    const list = scoutItemsArray.value;
    if (!list || !list[itemIdx]) return;

    const item = list[itemIdx];
    item.image_index = photoIdx;
    item.image = photoUrl;
    item.bounding_box = null;
    cropPreviews.value[itemIdx] = photoUrl;
    pickingPhotoForItemIndex.value = null;
    addToast({ type: 'success', message: `Assigned Photo ${photoIdx + 1} to Item #${itemIdx + 1}` });
};

const isPhotoAssigned = (itemIdx, photoIdx) => {
    if (itemIdx === null || itemIdx === undefined) return false;
    const item = scoutItemsArray.value[itemIdx];
    if (!item) return false;
    return item.image_index === photoIdx;
};

const swapComponentPhotos = (idxA, idxB) => {
    const list = scoutItemsArray.value;
    if (!list || !list[idxA] || !list[idxB]) return;

    const itemA = list[idxA];
    const itemB = list[idxB];

    const tempBox = itemA.bounding_box;
    const tempImgIdx = itemA.image_index;
    const tempImg = itemA.image;

    itemA.bounding_box = itemB.bounding_box;
    itemA.image_index = itemB.image_index;
    itemA.image = itemB.image;

    itemB.bounding_box = tempBox;
    itemB.image_index = tempImgIdx;
    itemB.image = tempImg;

    const tempCrop = cropPreviews.value[idxA];
    cropPreviews.value[idxA] = cropPreviews.value[idxB];
    cropPreviews.value[idxB] = tempCrop;
};

const generateCropPreviews = async (items) => {
    if (!items || items.length === 0) return;
    const galleryUrls = allAvailableGalleryUrls.value;
    if (!galleryUrls || galleryUrls.length === 0) return;

    for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        if (item.image_url) {
            cropPreviews.value[idx] = item.image_url;
            continue;
        }
        if (item.image_index !== undefined && galleryUrls[item.image_index]) {
            cropPreviews.value[idx] = galleryUrls[item.image_index];
            continue;
        }
        if (item.image) {
            cropPreviews.value[idx] = item.image;
        }
    }
};

watch(scoutResult, (newVal) => {
    if (newVal) {
        cropPreviews.value = {};
        setTimeout(() => {
            generateCropPreviews(scoutItemsArray.value);
        }, 100);
    }
});

const getNoteValue = (notes, key, isCurrency = false) => {
    if (!notes) return null;
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${escapedKey}:[ \\t]*([^\\n\\r]+)`, 'i');
    const match = notes.match(regex);
    if (match) {
        let val = match[1].trim();
        if (isCurrency) val = val.replace('$', '').trim();
        return val;
    }
    return null;
};

const getImageUrl = (itemData) => {
    let id = itemData.imageId;
    if (!id && itemData.galleryImageIds?.length > 0) id = itemData.galleryImageIds[0];
    if (!id && itemData.conditionNotes) {
         const match = itemData.conditionNotes.match(/\[MAIN IMAGE ID: ([^\]]+)\]/);
         if (match) id = match[1].split(',')[0].trim();
    }
    return id ? getAssetUrl(id) : null;
};

const lotChildren = ref([]);
const parentLot = ref(null);
const loadingLot = ref(false);
const creatingChild = ref(false);

const newChild = reactive({
    title: '',
    cost: '',
    resalePrice: '',
    status: 'acquired',
    soldPrice: ''
});

const lotDashboardItem = computed(() => parentLot.value || props.item);
const lotSoldChildren = computed(() => (lotChildren.value || []).filter(c => c.status === 'sold'));
const lotRealizedRevenue = computed(() => lotSoldChildren.value.reduce((sum, c) => sum + (Number(c.soldPrice) || 0), 0));
const lotROI = computed(() => lotRealizedRevenue.value - Number(lotDashboardItem.value?.cost || 0));

async function fetchLotChildren() {
    if (!props.item || !props.item.$id) return;
    loadingLot.value = true;
    try {
        const targetParentId = props.item.parentLotId || props.item.$id;
        const res = await databases.listDocuments(DB_ID, getCollectionId(), [
            Query.equal('parentLotId', targetParentId),
            Query.limit(100)
        ]);
        lotChildren.value = res.documents || [];
    } catch (e) {
        console.error("Failed to fetch lot items:", e);
    } finally {
        loadingLot.value = false;
    }
}

const uncombining = ref(false);
const uncombineLot = async () => {
    if (!props.item || !props.item.$id) return;
    const count = lotChildren.value.length;
    const confirmMsg = count > 0 
        ? `Rollback & uncombine this lot? This will restore all ${count} individual items back to active inventory and delete this combined master lot.`
        : `Uncombine and remove this master lot?`;
    
    if (!window.confirm(confirmMsg)) return;

    uncombining.value = true;
    showLoader("Rolling back lot...", {
        step: "Restoring original items & removing master lot...",
        progress: 50,
        cancelable: false
    });

    try {
        // 1. Restore all child / constituent items
        for (const child of lotChildren.value) {
            await databases.updateDocument(DB_ID, getCollectionId(), child.$id, {
                parentLotId: null,
                status: (child.status === 'combined' || child.status === 'archived') ? 'acquired' : child.status
            });
        }

        // 2. Delete the master lot document
        await databases.deleteDocument(DB_ID, getCollectionId(), props.item.$id);

        addToast({ type: 'success', message: `Successfully rolled back lot and restored ${count} items!` });
        emit('uncombined');
        emit('close');
    } catch (e) {
        addToast({ type: 'error', message: 'Rollback failed: ' + e.message });
    } finally {
        uncombining.value = false;
        hideLoader();
    }
};

const initForm = () => {
    // If editing existing item, start with acquisition details locked to prevent fat-finger / AI overwrites
    isAcquisitionUnlocked.value = !props.item;

    if (props.item) {
        const i = props.item;
        const formatMoney = (val) => {
            if (val === undefined || val === null || val === '') return '';
            const num = parseFloat(val);
            return isNaN(num) ? '' : num.toFixed(2);
        };

        editForm.title = i.title || '';
        editForm.quantity = i.quantity || 1;
        editForm.cost = formatMoney(i.cost || i.purchasePrice || getNoteValue(i.conditionNotes, 'Paid', true));
        editForm.resalePrice = formatMoney(i.resalePrice || i.priceFair || i.listPrice || getNoteValue(i.conditionNotes, 'Resale', true));
        editForm.soldPrice = formatMoney(i.soldPrice);
        editForm.estLow = formatMoney(i.estLow || getNoteValue(i.conditionNotes, 'Est. Low', true));
        editForm.estHigh = formatMoney(i.estHigh || getNoteValue(i.conditionNotes, 'Est. High', true));
        editForm.storageLocation = i.storageLocation || '';
        editForm.sourcingLocation = i.sourcingLocation || getNoteValue(i.conditionNotes, 'Location') || '';
        editForm.orderId = i.orderId || getNoteValue(i.conditionNotes, 'Order #') || getNoteValue(i.conditionNotes, 'Imported from Order #') || '';
        editForm.status = i.status || 'acquired';
        editForm.parentLotId = i.parentLotId || null;
        let desc = i.marketDescription || i.description || '';
        if (desc && typeof desc === 'string' && desc.trim().startsWith('{') && desc.includes('"identity"')) {
            desc = '';
        }
        editForm.description = desc; 
        
        // Clean and populate user internal notes
        const rawNotes = i.conditionNotes || i.condition_notes || '';
        editForm.condition_notes = rawNotes
            .replace(/\[[A-Z0-9_ ]+:[^\]]+\]/gi, '')
            .replace(/--- IMPORT DETAILS ---[\s\S]*/gi, '')
            .trim();

        editForm.itemCondition = getNoteValue(i.conditionNotes, 'Condition') || '';
        editForm.existingGalleryIds = i.galleryImageIds || [];
        editForm.sellingLocations = i.sellingLocations || [];
        editForm.keywords = i.keywords || [];

        const existingUrl = getImageUrl(i);
        let activeImageId = null;

        if (i.imageId) {
            activeImageId = i.imageId;
        } else if (i.galleryImageIds?.length > 0) {
            activeImageId = i.galleryImageIds[0];
        } else if (i.conditionNotes) {
            const match = i.conditionNotes.match(/\[MAIN IMAGE ID: ([^\]]+)\]/);
            if (match) activeImageId = match[1].split(',')[0].trim();
        }

        if (existingUrl && activeImageId) {
            if (!editForm.existingGalleryIds.includes(activeImageId)) {
                editForm.existingGalleryIds.unshift(activeImageId);
            }
            mainPhotoSelection.value = { type: 'existing', val: activeImageId };
        } else {
            mainPhotoSelection.value = { type: 'none', val: null };
        }
        
        scoutResult.value = null;
        scoutMdText.value = null;

        if (i.rawAnalysis) {
            try {
                const parsed = JSON.parse(i.rawAnalysis);
                scoutResult.value = Array.isArray(parsed) ? parsed : (parsed.items || [parsed]);
            } catch (e) {}
        }

    } else {
        editForm.title = '';
        editForm.cost = '';
        editForm.resalePrice = '';
        editForm.soldPrice = '';
        editForm.estLow = '';
        editForm.estHigh = '';
        editForm.storageLocation = '';
        editForm.sourcingLocation = '';
        editForm.orderId = '';
        editForm.status = 'acquired';
        editForm.parentLotId = null;
        editForm.description = '';
        editForm.itemCondition = '';
        editForm.existingGalleryIds = [];
        editForm.sellingLocations = [];
        editForm.keywords = [];
        editForm.countryOfOrigin = '';
        mainPhotoSelection.value = { type: 'none', val: null };
        scoutResult.value = null;
        scoutMdText.value = null;
        scoutQuery.value = '';
    }
    
    editGalleryBuffer.value = [];
    fetchedImages.value = [];
    fetchingImages.value = false;
    mainTab.value = 'details';
    
    let parsedComps = [];
    if (props.item && props.item.components) {
        try { parsedComps = JSON.parse(props.item.components); } catch (e) {}
    }
    componentsList.value = parsedComps;
    fetchLotChildren();
};

watch(() => props.item, initForm, { immediate: true });

const closeDrawer = () => {
    emit('close');
};

let descAbortController = new AbortController();

const generateDescription = async () => {
    if (!props.item) return;
    const idToUpdate = props.item.$id;
    if (!idToUpdate) return;
    generatingDescription.value = true;
    descAbortController = new AbortController();

    showLoader("Generating Listing Description...", {
        step: "Gemini is crafting customer-facing marketplace copy...",
        progress: 50,
        basket: 'solar:magic-stick-bold-duotone',
        cancelable: false
    });

    try {
        if (actualMainPhoto.value.type === 'new' && actualMainPhoto.value.file) {
            addToast({ type: 'info', message: "Please save item first so new photo is uploaded." });
            return;
        }

        let jwt = null;
        try {
            const jwtRes = await account.createJWT();
            jwt = jwtRes.jwt;
        } catch (jwtErr) {}

        const headers = { 'Content-Type': 'application/json' };
        if (jwt) headers['X-Appwrite-JWT'] = jwt;

        const res = await fetch('/api/generate-description', {
            method: 'POST',
            headers,
            body: JSON.stringify({ itemId: idToUpdate }),
            signal: descAbortController.signal
        });
        const data = await res.json();
        if(data.success && data.description) {
            editForm.description = data.description;
            descTab.value = 'preview';
            addToast({ type: 'success', message: 'AI Description generated!' });
        } else {
            addToast({ type: 'error', message: data.error || 'Failed to generate description.' });
        }
    } catch (e) {
        if (e.name !== 'AbortError') {
            addToast({ type: 'error', message: 'Generation error: ' + e.message });
        }
    } finally {
        generatingDescription.value = false;
        hideLoader();
    }
};

const saveEdit = async () => {
    processing.value = true;
    showLoader("Saving Item...", {
        step: "Uploading media & updating database...",
        progress: 70,
        basket: 'solar:diskette-bold-duotone',
        cancelable: false
    });
    try {
        let finalGallery = Array.isArray(editGalleryBuffer.value) ? [...editGalleryBuffer.value] : [];
        let finalImageFile = null;
        if (actualMainPhoto.value.type === 'new' && finalGallery[actualMainPhoto.value.idx]) {
             finalImageFile = finalGallery[actualMainPhoto.value.idx];
             finalGallery.splice(actualMainPhoto.value.idx, 1);
        }

        const payload = {
            ...editForm,
            conditionNotes: editForm.condition_notes,
            imageId: actualMainPhoto.value.id || null,
            imageFile: finalImageFile,
            galleryFiles: finalGallery,
            existingGalleryIds: Array.isArray(editForm.existingGalleryIds) ? editForm.existingGalleryIds : [],
            scoutData: scoutResult.value || null,
            components: (componentsList.value && Array.isArray(componentsList.value) && componentsList.value.length > 0) 
                ? JSON.stringify(componentsList.value) 
                : null
        };
        emit('save', payload);
    } catch (e) {
        addToast({ type: 'error', message: 'Save failed: ' + e.message });
    } finally {
        processing.value = false;
        hideLoader();
    }
};

const removeGalleryItem = (idOrIdx, isExisting) => {
    if (isExisting) {
        editForm.existingGalleryIds = editForm.existingGalleryIds.filter(id => id !== idOrIdx);
    } else {
        editGalleryBuffer.value.splice(idOrIdx, 1);
    }
};

const dragOver = ref(false);
const fileInput = ref(null);
const scannerWidget = ref(null);

const handleDrop = async (e) => {
    dragOver.value = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
        handleCapturedPhotos(files);
    }
};

const onDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
        dragOver.value = false;
    }
};

const handleFileSelect = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    handleCapturedPhotos(files);
    e.target.value = '';
};

const handleCapturedPhotos = (files) => {
    Array.from(files).forEach(file => {
        editGalleryBuffer.value.push(file);
        if (!actualMainPhoto.value.file && !editForm.imageId && !actualMainPhoto.value.url) {
            mainPhotoSelection.value = { type: 'new', val: editGalleryBuffer.value.length - 1 };
        }
    });
};

const fetchSourceData = async () => {
    let url = editForm.sourcingLocation;
    const isId = url && url.match(/^\d+$/);
    if (isId) {
        url = `https://shopgoodwill.com/item/${url}`;
        editForm.sourcingLocation = url;
    }

    if (!url || !url.startsWith('http')) {
        addToast({ type: 'warning', message: "Please enter a valid URL." });
        return;
    }
    fetchingImages.value = true;
    fetchedImages.value = [];
    let finalUrl = url;
    const idMatch = url.match(/item\/(\d+)/i) || url.match(/^(\d+)$/);
    if(idMatch) finalUrl = idMatch[1];

    let fetchImageAbort = new AbortController();

    showLoader("Fetching Source Data...", {
        step: "Scraping photos and listing metadata...",
        progress: 50,
        basket: 'solar:cloud-download-bold-duotone',
        cancelable: true,
        onCancel: () => {
            fetchImageAbort.abort();
            fetchingImages.value = false;
        }
    });

    try {
        const timeoutSignal = AbortSignal.timeout(25000);
        // Combine abort controller and timeout
        const combinedSignal = (typeof AbortSignal.any === 'function') 
            ? AbortSignal.any([fetchImageAbort.signal, timeoutSignal])
            : fetchImageAbort.signal;

        const res = await fetch('/api/extract-images', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: finalUrl }),
            signal: combinedSignal
        });
        const data = await res.json();
        if (data.success && data.images.length > 0) {
            fetchedImages.value = data.images;
        }
        if (data.success) {
            if (isAcquisitionUnlocked.value) {
                if (data.price && (!editForm.cost || parseFloat(editForm.cost) === 0)) editForm.cost = data.price.toString().replace(/[$,]/g, '');
            }
            if (data.title && (!editForm.title || editForm.title.trim().length < 4)) editForm.title = data.title;
            addToast({ type: 'success', message: `Fetched ${data.images?.length || 0} photos!` });
        } else {
            addToast({ type: 'error', message: data.error || "Failed to parse photos from source." });
        }
    } catch (e) {
        if (e.name !== 'AbortError') {
            addToast({ type: 'error', message: "Failed to fetch source data: " + (e.message || "Request timed out") });
        }
    } finally {
        fetchingImages.value = false;
        hideLoader();
    }
};

const urlToFile = async (url, filename) => {
    try {
        const res = await fetch('/api/proxy-image?url=' + encodeURIComponent(url));
        if (!res.ok) throw new Error("Image download failed");
        const blob = await res.blob();
        const contentType = res.headers.get('content-type') || 'image/jpeg';
        return new File([blob], filename, { type: contentType });
    } catch (e) {
        return null;
    }
};

const selectFetchedImage = async (url, asMain = false) => {
    if (!url) return;
    downloadingImageUrls.value = { ...downloadingImageUrls.value, [url]: true };
    try {
        const filename = url.split('/').pop()?.split('?')[0] || "downloaded.jpg";
        const file = await urlToFile(url, filename);
        if (file) {
            editGalleryBuffer.value.push(file);
            const newIdx = editGalleryBuffer.value.length - 1;
            if (asMain || (!actualMainPhoto.value.file && !editForm.imageId && !actualMainPhoto.value.url)) {
                mainPhotoSelection.value = { type: 'new', val: newIdx };
            }
            // Remove the selected image from fetchedImages
            fetchedImages.value = fetchedImages.value.filter((img) => (typeof img === 'string' ? img : img.url) !== url);
            addToast({ type: 'success', message: asMain ? "Added & set as main photo ⭐" : "Photo added to gallery!" });
        } else {
            addToast({ type: 'error', message: "Could not download image." });
        }
    } catch (e) {
        addToast({ type: 'error', message: "Download failed: " + e.message });
    } finally {
        const updated = { ...downloadingImageUrls.value };
        delete updated[url];
        downloadingImageUrls.value = updated;
    }
};

const addAllFetchedImages = async () => {
    if (!fetchedImages.value || fetchedImages.value.length === 0) return;
    showLoader("Importing Scraped Photos...", {
        step: "Downloading photos to gallery buffer...",
        progress: 40,
        cancelable: false
    });
    const toAdd = [...fetchedImages.value];
    let successCount = 0;
    for (const imgItem of toAdd) {
        const url = typeof imgItem === 'string' ? imgItem : (imgItem.url || '');
        if (!url) continue;
        const filename = url.split('/').pop()?.split('?')[0] || "downloaded.jpg";
        const file = await urlToFile(url, filename);
        if (file) {
            editGalleryBuffer.value.push(file);
            if (!actualMainPhoto.value.file && !editForm.imageId && !actualMainPhoto.value.url) {
                mainPhotoSelection.value = { type: 'new', val: editGalleryBuffer.value.length - 1 };
            }
            successCount++;
        }
    }
    fetchedImages.value = [];
    hideLoader();
    if (successCount > 0) {
        addToast({ type: 'success', message: `Added ${successCount} photo${successCount > 1 ? 's' : ''} to gallery!` });
    } else {
        addToast({ type: 'error', message: 'Failed to download fetched photos.' });
    }
};

let scoutAbortController = new AbortController();

const analyzeExistingItem = async () => {
    if (!actualMainPhoto.value.url && !editForm.sourcingLocation && !editForm.condition_notes && !editForm.title && (!editForm.existingGalleryIds || editForm.existingGalleryIds.length === 0)) {
        addToast({ type: 'warning', message: "Please provide a title, notes, a photo, or a link to analyze." });
        return;
    }
    analyzing.value = true;
    scoutAbortController = new AbortController();
    let progressTimer = null;
    let progressVal = 15;

    try {
        let base64Images = [];
        let remoteUrls = [];

        const resize = (blob) => new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height, max = 1024;
                if (w > max || h > max) { if (w > h) { h = Math.round(h * (max/w)); w = max; } else { w = Math.round(w * (max/h)); h = max; } }
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            const reader = new FileReader(); 
            reader.onload = (e) => img.src = e.target.result; 
            reader.readAsDataURL(blob);
        });

        // 1. Convert new buffered images (support up to 30 photos for multi-lot decomposition)
        const resizePromises = editGalleryBuffer.value.slice(0, 30).map(async (file) => {
            try { return await resize(file); } catch (e) { return null; }
        });
        const resizedLocal = (await Promise.all(resizePromises)).filter(Boolean);
        base64Images.push(...resizedLocal);

        // 2. Add existing Appwrite gallery photos as remote URLs
        if (editForm.existingGalleryIds && editForm.existingGalleryIds.length > 0) {
            editForm.existingGalleryIds.forEach(id => {
                const u = getAssetUrl(id);
                if (u && !remoteUrls.includes(u)) remoteUrls.push(u);
            });
        }

        // 3. Fallback to main photo url if needed
        if (base64Images.length === 0 && remoteUrls.length === 0 && actualMainPhoto.value.url) {
            let url = actualMainPhoto.value.url;
            if (url.startsWith('data:') || url.startsWith('blob:')) {
                try { const res = await fetch(url); base64Images.push(await resize(await res.blob())); } catch (e) {}
            } else {
                remoteUrls.push(url);
            }
        }

        let contextNotes = editForm.condition_notes || '';
        if (editForm.description) contextNotes += (contextNotes ? '\n\n' : '') + `Existing Description: ${editForm.description}`;
        if (editForm.title) contextNotes = `Current Title: ${editForm.title}\n\n` + contextNotes;
        if (editForm.sourcingLocation) contextNotes += `\n\nSourcing URL: ${editForm.sourcingLocation}`;

        // Clear previous results
        scoutResult.value = null;
        scoutMdText.value = '';

        const activeLocations = [];
        if (orgWarehouses.value && orgWarehouses.value.length > 0) {
            orgWarehouses.value.forEach(w => activeLocations.push({ 
                name: w.name, 
                type: w.type || 'Physical Booth', 
                commissionRate: w.commissionRate,
                categories: w.categories || w.niche || ''
            }));
        }
        if (orgPlacedLocations.value && orgPlacedLocations.value.length > 0) {
            orgPlacedLocations.value.forEach(loc => {
                if (!activeLocations.some(l => l.name === loc)) {
                    activeLocations.push({ name: loc, type: 'Physical Booth / Location' });
                }
            });
        }

        const totalPhotos = base64Images.length + remoteUrls.length;
        const isLot = (Number(editForm.quantity || props.item?.quantity || 1) > 1) || 
                      (/\b(lot|bundle|collection|set\s+of|pack\s+of|pair)\b/i.test(`${editForm.title || ''} ${editForm.condition_notes || ''}`));
        const apiEndpoint = (isLot && totalPhotos > 1) ? '/api/inspect-lot' : '/api/identify-item';

        showLoader("Analyzing with AI Deep Research...", {
            step: `Step 1 of 4: Preparing & optimizing ${totalPhotos} photos...`,
            progress: progressVal,
            basket: 'solar:archive-minimalistic-bold-duotone',
            berries: ['solar:document-bold-duotone', 'solar:chart-square-bold-duotone', 'solar:calculator-bold-duotone', 'solar:folder-with-files-bold-duotone'],
            basketColor: 'text-primary-content',
            berryColor: 'text-primary-content',
            backgroundColor: 'bg-primary/80',
            cancelable: true,
            onCancel: () => {
                if (progressTimer) clearInterval(progressTimer);
                scoutAbortController.abort();
            }
        });

        progressTimer = setInterval(() => {
            progressVal = Math.min(95, progressVal + 5);
            let stepMsg = "Step 2 of 4: Scanning visual signatures & markings...";
            if (progressVal >= 40 && progressVal < 70) {
                stepMsg = "Step 3 of 4: Evaluating secondary market pricing & comps...";
            } else if (progressVal >= 70) {
                stepMsg = "Step 4 of 4: Structuring valuation matrix & market report...";
            }
            updateLoader("Analyzing with AI Deep Research...", stepMsg, progressVal);
        }, 1200);

        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                images: base64Images,
                remoteImageUrls: remoteUrls,
                title: editForm.title,
                notes: contextNotes,
                cost: editForm.cost,
                quantity: editForm.quantity || props.item?.quantity,
                sourcingLocation: editForm.sourcingLocation || props.item?.sourcingLocation,
                locations: activeLocations
            }),
            signal: scoutAbortController.signal
        });

        if (progressTimer) clearInterval(progressTimer);

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.details || errData.error || "Analysis failed");
        }

        const data = await response.json();

        // A. Lot items inspection result
        if (data.lot_items && Array.isArray(data.lot_items) && data.lot_items.length > 0) {
            scoutResult.value = data;
            let desc = `--- 📦 MASTER LOT APPRAISAL & BOOTH STRATEGY (${data.lot_items.length} Cataloged Items) ---\n\n`;
            if (data.title) desc += `**Suggested Title:** ${data.title}\n\n`;
            if (data.condition_notes) desc += `**Condition Overview:** ${data.condition_notes}\n\n`;

            if (data.price_breakdown) {
                desc += `**💰 Total Collection Valuation:**\n`;
                if (data.price_breakdown.mint) desc += `- **Mint / High-Grade:** ${data.price_breakdown.mint}\n`;
                if (data.price_breakdown.fair) desc += `- **Fair / Market Average:** ${data.price_breakdown.fair}\n`;
                if (data.price_breakdown.boutique_premium) desc += `- **Boutique / Antique Mall:** ${data.price_breakdown.boutique_premium}\n`;
                if (data.price_breakdown.poor) desc += `- **Reader / Clearance:** ${data.price_breakdown.poor}\n`;
                desc += `\n`;
            }

            if (data.market_report) {
                desc += `**🏪 Market Strategy & Sales Channels:**\n`;
                if (data.market_report.best_platform) desc += `- **Primary Recommendation:** ${data.market_report.best_platform}\n`;
                if (data.market_report.platform_rationale) desc += `- **Strategy Rationale:** ${data.market_report.platform_rationale}\n`;
                if (data.market_report.channels && Array.isArray(data.market_report.channels)) {
                    data.market_report.channels.forEach(ch => {
                        desc += `  * **${ch.name}:** ${ch.est_price} (${ch.recommendation || ''}) — Net Payout: ${ch.net_payout || ''}\n`;
                    });
                }
                desc += `\n`;
            }

            if (data.purchase_strategy) {
                desc += `**🎯 Sourcing & Profit Assessment:**\n`;
                if (data.purchase_strategy.verdict) desc += `- **Verdict:** ${data.purchase_strategy.verdict}\n`;
                if (data.purchase_strategy.advice) desc += `- **Advice:** ${data.purchase_strategy.advice}\n\n`;
            }

            desc += `**🔍 Cataloged Items & Pricing Tiers:**\n`;
            data.lot_items.forEach((item, idx) => {
                desc += `\n**${idx+1}. ${item.name || item.identity}**\n`;
                if (item.estimated_value) desc += `   - **Est. Resale:** ${item.estimated_value}\n`;
                if (item.price_breakdown && item.price_breakdown.fair) {
                    desc += `   - **Pricing Matrix:** Fair ${item.price_breakdown.fair} | Mint ${item.price_breakdown.mint || '-'} | Boutique ${item.price_breakdown.boutique_premium || '-'}\n`;
                }
                if (item.condition) desc += `   - **Condition:** ${item.condition}\n`;
                if (item.ocr_detected_text) desc += `   - **Cover Markings:** ${item.ocr_detected_text}\n`;
            });

            scoutMdText.value = desc.trim();
            addToast({ type: 'success', message: `Identified ${data.lot_items.length} items/groups in lot!` });
        } 
        // B. Standard / Multi-item result
        else if (data.items && data.items.length > 0) {
            if (data.items.length > 1) {
                scoutResult.value = data.items;
                let desc = `**📦 MULTI-ITEM LOT BREAKDOWN (${data.items.length} Items):**\n\n`;
                data.items.forEach((item, idx) => {
                    desc += `**${idx+1}. ${item.title || item.identity}**\n`;
                    if(item.condition_notes) desc += `- Condition: ${item.condition_notes}\n`;
                });
                scoutMdText.value = desc.trim();
                addToast({ type: 'success', message: `Identified ${data.items.length} items!` });
            } else {
                scoutResult.value = data.items[0];
                const item = scoutResult.value;
                
                let report = `--- 🕵️ SCOUT REPORT ---\n\n`;
                if(item.title) report += `**Title:** ${item.title}\n\n`;
                if(item.condition_notes) report += `**Condition:** ${item.condition_notes}\n`;
                if(item.red_flags && item.red_flags.length > 0) report += `**🚩 Red Flags:** ${item.red_flags.join(', ')}\n`;
                if(item.price_breakdown) {
                    report += `\n**Valuation Breakdown:**\n`;
                    report += `- **Mint / New:** ${item.price_breakdown.mint || '-'}\n`;
                    report += `- **Fair / Used:** ${item.price_breakdown.fair || '-'}\n`;
                    report += `- **Poor / As-Is:** ${item.price_breakdown.poor || '-'}\n`;
                    if(item.price_breakdown.boutique_premium) report += `- **Boutique Booth:** ${item.price_breakdown.boutique_premium}\n`;
                }
                if(item.purchase_strategy) {
                    report += `\n**Sourcing Strategy:**\n`;
                    if(item.purchase_strategy.verdict) report += `- **Verdict:** ${item.purchase_strategy.verdict}\n`;
                    if(item.purchase_strategy.max_bid) report += `- **Max Bid Target:** $${item.purchase_strategy.max_bid}\n`;
                    if(item.purchase_strategy.advice) report += `- **Advice:** ${item.purchase_strategy.advice}\n`;
                }
                if(item.market_report) {
                    report += `\n**Market & Channels:**\n`;
                    if (item.market_report.best_platform) report += `- **Best Platform:** ${item.market_report.best_platform}\n`;
                    if (item.market_report.sell_through_velocity) report += `- **Velocity:** ${item.market_report.sell_through_velocity}\n`;
                    if (item.market_report.platform_rationale) report += `- **Rationale:** ${item.market_report.platform_rationale}\n`;
                }
                if(item.comparables && item.comparables.length > 0) { 
                    report += `\n**Comparables:**\n`; 
                    item.comparables.forEach(c => report += `- ${c.name} (${c.price}) [${c.status || 'Sold'}]\n`); 
                }
                scoutMdText.value = report.trim();
                addToast({ type: 'success', message: 'AI Analysis complete!' });
            }
        }
        // C. Overarching Lot Report (Fallback when lot_items is empty or response is a single comprehensive appraisal object)
        else if (data && (data.identity || data.title || data.price_breakdown || data.purchase_strategy || data.market_report)) {
            scoutResult.value = data;
            let desc = `--- 📦 LOT APPRAISAL & BOOTH STRATEGY ---\n\n`;
            if (data.title) desc += `**Suggested Title:** ${data.title}\n\n`;
            if (data.condition_notes) desc += `**Condition Overview:** ${data.condition_notes}\n\n`;

            if (data.price_breakdown) {
                desc += `**💰 Total Valuation:**\n`;
                if (data.price_breakdown.mint) desc += `- **Mint / High-Grade:** ${data.price_breakdown.mint}\n`;
                if (data.price_breakdown.fair) desc += `- **Fair / Market Average:** ${data.price_breakdown.fair}\n`;
                if (data.price_breakdown.boutique_premium) desc += `- **Boutique / Antique Mall:** ${data.price_breakdown.boutique_premium}\n`;
                if (data.price_breakdown.poor) desc += `- **Reader / Clearance:** ${data.price_breakdown.poor}\n`;
                desc += `\n`;
            }

            if (data.market_report) {
                desc += `**🏪 Market Strategy & Sales Channels:**\n`;
                if (data.market_report.best_platform) desc += `- **Primary Recommendation:** ${data.market_report.best_platform}\n`;
                if (data.market_report.platform_rationale) desc += `- **Strategy Rationale:** ${data.market_report.platform_rationale}\n`;
                if (data.market_report.channels && Array.isArray(data.market_report.channels)) {
                    data.market_report.channels.forEach(ch => {
                        desc += `  * **${ch.name}:** ${ch.est_price} (${ch.recommendation || ''}) — Net Payout: ${ch.net_payout || ''}\n`;
                    });
                }
                desc += `\n`;
            }

            if (data.purchase_strategy) {
                desc += `**🎯 Sourcing & Profit Assessment:**\n`;
                if (data.purchase_strategy.verdict) desc += `- **Verdict:** ${data.purchase_strategy.verdict}\n`;
                if (data.purchase_strategy.advice) desc += `- **Advice:** ${data.purchase_strategy.advice}\n\n`;
            }

            if (data.red_flags && Array.isArray(data.red_flags) && data.red_flags.length > 0) {
                desc += `**🚩 Inspection Flags:**\n`;
                data.red_flags.forEach(flag => {
                    desc += `- ${flag}\n`;
                });
                desc += `\n`;
            }

            scoutMdText.value = desc.trim();
            addToast({ type: 'success', message: 'Lot valuation intelligence generated!' });
        }
    } catch (e) {
        if (e.name !== 'AbortError') {
            addToast({ type: 'error', message: 'Analysis error: ' + e.message });
        }
    } finally {
        if (progressTimer) clearInterval(progressTimer);
        analyzing.value = false;
        analysisStatus.value = '';
        hideLoader();
    }
};

const applyBundleSuggestions = () => {
    if (suggestedTitleStr.value) editForm.title = suggestedTitleStr.value;
    if (suggestedListPriceStr.value) editForm.resalePrice = suggestedListPriceStr.value;
    if (suggestedEstLowStr.value) editForm.estLow = suggestedEstLowStr.value;
    if (suggestedEstHighStr.value) editForm.estHigh = suggestedEstHighStr.value;
    if (scoutMdText.value) {
        editForm.description = scoutMdText.value;
    } else if (suggestedDescriptionStr.value) {
        editForm.description = suggestedDescriptionStr.value;
    }
    addToast({ type: 'success', message: 'Applied AI suggestions to listing form.' });
};

watch(mainTab, (newVal) => {
    if (newVal === 'lot') {
        fetchLotChildren();
        if (props.item && !newChild.cost) {
            const totalCost = parseFloat(editForm.cost || 0);
            const childCount = lotChildren.value.length + 1;
            newChild.cost = (totalCost / (childCount || 1)).toFixed(2);
        }
    }
});

const createChildItem = async () => {
    if (!props.item || !newChild.title.trim()) return;
    creatingChild.value = true;
    try {
        const extraData = {
            cost: parseFloat(newChild.cost || 0) || 0,
            resalePrice: parseFloat(newChild.resalePrice || 0) || 0,
            soldPrice: newChild.status === 'sold' ? (parseFloat(newChild.soldPrice || 0) || 0) : null,
            status: newChild.status || 'acquired',
            sourcingLocation: editForm.sourcingLocation,
            orderId: editForm.orderId,
            storageLocation: editForm.storageLocation,
            quantity: 1,
            parentLotId: props.item.$id,
            purchaseId: props.item.purchaseId || null
        };

        await saveItemToInventory(
            { 
                title: newChild.title.trim(), 
                identity: Math.random().toString(36).substring(2, 10), 
                condition_notes: `Extracted from parent lot: ${props.item.title || props.item.$id}` 
            },
            null,
            extraData,
            currentTeam.value?.$id
        );

        newChild.title = '';
        newChild.resalePrice = '';
        newChild.soldPrice = '';
        newChild.status = 'acquired';
        await fetchLotChildren();
        addToast({ type: 'success', message: 'Added item to lot!' });
    } catch (e) {
        addToast({ type: 'error', message: 'Failed to create child item: ' + e.message });
    } finally {
        creatingChild.value = false;
    }
};

const deconstructAiLot = async () => {
    if (!props.item || !scoutItemsArray.value || scoutItemsArray.value.length === 0) return;
    extractingLot.value = true;
    try {
        const count = scoutItemsArray.value.length;
        const totalCost = parseFloat(editForm.cost || 0);
        const unitCost = count > 0 ? parseFloat((totalCost / count).toFixed(2)) : 0;

        for (const [idx, lotItem] of scoutItemsArray.value.entries()) {
            const title = lotItem.name || lotItem.identity || lotItem.title || `Item ${idx + 1}`;
            const estVal = parsePrice(lotItem.estimated_value || lotItem.price_breakdown?.fair || 0);

            const extraData = {
                cost: unitCost,
                resalePrice: estVal || 0,
                status: 'acquired',
                sourcingLocation: editForm.sourcingLocation,
                orderId: editForm.orderId,
                storageLocation: editForm.storageLocation,
                quantity: 1,
                parentLotId: props.item.$id,
                purchaseId: props.item.purchaseId || null
            };

            await saveItemToInventory(
                { 
                    title: title, 
                    identity: Math.random().toString(36).substring(2, 10), 
                    condition_notes: `AI Lot Extraction (${idx + 1}/${count}) from ${props.item.title || props.item.$id}` 
                },
                null,
                extraData,
                currentTeam.value?.$id
            );
        }

        mainTab.value = 'lot';
        await fetchLotChildren();
        addToast({ type: 'success', message: `Successfully deconstructed ${count} items into inventory!` });
    } catch (e) {
        addToast({ type: 'error', message: 'Failed to deconstruct lot: ' + e.message });
    } finally {
        extractingLot.value = false;
    }
};

const sellOneQuantity = async () => {
    if (!props.item || editForm.quantity <= 1) return;
    const unitSoldPriceRaw = window.prompt("How much did this 1 item sell for? (Enter a number)", 
        (parseFloat(editForm.resalePrice || 0) / editForm.quantity).toFixed(2));
    if (unitSoldPriceRaw === null) return;
    const unitSoldPrice = parseFloat(unitSoldPriceRaw);
    if (isNaN(unitSoldPrice)) {
        addToast({ type: 'error', message: 'Invalid price.' });
        return;
    }

    try {
        const unitCost = parseFloat((parseFloat(editForm.cost || 0) / editForm.quantity).toFixed(2));
        const unitResale = parseFloat((parseFloat(editForm.resalePrice || 0) / editForm.quantity).toFixed(2));
        
        const childTitle = `${editForm.title} (Extracted 1/${editForm.quantity})`;
        const extraData = {
            cost: unitCost,
            resalePrice: unitResale,
            soldPrice: unitSoldPrice,
            status: 'sold',
            sourcingLocation: editForm.sourcingLocation,
            orderId: editForm.orderId,
            storageLocation: editForm.storageLocation,
            quantity: 1,
            parentLotId: props.item.$id,
            purchaseId: props.item.purchaseId || null
        };
        
        await saveItemToInventory(
            { title: childTitle, identity: Math.random().toString(36).substring(2, 10), condition_notes: `Extracted from Lot ${props.item.$id}` },
            null,
            extraData,
            currentTeam.value?.$id
        );
        
        editForm.quantity -= 1;
        if (isAcquisitionUnlocked.value) {
            editForm.cost = Math.max(0, parseFloat(editForm.cost || 0) - unitCost).toFixed(2);
        }
        editForm.resalePrice = Math.max(0, parseFloat(editForm.resalePrice || 0) - unitResale).toFixed(2);
        saveEdit();
        addToast({ type: 'success', message: 'Extracted 1 sold item!' });
    } catch (e) {
        addToast({ type: 'error', message: 'Error extracting item: ' + e.message });
    }
};

const splitOneActive = async () => {
    if (!props.item || editForm.quantity <= 1) return;
    try {
        const unitCost = parseFloat((parseFloat(editForm.cost || 0) / editForm.quantity).toFixed(2));
        const unitResale = parseFloat((parseFloat(editForm.resalePrice || 0) / editForm.quantity).toFixed(2));
        
        const childTitle = `${editForm.title} (Piece ${editForm.quantity})`;
        const extraData = {
            cost: unitCost,
            resalePrice: unitResale,
            status: editForm.status === 'sold' ? 'acquired' : editForm.status,
            sourcingLocation: editForm.sourcingLocation,
            orderId: editForm.orderId,
            storageLocation: editForm.storageLocation,
            quantity: 1,
            parentLotId: props.item.$id,
            purchaseId: props.item.purchaseId || null
        };
        
        await saveItemToInventory(
            { title: childTitle, identity: Math.random().toString(36).substring(2, 10), condition_notes: `Split from batch: ${props.item.$id}` },
            null,
            extraData,
            currentTeam.value?.$id
        );
        
        editForm.quantity -= 1;
        if (isAcquisitionUnlocked.value) {
            editForm.cost = Math.max(0, parseFloat(editForm.cost || 0) - unitCost).toFixed(2);
        }
        editForm.resalePrice = Math.max(0, parseFloat(editForm.resalePrice || 0) - unitResale).toFixed(2);
        saveEdit();
        addToast({ type: 'success', message: 'Split 1 item into active inventory!' });
    } catch (e) {
        addToast({ type: 'error', message: 'Error splitting item: ' + e.message });
    }
};

const splitAllQuantity = async () => {
    if (!props.item || editForm.quantity <= 1) return;
    const totalUnits = editForm.quantity;
    if (!window.confirm(`Unpack all ${totalUnits} units into separate individual inventory items?`)) return;

    try {
        const unitCost = parseFloat((parseFloat(editForm.cost || 0) / totalUnits).toFixed(2));
        const unitResale = parseFloat((parseFloat(editForm.resalePrice || 0) / totalUnits).toFixed(2));

        for (let i = 1; i <= totalUnits; i++) {
            const childTitle = `${editForm.title} (${i}/${totalUnits})`;
            const extraData = {
                cost: unitCost,
                resalePrice: unitResale,
                status: editForm.status === 'sold' ? 'acquired' : editForm.status,
                sourcingLocation: editForm.sourcingLocation,
                orderId: editForm.orderId,
                storageLocation: editForm.storageLocation,
                quantity: 1,
                parentLotId: props.item.$id,
                purchaseId: props.item.purchaseId || null
            };

            await saveItemToInventory(
                { title: childTitle, identity: Math.random().toString(36).substring(2, 10), condition_notes: `Unpacked (${i}/${totalUnits}) from lot ${props.item.$id}` },
                null,
                extraData,
                currentTeam.value?.$id
            );
        }

        editForm.quantity = 0;
        editForm.status = 'archived';
        saveEdit();
        addToast({ type: 'success', message: `Successfully unpacked ${totalUnits} individual items!` });
    } catch (e) {
        addToast({ type: 'error', message: 'Error unpacking items: ' + e.message });
    }
};
</script>

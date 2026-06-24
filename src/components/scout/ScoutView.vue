<template>
  <div class="bg-base-100 min-h-full relative flex flex-col">
    
    <!-- ERROR TOAST -->
    <div v-if="error" class="toast toast-top toast-center z-100">
        <div class="alert alert-error shadow-lg">
            <span>{{ error }}</span>
            <button class="btn btn-xs btn-ghost" @click="error = null">✕</button>
        </div>
    </div>
    <!-- SUCCESS TOAST -->
    <div v-if="successMessage" class="toast toast-top toast-center z-100">
        <div class="alert alert-success shadow-lg text-white">
            <span>{{ successMessage }}</span>
        </div>
    </div>

    <!-- MAIN CONTENT AREA -->
    <div class="flex-1 p-4 md:p-6 space-y-6 w-full max-w-screen-xl mx-auto">
        

        <!-- 1. INPUT SECTION -->
        <div class="card bg-base-100 shadow-sm border border-base-200">
            <div class="card-body p-4">
                
                <!-- TABS -->
                <div class="tabs tabs-boxed justify-center mb-4 bg-base-200">
                    <a class="tab gap-2" :class="{ 'tab-active': mode === 'speed' }" @click="mode = 'speed'">
                        <Icon icon="solar:bolt-linear" /> Speed Scout
                    </a>
                    <a class="tab gap-2" :class="{ 'tab-active': mode === 'precision' }" @click="mode = 'precision'">
                        <Icon icon="solar:magnifer-linear" /> Precision
                    </a>
                </div>

                <!-- 1a. IMAGE INPUTS (Speed Scout Mode) -->
                <div v-if="mode === 'speed'" class="form-control w-full">
                    <label class="label pt-0">
                        <span class="label-text opacity-70">Capture or Upload Item(s)</span>
                        <span v-if="dragOver" class="badge badge-primary badge-sm animate-pulse">Drop images here!</span>
                    </label>
                    <div class="border-2 border-dashed rounded-lg p-4 transition-colors relative flex flex-col justify-center cursor-pointer min-h-32 mb-4"
                         :class="dragOver ? 'border-primary bg-primary/10' : 'border-base-300 hover:border-primary/50'"
                         @dragenter.prevent="dragOver = true"
                         @dragover.prevent="dragOver = true"
                         @dragleave.prevent="onDragLeave"
                         @drop.prevent="handleDrop"
                         @click.self="fileInput?.click()">
                         
                        <input type="file" ref="fileInput" @change="handleFileUpload" accept="image/*" multiple class="hidden" />

                        <!-- Empty State -->
                        <div v-if="images.length === 0" class="flex flex-col items-center justify-center opacity-50 pointer-events-none text-center h-full py-4">
                            <div class="text-4xl mb-2"><Icon icon="solar:camera-linear" class="mx-auto" /></div>
                            <div class="text-sm font-bold font-mono">Drag & Drop images here<br/>or Click to Browse</div>
                        </div>

                        <!-- Gallery Mode -->
                        <div v-else class="flex gap-3 overflow-x-auto pb-2 w-full items-center pointer-events-auto">
                            <div v-for="(img, index) in images" :key="index" class="relative w-20 h-20 shrink-0 group cursor-pointer" @click="fileInput?.click()">
                                <img :src="img" class="w-full h-full object-cover rounded shadow-sm border border-base-300" />
                                <button @click.stop="removeImage(index)" class="btn btn-xs btn-circle btn-error absolute -top-2 -right-2 w-5 h-5 min-h-0 text-[10px] flex items-center justify-center z-30 shadow hover:scale-110">✕</button>
                            </div>
                            <!-- Add More Button -->
                            <div class="relative w-20 h-20 shrink-0 border-2 border-dashed border-base-300 rounded flex items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-base-200 transition-colors"
                                 @click="fileInput?.click()">
                                <div class="text-3xl opacity-50 font-light leading-none mb-1">+</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="divider my-0 mb-4 opacity-50">OR</div>
                    
                    <button @click="startCamera" class="btn btn-outline btn-primary w-full gap-2">
                        <Icon icon="solar:camera-linear" class="w-5 h-5" /> Add Photo with Camera
                    </button>
                </div>

                <!-- 1b. URL INPUT (Precision/Link Scout Mode) -->
                <div v-if="mode === 'precision'" class="form-control w-full">
                    <div v-if="isAuthenticated" class="form-control w-full space-y-3">
                        <div class="flex flex-col sm:flex-row gap-3">
                            <div class="grow form-control">
                                <label class="label pt-0"><span class="label-text opacity-70 text-sm font-bold">Paste Web URL</span></label>
                                <input type="text" v-model="scoutUrl" class="input input-bordered w-full font-mono text-sm" placeholder="Paste eBay, ShopGoodwill, FB Marketplace, Poshmark or Mercari link..." />
                            </div>
                            <div class="w-full sm:w-36 form-control">
                                <label class="label pt-0"><span class="label-text opacity-70 text-sm font-bold">Scout ZIP Code</span></label>
                                <input type="text" v-model="zipCode" @blur="saveZipCode" @change="saveZipCode" class="input input-bordered w-full font-mono text-sm text-center" placeholder="98101" maxlength="5" />
                            </div>
                        </div>
                    </div>
                    
                    <div v-else class="text-center bg-base-200 border border-base-300 rounded-lg p-4 text-sm">
                        <div class="font-bold text-primary mb-1">Web Link Import is restricted during Early Alpha.</div>
                        <span class="opacity-70">We're currently gathering feedback and accepting waitlist members for the collective. </span>
                        <a href="/login" class="link text-secondary font-bold">Log in to unlock access.</a>
                    </div>
                </div>

                <!-- ADDITIONAL DETAILS -->
                <div class="form-control mt-4">
                    <label class="label pt-0"><span class="label-text opacity-70">Additional Details (Optional) Size, Brand, Defects, etc.</span></label>
                    <textarea v-model="userNotes" class="textarea textarea-bordered h-24 text-sm" placeholder="e.g. Size Large, Nike tag from 2015, small tear on sleeve..."></textarea>
                </div>

                <!-- ANALYZE BUTTON MOVED TO COMPONENT STICKY FOOTER -->
            </div>
        </div>

        <!-- 2. SHARED DETAILS SECTION (Only if results or manual entry) -->
        <div v-if="result || images.length > 0" class="card bg-base-100 shadow-sm border border-base-200">
             <div class="card-body p-4">

                
                <div class="form-control w-full">
                    <label class="label"><span class="label-text opacity-70">Cost Basis ($)</span></label>
                    <input v-model="cost" type="number" step="0.01" class="input input-bordered w-full" placeholder="0.00" />
                </div>

                <div class="form-control w-full mt-2">
                    <label class="cursor-pointer label justify-start gap-3">
                        <input type="checkbox" v-model="isAcquired" class="checkbox checkbox-primary checkbox-sm rounded-md" />
                        <span class="label-text opacity-75 font-bold">Item Already Purchased / Acquired</span>
                    </label>
                </div>

                <div class="form-control w-full">
                    <label class="label"><span class="label-text opacity-70">Sourcing Location / URL</span></label>
                    <div class="join w-full">
                        <input v-model="sourcingLocation" type="text" class="input input-bordered join-item w-full" placeholder="e.g. Goodwill, Garage Sale" />
                        <button class="btn btn-outline btn-square join-item">
                            <Icon icon="solar:map-point-linear" class="w-5 h-5" />
                        </button>
                    </div>
                </div>
                
                 <div class="form-control w-full">
                    <label class="label"><span class="label-text opacity-70">Storage / Bin Location</span></label>
                    <input v-model="storageLocation" type="text" class="input input-bordered w-full" placeholder="e.g. Front Cart, Blue Bin, Shelf 3" />
                </div>

                <div class="form-control w-full">
                    <label class="label"><span class="label-text opacity-70">Receipt Photo (Optional)</span></label>
                    <div class="join w-full">
                         <button class="btn btn-outline join-item" @click="receiptInput?.click()">Choose File</button>
                         <input type="text" readonly class="input input-bordered join-item w-full text-xs opacity-70" :value="receiptFile ? receiptFile.name : 'No file chosen'" />
                    </div>
                    <input type="file" ref="receiptInput" @change="handleReceiptUpload" accept="image/*" class="hidden" />
                </div>
             </div>
        </div>

        <!-- 3. RESULTS (ITEM CARDS) -->
        <div v-if="result" id="scout-results-section" class="space-y-6">
            <div v-for="(item, index) in (result.items || [])" :key="index" class="card bg-base-100 shadow-lg border-t-4 border-t-primary">
                <div class="card-body p-4 md:p-6">
                    
                    <!-- Header & Interactive Gallery -->
                    <div class="flex flex-col md:flex-row gap-6 items-start w-full">
                        <!-- Image Gallery (Left/Top) -->
                        <div class="w-full md:w-1/2 flex flex-col gap-3">
                            <div v-if="item.fetched_image" class="w-full h-64 sm:h-80 bg-base-200 border border-base-300 rounded-xl relative overflow-hidden flex items-center justify-center shadow-inner group">
                                <img :src="proxify(item.fetched_image)" 
                                     @error="handleImageError" 
                                     referrerpolicy="no-referrer"
                                     class="max-w-full max-h-full object-contain transition-transform duration-300 group-hover:scale-105" 
                                     alt="Item Main Image" />
                                <div class="absolute top-2 left-2 badge badge-primary gap-1 shadow font-bold text-xs uppercase tracking-wide">
                                    <Icon icon="solar:camera-linear" class="w-3.5 h-3.5" /> Main Photo
                                </div>
                            </div>
                            
                            <!-- Horizontal gallery of all scraped images -->
                            <div v-if="item.fetched_images && item.fetched_images.length > 1" class="flex gap-2 overflow-x-auto py-1 scrollbar-thin max-w-full">
                                <div v-for="(imgUrl, imgIdx) in item.fetched_images" 
                                     :key="imgIdx" 
                                     @click="item.fetched_image = imgUrl"
                                     class="w-16 h-16 shrink-0 rounded-lg cursor-pointer border-2 transition-all relative overflow-hidden bg-base-100 shadow-sm"
                                     :class="item.fetched_image === imgUrl ? 'border-primary ring-2 ring-primary/20 scale-95 shadow-md' : 'border-base-300 hover:border-primary/50'">
                                    <img :src="proxify(imgUrl)" @error="handleImageError" referrerpolicy="no-referrer" class="w-full h-full object-cover" />
                                </div>
                            </div>
                        </div>

                        <!-- Title & Source Section (Right/Bottom) -->
                        <div class="w-full md:w-1/2 flex flex-col justify-between h-full space-y-4">
                            <div>
                                <div class="flex items-center justify-between gap-2 mb-1">
                                    <span class="text-xs uppercase font-bold tracking-widest text-primary font-mono font-bold">Scouted Listing</span>
                                    <div class="badge badge-neutral">#{{ Number(index) + 1 }}</div>
                                </div>
                                <h2 class="text-xl md:text-2xl font-black text-base-content tracking-tight leading-tight mb-2">{{ item.identity || 'Unidentified Item' }}</h2>
                                
                                <div class="flex flex-wrap gap-2 mt-3">
                                    <a v-if="sourcingLocation && sourcingLocation.startsWith('http')" :href="sourcingLocation" target="_blank" class="btn btn-sm btn-outline btn-secondary gap-1.5 shadow-sm rounded-lg">
                                        <Icon icon="solar:link-linear" class="w-4 h-4" /> View Source Listing
                                    </a>
                                    <a v-if="item.fetched_image && item.fetched_image.startsWith('http')" :href="'https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(item.fetched_image)" target="_blank" class="btn btn-sm btn-outline btn-primary gap-1.5 shadow-sm rounded-lg">
                                        <Icon icon="solar:camera-linear" class="w-4 h-4" /> Search Google Lens
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Pricing Grid -->
                    <div class="grid grid-cols-4 gap-2 text-center mt-2">
                        <div class="bg-base-200 rounded p-2 flex flex-col">
                            <span class="text-[10px] uppercase font-bold opacity-50">NEW/MINT</span>
                            <span class="text-success font-bold text-sm md:text-base">{{ formatPriceDisplay(item.price_breakdown?.mint) }}</span>
                        </div>
                        <div class="bg-primary/10 rounded p-2 flex flex-col border border-primary/20">
                            <span class="text-[10px] uppercase font-bold opacity-50 text-primary">USED/FAIR</span>
                            <span class="text-primary font-bold text-sm md:text-base">{{ formatPriceDisplay(item.price_breakdown?.fair) }}</span>
                        </div>
                        <div class="bg-base-200 rounded p-2 flex flex-col">
                            <span class="text-[10px] uppercase font-bold opacity-50">POOR</span>
                            <span class="text-warning font-bold text-xs md:text-sm">{{ formatPriceDisplay(item.price_breakdown?.poor) }}</span>
                        </div>
                        <div class="bg-secondary/10 rounded p-2 flex flex-col border border-secondary/20">
                            <span class="text-[10px] uppercase font-bold opacity-70 text-secondary">BOUTIQUE</span>
                            <span class="text-secondary font-bold text-sm md:text-base">{{ formatPriceDisplay(item.price_breakdown?.boutique_premium) }}</span>
                        </div>
                    </div>

                    <!-- Sourcing Buy/Bid Limits -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                        <!-- Max Landed Buy -->
                        <div class="bg-black text-white p-3 rounded-lg flex justify-between items-center shadow-md">
                            <div class="flex flex-col text-left">
                                <span class="text-[10px] uppercase font-bold opacity-60">Max Landed Cost (All-in)</span>
                                <span class="text-[10px] opacity-75 font-medium">Incl. shipping/handling</span>
                            </div>
                            <span class="font-bold text-success text-lg">${{ calculateMaxBuy(item.price_breakdown?.fair) }}</span>
                        </div>

                        <!-- Max Bid (Auction) -->
                        <div class="bg-neutral-800 text-white p-3 rounded-lg flex justify-between items-center shadow-md border border-neutral-700">
                            <div class="flex flex-col text-left">
                                <span class="text-[10px] uppercase font-bold text-primary">Suggested Max Bid</span>
                                <span class="text-[10px] opacity-75 font-medium">Site bid limit (excl. shipping)</span>
                            </div>
                            <span class="font-bold text-lg" :class="calculateMaxBid(item) > 0 ? 'text-primary' : 'text-error'">
                                ${{ calculateMaxBid(item) }}
                            </span>
                        </div>
                    </div>

                    <!-- Shipping Info Breakdown -->
                    <div v-if="item.shipping_info" class="mt-4 bg-base-200 border border-base-300 rounded-xl p-4 shadow-inner flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div class="flex items-center gap-3">
                            <div class="p-3 bg-primary/10 text-primary rounded-xl">
                                <Icon icon="solar:delivery-linear" class="text-2xl" />
                            </div>
                            <div>
                                <div class="font-bold text-sm text-base-content flex items-center gap-1.5">
                                    Estimated Shipping via {{ item.shipping_info.carrier || 'Carrier' }}
                                </div>
                                <div class="text-xs opacity-65 font-medium">
                                    Calculated to ZIP {{ item.shipping_info.zipCode }} &bull; Ship: ${{ item.shipping_info.shipping?.toFixed(2) }} &bull; Handle: ${{ item.shipping_info.handling?.toFixed(2) }}
                                </div>
                            </div>
                        </div>
                        
                        <div class="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-base-300 pt-3 md:pt-0 w-full md:w-auto">
                            <div class="text-right">
                                <span class="text-[10px] uppercase font-bold opacity-50 block leading-none">Total Shipping</span>
                                <span class="text-xl font-black text-primary">${{ item.shipping_info.total?.toFixed(2) }}</span>
                            </div>
                            
                            <!-- Include Shipping Toggle -->
                            <div class="form-control">
                                <label class="label cursor-pointer gap-2 p-0">
                                    <span class="label-text text-xs font-bold opacity-75">Add to Cost</span>
                                    <input type="checkbox" v-model="includeShippingInCost" class="toggle toggle-primary toggle-sm" />
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- Sourcing Strategy Verdict -->
                    <div v-if="item.purchase_strategy" class="mt-4 border-2 rounded-xl p-4 shadow-sm" :class="{
                        'border-success bg-success/10': ['BUY_NOW', 'CHASE_AUCTION'].includes(item.purchase_strategy.verdict),
                        'border-error bg-error/10': item.purchase_strategy.verdict === 'PASS',
                        'border-warning bg-warning/10': ['WATCH', 'NEGOTIATE'].includes(item.purchase_strategy.verdict),
                        'border-primary bg-primary/10': !['PASS', 'WATCH', 'BUY_NOW', 'NEGOTIATE', 'CHASE_AUCTION'].includes(item.purchase_strategy.verdict)
                    }">
                        <div class="flex items-center gap-2 mb-2">
                           <Icon icon="solar:magic-stick-linear" class="text-2xl" v-if="['BUY_NOW', 'CHASE_AUCTION'].includes(item.purchase_strategy.verdict)" />
                           <Icon icon="solar:stop-circle-linear" class="text-2xl" v-if="item.purchase_strategy.verdict === 'PASS'" />
                           <Icon icon="solar:eye-linear" class="text-2xl" v-if="['WATCH', 'NEGOTIATE'].includes(item.purchase_strategy.verdict)" />
                           <h3 class="font-black text-lg uppercase tracking-wider" :class="{
                                'text-success': ['BUY_NOW', 'CHASE_AUCTION'].includes(item.purchase_strategy.verdict),
                                'text-error': item.purchase_strategy.verdict === 'PASS',
                                'text-warning': ['WATCH', 'NEGOTIATE'].includes(item.purchase_strategy.verdict)
                           }">{{ item.purchase_strategy.verdict.replace('_', ' ') }}</h3>
                        </div>
                        
                        <div v-if="item.purchase_strategy.current_asking_price && !item.purchase_strategy.current_asking_price.includes('No Asking Price')" class="mb-2 inline-flex badge badge-neutral shadow-sm font-bold p-3">
                            Asking/Bid: {{ item.purchase_strategy.current_asking_price }}
                        </div>

                        <p class="text-sm font-medium leading-relaxed opacity-90">{{ item.purchase_strategy.advice }}</p>
                    </div>

                    <!-- Condition Assessment -->
                    <div v-if="item.condition_notes" class="mt-4 bg-base-200 p-4 border border-base-300 rounded-lg">
                        <div class="font-bold text-sm mb-1 opacity-70 uppercase tracking-wide flex gap-2 items-center">
                            <span><Icon icon="solar:magnifer-linear" class="w-4 h-4" /></span> Visual Condition Assessment
                        </div>
                        <p class="text-sm font-medium">{{ item.condition_notes }}</p>
                    </div>

                    <!-- Comparables Dropdown -->
                    <div class="collapse collapse-arrow bg-base-200 rounded-box mt-4">
                        <input type="checkbox" /> 
                        <div class="collapse-title font-bold text-sm">
                             View Market Comparables
                        </div>
                        <div class="collapse-content"> 
                            <table class="table table-xs w-full">
                                <thead>
                                    <tr><th>Item</th><th>Price</th></tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(comp, i) in (item.comparables || [])" :key="i">
                                        <td>{{ comp.name }}</td>
                                        <td class="font-mono font-bold">{{ comp.price }}</td>
                                    </tr>
                                    <tr v-if="!item.comparables?.length">
                                        <td colspan="2" class="text-center opacity-50 italic">No comparables found</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Bundle Lot Components -->
                    <div v-if="item.lot_items && item.lot_items.length > 0" class="mt-4 bg-base-200 border border-base-300 rounded-xl p-4">
                        <div class="font-bold text-sm mb-2 flex items-center gap-2 text-primary">
                            <Icon icon="solar:box-linear" class="w-5 h-5" />
                            <span>Bundle Components ({{ item.lot_items.length }} Items)</span>
                        </div>
                        <ul class="space-y-2 text-xs font-medium">
                            <li v-for="(subItem, subIdx) in item.lot_items" :key="subIdx" class="bg-base-100 p-3 rounded-lg border border-base-300 flex flex-col gap-1.5 shadow-sm">
                                <div class="flex justify-between items-start gap-3 w-full">
                                    <span class="text-base-content font-bold leading-snug text-left">{{ subItem.name }}</span>
                                    <span class="badge badge-outline badge-primary badge-xs whitespace-nowrap px-1.5 py-1">{{ subItem.condition }}</span>
                                </div>
                                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] opacity-75 border-t border-base-200/60 pt-2 mt-0.5">
                                    <span>Est. Resale: <strong class="text-primary">{{ subItem.estimated_value }}</strong></span>
                                    <span class="opacity-30">|</span>
                                    <span>Max Buy: <strong class="text-success">${{ calculateMaxBuy(subItem.estimated_value) }}</strong></span>
                                    <span class="opacity-30">|</span>
                                    <span>Max Bid: <strong class="text-secondary">${{ calculateSubItemMaxBid(subItem, item) }}</strong></span>
                                    <span v-if="cost" class="opacity-30">|</span>
                                    <span v-if="cost">Split Cost Basis: <strong class="text-warning">${{ (parsePrice(cost) / item.lot_items.length).toFixed(2) }}</strong></span>
                                </div>
                            </li>
                        </ul>

                        <!-- Save Mode Select -->
                        <div class="form-control mt-4 border-t border-base-300 pt-3">
                            <label class="label pb-1.5"><span class="label-text text-xs font-bold opacity-75">Inventory Import Preference</span></label>
                            <div class="join grid grid-cols-2 w-full font-bold">
                                <button class="btn btn-xs join-item btn-outline text-[10px]" :class="{ 'btn-active btn-primary': !item.save_individually }" @click="item.save_individually = false">
                                    Save as Single Bundle
                                </button>
                                <button class="btn btn-xs join-item btn-outline text-[10px]" :class="{ 'btn-active btn-primary': item.save_individually }" @click="item.save_individually = true">
                                    Split Individually (x{{ item.lot_items.length }})
                                </button>
                            </div>
                            <div class="text-[10px] opacity-60 mt-1.5 leading-normal font-bold">
                                <span v-if="item.save_individually">
                                    Creates {{ item.lot_items.length }} separate inventory items. Cost basis will be split evenly (${{ (parsePrice(cost) / item.lot_items.length).toFixed(2) }} each).
                                </span>
                                <span v-else>
                                    Saves the entire lot as a single combined inventory item.
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Editable Fields -->
                    <div class="form-control mt-4">
                        <label class="label"><span class="label-text font-bold opacity-70">Suggested Title</span></label>
                        <div class="relative">
                            <input v-model="item.title" type="text" class="input input-bordered w-full font-bold text-sm pr-8" />
                            <span class="absolute right-2 top-1/2 -translate-y-1/2 opacity-30"><Icon icon="solar:clipboard-text-linear" class="w-5 h-5" /></span>
                        </div>
                    </div>

                    <!-- Custom Resale Price Slider -->
                    <div class="form-control mt-6 bg-base-200 p-4 rounded-xl border border-base-300">
                        <label class="label pt-0 pb-2">
                             <span class="label-text font-bold opacity-70 flex items-center gap-2">
                                 <Icon icon="solar:tag-linear" class="w-5 h-5" /> Target Resale Price
                             </span>
                        </label>
                        
                        <div class="flex flex-col sm:flex-row items-center gap-4">
                            <input type="range" 
                                   v-model.number="item.selected_resale_price" 
                                   :min="getSliderMinMax(item).min" 
                                   :max="getSliderMinMax(item).max" 
                                   class="range sm:grow w-full" 
                                   :class="getSliderColor(item)"
                                   step="1" />
                            
                            <div class="join w-full sm:w-auto mt-2 sm:mt-0 shadow-sm">
                                <span class="join-item btn no-animation bg-base-100 border-base-300 pointer-events-none">$</span>
                                <input type="number" v-model.number="item.selected_resale_price" class="input input-bordered join-item w-full sm:w-24 font-bold text-lg text-center" />
                            </div>
                        </div>
                        <div class="w-full flex justify-between text-xs px-2 mt-2 font-bold opacity-40">
                             <span>Low (${{ getSliderMinMax(item).min }})</span>
                             <span>High (${{ getSliderMinMax(item).max }})</span>
                        </div>
                    </div>

                    <div class="mt-4">
                        <label class="label pt-0"><span class="label-text font-bold opacity-70">Keywords</span></label>
                        <div class="border border-base-300 rounded-lg p-2 bg-base-100 flex flex-wrap gap-2 items-center">
                            <span v-for="(kw, idx) in item.keywords" :key="idx" class="badge badge-secondary gap-1">
                                {{ kw }}
                                <button @click="item.keywords.splice(idx, 1)" class="hover:text-error hover:font-bold">✕</button>
                            </span>
                            <input type="text" placeholder="Add..." class="input input-xs grow border-none focus:outline-none min-w-[80px]" @keydown.enter.prevent="addKeyword(item, $event)" />
                        </div>
                    </div>

                    <div class="form-control mt-4">
                         <label class="label"><span class="label-text font-bold opacity-70">Condition Notes</span></label>
                         <p class="text-xs opacity-70 mb-2 border-l-2 border-base-300 pl-2 italic">
                            {{ item.condition_notes || 'No notes generated.' }}
                         </p>
                    </div>

                    <!-- SAVE BUTTON -->
                    <button @click="handleSaveItem(item, Number(index))" 
                            class="btn btn-outline btn-primary w-full mt-6"
                            :disabled="item.saving || item.saved">
                        <span v-if="item.saving" class="loading loading-spinner"></span>
                        {{ item.saved ? '✅ Saved to Cart' : 'Save Item' }}
                    </button>

                </div>
            </div>
        </div>

    </div>

    <!-- CAMERA MODAL (Full Screen Overlay) -->
    <dialog ref="cameraModal" class="modal">
        <div class="modal-box p-0 bg-black w-full h-full max-h-none rounded-none max-w-none flex flex-col relative">
            <video ref="videoPreview" autoplay playsinline class="w-full h-full object-cover flex-1"></video>
            
            <!-- OVERLAYS -->
            <div class="absolute top-0 left-0 right-0 p-4 bg-linear-to-b from-black/50 to-transparent flex justify-between items-start z-20">
                 <div class="badge badge-lg overflow-hidden transition-all" :class="images.length >= 5 ? 'badge-error' : 'badge-neutral'">
                    {{ images.length }} / 5 Photos
                 </div>
                 <button @click="closeCamera" class="btn btn-sm btn-circle btn-ghost text-white bg-black/20 backdrop-blur">✕</button>
            </div>

            <!-- IN-CAMERA TERMINALS -->
             <div v-if="images.length > 0" class="absolute left-0 right-0 bottom-32 z-20 px-4">
                 <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                     <div v-for="(img, idx) in images" :key="idx" class="relative w-16 h-16 shrink-0 rounded border-2 border-white/50 overflow-hidden shadow-lg animate-fade-in-up">
                         <img :src="img" class="w-full h-full object-cover" />
                     </div>
                 </div>
             </div>

            <div class="absolute bottom-10 left-0 right-0 flex justify-center items-center gap-8 pb-safe z-50">
                <!-- Done Button (Left) -->
                <button v-if="images.length > 0" @click="closeCamera" class="btn btn-neutral rounded-full px-6 bg-white/20 backdrop-blur border-white/30 text-white min-w-[80px]">
                    Done
                </button>
                <div v-else class="w-[80px]"></div> <!-- Spacer -->

                <!-- Capture Button (Center) -->
                <button @click="capturePhoto" 
                    class="btn btn-circle h-20 w-20 border-4 shadow-xl transform active:scale-95 transition-all"
                    :class="images.length >= 5 ? 'btn-disabled border-gray-500 opacity-50' : 'btn-primary border-white'"
                >
                    <span class="sr-only">Capture</span>
                    <div class="w-16 h-16 rounded-full bg-white" :class="{'scale-90': capturing}"></div>
                </button>

                <!-- Switch Camera (Right) -->
                <button @click="switchCamera" class="btn btn-circle btn-ghost text-white bg-black/30 backdrop-blur-md w-[80px]">
                   <span class="text-2xl"><Icon icon="solar:refresh-circle-linear" /></span>
                </button>
            </div>
        </div>
    </dialog>

    <!-- BOTTOM DOCK NAV (Sticky to Viewport) -->
    <div class="sticky bottom-0 z-40 flex h-20 bg-base-200 border-t border-base-300 w-full shadow-[0_-15px_40px_-15px_rgba(0,0,0,0.15)]">
        
        <!-- Start New -->
        <button @click="startNewScan" class="flex-1 flex flex-col items-center justify-center text-base-content/70 hover:bg-base-300 hover:text-base-content transition-colors pb-safe">
            <span class="text-2xl leading-none mb-1"><Icon icon="solar:restart-linear" /></span>
            <span class="font-bold tracking-wider uppercase text-[10px]">Start New</span>
        </button>

        <!-- AI Scout Primary -->
        <button @click="mode === 'speed' ? analyzeImage() : analyzeListing()" 
                class="flex-1 flex flex-col items-center justify-center bg-primary text-primary-content hover:bg-primary/90 transition-colors border-x border-base-300 shadow-inner pb-safe"
                :disabled="loading || (mode === 'speed' && images.length === 0) || (mode === 'precision' && !scoutUrl)">
            <span v-if="loading" class="loading loading-spinner mb-1"></span>
            <span v-else class="text-3xl leading-none mb-1"><Icon icon="solar:magic-stick-linear" /></span>
            <span class="font-black tracking-widest uppercase text-xs">AI Scout</span>
        </button>

        <!-- Track All / Save -->
        <button @click="saveAllItems" 
                class="flex-1 flex flex-col items-center justify-center transition-colors pb-safe"
                :class="(result && result.items && result.items.length > 0 && !result.items.some((i: any) => !i.saved && !i.saving)) ? 'bg-success/20 text-success' : (result && result.items && result.items.length > 0 ? 'bg-success text-success-content hover:bg-success/90' : 'text-base-content/30 cursor-not-allowed')"
                :disabled="savingAll || !result || !result.items || result.items.length === 0 || !result.items.some((i: any) => !i.saved && !i.saving)">
            <span v-if="savingAll" class="loading loading-spinner mb-1"></span>
            <span v-else class="text-2xl leading-none mb-1"><Icon icon="solar:object-scan-linear" /></span>
            <span class="font-bold tracking-wider uppercase text-[10px]">Track All</span>
        </button>
        
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue';
import { useAuth } from '../../composables/useAuth';
import { useCart } from '../../composables/useCart';
import { account, storage, databases, ID } from '../../lib/appwrite';
import { addToast } from '../../stores/toast';
import { Icon } from '@iconify/vue';

// APPWRITE
const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID; // Added this line
const ITEMS_COL = import.meta.env.PUBLIC_APPWRITE_ITEMS_COL; // Added this line
const BUCKET_ID = import.meta.env.PUBLIC_APPWRITE_BUCKET_ID;

// -- COMPOSABLES --
const { isAuthenticated, currentTeam, user } = useAuth();
const { 
    activeCart, addItemToCart, startCart, checkActiveCart, cartItems
} = useCart();

// -- LIFECYCLE --
onMounted(async () => {
    // Check for Re-Scout
    const urlParams = new URLSearchParams(window.location.search);
    const rescoutId = urlParams.get('rescout');
    
    if (rescoutId && databases) {
        console.log('[ScoutView] Re-scouting item:', rescoutId);
        analyzing.value = true;
        try {
            const itemDoc = await databases.getDocument(DB_ID, ITEMS_COL, rescoutId);
            if (itemDoc.rawAnalysis) {
                const analysis = JSON.parse(itemDoc.rawAnalysis);
                // Hydrate the view
                result.value = { items: [analysis] };
                console.log('[ScoutView] Hydrated analysis:', analysis);
                
                // Pre-fill inputs
                if(analysis.condition_notes) userNotes.value = analysis.condition_notes;
                
                // If it was already saved, we might want to know that, but user said "re run if need"
                // So we just show the result.
            } else {
                console.warn('[ScoutView] Item found but no rawAnalysis:', itemDoc);
                addToast({ type: 'warning', message: "This item was saved before the 'Re-Scout' feature was added. Cannot reload analysis." });
            }
        } catch (e) {
            console.error('[ScoutView] Failed to load re-scout item:', e);
            addToast({ type: 'error', message: "Failed to load item for re-scouting." });
        } finally {
            analyzing.value = false;
        }
    }
});

// -- STATE --
const successMessage = ref<string | null>(null);
const error = ref<string | null>(null);
const mode = ref<'speed' | 'precision'>('speed');
const loading = ref(false);
const analyzing = ref(false); // Added for re-scout feature
const images = ref<string[]>([]);
const imageFiles = ref<File[]>([]); 
const receiptFile = ref<File | null>(null);
const userNotes = ref('');
const dragOver = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const receiptInput = ref<HTMLInputElement | null>(null);

// URL Scraping
const scoutUrl = ref('');

// Shared Inputs
const cost = ref('');
const isAcquired = ref(false);
const sourcingLocation = ref('');
const storageLocation = ref('');

const result = ref<any>(null);
const zipCode = ref('');
const includeShippingInCost = ref(false);

// Camera
const cameraModal = ref<HTMLDialogElement | null>(null);
const videoPreview = ref<HTMLVideoElement | null>(null);
let stream: MediaStream | null = null;
let currentFacingMode = 'environment';

// -- INIT --
const ensureTrackerOpen = () => {
    if (window.innerWidth >= 1024) {
        const drawer = document.getElementById('app-drawer');
        if (drawer && !drawer.classList.contains('lg:drawer-open')) {
            drawer.classList.add('lg:drawer-open');
            setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
        }
    } else {
        const cb = document.getElementById('tracker-drawer') as HTMLInputElement;
        if (cb && !cb.checked) {
            cb.checked = true;
        }
    }
};

const hasAutoOpened = ref(false);

watch(cartItems, (newItems) => {
    if (newItems && newItems.length > 0 && !hasAutoOpened.value) {
        hasAutoOpened.value = true;
        ensureTrackerOpen();
    }
}, { immediate: true });

const initCartCheck = async () => {
   if (user.value) {
        console.log('[ScoutView] User present, checking cart:', user.value.$id);
        await checkActiveCart(user.value.$id);
        console.log('[ScoutView] checkActiveCart complete. ActiveCart:', activeCart.value);
    }
};

onMounted(async () => {
    console.log('[ScoutView] onMounted');
    await initCartCheck();
    
    // Check for ZIP code in localStorage first
    const savedZip = localStorage.getItem('scout_zip_code');
    if (savedZip) {
        zipCode.value = savedZip;
    }
    
    if (user.value) {
        const userZip = (user.value.prefs as any)?.zipCode;
        if (userZip) {
            zipCode.value = userZip;
        }
    }
});

// Watch for user to load if not ready on mount
watch(user, async (newUser) => {
    if (newUser) {
        console.log('[ScoutView] User loaded via watch, checking cart...');
        await initCartCheck();
        
        // Load ZIP Code from user prefs
        const userZip = (newUser.prefs as any)?.zipCode;
        if (userZip) {
            zipCode.value = userZip;
        }
    }
}, { immediate: true });

async function saveZipCode() {
    if (!zipCode.value) return;
    
    // Validate ZIP code is 5 digits
    const cleanZip = zipCode.value.trim().substring(0, 5);
    if (!/^\d{5}$/.test(cleanZip)) {
        return;
    }
    zipCode.value = cleanZip;

    localStorage.setItem('scout_zip_code', cleanZip);
    
    if (user.value && isAuthenticated.value) {
        try {
            console.log('[ScoutView] Saving ZIP Code to Appwrite preferences:', cleanZip);
            const currentPrefs = user.value.prefs || {};
            const updatedPrefs = { ...currentPrefs, zipCode: cleanZip };
            await account.updatePrefs(updatedPrefs);
            user.value.prefs = updatedPrefs;
            console.log('[ScoutView] Saved ZIP Code successfully');
        } catch (err: any) {
            console.error('[ScoutView] Failed to save ZIP Code in Appwrite preferences:', err);
        }
    }
}

watch([includeShippingInCost, result], () => {
    if (!result.value || !result.value.items || result.value.items.length === 0) return;
    
    const item = result.value.items[0];
    const askingPrice = parsePrice(item.purchase_strategy?.current_asking_price) || 0;
    const shippingTotal = item.shipping_info?.total || 0;
    
    if (includeShippingInCost.value) {
        cost.value = (askingPrice + shippingTotal).toFixed(2);
    } else {
        cost.value = askingPrice > 0 ? askingPrice.toFixed(2) : '';
    }
});

// -- CAMERA LOGIC --
const capturing = ref(false);

async function startCamera() {
    try {
        cameraModal.value?.showModal();
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: currentFacingMode } 
        });
        if (videoPreview.value) {
            videoPreview.value.srcObject = stream;
        }
    } catch (err: any) {
        console.error("Camera Error:", err);
        addToast({ type: 'error', message: "Could not access camera: " + err.message });
    }
}

function closeCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    cameraModal.value?.close();
}

function switchCamera() {
    currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
    closeCamera();
    setTimeout(startCamera, 300); // Small delay to allow modal to stay open logic
}

function capturePhoto() {
    if (!stream || !videoPreview.value) return;
    if (images.value.length >= 5) return;

    capturing.value = true;
    setTimeout(() => capturing.value = false, 150);
    
    const video = videoPreview.value;
    const canvas = document.createElement('canvas');
    const MAX_WIDTH = 1080;
    let width = video.videoWidth;
    let height = video.videoHeight;

    if (width > MAX_WIDTH) {
        height *= MAX_WIDTH / width;
        width = MAX_WIDTH;
    }

    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.scale(currentFacingMode === 'user' ? -1 : 1, 1); // Mirror if front cam
        if (currentFacingMode === 'user') ctx.translate(-width, 0);
        
        ctx.drawImage(video as unknown as CanvasImageSource, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        images.value.push(dataUrl);
        
        canvas.toBlob(blob => {
            if (blob) {
                const file = new File([blob], `capture_${Date.now()}.jpg`, { type: "image/jpeg" });
                imageFiles.value.push(file);
            }
        }, 'image/jpeg', 0.8);
    }
    // Don't close camera!
}

function removeImage(index: number) {
    images.value.splice(index, 1);
    imageFiles.value.splice(index, 1);
    if (images.value.length === 0) result.value = null;
}

// -- FILE UPLOAD --
async function handleFileUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files) {
        for (let i = 0; i < input.files.length; i++) {
             await processFile(input.files[i]);
        }
        input.value = ''; 
    }
}

async function handleDrop(e: DragEvent) {
    dragOver.value = false;
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
        let processedAtLeastOne = false;
        for (let i = 0; i < files.length; i++) {
             if (files[i].type.startsWith('image/')) {
                 await processFile(files[i]);
                 processedAtLeastOne = true;
             }
        }
        if (!processedAtLeastOne) {
             addToast({ type: 'warning', message: 'No valid image files detected in drop. (File type: ' + files[0].type + ')' });
        }
    } else {
        // Attempt to handle dropped URL (e.g. dragging image from another tab)
        let urlString = e.dataTransfer?.getData("text/uri-list");
        if (!urlString) {
            const html = e.dataTransfer?.getData("text/html");
            if (html) {
                const imgMatch = html.match(/src=["'](.*?)["']/);
                if (imgMatch) urlString = imgMatch[1];
            }
        }
        if (!urlString) urlString = e.dataTransfer?.getData("text/plain");
        
        if (urlString && urlString.trim().startsWith("http")) {
            const url = urlString.trim();
            try {
                const proxyUrl = "/api/proxy-image?url=" + encodeURIComponent(url);
                const res = await fetch(proxyUrl);
                if (res.ok) {
                    const blob = await res.blob();
                    const urlPart = url.split('/').pop();
                    const filename = (urlPart ? urlPart.split('?')[0] : "dragged_image.jpg") || "dragged_image.jpg";
                    const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
                    await processFile(file);
                } else {
                    addToast({ type: 'warning', message: "Could not load image from website due to security restrictions. Please save it to your computer first." });
                }
            } catch(err: any) {
                addToast({ type: 'error', message: "Error fetching dropped image: " + err.message });
            }
        } else {
            console.warn('No files found in dataTransfer');
            addToast({ type: 'warning', message: 'No images or valid links detected in drop.' });
        }
    }
}

function onDragLeave(e: DragEvent) {
    if (!(e.currentTarget as Node)?.contains(e.relatedTarget as Node)) {
        dragOver.value = false;
    }
}

function handleReceiptUpload(e: Event) {
     const input = e.target as HTMLInputElement;
     if (input.files && input.files[0]) {
         receiptFile.value = input.files[0];
     }
}

async function processFile(file: File) {
    if (images.value.length >= 5) return;
    if (!file.type.startsWith('image/')) return;

    return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result) {
                const img = new Image();
                img.onload = () => {
                    // Resize logic for display/API
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1080;
                    let width = img.width;
                    let height = img.height;
                     if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                    canvas.width = width;
                    canvas.height = height;
                     const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    images.value.push(dataUrl);
                    imageFiles.value.push(file);
                    resolve();
                };
                img.src = e.target.result as string;
            }
        };
        reader.readAsDataURL(file);
    });
}

// -- URL SCRAPING --
const proxify = (url: string | null): string | undefined => {
    if (!url) return undefined;
    if (url.startsWith('blob:') || url.startsWith('data:') || url.includes('/api/proxy-image')) return url;
    if (url.includes('/storage/buckets/')) return url;
    if (url.startsWith('http')) {
        return `/api/proxy-image?url=${encodeURIComponent(url)}`;
    }
    return url;
};

const handleImageError = (e: Event) => {
    const target = e.target as HTMLImageElement;
    if (target.src.includes('/api/proxy-image')) {
        try {
            const urlObj = new URL(target.src);
            const rawUrl = urlObj.searchParams.get('url');
            if (rawUrl && !target.dataset.triedFallback) {
                target.dataset.triedFallback = 'true';
                target.src = decodeURIComponent(rawUrl);
                return;
            }
        } catch (err) {}
    }
    // Set to a placeholder or hide if all fails
    target.style.display = 'none';
};

async function analyzeListing() {
    const url = scoutUrl.value;
    const isId = url && url.match(/^\d+$/);
    if (!url || (!url.startsWith('http') && !isId)) {
        addToast({ type: 'warning', message: "Please enter a valid URL or Item ID." });
        return;
    }
    
    loading.value = true;
    error.value = null;
    
    const targetUrl = url;
    
    try {
        const payload = JSON.stringify({ 
            images: [], 
            notes: targetUrl + '\n\n' + userNotes.value,
            zipCode: zipCode.value
        });

        const response = await fetch(`/api/identify-item`, {
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json' },
            body: payload
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.details || err.error || 'Server Error');
        }

        const data = await response.json();
        
        if (data && !data.items && (data.identity || data.title)) {
            data.items = [{ ...data }];
        }
        
        if (data.items) {
            data.items.forEach((it: any) => {
                it.selected_resale_price = Math.round(parsePrice(it.price_breakdown?.fair) || 0);
            });
        }
        result.value = data;
        sourcingLocation.value = targetUrl;
        
        nextTick(() => {
            const el = document.getElementById('scout-results-section');
            if (el) {
                const y = el.getBoundingClientRect().top + window.scrollY - 80;
                window.scrollTo({ top: y, behavior: 'smooth' });
            }
        });

    } catch (e: any) {
        console.error(e);
        error.value = `Listing Analysis Failed: ${e.message}`;
    } finally {
        loading.value = false;
        scoutUrl.value = ''; // Prep for next
    }
}



// -- ANALYSIS --
async function analyzeImage() {
    if (!images.value.length) return;
    loading.value = true;
    error.value = null;
    
    try {
        const payload = JSON.stringify({ 
            images: images.value,
            notes: userNotes.value,
            zipCode: zipCode.value
        });

        const response = await fetch(`/api/identify-item`, {
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json' },
            body: payload
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.details || err.error || 'Server Error');
        }

        const data = await response.json();
        
        if (data && !data.items && (data.identity || data.title)) {
            data.items = [{ ...data }];
        }
        
        if (data.items) {
            data.items.forEach((it: any) => {
                it.selected_resale_price = Math.round(parsePrice(it.price_breakdown?.fair) || 0);
            });
        }
        result.value = data;
        
        nextTick(() => {
            const el = document.getElementById('scout-results-section');
            if (el) {
                const y = el.getBoundingClientRect().top + window.scrollY - 80;
                window.scrollTo({ top: y, behavior: 'smooth' });
            }
        });

    } catch (e: any) {
        console.error(e);
        error.value = `Analysis Failed: ${e.message}`;
    } finally {
        loading.value = false;
    }
}

// -- ACTION COMBOS --
function startNewScan() {
    result.value = null;
    images.value = [];
    imageFiles.value = [];
    scoutUrl.value = '';
    userNotes.value = '';
    cost.value = '';
    isAcquired.value = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

const savingAll = ref(false);

async function saveAllItems() {
    if (savingAll.value) return;
    if (!result.value || !result.value.items) return;
    savingAll.value = true;
    try {
        for (let i = 0; i < result.value.items.length; i++) {
            const item = result.value.items[i];
            if (!item.saved && !item.saving) {
                 await handleSaveItem(item, i);
            }
        }
    } finally {
        savingAll.value = false;
    }
}

// -- KEYWORDS --
function addKeyword(item: any, event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input) return;
    const val = input.value.trim();
    if (val) {
        item.keywords = item.keywords || [];
        if (!item.keywords.includes(val)) item.keywords.push(val);
        input.value = '';
    }
}

// -- PRICE HELPERS --
function parsePrice(priceStr: any) {
    if (!priceStr) return 0;
    const s = String(priceStr);
    const matches = s.match(/[0-9.]+/g);
    if (!matches || !matches.length) return 0;
    if (matches.length >= 2) {
         return (parseFloat(matches[0]) + parseFloat(matches[1])) / 2; 
    }
    return parseFloat(matches[0]);
}

function calculateMaxBuy(fairPriceStr: any) {
    const fair = parsePrice(fairPriceStr);
    return Math.floor(fair * 0.4); // 40% rule placeholder
}

function calculateMaxBid(item: any) {
    const maxBuy = calculateMaxBuy(item.price_breakdown?.fair);
    const shippingTotal = item.shipping_info?.total || 0;
    const maxBid = maxBuy - shippingTotal;
    return maxBid > 0 ? Math.floor(maxBid) : 0;
}

function calculateSubItemMaxBid(subItem: any, parentItem: any) {
    const maxBuy = calculateMaxBuy(subItem.estimated_value);
    const shippingTotal = parentItem.shipping_info?.total || 0;
    const itemsCount = parentItem.lot_items?.length || 1;
    const shippingPerItem = shippingTotal / itemsCount;
    const maxBid = maxBuy - shippingPerItem;
    return maxBid > 0 ? Math.floor(maxBid) : 0;
}

function formatPriceDisplay(val: any) {
    if (!val) return '-';
    
    if (Array.isArray(val)) {
        return '$' + val.join(' - $');
    }
    
    if (typeof val === 'string') {
        const cleanVal = val.trim();
        if (cleanVal.startsWith('[') && cleanVal.endsWith(']')) {
             try {
                 const parsed = JSON.parse(cleanVal);
                 if (Array.isArray(parsed)) return '$' + parsed.join(' - $');
             } catch(e){}
        }
        
        if (cleanVal.includes('$')) return cleanVal;
        
        const matches = cleanVal.match(/[0-9.]+/g);
        if (matches) {
            if (matches.length === 2) return `$${matches[0]} - $${matches[1]}`;
            if (matches.length === 1) return `$${matches[0]}`;
        }
        return cleanVal;
    }
    
    return String(val);
}

function getSliderMinMax(item: any) {
    const poor = parsePrice(item.price_breakdown?.poor);
    const boutique = parsePrice(item.price_breakdown?.boutique_premium);
    const mint = parsePrice(item.price_breakdown?.mint);
    
    let min = Math.floor(poor || 0);
    let max = Math.ceil(boutique || mint || (min * 3) || 100);
    
    if (min >= max) max = min + 10;
    return { min, max };
}

function getSliderColor(item: any) {
    const min = parsePrice(item.price_breakdown?.poor) || 0;
    const fair = parsePrice(item.price_breakdown?.fair) || 0;
    const mint = parsePrice(item.price_breakdown?.mint) || 0;
    const val = item.selected_resale_price || 0;
    
    if (val <= min) return 'range-warning';
    if (val <= fair) return 'range-primary';
    if (val <= mint) return 'range-success';
    return 'range-secondary';
}

// -- SAVE ACTION --
async function handleSaveItem(item: any, index: number) {
    console.log('[ScoutView] handleSaveItem callled for item:', item.identity);
    
    if (item.saving || item.saved) {
        console.log('[ScoutView] Item already saving/saved, ignoring save request for', item.identity);
        return;
    }
    
    if (!user.value) {
        addToast({ type: 'warning', message: "Please login first." });
        return;
    }
    
    // Auto-select first team if currentTeam is stuck (Common issue on fresh load)
    if (!currentTeam.value && (user.value.prefs as any)?.teamId) {
        // We could try to switch, but for now just warn
        console.warn('[ScoutView] User has prefs.teamId but currentTeam is null');
    }

    if (!currentTeam.value) {
        // Fallback: Check useAuth teams list and pick one
        const { teams, switchTeam } = useAuth();
        if (teams.value && teams.value.length > 0) {
            console.log('[ScoutView] Auto-switching to first team:', teams.value[0].name);
            await switchTeam(teams.value[0]);
        } else {
            error.value = "Active Team Missing. Resale Command requires an active organization to save data.";
            addToast({ type: 'error', message: "No active organization found. Please create one in the dashboard or navbar." });
            return;
        }
    }

    item.saving = true;
    try {
        // 1. Upload Images (local files) or Remote Images (scraped)
        let galleryIds: string[] = [];
        if (imageFiles.value.length > 0 && BUCKET_ID) {
             console.log('[ScoutView] Uploading local images...', imageFiles.value.length);
             const uploads = await Promise.all(imageFiles.value.map(file => 
                 storage.createFile(BUCKET_ID, ID.unique(), file)
             ));
             galleryIds = uploads.map(u => u.$id);
             console.log('[ScoutView] Local images uploaded:', galleryIds);
        } else if (item.fetched_images && item.fetched_images.length > 0) {
             console.log('[ScoutView] Uploading remote images array...', item.fetched_images);
             
             // Ensure the current main image (item.fetched_image) is uploaded first
             const mainImg = item.fetched_image || item.fetched_images[0];
             const otherImgs = item.fetched_images.filter((img: string) => img !== mainImg);
             const imagesToUpload = [mainImg, ...otherImgs].slice(0, 5); // Upload max 5 images
             
             try {
                 const uploads = await Promise.all(imagesToUpload.map(async (imgUrl) => {
                     try {
                         const res = await fetch('/api/upload-remote-image', {
                             method: 'POST',
                             headers: { 'Content-Type': 'application/json' },
                             body: JSON.stringify({ url: imgUrl })
                         });
                         if (res.ok) {
                             const uploadRes = await res.json();
                             return uploadRes.fileId || null;
                         }
                     } catch (e) {
                         console.error('[ScoutView] Failed to upload remote image:', imgUrl, e);
                     }
                     return null;
                 }));
                 galleryIds = uploads.filter((id): id is string => id !== null);
                 console.log('[ScoutView] Remote images uploaded:', galleryIds);
             } catch (err) {
                 console.error('[ScoutView] Failed to upload remote images:', err);
             }
        } else if (item.fetched_image) {
             console.log('[ScoutView] Uploading remote image...', item.fetched_image);
             try {
                 const res = await fetch('/api/upload-remote-image', {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ url: item.fetched_image })
                 });
                 if (res.ok) {
                     const data = await res.json();
                     if (data.fileId) {
                         galleryIds.push(data.fileId);
                         console.log('[ScoutView] Remote image uploaded, fileId:', data.fileId);
                     }
                 } else {
                     console.warn('[ScoutView] Remote image upload API failed:', res.statusText);
                 }
             } catch (err) {
                 console.error('[ScoutView] Failed to upload remote image:', err);
             }
        }
        
        // 2. Upload Receipt if present
        let receiptId: string | null = null;
        if (receiptFile.value && BUCKET_ID) {
             console.log('[ScoutView] Uploading receipt...');
             const up = await storage.createFile(BUCKET_ID, ID.unique(), receiptFile.value);
             receiptId = up.$id;
        }

        // 3. Ensure Cart
        console.log('[ScoutView] Checking activeCart:', activeCart.value);
        if (!activeCart.value) {
             console.log('[ScoutView] No active cart, starting new one...');
             await startCart(sourcingLocation.value || "Quick Trip", currentTeam.value?.$id || '', user.value.$id);
             console.log('[ScoutView] New cart started:', activeCart.value);
        }

        // 4. Save Item(s)
        if (item.save_individually && item.lot_items && item.lot_items.length > 0) {
             console.log('[ScoutView] Saving items individually...', item.lot_items.length);
             const individualCost = cost.value ? parseFloat((parseFloat(cost.value) / item.lot_items.length).toFixed(2)) : 0.0;
             
             // Loop and save each individual sub-item
             for (let i = 0; i < item.lot_items.length; i++) {
                 const subItem = item.lot_items[i];
                 
                 let noteDetails = `Lot Item: ${subItem.name}\nInferred Condition: ${subItem.condition}\n` + (item.condition_notes || '');
                 if (item.shipping_info) {
                      const { shipping, handling, carrier, zipCode } = item.shipping_info;
                      noteDetails += `\n[Shipping: $${(shipping/item.lot_items.length).toFixed(2)}, Handling: $${(handling/item.lot_items.length).toFixed(2)} via ${carrier} to ${zipCode}]`;
                 }
                 if (receiptId) {
                      noteDetails += `\n[RECEIPT: ${receiptId}]`;
                 }
                 if (storageLocation.value) {
                      noteDetails = `[BIN: ${storageLocation.value}]\n` + noteDetails;
                 }
                 
                 const itemPayload = {
                     identity: subItem.name,
                     title: subItem.name,
                     conditionNotes: noteDetails,
                     redFlags: item.red_flags || [],
                     cost: individualCost,
                     resalePrice: parsePrice(subItem.estimated_value) || 0.0,
                     maxBuyPrice: calculateMaxBuy(subItem.estimated_value) || 0.0,
                     sourcingLocation: sourcingLocation.value || '',
                     storageLocation: storageLocation.value || '',
                     status: isAcquired.value ? 'acquired' : 'tracked',
                     keywords: item.keywords || [],
                     galleryImageIds: galleryIds, // Share the lot images
                 };
                 
                 console.log('[ScoutView] Adding individual lot item to cart:', itemPayload);
                 await addItemToCart(itemPayload);
             }
        } else {
             // Save as single bundle
             let noteDetails = (userNotes.value ? `User Note: ${userNotes.value}\n` : '') + (item.condition_notes || '');
             if (item.shipping_info) {
                  const { shipping, handling, carrier, zipCode } = item.shipping_info;
                  noteDetails += `\n[Shipping: $${shipping?.toFixed(2)}, Handling: $${handling?.toFixed(2)} via ${carrier} to ${zipCode}]`;
             }
             if (receiptId) {
                  noteDetails += `\n[RECEIPT: ${receiptId}]`;
             }
             if (storageLocation.value) {
                  noteDetails = `[BIN: ${storageLocation.value}]\n` + noteDetails;
             }

             const itemPayload: any = {
                 identity: item.identity,
                 title: item.title || item.identity,
                 conditionNotes: noteDetails,
                 redFlags: item.red_flags || [],
                 cost: cost.value ? parseFloat(parseFloat(cost.value).toFixed(2)) : 0.0,
                 resalePrice: item.selected_resale_price || parsePrice(item.price_breakdown?.fair) || 0.0,
                 maxBuyPrice: calculateMaxBuy(item.price_breakdown?.fair) || 0.0,
                 sourcingLocation: sourcingLocation.value || '',
                 storageLocation: storageLocation.value || '',
                 status: isAcquired.value ? 'acquired' : 'tracked',
                 keywords: item.keywords || [],
                 galleryImageIds: galleryIds,
             };
             
             // Removed JSON dump to marketDescription

             console.log('[ScoutView] Adding bundle lot item to cart:', itemPayload);
             await addItemToCart(itemPayload);
        }
        console.log('[ScoutView] Item added to cart successfully');
        
        item.saved = true;
        successMessage.value = `Saved ${item.identity}!`;

        // Reset inputs smoothly
        setTimeout(() => {
            successMessage.value = null;
            // Clear lists for next scan if in speed mode? 
            // Or maybe just clear this item from result list.
            // For now, let user manually decide when to clear all.
        }, 2000);

    } catch (e: any) {
        console.error('[ScoutView] Save Failed:', e);
        error.value = "Save Failed: " + e.message;
    } finally {
        item.saving = false;
    }
}
</script>

<style scoped>
.pb-safe {
    padding-bottom: env(safe-area-inset-bottom, 20px);
}
</style>

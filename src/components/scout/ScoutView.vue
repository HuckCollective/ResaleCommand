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

    <!-- MAIN CONTENT AREA (Intake Cockpit) -->
    <div class="flex-1 p-4 md:p-6 space-y-6 w-full max-w-7xl mx-auto pb-60 sm:pb-72">

        <!-- 1. UNIFIED INTAKE SECTION (No Tabs) -->
        <div class="card bg-base-100 shadow-sm border border-base-200">
            <div class="card-body p-4 space-y-4">
                
                <!-- 1a. DETAILS ON TOP (Optional notes: size, brand, defect, etc.) -->
                <div class="form-control w-full flex flex-col">
                    <div class="mb-1 text-xs font-semibold opacity-70 px-1">Additional Details (Optional) Size, Brand, Defects, etc.</div>
                    <textarea v-model="userNotes" class="textarea textarea-bordered w-full h-20 text-xs sm:text-sm leading-relaxed" placeholder="e.g. Size Large, Nike tag from 2015, small tear on sleeve..."></textarea>
                </div>

                <!-- 1b. CAMERA & PHOTO GALLERY -->
                <div class="form-control w-full">
                    <PhotoGalleryManager 
                        v-model:new-photos="images"
                        v-model:main-selection="mainPhotoSelection"
                        :max-photos="10"
                        :scanner-widget="scannerWidget"
                        output-format="object"
                        :show-header="false"
                        :allow-paste="false"
                        @open-camera="scannerWidget?.startCamera()"
                    />
                </div>

                <!-- OR DIVIDER -->
                <div class="divider text-xs font-bold uppercase tracking-wider opacity-60 my-0">OR PASTE WEB LINK</div>

                <!-- 1c. WEB URL INPUT -->
                <div v-if="isAuthenticated" class="form-control w-full space-y-2">
                    <div class="flex flex-col sm:flex-row gap-2">
                        <div class="grow form-control">
                            <div class="relative flex items-center">
                                <Icon icon="solar:link-linear" class="absolute left-3 w-4 h-4 opacity-50 pointer-events-none" />
                                <input 
                                    type="text" 
                                    v-model="scoutUrl" 
                                    class="input input-bordered w-full pl-9 font-mono text-sm" 
                                    placeholder="Paste eBay, ShopGoodwill, FB Marketplace, Poshmark or Mercari link..." 
                                    @keydown.enter.prevent="handleAnalyze"
                                />
                                <button v-if="scoutUrl" type="button" @click="scoutUrl = ''" class="absolute right-2 btn btn-ghost btn-xs btn-circle opacity-60 hover:opacity-100">✕</button>
                            </div>
                        </div>
                        <div class="w-full sm:w-32 form-control">
                            <input type="text" v-model="zipCode" @blur="saveZipCode" @change="saveZipCode" class="input input-bordered w-full font-mono text-sm text-center" placeholder="My Zip" maxlength="5" />
                        </div>
                    </div>
                </div>
                
                <div v-else class="text-center bg-base-200 border border-base-300 rounded-lg p-3 text-xs">
                    <span class="opacity-70">Web Link Import requires login. </span>
                    <a href="/login" class="link text-secondary font-bold">Log in to unlock access.</a>
                </div>

            </div>
        </div>
    </div>

    <!-- 2. FULL-SCREEN SCOUT RESULTS (Modeled directly after ItemDrawer layout: pinned header, window-edge scroll body, pinned footer) -->
    <div 
        v-if="result && isResultsModalOpen" 
        class="fixed inset-0 z-50 bg-base-100 flex flex-col h-screen overflow-hidden animate-in fade-in duration-200"
    >
        <!-- Modal Top Bar (flex-none pinned header) -->
        <div class="flex-none h-14 sm:h-16 border-b border-base-300 bg-base-100/95 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between z-30 shadow-xs">
            <div class="flex items-center gap-2 min-w-0">
                <button type="button" @click="isResultsModalOpen = false" class="btn btn-sm btn-ghost btn-circle" title="Back to Intake">
                    <Icon icon="solar:arrow-left-linear" class="w-5 h-5" />
                </button>
                <div class="min-w-0">
                    <div class="font-black text-xs sm:text-sm text-base-content truncate flex items-center gap-2">
                        <span>Scouting Report</span>
                        <span v-if="result.items && result.items.length > 0" class="badge badge-primary badge-xs sm:badge-sm font-bold">
                            {{ result.items.length }} {{ result.items.length === 1 ? 'Item' : 'Items (Lot)' }}
                        </span>
                    </div>
                    <div class="text-[10px] opacity-60 truncate">Inspect pricing, condition, & save to Buy Tracker</div>
                </div>
            </div>
            
            <div class="flex items-center gap-1.5">
                <button type="button" @click="isResultsModalOpen = false" class="btn btn-sm btn-circle btn-ghost" title="Close Scouting Report">
                    ✕
                </button>
            </div>
        </div>

        <!-- Scrollable Report Body (flex-1 overflow-y-auto w-full - Scrollbar on the extreme right of the window) -->
        <div class="flex-1 overflow-y-auto w-full">
            <div class="w-full max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-5 space-y-6">
                <!-- 3. RESULTS (ITEM CARDS) -->
                <div id="scout-results-section" class="space-y-6">
            <div v-for="(item, index) in ((result.items && result.items.length > 0) ? result.items : [result])" :key="index" class="card bg-base-100 shadow-sm border border-base-200">
                <div class="card-body p-4 md:p-6">
                                    <!-- 1. Title Header & Input (Top of Card) -->
                    <div class="space-y-1 mb-4">
                        <div class="flex items-center gap-2 mb-1 flex-wrap">
                            <span class="text-xs uppercase font-bold tracking-widest text-primary font-mono">Scouted Listing</span>
                            <span v-if="getTierBadgeInfo(item)" class="badge font-bold gap-1 shadow-xs" :class="getTierBadgeInfo(item).class">
                                {{ getTierBadgeInfo(item).label }}
                            </span>
                            <div class="badge badge-neutral">#{{ Number(index) + 1 }}</div>
                        </div>
                        
                        <!-- Suggested Title Input -->
                        <div class="form-control w-full mt-1">
                            <div class="relative">
                                <input v-model="item.title" type="text" class="input input-bordered w-full font-black text-sm sm:text-base pr-8" placeholder="Item Title..." />
                                <span class="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none"><Icon icon="solar:pen-linear" class="w-4 h-4" /></span>
                            </div>
                        </div>

                        <div class="flex flex-wrap gap-2 pt-1">
                            <a v-if="sourcingLocation && sourcingLocation.startsWith('http')" :href="sourcingLocation" target="_blank" class="btn btn-xs btn-outline btn-secondary gap-1 shadow-xs rounded-lg">
                                <Icon icon="solar:link-linear" class="w-3.5 h-3.5" /> View Source Listing
                            </a>
                            <a v-if="getItemDisplayImage(item) && getItemDisplayImage(item).startsWith('http')" :href="'https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(getItemDisplayImage(item))" target="_blank" class="btn btn-xs btn-outline btn-primary gap-1 shadow-xs rounded-lg">
                                <Icon icon="solar:camera-linear" class="w-3.5 h-3.5" /> Search Google Lens
                            </a>
                        </div>
                    </div>

                    <!-- 2. COLLAPSIBLE PHOTOS & DETAILS SECTION (Compact on mobile so Verdict & Estimates are immediately visible!) -->
                    <div class="card bg-base-200/80 border border-base-300 rounded-2xl overflow-hidden mb-3 transition-all duration-200 shadow-xs">
                        <!-- Compact Preview & Toggle Bar -->
                        <div 
                            @click="isMediaDetailsExpanded = !isMediaDetailsExpanded"
                            class="p-2.5 sm:p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-base-300/60 transition-colors select-none"
                        >
                            <div class="flex items-center gap-2.5 min-w-0">
                                <!-- Small Thumbnail Preview -->
                                <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-base-300 shrink-0 overflow-hidden border border-base-content/10 relative flex items-center justify-center shadow-xs">
                                    <img 
                                        v-if="getItemDisplayImage(item)" 
                                        :src="proxify(getItemDisplayImage(item))" 
                                        @error="handleImageError" 
                                        referrerpolicy="no-referrer"
                                        class="w-full h-full object-cover" 
                                        alt="Thumbnail" 
                                    />
                                    <Icon v-else icon="solar:camera-linear" class="w-6 h-6 opacity-40 text-base-content" />
                                    
                                    <!-- Photo Count Badge -->
                                    <span v-if="(images.length + (itemGalleryImages?.length || 0)) > 1" class="absolute bottom-0.5 right-0.5 badge badge-neutral badge-xs font-mono text-[9px] px-1 py-0 h-3.5 leading-none opacity-90">
                                        {{ images.length + (itemGalleryImages?.length || 0) }}
                                    </span>
                                </div>

                                <!-- Summary Text (Photos count + Notes excerpt) -->
                                <div class="min-w-0 flex flex-col justify-center">
                                    <div class="flex items-center gap-1.5 flex-wrap">
                                        <span class="text-xs font-black text-base-content flex items-center gap-1">
                                            <Icon icon="solar:gallery-wide-bold" class="w-3.5 h-3.5 text-primary" />
                                            Photos &amp; Notes
                                        </span>
                                        <span class="badge badge-ghost badge-xs font-bold text-[10px] opacity-70 shrink-0">
                                            {{ (images.length + (itemGalleryImages?.length || 0)) }} {{ (images.length + (itemGalleryImages?.length || 0)) === 1 ? 'photo' : 'photos' }}
                                        </span>
                                    </div>
                                    <p class="text-[11px] opacity-65 truncate max-w-xs sm:max-w-md mt-0.5 font-medium">
                                        {{ userNotes && userNotes.trim() ? userNotes : 'No notes added. Tap to edit photos or add details.' }}
                                    </p>
                                </div>
                            </div>

                            <!-- Toggle Button & Icon -->
                            <button 
                                type="button" 
                                class="btn btn-xs sm:btn-sm btn-ghost gap-1 font-bold text-[11px] shrink-0 text-primary hover:bg-primary/10"
                            >
                                <span class="hidden sm:inline">{{ isMediaDetailsExpanded ? 'Collapse' : 'Expand' }}</span>
                                <span>{{ isMediaDetailsExpanded ? 'Hide' : 'Edit' }}</span>
                                <Icon :icon="isMediaDetailsExpanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'" class="w-4 h-4" />
                            </button>
                        </div>

                        <!-- Collapsible Body (Details textarea + full PhotoGalleryManager) -->
                        <div v-show="isMediaDetailsExpanded" class="p-3 sm:p-4 border-t border-base-300 space-y-3 bg-base-100 animate-in fade-in duration-150">
                            <!-- Additional Details Textarea -->
                            <div class="form-control w-full">
                                <div class="mb-1 text-xs font-bold text-base-content flex items-center justify-between px-1">
                                    <span class="flex items-center gap-1.5">
                                        <Icon icon="solar:document-text-bold" class="w-4 h-4 text-primary" />
                                        Additional Details (Size, Brand, Defects, etc.)
                                    </span>
                                    <span class="text-[10px] opacity-60 font-semibold">Saved to notes</span>
                                </div>
                                <textarea 
                                    v-model="userNotes" 
                                    class="textarea textarea-bordered w-full h-20 text-xs sm:text-sm leading-relaxed bg-base-100 font-medium" 
                                    placeholder="e.g. Size Large, Nike tag from 2015, small tear on sleeve, mint in box...">
                                </textarea>
                            </div>

                            <!-- Photo Gallery Manager -->
                            <div class="w-full">
                                <div class="mb-1 text-xs font-bold text-base-content flex items-center justify-between px-1">
                                    <span class="flex items-center gap-1.5">
                                        <Icon icon="solar:camera-bold" class="w-4 h-4 text-primary" />
                                        Listing Photos
                                    </span>
                                    <span class="text-[10px] opacity-60 font-semibold">Add, remove, or change main</span>
                                </div>
                                <!-- For primary scouted item -->
                                <PhotoGalleryManager 
                                    v-if="index === 0"
                                    v-model:existing-images="itemGalleryImages"
                                    v-model:new-photos="images"
                                    v-model:main-selection="mainPhotoSelection"
                                    :max-photos="15"
                                    :scanner-widget="scannerWidget"
                                    output-format="object"
                                    :show-header="false"
                                    :allow-paste="false"
                                    @open-camera="scannerWidget?.startCamera()"
                                />
                                <!-- Sub-item in a lot -->
                                <div v-else class="flex flex-col gap-3">
                                    <div v-if="getItemDisplayImage(item)" class="w-full h-64 bg-base-200 border border-base-300 rounded-xl relative overflow-hidden flex items-center justify-center shadow-inner group">
                                        <img :src="proxify(getItemDisplayImage(item))" 
                                             @error="handleImageError" 
                                             referrerpolicy="no-referrer"
                                             class="max-w-full max-h-full object-contain" 
                                             alt="Lot Item Image" />
                                        <div class="absolute top-2 left-2 badge badge-neutral gap-1 shadow font-bold text-xs uppercase tracking-wide">
                                            <Icon icon="solar:camera-linear" class="w-3.5 h-3.5" /> Lot Item #{{ Number(index) + 1 }}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 4. Sourcing Strategy Verdict (Pass / No Pass) with Max Landed & Max Bid Built-in -->
                    <div v-if="item.purchase_strategy" class="border-2 rounded-2xl p-4 shadow-sm mb-4" :class="{
                        'border-success bg-success/10': ['BUY_NOW', 'CHASE_AUCTION'].includes(item.purchase_strategy.verdict),
                        'border-error bg-error/10': item.purchase_strategy.verdict === 'PASS',
                        'border-warning bg-warning/10': ['WATCH', 'NEGOTIATE'].includes(item.purchase_strategy.verdict),
                        'border-primary bg-primary/10': !['PASS', 'WATCH', 'BUY_NOW', 'NEGOTIATE', 'CHASE_AUCTION'].includes(item.purchase_strategy.verdict)
                    }">
                        <!-- Verdict Header -->
                        <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
                            <div class="flex items-center gap-2">
                                <Icon icon="solar:magic-stick-linear" class="text-2xl" v-if="['BUY_NOW', 'CHASE_AUCTION'].includes(item.purchase_strategy.verdict)" />
                                <Icon icon="solar:stop-circle-linear" class="text-2xl" v-if="item.purchase_strategy.verdict === 'PASS'" />
                                <Icon icon="solar:eye-linear" class="text-2xl" v-if="['WATCH', 'NEGOTIATE'].includes(item.purchase_strategy.verdict)" />
                                <h3 class="font-black text-lg uppercase tracking-wider" :class="{
                                    'text-success': ['BUY_NOW', 'CHASE_AUCTION'].includes(item.purchase_strategy.verdict),
                                    'text-error': item.purchase_strategy.verdict === 'PASS',
                                    'text-warning': ['WATCH', 'NEGOTIATE'].includes(item.purchase_strategy.verdict)
                                }">{{ item.purchase_strategy.verdict.replace('_', ' ') }}</h3>
                            </div>
                            
                            <div 
                                v-if="item.purchase_strategy.current_asking_price && !String(item.purchase_strategy.current_asking_price).includes('No Asking Price')" 
                                class="px-2.5 py-1 rounded-lg bg-base-300/80 border border-base-content/10 text-xs font-semibold text-base-content flex items-center gap-1.5"
                            >
                                <span class="text-base-content/70 font-extrabold uppercase text-[10px] tracking-wider shrink-0">Asking / Bid:</span>
                                <span class="text-base-content font-bold text-xs">{{ item.purchase_strategy.current_asking_price }}</span>
                            </div>
                        </div>

                        <!-- Max Landed & Max Bid for Auctions (Directly within Pass / No Pass!) -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 my-3">
                            <!-- Max Landed Cost -->
                            <div class="bg-base-100 p-3 rounded-xl flex justify-between items-center shadow-xs border border-base-300">
                                <div class="flex flex-col text-left">
                                    <span class="text-[10px] uppercase font-black tracking-wider opacity-70">Max Landed Cost (All-in)</span>
                                    <span class="text-[10px] opacity-60 font-medium">Incl. shipping &amp; fees</span>
                                </div>
                                <span class="font-mono font-black text-success text-xl">${{ calculateMaxBuy(item) }}</span>
                            </div>

                            <!-- Max Bid (Auction) -->
                            <div class="bg-base-100 p-3 rounded-xl flex justify-between items-center shadow-xs border border-base-300">
                                <div class="flex flex-col text-left">
                                    <span class="text-[10px] uppercase font-black tracking-wider text-primary">Suggested Max Bid</span>
                                    <span class="text-[10px] opacity-60 font-medium">Site bid limit (excl. shipping)</span>
                                </div>
                                <span class="font-mono font-black text-xl" :class="calculateMaxBid(item) > 0 ? 'text-primary' : 'text-error'">
                                    ${{ calculateMaxBid(item) }}
                                </span>
                            </div>
                        </div>

                        <p class="text-sm font-medium leading-relaxed opacity-90 mt-1">{{ item.purchase_strategy.advice }}</p>

                        <!-- Why Pay Up (Collector Catalyst) -->
                        <div v-if="item.why_pay_up" class="mt-3 p-3 rounded-lg bg-success/15 border border-success/30 text-xs">
                            <div class="font-bold text-success flex items-center gap-1 mb-0.5 uppercase text-[10px] tracking-wider">
                                <Icon icon="solar:fire-bold" class="w-3.5 h-3.5" /> Sourcing Catalyst (Why Pay Up):
                            </div>
                            <p class="text-base-content leading-relaxed font-medium">{{ item.why_pay_up }}</p>
                        </div>

                        <!-- Why Pass (Risk & Fee Warnings) -->
                        <div v-if="item.why_pass" class="mt-3 p-3 rounded-lg bg-error/15 border border-error/30 text-xs">
                            <div class="font-bold text-error flex items-center gap-1 mb-0.5 uppercase text-[10px] tracking-wider">
                                <Icon icon="solar:danger-triangle-bold" class="w-3.5 h-3.5" /> Risk Rationale (Why Pass):
                            </div>
                            <p class="text-base-content leading-relaxed font-medium">{{ item.why_pass }}</p>
                        </div>
                    </div>

                    <!-- Fallback: Max Landed & Max Bid if purchase_strategy is absent -->
                    <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
                        <div class="bg-base-200 p-3 rounded-xl flex justify-between items-center shadow-xs border border-base-300">
                            <div class="flex flex-col text-left">
                                <span class="text-[10px] uppercase font-black tracking-wider opacity-70">Max Landed Cost (All-in)</span>
                                <span class="text-[10px] opacity-60 font-medium">Incl. shipping &amp; fees</span>
                            </div>
                            <span class="font-mono font-black text-success text-xl">${{ calculateMaxBuy(item) }}</span>
                        </div>
                        <div class="bg-base-200 p-3 rounded-xl flex justify-between items-center shadow-xs border border-base-300">
                            <div class="flex flex-col text-left">
                                <span class="text-[10px] uppercase font-black tracking-wider text-primary">Suggested Max Bid</span>
                                <span class="text-[10px] opacity-60 font-medium">Auction site limit</span>
                            </div>
                            <span class="font-mono font-black text-xl" :class="calculateMaxBid(item) > 0 ? 'text-primary' : 'text-error'">
                                ${{ calculateMaxBid(item) }}
                            </span>
                        </div>
                    </div>

                    <!-- 5. Pricing Potential Estimates Grid (Interactive 1-Tap Selectors) -->
                    <div class="space-y-2 mb-3">
                        <div class="flex items-center justify-between px-1">
                            <span class="text-xs font-bold uppercase tracking-wider opacity-75 flex items-center gap-1.5">
                                <Icon icon="solar:graph-up-linear" class="w-4 h-4 text-primary" />
                                Pricing Estimates
                            </span>
                            <span class="text-[10px] opacity-60 font-semibold">Tap to select target price</span>
                        </div>

                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                            <!-- Fair Market -->
                            <button type="button" 
                                    @click="selectPricePreset(item, item.pricing_potential?.fair || item.price_breakdown?.fair)"
                                    class="p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer shadow-xs hover:border-primary"
                                    :class="isPriceSelected(item, item.pricing_potential?.fair || item.price_breakdown?.fair) ? 'border-primary bg-primary/15 ring-2 ring-primary/30' : 'border-base-300 bg-base-200/80'">
                                <span class="badge badge-primary badge-xs font-bold mb-1">FAIR MARKET</span>
                                <span class="font-mono font-extrabold text-sm md:text-base text-primary">{{ formatPriceDisplay(item.pricing_potential?.fair || item.price_breakdown?.fair) }}</span>
                                <span class="text-[9px] opacity-60 font-medium mt-0.5">Online Comps</span>
                            </button>
                            <!-- Boutique Retail -->
                            <button type="button" 
                                    @click="selectPricePreset(item, item.pricing_potential?.boutique || item.price_breakdown?.boutique_premium)"
                                    class="p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer shadow-xs hover:border-secondary"
                                    :class="isPriceSelected(item, item.pricing_potential?.boutique || item.price_breakdown?.boutique_premium) ? 'border-secondary bg-secondary/15 ring-2 ring-secondary/30' : 'border-base-300 bg-base-200/80'">
                                <span class="badge badge-secondary badge-xs font-bold mb-1">BOUTIQUE</span>
                                <span class="font-mono font-extrabold text-sm md:text-base text-secondary">{{ formatBoutiquePriceDisplay(item) }}</span>
                                <span class="text-[9px] opacity-60 font-medium mt-0.5">Booth Retail</span>
                            </button>
                            <!-- Mint -->
                            <button type="button" 
                                    @click="selectPricePreset(item, item.price_breakdown?.mint)"
                                    class="p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer shadow-xs hover:border-success"
                                    :class="isPriceSelected(item, item.price_breakdown?.mint) ? 'border-success bg-success/15 ring-2 ring-success/30' : 'border-base-300 bg-base-200/60'">
                                <span class="badge badge-success badge-xs font-bold mb-1">MINT / NEW</span>
                                <span class="font-mono font-bold text-xs md:text-sm text-base-content">{{ formatPriceDisplay(item.price_breakdown?.mint) }}</span>
                                <span class="text-[9px] opacity-50 font-medium mt-0.5">Pristine</span>
                            </button>
                            <!-- Poor -->
                            <button type="button" 
                                    @click="selectPricePreset(item, item.price_breakdown?.poor)"
                                    class="p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer shadow-xs hover:border-warning"
                                    :class="isPriceSelected(item, item.price_breakdown?.poor) ? 'border-warning bg-warning/15 ring-2 ring-warning/30' : 'border-base-300 bg-base-200/60'">
                                <span class="badge badge-warning badge-xs font-bold mb-1">POOR / AS-IS</span>
                                <span class="font-mono font-bold text-xs md:text-sm text-base-content/80">{{ formatPriceDisplay(item.price_breakdown?.poor) }}</span>
                                <span class="text-[9px] opacity-50 font-medium mt-0.5">Damaged</span>
                            </button>
                        </div>
                    </div>

                    <!-- 6. Cost Basis ($) & Target Resale Price Inputs -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
                        <!-- Cost Basis Input -->
                        <div class="form-control bg-base-200/80 p-2.5 rounded-xl border border-base-300">
                            <label class="label pt-0 pb-1">
                                <span class="label-text font-black text-xs opacity-75 flex items-center gap-1.5">
                                    <Icon icon="solar:wallet-money-bold" class="w-4 h-4 text-warning" />
                                    Cost Basis ($)
                                </span>
                            </label>
                            <div class="join w-full shadow-xs">
                                <span class="join-item btn btn-xs no-animation bg-base-100 border-base-300 font-bold">$</span>
                                <input v-model="cost" type="number" step="0.01" class="input input-xs input-bordered join-item w-full font-mono font-bold text-sm" placeholder="0.00" />
                            </div>
                        </div>

                        <!-- Target Resale Price Input -->
                        <div class="form-control bg-base-200/80 p-2.5 rounded-xl border border-base-300">
                            <label class="label pt-0 pb-1">
                                <span class="label-text font-black text-xs opacity-75 flex items-center gap-1.5">
                                    <Icon icon="solar:tag-bold" class="w-4 h-4 text-success" />
                                    Target Resale ($)
                                </span>
                            </label>
                            <div class="join w-full shadow-xs">
                                <span class="join-item btn btn-xs no-animation bg-base-100 border-base-300 font-bold">$</span>
                                <input v-model.number="item.selected_resale_price" type="number" class="input input-xs input-bordered join-item w-full font-mono font-bold text-sm" placeholder="0" />
                            </div>
                        </div>
                    </div>

                    <!-- 7. Source Link URL Input -->
                    <div class="form-control bg-base-200/80 p-2.5 rounded-xl border border-base-300 mb-3">
                        <label class="label pt-0 pb-1 flex justify-between items-center">
                            <span class="label-text font-black text-xs opacity-75 flex items-center gap-1.5">
                                <Icon icon="solar:link-bold" class="w-4 h-4 text-primary" />
                                Source Link
                            </span>
                            <a v-if="sourcingLocation && sourcingLocation.startsWith('http')" :href="sourcingLocation" target="_blank" class="text-[10px] text-primary font-bold link hover:underline flex items-center gap-0.5">
                                <span>Open</span>
                                <Icon icon="solar:square-top-down-linear" class="w-3 h-3" />
                            </a>
                        </label>
                        <input v-model="sourcingLocation" type="text" class="input input-xs input-bordered w-full font-mono text-xs" placeholder="e.g. https://... or Goodwill" />
                    </div>

                    <!-- 8. Shipping Info Breakdown -->
                    <div v-if="item.shipping_info" class="mb-4 bg-base-200 border border-base-300 rounded-xl p-4 shadow-inner flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                                    <div class="flex items-start gap-2">
                                        <span class="badge badge-sm badge-neutral font-mono font-bold shrink-0 mt-0.5">{{ subIdx + 1 }}</span>
                                        <span class="text-base-content font-bold leading-snug text-left">{{ subItem.name || subItem.title || subItem.identity || subItem.item }}</span>
                                    </div>
                                    <span class="badge badge-outline badge-primary badge-xs whitespace-nowrap px-1.5 py-1 shrink-0">{{ subItem.condition }}</span>
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

                    <div class="mt-4">
                        <label class="label pt-0"><span class="label-text font-bold opacity-70">Keywords</span></label>
                        <div class="border border-base-300 rounded-lg p-2 bg-base-100 flex flex-wrap gap-2 items-center">
                            <span v-for="(kw, idx) in item.keywords" :key="idx" class="badge badge-secondary gap-1">
                                {{ kw }}
                                <button @click="item.keywords.splice(idx, 1)" class="hover:text-error hover:font-bold">✕</button>
                            </span>
                            <input type="text" placeholder="Add..." class="input input-xs grow border-none focus:outline-none min-w-20" @keydown.enter.prevent="addKeyword(item, $event)" />
                        </div>
                    </div>

                </div>
            </div>
                </div>
            </div>
        </div>

        <!-- Modal Bottom Footer (flex-none, pinned cleanly at bottom, scrollbar stops above it) -->
        <div class="flex-none border-t border-base-300 bg-base-200/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.15)] pb-safe z-30">
            <div class="max-w-2xl mx-auto px-3 pt-2 pb-1 transition-all duration-300">
                
                <!-- State C: Active Buy Tracker Status Strip (Matches Screenshot 4) -->
                <div v-if="activePurchase" class="pb-2 mb-1.5 border-b border-base-content/10">
                    <button 
                        type="button" 
                        @click="toggleTray()" 
                        class="btn btn-ghost btn-xs h-7 px-2.5 flex items-center gap-1.5 sm:gap-2 rounded-xl bg-base-300/80 hover:bg-base-300 text-left min-w-0 w-full overflow-hidden"
                        title="View manifest details"
                    >
                        <Icon icon="lucide:truck" class="w-4 h-4 text-primary shrink-0" />
                        <span class="font-black text-xs text-base-content truncate max-w-[110px] sm:max-w-[200px]">
                            {{ activePurchase.vendor || 'Buy Tracker' }}
                        </span>
                        <span class="badge badge-xs badge-warning font-black shrink-0">
                            {{ purchaseItems.length }} {{ purchaseItems.length === 1 ? 'item' : 'items' }}
                            <span v-if="lotItems.length > 0" class="hidden sm:inline">({{ lotItems.length }} lots)</span>
                        </span>
                        <span class="text-[11px] font-mono text-warning font-black shrink-0">
                            ${{ totalCost.toFixed(2) }}
                        </span>
                        <span class="text-xs opacity-40 hidden sm:inline">→</span>
                        <span class="text-[11px] font-mono text-success font-black shrink-0 hidden sm:inline">
                            ${{ totalBoutiqueValue.toFixed(2) }}
                        </span>
                        <span class="text-[10px] uppercase font-bold opacity-60 ml-auto hidden sm:inline">Manifest</span>
                        <Icon :icon="isTrayOpen ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-up-linear'" class="w-3.5 h-3.5 opacity-60 shrink-0 ml-auto" />
                    </button>
                </div>

                <!-- State B: Paused Buy Tracker Status Strip -->
                <div v-else-if="draftPurchases.length > 0 && pausedTracker" class="pb-1.5 mb-1.5 border-b border-base-content/10">
                    <button 
                        type="button" 
                        @click="toggleTray()" 
                        class="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 rounded-xl bg-base-300/60 hover:bg-base-300/80 border border-base-300 cursor-pointer select-none transition-all group text-left min-w-0 w-full h-7 overflow-hidden"
                        title="Inspect paused tracker manifest"
                    >
                        <Icon icon="solar:pause-circle-bold" class="w-3.5 h-3.5 text-warning shrink-0" />
                        <span class="badge badge-xs badge-warning badge-outline font-bold shrink-0">Paused</span>
                        <span class="font-bold text-xs text-base-content truncate max-w-[110px] sm:max-w-[200px]">
                            {{ pausedTracker.vendor || 'Buy Tracker' }}
                        </span>
                        <span class="text-[11px] font-mono opacity-60 shrink-0">
                            {{ pausedTracker.itemCount || 0 }} items
                        </span>
                        <span v-if="pausedTracker.subtotal" class="text-[11px] font-mono text-warning font-bold shrink-0 hidden sm:inline">
                            ${{ pausedTracker.subtotal.toFixed(2) }}
                        </span>
                        <span class="text-[10px] uppercase font-bold opacity-60 ml-auto hidden sm:inline">Manifest</span>
                        <Icon :icon="isTrayOpen ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-up-linear'" class="w-3.5 h-3.5 opacity-60 shrink-0 ml-auto" />
                    </button>
                </div>

                <!-- 3 Action Buttons Row (Matches Screenshot 4) -->
                <div class="flex items-center gap-2 sm:gap-3 h-14 sm:h-16">
                    <!-- 1. New Scout Button -->
                    <button type="button" @click="startNewScan" 
                            class="btn btn-ghost w-24 sm:w-28 h-full flex flex-col items-center justify-center gap-1 rounded-2xl bg-base-300/80 hover:bg-base-300 text-base-content border border-base-content/20 shadow-xs active:scale-95 transition-all"
                            title="Clear and start new scout">
                        <Icon icon="solar:restart-bold" class="w-5 h-5 opacity-80" />
                        <span class="font-extrabold tracking-wider uppercase text-[10px]">New Scout</span>
                    </button>

                    <!-- 2. Identify Item (Re-scout) Button -->
                    <button type="button" @click="handleAnalyze" 
                            class="btn flex-1 h-full flex flex-col items-center justify-center gap-0.5 rounded-2xl shadow-md transition-all active:scale-95 btn-primary text-primary-content font-black shadow-lg border border-primary-content/25"
                            :disabled="loading">
                        <span v-if="loading" class="loading loading-spinner loading-md"></span>
                        <template v-else>
                            <Icon icon="solar:magic-stick-3-bold-duotone" class="w-5 h-5 drop-shadow-md" />
                            <span class="text-xs font-black uppercase tracking-wider">Identify Item</span>
                        </template>
                    </button>

                    <!-- 3. Add Button (Saves to active tracker directly or prompts destination tray) -->
                    <button type="button" @click="handleAddButtonClick" 
                            class="btn flex-1 h-full flex flex-col items-center justify-center gap-1 rounded-2xl transition-all shadow-md active:scale-95 btn-success text-success-content font-black"
                            :disabled="savingAll || !canSaveReport">
                        <span v-if="savingAll" class="loading loading-spinner loading-sm"></span>
                        <template v-else>
                            <Icon icon="lucide:truck" class="w-5 h-5" />
                            <span class="font-extrabold tracking-wider uppercase text-[10px]">
                                + Add {{ itemsInResult.length > 1 ? `All (${itemsInResult.length})` : 'Item' }}
                            </span>
                        </template>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <ScannerWidget 
        ref="scannerWidget" 
        :photos="images" 
        :max-photos="5"
        :hide-all-triggers="true"
        @photos-captured="handleCapturedPhotos"
        @remove-photo="removeImage"
    />

    <!-- ASSIGN TRACKER MODAL (Shown when untethered user adds item) -->
    <ScoutAssignTrackerModal
        :is-open="isAssignModalOpen"
        :draft-purchases="draftPurchases"
        :creating="creatingTracker"
        @close="isAssignModalOpen = false"
        @select-tracker="handleSelectTracker"
        @create-tracker="handleCreateTracker"
        @save-standalone="handleSaveStandalone"
    />

    <!-- BOTTOM DOCK NAV (Unified Tactile Dock Pattern for Intake Cockpit) -->
    <div v-if="!isResultsModalOpen" class="fixed bottom-0 left-0 right-0 w-full z-40 bg-base-200/95 backdrop-blur-md border-t border-base-300 shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.3)] pb-safe">
        <div class="max-w-2xl mx-auto px-3 pt-2 pb-1 transition-all duration-300">
            
            <!-- State C: Active Buy Tracker Status Strip (Integrated into dock, ONLY shown when activePurchase is present) -->
            <div v-if="activePurchase" class="pb-2 mb-1.5 border-b border-base-content/10">
                <button 
                    type="button" 
                    @click="toggleTray()" 
                    class="btn btn-ghost btn-xs h-7 px-2.5 flex items-center gap-1.5 sm:gap-2 rounded-xl bg-base-300/80 hover:bg-base-300 text-left min-w-0 w-full overflow-hidden"
                    title="View manifest details"
                >
                    <Icon icon="lucide:truck" class="w-4 h-4 text-primary shrink-0" />
                    <span class="font-black text-xs text-base-content truncate max-w-[110px] sm:max-w-[200px]">
                        {{ activePurchase.vendor || 'Buy Tracker' }}
                    </span>
                    <span class="badge badge-xs badge-warning font-black shrink-0">
                        {{ purchaseItems.length }} {{ purchaseItems.length === 1 ? 'item' : 'items' }}
                        <span v-if="lotItems.length > 0" class="hidden sm:inline">({{ lotItems.length }} lots)</span>
                    </span>
                    <span class="text-[11px] font-mono text-warning font-black shrink-0">
                        ${{ totalCost.toFixed(2) }}
                    </span>
                    <span class="text-xs opacity-40 hidden sm:inline">→</span>
                    <span class="text-[11px] font-mono text-success font-black shrink-0 hidden sm:inline">
                        ${{ totalBoutiqueValue.toFixed(2) }}
                    </span>
                    <span class="text-[10px] uppercase font-bold opacity-60 ml-auto hidden sm:inline">Manifest</span>
                    <Icon :icon="isTrayOpen ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-up-linear'" class="w-3.5 h-3.5 opacity-60 shrink-0 ml-auto" />
                </button>
            </div>

            <!-- State B: Paused Buy Tracker Status Strip -->
            <div v-else-if="draftPurchases.length > 0 && pausedTracker" class="pb-1.5 mb-1.5 border-b border-base-content/10">
                <button 
                    type="button" 
                    @click="toggleTray()" 
                    class="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 rounded-xl bg-base-300/60 hover:bg-base-300/80 border border-base-300 cursor-pointer select-none transition-all group text-left min-w-0 w-full h-7 overflow-hidden"
                    title="Inspect paused tracker manifest"
                >
                    <Icon icon="solar:pause-circle-bold" class="w-3.5 h-3.5 text-warning shrink-0" />
                    <span class="badge badge-xs badge-warning badge-outline font-bold shrink-0">Paused</span>
                    <span class="font-bold text-xs text-base-content truncate max-w-[110px] sm:max-w-[200px]">
                        {{ pausedTracker.vendor || 'Buy Tracker' }}
                    </span>
                    <span class="text-[11px] font-mono opacity-60 shrink-0">
                        {{ pausedTracker.itemCount || 0 }} items
                    </span>
                    <span v-if="pausedTracker.subtotal" class="text-[11px] font-mono text-warning font-bold shrink-0 hidden sm:inline">
                        ${{ pausedTracker.subtotal.toFixed(2) }}
                    </span>
                    <span class="text-[10px] uppercase font-bold opacity-60 ml-auto hidden sm:inline">Manifest</span>
                    <Icon :icon="isTrayOpen ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-up-linear'" class="w-3.5 h-3.5 opacity-60 shrink-0 ml-auto" />
                </button>
            </div>

            <!-- Tactile Actions Row (Matches Screenshot 3) -->
            <div class="flex items-center gap-2 sm:gap-3 h-14 sm:h-16">
                <!-- 1. New Scout Button -->
                <button @click="startNewScan" 
                        class="btn btn-ghost w-24 sm:w-28 h-full flex flex-col items-center justify-center gap-1 rounded-2xl bg-base-300/80 hover:bg-base-300 text-base-content border border-base-content/20 shadow-xs active:scale-95 transition-all"
                        title="Start fresh new scout">
                    <Icon icon="solar:restart-bold" class="w-5 h-5 opacity-80" />
                    <span class="font-extrabold tracking-wider uppercase text-[10px]">New Scout</span>
                </button>

                <!-- 2. Primary Hero Action: Identify Item or View Report -->
                <button v-if="result" 
                        @click="isResultsModalOpen = true" 
                        class="btn flex-1 h-full flex flex-col items-center justify-center gap-0.5 rounded-2xl shadow-md transition-all active:scale-95 btn-primary text-primary-content font-black shadow-lg border border-primary-content/25"
                        title="Open current scouting report">
                    <Icon icon="solar:document-text-bold" class="w-5 h-5 drop-shadow-md" />
                    <span class="text-xs font-black uppercase tracking-wider">
                        View Report
                    </span>
                </button>

                <button v-else 
                        @click="handleAnalyze" 
                        class="btn flex-1 h-full flex flex-col items-center justify-center gap-0.5 rounded-2xl shadow-md transition-all active:scale-95"
                        :class="(loading || !canAnalyze)
                                ? 'btn-ghost bg-base-300/40 text-base-content/40 border border-base-content/10 cursor-not-allowed'
                                : 'btn-primary text-primary-content font-black shadow-lg border border-primary-content/25'"
                        :disabled="loading || !canAnalyze">
                    <span v-if="loading" class="loading loading-spinner loading-md"></span>
                    <template v-else>
                        <Icon icon="solar:magic-stick-3-bold-duotone" class="w-5 h-5 drop-shadow-md" />
                        <span class="text-xs font-black uppercase tracking-wider">
                            Identify Item
                        </span>
                    </template>
                </button>

                <!-- 3. Add to Tracker Button -->
                <button 
                    type="button" 
                    @click="result ? handleAddButtonClick() : null" 
                    class="btn w-28 sm:w-36 h-full flex flex-col items-center justify-center gap-1 rounded-2xl transition-all shadow-xs"
                    :class="result && canSaveReport 
                            ? 'btn-success text-success-content font-black shadow-md active:scale-95' 
                            : 'btn-ghost bg-base-300/30 text-base-content/30 border border-base-content/10 cursor-not-allowed'"
                    :disabled="!result || savingAll || !canSaveReport"
                    :title="activePurchase ? `Add to ${activePurchase.vendor || 'Tracker'}` : (pausedTracker ? `Add to ${pausedTracker.vendor || 'Tracker'}` : 'Add to Buy Tracker')"
                >
                    <Icon icon="lucide:truck" class="w-5 h-5" />
                    <span class="font-extrabold tracking-wider uppercase text-[9px] sm:text-[10px] truncate max-w-[110px]">
                        + Add {{ itemsInResult.length > 1 ? `(${itemsInResult.length})` : 'Item' }}
                    </span>
                </button>
            </div>
        </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import { account, storage, databases, ID } from '../../lib/appwrite';
import { Permission, Role } from 'appwrite';
import { useAuth } from '../../composables/useAuth';
import { useCart } from '../../composables/useCart';
import { useScoutPurchase } from '../../composables/useScoutPurchase';
import { useLoader } from '../../composables/useLoader';
import { addToast } from '../../stores/toast';
import { isAlphaMode } from '../../stores/env';
import { getPurchasesCollectionId } from '../../lib/purchases';
import ScannerWidget from '../common/ScannerWidget.vue';
import PhotoGalleryManager from '../common/PhotoGalleryManager.vue';
import ScoutAssignTrackerModal from './ScoutAssignTrackerModal.vue';

interface Props {
    initialPurchaseId?: string | null;
    isQuickScan?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    initialPurchaseId: null,
    isQuickScan: false
});

const emit = defineEmits<{
    (e: 'back-to-list'): void;
    (e: 'purchase-completed', purchaseId: string): void;
}>();

// APPWRITE
const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID; 
const ITEMS_COL = import.meta.env.PUBLIC_APPWRITE_ITEMS_COL; 
const PURCHASES_COL = getPurchasesCollectionId();
import { BUCKET_ID, getCollectionId, generateAutoUpc } from '../../lib/inventory';

// -- COMPOSABLES --
const { isAuthenticated, currentTeam, user, updatePrefs } = useAuth();
const { 
    activeCart, addItemToCart, startCart, checkActiveCart, cartItems
} = useCart();
const {
    activePurchase,
    purchaseItems,
    singleItems,
    lotItems,
    totalCost,
    totalBoutiqueValue,
    projectedProfit,
    roiMultiple,
    profitMargin,
    tierBreakdown,
    draftPurchases,
    pausedTracker,
    isTrayOpen,
    toggleTray,
    loadDraftPurchases,
    fetchPurchaseItems,
    addItemToPurchase,
    addLotToPurchase,
    removeItemFromPurchase,
    completePurchase,
    setActivePurchase,
    pauseTracker,
    resumeTracker,
    startDraftPurchase,
    loadPurchaseById
} = useScoutPurchase();

watch(() => props.initialPurchaseId, async (newId) => {
    if (newId && (!activePurchase.value || activePurchase.value.$id !== newId)) {
        await loadPurchaseById(newId).catch(err => {
            console.warn('[ScoutView] Failed to load purchase from initialPurchaseId prop:', err);
        });
    } else if (!newId) {
        setActivePurchase(null);
    }
}, { immediate: true });

// Tracker Assignment Modal State
const isAssignModalOpen = ref(false);
const creatingTracker = ref(false);
const allowStandaloneSave = ref(false);
const pendingSaveItem = ref<{ item: any; index: number; isBatch: boolean } | null>(null);
const pendingSaveAll = ref(false);

const handlePauseTracker = () => {
    const vendorName = activePurchase.value?.vendor || 'Buy Tracker';
    pauseTracker();
    addToast({ type: 'warning', message: `⏸️ Paused ${vendorName}` });
};

const handleResumeTracker = async (purchase?: any) => {
    const target = await resumeTracker(purchase);
    if (target) {
        addToast({ type: 'success', message: `▶️ Resumed ${target.vendor || 'Buy Tracker'}` });
    }
};

const handleAddButtonClick = () => {
    if (activePurchase.value) {
        // Active tracker is running: immediate 1-tap fast add directly to tracker
        saveAllItems();
    } else {
        // Paused or untethered: slide up destination bottom sheet (Option A)
        promptSaveDestination();
    }
};

const promptSaveDestination = (item?: any, index?: number) => {
    if (typeof index === 'number' && item) {
        pendingSaveItem.value = { item, index, isBatch: false };
        pendingSaveAll.value = false;
    } else {
        pendingSaveAll.value = true;
        pendingSaveItem.value = null;
    }
    loadDraftPurchases();
    isAssignModalOpen.value = true;
};

const handleAddHereToPausedTracker = async () => {
    if (!pausedTracker.value) return;
    const target = pausedTracker.value;
    setActivePurchase(target);
    try {
        window.history.replaceState({}, '', `${window.location.pathname}?purchase=${target.$id}`);
    } catch (e) {}
    addToast({ type: 'success', message: `Resumed tracker: ${target.vendor || 'Buy Tracker'}` });

    if (pendingSaveItem.value || pendingSaveAll.value) {
        await executePendingSave();
    } else if (result.value && result.value.items && result.value.items.length > 0) {
        await saveAllItems();
    }
};

const handleResumeFromTray = (purchase: any) => {
    setActivePurchase(purchase);
    isTrayOpen.value = false;
    try {
        window.history.replaceState({}, '', `${window.location.pathname}?purchase=${purchase.$id}`);
    } catch (e) {}
};

const navigateToPurchase = () => {
    if (!activePurchase.value) return;
    const pId = activePurchase.value.$id;
    addToast({ type: 'info', message: '📋 Opening Draft Purchase Order...' });
    window.location.href = `/purchases/${pId}`;
};

const handleSelectTracker = async (purchase: any) => {
    setActivePurchase(purchase);
    isAssignModalOpen.value = false;
    addToast({ type: 'info', message: `Attached to ${purchase.vendor || 'tracker'}!` });
    await executePendingSave();
    if (activePurchase.value?.$id) {
        await fetchPurchaseItems(activePurchase.value.$id);
        await loadDraftPurchases();
    }
};

const handleCreateTracker = async (vendorName: string) => {
    creatingTracker.value = true;
    try {
        const newPurchase = await startDraftPurchase(vendorName);
        setActivePurchase(newPurchase);
        isAssignModalOpen.value = false;
        addToast({ type: 'success', message: `Created tracker for ${vendorName}!` });
        await executePendingSave();
        if (activePurchase.value?.$id) {
            await fetchPurchaseItems(activePurchase.value.$id);
            await loadDraftPurchases();
        }
    } catch (e: any) {
        addToast({ type: 'error', message: 'Failed to create tracker: ' + e.message });
    } finally {
        creatingTracker.value = false;
    }
};

const handleSaveStandalone = async () => {
    isAssignModalOpen.value = false;
    allowStandaloneSave.value = true;
    try {
        await executePendingSave();
    } finally {
        allowStandaloneSave.value = false;
    }
};

const executePendingSave = async () => {
    if (pendingSaveAll.value) {
        pendingSaveAll.value = false;
        await saveAllItems();
    } else if (pendingSaveItem.value) {
        const { item, index, isBatch } = pendingSaveItem.value;
        pendingSaveItem.value = null;
        await handleSaveItem(item, index, isBatch);
    }
};

const onPurchaseCompleted = (purchaseId: string) => {
    emit('purchase-completed', purchaseId);
};

const { showLoader, hideLoader } = useLoader();

// -- LIFECYCLE --
const onWindowPaste = async (e: ClipboardEvent) => {
    const activeEl = document.activeElement;
    const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';

    const items = e.clipboardData?.items;
    if (!items) return;

    // 1. Check for image first (e.g. screenshot or copied photo)
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            if (blob) {
                e.preventDefault();
                await processFile(blob);
                addToast({ type: 'success', message: '📸 Image/Screenshot attached from clipboard!' });
                return;
            }
        }
    }

    // 2. If not already typing in an input, detect whether clipboard text is a URL or body of details text
    if (!isInput) {
        const text = e.clipboardData?.getData('text')?.trim();
        if (text) {
            if (text.startsWith('http://') || text.startsWith('https://')) {
                e.preventDefault();
                scoutUrl.value = text;
                addToast({ type: 'success', message: '🔗 Web Link pasted into Scout URL!' });
            } else if (text.length > 0) {
                e.preventDefault();
                if (userNotes.value && !userNotes.value.includes(text)) {
                    userNotes.value += `\n${text}`;
                } else {
                    userNotes.value = text;
                }
                addToast({ type: 'success', message: '📝 Text detected & pasted into Additional Details!' });
            }
        }
    }
};

onMounted(async () => {
    window.addEventListener('paste', onWindowPaste);

    // Check for Purchase from props or URL
    const urlParams = new URLSearchParams(window.location.search);
    const targetPurchaseId = props.initialPurchaseId || urlParams.get('purchase');
    if (targetPurchaseId && databases) {
        try {
            const pDoc = await databases.getDocument(DB_ID, PURCHASES_COL, targetPurchaseId);
            setActivePurchase(pDoc as any);
        } catch (pErr) {
            console.warn('[ScoutView] Failed to load target purchase:', targetPurchaseId, pErr);
        }
    }

    // Check for Re-Scout
    rescoutId.value = urlParams.get('rescout');
    
    if (rescoutId.value && databases) {
        console.log('[ScoutView] Re-scouting item:', rescoutId.value);
        analyzing.value = true;
        try {
            const itemDoc = await databases.getDocument(DB_ID, ITEMS_COL, rescoutId.value);
            
            // Pre-fill inputs from existing document
            if (itemDoc.cost !== undefined && itemDoc.cost !== null) cost.value = String(itemDoc.cost);
            if (itemDoc.sourcingLocation) sourcingLocation.value = itemDoc.sourcingLocation;
            if (itemDoc.storageLocation) storageLocation.value = itemDoc.storageLocation;
            if (itemDoc.status === 'acquired') isAcquired.value = true;

            // Pre-fill existing images in the preview if present
            if (itemDoc.galleryImageIds && itemDoc.galleryImageIds.length > 0) {
                images.value = itemDoc.galleryImageIds.map(id => {
                    const url = id.startsWith('http') ? id : `${import.meta.env.PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${id}/view?project=${import.meta.env.PUBLIC_APPWRITE_PROJECT_ID}`;
                    return { url };
                });
            } else if (itemDoc.imageId) {
                const id = itemDoc.imageId;
                const url = id.startsWith('http') ? id : `${import.meta.env.PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${id}/view?project=${import.meta.env.PUBLIC_APPWRITE_PROJECT_ID}`;
                images.value = [{ url }];
            }

            if (itemDoc.rawAnalysis) {
                const analysis = JSON.parse(itemDoc.rawAnalysis);
                // Hydrate the view
                result.value = { items: [analysis] };
                isResultsModalOpen.value = true;
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

onUnmounted(() => {
    window.removeEventListener('paste', onWindowPaste);
});

function getTierBadgeInfo(item: any) {
    if (!item) return null;
    const t = item.tier?.toLowerCase() || '';
    const raw = (item.name || item.identity || item.title || '').toLowerCase();
    
    if (t === 'showcase' || raw.includes('tier 1') || item.is_key_issue) {
        return { label: '🌟 Showcase', class: 'badge-secondary text-secondary-content font-bold' };
    }
    if (t === 'quick_turn' || raw.includes('tier 3')) {
        return { label: '⚡ Quick Turn', class: 'badge-accent text-accent-content font-bold' };
    }
    if (t === 'core' || raw.includes('tier 2')) {
        return { label: '📦 Core', class: 'badge-primary text-primary-content font-bold' };
    }
    return null;
}

function cleanDisplayTitle(item: any) {
    if (!item) return 'Unidentified Item';
    const text = item.identity || item.title || item.name || 'Unidentified Item';
    return text.replace(/\[Tier \d[^\]]*\]\s*/i, '').trim();
}

function selectPricePreset(item: any, priceStr: any) {
    if (!item || !priceStr) return;
    const parsed = parsePrice(priceStr);
    if (parsed > 0) {
        item.selected_resale_price = Math.round(parsed);
        addToast({ type: 'info', message: `Resale price set to $${item.selected_resale_price}` });
    }
}

function isPriceSelected(item: any, priceStr: any) {
    if (!item || !priceStr) return false;
    const parsed = parsePrice(priceStr);
    return item.selected_resale_price === Math.round(parsed);
}

// -- STATE --
const rescoutId = ref<string | null>(null);
const successMessage = ref<string | null>(null);
const error = ref<string | null>(null);
const loading = ref(false);
const analyzing = ref(false); // Added for re-scout feature
const isResultsModalOpen = ref(false);
const isMediaDetailsExpanded = ref(false);
const result = ref<any>(null);
const cost = ref('');
const isAcquired = ref(false);
const sourcingLocation = ref('');
const storageLocation = ref('');
const zipCode = ref('');
const includeShippingInCost = ref(false);
const images = ref<{ url: string; file?: File }[]>([]);
const mainPhotoSelection = ref<{ type: 'existing' | 'new' | 'none'; val: any }>({ type: 'none', val: null });
const receiptFile = ref<File | null>(null);
const userNotes = ref('');
const dragOver = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const receiptInput = ref<HTMLInputElement | null>(null);
const scoutUrl = ref('');
const scannerWidget = ref<any>(null);

const getItemDisplayImage = (item: any) => {
    if (mainPhotoSelection.value.type === 'new' && typeof mainPhotoSelection.value.val === 'number' && images.value[mainPhotoSelection.value.val]) {
        const sel = images.value[mainPhotoSelection.value.val];
        return typeof sel === 'string' ? sel : sel.url;
    }
    if (mainPhotoSelection.value.type === 'existing' && mainPhotoSelection.value.val) {
        return mainPhotoSelection.value.val;
    }
    if (item?.fetched_image) return item.fetched_image;
    if (item?.fetched_images && item.fetched_images.length > 0) return item.fetched_images[0];
    if (images.value && images.value.length > 0) {
        const first = images.value[0];
        return typeof first === 'string' ? first : first.url;
    }
    return null;
};

const itemGalleryImages = computed<string[]>({
    get() {
        const item = result.value?.items?.[0] || result.value;
        if (!item) return [];
        const urls: string[] = [];
        const newPhotoUrls = images.value.map(i => typeof i === 'string' ? i : i.url);

        const addUrl = (u: string) => {
            if (u && typeof u === 'string' && !urls.includes(u) && !newPhotoUrls.includes(u)) {
                urls.push(u);
            }
        };

        if (item.fetched_image) addUrl(item.fetched_image);
        if (Array.isArray(item.fetched_images)) {
            for (const u of item.fetched_images) addUrl(u);
        }
        if (item.imageId) addUrl(item.imageId);
        if (item.image) addUrl(item.image);
        if (Array.isArray(item.galleryImageIds)) {
            for (const id of item.galleryImageIds) addUrl(id);
        }
        return urls;
    },
    set(newUrls: string[]) {
        const target = result.value?.items?.[0] || result.value;
        if (target) {
            target.fetched_images = newUrls;
            if (newUrls.length > 0 && !newUrls.includes(target.fetched_image)) {
                target.fetched_image = newUrls[0];
            }
        }
    }
});



// Smoothly scroll to top and prevent background scrolling when report is open
watch(isResultsModalOpen, (isOpen) => {
    if (typeof document !== 'undefined') {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            window.scrollTo({ top: 0 });
        } else {
            document.body.style.overflow = '';
        }
    }
});



watch(scoutUrl, (val) => {
    if (val && val.trim().startsWith('http')) {
        sourcingLocation.value = val.trim();
    }
});

const canAnalyze = computed(() => {
    return images.value.length > 0 || !!(scoutUrl.value && scoutUrl.value.trim()) || !!(userNotes.value && userNotes.value.trim());
});

const analyzeButtonText = computed(() => {
    if (scoutUrl.value && scoutUrl.value.trim()) {
        return 'Analyze Link';
    }
    if (images.value.length > 0) {
        return 'Identify Item';
    }
    if (userNotes.value && userNotes.value.trim()) {
        return 'Identify from Notes';
    }
    return 'Identify Item';
});

const handleAnalyze = () => {
    // Check if we have a URL from the input or previously stored in sourcingLocation
    const urlToScout = (scoutUrl.value && scoutUrl.value.trim()) || 
                       (sourcingLocation.value && sourcingLocation.value.trim().startsWith('http') ? sourcingLocation.value.trim() : '');

    if (urlToScout) {
        scoutUrl.value = urlToScout;
        analyzeListing();
    } else if (images.value.length > 0 || (userNotes.value && userNotes.value.trim()) || result.value?.items?.[0]?.fetched_image) {
        analyzeImage();
    } else {
        addToast({ type: 'warning', message: 'Take a photo, paste a web link, or enter item details to scout.' });
    }
};

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
            await updatePrefs(updatedPrefs);
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
async function handleCapturedPhotos(files: File[]) {
    for (const file of files) {
        if (images.value.length >= 5) return;
        await processFile(file);
    }
}

function removeImage(index: number) {
    images.value.splice(index, 1);
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
                     images.value.push({ url: dataUrl, file: file });
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
    const url = scoutUrl.value || (sourcingLocation.value && sourcingLocation.value.trim().startsWith('http') ? sourcingLocation.value.trim() : '');
    const isId = url && url.match(/^\d+$/);
    if (!url || (!url.startsWith('http') && !isId)) {
        addToast({ type: 'warning', message: "Please enter a valid URL or Item ID." });
        return;
    }
    
    loading.value = true;
    error.value = null;
    
    const huckPhrases = [
        "Hold your horses, I'm digging through the archives...",
        "Crunching the numbers on this one...",
        "Let me pull up the market comparables...",
        "Analyzing the data, give me a sec...",
        "Reviewing the evidence..."
    ];
    showLoader(huckPhrases[Math.floor(Math.random() * huckPhrases.length)], {
        basket: 'solar:archive-minimalistic-bold-duotone',
        berries: ['solar:document-bold-duotone', 'solar:chart-square-bold-duotone', 'solar:calculator-bold-duotone', 'solar:folder-with-files-bold-duotone'],
        basketColor: 'text-primary-content',
        berryColor: 'text-primary-content',
        backgroundColor: 'bg-primary/80'
    });
    
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
                const boutique = parsePrice(it.pricing_potential?.boutique || it.price_breakdown?.boutique_premium);
                const fair = parsePrice(it.pricing_potential?.fair || it.price_breakdown?.fair);
                it.selected_resale_price = Math.round(boutique || fair || 0);
            });
            if (data.items.length > 0 && images.value.length > 0) {
                const firstImg = typeof images.value[0] === 'string' ? images.value[0] : images.value[0]?.url;
                if (firstImg && !data.items[0].fetched_image) {
                    data.items[0].fetched_image = firstImg;
                }
                if (!data.items[0].fetched_images || data.items[0].fetched_images.length === 0) {
                    data.items[0].fetched_images = images.value.map(i => typeof i === 'string' ? i : i.url).filter(Boolean);
                }
            }
        }
        result.value = data;
        sourcingLocation.value = targetUrl;
        isResultsModalOpen.value = true;
        
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
        hideLoader();
    }
}



// -- ANALYSIS --
async function analyzeImage() {
    const hasLocalImages = images.value.length > 0;
    const hasRemoteImages = !!(result.value?.items?.[0]?.fetched_image || (result.value?.items?.[0]?.fetched_images && result.value.items[0].fetched_images.length > 0));
    const hasNotes = !!userNotes.value.trim();

    if (!hasLocalImages && !hasRemoteImages && !hasNotes) return;
    loading.value = true;
    error.value = null;
    
    const huckPhrases = [
        "Hold your horses, I'm digging through the archives...",
        "Crunching the numbers on this one...",
        "Let me pull up the market comparables...",
        "Analyzing the visual data, give me a sec...",
        "Reviewing the photographic evidence..."
    ];
    showLoader(huckPhrases[Math.floor(Math.random() * huckPhrases.length)], {
        basket: 'solar:archive-minimalistic-bold-duotone',
        berries: ['solar:document-bold-duotone', 'solar:chart-square-bold-duotone', 'solar:calculator-bold-duotone', 'solar:folder-with-files-bold-duotone'],
        basketColor: 'text-primary-content',
        berryColor: 'text-primary-content',
        backgroundColor: 'bg-primary/80'
    });
    
    try {
        const base64Images: string[] = [];
        const remoteImageUrls: string[] = [];
        
        for (const item of images.value) {
            const url = typeof item === 'string' ? item : item?.url;
            const file = item instanceof File ? item : item?.file;
            if (url && url.startsWith('data:')) {
                base64Images.push(url);
            } else if (url && url.startsWith('http')) {
                remoteImageUrls.push(url);
            } else if (file) {
                const dataUrl = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target?.result as string || '');
                    reader.onerror = () => resolve('');
                    reader.readAsDataURL(file);
                });
                if (dataUrl) base64Images.push(dataUrl);
            } else if (url && url.startsWith('blob:')) {
                try {
                    const blob = await fetch(url).then(r => r.blob());
                    const dataUrl = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target?.result as string || '');
                        reader.onerror = () => resolve('');
                        reader.readAsDataURL(blob);
                    });
                    if (dataUrl) base64Images.push(dataUrl);
                } catch (e) {}
            }
        }

        // On Re-Scout: If local images array is empty but we have fetched images from earlier scan, pass them to Gemini
        if (images.value.length === 0 && result.value?.items?.[0]) {
            const firstItem = result.value.items[0];
            if (firstItem.fetched_image && firstItem.fetched_image.startsWith('http')) {
                remoteImageUrls.push(firstItem.fetched_image);
            } else if (firstItem.fetched_images && Array.isArray(firstItem.fetched_images)) {
                remoteImageUrls.push(...firstItem.fetched_images.filter((u: string) => u && u.startsWith('http')).slice(0, 5));
            }
        }

        const payload = JSON.stringify({ 
            images: base64Images,
            remoteImageUrls,
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
                const boutique = parsePrice(it.pricing_potential?.boutique || it.price_breakdown?.boutique_premium);
                const fair = parsePrice(it.pricing_potential?.fair || it.price_breakdown?.fair);
                it.selected_resale_price = Math.round(boutique || fair || 0);
            });
            // Ensure scouted images are preserved on data.items[0]
            if (data.items.length > 0 && images.value.length > 0) {
                const firstImg = typeof images.value[0] === 'string' ? images.value[0] : images.value[0]?.url;
                if (firstImg && !data.items[0].fetched_image) {
                    data.items[0].fetched_image = firstImg;
                }
                if (!data.items[0].fetched_images || data.items[0].fetched_images.length === 0) {
                    data.items[0].fetched_images = images.value.map(i => typeof i === 'string' ? i : i.url).filter(Boolean);
                }
            }
        }
        result.value = data;
        isResultsModalOpen.value = true;
        
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
        hideLoader();
    }
}

// -- ACTION COMBOS --
function startNewScan() {
    result.value = null;
    isResultsModalOpen.value = false;
    isMediaDetailsExpanded.value = false;
    images.value = [];
    mainPhotoSelection.value = { type: 'none', val: null };
    scoutUrl.value = '';
    userNotes.value = '';
    cost.value = '';
    isAcquired.value = false;
    sourcingLocation.value = '';
    storageLocation.value = '';
    receiptFile.value = null;
    error.value = null;
    successMessage.value = null;
    rescoutId.value = null;
    if (typeof window !== 'undefined') {
        try {
            sessionStorage.removeItem('scout_active_result');
        } catch (e) {}
    }
    if (fileInput.value) fileInput.value.value = '';
    if (receiptInput.value) receiptInput.value.value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    addToast({ type: 'info', message: 'Scout cleared — ready for next item!' });
}

const savingAll = ref(false);

const itemsInResult = computed(() => {
    if (!result.value) return [];
    if (result.value.items && result.value.items.length > 0) return result.value.items;
    return [result.value];
});

const canSaveReport = computed(() => {
    return itemsInResult.value.length > 0 && itemsInResult.value.some((i: any) => !i.saved && !i.saving);
});

async function saveAllItems() {
    if (savingAll.value) return;
    if (!result.value) return;

    if (!activePurchase.value && !allowStandaloneSave.value) {
        pendingSaveAll.value = true;
        pendingSaveItem.value = null;
        loadDraftPurchases();
        isAssignModalOpen.value = true;
        return;
    }

    savingAll.value = true;
    try {
        const toSave = itemsInResult.value;
        let savedAny = false;
        for (let i = 0; i < toSave.length; i++) {
            const item = toSave[i];
            if (!item.saved && !item.saving) {
                 await handleSaveItem(item, i, true);
                 savedAny = true;
            }
        }

        if (savedAny) {
            isResultsModalOpen.value = false;
            let cartItem = null;
            if (rescoutId.value) {
                cartItem = cartItems.value.find(ci => ci.$id === rescoutId.value) || (purchaseItems.value as any[]).find(pi => pi.$id === rescoutId.value);
            } else {
                cartItem = cartItems.value[0] || purchaseItems.value[0] || cartItems.value[cartItems.value.length - 1];
            }
            

            
            startNewScan();
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

function calculateMaxBuy(item: any) {
    if (item?.purchase_strategy?.max_landed_cost) {
        return Math.floor(item.purchase_strategy.max_landed_cost);
    }
    const fair = parsePrice(item?.price_breakdown?.fair);
    return Math.floor(fair * 0.4); // 40% rule placeholder
}

function calculateMaxBid(item: any) {
    if (item?.purchase_strategy?.max_bid) {
        return Math.floor(item.purchase_strategy.max_bid);
    }
    const maxBuy = calculateMaxBuy(item);
    const shippingTotal = item?.shipping_info?.total || 0;
    const maxBid = maxBuy - shippingTotal;
    return maxBid > 0 ? Math.floor(maxBid) : 0;
}

function calculateSubItemMaxBid(subItem: any, parentItem: any) {
    const maxBuy = calculateMaxBuy(subItem);
    const shippingTotal = parentItem?.shipping_info?.total || 0;
    const itemsCount = parentItem?.lot_items?.length || 1;
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

function formatBoutiquePriceDisplay(item: any) {
    if (item?.pricing_potential?.boutique) {
        return formatPriceDisplay(item.pricing_potential.boutique);
    }
    if (item?.price_breakdown?.boutique_premium) {
        return formatPriceDisplay(item.price_breakdown.boutique_premium);
    }
    const mint = parsePrice(item?.price_breakdown?.mint);
    const fair = parsePrice(item?.pricing_potential?.fair || item?.price_breakdown?.fair);
    if (mint > 0) {
        const low = Math.round(mint * 1.15);
        const high = Math.round(mint * 1.4);
        return `$${low} - $${high}`;
    } else if (fair > 0) {
        const low = Math.round(fair * 1.3);
        const high = Math.round(fair * 1.6);
        return `$${low} - $${high}`;
    }
    return '$15 - $25';
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

const getSafeRawAnalysis = (item: any) => {
    try {
        let str = JSON.stringify(item);
        if (str.length <= 4900) return str;
        
        const processItem = (obj: any) => {
            if (!obj) return obj;
            const pruned = { ...obj };
            if (pruned.comparables && pruned.comparables.length > 3) {
                pruned.comparables = pruned.comparables.slice(0, 3);
            }
            if (pruned.lot_items && pruned.lot_items.length > 5) {
                pruned.lot_items = pruned.lot_items.slice(0, 5);
            }
            return pruned;
        };

        let pruned;
        if (Array.isArray(item)) {
            pruned = item.map(processItem);
        } else if (item.items && Array.isArray(item.items)) {
            pruned = { ...item, items: item.items.map(processItem) };
        } else {
            pruned = processItem(item);
        }
        
        str = JSON.stringify(pruned);
        if (str.length <= 4900) return str;

        // Absolute fallback: keep only main fields
        const fallbackObj = (obj: any) => ({
            identity: obj.identity,
            title: obj.title,
            price_breakdown: obj.price_breakdown,
            shipping_info: obj.shipping_info,
            purchase_strategy: obj.purchase_strategy,
            condition_notes: obj.condition_notes,
            keywords: obj.keywords,
            lot_items: obj.lot_items ? obj.lot_items.map((li: any) => ({ identity: li.identity, price_breakdown: li.price_breakdown })) : undefined
        });

        if (Array.isArray(item)) {
            return JSON.stringify(item.map(fallbackObj));
        } else if (item.items && Array.isArray(item.items)) {
            return JSON.stringify({ ...item, items: item.items.map(fallbackObj) });
        } else {
            return JSON.stringify(fallbackObj(item));
        }
    } catch (e) {
        return null;
    }
};

const urlToFile = async (url: string, filename: string): Promise<File | null> => {
    try {
        const res = await fetch('/api/proxy-image?url=' + encodeURIComponent(url));
        if (!res.ok) throw new Error("Image download failed");
        
        const contentType = res.headers.get('content-type') || 'image/jpeg';
        if (contentType.includes('text/html')) {
             throw new Error("The image source returned an HTML page. The server might be blocking direct downloads.");
        }
        
        const blob = await res.blob();
        if (blob.size === 0) throw new Error("The image source returned 0-bytes.");
        
        let finalName = filename;
        if (!finalName.match(/\.(jpg|jpeg|png|webp|gif|avif)$/i)) {
             const ext = contentType.split('/')[1] || 'jpg';
             finalName = `${finalName}.${ext}`;
        }
        
        // Check if this is a ShopGoodwill image to crop the watermark at the bottom
        const isSgw = url.includes('shopgoodwill');
        if (isSgw) {
            console.log('[ImageProcessor] ShopGoodwill image detected. Cropping watermark...', url);
            const img = new Image();
            const objectUrl = URL.createObjectURL(blob);
            
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = reject;
                img.src = objectUrl;
            });
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Crop top ~5% and bottom ~9% of the image height to remove watermarks cleanly
            const cropTop = Math.round(img.height * 0.05);
            const cropBottom = Math.round(img.height * 0.09);
            const targetWidth = img.width;
            const targetHeight = img.height - cropTop - cropBottom;
            
            if (targetHeight > 0) {
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                if (ctx) {
                    ctx.drawImage(img, 0, cropTop, img.width, img.height - cropTop - cropBottom, 0, 0, targetWidth, targetHeight);
                }
            } else {
                canvas.width = img.width;
                canvas.height = img.height;
                if (ctx) {
                    ctx.drawImage(img, 0, 0);
                }
            }
            
            URL.revokeObjectURL(objectUrl);
            
            const croppedBlob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob((b) => resolve(b), contentType, 0.9);
            });
            
            if (croppedBlob) {
                return new File([croppedBlob], finalName, { type: contentType });
            }
        }
        
        return new File([blob], finalName, { type: contentType });
    } catch (e) {
        console.error('[ScoutView] urlToFile error:', e);
        return null; 
    }
};

// -- DIRECT TO INVENTORY HELPER (Bypasses Buy Trackers and saves directly to items collection) --
async function saveDirectToInventory(payload: any) {
    const teamId = currentTeam.value?.$id;
    let permissions: string[] = [];
    if (teamId) {
        const role = Role.team(teamId);
        permissions = [Permission.read(role), Permission.update(role), Permission.delete(role)];
    } else if (user.value) {
        const role = Role.user(user.value.$id);
        permissions = [Permission.read(role), Permission.update(role), Permission.delete(role)];
    }

    let finalUpc = payload.upc;
    if (!finalUpc) {
        try {
            finalUpc = await generateAutoUpc('HUCK-', teamId);
        } catch {
            finalUpc = `HUCK-${Math.floor(1000 + Math.random() * 9000)}`;
        }
    }

    const doc: any = {
        ...payload,
        upc: finalUpc,
        tenantId: teamId || null,
        status: payload.status || 'acquired'
    };

    // Clean undefined keys for Appwrite document validation
    Object.keys(doc).forEach(key => doc[key] === undefined && delete doc[key]);

    const created = await databases.createDocument(
        DB_ID,
        getCollectionId(),
        ID.unique(),
        doc,
        permissions.length > 0 ? permissions : undefined
    );
    console.log('[ScoutView] Direct to inventory document created successfully:', created.$id, created.title);
    return created;
}

// -- SAVE ACTION --
async function handleSaveItem(item: any, index: number, isBatch = false) {
    console.log('[ScoutView] handleSaveItem callled for item:', item.identity);
    
    if (item.saving || item.saved) {
        console.log('[ScoutView] Item already saving/saved, ignoring save request for', item.identity);
        return;
    }
    
    // If untethered and user hasn't chosen standalone bypass, prompt with tracker modal
    if (!activePurchase.value && !allowStandaloneSave.value) {
        promptSaveDestination(item, index);
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
        // Helper to extract file ID from Appwrite view/download URLs
        const getFileIdFromUrl = (url: string): string | null => {
            if (!url) return null;
            const match = url.match(/\/files\/([^\/]+)\/(?:view|download)/);
            if (match) return match[1];
            if (!url.startsWith('http') && !url.startsWith('data:') && !url.startsWith('blob:')) {
                return url;
            }
            return null;
        };

        // 1. Process and upload images (mixed local and existing)
        let galleryIds: string[] = [];
        if (images.value.length > 0) {
             console.log('[ScoutView] Processing gallery images...', images.value.length);
             const orderedImages = [...images.value];
             if (mainPhotoSelection.value.type === 'new' && typeof mainPhotoSelection.value.val === 'number' && orderedImages[mainPhotoSelection.value.val]) {
                 const [chosenMain] = orderedImages.splice(mainPhotoSelection.value.val, 1);
                 orderedImages.unshift(chosenMain);
             }
             const uploads = await Promise.all(orderedImages.map(async (img: any) => {
                 if (img.file) {
                     // This is a new local image that needs to be uploaded to Appwrite storage
                     try {
                         const up = await storage.createFile(BUCKET_ID || 'item_images', ID.unique(), img.file);
                         return up.$id;
                     } catch (e: any) {
                         console.error('[ScoutView] Failed to upload local image:', e);
                         return null;
                     }
                 } else if (img.url && img.url.startsWith('http') && !img.url.includes(import.meta.env.PUBLIC_APPWRITE_PROJECT_ID || '')) {
                     // Remote URL - upload to Appwrite storage
                     try {
                         const filename = img.url.split('/').pop()?.split('?')[0] || "downloaded.jpg";
                         const file = await urlToFile(img.url, filename);
                         if (file) {
                             const up = await storage.createFile(BUCKET_ID || 'item_images', ID.unique(), file);
                             return up.$id;
                         }
                     } catch (e) {
                         console.error('[ScoutView] Client-side remote image crop/upload failed, trying fallback:', img.url, e);
                     }
                     try {
                         const res = await fetch('/api/upload-remote-image', {
                             method: 'POST',
                             headers: { 'Content-Type': 'application/json' },
                             body: JSON.stringify({ url: img.url })
                         });
                         if (res.ok) {
                             const uploadRes = await res.json();
                             return uploadRes.fileId || null;
                         }
                     } catch (e) {
                         console.error('[ScoutView] Failed to upload remote image via fallback:', img.url, e);
                     }
                     return null;
                 } else {
                     // This is an existing image URL, extract its file ID
                     return getFileIdFromUrl(img.url);
                 }
             }));
             galleryIds = uploads.filter((id): id is string => id !== null);
             console.log('[ScoutView] Final gallery IDs:', galleryIds);
        } else if (item.fetched_images && item.fetched_images.length > 0) {
             console.log('[ScoutView] Uploading remote images array with client-side crop...', item.fetched_images);
             
             // Ensure the current main image (item.fetched_image) is uploaded first
             const mainImg = item.fetched_image || item.fetched_images[0];
             const otherImgs = item.fetched_images.filter((img: string) => img !== mainImg);
             const imagesToUpload = [mainImg, ...otherImgs].slice(0, 5); // Upload max 5 images
             
             try {
                 const uploads = await Promise.all(imagesToUpload.map(async (imgUrl) => {
                     try {
                         const filename = imgUrl.split('/').pop()?.split('?')[0] || "downloaded.jpg";
                         const file = await urlToFile(imgUrl, filename);
                         if (file) {
                             const up = await storage.createFile(BUCKET_ID || 'item_images', ID.unique(), file);
                             return up.$id;
                         }
                     } catch (e) {
                         console.error('[ScoutView] Client-side image crop/upload failed, trying fallback:', imgUrl, e);
                     }
                     
                     // Fallback
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
                         console.error('[ScoutView] Failed to upload remote image via fallback:', imgUrl, e);
                     }
                     return null;
                 }));
                 galleryIds = uploads.filter((id): id is string => id !== null);
                 console.log('[ScoutView] Remote images uploaded:', galleryIds);
             } catch (err) {
                 console.error('[ScoutView] Failed to upload remote images:', err);
             }
        } else if (item.fetched_image) {
             console.log('[ScoutView] Uploading remote image with client-side crop...', item.fetched_image);
             try {
                 const imgUrl = item.fetched_image;
                 const filename = imgUrl.split('/').pop()?.split('?')[0] || "downloaded.jpg";
                 let uploadedId: string | null = null;
                 
                 try {
                     const file = await urlToFile(imgUrl, filename);
                     if (file) {
                         const up = await storage.createFile(BUCKET_ID || 'item_images', ID.unique(), file);
                         uploadedId = up.$id;
                     }
                 } catch (e) {
                     console.error('[ScoutView] Client-side image crop/upload failed, trying fallback:', e);
                 }
                 
                 if (!uploadedId) {
                     const res = await fetch('/api/upload-remote-image', {
                         method: 'POST',
                         headers: { 'Content-Type': 'application/json' },
                         body: JSON.stringify({ url: imgUrl })
                     });
                     if (res.ok) {
                         const data = await res.json();
                         uploadedId = data.fileId || null;
                     }
                 }
                 
                 if (uploadedId) {
                     galleryIds.push(uploadedId);
                     console.log('[ScoutView] Remote image uploaded, fileId:', uploadedId);
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

        // 2b. If we are re-scouting/updating an existing document
        if (rescoutId.value) {
            console.log('[ScoutView] Updating existing document:', rescoutId.value);
            let noteDetails = (userNotes.value ? `User Note: ${userNotes.value}\n` : '') + (item.condition_notes || '');
            if (item.shipping_info) {
                 const { shipping, handling, carrier, zipCode } = item.shipping_info;
                 noteDetails += `\n[Shipping: $${shipping?.toFixed(2)}, Handling: $${handling?.toFixed(2)} via ${carrier} to ${zipCode}]`;
            }
            if (receiptId) {
                 noteDetails += `\n[RECEIPT: ${receiptId}]`;
            }

            const updatePayload: any = {
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
                rawAnalysis: getSafeRawAnalysis(item) || undefined
            };
            if (galleryIds.length > 0) {
                updatePayload.galleryImageIds = galleryIds;
                updatePayload.imageId = galleryIds[0];
            }
            if (receiptId) {
                updatePayload.receiptImageId = receiptId;
            }

            Object.keys(updatePayload).forEach(key => updatePayload[key] === undefined && delete updatePayload[key]);

            await databases.updateDocument(DB_ID, ITEMS_COL, rescoutId.value, updatePayload);
            console.log('[ScoutView] Document updated successfully:', rescoutId.value);

            // Update local state in useCart
            const localIndex = cartItems.value.findIndex(ci => ci.$id === rescoutId.value);
            if (localIndex !== -1) {
                cartItems.value[localIndex] = {
                    ...cartItems.value[localIndex],
                    ...updatePayload
                };
            }

            item.saved = true;
            successMessage.value = `Updated ${item.identity}!`;
            
            setTimeout(() => {
                successMessage.value = null;
            }, 2000);

            return;
        }

        // 3. Save Item(s)
        if (item.save_individually && item.lot_items && item.lot_items.length > 0) {
             console.log('[ScoutView] Saving items individually...', item.lot_items.length);
             const individualCost = cost.value ? parseFloat((Number(cost.value) / item.lot_items.length).toFixed(2)) : 0.0;
             
             // Pre-load main image for cropping if possible
             let mainImageElement: HTMLImageElement | null = null;
             
             let mainImgSrc = item.fetched_image || (item.fetched_images && item.fetched_images.length > 0 ? item.fetched_images[0] : null);
             if (!mainImgSrc && item.imageId) {
                 mainImgSrc = `${import.meta.env.PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${item.imageId}/view?project=${import.meta.env.PUBLIC_APPWRITE_PROJECT_ID}`;
             }
             
             if (mainImgSrc) {
                 try {
                     const proxiedUrl = `/api/proxy-image?url=${encodeURIComponent(mainImgSrc)}`;
                     const res = await fetch(proxiedUrl);
                     if (!res.ok) throw new Error("Failed to fetch image via proxy");
                     const blob = await res.blob();
                     const objectUrl = URL.createObjectURL(blob);
                     
                     mainImageElement = new Image();
                     await new Promise((resolve, reject) => {
                         mainImageElement!.onload = resolve;
                         mainImageElement!.onerror = reject;
                         mainImageElement!.src = objectUrl;
                     });
                     URL.revokeObjectURL(objectUrl);
                 } catch (e) {
                     console.warn('[ScoutView] Failed to load main image for cropping', e);
                     mainImageElement = null;
                 }
             }

             // Loop and save each individual sub-item
             for (let i = 0; i < item.lot_items.length; i++) {
                 const subItem = item.lot_items[i];
                 const subItemName = subItem.name || subItem.title || subItem.identity || subItem.item || 'Component Item';
                 
                 let itemGalleryIds = [...galleryIds]; // Default to shared lot images
                 
                 // Apply crop if bounding box exists
                 if (subItem.bounding_box && mainImageElement && BUCKET_ID) {
                     try {
                          let bbox = subItem.bounding_box;
                          if (typeof bbox === 'string') {
                              bbox = JSON.parse(bbox);
                          }
                          const [ymin, xmin, ymax, xmax] = bbox;
                          const imgW = mainImageElement.naturalWidth;
                          const imgH = mainImageElement.naturalHeight;
                          
                          const sx = (xmin / 1000) * imgW;
                          const sy = (ymin / 1000) * imgH;
                          const sWidth = ((xmax - xmin) / 1000) * imgW;
                          const sHeight = ((ymax - ymin) / 1000) * imgH;
                          
                          // Expand crop slightly (10% padding)
                          const paddingX = sWidth * 0.1;
                          const paddingY = sHeight * 0.1;
                          const cropX = Math.max(0, sx - paddingX);
                          const cropY = Math.max(0, sy - paddingY);
                          const cropW = Math.min(imgW - cropX, sWidth + (paddingX * 2));
                          const cropH = Math.min(imgH - cropY, sHeight + (paddingY * 2));
                          
                          const canvas = document.createElement('canvas');
                          canvas.width = cropW;
                          canvas.height = cropH;
                          const ctx = canvas.getContext('2d');
                          if (ctx) {
                              ctx.drawImage(mainImageElement, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
                              const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
                              if (blob) {
                                  const file = new File([blob], `crop-${ID.unique()}.jpg`, { type: 'image/jpeg' });
                                  const upload = await storage.createFile(BUCKET_ID, ID.unique(), file);
                                  itemGalleryIds = [upload.$id]; // Set just the cropped image
                              } else {
                                  addToast({ type: 'error', message: 'Failed to generate crop blob' });
                              }
                          }
                     } catch(e) {
                         console.error("[ScoutView] Failed to crop image using bounding box", e);
                         addToast({ type: 'error', message: `Crop failed: ${e.message}` });
                     }
                 } else if (!subItem.bounding_box) {
                     addToast({ type: 'warning', message: `No bounding box returned by AI for ${subItemName}` });
                 } else if (!mainImageElement) {
                     addToast({ type: 'error', message: `Could not load main image to crop ${subItemName}` });
                 }
                 
                 let noteDetails = `Lot Item: ${subItemName}\nInferred Condition: ${subItem.condition}\n` + (userNotes.value ? `User Note: ${userNotes.value}\n` : '') + (item.condition_notes || '');
                 if (item.shipping_info) {
                      const { shipping, handling, carrier, zipCode } = item.shipping_info;
                      noteDetails += `\n[Shipping: $${(shipping/item.lot_items.length).toFixed(2)}, Handling: $${(handling/item.lot_items.length).toFixed(2)} via ${carrier} to ${zipCode}]`;
                 }
                 if (receiptId) {
                      noteDetails += `\n[RECEIPT: ${receiptId}]`;
                 }
                 
                 const itemPayload: any = {
                     identity: subItemName,
                     title: subItemName,
                     conditionNotes: noteDetails,
                     redFlags: item.red_flags || [],
                     cost: individualCost,
                     resalePrice: parsePrice(subItem.estimated_value) || 0.0,
                     maxBuyPrice: calculateMaxBuy(subItem.estimated_value) || 0.0,
                     sourcingLocation: sourcingLocation.value || '',
                     storageLocation: storageLocation.value || '',
                     status: isAcquired.value ? 'acquired' : 'tracked',
                     keywords: item.keywords || [],
                     galleryImageIds: itemGalleryIds,
                     rawAnalysis: getSafeRawAnalysis(item) || undefined
                 };
                 
                 const subItemImage = itemGalleryIds[0] 
                     || subItem.imageId 
                     || subItem.image 
                     || (itemGalleryIds.length > 0 ? itemGalleryIds[0] : null)
                     || item.imageId
                     || item.fetched_image
                     || null;
                 
                 itemPayload.imageId = subItemImage;
                 
                 if (activePurchase.value) {
                     await addItemToPurchase({
                         title: subItemName,
                         cost: individualCost,
                         resalePrice: parsePrice(subItem.estimated_value) || 0.0,
                         boutiquePrice: parsePrice(subItem.estimated_value) || 0.0,
                         imageId: subItemImage,
                         conditionNotes: noteDetails,
                         rawAnalysis: getSafeRawAnalysis(item) || undefined
                     });
                 } else {
                     console.log('[ScoutView] Saving individual lot item direct to inventory:', itemPayload);
                     await saveDirectToInventory(itemPayload);
                 }
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

             const primaryImage = galleryIds[0] 
                 || item.imageId 
                 || item.fetched_image 
                 || (item.fetched_images && item.fetched_images[0]) 
                 || item.image 
                 || (images.value && images.value.length > 0 ? images.value[0].url : null) 
                 || null;
             
             if (primaryImage && galleryIds.length === 0) {
                 galleryIds.push(primaryImage);
             }

             const itemPayload: any = {
                 identity: item.identity,
                 title: item.title || item.identity,
                 conditionNotes: noteDetails,
                 redFlags: item.red_flags || [],
                 cost: cost.value ? parseFloat(Number(cost.value).toFixed(2)) : 0.0,
                 resalePrice: item.selected_resale_price || parsePrice(item.price_breakdown?.fair) || 0.0,
                 maxBuyPrice: calculateMaxBuy(item.price_breakdown?.fair) || 0.0,
                 sourcingLocation: sourcingLocation.value || '',
                 storageLocation: storageLocation.value || '',
                 status: 'acquired',
                 keywords: item.keywords || [],
                 imageId: primaryImage,
                 galleryImageIds: galleryIds,
                 rawAnalysis: getSafeRawAnalysis(item) || undefined,
                 components: item.lot_items ? JSON.stringify(item.lot_items).slice(0, 65000) : undefined
             };
             
             if (activePurchase.value) {
                 if (item.lot_items && item.lot_items.length > 0) {
                     const doc = await addLotToPurchase({
                         title: item.title || item.identity,
                         lotCost: cost.value ? parseFloat(Number(cost.value).toFixed(2)) : 0.0,
                         totalEstValue: item.selected_resale_price || parsePrice(item.price_breakdown?.fair) || 0.0,
                         boutiqueValue: parsePrice(item.price_breakdown?.boutique_premium) || (item.selected_resale_price || 0),
                         lotItems: item.lot_items,
                         imageId: primaryImage,
                         conditionNotes: noteDetails,
                         rawAnalysis: getSafeRawAnalysis(item) || undefined
                     });
                     if (doc && !cartItems.value.some(ci => ci.$id === doc.$id)) {
                         cartItems.value.unshift(doc as any);
                     }
                 } else {
                     const doc = await addItemToPurchase({
                         title: item.title || item.identity,
                         cost: cost.value ? parseFloat(Number(cost.value).toFixed(2)) : 0.0,
                         resalePrice: item.selected_resale_price || parsePrice(item.price_breakdown?.fair) || 0.0,
                         boutiquePrice: parsePrice(item.price_breakdown?.boutique_premium) || (item.selected_resale_price || 0),
                         imageId: primaryImage,
                         conditionNotes: noteDetails,
                         rawAnalysis: getSafeRawAnalysis(item) || undefined
                     });
                     if (doc && !cartItems.value.some(ci => ci.$id === doc.$id)) {
                         cartItems.value.unshift(doc as any);
                     }
                 }
             } else {
                 console.log('[ScoutView] Saving bundle/item direct to inventory:', itemPayload);
                 await saveDirectToInventory(itemPayload);
             }
        }
        console.log('[ScoutView] Item added successfully');
        
        item.saved = true;
        const dealName = activePurchase.value?.vendor || 'Inventory';
        successMessage.value = `Added to ${dealName}!`;
        addToast({ type: 'success', message: `✅ Added to ${dealName}!` });

        if (!isBatch) {
            let cartItem = null;
            if (rescoutId.value) {
                cartItem = cartItems.value.find(ci => ci.$id === rescoutId.value) || (purchaseItems.value as any[]).find(pi => pi.$id === rescoutId.value);
            } else {
                cartItem = cartItems.value[0] || purchaseItems.value[0] || cartItems.value[cartItems.value.length - 1];
            }
            

            
            startNewScan();
        }

        // Reset inputs smoothly
        setTimeout(() => {
            successMessage.value = null;
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

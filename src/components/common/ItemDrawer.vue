<template>
    <Teleport to="body">
        <div class="relative z-[400]">
            <div class="fixed inset-0 bg-black/50 transition-opacity" @click="closeDrawer"></div>
            <div class="fixed inset-y-0 right-0 w-full md:w-[480px] bg-base-100 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out">
            <!-- Header -->
            <div class="p-4 border-b border-base-200 flex justify-between items-center bg-base-100 flex-none sticky top-0 z-20">
                <h3 class="font-bold text-lg">{{ item ? 'Edit Item' : 'Add New Item' }}</h3>
                <button class="btn btn-sm btn-circle btn-ghost" @click="closeDrawer">✕</button>
            </div>

            <!-- Docked Title -->
            <div class="px-4 py-2 bg-base-100 flex-none z-20">
                <div class="form-control w-full">
                    <label class="label flex flex-col items-start gap-1 px-0 pt-0 pb-1 w-full">
                        <!-- Unmatched -->
                        <button v-if="suggestedTitleStr && suggestedTitleStr !== editForm.title" class="btn btn-xs btn-soft btn-primary rounded-xl font-normal w-full text-left h-auto py-1.5 px-3 justify-start items-start" @click="editForm.title = suggestedTitleStr" title="Apply AI Suggestion">
                            <Icon icon="solar:magic-stick-linear" class="w-3.5 h-3.5 shrink-0 mt-0.5" /> 
                            <span class="whitespace-normal break-words leading-tight">Use: {{ suggestedTitleStr }}</span>
                        </button>

                        <div class="flex items-center justify-start gap-1.5 w-full">
                            <span class="label-text font-bold shrink-0">Item Title</span>
                            <!-- Matched -->
                            <div v-if="suggestedTitleStr && suggestedTitleStr === editForm.title" class="text-success shrink-0" title="AI Suggestion Applied">
                                <div class="relative w-4 h-4 flex items-center justify-center">
                                    <Icon icon="solar:magic-stick-bold" class="w-4 h-4" />
                                    <div class="absolute -bottom-0.5 -right-0.5 bg-base-100 rounded-full p-[1px]">
                                        <Icon icon="solar:check-circle-bold" class="w-2.5 h-2.5" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </label>
                    <div class="join w-full flex items-stretch">
                        <textarea v-model="editForm.title" class="textarea textarea-bordered border border-base-content/20 font-bold join-item grow leading-tight min-h-[3rem] py-2 resize-none bg-base-200 focus:bg-base-100 focus:ring-1 focus:ring-primary/30 transition-colors duration-200" rows="2" placeholder="Item Title..."></textarea>
                        <button class="btn join-item border border-base-300 h-auto w-12 flex items-center justify-center p-0" @click="copyToClipboard(editForm.title)" title="Copy Title">
                            <Icon icon="solar:copy-linear" class="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            <!-- Main Tabs -->
            <div class="px-4 pt-0 pb-2 bg-base-100 border-b border-base-200 flex-none z-20 shadow-sm">
                <div role="tablist" class="tabs tabs-bordered font-bold w-full">
                    <a role="tab" class="tab flex-1" :class="{'tab-active': mainTab === 'details'}" @click="mainTab = 'details'">Details</a>
                    <a role="tab" class="tab flex-1" :class="{'tab-active text-primary': mainTab === 'verify'}" @click="mainTab = 'verify'">Verify</a>
                    <a v-if="item" role="tab" class="tab flex-1" :class="{'tab-active text-secondary': mainTab === 'lot'}" @click="mainTab = 'lot'">Lot</a>
                </div>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6" v-show="mainTab === 'details'">
                <!-- 1. Text Query (Item Description/Scout Input) -->
                <div class="space-y-4">
                        <!-- 1. Text Query -->
                        <div class="form-control w-full" v-if="!item">
                            <label class="label pt-0 pb-1 flex justify-between w-full">
                                <span class="label-text font-bold text-sm flex items-center gap-1">
                                    <Icon icon="solar:magic-stick-bold" class="w-4 h-4 text-primary" />
                                    AI Scout Prompt
                                </span>
                                <span class="text-[10px] opacity-50 uppercase font-bold tracking-wider">Not Saved</span>
                            </label>
                            <textarea v-model="scoutQuery" class="textarea textarea-bordered border border-base-content/20 h-20 text-sm w-full bg-base-200 focus:bg-base-100 focus:ring-1 focus:ring-primary/30 transition-colors duration-200" placeholder="e.g. Vintage Sony Walkman in good condition..."></textarea>
                        </div>
                        
                        <!-- Source Link / Fetcher -->
                        <div class="form-control w-full">
                            <label class="label pb-1 pt-0 flex justify-between w-full">
                                <span class="label-text">Source Link</span>
                            </label>
                             <div class="join w-full flex shadow-sm">
                                <input type="text" v-model="editForm.sourcingLocation" class="input input-bordered join-item grow font-mono text-xs bg-base-200 focus:bg-base-100 focus:ring-1 focus:ring-primary/30 transition-colors duration-200" placeholder="Paste URL to fetch data & photos..." />
                                <a v-if="editForm.sourcingLocation && editForm.sourcingLocation.startsWith('http')" :href="editForm.sourcingLocation" target="_blank" class="btn btn-neutral join-item shrink-0 px-3" title="Open Link"><Icon icon="solar:link-linear" class="w-4 h-4" /></a>
                                <button class="btn btn-primary join-item shrink-0 px-3" @click="fetchSourceData" :disabled="!editForm.sourcingLocation || fetchingImages" title="Fetch Data from URL">
                                    <span v-if="fetchingImages" class="loading loading-spinner loading-xs"></span>
                                    <span v-else class="flex items-center gap-1"><Icon icon="solar:cloud-download-linear" class="w-4 h-4" /> Fetch</span>
                                </button>
                             </div>
                        </div>
                        
                        <!-- 2. Photos -->
                        <!-- Fetched Images Preview -->
                        <div v-if="fetchedImages.length > 0" class="border border-base-300 rounded-lg p-4 bg-base-200 mb-4">
                            <label class="label pt-0"><span class="label-text font-bold">Detected Images (Click to Add)</span></label>
                            <div class="flex gap-2 overflow-x-auto pb-2 min-h-20">
                                <div v-for="(imgItem, idx) in fetchedImages" :key="idx" 
                                    class="relative w-20 h-20 shrink-0 group cursor-pointer hover:ring-2 ring-primary rounded-lg overflow-hidden transition-all" 
                                    @click="selectFetchedImage(imgItem.url || imgItem)">
                                    <img :src="proxify(imgItem.url || imgItem)" class="w-full h-full object-cover" />
                                    <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                                        Add
                                    </div>
                                </div>
                            </div>
                            <div class="flex justify-end mt-1">
                                <button class="btn btn-xs btn-ghost text-error" @click="fetchedImages = []">Clear</button>
                            </div>
                        </div>
                        <div class="form-control w-full">
                            <label class="label py-1">
                                <span class="label-text font-bold text-sm">Photos (Click to set Main ⭐)</span>
                            </label>
                            <!-- Dropzone & Gallery Area -->
                            <div class="border-2 border-dashed rounded-xl p-3 transition-colors relative min-h-[100px] flex flex-col justify-center"
                                 @dragenter.prevent="dragOver = true"
                                 @dragover.prevent="dragOver = true"
                                 @dragleave.prevent="onDragLeave"
                                 @drop.prevent="handleDrop"
                                 :class="{'border-primary bg-primary/5': dragOver, 'border-base-300': !dragOver}">
                                 
                                <div v-if="!editForm.existingGalleryIds?.length && !editGalleryBuffer.length" class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50">
                                    <div class="flex flex-col items-center">
                                        <Icon icon="solar:upload-minimalistic-linear" class="w-8 h-8 mb-1" />
                                        <span class="text-xs">Drag & drop photos here</span>
                                    </div>
                                </div>
                                
                                <div class="flex gap-2 items-center overflow-x-auto w-full pointer-events-auto z-10">
                                    <!-- Existing Previews -->
                                    <div v-for="id in editForm.existingGalleryIds" :key="id" class="relative w-20 h-20 shrink-0 group cursor-pointer" @click="setMainPhoto('existing', id)">
                                        <img :src="getAssetUrl(id)" class="w-full h-full object-cover rounded-lg shadow-sm border border-base-300" :class="{'ring-4 ring-primary ring-inset z-10': actualMainPhoto.id === id}"/>
                                        <div v-if="actualMainPhoto.id === id" class="absolute -top-3 -left-3 text-2xl drop-shadow-md z-20 text-warning"><Icon icon="solar:star-bold" /></div>
                                        <button @click.stop="removeGalleryItem(id, true)" class="btn btn-xs btn-circle btn-error absolute -top-2 -right-2 w-5 h-5 min-h-0 text-[10px] flex items-center justify-center z-30 shadow hover:scale-110">✕</button>
                                    </div>
                                    <!-- New Previews -->
                                    <div v-for="(file, idx) in editGalleryBuffer" :key="idx" class="relative w-20 h-20 shrink-0 group cursor-pointer" @click="setMainPhoto('new', idx)">
                                        <img :src="getObjectUrl(file)" class="w-full h-full object-cover rounded-lg shadow-sm border border-base-300" :class="{'ring-4 ring-primary ring-inset z-10': actualMainPhoto.file === file}"/>
                                        <div v-if="actualMainPhoto.file === file" class="absolute -top-3 -left-3 text-2xl drop-shadow-md z-20 text-warning"><Icon icon="solar:star-bold" /></div>
                                        <button @click.stop="removeGalleryItem(idx, false)" class="btn btn-xs btn-circle btn-error absolute -top-2 -right-2 w-5 h-5 min-h-0 text-[10px] flex items-center justify-center z-30 shadow hover:scale-110">✕</button>
                                    </div>
                                </div>
                            </div>

                            <!-- Action Buttons Docked Below -->
                            <div class="flex gap-2 mt-2 w-full">
                                <button @click="$refs.fileInput.click()" class="btn btn-sm btn-outline flex-1 text-xs">
                                    <Icon icon="solar:gallery-add-linear" class="w-4 h-4 mr-1" /> Upload Photos
                                </button>
                                <button @click="$refs.scannerWidget.startCamera()" class="btn btn-sm btn-outline flex-1 text-xs">
                                    <Icon icon="solar:camera-linear" class="w-4 h-4 mr-1" /> Open Camera
                                </button>
                            </div>

                            <!-- Hidden Inputs & Widgets -->
                            <ScannerWidget ref="scannerWidget" :photos="editGalleryBuffer" @photos-captured="handleCapturedPhotos" :hide-all-triggers="true" />
                            <input type="file" ref="fileInput" multiple accept="image/*" class="hidden" @change="handleFileSelect" />
                            

                        </div>
                </div>

                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                     <div class="form-control w-full">
                        <label class="label"><span class="label-text">Quantity</span></label>
                        <div class="flex flex-col gap-1">
                            <input type="number" step="1" min="1" v-model="editForm.quantity" class="input input-bordered w-full text-center font-bold bg-base-200 focus:bg-base-100 focus:ring-1 focus:ring-primary/30 transition-colors duration-200" />
                            <button v-if="item && Number(editForm.quantity) > 1" @click.prevent="sellOneQuantity" class="btn btn-xs btn-success w-full mt-1 shadow-sm opacity-80 hover:opacity-100 transition-opacity">
                                <Icon icon="solar:cart-check-linear" class="w-4 h-4" /> Sell One
                            </button>
                        </div>
                    </div>
                     <div class="form-control w-full">
                        <label class="label">
                            <span class="label-text">Cost Basis</span>
                        </label>
                        <label class="input input-bordered flex items-center gap-2 bg-base-200 focus:bg-base-100 focus:ring-1 focus:ring-primary/30 transition-colors duration-200">
                            <span class="opacity-50">$</span>
                            <input type="number" step="0.01" v-model="editForm.cost" class="grow" placeholder="0.00" />
                        </label>
                        <div v-if="editForm.quantity > 1" class="text-xs text-secondary opacity-80 mt-1 pl-1 font-mono">
                            (${{ (parseFloat(editForm.cost || 0) / editForm.quantity).toFixed(2) }} ea)
                        </div>
                    </div>
                     <div class="form-control w-full">
                        <label class="label flex flex-col items-start gap-1 pb-1 w-full">
                            <button v-if="suggestedListPriceStr && suggestedListPriceStr !== String(editForm.resalePrice)" class="btn btn-xs btn-soft btn-primary rounded-xl font-normal w-full text-left h-auto py-1 px-2 justify-start items-start" @click="editForm.resalePrice = suggestedListPriceStr" title="Apply AI Suggestion">
                                <Icon icon="solar:magic-stick-linear" class="w-3.5 h-3.5 shrink-0 mt-0.5" /> 
                                <span class="whitespace-normal break-words leading-tight">Use: ${{ suggestedListPriceStr }}</span>
                            </button>
                            <div class="flex items-center justify-start gap-1.5 w-full">
                                <span class="label-text">List Price</span>
                                <div v-if="suggestedListPriceStr && suggestedListPriceStr === String(editForm.resalePrice)" class="text-success shrink-0" title="AI Suggestion Applied">
                                    <div class="relative w-4 h-4 flex items-center justify-center">
                                        <Icon icon="solar:magic-stick-bold" class="w-4 h-4" />
                                        <div class="absolute -bottom-0.5 -right-0.5 bg-base-100 rounded-full p-[1px]"><Icon icon="solar:check-circle-bold" class="w-2.5 h-2.5" /></div>
                                    </div>
                                </div>
                            </div>
                        </label>
                         <label class="input input-bordered flex items-center gap-2 bg-base-200 focus:bg-base-100 focus:ring-1 focus:ring-primary/30 transition-colors duration-200">
                            <span class="opacity-50">$</span>
                            <input type="number" step="0.01" v-model="editForm.resalePrice" class="grow" placeholder="0.00" />
                        </label>
                        <div v-if="editForm.quantity > 1" class="text-xs text-secondary opacity-80 mt-1 pl-1 font-mono">
                            (${{ (parseFloat(editForm.resalePrice || 0) / editForm.quantity).toFixed(2) }} ea)
                        </div>
                    </div>
                     <div class="form-control w-full">
                        <label class="label">
                            <span class="label-text text-success font-bold">Sold Price</span>
                        </label>
                         <label class="input input-bordered flex items-center gap-2 bg-base-200 focus:bg-base-100 focus:ring-1 focus:ring-primary/30 transition-colors duration-200" :class="{'input-success': editForm.status === 'sold'}">
                            <span class="opacity-50">$</span>
                            <input type="number" step="0.01" v-model="editForm.soldPrice" class="grow font-bold" placeholder="0.00" />
                        </label>
                        <div v-if="editForm.quantity > 1" class="text-xs text-secondary opacity-80 mt-1 pl-1 font-mono">
                            (${{ (parseFloat(editForm.soldPrice || 0) / editForm.quantity).toFixed(2) }} ea)
                        </div>
                    </div>
                </div>

                <!-- AI Estimates Row -->
                <div class="grid grid-cols-2 gap-3 items-end">
                     <div class="form-control w-full">
                        <label class="label flex flex-col items-start gap-1 pb-1 w-full">
                            <button v-if="suggestedEstLowStr && suggestedEstLowStr !== String(editForm.estLow)" class="btn btn-xs btn-soft btn-primary rounded-xl font-normal w-full text-left h-auto py-1 px-2 justify-start items-start" @click="editForm.estLow = suggestedEstLowStr" title="Apply AI Suggestion">
                                <Icon icon="solar:magic-stick-linear" class="w-3.5 h-3.5 shrink-0 mt-0.5" /> 
                                <span class="whitespace-normal break-words leading-tight">Use: ${{ suggestedEstLowStr }}</span>
                            </button>
                            <div class="flex items-center justify-start gap-1.5 w-full">
                                <span class="label-text text-xs uppercase font-bold text-success truncate">Est. Low</span>
                                <div v-if="suggestedEstLowStr && suggestedEstLowStr === String(editForm.estLow)" class="text-success shrink-0" title="AI Suggestion Applied">
                                    <div class="relative w-4 h-4 flex items-center justify-center">
                                        <Icon icon="solar:magic-stick-bold" class="w-4 h-4" />
                                        <div class="absolute -bottom-0.5 -right-0.5 bg-base-100 rounded-full p-[1px]"><Icon icon="solar:check-circle-bold" class="w-2.5 h-2.5" /></div>
                                    </div>
                                </div>
                            </div>
                        </label>
                        <label class="input input-bordered flex items-center gap-2 bg-base-200 focus:bg-base-100 focus:ring-1 focus:ring-primary/30 transition-colors duration-200">
                            <span class="opacity-50">$</span>
                            <input type="number" step="0.01" v-model="editForm.estLow" class="grow min-w-0" placeholder="0.00" />
                        </label>
                    </div>
                     <div class="form-control w-full">
                        <label class="label flex flex-col items-start gap-1 pb-1 w-full">
                            <button v-if="suggestedEstHighStr && suggestedEstHighStr !== String(editForm.estHigh)" class="btn btn-xs btn-soft btn-primary rounded-xl font-normal w-full text-left h-auto py-1 px-2 justify-start items-start" @click="editForm.estHigh = suggestedEstHighStr" title="Apply AI Suggestion">
                                <Icon icon="solar:magic-stick-linear" class="w-3.5 h-3.5 shrink-0 mt-0.5" /> 
                                <span class="whitespace-normal break-words leading-tight">Use: ${{ suggestedEstHighStr }}</span>
                            </button>
                            <div class="flex items-center justify-start gap-1.5 w-full">
                                <span class="label-text text-xs uppercase font-bold text-success truncate">Est. High</span>
                                <div v-if="suggestedEstHighStr && suggestedEstHighStr === String(editForm.estHigh)" class="text-success shrink-0" title="AI Suggestion Applied">
                                    <div class="relative w-4 h-4 flex items-center justify-center">
                                        <Icon icon="solar:magic-stick-bold" class="w-4 h-4" />
                                        <div class="absolute -bottom-0.5 -right-0.5 bg-base-100 rounded-full p-[1px]"><Icon icon="solar:check-circle-bold" class="w-2.5 h-2.5" /></div>
                                    </div>
                                </div>
                            </div>
                        </label>
                         <label class="input input-bordered flex items-center gap-2 bg-base-200 focus:bg-base-100 focus:ring-1 focus:ring-primary/30 transition-colors duration-200">
                            <span class="opacity-50">$</span>
                            <input type="number" step="0.01" v-model="editForm.estHigh" class="grow min-w-0" placeholder="0.00" />
                        </label>
                    </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                     <div class="form-control w-full">
                        <label class="label"><span class="label-text">Bin Location</span></label>
                        <input type="text" list="org-bin-locations" v-model="editForm.storageLocation" class="input input-bordered w-full bg-base-200 focus:bg-base-100 focus:ring-1 focus:ring-primary/30 transition-colors duration-200" placeholder="Type or select..." />
                        <datalist id="org-bin-locations">
                            <option v-for="loc in orgPlacedLocations" :key="loc" :value="loc"></option>
                        </datalist>
                    </div>
                    
                     <div class="form-control w-full">
                        <label class="label"><span class="label-text">Source Order #</span></label>
                        <input type="text" v-model="editForm.orderId" class="input input-bordered w-full font-mono text-xs bg-base-200 focus:bg-base-100 focus:ring-1 focus:ring-primary/30 transition-colors duration-200" placeholder="e.g. ORD-12345" />
                     </div>
                </div>

                <!-- Scout Result Display (Scout View Mirror) -->
                 <div v-if="scoutResult" class="bg-base-200 rounded-xl p-4 border border-base-300 shadow-inner mt-4">
                    <div class="flex justify-between items-start mb-2">
                         <h4 class="font-bold text-sm uppercase opacity-70">Scout Report</h4>
                         <div class="flex gap-2">
                             <button v-if="scoutMdText" class="btn btn-xs btn-outline btn-secondary" @click="openMdModal">
                                 <Icon icon="solar:document-text-linear" class="w-4 h-4 inline mr-1" /> View MD Report
                             </button>
                             <button class="btn btn-xs btn-ghost" @click="scoutResult = null">✕</button>
                         </div>
                    </div>
                                <!-- New Multi-Item Layout -->
                    <div v-if="scoutItemsArray.length > 1" class="space-y-4">
                        <div class="font-bold text-sm mb-2 flex items-center gap-2 text-primary border-b border-base-300 pb-2">
                            <Icon icon="solar:box-linear" class="w-5 h-5" />
                            <span>Bundle Components ({{ scoutItemsArray.length }} Items)</span>
                        </div>
                        
                        <ul class="space-y-2 text-xs font-medium max-h-[300px] overflow-y-auto pr-1">
                            <li v-for="(resultItem, idx) in scoutItemsArray" :key="idx" class="bg-base-100 p-3 rounded-lg border border-base-300 flex flex-col gap-1.5 shadow-sm">
                                <div class="flex justify-between items-start gap-3 w-full">
                                    <span class="text-base-content font-bold leading-snug text-left truncate grow">{{ idx + 1 }}. {{ resultItem.name || resultItem.title || resultItem.identity || resultItem.item }}</span>
                                    <span class="badge badge-outline badge-primary badge-xs whitespace-nowrap px-1.5 py-1 shrink-0">{{ resultItem.condition || 'Gently Used' }}</span>
                                </div>
                                <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] opacity-75 border-t border-base-200/60 pt-2 mt-0.5">
                                    <template v-if="resultItem.price_breakdown?.poor">
                                        <span>Poor: <strong class="text-error">{{ formatPriceRange(resultItem.price_breakdown.poor) }}</strong></span>
                                        <span class="opacity-30">|</span>
                                    </template>
                                    <template v-if="resultItem.price_breakdown?.fair">
                                        <span>Fair: <strong class="text-primary">{{ formatPriceRange(resultItem.price_breakdown.fair) }}</strong></span>
                                        <span class="opacity-30">|</span>
                                    </template>
                                    <template v-if="resultItem.price_breakdown?.mint">
                                        <span>Mint: <strong class="text-success">{{ formatPriceRange(resultItem.price_breakdown.mint) }}</strong></span>
                                        <span class="opacity-30">|</span>
                                    </template>
                                    <template v-if="resultItem.price_breakdown?.boutique_premium">
                                        <span>Boutique: <strong class="text-secondary">{{ formatPriceRange(resultItem.price_breakdown.boutique_premium) }}</strong></span>
                                        <span class="opacity-30">|</span>
                                    </template>
                                    <template v-if="(!resultItem.price_breakdown?.poor && !resultItem.price_breakdown?.fair && !resultItem.price_breakdown?.mint) && resultItem.estimated_value">
                                        <span>Est. Resale: <strong class="text-primary">{{ formatPriceRange(resultItem.estimated_value) }}</strong></span>
                                        <span class="opacity-30">|</span>
                                    </template>
                                    
                                    <template v-if="editForm.cost && !isNaN(parseFloat(editForm.cost))">
                                        <span>Split Cost: <strong class="text-warning">${{ (parseFloat(editForm.cost) / scoutItemsArray.length).toFixed(2) }}</strong></span>
                                        <template v-if="shippingCosts.total > 0">
                                            <span class="opacity-30">|</span>
                                            <span>Landed Cost: <strong class="text-error">${{ ((parseFloat(editForm.cost) + shippingCosts.total) / scoutItemsArray.length).toFixed(2) }}</strong></span>
                                        </template>
                                    </template>
                                </div>
                            </li>
                        </ul>

                        <!-- Suggested Bundle Valuation Grid -->
                        <div v-if="scoutTotalRange" class="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-base-300">
                            <div class="flex flex-col items-center bg-base-100 p-2 rounded border border-base-200 shadow-sm">
                                <span class="text-[9px] uppercase font-bold text-success">Mint</span>
                                <span class="font-mono font-bold text-xs">{{ scoutTotalRange.mint.formatted }}</span>
                            </div>
                            <div class="flex flex-col items-center bg-base-100 p-2 rounded border border-primary shadow-sm">
                                <span class="text-[9px] uppercase font-bold text-primary">Fair</span>
                                <span class="font-mono font-bold text-xs">{{ scoutTotalRange.fair.formatted }}</span>
                            </div>
                            <div class="flex flex-col items-center bg-base-100 p-2 rounded border border-base-200 shadow-sm">
                                <span class="text-[9px] uppercase font-bold text-error">Poor</span>
                                <span class="font-mono font-bold text-xs">{{ scoutTotalRange.poor.formatted }}</span>
                            </div>
                            <div class="flex flex-col items-center bg-secondary/10 p-2 rounded border border-secondary/30 shadow-sm">
                                <span class="text-[9px] uppercase font-bold text-secondary">Boutique</span>
                                <span class="font-mono font-bold text-xs">{{ scoutTotalRange.boutique.formatted }}</span>
                            </div>
                        </div>

                        <!-- Save Mode Select -->
                        <div class="form-control mt-4 border-t border-base-300 pt-3">
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
                                    Creates {{ scoutItemsArray.length }} separate inventory items. Cost basis will be split evenly (${{ editForm.cost && !isNaN(parseFloat(editForm.cost)) ? (parseFloat(editForm.cost) / scoutItemsArray.length).toFixed(2) : '0.00' }} each).
                                </span>
                                <span v-else>
                                    Updates this item as a single combined inventory bundle.
                                </span>
                            </div>
                        </div>
                        
                        <!-- Actions -->
                        <div class="pt-4 border-t border-base-300">
                             <button v-if="saveIndividually" type="button" class="btn btn-primary w-full gap-2 shadow-md" @click="extractLotItems" :disabled="extractingLot">
                                  <span v-if="extractingLot" class="loading loading-spinner"></span>
                                  <span><Icon icon="solar:scissors-linear" class="w-4 h-4 inline mr-1" /> Extract {{ scoutItemsArray.length }} Items to Inventory</span>
                             </button>
                             
                             <button v-else type="button" class="btn btn-secondary w-full gap-2 shadow-md text-white font-bold" @click="applyBundleSuggestions">
                                  <span><Icon icon="solar:magic-stick-linear" class="w-4 h-4 inline mr-1" /> Apply Bundle Suggestions to Form</span>
                             </button>
                        </div>
                    </div>

                    <!-- Old Single Item Layout (Fallback) -->
                    <div v-else-if="scoutItemsArray.length === 1">
                        <!-- AI Found Image Thumbnail -->
                        <div v-if="scoutItemsArray[0].image" class="mb-3 flex justify-center">
                            <img :src="proxify(scoutItemsArray[0].image)" class="h-32 object-contain rounded-lg shadow-md border border-base-300" alt="AI Found Item" />
                        </div>

                        <!-- Red Flags -->
                        <div v-if="scoutItemsArray[0].red_flags && scoutItemsArray[0].red_flags.length > 0" class="alert alert-warning shadow-sm mb-2 p-2 text-xs">
                            <span class="font-bold"><Icon icon="solar:flag-linear" class="w-4 h-4 inline mr-1" /> Flags:</span> {{ scoutItemsArray[0].red_flags.join(', ') }}
                        </div>
                        
                        <!-- Valuation -->
                        <div v-if="scoutItemsArray[0].price_breakdown" class="grid grid-cols-2 gap-2 mb-3">
                            <div class="flex flex-col items-center bg-base-100 p-2 rounded border border-base-200">
                                <span class="text-[10px] uppercase font-bold text-success">Mint</span>
                                <span class="font-mono font-bold">{{ formatPriceRange(scoutItemsArray[0].price_breakdown.mint) }}</span>
                            </div>
                            <div class="flex flex-col items-center bg-base-100 p-2 rounded border border-primary">
                                <span class="text-[10px] uppercase font-bold text-primary">Fair</span>
                                <span class="font-mono font-bold">{{ formatPriceRange(scoutItemsArray[0].price_breakdown.fair) }}</span>
                            </div>
                            <div class="flex flex-col items-center bg-base-100 p-2 rounded border border-base-200">
                                <span class="text-[10px] uppercase font-bold text-error">Poor</span>
                                <span class="font-mono font-bold">{{ formatPriceRange(scoutItemsArray[0].price_breakdown.poor) }}</span>
                            </div>
                            <div v-if="scoutItemsArray[0].price_breakdown.boutique_premium" class="flex flex-col items-center bg-secondary/10 p-2 rounded border border-secondary/30">
                                <span class="text-[10px] uppercase font-bold text-secondary">Boutique</span>
                                <span class="font-mono font-bold">{{ formatPriceRange(scoutItemsArray[0].price_breakdown.boutique_premium) }}</span>
                            </div>
                        </div>

                        <!-- Comparables -->
                        <div v-if="scoutItemsArray[0].comparables && scoutItemsArray[0].comparables.length > 0" class="space-y-1">
                            <div class="text-[10px] font-bold uppercase opacity-50">Comps</div>
                            <div v-for="(comp, cIdx) in scoutItemsArray[0].comparables" :key="cIdx" class="flex justify-between items-center text-xs bg-base-100 p-1.5 rounded border border-base-200">
                                <span class="truncate pr-2">{{ comp.name }}</span>
                                <span class="font-mono font-bold">{{ comp.price }}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Status Steps -->
                <div class="w-full mb-6">
                    <label class="label"><span class="label-text font-bold text-sm">Item Lifecycle Status</span></label>
                    <ul class="steps w-full text-xs">
                        <li class="step cursor-pointer" 
                            :class="{'step-primary font-bold': ['acquired', 'received', 'placed', 'sold'].includes(editForm.status)}" 
                            @click="editForm.status = 'acquired'">
                            Acquired
                        </li>
                        <li class="step cursor-pointer" 
                            :class="{'step-primary font-bold': ['received', 'placed', 'sold'].includes(editForm.status)}" 
                            @click="editForm.status = 'received'">
                            Received
                        </li>
                        <li class="step cursor-pointer" 
                            :class="{'step-primary font-bold': ['placed', 'sold'].includes(editForm.status)}" 
                            @click="editForm.status = 'placed'">
                            Placed
                        </li>
                        <li class="step cursor-pointer" 
                            :class="{'step-primary font-bold': ['sold'].includes(editForm.status)}" 
                            @click="editForm.status = 'sold'">
                            Sold
                        </li>
                    </ul>
                </div>

                <div class="space-y-4">
                    <TagInput 
                        v-model="editForm.sellingLocations" 
                        label="Sales Channels" 
                        type="sellingLocations" 
                        badgeClass="badge-primary" 
                    />
                    <div class="form-control bg-base-200/50 p-3 rounded-lg border border-base-300/50 -mt-2">
                        <label class="label cursor-pointer justify-start gap-3 py-0">
                            <input type="checkbox" v-model="showOnStorefront" class="checkbox checkbox-primary checkbox-sm" />
                            <div>
                                <span class="label-text font-bold text-xs select-none">Show on Storefront</span>
                                <p class="text-[10px] opacity-60 leading-tight mt-0.5">Allow this item to be shown on your public storefront site (requires status 'placed' and a location).</p>
                            </div>
                        </label>
                    </div>
                    <TagInput 
                        v-model="editForm.keywords" 
                        label="Keywords" 
                        type="keyword" 
                        badgeClass="badge-secondary" 
                        :recommendedTags="Array.isArray(scoutResult) ? Array.from(new Set(scoutResult.flatMap(item => item.keywords || []))) : (scoutResult && scoutResult.keywords ? scoutResult.keywords : [])"
                    />
                </div>


                <!-- Scout Report -->
                <div class="divider">Product Description</div>

                <!-- Description -->
                <div class="flex justify-between items-end mb-2 gap-4">
                    <label class="label flex flex-col items-start gap-1 pt-0 w-full">
                        <button v-if="suggestedDescriptionStr && suggestedDescriptionStr !== editForm.description" class="btn btn-xs btn-soft btn-primary rounded-xl font-normal w-full text-left h-auto py-1 px-2 justify-start items-start" @click="editForm.description = suggestedDescriptionStr" title="Apply AI Suggestion">
                            <Icon icon="solar:magic-stick-linear" class="w-3.5 h-3.5 shrink-0 mt-0.5" /> 
                            <span class="whitespace-normal break-words leading-tight">Use AI Description</span>
                        </button>
                        <div class="flex items-center justify-start gap-1.5 w-full">
                            <span class="label-text font-bold">Product Description</span>
                            <button class="btn btn-xs btn-secondary btn-outline ml-2" @click="generateDescription" :disabled="generatingDescription || !item">
                                <span v-if="generatingDescription" class="loading loading-spinner loading-xs"></span>
                                <Icon icon="solar:magic-stick-linear" class="w-3 h-3 inline mr-1" /> AI Generate
                            </button>
                            <div v-if="suggestedDescriptionStr && suggestedDescriptionStr === editForm.description" class="text-success shrink-0" title="AI Suggestion Applied">
                                <div class="relative w-4 h-4 flex items-center justify-center">
                                    <Icon icon="solar:magic-stick-bold" class="w-4 h-4" />
                                    <div class="absolute -bottom-0.5 -right-0.5 bg-base-100 rounded-full p-[1px]"><Icon icon="solar:check-circle-bold" class="w-2.5 h-2.5" /></div>
                                </div>
                            </div>
                        </div>
                    </label>
                    <div class="flex items-center gap-2 shrink-0">
                        <span class="text-[10px] font-bold uppercase" :class="descTab === 'edit' ? 'text-primary' : 'opacity-50'">Edit</span>
                        <input type="checkbox" class="toggle toggle-sm toggle-primary" :checked="descTab === 'preview'" @change="descTab = $event.target.checked ? 'preview' : 'edit'" />
                        <span class="text-[10px] font-bold uppercase" :class="descTab === 'preview' ? 'text-primary' : 'opacity-50'">Preview</span>
                    </div>
                </div>

                <div v-if="descTab === 'edit'" class="form-control w-full transition-all">
                    <textarea v-model="editForm.description" class="textarea textarea-bordered border border-base-content/20 h-64 font-mono text-xs leading-normal transition-all bg-base-200 focus:bg-base-100 focus:ring-1 focus:ring-primary/30 transition-colors duration-200" :class="{'ring-2 ring-primary bg-primary/5': suggestedDescriptionStr && suggestedDescriptionStr === editForm.description}" placeholder="Product description..."></textarea>
                </div>
                <div v-else class="w-full h-64 overflow-y-auto border border-base-300 rounded-lg p-4 bg-base-100 prose prose-sm transition-all" :class="{'ring-2 ring-primary bg-primary/5': suggestedDescriptionStr && suggestedDescriptionStr === editForm.description}" v-html="renderMarkdown(editForm.description)"></div>

                <div class="h-12"></div>
            </div>

            <!-- Verify Content Tab -->
            <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6" v-show="mainTab === 'verify'">
                <div class="alert alert-info py-2 shadow-sm text-sm border-info/30">
                     <span class="text-xl"><Icon icon="solar:smart-speaker-minimalistic-linear" class="w-6 h-6 inline mr-2" /></span> Take a photo of the "Contents List" on the back of the box and the AI will build a checklist for you!
                </div>
                <div class="form-control w-full space-y-3">
                    <label class="label pb-0"><span class="label-text font-bold">1. Select or Capture Contents List</span></label>
                    
                    <ScannerWidget @photos-captured="handleVerifyPhotosCaptured" :hide-upload="false" />

                    <div v-if="(editForm.existingGalleryIds && editForm.existingGalleryIds.length > 0) || (editGalleryBuffer && editGalleryBuffer.length > 0)">
                        <label class="label py-0"><span class="label-text text-xs font-bold opacity-70">Or analyze existing gallery photo:</span></label>
                        <div class="flex gap-2 overflow-x-auto pb-2">
                             <div v-for="id in editForm.existingGalleryIds" :key="id" class="relative w-16 h-16 shrink-0 cursor-pointer hover:ring-2 ring-primary rounded transition-all" @click="extractComponentsFromId(id)">
                                  <img :src="getAssetUrl(id)" class="w-full h-full object-cover rounded shadow-sm border border-base-300" />
                                  <div class="absolute inset-0 bg-base-100/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded">
                                      <span class="text-xs font-bold text-base-content">Analyze</span>
                                  </div>
                             </div>
                             <div v-for="(file, idx) in editGalleryBuffer" :key="'buf-'+idx" class="relative w-16 h-16 shrink-0 cursor-pointer hover:ring-2 ring-primary rounded transition-all" @click="extractComponentsFromFile(file)">
                                  <img :src="getObjectUrl(file)" class="w-full h-full object-cover rounded shadow-sm border border-base-300" />
                                  <div class="absolute inset-0 bg-base-100/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded">
                                      <span class="text-xs font-bold text-base-content">Analyze</span>
                                  </div>
                             </div>
                        </div>
                    </div>
                </div>

                <div v-if="extracting" class="flex flex-col items-center py-12">
                    <span class="loading loading-spinner text-primary mb-4 w-12 h-12"></span>
                    <p class="font-bold opacity-70">AI is analyzing and inventorying...</p>
                </div>

                <div v-if="componentsList && componentsList.length > 0" class="animate-fade-in">
                    <div class="flex justify-between items-end mb-2">
                        <label class="label pb-0"><span class="label-text font-bold">2. Verification Checklist</span></label>
                        <button class="btn btn-xs btn-outline btn-error" @click="componentsList = []">Clear List</button>
                    </div>
                    
                    <div class="bg-base-200/50 rounded-xl p-3 space-y-2 border border-base-300">
                        <div v-for="(comp, idx) in componentsList" :key="idx" class="flex items-center gap-3 bg-base-100 p-3 rounded-lg shadow-sm border" :class="comp.found >= comp.expected ? 'border-success bg-success/5' : 'border-base-300'">
                            <input type="checkbox" v-model="comp.verified" class="checkbox checkbox-primary checkbox-sm" @change="handleVerifiedToggle(comp)" />
                            
                            <div class="flex-1 min-w-0">
                                <p class="font-bold text-sm truncate" :class="{'line-through opacity-50': comp.verified && comp.found >= comp.expected}">{{ comp.name }}</p>
                            </div>
                            
                            <div class="flex items-center gap-2 bg-base-200 rounded p-1">
                                <button class="btn btn-xs btn-circle btn-ghost" @click="comp.found = Math.max(0, comp.found - 1)">-</button>
                                <span class="font-mono text-sm w-10 text-center font-bold" :class="comp.found >= comp.expected ? 'text-success' : ''">{{ comp.found }} / {{ comp.expected }}</span>
                                <button class="btn btn-xs btn-circle btn-ghost" @click="comp.found++">+</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div v-else-if="!extracting" class="text-center opacity-50 py-12 border-2 border-dashed rounded-xl mt-4 border-base-300">
                     <p>No checklist yet.</p>
                </div>
            </div>

            <!-- Lot Dashboard Tab -->
            <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6" v-show="mainTab === 'lot'">
                <div class="alert alert-secondary py-2 shadow-sm text-sm border-secondary/30 mb-4">
                     <span class="text-xl"><Icon icon="solar:box-linear" class="w-6 h-6 inline mr-2" /></span> Lot Dashboard: Track extracted items and total box ROI.
                </div>
                
                <div v-if="loadingLot" class="flex justify-center py-12">
                    <span class="loading loading-spinner text-secondary w-10 h-10"></span>
                </div>
                
                <div v-else>
                    <div class="stats stats-vertical lg:stats-horizontal shadow w-full bg-base-200 border border-base-300 mb-6 text-sm">
                        <div class="stat px-4 py-2">
                            <div class="stat-title text-xs font-bold text-base-content/70">Original Box Cost</div>
                            <div class="stat-value text-lg text-base-content">${{ Number(item?.cost || 0).toFixed(2) }}</div>
                            <div class="stat-desc font-bold mt-1" :class="lotROI >= 0 ? 'text-success' : 'text-error'">
                                Total ROI: {{ lotROI >= 0 ? '+' : '' }}${{ lotROI.toFixed(2) }}
                            </div>
                        </div>
                        <div class="stat px-4 py-2">
                            <div class="stat-title text-xs">Realized Revenue</div>
                            <div class="stat-value text-lg text-success">${{ lotRealizedRevenue.toFixed(2) }}</div>
                            <div class="stat-desc">From {{ lotSoldChildren.length }} sold items</div>
                        </div>
                    </div>
                    
                    <h4 class="font-bold border-b border-base-200 pb-2 mb-4">Extracted Items ({{ lotChildren.length }})</h4>
                    <div v-if="lotChildren.length === 0" class="text-center opacity-50 py-8 border-2 border-dashed rounded-xl border-base-300">
                         No items have been extracted from this lot yet.
                    </div>
                    <div v-else class="space-y-2">
                         <div v-for="child in lotChildren" :key="child.$id" class="flex justify-between items-center bg-base-100 p-2 rounded-lg border border-base-300 shadow-sm text-xs">
                             <div class="font-bold truncate max-w-[200px]">{{ child.title }}</div>
                             <div class="flex gap-2 items-center">
                                 <span class="badge badge-sm" :class="child.status === 'sold' ? 'badge-success' : 'badge-ghost'">{{ child.status }}</span>
                                 <span v-if="child.status === 'sold'" class="font-bold text-success text-right w-12">${{ Number(child.soldPrice || 0).toFixed(2) }}</span>
                                 <span v-else class="font-bold text-right w-12 text-base-content/50">${{ Number(child.resalePrice || 0).toFixed(2) }}</span>
                             </div>
                         </div>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="p-3 pb-safe border-t border-base-200 flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-base-100 z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] gap-3 shrink-0">
                <div class="flex items-center gap-2 flex-1 w-full sm:max-w-md">
                    <button class="btn btn-secondary shadow-md shrink-0" @click="analyzeExistingItem" :disabled="analyzing || (!scoutQuery && !actualMainPhoto.url && !editForm.sourcingLocation && !editForm.title)">
                        <span v-if="analyzing" class="loading loading-spinner"></span>
                        <span v-if="analyzing" class="ml-2 text-xs font-normal max-w-[120px] sm:max-w-none truncate">{{ analysisStatus }}</span>
                        <template v-else>
                            <span class="hidden sm:inline"><Icon icon="solar:magic-stick-linear" class="w-4 h-4 mr-1 inline" /> AI Scout</span>
                            <span class="sm:hidden"><Icon icon="solar:magic-stick-linear" class="w-4 h-4 mr-1 inline" /> AI</span>
                        </template>
                    </button>
                </div>
                
                <div class="flex gap-2 w-full sm:w-auto justify-end shrink-0">
                    <button class="btn btn-ghost" @click="closeDrawer">Cancel</button>
                    <button class="btn btn-primary shadow-md" @click="saveEdit" :disabled="processing">
                        <span v-if="processing" class="loading loading-spinner"></span>
                        Save
                    </button>
                </div>
        </div>
        </div>
        </div>
    </Teleport>
</template>

<script setup>
import { ref, reactive, watch, computed, onMounted, onUnmounted } from 'vue';
import { marked } from 'marked';
import ScannerWidget from './ScannerWidget.vue';
import TagInput from './TagInput.vue';
import { saveItemToInventory, getCollectionId } from '../../lib/inventory';
import { account, databases, Query } from '../../lib/appwrite';
import { useAuth } from '../../composables/useAuth';
import { addToast } from '../../stores/toast';
import { confirmDialog } from '../../stores/confirm';
import { Icon } from '@iconify/vue';

const { currentTeam } = useAuth();
const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
const orgPlacedLocations = ref([]);

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
};

onMounted(() => {
    document.body.style.overflow = 'hidden';
    fetchLocations();
});

watch(currentTeam, (n) => { if(n) fetchLocations(); });

onUnmounted(() => {
    document.body.style.overflow = '';
});

const ENDPOINT = import.meta.env.PUBLIC_APPWRITE_ENDPOINT;
const PROJECT = import.meta.env.PUBLIC_APPWRITE_PROJECT_ID;
const BUCKET = import.meta.env.PUBLIC_APPWRITE_BUCKET_ID;

const props = defineProps({
    item: {
        type: Object,
        default: null
    }
});

const emit = defineEmits(['close', 'save']);

const mainTab = ref('details');
const descTab = ref('preview');
const scoutTab = ref('edit');
const processing = ref(false);

const extracting = ref(false);
const componentsList = ref([]);

const performExtraction = async (base64) => {
    extracting.value = true;
    try {
        const res = await fetch('/api/extract-components', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64 })
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

const handleVerifyPhotosCaptured = (files) => {
    if (files && files.length > 0) {
        extractComponentsFromFile(files[0]);
    }
};

const extractComponentsFromId = async (id) => {
    extracting.value = true;
    try {
        let url = getAssetUrl(id);
        if (url.includes('/storage/buckets/') || !url.includes('/api/proxy-image')) {
             url = `/api/proxy-image?url=${encodeURIComponent(url)}`;
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error("Could not download existing photo");
        const blob = await res.blob();
        
        const canvas = document.createElement('canvas');
        const img = new Image();
        img.onload = () => {
             let w = img.width, h = img.height, max = 1600;
             if (w > max || h > max) { 
                 if (w > h) { h = Math.round(h * (max/w)); w = max; } 
                 else { w = Math.round(w * (max/h)); h = max; } 
             }
             canvas.width = w; canvas.height = h;
             const ctx = canvas.getContext('2d');
             ctx.drawImage(img, 0, 0, w, h);
             performExtraction(canvas.toDataURL('image/jpeg', 0.85));
        };
        const reader = new FileReader();
        reader.onload = (e) => img.src = e.target.result;
        reader.readAsDataURL(blob);
    } catch (e) {
        addToast({ type: 'error', message: "Error mapping photo: " + e.message });
        extracting.value = false;
    }
};

const handleVerifiedToggle = (comp) => {
     if (comp.verified && comp.found < comp.expected) {
          comp.found = comp.expected; // Auto-fill found if user checks it
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
    itemCondition: '',
    existingGalleryIds: [],
    sellingLocations: [],
    keywords: []
});

watch(() => editForm.status, (newStatus) => {
    if (newStatus === 'sold' && (!editForm.soldPrice || editForm.soldPrice === '') && editForm.resalePrice) {
        const rp = parseFloat(editForm.resalePrice);
        if (!isNaN(rp) && rp > 0) {
            editForm.soldPrice = (rp * 0.8).toFixed(2);
            addToast({ type: 'info', message: 'Auto-filled Sold Price based on -20% of List Price.' });
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

const suggestedTitleStr = computed(() => {
    if (!scoutResult.value) return null;
    
    // Check if it's the standard API response format { items: [...] }
    if (scoutResult.value.items && Array.isArray(scoutResult.value.items) && scoutResult.value.items.length > 0) {
        // If it's a bulk lot (multiple items), combine the titles
        if (scoutResult.value.items.length > 1) {
            const names = scoutResult.value.items.map(i => i.title || i.identity).filter(Boolean);
            if (names.length > 0) {
                return `Lot of ${scoutResult.value.items.length}: ` + names.join(', ');
            }
            return `Lot of ${scoutResult.value.items.length} Items`;
        }
        return scoutResult.value.items[0].title || scoutResult.value.items[0].identity || null;
    }
    
    // Fallback for legacy single object or array formats
    if (Array.isArray(scoutResult.value) && scoutResult.value.length > 0) {
        // If it's a bulk lot (multiple items), combine the titles
        if (scoutResult.value.length > 1) {
            const names = scoutResult.value.map(i => i.title || i.identity).filter(Boolean);
            if (names.length > 0) {
                return `Lot of ${scoutResult.value.length}: ` + names.join(', ');
            }
            return `Lot of ${scoutResult.value.length} Items`;
        }
        return scoutResult.value[0].title || scoutResult.value[0].identity || null;
    } else if (!Array.isArray(scoutResult.value) && typeof scoutResult.value === 'object') {
        return scoutResult.value.title || scoutResult.value.identity || null;
    }
    
    return null;
});

const suggestedListPriceStr = computed(() => {
    if (!scoutResult.value) return null;
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
const fetchingImages = ref(false);
const analyzing = ref(false);
const analysisStatus = ref('');
const extractingLot = ref(false); // New state for bulk extraction
const saveIndividually = ref(false); // Preference state for bulk lot
const generatingDescription = ref(false);

const openMdModal = () => {
    if (scoutMdText.value) {
        document.dispatchEvent(new CustomEvent('show-md-modal', {
            detail: {
                text: scoutMdText.value,
                title: `${editForm.title || 'Scout Report'}`
            }
        }));
    }
};



const getAssetUrl = (id) => {
    if (!id || !BUCKET) return '';
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

// Global Helpers for Price Parsing
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

const getRationalPrice = (itemData) => {
    const fair = parsePrice(itemData.price_breakdown?.fair);
    const mint = parsePrice(itemData.price_breakdown?.mint);
    const poor = parsePrice(itemData.price_breakdown?.poor);
    if (mint > 0 && fair > mint * 1.5) {
        return (mint + (poor || 0)) / 2;
    }
    return fair || mint || 0;
};

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

function formatPriceOnly(val) {
    if (!val) return '';
    const s = formatPriceRange(val);
    return String(s).split(/[a-z(]/i)[0].trim();
}

const shippingCosts = computed(() => {
    // 1. Try to get from scoutResult (rawAnalysis)
    if (scoutResult.value && scoutResult.value.shipping_info) {
        const sInfo = scoutResult.value.shipping_info;
        const shipping = parseFloat(sInfo.shipping) || 0;
        const handling = parseFloat(sInfo.handling) || 0;
        const total = parseFloat(sInfo.total) || (shipping + handling);
        return { shipping, handling, total };
    }
    // 2. Fall back to parsing conditionNotes
    const notes = props.item?.conditionNotes || '';
    const match = notes.match(/\[Shipping:\s*\$([\d.]+),\s*Handling:\s*\$([\d.]+)/i);
    if (match) {
        const shipping = parseFloat(match[1]) || 0;
        const handling = parseFloat(match[2]) || 0;
        return { shipping, handling, total: shipping + handling };
    }
    return { shipping: 0, handling: 0, total: 0 };
});

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
        // Mint
        const mint = parseLowHigh(resItem.price_breakdown?.mint);
        mintLow += mint.low;
        mintHigh += mint.high;

        // Fair
        const fair = parseLowHigh(resItem.price_breakdown?.fair || resItem.estimated_value);
        fairLow += fair.low;
        fairHigh += fair.high;

        // Poor
        const poor = parseLowHigh(resItem.price_breakdown?.poor);
        poorLow += poor.low;
        poorHigh += poor.high;

        // Boutique
        if (resItem.price_breakdown?.boutique_premium) {
            const b = parseLowHigh(resItem.price_breakdown.boutique_premium);
            boutiqueLow += b.low;
            boutiqueHigh += b.high;
        } else {
            // fallback to fair price
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
        boutiqueLow,
        boutiqueHigh,
        boutiqueFormatted: formatRange(boutiqueLow, boutiqueHigh),
        
        mint: { low: mintLow, high: mintHigh, formatted: formatRange(mintLow, mintHigh) },
        fair: { low: fairLow, high: fairHigh, formatted: formatRange(fairLow, fairHigh) },
        poor: { low: poorLow, high: poorHigh, formatted: formatRange(poorLow, poorHigh) },
        boutique: { low: boutiqueLow, high: boutiqueHigh, formatted: formatRange(boutiqueLow, boutiqueHigh) }
    };
});

const getNoteValue = (notes, key, isCurrency = false) => {
    if (!notes) return null;
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Use [ \t]* instead of \s* to prevent matching across newlines.
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

const initForm = () => {
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
        editForm.storageLocation = i.storageLocation || getNoteValue(i.conditionNotes, 'Bin') || '';
        editForm.sourcingLocation = i.sourcingLocation || getNoteValue(i.conditionNotes, 'Location') || '';
        editForm.orderId = i.orderId || getNoteValue(i.conditionNotes, 'Order #') || getNoteValue(i.conditionNotes, 'Imported from Order #') || '';
        editForm.status = i.status || 'acquired';
        let desc = i.marketDescription || i.description || '';
        if (desc && typeof desc === 'string' && desc.trim().startsWith('{') && desc.includes('"identity"')) {
            desc = ''; // Hide raw AI JSON dump from older items
        }
        editForm.description = desc; 
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

        // Priority 1: Load scoutResult from rawAnalysis if present
        if (i.rawAnalysis) {
            try {
                const parsed = JSON.parse(i.rawAnalysis);
                scoutResult.value = Array.isArray(parsed) ? parsed : (parsed.items || [parsed]);
            } catch (e) {
                console.error('[ItemDrawer] Failed to parse rawAnalysis:', e);
            }
        }

        // Priority 2: Fallback to parsing tags in conditionNotes
        if (!scoutResult.value && i.conditionNotes) {
            const fileMatch = i.conditionNotes.match(/\[SCOUT_REPORT_ID: ([^\]]+)\]/);
            if (fileMatch) {
                const id = fileMatch[1].trim();
                const urlPrimary = `${ENDPOINT}/storage/buckets/reports/files/${id}/download?project=${PROJECT}`;
                const urlFallback = getAssetUrl(id).replace('/view', '/download');
                fetch(urlPrimary).then(res => {
                    if (!res.ok) throw new Error('Not in reports bucket');
                    return res.json();
                }).catch(() => fetch(urlFallback).then(res => res.json()))
                .then(data => { scoutResult.value = data; }).catch(() => {});
            } else {
                const liteMatch = i.conditionNotes.match(/\[SCOUT_DATA_LITE: ([^\]]+)\]/);
                if (liteMatch) {
                    try { scoutResult.value = JSON.parse(atob(liteMatch[1])); } catch(e) {}
                } else {
                    const match = i.conditionNotes.match(/\[SCOUT_DATA: ([^\]]+)\]/);
                    if (match) {
                        try { scoutResult.value = JSON.parse(atob(match[1])); } catch (e) {}
                    }
                }
            }
        }

        // Always check conditionNotes for markdown report tag if it exists
        if (i.conditionNotes) {
            const mdMatch = i.conditionNotes.match(/\[SCOUT_REPORT_MD: ([^\]]+)\]/);
            if (mdMatch) {
                const id = mdMatch[1].trim();
                const urlPrimary = `${ENDPOINT}/storage/buckets/reports/files/${id}/download?project=${PROJECT}`;
                const urlFallback = getAssetUrl(id).replace('/view', '/download');
                fetch(urlPrimary).then(res => {
                    if (!res.ok) throw new Error('Not in reports bucket');
                    return res.text();
                }).catch(() => fetch(urlFallback).then(res => res.text()))
                .then(txt => { editForm.itemCondition = txt; scoutMdText.value = txt; }).catch(() => {});
            }
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
        editForm.description = '';
        editForm.itemCondition = '';
        editForm.existingGalleryIds = [];
        editForm.sellingLocations = [];
        editForm.keywords = [];
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
};

watch(() => props.item, initForm, { immediate: true });

const closeDrawer = () => {
    emit('close');
};

const generateDescription = async () => {
    generatingDescription.value = true;
    try {
        const idToUpdate = props.item ? props.item.$id : null;
        
        if (idToUpdate) {
             let jwt = null;
             try {
                 const jwtRes = await account.createJWT();
                 jwt = jwtRes.jwt;
             } catch (jwtErr) {
                 console.warn("Failed to create JWT, proceeding without it:", jwtErr);
             }

             const headers = { 'Content-Type': 'application/json' };
             if (jwt) {
                 headers['X-Appwrite-JWT'] = jwt;
             }

             const res = await fetch('/api/generate-description', {
                method: 'POST',
                headers,
                body: JSON.stringify({ itemId: idToUpdate })
            });
            const data = await res.json();
            if(data.success && data.description) {
                editForm.description = data.description;
                if(data.warning) addToast({ type: 'warning', message: `Warning: ${data.warning}` });
            } else {
                addToast({ type: data.isRateLimit ? 'warning' : 'error', message: data.isRateLimit ? data.error : "Failed to generate: " + (data.error || "Unknown") });
            }
        } else {
            addToast({ type: 'warning', message: 'Please save the item first before generating a description.' });
        }
        
    } catch (e) {
        addToast({ type: 'error', message: 'Description generation failed: ' + e.message });
    } finally {
        generatingDescription.value = false;
    }
};

const saveEdit = async () => {
    processing.value = true;
    try {
        let finalGallery = [...editGalleryBuffer.value];
        let finalImageFile = null;
        if (actualMainPhoto.value.type === 'new' && editGalleryBuffer.value[actualMainPhoto.value.idx]) {
             finalImageFile = editGalleryBuffer.value[actualMainPhoto.value.idx];
             // Remove the new file from gallery buffer so we don't duplicate it in appwrite (appwrite creates new file for 'main')
             finalGallery.splice(actualMainPhoto.value.idx, 1);
        }

        const payload = {
            ...editForm,
            imageId: actualMainPhoto.value.id || null, // Existing main photo
            imageFile: finalImageFile, // New main photo
            galleryFiles: finalGallery,
            scoutData: scoutResult.value,
            components: componentsList.value.length > 0 ? JSON.stringify(componentsList.value) : null
        };
        emit('save', payload);
    } catch (e) {
        addToast({ type: 'error', message: 'Save failed: ' + e.message });
    } finally {
        processing.value = false;
    }
};

const removeGalleryItem = (idOrIdx, isExisting) => {
    if (isExisting) {
        editForm.existingGalleryIds = editForm.existingGalleryIds.filter(id => id !== idOrIdx);
    } else {
        editGalleryBuffer.value.splice(idOrIdx, 1);
    }
};

const processFile = (file, cb) => cb(file, URL.createObjectURL(file));

const dragOver = ref(false);
const fileInput = ref(null);

const handleDrop = async (e) => {
    dragOver.value = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
        handleCapturedPhotos(files);
    } else {
        // Attempt to handle dropped URL (e.g. from another browser tab)
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
            const filename = url.split('/').pop().split('?')[0] || "dragged_image.jpg";
            const file = await urlToFile(url, filename);
            if (file) {
                handleCapturedPhotos([file]);
            } else {
                addToast({ type: 'warning', message: "Could not load image from that link due to security restrictions. Please save it to your computer first." });
            }
        } else {
            console.warn('No files found in drop dataTransfer');
            addToast({ type: 'warning', message: 'No images or valid links detected in drop.' });
        }
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
        // Auto-select first photo as main if none is set yet
        if (!actualMainPhoto.value.file && !editForm.imageId && !actualMainPhoto.value.url) {
            mainPhotoSelection.value = { type: 'new', val: editGalleryBuffer.value.length - 1 };
        }
    });
};



const fetchSourceData = async () => {
    let url = editForm.sourcingLocation;
    const isId = url && url.match(/^\d+$/);
    
    // Auto-convert bare SGW IDs to URLs
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

    try {
        const res = await fetch('/api/extract-images', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: finalUrl })
        });
        const data = await res.json();
        if (data.success && data.images.length > 0) {
            fetchedImages.value = data.images;
        } else if (data.success && data.images.length === 0) {
            addToast({ type: 'warning', message: "No images found on that page." });
        }
        if (data.success) {
            if (data.price && (!editForm.cost || parseFloat(editForm.cost) === 0)) editForm.cost = data.price.toString().replace(/[$,]/g, '');
            if (data.title && (!editForm.title || editForm.title.trim().length < 4)) editForm.title = data.title;
        }
    } catch (e) {
        addToast({ type: 'error', message: "Failed to fetch source data: " + e.message });
    } finally {
        fetchingImages.value = false;
    }
};

const urlToFile = async (url, filename) => {
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
            
            await new Promise((resolve, reject) => {
                img.onload = resolve;
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
            
            const croppedBlob = await new Promise((resolve) => {
                canvas.toBlob(resolve, contentType, 0.9);
            });
            
            if (croppedBlob) {
                return new File([croppedBlob], finalName, { type: contentType });
            }
        }
        
        return new File([blob], finalName, { type: contentType });
    } catch (e) {
        console.error(e);
        return null; 
    }
};

const selectFetchedImage = async (url) => {
    const filename = url.split('/').pop().split('?')[0] || "downloaded.jpg";
    const file = await urlToFile(url, filename);
    if (file) {
        editGalleryBuffer.value.push(file);
        if (!actualMainPhoto.value.file && !editForm.imageId && !actualMainPhoto.value.url) {
            mainPhotoSelection.value = { type: 'new', val: editGalleryBuffer.value.length - 1 };
        }
    } else addToast({ type: 'error', message: "Could not download image." });
};

const analyzeExistingItem = async () => {
    if (!actualMainPhoto.value.url && !editForm.sourcingLocation && !scoutQuery.value && !editForm.title) {
        addToast({ type: 'warning', message: "Please provide a title, text, a photo, or a link to analyze." });
        return;
    }
    analyzing.value = true;
    analysisStatus.value = 'Preparing Images...';
    try {
        let base64Images = [];
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
            const reader = new FileReader(); reader.onload = (e) => img.src = e.target.result; reader.readAsDataURL(blob);
        });

        // 1. Process local/new camera buffer files
        const resizePromises = editGalleryBuffer.value.slice(0, 3).map(async (file) => {
            try { return await resize(file); } catch (e) { return null; }
        });
        const resizedLocal = (await Promise.all(resizePromises)).filter(img => img !== null);
        base64Images.push(...resizedLocal);
        
        // 2. Process existing Appwrite URLs (Pass URLs to backend instead of downloading!)
        const remoteUrls = [];
        if (editForm.existingGalleryIds) {
            for (const id of editForm.existingGalleryIds.slice(0, 3 - base64Images.length)) {
                let url = getAssetUrl(id);
                // Instead of proxying and downloading, pass the direct URL to the backend
                if (url) remoteUrls.push(url);
            }
        }
        
        // 3. Fallback to just main photo URL if somehow nothing was caught
        if (base64Images.length === 0 && remoteUrls.length === 0 && actualMainPhoto.value.url) {
            let url = actualMainPhoto.value.url;
            if (url.startsWith('data:')) {
                try { const res = await fetch(url); base64Images.push(await resize(await res.blob())); } catch (e) {}
            } else {
                remoteUrls.push(url);
            }
        }

        let contextNotes = editForm.description || '';
        if (scoutQuery.value) contextNotes = `User Query/Description: ${scoutQuery.value}\n\n` + contextNotes;
        if (editForm.title) contextNotes = `Current Title: ${editForm.title}\n\n` + contextNotes;
        if (editForm.sourcingLocation) contextNotes += `\n\nItem URL: ${editForm.sourcingLocation}`;

        // Clear previous results before starting new analysis
        scoutResult.value = null;
        scoutMdText.value = '';
        analysisStatus.value = 'Analyzing with AI...';

        const response = await fetch(`/api/identify-item`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                images: base64Images, 
                remoteImageUrls: remoteUrls,
                notes: contextNotes 
            })
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            if (errData.isRateLimit) {
                addToast({ type: 'warning', message: errData.details || errData.error });
                return;
            }
            throw new Error(errData.details || errData.error || "Analysis API failed");
        }
        
        const data = await response.json();
        if (data.items && data.items.length > 0) {
            if (data.items.length > 1) {
                scoutResult.value = data.items;
                let totalLow = 0, totalHigh = 0;
                let desc = `**LOT BREAKDOWN (${data.items.length} Items):**\n`;
                data.items.forEach((item, idx) => {
                    let raw = item.price_breakdown?.fair || item.price_breakdown?.mint, low = 0, high = 0;
                    if (typeof raw === 'object') {
                         low = parseFloat((raw.low || raw.min || raw.mint || 0).toString().replace(/,/g, ''));
                         high = parseFloat((raw.high || raw.max || raw.fair || low).toString().replace(/,/g, ''));
                    } else { 
                         const range = String(raw || '0').replace(/[$,]/g, '').trim().match(/(\d+(?:\.\d+)?)\s*(?:[-–—−]|to)\s*(\d+(?:\.\d+)?)/i);
                         if (range) { low = parseFloat(range[1]) || 0; high = parseFloat(range[2]) || 0; }
                         else { const single = String(raw || '0').replace(/[$,]/g, '').trim().match(/(\d+(?:\.\d+)?)/); if(single) { low = parseFloat(single[1]) || 0; high = low; } }
                    }
                    if (high < low) high = low; totalLow += low; totalHigh += high;
                    desc += `\n**${idx+1}. ${item.title || item.identity}** - Est: ${low === high ? `$${low.toFixed(2)}` : `$${low.toFixed(2)} - $${high.toFixed(2)}`}\n`;
                    if(item.condition_notes) desc += `- Condition: ${item.condition_notes}\n`;
                });
                scoutMdText.value = desc.trim();
            } else {
                scoutResult.value = data.items[0];
                const item = scoutResult.value;
                
                let report = `--- 🕵️ SCOUT REPORT ---\n`;
                if(item.condition_notes) report += `**Condition:** ${item.condition_notes}\n`;
                if(item.red_flags && item.red_flags.length > 0) report += `**🚩 Red Flags:** ${item.red_flags.join(', ')}\n`;
                if(item.price_breakdown) {
                    report += `**Valuation:** Mint: ${item.price_breakdown.mint}, Fair: ${item.price_breakdown.fair}, Poor: ${item.price_breakdown.poor}\n`;
                    if(item.price_breakdown.boutique_premium) report += `**Boutique Premium:** ${item.price_breakdown.boutique_premium}\n`;
                }
                if(item.comparables && item.comparables.length > 0) { report += `**Comparables:**\n`; item.comparables.forEach(c => report += `- ${c.name} (${c.price}) [${c.status}]\n`); }
                if(item.keywords && item.keywords.length > 0) report += `**Keywords:** ${item.keywords.join(', ')}\n`;
                scoutMdText.value = report.trim();
                
                // Note: We deliberately do NOT mutate editForm here.
                // The UI will detect scoutResult and display suggestion buttons.
            }
            descTab.value = 'edit';
        }
    } catch (e) { addToast({ type: 'error', message: "Analysis Error: " + e.message }); } finally { analyzing.value = false; analysisStatus.value = ''; }
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
    addToast({ type: 'success', message: 'Applied AI bundle suggestions to form.' });
};

const extractLotItems = async () => {
    const itemsToExtract = scoutItemsArray.value;
    if (!itemsToExtract || itemsToExtract.length === 0) return;
    
    // Confirm extraction
    if (!(await confirmDialog(`Are you sure you want to create ${itemsToExtract.length} new items from this lot?`, 'Extract Lot', 'Extract', 'Cancel'))) return;
    
    extractingLot.value = true;
    try {
        let successCount = 0;
        const user = await account.get();
        const teamId = localStorage.getItem('activeTeamId') || user.prefs?.teamId || null;
        
        // Loop over each item found by AI
        for (const [index, lotItem] of itemsToExtract.entries()) {
            
            // Build the core data for the new item
            const title = lotItem.title || lotItem.identity || lotItem.name || `Lot Item #${index + 1}`;
            let notes = lotItem.condition_notes || lotItem.condition || '';
            if (lotItem.red_flags?.length) {
                notes = `[FLAGS: ${lotItem.red_flags.join(', ')}]\n` + notes;
            }
            notes = `Extracted from Bulk Lot.\n` + notes;
            
            // Try to assign a portion of the total cost to each item (e.g. Total / Count)
            let apportionedCost = 0;
            if (editForm.cost && parseFloat(editForm.cost) > 0) {
                 apportionedCost = parseFloat((parseFloat(editForm.cost) / itemsToExtract.length).toFixed(2));
            }

            // Estimate Resale Price from AI
            let resalePrice = 0;
            if (lotItem.price_breakdown) {
                 resalePrice = getRationalPrice(lotItem);
            } else if (lotItem.estimated_value) {
                 resalePrice = parsePrice(lotItem.estimated_value);
            }
            
            // Figure out image inheritance
            let inheritedGallery = [];
            let mainImageId = null;
            if (editForm.existingGalleryIds && editForm.existingGalleryIds.length > 0) {
                 inheritedGallery = [...editForm.existingGalleryIds];
                 mainImageId = inheritedGallery[0];
            } else if (actualMainPhoto.value.id) {
                 inheritedGallery = [actualMainPhoto.value.id];
                 mainImageId = actualMainPhoto.value.id;
            }

            const extraData = {
                 cost: apportionedCost,
                 resalePrice: resalePrice ? resalePrice.toFixed(2) : undefined,
                 status: 'acquired', // New Workflow Status Standard
                 sourcingLocation: editForm.sourcingLocation || 'Bulk Lot',
                 orderId: editForm.orderId,
                 storageLocation: editForm.storageLocation,
                 imageId: mainImageId,
                 galleryImageIds: inheritedGallery,
                 scoutData: lotItem,
                 parentLotId: props.item.$id
            };
            
            // Save the item
            await saveItemToInventory(
                { title, identity: lotItem.identity || Math.random().toString(36).substring(2, 10), condition_notes: notes },
                null, // No new local file upload, we're passing gallery IDs above
                extraData,
                teamId
            );
            successCount++;
        }
        
        addToast({ type: 'success', message: `Successfully extracted ${successCount} items!` });
        // We can close drawer or leave open. We'll leave open so they can see the parent item still if they want to save changes to it.
        
    } catch (e) {
        addToast({ type: 'error', message: "Failed to extract lot: " + e.message });
        console.error(e);
    } finally {
         extractingLot.value = false;
    }
};

const lotChildren = ref([]);
const loadingLot = ref(false);

const lotSoldChildren = computed(() => lotChildren.value.filter(c => c.status === 'sold'));
const lotAllocatedCost = computed(() => lotChildren.value.reduce((sum, c) => sum + (Number(c.cost) || 0), 0));
const lotRealizedRevenue = computed(() => lotSoldChildren.value.reduce((sum, c) => sum + (Number(c.soldPrice) || 0), 0));
const lotROI = computed(() => lotRealizedRevenue.value - Number(props.item?.cost || 0));

const fetchLotChildren = async () => {
    if (!props.item || !props.item.$id) return;
    loadingLot.value = true;
    try {
        const res = await databases.listDocuments(DB_ID, getCollectionId(), [
            Query.equal('parentLotId', props.item.$id),
            Query.limit(100)
        ]);
        lotChildren.value = res.documents;
    } catch (e) {
        addToast({ type: 'error', message: "Failed to load lot items: " + e.message });
    } finally {
        loadingLot.value = false;
    }
};

watch(mainTab, (newVal) => {
    if (newVal === 'lot') {
        fetchLotChildren();
    }
});

const sellOneQuantity = async () => {
    if (!props.item || editForm.quantity <= 1) return;
    
    const unitSoldPriceRaw = window.prompt("How much did this 1 item sell for? (Enter a number)", 
        (parseFloat(editForm.resalePrice || 0) / editForm.quantity).toFixed(2));
    
    if (unitSoldPriceRaw === null) return;
    
    const unitSoldPrice = parseFloat(unitSoldPriceRaw);
    if (isNaN(unitSoldPrice)) {
        addToast({ type: 'error', message: 'Invalid sold price.' });
        return;
    }
    
    extractingLot.value = true;
    try {
        const user = await account.get();
        const teamId = localStorage.getItem('activeTeamId') || user.prefs?.teamId || null;
        
        const unitCost = parseFloat((parseFloat(editForm.cost || 0) / editForm.quantity).toFixed(2));
        const unitResale = parseFloat((parseFloat(editForm.resalePrice || 0) / editForm.quantity).toFixed(2));
        
        // 1. Figure out image inheritance
        let inheritedGallery = [];
        let mainImageId = null;
        if (editForm.existingGalleryIds && editForm.existingGalleryIds.length > 0) {
             inheritedGallery = [...editForm.existingGalleryIds];
             mainImageId = inheritedGallery[0];
        } else if (actualMainPhoto.value.id) {
             inheritedGallery = [actualMainPhoto.value.id];
             mainImageId = actualMainPhoto.value.id;
        }

        // 2. Create the Child "Sold" Item
        const childTitle = `${editForm.title} (Extracted 1/${editForm.quantity})`;
        const extraData = {
            cost: unitCost,
            resalePrice: unitResale,
            soldPrice: unitSoldPrice,
            status: 'sold',
            sourcingLocation: editForm.sourcingLocation,
            orderId: editForm.orderId,
            storageLocation: editForm.storageLocation,
            imageId: mainImageId, // Parent image ID
            existingGalleryIds: inheritedGallery, // Use existingGalleryIds so it's caught by inventory.ts
            quantity: 1,
            parentLotId: props.item.$id
        };
        
        await saveItemToInventory(
            { title: childTitle, identity: Math.random().toString(36).substring(2, 10), condition_notes: `Extracted 1 from Lot: ${props.item.$id}` },
            null,
            extraData,
            teamId
        );
        
        // 3. Update the Parent Item Form
        editForm.quantity -= 1;
        editForm.cost = Math.max(0, parseFloat(editForm.cost || 0) - unitCost).toFixed(2);
        editForm.resalePrice = Math.max(0, parseFloat(editForm.resalePrice || 0) - unitResale).toFixed(2);
        
        // 4. Emit Save to persist the parent changes
        saveEdit(); 
        
        addToast({ type: 'success', message: 'Successfully extracted 1 sold item!' });
    } catch (e) {
        addToast({ type: 'error', message: 'Failed to extract item: ' + e.message });
    } finally {
        extractingLot.value = false;
    }
};
</script>

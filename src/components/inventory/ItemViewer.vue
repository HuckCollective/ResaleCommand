<template>
    <div class="container mx-auto px-4 py-8 relative min-h-[80vh]">
        
        <div v-if="loading" class="flex flex-col items-center justify-center h-64 gap-4">
            <span class="loading loading-spinner loading-lg text-primary"></span>
            <p class="text-sm font-bold opacity-60 uppercase tracking-widest">Loading Item Details...</p>
        </div>

        <div v-else-if="error" class="alert alert-error shadow-lg max-w-xl mx-auto">
            <Icon icon="solar:danger-circle-linear" class="w-6 h-6 text-error" />
            <div>
                <h3 class="font-bold">Item Not Found or Unauthorized</h3>
                <div class="text-xs">{{ error }}</div>
            </div>
            <a href="/inventory" class="btn btn-sm">Return to Inventory</a>
        </div>

        <div v-else-if="item" class="w-full bg-base-100 rounded-2xl shadow-xl overflow-hidden border border-base-200">
            <!-- Header bar -->
            <div class="navbar bg-base-200 border-b border-base-300 min-h-12 px-6">
                <div class="flex-1 breadcrumbs text-sm font-bold opacity-70">
                    <ul>
                      <li><a href="/inventory">Inventory</a></li> 
                      <li>{{ item.$id.slice(-8) }}</li>
                    </ul>
                </div>
                <div class="flex-none gap-2 flex items-center">
                    <button v-if="item && (item.quantity > 1 || childItems.length > 0) && item.status !== 'sold' && !item.parentLotId" 
                            class="btn btn-xs btn-secondary font-bold shadow-sm"
                            @click="openUnpackModal">
                        <Icon icon="solar:box-minimalistic-linear" class="w-3.5 h-3.5 mr-1" /> Unpack Item
                    </button>
                    <button v-if="item && item.quantity >= 1 && item.status !== 'sold'" 
                            class="btn btn-xs btn-primary font-bold shadow-sm"
                            @click="openSellOneModal">
                        <Icon icon="solar:tag-linear" class="w-3.5 h-3.5 mr-1" /> Record Sale
                    </button>
                    <div class="dropdown dropdown-end">
                        <div tabindex="0" role="button" class="badge badge-lg font-bold uppercase truncate cursor-pointer hover:opacity-80 transition-opacity" :class="statusBadgeClass">
                            {{ statusText }}
                            <Icon icon="solar:alt-arrow-down-linear" class="ml-1 opacity-50" />
                        </div>
                        <ul tabindex="0" class="dropdown-content z-50 menu p-2 shadow-xl bg-base-100 rounded-box w-48 text-xs mt-2 font-bold border border-base-200">
                            <li><a @click="updateStatus('tracked')" :class="{'active': item.status === 'tracked'}">Tracked</a></li>
                            <li><a @click="updateStatus('acquired')" :class="{'active': item.status === 'acquired'}">Acquired</a></li>
                            <li><a @click="updateStatus('listed')" :class="{'active': item.status === 'listed'}">Listed</a></li>
                            <li><a @click="updateStatus('sold')" :class="{'active': item.status === 'sold'}">Sold</a></li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- Content Area - Replicates ItemPreviewModal Layout -->
            <div class="flex flex-col lg:flex-row w-full">
                <!-- Left Column: Media -->
                <div class="w-full lg:w-5/12 bg-base-300 border-r border-base-300 flex flex-col relative shrink-0">
                    <!-- Main Image Area (Carousel) -->
                    <div class="w-full aspect-square relative bg-base-200 flex items-center justify-center overflow-hidden group">
                        <!-- Carousel Container -->
                        <div v-if="gallery.length > 0" class="carousel w-full h-full snap-x snap-mandatory overflow-x-auto" ref="carouselRef" @scroll.passive="onCarouselScroll">
                            <div v-for="(img, i) in gallery" :key="i" :id="`preview-slide-${i}`" class="carousel-item relative w-full shrink-0 items-center justify-center snap-center">
                                <img :src="img" class="w-full h-full object-contain" draggable="false" />
                            </div>
                        </div>
                        <div v-else class="w-full h-full flex items-center justify-center">
                            <div class="text-6xl opacity-20"><Icon icon="solar:box-linear" class="mx-auto" /></div>
                        </div>
                        
                        <!-- Carousel Arrows -->
                        <div v-if="gallery.length > 1" class="absolute inset-x-2 top-1/2 flex -translate-y-1/2 justify-between opacity-0 sm:group-hover:opacity-100 transition-opacity pointer-events-none">
                            <button @click.prevent="prevImage" class="btn btn-circle btn-sm bg-base-100/80 hover:bg-base-100 border-none backdrop-blur shadow-md pointer-events-auto">❮</button>
                            <button @click.prevent="nextImage" class="btn btn-circle btn-sm bg-base-100/80 hover:bg-base-100 border-none backdrop-blur shadow-md pointer-events-auto">❯</button>
                        </div>
                        
                        <!-- Tags Overlay -->
                        <div class="absolute bottom-2 left-2 flex flex-wrap gap-1 z-10 pointer-events-none">
                             <span v-for="tag in (item.keywords || [])" :key="tag" class="badge badge-sm bg-base-100/80 backdrop-blur shadow-sm border-none">{{ tag }}</span>
                        </div>
                    </div>
                    
                    <!-- Thumbnail Gallery -->
                    <div class="p-2 flex gap-2 overflow-x-auto bg-base-200 border-t border-base-300" v-if="gallery.length > 1">
                        <button v-for="(img, i) in gallery" :key="i" 
                                @click="selectThumbnail(i)"
                                class="w-16 h-16 shrink-0 rounded border-2 overflow-hidden transition-all"
                                :class="selectedIndex === i ? 'border-primary shadow-sm' : 'border-transparent opacity-60 hover:opacity-100'">
                            <img :src="img" class="w-full h-full object-cover" />
                        </button>
                    </div>
                    
                    <!-- Pricing Summary Box under images on Desktop -->
                    <div class="p-6 bg-base-200 flex-1 flex-col justify-end hidden lg:flex border-t border-base-300">
                         <div class="bg-base-100 rounded-xl p-4 shadow-sm border border-base-300">
                             <div class="flex justify-between items-end mb-2">
                                <span class="text-xs uppercase font-bold opacity-60">Estimated Resale Value</span>
                                <span class="text-2xl font-black text-success tracking-tight">{{ formatCurrency(estValue) }}</span>
                             </div>
                             <div class="flex justify-between items-end mb-2">
                                <span class="text-xs uppercase font-bold opacity-60">Cost Basis</span>
                                <span class="text-lg font-bold opacity-80 font-mono">{{ formatCurrency(paidValue) }}</span>
                             </div>
                             <div v-if="item.quantity > 1" class="flex justify-between items-end mb-2 pb-3 border-b border-base-200 text-xs">
                                <span class="font-bold opacity-60">Quantity / Unit Cost</span>
                                <span class="opacity-80 font-mono">x{{ item.quantity }} ({{ formatCurrency(paidValue / item.quantity) }} each)</span>
                             </div>
                             <div v-else class="pb-3 border-b border-base-200 mb-3"></div>
                             <div class="flex justify-between items-center text-xs opacity-60 font-mono">
                                 <span>Max Buy Target:</span>
                                 <span>{{ formatCurrency(item.maxBuyPrice) }}</span>
                             </div>
                         </div>
                    </div>
                </div>

                <!-- Right Column: Details -->
                <div class="w-full lg:w-7/12 p-6 md:p-8 space-y-6 bg-base-100">
                    
                    <div>
                        <h1 class="text-3xl md:text-4xl font-bold leading-tight mb-2">{{ title }}</h1>
                        <div class="flex flex-wrap items-center gap-4 text-sm opacity-60 font-mono">
                            <span v-if="locationText" class="flex gap-1 items-center badge badge-outline">
                                <Icon icon="solar:map-point-linear" /> 
                                <a v-if="locationText.startsWith('http')" :href="locationText" target="_blank" class="text-primary underline decoration-primary/40 underline-offset-2 flex items-center gap-1 truncate max-w-50 md:max-w-100" :title="locationText">
                                    {{ locationText.replace(/^https?:\/\/(www\.)?/, '') }}
                                    <Icon icon="solar:external-link-linear" class="w-3 h-3 shrink-0" />
                                </a>
                                <span v-else>{{ locationText }}</span>
                            </span>
                            <span>ID: {{ item.$id }}</span>
                            <span v-if="item.sellingLocations && item.sellingLocations.length > 0" class="flex gap-1 items-center">
                                <span v-for="chan in item.sellingLocations" :key="chan" class="badge badge-sm">{{ chan }}</span>
                            </span>
                        </div>
                    </div>

                    <!-- Mobile Pricing Box (Hidden on Desktop) -->
                    <div class="lg:hidden bg-base-200 rounded-xl p-4 shadow-sm border border-base-300">
                        <div class="flex justify-between items-end mb-2">
                            <span class="text-xs uppercase font-bold opacity-60">Est. Resale</span>
                            <span class="text-xl font-black text-success">{{ formatCurrency(estValue) }}</span>
                        </div>
                        <div class="flex justify-between items-end mb-2">
                            <span class="text-xs uppercase font-bold opacity-60">Cost</span>
                            <span class="text-base font-bold opacity-80 font-mono">{{ formatCurrency(paidValue) }}</span>
                        </div>
                        <div v-if="item.quantity > 1" class="flex justify-between items-end mb-2 text-xs">
                            <span class="font-bold opacity-60">Qty / Unit Cost</span>
                            <span class="opacity-80 font-mono">x{{ item.quantity }} ({{ formatCurrency(paidValue / item.quantity) }} each)</span>
                        </div>
                        <div class="flex justify-between items-end pt-2 border-t border-base-300">
                            <span class="text-[10px] uppercase font-bold opacity-40">Max Buy Target</span>
                            <span class="text-sm font-bold opacity-60 font-mono">{{ formatCurrency(item.maxBuyPrice) }}</span>
                        </div>
                    </div>

                    <!-- Condition Notes -->
                    <div v-if="cleanConditionNotes" class="bg-warning/10 border-l-4 border-warning p-4 rounded-r-lg">
                        <h3 class="font-bold text-warning-content text-sm uppercase mb-1">Condition Notes</h3>
                        <p class="whitespace-pre-wrap text-sm leading-relaxed text-warning-content/80">{{ cleanConditionNotes }}</p>
                    </div>

                    <!-- Lot Reconciliation Dashboard -->
                    <!-- Inbound Lot Reconciliation Dashboard -->
                    <div v-if="(item && (item.quantity > 1 || childItems.length > 0)) || parentItem" class="mt-6 border border-base-300 rounded-2xl overflow-hidden bg-base-100 shadow-lg">
                        <div class="bg-base-200 p-4 border-b border-base-300 flex justify-between items-center">
                            <div>
                                <h3 class="font-bold text-sm uppercase tracking-wider text-base-content flex items-center gap-1.5">
                                    <Icon icon="solar:chart-square-linear" class="w-5 h-5 text-primary" />
                                    Inbound Lot Dashboard
                                </h3>
                                <p class="text-[10px] opacity-60 mt-0.5">Track cost allocation, sales, and total return on investment for this group purchase.</p>
                                <div v-if="parentItem" class="mt-2 text-xs">
                                    <span class="opacity-60 font-bold uppercase mr-2">Sourced From:</span>
                                    <a :href="'/item/' + parentItem.$id" class="link link-primary font-bold">{{ parentItem.title }}</a>
                                </div>
                            </div>
                            <span v-if="!parentItem" class="badge badge-primary font-mono text-xs font-bold">x{{ item.quantity }} Unsold</span>
                            <span v-else class="badge badge-primary font-mono text-xs font-bold">x{{ parentItem.quantity }} Unsold</span>
                        </div>

                        <!-- Summary Cards -->
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-px bg-base-300 border-b border-base-300">
                            <div class="bg-base-100 p-4 text-center">
                                <span class="text-[9px] font-bold opacity-60 uppercase block mb-1">Total Lot Cost</span>
                                <span class="font-mono font-black text-base">{{ formatCurrency(originalLotCost) }}</span>
                            </div>
                            <div class="bg-base-100 p-4 text-center">
                                <span class="text-[9px] font-bold opacity-60 uppercase block mb-1">Allocated to Sold</span>
                                <span class="font-mono font-bold text-base text-info">{{ formatCurrency(allocatedCost) }}</span>
                            </div>
                            <div class="bg-base-100 p-4 text-center">
                                <span class="text-[9px] font-bold opacity-60 uppercase block mb-1">Realized Sales</span>
                                <span class="font-mono font-black text-base text-success">{{ formatCurrency(realizedRevenue) }}</span>
                            </div>
                            <div class="bg-base-100 p-4 text-center" :class="lotProfit >= 0 ? 'bg-success/5' : 'bg-error/5'">
                                <span class="text-[9px] font-bold opacity-60 uppercase block mb-1">Net Lot ROI</span>
                                <span class="font-mono font-black text-base" :class="lotProfit >= 0 ? 'text-success' : 'text-error'">
                                    {{ lotProfit >= 0 ? '+' : '' }}{{ formatCurrency(lotProfit) }}
                                    <span class="text-xs font-normal opacity-70">({{ lotRoi }}%)</span>
                                </span>
                            </div>
                        </div>

                        <!-- Child Listings -->
                        <div class="p-4" v-if="childItems.length > 0">
                            <span class="text-[10px] font-bold uppercase opacity-50 tracking-wider block mb-2">Items linked to this lot ({{ childItems.length }})</span>
                            <div class="overflow-x-auto">
                                <table class="table table-xs w-full">
                                    <thead>
                                        <tr class="opacity-70">
                                            <th>Item Title</th>
                                            <th>Status</th>
                                            <th class="text-right">Unit Cost</th>
                                            <th class="text-right">Sale Price</th>
                                            <th class="text-right">Profit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="child in childItems" :key="child.$id" class="hover:bg-base-200/50 transition-colors">
                                            <td class="font-bold truncate max-w-50">
                                                <a :href="'/item/' + child.$id" class="text-primary hover:underline">{{ child.title }}</a>
                                            </td>
                                            <td>
                                                <span class="badge badge-xs badge-neutral uppercase font-bold">{{ child.status }}</span>
                                            </td>
                                            <td class="font-mono text-right opacity-80">{{ formatCurrency(child.cost) }}</td>
                                            <td class="font-mono text-right text-success font-bold">{{ formatCurrency(child.soldPrice) }}</td>
                                            <td class="font-mono text-right font-bold" :class="Number(child.soldPrice || 0) - Number(child.cost || 0) >= 0 ? 'text-success' : 'text-error'">
                                                ${{ (Number(child.soldPrice || 0) - Number(child.cost || 0)).toFixed(2) }}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div v-else class="p-6 text-center text-xs opacity-50 italic">
                            No child items have been split off or sold from this lot yet.
                        </div>
                    </div>

                    <!-- Scout Data Output -->
                    <div v-if="parsedScoutData" class="mt-4 bg-base-100 rounded-xl border border-base-200 shadow-sm text-base-content overflow-hidden">
                        <div class="bg-base-200/50 p-3 border-b border-base-200 text-xs font-bold uppercase opacity-60 flex justify-between items-center">
                            <span>AI Scout Report</span>
                            <span v-if="parsedScoutData.identity" class="truncate max-w-50 normal-case opacity-70">{{ parsedScoutData.identity }}</span>
                        </div>
                        <div class="p-4 space-y-4">
                            
                            <!-- Red Flags -->
                            <div v-if="parsedScoutData.red_flags && parsedScoutData.red_flags.length" class="bg-warning/20 border border-warning/50 rounded-lg p-3 text-warning-content text-sm flex gap-2 items-start shadow-inner">
                                <span class="text-error font-black mt-0.5">▶</span>
                                <div>
                                    <span class="font-bold mr-1">Flags:</span> 
                                    {{ parsedScoutData.red_flags.join('. ') }}
                                </div>
                            </div>

                            <!-- Notes -->
                            <div class="text-sm opacity-90" v-if="parsedScoutData.condition_notes">
                                <span class="font-bold opacity-70 block mb-1 uppercase text-[10px] tracking-widest">Analysis Notes</span> 
                                {{ parsedScoutData.condition_notes }}
                            </div>
                            
                            <!-- Pricing Grid -->
                            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4" v-if="parsedScoutData.price_breakdown">
                                <div class="flex flex-col items-center bg-base-200/60 p-2.5 rounded-xl border border-base-300 shadow-xs">
                                    <span class="badge badge-xs font-bold bg-success/20 text-success border-success/40 mb-1">MINT</span>
                                    <span class="font-mono font-black text-sm sm:text-base text-base-content">{{ parsedScoutData.price_breakdown.mint || '-' }}</span>
                                </div>
                                <div class="flex flex-col items-center bg-base-200/60 p-2.5 rounded-xl border border-primary/40 shadow-xs ring-1 ring-primary/20">
                                    <span class="badge badge-xs font-bold bg-primary/20 text-primary border-primary/40 mb-1">FAIR</span>
                                    <span class="font-mono font-black text-sm sm:text-base text-base-content">{{ parsedScoutData.price_breakdown.fair || '-' }}</span>
                                </div>
                                <div class="flex flex-col items-center bg-base-200/60 p-2.5 rounded-xl border border-base-300 shadow-xs">
                                    <span class="badge badge-xs font-bold bg-error/20 text-error border-error/40 mb-1">POOR</span>
                                    <span class="font-mono font-black text-sm sm:text-base text-base-content">{{ parsedScoutData.price_breakdown.poor || '-' }}</span>
                                </div>
                                <div v-if="parsedScoutData.price_breakdown.boutique_premium" class="flex flex-col items-center bg-base-200/60 p-2.5 rounded-xl border border-secondary/40 shadow-xs">
                                    <span class="badge badge-xs font-bold bg-secondary/20 text-secondary border-secondary/40 mb-1">BOUTIQUE</span>
                                    <span class="font-mono font-black text-sm sm:text-base text-base-content">{{ parsedScoutData.price_breakdown.boutique_premium || '-' }}</span>
                                </div>
                            </div>
                            
                            <!-- Comparables -->
                            <div v-if="parsedScoutData.comparables && parsedScoutData.comparables.length" class="mt-4 border-t border-base-200 pt-4">
                                 <div class="text-[10px] uppercase font-bold opacity-60 tracking-widest mb-2">Comps</div>
                                 <ul class="space-y-2">
                                     <li v-for="comp in parsedScoutData.comparables" :key="comp.name" class="flex justify-between items-center text-xs p-2 rounded-lg bg-base-200/50 border border-base-300 gap-2">
                                         <span class="font-medium text-base-content break-words flex-1">{{ comp.name }}</span>
                                         <span class="font-mono font-bold shrink-0 text-success text-right">{{ comp.price }}</span>
                                     </li>
                                 </ul>
                            </div>
                        </div>
                    </div>

                    <!-- Where to Sell / Platform Recommendations -->
                    <div class="mt-4 bg-base-100 rounded-xl border border-base-200 shadow-sm overflow-hidden text-base-content">
                        <div class="bg-base-200/60 p-3 border-b border-base-200 text-xs font-bold uppercase tracking-wider flex justify-between items-center gap-2">
                            <span class="flex items-center gap-1.5 text-primary">
                                <Icon icon="solar:shop-2-bold" class="w-4 h-4" />
                                Where to Sell (Channel Suggestions)
                            </span>
                            <span v-if="sellingRecommendation.velocity" class="inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[10px] bg-info/20 text-info border border-info/30">
                                ⚡ {{ sellingRecommendation.velocity }}
                            </span>
                        </div>
                        
                        <div class="p-4 space-y-3">
                            <!-- Top Platform & Rationale -->
                            <div class="bg-primary/10 border border-primary/25 rounded-xl p-3.5 flex flex-col gap-1.5">
                                <div class="text-[10px] uppercase font-bold text-primary tracking-wider flex items-center gap-1">
                                    <Icon icon="solar:shop-2-bold" class="w-3.5 h-3.5" /> Top Recommended Channel:
                                </div>
                                <div class="text-sm md:text-base font-extrabold text-base-content leading-snug break-words">
                                    {{ sellingRecommendation.bestPlatform }}
                                </div>
                                <p v-if="sellingRecommendation.rationale" class="text-xs opacity-85 leading-relaxed mt-0.5 whitespace-pre-wrap break-words text-base-content">
                                    {{ sellingRecommendation.rationale }}
                                </p>
                            </div>

                            <!-- Channel Comparison Cards (2-line layout with full channel name & readable badge) -->
                            <div v-if="sellingRecommendation.channels && sellingRecommendation.channels.length" class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                                <div v-for="(ch, cIdx) in sellingRecommendation.channels" :key="cIdx" class="bg-base-200/60 p-3.5 rounded-xl border border-base-300 flex flex-col justify-between space-y-2.5">
                                    <div class="space-y-1.5">
                                        <!-- Line 1: Full Channel Name -->
                                        <div class="font-extrabold text-sm text-base-content leading-snug break-words">
                                            {{ ch.name }}
                                        </div>
                                        <!-- Line 2: Recommendation Note / Strategy Pill -->
                                        <div v-if="ch.recommendation" class="text-xs text-base-content/85 leading-snug bg-base-100 p-2 rounded-lg border border-base-300 font-medium break-words">
                                            💡 {{ ch.recommendation }}
                                        </div>
                                        <div class="text-sm font-mono font-black text-success pt-0.5">
                                            {{ ch.est_price || '-' }}
                                        </div>
                                    </div>
                                    <div class="text-xs opacity-80 flex justify-between items-center border-t border-base-300 pt-2 font-mono">
                                        <span>Net Payout:</span>
                                        <span class="font-bold text-base-content">{{ ch.net_payout || '-' }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Description / Scout Report -->
                    <div v-if="item.description" class="prose prose-sm max-w-none prose-headings:font-bold prose-headings:mt-4 prose-a:text-primary pb-8">
                        <div class="divider text-xs uppercase opacity-50 font-bold tracking-widest mt-0">Full Details</div>
                        <div v-html="renderedDescription" class="whitespace-pre-wrap"></div>
                    </div>
                    <div v-if="scoutMarkdownText" class="prose prose-sm max-w-none prose-headings:font-bold prose-headings:mt-4 prose-a:text-primary pb-8">
                        <div class="divider text-xs uppercase opacity-50 font-bold tracking-widest mt-0">AI Scout Report</div>
                        <div v-html="scoutMarkdownText" class="whitespace-pre-wrap"></div>
                    </div>
                    <div v-if="!item.description && !scoutMarkdownText" class="text-center py-12 opacity-40">
                        <p class="italic text-lg">No additional description available.</p>
                    </div>
                </div>
            </div>

            <!-- Sticky Bottom Dock: DaisyUI Dock Specification -->
            <div class="dock dock-bottom sticky bottom-0 z-30 bg-base-200/95 backdrop-blur-md border-t border-base-300">
                <button type="button" @click="copyShareLink" title="Share Item Link">
                    <Icon icon="solar:link-linear" class="w-5 h-5 mb-0.5" />
                    <span class="dock-label">Share</span>
                </button>

                <a v-if="user" :href="'/inventory?edit=' + item.$id" class="text-primary font-bold" title="Edit Inventory Item">
                    <Icon icon="solar:pen-bold" class="w-5 h-5 mb-0.5" />
                    <span class="dock-label">Edit</span>
                </a>

                <a href="/inventory" title="Return to Inventory">
                    <Icon icon="solar:box-minimalistic-linear" class="w-5 h-5 mb-0.5" />
                    <span class="dock-label">Inventory</span>
                </a>
            </div>
        </div>
    </div>

    <!-- SELL ONE MODAL -->
    <dialog id="sell_one_modal" class="modal" :class="{ 'modal-open': isSellOneModalOpen }">
        <div class="modal-box bg-base-100 p-6 border border-base-200 relative">
            <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" @click="closeSellOneModal">✕</button>
            <h3 class="font-bold text-lg flex items-center gap-2"><Icon icon="solar:tag-linear" class="text-primary w-5 h-5" /> Record Sale</h3>
            <p class="text-xs opacity-70 mt-1">If this is a multi-quantity item, this will split off the sold quantity into a separate sold record.</p>
            
            <div class="grid grid-cols-2 gap-4 mt-4">
                <div class="form-control w-full">
                    <label class="label"><span class="label-text font-bold text-xs uppercase opacity-75">Sold Item Title</span></label>
                    <input v-model="sellOneForm.title" type="text" class="input input-bordered w-full font-bold" placeholder="e.g. Harry Potter Book 1" />
                </div>
                <div class="form-control w-full">
                    <label class="label"><span class="label-text font-bold text-xs uppercase opacity-75">Quantity Sold</span></label>
                    <input v-model="sellOneForm.quantity" type="number" step="1" min="1" :max="item?.quantity || 1" class="input input-bordered w-full font-bold" />
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4 mt-4">
                <div class="form-control">
                    <label class="label"><span class="label-text font-bold text-xs uppercase opacity-75">Sold Price</span></label>
                    <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 opacity-50">$</span>
                        <input v-model="sellOneForm.soldPrice" type="number" step="0.01" class="input input-bordered w-full pl-7 font-mono font-bold text-success" placeholder="0.00" />
                    </div>
                </div>
                <div class="form-control">
                    <label class="label"><span class="label-text font-bold text-xs uppercase opacity-75">Commission / Fees</span></label>
                    <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 opacity-50">$</span>
                        <input v-model="sellOneForm.commissionPaid" type="number" step="0.01" class="input input-bordered w-full pl-7 font-mono font-bold text-error" placeholder="0.00" />
                    </div>
                </div>
            </div>

            <div class="modal-action mt-6">
                <button class="btn btn-ghost btn-sm" @click="closeSellOneModal" :disabled="submittingSellOne">Cancel</button>
                <button class="btn btn-primary btn-sm shadow-md" @click="submitSellOne" :disabled="submittingSellOne || !sellOneForm.title || !sellOneForm.soldPrice">
                    <span v-if="submittingSellOne" class="loading loading-spinner loading-xs mr-1"></span>
                    Confirm Sale
                </button>
            </div>
        </div>
        <form method="dialog" class="modal-backdrop">
            <button @click="closeSellOneModal">close</button>
        </form>
    </dialog>

    <!-- UNPACK MODAL -->
    <dialog id="unpack_modal" class="modal" :class="{ 'modal-open': isUnpackModalOpen }">
        <div class="modal-box bg-base-100 p-6 border border-base-200 relative">
            <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" @click="closeUnpackModal">✕</button>
            <h3 class="font-bold text-lg flex items-center gap-2"><Icon icon="solar:box-minimalistic-linear" class="text-secondary w-5 h-5" /> Unpack Distinct Item</h3>
            <p class="text-xs opacity-70 mt-1">Split a distinct item out of this lot. The allocated cost will be deducted from this main lot's cost.</p>
            
            <div class="form-control w-full mt-4">
                <label class="label"><span class="label-text font-bold text-xs uppercase opacity-75">New Item Title</span></label>
                <input v-model="unpackForm.title" type="text" class="input input-bordered w-full font-bold" placeholder="e.g. Rare Vintage Magazine Issue #1" />
            </div>

            <div class="grid grid-cols-2 gap-4 mt-4">
                <div class="form-control">
                    <label class="label"><span class="label-text font-bold text-xs uppercase opacity-75">Allocated Cost</span></label>
                    <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 opacity-50">$</span>
                        <input v-model="unpackForm.cost" type="number" step="0.01" class="input input-bordered w-full pl-7 font-mono font-bold" placeholder="0.00" />
                    </div>
                </div>
                <div class="form-control">
                    <label class="label"><span class="label-text font-bold text-xs uppercase opacity-75">Quantity Pulled</span></label>
                    <input v-model="unpackForm.quantity" type="number" step="1" min="1" class="input input-bordered w-full font-mono font-bold" />
                </div>
            </div>

            <div class="modal-action mt-6">
                <button class="btn btn-ghost btn-sm" @click="closeUnpackModal" :disabled="submittingUnpack">Cancel</button>
                <button class="btn btn-secondary btn-sm shadow-md" @click="submitUnpack" :disabled="submittingUnpack || !unpackForm.title">
                    <span v-if="submittingUnpack" class="loading loading-spinner loading-xs mr-1"></span>
                    Unpack Item
                </button>
            </div>
        </div>
        <form method="dialog" class="modal-backdrop">
            <button @click="closeUnpackModal">close</button>
        </form>
    </dialog>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { marked } from 'marked';
import { databases, Query, ID } from '../../lib/appwrite';
import { Permission, Role } from 'appwrite';
import { isAlphaMode } from '../../stores/env';
import { Icon } from '@iconify/vue';

const props = defineProps({
    itemId: { type: String, required: true }
});

const item = ref(null);
const loading = ref(true);
const error = ref(null);

const selectedIndex = ref(0);
const carouselRef = ref(null);
let isProgrammaticScroll = false;

const ENDPOINT = import.meta.env.PUBLIC_APPWRITE_ENDPOINT;
const PROJECT = import.meta.env.PUBLIC_APPWRITE_PROJECT_ID;
import { BUCKET_ID, REPORTS_BUCKET_ID } from '../../lib/inventory';
const BUCKET = BUCKET_ID;
const REPORTS_BUCKET = REPORTS_BUCKET_ID;

const childItems = ref([]);
const parentItem = ref(null);

// Sell One Form state
const isSellOneModalOpen = ref(false);
const submittingSellOne = ref(false);
const sellOneForm = reactive({
    title: '',
    soldPrice: '',
    commissionPaid: '0',
    quantity: 1
});

import { reactive } from 'vue';

const openSellOneModal = () => {
    sellOneForm.title = item.value ? `${item.value.title}` : '';
    sellOneForm.soldPrice = '';
    sellOneForm.commissionPaid = '0';
    sellOneForm.quantity = 1;
    isSellOneModalOpen.value = true;
};

const closeSellOneModal = () => {
    isSellOneModalOpen.value = false;
};

const submitSellOne = async () => {
    if (submittingSellOne.value || !item.value) return;
    submittingSellOne.value = true;
    try {
        const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
        const collId = isAlphaMode.get() 
            ? (import.meta.env.PUBLIC_APPWRITE_ALPHA_COLLECTION_ID || 'alpha_items') 
            : (import.meta.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items');
        
        const qty = item.value.quantity || 1;
        const totalCost = Number(item.value.cost || 0);
        const unitCost = qty > 0 ? (totalCost / qty) : totalCost;
        
        const soldQty = parseInt(sellOneForm.quantity) || 1;
        const costOfSold = unitCost * soldQty;
        
        const newQty = Math.max(0, qty - soldQty);
        const newCost = Math.max(0, totalCost - costOfSold);
        
        // If they sold EVERYTHING in this record, just update this record instead of splitting
        if (newQty === 0) {
            await databases.updateDocument(DB_ID, collId, item.value.$id, {
                status: 'sold',
                soldPrice: parseFloat(sellOneForm.soldPrice) || 0,
                commissionPaid: parseFloat(sellOneForm.commissionPaid) || 0,
                title: sellOneForm.title
            });
            isSellOneModalOpen.value = false;
            window.location.reload();
            return;
        }
        
        const childDoc = {
            title: sellOneForm.title,
            identity: sellOneForm.title,
            conditionNotes: `Sold from Multi-Quantity: ${item.value.title} (${item.value.$id})`,
            status: 'sold',
            cost: costOfSold,
            soldPrice: parseFloat(sellOneForm.soldPrice) || 0,
            commissionPaid: parseFloat(sellOneForm.commissionPaid) || 0,
            parentLotId: item.value.$id,
            quantity: soldQty,
            tenantId: item.value.tenantId || null,
            userId: item.value.userId || null,
            storageLocation: item.value.storageLocation || null,
            sourcingLocation: "", // Clear sourcing location for child
            imageId: item.value.imageId || null // Use parent image for the sold record
        };
        
        Object.keys(childDoc).forEach(key => childDoc[key] === undefined && delete childDoc[key]);
        
        // Update Parent
        await databases.updateDocument(DB_ID, collId, item.value.$id, {
            quantity: newQty,
            cost: newCost
        });
        
        // Permissions
        let permissions = undefined;
        if (item.value.tenantId && item.value.tenantId !== 'default') {
            const role = Role.team(item.value.tenantId);
            permissions = [
                Permission.read(role),
                Permission.update(role),
                Permission.delete(role),
            ];
        } else if (item.value.userId) {
            const role = Role.user(item.value.userId);
            permissions = [
                Permission.read(role),
                Permission.update(role),
                Permission.delete(role),
            ];
        }

        // Create Sold Child Document
        await databases.createDocument(DB_ID, collId, ID.unique(), childDoc, permissions);
        
        isSellOneModalOpen.value = false;
        window.location.reload();
    } catch (err) {
        console.error("Sell One failed:", err);
        alert("Failed to submit sale: " + err.message);
    } finally {
        submittingSellOne.value = false;
    }
};

// Unpack Item Form state
const isUnpackModalOpen = ref(false);
const submittingUnpack = ref(false);
const unpackForm = reactive({
    title: '',
    cost: '',
    quantity: 1
});

const openUnpackModal = () => {
    unpackForm.title = '';
    
    // Auto-calculate remaining unit cost if applicable
    const qty = item.value?.quantity || 1;
    const totalCost = Number(item.value?.cost || 0);
    const unitCost = qty > 0 ? (totalCost / qty) : 0;
    unpackForm.cost = unitCost.toFixed(2);
    unpackForm.quantity = 1;
    isUnpackModalOpen.value = true;
};

const closeUnpackModal = () => {
    isUnpackModalOpen.value = false;
};

const submitUnpack = async () => {
    if (submittingUnpack.value || !item.value) return;
    submittingUnpack.value = true;
    try {
        const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
        const collId = isAlphaMode.get() 
            ? (import.meta.env.PUBLIC_APPWRITE_ALPHA_COLLECTION_ID || 'alpha_items') 
            : (import.meta.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items');
        
        const parentQty = item.value.quantity || 1;
        const totalCost = Number(item.value.cost || 0);
        
        const pulledQty = parseInt(unpackForm.quantity) || 1;
        const pulledCost = parseFloat(unpackForm.cost) || 0;
        
        const newParentQty = Math.max(0, parentQty - pulledQty);
        const newParentCost = Math.max(0, totalCost - pulledCost);
        
        const childDoc = {
            title: unpackForm.title,
            identity: unpackForm.title,
            conditionNotes: `Unpacked from Lot: ${item.value.title} (${item.value.$id})`,
            status: 'acquired', // It's just acquired, not sold yet
            cost: pulledCost,
            parentLotId: item.value.$id,
            quantity: pulledQty,
            tenantId: item.value.tenantId || null,
            userId: item.value.userId || null,
            storageLocation: item.value.storageLocation || null,
            sourcingLocation: item.value.sourcingLocation || null,
            imageId: item.value.imageId || null,
            purchaseId: item.value.purchaseId || null
        };
        
        Object.keys(childDoc).forEach(key => childDoc[key] === undefined && delete childDoc[key]);
        
        // Update Parent
        await databases.updateDocument(DB_ID, collId, item.value.$id, {
            quantity: newParentQty,
            cost: newParentCost
        });
        
        // Permissions
        let permissions = undefined;
        if (item.value.tenantId && item.value.tenantId !== 'default') {
            const role = Role.team(item.value.tenantId);
            permissions = [
                Permission.read(role),
                Permission.update(role),
                Permission.delete(role),
            ];
        } else if (item.value.userId) {
            const role = Role.user(item.value.userId);
            permissions = [
                Permission.read(role),
                Permission.update(role),
                Permission.delete(role),
            ];
        }

        // Create Unpacked Child Document
        await databases.createDocument(DB_ID, collId, ID.unique(), childDoc, permissions);
        
        isUnpackModalOpen.value = false;
        window.location.reload();
    } catch (err) {
        console.error("Unpack failed:", err);
        alert("Failed to submit unpack: " + err.message);
    } finally {
        submittingUnpack.value = false;
    }
};

const dashboardItem = computed(() => parentItem.value || item.value);

const originalLotCost = computed(() => {
    if (!dashboardItem.value) return 0;
    return Number(dashboardItem.value.cost || 0) + childItems.value.reduce((acc, c) => acc + Number(c.cost || 0), 0);
});

const allocatedCost = computed(() => {
    return childItems.value.reduce((acc, c) => acc + Number(c.cost || 0), 0);
});

const realizedRevenue = computed(() => {
    return childItems.value.reduce((acc, c) => acc + Number(c.soldPrice || 0), 0);
});

const lotProfit = computed(() => {
    return realizedRevenue.value - originalLotCost.value;
});

const lotRoi = computed(() => {
    const cost = originalLotCost.value;
    if (cost <= 0) return 0;
    return Math.round((lotProfit.value / cost) * 100);
});

onMounted(async () => {
    loading.value = true;
    error.value = null;
    try {
        const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
        const collId = isAlphaMode.get() 
            ? (import.meta.env.PUBLIC_APPWRITE_ALPHA_COLLECTION_ID || 'alpha_items') 
            : (import.meta.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items');
            
        item.value = await databases.getDocument(DB_ID, collId, props.itemId);
        await loadScoutData(item.value);
        
        // Fetch child items if any exist
        try {
            const targetParentId = item.value.parentLotId || item.value.$id;
            
            // If this is a child item, fetch the parent
            if (item.value.parentLotId) {
                try {
                    parentItem.value = await databases.getDocument(DB_ID, collId, item.value.parentLotId);
                } catch (e) {
                    console.error("Failed to load parent item:", e);
                }
            }

            const childRes = await databases.listDocuments(DB_ID, collId, [
                Query.equal('parentLotId', targetParentId),
                Query.limit(100)
            ]);
            childItems.value = childRes.documents;
        } catch (err) {
            console.error("Failed to fetch child items:", err);
        }
        
    } catch (err) {
        console.error("Failed to load item:", err);
        error.value = err.message || "Could not fetch this item. You may not have access, or it was deleted.";
    } finally {
        loading.value = false;
    }
});

const scrollToSlide = (index) => {
    if (!carouselRef.value) return;
    const slides = carouselRef.value.children;
    if (slides[index]) {
        isProgrammaticScroll = true;
        carouselRef.value.scrollTo({
            left: index * carouselRef.value.clientWidth,
            behavior: 'smooth'
        });
        setTimeout(() => { isProgrammaticScroll = false; }, 400);
    }
};

const nextImage = () => {
    if (gallery.value.length <= 1) return;
    const nextIdx = (selectedIndex.value + 1) % gallery.value.length;
    selectedIndex.value = nextIdx;
    scrollToSlide(nextIdx);
};

const prevImage = () => {
    if (gallery.value.length <= 1) return;
    const prevIdx = (selectedIndex.value - 1 + gallery.value.length) % gallery.value.length;
    selectedIndex.value = prevIdx;
    scrollToSlide(prevIdx);
};

let scrollTimeout;
const onCarouselScroll = () => {
    if (!carouselRef.value || isProgrammaticScroll) return;
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        const scrollLeft = carouselRef.value.scrollLeft;
        const width = carouselRef.value.clientWidth;
        const index = Math.round(scrollLeft / width);
        if (index !== selectedIndex.value && index >= 0 && index < gallery.value.length) {
            selectedIndex.value = index;
        }
    }, 50);
};

const selectThumbnail = (index) => {
    selectedIndex.value = index;
    scrollToSlide(index);
};

// --- COMPUTED CONTENT ---
const title = computed(() => item.value?.title || item.value?.identity || item.value?.itemName || "Untitled Item");
const locationText = computed(() => item.value?.storageLocation || item.value?.sourcingLocation || '');

const statusText = computed(() => {
    const s = item.value?.status || 'Active';
    return s.replace(/_/g, ' ');
});

const statusBadgeClass = computed(() => {
    const s = item.value?.status;
    if (s === 'received' || s === 'scouted') return 'bg-info/20 text-info border border-info/40 font-bold';
    if (s === 'acquired') return 'bg-secondary/20 text-secondary border border-secondary/40 font-bold';
    if (s === 'placed') return 'bg-success/20 text-success border border-success/40 font-bold';
    if (s === 'sold') return 'bg-neutral/30 text-base-content/80 border border-base-300 font-bold';
    return 'bg-base-200 text-base-content/80 border border-base-300 font-bold';
});

const updatingStatus = ref(false);
const updateStatus = async (newStatus) => {
    if (updatingStatus.value || !item.value) return;
    updatingStatus.value = true;
    try {
        const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
        const collId = isAlphaMode.get() 
            ? (import.meta.env.PUBLIC_APPWRITE_ALPHA_COLLECTION_ID || 'alpha_items') 
            : (import.meta.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items');
            
        await databases.updateDocument(DB_ID, collId, item.value.$id, { status: newStatus });
        item.value.status = newStatus;
    } catch (err) {
        console.error("Failed to update status:", err);
        alert("Failed to update status: " + err.message);
    } finally {
        updatingStatus.value = false;
    }
};

const renderedDescription = computed(() => {
    if (!item.value?.description) return '';
    return marked.parse(item.value.description);
});

const cleanConditionNotes = computed(() => {
    if (!item.value?.conditionNotes) return '';
    let text = item.value.conditionNotes;
    text = text.replace(/\[GALLERY IDS:.*?\n/g, '');
    text = text.replace(/\[SCOUT_REPORT_ID:.*?\]/g, '');
    text = text.replace(/\[SCOUT_REPORT_MD:.*?\]/g, '');
    text = text.replace(/\[MAIN IMAGE ID:.*?\]/g, '');
    text = text.replace(/\[SCOUT_DATA_LITE:.*?\]/g, '');
    text = text.replace(/\[SCOUT_DATA:.*?\]/g, '');
    text = text.replace(/--- IMPORT DETAILS ---[\s\S]*/, '');
    const scraperBlock = /Paid:[\s\S]*?Est\. High:.*?\n/i;
    text = text.replace(scraperBlock, '');
    return text.trim();
});

const parsedScoutData = ref(null);
const scoutMarkdownText = ref(null);

const loadScoutData = async (currentItem) => {
    parsedScoutData.value = null;
    scoutMarkdownText.value = null;
    if (!currentItem) return;

    if (currentItem.scoutData) {
        let raw = currentItem.scoutData;
        if (typeof raw === 'object') {
            parsedScoutData.value = Array.isArray(raw) ? raw[0] : raw;
            return;
        }
        try { 
            let parsed = JSON.parse(raw);
            parsedScoutData.value = Array.isArray(parsed) ? parsed[0] : parsed;
            return;
        } catch (e) { }
    }

    if (currentItem.conditionNotes) {
        const mdMatch = currentItem.conditionNotes.match(/\[SCOUT_REPORT_MD:\s*([^\]]+)\]/);
        if (mdMatch) {
            const id = mdMatch[1].trim();
            const downloadUrl = `${ENDPOINT}/storage/buckets/${REPORTS_BUCKET}/files/${id}/download?project=${PROJECT}`;
            try {
                const res = await fetch(downloadUrl);
                if (res.ok) {
                    const txt = await res.text();
                    scoutMarkdownText.value = marked.parse(txt);
                }
            } catch (e) { console.warn("Failed to fetch scout md report", e); }
        }

        const fileMatch = currentItem.conditionNotes.match(/\[SCOUT_REPORT_ID:\s*([^\]]+)\]/);
        if (fileMatch) {
            const fileId = fileMatch[1].trim();
            const downloadUrl = `${ENDPOINT}/storage/buckets/${REPORTS_BUCKET}/files/${fileId}/download?project=${PROJECT}`;
            try {
                const res = await fetch(downloadUrl);
                if (res.ok) {
                    const data = await res.json();
                    parsedScoutData.value = Array.isArray(data) ? data[0] : (data.items ? data.items[0] : data);
                    return;
                }
            } catch (e) { console.warn("Failed to fetch scout file", e); }
        }
        
        const liteMatch = currentItem.conditionNotes.match(/\[SCOUT_DATA_LITE:\s*([^\]]+)\]/);
        if (liteMatch) {
            try { parsedScoutData.value = JSON.parse(atob(liteMatch[1])); return; } catch(e) {}
        }
        const dataMatch = currentItem.conditionNotes.match(/\[SCOUT_DATA:\s*([^\]]+)\]/);
        if (dataMatch) {
            try { parsedScoutData.value = JSON.parse(atob(dataMatch[1])); return; } catch(e) {}
        }
    }
    
    if (currentItem.rawAnalysis) {
         try {
             const parsed = JSON.parse(currentItem.rawAnalysis);
             parsedScoutData.value = Array.isArray(parsed) ? parsed[0] : (parsed.items ? parsed.items[0] : parsed);
         } catch (e) {}
    }
};

// --- PRICING ---
const getNoteValue = (notes, key, isCurrency = false) => {
    if (!notes) return null;
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${escapedKey}[:\\s]*([^\\n\\r]+)`, 'i');
    const match = notes.match(regex);
    if (match) {
        let val = match[1].trim();
        if (isCurrency) val = val.replace('$', '').trim();
        return val;
    }
    return null;
};

const parsePriceObj = (p) => {
    if (!p) return 0;
    if (typeof p === 'number') return p;
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

const estValue = computed(() => {
    if (!item.value) return 0;
    if (item.value.resalePrice && parseFloat(item.value.resalePrice) > 0) return item.value.resalePrice;
    
    // Prefer AI data if available
    if (parsedScoutData.value && parsedScoutData.value.price_breakdown) {
         let p = parsedScoutData.value.price_breakdown;
         let fair = parsePriceObj(p.fair);
         if (fair > 0) return fair;
         let mint = parsePriceObj(p.mint);
         if (mint > 0) return mint;
    }

    if (item.value.estHigh && parseFloat(parsePriceObj(item.value.estHigh)) > 0) return parsePriceObj(item.value.estHigh);
    return getNoteValue(item.value.conditionNotes, 'Est. High', true) || 0;
});

const paidValue = computed(() => {
    if (!item.value) return 0;
    if (item.value.cost && parseFloat(item.value.cost) > 0) return item.value.cost;
    if (item.value.purchasePrice && parseFloat(item.value.purchasePrice) > 0) return item.value.purchasePrice;
    return getNoteValue(item.value.conditionNotes, 'Paid', true) || 0;
});

const formatCurrency = (val) => {
    if(!val) return '-';
    // Prevent dates from being parsed as millions of dollars
    if (String(val).match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/)) return '-';
    
    const cleanStr = String(val).replace(/[^\d.-]/g, ''); 
    const num = parseFloat(cleanStr);
    return (isNaN(num) || num === 0) ? '-' : '$' + num.toFixed(2);
};

// --- IMAGES ---
const proxify = (url) => {
    if (!url) return null;
    if (typeof url !== 'string') return url;
    if (url.startsWith('blob:') || url.startsWith('data:') || url.includes('/api/proxy-image')) return url;
    if (url.includes('/storage/buckets/')) return url;
    if (url.startsWith('http')) return `/api/proxy-image?url=${encodeURIComponent(url)}`;
    return url;
};

const getAssetUrl = (id) => {
    if (!id) return '';
    if (typeof id === 'string' && (id.startsWith('http') || id.startsWith('data:') || id.startsWith('blob:') || id.startsWith('/api/'))) {
        return proxify(id);
    }
    return `${ENDPOINT}/storage/buckets/${BUCKET}/files/${id}/view?project=${PROJECT}`;
};

const gallery = computed(() => {
    if (!item.value) return [];
    
    if (item.value.galleryImageIds && item.value.galleryImageIds.length > 0) {
        return item.value.galleryImageIds.map(id => {
            if (id.startsWith('http')) return proxify(id);
            return getAssetUrl(id);
        });
    }
    
    if (item.value.imageId) {
        const id = item.value.imageId;
        return [id.startsWith('http') ? proxify(id) : getAssetUrl(id)];
    }
    
    return [];
});

const sellingRecommendation = computed(() => {
    // 1. If explicit market_report exists on parsedScoutData
    if (parsedScoutData.value?.market_report) {
        const mr = parsedScoutData.value.market_report;
        return {
            bestPlatform: mr.best_platform || 'Physical Booth & Fashion Marketplace',
            rationale: mr.platform_rationale || '',
            velocity: mr.sell_through_velocity || 'Moderate (2-4 weeks)',
            channels: mr.channels || []
        };
    }

    // 2. Dynamic category & fashion intelligence
    const est = Number(estValue.value) || 0;
    const boutique = parsedScoutData.value?.price_breakdown?.boutique_premium;
    const isHighBoutique = !!boutique || est >= 35;
    const t = (title.value || '').toLowerCase();
    const notes = (cleanConditionNotes.value || '').toLowerCase();
    const allText = `${t} ${notes}`;

    // Specialized Market Detection
    const isVintage = allText.includes('vintage') || allText.includes('90s') || allText.includes('80s') || allText.includes('y2k') || allText.includes('retro') || allText.includes('grunge');
    const isStreetwearOrTee = allText.includes('streetwear') || allText.includes('tee') || allText.includes('t-shirt') || allText.includes('hoodie') || allText.includes('sweatshirt') || allText.includes('skate');
    const isMensOrWorkwear = allText.includes('carhartt') || allText.includes('workwear') || allText.includes('mens') || allText.includes('denim') || allText.includes('jacket') || allText.includes('leather');
    const isWomensOrContemporary = allText.includes('dress') || allText.includes('skirt') || allText.includes('lululemon') || allText.includes('blouse') || allText.includes('purse') || allText.includes('handbag') || allText.includes('shoes') || allText.includes('heels') || allText.includes('boots');
    const isLuxuryDesigner = allText.includes('gucci') || allText.includes('prada') || allText.includes('louis vuitton') || allText.includes('designer') || allText.includes('chanel') || allText.includes('coach');
    const isMediaOrElectronics = t.includes('dvd') || t.includes('game') || t.includes('card') || t.includes('electronic') || t.includes('camera') || t.includes('audio');

    let bestPlatform = 'Physical Booth / Consignment (Memory Den)';
    let rationale = 'High visual appeal and tactile presence makes this ideal for booth retail with 10% commission and zero shipping cost.';
    let velocity = 'Moderate (2-4 weeks)';
    let channels = [];

    if (isVintage && (isStreetwearOrTee || isMensOrWorkwear)) {
        bestPlatform = 'Depop / Grailed (Streetwear & Vintage)';
        rationale = 'Depop offers 0% seller fees and massive Gen Z/Y2K buyer demand, while Grailed targets high-paying menswear and vintage workwear enthusiasts.';
        velocity = 'Fast (< 10 days)';
        channels = [
            {
                name: 'Depop (Vintage/Y2K)',
                est_price: est > 0 ? `$${(est * 1.1).toFixed(2)}` : '$30 - $55',
                net_payout: est > 0 ? `~$${(est * 1.1 * 0.97).toFixed(2)} (0% seller fee)` : '~97% net',
                recommendation: 'Top Trend Platform'
            },
            {
                name: 'Grailed (Menswear)',
                est_price: est > 0 ? `$${(est * 1.15).toFixed(2)}` : '$35 - $65',
                net_payout: est > 0 ? `~$${(est * 1.15 * 0.88).toFixed(2)} (9% fee)` : '~88% net',
                recommendation: 'High-Value Buyers'
            },
            {
                name: 'Memory Den (Physical Booth)',
                est_price: boutique || (est > 0 ? `$${(est * 1.2).toFixed(2)}` : '$35 - $60'),
                net_payout: est > 0 ? `~$${(est * 1.2 * 0.9).toFixed(2)} (10% comm)` : '~90% net',
                recommendation: 'Zero Shipping Hassle'
            },
            {
                name: 'eBay Online',
                est_price: est > 0 ? `$${est.toFixed(2)}` : '$25 - $40',
                net_payout: est > 0 ? `~$${(est * 0.87).toFixed(2)} (13% fee)` : '~87% net',
                recommendation: 'Broad Liquidity'
            }
        ];
    } else if (isLuxuryDesigner) {
        bestPlatform = 'The RealReal / Grailed / Poshmark';
        rationale = 'High-end designer pieces achieve peak value on authenticated luxury marketplaces and curated fashion collector platforms.';
        velocity = 'Moderate (2-3 weeks)';
        channels = [
            {
                name: 'Grailed / Poshmark',
                est_price: est > 0 ? `$${(est * 1.15).toFixed(2)}` : '$75 - $150',
                net_payout: est > 0 ? `~$${(est * 1.15 * 0.8).toFixed(2)}` : '~80% net',
                recommendation: 'Direct Buyer Sale'
            },
            {
                name: 'The RealReal / Consignment',
                est_price: boutique || (est > 0 ? `$${(est * 1.25).toFixed(2)}` : '$95 - $200'),
                net_payout: est > 0 ? `~$${(est * 1.25 * 0.7).toFixed(2)}` : '~70% net',
                recommendation: 'Hands-off Luxury'
            },
            {
                name: 'Memory Den Booth',
                est_price: boutique || (est > 0 ? `$${(est * 1.2).toFixed(2)}` : '$85 - $175'),
                net_payout: est > 0 ? `~$${(est * 1.2 * 0.9).toFixed(2)} (10% comm)` : '~90% net',
                recommendation: 'Showcase Glass Case'
            }
        ];
    } else if (isWomensOrContemporary || isVintage) {
        bestPlatform = 'Poshmark / Depop / Memory Den';
        rationale = 'Poshmark flat $7.97 buyer priority shipping drives multi-item bundles, while Memory Den curated booth provides high-margin local boutique sales.';
        velocity = 'Moderate (1-3 weeks)';
        channels = [
            {
                name: 'Poshmark (Fashion/Boutique)',
                est_price: est > 0 ? `$${(est * 1.1).toFixed(2)}` : '$28 - $50',
                net_payout: est > 0 ? `~$${(est * 1.1 * 0.8).toFixed(2)} (20% fee)` : '~80% net',
                recommendation: 'Active Bundle Shoppers'
            },
            {
                name: 'Depop (Aesthetic/Vintage)',
                est_price: est > 0 ? `$${(est * 1.05).toFixed(2)}` : '$25 - $45',
                net_payout: est > 0 ? `~$${(est * 1.05 * 0.97).toFixed(2)} (0% seller fee)` : '~97% net',
                recommendation: 'High Margin (No Fee)'
            },
            {
                name: 'Memory Den (Physical Booth)',
                est_price: boutique || (est > 0 ? `$${(est * 1.15).toFixed(2)}` : '$30 - $55'),
                net_payout: est > 0 ? `~$${(est * 1.15 * 0.9).toFixed(2)} (10% comm)` : '~90% net',
                recommendation: 'Zero Shipping Hassle'
            },
            {
                name: 'Mercari / eBay',
                est_price: est > 0 ? `$${est.toFixed(2)}` : '$20 - $35',
                net_payout: est > 0 ? `~$${(est * 0.87).toFixed(2)}` : '~87% net',
                recommendation: 'Casual Liquidation'
            }
        ];
    } else if (isMediaOrElectronics) {
        bestPlatform = 'eBay / Mercari Online';
        rationale = 'High national search volume and exact barcode/UPC catalog matching makes eBay the fastest liquidity channel for media and electronics.';
        velocity = 'Fast (< 7 days)';
        channels = [
            {
                name: 'eBay Online',
                est_price: est > 0 ? `$${est.toFixed(2)}` : '$20 - $35',
                net_payout: est > 0 ? `~$${(est * 0.87).toFixed(2)} (13% fee)` : '~87% net',
                recommendation: 'Highest Search Volume'
            },
            {
                name: 'Mercari Online',
                est_price: est > 0 ? `$${(est * 0.95).toFixed(2)}` : '$18 - $30',
                net_payout: est > 0 ? `~$${(est * 0.95 * 0.9).toFixed(2)}` : '~90% net',
                recommendation: 'Fast Mobile Buyers'
            },
            {
                name: 'Memory Den / Booth',
                est_price: boutique || (est > 0 ? `$${(est * 1.1).toFixed(2)}` : '$22 - $40'),
                net_payout: est > 0 ? `~$${(est * 1.1 * 0.9).toFixed(2)} (10% comm)` : '~90% net',
                recommendation: 'Impulse Media Shelf'
            }
        ];
    } else {
        bestPlatform = isHighBoutique ? 'Memory Den (Physical Booth)' : 'eBay & Poshmark';
        rationale = isHighBoutique 
            ? 'Curated physical display commands premium in-person pricing with only 10% commission and no shipping overhead.'
            : 'Multi-channel cross-listing on eBay and fashion marketplaces provides wide visibility.';
        velocity = 'Moderate (2-4 weeks)';
        channels = [
            {
                name: 'Memory Den / Physical Booth',
                est_price: boutique || (est > 0 ? `$${(est * 1.15).toFixed(2)}` : '$25 - $50'),
                net_payout: est > 0 ? `~$${(est * 1.15 * 0.9).toFixed(2)} (10% comm)` : '~90% net',
                recommendation: isHighBoutique ? 'Highest Margin' : 'No Shipping'
            },
            {
                name: 'eBay / Poshmark',
                est_price: est > 0 ? `$${est.toFixed(2)}` : '$20 - $40',
                net_payout: est > 0 ? `~$${(est * 0.87).toFixed(2)}` : '~87% net',
                recommendation: 'National Reach'
            },
            {
                name: 'Depop / Mercari',
                est_price: est > 0 ? `$${(est * 0.95).toFixed(2)}` : '$18 - $35',
                net_payout: est > 0 ? `~$${(est * 0.95 * 0.9).toFixed(2)}` : '~90% net',
                recommendation: 'Fast Mobile Liquidation'
            }
        ];
    }

    return {
        bestPlatform,
        rationale,
        velocity,
        channels
    };
});

</script>

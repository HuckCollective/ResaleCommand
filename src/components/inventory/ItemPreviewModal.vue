<template>
    <dialog ref="previewModal" class="modal">
        <!-- Close overlay -->
        <form method="dialog" class="modal-backdrop">
            <button @click="close">close</button>
        </form>
        
        <div v-if="item" class="modal-box w-full max-w-none h-full max-h-none min-h-screen rounded-none flex flex-col p-0 overflow-hidden bg-base-100 shadow-none relative">
            
            <!-- Sticky Header: Status + Wrapped Title + Share & Close Actions -->
            <div class="navbar bg-base-200/95 backdrop-blur-md border-b border-base-300 min-h-14 sticky top-0 z-30 px-3 md:px-5 py-2 flex items-center justify-between gap-3 shadow-xs">
                <!-- Left: Status Badge & Wrapped Title -->
                <div class="flex-1 min-w-0 pr-2">
                    <div class="flex items-center gap-1.5 flex-wrap mb-1">
                        <div class="badge badge-sm font-bold uppercase shrink-0" :class="statusBadgeClass">
                            {{ statusText }}
                        </div>
                        <span v-if="item.upc" class="badge badge-sm font-mono font-bold bg-base-100 border-base-300 text-xs">
                            <Icon icon="solar:barcode-bold" class="w-3 h-3 mr-1 text-primary" />{{ item.upc }}
                        </span>
                        <span v-if="item.locationSku || item.sku" class="badge badge-sm font-mono font-bold bg-secondary/15 text-secondary border-secondary/30 text-xs">
                            SKU: {{ (item.locationSku || item.sku).replace(/^'/, '') }}
                        </span>
                    </div>
                    <h2 class="font-extrabold text-sm sm:text-base leading-snug break-words text-base-content line-clamp-2 md:line-clamp-none">
                        {{ title }}
                    </h2>
                </div>

                <!-- Right Actions: Share, Edit (Desktop), Close X -->
                <div class="flex-none flex items-center gap-1.5 shrink-0">
                    <button class="btn btn-sm btn-ghost btn-circle" @click="copyShareLink" title="Copy Share Link">
                        <Icon icon="solar:link-linear" class="w-4 h-4" />
                    </button>
                    <button class="btn btn-sm btn-primary gap-1.5 hidden md:flex font-bold shadow-xs" @click="emit('edit', item); close()">
                        <Icon icon="solar:pen-bold" class="w-4 h-4" /> Edit Item
                    </button>
                    <button class="btn btn-sm btn-circle btn-neutral shadow-sm" @click="close" title="Close Preview">
                        ✕
                    </button>
                </div>
            </div>

            <!-- Top Reseller Financial Summary Bar (Costs to Top) -->
            <div class="bg-base-200 border-b border-base-300 px-3 md:px-6 py-2.5 grid grid-cols-3 sm:grid-cols-4 gap-2 text-center text-xs z-20">
                <div class="bg-base-100 p-2 sm:p-3 rounded-xl border border-base-300/80 shadow-xs flex flex-col justify-center">
                    <span class="text-[10px] uppercase font-extrabold opacity-60">Est. Resale</span>
                    <span class="text-base sm:text-xl font-black text-success font-mono">{{ formatCurrency(estValue) }}</span>
                </div>
                <div class="bg-base-100 p-2 sm:p-3 rounded-xl border border-base-300/80 shadow-xs flex flex-col justify-center">
                    <span class="text-[10px] uppercase font-extrabold opacity-60">Buy Cost</span>
                    <span class="text-sm sm:text-lg font-bold font-mono">{{ formatCurrency(paidValue) }}</span>
                </div>
                <div class="bg-base-100 p-2 sm:p-3 rounded-xl border border-base-300/80 shadow-xs flex flex-col justify-center">
                    <span class="text-[10px] uppercase font-extrabold opacity-60">Est. Profit</span>
                    <span class="text-sm sm:text-lg font-extrabold font-mono" :class="netProfit >= 0 ? 'text-success' : 'text-error'">
                        {{ netProfit >= 0 ? '+' : '' }}{{ formatCurrency(netProfit) }}
                        <span v-if="profitMargin !== null" class="text-[10px] block opacity-80 font-sans font-bold">({{ profitMargin }}%)</span>
                    </span>
                </div>
                <div class="bg-base-100 p-2 sm:p-3 rounded-xl border border-base-300/80 shadow-xs hidden sm:flex flex-col justify-center">
                    <span class="text-[10px] uppercase font-extrabold opacity-60">Storage Bin</span>
                    <span class="text-xs font-bold truncate max-w-full font-mono">{{ item.storageLocation || 'Unassigned' }}</span>
                </div>
            </div>

            <!-- Scrollable Content -->
            <div class="flex-1 overflow-y-auto w-full flex flex-col lg:flex-row pb-24">
                
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
                </div>

                <!-- Right Column: Details -->
                <div class="w-full lg:w-7/12 p-5 md:p-8 space-y-6 bg-base-100">
                    
                    <!-- Location, Provenance & Meta Row -->
                    <div class="flex items-center gap-3 flex-wrap text-xs font-mono bg-base-200/50 p-3 rounded-xl border border-base-300">
                        <span v-if="locationText" class="flex gap-1.5 items-center">
                            <Icon icon="solar:map-point-bold" class="text-primary w-4 h-4" /> 
                            <a v-if="locationText.startsWith('http')" :href="locationText" target="_blank" class="text-primary underline decoration-primary/40 underline-offset-2 flex items-center gap-1 truncate max-w-50 md:max-w-100" :title="locationText">
                                {{ locationText.replace(/^https?:\/\/(www\.)?/, '') }}
                                <Icon icon="solar:external-link-linear" class="w-3 h-3 shrink-0" />
                            </a>
                            <span v-else class="font-bold text-base-content">{{ locationText }}</span>
                        </span>
                        <span v-if="item.orderId" class="badge badge-sm badge-ghost font-mono">
                            Order #{{ item.orderId }}
                        </span>
                        <span v-if="item.$id" class="opacity-50 ml-auto">ID: {{ item.$id.slice(-6) }}</span>
                    </div>

                    <!-- Condition Notes -->
                    <div v-if="cleanConditionNotes" class="bg-warning/10 border-l-4 border-warning p-4 rounded-r-xl">
                        <h3 class="font-bold text-warning-content text-xs uppercase mb-1 flex items-center gap-1.5">
                            <Icon icon="solar:notes-bold" class="w-4 h-4" />
                            Condition & Internal Notes
                        </h3>
                        <p class="whitespace-pre-wrap text-sm leading-relaxed text-warning-content/90">{{ cleanConditionNotes }}</p>
                    </div>

                    <!-- Scout Data Output -->
                    <div v-if="parsedScoutData" class="mt-4 bg-base-100 rounded-2xl border border-base-300 shadow-sm text-base-content overflow-hidden">
                        <div class="bg-base-200/70 p-3 border-b border-base-300 text-xs font-bold uppercase tracking-wider flex justify-between items-center">
                            <span class="flex items-center gap-1.5 text-primary">
                                <Icon icon="solar:magic-stick-bold" class="w-4 h-4" />
                                AI Scout Report
                            </span>
                            <span v-if="parsedScoutData.identity" class="truncate max-w-50 normal-case opacity-70">{{ parsedScoutData.identity }}</span>
                        </div>
                        <div class="p-4 space-y-4">
                            
                            <!-- Red Flags -->
                            <div v-if="parsedScoutData.red_flags && parsedScoutData.red_flags.length" class="bg-warning/20 border border-warning/50 rounded-xl p-3 text-warning-content text-sm flex gap-2 items-start shadow-inner">
                                <span class="text-error font-black mt-0.5">🚩</span>
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
                            <div v-if="parsedScoutData.comparables && parsedScoutData.comparables.length" class="mt-4 border-t border-base-300 pt-4">
                                 <div class="text-[10px] uppercase font-bold opacity-60 tracking-widest mb-2">Recent Comps</div>
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
                    <div class="mt-4 bg-base-100 rounded-2xl border border-base-300 shadow-sm overflow-hidden text-base-content">
                        <div class="bg-base-200/70 p-3 border-b border-base-300 text-xs font-bold uppercase tracking-wider flex justify-between items-center gap-2">
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

                    <!-- Lot Contents -->
                    <div v-if="childItems.length > 0" class="mt-6 border border-base-300 rounded-2xl overflow-hidden bg-base-100 shadow-sm">
                        <div class="bg-base-200/70 p-3 border-b border-base-300 text-xs font-bold uppercase opacity-80 flex justify-between items-center">
                            <span>Bundle Contents ({{ childItems.length }})</span>
                        </div>
                        <ul class="divide-y divide-base-200">
                            <li v-for="child in childItems" :key="child.$id" class="p-3 flex justify-between items-center hover:bg-base-200/30 transition-colors">
                                <a :href="'/item/' + child.$id" class="font-medium text-sm truncate max-w-[70%] hover:text-primary transition-colors" target="_blank">{{ child.title }}</a>
                                <div class="flex items-center gap-4">
                                    <span class="badge badge-sm badge-outline opacity-60">{{ child.status }}</span>
                                    <span class="font-mono text-xs font-bold text-success w-16 text-right">${{ Number(child.cost).toFixed(2) }}</span>
                                </div>
                            </li>
                        </ul>
                    </div>

                    <!-- Description / Scout Report -->
                    <div v-if="item.marketDescription || item.description" class="prose prose-sm max-w-none prose-headings:font-bold prose-headings:mt-4 prose-a:text-primary pb-8">
                        <div class="divider text-xs uppercase opacity-50 font-bold tracking-widest mt-0">Full Details</div>
                        <div v-html="renderedDescription" class="whitespace-pre-wrap"></div>
                    </div>
                    <div v-if="scoutMarkdownText" class="prose prose-sm max-w-none prose-headings:font-bold prose-headings:mt-4 prose-a:text-primary pb-8">
                        <div class="divider text-xs uppercase opacity-50 font-bold tracking-widest mt-0">AI Scout Report</div>
                        <div v-html="scoutMarkdownText" class="whitespace-pre-wrap"></div>
                    </div>
                    <div v-if="!(item.marketDescription || item.description) && !scoutMarkdownText" class="text-center py-12 opacity-40">
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

                <button v-if="canUserEdit" type="button" class="text-primary font-bold" @click="emit('edit', item); close()" title="Edit Inventory Item">
                    <Icon icon="solar:pen-bold" class="w-5 h-5 mb-0.5" />
                    <span class="dock-label">Edit</span>
                </button>

                <button type="button" @click="close" title="Close Preview">
                    <Icon icon="solar:close-circle-linear" class="w-5 h-5 mb-0.5" />
                    <span class="dock-label">Close</span>
                </button>
            </div>
        </div>
    </dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { marked } from 'marked';
import { addToast } from '../../stores/toast';
import { Icon } from '@iconify/vue';
import { databases, Query } from '../../lib/appwrite';
import { isAlphaMode } from '../../stores/env';
import { useAuth } from '../../composables/useAuth';

const { user } = useAuth();

const props = defineProps({
    item: { type: Object, default: null }, // The item to preview. If null, modal is fully hidden.
    canEdit: { type: Boolean, default: undefined }
});

const canUserEdit = computed(() => {
    if (props.canEdit !== undefined) return props.canEdit;
    return !!user.value;
});

const emit = defineEmits(['close', 'edit', 'deconstruct']);

const previewModal = ref(null);
const selectedIndex = ref(0);
const carouselRef = ref(null);
let isProgrammaticScroll = false;

const ENDPOINT = import.meta.env.PUBLIC_APPWRITE_ENDPOINT;
const PROJECT = import.meta.env.PUBLIC_APPWRITE_PROJECT_ID;
import { BUCKET_ID, REPORTS_BUCKET_ID } from '../../lib/inventory';
const BUCKET = BUCKET_ID;
const REPORTS_BUCKET = REPORTS_BUCKET_ID;

const childItems = ref([]);

// Watch for item changes to open modal and reset gallery
watch(() => props.item, async (newItem) => {
    if (newItem) {
        selectedIndex.value = 0;
        childItems.value = [];
        if (carouselRef.value) carouselRef.value.scrollLeft = 0;
        previewModal.value?.showModal();
        await loadScoutData(newItem);
        
        try {
            const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
            const collId = isAlphaMode.get() 
                ? (import.meta.env.PUBLIC_APPWRITE_ALPHA_COLLECTION_ID || 'alpha_items') 
                : (import.meta.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items');
                
            const childRes = await databases.listDocuments(DB_ID, collId, [
                Query.equal('parentLotId', newItem.$id),
                Query.limit(100)
            ]);
            childItems.value = childRes.documents;
        } catch (err) {
            console.error("Failed to fetch child items:", err);
        }
        
    } else {
        previewModal.value?.close();
        parsedScoutData.value = null;
        childItems.value = [];
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
        setTimeout(() => { isProgrammaticScroll = false; }, 400); // Allow time for scroll animation
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

const close = () => {
    previewModal.value?.close();
    emit('close');
};

const editItem = () => {
    const itemToEdit = { ...props.item };
    close();
    emit('edit', itemToEdit);
};

const copyShareLink = async () => {
    if (!props.item?.$id) return;
    const url = `${window.location.origin}/item/${props.item.$id}`;
    try {
        await navigator.clipboard.writeText(url);
        // Dispatch optional custom event if a global toast system exists
        window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Link copied to clipboard!', type: 'success' } }));
        addToast({ type: 'success', message: 'Share link copied to clipboard!' });
    } catch (err) {
        addToast({ type: 'error', message: 'Failed to copy link: ' + url });
    }
};

// --- COMPUTED CONTENT ---
const title = computed(() => props.item?.title || props.item?.identity || props.item?.itemName || "Untitled Item");
const locationText = computed(() => props.item?.storageLocation || props.item?.sourcingLocation || '');

const statusText = computed(() => {
    const s = props.item?.status || 'Active';
    return s.replace(/_/g, ' ');
});

const statusBadgeClass = computed(() => {
    const s = props.item?.status;
    if (s === 'received' || s === 'scouted') return 'bg-info/20 text-info border border-info/40 font-bold';
    if (s === 'acquired') return 'bg-secondary/20 text-secondary border border-secondary/40 font-bold';
    if (s === 'placed') return 'bg-success/20 text-success border border-success/40 font-bold';
    if (s === 'sold') return 'bg-neutral/30 text-base-content/80 border border-base-300 font-bold';
    return 'bg-base-200 text-base-content/80 border border-base-300 font-bold';
});

const renderedDescription = computed(() => {
    const desc = props.item?.marketDescription || props.item?.description;
    if (!desc) return '';
    return marked.parse(desc);
});

const cleanConditionNotes = computed(() => {
    if (!props.item?.conditionNotes) return '';
    let text = props.item.conditionNotes;
    // Strip out all the bracket metadata lines
    text = text.replace(/\[GALLERY IDS:.*?\n/g, '');
    text = text.replace(/\[SCOUT_REPORT_ID:.*?\]/g, '');
    text = text.replace(/\[SCOUT_REPORT_MD:.*?\]/g, '');
    text = text.replace(/\[MAIN IMAGE ID:.*?\]/g, '');
    text = text.replace(/\[SCOUT_DATA_LITE:.*?\]/g, '');
    text = text.replace(/\[SCOUT_DATA:.*?\]/g, '');
    
    // Strip out boilerplate import details block entirely
    text = text.replace(/--- IMPORT DETAILS ---[\s\S]*/, '');

    // Also optionally strip out the pricing block if it's identical to the scraper block
    const scraperBlock = /Paid:[\s\S]*?Est\. High:.*?\n/i;
    text = text.replace(scraperBlock, '');

    return text.trim();
});

const parsedScoutData = ref(null);
const scoutMarkdownText = ref(null);

const loadScoutData = async (item) => {
    parsedScoutData.value = null;
    scoutMarkdownText.value = null;
    if (!item) return;

    // 1. Check if raw JSON object exists natively on the item
    if (item.scoutData) {
        let raw = item.scoutData;
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

    // 2. Check if there's a file ID reference in the condition notes
    if (item.conditionNotes) {
        const mdMatch = item.conditionNotes.match(/\[SCOUT_REPORT_MD:\s*([^\]]+)\]/);
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

        const fileMatch = item.conditionNotes.match(/\[SCOUT_REPORT_ID:\s*([^\]]+)\]/);
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
        
        // 3. Fallback check for old embedded base64 data
        const liteMatch = item.conditionNotes.match(/\[SCOUT_DATA_LITE:\s*([^\]]+)\]/);
        if (liteMatch) {
            try { parsedScoutData.value = JSON.parse(atob(liteMatch[1])); return; } catch(e) {}
        }
        const dataMatch = item.conditionNotes.match(/\[SCOUT_DATA:\s*([^\]]+)\]/);
        if (dataMatch) {
            try { parsedScoutData.value = JSON.parse(atob(dataMatch[1])); return; } catch(e) {}
        }
    }
    
    // 4. Fallback check for rawAnalysis
    if (item.rawAnalysis) {
         try {
             const parsed = JSON.parse(item.rawAnalysis);
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
    if (!props.item) return 0;
    if (props.item.resalePrice && parseFloat(props.item.resalePrice) > 0) return props.item.resalePrice;
    
    if (parsedScoutData.value && parsedScoutData.value.price_breakdown) {
         let p = parsedScoutData.value.price_breakdown;
         let fair = parsePriceObj(p.fair);
         if (fair > 0) return fair;
         let mint = parsePriceObj(p.mint);
         if (mint > 0) return mint;
    }

    if (props.item.estHigh && parseFloat(parsePriceObj(props.item.estHigh)) > 0) return parsePriceObj(props.item.estHigh);
    return getNoteValue(props.item.conditionNotes, 'Est. High', true) || 0;
});

const paidValue = computed(() => {
    if (!props.item) return 0;
    if (props.item.cost && parseFloat(props.item.cost) > 0) return props.item.cost;
    if (props.item.purchasePrice && parseFloat(props.item.purchasePrice) > 0) return props.item.purchasePrice;
    return getNoteValue(props.item.conditionNotes, 'Paid', true) || 0;
});

const netProfit = computed(() => {
    const rev = parseFloat(String(estValue.value).replace(/[^0-9.-]+/g, '')) || 0;
    const c = parseFloat(String(paidValue.value).replace(/[^0-9.-]+/g, '')) || 0;
    if (rev === 0 && c === 0) return 0;
    return rev - c;
});

const profitMargin = computed(() => {
    const rev = parseFloat(String(estValue.value).replace(/[^0-9.-]+/g, '')) || 0;
    const c = parseFloat(String(paidValue.value).replace(/[^0-9.-]+/g, '')) || 0;
    if (rev > 0 && c >= 0) {
        return Math.round(((rev - c) / rev) * 100);
    }
    return null;
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

const getAssetUrl = (id) => `${ENDPOINT}/storage/buckets/${BUCKET}/files/${id}/view?project=${PROJECT}`;

const gallery = computed(() => {
    if (!props.item) return [];
    
    // Check old array
    if (props.item.galleryImageIds && props.item.galleryImageIds.length > 0) {
        return props.item.galleryImageIds.map(id => {
            if (id.startsWith('http')) return proxify(id);
            return getAssetUrl(id);
        });
    }
    
    // Check single image
    if (props.item.imageId) {
        const id = props.item.imageId;
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

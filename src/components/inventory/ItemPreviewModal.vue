<template>
    <dialog ref="previewModal" class="modal">
        <!-- Close overlay -->
        <form method="dialog" class="modal-backdrop">
            <button @click="close">close</button>
        </form>
        
        <div v-if="item" class="modal-box w-full max-w-none h-full max-h-none min-h-screen rounded-none flex flex-col p-0 overflow-hidden bg-base-100 shadow-none relative">
            
            <!-- Sticky Header -->
            <div class="navbar bg-base-200 border-b border-base-300 min-h-12 sticky top-0 z-20 px-4">
                <div class="flex-1">
                    <div class="badge badge-lg font-bold uppercase truncate" :class="statusBadgeClass">
                        {{ statusText }}
                    </div>
                    <span v-if="item.sellingLocations && item.sellingLocations.length > 0" class="ml-2 text-xs opacity-70 flex gap-1 items-center">
                        <span v-for="chan in item.sellingLocations" :key="chan" class="badge badge-sm badge-outline">{{ chan }}</span>
                    </span>
                </div>
                <div class="flex-none gap-2">
                    <button class="btn btn-sm btn-ghost tooltip tooltip-bottom" data-tip="Copy Share Link" @click="copyShareLink">
                        <Icon icon="solar:link-linear" class="w-4 h-4 mr-1 inline" /> Share
                    </button>
                    <button v-if="!item.parentLotId" class="btn btn-sm btn-secondary tooltip tooltip-bottom" data-tip="Deconstruct lot into individual items" @click="emit('deconstruct', item)">
                        <Icon icon="solar:pie-chart-2-linear" class="w-4 h-4 mr-1 inline" /> Deconstruct Lot
                    </button>
                    <button class="btn btn-sm btn-primary" @click="editItem">
                        <Icon icon="solar:pen-linear" class="w-4 h-4 mr-1 inline" /> Edit Item
                    </button>
                    <button class="btn btn-sm btn-circle btn-ghost" @click="close">✕</button>
                </div>
            </div>

            <!-- Scrollable Content -->
            <div class="flex-1 overflow-y-auto w-full flex flex-col lg:flex-row">
                
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
                             <div class="flex justify-between items-end pb-3 border-b border-base-200 mb-3">
                                <span class="text-xs uppercase font-bold opacity-60">Cost Basis</span>
                                <span class="text-lg font-bold opacity-80 font-mono">{{ formatCurrency(paidValue) }}</span>
                             </div>
                             <div class="flex justify-between items-center text-xs opacity-60 font-mono">
                                 <span>Max Buy Target:</span>
                                 <span>{{ formatCurrency(props.item.maxBuyPrice) }}</span>
                             </div>
                         </div>
                    </div>
                </div>

                <!-- Right Column: Details -->
                <div class="w-full lg:w-7/12 p-6 md:p-8 space-y-6 bg-base-100">
                    
                    <div>
                        <h1 class="text-2xl md:text-3xl font-bold leading-tight mb-2">{{ title }}</h1>
                        <div class="flex items-center gap-4 text-sm opacity-60 font-mono">
                            <span v-if="locationText" class="flex gap-1 items-center">
                                <Icon icon="solar:map-point-linear" /> 
                                <a v-if="locationText.startsWith('http')" :href="locationText" target="_blank" class="text-primary underline decoration-primary/40 underline-offset-2 flex items-center gap-1 truncate max-w-[200px] md:max-w-[400px]" :title="locationText">
                                    {{ locationText.replace(/^https?:\/\/(www\.)?/, '') }}
                                    <Icon icon="solar:external-link-linear" class="w-3 h-3 shrink-0" />
                                </a>
                                <span v-else>{{ locationText }}</span>
                            </span>
                            <span v-if="item.$id">ID: {{ item.$id.slice(-6) }}</span>
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

                    <!-- Scout Data Output -->
                    <div v-if="parsedScoutData" class="mt-4 bg-base-100 rounded-xl border border-base-200 shadow-sm text-base-content overflow-hidden">
                        <div class="bg-base-200/50 p-3 border-b border-base-200 text-xs font-bold uppercase opacity-60 flex justify-between items-center">
                            <span>AI Scout Report</span>
                            <span v-if="parsedScoutData.identity" class="truncate max-w-[200px] normal-case opacity-70">{{ parsedScoutData.identity }}</span>
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
                            <div class="grid grid-cols-2 gap-2 mt-4" v-if="parsedScoutData.price_breakdown">
                                <div class="flex flex-col items-center bg-base-100 p-3 rounded-lg border border-base-200 shadow-sm">
                                    <span class="text-[10px] uppercase font-bold text-info mb-1 tracking-wider">Mint</span>
                                    <span class="font-mono font-bold text-sm">{{ parsedScoutData.price_breakdown.mint || '-' }}</span>
                                </div>
                                <div class="flex flex-col items-center bg-base-100 p-3 rounded-lg border border-primary/30 shadow-sm ring-1 ring-primary/10">
                                    <span class="text-[10px] uppercase font-bold text-primary mb-1 tracking-wider">Fair</span>
                                    <span class="font-mono font-bold text-[15px]">{{ parsedScoutData.price_breakdown.fair || '-' }}</span>
                                </div>
                                <div class="flex flex-col items-center bg-base-100 p-3 rounded-lg border border-base-200 shadow-sm">
                                    <span class="text-[10px] uppercase font-bold text-error opacity-70 mb-1 tracking-wider">Poor</span>
                                    <span class="font-mono font-bold text-sm opacity-80">{{ parsedScoutData.price_breakdown.poor || '-' }}</span>
                                </div>
                                <div v-if="parsedScoutData.price_breakdown.boutique_premium" class="flex flex-col items-center bg-secondary/10 p-3 rounded-lg border border-secondary/30 shadow-sm">
                                    <span class="text-[10px] uppercase font-bold text-secondary mb-1 tracking-wider">Boutique</span>
                                    <span class="font-mono font-bold text-sm opacity-90">{{ parsedScoutData.price_breakdown.boutique_premium || '-' }}</span>
                                </div>
                            </div>
                            
                            <!-- Comparables -->
                            <div v-if="parsedScoutData.comparables && parsedScoutData.comparables.length" class="mt-4 border-t border-base-200 pt-4">
                                 <div class="text-[10px] uppercase font-bold opacity-40 tracking-widest mb-2">Comps</div>
                                 <ul class="space-y-2">
                                     <li v-for="comp in parsedScoutData.comparables" :key="comp.name" class="flex justify-between items-center text-sm group">
                                         <span class="truncate pr-4 w-4/5 opacity-80 group-hover:opacity-100 transition-opacity">{{ comp.name }}</span>
                                         <span class="font-mono font-bold shrink-0">{{ comp.price }}</span>
                                     </li>
                                 </ul>
                            </div>
                        </div>
                    </div>

                    <!-- Lot Contents -->
                    <div v-if="childItems.length > 0" class="mt-6 border border-base-200 rounded-xl overflow-hidden bg-base-100 shadow-sm">
                        <div class="bg-base-200/50 p-3 border-b border-base-200 text-xs font-bold uppercase opacity-60 flex justify-between items-center">
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

const props = defineProps({
    item: { type: Object, default: null } // The item to preview. If null, modal is fully hidden.
});

const emit = defineEmits(['close', 'edit', 'deconstruct']);

const previewModal = ref(null);
const selectedIndex = ref(0);
const carouselRef = ref(null);
let isProgrammaticScroll = false;

const ENDPOINT = import.meta.env.PUBLIC_APPWRITE_ENDPOINT;
const PROJECT = import.meta.env.PUBLIC_APPWRITE_PROJECT_ID;
const BUCKET = import.meta.env.PUBLIC_APPWRITE_BUCKET_ID;

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
    if (s === 'received' || s === 'scouted') return 'badge-info';
    if (s === 'acquired') return 'badge-secondary';
    if (s === 'placed') return 'badge-success';
    if (s === 'sold') return 'badge-neutral';
    return 'badge-ghost';
});

const renderedDescription = computed(() => {
    if (!props.item?.description) return '';
    return marked.parse(props.item.description);
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
            const downloadUrl = `${ENDPOINT}/storage/buckets/reports/files/${id}/download?project=${PROJECT}`;
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
            const downloadUrl = `${ENDPOINT}/storage/buckets/reports/files/${fileId}/download?project=${PROJECT}`;
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

</script>

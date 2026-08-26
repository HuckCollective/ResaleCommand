<template>
    <div class="card bg-base-100 shadow-sm border border-base-200 hover:border-primary/60 hover:shadow-md transition-all duration-200 group relative cursor-pointer overflow-hidden flex flex-col rounded-xl"
         :class="containerClass"
         @click="$emit('click-card', item)">
        
        <!-- Image Area -->
        <figure class="bg-base-200 relative overflow-hidden group-hover:opacity-95 transition-opacity flex-none aspect-square sm:aspect-4/3 w-full">
            <img v-if="imageUrl" :src="imageUrl" :alt="title" class="w-full h-full object-cover" loading="lazy" />
            <div v-else class="flex flex-col items-center justify-center w-full h-full opacity-30 bg-base-300 p-2">
                <Icon icon="solar:box-linear" class="w-10 h-10" />
            </div>
            
            <!-- Top Overlay Badges -->
            <div class="absolute top-0 left-0 right-0 p-1.5 z-10 flex justify-between items-start pointer-events-none bg-linear-to-b from-black/60 via-black/20 to-transparent">
                <!-- Left: Checkbox + Lot badges -->
                <div class="pointer-events-auto shrink-0 flex items-center gap-1">
                    <slot name="absolute-top-left"></slot>
                    
                    <div v-if="item.parentLotId" class="badge badge-xs bg-black/60 backdrop-blur-xs text-white border-white/20 font-bold" title="Extracted from Lot">
                        <Icon icon="solar:link-minimalistic-bold" class="w-2.5 h-2.5 mr-0.5 text-accent" />
                        <span>Extracted</span>
                    </div>
                    <div v-else-if="item.quantity > 1 || (item.title && item.title.toLowerCase().startsWith('lot of'))" class="badge badge-xs bg-black/60 backdrop-blur-xs text-white border-white/20 font-bold" title="Bulk Lot">
                        <Icon icon="solar:box-minimalistic-bold" class="w-2.5 h-2.5 mr-0.5 text-warning" /> 
                        <span>Lot<span v-if="item.quantity > 1" class="ml-0.5">x{{ item.quantity }}</span></span>
                    </div>
                </div>
                
                <!-- Right: Status Badge -->
                <div class="badge badge-xs rounded shadow-xs font-bold border-none pointer-events-auto uppercase text-[10px]" :class="statusBadgeClass">
                    {{ statusText }}
                </div>
            </div>
            
            <!-- ROI Meter Bar overlaid on bottom of image -->
            <div class="absolute bottom-0 left-0 right-0 h-5 bg-black/60 backdrop-blur-xs overflow-hidden flex items-center">
                <div :class="[profitColor, profitWidth]" class="h-full transition-all duration-500 opacity-80"></div>
                <div class="absolute inset-0 flex justify-between items-center px-1.5 font-bold z-10 text-[9px] text-white pointer-events-none drop-shadow-xs">
                    <span class="opacity-90">Cost: {{ formatCurrency(paidValue) }}</span>
                    <span>
                        <span class="opacity-90">Est: {{ formatCurrency(estValue) }}</span>
                        <span v-if="roi !== null" class="ml-1 opacity-100 border-l border-white/30 pl-1">ROI: {{ roi }}%</span>
                    </span>
                </div>
            </div>
            
            <slot name="image-overlay"></slot>
        </figure>

        <!-- Body Area -->
        <div class="card-body p-2.5 gap-1.5 flex-1 flex flex-col justify-between">
            <!-- Title & Identifiers -->
            <div>
                <h2 class="font-bold leading-snug line-clamp-2 text-xs group-hover:text-primary transition-colors mb-1" :title="title">
                    {{ title }}
                </h2>

                <!-- UPC & Location SKU Identifiers -->
                <div v-if="item.upc || item.locationSku || item.sku" class="flex gap-1 flex-wrap items-center">
                    <span v-if="item.upc" class="badge badge-xs font-mono font-bold bg-base-200 border-base-300 text-base-content/80 text-[10px] px-1.5" title="UPC">
                        <Icon icon="solar:barcode-minimalistic-bold" class="w-2.5 h-2.5 mr-0.5 text-primary" />{{ item.upc }}
                    </span>
                    <span v-if="item.locationSku || item.sku" class="badge badge-xs font-mono font-bold bg-secondary/15 border-secondary/30 text-secondary text-[10px] px-1.5" title="Location SKU">
                        <Icon icon="solar:tag-bold" class="w-2.5 h-2.5 mr-0.5" />{{ (item.locationSku || item.sku).replace(/^'/, '') }}
                    </span>
                </div>
            </div>

            <div>
                <!-- Location & Channels -->
                <div v-if="locationText" class="text-[11px] opacity-60 truncate flex items-center gap-1 mb-0.5">
                    <Icon icon="solar:map-point-linear" class="w-3 h-3 inline shrink-0" />
                    <span>{{ locationText }}</span>
                </div>
                
                <!-- Tags/Sales Channels -->
                <div v-if="tags && tags.length > 0" class="flex gap-1 flex-wrap mb-1">
                    <span v-for="tag in tags" :key="tag" class="badge badge-[10px] px-1.5 py-0 shadow-2xs border-base-200"
                          :class="{'bg-secondary/20 text-secondary': tag.toLowerCase().includes('ebay'), 'bg-primary/20 text-primary': tag.toLowerCase().includes('poshmark'), 'badge-outline opacity-70': !tag.toLowerCase().includes('ebay') && !tag.toLowerCase().includes('poshmark')}">
                        <Icon v-if="tag.toLowerCase().includes('ebay')" icon="solar:tag-price-bold-duotone" class="w-2.5 h-2.5 mr-0.5" />
                        <Icon v-else-if="tag.toLowerCase().includes('poshmark')" icon="solar:hanger-bold-duotone" class="w-2.5 h-2.5 mr-0.5" />
                        {{ tag }}
                    </span>
                </div>

                <!-- Footer Actions Slot -->
                <slot name="actions"></slot>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { Icon } from '@iconify/vue';

const props = defineProps({
    item: { type: Object, required: true },
    compact: { type: Boolean, default: false } // Makes it look like the small inventory cards
});

defineEmits(['click-card']);

const ENDPOINT = import.meta.env.PUBLIC_APPWRITE_ENDPOINT;
const PROJECT = import.meta.env.PUBLIC_APPWRITE_PROJECT_ID;
import { BUCKET_ID } from '../../lib/inventory';
const BUCKET = BUCKET_ID;

// --- COMPUTED STYLES ---
const containerClass = computed(() => props.compact ? 'text-xs' : 'text-sm');
const imageClass = computed(() => props.compact ? 'aspect-[4/5]' : 'aspect-square md:aspect-[4/3] h-48 md:h-auto');
const titleClass = computed(() => props.compact ? 'text-xs h-[2.5em]' : 'text-base h-[3em]');

// --- COMPUTED DATA ---
const title = computed(() => props.item.title || props.item.identity || props.item.itemName || "Untitled Item");
const locationText = computed(() => props.item.storageLocation || props.item.binLocation || props.item.purchaseLocation || '');
const tags = computed(() => {
    const raw = props.item.sellingLocations || props.item.salesChannel || [];
    const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    const currentLoc = (locationText.value || '').trim().toLowerCase();
    // Filter out tags that duplicate the single item location
    return list.filter(t => t && String(t).trim().toLowerCase() !== currentLoc);
});

const statusText = computed(() => {
    const s = props.item.status || 'received';
    return s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
});

const statusBadgeClass = computed(() => {
    const s = props.item.status;
    if (s === 'received' || s === 'scouted') return 'badge-info badge-sm';
    if (s === 'acquired') return 'badge-secondary badge-sm';
    if (s === 'placed') return 'badge-success badge-sm';
    if (s === 'sold') return 'badge-neutral badge-sm';
    return 'badge-ghost badge-sm';
});

const headerBgClass = computed(() => {
    const s = props.item.status;
    if (s === 'received' || s === 'scouted') return 'bg-linear-to-b from-info/80 via-info/40 to-transparent';
    if (s === 'acquired') return 'bg-linear-to-b from-secondary/80 via-secondary/40 to-transparent';
    if (s === 'placed') return 'bg-linear-to-b from-success/80 via-success/40 to-transparent';
    if (s === 'sold') return 'bg-linear-to-b from-neutral/80 via-neutral/40 to-transparent';
    return 'bg-linear-to-b from-base-300/80 via-base-300/40 to-transparent';
});

// --- PRICE PARSING ---
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
    // Try explicit resalePrice
    if (props.item.resalePrice) return props.item.resalePrice;
    
    // Try range properties
    if (props.item.estHigh) return parsePriceObj(props.item.estHigh);
    
    // Try breakdown
    if (props.item.price_breakdown?.fair) return parsePriceObj(props.item.price_breakdown.fair);
    
    // Try note parsing
    return getNoteValue(props.item.conditionNotes, 'Est. High', true) || 0;
});

const paidValue = computed(() => {
    return props.item.cost || props.item.purchasePrice || getNoteValue(props.item.conditionNotes, 'Paid', true) || 0;
});

const formatCurrency = (val) => {
    if(!val || parseFloat(val) === 0) return '-';
    const num = parseFloat(val.toString().replace('$',''));
    return isNaN(num) ? val : '$' + num.toFixed(2);
};

// --- ROI HELPERS ---
const roi = computed(() => {
    const paid = parseFloat(paidValue.value);
    const est = parseFloat(estValue.value);
    
    if (isNaN(paid)) return null;
    if (paid === 0 && est > 0) return 999;
    if (paid === 0) return null;
    if (!est || isNaN(est)) return 0;
    
    const profit = est - paid;
    return Math.round((profit / paid) * 100);
});

const profitColor = computed(() => {
    const paid = parseFloat(paidValue.value) || 0;
    const est = parseFloat(estValue.value);
    
    if (isNaN(est) || isNaN(paid) || (!paid && !est)) return 'bg-warning';
    
    if (est > paid) return 'bg-info'; 
    if (est < paid) return 'bg-error';
    return 'bg-warning'; 
});

const profitWidth = computed(() => {
    const r = roi.value;
    if (r === null || r <= 0) return 'w-full'; 
    if (r < 100) return 'w-1/4';
    if (r <= 200) return 'w-1/2';
    if (r <= 500) return 'w-3/4';
    return 'w-full';
});

// --- IMAGE HELPERS ---
const imageUrl = computed(() => {
    const item = props.item;
    let id = item.imageId;
    if (!id && item.galleryImageIds?.length > 0) id = item.galleryImageIds[0];
    
    if (!id && item.conditionNotes) {
         const match = item.conditionNotes.match(/\[MAIN IMAGE ID: ([^\]]+)\]/);
         if (match) id = match[1].split(',')[0].trim();
    }
    
    if (!id) return null;
    
    // If it's a full http URL, proxy it if needed, or just return it if it's already an appwrite standard url
    if (id.startsWith('http')) {
        if (id.includes('/api/proxy-image') || id.includes('/storage/buckets/')) return id;
        return `/api/proxy-image?url=${encodeURIComponent(id)}`;
    }
    
    return `${ENDPOINT}/storage/buckets/${BUCKET}/files/${id}/view?project=${PROJECT}`;
});
</script>

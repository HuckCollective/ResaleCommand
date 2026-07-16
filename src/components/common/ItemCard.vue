<template>
    <div class="card bg-base-100 shadow-sm border border-base-200 hover:border-primary transition-colors group relative cursor-pointer overflow-hidden flex flex-col"
         :class="containerClass"
         @click="$emit('click-card', item)">
        
        <!-- Image Area -->
        <figure class="bg-base-200 relative overflow-hidden group-hover:opacity-90 transition-opacity flex-none" :class="imageClass">
            <img v-if="imageUrl" :src="imageUrl" :alt="title" class="w-full h-full object-cover" />
            <div v-else class="flex flex-col items-center justify-center w-full h-full opacity-30 bg-base-300 p-2">
                <Icon icon="solar:box-linear" class="w-12 h-12" />
            </div>
            
            <!-- Top Gradient Overlay (Title, Checkbox, Status) -->
            <div class="absolute top-0 left-0 right-0 p-2 z-10 text-white flex flex-col gap-1 min-h-[50%] pointer-events-none" :class="headerBgClass">
                <div class="flex justify-between items-start w-full">
                    <!-- Left: Slot for Checkbox/Menu & Badges -->
                    <div class="pointer-events-auto shrink-0 z-20 flex items-center gap-1.5">
                        <slot name="absolute-top-left"></slot>
                        
                        <div v-if="item.parentLotId" class="badge badge-xs sm:badge-sm bg-base-300/80 border-base-100/50 text-white font-bold backdrop-blur-sm shadow-sm opacity-90" title="Extracted from Lot">
                            <Icon icon="solar:link-minimalistic-bold" class="w-3 h-3 sm:mr-1" /> <span class="hidden sm:inline">Extracted</span>
                        </div>
                        <div v-else-if="item.quantity > 1 || (item.title && item.title.toLowerCase().startsWith('lot of'))" class="badge badge-xs sm:badge-sm bg-base-300/80 border-base-100/50 text-white font-bold backdrop-blur-sm shadow-sm opacity-90" title="Bulk Lot">
                            <Icon icon="solar:box-minimalistic-bold" class="w-3 h-3 sm:mr-1" /> 
                            <span>Lot <span v-if="item.quantity > 1">x{{ item.quantity }}</span><span v-else class="hidden sm:inline">Lot</span></span>
                        </div>
                    </div>
                    
                    <!-- Right: Status Badge -->
                    <div class="badge rounded shadow-sm font-bold opacity-100 border-none pointer-events-auto shrink-0" :class="statusBadgeClass">
                        {{ statusText }}
                    </div>
                </div>
                
                <!-- Title -->
                <h2 class="font-bold leading-tight line-clamp-3 drop-shadow-md mt-1 pointer-events-auto text-shadow" :class="titleClass">
                    {{ title }}
                </h2>
            </div>
            
            <!-- ROI Meter Bar overlaid on bottom of image -->
            <div class="absolute bottom-0 left-0 right-0 h-6 bg-black/50 backdrop-blur-sm overflow-hidden flex items-center">
                <div :class="[profitColor, profitWidth]" class="h-full transition-all duration-500 opacity-90"></div>
                <div class="absolute inset-0 flex justify-between items-center px-2 font-bold z-10 text-[9px] text-white pointer-events-none drop-shadow-md">
                    <span class="opacity-90 tracking-wider text-shadow">Cost: {{ formatCurrency(paidValue) }}</span>
                    <span>
                        <span class="opacity-90 text-shadow">Est: {{ formatCurrency(estValue) }}</span>
                        <span v-if="roi !== null" class="ml-1 opacity-100 border-l border-white/30 pl-1 text-shadow">ROI: {{ roi }}%</span>
                    </span>
                </div>
            </div>
            
            <slot name="image-overlay"></slot>
        </figure>

        <!-- Body Area -->
        <div class="card-body p-2 pt-1 pb-1 gap-1 flex-1 flex flex-col justify-end">
            <!-- Subtitle/Location Slot -->
            <div v-if="locationText" class="text-xs opacity-60 truncate"><Icon icon="solar:map-point-linear" class="w-3 h-3 inline mr-1" />{{ locationText }}</div>
            
            <!-- Tags/Sales Channels -->
            <div v-if="tags && tags.length > 0" class="flex gap-1 flex-wrap mt-1">
                <span v-for="tag in tags" :key="tag" class="badge badge-[10px] badge-outline opacity-70 px-1 py-0">{{ tag }}</span>
            </div>
            

            <!-- Footer Actions Slot (e.g., Quick Add, Delete) -->
            <slot name="actions"></slot>
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
const BUCKET = import.meta.env.PUBLIC_APPWRITE_BUCKET_ID;

// --- COMPUTED STYLES ---
const containerClass = computed(() => props.compact ? 'text-xs' : 'text-sm');
const imageClass = computed(() => props.compact ? 'aspect-[4/5]' : 'aspect-square md:aspect-[4/3] h-48 md:h-auto');
const titleClass = computed(() => props.compact ? 'text-xs h-[2.5em]' : 'text-base h-[3em]');

// --- COMPUTED DATA ---
const title = computed(() => props.item.title || props.item.identity || props.item.itemName || "Untitled Item");
const locationText = computed(() => props.item.binLocation || props.item.purchaseLocation || '');
const tags = computed(() => props.item.salesChannel || []);

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

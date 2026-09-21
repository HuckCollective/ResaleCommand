<template>
    <div class="space-y-3 text-xs">
        <!-- 1. Status Pipeline (Collapsible, open by default) -->
        <details class="collapse collapse-arrow bg-base-200/50 border border-base-300/70 rounded-xl shadow-2xs" open>
            <summary class="collapse-title text-xs font-bold uppercase tracking-wider opacity-80 min-h-0 py-2.5 px-3 flex items-center justify-between">
                <span>Status Pipeline</span>
                <span v-if="filterStatus !== 'active' && filterStatus !== 'all'" class="badge badge-xs badge-warning mr-4 uppercase text-[9px] font-bold">{{ filterStatus }}</span>
            </summary>
            <div class="collapse-content px-3 pb-3 pt-0">
                <ul class="menu menu-xs p-0 gap-0.5 w-full">
                    <li>
                        <button :class="{'active font-bold text-primary': filterStatus === 'active' && hideSold && hideTracked && hideCombined}" @click="selectActiveStock">
                            <Icon icon="solar:box-minimalistic-bold" class="w-3.5 h-3.5" />
                            <span>Active Stock</span>
                            <span class="badge badge-xs badge-neutral">{{ countByStatus('active') }}</span>
                        </button>
                    </li>
                    <li>
                        <button :class="{'active font-bold text-warning': filterStatus === 'acquired'}" @click="selectStatus('acquired')">
                            <span>Acquired</span>
                            <span class="badge badge-xs">{{ countByStatus('acquired') }}</span>
                        </button>
                    </li>
                    <li>
                        <button :class="{'active font-bold text-info': filterStatus === 'received'}" @click="selectStatus('received')">
                            <span>Received</span>
                            <span class="badge badge-xs">{{ countByStatus('received') }}</span>
                        </button>
                    </li>
                    <li>
                        <button :class="{'active font-bold text-success': filterStatus === 'placed'}" @click="selectStatus('placed')">
                            <span>Placed</span>
                            <span class="badge badge-xs">{{ countByStatus('placed') }}</span>
                        </button>
                    </li>
                    <li>
                        <button :class="{'active font-bold text-secondary': filterStatus === 'tracked'}" @click="selectStatus('tracked')">
                            <span>Tracked</span>
                            <span class="badge badge-xs">{{ countByStatus('tracked') }}</span>
                        </button>
                    </li>
                    <li>
                        <button :class="{'active font-bold opacity-75': filterStatus === 'sold'}" @click="selectStatus('sold')">
                            <span>Sold</span>
                            <span class="badge badge-xs">{{ countByStatus('sold') }}</span>
                        </button>
                    </li>
                    <li>
                        <button :class="{'active font-bold': filterStatus === 'all' && !hideSold && !hideTracked && !hideCombined}" @click="selectAllItems">
                            <span>All Items</span>
                            <span class="badge badge-xs">{{ totalCount }}</span>
                        </button>
                    </li>
                </ul>
            </div>
        </details>

        <!-- 2. Location & Channels -->
        <details class="collapse collapse-arrow bg-base-200/50 border border-base-300/70 rounded-xl shadow-2xs" :open="!!(filterLocation && filterLocation !== 'all') || !!(filterChannel && filterChannel !== 'all') || filterLotType !== 'all'">
            <summary class="collapse-title text-xs font-bold uppercase tracking-wider opacity-80 min-h-0 py-2.5 px-3 flex items-center justify-between">
                <span>Location &amp; Channels</span>
                <span v-if="(filterLocation && filterLocation !== 'all') || (filterChannel && filterChannel !== 'all')" class="badge badge-xs badge-primary mr-4 text-[9px] font-bold">Active</span>
            </summary>
            <div class="collapse-content px-3 pb-3 pt-0 space-y-2">
                <div class="form-control w-full">
                    <label class="label pt-1 pb-0.5"><span class="label-text text-[10px] uppercase font-bold opacity-60">Location / Booth</span></label>
                    <select :value="filterLocation" @change="$emit('update:filterLocation', ($event.target as HTMLSelectElement).value)" class="select select-bordered select-xs w-full bg-base-100 font-bold">
                        <option value="all">All Locations</option>
                        <option v-for="loc in locations" :key="loc.value || loc" :value="loc.value || loc">{{ loc.label || loc }}</option>
                    </select>
                </div>

                <div class="form-control w-full">
                    <label class="label pt-1 pb-0.5"><span class="label-text text-[10px] uppercase font-bold opacity-60">Sales Channel</span></label>
                    <select :value="filterChannel" @change="$emit('update:filterChannel', ($event.target as HTMLSelectElement).value)" class="select select-bordered select-xs w-full bg-base-100 font-bold">
                        <option value="all">All Channels</option>
                        <option v-for="ch in channels" :key="ch" :value="ch">{{ ch }}</option>
                    </select>
                </div>

                <div class="form-control w-full">
                    <label class="label pt-1 pb-0.5"><span class="label-text text-[10px] uppercase font-bold opacity-60">Lot Type</span></label>
                    <select :value="filterLotType" @change="$emit('update:filterLotType', ($event.target as HTMLSelectElement).value)" class="select select-bordered select-xs w-full bg-base-100 font-bold">
                        <option value="all">All Items</option>
                        <option value="lots_only">Parent Lots Only</option>
                        <option value="extracted_only">Extracted Children Only</option>
                        <option value="standalone_only">Standalone Items</option>
                    </select>
                </div>

                <div v-if="showKeywords" class="form-control w-full">
                    <label class="label pt-1 pb-0.5"><span class="label-text text-[10px] uppercase font-bold opacity-60">Keywords</span></label>
                    <TagInput 
                        :modelValue="filterKeywords" 
                        @update:modelValue="$emit('update:filterKeywords', $event)" 
                        type="keyword" 
                        placeholder="Any..." 
                        badgeClass="badge-secondary" 
                    />
                </div>
            </div>
        </details>

        <!-- 3. Exclusions ("No-Show") Toggles -->
        <details class="collapse collapse-arrow bg-base-200/50 border border-base-300/70 rounded-xl shadow-2xs" :open="hideSold || hideTracked || hideCombined || filterPlacedLocated">
            <summary class="collapse-title text-xs font-bold uppercase tracking-wider opacity-80 min-h-0 py-2.5 px-3 flex items-center justify-between">
                <span>Exclusions ("No-Show")</span>
            </summary>
            <div class="collapse-content px-3 pb-3 pt-0 space-y-1">
                <label class="label cursor-pointer py-1 justify-between hover:bg-base-200/40 rounded-lg px-1">
                    <span class="label-text text-xs font-semibold text-base-content">Hide Sold Items</span>
                    <input type="checkbox" :checked="hideSold" @change="$emit('update:hideSold', ($event.target as HTMLInputElement).checked)" class="checkbox checkbox-xs checkbox-primary" />
                </label>
                <label class="label cursor-pointer py-1 justify-between hover:bg-base-200/40 rounded-lg px-1">
                    <span class="label-text text-xs font-semibold text-base-content">Hide Trackers / Unacquired</span>
                    <input type="checkbox" :checked="hideTracked" @change="$emit('update:hideTracked', ($event.target as HTMLInputElement).checked)" class="checkbox checkbox-xs checkbox-primary" />
                </label>
                <label class="label cursor-pointer py-1 justify-between hover:bg-base-200/40 rounded-lg px-1">
                    <span class="label-text text-xs font-semibold text-base-content">Hide Merged Lots</span>
                    <input type="checkbox" :checked="hideCombined" @change="$emit('update:hideCombined', ($event.target as HTMLInputElement).checked)" class="checkbox checkbox-xs checkbox-primary" />
                </label>
                <label class="label cursor-pointer py-1 justify-between hover:bg-base-200/40 rounded-lg px-1">
                    <span class="label-text text-xs font-semibold text-base-content">Only Placed &amp; Located</span>
                    <input type="checkbox" :checked="filterPlacedLocated" @change="$emit('update:filterPlacedLocated', ($event.target as HTMLInputElement).checked)" class="checkbox checkbox-xs checkbox-primary" />
                </label>
            </div>
        </details>

        <!-- 4. AI Health Insights -->
        <details class="collapse collapse-arrow bg-base-200/50 border border-base-300/70 rounded-xl shadow-2xs" :open="!!filterInsight">
            <summary class="collapse-title text-xs font-bold uppercase tracking-wider opacity-80 min-h-0 py-2.5 px-3 flex items-center justify-between">
                <span>AI Health Insights</span>
                <span v-if="filterInsight" class="badge badge-xs badge-secondary mr-4 text-[9px] font-bold">Active</span>
            </summary>
            <div class="collapse-content px-3 pb-3 pt-0 space-y-1.5">
                <button 
                    type="button"
                    class="btn btn-xs w-full justify-between" 
                    :class="filterInsight === 'ready_to_list' ? 'btn-primary font-bold shadow-xs' : 'btn-outline border-base-300'" 
                    @click="$emit('update:filterInsight', filterInsight === 'ready_to_list' ? '' : 'ready_to_list')"
                >
                    <span class="flex items-center gap-1"><Icon icon="solar:checklist-linear" class="w-3.5 h-3.5 text-primary" /> Ready to List</span>
                    <span class="badge badge-xs font-mono font-bold">{{ readyToListCount }}</span>
                </button>
                <button 
                    type="button"
                    class="btn btn-xs w-full justify-between" 
                    :class="filterInsight === 'missing_photos' ? 'btn-error font-bold shadow-xs' : 'btn-outline border-base-300'" 
                    @click="$emit('update:filterInsight', filterInsight === 'missing_photos' ? '' : 'missing_photos')"
                >
                    <span class="flex items-center gap-1"><Icon icon="solar:camera-linear" class="w-3.5 h-3.5 text-error" /> Missing Photos</span>
                    <span class="badge badge-xs font-mono font-bold">{{ missingPhotosCount }}</span>
                </button>
                <button 
                    type="button"
                    class="btn btn-xs w-full justify-between" 
                    :class="filterInsight === 'missing_est_value' || filterInsight === 'missing_pricing' ? 'btn-warning font-bold shadow-xs' : 'btn-outline border-base-300'" 
                    @click="$emit('update:filterInsight', (filterInsight === 'missing_est_value' || filterInsight === 'missing_pricing') ? '' : 'missing_est_value')"
                >
                    <span class="flex items-center gap-1"><Icon icon="solar:dollar-linear" class="w-3.5 h-3.5 text-warning" /> Missing Pricing</span>
                    <span class="badge badge-xs font-mono font-bold">{{ missingPricingCount }}</span>
                </button>
            </div>
        </details>

        <!-- 5. Barcodes & Prefixes -->
        <details class="collapse collapse-arrow bg-base-200/50 border border-base-300/70 rounded-xl shadow-2xs" :open="!!(filterBarcode && filterBarcode !== 'all')">
            <summary class="collapse-title text-xs font-bold uppercase tracking-wider opacity-80 min-h-0 py-2.5 px-3 flex items-center justify-between">
                <span>Barcodes &amp; Prefixes</span>
                <span v-if="filterBarcode && filterBarcode !== 'all'" class="badge badge-xs badge-primary mr-4 text-[9px] font-mono font-bold">{{ filterBarcode }}</span>
            </summary>
            <div class="collapse-content px-3 pb-3 pt-0 space-y-1.5">
                <div class="flex flex-wrap gap-1">
                    <button 
                        type="button"
                        v-for="p in (prefixes || []).filter((x: any) => x.prefix !== '__missing__' && x.prefix !== '__numeric__').slice(0, 6)" 
                        :key="p.prefix" 
                        class="badge badge-xs font-mono cursor-pointer transition-colors px-1.5 py-2 font-bold" 
                        :class="filterBarcode === p.prefix ? 'badge-primary font-bold shadow-xs ring-1 ring-primary' : 'badge-outline'" 
                        @click="$emit('update:filterBarcode', filterBarcode === p.prefix ? 'all' : p.prefix)"
                    >
                        {{ p.prefix }} <span class="text-[8px] opacity-60 ml-0.5">{{ p.count }}</span>
                    </button>
                    <button 
                        type="button"
                        v-if="(prefixes || []).find((x: any) => x.prefix === '__missing__')" 
                        class="badge badge-xs cursor-pointer transition-colors px-1.5 py-2 font-bold" 
                        :class="filterBarcode === '__missing__' ? 'badge-error font-bold shadow-xs' : 'badge-outline'" 
                        @click="$emit('update:filterBarcode', filterBarcode === '__missing__' ? 'all' : '__missing__')"
                    >
                        No Barcode
                    </button>
                    <button 
                        type="button"
                        v-if="(prefixes || []).find((x: any) => x.prefix === '__numeric__')" 
                        class="badge badge-xs cursor-pointer transition-colors px-1.5 py-2 font-bold" 
                        :class="filterBarcode === '__numeric__' ? 'badge-info font-bold shadow-xs' : 'badge-outline'" 
                        @click="$emit('update:filterBarcode', filterBarcode === '__numeric__' ? 'all' : '__numeric__')"
                    >
                        Retail Numeric
                    </button>
                </div>
                <input 
                    type="text" 
                    :value="filterBarcode === 'all' || filterBarcode === '__missing__' || filterBarcode === '__numeric__' ? '' : filterBarcode" 
                    @input="$emit('update:filterBarcode', ($event.target as HTMLInputElement).value || 'all')"
                    placeholder="Custom prefix..." 
                    class="input input-bordered input-xs font-mono w-full bg-base-100 text-xs mt-1" 
                />
            </div>
        </details>
    </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
import TagInput from '../common/TagInput.vue';

defineProps({
    filterStatus: {
        type: String,
        default: 'active'
    },
    filterLocation: {
        type: String,
        default: 'all'
    },
    filterChannel: {
        type: String,
        default: 'all'
    },
    filterLotType: {
        type: String,
        default: 'all'
    },
    filterBarcode: {
        type: String,
        default: 'all'
    },
    filterInsight: {
        type: String,
        default: ''
    },
    hideSold: {
        type: Boolean,
        default: true
    },
    hideTracked: {
        type: Boolean,
        default: true
    },
    hideCombined: {
        type: Boolean,
        default: true
    },
    filterPlacedLocated: {
        type: Boolean,
        default: false
    },
    filterKeywords: {
        type: Array as () => string[],
        default: () => []
    },
    locations: {
        type: Array as () => any[],
        default: () => []
    },
    channels: {
        type: Array as () => string[],
        default: () => []
    },
    prefixes: {
        type: Array as () => any[],
        default: () => []
    },
    countByStatus: {
        type: Function,
        default: () => 0
    },
    readyToListCount: {
        type: Number,
        default: 0
    },
    missingPhotosCount: {
        type: Number,
        default: 0
    },
    missingPricingCount: {
        type: Number,
        default: 0
    },
    totalCount: {
        type: Number,
        default: 0
    },
    showKeywords: {
        type: Boolean,
        default: true
    }
});

const emit = defineEmits([
    'update:filterStatus',
    'update:filterLocation',
    'update:filterChannel',
    'update:filterLotType',
    'update:filterBarcode',
    'update:filterInsight',
    'update:hideSold',
    'update:hideTracked',
    'update:hideCombined',
    'update:filterPlacedLocated',
    'update:filterKeywords'
]);

const selectActiveStock = () => {
    emit('update:filterStatus', 'active');
    emit('update:hideSold', true);
    emit('update:hideTracked', true);
    emit('update:hideCombined', true);
};

const selectAllItems = () => {
    emit('update:filterStatus', 'all');
    emit('update:hideSold', false);
    emit('update:hideTracked', false);
    emit('update:hideCombined', false);
};

const selectStatus = (st: string) => {
    if (st === 'sold') {
        emit('update:hideSold', false);
    } else if (st === 'tracked') {
        emit('update:hideTracked', false);
    }
    emit('update:filterStatus', st);
};
</script>

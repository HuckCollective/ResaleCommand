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
                    <button v-if="item && item.quantity > 1 && item.status !== 'sold'" 
                            class="btn btn-xs btn-primary font-bold shadow-sm"
                            @click="openSellOneModal">
                        <Icon icon="solar:tag-linear" class="w-3.5 h-3.5 mr-1" /> Sell One
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
                                <a v-if="locationText.startsWith('http')" :href="locationText" target="_blank" class="text-primary underline decoration-primary/40 underline-offset-2 flex items-center gap-1 truncate max-w-[200px] md:max-w-[400px]" :title="locationText">
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
                    <div v-if="item && (item.quantity > 1 || childItems.length > 0)" class="mt-6 border border-base-300 rounded-2xl overflow-hidden bg-base-100 shadow-lg">
                        <div class="bg-base-200 p-4 border-b border-base-300 flex justify-between items-center">
                            <div>
                                <h3 class="font-bold text-sm uppercase tracking-wider text-base-content flex items-center gap-1.5">
                                    <Icon icon="solar:chart-square-linear" class="w-5 h-5 text-primary" />
                                    Lot Dashboard
                                </h3>
                                <p class="text-[10px] opacity-60 mt-0.5">Track cost allocation, sales, and total return on investment for this group purchase.</p>
                            </div>
                            <span class="badge badge-primary font-mono text-xs font-bold">x{{ item.quantity }} Unsold</span>
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
                            <span class="text-[10px] font-bold uppercase opacity-50 tracking-wider block mb-2">Sold items from this lot ({{ childItems.length }})</span>
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
                                            <td class="font-bold truncate max-w-[200px]">
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
    </div>

    <!-- SELL ONE MODAL -->
    <dialog id="sell_one_modal" class="modal" :class="{ 'modal-open': isSellOneModalOpen }">
        <div class="modal-box bg-base-100 p-6 border border-base-200 relative">
            <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" @click="closeSellOneModal">✕</button>
            <h3 class="font-bold text-lg flex items-center gap-2"><Icon icon="solar:tag-linear" class="text-primary w-5 h-5" /> Sell One from Lot</h3>
            <p class="text-xs opacity-70 mt-1">This will decrement the lot's quantity by 1 and split off a separate sold item.</p>
            
            <div class="form-control w-full mt-4">
                <label class="label"><span class="label-text font-bold text-xs uppercase opacity-75">Sold Item Title</span></label>
                <input v-model="sellOneForm.title" type="text" class="input input-bordered w-full font-bold" placeholder="e.g. Harry Potter Book 1" />
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
const BUCKET = import.meta.env.PUBLIC_APPWRITE_BUCKET_ID;

const childItems = ref([]);

// Sell One Form state
const isSellOneModalOpen = ref(false);
const submittingSellOne = ref(false);
const sellOneForm = reactive({
    title: '',
    soldPrice: '',
    commissionPaid: '0'
});

import { reactive } from 'vue';

const openSellOneModal = () => {
    sellOneForm.title = item.value ? `${item.value.title} (Copy)` : '';
    sellOneForm.soldPrice = '';
    sellOneForm.commissionPaid = '0';
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
        const unitCost = qty > 1 ? (totalCost / qty) : totalCost;
        
        const newQty = qty - 1;
        const newCost = Math.max(0, totalCost - unitCost);
        
        const childDoc = {
            title: sellOneForm.title,
            identity: sellOneForm.title,
            conditionNotes: `Sold from Lot: ${item.value.title} (${item.value.$id})`,
            status: 'sold',
            cost: unitCost,
            soldPrice: parseFloat(sellOneForm.soldPrice) || 0,
            commissionPaid: parseFloat(sellOneForm.commissionPaid) || 0,
            parentLotId: item.value.$id,
            quantity: 1,
            tenantId: item.value.tenantId || null,
            userId: item.value.userId || null,
            storageLocation: item.value.storageLocation || null,
            sourcingLocation: item.value.sourcingLocation || null
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

const originalLotCost = computed(() => {
    if (!item.value) return 0;
    return Number(item.value.cost || 0) + childItems.value.reduce((acc, c) => acc + Number(c.cost || 0), 0);
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
            const childRes = await databases.listDocuments(DB_ID, collId, [
                Query.equal('parentLotId', item.value.$id),
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
    if (s === 'received' || s === 'scouted') return 'badge-info';
    if (s === 'acquired') return 'badge-secondary';
    if (s === 'placed') return 'badge-success';
    if (s === 'sold') return 'badge-neutral';
    return 'badge-ghost';
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
            const downloadUrl = `${ENDPOINT}/storage/buckets/reports/files/${id}/download?project=${PROJECT}`;
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

const getAssetUrl = (id) => `${ENDPOINT}/storage/buckets/${BUCKET}/files/${id}/view?project=${PROJECT}`;

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

</script>

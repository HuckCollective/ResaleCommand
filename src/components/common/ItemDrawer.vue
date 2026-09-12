<template>
    <Teleport to="body">
        <div class="relative z-400">
            <!-- Backdrop -->
            <div class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" @click="closeDrawer"></div>

            <!-- Drawer Container: Mobile full-width, Desktop expanded (860px / 980px) -->
            <div class="fixed inset-y-0 right-0 w-full md:w-155 lg:w-220 xl:w-250 bg-base-100 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out">
                
                <!-- 1. STICKY HEADER (Extracted Subcomponent) -->
                <ItemDrawerHeader :item="item" @close="closeDrawer" />

                <!-- 2. TABS (Details, Verify, Lot) -->
                <div class="px-4 sm:px-6 pt-1 pb-0 bg-base-100 border-b border-base-200 flex-none z-20">
                    <div role="tablist" class="tabs tabs-bordered font-bold w-full">
                        <a role="tab" class="tab flex-1 text-xs sm:text-sm py-2" :class="{'tab-active text-primary': mainTab === 'details'}" @click="mainTab = 'details'">
                            <Icon icon="solar:notes-linear" class="w-4 h-4 mr-1.5 inline" /> Listing Details
                        </a>
                        <a role="tab" class="tab flex-1 text-xs sm:text-sm py-2" :class="{'tab-active text-primary': mainTab === 'verify'}" @click="mainTab = 'verify'">
                            <Icon icon="solar:checklist-minimalistic-linear" class="w-4 h-4 mr-1.5 inline" /> Checklist / Verify
                        </a>
                        <a v-if="item" role="tab" class="tab flex-1 text-xs sm:text-sm py-2" :class="{'tab-active text-secondary font-bold': mainTab === 'lot'}" @click="mainTab = 'lot'">
                            <Icon icon="solar:box-linear" class="w-4 h-4 mr-1.5 inline" />
                            <span v-if="props.item?.parentLotId">Lot Lineage</span>
                            <span v-else-if="lotChildren?.length > 0">Lot Hub ({{ lotChildren.length }})</span>
                            <span v-else>Lot Tools</span>
                        </a>
                    </div>
                </div>

                <!-- 3. LISTING DETAILS TAB (Extracted Subcomponent) -->
                <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6" v-show="mainTab === 'details'">
                    <ItemDetailsTab
                        :editForm="editForm"
                        :item="item"
                        :parentItem="parentItem"
                        :lotChildren="lotChildren"
                        v-model:isAcquisitionUnlocked="isAcquisitionUnlocked"
                        v-model:showOnStorefront="showOnStorefront"
                        v-model:saveIndividually="saveIndividually"
                        v-model:descTab="descTab"
                        :allLocations="allLocations"
                        :calculatedMargin="calculatedMargin"
                        :suggestedTitleStr="suggestedTitleStr"
                        :analyzing="analyzing"
                        :analysisStatus="analysisStatus"
                        :scoutResult="scoutResult"
                        :scoutPurchaseStrategy="scoutPurchaseStrategy"
                        :scoutItemsArray="scoutItemsArray"
                        :scoutTotalRange="scoutTotalRange"
                        :scoutMdText="scoutMdText"
                        :generatingDescription="generatingDescription"
                        :fetchedImages="fetchedImages"
                        :fetchingImages="fetchingImages"
                        :downloadingImageUrls="downloadingImageUrls"
                        @open-lot-tab="mainTab = 'lot'"
                        @open-splitter="isLotSplitterOpen = true"
                        @copy-title="copyToClipboard(editForm.title)"
                        @fetch-source-data="fetchSourceData"
                        @add-all-fetched-images="addAllFetchedImages"
                        @dismiss-fetched-images="fetchedImages = []"
                        @select-fetched-image="selectFetchedImage"
                        @sell-one-quantity="sellOneQuantity"
                        @split-one-active="splitOneActive"
                        @apply-price-tier="applyPriceTier"
                        @deconstruct-ai-lot="deconstructAiLot"
                        @apply-bundle-suggestions="applyBundleSuggestions"
                        @open-md-modal="openMdModal"
                        @generate-description="generateDescription"
                    >
                        <template #gallery-manager>
                            <PhotoGalleryManager 
                                v-model:existing-images="editForm.existingGalleryIds"
                                v-model:new-photos="editGalleryBuffer"
                                v-model:main-selection="mainPhotoSelection"
                                :scanner-widget="scannerWidget"
                                @open-camera="scannerWidget?.startCamera()"
                            />
                        </template>
                    </ItemDetailsTab>
                    <div class="h-10"></div>
                </div>

                <!-- 4. CHECKLIST / VERIFY TAB (Extracted Subcomponent) -->
                <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5" v-show="mainTab === 'verify'">
                    <ItemVerifyTab
                        :componentsList="componentsList"
                        :extracting="extracting"
                        @photos-captured="handleVerifyPhotosCaptured"
                        @clear="componentsList = []"
                    />
                </div>

                <!-- 5. LOT DASHBOARD & LINEAGE TAB (Extracted Subcomponent) -->
                <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5" v-show="mainTab === 'lot'">
                    <ItemLotTab
                        :item="item"
                        :parentItem="parentItem"
                        :lotChildren="lotChildren"
                        :uncombining="uncombining"
                        :lotDashboardItem="lotDashboardItem"
                        :totalSplitResaleValue="totalSplitResaleValue"
                        :lotRealizedRevenue="lotRealizedRevenue"
                        :lotROI="lotROI"
                        @selectItem="$emit('selectItem', $event)"
                        @open-splitter="isLotSplitterOpen = true"
                        @uncombine="uncombineLot"
                    />
                </div>

                <!-- 6. STICKY ACTION TOOLBAR FOOTER (Extracted Subcomponent) -->
                <ItemDrawerFooter
                    :analyzing="analyzing"
                    :analysisStatus="analysisStatus"
                    :hasScoutResult="!!scoutResult"
                    :canAnalyze="canAnalyze"
                    :processing="processing"
                    @analyze="analyzeExistingItem"
                    @cancel="closeDrawer"
                    @save="saveEdit"
                />
            </div>

            <!-- Visual Photo Selector Modal for Bundle Components -->
            <dialog id="photo_picker_modal" class="modal" :class="{'modal-open': pickingPhotoForItemIndex !== null}">
                <div class="modal-box max-w-2xl bg-base-100 p-5 rounded-2xl border border-base-200 shadow-2xl">
                    <div class="flex justify-between items-center pb-3 border-b border-base-200">
                        <div class="flex items-center gap-2">
                            <Icon icon="solar:gallery-wide-bold" class="w-5 h-5 text-primary" />
                            <h3 class="font-bold text-sm sm:text-base">
                                Choose Photo for Item #{{ pickingPhotoForItemIndex !== null ? pickingPhotoForItemIndex + 1 : '' }}
                            </h3>
                        </div>
                        <button class="btn btn-sm btn-circle btn-ghost" @click="pickingPhotoForItemIndex = null">✕</button>
                    </div>

                    <p class="text-xs opacity-60 mt-2">
                        Select a photo from the gallery to assign as the primary image for this bundle item:
                    </p>

                    <div v-if="allAvailableGalleryUrls.length > 0" class="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-4 max-h-[50vh] overflow-y-auto p-1">
                        <div 
                            v-for="(photoUrl, pIdx) in allAvailableGalleryUrls" 
                            :key="pIdx"
                            @click="assignPhotoToComponent(pickingPhotoForItemIndex, photoUrl, pIdx)"
                            class="aspect-square rounded-xl overflow-hidden border-2 cursor-pointer relative group transition-all"
                            :class="isPhotoAssigned(pickingPhotoForItemIndex, pIdx) ? 'border-primary ring-2 ring-primary/40' : 'border-base-300 hover:border-primary/50'"
                        >
                            <img :src="photoUrl" class="w-full h-full object-cover" />
                            <div class="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                                Photo {{ pIdx + 1 }}
                            </div>
                            <div v-if="isPhotoAssigned(pickingPhotoForItemIndex, pIdx)" class="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                <Icon icon="solar:check-circle-bold" class="w-6 h-6 text-primary" />
                            </div>
                        </div>
                    </div>
                    <div v-else class="text-center py-8 opacity-40 text-xs italic">
                        No gallery photos available yet. Fetch or upload photos first.
                    </div>

                    <div class="modal-action border-t border-base-200 pt-3">
                        <button class="btn btn-sm" @click="pickingPhotoForItemIndex = null">Done</button>
                    </div>
                </div>
                <form method="dialog" class="modal-backdrop" @click="pickingPhotoForItemIndex = null">
                    <button>close</button>
                </form>
            </dialog>

            <!-- Full Markdown Scout Report Modal -->
            <dialog v-if="showMdModal" class="modal modal-open z-999">
                <div class="modal-box max-w-3xl max-h-[85vh] flex flex-col p-6">
                    <div class="flex justify-between items-center pb-3 border-b border-base-300">
                        <h3 class="font-bold text-base flex items-center gap-2">
                            <Icon icon="solar:document-text-bold" class="w-5 h-5 text-primary" />
                            AI Deep Research Report
                        </h3>
                        <button class="btn btn-sm btn-circle btn-ghost" @click="showMdModal = false">✕</button>
                    </div>
                    <div class="flex-1 overflow-y-auto py-4 prose prose-sm max-w-none" v-html="renderMarkdown(scoutMdText)">
                    </div>
                    <div class="modal-action border-t border-base-300 pt-3 flex justify-between">
                        <button class="btn btn-sm btn-outline gap-1" @click="copyToClipboard(scoutMdText)">
                            <Icon icon="solar:copy-linear" class="w-4 h-4" /> Copy Report
                        </button>
                        <button class="btn btn-sm btn-primary" @click="showMdModal = false">Close</button>
                    </div>
                </div>
                <form method="dialog" class="modal-backdrop" @click="showMdModal = false">
                    <button>close</button>
                </form>
            </dialog>

            <!-- Dynamic Lot Splitter Wizard -->
            <LotSplitterWizard 
                :isOpen="isLotSplitterOpen" 
                :lotItem="lotSplitterItemData" 
                @close="isLotSplitterOpen = false" 
                @completed="onLotSplitCompleted" 
            />

            <!-- Camera / Photo Scanner -->
            <ScannerWidget 
                ref="scannerWidget" 
                :photos="editGalleryBuffer" 
                :hide-all-triggers="true" 
                @photos-captured="handleCapturedPhotos" 
                @remove-photo="removeGalleryItem($event, false)" 
            />

            <!-- Full-Resolution Image Zoom Lightbox Modal -->
            <dialog class="modal modal-middle z-50" :class="{ 'modal-open': !!previewZoomUrl }">
                <div class="modal-box max-w-2xl p-4 bg-base-100 rounded-2xl shadow-2xl border border-base-300">
                    <div class="flex items-center justify-between pb-2 border-b border-base-200">
                        <span class="text-xs font-bold text-base-content flex items-center gap-1.5">
                            <Icon icon="solar:magnifer-zoom-in-bold" class="w-4 h-4 text-primary" />
                            Full-Resolution Photo Preview
                        </span>
                        <button type="button" @click="closeZoomPreview" class="btn btn-xs btn-circle btn-ghost">✕</button>
                    </div>
                    <div class="py-3 flex items-center justify-center max-h-[70vh] overflow-auto">
                        <img v-if="previewZoomUrl" :src="previewZoomUrl" class="max-w-full max-h-[65vh] object-contain rounded-xl shadow-md" />
                    </div>
                    <div class="modal-action mt-2">
                        <button type="button" class="btn btn-sm btn-primary w-full rounded-xl font-bold" @click="closeZoomPreview">Close Preview</button>
                    </div>
                </div>
                <form method="dialog" class="modal-backdrop">
                    <button type="button" @click="closeZoomPreview">close</button>
                </form>
            </dialog>
        </div>
    </Teleport>
</template>

<script setup>
import { ref, reactive, watch, computed, onMounted, onUnmounted } from 'vue';
import { marked } from 'marked';
import { Icon } from '@iconify/vue';
import PhotoGalleryManager from './PhotoGalleryManager.vue';
import ScannerWidget from './ScannerWidget.vue';
import LotSplitterWizard from '../inventory/LotSplitterWizard.vue';

// Decomposed Subcomponents & Composables
import ItemDrawerHeader from './drawer/ItemDrawerHeader.vue';
import ItemDrawerFooter from './drawer/ItemDrawerFooter.vue';
import ItemDetailsTab from './drawer/ItemDetailsTab.vue';
import ItemVerifyTab from './drawer/ItemVerifyTab.vue';
import ItemLotTab from './drawer/ItemLotTab.vue';
import { useItemDrawerForm } from '../../composables/useItemDrawerForm';

import { saveItemToInventory, getCollectionId, BUCKET_ID, REPORTS_BUCKET_ID } from '../../lib/inventory';
import { account, databases, Query } from '../../lib/appwrite';
import { useAuth } from '../../composables/useAuth';
import { addToast } from '../../stores/toast';
import { confirmDialog } from '../../stores/confirm';
import { useLoader } from '../../composables/useLoader';
import { warehousesApi } from '../../lib/warehouses';

const { currentTeam } = useAuth();
const { showLoader, hideLoader, updateLoader } = useLoader();
const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
const orgPlacedLocations = ref([]);
const orgWarehouses = ref([]);

const allLocations = computed(() => {
    const set = new Set();
    ['HG', 'HD', 'MD', 'DT'].forEach(c => set.add(c));
    if (orgWarehouses.value) {
        orgWarehouses.value.forEach(w => {
            if (w?.code) set.add(String(w.code).trim().toUpperCase());
            if (w?.name) set.add(String(w.name).trim());
        });
    }
    if (orgPlacedLocations.value) orgPlacedLocations.value.forEach(l => l && set.add(String(l).trim()));
    return Array.from(set).filter(Boolean).sort();
});

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

    try {
        const wList = await warehousesApi.listWarehouses(currentTeam.value.$id);
        orgWarehouses.value = wList || [];
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

const PROJECT = import.meta.env.PUBLIC_APPWRITE_PROJECT_ID;
const ENDPOINT = import.meta.env.PUBLIC_APPWRITE_ENDPOINT;
const BUCKET = BUCKET_ID;

const props = defineProps({
    item: {
        type: Object,
        default: null
    },
    isOpen: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['close', 'save', 'saved', 'uncombined', 'deconstruct', 'selectItem']);

// Form Composable
const {
    editForm,
    calculatedMargin,
    isAcquisitionUnlocked,
    initForm: initFormState
} = useItemDrawerForm();

const mainTab = ref('details');
const descTab = ref('edit');
const processing = ref(false);
const showMdModal = ref(false);
const isLotSplitterOpen = ref(false);

const lotSplitterItemData = computed(() => {
    if (!props.item) return null;
    return {
        ...props.item,
        cost: editForm.cost || props.item.cost,
        purchasePrice: editForm.purchasePrice || props.item.purchasePrice,
        title: editForm.title || props.item.title,
        quantity: editForm.quantity || props.item.quantity,
        rawAnalysis: scoutResult.value || props.item.rawAnalysis,
        components: (scoutItemsArray.value && scoutItemsArray.value.length > 0) ? scoutItemsArray.value : props.item.components,
        images: (allAvailableGalleryUrls.value && allAvailableGalleryUrls.value.length > 0) ? allAvailableGalleryUrls.value : props.item.images
    };
});

const onLotSplitCompleted = async () => {
    isLotSplitterOpen.value = false;
    emit('save');
    emit('saved');
    emit('uncombined');
    closeDrawer();
};

const openMdModal = () => {
    if (scoutMdText.value) {
        showMdModal.value = true;
    }
};

const extracting = ref(false);
const componentsList = ref([]);

const formatSourceDisplayName = (urlOrStr) => {
    if (!urlOrStr) return '';
    if (urlOrStr.includes('shopgoodwill.com')) return 'ShopGoodwill';
    if (urlOrStr.includes('ebay.com')) return 'eBay';
    if (urlOrStr.includes('poshmark.com')) return 'Poshmark';
    if (urlOrStr.includes('goodwillfinds.com')) return 'GoodwillFinds';
    return urlOrStr.length > 22 ? urlOrStr.substring(0, 20) + '...' : urlOrStr;
};

const performExtraction = async (imagesPayload) => {
    extracting.value = true;
    try {
        const bodyObj = { notes: scoutQuery.value };
        if (Array.isArray(imagesPayload)) {
            bodyObj.images = imagesPayload;
        } else {
            bodyObj.image = imagesPayload;
        }
        const res = await fetch('/api/extract-components', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyObj)
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
    try {
        const reader = new FileReader();
        reader.onload = async (e) => {
            await performExtraction(e.target.result);
        };
        reader.readAsDataURL(file);
    } catch (e) {
        addToast({ type: 'error', message: "File read error: " + e.message });
    }
};

const handleVerifyPhotosCaptured = async (files) => {
    if (!files || files.length === 0) return;
    if (files.length === 1) {
        extractComponentsFromFile(files[0]);
    } else {
        const base64List = await Promise.all(
            Array.from(files).slice(0, 10).map(file => new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(file);
            }))
        );
        const valid = base64List.filter(Boolean);
        if (valid.length > 0) {
            performExtraction(valid);
        }
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

const editGalleryBuffer = ref([]);
const mainPhotoSelection = ref({ type: 'none', val: null });

const actualMainPhoto = computed(() => {
    if (mainPhotoSelection.value?.type === 'new' && editGalleryBuffer.value?.[mainPhotoSelection.value?.val]) {
        return { 
            file: editGalleryBuffer.value[mainPhotoSelection.value.val], 
            url: getObjectUrl(editGalleryBuffer.value[mainPhotoSelection.value.val]),
            type: 'new',
            idx: mainPhotoSelection.value.val
        };
    } else if (mainPhotoSelection.value?.type === 'existing' && Array.isArray(editForm.existingGalleryIds) && editForm.existingGalleryIds.includes(mainPhotoSelection.value?.val)) {
        return { 
            file: null, 
            url: getAssetUrl(mainPhotoSelection.value.val), 
            id: mainPhotoSelection.value.val,
            type: 'existing'
        };
    } else {
        if (editGalleryBuffer.value?.length > 0) return { file: editGalleryBuffer.value[0], url: getObjectUrl(editGalleryBuffer.value[0]), type: 'new', idx: 0 };
        if (editForm.existingGalleryIds?.length > 0) return { file: null, url: getAssetUrl(editForm.existingGalleryIds[0]), id: editForm.existingGalleryIds[0], type: 'existing' };
        return { file: null, url: null, type: 'none', id: null, idx: null };
    }
});

const canAnalyze = computed(() => {
    return !!(actualMainPhoto.value?.url || editForm.sourcingLocation || editForm.title || editForm.condition_notes || (editForm.existingGalleryIds && editForm.existingGalleryIds.length > 0));
});

const previewZoomUrl = ref(null);
const openZoomPreview = (url) => {
    if (!url) return;
    previewZoomUrl.value = url;
};
const closeZoomPreview = () => {
    previewZoomUrl.value = null;
};

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

const scoutResult = ref(null);

const scoutItemsArray = computed(() => {
    if (!scoutResult.value) return [];
    if (scoutResult.value.lot_items && Array.isArray(scoutResult.value.lot_items)) {
        return scoutResult.value.lot_items;
    }
    if (Array.isArray(scoutResult.value)) {
        if (scoutResult.value.length === 1 && scoutResult.value[0]?.lot_items && Array.isArray(scoutResult.value[0].lot_items)) {
            return scoutResult.value[0].lot_items;
        }
        if (scoutResult.value[0]?.lot_items && Array.isArray(scoutResult.value[0].lot_items)) {
            return scoutResult.value[0].lot_items;
        }
        return scoutResult.value;
    }
    if (scoutResult.value.items && Array.isArray(scoutResult.value.items)) return scoutResult.value.items;
    return [scoutResult.value];
});

const cropPreviews = ref({});

const suggestedTitleStr = computed(() => {
    if (!scoutResult.value) return null;
    if (scoutResult.value.title) return scoutResult.value.title;
    if (scoutResult.value.items && Array.isArray(scoutResult.value.items) && scoutResult.value.items.length > 0) {
        return scoutResult.value.items[0].title || scoutResult.value.items[0].identity || null;
    }
    if (Array.isArray(scoutResult.value) && scoutResult.value.length > 0) {
        return scoutResult.value[0].title || scoutResult.value[0].identity || null;
    }
    return null;
});

const scoutPurchaseStrategy = computed(() => {
    if (!scoutResult.value) return null;
    if (scoutResult.value.purchase_strategy) return scoutResult.value.purchase_strategy;
    if (Array.isArray(scoutResult.value) && scoutResult.value[0]?.purchase_strategy) return scoutResult.value[0].purchase_strategy;
    if (scoutResult.value.items && Array.isArray(scoutResult.value.items) && scoutResult.value.items[0]?.purchase_strategy) return scoutResult.value.items[0].purchase_strategy;
    return null;
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
        const mint = parseLowHigh(resItem.price_breakdown?.mint);
        mintLow += mint.low;
        mintHigh += mint.high;

        const fair = parseLowHigh(resItem.price_breakdown?.fair || resItem.estimated_value);
        fairLow += fair.low;
        fairHigh += fair.high;

        const poor = parseLowHigh(resItem.price_breakdown?.poor);
        poorLow += poor.low;
        poorHigh += poor.high;

        if (resItem.price_breakdown?.boutique_premium) {
            const b = parseLowHigh(resItem.price_breakdown.boutique_premium);
            boutiqueLow += b.low;
            boutiqueHigh += b.high;
        } else {
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
        mint: { low: mintLow, high: mintHigh, formatted: formatRange(mintLow, mintHigh) },
        fair: { low: fairLow, high: fairHigh, formatted: formatRange(fairLow, fairHigh) },
        poor: { low: poorLow, high: poorHigh, formatted: formatRange(poorLow, poorHigh) },
        boutique: { low: boutiqueLow, high: boutiqueHigh, formatted: formatRange(boutiqueLow, boutiqueHigh) }
    };
});

const scoutMdText = ref(null);
const scoutQuery = ref('');
const fetchedImages = ref([]);
const downloadingImageUrls = ref({});
const fetchingImages = ref(false);
const analyzing = ref(false);
const analysisStatus = ref('');
const saveIndividually = ref(false);
const generatingDescription = ref(false);

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

const getAssetUrl = (id) => {
    if (!id) return '';
    if (typeof id === 'string') {
        if (id.startsWith('http') || id.startsWith('data:') || id.startsWith('blob:') || id.startsWith('/api/')) {
            return proxify(id);
        }
    }
    if (!BUCKET) return '';
    return `${ENDPOINT}/storage/buckets/${BUCKET}/files/${id}/view?project=${PROJECT}`;
};

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

const applyPriceTier = (priceVal) => {
    const p = parsePrice(priceVal);
    if (p > 0) {
        editForm.resalePrice = p.toFixed(2);
        addToast({ type: 'success', message: `Applied List Price: $${p.toFixed(2)}` });
    }
};

const pickingPhotoForItemIndex = ref(null);

const allAvailableGalleryUrls = computed(() => {
    const urls = [];
    if (actualMainPhoto.value?.url) urls.push(actualMainPhoto.value.url);
    if (editForm.existingGalleryIds) {
        editForm.existingGalleryIds.forEach(id => {
            const u = getAssetUrl(id);
            if (u && !urls.includes(u)) urls.push(u);
        });
    }
    if (editGalleryBuffer.value) {
        editGalleryBuffer.value.forEach(file => {
            const u = getObjectUrl(file);
            if (u && !urls.includes(u)) urls.push(u);
        });
    }
    if (urls.length === 0 && props.item?.imageId) {
        urls.push(getAssetUrl(props.item.imageId));
    }
    return urls;
});

const assignPhotoToComponent = (itemIdx, photoUrl, photoIdx) => {
    if (itemIdx === null || itemIdx === undefined) return;
    const list = scoutItemsArray.value;
    if (!list || !list[itemIdx]) return;

    const item = list[itemIdx];
    item.image_index = photoIdx;
    item.image = photoUrl;
    item.bounding_box = null;
    cropPreviews.value[itemIdx] = photoUrl;
    pickingPhotoForItemIndex.value = null;
    addToast({ type: 'success', message: `Assigned Photo ${photoIdx + 1} to Item #${itemIdx + 1}` });
};

const isPhotoAssigned = (itemIdx, photoIdx) => {
    if (itemIdx === null || itemIdx === undefined) return false;
    const item = scoutItemsArray.value[itemIdx];
    if (!item) return false;
    return item.image_index === photoIdx;
};

const lotChildren = ref([]);
const parentItem = ref(null);
const loadingLot = ref(false);
const creatingChild = ref(false);

const lotDashboardItem = computed(() => parentItem.value || props.item);
const lotSoldChildren = computed(() => (lotChildren.value || []).filter(c => c.status === 'sold'));
const lotRealizedRevenue = computed(() => lotSoldChildren.value.reduce((sum, c) => sum + (Number(c.soldPrice) || 0), 0));
const lotROI = computed(() => lotRealizedRevenue.value - Number(lotDashboardItem.value?.cost || 0));
const totalSplitResaleValue = computed(() => {
    return (lotChildren.value || []).reduce((sum, c) => sum + (Number(c.resalePrice || 0) * Number(c.quantity || 1)), 0);
});

async function fetchLotChildren() {
    if (!props.item || !props.item.$id) return;
    loadingLot.value = true;
    parentItem.value = null;
    lotChildren.value = [];

    try {
        if (props.item.parentLotId) {
            try {
                const pDoc = await databases.getDocument(DB_ID, getCollectionId(), props.item.parentLotId);
                parentItem.value = pDoc;
            } catch (pErr) {
                console.warn("Could not fetch parent lot doc:", pErr);
            }
        }

        const targetParentId = props.item.parentLotId || props.item.$id;
        const res = await databases.listDocuments(DB_ID, getCollectionId(), [
            Query.equal('parentLotId', targetParentId),
            Query.orderAsc('upc'),
            Query.limit(100)
        ]);
        lotChildren.value = res.documents || [];
    } catch (e) {
        console.error("Failed to fetch lot items:", e);
    } finally {
        loadingLot.value = false;
    }
}

const uncombining = ref(false);
const uncombineLot = async () => {
    if (!props.item || !props.item.$id) return;
    const count = lotChildren.value.length;
    const confirmMsg = count > 0 
        ? `Rollback & uncombine this lot? This will restore all ${count} individual items back to active inventory and delete this combined master lot.`
        : `Uncombine and remove this master lot?`;
    
    if (!window.confirm(confirmMsg)) return;

    uncombining.value = true;
    showLoader("Rolling back lot...", {
        step: "Restoring original items & removing master lot...",
        progress: 50,
        cancelable: false
    });

    try {
        for (const child of lotChildren.value) {
            await databases.updateDocument(DB_ID, getCollectionId(), child.$id, {
                parentLotId: null,
                status: (child.status === 'combined' || child.status === 'archived') ? 'acquired' : child.status
            });
        }

        await databases.deleteDocument(DB_ID, getCollectionId(), props.item.$id);

        addToast({ type: 'success', message: `Successfully rolled back lot and restored ${count} items!` });
        emit('uncombined');
        emit('close');
    } catch (e) {
        addToast({ type: 'error', message: 'Rollback failed: ' + e.message });
    } finally {
        uncombining.value = false;
        hideLoader();
    }
};

const initForm = () => {
    initFormState(props.item);

    if (props.item) {
        const i = props.item;
        let activeImageId = null;
        if (i.imageId) {
            activeImageId = i.imageId;
        } else if (i.galleryImageIds?.length > 0) {
            activeImageId = i.galleryImageIds[0];
        }

        if (activeImageId) {
            if (!editForm.existingGalleryIds.includes(activeImageId)) {
                editForm.existingGalleryIds.unshift(activeImageId);
            }
            mainPhotoSelection.value = { type: 'existing', val: activeImageId };
        } else {
            mainPhotoSelection.value = { type: 'none', val: null };
        }
        
        scoutResult.value = null;
        scoutMdText.value = null;

        if (i.rawAnalysis) {
            try {
                const parsed = JSON.parse(i.rawAnalysis);
                scoutResult.value = parsed;
            } catch (e) {}
        }
    } else {
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
    fetchLotChildren();
};

watch(() => props.item, initForm, { immediate: true });

const closeDrawer = () => {
    emit('close');
};

let descAbortController = new AbortController();

const generateDescription = async () => {
    if (!props.item) return;
    const idToUpdate = props.item.$id;
    if (!idToUpdate) return;
    generatingDescription.value = true;
    descAbortController = new AbortController();

    showLoader("Generating Listing Description...", {
        step: "Gemini is crafting customer-facing marketplace copy...",
        progress: 50,
        basket: 'solar:magic-stick-bold-duotone',
        cancelable: false
    });

    try {
        if (actualMainPhoto.value.type === 'new' && actualMainPhoto.value.file) {
            addToast({ type: 'info', message: "Please save item first so new photo is uploaded." });
            return;
        }

        let jwt = null;
        try {
            const jwtRes = await account.createJWT();
            jwt = jwtRes.jwt;
        } catch (jwtErr) {}

        const headers = { 'Content-Type': 'application/json' };
        if (jwt) headers['X-Appwrite-JWT'] = jwt;

        const res = await fetch('/api/generate-description', {
            method: 'POST',
            headers,
            body: JSON.stringify({ itemId: idToUpdate }),
            signal: descAbortController.signal
        });
        const data = await res.json();
        if(data.success && data.description) {
            editForm.description = data.description;
            descTab.value = 'preview';
            addToast({ type: 'success', message: 'AI Description generated!' });
        } else {
            addToast({ type: 'error', message: data.error || 'Failed to generate description.' });
        }
    } catch (e) {
        if (e.name !== 'AbortError') {
            addToast({ type: 'error', message: 'Generation error: ' + e.message });
        }
    } finally {
        generatingDescription.value = false;
        hideLoader();
    }
};

const saveEdit = async () => {
    processing.value = true;
    showLoader("Saving Item...", {
        step: "Uploading media & updating database...",
        progress: 70,
        basket: 'solar:diskette-bold-duotone',
        cancelable: false
    });
    try {
        let finalGallery = Array.isArray(editGalleryBuffer.value) ? [...editGalleryBuffer.value] : [];
        let finalImageFile = null;
        if (actualMainPhoto.value?.type === 'new' && actualMainPhoto.value?.idx !== undefined && actualMainPhoto.value?.idx !== null && finalGallery[actualMainPhoto.value.idx]) {
             finalImageFile = finalGallery[actualMainPhoto.value.idx];
             finalGallery.splice(actualMainPhoto.value.idx, 1);
        }

        const payload = {
            ...editForm,
            conditionNotes: editForm.condition_notes,
            imageId: actualMainPhoto.value?.id || null,
            imageFile: finalImageFile,
            galleryFiles: finalGallery,
            existingGalleryIds: Array.isArray(editForm.existingGalleryIds) ? editForm.existingGalleryIds : [],
            scoutData: scoutResult.value || null,
            components: (componentsList.value && Array.isArray(componentsList.value) && componentsList.value.length > 0) 
                ? JSON.stringify(componentsList.value) 
                : null
        };
        emit('save', payload);
    } catch (e) {
        addToast({ type: 'error', message: 'Save failed: ' + e.message });
    } finally {
        processing.value = false;
        hideLoader();
    }
};

const removeGalleryItem = async (idOrIdx, isExisting) => {
    const confirmed = await confirmDialog(
        'Are you sure you want to remove this photo from the item gallery?',
        'Delete Photo',
        'Delete',
        'Keep Photo',
        'btn-error'
    );
    if (!confirmed) return;

    if (isExisting) {
        editForm.existingGalleryIds = editForm.existingGalleryIds.filter(id => id !== idOrIdx);
    } else {
        editGalleryBuffer.value.splice(idOrIdx, 1);
    }
};

const scannerWidget = ref(null);

const handleCapturedPhotos = (files) => {
    if (!files || files.length === 0) return;
    const fileList = Array.isArray(files) ? files : Array.from(files);
    fileList.forEach(file => {
        editGalleryBuffer.value.push(file);
        if (!actualMainPhoto.value.file && !editForm.imageId && !actualMainPhoto.value.url) {
            mainPhotoSelection.value = { type: 'new', val: editGalleryBuffer.value.length - 1 };
        }
    });
    addToast({ type: 'success', message: `Added ${fileList.length} photo(s) to gallery!` });
};

const fetchSourceData = async () => {
    let url = editForm.sourcingLocation;
    const isId = url && url.match(/^\d+$/);
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

    let fetchImageAbort = new AbortController();

    showLoader("Fetching Source Data...", {
        step: "Scraping photos and listing metadata...",
        progress: 50,
        basket: 'solar:cloud-download-bold-duotone',
        cancelable: true,
        onCancel: () => {
            fetchImageAbort.abort();
            fetchingImages.value = false;
        }
    });

    try {
        const timeoutSignal = AbortSignal.timeout(25000);
        const combinedSignal = (typeof AbortSignal.any === 'function') 
            ? AbortSignal.any([fetchImageAbort.signal, timeoutSignal])
            : fetchImageAbort.signal;

        const res = await fetch('/api/extract-images', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: finalUrl }),
            signal: combinedSignal
        });
        const data = await res.json();
        if (data.success && data.images.length > 0) {
            fetchedImages.value = data.images;
        }
        if (data.success) {
            if (isAcquisitionUnlocked.value) {
                if (data.price && (!editForm.cost || parseFloat(editForm.cost) === 0)) editForm.cost = data.price.toString().replace(/[$,]/g, '');
            }
            if (data.title && (!editForm.title || editForm.title.trim().length < 4)) editForm.title = data.title;
            addToast({ type: 'success', message: `Fetched ${data.images?.length || 0} photos!` });
        } else {
            addToast({ type: 'error', message: data.error || "Failed to parse photos from source." });
        }
    } catch (e) {
        if (e.name !== 'AbortError') {
            addToast({ type: 'error', message: "Failed to fetch source data: " + (e.message || "Request timed out") });
        }
    } finally {
        fetchingImages.value = false;
        hideLoader();
    }
};

const urlToFile = async (url, filename) => {
    try {
        const res = await fetch('/api/proxy-image?url=' + encodeURIComponent(url));
        if (!res.ok) throw new Error("Image download failed");
        const blob = await res.blob();
        const contentType = res.headers.get('content-type') || 'image/jpeg';
        return new File([blob], filename, { type: contentType });
    } catch (e) {
        return null;
    }
};

const selectFetchedImage = async (url, asMain = false) => {
    if (!url) return;
    downloadingImageUrls.value = { ...downloadingImageUrls.value, [url]: true };
    try {
        const filename = url.split('/').pop()?.split('?')[0] || "downloaded.jpg";
        const file = await urlToFile(url, filename);
        if (file) {
            editGalleryBuffer.value.push(file);
            const newIdx = editGalleryBuffer.value.length - 1;
            if (asMain || (!actualMainPhoto.value.file && !editForm.imageId && !actualMainPhoto.value.url)) {
                mainPhotoSelection.value = { type: 'new', val: newIdx };
            }
            fetchedImages.value = fetchedImages.value.filter((img) => (typeof img === 'string' ? img : img.url) !== url);
            addToast({ type: 'success', message: asMain ? "Added & set as main photo ⭐" : "Photo added to gallery!" });
        } else {
            addToast({ type: 'error', message: "Could not download image." });
        }
    } catch (e) {
        addToast({ type: 'error', message: "Download failed: " + e.message });
    } finally {
        const updated = { ...downloadingImageUrls.value };
        delete updated[url];
        downloadingImageUrls.value = updated;
    }
};

const addAllFetchedImages = async () => {
    if (!fetchedImages.value || fetchedImages.value.length === 0) return;
    showLoader("Importing Scraped Photos...", {
        step: "Downloading photos to gallery buffer...",
        progress: 40,
        cancelable: false
    });
    const toAdd = [...fetchedImages.value];
    let successCount = 0;
    for (const imgItem of toAdd) {
        const url = typeof imgItem === 'string' ? imgItem : (imgItem.url || '');
        if (!url) continue;
        const filename = url.split('/').pop()?.split('?')[0] || "downloaded.jpg";
        const file = await urlToFile(url, filename);
        if (file) {
            editGalleryBuffer.value.push(file);
            if (!actualMainPhoto.value.file && !editForm.imageId && !actualMainPhoto.value.url) {
                mainPhotoSelection.value = { type: 'new', val: editGalleryBuffer.value.length - 1 };
            }
            successCount++;
        }
    }
    fetchedImages.value = [];
    hideLoader();
    if (successCount > 0) {
        addToast({ type: 'success', message: `Added ${successCount} photo${successCount > 1 ? 's' : ''} to gallery!` });
    } else {
        addToast({ type: 'error', message: 'Failed to download fetched photos.' });
    }
};

let scoutAbortController = new AbortController();

const analyzeExistingItem = async () => {
    if (!canAnalyze.value) {
        addToast({ type: 'warning', message: "Please provide a title, notes, a photo, or a link to analyze." });
        return;
    }
    analyzing.value = true;
    scoutAbortController = new AbortController();
    let progressTimer = null;
    let progressVal = 15;

    try {
        let base64Images = [];
        let remoteUrls = [];

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
            const reader = new FileReader(); 
            reader.onload = (e) => img.src = e.target.result; 
            reader.readAsDataURL(blob);
        });

        const resizePromises = editGalleryBuffer.value.slice(0, 30).map(async (file) => {
            try { return await resize(file); } catch (e) { return null; }
        });
        const resizedLocal = (await Promise.all(resizePromises)).filter(Boolean);
        base64Images.push(...resizedLocal);

        if (editForm.existingGalleryIds && editForm.existingGalleryIds.length > 0) {
            editForm.existingGalleryIds.forEach(id => {
                const u = getAssetUrl(id);
                if (u && !remoteUrls.includes(u)) remoteUrls.push(u);
            });
        }

        if (base64Images.length === 0 && remoteUrls.length === 0 && actualMainPhoto.value.url) {
            let url = actualMainPhoto.value.url;
            if (url.startsWith('data:') || url.startsWith('blob:')) {
                try { const res = await fetch(url); base64Images.push(await resize(await res.blob())); } catch (e) {}
            } else {
                remoteUrls.push(url);
            }
        }

        let cleanCondition = (editForm.condition_notes || '')
            .replace(/\[[A-Z0-9_ ]+:[^\]]+\]/gi, '')
            .replace(/--- IMPORT DETAILS ---[\s\S]*/gi, '')
            .replace(/(Paid|Resale|Sold|Location|Est\. Low|Est\. High|Condition|Order #):[^\n]*/gi, '')
            .trim();
        let contextNotes = cleanCondition;
        if (editForm.description) contextNotes += (contextNotes ? '\n\n' : '') + `Existing Description: ${editForm.description}`;
        if (editForm.title && editForm.title.trim().toLowerCase() !== 'untitled item') contextNotes = `Current Title: ${editForm.title}\n\n` + contextNotes;
        if (editForm.sourcingLocation) contextNotes += `\n\nSourcing URL: ${editForm.sourcingLocation}`;

        // Feed verified child items from lot lineage as ground truth
        const existingChildComponents = (lotChildren.value || []).map(c => ({
            id: c.$id,
            upc: c.upc,
            title: c.title,
            price: c.resalePrice || c.price,
            condition: c.condition_notes || c.condition,
            description: c.description
        }));

        if (existingChildComponents.length > 0) {
            contextNotes += `\n\n=== VERIFIED CONSTITUENT ITEMS IN THIS BUNDLE (${existingChildComponents.length} Split Listings) ===\n` +
                existingChildComponents.map(c => `- [${c.upc || 'ITEM'}] ${c.title}${c.price ? ` ($${c.price})` : ''}`).join('\n') +
                `\nNOTE: These items are ALREADY verified and cataloged. Appraise and synthesize the master lot based on these known items.`;
        }

        let lotQty = Number(editForm.quantity || props.item?.quantity || 0);
        if (!lotQty || lotQty <= 1) {
            const titleMatch = (editForm.title || '').match(/\b(?:lot|set|pack|box)\s+of\s+(\d+)\b/i);
            if (titleMatch) {
                lotQty = parseInt(titleMatch[1], 10);
            } else if (existingChildComponents.length > 0) {
                lotQty = existingChildComponents.length;
            }
        }

        scoutResult.value = null;
        scoutMdText.value = '';

        const activeLocations = [];
        if (orgWarehouses.value && orgWarehouses.value.length > 0) {
            orgWarehouses.value.forEach(w => activeLocations.push({ 
                name: w.name, 
                type: w.type || 'Physical Booth', 
                commissionRate: w.commissionRate,
                categories: w.categories || w.niche || ''
            }));
        }
        if (orgPlacedLocations.value && orgPlacedLocations.value.length > 0) {
            orgPlacedLocations.value.forEach(loc => {
                if (!activeLocations.some(l => l.name === loc)) {
                    activeLocations.push({ name: loc, type: 'Physical Booth / Location' });
                }
            });
        }

        const totalPhotos = base64Images.length + remoteUrls.length;
        const isLot = (lotQty > 1) || 
                      (/\b(lot|bundle|collection|set\s+of|pack\s+of|box\s+of)\b/i.test(`${editForm.title || ''} ${editForm.condition_notes || ''}`));
        const apiEndpoint = (isLot && totalPhotos > 1) ? '/api/inspect-lot' : '/api/identify-item';

        showLoader("Analyzing with AI Deep Research...", {
            step: isLot ? `Step 1 of 3: Scanning ${totalPhotos} photos for lot cataloging...` : `Step 1 of 3: Scanning item visual details & title...`,
            progress: progressVal,
            basket: 'solar:archive-minimalistic-bold-duotone',
            berries: ['solar:document-bold-duotone', 'solar:chart-square-bold-duotone', 'solar:calculator-bold-duotone', 'solar:folder-with-files-bold-duotone'],
            basketColor: 'text-primary-content',
            berryColor: 'text-primary-content',
            backgroundColor: 'bg-primary/80',
            cancelable: true,
            onCancel: () => {
                if (progressTimer) clearInterval(progressTimer);
                scoutAbortController.abort();
            }
        });

        progressTimer = setInterval(() => {
            if (progressVal < 45) {
                progressVal += 6;
            } else if (progressVal < 75) {
                progressVal += 4;
            } else if (progressVal < 90) {
                progressVal += 2;
            }

            let stepMsg = isLot ? `Step 2 of 3: Cataloging distinct issues & components...` : `Step 2 of 3: Searching market comparables & sold history...`;
            if (progressVal >= 80) {
                stepMsg = isLot ? `Step 3 of 3: Consolidating lot appraisal & split strategy...` : `Step 3 of 3: Calculating fair resale pricing & condition...`;
            }
            updateLoader("Analyzing with AI Deep Research...", stepMsg, progressVal);
        }, 1000);

        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                images: base64Images,
                remoteImageUrls: remoteUrls,
                title: editForm.title,
                notes: contextNotes,
                cost: editForm.cost,
                quantity: lotQty || editForm.quantity || props.item?.quantity,
                sourcingLocation: editForm.sourcingLocation || props.item?.sourcingLocation,
                locations: activeLocations,
                existingItems: existingChildComponents
            }),
            signal: scoutAbortController.signal
        });

        if (progressTimer) clearInterval(progressTimer);

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.details || errData.error || "Analysis failed");
        }

        const data = await response.json();

        if (data.lot_items && Array.isArray(data.lot_items) && data.lot_items.length > 0) {
            scoutResult.value = data;
            let desc = `--- 📦 MASTER LOT APPRAISAL & BOOTH STRATEGY (${data.lot_items.length} Cataloged Items) ---\n\n`;
            if (data.title) desc += `**Suggested Title:** ${data.title}\n\n`;
            if (data.condition_notes) desc += `**Condition Overview:** ${data.condition_notes}\n\n`;

            if (data.price_breakdown) {
                desc += `**💰 Total Collection Valuation:**\n`;
                if (data.price_breakdown.mint) desc += `- **Mint / High-Grade:** ${data.price_breakdown.mint}\n`;
                if (data.price_breakdown.fair) desc += `- **Fair / Market Average:** ${data.price_breakdown.fair}\n`;
                if (data.price_breakdown.boutique_premium) desc += `- **Boutique / Antique Mall:** ${data.price_breakdown.boutique_premium}\n`;
                if (data.price_breakdown.poor) desc += `- **Reader / Clearance:** ${data.price_breakdown.poor}\n`;
                desc += `\n`;

                if (!editForm.resalePrice || parseFloat(editForm.resalePrice) === 0 || editForm.resalePrice === '') {
                    const fairPrice = parsePrice(data.price_breakdown.fair || data.price_breakdown.boutique_premium || data.price_breakdown.mint);
                    if (fairPrice > 0) {
                        editForm.resalePrice = fairPrice.toFixed(2);
                    }
                }
                const priceRange = parsePriceRange(data.price_breakdown.fair || data.price_breakdown.mint);
                if (priceRange.low > 0 || priceRange.high > 0) {
                    if (!editForm.estLow) editForm.estLow = priceRange.low.toFixed(2);
                    if (!editForm.estHigh) editForm.estHigh = priceRange.high.toFixed(2);
                }
            }

            if ((!editForm.condition_notes || editForm.condition_notes.trim() === '') && data.condition_notes) {
                editForm.condition_notes = data.condition_notes;
            }
            if ((!editForm.keywords || editForm.keywords.length === 0) && data.keywords?.length > 0) {
                editForm.keywords = [...data.keywords];
            }

            if (data.market_report) {
                desc += `**🏪 Market Strategy & Sales Channels:**\n`;
                if (data.market_report.best_platform) desc += `- **Primary Recommendation:** ${data.market_report.best_platform}\n`;
                if (data.market_report.platform_rationale) desc += `- **Strategy Rationale:** ${data.market_report.platform_rationale}\n`;
                if (data.market_report.channels && Array.isArray(data.market_report.channels)) {
                    data.market_report.channels.forEach(ch => {
                        desc += `  * **${ch.name}:** ${ch.est_price} (${ch.recommendation || ''}) — Net Payout: ${ch.net_payout || ''}\n`;
                    });
                }
                desc += `\n`;
            }

            if (data.purchase_strategy) {
                desc += `**🎯 Sourcing & Profit Assessment:**\n`;
                if (data.purchase_strategy.verdict) desc += `- **Verdict:** ${data.purchase_strategy.verdict}\n`;
                if (data.purchase_strategy.advice) desc += `- **Advice:** ${data.purchase_strategy.advice}\n\n`;
            }

            desc += `**🔍 Cataloged Items & Pricing Tiers:**\n`;
            data.lot_items.forEach((item, idx) => {
                desc += `\n**${idx+1}. ${item.name || item.identity}**\n`;
                if (item.estimated_value) desc += `   - **Est. Resale:** ${item.estimated_value}\n`;
                if (item.price_breakdown && item.price_breakdown.fair) {
                    desc += `   - **Pricing Matrix:** Fair ${item.price_breakdown.fair} | Mint ${item.price_breakdown.mint || '-'} | Boutique ${item.price_breakdown.boutique_premium || '-'}\n`;
                }
                if (item.condition) desc += `   - **Condition:** ${item.condition}\n`;
                if (item.ocr_detected_text) desc += `   - **Markings / Text:** ${item.ocr_detected_text}\n`;
            });

            scoutMdText.value = desc.trim();
            addToast({ type: 'success', message: `Identified ${data.lot_items.length} items/groups in lot!` });
        } else if (data.items && data.items.length > 0) {
            if (data.items.length > 1) {
                scoutResult.value = data.items;
                let desc = `**📦 MULTI-ITEM LOT BREAKDOWN (${data.items.length} Items):**\n\n`;
                data.items.forEach((item, idx) => {
                    desc += `**${idx+1}. ${item.title || item.identity}**\n`;
                    if(item.condition_notes) desc += `- Condition: ${item.condition_notes}\n`;
                });
                scoutMdText.value = desc.trim();
                addToast({ type: 'success', message: `Identified ${data.items.length} items!` });
            } else {
                scoutResult.value = data.items[0];
                const item = scoutResult.value;
                
                if ((!editForm.title || editForm.title.trim().toLowerCase() === 'untitled item') && (item.title || item.identity)) {
                    const rawTitle = item.title || item.identity;
                    editForm.title = rawTitle.replace(/\[Tier \d[^\]]*\]\s*/i, '').trim();
                }

                if ((!editForm.resalePrice || parseFloat(editForm.resalePrice) === 0 || editForm.resalePrice === '') && (item.pricing_potential || item.price_breakdown)) {
                    const fairPrice = parsePrice(item.pricing_potential?.fair || item.price_breakdown?.fair || item.price_breakdown?.mint);
                    if (fairPrice > 0) {
                        editForm.resalePrice = fairPrice.toFixed(2);
                    }
                }
                const priceRange = parsePriceRange(item.pricing_potential?.fair || item.price_breakdown?.fair || item.price_breakdown?.mint);
                if (priceRange.low > 0 || priceRange.high > 0) {
                    if (!editForm.estLow) editForm.estLow = priceRange.low.toFixed(2);
                    if (!editForm.estHigh) editForm.estHigh = priceRange.high.toFixed(2);
                }
                if (!editForm.condition_notes && item.condition_notes) {
                    editForm.condition_notes = item.condition_notes;
                }
                if ((!editForm.keywords || editForm.keywords.length === 0) && item.keywords?.length > 0) {
                    editForm.keywords = [...item.keywords];
                }
                
                let report = `--- 🕵️ SCOUT REPORT ---\n\n`;
                if (item.tier_label || item.tier) {
                    const tierName = item.tier_label || (item.tier === 'showcase' ? '🌟 Showcase' : item.tier === 'quick_turn' ? '⚡ Quick Turn' : '📦 Core');
                    report += `**Inventory Tier:** ${tierName}\n`;
                }
                if(item.title) {
                    const cleanTitle = item.title.replace(/\[Tier \d[^\]]*\]\s*/i, '').trim();
                    report += `**Title:** ${cleanTitle}\n\n`;
                }
                if(item.why_pay_up) report += `**💎 Sourcing Catalyst (Why Pay Up):** ${item.why_pay_up}\n`;
                if(item.why_pass) report += `**⚠️ Risk Rationale (Why Pass):** ${item.why_pass}\n`;
                if(item.condition_notes) report += `**Condition:** ${item.condition_notes}\n`;
                if(item.red_flags && item.red_flags.length > 0) report += `**🚩 Red Flags:** ${item.red_flags.join(', ')}\n`;
                if(item.pricing_potential || item.price_breakdown) {
                    report += `\n**Valuation Breakdown:**\n`;
                    if(item.pricing_potential?.fair || item.price_breakdown?.fair) report += `- **Fair Market:** ${item.pricing_potential?.fair || item.price_breakdown?.fair}\n`;
                    if(item.pricing_potential?.boutique || item.price_breakdown?.boutique_premium) report += `- **Boutique Booth:** ${item.pricing_potential?.boutique || item.price_breakdown?.boutique_premium}\n`;
                    if(item.price_breakdown?.mint) report += `- **Mint / New:** ${item.price_breakdown.mint}\n`;
                    if(item.price_breakdown?.poor) report += `- **Poor / As-Is:** ${item.price_breakdown.poor}\n`;
                }
                if(item.purchase_strategy) {
                    report += `\n**Sourcing Strategy:**\n`;
                    if(item.purchase_strategy.verdict) report += `- **Verdict:** ${item.purchase_strategy.verdict}\n`;
                    if(item.purchase_strategy.max_bid) report += `- **Max Bid Target:** $${item.purchase_strategy.max_bid}\n`;
                    if(item.purchase_strategy.advice) report += `- **Advice:** ${item.purchase_strategy.advice}\n`;
                }
                if(item.market_report) {
                    report += `\n**Market & Channels:**\n`;
                    if (item.market_report.best_platform) report += `- **Best Platform:** ${item.market_report.best_platform}\n`;
                    if (item.market_report.sell_through_velocity) report += `- **Velocity:** ${item.market_report.sell_through_velocity}\n`;
                    if (item.market_report.platform_rationale) report += `- **Rationale:** ${item.market_report.platform_rationale}\n`;
                }
                if(item.comparables && item.comparables.length > 0) { 
                    report += `\n**Comparables:**\n`; 
                    item.comparables.forEach(c => report += `- ${c.name} (${c.price}) [${c.status || 'Sold'}]\n`); 
                }
                scoutMdText.value = report.trim();
                addToast({ type: 'success', message: 'AI Analysis complete!' });
            }
        } else if (data && (data.identity || data.title || data.price_breakdown || data.purchase_strategy || data.market_report)) {
            scoutResult.value = data;
            let desc = `--- 📦 LOT APPRAISAL & BOOTH STRATEGY ---\n\n`;
            if (data.tier_label || data.tier) {
                const tierName = data.tier_label || (data.tier === 'showcase' ? '🌟 Showcase' : data.tier === 'quick_turn' ? '⚡ Quick Turn' : '📦 Core');
                desc += `**Inventory Tier:** ${tierName}\n`;
            }
            if (data.title) {
                const cleanLotTitle = data.title.replace(/\[Tier \d[^\]]*\]\s*/i, '').trim();
                desc += `**Suggested Title:** ${cleanLotTitle}\n\n`;
            }
            if (data.why_pay_up) desc += `**💎 Sourcing Catalyst (Why Pay Up):** ${data.why_pay_up}\n`;
            if (data.why_pass) desc += `**⚠️ Risk Rationale (Why Pass):** ${data.why_pass}\n`;
            if (data.condition_notes) desc += `**Condition Overview:** ${data.condition_notes}\n\n`;

            if (data.pricing_potential || data.price_breakdown) {
                desc += `**💰 Total Valuation:**\n`;
                if (data.pricing_potential?.fair || data.price_breakdown?.fair) desc += `- **Fair Market:** ${data.pricing_potential?.fair || data.price_breakdown?.fair}\n`;
                if (data.pricing_potential?.boutique || data.price_breakdown?.boutique_premium) desc += `- **Boutique / Antique Mall:** ${data.pricing_potential?.boutique || data.price_breakdown?.boutique_premium}\n`;
                if (data.price_breakdown?.mint) desc += `- **Mint / High-Grade:** ${data.price_breakdown.mint}\n`;
                if (data.price_breakdown?.poor) desc += `- **Reader / Clearance:** ${data.price_breakdown.poor}\n`;
                desc += `\n`;
            }

            if (data.market_report) {
                desc += `**🏪 Market Strategy & Sales Channels:**\n`;
                if (data.market_report.best_platform) desc += `- **Primary Recommendation:** ${data.market_report.best_platform}\n`;
                if (data.market_report.platform_rationale) desc += `- **Strategy Rationale:** ${data.market_report.platform_rationale}\n`;
                if (data.market_report.channels && Array.isArray(data.market_report.channels)) {
                    data.market_report.channels.forEach(ch => {
                        desc += `  * **${ch.name}:** ${ch.est_price} (${ch.recommendation || ''}) — Net Payout: ${ch.net_payout || ''}\n`;
                    });
                }
                desc += `\n`;
            }

            if (data.purchase_strategy) {
                desc += `**🎯 Sourcing & Profit Assessment:**\n`;
                if (data.purchase_strategy.verdict) desc += `- **Verdict:** ${data.purchase_strategy.verdict}\n`;
                if (data.purchase_strategy.advice) desc += `- **Advice:** ${data.purchase_strategy.advice}\n\n`;
            }

            if (data.red_flags && Array.isArray(data.red_flags) && data.red_flags.length > 0) {
                desc += `**🚩 Inspection Flags:**\n`;
                data.red_flags.forEach(flag => {
                    desc += `- ${flag}\n`;
                });
                desc += `\n`;
            }

            scoutMdText.value = desc.trim();
            addToast({ type: 'success', message: 'Lot valuation intelligence generated!' });
        }
    } catch (e) {
        if (e.name !== 'AbortError') {
            addToast({ type: 'error', message: 'Analysis error: ' + e.message });
        }
    } finally {
        if (progressTimer) clearInterval(progressTimer);
        analyzing.value = false;
        analysisStatus.value = '';
        hideLoader();
    }
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
    addToast({ type: 'success', message: 'Applied AI suggestions to listing form.' });
};

watch(mainTab, (newVal) => {
    if (newVal === 'lot') {
        fetchLotChildren();
    }
});

const deconstructAiLot = () => {
    if (!props.item) return;
    isLotSplitterOpen.value = true;
};

const sellOneQuantity = async () => {
    if (!props.item || editForm.quantity <= 1) return;
    const unitSoldPriceRaw = window.prompt("How much did this 1 item sell for? (Enter a number)", 
        (parseFloat(editForm.resalePrice || 0) / editForm.quantity).toFixed(2));
    if (unitSoldPriceRaw === null) return;
    const unitSoldPrice = parseFloat(unitSoldPriceRaw);
    if (isNaN(unitSoldPrice)) {
        addToast({ type: 'error', message: 'Invalid price.' });
        return;
    }

    try {
        const unitCost = parseFloat((parseFloat(editForm.cost || 0) / editForm.quantity).toFixed(2));
        const unitResale = parseFloat((parseFloat(editForm.resalePrice || 0) / editForm.quantity).toFixed(2));
        
        const childTitle = `${editForm.title} (Extracted 1/${editForm.quantity})`;
        const extraData = {
            cost: unitCost,
            resalePrice: unitResale,
            soldPrice: unitSoldPrice,
            status: 'sold',
            sourcingLocation: editForm.sourcingLocation,
            orderId: editForm.orderId,
            storageLocation: editForm.storageLocation,
            quantity: 1,
            parentLotId: props.item.$id,
            purchaseId: props.item.purchaseId || null
        };
        
        await saveItemToInventory(
            { title: childTitle, identity: Math.random().toString(36).substring(2, 10), condition_notes: `Extracted from Lot ${props.item.$id}` },
            null,
            extraData,
            currentTeam.value?.$id
        );
        
        editForm.quantity -= 1;
        if (isAcquisitionUnlocked.value) {
            editForm.cost = Math.max(0, parseFloat(editForm.cost || 0) - unitCost).toFixed(2);
        }
        editForm.resalePrice = Math.max(0, parseFloat(editForm.resalePrice || 0) - unitResale).toFixed(2);
        saveEdit();
        addToast({ type: 'success', message: 'Extracted 1 sold item!' });
    } catch (e) {
        addToast({ type: 'error', message: 'Error extracting item: ' + e.message });
    }
};

const splitOneActive = async () => {
    if (!props.item || editForm.quantity <= 1) return;
    try {
        const unitCost = parseFloat((parseFloat(editForm.cost || 0) / editForm.quantity).toFixed(2));
        const unitResale = parseFloat((parseFloat(editForm.resalePrice || 0) / editForm.quantity).toFixed(2));
        
        const childTitle = `${editForm.title} (Piece ${editForm.quantity})`;
        const extraData = {
            cost: unitCost,
            resalePrice: unitResale,
            status: editForm.status === 'sold' ? 'acquired' : editForm.status,
            sourcingLocation: editForm.sourcingLocation,
            orderId: editForm.orderId,
            storageLocation: editForm.storageLocation,
            quantity: 1,
            parentLotId: props.item.$id,
            purchaseId: props.item.purchaseId || null
        };
        
        await saveItemToInventory(
            { title: childTitle, identity: Math.random().toString(36).substring(2, 10), condition_notes: `Split from batch: ${props.item.$id}` },
            null,
            extraData,
            currentTeam.value?.$id
        );
        
        editForm.quantity -= 1;
        if (isAcquisitionUnlocked.value) {
            editForm.cost = Math.max(0, parseFloat(editForm.cost || 0) - unitCost).toFixed(2);
        }
        editForm.resalePrice = Math.max(0, parseFloat(editForm.resalePrice || 0) - unitResale).toFixed(2);
        saveEdit();
        addToast({ type: 'success', message: 'Split 1 item into active inventory!' });
    } catch (e) {
        addToast({ type: 'error', message: 'Error splitting item: ' + e.message });
    }
};
</script>

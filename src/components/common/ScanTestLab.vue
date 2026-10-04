<template>
    <div class="space-y-6 max-w-4xl mx-auto pb-24">
        <!-- HEADER HERO -->
        <div class="card bg-base-100 border border-base-200 shadow-md p-6 rounded-3xl">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black">
                        <Icon icon="solar:camera-bold" class="w-6 h-6" />
                    </div>
                    <div>
                        <h1 class="text-xl sm:text-2xl font-black tracking-tight text-base-content flex items-center gap-2">
                            Scanner Test Lab
                            <span class="badge badge-sm badge-primary font-mono font-bold">Web BarcodeDetector</span>
                        </h1>
                        <p class="text-xs text-base-content/60 font-medium">
                            Test 1D barcodes (Code 128, UPC, EAN) and 2D Mini QR codes with camera spatial bounding box tracking.
                        </p>
                    </div>
                </div>

                <div class="flex items-center gap-2 self-stretch sm:self-auto">
                    <button 
                        type="button" 
                        @click="openSingleScanner"
                        class="btn btn-sm btn-primary font-bold gap-1.5 flex-1 sm:flex-none shadow-sm"
                    >
                        <Icon icon="solar:scanner-bold" class="w-4 h-4" />
                        Single Scan
                    </button>
                    <button 
                        type="button" 
                        @click="openContinuousScanner"
                        class="btn btn-sm btn-secondary font-bold gap-1.5 flex-1 sm:flex-none shadow-sm"
                    >
                        <Icon icon="solar:layers-bold" class="w-4 h-4" />
                        Batch Audit Mode
                    </button>
                </div>
            </div>
        </div>

        <!-- SECTION 1: REUSABLE SEARCH INPUT WITH INTEGRATED SCANNER -->
        <div class="card bg-base-100 border border-base-200 shadow-sm p-6 rounded-3xl space-y-4">
            <div class="flex items-center justify-between">
                <div>
                    <h2 class="text-sm font-bold uppercase tracking-wider text-base-content/80 flex items-center gap-2">
                        <Icon icon="solar:magnifer-linear" class="w-4 h-4 text-primary" />
                        Component 1: Reusable SearchInputWithScanner
                    </h2>
                    <p class="text-xs text-base-content/60">
                        Tap the camera icon inside the search bar to scan any code directly into the input.
                    </p>
                </div>
                <span v-if="searchQuery" class="badge badge-sm badge-ghost font-mono text-[11px]">
                    Value: {{ searchQuery }}
                </span>
            </div>

            <!-- Reusable Component in Action -->
            <SearchInputWithScanner 
                v-model="searchQuery"
                placeholder="Click the camera button on the right to scan..."
                scanner-title="Scan Item Tag or Mini QR"
                scanner-subtitle="Point camera at code to populate search bar"
                size="md"
                @scan="handleInputScanned"
            />

            <!-- Matched Inventory Preview (if scanned code matches an inventory item) -->
            <div v-if="matchedItem" class="p-4 rounded-2xl bg-success/10 border border-success/30 flex items-center gap-4">
                <div class="w-12 h-12 rounded-xl bg-base-300 overflow-hidden shrink-0 flex items-center justify-center font-bold text-xs">
                    <img 
                        v-if="matchedItem.imageId" 
                        :src="getPhotoUrl(matchedItem.imageId)" 
                        class="w-full h-full object-cover" 
                        alt="Item photo" 
                    />
                    <span v-else class="opacity-40">IMG</span>
                </div>
                <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                        <span class="badge badge-xs badge-success font-bold uppercase">Matched in Database</span>
                        <span class="font-mono text-xs opacity-70">{{ matchedItem.upc || matchedItem.locationSku }}</span>
                    </div>
                    <p class="font-bold text-sm text-base-content truncate">{{ matchedItem.title }}</p>
                    <p class="text-xs text-base-content/70">
                        Status: <span class="font-semibold capitalize">{{ matchedItem.status }}</span> • 
                        Price: <span class="font-mono font-bold text-success">${{ Number(matchedItem.resalePrice || matchedItem.listPrice || 0).toFixed(2) }}</span>
                    </p>
                </div>
                <a :href="`/item/${matchedItem.$id}`" class="btn btn-xs btn-ghost border border-base-300 gap-1 shrink-0 font-bold">
                    View Item
                    <Icon icon="solar:arrow-right-linear" class="w-3.5 h-3.5" />
                </a>
            </div>
            <div v-else-if="searchQuery && !loadingInventory" class="p-3 rounded-xl bg-base-200/50 text-xs text-base-content/60 font-mono">
                No active inventory item matches "{{ searchQuery }}". (You can still use it for freeform searching).
            </div>
        </div>

        <!-- SECTION 2: SCAN AUDIT LOG -->
        <div class="card bg-base-100 border border-base-200 shadow-sm p-6 rounded-3xl space-y-4">
            <div class="flex items-center justify-between">
                <div>
                    <h2 class="text-sm font-bold uppercase tracking-wider text-base-content/80 flex items-center gap-2">
                        <Icon icon="solar:history-bold" class="w-4 h-4 text-secondary" />
                        Scanned History Log
                    </h2>
                    <p class="text-xs text-base-content/60">
                        Codes detected during this session with decoded format and timestamp.
                    </p>
                </div>
                <button 
                    v-if="scanHistory.length > 0" 
                    type="button" 
                    @click="scanHistory = []" 
                    class="btn btn-ghost btn-xs text-error font-bold"
                >
                    Clear History
                </button>
            </div>

            <div v-if="scanHistory.length === 0" class="p-8 text-center border-2 border-dashed border-base-300 rounded-2xl space-y-2">
                <Icon icon="solar:barcode-read-linear" class="w-8 h-8 opacity-30 mx-auto" />
                <p class="text-xs font-bold text-base-content/70">No scans recorded yet</p>
                <p class="text-[11px] text-base-content/50">Click "Single Scan" or "Batch Audit Mode" above to test your camera.</p>
            </div>

            <div v-else class="space-y-2">
                <div 
                    v-for="(scan, idx) in scanHistory" 
                    :key="idx" 
                    class="p-3 rounded-xl bg-base-200/40 border border-base-300 flex items-center justify-between gap-3 text-xs"
                >
                    <div class="flex items-center gap-2.5 min-w-0">
                        <span class="badge badge-sm badge-neutral font-mono font-bold">{{ scanHistory.length - idx }}</span>
                        <div class="min-w-0">
                            <span class="font-mono font-bold text-base-content block text-sm">{{ scan.rawValue }}</span>
                            <span class="text-[10px] text-base-content/60">
                                Format: <strong class="uppercase text-primary">{{ scan.format }}</strong>
                            </span>
                        </div>
                    </div>
                    <span class="text-[11px] opacity-60 font-mono shrink-0">
                        {{ new Date(scan.timestamp).toLocaleTimeString() }}
                    </span>
                </div>
            </div>
        </div>

        <!-- SECTION 3: ON-SCREEN TEST CODES -->
        <div class="card bg-base-100 border border-base-200 shadow-sm p-6 rounded-3xl space-y-4">
            <div>
                <h2 class="text-sm font-bold uppercase tracking-wider text-base-content/80 flex items-center gap-2">
                    <Icon icon="solar:qr-code-bold" class="w-4 h-4 text-accent" />
                    Test Codes (Scan these with your phone or camera)
                </h2>
                <p class="text-xs text-base-content/60">
                    Point your camera at any of these physical tag formats to verify instant detection and bounding box hug.
                </p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <!-- Sample 1: Huck Internal Tag (Code 128) -->
                <div class="p-4 rounded-2xl bg-base-200/50 border border-base-300 text-center space-y-2">
                    <span class="badge badge-xs badge-primary font-bold uppercase">Huck Tag (1D Barcode)</span>
                    <div class="bg-white p-3 rounded-xl border border-black/10 flex flex-col items-center justify-center min-h-[100px]">
                        <img 
                            src="https://bwipjs-api.metafloor.com/?bcid=code128&text=HUCK-1250&scale=2&height=10&includetext" 
                            alt="HUCK-1250 Code 128 Barcode" 
                            class="max-w-full h-16 object-contain"
                            loading="lazy"
                        />
                    </div>
                    <p class="text-[10px] text-base-content/60">Genuine Code 128 (Horizontal Alignment)</p>
                </div>

                <!-- Sample 2: Memory Den Ricochet SKU -->
                <div class="p-4 rounded-2xl bg-base-200/50 border border-base-300 text-center space-y-2">
                    <span class="badge badge-xs badge-secondary font-bold uppercase">Memory Den POS SKU</span>
                    <div class="bg-white p-3 rounded-xl border border-black/10 flex flex-col items-center justify-center min-h-[100px]">
                        <img 
                            src="https://bwipjs-api.metafloor.com/?bcid=code128&text=0EJ08G&scale=2&height=10&includetext" 
                            alt="0EJ08G Code 128 Barcode" 
                            class="max-w-full h-16 object-contain"
                            loading="lazy"
                        />
                    </div>
                    <p class="text-[10px] text-base-content/60">Genuine Code 128 (Ricochet Format)</p>
                </div>

                <!-- Sample 3: Sample Mini QR Code -->
                <div class="p-4 rounded-2xl bg-base-200/50 border border-base-300 text-center space-y-2">
                    <span class="badge badge-xs badge-accent font-bold uppercase">Internal Mini QR</span>
                    <div class="bg-white p-3 rounded-xl border border-black/10 flex flex-col items-center justify-center">
                        <img 
                            src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=HUCK-1262" 
                            alt="Sample Mini QR"
                            class="w-20 h-20 rounded-md"
                            loading="lazy"
                        />
                        <div class="font-mono font-bold text-black text-[10px] mt-1">HUCK-1262</div>
                    </div>
                    <p class="text-[10px] text-base-content/60">360° Omnidirectional Mini QR</p>
                </div>
            </div>
        </div>

        <!-- STANDALONE BARCODE SCANNER MODAL -->
        <BarcodeScannerModal 
            :is-open="isModalOpen"
            :title="modalTitle"
            :subtitle="modalSubtitle"
            :mode="scannerMode"
            @close="isModalOpen = false"
            @scan="handleModalScanned"
        />
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import SearchInputWithScanner from './SearchInputWithScanner.vue';
import BarcodeScannerModal, { type ScannedResult } from './BarcodeScannerModal.vue';
import { useInventory } from '../../composables/useInventory';
import { getAssetUrl } from '../../lib/inventory';
import { addToast } from '../../stores/toast';

const { inventoryItems, fetchInventory } = useInventory();

const searchQuery = ref('');
const scanHistory = ref<ScannedResult[]>([]);
const isModalOpen = ref(false);
const scannerMode = ref<'single' | 'continuous'>('single');
const modalTitle = ref('Scan Barcode or Mini QR');
const modalSubtitle = ref('Point camera at any tag or sticker');
const loadingInventory = ref(false);

onMounted(async () => {
    try {
        loadingInventory.value = true;
        await fetchInventory();
    } catch (e) {
        console.warn('Failed preloading inventory for scan matches:', e);
    } finally {
        loadingInventory.value = false;
    }
});

const matchedItem = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return null;
    return inventoryItems.value.find(item => 
        (item.upc && item.upc.toLowerCase() === q) ||
        (item.locationSku && item.locationSku.toLowerCase() === q) ||
        (item.sku && item.sku.toLowerCase() === q) ||
        (item.$id && item.$id.toLowerCase() === q)
    );
});

function getPhotoUrl(imageId: string) {
    return getAssetUrl(imageId, { preview: true, width: 80, height: 80 });
}

function handleInputScanned(res: ScannedResult) {
    if (!res?.rawValue) return;
    scanHistory.value.unshift(res);
    addToast(`Scanned: ${res.rawValue} (${res.format})`, 'success');
}

function handleModalScanned(res: ScannedResult) {
    if (!res?.rawValue) return;
    searchQuery.value = res.rawValue;
    scanHistory.value.unshift(res);
    addToast(`Detected: ${res.rawValue}`, 'info');
}

function openSingleScanner() {
    modalTitle.value = 'Single Tag Scanner';
    modalSubtitle.value = 'Locks onto tag, beeps, and auto-closes';
    scannerMode.value = 'single';
    isModalOpen.value = true;
}

function openContinuousScanner() {
    modalTitle.value = 'Batch Audit Scanner';
    modalSubtitle.value = 'Keeps scanning items rapidly without closing';
    scannerMode.value = 'continuous';
    isModalOpen.value = true;
}
</script>

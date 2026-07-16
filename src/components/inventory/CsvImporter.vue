<template>
  <div class="flex flex-col h-full">
    <!-- STEP 1: UPLOAD OR PASTE -->
    <div v-if="step === 1" class="flex flex-col h-full py-4">
        <div class="tabs tabs-boxed justify-center mb-4 bg-base-200 p-1 rounded-full">
            <a class="tab rounded-full" :class="{ 'tab-active': importMethod === 'file' }" @click="importMethod = 'file'">File Upload</a>
            <a class="tab rounded-full" :class="{ 'tab-active': importMethod === 'paste' }" @click="importMethod = 'paste'">Paste Text</a>
        </div>

        <!-- Option A: File -->
        <div v-if="importMethod === 'file'" class="flex-1 flex flex-col items-center justify-center space-y-4">
            <!-- Hidden file input triggered by button ref -->
            <input type="file" ref="fileInputRef" class="hidden" @change="handleFileUpload" />
            <button
                type="button"
                @click="fileInputRef?.click()"
                class="w-full flex flex-col items-center justify-center px-6 pt-8 pb-8 border-2 border-primary border-dashed rounded-xl cursor-pointer hover:bg-base-200 active:bg-base-300 transition-colors gap-3"
            >
                <Icon icon="solar:upload-linear" class="h-12 w-12 text-primary" />
                <div class="text-center">
                    <div class="font-bold text-primary text-base">Tap to select CSV file</div>
                    <p class="text-xs text-gray-400 mt-1">ShopGoodwill Exports</p>
                </div>
                <div v-if="selectedFileName" class="badge badge-primary badge-sm mt-1">{{ selectedFileName }}</div>
            </button>
        </div>

        <!-- Option B: Paste -->
        <div v-if="importMethod === 'paste'" class="flex-1 flex flex-col space-y-2">
            <textarea 
                v-model="pasteContent"
                class="textarea textarea-bordered flex-1 text-xs font-mono"
                placeholder="Paste data directly from spreadsheet or website table headers...&#10;Order ID, Title, Price..."
            ></textarea>
            <button class="btn btn-primary btn-sm" :disabled="!pasteContent" @click="parseCSV(pasteContent)">
                Process Text
            </button>
        </div>

        <div class="text-[10px] text-gray-400 text-center w-full px-4 mt-4">
            Looking for columns: <b>Title, Price, Shipping, Order ID</b>
        </div>
        
        <!-- Error Feedback -->
        <div v-if="error" class="alert alert-error shadow-lg text-xs mt-4">
            <span>{{ error }}</span>
            <button class="btn btn-xs btn-ghost" @click="error = null">✕</button>
        </div>
    </div>

    <!-- STEP 2: REVIEW & SPREAD COST -->
    <div v-if="step === 2" class="flex-1 overflow-hidden flex flex-col">
        <div class="p-2 bg-base-200 rounded-lg mb-2 text-xs flex justify-between items-center group sticky top-0 z-10">
            <div class="flex items-center gap-2">
                <span>Found <b>{{ parsedItems.length }}</b> items.</span>
                <button v-if="!estimating" class="btn btn-xs btn-ghost text-primary gap-1" @click="runEstimates" :disabled="importing">
                    <Icon icon="solar:magic-stick-linear" class="w-4 h-4" /> Estimate All
                </button>
                <span v-else class="loading loading-spinner loading-xs text-primary"></span>
            </div>
            <button class="btn btn-xs" @click="step = 1" :disabled="importing">Re-upload</button>
        </div>

        <details class="mb-2 px-2">
            <summary class="text-[10px] opacity-50 cursor-pointer hover:opacity-100">Debug: Internal Column Mapping</summary>
            <div class="text-[10px] bg-base-300 p-2 rounded mt-1 font-mono overflow-auto">
                <div>Headers: {{ detectedHeaders.join(', ') }}</div>
                <div>Map: {{ JSON.stringify(debugMapping) }}</div>
            </div>
        </details>

        <!-- MAIN PROGRESS BAR -->
        <div v-if="importing" class="px-2 mb-2">
            <progress class="progress progress-primary w-full" :value="importProgress" max="100"></progress>
            <div class="text-xs text-center text-gray-500 mt-1">Processing... please wait (Rate Limited)</div>
        </div>

        <div class="flex-1 overflow-y-auto space-y-4 p-1">
            <div v-for="(order, orderId) in orders" :key="orderId" class="card bg-base-100 border border-base-300 shadow-sm compact">
                <div class="card-body p-3">
                    <div class="flex justify-between items-center border-b border-base-200 pb-2 mb-2">
                        <h3 class="font-bold text-xs uppercase tracking-wide opacity-70 flex items-center gap-2">
                            Order #{{ orderId }}
                            <a :href="`https://shopgoodwill.com/shopgoodwill/order/${orderId}`" target="_blank" class="btn btn-xs btn-square btn-ghost text-primary opacity-50 hover:opacity-100" title="Open Order in ShopGoodwill">
                                <Icon icon="solar:link-linear" class="w-3 h-3" />
                            </a>
                        </h3>
                        <div class="text-xs text-right flex flex-col items-end gap-1">
                             <div class="flex items-center gap-1">
                                <span class="opacity-60">Shipping:</span>
                                <input 
                                    type="number" 
                                    class="input input-xs input-bordered w-20 text-right"
                                    :value="order.shippingTotal"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    @input="updateOrderShipping(orderId, parseFloat(($event.target as HTMLInputElement).value) || 0)"
                                />
                             </div>
                             <span class="block font-bold text-primary" :class="{'opacity-50': order.shippingPerItem === 0}">
                                Spread: ${{ order.shippingPerItem.toFixed(2) }} / item
                             </span>
                        </div>
                    </div>
                    
                    <div class="space-y-2">
                         <div class="flex justify-end px-2">
                            <label class="label cursor-pointer gap-2">
                                <span class="label-text text-xs opacity-70">Show Details</span> 
                                <input type="checkbox" v-model="showDetails" class="toggle toggle-xs toggle-primary" />
                            </label>
                        </div>

                        <div v-for="item in order.items" :key="item.id" class="flex gap-3 items-start p-2 hover:bg-base-200 rounded-lg transition-colors border border-transparent hover:border-base-300">
                            <!-- Image Preview -->
                            <div class="w-12 h-12 bg-base-200 rounded flex-shrink-0 overflow-hidden relative border border-base-300">
                                <img v-if="item.imageUrl" :src="item.imageUrl" class="w-full h-full object-cover" @error="item.imageError = true" />
                                <div v-else class="flex items-center justify-center w-full h-full opacity-30"><Icon icon="solar:gallery-linear" class="w-6 h-6" /></div>
                            </div>
                            
                            <div class="flex-1 min-w-0">
                                <!-- Title & Validation -->
                                <div class="flex items-start gap-1">
                                    <span v-if="!item.title || !item.itemId || item.price === 0" class="text-warning" title="Missing Data"><Icon icon="solar:danger-triangle-linear" class="w-4 h-4 inline" /></span>
                                    <div class="text-sm font-bold truncate leading-tight">{{ item.title || 'UNKNOWN IMAGE/ITEM' }}</div>
                                </div>

                                <!-- Core Stats -->
                                <div class="flex gap-3 text-[10px] mt-1 opacity-80">
                                    <span :class="{'text-error font-bold': item.price === 0}">
                                        Price: ${{ item.price.toFixed(2) }}
                                    </span>
                                    <span>
                                        + Ship: ${{ item.shippingShare.toFixed(2) }}
                                    </span>
                                    <span class="font-bold border-l pl-2 border-base-content/20">
                                        Total: ${{ item.totalCost.toFixed(2) }}
                                    </span>
                                </div>
                                
                                <!-- Detailed Debug View -->
                                <div v-if="showDetails" class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[9px] font-mono bg-base-100 p-1.5 rounded border border-base-300 opacity-80">
                                    <div>ID: <span class="select-all">{{ item.itemId || 'MISSING' }}</span></div>
                                    <div>Order: <span class="select-all">{{ item.orderId || 'MISSING' }}</span></div>
                                    <div :class="{'text-success': item.imageUrl}">Image: {{ item.imageUrl ? 'YES' : 'NO' }}</div>
                                    <div>Status: {{ item.status }}</div>
                                </div>

                                <div v-if="item.estimatedResale" class="mt-1 text-xs font-bold text-secondary flex items-center gap-1">
                                    <Icon icon="solar:magic-stick-linear" class="w-4 h-4 inline mr-1" /> Est. Resale: ${{ item.estimatedResale }}
                                </div>
                            </div>
                            
                            <div class="text-right flex flex-col items-end gap-1 pt-1">
                                <label class="label cursor-pointer p-0">
                                    <input type="checkbox" v-model="item.selected" class="checkbox checkbox-sm checkbox-primary" :disabled="importing && item.importStatus" />
                                </label>
                                
                                <!-- Status Icons -->
                                <div v-if="importing || item.importStatus" class="mt-1">
                                    <span v-if="item.importStatus === 'processing'" class="loading loading-spinner loading-xs text-primary"></span>
                                    <span v-else-if="item.importStatus === 'success'" class="badge badge-success badge-xs gap-1">
                                        <Icon icon="solar:check-circle-linear" class="w-3 h-3" /> Done
                                    </span>
                                    <span v-else-if="item.importStatus === 'updated'" class="badge badge-info badge-xs gap-1">
                                        <Icon icon="solar:refresh-circle-linear" class="w-3 h-3" /> Dup
                                    </span>
                                    <span v-else-if="item.importStatus === 'error'" class="badge badge-error badge-xs font-bold gap-1" :title="item.importError">
                                        <Icon icon="solar:danger-triangle-linear" class="w-3 h-3" /> Error
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- FOOTER -->
        <div class="p-4 border-t border-base-200 mt-2">
             <button class="btn btn-primary w-full" :disabled="importing" @click="importSelected">
                {{ importing ? 'Importing...' : `Import ${selectedCount} Items` }}
            </button>
        </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useInventory } from '../../composables/useInventory';
import { saveItemToInventory } from '../../lib/inventory';
import { databases, ID } from '../../lib/appwrite';
import { addToast, updateToast, removeToast } from '../../stores/toast';
import Papa from 'papaparse';
import { isAlphaMode } from '../../stores/env';
import { Icon } from '@iconify/vue';

const getCollectionId = () => isAlphaMode.get() 
    ? (import.meta.env.PUBLIC_APPWRITE_ALPHA_COLLECTION_ID || 'alpha_items') 
    : (import.meta.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items');

const emit = defineEmits(['close', 'imported']);

// Prevent accidental close/refresh
const confirmExit = (e: BeforeUnloadEvent) => {
    if (importing.value) {
        e.preventDefault();
        e.returnValue = '';
    }
};

onMounted(() => window.addEventListener('beforeunload', confirmExit));
onUnmounted(() => window.removeEventListener('beforeunload', confirmExit));
const step = ref(1);
const parsedItems = ref<any[]>([]);
const importMethod = ref<'file' | 'paste'>('file');
const pasteContent = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);
const selectedFileName = ref('');
const importing = ref(false);
const importProgress = ref(0);
const estimating = ref(false);
const showDetails = ref(false);
const error = ref<string | null>(null);
const detectedHeaders = ref<string[]>([]);
const debugMapping = ref<any>({});

const shippingOverrides = ref<Record<string, number>>({});

const orders = computed(() => {
    const groups: Record<string, any> = {};
    
    // Group items
    parsedItems.value.forEach(item => {
        const oid = item.orderId || 'Unknown';
        if (!groups[oid]) groups[oid] = { items: [], shippingTotal: 0, shippingPerItem: 0, hasManualShipping: false };
        groups[oid].items.push(item);
        
        // Logic Update: 
        // In "Shipped Orders" CSVs, the shipping cost is often repeated on EVERY line (e.g. $12 for Item A, $12 for Item B).
        // If we sum them, we get double/triple shipping ($24 or $36).
        // Instead, we should find the MAX shipping value reported for this order, assuming it represents the order total.
        if (item.shipping > groups[oid].shippingTotal) {
            groups[oid].shippingTotal = item.shipping;
        }
    });

    Object.keys(groups).forEach((oid) => {
        const group = groups[oid];
        const count = group.items.length;
        
        // Apply Override if exists
        if (shippingOverrides.value[oid] !== undefined) {
             group.shippingTotal = shippingOverrides.value[oid];
             group.hasManualShipping = true;
        }

        if (count > 0) {
            // Calculate spread (Evenly distribute the SINGLE shipping total across all items)
            group.shippingPerItem = group.shippingTotal / count;
            
            // Distribute back to items for final import
            group.items.forEach((i: any) => {
                i.shippingShare = group.shippingPerItem;
                i.totalCost = i.price + i.shippingShare;
            });
        }
    });
    return groups;
});

function updateOrderShipping(orderId: string, value: number) {
    shippingOverrides.value[orderId] = value;
}

const selectedCount = computed(() => {
    return parsedItems.value.filter(i => i.selected).length;
});

async function runEstimates() {
    estimating.value = true;
    const batch = parsedItems.value.filter(i => i.selected && !i.estimatedResale);
    const CONCURRENCY = 3;
    for (let i = 0; i < batch.length; i += CONCURRENCY) {
        const chunk = batch.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map(async (item) => {
            try {
                const res = await fetch('/api/estimate-price', { method: 'POST', body: JSON.stringify({ title: item.title }) });
                const data = await res.json();
                if (data.fair) item.estimatedResale = data.fair;
            } catch (e) { console.error(e); }
        }));
    }
    estimating.value = false;
}

function handleFileUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    selectedFileName.value = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target?.result as string;
        parseCSV(text);
    };
    reader.readAsText(file);
}



function parseCSV(text: string) {
    if (!text) {
        error.value = "Content is empty.";
        return;
    }

    // Use PapaParse:
    Papa.parse(text, {
        header: false, // We'll handle headers manually with our fuzzy logic
        skipEmptyLines: true,
        complete: (results) => {
            const lines = results.data as string[][]; // Array of arrays

            if (lines.length < 2) {
                error.value = "Format invalid: No data rows found. (Need Header + Data)";
                return;
            }

            // Headers are first row
            const rawHeaders = lines[0].map(h => (h || '').toString());
            // Clean headers: remove BOM, trim, lowercase
            const headers = rawHeaders.map(h => h.replace(/^\uFEFF/, '').trim().toLowerCase());

            console.log('[CSV] Detected Headers:', headers);
            detectedHeaders.value = headers; // For Debug UI

            // MAPPINGS
            const map = {
                title: -1,
                itemId: -1,
                price: -1,
                shipping: -1,
                handling: -1, // Added Handling
                orderId: -1,
                image: -1
            };

            // 1. GOLDEN PATH: Standard ShopGoodwill Export
            // "Item Id" -> ID, "Item" -> Title
            const firstDataRow = lines[1] || []; // Use first row to validate content

            const isNumeric = (val: string) => /^\d+$/.test(val.replace(/[^0-9]/g, ''));
            const isShopGoodwillId = (val: string) => /^\d{8,10}$/.test(val.replace(/[^0-9]/g, ''));

            const findCol = (keywords: string[], antiKeywords: string[] = [], type: 'text' | 'id' | 'any' = 'any') => {
                // Helper to check content validity (Crucial for ambiguous headers like "Item")
                const isValidContent = (idx: number) => {
                    if (idx === -1 || !firstDataRow[idx]) return true; // Can't validate
                    const val = firstDataRow[idx].toString().trim();
                    if (!val) return true;
                    
                    if (type === 'text') {
                        // Text columns (Title) should NOT be an ID or purely numeric
                        if (isNumeric(val) && val.length > 4) return false; 
                        if (isShopGoodwillId(val)) return false;
                        // Also, if it looks like a price (starts with $), reject it for title
                        if (val.startsWith('$')) return false;
                    }
                    if (type === 'id') {
                        // ID columns MUST contain digits
                        // If it's purely letters, it's definitely not the ID
                        if (!/\d/.test(val)) return false; 
                        // It should probably be mostly numbers (allow 'Item 123' but prefer '123')
                        if (val.length > 3 && !/\d{3}/.test(val)) return false;
                    }
                    return true;
                };

                // 1. Priority: Check each keyword for an EXACT match first
                for (const keyword of keywords) {
                    const idx = headers.findIndex(h => h === keyword);
                    if (idx !== -1 && isValidContent(idx)) return idx;
                }
                
                // 2. Priority: Check each keyword for a PARTIAL match
                for (const keyword of keywords) {
                    const idx = headers.findIndex(h => {
                            const containsKey = h.includes(keyword);
                            const containsAnti = antiKeywords.some(ak => h.includes(ak));
                            return containsKey && !containsAnti;
                    });
                    if (idx !== -1 && isValidContent(idx)) return idx;
                }
                return -1;
            };

            // 1. GOLDEN PATH: Standard ShopGoodwill Export
            // "Item Id" -> ID, "Item" -> Title
            const colId = headers.findIndex(h => h === 'item id' || h === 'itemid');
            const colTitle = headers.findIndex(h => h === 'item');
            
            if (colId !== -1 && colTitle !== -1) {
                console.log("[CSV] Detected Standard ShopGoodwill Format. Using explicit mapping.");
                map.itemId = colId;
                map.title = colTitle;
                map.orderId = headers.findIndex(h => h.includes('order'));
                map.price = headers.findIndex(h => h.includes('price'));
                map.shipping = headers.findIndex(h => h.includes('shipping'));
                map.handling = headers.findIndex(h => h.includes('handling')); // Explicit handling check
                map.image = headers.findIndex(h => ['image', 'photo', 'url'].some(k => h.includes(k)));
            } else {
                // 2. FUZZY MATCHING (Fallback)
                
                // MAPPINGS (Fuzzy)
                 map.title = findCol(['description', 'title', 'item name', 'name', 'product name', 'product', 'item'], ['id', 'price', 'number', '#', 'count'], 'text');
                 map.itemId = findCol(['item #', 'item id', 'order #', 'order number', 'order id', 'listing id'], ['title', 'price', 'item name'], 'id');
                 map.price = findCol(['price', 'amount', 'winning bid', 'sale price', 'cost', 'paid'], ['shipping', 'tax', 'total']);
                 map.shipping = findCol(['shipping', 'ship cost', 'postage'], ['handling']);
                 map.handling = findCol(['handling', 'processing', 'fee', 'tax'], ['shipping']); // Separate handling column
                 map.orderId = findCol(['order #', 'order number', 'invoice', 'order'], ['item']);
                 map.image = findCol(['image', 'photo', 'picture', 'url', 'link'], []);
            } // End else

            // SCAN FOR ID (If explicit mapping failed, look for 9-digit number)
            if (map.itemId === -1) {
                 const idIdx = firstDataRow.findIndex(val => isShopGoodwillId(val));
                 if (idIdx !== -1) {
                     map.itemId = idIdx;
                     console.log(`[CSV] Smart Scan: Found 9-digit ID in column ${idIdx} (${headers[idIdx] || 'Unknown'})`);
                 }
            }

            // SMART FALLBACK: If title missing, find the column with longest avg string length
            if (map.title === -1) {
                console.log("[CSV] Title not found by keyword. Attempting smart length detection...");
                let longestColIdx = -1;
                let maxAvgLen = 0;
                
                // Sample up to 10 rows
                const sampleRows = lines.slice(1, 11);
                const numCols = lines[0].length;
                
                for (let c = 0; c < numCols; c++) {
                    // Skip columns already mapped to something else (except maybe ID if conflict)
                    if (Object.values(map).includes(c) && c !== map.itemId) continue; 
                    
                    let totalLen = 0;
                    let count = 0;
                    sampleRows.forEach(row => {
                        if (row[c]) {
                            // SKIP NUMERIC COLUMNS for Title Fallback
                            if (isNumeric(row[c].toString())) return;
                            
                            totalLen += row[c].toString().length;
                            count++;
                        }
                    });
                    const avg = count > 0 ? totalLen / count : 0;
                    if (avg > maxAvgLen) {
                        maxAvgLen = avg;
                        longestColIdx = c;
                    }
                }
                
                // If the longest column is reasonably long (e.g. > 10 chars), assume it's the description
                if (longestColIdx !== -1 && maxAvgLen > 5) {
                    map.title = longestColIdx;
                    console.log(`[CSV] Smart Fallback: Map 'Title' to column index ${longestColIdx} (Avg Len: ${maxAvgLen})`);
                }
            }

            // Debug Info
            debugMapping.value = map;
            if (map.title === -1) showDetails.value = true; // Auto-show debug if still failing
            
            // Fallbacks
            if (map.itemId === -1) map.itemId = findCol(['item', 'id'], ['name', 'title']);
            if (map.orderId === -1) map.orderId = map.itemId;

            if (map.title === -1 && map.itemId === -1) {
                error.value = `Could not identify a 'Description' or 'Title' column. Headers found: ${headers.join(', ')}`;
                return;
            }

            const items: any[] = [];

            // Iterate Rows (Start at index 1)
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i];
                if (cols.length < 2) continue; // Skip empty rows

                // Extract Values using Map indices
                // Helper: safely get string at index
                const getVal = (idx: number) => (idx !== -1 && cols[idx] !== undefined) ? cols[idx].toString().trim() : '';

                const rawTitle = getVal(map.title);
                const rawItemId = getVal(map.itemId);
                const rawOrderId = getVal(map.orderId);
                
                // Clean Data
                const priceStr = map.price !== -1 ? (cols[map.price] || '0') : '0';
                const shipStr = map.shipping !== -1 ? (cols[map.shipping] || '0') : '0';
                const handlingStr = map.handling !== -1 ? (cols[map.handling] || '0') : '0';
                
                const price = parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;
                const shippingBase = parseFloat(shipStr.replace(/[^0-9.]/g, '')) || 0;
                const handling = parseFloat(handlingStr.replace(/[^0-9.]/g, '')) || 0;
                
                // Sum Shipping + Handling
                const totalShipping = shippingBase + handling;

                const imageUrl = map.image !== -1 ? (cols[map.image] || '') : '';

                // Clean quotes
                const title = rawTitle.replace(/^"|"$/g, '').trim();
                const itemId = rawItemId.replace(/^"|"$/g, '').replace(/[^0-9]/g, ''); // Extract numbers only for ID
                
                // Link Generation
                const link = itemId ? `https://shopgoodwill.com/item/${itemId}` : '';

                items.push({
                    id: Math.random().toString(36).substr(2, 9),
                    title: title || `Item ${itemId}`, // Fallback if title empty
                    price: isNaN(price) ? 0 : price,
                    shipping: totalShipping, // Store the SUM here
                    orderId: rawOrderId.replace(/^"|"$/g, '') || itemId, // Fallback to ItemID if order ID missing
                    itemId: itemId,
                    imageUrl: imageUrl.replace(/^"|"$/g, ''),
                    sourceLink: link,
                    selected: true,
                    shippingShare: 0,
                    totalCost: 0
                });
            }
            
            if (items.length === 0) {
                error.value = "No valid items parsed. Check CSV formatting.";
                return;
            }
            
            parsedItems.value = items;
            step.value = 2; // Move to Review
            error.value = null;
        },
        error: (err: any) => {
            console.error("PapaParse Error:", err);
            error.value = "Failed to parse CSV: " + err.message;
        }
    });
}

// Helper for rate limits (defined outside to avoid re-definition)
async function retryOperation<T>(fn: () => Promise<T>, retries = 3, baseDelay = 2000): Promise<T> {
    try {
        return await fn();
    } catch (err: any) {
        // Appwrite 429 = Rate Limit
        if (retries > 0 && (err.code === 429 || err.message?.includes('Rate limit'))) {
            const delay = baseDelay * (4 - retries); 
            console.warn(`[Import] Rate limit hit. Retrying in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
            return retryOperation(fn, retries - 1, baseDelay);
        }
        // Appwrite 400 = Index Missing (often)
        if (err.code === 400 && err.message?.includes('Index not found')) {
            throw new Error("Missing Database Index! Please run 'node scripts/update-schema.mjs'");
        }
        throw err;
    }
}

async function importSelected() {
    importing.value = true;
    const targets = parsedItems.value.filter(i => i.selected);
    let completed = 0;
    let updated = 0;
    let skipped = 0;
    
    // Start Progress Toast
    const toastId = addToast({
        type: 'loading',
        message: 'Archiving file & starting import...',
        progress: 0,
        duration: 0
    });

    try {
        const DB = import.meta.env.PUBLIC_APPWRITE_DB_ID;
        const { Query } = await import('appwrite');
        const user = await import('../../lib/appwrite').then(m => m.account.get());
        
        const CONCURRENCY = 1; 
        const total = targets.length;
        
        console.log('[Import] Starting batch process for', total, 'items.');

        for (let i = 0; i < total; i += CONCURRENCY) {
            const chunk = targets.slice(i, i + CONCURRENCY);
            
            // Update Progress
            const progress = Math.round((i / total) * 100);
            importProgress.value = progress;
            updateToast(toastId, { 
                message: `Processing item ${i+1}/${total}...`, 
                progress 
            });

            await Promise.all(chunk.map(async (item) => {
                try {
                    item.importStatus = 'processing'; // UI Update

                    // 1. PREPARE DATA (Image Upload)
                    let finalImageId = null;
                    let notes = `Imported from Order #${item.orderId}`;
                    if (item.sourceLink) {
                         notes += `\nSource: ${item.sourceLink}`;
                    }
                    
                    if (item.imageUrl) {
                        try {
                            const res = await fetch('/api/upload-remote-image', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ url: item.imageUrl })
                            });
                            if (res.ok) {
                                const data = await res.json();
                                finalImageId = data.fileId;
                            } else {
                                const errorText = await res.text();
                                notes += `\n\n[EXTERNAL_IMAGE: ${item.imageUrl}] (Error: ${errorText})`;
                                addToast({ type: 'warning', message: `Image failed for ${item.title}: ${errorText.substring(0,50)}`, duration: 6000 });
                            }
                        } catch (imgErr: any) {
                            console.error('[Import] Image Upload Fail:', imgErr);
                            notes += `\n\n[EXTERNAL_IMAGE: ${item.imageUrl}] (Crash: ${imgErr.message})`;
                            addToast({ type: 'error', message: `Image crash for ${item.title}: ${imgErr.message}`, duration: 6000 });
                        }
                    }

                    // 2. CHECK FOR DUPLICATE & UPDATE
                    try {
                        let match: any = null;
                        try {
                            // Try direct query on identity first
                            const existing = await retryOperation(() => databases.listDocuments(DB, getCollectionId(), [
                                Query.equal('identity', item.itemId),
                                Query.limit(1)
                            ]));
                            if (existing.documents.length > 0) {
                                match = existing.documents[0];
                            }
                        } catch (e: any) {
                            console.warn('[Import] Direct identity check failed, running title fallback:', e.message);
                            // Fallback: Query by title and match identity in memory
                            const existing = await retryOperation(() => databases.listDocuments(DB, getCollectionId(), [
                                Query.equal('title', item.title),
                                Query.limit(100)
                            ]));
                            match = existing.documents.find(doc => doc.identity === item.itemId);
                        }
                        
                        if (match) {
                            // ITEM EXISTS: Update it!
                            const doc = match;
                            console.log(`[Import] Updating existing item: ${item.title}`);
                            
                            // Merge Notes
                            let newNotes = doc.conditionNotes || '';
                            if (item.sourceLink && !newNotes.includes(item.sourceLink)) {
                                newNotes += `\nSource: ${item.sourceLink}`;
                            }
                            // Append Image ID to notes schema hack if new
                            if (finalImageId && !newNotes.includes(finalImageId)) {
                                 newNotes += `\n\n[IMAGE_ID: ${finalImageId}]`;
                            }
                            
                            // Only update if something changed or we are enriching
                            const updateData: any = {
                                cost: item.totalCost, 
                                conditionNotes: newNotes
                            };
                            if (finalImageId) {
                                updateData.imageId = finalImageId;
                            }
                            await retryOperation(() => databases.updateDocument(DB, getCollectionId(), doc.$id, updateData));
                            
                            updated++;
                            item.importStatus = 'updated';
                            return; // STOP HERE
                        }
                    } catch (dupErr) {
                         console.warn('[Import] Check fail:', dupErr);
                    }

                    // 3. CREATE NEW ITEM
                    const teamId = localStorage.getItem('activeTeamId') || user.prefs?.teamId || null;
                    
                    if (finalImageId) {
                        notes += `\n\n[IMAGE_ID: ${finalImageId}]`;
                    }

                    // Use saveItemToInventory for schema safety
                    const extraData: any = {
                         cost: item.totalCost,
                         resalePrice: item.estimatedResale ? item.estimatedResale.toString() : undefined,
                         status: 'acquired' as const,
                         sourcingLocation: item.sourceLink ? item.sourceLink : 'ShopGoodwill'
                    };
                    if (finalImageId) {
                        extraData.imageId = finalImageId;
                    }
                    
                    // But we will import it at the top component level.
                    
                    await saveItemToInventory(
                        {
                            title: item.title,
                            identity: item.itemId, // Use Item ID as identity
                            condition_notes: notes,
                        },
                        null, // No main image File object (we handled remote upload or URL)
                        extraData,
                        teamId
                    );
                    
                    completed++;
                    item.importStatus = 'success';
                    
                } catch (itemErr: any) {
                    console.error(`[Import] FAILED to create item: ${item.title}`, itemErr);
                    item.importStatus = 'error';
                    item.importError = itemErr.message;
                    addToast({
                        type: 'error',
                        message: `Failed "${item.title.substring(0,10)}...": ${itemErr.message}`,
                        duration: 8000
                    });
                }
            }));

            // Rate Limit Protection: Wait 2.5s between items (Increased for safety)
            await new Promise(r => setTimeout(r, 2500));
        }

        // Final Status
        removeToast(toastId);
        
        if (completed === 0 && updated === 0 && skipped === 0) {
            addToast({ type: 'warning', message: "No items were processed.", duration: 0 });
        } else {
             addToast({ 
                type: 'success', 
                message: `Done! Created: ${completed}, Updated: ${updated}, Skipped: ${skipped}`, 
                duration: 5000 
            });
            setTimeout(() => window.location.reload(), 2000);
        }
        
    } catch (e: any) {
        removeToast(toastId);
        addToast({ type: 'error', message: "Critical Import Error: " + e.message, duration: 0 });
    } finally {
        importing.value = false;
    }
}
</script>

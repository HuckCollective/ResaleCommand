<template>
    <!-- FILE SELECTION MODAL -->
    <div v-if="!processing && logs.length === 0" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div class="bg-base-100 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div class="p-4 border-b border-base-200 flex justify-between items-center">
                <h3 class="text-xl font-bold">Bulk Import</h3>
                <button class="btn btn-sm btn-circle btn-ghost" @click="$emit('close')">✕</button>
            </div>
            
            <div class="p-6 overflow-y-auto flex-1 space-y-6">
                <p class="opacity-70 text-sm">
                    Upload a CSV or XLSX file containing your ShopGoodwill items. 
                </p>
                
                <div class="form-control w-full">
                    <input type="file" ref="fileInputRef" class="hidden" @change="handleFileUpload" accept=".csv,.xlsx,.xls" />
                    <button 
                        type="button"
                        @click="fileInputRef?.click()"
                        class="btn btn-outline btn-primary w-full gap-2 h-auto py-4 flex-col"
                    >
                        <Icon icon="solar:upload-linear" class="w-8 h-8" />
                        <span class="font-bold">{{ selectedFileName || 'Tap to select file (CSV/XLSX)' }}</span>
                    </button>
                </div>

                <div class="form-control w-full">
                    <label class="label cursor-pointer justify-start gap-4">
                        <input type="checkbox" v-model="runScout" class="checkbox checkbox-primary checkbox-sm" />
                        <span class="label-text font-bold text-sm">Auto-Scout Items (AI Analysis)</span>
                    </label>
                </div>

                <div class="mt-4 flex justify-end">
                    <button class="btn btn-primary w-full" @click="processCSV" :disabled="!file">
                        Start Import 🚀
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- FULLSCREEN HUCKLEBERRY LOADER -->
    <div v-else class="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-secondary/90 backdrop-blur-sm p-4">
        <div class="max-w-2xl w-full flex flex-col items-center">
            
            <!-- Huckleberry Animation -->
            <div class="relative w-48 h-48 mb-8 z-10">
                <Icon icon="solar:box-minimalistic-bold-duotone" class="w-48 h-48 text-secondary-content/80 drop-shadow-xl animate-[bounce_2s_ease-in-out_infinite]" />
                <Icon icon="solar:document-add-bold-duotone" class="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-12 text-secondary-content/90 drop-shadow-md animate-[fall_1.5s_ease-in_infinite]" />
                <Icon icon="solar:database-bold-duotone" class="absolute top-12 left-[30%] w-10 h-10 text-secondary-content/70 drop-shadow-md animate-[fall_2s_ease-in_infinite_0.5s]" />
                <Icon icon="solar:file-download-bold-duotone" class="absolute top-8 left-[70%] w-8 h-8 text-secondary-content/80 drop-shadow-md animate-[fall_1.8s_ease-in_infinite_0.2s]" />
                <div class="absolute inset-x-4 bottom-4 h-16 bg-gradient-to-t from-secondary/50 to-transparent rounded-b-3xl -z-10"></div>
            </div>

            <h2 class="text-3xl font-black text-secondary-content mb-2 tracking-tight">Processing Items...</h2>
            <p class="text-secondary-content/70 mb-8 font-medium">Please wait while we import your data.</p>
            
            <div class="w-full bg-base-100/20 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-white/10 flex flex-col gap-4">
                
                <div class="flex justify-between items-end">
                    <div class="font-bold text-secondary-content tracking-wide">Progress</div>
                    <div class="text-xs font-mono bg-secondary-content/10 px-2 py-1 rounded text-secondary-content">
                        {{ Math.round(progress) }}%
                    </div>
                </div>

                <div class="w-full bg-secondary-content/20 rounded-full h-4 overflow-hidden relative">
                    <div class="absolute inset-y-0 left-0 bg-secondary-content rounded-full transition-all duration-300 ease-out flex items-center justify-end px-2" :style="{ width: progress + '%' }">
                        <div class="w-2 h-2 bg-secondary rounded-full animate-pulse shadow-sm"></div>
                    </div>
                </div>

                <div class="bg-black/40 rounded-xl p-4 font-mono text-xs h-64 overflow-y-auto space-y-1 border border-white/5 shadow-inner mt-2">
                    <div v-for="(log, idx) in logs" :key="idx" :class="{'text-error': log.startsWith('❌'), 'text-success': log.startsWith('✅'), 'text-info': log.startsWith('ℹ️'), 'text-warning': log.startsWith('⚠️'), 'text-white/80': !log.match(/^[❌✅ℹ️⚠️]/)}">
                        {{ log }}
                    </div>
                </div>
            </div>
            
            <div class="mt-8 flex gap-4">
                <button v-if="processing" class="btn btn-ghost text-secondary-content/70 hover:bg-secondary-content/20 hover:text-secondary-content" @click="cancelImport">
                    Cancel Import
                </button>
                <button v-if="!processing" class="btn bg-secondary-content text-secondary hover:bg-white px-8" @click="$emit('complete')">
                    Done
                </button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useInventory } from '../../composables/useInventory';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { saveItemToInventory } from '../../lib/inventory';
import { useAuth } from '../../composables/useAuth';
import { databases, Query } from '../../lib/appwrite';
import { isAlphaMode } from '../../stores/env';
import { addToast } from '../../stores/toast';
import { Icon } from '@iconify/vue';
import { purchasesAPI } from '../../lib/purchases';

const getCollectionId = () => isAlphaMode.get() 
    ? (import.meta.env.PUBLIC_APPWRITE_ALPHA_COLLECTION_ID || 'alpha_items') 
    : (import.meta.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items');

const props = defineProps({
    isOpen: Boolean
});

const emit = defineEmits(['close', 'complete']);
const { user, currentTeam } = useAuth();
const { inventoryItems } = useInventory(); 

const processing = ref(false);
const logs = ref([]);
const file = ref(null);
const progress = ref(0);
const fileInputRef = ref(null);
const selectedFileName = ref('');
const total = ref(0);
const runScout = ref(false);

let isBulkCanceled = false;

const handleFileUpload = (event) => {
    file.value = event.target.files[0];
    selectedFileName.value = file.value?.name || '';
};

const cancelImport = () => { isBulkCanceled = true; };

// Fuzzy Column Helper
const findCol = (keys, keywords) => {
    for (const kw of keywords) {
        const exact = keys.find(k => k.toLowerCase().trim() === kw.toLowerCase());
        if (exact) return exact;
    }
    return keys.find(k => keywords.some(kw => k.toLowerCase().includes(kw)));
};

const preProcessLandedCosts = (rows) => {
    const orders = {};
    const processedRows = [];
    
    for (const row of rows) {
        let itemId = row['Item ID'] || row['ID'] || row['Item #'] || row['ItemId'] || row['Item Id'] || row['Item#'];
        let orderId = row['Order ID'] || row['Order #'] || row['Order Number'] || row['OrderId'] || row['Order Id'] || row['Order No'] || row['Order No.'] || row['Invoice ID'] || row['Invoice #'];
        
        if (!itemId) {
            const possibleItem = Object.values(row).find(v => v && v.toString().match(/^\d{9}$/));
            if (possibleItem) itemId = possibleItem;
            if (!itemId && !orderId) {
                const possible = Object.values(row).find(v => v && v.toString().match(/^\d{8,10}$/));
                if (possible) itemId = possible;
            }
        }
        if (!itemId && orderId) itemId = orderId;
        if (!itemId) continue; 
        
        row._calculatedItemId = itemId;
        row._calculatedOrderId = orderId;
        
        const groupKey = orderId ? orderId.toString().trim() : itemId.toString().trim();
        if (!orders[groupKey]) orders[groupKey] = [];
        orders[groupKey].push(row);
    }
    
    for (const groupKey in orders) {
        const group = orders[groupKey];
        const numItems = group.length;
        
        const rowKeys = Object.keys(group[0]);
        const shipKey = findCol(rowKeys, ['shipping', 'ship']);
        const handKey = findCol(rowKeys, ['handling', 'handle']);
        const taxKey = findCol(rowKeys, ['tax']);
        const feeKey = findCol(rowKeys, ['fee', 'additional']);
        
        const orderTotalShipping = shipKey ? parseFloat(group[0][shipKey].toString().replace(/[^0-9.]/g, '')) || 0 : 0;
        const orderTotalHandling = (handKey && handKey !== shipKey) ? parseFloat(group[0][handKey].toString().replace(/[^0-9.]/g, '')) || 0 : 0;
        const orderTotalTax = taxKey ? parseFloat(group[0][taxKey].toString().replace(/[^0-9.]/g, '')) || 0 : 0;
        const orderTotalFee = feeKey ? parseFloat(group[0][feeKey].toString().replace(/[^0-9.]/g, '')) || 0 : 0;
        
        let orderSubtotal = 0;
        for (const row of group) {
            const rKeys = Object.keys(row);
            const priceKey = findCol(rKeys, ['price', 'paid', 'amount', 'cost', 'total', 'bid']);
            const basePrice = priceKey ? parseFloat(row[priceKey].toString().replace(/[^0-9.]/g, '')) || 0 : 0;
            orderSubtotal += basePrice;
        }
        
        const shippingPerItem = orderTotalShipping / numItems;
        const handlingPerItem = orderTotalHandling / numItems;
        const taxPerItem = orderTotalTax / numItems;
        const feePerItem = orderTotalFee / numItems;
        
        for (const row of group) {
            const rKeys = Object.keys(row);
            const priceKey = findCol(rKeys, ['price', 'paid', 'amount', 'cost', 'total', 'bid']);
            const basePrice = priceKey ? parseFloat(row[priceKey].toString().replace(/[^0-9.]/g, '')) || 0 : 0;
            const landedCost = basePrice + shippingPerItem + handlingPerItem + taxPerItem + feePerItem;
            
            let shippingNotes = '';
            if (shippingPerItem > 0 || handlingPerItem > 0 || taxPerItem > 0 || feePerItem > 0) {
                 shippingNotes = `\n\n--- COST BREAKDOWN ---\nBase Bid: $${basePrice.toFixed(2)}`;
                 if (shippingPerItem > 0) shippingNotes += `\nShipping (Divided by ${numItems}): $${shippingPerItem.toFixed(2)}`;
                 if (handlingPerItem > 0) shippingNotes += `\nHandling (Divided by ${numItems}): $${handlingPerItem.toFixed(2)}`;
                 if (taxPerItem > 0) shippingNotes += `\nTax (Divided by ${numItems}): $${taxPerItem.toFixed(2)}`;
                 if (feePerItem > 0) shippingNotes += `\nFees (Divided by ${numItems}): $${feePerItem.toFixed(2)}`;
                 shippingNotes += `\nTrue Landed Cost: $${landedCost.toFixed(2)}`;
            }
            
            row._calculatedBasePrice = basePrice;
            row._calculatedLandedCost = landedCost;
            row._calculatedShippingNotes = shippingNotes;
             
            // Store order-level totals for the Purchases API
            row._orderSubtotal = orderSubtotal;
            row._orderTotalShipping = orderTotalShipping;
            row._orderTotalHandling = orderTotalHandling;
            row._orderTotalTax = orderTotalTax;
            row._orderTotalFee = orderTotalFee;
            row._orderDate = findCol(rKeys, ['order date', 'date']) ? row[findCol(rKeys, ['order date', 'date'])] : null;
            row._tracking = findCol(rKeys, ['tracking']) ? row[findCol(rKeys, ['tracking'])] : null;
            row._vendor = findCol(rKeys, ['seller', 'vendor']) ? row[findCol(rKeys, ['seller', 'vendor'])] : 'ShopGoodwill';
            
            processedRows.push(row);
        }
    }
    return processedRows;
};

const processCSV = async () => {
    if (!file.value) return;
    
    const teamId = currentTeam.value?.$id || user.value?.$id;
    
    if (!teamId) {
        addToast({ type: 'error', message: "Error: You must be logged in to import items." });
        return;
    }

    processing.value = true;
    isBulkCanceled = false;
    logs.value = [];
    progress.value = 0;

    const extension = file.value.name.split('.').pop().toLowerCase();
    
    const onDataParsed = async (rows) => {
        total.value = rows.length;
        const processedRows = preProcessLandedCosts(rows);
        await processRows(processedRows);
        processing.value = false;
    };

    if (extension === 'xlsx' || extension === 'xls') {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
                await onDataParsed(rows);
            } catch (err) {
                logs.value.push(`❌ Excel Error: ${err.message}`);
                processing.value = false;
            }
        };
        reader.readAsArrayBuffer(file.value);
    } else {
        Papa.parse(file.value, {
            header: true,
            skipEmptyLines: 'greedy',
            complete: async (results) => {
                await onDataParsed(results.data);
            },
            error: (err) => {
                logs.value.push(`❌ CSV Error: ${err.message}`);
                processing.value = false;
            }
        });
    }
};

const processRows = async (rows) => {
    const isTeam = !!currentTeam.value?.$id;
    const ownerType = isTeam ? 'team' : 'user';
    const teamId = currentTeam.value?.$id || user.value?.$id;

    const createdPurchases = new Map(); // Tracks created purchase IDs

    for (let i = 0; i < rows.length; i++) {
        if (isBulkCanceled) {
            logs.value.push('⚠️ Import canceled by user.');
            break;
        }
        
        // Update progress slightly at the start so it doesn't feel frozen
        progress.value = (i / rows.length) * 100 + (1 / rows.length * 10);

        const row = rows[i];
        
        let itemId = row._calculatedItemId;
        let orderId = row._calculatedOrderId;
        
        if (!itemId && !orderId) {
            logs.value.push(`⚠️ Row ${i+1}: Skipped - No Item ID or Order ID found.`);
            continue;
        }

        let isOrderProxy = false;
        if (!itemId && orderId) {
             itemId = orderId;
             isOrderProxy = true;
        }

        itemId = itemId.toString().trim();
        if (orderId) orderId = orderId.toString().trim();

        const rowKeys = Object.keys(row);
        const titleKey = findCol(rowKeys, ['title', 'item name', 'name', 'description', 'item']);
        let title = titleKey ? row[titleKey] : `Item ${itemId}`;
        if (title !== null && title !== undefined) {
             title = title.toString();
        } else {
             title = `Item ${itemId}`;
        }

        let basePrice = row._calculatedBasePrice || 0;
        let price = (row._calculatedLandedCost || 0).toFixed(2);
        let shippingNotes = row._calculatedShippingNotes || '';

        const imageKey = findCol(rowKeys, ['image', 'photo', 'picture', 'url']);
        let csvImage = imageKey ? row[imageKey] : null;

        let description = '';
        let mainImageLink = csvImage;
        let galleryLinks = [];

        // 1. DUPLICATE CHECK & FIX EXISTING MODE
        let existingDocs = [];
        try {
            try {
                const dbCheck = await databases.listDocuments(
                    import.meta.env.PUBLIC_APPWRITE_DB_ID, 
                    getCollectionId(),
                    [ Query.equal('identity', itemId) ]
                );
                if (dbCheck.total > 0) existingDocs = dbCheck.documents;
            } catch (e) {
                const titleCheck = await databases.listDocuments(
                    import.meta.env.PUBLIC_APPWRITE_DB_ID,
                    getCollectionId(),
                    [ Query.equal('title', title), Query.limit(100) ]
                );
                const match = titleCheck.documents.find(doc => doc.identity === itemId);
                if (match) existingDocs = [match];
            }
        } catch (e) {
            console.warn("Duplicate check failed, proceeding w/ caution:", e);
        }

        if (existingDocs.length > 0) {
            logs.value.push(`⏭️ Skipped ${itemId} - Already exists in inventory.`);
            progress.value = ((i + 1) / rows.length) * 100;
            continue; // Skip creating or updating
        }

        // 2. FETCH DETAILS (For New Items Only)
        try {
            logs.value.push(`⏳ Fetching details for ${itemId}...`);
            const apiRes = await fetch('/api/proxy-item-details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId })
            });
            if (apiRes.ok) {
                const data = await apiRes.json();
                const isGenericTitle = title.startsWith('Item ') && title.includes(itemId);
                if (data.title && (isGenericTitle || !title)) title = data.title;
                if (data.currentPrice) price = data.currentPrice.toString().replace(/[^0-9.]/g, '');
                if (data.description) description = data.description;
                if (data.imageURL) mainImageLink = data.imageURL;
                if (data.images && Array.isArray(data.images)) {
                     galleryLinks = data.images.filter(l => l !== mainImageLink).slice(0, 5);
                }
            } else {
                logs.value.push(`⚠️ API fetch failed for ${itemId}. Using CSV data fallback.`);
            }
        } catch (e) {
            console.warn(e);
        }

        // 3. FETCH IMAGES
        let mainImageId = null; 
        let scoutBase64 = null;
        if (mainImageLink) {
            const cleanLink = mainImageLink.replace(/\\/g, '/');
            try {
                const uploadRes = await fetch('/api/upload-remote-image', {
                    method: 'POST',
                    body: JSON.stringify({ url: cleanLink, filename: `img-${itemId}` }),
                    headers: { 'Content-Type': 'application/json' }
                });
                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    if (uploadData.success && uploadData.fileId) {
                        mainImageId = uploadData.fileId; 
                        scoutBase64 = uploadData.base64;
                    }
                }
            } catch (e) { console.warn(e); }
        }

        let galleryFiles = [];
        for (let j = 0; j < galleryLinks.length; j++) {
            try {
                const link = galleryLinks[j];
                let gRes = await fetch(link);
                if (!gRes.ok) gRes = await fetch('/api/proxy-image?url=' + encodeURIComponent(link));
                if (gRes.ok) {
                    const blob = await gRes.blob();
                    if (blob.size > 0) {
                         const type = blob.type.includes('image') ? blob.type : 'image/jpeg';
                         const ext = type.split('/')[1] || 'jpg';
                         galleryFiles.push(new File([blob], `gallery-${itemId}-${j}.${ext}`, { type: type }));
                    }
                }
                await new Promise(r => setTimeout(r, 1000));
            } catch (e) { console.warn(e); }
        }

        // 4. AI SCOUT
        let scoutData = null;
        if (runScout.value) {
            try {
                logs.value.push(`🤖 Scouting ${itemId}...`);
                const purchaseUrl = isOrderProxy && orderId ? `https://shopgoodwill.com/shopgoodwill/order/${orderId}` : `https://shopgoodwill.com/item/${itemId}`;
                let contextNotes = description || '';
                contextNotes += `\n\nItem URL: ${purchaseUrl}`;
                
                let aiRes = await fetch('/api/identify-item', {
                    method: 'POST',
                    body: JSON.stringify({ image: scoutBase64, imageUrl: mainImageLink, notes: contextNotes }),
                    headers: { 'Content-Type': 'application/json' }
                });

                if (!aiRes.ok) {
                     await new Promise(r => setTimeout(r, 5000));
                     aiRes = await fetch(`/api/identify-item`, {
                        method: 'PUT', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ image: scoutBase64, imageUrl: mainImageLink, notes: contextNotes })
                    });
                }
                
                if (aiRes.ok) {
                    const aiData = await aiRes.json();
                    if (aiData.items && aiData.items.length > 0) {
                        const item = aiData.items[0];
                        scoutData = item;
                        if (title.startsWith('Item ') || title.length < 5) title = item.title || item.identity;
                        let report = `\n\n--- 🕵️ SCOUT REPORT ---\n`;
                        if(item.condition_notes) report += `**Condition:** ${item.condition_notes}\n`;
                        if(item.red_flags && item.red_flags.length > 0) report += `**🚩 Red Flags:** ${item.red_flags.join(', ')}\n`;
                        description += report;
                    }
                }
            } catch (err) {
                logs.value.push(`⚠️ Scout failed for ${itemId}: ${err.message}`);
            }
        }

        let notes = description + shippingNotes;

        // 5. CREATE OR FETCH PURCHASE DOC
        let dbPurchaseId = null;
        if (orderId) {
             if (createdPurchases.has(orderId)) {
                  dbPurchaseId = createdPurchases.get(orderId);
             } else {
                  try {
                      // Check if purchase exists first
                      let existingPurchase = await purchasesAPI.getPurchaseByOrderId(orderId);
                      if (!existingPurchase) {
                           logs.value.push(`🧾 Creating Purchase Order ${orderId}...`);
                           existingPurchase = await purchasesAPI.createPurchase({
                               orderId: orderId,
                               vendor: row._vendor,
                               purchaseDate: row._orderDate ? new Date(row._orderDate).toISOString() : new Date().toISOString(),
                               trackingNumber: row._tracking,
                               subtotal: row._orderSubtotal,
                               shippingTotal: row._orderTotalShipping,
                               handlingTotal: row._orderTotalHandling,
                               taxTotal: row._orderTotalTax,
                               feeTotal: row._orderTotalFee,
                               grandTotal: row._orderSubtotal + row._orderTotalShipping + row._orderTotalHandling + row._orderTotalTax + row._orderTotalFee,
                               status: 'Pending'
                           });
                      }
                      dbPurchaseId = existingPurchase.$id;
                      createdPurchases.set(orderId, dbPurchaseId);
                  } catch (e) {
                      logs.value.push(`⚠️ Failed to create purchase record for ${orderId}: ${e.message}`);
                  }
             }
        }

        // 6. SAVE TO DB
        try {
            const itemToSave = {
                title: title,
                identity: itemId,
                condition_notes: notes,
            };
            const extraData = {
                cost: price,
                sourcingLocation: isOrderProxy && orderId ? `https://shopgoodwill.com/shopgoodwill/order/${orderId}` : `https://shopgoodwill.com/item/${itemId}`,
                status: 'acquired',
                title: title,
                orderId: orderId,
                purchaseId: dbPurchaseId,
                scoutData: scoutData,
                marketDescription: scoutData ? scoutData.condition_notes : null,
                galleryFiles: galleryFiles
            };
            if (mainImageId) extraData.imageId = mainImageId;

            await saveItemToInventory(itemToSave, null, extraData, teamId, ownerType);

            logs.value.push(`✅ Imported: ${title.substring(0, 30)}... ${orderId ? '(with Order Link)' : ''}`);
            await new Promise(r => setTimeout(r, 6000));
        } catch (err) {
            logs.value.push(`❌ Error importing ${itemId}: ${JSON.stringify(err.message)}`);
        }
        
        progress.value = ((i + 1) / rows.length) * 100;
    }
    
    logs.value.push('🎉 Import Complete!');
    window.location.reload();
};
</script>
<style>
@keyframes fall {
    0% { transform: translateY(-50px) rotate(-10deg); opacity: 0; }
    20% { opacity: 1; }
    80% { opacity: 1; transform: translateY(120px) rotate(20deg); }
    100% { transform: translateY(150px) rotate(30deg); opacity: 0; }
}
</style>

<template>
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div class="bg-base-100 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div class="p-6 border-b border-base-200 flex justify-between items-center">
                <h3 class="text-xl font-bold">Bulk Import from CSV</h3>
                <button class="btn btn-sm btn-circle btn-ghost" @click="$emit('close')">✕</button>
            </div>
            
            <div class="p-6 overflow-y-auto flex-1 space-y-6">
                <div v-if="!processing && logs.length === 0">
                    <p class="mb-4 opacity-70">
                        Upload a CSV file containing your ShopGoodwill items. 
                        We look for an <strong>"Item ID"</strong>, <strong>"ID"</strong>, or <strong>"Item #"</strong> column.
                    </p>
                    
                    <div class="form-control w-full">
                        <input type="file" ref="fileInputRef" class="hidden" @change="handleFileUpload" />
                        <button 
                            type="button"
                            @click="fileInputRef?.click()"
                            class="btn btn-outline btn-primary w-full gap-2 h-auto py-4 flex-col"
                        >
                            <Icon icon="solar:upload-linear" class="w-8 h-8" />
                            <span class="font-bold">{{ selectedFileName || 'Tap to select CSV file' }}</span>
                            <span class="text-xs opacity-60 font-normal">ShopGoodwill Export</span>
                        </button>
                    </div>

                    <div class="form-control w-full mt-4">
                        <label class="label cursor-pointer justify-start gap-4">
                            <input type="checkbox" v-model="runScout" class="checkbox checkbox-primary" />
                            <span class="label-text font-bold">Auto-Scout Items (AI Analysis)</span>
                        </label>
                        <p v-if="runScout" class="text-xs text-warning ml-10">⚠️ This will significantly slow down the import (approx. 5-10s per item).</p>
                    </div>

                    <div class="mt-4 flex justify-end">
                        <button class="btn btn-primary" @click="processCSV" :disabled="!file">
                            Start Import 🚀
                        </button>
                    </div>
                </div>

                <div v-else class="space-y-4">
                    <div v-if="processing" class="flex items-center gap-4">
                        <span class="loading loading-spinner loading-lg text-primary"></span>
                        <div class="flex-1">
                            <div class="font-bold">Processing Item {{ progress }} of {{ total }}...</div>
                            <progress class="progress progress-primary w-full" :value="progress" :max="total"></progress>
                        </div>
                    </div>

                    <div class="bg-base-200 rounded-lg p-4 font-mono text-xs h-64 overflow-y-auto space-y-1">
                        <div v-for="(log, idx) in logs" :key="idx" :class="{'text-error': log.startsWith('❌'), 'text-success': log.startsWith('✅')}">
                            {{ log }}
                        </div>
                    </div>
                    
                    <div v-if="!processing" class="flex justify-end">
                        <button class="btn btn-primary" @click="$emit('complete')">Done</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useInventory } from '../../composables/useInventory';
import Papa from 'papaparse';
import { saveItemToInventory } from '../../lib/inventory';
import { useAuth } from '../../composables/useAuth';
import { databases, Query } from '../../lib/appwrite';
import { isAlphaMode } from '../../stores/env';
import { addToast } from '../../stores/toast';
import { Icon } from '@iconify/vue';

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
    onMounted(() => {
        console.log("[BulkImport] Version: 2026-02-08-FIXED-RELOAD");
        // ...
    });
const total = ref(0);

const runScout = ref(false);

const handleFileUpload = (event) => {
    file.value = event.target.files[0];
    selectedFileName.value = file.value?.name || '';
};

const processCSV = async () => {
    if (!file.value) return;

    // improved security check
    const isTeam = !!currentTeam.value?.$id;
    const teamId = currentTeam.value?.$id || user.value?.$id;
    const ownerType = isTeam ? 'team' : 'user';
    
    if (!teamId) {
        addToast({ type: 'error', message: "Error: You must be logged in to import items." });
        return;
    }

    processing.value = true;
    logs.value = [];
    progress.value = 0;

    Papa.parse(file.value, {
        header: true,
        skipEmptyLines: 'greedy', // Better for handling trailing newlines
        complete: async (results) => {
            const rows = results.data;
            total.value = rows.length;
            
            // Run async loop properly
            await processRows(rows);
            
            processing.value = false;
            fetchInventory(''); 
        },
        error: (err) => {
            logs.value.push(`❌ CSV Error: ${err.message}`);
            processing.value = false;
        }
    });
};

const processRows = async (rows) => {

    // (Removed auto-fix bucket call as requested - run `node scripts/fix-bucket.mjs` if needed)
    
    // improved security check
    const isTeam = !!currentTeam.value?.$id;
    const teamId = currentTeam.value?.$id || user.value?.$id;
    const ownerType = isTeam ? 'team' : 'user';
    
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
                if (i === 0) {
                     logs.value.push("Headers: " + Object.keys(row).join(', '));
                }
        progress.value = i + 1;
        
        // 1. Detect Item ID (Priority: Explicit columns -> 9-digit numbers)
        let itemId = row['Item ID'] || row['ID'] || row['Item #'] || row['ItemId'] || row['Item Id'] || row['Item#'];
        
        // 2. Detect Order ID (Explicit columns)
        let orderId = row['Order ID'] || row['Order #'] || row['Order Number'] || row['OrderId'] || row['Order Id'] || row['Order No'] || row['Order No.'] || row['Invoice ID'] || row['Invoice #'];

        // Heuristics if explicit columns are missing
        if (!itemId) {
                // Look for 9-digit numbers (Item IDs are usually 9 digits, Orders are 8)
                const possibleItem = Object.values(row).find(v => v && v.toString().match(/^\d{9}$/));
                if (possibleItem) itemId = possibleItem;
                
                // Fallback: 8-10 digits if we haven't found an order ID yet
                if (!itemId && !orderId) {
                    const possible = Object.values(row).find(v => v && v.toString().match(/^\d{8,10}$/));
                    if (possible) itemId = possible;
                }
        }

        let isOrderProxy = false;
        if (!itemId && orderId) {
             itemId = orderId;
             isOrderProxy = true;
             logs.value.push(`ℹ️ Row ${i+1}: No Item ID, using Order ID ${orderId} as identity.`);
        }

        if (!itemId) {
            logs.value.push(`⚠️ Row ${i+1}: Skipped - No Item ID or Order ID found.`);
            continue;
        }

        // Clean IDs
        itemId = itemId.toString().trim();
        if (orderId) orderId = orderId.toString().trim();

        // Check for Duplicates (Server-Side)
        try {
            let isDuplicate = false;
            try {
                const dbCheck = await databases.listDocuments(
                    import.meta.env.PUBLIC_APPWRITE_DB_ID, 
                    getCollectionId(),
                    [
                        Query.equal('identity', itemId),
                        Query.limit(1)
                    ]
                );
                isDuplicate = dbCheck.total > 0;
            } catch (e) {
                console.warn("Direct identity check failed, running title fallback:", e.message);
                // Fallback: Query by title and check if any match has this identity
                const titleCheck = await databases.listDocuments(
                    import.meta.env.PUBLIC_APPWRITE_DB_ID,
                    getCollectionId(),
                    [
                        Query.equal('title', title),
                        Query.limit(100)
                    ]
                );
                isDuplicate = titleCheck.documents.some(doc => doc.identity === itemId);
            }
            
            if (isDuplicate) {
                logs.value.push(`⏭️ Skipping ${itemId} - Already in inventory (Duplicate Check).`);
                continue;
            }
        } catch (e) {
            console.warn("Duplicate check failed, proceeding w/ caution:", e);
        }

                // Fuzzy Column Helpers
                const findCol = (keys, keywords) => {
                    // 1. Try EXACT match first (case-insensitive)
                    for (const kw of keywords) {
                        const exact = keys.find(k => k.toLowerCase().trim() === kw.toLowerCase());
                        if (exact) return exact;
                    }
                    // 2. Partial match
                    return keys.find(k => keywords.some(kw => k.toLowerCase().includes(kw)));
                };
                const rowKeys = Object.keys(row);

                // 1. Fuzzy Detect Title
                const titleKey = findCol(rowKeys, ['title', 'item name', 'name', 'description', 'item']);
                let title = titleKey ? row[titleKey] : `Item ${itemId}`;

                // 2. Fuzzy Detect Price
                const priceKey = findCol(rowKeys, ['price', 'paid', 'amount', 'cost', 'total', 'bid']);
                let price = priceKey ? row[priceKey] : '0';
                
                // 3. Fuzzy Detect Image
                const imageKey = findCol(rowKeys, ['image', 'photo', 'picture', 'url']);
                const csvImage = imageKey ? row[imageKey] : null;

                let description = '';
                let mainImageLink = csvImage;
                let galleryLinks = [];

        try {
            // Fetch Data from ShopGoodwill API (via our Proxy)
            logs.value.push(`⏳ Fetching details for ${itemId}...`);
            
            const apiRes = await fetch('/api/proxy-item-details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId })
            });
            
            if (apiRes.ok) {
                const data = await apiRes.json();
                console.log(`[BulkImport] Proxy Data for ${itemId}:`, data); // DEBUG

                // Overwrite with API data if available, BUT only if we don't have a good title from CSV
                // User explicitly trusts CSV 'Item' column over API
                const isGenericTitle = title.startsWith('Item ') && title.includes(itemId);
                
                if (data.title && (isGenericTitle || !title)) {
                    title = data.title;
                }
                if (data.currentPrice) price = data.currentPrice;
                if (data.description) description = data.description;
                if (data.imageURL) {
                    mainImageLink = data.imageURL;
                    console.log(`[BulkImport] Found Image URL: ${mainImageLink}`);
                } else {
                     console.warn(`[BulkImport] API returned NO imageURL for ${itemId}`);
                }
                
                // Fetch Gallery Images
                if (data.images && Array.isArray(data.images)) {
                     // specific logic to get all images
                     galleryLinks = data.images.filter(l => l !== mainImageLink).slice(0, 5); // Limit to 5 extra
                }

            } else {
                logs.value.push(`⚠️ API fetch failed for ${itemId}. Using CSV data fallback.`);
            }

            // Clean price string
            price = price.toString().replace(/[^0-9.]/g, '');

            // Remote Upload (Server-Side) for Main Image
            let mainImageId = null; 
            let scoutBase64 = null; // Store base64 for AI 

            if (mainImageLink) {
                // Normalize URL (Fix backslashes common in SGW exports)
                const cleanLink = mainImageLink.replace(/\\/g, '/');

                try {
                    console.log(`[BulkImport] Remote Uploading: ${cleanLink}`);
                    const uploadRes = await fetch('/api/upload-remote-image', {
                        method: 'POST',
                        body: JSON.stringify({ 
                            url: cleanLink,
                            filename: `img-${itemId}`
                        }),
                        headers: { 'Content-Type': 'application/json' }
                    });
                    
                    if (uploadRes.ok) {
                        const uploadData = await uploadRes.json();
                        if (uploadData.success && uploadData.fileId) {
                            mainImageId = uploadData.fileId; 
                            scoutBase64 = uploadData.base64; // Capture Base64
                            console.log(`✅ Remote Upload Success: ${mainImageId}`);
                        } else {
                            console.error(`Remote upload backend error: ${uploadData.error}`);
                            // Fallback: If remote upload failed, still try to pass URL to AI
                        }
                    } else {
                         const errText = await uploadRes.text();
                         console.error(`Remote upload failed (${uploadRes.status}): ${errText}`);
                    }
                } catch (e) {
                    console.warn(`Remote upload network error:`, e); 
                }
            }

            // Download Gallery Images
            let galleryFiles = [];
            for (let i = 0; i < galleryLinks.length; i++) {
                try {
                    const link = galleryLinks[i];
                    
                    // Try Direct Fetch First
                    let gRes = await fetch(link);
                    
                    if (!gRes.ok) {
                         // Fallback to Proxy
                         gRes = await fetch('/api/proxy-image?url=' + encodeURIComponent(link));
                    }

                    if (gRes.ok) {
                        const blob = await gRes.blob();
                        if (blob.size > 0) {
                             const type = blob.type.includes('image') ? blob.type : 'image/jpeg';
                             const ext = type.split('/')[1] || 'jpg';
                             galleryFiles.push(new File([blob], `gallery-${itemId}-${i}.${ext}`, { type: type }));
                        }
                    } else {
                         console.warn(`Gallery image ${i} failed for ${itemId}`);
                    }
                    
                    // aggressive delay for reliability
                    await new Promise(r => setTimeout(r, 1000));
                } catch (e) {
                    console.warn("Failed to download gallery image", e);
                }
            }


            // 4. AUTO-SCOUT (AI Analysis)
            let scoutData = null;
            if (runScout.value) {
                try {
                    logs.value.push(`🤖 Scouting ${itemId}...`);
                    
                    // Prepare Context
                    const purchaseUrl = isOrderProxy && orderId 
                        ? `https://shopgoodwill.com/shopgoodwill/order/${orderId}` 
                        : `https://shopgoodwill.com/item/${itemId}`;
                        
                    let contextNotes = description || '';
                    contextNotes += `\n\nItem URL: ${purchaseUrl}`;
                    
                    // Image to Base64 (Use Remote Upload if available)
                    let base64Image = scoutBase64; // Use remote upload string

                    // Removed legacy mainImageFile check since we use remote upload now

                    // AI Scout
                    let aiRes = await fetch('/api/identify-item', {
                        method: 'POST',
                        body: JSON.stringify({ 
                            image: base64Image, 
                            imageUrl: mainImageLink, // PASS URL AS FALLBACK
                            notes: contextNotes 
                        }),
                        headers: { 'Content-Type': 'application/json' }
                    });

                    // Retry once if failed (Rate Limit?)
                    if (!aiRes.ok) {
                         console.warn(`AI failed for ${itemId}, retrying in 5s...`);
                         await new Promise(r => setTimeout(r, 5000));
                         aiRes = await fetch(`/api/identify-item`, {
                            method: 'PUT', 
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                image: base64Image, 
                                imageUrl: mainImageLink,
                                notes: contextNotes 
                            })
                        });
                    }
                    
                    if (aiRes.ok) {
                        const aiData = await aiRes.json();
                        if (aiData.items && aiData.items.length > 0) {
                            const item = aiData.items[0];
                            scoutData = item;
                            
                            // Enhance Title if generic
                            if (title.startsWith('Item ') || title.length < 5) {
                                title = item.title || item.identity;
                            }
                            
                            // Enhance Description
                            let report = `\n\n--- 🕵️ SCOUT REPORT ---\n`;
                            if(item.condition_notes) report += `**Condition:** ${item.condition_notes}\n`;
                            if(item.red_flags && item.red_flags.length > 0) report += `**🚩 Red Flags:** ${item.red_flags.join(', ')}\n`;
                            
                            // Append to description for saving to DB notes
                            description += report;
                        }
                    }
                    
                } catch (err) {
                    console.warn(`Scout failed for ${itemId}`, err);
                    logs.value.push(`⚠️ Scout failed for ${itemId}: ${err.message}`);
                }
            }


            // Constuct Notes & Links
            let notes = description;

            // DEBUG LOG: Verify Image ID before save
            if (mainImageId) {
                console.log(`[BulkImport] Ready to save ${itemId}. Image ID: ${mainImageId}`);
            } else {
                console.warn(`[BulkImport] WARNING: No mainImageId for ${itemId}`);
            }

            // Save to DB
            const itemToSave = {
                title: title,
                identity: itemId,
                condition_notes: notes,
            };
            const extraData = {
                cost: price,
                sourcingLocation: isOrderProxy && orderId 
                    ? `https://shopgoodwill.com/shopgoodwill/order/${orderId}` 
                    : `https://shopgoodwill.com/item/${itemId}`,
                status: 'acquired',
                title: title,
                orderId: orderId,
                scoutData: scoutData, // Pass the AI data
                marketDescription: scoutData ? scoutData.condition_notes : null,
                galleryFiles: galleryFiles // Pass the gallery images
            };
            if (mainImageId) {
                extraData.imageId = mainImageId;
            }

            await saveItemToInventory(itemToSave, null, extraData, teamId, ownerType);

            logs.value.push(`✅ Imported: ${title.substring(0, 30)}... ${orderId ? '(with Order Link)' : ''}`);

            // Yield to UI to prevent freezing + Aggressive Slow Down for Images
            await new Promise(r => setTimeout(r, 6000));

        } catch (err) {
            console.error(err);
            logs.value.push(`❌ Error importing ${itemId}: ${JSON.stringify(err.message)}`);
        }
        
        // Progress
        progress.value = ((i + 1) / rows.length) * 100;
    }
    
    logs.value.push('🎉 Import Complete!');
    // Trigger refresh of list
    window.location.reload();
};
</script>

<template>
    <dialog id="booth_reconciliation_modal" class="modal" :class="{ 'modal-open': isOpen }">
        <div class="modal-box w-11/12 max-w-5xl bg-base-100 p-0 overflow-hidden flex flex-col h-[90vh]">
            
            <!-- Header -->
            <div class="p-6 border-b border-base-200 flex justify-between items-center bg-base-200/50">
                <div>
                    <h3 class="font-bold text-2xl flex items-center gap-2"><Icon icon="solar:refresh-circle-linear" class="w-6 h-6 inline mr-1" /> Booth Reconciliation</h3>
                    <p class="text-sm opacity-70 mt-1">Cross-reference your external CSV against the internal database to find missing or sold items.</p>
                </div>
                <button class="btn btn-circle btn-ghost btn-sm" @click="close">✕</button>
            </div>

            <div class="p-6 overflow-y-auto flex-1">
                
                <!-- STEP 1: Upload CSV -->
                <div v-if="!results" class="flex flex-col items-center justify-center h-full max-w-md mx-auto space-y-6 text-center w-full">
                    
                    <div v-if="hasSavedSession" class="w-full bg-base-200 p-6 rounded-xl border border-primary/20 shadow-sm">
                        <div class="flex items-center justify-center mb-2"><Icon icon="solar:diskette-linear" class="w-8 h-8" /></div>
                        <h3 class="font-bold text-lg">Active Audit Found</h3>
                        <p class="text-sm opacity-70 mb-4">You have an unfinished reconciliation session saved locally.</p>
                        <button class="btn btn-primary w-full" @click="resumeSession">Resume Previous Audit</button>
                        <button class="btn btn-ghost btn-sm mt-2 w-full text-error" @click="clearSession">Discard Saved Session</button>
                    </div>

                    <div v-if="hasSavedSession" class="divider text-xs opacity-50 w-full">OR START NEW AUDIT</div>

                    <div class="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-2" v-if="!hasSavedSession">
                        <Icon icon="solar:chart-square-linear" class="w-10 h-10" />
                    </div>
                    <h2 class="text-2xl font-bold">Upload Consignment CSV</h2>
                    <p class="opacity-70 text-sm">Upload your exported CSV from your consignment software to begin the audit.</p>
                    
                    <div class="form-control w-full mt-4">
                        <label class="label">
                            <span class="label-text font-bold">Target Database</span>
                        </label>
                        <select v-model="targetDb" class="select select-bordered w-full font-mono text-sm shadow-sm bg-base-200">
                            <option value="items_dev">DEV SANDBOX (items_dev)</option>
                            <option value="items">PRODUCTION (items)</option>
                        </select>
                    </div>

                    <div class="w-full relative mt-4">
                        <input type="file" @change="handleFileUpload" accept=".csv" class="file-input file-input-bordered file-input-primary w-full shadow-sm" :disabled="processing" />
                    </div>

                    <div v-if="error" class="alert alert-error mt-4 shadow-sm text-sm">
                        <span>{{ error }}</span>
                    </div>

                    <div v-if="processing" class="mt-8 flex flex-col items-center">
                        <span class="loading loading-spinner loading-lg text-primary"></span>
                        <span class="mt-4 font-bold animate-pulse text-sm">Analyzing {{ inventoryItems.length }} inventory items...</span>
                    </div>
                </div>

                <!-- STEP 2: Results Dashboard -->
                <div v-else class="space-y-6">
                    <!-- Summary Stats -->
                    <div class="stats shadow w-full bg-base-200 border border-base-300">
                        <div class="stat place-items-center">
                            <div class="stat-title text-success font-bold">Matched Items</div>
                            <div class="stat-value text-success">{{ results.matchedItems.length }}</div>
                        </div>
                        <div class="stat place-items-center">
                            <div class="stat-title text-error font-bold">Missing from DB</div>
                            <div class="stat-value text-error">{{ results.unmatchedCsvItems.length }}</div>
                        </div>
                        <div class="stat place-items-center">
                            <div class="stat-title text-warning font-bold">Missing from Booth</div>
                            <div class="stat-value text-warning">{{ results.missingAppwriteItems.length }}</div>
                        </div>
                        <div class="stat place-items-center">
                            <div class="stat-title text-info font-bold">Sold to Update</div>
                            <div class="stat-value text-info">{{ results.soldItemsToUpdate.length }}</div>
                            <div class="stat-actions">
                                <button class="btn btn-xs btn-info mt-1" @click="markAllStatus('sold')" :disabled="results.soldItemsToUpdate.length === 0 || processingUpdates">
                                    Sync Sold
                                </button>
                            </div>
                        </div>
                        <div class="stat place-items-center">
                            <div class="stat-title text-accent font-bold">Needs Placed</div>
                            <div class="stat-value text-accent">{{ results.placedItemsToUpdate.length }}</div>
                            <div class="stat-actions">
                                <button class="btn btn-xs btn-accent mt-1" @click="markAllStatus('placed')" :disabled="results.placedItemsToUpdate.length === 0 || processingUpdates">
                                    Sync Placed
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Details Tabs -->
                    <div role="tablist" class="tabs tabs-boxed bg-base-200 font-bold w-fit mt-6">
                        <a role="tab" class="tab" :class="{'tab-active': activeTab === 'sold'}" @click="activeTab = 'sold'">Marked Sold ({{ results.soldItemsToUpdate.length }})</a>
                        <a role="tab" class="tab" :class="{'tab-active': activeTab === 'placed'}" @click="activeTab = 'placed'">Needs Placed ({{ results.placedItemsToUpdate.length }})</a>
                        <a role="tab" class="tab" :class="{'tab-active': activeTab === 'booth_missing'}" @click="activeTab = 'booth_missing'">Missing from Booth ({{ results.missingAppwriteItems.length }})</a>
                        <a role="tab" class="tab" :class="{'tab-active': activeTab === 'db_missing'}" @click="activeTab = 'db_missing'">Missing from DB ({{ results.unmatchedCsvItems.length }})</a>
                    </div>

                    <!-- Sold Items List -->
                    <div v-if="activeTab === 'sold'" class="overflow-x-auto border border-base-300 rounded-lg bg-base-100 shadow-sm mt-4">
                        <table class="table table-sm w-full">
                            <thead class="bg-base-200 text-base-content">
                                <tr>
                                    <th>Item Title</th>
                                    <th>DB Status</th>
                                    <th>Sold For</th>
                                    <th>Commission</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="item in results.soldItemsToUpdate" :key="item.id">
                                    <td class="font-bold">{{ item.title }}</td>
                                    <td><span class="badge badge-outline">{{ item.currentStatus }}</span></td>
                                    <td class="text-success font-mono">${{ item.soldPrice.toFixed(2) }}</td>
                                    <td class="text-error font-mono">-${{ item.commissionPaid.toFixed(2) }}</td>
                                    <td><button class="btn btn-xs btn-outline btn-info" @click="markSingleStatus(item.id, 'sold', item)">Mark Sold</button></td>
                                </tr>
                                <tr v-if="results.soldItemsToUpdate.length === 0">
                                    <td colspan="3" class="text-center opacity-50 py-8">No sold discrepancies found.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Placed Items List -->
                    <div v-if="activeTab === 'placed'" class="overflow-x-auto border border-base-300 rounded-lg bg-base-100 shadow-sm mt-4">
                        <table class="table table-sm w-full">
                            <thead class="bg-base-200 text-base-content">
                                <tr>
                                    <th>Item Title</th>
                                    <th>Current DB Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="item in results.placedItemsToUpdate" :key="item.id">
                                    <td class="font-bold">{{ item.title }}</td>
                                    <td><span class="badge badge-outline badge-error">{{ item.currentStatus }}</span></td>
                                    <td><button class="btn btn-xs btn-outline btn-accent" @click="markSingleStatus(item.id, 'placed')">Mark Placed</button></td>
                                </tr>
                                <tr v-if="results.placedItemsToUpdate.length === 0">
                                    <td colspan="3" class="text-center opacity-50 py-8">All active items are correctly marked as placed.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Missing from Booth List -->
                    <div v-if="activeTab === 'booth_missing'" class="overflow-x-auto border border-base-300 rounded-lg bg-base-100 shadow-sm mt-4">
                        <table class="table table-sm w-full">
                            <thead class="bg-base-200 text-base-content">
                                <tr>
                                    <th>ID</th>
                                    <th>Item Title</th>
                                    <th>DB Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="item in results.missingAppwriteItems" :key="item.$id">
                                    <td class="font-mono text-xs opacity-50">{{ item.$id }}</td>
                                    <td class="font-bold">{{ item.title }}</td>
                                    <td><span class="badge badge-outline badge-warning">{{ item.status }}</span></td>
                                </tr>
                                <tr v-if="results.missingAppwriteItems.length === 0">
                                    <td colspan="3" class="text-center opacity-50 py-8">No items missing from booth.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Missing from DB List -->
                    <div v-if="activeTab === 'db_missing'" class="overflow-x-auto border border-base-300 rounded-lg bg-base-100 shadow-sm mt-4">
                        <table class="table table-sm w-full">
                            <thead class="bg-base-200 text-base-content">
                                <tr>
                                    <th>CSV Name</th>
                                    <th>SKU</th>
                                    <th>CSV Status</th>
                                    <th>Manual Link Override</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(row, idx) in results.unmatchedCsvItems" :key="idx">
                                    <td class="font-bold">{{ row['Name'] || row['Item Name'] || row['Item'] || row['Title'] || 'Unknown' }}</td>
                                    <td class="font-mono text-xs opacity-50">{{ row['SKU'] || row['ID'] || '-' }}</td>
                                    <td><span class="badge badge-error badge-outline">{{ row['Inventory'] || row['Status'] || row['State'] || 'Unknown' }}</span></td>
                                    <td>
                                        <div class="flex gap-2 items-center min-w-[300px]">
                                            <select v-model="manualLinkSelections[idx]" class="select select-bordered select-xs w-full max-w-xs bg-base-200 font-mono text-xs truncate">
                                                <option :value="undefined">Select stranded DB item...</option>
                                                
                                                <optgroup v-if="row._suggestions && row._suggestions.length > 0" label="Top Suggestions">
                                                    <option v-for="item in row._suggestions" :key="'s_' + item.$id" :value="item.$id">
                                                        {{ item.title }}
                                                    </option>
                                                </optgroup>
                                                
                                                <optgroup label="All Unmatched Items">
                                                    <option v-for="item in results.missingAppwriteItems" :key="item.$id" :value="item.$id">
                                                        {{ item.title }}
                                                    </option>
                                                </optgroup>
                                            </select>
                                            <button 
                                                class="btn btn-xs btn-primary shadow-sm whitespace-nowrap" 
                                                :disabled="!manualLinkSelections[idx] || processingUpdates"
                                                @click="manualLinkSync(row, idx)"
                                            >
                                                Link & Sync
                                            </button>
                                            <button 
                                                class="btn btn-xs btn-outline btn-accent shadow-sm whitespace-nowrap" 
                                                :disabled="processingUpdates"
                                                @click="createNewFromCsv(row, idx)"
                                                title="Create a brand new Appwrite item from this CSV row"
                                            >
                                                + Create New
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                <tr v-if="results.unmatchedCsvItems.length === 0">
                                    <td colspan="4" class="text-center opacity-50 py-8">No items missing from database.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                </div>
            </div>
        </div>
        <form method="dialog" class="modal-backdrop">
            <button @click="close">close</button>
        </form>
    </dialog>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { reconcileBoothInventory } from '../../lib/reconciliation';
import { useInventory } from '../../composables/useInventory';
import { updateInventoryItem, getCollectionId } from '../../lib/inventory';
import { databases, Query, ID } from '../../lib/appwrite';
import { Permission, Role } from 'appwrite';
import { useAuth } from '../../composables/useAuth';
import { addToast } from '../../stores/toast';
import { Icon } from '@iconify/vue';

const props = defineProps({
    isOpen: { type: Boolean, default: false }
});

const emit = defineEmits(['close']);

// Global Inventory State
const { inventoryItems, fetchInventory } = useInventory();
const { currentTeam } = useAuth();

const processing = ref(false);
const processingUpdates = ref(false);
const error = ref(null);
const targetDb = ref(getCollectionId());
const results = ref(null);
const activeTab = ref('sold');
const manualLinkSelections = ref({});

const SESSION_KEY = 'booth_audit_session';
const hasSavedSession = ref(false);

onMounted(() => {
    checkSavedSession();
});

const checkSavedSession = () => {
    const saved = localStorage.getItem(SESSION_KEY);
    hasSavedSession.value = !!saved;
};

const saveSession = () => {
    if (results.value) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({
            db: targetDb.value,
            data: results.value
        }));
        hasSavedSession.value = true;
    }
};

const resumeSession = () => {
    try {
        const saved = localStorage.getItem(SESSION_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            targetDb.value = parsed.db;
            results.value = parsed.data;
        }
    } catch (e) {
        addToast({ type: 'error', message: 'Failed to restore session. It may be corrupted.' });
        clearSession();
    }
};

const clearSession = () => {
    localStorage.removeItem(SESSION_KEY);
    hasSavedSession.value = false;
    results.value = null;
    error.value = null;
};

const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    processing.value = true;
    error.value = null;

    try {
        // We override the fetch to pull from the target DB before reconciling
        // A hacky way for now since useInventory defaults to 'items'.
        // To be truly clean, we should pass the collection ID to fetchInventory, 
        // but for dev testing we'll fetch explicitly using Appwrite SDK.
        
        // Let's fetch directly to guarantee we get the right DB
        const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || import.meta.env.VITE_PUBLIC_APPWRITE_DB_ID || "resale_db";
        
        let cursor = null;
        let hasMore = true;
        const allItems = [];

        while (hasMore) {
             const queries = [Query.limit(100)];
             if (cursor) queries.push(Query.cursorAfter(cursor));
             const res = await databases.listDocuments(DB_ID, targetDb.value, queries);
             allItems.push(...res.documents);
             if (res.documents.length < 100) hasMore = false;
             else cursor = res.documents[res.documents.length - 1].$id;
        }

        const text = await file.text();
        results.value = await reconcileBoothInventory(text, allItems);
        saveSession();
        
    } catch (err) {
        error.value = "Failed to parse CSV: " + err.message;
    } finally {
        processing.value = false;
    }
};

const markSingleStatus = async (id, status, payloadData = null) => {
    try {
        const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || import.meta.env.VITE_PUBLIC_APPWRITE_DB_ID || "resale_db";
        
        const updatePayload = { status };
        if (status === 'sold' && payloadData) {
            updatePayload.soldPrice = payloadData.soldPrice;
            updatePayload.commissionPaid = payloadData.commissionPaid;
        }

        if (status === 'sold' && payloadData && payloadData.isQuantitySplit) {
            // Fetch parent
            const parentDoc = await databases.getDocument(DB_ID, targetDb.value, id);
            const qty = parentDoc.quantity || 1;
            const totalCost = Number(parentDoc.cost || 0);
            const unitCost = qty > 1 ? (totalCost / qty) : totalCost;
            
            const newQty = qty - 1;
            const newCost = Math.max(0, totalCost - unitCost);
            
            // Update Parent lot
            await databases.updateDocument(DB_ID, targetDb.value, id, {
                quantity: newQty,
                cost: newCost
            });
            
            // Create Child sold document
            const childDoc = {
                title: payloadData.title,
                identity: payloadData.title,
                conditionNotes: `Sold from Lot: ${parentDoc.title} (${parentDoc.$id})`,
                status: 'sold',
                cost: unitCost,
                soldPrice: payloadData.soldPrice || 0,
                commissionPaid: payloadData.commissionPaid || 0,
                parentLotId: parentDoc.$id,
                quantity: 1,
                tenantId: parentDoc.tenantId || null,
                userId: parentDoc.userId || null,
                storageLocation: parentDoc.storageLocation || null,
                sourcingLocation: parentDoc.sourcingLocation || null
            };
            
            Object.keys(childDoc).forEach(key => childDoc[key] === undefined && delete childDoc[key]);
            
            let permissions = undefined;
            if (parentDoc.tenantId && parentDoc.tenantId !== 'default') {
                permissions = [
                    Permission.read(Role.team(parentDoc.tenantId)),
                    Permission.update(Role.team(parentDoc.tenantId)),
                    Permission.delete(Role.team(parentDoc.tenantId)),
                ];
            } else if (parentDoc.userId) {
                permissions = [
                    Permission.read(Role.user(parentDoc.userId)),
                    Permission.update(Role.user(parentDoc.userId)),
                    Permission.delete(Role.user(parentDoc.userId)),
                ];
            }
            
            await databases.createDocument(DB_ID, targetDb.value, ID.unique(), childDoc, permissions);
        } else {
            await databases.updateDocument(DB_ID, targetDb.value, id, updatePayload);
        }
        
        if (status === 'sold') {
            results.value.soldItemsToUpdate = results.value.soldItemsToUpdate.filter(i => i.id !== id);
        } else if (status === 'placed') {
            results.value.placedItemsToUpdate = results.value.placedItemsToUpdate.filter(i => i.id !== id);
        }
        
        saveSession();
        addToast({ type: 'success', message: `Item marked as ${status}.` });
    } catch (e) {
        addToast({ type: 'error', message: 'Failed to update item: ' + e.message });
    }
};

const manualLinkSync = async (csvRow, idx) => {
    const selectedId = manualLinkSelections.value[idx];
    if (!selectedId) return;

    processingUpdates.value = true;
    try {
        const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || import.meta.env.VITE_PUBLIC_APPWRITE_DB_ID || "resale_db";
        
        const csvStatusRaw = (csvRow['Status'] || csvRow['Inventory'] || csvRow['State'] || '').trim().toLowerCase();
        const qtyStr = csvRow['Quantity'] || csvRow['Qty'] || csvRow['In Stock'] || '1';
        const parsedQty = parseInt(qtyStr, 10);
        const qty = isNaN(parsedQty) ? 1 : parsedQty;
        
        const isSalesReportRow = csvRow['Sale#'] !== undefined || csvRow['Sold Date'] !== undefined;
        const isSoldInCsv = isSalesReportRow || csvStatusRaw.includes('sold') || csvStatusRaw.includes('out of stock') || qty === 0;
        
        const updatePayload = { status: isSoldInCsv ? 'sold' : 'placed' };
        
        if (isSoldInCsv) {
            const rawAmount = csvRow['Amount'] || csvRow['Agreed Price'] || csvRow['Agreed'] || '0';
            const rawCostSplit = csvRow['Cost/Split'] || '0';
            const rawConsignorPct = csvRow['Consignor %'] || '100'; 
            
            const soldPrice = parseFloat(rawAmount.replace(/[^0-9.]/g, '')) || 0;
            let commissionPaid = 0;

            if (csvRow['Cost/Split'] !== undefined) {
                const payout = parseFloat(rawCostSplit.replace(/[^0-9.-]/g, '')) || 0;
                commissionPaid = Math.max(0, soldPrice - payout);
            } else {
                const consignorPct = parseFloat(rawConsignorPct.replace(/[^0-9.]/g, '')) || 100;
                commissionPaid = soldPrice * ((100 - consignorPct) / 100);
            }
            
            updatePayload.soldPrice = soldPrice;
            updatePayload.commissionPaid = commissionPaid;
        }

        // Fetch selected item to check for lot
        const dbItem = await databases.getDocument(DB_ID, targetDb.value, selectedId);
        const parentQty = dbItem.quantity || 1;

        if (isSoldInCsv && parentQty > 1) {
            const totalCost = Number(dbItem.cost || 0);
            const unitCost = totalCost / parentQty;
            
            const newQty = parentQty - 1;
            const newCost = Math.max(0, totalCost - unitCost);
            
            // Update Parent lot
            await databases.updateDocument(DB_ID, targetDb.value, selectedId, {
                quantity: newQty,
                cost: newCost
            });
            
            // Create Child Sold
            const childDoc = {
                title: csvRow['Name'] || csvRow['Item Name'] || csvRow['Item'] || csvRow['Title'] || 'Linked Item from CSV',
                identity: csvRow['Name'] || csvRow['Item Name'] || csvRow['Item'] || csvRow['Title'] || 'Linked Item',
                conditionNotes: `Manually synced from Lot: ${dbItem.title} (${dbItem.$id})`,
                status: 'sold',
                cost: unitCost,
                soldPrice: updatePayload.soldPrice || 0,
                commissionPaid: updatePayload.commissionPaid || 0,
                parentLotId: dbItem.$id,
                quantity: 1,
                tenantId: dbItem.tenantId || null,
                userId: dbItem.userId || null,
                storageLocation: dbItem.storageLocation || null,
                sourcingLocation: dbItem.sourcingLocation || null
            };
            
            Object.keys(childDoc).forEach(key => childDoc[key] === undefined && delete childDoc[key]);
            
            let permissions = undefined;
            if (dbItem.tenantId && dbItem.tenantId !== 'default') {
                permissions = [
                    Permission.read(Role.team(dbItem.tenantId)),
                    Permission.update(Role.team(dbItem.tenantId)),
                    Permission.delete(Role.team(dbItem.tenantId)),
                ];
            } else if (dbItem.userId) {
                permissions = [
                    Permission.read(Role.user(dbItem.userId)),
                    Permission.update(Role.user(dbItem.userId)),
                    Permission.delete(Role.user(dbItem.userId)),
                ];
            }
            
            await databases.createDocument(DB_ID, targetDb.value, ID.unique(), childDoc, permissions);
        } else {
            await databases.updateDocument(DB_ID, targetDb.value, selectedId, updatePayload);
        }
        
        // Remove from both Missing arrays
        results.value.missingAppwriteItems = results.value.missingAppwriteItems.filter(i => i.$id !== selectedId);
        results.value.unmatchedCsvItems.splice(idx, 1);
        
        // Clear selection and reindex others if necessary by resetting
        manualLinkSelections.value = {};
        saveSession();
        
        addToast({ type: 'success', message: `Manually linked and synced as ${updatePayload.status}!` });
    } catch (e) {
        addToast({ type: 'error', message: 'Manual link failed: ' + e.message });
    } finally {
        processingUpdates.value = false;
    }
};

const createNewFromCsv = async (csvRow, idx) => {
    processingUpdates.value = true;
    try {
        const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || import.meta.env.VITE_PUBLIC_APPWRITE_DB_ID || "resale_db";
        
        const csvStatusRaw = (csvRow['Status'] || csvRow['Inventory'] || csvRow['State'] || '').trim().toLowerCase();
        const qtyStr = csvRow['Quantity'] || csvRow['Qty'] || csvRow['In Stock'] || '1';
        const parsedQty = parseInt(qtyStr, 10);
        const qty = isNaN(parsedQty) ? 1 : parsedQty;
        
        const isSalesReportRow = csvRow['Sale#'] !== undefined || csvRow['Sold Date'] !== undefined;
        const isSoldInCsv = isSalesReportRow || csvStatusRaw.includes('sold') || csvStatusRaw.includes('out of stock') || qty === 0;
        
        const docPayload = {
            title: csvRow['Name'] || csvRow['Item Name'] || csvRow['Title'] || 'Untitled Item from CSV',
            identity: csvRow['Name'] || csvRow['Item Name'] || csvRow['Title'] || 'Untitled Item',
            conditionNotes: 'Created via Booth Sync',
            status: isSoldInCsv ? 'sold' : 'placed',
            tenantId: currentTeam.value?.$id || 'unassigned'
        };
        
        if (isSoldInCsv) {
            const rawAmount = csvRow['Amount'] || csvRow['Agreed Price'] || csvRow['Agreed'] || '0';
            const rawCostSplit = csvRow['Cost/Split'] || '0';
            const rawConsignorPct = csvRow['Consignor %'] || '100'; 
            
            const soldPrice = parseFloat(rawAmount.replace(/[^0-9.]/g, '')) || 0;
            let commissionPaid = 0;

            if (csvRow['Cost/Split'] !== undefined) {
                const payout = parseFloat(rawCostSplit.replace(/[^0-9.-]/g, '')) || 0;
                commissionPaid = Math.max(0, soldPrice - payout);
            } else {
                const consignorPct = parseFloat(rawConsignorPct.replace(/[^0-9.]/g, '')) || 100;
                commissionPaid = soldPrice * ((100 - consignorPct) / 100);
            }
            
            docPayload.soldPrice = soldPrice;
            docPayload.commissionPaid = commissionPaid;
        }

        let permissions = undefined;
        if (currentTeam.value?.$id) {
            permissions = [
                Permission.read(Role.team(currentTeam.value.$id)),
                Permission.update(Role.team(currentTeam.value.$id)),
                Permission.delete(Role.team(currentTeam.value.$id)),
            ];
        }

        await databases.createDocument(DB_ID, targetDb.value, ID.unique(), docPayload, permissions);
        
        // Remove from UI
        results.value.unmatchedCsvItems.splice(idx, 1);
        saveSession();
        
        addToast({ type: 'success', message: `Created new item and marked as ${docPayload.status}!` });
    } catch (e) {
        addToast({ type: 'error', message: 'Failed to create item: ' + e.message });
    } finally {
        processingUpdates.value = false;
    }
};

const markAllStatus = async (status) => {
    const listToUpdate = status === 'sold' ? [...results.value.soldItemsToUpdate] : [...results.value.placedItemsToUpdate];
    if (!results.value || listToUpdate.length === 0) return;
    
    processingUpdates.value = true;
    
    try {
        const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || import.meta.env.VITE_PUBLIC_APPWRITE_DB_ID || "resale_db";
        
        // Update sequentially to prevent race conditions on quantity updates
        for (const item of listToUpdate) {
            await markSingleStatus(item.id, status, item);
        }
        
        if (status === 'sold') {
            results.value.soldItemsToUpdate = [];
        } else if (status === 'placed') {
            results.value.placedItemsToUpdate = [];
        }

        saveSession();
        addToast({ type: 'success', message: `All matched items marked as ${status}!` });
    } catch (e) {
        addToast({ type: 'error', message: 'Failed to bulk update items: ' + e.message });
    } finally {
        processingUpdates.value = false;
    }
};

const close = () => {
    results.value = null;
    error.value = null;
    manualLinkSelections.value = {};
    checkSavedSession(); // Refresh in case it was saved during the modal's open state
    emit('close');
};
</script>

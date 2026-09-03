<template>
  <div class="card bg-base-100 shadow-xl border border-base-200">
    <div class="card-body p-4 sm:p-6">
      
      <!-- 1. Top Scan / Intake Hero Card (FIRST THING) -->
      <div class="mb-6 p-4 sm:p-5 rounded-2xl border-2 border-dashed border-primary/40 bg-gradient-to-br from-base-200/90 to-base-200/40 shadow-sm space-y-4">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center text-primary shrink-0 shadow-inner">
              <Icon icon="solar:bill-list-bold-duotone" class="w-6 h-6" />
            </div>
            <div>
              <div class="font-bold text-base text-base-content flex items-center gap-2">
                Scan Receipt or Invoice
                <span class="badge badge-sm badge-primary text-primary-content font-extrabold whitespace-nowrap text-[10px] uppercase tracking-wider px-2 shadow-xs">AI Powered</span>
              </div>
              <div class="text-xs opacity-70">Snap with live camera guide or upload receipt photos.</div>
            </div>
          </div>
          
          <!-- Mode Toggle Pill -->
          <div class="join bg-base-100 p-0.5 rounded-xl border border-base-300 w-full sm:w-auto shadow-inner">
            <button type="button" class="btn btn-xs join-item flex-1 sm:flex-none gap-1 py-1 px-3" :class="globalMode === 'mixed' ? 'btn-primary font-bold' : 'btn-ghost opacity-70'" @click="setGlobalMode('mixed')">
              <Icon icon="solar:box-minimalistic-bold" class="w-3.5 h-3.5" /> Product
            </button>
            <button type="button" class="btn btn-xs join-item flex-1 sm:flex-none gap-1 py-1 px-3" :class="globalMode === 'all_expense' ? 'btn-warning font-bold' : 'btn-ghost opacity-70'" @click="setGlobalMode('all_expense')">
              <Icon icon="solar:wallet-bold" class="w-3.5 h-3.5" /> 100% Expense
            </button>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <button class="btn btn-primary text-primary-content btn-md font-bold w-full gap-2 shadow-sm rounded-xl" @click="scannerWidget?.startCamera()" :disabled="scanningReceipt">
            <span v-if="scanningReceipt" class="loading loading-spinner loading-sm"></span>
            <Icon v-else icon="solar:camera-bold-duotone" class="w-5 h-5" />
            {{ scanningReceipt ? 'Analyzing Receipt...' : 'Take Photo (Camera)' }}
          </button>
          <button class="btn btn-outline btn-md font-bold w-full gap-2 rounded-xl bg-base-100" @click="receiptInput?.click()" :disabled="scanningReceipt">
            <Icon icon="solar:folder-with-files-bold-duotone" class="w-5 h-5 text-secondary" />
            Upload File(s) / Gallery
          </button>
          <input type="file" ref="receiptInput" @change="handleReceiptUpload" accept="image/*" multiple class="hidden" />
        </div>
      </div>

      <!-- 2. Purchase Order Details Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6 bg-base-200/90 p-4 sm:p-5 rounded-2xl border border-base-300 shadow-xs">
        <div class="form-control">
          <label class="label py-1"><span class="label-text text-xs font-bold text-base-content/90">Trip / Vendor Name</span></label>
          <input type="text" v-model="poVendor" placeholder="e.g. Goodwill - Happy Valley" class="input input-bordered w-full bg-base-100 text-sm font-semibold text-base-content focus:border-primary" ref="vendorInput" @keyup.enter="focusFirstItem" />
        </div>
        <div class="form-control">
          <label class="label py-1"><span class="label-text text-xs font-bold text-base-content/90">Purchase Date</span></label>
          <input type="date" v-model="poDate" class="input input-bordered w-full bg-base-100 text-sm font-semibold text-base-content focus:border-primary" />
        </div>
        <div class="form-control">
          <label class="label py-1">
            <span class="label-text text-xs font-bold text-base-content/90">Total Spent</span>
            <span class="label-text-alt text-warning text-xs font-bold" v-if="poTotal && computedItemsTotal !== poTotal">
              Lines: ${{ computedItemsTotal.toFixed(2) }}
            </span>
          </label>
          <label class="input input-bordered flex items-center gap-2 bg-base-100 focus-within:border-primary">
            <span class="text-sm font-bold text-primary">$</span>
            <input type="number" step="0.01" v-model.number="poTotal" placeholder="0.00" class="grow font-mono font-bold text-sm text-base-content" />
          </label>
        </div>
      </div>

      <!-- 3. Items Header & Count -->
      <div class="flex items-center justify-between gap-2 mb-3.5 px-1">
        <div class="flex items-center gap-2">
          <h3 class="font-extrabold text-sm sm:text-base text-base-content tracking-wide flex items-center gap-2">
            Line Items
            <span class="badge badge-neutral font-mono font-bold">{{ validItems.length }}</span>
          </h3>
        </div>
        <button class="btn btn-outline btn-primary btn-xs font-bold gap-1.5 rounded-lg shadow-2xs" @click="addNewLine(items.length - 1)">
          <Icon icon="solar:add-circle-bold" class="w-4 h-4" /> Add Line
        </button>
      </div>

      <!-- 4A. Mobile-First Card View (Screens < 768px - NO HORIZONTAL SCROLL & NO CLIPPING) -->
      <div class="block md:hidden space-y-3 mb-5">
        <div v-for="(item, index) in items" :key="index" 
             class="bg-base-200/90 border border-base-300 rounded-2xl p-3.5 space-y-3 shadow-xs transition-all hover:border-primary/50">
          
          <!-- Card Header: Index + In-Cart Badge + Type Switcher + Delete -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="badge badge-primary font-mono font-bold text-xs px-2.5 py-3 rounded-lg shadow-2xs">
                #{{ index + 1 }}
              </span>
              <span v-if="item.linkedItemId" class="badge badge-accent badge-sm font-bold gap-1">
                <Icon icon="solar:link-circle-bold" class="w-3.5 h-3.5" /> In Cart
              </span>
            </div>

            <div class="flex items-center gap-1.5">
              <!-- Type Switcher Pill -->
              <button type="button" 
                      @click="toggleItemType(index)"
                      class="btn btn-xs rounded-full gap-1.5 px-3 py-1 font-bold transition-all shadow-2xs"
                      :class="item.type === 'expense' ? 'bg-warning/25 text-warning border border-warning/50 hover:bg-warning/35' : 'bg-primary/25 text-primary border border-primary/50 hover:bg-primary/35'">
                <Icon :icon="item.type === 'expense' ? 'solar:wallet-bold' : 'solar:box-minimalistic-bold'" class="w-3.5 h-3.5" />
                <span class="text-xs">{{ item.type === 'expense' ? 'Expense' : 'Product' }}</span>
              </button>

              <!-- Delete Button -->
              <button @click="removeItem(index)" class="btn btn-ghost btn-xs btn-circle text-error/70 hover:text-error hover:bg-error/10" title="Delete item">
                <Icon icon="solar:trash-bin-trash-bold" class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Card Middle: Full Width Title (Auto-wraps so text is NEVER cut off) -->
          <div>
            <textarea v-model="item.title" 
                      rows="2"
                      placeholder="Item title / description" 
                      class="textarea textarea-bordered w-full bg-base-100 font-semibold text-sm leading-snug text-base-content focus:border-primary resize-none py-2 px-3 rounded-xl shadow-2xs" 
                      :class="{ 'text-warning font-bold': item.type === 'expense' }" 
                      :ref="el => setItemRef(el, index, 'title')" 
                      @keyup.enter="focusField(index, 'cost')"></textarea>
          </div>

          <!-- Card Footer: Spacious Cost & Quantity Controls -->
          <div class="flex items-center justify-between gap-3 pt-1 border-t border-base-300/60">
            <!-- Cost Input -->
            <div class="flex items-center gap-1.5 grow">
              <span class="text-xs font-bold text-base-content/70">Cost:</span>
              <label class="input input-bordered input-sm flex items-center gap-1.5 bg-base-100 grow max-w-36 focus-within:border-primary rounded-xl">
                <span class="text-xs font-bold text-success">$</span>
                <input type="number" 
                       step="0.01" 
                       v-model.number="item.cost" 
                       placeholder="0.00" 
                       class="w-full text-sm font-mono font-bold text-base-content" 
                       :ref="el => setItemRef(el, index, 'cost')" 
                       @keyup.enter="focusField(index, 'qty')" 
                       @focus="$event.target.select()" />
              </label>
            </div>

            <!-- Quantity Input -->
            <div class="flex items-center gap-1.5 shrink-0">
              <span class="text-xs font-bold text-base-content/70">Qty:</span>
              <input type="number" 
                     min="1" 
                     v-model.number="item.quantity" 
                     class="input input-bordered input-sm w-16 text-center font-mono font-bold text-sm bg-base-100 rounded-xl focus:border-primary" 
                     :ref="el => setItemRef(el, index, 'qty')" 
                     @keyup.enter="addNewLine(index)" 
                     @focus="$event.target.select()" />
            </div>
          </div>

        </div>
      </div>

      <!-- 4B. Desktop Table View (Screens >= 768px) -->
      <div class="hidden md:block overflow-x-auto w-full mb-5 rounded-2xl border border-base-300">
        <table class="table table-zebra w-full">
          <thead class="bg-base-300 text-xs font-bold text-base-content/80 uppercase">
            <tr>
              <th class="w-12 text-center">#</th>
              <th>Item Title / Description</th>
              <th class="w-36">Unit Cost</th>
              <th class="w-24 text-center">Qty</th>
              <th class="w-32 text-center">Type</th>
              <th class="w-12"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in items" :key="index" class="hover">
              <td class="text-center font-mono font-bold text-xs opacity-60 relative">
                <span v-if="item.linkedItemId" class="absolute -top-1 -right-1 text-accent" title="Linked to item in cart">
                    <Icon icon="solar:link-circle-bold" class="w-3.5 h-3.5" />
                </span>
                {{ index + 1 }}
              </td>
              <td>
                <input type="text" v-model="item.title" placeholder="Item name" class="input input-sm input-ghost w-full font-semibold text-sm text-base-content" :class="{ 'text-accent font-bold': item.linkedItemId, 'text-warning font-bold': item.type === 'expense' }" :ref="el => setItemRef(el, index, 'title')" @keyup.enter="focusField(index, 'cost')" />
              </td>
              <td>
                <label class="input input-sm input-bordered flex items-center gap-1.5 w-full px-2.5 bg-base-100">
                  <span class="text-xs font-bold text-success">$</span>
                  <input type="number" step="0.01" v-model.number="item.cost" placeholder="0.00" class="grow w-full font-mono font-bold text-sm text-base-content" :ref="el => setItemRef(el, index, 'cost')" @keyup.enter="focusField(index, 'qty')" @focus="$event.target.select()" />
                </label>
              </td>
              <td class="text-center">
                <input type="number" min="1" v-model.number="item.quantity" class="input input-sm input-bordered w-14 text-center font-mono px-2 font-bold text-sm bg-base-100" :ref="el => setItemRef(el, index, 'qty')" @keyup.enter="addNewLine(index)" @focus="$event.target.select()" />
              </td>
              <td class="text-center">
                <button type="button" 
                        @click="toggleItemType(index)"
                        class="btn btn-xs rounded-xl gap-1.5 transition-all w-28 font-bold"
                        :class="item.type === 'expense' ? 'bg-warning/20 text-warning border border-warning/50 hover:bg-warning/30' : 'bg-primary/20 text-primary border border-primary/50 hover:bg-primary/30'">
                  <Icon :icon="item.type === 'expense' ? 'solar:wallet-bold' : 'solar:box-minimalistic-bold'" class="w-3.5 h-3.5" />
                  <span class="text-xs">{{ item.type === 'expense' ? 'Expense' : 'Product' }}</span>
                </button>
              </td>
              <td class="text-center">
                <button @click="removeItem(index)" class="btn btn-ghost btn-xs btn-circle text-error/70 hover:text-error hover:bg-error/10" tabindex="-1">
                  <Icon icon="solar:trash-bin-trash-bold" class="w-4 h-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 5. Bottom Summary & Action Bar -->
      <div class="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 border-t border-base-300 pt-5 mt-2">
        <div class="flex flex-wrap items-center justify-between sm:justify-start gap-2.5">
          <button class="btn btn-outline btn-sm gap-1.5 rounded-xl font-bold" @click="addNewLine(items.length - 1)">
            <Icon icon="solar:add-circle-linear" class="w-4 h-4" /> Add Row
          </button>
          <div class="flex items-center gap-2">
            <span v-if="resaleItemsCount > 0" class="badge badge-md badge-primary badge-outline font-extrabold gap-1.5 py-3 px-3 rounded-xl">
              📦 {{ resaleItemsCount }} Product (${{ resaleTotal.toFixed(2) }})
            </span>
            <span v-if="expenseItemsCount > 0" class="badge badge-md badge-warning badge-outline font-extrabold gap-1.5 py-3 px-3 rounded-xl">
              💼 {{ expenseItemsCount }} Expense (${{ expenseTotal.toFixed(2) }})
            </span>
          </div>
        </div>
        
        <button class="btn btn-primary btn-md font-extrabold px-8 rounded-xl shadow-md w-full sm:w-auto text-sm" @click="submit" :disabled="saving || !poVendor || validItems.length === 0">
          <span v-if="saving" class="loading loading-spinner loading-xs"></span>
          Save {{ validItems.length }} Line(s)
        </button>
      </div>

    </div>

    <!-- In-App Camera Widget for live receipt photos with alignment viewfinder box -->
    <ScannerWidget ref="scannerWidget" :hide-all-triggers="true" overlay-mode="receipt" @photos-captured="handleCapturedReceiptPhotos" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import { purchasesAPI } from '../../lib/purchases';
import { saveItemToInventory } from '../../lib/inventory';
import { useAuth } from '../../composables/useAuth';
import { useCart } from '../../composables/useCart';
import { useLoader } from '../../composables/useLoader';
import { confirmDialog } from '../../stores/confirm';
import { addToast } from '../../stores/toast';
import { databases, ID } from '../../lib/appwrite';
import { isAlphaMode } from '../../stores/env';
import ScannerWidget from '../common/ScannerWidget.vue';

const { currentTeam } = useAuth();
const { activeCart, cartItems } = useCart();
const { showLoader, hideLoader } = useLoader();
const saving = ref(false);

const poVendor = ref('');
const poDate = ref(new Date().toISOString().split('T')[0]);
const poTotal = ref('');
const globalMode = ref('mixed'); // 'mixed' | 'all_expense'

const items = ref([
    { title: '', cost: null, quantity: 1, type: 'resale', linkedItemId: null },
    { title: '', cost: null, quantity: 1, type: 'resale', linkedItemId: null },
    { title: '', cost: null, quantity: 1, type: 'resale', linkedItemId: null }
]);

const receiptInput = ref(null);
const scannerWidget = ref(null);
const scanningReceipt = ref(false);

const isLikelyExpense = (title) => {
    const t = (title || '').toLowerCase();
    return t.includes('bag') || t.includes('fee') || t.includes('donation') || 
           t.includes('round up') || t.includes('round-up') || t.includes('roundup') ||
           t.includes('tax') || t.includes('shipping') || t.includes('freight') || 
           t.includes('supplies') || t.includes('tape') || t.includes('mailer') || 
           t.includes('hanger') || t.includes('tip');
};

const setGlobalMode = (mode) => {
    globalMode.value = mode;
    if (mode === 'all_expense') {
        items.value.forEach(i => i.type = 'expense');
    } else {
        items.value.forEach(i => {
            i.type = isLikelyExpense(i.title) ? 'expense' : 'resale';
        });
    }
};

const toggleItemType = (index) => {
    if (items.value[index]) {
        items.value[index].type = items.value[index].type === 'expense' ? 'resale' : 'expense';
    }
};

const processReceiptFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;

    scanningReceipt.value = true;
    showLoader("Reading & Scanning Receipt...", {
        step: "AI is extracting store name, date, prices, and line items",
        cancelable: true
    });
    try {
        // Convert all selected files to base64
        const base64Images = [];
        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            base64Images.push(base64);
        }

        const res = await fetch('/api/parse-receipt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images: base64Images })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Server error (HTTP ${res.status})`);
        }

        const parsed = await res.json();
        
        if (parsed.vendor) poVendor.value = parsed.vendor;
        if (parsed.total) {
            const parsedTot = parseFloat(parsed.total);
            if (!isNaN(parsedTot) && parsedTot > 0) poTotal.value = parsedTot;
        }
        if (parsed.date) {
            // Attempt to format date to YYYY-MM-DD
            try {
                const d = new Date(parsed.date);
                if (!isNaN(d.getTime())) {
                    poDate.value = d.toISOString().split('T')[0];
                }
            } catch(e){}
        }

        if (parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
            let mappedItems = parsed.items.map(i => ({
                title: i.title || '',
                cost: i.cost ? parseFloat(i.cost) : null,
                quantity: i.quantity ? parseInt(i.quantity) : 1,
                type: globalMode.value === 'all_expense' ? 'expense' : (isLikelyExpense(i.title) ? 'expense' : 'resale'),
                linkedItemId: null
            }));
            
            // Check for cart conflicts
            if (activeCart.value && cartItems.value.length > 0) {
                const wantsToMerge = await confirmDialog(
                    "Existing Scout Items Found",
                    `You have ${cartItems.value.length} item(s) already scouted in your cart. Do you want to merge this receipt with your cart items by matching prices?`,
                    "Merge Receipt",
                    "Add Separately"
                );
                
                if (wantsToMerge) {
                    // Make a copy of cart items we haven't matched yet
                    const availableCartItems = [...cartItems.value];
                    
                    mappedItems.forEach(recItem => {
                        if (recItem.cost && recItem.type === 'resale') {
                            // Find an available cart item with exact same cost
                            const matchIdx = availableCartItems.findIndex(ci => ci.cost === recItem.cost);
                            if (matchIdx !== -1) {
                                recItem.linkedItemId = availableCartItems[matchIdx].$id;
                                // Use the title from the cart instead of the receipt's generic name
                                recItem.title = availableCartItems[matchIdx].title;
                                availableCartItems.splice(matchIdx, 1); // Consume it
                            }
                        }
                    });
                }
            }

            items.value = mappedItems;

            addToast({ 
                type: 'success', 
                message: `Receipt parsed! Extracted ${parsed.items.length} items from ${parsed.vendor || 'receipt'}.` 
            });
        } else {
            addToast({ 
                type: 'warning', 
                message: 'Receipt parsed, but no individual item lines were detected.' 
            });
        }
    } catch (err) {
        console.error("Receipt parsing error:", err);
        addToast({ type: 'error', message: `Receipt scan error: ${err.message || 'Please try another photo or enter manually.'}` });
    } finally {
        scanningReceipt.value = false;
        hideLoader();
        if (receiptInput.value) receiptInput.value.value = ''; // Reset input
    }
};

const handleReceiptUpload = async (event) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;
    addToast({ type: 'info', message: `Analyzing ${fileList.length} receipt image(s)...` });
    await processReceiptFiles(Array.from(fileList));
};

const handleCapturedReceiptPhotos = async (capturedPhotos) => {
    if (!capturedPhotos || capturedPhotos.length === 0) return;
    if (scannerWidget.value) {
        scannerWidget.value.stopCamera();
    }
    addToast({ type: 'info', message: 'Analyzing captured receipt photo...' });
    await processReceiptFiles(capturedPhotos);
};

const itemRefs = ref({});

const setItemRef = (el, index, field) => {
    if (el) {
        if (!itemRefs.value[index]) itemRefs.value[index] = {};
        itemRefs.value[index][field] = el;
    }
};

const computedItemsTotal = computed(() => {
    return items.value.reduce((sum, item) => sum + ((Number(item.cost) || 0) * (Number(item.quantity) || 1)), 0);
});

const validItems = computed(() => items.value.filter(i => i.title && i.title.trim() !== ''));

const validResaleItems = computed(() => validItems.value.filter(i => i.type !== 'expense'));
const validExpenseItems = computed(() => validItems.value.filter(i => i.type === 'expense'));

const resaleItemsCount = computed(() => validResaleItems.value.length);
const expenseItemsCount = computed(() => validExpenseItems.value.length);

const resaleTotal = computed(() => {
    return validResaleItems.value.reduce((sum, item) => sum + ((Number(item.cost) || 0) * (Number(item.quantity) || 1)), 0);
});

const expenseTotal = computed(() => {
    return validExpenseItems.value.reduce((sum, item) => sum + ((Number(item.cost) || 0) * (Number(item.quantity) || 1)), 0);
});

const focusFirstItem = () => {
    if (itemRefs.value[0] && itemRefs.value[0].title) {
        itemRefs.value[0].title.focus();
    }
};

const focusField = (index, field) => {
    if (itemRefs.value[index] && itemRefs.value[index][field]) {
        itemRefs.value[index][field].focus();
    }
};

const addNewLine = async (currentIndex) => {
    // If the current line is completely empty, don't add another one yet
    const curr = items.value[currentIndex];
    if (!curr.title && !curr.cost) return;

    if (currentIndex === items.value.length - 1) {
        items.value.push({ 
            title: '', 
            cost: null, 
            quantity: 1, 
            type: globalMode.value === 'all_expense' ? 'expense' : 'resale', 
            linkedItemId: null 
        });
    }
    await nextTick();
    focusField(currentIndex + 1, 'title');
};

const removeItem = (index) => {
    items.value.splice(index, 1);
    if (items.value.length === 0) {
        items.value.push({ 
            title: '', 
            cost: null, 
            quantity: 1, 
            type: globalMode.value === 'all_expense' ? 'expense' : 'resale', 
            linkedItemId: null 
        });
    }
};

const submit = async () => {
    if (!poVendor.value || validItems.value.length === 0) return;
    saving.value = true;
    
    try {
        const subtotal = resaleTotal.value;
        const feeTotal = expenseTotal.value;
        const total = poTotal.value || (subtotal + feeTotal);
        
        let purchaseId = null;
        
        // 1. Create Purchase OR Use Active Cart
        if (activeCart.value) {
            purchaseId = activeCart.value.$id;
            // Complete the cart
            const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID;
            const CARTS_COL = import.meta.env.PUBLIC_APPWRITE_PURCHASES_COL || 'purchases';
            await databases.updateDocument(DB_ID, CARTS_COL, purchaseId, {
                status: 'Received',
                vendor: poVendor.value,
                subtotal: subtotal,
                feeTotal: feeTotal,
                grandTotal: total
            });
        } else {
            const poPayload = {
                vendor: poVendor.value,
                purchaseDate: poDate.value,
                status: 'Received',
                subtotal: subtotal,
                feeTotal: feeTotal,
                grandTotal: total,
                poNumber: `PO-${Date.now().toString().slice(-6)}`
            };
            const purchase = await purchasesAPI.createPurchase(poPayload);
            purchaseId = purchase.$id;
        }
        
        // 2. Create or Update Resale Inventory Items
        const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID;
        const collId = isAlphaMode.get() 
            ? (import.meta.env.PUBLIC_APPWRITE_ALPHA_COLLECTION_ID || 'alpha_items') 
            : (import.meta.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items');
            
        const resalePromises = validResaleItems.value.map(async (item) => {
            if (item.linkedItemId) {
                // Update existing item from cart
                return databases.updateDocument(DB_ID, collId, item.linkedItemId, {
                    title: item.title,
                    cost: item.cost || 0,
                    quantity: item.quantity || 1,
                    status: 'acquired'
                });
            } else {
                // Create new item
                const identity = 'PO-' + Date.now().toString().slice(-6) + '-' + Math.floor(Math.random() * 1000);
                return saveItemToInventory(
                    { title: item.title, identity },
                    null,
                    { 
                        cost: item.cost || 0,
                        quantity: item.quantity || 1,
                        purchaseId: purchaseId,
                        status: 'acquired'
                    },
                    currentTeam.value?.$id
                );
            }
        });

        // 3. Create Operating Expense Records
        const expensePromises = validExpenseItems.value.map(async (exp) => {
            const amount = (Number(exp.cost) || 0) * (Number(exp.quantity) || 1);
            try {
                return await databases.createDocument(
                    DB_ID,
                    'expenses',
                    ID.unique(),
                    {
                        purchaseId: purchaseId,
                        cartId: purchaseId,
                        tenantId: currentTeam.value?.$id || 'personal',
                        amount: amount,
                        note: exp.title,
                        date: new Date().toISOString()
                    }
                );
            } catch (expErr) {
                console.warn("Could not save to expenses collection:", expErr);
            }
        });
        
        await Promise.all([...resalePromises, ...expensePromises]);
        
        addToast({
            type: 'success',
            message: `Saved ${validResaleItems.value.length} inventory item(s) and ${validExpenseItems.value.length} expense(s)!`
        });

        // 4. Redirect to PO to view it
        window.location.href = `/purchases/${purchaseId}`;
    } catch (err) {
        console.error("Failed to save speed entry:", err);
        addToast({ type: 'error', message: "Failed to save: " + err.message });
        saving.value = false;
    }
};

onMounted(() => {
    // Optional autofocus logic could go here
});
</script>

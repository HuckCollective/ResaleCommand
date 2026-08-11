<template>
  <div class="card bg-base-100 shadow-xl border border-base-200">
    <div class="card-body">
      <h2 class="card-title text-2xl mb-2 flex items-center gap-2">
        <Icon icon="solar:bolt-bold-duotone" class="text-warning w-6 h-6" />
        Speed Entry (Garage Sale / Thrift)
      </h2>
      <p class="text-sm opacity-70 mb-6">Rapidly enter a purchase and all its items without waiting.</p>

      <!-- Purchase Details -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 bg-base-200 p-4 rounded-box">
        <div class="form-control">
          <label class="label"><span class="label-text font-bold">Trip / Vendor Name</span></label>
          <div class="join w-full">
            <input type="text" v-model="poVendor" placeholder="e.g. Main St Garage Sale" class="input input-bordered join-item w-full bg-base-100" ref="vendorInput" @keyup.enter="focusFirstItem" />
            <button class="btn btn-secondary join-item border-l-0" @click="receiptInput?.click()" :disabled="scanningReceipt" title="Scan Receipt Image">
                <span v-if="scanningReceipt" class="loading loading-spinner loading-xs"></span>
                <Icon v-else icon="solar:camera-bold-duotone" class="w-5 h-5" />
            </button>
          </div>
          <input type="file" ref="receiptInput" @change="handleReceiptUpload" accept="image/*" class="hidden" />
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text font-bold">Purchase Date</span></label>
          <input type="date" v-model="poDate" class="input input-bordered w-full bg-base-100" />
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text font-bold">Total Spent (Optional)</span></label>
          <label class="input input-bordered flex items-center gap-2 bg-base-100">
            $ <input type="number" step="0.01" v-model.number="poTotal" placeholder="0.00" class="grow" />
          </label>
          <label class="label"><span class="label-text-alt text-warning" v-if="poTotal && computedItemsTotal !== poTotal">Items total: ${{ computedItemsTotal.toFixed(2) }}</span></label>
        </div>
      </div>

      <!-- Line Items Grid -->
      <div class="overflow-x-auto w-full mb-4 rounded-box border border-base-200">
        <table class="table table-zebra table-sm w-full">
          <thead class="bg-base-300">
            <tr>
              <th class="w-12 text-center">#</th>
              <th>Item Title / Description</th>
              <th class="w-32">Unit Cost</th>
              <th class="w-24">Qty</th>
              <th class="w-16"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in items" :key="index" class="hover">
              <td class="text-center font-mono opacity-50 relative">
                <span v-if="item.linkedItemId" class="absolute -top-1 -right-1 text-accent" title="Linked to item in cart">
                    <Icon icon="solar:link-circle-bold" class="w-3 h-3" />
                </span>
                {{ index + 1 }}
              </td>
              <td>
                <input type="text" v-model="item.title" placeholder="Item name" class="input input-sm input-ghost w-full" :class="{ 'text-accent font-bold': item.linkedItemId }" :ref="el => setItemRef(el, index, 'title')" @keyup.enter="focusField(index, 'cost')" />
              </td>
              <td>
                <label class="input input-sm input-ghost flex items-center gap-1 w-full px-2" :class="{ 'border-accent/30 bg-accent/5': item.linkedItemId }">
                  $ <input type="number" step="0.01" v-model.number="item.cost" placeholder="0" class="grow w-full" :ref="el => setItemRef(el, index, 'cost')" @keyup.enter="focusField(index, 'qty')" @focus="$event.target.select()" />
                </label>
              </td>
              <td>
                <input type="number" min="1" v-model.number="item.quantity" class="input input-sm input-ghost w-full px-2" :ref="el => setItemRef(el, index, 'qty')" @keyup.enter="addNewLine(index)" @focus="$event.target.select()" />
              </td>
              <td class="text-center">
                <button @click="removeItem(index)" class="btn btn-ghost btn-xs text-error" tabindex="-1">
                  <Icon icon="solar:trash-bin-trash-linear" class="w-4 h-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex justify-between items-center border-t border-base-200 pt-6">
        <button class="btn btn-outline btn-sm" @click="addNewLine(items.length - 1)">
          <Icon icon="solar:add-circle-linear" class="w-4 h-4" />
          Add Row
        </button>
        
        <button class="btn btn-primary px-8" @click="submit" :disabled="saving || !poVendor || validItems.length === 0">
          <span v-if="saving" class="loading loading-spinner loading-xs"></span>
          Save {{ validItems.length }} Items
        </button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import { purchasesAPI } from '../../lib/purchases';
import { saveItemToInventory } from '../../lib/inventory';
import { useAuth } from '../../composables/useAuth';
import { useCart } from '../../composables/useCart';
import { confirmDialog } from '../../stores/confirm';
import { databases } from '../../lib/appwrite';
import { isAlphaMode } from '../../stores/env';

const { currentTeam } = useAuth();
const { activeCart, cartItems } = useCart();
const saving = ref(false);

const poVendor = ref('');
const poDate = ref(new Date().toISOString().split('T')[0]);
const poTotal = ref('');

const items = ref([
    { title: '', cost: null, quantity: 1 },
    { title: '', cost: null, quantity: 1 },
    { title: '', cost: null, quantity: 1 }
]);

const receiptInput = ref(null);
const scanningReceipt = ref(false);

const handleReceiptUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    scanningReceipt.value = true;
    try {
        // Convert file to base64
        const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        const res = await fetch('/api/parse-receipt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64 })
        });

        if (!res.ok) throw new Error('Failed to parse receipt');

        const parsed = await res.json();
        
        if (parsed.vendor) poVendor.value = parsed.vendor;
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
                        if (recItem.cost) {
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
            
            // Add a couple empty rows at the bottom
            items.value.push({ title: '', cost: null, quantity: 1, linkedItemId: null });
            items.value.push({ title: '', cost: null, quantity: 1, linkedItemId: null });
        }
    } catch (err) {
        console.error("Receipt parsing error:", err);
        alert("Failed to parse receipt. Please try again or enter manually.");
    } finally {
        scanningReceipt.value = false;
        if (receiptInput.value) receiptInput.value.value = ''; // Reset input
    }
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
        items.value.push({ title: '', cost: null, quantity: 1 });
    }
    await nextTick();
    focusField(currentIndex + 1, 'title');
};

const removeItem = (index) => {
    items.value.splice(index, 1);
    if (items.value.length === 0) {
        items.value.push({ title: '', cost: null, quantity: 1 });
    }
};

const submit = async () => {
    if (!poVendor.value || validItems.value.length === 0) return;
    saving.value = true;
    
    try {
        const subtotal = computedItemsTotal.value;
        const total = poTotal.value || subtotal; // If they manually entered a higher total (e.g. paying tax on a box)
        
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
                grandTotal: total
            });
        } else {
            const poPayload = {
                vendor: poVendor.value,
                purchaseDate: poDate.value,
                status: 'Received',
                subtotal: subtotal,
                grandTotal: total,
                poNumber: `PO-${Date.now().toString().slice(-6)}`
            };
            const purchase = await purchasesAPI.createPurchase(poPayload);
            purchaseId = purchase.$id;
        }
        
        // 2. Create or Update Items
        const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID;
        const collId = isAlphaMode.get() 
            ? (import.meta.env.PUBLIC_APPWRITE_ALPHA_COLLECTION_ID || 'alpha_items') 
            : (import.meta.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items');
            
        const promises = validItems.value.map(async (item) => {
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
        
        await Promise.all(promises);
        
        // 3. Redirect to PO to view it
        window.location.href = `/purchases/${purchaseId}`;
    } catch (err) {
        console.error("Failed to save speed entry:", err);
        alert("Failed to save: " + err.message);
        saving.value = false;
    }
};

onMounted(() => {
    // Optional autofocus logic could go here
});
</script>

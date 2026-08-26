<template>
  <div class="space-y-8">
    <div v-if="loadingInit" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <template v-else>
      <div class="card bg-base-100 shadow-xl border border-base-200">
        <div class="card-body">
          <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
            <h2 class="card-title text-2xl m-0">{{ isEdit ? 'Purchase Details' : 'New Purchase Order' }}</h2>
            <div class="form-control" v-if="isEdit">
              <label class="label cursor-pointer gap-2 py-0">
                <span class="label-text font-bold">Edit Mode</span>
                <input type="checkbox" class="toggle toggle-primary toggle-sm" v-model="editMode" />
              </label>
            </div>
          </div>
          
          <fieldset :disabled="isEdit && !editMode" class="border-0 p-0 m-0 min-w-0">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Left Column -->
            <div class="space-y-4">
              <div class="form-control w-full">
                <label class="label"><span class="label-text">PO Number</span></label>
                <input type="text" v-model="form.poNumber" class="input input-bordered w-full" placeholder="Auto-generated if left blank" />
              </div>
              <div class="form-control w-full">
                <label class="label"><span class="label-text">Vendor</span></label>
                <input type="text" v-model="form.vendor" class="input input-bordered w-full" placeholder="e.g. ShopGoodwill" />
              </div>
              <div class="form-control w-full">
                <label class="label"><span class="label-text">External Order ID</span></label>
                <input type="text" v-model="form.orderId" class="input input-bordered w-full" placeholder="Vendor Order ID" />
              </div>
              <div class="form-control w-full">
                <label class="label"><span class="label-text">Purchase Date</span></label>
                <input type="date" v-model="form.purchaseDate" class="input input-bordered w-full" />
              </div>
              <div class="form-control w-full">
                <label class="label"><span class="label-text">Status</span></label>
                <select v-model="form.status" class="select select-bordered w-full">
                  <option value="Draft">Draft</option>
                  <option value="Ordered">Ordered</option>
                  <option value="Shipped">Shipped</option>
                  <option value="Received">Received</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Returned">Returned</option>
                </select>
              </div>
            </div>

            <!-- Right Column -->
            <div class="space-y-4 bg-base-200 p-6 rounded-box">
              <h3 class="font-bold text-lg mb-2 border-b border-base-300 pb-2">Cost Breakdown</h3>
              <div class="form-control w-full">
                <label class="label"><span class="label-text">Subtotal</span></label>
                <label class="input input-bordered flex items-center gap-2 w-full">
                  $ <input type="number" step="0.01" v-model.number="form.subtotal" class="grow w-full" />
                </label>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div class="form-control w-full">
                  <label class="label"><span class="label-text">Shipping</span></label>
                  <label class="input input-bordered flex items-center gap-2 w-full">
                    $ <input type="number" step="0.01" v-model.number="form.shippingTotal" class="grow w-full" />
                  </label>
                </div>
                <div class="form-control w-full">
                  <label class="label"><span class="label-text">Handling</span></label>
                  <label class="input input-bordered flex items-center gap-2 w-full">
                    $ <input type="number" step="0.01" v-model.number="form.handlingTotal" class="grow w-full" />
                  </label>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div class="form-control w-full">
                  <label class="label"><span class="label-text">Tax</span></label>
                  <label class="input input-bordered flex items-center gap-2 w-full">
                    $ <input type="number" step="0.01" v-model.number="form.taxTotal" class="grow w-full" />
                  </label>
                </div>
                <div class="form-control w-full">
                  <label class="label"><span class="label-text">Fees</span></label>
                  <label class="input input-bordered flex items-center gap-2 w-full">
                    $ <input type="number" step="0.01" v-model.number="form.feeTotal" class="grow w-full" />
                  </label>
                </div>
              </div>
              
              <div class="divider"></div>
              
              <div class="flex justify-between items-center text-xl font-bold text-primary">
                <span>Grand Total</span>
                <span>${{ computedGrandTotal.toFixed(2) }}</span>
              </div>
            </div>
          </div>
          </fieldset>
          
          <div v-if="!isEdit || editMode" class="card-actions justify-between items-center mt-8 border-t border-base-200 pt-6">
            <button v-if="isEdit" class="btn btn-error btn-outline" @click="handleDelete" :disabled="saving">
              Delete Purchase
            </button>
            <div v-else></div> <!-- Spacer -->
            <button class="btn btn-primary px-8" @click="savePurchase" :disabled="saving">
              <span v-if="saving" class="loading loading-spinner loading-xs"></span>
              {{ isEdit ? 'Save Changes' : 'Create Purchase' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Items Section (Only visible if Editing) -->
      <div v-if="isEdit" class="card bg-base-100 shadow-xl border border-base-200">
        <div class="card-body">
          <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 border-b border-base-200 pb-3">
            <div>
              <h2 class="card-title text-xl flex items-center gap-2">
                <Icon icon="solar:box-bold-duotone" class="w-6 h-6 text-primary" />
                <span>Linked Items &amp; Lots ({{ items.length }})</span>
              </h2>
              <p class="text-xs opacity-60 mt-0.5">
                Total Landed Inventory: ${{ items.reduce((acc, i) => acc + (Number(i.cost) || 0), 0).toFixed(2) }}
              </p>
            </div>
            
            <div class="flex items-center gap-2">
              <a 
                :href="`/inventory?search=${encodeURIComponent(form.orderId || form.poNumber || '')}`" 
                class="btn btn-sm btn-outline btn-secondary gap-1.5 shadow-sm font-bold"
                title="Open and filter all these items in Inventory Manager"
              >
                <Icon icon="solar:magnifer-linear" class="w-4 h-4" />
                <span>View in Inventory</span>
              </a>
            </div>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <!-- Link Existing Item -->
            <div class="bg-base-200 p-4 rounded-box relative">
              <h3 class="font-bold mb-2 text-sm uppercase opacity-70">Link Existing Item</h3>
              <div class="relative w-full">
                <div class="flex items-center">
                  <input 
                    type="text" 
                    v-model="itemSearchQuery" 
                    @input="handleItemSearch" 
                    @focus="showDropdown = true"
                    @blur="setTimeout(() => showDropdown = false, 200)"
                    placeholder="Search inventory by title, UPC, or ID..." 
                    class="input input-bordered w-full pr-10 text-sm"
                  />
                  <span v-if="isSearching" class="absolute right-3 loading loading-spinner loading-sm text-primary"></span>
                </div>
                
                <!-- Search Results Dropdown -->
                <ul v-if="showDropdown && searchResults.length > 0" class="menu bg-base-100 w-full rounded-box shadow-2xl border border-base-300 absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto">
                  <li v-for="res in searchResults" :key="res.$id">
                    <a @click="linkItem(res)" class="flex justify-between items-center gap-4 hover:bg-base-200">
                      <span class="truncate max-w-[80%] flex flex-col">
                        <span class="font-bold text-sm">{{ res.title }}</span>
                        <span class="font-mono text-xs opacity-60">{{ res.upc || res.identity || res.$id }}</span>
                      </span>
                      <span class="shrink-0 flex items-center gap-2">
                        <span v-if="res.purchaseId" class="badge badge-warning badge-xs">Linked</span>
                        <span class="btn btn-xs btn-primary shadow-sm" :class="{'loading': linkingItem === res.$id}">Add</span>
                      </span>
                    </a>
                  </li>
                </ul>
                
                <div v-else-if="showDropdown && itemSearchQuery.length >= 2 && !isSearching" class="absolute left-0 right-0 z-50 mt-1 p-4 bg-base-100 rounded-box shadow-xl border border-base-300 text-center opacity-70 text-xs">
                  No items found.
                </div>
              </div>
            </div>

            <!-- Quick Create New Item -->
            <div class="bg-base-200 p-4 rounded-box relative">
              <h3 class="font-bold mb-2 text-sm uppercase opacity-70">Quick Create New Item</h3>
              <div class="flex flex-col gap-3">
                <input 
                  type="text" 
                  v-model="newItem.title" 
                  placeholder="Item Title" 
                  class="input input-bordered w-full text-sm" 
                />
                <div class="flex gap-2">
                  <label class="input input-bordered flex items-center gap-2 grow text-sm">
                    $ <input type="number" step="0.01" v-model.number="newItem.cost" class="grow w-full" placeholder="Cost" />
                  </label>
                  <button @click="quickCreateItem" class="btn btn-primary shrink-0 text-sm font-bold" :disabled="creatingItem || !newItem.title">
                    <span v-if="creatingItem" class="loading loading-spinner loading-xs"></span>
                    Create & Link
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="loadingItems" class="py-8 text-center">
            <span class="loading loading-spinner loading-md text-primary"></span>
          </div>
          <div v-else-if="items.length === 0" class="py-8 text-center opacity-50 border-2 border-dashed border-base-300 rounded-box text-sm">
            No items are linked to this purchase yet.
          </div>
          <div v-else class="overflow-x-auto border border-base-200 rounded-box">
            <table class="table table-sm table-zebra w-full">
              <thead>
                <tr>
                  <th class="w-16">Photo</th>
                  <th>Item Details</th>
                  <th>Cost (Landed)</th>
                  <th>Resale Price</th>
                  <th>Status</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in items" :key="item.$id" class="hover:bg-base-200/50">
                  <td>
                    <div class="w-12 h-12 rounded-lg overflow-hidden bg-base-200 border border-base-300 flex items-center justify-center shrink-0">
                      <img 
                        v-if="getItemImage(item)" 
                        :src="getItemImage(item)" 
                        class="w-full h-full object-cover" 
                        alt="Item Thumbnail"
                        @error="$event.target.style.display = 'none'" 
                      />
                      <Icon v-else icon="solar:gallery-wide-bold" class="w-5 h-5 opacity-30" />
                    </div>
                  </td>
                  <td>
                    <div class="flex flex-col gap-0.5">
                      <span class="font-bold text-sm text-base-content">{{ item.title }}</span>
                      <div class="flex items-center gap-2 flex-wrap">
                        <span v-if="item.upc" class="badge badge-xs badge-neutral font-mono">{{ item.upc }}</span>
                        <span v-else-if="item.identity" class="font-mono text-xs opacity-60">{{ item.identity }}</span>
                        <span v-if="item.quantity > 1 || item.title?.toLowerCase().startsWith('lot of')" class="badge badge-xs badge-secondary font-bold">Lot ({{ item.quantity }})</span>
                        <span v-if="item.parentLotId" class="badge badge-xs badge-accent">Extracted Component</span>
                      </div>
                    </div>
                  </td>
                  <td class="font-mono font-medium">${{ (Number(item.cost) || 0).toFixed(2) }}</td>
                  <td class="font-mono font-medium text-success">
                    {{ item.resalePrice ? '$' + Number(item.resalePrice).toFixed(2) : (item.listPrice ? '$' + Number(item.listPrice).toFixed(2) : '-') }}
                  </td>
                  <td>
                    <div class="badge badge-sm" :class="item.status === 'sold' ? 'badge-success' : (item.status === 'placed' ? 'badge-primary' : 'badge-ghost')">
                      {{ item.status || 'acquired' }}
                    </div>
                  </td>
                  <td class="text-right">
                    <div class="flex items-center justify-end gap-1.5">
                      <button class="btn btn-xs btn-outline btn-primary gap-1" @click="openEditItem(item)">
                        <Icon icon="solar:pen-linear" class="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button class="btn btn-xs btn-error btn-outline" @click="unlinkItem(item)" :disabled="linkingItem === item.$id">
                        <span v-if="linkingItem === item.$id" class="loading loading-spinner loading-xs"></span>
                        <span v-else>Unlink</span>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Operating Expenses Section -->
      <div v-if="isEdit" class="card bg-base-100 shadow-xl border border-base-200">
        <div class="card-body">
          <div class="flex justify-between items-center mb-4">
            <h2 class="card-title text-xl">Operating Expenses</h2>
          </div>
          <p class="text-sm opacity-70 -mt-3 mb-4">These are kept strictly separate from the Cost of Goods Sold (Subtotal/Shipping/Tax) for accurate accounting.</p>
          
          <div class="bg-base-200 p-4 rounded-box mb-6 relative">
            <h3 class="font-bold mb-2 text-sm uppercase opacity-70">Add Misc Expense</h3>
            <div class="flex gap-2">
                <input v-model="newExpenseNote" class="input input-sm grow" placeholder="Note (e.g. Lunch, Gas)" />
                <input v-model.number="newExpenseAmount" class="input input-sm w-32" type="number" step="0.01" placeholder="$ Amount" />
                <button @click="handleAddExpense" class="btn btn-sm btn-neutral" :disabled="!newExpenseAmount || loadingExpenses">
                   <span v-if="loadingExpenses" class="loading loading-spinner loading-xs"></span>
                   Add Expense
                </button>
            </div>
          </div>
          
          <div v-if="loadingExpenses && expenses.length === 0" class="py-4 text-center">
             <span class="loading loading-spinner loading-md"></span>
          </div>
          <div v-else-if="expenses.length === 0" class="py-4 text-center opacity-50 border-2 border-dashed border-base-300 rounded-box">
             No operating expenses recorded for this trip.
          </div>
          <div v-else>
              <ul class="menu bg-base-100 border border-base-200 w-full rounded-box">
                  <li v-for="exp in expenses" :key="exp.$id">
                      <div class="flex justify-between items-center hover:bg-base-200">
                          <span>{{ exp.note || 'Expense' }}</span>
                          <div class="flex items-center gap-4">
                              <span class="font-bold text-warning">${{ exp.amount.toFixed(2) }}</span>
                              <button @click="handleRemoveExpense(exp.$id)" class="btn btn-ghost btn-xs text-error p-1 min-h-0 h-auto">
                                  <Icon icon="solar:trash-bin-trash-linear" class="w-4 h-4" />
                              </button>
                          </div>
                      </div>
                  </li>
              </ul>
              <div class="text-right font-bold mt-4 text-lg">
                 Total Expenses: <span class="text-warning">${{ totalExpenses.toFixed(2) }}</span>
              </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Item Edit Drawer -->
    <ItemDrawer 
      v-if="activeEditItem" 
      :item="activeEditItem" 
      :isOpen="!!activeEditItem" 
      @close="closeEditDrawer" 
      @saved="handleSavedItem" 
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { purchasesAPI } from '../../lib/purchases';
import { getItemsByPurchaseId, searchItems, linkItemToPurchase, saveItemToInventory, updateInventoryItem, BUCKET_ID } from '../../lib/inventory';
import { databases, ID } from '../../lib/appwrite';
import { Query } from 'appwrite';
import { useAuth } from '../../composables/useAuth';
import { useLoader } from '../../composables/useLoader';
import { Icon } from '@iconify/vue';
import ItemDrawer from '../common/ItemDrawer.vue';

const { currentTeam } = useAuth();
const { showLoader, hideLoader } = useLoader();

const props = defineProps({
    purchaseId: {
        type: String,
        default: null
    }
});

const ENDPOINT = import.meta.env.PUBLIC_APPWRITE_ENDPOINT;
const PROJECT = import.meta.env.PUBLIC_APPWRITE_PROJECT_ID;
const BUCKET = BUCKET_ID;

const proxify = (url) => {
    if (!url) return null;
    if (typeof url !== 'string') return url;
    if (url.startsWith('blob:') || url.startsWith('data:') || url.includes('/api/proxy-image')) return url;
    if (url.includes('/storage/buckets/')) return url;
    if (url.startsWith('http')) return `/api/proxy-image?url=${encodeURIComponent(url)}`;
    return url;
};

const getAssetUrl = (id) => {
    if (!id) return '';
    if (typeof id === 'string' && (id.startsWith('http') || id.startsWith('data:') || id.startsWith('blob:') || id.startsWith('/api/'))) {
        return proxify(id);
    }
    return `${ENDPOINT}/storage/buckets/${BUCKET}/files/${id}/view?project=${PROJECT}`;
};

const getItemImage = (item) => {
    if (!item) return null;
    if (item.imageId) return getAssetUrl(item.imageId);
    if (item.galleryImageIds && item.galleryImageIds.length > 0) return getAssetUrl(item.galleryImageIds[0]);
    if (item.conditionNotes) {
        const match = item.conditionNotes.match(/\[MAIN IMAGE ID: ([^\]]+)\]/);
        if (match) return getAssetUrl(match[1].split(',')[0].trim());
    }
    return null;
};

const activeEditItem = ref(null);
const openEditItem = (item) => {
    activeEditItem.value = item;
};
const closeEditDrawer = () => {
    activeEditItem.value = null;
};
const handleSavedItem = async () => {
    activeEditItem.value = null;
    await loadLinkedItems();
};

const isEdit = computed(() => !!props.purchaseId);
const editMode = ref(!props.purchaseId);
const loadingInit = ref(false);
const saving = ref(false);

const form = ref({
    poNumber: '',
    vendor: '',
    orderId: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    status: 'Draft',
    subtotal: 0,
    shippingTotal: 0,
    handlingTotal: 0,
    taxTotal: 0,
    feeTotal: 0
});

const computedGrandTotal = computed(() => {
    return (form.value.subtotal || 0) + 
           (form.value.shippingTotal || 0) + 
           (form.value.handlingTotal || 0) + 
           (form.value.taxTotal || 0) + 
           (form.value.feeTotal || 0);
});

// Items State
const items = ref([]);
const loadingItems = ref(false);
const itemSearchQuery = ref('');
const searchResults = ref([]);
const searchTimeout = ref(null);
const isSearching = ref(false);
const showDropdown = ref(false);
const linkingItem = ref(null);

const creatingItem = ref(false);
const newItem = ref({
    title: '',
    cost: null
});

const expenses = ref([]);
const loadingExpenses = ref(false);
const newExpenseNote = ref('');
const newExpenseAmount = ref('');
const totalExpenses = computed(() => expenses.value.reduce((sum, e) => sum + (e.amount || 0), 0));

onMounted(async () => {
    if (isEdit.value) {
        loadingInit.value = true;
        showLoader("Loading Purchase Details...");
        try {
            // Appwrite doesn't have a simple getDocument without the DB/Coll ID exposed in purchasesAPI,
            // so we do a listPurchases with a filter by ID.
            const res = await purchasesAPI.listPurchases([Query.equal('$id', props.purchaseId)]);
            if (res.documents.length > 0) {
                const p = res.documents[0];
                form.value = {
                    poNumber: p.poNumber || '',
                    vendor: p.vendor || '',
                    orderId: p.orderId || '',
                    purchaseDate: p.purchaseDate ? p.purchaseDate.split('T')[0] : '',
                    status: p.status || 'Draft',
                    subtotal: p.subtotal || 0,
                    shippingTotal: p.shippingTotal || 0,
                    handlingTotal: p.handlingTotal || 0,
                    taxTotal: p.taxTotal || 0,
                    feeTotal: p.feeTotal || 0
                };
                
                await Promise.all([
                    loadLinkedItems(),
                    loadExpenses()
                ]);
            }
        } catch (e) {
            console.error('Failed to load purchase', e);
        } finally {
            loadingInit.value = false;
            hideLoader();
        }
    }
});

const loadLinkedItems = async () => {
    loadingItems.value = true;
    try {
        items.value = await getItemsByPurchaseId(props.purchaseId, form.value.orderId, form.value.poNumber);
        
        // Auto-fill subtotal from items if it's currently 0 or missing
        if (!form.value.subtotal) {
            form.value.subtotal = items.value.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
            // Optionally auto-save it back to the DB to fix it permanently
            await purchasesAPI.updatePurchase(props.purchaseId, { subtotal: form.value.subtotal });
        }
        
    } catch (e) {
        console.error(e);
    } finally {
        loadingItems.value = false;
    }
};

const savePurchase = async () => {
    saving.value = true;
    showLoader("Saving Purchase...");
    try {
        const payload = {
            ...form.value,
            grandTotal: computedGrandTotal.value
        };
        
        // Let backend handle missing PO Number via auto-gen
        if (!payload.poNumber) {
            delete payload.poNumber;
        }

        if (isEdit.value) {
            await purchasesAPI.updatePurchase(props.purchaseId, payload);
            editMode.value = false;
        } else {
            const res = await purchasesAPI.createPurchase(payload);
            // Redirect to edit page
            window.location.href = `/purchases/${res.$id}`;
        }
    } catch (e) {
        console.error('Failed to save purchase:', e);
        alert('Failed to save: ' + e.message);
    } finally {
        saving.value = false;
        hideLoader();
    }
};

const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this purchase? This action cannot be undone. Items and expenses will remain in the database but will no longer be linked to this PO.')) return;
    saving.value = true;
    try {
        await purchasesAPI.deletePurchase(props.purchaseId);
        window.location.href = '/purchases';
    } catch (e) {
        console.error('Failed to delete purchase', e);
        alert('Failed to delete: ' + e.message);
    } finally {
        saving.value = false;
    }
};

const handleItemSearch = () => {
    if (searchTimeout.value) clearTimeout(searchTimeout.value);
    
    if (!itemSearchQuery.value || itemSearchQuery.value.trim().length < 2) {
        searchResults.value = [];
        isSearching.value = false;
        showDropdown.value = false;
        return;
    }
    
    isSearching.value = true;
    showDropdown.value = true;
    searchTimeout.value = setTimeout(async () => {
        try {
            searchResults.value = await searchItems(itemSearchQuery.value.trim());
        } catch (e) {
            console.error('Search failed', e);
            searchResults.value = [];
        } finally {
            isSearching.value = false;
        }
    }, 400);
};

const linkItem = async (item) => {
    if (linkingItem.value) return;
    linkingItem.value = item.$id;
    try {
        await linkItemToPurchase(item.$id, props.purchaseId);
        itemSearchQuery.value = '';
        searchResults.value = [];
        await loadLinkedItems();
        
        // Force recalc subtotal when a new item is linked
        form.value.subtotal = items.value.reduce((sum, i) => sum + (Number(i.cost) || 0), 0);
        await purchasesAPI.updatePurchase(props.purchaseId, { subtotal: form.value.subtotal });
        
    } catch (e) {
        console.error(e);
        alert('Failed to link item: ' + e.message);
    } finally {
        linkingItem.value = null;
    }
};

const unlinkItem = async (item) => {
    if (linkingItem.value) return;
    if (!confirm(`Are you sure you want to unlink ${item.identity}?`)) return;
    
    linkingItem.value = item.$id;
    try {
        await linkItemToPurchase(item.$id, null);
        items.value = items.value.filter(i => i.$id !== item.$id);
        
        // Auto-update the subtotal when an item is unlinked
        form.value.subtotal = items.value.reduce((sum, i) => sum + (Number(i.cost) || 0), 0);
        // Persist the new subtotal immediately
        await purchasesAPI.updatePurchase(props.purchaseId, { subtotal: form.value.subtotal });
        
    } catch (e) {
        console.error('Failed to unlink item', e);
        alert('Failed to unlink item: ' + e.message);
    } finally {
        linkingItem.value = null;
    }
};

const quickCreateItem = async () => {
    if (!newItem.value.title) return;
    creatingItem.value = true;
    try {
        const generatedIdentity = 'PO-' + Date.now().toString().slice(-6) + '-' + Math.floor(Math.random() * 1000);
        const payload = {
            title: newItem.value.title,
            identity: generatedIdentity
        };
        const extraData = {
            cost: newItem.value.cost || 0,
            purchaseId: props.purchaseId,
            status: 'acquired' // Assuming it's acquired if it's on a PO
        };
        
        await saveItemToInventory(payload, null, extraData, currentTeam.value?.$id);
        
        // Reset form and reload
        newItem.value.title = '';
        newItem.value.cost = null;
        await loadLinkedItems();
    } catch (e) {
        console.error('Failed to quick create item', e);
        alert('Failed to create item: ' + e.message);
    } finally {
        creatingItem.value = false;
    }
};

const loadExpenses = async () => {
    loadingExpenses.value = true;
    try {
        const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
        const res = await databases.listDocuments(DB_ID, 'expenses', [
            Query.equal('purchaseId', props.purchaseId)
        ]);
        expenses.value = res.documents;
    } catch (e) {
        console.error("Failed to load expenses", e);
    } finally {
        loadingExpenses.value = false;
    }
};

const handleAddExpense = async () => {
    if (!newExpenseAmount.value) return;
    loadingExpenses.value = true;
    try {
        const expense = await databases.createDocument(
            import.meta.env.PUBLIC_APPWRITE_DB_ID,
            'expenses',
            ID.unique(),
            {
                purchaseId: props.purchaseId,
                cartId: props.purchaseId, // legacy support
                tenantId: form.value.tenantId || 'personal',
                amount: newExpenseAmount.value,
                note: newExpenseNote.value || 'Misc Expense',
                date: new Date().toISOString()
            }
        );
        expenses.value.push(expense);
        newExpenseAmount.value = '';
        newExpenseNote.value = '';
    } catch (e) {
        console.error('Failed to add expense', e);
        alert('Failed to add expense: ' + e.message);
    } finally {
        loadingExpenses.value = false;
    }
};

const handleRemoveExpense = async (expenseId) => {
    if (!confirm('Are you sure you want to remove this expense?')) return;
    try {
        await databases.deleteDocument(
            import.meta.env.PUBLIC_APPWRITE_DB_ID,
            'expenses',
            expenseId
        );
        expenses.value = expenses.value.filter(e => e.$id !== expenseId);
    } catch (e) {
        console.error('Failed to remove expense', e);
        alert('Failed to remove expense: ' + e.message);
    }
};

</script>

<template>
  <div class="h-[calc(100vh-4rem)] flex flex-col bg-base-100 overflow-hidden relative">
      
      <!-- ERROR TOAST -->
      <div v-if="error" class="toast toast-top toast-center z-100">
          <div class="alert alert-error shadow-lg">
              <span>{{ error }}</span>
              <button class="btn btn-xs btn-ghost" @click="error = null">✕</button>
          </div>
      </div>

      <div v-if="loading" class="flex justify-center flex-1 items-center">
          <span class="loading loading-spinner loading-lg"></span>
      </div>

      <div v-else-if="!activeCart" class="hero bg-base-200 flex-1">
          <div class="hero-content text-center">
              <div class="max-w-md">
                  <h1 class="text-5xl font-bold">🛒 Sourcing Tracker</h1>
                  <p class="py-6">No active sourcing session found. Start scouting to build your tracker!</p>
                  <a href="/scout" class="btn btn-primary">Start Scouting</a>
              </div>
          </div>
      </div>

      <div v-else class="flex flex-col h-full"> 
          <!-- MAIN SCROLLABLE CONTENT -->
          <div class="flex-1 overflow-y-auto relative pb-32" id="tracker-scroll">
              
              <!-- STICKY HEADER -->
              <div class="sticky top-0 z-30 bg-base-100/95 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.05)] px-4 py-3 border-b border-base-200 mb-4 -mx-0 flex justify-between items-center">
                  <div class="flex-1 min-w-0 pr-4">
                      <h2 class="text-xl font-bold truncate">Active Sourcing: {{ activeCart.vendor }}</h2>
                  </div>
                  <div class="flex-none text-right text-xs opacity-70 font-bold bg-base-200 p-2 rounded">
                      <div>Est. Value: <span class="text-success">${{ cartTotalResale.toFixed(0) }}</span></div>
                      <div>Spent: <span class="text-warning">${{ totalSpend.toFixed(2) }}</span></div>
                  </div>
              </div>

              <!-- ITEMS LIST -->
              <div class="px-4 grid gap-4 grid-cols-[repeat(auto-fill,minmax(280px,1fr))] pt-0">
                  <ItemCard 
                      v-for="item in cartItems" 
                      :key="item.$id" 
                      :item="item" 
                      :compact="true"
                      @click-card="openPreview(item)">

                      <template #absolute-top-left>
                           <!-- Actions Menu Override -->
                            <div class="dropdown dropdown-bottom z-20" @click.stop>
                                <label tabindex="0" class="btn btn-ghost btn-sm btn-circle bg-base-100/80 backdrop-blur shadow-sm cursor-pointer">⋮</label>
                                <ul tabindex="0" class="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-40 border border-base-200">
                                    <li><a @click="openEditModal(item)"><Icon icon="solar:pen-linear" class="w-4 h-4 inline" /> Edit</a></li>
                                    <li><a :href="`/scout?rescout=${item.$id}`"><Icon icon="solar:magnifer-linear" class="w-4 h-4 inline" /> Scout</a></li>
                                    <li><a @click="handleDeleteItem(item.$id)" class="text-error"><Icon icon="solar:trash-bin-trash-linear" class="w-4 h-4 inline" /> Delete</a></li>
                                </ul>
                            </div>
                      </template>
                      
                      <template #image-overlay>
                          <!-- Image overlay removed since ROI is now built into ItemCard -->
                      </template>
                  </ItemCard>
              </div>

               <!-- EDIT SIDE PANEL -->
              <ItemDrawer v-if="editingItem" :item="editingItem" @close="closeEdit" @save="saveEdit" />
              
              <!-- FULLSCREEN PREVIEW -->
              <ItemPreviewModal :item="previewItem || undefined" @close="previewItem = null" @edit="openEditModal" />

              <!-- EXPENSES SECTION -->
              <div class="divider text-xs opacity-50 uppercase">Expenses</div>
              <div class="collapse collapse-arrow bg-base-100 border border-base-200 rounded-box">
                  <input type="checkbox" /> 
                  <div class="collapse-title font-medium text-sm">
                      Misc Expenses ({{ cartExpenses.length }}) - ${{ expensesCost.toFixed(2) }}
                  </div>
                  <div class="collapse-content space-y-2"> 
                       <ul class="menu bg-base-200 w-full rounded-box">
                          <li v-for="exp in cartExpenses" :key="exp.$id">
                              <a class="flex justify-between">
                                  <span>{{ exp.note || 'Expense' }}</span>
                                  <span class="font-bold">${{ exp.amount }}</span>
                              </a>
                          </li>
                       </ul>
                       <div class="join w-full mt-2">
                          <input v-model="newExpenseNote" class="input input-bordered input-sm join-item w-full" placeholder="Note (e.g. Lunch)" />
                          <input v-model.number="newExpenseAmount" class="input input-bordered input-sm join-item w-20" type="number" placeholder="$" />
                          <button @click="handleAddExpense" class="btn btn-sm btn-neutral join-item" :disabled="!newExpenseAmount">Add</button>
                       </div>
                  </div>
              </div>

          </div>

          <!-- FOOTER ACTIONS -->
          <div class="absolute bottom-0 left-0 right-0 p-4 bg-base-100 border-t border-base-200 pt-6 z-40">
              <!-- Floating Total Count / Scroll to Top -->
              <div class="absolute -top-6 left-1/2 -translate-x-1/2 transition-transform hover:-translate-y-1 cursor-pointer" @click="scrollToTop">
                  <span class="badge badge-lg badge-primary border-none shadow-md px-6 py-4 font-bold text-sm flex gap-2 items-center rounded-full">
                      {{ cartItems.length }} Tracked <Icon icon="solar:round-alt-arrow-up-linear" class="w-4 h-4" />
                  </span>
              </div>

              <button @click="handleFinishCart" class="btn btn-primary w-full shadow-lg text-lg mt-2">
                  <Icon icon="solar:check-circle-linear" class="w-5 h-5 inline mr-1" /> Complete Trip (${{ totalSpend.toFixed(2) }})
              </button>
              <div class="text-center mt-2">
                  <button @click="startNew" class="btn btn-link btn-xs text-error no-underline">Abort / Start New</button>
              </div>
          </div>
      </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { storage, databases, ID } from '../../lib/appwrite';
import { useCart, type CartItem } from '../../composables/useCart';
import { useAuth } from '../../composables/useAuth';
import ItemDrawer from '../common/ItemDrawer.vue';
import { updateInventoryItem } from '../../lib/inventory';
import ItemCard from '../common/ItemCard.vue';
import ItemPreviewModal from '../inventory/ItemPreviewModal.vue';
import { addToast } from '../../stores/toast';
import { confirmDialog } from '../../stores/confirm';
import { Icon } from '@iconify/vue';

import { BUCKET_ID } from '../../lib/inventory';

const { user, currentTeam } = useAuth();
const currentTeamId = computed(() => currentTeam.value?.$id);

const scrollToTop = () => {
    const el = document.getElementById('tracker-scroll');
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
};

const { 
  activeCart, cartItems, cartExpenses, loading, 
  checkActiveCart, addExpense, finishCart, leaveCart,
  deleteItem, updateItem
} = useCart();

const newExpenseNote = ref('');
const newExpenseAmount = ref<number | ''>(''); 

// -- EDIT/PREVIEW STATE --
const editingItem = ref<CartItem | null>(null);
const previewItem = ref<CartItem | null>(null);

function openPreview(item: CartItem) {
    previewItem.value = item;
}

function openEditModal(item: CartItem) {
    editingItem.value = { ...item }; 
}

function closeEdit() {
    editingItem.value = null;
}

async function saveEdit(payload: any) {
    if (!editingItem.value) return;
    try {
        await updateInventoryItem(editingItem.value.$id, payload);
        
        // Optimistically update the cartItems array with new values
        const idx = cartItems.value.findIndex(i => i.$id === editingItem.value?.$id);
        if (idx !== -1) {
             Object.assign(cartItems.value[idx], payload);
        }
        
        closeEdit();
    } catch (e: any) {
        addToast({ type: 'error', message: "Failed to update item: " + e.message });
    }
}

// -- INIT --
const error = ref<string | null>(null);

const initCartCheck = async () => {
    if(user.value) {
        try {
            await checkActiveCart(user.value.$id);
        } catch (e: any) {
            error.value = e.message;
        }
    }
};

onMounted(async () => {
    await initCartCheck();
});

watch(user, async (newUser) => {
    if (newUser) {
        await initCartCheck();
    }
});

// -- COMPUTED --
const cartTotalResale = computed(() => {
    return cartItems.value.reduce((sum, item) => sum + (parseFloat(item.resalePrice as any) || 0), 0);
});

const itemsCost = computed(() => {
    return cartItems.value.reduce((sum, item) => sum + (parseFloat(item.cost as any) || 0), 0);
});

const expensesCost = computed(() => {
    return cartExpenses.value.reduce((sum, exp) => sum + (parseFloat(exp.amount as any) || 0), 0);
});

const totalSpend = computed(() => itemsCost.value + expensesCost.value);

// -- ACTIONS --
function getImageUrl(imageId: string) {
    if (!imageId || !BUCKET_ID) return '';
    return storage.getFilePreview(BUCKET_ID, imageId, 200, 200).toString();
}

async function handleDeleteItem(itemId: string) {
    if (await confirmDialog("Are you sure you want to remove this item?", "Remove Item", "Remove", "Cancel", "btn-error")) {
        try {
            await deleteItem(itemId);
            addToast({ type: 'success', message: 'Item deleted.' });
        } catch (e: any) {
            addToast({ type: 'error', message: "Failed to delete item: " + e.message });
        }
    }
}

async function handleAddExpense() {
    if (!newExpenseAmount.value) return;
    try {
        await addExpense(
            Number(newExpenseAmount.value), 
            newExpenseNote.value || 'Misc Expense'
        );
        newExpenseAmount.value = '';
        newExpenseNote.value = '';
        addToast({ type: 'success', message: 'Expense added.' });
    } catch (e: any) {
        addToast({ type: 'error', message: "Failed to add expense: " + e.message });
    }
}

async function handleFinishCart() {
    if (await confirmDialog("Are you sure you are done shopping?", "Complete Trip", "Complete", "Cancel")) {
        try {
            await finishCart();
            addToast({ type: 'success', message: 'Trip completed!' });
            window.location.href = '/dashboard';
        } catch (e: any) {
            addToast({ type: 'error', message: "Checkout failed: " + e.message });
        }
    }
}

async function startNew() {
     if(await confirmDialog("Start new tracker? Current one will be abandoned.", "Start New", "Start", "Cancel", "btn-warning")) {
         leaveCart();
         window.location.href = '/scout';
     }
}
</script>

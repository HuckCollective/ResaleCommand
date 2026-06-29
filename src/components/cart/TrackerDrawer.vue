<template>
  <div class="h-full flex flex-col bg-base-200 overflow-hidden relative shadow-inner">
      
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

      <div v-else-if="!activeCart" class="flex flex-col flex-1 items-center justify-center p-6 text-center opacity-70 relative">
          <button class="btn btn-ghost btn-sm btn-circle absolute top-4 right-4" @click="closeTracker">✕</button>
          <Icon icon="solar:object-scan-linear" class="w-16 h-16 mb-4 opacity-50" />
          <h2 class="text-xl font-bold">Empty Tracker</h2>
          <p class="text-sm mt-2">Start scouting items to build your sourcing run!</p>
          <a href="/scout" class="btn btn-primary btn-sm mt-4">Start Scouting</a>
      </div>

      <div v-else class="flex flex-col h-full"> 
          <!-- MAIN SCROLLABLE CONTENT -->
          <div class="flex-1 overflow-y-auto relative pb-32" id="tracker-scroll">
              
              <!-- STICKY HEADER -->
              <div class="sticky top-0 z-30 bg-base-200/95 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-4 border-b border-base-300 mb-4 -mx-0">
                  <button class="btn btn-ghost btn-sm btn-circle absolute top-4 right-4" @click="closeTracker">✕</button>
                  <div class="flex flex-col gap-1 pr-6">
                      <h2 class="text-sm font-bold opacity-70 truncate uppercase">Active Sourcing</h2>
                      <h3 class="text-lg font-black truncate">{{ activeCart.source }}</h3>
                  </div>
                  <div class="mt-2 text-xs opacity-70 flex justify-between font-bold bg-base-300/50 p-2 rounded">
                      <div>Est. Value: <span class="text-success">${{ cartTotalResale.toFixed(0) }}</span></div>
                      <div>Spent: <span class="text-warning">${{ totalSpend.toFixed(2) }}</span></div>
                  </div>
              </div>

              <!-- ITEMS LIST -->
              <div class="p-4 flex flex-col gap-4 pt-0">
                  <ItemCard 
                      v-for="item in trackedItems" 
                      :key="item.$id" 
                      :item="item" 
                      :compact="true"
                      @click-card="openPreview(item)">

                      <template #actions>
                          <!-- Docked Bottom Actions -->
                          <div class="join w-full mt-1 pt-1 border-t border-base-200/50" @click.stop>
                              <button @click="openEditModal(item)" class="btn btn-ghost btn-xs join-item flex-1 opacity-70 hover:opacity-100"><Icon icon="solar:pen-linear" class="w-4 h-4 inline" /> Edit</button>
                              <a :href="`/scout?rescout=${item.$id}`" class="btn btn-ghost btn-xs join-item flex-1 opacity-70 hover:opacity-100"><Icon icon="solar:magnifer-linear" class="w-4 h-4 inline" /> Scout</a>
                              <button @click="handleDeleteItem(item.$id)" class="btn btn-ghost btn-xs join-item flex-1 text-error opacity-80 hover:opacity-100 hover:bg-error/10"><Icon icon="solar:trash-bin-trash-linear" class="w-4 h-4 inline" /> Drop</button>
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
          <div class="p-4 bg-base-100 border-t border-base-300 relative z-40">
              <!-- Floating Total Count / Scroll to Top -->
              <div class="absolute -top-6 left-1/2 -translate-x-1/2 transition-transform hover:-translate-y-1 cursor-pointer" @click="scrollToTop">
                  <span class="badge badge-lg badge-primary border-none shadow-md px-6 py-4 font-bold text-sm flex gap-2 items-center rounded-full">
                      {{ trackedItems.length }} Tracked <Icon icon="solar:round-alt-arrow-up-linear" class="w-4 h-4" />
                  </span>
              </div>

              <button @click="handleFinishCart" class="btn btn-primary w-full shadow-sm mt-4">
                  <Icon icon="solar:check-circle-linear" class="w-5 h-5 inline mr-1" /> Finish Trip (${{ totalSpend.toFixed(2) }})
              </button>
              <div class="text-center mt-2">
                  <button @click="startNew" class="btn btn-link btn-xs text-error no-underline">Abort / Start New</button>
              </div>
          </div>
      </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue';
import { storage, databases, ID } from '../../lib/appwrite';
import { useCart, type CartItem } from '../../composables/useCart';
import { useAuth } from '../../composables/useAuth';
import ItemDrawer from '../common/ItemDrawer.vue';
import { updateInventoryItem } from '../../lib/inventory';
import ItemCard from '../common/ItemCard.vue';
import ItemPreviewModal from '../inventory/ItemPreviewModal.vue';
import { Icon } from '@iconify/vue';
import { addToast } from '../../stores/toast';
import { confirmDialog } from '../../stores/confirm';

const BUCKET_ID = import.meta.env.PUBLIC_APPWRITE_BUCKET_ID;

const { user } = useAuth();
const { 
  activeCart, cartItems, cartExpenses, loading, 
  checkActiveCart, addExpense, finishCart, abortCart, leaveCart,
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

const closeTracker = () => {
    document.getElementById('tracker-drawer').checked = false;
    
    // If desktop, remove static open class
    const drawer = document.getElementById('app-drawer');
    if (drawer) {
        drawer.classList.remove('lg:drawer-open');
        setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    }
};

const scrollToTop = () => {
    const el = document.getElementById('tracker-scroll');
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
};

const handleOpenPreviewEvent = (e: any) => {
    const item = e.detail;
    if (item) {
        const found = cartItems.value.find(i => i.$id === item.$id);
        if (found) {
            openPreview(found);
        }
    }
};

onMounted(async () => {
    await initCartCheck();
    window.addEventListener('open-tracker-item-preview', handleOpenPreviewEvent);
});

onUnmounted(() => {
    window.removeEventListener('open-tracker-item-preview', handleOpenPreviewEvent);
});

watch(user, async (newUser) => {
    if (newUser) {
        await initCartCheck();
    }
});

// -- COMPUTED --
const trackedItems = computed(() => cartItems.value.filter(item => item.status === 'tracked'));

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
    if (await confirmDialog("Are you sure you want to finish this trip?", "Finish Trip", "Finish", "Cancel", "btn-primary")) {
        try {
            await finishCart();
            addToast({ type: 'success', message: 'Trip Finished! Items marked as received.' });
            window.location.href = '/inventory';
        } catch (e: any) {
            addToast({ type: 'error', message: "Failed to finish trip: " + e.message });
        }
    }
}

async function startNew() {
    if (await confirmDialog("Are you sure you want to completely abort? All scouted items currently in this tracker will be permanently deleted.", "Abort Trip?", "Yes, Abort", "Cancel", "btn-error")) {
         try {
             await abortCart();
             addToast({ type: 'success', message: 'Trip aborted successfully.' });
             window.location.href = '/scout';
         } catch (e: any) {
             addToast({ type: 'error', message: "Error aborting trip: " + e.message });
         }
    }
}
</script>

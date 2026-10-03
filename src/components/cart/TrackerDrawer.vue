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
                      <h3 class="text-lg font-black truncate">{{ activeCart.vendor || activeCart.source || 'Draft Purchase' }}</h3>
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
                              <a v-if="getItemSourceUrl(item)" :href="getItemSourceUrl(item)" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-xs join-item flex-1 text-primary opacity-80 hover:opacity-100" title="Open live auction listing in new tab">
                                  <Icon icon="solar:link-linear" class="w-3.5 h-3.5 inline" /> Open
                              </a>
                              <button v-if="getItemSourceUrl(item)" @click="reEvaluateAuction(item)" :disabled="reEvaluatingIds[item.$id]" class="btn btn-ghost btn-xs join-item flex-1 text-secondary opacity-80 hover:opacity-100" title="Re-evaluate live auction and current bids">
                                  <span v-if="reEvaluatingIds[item.$id]" class="loading loading-spinner loading-xs inline"></span>
                                  <Icon v-else icon="solar:refresh-linear" class="w-3.5 h-3.5 inline" /> Re-Eval
                              </button>
                              <button @click="openEditModal(item)" class="btn btn-ghost btn-xs join-item flex-1 opacity-70 hover:opacity-100"><Icon icon="solar:pen-linear" class="w-3.5 h-3.5 inline" /> Edit</button>
                              <button @click="handleDeleteItem(item.$id)" class="btn btn-ghost btn-xs join-item flex-1 text-error opacity-80 hover:opacity-100 hover:bg-error/10"><Icon icon="solar:trash-bin-trash-linear" class="w-3.5 h-3.5 inline" /> Drop</button>
                          </div>
                      </template>
                      
                      <template #image-overlay>
                          <div v-if="getAuctionBadge(item)" class="absolute top-1 right-1 z-20 pointer-events-none">
                              <span class="badge badge-xs font-black shadow-xs gap-0.5" :class="getAuctionBadge(item).badgeClass">
                                  <Icon :icon="getAuctionBadge(item).icon" class="w-2.5 h-2.5" />
                                  {{ getAuctionBadge(item).label }}
                              </span>
                          </div>
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
                              <a class="flex justify-between items-center pr-2">
                                  <span>{{ exp.note || 'Expense' }}</span>
                                  <div class="flex items-center gap-3">
                                      <span class="font-bold">${{ exp.amount }}</span>
                                      <button @click.stop="handleRemoveExpense(exp.$id)" class="btn btn-ghost btn-xs text-error p-1 h-auto min-h-0"><Icon icon="solar:trash-bin-trash-linear" class="w-4 h-4" /></button>
                                  </div>
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
import { showLoader, hideLoader } from '../../stores/loader';
import { BUCKET_ID, getSafeRawAnalysis } from '../../lib/inventory';

const { user } = useAuth();
const { 
  activeCart, cartItems, cartExpenses, loading, 
  checkActiveCart, addExpense, deleteExpense, finishCart, abortCart, leaveCart,
  deleteItem, updateItem
} = useCart();

const newExpenseNote = ref('');
const newExpenseAmount = ref<number | ''>(''); 

// -- LIVE AUCTION RE-EVALUATION --
const reEvaluatingIds = ref<Record<string, boolean>>({});

function getAuctionBadge(item: any) {
    if (!item) return null;
    let currentBid = item.currentBid;
    let maxBid = item.maxBid;

    if (!currentBid || !maxBid) {
        if (item.rawAnalysis) {
            try {
                const parsed = JSON.parse(item.rawAnalysis);
                const first = Array.isArray(parsed) ? parsed[0] : (parsed.items ? parsed.items[0] : parsed);
                if (first) {
                    if (!currentBid) currentBid = first.currentBid || first.auction_meta?.current_bid || parseFloat(String(first.purchase_strategy?.current_asking_price || 0).replace(/[$,]/g, ''));
                    if (!maxBid) maxBid = first.maxBid || first.purchase_strategy?.max_bid;
                }
            } catch {}
        }
    }

    if (!currentBid && item.cost) {
        currentBid = parseFloat(String(item.cost));
    }

    if (currentBid && maxBid) {
        const c = Number(currentBid);
        const m = Number(maxBid);
        if (c > m) {
            return {
                label: `STOP ($${c.toFixed(0)})`,
                badgeClass: 'badge-error text-error-content animate-pulse',
                icon: 'solar:stop-circle-bold'
            };
        } else {
            return {
                label: `+$${(m - c).toFixed(0)} Left`,
                badgeClass: 'badge-success text-success-content',
                icon: 'solar:check-circle-bold'
            };
        }
    }
    return null;
}

function getItemSourceUrl(item: any): string | null {
    if (item.sourcingLocation && item.sourcingLocation.startsWith('http')) return item.sourcingLocation;
    if (item.url && item.url.startsWith('http')) return item.url;
    if (item.conditionNotes) {
        const match = item.conditionNotes.match(/https?:\/\/[^\s\n\]]+/);
        if (match) return match[0];
    }
    if (item.rawAnalysis) {
        try {
            const raw = typeof item.rawAnalysis === 'string' ? JSON.parse(item.rawAnalysis) : item.rawAnalysis;
            const target = Array.isArray(raw) ? raw[0] : raw;
            if (target?.sourcingLocation && target.sourcingLocation.startsWith('http')) return target.sourcingLocation;
            if (target?.source_url && target.source_url.startsWith('http')) return target.source_url;
            if (target?.url && target.url.startsWith('http')) return target.url;
        } catch(e) {}
    }
    return null;
}

async function reEvaluateAuction(item: any) {
    const targetUrl = getItemSourceUrl(item);
    if (!targetUrl || !targetUrl.startsWith('http')) {
        addToast({ type: 'warning', message: 'No valid URL to re-evaluate this auction.' });
        return;
    }
    reEvaluatingIds.value[item.$id] = true;
    showLoader("Re-evaluating Live Auction...", {
        step: "Fetching latest bids, shipping & stop-bidding rules...",
        progress: 45
    });

    try {
        const res = await fetch('/api/identify-item', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                notes: targetUrl + '\n\n' + (item.conditionNotes || '')
            })
        });

        if (!res.ok) throw new Error('Failed to fetch live auction data');
        const data = await res.json();
        const candidate = (data.items && data.items.length > 0) ? data.items[0] : data;

        const liveBid = candidate.currentBid || candidate.auction_meta?.current_bid || parseFloat(String(candidate.purchase_strategy?.current_asking_price || 0).replace(/[$,]/g, ''));
        const maxBid = candidate.maxBid || candidate.purchase_strategy?.max_bid;
        
        const updatePayload: any = {
            rawAnalysis: getSafeRawAnalysis(candidate)
        };
        if (!item.sourcingLocation && targetUrl) {
            updatePayload.sourcingLocation = targetUrl;
        }
        if (liveBid > 0) {
            updatePayload.cost = liveBid;
        }
        if (candidate.auctionEndsAt || candidate.auction_meta?.end_time) {
            updatePayload.auctionEndsAt = candidate.auctionEndsAt || candidate.auction_meta?.end_time;
        }
        if (maxBid && Number(maxBid) > 0) {
            updatePayload.maxBid = Number(maxBid);
        }
        if (candidate.canCombineShipping !== undefined) {
            updatePayload.canCombineShipping = candidate.canCombineShipping;
        }

        await updateItem(item.$id, updatePayload);

        if (liveBid > 0 && maxBid && Number(maxBid) > 0) {
            if (liveBid > Number(maxBid)) {
                addToast({ 
                    type: 'error', 
                    message: `🚨 STOP BIDDING on "${item.title || item.identity}"! Outbid at $${liveBid.toFixed(2)} (Max Bid: $${Number(maxBid).toFixed(2)}).` 
                });
            } else {
                addToast({ 
                    type: 'success', 
                    message: `🎯 Live bid updated: $${liveBid.toFixed(2)} (Headroom: +$${(Number(maxBid) - liveBid).toFixed(2)})` 
                });
            }
        } else {
            addToast({ type: 'success', message: `Auction data updated for "${item.title || item.identity}"!` });
        }
    } catch (err: any) {
        addToast({ type: 'error', message: err.message || 'Re-evaluation failed.' });
    } finally {
        delete reEvaluatingIds.value[item.$id];
        hideLoader();
    }
}

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
    const trackerDrawer = document.getElementById('tracker-drawer') as HTMLInputElement | null;
    if (trackerDrawer) {
        trackerDrawer.checked = false;
    }
    
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
const trackedItems = computed(() => cartItems.value.filter(item => item.status === 'tracked' || item.status === 'draft' || !item.status));

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

async function handleRemoveExpense(expenseId: string) {
    if (await confirmDialog("Remove this expense?", "Remove", "Remove", "Cancel", "btn-error")) {
        try {
            await deleteExpense(expenseId);
            addToast({ type: 'success', message: 'Expense removed.' });
        } catch (e: any) {
            addToast({ type: 'error', message: "Failed to remove expense: " + e.message });
        }
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

<template>
  <div class="h-[calc(100dvh-4rem)] flex flex-col bg-base-100 overflow-hidden relative">
      
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

              <!-- EXPIRED AUCTIONS RESOLUTION BANNER -->
              <div v-if="expiredAuctionItems.length > 0" class="mx-4 mb-4 p-4 rounded-2xl bg-warning/15 border-2 border-warning/40 shadow-sm flex flex-col gap-3">
                  <div class="flex items-center justify-between gap-2 flex-wrap">
                      <div class="flex items-center gap-2">
                          <Icon icon="solar:clock-circle-bold" class="w-6 h-6 text-warning animate-pulse" />
                          <div>
                              <h3 class="font-black text-sm uppercase tracking-wide text-warning-content">
                                  {{ expiredAuctionItems.length }} Tracked Auction{{ expiredAuctionItems.length === 1 ? '' : 's' }} Ended
                              </h3>
                              <p class="text-xs opacity-85">Did you win or lose? Resolve below to graduate won items to Acquired inventory or clear lost tracks.</p>
                          </div>
                      </div>
                  </div>
                  <div class="grid gap-2">
                      <div v-for="item in expiredAuctionItems" :key="item.$id" class="flex items-center justify-between gap-3 p-2.5 bg-base-100 rounded-xl border border-base-300 text-xs shadow-2xs">
                          <div class="min-w-0 flex-1">
                              <div class="font-bold truncate text-base-content">{{ item.title || item.identity }}</div>
                              <div class="text-[11px] opacity-70 font-mono">
                                  <span>Last Bid: ${{ Number(item.currentBid || item.cost || 0).toFixed(2) }}</span>
                                  <span v-if="item.maxBid" class="ml-2">• Max Bid: ${{ Number(item.maxBid).toFixed(2) }}</span>
                              </div>
                          </div>
                          <div class="flex items-center gap-2 shrink-0">
                              <button @click="handleItemWon(item)" class="btn btn-xs btn-success gap-1 font-bold shadow-xs">
                                  <Icon icon="solar:cup-star-bold" class="w-3.5 h-3.5" /> Won
                              </button>
                              <button @click="handleItemLost(item)" class="btn btn-xs btn-ghost text-error/80 hover:bg-error/10 hover:text-error font-bold">
                                  Lost
                              </button>
                          </div>
                      </div>
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

                      <template #actions>
                          <!-- Docked Bottom Actions -->
                          <div class="join join-horizontal w-full">
                              <a v-if="getItemSourceUrl(item)" :href="getItemSourceUrl(item)" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-xs join-item flex-1 text-primary opacity-80 hover:opacity-100" title="Open live auction listing in new tab">
                                  <Icon icon="solar:link-linear" class="w-3.5 h-3.5 inline mr-0.5" /> Open
                              </a>
                              <button v-if="getItemSourceUrl(item)" @click="reEvaluateAuction(item)" :disabled="reEvaluatingIds[item.$id]" class="btn btn-ghost btn-xs join-item flex-1 text-secondary opacity-80 hover:opacity-100" title="Re-evaluate live auction and current bids">
                                  <span v-if="reEvaluatingIds[item.$id]" class="loading loading-spinner loading-xs inline"></span>
                                  <Icon v-else icon="solar:refresh-linear" class="w-3.5 h-3.5 inline mr-0.5" /> Re-Eval
                              </button>
                              <button @click="openEditModal(item)" class="btn btn-ghost btn-xs join-item flex-1 opacity-70 hover:opacity-100">
                                  <Icon icon="solar:pen-linear" class="w-3.5 h-3.5 inline mr-0.5" /> Edit
                              </button>
                              <a :href="`/scout?rescout=${item.$id}`" class="btn btn-ghost btn-xs join-item flex-1 opacity-70 hover:opacity-100">
                                  <Icon icon="solar:magnifer-linear" class="w-3.5 h-3.5 inline mr-0.5" /> Scout
                              </a>
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
import { updateInventoryItem, getSafeRawAnalysis, BUCKET_ID } from '../../lib/inventory';
import ItemCard from '../common/ItemCard.vue';
import ItemPreviewModal from '../inventory/ItemPreviewModal.vue';
import { addToast } from '../../stores/toast';
import { confirmDialog } from '../../stores/confirm';
import { useLoader } from '../../composables/useLoader';
import { Icon } from '@iconify/vue';

const { user, currentTeam } = useAuth();
const currentTeamId = computed(() => currentTeam.value?.$id);
const { showLoader, hideLoader } = useLoader();
const reEvaluatingIds = ref<Record<string, boolean>>({});

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

        // Optimistically update the cartItems array with new values
        const idx = cartItems.value.findIndex(i => i.$id === item.$id);
        if (idx !== -1) {
            Object.assign(cartItems.value[idx], updatePayload);
        }

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
        addToast({ type: 'error', message: 'Re-evaluation failed: ' + (err.message || 'Network error') });
    } finally {
        reEvaluatingIds.value[item.$id] = false;
        hideLoader();
    }
}

const scrollToTop = () => {
    const el = document.getElementById('tracker-scroll');
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
};

const { 
  activeCart, cartItems, cartExpenses, loading, 
  expiredAuctionItems, checkActiveCart, addExpense, finishCart, leaveCart,
  deleteItem, updateItem, recordAuctionWin, recordAuctionLoss
} = useCart();

async function handleItemWon(item: any) {
    const defaultBid = item.currentBid || item.cost || item.maxBid || 0;
    const input = prompt(`Enter winning bid for "${item.title || item.identity}":`, String(Number(defaultBid).toFixed(2)));
    if (input === null) return;
    const finalBid = parseFloat(input);
    if (isNaN(finalBid) || finalBid <= 0) {
        addToast({ type: 'warning', message: 'Invalid winning bid amount.' });
        return;
    }
    try {
        await recordAuctionWin(item.$id, finalBid);
        addToast({ type: 'success', message: `🏆 Won! "${item.title || item.identity}" graduated to Acquired inventory ($${finalBid.toFixed(2)}).` });
    } catch (e: any) {
        addToast({ type: 'error', message: 'Failed to record win: ' + e.message });
    }
}

async function handleItemLost(item: any) {
    if (await confirmDialog(`Remove "${item.title || item.identity}" from tracker? (Auction lost)`, "Confirm Auction Loss", "Remove Track", "Cancel", "btn-error")) {
        try {
            await recordAuctionLoss(item.$id, true);
            addToast({ type: 'info', message: `"${item.title || item.identity}" removed from tracker.` });
        } catch (e: any) {
            addToast({ type: 'error', message: 'Failed to record loss: ' + e.message });
        }
    }
}

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

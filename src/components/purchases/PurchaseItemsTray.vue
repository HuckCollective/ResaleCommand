<template>
  <Teleport v-if="mounted" to="body">
    <Transition name="rc-tray">
      <div
        v-if="modelValue && purchase"
        class="fixed inset-0 z-400 bg-black/60 backdrop-blur-xs flex flex-col justify-end"
        role="dialog"
        aria-modal="true"
        :aria-label="trayTitle"
        @click.self="closeTray"
      >
        <!-- BOTTOM-SHEET DETENT LIST TRAY PANEL -->
        <div
          ref="trayPanelRef"
          tabindex="-1"
          class="rc-tray-panel bg-base-100 border-t border-base-300 rounded-t-3xl max-w-5xl mx-auto w-full max-h-[82dvh] flex flex-col shadow-2xl overflow-hidden outline-none"
        >
          <!-- Drag Handle Pill Affordance -->
          <div
            class="w-12 h-1.5 bg-base-content/20 rounded-full mx-auto mt-2.5 mb-0.5 shrink-0 cursor-pointer"
            @click="closeTray"
            title="Close Tray"
          ></div>

          <!-- 1. TRAY HEADER -->
          <div class="px-4 py-2.5 sm:px-6 sm:py-3.5 border-b border-base-300 flex items-center justify-between gap-3 shrink-0">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <Icon icon="solar:box-minimalistic-bold-duotone" class="w-5 h-5 text-primary shrink-0" />
                <h3 class="text-base sm:text-lg font-black text-base-content tracking-tight truncate">
                  {{ purchase.poNumber || 'PO-Pending' }}
                </h3>
                <span class="opacity-40 font-bold">•</span>
                <span class="font-bold text-sm sm:text-base text-base-content/90 truncate">
                  {{ purchase.vendor || 'Unknown Vendor' }}
                </span>
                <span class="badge badge-sm font-bold uppercase tracking-wider text-[10px]" :class="getPoStatusClass(localPoStatus)">
                  {{ localPoStatus || 'Pending' }}
                </span>
                <a
                  v-if="purchase.orderId && (purchase.vendor?.toLowerCase().includes('goodwill') || String(purchase.orderId).match(/^\d+$/))"
                  :href="getSgwUrl(purchase.orderId)"
                  target="_blank"
                  class="badge badge-sm badge-outline badge-primary font-mono font-bold gap-1 hover:bg-primary hover:text-primary-content transition-colors"
                  title="Open External Order in ShopGoodwill"
                >
                  <span>#{{ purchase.orderId }}</span>
                  <Icon icon="solar:link-external-linear" class="w-3 h-3" />
                </a>
              </div>
              <p class="text-xs text-base-content/65 mt-0.5 truncate">
                {{ traySubtitle }}
              </p>
            </div>

            <div class="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                @click="closeTray"
                class="btn btn-ghost btn-sm btn-circle shrink-0"
                title="Close Tray (Esc)"
              >
                <Icon icon="solar:close-circle-bold" class="w-6 h-6 opacity-60 hover:opacity-100" />
              </button>
            </div>
          </div>

          <!-- 2. 4-CARD PO FINANCIAL & RECEIVING SUMMARY BANNER (Matches LocationManifestTray / ScoutPurchaseTray) -->
          <div class="bg-base-200/70 px-4 py-2.5 sm:px-6 sm:py-3 border-b border-base-300 shrink-0">
            <div class="grid grid-cols-4 gap-2 text-center">
              <div class="bg-base-100 p-2 rounded-xl border border-base-300/80">
                <div class="text-[9px] uppercase font-bold opacity-60 truncate">PO Grand Total</div>
                <div class="font-mono font-black text-xs sm:text-base text-base-content truncate">
                  ${{ Number(purchase.grandTotal || itemsTotalCost || 0).toFixed(2) }}
                </div>
              </div>
              <div class="bg-base-100 p-2 rounded-xl border border-base-300/80">
                <div class="text-[9px] uppercase font-bold opacity-60 truncate">Items Landed Cost</div>
                <div class="font-mono font-black text-xs sm:text-base text-warning truncate">
                  ${{ itemsTotalCost.toFixed(2) }}
                </div>
              </div>
              <div class="bg-base-100 p-2 rounded-xl border border-base-300/80">
                <div class="text-[9px] uppercase font-bold opacity-60 truncate">Target Retail</div>
                <div class="font-mono font-black text-xs sm:text-base text-success truncate">
                  ${{ itemsTotalRetail.toFixed(2) }}
                </div>
              </div>
              <div class="bg-base-100 p-2 rounded-xl border border-base-300/80">
                <div class="text-[9px] uppercase font-bold opacity-60 truncate">Received into Stock</div>
                <div
                  class="font-mono font-black text-xs sm:text-base truncate"
                  :class="unreceivedItemsCount === 0 && items.length > 0 ? 'text-success' : 'text-primary'"
                >
                  {{ items.length - unreceivedItemsCount }} / {{ items.length }}
                </div>
              </div>
            </div>
          </div>

          <!-- 3. COLLAPSIBLE LINK EXISTING / QUICK CREATE BAR -->
          <div v-if="showAddBar" class="grid grid-cols-1 md:grid-cols-2 gap-3 px-4 py-3 sm:px-6 bg-base-200/50 border-b border-base-300 shrink-0">
            <!-- Link Existing Item -->
            <div class="bg-base-100 p-3 rounded-xl border border-base-200 relative">
              <h4 class="font-bold mb-1.5 text-xs uppercase opacity-70">Link Existing Inventory Item</h4>
              <div class="relative w-full">
                <div class="flex items-center">
                  <input
                    type="text"
                    v-model="itemSearchQuery"
                    @input="handleItemSearch"
                    @focus="showDropdown = true"
                    @blur="hideSearchDropdownDelayed"
                    placeholder="Search title, UPC, or ID..."
                    class="input input-sm input-bordered w-full pr-8 text-xs"
                  />
                  <span v-if="isSearching" class="absolute right-2.5 loading loading-spinner loading-xs text-primary"></span>
                </div>

                <ul
                  v-if="showDropdown && searchResults.length > 0"
                  class="menu bg-base-100 w-full rounded-xl shadow-2xl border border-base-300 absolute left-0 right-0 z-50 mt-1 max-h-52 overflow-y-auto p-1"
                >
                  <li v-for="res in searchResults" :key="res.$id">
                    <a @click="linkExistingItem(res)" class="flex justify-between items-center gap-2 py-1.5 px-2 text-xs hover:bg-base-200">
                      <span class="truncate max-w-[75%] flex flex-col">
                        <span class="font-bold truncate">{{ res.title }}</span>
                        <span class="font-mono text-[10px] opacity-60">{{ res.upc || res.identity || res.$id }}</span>
                      </span>
                      <span class="btn btn-xs btn-primary font-bold">Link</span>
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <!-- Quick Create New Item -->
            <div class="bg-base-100 p-3 rounded-xl border border-base-200">
              <h4 class="font-bold mb-1.5 text-xs uppercase opacity-70">Quick Create New Line Item</h4>
              <div class="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  v-model="newItemTitle"
                  placeholder="Item Title..."
                  class="input input-sm input-bordered grow text-xs"
                />
                <div class="flex gap-1.5 shrink-0">
                  <label class="input input-sm input-bordered flex items-center gap-1 w-24 text-xs">
                    <span class="opacity-60">$</span>
                    <input type="number" step="0.01" v-model.number="newItemCost" class="w-full font-mono text-xs" placeholder="Cost" />
                  </label>
                  <button
                    type="button"
                    @click="quickCreateItem"
                    class="btn btn-sm btn-primary font-bold text-xs shrink-0"
                    :disabled="creatingItem || !newItemTitle.trim()"
                  >
                    <span v-if="creatingItem" class="loading loading-spinner loading-xs"></span>
                    <span>Add</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 4. SCROLLABLE ITEMS LIST BODY -->
          <div class="flex-1 min-h-0 overflow-y-auto px-4 py-3 sm:px-6 sm:py-4">
            <div v-if="loadingItems" class="py-12 flex flex-col items-center justify-center gap-2">
              <span class="loading loading-spinner loading-md text-primary"></span>
              <span class="text-xs font-bold opacity-60">Loading PO Items...</span>
            </div>

            <div
              v-else-if="items.length === 0"
              class="py-10 text-center opacity-70 border-2 border-dashed border-base-300 rounded-2xl space-y-2"
            >
              <Icon icon="solar:box-minimalistic-linear" class="w-10 h-10 mx-auto opacity-40" />
              <p class="text-sm font-bold">No items linked to {{ purchase.poNumber || 'this PO' }} yet.</p>
              <p class="text-xs opacity-70">Click "Link / Add Item" below or open the full PO to scan a receipt.</p>
            </div>

            <div v-else class="space-y-3">
              <!-- A. Mobile Cards (< md) -->
              <div class="space-y-2.5 block md:hidden">
                <div
                  v-for="item in items"
                  :key="'tray-mob-' + item.$id"
                  class="p-3 rounded-2xl bg-base-100 border border-base-300 shadow-xs space-y-2.5"
                >
                  <div class="flex items-start gap-3">
                    <div
                      class="w-14 h-14 rounded-xl overflow-hidden bg-base-200/80 border border-base-300 flex items-center justify-center shrink-0 cursor-pointer"
                      @click="openEditItem(item)"
                    >
                      <img
                        v-if="getItemImage(item) && !failedImages[item.$id]"
                        :src="getItemImage(item)"
                        class="w-full h-full object-cover"
                        alt="Item"
                        @error="handleImageError(item)"
                      />
                      <Icon v-else icon="solar:camera-broken" class="w-5 h-5 text-base-content/40" />
                    </div>

                    <div class="flex-1 min-w-0 space-y-1">
                      <h4
                        class="font-bold text-sm text-base-content leading-snug line-clamp-2 cursor-pointer hover:text-primary"
                        @click="openEditItem(item)"
                      >
                        {{ item.title }}
                      </h4>
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span v-if="item.upc" class="badge badge-xs badge-neutral font-mono">{{ item.upc }}</span>
                        <span v-else-if="item.identity" class="font-mono text-[11px] opacity-60">{{ item.identity }}</span>
                        <span v-if="item.storageLocation" class="badge badge-xs badge-outline font-mono">{{ item.storageLocation }}</span>
                        <span class="badge badge-xs" :class="getItemStatusBadgeClass(item.status)">
                          {{ item.status || 'acquired' }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center justify-between px-2.5 py-2 rounded-xl bg-base-200/60 text-xs">
                    <div>
                      <span class="opacity-60 block text-[10px] uppercase font-bold">Cost (Landed)</span>
                      <span class="font-mono font-bold text-sm">${{ (Number(item.cost) || 0).toFixed(2) }}</span>
                    </div>
                    <div class="text-right">
                      <span class="opacity-60 block text-[10px] uppercase font-bold">Resale Price</span>
                      <span class="font-mono font-extrabold text-success text-sm">
                        {{ formatResalePrice(item) }}
                      </span>
                    </div>
                  </div>

                  <div class="flex items-center gap-2 pt-1 border-t border-base-200">
                    <button
                      v-if="!isReceivedStatus(item.status)"
                      type="button"
                      class="btn btn-xs btn-success text-success-content font-black gap-1 flex-1 h-8 rounded-xl shadow-xs border border-success-content/25 active:scale-95"
                      :disabled="receivingItemId === item.$id"
                      @click="receiveItem(item)"
                    >
                      <span v-if="receivingItemId === item.$id" class="loading loading-spinner loading-xs"></span>
                      <Icon v-else icon="solar:check-circle-bold" class="w-3.5 h-3.5" />
                      <span>Receive</span>
                    </button>

                    <button
                      type="button"
                      class="btn btn-xs btn-primary text-primary-content font-black gap-1 flex-1 h-8 rounded-xl shadow-xs border border-primary-content/25 active:scale-95"
                      @click="openEditItem(item)"
                    >
                      <Icon icon="solar:pen-bold" class="w-3.5 h-3.5" />
                      <span>Update</span>
                    </button>

                    <button
                      type="button"
                      class="btn btn-xs btn-ghost text-error hover:bg-error/15 font-bold rounded-xl px-2.5 h-8 active:scale-95"
                      :disabled="unlinkingItemId === item.$id"
                      @click="unlinkItem(item)"
                    >
                      <Icon icon="solar:trash-bin-trash-bold" class="w-3.5 h-3.5" />
                      <span>Unlink</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- B. Desktop Table (md+) matching Screenshot 3 -->
              <div class="hidden md:block overflow-x-auto border border-base-200 rounded-2xl bg-base-100 shadow-xs">
                <table class="table table-sm table-zebra w-full">
                  <thead class="bg-base-200/80 text-xs font-bold text-base-content/80">
                    <tr>
                      <th class="w-14">Photo</th>
                      <th>Item Details</th>
                      <th class="whitespace-nowrap">Cost (Landed)</th>
                      <th class="whitespace-nowrap">Resale Price</th>
                      <th>Status</th>
                      <th class="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in items" :key="'tray-desk-' + item.$id" class="hover:bg-base-200/50 transition-colors">
                      <td>
                        <div
                          class="w-11 h-11 rounded-xl overflow-hidden bg-base-200/80 border border-base-300 flex items-center justify-center shrink-0 cursor-pointer group"
                          @click="openEditItem(item)"
                          title="Click to open Edit Item Drawer"
                        >
                          <img
                            v-if="getItemImage(item) && !failedImages[item.$id]"
                            :src="getItemImage(item)"
                            class="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            alt="Item Thumbnail"
                            @error="handleImageError(item)"
                          />
                          <Icon v-else icon="solar:camera-broken" class="w-5 h-5 text-base-content/40" />
                        </div>
                      </td>
                      <td>
                        <div class="flex flex-col gap-0.5">
                          <span
                            class="font-bold text-sm text-base-content cursor-pointer hover:text-primary transition-colors line-clamp-1"
                            @click="openEditItem(item)"
                          >
                            {{ item.title }}
                          </span>
                          <div class="flex items-center gap-1.5 flex-wrap">
                            <span v-if="item.upc" class="badge badge-xs badge-neutral font-mono">{{ item.upc }}</span>
                            <span v-else-if="item.identity" class="font-mono text-xs opacity-60">{{ item.identity }}</span>
                            <span v-if="item.storageLocation" class="badge badge-xs badge-outline font-mono">{{ item.storageLocation }}</span>
                            <span v-if="Number(item.quantity) > 1" class="badge badge-xs badge-secondary font-bold">Lot ({{ item.quantity }})</span>
                          </div>
                        </div>
                      </td>
                      <td class="font-mono font-semibold text-xs whitespace-nowrap">
                        ${{ (Number(item.cost) || 0).toFixed(2) }}
                      </td>
                      <td class="font-mono font-bold text-xs text-success whitespace-nowrap">
                        {{ formatResalePrice(item) }}
                      </td>
                      <td>
                        <div class="badge badge-sm whitespace-nowrap" :class="getItemStatusBadgeClass(item.status)">
                          {{ item.status || 'acquired' }}
                        </div>
                      </td>
                      <td class="text-right whitespace-nowrap">
                        <div class="flex items-center justify-end gap-1.5">
                          <button
                            v-if="!isReceivedStatus(item.status)"
                            type="button"
                            class="btn btn-xs btn-outline bg-base-100 hover:bg-success hover:text-success-content hover:border-success font-black gap-1 rounded-lg px-2.5 h-7 active:scale-95"
                            :disabled="receivingItemId === item.$id"
                            @click="receiveItem(item)"
                            :title="`Receive into ${defaultBackstock}`"
                          >
                            <span v-if="receivingItemId === item.$id" class="loading loading-spinner loading-xs"></span>
                            <Icon v-else icon="solar:check-circle-bold" class="w-3.5 h-3.5" />
                            <span>Receive</span>
                          </button>

                          <button
                            type="button"
                            class="btn btn-xs btn-primary text-primary-content font-black shadow-xs border border-primary-content/25 gap-1 rounded-lg px-2.5 h-7 active:scale-95"
                            @click="openEditItem(item)"
                            title="Open Right-Side Edit Item Drawer"
                          >
                            <Icon icon="solar:pen-bold" class="w-3.5 h-3.5" />
                            <span>Update</span>
                          </button>

                          <button
                            type="button"
                            class="btn btn-xs btn-ghost text-base-content/80 hover:text-error hover:bg-error/15 font-bold rounded-lg px-2 h-7 active:scale-95"
                            :disabled="unlinkingItemId === item.$id"
                            @click="unlinkItem(item)"
                            title="Unlink item from this Purchase Order"
                          >
                            <span v-if="unlinkingItemId === item.$id" class="loading loading-spinner loading-xs"></span>
                            <span v-else class="flex items-center gap-1">
                              <Icon icon="solar:trash-bin-trash-bold" class="w-3.5 h-3.5" />
                              <span>Unlink</span>
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- 5. STICKY BOTTOM TRAY FOOTER ACTION BAR -->
          <div class="border-t border-base-300 bg-base-200/90 px-4 py-3 sm:px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-2 flex-wrap shrink-0">
            <div class="flex items-center gap-2 flex-wrap">
              <a
                :href="`/purchases/${purchase.poNumber || purchase.$id}`"
                class="btn btn-xs sm:btn-sm btn-outline btn-primary font-bold gap-1.5 rounded-xl"
                title="Open Full Purchase Order Page"
              >
                <Icon icon="solar:document-text-bold" class="w-4 h-4" />
                <span>Open Full PO</span>
              </a>

              <a
                :href="`/inventory?purchaseId=${encodeURIComponent(purchase.$id)}&orderId=${encodeURIComponent(purchase.orderId || '')}`"
                class="btn btn-xs sm:btn-sm btn-outline btn-secondary font-bold gap-1.5 rounded-xl"
                title="Filter these items in Inventory View"
              >
                <Icon icon="solar:box-minimalistic-linear" class="w-4 h-4" />
                <span>Open in Inventory</span>
              </a>

              <button
                type="button"
                class="btn btn-xs sm:btn-sm btn-ghost bg-base-100 border border-base-300 font-bold gap-1 rounded-xl"
                @click="showAddBar = !showAddBar"
              >
                <Icon :icon="showAddBar ? 'solar:minus-circle-linear' : 'solar:add-circle-bold'" class="w-4 h-4 text-primary" />
                <span>{{ showAddBar ? 'Hide Add/Link' : 'Link / Add Item' }}</span>
              </button>
            </div>

            <div class="flex items-center gap-2 ml-auto">
              <button
                v-if="unreceivedItemsCount > 0"
                type="button"
                class="btn btn-xs sm:btn-sm btn-success text-success-content font-black gap-1.5 rounded-xl shadow-sm border border-success-content/25 active:scale-95"
                :disabled="receivingAll"
                @click="receiveAllItems"
                :title="`Receive all ${unreceivedItemsCount} unreceived item(s) into ${defaultBackstock}`"
              >
                <span v-if="receivingAll" class="loading loading-spinner loading-xs"></span>
                <Icon v-else icon="solar:check-circle-bold" class="w-4 h-4" />
                <span>Receive All ({{ unreceivedItemsCount }})</span>
              </button>

              <button
                type="button"
                class="btn btn-xs sm:btn-sm btn-ghost font-bold rounded-xl"
                @click="closeTray"
              >
                Close Tray
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Right-Side Edit Item Drawer (Stacked cleanly at z-450 over the z-400 Bottom-Sheet List Tray) -->
  <ItemDrawer
    v-if="activeEditItem"
    :item="activeEditItem"
    :isOpen="!!activeEditItem"
    @close="activeEditItem = null"
    @save="handleSavedItem"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import ItemDrawer from '../common/ItemDrawer.vue';
import { databases } from '../../lib/appwrite';
import {
  getItemsByPurchaseId,
  searchItems,
  linkItemToPurchase,
  updateInventoryItem,
  saveItemToInventory,
  getCollectionId,
  BUCKET_ID,
} from '../../lib/inventory';
import { purchasesAPI } from '../../lib/purchases';
import { useAuth } from '../../composables/useAuth';
import { useLoader } from '../../composables/useLoader';
import { getDefaultStorageLocation } from '../../lib/warehouses';
import { addToast } from '../../stores/toast';
import { confirmDialog } from '../../stores/confirm';

const props = defineProps<{
  modelValue: boolean;
  purchase: any | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'close'): void;
  (e: 'updated'): void;
}>();

const mounted = ref(false);
const trayPanelRef = ref<HTMLElement | null>(null);

onMounted(() => {
  mounted.value = true;
});

const closeTray = () => {
  emit('update:modelValue', false);
  emit('close');
};

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && !activeEditItem.value) {
    closeTray();
  }
};

watch(
  () => props.modelValue,
  async (open) => {
    if (typeof document === 'undefined') return;
    if (open) {
      document.addEventListener('keydown', onKeyDown);
      document.body.style.overflow = 'hidden';
      await nextTick();
      trayPanelRef.value?.focus();
    } else {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  if (typeof document === 'undefined') return;
  document.removeEventListener('keydown', onKeyDown);
  document.body.style.overflow = '';
});

const { user, currentTeam } = useAuth();
const { showLoader, hideLoader } = useLoader();

const defaultBackstock = computed(() => getDefaultStorageLocation(currentTeam.value));

const items = ref<any[]>([]);
const loadingItems = ref(false);
const localPoStatus = ref('');
const receivingItemId = ref<string | null>(null);
const receivingAll = ref(false);
const unlinkingItemId = ref<string | null>(null);
const activeEditItem = ref<any | null>(null);
const failedImages = ref<Record<string, boolean>>({});
const rawFallbackTried = ref<Record<string, boolean>>({});

// Quick Link / Quick Create state
const showAddBar = ref(false);
const itemSearchQuery = ref('');
const searchResults = ref<any[]>([]);
const isSearching = ref(false);
const showDropdown = ref(false);
const newItemTitle = ref('');
const newItemCost = ref<number | string>('');
const creatingItem = ref(false);

const ENDPOINT = import.meta.env.PUBLIC_APPWRITE_ENDPOINT;
const PROJECT = import.meta.env.PUBLIC_APPWRITE_PROJECT_ID;

const trayTitle = computed(() => {
  if (!props.purchase) return 'Purchase Order Items';
  const po = props.purchase.poNumber || 'PO';
  const vendor = props.purchase.vendor || 'Unknown Vendor';
  return `${po} • ${vendor}`;
});

const traySubtitle = computed(() => {
  if (!props.purchase) return '';
  const orderStr = props.purchase.orderId ? `External Order #${props.purchase.orderId} • ` : '';
  return `${orderStr}Receive items into ${defaultBackstock.value}, unlink, or click Update to open the right-side Edit Item Drawer.`;
});

const itemsTotalCost = computed(() =>
  items.value.reduce((sum, i) => sum + (Number(i.cost) || 0), 0)
);

const itemsTotalRetail = computed(() =>
  items.value.reduce((sum, i) => sum + (Number(i.resalePrice || i.listPrice || i.boutiquePrice) || 0), 0)
);

const isReceivedStatus = (st?: string) => {
  const s = String(st || '').toLowerCase().trim();
  return ['received', 'in-stock', 'placed', 'sold', 'combined'].includes(s);
};

const unreceivedItemsCount = computed(() =>
  items.value.filter((i) => !isReceivedStatus(i.status)).length
);

const formatResalePrice = (item: any) => {
  if (item.resalePrice && Number(item.resalePrice) > 0) {
    return '$' + Number(item.resalePrice).toFixed(2);
  }
  if (item.listPrice && Number(item.listPrice) > 0) {
    return '$' + Number(item.listPrice).toFixed(2);
  }
  return '-';
};

const getAssetUrl = (id: string, preview = false) => {
  if (!id) return '';
  if (id.startsWith('http') || id.startsWith('data:') || id.startsWith('blob:') || id.startsWith('/api/')) {
    return id.startsWith('http') && !id.includes('/storage/buckets/')
      ? `/api/proxy-image?url=${encodeURIComponent(id)}`
      : id;
  }
  const mode = preview ? 'preview' : 'view';
  return `${ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${id}/${mode}?project=${PROJECT}`;
};

const getItemImage = (item: any) => {
  if (!item) return null;
  const useRaw = rawFallbackTried.value[item.$id];
  if (item.imageId) return getAssetUrl(item.imageId, !useRaw);
  if (item.imageUrl) return getAssetUrl(item.imageUrl, false);
  if (Array.isArray(item.galleryImageIds) && item.galleryImageIds.length > 0) {
    return getAssetUrl(item.galleryImageIds[0], !useRaw);
  }
  return null;
};

const handleImageError = (item: any) => {
  if (!item?.$id) return;
  if (!rawFallbackTried.value[item.$id]) {
    rawFallbackTried.value[item.$id] = true;
    return;
  }
  failedImages.value[item.$id] = true;
};

const getSgwUrl = (orderId: string | number) => {
  const str = String(orderId || '').trim();
  if (!str) return '#';
  if (str.startsWith('http')) return str;
  if (/^6\d{7}$/.test(str)) return `https://shopgoodwill.com/shopgoodwill/order/${str}`;
  return `https://shopgoodwill.com/item/${str}`;
};

const getPoStatusClass = (status?: string) => {
  switch (String(status || '').toLowerCase()) {
    case 'pending': return 'badge-warning text-warning-content';
    case 'ordered':
    case 'shipped': return 'badge-info text-info-content';
    case 'partial':
    case 'partially received': return 'badge-secondary text-secondary-content';
    case 'received': return 'badge-success text-success-content';
    case 'cancelled':
    case 'returned': return 'badge-error text-error-content';
    default: return 'badge-ghost';
  }
};

const getItemStatusBadgeClass = (status?: string) => {
  const s = String(status || '').toLowerCase().trim();
  if (s === 'sold') return 'badge-info text-info-content font-bold';
  if (s === 'placed') return 'badge-primary text-primary-content font-bold';
  if (s === 'received' || s === 'in-stock') return 'badge-success text-success-content font-bold';
  if (s === 'combined') return 'badge-secondary text-secondary-content font-bold';
  return 'badge-ghost text-base-content/80 font-bold';
};

const loadTrayItems = async () => {
  if (!props.purchase?.$id) {
    items.value = [];
    return;
  }
  loadingItems.value = true;
  try {
    const res = await getItemsByPurchaseId(
      props.purchase.$id,
      props.purchase.orderId || undefined,
      props.purchase.poNumber || undefined
    );
    items.value = res || [];
  } catch (e) {
    console.error('[PurchaseItemsTray] Failed to load PO items:', e);
    items.value = [];
  } finally {
    loadingItems.value = false;
  }
};

watch(
  () => [props.modelValue, props.purchase?.$id],
  ([isOpen, poId]) => {
    if (isOpen && poId) {
      localPoStatus.value = props.purchase?.status || 'Pending';
      showAddBar.value = false;
      loadTrayItems();
    } else if (!isOpen) {
      activeEditItem.value = null;
    }
  },
  { immediate: true }
);

const syncPoStatusAfterItemChange = async () => {
  if (!props.purchase?.$id || items.value.length === 0) return;
  const current = String(localPoStatus.value || '').toLowerCase();
  if (current === 'cancelled' || current === 'returned') return;

  const total = items.value.length;
  const receivedCount = items.value.filter((i) => isReceivedStatus(i.status)).length;

  let nextStatus = localPoStatus.value || 'Pending';
  if (receivedCount === total) {
    nextStatus = 'Received';
  } else if (receivedCount > 0) {
    nextStatus = 'Partial';
  } else if (current === 'received' || current === 'partial' || current === 'partially received') {
    nextStatus = 'Pending';
  }

  if (nextStatus !== localPoStatus.value) {
    localPoStatus.value = nextStatus;
    try {
      await purchasesAPI.updatePurchase(props.purchase.$id, { status: nextStatus });
    } catch (e) {
      console.warn('[PurchaseItemsTray] Could not auto-sync PO status:', e);
    }
  }
};

const normalizeSafeStorageLocation = (rawVal?: string, fallback = defaultBackstock.value) => {
  const trimmed = String(rawVal || '').trim();
  if (!trimmed || trimmed.toLowerCase() === 'backstock') {
    const fb = String(fallback || '').trim();
    return !fb || fb.toLowerCase() === 'backstock' ? 'HG' : fb;
  }
  return trimmed;
};

const receiveItem = async (item: any) => {
  if (!item?.$id) return;
  const loc = normalizeSafeStorageLocation(item.storageLocation, defaultBackstock.value);
  receivingItemId.value = item.$id;
  try {
    const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
    await databases.updateDocument(DB_ID, getCollectionId(), item.$id, {
      status: 'received',
      storageLocation: loc,
    });
    item.status = 'received';
    item.storageLocation = loc;
    addToast(`Received "${item.tag_title || item.title}" into ${loc}!`, 'success');
    await syncPoStatusAfterItemChange();
    emit('updated');
  } catch (e: any) {
    addToast(`Failed to receive item: ${e.message}`, 'error');
  } finally {
    receivingItemId.value = null;
  }
};

const receiveAllItems = async () => {
  const unreceived = items.value.filter((i) => !isReceivedStatus(i.status));
  if (unreceived.length === 0) return;

  const loc = defaultBackstock.value;
  const ok = await confirmDialog(
    `Receive all ${unreceived.length} unreceived item(s) in ${props.purchase?.poNumber || 'this PO'} into ${loc}?`,
    `Receive All to ${loc}`,
    `Receive ${unreceived.length} Item(s)`,
    'Cancel',
    'btn-success'
  );
  if (!ok) return;

  receivingAll.value = true;
  const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
  const colId = getCollectionId();
  let count = 0;

  try {
    for (const item of unreceived) {
      const targetLoc = normalizeSafeStorageLocation(item.storageLocation, loc);
      await databases.updateDocument(DB_ID, colId, item.$id, {
        status: 'received',
        storageLocation: targetLoc,
      });
      item.status = 'received';
      item.storageLocation = targetLoc;
      count++;
    }
    addToast(`Received ${count} item(s) into ${loc}!`, 'success');
    await syncPoStatusAfterItemChange();
    emit('updated');
  } catch (e: any) {
    addToast(`Error receiving items: ${e.message}`, 'error');
  } finally {
    receivingAll.value = false;
  }
};

const unlinkItem = async (item: any) => {
  if (!item?.$id) return;
  const ok = await confirmDialog(
    `Unlink "${item.title}" from ${props.purchase?.poNumber || 'this Purchase Order'}? (The item will remain in Inventory.)`,
    'Unlink Item',
    'Unlink',
    'Cancel',
    'btn-warning'
  );
  if (!ok) return;

  unlinkingItemId.value = item.$id;
  try {
    await linkItemToPurchase(item.$id, null);
    items.value = items.value.filter((i) => i.$id !== item.$id);
    addToast(`Unlinked "${item.title}"`, 'info');
    await syncPoStatusAfterItemChange();
    emit('updated');
  } catch (e: any) {
    addToast(`Failed to unlink item: ${e.message}`, 'error');
  } finally {
    unlinkingItemId.value = null;
  }
};

const openEditItem = (item: any) => {
  activeEditItem.value = item;
};

const handleSavedItem = async (payload: any) => {
  if (typeof payload?.__markAsync === 'function') payload.__markAsync();
  if (!activeEditItem.value) {
    hideLoader();
    return;
  }
  const editingId = activeEditItem.value.$id;
  showLoader('Saving Item...', {
    step: 'Updating item details...',
    basket: 'solar:diskette-bold-duotone',
    cancelable: false,
  });
  try {
    if (payload) {
      await updateInventoryItem(editingId, payload);
      delete failedImages.value[editingId];
      addToast(`Saved "${payload.title || activeEditItem.value.title}"!`, 'success');
    }
  } catch (e: any) {
    addToast('Failed to save item: ' + e.message, 'error');
  } finally {
    hideLoader();
    activeEditItem.value = null;
    await loadTrayItems();
    await syncPoStatusAfterItemChange();
    emit('updated');
  }
};

// Search & Link Existing Item
let searchDebounce: any = null;
const hideSearchDropdownDelayed = () => {
  setTimeout(() => {
    showDropdown.value = false;
  }, 200);
};

const handleItemSearch = () => {
  if (searchDebounce) clearTimeout(searchDebounce);
  const q = itemSearchQuery.value.trim();
  if (q.length < 2) {
    searchResults.value = [];
    return;
  }
  searchDebounce = setTimeout(async () => {
    isSearching.value = true;
    try {
      const results = await searchItems(q);
      const linkedIds = new Set(items.value.map((i) => i.$id));
      searchResults.value = (results || []).filter((r: any) => !linkedIds.has(r.$id));
    } catch {
      searchResults.value = [];
    } finally {
      isSearching.value = false;
    }
  }, 250);
};

const linkExistingItem = async (item: any) => {
  if (!props.purchase?.$id || !item?.$id) return;
  try {
    await linkItemToPurchase(item.$id, props.purchase.$id, props.purchase.orderId || undefined);
    itemSearchQuery.value = '';
    searchResults.value = [];
    showDropdown.value = false;
    addToast(`Linked "${item.title}" to ${props.purchase.poNumber || 'PO'}!`, 'success');
    await loadTrayItems();
    await syncPoStatusAfterItemChange();
    emit('updated');
  } catch (e: any) {
    addToast(`Failed to link item: ${e.message}`, 'error');
  }
};

const quickCreateItem = async () => {
  const title = newItemTitle.value.trim();
  if (!title || !props.purchase?.$id) return;
  const teamId = currentTeam.value?.$id || user.value?.$id;
  if (!teamId) {
    addToast('Please sign in to create items.', 'error');
    return;
  }
  creatingItem.value = true;
  try {
    const ownerType = currentTeam.value?.$id ? 'team' : 'user';
    await saveItemToInventory(
      { title, conditionNotes: '' },
      null,
      {
        title,
        cost: Number(newItemCost.value) || 0,
        status: 'acquired',
        storageLocation: defaultBackstock.value,
        purchaseId: props.purchase.$id,
        orderId: props.purchase.orderId || props.purchase.poNumber || undefined,
      },
      teamId,
      ownerType
    );
    newItemTitle.value = '';
    newItemCost.value = '';
    addToast(`Added "${title}" to ${props.purchase.poNumber || 'PO'}!`, 'success');
    await loadTrayItems();
    await syncPoStatusAfterItemChange();
    emit('updated');
  } catch (e: any) {
    addToast(`Failed to create item: ${e.message}`, 'error');
  } finally {
    creatingItem.value = false;
  }
};
</script>

<style scoped>
.rc-tray-enter-active,
.rc-tray-leave-active {
  transition: opacity 0.2s ease;
}
.rc-tray-enter-active .rc-tray-panel,
.rc-tray-leave-active .rc-tray-panel {
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}
.rc-tray-enter-from,
.rc-tray-leave-to {
  opacity: 0;
}
.rc-tray-enter-from .rc-tray-panel,
.rc-tray-leave-to .rc-tray-panel {
  transform: translateY(100%);
}
</style>

<template>
  <Teleport to="body" :disabled="!isMounted">
    <dialog :class="{ 'modal modal-open': isOpen && !!sale }" class="modal modal-bottom sm:modal-middle z-50">
      <div v-if="sale" class="modal-box max-w-2xl rounded-3xl p-5 sm:p-6 space-y-5 border border-base-300 shadow-2xl">
        <!-- Modal Header -->
        <div class="flex items-start justify-between gap-3 border-b border-base-200 pb-3.5">
          <div class="space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="badge badge-warning font-black text-xs gap-1 py-2.5 px-2.5">
                ⚠️ Unlinked Ticket Reconciliation
              </span>
              <span class="badge badge-outline font-mono font-bold text-xs">
                {{ sale.soNumber }}
              </span>
              <span class="badge badge-success badge-outline font-mono font-bold text-xs">
                Gross: ${{ Number(sale.grossAmount || 0).toFixed(2) }} · Net: ${{ Number(sale.netPayout || 0).toFixed(2) }}
              </span>
            </div>
            <h3 class="text-lg sm:text-xl font-black text-base-content tracking-tight">
              Link Ticket to Booth #0EJ Inventory or Reassign
            </h3>
            <p class="text-xs text-base-content/65">
              Select the matching Booth #0EJ item to pull its true SKU, description, and out-of-pocket Cost Basis (Gate 2 100% recoupment), or claim for the Commons Pool.
            </p>
          </div>
          <button
            type="button"
            @click="$emit('close')"
            class="btn btn-ghost btn-sm btn-circle shrink-0"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <!-- Step 1: Partner / Member Attribution Selector -->
        <div class="p-3.5 rounded-2xl bg-base-200/50 border border-base-300 space-y-2">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-black uppercase tracking-wider text-base-content/80">
              1. Assign Partner / Curator Prefix
            </span>
            <span class="text-[11px] font-mono opacity-60">
              Current: {{ selectedPartnerPrefix }}
            </span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              @click="selectedPartnerPrefix = 'HUCK-'"
              class="btn btn-sm rounded-xl font-bold justify-start gap-2 h-10"
              :class="selectedPartnerPrefix === 'HUCK-' ? 'btn-primary shadow-sm' : 'btn-ghost bg-base-100 border border-base-300'"
            >
              <span>🫐</span>
              <div class="text-left leading-tight">
                <div class="text-xs font-black">HUCK-</div>
                <div class="text-[10px] opacity-75 font-normal">Huckleberry (70/30)</div>
              </div>
            </button>
            <button
              type="button"
              @click="selectedPartnerPrefix = 'PDXGL-'"
              class="btn btn-sm rounded-xl font-bold justify-start gap-2 h-10"
              :class="selectedPartnerPrefix === 'PDXGL-' ? 'btn-accent shadow-sm' : 'btn-ghost bg-base-100 border border-base-300'"
            >
              <span>🎲</span>
              <div class="text-left leading-tight">
                <div class="text-xs font-black">PDXGL-</div>
                <div class="text-[10px] opacity-75 font-normal">PDX Game Lib (70/30)</div>
              </div>
            </button>
            <button
              type="button"
              @click="selectedPartnerPrefix = 'BB-'"
              class="btn btn-sm rounded-xl font-bold justify-start gap-2 h-10"
              :class="selectedPartnerPrefix === 'BB-' ? 'btn-secondary shadow-sm' : 'btn-ghost bg-base-100 border border-base-300'"
            >
              <span>👗</span>
              <div class="text-left leading-tight">
                <div class="text-xs font-black">BB-</div>
                <div class="text-[10px] opacity-75 font-normal">B&amp;B Consignor</div>
              </div>
            </button>
          </div>
        </div>

        <!-- Step 2: Candidate Inventory Lookup (Booth #0EJ / Approximate Price) -->
        <div class="space-y-3">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span class="text-xs font-black uppercase tracking-wider text-base-content/80">
              2. Match Active Booth #0EJ Item ({{ filteredCandidates.length }} candidates)
            </span>
            <label class="label cursor-pointer gap-2 py-0">
              <input
                type="checkbox"
                v-model="filterByApproxPrice"
                class="checkbox checkbox-xs checkbox-primary rounded"
              />
              <span class="label-text text-xs font-bold">
                Near Gross Price (${{ Number(sale.grossAmount || 0).toFixed(2) }} ± ${{ priceTolerance }})
              </span>
            </label>
          </div>

          <!-- Search & Tolerance Controls -->
          <div class="flex items-center gap-2">
            <div class="relative flex-1">
              <Icon icon="solar:magnifer-linear" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
              <input
                type="text"
                v-model="candidateSearch"
                placeholder="Filter Booth #0EJ items by title, 0EJ SKU, or HUCK/PDXGL barcode..."
                class="input input-bordered input-sm w-full pl-9 rounded-xl text-xs"
              />
            </div>
            <button
              v-if="filterByApproxPrice"
              type="button"
              @click="filterByApproxPrice = false"
              class="btn btn-xs btn-ghost rounded-lg font-bold"
              title="Show all Booth #0EJ items regardless of price"
            >
              Show All Prices
            </button>
          </div>

          <!-- Candidate List -->
          <div class="max-h-64 overflow-y-auto border border-base-300 rounded-2xl divide-y divide-base-200 bg-base-100">
            <div
              v-if="filteredCandidates.length === 0"
              class="p-6 text-center space-y-2 text-xs text-base-content/60"
            >
              <div>No active Booth #0EJ items matched the current price/search filter.</div>
              <button
                v-if="filterByApproxPrice"
                type="button"
                @click="filterByApproxPrice = false"
                class="btn btn-xs btn-outline btn-primary rounded-lg font-bold"
              >
                Show All Booth #0EJ Inventory
              </button>
            </div>

            <button
              v-for="item in filteredCandidates"
              :key="item.$id"
              type="button"
              @click="selectCandidate(item)"
              class="w-full text-left p-3 hover:bg-base-200/60 transition-colors flex items-center justify-between gap-3"
              :class="selectedItem?.$id === item.$id ? 'bg-primary/10 border-l-4 border-l-primary' : ''"
            >
              <div class="min-w-0 flex-1 space-y-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span
                    v-if="item.locationSku"
                    class="badge badge-xs badge-secondary font-mono font-bold"
                  >
                    {{ item.locationSku }}
                  </span>
                  <span
                    v-if="item.upc"
                    class="badge badge-xs badge-outline font-mono font-bold"
                  >
                    {{ item.upc }}
                  </span>
                  <span
                    v-if="Math.abs(getItemPrice(item) - Number(sale.grossAmount || 0)) < 0.05"
                    class="badge badge-xs badge-success font-bold"
                  >
                    🎯 Exact Price Match
                  </span>
                  <span
                    v-if="Number(item.quantity || 1) > 1"
                    class="badge badge-xs badge-info font-mono font-bold"
                  >
                    📦 Bin Qty: {{ item.quantity }}
                  </span>
                </div>
                <div class="font-bold text-xs text-base-content truncate">
                  {{ item.title || 'Untitled Inventory Item' }}
                </div>
              </div>

              <div class="text-right shrink-0 space-y-0.5 font-mono">
                <div class="text-xs font-black text-base-content">
                  Ask: ${{ getItemPrice(item).toFixed(2) }}
                </div>
                <div class="text-[11px] font-bold" :class="getItemCost(item) > 0 ? 'text-success' : 'opacity-50'">
                  Cost Basis: ${{ getItemCost(item).toFixed(2) }}
                </div>
              </div>
            </button>
          </div>
        </div>

        <!-- Selected Item Gate 2 Cost Basis & Waterfall Preview -->
        <div
          v-if="selectedItem"
          class="p-3.5 rounded-2xl bg-success/10 border border-success/30 text-xs space-y-1.5"
        >
          <div class="flex items-center justify-between font-black text-success">
            <span class="flex items-center gap-1.5">
              <Icon icon="solar:check-circle-bold" class="w-4 h-4 shrink-0" />
              <span>Ready to Link: {{ selectedItem.title }}</span>
            </span>
            <button type="button" @click="selectedItem = null" class="btn btn-ghost btn-xs h-5 min-h-0 px-1.5 text-[10px]">
              Clear SKU
            </button>
          </div>
          <div class="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
            <div class="bg-base-100/80 p-2 rounded-xl border border-base-200">
              <span class="block text-[10px] uppercase opacity-60 font-sans font-bold">True SKU / UPC</span>
              <span class="font-bold">{{ selectedItem.locationSku || selectedItem.upc || 'Assigned' }}</span>
            </div>
            <div class="bg-base-100/80 p-2 rounded-xl border border-base-200">
              <span class="block text-[10px] uppercase opacity-60 font-sans font-bold">Gate 2 Cost Basis</span>
              <span class="font-black text-success">${{ getItemCost(selectedItem).toFixed(2) }} Recouped</span>
            </div>
            <div class="bg-base-100/80 p-2 rounded-xl border border-base-200">
              <span class="block text-[10px] uppercase opacity-60 font-sans font-bold">Gate 3 Curator (70%)</span>
              <span class="font-black text-primary">
                ${{ previewCuratorTake.toFixed(2) }} ({{ selectedPartnerPrefix }})
              </span>
            </div>
          </div>
        </div>

        <!-- Modal Footer Actions: 1) Claim for Commons Pool, 2) Link Inventory / Reassign Member -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-base-200">
          <!-- Fallback: Claim for Commons Pool -->
          <button
            type="button"
            :disabled="isSubmitting"
            @click="handleClaimForCommons"
            class="btn btn-sm btn-outline btn-warning rounded-xl font-black gap-1.5 h-10"
            title="Set curator split to $0.00 and sweep 100% of net margin into the Shared Commons Pool"
          >
            <Icon icon="solar:buildings-2-bold-duotone" class="w-4 h-4 shrink-0" />
            <span>Assign to Commons Pool (100% Margin)</span>
          </button>

          <div class="flex items-center gap-2 justify-end">
            <button
              type="button"
              :disabled="isSubmitting"
              @click="$emit('close')"
              class="btn btn-sm btn-ghost rounded-xl font-bold h-10"
            >
              Cancel
            </button>
            <button
              type="button"
              :disabled="isSubmitting"
              @click="handleConfirmLinkOrReassign"
              class="btn btn-sm btn-primary rounded-xl font-black gap-1.5 px-4 shadow-md h-10"
            >
              <span v-if="isSubmitting" class="loading loading-spinner loading-xs"></span>
              <Icon v-else icon="solar:link-circle-bold" class="w-4 h-4 shrink-0" />
              <span>
                {{ selectedItem ? `Link SKU & Assign ${selectedPartnerPrefix}` : `Reassign to ${selectedPartnerPrefix}` }}
              </span>
            </button>
          </div>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="$emit('close')">
        <button type="button">close</button>
      </form>
    </dialog>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { addToast } from '../../stores/toast';
import { salesApi } from '../../lib/sales';
import { updateInventoryItem, DB_ID } from '../../lib/inventory';
import { databases } from '../../lib/appwrite';
import { MANIFESTS_COL, manifestsApi } from '../../lib/manifests';

const props = defineProps<{
  isOpen: boolean;
  sale: any | null;
  inventoryItems: any[];
  tenantId?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'updated', payload: { saleId: string; updatedSale: any; linkedItemId?: string }): void;
}>();

const isMounted = ref(false);
const isSubmitting = ref(false);
const selectedPartnerPrefix = ref<'HUCK-' | 'PDXGL-' | 'BB-'>('HUCK-');
const selectedItem = ref<any | null>(null);
const candidateSearch = ref('');
const filterByApproxPrice = ref(true);
const priceTolerance = ref(15);

onMounted(() => {
  isMounted.value = true;
});

watch(
  () => props.sale,
  (nextSale) => {
    if (!nextSale) return;
    selectedItem.value = null;
    candidateSearch.value = '';
    filterByApproxPrice.value = true;
    const p = String(nextSale.partner || 'HUCK').toUpperCase();
    if (p === 'PDXGL') selectedPartnerPrefix.value = 'PDXGL-';
    else if (p === 'BB') selectedPartnerPrefix.value = 'BB-';
    else selectedPartnerPrefix.value = 'HUCK-';
  },
  { immediate: true }
);

const getItemPrice = (item: any): number => {
  return Number(item?.resalePrice ?? item?.price ?? item?.maxBuyPrice ?? 0) || 0;
};

const getItemCost = (item: any): number => {
  const rawCost = Number(item?.cost ?? item?.purchasePrice ?? 0) || 0;
  const qty = Math.max(1, Number(item?.quantity || 1));
  return qty > 1 ? Number((rawCost / qty).toFixed(2)) : rawCost;
};

const isBooth0EJItem = (item: any): boolean => {
  if (!item) return false;
  const status = String(item.status || '').toLowerCase();
  const qty = Number(item.quantity || 1);
  if (status === 'sold' && qty <= 1) return false;

  const loc = String(item.storageLocation || '').toUpperCase();
  const sku = String(item.locationSku || '').toUpperCase();
  const selling = Array.isArray(item.sellingLocations) ? item.sellingLocations.join(' ').toUpperCase() : '';
  return (
    loc === 'MD' ||
    loc.includes('MEMORY') ||
    loc.includes('0EJ') ||
    sku.startsWith('0EJ') ||
    selling.includes('MEMORY') ||
    selling.includes('MD')
  );
};

const filteredCandidates = computed(() => {
  if (!props.sale) return [];
  const gross = Number(props.sale.grossAmount || 0);
  const q = candidateSearch.value.trim().toLowerCase();

  const boothItems = (props.inventoryItems || []).filter(isBooth0EJItem);

  const filtered = boothItems.filter((item) => {
    if (q) {
      const hay = `${item.title || ''} ${item.locationSku || ''} ${item.upc || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filterByApproxPrice.value && gross > 0 && !q) {
      const ask = getItemPrice(item);
      if (ask > 0 && Math.abs(ask - gross) > priceTolerance.value) {
        return false;
      }
    }
    return true;
  });

  return filtered
    .sort((a, b) => {
      const diffA = Math.abs(getItemPrice(a) - gross);
      const diffB = Math.abs(getItemPrice(b) - gross);
      return diffA - diffB;
    })
    .slice(0, 60);
});

const selectCandidate = (item: any) => {
  selectedItem.value = item;
  const upc = String(item?.upc || '').toUpperCase();
  if (upc.startsWith('PDXGL')) selectedPartnerPrefix.value = 'PDXGL-';
  else if (upc.startsWith('BB')) selectedPartnerPrefix.value = 'BB-';
  else if (upc.startsWith('HUCK')) selectedPartnerPrefix.value = 'HUCK-';
};

const previewCuratorTake = computed(() => {
  if (!props.sale) return 0;
  const netDeposit = Number(props.sale.netPayout || 0);
  const cost = selectedItem.value ? getItemCost(selectedItem.value) : 0;
  if (selectedPartnerPrefix.value === 'BB-') return netDeposit;
  const margin = Math.max(0, netDeposit - cost);
  return Number((cost + margin * 0.7).toFixed(2));
});

const extractTicketDigits = (sale: any): string => {
  const raw = `${sale?.soNumber || ''} ${sale?.orderId || ''} ${sale?.title || ''}`;
  const match = raw.match(/(\d{5,7})/);
  return match ? match[1] : String(sale?.soNumber || '').replace(/^(SO-|COMMONS-|HUCK-|PDXGL-|BB-)/i, '');
};

const markManifestItemSold = async (itemId: string, locationSku: string, soldDateStr: string) => {
  try {
    const manifests = await manifestsApi.listRecentManifests(props.tenantId, undefined, 25);
    for (const m of manifests) {
      const snap = Array.isArray(m.itemsSnapshot) ? [...m.itemsSnapshot] : [];
      let touched = false;
      const nextSnap = snap.map((entry: any) => {
        const matchById = entry.$id === itemId || entry.id === itemId;
        const matchBySku = locationSku && entry.locationSku && String(entry.locationSku).toUpperCase() === locationSku.toUpperCase();
        if (matchById || matchBySku) {
          touched = true;
          return {
            ...entry,
            status: 'SOLD',
            sold_at: soldDateStr,
          };
        }
        return entry;
      });
      if (touched) {
        await databases.updateDocument(DB_ID, MANIFESTS_COL, m.$id, {
          itemsSnapshot: JSON.stringify(nextSnap),
        });
      }
    }
  } catch (err) {
    console.warn('[LinkTicketInventoryModal] Manifest snapshot SOLD update non-fatal warning:', err);
  }
};

const handleConfirmLinkOrReassign = async () => {
  if (!props.sale) return;
  isSubmitting.value = true;
  try {
    const ticketNum = extractTicketDigits(props.sale);
    const soldAtDate = props.sale.date || new Date().toISOString();

    if (selectedItem.value) {
      const item = selectedItem.value;
      const trueSku = String(item.locationSku || item.upc || ticketNum).trim();
      const rawUpc = String(item.upc || '').trim();
      const cleanUpcSuffix = rawUpc.replace(/^(HUCK-|PDXGL-|BB-)/i, '') || trueSku;
      const reassignedUpc = `${selectedPartnerPrefix.value}${cleanUpcSuffix}`;

      // 1. Update Sale document in resale_db.sales
      const updatedSaleDoc = await salesApi.updateSale(props.sale.id, {
        soNumber: reassignedUpc,
        orderId: `Ticket #${ticketNum} • ${item.title}${item.locationSku ? ` - ${item.locationSku}` : ''}`,
      });

      // 2. Update Inventory Item in resale_db.items (Law #7: never write quantity: 0)
      const currentQty = Math.max(1, Number(item.quantity || 1));
      const isMulti = currentQty > 1;
      await updateInventoryItem(item.$id, {
        saleId: props.sale.id,
        status: isMulti ? 'placed' : 'sold',
        quantity: isMulti ? currentQty - 1 : 1,
        soldPrice: Number(props.sale.netPayout || props.sale.grossAmount || 0),
        upc: reassignedUpc,
      } as any);

      // 3. Mark item in resale_db.manifests as status: 'SOLD' with sold_at date
      await markManifestItemSold(item.$id, String(item.locationSku || ''), soldAtDate);

      addToast({
        type: 'success',
        message: `Linked Ticket #${ticketNum} to ${item.title} (${reassignedUpc}) with $${getItemCost(item).toFixed(2)} Cost Basis!`,
      });

      emit('updated', {
        saleId: props.sale.id,
        updatedSale: updatedSaleDoc,
        linkedItemId: item.$id,
      });
      emit('close');
    } else {
      // Partner-only reassignment on an unmapped ticket
      const cleanTitle = String(props.sale.title || `Ticket #${ticketNum}`).replace(/^\[COMMONS\]\s*/i, '');
      const nextSoNumber = `${selectedPartnerPrefix.value}${ticketNum}`;
      const updatedSaleDoc = await salesApi.updateSale(props.sale.id, {
        soNumber: nextSoNumber,
        orderId: `Ticket #${ticketNum} • ${cleanTitle}`,
      });

      addToast({
        type: 'success',
        message: `Reassigned Ticket #${ticketNum} to ${selectedPartnerPrefix.value}`,
      });

      emit('updated', {
        saleId: props.sale.id,
        updatedSale: updatedSaleDoc,
      });
      emit('close');
    }
  } catch (err: any) {
    console.error('[LinkTicketInventoryModal] Failed to link/reassign sale:', err);
    addToast({
      type: 'error',
      message: err?.message || 'Failed to update sale record in Appwrite.',
    });
  } finally {
    isSubmitting.value = false;
  }
};

const handleClaimForCommons = async () => {
  if (!props.sale) return;
  isSubmitting.value = true;
  try {
    const ticketNum = extractTicketDigits(props.sale);
    const baseDesc = String(props.sale.title || `Ticket #${ticketNum}`).replace(/^\[COMMONS\]\s*/i, '');
    const updatedSaleDoc = await salesApi.updateSale(props.sale.id, {
      soNumber: `COMMONS-${ticketNum}`,
      orderId: `Ticket #${ticketNum} • [COMMONS] ${baseDesc}`,
    });

    addToast({
      type: 'success',
      message: `Ticket #${ticketNum} assigned to Commons Pool (Curator $0 · 100% Net Margin to Commons)!`,
    });

    emit('updated', {
      saleId: props.sale.id,
      updatedSale: updatedSaleDoc,
    });
    emit('close');
  } catch (err: any) {
    console.error('[LinkTicketInventoryModal] Failed to claim for Commons:', err);
    addToast({
      type: 'error',
      message: err?.message || 'Failed to assign sale to Commons Pool.',
    });
  } finally {
    isSubmitting.value = false;
  }
};
</script>


<template>
  <div class="space-y-6">
    <div v-if="loading" class="flex justify-center p-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div v-else-if="error" class="alert alert-error">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      <span>{{ error }}</span>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Left Column: Sale Form -->
      <div class="lg:col-span-2 space-y-6">
        <form @submit.prevent="saveSale" class="card bg-base-100 shadow-xl border border-base-200">
          <div class="card-body">
            <div class="flex justify-between items-center mb-4">
              <h2 class="card-title text-2xl">Sale Details</h2>
              <div class="badge badge-lg font-mono" :class="isNew ? 'badge-primary' : 'badge-neutral'">
                {{ form.soNumber || 'Draft' }}
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="form-control w-full">
                <label class="label"><span class="label-text font-bold">Location / Platform</span></label>
                <select v-model="form.warehouseId" required class="select select-bordered w-full bg-base-200">
                  <option value="" disabled>Select Location</option>
                  <option v-for="wh in warehouses" :key="wh.$id" :value="wh.$id">
                    {{ wh.name }} ({{ wh.commissionRate }}% fee)
                  </option>
                </select>
              </div>

              <div class="form-control w-full">
                <label class="label"><span class="label-text font-bold">Sale Date</span></label>
                <input type="date" v-model="form.saleDate" required class="input input-bordered w-full bg-base-200" />
              </div>

              <div class="form-control w-full">
                <label class="label"><span class="label-text font-bold">Status</span></label>
                <select v-model="form.status" required class="select select-bordered w-full bg-base-200">
                  <option value="Draft">Draft</option>
                  <option value="Sold">Sold (Awaiting Shipment)</option>
                  <option value="Shipped">Shipped</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Returned">Returned</option>
                  <option value="Refunded">Refunded</option>
                </select>
              </div>

              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text font-bold">Order ID</span>
                  <span class="label-text-alt opacity-70">Optional</span>
                </label>
                <input type="text" v-model="form.orderId" placeholder="e.g. eBay Order #12345" class="input input-bordered w-full bg-base-200" />
              </div>
            </div>

            <div class="divider">Financials</div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="form-control w-full">
                <label class="label"><span class="label-text font-bold">Gross Sale Amount</span></label>
                <div class="relative">
                  <span class="absolute left-3 top-3 opacity-50">$</span>
                  <input type="number" step="0.01" min="0" v-model.number="form.grossAmount" required class="input input-bordered w-full pl-8 bg-base-200" />
                </div>
              </div>

              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text font-bold">Shipping Charged</span>
                </label>
                <div class="relative">
                  <span class="absolute left-3 top-3 opacity-50">$</span>
                  <input type="number" step="0.01" min="0" v-model.number="form.shippingCharged" class="input input-bordered w-full pl-8 bg-base-200" />
                </div>
              </div>

              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text font-bold">Shipping Cost</span>
                </label>
                <div class="relative">
                  <span class="absolute left-3 top-3 opacity-50">$</span>
                  <input type="number" step="0.01" min="0" v-model.number="form.shippingCost" class="input input-bordered w-full pl-8 bg-base-200" />
                </div>
              </div>
            </div>

            <div class="mt-8 flex justify-end gap-2">
              <button type="submit" class="btn btn-primary px-8" :disabled="saving">
                <span v-if="saving" class="loading loading-spinner loading-sm"></span>
                Save Sale
              </button>
            </div>
          </div>
        </form>
      </div>

      <!-- Right Column: Summary & Items -->
      <div class="space-y-6">
        <!-- Summary Card -->
        <div class="card bg-primary text-primary-content shadow-xl">
          <div class="card-body">
            <h2 class="card-title text-xl mb-4">Summary</h2>
            
            <div class="space-y-3">
              <div class="flex justify-between border-b border-primary-content/20 pb-2">
                <span class="opacity-80">Gross Sale</span>
                <span class="font-bold">{{ formatCurrency(form.grossAmount || 0) }}</span>
              </div>
              <div class="flex justify-between border-b border-primary-content/20 pb-2">
                <span class="opacity-80">Shipping Net</span>
                <span class="font-bold" :class="shippingNet >= 0 ? '' : 'text-error font-extrabold'">
                  {{ formatCurrency(shippingNet) }}
                </span>
              </div>
              <div class="flex justify-between border-b border-primary-content/20 pb-2">
                <span class="opacity-80">Platform Fee ({{ selectedCommissionRate }}%)</span>
                <span class="font-bold text-error">-{{ formatCurrency(computedCommissionFee) }}</span>
              </div>
              <div class="flex justify-between pt-2 text-xl font-black">
                <span>Net Payout</span>
                <span>{{ formatCurrency(computedNetPayout) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useAuth } from '../../composables/useAuth';
import { salesApi } from '../../lib/sales';
import { warehousesApi } from '../../lib/warehouses';
import { databases } from '../../lib/appwrite';
import { addToast } from '../../stores/toast';
import type { SaleData, SaleDocument } from '../../lib/sales';
import type { WarehouseDocument } from '../../lib/warehouses';

const props = defineProps<{ saleId?: string }>();
const { currentTeam } = useAuth();

const warehouses = ref<WarehouseDocument[]>([]);
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const isLinkedInventoryItem = ref(false);
const linkedItemId = ref('');
const isNew = computed(() => !props.saleId);

const form = ref<Partial<SaleData>>({
  soNumber: '',
  warehouseId: '',
  orderId: '',
  saleDate: new Date().toISOString().split('T')[0],
  status: 'Draft',
  grossAmount: 0,
  shippingCharged: 0,
  shippingCost: 0,
  tenantId: ''
});

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

const selectedWarehouse = computed(() => {
  return warehouses.value.find(w => w.$id === form.value.warehouseId);
});

const selectedCommissionRate = computed(() => {
  return selectedWarehouse.value ? selectedWarehouse.value.commissionRate : 0;
});

const computedCommissionFee = computed(() => {
  const gross = Number(form.value.grossAmount) || 0;
  const rate = selectedCommissionRate.value;
  return (gross * rate) / 100;
});

const shippingNet = computed(() => {
  const charged = Number(form.value.shippingCharged) || 0;
  const cost = Number(form.value.shippingCost) || 0;
  return charged - cost;
});

const computedNetPayout = computed(() => {
  const gross = Number(form.value.grossAmount) || 0;
  return gross + shippingNet.value - computedCommissionFee.value;
});

const loadData = async () => {
  if (!currentTeam.value) return;
  loading.value = true;
  error.value = '';
  try {
    warehouses.value = await warehousesApi.listWarehouses(currentTeam.value.$id);
    
    if (props.saleId) {
      try {
        const sale = await salesApi.getSale(props.saleId);
        form.value = { ...sale };
        // Format date for input
        if (form.value.saleDate) {
          form.value.saleDate = new Date(form.value.saleDate).toISOString().split('T')[0];
        }
      } catch (saleErr: any) {
        // Fallback: If not in sales collection, check if props.saleId is an inventory item ID
        const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
        try {
          const itemDoc = await databases.getDocument(DB_ID, 'items', props.saleId) as any;
          if (itemDoc) {
            isLinkedInventoryItem.value = true;
            linkedItemId.value = itemDoc.$id;
            form.value.soNumber = itemDoc.upc || itemDoc.locationSku || await salesApi.generateSoNumber(currentTeam.value.$id);
            form.value.orderId = itemDoc.locationSku || itemDoc.sku || itemDoc.title;
            form.value.grossAmount = Number(itemDoc.soldPrice || itemDoc.resalePrice || itemDoc.listPrice || 0);
            form.value.status = 'Sold';
            form.value.saleDate = itemDoc.$updatedAt ? new Date(itemDoc.$updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            
            // Match warehouse
            const locName = (Array.isArray(itemDoc.sellingLocations) ? itemDoc.sellingLocations[0] : itemDoc.sellingLocations) || itemDoc.storageLocation;
            if (locName) {
              const target = locName.toLowerCase().replace(/[^a-z0-9]/g, '');
              const wh = warehouses.value.find(w => w.name.toLowerCase().replace(/[^a-z0-9]/g, '') === target);
              if (wh) form.value.warehouseId = wh.$id;
            }
          } else {
            throw saleErr;
          }
        } catch {
          throw saleErr;
        }
      }
    } else {
      form.value.soNumber = await salesApi.generateSoNumber(currentTeam.value.$id);
    }
  } catch (err: any) {
    console.error('Error loading sale editor:', err);
    error.value = err.message || 'Failed to load data';
  } finally {
    loading.value = false;
  }
};

const saveSale = async () => {
  if (!currentTeam.value) return;
  saving.value = true;
  error.value = '';
  try {
    const payload: SaleData = {
      soNumber: form.value.soNumber!,
      warehouseId: form.value.warehouseId!,
      orderId: form.value.orderId,
      saleDate: form.value.saleDate ? new Date(form.value.saleDate).toISOString() : undefined,
      status: form.value.status || 'Draft',
      grossAmount: Number(form.value.grossAmount) || 0,
      shippingCharged: Number(form.value.shippingCharged) || 0,
      shippingCost: Number(form.value.shippingCost) || 0,
      commissionFee: computedCommissionFee.value,
      netPayout: computedNetPayout.value,
      tenantId: currentTeam.value.$id
    };

    if (isNew.value || isLinkedInventoryItem.value) {
      const newSale = await salesApi.createSale(payload);
      if (isLinkedInventoryItem.value && linkedItemId.value) {
        try {
          const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
          await databases.updateDocument(DB_ID, 'items', linkedItemId.value, { saleId: newSale.$id });
        } catch (linkErr) {
          console.warn('Could not link saleId to item:', linkErr);
        }
      }
      addToast('Sale created successfully!', 'success');
      window.location.href = `/sales/${newSale.$id}`;
    } else {
      await salesApi.updateSale(props.saleId!, payload);
      addToast('Sale updated successfully!', 'success');
      window.location.href = '/sales';
    }
  } catch (err: any) {
    console.error('Error saving sale:', err);
    error.value = err.message || 'Failed to save sale';
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  if (currentTeam.value) loadData();
});

watch(currentTeam, (n) => {
  if (n) loadData();
});
</script>

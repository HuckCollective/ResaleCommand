<template>
  <div class="space-y-6">
    <!-- Top Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h2 class="text-2xl font-bold flex items-center gap-2.5">
          <Icon icon="solar:shop-2-bold" class="w-7 h-7 text-primary" />
          <span>Locations &amp; Warehouses</span>
        </h2>
        <p class="text-xs opacity-70 mt-0.5">Manage physical booths, storage warehouses, and two-way sync sales &amp; inventory per location.</p>
      </div>
      <div class="flex items-center gap-2.5 w-full sm:w-auto">
        <a href="/warehouse/sync" class="btn btn-secondary btn-sm gap-2 font-bold shadow-sm flex-1 sm:flex-initial">
          <Icon icon="solar:round-transfer-horizontal-bold-duotone" class="w-4 h-4" />
          <span>Location Sync Hub</span>
        </a>
        <button class="btn btn-primary btn-sm gap-1.5 font-bold flex-1 sm:flex-initial" @click="openEditor()">
          <Icon icon="solar:add-circle-bold" class="w-4 h-4" />
          <span>Add Location</span>
        </button>
      </div>
    </div>

    <!-- Location Two-Way Sync Hub Banner -->
    <div class="card bg-base-100 border border-base-200 shadow-md p-5 sm:p-6 rounded-2xl">
      <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
        <div class="flex items-start gap-4">
          <div class="p-3.5 bg-secondary/15 text-secondary rounded-2xl shrink-0 mt-0.5">
            <Icon icon="solar:round-transfer-horizontal-bold-duotone" class="w-8 h-8" />
          </div>
          <div class="space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="text-base sm:text-lg font-bold">Two-Way Location &amp; Sales Sync Hub</h3>
              <span class="badge badge-xs badge-secondary font-bold font-mono">Ricochet POS / Memory Den</span>
            </div>
            <p class="text-xs opacity-75 max-w-2xl leading-relaxed">
              Resale Command acts as your single source of truth: export formatted inventory with barcodes to <strong>Memory Den (Ricochet POS)</strong>, and import sales payout reports to automatically record sold items, log net proceeds, and track booth fees.
            </p>
            <!-- Workflow Steps Pill Ribbon -->
            <div class="flex items-center gap-2 text-[11px] font-bold opacity-80 pt-1 flex-wrap">
              <span class="flex items-center gap-1 bg-base-200/80 px-2 py-0.5 rounded-md border border-base-300">
                <Icon icon="solar:file-download-bold" class="w-3.5 h-3.5 text-success" />
                1. Export Barcodes
              </span>
              <span>➔</span>
              <span class="flex items-center gap-1 bg-base-200/80 px-2 py-0.5 rounded-md border border-base-300">
                <Icon icon="solar:shop-2-bold" class="w-3.5 h-3.5 text-primary" />
                2. Place &amp; Sell in Booth
              </span>
              <span>➔</span>
              <span class="flex items-center gap-1 bg-base-200/80 px-2 py-0.5 rounded-md border border-base-300">
                <Icon icon="solar:upload-track-bold" class="w-3.5 h-3.5 text-secondary" />
                3. Import Payout CSV to Sync
              </span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3 shrink-0 w-full lg:w-auto border-t lg:border-t-0 pt-3 lg:pt-0 border-base-200">
          <a href="/warehouse/sync" class="btn btn-secondary btn-sm gap-2 font-bold shadow-sm w-full lg:w-auto">
            <Icon icon="solar:round-transfer-horizontal-bold-duotone" class="w-4 h-4" />
            <span>Open Sync Workspace ➔</span>
          </a>
        </div>
      </div>
    </div>

    <!-- Loader -->
    <div v-if="loading" class="flex justify-center p-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="alert alert-error">
      <Icon icon="solar:danger-circle-bold" class="w-6 h-6 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="warehouses.length === 0" class="card bg-base-100 shadow-xl border border-base-200">
      <div class="card-body text-center py-12">
        <h3 class="text-xl font-bold">No Locations Found</h3>
        <p class="opacity-70 mt-2 text-xs">Add your first physical location, booth, or warehouse to start tracking its commission, rent, and inventory.</p>
        <div class="mt-4">
          <button class="btn btn-primary btn-sm" @click="openEditor()">Add Location</button>
        </div>
      </div>
    </div>

    <!-- Warehouse List -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="warehouse in warehouses" :key="warehouse.$id" class="card bg-base-100 shadow-xl border border-base-200 hover:border-primary/50 transition-all flex flex-col justify-between">
        <div class="card-body p-5 flex flex-col justify-between h-full space-y-4">
          <div>
            <div class="flex justify-between items-start gap-2">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="card-title text-lg sm:text-xl font-bold leading-tight">{{ warehouse.name }}</h3>
                <span v-if="warehouse.code" class="badge badge-sm badge-primary font-mono font-black tracking-wider">{{ warehouse.code }}</span>
              </div>
              <div class="badge font-bold shrink-0 text-xs" :class="warehouse.type === 'Online' ? 'badge-info' : warehouse.type === 'Warehouse' ? 'badge-neutral' : 'badge-secondary'">
                {{ warehouse.type }}
              </div>
            </div>
            
            <div class="space-y-2 mt-4">
              <!-- Live Inventory Snapshot -->
              <div class="flex items-center justify-between bg-base-200/70 px-3 py-2 rounded-xl border border-base-300 text-xs">
                <span class="opacity-70 font-semibold flex items-center gap-1.5">
                  <Icon icon="solar:box-minimalistic-bold" class="w-3.5 h-3.5 text-primary" />
                  <span>Staged / In-Stock</span>
                </span>
                <span class="font-bold font-mono text-primary">
                  {{ getItemsForWarehouse(warehouse).length }} items
                  <span v-if="getItemsForWarehouse(warehouse).length > 0" class="opacity-60 text-[10px]">
                    ({{ formatCurrency(getItemsTotalValue(warehouse)) }})
                  </span>
                </span>
              </div>

              <div v-if="warehouse.categories || warehouse.niche" class="border-b border-base-200/60 pb-2 pt-1">
                <span class="opacity-70 text-[10px] uppercase font-bold tracking-wider block mb-1">Niche / Specialties</span>
                <div class="flex flex-wrap gap-1">
                  <span v-for="(cat, cIdx) in (warehouse.categories || warehouse.niche).split(',')" :key="cIdx" class="badge badge-xs badge-outline badge-primary">
                    {{ cat.trim() }}
                  </span>
                </div>
              </div>
              <div class="flex justify-between items-center border-b border-base-200/60 pb-2">
                <span class="opacity-70 text-xs font-semibold">Commission Rate</span>
                <span class="font-bold text-sm font-mono">{{ warehouse.commissionRate ? warehouse.commissionRate + '%' : '0%' }}</span>
              </div>
              <div class="flex justify-between items-center border-b border-base-200/60 pb-2">
                <span class="opacity-70 text-xs font-semibold">Monthly Rent</span>
                <span class="font-bold text-sm font-mono">{{ formatCurrency(warehouse.monthlyRent || 0) }}</span>
              </div>
            </div>
          </div>

          <!-- Location Actions: Two-Way Sync + Catalog -->
          <div class="space-y-2 pt-3 border-t border-base-200">
            <div class="grid grid-cols-2 gap-2">
              <!-- Import & Sync Sales (Primary Action for Location Reconciliation) -->
              <a 
                :href="'/warehouse/sync?location=' + encodeURIComponent(warehouse.name)" 
                class="btn btn-sm btn-secondary gap-1.5 font-bold shadow-xs col-span-2 sm:col-span-1"
                title="Upload sales payout CSV or product list from this booth"
              >
                <Icon icon="solar:round-transfer-horizontal-bold-duotone" class="w-4 h-4" /> 
                <span>Import &amp; Sync</span>
              </a>

              <!-- Export Ricochet CSV (1-click export for Consignment Booth / On-Site) -->
              <button 
                v-if="warehouse.type === 'Consignment Booth' || warehouse.type === 'On-Site' || warehouse.code === 'MD'"
                type="button" 
                class="btn btn-sm btn-outline border-base-300 hover:border-success hover:bg-success/10 font-bold gap-1.5 col-span-2 sm:col-span-1"
                @click="exportRicochetForWarehouse(warehouse)"
                :title="`Export ${getItemsForWarehouse(warehouse).length} items formatted for Ricochet POS`"
              >
                <Icon icon="solar:file-download-bold" class="w-4 h-4 text-success" />
                <span>Export POS</span>
              </button>

              <!-- View Items (when export is hidden e.g. Warehouse storage) -->
              <a 
                v-else
                :href="'/inventory?location=' + encodeURIComponent(warehouse.code || warehouse.name)" 
                class="btn btn-sm btn-outline border-base-300 font-bold gap-1 col-span-2 sm:col-span-1"
                title="View all items assigned to this location in inventory"
              >
                <Icon icon="solar:box-minimalistic-bold" class="w-4 h-4 opacity-70" />
                <span>View Items</span>
              </a>
            </div>

            <!-- Secondary Links: View Catalog & Manage -->
            <div class="flex justify-between items-center pt-1 text-xs">
              <a 
                v-if="warehouse.type === 'Consignment Booth' || warehouse.type === 'On-Site' || warehouse.code === 'MD'"
                :href="'/inventory?location=' + encodeURIComponent(warehouse.code || warehouse.name)" 
                class="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
              >
                <Icon icon="solar:box-minimalistic-linear" class="w-3.5 h-3.5" />
                <span>View Catalog ({{ getItemsForWarehouse(warehouse).length }})</span>
              </a>
              <span v-else></span>

              <div class="flex items-center gap-1">
                <button class="btn btn-xs btn-ghost gap-1 opacity-70 hover:opacity-100" @click="openEditor(warehouse)">
                  <Icon icon="solar:pen-linear" class="w-3.5 h-3.5" /> Edit
                </button>
                <button class="btn btn-xs btn-ghost text-error gap-1 opacity-70 hover:opacity-100 hover:bg-error/10" @click="confirmDelete(warehouse)">
                  <Icon icon="solar:trash-bin-trash-linear" class="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Location Editor Modal -->
    <Teleport to="body">
      <div class="modal" :class="{'modal-open': isModalOpen}">
        <div class="modal-box relative bg-base-100 border border-base-300 shadow-2xl">
          <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" @click="closeEditor">✕</button>
          <h3 class="font-bold text-2xl mb-6 text-primary">{{ isEditing ? 'Edit Location' : 'New Location' }}</h3>
          
          <form @submit.prevent="saveWarehouse" class="space-y-4">
            <div class="grid grid-cols-3 gap-3">
              <div class="form-control col-span-2">
                <label class="label"><span class="label-text font-bold">Location Name</span></label>
                <input type="text" v-model="editForm.name" required class="input input-bordered w-full bg-base-200 focus:bg-base-100 focus:ring-2 focus:ring-primary/50 transition-colors" placeholder="e.g. Memory Den" />
              </div>
              <div class="form-control col-span-1">
                <label class="label"><span class="label-text font-bold">Code</span></label>
                <input type="text" v-model="editForm.code" maxlength="6" class="input input-bordered w-full bg-base-200 focus:bg-base-100 font-mono font-bold uppercase" placeholder="e.g. MD" />
              </div>
            </div>

            <div class="form-control w-full">
              <label class="label"><span class="label-text font-bold">Type</span></label>
              <select v-model="editForm.type" required class="select select-bordered w-full bg-base-200">
                <option value="Consignment Booth">Consignment Booth (e.g. Memory Den, Dusty Tiger)</option>
                <option value="On-Site">On-Site (Retail / Booth)</option>
                <option value="Online">Online Marketplace</option>
                <option value="Warehouse">Warehouse (Storage Only)</option>
              </select>
            </div>

            <div class="form-control w-full">
              <label class="label">
                <span class="label-text font-bold">Niche &amp; Allowed Categories</span>
                <span class="label-text-alt text-[10px] opacity-70">Used by AI Scout</span>
              </label>
              <input type="text" v-model="editForm.categories" class="input input-bordered w-full bg-base-200 focus:bg-base-100" placeholder="e.g. Small Collectibles, Vintage Clothes, Games" />
              <label class="label pt-1 pb-0"><span class="label-text-alt text-[10px] opacity-60">Separate categories with commas</span></label>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text font-bold">Commission Rate (%)</span>
                  <span class="label-text-alt" title="Percentage taken on each sale by the booth">ⓘ</span>
                </label>
                <input type="number" step="0.01" min="0" max="100" v-model.number="editForm.commissionRate" class="input input-bordered w-full bg-base-200" placeholder="e.g. 15" />
              </div>

              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text font-bold">Monthly Rent ($)</span>
                  <span class="label-text-alt" title="Flat monthly booth rent fee">ⓘ</span>
                </label>
                <input type="number" step="0.01" min="0" v-model.number="editForm.monthlyRent" class="input input-bordered w-full bg-base-200" placeholder="e.g. 100" />
              </div>
            </div>

            <div class="modal-action mt-6">
              <button type="button" class="btn btn-ghost" @click="closeEditor">Cancel</button>
              <button type="submit" class="btn btn-primary" :disabled="saving">
                <span v-if="saving" class="loading loading-spinner loading-sm"></span>
                {{ isEditing ? 'Save Changes' : 'Create Location' }}
              </button>
            </div>
          </form>
        </div>
        <div class="modal-backdrop" @click="closeEditor"></div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div v-if="warehouseToDelete" class="modal modal-open z-50">
        <div class="modal-box max-w-sm border border-base-200 shadow-2xl p-6 bg-base-100">
          <div class="flex items-start gap-3">
            <div class="p-2.5 rounded-2xl bg-error/10 text-error shrink-0">
              <Icon icon="solar:trash-bin-trash-bold" class="w-6 h-6" />
            </div>
            <div>
              <h3 class="font-bold text-lg leading-tight">Delete {{ warehouseToDelete.name }}?</h3>
              <p class="text-xs opacity-75 mt-1.5">Are you sure you want to delete this location? This action cannot be undone.</p>
            </div>
          </div>
          <div class="modal-action mt-6 flex justify-end gap-2 border-t border-base-200 pt-3">
            <button class="btn btn-sm btn-ghost" @click="warehouseToDelete = null">Cancel</button>
            <button class="btn btn-sm btn-error text-white font-bold" @click="executeDelete">Delete Location</button>
          </div>
        </div>
        <div class="modal-backdrop" @click="warehouseToDelete = null"></div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useAuth } from '../../composables/useAuth';
import { useInventory } from '../../composables/useInventory';
import { warehousesApi, matchesLocationFilter } from '../../lib/warehouses';
import { generateRicochetCsv, downloadCsv } from '../../lib/exportUtils';
import { addToast } from '../../stores/toast';
import type { WarehouseDocument, WarehouseData } from '../../lib/warehouses';

const { currentTeam: team } = useAuth();
const { inventoryItems, fetchInventory } = useInventory();

const warehouses = ref<WarehouseDocument[]>([]);
const loading = ref<boolean>(false);
const saving = ref<boolean>(false);
const error = ref<string>('');
const isEditing = ref<boolean>(false);
const activeWarehouse = ref<WarehouseDocument | null>(null);
const warehouseToDelete = ref<WarehouseDocument | null>(null);

const isModalOpen = computed(() => activeWarehouse.value !== null);

const editForm = ref<WarehouseData>({
  name: '',
  code: '',
  type: 'Consignment Booth',
  categories: '',
  niche: '',
  commissionRate: 15,
  monthlyRent: 0,
  tenantId: ''
});

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

const getItemsForWarehouse = (warehouse: WarehouseDocument) => {
  const query = warehouse.code || warehouse.name;
  return inventoryItems.value.filter(item => 
    matchesLocationFilter(item, query) && item.status !== 'sold'
  );
};

const getItemsTotalValue = (warehouse: WarehouseDocument) => {
  const items = getItemsForWarehouse(warehouse);
  return items.reduce((acc, i) => acc + (Number(i.resalePrice || i.listPrice || i.estValue || 0)), 0);
};

const exportRicochetForWarehouse = (warehouse: WarehouseDocument) => {
  const items = getItemsForWarehouse(warehouse);
  if (items.length === 0) {
    addToast({ type: 'warning', message: `No active items found staged for ${warehouse.name}.` });
    return;
  }
  const csv = generateRicochetCsv(items);
  const safeName = (warehouse.code || warehouse.name).toLowerCase().replace(/[^a-z0-9]+/g, '_');
  downloadCsv(csv, `${safeName}_ricochet_export_${new Date().toISOString().slice(0, 10)}.csv`);
  addToast({ type: 'success', message: `Exported ${items.length} items for ${warehouse.name} in Ricochet format!` });
};

const fetchWarehouses = async () => {
  if (!team.value) return;
  loading.value = true;
  error.value = '';
  try {
    warehouses.value = await warehousesApi.listWarehouses(team.value.$id);
    await fetchInventory(team.value.$id);
  } catch (err: any) {
    console.error('Error fetching warehouses:', err);
    error.value = err.message || 'Failed to load locations';
  } finally {
    loading.value = false;
  }
};

const openEditor = (warehouse?: WarehouseDocument) => {
  if (warehouse) {
    isEditing.value = true;
    activeWarehouse.value = warehouse;
    editForm.value = {
      name: warehouse.name,
      code: warehouse.code || '',
      type: warehouse.type || 'Consignment Booth',
      categories: warehouse.categories || warehouse.niche || '',
      niche: warehouse.niche || warehouse.categories || '',
      commissionRate: warehouse.commissionRate ?? 15,
      monthlyRent: warehouse.monthlyRent ?? 0,
      tenantId: team.value?.$id || ''
    };
  } else {
    isEditing.value = false;
    activeWarehouse.value = {} as any;
    editForm.value = {
      name: '',
      code: '',
      type: 'Consignment Booth',
      categories: '',
      niche: '',
      commissionRate: 15,
      monthlyRent: 0,
      tenantId: team.value?.$id || ''
    };
  }
};

const closeEditor = () => {
  activeWarehouse.value = null;
};

const saveWarehouse = async () => {
  if (!team.value) return;
  saving.value = true;
  try {
    const payload: WarehouseData = {
      name: editForm.value.name.trim(),
      code: (editForm.value.code || '').trim().toUpperCase(),
      type: editForm.value.type,
      categories: editForm.value.categories || '',
      niche: editForm.value.categories || '',
      commissionRate: Number(editForm.value.commissionRate || 0),
      monthlyRent: Number(editForm.value.monthlyRent || 0),
      tenantId: team.value.$id
    };

    if (isEditing.value && activeWarehouse.value && activeWarehouse.value.$id) {
      await warehousesApi.updateWarehouse(activeWarehouse.value.$id, payload);
      addToast({ type: 'success', message: 'Location updated successfully!' });
    } else {
      await warehousesApi.createWarehouse(payload);
      addToast({ type: 'success', message: 'Location created successfully!' });
    }
    closeEditor();
    await fetchWarehouses();
  } catch (err: any) {
    console.error('Error saving warehouse:', err);
    addToast({ type: 'error', message: err.message || 'Failed to save location' });
  } finally {
    saving.value = false;
  }
};

const confirmDelete = (warehouse: WarehouseDocument) => {
  warehouseToDelete.value = warehouse;
};

const executeDelete = async () => {
  if (!warehouseToDelete.value) return;
  const name = warehouseToDelete.value.name;
  try {
    await warehousesApi.deleteWarehouse(warehouseToDelete.value.$id);
    warehouseToDelete.value = null;
    await fetchWarehouses();
    addToast({ type: 'info', message: `Deleted location ${name}.` });
  } catch (err: any) {
    console.error('Error deleting warehouse:', err);
    addToast({ type: 'error', message: err.message || 'Failed to delete location' });
  }
};

onMounted(() => {
  if (team.value) {
    fetchWarehouses();
  }
});

watch(team, (newTeam) => {
  if (newTeam) {
    fetchWarehouses();
  } else {
    warehouses.value = [];
  }
});
</script>


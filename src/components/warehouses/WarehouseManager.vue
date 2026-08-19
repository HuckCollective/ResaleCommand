<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h2 class="text-2xl font-bold">Locations & Warehouses</h2>
        <p class="text-xs opacity-70">Manage physical booths, storage warehouses, and sync sales & inventory per location.</p>
      </div>
      <button class="btn btn-primary" @click="openEditor()">Add Location</button>
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
        <p class="opacity-70 mt-2">Add your first physical location, booth, or warehouse to start tracking its commission and rent.</p>
        <div class="mt-4">
          <button class="btn btn-primary" @click="openEditor()">Add Location</button>
        </div>
      </div>
    </div>

    <!-- Warehouse List -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="warehouse in warehouses" :key="warehouse.$id" class="card bg-base-100 shadow-xl border border-base-200 hover:border-primary/50 transition-all flex flex-col justify-between">
        <div class="card-body p-5 flex flex-col justify-between h-full">
          <div>
            <div class="flex justify-between items-start">
              <h3 class="card-title text-xl font-bold">{{ warehouse.name }}</h3>
              <div class="badge font-bold" :class="warehouse.type === 'Online' ? 'badge-info' : warehouse.type === 'Warehouse' ? 'badge-neutral' : 'badge-secondary'">
                {{ warehouse.type }}
              </div>
            </div>
            
            <div class="space-y-2.5 mt-4">
              <div v-if="warehouse.categories || warehouse.niche" class="border-b border-base-200/60 pb-2">
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

          <!-- Location Actions -->
          <div class="flex flex-col gap-2 mt-5 pt-3 border-t border-base-200">
            <div class="flex gap-2">
              <a :href="'/inventory?location=' + encodeURIComponent(warehouse.name)" class="btn btn-sm btn-outline btn-primary gap-1.5 flex-1 font-bold">
                <Icon icon="solar:box-minimalistic-bold" class="w-4 h-4" /> Items
              </a>
              <a :href="'/warehouse/sync?location=' + encodeURIComponent(warehouse.name)" class="btn btn-sm btn-secondary gap-1.5 flex-1 font-bold shadow-sm">
                <Icon icon="solar:round-transfer-horizontal-bold-duotone" class="w-4 h-4" /> Sync / Sales
              </a>
            </div>
            <div class="flex justify-end items-center gap-1">
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

    <!-- Location Editor Modal -->
    <Teleport to="body">
      <div class="modal" :class="{'modal-open': isModalOpen}">
        <div class="modal-box relative bg-base-100 border border-base-300 shadow-2xl">
          <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" @click="closeEditor">✕</button>
          <h3 class="font-bold text-2xl mb-6 text-primary">{{ isEditing ? 'Edit Location' : 'New Location' }}</h3>
          
          <form @submit.prevent="saveWarehouse" class="space-y-4">
            <div class="form-control w-full">
              <label class="label"><span class="label-text font-bold">Location Name</span></label>
              <input type="text" v-model="editForm.name" required class="input input-bordered w-full bg-base-200 focus:bg-base-100 focus:ring-2 focus:ring-primary/50 transition-colors" placeholder="e.g. DustyTiger or Memory Den" />
            </div>

            <div class="form-control w-full">
              <label class="label"><span class="label-text font-bold">Type</span></label>
              <select v-model="editForm.type" required class="select select-bordered w-full bg-base-200">
                <option value="On-Site">On-Site (Booth/Store)</option>
                <option value="Online">Online</option>
                <option value="Warehouse">Warehouse (Storage Only)</option>
              </select>
            </div>

            <div class="form-control w-full">
              <label class="label">
                <span class="label-text font-bold">Niche & Allowed Categories</span>
                <span class="label-text-alt text-[10px] opacity-70">Used by AI Scout</span>
              </label>
              <input type="text" v-model="editForm.categories" class="input input-bordered w-full bg-base-200 focus:bg-base-100" placeholder="e.g. Small Collectibles, Jewelry, Wands (or Vintage Clothes, Arcane Punk)" />
              <label class="label pt-1 pb-0"><span class="label-text-alt text-[10px] opacity-60">Separate categories with commas</span></label>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text font-bold">Commission Rate (%)</span>
                  <span class="label-text-alt" title="Percentage taken on each sale">ⓘ</span>
                </label>
                <input type="number" step="0.01" min="0" max="100" v-model.number="editForm.commissionRate" class="input input-bordered w-full bg-base-200" placeholder="e.g. 10" />
              </div>

              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text font-bold">Monthly Rent ($)</span>
                  <span class="label-text-alt" title="Flat monthly fee">ⓘ</span>
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
import { ref, onMounted, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useAuth } from '../../composables/useAuth';
import { warehousesApi } from '../../lib/warehouses';
import { addToast } from '../../stores/toast';
import type { WarehouseDocument, WarehouseData } from '../../lib/warehouses';

const { currentTeam: team } = useAuth();

const warehouses = ref<WarehouseDocument[]>([]);
const loading = ref<boolean>(false);
const saving = ref<boolean>(false);
const error = ref<string>('');
const isEditing = ref<boolean>(false);
const activeWarehouse = ref<WarehouseDocument | null>(null);
const warehouseToDelete = ref<WarehouseDocument | null>(null);

const editForm = ref<WarehouseData>({
  name: '',
  type: 'Consignment Booth',
  address: '',
  description: '',
  commissionRate: 15,
  monthlyRent: 0,
  isDefault: false
});

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

const fetchWarehouses = async () => {
  if (!team.value) return;
  loading.value = true;
  error.value = '';
  try {
    warehouses.value = await warehousesApi.listWarehouses(team.value.$id);
  } catch (err: any) {
    console.error('Error fetching warehouses:', err);
    error.value = err.message || 'Failed to load locations';
  } finally {
    loading.value = false;
  }
};

const openCreateModal = () => {
  isEditing.value = false;
  activeWarehouse.value = {} as any; // Trigger modal
  editForm.value = {
    name: '',
    type: 'Consignment Booth',
    address: '',
    description: '',
    commissionRate: 15,
    monthlyRent: 0,
    isDefault: warehouses.value.length === 0
  };
};

const openEditModal = (warehouse: WarehouseDocument) => {
  isEditing.value = true;
  activeWarehouse.value = warehouse;
  editForm.value = {
    name: warehouse.name,
    type: warehouse.type,
    address: warehouse.address || '',
    description: warehouse.description || '',
    commissionRate: warehouse.commissionRate ?? 15,
    monthlyRent: warehouse.monthlyRent ?? 0,
    isDefault: warehouse.isDefault ?? false
  };
};

const closeEditor = () => {
  activeWarehouse.value = null;
};

const saveWarehouse = async () => {
  if (!team.value) return;
  saving.value = true;
  try {
    if (isEditing.value && activeWarehouse.value) {
      await warehousesApi.updateWarehouse(activeWarehouse.value.$id, editForm.value);
      addToast({ type: 'success', message: 'Location updated successfully!' });
    } else {
      await warehousesApi.createWarehouse(editForm.value, team.value.$id);
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

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-2xl font-bold">Locations & Warehouses</h2>
      <button class="btn btn-primary" @click="openEditor()">Add Location</button>
    </div>

    <!-- Loader -->
    <div v-if="loading" class="flex justify-center p-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="alert alert-error">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
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
      <div v-for="warehouse in warehouses" :key="warehouse.$id" class="card bg-base-100 shadow-xl border border-base-200 hover:border-primary transition-colors">
        <div class="card-body">
          <div class="flex justify-between items-start">
            <h3 class="card-title text-xl">{{ warehouse.name }}</h3>
            <div class="badge" :class="warehouse.type === 'Online' ? 'badge-info' : 'badge-secondary'">{{ warehouse.type }}</div>
          </div>
          
          <div class="space-y-2 mt-4 flex-1">
            <div class="flex justify-between items-center border-b border-base-200 pb-2">
              <span class="opacity-70 text-sm">Commission Rate</span>
              <span class="font-bold">{{ warehouse.commissionRate ? warehouse.commissionRate + '%' : '0%' }}</span>
            </div>
            <div class="flex justify-between items-center border-b border-base-200 pb-2">
              <span class="opacity-70 text-sm">Monthly Rent</span>
              <span class="font-bold">{{ formatCurrency(warehouse.monthlyRent || 0) }}</span>
            </div>
          </div>

          <div class="card-actions justify-end mt-4">
            <button class="btn btn-sm btn-ghost" @click="openEditor(warehouse)">Edit</button>
            <button class="btn btn-sm btn-error btn-outline" @click="confirmDelete(warehouse)">Delete</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Editor Modal -->
    <Teleport to="body">
      <div class="modal" :class="{'modal-open': isModalOpen}">
        <div class="modal-box relative bg-base-100 border border-base-300 shadow-2xl">
        <form method="dialog">
          <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" @click.prevent="closeEditor">✕</button>
        </form>
        <h3 class="font-bold text-2xl mb-6 text-primary">{{ isEditing ? 'Edit Location' : 'New Location' }}</h3>
        
        <form @submit.prevent="saveWarehouse" class="space-y-4">
          <div class="form-control w-full">
            <label class="label"><span class="label-text font-bold">Location Name</span></label>
            <input type="text" v-model="editForm.name" required class="input input-bordered w-full bg-base-200 focus:bg-base-100 focus:ring-2 focus:ring-primary/50 transition-colors" placeholder="e.g. Antique Mall A" />
          </div>

          <div class="form-control w-full">
            <label class="label"><span class="label-text font-bold">Type</span></label>
            <select v-model="editForm.type" required class="select select-bordered w-full bg-base-200">
              <option value="On-Site">On-Site (Booth/Store)</option>
              <option value="Online">Online</option>
              <option value="Warehouse">Warehouse (Storage Only)</option>
            </select>
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
        <form method="dialog" class="modal-backdrop">
          <button @click.prevent="closeEditor">close</button>
        </form>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useAuth } from '../../composables/useAuth';
import { warehousesApi } from '../../lib/warehouses';
import type { WarehouseDocument, WarehouseData } from '../../lib/warehouses';

const { currentTeam: team } = useAuth();
const warehouses = ref<WarehouseDocument[]>([]);
const loading = ref(true);
const error = ref('');
const saving = ref(false);

const isModalOpen = ref(false);
const isEditing = ref(false);
const editForm = ref<WarehouseData>({
  name: '',
  type: 'On-Site',
  commissionRate: 0,
  monthlyRent: 0,
  tenantId: ''
});
const editingId = ref<string | null>(null);

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
    error.value = err.message || 'Failed to load warehouses';
  } finally {
    loading.value = false;
  }
};

const openEditor = (warehouse?: WarehouseDocument) => {
  if (warehouse) {
    isEditing.value = true;
    editingId.value = warehouse.$id;
    editForm.value = {
      name: warehouse.name,
      type: warehouse.type,
      commissionRate: warehouse.commissionRate || 0,
      monthlyRent: warehouse.monthlyRent || 0,
      tenantId: warehouse.tenantId
    };
  } else {
    isEditing.value = false;
    editingId.value = null;
    editForm.value = {
      name: '',
      type: 'On-Site',
      commissionRate: 0,
      monthlyRent: 0,
      tenantId: team.value?.$id || ''
    };
  }
  isModalOpen.value = true;
};

const closeEditor = () => {
  isModalOpen.value = false;
};

const saveWarehouse = async () => {
  if (!team.value) return;
  saving.value = true;
  try {
    editForm.value.tenantId = team.value.$id;
    
    // Ensure numbers
    editForm.value.commissionRate = Number(editForm.value.commissionRate) || 0;
    editForm.value.monthlyRent = Number(editForm.value.monthlyRent) || 0;

    if (isEditing.value && editingId.value) {
      await warehousesApi.updateWarehouse(editingId.value, editForm.value);
    } else {
      await warehousesApi.createWarehouse(editForm.value);
    }
    closeEditor();
    await fetchWarehouses();
  } catch (err: any) {
    console.error('Error saving warehouse:', err);
    alert(err.message || 'Failed to save location');
  } finally {
    saving.value = false;
  }
};

const confirmDelete = async (warehouse: WarehouseDocument) => {
  if (confirm(`Are you sure you want to delete ${warehouse.name}? This action cannot be undone.`)) {
    try {
      await warehousesApi.deleteWarehouse(warehouse.$id);
      await fetchWarehouses();
    } catch (err: any) {
      console.error('Error deleting warehouse:', err);
      alert(err.message || 'Failed to delete location');
    }
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

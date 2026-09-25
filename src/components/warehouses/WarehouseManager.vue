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

    <!-- Locations KPI Telemetry Ribbon -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div class="card bg-base-100 border border-base-200 shadow-xs p-4 rounded-2xl flex flex-row items-center gap-3">
        <div class="p-2.5 bg-primary/15 text-primary rounded-2xl shrink-0">
          <Icon icon="solar:shop-2-bold" class="w-6 h-6" />
        </div>
        <div>
          <div class="text-[11px] uppercase font-bold opacity-60">Locations</div>
          <div class="font-black text-xl leading-tight">{{ warehouses.length }}</div>
          <div class="text-[10px] opacity-60 font-mono">booths &amp; storage</div>
        </div>
      </div>

      <div class="card bg-base-100 border border-base-200 shadow-xs p-4 rounded-2xl flex flex-row items-center gap-3">
        <div class="p-2.5 bg-secondary/15 text-secondary rounded-2xl shrink-0">
          <Icon icon="solar:box-minimalistic-bold" class="w-6 h-6" />
        </div>
        <div>
          <div class="text-[11px] uppercase font-bold opacity-60">Field Inventory</div>
          <div class="font-black text-xl text-secondary leading-tight">${{ totalFieldValue.toFixed(0) }}</div>
          <div class="text-[10px] opacity-60 font-mono">{{ totalFieldItems }} items in booths</div>
        </div>
      </div>

      <div class="card bg-base-100 border border-base-200 shadow-xs p-4 rounded-2xl flex flex-row items-center gap-3">
        <div class="p-2.5 bg-success/15 text-success rounded-2xl shrink-0">
          <Icon icon="solar:check-circle-bold" class="w-6 h-6" />
        </div>
        <div>
          <div class="text-[11px] uppercase font-bold opacity-60">POS Sync Health</div>
          <div class="font-black text-xl text-success leading-tight">{{ totalSyncedItems }} in POS</div>
          <div class="text-[10px] opacity-60 font-mono">{{ totalPendingExport }} pending export</div>
        </div>
      </div>

      <div class="card bg-base-100 border border-base-200 shadow-xs p-4 rounded-2xl flex flex-row items-center gap-3">
        <div class="p-2.5 bg-warning/15 text-warning rounded-2xl shrink-0">
          <Icon icon="solar:clock-circle-bold" class="w-6 h-6" />
        </div>
        <div>
          <div class="text-[11px] uppercase font-bold opacity-60">Active Drops</div>
          <div class="font-black text-xl text-warning leading-tight">{{ totalActiveDrops }} Active</div>
          <div class="text-[10px] opacity-60 font-mono">{{ totalExportedDrops }} to place</div>
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
                <a :href="'/warehouse/' + (warehouse.code || warehouse.$id)" class="card-title text-lg sm:text-xl font-bold leading-tight hover:text-primary transition-colors flex items-center gap-1.5 group">
                  <span>{{ warehouse.name }}</span>
                  <Icon icon="solar:arrow-right-up-linear" class="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary shrink-0" />
                </a>
                <span v-if="warehouse.code" class="badge badge-sm badge-primary font-mono font-black tracking-wider">{{ warehouse.code }}</span>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <div class="badge font-bold shrink-0 text-xs" :class="warehouse.type === 'Online' ? 'badge-info' : warehouse.type === 'Warehouse' ? 'badge-neutral' : 'badge-secondary'">
                  {{ warehouse.type }}
                </div>
                <a :href="'/warehouse/' + (warehouse.code || warehouse.$id)" class="btn btn-ghost btn-xs btn-circle opacity-60 hover:opacity-100" title="Manage Location Details &amp; Drops">
                  <Icon icon="solar:settings-bold" class="w-4 h-4" />
                </a>
              </div>
            </div>
            
            <div class="space-y-2 mt-4">
              <!-- Live In-Stock Summary -->
              <div class="flex items-center justify-between bg-base-200/70 px-3.5 py-2.5 rounded-xl border border-base-300 text-xs">
                <span class="opacity-70 font-semibold flex items-center gap-1.5">
                  <Icon icon="solar:box-minimalistic-bold" class="w-3.5 h-3.5 text-primary" />
                  <span>In-Stock Inventory</span>
                </span>
                <span class="font-bold font-mono text-primary text-sm">
                  {{ getItemsForWarehouse(warehouse).length }} items
                  <span v-if="getItemsForWarehouse(warehouse).length > 0" class="opacity-60 text-xs font-normal">
                    ({{ formatCurrency(getItemsTotalValue(warehouse)) }})
                  </span>
                </span>
              </div>
            </div>
          </div>

          <!-- Location Actions: Dedicated Cockpit + Two-Way Sync -->
          <div class="space-y-2 pt-3 border-t border-base-200">
            <div class="grid grid-cols-2 gap-2">
              <!-- Primary Action: Dedicated Cockpit Hub -->
              <a 
                :href="'/warehouse/' + (warehouse.code || warehouse.$id)"
                class="btn btn-sm btn-primary gap-1.5 font-bold shadow-xs col-span-2 sm:col-span-1"
                title="Open location drops, in-stock catalog & settings"
              >
                <Icon icon="solar:shop-2-bold" class="w-4 h-4" />
                <span>Manage Booth ➔</span>
              </a>

              <!-- Secondary Action: Import & Sync Sales -->
              <a 
                :href="'/warehouse/sync?location=' + encodeURIComponent(warehouse.name)" 
                class="btn btn-sm btn-secondary gap-1.5 font-bold shadow-xs col-span-2 sm:col-span-1"
                title="Upload sales payout CSV or product list from this booth"
              >
                <Icon icon="solar:round-transfer-horizontal-bold-duotone" class="w-4 h-4" /> 
                <span>Import &amp; Sync</span>
              </a>
            </div>

            <!-- Secondary Links: View Catalog & Quick Actions -->
            <div class="flex justify-between items-center pt-1 text-xs">
              <a 
                :href="'/inventory?location=' + encodeURIComponent(warehouse.code || warehouse.name)" 
                class="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
              >
                <Icon icon="solar:box-minimalistic-linear" class="w-3.5 h-3.5" />
                <span>View Catalog ({{ getItemsForWarehouse(warehouse).length }})</span>
              </a>

              <div class="flex items-center gap-1">
                <button class="btn btn-xs btn-ghost gap-1 opacity-70 hover:opacity-100" @click="openEditor(warehouse)">
                  <Icon icon="solar:pen-linear" class="w-3.5 h-3.5" /> Quick Edit
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

            <!-- Niche Guidelines Textarea -->
            <div class="form-control w-full space-y-1">
              <div class="flex items-center justify-between">
                <label class="label p-0">
                  <span class="label-text font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Icon icon="solar:document-text-bold" class="w-4 h-4 text-primary" />
                    Niche &amp; Sourcing Guidelines (Exclusions &amp; Rules)
                  </span>
                </label>
                <span class="text-[10px] opacity-60 font-mono">Used by AI Scout</span>
              </div>
              <textarea 
                v-model="editForm.categories" 
                rows="3" 
                class="textarea textarea-bordered w-full bg-base-200 focus:bg-base-100 font-medium text-xs leading-relaxed" 
                placeholder="e.g. Small Collectibles, Vintage Jewelry, Pins, Wands, Pocket Curiosities. NO Clothes, NO Apparel, NO Large Toys, Under 8 inches only"
              ></textarea>
              
              <!-- Quick Negative Exclusion Rule Helpers -->
              <div class="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span class="text-[10px] font-bold uppercase opacity-50">Quick Exclusions:</span>
                <button 
                  type="button" 
                  @click="appendRuleToTextarea('NO Clothes')"
                  class="badge badge-xs badge-outline hover:badge-error hover:text-error-content cursor-pointer transition-colors text-[10px] font-bold"
                >
                  ⛔ NO Clothes
                </button>
                <button 
                  type="button" 
                  @click="appendRuleToTextarea('NO Large Toys')"
                  class="badge badge-xs badge-outline hover:badge-error hover:text-error-content cursor-pointer transition-colors text-[10px] font-bold"
                >
                  ⛔ NO Large Toys
                </button>
                <button 
                  type="button" 
                  @click="appendRuleToTextarea('Under 8 inches only')"
                  class="badge badge-xs badge-outline hover:badge-warning hover:text-warning-content cursor-pointer transition-colors text-[10px] font-bold"
                >
                  📏 Under 8" Only
                </button>
              </div>
            </div>

            <!-- Watch Tags (Tags to Watch / Priority Franchises) -->
            <div class="form-control w-full p-3 rounded-2xl bg-base-200/50 border border-base-300 space-y-2">
              <div class="flex items-center justify-between">
                <label class="label p-0">
                  <span class="label-text font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Icon icon="solar:eye-bold" class="w-4 h-4 text-secondary" />
                    Tags &amp; Brands to Watch
                  </span>
                </label>
                <span class="badge badge-xs badge-secondary/20 text-secondary font-mono font-bold">
                  {{ watchTags.length }} tag{{ watchTags.length === 1 ? '' : 's' }} active
                </span>
              </div>

              <!-- Active Watch Tags List -->
              <div v-if="watchTags.length > 0" class="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                <span 
                  v-for="(tag, idx) in watchTags" 
                  :key="tag" 
                  class="badge badge-sm badge-secondary font-bold gap-1 py-2 px-2 text-xs"
                >
                  <span>{{ tag }}</span>
                  <button 
                    type="button" 
                    @click="removeWatchTag(idx)" 
                    class="hover:text-error ml-0.5 rounded-full hover:bg-black/10 w-3.5 h-3.5 flex items-center justify-center text-[10px]"
                  >
                    ✕
                  </button>
                </span>
              </div>
              <div v-else class="text-[11px] opacity-50 italic">
                No watch tags added yet. Type below or click quick suggestions to add.
              </div>

              <!-- Add New Watch Tag Input -->
              <div class="flex items-center gap-2">
                <input 
                  type="text" 
                  v-model="newWatchTag" 
                  @keydown.enter.prevent="addWatchTag()"
                  placeholder="Type tag or brand &amp; press Enter (e.g. Star Trek, Trifari, Enamel Pins)"
                  class="input input-xs input-bordered w-full font-bold bg-base-100 focus:bg-base-100 flex-1" 
                />
                <button 
                  type="button" 
                  @click="addWatchTag()" 
                  class="btn btn-xs btn-secondary text-secondary-content font-bold px-3 shrink-0"
                  :disabled="!newWatchTag.trim()"
                >
                  Add
                </button>
              </div>

              <!-- Preset Watch Tags -->
              <div class="flex flex-wrap gap-1 pt-0.5">
                <button 
                  v-for="rec in presetWatchTags" 
                  :key="rec" 
                  type="button"
                  @click="addWatchTag(rec)"
                  :disabled="watchTags.includes(rec)"
                  class="badge badge-xs badge-outline hover:badge-primary transition-colors cursor-pointer text-[10px] font-bold"
                  :class="{'opacity-35 pointer-events-none': watchTags.includes(rec)}"
                >
                  + {{ rec }}
                </button>
              </div>
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

    <!-- OUTBOUND LOCATION MANIFEST TRAY -->
    <LocationManifestTray 
      :isOpen="isManifestTrayOpen" 
      :locationId="activeWarehouseForTray?.code"
      :locationName="activeWarehouseForTray?.name"
      @toggle-tray="isManifestTrayOpen = false" 
      @close="isManifestTrayOpen = false"
      @drop-changed="loadManifests"
    />
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
import { manifestsApi, type ManifestDocument } from '../../lib/manifests';
import { useManifest } from '../../composables/useManifest';
import LocationManifestTray from '../inventory/LocationManifestTray.vue';
import { getAssetUrl } from '../../lib/inventory';

const { currentTeam: team } = useAuth();
const { inventoryItems, fetchInventory } = useInventory();

// Manifest composable & state
const {
  activeManifest,
  isTrayOpen: isManifestTrayOpen,
  initActiveDraft,
  switchActiveManifest,
  createNewDraft
} = useManifest();

const allManifests = ref<ManifestDocument[]>([]);
const loadingManifests = ref<boolean>(false);

const warehouses = ref<WarehouseDocument[]>([]);
const loading = ref<boolean>(false);
const saving = ref<boolean>(false);
const error = ref<string>('');
const isEditing = ref<boolean>(false);
const activeWarehouse = ref<WarehouseDocument | null>(null);
const activeWarehouseForTray = ref<WarehouseDocument | null>(null);
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
  return items.reduce((acc, i) => {
    const unitPrice = Number(i.resalePrice || i.listPrice || i.estValue || 0);
    const qty = Math.max(1, Number(i.quantity) || 1);
    return acc + (unitPrice * qty);
  }, 0);
};

const isItemSynced = (item: any) => {
  return !!(
    item.locationSku ||
    item.ricochetSynced === true ||
    (Array.isArray(item.sellingLocations) && item.sellingLocations.some((l: string) => /ricochet/i.test(l)))
  );
};

const getSyncedItemsCount = (warehouse: WarehouseDocument) => {
  const items = getItemsForWarehouse(warehouse);
  return items.filter(isItemSynced).length;
};

const getPendingExportCount = (warehouse: WarehouseDocument) => {
  const items = getItemsForWarehouse(warehouse);
  return items.filter(i => !isItemSynced(i)).length;
};

const totalFieldItems = computed(() => {
  return warehouses.value.reduce((acc, w) => acc + getItemsForWarehouse(w).length, 0);
});

const totalFieldValue = computed(() => {
  return warehouses.value.reduce((acc, w) => acc + getItemsTotalValue(w), 0);
});

const totalSyncedItems = computed(() => {
  return warehouses.value.reduce((acc, w) => acc + getSyncedItemsCount(w), 0);
});

const totalPendingExport = computed(() => {
  return warehouses.value.reduce((acc, w) => acc + getPendingExportCount(w), 0);
});

const totalActiveDrops = computed(() => {
  return warehouses.value.filter(w => getActiveDraftForWarehouse(w)).length;
});

const totalExportedDrops = computed(() => {
  return warehouses.value.reduce((acc, w) => acc + getExportedDropsForWarehouse(w).length, 0);
});

const exportRicochetForWarehouse = (warehouse: WarehouseDocument, unsyncedOnly: boolean = false) => {
  let items = getItemsForWarehouse(warehouse);
  if (items.length === 0) {
    addToast({ type: 'warning', message: `No active items found staged for ${warehouse.name}.` });
    return;
  }
  if (unsyncedOnly) {
    const pending = items.filter(i => !isItemSynced(i));
    if (pending.length === 0) {
      addToast({ type: 'info', message: `All items for ${warehouse.name} are already marked as synced in Ricochet POS!` });
      return;
    }
    items = pending;
  }
  const orgPrefix = 'HUCK';
  const csv = generateRicochetCsv(items, { orgPrefix, unsyncedOnly });
  const safeName = (warehouse.code || warehouse.name).toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const modeTag = unsyncedOnly ? '_new_unsynced' : '_full';
  downloadCsv(csv, `${safeName}_ricochet${modeTag}_${new Date().toISOString().slice(0, 10)}.csv`);
  addToast({ 
    type: 'success', 
    message: `Exported ${items.length} ${unsyncedOnly ? 'unsynced ' : ''}items for ${warehouse.name} in clean Ricochet format!` 
  });
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

const parseNicheAndWatchTags = (raw: string) => {
  if (!raw) return { rules: '', tags: [] as string[] };
  const markerRegex = /(?:^|\n)(?:Watch Tags|Tags to Watch|Priority Tags):\s*(.*)$/im;
  const match = raw.match(markerRegex);
  if (match) {
    const rules = raw.replace(markerRegex, '').trim();
    const tags = match[1]
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    return { rules, tags };
  }
  return { rules: raw, tags: [] as string[] };
};

const watchTags = ref<string[]>([]);
const newWatchTag = ref('');

const presetWatchTags = [
  'Small Collectibles',
  'Vintage Jewelry',
  'Enamel Pins',
  'Pocket Knives',
  'Sterling 925',
  'Star Trek',
  'Miniatures',
  'Trading Cards',
  'Micro Machines'
];

const addWatchTag = (tag?: string) => {
  const val = (tag || newWatchTag.value || '').trim();
  if (!val) return;
  const parts = val.split(',').map(p => p.trim()).filter(Boolean);
  for (const part of parts) {
    if (!watchTags.value.some(t => t.toLowerCase() === part.toLowerCase())) {
      watchTags.value.push(part);
    }
  }
  newWatchTag.value = '';
};

const removeWatchTag = (idx: number) => {
  watchTags.value.splice(idx, 1);
};

const appendRuleToTextarea = (rule: string) => {
  const current = (editForm.value.categories || '').trim();
  if (!current) {
    editForm.value.categories = rule;
  } else if (!current.toLowerCase().includes(rule.toLowerCase())) {
    editForm.value.categories = `${current}, ${rule}`;
  }
};

const openEditor = (warehouse?: WarehouseDocument) => {
  if (warehouse) {
    isEditing.value = true;
    activeWarehouse.value = warehouse;
    const parsed = parseNicheAndWatchTags(warehouse.categories || (warehouse as any).niche || '');
    editForm.value = {
      name: warehouse.name,
      code: warehouse.code || '',
      type: warehouse.type || 'Consignment Booth',
      categories: parsed.rules,
      commissionRate: warehouse.commissionRate ?? 15,
      monthlyRent: warehouse.monthlyRent ?? 0,
      tenantId: team.value?.$id || ''
    };
    watchTags.value = parsed.tags;
  } else {
    isEditing.value = false;
    activeWarehouse.value = {} as any;
    editForm.value = {
      name: '',
      code: '',
      type: 'Consignment Booth',
      categories: '',
      commissionRate: 15,
      monthlyRent: 0,
      tenantId: team.value?.$id || ''
    };
    watchTags.value = [];
  }
};

const closeEditor = () => {
  activeWarehouse.value = null;
};

const saveWarehouse = async () => {
  if (!team.value) return;
  saving.value = true;
  try {
    let finalCategories = editForm.value.categories.trim();
    if (watchTags.value.length > 0) {
      finalCategories = finalCategories 
        ? `${finalCategories}\nWatch Tags: ${watchTags.value.join(', ')}` 
        : `Watch Tags: ${watchTags.value.join(', ')}`;
    }

    const payload: WarehouseData = {
      name: editForm.value.name.trim(),
      code: (editForm.value.code || '').trim().toUpperCase(),
      type: editForm.value.type,
      categories: finalCategories,
      commissionRate: Number(editForm.value.commissionRate || 0),
      monthlyRent: Number(editForm.value.monthlyRent || 0),
      tenantId: team.value.$id
    };

    if (isEditing.value && activeWarehouse.value && activeWarehouse.value.$id) {
      await warehousesApi.updateWarehouse(activeWarehouse.value.$id, payload);
      addToast({ type: 'success', message: 'Location updated successfully!' });
    } else {
      const created = await warehousesApi.createWarehouse(payload);
      addToast({ type: 'success', message: 'Location created successfully!' });
      closeEditor();
      window.location.href = `/warehouse/${created.code || created.$id}`;
      return;
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

// -- MANIFESTS & DROPS HUB --
const loadManifests = async () => {
  const tId = team.value?.$id;
  if (!tId) return;
  loadingManifests.value = true;
  try {
    allManifests.value = await manifestsApi.listManifests(tId);
  } catch (e) {
    console.warn('Could not load manifests:', e);
  } finally {
    loadingManifests.value = false;
  }
};

const getManifestsForWarehouse = (warehouse: WarehouseDocument) => {
  const code = (warehouse.code || '').toLowerCase();
  const name = (warehouse.name || '').toLowerCase();
  return allManifests.value.filter(m => {
    const locId = (m.locationId || '').toLowerCase();
    const locName = (m.locationName || '').toLowerCase();
    return locId === code || locName === name || (code === 'md' && (locId.includes('memory') || locName.includes('memory')));
  });
};

const getActiveDraftForWarehouse = (warehouse: WarehouseDocument) => {
  return getManifestsForWarehouse(warehouse).find(m => m.status === 'draft' || m.status === 'paused') || null;
};

const getDraftsForWarehouse = (warehouse: WarehouseDocument) => {
  return getManifestsForWarehouse(warehouse).filter(m => m.status === 'draft' || m.status === 'paused' || m.status === 'in-transit');
};

const openManifestTrayForManifest = async (manifest: ManifestDocument, warehouse?: WarehouseDocument) => {
  activeWarehouseForTray.value = warehouse || null;
  await switchActiveManifest(manifest.$id);
  isManifestTrayOpen.value = true;
};

const getExportedDropsForWarehouse = (warehouse: WarehouseDocument) => {
  return getManifestsForWarehouse(warehouse).filter(m => m.status === 'exported');
};

const getPlacedDropsForWarehouse = (warehouse: WarehouseDocument) => {
  return getManifestsForWarehouse(warehouse).filter(m => m.status === 'placed');
};

const openManifestTrayFor = async (warehouse: WarehouseDocument) => {
  activeWarehouseForTray.value = warehouse;
  const active = getActiveDraftForWarehouse(warehouse);
  if (active) {
    await switchActiveManifest(active.$id);
  }
  isManifestTrayOpen.value = true;
};

const startNewDropForWarehouse = async (warehouse: WarehouseDocument) => {
  activeWarehouseForTray.value = warehouse;
  const newDropName = `${warehouse.name} Drop - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  await createNewDraft(newDropName, warehouse.code || 'MD', warehouse.name);
  await loadManifests();
  isManifestTrayOpen.value = true;
};

// -- OPEN MANIFEST TRAY FOR VERIFYING / STAGING --
const openVerificationModal = async (manifest: ManifestDocument, warehouse: WarehouseDocument) => {
  activeWarehouseForTray.value = warehouse;
  await switchActiveManifest(manifest.$id);
  isManifestTrayOpen.value = true;
};

onMounted(() => {
  if (team.value) {
    fetchWarehouses();
    loadManifests();
  }
});

watch(team, (newTeam) => {
  if (newTeam) {
    fetchWarehouses();
    loadManifests();
  } else {
    warehouses.value = [];
    allManifests.value = [];
  }
});
</script>


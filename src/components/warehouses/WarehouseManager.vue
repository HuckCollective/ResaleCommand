<template>
  <div class="space-y-5 sm:space-y-6 pb-6 sm:pb-8">
    <!-- Top Header (Krug #5 Trunk Test: Exact h1 + Unambiguous Verb+Object Actions) -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5 text-base-content">
          <Icon icon="solar:shop-2-bold" class="w-7 h-7 text-primary shrink-0" />
          <span>Booths &amp; Storage</span>
        </h1>
        <p class="text-xs sm:text-sm text-base-content/70 mt-0.5">
          Physical Selling Booths with commission &amp; POS sync, separated clearly from Backstock Storage &amp; Online Ready bins.
        </p>
      </div>
      <div class="flex items-center gap-2 flex-wrap w-full sm:w-auto">
        <a
          v-if="defaultRicochetMeta"
          :href="`/warehouse/sync/${encodeURIComponent(defaultRicochetMeta.code)}`"
          class="btn btn-outline btn-secondary h-11 md:h-9 btn-sm gap-1.5 font-bold rounded-xl flex-1 sm:flex-initial"
        >
          <Icon icon="solar:round-transfer-horizontal-bold-duotone" class="w-4 h-4 shrink-0" />
          <span>Open {{ defaultRicochetMeta.shortName }} POS Sync</span>
        </a>
        <button
          type="button"
          class="btn btn-primary text-primary-content h-11 md:h-9 btn-sm gap-1.5 font-black rounded-xl shadow-xs flex-1 sm:flex-initial"
          @click="openEditor()"
        >
          <Icon icon="solar:add-circle-bold" class="w-4 h-4 shrink-0" />
          <span>Add Location</span>
        </button>
      </div>
    </div>

    <!-- Canonical 4-Column KPI Summary -->
    <KpiStatGrid :items="locationKpiStats" :columns="4" />

    <!-- Loading Skeletons -->
    <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="skeleton h-52 w-full rounded-2xl"></div>
      <div class="skeleton h-52 w-full rounded-2xl"></div>
    </div>

    <!-- Error State with 1-Click Retry (Krug #6 Reservoir of Goodwill) -->
    <div v-else-if="error" role="alert" class="alert alert-error rounded-2xl flex items-center justify-between gap-3 text-xs sm:text-sm">
      <div class="flex items-center gap-2">
        <Icon icon="solar:danger-circle-bold" class="w-5 h-5 shrink-0" />
        <span>{{ error }}</span>
      </div>
      <button type="button" class="btn btn-sm h-11 md:h-8 btn-outline rounded-xl font-bold" @click="fetchWarehouses">
        Retry Load
      </button>
    </div>

    <!-- Empty State -->
    <div v-else-if="warehouses.length === 0" class="card bg-base-100 border border-dashed border-base-300 rounded-2xl p-8 text-center space-y-3">
      <div class="text-base font-black text-base-content">No Booths or Storage Locations Configured</div>
      <p class="text-xs text-base-content/70">Add your first selling booth or backstock storage space to track stock and payouts.</p>
      <div>
        <button type="button" class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content rounded-xl font-black" @click="openEditor()">
          Add First Location
        </button>
      </div>
    </div>

    <template v-else>
      <!-- SECTION 1: 🏪 SELLING BOOTHS -->
      <section v-if="sellingBoothWarehouses.length > 0" class="space-y-3">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <h2 class="text-lg font-black tracking-tight text-base-content flex items-center gap-2">
            <span>🏪 Selling Booths</span>
            <span class="badge badge-sm badge-secondary text-secondary-content font-mono font-bold whitespace-nowrap shrink-0">
              {{ sellingBoothWarehouses.length }} Active
            </span>
          </h2>
          <span class="text-xs text-base-content/65">Retail venues with shelf tags, commissions, outbound drops &amp; payout sync</span>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          <article
            v-for="warehouse in sellingBoothWarehouses"
            :key="warehouse.$id"
            class="card bg-base-100 border border-base-300 hover:border-primary/40 rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col justify-between gap-4 transition-all"
          >
            <div class="space-y-3">
              <div class="flex items-start justify-between gap-2">
                <div class="space-y-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <a
                      :href="'/warehouse/' + (warehouse.code || warehouse.$id)"
                      class="text-base sm:text-lg font-black leading-snug text-base-content hover:text-primary transition-colors flex items-center gap-1.5"
                    >
                      <span>{{ getMeta(warehouse).icon }} {{ warehouse.name }}</span>
                    </a>
                    <span v-if="warehouse.code" class="badge badge-sm badge-primary text-primary-content font-mono font-black whitespace-nowrap shrink-0">
                      {{ warehouse.code }}
                    </span>
                  </div>
                  <div class="flex items-center gap-2 flex-wrap text-xs font-mono text-base-content/75">
                    <span class="badge badge-xs badge-ghost border border-base-300 font-bold whitespace-nowrap shrink-0">
                      {{ getMeta(warehouse).feePct }}% Venue Fee
                    </span>
                    <span class="badge badge-xs badge-ghost border border-base-300 font-bold whitespace-nowrap shrink-0">
                      ${{ Number(getMeta(warehouse).monthlyRent || 0).toFixed(2) }}/mo Rent
                    </span>
                    <span
                      v-if="getActiveDraftForWarehouse(warehouse)"
                      class="badge badge-xs badge-warning text-warning-content font-bold whitespace-nowrap shrink-0"
                    >
                      📦 Drop Active
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  class="btn btn-ghost btn-xs h-11 w-11 md:h-8 md:w-8 btn-circle shrink-0"
                  title="Edit Booth Settings"
                  aria-label="Edit Booth Settings"
                  @click="openEditor(warehouse)"
                >
                  <Icon icon="solar:pen-bold" class="w-4 h-4" />
                </button>
              </div>

              <!-- Live Booth Shelf Telemetry -->
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="rounded-xl bg-base-200/60 border border-base-300 px-3 py-2">
                  <div class="text-[10px] uppercase font-bold opacity-65">Shelf Stock</div>
                  <div class="font-mono font-black text-sm text-primary">
                    {{ getItemsForWarehouse(warehouse).length }} items
                    <span class="text-xs font-semibold text-base-content/70">
                      ({{ formatCurrency(getItemsTotalValue(warehouse)) }})
                    </span>
                  </div>
                </div>
                <div class="rounded-xl bg-base-200/60 border border-base-300 px-3 py-2">
                  <div class="text-[10px] uppercase font-bold opacity-65">
                    {{ warehouseUsesRicochet(warehouse) ? 'POS Tag Status' : 'Sales Intake' }}
                  </div>
                  <div v-if="warehouseUsesRicochet(warehouse)" class="font-mono font-black text-sm text-success">
                    {{ getSyncedItemsCount(warehouse) }} Tagged
                    <span v-if="getPendingExportCount(warehouse) > 0" class="text-xs font-semibold text-warning">
                      • {{ getPendingExportCount(warehouse) }} untagged
                    </span>
                  </div>
                  <div v-else class="font-bold text-xs sm:text-sm text-base-content pt-0.5">
                    {{ getMeta(warehouse).posName }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Unambiguous Verb + Object Booth Actions (Krug #2) -->
            <div class="space-y-2 pt-3 border-t border-base-200">
              <div class="grid grid-cols-1 gap-2" :class="warehouseUsesRicochet(warehouse) ? 'sm:grid-cols-3' : 'sm:grid-cols-2'">
                <a
                  :href="'/warehouse/' + (warehouse.code || warehouse.$id)"
                  class="btn btn-sm h-11 md:h-9 btn-outline btn-primary gap-1.5 font-extrabold rounded-xl"
                >
                  <Icon icon="solar:shop-2-bold" class="w-4 h-4 shrink-0" />
                  <span>Open Booth Cockpit</span>
                </a>

                <a
                  v-if="warehouseUsesRicochet(warehouse)"
                  :href="'/warehouse/sync/' + encodeURIComponent(resolveCanonicalLocationCode(warehouse) || warehouse.code || defaultRicochetMeta.code)"
                  class="btn btn-sm h-11 md:h-9 btn-outline btn-secondary gap-1.5 font-bold rounded-xl"
                >
                  <Icon icon="solar:round-transfer-horizontal-bold-duotone" class="w-4 h-4 shrink-0" />
                  <span>POS &amp; Barcode Sync</span>
                </a>

                <a
                  :href="'/sales/import/' + encodeURIComponent(resolveCanonicalLocationCode(warehouse) || warehouse.code || defaultRicochetMeta.code)"
                  class="btn btn-sm h-11 md:h-9 btn-outline gap-1.5 font-bold rounded-xl"
                >
                  <Icon icon="solar:import-bold-duotone" class="w-4 h-4 shrink-0 text-success" />
                  <span>Import Booth Sales</span>
                </a>
              </div>

              <div class="flex items-center justify-between gap-2 pt-0.5 text-xs flex-wrap">
                <a
                  :href="'/inventory?location=' + encodeURIComponent(warehouse.code || warehouse.name)"
                  class="font-bold text-primary hover:underline inline-flex items-center gap-1 min-h-11 md:min-h-7"
                >
                  <Icon icon="solar:box-minimalistic-linear" class="w-3.5 h-3.5" />
                  <span>Browse Booth Items ({{ getItemsForWarehouse(warehouse).length }})</span>
                </a>
                <button
                  type="button"
                  class="btn btn-xs h-11 md:h-7 btn-ghost text-error hover:bg-error/10 rounded-lg font-bold"
                  @click="confirmDelete(warehouse)"
                >
                  Delete Booth
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>

      <!-- SECTION 2: 📦 BACKSTOCK STORAGE (Zero POS Sync Clutter — Honest Reseller IA) -->
      <section v-if="backstockStorageWarehouses.length > 0" class="space-y-3 pt-2">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <h2 class="text-lg font-black tracking-tight text-base-content flex items-center gap-2">
            <span>📦 Backstock Storage</span>
            <span class="badge badge-sm badge-neutral text-neutral-content font-mono font-bold whitespace-nowrap shrink-0">
              {{ backstockStorageWarehouses.length }} Facilities
            </span>
          </h2>
          <span class="text-xs text-base-content/65">Unplaced haul intake, staging shelves &amp; Shared Online Ready bins ($0 rent / 0% fee)</span>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          <article
            v-for="warehouse in backstockStorageWarehouses"
            :key="warehouse.$id"
            class="card bg-base-100 border border-base-300 hover:border-primary/40 rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col justify-between gap-4 transition-all"
          >
            <div class="space-y-3">
              <div class="flex items-start justify-between gap-2">
                <div class="space-y-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <a
                      :href="'/warehouse/' + (warehouse.code || warehouse.$id)"
                      class="text-base sm:text-lg font-black leading-snug text-base-content hover:text-primary transition-colors flex items-center gap-1.5"
                    >
                      <span>{{ getMeta(warehouse).icon }} {{ warehouse.name }}</span>
                    </a>
                    <span v-if="warehouse.code" class="badge badge-sm badge-neutral text-neutral-content font-mono font-black whitespace-nowrap shrink-0">
                      {{ warehouse.code }}
                    </span>
                    <span
                      v-if="isWarehouseDefault(warehouse)"
                      class="badge badge-sm badge-warning text-warning-content font-bold whitespace-nowrap shrink-0 gap-1"
                      title="Default Intake Backstock Location for new purchases"
                    >
                      <Icon icon="solar:star-bold" class="w-3 h-3 shrink-0" />
                      <span>Default Intake</span>
                    </span>
                  </div>
                  <p class="text-xs text-base-content/70">{{ getMeta(warehouse).subtitle }}</p>
                </div>

                <button
                  type="button"
                  class="btn btn-ghost btn-xs h-11 w-11 md:h-8 md:w-8 btn-circle shrink-0"
                  title="Edit Storage Settings"
                  aria-label="Edit Storage Settings"
                  @click="openEditor(warehouse)"
                >
                  <Icon icon="solar:pen-bold" class="w-4 h-4" />
                </button>
              </div>

              <!-- Live Storage & Online Ready Telemetry -->
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="rounded-xl bg-base-200/60 border border-base-300 px-3 py-2">
                  <div class="text-[10px] uppercase font-bold opacity-65">Stored Stock</div>
                  <div class="font-mono font-black text-sm text-base-content">
                    {{ getItemsForWarehouse(warehouse).length }} items
                    <span class="text-xs font-semibold text-base-content/70">
                      ({{ formatCurrency(getItemsTotalValue(warehouse)) }})
                    </span>
                  </div>
                </div>
                <div class="rounded-xl bg-base-200/60 border border-base-300 px-3 py-2">
                  <div class="text-[10px] uppercase font-bold opacity-65">🌐 Online Ready Bin</div>
                  <div class="font-mono font-black text-sm text-info">
                    {{ getOnlineReadyCount(warehouse) }} staged
                  </div>
                </div>
              </div>
            </div>

            <!-- Unambiguous Storage Actions (No POS Sync / Sales Importer Noise!) -->
            <div class="space-y-2 pt-3 border-t border-base-200">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <a
                  :href="'/inventory?location=' + encodeURIComponent(warehouse.code || warehouse.name)"
                  class="btn btn-sm h-11 md:h-9 btn-outline btn-primary gap-1.5 font-extrabold rounded-xl"
                >
                  <Icon icon="solar:box-bold-duotone" class="w-4 h-4 shrink-0" />
                  <span>Browse Stored Items</span>
                </a>
                <a
                  :href="'/warehouse/' + (warehouse.code || warehouse.$id)"
                  class="btn btn-sm h-11 md:h-9 btn-outline gap-1.5 font-bold rounded-xl"
                >
                  <Icon icon="solar:buildings-2-bold-duotone" class="w-4 h-4 shrink-0" />
                  <span>Open Storage Details</span>
                </a>
              </div>

              <div class="flex items-center justify-between gap-2 pt-0.5 text-xs flex-wrap">
                <button
                  v-if="!isWarehouseDefault(warehouse)"
                  type="button"
                  class="btn btn-xs h-11 md:h-7 btn-ghost gap-1 font-bold text-base-content/80 hover:text-warning rounded-lg"
                  @click="setAsDefaultBackstock(warehouse)"
                >
                  <Icon icon="solar:star-linear" class="w-3.5 h-3.5 text-warning" />
                  <span>Set as Default Intake</span>
                </button>
                <span v-else class="text-[11px] font-semibold text-base-content/60">Receives new unplaced hauls by default</span>

                <button
                  type="button"
                  class="btn btn-xs h-11 md:h-7 btn-ghost text-error hover:bg-error/10 rounded-lg font-bold"
                  @click="confirmDelete(warehouse)"
                >
                  Delete Storage
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>
    </template>

    <!-- Canonical Slide-Over Drawer for Creating / Editing a Booth or Storage Facility (Jakob's Law) -->
    <SlideOverDrawer
      v-model="editorOpen"
      :title="isEditing ? 'Edit Booth or Storage' : 'Add Booth or Storage'"
      subtitle="Configure venue type, commission, monthly rent, and AI Scout niche rules."
    >
      <form id="rc-warehouse-editor-form" class="space-y-5" @submit.prevent="saveWarehouse">
        <div class="grid grid-cols-3 gap-3">
          <div class="col-span-2 flex flex-col gap-1">
            <label for="wh-name" class="text-xs font-bold text-base-content/80">Location Name</label>
            <input
              id="wh-name"
              v-model="editForm.name"
              type="text"
              required
              placeholder="e.g. Memory Den"
              class="input input-bordered h-11 md:h-9 w-full rounded-xl bg-base-100 text-sm font-semibold"
            />
          </div>
          <div class="col-span-1 flex flex-col gap-1">
            <label for="wh-code" class="text-xs font-bold text-base-content/80">Code</label>
            <input
              id="wh-code"
              v-model="editForm.code"
              type="text"
              maxlength="6"
              placeholder="MD"
              class="input input-bordered h-11 md:h-9 w-full rounded-xl bg-base-100 font-mono font-bold uppercase text-sm"
            />
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <label for="wh-type" class="text-xs font-bold text-base-content/80">Facility Role</label>
          <select
            id="wh-type"
            v-model="editForm.type"
            required
            class="select select-bordered h-11 md:h-9 w-full rounded-xl bg-base-100 text-sm font-semibold"
          >
            <option value="Consignment Booth">🏪 Selling Booth (Consignment / Retail)</option>
            <option value="On-Site">🏪 On-Site Retail Booth</option>
            <option value="Warehouse">📦 Backstock Storage (Garage / Hideout)</option>
          </select>
        </div>

        <!-- Commission & Rent (Postel's Law: text + inputmode="decimal" parsed via parsePriceValue) -->
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <label for="wh-fee" class="text-xs font-bold text-base-content/80">Commission Rate (%)</label>
            <input
              id="wh-fee"
              v-model="commissionInput"
              type="text"
              inputmode="decimal"
              placeholder="0"
              class="input input-bordered h-11 md:h-9 w-full rounded-xl bg-base-100 font-mono font-bold text-sm"
            />
          </div>
          <div class="flex flex-col gap-1">
            <label for="wh-rent" class="text-xs font-bold text-base-content/80">Monthly Rent ($)</label>
            <input
              id="wh-rent"
              v-model="rentInput"
              type="text"
              inputmode="decimal"
              placeholder="0.00"
              class="input input-bordered h-11 md:h-9 w-full rounded-xl bg-base-100 font-mono font-bold text-sm"
            />
          </div>
        </div>

        <!-- Niche Guidelines Textarea -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label for="wh-rules" class="text-xs font-bold text-base-content/80">
              Niche &amp; Sourcing Guidelines (Exclusions &amp; Rules)
            </label>
            <span class="text-[10px] opacity-60 font-mono">Used by AI Scout</span>
          </div>
          <textarea
            id="wh-rules"
            v-model="editForm.categories"
            rows="3"
            class="textarea textarea-bordered w-full rounded-xl bg-base-100 text-xs leading-relaxed"
            placeholder="e.g. Small Collectibles, Vintage Jewelry, Pins, Wands. NO Clothes, Under 8 inches only"
          ></textarea>
          <div class="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span class="text-[10px] font-bold uppercase opacity-55">Quick Exclusions:</span>
            <button
              type="button"
              class="btn btn-2xs h-11 md:h-7 btn-outline rounded-lg font-bold"
              @click="appendRuleToTextarea('NO Clothes')"
            >
              ⛔ NO Clothes
            </button>
            <button
              type="button"
              class="btn btn-2xs h-11 md:h-7 btn-outline rounded-lg font-bold"
              @click="appendRuleToTextarea('NO Large Toys')"
            >
              ⛔ NO Large Toys
            </button>
            <button
              type="button"
              class="btn btn-2xs h-11 md:h-7 btn-outline rounded-lg font-bold"
              @click="appendRuleToTextarea('Under 8 inches only')"
            >
              📏 Under 8" Only
            </button>
          </div>
        </div>

        <!-- Watch Tags -->
        <div class="rounded-2xl bg-base-200/50 border border-base-300 p-3.5 space-y-2.5">
          <div class="flex items-center justify-between">
            <label for="wh-watch-tag" class="text-xs font-bold text-base-content/85">Tags &amp; Brands to Watch</label>
            <span class="badge badge-xs badge-secondary text-secondary-content font-mono font-bold whitespace-nowrap shrink-0">
              {{ watchTags.length }} active
            </span>
          </div>

          <div v-if="watchTags.length > 0" class="flex flex-wrap gap-1.5">
            <span
              v-for="(tag, idx) in watchTags"
              :key="tag"
              class="badge badge-sm badge-secondary text-secondary-content font-bold gap-1 whitespace-nowrap shrink-0"
            >
              <span>{{ tag }}</span>
              <button
                type="button"
                aria-label="Remove watch tag"
                class="hover:opacity-75 font-black ml-0.5"
                @click="removeWatchTag(idx)"
              >
                ✕
              </button>
            </span>
          </div>

          <div class="join w-full">
            <input
              id="wh-watch-tag"
              v-model="newWatchTag"
              type="text"
              placeholder="Add tag or brand (e.g. Sterling 925, Star Trek)"
              class="input input-bordered input-sm h-11 md:h-9 join-item flex-1 bg-base-100 text-xs font-semibold"
              @keydown.enter.prevent="addWatchTag()"
            />
            <button
              type="button"
              :disabled="!newWatchTag.trim()"
              class="btn btn-sm h-11 md:h-9 join-item btn-outline font-bold"
              @click="addWatchTag()"
            >
              Add Tag
            </button>
          </div>
        </div>
      </form>

      <template #footer>
        <div class="flex items-center justify-end gap-2">
          <button type="button" class="btn btn-sm h-11 md:h-9 btn-ghost rounded-xl font-bold" @click="closeEditor">
            Cancel
          </button>
          <button
            type="submit"
            form="rc-warehouse-editor-form"
            :disabled="saving || !editForm.name.trim()"
            class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content rounded-xl font-black px-4 shadow-xs"
          >
            <span v-if="saving" class="loading loading-spinner loading-xs"></span>
            <span>{{ isEditing ? 'Save Location Changes' : 'Create Location' }}</span>
          </button>
        </div>
      </template>
    </SlideOverDrawer>

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
import KpiStatGrid, { type KpiStatItem } from '../common/KpiStatGrid.vue';
import SlideOverDrawer from '../common/SlideOverDrawer.vue';
import LocationManifestTray from '../inventory/LocationManifestTray.vue';
import { useAuth } from '../../composables/useAuth';
import { useInventory } from '../../composables/useInventory';
import { useManifest } from '../../composables/useManifest';
import { parsePriceValue } from '../../lib/lot-strategy';
import { manifestsApi, type ManifestDocument } from '../../lib/manifests';
import { hasOnlineReadyTag } from '../../lib/onlineCoCuration';
import { toUserMessage } from '../../lib/userFacingErrors';
import {
  warehousesApi,
  matchesLocationFilter,
  getDefaultStorageLocation,
  resolveCanonicalLocationCode,
  resolveDefaultRicochetLocationMeta,
  getLocationSettingMeta,
  isStorageFacility,
  isRetailBoothFacility,
  type WarehouseDocument,
  type WarehouseData,
} from '../../lib/warehouses';
import { confirmDialog } from '../../stores/confirm';
import { addToast } from '../../stores/toast';

const { currentTeam: team, user, updateTeamPrefs, updatePrefs } = useAuth();
const { inventoryItems, fetchInventory } = useInventory();
const { isTrayOpen: isManifestTrayOpen } = useManifest();

const allManifests = ref<ManifestDocument[]>([]);
const warehouses = ref<WarehouseDocument[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const isEditing = ref(false);
const editorOpen = ref(false);
const activeWarehouse = ref<WarehouseDocument | null>(null);
const activeWarehouseForTray = ref<WarehouseDocument | null>(null);

const commissionInput = ref('0');
const rentInput = ref('0.00');
const watchTags = ref<string[]>([]);
const newWatchTag = ref('');

const editForm = ref<WarehouseData>({
  name: '',
  code: '',
  type: 'Consignment Booth',
  categories: '',
  niche: '',
  commissionRate: 0,
  monthlyRent: 0,
  tenantId: '',
});

const defaultStorageLocation = computed(() =>
  getDefaultStorageLocation(team.value || user.value)
);

const defaultRicochetMeta = computed(() =>
  resolveDefaultRicochetLocationMeta(warehouses.value)
);

const getMeta = (warehouse: WarehouseDocument) =>
  getLocationSettingMeta(warehouse, warehouses.value);

const warehouseUsesRicochet = (warehouse: WarehouseDocument): boolean =>
  getMeta(warehouse).usesRicochet;

const sellingBoothWarehouses = computed(() =>
  warehouses.value.filter((w) => isRetailBoothFacility(w, warehouses.value))
);

const backstockStorageWarehouses = computed(() =>
  warehouses.value.filter((w) => isStorageFacility(w, warehouses.value))
);

const isWarehouseDefault = (warehouse: WarehouseDocument) => {
  const def = defaultStorageLocation.value.toUpperCase();
  const code = (warehouse.code || '').trim().toUpperCase();
  const name = (warehouse.name || '').trim().toUpperCase();
  return Boolean((code && def === code) || (name && def === name));
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

const getItemsForWarehouse = (warehouse: WarehouseDocument) => {
  const query = warehouse.code || warehouse.name;
  return inventoryItems.value.filter(
    (item) => matchesLocationFilter(item, query) && item.status !== 'sold'
  );
};

const getOnlineReadyCount = (warehouse: WarehouseDocument) =>
  getItemsForWarehouse(warehouse).filter((item) => hasOnlineReadyTag(item)).length;

const getItemsTotalValue = (warehouse: WarehouseDocument) =>
  getItemsForWarehouse(warehouse).reduce((acc, i) => {
    const unitPrice = Number(i.resalePrice || i.listPrice || i.estValue || 0);
    const qty = Math.max(1, Number(i.quantity) || 1);
    return acc + unitPrice * qty;
  }, 0);

const isItemSynced = (item: any) =>
  Boolean(
    item.locationSku ||
      item.ricochetSynced === true ||
      (Array.isArray(item.sellingLocations) &&
        item.sellingLocations.some((l: string) => /ricochet/i.test(l)))
  );

const getSyncedItemsCount = (warehouse: WarehouseDocument) =>
  getItemsForWarehouse(warehouse).filter(isItemSynced).length;

const getPendingExportCount = (warehouse: WarehouseDocument) =>
  getItemsForWarehouse(warehouse).filter((i) => !isItemSynced(i)).length;

function getManifestsForWarehouse(warehouse: WarehouseDocument) {
  const code = (warehouse.code || '').toLowerCase();
  const name = (warehouse.name || '').toLowerCase();
  return allManifests.value.filter((m) => {
    const locId = (m.locationId || '').toLowerCase();
    const locName = (m.locationName || '').toLowerCase();
    return locId === code || locName === name;
  });
}

function getActiveDraftForWarehouse(warehouse: WarehouseDocument) {
  return (
    getManifestsForWarehouse(warehouse).find(
      (m) => m.status === 'draft' || m.status === 'paused'
    ) || null
  );
}

const totalBoothItems = computed(() =>
  sellingBoothWarehouses.value.reduce((acc, w) => acc + getItemsForWarehouse(w).length, 0)
);
const totalBoothValue = computed(() =>
  sellingBoothWarehouses.value.reduce((acc, w) => acc + getItemsTotalValue(w), 0)
);
const totalBackstockItems = computed(() =>
  backstockStorageWarehouses.value.reduce((acc, w) => acc + getItemsForWarehouse(w).length, 0)
);
const totalOnlineReadyItems = computed(() =>
  backstockStorageWarehouses.value.reduce((acc, w) => acc + getOnlineReadyCount(w), 0)
);
const totalActiveDrops = computed(
  () => sellingBoothWarehouses.value.filter((w) => getActiveDraftForWarehouse(w)).length
);

const locationKpiStats = computed<KpiStatItem[]>(() => [
  {
    label: 'Selling Booth Stock',
    value: `$${totalBoothValue.value.toFixed(0)}`,
    hint: `${totalBoothItems.value} items across ${sellingBoothWarehouses.value.length} booth(s)`,
    icon: 'solar:shop-2-bold-duotone',
    tone: 'text-primary',
  },
  {
    label: 'Backstock Storage',
    value: `${totalBackstockItems.value}`,
    hint: `Stored across ${backstockStorageWarehouses.value.length} storage space(s)`,
    icon: 'solar:box-minimalistic-bold-duotone',
    tone: 'text-secondary',
  },
  {
    label: 'Online Ready Bin',
    value: `${totalOnlineReadyItems.value}`,
    hint: 'Staged for eBay, Depop & Whatnot',
    icon: 'solar:globus-bold-duotone',
    tone: 'text-info',
  },
  {
    label: 'Active Booth Drops',
    value: `${totalActiveDrops.value}`,
    hint: totalActiveDrops.value > 0 ? 'Outbound tote(s) in progress' : 'No active outbound totes',
    badge: totalActiveDrops.value > 0 ? 'Active' : 'Clear',
    badgeClass:
      totalActiveDrops.value > 0
        ? 'badge-warning text-warning-content'
        : 'badge-success text-success-content',
  },
]);

const setAsDefaultBackstock = async (warehouse: WarehouseDocument) => {
  const targetCode = (warehouse.code || warehouse.name || '').trim().toUpperCase();
  if (!targetCode) return;
  try {
    if (team.value?.$id) {
      await updateTeamPrefs(team.value.$id, {
        ...(team.value.prefs || {}),
        defaultStorageLocation: targetCode,
      });
    } else if (user.value) {
      await updatePrefs({
        ...(user.value.prefs || {}),
        defaultStorageLocation: targetCode,
      });
    }
    addToast({
      message: `Set ${warehouse.name} (${targetCode}) as default intake backstock!`,
      type: 'success',
    });
  } catch (err: any) {
    addToast({
      message: toUserMessage(err, 'Could not update default intake location — please try again.'),
      type: 'error',
    });
  }
};

const fetchWarehouses = async () => {
  if (!team.value) return;
  loading.value = true;
  error.value = '';
  try {
    warehouses.value = await warehousesApi.listWarehouses(team.value.$id);
    await fetchInventory(team.value.$id);
  } catch (err: any) {
    console.error('[WarehouseManager] Error fetching locations:', err);
    error.value = toUserMessage(err, "Couldn't load booths and storage — tap Retry Load.");
  } finally {
    loading.value = false;
  }
};

const loadManifests = async () => {
  const tId = team.value?.$id;
  if (!tId) return;
  try {
    allManifests.value = await manifestsApi.listManifests(tId);
  } catch (e) {
    console.warn('[WarehouseManager] Could not load manifests:', e);
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
      .map((t) => t.trim())
      .filter(Boolean);
    return { rules, tags };
  }
  return { rules: raw, tags: [] as string[] };
};

const addWatchTag = (tag?: string) => {
  const val = (tag || newWatchTag.value || '').trim();
  if (!val) return;
  const parts = val
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  for (const part of parts) {
    if (!watchTags.value.some((t) => t.toLowerCase() === part.toLowerCase())) {
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
    const meta = getMeta(warehouse);
    const parsed = parseNicheAndWatchTags(warehouse.categories || (warehouse as any).niche || '');
    editForm.value = {
      name: warehouse.name,
      code: warehouse.code || '',
      type: warehouse.type || 'Consignment Booth',
      categories: parsed.rules,
      commissionRate: meta.commissionRate,
      monthlyRent: meta.monthlyRent,
      tenantId: team.value?.$id || '',
    };
    commissionInput.value = String(meta.commissionRate ?? 0);
    rentInput.value = Number(meta.monthlyRent ?? 0).toFixed(2);
    watchTags.value = parsed.tags;
  } else {
    isEditing.value = false;
    activeWarehouse.value = null;
    editForm.value = {
      name: '',
      code: '',
      type: 'Consignment Booth',
      categories: '',
      commissionRate: 0,
      monthlyRent: 0,
      tenantId: team.value?.$id || '',
    };
    commissionInput.value = '0';
    rentInput.value = '0.00';
    watchTags.value = [];
  }
  editorOpen.value = true;
};

const closeEditor = () => {
  editorOpen.value = false;
  activeWarehouse.value = null;
};

const saveWarehouse = async () => {
  if (!team.value) return;
  saving.value = true;
  try {
    let finalCategories = (editForm.value.categories || '').trim();
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
      commissionRate: Math.min(100, Math.max(0, parsePriceValue(commissionInput.value))),
      monthlyRent: Math.max(0, parsePriceValue(rentInput.value)),
      tenantId: team.value.$id,
    };

    if (isEditing.value && activeWarehouse.value?.$id) {
      await warehousesApi.updateWarehouse(activeWarehouse.value.$id, payload);
      addToast({ type: 'success', message: '✅ Saved location updates!' });
    } else {
      const created = await warehousesApi.createWarehouse(payload);
      addToast({ type: 'success', message: '✅ Created new location!' });
      closeEditor();
      window.location.href = `/warehouse/${created.code || created.$id}`;
      return;
    }
    closeEditor();
    await fetchWarehouses();
  } catch (err: any) {
    console.error('[WarehouseManager] Save failed:', err);
    addToast({
      type: 'error',
      message: toUserMessage(err, "Couldn't save location changes — please try again."),
    });
  } finally {
    saving.value = false;
  }
};

const confirmDelete = async (warehouse: WarehouseDocument) => {
  const ok = await confirmDialog(
    `Remove "${warehouse.name}"? Existing inventory items will keep their current location tag until reassigned.`,
    `Delete ${warehouse.name}?`,
    'Delete Location',
    'Keep Location',
    'btn-error'
  );
  if (!ok) return;
  try {
    await warehousesApi.deleteWarehouse(warehouse.$id);
    await fetchWarehouses();
    addToast({ type: 'info', message: `Deleted ${warehouse.name}.` });
  } catch (err: any) {
    console.error('[WarehouseManager] Delete failed:', err);
    addToast({
      type: 'error',
      message: toUserMessage(err, "Couldn't delete location — please try again."),
    });
  }
};

onMounted(() => {
  if (team.value) {
    void fetchWarehouses();
    void loadManifests();
  }
});

watch(team, (newTeam) => {
  if (newTeam) {
    void fetchWarehouses();
    void loadManifests();
  } else {
    warehouses.value = [];
    allManifests.value = [];
  }
});
</script>

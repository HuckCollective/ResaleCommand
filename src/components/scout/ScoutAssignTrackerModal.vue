<template>
  <dialog class="modal modal-bottom sm:modal-middle" :class="{ 'modal-open': isOpen }">
    <div class="modal-box bg-base-100 border border-base-300 p-5 sm:p-6 rounded-3xl max-w-lg shadow-2xl space-y-4">
      
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-base-200">
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon icon="lucide:truck" class="w-6 h-6" />
          </div>
          <div>
            <h3 class="font-black text-base sm:text-lg text-base-content">
              Where would you like to save this?
            </h3>
            <p class="text-xs text-base-content/60">
              Bundle into a Buy Tracker deal or save directly to inventory.
            </p>
          </div>
        </div>
        <button type="button" @click="$emit('close')" class="btn btn-sm btn-circle btn-ghost">✕</button>
      </div>

      <!-- Option 1: Existing Active Buy Trackers -->
      <div v-if="draftPurchases.length > 0" class="space-y-2">
        <label class="text-[11px] uppercase font-bold tracking-wider opacity-60 flex items-center gap-1">
          <Icon icon="solar:folder-with-files-bold" class="w-3.5 h-3.5 text-primary" />
          Add to Open Buy Tracker
        </label>
        
        <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
          <button
            v-for="purchase in draftPurchases"
            :key="purchase.$id"
            type="button"
            @click="$emit('select-tracker', purchase)"
            class="w-full text-left p-3 rounded-2xl border border-base-300 hover:border-primary/60 bg-base-200/50 hover:bg-primary/5 transition-all flex items-center justify-between group active:scale-98"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-8 h-8 rounded-xl bg-base-300/80 group-hover:bg-primary/20 text-primary flex items-center justify-center shrink-0">
                <Icon icon="lucide:truck" class="w-4 h-4" />
              </div>
              <div class="min-w-0">
                <div class="font-bold text-xs sm:text-sm text-base-content truncate group-hover:text-primary">
                  {{ purchase.vendor || 'Untitled Tracker' }}
                </div>
                <div class="text-[10px] font-mono opacity-60">
                  {{ purchase.poNumber || purchase.orderId || 'Draft' }} • {{ formatDate(purchase.purchaseDate) }}
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <span class="badge badge-sm badge-primary/15 text-primary font-bold text-[10px]">
                Add Here →
              </span>
            </div>
          </button>
        </div>
      </div>

      <!-- Option 2: Start a New Buy Tracker on-the-fly -->
      <div class="space-y-2.5 pt-1">
        <label class="text-[11px] uppercase font-bold tracking-wider opacity-60 flex items-center gap-1">
          <Icon icon="solar:add-circle-bold" class="w-3.5 h-3.5 text-secondary" />
          Or Start a New Buy Tracker
        </label>

        <!-- Quick Preset Chips -->
        <div class="flex flex-wrap gap-1.5">
          <button 
            v-for="preset in presets" 
            :key="preset.name"
            type="button"
            @click="newVendorName = preset.name"
            class="btn btn-xs rounded-full font-bold transition-all"
            :class="newVendorName === preset.name ? 'btn-secondary text-secondary-content shadow-xs' : 'btn-outline border-base-300 hover:border-secondary'"
          >
            <span>{{ preset.icon }}</span>
            <span>{{ preset.name }}</span>
          </button>
        </div>

        <div class="join w-full">
          <input 
            type="text" 
            v-model="newVendorName" 
            placeholder="e.g. Goodwill - Main St, Estate Sale..." 
            class="input input-sm input-bordered join-item grow text-xs font-semibold"
            @keydown.enter.prevent="handleCreateNew"
          />
          <button 
            type="button" 
            class="btn btn-sm btn-secondary join-item font-bold text-xs px-3"
            :disabled="!newVendorName.trim() || creating"
            @click="handleCreateNew"
          >
            <span v-if="creating" class="loading loading-spinner loading-xs"></span>
            <span v-else>Create & Add</span>
          </button>
        </div>
      </div>

      <div class="divider my-1 text-[11px] opacity-40">OR</div>

      <!-- Option 3: Save Direct to Inventory (No Tracker) -->
      <div>
        <button
          type="button"
          @click="$emit('save-standalone')"
          class="btn btn-sm btn-outline border-base-300 hover:border-accent hover:bg-accent/5 w-full text-xs font-bold gap-2 rounded-xl h-10"
        >
          <Icon icon="solar:box-minimalistic-bold" class="w-4 h-4 text-accent" />
          <span>Save Directly to Inventory (Standalone Item)</span>
        </button>
        <p class="text-[10px] text-center opacity-50 mt-1">
          Saves as an unbundled inventory item without creating a Purchase Order trip.
        </p>
      </div>

    </div>

    <form method="dialog" class="modal-backdrop" @click="$emit('close')">
      <button>close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Icon } from '@iconify/vue';
import type { ScoutPurchase } from '../../composables/useScoutPurchase';

const props = defineProps<{
  isOpen: boolean;
  draftPurchases: ScoutPurchase[];
  creating?: boolean;
}>();

const emit = defineEmits<{
  (e: 'select-tracker', purchase: ScoutPurchase): void;
  (e: 'create-tracker', vendorName: string): void;
  (e: 'save-standalone'): void;
  (e: 'close'): void;
}>();

const newVendorName = ref('');

const presets = [
  { name: 'Goodwill', icon: '🏪' },
  { name: 'Yard Sale', icon: '🏡' },
  { name: 'Estate Sale', icon: '🏷️' },
  { name: 'Flea Market', icon: '🎪' },
  { name: 'Facebook MP', icon: '💬' },
  { name: 'Thrift Store', icon: '🛍️' }
];

const handleCreateNew = () => {
  const name = newVendorName.value.trim();
  if (!name) return;
  emit('create-tracker', name);
  newVendorName.value = '';
};

const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return 'Recent';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 'Recent' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Recent';
  }
};
</script>

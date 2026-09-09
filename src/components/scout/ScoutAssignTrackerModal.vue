<template>
  <div v-if="isOpen" class="relative z-[80]">
    <!-- Bottom Sheet Backdrop -->
    <div 
      class="fixed inset-0 z-[80] bg-black/60 backdrop-blur-xs flex flex-col justify-end transition-opacity"
      @click.self="$emit('close')"
    >
      <div class="bg-base-100 border-t border-base-300 rounded-t-3xl max-w-2xl mx-auto w-full max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200 overflow-hidden">
        
        <!-- Header -->
        <div class="p-4 sm:p-5 border-b border-base-300 flex items-center justify-between gap-3 shrink-0">
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Icon icon="lucide:truck" class="w-6 h-6" />
            </div>
            <div>
              <h3 class="font-black text-base sm:text-lg text-base-content leading-snug">
                Where would you like to save this?
              </h3>
              <p class="text-xs text-base-content/60">
                Bundle into a Buy Tracker deal or save direct to inventory.
              </p>
            </div>
          </div>
          <button type="button" @click="$emit('close')" class="btn btn-sm btn-circle btn-ghost shrink-0" title="Close">✕</button>
        </div>

        <!-- Scrollable Content Area -->
        <div class="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          <!-- Option 1: Existing Active Buy Trackers -->
          <div v-if="sortedDraftTrackers.length > 0" class="space-y-2">
            <label class="text-[11px] uppercase font-bold tracking-wider opacity-60 flex items-center gap-1">
              <Icon icon="solar:folder-with-files-bold" class="w-3.5 h-3.5 text-primary" />
              Add to Open Buy Tracker
            </label>
            
            <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
              <button
                v-for="purchase in sortedDraftTrackers"
                :key="purchase.$id"
                type="button"
                @click="$emit('select-tracker', purchase)"
                class="w-full text-left p-3 rounded-2xl border border-base-300 hover:border-primary/60 bg-base-200/50 hover:bg-primary/5 transition-all flex items-center justify-between group active:scale-98"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-8 h-8 rounded-xl bg-base-300/80 group-hover:bg-primary/20 text-primary flex items-center justify-center shrink-0">
                    <Icon icon="lucide:truck" class="w-4 h-4" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <span class="font-bold text-xs sm:text-sm text-base-content truncate group-hover:text-primary">
                        {{ purchase.vendor || 'Untitled Tracker' }}
                      </span>
                      <span v-if="purchase.itemCount !== undefined" class="badge badge-xs badge-neutral font-mono font-bold whitespace-nowrap">
                        {{ purchase.itemCount }} {{ purchase.itemCount === 1 ? 'item' : 'items' }}
                      </span>
                    </div>
                    <div class="text-[10px] font-mono opacity-70 flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span>{{ purchase.poNumber || purchase.orderId || 'Draft' }}</span>
                      <span>•</span>
                      <span>{{ formatDate(purchase.purchaseDate) }}</span>
                      <span v-if="purchase.subtotal" class="font-mono text-warning font-bold whitespace-nowrap">
                        ${{ Number(purchase.subtotal).toFixed(2) }}
                      </span>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <span class="btn btn-xs btn-primary text-primary-content font-bold whitespace-nowrap shadow-xs group-hover:scale-105 transition-transform">
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

          <!-- Option 3: Direct to Inventory (No Tracker) -->
          <div>
            <button
              type="button"
              @click="$emit('save-standalone')"
              class="btn btn-sm btn-outline border-base-300 hover:border-accent hover:bg-accent/5 w-full text-xs font-bold gap-2 rounded-xl h-10"
            >
              <Icon icon="solar:box-minimalistic-bold" class="w-4 h-4 text-accent" />
              <span>Direct to Inventory</span>
            </button>
            <p class="text-[10px] text-center opacity-50 mt-1">
              Skip the buy tracker and add straight to your sellable inventory.
            </p>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
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

// Sort draft trackers by last updated (most recent first)
const sortedDraftTrackers = computed(() => {
  return [...(props.draftPurchases || [])].sort((a, b) => {
    const timeA = new Date(a.$updatedAt || a.purchaseDate || a.$createdAt || 0).getTime();
    const timeB = new Date(b.$updatedAt || b.purchaseDate || b.$createdAt || 0).getTime();
    return timeB - timeA;
  });
});

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

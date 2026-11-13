<template>
  <SlideOverDrawer
    :model-value="modelValue"
    title="📦 Combine Similar &amp; Restock Bin"
    subtitle="Merge loose items into a new multi-quantity Batch Lot or restock an existing Booth Bin while preserving shop tags."
    size="lg"
    @update:model-value="emit('update:modelValue', $event)"
    @close="emit('close')"
  >
    <div class="space-y-4">
      <div class="tabs tabs-boxed bg-base-200 p-1 flex rounded-xl">
        <button
          type="button"
          class="tab flex-1 font-bold text-xs rounded-lg"
          :class="{ 'tab-active': combineMode === 'create_new' }"
          @click="emit('update:combineMode', 'create_new')"
        >
          ✨ Create New Batch Lot
        </button>
        <button
          type="button"
          class="tab flex-1 font-bold text-xs rounded-lg"
          :class="{ 'tab-active': combineMode === 'add_to_existing' }"
          @click="emit('update:combineMode', 'add_to_existing')"
        >
          ➕ Restock / Add to Existing Lot
        </button>
      </div>

      <!-- MODE 1: CREATE NEW BATCH LOT -->
      <div v-if="combineMode === 'create_new'" class="space-y-4">
        <div class="form-control w-full">
          <label class="label py-1">
            <span class="label-text font-bold text-xs opacity-75">Primary Item (Keep Photos &amp; Description)</span>
          </label>
          <select
            :value="combinePrimaryId"
            class="select select-bordered w-full text-xs font-bold rounded-xl"
            @change="onPrimarySelect"
          >
            <option v-for="item in selectedItemsObjects" :key="item.$id" :value="item.$id">
              {{ item.title }} (Qty: {{ item.quantity || 1 }}, Cost: ${{ Number(item.cost || 0).toFixed(2) }})
            </option>
          </select>
        </div>

        <div class="form-control w-full">
          <div class="flex items-center justify-between pb-1">
            <label class="label-text font-bold text-xs opacity-75">Batch Lot Title</label>
            <span class="text-[10px] text-secondary font-bold uppercase tracking-wider flex items-center gap-1">
              <Icon icon="solar:magic-stick-3-bold" class="w-3 h-3" />
              <span>Smart Suggested</span>
            </span>
          </div>
          <input
            type="text"
            :value="combineTitle"
            class="input input-bordered w-full font-bold text-sm rounded-xl"
            placeholder="e.g. Vintage Sci-Fi Paperbacks (Lot of 4)"
            @input="emit('update:combineTitle', ($event.target as HTMLInputElement).value)"
          />

          <div v-if="combineTitleSuggestions.length > 0" class="flex flex-wrap gap-1.5 mt-2">
            <button
              v-for="(sug, idx) in combineTitleSuggestions"
              :key="idx"
              type="button"
              class="badge badge-sm cursor-pointer transition-all hover:badge-secondary text-xs"
              :class="combineTitle === sug ? 'badge-secondary font-bold shadow-xs' : 'badge-ghost border-base-300 opacity-85'"
              @click="emit('update:combineTitle', sug)"
            >
              {{ sug }}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3.5">
          <div class="form-control w-full">
            <label class="label py-1"><span class="label-text font-bold text-xs opacity-75">Total Cost ($)</span></label>
            <input
              type="number"
              step="0.01"
              :value="combineCost"
              class="input input-bordered w-full font-mono text-sm rounded-xl"
              @input="emit('update:combineCost', Number(($event.target as HTMLInputElement).value) || 0)"
            />
          </div>
          <div class="form-control w-full">
            <label class="label py-1"><span class="label-text font-bold text-xs opacity-75">Total Quantity</span></label>
            <input
              type="number"
              min="1"
              :value="combineTotalUnits"
              class="input input-bordered w-full font-mono text-sm rounded-xl"
              @input="emit('update:combineTotalUnits', Math.max(1, Number(($event.target as HTMLInputElement).value) || 1))"
            />
          </div>
        </div>
      </div>

      <!-- MODE 2: ADD TO EXISTING BATCH / LOT -->
      <div v-else class="space-y-4">
        <div class="form-control w-full">
          <label class="label py-1">
            <span class="label-text font-bold text-xs opacity-75">Destination Booth Bin / Batch Lot</span>
          </label>
          <select
            :value="selectedTargetLotId"
            class="select select-bordered w-full text-xs font-bold rounded-xl"
            @change="emit('update:selectedTargetLotId', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">-- Choose an Existing Batch / Lot --</option>
            <option v-for="lot in availableMainLots" :key="lot.$id" :value="lot.$id">
              {{ lot.title }} (Qty: {{ lot.quantity || 1 }}, Cost: ${{ Number(lot.cost || 0).toFixed(2) }})
            </option>
          </select>
        </div>

        <div
          v-if="targetLotPreview"
          class="bg-base-200/80 p-3.5 rounded-2xl border border-secondary/35 text-xs space-y-1.5"
        >
          <div class="text-[10px] font-extrabold uppercase tracking-wider text-secondary">
            Live Before ➔ After Preview
          </div>
          <div class="flex justify-between font-bold">
            <span>Pieces After Merge:</span>
            <span class="text-secondary font-mono">{{ targetLotPreview.currentQty }} ➔ {{ targetLotPreview.newQty }} pieces</span>
          </div>
          <div class="flex justify-between font-bold">
            <span>Total Landed Cost:</span>
            <span class="font-mono">
              ${{ Number(targetLotPreview.currentCost ?? 0).toFixed(2) }} ➔ ${{ Number(targetLotPreview.newCost ?? 0).toFixed(2) }}
            </span>
          </div>
        </div>
        <div v-else class="rounded-2xl border border-dashed border-base-300 bg-base-200/40 p-3.5 text-xs text-base-content/65">
          Select an existing Booth Bin or Batch Lot above to preview merged unit counts and landed cost.
        </div>
      </div>

      <!-- Selected Items List -->
      <div class="border border-base-300 rounded-2xl p-3.5 bg-base-200/50 space-y-2">
        <div class="text-[10px] font-extrabold uppercase tracking-wider opacity-65">
          Selected Items ({{ selectedItemsObjects.length }})
        </div>
        <ul class="space-y-1.5 max-h-44 overflow-y-auto pr-1 text-xs">
          <li
            v-for="item in selectedItemsObjects"
            :key="item.$id"
            class="flex justify-between items-center bg-base-100 p-2.5 rounded-xl border border-base-200 shadow-2xs"
            :class="{
              'ring-1 ring-secondary':
                (combineMode === 'create_new' && item.$id === combinePrimaryId) ||
                (combineMode === 'add_to_existing' && item.$id === selectedTargetLotId),
            }"
          >
            <div class="flex flex-col min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span
                  class="font-medium break-words"
                  :class="
                    (combineMode === 'create_new' && item.$id === combinePrimaryId) ||
                    (combineMode === 'add_to_existing' && item.$id === selectedTargetLotId)
                      ? 'text-secondary font-bold'
                      : ''
                  "
                >
                  {{ item.title }}
                </span>
                <span
                  v-if="combineMode === 'create_new' && item.$id === combinePrimaryId"
                  class="badge badge-secondary badge-xs uppercase font-bold text-[9px]"
                >
                  Primary
                </span>
                <span
                  v-else-if="combineMode === 'add_to_existing' && item.$id === selectedTargetLotId"
                  class="badge badge-secondary badge-xs uppercase font-bold text-[9px]"
                >
                  Target Lot
                </span>
              </div>
              <span class="text-[10px] opacity-60 font-mono font-bold">
                Cost: ${{ Number(item.cost || 0).toFixed(2) }} · Qty: {{ item.quantity || 1 }}
              </span>
            </div>
          </li>
        </ul>
      </div>

      <!-- Lineage & Physical Tag Guardrail Alerts -->
      <div class="alert alert-warning py-2.5 shadow-xs text-xs leading-normal rounded-2xl">
        <Icon icon="solar:danger-triangle-linear" class="w-5 h-5 shrink-0" />
        <span v-if="combineMode === 'create_new'">
          This merges the selected items into a single Batch Lot and marks child records as combined.
        </span>
        <span v-else>
          This folds the selected items into the chosen Batch / Lot, updating its cost, pieces, and gallery.
        </span>
      </div>

      <div
        v-if="combineMode === 'create_new' && selectedItemsObjects.some((i) => i.upc || i.ricochetSynced)"
        class="alert alert-info py-2.5 shadow-xs text-xs leading-normal rounded-2xl"
      >
        <Icon icon="solar:info-circle-bold" class="w-5 h-5 shrink-0 text-info" />
        <span>
          <b>Shop Barcode Notice:</b> One or more selected items already has a shop barcode (UPC). Creating a <i>New</i> lot requires a new tag. To preserve an existing shelf tag, use <b>"➕ Restock / Add to Existing Lot"</b> instead.
        </span>
      </div>
      <div
        v-else-if="combineMode === 'add_to_existing' && selectedTargetLotId"
        class="alert bg-success/15 border border-success/30 py-2.5 shadow-xs text-xs leading-normal rounded-2xl"
      >
        <Icon icon="solar:check-circle-bold" class="w-5 h-5 shrink-0 text-success" />
        <span>
          <b>Preserves Shop Tag:</b> The target Batch / Lot keeps its original barcode / UPC—your physical shelf tag stays valid without re-printing.
        </span>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-between gap-2">
        <button type="button" class="btn btn-ghost btn-sm rounded-xl font-bold" :disabled="saving" @click="emit('close')">
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-secondary text-secondary-content btn-sm rounded-xl font-black px-6 gap-1.5"
          :disabled="
            saving ||
            (combineMode === 'create_new' && (!combineTitle || combineTotalUnits < 1)) ||
            (combineMode === 'add_to_existing' && !selectedTargetLotId)
          "
          @click="emit('submit')"
        >
          <span v-if="saving" class="loading loading-spinner loading-xs"></span>
          <span v-if="combineMode === 'create_new'">Create Batch Lot</span>
          <span v-else>Add to Batch / Lot</span>
        </button>
      </div>
    </template>
  </SlideOverDrawer>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
import SlideOverDrawer from '../common/SlideOverDrawer.vue';

defineProps<{
  modelValue: boolean;
  combineMode: string;
  combinePrimaryId: string | null;
  combineTitle: string;
  combineTitleSuggestions: string[];
  combineCost: number | string;
  combineTotalUnits: number;
  selectedTargetLotId: string;
  selectedItemsObjects: any[];
  availableMainLots: any[];
  targetLotPreview: {
    currentCost: number;
    currentQty: number;
    newCost: number;
    newQty: number;
    itemsCount: number;
  } | null;
  saving: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'update:combineMode', value: string): void;
  (e: 'update:combinePrimaryId', value: string): void;
  (e: 'update:combineTitle', value: string): void;
  (e: 'update:combineCost', value: number): void;
  (e: 'update:combineTotalUnits', value: number): void;
  (e: 'update:selectedTargetLotId', value: string): void;
  (e: 'primary-change'): void;
  (e: 'submit'): void;
  (e: 'close'): void;
}>();

const onPrimarySelect = (event: Event) => {
  const val = (event.target as HTMLSelectElement).value;
  emit('update:combinePrimaryId', val);
  emit('primary-change');
};
</script>


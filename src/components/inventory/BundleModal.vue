<template>
  <dialog id="bundle_modal" class="modal" :class="{ 'modal-open': isOpen }">
    <div class="modal-box bg-base-100 p-6 border border-base-200 w-11/12 max-w-2xl relative">
      <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" @click="closeModal">✕</button>
      <h3 class="font-bold text-lg flex items-center gap-2">
        <Icon icon="solar:box-minimalistic-bold-duotone" class="text-accent w-5 h-5" /> 
        Bundle Items for Sale
      </h3>
      <p class="text-xs opacity-70 mt-1 mb-4">
        Combine {{ items.length }} items into a single bundle listing. 
        Their landed costs will be combined. When the bundle sells, all items will be marked as sold.
      </p>

      <!-- Selected Items Preview -->
      <div class="bg-base-200 rounded-lg p-3 mb-6 max-h-32 overflow-y-auto">
        <ul class="text-sm font-mono opacity-80 space-y-1">
          <li v-for="item in items" :key="item.$id" class="flex justify-between">
            <span class="truncate pr-4 w-3/4">{{ item.title }}</span>
            <span class="w-1/4 text-right">${{ Number(item.cost || 0).toFixed(2) }}</span>
          </li>
        </ul>
        <div class="border-t border-base-300 mt-2 pt-2 flex justify-between font-bold text-accent">
          <span>Total Combined Cost:</span>
          <span>${{ totalCost.toFixed(2) }}</span>
        </div>
      </div>

      <div class="form-control w-full mb-4">
        <label class="label"><span class="label-text font-bold text-xs uppercase opacity-75">Bundle Title</span></label>
        <input v-model="form.title" type="text" class="input input-bordered w-full font-bold" placeholder="e.g. Vintage Sci-Fi Paperback Lot (5)" />
      </div>
      
      <div class="form-control w-full mb-4">
        <label class="label"><span class="label-text font-bold text-xs uppercase opacity-75">Description / Notes</span></label>
        <textarea v-model="form.description" class="textarea textarea-bordered h-24" placeholder="Describe the bundle..."></textarea>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="form-control">
          <label class="label"><span class="label-text font-bold text-xs uppercase opacity-75">Estimated Value</span></label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 opacity-50">$</span>
            <input v-model="form.estHigh" type="number" step="0.01" class="input input-bordered w-full pl-7 font-mono font-bold text-success" placeholder="0.00" />
          </div>
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text font-bold text-xs uppercase opacity-75">Storage Location</span></label>
          <input v-model="form.storageLocation" type="text" class="input input-bordered w-full" placeholder="e.g. Booth B" />
        </div>
      </div>

      <div class="modal-action mt-6">
        <button class="btn btn-ghost btn-sm" @click="closeModal" :disabled="submitting">Cancel</button>
        <button class="btn btn-accent btn-sm shadow-md" @click="submit" :disabled="submitting || !form.title">
          <span v-if="submitting" class="loading loading-spinner loading-xs mr-1"></span>
          Create Bundle
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button @click="closeModal">close</button>
    </form>
  </dialog>
</template>

<script setup>
import { ref, computed, reactive, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { databases, ID, Query } from '../../lib/appwrite';
import { Permission, Role } from 'appwrite';
import { isAlphaMode } from '../../stores/env';

const props = defineProps({
    isOpen: { type: Boolean, default: false },
    items: { type: Array, default: () => [] }
});

const emit = defineEmits(['close', 'success']);

const submitting = ref(false);
const form = reactive({
    title: '',
    description: '',
    estHigh: '',
    storageLocation: ''
});

const totalCost = computed(() => {
    return props.items.reduce((sum, item) => sum + Number(item.cost || 0), 0);
});

// Auto-fill storage location if all items share the same location
watch(() => props.isOpen, (newVal) => {
    if (newVal && props.items.length > 0) {
        form.title = '';
        form.description = '';
        form.estHigh = '';
        const loc = props.items[0].storageLocation;
        if (loc && props.items.every(i => i.storageLocation === loc)) {
            form.storageLocation = loc;
        } else {
            form.storageLocation = '';
        }
    }
});

const closeModal = () => emit('close');

const submit = async () => {
    if (submitting.value || !form.title || props.items.length === 0) return;
    submitting.value = true;
    try {
        const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
        const collId = isAlphaMode.get() 
            ? (import.meta.env.PUBLIC_APPWRITE_ALPHA_COLLECTION_ID || 'alpha_items') 
            : (import.meta.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items');

        const firstItem = props.items[0];
        const newBundleId = ID.unique();
        const combinedCost = totalCost.value;
        const sharedPurchaseId = props.items.find(i => i.purchaseId)?.purchaseId || null;
        const sourceIdentities = props.items.map(i => i.identity || i.upc || i.$id).filter(Boolean);
        const sourceLocations = props.items.map(i => i.sourcingLocation).filter(Boolean);

        // 1. Create the Bundle Parent Item
        const bundleDoc = {
            title: form.title,
            identity: `BUNDLE-${Date.now().toString().slice(-6)}`,
            description: form.description,
            conditionNotes: `Bundled ${props.items.length} items together.\nSources: ${sourceIdentities.join(', ')}`,
            status: 'listed',
            cost: combinedCost, // Sum of child costs
            quantity: 1, // The bundle is 1 unit for sale
            tenantId: firstItem.tenantId || null,
            userId: firstItem.userId || null,
            storageLocation: form.storageLocation || null,
            estHigh: form.estHigh || null,
            purchaseId: sharedPurchaseId,
            sourcingLocation: sourceLocations.length > 0 ? sourceLocations[0] : null
        };
        
        Object.keys(bundleDoc).forEach(key => bundleDoc[key] === undefined && delete bundleDoc[key]);
        
        let permissions = undefined;
        if (firstItem.tenantId && firstItem.tenantId !== 'default') {
            const role = Role.team(firstItem.tenantId);
            permissions = [Permission.read(role), Permission.update(role), Permission.delete(role)];
        } else if (firstItem.userId) {
            const role = Role.user(firstItem.userId);
            permissions = [Permission.read(role), Permission.update(role), Permission.delete(role)];
        }

        const bundleRecord = await databases.createDocument(DB_ID, collId, newBundleId, bundleDoc, permissions);

        // 2. Update all child items to belong to this bundle and mark them as bundled/hidden
        const promises = props.items.map(item => {
            return databases.updateDocument(DB_ID, collId, item.$id, {
                parentLotId: bundleRecord.$id,
                status: 'bundled' // Set status to 'bundled' to remove them from main active view if we want
            });
        });
        
        await Promise.all(promises);

        emit('success', bundleRecord.$id);
    } catch (err) {
        console.error("Bundle failed:", err);
        alert("Failed to create bundle: " + err.message);
    } finally {
        submitting.value = false;
    }
};
</script>

<template>
  <div class="modal z-[9999]" :class="{ 'modal-open': state.isOpen }">
    <div class="modal-box shadow-2xl border border-base-200">
      <h3 class="font-bold text-xl mb-4" v-if="state.title">{{ state.title }}</h3>
      <p class="py-2 text-base">{{ state.message }}</p>
      <div class="modal-action mt-6">
        <button class="btn btn-ghost border border-base-300 shadow-sm" @click="handleCancel">{{ state.cancelText }}</button>
        <button class="btn" :class="state.confirmClass" @click="handleConfirm">{{ state.confirmText }}</button>
      </div>
    </div>
    <!-- Backdrop to close on clicking outside -->
    <div class="modal-backdrop bg-black/30 backdrop-blur-sm fixed inset-0 z-[-1]" @click.self="handleCancel"></div>
  </div>
</template>

<script setup lang="ts">
import { useStore } from '@nanostores/vue';
import { confirmState } from '../../stores/confirm';

const state = useStore(confirmState);

const handleConfirm = () => {
    if (state.value.onConfirm) state.value.onConfirm();
};

const handleCancel = () => {
    if (state.value.onCancel) state.value.onCancel();
};
</script>

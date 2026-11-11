<template>
  <Teleport v-if="mounted" to="body">
    <Transition name="rc-drawer">
      <div v-if="modelValue" class="fixed inset-0 z-400" role="dialog" aria-modal="true" :aria-label="title">
        <!-- Backdrop (solid, no blur — avoids GPU scroll lag) -->
        <div class="absolute inset-0 bg-black/60" @click="close"></div>

        <!-- Panel: full-width on mobile, md (480px), lg (640px–780px), or xl (880px–960px) on desktop -->
        <aside
          ref="panelRef"
          tabindex="-1"
          class="rc-drawer-panel absolute inset-y-0 right-0 w-full max-w-full bg-base-100 shadow-2xl flex flex-col outline-none"
          :class="size === 'xl' ? 'sm:w-160 lg:w-220 xl:w-240' : size === 'lg' ? 'sm:w-160 lg:w-195' : 'sm:w-120'"
        >
          <header class="flex items-start justify-between gap-3 px-4 sm:px-6 pt-4 pb-3 border-b border-base-200 flex-none">
            <div class="min-w-0">
              <h3 class="text-lg font-black tracking-tight truncate">{{ title }}</h3>
              <p v-if="subtitle" class="text-xs text-base-content/70">{{ subtitle }}</p>
            </div>
            <button type="button" class="btn btn-ghost btn-sm btn-circle shrink-0" aria-label="Close" @click="close">✕</button>
          </header>

          <div class="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="flex-none border-t border-base-200 px-4 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-base-100">
            <slot name="footer" />
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * Canonical right-side Slide-Over Drawer (UX taxonomy: "Slide-Over Drawer").
 * Use for focused create/edit forms that should keep page context visible (e.g. Connect With Us,
 * Edit My Application). Esc and backdrop click close it; focus moves into the panel when it opens.
 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

// Teleport targets don't exist during SSR; mount it client-side only to avoid hydration mismatches.
const mounted = ref(false);
onMounted(() => {
  mounted.value = true;
});

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title: string;
    subtitle?: string;
    size?: 'md' | 'lg' | 'xl';
  }>(),
  {
    size: 'md',
  }
);
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void; (e: 'close'): void }>();

const panelRef = ref<HTMLElement | null>(null);

const close = () => {
  emit('update:modelValue', false);
  emit('close');
};

const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') close();
};

watch(
  () => props.modelValue,
  async (open) => {
    if (typeof document === 'undefined') return;
    if (open) {
      document.addEventListener('keydown', onKey);
      document.body.style.overflow = 'hidden';
      await nextTick();
      panelRef.value?.focus();
    } else {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  if (typeof document === 'undefined') return;
  document.removeEventListener('keydown', onKey);
  document.body.style.overflow = '';
});
</script>

<style scoped>
.rc-drawer-enter-active,
.rc-drawer-leave-active {
  transition: opacity 0.2s ease;
}
.rc-drawer-enter-active .rc-drawer-panel,
.rc-drawer-leave-active .rc-drawer-panel {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.rc-drawer-enter-from,
.rc-drawer-leave-to {
  opacity: 0;
}
.rc-drawer-enter-from .rc-drawer-panel,
.rc-drawer-leave-to .rc-drawer-panel {
  transform: translateX(100%);
}
</style>


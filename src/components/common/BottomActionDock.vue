<template>
  <Teleport :to="teleportTo" :disabled="!teleport || placement !== 'viewport'">
    <Transition :name="transition ? 'dock-slide-up' : ''">
      <div 
        v-if="visible"
        class="bg-base-100/95 dark:bg-base-200/95 backdrop-blur-2xl border-t border-base-300 shadow-[0_-4px_25px_rgba(0,0,0,0.18)] select-none pointer-events-auto flex flex-col pb-[env(safe-area-inset-bottom,0px)]"
        :class="[
          placement === 'viewport' ? 'fixed bottom-0 inset-x-0' : 'sticky bottom-0 inset-x-0 w-full shrink-0',
          zIndex
        ]"
      >
        <!-- OPTIONAL TOP STATUS STRIP (e.g. Manifest tracker, active batch selection, or Scout status) -->
        <div 
          v-if="$slots.top" 
          class="border-b border-base-content/15 bg-base-200/90 dark:bg-base-300/90 py-1 px-3 flex items-center justify-center text-xs shadow-2xs"
        >
          <slot name="top" />
        </div>

        <!-- MAIN DOCK BAR -->
        <div 
          class="w-full mx-auto min-w-0"
          :class="[
            placement === 'viewport' ? (maxWidth || 'max-w-7xl') : 'w-full',
            noPadding ? '' : 'px-3 sm:px-6 py-2'
          ]"
        >
          <!-- Custom free-form default slot if provided -->
          <slot v-if="$slots.default" />

          <!-- Canonical 3-section layout: Left Telemetry, Center Controls, Right Action Buttons -->
          <div 
            v-else 
            class="flex flex-col md:flex-row md:items-center justify-between gap-2.5 min-w-0 w-full"
          >
            <!-- Left Section: Telemetry, Summary, Title, Badges -->
            <div 
              v-if="$slots.left" 
              class="flex items-center justify-between md:justify-start gap-2.5 min-w-0 shrink"
            >
              <slot name="left" />
            </div>

            <!-- Center Section (Optional): Segmented tools, Pager pills, Filter toggles -->
            <div 
              v-if="$slots.center" 
              class="flex items-center justify-center gap-1.5 shrink-0"
            >
              <slot name="center" />
            </div>

            <!-- Right Section: Action Buttons, CPA, Secondary Utilities -->
            <div 
              v-if="$slots.right" 
              class="flex items-center gap-1.5 sm:gap-2 shrink-0 overflow-x-auto py-0.5 no-scrollbar ml-auto md:ml-0"
            >
              <slot name="right" />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * BottomActionDock.vue
 * 
 * Canonical Resale Command Bottom Action Bar Dock Pattern.
 * Polymorphically adapts to 3 surface contexts:
 * 1. 'viewport' (Pages): Fixed to bottom edge, teleports to <body>
 * 2. 'container' / 'sticky' (Modals, Drawers, Trays): Stays pinned to container bottom without teleporting
 * 
 * Features:
 * - Direct `<Teleport to="body">` when placement='viewport'
 * - Canonical glassmorphic backdrop-blur & border tokens
 * - Built-in safe-area-inset padding for iOS/mobile devices
 * - Responsive 3-slot layout (`#left`, `#center`, `#right`) or full custom `#default`
 * - Optional `#top` slim status strip for batch / manifest telemetry
 * - Smooth cubic-bezier slide-up entrance & exit transitions
 */

defineOptions({
  name: 'BottomActionDock',
  inheritAttrs: false
});

withDefaults(
  defineProps<{
    visible?: boolean;
    placement?: 'viewport' | 'container' | 'sticky';
    teleport?: boolean;
    teleportTo?: string;
    zIndex?: string;
    maxWidth?: string;
    noPadding?: boolean;
    transition?: boolean;
  }>(),
  {
    visible: true,
    placement: 'viewport',
    teleport: true,
    teleportTo: 'body',
    zIndex: 'z-40',
    maxWidth: 'max-w-7xl',
    noPadding: false,
    transition: true
  }
);
</script>

<style scoped>
.dock-slide-up-enter-active,
.dock-slide-up-leave-active {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease-out;
}

.dock-slide-up-enter-from,
.dock-slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>

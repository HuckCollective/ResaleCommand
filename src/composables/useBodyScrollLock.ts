import { onBeforeUnmount, onMounted, onUnmounted, watch, type Ref } from 'vue';
import { setCalmOverlayCount } from './useCalmRealtime';

let activeScrollLocks = 0;
let previousBodyOverflow = '';

/**
 * Reference-counted `document.body.style.overflow = 'hidden'` manager.
 * Prevents stacked sanctioned surfaces (e.g. `ItemDrawer` z-450 over a Bottom-Sheet Tray z-400)
 * from prematurely unlocking body scroll when the top surface closes while the bottom tray stays open.
 *
 * Pass a reactive getter / Ref for `v-model` overlays (`SlideOverDrawer`, Bottom-Sheet Trays),
 * or omit arguments for `v-if`-mounted overlays (`ItemDrawer`).
 */
export function useBodyScrollLock(source?: Ref<boolean> | (() => boolean)): {
  lock: () => void;
  unlock: () => void;
} {
  let holdsLock = false;

  const lock = () => {
    if (holdsLock || typeof document === 'undefined') return;
    holdsLock = true;
    if (activeScrollLocks === 0) {
      previousBodyOverflow = document.body.style.overflow || '';
      document.body.style.overflow = 'hidden';
    }
    activeScrollLocks += 1;
    setCalmOverlayCount(activeScrollLocks);
  };

  const unlock = () => {
    if (!holdsLock || typeof document === 'undefined') return;
    holdsLock = false;
    activeScrollLocks = Math.max(0, activeScrollLocks - 1);
    setCalmOverlayCount(activeScrollLocks);
    if (activeScrollLocks === 0) {
      document.body.style.overflow = previousBodyOverflow;
      previousBodyOverflow = '';
    }
  };

  if (source) {
    watch(
      source,
      (isOpen) => {
        if (isOpen) {
          lock();
        } else {
          unlock();
        }
      },
      { immediate: true }
    );
  } else {
    onMounted(lock);
  }

  onBeforeUnmount(unlock);
  onUnmounted(unlock);

  return { lock, unlock };
}

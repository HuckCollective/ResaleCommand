import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';

/**
 * Measures a fixed bottom dock and exposes its height in rem so an in-flow
 * `.rc-dock-spacer` can clear it exactly. Pass `fallbackRem` to avoid layout
 * shift before the first measurement.
 */
export function useDockClearance(fallbackRem = 4.25) {
  const dockEl: Ref<HTMLElement | null> = ref(null);
  const heightPx = ref<number | null>(null);
  let observer: ResizeObserver | null = null;

  const rootRem = () =>
    parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

  const dockHeightRem = computed(() =>
    heightPx.value === null ? `${fallbackRem}rem` : `${heightPx.value / rootRem()}rem`,
  );

  const disconnect = () => {
    observer?.disconnect();
    observer = null;
  };

  watch(
    dockEl,
    (el) => {
      disconnect();
      if (!el || typeof ResizeObserver === 'undefined') return;
      heightPx.value = el.getBoundingClientRect().height;
      observer = new ResizeObserver(() => {
        heightPx.value = el.getBoundingClientRect().height;
      });
      observer.observe(el);
    },
    { flush: 'post' },
  );

  onBeforeUnmount(disconnect);

  return { dockEl, dockHeightRem };
}


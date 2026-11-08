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
  let rafId: number | null = null;

  // Defer to the next frame and skip sub-pixel jitter so updating the spacer
  // never re-triggers the observer inside the same frame (avoids
  // "ResizeObserver loop completed with undelivered notifications").
  const measure = (el: HTMLElement) => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = null;
      const next = Math.round(el.getBoundingClientRect().height);
      if (heightPx.value !== next) heightPx.value = next;
    });
  };

  const rootRem = () =>
    parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

  const dockHeightRem = computed(() =>
    heightPx.value === null ? `${fallbackRem}rem` : `${heightPx.value / rootRem()}rem`,
  );

  const disconnect = () => {
    observer?.disconnect();
    observer = null;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  };

  watch(
    dockEl,
    (el) => {
      disconnect();
      if (!el || typeof ResizeObserver === 'undefined') return;
      heightPx.value = Math.round(el.getBoundingClientRect().height);
      observer = new ResizeObserver(() => measure(el));
      observer.observe(el);
    },
    { flush: 'post' },
  );

  onBeforeUnmount(disconnect);

  return { dockEl, dockHeightRem };
}


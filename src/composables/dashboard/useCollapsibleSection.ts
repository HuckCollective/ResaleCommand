import { onMounted, onUnmounted, ref } from 'vue';

/**
 * Collapsible dashboard section. Live mode remembers the state in localStorage; demo mode always
 * starts expanded so visitors see everything. Also reacts to the shell's "collapse all" event.
 */
export function useCollapsibleSection(key: string, defaultCollapsed: boolean, persist: boolean) {
  const storageKey = `rc_dash_collapsed_${key}`;
  const isCollapsed = ref(persist ? defaultCollapsed : false);

  const toggle = () => {
    isCollapsed.value = !isCollapsed.value;
    if (!persist) return;
    try {
      localStorage.setItem(storageKey, String(isCollapsed.value));
    } catch {}
  };

  const onToggleAll = (e: Event) => {
    const detail = (e as CustomEvent<{ collapse: boolean }>).detail;
    if (detail && typeof detail.collapse === 'boolean') {
      isCollapsed.value = detail.collapse;
      if (persist) {
        try {
          localStorage.setItem(storageKey, String(detail.collapse));
        } catch {}
      }
    }
  };

  onMounted(() => {
    if (persist) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved !== null) isCollapsed.value = saved === 'true';
      } catch {}
    }
    window.addEventListener('rc:toggle-all-dashboard', onToggleAll);
  });

  onUnmounted(() => window.removeEventListener('rc:toggle-all-dashboard', onToggleAll));

  return { isCollapsed, toggle };
}

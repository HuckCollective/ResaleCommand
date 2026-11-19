import { nextTick, onMounted, onUnmounted, ref, watch, type Ref } from 'vue';

export interface UseUrlTabOptions<T extends string> {
  /** Allowed canonical tab IDs (static array or getter for dynamic sections). */
  tabs: readonly T[] | (() => readonly T[]);
  /** Default tab shown when no URL hash, query param, or fallback storage is active. */
  defaultTab: T;
  /** Optional initial fallback (e.g. from SSR prop) when URL specifies no tab. */
  initialTab?: T;
  /** Legacy query parameter names auto-upgraded to `#hash` (default `['tab']`). */
  legacyQueryParams?: readonly string[];
  /** Optional lowercase alias map (e.g. `{ reports: 'report', bookmarklets: 'hardware' }`). */
  aliases?: Record<string, T>;
  /** Smooth-scroll to the tab strip when landing with a `#hash` / `?tab=` deep link (default `true`). */
  scrollOnDeepLink?: boolean;
  /** Smooth-scroll when `setTab()` is called while the tab strip is scrolled off-screen (default `true`). */
  scrollOnClickIfOffscreen?: boolean;
  /** Optional `sessionStorage` key remembered across visits when no URL tab is present. */
  fallbackStorageKey?: string;
  /** Optional callback fired whenever the active tab changes. */
  onTabChange?: (tab: T) => void;
}

export interface SetTabOptions {
  /** Force smooth-scroll (`true`) or suppress scrolling (`false`). Omit for auto-scroll-when-offscreen. */
  scroll?: boolean;
  /** Update the browser URL `#hash` (default `true`). */
  updateUrl?: boolean;
}

export interface UseUrlTabReturn<T extends string> {
  activeTab: Ref<T>;
  setTab: (tab: T, opts?: SetTabOptions) => void;
  tabSectionRef: Ref<HTMLElement | null>;
  scrollToTab: (force?: boolean) => void;
  hasExplicitUrlTab: Ref<boolean>;
}

/**
 * Canonical tab URL & smooth-scroll pattern (`/page#tab`).
 * Keeps `#hash` synced with tab state, auto-upgrades legacy `?tab=`/`?section=`/`?view=` query params,
 * and smooth-scrolls to the tab bar once mounted (even behind auth gates or loading skeletons).
 * Pure Vue import only so Demo Isolation (§14D) stays 100% intact.
 */
export function useUrlTab<T extends string>(options: UseUrlTabOptions<T>): UseUrlTabReturn<T> {
  const legacyParams = options.legacyQueryParams ?? ['tab'];
  const scrollOnDeepLink = options.scrollOnDeepLink !== false;
  const scrollOnClickIfOffscreen = options.scrollOnClickIfOffscreen !== false;

  const getTabs = (): readonly T[] =>
    typeof options.tabs === 'function' ? options.tabs() : options.tabs;

  const resolveTabToken = (raw: string | null | undefined): T | null => {
    const cleaned = String(raw || '')
      .trim()
      .replace(/^#/, '')
      .replace(/^tab[-_:]/i, '')
      .toLowerCase();
    if (!cleaned) return null;

    const mapped = options.aliases?.[cleaned] ?? cleaned;
    const targetLower = String(mapped).toLowerCase();
    const match = getTabs().find((t) => String(t).toLowerCase() === targetLower);
    return match ?? null;
  };

  const readUrlTab = (): { tab: T | null; fromQuery: boolean; explicitHash: boolean } => {
    if (typeof window === 'undefined') {
      return { tab: null, fromQuery: false, explicitHash: false };
    }

    const fromHash = resolveTabToken(window.location.hash);
    if (fromHash) {
      return { tab: fromHash, fromQuery: false, explicitHash: true };
    }

    const params = new URLSearchParams(window.location.search);
    for (const paramName of legacyParams) {
      const candidate = resolveTabToken(params.get(paramName));
      if (candidate) {
        return { tab: candidate, fromQuery: true, explicitHash: false };
      }
    }

    return { tab: null, fromQuery: false, explicitHash: false };
  };

  const readFallbackStorage = (): T | null => {
    if (typeof window === 'undefined' || !options.fallbackStorageKey) return null;
    try {
      return resolveTabToken(sessionStorage.getItem(options.fallbackStorageKey));
    } catch {
      return null;
    }
  };

  const writeFallbackStorage = (tab: T) => {
    if (typeof window === 'undefined' || !options.fallbackStorageKey) return;
    try {
      sessionStorage.setItem(options.fallbackStorageKey, tab);
    } catch {
      /* ignore private-mode storage quotas */
    }
  };

  const updateUrlHash = (tab: T) => {
    if (typeof window === 'undefined' || !window.history?.replaceState) return;
    try {
      const url = new URL(window.location.href);
      for (const paramName of legacyParams) {
        url.searchParams.delete(paramName);
      }
      url.hash = tab === options.defaultTab ? '' : `#${tab}`;
      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextUrl !== currentUrl) {
        window.history.replaceState({}, '', nextUrl);
      }
    } catch {
      /* ignore embedded context history errors */
    }
  };

  const initialResolved = (() => {
    const urlRes = readUrlTab();
    if (urlRes.tab) return urlRes.tab;
    const stored = readFallbackStorage();
    if (stored) return stored;
    const propTab = resolveTabToken(options.initialTab);
    return propTab ?? options.defaultTab;
  })();

  const activeTab = ref<T>(initialResolved) as Ref<T>;
  const tabSectionRef = ref<HTMLElement | null>(null);
  const hasExplicitUrlTab = ref(false);
  let pendingDeepLinkScroll = false;

  const performScroll = (force: boolean) => {
    if (typeof window === 'undefined') return false;
    const el = tabSectionRef.value;
    if (!el) return false;

    const rect = el.getBoundingClientRect();
    const topThreshold = 56;
    const bottomThreshold = Math.max(window.innerHeight * 0.68, 260);
    const isComfortablyVisible = rect.top >= topThreshold && rect.top <= bottomThreshold;

    if (!force && isComfortablyVisible) {
      return true;
    }

    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    el.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
    return true;
  };

  const scrollToTab = (force = true) => {
    if (typeof window === 'undefined') return;
    if (!tabSectionRef.value) {
      pendingDeepLinkScroll = true;
      return;
    }
    void nextTick(() => {
      window.requestAnimationFrame(() => {
        performScroll(force);
      });
    });
  };

  const flushPendingScroll = () => {
    if (typeof window === 'undefined' || !pendingDeepLinkScroll || !tabSectionRef.value) return;
    void nextTick(() => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (!pendingDeepLinkScroll || !tabSectionRef.value) return;
          if (performScroll(true)) {
            pendingDeepLinkScroll = false;
          }
        });
      });
    });
  };

  const setTab = (tab: T, opts?: SetTabOptions) => {
    const resolved = resolveTabToken(tab) ?? options.defaultTab;
    const changed = activeTab.value !== resolved;
    activeTab.value = resolved;
    writeFallbackStorage(resolved);

    if (opts?.updateUrl !== false) {
      updateUrlHash(resolved);
    }
    if (changed) {
      options.onTabChange?.(resolved);
    }

    if (opts?.scroll === true) {
      scrollToTab(true);
    } else if (opts?.scroll !== false && scrollOnClickIfOffscreen) {
      scrollToTab(false);
    }
  };

  const applyCurrentUrlState = (triggerScroll: boolean) => {
    const urlRes = readUrlTab();
    if (!urlRes.tab) return false;

    hasExplicitUrlTab.value = true;
    const changed = activeTab.value !== urlRes.tab;
    activeTab.value = urlRes.tab;
    writeFallbackStorage(urlRes.tab);

    if (urlRes.fromQuery || window.location.hash !== (urlRes.tab === options.defaultTab ? '' : `#${urlRes.tab}`)) {
      // Preserve explicit #defaultTab if user explicitly typed it, or upgrade query params to clean hash
      if (urlRes.fromQuery) {
        updateUrlHash(urlRes.tab);
      }
    }

    if (changed) {
      options.onTabChange?.(urlRes.tab);
    }

    if (triggerScroll && (urlRes.tab !== options.defaultTab || urlRes.explicitHash)) {
      pendingDeepLinkScroll = true;
      flushPendingScroll();
    }
    return true;
  };

  const onHashChange = () => {
    if (typeof window === 'undefined') return;
    const fromHash = resolveTabToken(window.location.hash);
    if (fromHash) {
      hasExplicitUrlTab.value = true;
      const changed = activeTab.value !== fromHash;
      activeTab.value = fromHash;
      writeFallbackStorage(fromHash);
      if (changed) options.onTabChange?.(fromHash);
      if (scrollOnDeepLink) {
        pendingDeepLinkScroll = true;
        flushPendingScroll();
      }
    } else if (!window.location.hash) {
      const changed = activeTab.value !== options.defaultTab;
      activeTab.value = options.defaultTab;
      writeFallbackStorage(options.defaultTab);
      if (changed) options.onTabChange?.(options.defaultTab);
    }
  };

  watch(
    tabSectionRef,
    (el) => {
      if (el && pendingDeepLinkScroll) {
        flushPendingScroll();
      }
    },
    { flush: 'post', immediate: true }
  );

  onMounted(() => {
    const hadUrlTab = applyCurrentUrlState(scrollOnDeepLink);
    if (!hadUrlTab) {
      const stored = readFallbackStorage();
      if (stored && stored !== activeTab.value) {
        activeTab.value = stored;
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', onHashChange);
    }
  });

  onUnmounted(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('hashchange', onHashChange);
    }
  });

  return {
    activeTab,
    setTab,
    tabSectionRef,
    scrollToTab,
    hasExplicitUrlTab,
  };
}

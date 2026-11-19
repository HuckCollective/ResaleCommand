import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import {
  auditInventoryAndPurchaseHealth,
  type HealthAuditScope,
  type InventoryHealthReport,
} from '../lib/inventoryHealthAudit';
import { salesApi } from '../lib/sales';
import { usePurchases } from './usePurchases';
import { addToast } from '../stores/toast';

export type HealthBucketTabId =
  | 'split_lots'
  | 'sold_ghosts'
  | 'active_clones'
  | 'barcodes'
  | 'stale_pos';

const HEALTH_HASH_TO_TAB: Record<string, HealthBucketTabId | null> = {
  '#health': null,
  '#health-split': 'split_lots',
  '#health-sold': 'sold_ghosts',
  '#health-clones': 'active_clones',
  '#health-barcodes': 'barcodes',
  '#health-pos': 'stale_pos',
};

const HEALTH_TAB_TO_HASH: Record<HealthBucketTabId, string> = {
  split_lots: '#health-split',
  sold_ghosts: '#health-sold',
  active_clones: '#health-clones',
  barcodes: '#health-barcodes',
  stale_pos: '#health-pos',
};

function parseHealthHash(hash: string): { isHealthHash: boolean; tab: HealthBucketTabId | null } {
  const clean = String(hash || '').trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(HEALTH_HASH_TO_TAB, clean)) {
    return { isHealthHash: true, tab: HEALTH_HASH_TO_TAB[clean] };
  }
  return { isHealthHash: false, tab: null };
}

const DISMISSED_HEALTH_STORAGE_KEY = 'rc_dismissed_health_pairs_v1';

function loadDismissedHealthSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISSED_HEALTH_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map((x) => String(x))) : new Set();
  } catch {
    return new Set();
  }
}

export interface UseInventoryHealthAuditOptions {
  inventoryItems: Ref<any[]>;
  capabilities: Ref<any>;
  user: Ref<any>;
  currentTeam: Ref<any>;
  isQueuesTrayOpen: Ref<boolean>;
  isManifestTrayOpen: Ref<boolean>;
  closeAllTrays: () => void;
  fetchInventory: (teamId?: string) => Promise<any>;
  existingPurchases?: Ref<any[]>;
  fetchExistingPurchases?: () => Promise<any>;
}

export function useInventoryHealthAudit(opts: UseInventoryHealthAuditOptions) {
  const { purchases, fetchPurchases } = usePurchases();

  const isHealthAuditTrayOpen = ref(false);
  const requestedHealthTab = ref<HealthBucketTabId | null>(null);
  const healthAuditScope = ref<HealthAuditScope>(
    opts.capabilities.value?.isConsignor ? 'all' : 'mine'
  );
  const allSalesForHealth = ref<any[]>([]);
  const dismissedHealthKeys = ref<Set<string>>(loadDismissedHealthSet());
  let salesFetchPromise: Promise<void> | null = null;

  const effectivePurchases = computed(
    () =>
      (opts.existingPurchases?.value?.length
        ? opts.existingPurchases.value
        : purchases.value) || []
  );

  watch(
    () => opts.capabilities.value?.isConsignor,
    (isCons) => {
      if (isCons && healthAuditScope.value === 'mine') {
        healthAuditScope.value = 'all';
      }
    }
  );

  watch([opts.isQueuesTrayOpen, opts.isManifestTrayOpen], ([qOpen, mOpen]) => {
    if ((qOpen || mOpen) && isHealthAuditTrayOpen.value) {
      isHealthAuditTrayOpen.value = false;
    }
  });

  const loadPurchasesIfNeeded = async (force = false) => {
    if (!force && effectivePurchases.value.length > 0) return;
    try {
      if (opts.fetchExistingPurchases) {
        await opts.fetchExistingPurchases();
      } else {
        await fetchPurchases(opts.currentTeam.value?.$id || '');
      }
    } catch (e) {
      console.warn('[useInventoryHealthAudit] Could not load purchases for health audit:', e);
    }
  };

  const fetchSalesForHealth = async (force = false) => {
    if (!force && salesFetchPromise) return salesFetchPromise;
    salesFetchPromise = (async () => {
      try {
        const docs = await salesApi.listSales(opts.currentTeam.value?.$id);
        allSalesForHealth.value = Array.isArray(docs) ? docs : [];
      } catch (e) {
        console.warn('[useInventoryHealthAudit] Could not load sales for health audit:', e);
      } finally {
        salesFetchPromise = null;
      }
    })();
    return salesFetchPromise;
  };

  const healthReport = computed<InventoryHealthReport>(() =>
    auditInventoryAndPurchaseHealth({
      items: opts.inventoryItems.value || [],
      purchases: effectivePurchases.value,
      sales: allSalesForHealth.value || [],
      capabilities: opts.capabilities.value,
      userId: opts.user.value?.$id || null,
      scope: healthAuditScope.value,
      dismissedPairKeys: dismissedHealthKeys.value,
    })
  );

  const healthTotalBadgeCount = computed(
    () =>
      healthReport.value.totalHighConfidenceCount + healthReport.value.totalReviewCount
  );

  const openHealthAuditTray = () => {
    opts.closeAllTrays();
    isHealthAuditTrayOpen.value = true;
    if (allSalesForHealth.value.length === 0) {
      fetchSalesForHealth();
    }
    if (effectivePurchases.value.length === 0) {
      loadPurchasesIfNeeded();
    }
  };

  const dismissHealthPair = (key: string) => {
    if (!key) return;
    const next = new Set(dismissedHealthKeys.value);
    next.add(key);
    dismissedHealthKeys.value = next;
    try {
      window.localStorage.setItem(
        DISMISSED_HEALTH_STORAGE_KEY,
        JSON.stringify(Array.from(next))
      );
    } catch {}
    addToast({ type: 'info', message: 'Saved on this device — warning hidden.' });
  };

  const resetDismissedHealthPairs = () => {
    dismissedHealthKeys.value = new Set();
    try {
      window.localStorage.removeItem(DISMISSED_HEALTH_STORAGE_KEY);
    } catch {}
    addToast({ type: 'info', message: 'Restored hidden health warnings.' });
  };

  const refreshInventoryAndPurchases = async () => {
    await Promise.all([
      opts.fetchInventory(opts.currentTeam.value?.$id || ''),
      loadPurchasesIfNeeded(true),
      fetchSalesForHealth(true),
    ]);
  };

  const replaceHashQuietly = (nextHash: string) => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      if (url.hash === nextHash) return;
      url.hash = nextHash;
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch {}
  };

  const syncHealthTabHash = (tab: HealthBucketTabId) => {
    requestedHealthTab.value = tab;
    if (isHealthAuditTrayOpen.value) {
      replaceHashQuietly(HEALTH_TAB_TO_HASH[tab] || '#health');
    }
  };

  watch(isHealthAuditTrayOpen, (open) => {
    if (typeof window === 'undefined') return;
    if (open) {
      if (requestedHealthTab.value) {
        replaceHashQuietly(HEALTH_TAB_TO_HASH[requestedHealthTab.value] || '#health');
      } else if (!parseHealthHash(window.location.hash).isHealthHash) {
        replaceHashQuietly('#health');
      }
    } else if (parseHealthHash(window.location.hash).isHealthHash) {
      requestedHealthTab.value = null;
      replaceHashQuietly('');
    }
  });

  const handleHashChange = () => {
    if (typeof window === 'undefined') return;
    const parsed = parseHealthHash(window.location.hash);
    if (parsed.isHealthHash) {
      requestedHealthTab.value = parsed.tab;
      if (!isHealthAuditTrayOpen.value) {
        openHealthAuditTray();
      }
    } else if (isHealthAuditTrayOpen.value) {
      requestedHealthTab.value = null;
      isHealthAuditTrayOpen.value = false;
    }
  };

  onMounted(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', handleHashChange);
      const url = new URL(window.location.href);
      const legacyHealthQuery = url.searchParams.get('health');
      const parsed = parseHealthHash(url.hash);

      if (legacyHealthQuery === 'audit') {
        url.searchParams.delete('health');
        const upgradedHash = parsed.isHealthHash ? url.hash : '#health';
        url.hash = upgradedHash;
        try {
          window.history.replaceState(null, '', url.pathname + url.search + url.hash);
        } catch {}
        requestedHealthTab.value = parsed.tab;
        openHealthAuditTray();
      } else if (parsed.isHealthHash) {
        requestedHealthTab.value = parsed.tab;
        openHealthAuditTray();
      }
    }
    setTimeout(() => {
      if (allSalesForHealth.value.length === 0) {
        fetchSalesForHealth();
      }
      if (effectivePurchases.value.length === 0) {
        loadPurchasesIfNeeded();
      }
    }, 250);
  });

  onBeforeUnmount(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('hashchange', handleHashChange);
    }
  });

  return {
    isHealthAuditTrayOpen,
    requestedHealthTab,
    healthAuditScope,
    dismissedHealthKeys,
    healthReport,
    healthTotalBadgeCount,
    openHealthAuditTray,
    syncHealthTabHash,
    dismissHealthPair,
    resetDismissedHealthPairs,
    refreshInventoryAndPurchases,
  };
}

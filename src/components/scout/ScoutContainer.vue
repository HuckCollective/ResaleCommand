<template>
  <div>
    <!-- TOP 2-TAB MODE SWITCHER BAR (Members Only: /scout ⇄ /scout/trackers) -->
    <div v-if="!authLoading && isAuthenticated" class="flex items-center justify-center mb-5">
      <div class="inline-flex items-center bg-base-200/90 border border-base-300 p-1 rounded-2xl shadow-xs gap-1">
        <button
          type="button"
          class="btn btn-sm rounded-xl font-black gap-2 px-4 transition-all"
          :class="currentView === 'scout' ? 'btn-primary text-primary-content shadow-sm' : 'btn-ghost text-base-content/75'"
          @click="handleQuickScan"
        >
          <span>⚡ Quick Scout</span>
        </button>
        <button
          type="button"
          class="btn btn-sm rounded-xl font-black gap-2 px-4 transition-all"
          :class="currentView === 'list' ? 'btn-secondary text-secondary-content shadow-sm' : 'btn-ghost text-base-content/75'"
          @click="handleBackToList"
        >
          <span>📌 Buy Trackers</span>
          <span
            v-if="draftPurchases.length > 0"
            class="badge badge-xs font-mono font-bold"
            :class="currentView === 'list' ? 'badge-neutral' : 'badge-secondary'"
          >
            {{ draftPurchases.length }}
          </span>
        </button>
      </div>
    </div>

    <!-- 0. Wait for the session check so guests never flash member-only trackers -->
    <div v-if="authLoading" class="flex justify-center py-16">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- 1. DRAFT PURCHASES / BUY TRACKERS DASHBOARD (/scout/trackers) -->
    <ScoutPurchaseList 
      v-else-if="currentView === 'list' && isAuthenticated"
      @start-purchase="handleStartPurchase"
      @resume-purchase="handleResumePurchase"
      @quick-scan="handleQuickScan"
    />

    <!-- 2. SCOUT SCANNER COCKPIT (/scout) -->
    <ScoutView 
      v-else
      :initial-purchase-id="isAuthenticated ? activePurchaseId : null"
      :is-quick-scan="isQuickScanMode"
      @back-to-list="handleBackToList"
      @purchase-completed="handlePurchaseCompleted"
    />

    <!-- 3. EXPANDABLE ACTIVE / PAUSED PURCHASE MANIFEST TRAY (members only) -->
    <ScoutPurchaseTray 
      v-if="isAuthenticated"
      :is-open="isTrayOpen" 
      :paused-tracker="pausedTracker"
      @toggle-tray="toggleTray(false)" 
      @purchase-completed="handlePurchaseCompleted" 
      @resume-tracker="handleResumePurchase"
      @go-to-list="handleBackToList"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import ScoutPurchaseList from './ScoutPurchaseList.vue';
import ScoutView from './ScoutView.vue';
import ScoutPurchaseTray from './ScoutPurchaseTray.vue';
import { useAuth } from '../../composables/useAuth';
import { useScoutPurchase, type ScoutPurchase } from '../../composables/useScoutPurchase';

const props = defineProps<{
  initialView?: 'list' | 'scout';
}>();

const { isAuthenticated, loading: authLoading } = useAuth();

const authReady = () =>
  new Promise<void>((resolve) => {
    if (!authLoading.value) return resolve();
    const stop = watch(authLoading, (isLoading) => {
      if (!isLoading) {
        stop();
        resolve();
      }
    });
  });

const isTrackersPathOrQuery = () => {
  if (typeof window === 'undefined') return props.initialView === 'list';
  const path = (window.location.pathname || '').toLowerCase();
  const p = new URLSearchParams(window.location.search);
  return (
    props.initialView === 'list' ||
    path.includes('/scout/tracker') ||
    p.get('view') === 'trackers'
  );
};

const getInitialView = (): 'list' | 'scout' => {
  if (isTrackersPathOrQuery()) return 'list';
  return 'scout';
};

const getInitialPurchaseId = () => {
  if (typeof window === 'undefined') return null;
  const p = new URLSearchParams(window.location.search);
  return p.get('purchase') || null;
};

const getInitialQuickScan = () => {
  if (typeof window === 'undefined') return true;
  if (isTrackersPathOrQuery()) return false;
  const p = new URLSearchParams(window.location.search);
  return p.has('rescout') || p.get('quick') === 'true' || !p.has('purchase');
};

const currentView = ref<'list' | 'scout'>(getInitialView());
const activePurchaseId = ref<string | null>(getInitialPurchaseId());
const isQuickScanMode = ref(getInitialQuickScan());

const { 
  setActivePurchase, 
  loadPurchaseById, 
  loadDraftPurchases,
  draftPurchases,
  activePurchase, 
  pausedTracker, 
  isTrayOpen, 
  toggleTray 
} = useScoutPurchase();

let syncBroadcastChannel: BroadcastChannel | null = null;
let handleVisibilityChange: (() => void) | null = null;

const refreshTrackersSilently = async () => {
  if (!isAuthenticated.value) return;
  try {
    await loadDraftPurchases();
    if (activePurchase.value?.$id) {
      await loadPurchaseById(activePurchase.value.$id);
    }
  } catch {}
};

onMounted(async () => {
  await authReady();
  if (!isAuthenticated.value) {
    currentView.value = 'scout';
    activePurchaseId.value = null;
    isQuickScanMode.value = true;
    return;
  }

  await loadDraftPurchases().catch(err => {
    console.warn('[ScoutContainer] Failed to load draft purchases:', err);
  });

  const urlParams = new URLSearchParams(window.location.search);
  
  if (isTrackersPathOrQuery()) {
    currentView.value = 'list';
    activePurchaseId.value = null;
    isQuickScanMode.value = false;
    updateBrowserUrl('/scout/trackers', '');
  } else if (urlParams.has('purchase')) {
    const pId = urlParams.get('purchase');
    activePurchaseId.value = pId;
    isQuickScanMode.value = false;
    currentView.value = 'scout';
    if (pId && (!activePurchase.value || activePurchase.value.$id !== pId)) {
      await loadPurchaseById(pId).catch(err => {
        console.warn('[ScoutContainer] Failed to load purchase from URL:', err);
      });
    }
  } else {
    isQuickScanMode.value = true;
    currentView.value = 'scout';
    setActivePurchase(null);
  }

  if (typeof window !== 'undefined') {
    handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshTrackersSilently();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (typeof window.BroadcastChannel === 'function') {
      try {
        syncBroadcastChannel = new window.BroadcastChannel('resale_command_sync');
        syncBroadcastChannel.onmessage = () => {
          refreshTrackersSilently();
        };
      } catch {}
    }
  }
});

onUnmounted(() => {
  if (handleVisibilityChange && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  }
  if (syncBroadcastChannel) {
    try { syncBroadcastChannel.close(); } catch {}
    syncBroadcastChannel = null;
  }
});

const handleStartPurchase = (purchase: ScoutPurchase) => {
  activePurchaseId.value = purchase.$id;
  isQuickScanMode.value = false;
  currentView.value = 'scout';
  updateBrowserUrl('/scout', `purchase=${purchase.$id}`);
  try {
    setActivePurchase(purchase);
  } catch (e) {
    console.error('[ScoutContainer] Error starting purchase:', e);
  }
};

const handleResumePurchase = (purchase: ScoutPurchase) => {
  activePurchaseId.value = purchase.$id;
  isQuickScanMode.value = false;
  currentView.value = 'scout';
  updateBrowserUrl('/scout', `purchase=${purchase.$id}`);
  try {
    setActivePurchase(purchase);
  } catch (e) {
    console.error('[ScoutContainer] Error resuming purchase:', e);
  }
};

const handleQuickScan = () => {
  activePurchaseId.value = null;
  isQuickScanMode.value = true;
  currentView.value = 'scout';
  updateBrowserUrl('/scout', '');
  try {
    setActivePurchase(null);
  } catch (e) {}
};

const handleBackToList = () => {
  currentView.value = 'list';
  activePurchaseId.value = null;
  isQuickScanMode.value = false;
  updateBrowserUrl('/scout/trackers', '');
  refreshTrackersSilently();
  try {
    setActivePurchase(null);
  } catch (e) {}
};

const handlePurchaseCompleted = () => {
  currentView.value = 'list';
  activePurchaseId.value = null;
  isQuickScanMode.value = false;
  updateBrowserUrl('/scout/trackers', '');
  refreshTrackersSilently();
  try {
    setActivePurchase(null);
  } catch (e) {}
};

const updateBrowserUrl = (path: string, query: string) => {
  try {
    const newUrl = query ? `${path}?${query}` : path;
    window.history.replaceState({}, '', newUrl);
  } catch (e) {
    // Ignore in non-browser environments
  }
};
</script>

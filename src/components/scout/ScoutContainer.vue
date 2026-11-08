<template>
  <div>
    <!-- 0. Wait for the session check so guests never flash member-only trackers -->
    <div v-if="authLoading" class="flex justify-center py-16">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- 1. DRAFT PURCHASES LANDING DASHBOARD (members only) -->
    <ScoutPurchaseList 
      v-else-if="currentView === 'list' && isAuthenticated"
      @start-purchase="handleStartPurchase"
      @resume-purchase="handleResumePurchase"
      @quick-scan="handleQuickScan"
    />

    <!-- 2. SCOUT SCANNER COCKPIT (guests get the limited Guest Preview) -->
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
import { ref, onMounted, watch } from 'vue';
import ScoutPurchaseList from './ScoutPurchaseList.vue';
import ScoutView from './ScoutView.vue';
import ScoutPurchaseTray from './ScoutPurchaseTray.vue';
import { useAuth } from '../../composables/useAuth';
import { useScoutPurchase, type ScoutPurchase } from '../../composables/useScoutPurchase';

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

const getInitialView = () => {
  if (typeof window === 'undefined') return 'scout';
  const p = new URLSearchParams(window.location.search);
  if (p.get('view') === 'trackers') {
    return 'list';
  }
  return 'scout';
};

const getInitialPurchaseId = () => {
  if (typeof window === 'undefined') return null;
  const p = new URLSearchParams(window.location.search);
  return p.get('purchase') || null;
};

const getInitialQuickScan = () => {
  if (typeof window === 'undefined') return true;
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
  activePurchase, 
  pausedTracker, 
  isTrayOpen, 
  toggleTray 
} = useScoutPurchase();

onMounted(async () => {
  await authReady();
  if (!isAuthenticated.value) {
    // Guest Preview: no trackers, no purchases — straight to the limited scanner.
    currentView.value = 'scout';
    activePurchaseId.value = null;
    isQuickScanMode.value = true;
    return;
  }

  await loadDraftPurchases().catch(err => {
    console.warn('[ScoutContainer] Failed to load draft purchases:', err);
  });

  const urlParams = new URLSearchParams(window.location.search);
  
  if (urlParams.get('view') === 'trackers') {
    currentView.value = 'list';
    activePurchaseId.value = null;
    isQuickScanMode.value = false;
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
    // Untethered direct scout mode (Default)
    isQuickScanMode.value = true;
    currentView.value = 'scout';
    setActivePurchase(null);
  }
});

const handleStartPurchase = (purchase: ScoutPurchase) => {
  activePurchaseId.value = purchase.$id;
  isQuickScanMode.value = false;
  currentView.value = 'scout';
  updateUrlParams(`purchase=${purchase.$id}`);
  try {
    setActivePurchase(purchase);
  } catch (e) {
    console.error('[ScoutContainer] Error starting purchase:', e);
  }
};

const handleResumePurchase = (purchase: ScoutPurchase) => {
  console.log('[ScoutContainer] handleResumePurchase:', purchase.$id);
  activePurchaseId.value = purchase.$id;
  isQuickScanMode.value = false;
  currentView.value = 'scout'; // Switch view immediately
  updateUrlParams(`purchase=${purchase.$id}`);
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
  updateUrlParams('quick=true');
  try {
    setActivePurchase(null);
  } catch (e) {}
};

const handleBackToList = () => {
  currentView.value = 'list';
  activePurchaseId.value = null;
  isQuickScanMode.value = false;
  updateUrlParams('');
  try {
    setActivePurchase(null);
  } catch (e) {}
};

const handlePurchaseCompleted = (purchaseId: string) => {
  currentView.value = 'list';
  activePurchaseId.value = null;
  isQuickScanMode.value = false;
  updateUrlParams('');
  try {
    setActivePurchase(null);
  } catch (e) {}
};

const updateUrlParams = (query: string) => {
  try {
    const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  } catch (e) {
    // Ignore in non-browser environments
  }
};
</script>

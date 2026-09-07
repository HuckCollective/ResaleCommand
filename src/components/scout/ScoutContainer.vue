<template>
  <div>
    <!-- 1. DRAFT PURCHASES LANDING DASHBOARD -->
    <ScoutPurchaseList 
      v-if="currentView === 'list'"
      @start-purchase="handleStartPurchase"
      @resume-purchase="handleResumePurchase"
      @quick-scan="handleQuickScan"
    />

    <!-- 2. SCOUT SCANNER COCKPIT -->
    <ScoutView 
      v-else
      :initial-purchase-id="activePurchaseId"
      :is-quick-scan="isQuickScanMode"
      @back-to-list="handleBackToList"
      @purchase-completed="handlePurchaseCompleted"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import ScoutPurchaseList from './ScoutPurchaseList.vue';
import ScoutView from './ScoutView.vue';
import { useScoutPurchase, type ScoutPurchase } from '../../composables/useScoutPurchase';

const getInitialView = () => {
  if (typeof window === 'undefined') return 'list';
  const p = new URLSearchParams(window.location.search);
  if (p.has('rescout') || p.get('quick') === 'true' || p.has('purchase')) {
    return 'scout';
  }
  return 'list';
};

const getInitialPurchaseId = () => {
  if (typeof window === 'undefined') return null;
  const p = new URLSearchParams(window.location.search);
  return p.get('purchase') || null;
};

const getInitialQuickScan = () => {
  if (typeof window === 'undefined') return false;
  const p = new URLSearchParams(window.location.search);
  return p.has('rescout') || p.get('quick') === 'true';
};

const currentView = ref<'list' | 'scout'>(getInitialView());
const activePurchaseId = ref<string | null>(getInitialPurchaseId());
const isQuickScanMode = ref(getInitialQuickScan());

const { setActivePurchase, loadPurchaseById, activePurchase } = useScoutPurchase();

onMounted(async () => {
  const urlParams = new URLSearchParams(window.location.search);
  
  if (urlParams.has('rescout') || urlParams.get('quick') === 'true') {
    isQuickScanMode.value = true;
    currentView.value = 'scout';
    setActivePurchase(null);
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
    // Untethered default
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

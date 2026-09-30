import { ref, computed } from 'vue';
import { 
  type Dropcast, 
  type CastType, 
  type CastStatus, 
  getSavedDropcasts, 
  saveDropcast, 
  deleteDropcast, 
  duplicateDropcast,
  createQuickCast, 
  createCustomCast,
  CAST_TYPE_META,
  CAST_STATUS_META
} from '../lib/dropcastModel';
import type { SocialStudioItem } from '../lib/socialMediaStudio';
import { addToast } from '../stores/toast';

const dropcastsList = ref<Dropcast[]>([]);
const activeCast = ref<Dropcast | null>(null);
const currentView = ref<'hub' | 'studio'>('hub');
const filterStatus = ref<'all' | 'draft' | 'ready' | 'broadcasted'>('all');
const filterLocation = ref<string>('all');
const filterSearch = ref<string>('');
const isCastTrayOpen = ref(false);
const isInitialized = ref(false);

export function useDropcasts() {
  function ensureActiveCast(): Dropcast {
    dropcastsList.value = getSavedDropcasts();
    if (dropcastsList.value.length === 0) {
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const initial = createCustomCast(`Memory Den Dropcast — ${dateStr}`, 'Memory Den');
      dropcastsList.value = [initial];
      activeCast.value = initial;
      return initial;
    }

    if (!activeCast.value || (activeCast.value.status !== 'draft' && activeCast.value.status !== 'paused')) {
      const firstDraft = dropcastsList.value.find(c => c.status === 'draft');
      const firstPaused = dropcastsList.value.find(c => c.status === 'paused');
      if (firstDraft) {
        activeCast.value = firstDraft;
      } else if (firstPaused) {
        activeCast.value = firstPaused;
      } else {
        const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const newDraft = createCustomCast(`Memory Den Dropcast — ${dateStr}`, 'Memory Den');
        dropcastsList.value = [newDraft, ...dropcastsList.value];
        activeCast.value = newDraft;
      }
    } else {
      const updated = dropcastsList.value.find(c => c.id === activeCast.value?.id);
      if (updated) {
        activeCast.value = updated;
      }
    }
    return activeCast.value!;
  }

  function refresh() {
    ensureActiveCast();
  }

  if (!isInitialized.value) {
    ensureActiveCast();
    isInitialized.value = true;
  }

  const counts = computed(() => {
    const list = dropcastsList.value;
    return {
      total: list.length,
      drafts: list.filter(c => c.status === 'draft').length,
      paused: list.filter(c => c.status === 'paused').length,
      ready: list.filter(c => c.status === 'ready').length,
      broadcasted: list.filter(c => c.status === 'broadcasted').length,
    };
  });

  const isCastActive = computed<boolean>(() => {
    return Boolean(activeCast.value && activeCast.value.status === 'draft');
  });

  const isCastPaused = computed<boolean>(() => {
    return Boolean(activeCast.value && activeCast.value.status === 'paused');
  });

  const stagedCastItems = computed<SocialStudioItem[]>(() => {
    return activeCast.value?.items || [];
  });

  const stagedCastCount = computed<number>(() => {
    return (activeCast.value?.items || []).length;
  });

  const stagedCastTotalRetail = computed<number>(() => {
    return (activeCast.value?.items || []).reduce(
      (acc, i) => acc + Number(i.boutiquePrice || i.resalePrice || i.price || 0), 
      0
    );
  });

  const filteredDropcasts = computed(() => {
    let list = dropcastsList.value;

    // Status filter
    if (filterStatus.value !== 'all') {
      list = list.filter(c => c.status === filterStatus.value);
    }

    // Location filter
    if (filterLocation.value !== 'all') {
      list = list.filter(c => 
        (c.locationCode && c.locationCode.toLowerCase() === filterLocation.value.toLowerCase()) ||
        (c.locationName && c.locationName.toLowerCase().includes(filterLocation.value.toLowerCase()))
      );
    }

    // Search filter
    const q = filterSearch.value.trim().toLowerCase();
    if (q) {
      list = list.filter(c => 
        (c.title || '').toLowerCase().includes(q) ||
        (c.locationName || '').toLowerCase().includes(q) ||
        (c.items || []).some(it => (it.title || '').toLowerCase().includes(q) || (it.brand || '').toLowerCase().includes(q))
      );
    }

    return list;
  });

  function openStudio(cast: Dropcast) {
    activeCast.value = { ...cast };
    currentView.value = 'studio';
    isCastTrayOpen.value = false;

    if (typeof window !== 'undefined' && window.history?.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.set('cast', cast.id);
      window.history.replaceState({}, '', url.toString());
    }
  }

  function openStudioById(idOrIndex: string | number): Dropcast | null {
    refresh();
    const list = dropcastsList.value;
    let target: Dropcast | undefined;

    const str = String(idOrIndex || '').trim();
    if (!str) return null;

    // 1. Exact ID match
    target = list.find(c => c.id === str);

    // 2. Numeric index match (e.g. "1" for 1st cast, "2" for 2nd)
    if (!target && !isNaN(Number(str))) {
      const num = Number(str);
      if (num >= 1 && num <= list.length) {
        target = list[num - 1];
      } else if (num >= 0 && num < list.length) {
        target = list[num];
      }
    }

    // 3. Partial case-insensitive match on ID or Title
    if (!target) {
      const q = str.toLowerCase();
      target = list.find(c => c.id.toLowerCase().includes(q) || (c.title || '').toLowerCase().includes(q));
    }

    if (target) {
      openStudio(target);
      return target;
    }
    return null;
  }

  function returnToHub() {
    if (activeCast.value) {
      saveActiveCast();
    }
    refresh();
    currentView.value = 'hub';

    if (typeof window !== 'undefined' && window.history?.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.delete('cast');
      url.searchParams.delete('id');
      window.history.replaceState({}, '', url.toString());
    }
  }

  function saveActiveCast() {
    if (!activeCast.value) return;
    saveDropcast(activeCast.value);
    refresh();
  }

  function updateActiveCast(changes: Partial<Dropcast>) {
    if (!activeCast.value) return;
    activeCast.value = {
      ...activeCast.value,
      ...changes,
      updatedAt: new Date().toISOString()
    };
    saveDropcast(activeCast.value);
    refresh();
  }

  function startCustomCast(title?: string, locationName: string = 'Memory Den') {
    const cast = createCustomCast(title, locationName);
    refresh();
    openStudio(cast);
  }

  function startQuickCast(type: CastType, options?: { manifest?: any; items?: any[]; locationName?: string; locationCode?: string; title?: string }) {
    const cast = createQuickCast(type, options);
    refresh();
    openStudio(cast);
    addToast({ type: 'success', message: `Created ${CAST_TYPE_META[type].emoji} ${CAST_TYPE_META[type].label}!` });
  }

  function removeCast(id: string) {
    const cast = dropcastsList.value.find(c => c.id === id);
    dropcastsList.value = deleteDropcast(id);
    if (activeCast.value?.id === id) {
      activeCast.value = dropcastsList.value[0] || null;
      currentView.value = 'hub';
    }
    addToast({ type: 'info', message: `Deleted cast "${cast?.title || id}"` });
  }

  function duplicate(id: string) {
    const copy = duplicateDropcast(id);
    refresh();
    if (copy) {
      addToast({ type: 'success', message: `Duplicated "${copy.title}"` });
    }
  }

  function setStatus(id: string, status: CastStatus) {
    const cast = dropcastsList.value.find(c => c.id === id);
    if (!cast) return;
    cast.status = status;
    saveDropcast(cast);
    refresh();
    addToast({ type: 'info', message: `Updated status to ${CAST_STATUS_META[status].label}` });
  }

  function setActiveCast(cast: Dropcast) {
    activeCast.value = cast;
    saveDropcast(cast);
    refresh();
  }

  // ==========================================
  // ACTION BAR STAGING TRAY INTEGRATION
  // ==========================================

  function openCastTray() {
    isCastTrayOpen.value = true;
  }

  function closeCastTray() {
    isCastTrayOpen.value = false;
  }

  function toggleCastTray() {
    isCastTrayOpen.value = !isCastTrayOpen.value;
  }

  /**
   * Pauses the active dropcast so that newly selected inventory items are NOT auto-staged.
   */
  function pauseActiveCast() {
    if (!activeCast.value) return;
    activeCast.value.status = 'paused';
    saveActiveCast();
    addToast({
      type: 'warning',
      message: `⏸️ Paused Dropcast "${activeCast.value.title}" — selections will not auto-stage.`
    });
  }

  /**
   * Resumes a paused dropcast back to 'draft' mode so it actively receives auto-staged items.
   */
  function resumeActiveCast(castId?: string) {
    if (castId) {
      const match = dropcastsList.value.find(c => c.id === castId);
      if (match) activeCast.value = match;
    }
    if (!activeCast.value) return;
    activeCast.value.status = 'draft';
    saveActiveCast();
    addToast({
      type: 'success',
      message: `▶️ Resumed Dropcast "${activeCast.value.title}" — active for auto-staging!`
    });
  }

  function togglePauseCast() {
    if (!activeCast.value) return;
    if (activeCast.value.status === 'paused') {
      resumeActiveCast();
    } else {
      pauseActiveCast();
    }
  }

  /**
   * Stages items from inventory (or any table/view) into the currently active Dropcast.
   * If no active dropcast exists, auto-creates a new Draft.
   */
  function stageItemsForCast(items: any[], options?: { castId?: string; openTray?: boolean; silent?: boolean }): number {
    if (!items || items.length === 0) return 0;

    // Ensure we have an active cast
    if (options?.castId) {
      const match = dropcastsList.value.find(c => c.id === options.castId);
      if (match) activeCast.value = match;
    }

    if (!activeCast.value) {
      activeCast.value = createCustomCast(
        `Inventory Dropcast — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        'Memory Den'
      );
    }

    // If cast is paused and this was an explicit user action (openTray === true), un-pause it
    if (activeCast.value.status === 'paused' && options?.openTray) {
      activeCast.value.status = 'draft';
    }

    const currentItems = [...(activeCast.value.items || [])];
    const currentKeys = new Set<string>();
    for (const it of currentItems) {
      if (it.$id) currentKeys.add(String(it.$id));
      if (it.id) currentKeys.add(String(it.id));
      if (it.upc) currentKeys.add(`upc:${it.upc}`);
    }

    let added = 0;
    for (const raw of items) {
      const rawId = raw.$id || raw.id;
      const rawUpc = raw.upc ? `upc:${raw.upc}` : null;
      const isAlreadyAdded = (rawId && currentKeys.has(String(rawId))) || (rawUpc && currentKeys.has(rawUpc));

      if (!isAlreadyAdded) {
        const formatted: SocialStudioItem = {
          id: raw.$id || raw.id,
          $id: raw.$id || raw.id,
          title: raw.title || 'Untitled Item',
          resalePrice: raw.boutiquePrice || raw.resalePrice || raw.price || 0,
          boutiquePrice: raw.boutiquePrice || raw.resalePrice || raw.price || 0,
          cost: raw.cost || 0,
          upc: raw.upc,
          brand: raw.brand,
          category: raw.category,
          condition: raw.condition,
          storageLocation: raw.storageLocation,
          imageId: raw.imageId || (Array.isArray(raw.images) && raw.images[0]),
          galleryImageIds: raw.galleryImageIds || []
        };
        currentItems.push(formatted);
        if (formatted.$id) currentKeys.add(String(formatted.$id));
        if (formatted.id) currentKeys.add(String(formatted.id));
        if (formatted.upc) currentKeys.add(`upc:${formatted.upc}`);
        added++;
      }
    }

    activeCast.value.items = currentItems;
    activeCast.value.totalRetailValue = currentItems.reduce(
      (sum, it) => sum + Number(it.boutiquePrice || it.resalePrice || it.price || 0), 
      0
    );

    saveActiveCast();

    if (options?.openTray === true) {
      isCastTrayOpen.value = true;
    }

    if (!options?.silent && added > 0) {
      addToast({ 
        type: 'success', 
        message: `Staged ${added} item${added === 1 ? '' : 's'} for Dropcast "${activeCast.value.title}"! 📡` 
      });
    }

    return added;
  }

  /**
   * Removes a single item from the active dropcast.
   */
  function unstageItemFromCast(itemId: string) {
    if (!activeCast.value || !activeCast.value.items) return;
    const initialLen = activeCast.value.items.length;
    activeCast.value.items = activeCast.value.items.filter(
      i => String(i.$id || i.id) !== String(itemId)
    );
    if (Array.isArray(activeCast.value.slides)) {
      activeCast.value.slides = activeCast.value.slides.filter(
        s => String(s.sourceItemId) !== String(itemId)
      );
    }
    activeCast.value.totalRetailValue = activeCast.value.items.reduce(
      (sum, it) => sum + Number(it.boutiquePrice || it.resalePrice || it.price || 0), 
      0
    );
    saveActiveCast();
    if (activeCast.value.items.length < initialLen) {
      addToast({ type: 'info', message: 'Item removed from Dropcast staging.' });
    }
  }

  /**
   * Clears all staged items from the active dropcast.
   */
  function clearCastStaging() {
    if (!activeCast.value) return;
    activeCast.value.items = [];
    activeCast.value.slides = [];
    activeCast.value.totalRetailValue = 0;
    saveActiveCast();
    addToast({ type: 'info', message: 'Cleared all staged items from Dropcast.' });
  }

  return {
    dropcastsList,
    filteredDropcasts,
    activeCast,
    currentView,
    filterStatus,
    filterLocation,
    filterSearch,
    counts,
    isCastTrayOpen,
    isCastActive,
    isCastPaused,
    stagedCastItems,
    stagedCastCount,
    stagedCastTotalRetail,
    ensureActiveCast,
    refresh,
    openStudio,
    openStudioById,
    returnToHub,
    saveActiveCast,
    updateActiveCast,
    startCustomCast,
    startQuickCast,
    removeCast,
    duplicate,
    setStatus,
    setActiveCast,
    openCastTray,
    closeCastTray,
    toggleCastTray,
    pauseActiveCast,
    resumeActiveCast,
    togglePauseCast,
    stageItemsForCast,
    unstageItemFromCast,
    clearCastStaging,
    CAST_TYPE_META,
    CAST_STATUS_META
  };
}

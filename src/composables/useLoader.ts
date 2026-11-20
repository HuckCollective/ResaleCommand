import { ref, reactive } from 'vue';

// Global shared state for the full-page HuckleberryLoader (Bucket 3)
const globalLoading = ref(false);
const externalLoaderActive = ref(false);
const loaderMessage = ref("Picking, Counting, Shipping or Finding...");
const loaderStep = ref("");
const loaderProgress = ref<number | null>(null);
const loaderBasket = ref("");
const loaderBerries = ref<string | string[]>("");
const loaderBasketColor = ref("");
const loaderBerryColor = ref("");
const loaderBackgroundColor = ref("");
const loaderCancelable = ref(true);

let activeOnCancel: (() => void) | null = null;
let safetyTimer: any = null;
let antiStrobeTimer: any = null;

// Lightweight scoped loading map for individual components/cards (Bucket 2)
const scopedLoadingMap = reactive(new Map<string, boolean>());

// Non-blocking ambient top-center sync pill (Bucket 1.5 — saves, quick status flips, background syncs)
const ambientSyncCount = ref(0);
const ambientSyncLabel = ref('');
const ambientDoneLabel = ref('');
let ambientDoneTimer: any = null;

/**
 * Universal 3-Bucket UX Timing Standard (NN/g):
 * 
 * - Bucket 1 (< 1s Micro-Actions): Optimistic UI + Toast (zero blocking modal). 
 *   The 150ms anti-strobe debounce in showLoader guarantees that instantaneous calls never flash the screen.
 * 
 * - Bucket 2 (1s - 3s Scoped Asset Load): Localized skeleton shimmers/spinners via setScopedLoading / isScopedLoading.
 *   Prevents viewport locking for card-level or row-level fetching.
 * 
 * - Bucket 3 (> 3s AI Vision, Auto-Crop, Lot Split, CSV Sync): Full-page branded HuckleberryLoader
 *   with step-by-step progress, percentage bar, and a 5-second safety timer that automatically enables cancelation.
 */
export function useLoader() {
    /**
     * Bucket 2: Scoped loading state helper for individual cards, thumbnails, or sections.
     * Prevents viewport-blocking modals during 1s - 3s localized operations.
     */
    const setScopedLoading = (key: string, loading: boolean) => {
        if (!key) return;
        if (loading) {
            scopedLoadingMap.set(key, true);
        } else {
            scopedLoadingMap.delete(key);
        }
    };

    const isScopedLoading = (key: string): boolean => {
        return scopedLoadingMap.get(key) === true;
    };

    /**
     * Bucket 3: Full-Page HuckleberryLoader for heavy operations (> 3s).
     * Includes a 150ms anti-strobe debounce to prevent visual flashing on instantaneous calls (< 150ms),
     * and a 5-second safety timer that automatically enables user cancellation if an operation hangs.
     */
    const showLoader = (
        msg = "Picking, Counting, Shipping or Finding...", 
        options?: { 
            step?: string,
            progress?: number,
            basket?: string, 
            berries?: string | string[], 
            basketColor?: string, 
            berryColor?: string, 
            backgroundColor?: string, 
            cancelable?: boolean, 
            onCancel?: () => void,
            immediate?: boolean,
            debounceMs?: number
        }
    ) => {
        // Guard: Never spawn a competing global loader when an external progress modal (e.g. BulkImport) is active
        if (externalLoaderActive.value) {
            return;
        }
        // Clear any previous anti-strobe or safety timers
        if (antiStrobeTimer) {
            clearTimeout(antiStrobeTimer);
            antiStrobeTimer = null;
        }
        if (safetyTimer) {
            clearTimeout(safetyTimer);
            safetyTimer = null;
        }

        loaderMessage.value = msg;
        loaderStep.value = options?.step || "";
        loaderProgress.value = options?.progress !== undefined ? options.progress : null;
        if (options?.basket) loaderBasket.value = options.basket;
        if (options?.berries) loaderBerries.value = options.berries;
        if (options?.basketColor) loaderBasketColor.value = options.basketColor;
        if (options?.berryColor) loaderBerryColor.value = options.berryColor;
        if (options?.backgroundColor) loaderBackgroundColor.value = options.backgroundColor;
        loaderCancelable.value = options?.cancelable !== false;
        activeOnCancel = options?.onCancel || null;

        const activateLoader = () => {
            globalLoading.value = true;
            // 5-Second Safety Timer: Automatically enables cancel button if blocking loader exceeds 5s
            safetyTimer = setTimeout(() => {
                if (globalLoading.value) {
                    loaderCancelable.value = true;
                }
            }, 5000);
        };

        const debounceDelay = options?.immediate ? 0 : (options?.debounceMs ?? 150);
        if (debounceDelay <= 0) {
            activateLoader();
        } else {
            antiStrobeTimer = setTimeout(activateLoader, debounceDelay);
        }
    };
    
    const triggerCancel = () => {
        if (activeOnCancel) activeOnCancel();
        hideLoader();
    };
    
    const hideLoader = () => {
        if (antiStrobeTimer) {
            clearTimeout(antiStrobeTimer);
            antiStrobeTimer = null;
        }
        if (safetyTimer) {
            clearTimeout(safetyTimer);
            safetyTimer = null;
        }
        globalLoading.value = false;
        // Reset state
        loaderMessage.value = "Picking, Counting, Shipping or Finding...";
        loaderStep.value = "";
        loaderProgress.value = null;
        loaderBasket.value = "";
        loaderBerries.value = "";
        loaderBasketColor.value = "";
        loaderBerryColor.value = "";
        loaderBackgroundColor.value = "";
        loaderCancelable.value = true;
        activeOnCancel = null;
    };

    const updateLoader = (msg?: string, step?: string, progress?: number) => {
        if (msg) loaderMessage.value = msg;
        if (step !== undefined) loaderStep.value = step;
        if (progress !== undefined) loaderProgress.value = progress;
    };

    const setExternalLoaderActive = (active: boolean) => {
        externalLoaderActive.value = active;
        if (active && globalLoading.value) {
            hideLoader();
        }
    };

    const finishAmbientSync = (doneText: string = '✅ Saved') => {
        if (ambientDoneTimer) {
            clearTimeout(ambientDoneTimer);
            ambientDoneTimer = null;
        }
        if (ambientSyncCount.value > 0) {
            ambientSyncCount.value = Math.max(0, ambientSyncCount.value - 1);
        }
        if (ambientSyncCount.value === 0) {
            ambientSyncLabel.value = '';
            const cleanDone = String(doneText || '').trim();
            if (cleanDone) {
                ambientDoneLabel.value = cleanDone;
                ambientDoneTimer = setTimeout(() => {
                    ambientDoneLabel.value = '';
                    ambientDoneTimer = null;
                }, 1800);
                if (typeof ambientDoneTimer === 'object' && ambientDoneTimer !== null && typeof ambientDoneTimer.unref === 'function') {
                    ambientDoneTimer.unref();
                }
            }
        }
    };

    const startAmbientSync = (label: string = 'Saving…'): ((doneText?: string) => void) => {
        const cleanLabel = String(label || '').trim();
        if (!cleanLabel) return () => {};
        if (ambientDoneTimer) {
            clearTimeout(ambientDoneTimer);
            ambientDoneTimer = null;
        }
        ambientDoneLabel.value = '';
        ambientSyncCount.value += 1;
        ambientSyncLabel.value = cleanLabel;
        let finished = false;
        return (doneText: string = '✅ Saved') => {
            if (finished) return;
            finished = true;
            finishAmbientSync(doneText);
        };
    };
    
    return { 
        globalLoading, 
        externalLoaderActive,
        loaderMessage, 
        loaderStep, 
        loaderProgress, 
        loaderBasket, 
        loaderBerries, 
        loaderBasketColor, 
        loaderBerryColor, 
        loaderBackgroundColor, 
        loaderCancelable, 
        ambientSyncCount,
        ambientSyncLabel,
        ambientDoneLabel,
        showLoader, 
        hideLoader, 
        triggerCancel, 
        updateLoader,
        setExternalLoaderActive,
        setScopedLoading,
        isScopedLoading,
        scopedLoadingMap,
        startAmbientSync,
        finishAmbientSync
    };
}

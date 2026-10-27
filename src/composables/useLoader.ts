import { ref, reactive } from 'vue';

// Global shared state for the full-page HuckleberryLoader (Bucket 3)
const globalLoading = ref(false);
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
    
    return { 
        globalLoading, 
        loaderMessage, 
        loaderStep, 
        loaderProgress, 
        loaderBasket, 
        loaderBerries, 
        loaderBasketColor, 
        loaderBerryColor, 
        loaderBackgroundColor, 
        loaderCancelable, 
        showLoader, 
        hideLoader, 
        triggerCancel, 
        updateLoader,
        setScopedLoading,
        isScopedLoading,
        scopedLoadingMap
    };
}

import { ref } from 'vue';

// Global shared state for the loader
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

export function useLoader() {
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
            onCancel?: () => void 
        }
    ) => {
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
        globalLoading.value = true;

        // Safety fallback: If loader is active for more than 5s, always ensure user can cancel/dismiss it
        if (safetyTimer) clearTimeout(safetyTimer);
        safetyTimer = setTimeout(() => {
            if (globalLoading.value) {
                loaderCancelable.value = true;
            }
        }, 5000);
    };
    
    const triggerCancel = () => {
        if (activeOnCancel) activeOnCancel();
        hideLoader();
    };
    
    const hideLoader = () => {
        if (safetyTimer) {
            clearTimeout(safetyTimer);
            safetyTimer = null;
        }
        globalLoading.value = false;
        // Reset to default
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
        if (globalLoading.value) {
            if (msg) loaderMessage.value = msg;
            if (step !== undefined) loaderStep.value = step;
            if (progress !== undefined) loaderProgress.value = progress;
        }
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
        updateLoader 
    };
}

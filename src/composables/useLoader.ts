import { ref } from 'vue';

// Global shared state for the loader
const globalLoading = ref(false);
const loaderMessage = ref("Picking, Counting, Shipping or Finding...");
const loaderBasket = ref("");
const loaderBerries = ref<string | string[]>("");
const loaderBasketColor = ref("");
const loaderBerryColor = ref("");
const loaderBackgroundColor = ref("");
const loaderCancelable = ref(true);
let activeOnCancel: (() => void) | null = null;

export function useLoader() {
    const showLoader = (msg = "Picking, Counting, Shipping or Finding...", options?: { basket?: string, berries?: string | string[], basketColor?: string, berryColor?: string, backgroundColor?: string, cancelable?: boolean, onCancel?: () => void }) => {
        loaderMessage.value = msg;
        if (options?.basket) loaderBasket.value = options.basket;
        if (options?.berries) loaderBerries.value = options.berries;
        if (options?.basketColor) loaderBasketColor.value = options.basketColor;
        if (options?.berryColor) loaderBerryColor.value = options.berryColor;
        if (options?.backgroundColor) loaderBackgroundColor.value = options.backgroundColor;
        loaderCancelable.value = options?.cancelable !== false;
        activeOnCancel = options?.onCancel || null;
        globalLoading.value = true;
    };
    
    const triggerCancel = () => {
        if (activeOnCancel) activeOnCancel();
        hideLoader();
    };
    
    const hideLoader = () => {
        globalLoading.value = false;
        // Reset to default
        loaderBasket.value = "";
        loaderBerries.value = "";
        loaderBasketColor.value = "";
        loaderBerryColor.value = "";
        loaderBackgroundColor.value = "";
        loaderCancelable.value = true;
        activeOnCancel = null;
    };

    const updateLoader = (msg: string) => {
        if (globalLoading.value) {
            loaderMessage.value = msg;
        }
    };
    
    return { globalLoading, loaderMessage, loaderBasket, loaderBerries, loaderBasketColor, loaderBerryColor, loaderBackgroundColor, loaderCancelable, showLoader, hideLoader, triggerCancel, updateLoader };
}

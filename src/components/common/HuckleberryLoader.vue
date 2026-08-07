<template>
    <div v-if="localShow" :class="['fixed inset-0 z-[9999] backdrop-blur-md flex flex-col items-center justify-center transition-opacity', activeBackgroundColor, fadeOut ? 'opacity-0 duration-700' : 'duration-0']">
        <div class="relative w-48 h-48 flex flex-col items-center">
            <!-- Berries falling -->
            <Icon :icon="activeBerries[0]" :class="['berry berry-fall w-5 h-5 absolute', activeBerryColor]" style="left: 20%; top: -30px; animation-delay: 0s;" />
            <Icon :icon="activeBerries[1]" :class="['berry berry-fall w-6 h-6 absolute', activeBerryColor]" style="left: 60%; top: -10px; animation-delay: 0.5s;" />
            <Icon :icon="activeBerries[2]" :class="['berry berry-fall w-4 h-4 absolute', activeBerryColor]" style="left: 40%; top: -40px; animation-delay: 0.2s;" />
            <Icon :icon="activeBerries[3]" :class="['berry berry-fall w-5 h-5 absolute', activeBerryColor]" style="left: 75%; top: -25px; animation-delay: 0.8s;" />
            
            <!-- Basket at bottom -->
            <!-- Allow customizing the basket icon via a prop in the future, for now using noto:basket -->
            <Icon :icon="activeBasket" :class="['w-32 h-32 absolute bottom-0 z-10 animate-[pulse_2s_ease-in-out_infinite]', activeBasketColor]" />
        </div>
        <h2 class="mt-8 text-3xl font-bold animate-[pulse_2s_ease-in-out_infinite] tracking-widest drop-shadow-md px-4 text-center" :class="activeBerryColor">{{ loaderMessage }}</h2>
        <button v-if="loaderCancelable" @click="triggerCancel" class="mt-8 btn btn-outline btn-error z-20">Cancel</button>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useLoader } from '../../composables/useLoader';

const props = defineProps({
    basketIcon: {
        type: String,
        default: 'lucide:shopping-basket'
    },
    berryIcon: {
        type: String,
        default: 'arcticons:huckleberry'
    },
    basketColor: {
        type: String,
        default: 'text-accent'
    },
    berryColor: {
        type: String,
        default: 'text-accent'
    },
    message: {
        type: String,
        default: ''
    }
});

const { globalLoading, loaderMessage, loaderBasket, loaderBerries, loaderBasketColor, loaderBerryColor, loaderBackgroundColor, loaderCancelable, triggerCancel } = useLoader();

const activeBasket = computed(() => loaderBasket.value || props.basketIcon);
const activeBasketColor = computed(() => loaderBasketColor.value || props.basketColor);
const activeBerryColor = computed(() => loaderBerryColor.value || props.berryColor);
const activeBackgroundColor = computed(() => {
    return loaderBackgroundColor.value || 'bg-base-100/80';
});

const activeBerries = computed(() => {
    const berries = loaderBerries.value || props.berryIcon;
    if (Array.isArray(berries) && berries.length > 0) {
        // Return 4 items, rotating through the array
        return [
            berries[0 % berries.length],
            berries[1 % berries.length],
            berries[2 % berries.length],
            berries[3 % berries.length]
        ];
    }
    return [berries, berries, berries, berries];
});

// If a custom message was passed as a prop, update the global state
if (props.message) {
    loaderMessage.value = props.message;
}

// Local state for smooth fade out
const localShow = ref(globalLoading.value);
const fadeOut = ref(!globalLoading.value);

watch(globalLoading, (isLoading) => {
    if (!isLoading) {
        fadeOut.value = true;
        setTimeout(() => {
            localShow.value = false;
        }, 700); // Wait for CSS transition to finish
    } else {
        localShow.value = true;
        fadeOut.value = false;
    }
});

onMounted(() => {
    // Sync initial state
    if (!globalLoading.value) {
        localShow.value = false;
    }
    
    // Listen for Vanilla JS / Astro events to control the loader
    window.addEventListener('huckleberry-show', (e: any) => {
        const { showLoader } = useLoader();
        showLoader(e.detail?.message);
    });
    
    window.addEventListener('huckleberry-hide', () => {
        const { hideLoader } = useLoader();
        hideLoader();
    });
});
</script>

<style scoped>
.berry {
    z-index: 0;
    animation: fall 1.5s ease-in-out infinite;
}

@keyframes fall {
    0% {
        transform: translateY(-80px) rotate(0deg) scale(0.5);
        opacity: 0;
    }
    15% {
        opacity: 1;
        transform: translateY(-40px) rotate(45deg) scale(1);
    }
    75% {
        opacity: 1;
        transform: translateY(60px) rotate(120deg) scale(1);
    }
    100% {
        transform: translateY(110px) rotate(180deg) scale(0);
        opacity: 0;
    }
}
</style>

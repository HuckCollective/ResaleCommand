<template>
  <div v-if="isAdmin" class="p-8 max-w-4xl mx-auto space-y-12">
    <h1 class="text-3xl font-bold mb-8 text-center">Basket Icon Preview</h1>
    <p class="text-center opacity-70 mb-12">Here are a few different styles of baskets you can use. Which one fits the vibe best?</p>

    <div class="grid grid-cols-2 md:grid-cols-3 gap-8">
      
      <!-- Option 1: Current Noto Emoji -->
      <div class="card bg-base-200 shadow-xl items-center p-6 gap-4">
        <Icon icon="noto:basket" class="w-32 h-32" />
        <h2 class="text-xl font-bold">1. Noto Basket</h2>
        <p class="text-sm opacity-60 text-center">Your current detailed, realistic woven basket.</p>
        <button class="btn btn-primary btn-sm" @click="testLoader('noto:basket', 'noto:blueberries')">Test Animation</button>
      </div>

      <!-- Option 2: Twemoji -->
      <div class="card bg-base-200 shadow-xl items-center p-6 gap-4">
        <Icon icon="twemoji:basket" class="w-32 h-32" />
        <h2 class="text-xl font-bold">2. Twemoji</h2>
        <p class="text-sm opacity-60 text-center">Apple-style smooth, bright, vector colors.</p>
        <button class="btn btn-primary btn-sm" @click="testLoader('twemoji:basket', 'twemoji:blueberries')">Test Animation</button>
      </div>

      <!-- Option 3: Fluent Emoji -->
      <div class="card bg-base-200 shadow-xl items-center p-6 gap-4">
        <Icon icon="fluent-emoji:basket" class="w-32 h-32" />
        <h2 class="text-xl font-bold">3. Fluent 3D</h2>
        <p class="text-sm opacity-60 text-center">Microsoft-style 3D rendered playful basket.</p>
        <button class="btn btn-primary btn-sm" @click="testLoader('fluent-emoji:basket', 'fluent-emoji:blueberries')">Test Animation</button>
      </div>

      <!-- Option 4: Line Art -->
      <div class="card bg-base-200 shadow-xl items-center p-6 gap-4">
        <Icon icon="mdi:basket-outline" class="w-32 h-32 text-primary" />
        <h2 class="text-xl font-bold">4. Material Line Art</h2>
        <p class="text-sm opacity-60 text-center">Modern, sleek, monochromatic line art.</p>
        <button class="btn btn-primary btn-sm" @click="testLoader('mdi:basket-outline', 'arcticons:huckleberry', 'text-primary', 'text-primary')">Test Animation</button>
      </div>
      
      <!-- Option 5: Flat Color -->
      <div class="card bg-base-200 shadow-xl items-center p-6 gap-4">
        <Icon icon="fluent-emoji-flat:basket" class="w-32 h-32" />
        <h2 class="text-xl font-bold">5. Fluent Flat</h2>
        <p class="text-sm opacity-60 text-center">2D flat colored basket without gradients.</p>
        <button class="btn btn-primary btn-sm" @click="testLoader('fluent-emoji-flat:basket', 'fluent-emoji-flat:blueberries')">Test Animation</button>
      </div>

      <!-- Option 6: Minimalist -->
      <div class="card bg-base-200 shadow-xl items-center p-6 gap-4">
        <Icon icon="lucide:shopping-basket" class="w-32 h-32 text-accent" />
        <h2 class="text-xl font-bold">6. Lucide Minimal</h2>
        <p class="text-sm opacity-60 text-center">Extremely clean and minimalist outline.</p>
        <button class="btn btn-primary btn-sm" @click="testLoader('lucide:shopping-basket', 'arcticons:huckleberry', 'text-accent', 'text-accent')">Test Animation</button>
      </div>

      <!-- Option 7: AI Scout Theme -->
      <div class="card bg-primary text-primary-content shadow-xl items-center p-6 gap-4">
        <Icon icon="solar:archive-minimalistic-bold-duotone" class="w-32 h-32" />
        <h2 class="text-xl font-bold">7. AI Scout</h2>
        <p class="text-sm opacity-90 text-center">Huckleberry's research archive box and documents.</p>
        <button class="btn btn-neutral btn-sm" @click="testAILoader">Test AI Loader</button>
      </div>

      <!-- Option 8: Importer Theme -->
      <div class="card bg-secondary text-secondary-content shadow-xl items-center p-6 gap-4">
        <Icon icon="solar:box-minimalistic-bold-duotone" class="w-32 h-32" />
        <h2 class="text-xl font-bold">8. Importer</h2>
        <p class="text-sm opacity-90 text-center">Database storage box with files and data pouring in.</p>
        <button class="btn btn-neutral btn-sm" @click="testImportLoader">Test Import Loader</button>
      </div>

    </div>
  </div>
  <div v-else-if="!authState.loading" class="flex items-center justify-center min-h-[50vh]">
    <div class="text-center">
        <h1 class="text-4xl font-bold text-error">403 Forbidden</h1>
        <p class="opacity-70 mt-4">Only administrators can access the component preview gallery.</p>
        <a href="/dashboard" class="btn btn-primary mt-6">Return to Dashboard</a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useStore } from '@nanostores/vue';
import { authStore } from '../lib/store';
import { useLoader } from '../composables/useLoader';

const authState = useStore(authStore);
const isAdmin = computed(() => authState.value.user?.labels?.includes('admin'));

const { showLoader, hideLoader } = useLoader();
const activeBasket = ref('noto:basket');
const activeBerry = ref('noto:blueberries');

onMounted(() => {
    // Hide the loader immediately when the preview page loads
    hideLoader();
});

const testLoader = (basketId: string, berryId: string, basketColor?: string, berryColor?: string, bg?: string) => {
    activeBasket.value = basketId;
    activeBerry.value = berryId;
    showLoader("Testing Basket Style...", {
        basket: basketId,
        berries: [berryId, berryId, berryId, berryId],
        basketColor: basketColor,
        berryColor: berryColor,
        backgroundColor: bg,
        cancelable: true,
        onCancel: () => hideLoader()
    });
    
    // Auto hide after 3 seconds
    setTimeout(() => {
        hideLoader();
    }, 3000);
};

const testAILoader = () => {
    showLoader("Hold your horses, I'm digging through the archives...", {
        basket: 'solar:archive-minimalistic-bold-duotone',
        berries: ['solar:document-bold-duotone', 'solar:chart-square-bold-duotone', 'solar:calculator-bold-duotone', 'solar:folder-with-files-bold-duotone'],
        basketColor: 'text-primary-content',
        berryColor: 'text-primary-content',
        backgroundColor: 'bg-primary/80',
        cancelable: true,
        onCancel: () => hideLoader()
    });
};

const testImportLoader = () => {
    showLoader("Archiving file & starting import...", {
        basket: 'solar:box-minimalistic-bold-duotone',
        berries: ['solar:document-add-bold-duotone', 'solar:database-bold-duotone', 'solar:file-download-bold-duotone', 'solar:archive-bold-duotone'],
        basketColor: 'text-secondary-content',
        berryColor: 'text-secondary-content',
        backgroundColor: 'bg-secondary/80',
        cancelable: true,
        onCancel: () => hideLoader()
    });
};
</script>

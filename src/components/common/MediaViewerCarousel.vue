<template>
  <div class="media-viewer-carousel w-full flex flex-col relative shrink-0">
    <!-- Main Image Area (Carousel) -->
    <div class="w-full aspect-square relative bg-base-200 flex items-center justify-center overflow-hidden group">
      <!-- Carousel Container -->
      <div 
        v-if="resolvedGallery.length > 0" 
        class="carousel w-full h-full snap-x snap-mandatory overflow-x-auto select-none" 
        ref="carouselRef" 
        @scroll.passive="onCarouselScroll"
      >
        <div 
          v-for="(img, i) in resolvedGallery" 
          :key="i" 
          :id="`slide-${i}`" 
          class="carousel-item relative w-full shrink-0 items-center justify-center snap-center cursor-zoom-in"
          @click="openZoomPreview(img)"
        >
          <img 
            :src="img" 
            referrerpolicy="no-referrer"
            class="w-full h-full object-contain" 
            draggable="false" 
            :alt="`Photo ${i + 1}`"
          />
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="w-full h-full flex items-center justify-center">
        <div class="text-6xl opacity-20">
          <Icon icon="solar:box-linear" class="mx-auto" />
        </div>
      </div>
      
      <!-- Carousel Arrows -->
      <div 
        v-if="resolvedGallery.length > 1" 
        class="absolute inset-x-2 top-1/2 flex -translate-y-1/2 justify-between opacity-0 sm:group-hover:opacity-100 transition-opacity pointer-events-none z-10"
      >
        <button 
          type="button" 
          @click.stop.prevent="prevImage" 
          class="btn btn-circle btn-sm bg-base-100/80 hover:bg-base-100 border-none backdrop-blur shadow-md pointer-events-auto"
        >
          ❮
        </button>
        <button 
          type="button" 
          @click.stop.prevent="nextImage" 
          class="btn btn-circle btn-sm bg-base-100/80 hover:bg-base-100 border-none backdrop-blur shadow-md pointer-events-auto"
        >
          ❯
        </button>
      </div>
      
      <!-- Keywords / Tags Overlay -->
      <div v-if="keywords && keywords.length > 0" class="absolute bottom-2 left-2 flex flex-wrap gap-1 z-10 pointer-events-none">
        <span 
          v-for="tag in keywords" 
          :key="tag" 
          class="badge badge-sm bg-base-100/80 backdrop-blur shadow-sm border-none"
        >
          {{ tag }}
        </span>
      </div>
    </div>
    
    <!-- Thumbnail Strip -->
    <div class="p-2 flex gap-2 overflow-x-auto bg-base-200 border-t border-base-300" v-if="resolvedGallery.length > 1">
      <button 
        v-for="(img, i) in resolvedGallery" 
        :key="i" 
        type="button"
        @click="selectThumbnail(i)"
        class="w-16 h-16 shrink-0 rounded-lg border-2 overflow-hidden transition-all focus:outline-none"
        :class="selectedIndex === i ? 'border-primary shadow-sm scale-95' : 'border-transparent opacity-60 hover:opacity-100'"
      >
        <img :src="img" referrerpolicy="no-referrer" class="w-full h-full object-cover" />
      </button>
    </div>

    <!-- Full-Resolution Image Zoom Lightbox Modal -->
    <dialog class="modal modal-middle z-50" :class="{ 'modal-open': !!previewZoomUrl }">
      <div class="modal-box max-w-2xl p-4 bg-base-100 rounded-2xl shadow-2xl border border-base-300">
        <div class="flex items-center justify-between pb-2 border-b border-base-200">
          <span class="text-xs font-bold text-base-content flex items-center gap-1.5">
            <Icon icon="solar:magnifer-zoom-in-bold" class="w-4 h-4 text-primary" />
            Full-Resolution Photo Preview
          </span>
          <button type="button" @click="closeZoomPreview" class="btn btn-xs btn-circle btn-ghost">✕</button>
        </div>
        <div class="py-3 flex items-center justify-center max-h-[70vh] overflow-auto">
          <img 
            v-if="previewZoomUrl" 
            :src="previewZoomUrl" 
            referrerpolicy="no-referrer"
            class="max-w-full max-h-[65vh] object-contain rounded-xl shadow-md" 
          />
        </div>
        <div class="modal-action mt-2">
          <button type="button" class="btn btn-sm btn-primary w-full rounded-xl font-bold" @click="closeZoomPreview">Close Preview</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="button" @click="closeZoomPreview">close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { getAssetUrl } from '../../lib/inventory';

const props = withDefaults(defineProps<{
  images?: string[];
  keywords?: string[];
  initialIndex?: number;
}>(), {
  images: () => [],
  keywords: () => [],
  initialIndex: 0
});

const emit = defineEmits<{
  (e: 'change', index: number): void;
}>();

const selectedIndex = ref(props.initialIndex || 0);
const carouselRef = ref<HTMLElement | null>(null);
const previewZoomUrl = ref<string | null>(null);
let isProgrammaticScroll = false;
let scrollTimeout: any = null;

// Normalize all images through canonical getAssetUrl
const resolvedGallery = computed<string[]>(() => {
  if (!props.images || props.images.length === 0) return [];
  const urls: string[] = [];
  props.images.forEach(img => {
    if (!img) return;
    const resolved = getAssetUrl(img);
    if (resolved && !urls.includes(resolved)) urls.push(resolved);
  });
  return urls;
});

watch(() => props.images, () => {
  selectedIndex.value = 0;
  if (carouselRef.value) carouselRef.value.scrollLeft = 0;
}, { deep: true });

const scrollToSlide = (index: number) => {
  if (!carouselRef.value) return;
  const slides = carouselRef.value.children;
  if (slides[index]) {
    isProgrammaticScroll = true;
    carouselRef.value.scrollTo({
      left: index * carouselRef.value.clientWidth,
      behavior: 'smooth'
    });
    setTimeout(() => { isProgrammaticScroll = false; }, 400);
  }
};

const nextImage = () => {
  if (resolvedGallery.value.length <= 1) return;
  const nextIdx = (selectedIndex.value + 1) % resolvedGallery.value.length;
  selectedIndex.value = nextIdx;
  scrollToSlide(nextIdx);
  emit('change', nextIdx);
};

const prevImage = () => {
  if (resolvedGallery.value.length <= 1) return;
  const prevIdx = (selectedIndex.value - 1 + resolvedGallery.value.length) % resolvedGallery.value.length;
  selectedIndex.value = prevIdx;
  scrollToSlide(prevIdx);
  emit('change', prevIdx);
};

const onCarouselScroll = () => {
  if (!carouselRef.value || isProgrammaticScroll) return;
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    if (!carouselRef.value) return;
    const scrollLeft = carouselRef.value.scrollLeft;
    const width = carouselRef.value.clientWidth;
    const index = Math.round(scrollLeft / width);
    if (index !== selectedIndex.value && index >= 0 && index < resolvedGallery.value.length) {
      selectedIndex.value = index;
      emit('change', index);
    }
  }, 50);
};

const selectThumbnail = (index: number) => {
  selectedIndex.value = index;
  scrollToSlide(index);
  emit('change', index);
};

const openZoomPreview = (url: string) => {
  previewZoomUrl.value = url;
};

const closeZoomPreview = () => {
  previewZoomUrl.value = null;
};

defineExpose({
  selectedIndex,
  resolvedGallery,
  nextImage,
  prevImage,
  selectThumbnail
});
</script>

<style scoped>
.media-viewer-carousel {
  width: 100%;
}
</style>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-4 gap-8 mt-8 items-start">
    
    <!-- Sidebar Filters (Desktop) -->
    <aside class="hidden lg:flex flex-col gap-6 bg-base-100 p-6 rounded-2xl border border-base-content/5 shadow-sm">
      <h3 class="font-bold text-lg border-b border-base-content/10 pb-3 flex items-center gap-2">
        <span>🔍</span> Filters & Options
      </h3>

      <!-- Favorites Toggle (Desktop) -->
      <div class="form-control w-full">
        <label class="label cursor-pointer justify-between bg-base-200/50 hover:bg-base-200/80 px-4 py-3 rounded-xl border border-base-content/5 transition-all shadow-sm">
          <span class="label-text-alt font-black uppercase tracking-wider flex items-center gap-1.5 text-base-content/80">
            <span class="text-error">❤️</span> Favorites Only
          </span>
          <input type="checkbox" v-model="showFavoritesOnly" class="checkbox checkbox-primary checkbox-sm" />
        </label>
      </div>

      <!-- Search Filter -->
      <div class="form-control w-full">
        <label class="label pt-0"><span class="label-text-alt font-bold uppercase opacity-60">Search</span></label>
        <div class="relative">
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="Search items, tags..." 
            class="input input-bordered w-full pr-10 shadow-inner"
          />
          <span class="absolute right-3 top-1/2 -translate-y-1/2 opacity-50">🔍</span>
        </div>
      </div>

      <!-- Price Range Filter -->
      <div class="form-control w-full">
        <div class="flex justify-between items-center mb-1">
          <span class="label-text-alt font-bold uppercase opacity-60">Max Price</span>
          <span class="badge badge-neutral font-mono font-bold">${{ maxPriceFilter }}</span>
        </div>
        <input 
          type="range" 
          min="0" 
          :max="absoluteMaxPrice || 100" 
          v-model="maxPriceFilter" 
          class="range range-xs range-primary"
        />
        <div class="flex justify-between text-[10px] opacity-50 px-1 mt-1 font-mono">
          <span>$0</span>
          <span>${{ absoluteMaxPrice }}</span>
        </div>
      </div>

      <!-- Condition Tags Filter -->
      <div class="form-control w-full">
        <label class="label"><span class="label-text-alt font-bold uppercase opacity-60">Keywords / Tags</span></label>
        <div class="flex flex-wrap gap-2 mt-1">
          <button 
            v-for="tag in allKeywords" 
            :key="tag"
            @click="toggleKeyword(tag)"
            class="badge badge-sm border-none cursor-pointer transition-all hover:scale-105"
            :class="selectedKeywords.includes(tag) ? 'badge-primary text-primary-content font-bold' : 'badge-neutral bg-base-300 text-base-content/70 hover:bg-base-300/80'"
          >
            #{{ tag }}
          </button>
        </div>
        <button 
          v-if="selectedKeywords.length > 0" 
          @click="selectedKeywords = []" 
          class="btn btn-link btn-xs text-error justify-end mt-2"
        >
          Clear Tags
        </button>
      </div>

      <!-- Reset All -->
      <button 
        v-if="hasFilters" 
        @click="resetFilters" 
        class="btn btn-outline btn-error btn-sm w-full mt-4"
      >
        Reset Filters
      </button>
    </aside>

    <!-- Main Content Area -->
    <div class="lg:col-span-3 space-y-6">
      
      <!-- Search & Sort Header -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-base-100 p-4 rounded-xl border border-base-content/5 shadow-sm">
        
        <!-- Mobile Filter Drawer Toggle Button -->
        <button class="btn btn-outline btn-sm lg:hidden gap-2" @click="showMobileFilters = true">
          <span>⚙️</span> Filter Catalog
        </button>

        <!-- Sorting -->
        <div class="flex items-center gap-2 w-full sm:w-auto">
          <label class="label-text font-bold opacity-60 text-xs shrink-0">Sort By:</label>
          <select v-model="sortBy" class="select select-bordered select-sm w-full sm:w-48 text-xs bg-base-100">
            <option value="newest">Newest Additions</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="title-asc">Title: A-Z</option>
          </select>
        </div>

        <span class="text-xs font-bold opacity-50">{{ filteredItems.length }} items match criteria</span>
      </div>

      <!-- Product Catalog Grid -->
      <div v-if="filteredItems.length === 0" class="card bg-base-100 border border-base-content/5 shadow-xl p-16 text-center">
        <div class="w-20 h-20 rounded-full bg-base-200 flex items-center justify-center mx-auto mb-4 text-4xl">
          📦
        </div>
        <h4 class="text-xl font-bold">No Matching Items Found</h4>
        <p class="text-sm text-base-content/60 max-w-sm mx-auto mt-2">
          Adjust your filters, search term, or tags to discover more collectibles in our inventory.
        </p>
        <button @click="resetFilters" class="btn btn-primary btn-sm mx-auto mt-6">
          Clear All Filters
        </button>
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        <div 
          v-for="item in sortedItems" 
          :key="item.$id" 
          class="card bg-base-100 border border-base-content/5 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group overflow-hidden"
        >
          <!-- Product Image -->
          <figure @click="openDetails(item)" class="relative aspect-square bg-base-300 overflow-hidden cursor-pointer">
            <img 
              v-if="item.imageId"
              :src="`${appwriteEndpoint}/storage/buckets/${appwriteBucketId}/files/${item.imageId}/view?project=${appwriteProjectId}`" 
              :alt="item.title" 
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
            <div v-else class="w-full h-full flex items-center justify-center text-4xl bg-base-200">
              📚
            </div>
            
            <!-- Badges -->
            <span class="absolute top-3 left-3 badge badge-neutral shadow font-semibold text-[10px] z-10">
              {{ item.status || 'Received' }}
            </span>

            <!-- Floating Heart Button -->
            <button 
              @click.stop="toggleFavorite(item.$id)"
              class="btn btn-circle btn-xs border-none absolute top-3 right-3 z-10 transition-all hover:scale-110 shadow-md backdrop-blur-md"
              :class="isFavorite(item.$id) ? 'bg-error text-error-content hover:bg-error/90' : 'bg-base-100/70 hover:bg-base-100 text-base-content/85'"
            >
              ❤️
            </button>
          </figure>

          <!-- Product Info -->
          <div class="card-body p-4 justify-between gap-4">
            <div>
              <h4 @click="openDetails(item)" class="card-title text-base font-bold line-clamp-2 leading-tight group-hover:text-primary transition-colors cursor-pointer">
                {{ item.title || "Unidentified Item" }}
              </h4>
              <p v-if="item.conditionNotes" class="text-xs text-base-content/60 mt-1 line-clamp-2">
                {{ item.conditionNotes }}
              </p>
            </div>
            
            <div class="flex items-center justify-between mt-2 pt-2 border-t border-base-content/5">
              <span class="text-lg font-black text-secondary">
                ${{ typeof item.resalePrice === 'number' ? item.resalePrice.toFixed(2) : '0.00' }}
              </span>
              <button @click="openDetails(item)" class="btn btn-sm btn-ghost text-primary hover:bg-primary/10">
                Details
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Mobile Drawer Modal for Filters -->
    <dialog class="modal" :class="{'modal-open': showMobileFilters}">
      <div class="modal-box bg-base-100 max-w-sm">
        <div class="flex justify-between items-center mb-6 border-b border-base-content/10 pb-3">
          <h3 class="font-bold text-lg">⚙️ Filter Catalog</h3>
          <button class="btn btn-sm btn-circle btn-ghost" @click="showMobileFilters = false">✕</button>
        </div>

        <div class="space-y-6">
          <!-- Favorites Toggle (Mobile) -->
          <div class="form-control w-full">
            <label class="label cursor-pointer justify-between bg-base-200/50 hover:bg-base-200/80 px-4 py-3 rounded-xl border border-base-content/5 transition-all shadow-sm">
              <span class="label-text-alt font-black uppercase tracking-wider flex items-center gap-1.5 text-base-content/80">
                <span class="text-error">❤️</span> Favorites Only
              </span>
              <input type="checkbox" v-model="showFavoritesOnly" class="checkbox checkbox-primary checkbox-sm" />
            </label>
          </div>

          <!-- Search Filter -->
          <div class="form-control w-full">
            <label class="label pt-0"><span class="label-text-alt font-bold uppercase opacity-60">Search</span></label>
            <input 
              type="text" 
              v-model="searchQuery" 
              placeholder="Search items, tags..." 
              class="input input-bordered w-full"
            />
          </div>

          <!-- Price Range Filter -->
          <div class="form-control w-full">
            <div class="flex justify-between items-center mb-1">
              <span class="label-text-alt font-bold uppercase opacity-60">Max Price</span>
              <span class="badge badge-neutral font-mono font-bold">${{ maxPriceFilter }}</span>
            </div>
            <input 
              type="range" 
              min="0" 
              :max="absoluteMaxPrice || 100" 
              v-model="maxPriceFilter" 
              class="range range-xs range-primary"
            />
            <div class="flex justify-between text-[10px] opacity-50 px-1 mt-1 font-mono">
              <span>$0</span>
              <span>${{ absoluteMaxPrice }}</span>
            </div>
          </div>

          <!-- Keywords Filter -->
          <div class="form-control w-full">
            <label class="label"><span class="label-text-alt font-bold uppercase opacity-60">Keywords / Tags</span></label>
            <div class="flex flex-wrap gap-2 mt-1">
              <button 
                v-for="tag in allKeywords" 
                :key="tag"
                @click="toggleKeyword(tag)"
                class="badge badge-sm border-none cursor-pointer"
                :class="selectedKeywords.includes(tag) ? 'badge-primary text-primary-content font-bold' : 'badge-neutral bg-base-300 text-base-content/70'"
              >
                #{{ tag }}
              </button>
            </div>
          </div>

          <!-- Actions -->
          <div class="modal-action pt-4 border-t border-base-content/10">
            <button class="btn btn-ghost btn-sm" @click="resetFilters">Reset</button>
            <button class="btn btn-primary btn-sm flex-1" @click="showMobileFilters = false">Apply Filters</button>
          </div>
        </div>
      </div>
    </dialog>

    <!-- Product Details Modal/Drawer (Full screen on mobile) -->
    <dialog class="modal" :class="{'modal-open': showDetailsModal}">
      <div v-if="selectedItem" class="modal-box w-full h-full max-w-full max-h-full rounded-none m-0 p-6 flex flex-col md:w-11/12 md:max-w-4xl md:h-auto md:max-h-[90vh] md:rounded-3xl md:p-8 md:grid md:grid-cols-2 md:gap-8 overflow-y-auto relative">
        
        <!-- Close Button (Fixed top-right) -->
        <button class="btn btn-sm btn-circle btn-neutral absolute right-4 top-4 z-50 shadow-md border-base-content/10 hover:scale-105 transition-transform" @click="closeDetails">✕</button>

        <!-- Left Column: Media Gallery -->
        <div class="flex flex-col gap-4 w-full">
          <div class="relative w-full aspect-square bg-base-200 rounded-2xl overflow-hidden border border-base-content/5 shadow-inner">
            <img 
              v-if="activeImages.length > 0"
              :src="`${appwriteEndpoint}/storage/buckets/${appwriteBucketId}/files/${activeImages[currentImageIndex]}/view?project=${appwriteProjectId}`" 
              :alt="selectedItem.title" 
              class="w-full h-full object-cover transition-all duration-300"
            />
            <div v-else class="w-full h-full flex items-center justify-center text-6xl">
              📚
            </div>
            
            <!-- Gallery Navigation Arrows -->
            <button 
              v-if="activeImages.length > 1" 
              @click.stop="currentImageIndex = (currentImageIndex - 1 + activeImages.length) % activeImages.length"
              class="btn btn-circle btn-xs btn-neutral/80 absolute left-3 top-1/2 -translate-y-1/2"
            >
              ❮
            </button>
            <button 
              v-if="activeImages.length > 1" 
              @click.stop="currentImageIndex = (currentImageIndex + 1) % activeImages.length"
              class="btn btn-circle btn-xs btn-neutral/80 absolute right-3 top-1/2 -translate-y-1/2"
            >
              ❯
            </button>
          </div>

          <!-- Thumbnails -->
          <div v-if="activeImages.length > 1" class="flex gap-2 justify-center overflow-x-auto py-1">
            <button 
              v-for="(imgId, idx) in activeImages" 
              :key="imgId"
              @click="currentImageIndex = idx"
              class="w-14 h-14 rounded-lg overflow-hidden border-2 transition-all hover:opacity-100"
              :class="currentImageIndex === idx ? 'border-primary opacity-100 scale-105' : 'border-transparent opacity-60'"
            >
              <img 
                :src="`${appwriteEndpoint}/storage/buckets/${appwriteBucketId}/files/${imgId}/view?project=${appwriteProjectId}`" 
                class="w-full h-full object-cover" 
              />
            </button>
          </div>
        </div>

        <!-- Right Column: Product Info -->
        <div class="flex flex-col justify-between gap-6">
          <div class="space-y-4">
            <!-- Badges -->
            <div class="flex flex-wrap gap-2 items-center">
              <span class="badge badge-primary font-bold text-xs uppercase tracking-wider py-2">
                {{ selectedItem.status || 'Active' }}
              </span>
              <span class="badge badge-outline text-xs">
                ID: {{ selectedItem.$id.substring(0, 8) }}
              </span>
            </div>

            <!-- Title -->
            <h3 class="text-2xl md:text-3xl font-black leading-tight tracking-tight text-base-content">
              {{ selectedItem.title || "Unidentified Item" }}
            </h3>

            <!-- Price -->
            <div class="text-3xl font-black text-secondary flex items-baseline gap-1 mt-2">
              <span class="text-lg opacity-80">$</span>
              <span>{{ typeof selectedItem.resalePrice === 'number' ? selectedItem.resalePrice.toFixed(2) : '0.00' }}</span>
            </div>

            <!-- Divider -->
            <div class="divider my-2 opacity-50"></div>

            <!-- Keywords / Tags -->
            <div v-if="Array.isArray(selectedItem.keywords) && selectedItem.keywords.length > 0" class="space-y-1.5">
              <h5 class="text-xs font-bold uppercase tracking-wider opacity-60">Keywords</h5>
              <div class="flex flex-wrap gap-1.5">
                <span 
                  v-for="tag in selectedItem.keywords" 
                  :key="tag"
                  class="badge badge-sm badge-neutral"
                >
                  #{{ tag }}
                </span>
              </div>
            </div>

            <!-- Description -->
            <div class="space-y-1.5">
              <h5 class="text-xs font-bold uppercase tracking-wider opacity-60">Description</h5>
              <p class="text-sm bg-base-200 p-4 rounded-xl border border-base-content/5 leading-relaxed text-base-content/85 whitespace-pre-line max-h-48 overflow-y-auto">
                {{ selectedItem.marketDescription || selectedItem.conditionNotes || "No description available for this item." }}
              </p>
            </div>
            
            <!-- Components -->
            <div v-if="selectedItem.components" class="space-y-1.5">
              <h5 class="text-xs font-bold uppercase tracking-wider opacity-60">Included Components</h5>
              <p class="text-xs leading-relaxed text-base-content/75 bg-base-300/40 p-4 rounded-xl border border-base-content/5 max-h-24 overflow-y-auto">
                {{ selectedItem.components }}
              </p>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex flex-col sm:flex-row gap-3 pt-4 border-t border-base-content/10 mt-auto bg-base-100">
            <button 
              @click="toggleFavorite(selectedItem.$id)" 
              class="btn btn-primary flex-1 gap-2.5 shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-95 transition-all font-bold"
            >
              <span>❤️</span> {{ isFavorite(selectedItem.$id) ? 'Remove from Favorites' : 'Add to Favorites' }}
            </button>
            <button 
              @click="copyLink" 
              class="btn btn-outline gap-2.5 hover:scale-[1.02] active:scale-95 transition-all"
            >
              <span>🔗</span> Copy Product Link
            </button>
          </div>

          <!-- Social Share Row -->
          <div class="flex flex-col gap-2 pt-2 mt-1">
            <span class="text-xs font-bold uppercase tracking-wider opacity-50">Share via:</span>
            <div class="flex flex-wrap gap-2.5">
              <!-- Twitter/X -->
              <a 
                :href="`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(shareUrl)}`"
                target="_blank" 
                rel="noopener noreferrer"
                class="btn btn-circle btn-sm btn-outline hover:bg-neutral hover:text-neutral-content transition-all"
                title="Share on X (Twitter)"
              >
                <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>

              <!-- Facebook -->
              <a 
                :href="`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`"
                target="_blank" 
                rel="noopener noreferrer"
                class="btn btn-circle btn-sm btn-outline hover:bg-neutral hover:text-neutral-content transition-all"
                title="Share on Facebook"
              >
                <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z"/>
                </svg>
              </a>

              <!-- Pinterest -->
              <a 
                :href="`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareUrl)}&media=${encodeURIComponent(shareImage)}&description=${encodeURIComponent(shareTitle)}`"
                target="_blank" 
                rel="noopener noreferrer"
                class="btn btn-circle btn-sm btn-outline hover:bg-neutral hover:text-neutral-content transition-all"
                title="Share on Pinterest"
              >
                <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.41 7.61 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.168 1.777 2.168 2.13 0 3.762-2.245 3.762-5.486 0-2.868-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.211-.174.263-.403.156-1.49-.694-2.42-2.875-2.42-4.626 0-3.768 2.737-7.229 7.892-7.229 4.144 0 7.362 2.956 7.362 6.899 0 4.117-2.597 7.431-6.2 7.431-1.21 0-2.348-.63-2.738-1.373 0 0-.599 2.282-.744 2.84-.282 1.084-1.047 2.443-1.561 3.284 1.133.351 2.336.543 3.59.543 6.63 0 12-5.375 12-12.007C24.017 5.37 18.647 0 12.017 0z"/>
                </svg>
              </a>

              <!-- Email -->
              <a 
                :href="`mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent('Check out this awesome collectible: ' + shareUrl)}`"
                class="btn btn-circle btn-sm btn-outline hover:bg-neutral hover:text-neutral-content transition-all"
                title="Share via Email"
              >
                <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>

      </div>
      
      <!-- Modal Backdrop for clicking outside to close -->
      <form method="dialog" class="modal-backdrop">
        <button @click="closeDetails">close</button>
      </form>
    </dialog>

    <!-- Toast Notification -->
    <div v-if="showToast" class="toast toast-end toast-bottom z-50">
      <div class="alert alert-success shadow-lg">
        <span class="font-bold">{{ toastMessage }}</span>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';

const props = defineProps({
  initialItems: {
    type: Array,
    required: true,
    default: () => []
  },
  appwriteEndpoint: {
    type: String,
    required: true
  },
  appwriteProjectId: {
    type: String,
    required: true
  },
  appwriteBucketId: {
    type: String,
    required: true
  }
});

// Catalog State
const searchQuery = ref('');
const sortBy = ref('newest');
const showMobileFilters = ref(false);
const selectedKeywords = ref([]);
const showFavoritesOnly = ref(false);

// Favorites Wishlist State
const favorites = ref([]);

// Details Modal State
const selectedItem = ref(null);
const showDetailsModal = ref(false);
const currentImageIndex = ref(0);
const showToast = ref(false);

const activeImages = computed(() => {
  if (!selectedItem.value) return [];
  const imgs = [];
  if (selectedItem.value.imageId) {
    imgs.push(selectedItem.value.imageId);
  }
  if (Array.isArray(selectedItem.value.galleryImageIds)) {
    selectedItem.value.galleryImageIds.forEach(id => {
      if (id && id !== selectedItem.value.imageId) {
        imgs.push(id);
      }
    });
  }
  return imgs;
});

const openDetails = (item) => {
  selectedItem.value = item;
  currentImageIndex.value = 0;
  showDetailsModal.value = true;
};

const closeDetails = () => {
  showDetailsModal.value = false;
  selectedItem.value = null;
};

const toastMessage = ref('');

const shareUrl = computed(() => {
  if (!selectedItem.value) return '';
  return `${window.location.protocol}//${window.location.host}/item/${selectedItem.value.$id}`;
});

const shareTitle = computed(() => {
  return selectedItem.value ? selectedItem.value.title : '';
});

const shareImage = computed(() => {
  if (!selectedItem.value || !selectedItem.value.imageId) return '';
  return `${props.appwriteEndpoint}/storage/buckets/${props.appwriteBucketId}/files/${selectedItem.value.imageId}/view?project=${props.appwriteProjectId}`;
});

const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(shareUrl.value);
    toastMessage.value = '🔗 Link copied to clipboard!';
    showToast.value = true;
    setTimeout(() => {
      showToast.value = false;
    }, 2500);
  } catch (err) {
    toastMessage.value = '⚠️ Failed to copy link.';
    showToast.value = true;
    setTimeout(() => {
      showToast.value = false;
    }, 2500);
  }
};

// Wishlist Logic
const toggleFavorite = (itemId) => {
  const index = favorites.value.indexOf(itemId);
  if (index >= 0) {
    favorites.value.splice(index, 1);
    toastMessage.value = '❤️ Removed from Favorites';
  } else {
    favorites.value.push(itemId);
    toastMessage.value = '❤️ Added to Favorites successfully!';
  }
  showToast.value = true;
  setTimeout(() => {
    showToast.value = false;
  }, 2500);
};

const isFavorite = (itemId) => {
  return favorites.value.includes(itemId);
};

// Local storage persistence
onMounted(() => {
  maxPriceFilter.value = absoluteMaxPrice.value;
  try {
    const saved = localStorage.getItem('store_favorites');
    if (saved) {
      favorites.value = JSON.parse(saved);
    }
  } catch (e) {
    console.warn('[Favorites] Failed to load favorites from localStorage:', e);
  }
});

watch(favorites, (newFavs) => {
  try {
    localStorage.setItem('store_favorites', JSON.stringify(newFavs));
  } catch (e) {
    console.warn('[Favorites] Failed to save favorites to localStorage:', e);
  }
}, { deep: true });

// Max price resolution
const absoluteMaxPrice = computed(() => {
  if (props.initialItems.length === 0) return 100;
  return Math.ceil(Math.max(...props.initialItems.map(item => item.resalePrice || 0)));
});

const maxPriceFilter = ref(0);

// Keywords extraction from initial items
const allKeywords = computed(() => {
  const keywordsSet = new Set();
  props.initialItems.forEach(item => {
    if (Array.isArray(item.keywords)) {
      item.keywords.forEach(kw => {
        if (kw && kw.trim().length > 0) {
          keywordsSet.add(kw.trim());
        }
      });
    }
  });
  return Array.from(keywordsSet).slice(0, 15); // limit to top 15 keywords
});

// Helper: Toggle selected keywords
const toggleKeyword = (tag) => {
  const index = selectedKeywords.value.indexOf(tag);
  if (index >= 0) {
    selectedKeywords.value.splice(index, 1);
  } else {
    selectedKeywords.value.push(tag);
  }
};

// Check if any filters are active
const hasFilters = computed(() => {
  return searchQuery.value !== '' || 
         maxPriceFilter.value !== absoluteMaxPrice.value || 
         selectedKeywords.value.length > 0 ||
         showFavoritesOnly.value;
});

// Reset all filters
const resetFilters = () => {
  searchQuery.value = '';
  maxPriceFilter.value = absoluteMaxPrice.value;
  selectedKeywords.value = [];
  showFavoritesOnly.value = false;
};

// Filtered Items Computed Property
const filteredItems = computed(() => {
  return props.initialItems.filter(item => {
    // 0. Favorites Filter
    if (showFavoritesOnly.value && !favorites.value.includes(item.$id)) {
      return false;
    }

    // 1. Search Query
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase();
      const matchesTitle = (item.title || '').toLowerCase().includes(q);
      const matchesDesc = (item.conditionNotes || '').toLowerCase().includes(q);
      const matchesKeywords = Array.isArray(item.keywords) && item.keywords.some(k => k.toLowerCase().includes(q));
      if (!matchesTitle && !matchesDesc && !matchesKeywords) return false;
    }

    // 2. Price limit
    const price = item.resalePrice || 0;
    if (price > maxPriceFilter.value) return false;

    // 3. Keyword tags (matches any of the selected keyword tags)
    if (selectedKeywords.value.length > 0) {
      if (!Array.isArray(item.keywords)) return false;
      const matchesAnyKeyword = selectedKeywords.value.some(tag => 
        item.keywords.some(kw => kw.toLowerCase() === tag.toLowerCase())
      );
      if (!matchesAnyKeyword) return false;
    }

    return true;
  });
});

// Sorted Items Computed Property
const sortedItems = computed(() => {
  const items = [...filteredItems.value];
  if (sortBy.value === 'price-low') {
    return items.sort((a, b) => (a.resalePrice || 0) - (b.resalePrice || 0));
  } else if (sortBy.value === 'price-high') {
    return items.sort((a, b) => (b.resalePrice || 0) - (a.resalePrice || 0));
  } else if (sortBy.value === 'title-asc') {
    return items.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  }
  // Default: newest additions
  return items;
});
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

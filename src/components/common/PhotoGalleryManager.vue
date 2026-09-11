<template>
  <div class="photo-gallery-manager space-y-3.5">
    <!-- Header -->
    <div v-if="showHeader" class="flex justify-between items-center">
      <label class="font-bold text-xs uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
        <Icon icon="solar:gallery-bold" class="w-4 h-4 text-primary" />
        {{ title }}
      </label>
      <span class="badge badge-sm badge-ghost font-mono text-[11px] font-bold">
        {{ totalCount }} Photo{{ totalCount === 1 ? '' : 's' }}
      </span>
    </div>

    <!-- 1. EMPTY STATE (No photos yet) -->
    <!-- 1. EMPTY STATE (Tactile Dropzone with Big Camera Button) -->
    <div 
      v-if="totalCount === 0"
      class="border-2 border-dashed border-base-300 rounded-2xl p-6 text-center transition-all bg-base-100/60 cursor-pointer hover:border-primary/60 hover:bg-primary/5 flex flex-col items-center justify-center gap-3 relative select-none"
      :class="{ 'border-primary bg-primary/10': isDragging }"
      @dragenter.prevent="isDragging = true"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="onDragLeave"
      @drop.prevent="handleDrop"
      @click="triggerUpload"
    >
      <div class="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-1 pointer-events-none">
        <Icon icon="solar:gallery-add-bold-duotone" class="w-7 h-7" />
      </div>
      <div class="pointer-events-none">
        <div class="font-bold text-xs text-base-content">Tap to upload or drag photos here</div>
        <p class="text-[11px] opacity-60 max-w-xs mt-0.5">High-res photos or screenshots will attach to this item</p>
      </div>

      <!-- Quick Action: Prominent Large Camera Button -->
      <div class="flex items-center justify-center pt-1 w-full max-w-xs pointer-events-auto">
        <button 
          v-if="allowCamera" 
          type="button" 
          class="btn btn-secondary w-full rounded-2xl font-black text-sm sm:text-base gap-2.5 h-12 sm:h-14 shadow-md active:scale-95 transition-all"
          @click.stop="handleCameraClick"
        >
          <Icon icon="solar:camera-bold" class="w-5 h-5 sm:w-6 sm:h-6" />
          <span>Add Photo with Camera</span>
        </button>
      </div>
    </div>

    <!-- 2. POPULATED STATE (Hero Main Cover Photo + Supporting Thumbnails) -->
    <div v-else class="space-y-3">
      <!-- A. Hero Main Cover Photo Card -->
      <div class="relative w-full rounded-2xl overflow-hidden border-2 border-primary/40 bg-base-300/40 shadow-sm group aspect-4/3 sm:aspect-16/9 max-h-64 flex items-center justify-center">
        <img 
          v-if="actualMainPhoto.url"
          :src="actualMainPhoto.url" 
          referrerpolicy="no-referrer"
          class="w-full h-full object-contain bg-black/10" 
          alt="Main Cover Photo"
        />
        <div v-else class="flex flex-col items-center justify-center opacity-40 text-xs">
          <Icon icon="solar:gallery-linear" class="w-8 h-8" />
          <span>No image selected</span>
        </div>
        
        <!-- Cover Photo Badges Overlay -->
        <div class="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-20">
          <span class="badge badge-warning text-warning-content font-black text-xs gap-1 shadow-md py-2.5 px-3 rounded-xl">
            <Icon icon="solar:star-bold" class="w-3.5 h-3.5" />
            Main Cover Photo
          </span>
        </div>

        <!-- Top Right Action Controls -->
        <div class="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-20">
          <!-- Zoom Lightbox Button -->
          <button 
            v-if="actualMainPhoto.url"
            type="button" 
            class="btn btn-sm btn-circle bg-base-100/90 hover:bg-base-100 shadow-md text-base-content border border-base-300"
            @click="openZoomPreview(actualMainPhoto.url)"
            title="Zoom Full Resolution"
          >
            <Icon icon="solar:magnifer-zoom-in-bold" class="w-4 h-4" />
          </button>
          
          <!-- Remove Main Photo Button -->
          <button 
            type="button" 
            class="btn btn-sm btn-circle btn-error text-error-content shadow-md"
            @click="removeMainPhoto"
            title="Remove this photo"
          >
            <Icon icon="solar:trash-bin-trash-bold" class="w-4 h-4" />
          </button>
        </div>

        <div class="absolute bottom-2 inset-x-2 text-center pointer-events-none">
          <span class="text-[11px] font-semibold text-white/90 bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-xs">
            Primary listing image shown on marketplace & tags
          </span>
        </div>
      </div>

      <!-- B. Supporting Gallery Grid (Zero Side-Scroll Wrapping Grid) -->
      <div v-if="totalCount > 0" class="space-y-1.5">
        <div class="flex justify-between items-center px-1">
          <span class="text-[11px] font-bold opacity-70">{{ totalCount > 1 ? 'Supporting Photos (Tap to set as Main ⭐)' : 'Photos (Tap to set as Main ⭐)' }}</span>
          <span class="text-[10px] opacity-50 font-mono">{{ totalCount }} photo{{ totalCount === 1 ? '' : 's' }}</span>
        </div>
        
        <div class="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2.5 py-1 px-0.5">
          <!-- 1. Existing Appwrite Photos -->
          <div 
            v-for="(id, idx) in existingImages" 
            :key="'exist_' + id" 
            class="relative aspect-square w-full rounded-xl overflow-hidden border-2 bg-base-100 cursor-pointer transition-all active:scale-95 shadow-xs group"
            :class="actualMainPhoto?.id === id ? 'border-primary ring-2 ring-primary/40' : 'border-base-300 hover:border-primary/50'"
            @click="setMainPhoto('existing', id)"
          >
            <img :src="getAssetUrl(id)" referrerpolicy="no-referrer" class="w-full h-full object-cover" />
            
            <!-- Index Pill -->
            <span class="badge badge-neutral badge-xs absolute bottom-1 left-1 font-mono font-bold text-[9px] opacity-80">
              #{{ idx + 1 }}
            </span>

            <!-- Main Indicator -->
            <div v-if="actualMainPhoto?.id === id" class="absolute top-1 left-1 bg-warning text-warning-content rounded-full p-1 shadow-xs">
              <Icon icon="solar:star-bold" class="w-3 h-3" />
            </div>

            <!-- Inner Delete Button -->
            <button 
              type="button" 
              @click.stop="removeExisting(id)" 
              class="btn btn-xs btn-circle btn-error absolute top-1 right-1 w-5 h-5 min-h-0 text-[10px] shadow-sm opacity-90 hover:opacity-100"
              title="Remove photo"
            >
              ✕
            </button>
          </div>

          <!-- 2. New Buffered Uploads -->
          <div 
            v-for="(item, idx) in newPhotos" 
            :key="'new_' + idx" 
            class="relative aspect-square w-full rounded-xl overflow-hidden border-2 bg-base-100 cursor-pointer transition-all active:scale-95 shadow-xs group"
            :class="isNewSelected(item, idx) ? 'border-primary ring-2 ring-primary/40' : 'border-base-300 hover:border-primary/50'"
            @click="setMainPhoto('new', idx)"
          >
            <img :src="getPhotoUrl(item)" referrerpolicy="no-referrer" class="w-full h-full object-cover" />
            
            <!-- Index Pill -->
            <span class="badge badge-neutral badge-xs absolute bottom-1 left-1 font-mono font-bold text-[9px] opacity-80">
              #{{ existingImages.length + idx + 1 }}
            </span>

            <!-- Main Indicator -->
            <div v-if="isNewSelected(item, idx)" class="absolute top-1 left-1 bg-warning text-warning-content rounded-full p-1 shadow-xs">
              <Icon icon="solar:star-bold" class="w-3 h-3" />
            </div>

            <!-- Inner Delete Button -->
            <button 
              type="button" 
              @click.stop="removeNew(idx)" 
              class="btn btn-xs btn-circle btn-error absolute top-1 right-1 w-5 h-5 min-h-0 text-[10px] shadow-sm opacity-90 hover:opacity-100"
              title="Remove photo"
            >
              ✕
            </button>
          </div>

          <!-- Add More Thumbnail Tile -->
          <button 
            v-if="allowUpload && totalCount < maxPhotos"
            type="button"
            @click="triggerUpload" 
            class="aspect-square w-full rounded-xl border-2 border-dashed border-base-300 hover:border-primary/60 hover:bg-primary/5 flex flex-col items-center justify-center text-base-content/60 hover:text-primary transition-all group"
            title="Upload more photos from device"
          >
            <Icon icon="solar:gallery-add-bold" class="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span class="text-[9px] font-bold mt-0.5">Add</span>
          </button>
        </div>
      </div>

      <!-- C. Photo Action Buttons (Camera) -->
      <div v-if="allowCamera" class="pt-1">
        <button 
          type="button" 
          @click="handleCameraClick" 
          class="btn btn-sm btn-outline btn-secondary w-full text-xs rounded-xl font-bold gap-2 h-10 shadow-xs"
        >
          <Icon icon="solar:camera-bold" class="w-4 h-4" />
          Add with Camera
        </button>
      </div>
    </div>

    <!-- Hidden native file input -->
    <input 
      type="file" 
      ref="fileInputRef" 
      multiple 
      accept="image/*" 
      class="hidden" 
      @change="handleFileSelect" 
    />

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
          <img v-if="previewZoomUrl" :src="previewZoomUrl" class="max-w-full max-h-[65vh] object-contain rounded-xl shadow-md" />
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
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Icon } from '@iconify/vue';
import { addToast } from '../../stores/toast';
import { BUCKET_ID } from '../../lib/inventory';

interface MainSelection {
  type: 'existing' | 'new' | 'none';
  val: any;
}

const props = withDefaults(defineProps<{
  existingImages?: string[];
  newPhotos?: any[];
  mainSelection?: MainSelection;
  maxPhotos?: number;
  allowPaste?: boolean;
  allowCamera?: boolean;
  allowUpload?: boolean;
  title?: string;
  showHeader?: boolean;
  scannerWidget?: any;
  outputFormat?: 'file' | 'object';
}>(), {
  existingImages: () => [],
  newPhotos: () => [],
  mainSelection: () => ({ type: 'none', val: null }),
  maxPhotos: 15,
  allowPaste: true,
  allowCamera: true,
  allowUpload: true,
  title: 'Photos & Sourcing Media',
  showHeader: true,
  scannerWidget: null,
  outputFormat: 'file'
});

const emit = defineEmits<{
  (e: 'update:existingImages', val: string[]): void;
  (e: 'update:newPhotos', val: any[]): void;
  (e: 'update:mainSelection', val: MainSelection): void;
  (e: 'open-camera'): void;
  (e: 'photos-added', files: File[]): void;
  (e: 'photo-removed', info: { type: 'existing' | 'new'; idOrIdx: any }): void;
}>();

const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const previewZoomUrl = ref<string | null>(null);

const internalSelection = ref<MainSelection>({ ...props.mainSelection });

const ENDPOINT = import.meta.env.PUBLIC_APPWRITE_ENDPOINT;
const PROJECT = import.meta.env.PUBLIC_APPWRITE_PROJECT_ID;

const objectUrlMap = new WeakMap<File, string>();

const getPhotoUrl = (item: any): string => {
  if (!item) return '';
  if (typeof item === 'string') return item;
  if (item.url) return item.url;
  if (item instanceof File) {
    if (!objectUrlMap.has(item)) {
      objectUrlMap.set(item, URL.createObjectURL(item));
    }
    return objectUrlMap.get(item)!;
  }
  return '';
};

const getAssetUrl = (id: string): string => {
  if (!id) return '';
  if (id.startsWith('http') || id.startsWith('data:') || id.startsWith('blob:') || id.startsWith('/api/')) {
    return id;
  }
  const bucket = BUCKET_ID || 'item_images';
  return `${ENDPOINT}/storage/buckets/${bucket}/files/${id}/view?project=${PROJECT}`;
};

const totalCount = computed(() => {
  return (props.existingImages?.length || 0) + (props.newPhotos?.length || 0);
});

const actualMainPhoto = computed(() => {
  const sel = props.mainSelection?.type ? props.mainSelection : internalSelection.value;
  
  if (sel.type === 'new' && props.newPhotos && props.newPhotos[sel.val]) {
    const item = props.newPhotos[sel.val];
    return {
      file: item instanceof File ? item : item.file || null,
      url: getPhotoUrl(item),
      type: 'new' as const,
      idx: sel.val,
      id: null
    };
  } else if (sel.type === 'existing' && props.existingImages && props.existingImages.includes(sel.val)) {
    return {
      file: null,
      url: getAssetUrl(sel.val),
      type: 'existing' as const,
      id: sel.val,
      idx: null
    };
  } else {
    // Default fallback to first available
    if (props.newPhotos && props.newPhotos.length > 0) {
      const first = props.newPhotos[0];
      return {
        file: first instanceof File ? first : first.file || null,
        url: getPhotoUrl(first),
        type: 'new' as const,
        idx: 0,
        id: null
      };
    }
    if (props.existingImages && props.existingImages.length > 0) {
      const firstId = props.existingImages[0];
      return {
        file: null,
        url: getAssetUrl(firstId),
        type: 'existing' as const,
        id: firstId,
        idx: null
      };
    }
    return { file: null, url: '', type: 'none' as const, id: null, idx: null };
  }
});

const isNewSelected = (item: any, idx: number): boolean => {
  const sel = props.mainSelection?.type ? props.mainSelection : internalSelection.value;
  if (sel.type === 'new') return sel.val === idx;
  return actualMainPhoto.value.type === 'new' && actualMainPhoto.value.idx === idx;
};

const setMainPhoto = (type: 'existing' | 'new', val: any) => {
  const updated: MainSelection = { type, val };
  internalSelection.value = updated;
  emit('update:mainSelection', updated);
  addToast({ type: 'info', message: 'Main cover photo updated ⭐' });
};

const removeMainPhoto = () => {
  const current = actualMainPhoto.value;
  if (current?.type === 'existing' && current?.id) {
    removeExisting(current.id);
  } else if (current?.type === 'new' && current?.idx !== null && current?.idx !== undefined) {
    removeNew(current.idx);
  }
};

const removeExisting = (id: string) => {
  const next = props.existingImages.filter(item => item !== id);
  emit('update:existingImages', next);
  emit('photo-removed', { type: 'existing', idOrIdx: id });
  
  if (actualMainPhoto.value?.id === id) {
    internalSelection.value = { type: 'none', val: null };
    emit('update:mainSelection', { type: 'none', val: null });
  }
};

const removeNew = (idx: number) => {
  const next = [...props.newPhotos];
  next.splice(idx, 1);
  emit('update:newPhotos', next);
  emit('photo-removed', { type: 'new', idOrIdx: idx });

  if (actualMainPhoto.value.type === 'new' && actualMainPhoto.value.idx === idx) {
    internalSelection.value = { type: 'none', val: null };
    emit('update:mainSelection', { type: 'none', val: null });
  }
};

const triggerUpload = () => {
  fileInputRef.value?.click();
};

const handleCameraClick = () => {
  if (props.scannerWidget && typeof props.scannerWidget.startCamera === 'function') {
    props.scannerWidget.startCamera();
  }
  emit('open-camera');
};

const onDragLeave = (e: DragEvent) => {
  const target = e.currentTarget as HTMLElement | null;
  if (target && e.relatedTarget && !target.contains(e.relatedTarget as Node)) {
    isDragging.value = false;
  }
};

const handleDrop = (e: DragEvent) => {
  isDragging.value = false;
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    addFiles(Array.from(files));
  }
};

const handleFileSelect = (e: Event) => {
  const input = e.target as HTMLInputElement;
  if (input?.files && input.files.length > 0) {
    addFiles(Array.from(input.files));
    input.value = '';
  }
};

const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (!e.target?.result) return resolve('');
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1080;
        let width = img.width;
        let height = img.height;
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target.result as string;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
};

const addFiles = async (files: File[]) => {
  const imageFiles = files.filter(f => f.type.startsWith('image/'));
  if (imageFiles.length === 0) {
    addToast({ type: 'warning', message: 'Please select valid image files.' });
    return;
  }

  const remainingSlots = props.maxPhotos - totalCount.value;
  if (remainingSlots <= 0) {
    addToast({ type: 'warning', message: `Gallery limit of ${props.maxPhotos} photos reached.` });
    return;
  }

  const toAdd = imageFiles.slice(0, remainingSlots);
  const isObjectMode = props.outputFormat === 'object' || (props.newPhotos.length > 0 && typeof props.newPhotos[0] === 'object' && !(props.newPhotos[0] instanceof File) && 'url' in props.newPhotos[0]);

  let formattedAdditions: any[] = [];
  if (isObjectMode) {
    formattedAdditions = await Promise.all(toAdd.map(async (file) => {
      const dataUrl = await fileToDataUrl(file);
      return { url: dataUrl, file };
    }));
  } else {
    formattedAdditions = toAdd;
  }

  const next = [...props.newPhotos, ...formattedAdditions];
  emit('update:newPhotos', next);
  emit('photos-added', toAdd);

  // If there was no main photo, select the first newly added photo
  if (!actualMainPhoto.value.url && formattedAdditions.length > 0) {
    setMainPhoto('new', props.newPhotos.length);
  }

  addToast({ type: 'success', message: `📸 Added ${toAdd.length} photo${toAdd.length > 1 ? 's' : ''} to gallery!` });
};

// Clipboard Paste Support (Silent native Ctrl+V listener without permission prompts)
const onWindowPaste = async (e: ClipboardEvent) => {
  if (!props.allowPaste) return;
  const items = e.clipboardData?.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      const blob = items[i].getAsFile();
      if (blob) {
        e.preventDefault();
        await addFiles([blob]);
        break;
      }
    }
  }
};

onMounted(() => {
  if (props.allowPaste) {
    window.addEventListener('paste', onWindowPaste);
  }
});

onUnmounted(() => {
  if (props.allowPaste) {
    window.removeEventListener('paste', onWindowPaste);
  }
});

const openZoomPreview = (url: string) => {
  previewZoomUrl.value = url;
};

const closeZoomPreview = () => {
  previewZoomUrl.value = null;
};

defineExpose({
  triggerUpload,
  addFiles
});
</script>

<style scoped>
.photo-gallery-manager {
  width: 100%;
}
</style>

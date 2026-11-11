<template>
  <div class="markdown-media-composer space-y-3">
    <!-- ========================================== -->
    <!-- 1. LOCKED READER MODE (Clean GFM + Photos) -->
    <!-- ========================================== -->
    <template v-if="locked">
      <div
        v-if="modelValue && modelValue.trim()"
        class="prose prose-sm max-w-none text-base-content prose-headings:font-black prose-headings:tracking-tight prose-headings:text-base-content prose-h3:text-sm prose-h3:mt-4 prose-h3:mb-1.5 prose-p:my-2 prose-p:leading-relaxed prose-ul:my-2 prose-li:my-0.5 prose-strong:text-base-content bg-base-100 rounded-2xl border border-base-300 p-4 shadow-xs"
        v-html="renderedHtml"
      ></div>
      <div
        v-else
        class="rounded-2xl border border-dashed border-base-300 bg-base-200/30 p-4 text-xs opacity-60 italic"
      >
        No description provided yet.
      </div>

      <!-- Attached Photo Strip (Read-Only with Zoom Lightbox & @error /view Fallback) -->
      <div v-if="showMedia && existingImages.length > 0" class="space-y-2 pt-1">
        <div class="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider opacity-70">
          <span class="flex items-center gap-1.5">
            <Icon icon="solar:gallery-bold-duotone" class="w-4 h-4 text-primary" />
            Attached Photos & Screenshots ({{ existingImages.length }})
          </span>
          <span class="text-[10px] font-normal normal-case opacity-75">Tap any image to zoom</span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <button
            v-for="imgId in existingImages"
            :key="imgId"
            type="button"
            class="group relative aspect-4/3 rounded-xl overflow-hidden border border-base-300 bg-base-200/60 hover:border-primary transition-all shadow-xs cursor-pointer"
            @click="openZoom(imgId)"
          >
            <img
              v-if="!brokenIds[imgId]"
              :src="resolveThumbUrl(imgId)"
              referrerpolicy="no-referrer"
              alt="Attachment"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              @error="onImgError(imgId)"
            />
            <div v-else class="w-full h-full flex flex-col items-center justify-center text-[10px] opacity-50 gap-1 p-2">
              <Icon icon="solar:gallery-remove-linear" class="w-5 h-5" />
              <span>Image unavailable</span>
            </div>
            <span class="absolute bottom-1.5 right-1.5 badge badge-xs bg-black/65 text-white border-0 gap-1 opacity-85 group-hover:opacity-100">
              <Icon icon="solar:magnifer-zoom-in-bold" class="w-3 h-3" />
              Zoom
            </span>
          </button>
        </div>
      </div>
    </template>

    <!-- ================================================ -->
    <!-- 2. UNLOCKED COMPOSER MODE (Raw MD <-> Preview)   -->
    <!-- ================================================ -->
    <template v-else>
      <div class="space-y-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <label v-if="label" class="text-xs font-black uppercase tracking-wider opacity-75 flex items-center gap-1.5">
            <Icon icon="solar:document-text-bold-duotone" class="w-4 h-4 text-primary" />
            {{ label }}
          </label>

          <!-- Write / Preview Toggle Tabs -->
          <div role="tablist" class="tabs tabs-box tabs-xs bg-base-200 p-0.5">
            <button
              type="button"
              role="tab"
              class="tab font-bold gap-1"
              :class="{ 'tab-active bg-base-100 shadow-xs text-primary': activeMode === 'write' }"
              @click="activeMode = 'write'"
            >
              <Icon icon="solar:pen-new-square-bold" class="w-3.5 h-3.5" />
              Raw MD
            </button>
            <button
              type="button"
              role="tab"
              class="tab font-bold gap-1"
              :class="{ 'tab-active bg-base-100 shadow-xs text-primary': activeMode === 'preview' }"
              @click="activeMode = 'preview'"
            >
              <Icon icon="solar:eye-bold" class="w-3.5 h-3.5" />
              Preview MD
            </button>
          </div>
        </div>

        <!-- Optional AI Helper Action Slot -->
        <slot name="ai-bar" />

        <!-- Raw Markdown Editor -->
        <div v-if="activeMode === 'write'" class="space-y-1">
          <textarea
            :value="modelValue"
            :rows="rows"
            :placeholder="placeholder"
            class="textarea textarea-bordered w-full font-mono text-xs leading-relaxed bg-base-100 focus:border-primary"
            @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
          ></textarea>
          <div class="flex flex-wrap items-center justify-between gap-2 text-[10px] opacity-60 px-1">
            <span>Supports GitHub Markdown: <code>### Heading</code>, <code>**bold**</code>, <code>- bullet</code>, <code>1. numbered</code></span>
            <span v-if="canUploadPhotos && showMedia">Tip: Press <kbd class="kbd kbd-xs">Ctrl+V</kbd> to paste a screenshot</span>
          </div>
        </div>

        <!-- Live Formatted Preview -->
        <div
          v-else
          class="prose prose-sm max-w-none text-base-content prose-headings:font-black prose-h3:text-sm prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 bg-base-100 rounded-2xl border border-primary/30 p-4 min-h-32 shadow-xs"
        >
          <div v-if="modelValue && modelValue.trim()" v-html="renderedHtml"></div>
          <p v-else class="text-xs opacity-50 italic my-0">Nothing to preview yet — switch to Raw MD to write.</p>
        </div>
      </div>

      <!-- Photo Attachment Uploader (Gated to Signed-In Co-op Members) -->
      <div v-if="showMedia" class="pt-1">
        <PhotoGalleryManager
          v-if="canUploadPhotos"
          :existing-images="existingImages"
          :new-photos="newPhotos"
          :bucket-id="COOP_MEDIA_BUCKET_ID"
          :max-photos="maxPhotos"
          :title="photoTitle"
          :allow-paste="true"
          :allow-camera="true"
          :allow-upload="true"
          dropzone-subtitle="Paste screenshots (Ctrl+V), snap a camera photo, or drag images here"
          @update:existing-images="emit('update:existingImages', $event)"
          @update:new-photos="emit('update:newPhotos', $event)"
        />
        <div
          v-else
          class="rounded-xl border border-base-300 bg-base-200/40 px-3 py-2 text-[11px] opacity-70 flex items-center gap-2"
        >
          <Icon icon="solar:shield-keyhole-bold-duotone" class="w-4 h-4 text-warning shrink-0" />
          <span>Sign in to attach screenshots or photos from your phone/clipboard.</span>
        </div>
      </div>
    </template>

    <!-- Full-Res Lightbox Modal -->
    <dialog class="modal" :class="{ 'modal-open': !!zoomFileId }">
      <div class="modal-box max-w-4xl p-3 bg-base-100 border border-base-300 shadow-2xl">
        <div class="flex items-center justify-between pb-2 px-1">
          <span class="text-xs font-bold opacity-75 flex items-center gap-1.5">
            <Icon icon="solar:gallery-bold" class="w-4 h-4 text-primary" />
            Attached Image Preview
          </span>
          <button type="button" class="btn btn-xs btn-circle btn-ghost" @click="zoomFileId = null">✕</button>
        </div>
        <div v-if="zoomFileId" class="rounded-xl overflow-hidden bg-black/85 flex items-center justify-center max-h-[78vh]">
          <img
            :src="resolveFullUrl(zoomFileId)"
            referrerpolicy="no-referrer"
            alt="Full resolution attachment"
            class="max-h-[76vh] w-auto object-contain"
          />
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="button" @click="zoomFileId = null">close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Icon } from '@iconify/vue';
import PhotoGalleryManager from './PhotoGalleryManager.vue';
import { renderSafeMarkdown } from '../../lib/safeMarkdown';
import { COOP_MEDIA_BUCKET_ID, getCoopMediaUrl } from '../../lib/coopMedia';

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    locked?: boolean;
    label?: string;
    placeholder?: string;
    rows?: number;
    showMedia?: boolean;
    existingImages?: string[];
    newPhotos?: any[];
    canUploadPhotos?: boolean;
    maxPhotos?: number;
    photoTitle?: string;
  }>(),
  {
    modelValue: '',
    locked: false,
    label: '',
    placeholder: 'Write using Markdown headings (###), bullets (-), and **bold** text...',
    rows: 6,
    showMedia: true,
    existingImages: () => [],
    newPhotos: () => [],
    canUploadPhotos: false,
    maxPhotos: 6,
    photoTitle: 'Screenshots & Reference Photos',
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'update:existingImages', value: string[]): void;
  (e: 'update:newPhotos', value: any[]): void;
}>();

const activeMode = ref<'write' | 'preview'>('write');
const zoomFileId = ref<string | null>(null);
const fallbackRawViewIds = ref<Record<string, boolean>>({});
const brokenIds = ref<Record<string, boolean>>({});

const renderedHtml = computed(() => renderSafeMarkdown(props.modelValue || ''));

function resolveThumbUrl(fileId: string): string {
  if (fallbackRawViewIds.value[fileId]) {
    return getCoopMediaUrl(fileId, { preview: false });
  }
  return getCoopMediaUrl(fileId, { preview: true, width: 480, height: 360, quality: 82 });
}

function resolveFullUrl(fileId: string): string {
  return getCoopMediaUrl(fileId, { preview: false });
}

function onImgError(fileId: string) {
  if (!fallbackRawViewIds.value[fileId]) {
    fallbackRawViewIds.value = { ...fallbackRawViewIds.value, [fileId]: true };
  } else {
    brokenIds.value = { ...brokenIds.value, [fileId]: true };
  }
}

function openZoom(fileId: string) {
  if (brokenIds.value[fileId]) return;
  zoomFileId.value = fileId;
}
</script>

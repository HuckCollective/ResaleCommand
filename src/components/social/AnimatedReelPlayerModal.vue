<template>
  <dialog class="modal modal-bottom sm:modal-middle z-[90]" :class="{ 'modal-open': isOpen }">
    <div v-if="isOpen" class="modal-box max-w-4xl p-0 bg-base-100 border border-base-300 shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[92dvh]">
      
      <!-- MODAL TOP BAR -->
      <div class="px-4 py-3 sm:px-6 bg-base-200/70 border-b border-base-300 flex items-center justify-between gap-3 shrink-0">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-8 h-8 rounded-xl bg-linear-to-tr from-pink-500 via-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Icon icon="solar:play-circle-bold" class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <h3 class="font-black text-sm sm:text-base text-base-content truncate">
              Animated Reel &amp; Story Studio
            </h3>
            <p class="text-[10px] sm:text-xs text-base-content/60 font-mono truncate">
              Preview slide transitions, mix ambient soundtrack &amp; export ready-to-post video
            </p>
          </div>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <button 
            type="button" 
            @click="showHowToGuide = !showHowToGuide"
            class="btn btn-xs btn-outline border-base-300 gap-1 rounded-xl text-[11px]"
            title="How to post on PC or Phone"
          >
            <Icon icon="solar:question-circle-bold" class="w-3.5 h-3.5 text-primary" />
            <span class="hidden sm:inline">How To Post</span>
          </button>

          <button 
            type="button" 
            @click="handleClose" 
            class="btn btn-ghost btn-sm btn-circle"
            title="Close Player"
          >
            <Icon icon="solar:close-circle-bold" class="w-5 h-5 opacity-70 hover:opacity-100" />
          </button>
        </div>
      </div>

      <!-- HOW TO USE ON PC & PHONE ACCORDION BANNER -->
      <div v-if="showHowToGuide" class="p-3 sm:p-4 bg-primary/10 border-b border-primary/20 text-xs shrink-0 space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-black text-primary flex items-center gap-1.5">
            <Icon icon="solar:smartphone-bold" class="w-4 h-4" />
            <span>How to Create &amp; Post on PC or Phone:</span>
          </span>
          <button @click="showHowToGuide = false" class="btn btn-ghost btn-2xs">✕ Hide</button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] leading-relaxed">
          <div class="bg-base-100 p-2.5 rounded-xl border border-primary/20 space-y-1">
            <div class="font-bold text-primary">1. Choose Theme &amp; Music</div>
            <p class="opacity-75">Pick <strong>Huck's Antique Scholar</strong> or <strong>Cyberpunk</strong>. Your item title, price, and micro-description are automatically stylized on each photo.</p>
          </div>
          <div class="bg-base-100 p-2.5 rounded-xl border border-primary/20 space-y-1">
            <div class="font-bold text-secondary">2. Preview Animated Slides</div>
            <p class="opacity-75">Tap play to watch the story progress bars fill, Ken Burns camera drift, and audio mix in real time. Tap left or right to skip slides.</p>
          </div>
          <div class="bg-base-100 p-2.5 rounded-xl border border-primary/20 space-y-1">
            <div class="font-bold text-success">3. 1-Tap Export</div>
            <p class="opacity-75">Tap <strong>"🎬 Export Video"</strong> for an Instagram Reel / TikTok, or <strong>"Download Pictures"</strong> for an Instagram swipe carousel. Upload straight from your camera roll or browser!</p>
          </div>
        </div>
      </div>

      <!-- MAIN PLAYER BODY -->
      <div class="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center justify-center">
        
        <!-- LEFT: THE REEL VIEWER SCREEN (7 cols) -->
        <div class="lg:col-span-7 flex flex-col items-center justify-center">
          <div 
            class="relative rounded-[32px] overflow-hidden bg-black text-white shadow-2xl border-4 border-base-300 w-full max-w-[360px] select-none group cursor-pointer transition-all"
            :class="aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-square'"
            @click="handleViewerTap"
          >
            <!-- TOP STORY PROGRESS BARS -->
            <div class="absolute top-2 inset-x-2.5 z-30 flex items-center gap-1.5 pointer-events-none">
              <div 
                v-for="(s, idx) in slides" 
                :key="s.id || idx" 
                class="flex-1 h-1 bg-white/30 rounded-full overflow-hidden"
              >
                <div 
                  class="h-full bg-white transition-all"
                  :style="{ 
                    width: idx < activeIndex ? '100%' : (idx === activeIndex ? `${slideProgress}%` : '0%'),
                    transitionDuration: idx === activeIndex && isPlaying ? '100ms' : '0ms'
                  }"
                ></div>
              </div>
            </div>

            <!-- TOP VENUE & ACCOUNT HEADER -->
            <div class="absolute top-5 inset-x-3.5 z-30 flex items-center justify-between text-xs pointer-events-none drop-shadow-md">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-full bg-linear-to-tr from-amber-500 via-pink-500 to-purple-600 p-0.5">
                  <div class="w-full h-full rounded-full bg-black flex items-center justify-center text-[10px] font-black">RC</div>
                </div>
                <div class="min-w-0 font-bold text-[11px] truncate">
                  @{{ authorHandle || 'resalecommand' }}
                  <span class="opacity-70 font-normal ml-1">• {{ venueName || 'Memory Den' }}</span>
                </div>
              </div>
              <span class="badge badge-xs bg-black/60 border border-white/20 font-mono text-[9px] text-white">
                {{ activeIndex + 1 }} / {{ slides.length }}
              </span>
            </div>

            <!-- CANVAS FOR RENDERED OVERLAY -->
            <canvas 
              ref="playerCanvasRef" 
              class="w-full h-full object-cover transition-transform"
              :class="isPlaying ? 'scale-105 duration-4000 transition-transform ease-out' : 'scale-100 duration-300'"
            ></canvas>

            <!-- PLAY/PAUSE OVERLAY INDICATOR (Visible briefly on tap or paused) -->
            <div 
              v-if="!isPlaying" 
              class="absolute inset-0 bg-black/40 flex items-center justify-center z-20 pointer-events-none"
            >
              <div class="w-14 h-14 rounded-full bg-black/70 border border-white/30 flex items-center justify-center text-white backdrop-blur-xs">
                <Icon icon="solar:play-bold" class="w-7 h-7 ml-1" />
              </div>
            </div>

            <!-- TAP LEFT / RIGHT ARROWS -->
            <button 
              type="button" 
              @click.stop="prevSlide" 
              class="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30 hover:bg-black/80"
              title="Previous slide (‹)"
            >
              ‹
            </button>
            <button 
              type="button" 
              @click.stop="nextSlide" 
              class="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30 hover:bg-black/80"
              title="Next slide (›)"
            >
              ›
            </button>
          </div>

          <!-- PLAYBACK TRANSPORT BAR -->
          <div class="flex items-center justify-center gap-3 mt-3 w-full max-w-[360px]">
            <button 
              type="button" 
              @click="togglePlay"
              class="btn btn-sm btn-circle btn-primary text-primary-content shadow-md"
              :title="isPlaying ? 'Pause' : 'Play Animated Slideshow'"
            >
              <Icon :icon="isPlaying ? 'solar:pause-bold' : 'solar:play-bold'" class="w-4 h-4" :class="isPlaying ? '' : 'ml-0.5'" />
            </button>

            <button 
              type="button" 
              @click="prevSlide"
              class="btn btn-sm btn-ghost btn-circle"
              title="Previous"
            >
              <Icon icon="solar:skip-previous-bold" class="w-4 h-4" />
            </button>

            <button 
              type="button" 
              @click="nextSlide"
              class="btn btn-sm btn-ghost btn-circle"
              title="Next"
            >
              <Icon icon="solar:skip-next-bold" class="w-4 h-4" />
            </button>

            <div class="h-4 w-px bg-base-300"></div>

            <!-- Volume / Mute -->
            <button 
              type="button" 
              @click="toggleMute"
              class="btn btn-sm btn-ghost btn-circle"
              :title="isMuted ? 'Unmute Audio' : 'Mute Audio'"
            >
              <Icon :icon="isMuted ? 'solar:volume-cross-bold' : 'solar:volume-loud-bold'" class="w-4 h-4" :class="isMuted ? 'text-error' : 'text-primary'" />
            </button>
          </div>
        </div>

        <!-- RIGHT: CONTROLS, THEME, SOUND & EXPORT (5 cols) -->
        <div class="lg:col-span-5 space-y-4 text-xs">
          
          <!-- 1. THEME SELECTION -->
          <div class="bg-base-200/50 p-3 rounded-2xl border border-base-300 space-y-2">
            <label class="font-black text-xs flex items-center justify-between">
              <span>1. Stylized Typography Theme</span>
              <span class="text-[10px] font-mono opacity-60">Overlaid on photos</span>
            </label>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              <button 
                type="button"
                v-for="(meta, tKey) in OVERLAY_THEMES"
                :key="tKey"
                @click="setTheme(tKey)"
                class="btn btn-xs rounded-xl justify-start gap-1.5 h-8 font-bold text-left transition-all"
                :class="selectedTheme === tKey ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost bg-base-100 hover:bg-base-300'"
              >
                <span>{{ meta.emoji }}</span>
                <span class="truncate">{{ meta.label }}</span>
              </button>
            </div>
          </div>

          <!-- 2. BURN-IN PLACEMENT & ADJUSTMENTS -->
          <div class="bg-base-200/50 p-3 rounded-2xl border border-base-300 space-y-2.5">
            <div class="flex items-center justify-between">
              <label class="font-black text-xs flex items-center gap-1.5">
                <Icon icon="solar:layers-minimalistic-bold" class="w-3.5 h-3.5 text-primary" />
                <span>2. Placement &amp; Visibility</span>
              </label>
              <!-- Position Selector -->
              <div class="join">
                <button 
                  v-for="pos in (['bottom_card', 'top_banner', 'center_spotlight', 'bottom_compact', 'none'] as const)"
                  :key="pos"
                  type="button"
                  @click="burnInPosition = pos; renderCurrentSlide()"
                  class="join-item btn btn-2xs font-bold"
                  :class="burnInPosition === pos ? 'btn-primary' : 'btn-ghost bg-base-100'"
                  :title="OVERLAY_POSITIONS[pos]?.label"
                >
                  <span>{{ OVERLAY_POSITIONS[pos]?.emoji }}</span>
                </button>
              </div>
            </div>

            <!-- Content Toggles: Title, Price, Quote, Venue -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-0.5">
              <label class="label py-1 cursor-pointer justify-start gap-1.5 bg-base-100 px-2 rounded-xl border border-base-300/70">
                <input type="checkbox" v-model="showBurnInTitle" @change="renderCurrentSlide" class="checkbox checkbox-2xs checkbox-primary" />
                <span class="label-text text-[10px] font-bold">Title</span>
              </label>
              <label class="label py-1 cursor-pointer justify-start gap-1.5 bg-base-100 px-2 rounded-xl border border-base-300/70">
                <input type="checkbox" v-model="showBurnInPrice" @change="renderCurrentSlide" class="checkbox checkbox-2xs checkbox-primary" />
                <span class="label-text text-[10px] font-bold">Price</span>
              </label>
              <label class="label py-1 cursor-pointer justify-start gap-1.5 bg-base-100 px-2 rounded-xl border border-base-300/70">
                <input type="checkbox" v-model="showBurnInQuote" @change="renderCurrentSlide" class="checkbox checkbox-2xs checkbox-primary" />
                <span class="label-text text-[10px] font-bold">Quote</span>
              </label>
              <label class="label py-1 cursor-pointer justify-start gap-1.5 bg-base-100 px-2 rounded-xl border border-base-300/70">
                <input type="checkbox" v-model="showBurnInVenue" @change="renderCurrentSlide" class="checkbox checkbox-2xs checkbox-primary" />
                <span class="label-text text-[10px] font-bold">Venue</span>
              </label>
            </div>

            <!-- Opacity Selector -->
            <div class="flex items-center justify-between text-[11px] pt-0.5">
              <span class="opacity-70 font-bold">Card Darkness:</span>
              <div class="join">
                <button 
                  type="button" 
                  @click="burnInCardOpacity = 0.60; renderCurrentSlide()"
                  class="join-item btn btn-2xs"
                  :class="burnInCardOpacity === 0.60 ? 'btn-neutral' : 'btn-ghost bg-base-100'"
                >
                  60% Glass
                </button>
                <button 
                  type="button" 
                  @click="burnInCardOpacity = 0.88; renderCurrentSlide()"
                  class="join-item btn btn-2xs"
                  :class="burnInCardOpacity === 0.88 ? 'btn-neutral' : 'btn-ghost bg-base-100'"
                >
                  88% Classic
                </button>
                <button 
                  type="button" 
                  @click="burnInCardOpacity = 0.98; renderCurrentSlide()"
                  class="join-item btn btn-2xs"
                  :class="burnInCardOpacity === 0.98 ? 'btn-neutral' : 'btn-ghost bg-base-100'"
                >
                  98% Solid
                </button>
              </div>
            </div>
          </div>

          <!-- 3. SOUNDTRACK & AUDIO MIXER -->
          <div class="bg-base-200/50 p-3 rounded-2xl border border-base-300 space-y-2.5">
            <div class="flex items-center justify-between">
              <label class="font-black text-xs flex items-center gap-1.5">
                <Icon icon="solar:music-library-2-bold" class="w-3.5 h-3.5 text-secondary" />
                <span>3. Music / Audio Track</span>
              </label>
              <button 
                type="button" 
                @click="triggerCustomAudioSelect"
                class="text-[10px] text-primary hover:underline font-bold flex items-center gap-1"
              >
                <Icon icon="solar:upload-track-2-bold" class="w-3.5 h-3.5" />
                <span>{{ customAudioName ? 'Change MP3' : '+ Upload MP3' }}</span>
              </button>
            </div>

            <input 
              type="file" 
              ref="audioFileInputRef" 
              accept="audio/*" 
              class="hidden" 
              @change="handleCustomAudioUpload" 
            />

            <div v-if="customAudioName" class="p-2 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between text-xs">
              <span class="font-bold text-primary truncate flex items-center gap-1">
                <span>🎵</span>
                <span class="truncate">{{ customAudioName }}</span>
              </span>
              <button type="button" @click="clearCustomAudio" class="text-error font-bold text-[10px] hover:underline">Remove</button>
            </div>

            <div class="grid grid-cols-2 gap-1.5">
              <button 
                type="button" 
                @click="setSound('none')" 
                class="btn btn-xs rounded-xl justify-start gap-1.5 h-8 font-bold text-left"
                :class="soundPreset === 'none' && !customAudioName ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost bg-base-100'"
                title="Recommended: Pick trending hit music in Instagram Reels or TikTok for max reach!"
              >
                <span>🔇</span>
                <span class="truncate">Mute (Pick in IG/TikTok)</span>
              </button>

              <button 
                type="button" 
                @click="setSound('lofi')" 
                class="btn btn-xs rounded-xl justify-start gap-1.5 h-8 font-bold text-left"
                :class="soundPreset === 'lofi' ? 'btn-secondary text-secondary-content shadow-xs' : 'btn-ghost bg-base-100'"
              >
                <span>☕</span>
                <span class="truncate">Cozy Lo-Fi Rhodes</span>
              </button>

              <button 
                type="button" 
                @click="setSound('antique')" 
                class="btn btn-xs rounded-xl justify-start gap-1.5 h-8 font-bold text-left"
                :class="soundPreset === 'antique' ? 'btn-secondary text-secondary-content shadow-xs' : 'btn-ghost bg-base-100'"
              >
                <span>🏛️</span>
                <span class="truncate">Vintage Piano Study</span>
              </button>

              <button 
                type="button" 
                @click="setSound('cyberpunk')" 
                class="btn btn-xs rounded-xl justify-start gap-1.5 h-8 font-bold text-left"
                :class="soundPreset === 'cyberpunk' ? 'btn-secondary text-secondary-content shadow-xs' : 'btn-ghost bg-base-100'"
              >
                <span>🌌</span>
                <span class="truncate">Velvet Synthwave</span>
              </button>
            </div>
          </div>

          <!-- 4. FORMAT & SPEED CONTROLS -->
          <div class="grid grid-cols-2 gap-2">
            <!-- Aspect Ratio Switcher -->
            <div class="bg-base-200/50 p-2.5 rounded-2xl border border-base-300 space-y-1">
              <label class="font-bold text-[10px] opacity-70 block">Format / Aspect</label>
              <div class="join w-full">
                <button 
                  type="button"
                  @click="aspectRatio = '1:1'; renderCurrentSlide()"
                  class="join-item btn btn-2xs flex-1 font-bold"
                  :class="aspectRatio === '1:1' ? 'btn-primary' : 'btn-ghost bg-base-100'"
                >
                  1:1 Feed
                </button>
                <button 
                  type="button"
                  @click="aspectRatio = '9:16'; renderCurrentSlide()"
                  class="join-item btn btn-2xs flex-1 font-bold"
                  :class="aspectRatio === '9:16' ? 'btn-primary' : 'btn-ghost bg-base-100'"
                >
                  9:16 Reel
                </button>
              </div>
            </div>

            <!-- Slide Duration -->
            <div class="bg-base-200/50 p-2.5 rounded-2xl border border-base-300 space-y-1">
              <label class="font-bold text-[10px] opacity-70 block">Pacing: {{ slideDuration }}s / slide</label>
              <div class="join w-full">
                <button 
                  v-for="d in [2.5, 3.5, 5.0]" 
                  :key="d"
                  type="button"
                  @click="slideDuration = d"
                  class="join-item btn btn-2xs flex-1 font-bold"
                  :class="slideDuration === d ? 'btn-primary' : 'btn-ghost bg-base-100'"
                >
                  {{ d }}s
                </button>
              </div>
            </div>
          </div>

          <!-- 5. ACTIVE SLIDE TEXT QUICK-EDITOR -->
          <div class="bg-base-200/50 p-3 rounded-2xl border border-base-300 space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-[11px] truncate">
                Slide #{{ activeIndex + 1 }} Text &amp; Quote:
              </span>
              <span class="text-[9px] font-mono opacity-50">{{ (currentSlide?.description || '').length }} chars</span>
            </div>
            <div class="grid grid-cols-3 gap-1.5">
              <input 
                v-model="currentSlideTitle" 
                @input="renderCurrentSlide"
                placeholder="Item Title"
                class="input input-xs input-bordered col-span-2 rounded-xl bg-base-100 font-bold"
                title="Edit slide title"
              />
              <input 
                v-model="currentSlidePrice" 
                @input="renderCurrentSlide"
                placeholder="Price ($)"
                class="input input-xs input-bordered col-span-1 rounded-xl bg-base-100 font-mono"
                title="Edit slide price"
              />
            </div>
            <textarea 
              v-model="currentSlideDescription" 
              @input="onDescriptionInput"
              rows="2"
              placeholder="Add micro-narrative or provenance quote for this photo..."
              class="textarea textarea-bordered textarea-xs w-full rounded-xl bg-base-100 resize-none leading-relaxed text-xs"
            ></textarea>
          </div>

          <!-- 5. EXPORT ACTIONS -->
          <div class="space-y-2 pt-1">
            <!-- Progress bar during render -->
            <div v-if="isExporting" class="p-3 bg-base-200 rounded-2xl space-y-1.5 border border-primary/30">
              <div class="flex items-center justify-between font-mono font-bold text-xs text-primary">
                <span>{{ exportStatusMessage || 'Rendering...' }}</span>
                <span>{{ exportPercent }}%</span>
              </div>
              <progress class="progress progress-primary w-full" :value="exportPercent" max="100"></progress>
            </div>

            <!-- Hero Video Export Button -->
            <button 
              type="button" 
              @click="handleExportVideo"
              :disabled="isExporting || slides.length === 0"
              class="btn btn-sm w-full bg-linear-to-r from-purple-600 via-indigo-600 to-pink-600 hover:brightness-110 text-white font-black rounded-2xl gap-2 shadow-lg shadow-purple-500/25 border-none h-11 active:scale-95"
            >
              <Icon icon="solar:clapperboard-play-bold" class="w-4 h-4" />
              <span>🎬 Export Animated Video / Reel (.webm)</span>
            </button>

            <!-- Batch Download Burned Pictures ZIP -->
            <div class="grid grid-cols-2 gap-2">
              <button 
                type="button" 
                @click="handleExportBurnedZip"
                :disabled="isExporting || slides.length === 0"
                class="btn btn-xs sm:btn-sm btn-outline border-base-300 font-bold rounded-xl gap-1 hover:border-secondary"
                title="Download all images with text overlay burned onto the graphic"
              >
                <Icon icon="solar:archive-down-minimlistic-bold" class="w-3.5 h-3.5 text-secondary" />
                <span class="truncate">Burn All (.zip)</span>
              </button>

              <button 
                type="button" 
                @click="handleDownloadCurrentSlide"
                :disabled="isExporting || !currentSlide"
                class="btn btn-xs sm:btn-sm btn-outline border-base-300 font-bold rounded-xl gap-1 hover:border-primary"
                title="Download current slide with burned text"
              >
                <Icon icon="solar:download-minimalistic-bold" class="w-3.5 h-3.5 text-primary" />
                <span class="truncate">Save Slide #{{ activeIndex + 1 }}</span>
              </button>
            </div>
          </div>

        </div>
      </div>

    </div>
    <form method="dialog" class="modal-backdrop" @click="handleClose">
      <button>close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { 
  type OverlayTheme, 
  type AspectRatio, 
  type OverlayPosition,
  OVERLAY_THEMES, 
  OVERLAY_POSITIONS,
  loadImage, 
  renderSlideToCanvas, 
  renderSlideToBlob, 
  burnAllSlidesToZip, 
  exportSlidesToVideo 
} from '../../lib/slideCanvasEngine';
import { ambientSoundtrack } from '../../lib/ambientSoundtrack';
import { addToast } from '../../stores/toast';
import type { PostMediaSlide } from '../../lib/socialMediaStudio';

const props = defineProps<{
  isOpen: boolean;
  slides: PostMediaSlide[];
  venueName?: string;
  authorHandle?: string;
  initialTheme?: OverlayTheme;
  initialIndex?: number;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'update:slideDescription', payload: { index: number; description: string }): void;
}>();

const playerCanvasRef = ref<HTMLCanvasElement | null>(null);
const activeIndex = ref(0);
const isPlaying = ref(false);
const isMuted = ref(false);
const slideDuration = ref(3.5); // seconds
const slideProgress = ref(0);
const aspectRatio = ref<AspectRatio>('1:1');
const selectedTheme = ref<OverlayTheme>(props.initialTheme || 'antique');
const soundPreset = ref<'cyberpunk' | 'antique' | 'lofi' | 'ethereal' | 'none'>('lofi');
const showHowToGuide = ref(false);

// Burn-In Adjustments
const burnInPosition = ref<OverlayPosition>('bottom_card');
const burnInCardOpacity = ref<number>(0.88);
const burnInFontScale = ref<number>(1.0);
const showBurnInTitle = ref(true);
const showBurnInPrice = ref(true);
const showBurnInQuote = ref(true);
const showBurnInVenue = ref(true);

// Custom audio upload
const customAudioFile = ref<File | null>(null);
const customAudioName = ref<string>('');
const audioFileInputRef = ref<HTMLInputElement | null>(null);

// Export state
const isExporting = ref(false);
const exportPercent = ref(0);
const exportStatusMessage = ref('');

let animationTimer: number | null = null;
let progressInterval: number | null = null;

const currentSlide = computed(() => {
  return props.slides[activeIndex.value] || null;
});

const currentSlideTitle = computed({
  get: () => currentSlide.value?.title || '',
  set: (val: string) => {
    if (currentSlide.value) {
      currentSlide.value.title = val;
    }
  }
});

const currentSlidePrice = computed({
  get: () => currentSlide.value?.price !== undefined ? String(currentSlide.value.price) : '',
  set: (val: string) => {
    if (currentSlide.value) {
      const num = parseFloat(val);
      currentSlide.value.price = isNaN(num) ? 0 : num;
    }
  }
});

const currentSlideDescription = computed({
  get: () => currentSlide.value?.description || '',
  set: (val: string) => {
    if (currentSlide.value) {
      currentSlide.value.description = val;
      emit('update:slideDescription', { index: activeIndex.value, description: val });
    }
  }
});

function onDescriptionInput() {
  renderCurrentSlide();
}

function handleClose() {
  stopPlayback();
  ambientSoundtrack.stop();
  emit('close');
}

function setTheme(theme: OverlayTheme) {
  selectedTheme.value = theme;
  renderCurrentSlide();
}

function setSound(preset: 'cyberpunk' | 'antique' | 'lofi' | 'ethereal' | 'none') {
  customAudioFile.value = null;
  customAudioName.value = '';
  soundPreset.value = preset;
  if (isPlaying.value && !isMuted.value) {
    ambientSoundtrack.play(preset);
  }
}

function triggerCustomAudioSelect() {
  audioFileInputRef.value?.click();
}

async function handleCustomAudioUpload(e: Event) {
  const target = e.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;
  const file = target.files[0];
  customAudioFile.value = file;
  customAudioName.value = file.name;
  soundPreset.value = 'none'; // custom audio takes priority
  if (isPlaying.value && !isMuted.value) {
    await ambientSoundtrack.play('none', file);
  }
}

function clearCustomAudio() {
  customAudioFile.value = null;
  customAudioName.value = '';
  ambientSoundtrack.stop();
  if (audioFileInputRef.value) {
    audioFileInputRef.value.value = '';
  }
}

function toggleMute() {
  isMuted.value = !isMuted.value;
  ambientSoundtrack.setVolume(isMuted.value ? 0 : 0.5);
}

function handleViewerTap(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const width = rect.width;

  if (clickX < width * 0.35) {
    prevSlide();
  } else if (clickX > width * 0.65) {
    nextSlide();
  } else {
    togglePlay();
  }
}

function togglePlay() {
  if (isPlaying.value) {
    stopPlayback();
  } else {
    startPlayback();
  }
}

function startPlayback() {
  isPlaying.value = true;
  slideProgress.value = 0;

  if (!isMuted.value) {
    if (customAudioFile.value) {
      ambientSoundtrack.play('none', customAudioFile.value);
    } else if (soundPreset.value !== 'none') {
      ambientSoundtrack.play(soundPreset.value);
    }
  }

  // Progress ticker for smooth top story bar
  const intervalMs = 50;
  const totalTicks = (slideDuration.value * 1000) / intervalMs;
  let currentTick = 0;

  if (progressInterval) window.clearInterval(progressInterval);
  progressInterval = window.setInterval(() => {
    currentTick++;
    slideProgress.value = Math.min(100, (currentTick / totalTicks) * 100);
    if (slideProgress.value >= 100) {
      nextSlide();
      currentTick = 0;
      slideProgress.value = 0;
    }
  }, intervalMs);
}

function stopPlayback() {
  isPlaying.value = false;
  slideProgress.value = 0;
  if (progressInterval) {
    window.clearInterval(progressInterval);
    progressInterval = null;
  }
  ambientSoundtrack.stop();
}

function nextSlide() {
  if (props.slides.length === 0) return;
  activeIndex.value = (activeIndex.value + 1) % props.slides.length;
  slideProgress.value = 0;
  renderCurrentSlide();
}

function prevSlide() {
  if (props.slides.length === 0) return;
  activeIndex.value = (activeIndex.value - 1 + props.slides.length) % props.slides.length;
  slideProgress.value = 0;
  renderCurrentSlide();
}

async function renderCurrentSlide() {
  if (!playerCanvasRef.value || !currentSlide.value) return;
  const canvas = playerCanvasRef.value;
  const isVertical = aspectRatio.value === '9:16';
  canvas.width = 1080;
  canvas.height = isVertical ? 1920 : 1080;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  try {
    const img = await loadImage(currentSlide.value.url);
    renderSlideToCanvas(ctx, img, currentSlide.value, {
      theme: selectedTheme.value,
      aspectRatio: aspectRatio.value,
      venueName: props.venueName,
      showOverlay: burnInPosition.value !== 'none',
      position: burnInPosition.value,
      cardOpacity: burnInCardOpacity.value,
      fontSizeScale: burnInFontScale.value,
      showTitle: showBurnInTitle.value,
      showPrice: showBurnInPrice.value,
      showQuote: showBurnInQuote.value,
      showVenue: showBurnInVenue.value
    });
  } catch (err) {
    console.warn('[AnimatedReelPlayer] Failed to render slide:', err);
  }
}

// -----------------------------------------------------------------
// EXPORT HANDLERS
// -----------------------------------------------------------------
async function handleExportVideo() {
  if (props.slides.length === 0) return;
  stopPlayback();
  isExporting.value = true;
  exportPercent.value = 5;
  exportStatusMessage.value = 'Initializing video synthesizer...';

  try {
    const videoBlob = await exportSlidesToVideo(props.slides, {
      theme: selectedTheme.value,
      aspectRatio: aspectRatio.value,
      soundPreset: soundPreset.value,
      customAudioFile: customAudioFile.value || undefined,
      durationPerSlideSec: slideDuration.value,
      venueName: props.venueName,
      showOverlay: burnInPosition.value !== 'none',
      position: burnInPosition.value,
      cardOpacity: burnInCardOpacity.value,
      fontSizeScale: burnInFontScale.value,
      showTitle: showBurnInTitle.value,
      showPrice: showBurnInPrice.value,
      showQuote: showBurnInQuote.value,
      showVenue: showBurnInVenue.value,
      onProgress: (pct, msg) => {
        exportPercent.value = pct;
        exportStatusMessage.value = msg;
      }
    });

    const isMp4 = videoBlob.type.includes('mp4');
    const ext = isMp4 ? 'mp4' : 'webm';
    const filename = `Dropcast_Reel_${new Date().toISOString().slice(0, 10)}.${ext}`;

    const url = URL.createObjectURL(videoBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);

    addToast({
      type: 'success',
      message: `🎬 Exported Reel video (${ext.toUpperCase()})! Ready to post on Instagram & TikTok.`
    });
  } catch (err: any) {
    addToast({ type: 'error', message: `Video export failed: ${err.message}` });
  } finally {
    isExporting.value = false;
  }
}

async function handleExportBurnedZip() {
  if (props.slides.length === 0) return;
  isExporting.value = true;
  exportPercent.value = 5;
  exportStatusMessage.value = 'Burning stylized cards onto photos...';

  try {
    const zipBlob = await burnAllSlidesToZip(props.slides, {
      theme: selectedTheme.value,
      aspectRatio: aspectRatio.value,
      venueName: props.venueName,
      showOverlay: burnInPosition.value !== 'none',
      position: burnInPosition.value,
      cardOpacity: burnInCardOpacity.value,
      fontSizeScale: burnInFontScale.value,
      showTitle: showBurnInTitle.value,
      showPrice: showBurnInPrice.value,
      showQuote: showBurnInQuote.value,
      showVenue: showBurnInVenue.value,
      onProgress: (pct, msg) => {
        exportPercent.value = pct;
        exportStatusMessage.value = msg;
      }
    });

    const filename = `Dropcast_Burned_Cards_${new Date().toISOString().slice(0, 10)}.zip`;
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);

    addToast({ type: 'success', message: '📦 Downloaded burned slide cards (.zip)!' });
  } catch (err: any) {
    addToast({ type: 'error', message: `ZIP export failed: ${err.message}` });
  } finally {
    isExporting.value = false;
  }
}

async function handleDownloadCurrentSlide() {
  if (!currentSlide.value) return;
  try {
    const blob = await renderSlideToBlob(currentSlide.value, {
      theme: selectedTheme.value,
      aspectRatio: aspectRatio.value,
      venueName: props.venueName,
      showOverlay: burnInPosition.value !== 'none',
      position: burnInPosition.value,
      cardOpacity: burnInCardOpacity.value,
      fontSizeScale: burnInFontScale.value,
      showTitle: showBurnInTitle.value,
      showPrice: showBurnInPrice.value,
      showQuote: showBurnInQuote.value,
      showVenue: showBurnInVenue.value
    });

    const safeTitle = (currentSlide.value.title || 'Slide').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    const filename = `Slide_${activeIndex.value + 1}_${safeTitle}.jpg`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    addToast({ type: 'success', message: `Saved slide #${activeIndex.value + 1} with stylized text!` });
  } catch (err: any) {
    addToast({ type: 'error', message: `Failed to save slide: ${err.message}` });
  }
}

watch(() => props.isOpen, (open) => {
  if (open) {
    if (typeof props.initialIndex === 'number' && props.initialIndex >= 0 && props.initialIndex < props.slides.length) {
      activeIndex.value = props.initialIndex;
    } else {
      activeIndex.value = 0;
    }
    setTimeout(() => renderCurrentSlide(), 80);
  } else {
    stopPlayback();
  }
});

watch(activeIndex, () => {
  renderCurrentSlide();
});

onUnmounted(() => {
  stopPlayback();
});
</script>

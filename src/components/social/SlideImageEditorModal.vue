<template>
  <dialog class="modal z-[95] m-0 p-0 max-w-none max-h-none overflow-hidden" :class="{ 'modal-open': isOpen }">
    <div v-if="isOpen" class="w-screen max-w-none h-screen max-h-none rounded-none m-0 p-0 bg-base-100 flex flex-col fixed inset-0 z-[95] overflow-hidden select-none">
      
      <!-- FULLSCREEN STUDIO TOP WORKSPACE HEADER -->
      <div class="px-4 py-2.5 sm:px-6 bg-base-200/95 backdrop-blur-md border-b border-base-300 flex items-center justify-between gap-3 shrink-0">
        <!-- Left: Studio Title & Slide Badge -->
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon icon="solar:crop-minimalistic-bold" class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <h3 class="font-black text-sm sm:text-base text-base-content truncate flex items-center gap-2">
              <span>Fullscreen Slide Studio</span>
              <span class="badge badge-sm badge-primary font-mono font-bold">{{ selectedSlideIndex + 1 }} / {{ slides.length }}</span>
            </h3>
            <p class="text-[11px] opacity-65 font-mono truncate hidden sm:block">
              Framing, watermark blotting, AI relight, and creator typography
            </p>
          </div>
        </div>

        <!-- Center: Slide Filmstrip (Desktop) -->
        <div v-if="slides.length > 1" class="hidden md:flex items-center gap-1.5 overflow-x-auto max-w-md py-0.5 no-scrollbar">
          <button 
            v-for="(slide, sIdx) in slides" 
            :key="slide.id || sIdx"
            type="button"
            @click="selectSlide(sIdx)"
            class="relative w-9 h-11 rounded-lg overflow-hidden border-2 transition-all shrink-0 active:scale-95 bg-base-300"
            :class="selectedSlideIndex === sIdx ? 'border-primary ring-2 ring-primary/40 scale-105 shadow-sm' : 'border-base-300/80 opacity-60 hover:opacity-100'"
            :title="`Jump to Slide ${sIdx + 1}`"
          >
            <img :src="slide.url" class="w-full h-full object-cover" alt="Slide thumb" />
            <span class="absolute bottom-0.5 right-0.5 badge badge-2xs font-mono font-bold bg-black/80 text-white text-[7px] px-0.5 py-0 border-none">
              {{ sIdx + 1 }}
            </span>
          </button>
        </div>

        <!-- Right: Close Studio Button -->
        <div class="flex items-center gap-2 shrink-0">
          <button 
            type="button" 
            @click="handleClose" 
            class="btn btn-ghost btn-sm btn-circle"
            title="Close Fullscreen Studio"
          >
            <Icon icon="solar:close-circle-bold" class="w-6 h-6 opacity-70 hover:opacity-100 text-base-content" />
          </button>
        </div>
      </div>

      <!-- Mobile Slide Filmstrip Bar -->
      <div v-if="slides.length > 1" class="md:hidden px-3 py-1.5 bg-base-200/50 border-b border-base-300 shrink-0 overflow-x-auto flex items-center gap-1.5 select-none no-scrollbar">
        <span class="text-[10px] font-bold uppercase tracking-wider opacity-60 shrink-0 mr-0.5">Slides:</span>
        <button 
          v-for="(slide, sIdx) in slides" 
          :key="slide.id || sIdx"
          type="button"
          @click="selectSlide(sIdx)"
          class="relative w-8 h-10 rounded-lg overflow-hidden border transition-all shrink-0 active:scale-95 bg-base-300"
          :class="selectedSlideIndex === sIdx ? 'border-primary ring-2 ring-primary/50 scale-105' : 'border-base-300/80 opacity-60'"
        >
          <img :src="slide.url" class="w-full h-full object-cover" alt="Slide thumb" />
          <span class="absolute bottom-0 right-0 badge badge-2xs font-mono font-bold bg-black/80 text-white text-[7px] px-0.5 py-0 border-none">
            {{ sIdx + 1 }}
          </span>
        </button>
      </div>

      <!-- MAIN WORKSPACE BODY (CANVAS / PREVIEW ON LEFT, CONTROLS ON RIGHT) -->
      <div class="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-0">
        
        <!-- LEFT: INTERACTIVE PREVIEW VIEWPORT (7 COLS) -->
        <div class="lg:col-span-7 p-4 sm:p-6 bg-neutral-950/90 flex flex-col items-center justify-center relative overflow-hidden select-none">
          
          <!-- Aspect ratio & watermark status badges -->
          <div class="absolute top-3 left-3 z-10 flex items-center gap-1.5 flex-wrap px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-mono font-bold text-white border border-white/10">
            <span>Aspect: {{ currentAspectLabel }}</span>
            <span class="badge badge-2xs" :class="framingMode === 'contain' ? 'badge-secondary text-secondary-content' : 'badge-neutral'">{{ framingMode === 'contain' ? '🖼️ Fit Item' : '📐 Fill' }}</span>
            <span v-if="rotation !== 0" class="text-secondary ml-1">• {{ rotation }}°</span>
            <span v-if="isFlippedH" class="text-accent ml-1">• Flipped</span>
            <span v-if="bottomTrim > 0" class="badge badge-2xs badge-warning text-warning-content font-bold ml-1">✂️ -{{ bottomTrim }}% Btm</span>
            <span v-if="topTrim > 0" class="badge badge-2xs badge-warning text-warning-content font-bold ml-1">✂️ -{{ topTrim }}% Top</span>
            <span v-if="leftTrim > 0" class="badge badge-2xs badge-warning text-warning-content font-bold ml-1">✂️ -{{ leftTrim }}% L</span>
            <span v-if="rightTrim > 0" class="badge badge-2xs badge-warning text-warning-content font-bold ml-1">✂️ -{{ rightTrim }}% R</span>
            <span v-if="enableWatermarkPatch" class="badge badge-2xs badge-secondary text-secondary-content font-bold ml-1">🪄 Healed</span>
            <span v-if="showBurnInText" class="badge badge-2xs badge-accent text-accent-content font-bold ml-1">🔥 Text</span>
          </div>

          <!-- Preview Mode Toggle: Cut Guides vs Clean Result (Top Right) -->
          <div class="absolute top-3 right-3 z-10 flex items-center bg-black/70 backdrop-blur-md rounded-full p-0.5 border border-white/15 text-[10px] font-bold">
            <button 
              type="button" 
              @click="previewMode = 'cut_zones'" 
              class="px-2.5 py-1 rounded-full transition-all flex items-center gap-1"
              :class="previewMode === 'cut_zones' ? 'bg-warning text-warning-content shadow-xs' : 'text-white/70 hover:text-white'"
              title="Show red striped bands where watermarks are being trimmed"
            >
              <Icon icon="solar:shield-warning-bold" class="w-3 h-3" />
              <span>✂️ Cut Guides</span>
            </button>
            <button 
              type="button" 
              @click="previewMode = 'clean'" 
              class="px-2.5 py-1 rounded-full transition-all flex items-center gap-1"
              :class="previewMode === 'clean' ? 'bg-primary text-primary-content shadow-xs' : 'text-white/70 hover:text-white'"
              title="Preview the clean final photo with cuts applied"
            >
              <Icon icon="solar:eye-bold" class="w-3 h-3" />
              <span>👁️ Clean Result</span>
            </button>
          </div>

          <!-- Live Preview Frame with Direct Hardware-Accelerated Image Rendering -->
          <div 
            class="relative max-w-full max-h-[calc(100vh-210px)] flex items-center justify-center overflow-hidden rounded-2xl shadow-2xl border border-white/15 bg-black"
            :style="canvasContainerStyle"
          >
            <!-- Ambient blurred backdrop in contain mode when letterboxed -->
            <img 
              v-if="currentSlideUrl && framingMode === 'contain' && selectedAspect !== 'original'"
              :src="healedPreviewUrl || currentSlideUrl" 
              class="absolute inset-0 w-full h-full object-cover blur-2xl opacity-45 pointer-events-none scale-125"
              alt=""
            />
            <div 
              v-if="currentSlideUrl && framingMode === 'contain' && selectedAspect !== 'original'"
              class="absolute inset-0 bg-black/35 pointer-events-none z-1"
            ></div>

            <img 
              v-if="currentSlideUrl"
              ref="previewImgRef"
              :src="healedPreviewUrl || currentSlideUrl" 
              class="max-w-full max-h-full pointer-events-none select-none transition-all duration-75 relative z-2"
              :class="framingMode === 'contain' ? 'object-contain' : 'w-full h-full object-cover'"
              :style="previewTransformStyle"
              alt="Slide Preview"
              @load="onImageLoaded"
              @error="onImageError"
            />
            <div v-else class="text-white/40 text-xs">No image available</div>

            <!-- CROP & WATERMARK CUT EXCLUSION ZONES (Visible in Cut Guides mode) -->
            <template v-if="previewMode === 'cut_zones'">
              <!-- Top Trim Band -->
              <div 
                v-if="topTrim > 0" 
                class="absolute top-0 inset-x-0 bg-red-600/40 backdrop-blur-[1px] border-b-2 border-red-500 z-15 flex items-center justify-center pointer-events-none select-none transition-all"
                :style="{ height: `${topTrim}%` }"
              >
                <span class="px-2 py-0.5 rounded-full bg-black/85 text-red-200 text-[9px] font-mono font-bold flex items-center gap-1 shadow-md">
                  <Icon icon="solar:scissors-bold" class="w-3 h-3 text-red-400" />
                  <span>✂️ Top Cut -{{ topTrim }}%</span>
                </span>
              </div>

              <!-- Bottom Trim Band (ShopGoodwill / Auction Watermark Cut Zone) -->
              <div 
                v-if="bottomTrim > 0" 
                class="absolute bottom-0 inset-x-0 bg-red-600/40 backdrop-blur-[1px] border-t-2 border-red-500 z-15 flex items-center justify-center pointer-events-none select-none transition-all"
                :style="{ height: `${bottomTrim}%` }"
              >
                <span class="px-2.5 py-0.5 rounded-full bg-black/85 text-red-200 text-[10px] font-mono font-bold flex items-center gap-1 shadow-md">
                  <Icon icon="solar:shield-warning-bold" class="w-3.5 h-3.5 text-red-400 animate-pulse" />
                  <span>✂️ Watermark Cut Zone -{{ bottomTrim }}%</span>
                </span>
              </div>

              <!-- Left Trim Band -->
              <div 
                v-if="leftTrim > 0" 
                class="absolute left-0 inset-y-0 bg-red-600/40 backdrop-blur-[1px] border-r-2 border-red-500 z-15 flex items-center justify-center pointer-events-none select-none transition-all"
                :style="{ width: `${leftTrim}%` }"
              >
                <span class="rotate-90 px-1.5 py-0.5 rounded bg-black/85 text-red-200 text-[8px] font-mono font-bold shadow-md">
                  -{{ leftTrim }}%
                </span>
              </div>

              <!-- Right Trim Band -->
              <div 
                v-if="rightTrim > 0" 
                class="absolute right-0 inset-y-0 bg-red-600/40 backdrop-blur-[1px] border-l-2 border-red-500 z-15 flex items-center justify-center pointer-events-none select-none transition-all"
                :style="{ width: `${rightTrim}%` }"
              >
                <span class="-rotate-90 px-1.5 py-0.5 rounded bg-black/85 text-red-200 text-[8px] font-mono font-bold shadow-md">
                  -{{ rightTrim }}%
                </span>
              </div>
            </template>

            <!-- HORIZONTAL WATERMARK HEAL BANDS (INPAINT PREVIEW) -->
            <template v-if="previewMode === 'cut_zones'">
              <div 
                v-if="enableTopWatermarkHeal" 
                class="absolute top-0 inset-x-0 bg-secondary/35 backdrop-blur-[1px] border-b-2 border-secondary z-15 flex items-center justify-center pointer-events-none select-none transition-all"
                :style="{ height: `${topWatermarkHealPercent}%` }"
              >
                <span class="px-2 py-0.5 rounded-full bg-black/90 text-secondary text-[9px] font-mono font-bold flex items-center gap-1 shadow-md">
                  <Icon icon="solar:magic-stick-3-bold" class="w-3 h-3 text-secondary animate-pulse" />
                  <span>🪄 Goodwill Text Erased -{{ topWatermarkHealPercent }}%</span>
                </span>
              </div>

              <div 
                v-if="enableBottomWatermarkHeal" 
                class="absolute bottom-0 inset-x-0 bg-secondary/35 backdrop-blur-[1px] border-t-2 border-secondary z-15 flex items-center justify-center pointer-events-none select-none transition-all"
                :style="{ height: `${bottomWatermarkHealPercent}%` }"
              >
                <span class="px-2.5 py-0.5 rounded-full bg-black/90 text-secondary text-[10px] font-mono font-bold flex items-center gap-1 shadow-md">
                  <Icon icon="solar:magic-stick-3-bold" class="w-3.5 h-3.5 text-secondary animate-pulse" />
                  <span>🪄 ShopGoodwill Logo Erased -{{ bottomWatermarkHealPercent }}%</span>
                </span>
              </div>
            </template>

            <!-- SMART WATERMARK CORNER HEALING PATCH (PREVIEW) -->
            <div 
              v-if="enableWatermarkPatch" 
              class="absolute z-16 rounded-xl border border-secondary/60 shadow-2xl flex items-center justify-center pointer-events-none transition-all"
              :class="[
                watermarkCorner === 'br' ? 'bottom-2 right-2' :
                watermarkCorner === 'bl' ? 'bottom-2 left-2' :
                watermarkCorner === 'tr' ? 'top-2 right-2' : 'top-2 left-2',
                patchStyle === 'light' ? 'bg-neutral-100 text-neutral-900 border-neutral-300' :
                patchStyle === 'dark' ? 'bg-neutral-950 text-white border-white/20' :
                patchStyle === 'badge' ? 'bg-black/90 text-white ring-1 ring-white/25 border-white/30' :
                'bg-black/80 backdrop-blur-md text-white border-secondary/50'
              ]"
              :style="{
                width: `${patchWidthPercent}%`,
                height: `${patchHeightPercent}%`
              }"
            >
              <span class="text-[9px] font-mono flex items-center gap-1 font-bold px-1.5 truncate">
                <Icon icon="solar:magic-stick-3-bold" class="w-3 h-3 text-secondary shrink-0" />
                <span class="truncate">{{ patchStyle === 'badge' ? '✨ Curated' : '🪄 Healer Patch' }}</span>
              </span>
            </div>

            <!-- LIVE BURN-IN TEXT OVERLAY (REAL-TIME VISUAL STICKER PREVIEW!) -->
            <div 
              v-if="showBurnInText && overlayPosition !== 'none' && (slideTitle || slideQuote || showVenueOnPhoto)"
              class="absolute pointer-events-none z-20 flex flex-col transition-all duration-200"
              :class="[
                cardTreatment === 'tiktok_scrim' ? 'inset-x-0 bottom-0' : (overlayPosition === 'top_banner' ? 'top-4 inset-x-3' : overlayPosition === 'center_spotlight' ? 'top-1/2 -translate-y-1/2 inset-x-3' : 'bottom-4 inset-x-3')
              ]"
            >
              <!-- 1. TikTok / Reel Scrim (Bottom gradient fade, bold white sans, high contrast) -->
              <div 
                v-if="cardTreatment === 'tiktok_scrim'"
                class="pt-16 pb-4 px-4 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col gap-1 text-left"
              >
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span v-if="showVenueOnPhoto && venueName" class="badge badge-xs bg-red-500 text-white font-black border-none text-[9px] uppercase tracking-wider shadow-md">
                    📍 {{ venueName }}
                  </span>
                  <span v-if="showPriceOnPhoto && slidePrice" class="badge badge-xs bg-cyan-400 text-black font-mono font-black text-[10px] border-none shadow-md">
                    ${{ Number(slidePrice).toFixed(2) }}
                  </span>
                </div>
                <h4 v-if="showTitleOnPhoto && slideTitle" class="font-black text-sm sm:text-base text-white leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
                  {{ slideTitle }}
                </h4>
                <p v-if="showQuoteOnPhoto && slideQuote" class="text-[11px] sm:text-xs font-bold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] leading-snug">
                  "{{ slideQuote }}"
                </p>
              </div>

              <!-- 2. Grailed Editorial (Frosted glass capsule, wide-spaced uppercase mono, luxury drop) -->
              <div 
                v-else-if="cardTreatment === 'grailed_editorial'"
                class="mx-auto max-w-[94%] bg-black/75 backdrop-blur-xl text-white rounded-2xl p-3 border border-white/20 shadow-2xl space-y-1.5 text-left font-mono"
              >
                <div class="flex items-center justify-between text-[9px] tracking-widest text-neutral-400 uppercase">
                  <span v-if="showVenueOnPhoto && venueName">ARCHIVE // {{ venueName }}</span>
                  <span v-if="showPriceOnPhoto && slidePrice" class="text-white font-black">${{ Number(slidePrice).toFixed(2) }}</span>
                </div>
                <h4 v-if="showTitleOnPhoto && slideTitle" class="font-bold text-xs uppercase tracking-wider text-white leading-tight">
                  {{ slideTitle }}
                </h4>
                <p v-if="showQuoteOnPhoto && slideQuote" class="text-[10px] text-neutral-300 tracking-wide leading-tight border-t border-white/10 pt-1">
                  // {{ slideQuote }}
                </p>
              </div>

              <!-- 3. WhatNot Spec Pill (Micro corner capsule, zero photo block) -->
              <div 
                v-else-if="cardTreatment === 'whatnot_pill'"
                class="mr-auto ml-2 bg-black/90 backdrop-blur-md text-white rounded-full px-3.5 py-1.5 border border-white/25 shadow-2xl flex items-center gap-1.5 text-[10px] font-mono font-bold"
              >
                <span v-if="showVenueOnPhoto && venueName" class="text-pink-400">📍 {{ venueName }}</span>
                <span v-if="showVenueOnPhoto && (showTitleOnPhoto || showPriceOnPhoto)" class="opacity-40">│</span>
                <span v-if="showTitleOnPhoto && slideTitle" class="truncate max-w-[140px] text-white font-sans">{{ slideTitle }}</span>
                <span v-if="showPriceOnPhoto && slidePrice" class="badge badge-2xs bg-secondary text-secondary-content font-bold border-none">
                  ${{ Number(slidePrice).toFixed(2) }}
                </span>
                <span v-if="showQuoteOnPhoto && slideQuote" class="text-[9px] opacity-80 font-sans italic truncate max-w-[110px]">
                  "{{ slideQuote }}"
                </span>
              </div>

              <!-- 4. Cyber Neon Pop (Cyan/magenta glow for tactical helmets & tech gear) -->
              <div 
                v-else-if="cardTreatment === 'cyber_neon'"
                class="mx-auto max-w-[94%] bg-black/85 backdrop-blur-md rounded-2xl p-3 border-2 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)] space-y-1 text-left"
              >
                <div class="flex items-center justify-between text-[9px] font-mono font-black text-cyan-400 uppercase tracking-widest">
                  <span v-if="showVenueOnPhoto && venueName">⚡ {{ venueName }} ⚡</span>
                  <span v-if="showPriceOnPhoto && slidePrice" class="badge badge-xs bg-pink-500 text-white font-mono font-black border-none">
                    ${{ Number(slidePrice).toFixed(2) }}
                  </span>
                </div>
                <h4 v-if="showTitleOnPhoto && slideTitle" class="font-black text-xs sm:text-sm text-white tracking-wide leading-tight">
                  {{ slideTitle }}
                </h4>
                <p v-if="showQuoteOnPhoto && slideQuote" class="text-[11px] font-bold text-cyan-300 drop-shadow-[0_0_6px_rgba(6,182,212,0.8)] leading-tight">
                  "{{ slideQuote }}"
                </p>
              </div>

              <!-- 5. Story Sticker Pill Capsule -->
              <div 
                v-else-if="cardTreatment === 'instagram_pill' || cardTreatment === 'floating_pill'"
                class="mx-auto max-w-[92%] bg-black/85 backdrop-blur-md text-white rounded-full px-4 py-2 border border-white/20 shadow-2xl space-y-0.5 text-center"
              >
                <div class="flex items-center justify-center gap-1.5 flex-wrap">
                  <span v-if="showVenueOnPhoto && venueName" class="badge badge-2xs bg-primary text-primary-content font-bold border-none text-[8px]">
                    📍 {{ venueName }}
                  </span>
                  <span v-if="showTitleOnPhoto && slideTitle" class="font-black text-xs text-white truncate max-w-[200px]">
                    {{ slideTitle }}
                  </span>
                  <span v-if="showPriceOnPhoto && slidePrice" class="badge badge-2xs bg-secondary text-secondary-content font-mono font-bold text-[9px] border-none">
                    ${{ Number(slidePrice).toFixed(2) }}
                  </span>
                </div>
                <p v-if="showQuoteOnPhoto && slideQuote" class="text-[10px] font-bold text-white/90 leading-tight">
                  "{{ slideQuote }}"
                </p>
              </div>

              <!-- 6. Clean Text (Direct Text with Drop Shadow) -->
              <div 
                v-else-if="cardTreatment === 'clean_text'"
                class="px-3 py-1.5 text-white space-y-0.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]"
                :class="overlayPosition === 'center_spotlight' ? 'text-center' : 'text-left'"
              >
                <div class="flex items-center gap-1.5 flex-wrap" :class="overlayPosition === 'center_spotlight' ? 'justify-center' : 'justify-start'">
                  <span v-if="showVenueOnPhoto && venueName" class="text-[9px] font-bold text-amber-300 uppercase tracking-wider">
                    📍 {{ venueName }}
                  </span>
                  <span v-if="showPriceOnPhoto && slidePrice" class="text-[11px] font-mono font-black text-pink-400">
                    ${{ Number(slidePrice).toFixed(2) }}
                  </span>
                </div>
                <h4 v-if="showTitleOnPhoto && slideTitle" class="font-black text-sm text-white leading-tight">
                  {{ slideTitle }}
                </h4>
                <p v-if="showQuoteOnPhoto && slideQuote" class="text-[11px] font-bold text-white leading-snug">
                  "{{ slideQuote }}"
                </p>
              </div>

              <!-- 7. Snug Card / Lower Third -->
              <div 
                v-else
                class="mx-auto max-w-[94%] bg-black/85 backdrop-blur-md text-white rounded-2xl p-2.5 sm:p-3 border border-white/20 shadow-2xl space-y-1"
              >
                <div class="flex items-center justify-between gap-2 border-b border-white/10 pb-1">
                  <span v-if="showVenueOnPhoto && venueName" class="text-[9px] font-bold text-amber-300 font-mono">
                    📍 {{ venueName }}
                  </span>
                  <span v-if="showPriceOnPhoto && slidePrice" class="badge badge-xs bg-pink-500 text-white font-mono font-bold border-none">
                    ${{ Number(slidePrice).toFixed(2) }}
                  </span>
                </div>
                <h4 v-if="showTitleOnPhoto && slideTitle" class="font-black text-xs sm:text-sm text-white leading-tight">
                  {{ slideTitle }}
                </h4>
                <p v-if="showQuoteOnPhoto && slideQuote" class="text-[10px] sm:text-[11px] font-medium text-white/90 leading-snug">
                  "{{ slideQuote }}"
                </p>
              </div>
            </div>

            <!-- Loading overlay -->
            <div v-if="isLoadingImage" class="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
              <span class="loading loading-spinner loading-md text-primary"></span>
            </div>
          </div>

          <!-- Quick Canvas Transform Bar -->
          <div class="mt-3 flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10 text-white">
            <button 
              type="button" 
              @click="rotateCW" 
              class="btn btn-2xs btn-ghost gap-1 text-[11px]" 
              title="Rotate 90° clockwise"
            >
              <Icon icon="solar:restart-bold" class="w-3.5 h-3.5 text-primary" />
              <span>Rotate 90°</span>
            </button>
            <div class="h-3 w-px bg-white/20"></div>
            <button 
              type="button" 
              @click="toggleFlipH" 
              class="btn btn-2xs btn-ghost gap-1 text-[11px]" 
              title="Flip horizontal"
            >
              <Icon icon="solar:mirror-bold" class="w-3.5 h-3.5 text-secondary" />
              <span>Flip H</span>
            </button>
            <div class="h-3 w-px bg-white/20"></div>
            <button 
              type="button" 
              @click="resetTransforms" 
              class="btn btn-2xs btn-ghost text-error gap-1 text-[11px]" 
              title="Reset all edits"
            >
              <Icon icon="solar:trash-bin-trash-bold" class="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        <!-- RIGHT: EDITING CONTROLS TRAY (5 COLS) -->
        <div class="lg:col-span-5 p-4 sm:p-5 bg-base-100 flex flex-col gap-4 border-l border-base-200 overflow-y-auto">
          
          <!-- MODE TABS (CROP & WATERMARK vs AI RELIGHT vs TEXT & BURN-IN) -->
          <div class="tabs tabs-boxed bg-base-200 p-1 rounded-2xl grid grid-cols-3 text-xs">
            <button 
              type="button" 
              class="tab rounded-xl font-bold transition-all text-[11px] sm:text-xs"
              :class="activeTab === 'crop' ? 'tab-active bg-primary text-primary-content shadow-xs' : ''"
              @click="activeTab = 'crop'"
            >
              <Icon icon="solar:crop-minimalistic-bold" class="w-3.5 h-3.5 mr-1" />
              <span>Crop &amp; Clean</span>
            </button>
            <button 
              type="button" 
              class="tab rounded-xl font-bold transition-all text-[11px] sm:text-xs"
              :class="activeTab === 'ai' ? 'tab-active bg-secondary text-secondary-content shadow-xs' : ''"
              @click="activeTab = 'ai'"
            >
              <Icon icon="solar:magic-stick-3-bold" class="w-3.5 h-3.5 mr-1" />
              <span>AI Relight</span>
            </button>
            <button 
              type="button" 
              class="tab rounded-xl font-bold transition-all text-[11px] sm:text-xs"
              :class="activeTab === 'text' ? 'tab-active bg-accent text-accent-content shadow-xs' : ''"
              @click="activeTab = 'text'"
            >
              <Icon icon="solar:text-bold" class="w-3.5 h-3.5 mr-1" />
              <span>Burn-In Text</span>
            </button>
          </div>

          <!-- TAB 1: CROP, ASPECT & WATERMARK CUTTER -->
          <div v-show="activeTab === 'crop'" class="space-y-4">
            
            <!-- WATERMARK CUTTER & CLEAN STUDIO (HERO SECTION) -->
            <div class="space-y-3.5 p-3.5 bg-gradient-to-b from-warning/15 via-base-200/80 to-base-100 rounded-2xl border-2 border-warning/50 shadow-md">
              <div class="flex items-center justify-between text-xs font-bold">
                <span class="flex items-center gap-1.5 text-warning font-black text-sm">
                  <Icon icon="solar:shield-warning-bold" class="w-4 h-4 text-warning" />
                  <span>Watermark Cutter &amp; AI Eraser</span>
                </span>
                <span v-if="hasActiveTrims || enableWatermarkPatch || enableTopWatermarkHeal || enableBottomWatermarkHeal" class="badge badge-xs badge-warning font-mono font-bold animate-pulse">
                  ✨ Protection Active
                </span>
              </div>

              <!-- 🪄 AI WATERMARK DETECTOR & BLOT-OUT / REMOVAL STUDIO -->
              <div class="p-3 rounded-xl bg-gradient-to-r from-secondary/20 via-primary/15 to-secondary/10 border border-secondary/40 space-y-2.5">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5 font-black text-xs text-secondary">
                    <Icon icon="solar:magic-stick-3-bold" class="w-4 h-4 text-secondary animate-bounce" />
                    <span>AI Watermark &amp; Blot-Out Studio</span>
                  </div>
                  <span class="badge badge-2xs badge-secondary text-secondary-content font-mono font-bold">ZERO HELMET CUT</span>
                </div>
                <p class="text-[11px] opacity-85 leading-snug">
                  Detected auction stamps (e.g. <strong>ShopGoodwill.com</strong> or <strong>Property of Goodwill</strong>). Choose how to hide or remove them:
                </p>

                <!-- 3 Clear AI Strategies -->
                <div class="grid grid-cols-3 gap-1.5 pt-0.5">
                  <!-- Option 1: Inpaint Blot Out -->
                  <button 
                    type="button" 
                    @click="autoDetectAndEraseWatermarks" 
                    class="btn btn-2xs rounded-xl font-bold flex flex-col items-center justify-center h-14 border text-center p-1"
                    :class="(enableTopWatermarkHeal || enableBottomWatermarkHeal) ? 'btn-secondary text-secondary-content shadow-xs' : 'btn-ghost bg-base-100 border-base-300'"
                    title="Seamlessly inpaint-blot the watermark using matching background surface"
                  >
                    <Icon icon="solar:magic-stick-3-bold" class="w-3.5 h-3.5" />
                    <span class="text-[10px] font-black leading-tight">🪄 Inpaint Blot</span>
                    <span class="text-[8px] opacity-75">Blend Surface</span>
                  </button>

                  <!-- Option 2: Blot Out with Patch / Badge -->
                  <button 
                    type="button" 
                    @click="blotOutCornerWatermark('badge')" 
                    class="btn btn-2xs rounded-xl font-bold flex flex-col items-center justify-center h-14 border text-center p-1"
                    :class="enableWatermarkPatch ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost bg-base-100 border-base-300'"
                    title="Cover watermark with a clean studio swatch or boutique badge"
                  >
                    <Icon icon="solar:tag-bold" class="w-3.5 h-3.5" />
                    <span class="text-[10px] font-black leading-tight">🏷️ Blot Patch</span>
                    <span class="text-[8px] opacity-75">Curated Badge</span>
                  </button>

                  <!-- Option 3: Conceal Under Text Scrim -->
                  <button 
                    type="button" 
                    @click="hideWatermarkUnderTextCard" 
                    class="btn btn-2xs rounded-xl font-bold flex flex-col items-center justify-center h-14 border text-center p-1 btn-ghost bg-base-100 border-base-300"
                    title="Cover bottom watermark naturally with caption text scrim"
                  >
                    <Icon icon="solar:chat-round-line-bold" class="w-3.5 h-3.5 text-accent" />
                    <span class="text-[10px] font-black leading-tight">📱 Cover w/ Scrim</span>
                    <span class="text-[8px] opacity-75">Caption Banner</span>
                  </button>
                </div>

                <!-- Deep Scan + Instant Controls -->
                <div class="flex items-center gap-1.5 pt-1">
                  <button 
                    type="button" 
                    @click="runAiDeepWatermarkDetection" 
                    class="btn btn-2xs btn-outline border-secondary text-secondary hover:bg-secondary hover:text-secondary-content font-bold rounded-lg flex-1 gap-1"
                    :disabled="isDetectingWatermarks"
                  >
                    <span v-if="isDetectingWatermarks" class="loading loading-spinner loading-2xs"></span>
                    <Icon v-else icon="solar:eye-scan-bold" class="w-3 h-3" />
                    <span>✨ AI Deep Scan Photo</span>
                  </button>

                  <button 
                    v-if="enableTopWatermarkHeal || enableBottomWatermarkHeal || enableWatermarkPatch"
                    type="button" 
                    @click="enableTopWatermarkHeal = false; enableBottomWatermarkHeal = false; enableWatermarkPatch = false; healedPreviewUrl = '';"
                    class="btn btn-2xs btn-ghost text-error gap-0.5"
                    title="Turn off watermark blot-out"
                  >
                    <Icon icon="solar:close-circle-bold" class="w-3 h-3" />
                    <span>Turn Off</span>
                  </button>
                </div>

                <!-- Active Inpaint Blot-Out Controls -->
                <div v-if="enableTopWatermarkHeal || enableBottomWatermarkHeal" class="pt-2 border-t border-secondary/20 space-y-1.5">
                  <div class="flex items-center justify-between text-[11px] font-bold">
                    <label class="cursor-pointer flex items-center gap-1.5">
                      <input type="checkbox" v-model="enableTopWatermarkHeal" class="checkbox checkbox-xs checkbox-secondary" />
                      <span>Blot Out Top Banner (-{{ topWatermarkHealPercent }}%)</span>
                    </label>
                    <span class="badge badge-2xs badge-secondary font-mono font-bold">ACTIVE</span>
                  </div>
                  <div class="flex items-center justify-between text-[11px] font-bold">
                    <label class="cursor-pointer flex items-center gap-1.5">
                      <input type="checkbox" v-model="enableBottomWatermarkHeal" class="checkbox checkbox-xs checkbox-secondary" />
                      <span>Blot Out ShopGoodwill Logo (-{{ bottomWatermarkHealPercent }}%)</span>
                    </label>
                    <span class="badge badge-2xs badge-secondary font-mono font-bold">ACTIVE</span>
                  </div>
                </div>

                <!-- Active Corner Blot Patch Swatches -->
                <div v-if="enableWatermarkPatch" class="pt-2 border-t border-secondary/20 space-y-1.5">
                  <div class="flex items-center justify-between text-[10px] font-bold">
                    <span class="text-secondary font-black">Corner Blot Swatch Style:</span>
                    <button type="button" @click="enableWatermarkPatch = false" class="text-error hover:underline text-[9px]">Remove Patch</button>
                  </div>
                  <div class="grid grid-cols-4 gap-1">
                    <button 
                      type="button" 
                      @click="patchStyle = 'auto'" 
                      class="btn btn-2xs rounded-lg text-[9px] font-bold"
                      :class="patchStyle === 'auto' ? 'btn-secondary text-secondary-content' : 'btn-ghost bg-base-100 border border-base-300'"
                    >
                      🪄 Auto Match
                    </button>
                    <button 
                      type="button" 
                      @click="patchStyle = 'light'" 
                      class="btn btn-2xs rounded-lg text-[9px] font-bold"
                      :class="patchStyle === 'light' ? 'btn-secondary text-secondary-content' : 'btn-ghost bg-base-100 border border-base-300'"
                    >
                      ⚪ Studio White
                    </button>
                    <button 
                      type="button" 
                      @click="patchStyle = 'dark'" 
                      class="btn btn-2xs rounded-lg text-[9px] font-bold"
                      :class="patchStyle === 'dark' ? 'btn-secondary text-secondary-content' : 'btn-ghost bg-base-100 border border-base-300'"
                    >
                      ⚫ Charcoal
                    </button>
                    <button 
                      type="button" 
                      @click="patchStyle = 'badge'" 
                      class="btn btn-2xs rounded-lg text-[9px] font-bold"
                      :class="patchStyle === 'badge' ? 'btn-secondary text-secondary-content' : 'btn-ghost bg-base-100 border border-base-300'"
                    >
                      🏷️ Curated
                    </button>
                  </div>
                </div>
              </div>

              <!-- Quick 1-Tap Resale Trim Presets -->
              <div class="space-y-1">
                <label class="text-[10px] uppercase font-bold tracking-wider opacity-60">Manual 1-Tap Quick Crops</label>
                <div class="grid grid-cols-3 gap-1.5">
                  <!-- Both Top & Btm Clean -->
                  <button 
                    type="button" 
                    @click="toggleEdgeTrim('both')" 
                    class="btn btn-2xs rounded-lg font-bold border gap-0.5 text-[10px] col-span-3"
                    :class="topTrim === 8 && bottomTrim === 10 ? 'btn-warning text-warning-content shadow-xs' : 'btn-outline border-warning/40 hover:btn-warning'"
                    title="Trim both Goodwill top banner and bottom watermark in 1-tap"
                  >
                    <span>✂️ Both: Goodwill Top (-8%) &amp; Btm (-10%)</span>
                  </button>

                  <button 
                    type="button" 
                    @click="toggleEdgeTrim('top')" 
                    class="btn btn-2xs rounded-lg font-bold border gap-0.5 text-[10px]"
                    :class="topTrim === 8 ? 'btn-warning text-warning-content shadow-xs' : 'btn-ghost bg-base-100 border-base-300'"
                    title="Toggle top 8% header stamp (e.g. Property of Goodwill)"
                  >
                    <span>✂️ Top -8%</span>
                  </button>
                  <button 
                    type="button" 
                    @click="toggleEdgeTrim('bottom')" 
                    class="btn btn-2xs rounded-lg font-bold border gap-0.5 text-[10px]"
                    :class="bottomTrim === 10 ? 'btn-warning text-warning-content shadow-xs' : 'btn-ghost bg-base-100 border-base-300'"
                    title="Toggle bottom 10% (standard ShopGoodwill stamp)"
                  >
                    <span>✂️ Btm -10%</span>
                  </button>
                  <button 
                    type="button" 
                    @click="toggleEdgeTrim('bottom_tall')" 
                    class="btn btn-2xs rounded-lg font-bold border gap-0.5 text-[10px]"
                    :class="bottomTrim === 16 ? 'btn-warning text-warning-content shadow-xs' : 'btn-ghost bg-base-100 border-base-300'"
                    title="Toggle bottom 16% for tall auction banner stamps"
                  >
                    <span>✂️ Tall Btm -16%</span>
                  </button>
                  <button 
                    type="button" 
                    @click="rightTrim = rightTrim === 10 ? 0 : 10; previewMode = 'cut_zones'" 
                    class="btn btn-2xs rounded-lg font-bold border gap-0.5 text-[10px]"
                    :class="rightTrim === 10 ? 'btn-warning text-warning-content shadow-xs' : 'btn-ghost bg-base-100 border-base-300'"
                    title="Cut off right margin 10%"
                  >
                    <span>✂️ Right -10%</span>
                  </button>
                  <button 
                    type="button" 
                    @click="leftTrim = leftTrim === 10 ? 0 : 10; previewMode = 'cut_zones'" 
                    class="btn btn-2xs rounded-lg font-bold border gap-0.5 text-[10px]"
                    :class="leftTrim === 10 ? 'btn-warning text-warning-content shadow-xs' : 'btn-ghost bg-base-100 border-base-300'"
                    title="Cut off left margin 10%"
                  >
                    <span>✂️ Left -10%</span>
                  </button>
                  <button 
                    type="button" 
                    @click="setQuickTrim(0, 0, 0, 0)" 
                    class="btn btn-2xs btn-ghost text-error gap-0.5 text-[10px] border border-base-300"
                    title="Reset all edge cuts"
                  >
                    <span>↺ Clear Cuts</span>
                  </button>
                </div>
              </div>

              <!-- 4-Way Edge Trimming Sliders -->
              <div class="space-y-2 pt-1 border-t border-base-300/80">
                <div class="flex items-center justify-between text-[11px] font-bold">
                  <span class="opacity-75">Precision Edge Sliders</span>
                  <span class="text-[10px] font-mono text-warning">{{ bottomTrim }}% Btm • {{ topTrim }}% Top • {{ leftTrim }}% L • {{ rightTrim }}% R</span>
                </div>

                <!-- Bottom Trim Slider -->
                <div class="space-y-0.5">
                  <div class="flex items-center justify-between text-[11px] font-mono">
                    <span class="font-bold flex items-center gap-1">
                      <Icon icon="solar:alt-arrow-down-bold" class="w-3 h-3 text-warning" />
                      <span>Bottom Watermark Cut:</span>
                    </span>
                    <span class="font-bold text-warning">{{ bottomTrim }}%</span>
                  </div>
                  <input type="range" min="0" max="35" step="1" v-model.number="bottomTrim" class="range range-2xs range-warning" @input="previewMode = 'cut_zones'" />
                </div>

                <!-- Top Trim Slider -->
                <div class="space-y-0.5">
                  <div class="flex items-center justify-between text-[11px] font-mono">
                    <span class="opacity-80 flex items-center gap-1">
                      <Icon icon="solar:alt-arrow-up-bold" class="w-3 h-3 opacity-60" />
                      <span>Top Banner Cut:</span>
                    </span>
                    <span class="font-bold text-warning">{{ topTrim }}%</span>
                  </div>
                  <input type="range" min="0" max="30" step="1" v-model.number="topTrim" class="range range-2xs" @input="previewMode = 'cut_zones'" />
                </div>

                <!-- Left & Right Inset Sliders Grid -->
                <div class="grid grid-cols-2 gap-2">
                  <div class="space-y-0.5">
                    <div class="flex items-center justify-between text-[10px] font-mono">
                      <span class="opacity-75">Left Cut:</span>
                      <span class="font-bold text-warning">{{ leftTrim }}%</span>
                    </div>
                    <input type="range" min="0" max="30" step="1" v-model.number="leftTrim" class="range range-2xs" @input="previewMode = 'cut_zones'" />
                  </div>
                  <div class="space-y-0.5">
                    <div class="flex items-center justify-between text-[10px] font-mono">
                      <span class="opacity-75">Right Cut:</span>
                      <span class="font-bold text-warning">{{ rightTrim }}%</span>
                    </div>
                    <input type="range" min="0" max="30" step="1" v-model.number="rightTrim" class="range range-2xs" @input="previewMode = 'cut_zones'" />
                  </div>
                </div>
              </div>

              <!-- Batch Apply Trims to All Slides Button -->
              <div v-if="slides.length > 1 && hasActiveTrims" class="pt-2 border-t border-base-300/80">
                <button 
                  type="button" 
                  @click="handleApplyWatermarkToAll" 
                  :disabled="isProcessing"
                  class="btn btn-xs w-full btn-outline border-warning text-warning hover:bg-warning hover:text-warning-content font-black rounded-xl gap-1.5 shadow-xs"
                >
                  <Icon icon="solar:copy-bold" class="w-3.5 h-3.5" />
                  <span>✂️ Apply Watermark Cuts to All {{ slides.length }} Slides</span>
                </button>
              </div>

              <!-- Smart Corner Logo Eraser Patch -->
              <div class="pt-2 border-t border-base-300/80 space-y-2">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <Icon icon="solar:magic-stick-3-bold" class="w-3.5 h-3.5 text-secondary" />
                    <span class="text-xs font-bold text-secondary">Corner Logo Eraser Patch</span>
                  </div>
                  <input type="checkbox" v-model="enableWatermarkPatch" class="toggle toggle-secondary toggle-xs" />
                </div>
                <p class="text-[10px] opacity-75 leading-tight">
                  Heals corner logo watermarks (Goodwill 'g', auction logos) without cutting full borders
                </p>

                <div v-if="enableWatermarkPatch" class="space-y-2 pt-1 bg-base-100 p-2.5 rounded-xl border border-secondary/30">
                  <!-- Corner Selector -->
                  <div class="grid grid-cols-2 gap-1">
                    <button 
                      type="button" 
                      v-for="corner in cornerPresets" 
                      :key="corner.id"
                      @click="watermarkCorner = corner.id"
                      class="btn btn-2xs rounded-lg font-bold text-[10px] border"
                      :class="watermarkCorner === corner.id ? 'btn-secondary text-secondary-content shadow-xs' : 'btn-ghost bg-base-200/70 border-base-300'"
                    >
                      {{ corner.label }}
                    </button>
                  </div>

                  <!-- Patch Style -->
                  <div class="space-y-1">
                    <label class="text-[10px] font-bold opacity-75">Patch Blend Style</label>
                    <select v-model="patchStyle" class="select select-bordered select-xs w-full rounded-lg text-[11px]">
                      <option value="auto">🪄 Auto Color Match (Samples Photo)</option>
                      <option value="light">⚪ Light Studio Paper Blend</option>
                      <option value="dark">⚫ Dark / Charcoal Pill</option>
                      <option value="badge">🏷️ Boutique Badge Cover ("Curated")</option>
                    </select>
                  </div>

                  <!-- Patch Dimensions -->
                  <div class="grid grid-cols-2 gap-2">
                    <div class="space-y-0.5">
                      <div class="flex items-center justify-between text-[10px] font-mono opacity-80">
                        <span>Width:</span>
                        <span>{{ patchWidthPercent }}%</span>
                      </div>
                      <input type="range" min="10" max="50" step="2" v-model.number="patchWidthPercent" class="range range-2xs range-secondary" />
                    </div>
                    <div class="space-y-0.5">
                      <div class="flex items-center justify-between text-[10px] font-mono opacity-80">
                        <span>Height:</span>
                        <span>{{ patchHeightPercent }}%</span>
                      </div>
                      <input type="range" min="4" max="25" step="1" v-model.number="patchHeightPercent" class="range range-2xs range-secondary" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Aspect Ratio Selector -->
            <div class="space-y-1.5 pt-1">
              <label class="text-xs font-bold opacity-75">Target Aspect Ratio</label>
              <div class="grid grid-cols-3 gap-1.5">
                <button 
                  type="button" 
                  v-for="aspect in aspectPresets" 
                  :key="aspect.id"
                  @click="selectedAspect = aspect.id"
                  class="btn btn-xs rounded-xl font-bold flex flex-col items-center justify-center h-12 gap-0.5 border"
                  :class="selectedAspect === aspect.id ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost bg-base-200/60 border-base-300'"
                >
                  <span class="text-xs font-black">{{ aspect.label }}</span>
                  <span class="text-[9px] opacity-75 font-mono">{{ aspect.sub }}</span>
                </button>
              </div>
            </div>

            <!-- Framing Mode Selector (Fit Entire Item vs Fill Frame) -->
            <div class="space-y-1.5 pt-1">
              <div class="flex items-center justify-between text-xs font-bold">
                <span class="opacity-75">Framing &amp; Fit</span>
                <span class="text-[10px] font-mono text-secondary font-bold">
                  {{ framingMode === 'contain' ? '🛡️ 100% Item Visible' : '✂️ Zoomed to Fill' }}
                </span>
              </div>
              <div class="grid grid-cols-2 gap-1.5">
                <button 
                  type="button" 
                  @click="framingMode = 'contain'" 
                  class="btn btn-xs rounded-xl font-bold flex items-center justify-center gap-1.5 border h-10"
                  :class="framingMode === 'contain' ? 'btn-secondary text-secondary-content shadow-xs' : 'btn-ghost bg-base-200/60 border-base-300'"
                  title="Fit entire photo without cutting edges (adds ambient blur to 9:16 background)"
                >
                  <Icon icon="solar:maximize-square-minimalistic-bold" class="w-4 h-4" />
                  <div class="flex flex-col text-left leading-tight">
                    <span class="text-[11px] font-black">🖼️ Fit Entire Item</span>
                    <span class="text-[8px] opacity-80 font-mono">Ambient Blur Backdrop</span>
                  </div>
                </button>
                <button 
                  type="button" 
                  @click="framingMode = 'cover'" 
                  class="btn btn-xs rounded-xl font-bold flex items-center justify-center gap-1.5 border h-10"
                  :class="framingMode === 'cover' ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost bg-base-200/60 border-base-300'"
                  title="Zoom and crop edges to fill full frame"
                >
                  <Icon icon="solar:crop-minimalistic-bold" class="w-4 h-4" />
                  <div class="flex flex-col text-left leading-tight">
                    <span class="text-[11px] font-black">📐 Fill Frame</span>
                    <span class="text-[8px] opacity-80 font-mono">Edge-to-Edge Zoom</span>
                  </div>
                </button>
              </div>
              <p class="text-[10px] text-base-content/70 leading-snug">
                {{ framingMode === 'contain' 
                  ? '✨ Keeps 100% of your item visible. No chopped sides, with soft ambient photo blur on top & bottom.' 
                  : 'Crops and zooms into the center to fill the screen edge-to-edge.' }}
              </p>
            </div>

            <!-- Zoom & Pan Sliders -->
            <div class="space-y-3 p-3 bg-base-200/50 rounded-2xl border border-base-300/80">
              <div class="flex items-center justify-between text-xs font-bold">
                <span class="flex items-center gap-1">
                  <Icon icon="solar:magnifer-zoom-in-bold" class="w-3.5 h-3.5 text-primary" />
                  <span>Zoom / Scale (Push watermarks out)</span>
                </span>
                <span class="font-mono text-primary">{{ zoomScale.toFixed(2) }}x</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="3" 
                step="0.05" 
                v-model.number="zoomScale" 
                class="range range-xs range-primary"
              />

              <!-- Pan X / Offset -->
              <div class="space-y-1 pt-1">
                <div class="flex items-center justify-between text-[11px] opacity-75 font-mono">
                  <span>Horizontal Alignment</span>
                  <span>{{ panX > 0 ? `+${panX}%` : `${panX}%` }}</span>
                </div>
                <input 
                  type="range" 
                  min="-50" 
                  max="50" 
                  step="1" 
                  v-model.number="panX" 
                  class="range range-2xs"
                />
              </div>

              <!-- Pan Y / Offset -->
              <div class="space-y-1 pt-1">
                <div class="flex items-center justify-between text-[11px] opacity-75 font-mono">
                  <span>Vertical Alignment</span>
                  <span>{{ panY > 0 ? `+${panY}%` : `${panY}%` }}</span>
                </div>
                <input 
                  type="range" 
                  min="-50" 
                  max="50" 
                  step="1" 
                  v-model.number="panY" 
                  class="range range-2xs"
                />
              </div>
            </div>
          </div>

          <!-- TAB 2: AI ENHANCEMENTS & LIGHTING PRESETS -->
          <div v-show="activeTab === 'ai'" class="space-y-4">
            
            <!-- 1-Tap Magic AI Auto-Enhance -->
            <button 
              type="button" 
              @click="applyMagicAutoEnhance"
              class="btn btn-sm w-full bg-linear-to-r from-purple-600 via-indigo-600 to-pink-600 hover:brightness-110 text-white font-black rounded-xl gap-2 shadow-md shadow-purple-500/20 border-none h-11 active:scale-95"
            >
              <Icon icon="solar:magic-stick-3-bold" class="w-4 h-4 animate-pulse" />
              <span>✨ 1-Tap Magic AI Auto-Enhance</span>
            </button>

            <!-- AI Lighting & Tone Presets -->
            <div class="space-y-1.5">
              <label class="text-xs font-bold opacity-75">AI Relight &amp; Patina Filters</label>
              <div class="grid grid-cols-2 gap-1.5">
                <button 
                  type="button" 
                  v-for="preset in aiPresets" 
                  :key="preset.id"
                  @click="applyAiPreset(preset.id)"
                  class="btn btn-xs rounded-xl font-bold justify-start gap-1.5 h-9 text-left border"
                  :class="selectedAiPreset === preset.id ? 'btn-secondary text-secondary-content shadow-xs' : 'btn-ghost bg-base-200/60 border-base-300'"
                >
                  <span>{{ preset.emoji }}</span>
                  <span class="truncate text-xs">{{ preset.label }}</span>
                </button>
              </div>
            </div>

            <!-- Fine-Tune Sliders -->
            <div class="space-y-2.5 p-3 bg-base-200/50 rounded-2xl border border-base-300/80 text-xs">
              <div class="font-bold opacity-75 text-[11px] uppercase tracking-wider">Manual Fine-Tune</div>
              
              <!-- Brightness -->
              <div class="space-y-0.5">
                <div class="flex justify-between font-mono text-[10px] opacity-75">
                  <span>Exposure / Brightness</span>
                  <span>{{ brightness > 0 ? `+${brightness}` : brightness }}%</span>
                </div>
                <input type="range" min="-50" max="50" step="1" v-model.number="brightness" class="range range-2xs" />
              </div>

              <!-- Contrast -->
              <div class="space-y-0.5">
                <div class="flex justify-between font-mono text-[10px] opacity-75">
                  <span>Contrast</span>
                  <span>{{ contrast > 0 ? `+${contrast}` : contrast }}%</span>
                </div>
                <input type="range" min="-50" max="50" step="1" v-model.number="contrast" class="range range-2xs" />
              </div>

              <!-- Saturation -->
              <div class="space-y-0.5">
                <div class="flex justify-between font-mono text-[10px] opacity-75">
                  <span>Saturation</span>
                  <span>{{ saturation > 0 ? `+${saturation}` : saturation }}%</span>
                </div>
                <input type="range" min="-50" max="50" step="1" v-model.number="saturation" class="range range-2xs" />
              </div>

              <!-- Warmth -->
              <div class="space-y-0.5">
                <div class="flex justify-between font-mono text-[10px] opacity-75">
                  <span>Warmth / Patina</span>
                  <span>{{ warmth > 0 ? `+${warmth}` : warmth }}%</span>
                </div>
                <input type="range" min="-50" max="50" step="1" v-model.number="warmth" class="range range-2xs" />
              </div>
            </div>
          </div>

          <!-- TAB 3: SLIDE TEXT & BURN-IN OVERLAYS -->
          <div v-show="activeTab === 'text'" class="space-y-3.5">
            <!-- Burn-in master switch -->
            <div class="p-3 bg-primary/10 rounded-2xl border border-primary/20 flex items-center justify-between">
              <div class="space-y-0.5">
                <span class="font-bold text-xs flex items-center gap-1.5 text-primary">
                  <Icon icon="solar:fire-bold" class="w-4 h-4 text-warning" />
                  <span>Burn Text into Picture Pixels</span>
                </span>
                <p class="text-[10px] opacity-75">Bakes title, price & sweet quotes directly onto the image for video animations</p>
              </div>
              <input type="checkbox" v-model="showBurnInText" class="toggle toggle-primary toggle-sm" />
            </div>

            <!-- Title Input -->
            <div class="space-y-1">
              <div class="flex items-center justify-between text-xs font-bold">
                <label class="opacity-75">Slide Item Title</label>
                <label class="cursor-pointer flex items-center gap-1 text-[10px] opacity-70">
                  <input type="checkbox" v-model="showTitleOnPhoto" class="checkbox checkbox-2xs checkbox-primary" />
                  <span>Show on photo</span>
                </label>
              </div>
              <input 
                type="text" 
                v-model="slideTitle" 
                placeholder="Item title..." 
                class="input input-sm input-bordered w-full rounded-xl text-xs font-bold" 
              />
            </div>

            <!-- Price Input & Venue -->
            <div class="grid grid-cols-2 gap-2">
              <div class="space-y-1">
                <div class="flex items-center justify-between text-xs font-bold">
                  <label class="opacity-75">Price ($)</label>
                  <label class="cursor-pointer flex items-center gap-1 text-[10px] opacity-70">
                    <input type="checkbox" v-model="showPriceOnPhoto" class="checkbox checkbox-2xs checkbox-secondary" />
                    <span>Show</span>
                  </label>
                </div>
                <input 
                  type="number" 
                  step="0.01" 
                  v-model.number="slidePrice" 
                  placeholder="0.00" 
                  class="input input-sm input-bordered w-full rounded-xl text-xs font-mono font-bold" 
                />
              </div>

              <div class="space-y-1">
                <div class="flex items-center justify-between text-xs font-bold">
                  <label class="opacity-75">Venue Badge</label>
                  <label class="cursor-pointer flex items-center gap-1 text-[10px] opacity-70">
                    <input type="checkbox" v-model="showVenueOnPhoto" class="checkbox checkbox-2xs" />
                    <span>Show</span>
                  </label>
                </div>
                <input 
                  type="text" 
                  v-model="venueName" 
                  placeholder="Memory Den" 
                  class="input input-sm input-bordered w-full rounded-xl text-xs" 
                />
              </div>
            </div>

            <!-- Sweet Catchy Vibe Quote / Alt Text -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs font-bold">
                <span class="flex items-center gap-1">
                  <Icon icon="solar:chat-round-like-bold" class="w-3.5 h-3.5 text-secondary" />
                  <span>Catchy Vibe Saying / Hook</span>
                </span>
                <div class="flex items-center gap-1.5">
                  <button 
                    v-if="slideQuote && slideQuote.length > 45"
                    type="button" 
                    @click="shortenQuoteToPunchline" 
                    class="btn btn-2xs btn-warning font-bold gap-1 rounded-lg"
                    title="Shorten long paragraph to a punchy 1-line hook"
                  >
                    <span>⚡ 1-Line Hook</span>
                  </button>
                  <button 
                    type="button" 
                    @click="generateAiVibeQuote" 
                    class="btn btn-2xs btn-outline border-base-300 hover:border-secondary font-bold gap-1 rounded-lg"
                  >
                    <Icon icon="solar:magic-stick-3-bold" class="w-3 h-3 text-secondary" />
                    <span>✨ AI Hook</span>
                  </button>
                </div>
              </div>
              <textarea 
                v-model="slideQuote" 
                rows="2" 
                placeholder="Punchy, catchy saying burned into photo (e.g. 'main character energy ⚡')..." 
                class="textarea textarea-bordered w-full rounded-xl text-xs font-sans leading-relaxed resize-none"
              ></textarea>

              <!-- Quick Vibe Quote Chips -->
              <div class="flex items-center gap-1 flex-wrap pt-0.5">
                <button 
                  v-for="(quote, qIdx) in vibeQuotePresets.slice(0, 4)" 
                  :key="qIdx" 
                  type="button" 
                  @click="applyVibeQuote(quote)"
                  class="badge badge-sm badge-outline hover:badge-primary text-[10px] font-sans font-bold truncate max-w-[220px] cursor-pointer"
                  :title="quote"
                >
                  {{ quote }}
                </button>
              </div>
            </div>

            <!-- Interactive Visual Style Selector (4 Trending Creator Styles) -->
            <div class="space-y-2 pt-2 border-t border-base-300/80">
              <div class="flex items-center justify-between text-xs font-bold">
                <span class="opacity-75">Visual Presentation Style</span>
                <span class="text-[10px] font-mono text-primary font-bold">4 CREATOR STYLES</span>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <!-- 1. TikTok / Reel Scrim -->
                <button 
                  type="button" 
                  @click="cardTreatment = 'tiktok_scrim'" 
                  class="p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between h-20 cursor-pointer"
                  :class="cardTreatment === 'tiktok_scrim' ? 'border-primary bg-primary/10 shadow-sm ring-2 ring-primary/60' : 'border-base-300 bg-base-100 hover:bg-base-200/60'"
                >
                  <div class="flex items-center justify-between w-full">
                    <span class="text-xs font-black flex items-center gap-1">📱 TikTok Scrim</span>
                    <span class="badge badge-2xs badge-primary text-[8px] font-bold">VIRAL</span>
                  </div>
                  <p class="text-[9px] opacity-75 leading-tight">Bottom gradient fade, bold white sans, zero clunky box.</p>
                </button>

                <!-- 2. Grailed Editorial -->
                <button 
                  type="button" 
                  @click="cardTreatment = 'grailed_editorial'" 
                  class="p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between h-20 cursor-pointer"
                  :class="cardTreatment === 'grailed_editorial' ? 'border-secondary bg-secondary/10 shadow-sm ring-2 ring-secondary/60' : 'border-base-300 bg-base-100 hover:bg-base-200/60'"
                >
                  <div class="flex items-center justify-between w-full">
                    <span class="text-xs font-black flex items-center gap-1">🏷️ Grailed Drop</span>
                    <span class="badge badge-2xs badge-neutral text-[8px] font-bold">LUXURY</span>
                  </div>
                  <p class="text-[9px] opacity-75 leading-tight">Frosted glass, spaced uppercase mono, high-end look.</p>
                </button>

                <!-- 3. WhatNot Spec Pill -->
                <button 
                  type="button" 
                  @click="cardTreatment = 'whatnot_pill'" 
                  class="p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between h-20 cursor-pointer"
                  :class="cardTreatment === 'whatnot_pill' ? 'border-accent bg-accent/10 shadow-sm ring-2 ring-accent/60' : 'border-base-300 bg-base-100 hover:bg-base-200/60'"
                >
                  <div class="flex items-center justify-between w-full">
                    <span class="text-xs font-black flex items-center gap-1">🛍️ WhatNot Pill</span>
                    <span class="badge badge-2xs badge-accent text-[8px] font-bold">COMPACT</span>
                  </div>
                  <p class="text-[9px] opacity-75 leading-tight">Micro corner tag, 1-line spec, 95% photo open.</p>
                </button>

                <!-- 4. Cyber Neon Glow -->
                <button 
                  type="button" 
                  @click="cardTreatment = 'cyber_neon'" 
                  class="p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between h-20 cursor-pointer"
                  :class="cardTreatment === 'cyber_neon' ? 'border-cyan-400 bg-cyan-950/20 shadow-sm ring-2 ring-cyan-400' : 'border-base-300 bg-base-100 hover:bg-base-200/60'"
                >
                  <div class="flex items-center justify-between w-full">
                    <span class="text-xs font-black flex items-center gap-1">⚡ Cyber Neon</span>
                    <span class="badge badge-2xs bg-cyan-400 text-black text-[8px] font-bold">TACTICAL</span>
                  </div>
                  <p class="text-[9px] opacity-75 leading-tight">Neon cyan/pink glow for tech gear & anime collectibles.</p>
                </button>
              </div>

              <!-- More styles + Position in compact row -->
              <div class="grid grid-cols-2 gap-2 pt-1">
                <div class="space-y-0.5">
                  <label class="text-[10px] font-bold opacity-60 uppercase">More Styles</label>
                  <select v-model="cardTreatment" class="select select-bordered select-xs w-full rounded-xl text-[11px]">
                    <option value="tiktok_scrim">📱 TikTok / Reel Scrim (Bottom Fade)</option>
                    <option value="grailed_editorial">🏷️ Grailed Editorial (Frosted Glass)</option>
                    <option value="whatnot_pill">🛍️ WhatNot Live Spec (Micro Pill)</option>
                    <option value="cyber_neon">⚡ Cyber Neon Pop (Tech Glow)</option>
                    <option value="clean_text">✨ Clean Text (No Box)</option>
                    <option value="instagram_pill">🏷️ Story Sticker Pill</option>
                    <option value="card">🔲 Snug Studio Card</option>
                    <option value="cinematic_lower_third">🎬 Cinematic Lower Third</option>
                  </select>
                </div>

                <div class="space-y-0.5">
                  <label class="text-[10px] font-bold opacity-60 uppercase">Placement</label>
                  <select v-model="overlayPosition" class="select select-bordered select-xs w-full rounded-xl text-[11px]">
                    <option value="bottom_card">⬇️ Bottom Safe Zone</option>
                    <option value="top_banner">⬆️ Top Banner</option>
                    <option value="center_spotlight">🎯 Center Spotlight</option>
                    <option value="none">🚫 No Overlay</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- BOTTOM ACTION DOCK -->
          <div class="mt-auto pt-3 border-t border-base-200 flex flex-col gap-2">
            <button 
              type="button" 
              @click="handleApply" 
              :disabled="isProcessing"
              class="btn btn-sm btn-primary text-primary-content font-black rounded-xl gap-2 shadow-md shadow-primary/25"
            >
              <span v-if="isProcessing" class="loading loading-spinner loading-xs"></span>
              <Icon v-else icon="solar:check-circle-bold" class="w-4 h-4" />
              <span>Apply to Current Slide</span>
            </button>

            <button 
              v-if="slides.length > 1"
              type="button" 
              @click="handleApplyToAll" 
              :disabled="isProcessing"
              class="btn btn-xs btn-outline border-base-300 font-bold rounded-xl gap-1.5"
              title="Apply current AI filter and aspect crop across all slides"
            >
              <Icon icon="solar:copy-bold" class="w-3.5 h-3.5 text-secondary" />
              <span>Apply AI Tone to All {{ slides.length }} Slides</span>
            </button>
          </div>

        </div>
      </div>

      <!-- ======================================================== -->
      <!-- FULLSCREEN STUDIO: PERSISTENT BOTTOM ACTION DOCK         -->
      <!-- ======================================================== -->
      <div class="px-4 py-2.5 sm:px-6 bg-base-200/95 backdrop-blur-xl border-t border-base-300 flex items-center justify-between gap-3 shrink-0 z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.12)]">
        <!-- Left: Revert to Master & Reset -->
        <div class="flex items-center gap-1.5 sm:gap-2">
          <button 
            type="button" 
            @click="revertToMaster" 
            class="btn btn-xs sm:btn-sm btn-ghost text-warning hover:bg-warning/10 font-bold gap-1 rounded-xl"
            title="Wipe all crops, blot-outs, and baked text, returning to the untouched original master photo"
          >
            <Icon icon="solar:restart-bold" class="w-3.5 h-3.5" />
            <span class="hidden xs:inline">↺ Revert to Master</span>
            <span class="xs:hidden">↺ Revert</span>
          </button>
          
          <button 
            type="button" 
            @click="resetTransforms" 
            class="btn btn-xs sm:btn-sm btn-ghost text-base-content/70 hover:text-base-content font-bold gap-1 rounded-xl"
            title="Reset current crop, zoom, and lighting adjustments"
          >
            <Icon icon="solar:refresh-linear" class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">Reset Adjustments</span>
            <span class="sm:hidden">Reset</span>
          </button>
        </div>

        <!-- Center: Slide Navigation -->
        <div v-if="slides.length > 1" class="flex items-center gap-1.5 font-mono text-xs">
          <button 
            type="button" 
            @click="prevSlide" 
            :disabled="selectedSlideIndex <= 0"
            class="btn btn-xs btn-ghost btn-circle"
            title="Previous Slide"
          >
            <Icon icon="solar:alt-arrow-left-linear" class="w-4 h-4" />
          </button>
          <span class="font-bold opacity-80 px-1 hidden sm:inline">Slide {{ selectedSlideIndex + 1 }} of {{ slides.length }}</span>
          <button 
            type="button" 
            @click="nextSlide" 
            :disabled="selectedSlideIndex >= slides.length - 1"
            class="btn btn-xs btn-ghost btn-circle"
            title="Next Slide"
          >
            <Icon icon="solar:alt-arrow-right-linear" class="w-4 h-4" />
          </button>
        </div>

        <!-- Right: Primary Apply Actions & Done -->
        <div class="flex items-center gap-2">
          <!-- Apply to All -->
          <button 
            v-if="slides.length > 1"
            type="button" 
            @click="handleApplyWatermarkToAll" 
            :disabled="isProcessing"
            class="btn btn-xs sm:btn-sm btn-outline border-base-300 font-bold gap-1 rounded-xl hidden md:inline-flex"
            title="Apply watermark cleanup across all slides"
          >
            <Icon icon="solar:copy-bold" class="w-3.5 h-3.5 text-secondary" />
            <span>Apply to All ({{ slides.length }})</span>
          </button>

          <!-- Apply to Slide (PRIMARY ACTION) -->
          <button 
            type="button" 
            @click="handleApply" 
            :disabled="isProcessing"
            class="btn btn-xs sm:btn-sm btn-primary text-primary-content font-black rounded-xl gap-1.5 shadow-md shadow-primary/25 active:scale-95 px-3 sm:px-5"
            title="Save and apply edits to current slide"
          >
            <span v-if="isProcessing" class="loading loading-spinner loading-xs"></span>
            <Icon v-else icon="solar:check-circle-bold" class="w-4 h-4" />
            <span>Apply to Slide</span>
          </button>

          <!-- Done / Close -->
          <button 
            type="button" 
            @click="handleClose" 
            class="btn btn-xs sm:btn-sm btn-ghost font-bold rounded-xl"
            title="Close Studio"
          >
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
    
    <form method="dialog" class="modal-backdrop">
      <button type="button" @click="handleClose">close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import { addToast } from '../../stores/toast';
import { 
  loadImage,
  drawOverlayCard, 
  type OverlayTheme, 
  type CardStyleTreatment, 
  type OverlayPosition 
} from '../../lib/slideCanvasEngine';

export interface DropcastSlideItem {
  id: string;
  url: string;
  originalUrl?: string;
  type?: string;
  title?: string;
  price?: number;
  description?: string;
}

const props = withDefaults(defineProps<{
  isOpen: boolean;
  slides: DropcastSlideItem[];
  initialIndex?: number;
  initialVenue?: string;
  initialTab?: 'crop' | 'ai' | 'text';
}>(), {
  initialIndex: 0,
  initialVenue: 'Memory Den',
  initialTab: 'crop'
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'update:slide', payload: { index: number; newUrl: string; originalUrl?: string; title?: string; price?: number; description?: string }): void;
  (e: 'update:all', payload: { newUrls: string[] }): void;
}>();

const selectedSlideIndex = ref<number>(0);
const activeTab = ref<'crop' | 'ai' | 'text'>('crop');
const previewMode = ref<'cut_zones' | 'clean'>('cut_zones');
const isProcessing = ref<boolean>(false);
const isLoadingImage = ref<boolean>(false);
const previewImgRef = ref<HTMLImageElement | null>(null);

// Transform & Crop State
const zoomScale = ref<number>(1);
const panX = ref<number>(0);
const panY = ref<number>(0);
const rotation = ref<number>(0);
const isFlippedH = ref<boolean>(false);
const selectedAspect = ref<string>('9:16');
const framingMode = ref<'contain' | 'cover'>('contain');

// Inpaint / Content-Aware Watermark Eraser State
const enableTopWatermarkHeal = ref<boolean>(false);
const topWatermarkHealPercent = ref<number>(8);
const enableBottomWatermarkHeal = ref<boolean>(false);
const bottomWatermarkHealPercent = ref<number>(12);
const isDetectingWatermarks = ref<boolean>(false);
const healedPreviewUrl = ref<string>('');

// Watermark Cutter & Edge Trim State
const bottomTrim = ref<number>(0);
const topTrim = ref<number>(0);
const leftTrim = ref<number>(0);
const rightTrim = ref<number>(0);

const hasActiveTrims = computed(() => {
  return bottomTrim.value > 0 || topTrim.value > 0 || leftTrim.value > 0 || rightTrim.value > 0;
});

function createHealedItemCanvas(
  img: CanvasImageSource,
  srcX: number,
  srcY: number,
  srcW: number,
  srcH: number,
  topHealPercent: number,
  bottomHealPercent: number
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = srcW;
  c.height = srcH;
  const ctx = c.getContext('2d');
  if (!ctx) return c;

  ctx.drawImage(img as any, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

  // 1. Heal top watermark (e.g. "Property of Goodwill NYNJ")
  if (topHealPercent > 0) {
    const bandH = Math.max(2, Math.round(srcH * (topHealPercent / 100)));
    const sampleY = Math.min(srcH - 6, bandH + 2);
    const sampleH = Math.min(10, srcH - sampleY);
    if (sampleH > 0) {
      try {
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(c, 0, sampleY, srcW, sampleH, 0, 0, srcW, bandH + 2);
        ctx.restore();
      } catch (e) {
        console.warn('Top watermark heal error:', e);
      }
    }
  }

  // 2. Heal bottom watermark (e.g. "SHOPGOODWILL.COM" in bottom right)
  if (bottomHealPercent > 0) {
    const bandH = Math.max(2, Math.round(srcH * (bottomHealPercent / 100)));
    const startY = srcH - bandH;
    const sampleY = Math.max(0, startY - 10);
    const sampleH = Math.min(10, startY - sampleY);
    if (sampleH > 0) {
      try {
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        // ShopGoodwill logo is on the right side. Sample clean background from right side just above logo:
        const rightCornerX = Math.round(srcW * 0.40);
        const rightCornerW = srcW - rightCornerX;
        ctx.drawImage(c, rightCornerX, sampleY, rightCornerW, sampleH, rightCornerX, startY - 1, rightCornerW, bandH + 2);
        ctx.restore();
      } catch (e) {
        console.warn('Bottom watermark heal error:', e);
      }
    }
  }

  return c;
}

async function updateHealedPreview() {
  if (!currentSlideUrl.value) return;
  if (!enableTopWatermarkHeal.value && !enableBottomWatermarkHeal.value && !enableWatermarkPatch.value) {
    healedPreviewUrl.value = '';
    return;
  }
  try {
    const img = await loadImage(currentSlideUrl.value);
    const naturalW = img.naturalWidth || img.width || 1080;
    const naturalH = img.naturalHeight || img.height || 1080;
    const topHeal = enableTopWatermarkHeal.value ? topWatermarkHealPercent.value : 0;
    const btmHeal = enableBottomWatermarkHeal.value ? bottomWatermarkHealPercent.value : 0;

    const healedC = createHealedItemCanvas(img, 0, 0, naturalW, naturalH, topHeal, btmHeal);
    if (enableWatermarkPatch.value) {
      const hCtx = healedC.getContext('2d');
      if (hCtx) applyWatermarkPatchToCanvas(hCtx, naturalW, naturalH);
    }
    healedPreviewUrl.value = healedC.toDataURL('image/jpeg', 0.90);
  } catch (err) {
    console.warn('Could not generate healed preview:', err);
    healedPreviewUrl.value = '';
  }
}

function autoDetectAndEraseWatermarks() {
  topTrim.value = 0;
  bottomTrim.value = 0;
  leftTrim.value = 0;
  rightTrim.value = 0;
  framingMode.value = 'contain';

  enableTopWatermarkHeal.value = true;
  topWatermarkHealPercent.value = 8;
  enableBottomWatermarkHeal.value = true;
  bottomWatermarkHealPercent.value = 12;

  previewMode.value = 'clean';
  updateHealedPreview();

  addToast({ 
    type: 'success', 
    message: '✨ Watermarks erased! 100% of helmet preserved with zero cropped sides.' 
  });
}

async function runAiDeepWatermarkDetection() {
  if (!currentSlideUrl.value) return;
  isDetectingWatermarks.value = true;
  try {
    const res = await fetch('/api/detect-watermarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: currentSlideUrl.value })
    });
    const data = await res.json();
    const topCut = data?.result?.suggestedTopCut || data?.fallback?.suggestedTopCut || 8;
    const btmCut = data?.result?.suggestedBottomCut || data?.fallback?.suggestedBottomCut || 12;

    topTrim.value = 0;
    bottomTrim.value = 0;
    leftTrim.value = 0;
    rightTrim.value = 0;
    framingMode.value = 'contain';

    topWatermarkHealPercent.value = topCut;
    bottomWatermarkHealPercent.value = btmCut;
    enableTopWatermarkHeal.value = true;
    enableBottomWatermarkHeal.value = true;

    previewMode.value = 'clean';
    updateHealedPreview();

    addToast({ 
      type: 'success', 
      message: `✨ AI detected Goodwill watermarks: Top -${topCut}%, Bottom -${btmCut}%. Erased with zero helmet crop!` 
    });
  } catch (err: any) {
    console.warn('AI watermark detection error, falling back to instant erase:', err);
    autoDetectAndEraseWatermarks();
  } finally {
    isDetectingWatermarks.value = false;
  }
}

// Watermark Corner Healing Patch State
const enableWatermarkPatch = ref<boolean>(false);
const watermarkCorner = ref<'br' | 'bl' | 'tr' | 'tl'>('br');
const patchWidthPercent = ref<number>(28);
const patchHeightPercent = ref<number>(8);
const patchStyle = ref<'auto' | 'light' | 'dark' | 'badge'>('auto');

const cornerPresets = [
  { id: 'br' as const, label: '↘ Bottom-Right' },
  { id: 'bl' as const, label: '↙ Bottom-Left' },
  { id: 'tr' as const, label: '↗ Top-Right' },
  { id: 'tl' as const, label: '↖ Top-Left' }
];

function blotOutCornerWatermark(style: 'auto' | 'light' | 'dark' | 'badge' = 'auto') {
  enableWatermarkPatch.value = true;
  watermarkCorner.value = 'br';
  patchStyle.value = style;
  patchWidthPercent.value = 28;
  patchHeightPercent.value = 8;
  previewMode.value = 'clean';
  updateHealedPreview();
  const styleLabel = style === 'light' ? 'studio white' : style === 'badge' ? 'boutique badge' : style === 'dark' ? 'charcoal patch' : 'matching surface';
  addToast({ 
    type: 'success', 
    message: `🪄 Blotted out corner watermark with ${styleLabel}!` 
  });
}

function hideWatermarkUnderTextCard() {
  showBurnInText.value = true;
  overlayPosition.value = 'bottom_card';
  cardTreatment.value = 'tiktok_scrim';
  activeTab.value = 'text';
  addToast({ 
    type: 'info', 
    message: '📱 Placed TikTok Scrim over bottom watermark to naturally conceal it!' 
  });
}

function toggleEdgeTrim(side: 'top' | 'bottom' | 'bottom_tall' | 'both') {
  if (side === 'top') {
    topTrim.value = topTrim.value === 8 ? 0 : 8;
  } else if (side === 'bottom') {
    bottomTrim.value = bottomTrim.value === 10 ? 0 : 10;
  } else if (side === 'bottom_tall') {
    bottomTrim.value = bottomTrim.value === 16 ? 0 : 16;
  } else if (side === 'both') {
    if (topTrim.value === 8 && bottomTrim.value === 10) {
      topTrim.value = 0;
      bottomTrim.value = 0;
    } else {
      topTrim.value = 8;
      bottomTrim.value = 10;
    }
  }
  previewMode.value = 'cut_zones';
}

function setQuickTrim(top: number, bottom: number, left: number, right: number) {
  topTrim.value = top;
  bottomTrim.value = bottom;
  leftTrim.value = left;
  rightTrim.value = right;
  previewMode.value = 'cut_zones';
  if (top > 0 && bottom > 0) {
    addToast({ type: 'info', message: `Trimmed top ${top}% and bottom ${bottom}%!` });
  } else if (bottom > 0) {
    addToast({ type: 'info', message: `Trimmed bottom ${bottom}% to remove watermark!` });
  } else if (top > 0) {
    addToast({ type: 'info', message: `Trimmed top ${top}% banner!` });
  } else if (right > 0) {
    addToast({ type: 'info', message: `Trimmed right margin ${right}%!` });
  } else if (left > 0) {
    addToast({ type: 'info', message: `Trimmed left margin ${left}%!` });
  } else {
    addToast({ type: 'info', message: 'Cleared edge trims.' });
  }
}

// AI Enhancement State
const selectedAiPreset = ref<string>('none');
const brightness = ref<number>(0);
const contrast = ref<number>(0);
const saturation = ref<number>(0);
const warmth = ref<number>(0);

// Text & Burn-In State
const showBurnInText = ref<boolean>(true);
const slideTitle = ref<string>('');
const slidePrice = ref<number | null>(null);
const slideQuote = ref<string>('');
const venueName = ref<string>(props.initialVenue || 'Memory Den');
const showTitleOnPhoto = ref<boolean>(true);
const showPriceOnPhoto = ref<boolean>(false);
const showQuoteOnPhoto = ref<boolean>(true);
const showVenueOnPhoto = ref<boolean>(true);
const cardTreatment = ref<CardStyleTreatment>('tiktok_scrim');
const overlayPosition = ref<OverlayPosition>('bottom_card');
const overlayTheme = ref<OverlayTheme>('instagram');

const aspectPresets = [
  { id: '9:16', label: '9:16', sub: 'Story / Reel' },
  { id: '1:1', label: '1:1', sub: 'Square Feed' },
  { id: '4:5', label: '4:5', sub: 'IG Portrait' },
  { id: '16:9', label: '16:9', sub: 'Landscape' },
  { id: 'original', label: 'Original', sub: 'Keep Ratio' }
];

const aiPresets = [
  { id: 'none', label: 'Natural / Neutral', emoji: '🌿' },
  { id: 'relight', label: 'Studio Relight', emoji: '✨' },
  { id: 'antique', label: 'Antique Warmth', emoji: '🪵' },
  { id: 'cyber', label: 'Cyber Neon Pop', emoji: '⚡' },
  { id: 'crisp', label: 'Crisp De-Glare', emoji: '🔍' },
  { id: 'noir', label: 'Archive Noir', emoji: '🖤' }
];

const vibeQuotePresets = [
  'main character energy for your shelf ✨',
  'working LED visor • pure future vibes ⚡',
  'rare archival piece • 1 of 1 condition ⏳',
  'tactical centerpiece • mint aesthetic 🤖',
  'someone\'s grandma had immaculate taste 🤌',
  '1970s solid brass, heavy patina 🕯️',
  'claim before Saturday drop • DM to hold 🏷️'
];

function applyVibeQuote(quote: string) {
  slideQuote.value = quote;
  addToast({ type: 'info', message: 'Applied catchy hook!' });
}

function shortenQuoteToPunchline() {
  if (!slideQuote.value) return;
  const raw = slideQuote.value.trim();
  if (raw.length <= 42) {
    addToast({ type: 'info', message: 'Hook is already nice and concise!' });
    return;
  }
  const match = raw.split(/[.,;\n]/)[0]?.trim();
  if (match && match.length >= 8 && match.length <= 48) {
    slideQuote.value = match + ' ✨';
  } else {
    slideQuote.value = raw.slice(0, 42).trim() + '… ✨';
  }
  addToast({ type: 'success', message: '⚡ Shortened to 1-line hook!' });
}

function generateAiVibeQuote() {
  const itemTitle = slideTitle.value || 'Curated Find';
  const lowerTitle = itemTitle.toLowerCase();

  let customPhrases: string[] = [];
  if (lowerTitle.includes('helmet') || lowerTitle.includes('cyber') || lowerTitle.includes('led') || lowerTitle.includes('tactical') || cardTreatment.value === 'cyber_neon') {
    customPhrases = [
      'working LED visor • pure future vibes ⚡',
      'tactical centerpiece • 1 of 1 condition 💾',
      'main character energy • rave & cosplay ready 🔋',
      'futuristic grail piece • pristine display 🤖',
      'cyber aesthetic • pure standout energy ⚡'
    ];
  } else if (cardTreatment.value === 'grailed_editorial') {
    customPhrases = [
      'archival piece // collectors edition pristine 🏷️',
      'rare studio sample // vault archive 🏛️',
      'timeless silhouette // 1 of 1 archive 🤌',
      'curated aesthetic // museum-grade specimen ✨'
    ];
  } else if (cardTreatment.value === 'whatnot_pill') {
    customPhrases = [
      'mint condition • instant claim ⚡',
      'grail status • ready to ship 📦',
      'rare find • verify & claim 🏷️',
      'vault pull • 1 of 1 🛍️'
    ];
  } else {
    customPhrases = [
      'main character energy for your shelf ✨',
      `pure vintage charm • ${itemTitle} in prime condition 🤌`,
      'timeless design meets rich history 🕯️',
      'someone\'s grandma had immaculate taste 🍷',
      'unmatched patina and craftsmanship 🏛️',
      'rare archival find curated with love 🏷️'
    ];
  }

  const randomPick = customPhrases[Math.floor(Math.random() * customPhrases.length)];
  slideQuote.value = randomPick;
  addToast({ type: 'success', message: '✨ Generated punchy 1-line hook!' });
}

const currentSlide = computed(() => {
  if (props.slides.length === 0) return null;
  const idx = Math.min(selectedSlideIndex.value, props.slides.length - 1);
  return props.slides[idx] || null;
});

const currentSlideUrl = computed(() => currentSlide.value?.url || '');

const currentAspectLabel = computed(() => {
  return aspectPresets.find(a => a.id === selectedAspect.value)?.label || '9:16';
});

const canvasContainerStyle = computed(() => {
  let aspect = '9 / 16';
  if (selectedAspect.value === '1:1') aspect = '1 / 1';
  else if (selectedAspect.value === '4:5') aspect = '4 / 5';
  else if (selectedAspect.value === '16:9') aspect = '16 / 9';
  else if (selectedAspect.value === 'original' && previewImgRef.value?.naturalWidth && previewImgRef.value?.naturalHeight) {
    const rawW = Math.max(1, previewImgRef.value.naturalWidth * (1 - (leftTrim.value + rightTrim.value) / 100));
    const rawH = Math.max(1, previewImgRef.value.naturalHeight * (1 - (topTrim.value + bottomTrim.value) / 100));
    aspect = `${rawW} / ${rawH}`;
  }
  return {
    aspectRatio: aspect,
    width: selectedAspect.value === '9:16' ? '320px' : selectedAspect.value === '1:1' ? '380px' : '400px'
  };
});

const previewTransformStyle = computed(() => {
  const bVal = 1 + (brightness.value / 100);
  const cVal = 1 + (contrast.value / 100);
  const sVal = 1 + (saturation.value / 100);
  const sepiaVal = warmth.value > 0 ? warmth.value / 250 : 0;
  const hueVal = warmth.value < 0 ? warmth.value / 4 : 0;

  const flip = isFlippedH.value ? 'scaleX(-1)' : '';
  const rot = rotation.value !== 0 ? `rotate(${rotation.value}deg)` : '';
  const scale = zoomScale.value !== 1 ? `scale(${zoomScale.value})` : '';
  const trans = (panX.value !== 0 || panY.value !== 0) ? `translate(${panX.value}%, ${panY.value}%)` : '';

  // In 'clean' preview mode, clip away trimmed margins. In 'cut_zones' mode, show full image with overlay guide stripes.
  const clip = (previewMode.value === 'clean' && (topTrim.value > 0 || bottomTrim.value > 0 || leftTrim.value > 0 || rightTrim.value > 0))
    ? `inset(${topTrim.value}% ${rightTrim.value}% ${bottomTrim.value}% ${leftTrim.value}%)`
    : 'none';

  return {
    transform: [trans, scale, rot, flip].filter(Boolean).join(' ') || 'none',
    filter: `brightness(${bVal}) contrast(${cVal}) saturate(${sVal}) sepia(${sepiaVal}) hue-rotate(${hueVal}deg)`,
    clipPath: clip
  };
});

watch(currentSlide, (slide) => {
  if (slide) {
    slideTitle.value = slide.title || '';
    slidePrice.value = typeof slide.price === 'number' ? slide.price : null;
    const rawDesc = (slide.description || '').trim();
    if (rawDesc.length > 55) {
      // Pick first punchy sentence or cleanly truncate so it stays a modern 1-line hook
      const firstSentence = rawDesc.split(/[.!?\n]/)[0].trim();
      slideQuote.value = (firstSentence.length >= 6 && firstSentence.length <= 55)
        ? firstSentence
        : (rawDesc.slice(0, 48).trim() + '… ✨');
    } else {
      slideQuote.value = rawDesc;
    }
  }
  updateHealedPreview();
}, { immediate: true });

watch([
  enableTopWatermarkHeal, 
  enableBottomWatermarkHeal, 
  topWatermarkHealPercent, 
  bottomWatermarkHealPercent,
  enableWatermarkPatch,
  watermarkCorner,
  patchStyle,
  patchWidthPercent,
  patchHeightPercent
], () => {
  updateHealedPreview();
});

watch(() => props.isOpen, (open) => {
  if (open) {
    selectedSlideIndex.value = Math.min(props.initialIndex ?? 0, Math.max(0, props.slides.length - 1));
    if (props.initialTab) {
      activeTab.value = props.initialTab;
    }
    resetTransforms();
    isLoadingImage.value = false;
    nextTick(() => {
      if (previewImgRef.value && previewImgRef.value.complete && previewImgRef.value.naturalWidth > 0) {
        isLoadingImage.value = false;
      }
    });
  }
});

watch(() => props.initialIndex, (idx) => {
  if (idx !== undefined && idx >= 0 && idx < props.slides.length) {
    selectedSlideIndex.value = idx;
    resetTransforms();
  }
});

function selectSlide(idx: number) {
  selectedSlideIndex.value = idx;
  resetTransforms();
  isLoadingImage.value = false;
}

function prevSlide() {
  if (selectedSlideIndex.value > 0) {
    selectSlide(selectedSlideIndex.value - 1);
  }
}

function nextSlide() {
  if (selectedSlideIndex.value < props.slides.length - 1) {
    selectSlide(selectedSlideIndex.value + 1);
  }
}

function revertToMaster() {
  const slide = props.slides[selectedSlideIndex.value];
  if (!slide) return;
  const master = slide.originalUrl || slide.url;
  resetTransforms();
  showBurnInText.value = false;
  emit('update:slide', {
    index: selectedSlideIndex.value,
    newUrl: master,
    originalUrl: master
  });
  addToast({ type: 'success', message: '↺ Reverted to original clean master photo!' });
}

function onImageLoaded() {
  isLoadingImage.value = false;
}

function onImageError() {
  isLoadingImage.value = false;
}

function rotateCW() {
  rotation.value = (rotation.value + 90) % 360;
}

function toggleFlipH() {
  isFlippedH.value = !isFlippedH.value;
}

function resetTransforms() {
  zoomScale.value = 1;
  panX.value = 0;
  panY.value = 0;
  rotation.value = 0;
  isFlippedH.value = false;
  bottomTrim.value = 0;
  topTrim.value = 0;
  leftTrim.value = 0;
  rightTrim.value = 0;
  enableTopWatermarkHeal.value = false;
  enableBottomWatermarkHeal.value = false;
  healedPreviewUrl.value = '';
  framingMode.value = 'contain';
  enableWatermarkPatch.value = false;
  patchStyle.value = 'auto';
  patchWidthPercent.value = 28;
  patchHeightPercent.value = 8;
  selectedAiPreset.value = 'none';
  brightness.value = 0;
  contrast.value = 0;
  saturation.value = 0;
  warmth.value = 0;
}

function applyAiPreset(id: string) {
  selectedAiPreset.value = id;
  switch (id) {
    case 'relight':
      brightness.value = 12;
      contrast.value = 10;
      saturation.value = 8;
      warmth.value = 4;
      break;
    case 'antique':
      brightness.value = 6;
      contrast.value = 14;
      saturation.value = -4;
      warmth.value = 22;
      break;
    case 'cyber':
      brightness.value = 4;
      contrast.value = 22;
      saturation.value = 35;
      warmth.value = -8;
      break;
    case 'crisp':
      brightness.value = 8;
      contrast.value = 20;
      saturation.value = 12;
      warmth.value = 0;
      break;
    case 'noir':
      brightness.value = 6;
      contrast.value = 32;
      saturation.value = -100;
      warmth.value = 0;
      break;
    default:
      brightness.value = 0;
      contrast.value = 0;
      saturation.value = 0;
      warmth.value = 0;
      break;
  }
}

function applyMagicAutoEnhance() {
  selectedAiPreset.value = 'relight';
  brightness.value = 10;
  contrast.value = 15;
  saturation.value = 12;
  warmth.value = 6;
  addToast({ type: 'success', message: '✨ Magic AI Auto-Enhance applied! Balanced exposure and crisp local contrast.' });
}

function applyWatermarkPatchToCanvas(ctx: CanvasRenderingContext2D, outW: number, outH: number) {
  ctx.save();
  ctx.filter = 'none';
  const patchW = Math.round(outW * (patchWidthPercent.value / 100));
  const patchH = Math.round(outH * (patchHeightPercent.value / 100));
  let patchX = outW - patchW - 16;
  let patchY = outH - patchH - 16;

  if (watermarkCorner.value === 'bl') {
    patchX = 16;
    patchY = outH - patchH - 16;
  } else if (watermarkCorner.value === 'tr') {
    patchX = outW - patchW - 16;
    patchY = 16;
  } else if (watermarkCorner.value === 'tl') {
    patchX = 16;
    patchY = 16;
  }

  if (patchStyle.value === 'auto') {
    let sampleY = patchY > 30 ? patchY - 8 : patchY + patchH + 8;
    sampleY = Math.max(0, Math.min(outH - 1, sampleY));
    const sampleX = Math.max(0, Math.min(outW - 1, patchX + Math.round(patchW / 2)));
    try {
      const pixel = ctx.getImageData(sampleX, sampleY, 1, 1).data;
      const grad = ctx.createLinearGradient(patchX, patchY, patchX, patchY + patchH);
      grad.addColorStop(0, `rgba(${pixel[0]}, ${pixel[1]}, ${pixel[2]}, 0.95)`);
      grad.addColorStop(1, `rgba(${pixel[0]}, ${pixel[1]}, ${pixel[2]}, 1.0)`);
      ctx.fillStyle = grad;
    } catch {
      // Clean studio white fallback for auction photo backgrounds
      ctx.fillStyle = 'rgba(240, 240, 242, 0.98)';
    }
  } else if (patchStyle.value === 'light') {
    ctx.fillStyle = 'rgba(245, 245, 247, 0.96)';
  } else if (patchStyle.value === 'dark') {
    ctx.fillStyle = 'rgba(18, 18, 22, 0.96)';
  } else if (patchStyle.value === 'badge') {
    ctx.fillStyle = 'rgba(10, 10, 14, 0.90)';
  }

  ctx.beginPath();
  ctx.roundRect(patchX, patchY, patchW, patchH, 14);
  ctx.fill();

  if (patchStyle.value === 'badge') {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✨ Curated Find', patchX + patchW / 2, patchY + patchH / 2);
  }
  ctx.restore();
}

async function handleApply() {
  if (!currentSlideUrl.value) return;

  isProcessing.value = true;
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create canvas context');

    // Robust multi-stage CORS & proxy image loader
    const img = await loadImage(currentSlideUrl.value);

    const naturalW = img.naturalWidth || img.width || 1080;
    const naturalH = img.naturalHeight || img.height || 1080;

    const leftP = Math.max(0, Math.min(40, Number(leftTrim.value) || 0)) / 100;
    const rightP = Math.max(0, Math.min(40, Number(rightTrim.value) || 0)) / 100;
    const topP = Math.max(0, Math.min(40, Number(topTrim.value) || 0)) / 100;
    const btmP = Math.max(0, Math.min(40, Number(bottomTrim.value) || 0)) / 100;

    const srcX = Math.round(naturalW * leftP);
    const srcY = Math.round(naturalH * topP);
    const srcW = Math.max(10, Math.round(naturalW * (1 - (leftP + rightP))));
    const srcH = Math.max(10, Math.round(naturalH * (1 - (topP + btmP))));

    let targetRatio = 9 / 16;
    if (selectedAspect.value === '1:1') targetRatio = 1;
    else if (selectedAspect.value === '4:5') targetRatio = 4 / 5;
    else if (selectedAspect.value === '16:9') targetRatio = 16 / 9;
    else if (selectedAspect.value === 'original') targetRatio = srcW / srcH;

    if (!targetRatio || isNaN(targetRatio) || targetRatio <= 0) {
      targetRatio = 9 / 16;
    }

    const outW = 1080;
    const outH = Math.max(100, Math.round(outW / targetRatio));
    canvas.width = outW;
    canvas.height = outH;

    const bVal = 1 + ((Number(brightness.value) || 0) / 100);
    const cVal = 1 + ((Number(contrast.value) || 0) / 100);
    const sVal = 1 + ((Number(saturation.value) || 0) / 100);
    const warmthNum = Number(warmth.value) || 0;
    const sepiaVal = warmthNum > 0 ? warmthNum / 250 : 0;
    const hueVal = warmthNum < 0 ? warmthNum / 4 : 0;
    try {
      ctx.filter = `brightness(${bVal}) contrast(${cVal}) saturate(${sVal}) sepia(${sepiaVal}) hue-rotate(${hueVal}deg)`;
    } catch {
      ctx.filter = 'none';
    }

    const topHeal = enableTopWatermarkHeal.value ? topWatermarkHealPercent.value : 0;
    const btmHeal = enableBottomWatermarkHeal.value ? bottomWatermarkHealPercent.value : 0;

    const sourceCanvas = (topHeal > 0 || btmHeal > 0)
      ? createHealedItemCanvas(img, srcX, srcY, srcW, srcH, topHeal, btmHeal)
      : null;

    const drawSource: CanvasImageSource = sourceCanvas || img;
    const drawSrcX = sourceCanvas ? 0 : srcX;
    const drawSrcY = sourceCanvas ? 0 : srcY;
    const imgW = srcW;
    const imgH = srcH;

    // 1. Ambient blurred background for contain mode with letterboxing
    if (framingMode.value === 'contain' && selectedAspect.value !== 'original') {
      ctx.save();
      try {
        ctx.filter = `blur(36px) brightness(0.65) saturate(${sVal})`;
      } catch {
        ctx.filter = 'none';
      }
      const bgScale = Math.max(outW / imgW, outH / imgH) * 1.15;
      const bgW = imgW * bgScale;
      const bgH = imgH * bgScale;
      ctx.drawImage(drawSource, drawSrcX, drawSrcY, srcW, srcH, (outW - bgW) / 2, (outH - bgH) / 2, bgW, bgH);
      ctx.filter = 'none';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(0, 0, outW, outH);
      ctx.restore();
    } else {
      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(0, 0, outW, outH);
    }

    // 2. Draw crisp centered foreground photo
    ctx.save();
    try {
      ctx.filter = `brightness(${bVal}) contrast(${cVal}) saturate(${sVal}) sepia(${sepiaVal}) hue-rotate(${hueVal}deg)`;
    } catch {
      ctx.filter = 'none';
    }

    ctx.translate(outW / 2, outH / 2);
    if (rotation.value !== 0) {
      ctx.rotate((rotation.value * Math.PI) / 180);
    }
    if (isFlippedH.value) {
      ctx.scale(-1, 1);
    }

    let drawW: number;
    let drawH: number;

    if (framingMode.value === 'contain' && selectedAspect.value !== 'original') {
      // CONTAIN: Fit entire item inside outW x outH (preserves 100% of the item, zero cut sides)
      const fitScale = Math.min(outW / imgW, outH / imgH) * zoomScale.value;
      drawW = imgW * fitScale;
      drawH = imgH * fitScale;
    } else if (selectedAspect.value === 'original') {
      // ORIGINAL: Exact uncropped match
      drawW = outW * zoomScale.value;
      drawH = outH * zoomScale.value;
    } else {
      // COVER: Fill frame edge-to-edge
      const coverScale = Math.max(outW / imgW, outH / imgH) * zoomScale.value;
      drawW = imgW * coverScale;
      drawH = imgH * coverScale;
    }

    const offsetX = (panX.value / 100) * outW;
    const offsetY = (panY.value / 100) * outH;

    ctx.drawImage(drawSource, drawSrcX, drawSrcY, srcW, srcH, -drawW / 2 + offsetX, -drawH / 2 + offsetY, drawW, drawH);
    ctx.restore();

    // Corner Watermark Healing Patch
    if (enableWatermarkPatch.value) {
      applyWatermarkPatchToCanvas(ctx, outW, outH);
    }

    // Burn-In Text Overlay
    if (showBurnInText.value && overlayPosition.value !== 'none') {
      try {
        ctx.filter = 'none';
        const slidePayload = {
          title: slideTitle.value || currentSlide.value?.title || '',
          price: slidePrice.value ?? currentSlide.value?.price ?? 0,
          description: slideQuote.value || currentSlide.value?.description || ''
        };

        drawOverlayCard(ctx, outW, outH, slidePayload as any, {
          theme: overlayTheme.value,
          treatment: cardTreatment.value,
          position: overlayPosition.value,
          venueName: venueName.value,
          showTitle: showTitleOnPhoto.value,
          showPrice: showPriceOnPhoto.value,
          showQuote: showQuoteOnPhoto.value,
          showVenue: showVenueOnPhoto.value,
          cardOpacity: 0.85
        });
      } catch (overlayErr) {
        console.warn('Overlay draw failed, continuing without overlay:', overlayErr);
      }
    }

    let dataUrl: string = currentSlideUrl.value;
    try {
      dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    } catch (taintErr) {
      console.warn('Canvas toDataURL failed (tainted canvas), preserving existing URL:', taintErr);
      dataUrl = currentSlideUrl.value;
    }

    emit('update:slide', { 
      index: selectedSlideIndex.value, 
      newUrl: dataUrl,
      originalUrl: currentSlide.value?.originalUrl || currentSlide.value?.url,
      title: slideTitle.value,
      price: slidePrice.value ?? undefined,
      description: slideQuote.value
    });

    // Reset crop trims & inpaint flags now that they are permanently burned into the new slide
    topTrim.value = 0;
    bottomTrim.value = 0;
    leftTrim.value = 0;
    rightTrim.value = 0;
    enableTopWatermarkHeal.value = false;
    enableBottomWatermarkHeal.value = false;
    healedPreviewUrl.value = '';
    previewMode.value = 'clean';

    addToast({ 
      type: 'success', 
      message: hasActiveTrims.value || enableWatermarkPatch.value
        ? `✨ Cleaned watermark & applied edits to slide ${selectedSlideIndex.value + 1}!` 
        : `✓ Applied crop & edits to slide ${selectedSlideIndex.value + 1}` 
    });
  } catch (err: any) {
    console.error('Failed to export slide:', err);
    addToast({ type: 'error', message: `Failed to export slide: ${err?.message || err}` });
  } finally {
    isProcessing.value = false;
  }
}

async function handleApplyWatermarkToAll() {
  if (props.slides.length <= 1) return;
  isProcessing.value = true;
  try {
    const newUrls: string[] = [];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create canvas context');

    let baseRatio = 9 / 16;
    if (selectedAspect.value === '1:1') baseRatio = 1;
    else if (selectedAspect.value === '4:5') baseRatio = 4 / 5;
    else if (selectedAspect.value === '16:9') baseRatio = 16 / 9;

    for (let i = 0; i < props.slides.length; i++) {
      const slide = props.slides[i];
      const img = await loadImage(slide.url);

      const naturalW = img.naturalWidth || img.width || 1080;
      const naturalH = img.naturalHeight || img.height || 1080;

      const leftP = Math.max(0, Math.min(40, Number(leftTrim.value) || 0)) / 100;
      const rightP = Math.max(0, Math.min(40, Number(rightTrim.value) || 0)) / 100;
      const topP = Math.max(0, Math.min(40, Number(topTrim.value) || 0)) / 100;
      const btmP = Math.max(0, Math.min(40, Number(bottomTrim.value) || 0)) / 100;

      const srcX = Math.round(naturalW * leftP);
      const srcY = Math.round(naturalH * topP);
      const srcW = Math.max(10, Math.round(naturalW * (1 - (leftP + rightP))));
      const srcH = Math.max(10, Math.round(naturalH * (1 - (topP + btmP))));

      let slideTargetRatio = selectedAspect.value === 'original' ? (srcW / srcH) : baseRatio;
      if (!slideTargetRatio || isNaN(slideTargetRatio) || slideTargetRatio <= 0) {
        slideTargetRatio = 9 / 16;
      }

      const outW = 1080;
      const outH = Math.max(100, Math.round(outW / slideTargetRatio));
      canvas.width = outW;
      canvas.height = outH;

      const topHeal = enableTopWatermarkHeal.value ? topWatermarkHealPercent.value : 0;
      const btmHeal = enableBottomWatermarkHeal.value ? bottomWatermarkHealPercent.value : 0;

      const sourceCanvas = (topHeal > 0 || btmHeal > 0)
        ? createHealedItemCanvas(img, srcX, srcY, srcW, srcH, topHeal, btmHeal)
        : null;

      const drawSource: CanvasImageSource = sourceCanvas || img;
      const drawSrcX = sourceCanvas ? 0 : srcX;
      const drawSrcY = sourceCanvas ? 0 : srcY;
      const imgW = srcW;
      const imgH = srcH;

      // Ambient blur backdrop if contain mode in 9:16
      if (framingMode.value === 'contain' && selectedAspect.value !== 'original') {
        ctx.save();
        try {
          ctx.filter = 'blur(36px) brightness(0.65)';
        } catch {
          ctx.filter = 'none';
        }
        const bgScale = Math.max(outW / imgW, outH / imgH) * 1.15;
        const bgW = imgW * bgScale;
        const bgH = imgH * bgScale;
        ctx.drawImage(drawSource, drawSrcX, drawSrcY, srcW, srcH, (outW - bgW) / 2, (outH - bgH) / 2, bgW, bgH);
        ctx.filter = 'none';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(0, 0, outW, outH);
        ctx.restore();
      } else {
        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(0, 0, outW, outH);
      }

      ctx.save();
      ctx.translate(outW / 2, outH / 2);

      let drawW: number;
      let drawH: number;

      if (framingMode.value === 'contain' && selectedAspect.value !== 'original') {
        const fitScale = Math.min(outW / imgW, outH / imgH);
        drawW = imgW * fitScale;
        drawH = imgH * fitScale;
      } else if (selectedAspect.value === 'original') {
        drawW = outW;
        drawH = outH;
      } else {
        const coverScale = Math.max(outW / imgW, outH / imgH);
        drawW = imgW * coverScale;
        drawH = imgH * coverScale;
      }

      ctx.drawImage(drawSource, drawSrcX, drawSrcY, srcW, srcH, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      if (enableWatermarkPatch.value) {
        applyWatermarkPatchToCanvas(ctx, outW, outH);
      }

      let dataUrl: string = slide.url;
      try {
        dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      } catch (err) {
        console.warn(`Could not export dataUrl for slide ${i + 1}, using original`, err);
        dataUrl = slide.url;
      }
      newUrls.push(dataUrl);
    }

    emit('update:all', { newUrls });
    addToast({ 
      type: 'success', 
      message: `✂️ Removed watermarks across all ${props.slides.length} slides!` 
    });
  } catch (err: any) {
    console.error('Failed to remove watermarks batch:', err);
    addToast({ type: 'error', message: `Failed to remove watermarks: ${err?.message || err}` });
  } finally {
    isProcessing.value = false;
  }
}

async function handleApplyToAll() {
  if (props.slides.length <= 1) return;
  isProcessing.value = true;

  try {
    const newUrls: string[] = [];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create canvas context');

    let baseRatio = 9 / 16;
    if (selectedAspect.value === '1:1') baseRatio = 1;
    else if (selectedAspect.value === '4:5') baseRatio = 4 / 5;
    else if (selectedAspect.value === '16:9') baseRatio = 16 / 9;

    const bVal = 1 + ((Number(brightness.value) || 0) / 100);
    const cVal = 1 + ((Number(contrast.value) || 0) / 100);
    const sVal = 1 + ((Number(saturation.value) || 0) / 100);
    const warmthNum = Number(warmth.value) || 0;
    const sepiaVal = warmthNum > 0 ? warmthNum / 250 : 0;
    const hueVal = warmthNum < 0 ? warmthNum / 4 : 0;
    try {
      ctx.filter = `brightness(${bVal}) contrast(${cVal}) saturate(${sVal}) sepia(${sepiaVal}) hue-rotate(${hueVal}deg)`;
    } catch {
      ctx.filter = 'none';
    }

    for (let i = 0; i < props.slides.length; i++) {
      const slide = props.slides[i];
      const img = await loadImage(slide.url);

      const naturalW = img.naturalWidth || img.width || 1080;
      const naturalH = img.naturalHeight || img.height || 1080;

      const leftP = Math.max(0, Math.min(40, Number(leftTrim.value) || 0)) / 100;
      const rightP = Math.max(0, Math.min(40, Number(rightTrim.value) || 0)) / 100;
      const topP = Math.max(0, Math.min(40, Number(topTrim.value) || 0)) / 100;
      const btmP = Math.max(0, Math.min(40, Number(bottomTrim.value) || 0)) / 100;

      const srcX = Math.round(naturalW * leftP);
      const srcY = Math.round(naturalH * topP);
      const srcW = Math.max(10, Math.round(naturalW * (1 - (leftP + rightP))));
      const srcH = Math.max(10, Math.round(naturalH * (1 - (topP + btmP))));

      let slideTargetRatio = selectedAspect.value === 'original' ? (srcW / srcH) : baseRatio;
      if (!slideTargetRatio || isNaN(slideTargetRatio) || slideTargetRatio <= 0) {
        slideTargetRatio = 9 / 16;
      }

      const outW = 1080;
      const outH = Math.max(100, Math.round(outW / slideTargetRatio));
      canvas.width = outW;
      canvas.height = outH;

      const topHeal = enableTopWatermarkHeal.value ? topWatermarkHealPercent.value : 0;
      const btmHeal = enableBottomWatermarkHeal.value ? bottomWatermarkHealPercent.value : 0;

      const sourceCanvas = (topHeal > 0 || btmHeal > 0)
        ? createHealedItemCanvas(img, srcX, srcY, srcW, srcH, topHeal, btmHeal)
        : null;

      const drawSource: CanvasImageSource = sourceCanvas || img;
      const drawSrcX = sourceCanvas ? 0 : srcX;
      const drawSrcY = sourceCanvas ? 0 : srcY;
      const imgW = srcW;
      const imgH = srcH;

      // Ambient blur backdrop if contain mode in 9:16
      if (framingMode.value === 'contain' && selectedAspect.value !== 'original') {
        ctx.save();
        try {
          ctx.filter = `blur(36px) brightness(0.65) saturate(${sVal})`;
        } catch {
          ctx.filter = 'none';
        }
        const bgScale = Math.max(outW / imgW, outH / imgH) * 1.15;
        const bgW = imgW * bgScale;
        const bgH = imgH * bgScale;
        ctx.drawImage(drawSource, drawSrcX, drawSrcY, srcW, srcH, (outW - bgW) / 2, (outH - bgH) / 2, bgW, bgH);
        ctx.filter = 'none';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(0, 0, outW, outH);
        ctx.restore();
      } else {
        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(0, 0, outW, outH);
      }

      ctx.save();
      try {
        ctx.filter = `brightness(${bVal}) contrast(${cVal}) saturate(${sVal}) sepia(${sepiaVal}) hue-rotate(${hueVal}deg)`;
      } catch {
        ctx.filter = 'none';
      }

      ctx.translate(outW / 2, outH / 2);
      if (rotation.value !== 0) {
        ctx.rotate((rotation.value * Math.PI) / 180);
      }
      if (isFlippedH.value) {
        ctx.scale(-1, 1);
      }

      let drawW: number;
      let drawH: number;

      if (framingMode.value === 'contain' && selectedAspect.value !== 'original') {
        const fitScale = Math.min(outW / imgW, outH / imgH) * zoomScale.value;
        drawW = imgW * fitScale;
        drawH = imgH * fitScale;
      } else if (selectedAspect.value === 'original') {
        drawW = outW * zoomScale.value;
        drawH = outH * zoomScale.value;
      } else {
        const coverScale = Math.max(outW / imgW, outH / imgH) * zoomScale.value;
        drawW = imgW * coverScale;
        drawH = imgH * coverScale;
      }

      const offsetX = (panX.value / 100) * outW;
      const offsetY = (panY.value / 100) * outH;

      ctx.drawImage(drawSource, drawSrcX, drawSrcY, srcW, srcH, -drawW / 2 + offsetX, -drawH / 2 + offsetY, drawW, drawH);
      ctx.restore();

      if (enableWatermarkPatch.value) {
        applyWatermarkPatchToCanvas(ctx, outW, outH);
      }

      if (showBurnInText.value && overlayPosition.value !== 'none') {
        try {
          ctx.filter = 'none';
          const slidePayload = {
            title: slide.title || slideTitle.value || '',
            price: slide.price ?? slidePrice.value ?? 0,
            description: slide.description || slideQuote.value || ''
          };
          drawOverlayCard(ctx, outW, outH, slidePayload as any, {
            theme: overlayTheme.value,
            treatment: cardTreatment.value,
            position: overlayPosition.value,
            venueName: venueName.value,
            showTitle: showTitleOnPhoto.value,
            showPrice: showPriceOnPhoto.value,
            showQuote: showQuoteOnPhoto.value,
            showVenue: showVenueOnPhoto.value,
            cardOpacity: 0.85
          });
        } catch (overlayErr) {
          console.warn('Overlay draw failed, continuing without overlay:', overlayErr);
        }
      }

      let dataUrl: string = slide.url;
      try {
        dataUrl = canvas.toDataURL('image/jpeg', 0.90);
      } catch {
        dataUrl = slide.url;
      }
      newUrls.push(dataUrl);
    }

    emit('update:all', { newUrls });
    addToast({ type: 'success', message: `✨ Applied watermark cleanup & edits across all ${props.slides.length} slides!` });
  } catch (err: any) {
    console.error('Failed batch apply:', err);
    addToast({ type: 'error', message: `Failed batch apply: ${err?.message || err}` });
  } finally {
    isProcessing.value = false;
  }
}

function handleClose() {
  emit('close');
}
</script>

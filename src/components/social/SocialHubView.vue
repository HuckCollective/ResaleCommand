<template>
  <div>
    <!-- VIEW 1: DROPCAST HUB (MASTER OVERVIEW) -->
    <DropcastHubDashboard 
      v-if="currentView === 'hub'" 
      @quick-restock="handleQuickRestockTrigger"
      @quick-grail="handleQuickGrailTrigger"
      @quick-haul="handleQuickHaulTrigger"
      @quick-sales="handleQuickSalesTrigger"
    />

    <!-- VIEW 2: DROPCAST STUDIO (DETAIL DRILL-DOWN) -->
    <div v-else-if="currentView === 'studio'" class="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 pb-36 sm:pb-44">
      
      <!-- STUDIO TOP BREADCRUMB, TITLE & STATUS BAR -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-base-100 p-4 sm:p-5 rounded-3xl border border-base-200 shadow-sm">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <!-- Back to Hub Button -->
          <button 
            type="button" 
            @click="handleReturnToHub"
            class="btn btn-sm btn-ghost border border-base-300 gap-1.5 font-black rounded-2xl hover:bg-base-200 transition-all text-xs shrink-0"
            title="Return to Dropcast Hub"
          >
            <Icon icon="solar:arrow-left-linear" class="w-4 h-4" />
            <span>Hub</span>
          </button>

          <div class="h-6 w-px bg-base-300 shrink-0"></div>

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <input 
                type="text" 
                v-model="studioCastTitle" 
                @blur="syncActiveCastState"
                @keyup.enter="($event.target as HTMLInputElement).blur()"
                class="font-black text-lg sm:text-xl text-base-content bg-transparent border-b border-transparent hover:border-base-300 focus:border-primary focus:outline-none px-1 py-0.5 flex-1 min-w-[140px] transition-all"
                placeholder="Cast Title..."
                title="Edit Cast Title"
              />
              <span v-if="activeCast" class="badge badge-sm font-mono font-bold shrink-0" :class="CAST_TYPE_META[activeCast.type]?.colorBadge || 'badge-neutral'">
                {{ CAST_TYPE_META[activeCast.type]?.emoji }} {{ CAST_TYPE_META[activeCast.type]?.label }}
              </span>
            </div>
            <div class="text-[11px] opacity-65 flex items-center gap-2 mt-0.5 truncate">
              <span class="font-bold text-secondary flex items-center gap-1">
                <Icon icon="solar:shop-2-bold" class="w-3 h-3" />
                <span>{{ currentTargetLocation }}</span>
              </span>
              <span>•</span>
              <span class="font-mono text-primary font-bold">{{ studioItems.length }} staged</span>
            </div>
          </div>
        </div>

        <!-- Right Side: Current Status Pill & Active/Paused Quick Toggle -->
        <div class="flex items-center gap-2 shrink-0">
          <!-- Quick Active / Paused Toggle Button -->
          <button
            type="button"
            @click="toggleStudioActivePause"
            class="btn btn-xs rounded-xl font-bold gap-1 transition-all"
            :class="activeCast?.status === 'draft' ? 'btn-warning text-warning-content' : 'btn-outline border-base-300 hover:border-warning'"
            :title="activeCast?.status === 'draft' ? 'This cast is ACTIVE: receiving staged items. Click to pause.' : 'This cast is PAUSED: staging locked. Click to activate.'"
          >
            <Icon :icon="activeCast?.status === 'draft' ? 'solar:play-circle-bold' : 'solar:pause-circle-bold'" class="w-3.5 h-3.5" />
            <span>{{ activeCast?.status === 'draft' ? 'Active' : 'Paused' }}</span>
          </button>

          <!-- Status Dropdown Pill -->
          <div class="dropdown dropdown-end">
            <button 
              tabindex="0" 
              type="button" 
              class="badge font-mono font-bold text-xs py-2 px-3 rounded-xl uppercase shadow-2xs cursor-pointer border-none transition-all active:scale-95"
              :class="activeCast?.status === 'broadcasted' ? 'badge-success text-success-content' : activeCast?.status === 'ready' ? 'badge-info text-info-content' : activeCast?.status === 'paused' ? 'badge-warning badge-outline' : 'badge-warning text-warning-content'"
              title="Current status (click to change)"
            >
              {{ activeCast?.status === 'broadcasted' ? '🟢 Cast' : activeCast?.status === 'ready' ? '🔵 Ready' : activeCast?.status === 'paused' ? '⏸️ Paused' : '🟡 Draft' }}
            </button>
            <ul tabindex="0" class="dropdown-content menu p-1.5 shadow-2xl bg-base-100 border border-base-300 rounded-2xl z-50 text-xs mt-1 w-36 space-y-1">
              <li>
                <button type="button" @click="setStudioStatus('draft')" class="font-bold py-1.5 px-2 rounded-xl" :class="{'active': activeCast?.status === 'draft'}">
                  🟡 Draft (Active)
                </button>
              </li>
              <li>
                <button type="button" @click="setStudioStatus('paused')" class="font-bold py-1.5 px-2 rounded-xl" :class="{'active': activeCast?.status === 'paused'}">
                  ⏸️ Paused
                </button>
              </li>
              <li>
                <button type="button" @click="setStudioStatus('ready')" class="font-bold py-1.5 px-2 rounded-xl" :class="{'active': activeCast?.status === 'ready'}">
                  🔵 Ready
                </button>
              </li>
              <li>
                <button type="button" @click="setStudioStatus('broadcasted')" class="font-bold py-1.5 px-2 rounded-xl" :class="{'active': activeCast?.status === 'broadcasted'}">
                  🟢 Cast
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

    <!-- ======================================================== -->
    <!-- SECTION 1: TOP SECTION (PHONE PREVIEW & AI COPYWRITER)  -->
    <!-- ======================================================== -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- LEFT: UNIFIED POST PREVIEW & MEDIA REEL STUDIO (5 cols) -->
      <div class="lg:col-span-5 space-y-3">
        <div class="card bg-base-100 border border-base-200 shadow-sm p-4 sm:p-5 rounded-3xl space-y-3">
          
          <!-- Header Bar: Clean Title & Direct Link to Fullscreen Studio -->
          <div class="flex items-center justify-between pb-2 border-b border-base-200">
            <div class="flex items-center gap-2 min-w-0">
              <div class="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black shrink-0">
                <Icon icon="solar:clapperboard-play-bold" class="w-4 h-4" />
              </div>
              <div class="min-w-0">
                <h3 class="font-black text-xs sm:text-sm text-base-content truncate flex items-center gap-1.5">
                  <span>Post Preview &amp; Reel</span>
                  <span class="badge badge-xs badge-primary font-mono font-bold">{{ postMediaList.length }} slides</span>
                </h3>
              </div>
            </div>

            <!-- Quick Triggers to Slide Editor & Watermark Cutter -->
            <div class="flex items-center gap-1.5">
              <button 
                type="button" 
                @click="openWatermarkEditor(activeCarouselIndex)" 
                class="btn btn-xs btn-warning text-warning-content font-bold rounded-xl gap-1 shadow-xs active:scale-95"
                title="Crop out or remove ShopGoodwill / auction watermarks"
              >
                <Icon icon="solar:shield-warning-bold" class="w-3.5 h-3.5" />
                <span>✂️ Watermarks</span>
              </button>
              <button 
                type="button" 
                @click="openImageEditor(activeCarouselIndex)" 
                class="btn btn-xs btn-primary text-primary-content font-bold rounded-xl gap-1 shadow-xs active:scale-95"
                title="Open Slide & Image Editor Tray to crop, rotate, and AI relight"
              >
                <Icon icon="solar:crop-minimalistic-bold" class="w-3.5 h-3.5" />
                <span>Slide Editor</span>
              </button>
            </div>
          </div>

          <!-- Picture Framing Toolbar: Aspect Ratio & Fit Mode -->
          <div class="flex items-center justify-between gap-2 px-1 text-xs">
            <!-- Aspect Ratio Selector (1:1 / 4:5 / 9:16) -->
            <div class="flex items-center gap-1 bg-base-200/80 p-0.5 rounded-xl border border-base-300">
              <button 
                type="button" 
                @click="previewAspectRatio = '1:1'"
                class="btn btn-2xs rounded-lg font-mono font-bold transition-all"
                :class="previewAspectRatio === '1:1' ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost opacity-70 hover:opacity-100'"
                title="1:1 Square (Instagram Feed Classic)"
              >
                1:1
              </button>
              <button 
                type="button" 
                @click="previewAspectRatio = '4:5'"
                class="btn btn-2xs rounded-lg font-mono font-bold transition-all"
                :class="previewAspectRatio === '4:5' ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost opacity-70 hover:opacity-100'"
                title="4:5 Portrait (Instagram Feed Standard)"
              >
                4:5
              </button>
              <button 
                type="button" 
                @click="previewAspectRatio = '9:16'"
                class="btn btn-2xs rounded-lg font-mono font-bold transition-all"
                :class="previewAspectRatio === '9:16' ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost opacity-70 hover:opacity-100'"
                title="9:16 Story / Reel"
              >
                9:16
              </button>
            </div>

            <div class="flex items-center gap-1.5">
              <!-- Watermark Cutter & Crop Button -->
              <button 
                type="button" 
                @click="openWatermarkEditor(activeCarouselIndex)"
                class="btn btn-2xs font-bold gap-1 rounded-xl border border-warning/40 bg-warning/10 text-warning hover:bg-warning hover:text-warning-content transition-all shadow-xs"
                title="Crop out ShopGoodwill or auction watermarks"
              >
                <Icon icon="solar:shield-warning-bold" class="w-3.5 h-3.5 text-warning" />
                <span>✂️ Watermarks</span>
              </button>

              <!-- Fit Mode Toggle (Fit Whole Pic vs Fill) -->
              <button 
                type="button" 
                @click="previewFitMode = previewFitMode === 'contain' ? 'cover' : 'contain'"
                class="btn btn-2xs font-bold gap-1 rounded-xl border transition-all"
                :class="previewFitMode === 'contain' ? 'btn-secondary text-secondary-content shadow-xs border-secondary' : 'btn-outline border-base-300'"
                :title="previewFitMode === 'contain' ? 'Current: Fit Whole Picture. Click to Fill' : 'Current: Fill/Cover. Click to Fit Whole Picture'"
              >
                <Icon :icon="previewFitMode === 'contain' ? 'solar:maximize-square-minimalistic-bold' : 'solar:minimize-square-minimalistic-bold'" class="w-3.5 h-3.5" />
                <span>{{ previewFitMode === 'contain' ? 'Fit Whole Pic' : 'Fill (Cover)' }}</span>
              </button>
            </div>
          </div>

          <!-- SMARTPHONE POST PREVIEW FRAME -->
          <div class="rounded-[36px] border-4 border-base-300 shadow-2xl overflow-hidden bg-black text-white max-w-[340px] mx-auto flex flex-col justify-between relative select-none">
            <!-- Dynamic Island Notch -->
            <div class="pt-2 px-5 flex justify-between items-center text-[10px] font-mono opacity-80 z-20">
              <span>10:42</span>
              <div class="w-20 h-3.5 bg-black border border-white/20 rounded-full mx-auto"></div>
              <div class="flex items-center gap-1">
                <Icon icon="solar:wifi-bold" class="w-3 h-3" />
                <Icon icon="solar:battery-charge-bold" class="w-3 h-3" />
              </div>
            </div>

            <!-- Header (@handle + location + zoom button) -->
            <div class="px-3.5 py-2.5 flex items-center justify-between bg-black/90 z-10 border-b border-white/10 mt-1">
              <div class="flex items-center gap-2 min-w-0">
                <div class="w-7 h-7 rounded-full p-0.5 bg-linear-to-tr from-amber-500 via-pink-500 to-purple-600 shrink-0">
                  <div class="w-full h-full rounded-full bg-black flex items-center justify-center text-[10px] font-black text-white">
                    RC
                  </div>
                </div>
                <div class="min-w-0">
                  <div class="font-black text-xs leading-none truncate">@{{ authorAccountHandle || 'resalecommand' }}</div>
                  <div class="text-[9px] opacity-70 truncate mt-0.5">📍 {{ currentTargetLocation }}</div>
                </div>
              </div>
              <div class="flex items-center gap-1.5">
                <!-- Quick Opacity Cycle Button -->
                <button 
                  type="button" 
                  @click="cycleOpacity"
                  class="btn btn-2xs btn-ghost text-white/90 hover:text-white font-mono text-[10px] px-2 rounded-lg border border-white/20 gap-1 bg-white/10 hover:bg-white/20 transition-all shadow-xs"
                  title="Cycle banner opacity (50% -> 65% -> 80% -> 95%)"
                >
                  <Icon icon="solar:sun-2-bold" class="w-3 h-3 text-warning" />
                  <span>{{ Math.round(phoneBurnInCardOpacity * 100) }}%</span>
                </button>
                <button 
                  type="button" 
                  @click="openImageEditor(activeCarouselIndex)"
                  class="btn btn-2xs btn-circle btn-ghost text-white/80 hover:text-white"
                  title="Zoom & open slide editor tray"
                >
                  <Icon icon="solar:magnifer-zoom-in-bold" class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- Carousel Media Viewport (Clickable to open Zoom & Slide Editor Tray) -->
            <div 
              class="relative w-full bg-black/90 flex items-center justify-center overflow-hidden group cursor-pointer transition-all duration-300"
              :class="[
                previewAspectRatio === '4:5' ? 'aspect-[4/5]' : previewAspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-square'
              ]"
              @click="openImageEditor(activeCarouselIndex)"
              title="Click to zoom image & open slide editor tray"
            >
              <!-- Ambient Blurred Backdrop Glow when in Contain Mode -->
              <div 
                v-if="currentCarouselPhoto && previewFitMode === 'contain'"
                class="absolute inset-0 overflow-hidden pointer-events-none select-none opacity-35 scale-125 filter blur-xl"
              >
                <img :src="currentCarouselPhoto" class="w-full h-full object-cover" />
              </div>

              <img 
                v-if="currentCarouselPhoto"
                :src="currentCarouselPhoto" 
                class="relative z-1 w-full h-full transition-all duration-300 group-hover:scale-101" 
                :class="previewFitMode === 'contain' ? 'object-contain' : 'object-cover'"
                alt="Social Drop Preview"
                @error="onSlideImageError"
              />
              <div v-else class="flex flex-col items-center justify-center opacity-40 text-xs p-4 text-center">
                <Icon icon="solar:gallery-wide-linear" class="w-10 h-10 mb-1" />
                <span>No media yet</span>
              </div>

              <!-- Top Left: Cover / Slide Badge -->
              <div class="absolute top-2 left-2 flex items-center gap-1 z-20" @click.stop>
                <span 
                  class="badge font-black text-[10px] gap-1 shadow-md py-1 px-2 rounded-lg"
                  :class="activeCarouselIndex === 0 ? 'badge-warning text-warning-content' : 'badge-neutral text-neutral-content'"
                >
                  <Icon icon="solar:star-bold" class="w-3 h-3" />
                  {{ activeCarouselIndex === 0 ? 'Cover' : '#' + (activeCarouselIndex + 1) }}
                </span>
                <button 
                  v-if="activeCarouselIndex !== 0"
                  type="button" 
                  @click="setSlideAsCover(activeCarouselIndex)"
                  class="btn btn-2xs btn-warning font-bold py-0 h-5 text-[9px] rounded-md shadow-xs"
                  title="Make this the Cover Photo"
                >
                  ⭐ Set Cover
                </button>
              </div>

              <!-- Slide Controls (‹ / ›) -->
              <button 
                v-if="carouselPhotos.length > 1"
                type="button" 
                @click.stop="prevCarouselSlide"
                class="btn btn-circle btn-xs bg-black/60 hover:bg-black text-white absolute left-2 top-1/2 -translate-y-1/2 border border-white/20 z-20"
                title="Previous photo"
              >
                ‹
              </button>

              <button 
                v-if="carouselPhotos.length > 1"
                type="button" 
                @click.stop="nextCarouselSlide"
                class="btn btn-circle btn-xs bg-black/60 hover:bg-black text-white absolute right-2 top-1/2 -translate-y-1/2 border border-white/20 z-20"
                title="Next photo"
              >
                ›
              </button>

              <!-- LIVE THEME OVERLAY (Sleek Floating IG Story Sticker Pill) -->
              <div 
                v-if="currentCarouselPhoto && showPhoneBurnIn"
                class="absolute bottom-3 inset-x-3 pointer-events-none select-none z-10 flex flex-col justify-end"
              >
                <div 
                  class="relative z-10 px-3 py-2 rounded-2xl shadow-xl transition-all duration-300 backdrop-blur-md border"
                  :style="{
                    backgroundColor: getOverlayBgStyle(selectedOverlayTheme, phoneBurnInCardOpacity)
                  }"
                  :class="[
                    selectedOverlayTheme === 'instagram' ? 'text-white border-white/20 font-sans' : '',
                    selectedOverlayTheme === 'tiktok' ? 'text-white border-cyan-400/50 font-sans' : '',
                    selectedOverlayTheme === 'antique' ? 'text-amber-100 border-amber-600/50 font-serif' : '',
                    selectedOverlayTheme === 'cyberpunk' ? 'text-cyan-300 border-cyan-400/50 font-sans' : '',
                    selectedOverlayTheme === 'minimalist' ? 'text-white border-white/25 font-sans' : '',
                    selectedOverlayTheme === 'editorial' ? 'text-black border-black/30 font-serif' : '',
                    selectedOverlayTheme === 'boutique' ? 'text-amber-200 border-amber-500/50 font-sans' : ''
                  ]"
                >
                  <div class="flex items-center justify-between gap-1 pb-0.5">
                    <span class="text-[9px] tracking-wider uppercase opacity-85 truncate font-bold">
                      📍 {{ currentTargetLocation }}
                    </span>
                    <span 
                      v-if="showBurnInPrice && currentSlideDisplayPrice !== null"
                      class="badge badge-2xs font-mono font-black shrink-0"
                      :class="selectedOverlayTheme === 'tiktok' ? 'bg-[#fe2c55] text-white border-none' : (selectedOverlayTheme === 'antique' ? 'badge-warning' : 'badge-primary')"
                    >
                      ${{ currentSlideDisplayPrice.toFixed(2) }}
                    </span>
                  </div>
                  <h4 v-if="showBurnInTitle && currentSlideDisplayTitle" class="font-bold text-xs leading-tight line-clamp-1">
                    {{ currentSlideDisplayTitle }}
                  </h4>
                  <p v-if="showBurnInQuote && currentSlideDisplayQuote" class="text-[9.5px] leading-tight pt-0.5 line-clamp-2 italic opacity-90">
                    "{{ currentSlideDisplayQuote }}"
                  </p>
                </div>
              </div>
            </div>

            <!-- Social Action Bar -->
            <div class="p-2.5 bg-black/95 flex items-center justify-between border-t border-white/10">
              <div class="flex items-center gap-3">
                <button type="button" @click="isLiked = !isLiked" class="hover:scale-110 transition-transform">
                  <Icon icon="solar:heart-bold" class="w-4 h-4" :class="isLiked ? 'text-red-500' : 'text-white'" />
                </button>
                <Icon icon="solar:chat-round-line-bold" class="w-4 h-4 text-white/90" />
                <Icon icon="solar:plain-bold" class="w-4 h-4 text-white/90" />
              </div>
              <Icon icon="solar:bookmark-bold" class="w-4 h-4 text-white/90" />
            </div>

            <!-- Caption Display Box -->
            <div class="px-3 pb-3 pt-1 bg-black/95 space-y-1 max-h-32 overflow-y-auto scrollbar-thin text-left">
              <div class="text-[10px] leading-relaxed text-white/90 whitespace-pre-wrap font-sans">
                <span class="font-black text-white mr-1.5">@{{ authorAccountHandle || 'resalecommand' }}</span>
                <span>{{ generatedCaption || 'Click "Generate Post Copy" to summon copy for your staged items...' }}</span>
              </div>
            </div>

            <!-- Home Bar -->
            <div class="pb-1 pt-0.5 bg-black flex justify-center">
              <div class="w-24 h-1 bg-white/40 rounded-full"></div>
            </div>
          </div>

          <!-- SUPPORTING PHOTOS THUMBNAIL TRACK -->
          <div class="space-y-1.5 pt-1">
            <div class="flex items-center justify-between text-[11px]">
              <span class="font-bold opacity-75">Supporting Photos ({{ postMediaList.length }}):</span>
              <button 
                type="button" 
                @click="openImageEditor(activeCarouselIndex)"
                class="text-[10px] text-primary hover:underline font-bold flex items-center gap-0.5"
                title="Open slide & image editor tray"
              >
                <Icon icon="solar:crop-minimalistic-bold" class="w-3 h-3 text-primary" />
                <span>✂️ Slide &amp; Image Editor Tray</span>
              </button>
            </div>

            <!-- Wrapping Thumbnail Grid with Drag & Drop Reordering! -->
            <div class="grid grid-cols-4 sm:grid-cols-5 gap-2 pt-1">
              <div 
                v-for="(slide, sIdx) in postMediaList" 
                :key="slide.id || sIdx"
                draggable="true"
                @dragstart="handleSlideDragStart(sIdx, $event)"
                @dragover="handleSlideDragOver(sIdx, $event)"
                @dragleave="handleSlideDragLeave(sIdx)"
                @drop="handleSlideDrop(sIdx, $event)"
                @dragend="handleSlideDragEnd"
                class="relative aspect-square rounded-xl overflow-hidden cursor-grab active:cursor-grabbing border-2 transition-all shadow-xs group select-none"
                :class="[
                  sIdx === activeCarouselIndex ? 'border-primary ring-2 ring-primary/40' : 'border-base-300 opacity-85 hover:opacity-100 hover:border-primary/50',
                  draggedSlideIndex === sIdx ? 'opacity-30 scale-95 border-dashed border-primary' : '',
                  dragOverSlideIndex === sIdx && draggedSlideIndex !== sIdx ? 'border-secondary ring-2 ring-secondary scale-105 shadow-md' : ''
                ]"
                @click="openImageEditor(sIdx)"
                :title="(slide.title || 'Slide ' + (sIdx + 1)) + ' (Click to edit in tray)'"
              >
                <img :src="slide.url" class="w-full h-full object-cover pointer-events-none" alt="Slide thumb" @error="onSlideImageError" />
                
                <!-- Slide Index Badge: ⭐ for 1st / Cover -->
                <span 
                  class="absolute bottom-0.5 left-0.5 badge badge-2xs font-mono font-bold text-[8px] px-1 py-0 shadow-xs border-none"
                  :class="sIdx === 0 ? 'badge-warning text-warning-content font-black ring-1 ring-black/40' : 'bg-black/80 text-white'"
                >
                  {{ sIdx === 0 ? '⭐ 1st' : '#' + (sIdx + 1) }}
                </span>

                <!-- Quick Zoom & Watermark Crop Action on Hover -->
                <button 
                  type="button" 
                  @click.stop="openWatermarkEditor(sIdx)"
                  class="absolute bottom-0.5 right-0.5 px-1 py-0.5 rounded-md bg-warning text-warning-content font-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:brightness-110 text-[8px] shadow-xs"
                  title="Crop watermark & edit photo"
                >
                  ✂️ Crop
                </button>

                <!-- Quick 'Set 1st' Action on Hover (if not already 1st) -->
                <button 
                  v-if="sIdx !== 0"
                  type="button" 
                  @click.stop="setSlideAsCover(sIdx)"
                  class="absolute top-0.5 left-0.5 px-1 py-0.5 rounded-md bg-warning text-warning-content font-black text-[8px] opacity-0 group-hover:opacity-100 transition-opacity shadow-xs"
                  title="Make this slide the First / Cover photo"
                >
                  ⭐ 1st
                </button>

                <!-- Delete Button -->
                <button 
                  type="button" 
                  @click.stop="removeSlide(sIdx)"
                  class="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-error/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
                  title="Remove from reel"
                >
                  ✕
                </button>
              </div>

              <!-- + Snap Tile -->
              <button 
                type="button" 
                @click="openBoothCamera"
                class="aspect-square rounded-xl border-2 border-dashed border-base-300 hover:border-secondary hover:bg-secondary/5 flex flex-col items-center justify-center gap-0.5 text-secondary transition-all active:scale-95"
                title="Snap camera photo"
              >
                <Icon icon="solar:camera-bold" class="w-4 h-4" />
                <span class="text-[9px] font-bold">+ Snap</span>
              </button>

              <!-- + Upload Tile -->
              <button 
                type="button" 
                @click="triggerUploadInput"
                class="aspect-square rounded-xl border-2 border-dashed border-base-300 hover:border-primary hover:bg-primary/5 flex flex-col items-center justify-center gap-0.5 text-primary transition-all active:scale-95"
                title="Upload photo"
              >
                <Icon icon="solar:upload-bold" class="w-4 h-4" />
                <span class="text-[9px] font-bold">+ Upload</span>
              </button>
            </div>
          </div>

          <!-- Hero Action Buttons -->
          <div class="grid grid-cols-2 gap-2 pt-1">
            <button 
              type="button" 
              @click="openImageEditor(activeCarouselIndex)" 
              :disabled="postMediaList.length === 0"
              class="btn btn-sm btn-outline border-base-300 hover:border-primary hover:bg-primary/5 text-base-content font-black rounded-xl gap-1.5 h-10 active:scale-95 transition-all text-xs"
              title="Crop aspect ratio, rotate, and AI relight current slide"
            >
              <Icon icon="solar:crop-minimalistic-bold" class="w-4 h-4 text-primary" />
              <span>✂️ Crop &amp; AI</span>
            </button>
            <button 
              type="button" 
              @click="openReelStudio(activeCarouselIndex)" 
              :disabled="postMediaList.length === 0"
              class="btn btn-sm bg-linear-to-r from-purple-600 via-indigo-600 to-pink-600 hover:brightness-110 text-white font-black rounded-xl gap-1.5 shadow-md shadow-purple-500/20 border-none h-10 active:scale-95 transition-all text-xs"
              title="Play Animated Reel & Music Studio"
            >
              <Icon icon="solar:play-circle-bold" class="w-4 h-4" />
              <span>🎬 Play Reel</span>
            </button>
          </div>
        </div>
      </div>

      <!-- RIGHT: AI COPY ENGINE & PERSONA PRESETS (7 cols) -->
      <div class="lg:col-span-7 space-y-3">
        <div class="card bg-base-100 border border-base-200 shadow-sm p-4 sm:p-5 rounded-3xl space-y-3.5">
          <div class="flex items-center justify-between pb-1.5 border-b border-base-200">
            <span class="font-black text-sm flex items-center gap-1.5">
              <Icon icon="solar:magic-stick-3-bold" class="w-4 h-4 text-primary" />
              <span>Persona &amp; AI Copywriter</span>
            </span>
            <span class="text-[11px] font-mono text-primary font-bold">
              {{ carouselPhotos.length }} photo{{ carouselPhotos.length === 1 ? '' : 's' }} in reel
            </span>
          </div>

          <!-- Persona Preset Chips -->
          <div class="space-y-1.5">
            <label class="text-xs font-bold opacity-75">Curator Persona / Aesthetic Tone</label>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5">
              <button 
                type="button" 
                v-for="p in personaPresets" 
                :key="p.id"
                class="btn btn-xs rounded-xl transition-all h-9 text-left justify-start gap-1.5"
                :class="selectedPersonaId === p.id ? 'btn-secondary text-secondary-content font-bold shadow-xs' : 'btn-ghost bg-base-200 opacity-75'"
                @click="applyPersona(p)"
              >
                <span>{{ p.emoji }}</span>
                <span class="truncate font-bold text-xs">{{ p.label }}</span>
              </button>
            </div>
          </div>

          <!-- Custom Persona Prompt Input -->
          <div class="space-y-1">
            <label class="text-[11px] font-mono opacity-60">Custom Tone &amp; Voice Prompt</label>
            <textarea 
              v-model="customTonePrompt" 
              rows="2"
              placeholder="e.g. Vampire Lestat — decadent, poetic, darkly romantic gothic aristocrat from Anne Rice..."
              class="textarea textarea-bordered w-full text-xs font-sans rounded-2xl focus:border-primary bg-base-200/40 leading-relaxed resize-none p-2.5"
            ></textarea>
          </div>

          <!-- Platform Selector -->
          <div class="space-y-1.5">
            <label class="text-xs font-bold opacity-75">Platform Simulator</label>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button 
                type="button" 
                v-for="p in platforms" 
                :key="p.id"
                class="btn btn-xs rounded-xl font-bold gap-1 transition-all h-8"
                :class="selectedPlatform === p.id ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost bg-base-200'"
                @click="onSelectPlatform(p.id)"
              >
                <Icon :icon="p.icon" class="w-3.5 h-3.5" />
                <span class="truncate">{{ p.label }}</span>
              </button>
            </div>
          </div>

          <!-- Controls: Author Handle & Physical Venue -->
          <div class="grid grid-cols-2 gap-2 pt-1 border-t border-base-200">
            <div class="space-y-1">
              <label class="text-[10px] font-bold text-base-content/70">Author Account</label>
              <div class="flex items-center gap-1 bg-base-200/50 px-2 py-0.5 rounded-xl border border-base-300">
                <span class="text-xs font-black opacity-60">@</span>
                <input 
                  type="text" 
                  v-model="authorAccountHandle" 
                  placeholder="resalecommand" 
                  class="input input-xs bg-transparent border-none p-0 w-full font-mono text-[11px] focus:outline-none"
                  title="Author Account Handle"
                />
              </div>
            </div>

            <div class="space-y-1">
              <label class="text-[10px] font-bold text-base-content/70">Physical Venue</label>
              <div class="flex items-center gap-1 bg-base-200/50 px-2 py-0.5 rounded-xl border border-base-300">
                <Icon icon="solar:shop-bold" class="w-3.5 h-3.5 opacity-60 shrink-0" />
                <input 
                  type="text" 
                  v-model="boothLocationInput" 
                  placeholder="Memory Den" 
                  class="input input-xs bg-transparent border-none p-0 w-full font-mono text-[11px] focus:outline-none"
                  title="Physical Booth Venue"
                />
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between gap-2">
            <label class="label py-0.5 cursor-pointer justify-start gap-2">
              <input type="checkbox" v-model="includePrices" class="checkbox checkbox-xs checkbox-primary" />
              <span class="label-text font-bold text-xs">Show Prices ($) in post</span>
            </label>
            <span class="text-[10px] font-mono opacity-60">Target: {{ currentTargetLocation }}</span>
          </div>

          <input 
            type="text" 
            v-model="customNotes" 
            placeholder="Extra notes (e.g. Rare 90s gothic clothing drop, holds via DM)" 
            class="input input-xs input-bordered w-full text-xs rounded-xl"
          />

          <!-- Generate Action Button -->
          <button 
            type="button" 
            @click="generateCaption"
            :disabled="isGenerating || (carouselPhotos.length === 0 && studioItems.length === 0)"
            class="btn btn-sm w-full bg-linear-to-r from-purple-600 via-indigo-600 to-primary hover:brightness-110 text-white font-black shadow-lg shadow-indigo-500/25 border-none gap-2 min-h-[44px] rounded-2xl active:scale-95"
          >
            <span v-if="isGenerating" class="loading loading-spinner loading-sm"></span>
            <Icon v-else icon="solar:magic-stick-3-bold" class="w-4 h-4 text-yellow-300" />
            <span>{{ isGenerating ? 'AI Summoning Copy...' : '✨ Generate Post Copy' }}</span>
          </button>

          <!-- Raw Text Caption Editor with Lock & Copy -->
          <div class="space-y-2 pt-2 border-t border-base-200">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-bold text-base-content/80">Post Caption (Raw Text)</span>
                <span v-if="lastSource" class="badge badge-xs font-mono font-bold" :class="lastSource === 'gemini' || lastSource === 'AI' ? 'badge-primary' : 'badge-neutral'">
                  {{ lastSource === 'gemini' || lastSource === 'AI' ? '✨ Gemini AI' : 'Dynamic Fallback' }}
                </span>
              </div>
              <div class="flex items-center gap-1.5">
                <!-- Lock Toggle Button -->
                <button 
                  type="button" 
                  @click="toggleCaptionLock"
                  class="btn btn-2xs font-bold gap-1 rounded-lg transition-all"
                  :class="isCaptionLocked ? 'btn-warning text-warning-content shadow-xs' : 'btn-ghost bg-base-200 opacity-70 hover:opacity-100'"
                  :title="isCaptionLocked ? 'Caption is locked. Click to unlock.' : 'Lock caption to protect manual edits from AI regeneration.'"
                >
                  <Icon :icon="isCaptionLocked ? 'solar:lock-bold' : 'solar:lock-unlocked-bold'" class="w-3 h-3" />
                  <span>{{ isCaptionLocked ? 'Locked' : 'Unlocked' }}</span>
                </button>
                <!-- Copy Button -->
                <button 
                  type="button" 
                  @click="copyToClipboard"
                  :disabled="!generatedCaption"
                  class="btn btn-2xs btn-outline border-base-300 font-bold gap-1 rounded-lg"
                  title="Copy caption to clipboard"
                >
                  <Icon icon="solar:copy-bold" class="w-3 h-3" />
                  <span>{{ isCopied ? 'Copied! ✓' : 'Copy' }}</span>
                </button>
              </div>
            </div>

            <textarea 
              v-model="generatedCaption" 
              rows="6"
              placeholder="Generated caption appears here, or type your own directly. Lock to protect manual edits!"
              class="textarea textarea-bordered w-full text-xs font-sans rounded-2xl focus:border-primary bg-base-200/40 leading-relaxed resize-y p-3"
              @blur="syncActiveCastState"
            ></textarea>
            
            <p v-if="isCaptionLocked" class="text-[10px] text-warning font-semibold flex items-center gap-1">
              <Icon icon="solar:shield-check-bold" class="w-3 h-3" />
              <span>Caption locked: AI generation and persona clicks won't overwrite your manual edits.</span>
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- SECTION 2: STAGED ITEMS FOR THIS CAST (REPLACES DROP LIST)-->
    <!-- ======================================================== -->
    <div class="card bg-base-100 border border-base-200 shadow-sm p-4 sm:p-5 rounded-3xl space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-base-200">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center font-black shrink-0">
            <Icon icon="solar:box-minimalistic-bold" class="w-4 h-4" />
          </div>
          <div>
            <h3 class="font-black text-sm sm:text-base flex items-center gap-2 flex-wrap">
              <span>Staged Items for this Cast</span>
              <span class="badge badge-sm badge-secondary font-mono font-bold">{{ studioItems.length }} Items</span>
              <span class="badge badge-sm badge-outline font-mono font-bold text-success">${{ totalRetailValue.toFixed(2) }} Retail</span>
            </h3>
            <p class="text-[11px] opacity-65">
              Items staged into this Dropcast. Pick more anytime in the Inventory Catalog using the Cast Selection Tray.
            </p>
          </div>
        </div>

        <!-- Top Actions: Search + Pick More CTA -->
        <div class="flex items-center gap-2 flex-wrap">
          <div v-if="studioItems.length > 3" class="relative">
            <input 
              type="text" 
              v-model="stagedSearchQuery" 
              placeholder="Filter staged..." 
              class="input input-xs input-bordered rounded-xl pl-7 w-32 sm:w-44 text-xs"
            />
            <Icon icon="solar:magnifer-linear" class="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 opacity-50" />
          </div>

          <button 
            v-if="studioItems.length > 0"
            type="button" 
            @click="clearAllStaged" 
            class="btn btn-ghost btn-xs text-error font-bold"
            title="Clear all staged items from this cast"
          >
            Clear All
          </button>

          <!-- Direct CTA to /inventory with clear affordance -->
          <a 
            href="/inventory" 
            class="btn btn-xs sm:btn-sm btn-primary text-primary-content font-black rounded-xl gap-1.5 shadow-md shadow-primary/20 hover:scale-102 transition-transform"
            title="Browse all inventory items and stage them directly using the bottom selection tray"
          >
            <Icon icon="solar:cart-large-minimalistic-bold" class="w-4 h-4" />
            <span>+ Pick More in /inventory ➔</span>
          </a>
        </div>
      </div>

      <!-- Empty State: Clear Guidance to /inventory -->
      <div 
        v-if="studioItems.length === 0" 
        class="p-8 text-center rounded-2xl border-2 border-dashed border-base-300 bg-base-200/20 space-y-3"
      >
        <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
          <Icon icon="solar:inbox-line-bold" class="w-6 h-6" />
        </div>
        <div class="space-y-1">
          <h4 class="font-black text-sm text-base-content">No Items Staged in this Dropcast</h4>
          <p class="text-xs opacity-60 max-w-md mx-auto">
            Use the <strong>Inventory Catalog</strong> to search, filter by location or booth shelf, and click <strong>"Stage Cast"</strong> on the selection action bar to stage items here!
          </p>
        </div>
        <div class="pt-2">
          <a 
            href="/inventory" 
            class="btn btn-sm btn-primary text-primary-content font-black rounded-2xl gap-2 shadow-md shadow-primary/20"
          >
            <Icon icon="solar:cart-large-minimalistic-bold" class="w-4 h-4" />
            <span>Open Inventory Catalog ➔</span>
          </a>
        </div>
      </div>

      <!-- Populated Staged Items (Expandable Cards with Inline Photo Trays) -->
      <div v-else class="space-y-3">
        <div 
          v-for="(item, idx) in filteredStudioItems" 
          :key="getItemKey(item) + idx"
          class="rounded-2xl border border-base-200 bg-base-100 transition-all overflow-hidden"
          :class="expandedItemIds.has(getItemKey(item)) ? 'border-primary/40 shadow-sm ring-1 ring-primary/20' : 'hover:border-base-300'"
        >
          <!-- Card Header / Collapsed Row -->
          <div 
            class="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none bg-base-100 hover:bg-base-200/30 transition-colors"
            @click="toggleItemExpanded(item)"
          >
            <!-- Left: Thumbnail & Details -->
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <div 
                class="cursor-pointer transition-transform hover:scale-105 active:scale-95 shrink-0" 
                @click.stop="openZoomPreview(resolveItemPhoto(item) || '')" 
                title="Click photo to open in Slide & Image Editor Tray"
              >
                <ItemThumbnail 
                  :item="item" 
                  :src="resolveItemPhoto(item) || ''" 
                  size="md" 
                  rounded="xl" 
                />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <h4 class="font-black text-xs sm:text-sm text-base-content truncate" :title="item.title">{{ item.title }}</h4>
                  <span class="badge badge-xs font-mono font-bold" :class="getItemImageUrls(item).length > 0 ? 'badge-primary' : 'badge-ghost opacity-60'">
                    📷 {{ getItemImageUrls(item).length }} photo{{ getItemImageUrls(item).length === 1 ? '' : 's' }}
                  </span>
                </div>
                <div class="flex items-center gap-2 mt-1 text-[11px] font-mono flex-wrap">
                  <span class="text-secondary font-black">${{ formatPrice(item.boutiquePrice || item.resalePrice || item.price) }}</span>
                  <span v-if="item.brand" class="badge badge-2xs badge-neutral font-mono truncate max-w-[120px]">{{ item.brand }}</span>
                  <span v-if="item.category" class="opacity-60 text-[10px] truncate">{{ item.category }}</span>
                  <span v-if="item.storageLocation" class="opacity-60 text-[10px] truncate">📍 {{ item.storageLocation }}</span>
                </div>
              </div>
            </div>

            <!-- Right: Item Actions (Edit drawer button hidden!) -->
            <div class="flex items-center gap-1.5 shrink-0 self-end sm:self-center" @click.stop>
              <!-- 1-Tap Add All Photos to Reel -->
              <button 
                type="button" 
                @click="addAllItemPhotos(item)" 
                class="btn btn-xs btn-outline border-base-300 font-bold gap-1 rounded-xl text-[11px] hover:border-primary hover:text-primary"
                title="Add all item photos into the Media Reel"
              >
                <Icon icon="solar:gallery-wide-bold" class="w-3.5 h-3.5" />
                <span class="hidden sm:inline">+ All Photos</span>
                <span class="sm:hidden">+ All</span>
              </button>

              <!-- Expand/Collapse Tray Toggle -->
              <button 
                type="button" 
                @click="toggleItemExpanded(item)"
                class="btn btn-xs font-bold gap-1 rounded-xl text-[11px]"
                :class="expandedItemIds.has(getItemKey(item)) ? 'btn-primary text-primary-content' : 'btn-ghost bg-base-200'"
                title="Toggle Photo Gallery Tray"
              >
                <Icon :icon="expandedItemIds.has(getItemKey(item)) ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'" class="w-3 h-3" />
                <span>{{ expandedItemIds.has(getItemKey(item)) ? 'Hide Tray' : 'View Tray' }}</span>
              </button>

              <!-- Unstage Button -->
              <button 
                type="button" 
                @click="unstageItem(item)" 
                class="btn btn-ghost btn-xs btn-square text-error hover:bg-error/10 rounded-xl"
                title="Remove item from this Dropcast"
              >
                <Icon icon="solar:trash-bin-trash-bold" class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Expanded Inline Photo Tray -->
          <div 
            v-if="expandedItemIds.has(getItemKey(item))"
            class="p-3 sm:p-4 bg-base-200/40 border-t border-base-200 space-y-2.5 transition-all"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-base-content/80 flex items-center gap-1.5">
                <Icon icon="solar:album-bold" class="w-3.5 h-3.5 text-primary" />
                <span>Item Photos in Appwrite:</span>
              </span>
              <span class="text-[10px] font-mono opacity-60">
                Tap photo to zoom • Toggle to add/remove from Cast Reel
              </span>
            </div>

            <!-- Zero Photos Case -->
            <div v-if="getItemImageUrls(item).length === 0" class="text-xs opacity-60 italic py-2">
              No Appwrite photos attached to this item yet. (Take a booth snap or upload in catalog).
            </div>

            <!-- Photos Grid -->
            <div v-else class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
              <div 
                v-for="(photoUrl, pIdx) in getItemImageUrls(item)" 
                :key="photoUrl + pIdx"
                class="rounded-xl border bg-base-100 overflow-hidden flex flex-col justify-between shadow-2xs group"
                :class="isItemPhotoInReel(photoUrl) ? 'border-primary ring-2 ring-primary/40' : 'border-base-300'"
              >
                <!-- Thumbnail with Zoom on Click -->
                <div 
                  class="aspect-square relative cursor-pointer overflow-hidden bg-black/10 hover:ring-2 hover:ring-primary transition-all" 
                  @click="openZoomPreview(photoUrl)"
                  title="Click to open in Slide & Image Editor Tray"
                >
                  <img :src="photoUrl" class="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                  <span class="badge badge-2xs badge-neutral absolute bottom-1 left-1 font-mono font-bold text-[9px] opacity-80">
                    #{{ pIdx + 1 }}
                  </span>
                  <span class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity badge badge-2xs badge-primary font-bold shadow-xs">
                    ✂️ Edit
                  </span>
                  <!-- Reel Indicator Badge -->
                  <span 
                    v-if="isItemPhotoInReel(photoUrl)"
                    class="badge badge-2xs badge-primary absolute top-1 left-1 font-bold text-[8px] shadow-xs"
                  >
                    In Reel ✓
                  </span>
                </div>

                <!-- Add/Remove Toggle Button -->
                <div class="p-1.5 bg-base-100 border-t border-base-200 flex justify-center">
                  <button 
                    type="button" 
                    @click="toggleItemPhotoInReel(item, photoUrl, pIdx)"
                    class="btn btn-2xs w-full font-bold rounded-lg transition-all"
                    :class="isItemPhotoInReel(photoUrl) ? 'btn-success text-success-content shadow-2xs' : 'btn-outline border-base-300 hover:border-primary hover:text-primary'"
                  >
                    <span v-if="isItemPhotoInReel(photoUrl)">✓ In Reel</span>
                    <span v-else>+ Add to Reel</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- HIDDEN NATIVE FILE INPUTS -->
    <input 
      ref="studioFileInputRef" 
      type="file" 
      multiple 
      accept="image/*" 
      class="hidden" 
      @change="handleFileInputChange" 
    />
    <input 
      ref="itemFileInputRef" 
      type="file" 
      accept="image/*" 
      class="hidden" 
      @change="handleItemFileInputChange" 
    />

    <!-- IN-APP CAMERA SCANNER VIEW FINDER -->
    <ScannerWidget 
      ref="scannerWidget" 
      :photos="capturedCameraPhotos" 
      :hide-all-triggers="true" 
      overlay-mode="item" 
      @photos-captured="handleCapturedCameraPhotos" 
    />

    <!-- SLIDE-OVER ITEM DRAWER (ESTABLISHED CANONICAL PATTERN!) -->
    <ItemDrawer 
      v-if="isDrawerOpen" 
      :item="activeDrawerItem" 
      :isOpen="isDrawerOpen"
      :inventoryItems="studioItems" 
      @close="isDrawerOpen = false" 
      @save="onDrawerSaved" 
      @saved="onDrawerSaved" 
    />

    <!-- ITEM PICKER MODAL (LEGACY FALLBACK) -->
    <SocialItemPickerModal
      :isOpen="isItemPickerOpen"
      :alreadyStagedIds="alreadyStagedIds"
      :initialLocation="currentTargetLocation"
      @close="isItemPickerOpen = false"
      @add-items="handleAddPickerItems"
    />

    <!-- ANIMATED REEL & STORY STUDIO MODAL -->
    <AnimatedReelPlayerModal
      :isOpen="isReelPlayerOpen"
      :slides="postMediaList"
      :venueName="currentTargetLocation"
      :authorHandle="authorAccountHandle"
      :initialTheme="selectedOverlayTheme"
      :initialIndex="reelStudioInitialIndex"
      :initialCardOpacity="phoneBurnInCardOpacity"
      :initialShowPrice="showBurnInPrice"
      @close="isReelPlayerOpen = false"
      @update:slideDescription="updateSlideDescription"
    />

    <!-- SLIDE IMAGE EDITOR & AI ENHANCER MODAL -->
    <SlideImageEditorModal
      :isOpen="isImageEditorOpen"
      :slides="postMediaList"
      :initialIndex="editingSlideIndex"
      :initialVenue="currentTargetLocation"
      :initialTab="editorInitialTab"
      @close="isImageEditorOpen = false"
      @update:slide="handleUpdateSlide"
      @update:all="handleUpdateAllSlides"
    />

    <!-- ======================================================== -->
    <!-- CANONICAL TRAY TRACKER: REUSABLE BOTTOM ACTION DOCK      -->
    <!-- ======================================================== -->
    <BottomActionDock
      :visible="currentView === 'studio' && (studioItems.length > 0 || postMediaList.length > 0 || boothGalleryPhotos.length > 0)"
      maxWidth="max-w-7xl"
    >
      <!-- Left: Tray Summary Stats -->
      <template #left>
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-8 h-8 rounded-xl bg-primary text-primary-content flex items-center justify-center font-black shadow-xs shrink-0">
            <Icon icon="solar:broadcast-bold" class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-black text-xs sm:text-sm text-base-content truncate max-w-[150px] sm:max-w-xs">{{ activeCast?.title || 'Cast Workstation' }}</span>
              <span class="badge badge-xs sm:badge-sm badge-secondary font-mono font-bold">{{ studioItems.length }} item{{ studioItems.length === 1 ? '' : 's' }}</span>
              <span v-if="postMediaList.length > 0" class="badge badge-xs sm:badge-sm badge-outline font-mono font-bold">{{ postMediaList.length }} slide{{ postMediaList.length === 1 ? '' : 's' }}</span>
            </div>
            <div class="text-[10px] sm:text-[11px] font-mono opacity-70 truncate">
              <span class="text-success font-black">${{ totalRetailValue.toFixed(2) }} retail</span>
              <span class="mx-1">•</span>
              <span>{{ currentTargetLocation }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- Right: Action Button Dock (Crop & AI, Play Reel, Cast Pack, Generate Copy, Save) -->
      <template #right>
        <!-- Crop & Watermark Cutter -->
        <button 
          type="button" 
          @click="openWatermarkEditor(activeCarouselIndex)" 
          :disabled="postMediaList.length === 0"
          class="btn btn-xs sm:btn-sm btn-outline border-warning/50 text-warning hover:bg-warning hover:text-warning-content font-bold gap-1.5 rounded-xl active:scale-95 shadow-2xs shrink-0"
          title="Crop out watermarks, rotate & AI enhance selected slide"
        >
          <Icon icon="solar:shield-warning-bold" class="w-3.5 h-3.5 text-warning" />
          <span class="hidden sm:inline">✂️ Watermarks</span>
          <span class="sm:hidden">✂️ Crop</span>
        </button>

        <!-- Play Reel -->
        <button 
          type="button" 
          @click="openReelStudio(activeCarouselIndex)" 
          :disabled="postMediaList.length === 0"
          class="btn btn-xs sm:btn-sm bg-linear-to-r from-purple-600 via-indigo-600 to-pink-600 hover:brightness-110 text-white font-black rounded-xl gap-1.5 shadow-md shadow-purple-500/20 border-none active:scale-95 shrink-0"
          title="Play Animated Reel & Soundtrack"
        >
          <Icon icon="solar:play-circle-bold" class="w-4 h-4" />
          <span class="hidden sm:inline">🎬 Play Reel</span>
          <span class="sm:hidden">🎬 Reel</span>
        </button>

        <!-- Download Cast Pack ZIP -->
        <button 
          type="button" 
          @click="downloadCastPack" 
          :disabled="isZipping || (postMediaList.length === 0 && studioItems.length === 0)"
          class="btn btn-xs sm:btn-sm btn-outline border-base-300 font-bold gap-1.5 rounded-xl shadow-2xs shrink-0"
          title="Download complete Cast Pack ZIP with high-res photos + caption text + manifest"
        >
          <span v-if="isZipping" class="loading loading-spinner loading-xs"></span>
          <Icon v-else icon="solar:archive-down-minimlistic-bold" class="w-4 h-4 text-secondary" />
          <span class="hidden sm:inline">{{ isZipping ? 'Packing...' : '📦 Cast Pack (.zip)' }}</span>
          <span class="sm:hidden">📦 Pack</span>
        </button>

        <!-- Generate Copy -->
        <button 
          type="button" 
          @click="generateCaption" 
          :disabled="isGenerating || (postMediaList.length === 0 && studioItems.length === 0)"
          class="btn btn-xs sm:btn-sm btn-primary text-primary-content font-black rounded-xl gap-1.5 shadow-md shadow-primary/25 active:scale-95 shrink-0"
          title="Generate AI copy for this Dropcast"
        >
          <span v-if="isGenerating" class="loading loading-spinner loading-xs"></span>
          <Icon v-else icon="solar:magic-stick-3-bold" class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">{{ isGenerating ? 'Summoning...' : '✨ Generate Cast Copy' }}</span>
          <span class="sm:hidden">✨ Copy</span>
        </button>

        <!-- Save Cast -->
        <button 
          type="button" 
          @click="handleSaveStudioCast" 
          class="btn btn-xs sm:btn-sm btn-success text-success-content font-black rounded-xl gap-1.5 shadow-2xs shrink-0"
          title="Save Dropcast state"
        >
          <Icon icon="solar:diskette-bold" class="w-3.5 h-3.5" />
          <span>Save</span>
        </button>
      </template>
    </BottomActionDock>

    <!-- FULLSCREEN GALLERY & IMAGE SETTINGS STUDIO MODAL (TRUE FULLSCREEN) -->
    <dialog class="modal z-[95]" :class="{ 'modal-open': isGalleryModalOpen }">
      <div v-if="isGalleryModalOpen" class="modal-box w-screen max-w-none h-screen max-h-none rounded-none m-0 p-0 bg-base-100 flex flex-col fixed inset-0">
        <!-- Modal Top Workspace Bar with Full Tools Toolbar -->
        <div class="px-4 py-2.5 sm:px-6 bg-base-200/90 backdrop-blur-md border-b border-base-300 flex items-center justify-between gap-3 shrink-0">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black shrink-0">
              <Icon icon="solar:gallery-wide-bold" class="w-4 h-4" />
            </div>
            <div class="min-w-0">
              <h3 class="font-black text-sm sm:text-base text-base-content truncate flex items-center gap-2">
                <span>Fullscreen Studio &amp; Slide Tools</span>
                <span class="badge badge-sm badge-primary font-mono font-bold">{{ postMediaList.length }} Slides</span>
              </h3>
              <p class="text-[11px] opacity-65 truncate font-mono">
                Slide {{ activeCarouselIndex + 1 }} of {{ postMediaList.length }} • {{ currentActiveSlide?.title || 'Slide' }} • 📍 {{ currentTargetLocation }}
              </p>
            </div>
          </div>

          <!-- Studio Tools Toolbar: Camera Snap, Upload, Import Staged, Auto-Quotes, Clear Reel, Play Reel -->
          <div class="flex items-center gap-2 flex-wrap justify-end">
            <!-- + Snap Camera -->
            <button 
              type="button" 
              @click="openBoothCamera"
              class="btn btn-xs btn-outline border-base-300 font-bold gap-1 rounded-xl hover:border-secondary"
              title="Snap a photo of the booth or item"
            >
              <Icon icon="solar:camera-bold" class="w-3.5 h-3.5 text-secondary" />
              <span>+ Snap Photo</span>
            </button>

            <!-- + Upload -->
            <button 
              type="button" 
              @click="triggerUploadInput"
              class="btn btn-xs btn-outline border-base-300 font-bold gap-1 rounded-xl hover:border-primary"
              title="Upload photo files"
            >
              <Icon icon="solar:upload-bold" class="w-3.5 h-3.5 text-primary" />
              <span>+ Upload</span>
            </button>

            <!-- + Add Staged Photos -->
            <button 
              v-if="studioItems.length > 0"
              type="button" 
              @click="addAllStagedItemPhotos"
              class="btn btn-xs btn-secondary text-secondary-content font-bold gap-1 rounded-xl shadow-2xs"
              title="Add all photos from staged items into the reel"
            >
              <Icon icon="solar:gallery-wide-bold" class="w-3.5 h-3.5" />
              <span>+ Add Staged Photos</span>
            </button>

            <!-- Auto-Quotes from Caption -->
            <button 
              type="button" 
              @click="autoAssignDescriptions"
              :disabled="!generatedCaption"
              class="btn btn-xs btn-outline border-secondary/50 text-secondary hover:bg-secondary hover:text-secondary-content font-bold gap-1 rounded-xl"
              title="Auto-assign AI item descriptions to slide cards"
            >
              <Icon icon="solar:magic-stick-3-bold" class="w-3.5 h-3.5" />
              <span>Auto-Quotes</span>
            </button>

            <!-- Clear Reel -->
            <button 
              v-if="postMediaList.length > 0"
              type="button" 
              @click="postMediaList = []" 
              class="btn btn-ghost btn-xs text-error font-bold"
              title="Clear all slides from reel"
            >
              Clear Reel
            </button>

            <!-- Play Reel in Studio -->
            <button 
              v-if="postMediaList.length > 0"
              type="button" 
              @click="openReelStudio(activeCarouselIndex)"
              class="btn btn-xs btn-primary text-primary-content font-black gap-1.5 rounded-xl shadow-xs"
              title="Open Animated Reel & Story Studio with soundtrack"
            >
              <Icon icon="solar:play-circle-bold" class="w-3.5 h-3.5" />
              <span>🎬 Play Reel</span>
            </button>

            <div class="h-5 w-px bg-base-300 shrink-0"></div>

            <!-- Close Studio Button -->
            <button 
              type="button" 
              @click="closeGalleryModal" 
              class="btn btn-sm btn-circle btn-ghost" 
              title="Close Fullscreen Studio (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        <!-- Body: 2 Columns on Desktop (Left: High-Res Zoomed Image, Right: Slide Settings) -->
        <div class="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          <!-- LEFT: High-Res Zoomed Carousel Viewport (7 cols) -->
          <div class="lg:col-span-7 flex flex-col items-center justify-center space-y-2">
            <!-- PLATFORM SIMULATOR MODE SELECTOR -->
            <div class="flex items-center justify-center gap-1.5 mb-1 bg-base-200/80 p-1 rounded-2xl border border-base-300 shadow-2xs">
              <button 
                type="button" 
                @click="setGallerySimulatorMode('instagram')" 
                class="btn btn-2xs rounded-xl font-bold gap-1 transition-all"
                :class="gallerySimulatorMode === 'instagram' ? 'bg-linear-to-r from-pink-500 via-purple-600 to-indigo-600 text-white shadow-xs border-none' : 'btn-ghost'"
                title="Preview as Instagram Reels & Stories"
              >
                <Icon icon="solar:camera-bold" class="w-3.5 h-3.5" />
                <span>Instagram Reels</span>
              </button>
              <button 
                type="button" 
                @click="setGallerySimulatorMode('tiktok')" 
                class="btn btn-2xs rounded-xl font-bold gap-1 transition-all"
                :class="gallerySimulatorMode === 'tiktok' ? 'bg-neutral-900 text-white border border-neutral-700 shadow-xs' : 'btn-ghost'"
                title="Preview as TikTok with engagement rail"
              >
                <Icon icon="solar:music-library-bold" class="w-3.5 h-3.5 text-cyan-400" />
                <span>TikTok</span>
              </button>
              <button 
                type="button" 
                @click="setGallerySimulatorMode('feed')" 
                class="btn btn-2xs rounded-xl font-bold gap-1 transition-all"
                :class="gallerySimulatorMode === 'feed' ? 'btn-neutral shadow-xs' : 'btn-ghost'"
                title="Preview as 1:1 Instagram Feed Post"
              >
                <Icon icon="solar:gallery-bold" class="w-3.5 h-3.5" />
                <span>IG Feed (1:1)</span>
              </button>
            </div>

            <!-- 1. 9:16 PHONE MOCKUP (INSTAGRAM REELS & TIKTOK SIMULATOR) -->
            <div v-if="gallerySimulatorMode !== 'feed'" class="mockup-phone border-base-300 shadow-2xl w-full max-w-[340px] sm:max-w-[370px]">
              <div class="camera mockup-phone-camera"></div>
              <div 
                class="display mockup-phone-display bg-black text-white relative flex flex-col justify-between select-none overflow-hidden transition-all duration-300 aspect-[9/16]"
              >
                <!-- iOS 18 STATUS BAR -->
                <div class="absolute top-2 inset-x-5 z-40 flex items-center justify-between text-[11px] font-semibold text-white pointer-events-none drop-shadow-sm select-none">
                  <span>9:41</span>
                  <!-- DYNAMIC ISLAND NOTCH -->
                  <div class="w-20 h-5 bg-black rounded-full border border-white/10 flex items-center justify-end px-1.5 gap-1 shadow-md">
                    <div class="w-2 rounded-full bg-neutral-900 border border-neutral-700 h-2"></div>
                  </div>
                  <div class="flex items-center gap-1.5 text-[10px]">
                    <Icon icon="solar:signal-cellular-bold" class="w-3 h-3" />
                    <span class="font-mono text-[9px] font-bold">5G</span>
                    <Icon icon="solar:battery-charge-bold" class="w-3.5 h-3.5" />
                  </div>
                </div>

                <!-- TOP STORY PROGRESS BARS -->
                <div class="absolute top-8 inset-x-3.5 z-40 flex items-center gap-1 pointer-events-none">
                  <div 
                    v-for="(_, idx) in postMediaList" 
                    :key="idx" 
                    class="flex-1 h-0.75 bg-white/30 rounded-full overflow-hidden backdrop-blur-xs"
                  >
                    <div 
                      class="h-full bg-white transition-all shadow-xs"
                      :style="{ width: idx === activeCarouselIndex ? '100%' : (idx < activeCarouselIndex ? '100%' : '0%') }"
                    ></div>
                  </div>
                </div>

                <!-- PLATFORM HEADER: INSTAGRAM REELS -->
                <div 
                  v-if="gallerySimulatorMode === 'instagram'" 
                  class="absolute top-10.5 inset-x-3.5 z-40 flex items-center justify-between text-white pointer-events-none drop-shadow-md"
                >
                  <div class="flex items-center gap-1 font-black text-sm tracking-tight text-white drop-shadow-md pointer-events-auto">
                    <span>Reels</span>
                    <Icon icon="solar:alt-arrow-down-bold" class="w-3 h-3 opacity-80" />
                  </div>
                  <div class="flex items-center gap-2 pointer-events-auto">
                    <div class="w-6 h-6 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white shadow-md">
                      <Icon icon="solar:camera-bold" class="w-3.5 h-3.5" />
                    </div>
                    <span class="badge badge-xs bg-black/60 border border-white/20 font-mono text-[9px] text-white">
                      {{ activeCarouselIndex + 1 }}/{{ postMediaList.length }}
                    </span>
                  </div>
                </div>

                <!-- PLATFORM HEADER: TIKTOK -->
                <div 
                  v-else-if="gallerySimulatorMode === 'tiktok'" 
                  class="absolute top-10.5 inset-x-3.5 z-40 flex items-center justify-between text-white pointer-events-none drop-shadow-md"
                >
                  <div class="flex items-center gap-1 pointer-events-auto">
                    <span class="badge badge-2xs bg-black/50 text-white border-white/20 font-bold px-1.5 py-1 text-[9px] gap-1">
                      <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                      LIVE
                    </span>
                  </div>
                  <div class="flex items-center gap-3 text-xs font-bold pointer-events-auto">
                    <span class="opacity-60 hover:opacity-100 cursor-pointer">Following</span>
                    <div class="relative flex flex-col items-center cursor-pointer">
                      <span class="text-white font-extrabold text-[13px]">For You</span>
                      <span class="w-4 h-0.5 bg-white rounded-full mt-0.5"></span>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 pointer-events-auto">
                    <div class="w-6 h-6 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white shadow-md">
                      <Icon icon="solar:magnifer-linear" class="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>

                <!-- MAIN FULL BLEED IMAGE -->
                <div class="relative w-full h-full flex items-center justify-center overflow-hidden">
                  <div 
                    v-if="currentCarouselPhoto && previewFitMode === 'contain'"
                    class="absolute inset-0 overflow-hidden pointer-events-none select-none opacity-35 scale-125 filter blur-xl"
                  >
                    <img :src="currentCarouselPhoto" class="w-full h-full object-cover" />
                  </div>
                  <img 
                    v-if="currentCarouselPhoto"
                    :src="currentCarouselPhoto" 
                    class="relative z-1 w-full h-full" 
                    :class="previewFitMode === 'contain' ? 'object-contain' : 'object-cover'"
                    alt="Zoomed Slide Photo"
                    @error="onSlideImageError"
                  />
                  <div v-else class="flex flex-col items-center justify-center opacity-40 text-xs">
                    <Icon icon="solar:gallery-linear" class="w-10 h-10 mb-1" />
                    <span>No image</span>
                  </div>

                  <!-- FLOATING INSTAGRAM STORY STICKER (UPPER SAFE ZONE) -->
                  <div 
                    v-if="showPhoneBurnIn && currentCarouselPhoto"
                    class="absolute top-24 left-4 right-18 pointer-events-none select-none z-30"
                  >
                    <div 
                      class="px-3 py-2 rounded-2xl backdrop-blur-md shadow-xl border transition-all inline-block max-w-full"
                      :style="{ backgroundColor: getOverlayBgStyle(selectedOverlayTheme, phoneBurnInCardOpacity) }"
                      :class="[
                        selectedOverlayTheme === 'tiktok' ? 'border-cyan-400/40 text-white' : 'border-white/25 text-white'
                      ]"
                    >
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="text-[9px] font-bold tracking-wide uppercase opacity-90 truncate">
                          📍 {{ currentTargetLocation }}
                        </span>
                        <span 
                          v-if="showBurnInPrice && currentSlideDisplayPrice !== null"
                          class="badge badge-2xs font-mono font-black"
                          :class="selectedOverlayTheme === 'tiktok' ? 'bg-[#fe2c55] text-white border-none' : 'badge-primary'"
                        >
                          ${{ currentSlideDisplayPrice.toFixed(2) }}
                        </span>
                      </div>
                      <h4 v-if="showBurnInTitle && currentSlideDisplayTitle" class="font-bold text-xs leading-tight line-clamp-1 mt-0.5">
                        {{ currentSlideDisplayTitle }}
                      </h4>
                    </div>
                  </div>

                  <!-- Carousel Flip Arrows -->
                  <button 
                    v-if="postMediaList.length > 1"
                    type="button" 
                    @click="prevCarouselSlide"
                    class="btn btn-circle btn-xs bg-black/60 hover:bg-black text-white absolute left-2 top-1/2 -translate-y-1/2 border border-white/20 z-30"
                    title="Previous slide"
                  >
                    ‹
                  </button>
                  <button 
                    v-if="postMediaList.length > 1"
                    type="button" 
                    @click="nextCarouselSlide"
                    class="btn btn-circle btn-xs bg-black/60 hover:bg-black text-white absolute right-2 top-1/2 -translate-y-1/2 border border-white/20 z-30"
                    title="Next slide"
                  >
                    ›
                  </button>
                </div>

                <!-- INSTAGRAM REELS RIGHT-SIDE ACTION RAIL -->
                <div 
                  v-if="gallerySimulatorMode === 'instagram'" 
                  class="absolute right-2 bottom-6 z-40 flex flex-col items-center gap-3 text-white drop-shadow-lg pointer-events-auto"
                >
                  <button type="button" @click="isModalLiked = !isModalLiked" class="flex flex-col items-center gap-0.5 active:scale-125 transition-transform">
                    <div class="w-9 h-9 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center border border-white/15 shadow-md">
                      <Icon icon="solar:heart-bold" class="w-5 h-5 transition-colors" :class="isModalLiked ? 'text-red-500 scale-110' : 'text-white'" />
                    </div>
                    <span class="text-[9px] font-bold font-mono">{{ (modalLikeCount + (isModalLiked ? 1 : 0)).toLocaleString() }}</span>
                  </button>
                  <button type="button" class="flex flex-col items-center gap-0.5 active:scale-110 transition-transform">
                    <div class="w-9 h-9 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center border border-white/15 shadow-md">
                      <Icon icon="solar:chat-round-dots-bold" class="w-4.5 h-4.5 text-white" />
                    </div>
                    <span class="text-[9px] font-bold font-mono">42</span>
                  </button>
                  <button type="button" class="flex flex-col items-center gap-0.5 active:scale-110 transition-transform">
                    <div class="w-9 h-9 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center border border-white/15 shadow-md">
                      <Icon icon="solar:plain-bold" class="w-4.5 h-4.5 text-white -rotate-12" />
                    </div>
                    <span class="text-[9px] font-bold font-mono">192</span>
                  </button>
                  <button type="button" @click="isModalSaved = !isModalSaved" class="flex flex-col items-center gap-0.5 active:scale-110 transition-transform">
                    <div class="w-9 h-9 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center border border-white/15 shadow-md">
                      <Icon icon="solar:bookmark-bold" class="w-4.5 h-4.5" :class="isModalSaved ? 'text-amber-400' : 'text-white'" />
                    </div>
                  </button>
                  <!-- Spinning Vinyl Record Disc -->
                  <div class="relative flex items-center justify-center mt-0.5">
                    <div class="w-9 h-9 rounded-full bg-neutral-950 border-2 border-neutral-800 p-0.5 flex items-center justify-center shadow-xl animate-spin" style="animation-duration: 4s;">
                      <div class="w-full h-full rounded-full bg-linear-to-tr from-amber-500 via-pink-600 to-purple-700 flex items-center justify-center p-1">
                        <div class="w-2.5 h-2.5 rounded-full bg-neutral-950 border border-white/40"></div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- TIKTOK RIGHT-SIDE ACTION RAIL -->
                <div 
                  v-else-if="gallerySimulatorMode === 'tiktok'" 
                  class="absolute right-2 bottom-6 z-40 flex flex-col items-center gap-3 text-white drop-shadow-lg pointer-events-auto"
                >
                  <div class="relative mb-1">
                    <div class="w-9.5 h-9.5 rounded-full border-2 border-white overflow-hidden bg-neutral-900 shadow-lg flex items-center justify-center text-xs font-black">
                      {{ (authorAccountHandle || 'RC').slice(0, 2).toUpperCase() }}
                    </div>
                    <button 
                      type="button" 
                      @click="isModalFollowing = !isModalFollowing" 
                      class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#fe2c55] text-white flex items-center justify-center text-xs font-bold shadow-md"
                    >
                      <span v-if="!isModalFollowing">+</span>
                      <span v-else class="text-[9px]">✓</span>
                    </button>
                  </div>
                  <button type="button" @click="isModalLiked = !isModalLiked" class="flex flex-col items-center gap-0.5 active:scale-125 transition-transform">
                    <div class="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-md">
                      <Icon icon="solar:heart-bold" class="w-5.5 h-5.5 transition-colors" :class="isModalLiked ? 'text-[#fe2c55] scale-110 drop-shadow-[0_0_8px_#fe2c55]' : 'text-white'" />
                    </div>
                    <span class="text-[9px] font-bold font-mono">14.2K</span>
                  </button>
                  <button type="button" class="flex flex-col items-center gap-0.5 active:scale-110 transition-transform">
                    <div class="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-md">
                      <Icon icon="solar:chat-round-dots-bold" class="w-5 h-5 text-white" />
                    </div>
                    <span class="text-[9px] font-bold font-mono">182</span>
                  </button>
                  <button type="button" @click="isModalSaved = !isModalSaved" class="flex flex-col items-center gap-0.5 active:scale-110 transition-transform">
                    <div class="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-md">
                      <Icon icon="solar:bookmark-bold" class="w-5 h-5" :class="isModalSaved ? 'text-amber-400' : 'text-white'" />
                    </div>
                    <span class="text-[9px] font-bold font-mono">1,420</span>
                  </button>
                  <button type="button" class="flex flex-col items-center gap-0.5 active:scale-110 transition-transform">
                    <div class="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-md">
                      <Icon icon="solar:share-bold" class="w-5 h-5 text-white" />
                    </div>
                    <span class="text-[9px] font-bold font-mono">482</span>
                  </button>
                  <!-- TikTok Spinning Vinyl Record Disc -->
                  <div class="relative flex items-center justify-center mt-0.5">
                    <div class="w-9 h-9 rounded-full bg-neutral-950 border-2 border-neutral-800 p-0.5 flex items-center justify-center shadow-xl shadow-cyan-500/20 animate-spin" style="animation-duration: 3.5s;">
                      <div class="w-full h-full rounded-full bg-linear-to-tr from-[#fe2c55] via-neutral-900 to-[#25f4ee] flex items-center justify-center p-1">
                        <div class="w-2 rounded-full bg-neutral-950 border border-white/40 h-2"></div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- INSTAGRAM REELS BOTTOM-LEFT CREATOR OVERLAY -->
                <div 
                  v-if="gallerySimulatorMode === 'instagram'" 
                  class="absolute left-3 bottom-3 right-16 z-40 space-y-1.5 text-left text-white drop-shadow-md pointer-events-auto"
                >
                  <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-full p-0.5 bg-linear-to-tr from-amber-400 via-pink-500 to-purple-600 shrink-0 shadow-md">
                      <div class="w-full h-full rounded-full bg-neutral-950 flex items-center justify-center text-[10px] font-black text-white">
                        {{ (authorAccountHandle || 'RC').slice(0, 2).toUpperCase() }}
                      </div>
                    </div>
                    <div class="flex items-center gap-1 min-w-0">
                      <span class="font-bold text-xs text-white truncate">@{{ authorAccountHandle || 'resalecommand' }}</span>
                      <Icon icon="solar:verified-check-bold" class="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    </div>
                    <button 
                      type="button" 
                      @click="isModalFollowing = !isModalFollowing" 
                      class="btn btn-2xs rounded-full font-bold px-2 py-0 h-5 text-[10px] shrink-0"
                      :class="isModalFollowing ? 'btn-ghost bg-white/20 text-white' : 'btn-outline border-white/80 text-white hover:bg-white hover:text-black'"
                    >
                      {{ isModalFollowing ? 'Following' : 'Follow' }}
                    </button>
                  </div>
                  <div class="space-y-0.5 pr-2">
                    <p class="text-[12px] font-bold text-white leading-tight font-sans drop-shadow-xs line-clamp-1">
                      {{ currentSlideDisplayTitle || 'Curated Relic' }}
                      <span v-if="currentSlideDisplayPrice && Number(currentSlideDisplayPrice) > 0" class="text-pink-300 ml-1 font-mono font-bold">• ${{ Number(currentSlideDisplayPrice).toFixed(2) }}</span>
                    </p>
                    <p class="text-[11px] text-white/90 leading-snug line-clamp-2 drop-shadow-xs">
                      {{ currentSlideDisplayQuote || 'Fresh arrival curated at ' + (currentTargetLocation || 'Memory Den') + '. Inquire or DM to claim before it sells!' }}
                    </p>
                    <p class="text-[10px] font-medium text-white/70 font-sans tracking-tight">
                      #vintage #resale #{{ (currentTargetLocation || 'memoryden').toLowerCase().replace(/[^a-z0-9]/g, '') }} #curatedfinds
                    </p>
                  </div>
                  <div class="flex items-center gap-1.5 text-[9px] opacity-95 font-sans bg-black/55 backdrop-blur-md px-2.5 py-1 rounded-full w-fit max-w-[210px] border border-white/15 overflow-hidden shadow-xs">
                    <Icon icon="solar:music-note-2-bold" class="w-3 h-3 text-pink-400 shrink-0 animate-pulse" />
                    <span class="truncate font-medium">Original Audio • @{{ authorAccountHandle || 'resalecommand' }}</span>
                  </div>
                </div>

                <!-- TIKTOK BOTTOM-LEFT CREATOR OVERLAY -->
                <div 
                  v-else-if="gallerySimulatorMode === 'tiktok'" 
                  class="absolute left-3 bottom-3 right-16 z-40 space-y-1.5 text-left text-white drop-shadow-md pointer-events-auto"
                >
                  <div class="flex items-center gap-1.5">
                    <span class="font-bold text-sm text-white drop-shadow-md">@{{ authorAccountHandle || 'resalecommand' }}</span>
                    <Icon icon="solar:verified-check-bold" class="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <div class="space-y-0.5 pr-2">
                    <p class="text-[12px] font-bold text-white leading-tight font-sans drop-shadow-xs line-clamp-1">
                      {{ currentSlideDisplayTitle || 'Curated Relic' }}
                      <span v-if="currentSlideDisplayPrice && Number(currentSlideDisplayPrice) > 0" class="text-cyan-300 ml-1 font-mono font-bold">• ${{ Number(currentSlideDisplayPrice).toFixed(2) }}</span>
                    </p>
                    <p class="text-[11px] text-white/90 leading-snug line-clamp-2 drop-shadow-xs">
                      {{ currentSlideDisplayQuote || 'Drop alert! Available now at ' + (currentTargetLocation || 'Memory Den') }}
                    </p>
                    <p class="text-[11px] font-bold text-cyan-200 tracking-tight">
                      #fyp #resale #thrifttok #viral #vintage
                    </p>
                  </div>
                  <div class="flex items-center gap-1.5 text-[10px] text-white/90 font-medium">
                    <Icon icon="solar:music-library-bold" class="w-3.5 h-3.5 text-white shrink-0" />
                    <span class="truncate">♫ Original Sound - @{{ authorAccountHandle || 'resalecommand' }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 2. 1:1 INSTAGRAM FEED POST CARD SIMULATOR -->
            <div v-else class="w-full max-w-[360px] sm:max-w-[380px] bg-neutral-950 text-white rounded-2xl border border-neutral-800 shadow-2xl overflow-hidden select-none">
              <!-- IG FEED HEADER -->
              <div class="px-3.5 py-2.5 flex items-center justify-between border-b border-neutral-800/80">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-full p-0.5 bg-linear-to-tr from-amber-400 via-pink-500 to-purple-600 shrink-0">
                    <div class="w-full h-full rounded-full bg-neutral-950 flex items-center justify-center text-[10px] font-black text-white">
                      {{ (authorAccountHandle || 'RC').slice(0, 2).toUpperCase() }}
                    </div>
                  </div>
                  <div class="leading-tight">
                    <div class="flex items-center gap-1">
                      <span class="font-bold text-xs">@{{ authorAccountHandle || 'resalecommand' }}</span>
                      <Icon icon="solar:verified-check-bold" class="w-3.5 h-3.5 text-sky-400" />
                    </div>
                    <p class="text-[10px] text-neutral-400 font-sans">📍 {{ currentTargetLocation || 'Memory Den' }}</p>
                  </div>
                </div>
                <button type="button" class="text-neutral-400 hover:text-white p-1">
                  <Icon icon="solar:menu-dots-bold" class="w-4 h-4" />
                </button>
              </div>

              <!-- SQUARE 1:1 PHOTO CONTAINER -->
              <div class="relative aspect-square w-full bg-black overflow-hidden group">
                <img 
                  v-if="currentCarouselPhoto"
                  :src="currentCarouselPhoto" 
                  class="w-full h-full object-cover" 
                  alt="Zoomed Slide Photo"
                  @error="onSlideImageError"
                />
                <!-- Slide indicator pill -->
                <div class="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-mono font-bold text-white border border-white/10 z-20">
                  {{ activeCarouselIndex + 1 }}/{{ postMediaList.length }}
                </div>
                <!-- Navigation arrows -->
                <button 
                  v-if="postMediaList.length > 1"
                  type="button" 
                  @click="prevCarouselSlide" 
                  class="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/90 z-20"
                >‹</button>
                <button 
                  v-if="postMediaList.length > 1"
                  type="button" 
                  @click="nextCarouselSlide" 
                  class="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/90 z-20"
                >›</button>
              </div>

              <!-- IG FEED ACTION ROW -->
              <div class="px-3.5 pt-2.5 pb-1 flex items-center justify-between">
                <div class="flex items-center gap-3.5">
                  <button type="button" @click="isModalLiked = !isModalLiked" class="transition-transform active:scale-125">
                    <Icon :icon="isModalLiked ? 'solar:heart-bold' : 'solar:heart-linear'" class="w-6 h-6 transition-colors" :class="isModalLiked ? 'text-red-500 scale-110' : 'text-white'" />
                  </button>
                  <button type="button" class="transition-transform active:scale-110">
                    <Icon icon="solar:chat-round-dots-linear" class="w-6 h-6 text-white" />
                  </button>
                  <button type="button" class="transition-transform active:scale-110">
                    <Icon icon="solar:plain-linear" class="w-5.5 h-5.5 text-white -rotate-12" />
                  </button>
                </div>
                <div class="flex items-center gap-1">
                  <span 
                    v-for="(_, idx) in postMediaList.slice(0, 5)" 
                    :key="idx" 
                    class="w-1.5 h-1.5 rounded-full transition-all"
                    :class="idx === activeCarouselIndex ? 'bg-sky-400 scale-125' : 'bg-neutral-600'"
                  ></span>
                </div>
                <button type="button" @click="isModalSaved = !isModalSaved" class="transition-transform active:scale-110">
                  <Icon :icon="isModalSaved ? 'solar:bookmark-bold' : 'solar:bookmark-linear'" class="w-5.5 h-5.5" :class="isModalSaved ? 'text-amber-400' : 'text-white'" />
                </button>
              </div>

              <!-- IG FEED CAPTION & LIKES -->
              <div class="px-3.5 pb-3 text-xs space-y-1">
                <div class="font-bold text-white text-[11px]">
                  Liked by <span class="font-black text-pink-300">dusty_tiger</span> and <span>{{ (modalLikeCount + (isModalLiked ? 1 : 0)).toLocaleString() }} others</span>
                </div>
                <p class="text-[11px] leading-tight text-neutral-200">
                  <span class="font-bold text-white mr-1">@{{ authorAccountHandle || 'resalecommand' }}</span>
                  <span class="font-semibold">{{ currentSlideDisplayTitle }}</span>
                  <span v-if="currentSlideDisplayPrice && Number(currentSlideDisplayPrice) > 0" class="text-pink-300 font-mono ml-1 font-bold">(${{ Number(currentSlideDisplayPrice).toFixed(2) }})</span>
                </p>
                <p class="text-[10px] text-neutral-400 line-clamp-2">
                  {{ currentSlideDisplayQuote || generatedCaption || 'Swipe through the slides to inspect details. DM to hold or purchase!' }}
                </p>
                <p class="text-[9px] text-neutral-500 uppercase font-mono pt-0.5">2 HOURS AGO</p>
              </div>
            </div>

            <!-- Slide Quick Position Counter & Framing Controls -->
            <div class="text-xs font-mono opacity-80 flex items-center justify-between w-full max-w-[560px] flex-wrap gap-2">
              <div class="flex items-center gap-1.5">
                <span>Slide {{ activeCarouselIndex + 1 }} of {{ postMediaList.length }}</span>
                <span>•</span>
                <button 
                  type="button" 
                  @click="openReelStudio(activeCarouselIndex)" 
                  class="text-primary font-bold hover:underline flex items-center gap-1"
                >
                  <Icon icon="solar:play-circle-bold" class="w-3.5 h-3.5" />
                  <span>Play Reel 🎬</span>
                </button>
              </div>

              <!-- Quick Framing Controls (1:1 / 4:5 / 9:16 + Fit Mode) -->
              <div class="flex items-center gap-1.5">
                <div class="join border border-base-300 rounded-xl overflow-hidden bg-base-100 p-0.5">
                  <button 
                    type="button" 
                    v-for="ar in (['1:1', '4:5', '9:16'] as const)" 
                    :key="ar" 
                    @click="previewAspectRatio = ar" 
                    class="join-item btn btn-2xs font-mono font-bold" 
                    :class="previewAspectRatio === ar ? 'btn-primary' : 'btn-ghost'"
                  >
                    {{ ar }}
                  </button>
                </div>
                <button 
                  type="button" 
                  @click="previewFitMode = previewFitMode === 'contain' ? 'cover' : 'contain'" 
                  class="btn btn-2xs font-bold rounded-xl"
                  :class="previewFitMode === 'contain' ? 'btn-secondary' : 'btn-outline border-base-300'"
                >
                  {{ previewFitMode === 'contain' ? 'Fit Whole' : 'Fill' }}
                </button>
              </div>
            </div>
          </div>

          <!-- RIGHT: Slide Image Settings Panel (5 cols) -->
          <div class="lg:col-span-5 space-y-4 bg-base-200/40 p-4 sm:p-5 rounded-3xl border border-base-300">
            <div class="flex items-center justify-between pb-2 border-b border-base-300">
              <span class="font-black text-xs uppercase tracking-wider text-base-content/80 flex items-center gap-1.5">
                <Icon icon="solar:slider-vertical-bold" class="w-4 h-4 text-primary" />
                <span>Slide #{{ activeCarouselIndex + 1 }} Image Settings</span>
              </span>

              <!-- Set Cover Button -->
              <button 
                v-if="activeCarouselIndex !== 0"
                type="button" 
                @click="setSlideAsCover(activeCarouselIndex)" 
                class="btn btn-xs btn-warning font-bold gap-1 rounded-xl shadow-xs"
                title="Make this slide the Cover photo"
              >
                ⭐ Set as Cover
              </button>
              <span v-else class="badge badge-xs badge-warning font-black">⭐ Main Cover</span>
            </div>

            <!-- Overlay Toggles: Text & Price (Price default OFF behind toggle!) -->
            <div class="grid grid-cols-2 gap-2">
              <button 
                type="button" 
                class="btn btn-xs rounded-xl font-bold gap-1 shadow-xs border border-base-300"
                :class="showPhoneBurnIn ? 'btn-secondary text-secondary-content' : 'btn-ghost bg-base-100'"
                @click="showPhoneBurnIn = !showPhoneBurnIn"
              >
                <Icon icon="solar:text-bold" class="w-3.5 h-3.5" />
                <span>{{ showPhoneBurnIn ? 'Text Overlay: ON' : 'Text Overlay: OFF' }}</span>
              </button>

              <button 
                type="button" 
                class="btn btn-xs rounded-xl font-bold gap-1 shadow-xs border border-base-300"
                :class="showBurnInPrice ? 'btn-accent text-accent-content' : 'btn-ghost bg-base-100'"
                @click="showBurnInPrice = !showBurnInPrice"
                title="Toggle Price overlay on photo"
              >
                <Icon icon="solar:tag-price-bold" class="w-3.5 h-3.5" />
                <span>{{ showBurnInPrice ? 'Price: ON' : 'Price: OFF' }}</span>
              </button>
            </div>

            <!-- Theme Selector -->
            <div class="space-y-1.5">
              <label class="text-[11px] font-bold opacity-75">Overlay Typography Theme</label>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <button 
                  type="button" 
                  v-for="(meta, tKey) in OVERLAY_THEMES" 
                  :key="tKey"
                  class="btn btn-2xs rounded-xl font-bold transition-all gap-1 justify-start"
                  :class="selectedOverlayTheme === tKey ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost bg-base-100'"
                  @click="selectedOverlayTheme = tKey"
                >
                  <span>{{ meta.emoji }}</span>
                  <span class="truncate">{{ meta.label }}</span>
                </button>
              </div>
            </div>

            <!-- Banner Opacity Slider & Quick Chips -->
            <div class="space-y-1.5 bg-base-100/60 p-2.5 rounded-2xl border border-base-300">
              <div class="flex items-center justify-between">
                <label class="text-[11px] font-bold opacity-75 flex items-center gap-1">
                  <Icon icon="solar:sun-2-bold" class="w-3.5 h-3.5 text-warning" />
                  <span>Banner Opacity</span>
                </label>
                <span class="text-xs font-mono font-bold text-primary">{{ Math.round(phoneBurnInCardOpacity * 100) }}%</span>
              </div>
              <div class="flex items-center gap-2">
                <input 
                  type="range" 
                  min="0.25" 
                  max="1.0" 
                  step="0.05" 
                  v-model.number="phoneBurnInCardOpacity" 
                  class="range range-xs range-primary flex-1" 
                />
                <div class="flex items-center gap-1 shrink-0">
                  <button 
                    type="button" 
                    v-for="op in [0.50, 0.65, 0.80, 0.95]" 
                    :key="op"
                    @click="phoneBurnInCardOpacity = op"
                    class="btn btn-2xs rounded-lg font-mono font-bold px-1.5"
                    :class="Math.abs(phoneBurnInCardOpacity - op) < 0.03 ? 'btn-secondary text-secondary-content' : 'btn-ghost bg-base-100'"
                  >
                    {{ Math.round(op * 100) }}%
                  </button>
                </div>
              </div>
            </div>

            <!-- Slide Title & Price Inputs -->
            <div class="space-y-2">
              <div class="space-y-1">
                <label class="text-[11px] font-bold opacity-75">Slide Item Title</label>
                <input 
                  v-model="currentSlideDisplayTitle" 
                  placeholder="Item Title (burned onto photo)..."
                  class="input input-sm input-bordered w-full rounded-xl bg-base-100 font-bold text-xs"
                />
              </div>

              <div class="space-y-1">
                <label class="text-[11px] font-bold opacity-75">Slide Price ($)</label>
                <div class="relative">
                  <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs opacity-50 font-bold">$</span>
                  <input 
                    type="number" 
                    step="0.01" 
                    v-model.number="currentSlideDisplayPrice" 
                    placeholder="Price (hidden unless Price toggle is ON)"
                    class="input input-sm input-bordered w-full pl-6 rounded-xl bg-base-100 font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            <!-- Slide Micro-Quote Input -->
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <label class="text-[11px] font-bold opacity-75">Slide Micro-Narrative Quote</label>
                <button 
                  type="button" 
                  @click="autoAssignDescriptions" 
                  :disabled="!generatedCaption"
                  class="text-[10px] text-secondary font-bold hover:underline flex items-center gap-0.5"
                  title="Extract quote from generated caption"
                >
                  <Icon icon="solar:magic-stick-3-bold" class="w-3 h-3" />
                  <span>✨ Auto-Extract</span>
                </button>
              </div>
              <textarea 
                v-model="currentSlideDisplayQuote" 
                rows="3" 
                placeholder="Micro-narrative quote burned onto this photo..."
                class="textarea textarea-bordered textarea-sm w-full rounded-xl bg-base-100 resize-none leading-relaxed text-xs"
              ></textarea>
            </div>

            <!-- Slide Reordering & Deletion Actions -->
            <div class="flex items-center justify-between pt-2 border-t border-base-300 gap-2">
              <div class="flex items-center gap-1.5">
                <button 
                  type="button" 
                  @click="moveSlideLeft(activeCarouselIndex)" 
                  :disabled="activeCarouselIndex === 0"
                  class="btn btn-xs btn-outline border-base-300 rounded-xl font-bold gap-1"
                  title="Move slide earlier"
                >
                  ◀ Earlier
                </button>
                <button 
                  type="button" 
                  @click="moveSlideRight(activeCarouselIndex)" 
                  :disabled="activeCarouselIndex === postMediaList.length - 1"
                  class="btn btn-xs btn-outline border-base-300 rounded-xl font-bold gap-1"
                  title="Move slide later"
                >
                  Later ▶
                </button>
              </div>

              <button 
                type="button" 
                @click="removeSlide(activeCarouselIndex)" 
                class="btn btn-xs btn-ghost text-error hover:bg-error/10 font-bold gap-1 rounded-xl"
                title="Remove this slide from reel"
              >
                <Icon icon="solar:trash-bin-trash-bold" class="w-3.5 h-3.5" />
                <span>Remove Slide</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Bottom Gallery Thumbnail Strip -->
        <div class="px-4 py-3 sm:px-6 bg-base-200/80 border-t border-base-300 shrink-0 space-y-1.5">
          <div class="flex justify-between items-center text-[11px] font-bold opacity-75">
            <span>All Gallery Slides (Click any to inspect &amp; edit settings)</span>
            <span class="font-mono text-[10px]">{{ activeCarouselIndex + 1 }} / {{ postMediaList.length }}</span>
          </div>

          <div class="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
            <div 
              v-for="(slide, idx) in postMediaList" 
              :key="slide.id || idx"
              draggable="true"
              @dragstart="handleSlideDragStart(idx, $event)"
              @dragover="handleSlideDragOver(idx, $event)"
              @dragleave="handleSlideDragLeave(idx)"
              @drop="handleSlideDrop(idx, $event)"
              @dragend="handleSlideDragEnd"
              class="relative aspect-square w-14 sm:w-16 rounded-xl overflow-hidden border-2 bg-base-100 cursor-grab active:cursor-grabbing transition-all shadow-xs shrink-0 group select-none"
              :class="[
                activeCarouselIndex === idx ? 'border-primary ring-2 ring-primary/40' : 'border-base-300 hover:border-primary/50',
                draggedSlideIndex === idx ? 'opacity-30 scale-95 border-dashed border-primary' : '',
                dragOverSlideIndex === idx && draggedSlideIndex !== idx ? 'border-secondary ring-2 ring-secondary scale-105 shadow-md' : ''
              ]"
              @click="activeCarouselIndex = idx"
              :title="(slide.title || 'Slide ' + (idx + 1)) + ' (Drag to reorder)'"
            >
              <img :src="slide.url" class="w-full h-full object-cover pointer-events-none" loading="lazy" @error="onSlideImageError" />
              <span 
                class="badge badge-2xs absolute bottom-0.5 left-0.5 font-mono font-bold text-[8px] shadow-xs border-none"
                :class="idx === 0 ? 'badge-warning text-warning-content ring-1 ring-black/40' : 'badge-neutral opacity-85'"
              >
                {{ idx === 0 ? '⭐ 1st' : '#' + (idx + 1) }}
              </span>
              <button 
                v-if="idx !== 0"
                type="button" 
                @click.stop="setSlideAsCover(idx)"
                class="absolute top-0.5 left-0.5 px-1 py-0.5 rounded-md bg-warning text-warning-content font-black text-[8px] opacity-0 group-hover:opacity-100 transition-opacity shadow-xs"
                title="Make this slide the First / Cover photo"
              >
                ⭐ 1st
              </button>
            </div>

            <!-- Upload Tile inside modal -->
            <div 
              class="relative aspect-square w-14 sm:w-16 rounded-xl border-2 border-dashed border-base-300 hover:border-primary bg-base-100/50 hover:bg-primary/5 cursor-pointer flex flex-col items-center justify-center gap-0.5 transition-all text-base-content/60 hover:text-primary active:scale-95 shrink-0"
              @click="triggerUploadInput"
              title="Upload photo"
            >
              <Icon icon="solar:add-circle-bold" class="w-4 h-4" />
              <span class="text-[9px] font-bold">+ Add</span>
            </div>
          </div>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="button" @click="closeGalleryModal">close</button>
      </form>
    </dialog>

  </div>
</div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, defineAsyncComponent } from 'vue';
import { Icon } from '@iconify/vue';
import DropcastHubDashboard from './DropcastHubDashboard.vue';
import ItemThumbnail from '../common/ItemThumbnail.vue';
import BottomActionDock from '../common/BottomActionDock.vue';
import { useDropcasts } from '../../composables/useDropcasts';
import { type Dropcast, type CastStatus, CAST_TYPE_META, CAST_STATUS_META, SEED_DROPCASTS, getSavedDropcasts } from '../../lib/dropcastModel';
import { useManifest } from '../../composables/useManifest';
import { usePurchases } from '../../composables/usePurchases';
import { useInventory } from '../../composables/useInventory';
import { addToast } from '../../stores/toast';
import { databases, Query } from '../../lib/appwrite';
import { DB_ID, getCollectionId } from '../../lib/inventory';
import { 
  downloadItemsAsZip, 
  downloadMediaSlidesAsZip,
  downloadSingleImage, 
  getItemImageUrls, 
  type SocialStudioItem,
  type PostMediaSlide 
} from '../../lib/socialMediaStudio';
import { getItemImageUrl } from '../../composables/useInventoryFilters';
import { resolveItemImageUrls } from '../../lib/inventory';
import { 
  getAllLocationPhotos, 
  saveLocationPhoto, 
  deleteLocationPhoto, 
  type LocationPhoto 
} from '../../lib/locationPhotos';
import ScannerWidget from '../common/ScannerWidget.vue';
import SocialItemPickerModal from './SocialItemPickerModal.vue';
import PhotoGalleryManager from '../common/PhotoGalleryManager.vue';
import AnimatedReelPlayerModal from './AnimatedReelPlayerModal.vue';
import SlideImageEditorModal from './SlideImageEditorModal.vue';
import { 
  parseItemDescriptionsFromCaption, 
  OVERLAY_THEMES, 
  OVERLAY_POSITIONS, 
  type OverlayTheme, 
  type OverlayPosition 
} from '../../lib/slideCanvasEngine';
import { SOCIAL_PERSONAS, generateDynamicFallbackPost } from '../../lib/social-prompts';

const props = withDefaults(defineProps<{
  initialCastId?: string;
}>(), {
  initialCastId: ''
});

// Async Lazy-Loaded Canonical Edit Drawer
const ItemDrawer = defineAsyncComponent(() => import('../common/ItemDrawer.vue'));

const {
  dropcastsList,
  activeCast,
  currentView,
  openStudio,
  openStudioById,
  returnToHub,
  updateActiveCast,
  saveActiveCast,
  startQuickCast,
  startCustomCast,
  unstageItemFromCast,
  clearCastStaging
} = useDropcasts();

const studioCastTitle = ref(activeCast.value?.title || '');

// Keep studioCastTitle in sync whenever activeCast changes or initializes
watch(
  () => activeCast.value?.title,
  (newTitle) => {
    if (newTitle !== undefined) {
      studioCastTitle.value = newTitle;
    }
  },
  { immediate: true }
);

// When switching casts, update title and load the cast's items, slides, and tone into studio
watch(
  () => activeCast.value?.id,
  (newId, oldId) => {
    if (activeCast.value?.title) {
      studioCastTitle.value = activeCast.value.title;
    }
    if (newId && activeCast.value && newId !== oldId) {
      loadFromCast(activeCast.value);
    }
  }
);

// When switching from hub to studio view, ensure studio state is hydrated from activeCast
watch(
  () => currentView.value,
  (view) => {
    if (view === 'studio' && activeCast.value) {
      loadFromCast(activeCast.value);
    }
  }
);

const { 
  allDrafts, 
  recentPlacedManifests, 
  fetchAllDrafts, 
  switchActiveManifest 
} = useManifest();

const { 
  purchases, 
  fetchPurchases, 
  loading: loadingPurchases 
} = usePurchases();

const { 
  inventoryItems, 
  fetchInventory, 
  loading: loadingInventory 
} = useInventory();

// Studio State
const authorAccountHandle = ref<string>('resalecommand');
const boothLocationInput = ref<string>('Memory Den');
const includePrices = ref<boolean>(false); // Price hidden by default behind toggle
const customNotes = ref<string>('');
const isGenerating = ref<boolean>(false);
const isZipping = ref<boolean>(false);
const zipProgressPercent = ref<number>(0);
const zipProgressMessage = ref<string>('');
const isCopied = ref<boolean>(false);
const isLiked = ref<boolean>(false);
const generatedCaption = ref<string>('');
const lastSource = ref<string>('');
const isCaptionLocked = ref<boolean>(false); // Lock manual caption edits from AI overwrite

function toggleCaptionLock() {
  isCaptionLocked.value = !isCaptionLocked.value;
  addToast({
    type: isCaptionLocked.value ? 'warning' : 'info',
    message: isCaptionLocked.value ? '🔒 Social caption locked! Manual edits protected.' : '🔓 Social caption unlocked for AI generation.'
  });
}

// Slide Image Editor & AI Enhancer Tray Modal
const isImageEditorOpen = ref<boolean>(false);
const editingSlideIndex = ref<number>(0);
const editorInitialTab = ref<'crop' | 'ai' | 'text'>('crop');

function openImageEditor(index?: number, tab: 'crop' | 'ai' | 'text' = 'crop') {
  editorInitialTab.value = tab;
  if (typeof index === 'number' && index >= 0 && index < postMediaList.value.length) {
    editingSlideIndex.value = index;
  } else {
    editingSlideIndex.value = activeCarouselIndex.value;
  }
  isImageEditorOpen.value = true;
  // NOTE: We deliberately do NOT change activeCarouselIndex so the background slide is never switched!
}

function openWatermarkEditor(index?: number) {
  openImageEditor(index, 'crop');
}

function handleUpdateSlide(payload: { index: number; newUrl: string; originalUrl?: string; title?: string; price?: number; description?: string }) {
  if (payload.index >= 0 && payload.index < postMediaList.value.length) {
    const item = postMediaList.value[payload.index];
    if (!item.originalUrl) {
      item.originalUrl = item.url;
    }
    item.url = payload.newUrl;
    if (payload.originalUrl) item.originalUrl = payload.originalUrl;
    if (payload.title !== undefined) item.title = payload.title;
    if (payload.price !== undefined) item.price = payload.price;
    if (payload.description !== undefined) item.description = payload.description;
    syncActiveCastState();
  }
}

function handleUpdateAllSlides(payload: { newUrls: string[] }) {
  payload.newUrls.forEach((url, i) => {
    if (postMediaList.value[i]) {
      postMediaList.value[i].url = url;
    }
  });
  syncActiveCastState();
}

// Fullscreen Gallery & Slide Settings Studio Modal
const isGalleryModalOpen = ref<boolean>(false);
function openGalleryModal(index?: number) {
  openImageEditor(typeof index === 'number' ? index : activeCarouselIndex.value);
}
function closeGalleryModal() {
  isGalleryModalOpen.value = false;
  syncActiveCastState();
}

// Global zoom helper: when ANY photo is clicked to zoom, open in Slide & Image Editor Tray
const previewZoomUrl = ref<string | null>(null);
function openZoomPreview(url?: string) {
  if (url) {
    let idx = postMediaList.value.findIndex(s => s.url === url);
    if (idx === -1) {
      // Find matching staged item to carry over title and price if available
      const matchedItem = studioItems.value.find(it => {
        const itemPhotos = getItemImageUrls(it);
        return itemPhotos.includes(url) || resolveItemPhoto(it) === url;
      });
      postMediaList.value.push({
        id: `slide_zoom_${Date.now()}`,
        type: postMediaList.value.length === 0 ? 'item_hero' : 'item_gallery',
        url: url,
        title: matchedItem?.title || 'Item Photo',
        price: Number(matchedItem?.boutiquePrice || matchedItem?.resalePrice || matchedItem?.price || 0)
      });
      idx = postMediaList.value.length - 1;
      syncActiveCastState();
    }
    openImageEditor(idx);
    return;
  }
  openImageEditor(activeCarouselIndex.value);
}
function closeZoomPreview() {
  isImageEditorOpen.value = false;
  isGalleryModalOpen.value = false;
}

// Personas
const personaPresets = SOCIAL_PERSONAS;
const selectedPersonaId = ref<string>('lestat');
const customTonePrompt = ref<string>(personaPresets[0].prompt);
const activePersonaLabel = computed(() => personaPresets.find(p => p.id === selectedPersonaId.value)?.label || 'Custom Tone');
function applyPersona(p: typeof personaPresets[0]) {
  selectedPersonaId.value = p.id;
  customTonePrompt.value = p.prompt;
  if (!isCaptionLocked.value) {
    generateCaption();
  } else {
    addToast({ type: 'info', message: `Persona set to ${p.label}. (Caption locked, regenerate when unlocked)` });
  }
}

// Platforms
const platforms = [
  { id: 'story', label: 'IG Reels', icon: 'solar:clapperboard-play-bold', aspect: '9:16' },
  { id: 'tiktok', label: 'TikTok', icon: 'solar:music-library-bold', aspect: '9:16' },
  { id: 'instagram', label: 'IG Post (1:1)', icon: 'solar:instagram-bold', aspect: '1:1' },
  { id: 'facebook', label: 'Facebook', icon: 'solar:facebook-bold', aspect: '1:1' }
];
const selectedPlatform = ref<string>('story');

function onSelectPlatform(id: string) {
  selectedPlatform.value = id;
  if (id === 'story') {
    selectedOverlayTheme.value = 'instagram';
    previewAspectRatio.value = '9:16';
  } else if (id === 'tiktok') {
    selectedOverlayTheme.value = 'tiktok';
    previewAspectRatio.value = '9:16';
  } else if (id === 'instagram') {
    selectedOverlayTheme.value = 'instagram';
    previewAspectRatio.value = '1:1';
  } else if (id === 'facebook') {
    previewAspectRatio.value = '1:1';
  }
}

// Gallery & Zoom Studio Simulator State
const gallerySimulatorMode = ref<'instagram' | 'tiktok' | 'feed'>('instagram');
const isModalLiked = ref(false);
const modalLikeCount = ref(1842);
const isModalSaved = ref(false);
const isModalFollowing = ref(false);

function setGallerySimulatorMode(mode: 'instagram' | 'tiktok' | 'feed') {
  gallerySimulatorMode.value = mode;
  if (mode === 'instagram') {
    selectedOverlayTheme.value = 'instagram';
    previewAspectRatio.value = '9:16';
  } else if (mode === 'tiktok') {
    selectedOverlayTheme.value = 'tiktok';
    previewAspectRatio.value = '9:16';
  } else if (mode === 'feed') {
    selectedOverlayTheme.value = 'instagram';
    previewAspectRatio.value = '1:1';
  }
}

// Media Reel & Carousel
const postMediaList = ref<PostMediaSlide[]>([]);
const activeCarouselIndex = ref<number>(0);
const isReelPlayerOpen = ref<boolean>(false);
const reelStudioInitialIndex = ref<number>(0);
const selectedOverlayTheme = ref<OverlayTheme>('instagram');

// Picture Framing & Aspect Ratio in Viewport
const previewFitMode = ref<'contain' | 'cover'>('contain');
const previewAspectRatio = ref<'1:1' | '4:5' | '9:16'>('1:1');

// Burn-In Adjustments for Live Phone Preview
const showPhoneBurnIn = ref<boolean>(true);
const phoneBurnInPosition = ref<OverlayPosition>('bottom_card');
const phoneBurnInCardOpacity = ref<number>(0.75);

function getOverlayBgStyle(theme: OverlayTheme, opacity: number): string {
  const safeOpacity = Math.max(0.1, Math.min(1.0, opacity ?? 0.75));
  switch (theme) {
    case 'instagram':
      return `rgba(18, 18, 24, ${safeOpacity})`;
    case 'tiktok':
      return `rgba(4, 4, 6, ${safeOpacity})`;
    case 'antique':
      return `rgba(27, 21, 17, ${safeOpacity})`;
    case 'cyberpunk':
      return `rgba(8, 8, 12, ${safeOpacity})`;
    case 'minimalist':
      return `rgba(12, 12, 12, ${safeOpacity})`;
    case 'editorial':
      return `rgba(255, 255, 255, ${safeOpacity})`;
    case 'boutique':
      return `rgba(35, 18, 11, ${safeOpacity})`;
    default:
      return `rgba(15, 15, 15, ${safeOpacity})`;
  }
}

function cycleOpacity() {
  const steps = [0.50, 0.65, 0.80, 0.95];
  const current = phoneBurnInCardOpacity.value;
  const next = steps.find(s => s > current + 0.04) ?? steps[0];
  phoneBurnInCardOpacity.value = next;
}

const showBurnInTitle = ref<boolean>(true);
const showBurnInPrice = ref<boolean>(false); // Price hidden by default on photos behind toggle
const showBurnInQuote = ref<boolean>(true);
const showBurnInVenue = ref<boolean>(true);

const carouselPhotos = computed(() => {
  if (postMediaList.value.length > 0) {
    return postMediaList.value.map(s => s.url).filter(Boolean);
  }
  return studioItems.value.map(resolveItemPhoto).filter((u): u is string => Boolean(u));
});
const currentCarouselPhoto = computed(() => {
  if (carouselPhotos.value.length === 0) return null;
  const idx = Math.min(activeCarouselIndex.value, carouselPhotos.value.length - 1);
  return carouselPhotos.value[idx] || null;
});

const currentActiveSlide = computed(() => {
  if (postMediaList.value.length > 0) {
    const idx = Math.min(activeCarouselIndex.value, postMediaList.value.length - 1);
    return postMediaList.value[idx] || null;
  }
  return null;
});

const currentActiveItem = computed(() => {
  if (studioItems.value.length > 0) {
    const idx = Math.min(activeCarouselIndex.value, studioItems.value.length - 1);
    return studioItems.value[idx] || null;
  }
  return null;
});

const currentSlideDisplayTitle = computed({
  get: () => {
    return currentActiveSlide.value?.title || currentActiveItem.value?.title || '';
  },
  set: (val: string) => {
    if (currentActiveSlide.value) {
      currentActiveSlide.value.title = val;
      syncActiveCastState();
    }
  }
});

const currentSlideDisplayPrice = computed({
  get: () => {
    const p = currentActiveSlide.value?.price ?? currentActiveItem.value?.boutiquePrice ?? currentActiveItem.value?.resalePrice ?? currentActiveItem.value?.price;
    if (p === undefined || p === null) return null;
    const num = Number(p);
    return isNaN(num) ? null : num;
  },
  set: (val: number | null) => {
    if (currentActiveSlide.value) {
      currentActiveSlide.value.price = val ?? 0;
      syncActiveCastState();
    }
  }
});

const currentSlideDisplayQuote = computed({
  get: () => {
    if (currentActiveSlide.value?.description) {
      return currentActiveSlide.value.description;
    }
    if (generatedCaption.value) {
      try {
        const items = studioItems.value.length > 0 
          ? studioItems.value 
          : postMediaList.value.map(s => ({ title: s.title, resalePrice: s.price, id: s.id }));
        const descMap = parseItemDescriptionsFromCaption(generatedCaption.value, items as any);
        return descMap[activeCarouselIndex.value] || '';
      } catch {}
    }
    return '';
  },
  set: (val: string) => {
    if (currentActiveSlide.value) {
      currentActiveSlide.value.description = val;
      syncActiveCastState();
    }
  }
});

// Staged Items
const studioItems = ref<SocialStudioItem[]>([]);
const selectedItems = ref<SocialStudioItem[]>([]);
const stagedSearchQuery = ref<string>('');
const filteredStudioItems = computed(() => {
  const q = stagedSearchQuery.value.trim().toLowerCase();
  if (!q) return studioItems.value;
  return studioItems.value.filter(item => {
    return (item.title || '').toLowerCase().includes(q) || 
           (item.upc || '').toLowerCase().includes(q) || 
           (item.brand || '').toLowerCase().includes(q);
  });
});
const totalRetailValue = computed(() => {
  return studioItems.value.reduce((acc, it) => acc + Number(it.boutiquePrice || it.resalePrice || it.price || 0), 0);
});
const currentTargetLocation = computed(() => {
  return boothLocationInput.value || activeCast.value?.locationName || 'Memory Den';
});

// Staged Item inline tray expansion & reel toggle
const expandedItemIds = ref<Set<string>>(new Set());
function toggleItemExpanded(item: SocialStudioItem) {
  const key = getItemKey(item);
  const next = new Set(expandedItemIds.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  expandedItemIds.value = next;
}

function isItemPhotoInReel(url: string): boolean {
  if (!url) return false;
  return postMediaList.value.some(s => s.url === url);
}

function toggleItemPhotoInReel(item: SocialStudioItem, photoUrl: string, photoIdx: number) {
  if (!photoUrl) return;
  const existingIndex = postMediaList.value.findIndex(s => s.url === photoUrl);
  if (existingIndex !== -1) {
    postMediaList.value.splice(existingIndex, 1);
    if (activeCarouselIndex.value >= postMediaList.value.length) {
      activeCarouselIndex.value = Math.max(0, postMediaList.value.length - 1);
    }
    addToast({ type: 'info', message: 'Removed photo from reel' });
  } else {
    postMediaList.value.push({
      id: `slide_${item.$id || item.id}_${photoIdx}_${Date.now()}`,
      type: postMediaList.value.length === 0 ? 'item_hero' : 'item_gallery',
      url: photoUrl,
      title: `${item.title || 'Item'} (Photo ${photoIdx + 1})`,
      price: item.boutiquePrice || item.resalePrice || item.price || 0,
      locationName: item.storageLocation || currentTargetLocation.value,
      sourceItemId: String(item.$id || item.id),
      sourceType: 'catalog'
    });
    addToast({ type: 'success', message: 'Added photo to reel ⭐' });
  }
  syncActiveCastState();
}

// Drawer State
const isDrawerOpen = ref<boolean>(false);
const activeDrawerItem = ref<SocialStudioItem | null>(null);
function openItemInDrawer(item: SocialStudioItem) {
  activeDrawerItem.value = { ...item };
  isDrawerOpen.value = true;
}
function onDrawerSaved(savedItem: any) {
  if (!savedItem) return;
  const targetId = savedItem.$id || savedItem.id || savedItem.upc;
  const idx = studioItems.value.findIndex(i => (i.$id || i.id || i.upc) === targetId);
  if (idx !== -1) {
    studioItems.value[idx] = { ...studioItems.value[idx], ...savedItem };
  }
  isDrawerOpen.value = false;
  addToast({ type: 'success', message: `Saved changes to ${savedItem.title || 'item'}!` });
}

// Camera, Upload & Scanner Widgets
const studioFileInputRef = ref<HTMLInputElement | null>(null);
const itemFileInputRef = ref<HTMLInputElement | null>(null);
const scannerWidget = ref<any | null>(null);
const capturedCameraPhotos = ref<any[]>([]);
const pendingCameraTargetItem = ref<SocialStudioItem | null>(null);
const pendingItemUploadTarget = ref<SocialStudioItem | null>(null);
const boothGalleryPhotos = ref<LocationPhoto[]>([]);
const allLocationPhotos = ref<LocationPhoto[]>([]);
const boothMainSelection = ref<any | null>(null);

function triggerUploadInput() {
  studioFileInputRef.value?.click();
}
function openBoothCamera() {
  scannerWidget.value?.openCamera?.();
}
function handleCapturedCameraPhotos(photos: any[]) {
  if (!photos || photos.length === 0) return;
  for (const p of photos) {
    const url = typeof p === 'string' ? p : (p.dataUrl || p.url);
    if (url && !postMediaList.value.some(s => s.url === url)) {
      postMediaList.value.push({
        id: `slide_snap_${Date.now()}_${Math.random()}`,
        type: 'booth_display',
        url,
        title: 'Booth Snap',
        locationName: currentTargetLocation.value,
        sourceType: 'booth'
      });
    }
  }
  addToast({ type: 'success', message: `Added ${photos.length} photo(s) to reel!` });
}
function handleFileInputChange(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    handleDropFiles(Array.from(input.files));
    input.value = '';
  }
}
function handleItemFileInputChange(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files.length > 0 && pendingItemUploadTarget.value) {
    handleDropFiles(Array.from(input.files), pendingItemUploadTarget.value);
    input.value = '';
    pendingItemUploadTarget.value = null;
  }
}
async function handleDropFiles(files: File[], targetItem?: SocialStudioItem) {
  for (const file of files) {
    const dataUrl = await fileToDataUrl(file);
    if (targetItem) {
      targetItem.customPhotoDataUrl = dataUrl;
    } else {
      postMediaList.value.push({
        id: `slide_upload_${Date.now()}_${Math.random()}`,
        type: 'item_gallery',
        url: dataUrl,
        title: file.name.replace(/\.[^/.]+$/, ''),
        locationName: currentTargetLocation.value,
        sourceType: 'upload'
      });
    }
  }
  addToast({ type: 'success', message: `Added ${files.length} photo(s)!` });
}
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

// Picker Modal & Helpers
const isItemPickerOpen = ref<boolean>(false);
const alreadyStagedIds = computed(() => studioItems.value.map(i => String(i.$id || i.id || '')).filter(Boolean));
function handleAddPickerItems(newItems: SocialStudioItem[]) {
  if (!newItems || newItems.length === 0) return;
  const existingKeys = new Set(studioItems.value.map(getItemKey));
  const toAdd = newItems.filter(i => !existingKeys.has(getItemKey(i)));
  studioItems.value.push(...toAdd);
  selectedItems.value.push(...toAdd);
  addAllStagedItemPhotos();
  addToast({ type: 'success', message: `Added ${toAdd.length} items to cast!` });
}
function clearAllStaged() {
  clearCastStaging();
  studioItems.value = [];
  selectedItems.value = [];
  postMediaList.value = [];
  activeCarouselIndex.value = 0;
  addToast({ type: 'info', message: 'Cleared all staged items from this cast.' });
}
function handleReturnToHub() {
  syncActiveCastState();
  returnToHub();
}
function handleQuickRestockTrigger() {
  startQuickCast('restock', { title: 'Fresh Restock Dropcast', locationName: currentTargetLocation.value });
}
function handleQuickGrailTrigger() {
  startQuickCast('grail', { title: 'Grail Spotlight // Vintage Relic', locationName: currentTargetLocation.value });
}
function handleQuickHaulTrigger() {
  startQuickCast('haul', { title: 'Fresh Thrift & Estate Haul Teaser', locationName: 'Warehouse Intake' });
}
function handleQuickSalesTrigger() {
  startQuickCast('recap', { title: 'Weekly Sold Grails Wrap-Up', locationName: 'Online & Booths' });
}
function resolveItemPhoto(item: any): string | null {
  if (!item) return null;
  const urls = resolveItemImageUrls(item);
  return urls.length > 0 ? urls[0] : null;
}
function formatPrice(val: any): string {
  const n = Number(val);
  return isNaN(n) ? '0.00' : n.toFixed(2);
}
function getItemKey(item: any): string {
  return String(item?.$id || item?.id || item?.upc || item?.title || Math.random());
}
function prevCarouselSlide() {
  if (carouselPhotos.value.length === 0) return;
  activeCarouselIndex.value = (activeCarouselIndex.value - 1 + carouselPhotos.value.length) % carouselPhotos.value.length;
}
function nextCarouselSlide() {
  if (carouselPhotos.value.length === 0) return;
  activeCarouselIndex.value = (activeCarouselIndex.value + 1) % carouselPhotos.value.length;
}
function loadLocationPhotos() {
  try {
    allLocationPhotos.value = getAllLocationPhotos();
  } catch {}
}

function handleSwitchCast(cast: Dropcast) {
  syncActiveCastState();
  openStudio(cast);
  loadFromCast(cast);
  addToast({ type: 'info', message: `Switched to Dropcast "${cast.title}"` });
}

function handleCreateNewStudioCast() {
  syncActiveCastState();
  startCustomCast(`Custom Dropcast — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, currentTargetLocation.value);
  if (activeCast.value) {
    loadFromCast(activeCast.value);
  }
}

function handleSaveStudioCast() {
  syncActiveCastState();
  saveActiveCast();
  addToast({ type: 'success', message: `Saved Dropcast "${activeCast.value?.title || 'Draft'}"! 📡` });
}

function setStudioStatus(status: CastStatus) {
  if (!activeCast.value) return;
  if (status === 'draft') {
    const list = getSavedDropcasts();
    for (const c of list) {
      if (c.id !== activeCast.value.id && c.status === 'draft') {
        c.status = 'paused';
        saveDropcast(c);
      }
    }
  }
  activeCast.value.status = status;
  updateActiveCast({ status });
  addToast({ type: 'info', message: `Status updated to ${CAST_STATUS_META[status]?.label || status}` });
}

function toggleStudioActivePause() {
  if (!activeCast.value) return;
  if (activeCast.value.status === 'draft') {
    setStudioStatus('paused');
  } else {
    setStudioStatus('draft');
  }
}

function syncActiveCastState() {
  if (!activeCast.value) return;
  const trimmed = studioCastTitle.value.trim();
  if (trimmed) {
    activeCast.value.title = trimmed;
  }
  updateActiveCast({
    title: trimmed || activeCast.value.title,
    items: studioItems.value,
    slides: postMediaList.value,
    personaId: selectedPersonaId.value,
    customTonePrompt: customTonePrompt.value,
    customNotes: customNotes.value,
    platform: selectedPlatform.value,
    authorHandle: authorAccountHandle.value,
    includePrices: includePrices.value,
    generatedCaption: generatedCaption.value,
    totalRetailValue: totalRetailValue.value
  });
}

function loadFromCast(cast: Dropcast) {
  if (!cast) return;

  // Defensive check: If this is a seed cast and its items or photos were corrupted/contaminated
  const seed = SEED_DROPCASTS.find(s => s.id === cast.id);
  if (seed) {
    if (cast.id === 'cast_grail_velvet_jacket') {
      const hasBurton = cast.items?.some(i => (i.title || '').toLowerCase().includes('burton'));
      if (!hasBurton || cast.items?.length !== 1 || !cast.items[0]?.imageUrl || cast.locationName !== 'Dusty Tiger') {
        cast = { ...seed };
        updateActiveCast({ ...seed });
      }
    } else if (!cast.items || cast.items.length === 0) {
      cast = { ...seed };
      updateActiveCast({ ...seed });
    }
  }

  studioCastTitle.value = cast.title || '';
  studioItems.value = [...(cast.items || [])];
  selectedItems.value = [...(cast.items || [])];
  postMediaList.value = [...(cast.slides || [])];

  if (postMediaList.value.length === 0 && studioItems.value.length > 0) {
    for (const it of studioItems.value) {
      const u = resolveItemPhoto(it);
      if (u && !postMediaList.value.some(s => s.url === u)) {
        postMediaList.value.push({
          id: `slide_${it.$id || it.id}_hero_${Date.now()}`,
          type: 'item_hero',
          url: u,
          title: it.title,
          price: it.boutiquePrice || it.resalePrice || it.price || 0,
          locationName: it.storageLocation || currentTargetLocation.value,
          sourceItemId: String(it.$id || it.id),
          sourceType: 'catalog'
        });
      }
    }
  }

  if (cast.personaId) selectedPersonaId.value = cast.personaId;
  if (cast.customTonePrompt) customTonePrompt.value = cast.customTonePrompt;
  if (cast.customNotes) customNotes.value = cast.customNotes;
  if (cast.platform) selectedPlatform.value = cast.platform;
  if (cast.authorHandle) authorAccountHandle.value = cast.authorHandle;
  if (typeof cast.includePrices === 'boolean') includePrices.value = cast.includePrices;
  if (cast.locationName) boothLocationInput.value = cast.locationName;
  if (cast.generatedCaption) {
    generatedCaption.value = cast.generatedCaption;
    // Auto-populate slide quotes if empty
    setTimeout(() => {
      try {
        if (postMediaList.value.some(s => !s.description)) {
          const targetItems = studioItems.value.length > 0 
            ? studioItems.value 
            : postMediaList.value.map(s => ({ title: s.title, resalePrice: s.price, id: s.id }));
          const descMap = parseItemDescriptionsFromCaption(cast.generatedCaption!, targetItems as any);
          postMediaList.value.forEach((slide, sIdx) => {
            if (!slide.description) {
              const itemIdx = targetItems.findIndex(it => String((it as any).$id || (it as any).id) === slide.sourceItemId);
              if (itemIdx !== -1 && descMap[itemIdx]) {
                slide.description = descMap[itemIdx];
              } else if (descMap[sIdx]) {
                slide.description = descMap[sIdx];
              }
            }
          });
        }
      } catch {}
    }, 60);
  }
  activeCarouselIndex.value = 0;
}

function unstageItem(item: SocialStudioItem) {
  const key = getItemKey(item);
  const idx = studioItems.value.findIndex(i => getItemKey(i) === key);
  const targetId = String(item.$id || item.id || key);
  if (idx >= 0) {
    studioItems.value.splice(idx, 1);
    selectedItems.value = selectedItems.value.filter(i => getItemKey(i) !== key);
    postMediaList.value = postMediaList.value.filter(s => s.sourceItemId !== targetId);
    if (activeCarouselIndex.value >= postMediaList.value.length) {
      activeCarouselIndex.value = Math.max(0, postMediaList.value.length - 1);
    }
    unstageItemFromCast(targetId);
  }
}

function setSlideAsCover(idx: number) {
  if (idx <= 0 || idx >= postMediaList.value.length) return;
  const [slide] = postMediaList.value.splice(idx, 1);
  postMediaList.value.unshift(slide);
  activeCarouselIndex.value = 0;
  syncActiveCastState();
  addToast({ type: 'success', message: `Set "${(slide.title || 'Slide').slice(0, 20)}" as Cover photo! ⭐` });
}

function addAllStagedItemPhotos() {
  let count = 0;
  for (const item of studioItems.value) {
    const urls = getItemImageUrls(item);
    if (urls.length === 0) {
      const single = resolveItemPhoto(item);
      if (single) urls.push(single);
    }
    for (let idx = 0; idx < urls.length; idx++) {
      const u = urls[idx];
      if (!postMediaList.value.some(s => s.url === u)) {
        postMediaList.value.push({
          id: `slide_${item.$id || item.id}_${idx}_${Date.now()}`,
          type: idx === 0 ? 'item_hero' : 'item_gallery',
          url: u,
          title: item.title,
          price: item.boutiquePrice || item.resalePrice || item.price || 0,
          locationName: item.storageLocation || currentTargetLocation.value,
          sourceItemId: String(item.$id || item.id),
          sourceType: 'catalog'
        });
        count++;
      }
    }
  }
  addToast({ type: 'success', message: `Added ${count} photo${count === 1 ? '' : 's'} to Media Reel! 🎬` });
}

function onSlideImageError(e: Event) {
  const target = e.target as HTMLImageElement;
  if (target) {
    target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24"><rect width="24" height="24" fill="%23222"/><text x="12" y="14" fill="%23888" font-size="5" text-anchor="middle" font-family="sans-serif">No Image</text></svg>';
  }
}

function onCarouselImageError(e: Event) {
  const target = e.target as HTMLImageElement;
  if (target) {
    target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 24 24"><rect width="24" height="24" fill="%23111"/><text x="12" y="13" fill="%23666" font-size="4" text-anchor="middle" font-family="sans-serif">Image Unavailable</text></svg>';
  }
}

function setLocationFilter(locId: string) {
  locationFilterMode.value = locId;
  if (locId === 'MD') {
    boothLocationInput.value = 'Memory Den';
  } else if (locId === 'DT') {
    boothLocationInput.value = 'Dusty Tiger';
  }
}

function setPlaybook(pbId: 'all' | 'drop' | 'grail' | 'recap' | 'haul') {
  selectedPlaybook.value = pbId;
  if (pbId === 'drop') activeSourcingStream.value = 'drops';
  else if (pbId === 'haul') activeSourcingStream.value = 'hauls';
  else if (pbId === 'recap') activeSourcingStream.value = 'sales';
  else if (pbId === 'grail') activeSourcingStream.value = 'catalog';
}

// Drag and Drop Slide Reordering State & Handlers
const draggedSlideIndex = ref<number | null>(null);
const dragOverSlideIndex = ref<number | null>(null);

function handleSlideDragStart(index: number, event: DragEvent) {
  draggedSlideIndex.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  }
}

function handleSlideDragOver(index: number, event: DragEvent) {
  event.preventDefault();
  if (draggedSlideIndex.value === null) return;
  dragOverSlideIndex.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
}

function handleSlideDragLeave(index: number) {
  if (dragOverSlideIndex.value === index) {
    dragOverSlideIndex.value = null;
  }
}

function handleSlideDrop(dropIndex: number, event: DragEvent) {
  event.preventDefault();
  if (draggedSlideIndex.value === null || draggedSlideIndex.value === dropIndex) {
    draggedSlideIndex.value = null;
    dragOverSlideIndex.value = null;
    return;
  }
  const fromIdx = draggedSlideIndex.value;
  const moved = postMediaList.value.splice(fromIdx, 1)[0];
  postMediaList.value.splice(dropIndex, 0, moved);
  activeCarouselIndex.value = dropIndex;
  draggedSlideIndex.value = null;
  dragOverSlideIndex.value = null;
  syncActiveCastState();
  if (dropIndex === 0) {
    addToast({ type: 'success', message: `⭐ Set "${moved.title || 'Slide'}" as the Main Cover (#1)!` });
  } else {
    addToast({ type: 'info', message: `Reordered slide to position #${dropIndex + 1}` });
  }
}

function handleSlideDragEnd() {
  draggedSlideIndex.value = null;
  dragOverSlideIndex.value = null;
}

function moveSlideLeft(index: number) {
  if (index <= 0 || index >= postMediaList.value.length) return;
  const temp = postMediaList.value[index];
  postMediaList.value[index] = postMediaList.value[index - 1];
  postMediaList.value[index - 1] = temp;
  activeCarouselIndex.value = index - 1;
}

function moveSlideRight(index: number) {
  if (index < 0 || index >= postMediaList.value.length - 1) return;
  const temp = postMediaList.value[index];
  postMediaList.value[index] = postMediaList.value[index + 1];
  postMediaList.value[index + 1] = temp;
  activeCarouselIndex.value = index + 1;
}

function removeSlide(index: number) {
  if (index < 0 || index >= postMediaList.value.length) return;
  postMediaList.value.splice(index, 1);
  if (activeCarouselIndex.value >= postMediaList.value.length) {
    activeCarouselIndex.value = Math.max(0, postMediaList.value.length - 1);
  }
}

function openReelStudio(index: number = 0) {
  if (postMediaList.value.length === 0 && studioItems.value.length > 0) {
    addAllStagedItemPhotos();
  }
  reelStudioInitialIndex.value = Math.max(0, Math.min(index, Math.max(0, postMediaList.value.length - 1)));
  isReelPlayerOpen.value = true;
}

function autoAssignDescriptions() {
  if (!generatedCaption.value) {
    addToast({ type: 'warning', message: 'Generate a post caption first to extract item quotes!' });
    return;
  }
  
  const targetItems = studioItems.value.length > 0 
    ? studioItems.value 
    : postMediaList.value.map(s => ({ title: s.title, resalePrice: s.price, id: s.id }));
    
  const descMap = parseItemDescriptionsFromCaption(generatedCaption.value, targetItems);
  const keys = Object.keys(descMap).map(Number);
  if (keys.length === 0) {
    addToast({ type: 'info', message: 'No item descriptions could be extracted from caption text.' });
    return;
  }

  let updatedCount = 0;
  postMediaList.value.forEach((slide, sIdx) => {
    const itemIdx = targetItems.findIndex(it => String(it.$id || it.id) === slide.sourceItemId);
    if (itemIdx !== -1 && descMap[itemIdx]) {
      slide.description = descMap[itemIdx];
      updatedCount++;
    } else if (descMap[sIdx]) {
      slide.description = descMap[sIdx];
      updatedCount++;
    }
  });

  syncActiveCastState();
  addToast({ 
    type: 'success', 
    message: `✨ Assigned AI quotes to ${updatedCount} slide photo${updatedCount === 1 ? '' : 's'}!` 
  });
}

function updateSlideDescription({ index, description }: { index: number; description: string }) {
  if (postMediaList.value[index]) {
    postMediaList.value[index].description = description;
    syncActiveCastState();
  }
}

function addAllItemPhotos(item: any) {
  const urls = getItemImageUrls(item);
  if (urls.length === 0) {
    const single = resolveItemPhoto(item);
    if (single) urls.push(single);
  }
  let added = 0;
  for (let idx = 0; idx < urls.length; idx++) {
    const u = urls[idx];
    if (!postMediaList.value.some(s => s.url === u)) {
      postMediaList.value.push({
        id: `slide_${item.$id || item.id}_gallery_${idx}_${Date.now()}`,
        type: idx === 0 ? 'item_hero' : 'item_gallery',
        url: u,
        title: `${item.title || 'Item'} (Photo ${idx + 1})`,
        price: item.boutiquePrice || item.resalePrice || item.price || 0,
        locationName: item.storageLocation || currentTargetLocation.value,
        sourceItemId: String(item.$id || item.id),
        sourceType: 'catalog'
      });
      added++;
    }
  }
  if (!studioItems.value.some(i => getItemKey(i) === getItemKey(item))) {
    studioItems.value.push(item);
    selectedItems.value.push(item);
  }
  addToast({ type: 'success', message: `Added ${added} photo${added === 1 ? '' : 's'} to Media Reel! 🎬` });
}

// Single Image Download
async function downloadSingle(item: SocialStudioItem) {
  const url = resolveItemPhoto(item);
  if (!url) {
    addToast({ type: 'warning', message: 'No photo URL available for this item.' });
    return;
  }
  const filename = `${item.upc || 'Item'}_${item.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}.jpg`;
  try {
    await downloadSingleImage(url, filename);
    addToast({ type: 'success', message: `Downloaded photo for ${item.title.slice(0, 25)}!` });
  } catch (e: any) {
    addToast({ type: 'error', message: 'Failed downloading photo: ' + e.message });
  }
}

// Batch ZIP Download (Bundles Products + Real Booth Displays or Ordered Reel!)
async function downloadAllAsZip() {
  if (postMediaList.value.length === 0 && selectedItems.value.length === 0 && boothGalleryPhotos.value.length === 0) return;
  isZipping.value = true;
  zipProgressPercent.value = 0;
  zipProgressMessage.value = 'Preparing ordered photos & media reel...';

  try {
    const safeDropName = (activeCast.value?.title || currentTargetLocation.value || 'Post_Drop').replace(/[^a-zA-Z0-9_-]/g, '_');
    const zipName = `${safeDropName}_Reel_${new Date().toISOString().slice(0, 10)}.zip`;

    if (postMediaList.value.length > 0) {
      const { success, failed } = await downloadMediaSlidesAsZip(postMediaList.value, {
        zipName,
        onProgress: (pct, msg) => {
          zipProgressPercent.value = pct;
          zipProgressMessage.value = msg;
        }
      });
      addToast({ 
        type: 'success', 
        message: `🎬 Downloaded ${success} ordered slide${success === 1 ? '' : 's'} in ${zipName}! ${failed > 0 ? `(${failed} failed)` : ''}` 
      });
    } else {
      const locationItems: SocialStudioItem[] = boothGalleryPhotos.value
        .map((p, idx) => {
          const url = typeof p === 'string' ? p : p.url;
          const name = (p.title || p.locationName || 'Booth').replace(/[^a-zA-Z0-9]/g, '_');
          return {
            title: `00_${name}_Display_${idx + 1}`,
            customPhotoDataUrl: url,
            images: [url]
          };
        })
        .filter(i => Boolean(i.customPhotoDataUrl));

      const combinedItems = [...locationItems, ...selectedItems.value];

      const { success, failed } = await downloadItemsAsZip(combinedItems, {
        zipName,
        allPhotos: false,
        onProgress: (pct, msg) => {
          zipProgressPercent.value = pct;
          zipProgressMessage.value = msg;
        }
      });

      addToast({ 
        type: 'success', 
        message: `Downloaded ${success} photos in ${zipName}! ${failed > 0 ? `(${failed} failed)` : ''}` 
      });
    }
  } catch (err: any) {
    addToast({ type: 'error', message: 'Failed to create ZIP: ' + err.message });
  } finally {
    isZipping.value = false;
  }
}

// Download Complete Cast Pack (.zip with photos + caption text + manifest)
async function downloadCastPack() {
  if (postMediaList.value.length === 0 && selectedItems.value.length === 0 && boothGalleryPhotos.value.length === 0) {
    addToast({ type: 'warning', message: 'No photos or items in cast to export.' });
    return;
  }
  isZipping.value = true;
  zipProgressPercent.value = 0;
  zipProgressMessage.value = 'Packaging Cast Pack (.zip)...';

  try {
    const safeDropName = (activeCast.value?.title || currentTargetLocation.value || 'Cast_Drop').replace(/[^a-zA-Z0-9_-]/g, '_');
    const zipName = `${safeDropName}_CastPack_${new Date().toISOString().slice(0, 10)}.zip`;

    const manifestData = {
      castId: activeCast.value?.id,
      title: activeCast.value?.title,
      locationName: currentTargetLocation.value,
      authorHandle: authorAccountHandle.value,
      platform: selectedPlatform.value,
      persona: selectedPersonaId.value,
      createdAt: new Date().toISOString(),
      itemCount: studioItems.value.length,
      slideCount: postMediaList.value.length,
      items: studioItems.value.map(i => ({
        id: i.$id || i.id,
        title: i.title,
        price: i.boutiquePrice || i.resalePrice || i.price,
        brand: i.brand,
        storageLocation: i.storageLocation
      }))
    };

    if (postMediaList.value.length === 0 && studioItems.value.length > 0) {
      addAllStagedItemPhotos();
    }

    const { success, failed } = await downloadMediaSlidesAsZip(postMediaList.value, {
      zipName,
      captionText: generatedCaption.value,
      manifestData,
      onProgress: (pct, msg) => {
        zipProgressPercent.value = pct;
        zipProgressMessage.value = msg;
      }
    });

    addToast({ 
      type: 'success', 
      message: `📦 Exported Cast Pack (${success} slides + copy) in ${zipName}! ${failed > 0 ? `(${failed} failed)` : ''}` 
    });
  } catch (err: any) {
    addToast({ type: 'error', message: 'Failed to create Cast Pack: ' + err.message });
  } finally {
    isZipping.value = false;
  }
}

// Caption Generation
async function generateCaption() {
  if (isCaptionLocked.value) {
    addToast({ type: 'warning', message: 'Caption is locked! Unlock it first to regenerate with AI.' });
    return;
  }

  const itemsToUse = selectedItems.value.length > 0 ? selectedItems.value : studioItems.value;
  if (carouselPhotos.value.length === 0 && itemsToUse.length === 0 && postMediaList.value.length === 0) {
    addToast({ type: 'warning', message: 'Please stage at least 1 item or photo to generate a post.' });
    return;
  }

  isGenerating.value = true;
  try {
    const finalItems = itemsToUse.length > 0 
      ? itemsToUse 
      : postMediaList.value.map(s => ({ title: s.title, resalePrice: s.price, id: s.id }));

    const payload = {
      items: finalItems.map((it: any) => ({
        id: it.$id || it.id,
        title: it.title,
        resalePrice: it.boutiquePrice || it.resalePrice || it.price,
        brand: it.brand,
        category: it.category,
        condition: it.condition,
        conditionNotes: it.conditionNotes,
        historicalNotes: it.historicalNotes,
        provenance: it.provenance,
        storageLocation: it.storageLocation,
        upc: it.upc
      })),
      locationName: currentTargetLocation.value,
      authorHandle: authorAccountHandle.value.trim() || 'resalecommand',
      platform: selectedPlatform.value,
      tone: selectedPersonaId.value,
      customTone: customTonePrompt.value.trim(),
      includePrices: includePrices.value,
      customNotes: customNotes.value.trim(),
      hasLocationPhotos: boothGalleryPhotos.value.length > 0,
      hasMeasurements: false
    };

    const res = await fetch('/api/generate-social-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    generatedCaption.value = data.caption || '';
    lastSource.value = data.source || 'AI';
    autoAssignDescriptions();
  } catch (err: any) {
    console.warn('[SocialHub] API error, falling back to local generator:', err);
    generatedCaption.value = generateLocalFallback();
    lastSource.value = 'local';
    autoAssignDescriptions();
  } finally {
    isGenerating.value = false;
    syncActiveCastState();
  }
}

function generateLocalFallback(): string {
  const items = selectedItems.value.length > 0 ? selectedItems.value : studioItems.value;
  return generateDynamicFallbackPost({
    items: items.map(i => ({
      title: i.title,
      resalePrice: i.boutiquePrice || i.resalePrice || i.price,
      brand: i.brand,
      category: i.category,
      condition: i.condition,
      conditionNotes: i.conditionNotes,
      historicalNotes: i.historicalNotes,
      provenance: i.provenance,
      storageLocation: i.storageLocation,
      upc: i.upc
    })),
    locationName: currentTargetLocation.value,
    authorHandle: authorAccountHandle.value.trim() || 'resalecommand',
    platform: selectedPlatform.value,
    tone: selectedPersonaId.value,
    customTone: customTonePrompt.value.trim(),
    includePrices: includePrices.value,
    customNotes: customNotes.value.trim(),
    hasLocationPhotos: boothGalleryPhotos.value.length > 0,
    hasMeasurements: false
  });
}

function copyToClipboard() {
  if (!generatedCaption.value) return;
  navigator.clipboard.writeText(generatedCaption.value);
  isCopied.value = true;
  addToast({ type: 'success', message: 'Social post caption copied to clipboard!' });
  setTimeout(() => {
    isCopied.value = false;
  }, 2500);
}

function handleUrlCastNavigation() {
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const targetId = props.initialCastId || urlParams?.get('cast') || urlParams?.get('id');
  if (targetId) {
    const cast = openStudioById(targetId);
    if (cast) {
      loadFromCast(cast);
    }
  } else if (activeCast.value) {
    loadFromCast(activeCast.value);
  }
}

onMounted(() => {
  fetchAllDrafts();
  fetchPurchases();
  fetchInventory();
  loadLocationPhotos();

  handleUrlCastNavigation();
  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', handleUrlCastNavigation);
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('popstate', handleUrlCastNavigation);
  }
});
</script>

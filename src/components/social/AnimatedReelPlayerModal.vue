<template>
  <dialog class="modal z-[90]" :class="{ 'modal-open': isOpen }">
    <div v-if="isOpen" class="modal-box w-screen max-w-none h-screen max-h-none rounded-none m-0 p-0 bg-base-100 flex flex-col fixed inset-0">
      
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
          
          <!-- PLATFORM SIMULATOR MODE SELECTOR -->
          <div class="flex items-center justify-center gap-1.5 mb-2.5 bg-base-200/80 p-1 rounded-2xl border border-base-300 shadow-2xs">
            <button 
              type="button" 
              @click="setPlatformSimulationMode('instagram')" 
              class="btn btn-2xs rounded-xl font-bold gap-1 transition-all"
              :class="platformSimulationMode === 'instagram' ? 'bg-linear-to-r from-pink-500 via-purple-600 to-indigo-600 text-white shadow-xs border-none' : 'btn-ghost'"
              title="Preview with Instagram Reels & Stories action rail, audio disc & caption"
            >
              <Icon icon="solar:camera-bold" class="w-3.5 h-3.5" />
              <span>Instagram Reels</span>
            </button>
            <button 
              type="button" 
              @click="setPlatformSimulationMode('tiktok')" 
              class="btn btn-2xs rounded-xl font-bold gap-1 transition-all"
              :class="platformSimulationMode === 'tiktok' ? 'bg-neutral-900 text-white border border-neutral-700 shadow-xs' : 'btn-ghost'"
              title="Preview with TikTok music disc & engagement rail"
            >
              <Icon icon="solar:music-library-bold" class="w-3.5 h-3.5 text-cyan-400" />
              <span>TikTok</span>
            </button>
            <button 
              type="button" 
              @click="setPlatformSimulationMode('clean')" 
              class="btn btn-2xs rounded-xl font-bold gap-1 transition-all"
              :class="platformSimulationMode === 'clean' ? 'btn-neutral shadow-xs' : 'btn-ghost'"
              title="Clean preview without UI icons"
            >
              <Icon icon="solar:eye-linear" class="w-3.5 h-3.5" />
              <span>Clean</span>
            </button>
          </div>

          <!-- 1. VERTICAL 9:16 PHONE SIMULATOR (Instagram Reels & TikTok Mode) -->
          <div v-if="aspectRatio === '9:16'" class="mockup-phone border-base-300 shadow-2xl w-full max-w-[340px] sm:max-w-[370px]">
            <div class="camera mockup-phone-camera"></div>
            <div 
              class="display mockup-phone-display bg-black text-white relative flex flex-col justify-between select-none cursor-pointer overflow-hidden transition-all duration-300 aspect-[9/16]"
              @click="handleViewerTap"
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
                  v-for="(s, idx) in slides" 
                  :key="s.id || idx" 
                  class="flex-1 h-0.75 bg-white/30 rounded-full overflow-hidden backdrop-blur-xs"
                >
                  <div 
                    class="h-full bg-white transition-all shadow-xs"
                    :style="{ 
                      width: idx < activeIndex ? '100%' : (idx === activeIndex ? `${slideProgress}%` : '0%'),
                      transitionDuration: idx === activeIndex && isPlaying ? '50ms' : '0ms'
                    }"
                  ></div>
                </div>
              </div>

              <!-- PLATFORM HEADER: INSTAGRAM REELS -->
              <div 
                v-if="platformSimulationMode === 'instagram'" 
                class="absolute top-10.5 inset-x-3.5 z-40 flex items-center justify-between text-white pointer-events-none drop-shadow-md"
              >
                <div class="flex items-center gap-1 font-black text-sm tracking-tight text-white drop-shadow-md pointer-events-auto">
                  <span>Reels</span>
                  <Icon icon="solar:alt-arrow-down-bold" class="w-3 h-3 opacity-80" />
                </div>

                <div class="flex items-center gap-2 pointer-events-auto" @click.stop>
                  <!-- Sound Mute/Unmute Icon -->
                  <button 
                    type="button" 
                    @click="toggleMute" 
                    class="btn btn-2xs btn-circle bg-black/60 text-white border border-white/20 hover:bg-black/90 shadow-md"
                    :title="isMuted ? 'Unmute Audio' : 'Mute Audio'"
                  >
                    <Icon :icon="isMuted ? 'solar:volume-cross-bold' : 'solar:volume-loud-bold'" class="w-3 h-3" />
                  </button>
                  <div class="w-6 h-6 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white shadow-md">
                    <Icon icon="solar:camera-bold" class="w-3.5 h-3.5" />
                  </div>
                  <span class="badge badge-xs bg-black/60 border border-white/20 font-mono text-[9px] text-white">
                    {{ activeIndex + 1 }}/{{ slides.length }}
                  </span>
                </div>
              </div>

              <!-- PLATFORM HEADER: TIKTOK -->
              <div 
                v-else-if="platformSimulationMode === 'tiktok'" 
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

                <div class="flex items-center gap-2 pointer-events-auto" @click.stop>
                  <button 
                    type="button" 
                    @click="toggleMute" 
                    class="btn btn-2xs btn-circle bg-black/60 text-white border border-white/20"
                    :title="isMuted ? 'Unmute Audio' : 'Mute Audio'"
                  >
                    <Icon :icon="isMuted ? 'solar:volume-cross-bold' : 'solar:volume-loud-bold'" class="w-3 h-3" />
                  </button>
                  <div class="w-6 h-6 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white shadow-md">
                    <Icon icon="solar:magnifer-linear" class="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>

              <!-- CANVAS FOR RENDERED OVERLAY -->
              <canvas 
                ref="playerCanvasRef" 
                class="w-full h-full object-contain mx-auto transition-transform"
                :class="isPlaying ? 'scale-105 duration-4000 transition-transform ease-out' : 'scale-100 duration-300'"
              ></canvas>

              <!-- INSTAGRAM REELS RIGHT-SIDE ACTION RAIL -->
              <div 
                v-if="platformSimulationMode === 'instagram'" 
                class="absolute right-2 bottom-6 z-40 flex flex-col items-center gap-3 text-white drop-shadow-lg pointer-events-auto"
                @click.stop
              >
                <!-- Like Button -->
                <button 
                  type="button" 
                  @click="toggleLike"
                  class="flex flex-col items-center gap-0.5 transition-transform active:scale-125"
                  title="Like Reel"
                >
                  <div class="w-9.5 h-9.5 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center border border-white/15 transition-all shadow-md">
                    <Icon 
                      :icon="isReelLiked ? 'solar:heart-bold' : 'solar:heart-linear'" 
                      class="w-5.5 h-5.5 transition-colors" 
                      :class="isReelLiked ? 'text-red-500 scale-110 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]' : 'text-white'" 
                    />
                  </div>
                  <span class="text-[9px] font-bold font-mono tracking-tight">{{ likeCount.toLocaleString() }}</span>
                </button>

                <!-- Comment Button -->
                <button 
                  type="button" 
                  @click="handleCommentClick"
                  class="flex flex-col items-center gap-0.5 transition-transform active:scale-110"
                  title="Comments"
                >
                  <div class="w-9.5 h-9.5 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center border border-white/15 transition-all shadow-md">
                    <Icon icon="solar:chat-round-dots-bold" class="w-5 h-5 text-white" />
                  </div>
                  <span class="text-[9px] font-bold font-mono tracking-tight">{{ commentCount }}</span>
                </button>

                <!-- Share Button -->
                <button 
                  type="button" 
                  @click="handleShareClick"
                  class="flex flex-col items-center gap-0.5 transition-transform active:scale-110"
                  title="Share"
                >
                  <div class="w-9.5 h-9.5 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center border border-white/15 transition-all shadow-md">
                    <Icon icon="solar:plain-bold" class="w-4.5 h-4.5 text-white -rotate-12" />
                  </div>
                  <span class="text-[9px] font-bold font-mono tracking-tight">Share</span>
                </button>

                <!-- Bookmark Button -->
                <button 
                  type="button" 
                  @click="isReelSaved = !isReelSaved"
                  class="flex flex-col items-center gap-0.5 transition-transform active:scale-110"
                  title="Save"
                >
                  <div class="w-9.5 h-9.5 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center border border-white/15 transition-all shadow-md">
                    <Icon :icon="isReelSaved ? 'solar:bookmark-bold' : 'solar:bookmark-linear'" class="w-4.5 h-4.5" :class="isReelSaved ? 'text-amber-400' : 'text-white'" />
                  </div>
                  <span class="text-[9px] font-bold font-mono tracking-tight">{{ isReelSaved ? 'Saved' : 'Save' }}</span>
                </button>

                <!-- More Options -->
                <button 
                  type="button" 
                  class="w-9.5 h-9.5 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center border border-white/15 text-white shadow-md active:scale-110"
                  title="Options"
                >
                  <Icon icon="solar:menu-dots-bold" class="w-4 h-4 text-white" />
                </button>

                <!-- Spinning Vinyl Record Disc (Continual Smooth Spin + Musical Notes!) -->
                <div class="relative flex items-center justify-center mt-1">
                  <div 
                    class="w-9.5 h-9.5 rounded-full bg-neutral-950 border-2 border-neutral-700/80 p-0.5 flex items-center justify-center shadow-xl overflow-hidden"
                    :class="isPlaying ? 'animate-spin' : ''"
                    style="animation-duration: 3.5s;"
                    title="Audio Sound"
                  >
                    <div class="w-full h-full rounded-full border border-neutral-700 flex items-center justify-center bg-linear-to-tr from-pink-500 via-purple-600 to-amber-500 p-1.5">
                      <div class="w-2.5 h-2.5 rounded-full bg-black border border-white/40"></div>
                    </div>
                  </div>
                  <span v-if="isPlaying" class="absolute -top-3 -left-1 text-[11px] text-pink-400 animate-bounce pointer-events-none drop-shadow-md">♪</span>
                  <span v-if="isPlaying" class="absolute -top-1 -right-2 text-[9px] text-cyan-300 animate-pulse pointer-events-none drop-shadow-md delay-150">♫</span>
                </div>
              </div>

              <!-- TIKTOK RIGHT-SIDE ACTION RAIL -->
              <div 
                v-else-if="platformSimulationMode === 'tiktok'" 
                class="absolute right-2 bottom-6 z-40 flex flex-col items-center gap-3 text-white drop-shadow-lg pointer-events-auto"
                @click.stop
              >
                <!-- TikTok Creator Avatar with Red Plus Badge -->
                <div class="relative mb-1">
                  <div class="w-10 h-10 rounded-full border-2 border-white overflow-hidden bg-neutral-900 shadow-lg flex items-center justify-center text-xs font-black">
                    {{ (authorHandle || 'RC').slice(0, 2).toUpperCase() }}
                  </div>
                  <button 
                    type="button" 
                    @click="isFollowing = !isFollowing" 
                    class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#fe2c55] text-white flex items-center justify-center text-xs font-bold shadow-md hover:scale-110 transition-transform"
                    :title="isFollowing ? 'Following' : 'Follow'"
                  >
                    <span v-if="!isFollowing">+</span>
                    <span v-else class="text-[9px]">✓</span>
                  </button>
                </div>

                <!-- Like Button -->
                <button 
                  type="button" 
                  @click="toggleLike"
                  class="flex flex-col items-center gap-0.5 transition-transform active:scale-125"
                  title="Like"
                >
                  <div class="w-9.5 h-9.5 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-md">
                    <Icon :icon="isReelLiked ? 'solar:heart-bold' : 'solar:heart-bold'" class="w-6 h-6 transition-colors" :class="isReelLiked ? 'text-[#fe2c55] scale-110 drop-shadow-[0_0_8px_#fe2c55]' : 'text-white'" />
                  </div>
                  <span class="text-[9px] font-bold font-mono tracking-tight">{{ (likeCount * 3).toLocaleString() }}</span>
                </button>

                <!-- Comment Button -->
                <button 
                  type="button" 
                  @click="handleCommentClick"
                  class="flex flex-col items-center gap-0.5 transition-transform active:scale-110"
                  title="Comments"
                >
                  <div class="w-9.5 h-9.5 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-md">
                    <Icon icon="solar:chat-round-dots-bold" class="w-5.5 h-5.5 text-white" />
                  </div>
                  <span class="text-[9px] font-bold font-mono tracking-tight">{{ commentCount * 4 }}</span>
                </button>

                <!-- Bookmark Button -->
                <button 
                  type="button" 
                  @click="isReelSaved = !isReelSaved"
                  class="flex flex-col items-center gap-0.5 transition-transform active:scale-110"
                  title="Bookmark"
                >
                  <div class="w-9.5 h-9.5 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-md">
                    <Icon :icon="isReelSaved ? 'solar:bookmark-bold' : 'solar:bookmark-bold'" class="w-5.5 h-5.5" :class="isReelSaved ? 'text-amber-400' : 'text-white'" />
                  </div>
                  <span class="text-[9px] font-bold font-mono tracking-tight">{{ isReelSaved ? '1,421' : '1,420' }}</span>
                </button>

                <!-- Share Button -->
                <button 
                  type="button" 
                  @click="handleShareClick"
                  class="flex flex-col items-center gap-0.5 transition-transform active:scale-110"
                  title="Share"
                >
                  <div class="w-9.5 h-9.5 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-md">
                    <Icon icon="solar:share-bold" class="w-5.5 h-5.5 text-white" />
                  </div>
                  <span class="text-[9px] font-bold font-mono tracking-tight">482</span>
                </button>

                <!-- TikTok Spinning Vinyl Record Disc with cyan/magenta chromatic edge -->
                <div class="relative flex items-center justify-center mt-1">
                  <div 
                    class="w-9.5 h-9.5 rounded-full bg-neutral-950 border-2 border-neutral-800 p-0.5 flex items-center justify-center shadow-xl shadow-cyan-500/20"
                    :class="isPlaying ? 'animate-spin' : ''"
                    style="animation-duration: 3.5s;"
                  >
                    <div class="w-full h-full rounded-full bg-linear-to-tr from-[#fe2c55] via-neutral-900 to-[#25f4ee] flex items-center justify-center p-1.5">
                      <div class="w-2.5 h-2.5 rounded-full bg-neutral-950 border border-white/40"></div>
                    </div>
                  </div>
                  <span v-if="isPlaying" class="absolute -top-3 -left-1 text-[11px] text-[#25f4ee] animate-bounce pointer-events-none">♪</span>
                  <span v-if="isPlaying" class="absolute -top-1 -right-2 text-[9px] text-[#fe2c55] animate-pulse pointer-events-none delay-150">♫</span>
                </div>
              </div>

              <!-- INSTAGRAM BOTTOM-LEFT CREATOR OVERLAY -->
              <div 
                v-if="platformSimulationMode === 'instagram'" 
                class="absolute left-3 bottom-3 right-16 z-40 space-y-1.5 text-left text-white drop-shadow-md pointer-events-auto" 
                @click.stop
              >
                <!-- Creator Handle + Verified + Follow Pill Button -->
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-full p-0.5 bg-linear-to-tr from-amber-400 via-pink-500 to-purple-600 shrink-0 shadow-md">
                    <div class="w-full h-full rounded-full bg-neutral-950 flex items-center justify-center text-[10px] font-black text-white">
                      {{ (authorHandle || 'RC').slice(0, 2).toUpperCase() }}
                    </div>
                  </div>
                  <div class="flex items-center gap-1 min-w-0">
                    <span class="font-bold text-xs text-white truncate">@{{ authorHandle || 'resalecommand' }}</span>
                    <Icon icon="solar:verified-check-bold" class="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  </div>
                  <button 
                    type="button" 
                    @click="isFollowing = !isFollowing" 
                    class="btn btn-2xs rounded-full font-bold px-2 py-0 h-5 text-[10px] shrink-0"
                    :class="isFollowing ? 'btn-ghost bg-white/20 text-white' : 'btn-outline border-white/80 text-white hover:bg-white hover:text-black'"
                  >
                    {{ isFollowing ? 'Following' : 'Follow' }}
                  </button>
                </div>

                <!-- Product Title, Micro-Caption & Hashtags -->
                <div class="space-y-0.5 pr-2">
                  <p class="text-[12px] font-bold text-white leading-tight font-sans drop-shadow-xs line-clamp-1">
                    {{ currentSlideTitle || 'Curated Relic' }}
                    <span v-if="currentSlidePrice && Number(currentSlidePrice) > 0" class="text-pink-300 ml-1 font-mono font-bold">• ${{ Number(currentSlidePrice).toFixed(2) }}</span>
                  </p>
                  <p class="text-[11px] text-white/90 leading-snug line-clamp-2 drop-shadow-xs">
                    {{ currentSlideDescription || 'Fresh arrival curated at ' + (venueName || 'Memory Den') + '. Inquire or DM to claim before it sells!' }}
                  </p>
                  <p class="text-[10px] font-medium text-white/70 font-sans tracking-tight">
                    #vintage #resale #{{ (venueName || 'memoryden').toLowerCase().replace(/[^a-z0-9]/g, '') }} #curatedfinds
                  </p>
                </div>

                <!-- Audio Marquee Track Bar -->
                <div class="flex items-center gap-1.5 text-[9px] opacity-95 font-sans bg-black/55 backdrop-blur-md px-2.5 py-1 rounded-full w-fit max-w-[210px] border border-white/15 overflow-hidden shadow-xs">
                  <Icon icon="solar:music-note-2-bold" class="w-3 h-3 text-pink-400 shrink-0 animate-pulse" />
                  <span class="truncate font-medium">
                    {{ soundPreset === 'lofi' ? 'Cozy Lo-Fi Rhodes • Resale Chill' : soundPreset === 'antique' ? 'Vintage Piano Study • Archive Sounds' : soundPreset === 'cyberpunk' ? 'Velvet Synthwave • 2026' : customAudioName || 'Original Audio • ' + (authorHandle || 'resalecommand') }}
                  </span>
                </div>
              </div>

              <!-- TIKTOK BOTTOM-LEFT CREATOR OVERLAY -->
              <div 
                v-else-if="platformSimulationMode === 'tiktok'" 
                class="absolute left-3 bottom-3 right-16 z-40 space-y-1.5 text-left text-white drop-shadow-md pointer-events-auto" 
                @click.stop
              >
                <div class="flex items-center gap-1 font-extrabold text-[13px] text-white drop-shadow-sm">
                  <span>@{{ authorHandle || 'resalecommand' }}</span>
                  <Icon icon="solar:verified-check-bold" class="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                </div>

                <div class="space-y-0.5 pr-2">
                  <p class="text-[12px] text-white/95 leading-snug line-clamp-2 drop-shadow-xs font-sans">
                    <span class="font-bold">{{ currentSlideTitle || 'Curated Relic' }}</span>
                    <span v-if="currentSlidePrice && Number(currentSlidePrice) > 0" class="text-cyan-300 font-mono ml-1 font-bold">• ${{ Number(currentSlidePrice).toFixed(2) }}</span> — {{ currentSlideDescription || 'Check this out at our booth!' }}
                  </p>
                  <p class="text-[11px] font-bold text-cyan-200 tracking-tight">
                    #fyp #resale #thrifttok #viral #vintage
                  </p>
                </div>

                <div class="flex items-center gap-1.5 text-[10px] text-white/90 font-medium">
                  <Icon icon="solar:music-library-bold" class="w-3.5 h-3.5 text-white shrink-0" />
                  <span class="truncate">
                    ♫ {{ soundPreset === 'lofi' ? 'Lo-Fi Chill Beat - @' + (authorHandle || 'resalecommand') : soundPreset === 'cyberpunk' ? 'Synthwave Night - @' + (authorHandle || 'resalecommand') : 'Original Sound - ' + (authorHandle || 'resalecommand') }}
                  </span>
                </div>
              </div>

              <!-- PLAY/PAUSE OVERLAY INDICATOR (Visible briefly on tap or paused) -->
              <div 
                v-if="!isPlaying" 
                class="absolute inset-0 bg-black/30 flex items-center justify-center z-30 pointer-events-none"
              >
                <div class="w-14 h-14 rounded-full bg-black/70 border border-white/30 flex items-center justify-center text-white backdrop-blur-xs shadow-xl">
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
          </div>

          <!-- 2. SQUARE 1:1 INSTAGRAM FEED POST CARD SIMULATOR -->
          <div v-else class="w-full max-w-[360px] sm:max-w-[380px] bg-neutral-950 text-white rounded-2xl border border-neutral-800 shadow-2xl overflow-hidden select-none">
            <!-- IG FEED HEADER -->
            <div class="px-3.5 py-2.5 flex items-center justify-between border-b border-neutral-800/80">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-full p-0.5 bg-linear-to-tr from-amber-400 via-pink-500 to-purple-600 shrink-0">
                  <div class="w-full h-full rounded-full bg-neutral-950 flex items-center justify-center text-[10px] font-black text-white">
                    {{ (authorHandle || 'RC').slice(0, 2).toUpperCase() }}
                  </div>
                </div>
                <div class="leading-tight">
                  <div class="flex items-center gap-1">
                    <span class="font-bold text-xs">@{{ authorHandle || 'resalecommand' }}</span>
                    <Icon icon="solar:verified-check-bold" class="w-3.5 h-3.5 text-sky-400" />
                  </div>
                  <p class="text-[10px] text-neutral-400 font-sans">📍 {{ venueName || 'Memory Den' }}</p>
                </div>
              </div>
              <button type="button" class="text-neutral-400 hover:text-white p-1">
                <Icon icon="solar:menu-dots-bold" class="w-4 h-4" />
              </button>
            </div>

            <!-- SQUARE 1:1 CANVAS CONTAINER -->
            <div class="relative aspect-square w-full bg-black cursor-pointer overflow-hidden group" @click="handleViewerTap">
              <canvas 
                ref="playerCanvasRef" 
                class="w-full h-full object-contain mx-auto transition-transform"
                :class="isPlaying ? 'scale-105 duration-4000 transition-transform ease-out' : 'scale-100 duration-300'"
              ></canvas>

              <!-- Slide indicator pill -->
              <div class="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-mono font-bold text-white border border-white/10 z-20">
                {{ activeIndex + 1 }}/{{ slides.length }}
              </div>

              <!-- Navigation arrows -->
              <button 
                type="button" 
                @click.stop="prevSlide" 
                class="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/90 z-20"
              >‹</button>
              <button 
                type="button" 
                @click.stop="nextSlide" 
                class="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/90 z-20"
              >›</button>

              <!-- Play/Pause indicator -->
              <div 
                v-if="!isPlaying" 
                class="absolute inset-0 bg-black/30 flex items-center justify-center z-10 pointer-events-none"
              >
                <div class="w-12 h-12 rounded-full bg-black/70 border border-white/30 flex items-center justify-center text-white backdrop-blur-xs shadow-xl">
                  <Icon icon="solar:play-bold" class="w-6 h-6 ml-0.5" />
                </div>
              </div>
            </div>

            <!-- IG FEED ACTION ROW -->
            <div class="px-3.5 pt-2.5 pb-1 flex items-center justify-between">
              <div class="flex items-center gap-3.5">
                <button type="button" @click="toggleLike" class="transition-transform active:scale-125">
                  <Icon :icon="isReelLiked ? 'solar:heart-bold' : 'solar:heart-linear'" class="w-6 h-6 transition-colors" :class="isReelLiked ? 'text-red-500 scale-110' : 'text-white'" />
                </button>
                <button type="button" @click="handleCommentClick" class="transition-transform active:scale-110">
                  <Icon icon="solar:chat-round-dots-linear" class="w-6 h-6 text-white" />
                </button>
                <button type="button" @click="handleShareClick" class="transition-transform active:scale-110">
                  <Icon icon="solar:plain-linear" class="w-5.5 h-5.5 text-white -rotate-12" />
                </button>
              </div>

              <!-- Pagination dots in center -->
              <div class="flex items-center gap-1">
                <span 
                  v-for="(_, idx) in slides.slice(0, 5)" 
                  :key="idx" 
                  class="w-1.5 h-1.5 rounded-full transition-all"
                  :class="idx === activeIndex ? 'bg-sky-400 scale-125' : 'bg-neutral-600'"
                ></span>
              </div>

              <button type="button" @click="isReelSaved = !isReelSaved" class="transition-transform active:scale-110">
                <Icon :icon="isReelSaved ? 'solar:bookmark-bold' : 'solar:bookmark-linear'" class="w-5.5 h-5.5" :class="isReelSaved ? 'text-amber-400' : 'text-white'" />
              </button>
            </div>

            <!-- IG FEED CAPTION & LIKES -->
            <div class="px-3.5 pb-3 text-xs space-y-1">
              <div class="font-bold text-white text-[11px]">
                Liked by <span class="font-black text-pink-300">dusty_tiger</span> and <span>{{ likeCount.toLocaleString() }} others</span>
              </div>
              <p class="text-[11px] leading-tight text-neutral-200">
                <span class="font-bold text-white mr-1">@{{ authorHandle || 'resalecommand' }}</span>
                <span class="font-semibold">{{ currentSlideTitle }}</span>
                <span v-if="currentSlidePrice && Number(currentSlidePrice) > 0" class="text-pink-300 font-mono ml-1 font-bold">(${{ Number(currentSlidePrice).toFixed(2) }})</span>
                — {{ currentSlideDescription || 'Now available in our booth! DM to hold or purchase.' }}
              </p>
              <p class="text-[10px] text-sky-400 font-medium font-sans">
                #vintage #resale #{{ (venueName || 'memoryden').toLowerCase().replace(/[^a-z0-9]/g, '') }} #streetwear
              </p>
              <p class="text-[10px] text-neutral-500 cursor-pointer pt-0.5" @click="handleCommentClick">
                View all {{ commentCount }} comments
              </p>
              <p class="text-[9px] text-neutral-500 uppercase tracking-wider font-mono">
                2 HOURS AGO • SEE TRANSLATION
              </p>
            </div>
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

          <!-- SLIDE THUMBNAILS CAROUSEL STRIP -->
          <div v-if="slides.length > 1" class="flex items-center gap-1.5 mt-2.5 max-w-[360px] overflow-x-auto scrollbar-none py-1 px-1 bg-base-200/50 rounded-2xl border border-base-300">
            <button
              v-for="(s, idx) in slides"
              :key="s.id || idx"
              type="button"
              @click="activeIndex = idx; slideProgress = 0; renderCurrentSlide()"
              class="w-10 h-14 rounded-xl overflow-hidden border-2 transition-all shrink-0 relative group bg-neutral-900"
              :class="activeIndex === idx ? 'border-primary ring-2 ring-primary/40 scale-105 shadow-md' : 'border-base-300 opacity-60 hover:opacity-100'"
              :title="'Slide ' + (idx + 1) + ': ' + (s.title || '')"
            >
              <img :src="s.url" class="w-full h-full object-cover" />
              <div class="absolute inset-x-0 bottom-0 bg-black/80 text-[8px] font-mono font-bold text-center text-white py-0.5">
                #{{ idx + 1 }}
              </div>
            </button>
          </div>

          <!-- QUICK LIVE STYLING TOOLBAR (Instant Visual Feedback on Viewer) -->
          <div class="w-full max-w-[360px] mt-2.5 p-2.5 bg-base-200/70 rounded-2xl border border-base-300 space-y-2">
            <!-- Theme & Fast Bleed Bar -->
            <div class="flex items-center justify-between gap-1">
              <div class="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
                <button
                  v-for="(meta, tKey) in OVERLAY_THEMES"
                  :key="tKey"
                  type="button"
                  @click="setTheme(tKey)"
                  class="btn btn-2xs rounded-lg font-bold gap-1 transition-all"
                  :class="selectedTheme === tKey ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost bg-base-100'"
                >
                  <span>{{ meta.emoji }}</span>
                  <span class="text-[10px]">{{ meta.label.split(' ')[0] }}</span>
                </button>
              </div>

              <!-- Quick Bleed Toggle: 0% vs 20% -->
              <button 
                type="button"
                @click="vignetteDarkness = vignetteDarkness > 0 ? 0 : 0.20; renderCurrentSlide()"
                class="btn btn-2xs rounded-lg font-bold gap-1 shrink-0"
                :class="vignetteDarkness === 0 ? 'btn-success text-success-content' : 'btn-warning text-warning-content'"
                title="Toggle background bleeding gradient onto photo"
              >
                <span>{{ vignetteDarkness === 0 ? '🚫 0% Bleed' : '🌤️ 20% Bleed' }}</span>
              </button>
            </div>

            <!-- Card Opacity Quick Chips & Price Toggle -->
            <div class="flex items-center justify-between gap-1 pt-1 border-t border-base-300/60">
              <div class="flex items-center gap-1">
                <span class="text-[9px] font-bold opacity-60 uppercase tracking-wider">Opacity:</span>
                <button 
                  v-for="opVal in [0.50, 0.65, 0.75, 0.90]" 
                  :key="opVal"
                  type="button"
                  @click="burnInCardOpacity = opVal; renderCurrentSlide()"
                  class="btn btn-2xs rounded-lg font-mono font-bold px-1.5"
                  :class="Math.abs(burnInCardOpacity - opVal) < 0.05 ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost bg-base-100'"
                >
                  {{ Math.round(opVal * 100) }}%
                </button>
              </div>

              <!-- Quick Price Toggle (Default Hidden) -->
              <button 
                type="button"
                @click="showBurnInPrice = !showBurnInPrice; renderCurrentSlide()"
                class="btn btn-2xs rounded-lg font-bold gap-1 shrink-0"
                :class="showBurnInPrice ? 'btn-accent text-accent-content' : 'btn-ghost bg-base-100 opacity-70'"
                title="Toggle price badge on graphic (Default Hidden)"
              >
                <span>🏷️ {{ showBurnInPrice ? '$ ON' : '$ OFF' }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- RIGHT: CONTROLS, THEME, SOUND & EXPORT (5 cols) -->
        <div class="lg:col-span-5 space-y-3.5 text-xs">

          <!-- ⚡ 1-CLICK INSTANT LAYOUT PRESETS (ZERO TOUCHY FIDDLING) -->
          <div class="bg-gradient-to-r from-primary/10 via-secondary/10 to-base-200 p-3 rounded-2xl border border-primary/20 space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="font-black text-xs flex items-center gap-1.5 text-primary">
                <Icon icon="solar:bolt-circle-bold" class="w-4 h-4 text-warning" />
                <span>1-Click Layouts (Zero Touchy Sliders)</span>
              </span>
              <span class="badge badge-2xs badge-primary font-bold">Auto-Fitted</span>
            </div>
            <p class="text-[10px] opacity-70 leading-tight">
              Pick a finished design matching your vision. Auto-sizes fonts, trims watermarks, and formats everything:
            </p>
            <div class="grid grid-cols-3 gap-1.5 pt-0.5">
              <button 
                type="button" 
                @click="applyOneClickLayout('portland')"
                class="btn btn-2xs rounded-xl font-bold h-10 flex flex-col items-center justify-center p-1 text-center border transition-all"
                :class="cardTreatment === 'portland_editorial' ? 'btn-primary shadow-xs' : 'btn-ghost bg-base-100 border-base-300'"
                title="Portland Mercury Alt-Weekly: Clean white editorial story card in the center with dark text"
              >
                <span class="text-xs">📰 Story Card</span>
                <span class="text-[8px] opacity-75 font-mono">Portland Mercury</span>
              </button>

              <button 
                type="button" 
                @click="applyOneClickLayout('pin_depot')"
                class="btn btn-2xs rounded-xl font-bold h-10 flex flex-col items-center justify-center p-1 text-center border transition-all"
                :class="cardTreatment === 'promo_flyer' ? 'btn-secondary shadow-xs' : 'btn-ghost bg-base-100 border-base-300'"
                title="Pin Depot Ad Flyer: Bold top commercial headline banner, accent ribbon callout"
              >
                <span class="text-xs">🎯 Promo Ad</span>
                <span class="text-[8px] opacity-75 font-mono">Pin Depot Flyer</span>
              </button>

              <button 
                type="button" 
                @click="applyOneClickLayout('spike_bebop')"
                class="btn btn-2xs rounded-xl font-bold h-10 flex flex-col items-center justify-center p-1 text-center border transition-all"
                :class="cardTreatment === 'cyber_neon' ? 'btn-accent shadow-xs' : 'btn-ghost bg-base-100 border-base-300'"
                title="Spike Spiegel Bebop: Neon cyan glow, syndicate amber bounty tag, Bebop synth"
              >
                <span class="text-xs">🚬 Neo Spike</span>
                <span class="text-[8px] opacity-75 font-mono">Bebop Noir HUD</span>
              </button>
            </div>
          </div>
          
          <!-- 1. TYPOGRAPHY THEME & CARD STYLE STUDIO -->
          <div class="bg-base-200/50 p-3 rounded-2xl border border-base-300 space-y-2.5">
            <div class="flex items-center justify-between">
              <label class="font-black text-xs flex items-center gap-1.5">
                <Icon icon="solar:magic-stick-3-bold" class="w-3.5 h-3.5 text-primary" />
                <span>1. Theme &amp; Card Treatment</span>
              </label>
              <span class="text-[10px] font-mono opacity-60">Snug Content Fit</span>
            </div>

            <!-- Theme Buttons -->
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

            <!-- Card Treatment Selector -->
            <div class="space-y-1 pt-1 border-t border-base-300/60">
              <label class="text-[10px] font-bold opacity-75">Card Treatment / Framing</label>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-1">
                <button 
                  v-for="(tDef, tKey) in CARD_TREATMENTS" 
                  :key="tKey"
                  type="button"
                  @click="cardTreatment = tKey; renderCurrentSlide()"
                  class="btn btn-2xs rounded-lg font-bold justify-start gap-1 h-7"
                  :class="cardTreatment === tKey ? 'btn-secondary text-secondary-content' : 'btn-ghost bg-base-100'"
                  :title="tDef.description"
                >
                  <span>{{ tDef.emoji }}</span>
                  <span class="truncate text-[10px]">{{ tDef.label }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 2. COLOR, CONTRAST & BACKGROUND BLEED STUDIO -->
          <div class="bg-base-200/50 p-3 rounded-2xl border border-base-300 space-y-2.5">
            <div class="flex items-center justify-between">
              <label class="font-black text-xs flex items-center gap-1.5">
                <Icon icon="solar:pallete-2-bold" class="w-3.5 h-3.5 text-secondary" />
                <span>2. Colors &amp; Background Studio</span>
              </label>
              <span class="text-[10px] font-mono text-secondary font-bold">Zero Bleed</span>
            </div>

            <!-- Accent Color Preset Chips + Custom Picker -->
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold opacity-75">Accent &amp; Border Color:</span>
                <button 
                  v-if="accentColor" 
                  type="button" 
                  @click="resetAccentColor"
                  class="text-[9px] text-primary hover:underline font-mono"
                >
                  Reset Default
                </button>
              </div>
              <div class="flex items-center gap-1.5 flex-wrap">
                <button 
                  v-for="color in COLOR_PRESETS" 
                  :key="color.hex"
                  type="button"
                  @click="selectColorPreset(color.hex)"
                  class="btn btn-2xs rounded-lg font-bold gap-1 transition-transform"
                  :class="accentColor === color.hex ? 'ring-2 ring-primary scale-105' : 'bg-base-100'"
                >
                  <span class="w-2.5 h-2.5 rounded-full border border-black/20" :style="{ backgroundColor: color.hex }"></span>
                  <span class="text-[10px]">{{ color.label }}</span>
                </button>

                <!-- Custom Hex / Color Input -->
                <label class="btn btn-2xs rounded-lg bg-base-100 font-bold gap-1 cursor-pointer" title="Custom color picker">
                  <Icon icon="solar:pipette-bold" class="w-3 h-3 text-secondary" />
                  <span class="text-[10px]">{{ accentColor ? accentColor.toUpperCase() : 'Custom' }}</span>
                  <input 
                    type="color" 
                    v-model="accentColor" 
                    @input="renderCurrentSlide"
                    class="w-0 h-0 opacity-0 absolute pointer-events-none" 
                  />
                </label>
              </div>
            </div>

            <!-- Background Bleed Intensity Control -->
            <div class="p-2.5 rounded-xl bg-base-100 border border-base-300/80 space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="font-bold text-[10px] flex items-center gap-1">
                  <span>Photo Bleed (Vignette):</span>
                </span>
                <span class="text-[9px] font-mono font-bold" :class="vignetteDarkness === 0 ? 'text-success' : 'text-warning'">
                  {{ vignetteDarkness === 0 ? '🚫 0% Clean (Zero Bleed)' : (vignetteDarkness <= 0.25 ? '🌤️ 20% Soft' : '🌘 45% Deep') }}
                </span>
              </div>
              <div class="grid grid-cols-3 gap-1">
                <button 
                  type="button" 
                  @click="vignetteDarkness = 0; renderCurrentSlide()"
                  class="btn btn-2xs rounded-lg font-bold"
                  :class="vignetteDarkness === 0 ? 'btn-success text-success-content' : 'btn-ghost bg-base-200/60'"
                >
                  🚫 0% Clean
                </button>
                <button 
                  type="button" 
                  @click="vignetteDarkness = 0.20; renderCurrentSlide()"
                  class="btn btn-2xs rounded-lg font-bold"
                  :class="vignetteDarkness === 0.20 ? 'btn-warning text-warning-content' : 'btn-ghost bg-base-200/60'"
                >
                  🌤️ 20% Soft
                </button>
                <button 
                  type="button" 
                  @click="vignetteDarkness = 0.45; renderCurrentSlide()"
                  class="btn btn-2xs rounded-lg font-bold"
                  :class="vignetteDarkness === 0.45 ? 'btn-neutral' : 'btn-ghost bg-base-200/60'"
                >
                  🌘 45% Deep
                </button>
              </div>
              <p class="text-[9px] opacity-60 leading-tight">
                Controls dark gradient bleeding onto photo. Set to 0% to keep original photo bright and unobstructed.
              </p>
            </div>

            <!-- Card Background Darkness / Opacity -->
            <div class="flex items-center justify-between text-[11px] pt-0.5">
              <span class="opacity-70 font-bold text-[10px]">Card Opacity:</span>
              <div class="join">
                <button 
                  type="button" 
                  @click="burnInCardOpacity = 0.50; renderCurrentSlide()"
                  class="join-item btn btn-2xs font-bold"
                  :class="Math.abs(burnInCardOpacity - 0.50) < 0.05 ? 'btn-primary' : 'btn-ghost bg-base-100'"
                >
                  50% Glass
                </button>
                <button 
                  type="button" 
                  @click="burnInCardOpacity = 0.80; renderCurrentSlide()"
                  class="join-item btn btn-2xs font-bold"
                  :class="Math.abs(burnInCardOpacity - 0.80) < 0.05 ? 'btn-primary' : 'btn-ghost bg-base-100'"
                >
                  80% Studio
                </button>
                <button 
                  type="button" 
                  @click="burnInCardOpacity = 0.95; renderCurrentSlide()"
                  class="join-item btn btn-2xs font-bold"
                  :class="Math.abs(burnInCardOpacity - 0.95) < 0.05 ? 'btn-primary' : 'btn-ghost bg-base-100'"
                >
                  95% Solid
                </button>
                <button 
                  type="button" 
                  @click="burnInCardOpacity = 0; renderCurrentSlide()"
                  class="join-item btn btn-2xs font-bold"
                  :class="burnInCardOpacity === 0 ? 'btn-primary' : 'btn-ghost bg-base-100'"
                >
                  0% Off
                </button>
              </div>
            </div>

            <!-- Auto-Trim Watermark & Text Size Controls -->
            <div class="flex items-center justify-between gap-1 pt-1 border-t border-base-300/60">
              <button 
                type="button" 
                @click="autoTrimWatermarks = !autoTrimWatermarks; renderCurrentSlide()" 
                class="btn btn-2xs rounded-xl font-bold gap-1 shrink-0"
                :class="autoTrimWatermarks ? 'btn-success text-success-content shadow-xs' : 'btn-ghost bg-base-100 border border-base-300'"
                title="Automatically trims out ShopGoodwill & auction header/footer watermarks from photos"
              >
                <span>✂️ {{ autoTrimWatermarks ? 'Watermark Trim: ON' : 'Watermark Trim: OFF' }}</span>
              </button>

              <div class="flex items-center gap-1">
                <span class="text-[9px] font-bold opacity-60">Text Size:</span>
                <div class="join">
                  <button 
                    type="button" 
                    @click="burnInFontScale = 1.0; renderCurrentSlide()" 
                    class="join-item btn btn-2xs font-bold px-1.5"
                    :class="Math.abs(burnInFontScale - 1.0) < 0.05 ? 'btn-primary' : 'btn-ghost bg-base-100'"
                    title="Standard text size"
                  >A</button>
                  <button 
                    type="button" 
                    @click="burnInFontScale = 1.25; renderCurrentSlide()" 
                    class="join-item btn btn-2xs font-bold px-1.5"
                    :class="Math.abs(burnInFontScale - 1.25) < 0.05 ? 'btn-primary' : 'btn-ghost bg-base-100'"
                    title="Large bold text"
                  >A+</button>
                  <button 
                    type="button" 
                    @click="burnInFontScale = 1.5; renderCurrentSlide()" 
                    class="join-item btn btn-2xs font-bold px-1.5"
                    :class="Math.abs(burnInFontScale - 1.5) < 0.05 ? 'btn-primary' : 'btn-ghost bg-base-100'"
                    title="Hero punchy text"
                  >A++</button>
                </div>
              </div>
            </div>

            <!-- Placement & Visibility Toggles -->
            <div class="space-y-1.5 pt-1 border-t border-base-300/60">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold opacity-75">Card Placement:</span>
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

              <!-- Content Toggles: Title, Price (Default OFF), Quote, Venue -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-0.5">
                <label class="label py-1 cursor-pointer justify-start gap-1.5 bg-base-100 px-2 rounded-xl border border-base-300/70">
                  <input type="checkbox" v-model="showBurnInTitle" @change="renderCurrentSlide" class="checkbox checkbox-2xs checkbox-primary" />
                  <span class="label-text text-[10px] font-bold">Title</span>
                </label>
                <label class="label py-1 cursor-pointer justify-start gap-1.5 bg-base-100 px-2 rounded-xl border border-base-300/70" title="Hidden by default">
                  <input type="checkbox" v-model="showBurnInPrice" @change="renderCurrentSlide" class="checkbox checkbox-2xs checkbox-primary" />
                  <span class="label-text text-[10px] font-bold">Price ($)</span>
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
                  @click="setAspectRatio('1:1')"
                  class="join-item btn btn-2xs flex-1 font-bold"
                  :class="aspectRatio === '1:1' ? 'btn-primary' : 'btn-ghost bg-base-100'"
                >
                  1:1 Feed
                </button>
                <button 
                  type="button"
                  @click="setAspectRatio('9:16')"
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
              <div class="flex items-center gap-1.5">
                <button 
                  v-if="currentSlideDescription" 
                  type="button" 
                  @click="currentSlideDescription = ''; renderCurrentSlide()"
                  class="text-[10px] text-error hover:underline font-bold"
                  title="Clear quote text on this slide"
                >
                  ✕ Clear Quote
                </button>
                <span class="text-[9px] font-mono opacity-50">{{ (currentSlide?.description || '').length }} chars</span>
              </div>
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

            <!-- Quick Spike Spiegel Persona Voice Actions -->
            <div class="flex items-center justify-between gap-1.5 pt-0.5">
              <button 
                type="button" 
                @click="applySpikeSpiegelQuote"
                class="btn btn-2xs rounded-xl font-bold bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 gap-1 flex-1 shadow-xs"
                title="Apply authentic Spike Spiegel quote to this slide"
              >
                <span>🚬 Spike Quote</span>
              </button>
              <button 
                type="button" 
                @click="voiceAllSlidesSpikeBebop"
                class="btn btn-2xs rounded-xl font-black bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-500/50 gap-1 flex-1 shadow-xs"
                title="Voice ALL slides in the reel with Spike Spiegel Bebop persona and apply Neo theme"
              >
                <span>⚡ Voice All (Spike Bebop)</span>
              </button>
            </div>
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
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import { 
  type OverlayTheme, 
  type AspectRatio, 
  type OverlayPosition,
  type CardStyleTreatment,
  OVERLAY_THEMES, 
  OVERLAY_POSITIONS,
  CARD_TREATMENTS,
  loadImage, 
  renderSlideToCanvas, 
  renderSlideToBlob, 
  burnAllSlidesToZip, 
  exportSlidesToVideo 
} from '../../lib/slideCanvasEngine';
import { ambientSoundtrack } from '../../lib/ambientSoundtrack';
import { addToast } from '../../stores/toast';
import type { PostMediaSlide } from '../../lib/socialMediaStudio';

const props = withDefaults(defineProps<{
  isOpen: boolean;
  slides: PostMediaSlide[];
  venueName?: string;
  authorHandle?: string;
  initialTheme?: OverlayTheme;
  initialIndex?: number;
  initialCardOpacity?: number;
  initialShowPrice?: boolean;
}>(), {
  initialTheme: 'instagram',
  initialIndex: 0,
  initialCardOpacity: 0.80,
  initialShowPrice: false
});

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
const aspectRatio = ref<AspectRatio>('9:16');
const selectedTheme = ref<OverlayTheme>(props.initialTheme || 'instagram');
const soundPreset = ref<'cyberpunk' | 'antique' | 'lofi' | 'ethereal' | 'none'>('lofi');
const showHowToGuide = ref(false);

// Platform Simulator & Engagement State (Instagram Reels vs TikTok)
const platformSimulationMode = ref<'instagram' | 'tiktok' | 'clean'>('instagram');
const isReelLiked = ref(false);
const likeCount = ref(1842);
const commentCount = ref(42);
const isReelSaved = ref(false);
const isFollowing = ref(false);

function setPlatformSimulationMode(mode: 'instagram' | 'tiktok' | 'clean') {
  platformSimulationMode.value = mode;
  if (mode === 'instagram') {
    selectedTheme.value = 'instagram';
    cardTreatment.value = 'instagram_pill';
  } else if (mode === 'tiktok') {
    selectedTheme.value = 'tiktok';
    cardTreatment.value = 'tiktok_scrim';
  }
  renderCurrentSlide();
}

async function setAspectRatio(ratio: AspectRatio) {
  aspectRatio.value = ratio;
  await nextTick();
  renderCurrentSlide();
}

function toggleLike() {
  isReelLiked.value = !isReelLiked.value;
  likeCount.value += isReelLiked.value ? 1 : -1;
}

function handleCommentClick() {
  addToast({ type: 'info', message: '💬 Comments preview: followers can DM or comment to claim this item.' });
}

function handleShareClick() {
  addToast({ type: 'success', message: '✈️ Share link ready! Ready for Instagram Stories or DMs.' });
}

// Burn-In & Styling Adjustments
const burnInPosition = ref<OverlayPosition>('bottom_card');
const cardTreatment = ref<CardStyleTreatment>('tiktok_scrim');
const burnInCardOpacity = ref<number>(0.80);
const vignetteDarkness = ref<number>(0); // 0 = Clean / No Bleed (Default), 0.20 = Soft, 0.45 = Medium
const accentColor = ref<string>(''); // custom hex or empty for theme default
const burnInFontScale = ref<number>(1.0);
const showBurnInTitle = ref(true);
const showBurnInPrice = ref(false); // DEFAULT FALSE as required!
const showBurnInQuote = ref(true);
const showBurnInVenue = ref(true);
const autoTrimWatermarks = ref<boolean>(true);

// Spike Spiegel Persona Directives & Authentic Quotes
const SPIKE_SPIEGEL_QUOTES = [
  '"Whatever happens, happens."',
  '"You\'re gonna carry that weight."',
  '"I\'m not running. I\'m just watching a dream I couldn\'t wake up from."',
  '"Bang."',
  '"Don\'t look back. Look at the gear."',
  '"Hungry? Forget it. Check the bounty board instead."',
  '"Just another fugitive grail floating in the neon smog."',
  '"Cold steel, neon streets, and zero regrets."',
  '"One eye sees the past, the other sees the present. But this grail is right now."',
  '"A bounty\'s a bounty. Claim it before the Syndicate moves in."'
];

let spikeQuoteIndex = 0;

function getSpikeQuoteForSlide(title?: string, index: number = 0): string {
  const t = (title || '').toLowerCase();
  if (t.includes('book') || t.includes('rpg') || t.includes('cyberpunk') || t.includes('werewolf')) {
    return '"Whatever happens, happens. Syndicate streets left this behind. Claim it before it drifts away. Bang."';
  }
  if (t.includes('jacket') || t.includes('coat') || t.includes('hoodie') || t.includes('carhartt')) {
    return '"Heavy canvas for cold syndicate nights. You\'re gonna carry that weight."';
  }
  if (t.includes('game') || t.includes('cartridge') || t.includes('nintendo') || t.includes('playstation')) {
    return '"Direct interface from the pre-crash era. High tech, low life. Bang."';
  }
  if (t.includes('hat') || t.includes('cap') || t.includes('beanie')) {
    return '"Keep the neon rain off your eyes. Don\'t look back. Bang."';
  }
  return SPIKE_SPIEGEL_QUOTES[index % SPIKE_SPIEGEL_QUOTES.length];
}

function applySpikeSpiegelQuote() {
  const quote = getSpikeQuoteForSlide(currentSlideTitle.value, spikeQuoteIndex++);
  currentSlideDescription.value = quote;
  renderCurrentSlide();
  addToast({ type: 'success', message: '🚬 Applied Spike Spiegel persona quote! Bang.' });
}

function voiceAllSlidesSpikeBebop() {
  if (props.slides.length === 0) return;
  selectedTheme.value = 'cyberpunk';
  cardTreatment.value = 'cyber_neon';
  soundPreset.value = 'cyberpunk';
  
  props.slides.forEach((slide, idx) => {
    const q = getSpikeQuoteForSlide(slide.title, idx);
    slide.description = q;
    emit('update:slideDescription', { index: idx, description: q });
  });

  renderCurrentSlide();
  addToast({
    type: 'success',
    message: `⚡ Voiced all ${props.slides.length} slides in Spike Spiegel Bebop Noir! Bang.`
  });
}

const COLOR_PRESETS = [
  { label: 'Gold', hex: '#d97706' },
  { label: 'Cyan', hex: '#06b6d4' },
  { label: 'Emerald', hex: '#10b981' },
  { label: 'Purple', hex: '#a855f7' },
  { label: 'Crimson', hex: '#ef4444' },
  { label: 'White', hex: '#ffffff' }
];

function selectColorPreset(hex: string) {
  accentColor.value = hex;
  renderCurrentSlide();
}

function resetAccentColor() {
  accentColor.value = '';
  renderCurrentSlide();
}

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

function applyOneClickLayout(preset: 'portland' | 'pin_depot' | 'spike_bebop') {
  if (preset === 'portland') {
    cardTreatment.value = 'portland_editorial';
    selectedTheme.value = 'editorial';
    burnInPosition.value = 'center_spotlight';
    vignetteDarkness.value = 0; // Pure clean photo background
    burnInFontScale.value = 1.0;
    autoTrimWatermarks.value = true;
    soundPreset.value = 'lofi';
    addToast({ type: 'success', message: '📰 1-Click Formatted: Portland Mercury Alt-Weekly Story Card!' });
  } else if (preset === 'pin_depot') {
    cardTreatment.value = 'promo_flyer';
    selectedTheme.value = 'tiktok';
    burnInPosition.value = 'top_banner';
    vignetteDarkness.value = 0.20;
    burnInFontScale.value = 1.0;
    autoTrimWatermarks.value = true;
    soundPreset.value = 'none';
    addToast({ type: 'success', message: '🎯 1-Click Formatted: Pin Depot Commercial Ad Flyer!' });
  } else if (preset === 'spike_bebop') {
    cardTreatment.value = 'cyber_neon';
    selectedTheme.value = 'cyberpunk';
    burnInPosition.value = 'bottom_card';
    vignetteDarkness.value = 0.20;
    burnInFontScale.value = 1.0;
    autoTrimWatermarks.value = true;
    soundPreset.value = 'cyberpunk';
    addToast({ type: 'success', message: '🚬 1-Click Formatted: Spike Spiegel Bebop Noir HUD! Bang.' });
  }
  renderCurrentSlide();
}

function handleClose() {
  stopPlayback();
  ambientSoundtrack.stop();
  emit('close');
}

function setTheme(theme: OverlayTheme) {
  selectedTheme.value = theme;
  if (theme === 'cyberpunk' || (theme as string) === 'neo') {
    cardTreatment.value = 'cyber_neon';
    soundPreset.value = 'cyberpunk';
  } else if (theme === 'instagram') {
    cardTreatment.value = 'instagram_pill';
  } else if (theme === 'tiktok') {
    cardTreatment.value = 'tiktok_scrim';
  }
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
    const img = await loadImage(currentSlide.value.url, currentSlide.value.title, selectedTheme.value);
    renderSlideToCanvas(ctx, img, currentSlide.value, {
      theme: selectedTheme.value,
      aspectRatio: aspectRatio.value,
      venueName: props.venueName,
      showOverlay: burnInPosition.value !== 'none',
      position: burnInPosition.value,
      cardOpacity: burnInCardOpacity.value,
      fontSizeScale: burnInFontScale.value,
      vignetteOpacity: vignetteDarkness.value,
      cardTreatment: cardTreatment.value,
      accentColor: accentColor.value || undefined,
      showTitle: showBurnInTitle.value,
      showPrice: showBurnInPrice.value,
      showQuote: showBurnInQuote.value,
      showVenue: showBurnInVenue.value,
      autoCropWatermark: autoTrimWatermarks.value
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
      vignetteOpacity: vignetteDarkness.value,
      cardTreatment: cardTreatment.value,
      accentColor: accentColor.value || undefined,
      showTitle: showBurnInTitle.value,
      showPrice: showBurnInPrice.value,
      showQuote: showBurnInQuote.value,
      showVenue: showBurnInVenue.value,
      autoCropWatermark: autoTrimWatermarks.value,
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
      vignetteOpacity: vignetteDarkness.value,
      cardTreatment: cardTreatment.value,
      accentColor: accentColor.value || undefined,
      showTitle: showBurnInTitle.value,
      showPrice: showBurnInPrice.value,
      showQuote: showBurnInQuote.value,
      showVenue: showBurnInVenue.value,
      autoCropWatermark: autoTrimWatermarks.value,
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
      vignetteOpacity: vignetteDarkness.value,
      cardTreatment: cardTreatment.value,
      accentColor: accentColor.value || undefined,
      showTitle: showBurnInTitle.value,
      showPrice: showBurnInPrice.value,
      showQuote: showBurnInQuote.value,
      showVenue: showBurnInVenue.value,
      autoCropWatermark: autoTrimWatermarks.value
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
    if (props.initialTheme) selectedTheme.value = props.initialTheme;
    if (typeof props.initialCardOpacity === 'number') burnInCardOpacity.value = props.initialCardOpacity;
    if (typeof props.initialShowPrice === 'boolean') showBurnInPrice.value = props.initialShowPrice;
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

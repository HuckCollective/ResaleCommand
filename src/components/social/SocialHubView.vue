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
    <div v-else-if="currentView === 'studio'" class="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 pb-16">
      
      <!-- STUDIO TOP BREADCRUMB, TITLE & STATUS BAR -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-base-100 p-4 sm:p-5 rounded-3xl border border-base-200 shadow-sm">
        <div class="flex items-center gap-3 min-w-0">
          <!-- Back to Hub Button -->
          <button 
            type="button" 
            @click="handleReturnToHub"
            class="btn btn-sm btn-ghost border border-base-300 gap-1.5 font-black rounded-2xl hover:bg-base-200 transition-all text-xs"
            title="Return to Dropcast Hub"
          >
            <Icon icon="solar:arrow-left-linear" class="w-4 h-4" />
            <span>Hub</span>
          </button>

          <div class="h-6 w-px bg-base-300 shrink-0"></div>

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <input 
                type="text" 
                v-model="studioCastTitle" 
                @blur="syncActiveCastState"
                class="font-black text-lg sm:text-xl text-base-content bg-transparent border-b border-transparent hover:border-base-300 focus:border-primary focus:outline-none px-1 py-0.5 max-w-xs sm:max-w-md truncate"
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
              <span>•</span>
              <span class="font-mono text-success font-bold">${{ totalRetailValue.toFixed(2) }} retail</span>
            </div>
          </div>
        </div>

        <!-- Right Side: Status Selector, Cast Selector, Pick in Inventory and Save -->
        <div class="flex items-center gap-2 flex-wrap">
          <!-- Cast Selector Dropdown (Replaces old Drop Selector!) -->
          <div class="dropdown dropdown-end">
            <button tabindex="0" type="button" class="btn btn-xs sm:btn-sm btn-outline border-base-300 gap-1.5 font-bold font-mono text-xs shadow-2xs hover:border-secondary">
              <Icon icon="solar:broadcast-bold" class="w-3.5 h-3.5 text-secondary" />
              <span class="truncate max-w-[130px] sm:max-w-[180px]">{{ activeCast ? activeCast.title : 'Select Dropcast' }}</span>
              <Icon icon="solar:alt-arrow-down-linear" class="w-3 h-3 opacity-60" />
            </button>
            <ul tabindex="0" class="dropdown-content menu p-2 shadow-2xl bg-base-100 border border-base-300 rounded-2xl w-80 z-50 text-xs space-y-1 mt-1 max-h-80 overflow-y-auto">
              <li class="menu-title text-[10px] uppercase font-bold text-base-content/50 px-2 py-0.5">Switch Dropcast</li>
              <li v-for="c in dropcastsList" :key="c.id">
                <a 
                  :class="{'active font-bold': activeCast && activeCast.id === c.id}"
                  @click="handleSwitchCast(c)"
                  class="flex items-center justify-between gap-2 py-2 px-2.5 rounded-xl"
                >
                  <div class="min-w-0 flex-1 truncate">
                    <div class="font-bold truncate">{{ c.title }}</div>
                    <div class="text-[10px] opacity-60 font-mono">{{ c.locationName }} • {{ (c.items || []).length }} items</div>
                  </div>
                  <span 
                    class="badge badge-xs font-mono font-bold uppercase text-[9px] shrink-0"
                    :class="CAST_STATUS_META[c.status]?.badgeClass"
                  >
                    {{ c.status }}
                  </span>
                </a>
              </li>
              <div class="divider my-1"></div>
              <li>
                <a @click="handleCreateNewStudioCast" class="text-primary font-bold py-1.5 px-2 cursor-pointer">
                  <Icon icon="solar:add-circle-bold" class="w-4 h-4" />
                  <span>+ New Dropcast</span>
                </a>
              </li>
            </ul>
          </div>

          <!-- Status Selector Buttons -->
          <div class="join border border-base-300 rounded-2xl overflow-hidden bg-base-200/50 p-0.5">
            <button 
              type="button" 
              @click="setStudioStatus('draft')"
              class="join-item btn btn-xs font-bold rounded-xl transition-all"
              :class="activeCast?.status === 'draft' ? 'btn-warning text-warning-content shadow-xs' : 'btn-ghost opacity-70 hover:opacity-100'"
            >
              🟡 Draft
            </button>
            <button 
              type="button" 
              @click="setStudioStatus('ready')"
              class="join-item btn btn-xs font-bold rounded-xl transition-all"
              :class="activeCast?.status === 'ready' ? 'btn-info text-info-content shadow-xs' : 'btn-ghost opacity-70 hover:opacity-100'"
            >
              🔵 Ready
            </button>
            <button 
              type="button" 
              @click="setStudioStatus('broadcasted')"
              class="join-item btn btn-xs font-bold rounded-xl transition-all"
              :class="activeCast?.status === 'broadcasted' ? 'btn-success text-success-content shadow-xs' : 'btn-ghost opacity-70 hover:opacity-100'"
            >
              🟢 Cast
            </button>
          </div>

          <!-- Direct Link to /inventory -->
          <a 
            href="/inventory" 
            class="btn btn-xs sm:btn-sm btn-outline border-primary/40 text-primary hover:bg-primary hover:text-primary-content font-bold rounded-2xl gap-1 shadow-2xs"
            title="Open inventory catalog to search, filter, and stage items using the selection tray"
          >
            <Icon icon="solar:cart-large-minimalistic-bold" class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">+ Pick in /inventory</span>
            <span class="sm:hidden">+ Pick</span>
          </a>

          <!-- Save / Done Button -->
          <button 
            type="button" 
            @click="handleSaveStudioCast"
            class="btn btn-xs sm:btn-sm btn-primary text-primary-content font-bold rounded-2xl gap-1.5 shadow-2xs"
            title="Save Dropcast"
          >
            <Icon icon="solar:diskette-bold" class="w-3.5 h-3.5" />
            <span>Save</span>
          </button>
        </div>
      </div>

    <!-- ======================================================== -->
    <!-- SECTION 1: TOP SECTION (PHONE PREVIEW & AI COPYWRITER)  -->
    <!-- ======================================================== -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      <!-- LEFT: SMARTPHONE LIVE POST PREVIEW (5 cols) -->
      <div class="lg:col-span-5 space-y-3">
        <div class="card bg-base-100 border border-base-200 shadow-sm p-4 sm:p-5 rounded-3xl space-y-3">
          <div class="flex items-center justify-between text-xs pb-1">
            <div class="flex items-center gap-2 font-bold">
              <Icon icon="solar:smartphone-bold" class="w-4 h-4 text-secondary" />
              <span>DropCast Live Phone Preview</span>
            </div>

            <!-- Quick Copy Button -->
            <button 
              type="button" 
              @click="copyToClipboard" 
              :disabled="!generatedCaption"
              class="btn btn-xs gap-1.5 font-bold transition-all shadow-xs rounded-xl"
              :class="isCopied ? 'btn-success text-white' : 'btn-primary text-primary-content'"
            >
              <Icon :icon="isCopied ? 'solar:check-circle-bold' : 'solar:copy-bold'" class="w-3.5 h-3.5" />
              <span>{{ isCopied ? 'Copied!' : 'Copy Text' }}</span>
            </button>
          </div>

          <!-- Burn-In Adjustment Toolbar -->
          <div class="bg-base-200/60 p-2.5 rounded-2xl border border-base-300/80 space-y-2 text-xs">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5 font-black text-[11px]">
                <Icon icon="solar:magic-stick-3-bold" class="w-3.5 h-3.5 text-primary" />
                <span>Stylized Text Burn-In</span>
              </div>
              <button 
                type="button" 
                @click="showPhoneBurnIn = !showPhoneBurnIn"
                class="btn btn-2xs font-bold gap-1 rounded-lg transition-all"
                :class="showPhoneBurnIn ? 'btn-primary shadow-xs' : 'btn-ghost bg-base-100'"
                :title="showPhoneBurnIn ? 'Hide text overlay' : 'Show text overlay on photos'"
              >
                <span>{{ showPhoneBurnIn ? '🎨 On Photos' : '🚫 Raw Photos' }}</span>
              </button>
            </div>

            <div v-if="showPhoneBurnIn" class="space-y-1.5 pt-0.5">
              <!-- Theme Quick Selector -->
              <div class="flex items-center justify-between gap-1">
                <span class="text-[10px] font-bold opacity-60">Theme:</span>
                <div class="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  <button 
                    v-for="(meta, tKey) in OVERLAY_THEMES" 
                    :key="tKey"
                    type="button"
                    @click="selectedOverlayTheme = tKey"
                    class="btn btn-2xs px-2 rounded-lg font-bold truncate transition-all"
                    :class="selectedOverlayTheme === tKey ? 'btn-secondary text-secondary-content shadow-xs' : 'btn-ghost bg-base-100'"
                    :title="meta.label"
                  >
                    <span>{{ meta.emoji }}</span>
                    <span class="hidden sm:inline">{{ meta.label.split(' ')[0] }}</span>
                  </button>
                </div>
              </div>

              <!-- Position Selector -->
              <div class="flex items-center justify-between gap-1 text-[10px]">
                <span class="font-bold opacity-60">Position:</span>
                <div class="join">
                  <button 
                    v-for="pos in (['bottom_card', 'top_banner', 'center_spotlight', 'bottom_compact', 'none'] as const)"
                    :key="pos"
                    type="button"
                    @click="phoneBurnInPosition = pos"
                    class="join-item btn btn-2xs font-bold"
                    :class="phoneBurnInPosition === pos ? 'btn-neutral' : 'btn-ghost bg-base-100'"
                    :title="OVERLAY_POSITIONS[pos]?.label"
                  >
                    <span>{{ OVERLAY_POSITIONS[pos]?.emoji }}</span>
                  </button>
                </div>
              </div>

              <!-- Visibility & Opacity -->
              <div class="flex items-center justify-between gap-2 pt-0.5 text-[10px]">
                <div class="flex items-center gap-2">
                  <label class="cursor-pointer flex items-center gap-1">
                    <input type="checkbox" v-model="showBurnInPrice" class="checkbox checkbox-2xs checkbox-primary" />
                    <span class="font-bold opacity-80">Price</span>
                  </label>
                  <label class="cursor-pointer flex items-center gap-1">
                    <input type="checkbox" v-model="showBurnInQuote" class="checkbox checkbox-2xs checkbox-primary" />
                    <span class="font-bold opacity-80">Quote</span>
                  </label>
                </div>
                <div class="flex items-center gap-1">
                  <button 
                    v-for="op in [0.60, 0.88, 0.98]" 
                    :key="op"
                    type="button" 
                    @click="phoneBurnInCardOpacity = op"
                    class="btn btn-2xs px-1.5"
                    :class="phoneBurnInCardOpacity === op ? 'btn-primary' : 'btn-ghost bg-base-100'"
                  >
                    {{ Math.round(op * 100) }}%
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- SMARTPHONE MOCKUP FRAME -->
          <div class="rounded-[38px] border-4 border-base-300 shadow-2xl overflow-hidden bg-black text-white max-w-[340px] mx-auto flex flex-col justify-between relative select-none">
            
            <!-- Phone Dynamic Island Notch -->
            <div class="pt-2 px-6 flex justify-between items-center text-[10px] font-mono opacity-80 z-20">
              <span>10:42</span>
              <div class="w-20 h-4 bg-black border border-white/20 rounded-full mx-auto"></div>
              <div class="flex items-center gap-1">
                <Icon icon="solar:wifi-bold" class="w-3 h-3" />
                <Icon icon="solar:battery-charge-bold" class="w-3 h-3" />
              </div>
            </div>

            <!-- Post Header (Handle + Avatar + Location) -->
            <div class="px-3.5 py-2.5 flex items-center justify-between bg-black/90 z-10 border-b border-white/10 mt-1">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-full p-0.5 bg-linear-to-tr from-amber-500 via-pink-500 to-purple-600 shrink-0">
                  <div class="w-full h-full rounded-full bg-black flex items-center justify-center text-xs font-black text-white">
                    RC
                  </div>
                </div>
                <div class="min-w-0">
                  <div class="font-black text-xs leading-none truncate">@{{ authorAccountHandle || 'resalecommand' }}</div>
                  <div class="text-[9px] opacity-70 truncate mt-0.5">📍 Available at {{ currentTargetLocation }} • Portland, OR</div>
                </div>
              </div>
              <Icon icon="solar:menu-dots-bold" class="w-4 h-4 opacity-70" />
            </div>

            <!-- Carousel Media Viewport -->
            <div class="relative aspect-square w-full bg-black/80 flex items-center justify-center overflow-hidden group">
              <img 
                v-if="currentCarouselPhoto"
                :src="currentCarouselPhoto" 
                class="w-full h-full object-cover transition-all duration-300"
                alt="Social Drop Preview"
                @error="onCarouselImageError"
              />
              <div v-else class="flex flex-col items-center justify-center opacity-40 text-xs p-4 text-center">
                <Icon icon="solar:gallery-wide-linear" class="w-10 h-10 mb-1" />
                <span>Stage items or add photos below to preview</span>
              </div>

              <!-- STYLIZED BURN-IN OVERLAY LAYER (Live on Smartphone Photo) -->
              <div 
                v-if="currentCarouselPhoto && showPhoneBurnIn && phoneBurnInPosition !== 'none'"
                class="absolute inset-0 pointer-events-none select-none z-10 flex flex-col p-3 transition-all duration-300"
                :class="{
                  'justify-end': phoneBurnInPosition === 'bottom_card' || phoneBurnInPosition === 'bottom_compact',
                  'justify-start': phoneBurnInPosition === 'top_banner',
                  'justify-center': phoneBurnInPosition === 'center_spotlight'
                }"
              >
                <!-- Subtle Gradient Vignette Backdrop -->
                <div 
                  v-if="phoneBurnInPosition === 'bottom_card' || phoneBurnInPosition === 'bottom_compact'"
                  class="absolute inset-x-0 bottom-0 h-44 bg-linear-to-t from-black/85 via-black/40 to-transparent pointer-events-none"
                ></div>
                <div 
                  v-else-if="phoneBurnInPosition === 'top_banner'"
                  class="absolute inset-x-0 top-0 h-44 bg-linear-to-b from-black/85 via-black/40 to-transparent pointer-events-none"
                ></div>
                <div 
                  v-else-if="phoneBurnInPosition === 'center_spotlight'"
                  class="absolute inset-0 bg-black/60 pointer-events-none"
                ></div>

                <!-- Theme-Styled Card -->
                <div 
                  class="relative z-10 p-2.5 rounded-2xl shadow-xl transition-all duration-300 backdrop-blur-xs"
                  :style="{ opacity: phoneBurnInCardOpacity }"
                  :class="[
                    // Antique
                    selectedOverlayTheme === 'antique' 
                      ? 'bg-[#1b1511]/95 text-amber-100 border border-amber-600/70 font-serif shadow-amber-950/50' : '',
                    // Cyberpunk
                    selectedOverlayTheme === 'cyberpunk'
                      ? 'bg-black/90 text-cyan-300 border border-cyan-400 font-mono shadow-cyan-950/50' : '',
                    // Minimalist
                    selectedOverlayTheme === 'minimalist'
                      ? 'bg-black/90 text-white border border-white/30 font-sans shadow-black/80' : '',
                    // Editorial
                    selectedOverlayTheme === 'editorial'
                      ? 'bg-white/95 text-black border border-black font-serif shadow-2xl' : '',
                    // Boutique
                    selectedOverlayTheme === 'boutique'
                      ? 'bg-[#23120b]/95 text-amber-200 border border-amber-500/60 font-mono shadow-black' : ''
                  ]"
                >
                  <!-- Top Row: Location / Venue & Price -->
                  <div class="flex items-center justify-between gap-1.5 pb-1">
                    <span 
                      v-if="showBurnInVenue"
                      class="text-[9px] tracking-wider uppercase opacity-75 truncate"
                      :class="selectedOverlayTheme === 'antique' ? 'text-amber-400 tracking-widest' : ''"
                    >
                      📍 {{ currentTargetLocation }}
                    </span>
                    <span 
                      v-if="showBurnInPrice && currentSlideDisplayPrice !== null"
                      class="badge badge-xs font-mono font-black shrink-0"
                      :class="[
                        selectedOverlayTheme === 'antique' ? 'bg-amber-600/40 text-amber-300 border-amber-500/50' : '',
                        selectedOverlayTheme === 'cyberpunk' ? 'bg-emerald-950 text-emerald-300 border border-emerald-400' : '',
                        selectedOverlayTheme === 'minimalist' ? 'bg-white text-black font-bold' : '',
                        selectedOverlayTheme === 'editorial' ? 'bg-black text-white' : '',
                        selectedOverlayTheme === 'boutique' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : ''
                      ]"
                    >
                      ${{ currentSlideDisplayPrice.toFixed(2) }}
                    </span>
                  </div>

                  <!-- Middle: Item Title -->
                  <h4 
                    v-if="showBurnInTitle && currentSlideDisplayTitle" 
                    class="font-black leading-tight text-xs tracking-tight line-clamp-1"
                    :class="[
                      selectedOverlayTheme === 'antique' ? 'text-amber-100 font-serif' : '',
                      selectedOverlayTheme === 'cyberpunk' ? 'text-cyan-400 tracking-wide' : '',
                      selectedOverlayTheme === 'editorial' ? 'text-black tracking-tighter' : ''
                    ]"
                  >
                    {{ currentSlideDisplayTitle }}
                  </h4>

                  <!-- Bottom: Poetic Micro-Quote / Narrative -->
                  <p 
                    v-if="showBurnInQuote && currentSlideDisplayQuote && phoneBurnInPosition !== 'bottom_compact'" 
                    class="text-[10px] leading-snug pt-1 line-clamp-2 italic opacity-85"
                    :class="[
                      selectedOverlayTheme === 'antique' ? 'text-amber-200/90 font-serif' : '',
                      selectedOverlayTheme === 'cyberpunk' ? 'text-pink-300 font-mono not-italic text-[9px]' : '',
                      selectedOverlayTheme === 'editorial' ? 'text-black/80 font-serif' : ''
                    ]"
                  >
                    "{{ currentSlideDisplayQuote }}"
                  </p>
                </div>
              </div>

              <!-- Carousel Slide Controls -->
              <button 
                v-if="carouselPhotos.length > 1"
                type="button" 
                @click="prevCarouselSlide"
                class="btn btn-circle btn-xs bg-black/60 hover:bg-black text-white absolute left-2 top-1/2 -translate-y-1/2 border border-white/20 z-20"
              >
                ‹
              </button>

              <button 
                v-if="carouselPhotos.length > 1"
                type="button" 
                @click="nextCarouselSlide"
                class="btn btn-circle btn-xs bg-black/60 hover:bg-black text-white absolute right-2 top-1/2 -translate-y-1/2 border border-white/20 z-20"
              >
                ›
              </button>

              <!-- Slide Counter Pill -->
              <div v-if="carouselPhotos.length > 0" class="absolute top-2.5 right-2.5 badge badge-neutral bg-black/75 border border-white/20 font-mono text-[9px] py-1 px-2 z-20">
                {{ activeCarouselIndex + 1 }} / {{ carouselPhotos.length }}
              </div>
            </div>

            <!-- Social Action Bar -->
            <div class="p-3 bg-black/95 flex items-center justify-between border-t border-white/10">
              <div class="flex items-center gap-3">
                <button type="button" @click="isLiked = !isLiked" class="hover:scale-110 transition-transform">
                  <Icon icon="solar:heart-bold" class="w-5 h-5" :class="isLiked ? 'text-red-500' : 'text-white'" />
                </button>
                <Icon icon="solar:chat-round-line-bold" class="w-5 h-5 text-white/90" />
                <Icon icon="solar:plain-bold" class="w-5 h-5 text-white/90" />
              </div>
              <Icon icon="solar:bookmark-bold" class="w-5 h-5 text-white/90" />
            </div>

            <!-- Caption Display Box -->
            <div class="px-3 pb-4 pt-1 bg-black/95 space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin text-left">
              <div class="text-[10px] font-bold opacity-80">Liked by collectors and followers</div>
              <div class="text-[11px] leading-relaxed text-white/90 whitespace-pre-wrap font-sans">
                <span class="font-black text-white mr-1.5">@{{ authorAccountHandle || 'resalecommand' }}</span>
                <span>{{ generatedCaption || 'Click "Generate Post Copy" to summon copy for your staged items...' }}</span>
              </div>
              <div class="text-[9px] opacity-50 font-mono pt-1">Curated Dropcast • {{ currentTargetLocation }}</div>
            </div>

            <!-- Phone Bottom Home Indicator Bar -->
            <div class="pb-1.5 pt-1 bg-black flex justify-center">
              <div class="w-28 h-1 bg-white/40 rounded-full"></div>
            </div>
          </div>

          <!-- Active Slide Text Quick Adjuster -->
          <div v-if="carouselPhotos.length > 0" class="bg-base-200/50 p-2.5 rounded-2xl border border-base-300/80 space-y-1.5 text-xs">
            <div class="flex items-center justify-between">
              <span class="font-bold text-[11px] flex items-center gap-1">
                <span>Slide #{{ activeCarouselIndex + 1 }} Text &amp; Quote:</span>
              </span>
              <button 
                type="button" 
                @click="autoAssignDescriptions"
                :disabled="!generatedCaption"
                class="text-[10px] text-secondary hover:underline font-bold flex items-center gap-0.5"
                title="Extract quotes from caption"
              >
                <Icon icon="solar:magic-stick-3-bold" class="w-3 h-3" />
                <span>Auto-Extract Quotes</span>
              </button>
            </div>
            <div class="grid grid-cols-3 gap-1.5">
              <input 
                v-model="currentSlideDisplayTitle" 
                placeholder="Item Title"
                class="input input-xs input-bordered col-span-2 rounded-xl bg-base-100 font-bold"
              />
              <div class="relative col-span-1">
                <span class="absolute left-2 top-1/2 -translate-y-1/2 text-xs opacity-50 font-bold">$</span>
                <input 
                  type="number" 
                  step="0.01"
                  v-model.number="currentSlideDisplayPrice" 
                  placeholder="Price"
                  class="input input-xs input-bordered w-full pl-5 rounded-xl bg-base-100 font-mono"
                />
              </div>
            </div>
            <textarea 
              v-model="currentSlideDisplayQuote" 
              rows="2"
              placeholder="Add micro-narrative quote for this photo..."
              class="textarea textarea-bordered textarea-xs w-full rounded-xl bg-base-100 resize-none leading-relaxed text-xs"
            ></textarea>
          </div>

          <!-- Bottom Action Buttons -->
          <div class="space-y-2 pt-1">
            <!-- Animated Reel / Video Player Trigger -->
            <button 
              type="button" 
              @click="openReelStudio(activeCarouselIndex)" 
              :disabled="carouselPhotos.length === 0"
              class="btn btn-sm w-full bg-linear-to-r from-purple-600 via-indigo-600 to-pink-600 hover:brightness-110 text-white font-black rounded-xl gap-2 shadow-md shadow-purple-500/20 border-none h-10 active:scale-95 transition-all"
            >
              <Icon icon="solar:play-circle-bold" class="w-4 h-4" />
              <span>🎬 Play Animated Reel &amp; Music</span>
            </button>

            <div class="grid grid-cols-2 gap-2">
              <button 
                type="button" 
                @click="autoAssignDescriptions" 
                :disabled="!generatedCaption"
                class="btn btn-xs btn-outline border-base-300 font-bold rounded-xl gap-1 text-[11px] hover:border-secondary"
                title="Extract AI narrative paragraphs and assign to each slide photo"
              >
                <Icon icon="solar:magic-stick-3-bold" class="w-3.5 h-3.5 text-secondary" />
                <span class="truncate">Auto-Burn Text</span>
              </button>

              <button 
                type="button" 
                @click="downloadAllAsZip" 
                :disabled="isZipping || carouselPhotos.length === 0"
                class="btn btn-xs btn-outline border-base-300 font-bold rounded-xl gap-1 text-[11px]"
              >
                <Icon icon="solar:archive-down-minimlistic-bold" class="w-3.5 h-3.5" />
                <span class="truncate">Raw Media (.zip)</span>
              </button>
            </div>
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
            <div class="grid grid-cols-3 gap-1.5">
              <button 
                type="button" 
                v-for="p in platforms" 
                :key="p.id"
                class="btn btn-xs rounded-xl font-bold gap-1 transition-all h-8"
                :class="selectedPlatform === p.id ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost bg-base-200'"
                @click="selectedPlatform = p.id"
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
        </div>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- SECTION 2: UNIFIED POST MEDIA GALLERY & CAROUSEL REEL    -->
    <!-- ======================================================== -->
    <div class="card bg-base-100 border border-base-200 shadow-sm p-4 sm:p-5 rounded-3xl space-y-3">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-base-200">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black shrink-0">
            <Icon icon="solar:clapperboard-play-bold" class="w-4 h-4" />
          </div>
          <div>
            <h3 class="font-black text-sm sm:text-base flex items-center gap-2">
              <span>Unified Post Media Gallery &amp; Carousel Reel</span>
              <span class="badge badge-sm badge-primary font-mono font-bold">{{ postMediaList.length }} Slides</span>
            </h3>
            <p class="text-[11px] opacity-65">
              All post media in one gallery. Slide #1 is the Cover Photo (⭐). Mix booth displays, catalog photos, and live camera snaps.
            </p>
          </div>
        </div>

        <!-- Quick Gallery Actions -->
        <div class="flex items-center gap-2 flex-wrap">
          <button 
            v-if="postMediaList.length > 0"
            type="button" 
            @click="openReelStudio(0)"
            class="btn btn-xs btn-primary text-primary-content font-black gap-1.5 rounded-xl shadow-xs"
            title="Open Animated Reel & Story Studio with soundtrack"
          >
            <Icon icon="solar:play-circle-bold" class="w-3.5 h-3.5" />
            <span>🎬 Play Reel &amp; Mix Sound</span>
          </button>

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

          <button 
            type="button" 
            @click="openBoothCamera"
            class="btn btn-xs btn-outline border-base-300 font-bold gap-1 rounded-xl hover:border-secondary"
            title="Snap a photo of the booth or item"
          >
            <Icon icon="solar:camera-bold" class="w-3.5 h-3.5 text-secondary" />
            <span>+ Snap Photo</span>
          </button>

          <button 
            type="button" 
            @click="triggerUploadInput"
            class="btn btn-xs btn-outline border-base-300 font-bold gap-1 rounded-xl hover:border-primary"
            title="Upload photo files"
          >
            <Icon icon="solar:upload-bold" class="w-3.5 h-3.5 text-primary" />
            <span>+ Upload</span>
          </button>

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

          <button 
            v-if="postMediaList.length > 0"
            type="button" 
            @click="postMediaList = []" 
            class="btn btn-ghost btn-xs text-error font-bold"
            title="Clear all slides from reel"
          >
            Clear Reel
          </button>
        </div>
      </div>

      <!-- Empty Reel State -->
      <div 
        v-if="postMediaList.length === 0" 
        class="p-6 text-center rounded-2xl border-2 border-dashed border-base-300 bg-base-200/30 space-y-2"
      >
        <Icon icon="solar:album-linear" class="w-10 h-10 opacity-30 mx-auto" />
        <div class="text-xs font-bold opacity-75">No slides in Media Gallery yet</div>
        <div class="text-[11px] opacity-60 max-w-md mx-auto">
          Add photos using <strong>"+ Snap Photo"</strong>, <strong>"+ Upload"</strong>, or click <strong>"+ Add to Reel"</strong> on any staged item below.
        </div>
      </div>

      <!-- Populated Ordered Slides Track -->
      <div v-else class="space-y-2">
        <div class="flex items-stretch gap-3 overflow-x-auto pb-3 pt-1 scrollbar-thin">
          <div 
            v-for="(slide, idx) in postMediaList" 
            :key="slide.id"
            class="shrink-0 w-36 sm:w-40 p-2.5 rounded-2xl border bg-base-100 flex flex-col justify-between transition-all group relative cursor-pointer shadow-xs"
            :class="activeCarouselIndex === idx ? 'border-primary ring-2 ring-primary/40 bg-primary/5' : 'border-base-200 hover:border-base-300'"
            @click="activeCarouselIndex = idx"
          >
            <!-- Slide Index Pill & Delete Button -->
            <div class="flex items-center justify-between mb-1.5 z-10">
              <span 
                class="badge badge-xs font-mono font-black"
                :class="idx === 0 ? 'badge-primary text-[9px] shadow-xs' : 'badge-neutral text-[9px]'"
              >
                {{ idx === 0 ? '⭐ Cover' : '#' + (idx + 1) }}
              </span>

              <div class="flex items-center gap-1">
                <button 
                  v-if="idx !== 0"
                  type="button" 
                  @click.stop="setSlideAsCover(idx)" 
                  class="btn btn-ghost btn-xs h-5 px-1 text-[9px] text-amber-500 font-bold hover:bg-amber-500/10 rounded-md"
                  title="Make this slide the Cover (Slide #1)"
                >
                  ⭐ Cover
                </button>
                <button 
                  type="button" 
                  @click.stop="removeSlide(idx)" 
                  class="w-5 h-5 rounded-full bg-base-300/80 hover:bg-error hover:text-white flex items-center justify-center text-[10px] font-bold opacity-70 group-hover:opacity-100 transition-opacity"
                  title="Remove slide"
                >
                  ✕
                </button>
              </div>
            </div>

            <!-- Thumbnail Image -->
            <div class="aspect-square rounded-xl overflow-hidden bg-black/20 mb-2 relative">
              <img 
                :src="slide.url" 
                class="w-full h-full object-cover" 
                loading="lazy" 
                @error="onSlideImageError" 
              />
              <span 
                v-if="slide.type === 'item_hero'" 
                class="badge badge-xs badge-secondary font-bold text-[8px] absolute bottom-1 left-1 opacity-90"
              >
                Hero
              </span>
              <span 
                v-else-if="slide.type === 'item_gallery'" 
                class="badge badge-xs badge-neutral font-bold text-[8px] absolute bottom-1 left-1 opacity-90"
              >
                Detail
              </span>
              <span 
                v-else-if="slide.type === 'booth_display'" 
                class="badge badge-xs badge-accent font-bold text-[8px] absolute bottom-1 left-1 opacity-90"
              >
                Booth
              </span>
            </div>

            <!-- Title, Price & Burned Quote -->
            <div class="min-w-0 mb-1.5 space-y-1">
              <div class="font-bold text-[11px] truncate leading-tight" :title="slide.title">{{ slide.title }}</div>
              <div v-if="slide.price" class="font-mono font-black text-secondary text-[10px]">${{ formatPrice(slide.price) }}</div>

              <!-- Stylized Text / Quote Preview Pill -->
              <div @click.stop="openReelStudio(idx)">
                <div 
                  v-if="slide.description" 
                  class="p-1 rounded-lg bg-base-200/90 border border-base-300 text-[9px] leading-tight opacity-80 line-clamp-2 italic hover:border-primary transition-colors cursor-pointer"
                  :title="'Click to edit stylized text:\n' + slide.description"
                >
                  "{{ slide.description }}"
                </div>
                <button 
                  v-else
                  type="button" 
                  class="text-[9px] text-primary/70 hover:text-primary flex items-center gap-0.5 hover:underline"
                  title="Add stylized quote or description onto this picture"
                >
                  <Icon icon="solar:pen-bold" class="w-2.5 h-2.5" />
                  <span>+ Add Quote</span>
                </button>
              </div>
            </div>

            <!-- Reorder Arrow Controls: ◀ Move Earlier | ▶ Move Later -->
            <div class="flex items-center justify-between pt-1.5 border-t border-base-200/80 gap-1" @click.stop>
              <button 
                type="button" 
                @click="moveSlideLeft(idx)" 
                :disabled="idx === 0"
                class="btn btn-xs btn-ghost btn-square h-6 w-6 rounded-lg font-black"
                :class="idx === 0 ? 'opacity-20 cursor-not-allowed' : 'text-primary hover:bg-primary/10'"
                title="Move slide earlier (◀)"
              >
                ◀
              </button>

              <span class="text-[9px] font-mono opacity-50 font-bold">Slide {{ idx + 1 }}</span>

              <button 
                type="button" 
                @click="moveSlideRight(idx)" 
                :disabled="idx === postMediaList.length - 1"
                class="btn btn-xs btn-ghost btn-square h-6 w-6 rounded-lg font-black"
                :class="idx === postMediaList.length - 1 ? 'opacity-20 cursor-not-allowed' : 'text-primary hover:bg-primary/10'"
                title="Move slide later (▶)"
              >
                ▶
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- SECTION 3: STAGED ITEMS FOR THIS CAST (REPLACES DROP LIST)-->
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

      <!-- Populated Staged Items Grid -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div 
          v-for="(item, idx) in filteredStudioItems" 
          :key="getItemKey(item) + idx"
          class="p-3 rounded-2xl border border-base-200 bg-base-100 hover:border-base-300 hover:shadow-xs flex items-center justify-between gap-3 transition-all"
        >
          <!-- Left: Thumbnail & Details -->
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <ItemThumbnail 
              :item="item" 
              :src="resolveItemPhoto(item) || ''" 
              size="md" 
              rounded="xl" 
            />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <h4 class="font-black text-xs text-base-content truncate" :title="item.title">{{ item.title }}</h4>
              </div>
              <div class="flex items-center gap-2 mt-0.5 text-[11px] font-mono">
                <span class="text-secondary font-black">${{ formatPrice(item.boutiquePrice || item.resalePrice || item.price) }}</span>
                <span v-if="item.brand" class="badge badge-xs badge-neutral font-mono truncate max-w-[100px]">{{ item.brand }}</span>
                <span v-if="item.storageLocation" class="opacity-60 text-[10px] truncate">📍 {{ item.storageLocation }}</span>
              </div>
            </div>
          </div>

          <!-- Right: Item Actions -->
          <div class="flex items-center gap-1 shrink-0">
            <button 
              type="button" 
              @click="addAllItemPhotos(item)" 
              class="btn btn-ghost btn-xs btn-square text-primary hover:bg-primary/10 rounded-lg"
              title="Add photos to Media Reel"
            >
              <Icon icon="solar:gallery-wide-bold" class="w-4 h-4" />
            </button>
            <button 
              type="button" 
              @click="openItemInDrawer(item)" 
              class="btn btn-ghost btn-xs btn-square text-base-content/70 hover:bg-base-200 rounded-lg"
              title="Edit item in drawer"
            >
              <Icon icon="solar:pen-bold" class="w-4 h-4" />
            </button>
            <button 
              type="button" 
              @click="unstageItem(item)" 
              class="btn btn-ghost btn-xs btn-square text-error hover:bg-error/10 rounded-lg"
              title="Unstage item from this cast"
            >
              <Icon icon="solar:trash-bin-trash-bold" class="w-4 h-4" />
            </button>
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
      @close="isReelPlayerOpen = false"
      @update:slideDescription="updateSlideDescription"
    />

    <!-- ======================================================== -->
    <!-- CANONICAL TRAY TRACKER: PERSISTENT FLOATING BOTTOM DOCK  -->
    <!-- ======================================================== -->
    <div 
      v-if="studioItems.length > 0 || boothGalleryPhotos.length > 0"
      class="fixed bottom-0 inset-x-0 z-40 bg-base-100/95 backdrop-blur-2xl border-t border-base-300 shadow-2xl transition-all"
    >
      <div class="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        <!-- Left: Tray Summary Stats & Thumbnails -->
        <div class="flex items-center gap-3 min-w-0">
          <div class="flex items-center gap-2 text-left">
            <div class="w-9 h-9 rounded-xl bg-primary text-primary-content flex items-center justify-center font-black shadow-md shadow-primary/20 shrink-0">
              <Icon icon="solar:broadcast-bold" class="w-5 h-5" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-black text-xs sm:text-sm text-base-content">{{ activeCast?.title || 'Cast Workstation' }}</span>
                <span class="badge badge-sm badge-secondary font-mono font-bold">{{ studioItems.length }} item{{ studioItems.length === 1 ? '' : 's' }}</span>
                <span v-if="postMediaList.length > 0" class="badge badge-sm badge-outline font-mono font-bold">{{ postMediaList.length }} slide{{ postMediaList.length === 1 ? '' : 's' }}</span>
              </div>
              <div class="text-[11px] font-mono opacity-70 truncate">
                <span class="text-success font-black">${{ totalRetailValue.toFixed(2) }} retail</span>
                <span class="mx-1">•</span>
                <span>{{ currentTargetLocation }}</span>
              </div>
            </div>
          </div>

          <!-- Mini Thumbnail Preview Strip (Max 5 items) -->
          <div class="hidden md:flex items-center -space-x-2 overflow-hidden py-1 px-1">
            <div 
              v-for="(it, idx) in studioItems.slice(0, 5)" 
              :key="getItemKey(it) + idx"
              class="w-8 h-8 rounded-lg overflow-hidden border-2 border-base-100 shadow-xs bg-base-300 shrink-0"
              :title="it.title"
            >
              <img v-if="resolveItemPhoto(it)" :src="resolveItemPhoto(it)!" class="w-full h-full object-cover" @error="onSlideImageError" />
              <div v-else class="w-full h-full flex items-center justify-center text-[9px] font-bold">#{{ idx + 1 }}</div>
            </div>
            <div 
              v-if="studioItems.length > 5" 
              class="w-8 h-8 rounded-lg bg-base-300 border-2 border-base-100 text-[10px] font-bold flex items-center justify-center font-mono opacity-80 shrink-0"
            >
              +{{ studioItems.length - 5 }}
            </div>
          </div>
        </div>

        <!-- Right: Tray Actions & Quick Generate CTA -->
        <div class="flex items-center gap-2 shrink-0">
          <button 
            type="button" 
            @click="clearAllStaged" 
            class="btn btn-xs sm:btn-sm btn-ghost text-error font-bold hidden sm:inline-flex"
            title="Clear all staged items"
          >
            Clear
          </button>

          <button 
            type="button" 
            @click="downloadAllAsZip" 
            :disabled="isZipping || (postMediaList.length === 0 && studioItems.length === 0)"
            class="btn btn-xs sm:btn-sm btn-outline border-base-300 font-bold gap-1 rounded-xl hidden md:inline-flex"
            title="Download all media"
          >
            <Icon icon="solar:archive-down-minimlistic-bold" class="w-4 h-4" />
            <span>.ZIP</span>
          </button>

          <button 
            v-if="postMediaList.length > 0 || studioItems.length > 0"
            type="button" 
            @click="openReelStudio(0)"
            class="btn btn-xs sm:btn-sm btn-outline border-purple-500/50 text-purple-400 hover:bg-purple-600 hover:text-white font-bold gap-1 rounded-xl hidden sm:inline-flex"
            title="Open Animated Reel &amp; Story Studio with soundtrack"
          >
            <Icon icon="solar:play-circle-bold" class="w-3.5 h-3.5" />
            <span>Reel Studio 🎬</span>
          </button>

          <a 
            href="/inventory"
            class="btn btn-xs sm:btn-sm btn-secondary text-secondary-content font-black rounded-xl gap-1 shadow-md active:scale-95"
            title="Pick more items in inventory catalog"
          >
            <Icon icon="solar:cart-large-minimalistic-bold" class="w-3.5 h-3.5" />
            <span>+ Pick in /inventory</span>
          </a>

          <button 
            type="button" 
            @click="generateCaption"
            :disabled="isGenerating || carouselPhotos.length === 0"
            class="btn btn-xs sm:btn-sm btn-primary text-primary-content font-black rounded-xl gap-1.5 shadow-md shadow-primary/25 active:scale-95"
          >
            <span v-if="isGenerating" class="loading loading-spinner loading-xs"></span>
            <Icon v-else icon="solar:magic-stick-3-bold" class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">{{ isGenerating ? 'Summoning...' : '✨ Generate Post' }}</span>
            <span class="sm:hidden">Generate</span>
          </button>
        </div>
      </div>
    </div>


  </div>
</div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, defineAsyncComponent } from 'vue';
import { Icon } from '@iconify/vue';
import DropcastHubDashboard from './DropcastHubDashboard.vue';
import ItemThumbnail from '../common/ItemThumbnail.vue';
import { useDropcasts } from '../../composables/useDropcasts';
import { type Dropcast, type CastStatus, CAST_TYPE_META, CAST_STATUS_META } from '../../lib/dropcastModel';
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

const studioCastTitle = ref('');

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
const includePrices = ref<boolean>(true);
const customNotes = ref<string>('');
const isGenerating = ref<boolean>(false);
const isZipping = ref<boolean>(false);
const zipProgressPercent = ref<number>(0);
const zipProgressMessage = ref<string>('');
const isCopied = ref<boolean>(false);
const isLiked = ref<boolean>(false);
const generatedCaption = ref<string>('');
const lastSource = ref<string>('');

// Personas
const personaPresets = SOCIAL_PERSONAS;
const selectedPersonaId = ref<string>('lestat');
const customTonePrompt = ref<string>(personaPresets[0].prompt);
const activePersonaLabel = computed(() => personaPresets.find(p => p.id === selectedPersonaId.value)?.label || 'Custom Tone');
function applyPersona(p: typeof personaPresets[0]) {
  selectedPersonaId.value = p.id;
  customTonePrompt.value = p.prompt;
  generateCaption();
}

// Platforms
const platforms = [
  { id: 'instagram', label: 'Instagram', icon: 'solar:instagram-bold' },
  { id: 'facebook', label: 'Facebook', icon: 'solar:facebook-bold' },
  { id: 'story', label: 'Story Reel', icon: 'solar:clapperboard-play-bold' }
];
const selectedPlatform = ref<'instagram' | 'facebook' | 'story'>('instagram');

// Media Reel & Carousel
const postMediaList = ref<PostMediaSlide[]>([]);
const activeCarouselIndex = ref<number>(0);
const isReelPlayerOpen = ref<boolean>(false);
const reelStudioInitialIndex = ref<number>(0);
const selectedOverlayTheme = ref<OverlayTheme>('antique');

// Burn-In Adjustments for Live Phone Preview
const showPhoneBurnIn = ref<boolean>(true);
const phoneBurnInPosition = ref<OverlayPosition>('bottom_card');
const phoneBurnInCardOpacity = ref<number>(0.88);
const showBurnInTitle = ref<boolean>(true);
const showBurnInPrice = ref<boolean>(true);
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
  if (item.customPhotoDataUrl) return item.customPhotoDataUrl;
  const urls = getItemImageUrls(item);
  if (urls.length > 0) return urls[0];
  return getItemImageUrl(item, 600);
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
  activeCast.value.status = status;
  updateActiveCast({ status });
  addToast({ type: 'info', message: `Status updated to ${CAST_STATUS_META[status]?.label || status}` });
}

function syncActiveCastState() {
  if (!activeCast.value) return;
  updateActiveCast({
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
  addToast({ type: 'success', message: `Set "${slide.title.slice(0, 20)}" as Cover photo! ⭐` });
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

// Caption Generation
async function generateCaption() {
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

onMounted(() => {
  fetchAllDrafts();
  fetchPurchases();
  fetchInventory();
  loadLocationPhotos();

  // Handle direct navigation via prop or URL query params (e.g. /social/1, /social?cast=..., /social?id=...)
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
});
</script>

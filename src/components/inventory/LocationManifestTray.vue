<template>
  <div v-if="showTray" class="relative z-[70]">
    <!-- EXPANDABLE MANIFEST DRAWER / MODAL -->
    <div 
      class="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex flex-col justify-end transition-opacity"
      @click.self="toggleTray"
    >
      <div class="bg-base-100 border-t border-base-300 rounded-t-box max-w-2xl mx-auto w-full max-h-[85dvh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200 overflow-hidden">
        
        <!-- Drag Handle Affordance -->
        <div class="w-12 h-1.5 bg-base-content/20 rounded-full mx-auto mt-2.5 mb-0.5 shrink-0"></div>

        <!-- ACTIVE MANIFEST VIEW -->
        <template v-if="activeManifest">
        <!-- Drawer Header with Inline Title Editing & Lock/Pause Controls -->
        <div class="px-4 py-2.5 sm:px-5 sm:py-3.5 border-b border-base-300 flex items-center justify-between gap-3 shrink-0">
          <div class="min-w-0 flex-1">
            <!-- Title Row: Display or Inline Edit Mode -->
            <div class="flex items-center gap-2 flex-wrap">
              <template v-if="isEditingTitle">
                <div class="flex items-center gap-1.5 flex-1 max-w-sm">
                  <input 
                    ref="titleInputRef"
                    v-model="editedTitle" 
                    type="text" 
                    class="input input-xs sm:input-sm input-bordered font-bold text-sm w-full"
                    placeholder="Manifest Title"
                    @keyup.enter="saveTitle"
                    @keyup.esc="isEditingTitle = false"
                  />
                  <button 
                    @click="saveTitle" 
                    :disabled="savingTitle || !editedTitle.trim()"
                    class="btn btn-xs sm:btn-sm btn-primary text-primary-content font-bold px-2 shrink-0" 
                    title="Save Title"
                  >
                    <Icon icon="solar:check-read-linear" class="w-4 h-4" />
                  </button>
                  <button 
                    @click="isEditingTitle = false" 
                    class="btn btn-xs sm:btn-sm btn-ghost px-2 shrink-0" 
                    title="Cancel"
                  >
                    ✕
                  </button>
                </div>
              </template>
              <template v-else>
                <div class="flex items-center gap-1.5 min-w-0">
                  <Icon icon="solar:box-minimalistic-bold" class="w-5 h-5 text-primary shrink-0" />
                  <h3 class="text-base sm:text-lg font-black text-base-content truncate">
                    {{ activeManifest.name || 'Outbound Manifest' }}
                  </h3>
                </div>
                <button 
                  v-if="!isLocked && activeManifest.status !== 'placed'"
                  @click="startEditTitle" 
                  class="btn btn-ghost btn-xs btn-circle opacity-60 hover:opacity-100 hover:bg-base-200"
                  title="Rename Manifest"
                >
                  <Icon icon="solar:pen-bold" class="w-3.5 h-3.5 text-primary" />
                </button>
              </template>
            </div>

            <div class="text-xs font-mono flex items-center gap-2 mt-0.5 opacity-75">
              <span class="font-bold text-primary flex items-center gap-1">
                <Icon icon="solar:shop-2-bold" class="w-3.5 h-3.5" />
                <span>{{ activeManifest.locationName || 'Memory Den' }}</span>
              </span>
              <span class="opacity-40">•</span>
              <span class="shrink-0 font-bold">
                {{ totalUnits }} {{ totalUnits === 1 ? 'unit' : 'units' }}
                <template v-if="totalUnits !== stagedCount">({{ stagedCount }} unique)</template> staged
              </span>
              <span v-if="activeManifest.status === 'placed'" class="badge badge-xs badge-success text-success-content font-bold uppercase font-mono ml-1">
                Placed &amp; Closed
              </span>
            </div>
          </div>

          <!-- Close button -->
          <div class="flex items-center gap-1.5 shrink-0">
            <button @click="toggleTray" type="button" class="btn btn-ghost btn-sm btn-circle shrink-0" title="Close Tray">
              <Icon icon="solar:close-circle-bold" class="w-6 h-6 opacity-60 hover:opacity-100" />
            </button>
          </div>
        </div>

        <!-- Financial Summary Banner (Counterpart to Scout Tray Banner) -->
        <div class="bg-base-200/70 p-3 sm:p-4 border-b border-base-300 shrink-0 space-y-2.5">
          <div class="grid grid-cols-4 gap-1.5 sm:gap-2 text-center">
            <div class="bg-base-100 p-1.5 sm:p-2 rounded-box border border-base-300/80">
              <div class="text-[9px] uppercase font-bold opacity-60 truncate">Landed Cost</div>
              <div class="font-mono font-black text-xs sm:text-base text-warning truncate">${{ totalCost.toFixed(2) }}</div>
            </div>
            <div class="bg-base-100 p-1.5 sm:p-2 rounded-box border border-base-300/80">
              <div class="text-[9px] uppercase font-bold opacity-60 truncate">Tag Retail</div>
              <div class="font-mono font-black text-xs sm:text-base text-secondary truncate">${{ totalRetail.toFixed(2) }}</div>
            </div>
            <div class="bg-base-100 p-1.5 sm:p-2 rounded-box border border-base-300/80">
              <div class="text-[9px] uppercase font-bold opacity-60 truncate">Est. Net (-{{ commissionRate }}%)</div>
              <div class="font-mono font-black text-xs sm:text-base text-success truncate">${{ estimatedNet.toFixed(2) }}</div>
            </div>
            <div class="bg-base-100 p-1.5 sm:p-2 rounded-box border border-base-300/80">
              <div class="text-[9px] uppercase font-bold opacity-60 truncate">Est. Profit</div>
              <div class="font-mono font-black text-xs sm:text-base truncate" :class="estimatedProfit >= 0 ? 'text-primary' : 'text-error'">
                {{ estimatedProfit >= 0 ? '+' : '-' }}${{ Math.abs(estimatedProfit).toFixed(2) }}
              </div>
            </div>
          </div>

          <!-- In-Transit / Verify Tip Banner -->
          <div v-if="isLocked" class="bg-info/10 border border-info/30 rounded-box p-2.5 text-xs flex items-center justify-between gap-2 text-info-content">
            <div class="flex items-center gap-2 min-w-0">
              <Icon icon="solar:lock-bold" class="w-4 h-4 text-info shrink-0" />
              <span class="truncate">Drop locked in-transit. Tap items as you sticker &amp; place them on shelves:</span>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button 
                type="button" 
                class="btn btn-xs btn-ghost text-info font-black"
                @click="toggleAllVerified"
              >
                {{ verifiedItemIds.size === stagedItems.length ? 'Deselect All' : 'Select All' }}
              </button>
              <button 
                type="button" 
                class="btn btn-xs btn-warning text-warning-content font-bold gap-1 shadow-xs"
                @click="handleUnlock"
                title="Unlock drop to add or remove items"
              >
                <Icon icon="solar:lock-unlocked-bold" class="w-3.5 h-3.5" />
                <span>Unlock</span>
              </button>
            </div>
          </div>

          <!-- Placed / Closed Finalized Banner -->
          <div v-else-if="activeManifest.status === 'placed'" class="bg-success/10 border border-success/30 rounded-box p-2.5 text-xs flex items-center justify-between gap-2 text-success-content">
            <div class="flex items-center gap-2 min-w-0">
              <Icon icon="solar:check-circle-bold" class="w-4 h-4 text-success shrink-0" />
              <span class="truncate">Drop Placed &amp; Finalized! Items are active in booth.</span>
            </div>
            <button 
              type="button" 
              class="btn btn-xs btn-warning font-black gap-1 text-warning-content shadow-xs"
              @click="handleOpenRollbackModal(activeManifest.$id)"
              title="Rollback this drop: restores items to backstock and reopens manifest as draft"
            >
              <Icon icon="solar:restart-bold" class="w-3.5 h-3.5" />
              <span>Undo &amp; Reopen</span>
            </button>
          </div>
        </div>

        <!-- Manifest Items List: Unified Staging & Sticker-Matching Station -->
        <div class="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-48 scrollbar-thin">
          <div v-if="stagedItems.length === 0" class="text-center py-12 text-base-content/50 space-y-2">
            <Icon icon="solar:box-minimalistic-linear" class="w-10 h-10 mx-auto opacity-30 text-primary" />
            <p class="text-sm font-bold">This outbound drop is empty.</p>
            <p class="text-xs max-w-xs mx-auto">Select items in Inventory using checkboxes and tap <strong>"Stage for Manifest"</strong> to add them!</p>
          </div>

          <div 
            v-for="item in stagedItems" 
            :key="item.$id"
            @click="isLocked ? toggleItemVerified(item.$id) : openItemEditor(item)"
            class="border rounded-2xl p-3 flex items-center justify-between gap-3 transition-all group cursor-pointer select-none"
            :class="isLocked 
              ? (verifiedItemIds.has(item.$id) ? 'bg-success/10 border-success/50 shadow-xs' : 'bg-base-200/50 border-base-300 hover:border-base-content/20')
              : 'bg-base-200/50 border-base-300 hover:border-primary/40 hover:bg-base-200/80'"
            :title="isLocked ? 'Tap to verify item stickered & placed on shelf' : 'Click to view full specs & edit in ItemDrawer'"
          >
            <!-- Checkbox in In-Transit / Verify Mode -->
            <input 
              v-if="isLocked"
              type="checkbox" 
              :checked="verifiedItemIds.has(item.$id)"
              class="checkbox checkbox-sm checkbox-success shrink-0"
              @click.stop="toggleItemVerified(item.$id)"
            />

            <!-- Thumbnail Image -->
            <div class="w-12 h-12 rounded-xl bg-base-300 flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-transform relative">
              <img 
                v-if="item.imageId" 
                :src="getImageUrl(item.imageId)" 
                @error="handleImageError($event, item.imageId)"
                class="w-full h-full object-cover" 
                alt="Thumbnail"
              />
              <Icon v-else icon="solar:tag-bold" class="w-6 h-6 opacity-40" />
              <div v-if="isLocked && verifiedItemIds.has(item.$id)" class="absolute inset-0 bg-success/30 flex items-center justify-center text-success-content font-black">
                <Icon icon="solar:check-circle-bold" class="w-6 h-6 text-success drop-shadow-md" />
              </div>
            </div>

            <!-- Title & Metadata with HIGH-CONTRAST Barcode for Sticker Matching -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <!-- HIGH VISIBILITY UPC BARCODE BADGE -->
                <span v-if="item.upc" class="badge badge-sm font-mono font-black bg-primary/20 text-primary border border-primary/40 text-xs px-2 shadow-2xs">
                  UPC: {{ item.upc }}
                </span>
                <span v-if="item.quantity > 1" class="badge badge-xs badge-outline badge-primary font-bold">
                  Qty: {{ item.quantity }}
                </span>
                <h4 class="font-bold text-xs text-base-content truncate group-hover:text-primary transition-colors" :class="{'line-through opacity-70': isLocked && verifiedItemIds.has(item.$id)}">
                  {{ cleanTitle(item.title) }}
                </h4>
              </div>

              <div class="flex items-center gap-2 text-[10px] opacity-75 mt-1 font-mono">
                <span>Cost: <strong class="text-warning font-mono">${{ (Number(item.cost) || 0).toFixed(2) }}</strong></span>
                <span>•</span>
                <span>Tag: <strong class="text-secondary font-black text-xs font-mono">${{ (Number(item.boutiquePrice || item.resalePrice || item.price) || 0).toFixed(2) }}</strong></span>
                <span v-if="item.storageLocation" class="opacity-50">({{ item.storageLocation }})</span>
              </div>
            </div>

            <!-- Actions: Edit in ItemDrawer & Remove Buttons -->
            <div class="flex items-center gap-1 shrink-0">
              <button 
                type="button"
                @click.stop="openItemEditor(item)"
                class="btn btn-ghost btn-xs btn-circle opacity-70 hover:opacity-100 hover:bg-primary/10 text-primary transition-all"
                title="Open ItemDrawer to edit price or condition"
              >
                <Icon icon="solar:pen-bold" class="w-3.5 h-3.5" />
              </button>
              <button 
                v-if="!isLocked"
                type="button"
                @click.stop="itemPendingDelete = item"
                class="btn btn-ghost btn-xs btn-circle text-error/60 hover:text-error hover:bg-error/10 transition-all"
                title="Remove from manifest"
              >
                <Icon icon="solar:trash-bin-trash-linear" class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <!-- Drawer Footer Dock -->
        <div class="p-3 sm:p-4 border-t border-base-300 bg-base-200/90 backdrop-blur-md flex flex-col gap-2.5 shrink-0">
          <!-- Row 1: Symmetrical Utility Buttons (3 items) -->
          <div class="grid grid-cols-3 gap-1.5 sm:gap-2 w-full">
            <!-- 1. Switch Drops Dropdown -->
            <div class="dropdown dropdown-top w-full">
              <button tabindex="0" type="button" class="btn btn-ghost btn-sm gap-1 font-mono text-[11px] bg-base-100 hover:bg-base-300 border border-base-300 rounded-btn h-10 w-full flex items-center justify-center shadow-xs">
                <span class="truncate">Drops ({{ allAvailableDrops.length }})</span>
                <Icon icon="solar:alt-arrow-up-linear" class="w-3.5 h-3.5 opacity-60 shrink-0" />
              </button>
              <ul tabindex="0" class="dropdown-content menu p-2 shadow-2xl bg-base-100 border border-base-300 rounded-box w-max min-w-[300px] max-w-[calc(100vw-2rem)] sm:max-w-md z-[90] text-xs space-y-1 mb-1 max-h-80 overflow-y-auto">
                <li class="menu-title text-[10px] uppercase font-bold text-base-content/50 px-2 py-0.5">Active &amp; In-Transit Drops</li>
                <li v-for="d in displayedDrafts" :key="d.$id">
                  <a 
                    :class="{'active font-bold': d.$id === activeManifest.$id}"
                    @click="handleResumeOrSwitch(d.$id)"
                    class="flex items-center justify-between gap-3 py-2 px-2.5 rounded-btn"
                  >
                    <span class="truncate flex-1 min-w-0 font-medium">{{ d.name }}</span>
                    <span 
                      class="badge badge-xs shrink-0 font-mono font-bold uppercase text-[9px]" 
                      :class="d.status === 'paused' ? 'badge-warning' : (d.status === 'in-transit' || d.status === 'exported' ? 'badge-info' : 'badge-neutral')"
                    >
                      {{ d.status }}
                    </span>
                  </a>
                </li>

                <!-- Recent Placed Drops Archive in Dropdown -->
                <template v-if="displayedPlacedDrops.length > 0">
                  <li class="menu-title text-[10px] uppercase font-bold text-base-content/50 px-2 py-0.5 mt-1 border-t border-base-200">Past Placed Drops (Archive)</li>
                  <li v-for="pd in displayedPlacedDrops" :key="pd.$id">
                    <a 
                      :class="{'active font-bold': pd.$id === activeManifest.$id}"
                      @click="handleResumeOrSwitch(pd.$id)"
                      class="flex items-center justify-between gap-3 py-2 px-2.5 rounded-btn"
                    >
                      <span class="truncate flex-1 min-w-0 font-medium opacity-80">{{ pd.name }}</span>
                      <span class="badge badge-xs badge-success text-success-content shrink-0 font-mono font-bold uppercase text-[9px]">
                        placed
                      </span>
                    </a>
                  </li>
                </template>

                <li class="border-t border-base-200 mt-1 pt-1">
                  <a @click="handleStartNewDrop" class="text-primary font-bold flex items-center gap-1.5 cursor-pointer rounded-btn">
                    <Icon icon="solar:add-circle-bold" class="w-4 h-4" />
                    <span>+ Start New Drop</span>
                  </a>
                </li>
              </ul>
            </div>

            <!-- 2. Context Action: Pause / Resume / Unlock / Rollback -->
            <button 
              v-if="activeManifest.status === 'placed'"
              type="button" 
              @click="handleOpenRollbackModal(activeManifest.$id)"
              class="btn btn-ghost btn-sm gap-1 font-bold text-xs rounded-btn bg-base-100 hover:bg-warning/20 hover:text-warning border border-base-300 transition-all h-10 w-full flex items-center justify-center shadow-xs"
              title="Undo placement and reopen this drop as draft"
            >
              <Icon icon="solar:restart-bold" class="w-4 h-4 text-warning" />
              <span>Reopen</span>
            </button>
            <button 
              v-else-if="activeManifest.status === 'draft'"
              type="button" 
              @click="handlePause"
              class="btn btn-ghost btn-sm gap-1 font-bold text-xs rounded-btn bg-base-100 hover:bg-warning/20 hover:text-warning border border-base-300 transition-all h-10 w-full flex items-center justify-center shadow-xs"
              title="Pause drop (hides from screen)"
            >
              <Icon icon="solar:pause-circle-bold" class="w-4 h-4 text-warning" />
              <span>Pause</span>
            </button>
            <button 
              v-else-if="isLocked"
              type="button" 
              @click="handleUnlock"
              class="btn btn-ghost btn-sm text-warning hover:bg-warning/15 border border-warning/30 rounded-btn gap-1 font-bold text-xs h-10 w-full flex items-center justify-center transition-all shadow-xs"
              title="Unlock drop to add or fix items"
            >
              <Icon icon="solar:lock-unlocked-bold" class="w-4 h-4" />
              <span>Unlock</span>
            </button>
            <button 
              v-else-if="activeManifest.status === 'paused'"
              type="button" 
              @click="handleResume(activeManifest.$id)"
              class="btn btn-ghost btn-sm text-warning hover:bg-warning/15 border border-warning/30 rounded-btn gap-1 font-bold text-xs h-10 w-full flex items-center justify-center transition-all shadow-xs"
              title="Resume drop"
            >
              <Icon icon="solar:play-circle-bold" class="w-4 h-4" />
              <span>Resume</span>
            </button>

            <!-- 3. Unverify / Discard / Export Action -->
            <button 
              v-if="activeManifest.status === 'placed'"
              type="button" 
              @click="handleExportCsv"
              class="btn btn-ghost btn-sm gap-1 font-bold text-xs rounded-btn bg-base-100 hover:bg-base-300 border border-base-300 transition-all h-10 w-full flex items-center justify-center shadow-xs"
              title="Download POS CSV"
            >
              <Icon icon="solar:file-download-bold" class="w-4 h-4 text-success" />
              <span>Export</span>
            </button>
            <button 
              v-else-if="isLocked"
              type="button" 
              @click="handleUnverifyAll"
              class="btn btn-ghost btn-sm text-info hover:bg-info/15 border border-info/30 rounded-btn gap-1 font-bold text-xs h-10 w-full flex items-center justify-center transition-all shadow-xs"
              title="Uncheck all items on this in-transit drop"
            >
              <Icon icon="solar:refresh-circle-bold" class="w-4 h-4" />
              <span>Unverify</span>
            </button>
            <button 
              v-else
              type="button" 
              @click="isDiscardModalOpen = true"
              class="btn btn-ghost btn-sm text-error hover:bg-error/15 border border-error/25 rounded-btn gap-1 font-bold text-xs h-10 w-full flex items-center justify-center transition-all shadow-xs"
              title="Discard this manifest"
            >
              <Icon icon="solar:trash-bin-trash-linear" class="w-4 h-4" />
              <span>Discard</span>
            </button>
          </div>

          <!-- Row 2: Contextual Primary Action Button -->
          <!-- State A: Placed / Closed Finalized Drop -->
          <div v-if="activeManifest.status === 'placed'" class="w-full">
            <button 
              type="button" 
              @click="handleOpenRollbackModal(activeManifest.$id)"
              class="btn btn-warning w-full font-black text-warning-content shadow-lg px-4 gap-2 h-11 active:scale-95 transition-all text-sm sm:text-base flex items-center justify-center rounded-btn"
              title="Rollback this drop: restores items to Backstock and reopens manifest as active draft"
            >
              <Icon icon="solar:restart-bold" class="w-5 h-5 shrink-0" />
              <span>Undo Placement &amp; Reopen Drop ➔</span>
            </button>
          </div>

          <!-- State B: In-Transit Verification Mode -->
          <div v-else-if="isLocked" class="w-full flex flex-col sm:flex-row gap-2">
            <button 
              type="button" 
              @click="handleOpenRollbackModal(activeManifest.$id)"
              class="btn btn-outline border-warning/40 text-warning hover:bg-warning/10 font-bold px-3.5 gap-1.5 h-11 active:scale-95 transition-all text-xs sm:text-sm flex items-center justify-center rounded-btn shrink-0"
              title="Rollback this in-transit drop to draft"
            >
              <Icon icon="solar:restart-bold" class="w-4 h-4" />
              <span>Rollback</span>
            </button>

            <button 
              type="button" 
              @click="confirmPlacement" 
              :disabled="verifiedItemIds.size === 0 || isDeploying"
              class="btn btn-success flex-1 font-black text-success-content shadow-lg px-4 gap-2 h-11 active:scale-95 transition-all text-sm sm:text-base flex items-center justify-center rounded-btn"
              title="Confirm verified items are stocked on booth shelves"
            >
              <span v-if="isDeploying" class="loading loading-spinner loading-xs"></span>
              <template v-else>
                <Icon icon="solar:check-circle-bold" class="w-5 h-5 shrink-0" />
                <span>Confirm Stocked at {{ activeManifest.locationName || 'Booth' }} ({{ verifiedItemIds.size }} of {{ stagedItems.length }} items) ➔</span>
              </template>
            </button>
          </div>

          <!-- State C: Draft Staging Mode -->
          <div v-else class="flex flex-col sm:flex-row gap-2 w-full">
            <button 
              type="button" 
              @click="handleLock" 
              :disabled="stagedItems.length === 0"
              class="btn btn-primary flex-1 font-black text-primary-content shadow-lg px-4 gap-2 h-11 active:scale-95 transition-all text-sm sm:text-base flex items-center justify-center rounded-btn"
              title="Lock drop in-transit: ready to take to the booth"
            >
              <Icon icon="solar:lock-bold" class="w-5 h-5 shrink-0" />
              <span class="whitespace-nowrap">Lock Drop (In-Transit) ➔</span>
            </button>

            <button 
              v-if="isRicochetFacility"
              id="btn-download-ricochet-csv"
              type="button" 
              @click="handleExportCsv" 
              :disabled="isExporting || stagedItems.length === 0"
              class="btn btn-outline border-base-300 hover:btn-success font-bold px-4 gap-2 h-11 active:scale-95 transition-all text-xs sm:text-sm flex items-center justify-center rounded-btn shrink-0"
              title="Download Ricochet POS CSV &amp; Lock Drop"
            >
              <span v-if="isExporting" class="loading loading-spinner loading-xs"></span>
              <template v-else>
                <Icon icon="solar:file-download-bold" class="w-4 h-4 shrink-0 text-success" />
                <span class="whitespace-nowrap">Export POS CSV</span>
              </template>
            </button>
          </div>
        </div>
        </template>

        <!-- NO ACTIVE MANIFEST: SELECT / RESUME DROP VIEW -->
        <template v-else>
          <!-- Header -->
          <div class="px-4 py-3 sm:px-5 border-b border-base-300 flex items-center justify-between gap-3 shrink-0">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon icon="solar:box-minimalistic-bold" class="w-4 h-4" />
              </div>
              <div class="min-w-0">
                <h3 class="text-base font-black text-base-content truncate">
                  {{ props.locationName ? `${props.locationName} Drops` : 'Outbound Drop Manifests' }}
                </h3>
                <p class="text-[10px] sm:text-xs text-base-content/60 font-mono truncate">
                  {{ props.locationName ? `Select a paused drop to resume, or start a new drop for ${props.locationName}` : 'Select a paused drop to resume, or start a new drop' }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button 
                type="button" 
                @click="toggleTray" 
                class="btn btn-ghost btn-sm btn-circle shrink-0" 
                title="Close Tray"
              >
                <Icon icon="solar:close-circle-bold" class="w-5 h-5 opacity-60 hover:opacity-100" />
              </button>
            </div>
          </div>

          <!-- Body: List of Drafts / Paused Drops -->
          <div class="flex-1 overflow-y-auto p-4 space-y-2.5 scrollbar-thin">
            <div v-if="displayedDrafts && displayedDrafts.length > 0" class="space-y-2.5">
              <div 
                v-for="d in displayedDrafts" 
                :key="d.$id"
                class="p-3.5 rounded-2xl border border-base-300 bg-base-200/50 hover:bg-base-200 hover:border-primary/40 transition-all flex items-center justify-between gap-3"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <div 
                    class="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0"
                    :class="d.locationId === 'MD' ? 'bg-primary/15 text-primary' : (d.locationId === 'DT' ? 'bg-secondary/15 text-secondary' : 'bg-warning/15 text-warning')"
                  >
                    {{ d.locationId || 'DROP' }}
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <h4 class="font-black text-xs sm:text-sm text-base-content truncate">{{ d.name }}</h4>
                      <span 
                        class="badge badge-xs font-bold font-mono"
                        :class="d.status === 'paused' ? 'badge-warning' : (d.status === 'in-transit' || d.status === 'exported' ? 'badge-info text-info-content' : 'badge-success text-success-content')"
                      >
                        {{ d.status === 'paused' ? '⏸ Paused' : (d.status === 'in-transit' ? '🔒 In-Transit' : 'Active Draft') }}
                      </span>
                    </div>
                    <div class="text-[10px] text-base-content/60 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{{ d.itemCount || d.itemsSnapshot?.length || 0 }} items</span>
                      <span v-if="d.totalRetail">• ${{ Number(d.totalRetail).toFixed(2) }} retail</span>
                      <span v-if="d.locationName" class="opacity-75">({{ d.locationName }})</span>
                    </div>
                  </div>
                </div>

                <button 
                  type="button" 
                  class="btn btn-sm btn-primary text-primary-content font-bold px-3 rounded-xl gap-1 shrink-0 shadow-xs"
                  @click="handleResumeOrSwitch(d.$id)"
                >
                  <span>{{ d.status === 'paused' ? 'Resume' : (d.status === 'in-transit' ? 'Inspect' : 'Open') }}</span>
                  <Icon icon="solar:arrow-right-linear" class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- Empty state when 0 drafts exist -->
            <div v-else class="text-center py-12 space-y-2.5 text-base-content/60">
              <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <Icon icon="solar:box-minimalistic-linear" class="w-6 h-6" />
              </div>
              <p class="font-bold text-sm text-base-content">
                {{ props.locationName ? `No Drop Manifests for ${props.locationName}` : 'No Drop Manifests Found' }}
              </p>
              <p class="text-xs max-w-xs mx-auto text-base-content/70">
                {{ props.locationName ? `Create a new drop to stage items for ${props.locationName}.` : 'Create a drop to begin staging items for Memory Den, Dusty Tiger, or Online Backstock.' }}
              </p>
            </div>
          </div>

          <!-- Sticky Footer with + Start New Drop Button -->
          <div class="p-3.5 border-t border-base-300 bg-base-100 flex items-center justify-between gap-2 shrink-0">
            <button 
              type="button" 
              @click="toggleTray" 
              class="btn btn-sm btn-ghost font-bold"
            >
              Close
            </button>
            <button 
              type="button" 
              @click="handleStartNewDrop" 
              class="btn btn-sm btn-primary text-primary-content font-black px-4 rounded-xl gap-1.5 shadow-md flex-1 sm:flex-initial"
            >
              <Icon icon="solar:add-circle-bold" class="w-4 h-4" />
              <span>+ Start New Drop {{ props.locationName ? `for ${props.locationName}` : '' }}</span>
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- 1. DISCARD MANIFEST CONFIRMATION MODAL -->
    <dialog class="modal modal-bottom sm:modal-middle z-[80]" :class="{ 'modal-open': isDiscardModalOpen }">
      <div v-if="isDiscardModalOpen" class="modal-box bg-base-100 border border-base-300 shadow-2xl rounded-3xl p-5 sm:p-6 max-w-sm mx-auto">
        <div class="flex items-center gap-3 text-error mb-3">
          <div class="w-10 h-10 rounded-2xl bg-error/15 flex items-center justify-center shrink-0">
            <Icon icon="solar:trash-bin-trash-bold" class="w-6 h-6 text-error" />
          </div>
          <div>
            <h3 class="font-black text-base sm:text-lg text-base-content">Discard Manifest?</h3>
            <p class="text-xs opacity-60 font-mono">{{ activeManifest?.name }}</p>
          </div>
        </div>
        
        <p class="text-xs sm:text-sm text-base-content/80 mb-5 leading-relaxed">
          This will remove the draft manifest. Your inventory items will <strong>not</strong> be deleted; they will simply return to unstaged.
        </p>

        <div class="modal-action flex items-center gap-2 mt-0">
          <button 
            type="button" 
            @click="isDiscardModalOpen = false" 
            class="btn btn-ghost flex-1 rounded-xl font-bold"
          >
            Cancel
          </button>
          <button 
            type="button" 
            @click="confirmDiscard" 
            class="btn btn-error flex-1 rounded-xl font-black text-error-content shadow-md gap-1.5"
          >
            <span>Yes, Discard</span>
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="isDiscardModalOpen = false">
        <button>close</button>
      </form>
    </dialog>

    <!-- 2. REMOVE ITEM CONFIRMATION MODAL -->
    <dialog class="modal modal-bottom sm:modal-middle z-[80]" :class="{ 'modal-open': !!itemPendingDelete }">
      <div v-if="itemPendingDelete" class="modal-box bg-base-100 border border-base-300 shadow-2xl rounded-3xl p-5 sm:p-6 max-w-sm mx-auto">
        <div class="flex items-center gap-3 text-error mb-3">
          <div class="w-10 h-10 rounded-2xl bg-error/15 flex items-center justify-center shrink-0">
            <Icon icon="solar:trash-bin-trash-bold" class="w-6 h-6 text-error" />
          </div>
          <div>
            <h3 class="font-black text-base sm:text-lg text-base-content">Remove from Drop?</h3>
            <p class="text-xs opacity-60 font-mono truncate max-w-44">{{ itemPendingDelete.title }}</p>
          </div>
        </div>

        <p class="text-xs text-base-content/70 mb-5 leading-relaxed">
          Remove this item from the outbound drop? The item will remain active in your main inventory.
        </p>

        <div class="modal-action flex items-center gap-2 mt-0">
          <button 
            type="button" 
            @click="itemPendingDelete = null" 
            class="btn btn-ghost flex-1 rounded-xl font-bold"
          >
            Cancel
          </button>
          <button 
            type="button" 
            @click="confirmRemoveItem" 
            class="btn btn-error flex-1 rounded-xl font-black text-error-content shadow-md gap-1.5"
          >
            <span>Remove Item</span>
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="itemPendingDelete = null">
        <button>close</button>
      </form>
    </dialog>

    <!-- 3. DESTINATION LOCATION PICKER MODAL -->
    <dialog class="modal modal-bottom sm:modal-middle z-[85]" :class="{ 'modal-open': isLocationPickerOpen }">
      <div v-if="isLocationPickerOpen" class="modal-box bg-base-100 border border-base-300 shadow-2xl rounded-3xl p-5 max-w-sm mx-auto">
        <div class="flex items-center justify-between pb-3 border-b border-base-200">
          <div class="flex items-center gap-2">
            <Icon icon="solar:shop-2-bold" class="w-5 h-5 text-primary" />
            <h3 class="font-black text-base">Select Drop Destination</h3>
          </div>
          <button class="btn btn-sm btn-circle btn-ghost" @click="isLocationPickerOpen = false">✕</button>
        </div>
        
        <p class="text-xs text-base-content/70 my-3">Where will these items be dropped off or stored?</p>

        <div class="space-y-2">
          <!-- Memory Den -->
          <button 
            type="button" 
            class="w-full text-left p-3 rounded-2xl border border-base-300 hover:border-primary hover:bg-primary/5 transition-all flex items-center justify-between group"
            @click="handleSelectLocation('MD', 'Memory Den')"
          >
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-xs">MD</div>
              <div>
                <div class="font-black text-xs group-hover:text-primary transition-colors">Memory Den (MD)</div>
                <div class="text-[10px] opacity-60 font-mono">Automated Ricochet POS • Thermal Barcodes</div>
              </div>
            </div>
            <Icon icon="solar:arrow-right-linear" class="w-4 h-4 opacity-40 group-hover:opacity-100 group-hover:text-primary" />
          </button>

          <!-- Dusty Tiger -->
          <button 
            type="button" 
            class="w-full text-left p-3 rounded-2xl border border-base-300 hover:border-primary hover:bg-primary/5 transition-all flex items-center justify-between group"
            @click="handleSelectLocation('DT', 'Dusty Tiger')"
          >
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center font-black text-xs">DT</div>
              <div>
                <div class="font-black text-xs group-hover:text-secondary transition-colors">Dusty Tiger (DT)</div>
                <div class="text-[10px] opacity-60 font-mono">Manual Tagging Sheet • String Tags</div>
              </div>
            </div>
            <Icon icon="solar:arrow-right-linear" class="w-4 h-4 opacity-40 group-hover:opacity-100 group-hover:text-secondary" />
          </button>

          <!-- Online Warehouse / Garage -->
          <button 
            type="button" 
            class="w-full text-left p-3 rounded-2xl border border-base-300 hover:border-primary hover:bg-primary/5 transition-all flex items-center justify-between group"
            @click="handleSelectLocation('HG', 'Huck\'s Garage')"
          >
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-warning/10 text-warning flex items-center justify-center font-black text-xs">HG</div>
              <div>
                <div class="font-black text-xs group-hover:text-warning transition-colors">Online / Warehouse Backstock</div>
                <div class="text-[10px] opacity-60 font-mono">Garage Storage Bins • eBay / Poshmark</div>
              </div>
            </div>
            <Icon icon="solar:arrow-right-linear" class="w-4 h-4 opacity-40 group-hover:opacity-100 group-hover:text-warning" />
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="isLocationPickerOpen = false">
        <button>close</button>
      </form>
    </dialog>

    <!-- 4. ROLLBACK / REOPEN MANIFEST CONFIRMATION MODAL -->
    <dialog class="modal modal-bottom sm:modal-middle z-[85]" :class="{ 'modal-open': isRollbackModalOpen }">
      <div v-if="isRollbackModalOpen" class="modal-box bg-base-100 border border-base-300 shadow-2xl rounded-box p-5 max-w-sm mx-auto space-y-4">
        <div class="flex items-center gap-3 text-warning">
          <div class="w-10 h-10 rounded-box bg-warning/15 flex items-center justify-center shrink-0">
            <Icon icon="solar:restart-bold" class="w-6 h-6" />
          </div>
          <div>
            <h3 class="font-black text-base text-base-content">Undo Drop &amp; Rollback?</h3>
            <p class="text-xs text-base-content/60 font-mono">{{ activeManifest?.name }}</p>
          </div>
        </div>

        <p class="text-xs text-base-content/80 leading-relaxed">
          Rolling back will return all constituent items back to <strong>in-stock</strong> at <strong>Backstock</strong>, unmark placed status, and restore this manifest as an editable draft.
        </p>

        <div class="modal-action flex items-center gap-2 mt-0">
          <button 
            type="button" 
            class="btn btn-ghost flex-1 font-bold rounded-btn"
            @click="isRollbackModalOpen = false"
          >
            Cancel
          </button>
          <button 
            type="button" 
            class="btn btn-warning flex-1 font-black text-warning-content shadow-md border border-warning-content/25 active:scale-95 rounded-btn gap-1"
            @click="confirmRollbackDrop"
          >
            <Icon icon="solar:restart-bold" class="w-4 h-4" />
            <span>Confirm Rollback</span>
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="isRollbackModalOpen = false">
        <button>close</button>
      </form>
    </dialog>

    <!-- 4. FULL ITEM DRAWER FOR INSPECTING & EDITING SPECS -->
    <ItemDrawer 
      v-if="editingItem" 
      :item="editingItem" 
      @close="editingItem = null" 
      @save="handleItemSaved" 
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, defineAsyncComponent } from 'vue';
import { Icon } from '@iconify/vue';
import { useManifest } from '../../composables/useManifest';
import { manifestsApi } from '../../lib/manifests';
import { BUCKET_ID, getAssetUrl, updateInventoryItem } from '../../lib/inventory';
import { addToast } from '../../stores/toast';

const ItemDrawer = defineAsyncComponent(() => import('../common/ItemDrawer.vue'));

const editingItem = ref<any | null>(null);

const openItemEditor = (item: any) => {
  editingItem.value = item;
};

const handleItemSaved = async (payload: any) => {
  const targetId = editingItem.value?.$id || editingItem.value?.id;
  if (targetId && payload) {
    try {
      const updatedDoc = await updateInventoryItem(targetId, payload);
      // Also update staged item in local snapshot if in active manifest
      if (activeManifest.value?.itemsSnapshot) {
        const snapIdx = activeManifest.value.itemsSnapshot.findIndex(s => s.$id === targetId);
        if (snapIdx !== -1 && updatedDoc) {
          activeManifest.value.itemsSnapshot[snapIdx] = {
            ...activeManifest.value.itemsSnapshot[snapIdx],
            title: updatedDoc.title,
            price: Number(updatedDoc.resalePrice || updatedDoc.boutiquePrice || updatedDoc.price || 0),
            cost: Number(updatedDoc.cost || 0),
            upc: updatedDoc.upc,
            locationSku: updatedDoc.locationSku,
            imageId: updatedDoc.imageId
          };
          // Persist snapshot update to manifest
          await manifestsApi.updateManifest(activeManifest.value.$id, {
            itemsSnapshot: activeManifest.value.itemsSnapshot
          });
        }
      }
      addToast({ type: 'success', message: 'Item updated successfully!' });
    } catch (err: any) {
      addToast({ type: 'error', message: `Save failed: ${err.message}` });
    }
  }
  editingItem.value = null;
  if (activeManifest.value) {
    await switchActiveManifest(activeManifest.value.$id);
  }
};

const props = defineProps<{
  isOpen?: boolean;
  locationId?: string;
  locationName?: string;
}>();

const emit = defineEmits<{
  (e: 'toggle-tray'): void;
  (e: 'close'): void;
  (e: 'open-actions'): void;
  (e: 'update:isOpen', val: boolean): void;
  (e: 'drop-changed'): void;
}>();

const {
  activeManifest,
  stagedItems,
  isTrayOpen: composableTrayOpen,
  allDrafts,
  recentPlacedManifests,
  stagedCount,
  totalUnits,
  totalCost,
  totalRetail,
  commissionRate,
  estimatedNet,
  estimatedProfit,
  roiMultiple,
  fetchAllDrafts,
  openActionTray,
  isActionTrayOpen,
  removeFromManifest,
  updateManifestTitle,
  clearActiveManifest,
  exportManifestCsv,
  pauseActiveManifest,
  resumeManifest,
  lockActiveManifest,
  unlockActiveManifest,
  rollbackPlacedManifest,
  unverifyAllItems,
  createNewDraft,
  switchActiveManifest
} = useManifest();

const matchesLocation = (m: any) => {
  if (!props.locationId) return true;
  const filterLoc = props.locationId.toLowerCase();
  const filterName = (props.locationName || '').toLowerCase();
  const dLoc = (m.locationId || '').toLowerCase();
  const dName = (m.locationName || '').toLowerCase();
  if (filterLoc && dLoc === filterLoc) return true;
  if (filterName && dName === filterName) return true;
  if (filterLoc === 'md' && (dLoc.includes('memory') || dName.includes('memory'))) return true;
  if (filterLoc === 'dt' && (dLoc.includes('dusty') || dName.includes('dusty'))) return true;
  if (filterLoc === 'hg' && (dLoc.includes('huck') || dName.includes('huck') || dLoc.includes('garage') || dName.includes('garage'))) return true;
  if (filterName && (dName.includes(filterName) || filterName.includes(dName))) return true;
  return false;
};

const displayedDrafts = computed(() => {
  if (!props.locationId) return allDrafts.value;
  return allDrafts.value.filter(matchesLocation);
});

const displayedPlacedDrops = computed(() => {
  if (!props.locationId) return recentPlacedManifests.value;
  return recentPlacedManifests.value.filter(matchesLocation);
});

const allAvailableDrops = computed(() => {
  return [...displayedDrafts.value, ...displayedPlacedDrops.value];
});

const showTray = computed(() => {
  return props.isOpen !== undefined ? props.isOpen : composableTrayOpen.value;
});

// Auto-refresh all drafts and enforce location scoping whenever tray opens
watch(showTray, async (isOpen) => {
  if (isOpen) {
    await fetchAllDrafts();
    if (props.locationId) {
      const filterLoc = props.locationId.toLowerCase();
      const filterName = (props.locationName || '').toLowerCase();
      const isMatch = (m: any) => {
        if (!m) return false;
        const dLoc = (m.locationId || '').toLowerCase();
        const dName = (m.locationName || '').toLowerCase();
        return dLoc === filterLoc || (filterName && dName === filterName) ||
               (filterLoc === 'md' && (dLoc.includes('memory') || dName.includes('memory')));
      };

      if (!activeManifest.value || !isMatch(activeManifest.value)) {
        const match = displayedDrafts.value.find(d => isMatch(d) && (d.status === 'draft' || d.status === 'in-transit' || d.status === 'paused'));
        if (match) {
          if (match.status === 'paused') {
            await resumeManifest(match.$id);
          } else {
            await switchActiveManifest(match.$id);
          }
        } else {
          activeManifest.value = null;
          stagedItems.value = [];
        }
      }
    }
  }
}, { immediate: true });

onMounted(async () => {
  await fetchAllDrafts();
});

const isLocked = computed(() => {
  return activeManifest.value?.status === 'in-transit' || activeManifest.value?.status === 'exported';
});

const isRicochetFacility = computed(() => {
  const loc = activeManifest.value?.locationId || activeManifest.value?.locationName || '';
  return loc.toUpperCase() === 'MD' || loc.toLowerCase().includes('memory den');
});

const closeTray = () => {
  composableTrayOpen.value = false;
  emit('close');
  emit('toggle-tray');
  emit('update:isOpen', false);
};

const toggleTray = () => {
  closeTray();
};

const handleResumeOrSwitch = async (id: string) => {
  const target = allAvailableDrops.value.find(d => d.$id === id) || allDrafts.value.find(d => d.$id === id);
  if (target?.status === 'paused') {
    await resumeManifest(id);
  } else {
    await switchActiveManifest(id);
  }
  emit('drop-changed');
};

const handlePause = async () => {
  await pauseActiveManifest();
  emit('drop-changed');
};

const handleResume = async (id: string) => {
  await resumeManifest(id);
  emit('drop-changed');
};

// Rollback Modal State & Handlers
const isRollbackModalOpen = ref(false);
const manifestToRollbackId = ref<string | null>(null);

const handleOpenRollbackModal = (id?: string) => {
  manifestToRollbackId.value = id || activeManifest.value?.$id || null;
  isRollbackModalOpen.value = true;
};

const confirmRollbackDrop = async () => {
  const targetId = manifestToRollbackId.value || activeManifest.value?.$id;
  if (!targetId) return;
  try {
    await rollbackPlacedManifest(targetId);
    addToast({
      type: 'success',
      message: 'Drop rolled back successfully! Items returned to in-stock at Backstock and manifest restored to draft.'
    });
    isRollbackModalOpen.value = false;
    manifestToRollbackId.value = null;
    emit('drop-changed');
  } catch (err: any) {
    addToast({
      type: 'error',
      message: `Rollback failed: ${err.message || err}`
    });
  }
};

const handleUnverifyAll = async () => {
  if (!activeManifest.value) return;
  try {
    await unverifyAllItems(activeManifest.value.$id);
    verifiedItemIds.value.clear();
    addToast({
      type: 'info',
      message: 'Unverified all items on this in-transit drop.'
    });
    emit('drop-changed');
  } catch (err: any) {
    addToast({
      type: 'error',
      message: `Unverify failed: ${err.message || err}`
    });
  }
};

// Title Editing State
const isEditingTitle = ref(false);
const editedTitle = ref('');
const savingTitle = ref(false);
const titleInputRef = ref<HTMLInputElement | null>(null);

const startEditTitle = () => {
  if (!activeManifest.value) return;
  editedTitle.value = activeManifest.value.name || '';
  isEditingTitle.value = true;
  nextTick(() => {
    titleInputRef.value?.focus();
    titleInputRef.value?.select();
  });
};

const saveTitle = async () => {
  if (!editedTitle.value.trim() || savingTitle.value) return;
  savingTitle.value = true;
  try {
    await updateManifestTitle(editedTitle.value.trim());
    isEditingTitle.value = false;
    emit('drop-changed');
  } finally {
    savingTitle.value = false;
  }
};

// Export handling
const isExporting = ref(false);
const handleExportCsv = async () => {
  if (isExporting.value) return;
  isExporting.value = true;
  try {
    await exportManifestCsv('ricochet');
    // Also lock drop into in-transit state
    if (activeManifest.value && activeManifest.value.status === 'draft') {
      await lockActiveManifest();
    }
    emit('drop-changed');
  } finally {
    isExporting.value = false;
  }
};

// Lock / Unlock Handlers
const handleLock = async () => {
  await lockActiveManifest();
  emit('drop-changed');
};

const handleUnlock = async () => {
  await unlockActiveManifest();
  emit('drop-changed');
};

// Location Picker & Start New Drop
const isLocationPickerOpen = ref(false);

const handleStartNewDrop = async () => {
  if (props.locationId) {
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const locName = props.locationName || (props.locationId === 'MD' ? 'Memory Den' : props.locationId === 'DT' ? 'Dusty Tiger' : props.locationId === 'HG' ? "Huck's Garage" : props.locationId);
    const name = `${locName} Drop - ${dateStr}`;
    await createNewDraft(name, props.locationId, locName);
    emit('drop-changed');
  } else {
    isLocationPickerOpen.value = true;
  }
};

const handleSelectLocation = async (locCode: string, locName: string) => {
  isLocationPickerOpen.value = false;
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const name = `${locName} Drop - ${dateStr}`;
  await createNewDraft(name, locCode, locName);
  emit('drop-changed');
};

// Modals
const isDiscardModalOpen = ref(false);
const itemPendingDelete = ref<any | null>(null);

const confirmRemoveItem = async () => {
  if (!itemPendingDelete.value) return;
  const id = itemPendingDelete.value.$id;
  itemPendingDelete.value = null;
  await removeFromManifest(id);
  emit('drop-changed');
};

const confirmDiscard = async () => {
  isDiscardModalOpen.value = false;
  await clearActiveManifest();
  emit('drop-changed');
};

const getImageUrl = (imageId: string): string => {
  if (!imageId) return '';
  if (imageId.startsWith('http') || imageId.startsWith('data:') || imageId.startsWith('blob:')) return imageId;
  const ENDPOINT = import.meta.env.PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1';
  const PROJECT = import.meta.env.PUBLIC_APPWRITE_PROJECT_ID || '69714b35003a8adab6bb';
  const bucket = BUCKET_ID || 'item_images';
  return `${ENDPOINT}/storage/buckets/${bucket}/files/${imageId}/view?project=${PROJECT}`;
};

const handleImageError = (e: Event, imageId?: string) => {
  const target = e.target as HTMLImageElement;
  if (!target || !imageId) return;
  const ENDPOINT = import.meta.env.PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1';
  const PROJECT = import.meta.env.PUBLIC_APPWRITE_PROJECT_ID || '69714b35003a8adab6bb';
  if (target.src.includes('item_images_dev')) {
    target.src = `${ENDPOINT}/storage/buckets/item_images/files/${imageId}/view?project=${PROJECT}`;
  } else if (target.src.includes('item_images')) {
    target.src = `${ENDPOINT}/storage/buckets/item_images_dev/files/${imageId}/view?project=${PROJECT}`;
  }
};

const cleanTitle = (title?: string): string => {
  if (!title) return 'Untitled Item';
  return title.replace(/\[Tier \d[^\]]*\]\s*/i, '').trim();
};

// In-Store Booth Verification State & Actions (Tray is the Cockpit!)
// By default, starts UNCHECKED for real physical audit at the booth
const verifiedItemIds = ref<Set<string>>(new Set());
const isDeploying = ref(false);

watch(() => activeManifest.value?.$id, () => {
  if (activeManifest.value) {
    if (activeManifest.value.status === 'placed') {
      verifiedItemIds.value = new Set(activeManifest.value.itemIds || []);
    } else if (activeManifest.value.placedItemIds && activeManifest.value.placedItemIds.length > 0) {
      verifiedItemIds.value = new Set(activeManifest.value.placedItemIds);
    } else {
      verifiedItemIds.value.clear();
    }
  } else {
    verifiedItemIds.value.clear();
  }
}, { immediate: true });

const toggleItemVerified = (itemId: string) => {
  if (verifiedItemIds.value.has(itemId)) {
    verifiedItemIds.value.delete(itemId);
  } else {
    verifiedItemIds.value.add(itemId);
  }
};

const toggleAllVerified = () => {
  if (verifiedItemIds.value.size === stagedItems.value.length) {
    verifiedItemIds.value.clear();
  } else {
    verifiedItemIds.value = new Set(stagedItems.value.map(i => i.$id));
  }
};

const confirmPlacement = async () => {
  if (!activeManifest.value || verifiedItemIds.value.size === 0 || isDeploying.value) return;
  isDeploying.value = true;
  
  const targetLoc = activeManifest.value.locationName || 'Memory Den';
  const targetIds = Array.from(verifiedItemIds.value);

  try {
    const result = await manifestsApi.deployManifest(
      activeManifest.value.$id,
      targetIds,
      targetLoc
    );

    addToast({
      type: 'success',
      message: `Verified & Placed ${result.updatedCount} items at ${targetLoc}! Status set to PLACED.`
    });

    composableTrayOpen.value = false;
    emit('toggle-tray');
    emit('drop-changed');
    
    // Clear active manifest since it's now placed/archived
    activeManifest.value = null;
    stagedItems.value = [];
  } catch (err: any) {
    addToast({
      type: 'error',
      message: `Placement error: ${err.message}`
    });
  } finally {
    isDeploying.value = false;
  }
};

const getItemPhotoUrl = (imageId?: string) => {
  if (!imageId) return '';
  return getAssetUrl(imageId);
};
</script>

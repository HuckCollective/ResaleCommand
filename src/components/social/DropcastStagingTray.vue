<template>
  <div v-if="isCastTrayOpen" class="relative z-[80]">
    <!-- Backdrop -->
    <div 
      class="fixed inset-0 z-[80] bg-black/60 backdrop-blur-xs flex flex-col justify-end transition-opacity"
      @click.self="closeCastTray"
    >
      <!-- Bottom Drawer Container -->
      <div class="bg-base-100 border-t border-base-300 rounded-t-3xl max-w-2xl mx-auto w-full max-h-[85dvh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200 overflow-hidden select-none">
        
        <!-- Drag Handle Affordance -->
        <div class="w-12 h-1.5 bg-base-content/20 rounded-full mx-auto mt-2.5 mb-1 shrink-0"></div>

        <!-- HEADER -->
        <div class="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-base-300 flex items-center justify-between gap-3 shrink-0 bg-base-200/50">
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <div class="w-9 h-9 rounded-2xl bg-linear-to-tr from-pink-500 via-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20 shrink-0">
              <Icon icon="solar:broadcast-bold" class="w-5 h-5" :class="activeCast?.status === 'draft' ? 'animate-pulse' : ''" />
            </div>

            <div class="min-w-0 flex-1">
              <!-- Title Row: Display or Inline Edit Mode -->
              <div class="flex items-center gap-2 flex-wrap">
                <template v-if="isEditingTitle">
                  <div class="flex items-center gap-1.5 flex-1 max-w-sm">
                    <input 
                      v-model="editedTitle" 
                      type="text" 
                      class="input input-xs input-bordered font-bold text-sm w-full"
                      placeholder="Dropcast Title"
                      @keyup.enter="saveTitle"
                      @keyup.esc="isEditingTitle = false"
                    />
                    <button 
                      @click="saveTitle" 
                      :disabled="!editedTitle.trim()"
                      class="btn btn-xs btn-primary text-primary-content font-bold px-2 shrink-0" 
                      title="Save Title"
                    >
                      ✓
                    </button>
                    <button 
                      @click="isEditingTitle = false" 
                      class="btn btn-xs btn-ghost px-2 shrink-0" 
                      title="Cancel"
                    >
                      ✕
                    </button>
                  </div>
                </template>
                <template v-else>
                  <h3 class="text-sm sm:text-base font-black text-base-content truncate">
                    {{ activeCast ? activeCast.title : 'Dropcast Staging Tray' }}
                  </h3>
                  <button 
                    v-if="activeCast"
                    @click="startEditTitle" 
                    class="btn btn-ghost btn-xs btn-circle opacity-60 hover:opacity-100"
                    title="Rename Dropcast"
                  >
                    <Icon icon="solar:pen-bold" class="w-3.5 h-3.5 text-primary" />
                  </button>
                  <span v-if="activeCast" class="badge badge-xs font-mono font-bold" :class="CAST_STATUS_META[activeCast.status]?.badgeClass">
                    {{ CAST_STATUS_META[activeCast.status]?.label || activeCast.status }}
                  </span>
                </template>
              </div>

              <div class="text-[11px] font-mono flex items-center gap-2 mt-0.5 opacity-70 truncate">
                <span class="font-bold text-secondary flex items-center gap-1">
                  <Icon icon="solar:shop-2-bold" class="w-3 h-3" />
                  <span>{{ activeCast?.locationName || 'Memory Den' }}</span>
                </span>
                <span>•</span>
                <span class="font-bold text-primary">{{ stagedCastCount }} item{{ stagedCastCount === 1 ? '' : 's' }}</span>
                <span>•</span>
                <span class="font-bold text-success">${{ stagedCastTotalRetail.toFixed(2) }} retail</span>
              </div>
            </div>
          </div>

          <!-- Top Actions & Cast Switcher -->
          <div class="flex items-center gap-1.5 shrink-0">
            <!-- Pause / Resume Toggle Button -->
            <button 
              v-if="activeCast?.status === 'draft'"
              type="button" 
              @click="pauseActiveCast" 
              class="btn btn-xs btn-warning btn-outline gap-1 font-bold rounded-xl"
              title="Pause Dropcast (stops auto-staging inventory selections)"
            >
              <Icon icon="solar:pause-circle-bold" class="w-3.5 h-3.5" />
              <span class="hidden xs:inline">Pause</span>
            </button>
            <button 
              v-else-if="activeCast?.status === 'paused'"
              type="button" 
              @click="resumeActiveCast()" 
              class="btn btn-xs btn-success gap-1 font-bold rounded-xl text-success-content"
              title="Resume Dropcast (activates auto-staging inventory selections)"
            >
              <Icon icon="solar:play-circle-bold" class="w-3.5 h-3.5" />
              <span>Resume</span>
            </button>

            <!-- Cast Switcher Dropdown -->
            <div class="dropdown dropdown-end">
              <button tabindex="0" type="button" class="btn btn-xs btn-outline border-base-300 gap-1 font-mono text-[11px] rounded-xl">
                <span>Switch Cast</span>
                <Icon icon="solar:alt-arrow-down-linear" class="w-3 h-3 opacity-60" />
              </button>
              <ul tabindex="0" class="dropdown-content menu p-2 shadow-2xl bg-base-100 border border-base-300 rounded-2xl w-72 z-50 text-xs space-y-1 mt-1 max-h-72 overflow-y-auto">
                <li class="menu-title text-[9px] uppercase font-bold opacity-50 px-2">Active Casts</li>
                <li v-for="c in dropcastsList" :key="c.id">
                  <a 
                    :class="{'active font-bold': activeCast && activeCast.id === c.id}"
                    @click="setActiveCast(c)"
                    class="flex items-center justify-between gap-2 py-2 px-2 rounded-xl"
                  >
                    <div class="truncate flex-1">
                      <div class="font-bold truncate">{{ c.title }}</div>
                      <div class="text-[10px] opacity-60 font-mono">{{ c.locationName }} • {{ (c.items || []).length }} items</div>
                    </div>
                    <span class="badge badge-xs font-mono font-bold uppercase" :class="CAST_STATUS_META[c.status]?.badgeClass">
                      {{ c.status }}
                    </span>
                  </a>
                </li>
                <div class="divider my-1"></div>
                <li>
                  <a @click="handleCreateNewDraftCast" class="text-primary font-bold py-1.5 px-2">
                    <Icon icon="solar:add-circle-bold" class="w-4 h-4" />
                    <span>+ New Dropcast</span>
                  </a>
                </li>
              </ul>
            </div>

            <!-- Close Button -->
            <button 
              type="button" 
              @click="closeCastTray" 
              class="btn btn-ghost btn-xs btn-circle opacity-60 hover:opacity-100"
              title="Close Tray"
            >
              <Icon icon="solar:close-circle-bold" class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- AUTO-STAGING STATUS BAR -->
        <div class="px-4 py-2 bg-base-200/40 border-b border-base-300 shrink-0">
          <div v-if="activeCast?.status === 'paused'" class="bg-warning/15 border border-warning/30 rounded-xl px-3 py-1.5 text-xs flex items-center justify-between gap-2 text-warning-content">
            <div class="flex items-center gap-2">
              <Icon icon="solar:pause-circle-bold" class="w-4 h-4 shrink-0 text-warning" />
              <span class="text-[11px]"><strong>Dropcast Paused</strong> — newly selected inventory items will NOT be auto-staged.</span>
            </div>
            <button @click="resumeActiveCast()" class="btn btn-xs btn-warning font-bold shrink-0">Resume Draft</button>
          </div>
          <div v-else-if="activeCast?.status === 'draft'" class="bg-primary/10 border border-primary/20 rounded-xl px-3 py-1.5 text-xs flex items-center justify-between gap-2 text-primary font-mono">
            <div class="flex items-center gap-2 min-w-0">
              <span class="w-2 h-2 rounded-full bg-primary animate-ping shrink-0"></span>
              <span class="text-[11px] truncate"><strong>Auto-Staging Active</strong> — newly selected items in Inventory are queued here.</span>
            </div>
            <button @click="pauseActiveCast" class="btn btn-xs btn-ghost text-xs opacity-75 hover:opacity-100 shrink-0">Pause</button>
          </div>
        </div>

        <!-- STAGED ITEMS LIST (SCROLLABLE BODY) -->
        <div class="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 min-h-[220px]">
          <!-- Empty State -->
          <div v-if="stagedCastCount === 0" class="text-center py-12 space-y-3">
            <div class="w-14 h-14 rounded-3xl bg-base-200 text-base-content/40 flex items-center justify-center mx-auto">
              <Icon icon="solar:broadcast-linear" class="w-7 h-7" />
            </div>
            <div class="space-y-1">
              <h4 class="font-black text-sm text-base-content">No Items Staged for this Cast</h4>
              <p class="text-xs opacity-60 max-w-xs mx-auto">
                Check items in your Inventory or Warehouse and tap <span class="font-bold text-primary">"Stage for Dropcast"</span> to queue them up.
              </p>
            </div>
          </div>

          <!-- Staged Items Rows -->
          <div 
            v-else
            v-for="(item, idx) in stagedCastItems" 
            :key="item.$id || item.id || idx"
            class="p-2.5 sm:p-3 rounded-2xl border border-base-200 bg-base-100 hover:border-primary/40 hover:bg-base-200/40 transition-all flex items-center justify-between gap-3 group text-xs shadow-2xs"
          >
            <!-- Thumbnail with Safe Fallback -->
            <div class="w-12 h-12 rounded-xl overflow-hidden bg-base-300 border border-base-300 shrink-0 relative flex items-center justify-center">
              <ItemThumbnail 
                :item="item" 
                :src="resolveItemPhoto(item) || ''" 
                size="md" 
                rounded="xl" 
                class="w-full h-full"
              />
            </div>

            <!-- Title & Metadata -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span v-if="item.upc" class="badge badge-xs font-mono font-bold bg-primary/10 text-primary border-0">
                  {{ item.upc }}
                </span>
                <span v-if="item.storageLocation" class="badge badge-xs badge-outline font-mono">
                  {{ item.storageLocation }}
                </span>
                <span v-if="item.brand" class="text-[10px] opacity-60 truncate font-semibold">
                  {{ item.brand }}
                </span>
              </div>
              <h4 class="font-bold text-xs text-base-content truncate mt-0.5" :title="item.title">
                {{ item.title }}
              </h4>
              <div class="flex items-center gap-2 text-[10px] font-mono mt-0.5">
                <span class="text-secondary font-black text-xs">
                  ${{ (Number(item.boutiquePrice || item.resalePrice || item.price) || 0).toFixed(2) }}
                </span>
                <span v-if="item.cost" class="opacity-60">
                  • Cost: ${{ Number(item.cost).toFixed(2) }}
                </span>
              </div>
            </div>

            <!-- Actions (Unstage) -->
            <div class="flex items-center gap-1 shrink-0">
              <button 
                type="button" 
                @click="unstageItemFromCast(item.$id || item.id)"
                class="btn btn-ghost btn-xs btn-circle text-error opacity-60 hover:opacity-100 hover:bg-error/10"
                title="Remove from Dropcast"
              >
                <Icon icon="solar:trash-bin-trash-bold" class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <!-- FOOTER COMMAND DOCK -->
        <div class="p-3 sm:px-5 border-t border-base-300 bg-base-200/90 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          <div class="flex items-center gap-2">
            <button 
              v-if="stagedCastCount > 0"
              type="button" 
              @click="clearCastStaging" 
              class="btn btn-ghost btn-xs text-error font-bold"
              title="Clear all staged items"
            >
              Clear All
            </button>
            <span class="text-xs font-mono font-bold opacity-60">
              {{ stagedCastCount }} staged
            </span>
          </div>

          <div class="flex items-center gap-2">
            <!-- Open in Studio Button -->
            <button 
              type="button" 
              @click="handleNavigateToStudio"
              class="btn btn-sm btn-primary text-primary-content font-black rounded-2xl gap-2 shadow-md hover:scale-[1.02] active:scale-95 transition-all px-4"
              title="Open full studio in /social"
            >
              <Icon icon="solar:magic-stick-3-bold" class="w-4 h-4" />
              <span>Open in Studio ➔</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Icon } from '@iconify/vue';
import ItemThumbnail from '../common/ItemThumbnail.vue';
import { useDropcasts } from '../../composables/useDropcasts';
import { getItemImageUrl } from '../../composables/useInventoryFilters';
import { getItemImageUrls, type SocialStudioItem } from '../../lib/socialMediaStudio';
import { addToast } from '../../stores/toast';

const {
  dropcastsList,
  activeCast,
  isCastTrayOpen,
  stagedCastItems,
  stagedCastCount,
  stagedCastTotalRetail,
  closeCastTray,
  setActiveCast,
  startCustomCast,
  saveActiveCast,
  pauseActiveCast,
  resumeActiveCast,
  unstageItemFromCast,
  clearCastStaging,
  openStudio,
  ensureActiveCast,
  CAST_TYPE_META,
  CAST_STATUS_META
} = useDropcasts();

if (!activeCast.value) {
  ensureActiveCast();
}

const isEditingTitle = ref(false);
const editedTitle = ref('');

function startEditTitle() {
  if (!activeCast.value) return;
  editedTitle.value = activeCast.value.title || '';
  isEditingTitle.value = true;
}

function saveTitle() {
  if (!activeCast.value || !editedTitle.value.trim()) return;
  activeCast.value.title = editedTitle.value.trim();
  saveActiveCast();
  isEditingTitle.value = false;
  addToast({ type: 'success', message: 'Renamed dropcast!' });
}

function resolveItemPhoto(item: any): string | null {
  if (!item) return null;
  if (item.customPhotoDataUrl) return item.customPhotoDataUrl;
  const invUrl = getItemImageUrl(item, 120);
  if (invUrl) return invUrl;
  const urls = getItemImageUrls(item);
  return urls.length > 0 ? urls[0] : null;
}

function handleCreateNewDraftCast() {
  const title = `Dropcast — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  startCustomCast(title, activeCast.value?.locationName || 'Memory Den');
  addToast({ type: 'success', message: `Started new draft: "${title}"` });
}

function handleNavigateToStudio() {
  if (activeCast.value) {
    openStudio(activeCast.value);
  }
  // Navigate to /social if we're on /inventory or elsewhere
  if (typeof window !== 'undefined' && !window.location.pathname.includes('/social')) {
    window.location.href = `/social?cast=${activeCast.value?.id || ''}`;
  }
}
</script>

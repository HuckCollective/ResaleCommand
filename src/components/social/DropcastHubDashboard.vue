<template>
  <div class="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 pb-16">
    
    <!-- TOP HEADER & TITLE STRIP -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-base-100 p-5 sm:p-6 rounded-3xl border border-base-200 shadow-sm">
      <div class="flex items-center gap-3.5 min-w-0">
        <div class="w-12 h-12 rounded-2xl bg-linear-to-tr from-pink-500 via-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/25 shrink-0">
          <Icon icon="solar:broadcast-bold" class="w-6 h-6 animate-pulse" />
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h1 class="text-xl sm:text-2xl font-black tracking-tight text-base-content">Dropcast Hub</h1>
            <span class="badge badge-secondary font-mono font-bold text-xs uppercase px-2.5 py-0.5">Multi-Channel Studio</span>
          </div>
          <p class="text-xs sm:text-sm opacity-65 truncate mt-0.5">
            Stage physical booth restocks, spotlight rare grails, and deploy high-converting Instagram &amp; Facebook drops.
          </p>
        </div>
      </div>

      <!-- Quick Header CTA -->
      <div class="flex items-center gap-2.5 flex-wrap">
        <button 
          type="button" 
          @click="handleStartCustomCast"
          class="btn btn-sm btn-primary text-primary-content gap-2 font-black rounded-2xl shadow-sm hover:scale-[1.02] active:scale-95 transition-all"
        >
          <Icon icon="solar:magic-stick-3-bold" class="w-4 h-4" />
          <span>+ Custom Cast</span>
        </button>

        <a href="/warehouse" class="btn btn-sm btn-ghost border border-base-300 gap-1.5 font-bold text-xs rounded-2xl">
          <Icon icon="solar:buildings-linear" class="w-4 h-4 text-secondary" />
          <span>Locations &amp; Drops</span>
        </a>
      </div>
    </div>

    <!-- METRICS STRIP (STARTED VS FINISHED STATUSES) -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <!-- Total Casts -->
      <div 
        @click="filterStatus = 'all'" 
        class="card bg-base-100 p-4 rounded-3xl border border-base-200 shadow-xs cursor-pointer hover:border-primary/50 transition-all"
        :class="filterStatus === 'all' ? 'ring-2 ring-primary/40 bg-primary/5' : ''"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-base-200 text-base-content flex items-center justify-center shrink-0">
            <Icon icon="solar:layers-minimalistic-bold" class="w-5 h-5 text-primary" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] uppercase font-bold opacity-60">Total Casts</div>
            <div class="font-mono font-black text-lg sm:text-xl text-base-content">{{ counts.total }}</div>
          </div>
        </div>
      </div>

      <!-- Drafts (Started / In-Progress) -->
      <div 
        @click="filterStatus = 'draft'" 
        class="card bg-base-100 p-4 rounded-3xl border border-base-200 shadow-xs cursor-pointer hover:border-warning/50 transition-all"
        :class="filterStatus === 'draft' ? 'ring-2 ring-warning/40 bg-warning/5' : ''"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-warning/15 text-warning flex items-center justify-center shrink-0">
            <Icon icon="solar:pen-new-square-linear" class="w-5 h-5" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] uppercase font-bold opacity-60">Drafts (Started)</div>
            <div class="font-mono font-black text-lg sm:text-xl text-warning">{{ counts.drafts }}</div>
          </div>
        </div>
      </div>

      <!-- Ready to Post (Prepared) -->
      <div 
        @click="filterStatus = 'ready'" 
        class="card bg-base-100 p-4 rounded-3xl border border-base-200 shadow-xs cursor-pointer hover:border-info/50 transition-all"
        :class="filterStatus === 'ready' ? 'ring-2 ring-info/40 bg-info/5' : ''"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-info/15 text-info flex items-center justify-center shrink-0">
            <Icon icon="solar:check-circle-bold" class="w-5 h-5" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] uppercase font-bold opacity-60">Ready to Post</div>
            <div class="font-mono font-black text-lg sm:text-xl text-info">{{ counts.ready }}</div>
          </div>
        </div>
      </div>

      <!-- Broadcasted (Finished / Published) -->
      <div 
        @click="filterStatus = 'broadcasted'" 
        class="card bg-base-100 p-4 rounded-3xl border border-base-200 shadow-xs cursor-pointer hover:border-success/50 transition-all"
        :class="filterStatus === 'broadcasted' ? 'ring-2 ring-success/40 bg-success/5' : ''"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-success/15 text-success flex items-center justify-center shrink-0">
            <Icon icon="solar:broadcast-bold" class="w-5 h-5" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] uppercase font-bold opacity-60">Broadcasted (Done)</div>
            <div class="font-mono font-black text-lg sm:text-xl text-success">{{ counts.broadcasted }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- QUICK CASTS LAUNCHPAD (1-CLICK FAST PRESETS) -->
    <div class="card bg-linear-to-r from-base-100 via-base-100 to-base-200/50 border border-base-200 shadow-sm p-4 sm:p-5 rounded-3xl space-y-3">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="badge badge-accent font-mono font-black text-xs">⚡ QUICK CASTS</span>
          <span class="font-black text-sm text-base-content">1-Click Fast Presets</span>
        </div>
        <p class="text-[11px] opacity-60">
          Auto-populates items, tone, and pricing directly from your active data so you can deploy in seconds.
        </p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <!-- 1. Quick Booth Restock -->
        <button 
          type="button" 
          @click="handleQuickRestock"
          class="btn btn-outline border-base-300 hover:border-primary hover:bg-primary/5 hover:text-primary rounded-2xl p-3 h-auto flex flex-col items-start gap-1 text-left transition-all group"
        >
          <div class="flex items-center justify-between w-full">
            <span class="text-base group-hover:scale-110 transition-transform">🚨</span>
            <span class="badge badge-xs badge-primary font-bold">1-Click</span>
          </div>
          <div class="font-black text-xs text-base-content group-hover:text-primary">Booth Restock Drop</div>
          <div class="text-[10px] opacity-60 line-clamp-1">Pulls latest Memory Den drop items &amp; shelf display</div>
        </button>

        <!-- 2. Quick Grail Spotlight -->
        <button 
          type="button" 
          @click="handleQuickGrail"
          class="btn btn-outline border-base-300 hover:border-secondary hover:bg-secondary/5 hover:text-secondary rounded-2xl p-3 h-auto flex flex-col items-start gap-1 text-left transition-all group"
        >
          <div class="flex items-center justify-between w-full">
            <span class="text-base group-hover:scale-110 transition-transform">💎</span>
            <span class="badge badge-xs badge-secondary font-bold">High Value</span>
          </div>
          <div class="font-black text-xs text-base-content group-hover:text-secondary">Grail Spotlight</div>
          <div class="text-[10px] opacity-60 line-clamp-1">Pulls top vintage piece with provenance breakdown</div>
        </button>

        <!-- 3. Quick Haul Teaser -->
        <button 
          type="button" 
          @click="handleQuickHaul"
          class="btn btn-outline border-base-300 hover:border-accent hover:bg-accent/5 hover:text-accent rounded-2xl p-3 h-auto flex flex-col items-start gap-1 text-left transition-all group"
        >
          <div class="flex items-center justify-between w-full">
            <span class="text-base group-hover:scale-110 transition-transform">📦</span>
            <span class="badge badge-xs badge-accent font-bold">Sourcing</span>
          </div>
          <div class="font-black text-xs text-base-content group-hover:text-accent">Fresh Haul Teaser</div>
          <div class="text-[10px] opacity-60 line-clamp-1">Behind-the-scenes unboxing of newly sourced lots</div>
        </button>

        <!-- 4. Quick Sales Wrap-Up -->
        <button 
          type="button" 
          @click="handleQuickSalesWrap"
          class="btn btn-outline border-base-300 hover:border-success hover:bg-success/5 hover:text-success rounded-2xl p-3 h-auto flex flex-col items-start gap-1 text-left transition-all group"
        >
          <div class="flex items-center justify-between w-full">
            <span class="text-base group-hover:scale-110 transition-transform">💰</span>
            <span class="badge badge-xs badge-success font-bold">Sold</span>
          </div>
          <div class="font-black text-xs text-base-content group-hover:text-success">Sales Wrap-Up</div>
          <div class="text-[10px] opacity-60 line-clamp-1">Recap grails claimed by collectors this week</div>
        </button>
      </div>
    </div>

    <!-- FILTER & SEARCH BAR -->
    <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-base-100 p-3 sm:p-4 rounded-3xl border border-base-200">
      
      <!-- Status Tabs -->
      <div class="join bg-base-200/80 p-1 rounded-2xl border border-base-300 overflow-x-auto">
        <button 
          type="button" 
          @click="filterStatus = 'all'" 
          class="join-item btn btn-xs sm:btn-sm font-black rounded-xl gap-1.5 transition-all"
          :class="filterStatus === 'all' ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost opacity-70 hover:opacity-100'"
        >
          <span>All Casts</span>
          <span class="badge badge-xs font-mono font-bold">{{ counts.total }}</span>
        </button>

        <button 
          type="button" 
          @click="filterStatus = 'draft'" 
          class="join-item btn btn-xs sm:btn-sm font-black rounded-xl gap-1.5 transition-all"
          :class="filterStatus === 'draft' ? 'btn-warning text-warning-content shadow-xs' : 'btn-ghost opacity-70 hover:opacity-100'"
        >
          <span>Drafts</span>
          <span class="badge badge-xs font-mono font-bold">{{ counts.drafts }}</span>
        </button>

        <button 
          type="button" 
          @click="filterStatus = 'ready'" 
          class="join-item btn btn-xs sm:btn-sm font-black rounded-xl gap-1.5 transition-all"
          :class="filterStatus === 'ready' ? 'btn-info text-info-content shadow-xs' : 'btn-ghost opacity-70 hover:opacity-100'"
        >
          <span>Ready to Post</span>
          <span class="badge badge-xs font-mono font-bold">{{ counts.ready }}</span>
        </button>

        <button 
          type="button" 
          @click="filterStatus = 'broadcasted'" 
          class="join-item btn btn-xs sm:btn-sm font-black rounded-xl gap-1.5 transition-all"
          :class="filterStatus === 'broadcasted' ? 'btn-success text-success-content shadow-xs' : 'btn-ghost opacity-70 hover:opacity-100'"
        >
          <span>Broadcasted</span>
          <span class="badge badge-xs font-mono font-bold">{{ counts.broadcasted }}</span>
        </button>
      </div>

      <!-- Location & Search -->
      <div class="flex items-center gap-2 flex-wrap">
        <!-- Location Filter -->
        <select 
          v-model="filterLocation" 
          class="select select-xs sm:select-sm select-bordered rounded-xl font-mono text-xs bg-base-100"
        >
          <option value="all">All Locations</option>
          <option value="MD">Memory Den</option>
          <option value="DT">Dusty Tiger</option>
        </select>

        <!-- Search Input -->
        <div class="relative flex-1 sm:w-60">
          <input 
            v-model="filterSearch" 
            type="text" 
            placeholder="Search casts, items, brands..." 
            class="input input-xs sm:input-sm input-bordered w-full pl-8 rounded-xl font-mono text-xs"
          />
          <Icon icon="solar:magnifer-linear" class="w-4 h-4 opacity-50 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>
    </div>

    <!-- CASTS LIST / GRID -->
    <div v-if="filteredDropcasts.length === 0" class="card bg-base-100 border border-base-200 p-12 text-center rounded-3xl space-y-3">
      <div class="w-16 h-16 rounded-3xl bg-base-200 text-base-content/40 flex items-center justify-center mx-auto">
        <Icon icon="solar:broadcast-linear" class="w-8 h-8" />
      </div>
      <div class="space-y-1">
        <h3 class="font-black text-lg text-base-content">No Dropcasts Found</h3>
        <p class="text-xs opacity-60 max-w-sm mx-auto">
          {{ filterSearch || filterStatus !== 'all' ? 'Try adjusting your search query or status filter.' : 'Get started by creating your first dropcast or picking a 1-click Quick Cast preset above.' }}
        </p>
      </div>
      <div class="pt-2 flex justify-center gap-2">
        <button type="button" @click="handleStartCustomCast" class="btn btn-sm btn-primary rounded-xl font-bold">
          + Start Custom Cast
        </button>
        <button type="button" @click="handleQuickRestock" class="btn btn-sm btn-outline border-base-300 rounded-xl font-bold">
          🚨 Quick Booth Restock
        </button>
      </div>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div 
        v-for="cast in filteredDropcasts" 
        :key="cast.id"
        class="card bg-base-100 border border-base-200 rounded-3xl p-5 shadow-xs hover:shadow-md hover:border-primary/40 transition-all flex flex-col justify-between group space-y-4"
      >
        <!-- Top Row: Type Pill, Venue, and Status Dropdown -->
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="badge badge-sm font-mono font-black" :class="CAST_TYPE_META[cast.type]?.colorBadge || 'badge-neutral'">
              <span>{{ CAST_TYPE_META[cast.type]?.emoji }}</span>
              <span class="ml-1">{{ CAST_TYPE_META[cast.type]?.label }}</span>
            </span>
            <span class="badge badge-sm badge-outline font-mono text-[11px] gap-1">
              <Icon icon="solar:shop-2-bold" class="w-3 h-3 text-secondary" />
              <span>{{ cast.locationName }}</span>
            </span>
          </div>

          <!-- Status Switcher Dropdown -->
          <div class="dropdown dropdown-end">
            <button tabindex="0" type="button" class="btn btn-xs rounded-xl gap-1 border-none shadow-none" :class="CAST_STATUS_META[cast.status]?.badgeClass">
              <Icon :icon="CAST_STATUS_META[cast.status]?.icon" class="w-3.5 h-3.5" />
              <span>{{ CAST_STATUS_META[cast.status]?.label }}</span>
              <Icon icon="solar:alt-arrow-down-linear" class="w-3 h-3 opacity-60" />
            </button>
            <ul tabindex="0" class="dropdown-content menu p-1.5 shadow-xl bg-base-100 border border-base-300 rounded-2xl w-44 z-30 text-xs space-y-1">
              <li class="menu-title text-[9px] uppercase font-bold opacity-50 px-2">Change Status</li>
              <li>
                <a @click="setStatus(cast.id, 'draft')" :class="{'active font-bold': cast.status === 'draft'}">
                  🟡 Draft (Started)
                </a>
              </li>
              <li>
                <a @click="setStatus(cast.id, 'ready')" :class="{'active font-bold': cast.status === 'ready'}">
                  🔵 Ready to Post
                </a>
              </li>
              <li>
                <a @click="setStatus(cast.id, 'broadcasted')" :class="{'active font-bold': cast.status === 'broadcasted'}">
                  🟢 Broadcasted (Done)
                </a>
              </li>
            </ul>
          </div>
        </div>

        <!-- Middle: Title, Telemetry, and Thumbnail Strip -->
        <div class="space-y-2.5">
          <div>
            <h3 class="font-black text-base sm:text-lg text-base-content group-hover:text-primary transition-colors line-clamp-1" :title="cast.title">
              {{ cast.title }}
            </h3>
            <div class="flex items-center gap-2 text-xs font-mono opacity-65 mt-0.5">
              <span>{{ cast.items.length }} item{{ cast.items.length === 1 ? '' : 's' }}</span>
              <span>•</span>
              <span class="text-success font-bold">${{ Number(cast.totalRetailValue || 0).toFixed(2) }} retail</span>
              <span>•</span>
              <span class="capitalize">{{ cast.platform }}</span>
            </div>
          </div>

          <!-- Photo Reel Thumbnails (Up to 5) -->
          <div class="flex items-center gap-1.5 overflow-x-auto py-1">
            <template v-if="cast.items.length > 0">
              <ItemThumbnail 
                v-for="(it, idx) in cast.items.slice(0, 4)" 
                :key="it.id || it.$id || idx"
                :item="it" 
                :src="resolveItemPhoto(it) || ''" 
                size="md" 
                rounded="xl" 
                class="w-12 h-12 shrink-0 border border-base-300 shadow-2xs"
                :title="it.title"
              />
              <div 
                v-if="cast.items.length > 4" 
                class="w-12 h-12 rounded-xl bg-base-200 border border-base-300 flex items-center justify-center font-mono font-bold text-xs opacity-70 shrink-0"
              >
                +{{ cast.items.length - 4 }}
              </div>
            </template>
            <div v-else class="text-xs opacity-40 italic py-2">
              No items staged yet
            </div>
          </div>

          <!-- Caption Snippet Preview -->
          <div v-if="cast.generatedCaption" class="bg-base-200/50 p-2.5 rounded-2xl border border-base-300/60 text-xs font-sans text-base-content/80 line-clamp-2 leading-relaxed">
            {{ cast.generatedCaption }}
          </div>
        </div>

        <!-- Bottom Actions Row -->
        <div class="pt-3 border-t border-base-200 flex items-center justify-between gap-2">
          <div class="flex items-center gap-1">
            <!-- Quick Copy Caption -->
            <button 
              v-if="cast.generatedCaption"
              type="button" 
              @click="handleCopyCaption(cast)"
              class="btn btn-xs btn-ghost border border-base-300 gap-1 rounded-xl"
              title="Copy Caption"
            >
              <Icon icon="solar:copy-linear" class="w-3.5 h-3.5" />
              <span class="hidden sm:inline">Copy</span>
            </button>

            <!-- Duplicate -->
            <button 
              type="button" 
              @click="duplicate(cast.id)"
              class="btn btn-xs btn-ghost border border-base-300 gap-1 rounded-xl"
              title="Duplicate Cast"
            >
              <Icon icon="solar:documents-linear" class="w-3.5 h-3.5" />
            </button>

            <!-- Delete -->
            <button 
              type="button" 
              @click="removeCast(cast.id)"
              class="btn btn-xs btn-ghost text-error hover:bg-error/10 rounded-xl"
              title="Delete Cast"
            >
              <Icon icon="solar:trash-bin-trash-bold" class="w-3.5 h-3.5" />
            </button>
          </div>

          <!-- Open Studio (Detail Drill-Down) -->
          <button 
            type="button" 
            @click="openStudio(cast)"
            class="btn btn-sm btn-primary text-primary-content font-black rounded-2xl gap-1.5 shadow-2xs hover:scale-105 active:scale-95 transition-all"
          >
            <span>Open Studio</span>
            <Icon icon="solar:arrow-right-linear" class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
import ItemThumbnail from '../common/ItemThumbnail.vue';
import { useDropcasts } from '../../composables/useDropcasts';
import { getItemImageUrl } from '../../composables/useInventoryFilters';
import { type Dropcast } from '../../lib/dropcastModel';
import { getItemImageUrls, type SocialStudioItem } from '../../lib/socialMediaStudio';
import { addToast } from '../../stores/toast';

const {
  filteredDropcasts,
  filterStatus,
  filterLocation,
  filterSearch,
  counts,
  openStudio,
  startCustomCast,
  startQuickCast,
  removeCast,
  duplicate,
  setStatus,
  CAST_TYPE_META,
  CAST_STATUS_META
} = useDropcasts();

const emit = defineEmits<{
  (e: 'quick-restock'): void;
  (e: 'quick-grail'): void;
  (e: 'quick-haul'): void;
  (e: 'quick-sales'): void;
}>();

function resolveItemPhoto(item: any): string | null {
  if (!item) return null;
  if (item.customPhotoDataUrl) return item.customPhotoDataUrl;
  const invUrl = getItemImageUrl(item, 100);
  if (invUrl) return invUrl;
  const urls = getItemImageUrls(item);
  return urls.length > 0 ? urls[0] : null;
}

function handleStartCustomCast() {
  startCustomCast('New Custom Dropcast', 'Memory Den');
}

function handleQuickRestock() {
  emit('quick-restock');
}

function handleQuickGrail() {
  emit('quick-grail');
}

function handleQuickHaul() {
  emit('quick-haul');
}

function handleQuickSalesWrap() {
  emit('quick-sales');
}

async function handleCopyCaption(cast: Dropcast) {
  if (!cast.generatedCaption) return;
  try {
    await navigator.clipboard.writeText(cast.generatedCaption);
    addToast({ type: 'success', message: 'Caption copied to clipboard! 📋' });
  } catch {
    addToast({ type: 'info', message: 'Failed to copy to clipboard' });
  }
}
</script>

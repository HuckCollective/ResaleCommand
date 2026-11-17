<template>
  <Teleport v-if="mounted" to="body">
    <Transition name="rc-queues-sheet">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-400 bg-black/60 backdrop-blur-xs flex flex-col justify-end"
        role="dialog"
        aria-modal="true"
        aria-label="Inventory Queues and Lists"
        @click.self="closeTray"
      >
        <div class="rc-queues-panel bg-base-100 border-t border-base-300 rounded-t-3xl max-w-5xl mx-auto w-full max-h-[82dvh] flex flex-col shadow-2xl overflow-hidden pb-[env(safe-area-inset-bottom,0px)]">
          <!-- Drag Handle Affordance -->
          <div class="w-12 h-1.5 rounded-full bg-base-content/25 mx-auto mt-2.5 mb-1 shrink-0"></div>

          <!-- Sticky Sheet Header -->
          <header class="px-4 sm:px-6 py-2.5 border-b border-base-200 flex items-center justify-between gap-3 shrink-0">
            <div class="min-w-0">
              <h3 class="text-base sm:text-lg font-black tracking-tight text-base-content flex items-center gap-2">
                <span>⚡ Queues &amp; Pull Lists</span>
                <span v-if="activeQueueFilter" class="badge badge-xs badge-secondary text-secondary-content font-bold whitespace-nowrap shrink-0">
                  Filter Active
                </span>
              </h3>
              <p class="text-xs text-base-content/70 truncate">
                Tap any item to inspect or edit in place, or apply a queue to filter your full inventory view.
              </p>
            </div>
            <button
              type="button"
              class="btn btn-ghost btn-sm h-11 w-11 md:h-8 md:w-8 btn-circle shrink-0"
              aria-label="Close Queues Tray"
              @click="closeTray"
            >
              ✕
            </button>
          </header>

          <!-- 3 Plain-English Category Tabs -->
          <div class="px-4 sm:px-6 pt-2.5 pb-2 bg-base-200/45 border-b border-base-200 space-y-2.5 shrink-0">
            <div role="tablist" class="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              <button
                v-for="tab in categoryTabs"
                :key="tab.id"
                type="button"
                role="tab"
                :aria-selected="selectedTab === tab.id"
                class="btn btn-sm h-11 md:h-9 rounded-xl font-bold justify-between px-3 border"
                :class="
                  selectedTab === tab.id
                    ? 'btn-neutral text-neutral-content border-neutral shadow-xs'
                    : 'btn-ghost bg-base-100 border-base-300 text-base-content/85'
                "
                @click="selectCategoryTab(tab.id)"
              >
                <span class="truncate">{{ tab.label }}</span>
                <span
                  class="badge badge-xs font-mono font-bold whitespace-nowrap shrink-0"
                  :class="selectedTab === tab.id ? 'bg-neutral-content/20 text-neutral-content border-0' : 'badge-ghost'"
                >
                  {{ tab.totalCount }}
                </span>
              </button>
            </div>

            <!-- Queue Pills Inside Active Category -->
            <div v-if="queuesInSelectedTab.length > 1" class="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              <button
                v-for="q in queuesInSelectedTab"
                :key="q.id"
                type="button"
                class="btn btn-xs h-11 md:h-8 px-3 rounded-xl font-bold gap-1.5 shrink-0 border"
                :class="
                  selectedQueueId === q.id
                    ? 'btn-secondary text-secondary-content border-secondary shadow-2xs'
                    : 'btn-ghost bg-base-100 border-base-300 text-base-content/80'
                "
                @click="selectedQueueId = q.id"
              >
                <span class="whitespace-nowrap">{{ q.shortLabel }}</span>
                <span class="badge badge-2xs font-mono font-extrabold whitespace-nowrap shrink-0">
                  {{ queueCounts[q.id] || 0 }}
                </span>
              </button>
            </div>

            <p v-if="selectedQueueMeta" class="text-[11px] text-base-content/75 leading-snug">
              {{ selectedQueueMeta.description }}
            </p>
          </div>

          <!-- Instant Preview Item List (Mounts Canonical ItemThumbnail) -->
          <div class="flex-1 min-h-0 overflow-y-auto divide-y divide-base-200 px-4 sm:px-6">
            <div v-if="previewItems.length === 0" class="py-10 text-center space-y-2">
              <div class="text-sm font-bold text-base-content/75">No items in {{ selectedQueueMeta?.shortLabel || 'this queue' }} right now</div>
              <p class="text-xs text-base-content/60">
                <template v-if="selectedQueueId === 'online_ready'">
                  Open any single-unit backstock item and tap <strong>🌐 Online Bin</strong> to stage it here.
                </template>
                <template v-else>
                  All working stock is clear for this list.
                </template>
              </p>
            </div>

            <div
              v-for="item in previewItems.slice(0, 60)"
              :key="item.$id"
              class="py-2.5 flex items-center justify-between gap-3 hover:bg-base-200/50 -mx-2 px-2 rounded-xl cursor-pointer transition-colors"
              @click="emit('inspect-item', item)"
            >
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <ItemThumbnail :item="item" size="sm" rounded="lg" class="shrink-0" />
                <div class="min-w-0 flex-1">
                  <div class="font-bold text-xs sm:text-sm text-base-content line-clamp-1">
                    {{ item.title || 'Untitled Item' }}
                  </div>
                  <div class="flex items-center gap-1.5 flex-wrap mt-0.5 text-[11px] font-mono">
                    <span v-if="item.upc" class="badge badge-2xs badge-ghost border border-base-300 font-bold whitespace-nowrap shrink-0">
                      {{ item.upc }}
                    </span>
                    <span v-if="item.locationSku" class="badge badge-2xs badge-secondary text-secondary-content font-bold whitespace-nowrap shrink-0">
                      {{ String(item.locationSku).replace(/^'+/, '') }}
                    </span>
                    <span v-if="item.storageLocation" class="text-base-content/65 font-semibold">
                      📍 {{ item.storageLocation }}
                    </span>
                    <span v-if="Number(item.quantity || 1) > 1" class="badge badge-2xs badge-warning text-warning-content font-bold whitespace-nowrap shrink-0">
                      📦 ×{{ item.quantity }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-2 shrink-0" @click.stop>
                <span class="font-mono font-black text-xs sm:text-sm text-success">
                  ${{ Number(item.resalePrice || item.boutiquePrice || item.price || 0).toFixed(2) }}
                </span>
                <button
                  v-if="selectedQueueId === 'online_ready' && (item.upc || item.sku)"
                  type="button"
                  class="btn btn-xs h-11 md:h-8 px-2.5 btn-outline rounded-lg font-bold gap-1"
                  title="Copy Pirate Ship Custom Label / SKU"
                  @click="copySku(item.upc || item.sku)"
                >
                  <Icon icon="solar:copy-bold" class="w-3.5 h-3.5 text-primary" />
                  <span class="hidden sm:inline">Copy SKU</span>
                </button>
                <button
                  type="button"
                  class="btn btn-xs h-11 md:h-8 px-2.5 btn-ghost border border-base-300 rounded-lg font-bold"
                  @click="emit('inspect-item', item)"
                >
                  Open
                </button>
              </div>
            </div>
          </div>

          <!-- Sticky Bottom Action Bar -->
          <footer class="px-4 sm:px-6 py-3 border-t border-base-300 bg-base-200/75 flex items-center justify-between gap-2 flex-wrap shrink-0">
            <div class="text-xs font-mono text-base-content/80">
              <strong>{{ previewItems.length }}</strong> item{{ previewItems.length === 1 ? '' : 's' }} • Est. Retail
              <strong class="text-success">${{ previewRetailSum.toFixed(2) }}</strong>
            </div>

            <div class="flex items-center gap-2 ml-auto">
              <button
                v-if="activeQueueFilter"
                type="button"
                class="btn btn-sm h-11 md:h-9 btn-ghost text-error rounded-xl font-bold"
                @click="clearActiveQueue"
              >
                Clear Queue Filter
              </button>
              <button
                type="button"
                :disabled="!selectedQueueId"
                class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content rounded-xl font-black px-4 shadow-xs"
                @click="applySelectedQueue"
              >
                Apply to Full View ({{ previewItems.length }})
              </button>
            </div>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import ItemThumbnail from '../common/ItemThumbnail.vue';
import { useBodyScrollLock } from '../../composables/useBodyScrollLock';
import {
  SMART_QUEUES,
  isWorkingStockItem,
  matchesSmartQueue,
  type SmartQueueId,
} from '../../lib/inventoryVibes';
import { addToast } from '../../stores/toast';

type QueueCategoryId = 'restock' | 'online' | 'health';

const TAB_QUEUES: Record<QueueCategoryId, SmartQueueId[]> = {
  restock: ['md_restock', 'dt_restock', 'booth_bins'],
  online: ['online_ready'],
  health: ['missing_booth_sku', 'needs_md_sync', 'has_booth_sku'],
};

const props = defineProps<{
  modelValue: boolean;
  inventoryItems: any[];
  activeQueueFilter: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'apply-queue', queueId: SmartQueueId | ''): void;
  (e: 'inspect-item', item: any): void;
}>();

const mounted = ref(false);
onMounted(() => {
  mounted.value = true;
});

useBodyScrollLock(() => props.modelValue);

const selectedTab = ref<QueueCategoryId>('restock');
const selectedQueueId = ref<SmartQueueId>('md_restock');

const workingItems = computed(() =>
  (props.inventoryItems || []).filter((item) => isWorkingStockItem(item))
);

const queueCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {};
  for (const q of SMART_QUEUES) counts[q.id] = 0;
  for (const item of workingItems.value) {
    for (const q of SMART_QUEUES) {
      if (matchesSmartQueue(item, q.id)) {
        counts[q.id] = (counts[q.id] || 0) + 1;
      }
    }
  }
  return counts;
});

const categoryTabs = computed(() => [
  {
    id: 'restock' as const,
    label: '🏪 Booth Restock Lists',
    totalCount:
      (queueCounts.value.md_restock || 0) +
      (queueCounts.value.dt_restock || 0) +
      (queueCounts.value.booth_bins || 0),
  },
  {
    id: 'online' as const,
    label: '🌐 Shared Online Ready Bin',
    totalCount: queueCounts.value.online_ready || 0,
  },
  {
    id: 'health' as const,
    label: '🔧 Barcode & Tag Health',
    totalCount:
      (queueCounts.value.missing_booth_sku || 0) +
      (queueCounts.value.needs_md_sync || 0),
  },
]);

const queuesInSelectedTab = computed(() => {
  const ids = TAB_QUEUES[selectedTab.value];
  return SMART_QUEUES.filter((q) => ids.includes(q.id));
});

const selectedQueueMeta = computed(
  () => SMART_QUEUES.find((q) => q.id === selectedQueueId.value) || null
);

const previewItems = computed(() =>
  workingItems.value.filter((item) => matchesSmartQueue(item, selectedQueueId.value))
);

const previewRetailSum = computed(() =>
  previewItems.value.reduce((sum, item) => {
    const qty = Math.max(1, Number(item?.quantity) || 1);
    const unit = Number(item?.resalePrice || item?.boutiquePrice || item?.price || 0);
    return sum + unit * qty;
  }, 0)
);

const selectCategoryTab = (tabId: QueueCategoryId) => {
  selectedTab.value = tabId;
  const firstQueue = TAB_QUEUES[tabId][0];
  if (firstQueue) selectedQueueId.value = firstQueue;
};

const syncTabFromActiveQueue = (qId: string) => {
  if (!qId) return;
  for (const [tabKey, qList] of Object.entries(TAB_QUEUES) as [QueueCategoryId, SmartQueueId[]][]) {
    if (qList.includes(qId as SmartQueueId)) {
      selectedTab.value = tabKey;
      selectedQueueId.value = qId as SmartQueueId;
      return;
    }
  }
};

const closeTray = () => {
  emit('update:modelValue', false);
};

const applySelectedQueue = () => {
  emit('apply-queue', selectedQueueId.value);
  closeTray();
};

const clearActiveQueue = () => {
  emit('apply-queue', '');
  closeTray();
};

const copySku = async (rawSku: string) => {
  const clean = String(rawSku || '').trim().toUpperCase();
  if (!clean) return;
  try {
    await navigator.clipboard.writeText(clean);
    addToast({
      type: 'success',
      message: `Copied ${clean} — ready for Pirate Ship Custom Label / SKU!`,
    });
  } catch {
    addToast({ type: 'info', message: `SKU: ${clean}` });
  }
};

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') closeTray();
};

watch(
  () => props.modelValue,
  (open) => {
    if (typeof document === 'undefined') return;
    if (open) {
      if (props.activeQueueFilter) {
        syncTabFromActiveQueue(props.activeQueueFilter);
      }
      document.addEventListener('keydown', onKeyDown);
    } else {
      document.removeEventListener('keydown', onKeyDown);
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  if (typeof document === 'undefined') return;
  document.removeEventListener('keydown', onKeyDown);
});
</script>

<style scoped>
.rc-queues-sheet-enter-active,
.rc-queues-sheet-leave-active {
  transition: opacity 0.2s ease;
}
.rc-queues-sheet-enter-active .rc-queues-panel,
.rc-queues-sheet-leave-active .rc-queues-panel {
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}
.rc-queues-sheet-enter-from,
.rc-queues-sheet-leave-to {
  opacity: 0;
}
.rc-queues-sheet-enter-from .rc-queues-panel,
.rc-queues-sheet-leave-to .rc-queues-panel {
  transform: translateY(100%);
}
</style>

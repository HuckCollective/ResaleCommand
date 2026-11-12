<template>
  <div>
    <!-- ======================================================= -->
    <!-- INTERACTIVE BOTTOM-SHEET DETENT TRAY STACK (ONE AT A TIME) -->
    <!-- ======================================================= -->
    <Teleport v-if="isMounted" to="body">
      <div
        v-if="activeTray"
        class="fixed inset-0 z-[390] bg-black/60 backdrop-blur-xs flex flex-col justify-end p-0 sm:px-4"
        @click.self="closeTray"
      >
        <div
          class="bg-base-100 border-t border-x border-base-300 rounded-t-3xl max-w-3xl mx-auto w-full max-h-[86dvh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200"
          role="dialog"
          aria-modal="true"
          :aria-label="sheetTitle"
        >
          <!-- Drag Handle Pill -->
          <div class="pt-2.5 pb-1 flex justify-center bg-base-200/40 select-none shrink-0" @click="closeTray">
            <div class="w-12 h-1.5 rounded-full bg-base-content/25"></div>
          </div>

          <!-- Pinned Sheet Header + Segmented Stack Tabs -->
          <div class="px-4 sm:px-6 pt-1 pb-3 border-b border-base-200 bg-base-200/40 space-y-2.5 shrink-0">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-9 h-9 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <Icon :icon="sheetIcon" class="w-5 h-5" />
                </div>
                <div class="min-w-0">
                  <h3 class="text-sm sm:text-base font-black text-base-content break-words">
                    {{ sheetTitle }}
                  </h3>
                  <p class="text-[11px] text-base-content/65 break-words">
                    {{ sheetSubtitle }}
                  </p>
                </div>
              </div>
              <button
                type="button"
                class="btn btn-sm btn-ghost btn-circle shrink-0"
                aria-label="Close tray"
                @click="closeTray"
              >
                ✕
              </button>
            </div>

            <!-- Tray Stack Switcher (Zero Competing Sheets) -->
            <div class="flex items-center gap-1.5 overflow-x-auto max-w-full scrollbar-none pb-0.5">
              <button
                type="button"
                class="btn btn-xs h-8 rounded-xl font-bold gap-1.5 shrink-0"
                :class="activeTray === 'triage' ? 'btn-warning text-warning-content shadow-xs' : 'btn-ghost bg-base-100 border border-base-300'"
                @click="openTray('triage')"
              >
                <Icon icon="solar:bell-bing-bold" class="w-3.5 h-3.5 shrink-0" />
                <span>Triage Queue</span>
                <span
                  class="badge badge-2xs font-mono font-bold whitespace-nowrap shrink-0"
                  :class="activeTray === 'triage' ? 'badge-neutral text-neutral-content' : 'badge-warning text-warning-content'"
                >
                  {{ activeCards.length }}
                </span>
              </button>

              <button
                v-if="showCollectiveRadar"
                type="button"
                class="btn btn-xs h-8 rounded-xl font-bold gap-1.5 shrink-0"
                :class="activeTray === 'radar' ? 'btn-secondary text-secondary-content shadow-xs' : 'btn-ghost bg-base-100 border border-base-300'"
                @click="openTray('radar')"
              >
                <Icon icon="solar:radar-2-bold" class="w-3.5 h-3.5 shrink-0" />
                <span>Restock Radar</span>
                <span
                  class="badge badge-2xs font-mono font-bold whitespace-nowrap shrink-0"
                  :class="activeTray === 'radar' ? 'badge-neutral text-neutral-content' : 'badge-secondary text-secondary-content'"
                >
                  {{ categoryCounts.queues }}
                </span>
              </button>

              <button
                type="button"
                class="btn btn-xs h-8 rounded-xl font-bold gap-1.5 shrink-0"
                :class="activeTray === 'tools' ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost bg-base-100 border border-base-300'"
                @click="openTray('tools')"
              >
                <Icon icon="solar:compass-bold" class="w-3.5 h-3.5 shrink-0" />
                <span>Role &amp; Tools</span>
              </button>
            </div>
          </div>

          <!-- Lazy-Mounted Tray Bodies -->
          <TriageTrayBody v-if="activeTray === 'triage'" />
          <RadarTrayBody v-else-if="activeTray === 'radar' && showCollectiveRadar" />
          <ToolsTrayBody
            v-else-if="activeTray === 'tools'"
            @handoff-messages="handoffToMessages"
            @handoff-join-queue="handoffToJoinQueue"
            @handoff-tax-playbook="handoffToTaxPlaybook"
          />

          <!-- Sticky Sheet Container Footer -->
          <BottomActionDock placement="container" :teleport="false" :transition="false">
            <template #left>
              <span class="text-xs font-bold text-base-content/70 break-words">
                {{ lensLabel }}
              </span>
            </template>
            <template #right>
              <button
                v-if="activeTray === 'triage' && snoozedCards.length > 0"
                type="button"
                class="btn btn-xs btn-ghost rounded-xl font-bold"
                @click="unsnoozeAll"
              >
                Unsnooze All ({{ snoozedCards.length }})
              </button>
              <a
                :href="primaryCpa.href"
                data-demo-allow
                class="btn btn-xs sm:btn-sm btn-primary text-primary-content rounded-xl font-black gap-1.5 px-3.5 shadow-sm"
              >
                <Icon :icon="primaryCpa.icon" class="w-4 h-4 shrink-0" />
                <span>{{ primaryCpa.label }}</span>
              </a>
              <button
                type="button"
                class="btn btn-xs sm:btn-sm btn-outline rounded-xl font-bold"
                @click="closeTray"
              >
                Done
              </button>
            </template>
          </BottomActionDock>
        </div>
      </div>
    </Teleport>

    <!-- ======================================================= -->
    <!-- PERSISTENT THUMB-ZONE CONTEXTUAL COMMAND DOCK           -->
    <!-- ======================================================= -->
    <BottomActionDock placement="viewport">
      <template #left>
        <div class="hidden md:flex items-center gap-2 min-w-0">
          <button
            type="button"
            class="btn btn-xs rounded-xl btn-ghost border border-base-300 font-extrabold gap-1.5 shrink-0"
            title="Switch active hat lens or open Role shortcuts"
            @click="toggleTray('tools')"
          >
            <span>{{ activeLens === 'all' ? '✨' : META[activeHat].icon }}</span>
            <span>{{ activeLens === 'all' ? 'All Hats' : META[activeHat].label }}</span>
          </button>

          <button
            v-if="unionActiveCount > 0"
            type="button"
            class="badge badge-sm font-extrabold gap-1 cursor-pointer whitespace-nowrap shrink-0 py-2.5 px-2.5"
            :class="criticalCount > 0 ? 'badge-warning text-warning-content' : 'badge-info text-info-content'"
            @click="toggleTray('triage')"
          >
            <Icon icon="solar:bell-bing-bold" class="w-3.5 h-3.5 shrink-0" />
            <span>{{ unionActiveCount }} need{{ unionActiveCount === 1 ? 's' : '' }} attention</span>
          </button>
          <span v-else class="badge badge-sm badge-success text-success-content font-bold whitespace-nowrap shrink-0">
            All Caught Up
          </span>
        </div>
      </template>

      <template #right>
        <!-- 1. Triage Stack Trigger -->
        <button
          type="button"
          class="h-10 sm:h-11 px-2.5 sm:px-3.5 rounded-2xl flex items-center justify-center gap-1.5 transition-all duration-200 font-extrabold text-xs border shadow-xs active:scale-95 shrink-0"
          :class="
            activeTray === 'triage'
              ? 'bg-warning text-warning-content border-warning-content/25 shadow-md'
              : unionActiveCount > 0
                ? 'bg-warning/15 hover:bg-warning/25 text-base-content border-warning/50'
                : 'bg-base-200/80 hover:bg-base-300 text-base-content border-base-content/15'
          "
          @click="toggleTray('triage')"
        >
          <Icon icon="solar:bell-bing-bold" class="w-4 h-4 shrink-0" :class="activeTray === 'triage' ? '' : 'text-warning'" />
          <span>Triage</span>
          <span
            v-if="unionActiveCount > 0"
            class="badge badge-2xs font-mono font-black whitespace-nowrap shrink-0"
            :class="activeTray === 'triage' ? 'badge-neutral text-neutral-content' : 'badge-warning text-warning-content'"
          >
            {{ unionActiveCount }}
          </span>
        </button>

        <!-- 2. Restock Radar Trigger (Voting Members) -->
        <button
          v-if="showCollectiveRadar"
          type="button"
          class="h-10 sm:h-11 px-2.5 sm:px-3.5 rounded-2xl flex items-center justify-center gap-1.5 transition-all duration-200 font-extrabold text-xs border shadow-xs active:scale-95 shrink-0"
          :class="
            activeTray === 'radar'
              ? 'bg-secondary text-secondary-content border-secondary-content/25 shadow-md'
              : 'bg-base-200/80 hover:bg-base-300 text-base-content border-base-content/15'
          "
          @click="toggleTray('radar')"
        >
          <Icon icon="solar:radar-2-bold" class="w-4 h-4 shrink-0" :class="activeTray === 'radar' ? '' : 'text-secondary'" />
          <span>Radar</span>
          <span
            class="badge badge-2xs font-mono font-bold whitespace-nowrap shrink-0"
            :class="activeTray === 'radar' ? 'badge-neutral text-neutral-content' : 'badge-ghost border-base-300'"
          >
            {{ categoryCounts.queues }}
          </span>
        </button>

        <!-- 3. Role & Tools Trigger -->
        <button
          type="button"
          class="h-10 sm:h-11 px-2.5 sm:px-3.5 rounded-2xl flex items-center justify-center gap-1.5 transition-all duration-200 font-extrabold text-xs border shadow-xs active:scale-95 shrink-0"
          :class="
            activeTray === 'tools'
              ? 'bg-primary text-primary-content border-primary-content/25 shadow-md'
              : 'bg-base-200/80 hover:bg-base-300 text-base-content border-base-content/15'
          "
          @click="toggleTray('tools')"
        >
          <Icon icon="solar:compass-bold" class="w-4 h-4 shrink-0" :class="activeTray === 'tools' ? '' : 'text-primary'" />
          <span class="md:hidden">{{ activeLens === 'all' ? 'All Hats' : META[activeHat].label }}</span>
          <span class="hidden md:inline">Tools</span>
        </button>

        <!-- 4. Messages & Bug Tray Trigger (Live Mode) -->
        <button
          v-if="source.mode === 'live'"
          type="button"
          class="h-10 sm:h-11 px-2.5 rounded-2xl flex items-center justify-center gap-1 transition-all duration-200 bg-base-200/80 hover:bg-base-300 text-base-content font-bold text-xs border border-base-content/15 shadow-xs active:scale-95 shrink-0"
          title="Open Co-op Messages & Screenshot Bug Reports"
          @click="handoffToMessages('list')"
        >
          <Icon icon="solar:chat-round-dots-bold" class="w-4 h-4 text-info shrink-0" />
          <span class="hidden sm:inline">Msgs</span>
        </button>

        <!-- 5. Solid Elevated Contextual Primary Action (CPA) -->
        <a
          :href="primaryCpa.href"
          data-demo-allow
          class="h-10 sm:h-11 px-3.5 sm:px-4 rounded-2xl flex items-center justify-center gap-1.5 transition-all duration-200 bg-primary text-primary-content font-black text-xs uppercase tracking-wide shadow-md border border-primary-content/25 active:scale-95 hover:brightness-110 shrink-0"
        >
          <Icon :icon="primaryCpa.icon" class="w-4 h-4 shrink-0" />
          <span class="sm:hidden">{{ primaryCpa.shortLabel }}</span>
          <span class="hidden sm:inline">{{ primaryCpa.label }}</span>
        </a>
      </template>
    </BottomActionDock>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Icon } from '@iconify/vue';
import BottomActionDock from '../common/BottomActionDock.vue';
import TriageTrayBody from './trays/TriageTrayBody.vue';
import RadarTrayBody from './trays/RadarTrayBody.vue';
import ToolsTrayBody from './trays/ToolsTrayBody.vue';
import { canSeeCollectiveFinancials, MEMBER_HAT_META } from '../../lib/memberHats';
import {
  useDashboardSource,
  useActiveHat,
  useActiveLens,
} from '../../composables/dashboard/useDashboardSource';
import { useOperationsRadar } from '../../composables/dashboard/useOperationsRadar';
import {
  useDashboardCommandTray,
  getRolePrimaryCpa,
} from '../../composables/dashboard/useDashboardCommandTray';

const META = MEMBER_HAT_META;
const source = useDashboardSource();
const activeHat = useActiveHat();
const activeLens = useActiveLens();
const {
  activeTray,
  activeCards,
  snoozedCards,
  criticalCount,
  unionActiveCount,
  openTray,
  toggleTray,
  closeTray,
  unsnoozeAll,
} = useDashboardCommandTray();

const { categoryCounts } = useOperationsRadar();
const isMounted = ref(false);

const showCollectiveRadar = computed(() => canSeeCollectiveFinancials(source.member.value.hats));
const primaryCpa = computed(() => getRolePrimaryCpa(activeHat.value));
const lensLabel = computed(() =>
  activeLens.value === 'all' ? '✨ All Hats Lens' : `${META[activeHat.value].icon} ${META[activeHat.value].label} Lens`
);

const sheetTitle = computed(() => {
  if (activeTray.value === 'radar') return 'Operations & Booth Restock Radar';
  if (activeTray.value === 'tools') return 'Role Shortcuts, Queues & Tools';
  return 'Needs Your Attention — Triage Queue';
});

const sheetSubtitle = computed(() => {
  if (activeTray.value === 'radar') return 'Jump straight to any restock, booth sync, or partner workbench queue';
  if (activeTray.value === 'tools') return 'Switch your active hat lens, log labor hours, or open co-op drawers';
  return `${activeCards.value.length} active alert${activeCards.value.length === 1 ? '' : 's'} in current lens`;
});

const sheetIcon = computed(() => {
  if (activeTray.value === 'radar') return 'solar:radar-2-bold';
  if (activeTray.value === 'tools') return 'solar:compass-bold';
  return 'solar:bell-bing-bold';
});

const handoffToMessages = (mode: 'list' | 'new_bug') => {
  closeTray();
  window.dispatchEvent(new CustomEvent('rc:open-coop-messages', { detail: { mode } }));
};

const handoffToJoinQueue = () => {
  closeTray();
  window.dispatchEvent(new CustomEvent('rc:open-join-queue-tray'));
};

const handoffToTaxPlaybook = () => {
  closeTray();
  window.dispatchEvent(new CustomEvent('rc:open-tax-playbook'));
};

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && activeTray.value) {
    closeTray();
  }
};

const handleExternalSheetOpen = () => {
  if (activeTray.value) closeTray();
};

onMounted(() => {
  isMounted.value = true;
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('rc:open-coop-messages', handleExternalSheetOpen);
  window.addEventListener('rc:open-join-queue-tray', handleExternalSheetOpen);
  window.addEventListener('rc:open-tax-playbook', handleExternalSheetOpen);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('rc:open-coop-messages', handleExternalSheetOpen);
  window.removeEventListener('rc:open-join-queue-tray', handleExternalSheetOpen);
  window.removeEventListener('rc:open-tax-playbook', handleExternalSheetOpen);
});
</script>

<template>
  <div class="card bg-base-100 border border-base-300/90 shadow-sm rounded-2xl overflow-hidden">
    <div
      class="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer hover:bg-base-200/40 transition-colors select-none"
      :class="{ 'border-b border-base-200': !isCollapsed }"
      role="button"
      :aria-expanded="!isCollapsed"
      tabindex="0"
      @click="toggle"
      @keydown.enter.space="toggle"
    >
      <div class="flex items-center gap-2.5 min-w-0">
        <div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon icon="solar:compass-bold-duotone" class="w-5 h-5" />
        </div>
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="text-sm font-extrabold text-base-content break-words">
              {{ META[activeHat].icon }} {{ META[activeHat].label }} Shortcuts
            </span>
            <span class="badge badge-xs badge-ghost font-semibold whitespace-nowrap shrink-0">
              {{ memberName }}
            </span>
            <span v-if="showAllHatsNote" class="text-[11px] font-semibold opacity-55">(all hats)</span>
          </div>
          <p class="text-[11px] text-base-content/65 break-words">{{ META[activeHat].pitch }}</p>
        </div>
      </div>

      <div class="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
        <button
          type="button"
          class="btn btn-xs btn-outline rounded-xl font-bold gap-1"
          @click.stop="openTray('tools')"
        >
          <span>Open in Tray</span>
          <Icon icon="solar:alt-arrow-up-bold" class="w-3 h-3 shrink-0" />
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-xs btn-circle shrink-0"
          :aria-expanded="!isCollapsed"
          aria-label="Toggle Role Shortcuts"
        >
          <Icon
            icon="solar:alt-arrow-down-linear"
            class="w-4 h-4 transition-transform duration-200"
            :class="{ '-rotate-90': isCollapsed }"
          />
        </button>
      </div>
    </div>

    <div v-show="!isCollapsed" class="p-3.5 sm:p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 bg-base-100">
      <a
        v-for="action in actions"
        :key="action.href + action.label"
        :href="action.href"
        class="p-3 rounded-xl bg-base-200/50 border border-base-300 hover:border-primary/50 hover:bg-base-200 transition-all flex items-center gap-2.5"
      >
        <Icon :icon="action.icon" class="w-5 h-5 text-primary shrink-0" />
        <div class="min-w-0">
          <div class="text-xs font-black break-words">{{ action.label }}</div>
          <div class="text-[10px] opacity-60 break-words">{{ action.hint }}</div>
        </div>
      </a>
      <button
        v-if="canLogHours"
        type="button"
        class="p-3 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/15 transition-all flex items-center gap-2.5 text-left"
        :disabled="logging"
        @click="logHours"
      >
        <Icon icon="solar:clock-circle-bold-duotone" class="w-5 h-5 text-primary shrink-0" />
        <div class="min-w-0">
          <div class="text-xs font-black break-words">+ Log {{ META[activeHat].label }} Hours (1.5h)</div>
          <div class="text-[10px] opacity-60 break-words">Counts toward the Labor &amp; Surplus Pool</div>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { addToast } from '../../stores/toast';
import { MEMBER_HAT_META } from '../../lib/memberHats';
import { useDashboardSource, useActiveHat } from '../../composables/dashboard/useDashboardSource';
import { useCollapsibleSection } from '../../composables/dashboard/useCollapsibleSection';
import { useDashboardCommandTray, getRoleActionsForHat } from '../../composables/dashboard/useDashboardCommandTray';

const META = MEMBER_HAT_META;
const source = useDashboardSource();
const activeHat = useActiveHat();
const { openTray } = useDashboardCommandTray();
const { isCollapsed, toggle } = useCollapsibleSection('role_shortcuts_v1', true, source.mode === 'live');
const logging = ref(false);

const member = source.member;
const memberName = computed(() => member.value.name);
const prefix = computed(() => member.value.inventoryPrefix || '');
const showAllHatsNote = computed(() => source.mode === 'live' && !source.hasMemberProfile.value);

const canLogHours = computed(() => activeHat.value === 'promoter' || activeHat.value === 'enabler');
const actions = computed(() => getRoleActionsForHat(activeHat.value, prefix.value));

const logHours = async () => {
  if (!source.logHours) {
    addToast({ type: 'info', message: 'This is an example. Members can log hours here.' });
    return;
  }
  logging.value = true;
  try {
    const { syncedToCloud } = await source.logHours(activeHat.value);
    addToast({
      type: syncedToCloud ? 'success' : 'warning',
      message: syncedToCloud ? 'Logged 1.5h to the Labor Pool' : 'Logged locally; cloud sync failed',
    });
  } finally {
    logging.value = false;
  }
};
</script>

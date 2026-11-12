<template>
  <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
    <!-- Active Role Hat Lens Picker -->
    <div class="rounded-2xl bg-base-200/60 border border-base-300 p-3.5 space-y-2">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="text-[11px] font-extrabold uppercase tracking-wider text-primary">
          Active Lens · {{ memberName }}
        </span>
        <span v-if="prefix" class="badge badge-outline badge-xs font-mono font-bold whitespace-nowrap shrink-0">
          {{ prefix }}
        </span>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="hat in availableHats"
          :key="`tray-hat-${hat}`"
          type="button"
          class="btn btn-xs h-8 rounded-xl gap-1 font-bold"
          :class="activeLens === hat ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost bg-base-100 border border-base-300'"
          @click="activeLens = hat"
        >
          <span>{{ META[hat].icon }}</span>
          <span>{{ META[hat].label }}</span>
          <span
            v-if="hatAlertCounts[hat] > 0 && activeLens !== hat"
            class="badge badge-2xs badge-warning text-warning-content font-mono font-black"
          >
            {{ hatAlertCounts[hat] }}
          </span>
        </button>

        <button
          v-if="availableHats.length > 1"
          type="button"
          class="btn btn-xs h-8 rounded-xl gap-1 font-bold"
          :class="activeLens === 'all' ? 'btn-secondary text-secondary-content shadow-xs' : 'btn-ghost bg-base-100 border border-base-300'"
          @click="activeLens = 'all'"
        >
          <span>✨</span>
          <span>All Hats</span>
        </button>
      </div>
      <p class="text-xs text-base-content/70 break-words">
        {{ activeLens === 'all' ? 'Combined view across all of your Collective hats.' : META[activeHat].pitch }}
      </p>
      <details v-if="activeRoleHelpHtml" class="text-xs text-base-content/75 pt-1 border-t border-base-300/70">
        <summary class="cursor-pointer font-bold text-primary select-none">
          How the {{ META[activeHat].label }} role works &amp; earns
        </summary>
        <div
          class="prose prose-xs max-w-none pt-1.5 text-base-content/85 break-words"
          v-html="activeRoleHelpHtml"
        ></div>
      </details>
    </div>

    <!-- Role Quick Launch Grid -->
    <div class="space-y-2">
      <div class="text-[11px] font-extrabold uppercase tracking-wider opacity-65">
        {{ META[activeHat].label }} Shortcuts
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <a
          v-for="action in roleActions"
          :key="`tray-act-${action.href}-${action.label}`"
          :href="action.href"
          class="p-3 rounded-xl bg-base-100 border border-base-300 hover:border-primary/60 hover:bg-base-200/50 transition-all flex items-center gap-2.5"
        >
          <Icon :icon="action.icon" class="w-5 h-5 text-primary shrink-0" />
          <div class="min-w-0">
            <div class="text-xs font-black break-words">{{ action.label }}</div>
            <div class="text-[11px] opacity-65 break-words">{{ action.hint }}</div>
          </div>
        </a>

        <button
          v-if="canLogHours"
          type="button"
          class="p-3 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/15 transition-all flex items-center gap-2.5 text-left"
          :disabled="loggingHours"
          @click="handleLogHours"
        >
          <Icon icon="solar:clock-circle-bold-duotone" class="w-5 h-5 text-primary shrink-0" />
          <div class="min-w-0">
            <div class="text-xs font-black break-words">+ Log {{ META[activeHat].label }} Hours (1.5h)</div>
            <div class="text-[11px] opacity-65 break-words">Counts toward the Labor &amp; Surplus Pool</div>
          </div>
        </button>
      </div>
    </div>

    <!-- Collective Utilities & Drawer Handoffs -->
    <div class="space-y-2">
      <div class="text-[11px] font-extrabold uppercase tracking-wider opacity-65">
        Queues, Playbooks &amp; Feedback
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          v-if="source.mode === 'live' && showCollectiveRadar"
          type="button"
          class="p-3 rounded-xl bg-base-100 border border-info/40 hover:bg-info/10 transition-all flex items-center justify-between gap-2 text-left"
          @click="emit('handoff-join-queue')"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <Icon icon="solar:user-plus-bold-duotone" class="w-5 h-5 text-info shrink-0" />
            <div class="min-w-0">
              <div class="text-xs font-black break-words">Co-op Join &amp; Invite Queue</div>
              <div class="text-[11px] opacity-65 break-words">Review applicants, waitlist &amp; invites</div>
            </div>
          </div>
          <span v-if="joinRequestCount > 0" class="badge badge-info text-info-content badge-xs font-bold whitespace-nowrap shrink-0">
            {{ joinRequestCount }}
          </span>
        </button>

        <button
          v-if="showCollectiveRadar"
          type="button"
          class="p-3 rounded-xl bg-base-100 border border-success/40 hover:bg-success/10 transition-all flex items-center gap-2.5 text-left"
          @click="emit('handoff-tax-playbook')"
        >
          <Icon icon="solar:book-bookmark-bold-duotone" class="w-5 h-5 text-success shrink-0" />
          <div class="min-w-0">
            <div class="text-xs font-black break-words">IRS Schedule C Tax Playbook</div>
            <div class="text-[11px] opacity-65 break-words">Mileage, rent, postage &amp; Cohan rules</div>
          </div>
        </button>

        <button
          v-if="source.mode === 'live'"
          type="button"
          class="p-3 rounded-xl bg-base-100 border border-warning/40 hover:bg-warning/10 transition-all flex items-center gap-2.5 text-left"
          @click="emit('handoff-messages', 'new_bug')"
        >
          <Icon icon="solar:bug-bold-duotone" class="w-5 h-5 text-warning shrink-0" />
          <div class="min-w-0">
            <div class="text-xs font-black break-words">Report UI Bug or Paste Screenshot</div>
            <div class="text-[11px] opacity-65 break-words">Opens Co-op Messages &amp; AI Vault tray</div>
          </div>
        </button>

        <a
          v-if="isAdmin"
          href="/settings"
          class="p-3 rounded-xl bg-base-100 border border-base-300 hover:border-primary/50 transition-all flex items-center gap-2.5"
        >
          <Icon icon="solar:settings-bold-duotone" class="w-5 h-5 text-primary shrink-0" />
          <div class="min-w-0">
            <div class="text-xs font-black break-words">Steward Global Settings</div>
            <div class="text-[11px] opacity-65 break-words">Splits, barcode prefixes &amp; presets</div>
          </div>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Icon } from '@iconify/vue';
import { addToast } from '../../../stores/toast';
import { canSeeCollectiveFinancials, MEMBER_HAT_META } from '../../../lib/memberHats';
import {
  useDashboardSource,
  useActiveHat,
  useActiveLens,
  useRoleHelpHtml,
} from '../../../composables/dashboard/useDashboardSource';
import {
  useDashboardCommandTray,
  getRoleActionsForHat,
} from '../../../composables/dashboard/useDashboardCommandTray';

const emit = defineEmits<{
  (e: 'handoff-messages', mode: 'list' | 'new_bug'): void;
  (e: 'handoff-join-queue'): void;
  (e: 'handoff-tax-playbook'): void;
}>();

const META = MEMBER_HAT_META;
const source = useDashboardSource();
const activeHat = useActiveHat();
const activeLens = useActiveLens();
const roleHelpHtmlMap = useRoleHelpHtml();
const { hatAlertCounts } = useDashboardCommandTray();

const activeRoleHelpHtml = computed(() => roleHelpHtmlMap[activeHat.value] || '');

const loggingHours = ref(false);
const memberName = computed(() => source.member.value.name);
const availableHats = computed(() => source.member.value.hats);
const prefix = computed(() => source.member.value.inventoryPrefix || '');
const isAdmin = computed(() => source.isAdmin.value);
const showCollectiveRadar = computed(() => canSeeCollectiveFinancials(source.member.value.hats));
const joinRequestCount = computed(() => source.snapshot.value.joinRequests || 0);

const canLogHours = computed(() => activeHat.value === 'promoter' || activeHat.value === 'enabler');
const roleActions = computed(() => getRoleActionsForHat(activeHat.value, prefix.value));

const handleLogHours = async () => {
  if (!source.logHours) {
    addToast({ type: 'info', message: 'This is an example. Members can log hours here.' });
    return;
  }
  loggingHours.value = true;
  try {
    const { syncedToCloud } = await source.logHours(activeHat.value);
    addToast({
      type: syncedToCloud ? 'success' : 'warning',
      message: syncedToCloud ? 'Logged 1.5h to the Labor Pool' : 'Logged locally; cloud sync failed',
    });
  } finally {
    loggingHours.value = false;
  }
};
</script>


<template>
  <section v-if="cards.length > 0" class="space-y-3" aria-label="Needs your attention">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <h2 class="text-sm sm:text-base font-black tracking-tight">Needs Your Attention</h2>
        <span class="badge badge-warning badge-sm font-bold whitespace-nowrap">{{ cards.length }}</span>
      </div>
      <span v-if="snoozedCount > 0" class="text-[11px] text-base-content/60">{{ snoozedCount }} snoozed</span>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      <article
        v-for="card in cards"
        :key="card.id"
        class="card bg-base-100 border-2 shadow-sm rounded-2xl p-4 flex flex-col gap-2.5"
        :class="severityBorder[card.severity]"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-start gap-2 min-w-0">
            <Icon :icon="card.icon" class="w-5 h-5 shrink-0 mt-0.5" :class="severityText[card.severity]" />
            <div class="min-w-0">
              <div class="text-[10px] font-extrabold uppercase tracking-wider opacity-60">{{ categoryLabel[card.category] }}</div>
              <h3 class="text-sm font-black leading-snug break-words">{{ card.title }}</h3>
            </div>
          </div>
          <span class="badge font-black shrink-0 whitespace-nowrap" :class="severityBadge[card.severity]">{{ card.count }}</span>
        </div>

        <p class="text-xs text-base-content/75 leading-relaxed break-words">{{ card.detail }}</p>

        <ul v-if="card.samples.length > 0" class="space-y-1">
          <li v-for="(s, i) in card.samples" :key="i">
            <a :href="s.href" class="text-xs font-semibold link link-hover text-base-content/85 break-words">• {{ s.label }}</a>
          </li>
        </ul>

        <div class="mt-auto pt-2 border-t border-base-200 flex flex-wrap items-center justify-between gap-2">
          <a :href="card.href" class="btn btn-xs btn-primary rounded-lg font-bold gap-1 h-auto min-h-7 py-1 whitespace-normal">
            {{ card.actionText }}
            <Icon icon="solar:arrow-right-linear" class="w-3.5 h-3.5 shrink-0" />
          </a>
          <div class="dropdown dropdown-end">
            <button type="button" tabindex="0" class="btn btn-xs btn-ghost rounded-lg font-bold gap-1">
              <Icon icon="solar:bell-off-linear" class="w-3.5 h-3.5" />
              Snooze
            </button>
            <ul tabindex="0" class="dropdown-content menu menu-xs z-10 p-1 shadow-lg bg-base-100 border border-base-200 rounded-xl w-36">
              <li><button type="button" @click="snooze(card.id, 1)">1 day</button></li>
              <li><button type="button" @click="snooze(card.id, 7)">1 week</button></li>
            </ul>
          </div>
        </div>
      </article>
    </div>
  </section>

  <section v-else class="rounded-2xl border border-success/30 bg-success/5 px-4 py-3 text-sm flex items-center gap-2">
    <Icon icon="solar:check-circle-bold" class="w-5 h-5 text-success shrink-0" />
    <span class="font-semibold">All caught up. Nothing needs your attention right now.</span>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Icon } from '@iconify/vue';
import { buildAlertsForMember, type AlertSeverity, type AlertCategory } from '../../lib/dashboardAlerts';
import { useDashboardSource, useActiveHat } from '../../composables/dashboard/useDashboardSource';

const source = useDashboardSource();
const activeHat = useActiveHat();

const SNOOZE_KEY = 'rc_alert_snooze_v1';
const snoozeUntil = ref<Record<string, number>>({});

onMounted(() => {
  // Demo always shows every card; live remembers snoozes on this device.
  if (source.mode !== 'live') return;
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    if (raw) snoozeUntil.value = JSON.parse(raw);
  } catch {}
});

const allCards = computed(() => {
  // Evaluate for the hat the member is currently wearing so the card set follows the hat chips.
  const member = { ...source.member.value, hats: [activeHat.value] };
  return buildAlertsForMember(source.snapshot.value, member, { liveOnly: source.mode === 'live' });
});

const cards = computed(() => allCards.value.filter((c) => (snoozeUntil.value[c.id] ?? 0) <= source.snapshot.value.now));
const snoozedCount = computed(() => allCards.value.length - cards.value.length);

const snooze = (id: string, days: number) => {
  if (source.mode !== 'live') {
    // Demo: hide for this visit only, nothing is stored
    snoozeUntil.value = { ...snoozeUntil.value, [id]: Date.now() + days * 86_400_000 };
    return;
  }
  snoozeUntil.value = { ...snoozeUntil.value, [id]: Date.now() + days * 86_400_000 };
  try {
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(snoozeUntil.value));
  } catch {}
};

const severityBorder: Record<AlertSeverity, string> = {
  error: 'border-error/50',
  warning: 'border-warning/50',
  info: 'border-info/40',
  success: 'border-success/40',
};
const severityText: Record<AlertSeverity, string> = {
  error: 'text-error',
  warning: 'text-warning',
  info: 'text-info',
  success: 'text-success',
};
const severityBadge: Record<AlertSeverity, string> = {
  error: 'badge-error text-error-content',
  warning: 'badge-warning text-warning-content',
  info: 'badge-info text-info-content',
  success: 'badge-success text-success-content',
};
const categoryLabel: Record<AlertCategory, string> = {
  inventory: 'Inventory & Booth',
  sales: 'Sales & Sync',
  coop: 'Co-op & Finance',
  marketing: 'Marketing',
  membership: 'Membership',
};
</script>


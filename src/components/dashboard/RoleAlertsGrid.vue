<template>
  <section v-if="activeCards.length > 0" class="space-y-3" aria-label="Needs your attention">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full shrink-0" :class="criticalCount > 0 ? 'bg-error animate-pulse' : 'bg-warning'"></span>
        <h2 class="text-sm sm:text-base font-black tracking-tight">Priority Focus — Needs Your Attention</h2>
        <span
          class="badge badge-sm font-black whitespace-nowrap shrink-0"
          :class="criticalCount > 0 ? 'badge-warning text-warning-content' : 'badge-info text-info-content'"
        >
          {{ activeCards.length }}
        </span>
        <span v-if="overflowCards.length > 0" class="text-[11px] font-semibold text-base-content/60">
          Showing top 3 most urgent
        </span>
      </div>

      <div class="flex flex-wrap items-center gap-1.5">
        <button
          v-if="snoozedCards.length > 0"
          type="button"
          class="btn btn-2xs btn-ghost rounded-lg font-bold text-base-content/65"
          @click="openTray('triage', 'snoozed')"
        >
          {{ snoozedCards.length }} snoozed
        </button>
        <button
          type="button"
          class="btn btn-xs btn-outline rounded-xl font-extrabold gap-1"
          @click="openTray('triage', 'all')"
        >
          <Icon icon="solar:layers-minimalistic-bold-duotone" class="w-3.5 h-3.5 text-warning shrink-0" />
          <span>Triage Tray ({{ activeCards.length }})</span>
        </button>
      </div>
    </div>

    <!-- Top 3 Most Important Action Cards Above the Fold -->
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      <article
        v-for="(card, index) in topPriorityCards"
        :key="card.id"
        class="card bg-base-100 border-2 shadow-sm rounded-2xl p-4 flex flex-col gap-2.5"
        :class="ALERT_SEVERITY_BORDER[card.severity]"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-start gap-2 min-w-0">
            <Icon :icon="card.icon" class="w-5 h-5 shrink-0 mt-0.5" :class="ALERT_SEVERITY_TEXT[card.severity]" />
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="badge badge-2xs badge-neutral text-neutral-content font-mono font-black whitespace-nowrap shrink-0">
                  #{{ index + 1 }}
                </span>
                <span class="text-[10px] font-extrabold uppercase tracking-wider opacity-60">
                  {{ ALERT_CATEGORY_LABEL[card.category] }}
                </span>
              </div>
              <h3 class="text-sm font-black leading-snug break-words mt-0.5">{{ card.title }}</h3>
            </div>
          </div>
          <span class="badge font-black shrink-0 whitespace-nowrap" :class="ALERT_SEVERITY_BADGE[card.severity]">
            {{ card.count }}
          </span>
        </div>

        <p class="text-xs text-base-content/75 leading-relaxed break-words">{{ card.detail }}</p>

        <ul v-if="card.samples.length > 0" class="space-y-1">
          <li v-for="(s, i) in card.samples" :key="i">
            <a :href="s.href" class="text-xs font-semibold link link-hover text-base-content/85 break-words">• {{ s.label }}</a>
          </li>
        </ul>

        <div class="mt-auto pt-2 border-t border-base-200 flex flex-wrap items-center justify-between gap-2">
          <a :href="card.href" class="btn btn-xs btn-primary text-primary-content rounded-lg font-bold gap-1 h-auto min-h-7 py-1 whitespace-normal">
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

    <!-- Compact Ledger Queue Overflow Bar (Keeps Secondary Alerts Out of the Hero Wall) -->
    <div
      v-if="overflowCards.length > 0"
      class="rounded-2xl border border-base-300 bg-base-200/50 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
    >
      <div class="flex flex-wrap items-center gap-1.5 min-w-0">
        <span class="text-xs font-extrabold text-base-content shrink-0">
          +{{ overflowCards.length }} more in queue:
        </span>
        <button
          v-for="extra in overflowCards"
          :key="`extra-${extra.id}`"
          type="button"
          class="badge badge-sm bg-base-100 border border-base-300 text-base-content font-bold gap-1 cursor-pointer hover:border-primary/60 whitespace-nowrap shrink-0 py-2.5"
          @click="openTray('triage', 'all')"
        >
          <span>{{ extra.title }}</span>
          <span class="font-mono font-black text-primary">({{ extra.count }})</span>
        </button>
      </div>
      <button
        type="button"
        class="btn btn-xs btn-warning text-warning-content rounded-xl font-black gap-1 shrink-0 self-start sm:self-center"
        @click="openTray('triage', 'all')"
      >
        <span>Open All {{ activeCards.length }} in Tray</span>
        <Icon icon="solar:alt-arrow-up-bold" class="w-3.5 h-3.5 shrink-0" />
      </button>
    </div>
  </section>

  <section v-else class="rounded-2xl border border-success/30 bg-success/5 px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-2">
    <div class="flex items-center gap-2">
      <Icon icon="solar:check-circle-bold" class="w-5 h-5 text-success shrink-0" />
      <span class="font-semibold">All caught up. Nothing needs your attention right now.</span>
    </div>
    <button
      v-if="snoozedCards.length > 0"
      type="button"
      class="btn btn-xs btn-ghost rounded-lg font-bold"
      @click="openTray('triage', 'snoozed')"
    >
      {{ snoozedCards.length }} snoozed →
    </button>
  </section>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
import {
  useDashboardCommandTray,
  ALERT_SEVERITY_BORDER,
  ALERT_SEVERITY_TEXT,
  ALERT_SEVERITY_BADGE,
  ALERT_CATEGORY_LABEL,
} from '../../composables/dashboard/useDashboardCommandTray';

const {
  activeCards,
  topPriorityCards,
  overflowCards,
  snoozedCards,
  criticalCount,
  openTray,
  snooze,
} = useDashboardCommandTray();
</script>

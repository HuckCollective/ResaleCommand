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

          <!-- =================================================== -->
          <!-- TRAY 1: TRIAGE & NEEDS YOUR ATTENTION QUEUE         -->
          <!-- =================================================== -->
          <template v-if="activeTray === 'triage'">
            <div class="px-4 sm:px-6 py-2 border-b border-base-200 bg-base-100 flex items-center gap-1.5 overflow-x-auto max-w-full scrollbar-none shrink-0">
              <button
                v-for="tab in triageTabs"
                :key="tab.id"
                type="button"
                class="btn btn-2xs sm:btn-xs rounded-xl font-bold gap-1 shrink-0"
                :class="triageFilter === tab.id ? 'btn-primary text-primary-content' : 'btn-ghost bg-base-200/70'"
                @click="triageFilter = tab.id"
              >
                <span>{{ tab.label }}</span>
                <span class="badge badge-2xs font-mono whitespace-nowrap shrink-0">{{ tab.count }}</span>
              </button>
            </div>

            <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-2.5">
              <div
                v-if="filteredTriageCards.length === 0"
                class="rounded-2xl border border-dashed border-base-300 bg-base-200/30 p-6 text-center space-y-2"
              >
                <Icon icon="solar:check-circle-bold" class="w-8 h-8 text-success mx-auto" />
                <div class="text-sm font-black">All clear in this filter</div>
                <p class="text-xs text-base-content/65">
                  {{ triageFilter === 'snoozed' ? 'No alerts are currently snoozed.' : 'Nothing needs immediate triage here right now.' }}
                </p>
              </div>

              <article
                v-for="card in filteredTriageCards"
                :key="`tray-${card.id}`"
                class="rounded-2xl border-2 bg-base-100 p-3.5 space-y-2 shadow-xs"
                :class="ALERT_SEVERITY_BORDER[card.severity]"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-start gap-2 min-w-0">
                    <Icon :icon="card.icon" class="w-5 h-5 shrink-0 mt-0.5" :class="ALERT_SEVERITY_TEXT[card.severity]" />
                    <div class="min-w-0">
                      <div class="text-[10px] font-extrabold uppercase tracking-wider opacity-60">
                        {{ ALERT_CATEGORY_LABEL[card.category] }}
                      </div>
                      <h4 class="text-sm font-black leading-snug break-words">{{ card.title }}</h4>
                    </div>
                  </div>
                  <span class="badge font-black whitespace-nowrap shrink-0" :class="ALERT_SEVERITY_BADGE[card.severity]">
                    {{ card.count }}
                  </span>
                </div>

                <p class="text-xs text-base-content/75 leading-relaxed break-words">{{ card.detail }}</p>

                <ul v-if="card.samples.length > 0" class="space-y-1 pl-1">
                  <li v-for="(s, idx) in card.samples" :key="idx">
                    <a :href="s.href" class="text-xs font-semibold link link-hover text-base-content/85 break-words">
                      • {{ s.label }}
                    </a>
                  </li>
                </ul>

                <div class="pt-2 border-t border-base-200 flex flex-wrap items-center justify-between gap-2">
                  <a
                    :href="card.href"
                    class="btn btn-xs btn-primary text-primary-content rounded-lg font-black gap-1 h-8 px-3"
                  >
                    <span>{{ card.actionText }}</span>
                    <Icon icon="solar:arrow-right-linear" class="w-3.5 h-3.5 shrink-0" />
                  </a>

                  <div v-if="triageFilter === 'snoozed'" class="flex items-center gap-1.5">
                    <button
                      type="button"
                      class="btn btn-xs btn-outline btn-success rounded-lg font-bold"
                      @click="unsnooze(card.id)"
                    >
                      Restore Alert
                    </button>
                  </div>
                  <div v-else class="flex items-center gap-1">
                    <button
                      type="button"
                      class="btn btn-2xs btn-ghost rounded-lg font-bold text-base-content/65"
                      @click="snooze(card.id, 1)"
                    >
                      Snooze 1d
                    </button>
                    <button
                      type="button"
                      class="btn btn-2xs btn-ghost rounded-lg font-bold text-base-content/65"
                      @click="snooze(card.id, 7)"
                    >
                      7d
                    </button>
                  </div>
                </div>
              </article>
            </div>
          </template>

          <!-- =================================================== -->
          <!-- TRAY 2: BOOTH RESTOCK & OPERATIONS RADAR            -->
          <!-- =================================================== -->
          <template v-else-if="activeTray === 'radar' && showCollectiveRadar">
            <div class="px-4 sm:px-6 py-2 border-b border-base-200 bg-base-100 flex items-center gap-1.5 overflow-x-auto max-w-full scrollbar-none shrink-0">
              <button
                type="button"
                class="btn btn-xs rounded-xl font-bold gap-1 shrink-0"
                :class="activeCategory === 'queues' ? 'btn-secondary text-secondary-content' : 'btn-ghost bg-base-200/70'"
                @click="activeCategory = 'queues'"
              >
                <span>Restock &amp; Triage</span>
                <span class="badge badge-2xs font-mono whitespace-nowrap shrink-0">{{ categoryCounts.queues }}</span>
              </button>
              <button
                type="button"
                class="btn btn-xs rounded-xl font-bold gap-1 shrink-0"
                :class="activeCategory === 'locations' ? 'btn-info text-info-content' : 'btn-ghost bg-base-200/70'"
                @click="activeCategory = 'locations'"
              >
                <span>Locations</span>
                <span class="badge badge-2xs font-mono whitespace-nowrap shrink-0">{{ categoryCounts.locations }}</span>
              </button>
              <button
                type="button"
                class="btn btn-xs rounded-xl font-bold gap-1 shrink-0"
                :class="activeCategory === 'partners' ? 'btn-accent text-accent-content' : 'btn-ghost bg-base-200/70'"
                @click="activeCategory = 'partners'"
              >
                <span>Partners</span>
                <span class="badge badge-2xs font-mono whitespace-nowrap shrink-0">{{ categoryCounts.partners }}</span>
              </button>
              <button
                type="button"
                class="btn btn-xs rounded-xl font-bold gap-1 shrink-0"
                :class="activeCategory === 'all' ? 'btn-primary text-primary-content' : 'btn-ghost bg-base-200/70'"
                @click="activeCategory = 'all'"
              >
                <span>All</span>
                <span class="badge badge-2xs font-mono whitespace-nowrap shrink-0">{{ categoryCounts.all }}</span>
              </button>
            </div>

            <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 content-start">
              <a
                v-for="card in visibleRadarCards"
                :key="`tray-radar-${card.id}`"
                :href="card.link"
                class="flex items-start justify-between gap-2.5 p-3 rounded-2xl border bg-base-100 hover:bg-base-200/50 transition-all shadow-2xs"
                :class="[card.borderClass, card.isAlert ? 'bg-warning/5' : '']"
              >
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span class="font-extrabold text-xs sm:text-sm text-base-content break-words">{{ card.title }}</span>
                    <span
                      class="badge badge-2xs font-bold whitespace-nowrap shrink-0"
                      :class="card.isAlert ? 'badge-warning text-warning-content' : 'badge-ghost border-base-300'"
                    >
                      {{ card.badgeLabel }}
                    </span>
                  </div>
                  <p class="text-[11px] text-base-content/65 mt-0.5 break-words">{{ card.subtitle }}</p>
                </div>
                <div class="text-right shrink-0 font-mono">
                  <div class="font-black text-sm text-base-content">{{ card.count.toLocaleString() }}</div>
                  <div class="text-[11px] font-extrabold text-success">
                    ${{ card.totalValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }}
                  </div>
                </div>
              </a>
            </div>
          </template>

          <!-- =================================================== -->
          <!-- TRAY 3: ROLE SHORTCUTS, JOIN QUEUE & STEWARD TOOLS  -->
          <!-- =================================================== -->
          <template v-else-if="activeTray === 'tools'">
            <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
              <!-- Active Role Hat Picker -->
              <div class="rounded-2xl bg-base-200/60 border border-base-300 p-3.5 space-y-2">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span class="text-[11px] font-extrabold uppercase tracking-wider text-primary">
                    Active Hat · {{ memberName }}
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
                    :class="activeHat === hat ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost bg-base-100 border border-base-300'"
                    @click="activeHat = hat"
                  >
                    <span>{{ META[hat].icon }}</span>
                    <span>{{ META[hat].label }}</span>
                  </button>
                </div>
                <p class="text-xs text-base-content/70 break-words">{{ META[activeHat].pitch }}</p>
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

              <!-- Collective Utilities & Trays Handoff -->
              <div class="space-y-2">
                <div class="text-[11px] font-extrabold uppercase tracking-wider opacity-65">
                  Queues, Playbooks &amp; Feedback
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    v-if="source.mode === 'live' && showCollectiveRadar"
                    type="button"
                    class="p-3 rounded-xl bg-base-100 border border-info/40 hover:bg-info/10 transition-all flex items-center justify-between gap-2 text-left"
                    @click="handoffToJoinQueue"
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
                    @click="handoffToTaxPlaybook"
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
                    @click="handoffToMessages('new_bug')"
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

          <!-- Sticky Sheet Container Footer -->
          <BottomActionDock placement="container" :teleport="false" :transition="false">
            <template #left>
              <span class="text-xs font-bold text-base-content/70 break-words">
                {{ META[activeHat].icon }} {{ META[activeHat].label }} View
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
            title="Switch active hat or open Role shortcuts"
            @click="toggleTray('tools')"
          >
            <span>{{ META[activeHat].icon }}</span>
            <span>{{ META[activeHat].label }}</span>
          </button>

          <button
            v-if="activeCards.length > 0"
            type="button"
            class="badge badge-sm font-extrabold gap-1 cursor-pointer whitespace-nowrap shrink-0 py-2.5 px-2.5"
            :class="criticalCount > 0 ? 'badge-warning text-warning-content' : 'badge-info text-info-content'"
            @click="toggleTray('triage')"
          >
            <Icon icon="solar:bell-bing-bold" class="w-3.5 h-3.5 shrink-0" />
            <span>{{ activeCards.length }} need{{ activeCards.length === 1 ? 's' : '' }} attention</span>
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
              : activeCards.length > 0
                ? 'bg-warning/15 hover:bg-warning/25 text-base-content border-warning/50'
                : 'bg-base-200/80 hover:bg-base-300 text-base-content border-base-content/15'
          "
          @click="toggleTray('triage')"
        >
          <Icon icon="solar:bell-bing-bold" class="w-4 h-4 shrink-0" :class="activeTray === 'triage' ? '' : 'text-warning'" />
          <span>Triage</span>
          <span
            v-if="activeCards.length > 0"
            class="badge badge-2xs font-mono font-black whitespace-nowrap shrink-0"
            :class="activeTray === 'triage' ? 'badge-neutral text-neutral-content' : 'badge-warning text-warning-content'"
          >
            {{ activeCards.length }}
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
          <span class="md:hidden">{{ META[activeHat].label }}</span>
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
import { addToast } from '../../stores/toast';
import BottomActionDock from '../common/BottomActionDock.vue';
import { canSeeCollectiveFinancials, MEMBER_HAT_META } from '../../lib/memberHats';
import { useDashboardSource, useActiveHat } from '../../composables/dashboard/useDashboardSource';
import { useOperationsRadar } from '../../composables/dashboard/useOperationsRadar';
import {
  useDashboardCommandTray,
  getRoleActionsForHat,
  getRolePrimaryCpa,
  ALERT_SEVERITY_BORDER,
  ALERT_SEVERITY_TEXT,
  ALERT_SEVERITY_BADGE,
  ALERT_CATEGORY_LABEL,
  type TriageFilterId,
} from '../../composables/dashboard/useDashboardCommandTray';

const META = MEMBER_HAT_META;
const source = useDashboardSource();
const activeHat = useActiveHat();
const {
  activeTray,
  triageFilter,
  activeCards,
  snoozedCards,
  criticalCount,
  openTray,
  toggleTray,
  closeTray,
  snooze,
  unsnooze,
  unsnoozeAll,
} = useDashboardCommandTray();

const { activeCategory, visibleRadarCards, categoryCounts } = useOperationsRadar();

const isMounted = ref(false);
const loggingHours = ref(false);

const memberName = computed(() => source.member.value.name);
const availableHats = computed(() => source.member.value.hats);
const prefix = computed(() => source.member.value.inventoryPrefix || '');
const isAdmin = computed(() => source.isAdmin.value);
const showCollectiveRadar = computed(() => canSeeCollectiveFinancials(source.member.value.hats));
const joinRequestCount = computed(() => source.snapshot.value.joinRequests || 0);

const canLogHours = computed(() => activeHat.value === 'promoter' || activeHat.value === 'enabler');
const roleActions = computed(() => getRoleActionsForHat(activeHat.value, prefix.value));
const primaryCpa = computed(() => getRolePrimaryCpa(activeHat.value));

const sheetTitle = computed(() => {
  if (activeTray.value === 'radar') return 'Operations & Booth Restock Radar';
  if (activeTray.value === 'tools') return 'Role Shortcuts, Queues & Tools';
  return 'Needs Your Attention — Triage Queue';
});

const sheetSubtitle = computed(() => {
  if (activeTray.value === 'radar') return 'Jump straight to any restock, booth sync, or partner workbench queue';
  if (activeTray.value === 'tools') return 'Switch your active hat, log labor hours, or open co-op queues';
  return `${activeCards.value.length} active alert${activeCards.value.length === 1 ? '' : 's'} sorted by highest urgency first`;
});

const sheetIcon = computed(() => {
  if (activeTray.value === 'radar') return 'solar:radar-2-bold';
  if (activeTray.value === 'tools') return 'solar:compass-bold';
  return 'solar:bell-bing-bold';
});

const triageTabs = computed<{ id: TriageFilterId; label: string; count: number }[]>(() => [
  { id: 'all', label: 'All Active', count: activeCards.value.length },
  { id: 'critical', label: 'Urgent', count: criticalCount.value },
  { id: 'inventory', label: 'Inventory & Booth', count: activeCards.value.filter((c) => c.category === 'inventory').length },
  { id: 'sales', label: 'Sales & Sync', count: activeCards.value.filter((c) => c.category === 'sales').length },
  { id: 'coop', label: 'Co-op & Votes', count: activeCards.value.filter((c) => c.category === 'coop' || c.category === 'membership' || c.category === 'marketing').length },
  { id: 'snoozed', label: 'Snoozed', count: snoozedCards.value.length },
]);

const filteredTriageCards = computed(() => {
  if (triageFilter.value === 'snoozed') return snoozedCards.value;
  if (triageFilter.value === 'critical') {
    return activeCards.value.filter((c) => c.severity === 'error' || c.severity === 'warning');
  }
  if (triageFilter.value === 'inventory') {
    return activeCards.value.filter((c) => c.category === 'inventory');
  }
  if (triageFilter.value === 'sales') {
    return activeCards.value.filter((c) => c.category === 'sales');
  }
  if (triageFilter.value === 'coop') {
    return activeCards.value.filter((c) => c.category === 'coop' || c.category === 'membership' || c.category === 'marketing');
  }
  return activeCards.value;
});

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
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('rc:open-coop-messages', handleExternalSheetOpen);
  window.removeEventListener('rc:open-join-queue-tray', handleExternalSheetOpen);
});
</script>

